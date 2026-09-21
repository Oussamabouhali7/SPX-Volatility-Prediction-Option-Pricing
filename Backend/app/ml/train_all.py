from __future__ import annotations

import os
import json
import time
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List
warnings.filterwarnings("ignore")

from app.config import settings
from app.ml.features import (
    load_options, build_features, get_xy, FEATURE_COLS, TARGET_COL,
    SUBPRIME_PERIOD, COVID_PERIOD, filter_period,
)
from app.ml.ml_models import get_ml_regressors, get_stress_classifier, make_stress_labels, HYPERPARAMS
from app.ml.dl_models import get_dl_models, fit_dl, reshape_seq, DL_HYPERPARAMS
from app.ml.walk_forward import generate_windows, split_window_data, crisis_split
from sklearn.preprocessing import StandardScaler
from app.ml.metrics import all_metrics

HDR = f"  {'Modèle':<15} {'Split':<8} {'RMSE':>8} {'MAE':>8} {'MSE':>12} {'R²':>8} {'MAPE':>8} {'QLIKE':>8} {'DirAcc':>8}"
SEP = "  " + "-" * 85

def _print_metrics(mname, split_name, s):
    print(f"  {mname:<15} {split_name:<8} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")

def _safe_metrics(name, y_true, y_pred):
    if len(y_true) == 0 or len(y_pred) == 0:
        return {"rmse":0,"mae":0,"mse":0,"r2":0,"mape":0,"qlike":0,
                "directional_accuracy":0,"n":0,"sum_y":0.0,"sum_y2":0.0}
    m = all_metrics(y_true, y_pred)
    # Sommes auxiliaires : permettent de reconstruire un R² POOLÉ exact
    # à l'agrégation (le R² ne se moyenne pas — voir build_evaluation).
    yt = np.asarray(y_true, dtype=float).flatten()
    m["n"] = int(yt.size)
    m["sum_y"] = float(yt.sum())
    m["sum_y2"] = float((yt ** 2).sum())
    return m

def _fit_predict_ml(name, model, X_train, y_train, X_val, y_val, X_test, y_test):
    if name == "SVR" and len(X_train) > 30_000:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X_train), 30_000, replace=False)
        model.fit(X_train[idx], y_train[idx])
    elif name == "XGBoost":
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    else:
        model.fit(X_train, y_train)
    return model, model.predict(X_train), model.predict(X_val), model.predict(X_test)

def _fit_predict_dl(name, model, X_train, y_train, X_val, y_val, X_test, y_test,
                    epochs=10, batch_size=512, patience=4):
    is_seq = (name != "MLP")
    fit_dl(model, X_train, y_train, X_val, y_val,
           epochs=epochs, batch_size=batch_size, patience=patience,
           is_sequential=is_seq, verbose=0)
    X_tr = reshape_seq(X_train) if is_seq else X_train
    X_va = reshape_seq(X_val)   if is_seq else X_val
    X_te = reshape_seq(X_test)  if is_seq else X_test
    return (model,
            model.predict(X_tr, verbose=0).flatten(),
            model.predict(X_va, verbose=0).flatten(),
            model.predict(X_te, verbose=0).flatten())

def _save_partial(results, path):
    with open(path, "w") as f:
        json.dump(results, f, indent=2, default=str)

def run_walk_forward(features_df, run_dl=True, max_windows=None):
    windows = generate_windows()
    if max_windows:
        windows = windows[:max_windows]
    print(f"[walk-forward] {len(windows)} fenêtres à traiter")

    results = []
    for i, (w_start, w_end) in enumerate(windows, 1):
        splits = split_window_data(features_df, w_start, w_end)
        if len(splits["train"]) < 100 or len(splits["val"]) < 20 or len(splits["test"]) < 20:
            print(f"  Fenêtre {i}: trop peu de données, skip")
            continue

        X_train, y_train = get_xy(splits["train"])
        X_val,   y_val   = get_xy(splits["val"])
        X_test,  y_test  = get_xy(splits["test"])
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)

        window_record = {"window_id": i, "start_date": str(w_start.date()), "end_date": str(w_end.date()), "models": {}}

        for name, mdl in get_ml_regressors().items():
            t0 = time.perf_counter()
            try:
                _, p_tr, p_va, p_te = _fit_predict_ml(name, mdl, X_train, y_train, X_val, y_val, X_test, y_test)
                window_record["models"][name] = {
                    "train": _safe_metrics(name, y_train, p_tr),
                    "val":   _safe_metrics(name, y_val,   p_va),
                    "test":  _safe_metrics(name, y_test,  p_te),
                    "fit_seconds": round(time.perf_counter() - t0, 2),
                }
            except Exception as e:
                print(f"  Fenêtre {i} - {name} ERREUR : {e}")

        if run_dl:
            n_feat = X_train.shape[1]
            for name, mdl in get_dl_models(n_feat).items():
                t0 = time.perf_counter()
                try:
                    _, p_tr, p_va, p_te = _fit_predict_dl(name, mdl, X_train, y_train, X_val, y_val, X_test, y_test, epochs=8, batch_size=512, patience=3)
                    window_record["models"][name] = {
                        "train": _safe_metrics(name, y_train, p_tr),
                        "val":   _safe_metrics(name, y_val,   p_va),
                        "test":  _safe_metrics(name, y_test,  p_te),
                        "fit_seconds": round(time.perf_counter() - t0, 2),
                    }
                except Exception as e:
                    import traceback
                    print(f"  Fenêtre {i} - {name} ERREUR : {e}")
                    traceback.print_exc()

        results.append(window_record)
        print(f"\n  ══ Fenêtre {i:2d} ({w_start.date()} → {w_end.date()}) ══")
        print(HDR)
        print(SEP)
        for mname, scores in window_record["models"].items():
            _print_metrics(mname, "Train", scores["train"])
            _print_metrics(mname, "Val",   scores["val"])
            _print_metrics(mname, "Test",  scores["test"])
            print(SEP)
        _save_partial(results, Path("/app/saved_models/partial_results.json"))

    return results

def run_crisis_split(features_df, run_dl=True):
    print(f"\n[crisis-split] Subprimes ({SUBPRIME_PERIOD}) → COVID ({COVID_PERIOD})")
    splits = crisis_split(features_df)
    if min(len(splits["train"]), len(splits["test"]), len(splits["val"])) < 50:
        print("  Pas assez de données pour le crisis split")
        return {}

    X_train, y_train = get_xy(splits["train"])
    X_test,  y_test  = get_xy(splits["test"])
    X_val,   y_val   = get_xy(splits["val"])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    X_val   = scaler.transform(X_val)
    print(f"  Train Subprimes={len(X_train):,} | Test Subprimes={len(X_test):,} | Val COVID={len(X_val):,}")
    print(f"\n  {'Modèle':<15} {'Split':<22} {'RMSE':>8} {'MAE':>8} {'MSE':>12} {'R²':>8} {'MAPE':>8} {'QLIKE':>8} {'DirAcc':>8}")
    print("  " + "-" * 95)

    out = {}
    for name, mdl in get_ml_regressors().items():
        try:
            _, p_tr, p_te, p_va = _fit_predict_ml(name, mdl, X_train, y_train, X_test, y_test, X_val, y_val)
            out[name] = {
                "train_subprime": _safe_metrics(name, y_train, p_tr),
                "test_subprime":  _safe_metrics(name, y_test,  p_te),
                "val_covid":      _safe_metrics(name, y_val,   p_va),
            }
            for split_label, key in [("Train Subprimes","train_subprime"),("Test Subprimes","test_subprime"),("Val COVID","val_covid")]:
                s = out[name][key]
                print(f"  {name:<15} {split_label:<22} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")
            print("  " + "-" * 95)
        except Exception as e:
            print(f"  {name} ERREUR : {e}")

    if run_dl:
        n_feat = X_train.shape[1]
        for name, mdl in get_dl_models(n_feat).items():
            try:
                _, p_tr, p_te, p_va = _fit_predict_dl(name, mdl, X_train, y_train, X_test, y_test, X_val, y_val, epochs=15, batch_size=512, patience=4)
                out[name] = {
                    "train_subprime": _safe_metrics(name, y_train, p_tr),
                    "test_subprime":  _safe_metrics(name, y_test,  p_te),
                    "val_covid":      _safe_metrics(name, y_val,   p_va),
                }
                for split_label, key in [("Train Subprimes","train_subprime"),("Test Subprimes","test_subprime"),("Val COVID","val_covid")]:
                    s = out[name][key]
                    print(f"  {name:<15} {split_label:<22} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")
                print("  " + "-" * 95)
            except Exception as e:
                import traceback
                print(f"  {name} ERREUR : {e}")
                traceback.print_exc()

    return out

def train_final_models(features_df, models_dir, run_dl=True):
    print("\n[final-fit] Entraînement final sur toute la période 1996-2023")
    df_sorted = features_df.sort_values("date").reset_index(drop=True)
    n_train = int(len(df_sorted) * 0.85)
    X_train, y_train = get_xy(df_sorted.iloc[:n_train])
    X_val,   y_val   = get_xy(df_sorted.iloc[n_train:])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val   = scaler.transform(X_val)
    joblib.dump(scaler, models_dir / "scaler.pkl")

    for name, mdl in get_ml_regressors().items():
        print(f"  [ML] {name}...")
        if name == "SVR" and len(X_train) > 30_000:
            idx = np.random.default_rng(42).choice(len(X_train), 30_000, replace=False)
            mdl.fit(X_train[idx], y_train[idx])
        elif name == "XGBoost":
            mdl.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
        else:
            mdl.fit(X_train, y_train)
        joblib.dump(mdl, models_dir / f"{name}.pkl")

    print("  [SVM_clf] entraînement classifieur stress...")
    clf = get_stress_classifier()
    y_stress = make_stress_labels(df_sorted.iloc[:n_train]["vix"].values)
    idx = np.random.default_rng(42).choice(len(X_train), min(20_000, len(X_train)), replace=False)
    clf.fit(X_train[idx], y_stress[idx])
    joblib.dump(clf, models_dir / "SVM_clf.pkl")

    if run_dl:
        for name, mdl in get_dl_models(X_train.shape[1]).items():
            print(f"  [DL] {name}...")
            try:
                fit_dl(mdl, X_train, y_train, X_val, y_val, epochs=20, batch_size=512, patience=5, is_sequential=(name != "MLP"), verbose=0)
                mdl.save(models_dir / f"{name}.keras")
            except Exception as e:
                print(f"     ERREUR : {e}")

def aggregate_results(walk_forward_results, crisis_results):
    model_names = set()
    for w in walk_forward_results:
        model_names.update(w.get("models", {}).keys())

    models_summary = []
    for name in sorted(model_names):
        acc = {"rmse":[],"mae":[],"mse":[],"r2":[],"mape":[],"qlike":[],"directional_accuracy":[]}
        # Accumulateurs pour le R² POOLÉ (sur l'ensemble out-of-sample concaténé)
        pool_n = 0; pool_sum_y = 0.0; pool_sum_y2 = 0.0; pool_ss_res = 0.0
        for w in walk_forward_results:
            if name not in w.get("models", {}):
                continue
            t = w["models"][name]["test"]
            acc["rmse"].append(t["rmse"]); acc["mae"].append(t["mae"])
            acc["mse"].append(t["mse"]);   acc["r2"].append(t["r2"])
            acc["mape"].append(t.get("mape",0)); acc["qlike"].append(t.get("qlike",0))
            acc["directional_accuracy"].append(t.get("directional_accuracy",0))
            n = t.get("n", 0)
            if n:
                pool_n      += n
                pool_sum_y  += t.get("sum_y", 0.0)
                pool_sum_y2 += t.get("sum_y2", 0.0)
                pool_ss_res += t["mse"] * n          # SS_res de la fenêtre = mse * n

        # R² poolé = 1 - SS_res_global / SS_tot_global, avec la moyenne GLOBALE
        # de y comme référence. C'est la bonne façon d'agréger un R² walk-forward :
        # la moyenne des R² par fenêtre est dominée par quelques fenêtres à
        # variance d'IV quasi-nulle (R² -> -inf) et n'a pas de sens.
        if pool_n > 1:
            ss_tot_global = pool_sum_y2 - (pool_sum_y ** 2) / pool_n
            pooled_r2 = float(1.0 - pool_ss_res / ss_tot_global) if ss_tot_global > 0 else 0.0
        else:
            pooled_r2 = 0.0
        r2_arr = np.array(acc["r2"]) if acc["r2"] else np.array([0.0])

        hp     = HYPERPARAMS.get(name) or DL_HYPERPARAMS.get(name) or {}
        crisis = crisis_results.get(name, {})
        models_summary.append({
            "model_name": name,
            "n_windows":  len(acc["rmse"]),
            "mean_rmse":  float(np.mean(acc["rmse"]))  if acc["rmse"]  else 0,
            "mean_mae":   float(np.mean(acc["mae"]))   if acc["mae"]   else 0,
            "mean_mse":   float(np.mean(acc["mse"]))   if acc["mse"]   else 0,
            "mean_r2":    float(np.mean(acc["r2"]))    if acc["r2"]    else 0,
            "pooled_r2":  pooled_r2,
            "median_r2":  float(np.median(r2_arr)),
            "pct_windows_r2_positive": float((r2_arr > 0).mean() * 100),
            "mean_mape":  float(np.mean(acc["mape"]))  if acc["mape"]  else 0,
            "mean_qlike": float(np.mean(acc["qlike"])) if acc["qlike"] else 0,
            "mean_directional_accuracy": float(np.mean(acc["directional_accuracy"])) if acc["directional_accuracy"] else 0,
            "crisis_train_rmse": crisis.get("train_subprime", {}).get("rmse"),
            "crisis_test_rmse":  crisis.get("test_subprime",  {}).get("rmse"),
            "crisis_val_rmse":   crisis.get("val_covid",      {}).get("rmse"),
            "hyperparameters": hp,
        })

    flat_windows = []
    for w in walk_forward_results:
        for model_name, scores in w.get("models", {}).items():
            flat_windows.append({
                "window_id": w["window_id"], "start_date": w["start_date"], "end_date": w["end_date"],
                "model": model_name,
                "rmse_train": scores["train"]["rmse"], "mae_train": scores["train"]["mae"],
                "mse_train":  scores["train"]["mse"],  "r2_train":  scores["train"]["r2"],
                "rmse_val":   scores["val"]["rmse"],   "mae_val":   scores["val"]["mae"],
                "mse_val":    scores["val"]["mse"],    "r2_val":    scores["val"]["r2"],
                "rmse_test":  scores["test"]["rmse"],  "mae_test":  scores["test"]["mae"],
                "mse_test":   scores["test"]["mse"],   "r2_test":   scores["test"]["r2"],
                "mape":       scores["test"].get("mape", 0),
                "qlike":      scores["test"].get("qlike", 0),
                "directional_accuracy": scores["test"].get("directional_accuracy", 0),
                # Sommes auxiliaires pour R² poolé côté frontend
                "n_test":     scores["test"].get("n", 0),
                "sum_y_test": scores["test"].get("sum_y", 0.0),
                "sum_y2_test":scores["test"].get("sum_y2", 0.0),
            })

    return {"models": models_summary, "windows": flat_windows, "crisis_split_details": crisis_results, "feature_cols": FEATURE_COLS}

def main(run_dl=True, max_windows=None):
    print("=" * 60)
    print("ENTRAÎNEMENT COMPLET — Prédiction IV")
    print("=" * 60)
    print(f"Données : {settings.DATA_FILE}")

    df = load_options(settings.DATA_FILE)
    features_df = build_features(df)
    print(f"Features prêtes : {features_df.shape}")

    models_dir = Path(settings.MODELS_DIR)
    models_dir.mkdir(parents=True, exist_ok=True)

    wf_results     = run_walk_forward(features_df, run_dl=run_dl, max_windows=max_windows)
    crisis_results = run_crisis_split(features_df, run_dl=run_dl)
    train_final_models(features_df, models_dir, run_dl=run_dl)

    final_eval = aggregate_results(wf_results, crisis_results)
    with open(models_dir / "evaluation.json", "w") as f:
        json.dump(final_eval, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print(f"✅ Terminé. Résultats : {models_dir / 'evaluation.json'}")
    print("=" * 60)

if __name__ == "__main__":
    import sys
    run_dl = "--no-dl" not in sys.argv
    max_w  = None
    for arg in sys.argv:
        if arg.startswith("--max-windows="):
            max_w = int(arg.split("=")[1])
    main(run_dl=run_dl, max_windows=max_w)



"""
train_all.py
============
Script d'entraînement complet :
1. Charge les données options_merged_spx.csv
2. Entraîne tous les modèles (5 ML + 7 DL) sur les 54 fenêtres glissantes
3. Calcule les métriques par fenêtre (RMSE, MAE, MSE, R², MAPE, QLIKE, Directional Accuracy)
4. Effectue le crisis split (Subprimes train+test → COVID validation)
5. Entraîne le SVM classifier pour la détection de stress
6. Sauvegarde les modèles finaux (entraînés sur toute la période) dans saved_models/
7. Sauvegarde le JSON d'évaluation pour le dashboard

Usage (depuis backend/) :
    python -m app.ml.train_all
"""

"""
from __future__ import annotations

import os
import json
import time
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List
warnings.filterwarnings("ignore")

from app.config import settings
from app.ml.features import (
    load_options, build_features, get_xy, FEATURE_COLS, TARGET_COL,
    SUBPRIME_PERIOD, COVID_PERIOD, filter_period,
)
from app.ml.ml_models import get_ml_regressors, get_stress_classifier, make_stress_labels, HYPERPARAMS
from app.ml.dl_models import get_dl_models, fit_dl, reshape_seq, DL_HYPERPARAMS
from app.ml.walk_forward import generate_windows, split_window_data, crisis_split
from sklearn.preprocessing import StandardScaler
from app.ml.metrics import all_metrics

HDR = f"  {'Modèle':<15} {'Split':<8} {'RMSE':>8} {'MAE':>8} {'MSE':>12} {'R²':>8} {'MAPE':>8} {'QLIKE':>8} {'DirAcc':>8}"
SEP = "  " + "-" * 85

def _print_metrics(mname, split_name, s):
    print(f"  {mname:<15} {split_name:<8} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")

def _safe_metrics(name, y_true, y_pred):
    if len(y_true) == 0 or len(y_pred) == 0:
        return {"rmse":0,"mae":0,"mse":0,"r2":0,"mape":0,"qlike":0,"directional_accuracy":0}
    return all_metrics(y_true, y_pred)

def _fit_predict_ml(name, model, X_train, y_train, X_val, y_val, X_test, y_test):
    if name == "SVR" and len(X_train) > 30_000:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X_train), 30_000, replace=False)
        model.fit(X_train[idx], y_train[idx])
    elif name == "XGBoost":
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
        # early_stopping_rounds est dans les hyperparams
    else:
        model.fit(X_train, y_train)
    return model, model.predict(X_train), model.predict(X_val), model.predict(X_test)

def _fit_predict_dl(name, model, X_train, y_train, X_val, y_val, X_test, y_test,
                    epochs=10, batch_size=512, patience=4):
    is_seq = (name != "MLP")
    fit_dl(model, X_train, y_train, X_val, y_val,
           epochs=epochs, batch_size=batch_size, patience=patience,
           is_sequential=is_seq, verbose=0)
    X_tr = reshape_seq(X_train) if is_seq else X_train
    X_va = reshape_seq(X_val)   if is_seq else X_val
    X_te = reshape_seq(X_test)  if is_seq else X_test
    return (model,
            model.predict(X_tr, verbose=0).flatten(),
            model.predict(X_va, verbose=0).flatten(),
            model.predict(X_te, verbose=0).flatten())

def _save_partial(results, path):
    with open(path, "w") as f:
        json.dump(results, f, indent=2, default=str)

def run_walk_forward(features_df, run_dl=True, max_windows=None):
    windows = generate_windows()
    if max_windows:
        windows = windows[:max_windows]
    print(f"[walk-forward] {len(windows)} fenêtres à traiter")

    results = []
    for i, (w_start, w_end) in enumerate(windows, 1):
        splits = split_window_data(features_df, w_start, w_end)
        if len(splits["train"]) < 100 or len(splits["val"]) < 20 or len(splits["test"]) < 20:
            print(f"  Fenêtre {i}: trop peu de données, skip")
            continue

        X_train, y_train = get_xy(splits["train"])
        X_val,   y_val   = get_xy(splits["val"])
        X_test,  y_test  = get_xy(splits["test"])
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)


        window_record = {"window_id": i, "start_date": str(w_start.date()), "end_date": str(w_end.date()), "models": {}}

        for name, mdl in get_ml_regressors().items():
            t0 = time.perf_counter()
            try:
                _, p_tr, p_va, p_te = _fit_predict_ml(name, mdl, X_train, y_train, X_val, y_val, X_test, y_test)
                window_record["models"][name] = {
                    "train": _safe_metrics(name, y_train, p_tr),
                    "val":   _safe_metrics(name, y_val,   p_va),
                    "test":  _safe_metrics(name, y_test,  p_te),
                    "fit_seconds": round(time.perf_counter() - t0, 2),
                }
            except Exception as e:
                print(f"  Fenêtre {i} - {name} ERREUR : {e}")

        if run_dl:
            n_feat = X_train.shape[1]
            for name, mdl in get_dl_models(n_feat).items():
                t0 = time.perf_counter()
                try:
                    _, p_tr, p_va, p_te = _fit_predict_dl(name, mdl, X_train, y_train, X_val, y_val, X_test, y_test, epochs=8, batch_size=512, patience=3)
                    window_record["models"][name] = {
                        "train": _safe_metrics(name, y_train, p_tr),
                        "val":   _safe_metrics(name, y_val,   p_va),
                        "test":  _safe_metrics(name, y_test,  p_te),
                        "fit_seconds": round(time.perf_counter() - t0, 2),
                    }
                except Exception as e:
                    import traceback
                    print(f"  Fenêtre {i} - {name} ERREUR : {e}")
                    traceback.print_exc()

        results.append(window_record)
        print(f"\n  ══ Fenêtre {i:2d} ({w_start.date()} → {w_end.date()}) ══")
        print(HDR)
        print(SEP)
        for mname, scores in window_record["models"].items():
            _print_metrics(mname, "Train", scores["train"])
            _print_metrics(mname, "Val",   scores["val"])
            _print_metrics(mname, "Test",  scores["test"])
            print(SEP)
        _save_partial(results, Path("/app/saved_models/partial_results.json"))

    return results

def run_crisis_split(features_df, run_dl=True):
    print(f"\n[crisis-split] Subprimes ({SUBPRIME_PERIOD}) → COVID ({COVID_PERIOD})")
    splits = crisis_split(features_df)
    if min(len(splits["train"]), len(splits["test"]), len(splits["val"])) < 50:
        print("  Pas assez de données pour le crisis split")
        return {}

    X_train, y_train = get_xy(splits["train"])
    X_test,  y_test  = get_xy(splits["test"])
    X_val,   y_val   = get_xy(splits["val"])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    X_val   = scaler.transform(X_val)

    print(f"  Train Subprimes={len(X_train):,} | Test Subprimes={len(X_test):,} | Val COVID={len(X_val):,}")
    print(f"\n  {'Modèle':<15} {'Split':<22} {'RMSE':>8} {'MAE':>8} {'MSE':>12} {'R²':>8} {'MAPE':>8} {'QLIKE':>8} {'DirAcc':>8}")
    print("  " + "-" * 95)

    out = {}
    for name, mdl in get_ml_regressors().items():
        try:
            _, p_tr, p_te, p_va = _fit_predict_ml(name, mdl, X_train, y_train, X_test, y_test, X_val, y_val)
            out[name] = {
                "train_subprime": _safe_metrics(name, y_train, p_tr),
                "test_subprime":  _safe_metrics(name, y_test,  p_te),
                "val_covid":      _safe_metrics(name, y_val,   p_va),
            }
            for split_label, key in [("Train Subprimes","train_subprime"),("Test Subprimes","test_subprime"),("Val COVID","val_covid")]:
                s = out[name][key]
                print(f"  {name:<15} {split_label:<22} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")
            print("  " + "-" * 95)
        except Exception as e:
            print(f"  {name} ERREUR : {e}")

    if run_dl:
        n_feat = X_train.shape[1]
        for name, mdl in get_dl_models(n_feat).items():
            try:
                _, p_tr, p_te, p_va = _fit_predict_dl(name, mdl, X_train, y_train, X_test, y_test, X_val, y_val, epochs=15, batch_size=512, patience=4)
                out[name] = {
                    "train_subprime": _safe_metrics(name, y_train, p_tr),
                    "test_subprime":  _safe_metrics(name, y_test,  p_te),
                    "val_covid":      _safe_metrics(name, y_val,   p_va),
                }
                for split_label, key in [("Train Subprimes","train_subprime"),("Test Subprimes","test_subprime"),("Val COVID","val_covid")]:
                    s = out[name][key]
                    print(f"  {name:<15} {split_label:<22} {s['rmse']:>8.4f} {s['mae']:>8.4f} {s['mse']:>12.6f} {s['r2']:>8.4f} {s.get('mape',0):>8.4f} {s.get('qlike',0):>8.4f} {s.get('directional_accuracy',0):>8.4f}")
                print("  " + "-" * 95)
            except Exception as e:
                import traceback
                print(f"  {name} ERREUR : {e}")
                traceback.print_exc()

    return out

def train_final_models(features_df, models_dir, run_dl=True):
    print("\n[final-fit] Entraînement final sur toute la période 1996-2023")
    df_sorted = features_df.sort_values("date").reset_index(drop=True)
    n_train = int(len(df_sorted) * 0.85)
    X_train, y_train = get_xy(df_sorted.iloc[:n_train])
    X_val,   y_val   = get_xy(df_sorted.iloc[n_train:])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val   = scaler.transform(X_val)
    joblib.dump(scaler, models_dir / "scaler.pkl")
    for name, mdl in get_ml_regressors().items():
        print(f"  [ML] {name}...")
        if name == "SVR" and len(X_train) > 30_000:
            idx = np.random.default_rng(42).choice(len(X_train), 30_000, replace=False)
            mdl.fit(X_train[idx], y_train[idx])
        elif name == "XGBoost":
            mdl.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
        else:
            mdl.fit(X_train, y_train)
        joblib.dump(mdl, models_dir / f"{name}.pkl")

    print("  [SVM_clf] entraînement classifieur stress...")
    clf = get_stress_classifier()
    y_stress = make_stress_labels(df_sorted.iloc[:n_train]["vix"].values)
    idx = np.random.default_rng(42).choice(len(X_train), min(20_000, len(X_train)), replace=False)
    clf.fit(X_train[idx], y_stress[idx])
    joblib.dump(clf, models_dir / "SVM_clf.pkl")

    if run_dl:
        for name, mdl in get_dl_models(X_train.shape[1]).items():
            print(f"  [DL] {name}...")
            try:
                fit_dl(mdl, X_train, y_train, X_val, y_val, epochs=20, batch_size=512, patience=5, is_sequential=(name != "MLP"), verbose=0)
                mdl.save(models_dir / f"{name}.keras")
            except Exception as e:
                print(f"     ERREUR : {e}")

def aggregate_results(walk_forward_results, crisis_results):
    model_names = set()
    for w in walk_forward_results:
        model_names.update(w.get("models", {}).keys())

    models_summary = []
    for name in sorted(model_names):
        acc = {"rmse":[],"mae":[],"mse":[],"r2":[],"mape":[],"qlike":[],"directional_accuracy":[]}
        for w in walk_forward_results:
            if name not in w.get("models", {}):
                continue
            t = w["models"][name]["test"]
            acc["rmse"].append(t["rmse"]); acc["mae"].append(t["mae"])
            acc["mse"].append(t["mse"]);   acc["r2"].append(t["r2"])
            acc["mape"].append(t.get("mape",0)); acc["qlike"].append(t.get("qlike",0))
            acc["directional_accuracy"].append(t.get("directional_accuracy",0))

        hp     = HYPERPARAMS.get(name) or DL_HYPERPARAMS.get(name) or {}
        crisis = crisis_results.get(name, {})
        models_summary.append({
            "model_name": name,
            "n_windows":  len(acc["rmse"]),
            "mean_rmse":  float(np.mean(acc["rmse"]))  if acc["rmse"]  else 0,
            "mean_mae":   float(np.mean(acc["mae"]))   if acc["mae"]   else 0,
            "mean_mse":   float(np.mean(acc["mse"]))   if acc["mse"]   else 0,
            "mean_r2":    float(np.mean(acc["r2"]))    if acc["r2"]    else 0,
            "mean_mape":  float(np.mean(acc["mape"]))  if acc["mape"]  else 0,
            "mean_qlike": float(np.mean(acc["qlike"])) if acc["qlike"] else 0,
            "mean_directional_accuracy": float(np.mean(acc["directional_accuracy"])) if acc["directional_accuracy"] else 0,
            "crisis_train_rmse": crisis.get("train_subprime", {}).get("rmse"),
            "crisis_test_rmse":  crisis.get("test_subprime",  {}).get("rmse"),
            "crisis_val_rmse":   crisis.get("val_covid",      {}).get("rmse"),
            "hyperparameters": hp,
        })

    flat_windows = []
    for w in walk_forward_results:
        for model_name, scores in w.get("models", {}).items():
            flat_windows.append({
                "window_id": w["window_id"], "start_date": w["start_date"], "end_date": w["end_date"],
                "model": model_name,
                "rmse_train": scores["train"]["rmse"], "mae_train": scores["train"]["mae"],
                "mse_train":  scores["train"]["mse"],  "r2_train":  scores["train"]["r2"],
                "rmse_val":   scores["val"]["rmse"],   "mae_val":   scores["val"]["mae"],
                "mse_val":    scores["val"]["mse"],    "r2_val":    scores["val"]["r2"],
                "rmse_test":  scores["test"]["rmse"],  "mae_test":  scores["test"]["mae"],
                "mse_test":   scores["test"]["mse"],   "r2_test":   scores["test"]["r2"],
                "mape":       scores["test"].get("mape", 0),
                "qlike":      scores["test"].get("qlike", 0),
                "directional_accuracy": scores["test"].get("directional_accuracy", 0),
            })

    return {"models": models_summary, "windows": flat_windows, "crisis_split_details": crisis_results, "feature_cols": FEATURE_COLS}

def main(run_dl=True, max_windows=None):
    print("=" * 60)
    print("ENTRAÎNEMENT COMPLET — Prédiction IV")
    print("=" * 60)
    print(f"Données : {settings.DATA_FILE}")

    df = load_options(settings.DATA_FILE)
    features_df = build_features(df)
    print(f"Features prêtes : {features_df.shape}")

    models_dir = Path(settings.MODELS_DIR)
    models_dir.mkdir(parents=True, exist_ok=True)

    wf_results     = run_walk_forward(features_df, run_dl=run_dl, max_windows=max_windows)
    crisis_results = run_crisis_split(features_df, run_dl=run_dl)
    train_final_models(features_df, models_dir, run_dl=run_dl)

    final_eval = aggregate_results(wf_results, crisis_results)
    with open(models_dir / "evaluation.json", "w") as f:
        json.dump(final_eval, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print(f"✅ Terminé. Résultats : {models_dir / 'evaluation.json'}")
    print("=" * 60)

if __name__ == "__main__":
    import sys
    run_dl = "--no-dl" not in sys.argv
    max_w  = None
    for arg in sys.argv:
        if arg.startswith("--max-windows="):
            max_w = int(arg.split("=")[1])
    main(run_dl=run_dl, max_windows=max_w)
    """


"""
train_all.py
============
Script d'entraînement complet :
1. Charge les données options_merged_spx.csv
2. Entraîne tous les modèles (5 ML + 7 DL) sur les 54 fenêtres glissantes
3. Calcule les métriques par fenêtre (RMSE, MAE, MSE, R², MAPE, QLIKE, Directional Accuracy)
4. Effectue le crisis split (Subprimes train+test → COVID validation)
5. Entraîne le SVM classifier pour la détection de stress
6. Sauvegarde les modèles finaux (entraînés sur toute la période) dans saved_models/
7. Sauvegarde le JSON d'évaluation pour le dashboard

Usage (depuis backend/) :
    python -m app.ml.train_all
"""
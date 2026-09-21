"""
Test + SAUVEGARDE des modèles DL tabulaires corrigés — entraînement GLOBAL hors-crise.

Sauvegarde :
  - saved_models/global/<nom>.keras   (poids du modèle)
  - saved_models/global/evaluation_global.json  (métriques + historique epochs)

Usage :
  python -m app.ml.dl_test_tabular                         # tous les modèles
  python -m app.ml.dl_test_tabular --model BiLSTM          # un seul
  python -m app.ml.dl_test_tabular --models LSTM GRU CNN   # plusieurs
  python -m app.ml.dl_test_tabular --epochs 200 --no-save  # sans sauvegarder
"""
import argparse
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.linear_model import Lasso

from app.ml.features import load_options, build_features, get_xy, FEATURE_COLS
from app.ml.walk_forward import EXCLUDED_PERIODS
from app.ml.dl_models_tabular import get_tabular_dl_models, fit_tabular_dl, _BUILDERS
from app.config import settings

SAVE_DIR = Path("saved_models/global")


def compute_all_metrics(y_true, y_pred):
    y_t = np.asarray(y_true).flatten()
    y_p = np.asarray(y_pred).flatten()
    if len(y_t) == 0:
        return {k: 0.0 for k in ['rmse','mae','r2','mape','qlike','dir_acc']}
    mse  = mean_squared_error(y_t, y_p)
    mae  = mean_absolute_error(y_t, y_p)
    r2   = r2_score(y_t, y_p)
    mask = np.abs(y_t) > 1e-8
    mape = float(np.mean(np.abs((y_t[mask]-y_p[mask])/y_t[mask]))*100) if mask.sum() else 0.0
    ratio = y_t / (y_p + 1e-10)
    qlike = float(np.mean(ratio - np.log(np.abs(ratio)+1e-10) - 1))
    dir_acc = float(np.mean(np.sign(np.diff(y_t))==np.sign(np.diff(y_p)))*100) if len(y_t)>1 else 0.0
    return {'rmse':float(np.sqrt(mse)),'mae':float(mae),'r2':float(r2),
            'mape':float(mape),'qlike':qlike,'dir_acc':dir_acc}


def exclude_crisis(df):
    mask = pd.Series(True, index=df.index)
    for start, end in EXCLUDED_PERIODS:
        cs, ce = pd.Timestamp(start), pd.Timestamp(end)
        mask &= ~((df["date"]>=cs) & (df["date"]<=ce))
    return df[mask].copy()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",   type=str,  default=None)
    parser.add_argument("--models",  type=str,  nargs="+", default=None)
    parser.add_argument("--epochs",  type=int,  default=300)
    parser.add_argument("--batch",   type=int,  default=128)
    parser.add_argument("--patience",type=int,  default=30)
    parser.add_argument("--no-save", dest="save", action="store_false")
    parser.set_defaults(save=True)
    args = parser.parse_args()

    if args.model:      only = [args.model]
    elif args.models:   only = args.models
    else:               only = list(_BUILDERS.keys())

    print("="*80)
    print("  DL TABULAIRE — entraînement GLOBAL hors-crise")
    print(f"  Modèles : {', '.join(only)}  |  Sauvegarde : {'✅' if args.save else '❌'}")
    print("="*80)

    # ── Données ──
    print("\n[1/4] Chargement...")
    df = load_options(settings.DATA_FILE)
    df = build_features(df)
    df = exclude_crisis(df).sort_values("date").reset_index(drop=True)
    n = len(df)
    n_tr, n_va = int(n*0.70), int(n*0.15)
    df_tr = df.iloc[:n_tr]
    df_va = df.iloc[n_tr:n_tr+n_va]
    df_te = df.iloc[n_tr+n_va:]
    print(f"  → {n:,} lignes | Train={len(df_tr):,} Val={len(df_va):,} Test={len(df_te):,}")
    print(f"  → Train : {df_tr['date'].min().date()} → {df_tr['date'].max().date()}")
    print(f"  → Test  : {df_te['date'].min().date()} → {df_te['date'].max().date()}")

    X_tr, y_tr = get_xy(df_tr)
    X_va, y_va = get_xy(df_va)
    X_te, y_te = get_xy(df_te)
    scaler = StandardScaler()
    X_tr = scaler.fit_transform(X_tr)
    X_va = scaler.transform(X_va)
    X_te = scaler.transform(X_te)
    n_features = X_tr.shape[1]

    meta = {
        "train_start": str(df_tr['date'].min().date()),
        "train_end":   str(df_tr['date'].max().date()),
        "val_start":   str(df_va['date'].min().date()),
        "val_end":     str(df_va['date'].max().date()),
        "test_start":  str(df_te['date'].min().date()),
        "test_end":    str(df_te['date'].max().date()),
        "n_train": int(len(df_tr)), "n_val": int(len(df_va)),
        "n_test":  int(len(df_te)), "n_features": int(n_features),
    }

    # ── Baseline Lasso ──
    print("\n[2/4] Baseline Lasso...")
    lasso = Lasso(alpha=1e-4, max_iter=5000)
    lasso.fit(X_tr, y_tr)
    m_lasso = {
        "train": compute_all_metrics(y_tr, lasso.predict(X_tr)),
        "val":   compute_all_metrics(y_va, lasso.predict(X_va)),
        "test":  compute_all_metrics(y_te, lasso.predict(X_te)),
    }
    print(f"  TEST : RMSE={m_lasso['test']['rmse']:.5f}  R²={m_lasso['test']['r2']:.4f}")
    results = [{"model_name":"Lasso","n_params":int(n_features+1),
                "epochs_run":0,"best_epoch":0,"spread_ratio":1.0,
                "metrics":m_lasso,"history":{}}]

    if args.save:
        SAVE_DIR.mkdir(parents=True, exist_ok=True)

    # ── Modèles DL ──
    print(f"\n[3/4] Entraînement ({args.epochs} epochs max)...")
    for name in only:
        print(f"\n{'━'*80}\n  {name}\n{'━'*80}")
        try:
            model = get_tabular_dl_models(n_features, only=[name])[name]
        except Exception as e:
            print(f"  ❌ Construction : {e}"); continue

        n_params = model.count_params()
        print(f"  {n_params:,} params | ratio 1:{len(X_tr)/n_params:.0f}\n")

        history = fit_tabular_dl(model, name, X_tr, y_tr, X_va, y_va,
                                 epochs=args.epochs, batch_size=args.batch,
                                 patience=args.patience, verbose=1)
        h = history.history
        best_ep = int(np.argmin(h["val_loss"]))

        p_tr  = model.predict(X_tr,  verbose=0).flatten()
        p_va  = model.predict(X_va,  verbose=0).flatten()
        p_te  = model.predict(X_te,  verbose=0).flatten()
        m_tr  = compute_all_metrics(y_tr, p_tr)
        m_va  = compute_all_metrics(y_va, p_va)
        m_te  = compute_all_metrics(y_te, p_te)

        spread = float((p_te.max()-p_te.min()) / (y_te.max()-y_te.min()))

        print(f"\n  Epochs:{len(h['loss'])} | Best:{best_ep+1}")
        print(f"  y_pred:[{p_te.min():.4f},{p_te.max():.4f}] y_test:[{y_te.min():.4f},{y_te.max():.4f}]")
        print(f"  Spread:{spread:.1%} {'⚠️ constante' if spread<0.3 else '✅'}")
        print(f"\n  {'Split':<12}{'RMSE':>10}{'MAE':>10}{'R²':>10}{'MAPE':>9}{'QLIKE':>9}{'Dir.Acc':>9}")
        print(f"  {'─'*12}{'─'*10}{'─'*10}{'─'*10}{'─'*9}{'─'*9}{'─'*9}")
        for lbl, m in [('Train',m_tr),('Validation',m_va),('Test',m_te)]:
            print(f"  {lbl:<12}{m['rmse']:>10.6f}{m['mae']:>10.6f}{m['r2']:>10.4f}"
                  f"{m['mape']:>8.2f}%{m['qlike']:>9.3f}{m['dir_acc']:>8.1f}%")

        # Historique — conversion en float natifs
        hist_clean = {k: [float(v) for v in vals] for k,vals in h.items()
                      if k in ('loss','val_loss','mae','val_mae')}

        results.append({
            "model_name":   name,
            "n_params":     int(n_params),
            "epochs_run":   int(len(h['loss'])),
            "best_epoch":   int(best_ep+1),
            "spread_ratio": round(spread, 4),
            "metrics":      {"train":m_tr,"val":m_va,"test":m_te},
            "history":      hist_clean,
        })

        # ── Sauvegarder le modèle ──
        if args.save:
            save_path = SAVE_DIR / f"{name}.keras"
            model.save(str(save_path))
            print(f"\n  💾 Modèle sauvegardé → {save_path}")

    # ── Synthèse ──
    print(f"\n\n{'═'*80}\n  SYNTHÈSE — Métriques TEST\n{'═'*80}\n")
    print(f"  {'Modèle':<16}{'RMSE':>10}{'R²':>10}{'MAPE':>10}{'QLIKE':>10}{'Dir.Acc':>10}")
    print(f"  {'─'*16}{'─'*10}{'─'*10}{'─'*10}{'─'*10}{'─'*10}")
    best = min(results, key=lambda r: r['metrics']['test']['rmse'])['model_name']
    for r in sorted(results, key=lambda r: r['metrics']['test']['rmse']):
        m = r['metrics']['test']
        tag = " 🏆" if r['model_name']==best else ""
        print(f"  {r['model_name']:<16}{m['rmse']:>10.6f}{m['r2']:>10.4f}"
              f"{m['mape']:>9.2f}%{m['qlike']:>10.3f}{m['dir_acc']:>9.1f}%{tag}")

    # ── Sauvegarder le JSON d'évaluation ──
    if args.save:
        eval_path = SAVE_DIR / "evaluation_global.json"
        with open(eval_path, "w") as f:
            json.dump({"meta": meta, "models": results}, f, indent=2)
        print(f"\n  💾 evaluation_global.json → {eval_path}")
    print()


if __name__ == "__main__":
    main()
"""
train_surface.py
================
Entraînement des modèles spécifiquement pour la prédiction de nappe de volatilité.
Données : vol_surface_spx_clean.csv (1996-2008)
Features : moneyness, tenor, log_tenor, sqrt_tenor, moneyness_norm, moneyness_sq,
           mny_x_logt + features marché du jour (VIX, rate, forward, hvol, spx_ret)
Target   : iv

Les modèles sont sauvegardés dans saved_models/surface/
"""
from __future__ import annotations

import json
import time
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List
warnings.filterwarnings("ignore")

from app.ml.ml_models import get_ml_regressors, HYPERPARAMS
from app.ml.dl_models import get_dl_models, fit_dl, reshape_seq, DL_HYPERPARAMS
from app.ml.metrics import all_metrics

# ============================================================
# Features pour la nappe
# ============================================================
SURFACE_FEATURES = [
    "moneyness_norm",   # moneyness / 90
    "moneyness_sq",     # (moneyness/90)^2
    "log_tenor",        # log(tenor)
    "sqrt_tenor",       # sqrt(tenor)
    "mny_x_logt",       # moneyness_norm * log_tenor
    "vix",              # VIX du jour
    "rate",             # taux sans risque
    "hvol_30",          # volatilité historique 30j
    "spx_ret",          # rendement SPX
    "is_crisis",        # régime de crise
]

SURFACE_TARGET = "iv"

CRISIS_DATES = [
    ("2000-03-01", "2002-10-31"),  # Dot-com
    ("2007-07-01", "2009-06-30"),  # Subprimes
]

def load_surface_data(surface_file: str, market_file: str = None) -> pd.DataFrame:
    """Charge et prépare les données pour l'entraînement nappe."""
    # Données nappe
    df = pd.read_csv(surface_file, sep=";")
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df = df[df["moneyness"] > 0].copy()
    df = df.dropna(subset=["date", "iv", "moneyness", "tenor_d"])

    # Features géométriques
    df["moneyness_norm"] = df["moneyness"] / 90.0
    df["moneyness_sq"]   = (df["moneyness"] / 90.0) ** 2
    df["log_tenor"]      = np.log(df["tenor_d"])
    df["sqrt_tenor"]     = np.sqrt(df["tenor_d"])
    df["mny_x_logt"]     = df["moneyness_norm"] * df["log_tenor"]

    # Régime de crise
    df["is_crisis"] = 0
    for start, end in CRISIS_DATES:
        mask = (df["date"] >= start) & (df["date"] <= end)
        df.loc[mask, "is_crisis"] = 1

    # Joindre les données de marché si disponibles
    if market_file and Path(market_file).exists():
        mkt = pd.read_csv(market_file, sep=";")
        mkt["date"] = pd.to_datetime(mkt["date"], format="%d/%m/%Y", errors="coerce")
        mkt_daily = mkt.groupby("date").agg({
            "vix":     "mean",
            "rate_10y":    "mean",
            "fwd_front": "mean",
        }).reset_index()
        # HVol approximée
        if "iv" in mkt.columns:
            hvol = mkt.groupby("date")["iv"].std().reset_index()
            hvol.columns = ["date", "hvol_30"]
            mkt_daily = mkt_daily.rename(columns={"rate_10y":"rate","fwd_front":"forward"})
        mkt_daily = mkt_daily.merge(hvol, on="date", how="left")
        df = df.merge(mkt_daily, on="date", how="left")

    # Valeurs par défaut si marché non disponible
    for col in ["vix", "rate", "forward", "hvol_30", "spx_ret"]:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0.0)

    return df.sort_values("date").reset_index(drop=True)


def get_surface_xy(df: pd.DataFrame):
    """Extrait X et y pour l'entraînement."""
    available = [f for f in SURFACE_FEATURES if f in df.columns]
    X = df[available].values.astype(float)
    y = df[SURFACE_TARGET].values.astype(float)
    return X, y, available


def _safe_metrics(y_true, y_pred):
    if len(y_true) == 0:
        return {"rmse": 0, "mae": 0, "mse": 0, "r2": 0,
                "mape": 0, "qlike": 0, "directional_accuracy": 0}
    return all_metrics(y_true, y_pred)


# ============================================================
# Entraînement principal
# ============================================================
def train_surface_models(
    surface_file: str = "/app/data/vol_surface_spx_clean.csv",
    market_file:  str = "/app/data/options_merged_spx.csv",
    models_dir:   str = "/app/saved_models/surface",
    run_dl:       bool = True,
):
    print("=" * 60)
    print("ENTRAÎNEMENT MODÈLES NAPPE DE VOLATILITÉ")
    print("=" * 60)

    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    # Chargement données
    print(f"\n[data] Chargement {surface_file}")
    df = load_surface_data(surface_file, market_file)
    print(f"[data] {len(df):,} points · {df['date'].min().date()} → {df['date'].max().date()}")

    X, y, feat_cols = get_surface_xy(df)
    print(f"[data] Features : {feat_cols}")
    print(f"[data] IV : min={y.min():.4f} max={y.max():.4f} mean={y.mean():.4f}")

    # Split chronologique 70/15/15
    n = len(X)
    n_train = int(n * 0.70)
    n_val   = int(n * 0.15)
    X_train, y_train = X[:n_train],          y[:n_train]
    X_val,   y_val   = X[n_train:n_train+n_val], y[n_train:n_train+n_val]
    X_test,  y_test  = X[n_train+n_val:],    y[n_train+n_val:]

    print(f"\n[split] Train={len(X_train):,} | Val={len(X_val):,} | Test={len(X_test):,}")
    print(f"\n{'Modèle':<15} {'Train RMSE':>10} {'Val RMSE':>10} {'Test RMSE':>10} {'R²':>8} {'Temps':>8}")
    print("-" * 65)

    results = {}

    # ML models
    for name, mdl in get_ml_regressors().items():
        t0 = time.perf_counter()
        try:
            if name == "SVR" and len(X_train) > 30_000:
                idx = np.random.default_rng(42).choice(len(X_train), 30_000, replace=False)
                mdl.fit(X_train[idx], y_train[idx])
            elif name == "XGBoost":
                mdl.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
            else:
                mdl.fit(X_train, y_train)

            p_train = mdl.predict(X_train)
            p_val   = mdl.predict(X_val)
            p_test  = mdl.predict(X_test)

            m_train = _safe_metrics(y_train, p_train)
            m_val   = _safe_metrics(y_val,   p_val)
            m_test  = _safe_metrics(y_test,  p_test)
            elapsed = round(time.perf_counter() - t0, 1)

            print(f"  {name:<13} {m_train['rmse']:>10.4f} {m_val['rmse']:>10.4f} {m_test['rmse']:>10.4f} {m_test['r2']:>8.4f} {elapsed:>6.1f}s")

            joblib.dump(mdl, models_dir / f"{name}.pkl")
            results[name] = {"train": m_train, "val": m_val, "test": m_test}
        except Exception as e:
            print(f"  {name:<13} ERREUR : {e}")

    # DL models
    if run_dl:
        print()
        for name, mdl in get_dl_models(X_train.shape[1]).items():
            t0 = time.perf_counter()
            try:
                is_seq = (name != "MLP")
                fit_dl(mdl, X_train, y_train, X_val, y_val,
                       epochs=20, batch_size=512, patience=5,
                       is_sequential=is_seq, verbose=0)

                X_tr_s = reshape_seq(X_train) if is_seq else X_train
                X_va_s = reshape_seq(X_val)   if is_seq else X_val
                X_te_s = reshape_seq(X_test)  if is_seq else X_test

                p_train = mdl.predict(X_tr_s, verbose=0).flatten()
                p_val   = mdl.predict(X_va_s, verbose=0).flatten()
                p_test  = mdl.predict(X_te_s, verbose=0).flatten()

                m_train = _safe_metrics(y_train, p_train)
                m_val   = _safe_metrics(y_val,   p_val)
                m_test  = _safe_metrics(y_test,  p_test)
                elapsed = round(time.perf_counter() - t0, 1)

                print(f"  {name:<13} {m_train['rmse']:>10.4f} {m_val['rmse']:>10.4f} {m_test['rmse']:>10.4f} {m_test['r2']:>8.4f} {elapsed:>6.1f}s")

                mdl.save(models_dir / f"{name}.keras")
                results[name] = {"train": m_train, "val": m_val, "test": m_test}
            except Exception as e:
                import traceback
                print(f"  {name:<13} ERREUR : {e}")
                traceback.print_exc()

    # Sauvegarde résultats
    eval_data = {
        "feature_cols": feat_cols,
        "n_train": int(len(X_train)),
        "n_val":   int(len(X_val)),
        "n_test":  int(len(X_test)),
        "models":  {name: {
            "train_rmse": r["train"]["rmse"],
            "val_rmse":   r["val"]["rmse"],
            "test_rmse":  r["test"]["rmse"],
            "test_r2":    r["test"]["r2"],
            "test_mae":   r["test"]["mae"],
        } for name, r in results.items()},
        "hyperparameters": {**HYPERPARAMS, **DL_HYPERPARAMS},
    }
    with open(models_dir / "evaluation_surface.json", "w") as f:
        json.dump(eval_data, f, indent=2, default=str)

    print("\n" + "=" * 60)
    print(f"Modeles sauvegardes : {models_dir}")
    print(f"Evaluation          : {models_dir}/evaluation_surface.json")
    print("=" * 60)

    # Afficher le meilleur modèle
    best = min(results.items(), key=lambda x: x[1]["test"]["rmse"])
    print(f"\nMeilleur modele (Test RMSE) : {best[0]} — RMSE={best[1]['test']['rmse']:.4f} R²={best[1]['test']['r2']:.4f}")


if __name__ == "__main__":
    import sys
    run_dl = "--no-dl" not in sys.argv
    train_surface_models(run_dl=run_dl)

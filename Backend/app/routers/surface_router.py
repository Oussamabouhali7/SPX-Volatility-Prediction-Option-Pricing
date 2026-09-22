"""Endpoints nappe de volatilite : observee (vol_surface_spx_clean.csv) + predite par ML/DL."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.auth.security import get_current_user
from app.models_dir.user import User
from app.services.registry import registry
import pandas as pd
import numpy as np
from pathlib import Path

router = APIRouter(prefix="/surface", tags=["surface"])

_SURFACE_FILE   = "/app/data/vol_surface_spx_clean.csv"
_OPTIONS_FILE   = "/app/data/options_merged_spx.csv"

TENORS      = [30, 60, 91, 122, 152, 182, 273, 365, 547, 730]
# Moneyness en convention K/S-1 (meme convention que features.py)
MONEYNESS   = [-0.30, -0.25, -0.20, -0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]

CRISIS_PERIODS = {
    "Crise Subprimes":   ("2007-07-01", "2009-06-30"),
    "Crise COVID-19":    ("2020-02-15", "2020-12-31"),
    "Attentats 11 Sept": ("2001-09-01", "2001-10-31"),
    "Guerre Ukraine":    ("2022-02-24", "2022-12-31"),
    "Crise Dot-com":     ("2000-03-01", "2002-10-31"),
}

def _get_crisis_label(date_str):
    for label, (start, end) in CRISIS_PERIODS.items():
        if start <= date_str <= end:
            return f"[{label}] {date_str}"
    return date_str

def _load_surface():
    df = pd.read_csv(_SURFACE_FILE, sep=";")
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df = df[df["moneyness"] > 0].copy()
    return df.dropna(subset=["date", "iv"])

def _load_options():
    df = pd.read_csv(_OPTIONS_FILE, sep=";")
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    return df.dropna(subset=["date"])

def _build_features_for_point(row_market, tenor, moneyness, feature_cols):
    """Construit un vecteur de features pour un point (tenor, moneyness) donné."""
    feat = {}
    for col in feature_cols:
        if col in row_market:
            feat[col] = float(row_market[col]) if pd.notna(row_market[col]) else 0.0
        else:
            feat[col] = 0.0
    # Override avec les valeurs exactes du point de la nappe
    mny = float(moneyness)
    t   = max(float(tenor), 1.0)
    feat["moneyness"]     = mny
    feat["log_moneyness"] = float(np.log(1.0 + mny)) if mny > -1.0 else 0.0
    feat["moneyness_abs"] = abs(mny)
    feat["moneyness_sq"]  = mny ** 2
    feat["tenor_d"]       = t
    feat["log_tenor"]     = float(np.log(t))
    feat["sqrt_tenor"]    = float(np.sqrt(t))
    feat["tenor_years"]   = t / 365.0
    feat["mny_x_logt"]    = mny * float(np.log(t))
    feat["is_call"] = 1.0 if mny >= 0.0 else 0.0
    from app.ml.black_scholes import bs_greeks
    S = float(row_market.get("close_gspc", 4500))
    greeks = bs_greeks(
        S           = S,
        K           = S * (1.0 + mny),
        T           = max(t / 365.0, 1e-6),
        r           = float(row_market.get("rate_10y", 0.05)),
        sigma       = float(row_market.get("hvol_30d", 0.20)),
        option_type = "call" if mny >= 0.0 else "put"
    )
    feat["delta"] = greeks["delta"]
    feat["gamma"] = greeks["gamma"]
    feat["vega"]  = greeks["vega"]
    feat["theta"] = greeks["theta"]
    return feat

def _predict_surface(model_name, market_row, feature_cols):
    """Prédit la nappe complète pour une ligne de marché donnée."""
    z = []
    for t in TENORS:
        row_z = []
        for m in MONEYNESS:
            feat = _build_features_for_point(market_row, t, m, feature_cols)
            try:
                iv = registry.predict_iv_single(model_name, feat)
                row_z.append(round(max(0.0, float(iv)), 4))
            except Exception:
                row_z.append(None)
        z.append(row_z)
    return z

# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("/dates")
def list_dates(_: User = Depends(get_current_user)):
    """Dates disponibles dans vol_surface_spx_clean.csv (nappe observée)."""
    df = _load_surface()
    dates = sorted(df["date"].dt.strftime("%Y-%m-%d").unique().tolist())
    labeled = [_get_crisis_label(d) for d in dates]
    return {"dates": labeled, "count": len(labeled)}

@router.get("/future-dates")
def list_future_dates(_: User = Depends(get_current_user)):
    """Dates disponibles dans options_merged_spx.csv pour la prédiction future."""
    df = _load_options()
    dates = sorted(df["date"].dt.strftime("%Y-%m-%d").unique().tolist())
    labeled = [_get_crisis_label(d) for d in dates]
    return {"dates": labeled, "count": len(labeled)}

@router.get("")
def get_surface(date_obs: str = Query(...), model_name: str = Query(None),
                _: User = Depends(get_current_user)):
    """Nappe observée pour une date historique (vol_surface_spx_clean.csv)."""
    df = _load_surface()
    target_date = pd.to_datetime(date_obs)
    sub = df[df["date"] == target_date]
    if len(sub) == 0:
        raise HTTPException(404, f"Aucune donnée observée pour {date_obs}")

    tenors_obs   = sorted(sub["tenor_d"].unique().tolist())
    moneyness_obs = sorted(sub["moneyness"].unique().tolist())

    z_observed = []
    for t in tenors_obs:
        row = []
        for m in moneyness_obs:
            val = sub[(sub["tenor_d"] == t) & (sub["moneyness"] == m)]["iv"]
            row.append(float(val.iloc[0]) if len(val) > 0 else None)
        z_observed.append(row)

    return {
        "date_obs":    date_obs,
        "tenors":      [int(t) for t in tenors_obs],
        "moneyness":   [float(m) for m in moneyness_obs],
        "z_observed":  z_observed,
        "z_predicted": z_observed,
        "model_name":  model_name or "observed",
        "mode":        "historical",
    }

@router.get("/predict-future")
def predict_future_surface(
    date_obs: str = Query(...),
    model_name: str = Query("XGBoost"),
    _: User = Depends(get_current_user)
):
    """Prédit la nappe complète pour une date future à partir de options_merged_spx.csv."""
    registry.load()
    if not registry.ml_models and not registry.dl_models:
        raise HTTPException(503, "Aucun modèle entraîné. Lancez train_all.py d'abord.")

    df = _load_options()
    target_date = pd.to_datetime(date_obs)
    day_data = df[df["date"] == target_date]
    if len(day_data) == 0:
        raise HTTPException(404, f"Aucune donnée de marché pour {date_obs}")

    market_row = day_data.iloc[0]
    feature_cols = registry.eval_results.get("feature_cols", []) if registry.eval_results else []

    z_predicted = _predict_surface(model_name, market_row, feature_cols)

    # Stats marché du jour
    vix   = float(market_row.get("vix",     0)) if "vix"     in market_row else None
    rate  = float(market_row.get("rate_10y",0)) if "rate_10y" in market_row else None
    fwd   = float(market_row.get("close_gspc", 0)) if "close_gspc" in market_row else None

    return {
        "date_obs":    date_obs,
        "tenors":      TENORS,
        "moneyness":   MONEYNESS,
        "z_observed":  None,
        "z_predicted": z_predicted,
        "model_name":  model_name,
        "mode":        "future",
        "market_info": {"vix": vix, "rate": rate, "forward": fwd},
    }


class ManualSurfaceRequest(BaseModel):
    vix:        float = 20.0
    rate:       float = 0.05
    forward:    float = 4500.0
    hvol_30:    float = 0.18
    hvol_60:    float = 0.17
    spx_ret:    float = 0.0
    model_name: str   = "XGBoost"

@router.post("/predict-manual")
def predict_manual_surface(
    payload: ManualSurfaceRequest,
    _: User = Depends(get_current_user)
):
    """Prédit la nappe complète à partir de paramètres saisis manuellement."""
    registry.load()
    if not registry.ml_models and not registry.dl_models:
        raise HTTPException(503, "Aucun modèle entraîné.")

    market_row = {
        "vix":     payload.vix,
        "rate":    payload.rate,
        "forward": payload.forward,
        "hvol_30": payload.hvol_30,
        "hvol_60": payload.hvol_60,
        "spx_ret": payload.spx_ret,
    }
    feature_cols = registry.eval_results.get("feature_cols", []) if registry.eval_results else []
    z_predicted  = _predict_surface(payload.model_name, market_row, feature_cols)

    return {
        "date_obs":    "Manuel",
        "tenors":      TENORS,
        "moneyness":   MONEYNESS,
        "z_observed":  None,
        "z_predicted": z_predicted,
        "model_name":  payload.model_name,
        "mode":        "manual",
        "market_info": market_row,
    }

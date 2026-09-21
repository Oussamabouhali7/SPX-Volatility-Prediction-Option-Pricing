"""
Préparation des features à partir de options_merged_spx.csv.

Cible : iv (volatilité implicite observée)
Features :
- Géométrie : moneyness (K/S - 1), log_moneyness, tenor_d, log_tenor, sqrt_tenor, mny*log_tenor
- Greeks : delta, gamma, vega, theta
- Marché : vix, rate_10y, close_gspc, fwd_front
- HVol multi-tenor : hvol_10d à hvol_730d
- Liquidité : open_interest, volume
- Type d'option : is_call
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Tuple


FEATURE_COLS: List[str] = [
    # Géométrie
    "moneyness", "log_moneyness", "moneyness_abs", "moneyness_sq",
    "tenor_d", "log_tenor", "sqrt_tenor", "tenor_years",
    "mny_x_logt",
    # Type
    "is_call",
    # Greeks
    "delta", "gamma", "vega", "theta",
    # Marché
    "vix", "rate_10y", "close_gspc", "fwd_front",
    # HVol multi-tenor
    "hvol_10d", "hvol_30d", "hvol_60d", "hvol_91d",
    "hvol_182d", "hvol_365d", "hvol_730d",
    # Liquidité
    "open_interest", "volume",
]
TARGET_COL = "iv"


def load_options(path: str | Path) -> pd.DataFrame:
    """Charge le CSV options_merged_spx.csv."""
    df = pd.read_csv(path, sep=";")
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df["expiry"] = pd.to_datetime(df["expiry"], format="%d/%m/%Y", errors="coerce")
    df = df.dropna(subset=["date", "expiry"]).copy()
    df["tenor_d"] = (df["expiry"] - df["date"]).dt.days
    df = df[df["tenor_d"] > 0].copy()
    return df.sort_values(["date", "expiry", "strike"]).reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Ajoute toutes les features dérivées."""
    df = df.copy()
    df["is_call"] = (df["put_call"] == "C").astype(int)
    df["moneyness"] = df["strike"] / df["close_gspc"] - 1.0       # ratio
    df["log_moneyness"] = np.log(df["strike"] / df["close_gspc"])
    df["moneyness_abs"] = df["moneyness"].abs()
    df["moneyness_sq"] = df["moneyness"] ** 2
    df["log_tenor"] = np.log(df["tenor_d"].clip(lower=1))
    df["sqrt_tenor"] = np.sqrt(df["tenor_d"])
    df["tenor_years"] = df["tenor_d"] / 365.0
    df["mny_x_logt"] = df["moneyness"] * df["log_tenor"]
    # Garde-fous
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = np.nan
    df = df.dropna(subset=[TARGET_COL]).reset_index(drop=True)
    return df


def get_xy(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    """Renvoie (X, y) en numpy."""
    cols = [c for c in FEATURE_COLS if c in df.columns]
    X = df[cols].fillna(0.0).astype(float).values
    y = df[TARGET_COL].astype(float).values
    return X, y


# ============================================================
# Définition des régimes de crise
# ============================================================
SUBPRIME_PERIOD = ("2007-07-01", "2009-06-30")
COVID_PERIOD = ("2020-02-15", "2020-12-31")


def filter_period(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    """Retourne les lignes dans [start, end] inclus."""
    m = (df["date"] >= pd.Timestamp(start)) & (df["date"] <= pd.Timestamp(end))
    return df.loc[m].reset_index(drop=True)


def get_subprime_data(df: pd.DataFrame) -> pd.DataFrame:
    return filter_period(df, *SUBPRIME_PERIOD)


def get_covid_data(df: pd.DataFrame) -> pd.DataFrame:
    return filter_period(df, *COVID_PERIOD)

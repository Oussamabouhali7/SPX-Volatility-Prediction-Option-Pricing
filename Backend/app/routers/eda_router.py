"""Endpoint EDA : calcule et retourne les données pour les visualisations exploratoires."""
from fastapi import APIRouter, Depends
from app.auth.security import get_current_user
from app.models_dir.user import User
from app.services.registry import registry
from app.ml.features import FEATURE_COLS
import numpy as np
import pandas as pd

router = APIRouter(prefix="/eda", tags=["eda"])

def _regime(vix):
    if vix < 20:   return "normal"
    elif vix < 35: return "stress"
    else:          return "crisis"

@router.get("/summary")
def eda_summary(_: User = Depends(get_current_user)):
    registry.load()
    registry.ensure_data()
    df = registry.features.copy()

    # Colonnes numériques utiles
    num_cols = [c for c in ["iv","vix","rate","forward","moneyness","log_tenor",
                             "delta","gamma","vega","theta","hvol_30","hvol_60",
                             "iv_atm","skew_25d","ts_slope","spx_ret","daily_range"]
                if c in df.columns]

    df_num = df[num_cols].dropna()

    # Régimes
    df_num = df_num.copy()
    df_num["regime"] = df_num["vix"].apply(_regime)

    # 1. Matrice de corrélation
    corr = df_num[num_cols].corr().round(3)
    corr_data = {"columns": list(corr.columns), "values": corr.values.tolist()}

    # 2. Histogrammes (échantillon 20k)
    sample = df_num.sample(min(20000, len(df_num)), random_state=42)
    histograms = {}
    for c in num_cols:
        vals = sample[c].dropna().tolist()
        histograms[c] = {
            "values": vals,
            "stats": {
                "mean":   round(float(sample[c].mean()), 6),
                "std":    round(float(sample[c].std()),  6),
                "min":    round(float(sample[c].min()),  6),
                "max":    round(float(sample[c].max()),  6),
                "median": round(float(sample[c].median()),6),
                "nulls":  int(df[c].isna().sum()) if c in df.columns else 0,
            }
        }

    # 3. Boxplots par régime
    bp_vars = [c for c in ["iv","vix","delta","gamma","vega","hvol_30"] if c in df_num.columns]
    boxplots = []
    for c in bp_vars:
        entry = {"variable": c}
        for regime in ["normal","stress","crisis"]:
            entry[regime] = df_num[df_num["regime"]==regime][c].dropna().sample(
                min(2000, len(df_num[df_num["regime"]==regime])), random_state=42
            ).tolist()
        boxplots.append(entry)

    # 4. Séries temporelles (moyennes journalières)
    df["date"] = pd.to_datetime(df["date"])
    ts_vars = [c for c in ["iv","vix","rate","hvol_30","spx_ret"] if c in df.columns]
    timeseries = {}
    ymin_iv = float(df["iv"].min()) if "iv" in df.columns else 0
    ymax_iv = float(df["iv"].max()) if "iv" in df.columns else 1
    crisis_zones = [
        {"start":"2000-03-01","end":"2002-10-31","label":"Dot-com","ymin":ymin_iv,"ymax":ymax_iv},
        {"start":"2007-07-01","end":"2009-06-30","label":"Subprimes","ymin":ymin_iv,"ymax":ymax_iv},
        {"start":"2020-02-15","end":"2020-12-31","label":"COVID","ymin":ymin_iv,"ymax":ymax_iv},
    ]
    for c in ts_vars:
        daily = df.groupby("date")[c].mean().reset_index()
        timeseries[c] = {
            "dates":  daily["date"].dt.strftime("%Y-%m-%d").tolist(),
            "values": daily[c].round(6).tolist(),
            "crisis_zones": crisis_zones,
        }

    # 5. Surface IV
    iv_surface = {}
    if "iv" in df.columns and "log_tenor" in df.columns:
        tenor_col = "tenor" if "tenor" in df.columns else "log_tenor"
        tenors = sorted(df[tenor_col].dropna().unique().tolist())[:15]
        iv_surface["tenors"] = [round(t, 1) for t in tenors]
        iv_surface["median_by_tenor"] = [
            round(float(df[df[tenor_col]==t]["iv"].median()), 4) for t in tenors
        ]
        if "moneyness" in df.columns:
            mny = sorted(df["moneyness"].dropna().unique().tolist())
            iv_surface["moneyness"] = [round(m, 3) for m in mny[:30]]
            iv_surface["median_by_moneyness"] = [
                round(float(df[df["moneyness"]==m]["iv"].median()), 4)
                for m in mny[:30]
            ]
            # Heatmap
            heatmap = []
            for t in tenors:
                row = []
                for m in mny[:30]:
                    val = df[(df[tenor_col]==t)&(df["moneyness"]==m)]["iv"].median()
                    row.append(round(float(val), 4) if not pd.isna(val) else None)
                heatmap.append(row)
            iv_surface["heatmap_z"] = heatmap
        else:
            iv_surface["moneyness"] = []
            iv_surface["median_by_moneyness"] = []
            iv_surface["heatmap_z"] = []
    else:
        iv_surface = {"tenors":[],"median_by_tenor":[],"moneyness":[],"median_by_moneyness":[],"heatmap_z":[]}

    # 6. Scatter plots (paires les plus utiles)
    scatter = {}
    pairs = [("iv","vix"),("iv","delta"),("iv","hvol_30"),("vix","spx_ret"),("iv","rate"),("delta","gamma")]
    for x, y in pairs:
        if x not in df_num.columns or y not in df_num.columns:
            continue
        key = f"{x}_{y}"
        scatter[key] = {}
        s = df_num.sample(min(5000, len(df_num)), random_state=42)
        for regime in ["normal","stress","crisis"]:
            sub = s[s["regime"]==regime]
            scatter[key][regime] = {"x": sub[x].tolist(), "y": sub[y].tolist()}

    # 7. Statistiques descriptives par variable (27 features + cible iv)
    stat_cols = [c for c in FEATURE_COLS + ["iv"] if c in df.columns]
    var_stats = []
    for c in stat_cols:
        s = df[c].dropna()
        if len(s) == 0:
            continue
        var_stats.append({
            "variable": c,
            "count":  int(s.count()),
            "nulls":  int(df[c].isna().sum()),
            "mean":   round(float(s.mean()),            6),
            "std":    round(float(s.std()),             6),
            "min":    round(float(s.min()),             6),
            "q25":    round(float(s.quantile(0.25)),    6),
            "median": round(float(s.median()),          6),
            "q75":    round(float(s.quantile(0.75)),    6),
            "max":    round(float(s.max()),             6),
            "skew":   round(float(s.skew()),            4),
        })

    return {
        "n_rows":   int(len(df)),
        "n_cols":   len(num_cols),
        "columns":  num_cols,
        "corr_matrix": corr_data,
        "histograms":  histograms,
        "boxplots":    boxplots,
        "timeseries":  timeseries,
        "iv_surface":  iv_surface,
        "scatter":     scatter,
        "var_stats": var_stats,
    }

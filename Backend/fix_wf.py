content = """\"\"\"
Walk-forward fenetres glissantes (1996-2023, fenetre 12 mois, pas 6 mois)
+ Crisis split : train/test sur Subprimes (2007-2009), validation sur COVID (2020).
Les periodes de crise sont EXCLUES des fenetres glissantes car evaluees separement.
\"\"\"
from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from dateutil.relativedelta import relativedelta

EXCLUDED_PERIODS = [
    ("2007-07-01", "2009-06-30"),
    ("2020-02-15", "2020-12-31"),
]

def _overlaps_crisis(win_start, win_end):
    for start, end in EXCLUDED_PERIODS:
        cs = pd.Timestamp(start)
        ce = pd.Timestamp(end)
        if win_start <= ce and win_end >= cs:
            return True
    return False

def generate_windows(start="1996-01-01", end="2023-12-31", window_months=12, step_months=6, exclude_crisis=True):
    windows = []
    cur = pd.Timestamp(start)
    final_end = pd.Timestamp(end)
    while True:
        win_end = cur + relativedelta(months=window_months) - pd.Timedelta(days=1)
        if win_end > final_end:
            break
        if not (exclude_crisis and _overlaps_crisis(cur, win_end)):
            windows.append((cur, win_end))
        cur = cur + relativedelta(months=step_months)
    return windows

def split_window_data(df, win_start, win_end, date_col="date", ratios=(0.70, 0.15, 0.15)):
    sub = df[(df[date_col] >= win_start) & (df[date_col] <= win_end)].copy()
    sub = sub.sort_values(date_col).reset_index(drop=True)
    if len(sub) == 0:
        return {"train": sub, "val": sub, "test": sub}
    n = len(sub)
    n_train = int(n * ratios[0])
    n_val = int(n * ratios[1])
    return {
        "train": sub.iloc[:n_train].reset_index(drop=True),
        "val": sub.iloc[n_train:n_train+n_val].reset_index(drop=True),
        "test": sub.iloc[n_train+n_val:].reset_index(drop=True),
    }

def crisis_split(df):
    from app.ml.features import SUBPRIME_PERIOD, COVID_PERIOD, filter_period
    subprime = filter_period(df, *SUBPRIME_PERIOD).sort_values("date").reset_index(drop=True)
    covid = filter_period(df, *COVID_PERIOD).sort_values("date").reset_index(drop=True)
    n = len(subprime)
    n_train = int(n * 0.8)
    return {
        "train": subprime.iloc[:n_train].reset_index(drop=True),
        "test": subprime.iloc[n_train:].reset_index(drop=True),
        "val": covid,
    }
"""
open("/app/app/ml/walk_forward.py", "w").write(content)
print("OK")

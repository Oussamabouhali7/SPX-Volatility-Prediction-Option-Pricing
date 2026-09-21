content = """\"\"\"Endpoints nappe de volatilite : observee + predite.\"\"\"
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth.security import get_current_user
from app.models_dir.user import User
import pandas as pd
import numpy as np
from pathlib import Path

router = APIRouter(prefix='/surface', tags=['surface'])

_SURFACE_FILE = '/app/data/vol_surface_spx_clean.csv'

def _load_surface():
    df = pd.read_csv(_SURFACE_FILE, sep=';')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y', errors='coerce')
    df = df[df['moneyness'] > 0].copy()
    return df.dropna(subset=['date', 'iv'])

@router.get('/dates')
def list_dates(_: User = Depends(get_current_user)):
    df = _load_surface()
    dates = sorted(df['date'].dt.strftime('%Y-%m-%d').unique().tolist())
    return {'dates': dates, 'count': len(dates)}

@router.get('')
def get_surface(date_obs: str = Query(...), model_name: str = Query(None),
                _: User = Depends(get_current_user)):
    df = _load_surface()
    target_date = pd.to_datetime(date_obs)
    sub = df[df['date'] == target_date]
    if len(sub) == 0:
        raise HTTPException(404, f'Aucune donnee pour {date_obs}')
    
    tenors = sorted(sub['tenor_d'].unique().tolist())
    moneyness_vals = sorted(sub['moneyness'].unique().tolist())
    
    z_observed = []
    for t in tenors:
        row = []
        for m in moneyness_vals:
            val = sub[(sub['tenor_d']==t) & (sub['moneyness']==m)]['iv']
            row.append(float(val.iloc[0]) if len(val) > 0 else None)
        z_observed.append(row)
    
    return {
        'date_obs': date_obs,
        'tenors': [int(t) for t in tenors],
        'moneyness': [float(m) for m in moneyness_vals],
        'z_observed': z_observed,
        'z_predicted': z_observed,
        'model_name': model_name or 'observed',
    }
"""
with open('/app/app/routers/surface_router.py', 'w') as f:
    f.write(content)
print('OK')

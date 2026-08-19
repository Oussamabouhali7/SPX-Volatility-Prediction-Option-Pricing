# Nouveau contenu iv_router.py avec support n_windows
new_content = '''"""Endpoints prediction IV."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List
import numpy as np

from app.schemas import (
    IVPredictRequest, IVPredictResponse, IVMultiModelResponse,
)
from app.services.registry import registry
from app.auth.security import get_current_user
from app.models_dir.user import User

router = APIRouter(prefix="/iv", tags=["iv-prediction"])


def _features_dict(req: IVPredictRequest) -> Dict[str, float]:
    """Construit le dict de features a partir de la requete."""
    mny = req.moneyness
    t   = max(req.tenor_d, 1)
    return {
        "moneyness":     mny,
        "log_moneyness": np.log(1.0 + mny) if mny > -1.0 else 0.0,
        "moneyness_abs": abs(mny),
        "moneyness_sq":  mny ** 2,
        "tenor_d":       t,
        "log_tenor":     np.log(t),
        "sqrt_tenor":    np.sqrt(t),
        "tenor_years":   t / 365.0,
        "mny_x_logt":    mny * np.log(t),
        "is_call":       1,
        "delta":         0.5, "gamma": 0.01, "vega": 50.0, "theta": -0.05,
        "vix":           req.vix,
        "rate_10y":      req.rate_10y,
        "close_gspc":    req.close_gspc,
        "fwd_front":     req.close_gspc * 1.005,
        "hvol_10d":      req.hvol_30d * 1.05,
        "hvol_30d":      req.hvol_30d,
        "hvol_60d":      req.hvol_30d * 0.98,
        "hvol_91d":      req.hvol_30d * 0.96,
        "hvol_182d":     req.hvol_30d * 0.94,
        "hvol_365d":     req.hvol_30d * 0.92,
        "hvol_730d":     req.hvol_30d * 0.90,
        "open_interest": 100_000,
        "volume":        1_000,
    }


def _get_best_models_for_windows(n_windows: int) -> Dict[str, float]:
    """Retourne le RMSE moyen par modele sur les n_windows premieres fenetres."""
    if not registry.eval_results:
        return {}
    windows = registry.eval_results.get("windows", [])
    if not windows:
        return {}
    # Filtrer sur les n_windows premieres fenetres
    filtered = [w for w in windows if w["window_id"] <= n_windows]
    if not filtered:
        return {}
    # Calculer RMSE moyen par modele
    from collections import defaultdict
    sums = defaultdict(list)
    for w in filtered:
        sums[w["model"]].append(w["rmse_test"])
    return {name: sum(vals)/len(vals) for name, vals in sums.items()}


@router.get("/models", response_model=List[str])
def list_models(_: User = Depends(get_current_user)):
    return registry.available_models()


@router.get("/windows-info")
def get_windows_info(_: User = Depends(get_current_user)):
    """Retourne le nombre de fenetres disponibles et les modeles."""
    registry.load()
    if not registry.eval_results:
        return {"n_windows": 0, "models": []}
    windows = registry.eval_results.get("windows", [])
    n_max = max((w["window_id"] for w in windows), default=0)
    models = list({w["model"] for w in windows})
    return {"n_windows": n_max, "models": sorted(models)}


@router.post("/predict", response_model=IVPredictResponse)
def predict_single(req: IVPredictRequest, _: User = Depends(get_current_user)):
    try:
        iv = registry.predict_iv_single(req.model_name, _features_dict(req))
    except ValueError as e:
        raise HTTPException(404, str(e))
    return IVPredictResponse(model_name=req.model_name, iv_predicted=iv)


@router.post("/predict-all", response_model=IVMultiModelResponse)
def predict_all_models(req: IVPredictRequest, _: User = Depends(get_current_user)):
    preds = registry.predict_iv_all(_features_dict(req))
    if not preds:
        raise HTTPException(503, "Aucun modele entraine disponible.")
    # Ajouter les RMSE par fenetre si n_windows specifie
    n_windows = getattr(req, "n_windows", None)
    rmse_info = _get_best_models_for_windows(n_windows) if n_windows else {}
    return IVMultiModelResponse(predictions=preds, inputs=req, rmse_by_window=rmse_info)
'''

with open('/app/app/routers/iv_router.py', 'w') as f:
    f.write(new_content)
print('iv_router.py reecrit')

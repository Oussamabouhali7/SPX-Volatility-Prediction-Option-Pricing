"""Endpoints évaluation : résultats walk-forward ET entraînement global DL."""
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from app.services.registry import registry
from app.auth.security import get_current_user
from app.models_dir.user import User

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

GLOBAL_EVAL_PATH = Path("saved_models/global/evaluation_global.json")


@router.get("")
def get_evaluation(_: User = Depends(get_current_user)):
    """Métriques walk-forward (47 fenêtres) — ML + DL production."""
    return registry.get_evaluation()


@router.get("/global")
def get_global_evaluation(_: User = Depends(get_current_user)):
    """Métriques + historique epochs des modèles DL entraînés globalement."""
    if not GLOBAL_EVAL_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="evaluation_global.json introuvable. "
                   "Lancez : python -m app.ml.dl_test_tabular"
        )
    with open(GLOBAL_EVAL_PATH) as f:
        return json.load(f)
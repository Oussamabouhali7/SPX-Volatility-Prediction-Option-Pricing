"""
Factory des modèles Machine Learning.

Modèles : Random Forest, XGBoost, Ridge, Lasso, SVR (régression)
+ SVM (classification du régime stress/normal — tâche annexe)
"""

from __future__ import annotations

import numpy as np
from typing import Dict, Any
from sklearn.linear_model import Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR, SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import xgboost as xgb


def get_ml_regressors(random_state: int = 42) -> Dict[str, Any]:
    """Renvoie tous les modèles ML pour la régression d'IV avec une forte régularisation

    pour éviter le surapprentissage (overfitting) et stabiliser le R² hors-échantillon.
    """
    return {
        "Lasso": Lasso(alpha=1e-3, max_iter=10_000, random_state=random_state),
        
        "Ridge": Ridge(alpha=10.0, random_state=random_state),
        
        "RandomForest": RandomForestRegressor(
            n_estimators=150, 
            max_depth=6,             # Limité de 18 à 6 pour empêcher d'apprendre le bruit par cœur
            min_samples_leaf=15,     # Augmenté pour lisser les prédictions aux extrémités
            n_jobs=-1, 
            random_state=random_state,
        ),
        
        "XGBoost": xgb.XGBRegressor(
            n_estimators=150,        # Réduit de 400 à 150 pour stopper l'apprentissage des résidus
            max_depth=3,             # Arbres très simples (stabilité maximale face aux crises)
            learning_rate=0.03,      
            subsample=0.7,           # Introduit du bruit bénéfique (70% des lignes)
            colsample_bytree=0.7,    # Introduit du bruit bénéfique (70% des variables)
            reg_alpha=1.0,           # Régularisation L1 (Lasso-like) sur les poids
            reg_lambda=5.0,          # Régularisation L2 (Ridge-like) pour écraser les outliers
            random_state=random_state, 
            n_jobs=-1, 
            tree_method="hist",
        ),
        
        "SVR": SVR(
            kernel="rbf", 
            C=1.0,                   # Réduit de 10.0 à 1.0 pour relâcher la contrainte sur la marge
            gamma="scale", 
            epsilon=0.005
        ),
    }


def get_stress_classifier(random_state: int = 42) -> Pipeline:
    """SVM classifier pour détecter régime stress (VIX > 25)."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("model", SVC(kernel="rbf", C=1.0, gamma="scale",
                      probability=True, random_state=random_state)),
    ])


def make_stress_labels(vix: np.ndarray, threshold: float = 25.0) -> np.ndarray:
    return (np.asarray(vix) > threshold).astype(int)


# Hyperparamètres mis à jour pour reporting dans l'évaluation
HYPERPARAMS = {
    "Lasso": {"alpha": 1e-3, "max_iter": 10_000},
    "Ridge": {"alpha": 10.0},
    "RandomForest": {"n_estimators": 150, "max_depth": 6, "min_samples_leaf": 15},
    "XGBoost": {"n_estimators": 150, "max_depth": 3, "learning_rate": 0.03,
                "subsample": 0.7, "colsample_bytree": 0.7, "reg_alpha": 1.0, "reg_lambda": 5.0},
    "SVR": {"kernel": "rbf", "C": 1.0, "epsilon": 0.005, "gamma": "scale"},
    "SVM_clf": {"kernel": "rbf", "C": 1.0, "gamma": "scale"},
}


"""
Factory des modèles Machine Learning.

Modèles : Random Forest, XGBoost, Ridge, Lasso, SVR (régression)
+ SVM (classification du régime stress/normal — tâche annexe)
"""
"""
from __future__ import annotations

import numpy as np
from typing import Dict, Any
from sklearn.linear_model import Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR, SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import xgboost as xgb


def get_ml_regressors(random_state: int = 42) -> Dict[str, Any]:
    #Renvoie tous les modèles ML pour la régression d'IV.
    return {
        "Lasso": Lasso(alpha=1e-4, max_iter=10_000, random_state=random_state),
        "Ridge": Ridge(alpha=1.0, random_state=random_state),
        "RandomForest": RandomForestRegressor(
            n_estimators=200, max_depth=18, min_samples_leaf=5,
            n_jobs=-1, random_state=random_state,
        ),
        "XGBoost": xgb.XGBRegressor(
            n_estimators=400, max_depth=8, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9,
            random_state=random_state, n_jobs=-1, tree_method="hist",
        ),
        "SVR": SVR(kernel="rbf", C=10.0, gamma="scale", epsilon=0.001),
    }


def get_stress_classifier(random_state: int = 42) -> Pipeline:
    #SVM classifier pour détecter régime stress (VIX > 25).
    return Pipeline([
        ("scaler", StandardScaler()),
        ("model", SVC(kernel="rbf", C=1.0, gamma="scale",
                      probability=True, random_state=random_state)),
    ])


def make_stress_labels(vix: np.ndarray, threshold: float = 25.0) -> np.ndarray:
    return (np.asarray(vix) > threshold).astype(int)


# Hyperparamètres pour reporting dans l'évaluation
HYPERPARAMS = {
    "Lasso": {"alpha": 1e-4, "max_iter": 10_000},
    "Ridge": {"alpha": 1.0},
    "RandomForest": {"n_estimators": 200, "max_depth": 18, "min_samples_leaf": 5},
    "XGBoost": {"n_estimators": 400, "max_depth": 8, "learning_rate": 0.05,
                "subsample": 0.9, "colsample_bytree": 0.9},
    "SVR": {"kernel": "rbf", "C": 10.0, "epsilon": 0.001, "gamma": "scale"},
    "SVM_clf": {"kernel": "rbf", "C": 1.0, "gamma": "scale"},
}
"""

"""
Service de prédiction : charge un modèle entraîné et fait l'inférence.
Singleton pour éviter de recharger les modèles à chaque requête.
"""
from __future__ import annotations

import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional, List
from threading import Lock

from app.config import settings
from app.ml.features import FEATURE_COLS, TARGET_COL, load_options, build_features, get_xy
from app.ml.black_scholes import bs_price, bs_greeks, implied_vol_newton, mc_price_european
from app.ml.ml_models import HYPERPARAMS
from app.ml.dl_models import DL_HYPERPARAMS, reshape_seq
from app.ml.metrics import all_metrics


_lock = Lock()


class ModelRegistry:
    """Charge et cache tous les modèles entraînés (ML + DL)."""

    def __init__(self):
        self.ml_models: Dict[str, Any] = {}
        self.dl_models: Dict[str, Any] = {}
        self.stress_classifier: Optional[Any] = None
        self.data: Optional[pd.DataFrame] = None
        self.features: Optional[pd.DataFrame] = None
        self.eval_results: Optional[Dict[str, Any]] = None
        self._loaded = False
        self.scaler = None

    def load(self):
        """Charge tous les artéfacts disponibles depuis settings.MODELS_DIR."""
        with _lock:
            if self._loaded:
                return
            models_dir = Path(settings.MODELS_DIR)
            models_dir.mkdir(parents=True, exist_ok=True)

            # ML models
            for name in ["Lasso", "Ridge", "RandomForest", "XGBoost", "SVR"]:
                p = models_dir / f"{name}.pkl"
                if p.exists():
                    self.ml_models[name] = joblib.load(p)

            # SVM classifier
            p_svm = models_dir / "SVM_clf.pkl"
            if p_svm.exists():
                self.stress_classifier = joblib.load(p_svm)

            # Scaler
            p_scaler = models_dir / "scaler.pkl"
            if p_scaler.exists():
                self.scaler = joblib.load(p_scaler)
                print(f"[registry] Scaler charge depuis {p_scaler}")

            # DL models
            try:
                from tensorflow import keras
                for name in ["MLP", "LSTM", "GRU", "BiLSTM", "BiRNN", "CNN", "Transformer"]:
                    p = models_dir / f"{name}.keras"
                    if p.exists():
                        self.dl_models[name] = keras.models.load_model(p)
            except Exception as e:
                print(f"[warning] TF non disponible : {e}")

            # Evaluation results
            p_eval = models_dir / "evaluation.json"
            if p_eval.exists():
                with open(p_eval) as f:
                    self.eval_results = json.load(f)

            self._loaded = True

    def ensure_data(self):
        """Charge le dataset si pas déjà en mémoire."""
        with _lock:
            if self.data is None:
                if not Path(settings.DATA_FILE).exists():
                    raise FileNotFoundError(
                        f"Dataset introuvable : {settings.DATA_FILE}"
                    )
                df = load_options(settings.DATA_FILE)
                self.data = df
                self.features = build_features(df)

    def predict_iv_single(
        self, model_name: str, features: Dict[str, float]
    ) -> float:
        """Prédiction d'une seule IV à partir d'un dict de features."""
        self.load()
        x = np.array([[features.get(c, 0.0) for c in FEATURE_COLS]], dtype=float)
        if self.scaler is not None:
            x = self.scaler.transform(x)
        if model_name in self.ml_models:
            return float(self.ml_models[model_name].predict(x)[0])
        if model_name in self.dl_models:
            x_seq = reshape_seq(x)
            return float(self.dl_models[model_name].predict(x_seq, verbose=0)[0][0])
        raise ValueError(f"Modèle '{model_name}' introuvable")

    def predict_iv_all(self, features: Dict[str, float]) -> Dict[str, float]:
        """Prédiction par tous les modèles disponibles."""
        self.load()
        x = np.array([[features.get(c, 0.0) for c in FEATURE_COLS]], dtype=float)
        if self.scaler is not None:
            x = self.scaler.transform(x)
        out: Dict[str, float] = {}
        for name, m in self.ml_models.items():
            try:
                out[name] = float(m.predict(x)[0])
            except Exception:
                pass
        if self.dl_models:
            try:
                x_seq = reshape_seq(x)
                for name, m in self.dl_models.items():
                    out[name] = float(m.predict(x_seq, verbose=0)[0][0])
            except Exception:
                pass
        return out

    def available_models(self) -> List[str]:
        self.load()
        return sorted(list(self.ml_models.keys()) + list(self.dl_models.keys()))

    def get_evaluation(self) -> Dict[str, Any]:
        self.load()
        return self.eval_results or {"models": [], "windows": []}


registry = ModelRegistry()

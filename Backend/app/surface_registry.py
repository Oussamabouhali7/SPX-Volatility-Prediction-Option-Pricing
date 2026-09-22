"""
Registry spécifique pour les modèles de nappe de volatilité.
Charge les modèles depuis saved_models/surface/
"""
from __future__ import annotations

import json
import joblib
import numpy as np
from pathlib import Path
from threading import Lock
from typing import Dict, Any, Optional

_lock = Lock()

SURFACE_MODELS_DIR = Path("/app/saved_models/surface")

TENORS    = [30, 60, 91, 122, 152, 182, 273, 365, 547, 730]
MONEYNESS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]


class SurfaceRegistry:
    def __init__(self):
        self.ml_models: Dict[str, Any] = {}
        self.dl_models: Dict[str, Any] = {}
        self.feature_cols = []
        self.eval_results = {}
        self._loaded = False

    def load(self):
        with _lock:
            if self._loaded:
                return
            if not SURFACE_MODELS_DIR.exists():
                print("[surface_registry] Dossier saved_models/surface/ introuvable — entraînez d'abord train_surface.py")
                return

            # ML
            for name in ["Lasso", "Ridge", "RandomForest", "XGBoost", "SVR"]:
                p = SURFACE_MODELS_DIR / f"{name}.pkl"
                if p.exists():
                    self.ml_models[name] = joblib.load(p)

            # DL
            try:
                from tensorflow import keras
                for name in ["MLP", "LSTM", "GRU", "BiLSTM", "BiRNN", "CNN", "Transformer"]:
                    p = SURFACE_MODELS_DIR / f"{name}.keras"
                    if p.exists():
                        self.dl_models[name] = keras.models.load_model(p)
            except Exception as e:
                print(f"[surface_registry] TF non disponible : {e}")

            # Evaluation
            p_eval = SURFACE_MODELS_DIR / "evaluation_surface.json"
            if p_eval.exists():
                with open(p_eval) as f:
                    data = json.load(f)
                self.feature_cols = data.get("feature_cols", [])
                self.eval_results = data

            self._loaded = True
            print(f"[surface_registry] ML={list(self.ml_models.keys())} DL={list(self.dl_models.keys())}")

    def is_ready(self) -> bool:
        return bool(self.ml_models or self.dl_models)

    def available_models(self):
        return sorted(list(self.ml_models.keys()) + list(self.dl_models.keys()))

    def predict_point(self, model_name: str, features: dict) -> float:
        x = np.array([[features.get(c, 0.0) for c in self.feature_cols]], dtype=float)
        if model_name in self.ml_models:
            return float(self.ml_models[model_name].predict(x)[0])
        if model_name in self.dl_models:
            from app.ml.dl_models import reshape_seq
            is_seq = model_name != "MLP"
            x_in = reshape_seq(x) if is_seq else x
            return float(self.dl_models[model_name].predict(x_in, verbose=0)[0][0])
        raise ValueError(f"Modèle '{model_name}' introuvable dans surface_registry")

    def predict_surface(self, model_name: str, market_row: dict) -> list:
        """Prédit toute la nappe (TENORS x MONEYNESS)."""
        z = []
        for t in TENORS:
            row = []
            for m in MONEYNESS:
                feat = dict(market_row)
                feat["moneyness_norm"] = m / 90.0
                feat["moneyness_sq"]   = (m / 90.0) ** 2
                feat["log_tenor"]      = float(np.log(t))
                feat["sqrt_tenor"]     = float(np.sqrt(t))
                feat["mny_x_logt"]     = feat["moneyness_norm"] * feat["log_tenor"]
                try:
                    iv = self.predict_point(model_name, feat)
                    row.append(round(max(0.0, iv), 4))
                except Exception:
                    row.append(None)
            z.append(row)
        return z


surface_registry = SurfaceRegistry()

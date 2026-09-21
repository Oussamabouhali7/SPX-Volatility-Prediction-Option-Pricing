"""Métriques de régression + métriques financières (MAPE, QLIKE, Directional Accuracy)."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from typing import Dict


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    y_true = np.asarray(y_true).flatten()
    y_pred = np.asarray(y_pred).flatten()
    mse = mean_squared_error(y_true, y_pred)
    return {
        "rmse": float(np.sqrt(mse)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "mse": float(mse),
        "r2": float(r2_score(y_true, y_pred)),
    }


def mape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-8) -> float:
    """Mean Absolute Percentage Error — robuste aux zéros."""
    y_true = np.asarray(y_true).flatten()
    y_pred = np.asarray(y_pred).flatten()
    return float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + eps))) * 100)


def qlike(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-8) -> float:
    """
    QLIKE = log(σ²_pred) + σ²_true / σ²_pred

    Métrique financière standard pour évaluer les prévisions de volatilité —
    asymétrique : pénalise davantage la sous-estimation que la sur-estimation.
    """
    y_true = np.asarray(y_true).flatten()
    y_pred = np.asarray(y_pred).flatten()
    var_true = y_true ** 2 + eps
    var_pred = y_pred ** 2 + eps
    return float(np.mean(np.log(var_pred) + var_true / var_pred))


def directional_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    % de prédictions qui ont le bon sens de variation (j+1 vs j).
    Indispensable en finance : prédire le sens > prédire la valeur exacte.
    """
    y_true = np.asarray(y_true).flatten()
    y_pred = np.asarray(y_pred).flatten()
    if len(y_true) < 2:
        return 0.0
    true_diff = np.diff(y_true)
    pred_diff = np.diff(y_pred)
    return float(np.mean(np.sign(true_diff) == np.sign(pred_diff)) * 100)


def all_metrics(y_true, y_pred) -> Dict[str, float]:
    base = regression_metrics(y_true, y_pred)
    base["mape"] = mape(y_true, y_pred)
    base["qlike"] = qlike(y_true, y_pred)
    base["directional_accuracy"] = directional_accuracy(y_true, y_pred)
    return base

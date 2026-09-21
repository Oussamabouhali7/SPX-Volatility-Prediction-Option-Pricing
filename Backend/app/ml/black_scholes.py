"""
Black-Scholes-Merton pour options vanilles européennes
+ Newton-Raphson pour IV implicite
+ Monte Carlo (GBM) avec antithetic variates
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm
from typing import Dict, Tuple


# ============================================================
# Black-Scholes
# ============================================================
def _d1_d2(S, K, T, r, sigma, q=0.0):
    sigma = max(float(sigma), 1e-8)
    T = max(float(T), 1e-8)
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return d1, d2


def bs_price(S, K, T, r, sigma, option_type="C", q=0.0) -> float:
    d1, d2 = _d1_d2(S, K, T, r, sigma, q)
    if option_type.upper() in ("C", "CALL"):
        return float(S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
    return float(K * np.exp(-r * T) * norm.cdf(-d2) - S * np.exp(-q * T) * norm.cdf(-d1))


def bs_greeks(S, K, T, r, sigma, option_type="C", q=0.0) -> Dict[str, float]:
    d1, d2 = _d1_d2(S, K, T, r, sigma, q)
    is_call = option_type.upper() in ("C", "CALL")

    delta = (np.exp(-q * T) * norm.cdf(d1)) if is_call else (-np.exp(-q * T) * norm.cdf(-d1))
    gamma = np.exp(-q * T) * norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega  = S * np.exp(-q * T) * norm.pdf(d1) * np.sqrt(T) / 100.0     # par 1% de vol
    theta_call = (
        -S * np.exp(-q * T) * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
        - r * K * np.exp(-r * T) * norm.cdf(d2)
        + q * S * np.exp(-q * T) * norm.cdf(d1)
    ) / 365.0   # par jour
    theta_put = (
        -S * np.exp(-q * T) * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
        + r * K * np.exp(-r * T) * norm.cdf(-d2)
        - q * S * np.exp(-q * T) * norm.cdf(-d1)
    ) / 365.0
    theta = theta_call if is_call else theta_put
    rho = (K * T * np.exp(-r * T) * norm.cdf(d2)) / 100.0 if is_call \
        else -(K * T * np.exp(-r * T) * norm.cdf(-d2)) / 100.0
    return {
        "delta": float(delta), "gamma": float(gamma),
        "vega": float(vega), "theta": float(theta), "rho": float(rho),
    }


# ============================================================
# Newton-Raphson : Implied Volatility
# ============================================================
def implied_vol_newton(
    price_obs: float, S: float, K: float, T: float, r: float,
    option_type: str = "C", q: float = 0.0,
    sigma_init: float = 0.20, tol: float = 1e-6, max_iter: int = 100,
) -> float:
    """Inversion BS via Newton-Raphson avec fallback bisection."""
    intrinsic = max((S * np.exp(-q * T) - K * np.exp(-r * T)) if option_type.upper() in ("C", "CALL")
                    else (K * np.exp(-r * T) - S * np.exp(-q * T)), 0)
    if price_obs < intrinsic - 1e-6:
        return float("nan")

    sigma = max(sigma_init, 1e-4)
    for _ in range(max_iter):
        price = bs_price(S, K, T, r, sigma, option_type, q)
        diff = price - price_obs
        if abs(diff) < tol:
            return float(sigma)
        d1, _ = _d1_d2(S, K, T, r, sigma, q)
        vega = S * np.exp(-q * T) * norm.pdf(d1) * np.sqrt(T)
        if vega < 1e-10:
            return _bisect_iv(price_obs, S, K, T, r, option_type, q)
        sigma = sigma - diff / vega
        if sigma <= 0 or sigma > 5:
            return _bisect_iv(price_obs, S, K, T, r, option_type, q)
    return _bisect_iv(price_obs, S, K, T, r, option_type, q)


def _bisect_iv(price_obs, S, K, T, r, option_type, q,
               lo=1e-4, hi=5.0, tol=1e-6, max_iter=200):
    f_lo = bs_price(S, K, T, r, lo, option_type, q) - price_obs
    f_hi = bs_price(S, K, T, r, hi, option_type, q) - price_obs
    if f_lo * f_hi > 0:
        return float("nan")
    for _ in range(max_iter):
        mid = 0.5 * (lo + hi)
        f_mid = bs_price(S, K, T, r, mid, option_type, q) - price_obs
        if abs(f_mid) < tol:
            return float(mid)
        if f_mid * f_lo < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return float(0.5 * (lo + hi))


# ============================================================
# Monte Carlo
# ============================================================
def mc_price_european(
    S, K, T, r, sigma, option_type="C", q=0.0,
    n_paths=100_000, antithetic=True, seed=42,
) -> Tuple[float, float]:
    rng = np.random.default_rng(seed)
    if antithetic:
        half = n_paths // 2
        z = rng.standard_normal(half)
        z = np.concatenate([z, -z])
    else:
        z = rng.standard_normal(n_paths)
    ST = S * np.exp((r - q - 0.5 * sigma * sigma) * T + sigma * np.sqrt(T) * z)
    payoff = np.maximum(ST - K, 0.0) if option_type.upper() in ("C", "CALL") else np.maximum(K - ST, 0.0)
    discounted = np.exp(-r * T) * payoff
    return float(discounted.mean()), float(discounted.std(ddof=1) / np.sqrt(n_paths))

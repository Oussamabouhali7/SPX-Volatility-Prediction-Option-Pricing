"""Endpoints pricing d'option : Black-Scholes + Monte Carlo + ML/DL."""
from fastapi import APIRouter, Depends, HTTPException

from app.schemas import PricingRequest, PricingResponse, GreeksOut
from app.services.registry import registry
from app.auth.security import get_current_user
from app.models_dir.user import User
from app.ml.black_scholes import bs_price, bs_greeks, mc_price_european


router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.post("/option", response_model=PricingResponse)
def price_option(req: PricingRequest, _: User = Depends(get_current_user)):
    import numpy as np

    S, K = req.spot, req.strike
    T = req.maturity_days / 365.0
    r, q = req.rate, req.dividend

    # IV à utiliser : soit fournie, soit prédite par les modèles
    moneyness = K / S - 1.0
    features = {
        "moneyness": moneyness,
        "log_moneyness": np.log(K / S),
        "moneyness_abs": abs(moneyness),
        "moneyness_sq": moneyness ** 2,
        "tenor_d": req.maturity_days,
        "log_tenor": np.log(max(req.maturity_days, 1)),
        "sqrt_tenor": np.sqrt(req.maturity_days),
        "tenor_years": T,
        "mny_x_logt": moneyness * np.log(max(req.maturity_days, 1)),
        "is_call": 1 if req.option_type.upper() == "C" else 0,
        "delta": 0.5, "gamma": 0.01, "vega": 50.0, "theta": -0.05,
        "vix": 20.0, "rate_10y": r * 100, "close_gspc": S,
        "fwd_front": S * np.exp((r - q) * T),
        "hvol_10d": 0.16, "hvol_30d": 0.15, "hvol_60d": 0.15,
        "hvol_91d": 0.14, "hvol_182d": 0.14, "hvol_365d": 0.13, "hvol_730d": 0.13,
        "open_interest": 100_000, "volume": 1_000,
    }

    ml_ivs = registry.predict_iv_all(features)

    if req.sigma is not None:
        sigma = req.sigma
    elif req.model_name in ml_ivs:
        sigma = ml_ivs[req.model_name]
    elif ml_ivs:
        sigma = list(ml_ivs.values())[0]
    else:
        sigma = 0.20

    sigma = max(sigma, 0.01)

    bs = bs_price(S, K, T, r, sigma, req.option_type, q)
    greeks = bs_greeks(S, K, T, r, sigma, req.option_type, q)
    mc, mc_se = mc_price_european(
        S, K, T, r, sigma, req.option_type, q, n_paths=req.n_paths_mc
    )

    # Prix dérivé pour chaque IV prédite par modèle
    ml_prices = {
        name: bs_price(S, K, T, r, max(iv, 0.01), req.option_type, q)
        for name, iv in ml_ivs.items()
    }

    return PricingResponse(
        sigma_used=sigma,
        bs_price=bs,
        mc_price=mc,
        mc_stderr=mc_se,
        greeks=GreeksOut(**greeks),
        ml_prices=ml_prices,
    )

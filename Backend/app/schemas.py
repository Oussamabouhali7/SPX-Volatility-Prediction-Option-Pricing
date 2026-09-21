"""Schémas Pydantic pour validation entrée/sortie."""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any


# ---------------------- USER ----------------------
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None



class UserCreate(UserBase):
    password: str
    is_admin: bool = False


class UserUpdate(BaseModel):

    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    id: int
    is_admin: bool
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------- AUTH ----------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------------------- PREDICTIONS IV ----------------------
class IVPredictRequest(BaseModel):
    moneyness: float
    tenor_d: int
    vix: float = 20.0
    rate_10y: float = 4.0
    hvol_30d: float = 0.15
    close_gspc: float = 4500.0
    model_name: str = "XGBoost"
    n_windows: int = 47  # Nombre de fenetres a considerer (1-47)


class IVPredictResponse(BaseModel):
    model_name: str
    iv_predicted: float
    confidence_low: Optional[float] = None
    confidence_high: Optional[float] = None


class IVMultiModelResponse(BaseModel):
    predictions: Dict[str, float]
    inputs: IVPredictRequest
    rmse_by_window: Dict[str, float] = {}


# ---------------------- PRICING ----------------------
class PricingRequest(BaseModel):
    spot: float
    strike: float
    maturity_days: int
    rate: float = 0.04
    sigma: Optional[float] = None       # si None → IV prédite par modèle
    option_type: str = "C"              # 'C' ou 'P'
    dividend: float = 0.0
    model_name: str = "XGBoost"         # modèle pour IV si sigma None
    n_paths_mc: int = 100_000


class GreeksOut(BaseModel):
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


class PricingResponse(BaseModel):
    sigma_used: float
    bs_price: float
    mc_price: float
    mc_stderr: float
    greeks: GreeksOut
    ml_prices: Dict[str, float]   # prix dérivé des IV ML


# ---------------------- SURFACE ----------------------
class SurfaceRequest(BaseModel):
    date_obs: str   # YYYY-MM-DD
    model_name: str = "XGBoost"


class SurfacePoint(BaseModel):
    moneyness: float
    tenor_d: int
    iv: float


class SurfaceResponse(BaseModel):
    date: str
    observed: List[SurfacePoint]
    predicted: List[SurfacePoint]
    model_name: str
    rmse: float
    mae: float
    r2: float


# ---------------------- EVALUATION ----------------------
class WindowResult(BaseModel):
    window_id: int
    start_date: str
    end_date: str
    rmse_train: float
    mae_train: float
    mse_train: float
    r2_train: float
    rmse_val: float
    mae_val: float
    mse_val: float
    r2_val: float
    rmse_test: float
    mae_test: float
    mse_test: float
    r2_test: float
    mape: float
    qlike: float
    directional_accuracy: float


class ModelEvaluation(BaseModel):
    model_name: str
    n_windows: int
    mean_rmse: float
    mean_mae: float
    mean_mse: float
    mean_r2: float
    mean_mape: float
    mean_qlike: float
    mean_directional_accuracy: float
    crisis_train_rmse: Optional[float] = None    # Subprimes (train+test)
    crisis_val_rmse: Optional[float] = None      # COVID (validation)
    hyperparameters: Dict[str, Any] = {}


class EvaluationResponse(BaseModel):
    models: List[ModelEvaluation]
    windows: List[WindowResult]

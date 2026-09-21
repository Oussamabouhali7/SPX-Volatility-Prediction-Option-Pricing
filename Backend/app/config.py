"""Configuration via variables d'environnement."""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://pwc_user:pwc_password@localhost:5432/pwc_iv"
    JWT_SECRET: str = "dev_secret_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    DATA_FILE: str = str(Path(__file__).resolve().parents[1] / "data" / "options_merged_spx.csv")
    MODELS_DIR: str = str(Path(__file__).resolve().parents[1] / "saved_models")

    # Admin par défaut créé au démarrage
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "PwC2024!"
    DEFAULT_ADMIN_EMAIL: str = "admin@pwc.com"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

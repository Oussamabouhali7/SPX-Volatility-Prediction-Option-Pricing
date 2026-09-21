"""
Application FastAPI — Prédiction volatilité implicite (PwC).

Au démarrage :
1. Crée les tables PostgreSQL
2. Crée l'admin par défaut si la table est vide
3. Charge les modèles ML/DL pré-entraînés s'ils existent
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models_dir.user import User
from app.auth.security import hash_password
from app.routers import (
    auth_router, users_router, iv_router,
    pricing_router, surface_router, evaluation_router,
    eda_router,
)
from app.services.registry import registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Création des tables
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as e:
        print(f"[startup] BDD non disponible : {e}")
    else:
        # Admin par défaut
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                admin = User(
                    username=settings.DEFAULT_ADMIN_USERNAME,
                    email=settings.DEFAULT_ADMIN_EMAIL,
                    hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                    is_admin=True,
                    is_active=True,
                )
                db.add(admin)
                db.commit()
                print(f"[startup] Admin créé : {settings.DEFAULT_ADMIN_USERNAME} / "
                      f"{settings.DEFAULT_ADMIN_PASSWORD}")
        finally:
            db.close()

    # Préchargement des modèles
    try:
        registry.load()
        print(f"[startup] Modèles ML chargés : {list(registry.ml_models.keys())}")
        print(f"[startup] Modèles DL chargés : {list(registry.dl_models.keys())}")
    except Exception as e:
        print(f"[startup] Modèles non chargés : {e}")

    yield


app = FastAPI(
    title="PwC IV Prediction API",
    description="API de prédiction de volatilité implicite (SPX) — ML + DL + BS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(iv_router.router)
app.include_router(pricing_router.router)
app.include_router(surface_router.router)
app.include_router(evaluation_router.router)
app.include_router(eda_router.router)

@app.get("/")
def root():
    return {
        "name": "PwC IV Prediction API",
        "docs": "/docs",
        "version": "1.0.0",
        "endpoints": ["/auth", "/users", "/iv", "/pricing", "/surface", "/evaluation"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}

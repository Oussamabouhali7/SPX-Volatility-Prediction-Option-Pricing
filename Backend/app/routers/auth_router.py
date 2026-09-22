"""Endpoints d'authentification."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models_dir.user import User
from app.schemas import Token, UserOut, LoginRequest
from app.auth.security import verify_password, create_access_token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login OAuth2 standard (formulaire)."""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Identifiants invalides")
    if not user.is_active:
        raise HTTPException(403, "Compte désactivé")
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login-json", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login JSON pour les SPA."""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Identifiants invalides")
    if not user.is_active:
        raise HTTPException(403, "Compte désactivé")
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(__import__("app.auth.security", fromlist=["get_current_user"]).get_current_user)):
    return current_user

from app.schemas import UserCreate
from app.models_dir.user import User as UserModel

@router.post('/register')
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if existing:
        raise HTTPException(400, 'Nom utilisateur déjà pris')
    from app.auth.security import hash_password
    user = UserModel(
        username=payload.username,
        email=payload.email if hasattr(payload, "email") and payload.email else payload.username+"@pwc.com",
        hashed_password=hash_password(payload.password),
        is_admin=False,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'message': 'Compte créé avec succès'}


@router.post("/register")
def register(payload: LoginRequest, db: Session = Depends(get_db)):
    from app.models_dir.user import User as UserModel
    existing = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if existing:
        raise HTTPException(400, "Nom utilisateur deja pris")
    from app.auth.security import hash_password
    user = UserModel(username=payload.username, email=payload.username+"@pwc.com", hashed_password=hash_password(payload.password), is_admin=False, is_active=True)
    db.add(user)
    db.commit()
    return {"message": "Compte cree avec succes"}

code = """

@router.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    from app.models_dir.user import User as UserModel
    from app.auth.security import hash_password
    username = payload.get("username")
    email = payload.get("email", username + "@pwc.com")
    password = payload.get("password")
    existing = db.query(UserModel).filter(UserModel.username == username).first()
    if existing:
        raise HTTPException(400, "Nom utilisateur deja pris")
    user = UserModel(username=username, email=email, hashed_password=hash_password(password), is_admin=False, is_active=True)
    db.add(user)
    db.commit()
    return {"message": "Compte cree avec succes"}
"""
with open("/app/app/routers/auth_router.py", "r") as f:
    content = f.read()
if "/register" not in content:
    with open("/app/app/routers/auth_router.py", "a") as f:
        f.write(code)
    print("Route register ajoutee OK")
else:
    print("Route register existe deja")

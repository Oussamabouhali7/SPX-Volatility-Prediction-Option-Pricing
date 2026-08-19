with open("/app/app/schemas.py", "r") as f:
    c = f.read()
c = c.replace(
    'class UserBase(BaseModel):\n    username: str',
    'class UserBase(BaseModel):\n    username: str\n    email: Optional[str] = None'
)
c = c.replace(
    'class UserUpdate(BaseModel):\n    password: Optional[str] = None\n    is_admin: Optional[bool] = None\n    is_active: Optional[bool] = None',
    'class UserUpdate(BaseModel):\n    password: Optional[str] = None\n    email: Optional[str] = None\n    is_admin: Optional[bool] = None\n    is_active: Optional[bool] = None'
)
with open("/app/app/schemas.py", "w") as f:
    f.write(c)
print("OK")

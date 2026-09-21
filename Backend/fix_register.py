with open("/app/app/routers/auth_router.py", "r") as f:
    c = f.read()
c = c.replace(
    'email=payload.email,',
    'email=payload.email if hasattr(payload, "email") and payload.email else payload.username+"@pwc.com",'
)
with open("/app/app/routers/auth_router.py", "w") as f:
    f.write(c)
print("OK")

with open("/app/app/routers/users_router.py", "r") as f:
    c = f.read()
c = c.replace(
    'if payload.email is not None:',
    'if hasattr(payload, "email") and payload.email is not None:'
)
with open("/app/app/routers/users_router.py", "w") as f:
    f.write(c)
print("OK")

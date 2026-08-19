import re
with open("/app/src/pages/Login.jsx", "r") as f:
    c = f.read()
c = c.replace('import { login, createUser } from "../api/client";', 'import { login } from "../api/client";')
c = c.replace('await createUser({ username: newUsername, email: newEmail, password: newPassword, is_admin: false, is_active: true });', 'const res = await fetch("http://localhost:8000/auth/register", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:newUsername,email:newEmail,password:newPassword})});const data = await res.json();if(!res.ok) throw new Error(data.detail);')
with open("/app/src/pages/Login.jsx", "w") as f:
    f.write(c)
print("OK")

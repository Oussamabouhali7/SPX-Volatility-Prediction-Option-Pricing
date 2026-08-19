const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Login.jsx", "utf8");
c = c.replace('import { login, createUser } from "../api/client";', 'import { login } from "../api/client";');
c = c.replace('await createUser({ username: newUsername, email: newEmail, password: newPassword, is_admin: false, is_active: true });', 'const res = await fetch("http://localhost:8000/auth/register", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:newUsername,email:newEmail,password:newPassword})});const data = await res.json();if(!res.ok) throw new Error(data.detail);');
fs.writeFileSync("/app/src/pages/Login.jsx", c);
console.log("OK");

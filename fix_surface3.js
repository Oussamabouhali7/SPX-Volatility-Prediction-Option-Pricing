const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Surface.jsx", "utf8");
c = c.replace("{data.r2.toFixed(4)}", "{data.r2 ? data.r2.toFixed(4) : 'N/A'}");
fs.writeFileSync("/app/src/pages/Surface.jsx", c);
console.log("OK");

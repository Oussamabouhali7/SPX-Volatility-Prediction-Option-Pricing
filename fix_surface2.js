const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Surface.jsx", "utf8");
c = c.replace(
  "{data.rmse.toFixed(5)}",
  "{data.rmse ? data.rmse.toFixed(5) : 'N/A'}"
);
c = c.replace(
  "{data.mae.toFixed(5)}",
  "{data.mae ? data.mae.toFixed(5) : 'N/A'}"
);
c = c.replace(
  "{data.r2.toFixed(5)}",
  "{data.r2 ? data.r2.toFixed(5) : 'N/A'}"
);
fs.writeFileSync("/app/src/pages/Surface.jsx", c);
console.log("OK");

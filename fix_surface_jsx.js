const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Surface.jsx", "utf8");

// Fix 1: listSurfaceDates retourne {dates: [...]} pas un tableau
c = c.replace(
  ".then((d) => {\n        setDates(d);\n        if (d.length > 0) setDate(d[Math.floor(d.length / 2)]);",
  ".then((d) => {\n        const arr = Array.isArray(d) ? d : (d.dates || []);\n        setDates(arr);\n        if (arr.length > 0) setDate(arr[Math.floor(arr.length / 2)]);"
);

// Fix 2: buildSurface utilise l ancien format, nouveau format est {tenors, moneyness, z_observed}
c = c.replace(
  "const observed = data ? buildSurface(data.observed) : null;",
  "const observed = data ? { x: data.moneyness, y: data.tenors, z: data.z_observed } : null;"
);
c = c.replace(
  "const predicted = data ? buildSurface(data.predicted) : null;",
  "const predicted = data ? { x: data.moneyness, y: data.tenors, z: data.z_predicted } : null;"
);

fs.writeFileSync("/app/src/pages/Surface.jsx", c);
console.log("OK");

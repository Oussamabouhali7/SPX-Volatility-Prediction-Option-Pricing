const fs = require("fs");
let c = fs.readFileSync("/app/src/components/Layout.jsx", "utf8");
c = c.replace(
  "import DashboardIcon from '@mui/icons-material/Dashboard';",
  "import DashboardIcon from '@mui/icons-material/Dashboard';\nimport BarChartIcon from '@mui/icons-material/BarChart';"
);
fs.writeFileSync("/app/src/components/Layout.jsx", c);
console.log("OK");

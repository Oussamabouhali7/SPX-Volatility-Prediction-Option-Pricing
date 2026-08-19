const fs = require("fs");

let app = fs.readFileSync("/app/src/App.jsx", "utf8");
app = app.replace(
  "import EDA from './pages/EDA';",
  "import EDA from './pages/EDA';\nimport Methodology from './pages/Methodology';"
);
app = app.replace(
  '<Route path="/eda" element={<EDA />} />',
  '<Route path="/eda" element={<EDA />} />\n        <Route path="/methodology" element={<Methodology />} />'
);
fs.writeFileSync("/app/src/App.jsx", app);

let layout = fs.readFileSync("/app/src/components/Layout.jsx", "utf8");
layout = layout.replace(
  "import BarChartIcon from '@mui/icons-material/BarChart';",
  "import BarChartIcon from '@mui/icons-material/BarChart';\nimport SchoolIcon from '@mui/icons-material/School';"
);
layout = layout.replace(
  "{ path: '/eda' , icon: <BarChartIcon /> , label: 'Exploration EDA' }",
  "{ path: '/eda' , icon: <BarChartIcon /> , label: 'Exploration EDA' },\n  { path: '/methodology', icon: <SchoolIcon />, label: 'Methodologie' }"
);
fs.writeFileSync("/app/src/components/Layout.jsx", layout);
console.log("OK");

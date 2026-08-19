const fs = require("fs");

let app = fs.readFileSync("/app/src/App.jsx", "utf8");
app = app.replace(
  "import Methodology from './pages/Methodology';",
  "import Methodology from './pages/Methodology';\nimport SurfaceMethodology from './pages/SurfaceMethodology';"
);
app = app.replace(
  '<Route path="/methodology" element={<Methodology />} />',
  '<Route path="/methodology" element={<Methodology />} />\n        <Route path="/surface-methodology" element={<SurfaceMethodology />} />'
);
fs.writeFileSync("/app/src/App.jsx", app);

let layout = fs.readFileSync("/app/src/components/Layout.jsx", "utf8");
layout = layout.replace(
  "{ path: '/methodology', icon: <SchoolIcon />, label: 'Methodologie' }",
  "{ path: '/methodology', icon: <SchoolIcon />, label: 'Methodologie' },\n  { path: '/surface-methodology', icon: <ShowChartIcon />, label: 'Methodo Nappe' }"
);
layout = layout.replace(
  "import SchoolIcon from '@mui/icons-material/School';",
  "import SchoolIcon from '@mui/icons-material/School';\nimport ShowChartIcon from '@mui/icons-material/ShowChart';"
);
fs.writeFileSync("/app/src/components/Layout.jsx", layout);
console.log("OK");

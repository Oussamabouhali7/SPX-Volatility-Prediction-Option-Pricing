const fs = require("fs");
let c = fs.readFileSync("/app/src/pages/Evaluation.jsx", "utf8");

c = c.replace(
  "  const [metricView, setMetricView] = useState('mean_rmse');",
  "  const [metricView, setMetricView] = useState('mean_rmse');\n  const [maxWin, setMaxWin] = useState(54);"
);

c = c.replace(
  "  const models = [...data.models].sort((a, b) => a.mean_rmse - b.mean_rmse);",
  "  const allWindows = data.windows || [];\n  const filteredWindows = maxWin < 54 ? allWindows.filter(w => w.window_id <= maxWin) : allWindows;\n  const models = [...data.models].map(m => {\n    const wins = filteredWindows.filter(w => w.model === m.model_name);\n    if (wins.length === 0) return m;\n    return { ...m,\n      mean_rmse: wins.reduce((s,w) => s + w.rmse_test, 0) / wins.length,\n      mean_mae:  wins.reduce((s,w) => s + w.mae_test,  0) / wins.length,\n      mean_r2:   wins.reduce((s,w) => s + w.r2_test,   0) / wins.length,\n      n_windows: wins.length,\n    };\n  }).sort((a, b) => a.mean_rmse - b.mean_rmse);"
);

fs.writeFileSync("/app/src/pages/Evaluation.jsx", c);
console.log("OK");

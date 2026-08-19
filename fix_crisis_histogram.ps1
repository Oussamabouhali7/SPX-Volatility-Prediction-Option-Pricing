# ================================================================
# fix_crisis_histogram.ps1
# Ajoute un histogramme groupé Train/Test/Val dans Crisis Split
# ================================================================

$fix = @'
content = open("/app/frontend/src/pages/Evaluation.jsx").read()

old = """      {/* TAB 2 — Crisis split */}
      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant=\"h4\" sx={{ mb: 2 }}>
            Stabilité temporelle : Subprimes (2007-09) → COVID (2020)
          </Typography>
          <Alert severity=\"info\" sx={{ mb: 2 }}>
            Modèles entraînés sur les Subprimes et validés sur la crise COVID :
            un ratio RMSE_COVID / RMSE_Subprimes proche de 1 indique un modèle robuste.
          </Alert>
          <Table size=\"small\">
            <TableHead>
              <TableRow>
                <TableCell><strong>Modèle</strong></TableCell>
                <TableCell align=\"right\"><strong>RMSE Subprimes (test)</strong></TableCell>
                <TableCell align=\"right\"><strong>RMSE COVID (val)</strong></TableCell>
                <TableCell align=\"right\"><strong>Ratio</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models
                .filter(m => m.crisis_train_rmse !== null && m.crisis_val_rmse !== null)
                .map(m => {
                  const ratio = m.crisis_val_rmse / m.crisis_train_rmse;
                  return (
                    <TableRow key={m.model_name}>
                      <TableCell>{m.model_name}</TableCell>
                      <TableCell align=\"right\">{m.crisis_train_rmse?.toFixed(5)}</TableCell>
                      <TableCell align=\"right\">{m.crisis_val_rmse?.toFixed(5)}</TableCell>
                      <TableCell align=\"right\" sx={{
                        color: ratio < 1.5 ? PWC_COLORS.orange : PWC_COLORS.red,
                        fontWeight: 600,
                      }}>{ratio.toFixed(2)}×</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Paper>
      )}"""

new = """      {/* TAB 2 — Crisis split */}
      {tab === 2 && (() => {
        const crisisModels = models.filter(m =>
          m.crisis_train_rmse !== null && m.crisis_val_rmse !== null
        );
        const crisis = data.crisis_split_details || {};
        const modelNames = crisisModels.map(m => m.model_name);

        const getMetric = (modelName, split, metric) => {
          const s = crisis[modelName];
          if (!s) return 0;
          return s[split]?.[metric] ?? 0;
        };

        const [crisisMetric, setCrisisMetric] = React.useState('rmse');

        const metricLabels = { rmse: 'RMSE', mae: 'MAE', r2: 'R²', mape: 'MAPE', directional_accuracy: 'Dir. Accuracy' };

        return (
          <Box>
            <Alert severity=\"info\" sx={{ mb: 2 }}>
              Modèles entraînés sur les Subprimes (2007-2009) et validés sur COVID (2020).
              Un ratio RMSE COVID / RMSE Subprimes proche de 1 = modèle robuste.
            </Alert>

            {/* Selecteur metrique */}
            <TextField select label=\"Métrique\" value={crisisMetric}
              onChange={e => setCrisisMetric(e.target.value)}
              size=\"small\" sx={{ width: 220, mb: 3 }}>
              {Object.entries(metricLabels).map(([k,v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>

            {/* Histogramme groupé Train / Test Subprimes / Val COVID */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant=\"h4\" sx={{ mb: 1 }}>
                {metricLabels[crisisMetric]} par modèle — Train vs Test Subprimes vs Val COVID
              </Typography>
              <Plot
                data={[
                  {
                    type: 'bar',
                    name: 'Train Subprimes',
                    x: modelNames,
                    y: modelNames.map(n => getMetric(n, 'train_subprime', crisisMetric)),
                    marker: { color: PWC_COLORS.orange },
                    text: modelNames.map(n => getMetric(n, 'train_subprime', crisisMetric).toFixed(4)),
                    textposition: 'outside',
                  },
                  {
                    type: 'bar',
                    name: 'Test Subprimes',
                    x: modelNames,
                    y: modelNames.map(n => getMetric(n, 'test_subprime', crisisMetric)),
                    marker: { color: '#1a6b8a' },
                    text: modelNames.map(n => getMetric(n, 'test_subprime', crisisMetric).toFixed(4)),
                    textposition: 'outside',
                  },
                  {
                    type: 'bar',
                    name: 'Val COVID',
                    x: modelNames,
                    y: modelNames.map(n => getMetric(n, 'val_covid', crisisMetric)),
                    marker: { color: '#e8463a' },
                    text: modelNames.map(n => getMetric(n, 'val_covid', crisisMetric).toFixed(4)),
                    textposition: 'outside',
                  },
                ]}
                layout={{
                  barmode: 'group',
                  autosize: true,
                  height: 480,
                  xaxis: { title: 'Modèle', tickangle: -20 },
                  yaxis: { title: metricLabels[crisisMetric] },
                  legend: { orientation: 'h', y: -0.2 },
                  margin: { t: 40, l: 60, r: 30, b: 100 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Paper>

            {/* Tableau récapitulatif */}
            <Paper sx={{ p: 2 }}>
              <Typography variant=\"h4\" sx={{ mb: 2 }}>Tableau — RMSE Subprimes vs COVID</Typography>
              <Table size=\"small\">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Modèle</strong></TableCell>
                    <TableCell align=\"right\"><strong>RMSE Train Subprimes</strong></TableCell>
                    <TableCell align=\"right\"><strong>RMSE Test Subprimes</strong></TableCell>
                    <TableCell align=\"right\"><strong>RMSE Val COVID</strong></TableCell>
                    <TableCell align=\"right\"><strong>Ratio COVID/Test</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {crisisModels.map(m => {
                    const ratio = m.crisis_val_rmse / m.crisis_test_rmse;
                    return (
                      <TableRow key={m.model_name}>
                        <TableCell><strong>{m.model_name}</strong></TableCell>
                        <TableCell align=\"right\">{m.crisis_train_rmse?.toFixed(5)}</TableCell>
                        <TableCell align=\"right\">{m.crisis_test_rmse?.toFixed(5)}</TableCell>
                        <TableCell align=\"right\">{m.crisis_val_rmse?.toFixed(5)}</TableCell>
                        <TableCell align=\"right\" sx={{
                          color: ratio < 2 ? PWC_COLORS.orange : '#e8463a',
                          fontWeight: 700,
                        }}>{ratio.toFixed(2)}×</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        );
      })()}"""

content = content.replace(old, new)
open("/app/frontend/src/pages/Evaluation.jsx", "w").write(content)
print("OK")
'@

$fix | Out-File -FilePath "C:\Users\user\Desktop\volatility_pwc\fix_crisis_chart.py" -Encoding UTF8
docker cp C:\Users\user\Desktop\volatility_pwc\fix_crisis_chart.py pwc_iv_backend:/app/fix_crisis_chart.py
docker exec pwc_iv_backend python3 /app/fix_crisis_chart.py
docker cp pwc_iv_backend:/app/frontend/src/pages/Evaluation.jsx C:\Users\user\Desktop\volatility_pwc\frontend\src\pages\Evaluation.jsx
Write-Host "Done - rechargez http://localhost:3000" -ForegroundColor Green

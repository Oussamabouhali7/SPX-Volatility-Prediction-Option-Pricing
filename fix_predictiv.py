new_content = r"""// pages/PredictIV.jsx — Onglet 1 : Prediction de la volatilite implicite
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, CircularProgress,
  Slider, Chip, Tooltip,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { predictIVAll } from '../api/client';
import api from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';

export default function PredictIV() {
  const [form, setForm] = useState({
    moneyness: -0.05,
    tenor_d: 91,
    vix: 20.0,
    rate_10y: 4.0,
    hvol_30d: 0.15,
    close_gspc: 4500.0,
    model_name: 'XGBoost',
    n_windows: 47,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxWindows, setMaxWindows] = useState(47);

  useEffect(() => {
    api.get('/iv/windows-info').then(r => {
      if (r.data.n_windows > 0) setMaxWindows(r.data.n_windows);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await predictIVAll(form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de prediction');
    } finally {
      setLoading(false);
    }
  };

  const onChange = (key) => (e) =>
    setForm({ ...form, [key]: parseFloat(e.target.value) || 0 });

  const onWindowsChange = (_, val) =>
    setForm({ ...form, n_windows: val });

  // Trier les predictions par IV decroissante
  const sortedPreds = result
    ? Object.entries(result.predictions).sort((a, b) => b[1] - a[1])
    : [];

  // Modeles valides (IV entre 0 et 2 = 0% a 200%)
  const validPreds = sortedPreds.filter(([, v]) => v > 0 && v < 2.0);
  const invalidPreds = sortedPreds.filter(([, v]) => v <= 0 || v >= 2.0);

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Prediction de la volatilite implicite</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Selectionnez un point (moneyness, maturite) et comparez les predictions des modeles.
      </Typography>

      <Grid container spacing={3}>
        {/* Formulaire */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Parametres</Typography>

            <TextField fullWidth label="Moneyness (K/S - 1)" type="number"
              margin="dense" value={form.moneyness} onChange={onChange('moneyness')}
              inputProps={{ step: 0.01 }} helperText="-0.10 = put 10% OTM" />
            <TextField fullWidth label="Maturite (jours)" type="number"
              margin="dense" value={form.tenor_d} onChange={onChange('tenor_d')} />
            <TextField fullWidth label="VIX" type="number"
              margin="dense" value={form.vix} onChange={onChange('vix')} />
            <TextField fullWidth label="Taux 10Y (%)" type="number"
              margin="dense" value={form.rate_10y} onChange={onChange('rate_10y')} />
            <TextField fullWidth label="HVol 30j" type="number"
              margin="dense" value={form.hvol_30d} onChange={onChange('hvol_30d')}
              inputProps={{ step: 0.01 }} />
            <TextField fullWidth label="Spot S&P 500" type="number"
              margin="dense" value={form.close_gspc} onChange={onChange('close_gspc')} />

            {/* Slider fenetres */}
            <Box sx={{ mt: 3, mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Fenetres walk-forward
                </Typography>
                <Chip
                  label={`${form.n_windows} / ${maxWindows}`}
                  size="small"
                  sx={{ bgcolor: PWC_COLORS.orange + '20', color: PWC_COLORS.orange, fontWeight: 600 }}
                />
              </Box>
              <Slider
                value={form.n_windows}
                onChange={onWindowsChange}
                min={1} max={maxWindows} step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: Math.round(maxWindows / 2), label: String(Math.round(maxWindows / 2)) },
                  { value: maxWindows, label: String(maxWindows) },
                ]}
                sx={{ color: PWC_COLORS.orange, mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Le RMSE affiche sera la moyenne sur les {form.n_windows} premieres fenetres
              </Typography>
            </Box>

            <Button fullWidth variant="contained"
              sx={{ mt: 2, height: 44, bgcolor: PWC_COLORS.orange,
                    '&:hover': { bgcolor: PWC_COLORS.orange + 'cc' } }}
              onClick={handleSubmit} disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Predire IV'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Paper>
        </Grid>

        {/* Resultats */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: 500 }}>
            <Typography variant="h4" gutterBottom>
              Predictions par modele
              {result && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  — {form.n_windows} fenetres
                </Typography>
              )}
            </Typography>

            {!result && (
              <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>Lancez une prediction pour voir les resultats.</Typography>
              </Box>
            )}

            {result && (
              <>
                {invalidPreds.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {invalidPreds.length} modele(s) avec valeurs aberrantes exclus du graphique :
                    {invalidPreds.map(([n]) => ` ${n}`).join(',')}
                  </Alert>
                )}

                {validPreds.length > 0 && (
                  <Box sx={{ height: 320, mb: 2 }}>
                    <Plot
                      data={[{
                        type: 'bar',
                        x: validPreds.map(([n]) => n),
                        y: validPreds.map(([, v]) => v),
                        marker: { color: validPreds.map(([, v]) =>
                          v < 0.15 ? PWC_COLORS.orange :
                          v < 0.25 ? '#EF9F27' : '#D85A30'
                        )},
                        text: validPreds.map(([, v]) => (v * 100).toFixed(2) + '%'),
                        textposition: 'outside',
                      }]}
                      layout={{
                        autosize: true,
                        yaxis: { title: 'IV predite', tickformat: '.1%' },
                        xaxis: { tickangle: -30 },
                        margin: { t: 20, l: 60, r: 20, b: 80 },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                      }}
                      config={{ displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Box>
                )}

                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: PWC_COLORS.orange + '10' }}>
                      <TableCell><strong>Modele</strong></TableCell>
                      <TableCell align="right"><strong>IV predite</strong></TableCell>
                      <TableCell align="right"><strong>%</strong></TableCell>
                      <TableCell align="right"><strong>RMSE moy ({form.n_windows} fen.)</strong></TableCell>
                      <TableCell align="right"><strong>Statut</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedPreds.map(([name, val]) => {
                      const rmse = result.rmse_by_window?.[name];
                      const valid = val > 0 && val < 2.0;
                      return (
                        <TableRow key={name}
                          sx={{ opacity: valid ? 1 : 0.4,
                                bgcolor: valid && val === validPreds[0]?.[1]
                                  ? PWC_COLORS.orange + '15' : 'inherit' }}>
                          <TableCell>{name} {valid && val === validPreds[0]?.[1] && '🏆'}</TableCell>
                          <TableCell align="right"
                            sx={{ color: valid ? 'inherit' : 'error.main', fontWeight: valid ? 400 : 600 }}>
                            {val.toFixed(5)}
                          </TableCell>
                          <TableCell align="right">{(val * 100).toFixed(2)}%</TableCell>
                          <TableCell align="right">
                            {rmse != null
                              ? <Chip label={rmse.toFixed(4)} size="small"
                                  sx={{ bgcolor: rmse < 0.015
                                    ? '#E1F5EE' : rmse < 0.025
                                    ? '#FAEEDA' : '#FCEBEB',
                                    color: rmse < 0.015
                                    ? '#0F6E56' : rmse < 0.025
                                    ? '#854F0B' : '#A32D2D',
                                    fontSize: 11 }} />
                              : <Typography variant="caption" color="text.secondary">—</Typography>
                            }
                          </TableCell>
                          <TableCell align="right">
                            {valid
                              ? <Chip label="OK" size="small" color="success" />
                              : <Chip label="Aberrant" size="small" color="error" />
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
"""

with open('/app/../../../frontend/src/pages/PredictIV.jsx', 'w') as f:
    f.write(new_content)
print('PredictIV.jsx reecrit')

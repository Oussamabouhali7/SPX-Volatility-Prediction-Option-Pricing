// pages/Surface.jsx — Nappe observée + prédiction future ML/DL
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Grid, MenuItem, TextField, Typography, Alert,
  CircularProgress, Tabs, Tab, Button, Divider,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { PWC_COLORS } from '../theme/pwcTheme';
import api from '../api/client';

const MODELS = ['Lasso','Ridge','RandomForest','XGBoost','SVR','MLP','LSTM','GRU','BiLSTM','BiRNN','CNN','Transformer'];

function Surface3D({ tenors, moneyness, z, title, colorscale }) {
  if (!z || !tenors || !moneyness) return null;
  return (
    <Plot
      data={[{
        type: 'surface', x: moneyness, y: tenors, z,
        colorscale: colorscale || 'Viridis',
        contours: { z: { show: true, usecolormap: true, project: { z: true } } },
        hovertemplate: 'Moneyness: %{x}<br>Tenor: %{y}j<br>IV: %{z:.4f}<extra></extra>',
      }]}
      layout={{
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        title: { text: title, font: { size: 13 } },
        height: 420, margin: { l: 0, r: 0, t: 40, b: 0 },
        scene: {
          xaxis: { title: 'Moneyness (K/S-1)x100' },
          yaxis: { title: 'Maturite (jours)' },
          zaxis: { title: 'IV' },
          camera: { eye: { x: 1.6, y: -1.5, z: 0.8 } },
        },
      }}
      config={{ responsive: true, displayModeBar: true }}
      style={{ width: '100%' }}
    />
  );
}

export default function Surface() {
  const [tab, setTab] = useState(0);
  const [histDates, setHistDates] = useState([]);
  const [histDate, setHistDate] = useState('');
  const [histData, setHistData] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [futureDates, setFutureDates] = useState([]);
  const [futureDate, setFutureDate] = useState('');
  const [futureModel, setFutureModel] = useState('XGBoost');
  const [futureData, setFutureData] = useState(null);
  const [futureLoading, setFutureLoading] = useState(false);
  const [manual, setManual] = useState({ vix: 20, rate: 0.05, forward: 4500, hvol_30: 0.18, hvol_60: 0.17, spx_ret: 0 });
  const [manualModel, setManualModel] = useState('XGBoost');
  const [manualData, setManualData] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/surface/dates').then(r => {
      const arr = r.data.dates || [];
      setHistDates(arr);
      if (arr.length > 0) setHistDate(arr[Math.floor(arr.length / 2)]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/surface/future-dates').then(r => {
      const arr = r.data.dates || [];
      setFutureDates(arr);
      if (arr.length > 0) setFutureDate(arr[Math.floor(arr.length * 0.7)]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!histDate) return;
    const d = histDate.replace(/^\[.*?\]\s*/, '');
    setHistLoading(true); setError('');
    api.get('/surface', { params: { date_obs: d } })
      .then(r => setHistData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur'))
      .finally(() => setHistLoading(false));
  }, [histDate]);

  const loadFuture = () => {
    if (!futureDate) return;
    const d = futureDate.replace(/^\[.*?\]\s*/, '');
    setFutureLoading(true); setError('');
    api.get('/surface/predict-future', { params: { date_obs: d, model_name: futureModel } })
      .then(r => setFutureData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur'))
      .finally(() => setFutureLoading(false));
  };

  const loadManual = () => {
    setManualLoading(true); setError('');
    api.post('/surface/predict-manual', { ...manual, model_name: manualModel })
      .then(r => setManualData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur'))
      .finally(() => setManualLoading(false));
  };

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Nappe de volatilite</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        3 modes : nappe historique observée · prédiction future par ML/DL · prédiction manuelle
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root.Mui-selected': { color: PWC_COLORS.orange }, '& .MuiTabs-indicator': { bgcolor: PWC_COLORS.orange } }}>
        <Tab label="Nappe observée (historique)" />
        <Tab label="Prédiction future (par date)" />
        <Tab label="Prédiction manuelle" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Nappe observée</Typography>
          <TextField select fullWidth label="Date d'observation" value={histDate}
            onChange={e => setHistDate(e.target.value)} sx={{ mb: 3 }} size="small">
            {histDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          {histLoading && <CircularProgress sx={{ color: PWC_COLORS.orange }} />}
          {histData && (
            <Surface3D tenors={histData.tenors} moneyness={histData.moneyness}
              z={histData.z_observed} title="Nappe observée" colorscale="Viridis" />
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Prédiction future</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choisissez une date et un modele ML/DL pour prédire la nappe complete.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={8}>
              <TextField select fullWidth label="Date de prediction" value={futureDate}
                onChange={e => setFutureDate(e.target.value)} size="small">
                {futureDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Modele" value={futureModel}
                onChange={e => setFutureModel(e.target.value)} size="small">
                {MODELS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          <Button variant="contained" onClick={loadFuture} disabled={futureLoading}
            sx={{ bgcolor: PWC_COLORS.orange, mb: 3 }}>
            {futureLoading ? <CircularProgress size={20} color="inherit" /> : 'Prédire la nappe'}
          </Button>
          {futureData && (
            <Box>
              {futureData.market_info && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {[
                    { label: 'VIX', value: futureData.market_info.vix?.toFixed(2) },
                    { label: 'Taux', value: futureData.market_info.rate?.toFixed(4) },
                    { label: 'Forward', value: futureData.market_info.forward?.toFixed(0) },
                  ].map(item => item.value && (
                    <Grid item key={item.label}>
                      <Paper sx={{ p: 1.5, textAlign: 'center', minWidth: 100, borderTop: `3px solid ${PWC_COLORS.orange}` }}>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="subtitle1" fontWeight={700}>{item.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
              <Surface3D tenors={futureData.tenors} moneyness={futureData.moneyness}
                z={futureData.z_predicted}
                title={`Nappe prédite - ${futureData.model_name} - ${futureData.date_obs}`}
                colorscale="RdBu" />
            </Box>
          )}
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Prédiction manuelle</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { key: 'vix', label: 'VIX', step: 0.5 },
              { key: 'rate', label: 'Taux sans risque', step: 0.001 },
              { key: 'forward', label: 'Forward SPX', step: 10 },
              { key: 'hvol_30', label: 'HVol 30j', step: 0.01 },
              { key: 'hvol_60', label: 'HVol 60j', step: 0.01 },
              { key: 'spx_ret', label: 'Rendement SPX', step: 0.001 },
            ].map(f => (
              <Grid item xs={12} sm={4} key={f.key}>
                <TextField fullWidth label={f.label} type="number"
                  value={manual[f.key]} size="small" inputProps={{ step: f.step }}
                  onChange={e => setManual(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))} />
              </Grid>
            ))}
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth label="Modele" value={manualModel}
                onChange={e => setManualModel(e.target.value)} size="small">
                {MODELS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          <Grid container spacing={1} sx={{ mb: 3 }}>
            {[
              { label: 'Normal (VIX=18)', vals: { vix: 18, rate: 0.05, hvol_30: 0.15, hvol_60: 0.14 } },
              { label: 'Stress (VIX=35)', vals: { vix: 35, rate: 0.03, hvol_30: 0.30, hvol_60: 0.28 } },
              { label: 'Crise (VIX=60)', vals: { vix: 60, rate: 0.01, hvol_30: 0.55, hvol_60: 0.50 } },
            ].map(s => (
              <Grid item key={s.label}>
                <Button variant="outlined" size="small"
                  sx={{ borderColor: PWC_COLORS.orange, color: PWC_COLORS.orange }}
                  onClick={() => setManual(p => ({ ...p, ...s.vals }))}>
                  {s.label}
                </Button>
              </Grid>
            ))}
          </Grid>
          <Button variant="contained" onClick={loadManual} disabled={manualLoading}
            sx={{ bgcolor: PWC_COLORS.orange, mb: 3 }}>
            {manualLoading ? <CircularProgress size={20} color="inherit" /> : 'Generer la nappe'}
          </Button>
          {manualData && (
            <Surface3D tenors={manualData.tenors} moneyness={manualData.moneyness}
              z={manualData.z_predicted}
              title={`Nappe simulee - ${manualData.model_name} - VIX=${manual.vix}`}
              colorscale="Plasma" />
          )}
        </Paper>
      )}
    </Box>
  );
}
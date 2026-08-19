// pages/Pricing.jsx — deux sous-onglets : ML et Manuel
import React, { useState } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, MenuItem,
  Card, CardContent, Alert, CircularProgress, Chip, Tabs, Tab, Divider,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { priceOption } from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';

// ─── Carte métrique ────────────────────────────────────────────────────────
const Metric = ({ label, value, color = '#555', sub }) => (
  <Card sx={{ borderLeft: `4px solid ${color}` }}>
    <CardContent sx={{ py: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ color, mt: 0.5, fontWeight: 700 }}>
        {typeof value === 'number' ? value.toFixed(4) : value}
      </Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </CardContent>
  </Card>
);

// ─── Bloc Greeks commun ────────────────────────────────────────────────────
const Greeks = ({ greeks }) => (
  <>
    <Typography variant="h4" gutterBottom sx={{ mt: 3 }}>Greeks (Black-Scholes)</Typography>
    <Grid container spacing={2}>
      {[
        { key: 'delta', sym: 'Δ', color: '#185FA5' },
        { key: 'gamma', sym: 'Γ', color: '#7B68EE' },
        { key: 'vega',  sym: 'ν', color: PWC_COLORS.orange },
        { key: 'theta', sym: 'Θ', color: '#D85A30' },
        { key: 'rho',   sym: 'ρ', color: '#1D9E75' },
      ].map(g => greeks[g.key] !== undefined && (
        <Grid item xs={6} sm={2.4} key={g.key}>
          <Paper sx={{ p: 1.5, borderTop: `3px solid ${g.color}`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
              {g.sym} {g.key.toUpperCase()}
            </Typography>
            <Typography sx={{ fontWeight: 800, color: g.color, fontSize: '1.1rem' }}>
              {greeks[g.key].toFixed(4)}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  </>
);

// ─── Champs communs ────────────────────────────────────────────────────────
const CommonFields = ({ form, onChange }) => (
  <>
    <TextField fullWidth select margin="dense" label="Type d'option"
      value={form.option_type} onChange={onChange('option_type', false)}>
      <MenuItem value="C">Call</MenuItem>
      <MenuItem value="P">Put</MenuItem>
    </TextField>
    <TextField fullWidth label="Spot S (cours SPX)" type="number" margin="dense"
      value={form.spot} onChange={onChange('spot')} />
    <TextField fullWidth label="Strike K (prix d'exercice)" type="number" margin="dense"
      value={form.strike} onChange={onChange('strike')} />
    <TextField fullWidth label="Maturité (jours)" type="number" margin="dense"
      value={form.maturity_days} onChange={onChange('maturity_days')} />
    <TextField fullWidth label="Taux sans risque r" type="number" margin="dense"
      value={form.rate} onChange={onChange('rate')} inputProps={{ step: 0.005 }} />
    <TextField fullWidth label="Dividende q" type="number" margin="dense"
      value={form.dividend} onChange={onChange('dividend')} inputProps={{ step: 0.001 }} />
  </>
);

// ══════════════════════════════════════════════════════════════════════════
export default function Pricing() {
  const [subTab, setSubTab] = useState(0);

  // ── Formulaire onglet ML ─────────────────────────────────────────────
  const [mlForm, setMlForm] = useState({
    spot: 4500, strike: 4500, maturity_days: 91,
    rate: 0.04, dividend: 0.0,
    option_type: 'C', model_name: 'Lasso',
    n_paths_mc: 100000,
  });
  const [mlResult,  setMlResult]  = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError,   setMlError]   = useState('');

  // ── Formulaire onglet Manuel ─────────────────────────────────────────
  const [manForm, setManForm] = useState({
    spot: 4500, strike: 4500, maturity_days: 91,
    rate: 0.04, dividend: 0.0,
    option_type: 'C', sigma: 0.20,
    n_paths_mc: 100000,
  });
  const [manResult,  setManResult]  = useState(null);
  const [manLoading, setManLoading] = useState(false);
  const [manError,   setManError]   = useState('');

  // ── Handlers génériques ──────────────────────────────────────────────
  const mkChange = (setForm) => (key, isFloat = true) => (e) =>
    setForm(f => ({ ...f, [key]: isFloat ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value }));

  const onMlChange  = mkChange(setMlForm);
  const onManChange = mkChange(setManForm);

  // ── Submit ML ────────────────────────────────────────────────────────
  const submitML = async () => {
    setMlError(''); setMlLoading(true);
    try {
      const data = await priceOption({ ...mlForm, sigma: null });
      setMlResult(data);
    } catch (e) { setMlError(e.response?.data?.detail || 'Erreur'); }
    finally { setMlLoading(false); }
  };

  // ── Submit Manuel ────────────────────────────────────────────────────
  const submitMan = async () => {
    setManError(''); setManLoading(true);
    try {
      const data = await priceOption({ ...manForm, sigma: parseFloat(manForm.sigma), model_name: 'Lasso' });
      setManResult(data);
    } catch (e) { setManError(e.response?.data?.detail || 'Erreur'); }
    finally { setManLoading(false); }
  };

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Pricing d'option vanille</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Choisissez le mode de calcul : avec volatilité prédite par ML, ou en saisissant σ manuellement.
      </Typography>

      <Tabs
        value={subTab}
        onChange={(_, v) => setSubTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root.Mui-selected': { color: PWC_COLORS.orange },
          '& .MuiTabs-indicator': { bgcolor: PWC_COLORS.orange },
        }}
      >
        <Tab label="Calcul avec ML — σ prédite par les modèles" />
        <Tab label="Calcul manuel — σ saisie manuellement" />
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════
          SOUS-ONGLET 1 — CALCUL ML
      ══════════════════════════════════════════════════════════════════ */}
      {subTab === 0 && (
        <Grid container spacing={3}>

          {/* Formulaire ML */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h4" gutterBottom>Paramètres du contrat</Typography>
              <CommonFields form={mlForm} onChange={onMlChange} />
              <TextField fullWidth select margin="dense" label="Modèle ML pour prédire σ"
                value={mlForm.model_name} onChange={onMlChange('model_name', false)}>
                {['Lasso','Ridge','RandomForest','XGBoost','SVR',
                  'MLP','LSTM','GRU','BiLSTM','BiRNN','CNN','Transformer'].map(m =>
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                )}
              </TextField>

              {/* Pipeline résumé */}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FFF8F2', borderRadius: 1,
                         border: `1px solid ${PWC_COLORS.orange}44` }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: PWC_COLORS.orange, display: 'block', mb: 0.5 }}>
                  Comment ça marche ?
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  1. Les paramètres → <strong>27 features</strong><br />
                  2. StandardScaler normalise les features<br />
                  3. <strong>{mlForm.model_name}</strong> prédit σ (IV)<br />
                  4. Black-Scholes(S, K, T, r, <strong>σ_ML</strong>) → Prix<br />
                  5. Monte Carlo confirme avec 100 000 simulations
                </Typography>
              </Box>

              <Button fullWidth variant="contained"
                sx={{ mt: 2, height: 48, bgcolor: PWC_COLORS.orange, '&:hover': { bgcolor: '#B85520' } }}
                onClick={submitML} disabled={mlLoading}>
                {mlLoading ? <CircularProgress size={20} color="inherit" /> : '▶  Calculer avec ML'}
              </Button>
              {mlError && <Alert severity="error" sx={{ mt: 2 }}>{mlError}</Alert>}
            </Paper>
          </Grid>

          {/* Résultats ML */}
          <Grid item xs={12} md={8}>
            {!mlResult ? (
              <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed #ddd' }}>
                <Typography color="text.secondary">
                  Sélectionnez un modèle ML et cliquez sur <strong>Calculer avec ML</strong>.
                  <br />Le modèle prédit d'abord σ, puis Black-Scholes calcule le prix.
                </Typography>
              </Paper>
            ) : (
              <>
                {/* σ prédite */}
                <Paper sx={{ p: 2.5, mb: 2.5, borderLeft: `4px solid ${PWC_COLORS.orange}`,
                             bgcolor: '#FFF8F2' }}>
                  <Typography variant="caption" color="text.secondary">
                    Étape 1 — σ prédite par <strong>{mlForm.model_name}</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 0.5 }}>
                    <Typography variant="h2" sx={{ color: PWC_COLORS.orange, fontWeight: 800 }}>
                      σ = {mlResult.sigma_used.toFixed(4)}
                    </Typography>
                    <Typography variant="h4" sx={{ color: PWC_COLORS.orange }}>
                      ({(mlResult.sigma_used * 100).toFixed(2)} %)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Cette volatilité implicite prédite par le modèle ML est passée à Black-Scholes.
                  </Typography>
                </Paper>

                {/* Prix BS + MC */}
                <Typography variant="h4" gutterBottom>
                  Étape 2 — Prix calculé par Black-Scholes & Monte Carlo
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Prix Black-Scholes" value={mlResult.bs_price}
                      color="#1D9E75"
                      sub={`BS(${mlForm.spot}, ${mlForm.strike}, σ=${mlResult.sigma_used.toFixed(4)})`} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Prix Monte Carlo" value={mlResult.mc_price}
                      color="#185FA5"
                      sub={`± ${(1.96 * mlResult.mc_stderr).toFixed(4)} (IC 95 %)`} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Écart BS − MC" value={Math.abs(mlResult.bs_price - mlResult.mc_price)}
                      color="#888"
                      sub="≈ 0 attendu si σ constant" />
                  </Grid>
                </Grid>

                {/* Greeks */}
                <Greeks greeks={mlResult.greeks} />

                {/* Comparaison tous modèles */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="h4" gutterBottom>
                  Comparaison — Prix selon l'IV prédite par chaque modèle
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Chaque barre = BS(σ_ML) avec σ prédite par le modèle correspondant.
                  La barre orange = modèle sélectionné ({mlForm.model_name}).
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <Plot
                    data={[{
                      type: 'bar', orientation: 'h',
                      x: Object.values(mlResult.ml_prices),
                      y: Object.keys(mlResult.ml_prices),
                      marker: {
                        color: Object.keys(mlResult.ml_prices).map(n =>
                          n === mlForm.model_name ? PWC_COLORS.orange : '#185FA5'),
                        opacity: Object.keys(mlResult.ml_prices).map(n =>
                          n === mlForm.model_name ? 1 : 0.55),
                      },
                      text: Object.values(mlResult.ml_prices).map(v => v.toFixed(3)),
                      textposition: 'outside',
                      hovertemplate: '<b>%{y}</b><br>Prix = $%{x:.4f}<extra></extra>',
                    }]}
                    layout={{
                      autosize: true, height: 380,
                      xaxis: { title: "Prix de l'option ($)" },
                      margin: { t: 20, l: 130, r: 80, b: 50 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      shapes: [{
                        type: 'line',
                        x0: mlResult.bs_price, x1: mlResult.bs_price,
                        yref: 'paper', y0: 0, y1: 1,
                        line: { color: '#1D9E75', dash: 'dot', width: 2 },
                      }],
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </Paper>
              </>
            )}
          </Grid>
        </Grid>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SOUS-ONGLET 2 — CALCUL MANUEL
      ══════════════════════════════════════════════════════════════════ */}
      {subTab === 1 && (
        <Grid container spacing={3}>

          {/* Formulaire Manuel */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h4" gutterBottom>Paramètres du contrat</Typography>
              <CommonFields form={manForm} onChange={onManChange} />

              {/* Sigma manuel — champ mis en avant */}
              <Box sx={{ mt: 1.5, mb: 0.5, p: 2, bgcolor: '#EAF7F3',
                         borderRadius: 1, border: '2px solid #1D9E7555' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#1D9E75', display: 'block', mb: 0.5 }}>
                  σ — Volatilité implicite (saisie manuelle)
                </Typography>
                <TextField fullWidth label="σ (ex : 0.20 = 20 %)" type="number"
                  value={manForm.sigma} onChange={onManChange('sigma')}
                  inputProps={{ step: 0.01, min: 0.001, max: 5 }}
                  size="small" />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Vous fournissez σ directement. Aucun modèle ML n'est utilisé.
                </Typography>
              </Box>

              {/* Pipeline résumé */}
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#EAF7F3', borderRadius: 1,
                         border: '1px solid #1D9E7544' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#1D9E75', display: 'block', mb: 0.5 }}>
                  Comment ça marche ?
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  1. Vous saisissez σ = <strong>{parseFloat(manForm.sigma || 0).toFixed(2)}</strong><br />
                  2. Black-Scholes(S, K, T, r, <strong>σ</strong>) → Prix analytique<br />
                  3. Monte Carlo simule 100 000 trajectoires avec ce même σ
                </Typography>
              </Box>

              <Button fullWidth variant="contained"
                sx={{ mt: 2, height: 48, bgcolor: '#1D9E75', '&:hover': { bgcolor: '#156B50' } }}
                onClick={submitMan} disabled={manLoading || !manForm.sigma}>
                {manLoading ? <CircularProgress size={20} color="inherit" /> : '▶  Calculer sans ML'}
              </Button>
              {manError && <Alert severity="error" sx={{ mt: 2 }}>{manError}</Alert>}
            </Paper>
          </Grid>

          {/* Résultats Manuel */}
          <Grid item xs={12} md={8}>
            {!manResult ? (
              <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed #ddd' }}>
                <Typography color="text.secondary">
                  Saisissez σ manuellement et cliquez sur <strong>Calculer sans ML</strong>.
                  <br />Black-Scholes et Monte Carlo utiliseront directement cette valeur.
                </Typography>
              </Paper>
            ) : (
              <>
                {/* Récapitulatif σ utilisé */}
                <Paper sx={{ p: 2.5, mb: 2.5, borderLeft: '4px solid #1D9E75', bgcolor: '#EAF7F3' }}>
                  <Typography variant="caption" color="text.secondary">
                    σ saisie manuellement — aucun ML impliqué
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 0.5 }}>
                    <Typography variant="h2" sx={{ color: '#1D9E75', fontWeight: 800 }}>
                      σ = {manResult.sigma_used.toFixed(4)}
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#1D9E75' }}>
                      ({(manResult.sigma_used * 100).toFixed(2)} %)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Formule utilisée : {manForm.option_type === 'C'
                      ? `C = S·N(d₁) − K·e^(−rT)·N(d₂)`
                      : `P = K·e^(−rT)·N(−d₂) − S·N(−d₁)`}
                    , avec S={manForm.spot}, K={manForm.strike}, T={manForm.maturity_days}j, r={manForm.rate}
                  </Typography>
                </Paper>

                {/* Prix */}
                <Typography variant="h4" gutterBottom>Prix calculé</Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Prix Black-Scholes" value={manResult.bs_price}
                      color="#1D9E75"
                      sub="Formule analytique exacte" />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Prix Monte Carlo" value={manResult.mc_price}
                      color="#185FA5"
                      sub={`± ${(1.96 * manResult.mc_stderr).toFixed(4)} (IC 95 %)`} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Metric label="Écart BS − MC" value={Math.abs(manResult.bs_price - manResult.mc_price)}
                      color="#888"
                      sub="Devrait être ≈ 0" />
                  </Grid>
                </Grid>

                {/* Greeks */}
                <Greeks greeks={manResult.greeks} />

                {/* Sensibilité au sigma */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="h4" gutterBottom>
                  Sensibilité du prix à σ — smile de volatilité
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Prix de l'option pour différentes valeurs de σ autour de votre saisie
                  (S={manForm.spot}, K={manForm.strike}, T={manForm.maturity_days}j).
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <Plot
                    data={(() => {
                      const S = manForm.spot, K = manForm.strike;
                      const T = manForm.maturity_days / 365;
                      const r = manForm.rate, q = manForm.dividend;
                      const sigmas = Array.from({ length: 40 }, (_, i) => 0.05 + i * 0.025);
                      // Approximation BS inline (sans appel API)
                      const bsApprox = (sig) => {
                        const d1 = (Math.log(S / K) + (r - q + sig * sig / 2) * T) / (sig * Math.sqrt(T));
                        const d2 = d1 - sig * Math.sqrt(T);
                        const N = (x) => {
                          const t = 1 / (1 + 0.2316419 * Math.abs(x));
                          const d = 0.3989423 * Math.exp(-x * x / 2);
                          const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
                          return x >= 0 ? 1 - p : p;
                        };
                        return manForm.option_type === 'C'
                          ? S * Math.exp(-q * T) * N(d1) - K * Math.exp(-r * T) * N(d2)
                          : K * Math.exp(-r * T) * N(-d2) - S * Math.exp(-q * T) * N(-d1);
                      };
                      return [{
                        type: 'scatter', mode: 'lines',
                        x: sigmas,
                        y: sigmas.map(s => bsApprox(s)),
                        line: { color: '#185FA5', width: 2 },
                        name: 'Prix BS(σ)',
                        hovertemplate: 'σ = %{x:.2f}<br>Prix = $%{y:.4f}<extra></extra>',
                      }, {
                        type: 'scatter', mode: 'markers',
                        x: [manResult.sigma_used],
                        y: [manResult.bs_price],
                        marker: { color: '#1D9E75', size: 12, symbol: 'diamond' },
                        name: `Votre σ = ${manResult.sigma_used.toFixed(4)}`,
                        hovertemplate: `Votre σ = ${manResult.sigma_used.toFixed(4)}<br>Prix = $${manResult.bs_price.toFixed(4)}<extra></extra>`,
                      }];
                    })()}
                    layout={{
                      autosize: true, height: 320,
                      xaxis: { title: 'σ (volatilité implicite)', tickformat: '.0%' },
                      yaxis: { title: "Prix de l'option ($)" },
                      margin: { t: 20, l: 70, r: 30, b: 60 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      legend: { orientation: 'h', y: -0.3 },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </Paper>
              </>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}







// pages/Pricing.jsx — Onglet 2 : Black-Scholes + Monte Carlo + ML pricing + Greeks
/*
import React, { useState } from 'react';
import {
  Box, Paper, Grid, TextField, Button, Typography, MenuItem,
  Card, CardContent, Alert, CircularProgress, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { priceOption } from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';


const Metric = ({ label, value, color = PWC_COLORS.greyDark, sub }) => (
  <Card sx={{ borderLeft: `4px solid ${color}` }}>
    <CardContent sx={{ py: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ color, mt: 0.5, fontWeight: 600 }}>
        {typeof value === 'number' ? value.toFixed(4) : value}
      </Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </CardContent>
  </Card>
);


export default function Pricing() {
  const [form, setForm] = useState({
    spot: 4500, strike: 4500, maturity_days: 91,
    rate: 0.04, dividend: 0.0,
    option_type: 'C', sigma: '', model_name: 'XGBoost',
    n_paths_mc: 100000,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const payload = { ...form, sigma: form.sigma === '' ? null : parseFloat(form.sigma) };
      const data = await priceOption(payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de pricing');
    } finally { setLoading(false); }
  };

  const onChange = (key, isFloat = true) => (e) =>
    setForm({ ...form, [key]: isFloat ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value });

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Pricing d'option vanille</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Compare Black-Scholes analytique, Monte Carlo (100k chemins) et les prix dérivés des IV prédites par ML/DL.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Paramètres</Typography>
            <TextField fullWidth select margin="dense" label="Type d'option"
              value={form.option_type} onChange={onChange('option_type', false)}>
              <MenuItem value="C">Call</MenuItem>
              <MenuItem value="P">Put</MenuItem>
            </TextField>
            <TextField fullWidth label="Spot (S)" type="number" margin="dense"
              value={form.spot} onChange={onChange('spot')} />
            <TextField fullWidth label="Strike (K)" type="number" margin="dense"
              value={form.strike} onChange={onChange('strike')} />
            <TextField fullWidth label="Maturité (jours)" type="number" margin="dense"
              value={form.maturity_days} onChange={onChange('maturity_days')} />
            <TextField fullWidth label="Taux sans risque" type="number" margin="dense"
              value={form.rate} onChange={onChange('rate')} inputProps={{ step: 0.005 }} />
            <TextField fullWidth label="Dividende q" type="number" margin="dense"
              value={form.dividend} onChange={onChange('dividend')} inputProps={{ step: 0.001 }} />
            <TextField fullWidth label="Sigma (vide = prédit par IA)" type="number" margin="dense"
              value={form.sigma} onChange={onChange('sigma')}
              inputProps={{ step: 0.01 }} helperText="Laisser vide pour utiliser l'IA" />
            <TextField fullWidth label="Modèle IA" select margin="dense"
              value={form.model_name} onChange={onChange('model_name', false)}>
              {['Lasso','Ridge','RandomForest','XGBoost','SVR',
                'MLP','LSTM','GRU','BiLSTM','BiRNN','CNN','Transformer'].map(m =>
                <MenuItem key={m} value={m}>{m}</MenuItem>
              )}
            </TextField>
            <Button fullWidth variant="contained" sx={{ mt: 2, height: 44 }}
              onClick={handleSubmit} disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit"/> : 'Calculer le prix'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {!result && (
            <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>Lancez un pricing pour voir les résultats.</Typography>
            </Paper>
          )}
          {result && (
            <>
              <Typography variant="h4" gutterBottom>Résultats</Typography>
              <Chip label={`σ utilisée : ${result.sigma_used.toFixed(4)}`}
                    sx={{ mb: 2, bgcolor: PWC_COLORS.orangeLight }} />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Metric label="Black-Scholes" value={result.bs_price}
                          color={PWC_COLORS.orange} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Metric label="Monte Carlo" value={result.mc_price}
                          color={PWC_COLORS.rose}
                          sub={`± ${(1.96 * result.mc_stderr).toFixed(4)} (IC95%)`} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Metric label="Écart BS-MC" value={Math.abs(result.bs_price - result.mc_price)}
                          color={PWC_COLORS.greyMedium} />
                </Grid>
              </Grid>

              <Typography variant="h4" gutterBottom>Greeks (Black-Scholes)</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {Object.entries(result.greeks).map(([k, v]) => (
                  <Grid item xs={6} sm={2.4} key={k}>
                    <Metric label={k.toUpperCase()} value={v} color={PWC_COLORS.orangeDark} />
                  </Grid>
                ))}
              </Grid>

              <Typography variant="h4" gutterBottom>Prix dérivés (IV prédite par modèle)</Typography>
              <Paper sx={{ p: 2 }}>
                <Plot
                  data={[{
                    type: 'bar', orientation: 'h',
                    x: Object.values(result.ml_prices),
                    y: Object.keys(result.ml_prices),
                    marker: { color: PWC_COLORS.orange },
                    text: Object.values(result.ml_prices).map(v => v.toFixed(3)),
                    textposition: 'outside',
                  }]}
                  layout={{
                    title: '', autosize: true, height: 380,
                    xaxis: { title: 'Prix de l\'option' },
                    margin: { t: 20, l: 100, r: 50, b: 50 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                  }}
                  config={{ displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              </Paper>
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}*/

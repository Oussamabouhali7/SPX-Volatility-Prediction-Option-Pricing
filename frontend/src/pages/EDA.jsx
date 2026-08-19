// pages/EDA.jsx — Onglet Exploration des données (EDA)
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Alert, CircularProgress,
  Grid, MenuItem, TextField, Tabs, Tab, Chip,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { PWC_COLORS } from '../theme/pwcTheme';
import api from '../api/client';

// ─── Couleurs par régime ────────────────────────────────────────────────────
const REGIME_COLORS = {
  normal: '#1D9E75',
  stress: '#EF9F27',
  crisis: '#D85A30',
};

// ─── Métadonnées des variables (descriptions + groupes) ────────────────────
const VAR_META = {
  // Cible
  iv: {
    group: 'Cible',
    label: 'Volatilité implicite (IV)',
    desc: "Variable cible du modèle. Mesure la volatilité anticipée par le marché, extraite du prix de l'option via Black-Scholes. Exprimée en valeur annualisée (ex : 0.20 = 20 %). Plus l'IV est élevée, plus le marché anticipe des mouvements importants du sous-jacent.",
  },
  // Géométrie
  moneyness: {
    group: 'Géométrie',
    label: 'Moneyness (K/S − 1)',
    desc: "Position de l'option par rapport au cours spot. Vaut 0 si at-the-money, négatif si put OTM / call ITM, positif si call OTM / put ITM. Calculé comme Strike / Cours SPX − 1. Principal déterminant du smile de volatilité.",
  },
  log_moneyness: {
    group: 'Géométrie',
    label: 'Log-moneyness ln(K/S)',
    desc: "Transformation logarithmique du ratio K/S. Plus symétrique que la moneyness brute autour de l'ATM. Utilisé dans les modèles de smile (SABR, SVI) pour sa meilleure linéarité vis-à-vis de l'IV.",
  },
  moneyness_abs: {
    group: 'Géométrie',
    label: '|Moneyness|',
    desc: "Valeur absolue de la moneyness. Capture la distance au strike ATM indépendamment du sens call ou put. Corrélée positivement avec l'IV : les options très OTM ont une IV plus élevée (smile / skew).",
  },
  moneyness_sq: {
    group: 'Géométrie',
    label: 'Moneyness²',
    desc: "Carré de la moneyness. Terme quadratique capturant la courbure du smile de volatilité (convexité des wings). Permet aux modèles linéaires comme Lasso et Ridge d'apprendre des effets non-linéaires.",
  },
  tenor_d: {
    group: 'Géométrie',
    label: 'Maturité (jours)',
    desc: "Nombre de jours calendaires jusqu'à l'expiration de l'option (date expiry − date cotation). La structure par terme de la volatilité montre généralement une hausse puis une stabilisation de l'IV avec la maturité.",
  },
  log_tenor: {
    group: 'Géométrie',
    label: 'Log-maturité ln(T)',
    desc: "Logarithme du tenor en jours. Transforme la relation non-linéaire entre maturité et IV en relation quasi-linéaire, conformément à la loi de la racine carrée de la volatilité. Feature très discriminante dans tous les modèles.",
  },
  sqrt_tenor: {
    group: 'Géométrie',
    label: '√Maturité',
    desc: "Racine carrée de la maturité en jours. Issue de la théorie du mouvement brownien : la volatilité cumulative croît en √T. Feature complémentaire de log_tenor pour capturer la structure par terme.",
  },
  tenor_years: {
    group: 'Géométrie',
    label: 'Maturité (années)',
    desc: "Maturité exprimée en fraction d'année (tenor_d / 365). Format standard en finance de marché, utilisé directement dans les formules de pricing (Black-Scholes, modèles de taux).",
  },
  mny_x_logt: {
    group: 'Géométrie',
    label: 'Moneyness × log(T)',
    desc: "Terme d'interaction entre la moneyness et la log-maturité. Capture l'aplatissement du smile avec la maturité : l'effet de la moneyness sur l'IV diminue pour les options longues échéances.",
  },
  // Type
  is_call: {
    group: 'Type',
    label: "Type d'option (Call = 1)",
    desc: "Variable indicatrice : 1 si l'option est un Call, 0 si c'est un Put. Avec la parité call-put de Black-Scholes, les IV devraient être identiques, mais des asymétries de marché subsistent en pratique (coût de portage, demande de protection).",
  },
  // Greeks
  delta: {
    group: 'Greeks',
    label: 'Delta (Δ)',
    desc: "Sensibilité du prix de l'option à une variation d'1 € du sous-jacent. Varie de 0 à 1 pour un call (−1 à 0 pour un put). Proxy de la probabilité d'exercice risque-neutre et indicateur de position dans le smile.",
  },
  gamma: {
    group: 'Greeks',
    label: 'Gamma (Γ)',
    desc: "Dérivée seconde du prix par rapport au sous-jacent (vitesse de variation du delta). Maximal pour les options ATM à courte maturité. Lié aux coûts de rebalancement du delta-hedging et à la convexité du payoff.",
  },
  vega: {
    group: 'Greeks',
    label: 'Vega (ν)',
    desc: "Sensibilité du prix de l'option à une variation de 1 % de la volatilité implicite. Maximal pour les options ATM à longue maturité. Feature très corrélée avec IV elle-même ; capture l'exposition au risque de volatilité.",
  },
  theta: {
    group: 'Greeks',
    label: 'Theta (Θ)',
    desc: "Dépréciation temporelle du prix de l'option par jour calendaire écoulé (time decay). Généralement négatif pour les acheteurs. Amplifié pour les options ATM proches de l'expiration ; contrepartie du gamma.",
  },
  // Marché
  vix: {
    group: 'Marché',
    label: 'VIX (CBOE)',
    desc: "Indice de volatilité implicite 30 jours du marché S&P 500 publié par le CBOE. Surnommé 'indice de la peur'. Utilisé comme proxy du régime de volatilité : Normal < 20, Stress 20-35, Crise > 35. Feature la plus corrélée avec l'IV.",
  },
  rate_10y: {
    group: 'Marché',
    label: 'Taux 10 ans US (%)',
    desc: "Rendement du bon du Trésor américain à 10 ans. Taux sans risque de référence dans le pricing Black-Scholes. Son niveau impacte la valeur temps des options et le coût de portage du sous-jacent.",
  },
  close_gspc: {
    group: 'Marché',
    label: 'Cours de clôture SPX',
    desc: "Niveau de clôture de l'indice S&P 500. Sert de sous-jacent S dans le calcul de la moneyness (K/S − 1). Reflète l'état général du marché actions américain et les tendances macroéconomiques.",
  },
  fwd_front: {
    group: 'Marché',
    label: 'Prix forward (front month)',
    desc: "Prix forward de l'échéance la plus proche (front month). Intègre les dividendes anticipés et le taux sans risque. Utilisé à la place du spot dans certains modèles pour corriger le coût de portage.",
  },
  // Volatilité historique
  hvol_10d: {
    group: 'HVol',
    label: 'Volatilité réalisée 10 jours',
    desc: "Volatilité réalisée calculée sur les 10 derniers jours de trading (écart-type annualisé des log-rendements journaliers × √252). Capture les mouvements récents à très court terme ; très réactive aux chocs.",
  },
  hvol_30d: {
    group: 'HVol',
    label: 'Volatilité réalisée 30 jours',
    desc: "Volatilité réalisée sur 30 jours de trading. Horizon de référence des traders et le plus corrélé avec le VIX (qui estime aussi ~30 jours). Meilleur signal de régime pour le pricing des options court terme.",
  },
  hvol_60d: {
    group: 'HVol',
    label: 'Volatilité réalisée 60 jours',
    desc: "Volatilité réalisée sur 60 jours. Filtre les pics ponctuels du HVol 10/30j. Utile pour calibrer les options de maturité 1 à 3 mois. Bon compromis entre réactivité et stabilité du signal.",
  },
  hvol_91d: {
    group: 'HVol',
    label: 'Volatilité réalisée 91 jours',
    desc: "Volatilité réalisée sur un trimestre (~63 jours de trading). Correspond à la maturité trimestrielle des options standardisées. Signal intermédiaire entre court et moyen terme.",
  },
  hvol_182d: {
    group: 'HVol',
    label: 'Volatilité réalisée 182 jours',
    desc: "Volatilité réalisée sur 6 mois. Utile pour les options semestrielles et les stratégies long-vol. Moins réactive aux chocs ponctuels mais capture les tendances de régime persistantes.",
  },
  hvol_365d: {
    group: 'HVol',
    label: 'Volatilité réalisée 365 jours',
    desc: "Volatilité réalisée sur 1 an. Référence pour les options longue maturité (LEAPS). Incorpore les cycles annuels de marché et les effets de régime durable. Stable mais avec un délai de réaction important.",
  },
  hvol_730d: {
    group: 'HVol',
    label: 'Volatilité réalisée 730 jours',
    desc: "Volatilité réalisée sur 2 ans. Feature de très long terme, peu sensible aux chocs récents. Capture les niveaux de volatilité structurelle à l'échelle du cycle économique.",
  },
  // Liquidité
  open_interest: {
    group: 'Liquidité',
    label: 'Open Interest',
    desc: "Nombre total de contrats d'options ouverts (non encore exercés ni clôturés) sur ce strike et cette maturité. Proxy de l'intérêt institutionnel et de la liquidité de l'option. Les strikes à fort OI ont des IV plus fiables.",
  },
  volume: {
    group: 'Liquidité',
    label: 'Volume journalier',
    desc: "Nombre de contrats échangés sur la journée. Indicateur de liquidité et d'activité de couverture. Les options à fort volume ont des bid-ask spreads plus serrés, donc des IV extraites plus précises.",
  },
};

// ─── Couleurs par groupe ───────────────────────────────────────────────────
const GROUP_COLORS = {
  'Cible':      '#D85A30',
  'Géométrie':  '#185FA5',
  'Type':       '#7B68EE',
  'Greeks':     '#1D9E75',
  'Marché':     '#DC6B2F',
  'HVol':       '#E87722',
  'Liquidité':  '#888888',
};

// ─── Composant principal ───────────────────────────────────────────────────
export default function EDA() {
  const [data, setData]         = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(0);
  const [varX, setVarX]         = useState('iv');
  const [varY, setVarY]         = useState('vix');
  const [varHist, setVarHist]   = useState('iv');
  const [varTime, setVarTime]   = useState('iv');
  const [varFilter, setVarFilter] = useState('');

  useEffect(() => {
    api.get('/eda/summary')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur chargement EDA'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress sx={{ color: PWC_COLORS.orange }} />
    </Box>
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data)  return <Alert severity="info">Aucune donnée disponible.</Alert>;

  const { columns, corr_matrix, histograms, boxplots, timeseries, iv_surface, scatter, var_stats } = data;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Exploration des données (EDA)</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Analyse exploratoire du dataset SPX 1996–2023 · {data.n_rows?.toLocaleString()} observations · {data.n_cols} variables
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          '& .MuiTab-root.Mui-selected': { color: PWC_COLORS.orange },
          '& .MuiTabs-indicator': { bgcolor: PWC_COLORS.orange },
        }}
      >
        <Tab label="Matrice de corrélation" />
        <Tab label="Histogrammes" />
        <Tab label="Boxplots régimes" />
        <Tab label="Évolution temporelle" />
        <Tab label="Surface IV" />
        <Tab label="Scatter plots" />
        <Tab label="Dictionnaire des variables" />
      </Tabs>

      {/* ══ MATRICE DE CORRÉLATION ══ */}
      {tab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Matrice de corrélation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Corrélations de Pearson entre les variables numériques. Les valeurs proches de 1 (rouge) indiquent une forte corrélation positive, proches de -1 (bleu) une forte corrélation négative.
          </Typography>
          <Plot
            data={[{
              type: 'heatmap',
              z: corr_matrix.values,
              x: corr_matrix.columns,
              y: corr_matrix.columns,
              colorscale: [[0, '#185FA5'], [0.5, '#ffffff'], [1, '#D85A30']],
              zmin: -1, zmax: 1,
              text: corr_matrix.values.map(row => row.map(v => v.toFixed(2))),
              texttemplate: '%{text}',
              textfont: { size: 9 },
              hovertemplate: '%{x} × %{y}<br>Corrélation: %{z:.3f}<extra></extra>',
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor:  'rgba(0,0,0,0)',
              margin: { l: 120, r: 20, t: 20, b: 120 },
              height: 600,
              xaxis: { tickangle: -45, tickfont: { size: 10 } },
              yaxis: { tickfont: { size: 10 } },
              colorbar: { title: 'Corrélation' },
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </Paper>
      )}

      {/* ══ HISTOGRAMMES ══ */}
      {tab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Distribution des variables</Typography>
          <TextField
            select label="Variable" value={varHist}
            onChange={e => setVarHist(e.target.value)}
            sx={{ mb: 3, minWidth: 200 }} size="small"
          >
            {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          {histograms[varHist] && (
            <Plot
              data={[{
                type: 'histogram',
                x: histograms[varHist].values,
                nbinsx: 60,
                marker: { color: PWC_COLORS.orange, opacity: 0.8 },
                name: varHist,
              }]}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 400,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: varHist },
                yaxis: { title: 'Fréquence' },
                bargap: 0.02,
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
          )}
          {histograms[varHist] && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {Object.entries(histograms[varHist].stats || {}).map(([k, v]) => (
                <Grid item key={k}>
                  <Chip
                    label={`${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`}
                    variant="outlined" size="small"
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      {/* ══ BOXPLOTS PAR RÉGIME ══ */}
      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Boxplots par régime de volatilité</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Régime Normal (VIX &lt; 20) · Régime Stress (20 ≤ VIX &lt; 35) · Régime Crise (VIX ≥ 35)
          </Typography>
          <Grid container spacing={3}>
            {boxplots.map((bp, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{bp.variable}</Typography>
                <Plot
                  data={['normal', 'stress', 'crisis'].map(regime => ({
                    type: 'box',
                    y: bp[regime],
                    name: regime.charAt(0).toUpperCase() + regime.slice(1),
                    marker: { color: REGIME_COLORS[regime] },
                    boxpoints: false,
                  }))}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor:  'rgba(0,0,0,0)',
                    height: 300,
                    margin: { l: 50, r: 10, t: 10, b: 40 },
                    showlegend: idx === 0,
                    yaxis: { title: bp.variable },
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* ══ ÉVOLUTION TEMPORELLE ══ */}
      {tab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Évolution temporelle</Typography>
          <TextField
            select label="Variable" value={varTime}
            onChange={e => setVarTime(e.target.value)}
            sx={{ mb: 3, minWidth: 200 }} size="small"
          >
            {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          {timeseries[varTime] && (
            <Plot
              data={[
                {
                  type: 'scatter', mode: 'lines',
                  x: timeseries[varTime].dates,
                  y: timeseries[varTime].values,
                  name: varTime,
                  line: { color: PWC_COLORS.orange, width: 1 },
                },
                ...(timeseries[varTime].crisis_zones || []).map(z => ({
                  type: 'scatter', mode: 'none',
                  x: [z.start, z.start, z.end, z.end],
                  y: [z.ymin, z.ymax, z.ymax, z.ymin],
                  fill: 'toself',
                  fillcolor: 'rgba(216,90,48,0.15)',
                  line: { width: 0 },
                  name: z.label,
                  showlegend: true,
                })),
              ]}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 420,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: 'Date', rangeslider: { visible: true } },
                yaxis: { title: varTime },
                legend: { orientation: 'h', y: -0.3 },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%' }}
            />
          )}
        </Paper>
      )}

      {/* ══ SURFACE IV ══ */}
      {tab === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Distribution IV par maturité et moneyness</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>IV médiane par maturité</Typography>
              <Plot
                data={[{
                  type: 'bar',
                  x: iv_surface.tenors,
                  y: iv_surface.median_by_tenor,
                  marker: { color: PWC_COLORS.orange },
                  name: 'IV médiane',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 300,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Maturité (jours)' },
                  yaxis: { title: 'IV médiane' },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>IV médiane par moneyness</Typography>
              <Plot
                data={[{
                  type: 'scatter', mode: 'lines+markers',
                  x: iv_surface.moneyness,
                  y: iv_surface.median_by_moneyness,
                  line: { color: '#185FA5', width: 2 },
                  marker: { color: PWC_COLORS.orange, size: 6 },
                  name: 'IV médiane',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 300,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Moneyness (K/S - 1)' },
                  yaxis: { title: 'IV médiane' },
                  shapes: [{
                    type: 'line', x0: 0, x1: 0,
                    yref: 'paper', y0: 0, y1: 1,
                    line: { dash: 'dot', color: '#999', width: 1 },
                  }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Heatmap IV moyenne (Maturité × Moneyness)</Typography>
              <Plot
                data={[{
                  type: 'heatmap',
                  z: iv_surface.heatmap_z,
                  x: iv_surface.moneyness,
                  y: iv_surface.tenors,
                  colorscale: 'Viridis',
                  hovertemplate: 'Moneyness: %{x}<br>Maturité: %{y}j<br>IV: %{z:.4f}<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 350,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Moneyness' },
                  yaxis: { title: 'Maturité (jours)' },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ══ SCATTER PLOTS ══ */}
      {tab === 5 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Scatter plots</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item>
              <TextField
                select label="Variable X" value={varX}
                onChange={e => setVarX(e.target.value)}
                sx={{ minWidth: 180 }} size="small"
              >
                {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item>
              <TextField
                select label="Variable Y" value={varY}
                onChange={e => setVarY(e.target.value)}
                sx={{ minWidth: 180 }} size="small"
              >
                {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          {scatter[`${varX}_${varY}`] && (
            <Plot
              data={['normal', 'stress', 'crisis'].map(regime => ({
                type: 'scatter', mode: 'markers',
                x: scatter[`${varX}_${varY}`][regime]?.x || [],
                y: scatter[`${varX}_${varY}`][regime]?.y || [],
                name: regime.charAt(0).toUpperCase() + regime.slice(1),
                marker: { color: REGIME_COLORS[regime], size: 3, opacity: 0.6 },
              }))}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 500,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: varX },
                yaxis: { title: varY },
                legend: { orientation: 'h', y: -0.15 },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%' }}
            />
          )}
        </Paper>
      )}

      {/* ══ DICTIONNAIRE DES VARIABLES ══ */}
      {tab === 6 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Dictionnaire des variables</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Statistiques descriptives et description métier des {var_stats?.length ?? 28} variables
            (27 features + cible IV) calculées sur l'ensemble des {data.n_rows?.toLocaleString()} observations
            du dataset SPX 1996–2023.
          </Typography>

          {/* Légende des groupes */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {Object.entries(GROUP_COLORS).map(([group, color]) => (
              <Chip
                key={group}
                label={group}
                size="small"
                sx={{
                  bgcolor: color + '22',
                  color,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: `1px solid ${color}55`,
                }}
              />
            ))}
          </Box>

          {/* Barre de recherche */}
          <TextField
            size="small"
            placeholder="Filtrer par nom de variable, groupe ou description…"
            value={varFilter}
            onChange={e => setVarFilter(e.target.value.toLowerCase())}
            sx={{ mb: 2, width: 420 }}
          />

          {/* Tableau */}
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {[
                    'Variable', 'Groupe', 'Description',
                    'Obs.', 'Manq.',
                    'Moyenne', 'Écart-type',
                    'Min', 'Q25', 'Médiane', 'Q75', 'Max',
                    'Asymétrie',
                  ].map(col => (
                    <TableCell
                      key={col}
                      align={['Variable', 'Groupe', 'Description'].includes(col) ? 'left' : 'right'}
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#FFF0E8',
                        color: PWC_COLORS.orange,
                        fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                        borderBottom: `2px solid ${PWC_COLORS.orange}`,
                      }}
                    >
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {(var_stats || [])
                  .filter(row => {
                    if (!varFilter) return true;
                    const meta = VAR_META[row.variable] || {};
                    return (
                      row.variable.toLowerCase().includes(varFilter) ||
                      (meta.group  || '').toLowerCase().includes(varFilter) ||
                      (meta.label  || '').toLowerCase().includes(varFilter) ||
                      (meta.desc   || '').toLowerCase().includes(varFilter)
                    );
                  })
                  .map((row, i) => {
                    const meta  = VAR_META[row.variable] || {
                      group: '—',
                      label: row.variable,
                      desc:  '—',
                    };
                    const color = GROUP_COLORS[meta.group] || '#888';
                    const fmt   = (v, d = 4) =>
                      v == null ? '—' : Number(v).toFixed(d);

                    return (
                      <TableRow
                        key={row.variable}
                        sx={{
                          bgcolor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.018)',
                          '&:hover': { bgcolor: `${PWC_COLORS.orange}0f` },
                          verticalAlign: 'top',
                        }}
                      >
                        {/* Nom + label */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color,
                              fontSize: '0.82rem',
                              display: 'block',
                            }}
                          >
                            {row.variable}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontSize: '0.68rem', lineHeight: 1.3 }}
                          >
                            {meta.label}
                          </Typography>
                        </TableCell>

                        {/* Groupe */}
                        <TableCell sx={{ minWidth: 100 }}>
                          <Chip
                            label={meta.group}
                            size="small"
                            sx={{
                              bgcolor: color + '22',
                              color,
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              border: `1px solid ${color}55`,
                              height: 20,
                            }}
                          />
                        </TableCell>

                        {/* Description */}
                        <TableCell sx={{ minWidth: 320, maxWidth: 400 }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', lineHeight: 1.55, fontSize: '0.75rem' }}
                          >
                            {meta.desc}
                          </Typography>
                        </TableCell>

                        {/* Statistiques */}
                        <TableCell align="right">
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {row.count?.toLocaleString() ?? '—'}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.75rem',
                              color: row.nulls > 0 ? 'error.main' : 'text.secondary',
                              fontWeight: row.nulls > 0 ? 600 : 400,
                            }}
                          >
                            {row.nulls > 0 ? row.nulls.toLocaleString() : '0'}
                          </Typography>
                        </TableCell>

                        {[
                          fmt(row.mean),
                          fmt(row.std),
                          fmt(row.min),
                          fmt(row.q25),
                          fmt(row.median),
                          fmt(row.q75),
                          fmt(row.max),
                        ].map((val, j) => (
                          <TableCell key={j} align="right">
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {val}
                            </Typography>
                          </TableCell>
                        ))}

                        {/* Asymétrie — orange si |skew| > 2 */}
                        <TableCell align="right">
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: Math.abs(row.skew ?? 0) > 2
                                ? PWC_COLORS.orange
                                : 'text.secondary',
                              fontWeight: Math.abs(row.skew ?? 0) > 2 ? 700 : 400,
                            }}
                          >
                            {fmt(row.skew, 2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {/* Message si aucun résultat */}
                {(var_stats || []).filter(row => {
                  if (!varFilter) return true;
                  const meta = VAR_META[row.variable] || {};
                  return (
                    row.variable.toLowerCase().includes(varFilter) ||
                    (meta.group || '').toLowerCase().includes(varFilter) ||
                    (meta.label || '').toLowerCase().includes(varFilter) ||
                    (meta.desc  || '').toLowerCase().includes(varFilter)
                  );
                }).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Aucune variable ne correspond à « {varFilter} »
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Note bas de page */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            * Asymétrie (skewness) : valeur &gt; 0 = distribution à queue droite, &lt; 0 = queue gauche.
            Valeurs |skewness| &gt; 2 signalées en orange.
            Statistiques calculées sur les observations non-nulles.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// pages/EDA.jsx — Onglet Exploration des données (EDA)
/*
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Alert, CircularProgress,
  Grid, MenuItem, TextField, Tabs, Tab, Chip
} from '@mui/material';
import Plot from 'react-plotly.js';
import { PWC_COLORS } from '../theme/pwcTheme';
import api from '../api/client';

const REGIME_COLORS = {
  normal: '#1D9E75',
  stress: '#EF9F27',
  crisis: '#D85A30',
};

export default function EDA() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState(0);
  const [varX, setVarX]       = useState('iv');
  const [varY, setVarY]       = useState('vix');
  const [varHist, setVarHist] = useState('iv');
  const [varTime, setVarTime] = useState('iv');

  useEffect(() => {
    api.get('/eda/summary')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur chargement EDA'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', mt:8 }}><CircularProgress sx={{ color: PWC_COLORS.orange }} /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return <Alert severity="info">Aucune donnée disponible.</Alert>;

  const { columns, corr_matrix, histograms, boxplots, timeseries, iv_surface, scatter } = data;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Exploration des données (EDA)</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Analyse exploratoire du dataset SPX 1996–2023 · {data.n_rows?.toLocaleString()} observations · {data.n_cols} variables
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root.Mui-selected': { color: PWC_COLORS.orange }, '& .MuiTabs-indicator': { bgcolor: PWC_COLORS.orange } }}>
        <Tab label="Matrice de corrélation" />
        <Tab label="Histogrammes" />
        <Tab label="Boxplots régimes" />
        <Tab label="Évolution temporelle" />
        <Tab label="Surface IV" />
        <Tab label="Scatter plots" />
      </Tabs>
*/
      {/* ══ MATRICE DE CORRÉLATION ══ */}/*
      {tab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Matrice de corrélation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Corrélations de Pearson entre les variables numériques. Les valeurs proches de 1 (rouge) indiquent une forte corrélation positive, proches de -1 (bleu) une forte corrélation négative.
          </Typography>
          <Plot
            data={[{
              type: 'heatmap',
              z: corr_matrix.values,
              x: corr_matrix.columns,
              y: corr_matrix.columns,
              colorscale: [
                [0, '#185FA5'], [0.5, '#ffffff'], [1, '#D85A30']
              ],
              zmin: -1, zmax: 1,
              text: corr_matrix.values.map(row => row.map(v => v.toFixed(2))),
              texttemplate: '%{text}',
              textfont: { size: 9 },
              hovertemplate: '%{x} × %{y}<br>Corrélation: %{z:.3f}<extra></extra>',
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor:  'rgba(0,0,0,0)',
              margin: { l: 120, r: 20, t: 20, b: 120 },
              height: 600,
              xaxis: { tickangle: -45, tickfont: { size: 10 } },
              yaxis: { tickfont: { size: 10 } },
              colorbar: { title: 'Corrélation' },
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </Paper>
      )}
*/
      {/* ══ HISTOGRAMMES ══ */}/*
      {tab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Distribution des variables</Typography>
          <TextField select label="Variable" value={varHist} onChange={e => setVarHist(e.target.value)} sx={{ mb: 3, minWidth: 200 }} size="small">
            {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          {histograms[varHist] && (
            <Plot
              data={[{
                type: 'histogram',
                x: histograms[varHist].values,
                nbinsx: 60,
                marker: { color: PWC_COLORS.orange, opacity: 0.8 },
                name: varHist,
              }]}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 400,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: varHist },
                yaxis: { title: 'Fréquence' },
                bargap: 0.02,
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
          )}
          {histograms[varHist] && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {Object.entries(histograms[varHist].stats || {}).map(([k, v]) => (
                <Grid item key={k}>
                  <Chip label={`${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`} variant="outlined" size="small" />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}
*/
      {/* ══ BOXPLOTS PAR RÉGIME ══ */}/*
      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Boxplots par régime de volatilité</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Régime Normal (VIX &lt; 20) · Régime Stress (20 ≤ VIX &lt; 35) · Régime Crise (VIX ≥ 35)
          </Typography>
          <Grid container spacing={3}>
            {boxplots.map((bp, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{bp.variable}</Typography>
                <Plot
                  data={['normal', 'stress', 'crisis'].map(regime => ({
                    type: 'box',
                    y: bp[regime],
                    name: regime.charAt(0).toUpperCase() + regime.slice(1),
                    marker: { color: REGIME_COLORS[regime] },
                    boxpoints: false,
                  }))}
                  layout={{
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor:  'rgba(0,0,0,0)',
                    height: 300,
                    margin: { l: 50, r: 10, t: 10, b: 40 },
                    showlegend: idx === 0,
                    yaxis: { title: bp.variable },
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%' }}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
*/
      {/* ══ ÉVOLUTION TEMPORELLE ══ */}/*
      {tab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Évolution temporelle</Typography>
          <TextField select label="Variable" value={varTime} onChange={e => setVarTime(e.target.value)} sx={{ mb: 3, minWidth: 200 }} size="small">
            {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          {timeseries[varTime] && (
            <Plot
              data={[
                {
                  type: 'scatter', mode: 'lines',
                  x: timeseries[varTime].dates,
                  y: timeseries[varTime].values,
                  name: varTime,
                  line: { color: PWC_COLORS.orange, width: 1 },
                },
                ...(timeseries[varTime].crisis_zones || []).map(z => ({
                  type: 'scatter', mode: 'none',
                  x: [z.start, z.start, z.end, z.end],
                  y: [z.ymin, z.ymax, z.ymax, z.ymin],
                  fill: 'toself',
                  fillcolor: 'rgba(216,90,48,0.15)',
                  line: { width: 0 },
                  name: z.label,
                  showlegend: true,
                })),
              ]}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 420,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: 'Date', rangeslider: { visible: true } },
                yaxis: { title: varTime },
                legend: { orientation: 'h', y: -0.3 },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%' }}
            />
          )}
        </Paper>
      )}
*/
      {/* ══ SURFACE IV ══ */}/*
      {tab === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Distribution IV par maturité et moneyness</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>IV médiane par maturité</Typography>
              <Plot
                data={[{
                  type: 'bar',
                  x: iv_surface.tenors,
                  y: iv_surface.median_by_tenor,
                  marker: { color: PWC_COLORS.orange },
                  name: 'IV médiane',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 300,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Maturité (jours)' },
                  yaxis: { title: 'IV médiane' },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>IV médiane par moneyness</Typography>
              <Plot
                data={[{
                  type: 'scatter', mode: 'lines+markers',
                  x: iv_surface.moneyness,
                  y: iv_surface.median_by_moneyness,
                  line: { color: '#185FA5', width: 2 },
                  marker: { color: PWC_COLORS.orange, size: 6 },
                  name: 'IV médiane',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 300,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Moneyness (K/S - 1)' },
                  yaxis: { title: 'IV médiane' },
                  shapes: [{ type: 'line', x0: 0, x1: 0, yref: 'paper', y0: 0, y1: 1, line: { dash: 'dot', color: '#999', width: 1 } }],
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Heatmap IV moyenne (Maturité × Moneyness)</Typography>
              <Plot
                data={[{
                  type: 'heatmap',
                  z: iv_surface.heatmap_z,
                  x: iv_surface.moneyness,
                  y: iv_surface.tenors,
                  colorscale: 'Viridis',
                  hovertemplate: 'Moneyness: %{x}<br>Maturité: %{y}j<br>IV: %{z:.4f}<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor:  'rgba(0,0,0,0)',
                  height: 350,
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  xaxis: { title: 'Moneyness' },
                  yaxis: { title: 'Maturité (jours)' },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
*/
      {/* ══ SCATTER PLOTS ══ */}/*
      {tab === 5 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Scatter plots</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item>
              <TextField select label="Variable X" value={varX} onChange={e => setVarX(e.target.value)} sx={{ minWidth: 180 }} size="small">
                {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item>
              <TextField select label="Variable Y" value={varY} onChange={e => setVarY(e.target.value)} sx={{ minWidth: 180 }} size="small">
                {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          {scatter[`${varX}_${varY}`] && (
            <Plot
              data={['normal', 'stress', 'crisis'].map(regime => ({
                type: 'scatter', mode: 'markers',
                x: scatter[`${varX}_${varY}`][regime]?.x || [],
                y: scatter[`${varX}_${varY}`][regime]?.y || [],
                name: regime.charAt(0).toUpperCase() + regime.slice(1),
                marker: { color: REGIME_COLORS[regime], size: 3, opacity: 0.6 },
              }))}
              layout={{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor:  'rgba(0,0,0,0)',
                height: 500,
                margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: varX },
                yaxis: { title: varY },
                legend: { orientation: 'h', y: -0.15 },
              }}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: '100%' }}
            />
          )}
        </Paper>
      )}
    </Box>
  );
}*/

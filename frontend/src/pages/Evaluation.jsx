


// pages/Evaluation.jsx — Dashboard v4 — barres groupées Train/Val/Test
/*
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Grid, Typography, Card, CardContent, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  MenuItem, TextField, CircularProgress, Tabs, Tab, Slider,
  Tooltip,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { getEvaluation } from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';

// ─────────────── Helpers ────────────────

function computePooledR2(windows) {
  let N = 0, SY = 0, SY2 = 0, SSR = 0;
  for (const w of windows) {
    const n = w.n_test || 0;
    if (!n) continue;
    N += n; SY += w.sum_y_test || 0; SY2 += w.sum_y2_test || 0; SSR += w.mse_test * n;
  }
  if (N < 2) return null;
  const ssTot = SY2 - SY * SY / N;
  return ssTot > 0 ? 1 - SSR / ssTot : 0;
}

const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2Color = (v) => v >= 0.5 ? '#2e7d32' : v >= 0 ? PWC_COLORS.orange : PWC_COLORS.red;

const ALL_METRICS = ['rmse', 'mae', 'mse', 'r2', 'mape', 'qlike', 'directional_accuracy'];
const TRAIN_VAL_METRICS = ['rmse', 'mae', 'mse', 'r2'];
const METRIC_LABELS = {
  rmse: 'RMSE', mae: 'MAE', mse: 'MSE', r2: 'R²',
  mape: 'MAPE', qlike: 'QLIKE', directional_accuracy: 'Dir. Accuracy',
};
const SPLIT_LABELS = { train: 'Train', val: 'Validation', test: 'Test', all: 'Train / Val / Test' };
const SPLIT_COLORS = { train: '#1976d2', val: '#2e7d32', test: PWC_COLORS.orange };
const CRISIS_SPLIT_LABELS = {
  train_subprime: 'Train Subprimes', test_subprime: 'Test Subprimes',
  val_covid: 'Val COVID', all: 'Les 3 ensembles',
};
const CRISIS_SPLIT_COLORS = {
  train_subprime: '#1976d2', test_subprime: PWC_COLORS.orange, val_covid: PWC_COLORS.red,
};
const CRISIS_SPLITS_LIST = ['train_subprime', 'test_subprime', 'val_covid'];
const WF_SPLITS_LIST = ['train', 'val', 'test'];

// Clé dans flat_windows pour un (metric, split)
function wfKey(metric, split) {
  if (split === 'test' && ['mape', 'qlike', 'directional_accuracy'].includes(metric)) return metric;
  return `${metric}_${split}`;
}

// ─────────────── Composant ────────────────

export default function Evaluation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [metricView, setMetricView] = useState('rmse');
  const [splitView, setSplitView] = useState('test');
  const [selectedWindow, setSelectedWindow] = useState(0);
  const [crisisMetric, setCrisisMetric] = useState('rmse');
  const [crisisSplit, setCrisisSplit] = useState('test_subprime');
  const [temporalMetric, setTemporalMetric] = useState('rmse');
  const [temporalSplit, setTemporalSplit] = useState('test');

  useEffect(() => {
    getEvaluation()
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  const allWindows = data?.windows || [];
  const crisisDetails = data?.crisis_split_details || {};
  const windowIds = useMemo(() =>
    [...new Set(allWindows.map((w) => w.window_id))].sort((a, b) => a - b), [allWindows]);
  const maxWindowId = windowIds.length ? windowIds[windowIds.length - 1] : 0;
  const modelNames = useMemo(() =>
    [...new Set(allWindows.map((w) => w.model))].sort(), [allWindows]);

  const selectedWindowInfo = useMemo(() => {
    if (selectedWindow === 0) return null;
    const w = allWindows.find((w) => w.window_id === selectedWindow);
    return w ? { start: w.start_date, end: w.end_date } : null;
  }, [selectedWindow, allWindows]);

  // Métriques disponibles selon le split
  const availableMetrics = (splitView === 'test') ? ALL_METRICS : TRAIN_VAL_METRICS;
  const effectiveMetric = availableMetrics.includes(metricView) ? metricView : 'rmse';
  const crisisEffective = ALL_METRICS.includes(crisisMetric) ? crisisMetric : 'rmse';

  // ── Modèles (tab 0) — toujours basé sur le split "test" pour best model, sauf si single split ──
  const baseSplit = splitView === 'all' ? 'test' : splitView;

  const models = useMemo(() => {
    if (!allWindows.length || !modelNames.length) return [];
    if (selectedWindow === 0) {
      return modelNames.map((name) => {
        const wins = allWindows.filter((w) => w.model === name);
        const pooled = computePooledR2(wins);
        const getV = (m, sp) => mean(wins.map((w) => w[wfKey(m, sp)] ?? 0));
        const r2test = wins.map((w) => w.r2_test ?? 0);
        return {
          model_name: name, n_windows: wins.length,
          rmse: getV('rmse', baseSplit), mae: getV('mae', baseSplit),
          mse: getV('mse', baseSplit), r2: (baseSplit === 'test' && pooled !== null) ? pooled : getV('r2', baseSplit),
          r2_is_pooled: baseSplit === 'test' && pooled !== null,
          median_r2: median(r2test),
          pct_r2_pos: r2test.filter((v) => v > 0).length / (r2test.length || 1) * 100,
          mape: baseSplit === 'test' ? getV('mape', 'test') : null,
          qlike: baseSplit === 'test' ? getV('qlike', 'test') : null,
          directional_accuracy: baseSplit === 'test' ? getV('directional_accuracy', 'test') : null,
          ...(data?.models?.find((m2) => m2.model_name === name) || {}),
        };
      }).sort((a, b) => a.rmse - b.rmse);
    }
    return modelNames.map((name) => {
      const w = allWindows.find((w2) => w2.model === name && w2.window_id === selectedWindow);
      if (!w) return null;
      const gV = (m, sp) => w[wfKey(m, sp)] ?? null;
      return {
        model_name: name, n_windows: 1,
        rmse: gV('rmse', baseSplit), mae: gV('mae', baseSplit),
        mse: gV('mse', baseSplit), r2: gV('r2', baseSplit), r2_is_pooled: false,
        mape: gV('mape', 'test'), qlike: gV('qlike', 'test'),
        directional_accuracy: gV('directional_accuracy', 'test'),
        rmse_train: w.rmse_train, r2_train: w.r2_train,
        rmse_val: w.rmse_val, r2_val: w.r2_val,
        rmse_test: w.rmse_test, r2_test: w.r2_test,
      };
    }).filter(Boolean).sort((a, b) => (a.rmse ?? 0) - (b.rmse ?? 0));
  }, [selectedWindow, baseSplit, allWindows, modelNames, data]);

  const bestModel = models[0];

  // ── Données histogramme Tab 0 ──
  const tab0Traces = useMemo(() => {
    const sortedNames = models.map((m) => m.model_name);
    const splits = splitView === 'all' ? WF_SPLITS_LIST : [splitView];
    // Pour "all" + métrique test-only (mape, qlike, dir_acc), afficher seulement test
    const effectiveSplits = splits.filter((sp) =>
      sp === 'test' || TRAIN_VAL_METRICS.includes(effectiveMetric));

    return effectiveSplits.map((sp) => {
      const vals = sortedNames.map((name) => {
        const wins = allWindows.filter((w) => w.model === name);
        if (selectedWindow === 0) {
          // Global
          if (effectiveMetric === 'r2' && sp === 'test') {
            const p = computePooledR2(wins);
            if (p !== null) return p;
          }
          return mean(wins.map((w) => w[wfKey(effectiveMetric, sp)] ?? 0));
        }
        // Fenêtre individuelle
        const w = wins.find((w2) => w2.window_id === selectedWindow);
        return w ? (w[wfKey(effectiveMetric, sp)] ?? 0) : 0;
      });
      return {
        type: 'bar', orientation: 'h', name: SPLIT_LABELS[sp],
        x: vals, y: sortedNames,
        marker: { color: splitView === 'all' ? SPLIT_COLORS[sp] : PWC_COLORS.orange },
        text: vals.map((v) => v.toFixed(4)),
        textposition: 'outside',
      };
    });
  }, [models, splitView, effectiveMetric, selectedWindow, allWindows]);

  // ── Données histogramme Tab 2 (Crisis) ──
  const crisisModels = useMemo(() => {
    const names = Object.keys(crisisDetails).sort();
    return names.map((name) => ({ model_name: name, ...crisisDetails[name] }));
  }, [crisisDetails]);

  const tab2Traces = useMemo(() => {
    const sortedNames = crisisModels.map((m) => m.model_name);
    const splits = crisisSplit === 'all' ? CRISIS_SPLITS_LIST : [crisisSplit];
    return splits.map((sp) => {
      const vals = sortedNames.map((m) => crisisDetails[m]?.[sp]?.[crisisEffective] ?? 0);
      return {
        type: 'bar', orientation: 'h', name: CRISIS_SPLIT_LABELS[sp],
        x: vals, y: sortedNames,
        marker: { color: crisisSplit === 'all' ? CRISIS_SPLIT_COLORS[sp] : PWC_COLORS.orange },
        text: vals.map((v) => v.toFixed(4)),
        textposition: 'outside',
      };
    });
  }, [crisisModels, crisisSplit, crisisEffective, crisisDetails]);

  // ── Render ──
  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || !allWindows.length) {
    return (
      <Alert severity="info">
        Aucune évaluation disponible. Lancez <code> python -m app.ml.train_all </code> sur le backend.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Évaluation des modèles</Typography>*/

      {/* ═══════ SLIDER FENÊTRE ═══════ */}/*
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h4" sx={{ minWidth: 180 }}>
            {selectedWindow === 0 ? 'Vue globale (poolée)' : `Fenêtre ${selectedWindow}`}
          </Typography>
          {selectedWindow === 0 && (
            <Chip label={`${maxWindowId} fenêtres`}
              sx={{ bgcolor: PWC_COLORS.orange + '20', color: PWC_COLORS.orange }} />
          )}
          {selectedWindowInfo && (
            <Chip label={`${selectedWindowInfo.start} → ${selectedWindowInfo.end}`} variant="outlined" />
          )}
        </Box>
        <Box sx={{ px: 2 }}>
          <Slider value={selectedWindow} onChange={(_, v) => setSelectedWindow(v)}
            min={0} max={maxWindowId} step={1}
            marks={[
              { value: 0, label: 'Global' },
              ...(maxWindowId > 0 ? [{ value: maxWindowId, label: `${maxWindowId}` }] : []),
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => (v === 0 ? 'Global' : `Fen. ${v}`)}
            sx={{ color: PWC_COLORS.orange, '& .MuiSlider-markLabel': { fontSize: '0.75rem' } }}
          />
        </Box>
        {selectedWindow === 0 && bestModel && !bestModel.r2_is_pooled && baseSplit === 'test' && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            R² = <strong>moyenne</strong> par fenêtre (ancien JSON).
            Réentraînez avec le nouveau <code>train_all.py</code> pour le <strong>R² poolé</strong>.
          </Alert>
        )}
      </Paper>
*/
      {/* ═══════ BEST MODEL CARD ═══════ */}/*
      {bestModel && (
        <Card sx={{ mb: 3, borderLeft: `6px solid ${PWC_COLORS.orange}`, bgcolor: PWC_COLORS.orangeLight + '20' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Meilleur modèle — {SPLIT_LABELS[baseSplit]}
              {selectedWindow === 0 ? ' (toutes fenêtres)' : ` — Fenêtre ${selectedWindow}`}
            </Typography>
            <Typography variant="h2" sx={{ color: PWC_COLORS.orange, mt: 0.5 }}>
              {bestModel.model_name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip label={`RMSE: ${bestModel.rmse?.toFixed(5) ?? '—'}`} />
              <Chip label={`MAE: ${bestModel.mae?.toFixed(5) ?? '—'}`} />
              <Chip
                label={`R²: ${bestModel.r2?.toFixed(4) ?? '—'}${bestModel.r2_is_pooled ? ' (poolé)' : ''}`}
                sx={{ color: r2Color(bestModel.r2 ?? 0), fontWeight: 600 }} />
              {bestModel.mape != null && <Chip label={`MAPE: ${bestModel.mape.toFixed(2)}%`} />}
              {bestModel.qlike != null && <Chip label={`QLIKE: ${bestModel.qlike.toFixed(3)}`} />}
              {bestModel.directional_accuracy != null && (
                <Chip label={`Dir. Acc: ${bestModel.directional_accuracy.toFixed(1)}%`} />
              )}
              {selectedWindow === 0 && baseSplit === 'test' && bestModel.median_r2 !== undefined && (
                <Chip label={`R² médian: ${bestModel.median_r2.toFixed(4)}`}
                  variant="outlined" sx={{ color: r2Color(bestModel.median_r2) }} />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Comparaison modèles" />
        <Tab label="Performance temporelle" />
        <Tab label="Crisis split (Subprimes→COVID)" />
        <Tab label="Hyperparamètres" />
      </Tabs>
*/
      {/* ═══════ TAB 0 — Comparaison ═══════ */}/*
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField select label="Split" value={splitView}
              onChange={(e) => setSplitView(e.target.value)} sx={{ width: 200 }}>
              <MenuItem value="train">Train</MenuItem>
              <MenuItem value="val">Validation</MenuItem>
              <MenuItem value="test">Test</MenuItem>
              <MenuItem value="all">Les 3 (groupé)</MenuItem>
            </TextField>
            <TextField select label="Métrique" value={effectiveMetric}
              onChange={(e) => setMetricView(e.target.value)} sx={{ width: 280 }}>
              {availableMetrics.map((m) => (
                <MenuItem key={m} value={m}>
                  {METRIC_LABELS[m]}
                  {m === 'r2' && baseSplit === 'test' && selectedWindow === 0 ? ' (poolé)' : ''}
                </MenuItem>
              ))}
            </TextField>
            {splitView === 'all' && !TRAIN_VAL_METRICS.includes(effectiveMetric) && (
              <Chip label="Métrique test uniquement — seule la barre Test est affichée"
                size="small" variant="outlined" color="warning" sx={{ alignSelf: 'center' }} />
            )}
          </Box>
*/
          {/* Histogramme — barres groupées si "Les 3" */}/*
          <Paper sx={{ p: 2, mb: 3 }}>
            <Plot
              data={tab0Traces}
              layout={{
                title: `${METRIC_LABELS[effectiveMetric]} — ${SPLIT_LABELS[splitView]}${selectedWindow > 0 ? ` — Fenêtre ${selectedWindow}` : ''}`,
                barmode: 'group',
                autosize: true,
                height: Math.max(300, models.length * (splitView === 'all' ? 70 : 50) + 100),
                xaxis: { title: METRIC_LABELS[effectiveMetric] },
                margin: { t: 40, l: 110, r: 80, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                legend: splitView === 'all' ? { orientation: 'h', y: -0.15 } : { visible: false },
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </Paper>
*/
          {/* Tableau complet */}/*
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Tableau {SPLIT_LABELS[baseSplit]}
              {selectedWindow === 0 ? ' — Global' : ` — Fenêtre ${selectedWindow}`}
              {baseSplit === 'test' && selectedWindow === 0 && bestModel?.r2_is_pooled ? ' (R² poolé)' : ''}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE</strong></TableCell>
                  <TableCell align="right"><strong>MAE</strong></TableCell>
                  <TableCell align="right">
                    <Tooltip title={baseSplit === 'test' && selectedWindow === 0 && bestModel?.r2_is_pooled
                      ? "R² poolé (OOS concaténés)" : "R²"}>
                      <strong style={{ textDecoration: 'underline dotted', cursor: 'help' }}>R²</strong>
                    </Tooltip>
                  </TableCell>
                  {baseSplit === 'test' && selectedWindow === 0 && (
                    <>
                      <TableCell align="right"><strong>R² médian</strong></TableCell>
                      <TableCell align="right"><strong>% R²&gt;0</strong></TableCell>
                    </>
                  )}
                  {baseSplit === 'test' && (
                    <>
                      <TableCell align="right"><strong>MAPE</strong></TableCell>
                      <TableCell align="right"><strong>QLIKE</strong></TableCell>
                      <TableCell align="right"><strong>Dir. Acc</strong></TableCell>
                    </>
                  )}
                  {selectedWindow === 0 && <TableCell align="right"><strong>Fen.</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {models.map((m, i) => (
                  <TableRow key={m.model_name}
                    sx={{ bgcolor: i === 0 ? PWC_COLORS.orangeLight + '30' : 'inherit' }}>
                    <TableCell>{m.model_name} {i === 0 && '🏆'}</TableCell>
                    <TableCell align="right">{m.rmse?.toFixed(5) ?? '—'}</TableCell>
                    <TableCell align="right">{m.mae?.toFixed(5) ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ color: r2Color(m.r2 ?? 0), fontWeight: 600 }}>
                      {m.r2?.toFixed(4) ?? '—'}
                    </TableCell>
                    {baseSplit === 'test' && selectedWindow === 0 && (
                      <>
                        <TableCell align="right" sx={{ color: r2Color(m.median_r2 ?? 0) }}>
                          {m.median_r2?.toFixed(4) ?? '—'}
                        </TableCell>
                        <TableCell align="right">{m.pct_r2_pos?.toFixed(0) ?? '—'}%</TableCell>
                      </>
                    )}
                    {baseSplit === 'test' && (
                      <>
                        <TableCell align="right">{m.mape?.toFixed(2) ?? '—'}%</TableCell>
                        <TableCell align="right">{m.qlike?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell align="right">{m.directional_accuracy?.toFixed(1) ?? '—'}%</TableCell>
                      </>
                    )}
                    {selectedWindow === 0 && <TableCell align="right">{m.n_windows}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
*/
          {/* Détail train/val/test si fenêtre individuelle */}/*
          {selectedWindow > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h4" sx={{ p: 1 }}>
                Vue complète Train / Val / Test — Fenêtre {selectedWindow}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Modèle</strong></TableCell>
                    <TableCell align="right"><strong>RMSE train</strong></TableCell>
                    <TableCell align="right"><strong>R² train</strong></TableCell>
                    <TableCell align="right"><strong>RMSE val</strong></TableCell>
                    <TableCell align="right"><strong>R² val</strong></TableCell>
                    <TableCell align="right"><strong>RMSE test</strong></TableCell>
                    <TableCell align="right"><strong>R² test</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((m) => (
                    <TableRow key={m.model_name}>
                      <TableCell>{m.model_name}</TableCell>
                      <TableCell align="right">{m.rmse_train?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_train ?? 0) }}>
                        {m.r2_train?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.rmse_val?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_val ?? 0) }}>
                        {m.r2_val?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.rmse_test?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_test ?? 0), fontWeight: 600 }}>
                        {m.r2_test?.toFixed(4) ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}
*/
      {/* ═══════ TAB 1 — Performance temporelle ═══════ */}/*
      {tab === 1 && (() => {
        const MODEL_COLORS = ['#DC6B2F', '#1976d2', '#2e7d32', '#9c27b0', '#e91e63',
                              '#00838f', '#ef6c00', '#5d4037', '#455a64', '#c62828',
                              '#1b5e20', '#4a148c'];
        const temporalEffective = ALL_METRICS.includes(temporalMetric) ? temporalMetric : 'rmse';
        const hasTrainVal = TRAIN_VAL_METRICS.includes(temporalEffective);
        // Si métrique test-only et split != test/all, forcer test
        const temporalSplitEffective = (!hasTrainVal && temporalSplit !== 'test') ? 'test' : temporalSplit;
        const top = models.map((m) => m.model_name);

        const splitsToShow = temporalSplitEffective === 'all'
          ? (hasTrainVal ? ['train', 'val', 'test'] : ['test'])
          : [temporalSplitEffective];

        const SPLIT_STYLES = {
          train: { dash: 'dash', width: 1.5, opacity: 0.6, suffix: 'Train' },
          val:   { dash: 'dot',  width: 1.5, opacity: 0.7, suffix: 'Val' },
          test:  { dash: 'solid', width: 2.5, opacity: 1, suffix: 'Test' },
        };

        const traces = [];
        top.forEach((name, i) => {
          const color = MODEL_COLORS[i % MODEL_COLORS.length];
          const wins = allWindows.filter((w) => w.model === name)
            .sort((a, b) => a.window_id - b.window_id);
          const xDates = wins.map((w) => w.start_date);

          splitsToShow.forEach((sp) => {
            const style = SPLIT_STYLES[sp];
            const key = (sp === 'test' && ['mape', 'qlike', 'directional_accuracy'].includes(temporalEffective))
              ? temporalEffective : `${temporalEffective}_${sp}`;
            traces.push({
              type: 'scatter',
              mode: splitsToShow.length === 1 ? 'lines+markers' : 'lines',
              name: splitsToShow.length > 1 ? `${name} — ${style.suffix}` : name,
              x: xDates,
              y: wins.map((w) => w[key] ?? 0),
              line: { width: style.width, dash: style.dash, color },
              marker: splitsToShow.length === 1 ? { size: 4 } : undefined,
              opacity: style.opacity,
              legendgroup: name,
            });
          });
        });

        // Ligne R²=0
        if (temporalEffective === 'r2' && traces.length > 0) {
          const xs = traces[0]?.x || [];
          traces.push({
            type: 'scatter', mode: 'lines', name: 'R²=0', showlegend: false,
            x: [xs[0], xs[xs.length - 1]], y: [0, 0],
            line: { width: 1, dash: 'dash', color: '#999' },
          });
        }

        const splitLabel = temporalSplitEffective === 'all' ? 'Train / Val / Test'
          : SPLIT_LABELS[temporalSplitEffective];

        return (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField select label="Métrique" value={temporalEffective}
                onChange={(e) => setTemporalMetric(e.target.value)} sx={{ width: 280 }}>
                {ALL_METRICS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {METRIC_LABELS[m]}
                    {!TRAIN_VAL_METRICS.includes(m) ? ' (test uniquement)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Split" value={temporalSplitEffective}
                onChange={(e) => setTemporalSplit(e.target.value)} sx={{ width: 200 }}>
                <MenuItem value="train">Train</MenuItem>
                <MenuItem value="val">Validation</MenuItem>
                <MenuItem value="test">Test</MenuItem>
                <MenuItem value="all">Les 3</MenuItem>
              </TextField>
              {temporalSplitEffective === 'all' && hasTrainVal && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2px dashed #888' }} />
                    <Typography variant="caption" color="text.secondary">Train</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2px dotted #888' }} />
                    <Typography variant="caption" color="text.secondary">Validation</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2.5px solid #888' }} />
                    <Typography variant="caption" color="text.secondary">Test</Typography>
                  </Box>
                </Box>
              )}
              {!hasTrainVal && temporalSplit !== 'test' && (
                <Chip label="Métrique test uniquement — forcé sur Test"
                  size="small" variant="outlined" color="warning" />
              )}
            </Box>

            {temporalEffective === 'r2' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Certaines fenêtres ont un R² très négatif (IV test quasi constante).
                La synthèse globale utilise le <strong>R² poolé</strong>.
              </Alert>
            )}

            <Paper sx={{ p: 2 }}>
              <Plot
                data={traces}
                layout={{
                  title: `${METRIC_LABELS[temporalEffective]} par fenêtre — ${splitLabel}`,
                  autosize: true, height: 500,
                  xaxis: { title: 'Début fenêtre' },
                  yaxis: { title: METRIC_LABELS[temporalEffective] },
                  hovermode: 'x unified',
                  legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
                  margin: { t: 40, l: 70, r: 30, b: 80 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Paper>
          </Box>
        );
      })()}
*/
      {/* ═══════ TAB 2 — Crisis split ═══════ */}/*
      {tab === 2 && (
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Stabilité temporelle : Subprimes (2007-09) → COVID (2020)
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Modèles entraînés sur les Subprimes, testés (80/20), puis validés sur COVID (2020).
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField select label="Ensemble" value={crisisSplit}
              onChange={(e) => setCrisisSplit(e.target.value)} sx={{ width: 240 }}>
              <MenuItem value="train_subprime">Train Subprimes</MenuItem>
              <MenuItem value="test_subprime">Test Subprimes</MenuItem>
              <MenuItem value="val_covid">Validation COVID</MenuItem>
              <MenuItem value="all">Les 3 (groupé)</MenuItem>
            </TextField>
            <TextField select label="Métrique" value={crisisEffective}
              onChange={(e) => setCrisisMetric(e.target.value)} sx={{ width: 280 }}>
              {ALL_METRICS.map((m) => (
                <MenuItem key={m} value={m}>{METRIC_LABELS[m]}</MenuItem>
              ))}
            </TextField>
          </Box>
*/
          {/* Histogramme Crisis — barres groupées si "Les 3" */}/*
          <Paper sx={{ p: 2, mb: 3 }}>
            <Plot
              data={tab2Traces}
              layout={{
                title: `${METRIC_LABELS[crisisEffective]} — ${CRISIS_SPLIT_LABELS[crisisSplit]}`,
                barmode: 'group',
                autosize: true,
                height: Math.max(300, crisisModels.length * (crisisSplit === 'all' ? 80 : 55) + 100),
                xaxis: { title: METRIC_LABELS[crisisEffective] },
                margin: { t: 40, l: 110, r: 80, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                legend: crisisSplit === 'all' ? { orientation: 'h', y: -0.15 } : { visible: false },
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </Paper>
*/
          {/* Tableau détaillé de l'ensemble sélectionné (ou test par défaut si "all") */}/*
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Détail — {crisisSplit === 'all' ? 'Test Subprimes' : CRISIS_SPLIT_LABELS[crisisSplit]}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE</strong></TableCell>
                  <TableCell align="right"><strong>MAE</strong></TableCell>
                  <TableCell align="right"><strong>R²</strong></TableCell>
                  <TableCell align="right"><strong>MAPE</strong></TableCell>
                  <TableCell align="right"><strong>QLIKE</strong></TableCell>
                  <TableCell align="right"><strong>Dir. Acc</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(crisisDetails)
                  .map(([name, splits]) => {
                    const sp = crisisSplit === 'all' ? 'test_subprime' : crisisSplit;
                    const s = splits[sp];
                    if (!s) return null;
                    return { model_name: name, ...s };
                  })
                  .filter(Boolean)
                  .sort((a, b) => a.rmse - b.rmse)
                  .map((m, i) => (
                    <TableRow key={m.model_name}
                      sx={{ bgcolor: i === 0 ? PWC_COLORS.orangeLight + '30' : 'inherit' }}>
                      <TableCell>{m.model_name} {i === 0 && '🏆'}</TableCell>
                      <TableCell align="right">{m.rmse?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right">{m.mae?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2 ?? 0), fontWeight: 600 }}>
                        {m.r2?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.mape?.toFixed(2) ?? '—'}%</TableCell>
                      <TableCell align="right">{m.qlike?.toFixed(3) ?? '—'}</TableCell>
                      <TableCell align="right">{m.directional_accuracy?.toFixed(1) ?? '—'}%</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>
*/
          {/* Tableau comparatif RMSE + R² Subprimes vs COVID */}/*
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Comparaison RMSE : Test Subprimes vs Validation COVID
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE Subprimes</strong></TableCell>
                  <TableCell align="right"><strong>RMSE COVID</strong></TableCell>
                  <TableCell align="right"><strong>Ratio</strong></TableCell>
                  <TableCell align="right"><strong>R² Subprimes</strong></TableCell>
                  <TableCell align="right"><strong>R² COVID</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(crisisDetails)
                  .filter(([, s]) => s.test_subprime && s.val_covid)
                  .sort(([, a], [, b]) => a.test_subprime.rmse - b.test_subprime.rmse)
                  .map(([name, splits]) => {
                    const ratio = splits.val_covid.rmse / (splits.test_subprime.rmse || 1);
                    return (
                      <TableRow key={name}>
                        <TableCell>{name}</TableCell>
                        <TableCell align="right">{splits.test_subprime.rmse.toFixed(5)}</TableCell>
                        <TableCell align="right">{splits.val_covid.rmse.toFixed(5)}</TableCell>
                        <TableCell align="right" sx={{
                          color: ratio < 1.5 ? '#2e7d32' : ratio < 3 ? PWC_COLORS.orange : PWC_COLORS.red,
                          fontWeight: 600,
                        }}>{ratio.toFixed(2)}×</TableCell>
                        <TableCell align="right" sx={{ color: r2Color(splits.test_subprime.r2) }}>
                          {splits.test_subprime.r2.toFixed(4)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: r2Color(splits.val_covid.r2) }}>
                          {splits.val_covid.r2.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}
*/
      {/* ═══════ TAB 3 — Hyperparamètres ═══════ */}/*
      {tab === 3 && (
        <Grid container spacing={2}>
          {(data?.models || []).map((m) => (
            <Grid item xs={12} sm={6} md={4} key={m.model_name}>
              <Card>
                <CardContent>
                  <Typography variant="h5" sx={{ color: PWC_COLORS.orange }}>{m.model_name}</Typography>
                  <Table size="small">
                    <TableBody>
                      {Object.entries(m.hyperparameters || {}).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{k}</TableCell>
                          <TableCell align="right" sx={{ pr: 0 }}>{String(v)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
*/


// pages/Evaluation.jsx — Dashboard v4 — barres groupées Train/Val/Test
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Grid, Typography, Card, CardContent, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, Chip,
  MenuItem, TextField, CircularProgress, Tabs, Tab, Slider,
  Tooltip,
} from '@mui/material';
import Plot from 'react-plotly.js';
import { getEvaluation, getGlobalEvaluation } from '../api/client';
import { PWC_COLORS } from '../theme/pwcTheme';

// ─────────────── Helpers ────────────────

function computePooledR2(windows) {
  let N = 0, SY = 0, SY2 = 0, SSR = 0;
  for (const w of windows) {
    const n = w.n_test || 0;
    if (!n) continue;
    N += n; SY += w.sum_y_test || 0; SY2 += w.sum_y2_test || 0; SSR += w.mse_test * n;
  }
  if (N < 2) return null;
  const ssTot = SY2 - SY * SY / N;
  return ssTot > 0 ? 1 - SSR / ssTot : 0;
}

const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2Color = (v) => v >= 0.5 ? '#2e7d32' : v >= 0 ? PWC_COLORS.orange : PWC_COLORS.red;

const ALL_METRICS = ['rmse', 'mae', 'mse', 'r2', 'mape', 'qlike', 'directional_accuracy'];
const TRAIN_VAL_METRICS = ['rmse', 'mae', 'mse', 'r2'];
const METRIC_LABELS = {
  rmse: 'RMSE', mae: 'MAE', mse: 'MSE', r2: 'R²',
  mape: 'MAPE', qlike: 'QLIKE', directional_accuracy: 'Dir. Accuracy',
};
const SPLIT_LABELS = { train: 'Train', val: 'Validation', test: 'Test', all: 'Train / Val / Test' };
const SPLIT_COLORS = { train: '#1976d2', val: '#2e7d32', test: PWC_COLORS.orange };
const CRISIS_SPLIT_LABELS = {
  train_subprime: 'Train Subprimes', test_subprime: 'Test Subprimes',
  val_covid: 'Val COVID', all: 'Les 3 ensembles',
};
const CRISIS_SPLIT_COLORS = {
  train_subprime: '#1976d2', test_subprime: PWC_COLORS.orange, val_covid: PWC_COLORS.red,
};
const CRISIS_SPLITS_LIST = ['train_subprime', 'test_subprime', 'val_covid'];
const WF_SPLITS_LIST = ['train', 'val', 'test'];

// Clé dans flat_windows pour un (metric, split)
function wfKey(metric, split) {
  if (split === 'test' && ['mape', 'qlike', 'directional_accuracy'].includes(metric)) return metric;
  return `${metric}_${split}`;
}

// ─────────────── Composant ────────────────

export default function Evaluation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [metricView, setMetricView] = useState('rmse');
  const [splitView, setSplitView] = useState('test');
  const [selectedWindow, setSelectedWindow] = useState(0);
  const [crisisMetric, setCrisisMetric] = useState('rmse');
  const [crisisSplit, setCrisisSplit] = useState('test_subprime');
  const [temporalMetric, setTemporalMetric] = useState('rmse');
  const [temporalSplit, setTemporalSplit] = useState('test');

  // ── État onglet DL Global ──
  const [globalData, setGlobalData] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [dlSelectedModel, setDlSelectedModel] = useState('');
  const [dlCurveMetric, setDlCurveMetric] = useState('loss');

  useEffect(() => {
    getEvaluation()
      .then(setData)
      .catch((e) => setError(e.response?.data?.detail || 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  // Charger les données DL global quand l'onglet est sélectionné
  useEffect(() => {
    if (tab !== 4 || globalData || globalLoading) return;
    setGlobalLoading(true);
    getGlobalEvaluation()
      .then((d) => {
        setGlobalData(d);
        if (d.models?.length) setDlSelectedModel(d.models[0].model_name);
      })
      .catch((e) => setGlobalError(e.response?.data?.detail || 'Erreur chargement DL global'))
      .finally(() => setGlobalLoading(false));
  }, [tab]);

  const allWindows = data?.windows || [];
  const crisisDetails = data?.crisis_split_details || {};
  const windowIds = useMemo(() =>
    [...new Set(allWindows.map((w) => w.window_id))].sort((a, b) => a - b), [allWindows]);
  const maxWindowId = windowIds.length ? windowIds[windowIds.length - 1] : 0;
  const modelNames = useMemo(() =>
    [...new Set(allWindows.map((w) => w.model))].sort(), [allWindows]);

  const selectedWindowInfo = useMemo(() => {
    if (selectedWindow === 0) return null;
    const w = allWindows.find((w) => w.window_id === selectedWindow);
    return w ? { start: w.start_date, end: w.end_date } : null;
  }, [selectedWindow, allWindows]);

  // Métriques disponibles selon le split
  const availableMetrics = (splitView === 'test') ? ALL_METRICS : TRAIN_VAL_METRICS;
  const effectiveMetric = availableMetrics.includes(metricView) ? metricView : 'rmse';
  const crisisEffective = ALL_METRICS.includes(crisisMetric) ? crisisMetric : 'rmse';

  // ── Modèles (tab 0) — toujours basé sur le split "test" pour best model, sauf si single split ──
  const baseSplit = splitView === 'all' ? 'test' : splitView;

  const models = useMemo(() => {
    if (!allWindows.length || !modelNames.length) return [];
    if (selectedWindow === 0) {
      return modelNames.map((name) => {
        const wins = allWindows.filter((w) => w.model === name);
        const pooled = computePooledR2(wins);
        const getV = (m, sp) => mean(wins.map((w) => w[wfKey(m, sp)] ?? 0));
        const r2test = wins.map((w) => w.r2_test ?? 0);
        return {
          model_name: name, n_windows: wins.length,
          rmse: getV('rmse', baseSplit), mae: getV('mae', baseSplit),
          mse: getV('mse', baseSplit), r2: (baseSplit === 'test' && pooled !== null) ? pooled : getV('r2', baseSplit),
          r2_is_pooled: baseSplit === 'test' && pooled !== null,
          median_r2: median(r2test),
          pct_r2_pos: r2test.filter((v) => v > 0).length / (r2test.length || 1) * 100,
          mape: baseSplit === 'test' ? getV('mape', 'test') : null,
          qlike: baseSplit === 'test' ? getV('qlike', 'test') : null,
          directional_accuracy: baseSplit === 'test' ? getV('directional_accuracy', 'test') : null,
          ...(data?.models?.find((m2) => m2.model_name === name) || {}),
        };
      }).sort((a, b) => a.rmse - b.rmse);
    }
    return modelNames.map((name) => {
      const w = allWindows.find((w2) => w2.model === name && w2.window_id === selectedWindow);
      if (!w) return null;
      const gV = (m, sp) => w[wfKey(m, sp)] ?? null;
      return {
        model_name: name, n_windows: 1,
        rmse: gV('rmse', baseSplit), mae: gV('mae', baseSplit),
        mse: gV('mse', baseSplit), r2: gV('r2', baseSplit), r2_is_pooled: false,
        mape: gV('mape', 'test'), qlike: gV('qlike', 'test'),
        directional_accuracy: gV('directional_accuracy', 'test'),
        rmse_train: w.rmse_train, r2_train: w.r2_train,
        rmse_val: w.rmse_val, r2_val: w.r2_val,
        rmse_test: w.rmse_test, r2_test: w.r2_test,
      };
    }).filter(Boolean).sort((a, b) => (a.rmse ?? 0) - (b.rmse ?? 0));
  }, [selectedWindow, baseSplit, allWindows, modelNames, data]);

  const bestModel = models[0];

  // ── Données histogramme Tab 0 ──
  const tab0Traces = useMemo(() => {
    const sortedNames = models.map((m) => m.model_name);
    const splits = splitView === 'all' ? WF_SPLITS_LIST : [splitView];
    // Pour "all" + métrique test-only (mape, qlike, dir_acc), afficher seulement test
    const effectiveSplits = splits.filter((sp) =>
      sp === 'test' || TRAIN_VAL_METRICS.includes(effectiveMetric));

    return effectiveSplits.map((sp) => {
      const vals = sortedNames.map((name) => {
        const wins = allWindows.filter((w) => w.model === name);
        if (selectedWindow === 0) {
          // Global
          if (effectiveMetric === 'r2' && sp === 'test') {
            const p = computePooledR2(wins);
            if (p !== null) return p;
          }
          return mean(wins.map((w) => w[wfKey(effectiveMetric, sp)] ?? 0));
        }
        // Fenêtre individuelle
        const w = wins.find((w2) => w2.window_id === selectedWindow);
        return w ? (w[wfKey(effectiveMetric, sp)] ?? 0) : 0;
      });
      return {
        type: 'bar', orientation: 'h', name: SPLIT_LABELS[sp],
        x: vals, y: sortedNames,
        marker: { color: splitView === 'all' ? SPLIT_COLORS[sp] : PWC_COLORS.orange },
        text: vals.map((v) => v.toFixed(4)),
        textposition: 'outside',
      };
    });
  }, [models, splitView, effectiveMetric, selectedWindow, allWindows]);

  // ── Données histogramme Tab 2 (Crisis) ──
  const crisisModels = useMemo(() => {
    const names = Object.keys(crisisDetails).sort();
    return names.map((name) => ({ model_name: name, ...crisisDetails[name] }));
  }, [crisisDetails]);

  const tab2Traces = useMemo(() => {
    const sortedNames = crisisModels.map((m) => m.model_name);
    const splits = crisisSplit === 'all' ? CRISIS_SPLITS_LIST : [crisisSplit];
    return splits.map((sp) => {
      const vals = sortedNames.map((m) => crisisDetails[m]?.[sp]?.[crisisEffective] ?? 0);
      return {
        type: 'bar', orientation: 'h', name: CRISIS_SPLIT_LABELS[sp],
        x: vals, y: sortedNames,
        marker: { color: crisisSplit === 'all' ? CRISIS_SPLIT_COLORS[sp] : PWC_COLORS.orange },
        text: vals.map((v) => v.toFixed(4)),
        textposition: 'outside',
      };
    });
  }, [crisisModels, crisisSplit, crisisEffective, crisisDetails]);

  // ── Render ──
  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || !allWindows.length) {
    return (
      <Alert severity="info">
        Aucune évaluation disponible. Lancez <code> python -m app.ml.train_all </code> sur le backend.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Évaluation des modèles</Typography>

      {/* ═══════ SLIDER FENÊTRE ═══════ */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h4" sx={{ minWidth: 180 }}>
            {selectedWindow === 0 ? 'Vue globale (poolée)' : `Fenêtre ${selectedWindow}`}
          </Typography>
          {selectedWindow === 0 && (
            <Chip label={`${maxWindowId} fenêtres`}
              sx={{ bgcolor: PWC_COLORS.orange + '20', color: PWC_COLORS.orange }} />
          )}
          {selectedWindowInfo && (
            <Chip label={`${selectedWindowInfo.start} → ${selectedWindowInfo.end}`} variant="outlined" />
          )}
        </Box>
        <Box sx={{ px: 2 }}>
          <Slider value={selectedWindow} onChange={(_, v) => setSelectedWindow(v)}
            min={0} max={maxWindowId} step={1}
            marks={[
              { value: 0, label: 'Global' },
              ...(maxWindowId > 0 ? [{ value: maxWindowId, label: `${maxWindowId}` }] : []),
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => (v === 0 ? 'Global' : `Fen. ${v}`)}
            sx={{ color: PWC_COLORS.orange, '& .MuiSlider-markLabel': { fontSize: '0.75rem' } }}
          />
        </Box>
        {selectedWindow === 0 && bestModel && !bestModel.r2_is_pooled && baseSplit === 'test' && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            R² = <strong>moyenne</strong> par fenêtre (ancien JSON).
            Réentraînez avec le nouveau <code>train_all.py</code> pour le <strong>R² poolé</strong>.
          </Alert>
        )}
      </Paper>

      {/* ═══════ BEST MODEL CARD ═══════ */}
      {bestModel && (
        <Card sx={{ mb: 3, borderLeft: `6px solid ${PWC_COLORS.orange}`, bgcolor: PWC_COLORS.orangeLight + '20' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Meilleur modèle — {SPLIT_LABELS[baseSplit]}
              {selectedWindow === 0 ? ' (toutes fenêtres)' : ` — Fenêtre ${selectedWindow}`}
            </Typography>
            <Typography variant="h2" sx={{ color: PWC_COLORS.orange, mt: 0.5 }}>
              {bestModel.model_name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip label={`RMSE: ${bestModel.rmse?.toFixed(5) ?? '—'}`} />
              <Chip label={`MAE: ${bestModel.mae?.toFixed(5) ?? '—'}`} />
              <Chip
                label={`R²: ${bestModel.r2?.toFixed(4) ?? '—'}${bestModel.r2_is_pooled ? ' (poolé)' : ''}`}
                sx={{ color: r2Color(bestModel.r2 ?? 0), fontWeight: 600 }} />
              {bestModel.mape != null && <Chip label={`MAPE: ${bestModel.mape.toFixed(2)}%`} />}
              {bestModel.qlike != null && <Chip label={`QLIKE: ${bestModel.qlike.toFixed(3)}`} />}
              {bestModel.directional_accuracy != null && (
                <Chip label={`Dir. Acc: ${bestModel.directional_accuracy.toFixed(1)}%`} />
              )}
              {selectedWindow === 0 && baseSplit === 'test' && bestModel.median_r2 !== undefined && (
                <Chip label={`R² médian: ${bestModel.median_r2.toFixed(4)}`}
                  variant="outlined" sx={{ color: r2Color(bestModel.median_r2) }} />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Comparaison modèles" />
        <Tab label="Performance temporelle" />
        <Tab label="Crisis split (Subprimes→COVID)" />
        <Tab label="Hyperparamètres" />
        <Tab label="DL — Entraînement global" />
      </Tabs>

      {/* ═══════ TAB 0 — Comparaison ═══════ */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField select label="Split" value={splitView}
              onChange={(e) => setSplitView(e.target.value)} sx={{ width: 200 }}>
              <MenuItem value="train">Train</MenuItem>
              <MenuItem value="val">Validation</MenuItem>
              <MenuItem value="test">Test</MenuItem>
              <MenuItem value="all">Les 3 (groupé)</MenuItem>
            </TextField>
            <TextField select label="Métrique" value={effectiveMetric}
              onChange={(e) => setMetricView(e.target.value)} sx={{ width: 280 }}>
              {availableMetrics.map((m) => (
                <MenuItem key={m} value={m}>
                  {METRIC_LABELS[m]}
                  {m === 'r2' && baseSplit === 'test' && selectedWindow === 0 ? ' (poolé)' : ''}
                </MenuItem>
              ))}
            </TextField>
            {splitView === 'all' && !TRAIN_VAL_METRICS.includes(effectiveMetric) && (
              <Chip label="Métrique test uniquement — seule la barre Test est affichée"
                size="small" variant="outlined" color="warning" sx={{ alignSelf: 'center' }} />
            )}
          </Box>

          {/* Histogramme — barres groupées si "Les 3" */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Plot
              data={tab0Traces}
              layout={{
                title: `${METRIC_LABELS[effectiveMetric]} — ${SPLIT_LABELS[splitView]}${selectedWindow > 0 ? ` — Fenêtre ${selectedWindow}` : ''}`,
                barmode: 'group',
                autosize: true,
                height: Math.max(300, models.length * (splitView === 'all' ? 70 : 50) + 100),
                xaxis: { title: METRIC_LABELS[effectiveMetric] },
                margin: { t: 40, l: 110, r: 80, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                legend: splitView === 'all' ? { orientation: 'h', y: -0.15 } : { visible: false },
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </Paper>

          {/* Tableau complet */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Tableau {SPLIT_LABELS[baseSplit]}
              {selectedWindow === 0 ? ' — Global' : ` — Fenêtre ${selectedWindow}`}
              {baseSplit === 'test' && selectedWindow === 0 && bestModel?.r2_is_pooled ? ' (R² poolé)' : ''}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE</strong></TableCell>
                  <TableCell align="right"><strong>MAE</strong></TableCell>
                  <TableCell align="right">
                    <Tooltip title={baseSplit === 'test' && selectedWindow === 0 && bestModel?.r2_is_pooled
                      ? "R² poolé (OOS concaténés)" : "R²"}>
                      <strong style={{ textDecoration: 'underline dotted', cursor: 'help' }}>R²</strong>
                    </Tooltip>
                  </TableCell>
                  {baseSplit === 'test' && selectedWindow === 0 && (
                    <>
                      <TableCell align="right"><strong>R² médian</strong></TableCell>
                      <TableCell align="right"><strong>% R²&gt;0</strong></TableCell>
                    </>
                  )}
                  {baseSplit === 'test' && (
                    <>
                      <TableCell align="right"><strong>MAPE</strong></TableCell>
                      <TableCell align="right"><strong>QLIKE</strong></TableCell>
                      <TableCell align="right"><strong>Dir. Acc</strong></TableCell>
                    </>
                  )}
                  {selectedWindow === 0 && <TableCell align="right"><strong>Fen.</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {models.map((m, i) => (
                  <TableRow key={m.model_name}
                    sx={{ bgcolor: i === 0 ? PWC_COLORS.orangeLight + '30' : 'inherit' }}>
                    <TableCell>{m.model_name} {i === 0 && '🏆'}</TableCell>
                    <TableCell align="right">{m.rmse?.toFixed(5) ?? '—'}</TableCell>
                    <TableCell align="right">{m.mae?.toFixed(5) ?? '—'}</TableCell>
                    <TableCell align="right" sx={{ color: r2Color(m.r2 ?? 0), fontWeight: 600 }}>
                      {m.r2?.toFixed(4) ?? '—'}
                    </TableCell>
                    {baseSplit === 'test' && selectedWindow === 0 && (
                      <>
                        <TableCell align="right" sx={{ color: r2Color(m.median_r2 ?? 0) }}>
                          {m.median_r2?.toFixed(4) ?? '—'}
                        </TableCell>
                        <TableCell align="right">{m.pct_r2_pos?.toFixed(0) ?? '—'}%</TableCell>
                      </>
                    )}
                    {baseSplit === 'test' && (
                      <>
                        <TableCell align="right">{m.mape?.toFixed(2) ?? '—'}%</TableCell>
                        <TableCell align="right">{m.qlike?.toFixed(3) ?? '—'}</TableCell>
                        <TableCell align="right">{m.directional_accuracy?.toFixed(1) ?? '—'}%</TableCell>
                      </>
                    )}
                    {selectedWindow === 0 && <TableCell align="right">{m.n_windows}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Détail train/val/test si fenêtre individuelle */}
          {selectedWindow > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h4" sx={{ p: 1 }}>
                Vue complète Train / Val / Test — Fenêtre {selectedWindow}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Modèle</strong></TableCell>
                    <TableCell align="right"><strong>RMSE train</strong></TableCell>
                    <TableCell align="right"><strong>R² train</strong></TableCell>
                    <TableCell align="right"><strong>RMSE val</strong></TableCell>
                    <TableCell align="right"><strong>R² val</strong></TableCell>
                    <TableCell align="right"><strong>RMSE test</strong></TableCell>
                    <TableCell align="right"><strong>R² test</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((m) => (
                    <TableRow key={m.model_name}>
                      <TableCell>{m.model_name}</TableCell>
                      <TableCell align="right">{m.rmse_train?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_train ?? 0) }}>
                        {m.r2_train?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.rmse_val?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_val ?? 0) }}>
                        {m.r2_val?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.rmse_test?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2_test ?? 0), fontWeight: 600 }}>
                        {m.r2_test?.toFixed(4) ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}

      {/* ═══════ TAB 1 — Performance temporelle ═══════ */}
      {tab === 1 && (() => {
        const MODEL_COLORS = ['#DC6B2F', '#1976d2', '#2e7d32', '#9c27b0', '#e91e63',
                              '#00838f', '#ef6c00', '#5d4037', '#455a64', '#c62828',
                              '#1b5e20', '#4a148c'];
        const temporalEffective = ALL_METRICS.includes(temporalMetric) ? temporalMetric : 'rmse';
        const hasTrainVal = TRAIN_VAL_METRICS.includes(temporalEffective);
        // Si métrique test-only et split != test/all, forcer test
        const temporalSplitEffective = (!hasTrainVal && temporalSplit !== 'test') ? 'test' : temporalSplit;
        const top = models.map((m) => m.model_name);

        const splitsToShow = temporalSplitEffective === 'all'
          ? (hasTrainVal ? ['train', 'val', 'test'] : ['test'])
          : [temporalSplitEffective];

        const SPLIT_STYLES = {
          train: { dash: 'dash', width: 1.5, opacity: 0.6, suffix: 'Train' },
          val:   { dash: 'dot',  width: 1.5, opacity: 0.7, suffix: 'Val' },
          test:  { dash: 'solid', width: 2.5, opacity: 1, suffix: 'Test' },
        };

        const traces = [];
        top.forEach((name, i) => {
          const color = MODEL_COLORS[i % MODEL_COLORS.length];
          const wins = allWindows.filter((w) => w.model === name)
            .sort((a, b) => a.window_id - b.window_id);
          const xDates = wins.map((w) => w.start_date);

          splitsToShow.forEach((sp) => {
            const style = SPLIT_STYLES[sp];
            const key = (sp === 'test' && ['mape', 'qlike', 'directional_accuracy'].includes(temporalEffective))
              ? temporalEffective : `${temporalEffective}_${sp}`;
            traces.push({
              type: 'scatter',
              mode: splitsToShow.length === 1 ? 'lines+markers' : 'lines',
              name: splitsToShow.length > 1 ? `${name} — ${style.suffix}` : name,
              x: xDates,
              y: wins.map((w) => w[key] ?? 0),
              line: { width: style.width, dash: style.dash, color },
              marker: splitsToShow.length === 1 ? { size: 4 } : undefined,
              opacity: style.opacity,
              legendgroup: name,
            });
          });
        });

        // Ligne R²=0
        if (temporalEffective === 'r2' && traces.length > 0) {
          const xs = traces[0]?.x || [];
          traces.push({
            type: 'scatter', mode: 'lines', name: 'R²=0', showlegend: false,
            x: [xs[0], xs[xs.length - 1]], y: [0, 0],
            line: { width: 1, dash: 'dash', color: '#999' },
          });
        }

        const splitLabel = temporalSplitEffective === 'all' ? 'Train / Val / Test'
          : SPLIT_LABELS[temporalSplitEffective];

        return (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField select label="Métrique" value={temporalEffective}
                onChange={(e) => setTemporalMetric(e.target.value)} sx={{ width: 280 }}>
                {ALL_METRICS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {METRIC_LABELS[m]}
                    {!TRAIN_VAL_METRICS.includes(m) ? ' (test uniquement)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Split" value={temporalSplitEffective}
                onChange={(e) => setTemporalSplit(e.target.value)} sx={{ width: 200 }}>
                <MenuItem value="train">Train</MenuItem>
                <MenuItem value="val">Validation</MenuItem>
                <MenuItem value="test">Test</MenuItem>
                <MenuItem value="all">Les 3</MenuItem>
              </TextField>
              {temporalSplitEffective === 'all' && hasTrainVal && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2px dashed #888' }} />
                    <Typography variant="caption" color="text.secondary">Train</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2px dotted #888' }} />
                    <Typography variant="caption" color="text.secondary">Validation</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 24, height: 0, borderTop: '2.5px solid #888' }} />
                    <Typography variant="caption" color="text.secondary">Test</Typography>
                  </Box>
                </Box>
              )}
              {!hasTrainVal && temporalSplit !== 'test' && (
                <Chip label="Métrique test uniquement — forcé sur Test"
                  size="small" variant="outlined" color="warning" />
              )}
            </Box>

            {temporalEffective === 'r2' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Certaines fenêtres ont un R² très négatif (IV test quasi constante).
                La synthèse globale utilise le <strong>R² poolé</strong>.
              </Alert>
            )}

            <Paper sx={{ p: 2 }}>
              <Plot
                data={traces}
                layout={{
                  title: `${METRIC_LABELS[temporalEffective]} par fenêtre — ${splitLabel}`,
                  autosize: true, height: 500,
                  xaxis: { title: 'Début fenêtre' },
                  yaxis: { title: METRIC_LABELS[temporalEffective] },
                  hovermode: 'x unified',
                  legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
                  margin: { t: 40, l: 70, r: 30, b: 80 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                }}
                config={{ displayModeBar: false }}
                style={{ width: '100%' }}
              />
            </Paper>
          </Box>
        );
      })()}

      {/* ═══════ TAB 2 — Crisis split ═══════ */}
      {tab === 2 && (
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Stabilité temporelle : Subprimes (2007-09) → COVID (2020)
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Modèles entraînés sur les Subprimes, testés (80/20), puis validés sur COVID (2020).
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField select label="Ensemble" value={crisisSplit}
              onChange={(e) => setCrisisSplit(e.target.value)} sx={{ width: 240 }}>
              <MenuItem value="train_subprime">Train Subprimes</MenuItem>
              <MenuItem value="test_subprime">Test Subprimes</MenuItem>
              <MenuItem value="val_covid">Validation COVID</MenuItem>
              <MenuItem value="all">Les 3 (groupé)</MenuItem>
            </TextField>
            <TextField select label="Métrique" value={crisisEffective}
              onChange={(e) => setCrisisMetric(e.target.value)} sx={{ width: 280 }}>
              {ALL_METRICS.map((m) => (
                <MenuItem key={m} value={m}>{METRIC_LABELS[m]}</MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Histogramme Crisis — barres groupées si "Les 3" */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Plot
              data={tab2Traces}
              layout={{
                title: `${METRIC_LABELS[crisisEffective]} — ${CRISIS_SPLIT_LABELS[crisisSplit]}`,
                barmode: 'group',
                autosize: true,
                height: Math.max(300, crisisModels.length * (crisisSplit === 'all' ? 80 : 55) + 100),
                xaxis: { title: METRIC_LABELS[crisisEffective] },
                margin: { t: 40, l: 110, r: 80, b: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                legend: crisisSplit === 'all' ? { orientation: 'h', y: -0.15 } : { visible: false },
              }}
              config={{ displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </Paper>

          {/* Tableau détaillé de l'ensemble sélectionné (ou test par défaut si "all") */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Détail — {crisisSplit === 'all' ? 'Test Subprimes' : CRISIS_SPLIT_LABELS[crisisSplit]}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE</strong></TableCell>
                  <TableCell align="right"><strong>MAE</strong></TableCell>
                  <TableCell align="right"><strong>R²</strong></TableCell>
                  <TableCell align="right"><strong>MAPE</strong></TableCell>
                  <TableCell align="right"><strong>QLIKE</strong></TableCell>
                  <TableCell align="right"><strong>Dir. Acc</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(crisisDetails)
                  .map(([name, splits]) => {
                    const sp = crisisSplit === 'all' ? 'test_subprime' : crisisSplit;
                    const s = splits[sp];
                    if (!s) return null;
                    return { model_name: name, ...s };
                  })
                  .filter(Boolean)
                  .sort((a, b) => a.rmse - b.rmse)
                  .map((m, i) => (
                    <TableRow key={m.model_name}
                      sx={{ bgcolor: i === 0 ? PWC_COLORS.orangeLight + '30' : 'inherit' }}>
                      <TableCell>{m.model_name} {i === 0 && '🏆'}</TableCell>
                      <TableCell align="right">{m.rmse?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right">{m.mae?.toFixed(5) ?? '—'}</TableCell>
                      <TableCell align="right" sx={{ color: r2Color(m.r2 ?? 0), fontWeight: 600 }}>
                        {m.r2?.toFixed(4) ?? '—'}
                      </TableCell>
                      <TableCell align="right">{m.mape?.toFixed(2) ?? '—'}%</TableCell>
                      <TableCell align="right">{m.qlike?.toFixed(3) ?? '—'}</TableCell>
                      <TableCell align="right">{m.directional_accuracy?.toFixed(1) ?? '—'}%</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Tableau comparatif RMSE + R² Subprimes vs COVID */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h4" sx={{ p: 1 }}>
              Comparaison RMSE : Test Subprimes vs Validation COVID
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Modèle</strong></TableCell>
                  <TableCell align="right"><strong>RMSE Subprimes</strong></TableCell>
                  <TableCell align="right"><strong>RMSE COVID</strong></TableCell>
                  <TableCell align="right"><strong>Ratio</strong></TableCell>
                  <TableCell align="right"><strong>R² Subprimes</strong></TableCell>
                  <TableCell align="right"><strong>R² COVID</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(crisisDetails)
                  .filter(([, s]) => s.test_subprime && s.val_covid)
                  .sort(([, a], [, b]) => a.test_subprime.rmse - b.test_subprime.rmse)
                  .map(([name, splits]) => {
                    const ratio = splits.val_covid.rmse / (splits.test_subprime.rmse || 1);
                    return (
                      <TableRow key={name}>
                        <TableCell>{name}</TableCell>
                        <TableCell align="right">{splits.test_subprime.rmse.toFixed(5)}</TableCell>
                        <TableCell align="right">{splits.val_covid.rmse.toFixed(5)}</TableCell>
                        <TableCell align="right" sx={{
                          color: ratio < 1.5 ? '#2e7d32' : ratio < 3 ? PWC_COLORS.orange : PWC_COLORS.red,
                          fontWeight: 600,
                        }}>{ratio.toFixed(2)}×</TableCell>
                        <TableCell align="right" sx={{ color: r2Color(splits.test_subprime.r2) }}>
                          {splits.test_subprime.r2.toFixed(4)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: r2Color(splits.val_covid.r2) }}>
                          {splits.val_covid.r2.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* ═══════ TAB 3 — Hyperparamètres ═══════ */}
      {tab === 3 && (
        <Grid container spacing={2}>
          {(data?.models || []).map((m) => (
            <Grid item xs={12} sm={6} md={4} key={m.model_name}>
              <Card>
                <CardContent>
                  <Typography variant="h5" sx={{ color: PWC_COLORS.orange }}>{m.model_name}</Typography>
                  <Table size="small">
                    <TableBody>
                      {Object.entries(m.hyperparameters || {}).map(([k, v]) => (
                        <TableRow key={k}>
                          <TableCell sx={{ pl: 0, color: 'text.secondary' }}>{k}</TableCell>
                          <TableCell align="right" sx={{ pr: 0 }}>{String(v)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ═══════ TAB 4 — DL Entraînement global ═══════ */}
      {tab === 4 && (
        <Box>
          {globalLoading && <Box sx={{ display:'flex', justifyContent:'center', mt:4 }}><CircularProgress /></Box>}
          {globalError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {globalError} — Lancez d'abord :
              <code> python -m app.ml.dl_test_tabular </code>
            </Alert>
          )}
          {globalData && (() => {
            const { meta, models } = globalData;
            const selectedMdl = models.find((m) => m.model_name === dlSelectedModel) || models[0];
            const hist = selectedMdl?.history || {};
            const epochs = hist.loss?.length || 0;
            const xEpochs = Array.from({ length: epochs }, (_, i) => i + 1);
            const bestEp  = selectedMdl?.best_epoch || 0;

            // Courbes : loss vs val_loss  ou  mae vs val_mae
            const yTrain = dlCurveMetric === 'loss' ? hist.loss    : hist.mae;
            const yVal   = dlCurveMetric === 'loss' ? hist.val_loss : hist.val_mae;
            const curveLabel = dlCurveMetric === 'loss' ? 'MSE Loss' : 'MAE';

            return (
              <>
                {/* Méta-info split */}
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h4" gutterBottom>Split chronologique — données hors-crise</Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {[['Train', meta.train_start, meta.train_end, meta.n_train],
                      ['Validation', meta.val_start, meta.val_end, meta.n_val],
                      ['Test', meta.test_start, meta.test_end, meta.n_test],
                    ].map(([lbl, s, e, n]) => (
                      <Box key={lbl}>
                        <Typography variant="caption" color="text.secondary">{lbl}</Typography>
                        <Typography variant="body2">{s} → {e}</Typography>
                        <Typography variant="body2" sx={{ color: PWC_COLORS.orange }}>{n?.toLocaleString()} lignes</Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* Tableau synthèse tous modèles */}
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h4" sx={{ p:1 }}>Synthèse TEST — tous modèles</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Modèle</strong></TableCell>
                        <TableCell align="right"><strong>RMSE</strong></TableCell>
                        <TableCell align="right"><strong>MAE</strong></TableCell>
                        <TableCell align="right"><strong>R²</strong></TableCell>
                        <TableCell align="right"><strong>MAPE</strong></TableCell>
                        <TableCell align="right"><strong>QLIKE</strong></TableCell>
                        <TableCell align="right"><strong>Dir.Acc</strong></TableCell>
                        <TableCell align="right"><strong>Epochs</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...models].sort((a,b)=>a.metrics.test.rmse-b.metrics.test.rmse).map((m,i) => {
                        const t = m.metrics.test;
                        return (
                          <TableRow key={m.model_name}
                            sx={{ bgcolor: i===0 ? PWC_COLORS.orangeLight+'30':'inherit',
                                  cursor:'pointer',
                                  outline: m.model_name===dlSelectedModel ? `2px solid ${PWC_COLORS.orange}` : 'none' }}
                            onClick={() => setDlSelectedModel(m.model_name)}>
                            <TableCell>{m.model_name} {i===0 && '🏆'}</TableCell>
                            <TableCell align="right">{t.rmse?.toFixed(5)}</TableCell>
                            <TableCell align="right">{t.mae?.toFixed(5)}</TableCell>
                            <TableCell align="right" sx={{ color: r2Color(t.r2??0), fontWeight:600 }}>
                              {t.r2?.toFixed(4)}
                            </TableCell>
                            <TableCell align="right">{t.mape?.toFixed(2)}%</TableCell>
                            <TableCell align="right">{t.qlike?.toFixed(3)}</TableCell>
                            <TableCell align="right">{t.dir_acc?.toFixed(1)}%</TableCell>
                            <TableCell align="right">{m.epochs_run || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Typography variant="caption" color="text.secondary" sx={{ mt:1, display:'block', pl:1 }}>
                    Cliquez sur un modèle pour afficher ses courbes ci-dessous.
                  </Typography>
                </Paper>

                {/* Sélecteurs modèle + métrique */}
                <Box sx={{ display:'flex', gap:2, mb:2, flexWrap:'wrap' }}>
                  <TextField select label="Modèle" value={dlSelectedModel}
                    onChange={(e) => setDlSelectedModel(e.target.value)} sx={{ width:200 }}>
                    {models.map((m) => (
                      <MenuItem key={m.model_name} value={m.model_name}>{m.model_name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Métrique" value={dlCurveMetric}
                    onChange={(e) => setDlCurveMetric(e.target.value)} sx={{ width:180 }}>
                    <MenuItem value="loss">MSE Loss</MenuItem>
                    <MenuItem value="mae">MAE</MenuItem>
                  </TextField>
                  {selectedMdl && (
                    <Box sx={{ display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
                      <Chip label={`${selectedMdl.n_params?.toLocaleString()} paramètres`} size="small"/>
                      <Chip label={`Best epoch : ${selectedMdl.best_epoch}`}
                        sx={{ bgcolor: PWC_COLORS.orange+'20', color: PWC_COLORS.orange }} size="small"/>
                    </Box>
                  )}
                </Box>

                {/* Courbes Training / Validation par epoch */}
                {epochs > 0 && (
                  <Paper sx={{ p:2, mb:3 }}>
                    <Typography variant="h4" sx={{ mb:1 }}>
                      Courbes d'entraînement — {selectedMdl?.model_name} — {curveLabel}
                    </Typography>
                    <Plot
                      data={[
                        { type:'scatter', mode:'lines', name:'Train',
                          x: xEpochs, y: yTrain,
                          line:{ width:2, color: PWC_COLORS.orange } },
                        { type:'scatter', mode:'lines', name:'Validation',
                          x: xEpochs, y: yVal,
                          line:{ width:2, color:'#1976d2' } },
                        // Ligne best epoch
                        { type:'scatter', mode:'lines', name:`Best (ep.${bestEp})`,
                          x:[bestEp, bestEp],
                          y:[0, Math.max(...(yTrain||[0]), ...(yVal||[0]))],
                          line:{ width:1.5, dash:'dash', color:'#2e7d32' } },
                      ]}
                      layout={{
                        autosize:true, height:400,
                        xaxis:{ title:'Epoch' },
                        yaxis:{ title: curveLabel },
                        hovermode:'x unified',
                        legend:{ orientation:'h', y:-0.2 },
                        margin:{ t:20, l:70, r:30, b:70 },
                        paper_bgcolor:'rgba(0,0,0,0)',
                      }}
                      config={{ displayModeBar:false }}
                      style={{ width:'100%' }}
                    />
                  </Paper>
                )}
                {!epochs && selectedMdl?.model_name === 'Lasso' && (
                  <Alert severity="info">
                    Lasso est un modèle linéaire : pas de courbes d'epochs.
                  </Alert>
                )}

                {/* Tableau train/val/test pour le modèle sélectionné */}
                {selectedMdl && (
                  <Paper sx={{ p:2 }}>
                    <Typography variant="h4" sx={{ p:1 }}>
                      Détail Train / Val / Test — {selectedMdl.model_name}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Split</strong></TableCell>
                          <TableCell align="right"><strong>RMSE</strong></TableCell>
                          <TableCell align="right"><strong>MAE</strong></TableCell>
                          <TableCell align="right"><strong>R²</strong></TableCell>
                          <TableCell align="right"><strong>MAPE</strong></TableCell>
                          <TableCell align="right"><strong>QLIKE</strong></TableCell>
                          <TableCell align="right"><strong>Dir.Acc</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[['Train','train'],['Validation','val'],['Test','test']].map(([lbl, key]) => {
                          const m = selectedMdl.metrics?.[key];
                          if (!m) return null;
                          return (
                            <TableRow key={key}
                              sx={{ bgcolor: key==='test' ? PWC_COLORS.orangeLight+'20' : 'inherit' }}>
                              <TableCell><strong>{lbl}</strong></TableCell>
                              <TableCell align="right">{m.rmse?.toFixed(6)}</TableCell>
                              <TableCell align="right">{m.mae?.toFixed(6)}</TableCell>
                              <TableCell align="right" sx={{ color:r2Color(m.r2??0), fontWeight:600 }}>
                                {m.r2?.toFixed(4)}
                              </TableCell>
                              <TableCell align="right">{m.mape?.toFixed(2)}%</TableCell>
                              <TableCell align="right">{m.qlike?.toFixed(3)}</TableCell>
                              <TableCell align="right">{m.dir_acc?.toFixed(1)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Paper>
                )}
              </>
            );
          })()}
        </Box>
      )}
    </Box>
  );
}
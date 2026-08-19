import React, { useState } from "react";
import { Box, Paper, Typography, Grid, Chip, Divider, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PWC_COLORS } from "../theme/pwcTheme";
import Plot from "react-plotly.js";

const EXCLUDED_WINDOWS = [
  { start: "2007-01-01", end: "2007-12-31", crisis: "Subprimes", reason: "Chevauche le début de la crise (juil 2007)" },
  { start: "2007-07-01", end: "2008-06-30", crisis: "Subprimes", reason: "Cœur de la crise des subprimes" },
  { start: "2008-01-01", end: "2008-12-31", crisis: "Subprimes", reason: "Cœur de la crise — faillite Lehman (sep 2008)" },
  { start: "2008-07-01", end: "2009-06-30", crisis: "Subprimes", reason: "Fin de crise — VIX > 80 en oct 2008" },
  { start: "2009-01-01", end: "2009-12-31", crisis: "Subprimes", reason: "Chevauche la fin de la période exclue (juin 2009)" },
  { start: "2019-07-01", end: "2020-06-30", crisis: "COVID-19",  reason: "Chevauche le début COVID (15 fév 2020)" },
  { start: "2020-01-01", end: "2020-12-31", crisis: "COVID-19",  reason: "Cœur du choc COVID — VIX atteint 82 (mars 2020)" },
  { start: "2020-07-01", end: "2021-06-30", crisis: "COVID-19",  reason: "Chevauche la fin de la période exclue (déc 2020)" },
];

const KEPT_STARTS = [
  "1996-01-01","1996-07-01","1997-01-01","1997-07-01","1998-01-01","1998-07-01",
  "1999-01-01","1999-07-01","2000-01-01","2000-07-01","2001-01-01","2001-07-01",
  "2002-01-01","2002-07-01","2003-01-01","2003-07-01","2004-01-01","2004-07-01",
  "2005-01-01","2005-07-01","2006-01-01","2006-07-01",
  "2010-01-01","2010-07-01","2011-01-01","2011-07-01","2012-01-01","2012-07-01",
  "2013-01-01","2013-07-01","2014-01-01","2014-07-01","2015-01-01","2015-07-01",
  "2016-01-01","2016-07-01","2017-01-01","2017-07-01","2018-01-01","2018-07-01",
  "2019-01-01",
  "2021-01-01","2021-07-01","2022-01-01","2022-07-01","2023-01-01","2023-07-01",
];

export default function Methodology() {
  const [tab, setTab] = useState(0);

  const windows = [
    { id: 1, start: "1996-01-01", end: "1996-12-31", train_end: "1996-09-07", val_end: "1996-10-23" },
    { id: 2, start: "1996-07-01", end: "1997-06-30", train_end: "1997-03-08", val_end: "1997-04-23" },
    { id: 3, start: "1997-01-01", end: "1997-12-31", train_end: "1997-09-07", val_end: "1997-10-23" },
  ];

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Méthodologie</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Explication détaillée de la démarche Walk-Forward et du Crisis Split utilisés pour l'évaluation des modèles.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          "& .MuiTab-root.Mui-selected": { color: PWC_COLORS.orange },
          "& .MuiTabs-indicator": { bgcolor: PWC_COLORS.orange },
        }}
      >
        <Tab label="Walk-Forward 47 fenêtres (hors crise)" />
        <Tab label="Crisis Split Subprimes & COVID" />
        <Tab label="Split 70/15/15" />
      </Tabs>

      {/* ══ WALK-FORWARD ══ */}
      {tab === 0 && (
        <Box>

          {/* Intro + cartes chiffrées */}
          <Paper sx={{ p: 3, mb: 3, borderLeft: "4px solid " + PWC_COLORS.orange }}>
            <Typography variant="h2" gutterBottom>Fenêtre glissante Walk-Forward</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              La validation walk-forward consiste à entraîner les modèles sur une fenêtre temporelle
              glissante de <strong>12 mois</strong>, puis à la faire avancer de <strong>6 mois</strong> à
              chaque itération. Sur la période 1996–2023, cela génère <strong>55 fenêtres brutes</strong>.
              Les <strong>8 fenêtres qui chevauchent une période de crise</strong> sont automatiquement
              exclues car ces crises font l'objet d'une évaluation dédiée (Crisis Split).
              Il reste <strong>47 fenêtres hors crise</strong> utilisées pour l'évaluation walk-forward.
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                { label: "Fenêtres hors crise utilisées", value: "47",        color: PWC_COLORS.orange },
                { label: "Total brut 1996–2023",           value: "55",        color: "#534AB7" },
                { label: "Exclues (crises)",               value: "−8",        color: "#D85A30" },
                { label: "Durée fenêtre",                  value: "12 mois",   color: "#185FA5" },
                { label: "Pas de glissement",              value: "6 mois",    color: "#1D9E75" },
                { label: "Période totale",                 value: "1996–2023", color: "#888" },
              ].map(item => (
                <Grid item key={item.label}>
                  <Paper sx={{ p: 2, textAlign: "center", borderTop: "3px solid " + item.color, minWidth: 130 }}>
                    <Typography variant="h3" sx={{ color: item.color, fontWeight: 700 }}>{item.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Exclusion des crises */}
          <Paper sx={{ p: 3, mb: 3, borderLeft: "4px solid #D85A30" }}>
            <Typography variant="h2" gutterBottom>Pourquoi exclure les fenêtres de crise ?</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Une fenêtre est exclue dès qu'elle <strong>chevauche, même partiellement</strong>, une
              période de crise définie dans le code (<code>EXCLUDED_PERIODS</code>). La règle appliquée est :
            </Typography>

            {/* Bloc code */}
            <Box sx={{
              bgcolor: "#F8F4FF", border: "1px solid #7B68EE44",
              borderRadius: 1, p: 2, mb: 3,
            }}>
              <Typography component="pre" sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#534AB7", m: 0, whiteSpace: "pre-wrap" }}>
{`# walk_forward.py — logique d'exclusion
EXCLUDED_PERIODS = [
    ("2007-07-01", "2009-06-30"),   # Subprimes
    ("2020-02-15", "2020-12-31"),   # COVID-19
]

def _overlaps_crisis(win_start, win_end):
    for crisis_start, crisis_end in EXCLUDED_PERIODS:
        if win_start <= crisis_end and win_end >= crisis_start:
            return True   # ← fenêtre exclue
    return False`}
              </Typography>
            </Box>

            {/* 3 raisons */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Trois raisons justifient cette exclusion :
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                {
                  num: "1", color: "#D85A30",
                  title: "Régimes hors distribution",
                  desc: "Pendant une crise, la relation features → IV change radicalement. Un modèle entraîné sur un régime normal appliqué à une fenêtre de crise produit des métriques aberrantes qui noient les performances réelles sur les 47 fenêtres normales.",
                },
                {
                  num: "2", color: "#E87722",
                  title: "Évaluation dédiée plus rigoureuse",
                  desc: "Les crises sont évaluées séparément via le Crisis Split avec un protocole adapté : entraînement sur Subprimes, validation out-of-sample sur COVID. Cela permet une analyse ciblée de la robustesse inter-crise.",
                },
                {
                  num: "3", color: "#185FA5",
                  title: "R² poolé non biaisé",
                  desc: "Une seule fenêtre de crise avec variance IV ≈ 0 peut rendre le R² poolé très négatif sur l'ensemble, masquant de bonnes performances sur les 47 fenêtres normales. L'exclusion garantit des métriques walk-forward interprétables.",
                },
              ].map(item => (
                <Grid item xs={12} md={4} key={item.num}>
                  <Paper sx={{ p: 2, borderTop: "3px solid " + item.color, height: "100%" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "0.75rem" }}>{item.num}</Typography>
                      </Box>
                      <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Tableau des 8 fenêtres exclues */}
            <Typography variant="h3" gutterBottom>Les 8 fenêtres exclues — détail</Typography>
            <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["#", "Début fenêtre", "Fin fenêtre", "Crise", "Raison de l'exclusion"].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: "#FFF0E8", color: PWC_COLORS.orange, fontSize: "0.78rem", borderBottom: "2px solid " + PWC_COLORS.orange }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {EXCLUDED_WINDOWS.map((w, i) => (
                    <TableRow key={i} sx={{ bgcolor: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.018)", "&:hover": { bgcolor: "#D85A300f" } }}>
                      <TableCell><Typography variant="caption" color="text.secondary">{i + 1}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{w.start}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{w.end}</Typography></TableCell>
                      <TableCell>
                        <Chip label={w.crisis} size="small" sx={{
                          bgcolor: w.crisis === "Subprimes" ? "#185FA522" : "#D85A3022",
                          color:   w.crisis === "Subprimes" ? "#185FA5"   : "#D85A30",
                          fontWeight: 700, fontSize: "0.68rem",
                          border: `1px solid ${w.crisis === "Subprimes" ? "#185FA555" : "#D85A3055"}`,
                        }} />
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{w.reason}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 1.5, bgcolor: "#F8F8F8", borderRadius: 1, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                💡 <strong>Note :</strong> Une fenêtre qui débute <em>avant</em> la crise mais se termine <em>pendant</em> la crise est exclue car
                ses données de test tomberaient en période de crise — c'est pourquoi les fenêtres jan 2007 et jul 2019 sont exclues
                bien qu'elles débutent avant les crises respectives.
              </Typography>
            </Box>
          </Paper>

          {/* Timeline */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>Timeline — Fenêtres conservées vs exclues (1996–2023)</Typography>
            <Plot
              data={[
                {
                  type: "scatter", mode: "none",
                  x: ["2007-07-01", "2009-06-30", "2009-06-30", "2007-07-01"],
                  y: [0, 0, 1, 1],
                  fill: "toself", fillcolor: "rgba(24,95,165,0.12)", line: { width: 0 },
                  name: "Période exclue — Subprimes", showlegend: true,
                },
                {
                  type: "scatter", mode: "none",
                  x: ["2020-02-15", "2020-12-31", "2020-12-31", "2020-02-15"],
                  y: [0, 0, 1, 1],
                  fill: "toself", fillcolor: "rgba(216,90,48,0.12)", line: { width: 0 },
                  name: "Période exclue — COVID-19", showlegend: true,
                },
                {
                  type: "scatter", mode: "markers",
                  x: EXCLUDED_WINDOWS.map(w => w.start),
                  y: EXCLUDED_WINDOWS.map(() => 0.5),
                  marker: { symbol: "x", size: 10, color: "#D85A30" },
                  name: "Fenêtres exclues (8)",
                  hovertemplate: "%{x}<extra>Exclue</extra>",
                },
                {
                  type: "scatter", mode: "markers",
                  x: KEPT_STARTS,
                  y: KEPT_STARTS.map(() => 0.5),
                  marker: { symbol: "circle", size: 8, color: "#1D9E75", opacity: 0.85 },
                  name: "Fenêtres conservées (47)",
                  hovertemplate: "%{x}<extra>Conservée</extra>",
                },
              ]}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                height: 220, margin: { l: 20, r: 20, t: 10, b: 60 },
                xaxis: { title: "Date de début de fenêtre", type: "date", range: ["1995-01-01", "2024-06-01"] },
                yaxis: { visible: false, range: [-0.2, 1.2] },
                legend: { orientation: "h", y: -0.4 },
                annotations: [
                  { x: "2008-04-01", y: 0.88, text: "Subprimes<br>5 fenêtres exclues", showarrow: false, font: { color: "#185FA5", size: 11 } },
                  { x: "2020-07-15", y: 0.88, text: "COVID<br>3 fenêtres exclues", showarrow: false, font: { color: "#D85A30", size: 11 } },
                ],
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </Paper>

          {/* Visu 3 fenêtres */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>Structure interne d'une fenêtre — 3 premiers exemples</Typography>
            <Plot
              data={windows.flatMap((w, i) => [
                { type: "bar", orientation: "h", y: [`Fenêtre ${w.id}`], x: [0.7], base: [i * 1.2],
                  marker: { color: "#185FA5", opacity: 0.8 }, name: i === 0 ? "Train (70%)" : "", showlegend: i === 0,
                  hovertemplate: `Train : ${w.start} → ${w.train_end}<extra></extra>` },
                { type: "bar", orientation: "h", y: [`Fenêtre ${w.id}`], x: [0.15], base: [i * 1.2 + 0.7],
                  marker: { color: "#EF9F27", opacity: 0.8 }, name: i === 0 ? "Validation (15%)" : "", showlegend: i === 0,
                  hovertemplate: `Val : ${w.train_end} → ${w.val_end}<extra></extra>` },
                { type: "bar", orientation: "h", y: [`Fenêtre ${w.id}`], x: [0.15], base: [i * 1.2 + 0.85],
                  marker: { color: "#D85A30", opacity: 0.8 }, name: i === 0 ? "Test (15%)" : "", showlegend: i === 0,
                  hovertemplate: `Test : ${w.val_end} → ${w.end}<extra></extra>` },
              ])}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                height: 250, margin: { l: 90, r: 20, t: 20, b: 60 },
                barmode: "stack", showlegend: true,
                legend: { orientation: "h", y: -0.3 },
                xaxis: { title: "Proportion", tickformat: ",.0%", range: [0, 1.1] },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </Paper>

          {/* Exemple fenêtre 1 */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>Exemple — Fenêtre 1 (01 Jan → 31 Déc 1996)</Typography>
            <Grid container spacing={2}>
              {[
                { label: "Début",                value: "01 Jan 1996", bg: "#185FA520" },
                { label: "Fin Train (70%)",      value: "07 Sep 1996", bg: "#185FA520" },
                { label: "Fin Validation (15%)", value: "23 Oct 1996", bg: "#EF9F2720" },
                { label: "Fin Test (15%)",       value: "31 Déc 1996", bg: "#D85A3020" },
              ].map(item => (
                <Grid item xs={12} sm={6} md={3} key={item.label}>
                  <Paper sx={{ p: 2, bgcolor: item.bg, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                    <Typography variant="subtitle1" fontWeight={700}>{item.value}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Le split est effectué de manière chronologique stricte — le modèle ne voit jamais les données futures.
              Les métriques (RMSE, MAE, MSE, R², MAPE, QLIKE, Directional Accuracy) sont calculées sur chaque fenêtre
              puis agrégées sur les <strong>47 fenêtres hors crise</strong>. Le R² est calculé en mode{" "}
              <strong>poolé</strong> : R²_poolé = 1 − Σ(y − ŷ)² / Σ(y − ȳ)².
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ══ CRISIS SPLIT ══ */}
      {tab === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderLeft: "4px solid #D85A30" }}>
            <Typography variant="h2" gutterBottom>Crisis Split — Stabilité temporelle inter-crise</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Pour évaluer la capacité des modèles à généraliser sur des régimes de volatilité radicalement
              différents, un test spécial est réalisé : les modèles sont entraînés sur la crise des Subprimes
              et validés sur la crise COVID. Ces deux crises ont des causes et des dynamiques très différentes,
              ce qui constitue un test sévère de robustesse.
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: "Crise Subprimes — Train (80%)", period: "Juil 2007 → Déc 2008", n: "8 401 obs", color: "#185FA5",
                  desc: "Crise financière systémique déclenchée par les subprimes américains. VIX > 60. Le modèle apprend les dynamiques de volatilité en période de crise bancaire." },
                { label: "Crise Subprimes — Test (20%)", period: "Jan 2009 → Juin 2009", n: "2 101 obs", color: "#EF9F27",
                  desc: "Période de sortie de crise. Le modèle doit généraliser sur la fin de la crise, avec une volatilité qui redescend progressivement." },
                { label: "COVID-19 — Validation out-of-sample", period: "15 Fév 2020 → 31 Déc 2020", n: "4 884 obs", color: "#D85A30",
                  desc: "Choc exogène brutal et instantané. VIX atteint 82 en mars 2020. Nature totalement différente des Subprimes (choc sanitaire vs crise bancaire)." },
              ].map(item => (
                <Grid item xs={12} key={item.label}>
                  <Paper sx={{ p: 2, borderLeft: "4px solid " + item.color }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                      <Chip label={item.label} size="small" sx={{ bgcolor: item.color, color: "white", fontWeight: 700 }} />
                      <Typography variant="subtitle2">{item.period}</Typography>
                      <Chip label={item.n} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>Comparaison RMSE — Subprimes vs COVID</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Un modèle stable sur les deux crises est plus fiable en production qu'un modèle spécialisé sur une seule.
            </Typography>
            <Plot
              data={[
                { type: "bar", name: "RMSE Subprimes (Test)",
                  x: ["Lasso","Ridge","RF","XGBoost","SVR","LSTM","GRU","BiLSTM","BiRNN","CNN","Transformer","MLP"],
                  y: [0.0146, 0.0156, 0.0464, 0.0404, 0.0189, 0.0246, 0.0238, 0.0205, 0.0294, 25.02, 0.0632, 13105],
                  marker: { color: "#185FA5" } },
                { type: "bar", name: "RMSE COVID (Validation)",
                  x: ["Lasso","Ridge","RF","XGBoost","SVR","LSTM","GRU","BiLSTM","BiRNN","CNN","Transformer","MLP"],
                  y: [0.1126, 0.1363, 0.0589, 0.0552, 0.1231, 0.0589, 0.0680, 0.0645, 0.0711, 34.84, 0.0894, 19005],
                  marker: { color: "#D85A30" } },
              ]}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                height: 400, margin: { l: 60, r: 20, t: 20, b: 80 },
                barmode: "group",
                xaxis: { tickangle: -30 },
                yaxis: { title: "RMSE", type: "log" },
                legend: { orientation: "h", y: -0.3 },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
            <Typography variant="caption" color="text.secondary">
              Échelle logarithmique — MLP et CNN ont des RMSE anormalement élevées (absence de normalisation en walk-forward).
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ══ SPLIT 70/15/15 ══ */}
      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Split chronologique 70 % / 15 % / 15 %</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Au sein de chaque fenêtre de 12 mois, les données sont divisées en 3 sous-ensembles
            de manière strictement chronologique — jamais aléatoire.
          </Typography>
          <Grid container spacing={3}>
            {[
              { label: "Training Set",   pct: "70 %", color: "#185FA5", role: "Apprentissage",
                desc: "Le modèle apprend les patterns sur ces données. Les paramètres sont ajustés pour minimiser l'erreur de prédiction." },
              { label: "Validation Set", pct: "15 %", color: "#EF9F27", role: "Réglage hyperparamètres",
                desc: "Utilisé pour l'early stopping des modèles DL et la sélection des hyperparamètres. Jamais utilisé pour l'entraînement." },
              { label: "Test Set",       pct: "15 %", color: "#D85A30", role: "Évaluation finale",
                desc: "Données jamais vues pendant l'entraînement. Les métriques calculées ici reflètent la généralisation réelle du modèle." },
            ].map(item => (
              <Grid item xs={12} md={4} key={item.label}>
                <Paper sx={{ p: 3, borderTop: "4px solid " + item.color, height: "100%" }}>
                  <Typography variant="h3" sx={{ color: item.color, fontWeight: 700, mb: 1 }}>{item.pct}</Typography>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>{item.label}</Typography>
                  <Chip label={item.role} size="small" sx={{ mb: 2, bgcolor: item.color + "20", color: item.color }} />
                  <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary">
            Le split chronologique est essentiel pour éviter le data leakage. Un split aléatoire permettrait
            au modèle d'apprendre des informations futures. Les métriques sont agrégées sur les{" "}
            <strong>47 fenêtres hors crise</strong>. Le R² est calculé en mode <strong>poolé</strong> :
            R²_poolé = 1 − Σ(y − ŷ)² / Σ(y − ȳ)².
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

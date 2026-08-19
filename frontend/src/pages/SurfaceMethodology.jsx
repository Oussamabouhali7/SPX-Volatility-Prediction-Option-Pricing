import React, { useState } from "react";
import { Box, Paper, Typography, Grid, Chip, Divider, Tabs, Tab } from "@mui/material";
import { PWC_COLORS } from "../theme/pwcTheme";
import Plot from "react-plotly.js";

export default function SurfaceMethodology() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Methodologie Nappe de Volatilite</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Explication complete de la construction, prediction et evaluation de la nappe IV = f(K, T)
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3,
        "& .MuiTab-root.Mui-selected": { color: PWC_COLORS.orange },
        "& .MuiTabs-indicator": { bgcolor: PWC_COLORS.orange } }}>
        <Tab label="Construction de la nappe" />
        <Tab label="Prediction par ML/DL" />
        <Tab label="Donnees temps reel" />
        <Tab label="Evaluation" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderLeft: "4px solid " + PWC_COLORS.orange }}>
            <Typography variant="h2" gutterBottom>Qu est-ce que la nappe de volatilite ?</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              La nappe de volatilite implicite (Implied Volatility Surface) est une representation 3D
              de la volatilite implicite en fonction de deux dimensions : la maturite T et le moneyness K/S.
              Elle est extraite par inversion de la formule de Black-Scholes a partir des prix de marche des options.
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: "Axe X", value: "Moneyness (K/S-1)x100", color: "#185FA5", desc: "Valeurs positives = calls OTM (K > S). Plus la valeur est grande, plus l option est hors de la monnaie." },
                { label: "Axe Y", value: "Maturite (jours)", color: "#1D9E75", desc: "De 30 a 730 jours. La volatilite varie selon la maturite (term structure)." },
                { label: "Axe Z", value: "Volatilite implicite", color: PWC_COLORS.orange, desc: "IV extraite par Newton-Raphson. Reflète les anticipations du marche sur la volatilite future." },
              ].map(item => (
                <Grid item xs={12} md={4} key={item.label}>
                  <Paper sx={{ p: 2, borderTop: "3px solid " + item.color }}>
                    <Chip label={item.label} size="small" sx={{ bgcolor: item.color, color: "white", mb: 1 }} />
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>{item.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>Grille de points</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              La nappe est construite sur une grille fixe de 170 points (10 maturites x 17 moneyness).
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: "#185FA510" }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Maturites (10 points)</Typography>
                  <Typography variant="body2" color="text.secondary">
                    30 · 60 · 91 · 122 · 152 · 182 · 273 · 365 · 547 · 730 jours
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: PWC_COLORS.orange + "10" }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Moneyness positifs (17 points)</Typography>
                  <Typography variant="body2" color="text.secondary">
                    10 · 15 · 20 · 25 · 30 · 35 · 40 · 45 · 50 · 55 · 60 · 65 · 70 · 75 · 80 · 85 · 90
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>Caracteristiques de la nappe SPX</Typography>
            <Plot
              data={[
                { type: "scatter", mode: "lines", name: "Smile court terme (30j)",
                  x: [10,20,30,40,50,60,70,80,90],
                  y: [0.22,0.21,0.20,0.20,0.21,0.22,0.23,0.25,0.27],
                  line: { color: PWC_COLORS.orange, width: 2 } },
                { type: "scatter", mode: "lines", name: "Smile moyen terme (182j)",
                  x: [10,20,30,40,50,60,70,80,90],
                  y: [0.20,0.195,0.19,0.19,0.195,0.20,0.21,0.22,0.23],
                  line: { color: "#185FA5", width: 2 } },
                { type: "scatter", mode: "lines", name: "Smile long terme (730j)",
                  x: [10,20,30,40,50,60,70,80,90],
                  y: [0.19,0.185,0.182,0.182,0.185,0.19,0.195,0.20,0.21],
                  line: { color: "#1D9E75", width: 2 } },
              ]}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                height: 300, margin: { l: 60, r: 20, t: 20, b: 60 },
                xaxis: { title: "Moneyness (K/S-1)x100" },
                yaxis: { title: "Volatilite implicite" },
                legend: { orientation: "h", y: -0.3 },
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Le smile s aplatit avec la maturite (volatility cone). Pour les moneyness positifs (calls OTM),
              l IV augmente avec le moneyness — c est le smile de volatilite cote calls.
            </Typography>
          </Paper>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderLeft: "4px solid " + PWC_COLORS.orange }}>
            <Typography variant="h2" gutterBottom>Comment le modele predit la nappe ?</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Le modele predit l IV point par point sur la grille. Pour chaque combinaison
              (tenor_t, moneyness_m), un vecteur de features est construit et passe au modele.
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: "Features marche (fixes pour toute la nappe)", items: ["VIX du jour", "Taux sans risque", "Forward SPX", "HVol 30j et 60j", "Rendement SPX"], color: "#185FA5" },
                { label: "Features geometriques (specifiques au point)", items: ["moneyness = m/100", "log_tenor = log(t)", "sqrt_tenor = vt", "moneyness_norm = m/90", "mny_x_logt = m x log(t)"], color: PWC_COLORS.orange },
              ].map(section => (
                <Grid item xs={12} md={6} key={section.label}>
                  <Paper sx={{ p: 2, borderTop: "3px solid " + section.color, height: "100%" }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: section.color }}>
                      {section.label}
                    </Typography>
                    {section.items.map(item => (
                      <Typography key={item} variant="body2" color="text.secondary">• {item}</Typography>
                    ))}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h2" gutterBottom>Pipeline de prediction</Typography>
            {[
              { step: "1", title: "Recuperation des conditions de marche", desc: "VIX, taux, forward, HVol du jour choisi (Yahoo Finance ou options_merged_spx.csv)", color: "#185FA5" },
              { step: "2", title: "Construction de la grille 10 x 17", desc: "Pour chaque (tenor, moneyness) de la grille fixe, construction du vecteur de features", color: "#1D9E75" },
              { step: "3", title: "Prediction par le modele ML/DL", desc: "IV(t, m) = Modele.predict(features_marche + features_geometriques)", color: PWC_COLORS.orange },
              { step: "4", title: "Construction de la matrice Z (10 x 17)", desc: "Assemblage des 170 predictions en une matrice pour le rendu 3D Plotly", color: "#534AB7" },
            ].map(item => (
              <Box key={item.step} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: item.color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                  {item.step}
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>Limites de l approche</Typography>
            {[
              { limit: "Features incompletes", desc: "Delta, gamma, vega sont inconnus pour les points hypothetiques → mis a 0 lors de la prediction de nappe" },
              { limit: "MLP et CNN non normalises", desc: "Ces modeles ont des RMSE tres elevees (ex: MLP=996, CNN=7.46) → leurs nappes sont peu fiables" },
              { limit: "Extrapolation hors echantillon", desc: "Les modeles entraines sur 1996-2023 peuvent se degrader sur des regimes jamais vus (crises futures)" },
              { limit: "Moneyness positifs uniquement", desc: "La nappe ne couvre que la partie calls OTM (K > S). Les puts OTM (K < S) ne sont pas predits" },
            ].map(item => (
              <Box key={item.limit} sx={{ mb: 2, p: 2, bgcolor: "#D85A3010", borderLeft: "3px solid #D85A30", borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#D85A30" }}>{item.limit}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Donnees temps reel via Yahoo Finance</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            A chaque ouverture de l application, les donnees de marche du jour sont automatiquement
            telechargees depuis Yahoo Finance pour predire la nappe du jour.
          </Typography>
          {[
            { source: "^GSPC (S&P 500)", donnees: ["Close → SPX spot", "High/Low → daily range", "Returns → rendement journalier", "Std(returns) → HVol 30j et 60j"], color: "#185FA5" },
            { source: "^VIX (CBOE VIX)", donnees: ["Close → VIX du jour", "Proxy de la volatilite implicite ATM 30j"], color: PWC_COLORS.orange },
            { source: "^TNX (US 10Y Treasury)", donnees: ["Close / 100 → taux sans risque", "Utilise comme taux d actualisation"], color: "#1D9E75" },
          ].map(item => (
            <Paper key={item.source} sx={{ p: 2, mb: 2, borderLeft: "4px solid " + item.color }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: item.color, mb: 1 }}>{item.source}</Typography>
              {item.donnees.map(d => (
                <Typography key={d} variant="body2" color="text.secondary">• {d}</Typography>
              ))}
            </Paper>
          ))}
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Si Yahoo Finance est indisponible (connexion internet coupee), un message d erreur s affiche
            et vous pouvez utiliser le mode simulation manuelle pour entrer les parametres manuellement.
          </Typography>
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>Evaluation des nappes predites</Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Pour les periodes ou la nappe observee est disponible (1996-2008),
            on peut comparer la nappe predite a la nappe reelle et calculer des metriques.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { metric: "RMSE", formula: "sqrt(mean((IV_pred - IV_obs)^2))", desc: "Erreur quadratique moyenne. Penalise les grandes erreurs." },
              { metric: "MAE", formula: "mean(|IV_pred - IV_obs|)", desc: "Erreur absolue moyenne. Plus robuste aux outliers." },
              { metric: "R2", formula: "1 - SS_res / SS_tot", desc: "Coefficient de determination. 1 = prediction parfaite." },
              { metric: "MAPE", formula: "mean(|IV_pred - IV_obs| / IV_obs)", desc: "Erreur relative en pourcentage. Utile pour comparer entre regimes." },
            ].map(item => (
              <Grid item xs={12} md={6} key={item.metric}>
                <Paper sx={{ p: 2, borderTop: "3px solid " + PWC_COLORS.orange }}>
                  <Typography variant="h3" sx={{ color: PWC_COLORS.orange, fontWeight: 700 }}>{item.metric}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "monospace", bgcolor: "#f5f5f5", px: 1, display: "inline-block", mb: 1 }}>
                    {item.formula}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary">
            Les metriques sont calculees point par point sur toute la grille (170 points par date)
            puis moyennees. Un bon modele doit avoir RMSE faible et R2 proche de 1 sur toutes les
            zones de la nappe, y compris les extremes (moneyness eleve, maturites courtes).
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
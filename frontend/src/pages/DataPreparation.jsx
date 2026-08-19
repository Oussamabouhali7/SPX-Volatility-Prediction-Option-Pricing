// pages/DataPreparation.jsx — Préparation des données (CRISP-DM étape 3)
import React, { useState } from 'react';
import {
  Box, Paper, Typography, Chip, Grid, Divider,
  Accordion, AccordionSummary, AccordionDetails, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PWC_COLORS } from '../theme/pwcTheme';

// ─── Palette sémantique ────────────────────────────────────────────────────
const C = {
  leakage:    '#D85A30',
  constant:   '#888888',
  redundant:  '#185FA5',
  transform:  '#7B68EE',
  hvol:       '#E87722',
  kept:       '#1D9E75',
  derived:    '#DC6B2F',
  target:     '#B71C1C',
};

const Tag = ({ type, label }) => (
  <Chip label={label ?? type} size="small" sx={{
    bgcolor: C[type] + '22', color: C[type],
    fontWeight: 700, fontSize: '0.7rem',
    border: `1px solid ${C[type]}55`,
  }} />
);

// ─── Données ───────────────────────────────────────────────────────────────
const ELIMINATED = [
  {
    type: 'leakage',
    title: 'Fuite de données directe (Data Leakage)',
    subtitle: '2 colonnes : mid · last',
    vars: [
      {
        col: 'mid',
        def: "Prix médian entre le bid et l'ask de l'option au moment de la cotation.",
        why: `La volatilité implicite (iv) est calculée en inversant numériquement la formule 
Black-Scholes à partir du prix mid : iv = BS⁻¹(mid, K, S, T, r). 
Inclure mid comme feature revient à donner la réponse au modèle avant qu'il la calcule. 
Le modèle apprendrait simplement à recalculer iv depuis son propre prix source, 
et afficherait des R² artificiellement parfaits (≈ 1.0) sans généralisation réelle.`,
        method: 'Exclusion manuelle — source directe de la variable cible',
        example: 'Si mid = 12.50 €, le modèle recalcule IV = 0.22 sans rien apprendre.',
      },
      {
        col: 'last',
        def: "Dernier prix de transaction enregistré pour ce contrat d'option.",
        why: `Même problème que mid : très corrélé avec mid sur les marchés liquides (≈ même valeur). 
En périodes de faible liquidité, last peut être obsolète (transaction d'il y a plusieurs heures), 
ce qui le rend encore plus dangereux car il introduit un biais temporel en plus du leakage.`,
        method: "Exclusion manuelle — proxy direct de la cible, biais temporel possible",
        example: "last = 12.30 € (transaction de 14h00) alors que mid = 12.55 € (18h00) → leakage + staleness.",
      },
    ],
  },
  {
    type: 'constant',
    title: 'Variable constante — zéro variance',
    subtitle: '1 colonne : underlying',
    vars: [
      {
        col: 'underlying',
        def: "Nom du sous-jacent de l'option.",
        why: `Cette colonne contient uniquement la valeur "SPX" pour les 146 370 observations. 
Une variable constante apporte strictement zéro information discriminante : 
sa variance est nulle, donc sa corrélation avec n'importe quelle autre variable est indéfinie. 
Les modèles linéaires (Lasso, Ridge) lui attribuent un coefficient de 0 ; 
les arbres (RF, XGBoost) ne l'utilisent jamais pour un split.`,
        method: 'Exclusion manuelle — variance = 0, aucune valeur prédictive',
        example: '"SPX" sur les 146 370 lignes. Pas de diversité = pas d\'information.',
      },
    ],
  },
  {
    type: 'redundant',
    title: 'Redondance avec une variable existante',
    subtitle: '1 colonne : close_spy',
    vars: [
      {
        col: 'close_spy',
        def: "Cours de clôture de l'ETF SPDR S&P 500 (SPY), répliquant l'indice S&P 500.",
        why: `SPY est un ETF qui réplique le S&P 500 à 1/10ème de sa valeur. 
close_spy ≈ close_gspc / 10 avec une corrélation de Pearson > 0.9999. 
Inclure les deux colonnes introduit une multicolinéarité quasi-parfaite qui : 
(1) déstabilise les modèles linéaires (instabilité des coefficients), 
(2) dilue artificiellement l'importance des features dans RF/XGBoost, 
(3) n'ajoute aucune information nouvelle.
On conserve close_gspc car c'est l'indice de référence officiel pour les options SPX.`,
        method: 'Exclusion manuelle — corrélation > 0.9999 avec close_gspc (VIF → ∞)',
        example: 'close_spy ≈ 450.32, close_gspc ≈ 4503.2 → ratio constant ≈ 10.',
      },
    ],
  },
  {
    type: 'transform',
    title: 'Remplacées par des transformations plus informatives',
    subtitle: '4 colonnes brutes → nouvelles features',
    vars: [
      {
        col: 'put_call',
        def: "Type de l'option : 'C' pour Call, 'P' pour Put.",
        why: `Variable catégorielle textuelle non numérique. 
Les modèles ML nécessitent des entrées numériques. 
On encode en variable binaire is_call ∈ {0, 1} ce qui est équivalent 
et directement interprétable par tous les modèles (coefficient = différence d'IV Call vs Put).`,
        method: 'Encodage binaire : is_call = 1 si put_call == "C", sinon 0',
        example: '"C" → 1, "P" → 0. Conserve 100 % de l\'information.',
      },
      {
        col: 'expiry',
        def: "Date d'expiration du contrat d'option (format JJ/MM/AAAA).",
        why: `La date d'expiration brute est inutilisable directement : 
une option expirant le 15/01/2010 n'a pas la même signification en 2009 qu'en 2008. 
Ce qui compte pour le pricing, c'est la durée restante jusqu'à l'expiration. 
On calcule tenor_d = expiry − date (jours calendaires), puis log_tenor, sqrt_tenor, tenor_years 
pour capturer la structure par terme non-linéaire de la volatilité.`,
        method: 'Transformation : tenor_d = (expiry − date).days → puis log, sqrt, /365',
        example: 'expiry=15/01/2020, date=01/12/2019 → tenor_d=45j → log_tenor=3.81, tenor_years=0.123',
      },
      {
        col: 'strike',
        def: "Prix d'exercice du contrat d'option, en valeur absolue en dollars.",
        why: `Le strike brut est non-stationnaire : un strike de 1500 $ représentait une option 
ATM en 2013 (SPX ≈ 1500) mais une option profondément ITM en 2023 (SPX ≈ 4500). 
Un modèle entraîné sur 1996-2015 ne peut pas généraliser sur 2020-2023 avec des strikes absolus. 
La solution est moneyness = K/S − 1 : un put 10 % OTM vaut toujours −0.10, 
quelle que soit la période. La relation moneyness → IV est stable dans le temps.`,
        method: 'Normalisation : moneyness = strike / close_gspc − 1 → puis log, abs, ², × log_tenor',
        example: 'strike=4000, close_gspc=4444 → moneyness=−0.10 (put 10% OTM) · invariant temporellement.',
      },
      {
        col: 'date',
        def: "Date de cotation de l'option (format JJ/MM/AAAA).",
        why: `La date brute ne peut pas être une feature prédictive directe : 
le modèle apprendrait des effets de calendrier spécifiques à l'historique d'entraînement 
et ne généraliserait pas. Elle est utilisée pour : 
(1) calculer tenor_d = expiry − date, 
(2) ordonner chronologiquement les données pour le walk-forward, 
(3) identifier les périodes de crise (Subprimes 2007-2009, COVID 2020).`,
        method: "Exclusion comme feature — utilisée uniquement pour l'ingénierie temporelle et le split",
        example: 'date=01/03/2020 → identifie la fenêtre COVID, utilisée pour exclure cette période du walk-forward.',
      },
    ],
  },
  {
    type: 'hvol',
    title: 'Volatilités historiques redondantes — sélection des horizons représentatifs',
    subtitle: '6 colonnes : hvol_14d · hvol_122d · hvol_152d · hvol_273d · hvol_547d · hvol_1825d',
    vars: [
      {
        col: 'hvol_14d',
        def: 'Volatilité réalisée sur les 14 derniers jours de trading.',
        why: `Très fortement corrélée avec hvol_10d (corrélation > 0.97). 
Les deux capturent la volatilité à très court terme. 
Conserver les deux apporte une multicolinéarité sans valeur ajoutée. 
hvol_10d est conservé comme représentant du court terme (2 semaines de trading).`,
        method: 'Élimination par redondance — corrélation > 0.97 avec hvol_10d conservé',
        example: 'hvol_10d=0.18, hvol_14d=0.17 → quasi-identiques, hvol_10d suffit.',
      },
      {
        col: 'hvol_122d',
        def: 'Volatilité réalisée sur 122 jours (~4 mois de trading).',
        why: `Se situe entre hvol_91d (3 mois) et hvol_182d (6 mois), 
tous deux conservés. La corrélation avec ces deux voisins dépasse 0.95. 
La couverture temporelle est assurée par les horizons 91j et 182j.`,
        method: 'Élimination par redondance — interpolable entre hvol_91d et hvol_182d conservés',
        example: 'Horizons conservés : 10j · 30j · 60j · 91j · 182j · 365j · 730j.',
      },
      {
        col: 'hvol_152d',
        def: 'Volatilité réalisée sur 152 jours (~5 mois de trading).',
        why: `Même raisonnement que hvol_122d. 
Trop proche de hvol_182d pour apporter un signal différencié. 
Inclure 13 horizons HVol avec des corrélations > 0.90 entre voisins 
gonfle artificiellement la dimensionnalité sans améliorer le modèle.`,
        method: 'Élimination par redondance — trop proche de hvol_182d (corr > 0.95)',
        example: null,
      },
      {
        col: 'hvol_273d',
        def: 'Volatilité réalisée sur 273 jours (~9 mois de trading).',
        why: `Se situe entre hvol_182d (6 mois) et hvol_365d (12 mois) conservés. 
Corrélation > 0.96 avec ses deux voisins. Aucun signal additionnel.`,
        method: 'Élimination par redondance — interpolable entre hvol_182d et hvol_365d',
        example: null,
      },
      {
        col: 'hvol_547d',
        def: 'Volatilité réalisée sur 547 jours (~18 mois de trading).',
        why: `Se situe entre hvol_365d (1 an) et hvol_730d (2 ans) conservés. 
Même raisonnement : corrélation > 0.97 avec ses voisins, 
information entièrement capturée par les horizons adjacents.`,
        method: 'Élimination par redondance — interpolable entre hvol_365d et hvol_730d',
        example: null,
      },
      {
        col: 'hvol_1825d',
        def: 'Volatilité réalisée sur 1825 jours (5 ans de trading).',
        why: `Horizon de 5 ans trop lisse pour différencier les régimes de volatilité actuels. 
La corrélation avec iv est plus faible qu'avec hvol_730d. 
En pratique, aucun produit optionnel standard n'a une maturité > 2-3 ans, 
donc cet horizon long n'a pas d'ancrage économique pour le pricing.`,
        method: 'Élimination — horizon hors du domaine de validité des options SPX standard',
        example: 'Les LEAPS SPX vont rarement au-delà de 2 ans. hvol_730d couvre déjà le long terme.',
      },
    ],
  },
];

const DERIVED = [
  { col: 'moneyness',     formula: 'K / S − 1',              from: 'strike, close_gspc',   desc: 'Position relative de l\'option par rapport au spot. Stationnaire dans le temps.' },
  { col: 'log_moneyness', formula: 'ln(K / S)',               from: 'strike, close_gspc',   desc: 'Version symétrique de la moneyness. Utilisée dans les modèles SABR et SVI.' },
  { col: 'moneyness_abs', formula: '|K / S − 1|',            from: 'moneyness',             desc: 'Distance au strike ATM sans signe. Corrélée positivement avec le smile.' },
  { col: 'moneyness_sq',  formula: '(K / S − 1)²',           from: 'moneyness',             desc: 'Terme quadratique pour capturer la courbure (wings) du smile.' },
  { col: 'tenor_d',       formula: '(expiry − date).days',   from: 'expiry, date',          desc: 'Durée résiduelle en jours. Base de toutes les features de maturité.' },
  { col: 'log_tenor',     formula: 'ln(tenor_d)',             from: 'tenor_d',               desc: 'Linéarise la relation maturité → IV. Très discriminant (feature top-3).' },
  { col: 'sqrt_tenor',    formula: '√tenor_d',               from: 'tenor_d',               desc: 'Issu de la théorie brownienne : volatilité cumulative ∝ √T.' },
  { col: 'tenor_years',   formula: 'tenor_d / 365',          from: 'tenor_d',               desc: 'Format standard du pricing (Black-Scholes utilise T en années).' },
  { col: 'mny_x_logt',   formula: 'moneyness × ln(tenor_d)', from: 'moneyness, log_tenor',  desc: 'Interaction smile × terme : le smile s\'aplatit avec la maturité.' },
  { col: 'is_call',       formula: '1 si put_call=="C" else 0', from: 'put_call',            desc: 'Encodage binaire du type d\'option. Neutre avec la parité call-put.' },
];

const SCALER_STEPS = [
  { step: '1', title: 'Fit sur X_train uniquement', desc: 'Le StandardScaler calcule μ et σ uniquement sur les données d\'entraînement. Il ne voit jamais X_val ni X_test pendant le fit.', important: true },
  { step: '2', title: 'Transform sur X_train, X_val, X_test', desc: 'X_scaled = (X − μ_train) / σ_train. Les trois splits sont transformés avec les paramètres du train.', important: false },
  { step: '3', title: 'Sauvegarde dans scaler.pkl', desc: 'Le scaler fitté est sérialisé. À l\'inférence, les nouvelles features sont transformées avec exactement les mêmes μ et σ qu\'à l\'entraînement.', important: true },
];

// ─── Composant ─────────────────────────────────────────────────────────────
export default function DataPreparation() {
  const [expanded, setExpanded] = useState('leakage');
  const handleAccordion = (panel) => (_, isExpanded) => setExpanded(isExpanded ? panel : false);

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Préparation des données</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        CRISP-DM étape 3 · Transformation du fichier brut{' '}
        <code>options_merged_spx.csv</code> (32 colonnes) vers les
        <strong> 27 features + 1 cible</strong> utilisées par les modèles.
      </Typography>

      {/* ── PIPELINE VISUELLE ──────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" gutterBottom>Vue d'ensemble du pipeline</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {[
            { label: 'CSV brut', sub: '32 colonnes', bg: '#EBF2FB', border: C.redundant },
            null,
            { label: 'Élimination', sub: '−11 colonnes', bg: '#FEF0EC', border: C.leakage },
            null,
            { label: 'Transformation', sub: '4 → 10 features', bg: '#F3F1FF', border: C.transform },
            null,
            { label: 'Nettoyage', sub: 'dropna(iv)\ntenor_d > 0', bg: '#EAF7F3', border: C.kept },
            null,
            { label: 'StandardScaler', sub: 'fit on X_train', bg: '#FFF4EB', border: C.hvol },
            null,
            { label: 'Résultat', sub: '27 features + iv', bg: '#F5F5F5', border: C.constant },
          ].map((item, i) =>
            item === null ? (
              <Typography key={i} sx={{ color: '#bbb', fontSize: '1.4rem', mx: 0.5 }}>→</Typography>
            ) : (
              <Box key={i} sx={{
                px: 2, py: 1.2, borderRadius: 2, textAlign: 'center',
                bgcolor: item.bg, border: `2px solid ${item.border}55`, minWidth: 110,
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: item.border }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: '#666', whiteSpace: 'pre-line', mt: 0.3 }}>
                  {item.sub}
                </Typography>
              </Box>
            )
          )}
        </Box>

        {/* Légende */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
          {[
            ['leakage',   'Leakage direct'],
            ['constant',  'Constante'],
            ['redundant', 'Redondance'],
            ['transform', 'Transformée'],
            ['hvol',      'HVol redondant'],
            ['kept',      'Conservée brute'],
            ['derived',   'Feature dérivée'],
            ['target',    'Cible (iv)'],
          ].map(([type, label]) => <Tag key={type} type={type} label={label} />)}
        </Box>
      </Paper>

      {/* ── RÉSUMÉ CHIFFRÉ ─────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { n: '32', label: 'Colonnes CSV brutes', color: C.redundant },
          { n: '−4', label: 'Leakage + Constante + Redondance', color: C.leakage },
          { n: '−4', label: 'Colonnes remplacées par transformations', color: C.transform },
          { n: '−6', label: 'HVol redondants éliminés', color: C.hvol },
          { n: '+10', label: 'Features dérivées créées', color: C.derived },
          { n: '27+1', label: 'Features finales + cible iv', color: C.kept },
        ].map((item, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Paper sx={{ p: 2, textAlign: 'center', border: `2px solid ${item.color}44`, bgcolor: item.color + '0D' }}>
              <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>
                {item.n}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, mt: 0.5, display: 'block' }}>
                {item.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── VARIABLES ÉLIMINÉES ────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" gutterBottom>Variables éliminées — détail et justification</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          11 colonnes du CSV ne sont pas utilisées comme features. Chaque groupe a une raison distincte.
        </Typography>

        {ELIMINATED.map((group) => (
          <Accordion
            key={group.type}
            expanded={expanded === group.type}
            onChange={handleAccordion(group.type)}
            sx={{ mb: 1, border: `1px solid ${C[group.type]}33`, '&:before': { display: 'none' }, borderRadius: '8px !important' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: C[group.type] }} />}
              sx={{ bgcolor: C[group.type] + '0D', borderRadius: 2 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Tag type={group.type} label={group.title} />
                <Typography variant="body2" color="text.secondary">{group.subtitle}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Divider sx={{ mb: 2 }} />
              {group.vars.map((v, i) => (
                <Box key={v.col} sx={{
                  mb: i < group.vars.length - 1 ? 3 : 0,
                  pl: 2,
                  borderLeft: `3px solid ${C[group.type]}`,
                }}>
                  {/* Nom de la colonne */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography sx={{
                      fontFamily: 'monospace', fontWeight: 700,
                      color: C[group.type], fontSize: '1rem',
                      bgcolor: C[group.type] + '15', px: 1, py: 0.2, borderRadius: 1,
                    }}>
                      {v.col}
                    </Typography>
                    <Tag type={group.type} label={
                      group.type === 'leakage'   ? 'Leakage' :
                      group.type === 'constant'  ? 'Constante' :
                      group.type === 'redundant' ? 'Redondance' :
                      group.type === 'transform' ? 'Transformée' : 'HVol redondant'
                    } />
                  </Box>

                  {/* Définition */}
                  <Typography variant="body2" sx={{ mb: 0.8 }}>
                    <strong>Définition :</strong> {v.def}
                  </Typography>

                  {/* Pourquoi */}
                  <Typography variant="body2" sx={{ mb: 0.8, whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                    <strong>Pourquoi éliminé :</strong> {v.why}
                  </Typography>

                  {/* Méthode */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: v.example ? 0.8 : 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: C[group.type], whiteSpace: 'nowrap', mt: 0.2 }}>
                      Méthode :
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{v.method}</Typography>
                  </Box>

                  {/* Exemple */}
                  {v.example && (
                    <Box sx={{ mt: 1, bgcolor: '#F8F8F8', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#555' }}>
                        💡 {v.example}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* ── FEATURES DÉRIVÉES ──────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" gutterBottom>Features dérivées créées par feature engineering</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          10 nouvelles features construites à partir des colonnes sources pour capturer
          des relations non-linéaires que les modèles linéaires ne pourraient pas apprendre seuls.
        </Typography>
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Feature créée', 'Formule', 'Source(s)', 'Rôle dans le modèle'].map(h => (
                  <TableCell key={h} sx={{
                    fontWeight: 700, bgcolor: '#FFF0E8',
                    color: C.derived, fontSize: '0.78rem',
                    borderBottom: `2px solid ${C.derived}`,
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {DERIVED.map((row, i) => (
                <TableRow key={row.col} sx={{
                  bgcolor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.018)',
                  '&:hover': { bgcolor: `${C.derived}0f` },
                }}>
                  <TableCell>
                    <Typography sx={{
                      fontFamily: 'monospace', fontWeight: 700,
                      color: C.derived, fontSize: '0.82rem',
                    }}>
                      {row.col}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#333' }}>
                      {row.formula}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: C.redundant, fontFamily: 'monospace' }}>
                      {row.from}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="caption" color="text.secondary">{row.desc}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── STANDARDSCALER ─────────────────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" gutterBottom>Normalisation — StandardScaler</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Les 27 features ont des échelles très différentes (moneyness ∈ [−0.5, +0.5]
          vs close_gspc ∈ [300, 5000]). La normalisation est essentielle pour
          les modèles linéaires et les réseaux de neurones.
        </Typography>
        <Grid container spacing={2}>
          {SCALER_STEPS.map((s) => (
            <Grid item xs={12} md={4} key={s.step}>
              <Box sx={{
                p: 2, borderRadius: 2, height: '100%',
                border: `2px solid ${s.important ? C.hvol : C.constant}55`,
                bgcolor: s.important ? C.hvol + '0A' : '#FAFAFA',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    bgcolor: s.important ? C.hvol : C.constant,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>{s.step}</Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{s.title}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">{s.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 2, bgcolor: '#FFF8F2', border: `1px solid ${C.hvol}44`, borderRadius: 1, p: 2 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#555' }}>
            ⚠️ Erreur évitée : dans la version initiale, le StandardScaler était instancié
            4 fois dans train_all.py (dont 3 hors de la boucle walk-forward).
            Le scaler.pkl sauvegardé était quasi-identité (μ≈0, σ≈1 aléatoires) → IV aberrantes à l'inférence.
            Corrigé : 1 seul scaler fitté sur X_train par fenêtre, sauvegardé une seule fois.
          </Typography>
        </Box>
      </Paper>

      {/* ── BILAN FINAL ────────────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" gutterBottom>Bilan — Tableau récapitulatif des 32 colonnes</Typography>
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['#', 'Colonne CSV', 'Statut', 'Feature(s) résultante(s)', 'Raison'].map(h => (
                  <TableCell key={h} sx={{
                    fontWeight: 700, bgcolor: '#F5F5F5',
                    color: '#333', fontSize: '0.78rem',
                    borderBottom: '2px solid #ccc',
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                [1,  'date',         'transform', '—',              'Utilisée pour tenor_d et walk-forward uniquement'],
                [2,  'underlying',   'constant',  '—',              'Constante "SPX" — zéro variance'],
                [3,  'put_call',     'transform', 'is_call',        'Encodage binaire C→1, P→0'],
                [4,  'expiry',       'transform', 'tenor_d + dérivées', 'Remplacée par durée résiduelle'],
                [5,  'strike',       'transform', 'moneyness + dérivées', 'Normalisé par K/S−1 (stationnarité)'],
                [6,  'mid',          'leakage',   '—',              'Source directe de iv — leakage'],
                [7,  'last',         'leakage',   '—',              'Proxy de mid — leakage'],
                [8,  'iv',           'target',    'iv (cible)',      'Variable à prédire'],
                [9,  'delta',        'kept',       'delta',          'Greek — conservé directement'],
                [10, 'gamma',        'kept',       'gamma',          'Greek — conservé directement'],
                [11, 'vega',         'kept',       'vega',           'Greek — conservé directement'],
                [12, 'theta',        'kept',       'theta',          'Greek — conservé directement'],
                [13, 'open_interest','kept',       'open_interest',  'Liquidité — conservé directement'],
                [14, 'volume',       'kept',       'volume',         'Liquidité — conservé directement'],
                [15, 'close_spy',    'redundant',  '—',              'Corrélation > 0.9999 avec close_gspc'],
                [16, 'close_gspc',   'kept',       'close_gspc',     'Sous-jacent SPX — conservé + sert à moneyness'],
                [17, 'vix',          'kept',       'vix',            'Indice de peur CBOE — proxy de régime'],
                [18, 'rate_10y',     'kept',       'rate_10y',       'Taux sans risque Black-Scholes'],
                [19, 'hvol_10d',     'kept',       'hvol_10d',       'Court terme — représentatif conservé'],
                [20, 'hvol_14d',     'hvol',        '—',             'Redondant avec hvol_10d (corr > 0.97)'],
                [21, 'hvol_30d',     'kept',       'hvol_30d',       'Horizon de référence — conservé'],
                [22, 'hvol_60d',     'kept',       'hvol_60d',       '2 mois — conservé'],
                [23, 'hvol_91d',     'kept',       'hvol_91d',       'Trimestriel — conservé'],
                [24, 'hvol_122d',    'hvol',        '—',             'Redondant entre 91d et 182d'],
                [25, 'hvol_152d',    'hvol',        '—',             'Redondant entre 91d et 182d'],
                [26, 'hvol_182d',    'kept',       'hvol_182d',      'Semestriel — conservé'],
                [27, 'hvol_273d',    'hvol',        '—',             'Redondant entre 182d et 365d'],
                [28, 'hvol_365d',    'kept',       'hvol_365d',      'Annuel — conservé'],
                [29, 'hvol_547d',    'hvol',        '—',             'Redondant entre 365d et 730d'],
                [30, 'hvol_730d',    'kept',       'hvol_730d',      'Long terme (2 ans) — conservé'],
                [31, 'hvol_1825d',   'hvol',        '—',             'Hors domaine options standard (> 2 ans)'],
                [32, 'fwd_front',    'kept',       'fwd_front',      'Prix forward front month — conservé'],
              ].map(([num, col, type, result, reason], i) => (
                <TableRow key={num} sx={{
                  bgcolor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.018)',
                  '&:hover': { bgcolor: `${C[type] ?? '#eee'}0f` },
                }}>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{num}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem', color: C[type] ?? '#333' }}>
                      {col}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tag type={type} label={
                      type === 'leakage'   ? 'Leakage'     :
                      type === 'constant'  ? 'Constante'   :
                      type === 'redundant' ? 'Redondance'  :
                      type === 'transform' ? 'Transformée' :
                      type === 'hvol'      ? 'HVol redond.':
                      type === 'kept'      ? 'Conservée'   :
                      type === 'derived'   ? 'Dérivée'     : 'Cible'
                    } />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: result === '—' ? '#bbb' : C.derived }}>
                      {result}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{reason}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

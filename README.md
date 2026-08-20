# SPX-Volatility-Prediction-Option-Pricing
AI-driven SPX implied volatility prediction and European option pricing using ML/DL models (XGBoost, Random Forest, SVR, MLP, CNN, Transformer). Includes volatility surface construction, Black-Scholes, Greeks, Monte Carlo simulation, and walk-forward validation across normal, financial crisis (2007–2009), and COVID-19 (2020) market regimes.

# 📊 PwC Volatility AI Lab

Application complète de **prédiction de la volatilité implicite** sur options S&P 500 avec **13 modèles ML/DL**, méthodologie **CRISP-DM**, et dashboard d'évaluation.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Stack](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![Stack](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql) ![Stack](https://img.shields.io/badge/Theme-PwC%20Orange-DC6B2F)

## 🎯 Fonctionnalités

- **4 onglets** :
  1. **Prédiction IV** : 13 modèles comparés en parallèle
  2. **Pricing d'option** : Black-Scholes + Monte Carlo + ML, avec tous les Greeks (Δ, Γ, ν, Θ, ρ)
  3. **Nappe de volatilité** : visualisation 3D observée vs prédite par date d'observation
  4. **Dashboard d'évaluation** : rankings, performance temporelle, crisis split, hyperparamètres

- **Authentification** : JWT + bcrypt, rôles admin/user, CRUD utilisateurs
- **13 modèles** :
  - **ML** : Lasso, Ridge, Random Forest, XGBoost, SVR + SVM (classifier régime stress)
  - **DL** : MLP, LSTM, GRU, BiLSTM, BiRNN, CNN, Transformer
- **Évaluation à 2 niveaux** :
  - **Walk-forward** : 54 fenêtres glissantes de 12 mois (pas 6 mois) sur 1996-2023
  - **Crisis split** : train sur Subprimes (2007-2009), validation sur COVID (2020)
- **Métriques** : RMSE, MAE, MSE, R², MAPE, QLIKE, Directional Accuracy

---

## 🏗️ Architecture

```
volatility_pwc/
├── backend/                      # FastAPI + SQLAlchemy + JWT
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/
│   │   └── options_merged_spx.csv      ← À placer ici
│   ├── saved_models/                   ← Modèles entraînés + evaluation.json
│   └── app/
│       ├── main.py                     # FastAPI + lifespan + admin par défaut
│       ├── config.py                   # Settings (env vars)
│       ├── database.py                 # SQLAlchemy engine
│       ├── schemas.py                  # Pydantic
│       ├── auth/security.py            # JWT + bcrypt
│       ├── models_dir/user.py          # Modèle SQLAlchemy User
│       ├── routers/                    # /auth /users /iv /pricing /surface /evaluation
│       ├── services/registry.py        # ModelRegistry singleton
│       └── ml/
│           ├── features.py             # Feature engineering
│           ├── black_scholes.py        # BS + Greeks + MC + Newton-Raphson IV
│           ├── ml_models.py            # Factory ML
│           ├── dl_models.py            # Factory DL (Keras)
│           ├── walk_forward.py         # 54 fenêtres + crisis split
│           ├── metrics.py              # MAPE, QLIKE, Directional Accuracy
│           └── train_all.py            # Pipeline d'entraînement complet
│
├── frontend/                     # React 18 + MUI + Plotly
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                    # Entry point
│       ├── App.jsx                     # Router + ProtectedRoute
│       ├── theme/pwcTheme.js           # Palette PwC (orange #DC6B2F, gris)
│       ├── api/client.js               # Axios + JWT interceptor
│       ├── components/
│       │   ├── PwCLogo.jsx             # Logo SVG inline
│       │   └── Layout.jsx              # Sidebar + topbar + CRISP-DM tracker
│       └── pages/
│           ├── Login.jsx               # Page de connexion
│           ├── PredictIV.jsx           # Onglet 1
│           ├── Pricing.jsx             # Onglet 2
│           ├── Surface.jsx             # Onglet 3
│           ├── Evaluation.jsx          # Onglet 4
│           └── AdminUsers.jsx          # CRUD users (admin)
│
├── notebook/
│   └── crisp_dm.ipynb            # Notebook CRISP-DM complet (38 cellules)
│
└── docker-compose.yml            # PostgreSQL + backend + frontend
```

---

## 🚀 Lancement rapide (Docker)

### Pré-requis
- Docker + Docker Compose
- Le CSV `options_merged_spx.csv` (~146k lignes, 1996-2023)

### Étapes

```bash
# 1. Placer le dataset
cp /path/to/options_merged_spx.csv volatility_pwc/backend/data/

# 2. Lancer la stack complète
cd volatility_pwc
docker-compose up --build

# 3. Première fois uniquement — entraîner les modèles
# (peut prendre plusieurs heures pour les DL)
docker exec pwc_iv_backend python -m app.ml.train_all

# 3b. Entraînement rapide (test) : ML seul, 5 fenêtres
docker exec pwc_iv_backend python -m app.ml.train_all --no-dl --max-windows=5
```

### Accès

| Service | URL |
|---|---|
| **Frontend React** | http://localhost:3000 |
| **API FastAPI** | http://localhost:8000 |
| **Documentation API (Swagger)** | http://localhost:8000/docs |
| **PostgreSQL** | localhost:5432 (user: `pwc_user`, pw: `pwc_password`, db: `pwc_iv`) |

### Compte par défaut

| Username | Password | Rôle |
|---|---|---|
| `admin` | `PwC2024!` | Admin |

⚠️ **Changez le mot de passe en production** via l'onglet Admin ou `users_router`.

---

## 🛠️ Lancement sans Docker (développement)

### Backend

```bash
# PostgreSQL local
createdb pwc_iv

cd backend
python -m venv venv
source venv/bin/activate          # sur Windows : venv\Scripts\activate
pip install -r requirements.txt

# Variables d'env
export DATABASE_URL=postgresql://pwc_user:pwc_password@localhost:5432/pwc_iv
export JWT_SECRET=change_me

# Lancer
uvicorn app.main:app --reload --port 8000

# Entraîner (depuis un autre terminal)
python -m app.ml.train_all
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env              # adapter REACT_APP_API_URL si besoin
npm start
```

---

## 🧠 Méthodologie CRISP-DM

Le notebook `notebook/crisp_dm.ipynb` couvre les 6 phases :

1. **Business Understanding** : objectif, contexte, modèles à comparer
2. **Data Understanding** : EDA Plotly (histogrammes, boxplots, NaN, nunique par date, corrélations, zones de crise)
3. **Data Preparation** : feature engineering (26 features), standardisation, SelectKBest
4. **Modeling** : walk-forward 54 fenêtres, factory ML/DL
5. **Evaluation** : rankings, performance temporelle, crisis split Subprimes→COVID
6. **Deployment** : application React + FastAPI

Lancement :
```bash
cd notebook
jupyter notebook crisp_dm.ipynb
```

---

## 📈 Stratégies d'évaluation

### Walk-forward (54 fenêtres)
- Fenêtre 1 : `1996-01-01 → 1996-12-31`
- Fenêtre 2 : `1996-06-01 → 1997-05-31` (pas de 6 mois)
- ...
- Fenêtre 54 : `2022-06-01 → 2023-05-31`

Chaque fenêtre est split chronologiquement **70% train / 15% validation / 15% test**.

### Crisis split (stabilité temporelle)
- **Train + Test** : crise des Subprimes (2007-07-01 → 2009-06-30), split chronologique 80/20
- **Validation** : crise COVID-19 (2020-02-15 → 2020-12-31)

Permet de mesurer la capacité d'un modèle entraîné sur un régime de stress à généraliser à un autre.

---

## 📊 Endpoints API principaux

| Endpoint | Méthode | Description |
|---|---|---|
| `/auth/login-json` | POST | Login JSON (retourne JWT) |
| `/auth/me` | GET | Profil courant |
| `/users` | GET/POST | Liste / créer utilisateur (admin) |
| `/users/{id}` | PATCH/DELETE | Modifier / supprimer (admin) |
| `/iv/models` | GET | Liste des modèles entraînés |
| `/iv/predict` | POST | Prédire IV avec un modèle |
| `/iv/predict-all` | POST | Prédire IV avec tous les modèles |
| `/pricing/option` | POST | Pricer une option (BS + MC + ML + Greeks) |
| `/surface/dates` | GET | Liste des dates d'observation |
| `/surface?date_obs=...&model_name=...` | GET | Nappe observée + prédite |
| `/evaluation` | GET | Résultats d'évaluation complets |

Documentation interactive : http://localhost:8000/docs

---

## 🎨 Thème PwC

Couleurs principales :
- **Orange PwC** : `#DC6B2F` (primaire)
- **Orange foncé** : `#A04A1D` (hover)
- **Jaune** : `#FFB600`
- **Rouge** : `#E0301E`
- **Gris foncé** : `#2D2D2D` (texte)
- **Gris fond** : `#F5F5F5`

Fonte : **Inter** (Google Fonts).

---

## 📦 Modèles & hyperparamètres

| Modèle | Hyperparamètres clés |
|---|---|
| Lasso | `alpha=1e-4, max_iter=10000` |
| Ridge | `alpha=1.0` |
| Random Forest | `n_estimators=200, max_depth=18, min_samples_leaf=5` |
| XGBoost | `n_estimators=400, max_depth=8, lr=0.05` |
| SVR | `kernel=rbf, C=1.0, epsilon=0.005` |
| SVM (classifier stress) | `kernel=rbf, C=1.0` |
| MLP | `hidden=[128,64,32], dropout=0.2` |
| LSTM/GRU/BiLSTM/BiRNN | `units=[64,32], dropout=0.2` |
| CNN | `filters=64, kernel=3` |
| Transformer | `heads=4, ff_dim=64, blocks=2` |

---



## 🙏 Crédits

- **Méthodologie** : CRISP-DM
- **Données** : OptionMetrics / FRED (VIX, 10Y rate)
- **Thème** : Inspiré de l'identité visuelle PwC
- **Stack** : FastAPI, React, PostgreSQL, scikit-learn, XGBoost, TensorFlow/Keras, Plotly


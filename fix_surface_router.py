with open('/app/app/routers/surface_router.py', 'r') as f:
    content = f.read()

old = '''TENORS      = [30, 60, 91, 122, 152, 182, 273, 365, 547, 730]
MONEYNESS   = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]'''

new = '''TENORS      = [30, 60, 91, 122, 152, 182, 273, 365, 547, 730]
# Moneyness en convention K/S-1 (meme convention que features.py)
MONEYNESS   = [-0.30, -0.25, -0.20, -0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]'''

content = content.replace(old, new, 1)

old2 = '''def _build_features_for_point(row_market, tenor, moneyness, feature_cols):
    """Construit un vecteur de features pour un point (tenor, moneyness) donne."""
    feat = {}
    for col in feature_cols:
        if col in row_market:
            feat[col] = float(row_market[col]) if pd.notna(row_market[col]) else 0.0
        else:
            feat[col] = 0.0
    # Override avec les valeurs du point
    feat["moneyness"]      = float(moneyness) / 100.0
    feat["log_tenor"]      = float(np.log(tenor))
    feat["sqrt_tenor"]     = float(np.sqrt(tenor))
    feat["moneyness_norm"] = float(moneyness) / 90.0
    feat["moneyness_abs"]  = abs(float(moneyness)) / 90.0
    feat["moneyness_sq"]   = (float(moneyness) / 90.0) ** 2
    feat["mny_x_logt"]     = feat["moneyness_norm"] * feat["log_tenor"]
    return feat'''

new2 = '''def _build_features_for_point(row_market, tenor, moneyness, feature_cols):
    """Construit un vecteur de features pour un point (tenor, moneyness) donne.
    moneyness : convention K/S-1 (ex: -0.10 = put 10% OTM)
    tenor     : maturite en jours
    """
    feat = {}
    # Copier les features marche disponibles
    for col in feature_cols:
        if col in row_market:
            val = row_market[col]
            feat[col] = float(val) if pd.notna(val) else 0.0
        else:
            feat[col] = 0.0
    # Override avec les valeurs exactes du point de la nappe
    mny = float(moneyness)
    t   = max(float(tenor), 1.0)
    feat["moneyness"]     = mny
    feat["log_moneyness"] = float(np.log(1.0 + mny)) if mny > -1.0 else 0.0
    feat["moneyness_abs"] = abs(mny)
    feat["moneyness_sq"]  = mny ** 2
    feat["tenor_d"]       = t
    feat["log_tenor"]     = float(np.log(t))
    feat["sqrt_tenor"]    = float(np.sqrt(t))
    feat["tenor_years"]   = t / 365.0
    feat["mny_x_logt"]    = mny * float(np.log(t))
    return feat'''

content = content.replace(old2, new2, 1)

with open('/app/app/routers/surface_router.py', 'w') as f:
    f.write(content)

print('surface_router.py corrige')

# Verification
with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if 'moneyness' in line.lower() and ('feat[' in line or 'MONEYNESS' in line):
        print(f'{i}: {line.rstrip()}')

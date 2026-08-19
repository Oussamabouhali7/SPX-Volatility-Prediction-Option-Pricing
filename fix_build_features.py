with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()

# Remplacer lignes 54-62 (indices 53-61) par le nouveau bloc
new_block = [
    '    # Override avec les valeurs exactes du point de la nappe\n',
    '    mny = float(moneyness)\n',
    '    t   = max(float(tenor), 1.0)\n',
    '    feat["moneyness"]     = mny\n',
    '    feat["log_moneyness"] = float(np.log(1.0 + mny)) if mny > -1.0 else 0.0\n',
    '    feat["moneyness_abs"] = abs(mny)\n',
    '    feat["moneyness_sq"]  = mny ** 2\n',
    '    feat["tenor_d"]       = t\n',
    '    feat["log_tenor"]     = float(np.log(t))\n',
    '    feat["sqrt_tenor"]    = float(np.sqrt(t))\n',
    '    feat["tenor_years"]   = t / 365.0\n',
    '    feat["mny_x_logt"]    = mny * float(np.log(t))\n',
    '    return feat\n',
]

# Remplacer lignes 53 a 61 (indices) par le nouveau bloc
lines[53:62] = new_block

with open('/app/app/routers/surface_router.py', 'w') as f:
    f.writelines(lines)

print('_build_features_for_point corrige')

# Verification
with open('/app/app/routers/surface_router.py', 'r') as f:
    lines2 = f.readlines()
for i in range(43, 68):
    print(f'{i+1}: {lines2[i].rstrip()}')

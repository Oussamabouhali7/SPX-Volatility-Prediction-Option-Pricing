with open('/app/app/services/registry.py', 'r') as f:
    lines = f.readlines()

# 1. Ajouter self.scaler dans __init__ apres self._loaded = False (ligne 37)
lines[36] = lines[36] + '        self.scaler = None\n'

# 2. Charger scaler.pkl dans load() apres le chargement SVM_clf (apres ligne 56)
lines[55] = lines[55] + '\n            # Scaler\n            p_scaler = models_dir / "scaler.pkl"\n            if p_scaler.exists():\n                self.scaler = joblib.load(p_scaler)\n                print(f"[registry] Scaler charge depuis {p_scaler}")\n'

# 3. Appliquer scaler dans predict_iv_single (ligne 93)
lines[92] = lines[92] + '        if self.scaler is not None:\n            x = self.scaler.transform(x)\n'

# 4. Appliquer scaler dans predict_iv_all (ligne 104)
lines[103] = lines[103] + '        if self.scaler is not None:\n            x = self.scaler.transform(x)\n'

with open('/app/app/services/registry.py', 'w') as f:
    f.writelines(lines)

print('registry.py corrige')

with open('/app/app/services/registry.py', 'r') as f:
    lines2 = f.readlines()
for i, line in enumerate(lines2, 1):
    if 'scaler' in line.lower():
        print(f'{i}: {line.rstrip()}')

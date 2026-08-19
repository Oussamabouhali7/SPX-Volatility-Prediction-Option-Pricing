import json
with open('/app/saved_models/evaluation.json', 'r') as f:
    data = json.load(f)

print(f"Nombre de fenetres dans evaluation.json: {len(data.get('windows', []))}")
print(f"Nombre de modeles: {len(data.get('models', []))}")
print()
print("Fenetres par modele:")
for m in data.get('models', []):
    print(f"  {m['model_name']:<15} : {m['n_windows']} fenetres | RMSE={m['mean_rmse']:.4f} | R2={m['mean_r2']:.4f}")

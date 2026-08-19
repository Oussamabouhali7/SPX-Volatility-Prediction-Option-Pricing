with open('/app/app/schemas.py', 'r') as f:
    content = f.read()

# Ajouter n_windows dans IVPredictRequest
old = '    model_name: str = "XGBoost"'
new = '    model_name: str = "XGBoost"\n    n_windows: int = 47  # Nombre de fenetres a considerer (1-47)'
content = content.replace(old, new, 1)

# Ajouter rmse_by_window dans IVMultiModelResponse
old2 = 'class IVMultiModelResponse(BaseModel):\n    predictions: Dict[str, float]\n    inputs: IVPredictRequest'
new2 = 'class IVMultiModelResponse(BaseModel):\n    predictions: Dict[str, float]\n    inputs: IVPredictRequest\n    rmse_by_window: Dict[str, float] = {}'
content = content.replace(old2, new2, 1)

with open('/app/app/schemas.py', 'w') as f:
    f.write(content)

print('schemas.py mis a jour')

# Verification
with open('/app/app/schemas.py', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if 'n_windows' in line or 'rmse_by_window' in line:
        print(f'{i}: {line.rstrip()}')

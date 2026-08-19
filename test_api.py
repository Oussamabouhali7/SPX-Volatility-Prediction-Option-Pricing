import urllib.request, json

# 1. Login
login_data = json.dumps({"username": "admin", "password": "PwC2024!"}).encode()
req = urllib.request.Request("http://localhost:8000/auth/login-json",
    data=login_data,
    headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())["access_token"]
print(f"Token OK : {token[:30]}...")

# 2. Predict IV all models
pred_data = json.dumps({
    "moneyness": -0.05,
    "tenor_d": 91,
    "vix": 20.0,
    "rate_10y": 4.0,
    "hvol_30d": 0.15,
    "close_gspc": 4500.0,
    "model_name": "XGBoost"
}).encode()
req2 = urllib.request.Request("http://localhost:8000/iv/predict-all",
    data=pred_data,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
resp2 = urllib.request.urlopen(req2)
result = json.loads(resp2.read())
print("\nPredictions IV par modele:")
for name, val in sorted(result["predictions"].items()):
    print(f"  {name:<15} : {val:.4f} ({val*100:.2f}%)")

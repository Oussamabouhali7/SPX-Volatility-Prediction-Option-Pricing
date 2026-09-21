content = open("/app/app/ml/train_surface.py").read()
content = content.replace(
    '"rate":    "mean",\n            "forward": "mean",',
    '"rate_10y":    "mean",\n            "fwd_front": "mean",'
)
content = content.replace(
    'mkt_daily = mkt_daily.merge(hvol, on="date", how="left")',
    'mkt_daily = mkt_daily.rename(columns={"rate_10y":"rate","fwd_front":"forward"})\n        mkt_daily = mkt_daily.merge(hvol, on="date", how="left")'
)
open("/app/app/ml/train_surface.py", "w").write(content)
print("OK")

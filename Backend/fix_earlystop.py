content = open("/app/app/ml/ml_models.py").read()

# XGBoost avec early stopping
content = content.replace(
    '"n_estimators": 200,\n        "max_depth": 4,\n        "learning_rate": 0.05,\n        "subsample": 0.8,\n        "colsample_bytree": 0.8,\n        "min_child_weight": 5,\n        "reg_alpha": 0.1,\n        "reg_lambda": 1.0',
    '"n_estimators": 1000,\n        "max_depth": 4,\n        "learning_rate": 0.01,\n        "subsample": 0.8,\n        "colsample_bytree": 0.8,\n        "min_child_weight": 5,\n        "reg_alpha": 0.1,\n        "reg_lambda": 1.0,\n        "early_stopping_rounds": 20'
)

open("/app/app/ml/ml_models.py", "w").write(content)
print("OK")

content = open("/app/app/ml/train_all.py").read()

# XGBoost avec early stopping sur val set
old = """    elif name == "XGBoost":
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)"""
new = """    elif name == "XGBoost":
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
        # early_stopping_rounds est dans les hyperparams"""

content = content.replace(old, new)
open("/app/app/ml/train_all.py", "w").write(content)
print("OK")

content = open("/app/app/ml/ml_models.py").read()
content = content.replace(
    '        "Lasso": Pipeline([\n            ("scaler", StandardScaler()),\n            ("model", Lasso(alpha=1e-4, max_iter=10_000, random_state=random_state)),\n        ]),',
    '        "Lasso": Lasso(alpha=1e-4, max_iter=10_000, random_state=random_state),'
)
content = content.replace(
    '        "Ridge": Pipeline([\n            ("scaler", StandardScaler()),\n            ("model", Ridge(alpha=1.0, random_state=random_state)),\n        ]),',
    '        "Ridge": Ridge(alpha=1.0, random_state=random_state),'
)
content = content.replace(
    '        "SVR": Pipeline([\n            ("scaler", StandardScaler()),\n            ("model", SVR(kernel="rbf", C=1.0, gamma="scale", epsilon=0.005)),\n        ]),',
    '        "SVR": SVR(kernel="rbf", C=1.0, gamma="scale", epsilon=0.005),'
)
open("/app/app/ml/ml_models.py", "w").write(content)
print("OK")

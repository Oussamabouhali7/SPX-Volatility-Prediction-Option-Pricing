content = open("/app/app/ml/ml_models.py").read()

# SVR : augmenter C pour moins de regularisation
content = content.replace(
    '"SVR": SVR(kernel="rbf", C=1.0, gamma="scale", epsilon=0.005),',
    '"SVR": SVR(kernel="rbf", C=10.0, gamma="scale", epsilon=0.001),'
)
content = content.replace(
    '"SVR": {"kernel": "rbf", "C": 1.0, "epsilon": 0.005, "gamma": "scale"}',
    '"SVR": {"kernel": "rbf", "C": 10.0, "epsilon": 0.001, "gamma": "scale"}'
)

open("/app/app/ml/ml_models.py", "w").write(content)
print("OK ml_models.py")

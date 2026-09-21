content = open("/app/app/ml/train_all.py").read()

# Supprimer normalisation de y dans walk_forward
content = content.replace(
    """        y_scaler = StandardScaler()
        y_train = y_scaler.fit_transform(y_train.reshape(-1,1)).flatten()
        y_val   = y_scaler.transform(y_val.reshape(-1,1)).flatten()
        y_test  = y_scaler.transform(y_test.reshape(-1,1)).flatten()""", ""
)

# Supprimer normalisation de y dans crisis split
content = content.replace(
    """    y_scaler = StandardScaler()
    y_train = y_scaler.fit_transform(y_train.reshape(-1,1)).flatten()
    y_test  = y_scaler.transform(y_test.reshape(-1,1)).flatten()
    y_val   = y_scaler.transform(y_val.reshape(-1,1)).flatten()""", ""
)

open("/app/app/ml/train_all.py", "w").write(content)
print("OK")

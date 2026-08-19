content = open("/app/app/ml/train_all.py").read()

# Normaliser y dans walk_forward
old = """        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)"""
new = """        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)
        y_scaler = StandardScaler()
        y_train = y_scaler.fit_transform(y_train.reshape(-1,1)).flatten()
        y_val   = y_scaler.transform(y_val.reshape(-1,1)).flatten()
        y_test  = y_scaler.transform(y_test.reshape(-1,1)).flatten()"""
content = content.replace(old, new)

# Normaliser y dans crisis split
old2 = """    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    X_val   = scaler.transform(X_val)"""
new2 = """    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    X_val   = scaler.transform(X_val)
    y_scaler = StandardScaler()
    y_train = y_scaler.fit_transform(y_train.reshape(-1,1)).flatten()
    y_test  = y_scaler.transform(y_test.reshape(-1,1)).flatten()
    y_val   = y_scaler.transform(y_val.reshape(-1,1)).flatten()"""
content = content.replace(old2, new2)

open("/app/app/ml/train_all.py", "w").write(content)
print("OK")

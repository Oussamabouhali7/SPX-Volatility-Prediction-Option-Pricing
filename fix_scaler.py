content = open("/app/app/ml/train_all.py").read()
content = content.replace(
    "from app.ml.walk_forward import generate_windows, split_window_data, crisis_split",
    "from app.ml.walk_forward import generate_windows, split_window_data, crisis_split\nfrom sklearn.preprocessing import StandardScaler"
)
old = """        X_train, y_train = get_xy(splits["train"])
        X_val,   y_val   = get_xy(splits["val"])
        X_test,  y_test  = get_xy(splits["test"])"""
new = """        X_train, y_train = get_xy(splits["train"])
        X_val,   y_val   = get_xy(splits["val"])
        X_test,  y_test  = get_xy(splits["test"])
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)"""
content = content.replace(old, new)
old2 = """    X_train, y_train = get_xy(splits["train"])
    X_test,  y_test  = get_xy(splits["test"])
    X_val,   y_val   = get_xy(splits["val"])"""
new2 = """    X_train, y_train = get_xy(splits["train"])
    X_test,  y_test  = get_xy(splits["test"])
    X_val,   y_val   = get_xy(splits["val"])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)
    X_val   = scaler.transform(X_val)"""
content = content.replace(old2, new2)
old3 = """    X_train, y_train = get_xy(df_sorted.iloc[:n_train])
    X_val,   y_val   = get_xy(df_sorted.iloc[n_train:])"""
new3 = """    X_train, y_train = get_xy(df_sorted.iloc[:n_train])
    X_val,   y_val   = get_xy(df_sorted.iloc[n_train:])
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val   = scaler.transform(X_val)
    joblib.dump(scaler, models_dir / "scaler.pkl")"""
content = content.replace(old3, new3)
open("/app/app/ml/train_all.py", "w").write(content)
print("OK")

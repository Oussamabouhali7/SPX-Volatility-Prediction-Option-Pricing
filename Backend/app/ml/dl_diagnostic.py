"""
Diagnostic DL : entraîne un modèle sur UNE fenêtre et affiche
l'évolution loss/mae par epoch (train + val).

Usage :
  python -m app.ml.dl_diagnostic --model Transformer --window 0 --epochs 50
  python -m app.ml.dl_diagnostic --model LSTM --window 5 --epochs 100 --batch 64
  python -m app.ml.dl_diagnostic --model MLP --window 0 --epochs 80

Modèles disponibles : MLP, LSTM, GRU, BiLSTM, BiRNN, CNN, Transformer
"""
import argparse
import sys
import numpy as np
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.ml.features import load_options, build_features, get_xy, FEATURE_COLS
from app.ml.walk_forward import generate_windows, split_window_data
from app.ml.dl_models import get_dl_models, reshape_seq, fit_dl, DL_HYPERPARAMS, LinearWarmupCosDecay


def main():
    parser = argparse.ArgumentParser(description="Diagnostic DL — évolution par epoch")
    parser.add_argument("--model", type=str, default="Transformer",
                        help="Nom du modèle DL (MLP, LSTM, GRU, BiLSTM, BiRNN, CNN, Transformer)")
    parser.add_argument("--window", type=int, default=0,
                        help="Index de la fenêtre walk-forward (0 = première)")
    parser.add_argument("--epochs", type=int, default=150,
                        help="Nombre max d'epochs (défaut: 150)")
    parser.add_argument("--batch", type=int, default=32,
                        help="Batch size (défaut: 32)")
    parser.add_argument("--patience", type=int, default=15,
                        help="EarlyStopping patience (défaut: 15)")
    parser.add_argument("--lr", type=float, default=1e-3,
                        help="Learning rate")
    args = parser.parse_args()

    model_name = args.model
    window_idx = args.window

    # ── 1. Charger les données ──
    print("=" * 70)
    print(f"  DIAGNOSTIC DL — {model_name} — Fenêtre {window_idx}")
    print(f"  Epochs={args.epochs}, Batch={args.batch}, Patience={args.patience}, LR={args.lr}")
    print("=" * 70)

    print("\n[1/4] Chargement des données...")
    df = load_options(settings.DATA_FILE)
    df = build_features(df)
    print(f"  → {len(df):,} lignes, {len(FEATURE_COLS)} features")

    # ── 2. Générer les fenêtres et sélectionner ──
    print("\n[2/4] Génération des fenêtres walk-forward...")
    windows = generate_windows()  # utilise les défauts : 1996-2023, 12 mois, pas 6 mois
    print(f"  → {len(windows)} fenêtres générées")

    if window_idx >= len(windows):
        print(f"  ❌ Fenêtre {window_idx} hors limites (max = {len(windows) - 1})")
        sys.exit(1)

    w_start, w_end = windows[window_idx]
    print(f"  → Fenêtre sélectionnée : {w_start} → {w_end}")

    splits = split_window_data(df, w_start, w_end)
    X_train, y_train = get_xy(splits["train"])
    X_val, y_val = get_xy(splits["val"])
    X_test, y_test = get_xy(splits["test"])

    print(f"  → Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")

    # ── 3. Normaliser ──
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)
    X_test = scaler.transform(X_test)

    # ── 4. Construire et entraîner ──
    print(f"\n[3/4] Construction du modèle {model_name}...")

    import tensorflow as tf
    from tensorflow import keras

    n_features = X_train.shape[1]
    all_models = get_dl_models(n_features)

    if model_name not in all_models:
        print(f"  ❌ Modèle inconnu : {model_name}")
        print(f"  Disponibles : {list(all_models.keys())}")
        sys.exit(1)

    # Reconstruire avec le LR personnalisé
    build_fns = {
        "MLP": lambda: __import__("app.ml.dl_models", fromlist=["build_mlp"]).build_mlp(n_features, args.lr),
        "LSTM": lambda: __import__("app.ml.dl_models", fromlist=["build_lstm"]).build_lstm(n_features, args.lr),
        "GRU": lambda: __import__("app.ml.dl_models", fromlist=["build_gru"]).build_gru(n_features, args.lr),
        "BiLSTM": lambda: __import__("app.ml.dl_models", fromlist=["build_bilstm"]).build_bilstm(n_features, args.lr),
        "BiRNN": lambda: __import__("app.ml.dl_models", fromlist=["build_birnn"]).build_birnn(n_features, args.lr),
        "CNN": lambda: __import__("app.ml.dl_models", fromlist=["build_cnn"]).build_cnn(n_features, args.lr),
        "Transformer": lambda: __import__("app.ml.dl_models", fromlist=["build_transformer"]).build_transformer(n_features, args.lr),
    }
    model = build_fns[model_name]()
    model.summary()

    is_seq = model_name != "MLP"
    Xt = reshape_seq(X_train) if is_seq else X_train
    Xv = reshape_seq(X_val) if is_seq else X_val
    Xte = reshape_seq(X_test) if is_seq else X_test

    print(f"\n[4/4] Entraînement ({args.epochs} epochs max, patience={args.patience})...\n")

    es = keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=args.patience, restore_best_weights=True, verbose=1)
    rlr = keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss", patience=max(2, args.patience // 2),
        factor=0.5, min_lr=1e-6, verbose=1)

    callbacks = [es, rlr]

    # Warmup spécifique Transformer (comme dans dl_models.py)
    if model_name == "Transformer":
        warmup_schedule = LinearWarmupCosDecay(
            base_lr=args.lr, warmup_epochs=15, total_epochs=args.epochs)
        lrs_cb = keras.callbacks.LearningRateScheduler(warmup_schedule, verbose=1)
        callbacks = [es, lrs_cb]
        print(f"  → Transformer : Warmup 15 epochs (1e-6 → {args.lr}) + cosine decay")

    history = model.fit(
        Xt, y_train,
        validation_data=(Xv, y_val),
        epochs=args.epochs,
        batch_size=args.batch,
        callbacks=callbacks,
        verbose=1,
    )

    # ── 5. Résultats ──
    print("\n" + "=" * 70)
    print("  RÉSUMÉ")
    print("=" * 70)

    h = history.history
    n_epochs_run = len(h["loss"])
    best_epoch = int(np.argmin(h["val_loss"]))

    print(f"\n  Epochs exécutés    : {n_epochs_run} / {args.epochs}")
    print(f"  Best epoch (val)   : {best_epoch + 1}")
    print(f"  Train loss (best)  : {h['loss'][best_epoch]:.6f}")
    print(f"  Val loss (best)    : {h['val_loss'][best_epoch]:.6f}")
    print(f"  Train MAE (best)   : {h['mae'][best_epoch]:.6f}")
    print(f"  Val MAE (best)     : {h['val_mae'][best_epoch]:.6f}")

    # Ratio overfitting
    ratio = h['val_loss'][best_epoch] / (h['loss'][best_epoch] + 1e-10)
    print(f"  Ratio val/train    : {ratio:.2f}x {'⚠️ OVERFITTING' if ratio > 2 else '✅ OK'}")

    # Prédiction test
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    y_pred = model.predict(Xte, verbose=0).flatten()
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"\n  --- Métriques TEST ---")
    print(f"  RMSE  : {rmse:.6f}")
    print(f"  MAE   : {mae:.6f}")
    print(f"  R²    : {r2:.4f}")
    print(f"  y_pred range : [{y_pred.min():.4f}, {y_pred.max():.4f}]")
    print(f"  y_test range : [{y_test.min():.4f}, {y_test.max():.4f}]")

    # Tableau epoch par epoch
    print(f"\n  --- ÉVOLUTION EPOCH PAR EPOCH ---")
    print(f"  {'Epoch':>5}  {'Train Loss':>11}  {'Val Loss':>11}  {'Train MAE':>10}  {'Val MAE':>10}  {'LR':>10}")
    print(f"  {'-'*5}  {'-'*11}  {'-'*11}  {'-'*10}  {'-'*10}  {'-'*10}")
    lrs = h.get("lr", [args.lr] * n_epochs_run)
    for i in range(n_epochs_run):
        marker = " ◀ BEST" if i == best_epoch else ""
        print(f"  {i+1:>5}  {h['loss'][i]:>11.6f}  {h['val_loss'][i]:>11.6f}  "
              f"{h['mae'][i]:>10.6f}  {h['val_mae'][i]:>10.6f}  "
              f"{lrs[i] if i < len(lrs) else 0:>10.2e}{marker}")

    print()


if __name__ == "__main__":
    main()
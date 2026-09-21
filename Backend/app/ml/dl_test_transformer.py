"""
Test Transformer personnalisé sur N fenêtres avec métriques détaillées.

Usage :
  python -m app.ml.dl_test_transformer

Config codée dans le script (modifiable ci-dessous).
"""
import numpy as np
import sys
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from app.ml.features import load_options, build_features, get_xy, FEATURE_COLS
from app.ml.walk_forward import generate_windows, split_window_data
from app.ml.dl_models import reshape_seq
from app.config import settings


# ══════════════════════════════════════════════
#  CONFIGURATION — modifier ici
# ══════════════════════════════════════════════
HEADS      = 4
BLOCKS     = 3
FF_DIM     = 32
D_MODEL    = 32        # dimension interne (projection initiale)
DROPOUT    = 0.2
LR         = 1e-4
BATCH_SIZE = 16
EPOCHS     = 300
PATIENCE   = 25
N_WINDOWS  = 5         # fenêtres 0,1,2,3,4
WARMUP_EPOCHS = 20
# ══════════════════════════════════════════════


def build_custom_transformer(n_features):
    """Transformer avec paramètres personnalisés."""
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    inp = keras.Input(shape=(n_features, 1))
    x = layers.Dense(D_MODEL)(inp)

    for _ in range(BLOCKS):
        attn = layers.MultiHeadAttention(num_heads=HEADS, key_dim=D_MODEL)(x, x)
        attn = layers.Dropout(DROPOUT)(attn)
        x1 = layers.LayerNormalization(epsilon=1e-6)(x + attn)
        ff = layers.Dense(FF_DIM, activation="relu")(x1)
        ff = layers.Dense(D_MODEL)(ff)
        ff = layers.Dropout(DROPOUT)(ff)
        x = layers.LayerNormalization(epsilon=1e-6)(x1 + ff)

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(D_MODEL // 2, activation="relu")(x)
    x = layers.Dropout(DROPOUT)(x)
    out = layers.Dense(1)(x)

    m = keras.Model(inp, out, name="Transformer_Custom")
    m.compile(optimizer=keras.optimizers.Adam(LR), loss="mse", metrics=["mae"])
    return m


def compute_all_metrics(y_true, y_pred):
    """Calcule les 7 métriques."""
    y_t = np.asarray(y_true).flatten()
    y_p = np.asarray(y_pred).flatten()
    n = len(y_t)
    if n == 0:
        return {k: 0.0 for k in ['rmse', 'mae', 'mse', 'r2', 'mape', 'qlike', 'dir_acc']}

    mse = mean_squared_error(y_t, y_p)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_t, y_p)
    r2 = r2_score(y_t, y_p)

    # MAPE
    mask = np.abs(y_t) > 1e-8
    mape = np.mean(np.abs((y_t[mask] - y_p[mask]) / y_t[mask])) * 100 if mask.sum() > 0 else 0.0

    # QLIKE
    ratio = y_t / (y_p + 1e-10)
    qlike = float(np.mean(ratio - np.log(ratio + 1e-10) - 1))

    # Directional Accuracy
    if n > 1:
        d_true = np.diff(y_t)
        d_pred = np.diff(y_p)
        dir_acc = np.mean(np.sign(d_true) == np.sign(d_pred)) * 100
    else:
        dir_acc = 0.0

    return {
        'rmse': float(rmse), 'mae': float(mae), 'mse': float(mse),
        'r2': float(r2), 'mape': float(mape), 'qlike': float(qlike),
        'dir_acc': float(dir_acc),
    }


def lr_schedule(epoch, warmup=WARMUP_EPOCHS, max_lr=LR, total=EPOCHS):
    """Warmup linéaire + cosine decay."""
    if epoch < warmup:
        return max_lr * (epoch + 1) / warmup
    progress = (epoch - warmup) / max(1, total - warmup)
    return max_lr * 0.5 * (1 + np.cos(np.pi * progress))


def print_metrics_table(label, metrics):
    """Affiche une ligne de métriques."""
    print(f"  {label:<12} RMSE={metrics['rmse']:.6f}  MAE={metrics['mae']:.6f}  "
          f"R²={metrics['r2']:>8.4f}  MAPE={metrics['mape']:>6.2f}%  "
          f"QLIKE={metrics['qlike']:>8.3f}  Dir.Acc={metrics['dir_acc']:>5.1f}%")


def main():
    import tensorflow as tf
    from tensorflow import keras

    print("=" * 80)
    print("  TRANSFORMER PERSONNALISÉ — Test multi-fenêtres")
    print("=" * 80)
    print(f"  heads={HEADS}, blocks={BLOCKS}, ff_dim={FF_DIM}, d_model={D_MODEL}")
    print(f"  lr={LR}, batch_size={BATCH_SIZE}, epochs={EPOCHS}, patience={PATIENCE}")
    print(f"  warmup={WARMUP_EPOCHS} epochs, dropout={DROPOUT}")
    print(f"  Fenêtres : 0 → {N_WINDOWS - 1}")
    print("=" * 80)

    # ── Charger les données ──
    print("\n[1/3] Chargement des données...")
    df = load_options(settings.DATA_FILE)
    df = build_features(df)
    print(f"  → {len(df):,} lignes, {len(FEATURE_COLS)} features")

    print("\n[2/3] Génération des fenêtres walk-forward...")
    windows = generate_windows()
    print(f"  → {len(windows)} fenêtres disponibles, on teste les {N_WINDOWS} premières")

    n_features = len(FEATURE_COLS)
    all_results = []

    # ── Boucle sur les fenêtres ──
    for wi in range(N_WINDOWS):
        if wi >= len(windows):
            print(f"\n  ⚠️ Fenêtre {wi} hors limites, arrêt.")
            break

        w_start, w_end = windows[wi]

        print(f"\n{'━' * 80}")
        print(f"  FENÊTRE {wi} — {w_start} → {w_end}")
        print(f"{'━' * 80}")

        splits = split_window_data(df, w_start, w_end)
        X_train, y_train = get_xy(splits["train"])
        X_val, y_val = get_xy(splits["val"])
        X_test, y_test = get_xy(splits["test"])

        print(f"  Données : Train={len(X_train):,} | Val={len(X_val):,} | Test={len(X_test):,}")

        # Normaliser
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val = scaler.transform(X_val)
        X_test = scaler.transform(X_test)

        # Reshape pour séquentiel
        Xt = reshape_seq(X_train)
        Xv = reshape_seq(X_val)
        Xte = reshape_seq(X_test)

        # Construire le modèle (neuf à chaque fenêtre)
        model = build_custom_transformer(n_features)
        if wi == 0:
            model.summary()
            total_params = model.count_params()
            print(f"\n  → {total_params:,} paramètres vs {len(X_train):,} échantillons train "
                  f"(ratio 1:{len(X_train)/total_params:.1f})")

        # Callbacks
        lr_cb = keras.callbacks.LearningRateScheduler(lr_schedule, verbose=0)
        es = keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=PATIENCE, restore_best_weights=True, verbose=1)

        print(f"\n  Entraînement ({EPOCHS} epochs max, patience={PATIENCE})...\n")
        history = model.fit(
            Xt, y_train,
            validation_data=(Xv, y_val),
            epochs=EPOCHS, batch_size=BATCH_SIZE,
            callbacks=[lr_cb, es],
            verbose=1,
        )

        h = history.history
        n_run = len(h["loss"])
        best_ep = int(np.argmin(h["val_loss"]))

        # ── Prédictions sur les 3 ensembles ──
        p_train = model.predict(Xt, verbose=0).flatten()
        p_val = model.predict(Xv, verbose=0).flatten()
        p_test = model.predict(Xte, verbose=0).flatten()

        m_train = compute_all_metrics(y_train, p_train)
        m_val = compute_all_metrics(y_val, p_val)
        m_test = compute_all_metrics(y_test, p_test)

        # ── Résumé de la fenêtre ──
        print(f"\n  {'─' * 70}")
        print(f"  RÉSUMÉ FENÊTRE {wi}")
        print(f"  {'─' * 70}")
        print(f"  Epochs exécutés : {n_run} / {EPOCHS}")
        print(f"  Best epoch (val): {best_ep + 1}")
        print(f"  Train loss best : {h['loss'][best_ep]:.6f}")
        print(f"  Val loss best   : {h['val_loss'][best_ep]:.6f}")
        ratio_ov = h['val_loss'][best_ep] / (h['loss'][best_ep] + 1e-10)
        print(f"  Ratio val/train : {ratio_ov:.2f}x {'⚠️ OVERFITTING' if ratio_ov > 2 else '✅ OK'}")
        print(f"  y_pred range    : [{p_test.min():.4f}, {p_test.max():.4f}]")
        print(f"  y_test range    : [{y_test.min():.4f}, {y_test.max():.4f}]")
        pred_spread = p_test.max() - p_test.min()
        true_spread = y_test.max() - y_test.min()
        print(f"  Spread ratio    : {pred_spread/true_spread:.2%} "
              f"{'⚠️ PRÉDIT ~CONSTANTE' if pred_spread/true_spread < 0.3 else '✅ OK'}")

        # ── Tableau métriques train / val / test ──
        print(f"\n  {'Ensemble':<12} {'RMSE':>10} {'MAE':>10} {'R²':>10} {'MAPE':>10} "
              f"{'QLIKE':>10} {'Dir.Acc':>10}")
        print(f"  {'─'*12} {'─'*10} {'─'*10} {'─'*10} {'─'*10} {'─'*10} {'─'*10}")
        for lbl, m in [('Train', m_train), ('Validation', m_val), ('Test', m_test)]:
            print(f"  {lbl:<12} {m['rmse']:>10.6f} {m['mae']:>10.6f} {m['r2']:>10.4f} "
                  f"{m['mape']:>9.2f}% {m['qlike']:>10.3f} {m['dir_acc']:>9.1f}%")

        # ── Tableau epoch par epoch ──
        print(f"\n  {'Epoch':>5}  {'Train Loss':>11}  {'Val Loss':>11}  "
              f"{'Train MAE':>10}  {'Val MAE':>10}  {'LR':>10}")
        print(f"  {'-'*5}  {'-'*11}  {'-'*11}  {'-'*10}  {'-'*10}  {'-'*10}")
        lrs = h.get("lr", [LR] * n_run)
        for i in range(n_run):
            marker = " ◀ BEST" if i == best_ep else ""
            print(f"  {i+1:>5}  {h['loss'][i]:>11.6f}  {h['val_loss'][i]:>11.6f}  "
                  f"{h['mae'][i]:>10.6f}  {h['val_mae'][i]:>10.6f}  "
                  f"{lrs[i] if i < len(lrs) else 0:>10.2e}{marker}")

        all_results.append({
            'window': wi, 'start': str(w_start), 'end': str(w_end),
            'epochs_run': n_run, 'best_epoch': best_ep + 1,
            'train': m_train, 'val': m_val, 'test': m_test,
            'pred_spread_ratio': pred_spread / true_spread,
        })

    # ══════════════════════════════════════════════
    #  SYNTHÈSE GLOBALE
    # ══════════════════════════════════════════════
    print(f"\n\n{'═' * 80}")
    print("  SYNTHÈSE GLOBALE — TRANSFORMER PERSONNALISÉ")
    print(f"{'═' * 80}\n")

    # Tableau récapitulatif par fenêtre
    print(f"  {'Fen':>3} {'Période':<30} {'Ep':>4} {'Best':>4} "
          f"{'RMSE test':>10} {'R² test':>10} {'MAPE test':>10} {'Spread%':>8}")
    print(f"  {'─'*3} {'─'*30} {'─'*4} {'─'*4} {'─'*10} {'─'*10} {'─'*10} {'─'*8}")
    for r in all_results:
        print(f"  {r['window']:>3} {r['start'][:10]}→{r['end'][:10]:<18} "
              f"{r['epochs_run']:>4} {r['best_epoch']:>4} "
              f"{r['test']['rmse']:>10.6f} {r['test']['r2']:>10.4f} "
              f"{r['test']['mape']:>9.2f}% {r['pred_spread_ratio']:>7.1%}")

    # Moyennes
    print(f"\n  {'─' * 80}")
    for split_name in ['train', 'val', 'test']:
        metrics_keys = ['rmse', 'mae', 'r2', 'mape', 'qlike', 'dir_acc']
        avgs = {k: np.mean([r[split_name][k] for r in all_results]) for k in metrics_keys}
        print(f"  Moyenne {split_name:<6}  RMSE={avgs['rmse']:.6f}  MAE={avgs['mae']:.6f}  "
              f"R²={avgs['r2']:.4f}  MAPE={avgs['mape']:.2f}%  "
              f"QLIKE={avgs['qlike']:.3f}  Dir.Acc={avgs['dir_acc']:.1f}%")

    # Pooled R² test
    pool_n = pool_sy = pool_sy2 = pool_ssr = 0
    for r in all_results:
        # Approximation : on n'a pas les raw arrays, mais on peut estimer
        pass  # Le pooled exact nécessiterait les arrays bruts

    # Comparaison avec Lasso
    print(f"\n  {'─' * 80}")
    lasso_rmse = 0.01183  # Valeur du tableau de l'utilisateur
    avg_rmse = np.mean([r['test']['rmse'] for r in all_results])
    print(f"  Comparaison : Transformer RMSE={avg_rmse:.5f} vs Lasso RMSE={lasso_rmse:.5f}")
    if avg_rmse > lasso_rmse:
        print(f"  → Lasso reste meilleur ({avg_rmse/lasso_rmse:.1f}x plus d'erreur)")
    else:
        print(f"  → Transformer surpasse Lasso ✅ ({lasso_rmse/avg_rmse:.1f}x meilleur)")

    print()


if __name__ == "__main__":
    main()
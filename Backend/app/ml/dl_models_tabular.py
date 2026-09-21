"""
Modèles Deep Learning CORRIGÉS pour données tabulaires (IV options).

Tous prennent un vecteur plat (n_features,) en entrée.
Les modèles "séquentiels" (LSTM/GRU/BiLSTM/BiRNN/CNN/Transformer) traitent
chaque feature comme un token, AVEC un embedding appris (chaque feature ->
vecteur d_embed) pour donner de la matière aux couches.

Corrections clés vs version d'origine :
  - embedding des features (au lieu de scalaires bruts)
  - Flatten au lieu de GlobalAveragePooling (ne dilue plus le signal)
  - gradient clipping pour les RNN
  - LR + warmup adaptés par modèle (voté par make_lr_callback)
"""
from __future__ import annotations
from typing import Dict
import numpy as np


def _tf():
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    return tf, keras, layers


D_EMBED = 16  # dimension d'embedding par feature pour les modèles séquentiels


# ============================================================
#  Helpers
# ============================================================
def _feature_embedding(inp, layers, d_embed=D_EMBED):
    """(B, F) -> (B, F, d_embed) : chaque feature devient un vecteur appris."""
    x = layers.Reshape((inp.shape[-1], 1))(inp)       # (B, F, 1)
    x = layers.Dense(d_embed, activation="relu")(x)    # (B, F, d_embed)
    return x


def _compile(m, keras, lr, clipnorm=None):
    opt = keras.optimizers.Adam(lr, clipnorm=clipnorm) if clipnorm else keras.optimizers.Adam(lr)
    m.compile(optimizer=opt, loss="mse", metrics=["mae"])
    return m


# ============================================================
#  1. MLP+ (tabulaire pur)
# ============================================================
def build_mlp_plus(n_features, lr=1e-3, units=(256, 128, 64), dropout=0.3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = layers.Dense(units[0])(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Activation("relu")(x)
    x = layers.Dropout(dropout)(x)
    for u in units[1:]:
        skip = x
        h = layers.Dense(u)(x)
        h = layers.BatchNormalization()(h)
        h = layers.Activation("relu")(h)
        h = layers.Dropout(dropout)(h)
        x = layers.Add()([skip, h]) if skip.shape[-1] == u else h
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="MLPPlus"), keras, lr)


# ============================================================
#  2. TabResNet
# ============================================================
def build_tab_resnet(n_features, lr=1e-3, d_main=128, d_hidden=256, blocks=3, dropout=0.25):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = layers.Dense(d_main)(inp)
    for _ in range(blocks):
        skip = x
        h = layers.BatchNormalization()(x)
        h = layers.Dense(d_hidden, activation="relu")(h)
        h = layers.Dropout(dropout)(h)
        h = layers.Dense(d_main)(h)
        h = layers.Dropout(dropout)(h)
        x = layers.Add()([skip, h])
    x = layers.BatchNormalization()(x)
    x = layers.Activation("relu")(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="TabResNet"), keras, lr)


# ============================================================
#  3. FT-Transformer (corrigé : Flatten + LR warmup côté callback)
# ============================================================
def build_ft_transformer(n_features, lr=5e-4, d_model=32, heads=8, blocks=3,
                         ff_dim=64, dropout=0.1):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = layers.Reshape((n_features, 1))(inp)
    x = layers.Dense(d_model)(x)                       # tokenizer
    for _ in range(blocks):
        attn = layers.MultiHeadAttention(num_heads=heads, key_dim=d_model, dropout=dropout)(x, x)
        x1 = layers.LayerNormalization(epsilon=1e-6)(layers.Add()([x, attn]))
        ff = layers.Dense(ff_dim, activation="gelu")(x1)
        ff = layers.Dropout(dropout)(ff)
        ff = layers.Dense(d_model)(ff)
        x = layers.LayerNormalization(epsilon=1e-6)(layers.Add()([x1, ff]))
    x = layers.Flatten()(x)                            # garde tout le signal
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="FTTransformer"), keras, lr)


# ============================================================
#  4. Transformer "classique" (corrigé)
# ============================================================
def build_transformer(n_features, lr=5e-4, d_model=32, heads=4, blocks=2,
                      ff_dim=64, dropout=0.1):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers, d_model)
    for _ in range(blocks):
        attn = layers.MultiHeadAttention(num_heads=heads, key_dim=d_model, dropout=dropout)(x, x)
        x1 = layers.LayerNormalization(epsilon=1e-6)(layers.Add()([x, attn]))
        ff = layers.Dense(ff_dim, activation="relu")(x1)
        ff = layers.Dense(d_model)(ff)
        x = layers.LayerNormalization(epsilon=1e-6)(layers.Add()([x1, ff]))
    x = layers.Flatten()(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="Transformer"), keras, lr)


# ============================================================
#  5-7. LSTM / GRU / BiLSTM (avec embedding + clipping)
# ============================================================
def build_lstm(n_features, lr=1e-3, units=64, dropout=0.2):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers)
    x = layers.LSTM(units, return_sequences=True, dropout=dropout)(x)
    x = layers.LSTM(units // 2)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="LSTM"), keras, lr, clipnorm=1.0)


def build_gru(n_features, lr=1e-3, units=64, dropout=0.2):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers)
    x = layers.GRU(units, return_sequences=True, dropout=dropout)(x)
    x = layers.GRU(units // 2)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="GRU"), keras, lr, clipnorm=1.0)


def build_bilstm(n_features, lr=1e-3, units=64, dropout=0.2):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers)
    x = layers.Bidirectional(layers.LSTM(units, return_sequences=True, dropout=dropout))(x)
    x = layers.Bidirectional(layers.LSTM(units // 2))(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="BiLSTM"), keras, lr, clipnorm=1.0)


# ============================================================
#  8. BiRNN (SimpleRNN — le plus fragile, clipping fort + lr bas)
# ============================================================
def build_birnn(n_features, lr=5e-4, units=48, dropout=0.2):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers)
    x = layers.Bidirectional(layers.SimpleRNN(units, return_sequences=True,
                                              dropout=dropout, activation="tanh"))(x)
    x = layers.Bidirectional(layers.SimpleRNN(units // 2, activation="tanh"))(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="BiRNN"), keras, lr, clipnorm=0.5)


# ============================================================
#  9. CNN (Conv1D extracteur d'interactions de features)
# ============================================================
def build_cnn(n_features, lr=1e-3, filters=64, dropout=0.2):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = _feature_embedding(inp, layers)
    x = layers.Conv1D(filters, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(filters, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalMaxPooling1D()(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(1)(x)
    return _compile(keras.Model(inp, out, name="CNN"), keras, lr)


# ============================================================
#  Factory
# ============================================================
_BUILDERS = {
    "MLPPlus": build_mlp_plus, "TabResNet": build_tab_resnet,
    "FTTransformer": build_ft_transformer, "Transformer": build_transformer,
    "LSTM": build_lstm, "GRU": build_gru, "BiLSTM": build_bilstm,
    "BiRNN": build_birnn, "CNN": build_cnn,
}

# LR max par modèle (les modèles à attention/récurrents profitent du warmup)
LR_CONFIG = {
    "MLPPlus": 1e-3, "TabResNet": 1e-3, "CNN": 1e-3,
    "FTTransformer": 5e-4, "Transformer": 5e-4,
    "LSTM": 1e-3, "GRU": 1e-3, "BiLSTM": 1e-3, "BiRNN": 5e-4,
}
# Modèles qui bénéficient d'un warmup
USE_WARMUP = {"FTTransformer", "Transformer", "BiRNN", "BiLSTM", "LSTM", "GRU"}


def get_tabular_dl_models(n_features: int, only=None) -> Dict[str, "keras.Model"]:
    names = only if only else list(_BUILDERS.keys())
    return {n: _BUILDERS[n](n_features) for n in names}


def make_lr_callback(model_name, total_epochs, warmup=15):
    """Warmup linéaire + cosine decay pour les modèles sensibles ;
    sinon ReduceLROnPlateau doux."""
    _, keras, _ = _tf()
    max_lr = LR_CONFIG.get(model_name, 1e-3)
    if model_name in USE_WARMUP:
        def sched(epoch):
            if epoch < warmup:
                return max_lr * (epoch + 1) / warmup
            prog = (epoch - warmup) / max(1, total_epochs - warmup)
            return float(max_lr * 0.5 * (1 + np.cos(np.pi * prog)))
        return keras.callbacks.LearningRateScheduler(sched, verbose=0)
    return keras.callbacks.ReduceLROnPlateau(monitor="val_loss", patience=12,
                                             factor=0.5, min_lr=1e-6)


def fit_tabular_dl(model, model_name, X_train, y_train, X_val, y_val,
                   epochs=300, batch_size=128, patience=30, verbose=0):
    _, keras, _ = _tf()
    es = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience,
                                       restore_best_weights=True)
    lr_cb = make_lr_callback(model_name, epochs)
    return model.fit(X_train, y_train, validation_data=(X_val, y_val),
                     epochs=epochs, batch_size=batch_size,
                     callbacks=[es, lr_cb], verbose=verbose)
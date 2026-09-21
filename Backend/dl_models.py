from __future__ import annotations

"""
Modèles Deep Learning : MLP, LSTM, GRU, CNN, BiLSTM, BiRNN, Transformer.

Tous prennent en entrée un vecteur de features (n_features,) ;
les modèles séquentiels le reshaping en (n_features, 1) pour traiter
chaque feature comme un timestep.
"""


"""
Modèles Deep Learning recalibrés pour la prédiction d'IV.
Optimisés pour de petits volumes de données par fenêtre (stochasticité accrue, 
régularisation renforcée, et intégration d'un Learning Rate Schedule avec Warmup).
"""



from typing import Dict, Any
import numpy as np


def _tf():
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    return tf, keras, layers


def reshape_seq(X: np.ndarray) -> np.ndarray:
    return X[..., np.newaxis] if X.ndim == 2 else X


# ============================================================
# Planificateur de Taux d'Apprentissage (Warmup + Decay)
# ============================================================
class LinearWarmupCosDecay(object):
    """Génère un callback de planification de LR avec un démarrage strict à 10^-6."""
    def __init__(self, base_lr: float, warmup_epochs: int, total_epochs: int):
        self.base_lr = base_lr
        self.warmup_epochs = warmup_epochs
        self.total_epochs = total_epochs
        self.min_start_lr = 1e-6  # Ton LR de préférence de 10^-6

    def __call__(self, epoch, lr):
        if epoch < self.warmup_epochs:
            # Progression linéaire entre 10^-6 et base_lr (10^-3)
            alpha = epoch / self.warmup_epochs
            return self.min_start_lr + (self.base_lr - self.min_start_lr) * alpha
        else:
            # Décroissance cosinusoïdale après le warmup vers 10^-6
            progress = (epoch - self.warmup_epochs) / (self.total_epochs - self.warmup_epochs)
            cosine_decay = 0.5 * (1.0 + np.cos(np.pi * progress))
            return self.min_start_lr + (self.base_lr - self.min_start_lr) * cosine_decay


# ============================================================
# Architectures
# ============================================================
def build_mlp(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    reg = keras.regularizers.l2(1e-3) # Augmenté à 1e-3 pour pénaliser plus fort
    
    x = layers.Dense(32, activation="relu", kernel_regularizer=reg)(inp) # Plus compact
    x = layers.Dropout(0.4)(x) # Dropout augmenté à 0.4
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="MLP")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_lstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-3)
    
    # recurrent_dropout élevé pour contrer l'absence de vraie séquence
    x = layers.LSTM(24, return_sequences=True, recurrent_dropout=0.2)(inp) 
    x = layers.SpatialDropout1D(0.3)(x) 
    x = layers.LSTM(12)(x)
    x = layers.Dense(12, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="LSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_gru(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-3)
    
    x = layers.GRU(24, return_sequences=True, recurrent_dropout=0.2)(inp)
    x = layers.SpatialDropout1D(0.3)(x)
    x = layers.GRU(12)(x)
    x = layers.Dense(12, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="GRU")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_bilstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-3)
    
    x = layers.Bidirectional(layers.LSTM(16, return_sequences=True, recurrent_dropout=0.2))(inp)
    x = layers.SpatialDropout1D(0.3)(x)
    x = layers.Bidirectional(layers.LSTM(8))(x)
    x = layers.Dense(12, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="BiLSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_birnn(n_features: int, lr: float = 1e-3):
    """
    Remplacement du SimpleRNN par un GRU (L'architecture SimpleRNN souffre 

    de Vanishing Gradient structurel, rendant ses prédictions aberrantes).
    """
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-3)
    
    # L'utilisation de GRU corrige le problème du vanishing gradient du SimpleRNN
    x = layers.Bidirectional(layers.GRU(16, return_sequences=True, recurrent_dropout=0.2))(inp)
    x = layers.SpatialDropout1D(0.3)(x)
    x = layers.Bidirectional(layers.GRU(8))(x)
    x = layers.Dense(12, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="BiRNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_cnn(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-3)
    
    x = layers.Conv1D(24, kernel_size=3, padding="same", activation="relu")(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Conv1D(16, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(12, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="CNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def _transformer_block(x, num_heads: int, ff_dim: int, dropout: float = 0.4):
    _, keras, layers = _tf()
    attn = layers.MultiHeadAttention(num_heads=num_heads, key_dim=x.shape[-1])(x, x)
    attn = layers.Dropout(dropout)(attn)
    x1 = layers.LayerNormalization(epsilon=1e-6)(x + attn)
    ff = layers.Dense(ff_dim, activation="relu")(x1)
    ff = layers.Dense(x.shape[-1])(ff)
    ff = layers.Dropout(dropout)(ff)
    return layers.LayerNormalization(epsilon=1e-6)(x1 + ff)


def build_transformer(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    
    x = layers.Dense(16)(inp)
    x = _transformer_block(x, num_heads=2, ff_dim=16, dropout=0.4) # ff_dim réduit à 16
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(12, activation="relu")(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="Transformer")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


# ============================================================
# Factory
# ============================================================
def get_dl_models(n_features: int) -> Dict[str, Any]:
    return {
        "MLP": build_mlp(n_features),
        "LSTM": build_lstm(n_features),
        "GRU": build_gru(n_features),
        "BiLSTM": build_bilstm(n_features),
        "BiRNN": build_birnn(n_features),
        "CNN": build_cnn(n_features),
        "Transformer": build_transformer(n_features),
    }


def fit_dl(model, X_train, y_train, X_val, y_val,
           epochs=150, batch_size=32, patience=15, is_sequential=True, verbose=0):
    """Entraîne avec une forte stochasticité (batch_size=32) et une convergence étendue."""
    _, keras, _ = _tf()
    if is_sequential:
        X_train = reshape_seq(X_train)
        X_val = reshape_seq(X_val)
        
    # Configuration de l'EarlyStopping étendu pour laisser le modèle converger finement
    es = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience,
                                       restore_best_weights=True)
    
    rlr = keras.callbacks.ReduceLROnPlateau(monitor="val_loss",
                                            patience=max(4, patience // 3),
                                            factor=0.5, min_lr=1e-6)
    
    callbacks = [es, rlr]
    
    # Application spécifique du Warmup pour restabiliser le Transformer
    if model.name == "Transformer":
        warmup_schedule = LinearWarmupCosDecay(base_lr=1e-3, warmup_epochs=15, total_epochs=epochs)
        lrs = keras.callbacks.LearningRateScheduler(warmup_schedule)
        callbacks = [es, lrs] # On remplace ReduceLROnPlateau par le scheduler natif
        
    return model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=epochs, batch_size=batch_size,
        callbacks=callbacks, verbose=verbose,
    )


# Mise à jour des hyperparamètres de reporting
DL_HYPERPARAMS = {
    "MLP":         {"hidden": [32, 16], "dropout": 0.4, "lr": 1e-3, "epochs": 150, "batch_size": 32},
    "LSTM":        {"units": [24, 12], "dropout": 0.4, "lr": 1e-3, "epochs": 150, "batch_size": 32},
    "GRU":         {"units": [24, 12], "dropout": 0.4, "lr": 1e-3, "epochs": 150, "batch_size": 32},
    "BiLSTM":      {"units": [16, 8], "dropout": 0.4, "lr": 1e-3, "epochs": 150, "batch_size": 32},
    "BiRNN":       {"units": [16, 8], "dropout": 0.4, "lr": 1e-3, "epochs": 150, "batch_size": 32}, # GRU Equivalent
    "CNN":         {"filters": 24, "kernel": 3, "lr": 1e-3, "epochs": 150, "batch_size": 32},
    "Transformer": {"heads": 2, "ff_dim": 16, "blocks": 1, "lr": "1e-6_to_1e-3", "epochs": 150, "batch_size": 32},
}


"""
from __future__ import annotations

from typing import Dict, Any
import numpy as np


def _tf():
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    return tf, keras, layers


def reshape_seq(X: np.ndarray) -> np.ndarray:
    return X[..., np.newaxis] if X.ndim == 2 else X


# ============================================================
# Architectures
# ============================================================
def build_mlp(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    reg = keras.regularizers.l2(1e-4) # Pénalité pour stabiliser les poids
    
    x = layers.Dense(64, activation="relu", kernel_regularizer=reg)(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(32, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="MLP")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_lstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-4)
    
    x = layers.LSTM(32, return_sequences=True, recurrent_dropout=0.1)(inp)
    x = layers.SpatialDropout1D(0.2)(x) # Coupe des features entières aléatoirement
    x = layers.LSTM(16)(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="LSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_gru(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-4)
    
    x = layers.GRU(32, return_sequences=True, recurrent_dropout=0.1)(inp)
    x = layers.SpatialDropout1D(0.2)(x)
    x = layers.GRU(16)(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="GRU")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_bilstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-4)
    
    x = layers.Bidirectional(layers.LSTM(32, return_sequences=True, recurrent_dropout=0.1))(inp)
    x = layers.SpatialDropout1D(0.2)(x)
    x = layers.Bidirectional(layers.LSTM(16))(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="BiLSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_birnn(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-4)
    
    x = layers.Bidirectional(layers.SimpleRNN(32, return_sequences=True))(inp)
    x = layers.SpatialDropout1D(0.2)(x)
    x = layers.Bidirectional(layers.SimpleRNN(16))(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="BiRNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_cnn(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    reg = keras.regularizers.l2(1e-4)
    
    x = layers.Conv1D(32, kernel_size=3, padding="same", activation="relu")(inp)
    x = layers.Dropout(0.2)(x)
    x = layers.Conv1D(32, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(16, activation="relu", kernel_regularizer=reg)(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="CNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def _transformer_block(x, num_heads: int, ff_dim: int, dropout: float = 0.2):
    _, keras, layers = _tf()
    attn = layers.MultiHeadAttention(num_heads=num_heads, key_dim=x.shape[-1])(x, x)
    attn = layers.Dropout(dropout)(attn)
    x1 = layers.LayerNormalization(epsilon=1e-6)(x + attn)
    ff = layers.Dense(ff_dim, activation="relu")(x1)
    ff = layers.Dense(x.shape[-1])(ff)
    ff = layers.Dropout(dropout)(ff)
    return layers.LayerNormalization(epsilon=1e-6)(x1 + ff)


def build_transformer(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    
    x = layers.Dense(16)(inp)
    x = _transformer_block(x, num_heads=2, ff_dim=32, dropout=0.2)
    x = _transformer_block(x, num_heads=2, ff_dim=32, dropout=0.2)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(16, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1)(x)
    
    m = keras.Model(inp, out, name="Transformer")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


# ============================================================
# Factory
# ============================================================
def get_dl_models(n_features: int) -> Dict[str, Any]:
    return {
        "MLP": build_mlp(n_features),
        "LSTM": build_lstm(n_features),
        "GRU": build_gru(n_features),
        "BiLSTM": build_bilstm(n_features),
        "BiRNN": build_birnn(n_features),
        "CNN": build_cnn(n_features),
        "Transformer": build_transformer(n_features),
    }


def fit_dl(model, X_train, y_train, X_val, y_val,
           epochs=40, batch_size=256, patience=6, is_sequential=True, verbose=0):
    #Entraîne avec EarlyStopping + ReduceLROnPlateau.

    #Le batch_size a été réduit à 256 pour ajouter de la stochasticité bénéfique en temps de crise.
    
    _, keras, _ = _tf()
    if is_sequential:
        X_train = reshape_seq(X_train)
        X_val = reshape_seq(X_val)
        
    es = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience,
                                       restore_best_weights=True)
    rlr = keras.callbacks.ReduceLROnPlateau(monitor="val_loss",
                                            patience=max(2, patience // 2),
                                            factor=0.5, min_lr=1e-6)
    return model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=epochs, batch_size=batch_size,
        callbacks=[es, rlr], verbose=verbose,
    )


DL_HYPERPARAMS = {
    "MLP":         {"hidden": [64, 32, 16], "dropout": 0.3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "LSTM":        {"units": [32, 16], "dropout": 0.3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "GRU":         {"units": [32, 16], "dropout": 0.3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "BiLSTM":      {"units": [32, 16], "dropout": 0.3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "BiRNN":       {"units": [32, 16], "dropout": 0.3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "CNN":         {"filters": 32, "kernel": 3, "lr": 1e-3, "epochs": 40, "batch_size": 256},
    "Transformer": {"heads": 2, "ff_dim": 32, "blocks": 2, "lr": 1e-3, "epochs": 40, "batch_size": 256},
}
"""




"""
Modèles Deep Learning : MLP, LSTM, GRU, CNN, BiLSTM, BiRNN, Transformer.

Tous prennent en entrée un vecteur de features (n_features,) ;
les modèles séquentiels le reshaping en (n_features, 1) pour traiter
chaque feature comme un timestep.
"""
"""
from __future__ import annotations

from typing import Dict, Tuple
import numpy as np


def _tf():
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    return tf, keras, layers


def reshape_seq(X: np.ndarray) -> np.ndarray:
    return X[..., np.newaxis] if X.ndim == 2 else X


# ============================================================
# Architectures
# ============================================================
def build_mlp(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features,))
    x = layers.Dense(128, activation="relu")(inp)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(32, activation="relu")(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="MLP")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_lstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.LSTM(64, return_sequences=True)(inp)
    x = layers.LSTM(32)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="LSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_gru(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.GRU(64, return_sequences=True)(inp)
    x = layers.GRU(32)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="GRU")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_bilstm(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(inp)
    x = layers.Bidirectional(layers.LSTM(32))(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="BiLSTM")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_birnn(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.Bidirectional(layers.SimpleRNN(64, return_sequences=True))(inp)
    x = layers.Bidirectional(layers.SimpleRNN(32))(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="BiRNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def build_cnn(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(inp)
    x = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="CNN")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


def _transformer_block(x, num_heads: int, ff_dim: int, dropout: float = 0.1):
    _, keras, layers = _tf()
    attn = layers.MultiHeadAttention(num_heads=num_heads, key_dim=x.shape[-1])(x, x)
    attn = layers.Dropout(dropout)(attn)
    x1 = layers.LayerNormalization(epsilon=1e-6)(x + attn)
    ff = layers.Dense(ff_dim, activation="relu")(x1)
    ff = layers.Dense(x.shape[-1])(ff)
    ff = layers.Dropout(dropout)(ff)
    return layers.LayerNormalization(epsilon=1e-6)(x1 + ff)


def build_transformer(n_features: int, lr: float = 1e-3):
    _, keras, layers = _tf()
    inp = keras.Input(shape=(n_features, 1))
    x = layers.Dense(32)(inp)
    x = _transformer_block(x, num_heads=4, ff_dim=64, dropout=0.1)
    x = _transformer_block(x, num_heads=4, ff_dim=64, dropout=0.1)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(1)(x)
    m = keras.Model(inp, out, name="Transformer")
    m.compile(optimizer=keras.optimizers.Adam(lr), loss="mse", metrics=["mae"])
    return m


# ============================================================
# Factory
# ============================================================
def get_dl_models(n_features: int) -> Dict[str, "keras.Model"]:
    return {
        "MLP": build_mlp(n_features),
        "LSTM": build_lstm(n_features),
        "GRU": build_gru(n_features),
        "BiLSTM": build_bilstm(n_features),
        "BiRNN": build_birnn(n_features),
        "CNN": build_cnn(n_features),
        "Transformer": build_transformer(n_features),
    }


def fit_dl(model, X_train, y_train, X_val, y_val,
           epochs=30, batch_size=512, patience=5, is_sequential=True, verbose=0):
    #Entraîne avec EarlyStopping + ReduceLROnPlateau.
    _, keras, _ = _tf()
    if is_sequential:
        X_train = reshape_seq(X_train)
        X_val = reshape_seq(X_val)
    es = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience,
                                        restore_best_weights=True)
    rlr = keras.callbacks.ReduceLROnPlateau(monitor="val_loss",
                                              patience=max(2, patience // 2),
                                              factor=0.5, min_lr=1e-6)
    return model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=epochs, batch_size=batch_size,
        callbacks=[es, rlr], verbose=verbose,
    )


DL_HYPERPARAMS = {
    "MLP":         {"hidden": [128, 64, 32], "dropout": 0.2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "LSTM":        {"units": [64, 32], "dropout": 0.2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "GRU":         {"units": [64, 32], "dropout": 0.2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "BiLSTM":      {"units": [64, 32], "dropout": 0.2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "BiRNN":       {"units": [64, 32], "dropout": 0.2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "CNN":         {"filters": 64, "kernel": 3, "lr": 1e-3, "epochs": 30, "batch_size": 512},
    "Transformer": {"heads": 4, "ff_dim": 64, "blocks": 2, "lr": 1e-3, "epochs": 30, "batch_size": 512},
}
"""
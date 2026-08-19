import pandas as pd
df = pd.read_csv('/app/data/vol_surface_spx_clean.csv', sep=';', nrows=20)
print("Colonnes:", df.columns.tolist())
print()
print("5 premieres lignes:")
print(df.head())
print()
print("Stats moneyness:")
print(df['moneyness'].describe())

import pandas as pd
df = pd.read_csv('/app/data/options_merged_spx.csv', sep=';', nrows=2000)
print("Colonnes:", df.columns.tolist())
print()
for col in ['strike','close_gspc','moneyness','iv','delta','put_call']:
    if col in df.columns:
        print(f"--- {col} ---")
        print(df[col].describe())
        print()

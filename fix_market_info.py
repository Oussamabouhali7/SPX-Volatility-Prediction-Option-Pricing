with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()

# Corriger lignes 157-159 (indices 156-158)
lines[156] = '    vix   = float(market_row.get("vix",     0)) if "vix"     in market_row else None\n'
lines[157] = '    rate  = float(market_row.get("rate_10y",0)) if "rate_10y" in market_row else None\n'
lines[158] = '    fwd   = float(market_row.get("close_gspc", 0)) if "close_gspc" in market_row else None\n'

with open('/app/app/routers/surface_router.py', 'w') as f:
    f.writelines(lines)

print('market_info corrige')

# Verification
with open('/app/app/routers/surface_router.py', 'r') as f:
    lines2 = f.readlines()
for i in range(154, 172):
    print(f'{i+1}: {lines2[i].rstrip()}')

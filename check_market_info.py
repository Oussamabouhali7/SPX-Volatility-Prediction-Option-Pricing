with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()

# Trouver les lignes avec rate et forward
for i, line in enumerate(lines, 1):
    if 'market_info' in line or 'rate' in line.lower() or 'forward' in line.lower() or 'vix' in line.lower():
        print(f'{i}: {line.rstrip()}')

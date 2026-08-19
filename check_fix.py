with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if 'MONEYNESS' in line or 'moneyness_norm' in line or 'feat["moneyness"]' in line:
        print(f'{i}: {line.rstrip()}')

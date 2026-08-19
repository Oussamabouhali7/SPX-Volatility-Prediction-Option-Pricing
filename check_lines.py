with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()

# Afficher lignes 44-62 pour voir exactement ce qui est present
for i in range(43, 63):
    print(f'{i+1}: {repr(lines[i])}')

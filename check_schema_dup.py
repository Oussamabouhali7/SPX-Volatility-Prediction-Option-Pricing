with open('/app/app/schemas.py', 'r') as f:
    lines = f.readlines()

# Afficher les lignes autour des doublons
for i in range(48, 75):
    print(f'{i+1}: {repr(lines[i])}')

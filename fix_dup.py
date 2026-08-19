with open('/app/app/schemas.py', 'r') as f:
    lines = f.readlines()

# Supprimer les doublons (indices 55 et 69)
lines[55] = ''
lines[69] = ''

with open('/app/app/schemas.py', 'w') as f:
    f.writelines(lines)

print('Doublons supprimes')

# Verification
with open('/app/app/schemas.py', 'r') as f:
    lines2 = f.readlines()
for i in range(48, 72):
    print(f'{i+1}: {lines2[i].rstrip()}')

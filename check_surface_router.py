with open('/app/app/routers/surface_router.py', 'r') as f:
    lines = f.readlines()
for i in range(0, 80):
    print(f'{i+1}: {lines[i].rstrip()}')

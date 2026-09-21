content = open("/app/app/routers/surface_router.py").read()

old = """@router.get('/dates')
def list_dates(_: User = Depends(get_current_user)):
    df = _load_surface()
    dates = sorted(df['date'].dt.strftime('%Y-%m-%d').unique().tolist())
    return {'dates': dates, 'count': len(dates)}"""

new = """CRISIS_PERIODS = {
    "Crise Subprimes": ("2007-07-01", "2009-06-30"),
    "Crise COVID-19":  ("2020-02-15", "2020-12-31"),
    "Attentats 11 Sept": ("2001-09-01", "2001-10-31"),
    "Guerre Ukraine": ("2022-02-24", "2022-12-31"),
    "Crise Dot-com": ("2000-03-01", "2002-10-31"),
}

def _get_crisis_label(date_str):
    for label, (start, end) in CRISIS_PERIODS.items():
        if start <= date_str <= end:
            return f"[{label}] {date_str}"
    return date_str

@router.get('/dates')
def list_dates(_: User = Depends(get_current_user)):
    df = _load_surface()
    dates = sorted(df['date'].dt.strftime('%Y-%m-%d').unique().tolist())
    labeled = [_get_crisis_label(d) for d in dates]
    return {'dates': labeled, 'count': len(labeled)}"""

content = content.replace(old, new)
open("/app/app/routers/surface_router.py", "w").write(content)
print("OK")

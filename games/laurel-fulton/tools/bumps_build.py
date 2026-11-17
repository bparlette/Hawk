#!/usr/bin/env python3
# bumps_build.py — task L3: speed-bump placement, data-driven from the road graph -> data/bumps.json.
#   python3 tools/bumps_build.py          (from games/laurel-fulton/)
# Rules (owner, Nov 17): neighborhood streets only (residential / living_street, cul-de-sacs included) —
# never MD-216, the freeways or the Maple Lawn Blvd arterial (class + name filter); spaced ~110 m along a
# street; >= 35 m from any junction; >= 45 m from every crew house and rally stop; nothing on a bridge.
# Each bump: {x, y, dx, dy, w} — centre, the road's unit direction there, the carriageway width (units).
import json, os, math
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root()
G = json.load(open(os.path.join(ROOT, 'data', 'graph.json'))); R = json.load(open(os.path.join(ROOT, 'data', 'roster.json')))
SPACING, JUNC, HOUSE = 1100, 350, 450                  # units (10 / m)
deg = {}
for e in G['edges']:
    for v in (e['a'], e['b']): deg[v] = deg.get(v, 0) + 1
houses = [p['house'] for p in R['people'] if p.get('active') and p.get('house')]
# a bump must sit where ITS street is the nearest road (not beside another road's kerb)
segs = [(e, P[i], P[i + 1]) for e in G['edges'] for P in [e['pts']] for i in range(len(P) - 1) if e['hw'] != 'service']
grid = {}
for k, (e, a, b) in enumerate(segs):
    for cx in range(int(min(a[0], b[0]) // 256) - 1, int(max(a[0], b[0]) // 256) + 2):
        for cy in range(int(min(a[1], b[1]) // 256) - 1, int(max(a[1], b[1]) // 256) + 2): grid.setdefault((cx, cy), []).append(k)
def nearest_edge(x, y):
    best, be = 1e18, None
    for k in grid.get((int(x // 256), int(y // 256)), []):
        e, a, b = segs[k]; vx, vy = b[0] - a[0], b[1] - a[1]; L2 = vx * vx + vy * vy or 1
        t = max(0, min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); d = math.hypot(a[0] + vx * t - x, a[1] + vy * t - y) - e['w'] / 2
        if d < best: best, be = d, e
    return be
NEVER = ('Maple Lawn Boulevard', 'Scaggsville Road', 'Johns Hopkins Road', 'Columbia Pike')
bumps = []
for e in G['edges']:
    if e['hw'] not in ('residential', 'living_street') or e['bridge'] or e['layer'] or e['name'] in NEVER or 'Maple Lawn' in e['name'] or 'MD' in (e['ref'] or '') or e['len'] < 2 * JUNC: continue
    P = e['pts']; cum = [0]
    for i in range(1, len(P)): cum.append(cum[-1] + math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
    L = cum[-1]
    lo = JUNC if deg.get(e['a'], 0) != 1 else 120       # a dead end (cul-de-sac bulb) needs less clearance
    hi = L - (JUNC if deg.get(e['b'], 0) != 1 else 120)
    s = lo + ((e['a'] * 7 + e['b'] * 13) % 500)          # deterministic phase per street
    while s < hi:
        i = max(k for k in range(len(cum)) if cum[k] <= s); i = min(i, len(P) - 2)
        u = (s - cum[i]) / max(1e-6, cum[i + 1] - cum[i]); x = P[i][0] + (P[i + 1][0] - P[i][0]) * u; y = P[i][1] + (P[i + 1][1] - P[i][1]) * u
        dx, dy = P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]; l = math.hypot(dx, dy) or 1
        if nearest_edge(x, y) is e and all(math.hypot(x - h[0], y - h[1]) > HOUSE for h in houses) and all(math.hypot(x - b['x'], y - b['y']) > SPACING * 0.6 for b in bumps[-40:]):
            bumps.append({'x': round(x), 'y': round(y), 'dx': round(dx / l, 4), 'dy': round(dy / l, 4), 'w': e['w']})
        s += SPACING
json.dump({'_doc': 'speed bumps (task L3): residential streets only; tools/bumps_build.py', 'bumps': bumps}, open(os.path.join(ROOT, 'data', 'bumps.json'), 'w'), separators=(',', ':'))
print(len(bumps), 'speed bumps on residential streets')

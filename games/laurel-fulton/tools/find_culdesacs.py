#!/usr/bin/env python3
"""find_culdesacs.py — every real cul-de-sac on the map, for Cul-de-Sac King of the Hill.

A cul-de-sac here = a degree-1 vertex (dead end) on a RESIDENTIAL way of at least 120 units
(12 m of street behind it) — the 2,538 'service' dead-ends are driveways and never count.
The ring centre is the dead-end vertex pulled 45 units back along its street (the bulb's
heart sits just inside the tip); the radius is a fixed 125 units (12.5 m — a real bulb).
Centres closer than 260 units are the same bulb mapped twice (split ways) and merge.

  python3 tools/find_culdesacs.py     # data/graph.json -> data/culdesacs.json
"""
import json, math
from collections import Counter

G = json.load(open('data/graph.json'))
V, E = G['verts'], G['edges']
deg = Counter()
for e in E:
    deg[e['a']] += 1; deg[e['b']] += 1

out = []
for e in E:
    for end in ('a', 'b'):
        if deg[e[end]] != 1 or e['hw'] != 'residential' or e['len'] < 120:
            continue
        v = V[e[end]]
        pts = e['pts'] if end == 'a' else list(reversed(e['pts']))   # walk away from the tip
        cx, cy = v['x'], v['y']
        if len(pts) > 1:                                             # pull the centre 45 u into the street
            (x0, y0), (x1, y1) = pts[0], pts[1]
            d = math.hypot(x1 - x0, y1 - y0) or 1
            cx, cy = x0 + (x1 - x0) / d * 45, y0 + (y1 - y0) / d * 45
        out.append({'x': round(cx, 1), 'y': round(cy, 1), 'r': 125, 'name': e['name'] or 'Cul-de-sac', 'len': e['len']})

out.sort(key=lambda s: -s['len'])                                    # longest street wins a merge
kept = []
for s in out:
    if all(math.hypot(s['x'] - k['x'], s['y'] - k['y']) > 260 for k in kept):
        kept.append(s)
kept.sort(key=lambda s: s['name'])
for s in kept:
    del s['len']
json.dump(kept, open('data/culdesacs.json', 'w'), separators=(',', ':'))
print(f"{len(kept)} cul-de-sacs -> data/culdesacs.json")
print('sample:', [k['name'] for k in kept[:6]])

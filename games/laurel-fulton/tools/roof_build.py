#!/usr/bin/env python3
"""roof_build.py — task L5: a CLIMBABLE ROOF on a real building -> data/roof.json (+ fixes the hero footprint in data/areas.json).
  python3 tools/roof_build.py ["<POI name>"]          (from games/laurel-fulton/; default = the roster's meet-up, Atholton High School)
  LF_ROOT=<city> python3 tools/roof_build.py ...      (any factory city)

WHY: the stage-1 area pass (osm_areas.py) only read closed building WAYS. Atholton High School is an OSM MULTIPOLYGON
relation (relation 1988823: building=school, building:levels=2, one 21,400 m2 outer ring + 3 courtyards), so the game had
been showing a 172 m2 shed as "Atholton High School". This tool fetches a small box around the POI from the OSM main API
(the cloud egress resets Overpass), stitches the relation's rings, and writes everything the roof needs:

  outer / inner      the real outline + the courtyards (world units, 10/m, the graph projection via world_cfg)
  h                  roof height: building:height / height tag, else building:levels x 3.6 m
  chains             the WAY UP, readable without a tutorial: per the owner's shape, dumpster -> HVAC box -> parapet on the
                     outer wall facing the meet-up lot, plus a planter -> utility cabinet -> parapet in every courtyard
                     (so a jump into a courtyard is never a trap). Each hold: centre, wall-aligned angle, size, top height.
  path               the worn path: from the nearest road/lot aisle to the first hold (drawn as a trodden strip)
  ac / vents / pipes / hatch   the roof dressing, seeded from the OSM id (same roof every build): AC units are SOLID and
                     climbable (1.6 m), vents + pipes are low step-overs. Nothing invisible: every solid is drawn.
Re-run after a new OSM fetch or to move the chain; the game reads data/roof.json, src/lf_climb.js is the logic."""
import os, sys, json, math, random, urllib.request, xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root()
R = json.load(open(os.path.join(ROOT, 'data', 'roster.json')))
NAME = sys.argv[1] if len(sys.argv) > 1 else R['meetup']['name']
LAT0, LON0 = world_cfg.LAT0, world_cfg.LON0
KX, KY = math.cos(math.radians(LAT0)) * 111320.0 * 10, 110540.0 * 10
proj = lambda lat, lon: (round((lon - LON0) * KX), round(-(lat - LAT0) * KY))
P = json.load(open(os.path.join(ROOT, 'data', 'osm_places.json')))['elements']
q = next((e for e in P if e['tags'].get('name') == NAME), None)
if not q: sys.exit(f'roof_build: no OSM place named {NAME!r} in data/osm_places.json')
lat, lon = q['lat'], q['lon']
# 1 fetch a ~900 m box around the POI (cached)
cache = f"/tmp/lf_roof_{''.join(c for c in NAME if c.isalnum())}.osm"
if not os.path.exists(cache):
    d = 0.004
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={lon - d * 1.3},{lat - d},{lon + d * 1.3},{lat + d}'
    req = urllib.request.Request(url, headers={'User-Agent': 'city-game-factory/1.0 (roof_build)'})
    open(cache, 'wb').write(urllib.request.urlopen(req, timeout=90).read())
root = ET.parse(cache).getroot()
nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
ways = {w.get('id'): ([x.get('ref') for x in w.iter('nd')], {t.get('k'): t.get('v') for t in w.iter('tag')}) for w in root.iter('way')}
def ring(refs): return [proj(*nodes[r]) for r in refs[:-1]] if refs[0] == refs[-1] and all(r in nodes for r in refs) else None
def stitch(parts):                                       # join open member ways end to end into closed rings
    rings, parts = [], [p[:] for p in parts]
    while parts:
        cur = parts.pop(0)
        while cur[0] != cur[-1]:
            for i, p in enumerate(parts):
                if p[0] == cur[-1]: cur += p[1:]; parts.pop(i); break
                if p[-1] == cur[-1]: cur += p[::-1][1:]; parts.pop(i); break
            else: break
        if cur[0] == cur[-1] and len(cur) > 3: rings.append(cur)
    return rings
cands = []                                               # (tags, outer rings, inner rings, osm ref)
for rel in root.iter('relation'):
    t = {x.get('k'): x.get('v') for x in rel.iter('tag')}
    if t.get('type') != 'multipolygon' or 'building' not in t: continue
    mem = [(m.get('role'), ways[m.get('ref')][0]) for m in rel.iter('member') if m.get('type') == 'way' and m.get('ref') in ways]
    outs = [ring(r) for r in stitch([w for role, w in mem if role == 'outer'])]
    ins = [ring(r) for r in stitch([w for role, w in mem if role == 'inner'])]
    if all(outs) and outs: cands.append((t, outs, [i for i in ins if i], 'relation/' + rel.get('id')))
for wid, (refs, t) in ways.items():
    if 'building' in t and ring(refs): cands.append((t, [ring(refs)], [], 'way/' + wid))
def inside(px, py, pts):
    c = False
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: c = not c
    return c
def area(pts): return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
px, py = proj(lat, lon)
named = [c for c in cands if c[0].get('name') == NAME]
pick = max(named, key=lambda c: area(c[1][0])) if named else next((c for c in cands if inside(px, py, c[1][0])), None)
if not pick:                                             # the POI is a point beside its building (a mill, a campus): the biggest within 150 m
    near = [c for c in cands if min(math.hypot(x - px, y - py) for x, y in c[1][0]) < 1500 and area(c[1][0]) > 30000]
    pick = max(near, key=lambda c: area(c[1][0])) if near else None
if not pick: sys.exit(f'roof_build: no building outline for {NAME!r} near the POI')
tags, outs, ins, ref = pick
outer = max(outs, key=area)
H = None
for k in ('building:height', 'height'):
    try: H = float(tags[k].split()[0]); break
    except (KeyError, ValueError): pass
levels = int(float(tags.get('building:levels', '2')))
H = H or levels * 3.6
h = round(H * 10)
def in_roof(x, y): return inside(x, y, outer) and not any(inside(x, y, r) for r in ins)
def seg_d(x, y, a, b):
    vx, vy = b[0] - a[0], b[1] - a[1]; L2 = vx * vx + vy * vy or 1
    t = max(0, min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L2)); return math.hypot(a[0] + vx * t - x, a[1] + vy * t - y)
def edge_d(x, y): return min(seg_d(x, y, r[i], r[(i + 1) % len(r)]) for r in [outer] + ins for i in range(len(r)))
# 2 the WAY UP: on the wall facing the meet-up lot (nearest outer-wall point to the meet-up), holds stepped along the wall
mx, my = R['meetup']['pos'] if R['meetup']['name'] == NAME else (px, py)
def chain(rng_pts, tx, ty, kinds, room):
    best = None
    for i in range(len(rng_pts)):
        a, b = rng_pts[i], rng_pts[(i + 1) % len(rng_pts)]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 100: continue                               # needs >= 10 m of straight wall for two holds
        vx, vy = b[0] - a[0], b[1] - a[1]
        t = max(45 / L, min(1 - 45 / L, ((tx - a[0]) * vx + (ty - a[1]) * vy) / (L * L)))
        wx, wy = a[0] + vx * t, a[1] + vy * t; d = math.hypot(wx - tx, wy - ty)
        if best is None or d < best[0]: best = (d, wx, wy, vx / L, vy / L, L * t, L * (1 - t))
    _, wx, wy, ux, uy, roomA, roomB = best
    nx, ny = -uy, ux                                       # outward = the side that is NOT roof
    if in_roof(wx + nx * 15, wy + ny * 15): nx, ny = -nx, -ny
    side = 1 if roomB > roomA else -1                      # the lower hold sits toward the longer stretch of wall
    (k1, w1, d1, t1), (k2, w2, d2, t2) = kinds
    hold2 = {'kind': k2, 'x': round(wx + nx * (d2 / 2 - 1)), 'y': round(wy + ny * (d2 / 2 - 1)), 'a': round(math.atan2(uy, ux), 4), 'w': w2, 'd': d2, 'top': t2}
    off = (w2 / 2 + w1 / 2 - 1) * side                    # holds touch (a gap would drop you between them) and sit flush on the wall
    hold1 = {'kind': k1, 'x': round(wx + ux * off + nx * (d1 / 2 - 1)), 'y': round(wy + uy * off + ny * (d1 / 2 - 1)), 'a': hold2['a'], 'w': w1, 'd': d1, 'top': t1}
    return {'holds': [hold1, hold2], 'wall': {'x': round(wx), 'y': round(wy), 'nx': round(nx, 4), 'ny': round(ny, 4)}, 'room': room}
chains = [chain(outer, mx, my, [('dumpster', 20, 15, 14), ('hvac', 24, 16, 32)], 'outside')]
for r in ins:                                              # every courtyard gets its own way out
    cx, cy = sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)
    chains.append(chain(r, cx, cy, [('planter', 18, 12, 10), ('cabinet', 16, 10, 30)], 'courtyard'))
# 3 the worn path: nearest drivable point (road / lot aisle) -> the first hold, with a little wander
G = json.load(open(os.path.join(ROOT, 'data', 'graph.json')))
h1 = chains[0]['holds'][0]; bx, by, bd = h1['x'], h1['y'], 1e18
for e in G['edges']:
    pts = e['pts']
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]; vx, vy = b[0] - a[0], b[1] - a[1]; L2 = vx * vx + vy * vy or 1
        t = max(0, min(1, ((h1['x'] - a[0]) * vx + (h1['y'] - a[1]) * vy) / L2)); qx, qy = a[0] + vx * t, a[1] + vy * t
        d = math.hypot(qx - h1['x'], qy - h1['y'])
        if d < bd: bd, bx, by = d, qx, qy
rng = random.Random(int(''.join(c for c in ref if c.isdigit())))
n = max(2, int(bd / 40))
path = [[round(bx + (h1['x'] - bx) * k / n + (rng.uniform(-6, 6) if 0 < k < n else 0)), round(by + (h1['y'] - by) * k / n + (rng.uniform(-6, 6) if 0 < k < n else 0))] for k in range(n + 1)]
# 4 the roof dressing (seeded): AC units on a loose grid aligned to the building's long axis, vents, pipe runs, one hatch
L, ax = 0, 0
for i in range(len(outer)):
    a, b = outer[i], outer[(i + 1) % len(outer)]; l = math.hypot(b[0] - a[0], b[1] - a[1])
    if l > L: L, ax = l, math.atan2(b[1] - a[1], b[0] - a[0])
xs, ys = [p[0] for p in outer], [p[1] for p in outer]
landings = [(c['wall']['x'] - c['wall']['nx'] * 40, c['wall']['y'] - c['wall']['ny'] * 40) for c in chains]
ac, vents, pipes = [], [], []
def free(x, y, r, objs): return all(math.hypot(x - o['x'], y - o['y']) > r for o in objs)
tries = 0
target = int(area(outer) / 100 / 900) + 2
while len(ac) < target and tries < 5000:
    tries += 1; x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
    if not in_roof(x, y) or edge_d(x, y) < 70 or not free(x, y, 110, ac) or any(math.hypot(x - lx, y - ly) < 90 for lx, ly in landings): continue
    big = rng.random() < 0.3
    ac.append({'x': round(x), 'y': round(y), 'a': round(ax, 4), 'w': 34 if big else 24, 'd': 22 if big else 16, 'top': h + 16})
tries = 0
while len(vents) < target * 3 and tries < 8000:
    tries += 1; x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
    if not in_roof(x, y) or edge_d(x, y) < 25 or not free(x, y, 40, ac) or not free(x, y, 30, vents): continue
    vents.append({'x': round(x), 'y': round(y), 'r': rng.choice([4, 5, 6])})
for u in ac[:max(3, len(ac) // 2)]:                        # a pipe from each of half the AC units, L-shaped along the axis, to the nearest edge
    ca, sa = math.cos(ax), math.sin(ax); best = None
    for dirn in [(ca, sa), (-ca, -sa), (-sa, ca), (sa, -ca)]:
        k = 0
        while in_roof(u['x'] + dirn[0] * k, u['y'] + dirn[1] * k) and k < 2000: k += 10
        if best is None or k < best[0]: best = (k, dirn)
    k, (dx, dy) = best
    pipes.append([u['x'], u['y'], round(u['x'] + dx * (k - 12)), round(u['y'] + dy * (k - 12))])
hx, hy = sum(xs) / len(xs), sum(ys) / len(ys)
while not in_roof(hx, hy) or edge_d(hx, hy) < 30: hx, hy = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
flat = lambda r: [v for p in r for v in p]
out = {'name': NAME, 'osm': ref, 'levels': levels, 'h': h, 'parapet': 6, 'outer': flat(outer), 'inner': [flat(r) for r in ins], 'axis': round(ax, 4),
       'chains': chains, 'path': path, 'ac': ac, 'vents': vents, 'pipes': pipes, 'hatch': {'x': round(hx), 'y': round(hy), 'a': round(ax, 4)},
       'area_m2': round(area(outer) / 100 - sum(area(r) for r in ins) / 100)}
json.dump(out, open(os.path.join(ROOT, 'data', 'roof.json'), 'w'), separators=(',', ':'))
# 5 the hero tier gets the REAL outline (it had a 172 m2 shed): append the outer ring as a building and point the hero at it
AP = os.path.join(ROOT, 'data', 'areas.json'); A = json.load(open(AP))
fo = flat(outer)
if fo in A['buildings']: bi = A['buildings'].index(fo)
else: bi = len(A['buildings']); A['buildings'].append(fo)
hero = next((x for x in A['heroes'] if x['who'] == NAME), None)
if hero: hero['b'] = bi
else: A['heroes'].append({'b': bi, 'who': NAME, 'kind': 'poi'})
next(x for x in A['heroes'] if x['who'] == NAME)['roof'] = True
json.dump(A, open(AP, 'w'), separators=(',', ':'))
print(f"{NAME}: {ref} {levels} levels -> roof {h / 10:.1f} m, {out['area_m2']} m2 walkable, {len(ins)} courtyards, "
      f"{len(chains)} climb chains, {len(ac)} AC units, {len(vents)} vents, {len(pipes)} pipes; worn path {bd / 10:.0f} m; hero footprint -> buildings[{bi}]")

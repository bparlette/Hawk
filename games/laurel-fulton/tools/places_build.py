#!/usr/bin/env python3
"""places_build.py — task L12/L13: the ENTERABLE PLACES + the world set-pieces -> data/places.json
  python3 tools/places_build.py [--scale 0.5]          (from games/laurel-fulton/; scale defaults to data/world.json, else 0.5)

Everything here is read from the shipped map data (data/areas.json, graph.json, osm_places.json) — no network:
  weis      the REAL Weis Markets, 9270 All Saints Rd, Laurel (OSM way 175330281, brand=Weis, shop=supermarket, inside the
            Whiskey Bottom Center retail landuse). Its footprint is areas.json building 3885 (4,577 m2). Evidence: OSM.
  gringada  a MEMORY BUILD. Gringada (a Mexican restaurant, gone since after 1998) is in NO map data. It is placed in a real
            Columbia shopping center — Hickory Ridge Village Center (OSM landuse=retail way 147191220, inside this map) — on
            the restaurant end-pad that today holds Koto Sake Japanese Steakhouse (areas.json building 18742, 660 m2). The
            PLACEMENT is invented (no evidence which unit/center it was); labelled `memory: true` everywhere it is shown.
  scott     a random real house on Whiskey Bottom Road (seeded pick from the building footprints beside that road, not a
            crew hero, not Weis). ONLY its position is stored — NO house number is committed (owner rule). Car: a Civic,
            "for now" — there is no Civic sprite in the fleet, so it reuses tracer_zack (the closest compact sedan).
  astro108  a random Chevy Astro parked on Route 108. MD 108 runs ~39.21-39.24 N — just NORTH of this map's box (N edge
            39.202) — so the Astro is parked at the north end of Guilford Rd, the road in the map nearest MD 108. A stand-in
            placement, flagged. Sprite: astro_billy (the fleet's Astro).
Door rule: a place's door is the midpoint of the footprint edge that faces a parking lot (else the road), with the outward normal."""
import os, sys, json, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import world_cfg
ROOT = world_cfg.root(); D = lambda *a: os.path.join(ROOT, 'data', *a)
argv = sys.argv[1:]; SCALE = None
if '--scale' in argv: SCALE = float(argv[argv.index('--scale') + 1])
if SCALE is None:
    wj = D('world.json'); SCALE = json.load(open(wj)).get('scale', 0.5) if os.path.exists(wj) else 0.5
KX, KY = math.cos(math.radians(world_cfg.LAT0)) * 111320.0 * 10 * SCALE, 110540.0 * 10 * SCALE
proj = lambda lat, lon: ((lon - world_cfg.LON0) * KX, -(lat - world_cfg.LAT0) * KY)
A = json.load(open(D('areas.json'))); G = json.load(open(D('graph.json')))
P = json.load(open(D('osm_places.json')))['elements']
B = A['buildings']; M2 = 1 / (100 * SCALE * SCALE)          # world units^2 -> m2 (10 u/m at scale 1)
def inside(x, y, f):
    c = False; n = len(f) // 2
    for i in range(n):
        x1, y1, x2, y2 = f[2 * i], f[2 * i + 1], f[2 * ((i + 1) % n)], f[2 * ((i + 1) % n) + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def area(f):
    n = len(f) // 2; return abs(sum(f[2 * i] * f[2 * ((i + 1) % n) + 1] - f[2 * ((i + 1) % n)] * f[2 * i + 1] for i in range(n))) / 2 * M2
def cen(f): n = len(f) // 2; return sum(f[0::2]) / n, sum(f[1::2]) / n
def bldg_at(x, y):
    hit = [i for i, f in enumerate(B) if inside(x, y, f)]
    return max(hit, key=lambda i: area(B[i])) if hit else None
def door(f):
    """midpoint of the edge facing a parking lot (longest such edge), else the longest edge; outward normal."""
    cx, cy = cen(f); n = len(f) // 2; best = None
    for i in range(n):
        x1, y1, x2, y2 = f[2 * i], f[2 * i + 1], f[2 * ((i + 1) % n)], f[2 * ((i + 1) % n) + 1]
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 30 * SCALE * 10: continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2; nx, ny = (y2 - y1) / L, -(x2 - x1) / L
        if (mx + nx - cx) * nx + (my + ny - cy) * ny < 0: nx, ny = -nx, -ny      # outward
        px, py = mx + nx * 40, my + ny * 40
        park = any(inside(px, py, p) for p in A['parking'])
        road = min((math.hypot(px - q[0], py - q[1]) for e in G['edges'] if e['hw'] not in ('motorway', 'trunk') for q in e['pts'][::3]
                    if abs(q[0] - px) < 400 and abs(q[1] - py) < 400), default=1e9)
        sc = (1000 if park else 0) + L - road * 0.2
        if not best or sc > best[0]: best = (sc, mx, my, nx, ny, L)
    _, mx, my, nx, ny, L = best
    return {'x': round(mx + nx * 14, 1), 'y': round(my + ny * 14, 1), 'nx': round(nx, 3), 'ny': round(ny, 3), 'wall': [round(mx, 1), round(my, 1)], 'len': round(L, 1)}
out = {'_doc': 'The ENTERABLE PLACES + world set-pieces (tools/places_build.py). World units (10/m x scale %g). places: public buildings anyone can '
       'enter with GO IN at the door (interior = data/interiors/<id>.json). NO house numbers anywhere; Scott is a position only.' % SCALE,
       'places': [], 'npcs': [], 'setpieces': []}
# ---- L12 Weis
w = next(e for e in P if e['id'] == 175330281); wx, wy = proj(w['lat'], w['lon']); wb = bldg_at(wx, wy)
assert wb is not None, 'no footprint under the Weis'
out['places'].append({'id': 'weis', 'name': 'Weis', 'kind': 'store', 'interior': 'weis', 'b': wb, 'style': 'store', 'osm': 'way/175330281',
                      'evidence': 'OSM: brand=Weis, shop=supermarket, in Whiskey Bottom Center (retail landuse way 1356081162); footprint = areas.json building %d, %d m2' % (wb, area(B[wb])),
                      'door': door(B[wb]), 'cx': cen(B[wb])[0], 'cy': cen(B[wb])[1]})
# ---- L13 Gringada (memory)
hx, hy = proj(39.19535, -76.88347)                       # the Koto Sake end-pad, Hickory Ridge Village Center
gb = bldg_at(hx, hy); assert gb is not None
out['places'].append({'id': 'gringada', 'name': 'Gringada', 'kind': 'restaurant', 'interior': 'gringada', 'b': gb, 'style': 'memory', 'memory': True, 'year': 1998,
                      'evidence': 'MEMORY BUILD (owner memory, no imagery, not in map data). Placed on the restaurant end-pad of Hickory Ridge Village Center, Columbia MD (real center; the unit choice is invented); footprint = areas.json building %d, %d m2' % (gb, area(B[gb])),
                      'door': door(B[gb]), 'cx': cen(B[gb])[0], 'cy': cen(B[gb])[1]})
# ---- Scott: a random Whiskey Bottom Rd house (position only)
wbr = [e for e in G['edges'] if e['name'] == 'Whiskey Bottom Road' and e['hw'] == 'residential']
heroes = {h['b'] for h in A['heroes']} | {wb, gb}
cands = []
for i, f in enumerate(B):
    if i in heroes or not 90 <= area(f) <= 260: continue
    cx, cy = cen(f)
    if math.hypot(cx - wx, cy - wy) > 4500: continue
    d = min((math.hypot(q[0] - cx, q[1] - cy) for e in wbr for q in e['pts']), default=1e9)
    if 70 < d < 170: cands.append((i, cx, cy, d))
cands.sort()                                             # stable order, then the owner-neutral seeded pick
si, sx, sy, sd = random.Random('scott-whiskey-bottom').choice(cands)
out['npcs'].append({'id': 'scott', 'name': 'Scott', 'role': 'manager at the Weis; the one tied to Brian (Rigg) getting fired',
                    'house': [round(sx, 1), round(sy, 1)], 'b': si, 'street': 'Whiskey Bottom Road',
                    'car': {'model': 'Honda Civic (for now — owner)', 'sprite': 'tracer_zack', 'note': 'NO Civic sprite in the fleet; reuses tracer_zack (closest compact sedan). tools/bake_fleet.py needs Blender (bpy) to bake a real Civic.'},
                    'note': 'a RANDOM house in Whiskey Bottom (seeded pick, %d candidates). Position only; no house number is stored.' % len(cands)})
# ---- the Astro on "Route 108"
gu = [e for e in G['edges'] if e['name'] == 'Guilford Road']
north = min(((q[1], e, k) for e in gu for k, q in enumerate(e['pts'])), key=lambda t: t[0])
_, e, k = north; k = min(max(1, k), len(e['pts']) - 2)
ax, ay = e['pts'][k]; bx, by = e['pts'][k + 1] if k + 1 < len(e['pts']) else e['pts'][k]
hd = math.atan2(by - ay, bx - ax); off = e['w'] / 2 + 24
out['setpieces'].append({'id': 'astro108', 'kind': 'parked-astro', 'name': 'The 108 Astro', 'sprite': 'astro_billy',
                         'x': round(ax - math.sin(hd) * off, 1), 'y': round(ay + math.cos(hd) * off, 1), 'h': round(hd, 4), 'road': 'Guilford Road (stand-in for MD 108)',
                         'note': 'MD 108 lies north of this map box (N edge 39.202); parked at the north end of Guilford Rd. STAND-IN placement.'})
json.dump(out, open(D('places.json'), 'w'), indent=1)
print('places:', [(p['id'], p['b'], p['door']['x'], p['door']['y']) for p in out['places']], '| scott house', out['npcs'][0]['house'], 'of', len(cands), '| astro', out['setpieces'][0]['x'], out['setpieces'][0]['y'])

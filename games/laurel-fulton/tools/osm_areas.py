#!/usr/bin/env python3
# osm_areas.py — task L10: the real BUILDING FOOTPRINTS + area landuse from the same OSM tiles as
# tools/osm_fetch.py, projected to world units (10/m, the graph's projection) -> data/areas.json:
#   buildings: [[x0,y0,x1,y1,...], ...]   every building=* outline, true shape and place (ints, units)
#   parking:   lot outlines (amenity=parking)        green: park / wood / grass / pitch / golf outlines
#   heroes:    the footprint under each crew house (roster.json) and each named POI — task L8's hero tier
#              (drawn bigger + crisper; everything else is the faded background tier)
#   python3 tools/osm_areas.py [--tiles DIR]          (from games/laurel-fulton/)
import os, sys, json, math, xml.etree.ElementTree as ET
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
a = sys.argv[1:]; TILES = a[a.index('--tiles') + 1] if '--tiles' in a else '/tmp/lf_osm_tiles'
LAT0, LON0 = (39.105 + 39.202) / 2, (-76.942 + -76.846) / 2
KX, KY, U = math.cos(math.radians(LAT0)) * 111320.0, 110540.0, 10.0
proj = lambda lat, lon: (round((lon - LON0) * KX * U), round(-(lat - LAT0) * KY * U))
nodes, ways = {}, {}
for f in sorted(os.listdir(TILES)):
    if not f.endswith('.osm'): continue
    root = ET.parse(os.path.join(TILES, f)).getroot()
    for nd in root.iter('node'): nodes[nd.get('id')] = (float(nd.get('lat')), float(nd.get('lon')))
    for w in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        if 'building' in tags or tags.get('amenity') == 'parking' or tags.get('leisure') in ('park', 'pitch', 'golf_course', 'playground') or tags.get('landuse') in ('grass', 'forest', 'meadow', 'recreation_ground') or tags.get('natural') == 'wood':
            ways[w.get('id')] = (tags, [x.get('ref') for x in w.iter('nd')])
out = {'buildings': [], 'parking': [], 'green': [], 'heroes': []}
bid = {}
for wid, (tags, refs) in ways.items():
    if len(refs) < 4 or refs[0] != refs[-1] or not all(r in nodes for r in refs): continue
    flat = [v for r in refs[:-1] for v in proj(*nodes[r])]
    if 'building' in tags: bid[wid] = len(out['buildings']); out['buildings'].append(flat)
    elif tags.get('amenity') == 'parking': out['parking'].append(flat)
    else: out['green'].append(flat)
def inside(px, py, f):
    n, c = len(f) // 2, False
    for i in range(n):
        x1, y1, x2, y2 = f[2 * i], f[2 * i + 1], f[2 * ((i + 1) % n)], f[2 * ((i + 1) % n) + 1]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: c = not c
    return c
def footprint_at(x, y, maxd=300):
    best, bi = 1e18, None
    for i, f in enumerate(out['buildings']):
        cx, cy = sum(f[0::2]) / (len(f) // 2), sum(f[1::2]) / (len(f) // 2)
        if abs(cx - x) > 2000 or abs(cy - y) > 2000: continue
        if inside(x, y, f): return i
        d = math.hypot(cx - x, cy - y)
        if d < best: best, bi = d, i
    return bi if best < maxd else None
R = json.load(open(os.path.join(ROOT, 'data', 'roster.json')))
G = json.load(open(os.path.join(ROOT, 'data', 'graph.json')))
seen = set()
for p in R['people']:
    if not p.get('active') or p.get('at'): continue
    i = footprint_at(*p['house'])
    if i is not None and i not in seen: seen.add(i); out['heroes'].append({'b': i, 'who': p['name'] if p['id'] not in ('clayton', 'zack') else 'The Floyds', 'kind': 'home'})
P = json.load(open(os.path.join(ROOT, 'data', 'osm_places.json')))['elements']
for name in ['Ledo Pizza', 'Atholton High School', 'Reservoir High School']:
    q = next((q for q in P if q['tags'].get('name') == name), None)
    if not q: continue
    i = footprint_at(*proj(q['lat'], q['lon']), maxd=1500)
    if i is not None and i not in seen: seen.add(i); out['heroes'].append({'b': i, 'who': name, 'kind': 'poi'})
json.dump(out, open(os.path.join(ROOT, 'data', 'areas.json'), 'w'), separators=(',', ':'))
print(f"{len(out['buildings'])} building footprints, {len(out['parking'])} parking lots, {len(out['green'])} green areas, heroes: {[h['who'] for h in out['heroes']]}")

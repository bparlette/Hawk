#!/usr/bin/env python3
# osm_graph.py — the OSM road ways -> a DRIVABLE GRAPH, and a report on what the data gives us (task L1).
#   python3 tools/osm_graph.py [--bbox S W N E] [--out data/graph.json] [--route A B]      (from games/laurel-fulton/)
#
# Projection: local equirectangular about the stage-1 bbox centre, 10 world units per metre (Palm City's
# scale: its cars are ~4.5 m = 45 units), x east, y south (the game's axes). No simplification: every OSM
# node of a drivable way is kept.
# Graph: vertices = OSM nodes shared by >= 2 drivable ways, or way ends; edges = the way pieces between
# them, carrying the full polyline, class, name, ref, oneway (+ direction), lanes, width estimate,
# bridge/tunnel/layer. Drivable = motorway/trunk/primary/secondary/tertiary/unclassified/residential/
# living_street (+ _link) and service (parking aisles + driveways kept, flagged).
# Report (stdout + data/graph_report.json): counts and km per class, connected components, dead ends
# (cul-de-sacs), one-ways, very short edges, crossings WITHOUT a shared node (grade separation: bridges,
# ramps over roads; the interchange problem for a 2D game), anchor snapping and a shortest path between anchors.
import json, math, os, sys, heapq
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import world_cfg
from collections import Counter, defaultdict
ROOT = world_cfg.root()
a = sys.argv[1:]
def opt(k, n=1, d=None):
    if k not in a: return d
    i = a.index(k); return a[i + 1:i + 1 + n] if n > 1 else a[i + 1]
BB = [float(v) for v in opt('--bbox', 4, world_cfg.bbox())]
OUT = opt('--out', d=os.path.join(ROOT, 'data', 'graph.json'))
S0, W0, N0, E0 = world_cfg.bbox()
LAT0, LON0 = (S0 + N0) / 2, (W0 + E0) / 2
KX, KY = math.cos(math.radians(LAT0)) * 111320.0, 110540.0
U = 10.0                                               # world units per metre
def proj(lat, lon): return ((lon - LON0) * KX * U, -(lat - LAT0) * KY * U)
DRIVE = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
         'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'service'}
LANE_W = 3.4                                           # metres
DEF_LANES = {'motorway': 4, 'trunk': 4, 'primary': 4, 'secondary': 2, 'tertiary': 2, 'unclassified': 2, 'residential': 2,
             'living_street': 1, 'service': 1}
R = json.load(open(os.path.join(ROOT, 'data', 'osm_roads.json')))['elements']
inb = lambda lat, lon: BB[0] <= lat <= BB[2] and BB[1] <= lon <= BB[3]
ways = []
for w in R:
    t = w['tags']; hw = t.get('highway')
    if hw not in DRIVE or t.get('access') in ('private', 'no') and hw != 'service': continue
    if t.get('area') == 'yes': continue
    keep = [(n, g) for n, g in zip(w['nodes'], w['geometry']) if inb(g['lat'], g['lon'])]
    if len(keep) < 2: continue
    ways.append((w['id'], t, keep))
use = Counter(n for _, _, kp in ways for n, _ in kp)
ends = set()
for _, _, kp in ways: ends.add(kp[0][0]); ends.add(kp[-1][0])
V = {}                                                  # osm node id -> vertex index
verts = []
def vert(n, g):
    if n not in V: V[n] = len(verts); x, y = proj(g['lat'], g['lon']); verts.append({'id': n, 'x': round(x, 1), 'y': round(y, 1)})
    return V[n]
edges = []
for wid, t, kp in ways:
    hw = t['highway']; base = hw.replace('_link', '')
    ow = t.get('oneway', 'no'); oneway = 1 if ow in ('yes', 'true', '1') or (hw in ('motorway', 'motorway_link') and ow != 'no') or t.get('junction') == 'roundabout' else (-1 if ow == '-1' else 0)
    lanes = int(t['lanes']) if str(t.get('lanes', '')).isdigit() else DEF_LANES.get(base, 2) // (2 if oneway and base in ('motorway', 'trunk', 'primary') else 1)
    width = round(max(1, lanes) * LANE_W * U)
    if base == 'service' and not str(t.get('lanes', '')).isdigit(): width = round(5.0 * U)   # an untagged service way is a ~5 m alley / lot aisle, not a 3.4 m single lane
    cur = [kp[0]]
    for n, g in kp[1:]:
        cur.append((n, g))
        if use[n] > 1 or n in ends or n == kp[-1][0]:
            pts = [proj(gg['lat'], gg['lon']) for _, gg in cur]
            L = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
            edges.append({'a': vert(*cur[0]), 'b': vert(n, g), 'way': wid, 'hw': hw, 'name': t.get('name', ''), 'ref': t.get('ref', ''),
                          'oneway': oneway, 'lanes': lanes, 'w': width, 'len': round(L, 1), 'service': t.get('service', '') if hw == 'service' else '',
                          'bridge': t.get('bridge', '') not in ('', 'no'), 'tunnel': t.get('tunnel', '') not in ('', 'no'), 'layer': int(t.get('layer', '0')) if str(t.get('layer', '0')).lstrip('-').isdigit() else 0,
                          'pts': [[round(x, 1), round(y, 1)] for x, y in pts]})
            cur = [(n, g)]
# ---------------------------------------------------------------- report
adj = defaultdict(list)
for i, e in enumerate(edges):
    if e['oneway'] >= 0: adj[e['a']].append((e['b'], e['len'], i))
    if e['oneway'] <= 0: adj[e['b']].append((e['a'], e['len'], i))
und = defaultdict(set)
for e in edges: und[e['a']].add(e['b']); und[e['b']].add(e['a'])
comp, seen = [], set()
for v in range(len(verts)):
    if v in seen or v not in und: continue
    st, c = [v], 0; seen.add(v)
    while st:
        u = st.pop(); c += 1
        for x in und[u]:
            if x not in seen: seen.add(x); st.append(x)
    comp.append(c)
comp.sort(reverse=True)
deg = Counter()
for e in edges: deg[e['a']] += 1; deg[e['b']] += 1
km = defaultdict(float)
for e in edges: km[e['hw']] += e['len'] / U / 1000
dead_res = sum(1 for e in edges for v in (e['a'], e['b']) if deg[v] == 1 and e['hw'] in ('residential', 'living_street', 'unclassified'))
short = [e for e in edges if e['len'] < 30 and e['hw'] != 'service']           # < 3 m
# crossings without a shared node: segment intersections between different ways (non-service), via a grid hash
G = 400; grid = defaultdict(list); segs = []
for ei, e in enumerate(edges):
    if e['hw'] == 'service': continue
    p = e['pts']
    for k in range(len(p) - 1):
        si = len(segs); segs.append((ei, p[k], p[k + 1]))
        for gx in range(int(min(p[k][0], p[k + 1][0]) // G), int(max(p[k][0], p[k + 1][0]) // G) + 1):
            for gy in range(int(min(p[k][1], p[k + 1][1]) // G), int(max(p[k][1], p[k + 1][1]) // G) + 1): grid[(gx, gy)].append(si)
def inter(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])) if 0.001 < t < 0.999 and 0.001 < u < 0.999 else None
cross, done = [], set()
for cell in grid.values():
    for i in range(len(cell)):
        for j in range(i + 1, len(cell)):
            s1, s2 = segs[cell[i]], segs[cell[j]]
            if s1[0] == s2[0] or edges[s1[0]]['way'] == edges[s2[0]]['way']: continue
            key = (min(cell[i], cell[j]), max(cell[i], cell[j]))
            if key in done: continue
            done.add(key)
            q = inter(s1[1], s1[2], s2[1], s2[2])
            if q: cross.append((q, edges[s1[0]], edges[s2[0]]))
graded = [c for c in cross if c[1]['bridge'] or c[2]['bridge'] or c[1]['tunnel'] or c[2]['tunnel'] or c[1]['layer'] != c[2]['layer']]
untagged = [c for c in cross if c not in graded]
# anchors
P = json.load(open(os.path.join(ROOT, 'data', 'osm_places.json')))['elements']
def place(f):
    for p in P:
        if f(p['tags']): return p
CITYF = os.path.join(ROOT, 'data', 'city.json'); CITY = json.load(open(CITYF)) if os.path.exists(CITYF) else None
ANCH = {q['id']: (lambda n: (lambda t: t.get('name') == n))(q['name']) for q in CITY['pois']} if CITY else {'ledo': lambda t: t.get('name') == 'Ledo Pizza', 'atholton_hs': lambda t: t.get('name') == 'Atholton High School' and t.get('amenity') == 'school',
        'reservoir_hs': lambda t: t.get('name') == 'Reservoir High School', }
if CITY and opt('--route') is None: sys.argv += ['--route', CITY['pois'][0]['id'], CITY['people'][0]['id']]
# the crew's houses come from data/roster.json (exact positions, no house numbers in the repo)
RO = json.load(open(os.path.join(ROOT, 'data', 'roster.json')))['people'] if os.path.exists(os.path.join(ROOT, 'data', 'roster.json')) else []
anch = {}
houses = {q['id']: {'tags': {}, 'lat': q['lat'], 'lon': q['lon']} for q in RO if q.get('active') and (q['id'] == 'brad' or CITY)}
for k, f in list(ANCH.items()) + [(h, None) for h in houses]:
    p = houses[k] if f is None else place(f)
    if not p: continue
    x, y = proj(p['lat'], p['lon'])
    if not (BB[0] <= p['lat'] <= BB[2] and BB[1] <= p['lon'] <= BB[3]): continue
    bv = min((v for v in und), key=lambda v: (verts[v]['x'] - x) ** 2 + (verts[v]['y'] - y) ** 2) if und else None
    anch[k] = {'x': round(x), 'y': round(y), 'v': bv, 'snap_m': round(math.hypot(verts[bv]['x'] - x, verts[bv]['y'] - y) / U, 1)}
def route(s, t):
    dist, prev, pq = {s: 0}, {}, [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t: break
        if d > dist[u]: continue
        for v, w, ei in adj[u]:
            if d + w < dist.get(v, 1e18): dist[v] = d + w; prev[v] = (u, ei); heapq.heappush(pq, (d + w, v))
    if t not in dist: return None
    path, u = [], t
    while u != s: u, ei = prev[u]; path.append(ei)
    return dist[t], path[::-1]
rep = {'bbox': BB, 'units_per_m': U, 'ways_drivable': len(ways), 'vertices': len(und), 'edges': len(edges),
       'km_by_class': {k: round(v, 1) for k, v in sorted(km.items(), key=lambda kv: -kv[1])}, 'km_total': round(sum(km.values()), 1),
       'extent_m': [round((proj(BB[0], BB[3])[0] - proj(BB[0], BB[1])[0]) / U), round((proj(BB[0], BB[1])[1] - proj(BB[2], BB[1])[1]) / U)],
       'components': comp[:6], 'largest_component_share': round(comp[0] / max(1, sum(comp)), 3) if comp else 0,
       'dead_ends_residential': dead_res, 'oneway_edges': sum(1 for e in edges if e['oneway']), 'short_edges_lt3m': len(short),
       'crossings_without_shared_node': len(cross), 'crossings_grade_separated_tagged': len(graded), 'crossings_untagged': len(untagged),
       'untagged_examples': [{'at': [round(c[0][0]), round(c[0][1])], 'a': c[1]['name'] or c[1]['hw'], 'b': c[2]['name'] or c[2]['hw']} for c in untagged[:8]],
       'graded_examples': [{'at': [round(c[0][0]), round(c[0][1])], 'a': (c[1]['name'] or c[1]['hw']) + (' (bridge)' if c[1]['bridge'] else ''), 'b': (c[2]['name'] or c[2]['hw']) + (' (bridge)' if c[2]['bridge'] else '')} for c in graded[:8]],
       'anchors': anch}
pair = opt('--route', 2, ['ledo', 'brad'])
if pair[0] in anch and pair[1] in anch:
    r = route(anch[pair[0]]['v'], anch[pair[1]]['v'])
    if r:
        seq = []
        for ei in r[1]:
            n = edges[ei]['name'] or edges[ei]['hw']
            if not seq or seq[-1][0] != n: seq.append([n, 0])
            seq[-1][1] += edges[ei]['len'] / U
        rep['route'] = {'from': pair[0], 'to': pair[1], 'km': round(r[0] / U / 1000, 2), 'roads': [[n, round(m)] for n, m in seq if m > 15], 'edges': r[1]}
json.dump({'units_per_m': U, 'origin_latlon': [LAT0, LON0], 'verts': verts, 'edges': edges, 'anchors': anch}, open(OUT, 'w'), separators=(',', ':'))
json.dump(rep, open(os.path.splitext(OUT)[0] + '_report.json', 'w'), indent=1)
show = {k: v for k, v in rep.items() if k != 'route'}; show['route'] = {k: v for k, v in rep.get('route', {}).items() if k != 'edges'}
print(json.dumps(show, indent=1))

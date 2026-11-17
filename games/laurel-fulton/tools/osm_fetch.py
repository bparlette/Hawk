#!/usr/bin/env python3
# osm_fetch.py — pull the Laurel/Fulton OpenStreetMap data and write data/osm_roads.json (+ data/osm_places.json).
#   python3 tools/osm_fetch.py [--tiles DIR] [--k 4]                (from games/laurel-fulton/)
# Source: the OSM main API (api.openstreetmap.org/api/0.6/map), fetched as a k x k grid of tiles over the
# stage-1 bbox (S 39.105 / W -76.942 / N 39.202 / E -76.846) because one call is capped at 50,000 nodes.
# (Overpass, which Moth's stage-1 pull used, is not reachable from the cloud box: the egress resets it.)
# Tiles are cached in --tiles (default /tmp/lf_osm_tiles); a cached tile is not fetched again. 2 s between
# calls (OSM API usage policy: light, identified, no bulk scraping).
# Output: every highway=* way, deduplicated across tiles, with its tags and FULL node geometry (no
# simplification) — the same content as stage 1's osm_roads.json — plus named places / addresses that the
# opening needs (amenities, schools, addr:* on the anchor streets).
import os, sys, json, time, subprocess, xml.etree.ElementTree as ET
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import world_cfg
S, W, N, E = world_cfg.bbox()
args = sys.argv[1:]
TILES = args[args.index('--tiles') + 1] if '--tiles' in args else '/tmp/lf_osm_tiles'
K = int(args[args.index('--k') + 1]) if '--k' in args else 4
ROOT = world_cfg.root()
os.makedirs(TILES, exist_ok=True)
files = []
for i in range(K):
    for j in range(K):
        s, n = S + (N - S) * i / K, S + (N - S) * (i + 1) / K
        w, e = W + (E - W) * j / K, W + (E - W) * (j + 1) / K
        f = os.path.join(TILES, f't{i}{j}.osm'); files.append(f)
        if os.path.exists(f) and os.path.getsize(f) > 1000: continue
        url = f'https://api.openstreetmap.org/api/0.6/map?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}'
        r = subprocess.run(['curl', '-sS', '-m', '150', '-A', 'palm-city-map-tool/1.0', url, '-o', f, '-w', '%{http_code}'], capture_output=True, text=True)
        print(f'tile {i}{j}: HTTP {r.stdout}', flush=True)
        if r.stdout != '200': sys.exit('fetch failed: ' + url)
        time.sleep(2)
nodes, ways, places = {}, {}, []
for f in files:
    root = ET.parse(f).getroot()
    for nd in root.iter('node'):
        nodes[nd.get('id')] = (float(nd.get('lat')), float(nd.get('lon')))
        tags = {t.get('k'): t.get('v') for t in nd.iter('tag')}
        if tags.get('name') or tags.get('addr:housenumber'):
            places.append({'type': 'node', 'id': int(nd.get('id')), 'lat': float(nd.get('lat')), 'lon': float(nd.get('lon')), 'tags': tags})
    for w in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        refs = [x.get('ref') for x in w.iter('nd')]
        if 'highway' in tags: ways[w.get('id')] = (tags, refs)
        elif tags.get('name') or tags.get('addr:housenumber') or tags.get('amenity'):
            places.append({'type': 'way', 'id': int(w.get('id')), 'tags': tags, 'refs': refs})
out = []
for wid, (tags, refs) in ways.items():
    geom = [{'lat': nodes[r][0], 'lon': nodes[r][1]} for r in refs if r in nodes]
    if len(geom) == len(refs): out.append({'type': 'way', 'id': int(wid), 'tags': tags, 'nodes': [int(r) for r in refs], 'geometry': geom})
for p in places:                                           # building ways: a centroid is enough for an address
    if p['type'] == 'way':
        pts = [nodes[r] for r in p.pop('refs') if r in nodes]
        if pts: p['lat'] = sum(a for a, b in pts) / len(pts); p['lon'] = sum(b for a, b in pts) / len(pts)
places = [p for p in {(p['type'], p['id']): p for p in places}.values() if 'lat' in p]
json.dump({'bbox': [S, W, N, E], 'source': 'api.openstreetmap.org/api/0.6/map, %dx%d tiles' % (K, K), 'elements': out},
          open(os.path.join(ROOT, 'data', 'osm_roads.json'), 'w'), separators=(',', ':'))
json.dump({'bbox': [S, W, N, E], 'elements': places}, open(os.path.join(ROOT, 'data', 'osm_places.json'), 'w'), separators=(',', ':'))
print(f'{len(out)} highway ways ({len(ways) - len(out)} dropped: geometry outside the tiles), {len(places)} named places/addresses')

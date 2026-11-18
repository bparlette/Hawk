#!/usr/bin/env python3
"""graph_pack.py — load-time pass (Nov 18): data/graph.json -> data/graph.min.json, what the GAME downloads at boot.
Drops fields the game never reads (OSM way ids, vertex OSM ids, tunnel, origin) and rounds geometry to whole units
(10 cm). Tools and specs keep reading the full graph.json. Re-run after osm_graph.py (the factory does).
  python3 tools/graph_pack.py          (LF_ROOT=<city> for a factory city)"""
import os, sys, json, gzip
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import world_cfg
D = os.path.join(world_cfg.root(), 'data'); G = json.load(open(os.path.join(D, 'graph.json')))
r = lambda v: int(round(v))
G['verts'] = [{'x': r(v['x']), 'y': r(v['y'])} for v in G['verts']]
for e in G['edges']:
    for k in ('way', 'tunnel'): e.pop(k, None)
    e['pts'] = [[r(x), r(y)] for x, y in e['pts']]; e['len'] = round(e['len'], 1)
G.pop('origin_latlon', None)
s = json.dumps(G, separators=(',', ':')); open(os.path.join(D, 'graph.min.json'), 'w').write(s)
full = os.path.getsize(os.path.join(D, 'graph.json'))
print(f"graph.min.json {len(s) // 1024} KB ({len(gzip.compress(s.encode())) // 1024} KB gzipped) vs graph.json {full // 1024} KB ({len(gzip.compress(open(os.path.join(D, 'graph.json'), 'rb').read())) // 1024} KB gzipped)")

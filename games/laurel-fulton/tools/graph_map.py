#!/usr/bin/env python3
# graph_map.py — draw the drivable graph (evidence for task L1): roads by class and width, bridges outlined,
# dead ends dotted, a route highlighted, anchors labelled.
#   python3 tools/graph_map.py out.png [--window x0 y0 x1 y1] [--px 1600]     (from games/laurel-fulton/)
import json, os, sys
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
a = sys.argv[1:]; out = a[0]
g = json.load(open(os.path.join(ROOT, 'data', 'graph.json'))); rep = json.load(open(os.path.join(ROOT, 'data', 'graph_report.json')))
xs = [v['x'] for v in g['verts']]; ys = [v['y'] for v in g['verts']]
W = [float(v) for v in a[a.index('--window') + 1:a.index('--window') + 5]] if '--window' in a else [min(xs), min(ys), max(xs), max(ys)]
PX = int(a[a.index('--px') + 1]) if '--px' in a else 1600
k = PX / (W[2] - W[0]); H = int((W[3] - W[1]) * k)
im = Image.new('RGB', (PX, H), (28, 24, 40)); d = ImageDraw.Draw(im)
COL = {'motorway': (255, 150, 90), 'trunk': (255, 180, 100), 'primary': (255, 210, 120), 'secondary': (240, 225, 150), 'tertiary': (225, 225, 200), 'residential': (190, 190, 200), 'unclassified': (190, 190, 200), 'living_street': (190, 190, 200), 'service': (110, 105, 125)}
P = lambda p: ((p[0] - W[0]) * k, (p[1] - W[1]) * k)
route = set(rep.get('route', {}).get('edges', []))
order = sorted(range(len(g['edges'])), key=lambda i: (g['edges'][i]['layer'] + (1 if g['edges'][i]['bridge'] else 0), g['edges'][i]['hw'] != 'service'))
for i in order:
    e = g['edges'][i]; c = COL.get(e['hw'].replace('_link', ''), (150, 150, 150)); w = max(1, int(e['w'] * k))
    pts = [P(p) for p in e['pts']]
    if e['bridge']: d.line(pts, fill=(20, 16, 30), width=w + 4)
    d.line(pts, fill=c, width=w)
for i in route:
    d.line([P(p) for p in g['edges'][i]['pts']], fill=(80, 220, 255), width=max(3, int(g['edges'][i]['w'] * k * 0.6)))
deg = {}
for e in g['edges']: deg[e['a']] = deg.get(e['a'], 0) + 1; deg[e['b']] = deg.get(e['b'], 0) + 1
for v, n in deg.items():
    if n == 1: x, y = P((g['verts'][v]['x'], g['verts'][v]['y'])); d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 90, 120))
for name, an in g['anchors'].items():
    x, y = P((an['x'], an['y'])); d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 255, 255), width=2); d.text((x + 8, y - 6), name, fill=(255, 255, 255))
d.text((8, 8), f"window {W[0]:.0f},{W[1]:.0f}..{W[2]:.0f},{W[3]:.0f} units (10/m) | cyan: route {rep.get('route', {}).get('km')} km | red dots: dead ends | dark rim: bridge", fill=(255, 240, 200))
im.save(out); print('wrote', out, im.size)

#!/usr/bin/env python3
# area_report.py — before building a new part of the map: what is in a rectangle of the shell?
#   python3 tools/geo/area_report.py x0 y0 x1 y1        (world units; from games/pc-ext-fable/)
# Prints the land / water / park / plaza / parking share from shell.json, the roads that cross it, the
# buildings, lamps, palms and parked cars already there, which baked sprite sets would fit (and how
# many times, on a 40-unit lattice, wholly on land, clear of roads), and an ASCII map (one char per
# 20 units: ~ water, . land, " park, : plaza, = parking, # road, B building, * palm, ! lamp).
import json, sys, os, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
S = json.load(open(os.path.join(ROOT, 'shell.json'))); L = json.load(open(os.path.join(ROOT, 'shell_layout.json')))
x0, y0, x1, y1 = map(float, sys.argv[1:5])
ox, oy, cs = S['origin'][0], S['origin'][1], S['cellSize']
def cls(x, y):
    c, r = int((x - ox) // cs), int((y - oy) // cs)
    if c < 0 or r < 0 or c >= S['cols'] or r >= S['rows']: return 0
    return ord(S['grid'][r][c]) - 48
roads = S['roads'] + L.get('roads', [])
def road_d(x, y):
    best, name, hw = 1e9, None, 0
    for r in roads:
        p = r['points']
        for (ax, ay), (bx, by) in zip(p, p[1:]):
            vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); d = math.hypot(ax + vx * t - x, ay + vy * t - y)
            if d - r['width'] / 2 - r.get('walk', 6) < best - hw: best, name, hw = d, r['name'], r['width'] / 2 + r.get('walk', 6)
    return best, name, hw
n = [0] * 5; tot = 0; crossing = set()
for yy in range(int(y0), int(y1), 10):
    for xx in range(int(x0), int(x1), 10):
        n[cls(xx, yy)] += 1; tot += 1
        d, nm, hw = road_d(xx, yy)
        if d < hw: crossing.add(nm)
names = ['water', 'land', 'park', 'plaza', 'parking']
print(f'area {x0:.0f},{y0:.0f} .. {x1:.0f},{y1:.0f}  ({x1 - x0:.0f} x {y1 - y0:.0f} units)')
print('  surface: ' + ', '.join(f'{names[k]} {100 * n[k] / tot:.0f}%' for k in range(5) if n[k]))
print('  roads crossing: ' + (', '.join(sorted(crossing)) or 'none'))
inside = lambda p: x0 <= p[0] <= x1 and y0 <= p[1] <= y1
B = [b for b in L['buildings'] if b['x'] < x1 and b['x'] + b['w'] > x0 and b['y'] < y1 and b['y'] + b['d'] > y0]
print(f"  already here: {len(B)} buildings {[b.get('tpl', b.get('kind')) for b in B]}, {sum(map(inside, L.get('lamps', [])))} lamps, {sum(map(inside, L['palms']))} palms, {sum(1 for c in L.get('parked', []) if inside(c))} parked cars")
TPL = {'office': (252, 250), 'apartments': (252, 230), 'garage': (372, 150), 'house1': (190, 160), 'house2': (180, 150), 'house3': (190, 165), 'villa1': (210, 220), 'villa2': (200, 200), 'villa3': (210, 230)}
def fits(x, y, w, d):
    for yy in range(int(y), int(y + d) + 1, 10):
        for xx in range(int(x), int(x + w) + 1, 10):
            if cls(xx, yy) == 0: return False
            dd, _, hw = road_d(xx, yy)
            if dd < hw: return False
    return not any(x < b['x'] + b['w'] and x + w > b['x'] and y < b['y'] + b['d'] and y + d > b['y'] for b in L['buildings'])
for k, (w, d) in TPL.items():
    c = sum(1 for yy in range(int(y0), int(y1 - d), 40) for xx in range(int(x0), int(x1 - w), 40) if fits(xx, yy, w, d))
    print(f'  {k:11s} {w}x{d}: fits at {c} lattice spots' if c else f'  {k:11s} {w}x{d}: does not fit')
print('  map (20 u/char):')
for yy in range(int(y0), int(y1), 20):
    row = ''
    for xx in range(int(x0), int(x1), 20):
        ch = '~.":='[cls(xx, yy)]
        if road_d(xx, yy)[0] < 24: ch = '#'
        if any(b['x'] <= xx <= b['x'] + b['w'] and b['y'] <= yy <= b['y'] + b['d'] for b in B): ch = 'B'
        if any(abs(p[0] - xx) < 10 and abs(p[1] - yy) < 10 for p in L['palms']): ch = '*'
        if any(abs(p[0] - xx) < 10 and abs(p[1] - yy) < 10 for p in L.get('lamps', [])): ch = '!'
        row += ch
    print('   ' + row)

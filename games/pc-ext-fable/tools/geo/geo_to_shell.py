#!/usr/bin/env python3
# geo_to_shell.py — Fable's WORLD EXTENSION candidate (task 11 bake-off): real Miami geography ->
# Palm City layout data, in the live engine's shell format, so it runs on the unchanged pipeline.
#
#   python3 tools/geo/geo_to_shell.py [sample|phase1]      (from games/pc-ext-fable/; default phase1)
#
# IN : ../palm-city/shots/extension-refs/*.jpg (Moth's supplied sheets; README gives the bounds)
#      ../palm-city/shell.json + shell_layout.json — ONLY for the three causeway traces and the seam
#      connector, copied verbatim so OPEN ROAD's course (openroad.js) stays valid in both candidates.
# OUT: shell.json        — 10-unit land/water/park grid over x -4400..0, y 0..2200 (+ lot classes
#                          3 plaza, 4 parking) and every road (causeways + the traced street grid)
#      shell_layout.json — buildings dressed with the game's OWN baked Blender sprites ('tpl' names the
#                          sprite set: office, apartments, garage, house1-3, villa1-3) at core scale,
#                          street lamps (light, wet reflections and destruction come with them), palms.
#
# Method: proj.py maps lon/lat <-> world units (Web-Mercator, 2/3 unit per ground metre, anchored on
# the MacArthur landfall); mask.py classifies every cell from the street maps (OSM water/park colours)
# with the satellite sheet as fallback; a 5x5 majority filter removes label/icon speckle. Streets are
# real arteries (Biscayne Blvd on the bayfront, NE 6th / Port Blvd, Flagler, Brickell Ave) laid on a
# core-scale grid: the shell keeps the city's shape but the core's block size, so the baked buildings
# fit at 1:1 and the opening's density carries over (THE BAR). Everything is seeded: same output
# every run.
import json, os, sys, math, random
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mask import classify

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
LIVE = os.path.abspath(os.path.join(ROOT, '..', 'palm-city'))
PHASE = (sys.argv[1] if len(sys.argv) > 1 else 'phase1')
assert PHASE in ('sample', 'phase1'), PHASE
X0, Y0, CS, COLS, ROWS = -4400, 0, 10, 440, 220
rng = random.Random(1117)

# ---------------------------------------------------------------- the grid
grid, _src = classify(X0, Y0, X0 + COLS * CS, Y0 + ROWS * CS, CS)
def majority(g, r=2):
    out = g.copy(); H, W = g.shape
    pad = np.pad(g, r, mode='edge')
    counts = np.zeros((3, H, W), 'int16')
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            win = pad[dy:dy + H, dx:dx + W]
            for k in range(3): counts[k] += (win == k)
    return counts.argmax(0).astype('uint8')
grid = majority(majority(grid))
def cell(x, y): return int((x - X0) // CS), int((y - Y0) // CS)
def setrect(x0, y0, x1, y1, v):
    c0, r0 = cell(x0, y0); c1, r1 = cell(x1 - 0.01, y1 - 0.01)
    grid[max(0, r0):min(ROWS, r1 + 1), max(0, c0):min(COLS, c1 + 1)] = v
def landshare(x0, y0, x1, y1):
    c0, r0 = cell(x0, y0); c1, r1 = cell(x1 - 0.01, y1 - 0.01)
    if c0 < 0 or r0 < 0 or c1 >= COLS or r1 >= ROWS: return 0.0
    w = grid[r0:r1 + 1, c0:c1 + 1]
    return float((w != 0).mean())

# ---------------------------------------------------------------- roads
live_shell = json.load(open(os.path.join(LIVE, 'shell.json')))
live_lay = json.load(open(os.path.join(LIVE, 'shell_layout.json')))
roads = [dict(r) for r in live_shell['roads']]                 # macarthur, port blvd, venetian: verbatim
connector = [dict(r) for r in live_lay.get('roads', [])]        # the seam connector into the core: verbatim
URB = 24                                                        # urban sidewalk, as the core's (layout roads.sidewalk)
def road(name, pts, width=48, walk=URB):
    roads.append({'name': name, 'width': width, 'walk': walk, 'points': [[round(x), round(y)] for x, y in pts]})

# downtown: Biscayne Blvd on the bayfront joins both causeway ends; avenues every 360, streets every 350
AV = [-3180, -3540, -3900] + ([-4260] if PHASE == 'phase1' else [])
ST = [100, 460, 820]
road('biscayne_blvd', [(-3180, 40), (-3180, 1040)])
road('venetian_landfall', [(-3180, 170), (-3080, 170)], walk=8)
road('macarthur_landfall', [(-3180, 308), (-3140, 308)], walk=8)
for i, x in enumerate(AV[1:]):
    road(['n_miami_ave', 'nw_3rd_ave', 'nw_7th_ave'][i], [(x, 40), (x, 1040)])
for y, n in zip(ST, ['ne_14th_st', 'ne_8th_st', 'port_blvd_ne_6th']):
    road(n, [(min(AV), y), (-3180, y)])
road('flagler_st', [(min(AV), 1040), (-3180, 1040)])
DOWNTOWN = [(AV[i + 1], ST[j] if j < 2 else ST[2], AV[i], ST[j + 1] if j < 2 else 1040) for i in range(len(AV) - 1) for j in range(3)]
blocks = [(xa, ya, xb, yb, 'downtown') for (xa, ya, xb, yb) in DOWNTOWN]

if PHASE == 'phase1':
    # Brickell across the river: Brickell Ave bridge, a two-block grid; Watson Island loop;
    # the port island apron road; Miami Beach's west-shore Alton Rd tying the causeway ends.
    road('brickell_ave_bridge', [(-3180, 1040), (-3240, 1400), (-3300, 1820)])
    BX, BY = [-3300, -3660, -4020], [1820, 2170]
    for i, x in enumerate(BX): road(['brickell_ave', 'sw_1st_ave', 'sw_3rd_ave'][i], [(x, 1820), (x, 2170)])
    for y, n in zip(BY, ['sw_8th_st', 'sw_15th_rd']): road(n, [(BX[-1], y), (BX[0], y)])
    for i in range(2): blocks.append((BX[i + 1], BY[0], BX[i], BY[1], 'brickell'))
    road('watson_island_dr', [(-2452, 420), (-2560, 520), (-2520, 640), (-2380, 700), (-2290, 600)], width=36, walk=10)

# ---------------------------------------------------------------- land under what we build
for (xa, ya, xb, yb, kind) in blocks:                           # the mask's speckle never leaves a hole in a block
    if landshare(xa, ya, xb, yb) > 0.55: setrect(xa, ya, xb, yb, 1)

# ---------------------------------------------------------------- surfaces: land outside the city blocks
# The live shell paints every land cell as terracotta paving. Here: open land is garden (the islands,
# the causeway shoulders, Miami Beach's west shore), the port island is asphalt lots, and only the
# city blocks (downtown, Brickell) keep paving — so the shell reads like places, not one paver sheet.
def in_blocks(x, y): return any(xa - 40 <= x <= xb + 40 and ya - 40 <= y <= yb + 40 for (xa, ya, xb, yb, _k) in blocks)
def near_port(x, y):
    pts = [p for r in roads if r['name'] == 'port_boulevard' for p in r['points']]
    best, south = 1e9, False
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
        t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); d = math.hypot(ax + vx * t - x, ay + vy * t - y)
        if d < best: best, south = d, (y > ay + vy * t)
    return best < 420 and south and x > -2950                 # Dodge Island lies south of Port Blvd
for rr in range(ROWS):
    for cc in range(COLS):
        if grid[rr, cc] != 1: continue
        x, y = X0 + (cc + .5) * CS, Y0 + (rr + .5) * CS
        if x < -3040 and y < 1060 or (PHASE == 'phase1' and x < -3240 and y > 1760): continue      # the mainland city stays paved
        if in_blocks(x, y): continue
        grid[rr, cc] = 4 if near_port(x, y) else 2

# ---------------------------------------------------------------- buildings (baked sprites, 1:1)
TPL = {'office': (252, 250, 28), 'apartments': (252, 230, 18), 'garage': (372, 150, 8),
       'house1': (190, 160, 5), 'house2': (180, 150, 5), 'house3': (190, 165, 5),
       'villa1': (210, 220, 8), 'villa2': (200, 200, 7), 'villa3': (210, 230, 8)}
buildings, lots = [], []
def segs():
    for r in roads + connector:
        p = r['points']
        for i in range(len(p) - 1): yield p[i], p[i + 1], r['width'] / 2 + r.get('walk', 6)
def clear_of_roads(x0, y0, x1, y1, m=0):
    for (ax, ay), (bx, by), e in segs():
        for (px, py) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1), ((x0 + x1) / 2, (y0 + y1) / 2), ((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1), (x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)):
            vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
            t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / L2))
            if math.hypot(ax + vx * t - px, ay + vy * t - py) < e + m: return False
        # a road passing straight through the rect
        if min(ax, bx) < x1 and max(ax, bx) > x0 and min(ay, by) < y1 and max(ay, by) > y0:
            for k in range(21):
                px, py = ax + (bx - ax) * k / 20, ay + (by - ay) * k / 20
                if x0 - e < px < x1 + e and y0 - e < py < y1 + e: return False
    return True
def free(x0, y0, x1, y1, m=14):
    return all(x1 + m <= b['x'] or x0 - m >= b['x'] + b['w'] or y1 + m <= b['y'] or y0 - m >= b['y'] + b['d'] for b in buildings)
def place(tpl, x, y, kind):
    w, d, h = TPL[tpl]
    if not (free(x, y, x + w, y + d) and clear_of_roads(x, y, x + w, y + d) and landshare(x, y, x + w, y + d) > 0.97): return False
    buildings.append({'id': 'fx%03d' % len(buildings), 'tpl': tpl, 'style': kind, 'x': round(x), 'y': round(y), 'w': w, 'd': d, 'h': h})
    return True

for (xa, ya, xb, yb, kind) in blocks:
    ix0, iy0 = xa + 26 + URB, ya + 26 + URB                     # inside the kerbs: half road + sidewalk
    ix1, iy1 = xb - 26 - URB, yb - 26 - URB
    iw, ih = ix1 - ix0, iy1 - iy0
    last = buildings[-1]['tpl'] if buildings else None          # never the same sprite in two neighbouring blocks
    order = ['apartments', 'office'] if last == 'office' else ['office', 'apartments']
    for tpl in order + ['garage', 'villa2']:
        w, d, _ = TPL[tpl]
        if w > iw or d > ih: continue
        # sit the building against one kerb, leave the rest of the lot as plaza / parking / garden
        ax = rng.choice([0.0, 1.0]); ay = rng.choice([0.0, 1.0])
        x, y = ix0 + (iw - w) * ax, iy0 + (ih - d) * ay
        if place(tpl, x, y, kind):
            b = buildings[-1]
            setrect(ix0, iy0, ix1, iy1, 4 if rng.random() < 0.45 else 3)      # the lot: parking or plaza
            gx0 = ix0 if ax else b['x'] + b['w'] + 10                         # a garden strip on the open side
            setrect(gx0, iy0, gx0 + max(30, iw - w - 10), iy1, 2) if iw - w > 40 else None
            setrect(b['x'], b['y'], b['x'] + b['w'], b['y'] + b['d'], 1)
            break
    else:                                                     # nothing fits (the shallow Flagler row): a planted park
        setrect(ix0, iy0, ix1, iy1, 2)
        lots.append((ix0, iy0, ix1, iy1))

if PHASE == 'phase1':
    # fit-search: scan each region on a coarse lattice and keep every footprint that lies wholly on land,
    # clear of every road and sidewalk and of the other buildings — the port gets warehouses, the
    # islands and the Miami Beach shore get houses and villas.
    REG = [('port', ['garage'], (-2900, -600, 820, 1900), 45),
           ('res', ['house1', 'villa3', 'house2', 'villa2'], (-1000, -10, 0, 1240), 30),
           ('res', ['villa1', 'house2', 'villa2', 'house3', 'house1'], (-2000, -600, 380, 1500), 30)]   # Palm, Hibiscus, Star Islands
    # (the Venetian islands and Watson Island are ~100 units across at this scale — too small for any
    # 1:1 baked house, and shrinking sprites would break THE BAR's scale. They are dressed as island
    # gardens below: grass, palms, bushes.)
    for kind, tpls, (rx0, rx1, ry0, ry1), step in REG:
        k = 0
        for yy in range(ry0, ry1, step):
            for xx in range(rx0, rx1, step):
                tpl = tpls[k % len(tpls)]
                if place(tpl, xx, yy, kind): k += 1
# ---------------------------------------------------------------- lamps + palms along the roads
lamps, palms = [], []
def along(pts, every, off, sides=(-1, 1), stagger=0.5):
    out = []
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
        for si, side in enumerate(sides):
            s = every * (0.5 + stagger * si)
            while s < L:
                out.append((ax + ux * s - uy * off * side, ay + uy * s + ux * off * side)); s += every
    return out
def ok_spot(x, y, r):
    if not (X0 < x < 0 and Y0 < y < ROWS * CS): return False
    c, rr = cell(x, y)
    if grid[rr, c] == 0: return False
    return all(not (b['x'] - r < x < b['x'] + b['w'] + r and b['y'] - r < y < b['y'] + b['d'] + r) for b in buildings)
for r in roads:
    if r['name'] in ('venetian_landfall', 'macarthur_landfall'): continue
    hw, walk = r['width'] / 2, r.get('walk', 6)
    causeway = r['name'] in ('macarthur_causeway', 'port_boulevard', 'venetian_causeway')
    for (x, y) in along(r['points'], 420 if causeway else 360, hw + (3 if causeway else walk - 5)):
        if causeway or ok_spot(x, y, 6): lamps.append([round(x), round(y)])
    if causeway or walk >= URB or r['name'] in ('watson_island_dr',):
        for (x, y) in along(r['points'], 420 if causeway else 230, hw + (11 if causeway else walk + 8), stagger=0.5):
            if ok_spot(x, y, 8) or causeway: palms.append([round(x), round(y)])
# drop anything that landed on another road, and thin lamps/palms that crowd each other
def on_any_road(x, y, m):
    for (ax, ay), (bx, by), e in segs():
        vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
        t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2))
        hw = e - 0  # e includes the sidewalk; roads proper are narrower — test against the carriageway
        if math.hypot(ax + vx * t - x, ay + vy * t - y) < m: return True
    return False
def carriage(x, y):
    for r in roads + connector:
        p = r['points']
        for i in range(len(p) - 1):
            (ax, ay), (bx, by) = p[i], p[i + 1]; vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2))
            if math.hypot(ax + vx * t - x, ay + vy * t - y) < r['width'] / 2 + 2: return True
    return False
def thin(pts, d):
    out = []
    for p in pts:
        if carriage(*p): continue
        if all(math.hypot(p[0] - q[0], p[1] - q[1]) > d for q in out): out.append(p)
    return out
# island gardens: every small island (Venetian chain, Watson) turns to park, with palms scattered on it
for (gx0, gx1, gy0, gy1) in [(-3060, -260, 0, 330), (-2750, -2050, 260, 800)]:
    c0, r0 = cell(gx0, gy0); c1, r1 = cell(gx1, gy1)
    sub = grid[r0:r1, c0:c1]; sub[sub == 1] = 2
    for k in range(50):
        x, y = rng.uniform(gx0, gx1), rng.uniform(gy0, gy1)
        cc, rr = cell(x, y)
        if grid[rr, cc] == 2 and not carriage(x, y) and all(grid[cell(x + dx, y + dy)[1], cell(x + dx, y + dy)[0]] != 0 for dx in (-20, 20) for dy in (-20, 20)):
            palms.append([round(x), round(y)])
for (a0, b0, a1, b1) in lots:                                # park palms, loosely gridded
    for yy in range(int(b0) + 20, int(b1) - 10, 80):
        for xx in range(int(a0) + 20, int(a1) - 10, 110):
            palms.append([round(xx + rng.uniform(-14, 14)), round(yy + rng.uniform(-12, 12))])
lamps, palms = thin(lamps, 170), thin(palms, 40)
# parked cars: the kerb lane of the urban streets (gaps at random, never in a junction) + rows in the lots
CARS = ['sedan_coral', 'sedan_teal', 'sedan_cream', 'sedan_plum', 'conv_mint', 'conv_rose', 'van_sky', 'van_sun']
parked = []
def junction(x, y):
    n = 0
    for r in roads + connector:
        p = r['points']
        for i in range(len(p) - 1):
            (ax, ay), (bx, by) = p[i], p[i + 1]; vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / L2))
            if math.hypot(ax + vx * t - x, ay + vy * t - y) < r['width'] / 2 + 30: n += 1; break
    return n > 1
for r in roads:
    if r.get('walk', 6) < URB: continue
    p = r['points']
    for i in range(len(p) - 1):
        (ax, ay), (bx, by) = p[i], p[i + 1]; L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
        for side in (-1, 1):
            s0 = 70
            while s0 < L - 70:
                x, y = ax + ux * s0 - uy * (r['width'] / 2 - 11) * side, ay + uy * s0 + ux * (r['width'] / 2 - 11) * side
                if rng.random() < 0.3 and not junction(x, y) and ok_spot(x, y, 6):
                    h = math.atan2(uy, ux) + (math.pi if side < 0 else 0)
                    parked.append([round(x), round(y), round(h, 3), rng.choice(CARS)])
                s0 += 64
lot_cells = np.argwhere(grid == 4)
for k in range(0, len(lot_cells), max(97, len(lot_cells) // 30)):
    rr, cc = lot_cells[k]; x, y = X0 + cc * CS + 5, Y0 + rr * CS + 5
    if all(math.hypot(x - q[0], y - q[1]) > 50 for q in parked) and ok_spot(x, y, 30) and not carriage(x, y):
        parked.append([round(x), round(y), round(rng.choice([1, -1]) * math.pi / 2, 3), rng.choice(CARS)])
palms = [p for p in palms if all(math.hypot(p[0] - l[0], p[1] - l[1]) > 18 for l in lamps)]

# ---------------------------------------------------------------- write
grid_rows = [''.join(chr(48 + int(v)) for v in row) for row in grid]
shell = {
    'source': 'Fable candidate: tools/geo/geo_to_shell.py %s (refs: ../palm-city/shots/extension-refs)' % PHASE,
    'origin': [X0, Y0], 'cellSize': CS, 'cols': COLS, 'rows': ROWS,
    'classes': {'0': 'water', '1': 'land', '2': 'park', '3': 'plaza', '4': 'parking'},
    'grid': grid_rows, 'roads': roads,
}
lay = {'_doc': 'Fable candidate (%s): buildings use baked sprite sets (tpl), lamps + palms; written by tools/geo/geo_to_shell.py' % PHASE,
       'roads': connector, 'buildings': buildings, 'lamps': lamps, 'palms': palms, 'parked': parked}
json.dump(shell, open(os.path.join(ROOT, 'shell.json'), 'w'), separators=(',', ':'))
json.dump(lay, open(os.path.join(ROOT, 'shell_layout.json'), 'w'), indent=0)
agree = None
try:
    lg = np.array([[int(ch) for ch in row] for row in live_shell['grid']]); g2 = np.minimum(grid, 2)
    agree = float(((lg == 0) == (g2 == 0)).mean())
except Exception: pass
print(f'{PHASE}: {len(roads)} roads, {len(buildings)} buildings ' + str({k: sum(b["tpl"] == k for b in buildings) for k in TPL}) +
      f', {len(lamps)} lamps, {len(palms)} palms, {len(parked)} parked cars; water/land agreement with the live grid {agree:.3f}')

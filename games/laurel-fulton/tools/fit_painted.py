#!/usr/bin/env python3
"""fit_painted.py — measure (and fit) the alignment between assets/ground-painted.webp
and the CURRENT road graph (data/graph.json), before any tile is cut.

The painting was made in the FULL-SCALE world frame (see assets/ground-painted.md);
the game world was later compressed x0.5 (tools/compress_map.py), so the nominal
current-world -> painting-pixel affine from the doc's exact projection is

    px = 4960.0 + 0.226280 * x        py = 6400.0 + 0.226930 * y

(the y scale rides on the doc's M_PER_DEG_LAT ~= 111000 approximation, and the
bake's own sampler constants were published rounded — so we MEASURE, not trust).

Method (v2 — v1's global chamfer descent stalled in local minima on the
painting's narrow, broken road mask): per landmark window, rasterise the graph
edges at their true widths and search the translation that maximises the mean
"roadness" (pale, low-saturation = the remapped asphalt/concrete class) under
the graph's road pixels, coarse-to-fine over +/-66 px. A least-squares affine
is then fit through the windows' local corrections, and the result is checked
with the chamfer stats + overlay/crop images for eyeball verification.

    python3 tools/fit_painted.py    -> prints measurements, writes /tmp/fit_painted/
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
ROOT = '/home/hatch/workspace/laurel-verify/games/laurel-fulton'
OUT = '/tmp/fit_painted'; os.makedirs(OUT, exist_ok=True)

c153 = math.cos(math.radians(39.153)); c1535 = math.cos(math.radians(39.1535))
SCALE = 1172 / (0.096 * c153)
ax0 = 8 * (SCALE * c153) * 2 / (111320 * c1535 * 10)      # x2: world compressed x0.5 after the bake
bx0 = 8 * 34 + 8 * (SCALE * c153) * 0.048
ay0 = 8 * SCALE * 2 / (111000 * 10)
by0 = 8 * ((1600 - 0.097 * SCALE) / 2 + 0.0485 * SCALE)
print(f'nominal: ax={ax0:.6f} bx={bx0:.2f} ay={ay0:.6f} by={by0:.2f}')

print('loading painting + building roadness...')
im = Image.open(f'{ROOT}/assets/ground-painted.webp').convert('RGB')
A = np.asarray(im).astype(np.int16)
mx = A.max(axis=2); mn = A.min(axis=2)
roadness = ((mx - mn) <= 34) & (mx >= 95) & ((A[..., 0] - A[..., 2]) < 34)
del A, mx, mn
print(f'roadness: {roadness.mean() * 100:.2f}% of pixels')
np.save(f'{OUT}/roadness.npy', roadness)

G = json.load(open(f'{ROOT}/data/graph.json'))
edges = [e for e in G['edges'] if not e.get('bridge') and not e.get('tunnel') and e.get('layer', 0) == 0]

def window_shift(wx, wy, half=620):
    """Best local translation (painting px, to ADD to the nominal projection of the
    graph) near world (wx, wy), by mean roadness under true-width graph road pixels."""
    cx, cy = ax0 * wx + bx0, ay0 * wy + by0
    x0, y0 = int(cx - half), int(cy - half)
    sub = roadness[y0:y0 + 2 * half, x0:x0 + 2 * half]
    if sub.shape != (2 * half, 2 * half): return None
    # rasterise graph roads (true width) in window coords, nominal mapping
    ras = Image.new('1', (2 * half, 2 * half), 0); dr = ImageDraw.Draw(ras)
    for e in edges:
        P = [(ax0 * x + bx0 - x0, ay0 * y + by0 - y0) for x, y in e['pts']]
        if any(-80 <= X < 2 * half + 80 and -80 <= Y < 2 * half + 80 for X, Y in P):
            dr.line(P, fill=1, width=max(2, round(e['w'] * ax0)))
    m = np.asarray(ras, dtype=bool)
    ys, xs = np.nonzero(m)
    if len(xs) < 3000: return None
    keep = (xs > 90) & (xs < 2 * half - 90) & (ys > 90) & (ys < 2 * half - 90)   # keep the search range in-frame
    xs, ys = xs[keep], ys[keep]
    base = sub[ys, xs].mean()
    best = (base, 0, 0)
    for step, rng_ in ((3, 66), (1, 6)):
        cxb, cyb = best[1], best[2]
        for dx in range(cxb - rng_, cxb + rng_ + 1, step):
            for dy in range(cyb - rng_, cyb + rng_ + 1, step):
                s = sub[ys + dy, xs + dx].mean()
                if s > best[0]: best = (s, dx, dy)
    return { 'at': (wx, wy), 'n': int(len(xs)), 'base': float(base), 'score': float(best[0]), 'dx': best[1], 'dy': best[2] }

spots = [(name, a['x'], a['y']) for name, a in G['anchors'].items()]
# plus the four road-densest 5000-unit cells away from the anchors
dens = {}
for e in edges:
    if e['hw'] == 'service': continue
    for x, y in e['pts'][::4]:
        k = (int(x // 5000), int(y // 5000)); dens[k] = dens.get(k, 0) + 1
for (gx, gy), _ in sorted(dens.items(), key=lambda kv: -kv[1]):
    wx, wy = gx * 5000 + 2500, gy * 5000 + 2500
    if all(math.hypot(wx - sx, wy - sy) > 7000 for _, sx, sy in spots): spots.append((f'grid{gx},{gy}', wx, wy))
    if len(spots) >= 8: break

print('\nlandmark windows (translation of painted roads vs nominal graph, full-res px):')
wins = []
for name, wx, wy in spots:
    r = window_shift(wx, wy)
    if r: wins.append(r); print(f"  {name:14s} world ({wx:7.0f},{wy:7.0f})  n={r['n']:6d}  roadness {r['base']:.3f} -> {r['score']:.3f}  shift ({r['dx']:+d},{r['dy']:+d}) px = ({r['dx'] / ax0:+.1f},{r['dy'] / ay0:+.1f}) world units")
    else: print(f'  {name:14s} world ({wx:7.0f},{wy:7.0f})  skipped (thin window)')

# least-squares affine through the local corrections: dx(x) = dax*x + dbx, dy(y) = day*y + dby
xs = np.array([w['at'][0] for w in wins]); ys = np.array([w['at'][1] for w in wins])
dxs = np.array([w['dx'] for w in wins]); dys = np.array([w['dy'] for w in wins])
Mx = np.stack([xs, np.ones_like(xs)], 1); My = np.stack([ys, np.ones_like(ys)], 1)
dax, dbx = np.linalg.lstsq(Mx, dxs, rcond=None)[0]
day, dby = np.linalg.lstsq(My, dys, rcond=None)[0]
ax, bx, ay, by = ax0 + dax, bx0 + dbx, ay0 + day, by0 + dby
print(f'\nFIT: ax={ax:.6f} bx={bx:.2f} ay={ay:.6f} by={by:.2f}')
print('per-window residual after the affine (px):')
for w, px_, py_ in zip(wins, Mx @ [dax, dbx], My @ [day, dby]):
    print(f"  world {w['at']}: measured ({w['dx']:+d},{w['dy']:+d})  affine ({px_:+.1f},{py_:+.1f})  residual ({w['dx'] - px_:+.1f},{w['dy'] - py_:+.1f})")

# chamfer check with the fitted mapping (half-res EDT, as v1)
from scipy import ndimage
DS = 2
small = roadness[::DS, ::DS]
d_in = ndimage.distance_transform_edt(small); d_out = ndimage.distance_transform_edt(~small)
signed = (d_in - d_out).astype(np.float32) * DS
pts = []
for e in edges:
    if e['hw'] == 'service': continue
    P = e['pts']
    for k in range(len(P) - 1):
        axx, ayy = P[k]; bxx, byy = P[k + 1]
        L = math.hypot(bxx - axx, byy - ayy); n = max(1, int(L / 12))
        for s in range(n): pts.append((axx + (bxx - axx) * s / n, ayy + (byy - ayy) * s / n))
pts = np.array(pts)
for (lax, lbx, lay, lby, lab) in ((ax0, bx0, ay0, by0, 'NOMINAL'), (ax, bx, ay, by, 'FIT')):
    px = (lax * pts[:, 0] + lbx) / DS; py = (lay * pts[:, 1] + lby) / DS
    ok = (px >= 0) & (px < signed.shape[1] - 1) & (py >= 0) & (py < signed.shape[0] - 1)
    v = ndimage.map_coordinates(signed, [py[ok], px[ok]], order=1)
    miss = -v[v <= 0]
    print(f'{lab}: {(v > 0).mean() * 100:.1f}% of centreline samples inside a painted road; median miss of the rest {np.median(miss):.2f} px ({np.median(miss) / ax:.1f} world units)')

# overlay + anchor crops with the FIT mapping
Wpx, Hpx = im.size
q = im.resize((Wpx // 4, Hpx // 4), Image.BOX)
for (lax, lbx, lay, lby, fn) in ((ax0, bx0, ay0, by0, 'overlay_nominal.png'), (ax, bx, ay, by, 'overlay_fit.png')):
    ov = q.copy(); dr = ImageDraw.Draw(ov)
    for e in edges:
        dr.line([((lax * x + lbx) / 4, (lay * y + lby) / 4) for x, y in e['pts']], fill=(255, 40, 40), width=1)
    ov.save(f'{OUT}/{fn}')
for name, a in G['anchors'].items():
    px, py = ax * a['x'] + bx, ay * a['y'] + by
    box = (int(px - 450), int(py - 450), int(px + 450), int(py + 450))
    crop = im.crop(box); dc = ImageDraw.Draw(crop)
    for e in edges:
        P = [(ax * x + bx - box[0], ay * y + by - box[1]) for x, y in e['pts']]
        if any(0 <= X < 900 and 0 <= Y < 900 for X, Y in P): dc.line(P, fill=(255, 40, 40), width=2)
    crop.save(f'{OUT}/crop_{name}.png')
print('\nFIT JSON:', json.dumps({ 'ax': ax, 'bx': bx, 'ay': ay, 'by': by }))

# L4 props: chroma-keyed generated sheets -> per-prop cutouts -> scale to target world size x3 -> de-fringe -> level4_props.png + meta.json
# meta: name -> [x, y, w, h] in sheet px (sheet is 3x world px; draw with k = 1/3). Extra points in meta['_pts'].
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from comps import comps
S = 3
def cut(name, pick):
    a, lab, cs = comps(f'p4_{name}.png')
    out = []
    for c in cs:
        if not pick(c): continue
        m = lab[c['y0']:c['y1'], c['x0']:c['x1']] == c['id']
        sub = a[c['y0']:c['y1'], c['x0']:c['x1']].astype(np.float32).copy()
        sub[..., 3] = np.where(m, sub[..., 3], 0)
        out.append((c, sub))
    return out
def fill_holes(sub, col):
    m = sub[..., 3] > 100; f = ndi.binary_fill_holes(m); hole = f & ~m
    if hole.sum():
        hh = np.nonzero(hole); y0, y1 = hh[0].min(), hh[0].max() + 1
        yy = (np.arange(sub.shape[0])[:, None] - y0) / max(1, y1 - y0)
        grad = np.dstack([col[0] + 90 * (1 - yy), col[1] + 45 * (1 - yy), col[2] + 0 * yy, np.ones_like(yy) * 255]) * np.ones(sub.shape[:2] + (1,))
        sub[hole] = grad[hole]
    return sub
def defringe(sub):
    r, g, b, al = [sub[..., i] for i in range(4)]
    mx = np.maximum(r, b); green = g > mx + 20
    sub[..., 1] = np.where(green, mx + (g - mx) * 0.15, g)
    sub[..., 3] = np.where(green & (al < 230), al * 0.4, al)
    # 1px soft edge erosion
    sub[..., 3] = np.minimum(sub[..., 3], ndi.grey_erosion(sub[..., 3], size=(3, 3)) * 0.5 + sub[..., 3] * 0.5)
    return sub
def trim(sub):
    ys, xs = np.nonzero(sub[..., 3] > 8); return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def resize(sub, w=None, h=None, flip=False):
    im = Image.fromarray(sub.clip(0, 255).astype(np.uint8), 'RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if w and not h: h = im.height * w / im.width
    if h and not w: w = im.width * h / im.height
    return im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
frames = []
# cars: 2 cols x 3 rows; blue(c0r0) yellow(c1r0) silver(c1r1) green(c0r2) magenta(c1r2)
cars = cut('cars', lambda c: True)
def at(lst, col, row):
    for c, s in lst:
        if (c['x0'] > 600) == bool(col) and min(range(3), key=lambda r: abs(c['y0'] - [88, 322, 546][r])) == row: return s
for nm, cl, rw in [('car_blue', 0, 0), ('car_yellow', 1, 0), ('car_silver', 1, 1), ('car_green', 0, 2), ('car_magenta', 1, 2)]:
    frames.append((nm, resize(trim(defringe(fill_holes(at(cars, cl, rw), (40, 50, 70)))), w=50 * S)))
trucks = sorted(cut('trucks', lambda c: c['y0'] < 300), key=lambda cs: cs[0]['x0'])
for nm, (c, s) in zip(['truck_white', 'truck_red', 'truck_blue'], trucks):
    frames.append((nm, resize(trim(defringe(fill_holes(s, (40, 50, 70)))), w=78 * S)))
rig = cut('rig', lambda c: True)[0][1]
frames.append(('rig', resize(trim(defringe(fill_holes(rig, (60, 40, 20)))), w=108 * S)))
props = cut('props', lambda c: True)
def pk(x0): return next(s for c, s in props if abs(c['x0'] - x0) < 20)
frames.append(('bike', resize(trim(defringe(pk(52))), w=32 * S)))
frames.append(('drone', resize(trim(defringe(pk(617))), w=30 * S)))
frames.append(('missile', resize(trim(defringe(pk(585))), w=22 * S)))
frames.append(('bomb', resize(trim(defringe(pk(1270))), h=15 * S)))
frames.append(('cone', resize(trim(defringe(pk(1398))), h=11 * S)))
sign = trim(defringe(pk(1592)))
# split sign into board (rows where most columns are opaque) and one post-pair slice
op = (sign[..., 3] > 128).mean(1); rows = np.nonzero(op > 0.6)[0]; by1 = rows.max() + 1
board = sign[:by1]; post = sign[by1 + 20: by1 + 60]
kS = 88 * S / sign.shape[1]
frames.append(('sign', resize(board, w=88 * S)))
frames.append(('signpost', resize(post, w=88 * S, h=post.shape[0] * kS)))
road = cut('road', lambda c: True)
oil = next(s for c, s in road if c['x0'] < 500).copy()
r, g, b = oil[..., 0], oil[..., 1], oil[..., 2]; lum = .3 * r + .59 * g + .11 * b
tan = (r > g) & (g > b) & (r - b > 35) & (lum > 70)
om = (oil[..., 3] > 100) & ~tan & ~(g > np.maximum(r, b) + 10)
om = ndi.binary_opening(om, iterations=1); om = ndi.binary_fill_holes(om)
lab, n = ndi.label(om); sz = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 60])
soft = ndi.gaussian_filter(keep.astype(np.float32), 1.0)
oil[..., 3] = (soft * 255).clip(0, 255) * (oil[..., 3] > 0)
oil[..., :3] *= 0.62; oil[..., 3] = np.minimum(255, oil[..., 3] * 1.0)
frames.append(('oil', resize(trim(oil), w=40 * S, h=13 * S)))
pot = next(s for c, s in road if c['x0'] > 500)
frames.append(('pothole', resize(trim(defringe(pot)), w=27 * S, h=10 * S)))
# pack in rows
MAXW = 1024; x = y = rowh = 0; meta = {}; place = []
for nm, im in frames:
    if x + im.width > MAXW: x = 0; y += rowh + 3; rowh = 0
    place.append((nm, im, x, y)); meta[nm] = [x, y, im.width, im.height]; x += im.width + 3; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (MAXW, y + rowh), (0, 0, 0, 0))
for nm, im, px, py in place: sheet.paste(im, (px, py))
# drone eye point (red pixels) relative to frame bottom-centre, in sheet px
d = np.asarray(dict(frames)['drone']).astype(int); red = (d[..., 0] > 160) & (d[..., 1] < 80) & (d[..., 3] > 200)
ys, xs = np.nonzero(red); meta['_pts'] = {'droneEye': [round(float(xs.mean()) - d.shape[1] / 2, 1), round(float(ys.mean()) - d.shape[0], 1)] if len(xs) else [0, -6]}
sheet.save('props_rgba.png')
q = sheet.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG); q.save('level4_props.png', optimize=True)
print(sheet.size, os.path.getsize('level4_props.png')); json.dump(meta, open('meta.json', 'w')); print(json.dumps(meta))
bg = Image.new('RGBA', sheet.size, (90, 70, 80, 255)); bg.alpha_composite(Image.open('level4_props.png').convert('RGBA')); bg.convert('RGB').save('v_sheet.png')

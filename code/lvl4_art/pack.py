# L4 JETWASH: chroma-keyed sheets A/B/C -> frames -> uniform scale (calibrated on idle pose in each sheet)
# -> anchors -> de-fringe -> level4_jetwash.png + meta.json
# meta: name -> [x, y, w, h, anchorX, footY, glowX, glowY]  (frame px; footY = boot sole line; glow = jet flame centre or -1)
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
IDLE_H = 190  # stored idle body height (helmet top .. boot sole)
def load(s): return np.array(Image.open(f'jw_sheet{s}.png').convert('RGBA')).astype(np.float32)
def comps(a):
    m = a[..., 3] > 40
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    sl = ndi.find_objects(lab); out = []
    for i, s in enumerate(sl, 1):
        cnt = int((lab[s] == i).sum()); out.append([i, cnt, s[1].start, s[0].start, s[1].stop, s[0].stop])
    big = sorted([c for c in out if c[1] >= 8000], key=lambda c: c[2]); small = [c for c in out if c[1] < 8000 and c[1] >= 15]
    groups = [[c[0]] for c in big]
    for s in small:  # attach fragments (flames, bomb, smoke, muzzle flash) to the big comp with nearest x-centre
        cx = (s[2] + s[4]) / 2
        j = min(range(len(big)), key=lambda j: 0 if big[j][2] - 30 <= cx <= big[j][4] + 30 else min(abs(cx - big[j][2]), abs(cx - big[j][4])) + 1000)
        if big[j][2] - 60 <= cx <= big[j][4] + 60: groups[j].append(s[0])
    return lab, groups
def clean(sub, mm):
    al = np.where(mm, sub[..., 3], 0).astype(np.float32)
    al = np.minimum(al, ndi.grey_erosion(al, size=(3, 3)) * 0.5 + al * 0.5)
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]; mx = np.maximum(r, b)
    green = g > mx + 25
    # smoke / fringe keyed green: neutralise to grey keeping luminance
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    g2 = np.where(g > mx, mx + (g - mx) * 0.1, g)
    sm = green & (r < 200)
    r2 = np.where(sm, lum * 0.95, r); b2 = np.where(sm, lum * 0.97, b); g2 = np.where(sm, lum * 0.95, g2)
    al = np.where(green & (al < 200), al * 0.55, al)
    return np.dstack([r2, g2, b2, al]).clip(0, 255)
sheets = {s: load(s) for s in 'ABC'}
raw = {}
for s, a in sheets.items():
    lab, groups = comps(a); print(s, len(groups))
    fr = []
    for gids in groups:
        m = np.isin(lab, gids); ys, xs = np.nonzero(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        fr.append(clean(a[y0:y1, x0:x1].copy(), m[y0:y1, x0:x1]))
    raw[s] = fr
def body_mask(f):
    r, g, b, a = [f[..., i] for i in range(4)]
    flame = (r > 225) & (g > 140) & (b < 110) & (r - b > 120)
    return (a > 120) & ~flame, flame & (a > 60)
def body_bbox(f):
    m, _ = body_mask(f); rows = np.nonzero(m.sum(1) > 3)[0]; return rows.min(), rows.max() + 1
def body_h(f): y0, y1 = body_bbox(f); return y1 - y0
idleH = {s: body_h(raw[s][0]) for s in 'ABC'}; print('idle body heights', idleH)
spec = [('idle', 'A', 0), ('hover', 'A', 1), ('glide', 'A', 2), ('kwind', 'A', 3), ('kick', 'A', 4),
        ('dive', 'B', 1), ('bomb', 'B', 2), ('fire', 'B', 3), ('radio', 'B', 4),
        ('hurt', 'C', 1), ('fall', 'C', 2), ('down', 'C', 3)]
imgs = []
for name, s, i in spec:
    k = IDLE_H / idleH[s]; f = raw[s][i]
    im = Image.fromarray(f.astype(np.uint8), 'RGBA')
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    imgs.append((name, im))
Wt = sum(im.width + 4 for _, im in imgs); Ht = max(im.height for _, im in imgs)
sheet = Image.new('RGBA', (Wt, Ht), (0, 0, 0, 0)); x = 0; meta = {}
for name, im in imgs:
    y = Ht - im.height; sheet.paste(im, (x, y)); A = np.asarray(im).astype(int)
    h, w = A.shape[:2]; bm, fl = body_mask(A.astype(np.float32))
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    # boot sole: lowest row with a decent run of dark (boot) pixels
    dark = bm & (r < 70) & (g < 70) & (b < 70)
    rows = np.nonzero(dark.sum(1) > 4)[0]
    footY = int(rows.max() + 1) if len(rows) else h
    if name in ('dive', 'down', 'fall'): footY = int(np.nonzero(bm.sum(1) > 3)[0].max() + 1)
    suit = bm & (r > 110) & (g > 35) & (g < 120) & (b < 70) & (r > g * 1.5)
    top = int(np.nonzero(bm.sum(1) > 3)[0].min()); bh = footY - top
    yy = np.mgrid[0:h, 0:w][0]
    band = suit & (yy > top + bh * 0.48) & (yy < top + bh * 0.62)
    if name in ('dive', 'down', 'fall') or band.sum() < 80: band = suit
    ax = int(np.median(np.nonzero(band)[1]))
    # jet flame glow point: centroid of the flame pixels near the jetpack (upper half), else -1
    lab, n = ndi.label(ndi.binary_closing(fl, iterations=2) & (yy < top + bh * 0.8))
    gx, gy = -1, -1
    if n:
        sz = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); j = int(np.argmax(sz)) + 1
        if sz[j - 1] > 40:
            fy, fx = np.nonzero(lab == j); top3 = fy < fy.min() + 4; gx, gy = int(np.median(fx[top3])), int(fy.min())
    meta[name] = [x, y, w, h, ax, footY, gx, gy]
    x += w + 4
sheet.save('jw_rgba.png')
q = sheet.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
q.save('level4_jetwash.png', optimize=True)
print(sheet.size, os.path.getsize('level4_jetwash.png'))
json.dump(meta, open('meta.json', 'w')); print(json.dumps(meta))

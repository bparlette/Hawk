# L5 GRIMWALE: raw generated sheets -> connected-component frames -> uniform scale (idle calibrated per sheet)
# -> despill/de-fringe -> hip anchors -> packed level5_grimwale.png + meta.json
from PIL import Image, ImageDraw
import numpy as np, json, os
from scipy import ndimage as ndi

OUT_H_IDLE = 200  # stored idle height; drawn at GW_K=0.42 -> 84 world px (old tinted ramrod idle was ~83)

def load(s):
    return np.array(Image.open(f'grim_{s}.png').convert('RGBA')).astype(np.float32)

def comps(a, minpix=1500):
    m = a[..., 3] > 40
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        cnt = (lab[sl] == i).sum()
        out.append((i, cnt, sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    big = sorted([c for c in out if c[1] >= minpix], key=lambda c: c[2])
    small = [c for c in out if c[1] < minpix]
    return lab, big, small

SHEETS = {s: load('sheet' + s) for s in 'ABCD'}
SEG = {s: comps(a) for s, a in SHEETS.items()}
for s, (lab, big, small) in SEG.items():
    print(s, [(c[1], c[2:]) for c in big])

def geo_split(m, seeds, which):
    # split a mask of touching poses: geodesic grow from seed boxes [(x0,y0,x1,y1),...] inside the mask
    L = np.zeros(m.shape, np.int32)
    for i, (x0, y0, x1, y1) in enumerate(seeds, 1): L[y0:y1, x0:x1] = np.where(m[y0:y1, x0:x1], i, 0)
    for _ in range(3000):
        G = ndi.grey_dilation(L, size=(3, 3)); nw = (L == 0) & m & (G > 0)
        if not nw.any(): break
        L[nw] = G[nw]
    return L == which + 1

def frame(s, idx, ytop=None, merge=(), split=None):
    a = SHEETS[s]; lab, big, small = SEG[s]
    c = big[idx]; m = lab == c[0]
    for j in merge: m |= lab == big[j][0]
    if split is not None:
        m = geo_split(m, split[0], split[1])
        l2, n2 = ndi.label(m, structure=np.ones((3, 3)))
        if n2 > 1: sz = ndi.sum(m, l2, range(1, n2 + 1)); m = l2 == np.argmax(sz) + 1
        ys, xs = np.nonzero(m); c = (c[0], 0, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    x1, y1, x2, y2 = c[2], c[3], c[4], c[5]
    for q in small:  # chain links / gun bits that keyed apart
        if q[2] >= x1 - 6 and q[4] <= x2 + 6 and q[3] >= y1 - 6 and q[5] <= y2 + 6 and q[1] > 12: m |= lab == q[0]
    if ytop is not None:  # cut off anything above this sheet row (chain trailing out of frame)
        m[:ytop] = False
    ys, xs = np.nonzero(m); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    sub = a[y0:y1, x0:x1].copy(); mm = m[y0:y1, x0:x1]
    al = np.where(mm, sub[..., 3], 0)
    al = np.minimum(al, ndi.grey_erosion(al, size=(3, 3)) * 0.5 + al * 0.5)  # soften 1px fringe
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]; mx = np.maximum(r, b)
    spill = g > mx + 10
    g = np.where(spill, mx + (g - mx) * 0.2, g)  # kill chroma spill (chain/anchor edges went green)
    edge = (al < 200) & (sub[..., 1] > mx + 25); al = np.where(edge, al * 0.3, al)
    return np.dstack([r, g, b, al]).clip(0, 255).astype(np.uint8)

idleH = {s: frame(s, 0).shape[0] for s in 'ABCD'}
print('idleH', idleH)
spec = [('idle', 'A', 0, {}), ('walk1', 'A', 1, {}), ('walk2', 'A', 2, {}), ('hurt', 'A', 3, {}),
        ('aim', 'B', 1, {}), ('whirl', 'B', 2, {}), ('bellow', 'B', 3, {}),
        ('kick', 'C', 2, {}), ('crouch', 'C', 3, {}), ('down', 'C', 4, {}),
        ('throw', 'D', 1, {}), ('charge', 'D', 2, {}), ('sweep', 'D', 3, {})]
import sys
EXTRA = json.load(open('frame_opts.json')) if os.path.exists('frame_opts.json') else {}
imgs = []
for name, s, idx, o in spec:
    o = dict(o, **EXTRA.get(name, {}))
    f = frame(s, o.get('idx', idx), o.get('ytop'), o.get('merge', ()), o.get('split'))
    k = OUT_H_IDLE / idleH[s]
    im = Image.fromarray(f, 'RGBA'); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    imgs.append((name, im))

# aimE: the aim frame with the loaded harpoon (shaft + barbed head past the brass muzzle) erased, for after it is fired
_aim = np.array(dict(imgs)['aim']).copy(); _aim[18:40, 96:, 3] = 0
imgs.insert([n for n, _ in imgs].index('aim') + 1, ('aimE', Image.fromarray(_aim, 'RGBA')))

def anchor_x(name, im):  # hip centre: median x of coat/trouser pixels in the hip band (no brass gun, skin, chain)
    A = np.asarray(im).astype(int); h, w = A.shape[:2]
    if name == 'down': return int(w * 0.5)
    if name == 'aimE': return AIM_AX[0]
    r, g, b, al = [A[..., i] for i in range(4)]
    yy = np.mgrid[0:h, 0:w][0]
    lo, hi = (0.50, 0.66) if name == 'crouch' else (0.42, 0.58)
    band = (yy > h * lo) & (yy < h * hi)
    lum = (r + g + b) / 3
    cloth = (al > 150) & band & (lum < 90) & ~((r > b + 40) & (r > 90))  # dark navy coat / dark olive trousers
    ys, xs = np.nonzero(cloth)
    return int(np.median(xs)) if len(xs) > 40 else w // 2

AIM_AX = [0]
Wt = sum(im.width + 4 for _, im in imgs); Ht = max(im.height for _, im in imgs)
sheet = Image.new('RGBA', (Wt, Ht), (0, 0, 0, 0)); x = 0; meta = {}
for name, im in imgs:
    y = Ht - im.height; sheet.paste(im, (x, y)); meta[name] = [x, y, im.width, im.height, anchor_x(name, im)]
    if name == 'aim': AIM_AX[0] = meta[name][4]
    x += im.width + 4

# props (anchor, harpoon, chain link) packed into a second row-strip appended under the body row
P = load('props'); lab, big, small = comps(P, 800)
print('props', [(c[1], c[2:]) for c in big])
props = {}
def pcrop(i, k):
    c = big[i]; m = lab == c[0]
    for q in small:
        if q[2] >= c[2] - 4 and q[4] <= c[4] + 4 and q[3] >= c[3] - 4 and q[5] <= c[5] + 4: m |= lab == q[0]
    ys, xs = np.nonzero(m); sub = P[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); mm = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]; mx = np.maximum(r, b); g = np.where(g > mx + 10, mx + (g - mx) * 0.2, g)
    al = np.where(mm, sub[..., 3], 0)
    im = Image.fromarray(np.dstack([r, g, b, al]).clip(0, 255).astype(np.uint8), 'RGBA')
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
# order left->right: anchor, harpoon, (horizontal link), (vertical chain) -- big comps sorted by x
names_p = EXTRA.get('_props', ['anchor', 'harpoon', 'link', 'chainv'])
PK = EXTRA.get('_propk', {'anchor': 64, 'harpoon': 70, 'link': 18, 'chainv': 40})  # target px (anchor h, harpoon w, link w, chain h)
for i, nm in enumerate(names_p):
    if nm is None or i >= len(big): continue
    c = big[i]; w0, h0 = c[4] - c[2], c[5] - c[3]
    tgt = PK[nm]; k = tgt / (h0 if nm in ('anchor', 'chainv') else w0)
    props[nm] = pcrop(i, k)
x2 = 0; rowY = Ht + 4; rowH = max(im.height for im in props.values())
full = Image.new('RGBA', (max(Wt, sum(im.width + 4 for im in props.values())), Ht + 4 + rowH), (0, 0, 0, 0))
full.paste(sheet, (0, 0))
for nm, im in props.items():
    full.paste(im, (x2, rowY)); meta[nm] = [x2, rowY, im.width, im.height, im.width // 2]; x2 += im.width + 4
full.save('grim_rgba.png')
q = full.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
q.save('level5_grimwale.png', optimize=True)
print(full.size, os.path.getsize('level5_grimwale.png'))
json.dump(meta, open('meta.json', 'w')); print(json.dumps(meta))

# review sheet: each frame over a ghost idle with anchor line
im = full; names = [n for n in meta if n not in props]
out = Image.new('RGB', (7 * 200 + 40, 2 * 270 + 200), (60, 70, 90)); d = ImageDraw.Draw(out)
ix, iy, iw, ih, iax = meta['idle']; ic = im.crop((ix, iy, ix + iw, iy + ih)); gh = ic.copy(); gh.putalpha(ic.split()[3].point(lambda v: v * 0.3))
for i, k in enumerate(names):
    x, y, w, h, ax = meta[k]; c = im.crop((x, y, x + w, y + h)); X = 110 + (i % 7) * 200; Y = 250 + (i // 7) * 270
    out.paste(gh, (X - iax, Y - ih), gh); out.paste(c, (X - ax, Y - h), c); d.line([X, Y - 230, X, Y], fill=(0, 255, 255)); d.text((X - 60, Y + 3), k, fill=(255, 255, 0))
X = 20
for nm, pim in props.items():
    out.paste(pim, (X, 600), pim); d.text((X, 585), nm, fill=(255, 255, 0)); X += pim.width + 30
out.save('view/pack.png')

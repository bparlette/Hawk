# Cut, key, scale and pack the L3 / L7 painted prop sprites into levels/level3_props.png and levels/level7_props.png.
# Keys: 'alpha' = tool-keyed RGBA (despill green), 'mag' = magenta bg, 'black' = luminance alpha (glowing FX on black).
# Sprites are stored at 3x their world size (engine backing store is RES=3).
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
S = 3
def load(name, mode):
    a = np.array(Image.open('raw/' + name + '.png').convert('RGBA')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if mode == 'alpha':
        mx = np.maximum(r, b); a[..., 1] = np.where(g > mx + 6, mx + (g - mx) * 0.15, g)
    elif mode == 'mag':
        mg = np.minimum(r, b) - g                       # magenta-ness
        al = np.clip((150 - mg) / 90, 0, 1)
        lab, n = ndi.label(al < 0.5); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(border)); al = np.where(bg, 0, np.maximum(al, 0.0)); al = np.where(~bg & (ndi.distance_transform_edt(~bg) > 2), 1, al)
        A = np.maximum(al, 1e-3)[..., None]; mag = np.array([255, 0, 255], np.float32)
        a[..., :3] = np.clip((a[..., :3] - (1 - A) * mag) / A, 0, 255)
        ex = np.maximum(a[..., 0], a[..., 2]) - np.maximum(a[..., 1], np.minimum(a[..., 0], a[..., 2]))  # residual magenta fringe
        a[..., 0] = np.where((ex > 30) & (al < 1), np.minimum(a[..., 0], a[..., 1] + 30), a[..., 0])
        a[..., 2] = np.where((ex > 30) & (al < 1), np.minimum(a[..., 2], a[..., 1] + 30), a[..., 2])
        a[..., 3] = al * 255
    elif mode == 'black':
        mx = np.maximum(np.maximum(r, g), b)
        al = np.clip((mx - 14) / 150, 0, 1) ** 0.85
        A = np.maximum(al, 1e-3)[..., None]
        a[..., :3] = np.clip(a[..., :3] / np.maximum(A, mx[..., None] / 255), 0, 255)
        a[..., 3] = al * 255
    return a
def tight(a, box, thr=10):
    x0, y0, x1, y1 = box; sub = a[y0:y1, x0:x1]; m = sub[..., 3] > thr
    ys, xs = np.nonzero(m); return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def comps(a, minpix=1500):
    m = a[..., 3] > 40; lab, n = ndi.label(m, structure=np.ones((3, 3))); out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        cnt = (lab[sl] == i).sum()
        if cnt >= minpix: out.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, i))
    return lab, sorted(out, key=lambda c: (round(c[1] / 260), c[0]))
def comp(a, lab, c, pad=0):
    x0, y0, x1, y1, i = c; sub = a[y0:y1, x0:x1].copy(); mm = lab[y0:y1, x0:x1] == i
    mm = ndi.binary_dilation(mm, iterations=2); sub[..., 3] = np.where(mm, sub[..., 3], 0); return sub
def img(arr, w, h=None):
    im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
    if h is None: h = w * im.height / im.width
    return im.resize((max(1, round(w * S)), max(1, round(h * S))), Image.LANCZOS)
def split(a, n, thr=10, x0=0, x1=None):
    x1 = x1 or a.shape[1]; step = (x1 - x0) / n
    return [tight(a, (int(x0 + i * step), 0, int(x0 + (i + 1) * step), a.shape[0]), thr) for i in range(n)]
def pack(items, out):
    Wt = 1024; x = y = rowh = 0; pos = []
    for name, im in items:
        if x + im.width > Wt: x = 0; y += rowh + 2; rowh = 0
        pos.append((name, x, y, im)); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (Wt, y + rowh), (0, 0, 0, 0)); meta = {}
    for name, x, y, im in pos: sheet.paste(im, (x, y)); meta[name] = [x, y, im.width, im.height]
    sheet.save(out.replace('.png', '_rgba.png'))
    q = sheet.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG); q.save(out, optimize=True)
    print(out, sheet.size, os.path.getsize(out)); print(json.dumps(meta).replace(' ', '')); return meta

# ---------------- Level 3 ----------------
L3 = []
g = load('l3_grate', 'alpha')                 # cold grate: cut the iron ring out of its stone tile with an ellipse mask
yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]; cx, cy, ra, rb = 252, 370, 199, 131
d = ((xx - cx) / ra) ** 2 + ((yy - cy) / rb) ** 2
g[..., 3] = np.minimum(g[..., 3], np.clip((1.0 - d) / 0.03, 0, 1) * 255)
L3.append(('grate', img(tight(g, (0, 0, 520, 720)), 28, 10)))
h = load('l3_hot', 'mag'); lab, cs = comps(h, 20000)
L3.append(('grateHot', img(comp(h, lab, cs[0]), 28, 10)))
L3.append(('puddle', img(comp(h, lab, cs[1]), 30, 10)))
for i, f in enumerate(split(load('l3_geyser', 'black'), 3)): L3.append(('gey%d' % i, img(f, 36, 90)))
for i, f in enumerate(split(load('l3_wave', 'black'), 2)): L3.append(('wave%d' % i, img(f, 58)))
for i, f in enumerate(split(load('l3_gush', 'black'), 2)): L3.append(('gush%d' % i, img(f, 22)))
m = load('l3_misc', 'alpha'); lab, cs = comps(m, 3000)
print('misc comps', [c[:4] for c in cs])
tail = [c for c in cs if 700 < c[0] < 1100][0]
lad = max(cs, key=lambda c: (c[3] - c[1]) / (c[2] - c[0]))
L3.append(('tail', img(comp(m, lab, tail), 17)))
L3.append(('ladder', img(comp(m, lab, lad), 18, 150)))
M3 = pack(L3, 'level3_props.png')

# ---------------- Level 7 ----------------
L7 = []
r = load('l7_rig', 'alpha'); lab, cs = comps(r, 3000); print('rig comps', [c[:4] for c in cs])
cs = sorted(cs, key=lambda c: c[0])
mag = cs[0]; cable = min(cs, key=lambda c: (c[2] - c[0]) / (c[3] - c[1]))
L7.append(('magnet', img(comp(r, lab, mag), 34)))
cab = comp(r, lab, cable); ch = cab.shape[0]; L7.append(('cable', img(cab[int(ch * 0.1):int(ch * 0.9)], 3, 40)))
q = load('l7_ram', 'alpha'); lab, cs = comps(q, 20000); L7.append(('ram', img(comp(q, lab, cs[0]), 72)))
b = load('l7_belt', 'alpha'); lab, cs = comps(b, 3000); cs = sorted(cs, key=lambda c: -(c[2] - c[0]) * (c[3] - c[1]))
belt = comp(b, lab, cs[0]); bw = belt.shape[1]
seg = belt[:, int(bw * 0.18):int(bw * 0.18) + int(bw * 0.5)].copy()   # straight middle run, no rounded ends
n = seg.shape[1]; fade = int(n * 0.12)                                 # make it tile: cross-fade the right end into the left
w8 = np.linspace(0, 1, fade)[None, :, None]
seg[:, :fade] = seg[:, :fade] * w8 + seg[:, n - fade:] * (1 - w8); seg = seg[:, :n - fade]
L7.append(('belt', img(seg, 96, 22)))
lamps = sorted(cs[1:3], key=lambda c: c[0])
L7.append(('lampOff', img(comp(b, lab, lamps[0]), 8))); L7.append(('lampOn', img(comp(b, lab, lamps[1]), 8)))
for i, f in enumerate(split(load('l7_sparks', 'black'), 2)): L7.append(('spark%d' % i, img(f, 66, 74)))
o = load('l7_roll', 'alpha'); lab, cs = comps(o, 3000); cs = sorted(cs, key=lambda c: (c[0] // 120, c[1]))
print('roll comps', [c[:4] for c in cs])
tire = max(cs, key=lambda c: (c[2] - c[0]) * (c[3] - c[1])); rest = [c for c in cs if c is not tire]
red = lambda c: float((o[c[1]:c[3], c[0]:c[2], 0] - o[c[1]:c[3], c[0]:c[2], 1])[o[c[1]:c[3], c[0]:c[2], 3] > 128].mean())
drum = max(rest, key=red); scr = sorted([c for c in rest if c is not drum], key=lambda c: (c[0], c[1]))
scr = [scr[1], scr[0], scr[2], scr[4]]  # door (grey), engine block (rust), green panel, gear
L7.append(('tire', img(comp(o, lab, tire), 16, 16)))
L7.append(('drum', img(comp(o, lab, drum), 16, 16)))
for i, c in enumerate(scr): L7.append(('scrap%d' % i, img(comp(o, lab, c), 18)))
M7 = pack(L7, 'level7_props.png')
json.dump({'l3': M3, 'l7': M7}, open('meta.json', 'w'))

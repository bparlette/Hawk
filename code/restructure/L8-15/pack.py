# twist-art packer (L8-15 restructure): chroma key -> components -> named parts -> shelf-packed P-mode sheet + meta
import numpy as np, json
from PIL import Image
from scipy import ndimage
from kit import key, comps, cut, fit, pack, preview, trim
META = {}
def parts_of(name, minarea=2500):
    im = Image.open('gen/k_%s.png' % name); return im, comps(im, minarea, dil=3)
def by(C, i): return C[i]
SPEC = {  # sheet -> list of (part name, comp index, fit kwarg)
 'l8_twist':  [('lamp', 0, dict(w=84)), ('lampRed', 1, dict(w=84)), ('klaxon', 2, dict(w=40)), ('cover', 3, dict(w=140)), ('alcove', 4, dict(w=120))],
 'l10_twist': [('mast', 0, dict(w=560)), ('hole', 1, dict(w=280)), ('plank1', 2, dict(w=40)), ('plank2', 3, dict(w=30)), ('plank3', 4, dict(w=34)), ('ladder', 5, dict(h=190)), ('keg', 6, dict(w=110))],
 'l11_twist': [('handcarA', 0, dict(w=460)), ('track', 1, dict(w=460)), ('handcarB', 2, dict(w=460)), ('outlawCar', 3, dict(w=460))],
 'l12_twist': [('bot', 0, dict(h=80)), ('botHack', 1, dict(h=80)), ('botHurt', 2, dict(h=80)), ('botCheer', 3, dict(h=96)), ('gateLock', 4, dict(h=180)), ('gateOpen', 5, dict(h=180))],
 'l13_twist': [('cannon', 0, dict(w=220)), ('cannonFire', 1, dict(w=250)), ('pod', 2, dict(w=110)), ('rubble', 3, dict(w=160)), ('shell', 4, dict(w=48))],
 'l14_twist': [('mound', 0, dict(w=170)), ('crater', 1, dict(w=190)), ('chunk1', 2, dict(w=64)), ('drillHalf', 3, dict(w=190)), ('chunk2', 4, dict(w=52)), ('chunk3', 5, dict(w=56)), ('drillFull', 6, dict(h=300))],
 'l15_twist': [('cable', 0, dict(h=300)), ('brake', 1, dict(w=190)), ('hatch', 2, dict(w=200)), ('weight', 3, dict(w=160)), ('elight', 4, dict(w=40))],
}
OUT = {'l8_twist': 'level8_sentry.png', 'l10_twist': 'level10_collapse.png', 'l11_twist': 'level11_handcar.png', 'l12_twist': 'level12_ally.png',
       'l13_twist': 'level13_turret.png', 'l14_twist': 'level14_tendril.png', 'l15_twist': 'level15_freefall.png'}
for sh, spec in SPEC.items():
    im, C = parts_of(sh)
    parts = [(n, fit(cut(im, C[i]), **kw)) for n, i, kw in spec]
    W = max(512, max(p.width for _, p in parts)); W = min(1024, W + 8)
    place, sheet = pack(parts, W, 'out/' + OUT[sh])
    preview(sheet, 'view/pack_%s.jpg' % sh, k=1); META[OUT[sh]] = place
    print(OUT[sh], sheet.size, place)

# ---- Ronin mini-boss sheet: [x, y, w, h, anchorX] bottom-aligned strip like level15_elite.png ----
im = Image.open('gen/k_l9_ronin.png'); A = np.array(im); m = A[..., 3] > 40
lab, k = ndimage.label(m)
def region(mask, src=None):
    a = (A if src is None else src).copy(); a[..., 3] = np.where(mask, a[..., 3], 0); return trim(Image.fromarray(a, 'RGBA'))
L = lambda i: lab == i
xx = np.mgrid[0:A.shape[0], 0:A.shape[1]][1]
c6 = L(6)
yy = np.mgrid[0:A.shape[0], 0:A.shape[1]][0]
def disk(x, y, r=25): return c6 & ((xx - x) ** 2 + (yy - y) ** 2 < r * r)
own = [disk(1290, 330), disk(1480, 210)]           # seeds: lunge torso, hurt torso (render px)
st = ndimage.generate_binary_structure(2, 1)
while True:  # competitive region growing inside the merged blob (geodesic split)
    grown = [ndimage.binary_dilation(o, st) & c6 & ~own[1 - i] for i, o in enumerate(own)]
    if all((g == o).all() for g, o in zip(grown, own)): break
    clash = grown[0] & grown[1]; own = [grown[0] & ~clash | own[0], grown[1] & ~clash | own[1]]
lunge, hurt = own
rgb = A[..., :3].astype(int); lum = rgb.mean(-1); sat = rgb.max(-1) - rgb.min(-1)
blade = hurt & (yy > 300) & (yy < 420) & (lum > 95) & (sat < 70)          # lunge's steel blade tip, claimed by the hurt pose
blade = ndimage.binary_closing(ndimage.binary_dilation(blade, iterations=2) & hurt & (yy > 300) & (yy < 420), iterations=2) & hurt
bl, bk = ndimage.label(blade); szb = ndimage.sum(blade, bl, range(1, bk + 1))
blade = bl == 1 + int(np.argmax(szb)) if bk else blade
lunge = lunge | blade; hurt = hurt & ~blade
gap = blade & ndimage.binary_closing(hurt | blade, iterations=1)  # blade pixels that crossed his thighs
hole = ndimage.binary_dilation(hurt, iterations=6) & ndimage.binary_dilation(hurt & (yy > 380), iterations=40) & ndimage.binary_dilation(hurt & (yy < 330), iterations=40) & blade
idx = ndimage.distance_transform_edt(~hurt, return_distances=False, return_indices=True)  # nearest leg pixel colour fill
A0 = A.copy(); A[hole] = A[idx[0][hole], idx[1][hole]]; A[..., 3] = np.where(hole, 255, A[..., 3])
hurt = hurt | hole
hl, hk = ndimage.label(hurt); szh = ndimage.sum(hurt, hl, range(1, hk + 1)); hurt = np.isin(hl, 1 + np.nonzero(szh > 400)[0])
ll, lk = ndimage.label(ndimage.binary_dilation(lunge, iterations=3)); szl = ndimage.sum(lunge, ll, range(1, lk + 1)); lunge = lunge & (ll == 1 + int(np.argmax(szl)))
print('split', lunge.sum(), hurt.sum())
poses = [('idle', L(1)), ('walk1', L(4)), ('walk2', L(5)), ('guard', L(2)), ('wind', L(3)), ('slash', L(7)), ('lunge', lunge), ('hurt', hurt), ('down', L(18) | L(19))]
K = 176 / 493  # idle 493 px tall in the render -> 176 px stored (drawn ~0.5 -> ~88 world px, a head taller than a foot soldier)
def anchor(fr, lying=False):
    a = np.asarray(fr)[..., 3]
    if lying: return fr.width // 2
    h = fr.height; ys, xs = np.nonzero(a[int(h * 0.45):int(h * 0.62)] > 100)
    return int(np.median(xs)) if len(xs) else fr.width // 2
frs = []
for n, mk in poses:
    fr = region(mk, A0 if n == 'lunge' else None); fr = fr.resize((max(1, round(fr.width * K)), max(1, round(fr.height * K))), Image.LANCZOS)
    frs.append((n, fr, anchor(fr, n == 'down')))
H = max(f.height for _, f, _ in frs); W = sum(f.width + 4 for _, f, _ in frs) + 4
sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 4; F = {}
for n, f, ax in frs: y = H - f.height; sheet.paste(f, (x, y)); F[n] = [x, y, f.width, f.height, ax]; x += f.width + 4
sheet.save('out/level9_ronin.png', optimize=True); META['level9_ronin.png'] = F
preview(sheet, 'view/pack_ronin.jpg', k=1)
print('ronin', sheet.size, F)
json.dump(META, open('out/meta.json', 'w'), indent=1)

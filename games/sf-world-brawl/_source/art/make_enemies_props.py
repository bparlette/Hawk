"""RUN 5: cut painted enemy sheets, props, food, enemy FX, title logo and backdrops into game atlases.
Same pipeline as make_atlas.py / make_specials.py: (tool chroma key) + own green key -> despill -> dilated components ->
row-major order -> tight bbox -> scale (idle height 150 for grunts) -> one row, feet bottom-aligned. Writes rects to
art/atlas_e_rects.json and prints the JS consts to paste."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

ART = "/workspace/work/sf_brawler/art/"
OUT = "/workspace/work/sf_brawler/game/"
NAMES = ["idle", "walk", "attack", "jump", "hurt", "down"]
ENEMIES = ["purple", "blue", "star", "sword", "dasher", "heavy"]


def green_key(im):
    """kill leftover chroma (the tool keys the main bg; generated floors/shadows/fringes stay) + despill."""
    im = im.astype(np.int32)
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    mx = np.maximum(r, b)
    gr = g - mx  # greenness
    a = np.where((gr > 40) & (g > 90), 0, a)
    a = np.where((gr > 18) & (gr <= 40) & (g > 90), (a * (40 - gr) / 22).astype(np.int32), a)
    g = np.where(g > mx, mx + (g - mx) * 0.15, g).astype(np.int32)
    im[..., 1] = g; im[..., 3] = a
    return np.clip(im, 0, 255).astype(np.uint8)


def components(im, min_area=2500, dil=10, rows=True):
    mask = im[..., 3] > 40
    mask = ndimage.binary_opening(mask, iterations=1)
    grow = ndimage.binary_dilation(mask, iterations=dil)
    lab, n = ndimage.label(grow)
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (mask[sl] & (lab[sl] == i + 1)).sum() < min_area:
            continue
        comps.append((sl, i + 1))
    H = im.shape[0]
    if rows:
        comps.sort(key=lambda c: (0 if (c[0][0].start + c[0][0].stop) / 2 < H / 2 else 1, c[0][1].start))
    else:
        comps.sort(key=lambda c: c[0][1].start)
    out = []
    for sl, li in comps:
        sub = im[sl].copy()
        sub[..., 3] = np.where(lab[sl] == li, sub[..., 3], 0)
        ys, xs = np.where(sub[..., 3] > 20)
        out.append(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out


def pack(pieces):
    W = sum(p.width for _, p in pieces) + 2 * (len(pieces) - 1)
    H = max(p.height for _, p in pieces)
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0)); x = 0; rects = {}
    for nm, p in pieces:
        y = H - p.height; cv.paste(p, (x, y)); rects[nm] = [x, y, p.width, p.height]; x += p.width + 2
    return cv, rects


def quant(cv, path):
    q = cv.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)


def rs(f, k):
    return f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)


res = {}
# ---- enemies: one atlas per type, idle = 150 px (heavy also 150; the engine draws heavies at 1.18x) ----
for t in ENEMIES:
    im = green_key(np.array(Image.open(ART + "enemies/enemy_%s_sheet.png" % t).convert("RGBA")))
    fr = components(im)
    assert len(fr) == 6, (t, len(fr), [f.shape for f in fr])
    k = 150 / fr[0].shape[0]
    cv, rects = pack([(nm, rs(Image.fromarray(f), k)) for nm, f in zip(NAMES, fr)])
    quant(cv, OUT + "atlas_e_%s.png" % t)
    res[t] = rects
    print(t, cv.size)

# ---- props: dummy (makiwara target stand), shoji, scrolls; stored at 3x their on-screen height ----
PROP_H = {"dummy": 24 * 1.7, "shoji": 22 * 1.7, "scrolls": 18 * 1.7}  # PROP_DEF h * PROP_K (screen px)
im = green_key(np.array(Image.open(ART + "props/sf_props_sheet.png").convert("RGBA")))
fr = components(im, 4000, 6, rows=False)
print("props comps", [f.shape for f in fr])
pieces = []
for nm, f in zip(["dummy", "shoji", "scrolls"], fr[:3]):
    f = Image.fromarray(f); pieces.append((nm, rs(f, PROP_H[nm] * 3 / f.height)))
# ---- food pickups (screen widths) ----
FOOD_W = {"onigiri": 22, "tea": 18, "chicken": 36, "sushi": 40}
im = green_key(np.array(Image.open(ART + "props/sf_food_sheet.png").convert("RGBA")))
fr = components(im, 2000, 6, rows=False)
print("food comps", [f.shape for f in fr])
for nm, f in zip(["onigiri", "tea", "chicken", "sushi"], fr[:4]):
    f = Image.fromarray(f); pieces.append((nm, rs(f, FOOD_W[nm] * 3 / f.width)))
# ---- shuriken (normal alpha) ----
im = green_key(np.array(Image.open(ART + "props/sf_shuriken.png").convert("RGBA")))
fr = components(im, 2000, 4, rows=False)
f = Image.fromarray(fr[0]); pieces.append(("shuriken", rs(f, 14 * 3 / f.width)))
cv, rects = pack(pieces)
cv.save(OUT + "atlas_props.png", optimize=True)  # RGBA kept: soft edges on small sprites
res["props"] = rects
print("props atlas", cv.size)

# ---- dark Hadouken (black bg -> additive alpha, same as the fx sheet) -> appended to its own small atlas ----
im = np.array(Image.open(ART + "props/sf_darkhadou.png").convert("RGB")).astype(np.float32)
a = im.max(axis=2); a = np.clip((a - 14) * 255 / 241, 0, 255)
rgb = np.where(a[..., None] > 0, np.clip(im * 255 / np.maximum(a[..., None], 1), 0, 255), 0)
rgba = np.dstack([rgb, a]).astype(np.uint8)
fr = components(rgba, 1500, 6, rows=False)
f = Image.fromarray(fr[0]); f = rs(f, 90 / f.height)
f.save(OUT + "atlas_fxdark.png", optimize=True)
res["fxdark"] = {"hadoudark": [0, 0, f.width, f.height]}
print("fxdark", f.size)

# ---- title logo ----
im = green_key(np.array(Image.open(ART + "props/sf_logo.png").convert("RGBA")))
ys, xs = np.where(im[..., 3] > 20)
lg = Image.fromarray(im[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
lg = rs(lg, 900 / lg.width)
quant(lg, OUT + "title_logo.png")
res["logo"] = [0, 0, lg.width, lg.height]
print("logo", lg.size)

# ---- backdrops (canvas is 384x224 at RES 3 -> 1152x672) ----
tb = Image.open(ART + "props/sf_title_bg.png").convert("RGB")
tb = tb.crop((40, 34, tb.width - 40, tb.height))  # generated image had a dark shoji window frame on the edges
tb = tb.resize((1152, 672), Image.LANCZOS) if tb.width / tb.height > 1152 / 672 else tb.resize((1152, round(tb.height * 1152 / tb.width)), Image.LANCZOS)
tb = tb.crop((0, tb.height - 672, 1152, tb.height)) if tb.height > 672 else tb
tb.save(OUT + "title_bg.jpg", quality=82, optimize=True)
mb = Image.open(ART + "props/sf_map_bg.png").convert("RGB").resize((1152, 643), Image.LANCZOS)
cvm = Image.new("RGB", (1152, 672)); cvm.paste(mb.resize((1152, 672), Image.LANCZOS))
cvm.save(OUT + "map_bg.jpg", quality=80, optimize=True)
print("bgs", tb.size, cvm.size)

json.dump(res, open(ART + "atlas_e_rects.json", "w"))
print("ATLAS_E", json.dumps({k: res[k] for k in ENEMIES}, separators=(",", ":")))
print("ATLAS_PROPS", json.dumps(res["props"], separators=(",", ":")))
print("FXDARK", json.dumps(res["fxdark"]))

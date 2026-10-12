"""Cut painted special-move sheets (art/specials/spec_<key>.png) into game/atlas_sp_<key>.png + game/atlas_fx.png.
Same method as make_atlas.py: key -> despill -> dilated components -> row-major order -> tight bbox -> scale -> one row, feet bottom-aligned.
Scale = the factor make_atlas used for that fighter's original sheet (atlas idle h / sheet idle h) x per-key fudge. Prints ATLAS_SP json."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ART = "/workspace/work/sf_brawler/art/"
SP = ART + "specials/"
OUT = "/workspace/work/sf_brawler/game/"
ATLAS_IDLE_H = {"ryu": 150, "kenp": 150, "chunli": 142, "guile": 158, "blanka": 146, "honda": 146, "zangief": 160,
                "dhalsim": 160, "cammy": 146, "feilong": 150, "deejay": 156, "thawk": 164}
ORIG = {"kenp": "ken_sheet.png"}
# key -> (gen sheet, background mode, component indices to keep (row-major), scale fudge)
JOBS = {  # key -> (sheet, bg mode, kept component indices, sort: "x" single row | "rows", ref ratio: sp1 height / atlas idle height)
    "ryu": ("spec_ryu.png", "alpha", [0, 1, 2], "x", 1.0),
    "kenp": ("spec_kenp.png", "alpha", [0, 1, 2], "x", 0.86),
    "chunli": ("spec_chunli.png", "alpha", [0, 1, 2], "x", 1.0),
    "guile": ("spec_guile.png", "alpha", [0, 1, 2], "x", 1.0),
    "blanka": ("spec_blanka3.png", "magenta", [0, 1, 2], "x", 1.0),
    "honda": ("spec_honda.png", "alpha", [0, 1, 2], "x", 1.0),  # bottom row only (CROP_Y)
    "zangief": ("spec_zangief2.png", "alpha", [0, 1, 2, 3], "rows", 1.0),  # RUN 4: 4-frame lariat spin (top row of the 2x4 sheet)
    "dhalsim": ("spec_dhalsim.png", "alpha", [0, 1, 2], "x", 1.0),
    "cammy": ("spec_cammy5.png", "magenta", [0, 1, 2], "x", 1.04),  # RUN 4: crouch + 2 airborne spear frames (compose_cammy5.py)
    "feilong": ("spec_feilong.png", "alpha", [0, 1, 2], "x", 0.93),
    "deejay": ("spec_deejay3.png", "alpha", [0, 1, 2], "x", 1.0),
    "thawk": ("spec_thawk.png", "alpha", [0, 1, 2], "rows", 0.95),
}
CROP_Y = {"honda": 377}  # sheet rows above this are skipped
GHOST_TINT = {"honda": (236, 184, 150), "deejay": (215, 52, 44), "zangief": (238, 232, 222)}  # semi-transparent motion-blur ghosts came out chroma-green
NO_DESPILL = {"cammy", "blanka"}
COLOR_MATCH = {"cammy": 0.75}  # RUN 4: pull new frames toward the base atlas idle colours (mean/std per channel, blend)  # green costume / green skin


def despill(a):
    rgb = a[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lim = np.maximum(r, b)
    rgb[..., 1] = np.where(g > lim, lim + (g - lim) * 0.15, g)
    out = a.copy(); out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def load(sheet, mode, key):
    im = np.array(Image.open(SP + sheet).convert("RGBA")).astype(np.int32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    if mode == "magenta":
        mag = np.minimum(r, b) - g  # how magenta a pixel is
        a = np.clip(255 - (mag - 40) * 4, 0, 255)
        a = np.where(mag > 103, 0, a)
        im[..., 3] = a
        # de-spill magenta: pull r,b down toward g where they both exceed it
        lim = np.maximum(g, np.minimum(r, b) * 0 + g)
        excess = np.clip(np.minimum(r, b) - g, 0, None)
        im[..., 0] = r - (excess * 0.85).astype(np.int32); im[..., 2] = b - (excess * 0.85).astype(np.int32)
    else:
        if key not in NO_DESPILL:  # kill leftover chroma speckles (strongly green, unkeyed)
            green = (g > 120) & (g > r * 1.6) & (g > b * 1.6)
            im[..., 3] = np.where(green, 0, im[..., 3])
    if key in GHOST_TINT:
        r, g, b = im[..., 0], im[..., 1], im[..., 2]
        gm = (g > np.maximum(r, b) + 12)
        lum = np.clip(g / 200.0, 0.35, 1.15)
        for c, v in enumerate(GHOST_TINT[key]):
            im[..., c] = np.where(gm, (v * lum).astype(np.int32), im[..., c])
    if key in CROP_Y:
        im[:CROP_Y[key], :, 3] = 0
    im = np.clip(im, 0, 255).astype(np.uint8)
    if key not in NO_DESPILL:
        im = despill(im)
    return im


def components(im, min_area=2500, sort="rows"):
    mask = im[..., 3] > 40
    mask = ndimage.binary_opening(mask, iterations=1)
    grow = ndimage.binary_dilation(mask, iterations=12)
    lab, n = ndimage.label(grow)
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (mask[sl] & (lab[sl] == i + 1)).sum() < min_area:
            continue
        comps.append((sl, i + 1))
    H = im.shape[0]
    rows = sorted(set(0 if (s[0].start + s[0].stop) / 2 < H / 2 else 1 for s, _ in comps))
    if sort == "x":
        comps.sort(key=lambda c: c[0][1].start)
    else:
        comps.sort(key=lambda c: (0 if (c[0][0].start + c[0][0].stop) / 2 < H / 2 else 1, c[0][1].start))
    out = []
    for sl, li in comps:
        sub = im[sl].copy()
        sub[..., 3] = np.where(lab[sl] == li, sub[..., 3], 0)
        ys, xs = np.where(sub[..., 3] > 20)
        out.append(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return out


def orig_idle_h(key):
    sheet = ORIG.get(key, key + "_sheet.png")
    im = np.array(Image.open(ART + sheet).convert("RGBA"))
    if key == "honda":  # sheet kept its white backdrop
        nonwhite = (im[..., :3].min(axis=2) < 235)
        im[..., 3] = np.where(nonwhite, 255, 0)
    fr = components(im)
    return fr[0].shape[0]


def pack(pieces):
    W = sum(p.width for _, p in pieces) + 2 * (len(pieces) - 1)
    H = max(p.height for _, p in pieces)
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0)); x = 0; rects = {}
    for nm, p in pieces:
        y = H - p.height; cv.paste(p, (x, y)); rects[nm] = [x, y, p.width, p.height]; x += p.width + 2
    return cv, rects


def color_match(cv, key, amt):
    import re
    html = open(OUT + "index.html").read()
    x, y, w, h = map(int, re.search(r'\n    %s: \{ idle: \[(\d+), (\d+), (\d+), (\d+)\]' % key, html).groups())
    ref = np.array(Image.open(OUT + "atlas_%s.png" % key).convert("RGBA").crop((x, y, x + w, y + h))).astype(float)
    sp = np.array(cv).astype(float); rm = ref[..., 3] > 200; sm = sp[..., 3] > 200; out = sp.copy()
    for c in range(3):
        a = ref[..., c][rm]; b = sp[..., c][sm]
        out[..., c] = np.clip(sp[..., c] * (1 - amt) + ((sp[..., c] - b.mean()) / b.std() * a.std() + a.mean()) * amt, 0, 255)
    return Image.fromarray(out.astype(np.uint8))


def save_png(cv, path):
    cv.save(path, optimize=True)
    # palette-quantise (like the cabinet) only if it stays visually lossless enough: keep RGBA, just optimize


if __name__ == "__main__":
    only = sys.argv[1:]
    res = {}
    try:
        res = json.load(open(ART + "atlas_sp_rects.json"))
    except Exception:
        pass
    for key, (sheet, mode, keep, srt, ratio) in JOBS.items():
        if only and key not in only and "fx" not in only:
            continue
        if only and key not in only:
            continue
        im = load(sheet, mode, key)
        fr = components(im, sort=srt)
        print(key, "components", len(fr), [f.shape[:2] for f in fr])
        k = ATLAS_IDLE_H[key] * ratio / fr[keep[0]].shape[0]
        pieces = []
        for j, idx in enumerate(keep):
            f = Image.fromarray(fr[idx])
            pieces.append(("sp%d" % (j + 1), f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)))
        cv, rects = pack(pieces)
        if key in COLOR_MATCH:
            cv = color_match(cv, key, COLOR_MATCH[key])
        save_png(cv, OUT + "atlas_sp_%s.png" % key)
        res[key] = rects
        print(" ->", cv.size, "k=%.3f" % k, rects)
    if not only or "fx" in only:
        im = np.array(Image.open(SP + "spec_fx.png").convert("RGB")).astype(np.float32)
        a = im.max(axis=2)
        a = np.clip((a - 14) * 255 / 241, 0, 255)
        rgb = np.where(a[..., None] > 0, np.clip(im * 255 / np.maximum(a[..., None], 1), 0, 255), 0)
        rgba = np.dstack([rgb, a]).astype(np.uint8)
        fr = components(rgba, 1500)
        print("fx components", len(fr), [f.shape[:2] for f in fr])
        names = ["hadou", "sonic", "yfire"]
        pieces = []
        for nm, f in zip(names, fr[:3]):
            f = Image.fromarray(f); k = 90 / f.height
            pieces.append((nm, f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)))
        cv, rects = pack(pieces)
        save_png(cv, OUT + "atlas_fx.png")
        res["fx"] = rects
        print("fx ->", cv.size, rects)
    json.dump(res, open(ART + "atlas_sp_rects.json", "w"))
    print("ATLAS_SP", json.dumps(res, separators=(",", ":")))

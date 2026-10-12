"""STAGES 2-3 art pipeline (re-runnable). Generated sheets in art/stage2, art/stage3 (generate-on-green, some on white)
-> key -> components -> anchor (feet / body centroid, padded so drawFrame's centre = anchor) -> pack one row,
feet bottom-aligned -> game/levels/levelN_*.png + rects JSON (pasted into levelN.js). Backgrounds -> 512 px tall jpg,
corridor strips cross-faded left<->right so they tile."""
import json, numpy as np
from PIL import Image
from scipy import ndimage
from stage_cut import load, components

ART = "/workspace/work/sf_brawler/art/"; OUT = "/workspace/work/sf_brawler/game/levels/"
BOSS_IDLE_H = 220  # atlas px of the idle frame

def anchor_pad(c, mode):
    a = c[..., 3].astype(np.float32) / 255; h, w = a.shape
    if mode == "feet":
        band = a[int(h * 0.62):]; xs = np.arange(w); ax = (band.sum(0) * xs).sum() / max(1e-6, band.sum())
    elif mode == "torso":
        band = a[: int(h * 0.7)]; xs = np.arange(w); ax = (band.sum(0) * xs).sum() / max(1e-6, band.sum())
    else:
        xs = np.arange(w); ax = (a.sum(0) * xs).sum() / a.sum()
    ax = int(round(ax)); L = ax; R = w - ax; P = max(L, R)
    out = np.zeros((h, 2 * P, 4), np.uint8); out[:, P - L:P - L + w] = c
    return out

def rs(img, k): return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)

def pack(pieces, gap=4):
    W = sum(p.width for _, p in pieces) + gap * (len(pieces) - 1); H = max(p.height for _, p in pieces)
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0)); x = 0; rects = {}
    for nm, p in pieces:
        y = H - p.height; cv.paste(p, (x, y)); rects[nm] = [x, y, p.width, p.height]; x += p.width + gap
    return cv, rects

def quant(cv, path):
    cv.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)

def boss(sheets, picks, path):
    """picks: list of (name, sheet_idx, comp_idx, anchor_mode, flip)"""
    comps = [components(load(ART + f, k), rows=2, dil=4) for f, k in sheets]
    idle_h = comps[0][0][0].shape[0]; k = BOSS_IDLE_H / idle_h
    pieces = []
    for nm, si, ci, mode, flip in picks:
        c = comps[si][ci][0]
        if flip: c = c[:, ::-1].copy()
        pieces.append((nm, rs(Image.fromarray(anchor_pad(c, mode)), k)))
    cv, rects = pack(pieces); quant(cv, path); print(path, cv.size); return rects

def props(sheet, spec, path, extra=None):
    comps = components(load(ART + sheet, "g"), rows=0, dil=4)
    pieces = []
    for nm, ci, screen_h, fill_holes in spec:
        c = comps[ci][0].copy()
        if fill_holes:  # taxi windows were keyed out: refill enclosed holes with dark tinted glass
            m = c[..., 3] > 40; holes = ndimage.binary_fill_holes(m) & ~m
            c[holes] = [22, 30, 38, 235]
        pieces.append((nm, rs(Image.fromarray(c), screen_h * 3 / c.shape[0])))
    cv, rects = pack(pieces); cv.save(path, optimize=True); print(path, cv.size); return rects

def strip(src, path, seam=90, crop=None):
    im = Image.open(ART + src).convert("RGB"); im = rs(im, 512 / im.height)
    a = np.array(im).astype(np.float32)
    if crop: c0 = (a.shape[1] - crop) // 2; a = a[:, c0:c0 + crop]
    else:  # cross-fade: blend the last `seam` px into the first so the strip tiles
        w = a.shape[1]; head = a[:, :seam].copy(); tail = a[:, w - seam:]
        al = np.linspace(0, 1, seam)[None, :, None]
        a[:, :seam] = tail * (1 - al) + head * al; a = a[:, : w - seam]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(path, quality=84, optimize=True); print(path, a.shape)

R = {}
# ---------------- STAGE 2 ----------------
R["sodom"] = boss([("stage2/s2_sodom_a.png", "g"), ("stage2/s2_sodom_b.png", "white")], [
    ("idle", 0, 0, "feet", 0), ("walk", 0, 1, "feet", 0), ("slash", 0, 2, "feet", 0), ("burning", 0, 3, "torso", 0),
    ("scrape", 0, 4, "feet", 0), ("grab", 0, 5, "feet", 0), ("buster", 0, 6, "feet", 0), ("catch", 0, 7, "feet", 0),
    ("hurt", 1, 0, "feet", 0), ("fall", 1, 1, "all", 0), ("down", 1, 2, "all", 1), ("getup", 1, 4, "feet", 0),
    ("ko", 1, 5, "all", 0), ("win", 1, 3, "feet", 0)], OUT + "level2_sodom.png")
R["props2"] = props("stage2/s2_props.png", [("drum", 0, 31, 0), ("crate", 1, 26, 0), ("sake", 2, 30, 0), ("hook", 3, 70, 0)], OUT + "level2_props.png")
strip("stage2/s2_bg_warehouse.png", OUT + "level2_warehouse.jpg")
strip("stage2/s2_bg_arena.png", OUT + "level2_arena.jpg", crop=917)
# ---------------- STAGE 3 ----------------
R["birdie"] = boss([("stage3/s3_birdie_a.png", "g"), ("stage3/s3_birdie_b.png", "white")], [
    ("idle", 0, 0, "feet", 0), ("walk", 0, 1, "feet", 0), ("chain", 0, 2, "feet", 0), ("bullhead", 0, 3, "torso", 0),
    ("bullhorn", 0, 4, "feet", 0), ("murder", 0, 5, "feet", 0), ("birdie", 0, 6, "feet", 0), ("taunt", 0, 7, "feet", 0),
    ("hurt", 1, 0, "feet", 0), ("fall", 1, 1, "all", 0), ("down", 1, 2, "all", 0), ("getup", 1, 3, "feet", 0),
    ("ko", 1, 4, "all", 0), ("win", 1, 5, "feet", 0)], OUT + "level3_birdie.png")
R["props3"] = props("stage3/s3_props.png", [("cask", 0, 32, 0), ("bin", 1, 30, 0), ("taxi", 2, 62, 1), ("bottles", 3, 22, 0)], OUT + "level3_props.png")
strip("stage3/s3_bg_street.png", OUT + "level3_street.jpg")
strip("stage3/s3_bg_pub.png", OUT + "level3_pub.jpg", crop=917)
json.dump(R, open(ART + "stage23_rects.json", "w"))
for k, v in R.items(): print(k, json.dumps(v, separators=(",", ":")))

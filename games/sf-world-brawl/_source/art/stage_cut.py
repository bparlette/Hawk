"""Stage 2-3 art: key (tool alpha / green / white) -> components -> per-frame crops. Shared helpers."""
import numpy as np
from PIL import Image
from scipy import ndimage
import sys
sys.path.insert(0, "/workspace/work/sf_brawler/art")

def green_key(im):
    im = im.astype(np.int32)
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    mx = np.maximum(r, b); gr = g - mx
    a = np.where((gr > 40) & (g > 90), 0, a)
    a = np.where((gr > 18) & (gr <= 40) & (g > 90), (a * (40 - gr) / 22).astype(np.int32), a)
    g = np.where(g > mx, mx + (g - mx) * 0.15, g).astype(np.int32)
    im[..., 1] = g; im[..., 3] = a
    return np.clip(im, 0, 255).astype(np.uint8)

def white_key(im):
    """white studio bg: flood from the border through near-white pixels, soft 2px edge, de-fringe."""
    im = im.astype(np.int32).copy()
    rgb = im[..., :3]; mn = rgb.min(axis=2); mxv = rgb.max(axis=2)
    cand = (mn > 228) & (mxv - mn < 22)
    lab, n = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # soft fringe: pixels near bg that are light get partial alpha
    near = ndimage.binary_dilation(bg, iterations=2) & ~bg
    a = np.where(bg, 0, 255).astype(np.float32)
    lt = np.clip((mn - 170) / 60.0, 0, 1)
    a = np.where(near, 255 * (1 - lt * 0.85), a)
    im[..., 3] = a.astype(np.int32)
    return np.clip(im, 0, 255).astype(np.uint8)

def components(im, min_area=2500, dil=10, rows=2):
    mask = im[..., 3] > 40
    mask = ndimage.binary_opening(mask, iterations=1)
    grow = ndimage.binary_dilation(mask, iterations=dil)
    lab, n = ndimage.label(grow)
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (mask[sl] & (lab[sl] == i + 1)).sum() < min_area: continue
        comps.append((sl, i + 1))
    H = im.shape[0]
    def row(c):
        cy = (c[0][0].start + c[0][0].stop) / 2
        return int(cy / (H / rows)) if rows else 0
    comps.sort(key=lambda c: (row(c), c[0][1].start))
    out = []
    for sl, li in comps:
        sub = im[sl].copy()
        sub[..., 3] = np.where(lab[sl] == li, sub[..., 3], 0)
        ys, xs = np.where(sub[..., 3] > 20)
        out.append((sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (sl[1].start + xs.min(), sl[0].start + ys.min())))
    return out

def load(path, key):
    im = np.array(Image.open(path).convert("RGBA"))
    if key == "white": im = white_key(im)
    im = green_key(im)
    return im

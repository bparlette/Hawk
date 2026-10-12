"""Cut generated chroma sprite sheets into engine atlases (one row, feet aligned bottom), print ATLAS rects."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "/workspace/work/sf_brawler/art/"
OUT = "/workspace/work/sf_brawler/game/"

# name -> (sheet, target idle height, [frame names in component order (row-major)], None = skip)
JOBS = {
    "ryu": ("ryu_sheet.png", 150, ["idle", "walk", "attack", None, "jump", "hurt", "down"]),
    "cammy": ("cammy_sheet.png", 146, ["idle", "walk", "attack", "jump", "hurt", "down"]),
    "feilong": ("feilong_sheet.png", 150, ["idle", "walk", "attack", "jump", "hurt", "down"]),
    "deejay": ("deejay_sheet.png", 156, ["idle", "walk", "attack", "jump", "hurt", "down"]),
    "ninja": ("scout_sheet.png", 150, ["idle", "walk", "attack", "jump", "hurt", "down"]),
    "gunner": ("karateka_sheet.png", 150, ["idle", "walk", "attack", "jump", "hurt", "down"]),
    "ken": ("ken_sheet.png", 190, ["idle", "walk", "charge", "kick", "fire", "rise", "hurt", "down"]),
    "evil": ("evilryu_sheet.png", 190, ["idle", "walk", "charge", "kick", "fire", "rise", "hurt", "down"]),
}


def despill(a):
    rgb = a[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lim = np.maximum(r, b)
    g2 = np.where(g > lim, lim + (g - lim) * 0.15, g)
    rgb[..., 1] = g2
    out = a.copy()
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def cut(sheet):
    im = np.array(Image.open(SRC + sheet).convert("RGBA"))
    im = despill(im)
    al = im[..., 3]
    mask = al > 40
    grow = ndimage.binary_dilation(mask, iterations=10)
    lab, n = ndimage.label(grow)
    objs = ndimage.find_objects(lab)
    comps = []
    for i, sl in enumerate(objs):
        area = (mask[sl] & (lab[sl] == i + 1)).sum()
        if area < 2500:
            continue
        comps.append((sl, i + 1))
    H = im.shape[0]
    comps.sort(key=lambda c: (0 if (c[0][0].start + c[0][0].stop) / 2 < H / 2 else 1, c[0][1].start))
    frames = []
    for sl, li in comps:
        sub = im[sl].copy()
        keep = lab[sl] == li
        sub[..., 3] = np.where(keep, sub[..., 3], 0)
        # tight bbox on real alpha
        ys, xs = np.where(sub[..., 3] > 20)
        sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        frames.append(sub)
    return frames


atlas_out = {}
for name, (sheet, target, names) in JOBS.items():
    frames = cut(sheet)
    if len(frames) != len(names):
        print("!!", name, "found", len(frames), "frames, expected", len(names), [f.shape for f in frames])
    k = target / frames[0].shape[0]
    pieces = []
    for f, nm in zip(frames, names):
        if nm is None:
            continue
        img = Image.fromarray(f)
        w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
        pieces.append((nm, img.resize((w, h), Image.LANCZOS)))
    W = sum(p.width for _, p in pieces) + 2 * (len(pieces) - 1)
    Hh = max(p.height for _, p in pieces)
    canvas = Image.new("RGBA", (W, Hh), (0, 0, 0, 0))
    x = 0
    rects = {}
    for nm, p in pieces:
        y = Hh - p.height
        canvas.paste(p, (x, y))
        rects[nm] = [x, y, p.width, p.height]
        x += p.width + 2
    canvas.save(OUT + "atlas_" + name + ".png", optimize=True)
    atlas_out[name] = rects
    print(name, canvas.size)
print(json.dumps(atlas_out))
json.dump(atlas_out, open(SRC + "atlas_rects.json", "w"))

#!/usr/bin/env python3
"""
paint_postprocess.py — MOTH SLICE bake step: "paint everything, not just the ground."

Post-processes the main game's Blender-baked sprites so buildings and characters
carry the same mark-making as the painted ground:

  * building colour sprites  -> Kuwahara flattening + oriented impasto dabs that
    follow the structure-tensor orientation of the sprite (roof edges / walls),
    plus a plum ink line inside the silhouette edge.
  * building night overlays   -> gentle Kuwahara flatten only, bright window /
    glow cores protected (they are additive light passes).
  * ped + player colour sheets -> the same treatment, lighter (smaller radius,
    shorter dabs), palette and alpha untouched.
  * ped + player shadow sheets -> ALPHA only: a stroke-textured contact patch at
    the feet anchor + streak breakup along the cast direction, so the shadow
    reads as painted strokes instead of a flat blob. (The renderer tints shadow
    sprites by alpha, so shadow RGB is irrelevant and left alone.)

Silhouettes are byte-identical: the alpha channel of every colour sprite is
copied through unchanged, and dab overlay alpha is clipped by the sprite alpha
so no stroke ever spills outside the silhouette.

Usage:
  python3 tools/paint_postprocess.py --src ../assets --dst assets
Reads the file list from ../assets/manifest.json (paths resolved against --src).
Deterministic: fixed seeds per file.
"""
import argparse, json, math, os, sys, time
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

INK = np.array([0.10, 0.06, 0.18])  # plum ink, same family as the v2 baker


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def kuwahara(rgb, r):
    """Classic 4-quadrant Kuwahara via summed-area tables. rgb: HxWx3 float 0..1."""
    H, W, _ = rgb.shape
    pad = np.pad(rgb, ((r, r), (r, r), (0, 0)), mode='edge')
    sq = np.pad((rgb ** 2).sum(axis=2), ((r, r), (r, r)), mode='edge')
    sat = np.zeros((pad.shape[0] + 1, pad.shape[1] + 1, 3), np.float64)
    sat[1:, 1:] = pad.cumsum(0).cumsum(1)
    sat2 = np.zeros((sq.shape[0] + 1, sq.shape[1] + 1), np.float64)
    sat2[1:, 1:] = sq.cumsum(0).cumsum(1)

    def box(S, y0, y1, x0, x1):
        # half-open box over padded rows [y0, y1) x cols [x0, x1); SAT index == padded coord
        return S[y1, x1] - S[y0, x1] - S[y1, x0] + S[y0, x0]

    yy, xx = np.mgrid[0:H, 0:W]
    cy, cx = yy + r, xx + r  # centre of each output pixel in padded coords
    best_var = np.full((H, W), 1e18)
    best_mean = np.zeros((H, W, 3), np.float64)
    for (ya, yb, xa, xb) in [(cy - r, cy + 1, cx - r, cx + 1), (cy - r, cy + 1, cx, cx + r + 1),
                             (cy, cy + r + 1, cx - r, cx + 1), (cy, cy + r + 1, cx, cx + r + 1)]:
        n = (yb - ya) * (xb - xa)
        s = box(sat, ya, yb, xa, xb)
        s2 = box(sat2, ya, yb, xa, xb)
        mean = s / n[..., None]
        var = s2 / n - (mean ** 2).sum(axis=2)
        take = var < best_var
        best_var = np.where(take, var, best_var)
        best_mean = np.where(take[..., None], mean, best_mean)
    return best_mean.astype(np.float32)


def orientation_field(gray):
    gx = ndimage.sobel(gray, axis=1)
    gy = ndimage.sobel(gray, axis=0)
    Jxx = ndimage.gaussian_filter(gx * gx, 2.0)
    Jyy = ndimage.gaussian_filter(gy * gy, 2.0)
    Jxy = ndimage.gaussian_filter(gx * gy, 2.0)
    theta = 0.5 * np.arctan2(2 * Jxy, Jxx - Jyy) + np.pi / 2
    coh = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy + 1e-6)
    return theta, np.clip(coh, 0, 1)


def fill_transparent(rgb, alpha):
    """Fill RGB under transparent pixels with a blurred bleed of opaque colour,
    so the Kuwahara pass never pulls black halos in at the silhouette edge."""
    m = (alpha > 10).astype(np.float32)
    if m.min() == 1.0:
        return rgb
    num = ndimage.gaussian_filter(rgb * m[..., None], 3.0)
    den = ndimage.gaussian_filter(m, 3.0)
    filled = num / np.maximum(den, 1e-4)[..., None]
    return np.where(m[..., None] > 0.99, rgb, filled).astype(np.float32)


def dab_pass(base_u8, alpha, theta, coh, *, px_per_dab, len_rng, wid_rng,
             alpha_rng, seed, snap=True, lift_rng=(0.85, 1.17)):
    H, W = alpha.shape
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(overlay)
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(alpha > 140)
    if len(xs) == 0:
        return base_u8
    n = min(len(xs), max(40, int(len(xs) / px_per_dab)))
    idx = rng.choice(len(xs), size=n, replace=False)
    base = base_u8.astype(np.float32)
    for i in idx:
        x, y = int(xs[i]), int(ys[i])
        th = float(theta[y, x])
        if snap and coh[y, x] < 0.25:
            th = round(th / (math.pi / 2)) * (math.pi / 2)
        th += (rng.random() - 0.5) * 0.35
        L = rng.uniform(*len_rng); Wd = rng.uniform(*wid_rng)
        dx, dy = math.cos(th) * L / 2, math.sin(th) * L / 2
        c = base[y, x]
        lift = rng.uniform(*lift_rng)
        col = tuple(int(min(255, max(0, v * lift))) for v in c)
        a = int(rng.uniform(*alpha_rng))
        dr.line([x - dx + 1.2, y - dy + 1.0, x + dx + 1.2, y + dy + 1.0],
                fill=(int(col[0] * 0.70), int(col[1] * 0.66), int(col[2] * 0.82), int(a * 0.45)),
                width=max(1, int(Wd + 1)))
        dr.line([x - dx, y - dy, x + dx, y + dy], fill=col + (a,), width=max(1, int(Wd)))
        if rng.random() < 0.22:
            gc = tuple(int(min(255, v * 1.3 + 14)) for v in col)
            dr.line([x - dx - 0.9, y - dy - 0.7, x + dx - 0.9, y + dy - 0.7],
                    fill=gc + (int(a * 0.5),), width=max(1, int(Wd * 0.4)))
    ov = np.asarray(overlay).astype(np.float32)
    ov[..., 3] *= (alpha / 255.0)  # clip strokes to the silhouette
    oa = ov[..., 3:4] / 255.0
    out = ov[..., :3] * oa + base * (1 - oa)
    return out.astype(np.uint8)


def ink_edge(rgb_u8, alpha, strength):
    er = ndimage.minimum_filter(alpha, size=3)
    edge = np.clip((alpha.astype(np.float32) - er) / 255.0, 0, 1)
    edge = ndimage.gaussian_filter(edge, 0.7)
    m = (edge * strength)[..., None]
    out = rgb_u8.astype(np.float32) * (1 - m) + (INK * 255) * m
    return out.astype(np.uint8)


def paint_colour(img, *, kr, px_per_dab, len_rng, wid_rng, alpha_rng, ink_s, seed,
                 lift_rng=(0.85, 1.17)):
    a = np.asarray(img).astype(np.float32)
    rgb, al = a[..., :3] / 255.0, a[..., 3]
    rgb = fill_transparent(rgb, al)
    flat = kuwahara(rgb, kr)
    m = smoothstep(20, 220, al)[..., None]
    rgb2 = (rgb * (1 - m) + flat * m) * 255.0
    theta, coh = orientation_field(flat @ np.array([0.299, 0.587, 0.114], np.float32))
    rgb3 = dab_pass(rgb2.astype(np.uint8), al, theta, coh,
                    px_per_dab=px_per_dab, len_rng=len_rng, wid_rng=wid_rng,
                    alpha_rng=alpha_rng, seed=seed, lift_rng=lift_rng)
    rgb4 = ink_edge(rgb3, al, ink_s)
    out = np.dstack([rgb4, al.astype(np.uint8)])  # alpha byte-identical
    return Image.fromarray(out, 'RGBA')


def paint_night(img):
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255.0
    flat = kuwahara(a, 2)
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    protect = smoothstep(0.45, 0.75, lum)[..., None]  # keep bright window/glow cores
    out = flat * (1 - protect) + a * protect
    return Image.fromarray((out * 255).astype(np.uint8), 'RGB')


def paint_shadow(img, entry, cols=12):
    """Alpha-only: textured contact patch at the feet + streaks along the cast."""
    a = np.asarray(img).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3].copy()
    H, W = al.shape
    rows = int(math.ceil(16 * 3 / cols))
    cw, ch = W // cols, H // rows
    ox, oy = entry['ox'], entry['oy']  # world units; anchor px = (-ox, -oy) * px/unit
    pxu = cw / entry['w']              # px per world unit in this sheet
    ax, ay = -ox * pxu, -oy * pxu
    for r in range(rows):
        for c in range(cols):
            cell = al[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            if cell.max() < 8:
                continue
            ys, xs = np.nonzero(cell > 40)
            wts = cell[ys, xs]
            cxm = float((xs * wts).sum() / wts.sum()); cym = float((ys * wts).sum() / wts.sum())
            dx, dy = cxm - ax, cym - ay
            L = math.hypot(dx, dy) or 1.0
            dx, dy = dx / L, dy / L
            px, py = -dy, dx  # perpendicular
            yy, xx = np.mgrid[0:ch, 0:cw]
            along = (xx - ax) * dx + (yy - ay) * dy
            perp = (xx - ax) * px + (yy - ay) * py
            streak = 0.84 + 0.16 * np.sin(perp * 1.9 + along * 0.33)
            # streak breakup on the cast shadow (not at the contact point itself)
            far = smoothstep(5, 12, np.abs(along) + np.abs(perp) * 0.4)
            cell2 = cell * (1 - far * 0.16 * (0.5 + 0.5 * np.sin(perp * 1.9 + along * 0.33)))
            # textured contact patch: denser alpha right at the feet, broken by streaks
            patch = np.exp(-((along / 8.5) ** 2) - ((perp / 5.5) ** 2)) * 238 * (0.78 + 0.22 * np.sin(perp * 2.3 + 1.1))
            near = np.exp(-(((along) / 16) ** 2) - ((perp / 11) ** 2))
            cell2 = np.where(near > 0.25, np.maximum(cell2, patch), cell2)
            al[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] = np.clip(cell2, 0, 255)
    out = np.dstack([rgb, al]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--dst', required=True)
    ap.add_argument('--kinds', default='bld,night,ped,pedsh')
    args = ap.parse_args()
    kinds = set(args.kinds.split(','))
    M = json.load(open(os.path.join(args.src, 'manifest.json')))
    os.makedirs(args.dst, exist_ok=True)
    jobs = []  # (kind, filename, entry)
    for name, e in M['buildings'].items():
        jobs.append(('bld', e['color']['file'], e))
        jobs.append(('night', e['night']['file'], e))
    for name, e in M['peds'].items():
        jobs.append(('ped', e['color']['file'], e))
        jobs.append(('pedsh', e['shadow']['file'], e))
    jobs = [j for j in jobs if j[0] in kinds]
    t0 = time.time()
    for i, (kind, fn, e) in enumerate(jobs):
        src = os.path.join(args.src, fn)
        dst = os.path.join(args.dst, fn)
        img = Image.open(src)
        if kind == 'bld':
            out = paint_colour(img, kr=3, px_per_dab=40, len_rng=(11, 20),
                               wid_rng=(3.6, 5.8), alpha_rng=(100, 168), ink_s=0.26,
                               seed=1000 + i, lift_rng=(0.80, 1.24))
        elif kind == 'night':
            out = paint_night(img)
        elif kind == 'ped':
            out = paint_colour(img, kr=2, px_per_dab=22, len_rng=(4, 8),
                               wid_rng=(1.6, 2.6), alpha_rng=(70, 120), ink_s=0.18, seed=2000 + i)
        else:
            out = paint_shadow(img, e['shadow'])
        out.save(dst, 'WEBP', quality=88, method=6)
        print(f"{kind:6s} {fn:28s} {os.path.getsize(src):7d} -> {os.path.getsize(dst):7d} B")
    print(f"{len(jobs)} files in {time.time() - t0:.1f}s")


if __name__ == '__main__':
    main()

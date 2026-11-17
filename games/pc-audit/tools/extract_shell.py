#!/usr/bin/env python3
"""
extract_shell.py — build shell.json (the Palm City world-extension surface
grid + road traces) from Fable's extracted land/water mask, sheets/sheet-4.jpg.

COORDINATE MAPPING (verified from the mask itself, not assumed):
  * The mask is 1320x660 px. Cream grid lines (colour ~ (255,225,199)) sit at
    px 0, 120, 240, ... i.e. every 120 px, and the yellow axis labels printed
    next to them read, left to right:  -4400, -4000, -3600, ..., -400
    (top axis) and 0, 400, 800, ..., 2000 (left axis, top to bottom).
  * So: 120 px = 400 game units  ->  1 px = 10/3 units, 3 px = 10 units.
  * Pixel (0,0) is game (-4400, 0); +x runs east (right), +y runs south
    (down) — the same y-down convention as layout.json. The mask's right
    edge is game x = 0 (the core world's west edge) and its bottom edge is
    y = 2200 (the core world's full height). The shell therefore occupies
    x in [-4400, 0], y in [0, 2200], immediately west of the core.
  * Cross-checks: the port island's NW tip lands at game (-2560, 855),
    Watson Island at (-2700..-2150, 230..780), Brickell Key's triangle at
    (-3500..-3200, 1500..1950) — all matching sheets 1-3.

CELL SIZE: the mask is a continuous raster (class boundaries fall at all
pixel phases — it was rendered from geographic polygons, not from a coarse
grid), so the cell size is OUR choice. We sample at 3 px = 10 game units
(1 unit = 10 cm, so a cell is 1 m), majority vote per cell, ignoring the
cream grid-line and yellow label pixels. Grid: 440 cols x 220 rows.
Shoreline error is up to ~1 cell (10 units = 1 m) plus JPEG bleed.

CLASS COLOURS in the mask (medians of flat regions):
  land (tan)  (215,150,110)   water (blue) (60,120,170)   park (green) (96,157,80)
Class codes in shell.json: 0 = water, 1 = land, 2 = park.
Grid is row-major, row 0 = north edge (y=0), one string of digits per row.

ROADS: hand-traced polylines in game coordinates. The MacArthur Causeway
centreline was pinned to the thin land strip the mask actually draws
(column scans: strip centre y=807 at x=-2100 rising ~0.48 units/unit to
y=1378 at x=-900; strip is 9-12 px = 30-40 units wide; the west segment
runs at y~308, 33-57 units wide). Port Boulevard is traced along the port
island's long axis. The Venetian Causeway follows the straight real-world
alignment along the island chain's south shore (sheet-1/sheet-3) — NOTE:
the mask does NOT draw a roadway between the Venetian islands, so that
polyline crosses open-water grid cells in the gaps; integration must paint
the road (and a land strip beneath it) from the polyline, not the grid.
Road widths are gameplay widths in game units (core loop roads are 96).

Run:  python3 tools/extract_shell.py        (from the palm-city-extension dir)
Writes: shell.json, sheets/verification.png, sheets/phone_crop.png
"""

import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MASK_PATH = os.path.join(ROOT, "sheets", "sheet-4.jpg")
SAT_PATH = os.path.join(ROOT, "sheets", "sheet-3.jpg")
OUT_PATH = os.path.join(ROOT, "shell.json")

# --- mapping constants (see docstring) -------------------------------------
PX_PER_UNIT = 0.3                 # 3 px = 10 units
ORIGIN_X, ORIGIN_Y = -4400, 0     # game coords of pixel (0,0)
CELL_PX = 3                       # 3 px cells -> 10 game units per cell
CELL = 10                         # game units per cell

CENTROIDS = {0: (60, 120, 170),   # water
             1: (215, 150, 110),  # land
             2: (96, 157, 80)}    # park

# --- road traces (game coordinates, hand-traced — see docstring) ------------
ROADS = [
    {
        "name": "macarthur_causeway",
        "width": 48,
        "points": [
            [-3140, 308], [-2900, 308], [-2730, 300], [-2560, 330],
            [-2400, 430], [-2280, 580], [-2180, 720], [-2150, 783],
            [-2100, 807], [-1900, 902], [-1700, 998], [-1500, 1095],
            [-1300, 1195], [-1100, 1287], [-900, 1378], [-760, 1435],
            [-600, 1445], [-450, 1380], [-320, 1305], [-245, 1275],
        ],
    },
    {
        "name": "port_boulevard",
        "width": 48,
        "points": [
            [-3220, 800], [-3000, 802], [-2800, 812], [-2620, 838],
            [-2560, 855], [-2350, 1010], [-2050, 1180], [-1750, 1330],
            [-1450, 1470], [-1150, 1590], [-880, 1680], [-650, 1750],
            [-470, 1795],
        ],
    },
    {
        "name": "venetian_causeway",
        "width": 40,
        "points": [
            [-3080, 170], [-2700, 168], [-2300, 166], [-1900, 166],
            [-1500, 168], [-1100, 170], [-750, 175], [-450, 172],
            [-250, 170],
        ],
    },
]


def classify(a):
    """Nearest-centroid class per pixel; also returns a 'bad pixel' mask
    (cream grid lines + yellow labels) to exclude from cell votes."""
    d = np.stack([np.abs(a - np.array(c)).sum(axis=2) for c in
                  (CENTROIDS[0], CENTROIDS[1], CENTROIDS[2])])
    cls = d.argmin(axis=0)
    cream = np.abs(a - np.array([255, 225, 199])).sum(axis=2) < 90
    yellow = (a[:, :, 0] > 200) & (a[:, :, 1] > 170) & (a[:, :, 2] < 120)
    return cls, cream | yellow


def extract_grid(a):
    cls, bad = classify(a)
    h, w = cls.shape
    rows, cols = h // CELL_PX, w // CELL_PX
    grid = []
    for r in range(rows):
        chars = []
        for c in range(cols):
            cell = cls[r * CELL_PX:(r + 1) * CELL_PX, c * CELL_PX:(c + 1) * CELL_PX]
            ok = ~bad[r * CELL_PX:(r + 1) * CELL_PX, c * CELL_PX:(c + 1) * CELL_PX]
            vals = cell[ok] if ok.any() else cell.ravel()
            chars.append(str(np.bincount(vals, minlength=3).argmax()))
        grid.append("".join(chars))
    return grid, cols, rows


def despeckle(grid, cols, rows):
    """Majority-clean isolated cells: a cell that has NO neighbour of its own
    class (a lone speck of land in the bay, or a lone water pixel inside a
    landmass — JPEG/mask noise) adopts the majority class of its 8 neighbours.
    Decided from the pre-pass grid for every cell, so the result does not
    depend on scan order. Returns (clean_grid, n_changed)."""
    src = [list(row) for row in grid]
    changed = 0
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            me = src[r][c]
            nb = [src[rr][cc] for rr in range(max(0, r - 1), min(rows, r + 2))
                  for cc in range(max(0, c - 1), min(cols, c + 2))
                  if (rr, cc) != (r, c)]
            if nb and me not in nb:
                row.append(max("012", key=nb.count))
                changed += 1
            else:
                row.append(me)
        out.append("".join(row))
    return out, changed


def game_to_cell(gx, gy):
    return int((gx - ORIGIN_X) // CELL), int((gy - ORIGIN_Y) // CELL)


def validate_roads(grid, cols, rows):
    """Sample each polyline every ~5 units; report the share of samples that
    land on a non-water cell. Causeways SHOULD score high where the mask
    draws the strip; the Venetian trace is expected to dip in the gaps."""
    report = {}
    for road in ROADS:
        on, tot = 0, 0
        pts = road["points"]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 5))
            for i in range(n):
                gx, gy = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
                c, r = game_to_cell(gx, gy)
                if 0 <= c < cols and 0 <= r < rows:
                    tot += 1
                    if grid[r][c] != "0":
                        on += 1
        report[road["name"]] = round(on / tot, 3) if tot else None
    return report


# --- verification renders ----------------------------------------------------

# Landmarks: mask px <-> satellite px (port island NW + SE tips, Watson
# Island N tip, Brickell Key S tip, Fisher Island centre, MacArthur
# landfall on Miami Beach). Satellite points from visual grounding of
# sheet-3; mask points hand-verified against the classified mask (naive
# extremum scans and one grounding pass both grabbed neighbouring
# features for the small islands, so these were settled by eye on the
# labelled grid crops). Residuals are printed when the script runs and
# quoted in INTEGRATION.md — the overlay is a by-eye verification aid,
# not a survey.
LANDMARKS_MASK = [(520, 248), (1200, 542), (555, 78), (330, 580),
                  (1155, 463), (1245, 381)]
LANDMARKS_SAT = [(409, 426), (990, 671), (479, 312), (334, 729),
                 (1027, 792), (1043, 550)]

CLASS_RGB = {0: (60, 120, 170), 1: (215, 150, 110), 2: (96, 157, 80)}


def fit_affine(src, dst):
    """Least-squares affine src->dst. Returns 2x3 matrix."""
    A, B = [], []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0]); B.append(u)
        A.append([0, 0, 0, x, y, 1]); B.append(v)
    sol, *_ = np.linalg.lstsq(np.array(A, float), np.array(B, float), rcond=None)
    return sol.reshape(2, 3)


def render_verification(grid, cols, rows):
    # flat grid image in mask pixel space
    flat = np.zeros((rows * CELL_PX, cols * CELL_PX, 3), dtype=np.uint8)
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            flat[r * CELL_PX:(r + 1) * CELL_PX, c * CELL_PX:(c + 1) * CELL_PX] = CLASS_RGB[int(ch)]
    overlay = Image.fromarray(flat, "RGB")

    sat = Image.open(SAT_PATH).convert("RGB")
    # Fit on the four northern landmarks only (port tips, Watson, MacArthur
    # landfall): they agree to ~7 sat px. The two southern landmarks
    # (Brickell Key, Fisher Island) sit 130-200 px off ANY affine that fits
    # the north — the mask's southern geography is not affine-consistent
    # with the satellite (hand-stretched when the mask was built), so the
    # overlay is trustworthy along the causeway corridor and only
    # indicative south of the port. Residuals for all six are printed.
    keep = [0, 1, 2, 5]
    M = fit_affine([LANDMARKS_MASK[i] for i in keep],
                   [LANDMARKS_SAT[i] for i in keep])       # mask -> sat
    pred = np.array(LANDMARKS_MASK) @ M[:, :2].T + M[:, 2]
    resid = np.hypot(*(pred - np.array(LANDMARKS_SAT)).T)
    Minv = np.linalg.inv(np.vstack([M, [0, 0, 1]]))[:2]    # sat -> mask
    # PIL AFFINE maps output px -> input px, so feed it Minv (sat->mask)
    warped = overlay.transform(sat.size, Image.AFFINE,
                               tuple(Minv.ravel()), resample=Image.BILINEAR)
    base = sat.copy()
    base.paste(warped, (0, 0), warped.convert("L").point(lambda v: 110))
    dr = ImageDraw.Draw(base)
    for road in ROADS:
        pts = []
        for gx, gy in road["points"]:
            px, py = (gx - ORIGIN_X) * PX_PER_UNIT, (gy - ORIGIN_Y) * PX_PER_UNIT
            u, v = M @ np.array([px, py, 1.0])
            pts.append((u, v))
        dr.line(pts, fill=(255, 255, 255), width=5)
        dr.line(pts, fill=(230, 30, 30), width=2)
    out = os.path.join(ROOT, "sheets", "verification.png")
    base.save(out)
    return out, resid


def render_phone_crop(grid):
    """Grid alone at 1 unit = 1 px, cropped to a 420x860 phone frame over
    the MacArthur / Watson Island / Port Blvd junction area."""
    scale = CELL // 1  # grid cell = 10 units -> draw each cell 10x10 px
    W, H = 440 * scale, 220 * scale
    img = Image.new("RGB", (W, H))
    dr = ImageDraw.Draw(img)
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            dr.rectangle([c * scale, r * scale, (c + 1) * scale - 1, (r + 1) * scale - 1],
                         fill=CLASS_RGB[int(ch)])
    for road in ROADS:
        pts = [(gx - ORIGIN_X, gy - ORIGIN_Y) for gx, gy in road["points"]]
        dr.line(pts, fill=(230, 30, 30), width=max(4, road["width"] // 2))
    # crop: game x -3050..-2630 (420 wide), y 240..1100 (860 tall)
    x0, y0 = -3050 - ORIGIN_X, 240 - ORIGIN_Y
    crop = img.crop((x0, y0, x0 + 420, y0 + 860))
    out = os.path.join(ROOT, "sheets", "phone_crop.png")
    crop.save(out)
    return out


def main():
    a = np.asarray(Image.open(MASK_PATH).convert("RGB")).astype(int)
    grid, cols, rows = extract_grid(a)
    before = {k: sum(row.count(k) for row in grid) for k in "012"}
    grid, n_changed = despeckle(grid, cols, rows)
    after = {k: sum(row.count(k) for row in grid) for k in "012"}
    validation = validate_roads(grid, cols, rows)
    shell = {
        "source": "sheets/sheet-4.jpg (Fable mask) via tools/extract_shell.py",
        "origin": [ORIGIN_X, ORIGIN_Y],
        "cellSize": CELL,
        "cols": cols,
        "rows": rows,
        "classes": {"0": "water", "1": "land", "2": "park"},
        "grid": grid,
        "roads": ROADS,
        "validation_onLandShare": validation,
        "despeckle": {"changed": n_changed, "before": before, "after": after},
    }
    with open(OUT_PATH, "w") as f:
        json.dump(shell, f, indent=1)
    ver, resid = render_verification(grid, cols, rows)
    phone = render_phone_crop(grid)
    counts = after
    print(f"grid {cols}x{rows} cells of {CELL} units; origin ({ORIGIN_X},{ORIGIN_Y})")
    print(f"despeckle: {n_changed} isolated cells cleaned; counts {before} -> {after}")
    print(f"class counts: water={counts['0']} land={counts['1']} park={counts['2']}")
    print(f"road on-land sample shares: {validation}")
    print(f"verification landmark residuals (sat px): {np.round(resid, 1)}")
    print(f"wrote {OUT_PATH}\nwrote {ver}\nwrote {phone}")


if __name__ == "__main__":
    main()

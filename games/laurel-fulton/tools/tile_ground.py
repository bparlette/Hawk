#!/usr/bin/env python3
"""tile_ground.py — cut assets/ground-painted.webp into chunk-aligned tiles for
lazy loading (assets/ground-tiles/), plus the manifest the painter reads.

Tile scheme: one tile = 16x16 ground chunks = 4096x4096 world units. Justified
by the numbers: the painting runs ~0.2266 px per world unit (fitted, see
tools/fit_painted.py), so a tile is ~928x933 px of source — big enough that one
fetch covers a whole neighbourhood (~6.6 km of driving across at chase zoom is
~35 view-widths), small enough that a fetch is ~100 KB and a decoded tile is
~3.5 MB of RAM. 1 chunk/tile would be 21,600 files of ~58 px; 32x32 chunks
would fetch ~4x the bytes per neighbourhood and decode ~14 MB per tile.
The world (graph bounds x -20717..20717, y -26806..26806) needs 12x14 = 168.

The world->painting mapping baked into the manifest is the MEASURED fit from
tools/fit_painted.py (per-landmark residuals <= 1.5 px), not the doc's nominal
projection (whose y scale drifted -23..+15 px across the map).

Tiles are padded with the painting's border colour where the tile's rect runs
past the painting's edge, so one uniform affine serves every tile: tile pixel
(0,0) is always manifest px (x0,y0).

    python3 tools/tile_ground.py     (from games/laurel-fulton/)
"""
import json, math, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'ground-painted.webp')
OUTDIR = os.path.join(ROOT, 'assets', 'ground-tiles')

# measured fit (tools/fit_painted.py, Nov 18): painting px = a * world + b
MAP = { 'ax': 0.2262565382743139, 'bx': 4959.311393070457,
        'ay': 0.22786453338910145, 'by': 6397.773362290142 }
TILE_WORLD = 4096                      # 16 chunks x 256 units
QUALITY = 80

G = json.load(open(os.path.join(ROOT, 'data', 'graph.json')))
xs = [p[0] for e in G['edges'] for p in e['pts']]; ys = [p[1] for e in G['edges'] for p in e['pts']]
BX0, BX1, BY0, BY1 = min(xs), max(xs), min(ys), max(ys)
print(f'graph bounds: x {BX0:.0f}..{BX1:.0f}  y {BY0:.0f}..{BY1:.0f}')

im = Image.open(SRC).convert('RGB')
Wpx, Hpx = im.size
# pad colour: median of the painting's outer frame
import numpy as np
fr = np.concatenate([np.asarray(im.crop((0, 0, Wpx, 8))).reshape(-1, 3),
                     np.asarray(im.crop((0, Hpx - 8, Wpx, Hpx))).reshape(-1, 3),
                     np.asarray(im.crop((0, 0, 8, Hpx))).reshape(-1, 3),
                     np.asarray(im.crop((Wpx - 8, 0, Wpx, Hpx))).reshape(-1, 3)])
pad = tuple(int(v) for v in np.median(fr, axis=0))
print(f'painting {Wpx}x{Hpx}, pad colour {pad}')

os.makedirs(OUTDIR, exist_ok=True)
tiles = {}
total = 0
tx0, tx1 = math.floor(BX0 / TILE_WORLD), math.floor(BX1 / TILE_WORLD)
ty0, ty1 = math.floor(BY0 / TILE_WORLD), math.floor(BY1 / TILE_WORLD)
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        wx0, wy0 = tx * TILE_WORLD, ty * TILE_WORLD
        px0 = math.floor(MAP['ax'] * wx0 + MAP['bx']); px1 = math.ceil(MAP['ax'] * (wx0 + TILE_WORLD) + MAP['bx'])
        py0 = math.floor(MAP['ay'] * wy0 + MAP['by']); py1 = math.ceil(MAP['ay'] * (wy0 + TILE_WORLD) + MAP['by'])
        tile = Image.new('RGB', (px1 - px0, py1 - py0), pad)
        cx0, cy0 = max(px0, 0), max(py0, 0); cx1, cy1 = min(px1, Wpx), min(py1, Hpx)
        if cx1 > cx0 and cy1 > cy0:
            tile.paste(im.crop((cx0, cy0, cx1, cy1)), (cx0 - px0, cy0 - py0))
        f = f't_{tx}_{ty}.webp'
        tile.save(os.path.join(OUTDIR, f), 'WEBP', quality=QUALITY, method=4)
        total += os.path.getsize(os.path.join(OUTDIR, f))
        tiles[f'{tx},{ty}'] = { 'f': f, 'px': [px0, py0, px1, py1] }

man = { 'v': 1, 'tileWorld': TILE_WORLD, 'map': MAP, 'img': [Wpx, Hpx], 'tiles': tiles }
with open(os.path.join(OUTDIR, 'manifest.json'), 'w') as fh: json.dump(man, fh)
print(f'{len(tiles)} tiles, {total / 1e6:.2f} MB total, avg {total / len(tiles) / 1024:.0f} KB/tile -> {OUTDIR}')

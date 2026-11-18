#!/usr/bin/env python3
"""ground_tiles.py — load pass (Nov 18): cut the painted satellite ground (assets/ground-painted.webp, 9920x12800, 16 MB) into
1024 px WebP tiles (assets/ground-tiles/<col>_<row>.webp + index.json) so the game fetches ONLY the few tiles near the player
(~110 KB each) instead of the whole 16 MB. Wire-up: load index.json, and request tile (floor(px / tile), floor(py / tile))
for the pixels under the view + a margin, nearest first, as lf_ground's chunk painter already does for its own chunks.
  python3 tools/ground_tiles.py          (from games/laurel-fulton/; re-run when the painted pass changes)"""
import os, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
A = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
im = Image.open(os.path.join(A, 'ground-painted.webp')).convert('RGB'); W, H = im.size; T = 1024
os.makedirs(os.path.join(A, 'ground-tiles'), exist_ok=True); cols, rows, tot = -(-W // T), -(-H // T), 0
for r in range(rows):
    for c in range(cols):
        p = os.path.join(A, 'ground-tiles', f'{c}_{r}.webp'); im.crop((c * T, r * T, min(W, (c + 1) * T), min(H, (r + 1) * T))).save(p, quality=80, method=4); tot += os.path.getsize(p)
json.dump({'src': 'ground-painted.webp', 'w': W, 'h': H, 'tile': T, 'cols': cols, 'rows': rows}, open(os.path.join(A, 'ground-tiles', 'index.json'), 'w'))
print(f'{cols * rows} tiles, {tot // 1024} KB total, ~{tot // cols // rows // 1024} KB each')

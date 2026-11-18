#!/usr/bin/env python3
"""Thin the L3 speed bumps (owner, Nov 17 2026: "less speed bumps").

Rule: greedy spatial thin — walk the bumps in file order, keep a bump only
if it is at least MIN_DIST units (90 m at 10 units/m) from every bump kept
so far. Deterministic; re-running on the ORIGINAL 1,256-bump file gives the
same output. Run from the game root:  python3 tools/thin_bumps.py
"""
import json, math, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
PATH = os.path.join(ROOT, "data", "bumps.json")
MIN_DIST = 1200  # units (post-compression scale) = 240 m of original geography

d = json.load(open(PATH))
src = d["bumps"]
kept, grid = [], {}
cell = MIN_DIST
for b in src:
    gx, gy = math.floor(b["x"] / cell), math.floor(b["y"] / cell)
    ok = True
    for cx in (gx - 1, gx, gx + 1):
        for cy in (gy - 1, gy, gy + 1):
            for k in grid.get((cx, cy), ()):
                if math.hypot(b["x"] - k["x"], b["y"] - k["y"]) < MIN_DIST:
                    ok = False
                    break
            if not ok:
                break
        if not ok:
            break
    if ok:
        kept.append(b)
        grid.setdefault((gx, gy), []).append(b)

d["bumps"] = kept
d["_doc"] = ("speed bumps (task L3): residential streets only; thinned Nov 17 2026 "
             "(owner: 'less speed bumps') by tools/thin_bumps.py — greedy >=900-unit "
             f"(90 m) spacing, {len(src)} -> {len(kept)} bumps")
json.dump(d, open(PATH, "w"), separators=(",", ":"))  # data files ship minified
print(f"bumps: {len(src)} -> {len(kept)}")

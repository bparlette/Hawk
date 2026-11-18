#!/usr/bin/env python3
"""Compress the Laurel/Fulton world x0.5 (owner, Nov 17 2026: "every road
maybe 1/2 the current length"). Uniform scale of every world coordinate:
graph verts + edge polylines + edge lengths + anchors, areas polygons
(buildings/parking/green), bumps, roster houses + meetup. Road WIDTHS,
car sizes, speeds and camera zooms are untouched — the world is a
half-scale miniature; trips take half the time. Originals are kept as
data/*.full-scale.bak. Run ONCE from the game root:
    python3 tools/compress_map.py
"""
import json, os, shutil

ROOT = os.path.join(os.path.dirname(__file__), "..")
S = 0.5

def load(name):
    """Idempotent: always start from the full-scale backup (created on first run).
    Coordinates are rounded to 1 decimal — the source data's own precision —
    so halving doesn't bloat the files with binary float tails."""
    p = os.path.join(ROOT, "data", name)
    bak = p + ".full-scale.bak"
    if not os.path.exists(bak):
        shutil.copyfile(p, bak)
    return p, json.load(open(bak))

def r1(n):
    return round(n * S, 1)

def save(p, d):
    json.dump(d, open(p, "w"), separators=(",", ":"))  # the data files ship minified

def ri(n):
    """r1, but integral results stay ints (areas.json's all-int style)."""
    v = r1(n)
    return int(v) if float(v).is_integer() else v

# graph
p, g = load("graph.json")
for v in g["verts"]:
    v["x"] = r1(v["x"]); v["y"] = r1(v["y"])
for e in g["edges"]:
    e["pts"] = [[r1(x), r1(y)] for x, y in e["pts"]]
    if "len" in e: e["len"] = r1(e["len"])
for a in g["anchors"].values():
    a["x"] = r1(a["x"]); a["y"] = r1(a["y"])
    if "snap_m" in a: a["snap_m"] = r1(a["snap_m"])
save(p, g)
xs = [v["x"] for v in g["verts"]]
print(f"graph: x span {min(xs):.0f}..{max(xs):.0f}")

# areas (flat [x,y,...] polygons)
p, a = load("areas.json")
for kind in ("buildings", "parking", "green"):
    a[kind] = [[ri(n) for n in poly] for poly in a[kind]]
save(p, a)
print(f"areas: {len(a['buildings'])} buildings scaled")

# bumps (positions only; width w is across the road — roads keep their width)
p, b = load("bumps.json")
for bump in b["bumps"]:
    bump["x"] = r1(bump["x"]); bump["y"] = r1(bump["y"])
save(p, b)
print(f"bumps: {len(b['bumps'])} scaled")

# roster (house + meetup in world units; lat/lon are geography — unchanged)
p, r = load("roster.json")
for person in r["people"]:
    person["house"] = [r1(person["house"][0]), r1(person["house"][1])]
if "meetup" in r and "pos" in r["meetup"]:
    r["meetup"]["pos"] = [r1(r["meetup"]["pos"][0]), r1(r["meetup"]["pos"][1])]
save(p, r)
print(f"roster: {len(r['people'])} houses scaled")
print("DONE — world is now x0.5. Backups: data/*.full-scale.bak")

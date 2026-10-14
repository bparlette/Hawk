#!/usr/bin/env python3
"""Publish blox-dough-raid-plus to bparlette/Hawk main:/brad-demos/ (GitHub Pages) + keep the local demos manifest in sync.
Run under: flock /workspace/work/demos/.edit.lock python3 publish.py"""
import json, os, shutil, subprocess, sys, time
from PIL import Image
HERE = "/workspace/work/blox-raid"; DEMOS = "/workspace/work/demos"; HAWK = HERE + "/hawk"
ID = "blox-dough-raid-plus"
def sh(*a, cwd=HAWK, check=True):
    r = subprocess.run(a, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode: print("FAIL", a, r.stdout, r.stderr); sys.exit(1)
    return r.stdout.strip()

# 0. pub folder + thumbnail
pub = HERE + "/pub"; os.makedirs(pub, exist_ok=True)
shutil.copy2(HERE + "/index.html", pub + "/index.html"); shutil.copy2(HERE + "/three.r128.min.js", pub + "/three.r128.min.js")
im = Image.open(HERE + "/shots/desk-12-phase2-storm.png"); w, h = im.size
cw, ch = 880, 550; x = (w - cw) // 2; y = 28
im.crop((x, y, x + cw, y + ch)).resize((320, 200), Image.LANCZOS).save(HERE + "/thumb.webp", "WEBP", quality=82)

ENTRY = {
  "id": ID, "title": "★ Blox Fruits: Dough Raid — Turtles Edition", "category": "Other games",
  "keys": {"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD", "attack": "KeyZ", "jump": "Space", "special": "KeyX", "start": "Enter"},
  "labels": {"attack": "Z JAB", "jump": "SORU", "special": "X RIVER", "start": "FIGHT"},
  "extras": [{"label": "C ROLL", "key": "KeyC"}, {"label": "V FISTS", "key": "KeyV"}, {"label": "MUTE", "key": "KeyM"}],
  "autostart": [], "orientation": "any",
  "note": "Featured remake of the Painted Anime Edition: real boss fight (telegraphed AOEs, phase 2, KO/victory), articulated rigs, energy costs, touch controls. Boots in the 9:16 auto-combo; Enter/any move key = manual fight.",
}

# 1. Hawk (GitHub Pages serves main:/)
for attempt in range(4):
    sh("git", "fetch", "-q", "--depth", "1", "origin", "main"); sh("git", "reset", "-q", "--hard", "FETCH_HEAD")
    sh("git", "sparse-checkout", "add", "/brad-demos/g/" + ID + "/", "/brad-demos/thumbs/" + ID + ".webp")
    sys.path.insert(0, DEMOS); import build
    build.SITE = HAWK + "/brad-demos"
    build.copy_game({"id": ID, "source": pub, "embed": ""})
    os.makedirs(HAWK + "/brad-demos/thumbs", exist_ok=True)
    tdst = HAWK + "/brad-demos/thumbs/" + ID + ".webp"; shutil.copy2(HERE + "/thumb.webp", tdst)
    gj = HAWK + "/brad-demos/games.json"; man = json.load(open(gj, encoding="utf-8"))   # re-read right before editing
    r = dict(ENTRY); r["path"] = "g/" + ID + "/index.html"; r["thumb"] = "thumbs/" + ID + ".webp?v=" + str(int(time.time()))
    games = [g for g in man["games"] if g["id"] != ID]
    # featured: directly before the original if it is listed, else first in its category
    idx = next((i for i, g in enumerate(games) if g["id"] == "blox-dough-raid"), None)
    if idx is None: idx = next((i for i, g in enumerate(games) if g.get("category") == r["category"]), len(games))
    games.insert(idx, r); man["games"] = games
    if r["category"] not in man["categories"]: man["categories"].append(r["category"])
    json.dump(man, open(gj, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    sh("git", "add", "brad-demos/g/" + ID, "brad-demos/thumbs/" + ID + ".webp", "brad-demos/games.json")
    sh("git", "-c", "user.name=Hark", "-c", "user.email=hark@hark.local", "commit", "-qm", "Brad's Demos: add Blox Fruits: Dough Raid — Turtles Edition (blox-dough-raid-plus)")
    p = subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=HAWK, capture_output=True, text=True)
    if p.returncode == 0: print("PUSHED", sh("git", "rev-parse", "HEAD")); break
    print("push rejected, retrying", p.stderr[-300:])
else:
    print("PUSH_FAILED"); sys.exit(1)

# 2. local demos manifest (source of truth for build.py) — re-read right before editing; no deploy/sync here
sp = DEMOS + "/src/games.json"; m = json.load(open(sp, encoding="utf-8"))
g = {k: v for k, v in ENTRY.items()}; g.update({"source": pub, "query": "", "embed": ""})
games = [x for x in m["games"] if x["id"] != ID]
idx = next((i for i, x in enumerate(games) if x["id"] == "blox-dough-raid"), None)
if idx is None: idx = next((i for i, x in enumerate(games) if x.get("category") == g["category"]), len(games))
games.insert(idx, g); m["games"] = games
json.dump(m, open(sp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
shutil.copy2(HERE + "/thumb.webp", DEMOS + "/src/thumbs/" + ID + ".webp")
print(sh("python3", "build.py", "--resync", ID, cwd=DEMOS)[-300:])
print("LOCAL_OK")

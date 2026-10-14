#!/usr/bin/env python3
# merge.py <demos-root> [--src] : copy build into <root>/g/<id>/ (demo-embed header), thumb, insert entry before socal-summer-games.
# --src: local demos/src manifest (adds source field, no game copy).
import json, os, re, shutil, sys, time
P = "/workspace/work/socal-painted"; ID = "socal-summer-games-plus"
root = sys.argv[1]; src = "--src" in sys.argv
e = {
  "id": ID, "title": "★ California Games Remastered — Hark Edition (fan remake)", "category": "Originals",
  "keys": {"up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight", "attack": "KeyZ", "jump": "KeyX", "special": "KeyC", "start": "Enter", "select": "KeyP"},
  "labels": {"attack": "A", "jump": "B", "special": "C", "start": "START", "select": "PAUSE"},
  "extras": [{"label": "16-BIT", "key": "KeyH"}, {"label": "MUTE", "key": "KeyM"}],
  "autostart": [], "orientation": "any",
  "note": "Hark fan remaster of Epyx's 1987 California Games (2026-10-14): Half Pipe, Foot Bag, Surfing, Roller Skating, BMX, Flying Disk with the original rules, names/sponsors, trophies 5/3/1 and a champion. Cel-shaded three.js r160, original music. H = 16-bit mode. Boots in attract; any key/tap opens the menu. Source: /workspace/work/socal-painted/src",
  "path": "g/" + ID + "/index.html", "thumb": "thumbs/" + ID + ".webp?v=" + str(int(time.time())),
}
if src:
    for k in ("path", "thumb"): e.pop(k)
    e.update({"source": P + "/build", "query": "", "embed": ""})
if not src:
    d = os.path.join(root, "g", ID)
    if os.path.isdir(d): shutil.rmtree(d)
    os.makedirs(d)
    shutil.copy2(P + "/build/three.module.min.js", d)
    html = open(P + "/build/index.html", encoding="utf-8").read()
    inj = '<script src="../../demo-embed.js"></script>\n<style id="demo-embed-css">\n</style>\n'
    html, n = re.subn(r'(<meta charset="UTF-8">\n)', lambda m: m.group(1) + inj, html, count=1)
    if n != 1: print("HEADER_INJECT_FAIL"); sys.exit(1)
    open(d + "/index.html", "w", encoding="utf-8").write(html)
os.makedirs(os.path.join(root, "thumbs"), exist_ok=True)
shutil.copy2(P + "/thumbs/" + ID + ".webp", os.path.join(root, "thumbs", ID + ".webp"))
gj = os.path.join(root, "games.json"); raw = open(gj, encoding="utf-8").read(); m = json.loads(raw)  # re-read right before editing
ids = [g["id"] for g in m["games"]]
if ID in ids: m["games"][ids.index(ID)] = e
else:
    i = ids.index("socal-summer-games") if "socal-summer-games" in ids else len(ids)
    m["games"].insert(i, e)
if e["category"] not in m["categories"]: m["categories"].append(e["category"])
json.dump(m, open(gj, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
if raw.endswith("\n"): open(gj, "a", encoding="utf-8").write("\n")
print("merged", root, len(m["games"]))

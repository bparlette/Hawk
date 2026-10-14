#!/usr/bin/env python3
"""Publish survivors-plus to bparlette/Hawk main:/brad-demos/ (GitHub Pages) and keep the local demos manifest in sync.
Run under: flock /workspace/work/demos/.edit.lock python3 publish.py [thumb.png]
Pushes ONLY brad-demos/g/survivors-plus/, brad-demos/thumbs/survivors-plus.webp and brad-demos/games.json (re-read from main first).
Never runs sync-main.sh or a deploy sync."""
import json, os, shutil, subprocess, sys, time
from PIL import Image
HERE = "/workspace/work/survivors-plus"; DEMOS = "/workspace/work/demos"; HAWK = HERE + "/hawk"; GAME = HERE + "/game"
ID = "survivors-plus"
def sh(*a, cwd=HAWK, check=True):
    r = subprocess.run(a, cwd=cwd, capture_output=True, text=True, timeout=110)
    if check and r.returncode: print("FAIL", a, r.stdout[-400:], r.stderr[-400:]); sys.exit(1)
    return r.stdout.strip()

# 0. pub folder + thumbnail (320x200 webp, centre crop of a real gameplay frame)
pub = HERE + "/pub"; shutil.rmtree(pub, ignore_errors=True); os.makedirs(pub)
for f in os.listdir(GAME):
    if f.endswith((".html", ".js")): shutil.copy2(os.path.join(GAME, f), os.path.join(pub, f))
src = sys.argv[1] if len(sys.argv) > 1 else HERE + "/qa/shots/thumb-src.png"
im = Image.open(src).convert("RGB"); w, h = im.size; tw = min(w, int(h * 1.6)); th = int(tw / 1.6)
x = (w - tw) // 2; y = max(0, (h - th) // 2)
im.crop((x, y, x + tw, y + th)).resize((320, 200), Image.LANCZOS).save(HERE + "/thumb.webp", "WEBP", quality=84)

ENTRY = {
  "id": ID, "title": "★ Vampire Survivors Remake — Hark Edition (fan remake)", "category": "Other games",
  "keys": {"up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight", "attack": "Space", "jump": "Enter", "special": "KeyM", "start": "Enter", "select": "KeyP"},
  "labels": {"attack": "DASH", "jump": "PICK", "special": "MUTE", "start": "START", "select": "PAUSE"},
  "extras": [{"label": "MUTE", "key": "KeyM"}],
  "autostart": [], "orientation": "any",
  "note": "Hark fan remake of the bullet-heaven genre (2026-10-13): cel-shaded three.js r160, 1,500+ enemy horde as one instanced draw of baked cel impostors, 8 weapons / 9 passives / 6 evolutions, 10:00 run + Reaper boss. Boots in attract mode; any key/tap plays. Source: /workspace/work/survivors-plus/game",
}

def place(games, r):
    games = [g for g in games if g["id"] != ID]
    idx = next((i for i, g in enumerate(games) if g.get("category") == r["category"]), len(games))
    games.insert(idx, r); return games

# 1. Hawk (GitHub Pages serves main:/)
if not os.path.isdir(HAWK + "/.git"):
    subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", "--depth", "1", "https://github.com/bparlette/Hawk.git", HAWK], check=True, timeout=110)
    sh("git", "sparse-checkout", "init", "--no-cone")
sh("git", "sparse-checkout", "set", "/brad-demos/games.json", "/brad-demos/demo-embed.js", "/brad-demos/g/" + ID + "/", "/brad-demos/thumbs/" + ID + ".webp")
sys.path.insert(0, DEMOS); import build
for attempt in range(5):
    sh("git", "fetch", "-q", "--depth", "1", "origin", "main"); sh("git", "checkout", "-q", "-B", "main", "FETCH_HEAD"); sh("git", "reset", "-q", "--hard", "FETCH_HEAD")
    build.SITE = HAWK + "/brad-demos"
    build.copy_game({"id": ID, "source": pub, "embed": ""})
    os.makedirs(HAWK + "/brad-demos/thumbs", exist_ok=True); shutil.copy2(HERE + "/thumb.webp", HAWK + "/brad-demos/thumbs/" + ID + ".webp")
    gj = HAWK + "/brad-demos/games.json"; man = json.load(open(gj, encoding="utf-8"))   # re-read right before editing
    r = dict(ENTRY); r["path"] = "g/" + ID + "/index.html"; r["thumb"] = "thumbs/" + ID + ".webp?v=" + str(int(time.time()))
    man["games"] = place(man["games"], r)
    if r["category"] not in man["categories"]: man["categories"].append(r["category"])
    json.dump(man, open(gj, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    sh("git", "add", "brad-demos/g/" + ID, "brad-demos/thumbs/" + ID + ".webp", "brad-demos/games.json")
    st = sh("git", "status", "--porcelain"); print(st[:2000])
    if not st: print("NOTHING_TO_COMMIT"); break
    sh("git", "-c", "user.name=Hark", "-c", "user.email=hark@hark.local", "commit", "-qm", "Brad's Demos: add ★ Vampire Survivors Remake — Hark Edition (survivors-plus)")
    p = subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=HAWK, capture_output=True, text=True, timeout=110)
    if p.returncode == 0: print("PUSHED", sh("git", "rev-parse", "HEAD")); break
    print("push rejected, retrying", p.stderr[-300:]); time.sleep(5)
else:
    print("PUSH_FAILED"); sys.exit(1)

# 2. local demos manifest (source of truth for build.py) — re-read right before editing; no deploy/sync here
sp = DEMOS + "/src/games.json"; m = json.load(open(sp, encoding="utf-8"))
g = dict(ENTRY); g.update({"source": pub, "query": "", "embed": ""})
m["games"] = place(m["games"], g)
json.dump(m, open(sp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
shutil.copy2(HERE + "/thumb.webp", DEMOS + "/src/thumbs/" + ID + ".webp")
print(sh("python3", "build.py", "--resync", ID, cwd=DEMOS)[-300:])
print("LOCAL_OK")

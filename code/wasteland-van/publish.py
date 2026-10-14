#!/usr/bin/env python3
"""Publish wasteland-van (ROADKILL RIG) to bparlette/Hawk main:/brad-demos/ (GitHub Pages).
Additive: re-reads games.json from Hawk main right before editing, touches only this game's files + its manifest entry.
Run under: flock /workspace/work/demos/.edit.lock python3 publish.py   (never sync-main.sh / deploy sync)"""
import json, os, shutil, subprocess, sys, time
HERE = "/workspace/work/wasteland-van"; HAWK = HERE + "/hawk"; ID = "wasteland-van"
def sh(*a, check=True):
    r = subprocess.run(a, cwd=HAWK, capture_output=True, text=True, timeout=100)
    if check and r.returncode: print("FAIL", a, r.stdout[-400:], r.stderr[-400:]); sys.exit(1)
    return r.stdout.strip()
ENTRY = {
  "id": ID, "title": "★ ROADKILL RIG — Hark Original", "category": "Originals",
  "keys": {"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD", "attack": "Space", "jump": "ShiftLeft", "special": "KeyR", "start": "Enter", "select": "KeyP"},
  "labels": {"attack": "NITRO", "jump": "DRIFT", "special": "R FLIP", "start": "DRIVE", "select": "PAUSE"},
  "extras": [{"label": "MUTE", "key": "KeyM"}, {"label": "16-BIT", "key": "KeyH"}],
  "autostart": [], "orientation": "any",
  "note": "Hark original (2026-10-13): spiked war-van stunt racer x 1,000+ zombie horde survival. Three.js r160 local, cel/halftone/outline look, raycast suspension, 4 weapons + 4 evolutions, GRAVEMAW boss, extraction win. Source: /workspace/work/wasteland-van (src/ -> build.sh -> site/).",
}
for attempt in range(4):
    sh("git", "fetch", "-q", "--depth", "1", "origin", "main"); sh("git", "reset", "-q", "--hard", "FETCH_HEAD")
    d = HAWK + "/brad-demos/g/" + ID
    if os.path.isdir(d): shutil.rmtree(d)
    os.makedirs(d)
    html = open(HERE + "/site/index.html", encoding="utf-8").read()
    if "demo-embed.js" not in html:  # same hook every game copy gets from build.py
        html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n<script src="../../demo-embed.js"></script>', 1)
    open(d + "/index.html", "w", encoding="utf-8").write(html)
    shutil.copy2(HERE + "/site/three.module.min.js", d + "/three.module.min.js")
    os.makedirs(HAWK + "/brad-demos/thumbs", exist_ok=True)
    shutil.copy2(HERE + "/thumb.webp", HAWK + "/brad-demos/thumbs/" + ID + ".webp")
    gj = HAWK + "/brad-demos/games.json"; raw = open(gj, encoding="utf-8").read(); man = json.loads(raw)
    indent = 2 if raw.startswith('{\n  "') else 1
    r = dict(ENTRY); r["path"] = "g/" + ID + "/index.html"; r["thumb"] = "thumbs/" + ID + ".webp?v=" + str(int(time.time()))
    games = [g for g in man["games"] if g["id"] != ID]
    idx = next((i for i, g in enumerate(games) if g.get("category") == "Originals"), len(games))
    games.insert(idx, r); man["games"] = games
    if r["category"] not in man["categories"]: man["categories"].append(r["category"])
    open(gj, "w", encoding="utf-8").write(json.dumps(man, indent=indent, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
    sh("git", "add", "brad-demos/g/" + ID, "brad-demos/thumbs/" + ID + ".webp", "brad-demos/games.json")
    print(sh("git", "diff", "--cached", "--stat")[-600:])
    sh("git", "-c", "user.name=Hark", "-c", "user.email=hark@hark.local", "commit", "-qm", "Brad's Demos: add ★ ROADKILL RIG — Hark Original (wasteland-van)")
    p = subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=HAWK, capture_output=True, text=True, timeout=100)
    if p.returncode == 0: print("PUSHED", sh("git", "rev-parse", "HEAD")); break
    print("push rejected, retrying", p.stderr[-300:]); time.sleep(5)
else:
    print("PUSH_FAILED"); sys.exit(1)

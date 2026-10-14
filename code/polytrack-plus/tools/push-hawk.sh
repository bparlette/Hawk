#!/usr/bin/env bash
# Additive push of polytrack-plus into bparlette/Hawk main:/brad-demos/. Touches ONLY brad-demos/g/polytrack-plus/,
# brad-demos/thumbs/polytrack-plus.webp and the polytrack-plus entry in brad-demos/games.json (re-read from main every try).
# Run under: flock /workspace/work/demos/.edit.lock tools/push-hawk.sh "<msg>"
set -u
P=/workspace/work/polytrack-plus; cd $P/hawk || exit 1
git sparse-checkout add "/brad-demos/g/polytrack-plus/" 2>/dev/null
for try in 1 2 3 4 5 6 7 8; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 15; continue; }
  git reset -q --hard FETCH_HEAD
  python3 - <<'PY'
import json, shutil, os, re, time
P = "/workspace/work/polytrack-plus"; d = "brad-demos/g/polytrack-plus"
e = json.load(open(P + "/tools/entry.json", encoding="utf-8")); e["thumb"] = "thumbs/polytrack-plus.webp?v=%d" % int(time.time())
dst = json.load(open("brad-demos/games.json", encoding="utf-8"))
if e["category"] not in dst["categories"]: dst["categories"].append(e["category"])
ids = [g["id"] for g in dst["games"]]
if e["id"] in ids: dst["games"][ids.index(e["id"])] = e
else:
    # after blox-dough-raid-plus (the other starred remake) when present
    i = ids.index("blox-dough-raid-plus") + 1 if "blox-dough-raid-plus" in ids else len(ids)
    dst["games"].insert(i, e)
json.dump(dst, open("brad-demos/games.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
if os.path.isdir(d): shutil.rmtree(d)
shutil.copytree(P + "/game", d)
html = open(d + "/index.html", encoding="utf-8").read()
inj = '<script src="../../demo-embed.js"></script>\n<style id="demo-embed-css">html.demo-embed #touch{display:none!important}</style>\n'
html = re.sub(r'(<meta charset="utf-8">\n)', lambda m: m.group(1) + inj, html, count=1)
open(d + "/index.html", "w", encoding="utf-8").write(html)
shutil.copy2(P + "/shorts/thumb.webp", "brad-demos/thumbs/polytrack-plus.webp")
print("merged; total", len(dst["games"]))
PY
  git add brad-demos/games.json brad-demos/g/polytrack-plus brad-demos/thumbs/polytrack-plus.webp
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "${1:-Brad Demos: PolyTrack Remake — Hark Edition}" || { echo NOTHING_TO_COMMIT; exit 0; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse HEAD)"; exit 0; }
  echo "push failed ($try)"; sleep 15
done
echo PUSH_FAIL; exit 1

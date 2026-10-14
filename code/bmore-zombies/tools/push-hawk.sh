#!/usr/bin/env bash
# Additive push of Toad City: Dead Streets into bparlette/Hawk main:/brad-demos/. Touches ONLY brad-demos/g/toad-city-dead-streets/,
# brad-demos/thumbs/toad-city-dead-streets.webp and the toad-city-dead-streets entry in brad-demos/games.json (re-read from main every try).
# Run under: flock /workspace/work/demos/.edit.lock tools/push-hawk.sh "<msg>"   (shell credentials: github)
set -u
P=/workspace/work/bmore-zombies; cd $P/hawk || exit 1
for try in 1 2 3 4 5 6; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 15; continue; }
  git checkout -q -B main FETCH_HEAD && git reset -q --hard FETCH_HEAD
  python3 - <<'PY' || exit 1
import json, shutil, os, re, time
P = "/workspace/work/bmore-zombies"; d = "brad-demos/g/toad-city-dead-streets"
raw = open("brad-demos/games.json", encoding="utf-8").read()
dst = json.loads(raw)
e = json.load(open(P + "/tools/entry.json", encoding="utf-8")); e["thumb"] = "thumbs/toad-city-dead-streets.webp?v=%d" % int(time.time())
ids = [g["id"] for g in dst["games"]]
if e["category"] not in dst["categories"]: dst["categories"].append(e["category"])
if e["id"] in ids: dst["games"][ids.index(e["id"])] = e
else:
    i = ids.index("toad-city-paperboy") + 1 if "toad-city-paperboy" in ids else len(ids)
    dst["games"].insert(i, e)
new = json.dumps(dst, indent=2, ensure_ascii=False) + ("\n" if raw.endswith("\n") else "")
# safety: every other entry must be byte-identical to before
old = json.loads(raw); chk = json.loads(new)
assert [g for g in chk["games"] if g["id"] != e["id"]] == [g for g in old["games"] if g["id"] != e["id"]]
open("brad-demos/games.json", "w", encoding="utf-8").write(new)
os.makedirs(d, exist_ok=True)
for f in ("game.js", "three.module.min.js"): shutil.copy2(P + "/site/" + f, d + "/" + f)
html = open(P + "/site/index.html", encoding="utf-8").read()
html = re.sub(r'(<meta charset="utf-8">\n)', lambda m: m.group(1) + '<script src="../../demo-embed.js"></script>\n', html, count=1)
assert 'demo-embed.js' in html
open(d + "/index.html", "w", encoding="utf-8").write(html)
os.makedirs("brad-demos/thumbs", exist_ok=True); shutil.copy2(P + "/shorts/thumb.webp", "brad-demos/thumbs/toad-city-dead-streets.webp")
print("merged; total", len(dst["games"]))
PY
  git add brad-demos/games.json brad-demos/g/toad-city-dead-streets brad-demos/thumbs/toad-city-dead-streets.webp
  git diff --cached --stat | tail -8
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "${1:-Brad Demos: Toad City: Dead Streets}" || { echo NOTHING_TO_COMMIT; exit 0; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse HEAD)"; exit 0; }
  echo "push failed ($try)"; sleep 15
done
echo PUSH_FAIL; exit 1

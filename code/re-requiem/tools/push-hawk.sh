#!/usr/bin/env bash
# Additive push of this job's games into bparlette/Hawk main:/brad-demos/ (GitHub Pages source = main, /).
# Never replaces brad-demos wholesale (other agents add entries straight to Hawk). Run under the demos .edit.lock.
# usage: push-hawk.sh "<commit msg>"
set -u
IDS="re-requiem re-requiem-v1 re-requiem-v2 re-requiem-v3 blox-dough-raid socal-summer-games viral-overdrive"
SITE=/workspace/work/demos/site
cd /workspace/work/re-requiem/hawk || exit 1
for i in $IDS; do git sparse-checkout add "/brad-demos/g/$i/" 2>/dev/null; done
for try in 1 2 3 4 5 6 7 8; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 20; continue; }
  git reset -q --hard FETCH_HEAD
  python3 - "$SITE" $IDS <<'PY'
import json, sys, shutil, os
site, ids = sys.argv[1], sys.argv[2:]
src = json.load(open(os.path.join(site, "games.json"), encoding="utf-8"))
dst_p = "brad-demos/games.json"; dst = json.load(open(dst_p, encoding="utf-8"))
mine = {g["id"]: g for g in src["games"] if g["id"] in ids}
for c in src["categories"]:
    if any(g["category"] == c for g in mine.values()) and c not in dst["categories"]:
        dst["categories"].insert(0 if c.startswith("Resident") else len(dst["categories"]), c)
out, seen = [], set()
for g in dst["games"]:
    if g["id"] in mine: out.append(mine[g["id"]]); seen.add(g["id"])
    else: out.append(g)
for i in ids:
    if i in mine and i not in seen: out.append(mine[i])
dst["games"] = out
json.dump(dst, open(dst_p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for i in ids:
    d = f"brad-demos/g/{i}"
    if os.path.isdir(d): shutil.rmtree(d)
    shutil.copytree(os.path.join(site, "g", i), d)
    t = os.path.join(site, "thumbs", i + ".webp")
    if os.path.exists(t): shutil.copy2(t, f"brad-demos/thumbs/{i}.webp")
print("merged", len(mine), "entries; total", len(out))
PY
  git add -A brad-demos
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "${1:-Brad Demos: Requiem + new games}" || { echo NOTHING_TO_COMMIT; exit 0; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse --short HEAD)"; exit 0; }
  echo "push failed ($try)"; sleep 20
done
echo PUSH_FAIL; exit 1

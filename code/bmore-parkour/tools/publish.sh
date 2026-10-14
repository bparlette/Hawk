#!/usr/bin/env bash
# Additive publish of toad-city-rooftops into bparlette/Hawk main:/brad-demos/ (never replaces brad-demos wholesale; never sync-main.sh).
# Pushes ONLY: brad-demos/g/toad-city-rooftops/*, brad-demos/thumbs/toad-city-rooftops.webp, and our one games.json entry
# (games.json re-read from current main on every try). Run under: flock /workspace/work/demos/.edit.lock tools/publish.sh "<msg>"
set -u
ID=toad-city-rooftops
ROOT=/workspace/work/bmore-parkour
PUB=$ROOT/pub
cd $ROOT/hawk || exit 1
git sparse-checkout set --no-cone /brad-demos/games.json /brad-demos/g/$ID/ /brad-demos/thumbs/$ID.webp >/dev/null 2>&1
for try in 1 2 3 4 5 6; do
  timeout 100 git fetch -q --depth 1 origin main || { echo "fetch failed ($try)"; sleep 15; continue; }
  git reset -q --hard FETCH_HEAD
  python3 - "$PUB" "$ID" <<'PY' || { echo PREP_FAIL; exit 1; }
import json, sys, shutil, os
pub, gid = sys.argv[1], sys.argv[2]
p = "brad-demos/games.json"; raw = open(p, encoding="utf-8").read(); gj = json.loads(raw); before = [g.get("id") for g in gj["games"]]
entry = json.load(open(os.path.join(pub, "entry.json"), encoding="utf-8"))
games = [g for g in gj["games"] if g.get("id") != gid]
# place near Toad City: after the last toad-city* entry (sibling spin-offs), else after K · Toad Street 32
idx = None
for i, g in enumerate(games):
    if str(g.get("id", "")).startswith("toad-city"): idx = i
if idx is None:
    for i, g in enumerate(games):
        if g.get("id") == "toad-street-32": idx = i
if entry.get("category") and entry["category"] not in gj.get("categories", []): gj.setdefault("categories", []).append(entry["category"])
if idx is None: games.append(entry)
else: games.insert(idx + 1, entry)
gj["games"] = games
assert [g.get("id") for g in games if g.get("id") != gid] == [x for x in before if x != gid], "entry order changed"
open(p, "w", encoding="utf-8").write(json.dumps(gj, indent=1, ensure_ascii=False) + ("\n" if raw.endswith("\n") else ""))
d = f"brad-demos/g/{gid}"; os.makedirs(d, exist_ok=True)
for f in ("index.html", "three.module.min.js"): shutil.copy2(os.path.join(pub, f), os.path.join(d, f))
os.makedirs("brad-demos/thumbs", exist_ok=True); shutil.copy2(os.path.join(pub, "thumb.webp"), f"brad-demos/thumbs/{gid}.webp")
print("entry at", (idx + 1) if idx is not None else len(games) - 1, "of", len(games))
PY
  git add brad-demos/games.json brad-demos/g/$ID brad-demos/thumbs/$ID.webp
  git diff --cached --stat | tail -4
  git -c user.name=Hark -c user.email=hark@hark.local commit -qm "${1:-Brad Demos: Toad City Rooftops}" || { echo NOTHING_TO_COMMIT; exit 0; }
  timeout 100 git push -q origin HEAD:refs/heads/main && { echo "HAWK_PUSHED $(git rev-parse --short HEAD)"; exit 0; }
  echo "push failed ($try)"; sleep 15
done
echo PUSH_FAIL; exit 1

#!/usr/bin/env bash
# One-step add of a new prototype to the demo page.
#   ./add-game.sh <id> "<Title>" "<Category>" <built-site-folder> [--file page.html] [--query '?x=1'] [--embed preset] [--deploy]
# Categories in use: "Shell Shock", "Bake-off", "Other games", "Retro Arcade" (a new name adds a new group).
# Embed presets (build.py EMBED_CSS): cab (Shell Shock engine), cel, cave, knockout, hollow, g16, rta, or none.
# Defaults: stick = arrows, ATTACK = J, JUMP = K, SPECIAL = L, START = Enter, no autostart. Edit src/games.json to tune,
# then: ./build.py --resync <id> && ./deploy.sh
set -e
cd "$(dirname "$0")"
[ $# -ge 4 ] || { sed -n 2,7p "$0"; exit 1; }
ID=$1; TITLE=$2; CAT=$3; SRC=$4; shift 4
FILE=""; QUERY=""; EMBED=""; DEPLOY=0
while [ $# -gt 0 ]; do case $1 in
  --file) FILE=$2; shift 2;; --query) QUERY=$2; shift 2;; --embed) EMBED=$2; shift 2;; --deploy) DEPLOY=1; shift;;
  *) echo "unknown option $1"; exit 1;; esac; done
[ -d "$SRC" ] || { echo "no such folder: $SRC"; exit 1; }
[ -f "$SRC/${FILE:-index.html}" ] || { echo "no ${FILE:-index.html} in $SRC"; exit 1; }
SRC=$(cd "$SRC" && pwd)
python3 - "$ID" "$TITLE" "$CAT" "$SRC" "$FILE" "$QUERY" "$EMBED" <<'PY'
import json, sys
id_, title, cat, src, file_, query, embed = sys.argv[1:]
p = "src/games.json"; m = json.load(open(p, encoding="utf-8"))
g = {"id": id_, "title": title, "category": cat, "source": src, "query": query, "embed": embed, "orientation": "any",
     "keys": {"attack": "KeyJ", "jump": "KeyK", "special": "KeyL", "start": "Enter"}, "autostart": []}
if file_: g["file"] = file_
games = [x for x in m["games"] if x["id"] != id_]
old = next((x for x in m["games"] if x["id"] == id_), None)
if old:  # re-adding keeps the tuned keys/labels/autostart
    for k in ("keys", "labels", "extras", "autostart", "orientation", "css", "patches"):
        if k in old: g[k] = old[k]
    games = [g if x["id"] == id_ else x for x in m["games"]]
else:
    games.append(g)
if cat not in m["categories"]: m["categories"].append(cat)
m["games"] = games
json.dump(m, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(("updated " if old else "added ") + id_)
PY
python3 build.py --resync "$ID"
# thumbnail (best effort): local server + headless Chromium
if ! curl -s -o /dev/null -m 3 http://127.0.0.1:8731/; then python3 /workspace/work/ss3d-bakeoff/i_cel/serve.py 8731 "$(pwd)/site"; sleep 1; fi
( . /workspace/work/freeze_test/env.sh; export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu;
  timeout 75 node tools/thumbs.js 8731 "$ID" ) && python3 build.py >/dev/null || echo "thumbnail skipped (run: python3 tools/detach.py T/thumbs.log node tools/thumbs.js 8731 $ID, then ./build.py)"
# surge uploads the whole site (~80 MB), which can outlast a 2-minute shell: deploy detached and log to T/deploy-run.log
if [ $DEPLOY = 1 ]; then python3 tools/detach.py T/deploy-run.log ./deploy.sh; echo "deploying in the background: cat T/deploy-run.log"; else echo "not deployed (run ./deploy.sh)"; fi

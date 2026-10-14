#!/usr/bin/env bash
# Shell Shock Live hype-trailer pipeline. Re-run after new levels ship.
#
#   ./capture.sh [GAME_DIR]            full run: snapshot -> capture every level -> stills + movies -> page
#   GAME_DIR  default /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf (never modified; copied)
# Env:
#   STAGING=/workspace/work/levels_staging   overlay staged levelN/levelN.js (+ images) onto the copy
#   LEVELS="1 2 3"     capture only these levels (default: 1 + every levels/levelN.js found)
#   SKIP_CAPTURE=1     re-edit from existing raw/ captures only (fast iteration on the edit)
#   JOBS=2             levels captured in parallel (2 vCPU sandbox -> 2)
#   DEPLOY=1           also publish deploy/ to shellshock-trailer.surge.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
GAME_DIR="${1:-/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf}"
JOBS="${JOBS:-2}"
export LD_LIBRARY_PATH="$HERE/libs/aarch64-linux-gnu:${LD_LIBRARY_PATH:-}"
mkdir -p logs

[ -d node_modules/playwright ] || npm install --no-audit --no-fund >/dev/null 2>&1

if [ "${SKIP_CAPTURE:-0}" != "1" ]; then
  echo "== snapshot $GAME_DIR"
  ./snapshot.sh "$GAME_DIR" || exit 1
  LV="${LEVELS:-$(echo 1; ls _serve/live/levels 2>/dev/null | sed -n 's/^level\([0-9]\+\)\.js$/\1/p' | sort -n)}"
  echo "== levels: $(echo $LV)"
  # remove captures of levels that no longer exist
  for d in raw/level*; do [ -d "$d" ] || continue; n="${d#raw/level}"; echo " $LV " | grep -q " $n " || { [ -z "${LEVELS:-}" ] && rm -rf "$d"; }; done
  running=0
  for n in $LV; do
    ./run_captures.sh "$n" &
    running=$((running + 1))
    if [ "$running" -ge "$JOBS" ]; then wait -n; running=$((running - 1)); fi
  done
  wait
fi

echo "== edit: stills, level movies, full trailer"
python3 build.py all || exit 1
echo "== page"
python3 make_page.py || exit 1
if [ "${DEPLOY:-0}" = "1" ]; then
  export SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN="$(cat /workspace/work/.surge_token)"
  timeout 100 npx -y surge@0.24.6 "$HERE/deploy" shellshock-trailer.surge.sh
fi
echo "== done. Outputs: out/*.mp4, screens/levelN/, deploy/index.html"

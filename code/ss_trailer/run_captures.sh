#!/usr/bin/env bash
# Capture raw frames for every Shell Shock Live level found. Usage: run_captures.sh [levels...]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
export LD_LIBRARY_PATH="$HERE/libs/aarch64-linux-gnu:${LD_LIBRARY_PATH:-}"
PORT="${PORT:-8765}"
LEVELS="${*:-$(echo 1; ls _serve/live/levels 2>/dev/null | sed -n 's/^level\([0-9]\+\)\.js$/\1/p' | sort -n)}"
for n in $LEVELS; do
  rm -rf "raw/level$n"; echo "== capture live level $n"
  node capture.js "http://127.0.0.1:$PORT/live" "raw/level$n" live "$n" 16000 > "logs/capture_level$n.log" 2>&1 || echo "  level $n capture FAILED (see logs)"
  tail -1 "logs/capture_level$n.log"
done

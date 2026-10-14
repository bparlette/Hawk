#!/usr/bin/env bash
# runtest.sh OUTROOT JPEG MAXF levels...   (port 8775 dev server)
cd "$(dirname "$0")"; export LD_LIBRARY_PATH=/workspace/work/ss_trailer/libs/aarch64-linux-gnu
R="$1"; J="$2"; M="$3"; shift 3; PORT="${PORT:-8775}"
for n in "$@"; do rm -rf "$R/level$n"; node capture2.js "http://127.0.0.1:$PORT" "$R/level$n" "$n" "$M" "$J" > "logs/$(basename $R)_level$n.log" 2>&1; tail -1 "logs/$(basename $R)_level$n.log"; done

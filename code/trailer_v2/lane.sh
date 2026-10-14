#!/usr/bin/env bash
# lane.sh RAWROOT PORT SERVEDIR levels...  — adaptive cabinet capture, resumable (skips levels already DONE with results)
cd "$(dirname "$0")"; export LD_LIBRARY_PATH=/workspace/work/ss_trailer/libs/aarch64-linux-gnu
R="$1"; PORT="$2"; SD="$3"; shift 3
up() { curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/index.html" 2>/dev/null; }
for n in "$@"; do
  L="logs/$(basename $R)_level$n.log"
  if grep -q "end=results" "$L" 2>/dev/null; then echo "skip $n"; continue; fi
  for try in 1 2; do
    [ "$(up)" = "200" ] || { (cd "$SD" && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 </dev/null &); sleep 2; }
    rm -rf "$R/level$n"
    node capture2.js "http://127.0.0.1:$PORT" "$R/level$n" "$n" 50000 adapt > "$L" 2>&1
    tail -1 "$L"; grep -q "end=results" "$L" && break
  done
done

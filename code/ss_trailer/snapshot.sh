#!/usr/bin/env bash
# Make a capture-patched copy of Shell Shock Live under _serve/live and start a local server.
# Never touches the real game folders: copies them, then patches the COPY so its STATE object is
# visible to the capture bot as window.__CAP_STATE.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LIVE_SRC="${1:-${LIVE_SRC:-/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf}}"
STAGING="${STAGING:-}"   # optional: dir holding levelN/ subfolders (e.g. /workspace/work/levels_staging) to overlay
LIVE_URL="${LIVE_URL:-https://shellshock-live.surge.sh}"
PORT="${PORT:-8765}"
S="$HERE/_serve"; rm -rf "$S"; mkdir -p "$S/live"

fetch_site() { # url dest -> 0 if the live site is up and was mirrored
  local code; code=$(curl -s -o /dev/null -w "%{http_code}" "$1/" || true)
  [ "$code" = "200" ] || { echo "  $1 returned $code -> using local copy"; return 1; }
  (cd "$2" && wget -q -r -np -nH -e robots=off "$1/" && for n in 2 3 4 5 6 7 8 9 10; do wget -q -P levels "$1/levels/level$n.js" || break; done) && return 0
  return 1
}
if [ "${USE_LOCAL:-1}" = "1" ] || ! fetch_site "$LIVE_URL" "$S/live"; then
  cp -a "$LIVE_SRC/." "$S/live/"; rm -rf "$S/live/work"
fi
if [ -n "$STAGING" ] && [ -d "$STAGING" ]; then
  mkdir -p "$S/live/levels"
  for d in "$STAGING"/level*/; do [ -f "$d/$(basename "$d").js" ] || continue
    echo "  overlay staged $(basename "$d")"; find "$d" -maxdepth 1 -type f \( -name 'level*.js' -o -name 'level*.jpg' -o -name 'level*.png' \) -exec cp {} "$S/live/levels/" \; ; done
fi
for g in live; do
  python3 - "$S/$g/index.html" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
n=s.count("const STATE = {")
assert n>=1, "STATE hook not found in "+p
s=s.replace("const STATE = {","const STATE = window.__CAP_STATE = {",1)
open(p,"w").write(s); print("  patched",p)
PY
done
ls "$S/live/levels" 2>/dev/null | sed 's/^/  live level file: /' || true
pkill -f "http.server $PORT" 2>/dev/null || true
(cd "$S" && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 </dev/null &)
sleep 1; curl -s -o /dev/null -w "  server %{http_code}\n" "http://127.0.0.1:$PORT/live/index.html"

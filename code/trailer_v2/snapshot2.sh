#!/usr/bin/env bash
# snapshot2.sh SRC_DIR DEST_DIR [PORT]: copy the game, patch ONLY the copy for capture, serve it.
#  - const STATE = {  ->  const STATE = window.__CAP_STATE = {   (bot/meta read the live state)
#  - capture CSS: no CSS transitions (frames are stepped manually), hide the fullscreen + WATCH TRAILER chrome
set -euo pipefail
SRC="$1"; DEST="$2"; PORT="${3:-8775}"
rm -rf "$DEST"; mkdir -p "$DEST"; cp -a "$SRC/." "$DEST/"; rm -rf "$DEST/work"
python3 - "$DEST/index.html" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
assert s.count("const STATE = {")>=1, "STATE hook not found"
s=s.replace("const STATE = {","const STATE = window.__CAP_STATE = {",1)
css="<style id=\"capcss\">*,*::before,*::after{transition:none!important;animation:none!important}#fsbtn,#trailerbtn{display:none!important}</style>"
s=s.replace("</head>", css+"\n</head>",1)
open(p,"w").write(s); print("  patched", p)
PY
pkill -f "http.server $PORT" 2>/dev/null || true
(cd "$DEST" && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 </dev/null &)
sleep 1; curl -s -o /dev/null -w "  server :$PORT %{http_code}\n" "http://127.0.0.1:$PORT/index.html"

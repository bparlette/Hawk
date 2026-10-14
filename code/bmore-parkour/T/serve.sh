#!/usr/bin/env bash
# start the static server for site/ on :8761 (detached) if it is not up
pgrep -f "http.server 8761" >/dev/null || (cd /workspace/work/bmore-parkour/site && setsid nohup python3 -m http.server 8761 >/dev/null 2>&1 < /dev/null & disown)

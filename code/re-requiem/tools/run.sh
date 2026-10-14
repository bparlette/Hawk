#!/usr/bin/env bash
# run.sh <cmd...>: make sure the local server for /workspace/work/re-requiem is up on :8732 (sandbox restarts kill it),
# then run the command under the shared Chrome lock.
curl -s -o /dev/null -m 2 http://127.0.0.1:8732/game/index.html || { nohup python3 -m http.server 8732 -d /workspace/work/re-requiem >/dev/null 2>&1 & sleep 1.5; }
exec flock /workspace/work/toad-city/locks/chrome.flock "$@"

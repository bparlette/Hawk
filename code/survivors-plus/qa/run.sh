#!/usr/bin/env bash
# run.sh <cmd...>: local server for the game on :8745 (sandbox restarts kill it), Chromium env, shared Chrome lock.
curl -s -o /dev/null -m 2 http://127.0.0.1:8745/index.html || { nohup python3 -m http.server 8745 -d /workspace/work/survivors-plus/game >/dev/null 2>&1 & sleep 1.5; }
. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
exec flock /workspace/work/toad-city/locks/chrome.flock "$@"

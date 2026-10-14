#!/usr/bin/env bash
# qa/run.sh <script.js> [args] : serve build/ on :8817 and run a playwright script under the shared chrome lock
cd /workspace/work/socal-painted
curl -s -o /dev/null -m 2 http://127.0.0.1:8817/index.html || { setsid nohup python3 -m http.server 8817 -d /workspace/work/socal-painted/build >/dev/null 2>&1 & sleep 1.2; }
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
exec timeout 110 flock /workspace/work/toad-city/locks/chrome.flock node "$@"

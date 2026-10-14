#!/usr/bin/env bash
# run.sh <args for qa.js> : local server on :8761 + Chrome under the shared lock
cd /workspace/work/wasteland-van
curl -s -o /dev/null -m 2 http://127.0.0.1:8761/index.html || { python3 /workspace/work/ss3d-bakeoff/i_cel/serve.py 8761 /workspace/work/wasteland-van/site; sleep 1; }
. /workspace/work/freeze_test/env.sh
exec flock /workspace/work/toad-city/locks/chrome.flock timeout 110 node qa.js 8761 "$@"

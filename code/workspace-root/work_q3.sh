#!/usr/bin/env bash
cd /workspace/work/survivors-plus/qa
curl -s -o /dev/null -m 2 http://127.0.0.1:8745/index.html || { setsid nohup python3 -m http.server 8745 -d /workspace/work/survivors-plus/game >/dev/null 2>&1 & sleep 1.5; }
. /workspace/work/freeze_test/env.sh; export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node flow.js 1280 720 0 > T_flow1280c.log 2>&1; echo DONE >> T_flow1280c.log

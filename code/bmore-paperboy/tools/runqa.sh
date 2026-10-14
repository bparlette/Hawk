#!/usr/bin/env bash
# runqa.sh <w> <h> <plan> : one headless QA run under the shared chrome lock (detached; log in qa/<w>x<h>-<plan>.log)
cd "$(dirname "$0")/.." && mkdir -p qa
. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers
curl -s -o /dev/null http://127.0.0.1:8793/index.html || (cd site && setsid nohup python3 -m http.server 8793 --bind 127.0.0.1 > /tmp/pb_srv.log 2>&1 < /dev/null &)
setsid nohup flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node tools/qa.js 8793 "$1" "$2" "$3" > "qa/$1x$2-$3.log" 2>&1 < /dev/null &
echo started

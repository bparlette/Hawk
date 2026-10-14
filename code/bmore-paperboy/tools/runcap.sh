#!/usr/bin/env bash
cd "$(dirname "$0")/.." && mkdir -p shorts qa
. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers
curl -s -o /dev/null http://127.0.0.1:8793/index.html || (cd site && setsid nohup python3 -m http.server 8793 --bind 127.0.0.1 > /tmp/pb_srv.log 2>&1 < /dev/null &)
rm -rf "shorts/$1"; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock timeout 1500 node tools/cap.js 8793 "shorts/$1" "$2" "$3" "$4" "$5" > "qa/cap-$1.log" 2>&1 < /dev/null &
echo started

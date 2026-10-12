#!/usr/bin/env bash
# run.sh <w> <h> <prefix> [query] : detached test run, output in T/<prefix>log
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/scroller25d/.pw LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
curl -s -o /dev/null http://127.0.0.1:8731/ || python3 /workspace/work/ss3d-bakeoff/serve.py 8731 /workspace/work/scroller25d/dist
setsid nohup node test.js 8731 "$1" "$2" "T/$3" "${4:-?bot}" > "T/$3log" 2>&1 < /dev/null &
echo started

#!/bin/bash
# run.sh <name> <args...> : (re)start the static server outside the flock, then the capture detached with Chrome under the shared flock
cd /workspace/work/ending_cap; n=$1; shift
curl -s -o /dev/null http://127.0.0.1:8877/ || setsid nohup python3 -m http.server 8877 --bind 127.0.0.1 --directory /workspace/work/toad-city/game-finale2/site > server.log 2>&1 < /dev/null &
sleep 1
. /workspace/work/hubtest/env.sh
setsid nohup bash -c "flock /workspace/work/toad-city/locks/chrome.flock node ending.js $* >> $n.log 2>&1; echo \$? > $n.rc" > /dev/null 2>&1 < /dev/null &
echo started $n

#!/usr/bin/env bash
# bg.sh <log> <node script args...>: run a headless job fully detached, under the shared chrome lock
cd /workspace/work/bmore-parkour; . T/env.sh; log=$1; shift
setsid nohup flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node "$@" > "$log" 2>&1 < /dev/null &
disown
echo started

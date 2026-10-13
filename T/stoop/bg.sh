#!/bin/bash
# T/stoop/bg.sh <name> <args for run.js...>: one detached headless run, serialized on the shared chrome lock; log in T/stoop/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/stoop/run.js "$@" > T/stoop/$name.log 2>&1 < /dev/null &

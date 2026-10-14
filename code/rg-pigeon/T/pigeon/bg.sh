#!/bin/bash
# T/pigeon/bg.sh <name> <args for run.js...>: detached, serialized on the shared chrome lock; log in T/pigeon/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/pigeon/run.js "$@" > T/pigeon/$name.log 2>&1 < /dev/null &

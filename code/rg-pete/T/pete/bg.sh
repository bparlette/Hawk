#!/bin/bash
# T/pete/bg.sh <name> <args for run.js...>: detached, serialized through the chrome flock; log in T/pete/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/pete/run.js "$@" > T/pete/$name.log 2>&1 < /dev/null &

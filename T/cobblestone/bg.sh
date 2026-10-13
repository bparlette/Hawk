#!/bin/bash
# T/cobblestone/bg.sh <name> <run.js args...>: one headless cobblestone run, detached, behind the shared chrome lock; log T/cobblestone/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/cobblestone/run.js "$@" > T/cobblestone/$name.log 2>&1 < /dev/null &

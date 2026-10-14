#!/bin/bash
# T/stoop/bge.sh <name> <args for entry.js...>
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/stoop/entry.js "$@" > T/stoop/$name.log 2>&1 < /dev/null &

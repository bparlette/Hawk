#!/bin/bash
# T/brew/bg.sh <name> <script.js> <args...>: one detached headless run, serialized on the shared chrome lock; log in T/brew/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; s=$1; shift; setsid nohup flock /workspace/work/toad-city/locks/chrome.flock node T/brew/$s "$@" > T/brew/$name.log 2>&1 < /dev/null &

#!/usr/bin/env bash
# detached test run: radio/run_bg.sh <port> <mode> <out>
cd /workspace/work/toad-city/game-remix-wt && . ./env.sh && setsid nohup timeout 600 node ../game/radio/remix_test.js "$1" "$2" > "$3" 2>&1 < /dev/null &

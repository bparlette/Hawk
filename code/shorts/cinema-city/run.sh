#!/bin/bash
[ "$1" = rp_ko ] && exit 0
source /workspace/work/toad-city/game/env.sh; export CHROME=/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome NODE_PATH=/workspace/work/trailer_v2/node_modules
cd /workspace/work/shorts/cinema-city; node cap.js "$@" > logs/$1.log 2>&1

#!/bin/bash
source /workspace/work/toad-city/game/env.sh
export THREE_FILE=/workspace/work/toad-city/game/site/three.module.min.js CHROME=/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome NODE_PATH=/workspace/work/trailer_v2/node_modules
cd /workspace/work/reviews/scratch_ab && REPORT=${REPORT:-shoot_report.json} timeout ${TO:-115} node shoot_ab.mjs "$@" 2>&1 | grep -v "^\s*at " | tail -20

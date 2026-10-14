#!/bin/bash
# baseline: the untouched hark/pigeon build (served from game-pigeon/site on 8994) vs the overlay (09a from chipkid-fun) on 8993, part 2 win 390, back to back
cd /workspace/work/toad-city/game-chipkid-fun && . ./env.sh; L=/workspace/work/toad-city/locks/chrome.flock
while [ ! -f T/duel/pol.done ]; do sleep 10; done
(cd /workspace/work/rg-pigeon && nice -n 10 flock $L timeout 900 node T/pigeon/run.js 8994 2 win 390 844 - 6 0) > T/duel/pol_pigBASE2_390.log 2>&1
(cd /workspace/work/rg-pigeon && nice -n 10 flock $L timeout 900 node T/pigeon/run.js 8993 2 win 390 844 - 6 0) > T/duel/pol_pig2b_390.log 2>&1
echo done > T/duel/pigbase.done

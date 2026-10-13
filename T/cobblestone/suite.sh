#!/bin/bash
# T/cobblestone/suite.sh: every cobblestone test in sequence, each behind the shared chrome lock; skips tests whose log already ends with a result
cd /workspace/work/toad-city/game-cobblestone && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/cobblestone
run() { local name=$1; shift; if [ -f $D/$name.log ] && grep -q "^ERRORS\|errors [0-9]\|own errors\|wall" $D/$name.log; then return; fi; timeout 600 "$@" > $D/$name.log 2>&1; }
run lose390 node $D/run.js 8791 cobblestone lose 390 844 - 5
run mash390 node $D/run.js 8791 cobblestone mash 390 844 - 5
run win1280 node $D/run.js 8791 cobblestone win 1280 720 $D/w1280.png 5 broad
run entry390n node $D/entry.js 8791 390 844 0.5
run entry390d node $D/entry.js 8791 390 844 0.1
run dc390 node $D/citydc.js 8791 390 844
run dc390base node $D/citydc.js 8792 390 844
run shot390 node $D/run.js 8791 cobblestone win 390 844 /workspace/work/toad-city/assets_preview/cobblestone_390.png 5 broad
run ccheck390 node ccheck.js 8791 $D/cc390 390 844
run entry1280n node $D/entry.js 8791 1280 720 0.5
run dc1280 node $D/citydc.js 8791 1280 720
run dc1280base node $D/citydc.js 8792 1280 720
run lose1280 node $D/run.js 8791 cobblestone lose 1280 720 - 5
echo done > $D/suite.done

#!/bin/bash
# T/pete/suite.sh: the Pete eat-off checks, one chrome at a time (chrome flock); logs in T/pete/
cd "$(dirname "$0")/../.." && . ./env.sh; F=/workspace/work/toad-city/locks/chrome.flock; o=T/pete
flock $F timeout 400 node $o/run.js 8763 win 390 844 /workspace/work/toad-city/game-pete/$o/win390.png 3 14 > $o/win390.log 2>&1
flock $F timeout 400 node $o/run.js 8763 win 1280 720 /workspace/work/toad-city/game-pete/$o/win1280.png 3 24 > $o/win1280.log 2>&1
flock $F timeout 300 node $o/run.js 8763 lose 1280 720 - 3 > $o/lose1280.log 2>&1
flock $F timeout 300 node $o/run.js 8763 lose 390 844 - 3 > $o/lose390.log 2>&1
flock $F timeout 300 node $o/entry.js 8763 390 844 8764 > $o/entry390.log 2>&1
flock $F timeout 300 node $o/entry.js 8763 1280 720 8764 > $o/entry1280.log 2>&1
echo ALLDONE > $o/suite.done

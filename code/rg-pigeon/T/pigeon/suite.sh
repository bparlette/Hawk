#!/bin/bash
# full pigeon test suite, serialized on the chrome lock, one test at a time
cd "$(dirname "$0")/../.." && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/pigeon; P=8977
run() { name=$1; shift; flock $L timeout 900 "$@" > $D/$name.log 2>&1; echo "$name done $(date +%T)" >> $D/suite.log; }
echo "start $(date +%T)" > $D/suite.log
run entry390 node $D/entry.js $P 390 844 $D/entry_390.png
SHOTS=6,22,34,50 run win390 node $D/run.js $P 1 win 390 844 $D/win390.png 6 0 '&pigeonquick=1'
run win1280 node $D/run.js $P 1 win 1280 720 $D/win1280.png 6 0 '&pigeonquick=1'
LIMIT=260 run lose390 node $D/run.js $P 1 lose 390 844 - 6
LIMIT=200 run lose1280p2 node $D/run.js $P 2 lose 1280 720 - 6
run p2win390 node $D/run.js $P 2 win 390 844 $D/p2win390.png 6 14
run dc_pig1280 node dc.js $P 1280 720
run dc_int1280 node dc.js 8978 1280 720
run dc_pig390 node dc.js $P 390 844
run dc_int390 node dc.js 8978 390 844
echo "all done $(date +%T)" >> $D/suite.log

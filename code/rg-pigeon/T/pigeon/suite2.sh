#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/pigeon; P=8977
while ! grep -q "all done" $D/suite.log; do sleep 10; done
run() { name=$1; shift; flock $L timeout 1200 "$@" > $D/$name.log 2>&1; echo "$name done $(date +%T)" >> $D/suite2.log; }
echo "start $(date +%T)" > $D/suite2.log
SHOTS=8,16,31,48,56 run fin390 node $D/run.js $P 1 win 390 844 $D/fin390.png 6 0 '&pigeonquick=1'
LIMIT=260 run lose1280p1 node $D/run.js $P 1 lose 1280 720 - 6
run cc390 node ccheck.js $P $D/cc390_ 390 844
echo "all done $(date +%T)" >> $D/suite2.log

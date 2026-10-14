#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/pigeon; P=8977
while [ ! -f $D/suite4.done ]; do sleep 5; done
SHOTS=4,12,20,30 flock $L timeout 900 node $D/run.js $P 2 win 390 844 $D/p2w390.png 6 0 > $D/p2w390.log 2>&1
flock $L timeout 900 node $D/run.js $P 2 win 1280 720 $D/p2w1280.png 6 14 > $D/p2w1280.log 2>&1
echo done > $D/suite5.done

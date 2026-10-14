#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/pigeon; P=8977
SHOTS=5,14,24 flock $L timeout 900 node $D/run.js $P 2 win 390 844 $D/last390.png 6 0 > $D/last390.log 2>&1
echo done > $D/suite6.done

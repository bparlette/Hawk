#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh
L=/workspace/work/toad-city/locks/chrome.flock; D=T/pigeon
while ! grep -q "all done" $D/suite3.log; do sleep 5; done
flock $L timeout 600 node $D/dccmp.js 8977 8978 390 844 > $D/dccmp390.log 2>&1
flock $L timeout 600 node $D/dccmp.js 8977 8978 1280 720 > $D/dccmp1280.log 2>&1
echo done > $D/suite4.done

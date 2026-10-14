#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh; F=/workspace/work/toad-city/locks/chrome.flock; o=T/pete
flock $F timeout 300 node $o/entry.js 8763 390 844 8764 > $o/entry390.log 2>&1
flock $F timeout 300 node $o/entry.js 8763 1280 720 8764 > $o/entry1280.log 2>&1
flock $F timeout 800 node ccheck.js 8763 $o/cc390 390 844 > $o/cc390.log 2>&1
flock $F timeout 800 node ccheck.js 8763 $o/cc1280 1280 720 > $o/cc1280.log 2>&1
echo ALLDONE > $o/suite4.done

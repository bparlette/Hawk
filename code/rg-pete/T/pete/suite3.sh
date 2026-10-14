#!/bin/bash
cd "$(dirname "$0")/../.." && . ./env.sh; F=/workspace/work/toad-city/locks/chrome.flock; o=T/pete
flock $F timeout 300 node $o/entry.js 8763 390 844 8764 > $o/entry390.log 2>&1
flock $F timeout 300 node $o/entry.js 8763 1280 720 8764 > $o/entry1280.log 2>&1
flock $F timeout 300 node $o/entry.js 8763 390 844 - 1 > $o/entry_lexsim390.log 2>&1
echo ALLDONE > $o/suite3.done

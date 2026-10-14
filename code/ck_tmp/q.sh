#!/bin/bash
# queue of headless tests (serialized by the chrome flock); logs in /workspace/work/ck_tmp/r_<name>.log
cd /workspace/work/toad-city/game-chipkid-fun && . ./env.sh; O=/workspace/work/ck_tmp
F="nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 900"
run() { name=$1; shift; [ -f $O/ok_$name ] && return; echo "== $name $(date +%T)" >> $O/q.progress; $F "$@" > $O/r_$name.log 2>&1 && touch $O/ok_$name; }
run shots390 node T/duel/ckshot.js 8791 390 844 $O/s390 hit,special:mallet,special:homer,ko
run shots1280 node T/duel/ckshot.js 8791 1280 720 $O/s1280 special:cyclone
run win390 node T/duel/run.js 8791 chipkid win 390 844 - 3
run win1280 node T/duel/run.js 8791 chipkid win 1280 720 - 3
run mash390 node T/duel/run.js 8791 chipkid mash 390 844 - 3
run mash1280 node T/duel/run.js 8791 chipkid mash 1280 720 - 3
XQ="&ckhp=6" run lose390 node T/duel/run.js 8791 chipkid lose 390 844 - 3
run jimmy390 node T/duel/run.js 8791 jimmy win 390 844 - 3
run jimmy1280 node T/duel/run.js 8791 jimmy win 1280 720 - 3
run entry390 node T/duel/entry.js 8791 390 844
run citydc_new390 node T/duel/citydc.js 8791 390 844
run citydc_base390 node T/duel/citydc.js 8792 390 844
echo "== done $(date +%T)" >> $O/q.progress

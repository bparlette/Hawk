#!/bin/bash
O=/workspace/work/ck_tmp; while ! grep -q "== reg done" $O/q.progress 2>/dev/null; do sleep 10; done
cd /workspace/work/toad-city/game-chipkid-fun && . ./env.sh; echo "== live $(date +%T)" >> $O/q.progress
nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 400 node $O/live.js > $O/r_live.log 2>&1
echo "== citydc2 $(date +%T)" >> $O/q.progress
nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 300 node T/duel/citydc.js 8791 390 844 > $O/r_citydc_new390b.log 2>&1
nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 300 node T/duel/citydc.js 8792 390 844 > $O/r_citydc_base390b.log 2>&1
echo "== all done $(date +%T)" >> $O/q.progress

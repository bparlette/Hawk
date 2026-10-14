#!/bin/bash
# after q.sh: ccheck 390 on the branch build
O=/workspace/work/ck_tmp; while ! grep -q "== done" $O/q.progress 2>/dev/null; do sleep 15; done
cd /workspace/work/toad-city/game-chipkid-fun && . ./env.sh; mkdir -p $O/cc
echo "== cc390 $(date +%T)" >> $O/q.progress
nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 800 node ccheck.js 8791 $O/cc/cc_390 390 844 > $O/r_cc390.log 2>&1
echo "== cc done $(date +%T)" >> $O/q.progress

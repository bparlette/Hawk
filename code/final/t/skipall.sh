#!/bin/bash
# skipall.sh : boss_ent/ent.js touch-skip cases on final/site + rush.js queue test -> final/logs/skip_*.txt, summary final/logs/skip.log
cd /workspace/work/boss_ent; source /workspace/work/freeze_test/env.sh
export BASE=file:///workspace/work/final/site TOUCH=1 SKIP=${SKIP:-30}
for c in "$@"; do timeout ${TO:-400} node ent.js $c /workspace/work/final/shots/skip > /workspace/work/final/logs/skip_$c.txt 2>&1; echo "$(date +%T) $c $(grep -h RESULT /workspace/work/final/logs/skip_$c.txt | cut -c1-400) PE=$(grep -c PAGEERROR /workspace/work/final/logs/skip_$c.txt)" >> /workspace/work/final/logs/skip.log; done
SKIP= timeout 400 node rush.js > /workspace/work/final/logs/skip_rushq.txt 2>&1; echo "$(date +%T) rushq $(grep -h RESULT /workspace/work/final/logs/skip_rushq.txt | cut -c1-500)" >> /workspace/work/final/logs/skip.log
echo DONE >> /workspace/work/final/logs/skip.log

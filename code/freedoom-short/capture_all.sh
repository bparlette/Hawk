#!/bin/bash
# Re-capture every shot of the Short (deterministic). Runs in background; writes capture_all.log
W=/workspace/work/freedoom-short
cd $W/scripts
echo "start $(date)" > $W/capture_all.log
$W/setup.sh >> $W/capture_all.log 2>&1
for s in s1_ssg s2_cg s3_rl s6_arena_rl s4_arena s5_bfg; do
  python3 ../shot.py $s 23 $s.txt >> $W/capture_all.log 2>&1
  echo "done $s" >> $W/capture_all.log
done
echo ALL_DONE >> $W/capture_all.log

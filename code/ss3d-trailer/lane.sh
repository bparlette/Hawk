#!/bin/bash
# lane.sh mode beat... : capture beats serially (skips beats whose DONE exists in full mode)
cd /workspace/work/ss3d-trailer; source env.sh; M=$1; shift
for b in "$@"; do
  d=frames/$b; [ "$M" = pv ] && d=frames/pv_$b
  if [ "$M" = full ] && [ -f $d/DONE ]; then echo "skip $b"; continue; fi
  curl -s -o /dev/null http://127.0.0.1:8844/ || { python3 serve.py; sleep 1; }
  echo "== $b $(date +%T)"; node cap.js $b $M > logs/${M}_$b.log 2>&1; tail -2 logs/${M}_$b.log
done
echo LANE_END

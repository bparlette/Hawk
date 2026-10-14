#!/bin/bash
# render_all.sh [ids...]: re-render finals from cached segments (REUSE_SEGS) into /tmp, then copy into final/. Log: render_all.log
B=/workspace/work/toad-city/shorts/batch1; cd $B; mkdir -p /tmp/sout
for n in ${@:-01 02 03 04 05}; do
  out=$(python3 -c "import json,os;print(os.path.basename(json.load(open('specs/$n.json'))['out']))")
  for try in 1 2 3; do
    if REUSE_SEGS=1 OUT_DIR=/tmp/sout python3 edit.py specs/$n.json >> render_all.log 2>&1 && ffprobe -v error /tmp/sout/$out && cp /tmp/sout/$out final/$out.tmp && mv final/$out.tmp final/$out; then echo "OK $n $(date +%T)" >> render_all.log; break; fi
    echo "RETRY $n $try" >> render_all.log; sleep 3
  done
done
echo "ALLDONE $(date +%T)" >> render_all.log

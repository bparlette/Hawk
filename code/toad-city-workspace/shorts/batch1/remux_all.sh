#!/bin/bash
# remux_all.sh: re-render only the audio mix (WAV from 0, exact length) and remux it onto the existing final videos.
B=/workspace/work/toad-city/shorts/batch1; cd $B; mkdir -p /tmp/sout; L=$B/remux_all.log; : > $L
for n in 01 02 03 04 05; do
  out=$(python3 -c "import json,os;print(os.path.basename(json.load(open('specs/$n.json'))['out']))")
  cp final/$out /tmp/sout/$out
  if REMUX_AUDIO=1 REUSE_SEGS=1 OUT_DIR=/tmp/sout python3 edit.py specs/$n.json >> $L 2>&1 && ffprobe -v error /tmp/sout/$out; then
    cp /tmp/sout/$out final/$out.tmp && mv final/$out.tmp final/$out && echo "OK $n" >> $L; else echo "FAIL $n" >> $L; fi
done
$B/qa.sh; echo ALLDONE >> $L

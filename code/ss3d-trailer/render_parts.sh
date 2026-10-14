#!/bin/bash
# renders hfpart0..2 with HyperFrames (skips parts already rendered + verified), resumable across reboots
source /workspace/work/tip-trailer/hfenv.sh
cd /workspace/work/ss3d-trailer
for i in 0 1 2; do
  out=/workspace/work/ss3d-trailer/renders/part$i.mp4
  want=$(python3 -c "import re;print(re.search(r'data-composition-id=\"main\" data-start=\"0\" data-duration=\"([\d.]+)\"',open('hfpart$i/index.html').read()).group(1))")
  if [ -f $out ]; then got=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $out); if python3 -c "import sys;sys.exit(0 if abs($got-$want)<0.1 else 1)"; then echo "part$i ok ($got s) skip"; continue; fi; fi
  echo "== part$i ($want s) $(date +%T)"
  (cd hfpart$i && npx --yes hyperframes@0.8.145 render -o $out.tmp.mp4 -f 30 -q delivery -w 1 --low-memory-mode --video-frame-format jpg --browser-timeout 180 --player-ready-timeout 180000 . ) > logs/hf_part$i.log 2>&1
  echo "part$i exit $?"; [ -f $out.tmp.mp4 ] && mv $out.tmp.mp4 $out
done
echo PARTS_END

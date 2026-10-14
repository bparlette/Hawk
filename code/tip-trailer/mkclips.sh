#!/bin/bash
cd /workspace/work/tip-trailer; mkdir -p trailer/assets/clips
python3 -c "
import json
for n,s,st,c in json.load(open('clips.json')): print(n,s,st,c)
" | while read n s st c; do
  ffmpeg -nostdin -v error -y -framerate 30 -start_number $st -i frames/$s/%05d.png -frames:v $c -vf "scale=1080:1920:flags=neighbor,format=yuv420p" -c:v libx264 -preset veryfast -crf 18 -g 10 -movflags +faststart trailer/assets/clips/$n.mp4 && echo "clip $n ok"
done
echo ALLDONE

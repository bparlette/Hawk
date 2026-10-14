#!/bin/bash
# concat HF segments + mux music -> paradise-thunder.mp4
cd /workspace/work/brad-story/video
D=segments_final
ls $D/segment_*.mp4 | sort | sed "s#^#file '$PWD/#; s#\$#'#" > concat.txt
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i concat.txt -i pt/assets/music.wav \
  -map 0:v -map 1:a -c:v libx264 -preset medium -crf 21 -maxrate 5500k -bufsize 11000k -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -ar 48000 -t 47.0 -movflags +faststart /tmp/bs_pt.mp4 > finish.log 2>&1 \
  && cp /tmp/bs_pt.mp4 ../paradise-thunder.mp4
echo "FINISH EXIT $? $(date)" >> finish.log

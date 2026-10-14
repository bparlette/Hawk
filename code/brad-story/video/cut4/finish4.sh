#!/bin/bash
cd /workspace/work/brad-story/video
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i cut4/concat.txt -i cut4/a_new.wav -map 0:v -map 1:a \
 -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -profile:v high -r 30 -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart /tmp/bs_pt4.mp4 > cut4/finish4.log 2>&1 \
 && cp /tmp/bs_pt4.mp4 ../paradise-thunder.mp4
echo "EXIT $? $(date)" >> cut4/finish4.log

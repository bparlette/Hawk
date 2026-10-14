#!/bin/bash
# build segments -> concat -> mix -> mux (run after: python3 build.py jobs && node audio_render.js out/jobs.json out/stems)
set -e; cd /workspace/work/shorts/gulf-thunder
python3 build.py video hook title stage1 r1live & python3 build.py video r1replay end & python3 build.py video r2live r2replay & wait
python3 build.py audio
cd out; rm -f list.txt; for n in hook title stage1 r1live r1replay r2live r2replay end; do echo "file 'seg_$n.mp4'" >> list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy video.mp4
ffmpeg -v error -y -i video.mp4 -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11,volume=2dB,alimiter=limit=0.84:level=false" -ar 44100 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart ../gulf_thunder_short.mp4
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,profile,width,height,r_frame_rate,nb_frames -of compact ../gulf_thunder_short.mp4

#!/bin/bash
# v2 rebuild: segments -> concat -> stems -> mix -> mux. Captures live in v2/c (see v2/caps2.txt + PROGRESS.md).
set -e; cd /workspace/work/shorts/gulf-thunder; source /workspace/work/toad-city/game/env.sh
python3 build2.py list
python3 build2.py video hook title s1banner s1play s1intro s1ko & python3 build2.py video s2banner s2play s2intro s2ko s3banner s3play &
python3 build2.py video s3intro s3ko s3replay s4banner s4play & python3 build2.py video s4intro s4ko s5banner s5play s5intro &
python3 build2.py video s5ko s5replay end & wait
python3 build2.py jobs && NODE_PATH=/workspace/work/trailer_v2/node_modules node audio_render.js v2/out/jobs.json v2/out/stems
python3 build2.py audio
cd v2/out && ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy video.mp4
ffmpeg -v error -y -i video.mp4 -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11,volume=2dB,alimiter=limit=0.84:level=false" -ar 44100 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart ../../gulf_thunder_short.mp4

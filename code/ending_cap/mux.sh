#!/bin/bash
# mux.sh <capdir> <out.mp4> : game SFX (offline WebAudio) + the game's own synth bed (shorts raw/music/chill.wav, looped) -> H.264/AAC faststart
set -e; C=$1; OUT=$2; M=/workspace/work/toad-city/shorts/batch1/raw/music/chill.wav
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $C/raw.mp4)
FO=$(python3 -c "print(round($D-2.5,3))")
ffmpeg -y -v error -i $C/raw.mp4 -i $C/sfx.wav -stream_loop -1 -i $M -filter_complex \
"[1:a]volume=0dB,apad[sfx];[2:a]volume=${MUSDB:--11}dB,afade=t=in:st=0:d=1.5,afade=t=out:st=$FO:d=2.5[mus];[sfx][mus]amix=inputs=2:normalize=0:duration=first,atrim=end=$D,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]" \
-map 0:v -map "[a]" -c:v libx264 -preset slow -crf ${CRF:-20} -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
-c:a aac -b:a 192k -ac 2 -movflags +faststart -t $D $OUT
ls -la $OUT

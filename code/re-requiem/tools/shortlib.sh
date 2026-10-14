#!/usr/bin/env bash
# Builds the 4 Shorts from the captures. 1080x1920, 30fps, H.264 + AAC.
R=/workspace/work/re-requiem; C=$R/cap; S=$R/shorts; T=$R/cap/seg; mkdir -p $S $T
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ENC="-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 44100 -ac 2"
# seg <capture> <start> <dur> <out> [extra vf]: frame-accurate cut of a game capture (frames + offline game audio), upscaled 720->1080
seg() { local d=$C/$1; ffmpeg -v error -y -framerate 30 -i $d/f/%05d.jpg -i $d/audio.wav -ss $2 -t $3 \
  -vf "scale=1080:1920:flags=lanczos,setsar=1${5:+,$5}" -af "aresample=44100" $ENC $T/$4.mp4; }
txt() { echo "drawtext=fontfile=$F:text='$1':fontsize=${3:-84}:fontcolor=${4:-white}:borderw=8:bordercolor=black:x=(w-tw)/2:y=$2"; }
cat_() { local out=$1; shift; printf "file '%s'\n" "$@" > $T/list.txt; ffmpeg -v error -y -f concat -safe 0 -i $T/list.txt $ENC -af "loudnorm=I=-14:TP=-1.5:LRA=11" -movflags +faststart $out; }

# 1) jump-scare compilation
# safe concat: encode to /tmp then move (avoids half-written mp4s if a run is killed)
cat_safe() { local out=$1; shift; local tmp=/tmp/$(basename $out); cat_ $tmp "$@" && mv -f $tmp $out; }

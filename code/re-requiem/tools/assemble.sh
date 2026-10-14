#!/usr/bin/env bash
# Builds the 4 Shorts from the captures. 1080x1920, 30fps, H.264 + AAC.
set -e
R=/workspace/work/re-requiem; C=$R/cap; S=$R/shorts; T=$R/cap/seg; mkdir -p $S $T
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ENC="-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 44100 -ac 2"
# seg <capture> <start> <dur> <out> [extra vf]: frame-accurate cut of a game capture (frames + offline game audio), upscaled 720->1080
seg() { local d=$C/$1; ffmpeg -v error -y -framerate 30 -i $d/f/%05d.jpg -i $d/audio.wav -ss $2 -t $3 \
  -vf "scale=1080:1920:flags=lanczos,setsar=1${5:+,$5}" -af "aresample=44100" $ENC $T/$4.mp4; }
txt() { echo "drawtext=fontfile=$F:text='$1':fontsize=${3:-84}:fontcolor=${4:-white}:borderw=8:bordercolor=black:x=(w-tw)/2:y=$2"; }
cat_() { local out=$1; shift; printf "file '%s'\n" "$@" > $T/list.txt; ffmpeg -v error -y -f concat -safe 0 -i $T/list.txt $ENC -af "loudnorm=I=-14:TP=-1.5:LRA=11" -movflags +faststart $out; }

# 1) jump-scare compilation
seg F_lightning 0.0 4.6 s1a "$(txt 'SCARE 1/4' 1700 56 '#ffd23a')"
seg F_door 0.2 3.8 s1b "$(txt 'SCARE 2/4' 1700 56 '#ffd23a')"
seg F_wardrobe 5.0 3.6 s1c "$(txt 'SCARE 3/4' 1700 56 '#ffd23a')"
seg F_caught 0.0 5.6 s1d "$(txt 'SCARE 4/4' 1700 56 '#ffd23a')"
cat_ $S/requiem_short1_jumpscare_compilation.mp4 $T/s1a.mp4 $T/s1b.mp4 $T/s1c.mp4 $T/s1d.mp4

# 2) wardrobe hold-breath near miss: cold open on the peek, then the whole thing
seg F_wardrobe 5.6 2.0 s2a "$(txt 'WOULD YOU BREATHE?' 1600 70 '#ff4040')"
seg F_wardrobe 0.0 2.8 s2b
seg F_wardrobe 4.5 10.5 s2c
cat_ $S/requiem_short2_wardrobe_near_miss.mp4 $T/s2a.mp4 $T/s2b.mp4 $T/s2c.mp4

# 3) laser crit escape run
seg F_laser 0.0 16.0 s3a
cat_ $S/requiem_short3_laser_crit_escape.mp4 $T/s3a.mp4
echo ASSEMBLED

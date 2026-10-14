#!/usr/bin/env bash
# Short 4: bloopers from the other AI's builds (v2/v3 stalker has no wall collision, walks into the camera).
# Frames: fixed-step captures (tools/stepcap.js) in cap/bl/{v2h,v3h,v2s}, 15 fps canvas-only, 540x960.
# Audio: each build's own WebAudio, recorded live (cap/bl/v2c 3.5s, v3c 7.9s), looped as a bed (not frame-synced: stepcap has no audio).
# usage: short4.sh seg|cat
source /workspace/work/re-requiem/tools/shortlib.sh
B=$C/bl
# bseg <framedir> <startframe> <nframes> <speed> <audio.wav> <audio start s> <out> <vf extra>
bseg() { local dur=$(python3 -c "print(round($3/15/$4,3))")
  ffmpeg -v error -y -framerate 15 -start_number $2 -i $B/$1/f/%05d.jpg -stream_loop -1 -ss $6 -i $5 -frames:v $(python3 -c "print(int(round($dur*30)))") -t $dur \
   -vf "setpts=PTS/$4,fps=30,scale=1080:1920:flags=lanczos,setsar=1${8:+,$8}" -af "aresample=44100,apad" $ENC $T/$7.mp4; }
if [ "$1" = seg1 ]; then
bseg v2h 0 63 1 $B/v2c/audio.wav 0.0 b4a "$(txt 'AI BLOOPERS' 200 62 '#ffd23a'),$(txt 'REQUIEM v2 (OTHER AI)' 290 50),$(txt 'WALLS ARE OPTIONAL' 1640 74 '#ff4040')"
bseg v2h 20 20 0.5 $B/v2c/audio.wav 1.0 b4b "$(txt 'SLOW-MO REPLAY' 200 62 '#ffd23a'),$(txt 'STRAIGHT THROUGH THE WALL' 1640 54 '#ff4040')"
fi
if [ "$1" = seg2 ]; then
bseg v3h 0 63 1 $B/v3c/audio.wav 0.0 b4c "$(txt 'REQUIEM v3 DIRECTORS CUT' 200 56 '#ffd23a'),$(txt 'SAME GHOST, NEW WALLPAPER' 1640 54 '#ff4040')"
bseg v2s 25 50 1 $B/v2c/audio.wav 0.5 b4d "$(txt 'BONUS BUG' 200 62 '#ffd23a'),$(txt 'IT WALKS INTO YOUR FACE' 1640 66 '#ff4040')"
fi
if [ "$1" = seg3 ]; then
seg F_lightning 0.0 4.6 b4e "$(txt 'MEANWHILE, THE FINAL BUILD' 1560 56 '#ffd23a'),$(txt 'PLAY IT ON BRADS DEMOS' 1650 54)"
fi
if [ "$1" = cat ]; then
cat_safe $S/requiem_short4_ai_bloopers.mp4 $T/b4a.mp4 $T/b4b.mp4 $T/b4c.mp4 $T/b4d.mp4 $T/b4e.mp4
fi

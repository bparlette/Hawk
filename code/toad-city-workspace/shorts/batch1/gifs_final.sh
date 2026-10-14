#!/bin/bash
# gifs_final.sh: looping web GIFs cut from the FINAL Shorts (captions included) -> gifs/<name>.gif (+ poster .jpg)
# Window per Short = its punchiest ~5 s (around the hit). 360x640, 12 fps, per-clip palette; shrinks until < 4 MB.
B=/workspace/work/toad-city/shorts/batch1; cd $B; mkdir -p gifs; L=$B/gifs_final.log; [ -n "$ONLY" ] || : > $L
while read -r name start dur poff; do
  [ -n "$ONLY" ] && [[ " $ONLY " != *" ${name:0:2} "* ]] && continue
  src=final/$name.mp4; [ -f "$src" ] || { echo "MISSING $src" >> $L; continue; }
  for cfg in "360 12 256" "360 12 160" "320 12 128" "288 10 112"; do
    set -- $cfg; w=$1; fps=$2; cols=$3
    ffmpeg -nostdin -v error -y -ss $start -t $dur -i $src -vf "fps=$fps,scale=$w:-2:flags=lanczos,palettegen=max_colors=$cols:stats_mode=diff" -frames:v 1 -update 1 /tmp/pal_$name.png
    ffmpeg -nostdin -v error -y -ss $start -t $dur -i $src -i /tmp/pal_$name.png -lavfi "fps=$fps,scale=$w:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 /tmp/$name.gif
    sz=$(stat -c %s /tmp/$name.gif); echo "$name w=$w fps=$fps colors=$cols size=$sz" >> $L
    [ $sz -lt 4000000 ] && break
  done
  cp /tmp/$name.gif gifs/$name.gif
  ffmpeg -nostdin -v error -y -ss $(awk "BEGIN{print $start+${poff:-1}}") -i $src -vf "scale=360:-2:flags=lanczos" -frames:v 1 -update 1 -q:v 4 gifs/$name.jpg
done <<'LIST'
01_grandma_vs_penthouse_pigeon 12.8 5
02_stoop_scrubber_marble_steps 12.4 5
03_hon_queen_federal_hill 12.8 5
04_chompy_harbor_fishing 17.5 5
05_poe_stealth_night_nevermore 10.0 5 2.5
LIST
ls -la gifs >> $L; echo GIFSDONE >> $L

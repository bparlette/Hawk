#!/bin/bash
# gif.sh <rawname> <start> <dur> <outname> [w=360]: looping GIF (palettegen/paletteuse, 15 fps, 9:16) + animated WebP + MP4 loop, aiming < 3 MB GIF
B=${SHORTS_BASE:-/workspace/work/toad-city/shorts/batch1}; OUT=${GIF_OUT:-$B/gifs}; mkdir -p $OUT
src=$B/raw/$1/$1_raw.mp4; a=$2; d=$3; n=$4; w=${5:-360}
for cols in 256 160 112 80; do
  ffmpeg -v error -y -ss $a -t $d -i $src -vf "fps=15,scale=$w:-2:flags=lanczos,palettegen=max_colors=$cols:stats_mode=diff" -frames:v 1 -update 1 /tmp/pal_$n.png
  ffmpeg -v error -y -ss $a -t $d -i $src -i /tmp/pal_$n.png -lavfi "fps=15,scale=$w:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 $OUT/$n.gif
  sz=$(stat -c %s $OUT/$n.gif); echo "$n gif colors=$cols size=$sz"; [ $sz -lt 3000000 ] && break
done
ffmpeg -v error -y -ss $a -t $d -i $src -vf "fps=15,scale=$w:-2:flags=lanczos" -c:v libwebp -lossless 0 -q:v 62 -compression_level 5 -loop 0 -an $OUT/$n.webp
ffmpeg -v error -y -ss $a -t $d -i $src -vf "fps=30,scale=$w:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryfast -crf 24 -an -movflags +faststart $OUT/$n.mp4
ffmpeg -v error -y -ss $(echo "$a + $d/2" | bc -l) -i $src -vf "scale=$w:-2:flags=lanczos" -frames:v 1 -update 1 -q:v 4 $OUT/$n.jpg
ls -la $OUT/$n.*

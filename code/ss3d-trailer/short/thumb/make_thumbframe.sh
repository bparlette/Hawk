#!/bin/bash
# Short + thumbnail held as the final 8 frames (0.2667 s) for YouTube's mobile frame picker.
set -e
R=/workspace/work/ss3d-trailer/short
OUT=/tmp/shellshock3d-short-9x16-thumbframe.mp4
nice -n 10 ffmpeg -y -v error -i $R/shellshock3d-short-9x16.mp4 -loop 1 -framerate 30 -i $R/thumbnail_9x16.png -filter_complex \
"[0:v]setsar=1,format=yuvj420p[a];[1:v]trim=end_frame=8,setpts=PTS-STARTPTS,scale=1080:1920:out_color_matrix=bt601:out_range=full,setsar=1,format=yuvj420p[b];[a][b]concat=n=2:v=1:a=0[v];[0:a]apad[au]" \
 -map '[v]' -map '[au]' -t 25.66667 -c:v libx264 -preset medium -crf 18 -profile:v high -pix_fmt yuvj420p -color_range pc -colorspace bt470bg -r 30 \
 -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart $OUT
cp $OUT $R/shellshock3d-short-9x16-thumbframe.mp4

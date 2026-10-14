#!/usr/bin/env bash
cd "$(dirname "$0")"; O=r16/out
python3 -u render16.py screen || exit 1
ffmpeg -y -v error -i $O/full_screen.mp4 -i orig/v/full_screen.webm -map 0:v -map 1:a -c:a copy -c:v libvpx-vp9 -b:v 1590k -deadline good -cpu-used 4 -row-mt 1 -pix_fmt yuv420p $O/fs_tmp.webm && mv $O/fs_tmp.webm $O/full_screen.webm || exit 1
echo SCREEN_DONE

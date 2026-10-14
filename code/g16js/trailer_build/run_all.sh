#!/usr/bin/env bash
# resumable: skips outputs that already exist. Log: logs/run_all.log
cd "$(dirname "$0")"
O=r16/out
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  [ -s $O/game/level$n.mp4 ] && [ $O/game/level$n.mp4 -nt render16.py ] || python3 -u render16.py game $n || exit 1
done
[ -s $O/full_screen.mp4 ] || python3 -u render16.py screen || exit 1
[ -s $O/full_trailer.mp4 ] || python3 -u render16.py full || exit 1
[ -s $O/full_screen.webm ] || ffmpeg -y -v error -i $O/full_screen.mp4 -i orig/v/full_screen.webm -map 0:v -map 1:a -c:a copy -c:v libvpx-vp9 -b:v 1590k -deadline good -cpu-used 4 -row-mt 1 -pix_fmt yuv420p $O/full_screen.webm.tmp.webm && mv $O/full_screen.webm.tmp.webm $O/full_screen.webm || exit 1
python3 -u stills16.py || exit 1
echo ALL_DONE

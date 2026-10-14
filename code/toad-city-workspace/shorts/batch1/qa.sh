#!/bin/bash
# qa.sh: contact sheet (12 evenly spaced frames, timestamped) + ffprobe + volumedetect for every final MP4 -> qa/final/
B=/workspace/work/toad-city/shorts/batch1; cd $B; mkdir -p qa/final; R=qa/final/audio_video_check.txt; : > $R
for f in final/*.mp4; do n=$(basename $f .mp4); d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)
  echo "$n dur=$d $(ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,sample_rate,channels,start_time -of compact=nk=0 $f | tr '\n' ' ') $(ffmpeg -nostats -i $f -af volumedetect -vn -f null - 2>&1 | grep -oE '(mean|max)_volume: [-0-9.]+ dB' | tr '\n' ' ')" >> $R
  ffmpeg -v error -y -i $f -vf "fps=12/$d,scale=270:480,drawtext=fontfile=/workspace/work/trailer_v2/fonts/Anton.ttf:text='%{pts\:hms}':x=6:y=446:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x2:padding=4" -frames:v 1 -update 1 qa/final/${n}_contact.jpg
done
echo QADONE >> $R

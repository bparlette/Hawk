#!/bin/bash
# edit -> mix -> mux -> verify. Background-safe; log in build/finish.log
W=/workspace/work/freedoom-short
mkdir -p $W/build
L=$W/build/finish.log
echo "start $(date)" > $L
bash $W/setup.sh >> $L 2>&1
python3 $W/edit.py >> $L 2>&1 || { echo EDIT_FAIL >> $L; exit 1; }
python3 $W/mix.py >> $L 2>&1 || { echo MIX_FAIL >> $L; exit 1; }
ffmpeg -loglevel error -y -i $W/build/video_noaudio.mp4 -i $W/build/audio.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart $W/freedoom-frenzy-short.mp4 >> $L 2>&1
# labeled contact sheet: every 6th frame with timestamp
ffmpeg -loglevel error -y -i $W/freedoom-frenzy-short.mp4 -vf "select='not(mod(n\,6))',scale=216:384,drawtext=fontfile=$W/assets/Anton-Regular.ttf:text='%{pts\:hms}':x=6:y=6:fontsize=22:fontcolor=yellow:borderw=2:bordercolor=black,tile=12x12" -frames:v 1 $W/build/contact_sheet.png >> $L 2>&1
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration -of default=nw=1 $W/freedoom-frenzy-short.mp4 >> $L 2>&1
echo FINISH_DONE >> $L

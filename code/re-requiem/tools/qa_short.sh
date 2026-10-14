#!/usr/bin/env bash
# qa_short.sh <mp4>: streams, durations, faststart, decode check, contact sheet (<mp4>.sheet.png)
f=$1
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,duration -show_entries format=duration -of compact "$f"
python3 - "$f" <<'PY'
import sys; d=open(sys.argv[1],'rb').read(1<<20); m=d.find(b'moov'); md=d.find(b'mdat'); print('faststart', m!=-1 and (md==-1 or m<md))
PY
ffmpeg -v error -i "$f" -f null - 2>&1 | head -3; echo decode-ok
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
ffmpeg -v error -y -i "$f" -vf "fps=12/$dur,scale=216:384,tile=6x2" -frames:v 1 "${f%.mp4}.sheet.png"

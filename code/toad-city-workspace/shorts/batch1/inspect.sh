#!/bin/bash
# inspect.sh <name> [fps=1] [start] [dur]: duration, event log, contact sheet qa/<name>_contact.jpg
cd /workspace/work/toad-city/shorts/batch1/raw/$1 || exit 1
FPS=${2:-1}; SS=${3:-0}; DUR=${4:-200}
ffprobe -v error -show_entries format=duration -of csv=p=0 $1_raw.mp4
python3 - "$1" <<'EOF'
import json,sys
prev=None
for l in open(sys.argv[1]+'.jsonl'):
  d=json.loads(l)
  ev=[x for x in d['lg'] if not x.startswith('say:')]
  key=(d.get('bhp'),d.get('hp'),d.get('j'),d.get('res'))
  if ev or (prev and key[0]!=prev[0] and d['f']%3==0) or (prev and key[2:]!=prev[2:]):
    print(d['f'], round(d['f']/30,2), 'bhp',d.get('bhp'),'hp',d.get('hp'),'j',d['j'],d.get('res'), ev[:4], d.get('fish') if ev else '', d.get('poe') if ev else '')
  prev=key
EOF
ffmpeg -v error -y -ss $SS -t $DUR -i $1_raw.mp4 -vf "fps=$FPS,scale=216:-2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{pts\:hms}':x=4:y=h-26:fontsize=18:fontcolor=yellow:box=1:boxcolor=black,tile=8x5" -frames:v 1 -update 1 ../../qa/$1_contact.jpg && echo sheet ok

#!/bin/bash
# qa.sh : ffprobe + volumedetect + contact sheet for the ending video
F=/workspace/work/toad-city/media/toadcity_ending.mp4; Q=/workspace/work/ending_cap/qa; mkdir -p $Q
{
echo "== size"; stat -c %s $F
echo "== ffprobe"; ffprobe -v error -show_entries format=duration,size,bit_rate:stream=index,codec_name,profile,width,height,r_frame_rate,nb_frames,pix_fmt,sample_rate,channels -of default=nw=1 $F
echo "== faststart (moov before mdat?)"; python3 - "$F" <<'EOF'
import sys,struct
f=open(sys.argv[1],'rb'); order=[]
while True:
    h=f.read(8)
    if len(h)<8: break
    sz,t=struct.unpack('>I4s',h); t=t.decode('latin1'); order.append(t)
    if sz==1: sz=struct.unpack('>Q',f.read(8))[0]; f.seek(sz-16,1)
    elif sz==0: break
    else: f.seek(sz-8,1)
print(order, 'FASTSTART OK' if order.index('moov')<order.index('mdat') else 'NOT FASTSTART')
EOF
echo "== volumedetect (whole)"; ffmpeg -hide_banner -nostats -i $F -map 0:a -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
for s in 0 15 25 45 75; do echo "== volumedetect ${s}s+10s"; ffmpeg -hide_banner -nostats -ss $s -t 10 -i $F -map 0:a -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"; done
} > $Q/qa.txt 2>&1
ffmpeg -y -v error -i $F -vf "fps=1/4,scale=216:384,tile=7x3:padding=4:color=black" -frames:v 1 $Q/contact.jpg
cat $Q/qa.txt

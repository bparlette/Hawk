#!/bin/bash
# enc.sh : frames (1080x1919 jpg) + game SFX (offline WebAudio) + the game's own synth bed (shorts raw/music/chill.wav, looped)
#          -> one-pass H.264/AAC faststart. Encodes to local /tmp first (JuiceFS trailer write failed once), then copies.
set -e; cd /workspace/work/ending_cap
C=full; OUT=/workspace/work/toad-city/media/toadcity_ending.mp4; M=/workspace/work/toad-city/shorts/batch1/raw/music/chill.wav
N=${NF:-$(cat $C/nframes.txt)}; D=$(python3 -c "print(round($N/30,4))"); FO=$(python3 -c "print(round($D-2.5,3))")
ffmpeg -y -v error -framerate 30 -i $C/frames/%05d.jpg -i $C/sfx.wav -stream_loop -1 -i $M -filter_complex \
"[0:v]scale=1080:1920:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p,fade=t=out:st=$(python3 -c "print(round($D-0.6,3))"):d=0.6[v];[1:a]apad[sfx];[2:a]volume=${MUSDB:--11}dB,afade=t=in:st=0:d=1.5,afade=t=out:st=$FO:d=2.5[mus];[sfx][mus]amix=inputs=2:normalize=0:duration=first,atrim=end=$D,afade=t=out:st=$FO:d=2.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]" \
-map "[v]" -map "[a]" -c:v libx264 -preset medium -crf ${CRF:-21} -maxrate 4800k -bufsize 9600k -pix_fmt yuv420p -color_range tv -profile:v high -level 4.2 -r 30 \
-c:a aac -b:a 192k -ac 2 -movflags +faststart -t $D /tmp/toadcity_ending.mp4
cp /tmp/toadcity_ending.mp4 $OUT.tmp && mv $OUT.tmp $OUT
ls -la $OUT

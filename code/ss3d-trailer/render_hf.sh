#!/bin/bash
cd /workspace/work/ss3d-trailer/hfproj; source /workspace/work/tip-trailer/hfenv.sh
export HF_SEGMENTED_CAPTURE=true
npx --yes hyperframes@0.8.145 render -o /workspace/work/ss3d-trailer/renders/hf_trailer.mp4 -f 30 -q delivery -w 1 --low-memory-mode --resume --keep-segments --video-frame-format jpg --browser-timeout 180 --player-ready-timeout 180000 .
echo "EXIT $?"

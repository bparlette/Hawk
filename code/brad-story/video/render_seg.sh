#!/bin/bash
# Detached segmented HyperFrames render: 120-frame (4 s) segments, resumable.
cd /workspace/work/brad-story/video
source hf_env.sh
export HF_SEGMENTED_CAPTURE=true HF_SEGMENT_FRAMES=120 HYPERFRAMES_RENDER_DETACHED=1
cd pt
LOG=${1:-../render_seg.log}
echo "START $(date)" >> "$LOG"
./node_modules/.bin/hyperframes render . -o renders/pt_hf.mp4 --fps 30 -q delivery -w 1 --resume --keep-segments >> "$LOG" 2>&1
echo "EXIT $? $(date)" >> "$LOG"

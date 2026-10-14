#!/bin/bash
setsid nohup /workspace/work/brad-story/video/render_seg.sh "$@" > /dev/null 2>&1 < /dev/null &
echo launched $!

#!/usr/bin/env bash
# make_short.sh : shorts/frames/*.jpg (540x960, sim-stepped 0.1 s per frame) -> shorts/toad-city-dead-streets-short.mp4 (1080x1920, 30 fps, silent)
set -e
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -framerate 10 -i shorts/frames/%04d.jpg -vf "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 23 -movflags +faststart shorts/toad-city-dead-streets-short.mp4
ls -la shorts/toad-city-dead-streets-short.mp4

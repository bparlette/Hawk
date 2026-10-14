#!/bin/bash
cd /workspace/work/mashup-brawler/render
export LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/workspace/work/mashup-brawler/.pw
for c in 4 6; do node ../test/render.js $c /workspace/work/mashup-brawler/render/clip$c > log$c.txt 2>&1 & done; wait
mv clip6.mp4 clip6_whole_game.mp4; echo ALLDONE > done.txt

#!/bin/bash
cd /workspace/work/mashup-brawler/render
export LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/workspace/work/mashup-brawler/.pw
for pair in "1 2" "3 4" "5 6"; do
 for c in $pair; do node ../test/render.js $c /workspace/work/mashup-brawler/render/clip$c > log$c.txt 2>&1 & done; wait
done
echo ALLDONE > done.txt

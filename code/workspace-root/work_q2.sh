#!/usr/bin/env bash
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
cd /workspace/work/socal-painted
flock /workspace/work/toad-city/locks/chrome.flock timeout 400 node qa/live.js "$1" "$2" > "$3" 2>&1; echo DONE >> "$3"

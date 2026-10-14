#!/usr/bin/env bash
# qa/run.sh <logname> <node script + args...>   (runs under the shared chrome flock; waits for the lock up to 20 min)
cd /workspace/work/bmore-skate
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
LOG=qa/$1.log; shift
echo "queued $(date +%T)" > "$LOG"
flock -w 3600 /workspace/work/toad-city/locks/chrome.flock bash -c 'echo "start $(date +%T)"; timeout 900 node "$@"; echo "rc $? $(date +%T)"' _ "$@" >> "$LOG" 2>&1
echo DONE >> "$LOG"

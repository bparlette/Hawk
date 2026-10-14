#!/usr/bin/env bash
# qa/bg.sh <logname> <script> args... : run a QA script in the background (own timeout 600s), log to qa/logs/<logname>.log
cd /workspace/work/socal-painted; mkdir -p qa/logs
curl -s -o /dev/null -m 2 http://127.0.0.1:8817/index.html || { setsid nohup python3 -m http.server 8817 -d /workspace/work/socal-painted/build >/dev/null 2>&1 & sleep 1.2; }
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers LD_LIBRARY_PATH=/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu
L=$1; shift
setsid nohup bash -c "timeout 600 flock /workspace/work/toad-city/locks/chrome.flock node $* > qa/logs/$L.log 2>&1; echo DONE >> qa/logs/$L.log" >/dev/null 2>&1 &
echo started $L

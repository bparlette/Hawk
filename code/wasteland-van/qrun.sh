#!/usr/bin/env bash
# qrun.sh <logname> <w> <h> <steps>: detached QA run (server + shared Chrome lock); read T/<logname>.log
cd /workspace/work/wasteland-van
curl -s -o /dev/null -m 2 http://127.0.0.1:8761/index.html || { python3 /workspace/work/ss3d-bakeoff/i_cel/serve.py 8761 /workspace/work/wasteland-van/site; sleep 1; }
python3 /workspace/work/demos/tools/detach.py /workspace/work/wasteland-van/T/$1.log flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node /workspace/work/wasteland-van/qa.js 8761 /workspace/work/wasteland-van/T/qa $2 $3 $4

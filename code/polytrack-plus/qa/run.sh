#!/usr/bin/env bash
# run.sh <cmd...> : env + local server + chrome flock
cd /workspace/work/polytrack-plus; source qa/env.sh
exec flock /workspace/work/toad-city/locks/chrome.flock timeout 1500 "$@"

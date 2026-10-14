#!/usr/bin/env bash
# T/multi.sh <log> "<cmd1>" "<cmd2>" ...: run several node jobs back to back under ONE hold of the shared chrome lock (detached)
cd /workspace/work/bmore-parkour; . T/env.sh; bash T/serve.sh; log=$1; shift
printf '%s\n' "$@" > T/.multi_cmds
setsid nohup flock /workspace/work/toad-city/locks/chrome.flock bash -c 'while IFS= read -r c; do echo "=== $c"; timeout 900 bash -c "$c"; done < T/.multi_cmds' > "$log" 2>&1 < /dev/null &
disown; echo started

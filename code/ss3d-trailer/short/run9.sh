#!/bin/bash
# short/run9.sh mode spec... : serial portrait captures under the shared chrome flock.
#   test: spec = beat (4 sample frames).  full: spec = beat or beat:a:z (only screenshot frames a..z-1; skips beats with DONE)
cd /workspace/work/ss3d-trailer; source env.sh; M=$1; shift
for spec in "$@"; do
  b=${spec%%:*}; r=4; [ "$spec" != "$b" ] && r=${spec#*:}
  [ "$M" = full ] && [ -f short/frames/$b/DONE ] && { echo "skip $b"; continue; }
  curl -s -o /dev/null http://127.0.0.1:8844/ || { python3 serve.py; sleep 1; }
  echo "== $b $r wait-lock $(date +%T)"
  flock /workspace/work/toad-city/locks/chrome.flock nice -n 5 node short/cap9.js $b $M $r > short/logs/${M}_$b.log 2>&1; tail -2 short/logs/${M}_$b.log
done
echo RUN_END $(date +%T)

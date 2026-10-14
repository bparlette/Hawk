#!/usr/bin/env bash
# final.sh — fresh copy of the deploy folder -> serve -> cabinet refs -> capture all 15 levels (2 lanes)
cd "$(dirname "$0")"; export LD_LIBRARY_PATH=/workspace/work/ss_trailer/libs/aarch64-linux-gnu
if [ ! -f final_game/.snap_done ]; then
  rm -rf final_game; cp -a /workspace/work/deploy/shell-shock-live-action final_game; date -u +%FT%TZ > final_game/.snap_done
fi
python3 - <<'PY'
import sys
p="final_game/index.html"
PY
[ -f serve_final/index.html ] || timeout 60 ./snapshot2.sh final_game serve_final 8776 < /dev/null > logs/snap_final.log 2>&1
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8776/index.html | grep -q 200 || { (cd serve_final && setsid nohup python3 -m http.server 8776 >/dev/null 2>&1 </dev/null &); sleep 2; }
[ -f ref_final/geom.json ] || timeout 100 node ref.js http://127.0.0.1:8776 ref_final > logs/ref_final.log 2>&1
./lane.sh raw_final 8776 serve_final 15 4 11 14 10 13 12 7 > logs/laneA.log 2>&1 &
./lane.sh raw_final 8776 serve_final 1 9 5 2 8 3 6 > logs/laneB.log 2>&1 &
wait
echo ALLDONE >> logs/laneA.log

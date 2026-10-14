#!/usr/bin/env bash
# capture queue: one game at a time under the shared chrome lock
V=/workspace/work/viral-shorts; L=$V/logs
. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory
LOCK=/workspace/work/toad-city/locks/chrome.flock
run() { local name=$1; shift; echo "queued $(date +%T)" > $L/$name.log; flock -w 5400 $LOCK bash -c 'echo "start $(date +%T)"; timeout 1500 "$@"; echo "rc $? $(date +%T)"' _ "$@" >> $L/$name.log 2>&1; echo DONE >> $L/$name.log; }
for a in "$@"; do case $a in
 skate) cd /workspace/work/bmore-skate; run skate node qa/cap.js $V/cap/skate 540 960 '?capture&autostart&bot=route&sim=2' 0 780 ;;
 surv) curl -s -o /dev/null -m 2 http://127.0.0.1:8745/index.html || { (setsid nohup python3 -m http.server 8745 -d /workspace/work/survivors-plus/game >/dev/null 2>&1 < /dev/null &); sleep 2; }
       cd /workspace/work/survivors-plus/qa; for s in horde evolve reaper; do run surv_$s node cap.js $V/cap/surv $s; done ;;
 paper) curl -s -o /dev/null -m 2 http://127.0.0.1:8793/index.html || { (cd /workspace/work/bmore-paperboy/site && setsid nohup python3 -m http.server 8793 --bind 127.0.0.1 >/dev/null 2>&1 < /dev/null &); sleep 2; }
       cd /workspace/work/bmore-paperboy; run paper node tools/cap.js 8793 $V/cap/paper 540 960 16 4 ;;
 socal) curl -s -o /dev/null -m 2 http://127.0.0.1:8817/index.html || { (cd /workspace/work/socal-painted/build && setsid nohup python3 -m http.server 8817 --bind 127.0.0.1 >/dev/null 2>&1 < /dev/null &); sleep 2; }
       cd /workspace/work/socal-painted; for e in 2 0 4; do run socal_e$e node qa/capshort.js $e 70 2500; done ;;
 park) bash /workspace/work/bmore-parkour/T/serve.sh; sleep 2; cd /workspace/work/bmore-parkour; run park node $V/tools/cap_parkour.js $V/cap/park 0 520 ;;
esac; done
echo ALLDONE $(date +%T) > $L/queue.done

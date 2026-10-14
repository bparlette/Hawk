#!/usr/bin/env bash
# runqa.sh "<w> <h> <plan>" ["<w> <h> <plan>" ...] : headless QA runs back-to-back under ONE hold of the shared chrome lock
# (detached; each run logs to qa/<w>x<h>-<plan>.log; qa/batch.log marks start/end)
cd "$(dirname "$0")/.." && mkdir -p qa
. /workspace/work/freeze_test/env.sh
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/workspace/work/chromelibs/root/usr/lib/aarch64-linux-gnu GIO_USE_PROXY_RESOLVER=dummy GSETTINGS_BACKEND=memory
export PLAYWRIGHT_BROWSERS_PATH=/workspace/work/freeze_test/pw-browsers
curl -s -o /dev/null http://127.0.0.1:8796/index.html || (cd site && setsid nohup python3 -m http.server 8796 --bind 127.0.0.1 > /tmp/dz_srv.log 2>&1 < /dev/null &)
CMD='echo "got lock $(date +%T)"; for r in "$@"; do set -- $r; timeout 900 node tools/qa.js 8796 $1 $2 $3 > qa/$1x$2-$3.log 2>&1; echo "done $1x$2-$3 rc=$? $(date +%T)"; done'
setsid nohup flock /workspace/work/toad-city/locks/chrome.flock bash -c "for r in \"\$@\"; do set -- \$r; timeout 900 node tools/qa.js 8796 \$1 \$2 \$3 > qa/\$1x\$2-\$3.log 2>&1; echo \"done \$1x\$2-\$3 rc=\$? \$(date +%T)\"; done" _ "$@" > qa/batch.log 2>&1 < /dev/null &
echo started

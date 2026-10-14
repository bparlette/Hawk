#!/bin/bash
# sequential headless runs; usage: runall.sh name:kind:mode:w:h:xq ...
cd /workspace/work/toad-city/game-chipkid-fun && . ./env.sh
for spec in "$@"; do IFS=: read name kind mode w h xq shot <<< "$spec"
  XQ="$xq" nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node T/duel/run.js ${PORT:-8791} $kind $mode $w $h ${shot:--} 3 > /workspace/work/ck_tmp/$name.log 2>&1
done
echo done > /workspace/work/ck_tmp/runall.done

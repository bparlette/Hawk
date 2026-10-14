#!/bin/bash
# T/duel/suite.sh <port> <tag> <job...>: runs duel jobs one after another under the shared chrome flock, at nice 10. job = kind:mode:w:h[:shot]
cd "$(dirname "$0")/../.." && . ./env.sh; P=$1; TAG=$2; shift 2
for j in "$@"; do IFS=: read k m w h s <<< "$j"; n=${TAG}_${k}_${m}_${w}
  nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 900 node T/duel/run.js $P $k $m $w $h ${s:--} 3 > T/duel/$n.log 2>&1; done
echo done > T/duel/${TAG}.done

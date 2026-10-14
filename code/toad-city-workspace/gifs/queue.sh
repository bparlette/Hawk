#!/usr/bin/env bash
# queue.sh <gif[:--force]> ...: capture each group in its own chrome.flock hold (other builders can interleave)
cd "$(dirname "$0")"; . /workspace/work/hubtest/env.sh
PORT=${PORT:-8791}
up() { curl -s -o /dev/null -m 5 http://127.0.0.1:$PORT/ || { python3 ../game-int/serve.py $PORT "$PWD/snap"; sleep 1; }; }
for g in "$@"; do id=${g%%:*}; f=""; [ "$g" != "$id" ] && f="${g#*:}"
  up; echo "== $id $(date +%T)"; flock /workspace/work/toad-city/locks/chrome.flock node capture.js $PORT $id $f; done
echo QUEUE_DONE $(date +%T)

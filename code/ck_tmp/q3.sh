#!/bin/bash
O=/workspace/work/ck_tmp; while ! grep -q "== cc done" $O/q.progress 2>/dev/null; do sleep 10; done
cd /workspace/work/ck_tmp/reg && . ./env.sh
F="nice -n 10 flock /workspace/work/toad-city/locks/chrome.flock timeout 900"
run() { name=$1; shift; [ -f $O/ok_$name ] && return; echo "== $name $(date +%T)" >> $O/q.progress; $F "$@" > $O/r_$name.log 2>&1 && touch $O/ok_$name; }
run pete390 node T/duel/run.js 8793 pete win 390 844 - 3
XQ="&pigeonquick=1" run pigeon390 node T/duel/run.js 8793 pigeon win 390 844 - 3
run pete1280 node T/duel/run.js 8793 pete win 1280 720 - 3
XQ="&pigeonquick=1" run pigeon1280 node T/duel/run.js 8793 pigeon win 1280 720 - 3
echo "== reg done $(date +%T)" >> $O/q.progress

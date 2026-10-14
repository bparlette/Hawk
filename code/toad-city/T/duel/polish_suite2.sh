#!/bin/bash
# T/duel/polish_suite2.sh: the rest of the polish pass on the final build (after a sandbox restart cut suite 1 short); logs T/duel/pol_<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh; L=/workspace/work/toad-city/locks/chrome.flock; P=8991; D=T/duel
r() { n=$1; d=$2; shift 2; (cd $d && nice -n 10 flock $L timeout 900 "$@") > $D/pol_$n.log 2>&1; echo "$n $?" >> $D/pol.progress; }
W=$PWD
r kidF1280 $W node $D/kidshot.js $P 1280 720 $D/polF1280
r kidF390 $W node $D/kidshot.js $P 390 844 $D/polF390
r ckF_mash390 $W node $D/run.js $P chipkid mash 390 844 - 3
r ckF_win390 $W node $D/run.js $P chipkid win 390 844 $D/polF_win390.png 3 jabTell
r pig2_390 /workspace/work/rg-pigeon node T/pigeon/run.js 8993 2 win 390 844 - 6 0
r pig1_1280 /workspace/work/rg-pigeon node T/pigeon/run.js 8993 1 win 1280 720 - 6 0 '&pigeonquick=1'
r ccheck390 $W node ccheck.js $P $D/pol_cc390 390 844
r dc390 $W node dc.js $P 390 844
r dc1280 $W node dc.js $P 1280 720
echo done > $D/pol.done

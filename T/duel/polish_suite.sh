#!/bin/bash
# T/duel/polish_suite.sh: the chipkid polish test pass, serial under the shared chrome flock at nice 10; logs T/duel/pol_<name>.log, done marker T/duel/pol.done
cd "$(dirname "$0")/../.." && . ./env.sh; L=/workspace/work/toad-city/locks/chrome.flock; P=8991; D=T/duel
r() { n=$1; d=$2; shift 2; (cd $d && nice -n 10 flock $L timeout 900 "$@") > $D/pol_$n.log 2>&1; echo "$n $?" >> $D/pol.progress; }
W=$PWD; rm -f $D/pol.progress $D/pol.done
r kid1280 $W node $D/kidshot.js $P 1280 720 $D/pol1280
r kid390 $W node $D/kidshot.js $P 390 844 $D/pol390
r ck_mash390 $W node $D/run.js $P chipkid mash 390 844 $D/pol_mash390.png 3 14
r ck_win390 $W node $D/run.js $P chipkid win 390 844 $D/pol_win390.png 3 cansTell
r ov390 $W node $D/ovcheck.js $P 390 844
r ov1280 $W node $D/ovcheck.js $P 1280 720
r ck_mash1280 $W node $D/run.js $P chipkid mash 1280 720 - 3
r ck_win1280 $W node $D/run.js $P chipkid win 1280 720 $D/pol_win1280.png 3 jabTell
r ck_lose390 $W node $D/run.js $P chipkid lose 390 844 - 3
r ckshot390 $W node $D/ckshot.js $P 390 844 $D/pol_fx390
r jimmy390 $W node $D/run.js $P jimmy win 390 844 - 3
r jimmy1280 $W node $D/run.js $P jimmy win 1280 720 - 3
r pete390 /workspace/work/rg-pete node T/pete/run.js 8992 win 390 844 - 3
r pete1280 /workspace/work/rg-pete node T/pete/run.js 8992 win 1280 720 - 3
r pig1_390 /workspace/work/rg-pigeon node T/pigeon/run.js 8993 1 win 390 844 - 6 0 '&pigeonquick=1'
r pig2_390 /workspace/work/rg-pigeon node T/pigeon/run.js 8993 2 win 390 844 - 6 0
r pig1_1280 /workspace/work/rg-pigeon node T/pigeon/run.js 8993 1 win 1280 720 - 6 0 '&pigeonquick=1'
r ccheck390 $W node ccheck.js $P $D/pol_cc390 390 844
r dc390 $W node dc.js $P 390 844
r dc1280 $W node dc.js $P 1280 720
echo done > $D/pol.done

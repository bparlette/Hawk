#!/usr/bin/env bash
cd /workspace/work/ss3d-bakeoff/k_toad32
T/shots.sh
node kcheck.js 8790 T/kc_m_ 390 844 4 > T/kc_m.log 2>&1
echo DONE > T/chain2.done

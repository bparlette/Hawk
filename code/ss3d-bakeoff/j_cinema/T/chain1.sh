#!/usr/bin/env bash
cd /workspace/work/ss3d-bakeoff/j_cinema
node partner.js 8796 T/qA_m_ 390 844 4 intro,follow,tp,kos,revive > T/qA_m.log 2>&1
node partner.js 8796 T/qA_d_ 1280 720 4 intro,follow,tp,kos,revive > T/qA_d.log 2>&1
node partner.js 8796 T/qB_d_ 1280 720 4 over,boost,tag > T/qB_d.log 2>&1
node cine.js 8796 T/qc_d_ 1280 720 4 > T/qcine_d.log 2>&1
node cine.js 8796 T/qc_m_ 390 844 4 > T/qcine_m.log 2>&1
node bot.js 8796 T/qb_d_ 1280 720 240 8 > T/qbot_d.log 2>&1
node bot.js 8796 T/qb_m_ 390 844 240 8 > T/qbot_m.log 2>&1
echo CHAIN1_DONE > T/chain1.done

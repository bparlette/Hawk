#!/usr/bin/env bash
cd /workspace/work/ss3d-bakeoff/j_cinema
node bot.js 8796 T/qb_d_ 1280 720 900 8 > T/qbot_d2.log 2>&1
node bot.js 8796 T/qb_m_ 390 844 900 8 > T/qbot_m2.log 2>&1
echo DONE > T/chain4.done

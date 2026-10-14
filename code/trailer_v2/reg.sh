#!/usr/bin/env bash
cd "$(dirname "$0")"; export LD_LIBRARY_PATH=/workspace/work/ss_trailer/libs/aarch64-linux-gnu
for n in "$@"; do rm -rf reg/level$n; node capture2.js http://127.0.0.1:8777 reg/level$n $n 50000 0 > logs/reg_level$n.log 2>&1; tail -1 logs/reg_level$n.log; done

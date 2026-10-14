#!/bin/bash
# usage: ./run.sh <log> cmd...  (detached)
cd /workspace/work/ss3d-trailer; source env.sh; L=$1; shift
setsid nohup "$@" > logs/$L 2>&1 < /dev/null &

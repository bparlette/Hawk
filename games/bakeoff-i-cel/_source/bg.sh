#!/usr/bin/env bash
# bg.sh <logfile> <cmd...> : run detached (tests take longer than one shell call)
log=$1; shift; . /workspace/work/ss3d-bakeoff/i_cel/env.sh; setsid nohup "$@" > "$log" 2>&1 < /dev/null &

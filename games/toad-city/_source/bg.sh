#!/usr/bin/env bash
# bg.sh <logfile> <cmd...> : run detached (tests take longer than one shell call)
log=$1; shift; . /workspace/work/toad-city/game/env.sh; setsid nohup "$@" > "$log" 2>&1 < /dev/null &

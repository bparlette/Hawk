#!/bin/bash
# T/duel/bg.sh <name> <args for run.js...>: runs one headless duel detached (survives the shell timeout); log in T/duel/<name>.log
cd "$(dirname "$0")/../.." && . ./env.sh && name=$1; shift; setsid nohup node T/duel/run.js "$@" > T/duel/$name.log 2>&1 < /dev/null &

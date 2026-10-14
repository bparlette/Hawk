#!/bin/bash
# usage: T/run.sh <log> node args...   (detached, logs to T/<log>)
cd /workspace/work/ss3d; source T/env.sh; L=$1; shift
setsid nohup "$@" > T/$L 2>&1 < /dev/null &

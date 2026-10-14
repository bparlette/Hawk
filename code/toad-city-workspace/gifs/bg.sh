#!/usr/bin/env bash
# bg.sh <logname> <cmd...>: run a command detached (survives the shell call), output to logs/<logname>.log, exit code to logs/<logname>.rc
cd "$(dirname "$0")"; mkdir -p logs; n=$1; shift
. /workspace/work/hubtest/env.sh
setsid nohup bash -c "$* > logs/$n.log 2>&1; echo \$? > logs/$n.rc" > /dev/null 2>&1 < /dev/null &
echo started $n

#!/usr/bin/env python3
# tools/bg.py <logfile> <cmd...> : run a command detached (double fork + setsid) so long QA runs outlive the shell call
import os, sys
log, cmd = sys.argv[1], sys.argv[2:]
if os.fork(): sys.exit(0)
os.setsid()
if os.fork(): sys.exit(0)
fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
os.dup2(fd, 1); os.dup2(fd, 2)
nul = os.open('/dev/null', os.O_RDONLY); os.dup2(nul, 0)
os.chdir('/workspace/work/bmore-drone')
os.execvp(cmd[0], cmd)

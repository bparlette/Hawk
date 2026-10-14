#!/usr/bin/env python3
# bg.py <log> <cmd...> : fully detached run (double fork + setsid), cwd = polytrack-plus
import os, sys
log, cmd = sys.argv[1], sys.argv[2:]
os.chdir('/workspace/work/polytrack-plus')
if os.fork(): sys.exit(0)
os.setsid()
if os.fork(): os._exit(0)
fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644); nul = os.open('/dev/null', os.O_RDONLY)
os.dup2(nul, 0); os.dup2(fd, 1); os.dup2(fd, 2)
os.execvp(cmd[0], cmd)

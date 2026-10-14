#!/usr/bin/env python3
"""Run one deterministic capture: shot.py NAME MAP SCRIPTFILE  -> /tmp/fdshots/NAME.mp4 + NAME.snd + NAME_cs.png"""
import subprocess, sys, os
name, mp, script = sys.argv[1], sys.argv[2], sys.argv[3]
if not os.path.exists('/tmp/fdrun/frenzy_cap_540x960') or not os.path.exists('/usr/bin/ffmpeg'): subprocess.run(['/workspace/work/freedoom-short/setup.sh'])
out='/workspace/work/freedoom-short/shots'; os.makedirs(out, exist_ok=True)
env=dict(os.environ, FD_SCRIPT=os.path.abspath(script), FD_OUT=f'{out}/{name}.mp4', FD_SNDLOG=f'{out}/{name}.snd')
r=subprocess.run(['/tmp/fdrun/frenzy_cap_540x960','-iwad','/tmp/fdrun/freedoom2.wad','-warp',mp,'-skill','4','-config','/tmp/fdrun/frenzy.cfg'],env=env,cwd='/tmp/fdrun',capture_output=True,text=True,timeout=110)
log=r.stdout; open(f'{out}/{name}.log','w').write(log)
for l in log.splitlines():
    if l.startswith(('INFO','CAPTURED')): print(l)
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',f'{out}/{name}.mp4','-vf',"select='not(mod(n\\,6))',scale=180:320,tile=10x3",'-frames:v','1',f'{out}/{name}_cs.png'])

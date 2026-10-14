# build_clips.py [beat...] : frames/<beat>/fNNNN.png -> hfproj/assets/clips/<beat>.mp4 (30 fps, 1920x1080)
# EDIT: per beat a list of [first, last_exclusive] frame segments; their total must be the beat's timeline duration * 30.
# Side bars outside the cabinet (x<193, x>1712) are filled with a blurred, darkened copy of the same frame.
import json, os, sys, subprocess, shutil
from PIL import Image
import numpy as np
ROOT = '/workspace/work/ss3d-trailer'
T = json.load(open(f'{ROOT}/timeline.json'))
EDIT = json.load(open(f'{ROOT}/edit.json'))
DUR = {b: d for b, d, _ in T['beats']}
def lum(f):
    a = np.asarray(Image.open(f).convert('L').crop((560, 85, 1360, 560)), dtype=np.float32); return float(a.mean())
names = sys.argv[1:] or [b for b in EDIT]
for b in names:
    segs = EDIT[b]; need = round(DUR[b] * 30)
    frames = []
    for a, z in segs: frames += [f'{ROOT}/frames/{b}/f{i:04d}.png' for i in range(a, z)]
    if len(frames) != need: print(f'!! {b}: {len(frames)} frames, timeline wants {need}'); 
    miss = [f for f in frames if not os.path.exists(f)]
    if miss: print(f'!! {b}: missing {len(miss)} frames e.g. {miss[0]}'); continue
    dark = [(os.path.basename(f), round(lum(f), 1)) for f in frames[::3] if lum(f) < 12]
    if dark: print(f'!! {b}: dark frames {dark[:6]}')
    tmp = f'{ROOT}/work_clip/{b}'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    for k, f in enumerate(frames): os.symlink(f, f'{tmp}/{k:04d}.png')
    out = f'{ROOT}/hfproj/assets/clips/{b}.mp4'
    fc = '[0:v]split[a][b];[a]scale=2420:1362,crop=1920:1080,boxblur=28:2,eq=brightness=-0.16:saturation=0.75[bg];[b]crop=1520:1080:193:0[fg];[bg][fg]overlay=193:0,format=yuv420p'
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-i', f'{tmp}/%04d.png', '-filter_complex', fc, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-r', '30', '-movflags', '+faststart', out], capture_output=True, text=True)
    if r.returncode: print('FFMPEG FAIL', b, r.stderr[:500]); continue
    print('ok', b, len(frames), 'frames ->', out)

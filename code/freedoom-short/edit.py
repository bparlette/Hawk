#!/usr/bin/env python3
"""Assemble the Freedoom Frenzy Short from real captured gameplay segments.
Outputs: build/video_noaudio.mp4, build/edl.json ; then mix.py makes audio ; final mux in finish.sh"""
import subprocess, json, os
W = '/workspace/work/freedoom-short'
SH = f'{W}/shots'
B = '/tmp/fdedit'
os.makedirs(B, exist_ok=True)
os.makedirs(f'{W}/build', exist_ok=True)
FPS = 30
FONT = f'{W}/assets/Anton-Regular.ttf'

# (shot, in_frame, out_frame_exclusive, punch-zoom frame ranges within segment)
EDL = [
    ('s1_ssg',      0,  84, [(1, 6), (58, 63)]),
    ('s2_cg',       0,  66, []),
    ('s3_rl',       0, 118, [(4, 9)]),
    ('s6_arena_rl', 0,  80, [(2, 7)]),
    ('s4_arena',   10, 242, []),
    ('s5_bfg',     66, 148, []),
]
END_SECONDS = 4.5

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-2000:]); raise SystemExit(1)

segs = []
t = 0.0
for i, (shot, a, b, punches) in enumerate(EDL):
    n = b - a
    z = '+'.join([f'between(on,{p0},{p1})*0.07' for p0, p1 in punches]) or '0'
    vf = (f"trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,"
          f"scale=1080:1920:flags=neighbor,"
          f"zoompan=z='1+{z}':d=1:s=1080x1920:fps={FPS}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',"
          f"format=yuv420p")
    out = f'{B}/seg{i}.mp4'
    run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{SH}/{shot}.mp4', '-vf', vf, '-r', str(FPS),
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', out])
    segs.append({'shot': shot, 'in': a, 'out': b, 'start': round(t, 4), 'dur': n / FPS, 'file': out})
    t += n / FPS

# end card: first frame of the Short, darkened, title on top; last 0.4 s fades back to the clean first frame (loop point)
run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{B}/seg0.mp4', '-frames:v', '1', f'{B}/first.png'])
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
base = Image.open(f'{B}/first.png').convert('RGB')
bg = ImageEnhance.Brightness(base.filter(ImageFilter.GaussianBlur(10))).enhance(0.28)
d = ImageDraw.Draw(bg)
def ctext(y, s, size, fill, stroke=8, sf=(0, 0, 0)):
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(s, font=f)
    d.text(((1080 - w) / 2, y), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=sf)
ctext(430, 'FREEDOOM', 250, (255, 196, 40), 12, (90, 0, 0))
ctext(760, 'FREE & OPEN SOURCE', 92, (255, 255, 255))
ctext(870, 'PLAY IN YOUR BROWSER', 92, (255, 255, 255))
# link pill
f = ImageFont.truetype(FONT, 78)
url = 'freedoom-frenzy.surge.sh'
w = d.textlength(url, font=f)
d.rounded_rectangle([(1080 - w) / 2 - 40, 1060, (1080 + w) / 2 + 40, 1180], radius=40, fill=(200, 20, 20))
d.text(((1080 - w) / 2, 1072), url, font=f, fill=(255, 255, 255))
ctext(1250, 'FRENZY MOD: 3X HORDES · KILL CAM · COMBOS', 50, (255, 210, 120), 5)
ctext(1720, 'Freedoom (BSD) · doomgeneric engine (GPL-2.0)', 38, (200, 200, 200), 4)
bg.save(f'{B}/endcard.png')
end_out = f'{B}/seg_end.mp4'
fade_start = END_SECONDS - 0.4
run(['ffmpeg', '-loglevel', 'error', '-y',
     '-loop', '1', '-t', str(END_SECONDS), '-i', f'{B}/endcard.png',
     '-loop', '1', '-t', str(END_SECONDS), '-i', f'{B}/first.png',
     '-filter_complex', f"[0:v]fps={FPS},format=yuv420p[a];[1:v]fps={FPS},format=yuv420p[b];"
                        f"[a][b]xfade=transition=fade:duration=0.4:offset={fade_start},format=yuv420p,"
                        f"zoompan=z='1+0.04*max(0,1-on/12)':d=1:s=1080x1920:fps={FPS}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
     '-t', str(END_SECONDS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', end_out])
segs.append({'shot': 'endcard', 'start': round(t, 4), 'dur': END_SECONDS, 'file': end_out})
total = t + END_SECONDS

with open(f'{B}/concat.txt', 'w') as fh:
    for s in segs:
        fh.write(f"file '{s['file']}'\n")
run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{B}/concat.txt', '-c', 'copy', f'{B}/joined.mp4'])

# captions (top third), timed to segment starts
S = {s['shot']: s['start'] for s in segs}
CAPS = [
    (0.00, S['s2_cg'], 'THIS SHOOTER IS|100% FREE.'),
    (S['s2_cg'], S['s3_rl'], 'EVERY PIXEL|OPEN SOURCE.'),
    (S['s3_rl'], S['s3_rl'] + 1.9, 'WE MODDED IN|3X THE MONSTERS'),
    (S['s3_rl'] + 1.9, S['s6_arena_rl'], '+ SLOW-MO|KILL CAM'),
    (S['s6_arena_rl'], S['s4_arena'], 'COMBO COUNTER|BUILT IN'),
    (S['s4_arena'] + 0.6, S['s4_arena'] + 2.3, '10% HEALTH.|NO PROBLEM.'),
    (S['s4_arena'] + 2.3, S['s4_arena'] + 6.2, 'ONE SHOT.|WHOLE ROOM.'),
    (S['s5_bfg'], S['endcard'], 'PLAYS IN YOUR|BROWSER'),
]
filters = []
for a, b, txt in CAPS:
    lines = txt.split('|')
    for k, line in enumerate(lines):
        y = 250 + k * 118
        filters.append(f"drawtext=fontfile={FONT}:text='{line}':fontsize=104:fontcolor=white:borderw=9:bordercolor=black:"
                       f"x=(w-text_w)/2:y={y}:enable='between(t,{a:.3f},{b - 0.001:.3f})'")
run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f'{B}/joined.mp4', '-vf', ','.join(filters),
     '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(FPS),
     f'{W}/build/video_noaudio.mp4'])
json.dump({'segments': segs, 'captions': CAPS, 'total': total}, open(f'{W}/build/edl.json', 'w'), indent=1)
print('VIDEO_OK', round(total, 2))

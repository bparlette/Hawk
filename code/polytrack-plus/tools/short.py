#!/usr/bin/env python3
# short.py: shorts/cap/f/*.jpg (1080x1920, 30 fps, deterministic autopilot lap) + events.json
#   -> procedural soundtrack (bass/hats/claps at 124 bpm, chimes on checkpoints, whoosh into the loop, fanfare at the finish)
#   -> shorts/polytrack_short.mp4 with captions. No copied assets.
import json, math, os, subprocess, wave, struct, random
P = '/workspace/work/polytrack-plus/shorts'; F = P + '/cap/f'; FPS = 30; SR = 44100
n = len([f for f in os.listdir(F) if f.endswith('.jpg')]); dur = n / FPS
ev = json.load(open(P + '/cap/events.json'))
def first(name): return next((e['f'] for e in ev if e['e'] == name), None)
cps = [first('cp%d' % i) for i in (1, 2, 3)]; loop = first('loop'); fin = next((e['f'] for e in ev if e['e'] == 'mode:finish'), n - 60)
kick = first('kicker')
N = int(dur * SR) + SR; buf = [0.0] * N; rnd = random.Random(3)
def add(t, samples):
    i0 = int(t * SR)
    for k, v in enumerate(samples):
        if 0 <= i0 + k < N: buf[i0 + k] += v
def tone(f, d, vol, kind='sq', f2=None):
    out = []; ph = 0.0; m = int(d * SR)
    for k in range(m):
        ff = f if f2 is None else f * (f2 / f) ** (k / m); ph += ff / SR; x = ph % 1.0
        s = (1 if x < .5 else -1) if kind == 'sq' else (4 * abs(x - .5) - 1 if kind == 'tri' else math.sin(2 * math.pi * x))
        env = min(1, k / 200) * math.exp(-4 * k / m); out.append(s * vol * env)
    return out
def noise(d, vol, hp=True):
    out = []; prev = 0; m = int(d * SR)
    for k in range(m):
        w = rnd.uniform(-1, 1); v = w - prev if hp else (prev * 0.9 + w * 0.1); prev = w if hp else v
        out.append(v * vol * math.exp(-6 * k / m))
    return out
spb = 60 / 124 / 4; step = 0; t = 0.0
while t < dur:
    s = step % 16; bar = (step // 16) % 4; root = [55, 55, 49, 65.4][bar]
    if s in (0, 3, 6, 8, 10, 11, 14): add(t, tone(root * (2 if s == 11 else 1), spb * 1.4, .16))
    if s % 2 == 0: add(t, noise(.03, .07 if s % 4 == 2 else .04))
    if s in (0, 8): add(t, tone(140, .16, .5, 'sin', 45))
    if step > 64 and s in (4, 12): add(t, noise(.12, .14, hp=False))
    if cps[1] and t > cps[1] / FPS and s % 2 == 0: add(t, tone(root * 4 * 2 ** ([0, 7, 12, 15, 19, 15, 12, 7][(s // 2) % 8] / 12), spb * 1.6, .06, 'tri'))
    step += 1; t += spb
for i, c in enumerate(cps):
    if c is None: continue
    for j, m in enumerate((1, 1.26, 1.5, 2)): add(c / FPS + j * .055, tone([659, 784, 880][i] * m, .32, .2, 'tri'))
if loop: add(loop / FPS, noise(.6, .25, hp=False)); add(loop / FPS, tone(200, .6, .15, 'sin', 600))
if kick: add(kick / FPS + .3, noise(.5, .2, hp=False))
for j, f in enumerate((523, 659, 784, 1046, 1318)): add(fin / FPS + j * .09, tone(f, .3, .12)); add(fin / FPS + j * .09, tone(f / 2, .3, .14, 'tri'))
pk = max(1e-6, max(abs(x) for x in buf)); w = wave.open(P + '/cap/audio.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x / pk * .9)) * 32000)) for x in buf)); w.close()
# captions (drawtext), timed from the events
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def cap(text, t0, t1, y=360, size=92, col='white'):
    text = text.replace(':', '\\:')
    return f"drawtext=fontfile={FONT}:text='{text}':fontsize={size}:fontcolor={col}:borderw=10:bordercolor=0x14101f:x=(w-tw)/2:y={y}:enable='between(t,{t0:.2f},{t1:.2f})'"
caps = [cap('POLYTRACK REMAKE', 0, 2.6, 330, 96, '0xffd23c'), cap('fan remake · made from scratch', 0.3, 2.6, 450, 50)]
if kick: caps.append(cap('SEND IT', kick / FPS - .2, kick / FPS + 1.6, 380, 110, '0xffd23c'))
if loop: caps.append(cap('LOOP!', loop / FPS + .2, loop / FPS + 1.9, 380, 130, '0x36e0c8'))
caps.append(cap('BEAT THE AUTHOR TIME', fin / FPS + .4, dur, 1500, 76, '0xffd23c'))
caps.append(cap('0:27.65', fin / FPS + .4, dur, 1600, 96))
vf = ','.join(caps)
out = P + '/polytrack_short.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', F + '/%05d.jpg', '-i', P + '/cap/audio.wav', '-vf', 'scale=1080:1920,setsar=1,' + vf,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], check=True)
print('wrote', out, 'frames', n, 'dur', round(dur, 2), 'cps', cps, 'loop', loop, 'kick', kick, 'fin', fin)

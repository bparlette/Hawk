#!/usr/bin/env python3
"""GULF THUNDER Short builder. python3 build.py jobs | video | audio | mux
All picture content = in-engine frames captured from the local game copy (frames/*), scaled with NEAREST.
Overlays use the game's own 5x7 pixel font (GLYPH table parsed from game/js/core.js)."""
import json, os, re, sys, subprocess, math
import numpy as np
from PIL import Image

D = '/workspace/work/shorts/gulf-thunder'
OUTDIR = D
W, H, FPS = 1080, 1920, 30

# ---------------- timeline ----------------
# piece: (capture, [frame indices], crop) ; crop = None (full 270x480) or (x0,y0,w,h) or 'title'
def rng(a, b, step=1):
    return list(range(a, b, step))

SEGS = []
# frames where the engine's full-screen hit flash is on (measured: mean luma > median+25). In slow-mo, every other
# flash frame is dropped so the white flash plays at real speed instead of lingering (speed ramp, nothing added).
FLASH = {'s1ko': set(range(213, 220)), 's5ko': set(range(144, 165)) | {181, 182, 183, 211, 212, 213}}
def deflash(cap, frames):
    out = []; c = 0
    for f in frames:
        if f in FLASH.get(cap, ()):
            c += 1
            if c % 2 == 0: continue
        out.append(f)
    return out
def seg(name, cap, frames, crop=None, every=2, overlays=(), slow=False, zoom=None, ko_y=700, cap_y=1360):
    SEGS.append(dict(name=name, cap=cap, frames=frames, crop=crop, every=every, overlays=list(overlays), slow=slow, zoom=zoom, ko_y=ko_y, cap_y=cap_y))

# A hook: Stage 3 Gator Gunboat blown up, real speed (capture every 2 steps = 30fps)
seg('hook', 's3hook', rng(28, 73), overlays=[('hook', 0, 99)])
# B title screen (real Title scene, 270x540 extended-sky canvas), nearest-neighbour zoom-out from the sun
seg('title', 'title', rng(25, 151), crop='title', zoom=(0, 60))
# C stage entry: STAGE 1 GULF RUN banner, Thunderhead enters from the bottom
seg('stage1', 's1in', rng(36, 91))
# D replay 1 lead-in: Red Tide Yacht fight at real speed (capture every 1 step -> take every 2nd)
seg('r1live', 's1ko', rng(4, 124, 2), every=1, overlays=[('ko', 86, 999), ('cap1', 0, 999)])
# E replay 1 slow motion
seg('r1replay', 's1ko', deflash('s1ko', rng(64, 124) + rng(124, 204, 2) + rng(204, 248)), every=1, slow=True,
    overlays=[('replay', 0, 999), ('ko', 86, 140), ('cap1', 0, 999)])
# F replay 2 lead-in: Victor Kade's plane at real speed
seg('r2live', 's5ko', rng(2, 112, 2), every=1, overlays=[('ko', 76, 999), ('cap2', 0, 999)], ko_y=560, cap_y=330)
# G replay 2 slow motion, 2x nearest-neighbour zoom on the crash
seg('r2replay', 's5ko', deflash('s5ko', rng(62, 122) + rng(122, 170, 2) + rng(170, 236)), every=1, slow=True, crop=(110, 218, 135, 240),
    overlays=[('replay', 0, 999), ('ko', 76, 130), ('cap2', 0, 999)], ko_y=560, cap_y=1440)
# H end card: real ending scene (notext) Thunderhead sailing into the sunset
seg('end', 'end', rng(1, 121), overlays=[('end', 0, 999)])

def seg_times():
    t = 0; out = []
    for s in SEGS:
        n = len(s['frames']); out.append((t, t + n / FPS)); t += n / FPS
    return out

# ---------------- pixel font ----------------
src = open(D + '/game/js/core.js').read()
gl = src[src.index('const GLYPH = {'):src.index('};', src.index('const GLYPH = {'))]
GLYPH = {}
for m in re.finditer(r"(?:'(.)'|\"(.)\"|(\w)):\s*\[([\d,\s]+)\]", gl):
    ch = m.group(1) or m.group(2) or m.group(3)
    GLYPH[ch] = [int(v) for v in m.group(4).split(',')]

def hexc(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

def text_img(s, P, col, ocol='#100818', o=None, box=None):
    s = s.upper(); o = o if o is not None else max(4, P // 3)
    tw = len(s) * 6 * P - P; th = 7 * P
    pad = o + (box[1] if box else 0)
    a = np.zeros((th + 2 * pad, tw + 2 * pad, 4), np.uint8)
    if box: a[:, :] = hexc(box[0])
    mask = np.zeros((th, tw), bool)
    for i, ch in enumerate(s):
        g = GLYPH.get(ch)
        if not g: continue
        for y in range(7):
            for x in range(5):
                if g[y] & (16 >> x): mask[y * P:(y + 1) * P, i * 6 * P + x * P: i * 6 * P + (x + 1) * P] = True
    if o:
        om = np.zeros_like(mask)
        big = np.zeros((th + 2 * o, tw + 2 * o), bool)
        for dy in range(-o, o + 1, max(1, o // 2) if o > 2 else 1):
            for dx in range(-o, o + 1, max(1, o // 2) if o > 2 else 1):
                big[o + dy:o + dy + th, o + dx:o + dx + tw] |= mask
        a[pad - o:pad - o + th + 2 * o, pad - o:pad - o + tw + 2 * o][big] = hexc(ocol)
    a[pad:pad + th, pad:pad + tw][mask] = hexc(col)
    return Image.fromarray(a, 'RGBA')

def paste_c(frame, img, cx, y):
    frame.alpha_composite(img, (int(cx - img.width / 2), int(y)))

SAFE_R = int(W * 0.85)
T_HOOK1 = text_img('1 BOAT. 5 STAGES.', 7, '#ffffff')
T_HOOK2 = text_img('ZERO MERCY.', 9, '#ffd848')
T_KO = text_img('KO!', 24, '#ffd848', o=10)
T_REPLAY = text_img('REPLAY', 7, '#ffffff', box=('#c01818', 10))
T_SLOW = text_img('SLOW-MO', 4, '#ffd848')
T_CAP1a = text_img('STAGE 1 BOSS', 5, '#ffd848'); T_CAP1b = text_img('RED TIDE YACHT', 6, '#ffffff')
T_CAP2a = text_img('FINAL BOSS', 5, '#ffd848'); T_CAP2b = text_img('VICTOR KADE', 6, '#ffffff')
T_END1 = text_img('GULF THUNDER', 10, '#ffffff', o=6)
T_END2 = text_img('PLAY FREE', 11, '#ffd848', o=6)
T_END3 = text_img('GULF-THUNDER.SURGE.SH', 5, '#ffffff', o=5)
for t in [T_HOOK1, T_HOOK2, T_KO, T_REPLAY, T_CAP1b, T_CAP2b, T_END1, T_END2, T_END3]:
    assert 540 + t.width / 2 <= SAFE_R + 2 or t is T_REPLAY, (t.width)

def overlays(frame, kind, k, gframe, s):
    """k = output frame index within segment, gframe = source frame index"""
    if kind == 'hook':
        if k >= 2: paste_c(frame, T_HOOK1, 540, 236)
        if k >= 8: paste_c(frame, T_HOOK2, 540, 316)
    elif kind == 'ko':
        lo = [o for o in s['overlays'] if o[0] == 'ko'][0]
        if lo[1] <= gframe < lo[2]:
            # pop-in: count frames since the KO source frame appeared in this segment
            idx = [i for i, f in enumerate(s['frames']) if f >= lo[1]][0]
            age = k - idx
            sc = [1.7, 1.45, 1.25, 1.1][age] if age < 4 else 1.0
            im = T_KO.resize((int(T_KO.width * sc), int(T_KO.height * sc)), Image.NEAREST) if sc != 1 else T_KO
            frame.alpha_composite(im, (int(540 - im.width / 2), int(s['ko_y'] - im.height / 2)))
    elif kind == 'replay':
        x = 96
        frame.alpha_composite(T_REPLAY, (x, 214))
        if (k // 15) % 2 == 0:  # blinking rec dot
            frame.paste((255, 40, 40, 255), (x + T_REPLAY.width + 22, 240, x + T_REPLAY.width + 50, 268))
        frame.alpha_composite(T_SLOW, (x + 4, 214 + T_REPLAY.height + 14))
    elif kind in ('cap1', 'cap2'):
        a, b = (T_CAP1a, T_CAP1b) if kind == 'cap1' else (T_CAP2a, T_CAP2b)
        paste_c(frame, a, 540, s['cap_y']); paste_c(frame, b, 540, s['cap_y'] + 50)
    elif kind == 'end':
        if k >= 6: paste_c(frame, T_END1, 540, 300)
        if k >= 20: paste_c(frame, T_END2, 540, 1200)
        if k >= 26: paste_c(frame, T_END3, 540, 1330)

def load(cap, i):
    return Image.open(f'{D}/frames/{cap}/{i:05d}.png').convert('RGBA')

def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

def render_frame(s, k, i):
    im = load(s['cap'], i)
    if s['crop'] == 'title':
        # canvas 270x540; final window y 15..495. zoom-out from z=3 centred on the sun (135, 282)
        z0, z1 = s['zoom']; e = ease((k - z0) / (z1 - z0))
        z = 3.0 + (1.0 - 3.0) * e
        w, h = 270 / z, 480 / z
        cx = 135; cy = 282 + (245 - 282) * e
        x0 = min(max(cx - w / 2, 0), 270 - w); y0 = min(max(cy - h / 2, 0), 540 - h)
        if z <= 1.0001: x0, y0, w, h = 0, 5, 270, 480
        fr = im.resize((W, H), Image.NEAREST, box=(x0, y0, x0 + w, y0 + h))
    elif s['crop']:
        x0, y0, w, h = s['crop']
        fr = im.resize((W, H), Image.NEAREST, box=(x0, y0, x0 + w, y0 + h))
    else:
        assert im.size == (270, 480), im.size
        fr = im.resize((W, H), Image.NEAREST)
    for o in s['overlays']:
        if o[0] == 'ko' or o[1] <= k < o[2]:
            overlays(fr, o[0], k, i, s)
    return fr.convert('RGB')

def video():
    names = sys.argv[2:]
    for s in SEGS:
        if s['name'] not in names: continue
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '30', D + f'/out/seg_{s["name"]}.mp4']
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        n = 0
        for k, i in enumerate(s['frames']):
            fr = render_frame(s, k, i)
            p.stdin.write(fr.tobytes()); n += 1
        p.stdin.close(); p.wait(); print(s['name'], 'frames', n, n / FPS, 's')

# ---------------- audio ----------------
CAP_EVERY = {'s3hook': 2, 's1in': 2, 's1ko': 1, 's5ko': 1, 'title': 2, 'end': 2}
def jobs():
    J = []
    for cap in ['s3hook', 's1in', 's1ko', 's5ko']:
        d = json.load(open(f'{D}/frames/{cap}/sfx.json'))
        n = len([f for f in os.listdir(f'{D}/frames/{cap}') if f.endswith('.png')])
        ln = n * d['every'] / 60 + 1.5
        ev = [[(st - d['start']) / 60, 'sfx', nm] for st, nm in d['events']]
        J.append(dict(name='sfx_' + cap, len=ln, events=ev))
    T = seg_times(); total = T[-1][1]
    st = {s['name']: T[i][0] for i, s in enumerate(SEGS)}
    mus = [[0, 'music', 'boss'], [st['title'], 'music', 'title'], [st['stage1'], 'music', 'boat'],
           [st['r1live'], 'music', 'boss'], [st['end'], 'music', 'ending']]
    J.append(dict(name='music', len=total + 0.5, events=mus))
    ui = [[st['r1replay'], 'sfx', 'select'], [st['r2replay'], 'sfx', 'select'], [st['end'] + 20 / FPS, 'sfx', 'pickup'], [st['end'] + 0.1, 'sfx', 'clear']]
    J.append(dict(name='ui', len=total + 0.5, events=ui))
    json.dump(J, open(D + '/out/jobs.json', 'w')); print('jobs written; total', total)

def readwav(p):
    import wave
    w = wave.open(p); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32767
    return a

def audio():
    SR = 44100
    T = seg_times(); total = T[-1][1]
    N = int(total * SR) + 1
    mix = np.zeros((N, 2), np.float32)
    mus = readwav(D + '/out/stems/music.wav')[:N]
    # duck music under replays a little so the slowed booms carry
    gain = np.ones(N, np.float32)
    for i, s in enumerate(SEGS):
        if s['slow']:
            a, b = int(T[i][0] * SR), int(T[i][1] * SR); gain[a:b] = 0.6
    gain = np.convolve(gain, np.ones(2205) / 2205, 'same')
    mix[:len(mus)] += mus * gain[:len(mus), None]
    stems = {}
    for i, s in enumerate(SEGS):
        if s['cap'] in ('title', 'end'): continue
        cap = s['cap']
        if cap not in stems: stems[cap] = readwav(f'{D}/out/stems/sfx_{cap}.wav')
        st = stems[cap]; ev = s['every']
        # each output frame k shows source frame f -> game time f*ev/60. Build sample-accurate map by frames
        out0 = int(T[i][0] * SR)
        fr = s['frames']
        for k in range(len(fr)):
            g0 = (fr[k] - 1) * ev / 60.0  # game time at this frame (frame n = after n*ev steps; sfx logged at step index)
            g1 = (fr[k + 1] - 1) * ev / 60.0 if k + 1 < len(fr) else g0 + (fr[k] - fr[k - 1]) * ev / 60.0
            a, b = int(g0 * SR), int(g1 * SR)
            o0, o1 = out0 + int(k * SR / FPS), out0 + int((k + 1) * SR / FPS)
            if b <= a or o1 > N: continue
            chunk = st[a:b]
            if len(chunk) < 2: continue
            x = np.linspace(0, len(chunk) - 1, o1 - o0)
            res = np.stack([np.interp(x, np.arange(len(chunk)), chunk[:, c]) for c in (0, 1)], 1)
            mix[o0:o1] += res * 1.0
    ui = readwav(D + '/out/stems/ui.wav')[:N]
    mix[:len(ui)] += ui
    # short fade out at end
    f = int(0.6 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
    import wave
    a = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    w = wave.open(D + '/out/mix_raw.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes()); w.close()
    print('audio', len(a) / SR)

if __name__ == '__main__':
    os.makedirs(D + '/out', exist_ok=True)
    {'jobs': jobs, 'video': video, 'audio': audio}[sys.argv[1]]()
    if sys.argv[1] == 'jobs':
        for (s, t) in zip(SEGS, seg_times()): print(s['name'], round(t[0], 2), round(t[1], 2))

#!/usr/bin/env python3
"""GULF THUNDER Short v2 builder: hook, title, then all 5 stages (banner -> gameplay -> boss -> KO), 2 replays, end card.
python3 build2.py jobs | video <names...> | audio | list
All picture content = in-engine frames captured from the local game copy (v2/c/* deterministic seed=3 captures;
frames/title + frames/end reused from v1), scaled 4x NEAREST to 1080x1920. Overlays use the game's own 5x7 pixel font."""
import json, os, re, sys, subprocess, wave
import numpy as np
from PIL import Image

D = '/workspace/work/shorts/gulf-thunder'
OUT = D + '/v2/out'
W, H, FPS = 1080, 1920, 30

def rng(a, b, step=1):
    return list(range(a, b, step))

# flash frames (mean luma > median+25, measured on the captures); in slow-mo every other one is dropped
FLASH = {'k3': set(range(323, 330)), 'k5': set(), 'k1': set(range(253, 260))}
def deflash(cap, frames):
    out = []; c = 0
    for f in frames:
        if f in FLASH.get(cap, ()):
            c += 1
            if c % 2 == 0: continue
        out.append(f)
    return out

SEGS = []
def seg(name, cap, frames, every=2, overlays=(), slow=False, crop=None, zoom=None, music=None, stage=None, part=None, ko=None):
    SEGS.append(dict(name=name, cap=cap, frames=frames, every=every, overlays=list(overlays), slow=slow, crop=crop, zoom=zoom,
                     music=music, stage=stage, part=part, ko=ko))

def cdir(cap):
    return f'{D}/frames/{cap}' if cap in ('title', 'end') else f'{D}/v2/c/{cap}'

# ---- timeline ----
seg('hook', 'hk', rng(31, 76), overlays=['hook'], music='boss', part='hook')                    # Stage 5 finale explosions
seg('title', 'title', rng(25, 115), crop='title', zoom=(0, 45), music='title', part='title')       # real Title scene, pull-back
STG = [
    # n, track, banner, gameplay(cap, frames), intro(cap, frames), ko cap, ko frame, live frames, replay frames
    (1, 'boat', ('g1', rng(4, 110)), ('i1', rng(1, 31)), 'k1', 121, rng(70, 271, 2), None, ('STAGE 1 BOSS', 'RED TIDE YACHT')),
    (2, 'beach', ('g2', rng(5, 111)), ('i2', rng(8, 38)), 'k2', 290, rng(180, 372, 2), None, ('STAGE 2 BOSS', 'BIG RICO')),
    (3, 'swamp', ('g3', rng(3, 106)), ('i3', rng(10, 40)), 'k3', 191, rng(120, 214, 2),
        deflash('k3', rng(188, 212) + rng(212, 318, 2) + rng(318, 352)), ('STAGE 3 BOSS', 'GATOR GUNBOAT')),
    (4, 'kasbah', ('g4', rng(10, 115)), ('i4', rng(12, 42)), 'k4', 187, rng(100, 306, 2), None, ('STAGE 4 BOSS', 'THE GUN BROKER')),
    (5, 'backlot', ('g5', rng(8, 114)), ('i5b', rng(30, 90)), 'k5', 164, rng(128, 200, 2),
        rng(158, 214) + rng(214, 281, 2), ('FINAL BOSS', 'VICTOR KADE')),
]
for n, trk, (gc, gf), (ic, iff), kc, kof, live, rep, capt in STG:
    seg(f's{n}banner', f'b{n}', rng(12, 42), music=trk, stage=n, part='banner')
    seg(f's{n}play', gc, gf, music=trk, stage=n, part='gameplay')
    seg(f's{n}intro', ic, iff, overlays=[('cap', capt)], music='boss', stage=n, part='boss')
    seg(f's{n}ko', kc, live, every=1, overlays=[('cap', capt), ('ko', kof)], music='boss', stage=n, part='boss+KO', ko=kof)
    if rep:
        seg(f's{n}replay', kc, rep, every=1, slow=True, overlays=['replay', ('ko', kof), ('cap', capt)], music='boss', stage=n, part='replay', ko=kof)
seg('end', 'end', rng(1, 91), overlays=['end'], music='ending', part='end')

def seg_times():
    t = 0; out = []
    for s in SEGS:
        n = len(s['frames']); out.append((t, t + n / FPS)); t += n / FPS
    return out

# ---------------- pixel font (game's GLYPH table) ----------------
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
        big = np.zeros((th + 2 * o, tw + 2 * o), bool)
        stp = max(1, o // 2) if o > 2 else 1
        for dy in range(-o, o + 1, stp):
            for dx in range(-o, o + 1, stp):
                big[o + dy:o + dy + th, o + dx:o + dx + tw] |= mask
        a[pad - o:pad - o + th + 2 * o, pad - o:pad - o + tw + 2 * o][big] = hexc(ocol)
    a[pad:pad + th, pad:pad + tw][mask] = hexc(col)
    return Image.fromarray(a, 'RGBA')

def paste_c(frame, img, cx, y):
    frame.alpha_composite(img, (int(cx - img.width / 2), int(y)))

# Shorts safe area used here: x 54..918 (right 15% kept clear for the action buttons), y 300..1500
SAFE_L, SAFE_R, SAFE_T, SAFE_B = 54, int(W * 0.85), 300, 1500
T_HOOK1 = text_img('1 BOAT. 5 STAGES.', 7, '#ffffff')
T_HOOK2 = text_img('ZERO MERCY.', 9, '#ffd848')
T_KO = text_img('KO!', 24, '#ffd848', o=10)
T_REPLAY = text_img('REPLAY', 7, '#ffffff', box=('#c01818', 10))
T_SLOW = text_img('SLOW-MO', 4, '#ffd848')
T_END1 = text_img('GULF THUNDER', 10, '#ffffff', o=6)
T_END2 = text_img('PLAY FREE', 11, '#ffd848', o=6)
T_END3 = text_img('GULF-THUNDER.SURGE.SH', 5, '#ffffff', o=5)
CAPS = {}
def cap_imgs(c):
    if c not in CAPS: CAPS[c] = (text_img(c[0], 5, '#ffd848'), text_img(c[1], 6, '#ffffff'))
    return CAPS[c]
KO_Y, CAP_Y, HOOK_Y, REPLAY_Y = 560, 1000, 320, 300

def check_safe():
    # centred items: half-width must keep them inside SAFE_L..SAFE_R around x=540
    items = [T_HOOK1, T_HOOK2, T_END1, T_END2, T_END3, T_KO] + [i for c in [s[8] for s in STG] for i in cap_imgs(c)]
    for t in items:
        x0 = 540 - t.width / 2; x1 = 540 + t.width / 2
        assert x0 >= SAFE_L - 2 and x1 <= SAFE_R + 2, ('unsafe width', t.width)
    assert 96 + T_REPLAY.width + 50 <= SAFE_R
check_safe()

def overlay(frame, o, k, gframe, s):
    kind = o if isinstance(o, str) else o[0]
    if kind == 'hook':
        if k >= 2: paste_c(frame, T_HOOK1, 540, HOOK_Y)
        if k >= 8: paste_c(frame, T_HOOK2, 540, HOOK_Y + 80)
    elif kind == 'ko':
        kof = o[1]
        if gframe >= kof:
            idx = [i for i, f in enumerate(s['frames']) if f >= kof][0]
            age = k - idx
            if s['slow'] and age > 66: return  # replay: KO card shown ~2.2 s then clears for the explosion
            sc = [1.7, 1.45, 1.25, 1.1][age] if age < 4 else 1.0
            im = T_KO.resize((int(T_KO.width * sc), int(T_KO.height * sc)), Image.NEAREST) if sc != 1 else T_KO
            frame.alpha_composite(im, (int(540 - im.width / 2), int(KO_Y - im.height / 2)))
    elif kind == 'replay':
        x = 96
        frame.alpha_composite(T_REPLAY, (x, REPLAY_Y))
        if (k // 15) % 2 == 0:
            frame.paste((255, 40, 40, 255), (x + T_REPLAY.width + 22, REPLAY_Y + 26, x + T_REPLAY.width + 50, REPLAY_Y + 54))
        frame.alpha_composite(T_SLOW, (x + 4, REPLAY_Y + T_REPLAY.height + 14))
    elif kind == 'cap':
        a, b = cap_imgs(o[1])
        paste_c(frame, a, 540, CAP_Y); paste_c(frame, b, 540, CAP_Y + 50)
    elif kind == 'end':
        if k >= 6: paste_c(frame, T_END1, 540, 330)
        if k >= 20: paste_c(frame, T_END2, 540, 1180)
        if k >= 26: paste_c(frame, T_END3, 540, 1310)

def load(cap, i):
    return Image.open(f'{cdir(cap)}/{i:05d}.png').convert('RGBA')

def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

def render_frame(s, k, i):
    im = load(s['cap'], i)
    if s['crop'] == 'title':
        z0, z1 = s['zoom']; e = ease((k - z0) / (z1 - z0))
        z = 3.0 + (1.0 - 3.0) * e
        w, h = 270 / z, 480 / z
        cx = 135; cy = 282 + (245 - 282) * e
        x0 = min(max(cx - w / 2, 0), 270 - w); y0 = min(max(cy - h / 2, 0), 540 - h)
        if z <= 1.0001: x0, y0, w, h = 0, 5, 270, 480
        fr = im.resize((W, H), Image.NEAREST, box=(x0, y0, x0 + w, y0 + h))
    else:
        assert im.size == (270, 480), im.size
        fr = im.resize((W, H), Image.NEAREST)
    for o in s['overlays']:
        overlay(fr, o, k, i, s)
    return fr.convert('RGB')

def video():
    names = sys.argv[2:]
    for s in SEGS:
        if names != ['all'] and s['name'] not in names: continue
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '30', f'{OUT}/seg_{s["name"]}.mp4']
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for k, i in enumerate(s['frames']):
            p.stdin.write(render_frame(s, k, i).tobytes())
        p.stdin.close(); p.wait(); print(s['name'], len(s['frames']), 'frames')

# ---------------- audio ----------------
XF = 0.35  # music crossfade (s)
def music_blocks():
    T = seg_times(); blocks = []
    for i, s in enumerate(SEGS):
        if blocks and blocks[-1]['track'] == s['music']: blocks[-1]['t1'] = T[i][1]
        else: blocks.append(dict(track=s['music'], t0=T[i][0], t1=T[i][1]))
    return blocks

def jobs():
    J = []
    caps = sorted({s['cap'] for s in SEGS if s['cap'] not in ('title', 'end')})
    for cap in caps:
        d = json.load(open(f'{cdir(cap)}/sfx.json'))
        n = len([f for f in os.listdir(cdir(cap)) if f.endswith('.png')])
        ln = n * d['every'] / 60 + 1.5
        ev = [[(st - d['start']) / 60, 'sfx', nm] for st, nm in d['events']]
        J.append(dict(name='sfx_' + cap, len=ln, events=ev))
    for bi, b in enumerate(music_blocks()):
        J.append(dict(name=f'mus{bi:02d}_{b["track"]}', len=b['t1'] - b['t0'] + XF + 0.6, events=[[0, 'music', b['track']]]))
    T = seg_times(); total = T[-1][1]
    st = {s['name']: T[i][0] for i, s in enumerate(SEGS)}
    ui = [[st[s['name']], 'sfx', 'select'] for s in SEGS if s['slow']] + [[st['end'] + 0.1, 'sfx', 'clear']]
    J.append(dict(name='ui', len=total + 0.5, events=ui))
    os.makedirs(OUT, exist_ok=True)
    json.dump(J, open(OUT + '/jobs.json', 'w')); print('jobs written; total', round(total, 3))

def readwav(p):
    w = wave.open(p); return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32767

def audio():
    SR = 44100
    T = seg_times(); total = T[-1][1]
    N = int(round(total * SR))
    mix = np.zeros((N, 2), np.float32)
    # music: one stem per block, equal-power crossfade XF centred on each cut
    mus = np.zeros((N, 2), np.float32)
    blocks = music_blocks()
    nx = int(XF * SR)
    for bi, b in enumerate(blocks):
        st = readwav(f'{OUT}/stems/mus{bi:02d}_{b["track"]}.wav')
        a = 0 if bi == 0 else int((b['t0'] - XF / 2) * SR)          # incoming stem starts at the fade start
        e = N if bi == len(blocks) - 1 else int((b['t1'] + XF / 2) * SR)
        L = min(len(st), e - a)
        g = np.ones(L, np.float32)
        if bi: g[:nx] = np.sin(np.linspace(0, np.pi / 2, nx))
        if bi < len(blocks) - 1 and L == e - a: g[-nx:] = np.cos(np.linspace(0, np.pi / 2, nx))
        mus[a:a + L] += st[:L] * g[:, None]
    gain = np.ones(N, np.float32)
    for i, s in enumerate(SEGS):
        if s['slow']: gain[int(T[i][0] * SR):int(T[i][1] * SR)] = 0.6
    gain = np.convolve(gain, np.ones(2205) / 2205, 'same')
    mix += mus * gain[:, None]
    stems = {}
    for i, s in enumerate(SEGS):
        if s['cap'] in ('title', 'end'): continue
        cap = s['cap']
        if cap not in stems: stems[cap] = readwav(f'{OUT}/stems/sfx_{cap}.wav')
        st = stems[cap]; ev = s['every']; fr = s['frames']
        out0 = int(round(T[i][0] * SR)); out1 = min(N, int(round(T[i][1] * SR)))
        sb = np.zeros((out1 - out0, 2), np.float32)
        for k in range(len(fr)):
            g0 = (fr[k] - 1) * ev / 60.0
            g1 = (fr[k + 1] - 1) * ev / 60.0 if k + 1 < len(fr) else g0 + (fr[k] - fr[k - 1]) * ev / 60.0
            a, b = int(g0 * SR), int(g1 * SR)
            o0, o1 = out0 + int(k * SR / FPS), out0 + int((k + 1) * SR / FPS)
            o1 = min(o1, N)
            if b <= a or o1 <= o0: continue
            chunk = st[a:b]
            if len(chunk) < 2: continue
            x = np.linspace(0, len(chunk) - 1, o1 - o0)
            o1 = min(o1, out1)
            if o1 <= o0: continue
            x = x[:o1 - o0]
            sb[o0 - out0:o1 - out0] += np.stack([np.interp(x, np.arange(len(chunk)), chunk[:, c]) for c in (0, 1)], 1)
        fz = int(0.006 * SR)  # 6 ms ramps at the cut points so sfx cut on the picture without clicks
        sb[:fz] *= np.linspace(0, 1, fz)[:, None]; sb[-fz:] *= np.linspace(1, 0, fz)[:, None]
        mix[out0:out1] += sb
    ui = readwav(OUT + '/stems/ui.wav')[:N]
    mix[:len(ui)] += ui
    f = int(0.6 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
    a = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    w = wave.open(OUT + '/mix_raw.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes()); w.close()
    print('audio', len(a) / SR)

def listing():
    T = seg_times()
    for s, (a, b) in zip(SEGS, T):
        print(f"{s['name']:12s} {a:6.2f}-{b:6.2f} ({b - a:4.2f}s) stage={s['stage']} part={s['part']} music={s['music']} cap={s['cap']} frames={s['frames'][0]}..{s['frames'][-1]}")
    print('total', round(T[-1][1], 3), 'frames', sum(len(s['frames']) for s in SEGS))
    with open(OUT + '/list.txt', 'w') as f:
        for s in SEGS: f.write(f"file 'seg_{s['name']}.mp4'\n")
    json.dump([dict(name=s['name'], stage=s['stage'], part=s['part'], t0=round(a, 3), t1=round(b, 3)) for s, (a, b) in zip(SEGS, T)], open(OUT + '/timeline.json', 'w'), indent=1)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    {'jobs': jobs, 'video': video, 'audio': audio, 'list': listing}[sys.argv[1]]()

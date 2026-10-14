#!/usr/bin/env python3
"""Audio for the Short: Freedoom's own SFX (from freedoom2.wad, placed at the exact times the engine
played them during capture) over Freedoom's MAP01 music (MIDI rendered with FluidR3_GM)."""
import json, struct, sys, wave, subprocess, os
import numpy as np
sys.path.insert(0, '/workspace/work/freedoom-short/tools')
from wad import lump
W = '/workspace/work/freedoom-short'
WAD = f'{W}/freedoom-0.13.0/freedoom2.wad'
SR = 44100
edl = json.load(open(f'{W}/build/edl.json'))
total = edl['total']
N = int(total * SR) + SR
sfx = np.zeros((N, 2), np.float32)

cache = {}
def sample(name, rate_mul=1.0):
    key = (name, rate_mul)
    if key in cache: return cache[key]
    b = lump(WAD, 'DS' + name.upper())
    if b is None: cache[key] = None; return None
    fmt, rate, cnt = struct.unpack('<HHI', b[:8])
    s = (np.frombuffer(b[8 + 16:8 + cnt - 16], np.uint8).astype(np.float32) - 128) / 128
    n_out = int(len(s) * SR / (rate * rate_mul))
    out = np.interp(np.linspace(0, len(s) - 1, n_out), np.arange(len(s)), s)
    cache[key] = out.astype(np.float32)
    return cache[key]

WEAPON = {'shotgn': 1.5, 'dshtgn': 1.7, 'pistol': 1.2, 'rlaunc': 1.5, 'barexp': 1.7, 'rxplod': 1.7, 'bfg': 1.6,
          'firxpl': 1.0, 'slop': 1.6, 'dbopn': 1.0, 'dbcls': 1.0, 'dbload': 1.0, 'sgcock': 1.0, 'plasma': 1.2}
VOICE_CUT = ('posit', 'bgsit', 'sgtsit', 'kntsit', 'cacsit', 'posact', 'bgact', 'dmact')

for seg in edl['segments']:
    if seg['shot'] == 'endcard': continue
    log = open(f"{W}/shots/{seg['shot']}.log").read().split()
    capstart = int(log[log.index('CAPSTART') + 1])
    t0, t1 = seg['in'] / 30.0, seg['out'] / 30.0
    last = {}
    for line in open(f"{W}/shots/{seg['shot']}.snd"):
        ms, name, vol, sep, maxvol, ts = line.split()
        t = (int(ms) - capstart) / 1000.0
        if t < t0 - 0.05 or t >= t1: continue
        name = name.lower()
        # thin out crowd vocals so weapons and gibs read
        if name.startswith(VOICE_CUT):
            if t - last.get('voice', -9) < 0.25: continue
            last['voice'] = t
            g = 0.35
        else:
            if t - last.get(name, -9) < 0.03: continue
            last[name] = t
            g = WEAPON.get(name, 0.8)
        slow = float(ts) < 0.99
        s = sample(name, 0.62 if slow else 1.0)   # kill-cam: pitch the real sample down
        if s is None: continue
        v = min(1.0, int(vol) / max(1, int(maxvol))) * g * (1.25 if slow else 1.0)
        pan = (int(sep) - 128) / 128.0
        gl, gr = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
        start = int((seg['start'] + max(0, t - t0)) * SR)
        if t < t0:  # sound started just before the cut: skip its head
            s = s[int((t0 - t) * SR):]
        n = min(len(s), N - start)
        sfx[start:start + n, 0] += s[:n] * v * gl
        sfx[start:start + n, 1] += s[:n] * v * gr

# title slam on the end card
end = [s for s in edl['segments'] if s['shot'] == 'endcard'][0]
for name, g in (('barexp', 1.4), ('dshtgn', 1.0)):
    s = sample(name, 0.8); st = int(end['start'] * SR); n = min(len(s), N - st)
    sfx[st:st + n] += (s[:n] * g)[:, None]

sfx = np.tanh(sfx * 0.9) * 0.92  # soft limiter on the SFX bus

# music: Freedoom MAP01 "Not My First Rodeo..." (D_RUNNIN), from its first big section change
mid = f'{W}/audio/D_RUNNIN.mid'
mw = '/tmp/D_RUNNIN.wav'
if not os.path.exists(mw):
    subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', str(SR), '-F', mw, '/usr/share/sounds/sf2/FluidR3_GM.sf2', mid],
                   capture_output=True)
w = wave.open(mw)
m = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
# find the strongest energy jump between 14.5 s and 17.5 s (section downbeat)
win = int(0.05 * SR)
e = np.array([np.sqrt((m[i:i + win] ** 2).mean()) for i in range(0, len(m) - win, win)])
lo, hi = int(14.5 / 0.05), int(17.5 / 0.05)
jump = np.argmax(e[lo + 1:hi] - e[lo:hi - 1]) + lo + 1
mstart = int(jump * win)
music = m[mstart:mstart + N]
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
music = music / (np.abs(music).max() + 1e-6) * 0.55
# duck under kill-cam moments (detected from the sfx logs' slow-mo flag) and fade out at the very end for the loop
duck = np.ones(N, np.float32)
for seg in edl['segments']:
    if seg['shot'] == 'endcard': continue
    log = open(f"{W}/shots/{seg['shot']}.log").read().split()
    capstart = int(log[log.index('CAPSTART') + 1])
    for line in open(f"{W}/shots/{seg['shot']}.snd"):
        ms, name, vol, sep, maxvol, ts = line.split()
        t = (int(ms) - capstart) / 1000.0
        if float(ts) < 0.99 and seg['in'] / 30 <= t < seg['out'] / 30:
            a = int((seg['start'] + t - seg['in'] / 30) * SR)
            duck[a:a + int(0.4 * SR)] = 0.45
k = np.ones(int(0.08 * SR)) / int(0.08 * SR)
duck = np.convolve(duck, k, mode='same').astype(np.float32)
music *= duck[:, None]
fade = int(0.5 * SR); endi = int(total * SR)
music[endi - fade:endi] *= np.linspace(1, 0, fade)[:, None]
music[endi:] = 0
music[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
mix = music + sfx
mix = mix[:endi]
mix = mix / max(1.0, np.abs(mix).max() / 0.97)
out = wave.open(f'{W}/build/audio.wav', 'w'); out.setnchannels(2); out.setsampwidth(2); out.setframerate(SR)
out.writeframes((mix * 32767).astype(np.int16).tobytes()); out.close()
print('AUDIO_OK music_start_s', round(mstart / SR, 2), 'len', round(len(mix) / SR, 2))

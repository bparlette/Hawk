#!/usr/bin/env python3
"""Original chiptune + SFX for the 14s 'We got live action' intro. Writes audio.wav (44.1k stereo)."""
import numpy as np, wave, os
SR, DUR = 44100, 14.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)

def note(n): return 440.0 * 2 ** ((n - 69) / 12)
def env(n, a=0.005, d=0.08, s=0.6, r=0.05):
    t = np.arange(n) / SR; T = n / SR; hold = T - r
    e = np.where(t < a, t / a, np.where(t < a + d, 1 - (1 - s) * (t - a) / d, s))
    return np.where(t > hold, e * np.clip(1 - (t - hold) / r, 0, 1), e)
def sq(f, n, duty=0.5, vib=0.0):
    t = np.arange(n) / SR
    ph = np.cumsum(f * (1 + vib * np.sin(2 * np.pi * 5.5 * t)) / SR)
    return np.where((ph % 1) < duty, 1.0, -1.0)
def tri(f, n):
    ph = np.cumsum(np.full(n, f) / SR); return 2 * np.abs(2 * (ph % 1) - 1) - 1
def noise(n): return rng.uniform(-1, 1, n)
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))
def blip(n_, t0, dur, gain, duty=0.5, pan=0.0, kind="sq", r=0.03, vib=0.0):
    n = int(dur * SR); f = note(n_)
    w = sq(f, n, duty, vib) if kind == "sq" else tri(f, n)
    add(w * env(n, d=0.06, s=0.55, r=min(r, dur * 0.9)), t0, gain, pan)
def kick(t0, g=0.9):
    n = int(0.18 * SR); t = np.arange(n) / SR
    ph = np.cumsum((50 + 110 * np.exp(-t * 35)) / SR)
    add(np.sin(2 * np.pi * ph) * np.exp(-t * 18), t0, g)
def snare(t0, g=0.35):
    n = int(0.15 * SR); t = np.arange(n) / SR
    add(noise(n) * np.exp(-t * 22) + 0.3 * sq(190, n) * np.exp(-t * 30), t0, g)
def hat(t0, g=0.12):
    n = int(0.04 * SR); x = np.diff(np.concatenate([[0], noise(n)]))
    add(x * np.exp(-np.arange(n) / SR * 90), t0, g)
def crash(t0, g=0.35, dur=1.2):
    n = int(dur * SR); x = np.diff(np.concatenate([[0], noise(n)]))
    add(x * np.exp(-np.arange(n) / SR * 3.5), t0, g)
def boom(t0, g=1.0):  # slam impact: deep pitch-drop + crunch
    n = int(0.6 * SR); t = np.arange(n) / SR
    ph = np.cumsum((38 + 160 * np.exp(-t * 14)) / SR)
    x = np.sign(np.sin(2 * np.pi * ph)) * 0.5 + np.sin(2 * np.pi * ph)
    add(x * np.exp(-t * 6), t0, g * 0.6); crash(t0, 0.3, 0.8)
def whoosh(t0, dur=0.35, g=0.35, up=True):
    n = int(dur * SR); t = np.arange(n) / SR; x = noise(n)
    a = np.linspace(0.05, 0.6, n) if up else np.linspace(0.6, 0.05, n)
    y = np.zeros(n); acc = 0.0
    for i in range(n): acc += a[i] * (x[i] - acc); y[i] = acc
    y = y - np.convolve(y, np.ones(30) / 30, "same")
    add(y * np.sin(np.pi * t / dur) * 3, t0, g)
def smooch(t0):  # 'mwah': rising chirp then a pop
    n = int(0.22 * SR); t = np.arange(n) / SR
    ph = np.cumsum((300 + 1500 * (t / t[-1]) ** 2) / SR)
    add(np.sin(2 * np.pi * ph) * np.sin(np.pi * t / t[-1]) ** 0.5 * 0.7, t0, 0.5)
    n2 = int(0.05 * SR); t2 = np.arange(n2) / SR
    add(np.sin(2 * np.pi * 900 * t2) * np.exp(-t2 * 80) + noise(n2) * np.exp(-t2 * 120) * 0.4, t0 + 0.2, 0.6)
def sparkle(t0, base=84, g=0.12):
    for i, d in enumerate([0, 4, 7, 12, 16, 19, 24]):
        blip(base + d, t0 + i * 0.04, 0.09, g, 0.25, pan=(-0.4 if i % 2 else 0.4))

BPM = 150; B = 60 / BPM; S16 = B / 4
# 0.0-1.5 sneak: staccato bass tiptoe (C minor)
sneak = [48, None, 51, None, 48, None, 53, 51, 48, None, 51, None, 55, 54, 53, None]
for i, n_ in enumerate(sneak):
    t = 0.05 + i * S16 * 0.9
    if t > 1.42: break
    if n_: blip(n_, t, 0.06, 0.32, 0.25, r=0.02)
for t in (0.05, 0.53, 1.01): hat(t, 0.06)
blip(88, 1.05, 0.05, 0.22, 0.125); blip(93, 1.1, 0.12, 0.22, 0.125)  # "!" alert
# 1.5 hoist
whoosh(1.32, 0.22, 0.4); boom(1.5, 0.8)
prog = [(48, [60, 64, 67]), (53, [60, 65, 69]), (55, [59, 62, 67]), (48, [60, 64, 67])]
t = 1.5; bar = 0
while t < 4.95:
    root, chord = prog[bar % 4]
    for s in range(16):
        ts = t + s * S16
        if ts >= 4.95: break
        blip(root + (12 if s % 2 else 0), ts, S16 * 0.8, 0.28, 0.5, r=0.01)
        blip(chord[s % 3] + 12, ts, S16 * 0.7, 0.10, 0.25, pan=0.3, r=0.01)
        if s % 4 == 0: kick(ts)
        if s % 8 == 4: snare(ts)
        hat(ts, 0.07 if s % 2 else 0.1)
    t += 16 * S16; bar += 1
hook = [(1.5, 72, 0.4), (1.9, 76, 0.2), (2.1, 79, 0.3), (2.45, 84, 0.4), (2.85, 83, 0.2), (3.05, 84, 0.6),
        (3.7, 79, 0.2), (3.9, 81, 0.2), (4.1, 79, 0.2), (4.3, 76, 0.3), (4.6, 77, 0.35)]
for t0, n_, d in hook: blip(n_, t0, d, 0.16, 0.5, pan=-0.2, vib=0.004)
for t0 in (2.0, 2.45, 2.85): boom(t0, 0.9)   # WE GOT / LIVE / ACTION! slams
crash(2.45, 0.35, 1.4)
# 5.0 smooch: sweet triangle chords
whoosh(4.85, 0.18, 0.3, up=False)
for t0, ch in ((5.0, [65, 69, 72]), (6.2, [64, 67, 72]), (7.1, [62, 65, 69, 74])):
    for n_ in ch: blip(n_, t0, 1.0 if t0 < 7 else 0.85, 0.12, kind="tri", r=0.3)
    blip(ch[0] - 24, t0, 0.9, 0.22, kind="tri", r=0.3)
smooch(5.42); sparkle(5.62, 84, 0.13); sparkle(6.3, 88, 0.08)
for i, n_ in enumerate([79, 81, 84, 81, 79, 76, 77, 76]):
    blip(n_, 6.0 + i * 0.25, 0.22, 0.10, kind="tri", r=0.1)
# 8.0 wipe + title fanfare
whoosh(7.85, 0.4, 0.45)
fan = [(8.4, 67, 0.12), (8.52, 67, 0.12), (8.64, 67, 0.12), (8.76, 72, 0.5), (9.3, 71, 0.12), (9.42, 72, 0.12),
       (9.54, 74, 0.12), (9.66, 76, 0.6), (10.35, 74, 0.15), (10.5, 76, 0.15), (10.65, 79, 0.9)]
for t0, n_, d in fan:
    blip(n_, t0, d, 0.2, 0.5, vib=0.006); blip(n_ - 12, t0, d, 0.1, 0.25)
boom(8.87, 0.7)  # logo lands
t = 8.76
while t < 13.0:
    for s in range(8):
        ts = t + s * (B / 2)
        if ts >= 13.0: break
        root = [48, 53, 55, 48][int((ts - 8.76) / (4 * B)) % 4]
        blip(root + (12 if s % 2 else 0), ts, B / 2 * 0.8, 0.22, 0.5, r=0.01)
        if s % 2 == 0: kick(ts, 0.7)
        if s % 4 == 2: snare(ts, 0.28)
        hat(ts + B / 4, 0.06)
    t += 4 * B
for n_ in (60, 64, 67, 72): blip(n_, 11.6, 2.2, 0.09, 0.5, r=1.2, vib=0.005)
for i in range(4): blip([76, 79, 84, 88][i], 8.97 + i * 0.12, 0.1, 0.1, 0.25)  # brothers hop in
crash(11.6, 0.25, 2.0)

mix = np.stack([L, R], 1)
fl = int(0.4 * SR); mix[-fl:] *= np.linspace(1, 0, fl)[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= max(1e-9, np.abs(mix).max()) / 0.89
with wave.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", N / SR)

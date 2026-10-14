# Original synthwave / hair-metal-ish backing track for "Paradise Thunder". 120 BPM, A minor-ish.
import numpy as np, wave
SR = 44100
DUR = 36.5 + 1.0
N = int(SR * DUR)
out = np.zeros((N, 2))
BEAT = 0.5
rng = np.random.default_rng(7)

def t_arr(d): return np.arange(int(SR * d)) / SR
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR); j = min(N, i + len(sig)); sig = sig[: j - i] * gain
    out[i:j, 0] += sig * (1 - pan) ; out[i:j, 1] += sig * (1 + pan)
def env(n, a=0.005, r=0.1, d=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4))
    if d is not None: e *= np.exp(-t / d)
    rel = int(r * SR)
    if rel > 0 and rel < n: e[-rel:] *= np.linspace(1, 0, rel)
    return e
def saw(f, d, det=0.0):
    t = t_arr(d); s = 2 * ((t * f) % 1) - 1
    if det: s = 0.5 * s + 0.5 * (2 * ((t * f * (1 + det)) % 1) - 1)
    return s
def sq(f, d): t = t_arr(d); return np.sign(np.sin(2 * np.pi * f * t))
def lp(x, a):  # one-pole low-pass
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y
def lpv(x, a):  # vectorised-ish approximate lowpass via cumulative filter (scipy-free): use FFT
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / a) ** 4); return np.fft.irfft(X, len(x))
def nf(n): return 440 * 2 ** ((n - 69) / 12)

def kick(): t = t_arr(0.35); f = 50 + 120 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-t * 9)
def snare(): t = t_arr(0.25); n = rng.uniform(-1, 1, len(t)); return (0.7 * lpv(n, 6000) + 0.4 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 16)
def hat(o=False): t = t_arr(0.2 if o else 0.05); n = rng.uniform(-1, 1, len(t)); X = n - np.concatenate([[0], n[:-1]]); return X * np.exp(-t * (18 if o else 70))
def crash(): t = t_arr(2.0); n = rng.uniform(-1, 1, len(t)); X = n - np.concatenate([[0], n[:-1]]); return X * np.exp(-t * 2.2)
def gated_rev(x):  # 80s gated reverb-ish smear
    y = x.copy()
    for k, g in [(0.013, .5), (0.029, .4), (0.047, .35), (0.071, .3), (0.097, .25)]:
        s = int(k * SR); y[s:] += g * x[:-s]
    return y

K, S, H, HO, C = kick(), gated_rev(snare()), hat(), hat(True), crash()

# Sections (seconds): intro 0-4, verse 4-24.7, standoff 24.7-27.5, fight 27.5-32.5, finale 32.5-36.5
prog = [57, 53, 55, 52]  # A F G E (roots, MIDI around A3)
def chord_at(t): return prog[int(t // 2) % 4]

# Pad (whole track)
for bar in range(19):
    st = bar * 2.0
    if st >= 36.5: break
    r = chord_at(st); notes = [r, r + 7, r + 12, r + (3 if r in (57, 52) else 4) + 12]
    p = sum(saw(nf(n), 2.0, 0.006) for n in notes) / 4
    p = lpv(p, 1800 if st < 4 else 2600) * env(len(p), 0.25, 0.3)
    add(p, st, 0.0, 0.18 if not (24.7 <= st < 27.5) else 0.1)

# Intro riser 0-4: arp + sweep
for i in range(16):
    st = i * 0.25; r = chord_at(st)
    n = [r + 12, r + 19, r + 24, r + 19][i % 4]
    s = sq(nf(n), 0.22) * env(int(0.22 * SR), 0.003, 0.05, 0.12)
    add(lpv(s, 1500 + i * 250), st, 0.3 * (1 if i % 2 else -1), 0.10)
sw = rng.uniform(-1, 1, int(4 * SR)) * np.linspace(0, 1, int(4 * SR)) ** 2
add(lpv(sw, 3000), 0, 0, 0.12)
add(C, 4.0, 0, 0.35)

def drums(a, b, heavy=False):
    t = a
    i = 0
    while t < b - 1e-6:
        beat = i % 4
        if beat in (0, 2) or (heavy): add(K, t, 0, 0.9)
        if beat in (1, 3): add(S, t, 0, 0.55 if not heavy else 0.7)
        add(H, t + 0.25, 0.3, 0.18); add(H, t, -0.3, 0.12)
        if heavy: add(K, t + 0.25, 0, 0.6)
        t += BEAT; i += 1

def bass(a, b, eighth=True):
    t = a
    while t < b - 1e-6:
        r = chord_at(t) - 24
        s = (saw(nf(r), 0.24) + 0.5 * sq(nf(r) / 2, 0.24)) * env(int(0.24 * SR), 0.003, 0.04)
        add(lpv(s, 900), t, 0, 0.35); t += 0.25 if eighth else 0.5

def guitar(a, b, gain=0.16):  # distorted power chords, palm-muted eighths
    t = a; i = 0
    while t < b - 1e-6:
        r = chord_at(t) - 12
        d = 0.22 if i % 4 else 0.45
        s = saw(nf(r), d, 0.01) + saw(nf(r + 7), d, 0.012) + 0.6 * saw(nf(r + 12), d)
        s = np.tanh(s * 4.0); s = lpv(s, 3200) * env(len(s), 0.003, 0.05)
        add(s, t, -0.4 if i % 2 else 0.4, gain); t += 0.25; i += 1

def lead(notes, start, step=0.25, gain=0.12):
    for k, n in enumerate(notes):
        if n is None: continue
        d = step * 0.95; t = t_arr(d)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t) * np.minimum(1, t * 4)
        ph = 2 * np.pi * np.cumsum(nf(n) * vib) / SR
        s = np.tanh(3 * (2 * ((ph / (2 * np.pi)) % 1) - 1)) * env(len(t), 0.01, 0.05)
        add(lpv(s, 4000), start + k * step, 0.1, gain)

drums(4.0, 24.7); bass(4.0, 24.7); guitar(12.0, 24.7, 0.10)
# hook melody (original)
hook = [69, None, 72, 74, 76, None, 74, 72, 74, None, 72, 69, 67, None, 64, 67]
for st in (8.0, 16.0):
    lead(hook, st); lead([n + 0 if n else None for n in hook[::-1]], st + 4.0)
# standoff: tense pulse, no snare
t = 24.7
while t < 27.4:
    add(K, t, 0, 0.6); s = saw(nf(40), 0.2) * env(int(0.2 * SR), 0.003, 0.05); add(lpv(s, 500), t, 0, 0.4); t += 0.5
tick = 24.7
while tick < 27.4: add(HO, tick + 0.25, 0.4, 0.1); tick += 0.5
# whip swoosh into fight
w = rng.uniform(-1, 1, int(0.45 * SR)) * np.linspace(0, 1, int(0.45 * SR)) ** 3
add(lpv(w, 5000), 27.05, 0, 0.5)
# fight
add(C, 27.5, 0, 0.5)
for hit in (27.5, 28.2, 28.9, 29.6):
    add(K * 1.0, hit, 0, 1.0); add(S, hit, 0, 0.6)
drums(27.5, 32.5, heavy=True); bass(27.5, 32.5); guitar(27.5, 32.5, 0.17)
lead([76, 79, 81, 79, 76, 74, 76, None, 81, 83, 84, 83, 81, 79, 81, None] * 1, 28.5, 0.25, 0.11)
# finale
add(C, 32.5, 0, 0.45); drums(32.5, 34.5); bass(32.5, 34.5); guitar(32.5, 34.5, 0.13)
for n in (57, 64, 69, 72, 76):
    s = np.tanh(3 * saw(nf(n - 12), 3.5, 0.01)) * env(int(3.5 * SR), 0.01, 1.5, 1.6)
    add(lpv(s, 3000), 34.5, 0, 0.09)
add(K, 34.5, 0, 1.0); add(C, 34.5, 0, 0.4)

out = out[: int(36.5 * SR)]
fade = int(1.2 * SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= np.max(np.abs(out)) + 1e-9; out *= 0.89
pcm = (out * 32767).astype(np.int16)
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', len(out) / SR)

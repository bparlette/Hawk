# Original score for the Cinema City short (no samples, no copyrighted material).
# usage: python3 synth.py timeline.json out.wav   timeline: {dur, sections:[[t0,t1,kind]], hits:[t], whooshes:[t]}
import json, sys, numpy as np, wave
T = json.load(open(sys.argv[1])); OUT = sys.argv[2]
SR = 44100; DUR = T['dur']; N = int(DUR * SR) + SR
L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(11)
BPM = 140; BEAT = 60 / BPM
def add(sig, t0, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0: return
    s = sig[:N - i] * g; L[i:i+len(s)] += s * (1 - max(0, pan)); R[i:i+len(s)] += s * (1 + min(0, pan))
from scipy.signal import lfilter
def lp(x, a):
    if np.ndim(a) == 0: return lfilter([a], [1, a - 1], x)
    a = np.broadcast_to(a, x.shape); y = np.empty_like(x); zi = np.zeros(1); B = 256
    for i in range(0, len(x), B):
        aa = float(a[i:i+B].mean()); y[i:i+B], zi = lfilter([aa], [1, aa - 1], x[i:i+B], zi=zi)
    return y
tt = lambda d: np.arange(int(d * SR)) / SR
def kick(): t = tt(0.3); f = 48 + 120 * np.exp(-t * 30); return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 9)
def snare(): t = tt(0.2); return rng.standard_normal(len(t)) * 0.6 * np.exp(-t * 18) + np.sin(2*np.pi*185*t) * 0.5 * np.exp(-t * 25)
def hat(): t = tt(0.04); x = rng.standard_normal(len(t)); return (x - lp(x, 0.3)) * np.exp(-t * 80)
def boom(): t = tt(1.4); f = 38 + 100 * np.exp(-t * 9); return np.tanh(2.5 * np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 2.6)) + lp(rng.standard_normal(len(t)), 0.04) * np.exp(-t * 4) * 2.5
def crash(): t = tt(1.8); x = rng.standard_normal(len(t)); return (x - lp(x, 0.25)) * np.exp(-t * 2.4)
def whoosh(d=0.6):
    t = tt(d); x = rng.standard_normal(len(t)); env = np.sin(np.pi * t / d) ** 2
    return lp(x, 0.08 + 0.25 * t / d) * env * 2.2
def riser(d):
    t = tt(d); x = rng.standard_normal(len(t)); f = 200 * (8 ** (t / d))
    return (lp(x, 0.02 + 0.3 * (t / d) ** 2) * (t / d) ** 2 * 1.5 + 0.25 * np.sin(2*np.pi*np.cumsum(f)/SR) * (t / d) ** 3)
def saw(f, d, det=0.006):
    t = tt(d); return sum(2 * ((f * (1 + k) * t) % 1) - 1 for k in (-det, det)) / 2
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [45, 41, 43, 40]  # A F G E (bass roots)
K, S, H, B, C = kick(), snare(), hat(), boom(), crash()
def bass(m, d): t = tt(d); s = saw(NOTE(m), d); return lp(s, 0.12) * np.exp(-t * 3) * (1 - np.exp(-t * 300))
def pad(ms, d):
    t = tt(d); s = sum(saw(NOTE(m), d, 0.008) for m in ms) / len(ms); env = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)
    return lp(s, 0.05) * env
def lead(m, d): t = tt(d); s = np.sign(np.sin(2*np.pi*NOTE(m)*t)) * 0.5 + saw(NOTE(m), d) * 0.5; return lp(s, 0.2) * np.exp(-t * 6)
for t0, t1, kind in T['sections']:
    if kind == 'intro':
        add(riser(t1 - t0), t0, 0.5)
        add(pad([57, 60, 64], t1 - t0), t0, 0.35)
        nb = int((t1 - t0) / (BEAT / 2))
        for i in range(nb):  # pulsing low A eighths, building
            add(bass(33 if i % 2 == 0 else 45, BEAT / 2), t0 + i * BEAT / 2, 0.25 + 0.35 * i / max(1, nb))
    elif kind == 'groove':
        nb = int((t1 - t0) / BEAT + 1e-6)
        for b in range(nb):
            t = t0 + b * BEAT; root = prog[(b // 4) % 4]
            add(K, t, 0.9); 
            if b % 2 == 1: add(S, t, 0.55)
            for h in (0, 0.5): add(H, t + h * BEAT, 0.25, 0.3)
            for h in (0, 0.5): add(bass(root - 12 if h == 0 else root, BEAT / 2), t + h * BEAT, 0.45)
            arp = [root + 24, root + 31, root + 36, root + 31]
            add(lead(arp[b % 4] + (3 if root in (45, 40) else 4) * (b % 2), BEAT / 2), t + 0.5 * BEAT, 0.12, -0.3)
    elif kind == 'replay':  # half-time, low and wide: slow-motion feel
        nb = int((t1 - t0) / (2 * BEAT) + 1e-6)
        add(pad([45, 52, 57, 60], t1 - t0), t0, 0.4)
        for b in range(nb):
            t = t0 + b * 2 * BEAT; add(K, t, 0.8); add(S, t + BEAT, 0.35)
            add(bass(33, 2 * BEAT), t, 0.45)
    elif kind == 'end':
        add(pad([45, 57, 60, 64, 69], t1 - t0), t0, 0.5); add(B, t0, 0.8); add(C, t0, 0.35)
        add(bass(33, t1 - t0), t0, 0.5)
for t in T.get('hits', []): add(B, t, 0.9); add(C, t, 0.3)
for t in T.get('whooshes', []): add(whoosh(), t - 0.3, 0.45)
mix = np.stack([L, R], 1)[: int(DUR * SR)]
fade = int(0.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = np.tanh(mix * 0.9); mix /= max(1e-6, np.abs(mix).max()); mix *= 0.89
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
print('wrote', OUT, DUR)

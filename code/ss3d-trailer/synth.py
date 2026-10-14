# Original backing track (no samples, no copyrighted material): 160 BPM arcade synth-rock in A minor.
# Structure follows timeline.json: intro swell over the title, driving groove under the feature beats, a
# hit + crash on every cut, a breakdown riser before the boss, big ending chord under the end card.
import json, numpy as np, wave
T = json.load(open('/workspace/work/ss3d-trailer/timeline.json'))
SR = 44100; BPM = T['bpm']; BEAT = 60 / BPM
cuts = []; t = 0
for name, d, _ in T['beats']: cuts.append((t, name)); t += d
DUR = t + 0.6; N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); 
    if i >= N: return
    s = sig[: N - i] * gain
    L[i:i + len(s)] += s * (1 - max(0, pan)); R[i:i + len(s)] += s * (1 + min(0, pan))
def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    tt = np.arange(n) / SR; e = np.ones(n)
    ai = int(a * SR); e[:ai] = np.linspace(0, 1, ai) if ai else 1
    dec = np.exp(-(tt - a) / max(d, 1e-4)) * (1 - s) + s; e[ai:] = dec[ai:]
    ri = int(r * SR); 
    if ri and ri < n: e[-ri:] *= np.linspace(1, 0, ri)
    return e
def osc(kind, f, dur, detune=0.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    out = 0
    for dt in ([0] if not detune else [-detune, detune]):
        ph = (f * (1 + dt)) * tt
        if kind == 'saw': out = out + 2 * (ph % 1) - 1
        elif kind == 'sq': out = out + np.sign(np.sin(2 * np.pi * ph))
        elif kind == 'sin': out = out + np.sin(2 * np.pi * ph)
        elif kind == 'tri': out = out + 2 * np.abs(2 * (ph % 1) - 1) - 1
    return out / (1 if not detune else 2)
def lp(x, a):  # one-pole low-pass, a in (0,1]
    y = np.empty_like(x); acc = 0.0; aa = np.broadcast_to(np.asarray(a, float), x.shape)
    for i in range(len(x)): acc += aa[i] * (x[i] - acc); y[i] = acc
    return y
def kick(): n = int(0.32 * SR); tt = np.arange(n) / SR; f = 50 + 110 * np.exp(-tt * 28); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
def snare(): n = int(0.22 * SR); tt = np.arange(n) / SR; return (rng.standard_normal(n) * 0.7 * np.exp(-tt * 16) + np.sin(2 * np.pi * 190 * tt) * 0.5 * np.exp(-tt * 22))
def hat(o=False): n = int((0.12 if o else 0.04) * SR); x = rng.standard_normal(n); x = x - lp(x, 0.3); return x * np.exp(-np.arange(n) / SR * (18 if o else 70))
def crash(): n = int(1.6 * SR); x = rng.standard_normal(n); x = x - lp(x, 0.2); return x * np.exp(-np.arange(n) / SR * 2.6)
def boom(): n = int(1.1 * SR); tt = np.arange(n) / SR; f = 40 + 90 * np.exp(-tt * 10); return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2)) + lp(rng.standard_normal(n), 0.05) * np.exp(-tt * 5) * 2
KICK, SN, HC, HO, CR, BM = kick(), snare(), hat(), hat(True), crash(), boom()
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
# chord roots per bar (A minor: Am F C G / Am F G E)
prog = [57, 53, 48, 55, 57, 53, 55, 52]
quals = {57: [0, 3, 7], 53: [0, 4, 7], 48: [0, 4, 7], 55: [0, 4, 7], 52: [0, 4, 7]}
t_intro = cuts[1][0]; t_end = cuts[-1][0]
boss_t = [c for c in cuts if c[1] == 'boss'][0][0]
bar = 4 * BEAT
nb = int(np.ceil(DUR / bar))
for b in range(nb):
    t0 = b * bar; root = prog[b % 8]
    if t0 >= t_end: break
    intro = t0 < t_intro
    brk = boss_t - bar <= t0 < boss_t  # one-bar breakdown before the boss
    # pad chord (detuned saws, filtered)
    for iv in quals[root]:
        s = osc('saw', NOTE(root + 12 + iv), bar, 0.004) * env(int(bar * SR), a=0.08, d=3, s=0.7, r=0.1)
        add(lp(s, 0.08), t0, 0.05, pan=(iv - 3) / 10)
    if intro:
        # rising arp + swell over the title
        for k in range(8):
            m = root + 12 + [0, 3, 7, 12, 15, 12, 7, 3][k]
            s = osc('sq', NOTE(m + 12), BEAT / 2) * env(int(BEAT / 2 * SR), d=0.12)
            add(lp(s, 0.3), t0 + k * BEAT / 2, 0.05 + 0.03 * b)
        continue
    for q in range(4):
        tb = t0 + q * BEAT
        if not brk: add(KICK, tb, 0.9)
        if q in (1, 3): add(SN, tb, 0.42 if not brk else 0.25)
        add(HC, tb + BEAT / 2, 0.16); add(HC, tb, 0.10)
        # driving 8th-note bass
        for e8 in range(2):
            m = root - 12 + (12 if (q * 2 + e8) % 4 == 3 else 0)
            s = osc('saw', NOTE(m), BEAT / 2 * 0.9) * env(int(BEAT / 2 * 0.9 * SR), d=0.18, s=0.3, r=0.02)
            add(np.tanh(1.6 * lp(s, 0.12)), tb + e8 * BEAT / 2, 0.30 if not brk else 0.12)
    if brk:  # riser
        n = int(bar * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n); x = lp(x, 0.02 + 0.3 * tt / bar)
        add(x * (tt / bar) ** 2, t0, 0.5)
        continue
    # lead arpeggio (16ths) - original pattern
    pat = [0, 7, 12, 7, 15, 12, 7, 3, 0, 7, 12, 19, 15, 12, 7, 12]
    for k in range(16):
        m = root + 24 + pat[k] - (0 if quals[root][1] == 3 else (1 if pat[k] in (3, 15) else 0))
        d = BEAT / 4
        s = osc('sq', NOTE(m), d * 0.85) * env(int(d * 0.85 * SR), d=0.07)
        add(lp(s, 0.25), t0 + k * d, 0.045, pan=0.35 if k % 2 else -0.35)
# hits on every cut
for t0, name in cuts[1:]:
    add(CR, t0, 0.22); add(BM, t0, 0.35 if name in ('boss', 'end', 'fire', 'van') else 0.22)
# ending: big chord + boom
for iv in [0, 3, 7, 12]:
    s = osc('saw', NOTE(45 + 12 + iv), 3.6, 0.005) * env(int(3.6 * SR), a=0.01, d=1.6, s=0.0, r=0.3)
    add(lp(s, 0.12), t_end, 0.12)
add(BM, t_end, 0.6); add(KICK, t_end, 1.0)
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix /= np.max(np.abs(mix)) + 1e-9; mix *= 0.89
fade = int(0.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
pcm = (mix * 32767).astype(np.int16)
w = wave.open('/workspace/work/ss3d-trailer/hf/music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print('music', DUR, 's; cuts', [(round(a, 2), b) for a, b in cuts])

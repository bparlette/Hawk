"""Original synthesized retro hype beat (no samples, no copyrighted music) + impact SFX.

synth(duration_s, out_wav, bpm=150, key=0, hits=[(t, kind)], seed=0)
  kind: "slam" (boom + noise crack), "whoosh" (rising noise), "ko" (big boom + ring), "flash" (short crack)
"""
import numpy as np, wave

SR = 44100


def _env(n, a=0.002, r=0.1):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
    return e


def _sq(f, n, duty=0.5):
    ph = (np.arange(n) * f / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def _saw(f, n):
    ph = (np.arange(n) * f / SR) % 1.0
    return 2 * ph - 1


def kick(n=int(0.35 * SR)):
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * 1.0


def snare(rng, n=int(0.22 * SR)):
    t = np.arange(n) / SR
    return (rng.uniform(-1, 1, n) * 0.7 + np.sin(2 * np.pi * 185 * t) * 0.4) * np.exp(-t * 16)


def hat(rng, n=int(0.05 * SR)):
    x = rng.uniform(-1, 1, n)
    x = np.diff(np.concatenate([[0], x]))  # crude highpass
    return x * np.exp(-np.arange(n) / SR * 70) * 0.35


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]


def sfx(kind, rng):
    if kind == "slam":
        n = int(0.8 * SR); t = np.arange(n) / SR
        boom = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t * 18)) / SR) * np.exp(-t * 4.5)
        crack = rng.uniform(-1, 1, n) * np.exp(-t * 30) * 0.6
        return (boom * 1.1 + crack) * 0.9
    if kind == "ko":
        n = int(1.8 * SR); t = np.arange(n) / SR
        boom = np.sin(2 * np.pi * np.cumsum(32 + 120 * np.exp(-t * 10)) / SR) * np.exp(-t * 2.2)
        ring = _sq(mtof(76), n, 0.25) * np.exp(-t * 3) * 0.15 + _sq(mtof(83), n, 0.25) * np.exp(-t * 3.5) * 0.1
        crack = rng.uniform(-1, 1, n) * np.exp(-t * 14) * 0.7
        return boom * 1.2 + ring + crack
    if kind == "whoosh":
        n = int(0.6 * SR); t = np.arange(n) / SR
        x = rng.uniform(-1, 1, n)
        k = np.linspace(0.02, 0.6, n)  # rising brightness via one-pole lowpass with rising coeff
        y = np.zeros(n); acc = 0.0
        for i in range(n):
            acc += k[i] * (x[i] - acc); y[i] = acc
        return y * np.sin(np.pi * t / t[-1]) * 0.8
    if kind == "flash":
        n = int(0.25 * SR); t = np.arange(n) / SR
        return rng.uniform(-1, 1, n) * np.exp(-t * 25) * 0.5 + np.sin(2 * np.pi * 60 * t) * np.exp(-t * 12) * 0.5
    return np.zeros(1)


# E minor rock riff (semitones from E), 2 bars x 8 eighths, reused with chord roots
RIFF = [0, 0, 12, 0, 10, 0, 7, 5, 0, 0, 12, 0, 15, 14, 12, 10]
ROOTS = [0, 0, 8, 10, 0, 0, 3, 10]  # Em Em C D Em Em G D (per bar)


def synth(duration, out_wav, bpm=150, key=0, hits=(), seed=0, intensity=1.0, drop_at=None):
    rng = np.random.default_rng(seed)
    n = int(duration * SR) + SR
    mus = np.zeros(n); fx = np.zeros(n)
    beat = 60.0 / bpm; e8 = beat / 2; e16 = beat / 4
    base = 40 + key  # E2
    nb = int(duration / beat) + 2
    K = kick(); 
    for b in range(nb):
        t = b * beat
        bar = b // 4
        if drop_at is not None and drop_at - beat * 2 <= t < drop_at:
            # pre-drop: snare roll riser
            for s in range(4):
                add(mus, snare(rng) * (0.4 + 0.15 * s), t + s * e16)
            continue
        add(mus, K * 0.9, t)
        if b % 2 == 1:
            add(mus, snare(rng) * 0.8, t)
        if b % 4 == 3:
            add(mus, K * 0.6, t + e8)
        for s in range(4):
            add(mus, hat(rng) * (1.0 if s % 2 == 0 else 0.6), t + s * e16)
        root = ROOTS[bar % len(ROOTS)]
        # driving 8th-note bass (saw, octave pumping)
        for s in range(2):
            m = base + root + (12 if s == 1 else 0)
            ln = int(e8 * SR * 0.9)
            add(mus, _saw(mtof(m), ln) * _env(ln, 0.002, 0.12) * 0.32, t + s * e8)
        # lead riff (square), plays from bar 2 onward
        if bar >= 2 or drop_at is None:
            for s in range(2):
                idx = ((b * 2 + s) % 16)
                m = base + 24 + RIFF[idx] + (0 if root in (0, 3) else root - 12 if root > 6 else root)
                ln = int(e8 * SR * 0.8)
                add(mus, _sq(mtof(m), ln, 0.25) * _env(ln, 0.003, 0.09) * 0.11 * intensity, t + s * e8)
        # power-chord stab every bar downbeat
        if b % 4 == 0:
            ln = int(beat * SR * 1.6)
            for iv in (0, 7, 12):
                add(mus, _saw(mtof(base + 12 + root + iv), ln) * _env(ln, 0.005, 0.35) * 0.07, t)
    for (t, kind) in hits:
        add(fx, sfx(kind, rng), t)
    mix = mus * 0.8 + fx * 0.9
    # fade out last 1.2 s
    fo = int(1.2 * SR); end = int(duration * SR)
    mix[end - fo:end] *= np.linspace(1, 0, fo)
    mix = mix[:end]
    mix = np.tanh(mix * 1.3) * 0.85  # soft clip glue
    st = np.stack([mix, mix], 1)
    pcm = (st * 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    synth(10, "/tmp/synth_test.wav", hits=[(2.0, "slam"), (5.0, "ko"), (7, "whoosh")], drop_at=3.2)
    print("ok")

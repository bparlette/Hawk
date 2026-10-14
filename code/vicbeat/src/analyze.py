# Beat analysis for Voltage Vic beatmaps: prints NUMBERS ONLY (tempo, first-beat offset, drift, loudness, heatmap). No audio is written to $OUT.
import json, subprocess, sys, os, numpy as np
SR = 22050; HOP = 256; N = 1024
def analyze(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64); dur = len(x) / SR
    nf = 1 + (len(x) - N) // HOP; win = np.hanning(N)
    idx = np.arange(N)[None, :] + HOP * np.arange(nf)[:, None]
    S = np.abs(np.fft.rfft(x[idx] * win, axis=1)); S = np.log1p(100 * S)
    fr = np.fft.rfftfreq(N, 1 / SR)
    flux = np.maximum(0, np.diff(S, axis=0)); lo = flux[:, fr < 180].sum(1); full = flux.sum(1)
    env = full - np.convolve(full, np.ones(32) / 32, 'same'); env = np.maximum(env, 0)
    lenv = lo - np.convolve(lo, np.ones(32) / 32, 'same'); lenv = np.maximum(lenv, 0)
    t = (np.arange(len(env)) + 1) * HOP / SR + N / 2 / SR  # frame centre time of the diff
    rms = np.sqrt(np.convolve(x * x, np.ones(SR) / SR, 'same')[::SR])  # 1 s loudness
    def fold(bpm, e=env, tt=t):
        P = 60 / bpm; ph = 2 * np.pi * (tt % P) / P; z = (e * np.exp(1j * ph)).sum() / (e.sum() + 1e-9); return abs(z), (np.angle(z) % (2 * np.pi)) / (2 * np.pi) * P
    best = None
    for bpm in np.arange(100, 150, 0.05):
        r, o = fold(bpm)
        if best is None or r > best[0]: best = (r, bpm, o)
    r, b0, _ = best
    for bpm in np.arange(b0 - 0.1, b0 + 0.1, 0.002):
        rr, o = fold(bpm)
        if rr > best[0]: best = (rr, bpm, o)
    r, bpm, off = best; P = 60 / bpm; off = (off + BIAS) % P
    # per-10 s window phase drift (ms) against the global grid
    drift = []
    for w0 in np.arange(0, dur - 10, 10):
        m = (t >= w0) & (t < w0 + 10)
        if env[m].sum() < 1e-6: drift.append(None); continue
        rw, ow = fold(bpm, env[m], t[m]); d = ((ow - off + P / 2) % P) - P / 2; drift.append([round(float(w0)), round(d * 1000, 1), round(float(rw), 3)])
    # bar phase: which of the 4 beats carries the most low-band (kick) onset energy
    bars = []
    for k in range(4):
        bt = off + P * (k + 4 * np.arange(int(dur / P / 4)))
        bars.append(float(sum(lenv[max(0, int(round((b - N / 2 / SR) * SR / HOP)) - 2):int(round((b - N / 2 / SR) * SR / HOP)) + 3].max(initial=0) for b in bt)))
    return dict(dur=round(dur, 3), bpm=round(float(bpm), 3), beat0=round(float(off), 4), period=round(P, 5), strength=round(float(r), 3),
                bar_kick=[round(v, 1) for v in bars], drift_ms=drift, loud_1s=[round(float(v), 4) for v in rms])
BIAS = 0.0065  # measured on a synthetic 127.3 BPM kick track: the flux peak leads the audible attack by 6.5 ms
if __name__ == '__main__':
  out = os.environ.get('OUT', '.'); res = {}
  for vid in sys.argv[1:]:
      d = '/tmp/a_' + vid; os.makedirs(d, exist_ok=True)
      try:
          p = subprocess.run(['yt-dlp', '-q', '--no-playlist', '-f', 'bestaudio', '-o', d + '/a.%(ext)s', '--print-json', '--no-simulate', 'https://www.youtube.com/watch?v=' + vid], capture_output=True, text=True, timeout=300); info = json.loads((p.stdout or '{}').splitlines()[0] if p.stdout.strip() else '{}')
          f = [os.path.join(d, n) for n in os.listdir(d)]
          if not f: res[vid] = {'error': 'download failed: ' + p.stderr[-600:]}; continue
          r = analyze(f[0]); r['yt_duration'] = info.get('duration'); r['title'] = info.get('title')
          hm = info.get('heatmap') or []; r['heatmap'] = [[round(h['start_time'], 1), round(h['value'], 3)] for h in hm]
          res[vid] = r
      except Exception as e: res[vid] = {'error': repr(e)[:400]}
      finally: subprocess.run(['rm', '-rf', d])
  json.dump(res, open(os.path.join(out, 'beats.json'), 'w'), indent=1); print(json.dumps({k: {kk: v[kk] for kk in v if kk not in ('loud_1s', 'heatmap', 'drift_ms')} for k, v in res.items()}, indent=1))

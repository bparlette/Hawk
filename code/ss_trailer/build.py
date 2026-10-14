"""Shell Shock trailer editor.

Reads raw captures (raw/levelN/: frames/*.jpg + meta.jsonl), finds key moments from the
per-frame metadata, and renders with PIL piped into ffmpeg:
  screens/levelN/*.jpg + contact sheet         (best stills per level)
  out/level{N}.mp4                              (per-level mini movie, ~7 s)
  out/full_trailer.mp4                          (whole-game trailer, ~4.8 s per level + ~4 s cards)
  out/*.jpg posters, out/manifest.json          (durations/sizes for the page)

python3 build.py [all|stills|levels|full] [level numbers...]   (default all; numbers limit stills/levels)
"""
import json, os, sys, glob, math, random, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
from synth import synth

HERE = os.path.dirname(os.path.abspath(__file__))
RAW, OUT, SCR, TMP = (os.path.join(HERE, d) for d in ("raw", "out", "screens", "_tmp"))
for d in (OUT, SCR, TMP):
    os.makedirs(d, exist_ok=True)
W, H, FPS = 1280, 720, 30
BPM = 150
BEAT = int(round(FPS * 60 / BPM))  # 12 frames per beat
F_BIG = os.path.join(HERE, "fonts/Anton.ttf")
F_PIX = os.path.join(HERE, "fonts/PressStart2P.ttf")
F_BUN = os.path.join(HERE, "fonts/Bungee.ttf")
PLAY_URL = "shellshock-live.surge.sh"
LEVEL_NAMES_FALLBACK = {1: "HALLWAY FIRE"}
FRAME_CW = 0.64   # boss-moment crop width as a fraction of the native frame (zoom ~1.85x)
# per-level tracker hints where big foreground FX fool the frame-diff tracker: (first_frame, last_frame, min_x, max_x) in native-width fractions
FRAME_HINT = {"level8": [(3080, 3330, 0.86, 1.0)]}  # Razorback: fight at the right wall, giant ninja/floor rings pull the tracker left
FRAME_EXT = 0.34  # max share of the crop allowed past the frame edge (filled with mirrored background plate)
_font_cache = {}


def font(path, size):
    k = (path, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(path, size)
    return _font_cache[k]


# ----------------------------------------------------------------------------- captures
class Cap:
    def __init__(self, name):
        self.name = name
        self.dir = os.path.join(RAW, name)
        self.meta = []
        for l in open(os.path.join(self.dir, "meta.jsonl")):
            try:
                self.meta.append(json.loads(l))
            except Exception:
                break
        self.pixel = False
        self._cache = {}

    def __len__(self):
        return len(self.meta)

    def img(self, i):
        i = max(0, min(len(self.meta) - 1, int(i)))
        if i in self._cache:
            return self._cache[i]
        im = Image.open(os.path.join(self.dir, "frames", self.meta[i]["file"])).convert("RGB")
        w, h = im.size
        # 384x224 aspect (1.714) -> crop to 16:9 and scale to 1280x720
        ch = int(round(w * 9 / 16))
        top = (h - ch) // 2
        im = im.crop((0, top, w, top + ch))
        im = im.resize((W, H), Image.NEAREST if self.pixel else Image.BILINEAR)
        if len(self._cache) > 96:
            self._cache.clear()
        self._cache[i] = im
        return im

    def native(self, i):
        """Uncropped frame scaled to fit width w (for split screens)."""
        im = Image.open(os.path.join(self.dir, "frames", self.meta[int(i)]["file"])).convert("RGB")
        return im

# ---- action framing (recenter boss fights that sit at the frame edge)
    def plate(self, lo, hi, k=40):
        """Median background plate over [lo, hi] (sprites that move around drop out)."""
        key = ("plate", lo, hi)
        if key in self._cache:
            return self._cache[key]
        rd = lambda i: np.asarray(Image.open(os.path.join(self.dir, "frames", self.meta[i]["file"])).convert("RGB"))
        idx = np.linspace(max(0, lo), min(len(self) - 1, hi), k).astype(int)
        p0 = np.median(np.stack([rd(i) for i in idx]), axis=0)
        # widen: add frames from before the boss arrived and after the KO when the camera shows the same
        # arena (background band matches), so a boss parked at the edge drops out of the median
        h = p0.shape[0]; band = slice(int(0.08 * h), int(0.35 * h))
        extra = list(np.linspace(max(0, lo - 400), max(0, lo - 1), k // 2).astype(int)) + list(np.linspace(min(len(self) - 1, hi + 1), min(len(self) - 1, hi + 300), k // 2).astype(int))
        keep = [rd(i) for i in idx]
        for i in extra:
            fr = rd(i)
            if np.abs(fr[band].astype(np.float32) - p0[band]).mean() < 10:
                keep.append(fr)
        p = np.median(np.stack(keep), axis=0).astype(np.uint8)
        self._plate_n = len(keep)
        self._cache[key] = p
        return p

    def track(self, start, n, margin=40):
        """Smoothed action centre (native px) for frames start..start+n-1, from frame differencing."""
        lo, hi = max(4, start - margin), min(len(self) - 1, start + n + margin)
        sw, sh = 288, 168
        def g(i):
            return np.asarray(Image.open(os.path.join(self.dir, "frames", self.meta[i]["file"])).convert("L").resize((sw, sh), Image.BILINEAR), dtype=np.float32)
        prev = {}
        dfs = []
        for i in range(lo, hi + 1):
            a = g(i); b = prev.pop(i - 4, None)
            if b is None:
                b = g(i - 4)
            prev[i] = a
            df = np.abs(a - b); df[: int(0.36 * sh)] = 0; df[int(0.92 * sh):] = 0; df[df < 25] = 0
            dfs.append(df)
        dfs = np.stack(dfs)
        # pixels that flicker most of the time (fire, rain, portals, water) are scenery, not fighters
        freq = (dfs > 0).mean(0)
        wgt = np.clip(1 - (freq - 0.5) / 0.3, 0, 1)
        xs, ys = [], []
        for df in dfs:
            frac = (df > 0).mean()
            df = df * wgt
            tot = df.sum()
            if tot < 50 or frac > 0.25:  # nothing moving, or a full-screen flash/shake
                xs.append(np.nan); ys.append(np.nan); continue
            # peak of the (blurred) column energy = where the fight is; centroid only within +-20% of it,
            # so diffuse scenery motion (rain, lightning, waves) elsewhere can't drag the camera
            col = np.convolve(df.sum(0), np.ones(31) / 31, "same")
            pk = int(np.argmax(col)); a0, a1 = max(0, pk - int(0.2 * sw)), min(sw, pk + int(0.2 * sw))
            sub = df[:, a0:a1]; c2 = sub.sum(0); r2 = sub.sum(1); t2 = c2.sum()
            xs.append(((c2 * np.arange(a0, a1)).sum() / t2) / sw); ys.append((r2 * np.arange(sh)).sum() / t2 / sh)
        xs, ys = np.array(xs), np.array(ys)
        t = np.arange(len(xs))
        for arr in (xs, ys):
            ok = ~np.isnan(arr)
            arr[:] = np.interp(t, t[ok], arr[ok]) if ok.any() else 0.5
        for f0, f1, x0, x1 in FRAME_HINT.get(self.name, []):
            for j in range(len(xs)):
                if f0 <= lo + j <= f1:
                    xs[j] = min(max(xs[j], x0), x1)
        # heavy gaussian smoothing (no jitter), then a velocity clamp
        xs = np.array([np.median(xs[max(0, j - 7): j + 8]) for j in range(len(xs))])
        sig = 20; kk = np.arange(-3 * sig, 3 * sig + 1); ker = np.exp(-kk ** 2 / (2 * sig ** 2)); ker /= ker.sum()
        xp = np.pad(xs, 3 * sig, mode="edge"); sx = np.convolve(xp, ker, "valid")
        for j in range(1, len(sx)):
            sx[j] = sx[j - 1] + np.clip(sx[j] - sx[j - 1], -0.006, 0.006)
        off = start - lo
        nw, nh = Image.open(os.path.join(self.dir, "frames", self.meta[0]["file"])).size
        cx = sx[off: off + n] * nw
        if len(cx) < n:
            cx = np.pad(cx, (0, n - len(cx)), mode="edge")
        cy = float(np.mean(ys)) * nh + 0.015 * nh
        return cx, cy

    def framer(self, start, n, lo=None, hi=None):
        """Returns f(i, t) -> 1280x720 frame whose crop window follows the action; areas past the
        frame edge are filled with a mirrored median background plate."""
        nw, nh = Image.open(os.path.join(self.dir, "frames", self.meta[0]["file"])).size
        cw = FRAME_CW * nw; ch = cw * 9 / 16
        ext = FRAME_EXT * cw
        cx, cy = self.track(start, n)
        cx = np.clip(cx, cw / 2 - ext, nw - cw / 2 + ext)
        cy = min(max(cy, ch / 2), nh - ch / 2)
        pad = int(ext) + 8
        pl = self.plate(lo if lo is not None else start - 200, hi if hi is not None else start + n + 200)
        canvas0 = np.pad(pl, ((0, 0), (pad, pad), (0, 0)), mode="symmetric")
        fe = 20  # feather where the live frame meets the plate
        ramp = np.ones(nw, dtype=np.float32)
        ramp[:fe] = np.linspace(0, 1, fe); ramp[-fe:] = np.linspace(1, 0, fe)
        ramp = ramp[None, :, None]
        def f(i, t):
            i = max(0, min(len(self) - 1, int(i)))
            live = np.asarray(Image.open(os.path.join(self.dir, "frames", self.meta[i]["file"])).convert("RGB"))
            can = canvas0.copy()
            can[:, pad: pad + nw] = live
            for a, b in ((0, fe), (nw - fe, nw)):  # feather only the edge strips
                r = ramp[:, a:b]
                can[:, pad + a: pad + b] = (live[:, a:b] * r + canvas0[:, pad + a: pad + b] * (1 - r)).astype(np.uint8)
            x = float(cx[min(len(cx) - 1, max(0, t))]) + pad
            box = (x - cw / 2, cy - ch / 2, x + cw / 2, cy + ch / 2)
            return Image.fromarray(can).resize((W, H), Image.BICUBIC, box=box)
        f.cx, f.cy, f.cw = cx, cy, cw
        return f

    # ---- moment finding
    def score(self, m):
        if m.get("scene") != "stage":
            return 0
        s = m.get("hurt", 0) * 2 + m.get("dying", 0) * 3 + (2 if m.get("atk") else 0) + (2 if (m.get("combo") or 0) >= 3 else 0)
        if m.get("boss"):
            s += 2
        return s

    def first(self, pred, start=0):
        for i in range(start, len(self.meta)):
            if pred(self.meta[i]):
                return i
        return None

    def best_windows(self, n, length, pred, gap=None):
        gap = gap or length * 2
        sc = np.array([self.score(m) if pred(m) else -99 for m in self.meta], dtype=float)
        if len(sc) < length:
            return []
        win = np.convolve(sc, np.ones(length), "valid")
        picks = []
        order = np.argsort(-win)
        for i in order:
            if win[i] <= 0 or len(picks) >= n:
                break
            if all(abs(i - p) > gap for p in picks):
                picks.append(int(i))
        return sorted(picks)


def find_moments(cap):
    M = cap.meta
    mom = {}
    lvl = None
    for m in M:
        if m.get("scene") == "stage":
            lvl = m.get("level"); break
    mom["level"] = lvl or 1
    mom["title"] = cap.first(lambda m: m.get("scene") == "title")
    mom["select"] = cap.first(lambda m: m.get("scene") == "select")
    mom["card"] = cap.first(lambda m: m.get("scene") == "card")
    stage0 = cap.first(lambda m: m.get("scene") == "stage") or 0
    mom["stage"] = stage0
    # boss runs: contiguous stretches with the same boss on screen; the LAST one is the end boss,
    # earlier ones are mid-bosses (e.g. Level 1's Zap-Rollers before Ramrod)
    runs, prev = [], None
    for i, m in enumerate(M):
        b = m["boss"]["name"] if (m.get("boss") and m.get("scene") == "stage") else None
        if b != prev:
            if b is not None:
                runs.append([b, i, i])
            prev = b
        if b is not None:
            runs[-1][2] = i
    runs = [r for r in runs if r[2] - r[1] > 30]
    mom["mid_bosses"] = [(r[0], r[1], r[2]) for r in runs[:-1]]
    boss_i = runs[-1][1] if runs else None
    mom["boss_intro"] = boss_i
    mom["boss_name"] = runs[-1][0] if runs else None
    # boss KO: boss hp hits 0 / dying / bossDown
    ko = None
    if boss_i is not None:
        ko = cap.first(lambda m: m.get("bossDown") or (m.get("boss") and (m["boss"].get("hp", 1) <= 0 or m["boss"].get("state") == "dying")), boss_i)
        if ko is None:  # boss sprite removed without a dying state
            ko = cap.first(lambda m: m.get("boss") is None and m.get("scene") == "stage", boss_i)
    mom["boss_ko"] = ko
    mom["cut"] = cap.first(lambda m: m.get("cut") or m.get("outro"), boss_i or 0)
    mom["pizza"] = cap.first(lambda m: m.get("pizza"))
    mom["results"] = cap.first(lambda m: m.get("results") or m.get("clear"))
    mom["tag"] = cap.first(lambda m: (m.get("tag") or 0) > 100)
    mom["hazard"] = cap.first(lambda m: (m.get("sink") or 0) > 0)
    end_combat = boss_i if boss_i is not None else len(M)
    mom["action"] = cap.best_windows(8, 45, lambda m: not m.get("boss") and not m.get("dead"), gap=110)
    mom["action"] = [a for a in mom["action"] if a < end_combat]
    if boss_i is not None and ko is not None:
        bw = cap.best_windows(2, 40, lambda m: m.get("boss") is not None and not m.get("bossDown"), gap=60)
        mom["boss_fight"] = [b for b in bw if boss_i <= b < ko] or [max(boss_i, ko - 120)]
    else:
        mom["boss_fight"] = []
    return mom


# ----------------------------------------------------------------------------- drawing helpers
def text_img(s, fpath, size, fill=(255, 255, 255), stroke=6, stroke_fill=(0, 0, 0), shadow=True):
    f = font(fpath, size)
    bb = f.getbbox(s, stroke_width=stroke)
    w, h = bb[2] - bb[0] + 16, bb[3] - bb[1] + 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow:
        d.text((8 - bb[0] + 6, 8 - bb[1] + 6), s, font=f, fill=(0, 0, 0, 160), stroke_width=stroke, stroke_fill=(0, 0, 0, 160))
    d.text((8 - bb[0], 8 - bb[1]), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im


def paste_center(base, im, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if alpha < 1.0:
        a = im.split()[3].point(lambda v: int(v * alpha))
        im = im.copy(); im.putalpha(a)
    base.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


def slam_scale(t, dur=6):
    """big -> 1.0 with tiny overshoot over `dur` frames"""
    if t >= dur + 3:
        return 1.0
    if t < dur:
        k = t / dur
        return 2.6 - 1.65 * (1 - (1 - k) ** 3)
    return 0.95 + 0.05 * ((t - dur) / 3)


def darken(im, k=0.45, blur=0):
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return ImageEnhance.Brightness(im).enhance(k)


def flash(im, a, color=(255, 255, 255)):
    if a <= 0:
        return im
    return Image.blend(im, Image.new("RGB", im.size, color), min(1, a))


def shake_xy(t, amp, seed):
    if amp <= 0:
        return 0, 0
    r = random.Random(seed * 1000 + t)
    return int(r.uniform(-amp, amp)), int(r.uniform(-amp, amp))


def punch(im, t, dur=6, amt=0.08):
    if t >= dur:
        return im
    s = 1 + amt * (1 - t / dur)
    w, h = int(W / s), int(H / s)
    x, y = (W - w) // 2, (H - h) // 2
    return im.crop((x, y, x + w, y + h)).resize((W, H), Image.BILINEAR)


def bars(im, h=44):
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, h), fill=(0, 0, 0)); d.rectangle((0, H - h, W, H), fill=(0, 0, 0))
    return im


_vig = None


def vignette(im):
    global _vig
    if _vig is None:
        y, x = np.ogrid[:H, :W]
        r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        m = np.clip(1.15 - 0.45 * r ** 2, 0.45, 1)
        _vig = m[..., None]
    a = np.asarray(im, dtype=np.float32) * _vig
    return Image.fromarray(a.astype(np.uint8))


# ----------------------------------------------------------------------------- timeline segments
# Each segment yields frames (PIL RGB 1280x720). Audio hits are recorded with their output time.
class Timeline:
    def __init__(self, name):
        self.name = name
        self.segs = []
        self.hits = []
        self.n = 0
        self.poster_at = None

    def add(self, nframes, fn, hit=None, poster=False):
        if hit:
            self.hits.append((self.n / FPS, hit))
        if poster:
            self.poster_at = self.n + nframes // 2
        self.segs.append((self.n, nframes, fn))
        self.n += nframes

    def render(self, out_mp4, music_seed=0, key=0, drop_beats=None, maxrate="2400k"):
        wav = os.path.join(TMP, self.name + ".wav")
        dur = self.n / FPS
        drop = drop_beats * BEAT / FPS if drop_beats else None
        synth(dur, wav, bpm=BPM, key=key, hits=self.hits, seed=music_seed, drop_at=drop)
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
               "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", maxrate, "-bufsize", str(int(maxrate[:-1]) * 2) + "k", "-pix_fmt", "yuv420p",
               "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", "-movflags", "+faststart", out_mp4]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        poster = None
        for (start, n, fn) in self.segs:
            for t in range(n):
                im = fn(t, n)
                if im.size != (W, H):
                    im = im.resize((W, H))
                if self.poster_at is not None and start + t == self.poster_at:
                    poster = im.copy()
                p.stdin.write(im.convert("RGB").tobytes())
        p.stdin.close(); p.wait()
        if p.returncode != 0:
            raise SystemExit("ffmpeg failed for " + out_mp4)
        if poster is None:
            poster = Image.open(os.path.join(TMP, "_last.jpg")) if os.path.exists(os.path.join(TMP, "_last.jpg")) else Image.new("RGB", (W, H))
        poster.save(out_mp4.replace(".mp4", ".jpg"), quality=82)
        return dur


# ---- segment factories
def seg_clip(cap, start, speed=1.0, fx=True, label=None, label2=None, shake=0, seed=0, slowmo_flash=False, tint=None, framer=None):
    def fn(t, n):
        src = start + t * speed
        i0 = int(src); fr = src - i0
        im = framer(i0, t) if framer else cap.img(i0)
        if speed < 1 and fr > 0.01:
            im = Image.blend(im, framer(i0 + 1, t) if framer else cap.img(i0 + 1), fr)
        if fx:
            im = punch(im, t)
        if shake:
            amp = shake * max(0, 1 - t / max(1, n * 0.6))
            dx, dy = shake_xy(t, amp, seed)
            if dx or dy:
                im = ImageOps.expand(im, border=24).crop((24 - dx, 24 - dy, 24 - dx + W, 24 - dy + H))
        if tint:
            im = Image.blend(im, Image.new("RGB", (W, H), tint), 0.12)
        im = vignette(im)
        if fx and t < 3:
            im = flash(im, 0.7 * (1 - t / 3))
        if label:
            lab = text_img(label, F_PIX, 22, fill=(255, 210, 90), stroke=4)
            im.paste(lab, (34, H - 44 - lab.height - 16), lab)
        if label2:
            lab = text_img(label2, F_BIG, 46, fill=(255, 255, 255), stroke=5)
            im.paste(lab, (W - lab.width - 30, 50), lab)
        return bars(im, 36)
    return fn


def seg_card(lines, bg=None, color=(255, 210, 60), sub_color=(255, 255, 255), seed=0, kind="slam"):
    """lines: [(text, font, size, color)] ; bg: (cap, idx) or None"""
    def fn(t, n):
        if bg:
            cap, idx = bg
            base = darken(cap.img(idx + t * 0.5), 0.35, blur=6)
        else:
            base = Image.new("RGB", (W, H), (8, 6, 12))
            d = ImageDraw.Draw(base)
            for k in range(0, H, 6):  # scanlines
                d.line((0, k, W, k), fill=(18, 10, 20))
        # diagonal hazard stripe band
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        off = (t * 14) % 80
        for x in range(-200, W + 200, 80):
            bd.polygon([(x + off, H // 2 - 120), (x + off + 40, H // 2 - 120), (x + off - 20, H // 2 + 120), (x + off - 60, H // 2 + 120)], fill=(255, 190, 0, 26))
        base.paste(band, (0, 0), band)
        sc = slam_scale(t)
        dx, dy = shake_xy(t, 14 * max(0, 1 - (t - 5) / 10) if t >= 5 else 0, seed)
        tot = sum(L[2] * 1.15 for L in lines)
        y = H / 2 - tot / 2
        for k, (s, fp, sz, col) in enumerate(lines):
            ti = text_img(s, fp, sz, fill=col, stroke=max(3, sz // 12))
            delay = k * 4
            tt = t - delay
            if tt < 0:
                y += sz * 1.15; continue
            paste_center(base, ti, W / 2 + dx, y + sz * 0.575 + dy, scale=slam_scale(tt), alpha=min(1, tt / 3 + 0.3))
            y += sz * 1.15
        im = vignette(base)
        if t < 4:
            im = flash(im, 0.9 * (1 - t / 4))
        if t > n - 3:
            im = flash(im, 0.5 * (t - (n - 3)) / 3)
        return bars(im, 36)
    return fn


def seg_flash(color=(255, 255, 255)):
    def fn(t, n):
        return Image.new("RGB", (W, H), color)
    return fn


# ----------------------------------------------------------------------------- builders
def level_name(cap, n):
    js = os.path.join(HERE, "_serve/live/levels/level%d.js" % n)
    if n in LEVEL_NAMES_FALLBACK:
        return LEVEL_NAMES_FALLBACK[n]
    if os.path.exists(js):
        import re
        src = open(js).read()
        m = re.search(r'card:\s*\{\s*title:\s*"([^"]+)"', src) or re.search(r'name:\s*"([^"]+)"', src)
        if m:
            return m.group(1)
    return "LEVEL %d" % n


def clamp_idx(cap, i, n):
    return max(0, min(len(cap) - n - 1, i))


def stills(cap, mom, n, outdir):
    os.makedirs(outdir, exist_ok=True)
    for f in glob.glob(os.path.join(outdir, "*.jpg")):
        os.remove(f)
    picks = []
    if n == 1 and mom["title"] is not None:
        picks.append(("title", mom["title"] + 60))
    if mom["card"] is not None:
        picks.append(("level_card", mom["card"] + 30))
    for k, a in enumerate(mom["action"][:3]):
        sc = [cap.score(cap.meta[i]) for i in range(a, min(len(cap), a + 45))]
        picks.append(("combat%d" % (k + 1), a + int(np.argmax(sc))))
    if mom["hazard"] is not None:
        picks.append(("hazard", mom["hazard"] + 4))
    if mom["tag"] is not None:
        picks.append(("tag_in", mom["tag"] + 12))
    for bn, s0, s1 in mom.get("mid_bosses", [])[:1]:
        w = cap.best_windows(1, 20, lambda m, bn=bn: bool(m.get("boss")) and m["boss"]["name"] == bn) or [s0 + 30]
        picks.append(("midboss_" + bn.lower().replace("-", ""), w[0] + 10))
    if mom["boss_intro"] is not None:
        picks.append(("boss_intro", mom["boss_intro"] + 40))
    for b in mom["boss_fight"][:1]:
        picks.append(("boss_fight", b + 20))
    if mom["boss_ko"] is not None:
        picks.append(("boss_ko", mom["boss_ko"] + 6))
    if mom["cut"] is not None:
        picks.append(("cutscene", mom["cut"] + 45))
    if mom["results"] is not None:
        picks.append(("results", mom["results"] + 60))
    while len(picks) > 10:  # drop extra combat shots first, then the in-game card
        drop = next((p for p in reversed(picks) if p[0].startswith("combat")), None) or next((p for p in picks if p[0] == "level_card"), picks[-1])
        if sum(1 for p in picks if p[0].startswith("combat")) <= 2 and drop[0].startswith("combat"):
            drop = next((p for p in picks if p[0] == "level_card"), picks[-1])
        picks.remove(drop)
    files = []
    for k, (lab, i) in enumerate(picks):
        i = max(0, min(len(cap) - 1, i))
        fn = os.path.join(outdir, "%02d_%s.jpg" % (k + 1, lab))
        if lab.startswith("boss"):  # boss stills: same action-centred framing as the movies
            cap.framer(max(0, i - 30), 61, mom["boss_intro"], mom["boss_ko"])(i, 30).save(fn, quality=84)
        else:
            cap.img(i).save(fn, quality=84)
        files.append(fn)
    # contact sheet
    th = [Image.open(f).resize((320, 180)) for f in files]
    cols = 4; rows = math.ceil(len(th) / cols)
    sheet = Image.new("RGB", (cols * 320, rows * 180), (0, 0, 0))
    for k, t in enumerate(th):
        sheet.paste(t, ((k % cols) * 320, (k // cols) * 180))
    sheet.save(os.path.join(TMP, "contact_stills_%s.jpg" % cap.name), quality=80)
    return files


MOMENT_BEATS = 12  # 12 beats @150 BPM = 4.8 s: one best moment per level


def best_moment(cap, mom):
    """Start index + kind of the level's single best ~4.8 s moment: the end-boss fight into its KO,
    else the best boss window, else a hazard, else the best combat window."""
    L = MOMENT_BEATS * BEAT
    bi, ko = mom["boss_intro"], mom["boss_ko"]
    if bi is not None and ko is not None and ko - bi > 40:
        # densest boss window that ends just after the KO lands (fight -> KO in one shot)
        lo, hi = max(bi, ko - L + 12), max(bi, ko - L // 2)
        best, bs = hi, -1
        for s0 in range(lo, hi + 1, 3):
            sc = sum(cap.score(cap.meta[i]) for i in range(s0, min(len(cap), s0 + L)))
            if sc > bs:
                best, bs = s0, sc
        return clamp_idx(cap, best, L), "boss"
    if bi is not None:
        w = cap.best_windows(1, L, lambda m: m.get("boss") is not None) or [bi + 20]
        return clamp_idx(cap, w[0], L), "boss"
    if mom["hazard"] is not None:
        return clamp_idx(cap, mom["hazard"] - L // 2, L), "hazard"
    a = (mom["action"] or [mom["stage"] + 60])[0]
    return clamp_idx(cap, a, L), "action"


def seg_moment(cap, start, n, name, boss, seed, mom=None):
    """The best-moment clip with a level lower-third that slams in, plus the boss name top-right.
    The crop window pans to keep the fight near frame centre (see Cap.framer)."""
    fr = cap.framer(start, MOMENT_BEATS * BEAT, (mom or {}).get("boss_intro"), (mom or {}).get("boss_ko"))
    base = seg_clip(cap, start, label2=boss, seed=seed, framer=fr)
    lab1 = text_img("LEVEL %d" % n, F_PIX, 22, fill=(255, 210, 90), stroke=4)
    lab2 = text_img(name, F_BIG, 64, fill=(255, 255, 255), stroke=5)
    def fn(t, N):
        im = base(t, N)
        k = slam_scale(t)
        a = 1.0 if t < N - 6 else max(0, (N - t) / 6)
        if a > 0:
            y = H - 36 - 22 - lab2.height
            paste_center(im, lab2, 40 + lab2.width / 2, y + lab2.height / 2, scale=k, alpha=a)
            paste_center(im, lab1, 40 + lab1.width / 2, y - 18, scale=k, alpha=a)
        return im
    return fn


def build_level(cap, mom, n):
    """Per-level mini movie, ~7 s: name slam -> best moment -> play-now card."""
    name = level_name(cap, n)
    tl = Timeline("level%d" % n)
    B = BEAT
    seed = n * 7
    tl.add(3 * B, seg_card([("LEVEL %d" % n, F_PIX, 44, (255, 210, 60)), (name, F_BIG, 120, (255, 255, 255))], bg=(cap, mom["stage"] + 30), seed=seed), hit="slam")
    st, kind = best_moment(cap, mom)
    tl.add(MOMENT_BEATS * B, seg_moment(cap, st, n, name, mom["boss_name"] if kind == "boss" else None, seed + 1, mom), hit="flash", poster=True)
    tl.add(3 * B, seg_card([("SHELL SHOCK LIVE", F_BIG, 100, (255, 210, 60)), ("PLAY NOW  " + PLAY_URL, F_PIX, 22, (255, 255, 255))], bg=(cap, st + MOMENT_BEATS * B), seed=seed + 15), hit="slam")
    out = os.path.join(OUT, "level%d.mp4" % n)
    dur = tl.render(out, music_seed=seed, key=[0, 2, -2, 3, 5, -3, 1, 4][(n - 1) % 8], drop_beats=None)
    return out, dur, name


def build_full(caps, moms):
    """Whole-game trailer: brief title card, then ~4.8 s per level (its single best moment), then an end card.
    15 levels -> ~72 s of levels + ~4 s of cards. The soundtrack is synthesized to the timeline length."""
    tl = Timeline("full_trailer")
    B = BEAT
    L1 = caps[0]; m1 = moms[0]
    tl.add(4 * B, seg_card([("FOUR BROTHERS. %d LEVELS." % len(caps), F_PIX, 26, (255, 210, 60)), ("SHELL SHOCK LIVE", F_BIG, 130, (255, 255, 255))],
                           bg=(L1, (m1["action"] or [m1["stage"]])[0]), seed=2), hit="slam", poster=True)
    for cap, mom in zip(caps, moms):
        n = mom["level"]; name = level_name(cap, n)
        st, kind = best_moment(cap, mom)
        print("  trailer L%d best moment: %s @%d" % (n, kind, st))
        tl.add(MOMENT_BEATS * B, seg_moment(cap, st, n, name, mom["boss_name"] if kind == "boss" else None, 100 + n, mom), hit="slam" if n == 1 else "flash")
    tl.add(1 * B, seg_flash())
    tl.add(5 * B, seg_card([("SHELL SHOCK LIVE", F_BIG, 130, (255, 210, 60)), ("PLAY NOW", F_BIG, 80, (255, 255, 255)), (PLAY_URL, F_PIX, 26, (255, 255, 255))],
                           bg=(L1, (m1["action"] or [m1["stage"]])[-1]), seed=400), hit="ko")
    out = os.path.join(OUT, "full_trailer.mp4")
    dur = tl.render(out, music_seed=5, key=0, maxrate="1350k")
    return out, dur


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", path], capture_output=True, text=True)
    j = json.loads(r.stdout)["format"]
    return float(j["duration"]), int(j["size"])


def contact(path, cols=6, rows=4):
    d, _ = probe(path)
    sheet = os.path.join(TMP, "contact_" + os.path.basename(path).replace(".mp4", ".jpg"))
    fps = cols * rows / d
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vf", f"fps={fps:.4f},scale=320:-2,tile={cols}x{rows}", "-frames:v", "1", "-update", "1", sheet], check=True)
    return sheet


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    lv_dirs = sorted([d for d in os.listdir(RAW) if d.startswith("level") and os.path.exists(os.path.join(RAW, d, "meta.jsonl"))], key=lambda s: int(s[5:]))
    only = [int(x) for x in sys.argv[2:]]
    caps = [Cap(d) for d in lv_dirs]
    moms = [find_moments(c) for c in caps]
    for c, m in zip(caps, moms):
        m["level"] = int(c.name[5:])
        print(c.name, {k: v for k, v in m.items() if k not in ("action",)}, "actions", m["action"])
    man_p = os.path.join(OUT, "manifest.json")
    man = json.load(open(man_p)) if (os.path.exists(man_p) and only) else {"levels": {}}
    sel = [(c, m) for c, m in zip(caps, moms) if not only or m["level"] in only]
    if what in ("all", "stills"):
        for c, m in sel:
            files = stills(c, m, m["level"], os.path.join(SCR, c.name))
            man["levels"].setdefault(str(m["level"]), {})["stills"] = [os.path.relpath(f, HERE) for f in files]
    if what in ("all", "levels"):
        for c, m in sel:
            out, dur, name = build_level(c, m, m["level"])
            d, s = probe(out)
            man["levels"].setdefault(str(m["level"]), {}).update({"name": name, "boss": m["boss_name"], "video": os.path.relpath(out, HERE), "duration": round(d, 2), "size": s})
            print("built", out, round(d, 2), "s", s // 1024, "KB")
    if what in ("all", "full"):
        out, dur = build_full(caps, moms)
        d, s = probe(out); man["full"] = {"video": os.path.relpath(out, HERE), "duration": round(d, 2), "size": s}
        print("built", out, round(d, 2), s // 1024, "KB")
    if what in ("all", "manifest"):  # rebuild the manifest from whatever is in out/ (safe after parallel runs)
        man = {"levels": {}}
        for c, m in zip(caps, moms):
            n = m["level"]; L = man["levels"].setdefault(str(n), {})
            L["name"] = level_name(c, n); L["boss"] = m["boss_name"]
            L["stills"] = sorted(os.path.relpath(f, HERE) for f in glob.glob(os.path.join(SCR, c.name, "*.jpg")))
            mp = os.path.join(OUT, "level%d.mp4" % n)
            if os.path.exists(mp):
                d, s = probe(mp); L.update({"video": os.path.relpath(mp, HERE), "duration": round(d, 2), "size": s})
        fp = os.path.join(OUT, "full_trailer.mp4")
        if os.path.exists(fp):
            d, s = probe(fp); man["full"] = {"video": os.path.relpath(fp, HERE), "duration": round(d, 2), "size": s}
    json.dump(man, open(man_p, "w"), indent=1)


if __name__ == "__main__":
    main()

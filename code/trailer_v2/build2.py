"""Shell Shock Live trailer v2 editor: portrait arcade-cabinet cut.

Every gameplay frame is composited into the game's own mobile cabinet (reference shots from ref.js:
marquee, pipe/turtle bezel with the CRT overlay recovered from black/white canvas shots, control panel).
The joystick tilt and ATTACK/JUMP/SPECIAL pressed+lit states come from the bot's logged inputs for that
exact frame (meta.inp). The lit glow is a trailer-only overlay on top of the game's own pressed-cap state.

python3 build2.py RAW_DIR REF_DIR OUT_DIR [all|levels|full|stills|contact] [levels...]
"""
import json, os, sys, glob, math, random, subprocess, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from synth import synth

RAW, REF, OUTD = sys.argv[1], sys.argv[2], sys.argv[3]
WHAT = sys.argv[4] if len(sys.argv) > 4 else "all"
ONLY = [int(x) for x in sys.argv[5:]]
LEVEL_SRC = os.environ.get("LEVEL_SRC", "")
OUT, SCR, TMP = (os.path.join(OUTD, d) for d in ("out", "screens", "_tmp"))
for d in (OUT, SCR, TMP):
    os.makedirs(d, exist_ok=True)
W, H, FPS, BPM = 720, 1280, 30, 150
BEAT = int(round(FPS * 60 / BPM))  # 12
F_BIG = os.path.join(HERE, "fonts/Anton.ttf")
F_PIX = os.path.join(HERE, "fonts/PressStart2P.ttf")
PLAY_URL = "shellshock-live.surge.sh"
_fc = {}
# screen-only mode (WHAT == "screen"): frames are just the cabinet SCREEN area (no cabinet art), for the page's HTML cabinet.
SCREEN = False
SG = None  # (x, y, w, h) of the game canvas inside the screen-only frame
CUR_INP = None  # bot input of the frame being rendered (exported as the page's input timeline)


def font(p, s):
    if (p, s) not in _fc:
        _fc[(p, s)] = ImageFont.truetype(p, s)
    return _fc[(p, s)]


# ----------------------------------------------------------------------------- cabinet compositor
class Cabinet:
    def __init__(self, ref):
        ld = lambda n: np.asarray(Image.open(os.path.join(ref, n + ".png")).convert("RGB"), dtype=np.float32)
        self.g = json.load(open(os.path.join(ref, "geom.json")))
        self.black, white = ld("black"), ld("white")
        x, y, w, h = self.g["canvas"]
        self.cx, self.cy, self.cw, self.ch = int(round(x)), int(round(y)), int(round(w)), int(round(h))
        sl = (slice(self.cy, self.cy + self.ch), slice(self.cx, self.cx + self.cw))
        self.sl = sl
        self.alpha = np.clip((white[sl] - self.black[sl]) / 255.0, 0, 1)
        self.over = self.black[sl]
        self.stick = {}
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                self.stick[(dx, dy)] = ld(f"stick_{dx}_{dy}").astype(np.uint8)
        base = self.stick[(0, 0)]
        self.btn = {}
        cols = {"a": (255, 70, 50), "b": (255, 215, 50), "p": (70, 150, 255)}
        yy, xx = np.mgrid[0:H, 0:W]
        for k, cap in (("a", "capA"), ("b", "capB"), ("p", "capP")):
            im = ld("btn_" + k).astype(np.uint8)
            d = np.abs(im.astype(int) - base.astype(int)).sum(2) > 6
            ys, xs = np.where(d)
            x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
            # trailer-only "lit" glow: additive halo in the button colour around the cap
            cx_, cy_, cw_, ch_ = self.g[cap]
            mx, my = cx_ + cw_ / 2, cy_ + ch_ / 2
            r = np.sqrt(((xx - mx) / (cw_ * 0.95)) ** 2 + ((yy - my) / (ch_ * 1.25)) ** 2)
            halo = np.clip(1.25 - r, 0, 1) ** 1.6
            core = np.clip(1.0 - np.sqrt(((xx - mx) / (cw_ * 0.5)) ** 2 + ((yy - my) / (ch_ * 0.5)) ** 2), 0, 1) ** 0.7
            gl = halo[..., None] * np.array(cols[k], np.float32)[None, None] * 0.85 + core[..., None] * 90
            gy0, gy1, gx0, gx1 = int(max(0, my - ch_ * 1.6)), int(min(H, my + ch_ * 1.6)), int(max(0, mx - cw_ * 1.4)), int(min(W, mx + cw_ * 1.4))
            self.btn[k] = dict(img=im, box=(x0, y0, x1, y1), glow=gl[gy0:gy1, gx0:gx1], gbox=(gx0, gy0, gx1, gy1))

    def compose(self, game, inp):
        """game: PIL image (any size, resized to the canvas rect). inp: meta.inp dict. Returns uint8 HxWx3."""
        inp = inp or {}
        fr = self.stick[(int(inp.get("dx", 0)), int(inp.get("dy", 0)))].copy()
        for k in ("a", "b", "p"):
            if inp.get(k):
                b = self.btn[k]; x0, y0, x1, y1 = b["box"]
                fr[y0:y1, x0:x1] = b["img"][y0:y1, x0:x1]
        if game.size != (self.cw, self.ch):
            game = game.resize((self.cw, self.ch), Image.BILINEAR)
        g = np.asarray(game.convert("RGB"), dtype=np.float32)
        fr[self.sl] = np.clip(self.over + g * self.alpha, 0, 255).astype(np.uint8)
        lit = [k for k in ("a", "b", "p") if inp.get(k)]
        if lit:
            f = fr.astype(np.float32)
            for k in lit:
                b = self.btn[k]; gx0, gy0, gx1, gy1 = b["gbox"]
                f[gy0:gy1, gx0:gx1] += b["glow"]
            fr = np.clip(f, 0, 255).astype(np.uint8)
        return fr


CAB = None


# ----------------------------------------------------------------------------- captures
class Cap:
    def __init__(self, d):
        self.dir = d
        self.name = os.path.basename(d)
        self.meta = []
        for l in open(os.path.join(d, "meta.jsonl")):
            try:
                m = json.loads(l)
            except Exception:
                break
            if m.get("boss"):
                m["boss"]["name"] = str(m["boss"]["name"]).upper()
            self.meta.append(m)  # adaptive capture: only some frames have a saved jpg ("file")
        self.saved = np.array([i for i, m in enumerate(self.meta) if "file" in m])
        self._c = {}

    def __len__(self):
        return len(self.meta)

    def near(self, i):
        i = max(0, min(len(self) - 1, int(i)))
        if "file" in self.meta[i]:
            return i
        k = int(np.searchsorted(self.saved, i))
        c = [self.saved[j] for j in (k - 1, k) if 0 <= j < len(self.saved)]
        return int(min(c, key=lambda j: abs(j - i)))

    def game(self, i):
        i = self.near(i)
        return Image.open(os.path.join(self.dir, "frames", self.meta[i]["file"])).convert("RGB")

    def frame(self, i, inp_override=None):
        i = self.near(i)
        if i in self._c and inp_override is None:
            return self._c[i]
        m = self.meta[i]
        if SCREEN:
            im = Image.new("RGB", (W, H), (0, 0, 0))
            im.paste(self.game(i).resize((SG[2], SG[3]), Image.BICUBIC), (SG[0], SG[1]))
            if len(self._c) > 64:
                self._c.clear()
            self._c[i] = im
            return im
        im = Image.fromarray(CAB.compose(self.game(i), inp_override if inp_override is not None else m.get("inp")))
        if inp_override is None:
            if len(self._c) > 64:
                self._c.clear()
            self._c[i] = im
        return im

    def score(self, m):
        if m.get("scene") != "stage":
            return 0
        s = m.get("hurt", 0) * 2 + m.get("dying", 0) * 3 + (2 if m.get("atk") else 0) + (2 if (m.get("combo") or 0) >= 3 else 0)
        b = m.get("boss")
        if b:
            s += 2 + (3 if b["state"] in ("hurt", "stagger", "down") else 0) + (2 if b["state"] in ("charge", "slam", "fire", "throw", "kick", "tele") else 0)
        if (m.get("pz") or 0) > 6:
            s += 1
        if m.get("dead"):
            s -= 4
        return s

    def first(self, pred, start=0):
        for i in range(max(0, start), len(self.meta)):
            if pred(self.meta[i]):
                return i
        return None


def centred(m, lo=100, hi=284):
    b = m.get("boss")
    return bool(b) and lo <= b["sx"] <= hi


def find_moments(cap):
    M = cap.meta
    mom = {"level": next((m.get("level") for m in M if m.get("scene") == "stage"), None)}
    mom["card"] = cap.first(lambda m: m.get("scene") == "card")
    mom["stage"] = cap.first(lambda m: m.get("scene") == "stage") or 0
    runs, prev = [], None
    for i, m in enumerate(M):
        b = m["boss"]["name"] if (m.get("boss") and m.get("scene") == "stage") else None
        if b != prev:
            if b is not None:
                runs.append([b, i, i])
            prev = b
        if b is not None:
            runs[-1][2] = i
    # merge runs of the same boss split by brief gaps
    merged = []
    for r in runs:
        if merged and merged[-1][0] == r[0] and r[1] - merged[-1][2] < 90:
            merged[-1][2] = r[2]
        else:
            merged.append(r)
    runs = [r for r in merged if r[2] - r[1] > 60]
    mom["boss_runs"] = runs
    bosses = []
    for name, s0, s1 in runs:
        ko = cap.first(lambda m: m.get("bossDown") or (m.get("boss") and m["boss"]["name"] == name and (m["boss"].get("hp", 1) <= 0 or m["boss"].get("state") == "dying")), s0)
        if ko is None or ko > s1 + 30:
            ko = s1
        fight0 = cap.first(lambda m: m.get("boss") and m["boss"]["state"] not in ("intro", "enter", "pose", "breach", "appear", "hop") and not m.get("intro"), s0) or s0
        p2 = cap.first(lambda m: m.get("boss") and m["boss"]["name"] == name and m["boss"].get("p2"), s0)
        bosses.append(dict(name=name, start=s0, fight=fight0, ko=ko, end=s1, p2=p2 if (p2 is not None and p2 < ko) else None))
    mom["bosses"] = bosses
    end_combat = runs[-1][1] if runs else len(M)
    mom["action"] = best_windows(cap, 3, 4 * BEAT, lambda i, m: not m.get("boss") and not m.get("dead") and i < end_combat, gap=200)
    mom["results"] = cap.first(lambda m: m.get("results"))
    return mom


def best_windows(cap, n, length, pred, gap=None, need=0.0, cpred=None):
    gap = gap or length * 2
    M = cap.meta
    sc = np.array([cap.score(m) if ("file" in m and pred(i, m)) else -99 for i, m in enumerate(M)], dtype=float)
    if len(sc) < length:
        return []
    win = np.convolve(sc, np.ones(length), "valid")
    if cpred is not None:  # require a share of frames in the window to satisfy cpred (e.g. boss centred)
        c = np.array([1.0 if ("file" in m and cpred(m)) else 0.0 for m in M])
        cw = np.convolve(c, np.ones(length), "valid") / length
        win = np.where(cw >= need, win, -1e9)
    picks = []
    for i in np.argsort(-win):
        if win[i] <= 0 or len(picks) >= n:
            break
        if all(abs(i - p) > gap for p in picks):
            picks.append(int(i))
    return sorted(picks)


def boss_window(cap, b, length, lo=None, hi=None, need=1.0, n=1, gap=None):
    """Best-scoring window inside the boss fight where the boss is centred and on screen in every frame."""
    lo = b["fight"] if lo is None else lo
    hi = b["ko"] - 6 if hi is None else hi
    for nd, (cl, ch) in ((need, (100, 284)), (0.9, (96, 288)), (0.8, (90, 294)), (0.6, (80, 304))):
        w = best_windows(cap, n, length, lambda i, m: lo <= i <= hi and m.get("boss") is not None, gap=gap, need=nd, cpred=lambda m: centred(m, cl, ch))
        if w:
            return w
    return [max(lo, hi - length)]


def ko_window(cap, b, length):
    """Window ending ~1 s after the KO; the KO shot itself."""
    st = max(b["fight"], b["ko"] - int(length * 0.45))
    return min(st, len(cap) - length - 1)


# ----------------------------------------------------------------------------- drawing
def text_img(s, fp, size, fill=(255, 255, 255), stroke=6, sfill=(0, 0, 0)):
    f = font(fp, size)
    bb = f.getbbox(s, stroke_width=stroke)
    w, h = bb[2] - bb[0] + 16, bb[3] - bb[1] + 16
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((8 - bb[0] + 5, 8 - bb[1] + 5), s, font=f, fill=(0, 0, 0, 170), stroke_width=stroke, stroke_fill=(0, 0, 0, 170))
    d.text((8 - bb[0], 8 - bb[1]), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill)
    return im


def fit_text(s, fp, size, maxw, **kw):
    while size > 14:
        im = text_img(s, fp, size, **kw)
        if im.width <= maxw:
            return im
        size -= 4
    return text_img(s, fp, size, **kw)


def paste_c(base, im, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if alpha < 1.0:
        im = im.copy(); im.putalpha(im.split()[3].point(lambda v: int(v * alpha)))
    base.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


def slam(t, dur=6):
    if t >= dur + 3:
        return 1.0
    if t < dur:
        return 2.4 - 1.45 * (1 - (1 - t / dur) ** 3)
    return 0.95 + 0.05 * ((t - dur) / 3)


def flash(im, a, col=(255, 255, 255)):
    return im if a <= 0 else Image.blend(im, Image.new("RGB", im.size, col), min(1, a))


def shake_xy(t, amp, seed):
    if amp <= 0:
        return 0, 0
    r = random.Random(seed * 1000 + t)
    return int(r.uniform(-amp, amp)), int(r.uniform(-amp, amp))


def punch(im, t, dur=6, amt=0.06, cx=None, cy=None):
    if t >= dur:
        return im
    s = 1 + amt * (1 - t / dur)
    cx = W / 2 if cx is None else cx; cy = H / 2 if cy is None else cy
    w, h = W / s, H / s
    return im.resize((W, H), Image.BILINEAR, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))


# label band: the dark strip between the marquee and the bezel top
BAND_Y = 0.27  # fraction of H (centre of the label band)


# ----------------------------------------------------------------------------- timeline
class Timeline:
    def __init__(self, name):
        self.name, self.segs, self.hits, self.n, self.poster_at = name, [], [], 0, None
        self.inputs = []

    def add(self, n, fn, hit=None, poster=False):
        if hit:
            self.hits.append((self.n / FPS, hit))
        if poster:
            self.poster_at = self.n + n // 2
        self.segs.append((self.n, n, fn)); self.n += n

    def render(self, mp4, seed=0, key=0, crf="22", maxrate="2600k"):
        wav = os.path.join(TMP, self.name + ".wav")
        synth(self.n / FPS, wav, bpm=BPM, key=key, hits=self.hits, seed=seed)
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
               "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-maxrate", maxrate, "-bufsize", str(int(maxrate[:-1]) * 2) + "k",
               "-pix_fmt", "yuv420p", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest", "-movflags", "+faststart", mp4]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        poster = None
        for st, n, fn in self.segs:
            for t in range(n):
                global CUR_INP
                CUR_INP = None
                im = fn(t, n)
                ip = CUR_INP or {}
                self.inputs.append([int(ip.get("dx", 0)), int(ip.get("dy", 0)), 1 if ip.get("a") else 0, 1 if ip.get("b") else 0, 1 if ip.get("p") else 0])
                if self.poster_at is not None and st + t == self.poster_at:
                    poster = im.copy()
                p.stdin.write(im.convert("RGB").tobytes())
        p.stdin.close(); p.wait()
        if p.returncode:
            raise SystemExit("ffmpeg failed " + mp4)
        # input timeline, one char per video frame: v = (dx+1)*3+(dy+1) + 9*(a + 2b + 4p), chr(48+v)
        enc = "".join(chr(48 + (dx + 1) * 3 + (dy + 1) + 9 * (a + 2 * b + 4 * pp)) for dx, dy, a, b, pp in self.inputs)
        json.dump({"fps": FPS, "frames": len(self.inputs), "enc": "chr(48+v), v=(dx+1)*3+(dy+1)+9*(a+2b+4p)", "data": enc}, open(mp4.replace(".mp4", "_inputs.json"), "w"))
        (poster or im).convert("RGB").save(mp4.replace(".mp4", ".jpg"), quality=84)
        return self.n / FPS


# ---- segments
def seg_play(cap, start, speed=1.0, label=None, sub=None, boss=None, seed=0, tint=None, zoom=None, flash_in=True):
    """Gameplay in the cabinet. zoom=(k) slow push toward the screen over the clip (1.0 = none)."""
    labs = None
    if label:
        zf = 1.5 if SCREEN else 1.0
        labs = (text_img(sub or "", F_PIX, int(18 * zf), fill=(255, 210, 90), stroke=4) if sub else None, fit_text(label, F_BIG, int(58 * zf), W - 60, stroke=5))
    blab = fit_text(boss, F_BIG, int(40 * (1.5 if SCREEN else 1.0)), W - 80, fill=(255, 80, 60), stroke=4) if boss else None
    scx = CAB.cx + CAB.cw / 2; scy = CAB.cy + CAB.ch / 2
    if SCREEN:
        scx, scy = W / 2, H / 2
        zoom = 1 + (zoom - 1) * 0.6 if zoom else None

    def fn(t, n):
        global CUR_INP
        src = start + t * speed
        i0 = int(src); fr = src - i0
        CUR_INP = cap.meta[cap.near(i0)].get("inp")
        im = cap.frame(i0)
        if speed < 1 and fr > 0.05:
            im = Image.blend(im, cap.frame(i0 + 1), fr)
        if zoom:  # slow push toward the cabinet screen (cabinet stays in frame)
            k = 1 + (zoom - 1) * (t / max(1, n - 1))
            w, h = W / k, H / k
            u = (k - 1) / max(1e-6, zoom - 1)
            cx = W / 2 + (scx - W / 2) * u; cy = H / 2 + (scy - H / 2) * u * 0.6
            cx = min(max(cx, w / 2), W - w / 2); cy = min(max(cy, h / 2), H - h / 2)
            im = im.resize((W, H), Image.BILINEAR, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
        im = punch(im, t)
        if tint:
            im = Image.blend(im, Image.new("RGB", (W, H), tint), 0.13)
        if flash_in and t < 3:
            im = flash(im, 0.65 * (1 - t / 3))
        a = 1.0 if t < n - 5 else max(0, (n - t) / 5)
        if labs and a > 0:
            s1, s2 = labs
            k = slam(t)
            y = H * (0.34 if SCREEN else BAND_Y)
            paste_c(im, s2, W / 2, y + 14, scale=k, alpha=a)
            if s1:
                paste_c(im, s1, W / 2, y - s2.height / 2 - 4, scale=k, alpha=a)
        if blab and a > 0:
            k = slam(max(0, t - 4)) if t >= 4 else 0
            if k:
                paste_c(im, blab, W / 2, (H * 0.84 if labs else H * 0.34) if SCREEN else (H * BAND_Y if not labs else CAB.cy - 30), scale=k, alpha=a)
        return im
    return fn


def seg_card(lines, bg, seed=0):
    """Full-frame slam card over the darkened, blurred cabinet. lines: [(text, font, size, colour)]"""
    cap, idx = bg
    def fn(t, n):
        base = cap.frame(idx + t // 2).filter(ImageFilter.GaussianBlur(7))
        base = ImageEnhance.Brightness(base).enhance(0.32)
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(band)
        off = (t * 12) % 80
        for x in range(-300, W + 300, 80):
            bd.polygon([(x + off, H / 2 - 170), (x + off + 40, H / 2 - 170), (x + off - 40, H / 2 + 170), (x + off - 80, H / 2 + 170)], fill=(255, 190, 0, 24))
        base.paste(band, (0, 0), band)
        dx, dy = shake_xy(t, 12 * max(0, 1 - (t - 5) / 10) if t >= 5 else 0, seed)
        imgs = [fit_text(s, fp, sz, W - 50, fill=c, stroke=max(3, sz // 12)) for s, fp, sz, c in lines]
        tot = sum(i.height for i in imgs) + 8 * (len(imgs) - 1)
        y = H / 2 - tot / 2
        for k, ti in enumerate(imgs):
            tt = t - k * 4
            if tt >= 0:
                paste_c(base, ti, W / 2 + dx, y + ti.height / 2 + dy, scale=slam(tt), alpha=min(1, tt / 3 + 0.3))
            y += ti.height + 8
        if t < 4:
            base = flash(base, 0.9 * (1 - t / 4))
        if t > n - 3:
            base = flash(base, 0.5 * (t - (n - 3)) / 3)
        return base
    return fn


def seg_flash():
    return lambda t, n: Image.new("RGB", (W, H), (255, 255, 255))


# ----------------------------------------------------------------------------- level info
def level_name(n):
    if n == 1:
        return "HALLWAY FIRE"
    js = os.path.join(LEVEL_SRC, "level%d.js" % n)
    if os.path.exists(js):
        src = open(js, encoding="utf-8", errors="ignore").read()
        m = re.search(r'card:\s*\{\s*title:\s*"([^"]+)"', src) or re.search(r'name:\s*"([^"]+)"', src)
        if m:
            return m.group(1)
    return "LEVEL %d" % n


def level_shots(cap, mom, beats_fight=6, beats_ko=4, full=False):
    """The level's boss highlights: [(kind, start, nframes, speed, boss_name, label)]"""
    out = []
    bs = mom["bosses"]
    if not bs:
        a = (mom["action"] or [mom["stage"] + 60])[0]
        return [("action", a, (beats_fight + beats_ko) * BEAT, 1.0, None, None)]
    # the end boss (and for multi-boss levels, earlier bosses get a short fight shot when not full)
    final = bs[-1]
    shots = []
    if len(bs) > 1 and not full:
        b0 = bs[-2]
        w = boss_window(cap, b0, 3 * BEAT)[0]
        shots.append(("boss", w, 3 * BEAT, 1.0, b0["name"], None))
    b = final
    if b["p2"] is not None and b["ko"] - b["p2"] > 120:  # phase 2: fight before + after the rage, labelled
        w1 = boss_window(cap, b, beats_fight * BEAT // 2 if full else 3 * BEAT, hi=b["p2"])[0]
        shots.append(("boss", w1, (beats_fight * BEAT // 2) if full else 3 * BEAT, 1.0, b["name"], None))
        w2 = boss_window(cap, b, beats_fight * BEAT // 2 if full else 3 * BEAT, lo=b["p2"] + 30)[0]
        shots.append(("boss", w2, (beats_fight * BEAT // 2) if full else 3 * BEAT, 1.0, b["name"] + " · PHASE 2", None))
    else:
        w = boss_window(cap, b, beats_fight * BEAT)[0]
        shots.append(("boss", w, beats_fight * BEAT, 1.0, b["name"], None))
    # KO in slow motion: 0.4x around the KO -- only when the boss goes down centred and fully on screen.
    # Real play means the KO sometimes lands near a screen edge; then the shot is the last centred exchange
    # before the final blow (normal speed, no K.O. card), never an edge shot.
    kn = beats_ko * BEAT
    span = int(kn * 0.4)
    st = max(b["fight"], b["ko"] - span // 2)
    rng = range(st, min(len(cap) - 1, st + span))
    if all(centred(cap.meta[cap.near(i)], 96, 288) for i in rng if cap.meta[cap.near(i)].get("boss")):
        shots.append(("ko", st, kn, 0.4, b["name"], "K.O.!"))
    else:
        w = boss_window(cap, b, kn, lo=max(b["fight"], b["ko"] - 900), hi=b["ko"] - 2)
        shots.append(("final", w[0], kn, 1.0, b["name"], None))
    return shots


def ko_overlay(fn, label, seed):
    lab = text_img(label, F_BIG, 120, fill=(255, 210, 60), stroke=8)
    def f(t, n):
        im = fn(t, n)
        if t >= n * 0.35:
            tt = int(t - n * 0.35)
            dx, dy = shake_xy(tt, 10 * max(0, 1 - tt / 8), seed)
            paste_c(im, lab, W / 2 + dx, (H / 2 if SCREEN else CAB.cy + CAB.ch / 2) + dy, scale=slam(tt), alpha=1.0 if t < n - 4 else (n - t) / 4)
        return im
    return f


def add_shots(tl, cap, shots, n, name, seed, first_label=True):
    for k, (kind, st, nf, sp, boss, lab) in enumerate(shots):
        fn = seg_play(cap, st, speed=sp, label=name if (first_label and k == 0) else None, sub=("LEVEL %d" % n) if (first_label and k == 0) else None,
                      boss=boss if kind == "boss" and (k == 0 or "PHASE" in (boss or "") or shots[k - 1][4] != boss) else None,
                      seed=seed + k, tint=(255, 120, 20) if kind == "ko" else None, zoom=1.14 if kind == "ko" else 1.06 if kind == "boss" else None)
        if kind == "ko":
            fn = ko_overlay(fn, lab or "K.O.!", seed + k)
        tl.add(nf, fn, hit="ko" if kind == "ko" else ("slam" if k == 0 else "flash"), poster=(kind == "boss" and k == 0))
        tl.shots.append((n, kind, st, nf, sp, boss))


def build_level(cap, mom, n):
    name = level_name(n)
    tl = Timeline("level%d" % n); tl.shots = []
    seed = n * 7
    bg0 = (mom["card"] or mom["stage"]) + 20
    tl.add(3 * BEAT, seg_card([("LEVEL %d" % n, F_PIX, 34, (255, 210, 60)), (name, F_BIG, 104, (255, 255, 255))], (cap, mom["stage"] + 30), seed), hit="slam")
    a = (mom["action"] or [mom["stage"] + 60])[0]
    tl.add(4 * BEAT, seg_play(cap, a, label=name, sub="LEVEL %d" % n, seed=seed + 1), hit="flash")
    tl.shots.append((n, "action", a, 4 * BEAT, 1.0, None))
    shots = level_shots(cap, mom)
    for k, s in enumerate(shots):
        kind, st, nf, sp, boss, lab = s
        fn = seg_play(cap, st, speed=sp, boss=boss if kind == "boss" else None, seed=seed + 2 + k, tint=(255, 120, 20) if kind == "ko" else None, zoom=1.14 if kind == "ko" else 1.06)
        if kind == "ko":
            fn = ko_overlay(fn, "K.O.!", seed + k)
        tl.add(nf, fn, hit="ko" if kind == "ko" else "flash", poster=(kind == "boss" and k == len(shots) - 2))
        tl.shots.append((n, kind, st, nf, sp, boss))
    end_i = (shots[-1][1] + int(shots[-1][2] * shots[-1][3])) if shots else a
    tl.add(3 * BEAT, seg_card([("SHELL SHOCK LIVE", F_BIG, 92, (255, 210, 60)), ("PLAY NOW", F_BIG, 60, (255, 255, 255)), (PLAY_URL, F_PIX, 20, (255, 255, 255))], (cap, end_i), seed + 15), hit="slam")
    out = os.path.join(OUT, "level%d.mp4" % n)
    tl.render(out, seed=seed, key=[0, 2, -2, 3, 5, -3, 1, 4][(n - 1) % 8])
    return out, tl


def build_full(caps, moms):
    tl = Timeline("full_trailer"); tl.shots = []
    c1, m1 = caps[0], moms[0]
    tl.add(4 * BEAT, seg_card([("FOUR BROTHERS. %d LEVELS." % len(caps), F_PIX, 22, (255, 210, 60)), ("SHELL SHOCK", F_BIG, 120, (255, 255, 255)), ("LIVE", F_BIG, 120, (255, 210, 60))],
                              (c1, (m1["action"] or [m1["stage"]])[0]), 2), hit="slam", poster=True)
    for cap, mom in zip(caps, moms):
        n = mom["level"]; name = level_name(n)
        full_ph2 = any(b["p2"] is not None for b in mom["bosses"][-1:])
        shots = level_shots(cap, mom, beats_fight=8 if full_ph2 else 5, beats_ko=3, full=True)
        add_shots(tl, cap, shots, n, name, 100 + n * 3)
    tl.add(1 * BEAT, seg_flash())
    tl.add(5 * BEAT, seg_card([("SHELL SHOCK LIVE", F_BIG, 96, (255, 210, 60)), ("PLAY NOW", F_BIG, 76, (255, 255, 255)), (PLAY_URL, F_PIX, 22, (255, 255, 255))],
                              (c1, (m1["action"] or [m1["stage"]])[-1]), 400), hit="ko")
    out = os.path.join(OUT, "full_screen.mp4" if SCREEN else "full_trailer.mp4")
    tl.render(out, seed=5, key=0, crf="23", maxrate="2000k")
    return out, tl


def stills(cap, mom, n):
    d = os.path.join(SCR, cap.name); os.makedirs(d, exist_ok=True)
    for f in glob.glob(os.path.join(d, "*.jpg")):
        os.remove(f)
    picks = []
    for k, a in enumerate(mom["action"][:2]):
        sc = [cap.score(cap.meta[i]) for i in range(a, min(len(cap), a + 48))]
        picks.append(("combat%d" % (k + 1), a + int(np.argmax(sc))))
    for b in mom["bosses"]:
        if b["fight"] - b["start"] > 20:
            picks.append(("boss_intro_" + slug(b["name"]), min(b["fight"], b["start"] + 90)))
        w = boss_window(cap, b, 40, n=2, gap=300)
        for k, x in enumerate(w[:2]):
            sc = [cap.score(cap.meta[i]) for i in range(x, x + 40)]
            picks.append(("boss_fight_" + slug(b["name"]) + ("_%d" % (k + 1) if k else ""), x + int(np.argmax(sc))))
        if b["p2"] is not None:
            w = boss_window(cap, b, 40, lo=b["p2"] + 30)
            picks.append(("phase2_" + slug(b["name"]), w[0] + 20))
        if centred(cap.meta[cap.near(b["ko"] + 2)], 96, 288):
            picks.append(("boss_ko_" + slug(b["name"]), b["ko"] + 2))
    if mom["results"] is not None:
        picks.append(("results", mom["results"] + 60))
    files = []
    for k, (lab, i) in enumerate(picks[:10]):
        fn = os.path.join(d, "%02d_%s.jpg" % (k + 1, lab))
        cap.frame(i).save(fn, quality=84); files.append(fn)
    return files


def slug(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", p], capture_output=True, text=True)
    j = json.loads(r.stdout)["format"]
    return float(j["duration"]), int(j["size"])


def contact_boss(caps, moms, shots_by_level):
    """Rows = levels (+ phase 2), 5 frames from the boss shots used in the full cut, screen crop with centre guides
    and the boss's logged screen x (yellow tick)."""
    rows = []
    for cap, mom in zip(caps, moms):
        n = mom["level"]
        sh = [s for s in shots_by_level.get(n, []) if s[1] in ("boss", "ko", "final")]
        groups = {}
        for s in sh:
            groups.setdefault("P2" if s[5] and "PHASE" in s[5] else "main", []).append(s)
        for g, ss in groups.items():
            idxs = []
            for s in ss:
                _, kind, st, nf, sp, boss = s
                span = int(nf * sp)
                idxs += [st + int(span * f) for f in (0.1, 0.5, 0.9)]
            idxs = idxs[:6]
            rows.append(("L%d %s" % (n, ss[0][5] or ""), cap, idxs))
    tw, th = 300, 175
    sheet = Image.new("RGB", (190 + 6 * (tw + 4), len(rows) * (th + 4) + 4), (12, 10, 16))
    d = ImageDraw.Draw(sheet)
    fl = font(F_PIX, 10)
    rep = []
    for r, (lab, cap, idxs) in enumerate(rows):
        y = 4 + r * (th + 4)
        for li, part in enumerate([lab[i:i + 18] for i in range(0, len(lab), 18)][:4]):
            d.text((6, y + 10 + li * 16), part, fill=(255, 210, 90), font=fl)
        for k, i in enumerate(idxs):
            i = max(0, min(len(cap) - 1, i))
            fr = cap.frame(i)
            crop = fr.crop((CAB.cx, CAB.cy, CAB.cx + CAB.cw, CAB.cy + CAB.ch)).resize((tw, th))
            cd = ImageDraw.Draw(crop)
            for gx in (0.25, 0.5, 0.75):
                cd.line((gx * tw, 0, gx * tw, 8), fill=(0, 255, 255) if gx == 0.5 else (255, 60, 60), width=2)
            b = cap.meta[i].get("boss")
            if b:
                bx = b["sx"] / 384 * tw
                cd.polygon([(bx - 6, th - 1), (bx + 6, th - 1), (bx, th - 12)], fill=(255, 230, 0))
                rep.append((lab, i, b["sx"], b["state"]))
            sheet.paste(crop, (190 + k * (tw + 4), y))
    p = os.path.join(TMP, "contact_boss_all_levels.jpg")
    sheet.save(p, quality=85)
    return p, rep


def main():
    global CAB, LEVEL_SRC, SCREEN, SG, W, H, OUT, SCR
    CAB = Cabinet(REF); OUT0 = OUT
    if WHAT == "screen":
        # frame = the cabinet's #screen box (game canvas letterboxed inside it exactly as the game draws it), 2x
        g = CAB.g; sx, sy, sw, sh = g["screen"]; cx, cy, cw, ch = g["canvas"]
        k = 1068 / sw
        SCREEN = True; W, H = 1068, int(round(sh * k / 2)) * 2
        gw, gh = 1068, int(round(ch * k / 2)) * 2
        SG = (0, int(round((cy - sy) * k)), gw, gh)
        print("screen-only", W, H, "game", SG)
    if WHAT == "game":
        # frame = the game canvas only (no cabinet, no letterbox), landscape, 2x the captured canvas: page level clips + stills
        g = CAB.g; cx, cy, cw, ch = g["canvas"]; sw = g["screen"][2]
        k = 1068 / sw
        SCREEN = True; W, H = 1068, int(round(ch * k / 2)) * 2
        SG = (0, 0, W, H)
        OUT, SCR = os.path.join(OUT0, "game"), os.path.join(SCR, "game")
        os.makedirs(OUT, exist_ok=True); os.makedirs(SCR, exist_ok=True)
        print("game-only", W, H)
    dirs = sorted([d for d in glob.glob(os.path.join(RAW, "level*")) if os.path.exists(os.path.join(d, "meta.jsonl"))], key=lambda s: int(os.path.basename(s)[5:]))
    caps = [Cap(d) for d in dirs]
    caps = [c for c in caps if len(c.saved) > 100]
    moms = [find_moments(c) for c in caps]
    for c, m in zip(caps, moms):
        m["level"] = int(c.name[5:])
        print(c.name, len(c), "bosses", [(b["name"], b["fight"], b["ko"], b["p2"]) for b in m["bosses"]], "action", m["action"])
    man_p = os.path.join(OUT0 if WHAT == "game" else OUT, "manifest.json")
    man = json.load(open(man_p)) if os.path.exists(man_p) else {"levels": {}}
    sel = [(c, m) for c, m in zip(caps, moms) if not ONLY or m["level"] in ONLY]
    shots = {}
    if WHAT in ("all", "stills"):
        for c, m in sel:
            fs = stills(c, m, m["level"])
            man["levels"].setdefault(str(m["level"]), {})["stills"] = [os.path.relpath(f, OUTD) for f in fs]
    if WHAT in ("all", "levels"):
        for c, m in sel:
            out, tl = build_level(c, m, m["level"])
            d, s = probe(out)
            L = man["levels"].setdefault(str(m["level"]), {})
            L.update({"name": level_name(m["level"]), "boss": " · ".join(dict.fromkeys(b["name"] for b in m["bosses"])) or None, "video": os.path.relpath(out, OUTD), "duration": round(d, 2), "size": s})
            print("built", out, round(d, 2), "s")
    if WHAT == "game":
        for c, m in sel:
            L = man["levels"].setdefault(str(m["level"]), {})
            L["game_stills"] = [os.path.relpath(f, OUTD) for f in stills(c, m, m["level"])]
            out, tl = build_level(c, m, m["level"])
            d, s = probe(out)
            L.update({"game_video": os.path.relpath(out, OUTD), "game_duration": round(d, 2), "game_size": s, "game_w": W, "game_h": H})
            print("built game", out, round(d, 2), "s", W, "x", H, flush=True)
            json.dump(man, open(man_p, "w"), indent=1)
            man = json.load(open(man_p))
    if WHAT == "screen":
        out, tl = build_full(caps, moms)
        d, s = probe(out); man["full_screen"] = {"video": os.path.relpath(out, OUTD), "duration": round(d, 2), "size": s, "w": W, "h": H, "inputs": os.path.relpath(out.replace(".mp4", "_inputs.json"), OUTD)}
        print("built", out, round(d, 2), "s", W, "x", H)
    if WHAT in ("all", "full", "contact"):
        if WHAT != "contact":
            out, tl = build_full(caps, moms)
            d, s = probe(out); man["full"] = {"video": os.path.relpath(out, OUTD), "duration": round(d, 2), "size": s}
            print("built", out, round(d, 2), "s")
            json.dump(tl.shots, open(os.path.join(TMP, "full_shots.json"), "w"))
        for s in json.load(open(os.path.join(TMP, "full_shots.json"))):
            shots.setdefault(s[0], []).append(s)
        p, rep = contact_boss(caps, moms, shots)
        json.dump(rep, open(os.path.join(TMP, "contact_boss_positions.json"), "w"))
        bad = [r for r in rep if not (96 <= r[2] <= 288)]
        print("contact", p, "frames", len(rep), "boss outside 25-75%:", bad)
    json.dump(man, open(man_p, "w"), indent=1)


if __name__ == "__main__":
    main()

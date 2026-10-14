#!/usr/bin/env python3
"""Shell Shock: Live Action -- "We got live action" intro. Renders native-res frames.
usage: render.py V|L outdir   (V = 270x480 -> 1080x1920, L = 320x180 -> 1280x720)"""
import sys, os, math, random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf"
FPS, DUR = 30, 14.0
NF = int(FPS * DUR)
MODE, OUT = sys.argv[1], sys.argv[2]
W, H = (270, 480) if MODE == "V" else (320, 180)
os.makedirs(OUT, exist_ok=True)

# ---------- game font + logo (copied from the game's GLYPHS / LOGO_FONT) ----------
GLYPHS = {
 'A':[14,17,17,31,17,17,17],'B':[30,17,17,30,17,17,30],'C':[14,17,16,16,16,17,14],'D':[30,17,17,17,17,17,30],
 'E':[31,16,16,30,16,16,31],'F':[31,16,16,30,16,16,16],'G':[14,17,16,23,17,17,15],'H':[17,17,17,31,17,17,17],
 'I':[14,4,4,4,4,4,14],'J':[7,2,2,2,2,18,12],'K':[17,18,20,24,20,18,17],'L':[16,16,16,16,16,16,31],
 'M':[17,27,21,21,17,17,17],'N':[17,17,25,21,19,17,17],'O':[14,17,17,17,17,17,14],'P':[30,17,17,30,16,16,16],
 'Q':[14,17,17,17,21,18,13],'R':[30,17,17,30,20,18,17],'S':[15,16,16,14,1,1,30],'T':[31,4,4,4,4,4,4],
 'U':[17,17,17,17,17,17,14],'V':[17,17,17,17,17,10,4],'W':[17,17,17,21,21,21,10],'X':[17,17,10,4,10,17,17],
 'Y':[17,17,10,4,4,4,4],'Z':[31,1,2,4,8,16,31],
 '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[31,2,4,2,1,17,14],
 '4':[2,6,10,18,31,2,2],'5':[31,16,30,1,1,17,14],'6':[6,8,16,30,17,17,14],'7':[31,1,2,4,8,8,8],
 '8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,2,12],
 '+':[0,4,4,31,4,4,0],'!':[4,4,4,4,4,0,4],':':[0,12,12,0,12,12,0],'-':[0,0,0,31,0,0,0],
 '/':[1,1,2,4,8,16,16],"'":[4,4,8,0,0,0,0],'.':[0,0,0,0,0,12,12],'?':[14,17,1,2,4,0,4],
}
LOGO_FONT = {
 'S':[".####","#....","#....",".###.","....#","....#","####."],'H':["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
 'E':["#####","#....","#....","####.","#....","#....","#####"],'L':["#....","#....","#....","#....","#....","#....","#####"],
 'O':[".###.","#...#","#...#","#...#","#...#","#...#",".###."],'C':[".####","#....","#....","#....","#....","#....",".####"],
 'K':["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"],':':[".....","..#..","..#..",".....","..#..","..#..","....."],
 'I':["#####","..#..","..#..","..#..","..#..","..#..","#####"],'V':["#...#","#...#","#...#","#...#",".#.#.",".#.#.","..#.."],
 'A':[".###.","#...#","#...#","#####","#...#","#...#","#...#"],'T':["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
 'N':["#...#","##..#","#.#.#","#.#.#","#..##","#...#","#...#"],
}
LOGO_COL = ["#7fd85a", "#ffe040", "#3fae3a", "#3fae3a", "#3fae3a", "#2f9a30", "#24702a"]

def glyph_cells(word, logo=False, adv=6):
    cells, cx = [], 0
    for ch in word:
        if ch == " ":
            cx += 3 if logo else 4; continue
        if logo and ch in LOGO_FONT:
            for r, row in enumerate(LOGO_FONT[ch]):
                for c in range(5):
                    if row[c] == "#": cells.append((cx + c, r))
        else:
            g = GLYPHS.get(ch.upper())
            if g:
                for r in range(7):
                    for b in range(5):
                        if g[r] & (16 >> b): cells.append((cx + b, r))
        cx += adv
    return cells, cx - (adv - 5)

def text_layer(word, cell, cols, logo=False, adv=6, outline=2, shadow=2):
    """Pixel text in the game's logo treatment (drop shadow + dark outline + per-row colour). Returns RGBA."""
    cells, wcells = glyph_cells(word, logo, adv)
    pad = outline + shadow + 1
    im = Image.new("RGBA", (wcells * cell + pad * 2, 7 * cell + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for c, r in cells:  # drop shadow
        x, y = pad + c * cell, pad + r * cell
        d.rectangle([x - outline, y - outline + shadow, x + cell + outline - 1, y + cell + outline - 1 + shadow], fill="#050a05")
    for c, r in cells:  # outline
        x, y = pad + c * cell, pad + r * cell
        d.rectangle([x - outline, y - outline, x + cell + outline - 1, y + cell + outline - 1], fill="#0a1a0a")
    for c, r in cells:
        x, y = pad + c * cell, pad + r * cell
        col = cols[r] if isinstance(cols, list) else cols
        d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=col)
        if isinstance(cols, list) and r == 1:
            d.rectangle([x, y, x + cell - 1, y], fill="#fff6a0")
    return im

def hud_text(word, s, col, adv=6):
    """Game HUD ptext(): glyphs with a 1-cell black drop shadow."""
    cells, wcells = glyph_cells(word, False, adv)
    im = Image.new("RGBA", (wcells * s + s, 7 * s + s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for ox, c_ in ((s, "#000000"), (0, col)):
        for c, r in cells:
            x, y = ox + c * s, ox + r * s
            d.rectangle([x, y, x + s - 1, y + s - 1], fill=c_)
    return im

HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]
def heart(s, col="#e8302a"):
    im = Image.new("RGBA", (7 * s + 2 * s, 6 * s + 2 * s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for ox, c_ in ((s, "#1a0a24"), (0, col)):
        for r, row in enumerate(HEART):
            for c, ch in enumerate(row):
                if ch == "#":
                    d.rectangle([s // 2 + ox + c * s, s // 2 + ox + r * s, s // 2 + ox + c * s + s - 1, s // 2 + ox + r * s + s - 1], fill=c_)
    d.rectangle([s // 2 + 1 * s, s // 2 + 1 * s, s // 2 + 2 * s - 1, s // 2 + 2 * s - 1], fill="#ffb0c8")  # shine
    return im

def paste_center(dst, im, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
    if alpha < 1.0:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    dst.alpha_composite(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2)))) if \
        0 <= cx - im.width / 2 and cy - im.height / 2 >= 0 and cx + im.width / 2 <= dst.width and cy + im.height / 2 <= dst.height \
        else safe_paste(dst, im, int(round(cx - im.width / 2)), int(round(cy - im.height / 2)))

def safe_paste(dst, im, x, y):
    layer = Image.new("RGBA", dst.size, (0, 0, 0, 0)); layer.paste(im, (x, y), im); dst.alpha_composite(layer)

# ---------- sprites ----------
def despill(im):
    r, g, b, a = im.split()
    import numpy as np
    R, G, B = (np.asarray(x, dtype=np.int16) for x in (r, g, b))
    G2 = np.minimum(G, np.maximum(R, B))
    return Image.merge("RGBA", (r, Image.fromarray(G2.astype("uint8")), b, a))

def load_man(fn, feet, marks):
    im = despill(Image.open(os.path.join(HERE, fn)).convert("RGBA"))
    bb = im.getbbox(); im = im.crop(bb)
    f = (feet[0] - bb[0], feet[1] - bb[1]); m = {k: (v[0] - bb[0], v[1] - bb[1]) for k, v in marks.items()}
    return im, f, m

BASE = 0.3125  # world px per source px for the raise pose (hat 138px)
MAN = {
 "raise": load_man("man_raise.png", (715, 764), {"hands": (700, 47)}) + (BASE,),
 "kiss": load_man("man_kiss.png", (745, 764), {"lips": (755, 170), "hands": (860, 185)}) + (BASE * 138 / 134,),
 "crouch": load_man("man_crouch.png", (690, 764), {"hands": (950, 540)}) + (BASE * 138 / 207,),
}
ATLAS = {
 "lenny": {"idle": (0, 7, 122, 150)}, "rafe": {"idle": (0, 2, 99, 150)},
 "miko": {"idle": (0, 23, 97, 150), "jump": (327, 24, 77, 149), "hurt": (406, 7, 91, 166), "walk": (99, 17, 99, 156)},
 "donny": {"idle": (0, 32, 154, 150)},
}
_atl = {}
def frame(name, fr):
    if name not in _atl: _atl[name] = Image.open(f"{SITE}/atlas_{name}.png").convert("RGBA")
    x, y, w, h = ATLAS[name][fr]
    return _atl[name].crop((x, y, x + w, y + h))
MIKO_K = 115 / 150  # world px per atlas px

# ---------- camera ----------
class Cam:
    def __init__(s, x, y, z): s.x, s.y, s.z = x, y, z
    def scr(s, wx, wy): return ((wx - s.x) * s.z + W / 2, (wy - s.y) * s.z + H / 2)

def draw_sprite(dst, cam, im, anchor, wpos, k, flip=False, rot=0.0):
    """im: source RGBA; anchor: px in im placed at world wpos; k: world px per source px."""
    sc = k * cam.z
    nw, nh = max(1, round(im.width * sc)), max(1, round(im.height * sc))
    sp = im.resize((nw, nh), Image.LANCZOS)
    ax, ay = anchor[0] * sc, anchor[1] * sc
    if flip:
        sp = sp.transpose(Image.FLIP_LEFT_RIGHT); ax = nw - ax
    sx, sy = cam.scr(*wpos)
    if rot:
        # rotate about anchor
        big = Image.new("RGBA", (nw * 3, nh * 3), (0, 0, 0, 0)); big.paste(sp, (nw, nh))
        big = big.rotate(rot, resample=Image.BICUBIC, center=(nw + ax, nh + ay))
        safe_paste(dst, big, int(round(sx - nw - ax)), int(round(sy - nh - ay)))
    else:
        safe_paste(dst, sp, int(round(sx - ax)), int(round(sy - ay)))

def shadow(dst, cam, wx, w):
    sx, sy = cam.scr(wx, 0); rx = w * cam.z / 2; ry = max(1.5, rx * 0.16)
    lay = Image.new("RGBA", dst.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse([sx - rx, sy - ry, sx + rx, sy + ry], fill=(20, 30, 10, 110)); dst.alpha_composite(lay)

BG = Image.open(os.path.join(HERE, "pond_bg.png")).convert("RGBA")
BG_GROUND = 470  # bg row where the characters stand
def draw_bg(dst, cam, zref):
    gx, gy = cam.scr(0, 0)
    k0 = (H * 0.92) / BG_GROUND
    k = k0 * (cam.z / zref) ** 0.5
    k = max(k, (gy + 2) / BG_GROUND, (H - gy + 2) / (BG.height - BG_GROUND), (W + 4) / BG.width)
    bw, bh = round(BG.width * k), round(BG.height * k)
    bg = BG.resize((bw, bh), Image.LANCZOS)
    left = W / 2 - bw * 0.47 - (cam.x * cam.z) * 0.35
    left = min(0, max(W - bw, left))
    top = gy - BG_GROUND * k
    top = min(0, max(H - bh, top))
    dst.alpha_composite(bg, (int(left), int(top)))

def hashf(n):
    v = math.sin(n * 127.1 + 311.7) * 43758.5453; return v - math.floor(v)

def draw_night(dst, t):
    d = ImageDraw.Draw(dst)
    stops = [(0, (5, 6, 26)), (0.7, (27, 22, 64)), (1, (42, 26, 58))]
    for y in range(H):
        f = y / (H - 1)
        for i in range(len(stops) - 1):
            if stops[i][0] <= f <= stops[i + 1][0]:
                u = (f - stops[i][0]) / (stops[i + 1][0] - stops[i][0]); a, b = stops[i][1], stops[i + 1][1]
                d.line([(0, y), (W, y)], fill=tuple(int(a[j] + (b[j] - a[j]) * u) for j in range(3)) + (255,))
    for i in range(int(46 * W / 384 * max(1, H / 224))):
        tw = math.sin(t * 3 + i * 2.3) > 0.6
        d.point((int(hashf(i) * W), int(hashf(i + 99) * H * 0.55)), fill="#ffffff" if tw else "#8890c0")
    mx, my = (W - 46, int(H * 0.14)) if MODE == "L" else (W - 34, 30)
    lay = Image.new("RGBA", dst.size, (0, 0, 0, 0)); ImageDraw.Draw(lay).ellipse([mx - 26, my - 26, mx + 26, my + 26], fill=(240, 236, 200, 20))
    dst.alpha_composite(lay); d = ImageDraw.Draw(dst)
    d.ellipse([mx - 16, my - 16, mx + 16, my + 16], fill="#f4f0d0")
    d.rectangle([mx - 8, my - 6, mx - 5, my - 3], fill="#d8d2a8"); d.rectangle([mx + 4, my + 4, mx + 8, my + 7], fill="#d8d2a8")
    base0 = H - 112 + (0 if MODE == "L" else -40)
    for layer, col, base, hMin, hVar in ((0, "#161a38", base0, 30, 50), (1, "#0a0b18", base0 + 24, 20, 50)):
        x, i = -6, layer * 50
        while x < W:
            w = 18 + int(hashf(i) * 22); h = hMin + int(hashf(i + 7) * hVar); top = base + 60 - h
            d.rectangle([x, top, x + w - 1, H], fill=col)
            if hashf(i + 3) > 0.7: d.rectangle([x + w // 2 - 1, top - 8, x + w // 2, top], fill=col)
            if layer == 1:
                for wy in range(top + 5, H - 4, 7):
                    for wx in range(x + 3, x + w - 4, 6):
                        if hashf(wx * 3.1 + wy) > 0.8: d.rectangle([wx, wy, wx + 1, wy + 2], fill="#ffd27a")
            x += w + 1; i += 1

def ease_out_back(k, c1=2.6):
    c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2
def ease_io(k): k = max(0, min(1, k)); return k * k * (3 - 2 * k)
def lerp(a, b, u): return a + (b - a) * u

# pre-built text
if MODE == "V":
    T_WEGOT = text_layer("WE GOT", 5, ["#ffffff", "#fff6a0", "#ffe060", "#ffe060", "#ffb21a", "#ff8c1a", "#e8401a"])
    T_LIVE = text_layer("LIVE", 8, LOGO_COL, logo=True)
    T_ACTION = text_layer("ACTION!", 5, LOGO_COL, logo=True)
    T_MWAH = text_layer("MWAH!", 6, ["#ffffff", "#ffd0e4", "#ff9ac4", "#ff6aa8", "#ff6aa8", "#e83a80", "#b81e5a"])
else:
    T_WEGOT = text_layer("WE GOT", 4, ["#ffffff", "#fff6a0", "#ffe060", "#ffe060", "#ffb21a", "#ff8c1a", "#e8401a"])
    T_LIVE = text_layer("LIVE", 6, LOGO_COL, logo=True)
    T_ACTION = text_layer("ACTION!", 4, LOGO_COL, logo=True)
    T_MWAH = text_layer("MWAH!", 4, ["#ffffff", "#ffd0e4", "#ff9ac4", "#ff6aa8", "#ff6aa8", "#e83a80", "#b81e5a"])
BANG = text_layer("!", 3 if MODE == "V" else 2, "#ffe060")
HEARTS = {s: heart(s) for s in (1, 2, 3, 4, 6, 8)}

# title card text
if MODE == "V":
    TT = [(text_layer("SHELL", 7, LOGO_COL, logo=True, outline=2), 82), (text_layer("SHOCK:", 7, LOGO_COL, logo=True, outline=2), 146),
          (text_layer("LIVE ACTION", 3, LOGO_COL, logo=True), 204)]
    T_PUSH = hud_text("PUSH START", 2, "#ffffff"); T_URL = None
    T_FREE = hud_text("PLAY FREE IN YOUR BROWSER", 1, "#c8ccd6")
else:
    TT = [(text_layer("SHELL SHOCK:", 4, LOGO_COL, logo=True), 22), (text_layer("LIVE ACTION", 2, LOGO_COL, logo=True), 52)]
    T_PUSH = hud_text("PUSH START", 1, "#ffffff"); T_URL = hud_text("SHELLSHOCK-LIVE.SURGE.SH", 2, "#ffd27a")
    T_FREE = hud_text("PLAY FREE IN YOUR BROWSER", 1, "#c8ccd6")

# float advance for URL in V: re-render with 11px advance at s=2
if MODE == "V":
    def hud_text_adv(word, s, col, advpx):
        cells = []
        for i, ch in enumerate(word):
            g = GLYPHS.get(ch)
            if g:
                for r in range(7):
                    for b in range(5):
                        if g[r] & (16 >> b): cells.append((i * advpx + b * s, r * s))
        wpx = (len(word) - 1) * advpx + 5 * s
        im = Image.new("RGBA", (wpx + s, 7 * s + s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for ox, c_ in ((s, "#000000"), (0, col)):
            for x, y in cells: d.rectangle([x + ox, y + ox, x + ox + s - 1, y + ox + s - 1], fill=c_)
        return im
    T_URL = hud_text("SHELLSHOCK-LIVE", 2, "#ffd27a"); T_URL2 = hud_text(".SURGE.SH", 2, "#ffd27a")

# ---------- timeline ----------
HX, HY = float(os.environ.get("HX", 28)), float(os.environ.get("HY", -16))
T_GRAB, T_RAISE, T_WE, T_LIVE_, T_ACT, T_KISS, T_SMOOCH, T_WIPE, T_TITLE = 1.05, 1.5, 2.0, 2.45, 2.85, 5.0, 5.6, 8.0, 8.4
rng = random.Random(7)
SHAKES = [(T_RAISE, 4), (T_WE, 3), (T_LIVE_, 5), (T_ACT, 4), (T_SMOOCH, 3)]

def shake(t):
    a = 0
    for t0, amp in SHAKES:
        if 0 <= t - t0 < 0.3: a = max(a, amp * (1 - (t - t0) / 0.3))
    return a

def hand_sway(t, amt):
    return (math.sin(t * 2.1) * 1.6 + math.sin(t * 5.3) * 0.6) * amt, (math.cos(t * 1.7) * 1.2 + math.sin(t * 4.1) * 0.5) * amt

def slam(dst, im, cx, cy, t, t0, big=2.2):
    if t < t0: return
    u = (t - t0) / 0.18
    sc = big - (big - 1) * ease_out_back(min(1, u), 1.8) if u < 1 else 1.0
    if u >= 1: sc = 1.0
    sc = max(0.6, sc)
    paste_center(dst, im, cx, cy, sc, min(1, 0.35 + u))

def render(fi):
    t = fi / FPS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    flash = 0.0
    sh = shake(t); sx_, sy_ = (rng.uniform(-sh, sh), rng.uniform(-sh, sh)) if sh else (0, 0)
    if t < T_TITLE + 0.25:
        # ---------------- live action stage ----------------
        hx, hy = hand_sway(t, 1.0 if t < T_KISS else 0.6)
        if t < T_RAISE:  # beat 1: sneak + grab
            u = ease_io(t / T_GRAB)
            cam = Cam(25 + hx, -118 + hy, 1.3) if MODE == "V" else Cam(30 + hx, -105 + hy, 0.68)
            zref = cam.z
        elif t < T_KISS:  # beat 2: overhead hoist + slams
            u = ease_io((t - T_RAISE) / 3.5)
            if MODE == "V": z_ = lerp(0.85, 0.88, u); cam = Cam(-5 + hx, (240 - 460) / z_ + hy, z_)
            else: z_ = lerp(0.40, 0.43, u); cam = Cam(85 / z_ + hx, -(173 - 90) / z_ + hy, z_)
            zref = 1.0 if MODE == "V" else 0.47
        else:  # beat 3: smooch close-up
            u = ease_io((t - T_KISS) / 0.55)
            if MODE == "V": cam = Cam(lerp(8, 26, u) + hx, lerp(-175, -165, u) + hy, lerp(1.3, 1.95, u))
            else: cam = Cam(lerp(18, 22, u) + hx, lerp(-140, -155, u) + hy, lerp(0.8, 1.1, u))
            zref = 1.0 if MODE == "V" else 0.47
        cam.x += sx_ / cam.z; cam.y += sy_ / cam.z
        draw_bg(img, cam, zref)
        if t < T_RAISE:
            man, feet, mk, k = MAN["crouch"]
            mx = lerp(-38, 0, u) + math.sin(t * 9) * 1.2 * (1 - u)
            bob = abs(math.sin(t * 9)) * 2 * (1 - u)
            mko = frame("miko", "idle")
            shadow(img, cam, 62, 60); shadow(img, cam, mx - 5, 90)
            mbob = math.sin(t * 4) * 1.0
            draw_sprite(img, cam, mko, (mko.width / 2, mko.height), (62, mbob * 0.5), MIKO_K)
            draw_sprite(img, cam, man, feet, (mx, -bob), k)
            if t >= T_GRAB:  # "!" pop over Miko like the game's alert
                v = (t - T_GRAB) / 0.12
                px, py = cam.scr(62, -128)
                paste_center(img, BANG, px, py - 6 * max(0, 1 - v), 1.0 + 0.6 * max(0, 1 - v))
        elif t < T_KISS:
            man, feet, mk, k = MAN["raise"]
            hw = mk["hands"]; hwx, hwy = (hw[0] - feet[0]) * k, (hw[1] - feet[1]) * k
            lift = max(0, 1 - (t - T_RAISE) / 0.16)  # whoosh up from the ground
            mko = frame("miko", "jump")
            wig = math.sin((t - T_RAISE) * 14) * 7 * min(1, (t - T_RAISE) / 0.3)
            shadow(img, cam, 0, 92)
            draw_sprite(img, cam, mko, (mko.width / 2, mko.height * 0.8), (hwx + 2, hwy + 4 + lift * 150), MIKO_K, rot=wig)
            bounce = abs(math.sin((t - T_RAISE) * 7)) * 2
            draw_sprite(img, cam, man, feet, (0, -bounce), k)
            if t - T_RAISE < 0.07: flash = 0.85
        else:
            man, feet, mk, k = MAN["kiss"]
            lips = ((mk["lips"][0] - feet[0]) * k, (mk["lips"][1] - feet[1]) * k)
            hands = ((mk["hands"][0] - feet[0]) * k, (mk["hands"][1] - feet[1]) * k)
            mko = frame("miko", "hurt")
            # flipped hurt frame: head sits ~23% from the left, ~9% from the top
            pull = ease_io((t - T_KISS - 0.25) / 0.3)
            head = (lips[0] + lerp(46, HX, pull), lips[1] + lerp(-20, HY, pull))
            anc = (mko.width * 0.11, mko.height * 0.07)
            tilt = 38 + (0 if t < T_SMOOCH else math.sin((t - T_SMOOCH) * 18) * 6 * max(0, 1 - (t - T_SMOOCH) / 0.6))
            shadow(img, cam, 10, 90)
            draw_sprite(img, cam, man, feet, (0, 0), k)
            draw_sprite(img, cam, mko, anc, head, MIKO_K, flip=True, rot=tilt)
            kx, ky = cam.scr(lips[0] + 6, lips[1] - 2)
            if t >= T_SMOOCH:
                v = t - T_SMOOCH
                if v < 0.07: flash = 0.5
                # big heart pop
                if v < 0.7:
                    hs = 8 if MODE == "V" else 4
                    sc = ease_out_back(min(1, v / 0.2), 2.2) * (1 + max(0, v - 0.45) * 0.6)
                    paste_center(img, HEARTS[hs], kx, ky - (44 if MODE == 'V' else 24) - v * 40, max(0.1, sc * 0.8), max(0, min(1, (0.7 - v) / 0.25)))
                # burst of small hearts
                for i in range(10):
                    a = i / 10 * math.tau + 0.3
                    r = (26 + v * 120) * (1 if MODE == "V" else 0.6) * min(1, v / 0.5 + 0.3)
                    if v < 1.6:
                        hs = 3 if MODE == "V" else 2
                        paste_center(img, HEARTS[hs], kx + math.cos(a) * r, ky + math.sin(a) * r * 0.8 - v * 12, 1, max(0, min(1, (1.6 - v) / 0.5)))
                # MWAH! slam
                if MODE == "V": slam(img, T_MWAH, W / 2, 70, t, T_SMOOCH + 0.02, 2.0)
                else: slam(img, T_MWAH, W - 70, 30, t, T_SMOOCH + 0.02, 2.0)
                # dizzy love-hearts orbiting Miko's head after the smooch
                if v > 0.6:
                    hx2, hy2 = cam.scr(head[0] + 16, head[1] - 10)
                    for i in range(4):
                        a = (v * 4 + i / 4 * math.tau)
                        hs = 2 if MODE == "V" else 1
                        paste_center(img, HEARTS[hs], hx2 + math.cos(a) * 18 * (cam.z / 2), hy2 + math.sin(a) * 6 * (cam.z / 2))
        # beat 2 text slams (persist through the hoist)
        if T_WE <= t < T_KISS:
            if MODE == "V":
                slam(img, T_WEGOT, W / 2, 30, t, T_WE); slam(img, T_LIVE, W / 2, 86, t, T_LIVE_, 2.6); slam(img, T_ACTION, W / 2, 142, t, T_ACT)
            else:
                rx = 238
                slam(img, T_WEGOT, rx, 40, t, T_WE); slam(img, T_LIVE, rx, 84, t, T_LIVE_, 2.6); slam(img, T_ACTION, rx, 128, t, T_ACT)
            for t0 in (T_WE, T_LIVE_, T_ACT):
                if 0 <= t - t0 < 0.05: flash = max(flash, 0.6)
        if t < 0.25: flash = max(flash, 0)  # (fade-in handled below)
    if t >= T_TITLE - 0.2:
        # ---------------- title card ----------------
        tt = t - (T_TITLE - 0.2)
        title = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        draw_night(title, t)
        k_ = min(1, tt / 0.67); e = ease_out_back(k_)
        drop = -(1 - e) * (140 if MODE == "V" else 110)
        for im, y in TT:
            title.alpha_composite(im, (int(W / 2 - im.width / 2), int(y - im.height / 2 + drop)))
        if 0.62 < tt < 0.7: flash = max(flash, 0.3)
        # brothers row, staggered hop-in (idle frames from the game's atlases)
        names = ["lenny", "rafe", "miko", "donny"]
        if MODE == "V": feet_y, bh, gap = 330, 84, 64
        else: feet_y, bh, gap = 140, 62, 62
        for i, nm in enumerate(names):
            ti = tt - 0.75 - i * 0.12
            if ti < 0: continue
            hop = max(0, 1 - ti / 0.25); yoff = -math.sin(min(1, ti / 0.25) * math.pi) * 10
            fr = frame(nm, "idle"); kk = bh / 150
            sp = fr.resize((max(1, round(fr.width * kk)), max(1, round(fr.height * kk))), Image.LANCZOS)
            cx = W / 2 + (i - 1.5) * gap
            sl = Image.new("RGBA", title.size, (0, 0, 0, 0)); ImageDraw.Draw(sl).ellipse([cx - 20, feet_y - 3, cx + 20, feet_y + 3], fill=(0, 0, 0, 120))
            title.alpha_composite(sl)
            safe_paste(title, sp, int(cx - sp.width / 2), int(feet_y - sp.height + yoff))
        if tt > 1.4:
            if MODE == "V":
                if int(t * 2) % 2 == 0: paste_center(title, T_PUSH, W / 2, 362)
                paste_center(title, T_FREE, W / 2, 392); paste_center(title, T_URL, W / 2, 414); paste_center(title, T_URL2, W / 2, 434)
            else:
                if int(t * 2) % 2 == 0: paste_center(title, T_PUSH, W / 2, 69)
                paste_center(title, T_URL, W / 2, 162)
        # wipe: dark bar sweeps across (like the game's select-screen wipe)
        if t < T_TITLE + 0.2:
            # title revealed behind a diagonal moving edge
            u = (t - (T_TITLE - 0.2)) / 0.4
            mask = Image.new("L", (W, H), 0); d = ImageDraw.Draw(mask)
            edge = -H * 0.6 + u * (W + H * 1.2)
            d.polygon([(0, 0), (edge, 0), (edge - H * 0.6, H), (0, H)], fill=255)
            bar = Image.new("RGBA", (W, H), (10, 26, 10, 255))
            m2 = Image.new("L", (W, H), 0); ImageDraw.Draw(m2).polygon([(edge, 0), (edge + 14, 0), (edge + 14 - H * 0.6, H), (edge - H * 0.6, H)], fill=255)
            img.paste(title, (0, 0), mask); img.paste(bar, (0, 0), m2)
        else:
            img = title
    # fade in / out
    if flash > 0:
        img = Image.blend(img, Image.new("RGBA", (W, H), (255, 255, 255, 255)), flash)
    if t < 0.2: img = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, t / 0.2)
    if t > DUR - 0.35: img = Image.blend(img, Image.new("RGBA", (W, H), (0, 0, 0, 255)), min(1, (t - (DUR - 0.35)) / 0.35))
    return img.convert("RGB")

if __name__ == "__main__":
    lo, hi = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, NF)
    for fi in range(lo, hi):
        render(fi).save(os.path.join(OUT, f"f{fi:04d}.png"))

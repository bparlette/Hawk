# 16-bit environment textures for prototype F: painted city textures -> area-downscaled to ~0.05 m/texel and palette-quantized;
# ground tiles (asphalt / sidewalk / roof) drawn procedurally as clean pixel-art tiles. Output: ../site_f/px/*.png
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
import random, os
SRC = '/workspace/work/ss3d-bakeoff/f_free16/site_orig/tex/'
OUT = '/workspace/work/ss3d-bakeoff/f_free16/site_f/px/'
os.makedirs(OUT, exist_ok=True)
def pix(name, size, colors=40, sat=1.12, con=1.06, sharp=True, out=None, alpha=False):
    im = Image.open(SRC + name).convert('RGBA')
    a = im.split()[3]
    rgb = im.convert('RGB')
    if sharp: rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    rgb = rgb.resize(size, Image.BOX)
    rgb = ImageEnhance.Color(rgb).enhance(sat); rgb = ImageEnhance.Contrast(rgb).enhance(con)
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    if alpha:
        aa = a.resize(size, Image.BOX).point(lambda v: 255 if v >= 128 else 0)
        q = q.convert('RGBA'); q.putalpha(aa)
    q.save(OUT + (out or os.path.splitext(name)[0] + '.png'))
    return q
pix('facade_a.jpg', (680, 288), 48)        # ~14 m tall wall -> ~0.05 m / texel
pix('facade_b.jpg', (516, 288), 48)
pix('mural_pizza.jpg', (448, 190), 40, sat=1.05)
pix('mural_gator.jpg', (448, 190), 40, sat=1.05)
pix('taxi_side.webp', (128, 47), 24, alpha=True)
pix('van_side.webp', (144, 68), 24, alpha=True)
pix('props2.webp', (156, 31), 24, alpha=True)
pix('skyline.jpg', (528, 179), 32, sat=1.0)
random.seed(7)
def tile(w, h, base, fn, name):
    im = Image.new('RGB', (w, h), base); d = ImageDraw.Draw(im); fn(im, d, w, h); im.save(OUT + name)
def asphalt(im, d, w, h):
    P = [(46, 46, 58), (52, 52, 64), (40, 40, 52), (58, 57, 70), (34, 34, 45)]
    px = im.load()
    for y in range(h):
        for x in range(w):
            r = random.random(); px[x, y] = P[0] if r < .55 else P[1] if r < .75 else P[2] if r < .9 else P[3] if r < .96 else P[4]
    for _ in range(9):  # cracks
        x, y = random.randrange(w), random.randrange(h)
        for i in range(random.randint(6, 16)):
            px[x % w, y % h] = (26, 26, 34); x += random.choice((-1, 0, 1, 1)); y += random.choice((0, 1, 1))
    for _ in range(4):  # oily patches
        cx, cy, r = random.randrange(w), random.randrange(h), random.randint(4, 8)
        for y in range(-r, r + 1):
            for x in range(-r * 2, r * 2 + 1):
                if (x / 2) ** 2 + y * y <= r * r and (x + y) % 2 == 0: px[(cx + x) % w, (cy + y) % h] = (36, 38, 50)
tile(128, 128, (46, 46, 58), asphalt, 'asphalt.png')
def sidewalk(im, d, w, h):  # 2x2 slabs per 64 px tile (3.2 m), bevelled edges
    px = im.load(); S = w // 2
    for y in range(h):
        for x in range(w):
            r = random.random(); px[x, y] = (128, 128, 140) if r < .6 else (120, 120, 133) if r < .85 else (136, 136, 148) if r < .97 else (104, 104, 118)
    for k in range(0, w, S):
        for i in range(h): px[k, i] = (70, 70, 84); px[(k + 1) % w, i] = (150, 150, 162)
        for i in range(w): px[i, k] = (70, 70, 84); px[i, (k + 1) % h] = (150, 150, 162)
    for _ in range(5):
        x, y = random.randrange(w), random.randrange(h)
        for i in range(random.randint(4, 9)): px[x % w, y % h] = (92, 92, 106); x += random.choice((-1, 1, 1)); y += random.choice((0, 1))
tile(64, 64, (128, 128, 140), sidewalk, 'sidewalk.png')
def roof(im, d, w, h):  # tar roof: dark tiles with seams + a vent dot
    px = im.load()
    for y in range(h):
        for x in range(w):
            r = random.random(); px[x, y] = (62, 58, 72) if r < .6 else (56, 52, 66) if r < .85 else (70, 66, 80)
    for y in range(0, h, 25):
        for x in range(w): px[x, y] = (40, 36, 50); px[x, (y + 1) % h] = (82, 78, 94)
    for row, y in enumerate(range(0, h, 25)):
        off = 0 if row % 2 else 25
        for x in range(off, w, 50):
            for i in range(25): px[x % w, (y + i) % h] = (40, 36, 50)
    for (cx, cy) in ((70, 70),):
        for y in range(-3, 4):
            for x in range(-3, 4):
                if x * x + y * y <= 9: px[cx + x, cy + y] = (30, 30, 36) if x * x + y * y > 4 else (90, 92, 100)
tile(100, 100, (62, 58, 72), roof, 'roof.png')
print(sorted(os.listdir(OUT)))

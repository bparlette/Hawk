#!/usr/bin/env python3
"""Builds the ES-DE media + app icon for Toad City Baltimore.
Everything is drawn procedurally from the game's own title text, in the game's own UI font (site/pressstart2p.woff2,
Press Start 2P, SIL OFL) and UI colours (#ffd23c yellow, #14101f ink, #5ccf3a toad green, #1f7bff mask blue).
No logo files are copied. Screenshot/fanart are the game's own captures; the video is cut from the game's own
landmark drone-cam frames (toad-city/gifs/frames/landmarks), or from any frame folder given with --frames.
usage: make_media.py <site_dir> <screenshot.png> <fanart.png> <frames_root> <out_es_de_dir> <icon_out.png>
"""
import os, sys, subprocess, tempfile, shutil, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

site, shot, fan, frames_root, out, icon_out = sys.argv[1:7]
NAME = 'Toad City Baltimore'
SYS = 'toadcity'
Y, INK, GREEN, BLUE, BG = (255, 210, 60), (20, 16, 31), (92, 207, 58), (31, 123, 255), (11, 15, 23)

# woff2 -> ttf so PIL can use it
tmp = tempfile.mkdtemp()
ttf = os.path.join(tmp, 'px.ttf')
f = TTFont(os.path.join(site, 'pressstart2p.woff2')); f.flavor = None; f.save(ttf)
font = lambda s: ImageFont.truetype(ttf, s)
media = os.path.join(out, 'downloaded_media', SYS)
def save(img, kind, ext='png'):
    d = os.path.join(media, kind); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f'{NAME}.{ext}'); img.save(p, optimize=True); return p

def outlined(draw, xy, text, fnt, fill, ink=INK, stroke=None, shadow=None, anchor='mm'):
    s = stroke if stroke is not None else max(2, fnt.size // 7)
    sh = shadow if shadow is not None else max(3, fnt.size // 5)
    draw.text((xy[0] + sh, xy[1] + sh), text, font=fnt, fill=ink, stroke_width=s, stroke_fill=ink, anchor=anchor)
    draw.text(xy, text, font=fnt, fill=fill, stroke_width=s, stroke_fill=ink, anchor=anchor)

def toad(size):
    """the HUD's toad face (#face in index.html): green disc, blue mask band, white eyes, ink outline"""
    S = size * 4; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    w = S // 16
    d.ellipse([w, w, S - w, S - w], fill=GREEN + (255,), outline=INK + (255,), width=w)
    band = Image.new('RGBA', (S, S), (0, 0, 0, 0)); bd = ImageDraw.Draw(band)
    bd.rectangle([0, int(S * .30), S, int(S * .56)], fill=BLUE + (255,), outline=INK + (255,), width=w // 2 + 2)
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([w * 2, w * 2, S - w * 2, S - w * 2], fill=255)
    im.paste(band, (0, 0), Image.composite(band.split()[3], Image.new('L', (S, S), 0), mask))
    for cx in (.34, .66):
        x0, y0 = int(S * cx - S * .09), int(S * .36)
        d.rounded_rectangle([x0, y0, x0 + int(S * .18), y0 + int(S * .13)], radius=S // 40, fill=(255, 255, 255, 255), outline=INK + (255,), width=w // 2)
        d.rectangle([x0 + int(S * .07), y0 + int(S * .03), x0 + int(S * .12), y0 + int(S * .10)], fill=INK + (255,))
    d.arc([int(S * .30), int(S * .52), int(S * .70), int(S * .80)], 20, 160, fill=INK + (255,), width=w // 2 + 2)
    return im.resize((size, size), Image.LANCZOS)

# ---- marquee / logo (transparent, wide) ----
def logo(W, H):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    big, small = font(int(H * .30)), font(int(H * .16))
    outlined(d, (W // 2, int(H * .36)), 'TOAD CITY', big, Y)
    outlined(d, (W // 2, int(H * .76)), 'BALTIMORE', small, (255, 255, 255))
    return im
mq = logo(1200, 400); save(mq, 'marquees')

# ---- app icon 1024 ----
ic = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); d = ImageDraw.Draw(ic)
d.rounded_rectangle([40, 40, 984, 984], radius=200, fill=BG + (255,), outline=Y + (255,), width=28)
ic.alpha_composite(toad(520), (252, 150))
outlined(d, (512, 790), 'TOAD CITY', font(80), Y)
outlined(d, (512, 890), 'BALTIMORE', font(50), (255, 255, 255))
os.makedirs(os.path.dirname(icon_out), exist_ok=True); ic.save(icon_out)

# ---- screenshot + fanart (game captures) ----
s = Image.open(shot).convert('RGB'); save(s, 'screenshots')
fa = Image.open(fan).convert('RGB'); save(fa.convert('RGB').resize((1280, 720)), 'fanart', 'jpg')

# ---- title screen: fanart darkened + logo ----
t = fa.resize((1280, 720)).convert('RGBA'); t = Image.alpha_composite(t, Image.new('RGBA', t.size, (11, 15, 23, 120)))
lg = logo(1000, 333); t.alpha_composite(lg, (140, 150))
dt = ImageDraw.Draw(t); outlined(dt, (640, 600), 'PRESS START', font(28), (255, 255, 255))
save(t.convert('RGB'), 'titlescreens')

# ---- cover (box art 2:3) ----
C = Image.new('RGBA', (800, 1200), BG + (255,))
bgc = fa.resize((int(1200 * 16 / 9), 1200)).crop((int((1200 * 16 / 9 - 800) / 2), 0, int((1200 * 16 / 9 - 800) / 2) + 800, 1200)).convert('RGBA')
C.alpha_composite(bgc); C.alpha_composite(Image.new('RGBA', C.size, (11, 15, 23, 110)))
dc = ImageDraw.Draw(C); dc.rectangle([0, 0, 799, 1199], outline=Y + (255,), width=18)
C.alpha_composite(toad(300), (250, 470))
C.alpha_composite(logo(760, 253), (20, 120))
outlined(dc, (400, 1110), 'BRAD PARLETTE', font(26), (255, 255, 255))
save(C.convert('RGB'), 'covers')

# ---- miximage: screenshot + cover + marquee, transparent canvas like ES-DE's generator ----
M = Image.new('RGBA', (1280, 960), (0, 0, 0, 0))
M.alpha_composite(s.resize((1100, 619)).convert('RGBA'), (90, 120))
M.alpha_composite(C.resize((300, 450)), (960, 500))
M.alpha_composite(logo(640, 213), (40, 720))
save(M, 'miximages')

# ---- video: ~10 s cut from the game's own drone-cam frames ----
picks = ['harborplace', 'aquarium', 'powerplant', 'domino', 'fort']
seqs = [sorted(glob.glob(os.path.join(frames_root, p, '*.jpg'))) for p in picks]
seqs = [q for q in seqs if q]
vdir = os.path.join(tmp, 'v'); os.makedirs(vdir)
n = 0
for q in seqs:
    for fp in q:
        n += 1; shutil.copy(fp, os.path.join(vdir, f'{n:05d}.jpg'))
if n:
    fps = max(1, round(n / 10))
    vd = os.path.join(media, 'videos'); os.makedirs(vd, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(vdir, '%05d.jpg'),
                    '-vf', 'scale=1280:720:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '27',
                    '-r', '30', '-movflags', '+faststart', '-an', os.path.join(vd, f'{NAME}.mp4')], check=True)
    print('video frames', n, 'fps', fps)
shutil.rmtree(tmp)
print('media ->', media)

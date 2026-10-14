# make_short.py [shots|final|all] : portrait captures (short/frames/<beat>/fNNNN.jpg, 1080x1920, no cabinet)
#   -> short/shots/NN.mp4 (per-shot punch-in crop) -> overlays (hook + end card) + music -> shellshock3d-short-9x16.mp4
import os, sys, subprocess, json
from PIL import Image, ImageDraw, ImageFont
R = '/workspace/work/ss3d-trailer/short'
FPS = 30
FONT = '/workspace/work/ss3d-trailer/hfproj/assets/fonts/Anton.ttf'
FONT2 = '/workspace/work/ss3d-trailer/hfproj/assets/fonts/Bungee.ttf'
# (beat, first src frame, n frames, zoom, cx, cy)  - cuts land on the 0.75 s half-bar grid of the 160 BPM score
SHOTS = [
    ('skate',    28, 45, 1.30, 580, 880),   # 0.00 hook: off the ramp
    ('freeflow', 52, 45, 1.45, 520, 1060),   # 1.50 counters / combo
    ('brawl',     0, 45, 1.45, 470, 1060),   # 3.00 (music hit)
    ('van',      44, 23, 1.25, 600, 1000),   # 4.50 drift + hits
    ('roofleap', 30, 45, 1.25, 540, 960),    # 5.25 (hit) rooftop gap jump
    ('manhole',  15, 22, 1.35, 540, 1040),   # 6.75 at the manhole
    ('manhole',  50, 23, 1.30, 600, 1040),   # 7.48 in the sewer
    ('fire',     10, 45, 1.30, 560, 1060),   # 8.25 (hit) burning block
    ('stealth',  24, 45, 1.35, 455, 1040),   # 9.75 takedown
    ('subway',   30, 45, 1.30, 540, 1040),   # 11.25 (hit) train
    ('skate',    78, 23, 1.30, 600, 1000),   # 12.75 kickflip run
    ('daynight',  4, 45, 1.20, 540, 960, 2), # 13.50 riser: day -> night (2x speed)
    ('boss',      0, 23, 1.15, 450, 1040),   # 15.00 (hit) Ramrod charges
    ('van',       0, 22, 1.25, 600, 1000),   # 15.77 party van
    ('freeflow', 92, 23, 1.45, 520, 1060),   # 16.50
    ('boss',     70, 45, 1.50, 470, 1060),   # 17.25 knockdown
    ('fire',     60, 23, 1.30, 560, 1060),   # 18.75 (hit)
    ('brawl',    50, 45, 1.45, 470, 1060),   # 19.50
    ('title',     0, 130, 1.25, 540, 768, 0.5),  # 21.00 (hit) end card: title-screen street (half speed, before START at f76)
]
END_T = sum(s[2] for s in SHOTS[:-1]) / FPS

def shot_path(i): return f'{R}/shots/{i:02d}.mp4'

def render_shot(i, s):
    b, a, n, z, cx, cy = s[:6]; st = s[6] if len(s) > 6 else 1
    d = f'{R}/frames/{b}'
    have = sorted(int(f[1:5]) for f in os.listdir(d) if f.endswith('.jpg'))
    lst = f'{R}/shots/{i:02d}.txt'
    with open(lst, 'w') as fh:
        for k in range(n):
            fr = min(int(a + k * st), have[-1])
            if fr not in have: raise SystemExit(f'missing {b} f{fr}')
            fh.write(f"file '{d}/f{fr:04d}.jpg'\nduration {1/FPS:.6f}\n")
        fh.write(f"file '{d}/f{min(int(a + (n - 1) * st), have[-1]):04d}.jpg'\n")
    w, h = round(1080 / z / 2) * 2, round(1920 / z / 2) * 2
    x = max(0, min(1080 - w, cx - w // 2)); y = max(0, min(1920 - h, cy - h // 2))
    vf = f'crop={w}:{h}:{x}:{y},scale=1080:1920:flags=lanczos,setsar=1,fps={FPS},format=yuv420p'
    subprocess.run(['nice', '-n', '10', 'ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', vf,
                    '-frames:v', str(n), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), shot_path(i)], check=True)
    print('shot', i, b, a, n, st, z, (x, y, w, h), flush=True)

def text_png(path, lines, y0, gap=10):
    """lines: (text, size, fill, font). Centred, thick black stroke + drop shadow, on a transparent 1080x1920 canvas."""
    im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    y = y0
    for text, size, fill, font in lines:
        f = ImageFont.truetype(font, size)
        while dr.textlength(text, font=f) > 960:  # keep inside 60 px side margins
            size -= 4; f = ImageFont.truetype(font, size)
        sw = max(6, size // 12)
        bb = dr.textbbox((0, 0), text, font=f, stroke_width=sw)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        x = (1080 - tw) // 2 - bb[0]
        dr.text((x + 8, y - bb[1] + 10), text, font=f, fill=(0, 0, 0, 170), stroke_width=sw, stroke_fill=(0, 0, 0, 170))
        dr.text((x, y - bb[1]), text, font=f, fill=fill, stroke_width=sw, stroke_fill=(0, 0, 0, 255))
        y += th + gap
    im.save(path); return y

def overlays():
    Y, W, G = (255, 214, 40, 255), (255, 255, 255, 255), (120, 235, 110, 255)
    # hook: top block starts at 12% (230 px), clear of the top 10% UI zone; ends well above the bottom 20%
    yb = text_png(f'{R}/ov_hook.png', [('TONY HAWK', 176, W, FONT), ('MEETS', 96, Y, FONT), ('TMNT ARKHAM', 176, G, FONT),
                                         ('— IN YOUR BROWSER —', 84, W, FONT)], 215, 4)
    # end card: the game's own title logo as rendered in-engine on the title screen (frame f0040, incl. the "3D" badge),
    # enlarged and moved down out of the top UI zone, over a sky-coloured gradient that blends into the title-screen street
    SKY = (10, 8, 16)
    src = Image.open(f'{R}/frames/title/f0040.jpg').convert('RGB').crop((195, 20, 885, 275))
    lw = 966; lh = round(src.height * lw / src.width); src = src.resize((lw, lh), Image.LANCZOS)
    im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0)); px = im.load()
    for yy in range(1000):
        a = 255 if yy < 760 else round(255 * (1000 - yy) / 240)
        for xx in range(1080): px[xx, yy] = SKY + (a,)
    im.alpha_composite(src.convert('RGBA'), ((1080 - lw) // 2, 330)); im.save(f'{R}/ov_logo.png')
    ye = text_png(f'{R}/ov_cta.png', [('PLAY FREE', 150, Y, FONT), ('IN YOUR BROWSER', 104, W, FONT),
                                        ('shellshock-3d.surge.sh', 96, W, FONT)], 1010, 22)
    print('hook bottom', yb, 'cta bottom', ye, '(limit 1536)')

def final():
    overlays()
    n = len(SHOTS); ins = []
    for i in range(n): ins += ['-i', shot_path(i)]
    ins += ['-loop', '1', '-i', f'{R}/ov_hook.png', '-loop', '1', '-i', f'{R}/ov_logo.png', '-loop', '1', '-i', f'{R}/ov_cta.png', '-i', f'{R}/music_raw.wav']
    T = sum(s[2] for s in SHOTS) / FPS
    e = END_T
    fc = ''.join(f'[{i}:v]setsar=1,fps={FPS}[s{i}];' for i in range(n)) + ''.join(f'[s{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[v0];'
    # darken the title footage under the end-card text a touch for legibility
    fc += f"[v0]eq=brightness=-0.10:enable='gte(t,{e + 0.3:.3f})'[v1];"
    fc += f"[{n}:v]format=rgba,fade=t=out:st=2.05:d=0.25:alpha=1,trim=0:{T:.3f}[hk];"
    fc += f"[{n+1}:v]format=rgba,trim=0:{T:.3f}[lg];"  # hard cut on the end hit (a fade ghosted the in-engine logo)
    fc += f"[{n+2}:v]format=rgba,fade=t=in:st={e + 0.3:.3f}:d=0.2:alpha=1,trim=0:{T:.3f}[ct];"
    fc += f"[v1][hk]overlay=0:0:enable='lt(t,2.31)'[v2];[v2][lg]overlay=0:0:enable='gte(t,{e:.3f})'[v3];[v3][ct]overlay=0:0:enable='gte(t,{e:.3f})',format=yuv420p[v];"
    fc += f'[{n+3}:a]atrim=0:{T:.3f},volume=-4.69dB,aresample=48000[a]'
    out = '/tmp/shellshock3d-short-9x16.mp4'  # encode on local disk (faststart rewrite hit I/O errors on the workspace FS), then copy
    subprocess.run(['nice', '-n', '10', 'ffmpeg', '-y', '-v', 'error', *ins, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{T:.3f}',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS),
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
    import shutil; shutil.copyfile(out, f'{R}/shellshock3d-short-9x16.mp4'); print('wrote', f'{R}/shellshock3d-short-9x16.mp4', T, 's')

if __name__ == '__main__':
    os.makedirs(f'{R}/shots', exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    only = [int(x) for x in sys.argv[2:]]
    if what in ('shots', 'all'):
        for i, s in enumerate(SHOTS):
            if only and i not in only: continue
            if not only and os.path.exists(shot_path(i)): continue
            render_shot(i, s)
    if what == 'overlays': overlays()
    if what in ('final', 'all'): final()

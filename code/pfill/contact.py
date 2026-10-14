import os
from PIL import Image, ImageDraw, ImageFont
B, A = '/workspace/work/pfill/before', '/workspace/work/pfill/after'
def pick(*c):
    for f in c:
        if os.path.exists(f): return f
    return None
G = [('shell-shock-live', 'SS Live'), ('shell-shock-16bit', 'SS 16-Bit'), ('bakeoff-a-free', 'A Free'), ('bakeoff-b-paper', 'B Paper'),
     ('bakeoff-c-gta', 'C GTA'), ('bakeoff-d-skyline', 'D Skyline'), ('bakeoff-e-gta32', 'E GTA32'), ('bakeoff-f-free16', 'F Free16'),
     ('bakeoff-g-hd2d', 'G HD-2D'), ('bakeoff-h-iso', 'H Iso'), ('knockout', 'Knockout'), ('hollow-manor', 'Hollow Manor'),
     ('rta-barrel-climb', 'Barrel Climb'), ('rta-pipe-pests', 'Pipe Pests'), ('rta-ring-rush', 'Ring Rush'), ('rta-gem-columns', 'Gem Columns'),
     ('rta-balloon-brawl', 'Balloon Brawl'), ('rta-turbo-coast', 'Turbo Coast'), ('rta-duck-shoot', 'Duck Shoot')]
pairs = []
for i, t in G:
    pairs.append(('demo: ' + t, B + '/demo-' + i + '.png', pick(A + '/demo2-' + i + '.png', A + '/demo-' + i + '.png')))
for i, t in [('bakeoff-a-free', 'A Free'), ('shell-shock-16bit', 'SS 16-Bit'), ('knockout', 'Knockout'), ('hollow-manor', 'Hollow Manor'), ('rta-barrel-climb', 'Barrel Climb'), ('rta-turbo-coast', 'Turbo Coast')]:
    pairs.append(('standalone: ' + t, B + '/' + i + '.png', pick(A + '/' + i + '-p.png', A + '/sa-' + i + '.png')))
for i, t in [('bakeoff-i-cel', 'I Cel (already fills)'), ('crystal-cave', 'Crystal Cave (already fills)')]:
    pairs.append(('demo: ' + t, B + '/demo-' + i + '.png', B + '/demo-' + i + '.png'))
TW, TH, LB, PER = 180, 390, 30, 4
cols = PER * 2
rows = (len(pairs) + PER - 1) // PER
S = Image.new('RGB', (cols * TW + (PER - 1) * 12, rows * (TH + LB) + 40), (24, 24, 28))
d = ImageDraw.Draw(S)
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13); FT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
except Exception: F = FT = ImageFont.load_default()
d.text((10, 8), "Portrait fill at 390x844 - each pair: BEFORE (left) | AFTER (right)", fill=(255, 210, 60), font=FT)
for k, (lab, b, a) in enumerate(pairs):
    r, c = divmod(k, PER)
    x0, y0 = c * (2 * TW + 12), 40 + r * (TH + LB)
    d.text((x0 + 4, y0 + 2), lab, fill=(255, 255, 255), font=F)
    for j, f in enumerate((b, a)):
        if f and os.path.exists(f):
            im = Image.open(f).convert('RGB').resize((TW, TH))
            S.paste(im, (x0 + j * TW, y0 + LB - 8))
        d.text((x0 + j * TW + 4, y0 + LB - 6), 'BEFORE' if j == 0 else 'AFTER', fill=(255, 80, 80) if j == 0 else (90, 255, 120), font=F)
S.save('/workspace/work/demos/shot-portrait-fill.png', optimize=True)
print(S.size, len(pairs))

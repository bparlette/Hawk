# python3 mkthumbs.py <sprdir> : pack the baked landmark renders (from mkthumbs.js) into site/fmthumbs.webp + src/07a_fmthumbs.js
import json, sys
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else 'T/fm3/spr'
meta = json.load(open(d + '/meta.json'))
HD = {'powerplant', 'aquarium', 'science', 'harborplace', 'constellation', 'wtc', 'domino'}
sp = []
for k, m in meta.items():
    im = Image.open(f'{d}/{k}.png').convert('RGBA'); bb = im.getbbox(); assert bb, k + ' blank'
    c = im.crop(bb); mx = 176 if k in HD else 136; s = min(1.0, mx / max(c.size))
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    sp.append(dict(id=k, im=c, ax=(m['ax'] - bb[0]) * s, ay=(m['ay'] - bb[1]) * s, ppm=m['ppm'] * s))
# shelf pack, tallest first, 2 px gutters
sp.sort(key=lambda o: -o['im'].height); AW = 720; x = y = rh = 0
for o in sp:
    w, h = o['im'].size
    if x + w > AW: x = 0; y += rh + 2; rh = 0
    o['x'], o['y'] = x, y; x += w + 2; rh = max(rh, h)
A = Image.new('RGBA', (AW, y + rh), (0, 0, 0, 0))
for o in sp: A.paste(o['im'], (o['x'], o['y']))
A.save('site/fmthumbs.webp', 'WEBP', quality=88, method=6, alpha_quality=100)
js = {o['id']: [o['x'], o['y'], o['im'].width, o['im'].height, round(o['ax'], 1), round(o['ay'], 1), round(o['ppm'], 3)] for o in sp}
open('src/07a_fmthumbs.js', 'w').write('// full-map landmark thumbnails: baked from the game\'s own scene by mkthumbs.js (clipped to each footprint, ortho 3/4 aerial, transparent),\n'
  '// packed by mkthumbs.py into site/fmthumbs.webp. id: [atlas x, y, w, h, ground-centre anchor x, y (sprite px), sprite px per world metre]\n'
  'const FM_THUMBS = ' + json.dumps(js, separators=(',', ':')) + ';\n')
print(A.size, sum(1 for _ in sp), 'sprites')

#!/usr/bin/env python3
# fleet_sheet.py — the baked fleet at TRUE PHONE SIZE (game @2x: 1 world unit = 2 px) on painted asphalt,
# beside two of Palm City's stock cars for scale, at three headings — the "instantly recognisable?" check.
#   python3 tools/fleet_sheet.py [out.png]         (from games/laurel-fulton/) default shots/fleet-gamescale.png
import json, os, sys
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PC = os.path.join(ROOT, '..', 'palm-city', 'assets')
F = json.load(open(os.path.join(ROOT, 'assets', 'fleet.json')))
PM = json.load(open(os.path.join(PC, 'manifest.json')))['cars']
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'shots', 'fleet-gamescale.png')
def frame(path, k, cols=8, n=32):
    im = Image.open(path).convert('RGBA'); fw = im.width // cols; fh = im.height // ((n + cols - 1) // cols)
    r, c = divmod(k, cols); return im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
ORDER = ['camaro_brad', 'camaro_clayton', 'cavalier_kosack', 'cavalier_black', 'astro_jimmy', 'astro_billy', 'camry_jason', 'tracer_zack', 'celica_rigg', 'brougham_grant']
items = [(n, os.path.join(ROOT, 'assets', F[n]['color']['file'])) for n in ORDER if n in F] + [('palm: sedan', os.path.join(PC, PM['sedan_coral']['color']['file'])), ('palm: van', os.path.join(PC, PM['van_sky']['color']['file']))]
HEAD = [24, 0, 4]                       # north, east, a diagonal (game heading k * 360/32 deg, 0 = east)
fw = Image.open(items[0][1]).width // 8
sheet = Image.new('RGB', (len(items) * fw, 3 * fw + 18), (78, 76, 74)); d = ImageDraw.Draw(sheet)
for i, (n, p) in enumerate(items):
    d.text((i * fw + 3, 3), n[:18], fill=(255, 236, 190))
    for r, k in enumerate(HEAD):
        f = frame(p, k); sheet.paste(f, (i * fw, 18 + r * fw), f)
sheet.save(out); print('wrote', out, sheet.size)

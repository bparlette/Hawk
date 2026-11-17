#!/usr/bin/env python3
# sheet.py — side-by-side contact sheet with labels, for judging captures (before/after, opening vs new area).
#   python3 tools/look/sheet.py out.png a.png b.png [c.png ...] [--h 860]
# Each image is scaled to the same height and labelled with its file name (minus shots/ and .png).
import sys, os
from PIL import Image, ImageDraw
argv = sys.argv[1:]
H = 860
if '--h' in argv: i = argv.index('--h'); H = int(argv[i + 1]); del argv[i:i + 2]
a = argv
out, ims = a[0], [Image.open(p).convert('RGB') for p in a[1:]]
ims = [im.resize((round(im.width * H / im.height), H)) for im in ims]
W = sum(im.width for im in ims) + 12 * (len(ims) - 1)
sheet = Image.new('RGB', (W, H + 30), (20, 12, 32)); d = ImageDraw.Draw(sheet); x = 0
for p, im in zip(a[1:], ims):
    sheet.paste(im, (x, 30)); d.text((x + 6, 8), os.path.basename(p)[:-4], fill=(255, 220, 140)); x += im.width + 12
sheet.save(out); print('wrote', out, sheet.size)

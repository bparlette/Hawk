# python3 mkprev.py <slug> <ref.jpg> <day.png> <night.png> : ref | HD day | HD night side by side (ref is a modelling reference, preview only)
import sys
from PIL import Image, ImageDraw
slug, ref, day, night = sys.argv[1:5]
H = 620
ims = [Image.open(p).convert('RGB') for p in (ref, day, night)]
ims = [im.resize((int(im.width * H / im.height), H)) for im in ims]
W = sum(i.width for i in ims) + 40
out = Image.new('RGB', (W, H + 60), (24, 22, 30)); x = 10; d = ImageDraw.Draw(out)
for im, lab in zip(ims, ['REFERENCE PHOTO (not in game)', 'HD model - day', 'HD model - night']):
    out.paste(im, (x, 50)); d.text((x + 6, 18), lab, fill=(240, 230, 200)); x += im.width + 10
d.text((W - 330, 18), 'Toad City Baltimore - ' + slug + ' HD v3', fill=(255, 200, 120))
out.save('/workspace/work/toad-city/assets_preview/landmark_%s_hd_v3.png' % slug, optimize=True)
print('saved', slug, out.size)

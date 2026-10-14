# strips.py out.png step beat... : stacked rows of screen-crop thumbs, labelled with frame numbers
import sys, glob, os
from PIL import Image, ImageDraw
out = sys.argv[1]; step = int(sys.argv[2]); beats = sys.argv[3:]
tw, th = 300, 175; cols = 0; rows = []
for b in beats:
    fs = sorted(glob.glob(f'frames/{b}/f*.png'))[::step]; rows.append((b, fs)); cols = max(cols, len(fs))
S = Image.new('RGB', (cols * tw, len(rows) * th)); D = ImageDraw.Draw(S)
for r, (b, fs) in enumerate(rows):
    for k, f in enumerate(fs):
        im = Image.open(f).convert('RGB').crop((554, 83, 1366, 556)).resize((tw, th)); x, y = k * tw, r * th
        S.paste(im, (x, y)); D.rectangle((x, y, x + 80, y + 12), fill='black'); D.text((x + 2, y + 1), b[:6] + ' ' + os.path.basename(f)[1:5], fill='yellow')
S.save(out)

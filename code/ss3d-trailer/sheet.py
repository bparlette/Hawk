import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
fs = sorted(glob.glob(d + '/f*.png'))
if len(sys.argv) > 4: step = int(sys.argv[4]); fs = fs[::step]
tw, th = 480, 270
rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * th), 'black'); D = ImageDraw.Draw(S)
for k, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((tw, th)); x, y = (k % cols) * tw, (k // cols) * th
    S.paste(im, (x, y)); D.text((x + 4, y + 4), os.path.basename(f), fill='yellow')
S.save(out)

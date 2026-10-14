# strip.py beat [step] : full-frame strip (screen crop) every `step` frames with frame numbers -> st_<beat>.png
import sys, glob, os
from PIL import Image, ImageDraw
b = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 6
fs = sorted(glob.glob(f'frames/{b}/f*.png'))[::step]
tw, th = 360, 213; cols = 8; rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * th)); D = ImageDraw.Draw(S)
for k, f in enumerate(fs):
    im = Image.open(f).convert('RGB').crop((554, 83, 1366, 556)).resize((tw, th)); x, y = (k % cols) * tw, (k // cols) * th
    S.paste(im, (x, y)); D.rectangle((x, y, x + 44, y + 14), fill='black'); D.text((x + 3, y + 2), os.path.basename(f)[1:5], fill='yellow')
S.save(f'st_{b}.png'); print(len(fs))

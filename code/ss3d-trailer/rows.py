# rows.py out.png beat... : one row per beat, up to 9 pv frames, small thumbs
import sys, glob
from PIL import Image, ImageDraw
out = sys.argv[1]; beats = sys.argv[2:]; tw, th = 400, 225; cols = 9
S = Image.new('RGB', (cols * tw + 120, len(beats) * th), 'black'); D = ImageDraw.Draw(S)
for r, b in enumerate(beats):
    fs = sorted(glob.glob(f'frames/pv_{b}/f*.png'))
    if len(fs) > cols: fs = [fs[round(i * (len(fs) - 1) / (cols - 1))] for i in range(cols)]
    D.text((4, r * th + 100), b, fill='yellow')
    for k, f in enumerate(fs):
        im = Image.open(f).convert('RGB').crop((440, 0, 1480, 640)).resize((tw, int(640 * tw / 1040)))
        S.paste(im, (120 + k * tw, r * th)); D.text((124 + k * tw, r * th + 2), f[-9:-4], fill='white')
S.save(out)

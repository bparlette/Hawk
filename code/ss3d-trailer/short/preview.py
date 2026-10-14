# preview.py i [i...] : for each shot, first/mid/last source frames with the crop box drawn -> /tmp/pv_<i>.jpg
import sys, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from make_short import SHOTS, R
for i in map(int, sys.argv[1:]):
    b, a, n, z, cx, cy = SHOTS[i]
    d = f'{R}/frames/{b}'
    have = sorted(int(f[1:5]) for f in os.listdir(d) if f.endswith('.jpg'))
    w, h = round(1080 / z / 2) * 2, round(1920 / z / 2) * 2
    x = max(0, min(1080 - w, cx - w // 2)); y = max(0, min(1920 - h, cy - h // 2))
    ks = [a, a + n // 3, a + 2 * n // 3, a + n - 1]
    im = Image.new('RGB', (270 * len(ks), 480))
    for j, k in enumerate(ks):
        k = min(k, have[-1]); t = Image.open(f'{d}/f{k:04d}.jpg'); t.draft('RGB', (540, 960)); t = t.convert('RGB').resize((270, 480))
        ImageDraw.Draw(t).rectangle([x / 4, y / 4, (x + w) / 4, (y + h) / 4], outline=(255, 40, 40), width=2)
        im.paste(t, (270 * j, 0))
    im.save(f'/tmp/pv_{i}.jpg', quality=85); print(i, b, ks)

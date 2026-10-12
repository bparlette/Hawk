# G: pixel-art versions of the city's painted textures (downscale + adaptive palette, no dither) -> px/tex/*.png (nearest-filtered in game)
from PIL import Image
import os
SRC = '/workspace/work/ss3d-bakeoff/site/tex/'; OUT = '/workspace/work/ss3d-bakeoff/g_hd2d/px/tex/'
os.makedirs(OUT, exist_ok=True)
J = {  # name: (scale, colours)
  'asphalt.jpg': (0.25, 24), 'sidewalk.jpg': (0.25, 24), 'roof.jpg': (0.25, 24),
  'facade_a.jpg': (0.5, 64), 'facade_b.jpg': (0.5, 64), 'mural_pizza.jpg': (0.5, 64), 'mural_gator.jpg': (0.5, 64),
  'skyline.jpg': (0.5, 64), 'taxi_side.webp': (0.5, 48), 'van_side.webp': (0.5, 48), 'props2.webp': (1, 32),
}
for n, (k, nc) in J.items():
    im = Image.open(SRC + n).convert('RGBA'); w, h = im.size
    sm = im.resize((max(8, round(w * k)), max(8, round(h * k))), Image.LANCZOS)
    a = sm.getchannel('A')
    rgb = sm.convert('RGB').quantize(colors=nc, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    if n.endswith('.webp'):
        a = a.point(lambda v: 255 if v > 110 else 0); rgb.putalpha(a); out = rgb
    else: out = rgb
    base = os.path.splitext(n)[0] + '.png'
    out.save(OUT + base, optimize=True); print(base, out.size, os.path.getsize(OUT + base))

from kit import *
import numpy as np
pr = key('gen/l9_props.png'); C = comps(pr, 1500)
get = lambda x, y=None: cut(pr, next(c for c in C if abs(c[0]-x) < 10 and (y is None or abs(c[1]-y) < 20)))
dirt, arrow, stakes, smoke, small, bomb = get(47, 341), get(51, 100), get(883), get(955), get(1494), get(1537)
ship = trim(key('gen/l9_ship.png'))
# masts are cut by the frame top: fade the top 14% into the night
a = np.array(ship).astype(np.float32); h = a.shape[0]; f = np.clip(np.arange(h) / (h * 0.14), 0, 1)
a[..., 3] *= f[:, None]; ship = Image.fromarray(a.astype(np.uint8), 'RGBA')
parts = [('ship', fit(ship, 300)), ('stakes', fit(stakes, 130)), ('small', fit(small, 104)), ('dirt', fit(dirt, 150)),
         ('smoke', fit(smoke, 96)), ('arrow', fit(arrow, 90)), ('bomb', fit(bomb, 36))]
place, sheet = pack(parts, 512, 'level9_props.png')
preview(sheet, 'view/pack9.jpg')
from PIL import Image
Image.open('gen/l9_sea.png').convert('RGB').resize((768, 448), Image.LANCZOS).save('level9_sea.jpg', quality=84, optimize=True)
json.dump(place, open('meta9.json', 'w'))
print(place, sheet.size)

from kit import *
import numpy as np
from PIL import ImageEnhance
def sheet(n):
    im = key(f'gen/l11_{n}.png'); C = comps(im, 1500)
    return lambda x, y=None: cut(im, next(c for c in C if abs(c[0]-x) < 12 and (y is None or abs(c[1]-y) < 25)))
a, b, c = sheet('a'), sheet('b'), sheet('c')
car, door, tower, coal = a(46), a(843), a(1109), a(1400)
cliff, pillar, beam, pipe = b(38), b(732), b(915, 171), b(921, 302)
weed, crate, rock, hat, coup = c(31), c(439), c(857), c(1355, 71), c(1346, 297)
beam = trim(beam.crop((0, 0, int(beam.width * 0.42), beam.height)))
def tone(im, k, sat=1.0):
    a_ = np.array(im).astype(np.float32); l = a_[..., :3].mean(-1, keepdims=True)
    a_[..., :3] = (l + (a_[..., :3] - l) * sat) * k; return Image.fromarray(a_.clip(0, 255).astype(np.uint8), 'RGBA')
hat = fit(hat, 40)
parts = [('car', fit(car, 372)), ('cliff', fit(cliff, 300)), ('tower', fit(tower, 96)), ('pillar', fit(pillar, 40)),
         ('door', fit(door, 70)), ('coal', fit(coal, 200)), ('pipe', fit(pipe, 180)), ('beam', fit(beam, 120)),
         ('weed', fit(weed, 40)), ('crate', fit(crate, 60)), ('rock', fit(rock, 104)), ('coup', fit(coup, 44)),
         ('hat', hat), ('hatK', tone(hat, 0.42, 0.6)), ('hatT', tone(hat, 1.3, 0.8))]
place, sh = pack(parts, 720, 'level11_props.png')
preview(sh, 'view/pack11.jpg', k=1)
place['_doorway'] = [145, 32, 89, 123]  # measured on the 372x169 car frame
json.dump(place, open('meta11.json', 'w')); print(place, sh.size)

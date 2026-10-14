# post: mild contrast/darken so the pale parka reads on the snow; re-quantize. (run after pack.py + nozzle step)
from PIL import Image; import numpy as np, os
a=np.array(Image.open('cf_rgba.png')).astype(np.float32)
rgb=a[...,:3]; rgb=(rgb-128)*1.12+116; a[...,:3]=rgb
Image.fromarray(a.clip(0,255).astype(np.uint8)).save('cf_rgba_fixed.png')
Image.open('cf_rgba_fixed.png').quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG).save('level6_coldfront.png',optimize=True)
print(os.path.getsize('level6_coldfront.png'))

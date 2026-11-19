#!/usr/bin/env python3
"""render_stack_test.py — composite a car's stack at any angle in pure PIL,
the same way src/lf_stack.js will draw it on canvas: silhouette shadow,
then layers bottom-to-top, each rotated by the heading and offset by
(z * LIFT). Produces a contact strip + a 360 GIF for the Camaro proof."""
import json, math, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIFT = (-0.097, -0.329)        # wu per layer for camaro_brad — mirrors lf_stack.js's derivation: computeStackProjection(55°, 1.0).zStep ≈ 0.66 raster px × (48.8 wu / 98 px), lean ratio 0.294
WU = 10.0                      # world units per metre in the draw (fleet length/width are in wu)

def load_stack(model):
    man = json.load(open(os.path.join(ROOT, 'assets', 'stacks.json')))[model]
    sheet = Image.open(os.path.join(ROOT, 'assets', man['file'])).convert('RGBA')
    lw, lh, cols = man['lw'], man['lh'], man['cols']
    layers = []
    for i in range(man['layers']):
        layers.append(sheet.crop(((i % cols) * lw, (i // cols) * lh, (i % cols + 1) * lw, (i // cols + 1) * lh)))
    sil = Image.new('RGBA', (lw, lh), (20, 16, 42, 255))
    sil.putalpha(layers[0].split()[3])
    return man, layers, sil

def render(man, layers, sil, heading_deg, scale=6, bg=(58, 74, 46, 255)):
    """heading: 0 = nose east(+x), clockwise (y south) like the game."""
    Lwu, Wwu = man['length'], man['width']
    cw = int(150 * scale / 6 * 2)
    canvas = Image.new('RGBA', (cw, cw), bg)
    cx, cy = cw / 2, cw / 2
    h = math.radians(heading_deg)
    def place(img, x, y, alpha=255):
        # draw img (lw x lh px = L x W metres) scaled to Lwu x Wwu wu at `scale` px per wu, rotated by h
        wpx, hpx = int(Lwu * scale), int(Wwu * scale)
        r = img.resize((wpx, hpx), Image.NEAREST).rotate(-heading_deg, resample=Image.NEAREST, expand=True, center=(wpx / 2, hpx / 2))
        if alpha < 255:
            a = r.split()[3].point(lambda v: v * alpha // 255); r.putalpha(a)
        canvas.alpha_composite(r, (int(x * scale - r.width / 2), int(y * scale - r.height / 2)))
    place(sil, cx / scale + 2.2, cy / scale - 1.2, 140)                       # ground shadow
    for i, lay in enumerate(layers):
        place(lay, cx / scale + LIFT[0] * i, cy / scale + LIFT[1] * i)
    return canvas

if __name__ == '__main__':
    model = sys.argv[1] if len(sys.argv) > 1 else 'camaro_brad'
    man, layers, sil = load_stack(model)
    out = os.path.join(ROOT, 'shots', 'stacks'); os.makedirs(out, exist_ok=True)
    angles = [0, 45, 90, 135, 180, 225, 270, 315]
    strip = Image.new('RGBA', (300 * 4, 300 * 2), (40, 40, 50, 255))
    for j, a in enumerate(angles):
        strip.paste(render(man, layers, sil, a), ((j % 4) * 300, (j // 4) * 300))
    strip.save(os.path.join(out, f'{model}_stack_strip.png'))
    frames = [render(man, layers, sil, a) for a in range(0, 360, 10)]
    frames[0].save(os.path.join(out, f'{model}_stack360.gif'), save_all=True, append_images=frames[1:], duration=90, loop=0)
    print('strip + gif ->', out)

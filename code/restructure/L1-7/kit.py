# shared helpers: chroma-green key, connected components, de-fringe, trim, pack (props L9-L13)
import numpy as np, json
from PIL import Image
from scipy import ndimage

def key(path):
    """Key a chroma-green render to RGBA (soft alpha on the edge, green spill clamped)."""
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gs = g - np.maximum(r, b)                 # greenness
    al = np.clip(1 - (gs - 40) / 70, 0, 1)    # >110 greener = fully transparent, <40 = opaque
    al[(g > 150) & (r < 120) & (b < 120)] = 0
    # despill: clamp green to max(r,b)+small where it is greener than the others
    sp = gs > 0
    a[..., 1] = np.where(sp, np.maximum(r, b) + np.minimum(gs, 6), g)
    out = np.dstack([a, al[..., None] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    # erode 1px of the outline halo
    m = ndimage.binary_erosion(out[..., 3] > 30, iterations=1)
    out[..., 3] = np.where(m, out[..., 3], 0)
    return Image.fromarray(out, 'RGBA')

def comps(im, min_area=600, dil=4):
    m = np.array(im)[..., 3] > 40
    lab, k = ndimage.label(ndimage.binary_dilation(m, iterations=dil))
    out = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        area = int((m[s] & (lab[s] == i + 1)).sum())
        if area < min_area: continue
        out.append((s[1].start, s[0].start, s[1].stop, s[0].stop, area))
    return sorted(out)

def cut(im, box):
    """crop a component box and drop pixels of other components inside it"""
    x0, y0, x1, y1 = box[:4]
    c = im.crop((x0, y0, x1, y1))
    a = np.array(c); m = a[..., 3] > 40
    lab, k = ndimage.label(ndimage.binary_dilation(m, iterations=4))
    if k > 1:
        sizes = ndimage.sum(m, lab, range(1, k + 1)); keep = 1 + int(np.argmax(sizes))
        a[..., 3] = np.where(lab == keep, a[..., 3], 0)
    return trim(Image.fromarray(a, 'RGBA'))

def trim(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    return im.crop(bb) if bb else im

def fit(im, w=None, h=None):
    if w: h2 = max(1, round(im.height * w / im.width)); return im.resize((w, h2), Image.LANCZOS)
    w2 = max(1, round(im.width * h / im.height)); return im.resize((w2, h), Image.LANCZOS)

def pack(parts, W, out_png, pad=3, colors=256):
    """parts: list of (name, RGBA image). Shelf-pack into W wide sheet -> P-mode PNG. returns frames {name:[x,y,w,h]}"""
    x = y = rowh = 0; place = {}
    for n, im in parts:
        if x + im.width > W: x = 0; y += rowh + pad; rowh = 0
        place[n] = [x, y, im.width, im.height]; x += im.width + pad; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for n, im in parts: sheet.paste(im, tuple(place[n][:2]))
    sheet.save(out_png.replace('.png', '_rgba.png'))
    q = sheet.quantize(colors, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    q.save(out_png, optimize=True)
    return place, sheet

def preview(sheet, path, bg=(60, 60, 70), k=2):
    b = Image.new('RGBA', sheet.size, bg + (255,)); b.alpha_composite(sheet)
    b = b.convert('RGB'); b = b.resize((b.width * k, b.height * k), Image.NEAREST) if k != 1 else b
    b.save(path, quality=88)

# Zone-2 backgrounds + twist prop sheets for levels 1-7 (restructure phase 1, art only)
# bg: seam-blended (horizontal wrap) JPGs, 512 px tall like the existing levelN_*.jpg; floor band unchanged.
# props: shelf-packed P-mode PNG via kit.pack, sheet px = 2x world px (draw at 0.5), meta in meta.json.
import os, json, numpy as np
from PIL import Image
from scipy import ndimage
from kit import comps, cut, trim, fit, pack, preview

os.makedirs('bg', exist_ok=True); os.makedirs('props', exist_ok=True); os.makedirs('view', exist_ok=True)

def wrap_h(im, ov=96):
    a = np.array(im.convert('RGB')).astype(np.float32); w = a.shape[1]
    out = a[:, :w - ov].copy(); t = np.linspace(0, 1, ov)[None, :, None]
    out[:, :ov] = a[:, w - ov:] * (1 - t) + a[:, :ov] * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

def wrap_v(im, ov=64):
    a = np.array(im.convert('RGB')).astype(np.float32); h = a.shape[0]
    out = a[:h - ov].copy(); t = np.linspace(0, 1, ov)[:, None, None]
    out[:ov] = a[h - ov:] * (1 - t) + a[:ov] * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

BG = {  # out name: (source, crop box or None)
    'level1_lobby.jpg': ('gen/l1_z2.png', None),
    'level2_rooftops.jpg': ('gen/l2_z2c.png', (0, 0, 1820, 512)),   # right end parapet turns toward camera: cropped
    'level3_pumpstation.jpg': ('gen/l3_z2.png', None),
    'level4_tunnel.jpg': ('gen/l4_z2.png', (60, 0, 1780, 512)),   # exit-mouth curve at both ends cropped: tile repeats as straight tunnel
    'level5_shipdeck.jpg': ('gen/l5_z2b.png', None),
    'level6_park.jpg': ('gen/l6_z2.png', None),
    'level7_foundry.jpg': ('gen/l7_z2.png', None),
    'level5_harbour.jpg': ('gen/l5_harbour.png', None),   # twist: scrolling open-water strip behind the boat deck
}
bgmeta = {}
for name, (src, box) in BG.items():
    im = Image.open(src).convert('RGB')
    if box: im = im.crop(box)
    if im.height != 512: im = im.resize((round(im.width * 512 / im.height), 512), Image.LANCZOS)
    im = wrap_h(im)
    im.save('bg/' + name, quality=86, optimize=True); bgmeta[name] = list(im.size)
# proposed one-screen boss arenas for the two levels that have none (L2, L4), 1032x512 like the other *_boss.jpg
for n, nm in ((2, 'level2_rooftop_boss.jpg'), (4, 'level4_tunnel_boss.jpg')):
    a = Image.open(f'gen/l{n}_arena.png').convert('RGB').resize((1032, 512), Image.LANCZOS)
    a.save('bg/' + nm, quality=86, optimize=True); bgmeta[nm] = list(a.size)
# L7 twist: vertical shaft wall for the falling-elevator fight (tiles vertically)
sh = Image.open('gen/l7_shaft.png').convert('RGB'); sh = sh.resize((1032, round(sh.height * 1032 / sh.width)), Image.LANCZOS)
sh = wrap_v(sh); sh.save('bg/level7_shaft.jpg', quality=86, optimize=True); bgmeta['level7_shaft.jpg'] = list(sh.size)

def despill(im):
    a = np.array(im).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = np.maximum(r, b)
    a[..., 1] = np.where(g > mx + 10, mx + 6, g); return Image.fromarray(a.clip(0, 255).astype(np.uint8))
def key_mag(path):
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mg = np.minimum(r, b) - g; al = np.clip(1 - (mg - 30) / 80, 0, 1)
    sp = mg > 0; a[..., 0] = np.where(sp, np.minimum(r, g + 20), r); a[..., 2] = np.where(sp, np.minimum(b, g + 20), b)
    m = ndimage.binary_erosion(al > 0.12, iterations=1); al = np.where(m, al, 0)
    return trim(Image.fromarray(np.dstack([a, al[..., None] * 255]).clip(0, 255).astype(np.uint8), 'RGBA'))
def load(p): return despill(Image.open(p).convert('RGBA'))
def pick(im, x, y, C):
    return cut(im, next(c for c in C if abs(c[0] - x) < 15 and abs(c[1] - y) < 25))
def region(im, box): return trim(im.crop(box))
def rot(im, deg): return trim(im.rotate(deg, expand=True, resample=Image.BICUBIC))

meta = {}
def sheet(lv, parts, W):
    place, sh = pack(parts, W, f'props/level{lv}_twist.png')
    preview(sh, f'view/pack{lv}.jpg', k=1); meta[f'level{lv}_twist.png'] = {'size': list(sh.size), 'scale': 'sheet px = 2x world px', 'frames': place}

# L1 collapsing floor
im = load('gen/l1_tw.png'); C = comps(im, 1500)
sheet(1, [('hole', fit(pick(im, 13, 102, C), 240)), ('crack', fit(pick(im, 1188, 207, C), 240)), ('beam', fit(pick(im, 637, 32, C), 220)),
          ('debris', fit(region(im, (740, 220, 1140, 480)), 140)), ('door', fit(pick(im, 1794, 58, C), h=220))], 760)
# L2 searchlight climb
im = despill(load('gen/l2_tw.png')); C = comps(im, 1500)
sheet(2, [('heli', fit(pick(im, 51, 24, C), 400)), ('lamp', fit(pick(im, 1012, 157, C), 60)), ('escape', fit(pick(im, 1231, 24, C), h=240)),
          ('hatch', fit(pick(im, 1596, 151, C), 100))], 760)
# L3 flood escape
im = Image.open('gen/l3_tw.png').convert('RGBA'); C = comps(im, 1500); wv = Image.open('gen/l3_wave.png').convert('RGBA')  # no despill: the water is meant to be green
sheet(3, [('wave', fit(trim(wv), 768)), ('gateShut', fit(pick(im, 427, 21, C), 220)), ('gush', fit(key_mag('gen/l3_gush.png'), 260)), ('frame', fit(pick(im, 22, 35, C), 220)),
          ('raft', fit(pick(im, 26, 356, C), 100)), ('drum', fit(pick(im, 327, 359, C), 40)), ('ladder', fit(rot(pick(im, 488, 377, C), 90), h=160))], 1024)
# L4 turret truck
im = load('gen/l4_tw.png'); C = comps(im, 1500)
sheet(4, [('truckGun', fit(pick(im, 21, 12, C), 340)), ('truck', fit(pick(im, 738, 49, C), 340)), ('turret', fit(pick(im, 785, 292, C), 140)),
          ('spray', fit(pick(im, 1445, 49, C), 200))], 720)
# L5 harbour boat chase
im = load('gen/l5_tw.png'); C = comps(im, 1500)
sheet(5, [('boat', fit(pick(im, 21, 11, C), 600)), ('wake', fit(pick(im, 169, 384, C), 600)), ('jetski', fit(pick(im, 1015, 126, C), 140)),
          ('bow', fit(pick(im, 1461, 145, C), 120)), ('buoy', fit(pick(im, 1734, 115, C), h=110)), ('deck', fit(trim(despill(Image.open('gen/l5_deck.png').convert('RGBA'))), 720))], 760)
# L6 thin-ice run
im = load('gen/l6_tw_clean.png'); C = comps(im, 1500)
sheet(6, [('ice0', fit(pick(im, 20, 30, C), 180)), ('ice1', fit(pick(im, 590, 33, C), 180)), ('ice2', fit(pick(im, 23, 296, C), 180)), ('ice3', fit(pick(im, 603, 296, C), 180)),
          ('slide', fit(pick(im, 1137, 25, C), h=200)), ('drift', fit(pick(im, 1505, 33, C), 120)), ('sawhorse', fit(pick(im, 1628, 307, C), 60))], 760)
# L7 falling freight elevator
im = despill(load('gen/l7_tw.png')); C = comps(im, 1500)
sheet(7, [('lift', fit(pick(im, 25, 10, C), 600)), ('brake', fit(pick(im, 1086, 179, C), 80)), ('cube', fit(pick(im, 1382, 212, C), 100)),
          ('hook', fit(pick(im, 1514, 0, C), h=100)), ('sparks', fit(pick(im, 1806, 224, C), 100))], 760)

json.dump({'bg': bgmeta, 'props': meta}, open('meta.json', 'w'), indent=1)
print(json.dumps(bgmeta)); [print(k, v['size']) for k, v in meta.items()]

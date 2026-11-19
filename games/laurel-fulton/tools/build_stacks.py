#!/usr/bin/env python3
"""build_stacks.py — sprite-stack sheets for the Laurel/Fulton fleet.

Reads the SAME parametric car definitions Blender bakes from
(tools/bake_fleet.py's CARS dict: plan / top / belt / cabin / gw / paint /
lights / ...) and rasterises each car into a stack of horizontal
cross-section layers, using the bake's own surface math (hw, gwf, z_at,
region) so a stack is the same car as its baked sheet — just with height.

  python3 tools/build_stacks.py [car ...]        (from games/laurel-fulton/)

Outputs:
  assets/cars/stack_<model>.webp   layer sheet (grid, bottom layer first)
  assets/stacks.json               manifest the runtime (src/lf_stack.js) reads
  shots/stacks/<model>_side.png    QA: the side profile the stack was cut from
  shots/stacks/<model>_top.png     QA: top-slice composite (≈ baked frame 0)

No AI imagery, no Blender: pure rasterisation of the fleet's own data.
Pixel scale matches the bake: 20 px per metre. One layer per 0.05 m.
"""
import ast, json, math, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # games/laurel-fulton/
PPM = 20.0                                         # px per metre (the bake's scale)
DZ = 0.05                                          # one layer per 0.05 m of height
Z0 = 0.22                                          # underbody / skirt bottom (bake skirt: 0.28)
COLS = 8                                           # sheet grid columns (fleet parity)

# ---------------------------------------------------------------- the bake's math, verbatim
def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def interp(pts, t):
    if t <= pts[0][0]: return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1: return v0 + (v1 - v0) * smooth((t - t0) / max(1e-6, t1 - t0))
    return pts[-1][1]

def safe_eval(node):
    if isinstance(node, ast.Constant): return node.value
    if isinstance(node, ast.Dict): return {safe_eval(k): safe_eval(v) for k, v in zip(node.keys, node.values)}
    if isinstance(node, (ast.List, ast.Tuple)): return type(node) is ast.Tuple and tuple(safe_eval(e) for e in node.elts) or [safe_eval(e) for e in node.elts]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub): return -safe_eval(node.operand)
    if isinstance(node, ast.Call) and getattr(node.func, 'id', '') == 'dict':
        return {kw.arg: safe_eval(kw.value) for kw in node.keywords}
    raise ValueError(f'unsupported node in CARS: {ast.dump(node)[:80]}')

def load_cars():
    src = open(os.path.join(HERE, 'bake_fleet.py')).read()
    tree = ast.parse(src)
    cars = None
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], 'id', '') == 'CARS':
            cars = safe_eval(node.value)
    assert cars, 'CARS dict not found in bake_fleet.py'
    for k, v in list(cars.items()):                # the bake's base-inheritance, verbatim
        if 'base' in v:
            b = dict(cars[v['base']]); b.update({kk: vv for kk, vv in v.items() if kk != 'base'}); cars[k] = b
    return cars

def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))

GLASS = hx('#141a2a'); TRIM = hx('#1d1c22'); TYRE = hx('#141317'); TAIL = hx('#b3101f')
CHROME = (209, 209, 214); GREY = hx('#5d5f63'); UNDER = hx('#17171c'); INNER = hx('#0e0e14')

def shade(col, f):
    return tuple(max(0, min(255, round(v * f))) for v in col)

# ---------------------------------------------------------------- one car -> layers
def build_stack(name, c):
    L, W = c['L'], c['W']
    Lpx, Wpx = int(round(L * PPM)), int(round(W * PPM))
    cs = c['cabin']; belt = c['belt']
    paint = hx(c['paint']); paint2 = hx(c.get('paint2') or c['paint'])
    vinyl = hx(c.get('vinyl', '#20202a')); head = hx(c['lights']['head'])
    mats = {'paint': paint, 'paint2': paint2, 'glass': GLASS, 'vinyl': vinyl, 'trim': TRIM, 'chrome': CHROME}
    bump = {'chrome': CHROME, 'black': TRIM, 'grey': GREY, 'body': paint}[c['bumpers']]
    bumpR = paint2 if c['bumpers'] == 'body' else bump
    wb = {'brougham_grant': 3.10, 'astro_jimmy': 2.82, 'astro_billy': 2.82}.get(name, 2.55 if L > 4.4 else 2.45)
    axles = (0.5 - wb / (2 * L) - 0.02, 0.5 + wb / (2 * L) - 0.02)   # s of front / rear axle

    def hw(s): return W / 2 * interp(c['plan'], s)
    def gwf(s): return c['gw'][0] + (c['gw'][1] - c['gw'][0]) * smooth((s - cs[0]) / max(1e-6, cs[3] - cs[0]))
    def z_at(u, s):
        top = interp(c['top'], s)
        incab = cs[0] - 0.01 <= s <= cs[3] + 0.01
        if incab and top > belt:
            g = gwf(s); k = smooth((abs(u) - g) / 0.07); top = top * (1 - k) + belt * k
        top -= 0.035 * u * u
        edge = smooth((abs(u) - 0.86) / 0.14)
        return top - edge * (top - 0.35) * 0.55
    def region(u, s):
        top = interp(c['top'], s)
        incab = cs[0] <= s <= cs[3] and abs(u) < gwf(s) and top > belt + 0.02
        if incab:
            if s < cs[1] or s > cs[2]: return 'glass'
            roof = c.get('roof')
            if roof == 'ttop' and 0.12 < abs(u) < gwf(s) - 0.08 and cs[1] + 0.02 < s < cs[1] + (cs[2] - cs[1]) * 0.62: return 'glass'
            if roof == 'landau' and s > cs[1] + (cs[2] - cs[1]) * 0.42: return 'vinyl'
            if abs(u) > gwf(s) - 0.06: return 'glass'
        if c.get('paint2') and s > c.get('split', 0.5): return 'paint2'
        return 'paint'

    # grid: ix along length (front at RIGHT: s = 1 - (ix+.5)/Lpx), iy across (x_m from -W/2)
    S = [[1 - (ix + 0.5) / Lpx for ix in range(Lpx)]]
    top_z = [[0.0] * Wpx for _ in range(Lpx)]
    maxtop = 0.0
    for ix in range(Lpx):
        s = 1 - (ix + 0.5) / Lpx
        hws = hw(s)
        for iy in range(Wpx):
            xm = (iy + 0.5) / PPM - W / 2
            if abs(xm) > hws: continue
            z = z_at(xm / hws, s); top_z[ix][iy] = z; maxtop = max(maxtop, z)
    deck = z_at(0, 0.94) if c.get('spoiler') else 0
    nlayers = int(math.ceil((maxtop + 0.10 - Z0) / DZ)) + 1

    def is_wheel(s, xm, zc):
        if zc > 0.64 or abs(abs(xm) - (W / 2 - 0.13)) > 0.135: return False
        return any(abs(s - a) * L <= 0.30 for a in axles)

    layers = []
    for i in range(nlayers):
        zbot = Z0 + i * DZ; zc = zbot + DZ / 2
        img = Image.new('RGBA', (Lpx, Wpx), (0, 0, 0, 0))
        px = img.load()
        filled = [[False] * Wpx for _ in range(Lpx)]
        for ix in range(Lpx):
            s = 1 - (ix + 0.5) / Lpx; hws = hw(s)
            for iy in range(Wpx):
                xm = (iy + 0.5) / PPM - W / 2
                if abs(xm) > hws: continue
                u = xm / hws
                fill = top_z[ix][iy] >= zbot + 0.001
                if not fill and c.get('spoiler') and 0.895 <= s <= 0.96 and abs(xm) <= W * 0.41 and deck + 0.02 <= zbot <= deck + 0.10: fill = True
                if fill: filled[ix][iy] = True
        for ix in range(Lpx):
            s = 1 - (ix + 0.5) / Lpx; hws = hw(s)
            for iy in range(Wpx):
                if not filled[ix][iy]: continue
                xm = (iy + 0.5) / PPM - W / 2; u = xm / hws if hws else 0
                wheel = is_wheel(s, xm, zc)
                is_top = not (top_z[ix][iy] >= zbot + DZ + 0.001) and not (c.get('spoiler') and 0.895 <= s <= 0.96 and abs(xm) <= W * 0.41 and zbot < deck + 0.10 - DZ)
                if wheel: col = TYRE
                elif i == 0: col = UNDER
                elif is_top:
                    col = mats[region(u, s)]
                    hs = c['lights']['head_shape']; ts = c['lights']['tail']
                    if s <= 0.045:      # nose band: headlights on the top slice
                        if hs == 'popup': col = TRIM if 0.18 <= abs(u) <= 0.48 else col
                        elif hs == 'round': col = head if 0.26 <= abs(u) <= 0.40 else col
                        else: col = head if 0.18 <= abs(u) <= 0.48 else col
                    if s >= 0.965:      # tail band
                        if ts == 'fullwidth': col = TAIL
                        elif ts == 'vertical': col = TAIL if abs(u) >= 0.74 else col
                        else: col = TAIL if 0.20 <= abs(u) <= 0.50 else col
                    if c.get('ornament') and 0.03 <= s <= 0.07 and abs(u) < 0.05: col = CHROME
                    if c.get('spoiler') and 0.895 <= s <= 0.96 and abs(xm) <= W * 0.41 and zbot >= deck: col = paint2
                else:
                    incab = cs[0] <= s <= cs[3]
                    if incab and zc > belt + 0.01:
                        col = GLASS if abs(u) >= gwf(s) - 0.13 else INNER
                    elif c.get('chrome_trim') and abs(zc - belt) <= 0.035: col = CHROME
                    elif zc < 0.62 and s <= 0.028: col = bump
                    elif zc < 0.62 and s >= 0.972: col = bumpR
                    else:
                        base = paint2 if (c.get('paint2') and s > c.get('split', 0.5)) else paint
                        col = shade(base, 0.80 + 0.20 * (zc / max(maxtop, 0.01)))
                per = not (ix + 1 < Lpx and filled[ix + 1][iy]) or not (ix > 0 and filled[ix - 1][iy]) or not (iy + 1 < Wpx and filled[ix][iy + 1]) or not (iy > 0 and filled[ix][iy - 1])
                if per and i > 0: col = shade(col, 0.88)
                px[ix, iy] = (col[0], col[1], col[2], 255)
        layers.append(img)

    # ---- QA views: side profile + top composite
    Hpx = int(math.ceil((maxtop + 0.15) * PPM))
    side = Image.new('RGBA', (Lpx, Hpx), (24, 22, 34, 255)); sp = side.load()
    for ix in range(Lpx):
        s = 1 - (ix + 0.5) / Lpx
        zt = z_at(0, s)
        for iz in range(Hpx):
            z = (Hpx - iz - 0.5) / PPM
            if z > zt + 0.001: continue
            incab = cs[0] <= s <= cs[3]
            if incab and z > belt + 0.01: col = GLASS
            elif any(abs(s - a) * L <= 0.33 and z <= 0.66 and abs(z - 0.33) <= math.sqrt(max(0.0, 0.33 ** 2 - (abs(s - a) * L) ** 2)) + 0.001 for a in axles): col = TYRE
            else: col = paint2 if (c.get('paint2') and s > c.get('split', 0.5)) else paint
            sp[ix, iz] = (col[0], col[1], col[2], 255)
    topimg = Image.new('RGBA', (Lpx, Wpx), (0, 0, 0, 0))
    for img in layers: topimg.alpha_composite(img)
    return layers, side, topimg, maxtop

def main():
    cars = load_cars()
    fleet = json.load(open(os.path.join(ROOT, 'assets', 'fleet.json')))
    want = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(fleet.keys())
    out_dir = os.path.join(ROOT, 'assets', 'cars'); shots = os.path.join(ROOT, 'shots', 'stacks')
    os.makedirs(out_dir, exist_ok=True); os.makedirs(shots, exist_ok=True)
    manifest_path = os.path.join(ROOT, 'assets', 'stacks.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for name in want:
        layers, side, topimg, maxtop = build_stack(name, cars[name])
        n = len(layers); lw, lh = layers[0].size
        rows = math.ceil(n / COLS)
        sheet = Image.new('RGBA', (COLS * lw, rows * lh), (0, 0, 0, 0))
        for i, img in enumerate(layers):
            sheet.paste(img, ((i % COLS) * lw, (i // COLS) * lh))
        fn = f'stack_{name}.webp'
        sheet.save(os.path.join(out_dir, fn), 'WEBP', lossless=True)
        side.resize((side.width * 3, side.height * 3), Image.NEAREST).save(os.path.join(shots, f'{name}_side.png'))
        topimg.resize((topimg.width * 3, topimg.height * 3), Image.NEAREST).save(os.path.join(shots, f'{name}_top.png'))
        manifest[name] = {'file': f'cars/{fn}', 'layers': n, 'cols': COLS, 'lw': lw, 'lh': lh,
                          'length': fleet[name]['length'], 'width': fleet[name]['width'], 'heightM': round(maxtop, 2)}
        print(f'{name}: {n} layers, layer {lw}x{lh}px, roof {maxtop:.2f} m, sheet {os.path.getsize(os.path.join(out_dir, fn)) // 1024} KB')
    json.dump(manifest, open(manifest_path, 'w'), indent=1, sort_keys=True)
    print('manifest ->', manifest_path)

if __name__ == '__main__':
    main()

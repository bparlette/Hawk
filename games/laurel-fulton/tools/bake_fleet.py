"""bake_fleet.py — the Laurel/Fulton crew's REAL cars, modelled from their real dimensions and body lines,
rendered straight down through Palm City's own pipeline (same sun, sky, Cycles passes, Kuwahara paint and
plum ink — imported from games/palm-city/tools/bake_sprites.py, so the fleet and the city match).

  python tools/bake_fleet.py [car ...] [--quick] [--preview]     (from games/laurel-fulton/, with bpy:
      python3 -m venv bpyenv && bpyenv/bin/pip install bpy   ->   bpyenv/bin/python tools/bake_fleet.py)
  --preview : one big north-facing frame per car -> shots/fleet-preview-<car>.png (for checking the look)
  default   : the game set — 32 angles colour + shadow sheets + a headlight light sprite per car
              -> assets/cars/*.webp + assets/fleet.json (same manifest format as palm-city's cars)

A car is a LOFTED BODY, not a box: a plan outline (half width along the length: taper, pointed noses,
coke-bottle hips), a side profile (bumper, hood, cowl, windshield rake, roof, rear glass, deck, tail),
a greenhouse narrower than the body above the beltline (tumblehome), a crowned top, rolled sides — and
paint regions on that surface (two-tone splits, vinyl landau roofs, T-top glass), plus the details that
make each car instantly itself from above: lights by colour and shape, chrome or body-colour bumpers,
spoilers, louvres, hood ornament, roof racks. Dimensions are the real cars' (metres).
"""
import importlib.util, os, sys, math, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PS = os.path.abspath(os.path.join(ROOT, '..', 'palm-city', 'tools', 'bake_sprites.py'))
sys.argv = [sys.argv[0], '--'] + [a for a in sys.argv[1:]]
spec = importlib.util.spec_from_file_location('palm_bake', PS)
pb = importlib.util.module_from_spec(spec); spec.loader.exec_module(pb)
import bpy, bmesh
import numpy as np
from mathutils import Vector

ARGS = [a for a in sys.argv[2:] if not a.startswith('--')]
PREVIEW = '--preview' in sys.argv
OUT = os.path.join(ROOT, 'assets', 'cars'); os.makedirs(OUT, exist_ok=True)
SHOTS = os.path.join(ROOT, 'shots'); os.makedirs(SHOTS, exist_ok=True)
FLEET_PATH = os.path.join(ROOT, 'assets', 'fleet.json')
FLEET = json.load(open(FLEET_PATH)) if os.path.exists(FLEET_PATH) else {}

def smooth(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def interp(pts, t):
    """piecewise-smooth through [(t, v), ...], t ascending"""
    if t <= pts[0][0]: return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1: return v0 + (v1 - v0) * smooth((t - t0) / max(1e-6, t1 - t0))
    return pts[-1][1]

# --------------------------------------------------------------------------- the cars (real dimensions, m)
# s = position along the car, 0 = front bumper, 1 = rear bumper. plan = half-width fraction of W at s.
# top = top-surface height at s (the centreline). cabin = (s where the windshield starts, roof front,
# roof back, rear glass ends). gw = greenhouse half-width fraction (front, rear) above the belt.
CARS = {
 # Brad — 1987 Chevrolet Camaro (third gen): long low hood, pointed nose, steep-raked windshield, short roof
 # with T-tops, the huge curved hatch glass, a short deck with the lip spoiler. TWO-TONE: front half white,
 # rear half maroon. Yellow headlights.
 'camaro_brad': dict(L=4.88, W=1.83, plan=[(0, .46), (.04, .66), (.12, .86), (.24, .98), (.32, 1), (.85, 1), (.97, .93), (1, .84)],
     top=[(0, .55), (.04, .74), (.30, .86), (.36, .90), (.47, 1.24), (.62, 1.26), (.88, 1.0), (.95, 1.0), (1, .78)],
     belt=0.92, cabin=(.36, .47, .62, .88), gw=(.72, .66), roof='ttop', paint='#f4f0e6', paint2='#6e1626', split=0.5,
     bumpers='body', lights=dict(head='#ffd23a', head_shape='slit', tail='fullwidth'), spoiler=True, louvres=True, headcol=(1.0, 0.82, 0.25)),
 # Clayton — green Camaro (same third-gen body, solid green)
 'camaro_clayton': dict(base='camaro_brad', paint='#2f6b3a', paint2=None, headcol=(1.0, 0.9, 0.7), lights=dict(head='#f2efe0', head_shape='slit', tail='fullwidth')),
 # Kosack — 1996 Chevrolet Cavalier SEDAN (third gen, the rounded '95+ shape), red: soft rounded nose and
 # tail, steeply raked glass both ends, short rounded trunk (owner correction, Nov 17: a 1996, not '89)
 'cavalier_kosack': dict(L=4.60, W=1.69, plan=[(0, .68), (.04, .86), (.10, .97), (.18, 1), (.86, 1), (.95, .94), (1, .78)],
     top=[(0, .62), (.05, .80), (.24, .90), (.28, .94), (.42, 1.36), (.66, 1.37), (.81, 1.02), (.85, 1.0), (1, .84)],
     belt=0.96, cabin=(.28, .42, .66, .81), gw=(.76, .72), paint='#b81d24', bumpers='body', lights=dict(head='#f2efe0', head_shape='rect', tail='corner')),
 # the unassigned black Cavalier — the earlier (second-gen, ~1989) boxy coupe, no owner yet
 'cavalier_black': dict(L=4.50, W=1.68, plan=[(0, .80), (.05, .95), (.12, 1), (.92, 1), (1, .9)],
     top=[(0, .62), (.05, .80), (.26, .88), (.30, .90), (.42, 1.28), (.66, 1.30), (.80, 0.98), (.84, .96), (1, .80)],
     belt=0.93, cabin=(.30, .42, .66, .80), gw=(.74, .70), paint='#16161a', bumpers='black', lights=dict(head='#f2efe0', head_shape='rect', tail='corner')),
 # Jimmy — 1996 Chevrolet Astro, silver: boxy van, short sloped nose, upright windshield, long flat roof
 # with roof rails, vertical rear doors. (Underglow + bass rings are the game's FX, not paint.)
 'astro_jimmy': dict(L=4.82, W=1.97, plan=[(0, .84), (.04, .95), (.10, 1), (.98, 1), (1, .96)],
     top=[(0, .80), (.06, 1.00), (.16, 1.12), (.20, 1.18), (.30, 1.86), (.97, 1.88), (1, 1.70)],
     belt=1.12, cabin=(.20, .30, .97, .99), gw=(.88, .9), roof='rack', paint='#b9bdc2', bumpers='grey', lights=dict(head='#f2efe0', head_shape='rect', tail='vertical')),
 # Billy — 1994 Chevrolet Astro (first gen), teal-blue
 'astro_billy': dict(base='astro_jimmy', paint='#1f6f7c'),
 # Jason — 1989 Toyota Camry sedan, white: crisp boxy three-box, flat hood, upright glass, square trunk
 'camry_jason': dict(L=4.52, W=1.69, plan=[(0, .86), (.04, .97), (.08, 1), (.95, 1), (1, .93)],
     top=[(0, .66), (.05, .82), (.27, .88), (.30, .92), (.42, 1.36), (.68, 1.38), (.79, 1.02), (.82, 1.0), (1, .86)],
     belt=0.97, cabin=(.30, .42, .68, .79), gw=(.78, .76), paint='#f2f1ec', bumpers='black', lights=dict(head='#f2efe0', head_shape='rect', tail='corner'), exhaust=True),
 # Zack — Mercury Tracer (1988-89, Mazda 323-based hatch), green: short, round-ish, steep hatch
 'tracer_zack': dict(L=4.17, W=1.65, plan=[(0, .80), (.06, .95), (.14, 1), (.90, 1), (1, .9)],
     top=[(0, .62), (.05, .80), (.22, .86), (.26, .90), (.40, 1.30), (.74, 1.32), (.94, .98), (1, .84)],
     belt=0.94, cabin=(.26, .40, .74, .94), gw=(.76, .72), paint='#3f7a52', bumpers='black', lights=dict(head='#f2efe0', head_shape='rect', tail='corner')),
 # Rigg — 1987 Toyota Celica GT (fourth gen, ST162), blue: a low sharp WEDGE — the nose comes to a thin flat
 # edge with the POP-UP headlights hidden flush in it (blue lamps), long raked windshield, liftback glass to a
 # short tail, smooth flush sides (owner correction, Nov 17: '87 GT, not first-gen)
 'celica_rigg': dict(L=4.37, W=1.69, plan=[(0, .62), (.04, .82), (.12, .95), (.22, 1), (.88, 1), (.97, .93), (1, .84)],
     top=[(0, .50), (.05, .66), (.30, .82), (.35, .86), (.48, 1.24), (.62, 1.25), (.90, .98), (.94, .96), (1, .80)],
     belt=0.88, cabin=(.35, .48, .62, .90), gw=(.74, .66), paint='#1f4fb0', bumpers='body', lights=dict(head='#2a4a9a', head_shape='popup', tail='fullwidth'), headcol=(0.45, 0.65, 1.0)),
 # Lamar — 1987 Ford Mustang (Fox body, GT hatchback): aero nose with flush composite lamps, long hood,
 # fastback hatch glass, louvred quarter windows, rear spoiler. Parked at Atholton HS, ON FIRE (a game FX).
 'mustang_lamar': dict(L=4.56, W=1.76, plan=[(0, .64), (.04, .82), (.12, .95), (.22, 1), (.88, 1), (.97, .94), (1, .86)],
     top=[(0, .58), (.05, .74), (.30, .86), (.35, .90), (.46, 1.28), (.60, 1.29), (.86, 1.0), (.92, .98), (1, .82)],
     belt=0.92, cabin=(.35, .46, .60, .86), gw=(.74, .66), paint='#c8c8cc', bumpers='body', lights=dict(head='#f2efe0', head_shape='slit', tail='fullwidth'), spoiler=True),
 # Grant — 1989 Cadillac Brougham "USS Mino", maroon: a land yacht — very long, square, long hood with the
 # stand-up wreath ornament, padded VINYL LANDAU roof over the rear half, small formal rear glass, long
 # trunk, chrome bumpers and trim
 'brougham_grant': dict(L=5.62, W=1.95, plan=[(0, .92), (.03, .99), (.06, 1), (.97, 1), (1, .95)],
     top=[(0, .72), (.03, .88), (.33, .95), (.36, .98), (.45, 1.40), (.70, 1.42), (.75, 1.08), (.77, 1.04), (1, .92)],
     belt=1.02, cabin=(.36, .45, .70, .75), gw=(.80, .76), roof='landau', paint='#5a1424', vinyl='#33101a', bumpers='chrome', lights=dict(head='#f2efe0', head_shape='quad', tail='vertical'), ornament=True, chrome_trim=True),
}
for k, v in list(CARS.items()):
    if 'base' in v:
        b = dict(CARS[v['base']]); b.update({kk: vv for kk, vv in v.items() if kk != 'base'}); CARS[k] = b

# --------------------------------------------------------------------------- the body
def build_body(c):
    L, W = c['L'], c['W']
    mats = {
        'paint': pb.mat('paint', pb.srgb(c['paint']), rough=0.3, coat=0.9, noise=0.04, noise_scale=3),
        'paint2': pb.mat('paint2', pb.srgb(c.get('paint2') or c['paint']), rough=0.3, coat=0.9, noise=0.04, noise_scale=3),
        'glass': pb.mat('glass', pb.srgb('#141a2a'), rough=0.05, spec=1.0, coat=1.0, noise=0),
        'vinyl': pb.mat('vinyl', pb.srgb(c.get('vinyl', '#20202a')), rough=0.85, noise=0.12, noise_scale=40),
        'trim': pb.mat('trim', pb.srgb('#1d1c22'), rough=0.6, noise=0),
        'chrome': pb.mat('chrome', (0.82, 0.82, 0.84), rough=0.12, metal=1.0, noise=0),
    }
    names = list(mats)
    NX, NY = 28, 120
    cs = c['cabin']
    def hw(s): return W / 2 * interp(c['plan'], s)
    def gwf(s): return c['gw'][0] + (c['gw'][1] - c['gw'][0]) * smooth((s - cs[0]) / max(1e-6, cs[3] - cs[0]))
    def z_at(u, s):
        top = interp(c['top'], s)
        incab = cs[0] - 0.01 <= s <= cs[3] + 0.01
        if incab and top > c['belt']:
            g = gwf(s)
            k = smooth((abs(u) - g) / 0.07)                         # glass -> belt shoulder
            top = top * (1 - k) + c['belt'] * k
        top -= 0.035 * u * u                                        # crown
        edge = smooth((abs(u) - 0.86) / 0.14)
        return top - edge * (top - 0.35) * 0.55                      # rolled sides
    def region(u, s):
        top = interp(c['top'], s)
        incab = cs[0] <= s <= cs[3] and abs(u) < gwf(s) and top > c['belt'] + 0.02
        if incab:
            if s < cs[1] or s > cs[2]: return 'glass'                 # windshield / rear glass
            roof = c.get('roof')
            if roof == 'ttop' and 0.12 < abs(u) < gwf(s) - 0.08 and cs[1] + 0.02 < s < cs[1] + (cs[2] - cs[1]) * 0.62: return 'glass'
            if roof == 'landau' and s > cs[1] + (cs[2] - cs[1]) * 0.42: return 'vinyl'
            if abs(u) > gwf(s) - 0.06: return 'glass'                 # the side glass seen over the tumblehome
        if c.get('paint2') and s > c.get('split', 0.5): return 'paint2'
        return 'paint'
    bm = bmesh.new()
    grid = []
    for j in range(NY + 1):
        s = j / NY; y = L / 2 - s * L
        row = []
        for i in range(NX + 1):
            u = -1 + 2 * i / NX
            row.append(bm.verts.new((u * hw(s), y, z_at(u, s))))
        grid.append(row)
    for j in range(NY):
        for i in range(NX):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            f.material_index = names.index(region(-1 + 2 * (i + .5) / NX, (j + .5) / NY))
            f.smooth = True
    # skirts: drop the outline to the rocker so the body is closed when seen from the low sun
    def skirt(vs, mi):
        low = [bm.verts.new((v.co.x, v.co.y, 0.28)) for v in vs]
        for a in range(len(vs) - 1):
            f = bm.faces.new((vs[a], vs[a + 1], low[a + 1], low[a])); f.material_index = mi
    pi = names.index('paint')
    skirt([grid[j][0] for j in range(NY + 1)], pi); skirt([grid[j][NX] for j in range(NY + 1)][::-1], pi)
    skirt(grid[0][::-1], pi); skirt(grid[NY], pi)
    me = bpy.data.meshes.new('body'); bm.normal_update(); bm.to_mesh(me); bm.free()
    for n in names: me.materials.append(mats[n])
    o = bpy.data.objects.new('body', me); bpy.context.scene.collection.objects.link(o)
    pb.track(o)
    return o, mats, hw, z_at

def build_car(name):
    c = CARS[name]; L, W = c['L'], c['W']
    root = bpy.data.objects.new('car', None); bpy.context.scene.collection.objects.link(root); pb.track(root)
    body, M, hw, z_at = build_body(c)
    objs = [body]
    tyre = pb.mat('tyre', pb.srgb('#141317'), rough=0.9, noise=0)
    lens = pb.srgb(c['lights']['head'])
    head = pb.mat('headl', lens, rough=0.15, emit=tuple(c.get('headcol', (1.0, 0.86, 0.62))), night=40, day=0.9, noise=0)
    tail = pb.mat('taill', pb.srgb('#b3101f'), rough=0.3, emit=(1.0, 0.08, 0.06), night=30, day=0.45, noise=0)
    bump = {'chrome': M['chrome'], 'black': M['trim'], 'grey': pb.mat('grey', pb.srgb('#5d5f63'), rough=0.6, noise=0), 'body': M['paint']}[c['bumpers']]
    bumpR = M['paint2'] if c['bumpers'] == 'body' else bump
    fy, ry = L / 2, -L / 2
    # wheels: tucked in, a sliver shows at the arches
    wb = {'brougham_grant': 3.10, 'astro_jimmy': 2.82, 'astro_billy': 2.82}.get(name, 2.55 if L > 4.4 else 2.45)
    for sx in (-1, 1):
        for sy in (0.5, -0.5):
            objs.append(pb.cyl((sx * (W / 2 - 0.13), (wb * sy) + (L * 0.02), 0.33), 0.33, 0.24, tyre, rot=(0, math.pi / 2, 0)))
    # bumpers wrap the ends
    for yy, mt, sw in ((fy - 0.04, bump, hw(0.01)), (ry + 0.04, bumpR, hw(0.99))):   # bumpers follow the body outline at each end
        objs.append(pb.cube((0, yy, 0.45), (sw * 1.9, 0.12, 0.18), mt, bevel=0.05))
    # headlights by shape
    hs = c['lights']['head_shape']; zf = z_at(0.7, 0.03) + 0.01; nW = hw(0.04) * 2   # lights sit inside the nose as drawn
    for sx in (-1, 1):
        if hs == 'slit':   objs.append(pb.cube((sx * nW * 0.30, fy - 0.12, zf), (nW * 0.26, 0.08, 0.06), head, bevel=0.02))
        elif hs == 'popup': objs.append(pb.cube((sx * nW * 0.30, fy - 0.20, zf + 0.004), (nW * 0.24, 0.26, 0.012), M['trim'], bevel=0.01))   # closed pop-up doors: two flush seams
        elif hs == 'round': objs.append(pb.cyl((sx * W * 0.33, fy - 0.10, zf), 0.10, 0.10, head, rot=(math.pi / 2, 0, 0)))
        elif hs == 'quad':
            for k in (0, 1): objs.append(pb.cube((sx * (W * 0.24 + k * 0.24), fy - 0.07, zf), (0.2, 0.08, 0.12), head, bevel=0.02))
        else:              objs.append(pb.cube((sx * W * 0.32, fy - 0.09, zf), (W * 0.22, 0.09, 0.12), head, bevel=0.02))
    zt = z_at(0.7, 0.98) + 0.01
    ts = c['lights']['tail']
    if ts == 'fullwidth': objs.append(pb.cube((0, ry + 0.08, zt), (W * 0.86, 0.08, 0.10), tail, bevel=0.02))
    elif ts == 'vertical':
        for sx in (-1, 1): objs.append(pb.cube((sx * (W / 2 - 0.08), ry + 0.12, zt), (0.1, 0.22, 0.30), tail, bevel=0.02))
    else:
        for sx in (-1, 1): objs.append(pb.cube((sx * W * 0.32, ry + 0.07, zt), (W * 0.26, 0.08, 0.12), tail, bevel=0.02))
    # signature details
    if c.get('spoiler'):                                           # Camaro rear lip spoiler, maroon like the tail
        objs.append(pb.cube((0, ry + 0.30, z_at(0, 0.94) + 0.06), (W * 0.82, 0.12, 0.05), M['paint2'], bevel=0.02))
    if c.get('louvres'):                                           # IROC-style hood louvres
        for sx in (-1, 1):
            for k in range(3): objs.append(pb.cube((sx * 0.28, fy - 1.05 + k * 0.09, z_at(0.3, 0.22) + 0.012), (0.24, 0.035, 0.012), M['trim']))
    if c.get('roof') == 'rack':                                    # Astro roof rails + crossbars
        zr = interp(c['top'], 0.6) + 0.06
        for sx in (-1, 1): objs.append(pb.cube((sx * W * 0.40, -L * 0.12, zr), (0.05, L * 0.55, 0.05), M['trim']))
        for k in (-1, 1): objs.append(pb.cube((0, -L * 0.12 + k * L * 0.18, zr + 0.03), (W * 0.82, 0.05, 0.04), M['trim']))
    if c.get('ornament'):                                          # Cadillac stand-up wreath ornament + grille chrome
        objs.append(pb.cube((0, fy - 0.30, z_at(0, 0.06) + 0.08), (0.06, 0.10, 0.14), M['chrome'], bevel=0.02))
        objs.append(pb.cube((0, fy - 0.05, 0.62), (W * 0.42, 0.06, 0.16), M['chrome'], bevel=0.02))
    if c.get('chrome_trim'):                                       # Brougham bright belt + rocker chrome
        for sx in (-1, 1): objs.append(pb.cube((sx * (W / 2 - 0.03), 0, c['belt'] - 0.02), (0.035, L * 0.86, 0.03), M['chrome']))
    if c.get('exhaust'):                                           # Jason's Camry: the bare pipe stub where the exhaust should be
        objs.append(pb.cyl((W * 0.30, ry - 0.02, 0.28), 0.045, 0.16, M['trim'], rot=(math.pi / 2, 0, 0)))
    for sx in (-1, 1):                                             # mirrors
        objs.append(pb.cube((sx * (W / 2 + 0.07), L / 2 - L * c['cabin'][0] - 0.15, c['belt'] + 0.04), (0.13, 0.09, 0.08), M['trim'], bevel=0.02))
    pb.parent_all(root, objs)
    return root

def headlight_rig(c):
    for sx in (-0.6, 0.6):
        pb.spot_light((sx, c['L'] / 2 + 0.1, 0.75), (math.radians(90 - 11), 0, 0), 2200, c.get('headcol', (1.0, 0.88, 0.66)), size_deg=40, blend=0.8)
    pb.point_light((0, -c['L'] / 2 - 0.4, 0.6), 18, (1.0, 0.12, 0.08), radius=0.4)

def bake(name):
    c = CARS[name]; t0 = time.time()
    pb.reset(); pb.ASSET_OBJS.clear(); pb.EMITTERS.clear()
    root = build_car(name)
    if PREVIEW:
        root.rotation_euler = (0, 0, 0)
        pb.set_pass('color'); pb.frame(0, 0, 6.4, 6.4, 90); pb.render(f'{pb.TMP}/p.png')
        img = pb.ink(pb.kuwahara(pb.load_np(f'{pb.TMP}/p.png'), 2), 0.5, 0.25)
        pb.save_np(img, os.path.join(SHOTS, f'fleet-preview-{name}.png'))
        pb.clear_asset(); print(f'preview {name} {time.time() - t0:.1f}s', flush=True); return
    col, sh = [], []
    for k in range(pb.CAR_ANGLES):
        th = k * 2 * math.pi / pb.CAR_ANGLES
        root.rotation_euler = (0, 0, -th - math.pi / 2)
        pb.set_pass('color'); pb.frame(0, 0, pb.CAR_FRAME, pb.CAR_FRAME, pb.CAR_PPM); pb.render(f'{pb.TMP}/c.png')
        col.append(pb.ink(pb.kuwahara(pb.load_np(f'{pb.TMP}/c.png'), 1), 0.5, 0.25))
        pb.set_pass('shadow'); scx, scy = pb.SHADOW_DIR.x * 1.2, pb.SHADOW_DIR.y * 1.2
        pb.frame(scx, scy, pb.CAR_SH_FRAME, pb.CAR_SH_FRAME, pb.CAR_SH_PPM); pb.render(f'{pb.TMP}/s.png')
        sh.append(pb.shadow_to_alpha(pb.load_np(f'{pb.TMP}/s.png')))
    pb.save_np(pb.sheet(col, 8), f'{OUT}/car_{name}.webp'); pb.save_np(pb.sheet(sh, 8), f'{OUT}/car_{name}_sh.webp')
    root.rotation_euler = (0, 0, 0); headlight_rig(c)
    pb.set_pass('night'); pb.frame(0, 5.0, 7.0, 22.0, 8); pb.render(f'{pb.TMP}/n.png')
    pb.save_np(pb.night_clean(pb.load_np(f'{pb.TMP}/n.png'), 0.06), f'{OUT}/car_{name}_light.webp')
    me = lambda f, cx, cy, w, h: dict(pb.manifest_entry(f, cx, cy, w, h), file='cars/' + f)
    FLEET[name] = {'angles': pb.CAR_ANGLES, 'cols': 8, 'length': round(c['L'] * pb.UPM, 1), 'width': round(c['W'] * pb.UPM, 1),
                   'color': me(f'car_{name}.webp', 0, 0, pb.CAR_FRAME, pb.CAR_FRAME),
                   'shadow': me(f'car_{name}_sh.webp', scx, scy, pb.CAR_SH_FRAME, pb.CAR_SH_FRAME),
                   'light': me(f'car_{name}_light.webp', 0, 5.0, 7.0, 22.0)}
    json.dump(FLEET, open(FLEET_PATH, 'w'), indent=1, sort_keys=True)
    pb.clear_asset(); print(f'car {name} baked in {time.time() - t0:.1f}s', flush=True)

if __name__ == '__main__':
    pb.TMP = os.path.join('/tmp', 'laurel_bake'); os.makedirs(pb.TMP, exist_ok=True)
    for n in (ARGS or list(CARS)): bake(n)
    print('FLEET DONE')

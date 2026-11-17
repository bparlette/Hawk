"""bake_side.py — the Motel Siege's side-view art, baked with the same models, materials, Cycles
light and painterly post (Kuwahara + plum ink) as the top-down sprites in bake_sprites.py, but
with an orthographic camera looking horizontally into a cutaway.

Run (from games/palm-city/), with Blender or the pip `bpy` module:
    blender -b -P tools/bake_side.py -- peds            # side-view people sheets
    blender -b -P tools/bake_side.py -- motel           # the cutaway building (golden + night layers)
    python3 tools/bake_side.py -- all [--quick]         # with `pip install bpy` (Blender 5.x)

Output: assets/siege/*.webp + assets/siege.json (frames in cutaway units: 1 m = SU units).
The cutaway is drawn in its own space: x right, y DOWN (canvas), ground at y = 0, so a floor at
height z metres sits at y = -z * SU.
"""
import os, sys, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake_sprites as B
from bake_sprites import (bpy, np, cube, cyl, sphere, mat, srgb, track, clear_asset, set_pass, render,
                          load_np, save_np, kuwahara, ink, sheet, build_ped, parent_all, TMP, ROOT, QUICK)
from mathutils import Vector

OUT = os.path.join(ROOT, 'assets', 'siege')
os.makedirs(OUT, exist_ok=True)
MAN_PATH = os.path.join(ROOT, 'assets', 'siege.json')
MAN = json.load(open(MAN_PATH)) if os.path.exists(MAN_PATH) else {}
SU = 22            # cutaway units per metre (19 m of building across the 420-unit phone view)
PPU = 3.1          # sprite pixels per cutaway unit (2x device pixels at the cutaway's 34 units/m)
PPM = SU * PPU     # 68 px per metre
GROUP = B.GROUP


def save_man():
    MAN['su'] = SU
    json.dump(MAN, open(MAN_PATH, 'w'), indent=1, sort_keys=True)


def side_light():
    """Low warm sun from the front-left and above (the cutaway faces the camera), cool sky fill."""
    sun = bpy.data.objects['sun']
    d = Vector((-0.55, -0.75, 0.62)).normalized()     # direction TO the sun
    sun.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()


def side_frame(cx, cz, wm, hm, ppm=PPM):
    """Orthographic camera at -Y looking +Y: image x = world x, image up = world z."""
    sc = bpy.context.scene
    cam = sc.camera
    cam.location = (cx, -120, cz)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    cam.data.ortho_scale = max(wm, hm)
    sc.render.resolution_x = max(4, int(round(wm * ppm)))
    sc.render.resolution_y = max(4, int(round(hm * ppm)))


def entry(file, cx, cz, wm, hm):
    """Placement relative to the anchor (feet / floor point) in cutaway units, y down."""
    return {'file': file, 'ox': round((cx - wm / 2) * SU, 2), 'oy': round(-(cz + hm / 2) * SU, 2),
            'w': round(wm * SU, 2), 'h': round(hm * SU, 2)}


# ============================================================================= PEOPLE (side view)
SIDE_SCALE = 1.15     # a touch heroic, but true-ish: 2.2 m against 3.4 m floors
SIDE_W, SIDE_H, SIDE_CZ = 4.6, 2.7, 1.2
POSES = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'idle', 'wind', 'punch',
         'climbA', 'climbB', 'hurt', 'down', 'jump']
SIDE_SET = [
    # name, shirt, pants, skin, hair, headwear, shoes, extra
    ('player', '#25b8ac', '#2c3452', '#c68a64', '#2a1d18', 'cap', '#f4f0e6', None),
    ('cop', '#24335a', '#1c2440', '#b07a58', '#1a1410', 'cop', '#111111', None),
    ('swat', '#1e2a3e', '#1a2030', '#9a6a4c', '#141010', None, '#0e0e10', 'swat'),
]


def swat_kit(root):
    """Helmet, goggles strap, plate carrier — added over the base person (parented, so scaled)."""
    navy = mat('helmet', srgb('#151c2c'), rough=0.45, noise=0.05)
    vest = mat('vest', srgb('#252d3a'), rough=0.85, noise=0.12, noise_scale=10)
    patch = mat('patch', srgb('#e8e2cc'), rough=0.8, noise=0)
    objs = [sphere((0, 0, 1.71), 0.15, navy, scale=(1.05, 1.1, 0.8)),
            cube((0, 0.12, 1.62), (0.22, 0.04, 0.05), mat('goggle', srgb('#3a4658'), rough=0.2, noise=0)),
            sphere((0, 0, 1.30), 0.29, vest, scale=(1.0, 0.75, 1.0)),
            cube((0, -0.22, 1.36), (0.2, 0.02, 0.06), patch)]
    for o in objs:
        o.parent = root
    return objs


def pose_side(root, L, p):
    r = math.radians
    for k in L:
        L[k].rotation_euler = (0, 0, 0)
    tilt, lift = 0.0, 0.0
    if p.startswith('walk'):
        s = math.sin(2 * math.pi * int(p[4]) / 6)
        a = r(26) * s
        L['legL'].rotation_euler = (a, 0, 0); L['legR'].rotation_euler = (-a, 0, 0)
        L['armL'].rotation_euler = (-a * 1.2, 0, 0); L['armR'].rotation_euler = (a * 1.2, 0, 0)
        lift = 0.03 * abs(math.cos(2 * math.pi * int(p[4]) / 6))
    elif p == 'idle':
        L['armL'].rotation_euler = (r(-6), 0, 0); L['armR'].rotation_euler = (r(8), 0, 0)
    elif p == 'wind':
        L['armR'].rotation_euler = (r(-45), 0, 0); L['armL'].rotation_euler = (r(40), 0, 0)
        L['legL'].rotation_euler = (r(14), 0, 0); L['legR'].rotation_euler = (r(-12), 0, 0)
        tilt = r(-4)
    elif p == 'punch':
        L['armR'].rotation_euler = (r(92), 0, 0); L['armL'].rotation_euler = (r(-30), 0, 0)
        L['legL'].rotation_euler = (r(22), 0, 0); L['legR'].rotation_euler = (r(-20), 0, 0)
        tilt = r(-9)
    elif p in ('climbA', 'climbB'):
        f = 1 if p == 'climbA' else -1
        L['armL'].rotation_euler = (r(165 if f > 0 else 135), 0, 0); L['armR'].rotation_euler = (r(135 if f > 0 else 165), 0, 0)
        L['legL'].rotation_euler = (r(40 if f > 0 else 5), 0, 0); L['legR'].rotation_euler = (r(5 if f > 0 else 40), 0, 0)
    elif p == 'hurt':
        L['armL'].rotation_euler = (r(70), 0, 0); L['armR'].rotation_euler = (r(55), 0, 0)
        L['legL'].rotation_euler = (r(18), 0, 0)
        tilt = r(26)
    elif p == 'down':
        L['armL'].rotation_euler = (r(150), 0, 0); L['armR'].rotation_euler = (r(110), 0, 0)
        L['legL'].rotation_euler = (r(14), 0, 0); L['legR'].rotation_euler = (r(-6), 0, 0)
        tilt, lift = r(86), 0.16
    elif p == 'jump':
        L['legL'].rotation_euler = (r(55), 0, 0); L['legR'].rotation_euler = (r(-25), 0, 0)
        L['armL'].rotation_euler = (r(120), 0, 0); L['armR'].rotation_euler = (r(-40), 0, 0)
    root.rotation_euler = (tilt, 0, -math.pi / 2)    # model faces +Y; turn it to face +X (screen right)
    root.location = (0, 0, lift)


def bake_side_peds():
    B.reset()
    side_light()
    MAN.setdefault('peds', {})
    for name, shirt, pants, skin, hair, hw, shoes, extra in SIDE_SET:
        if B.ONLY and name not in B.ONLY:
            continue
        t0 = time.time()
        root, L = build_ped(shirt, pants, skin, hair, hw, shoes)
        if extra == 'swat':
            swat_kit(root)
        root.scale = (SIDE_SCALE,) * 3
        frames = []
        for p in POSES:
            pose_side(root, L, p)
            set_pass('color')
            side_frame(0, SIDE_CZ, SIDE_W, SIDE_H)
            render(f'{TMP}/side.png')
            frames.append(ink(kuwahara(load_np(f'{TMP}/side.png'), 1), 0.6, 0.2))
        cols = 7
        save_np(sheet(frames, cols), f'{OUT}/side_{name}.webp')
        MAN['peds'][name] = {'poses': POSES, 'cols': cols, 'color': entry(f'siege/side_{name}.webp', 0, SIDE_CZ, SIDE_W, SIDE_H)}
        save_man()
        clear_asset()
        print(f'side ped {name} baked in {time.time() - t0:.1f}s', flush=True)


# ============================================================================= THE MOTEL CUTAWAY
SG = B.LAYOUT['siege']
FL, ROOF, X0, X1 = SG['floors'], SG['roof'], SG['x0'], SG['x1']
FH = FL[1] - FL[0]
YF, YB = -0.8, 2.4          # slab front (the cut face) and the back wall plane
SLAB = 0.32


def span_boxes(x0, x1, holes):
    """[x0,x1] minus the hole intervals -> list of (a, b)."""
    out, a = [], x0
    for h0, h1 in sorted(holes):
        if h0 > a:
            out.append((a, h0))
        a = max(a, h1)
    if a < x1:
        out.append((a, x1))
    return out


def box(x0, x1, z0, z1, y0, y1, m, bevel=0.0):
    return cube(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), m, bevel=bevel)


def steps(xa, za, xb, zb, n, m, y0=0.0, y1=1.5, stringer=None):
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        xs, xe = xa + (xb - xa) * t0, xa + (xb - xa) * t1
        z = za + (zb - za) * t1
        rise = abs(zb - za) / n
        box(min(xs, xe), max(xs, xe), z - rise - 0.05, z, y0, y1, m)      # tread + riser: a solid step
    if stringer is not None:
        L = math.hypot(xb - xa, zb - za)
        c = cube(((xa + xb) / 2, y0 - 0.06, (za + zb) / 2 - 0.25), (L, 0.08, 0.3), stringer)
        c.rotation_euler = (0, -math.atan2(zb - za, xb - xa), 0)


def build_motel():
    rnd = __import__('random').Random(15)
    concrete = mat('concrete', srgb('#3b2c36'), rough=0.9, noise=0.18, noise_scale=8)
    cutface = mat('cutface', srgb('#2a1f2c'), rough=0.9, noise=0.1, noise_scale=14)
    stucco = mat('stucco', srgb('#e8b98a'), rough=0.9, noise=0.16, noise_scale=5)
    trim = mat('trim', srgb('#f4e2c4'), rough=0.8, noise=0.06)
    walls = [  # per floor: (x0, x1, wall colour, wainscot colour)
        [(-7.6, -3.0, '#d9a882', '#a8664e'), (-3.0, 2.4, '#c49894', '#8c5a5e'), (2.4, 6.2, '#d9a882', '#a8664e')],
        [(-7.6, -2.2, '#c49894', '#7e5262'), (-2.2, 2.2, '#e0c08e', '#a07a50'), (2.2, 6.2, '#c49894', '#7e5262')],
        [(-7.6, -1.4, '#8aa4a0', '#55706e'), (-1.4, 3.5, '#a8b890', '#6e7e58'), (3.5, 6.2, '#8aa4a0', '#55706e')],
    ]
    wood = mat('wood', srgb('#8a5634'), rough=0.7, noise=0.25, noise_scale=18)
    dark_wood = mat('darkwood', srgb('#5a3424'), rough=0.7, noise=0.2, noise_scale=18)
    iron = mat('iron', srgb('#2e2a34'), rough=0.5, metal=0.6, noise=0.08)
    glass = mat('glass', srgb('#9ec8e0'), rough=0.15, emit=(1.0, 0.62, 0.3), night=1.4, day=0.0, noise=0.05, noise_scale=3)
    lampm = mat('lampshade', srgb('#ffe4b0'), rough=0.6, emit=(1.0, 0.8, 0.5), night=6.0, day=0.6, noise=0)
    floor_wood = mat('floorwood', srgb('#9a6440'), rough=0.6, noise=0.3, noise_scale=12)
    carpet = mat('carpet', srgb('#b04a4a'), rough=1.0, noise=0.2, noise_scale=20)
    tile = mat('tile', srgb('#d8d0bc'), rough=0.5, noise=0.15, noise_scale=10)
    # ground slab + sidewalk lip
    box(X0 - 0.2, SG['fireEscape']['x1'] + 0.6, -0.55, 0.0, YF, YB + 0.3, concrete)
    box(-12, 12.5, -0.18, 0.0, YF - 1.2, YF, mat('curb', srgb('#a89a8c'), rough=0.9, noise=0.2, noise_scale=6))
    holes = {1: [(SG['stairs'][0]['x0'] + 0.1, SG['stairs'][0]['x1'])], 2: [(SG['stairs'][1]['x1'], SG['stairs'][1]['x0'] - 0.1)]}
    for fi, z in enumerate(FL):
        top = (FL[fi + 1] if fi + 1 < len(FL) else ROOF) - SLAB
        # floor finish (top surface) + the cut slab face
        if fi > 0:
            for a, b in span_boxes(X0, X1, holes.get(fi, [])):
                box(a, b, z - SLAB, z, YF, YB, cutface)
                box(a, b, z - 0.04, z, YF + 0.05, YB, floor_wood if fi != 2 else carpet)
        else:
            box(X0, X1, -0.04, 0.0, YF + 0.05, YB, tile)
        # back walls with wainscot, baseboard and crown
        for (a, b, wc, sc) in walls[fi]:
            box(a, b, z, top, YB, YB + 0.2, mat('wall', srgb(wc), rough=0.95, noise=0.2, noise_scale=4))
            box(a, b, z, z + 1.0, YB - 0.05, YB, mat('wains', srgb(sc), rough=0.9, noise=0.18, noise_scale=6))
            box(a, b, z + 1.0, z + 1.07, YB - 0.08, YB, trim)
            box(a, b, top - 0.12, top, YB - 0.1, YB, trim)
            # a window per room: frame, glass, sill, curtains
            cx = (a + b) / 2 + rnd.uniform(-0.6, 0.6)
            wz0, wz1 = z + 1.25, top - 0.55
            if not (fi == 0 and a < -3.0):        # the lobby gets the CHECK IN sign instead
                box(cx - 0.85, cx + 0.85, wz0, wz1, YB - 0.04, YB - 0.01, glass)
                for xx in (cx - 0.9, cx - 0.03, cx + 0.84):
                    box(xx, xx + 0.07, wz0, wz1, YB - 0.1, YB - 0.02, trim)
                for zz in (wz0 - 0.07, (wz0 + wz1) / 2 - 0.03, wz1):
                    box(cx - 0.9, cx + 0.9, zz, zz + 0.07, YB - 0.1, YB - 0.02, trim)
                cur = mat('curtain', srgb(rnd.choice(['#e8708e', '#f4cf62', '#6b92d8', '#25b8ac'])), rough=1.0, noise=0.2, noise_scale=10)
                box(cx - 1.25, cx - 0.88, wz0 - 0.2, wz1 + 0.15, YB - 0.2, YB - 0.1, cur)
                box(cx + 0.88, cx + 1.25, wz0 - 0.2, wz1 + 0.15, YB - 0.2, YB - 0.1, cur)
            # a pilaster at the room boundary
            if a > X0:
                box(a - 0.18, a + 0.18, z, top, YB - 0.3, YB, mat('pil', srgb('#4a3440'), rough=0.9, noise=0.1))
            # ceiling lamp (bright at night)
            lx = (a + b) / 2
            box(lx - 0.3, lx + 0.3, top - 0.12, top - 0.02, 0.9, 1.5, lampm)
            pl = B.point_light((lx, 1.0, top - 0.4), 220, (1.0, 0.7, 0.42), radius=0.4)
        # outer walls, cut: west and east columns with openings
        def col(xa, xb, openings):
            zs = [(z, top)]
            for o0, o1 in openings:
                nz = []
                for a0, a1 in zs:
                    if o1 <= a0 or o0 >= a1:
                        nz.append((a0, a1)); continue
                    if o0 > a0: nz.append((a0, o0))
                    if o1 < a1: nz.append((o1, a1))
                zs = nz
            for a0, a1 in zs:
                box(xa, xb, a0, a1 + SLAB, YF, YB + 0.2, stucco)
                box(xa, xb, a0, a1 + SLAB, YF - 0.02, YF, cutface)
        col(X0 - 0.35, X0, [(z, z + 2.6)] if fi == 0 else [])
        col(X1, X1 + 0.35, [(z, z + 2.5)] if fi in (0, 1) else [(z + 1.1, z + 2.7)])
    # roof slab with the hatch hole, parapets, HVAC, sign posts
    lad = SG['ladder']['x']
    for a, b in span_boxes(X0 - 0.35, X1 + 0.35, [(lad - 0.55, lad + 0.75)]):
        box(a, b, ROOF - 0.42, ROOF, YF, YB + 0.2, cutface)
        box(a, b, ROOF - 0.05, ROOF, YF + 0.05, YB + 0.2, mat('roofgravel', srgb('#8a7a70'), rough=1.0, noise=0.3, noise_scale=30))
    box(X0 - 0.35, X0 + 0.1, ROOF, ROOF + 0.7, YF, YB + 0.2, stucco)
    box(X1 - 0.1, X1 + 0.35, ROOF, ROOF + 0.45, YF, YB + 0.2, stucco)
    metal = mat('hvac', srgb('#a0a4ac'), rough=0.4, metal=0.5, noise=0.1)
    box(-6.2, -4.6, ROOF, ROOF + 1.2, 0.4, 2.0, metal, bevel=0.05)
    box(-6.0, -4.8, ROOF + 1.2, ROOF + 1.3, 0.6, 1.8, iron)
    cyl((-2.6, 1.6, ROOF + 0.6), 0.12, 1.2, metal)
    for xx in (3.4, 4.9):
        box(xx, xx + 0.16, ROOF, ROOF + 2.6, 1.5, 1.66, iron)
    # stairs
    for st in SG['stairs']:
        za, zb = FL[st['from']], FL[st['to']]
        steps(st['x0'], za, st['x1'], zb, 12, wood, 0.0, 1.5, stringer=dark_wood)
        # banister
        L = math.hypot(st['x1'] - st['x0'], zb - za)
        c = cube(((st['x0'] + st['x1']) / 2, -0.15, (za + zb) / 2 + 0.95), (L, 0.06, 0.07), dark_wood)
        c.rotation_euler = (0, -math.atan2(zb - za, st['x1'] - st['x0']), 0)
        for i in range(1, 6):
            t = i / 6
            px, pz = st['x0'] + (st['x1'] - st['x0']) * t, za + (zb - za) * t
            box(px - 0.03, px + 0.03, pz, pz + 0.95, -0.18, -0.12, dark_wood)
    # ladder F3 -> roof through the hatch
    z0, z1 = FL[SG['ladder']['from']], ROOF + 0.9
    for xx in (lad - 0.28, lad + 0.22):
        box(xx, xx + 0.06, z0, z1, 0.7, 0.78, iron)
    zz = z0 + 0.3
    while zz < z1 - 0.1:
        box(lad - 0.26, lad + 0.26, zz, zz + 0.05, 0.71, 0.77, iron); zz += 0.36
    # fire escape: two grated balconies, a flight, rails, posts
    fe = SG['fireEscape']
    for bi in fe['balconies']:
        z = FL[bi]
        box(fe['x0'] + 0.35, fe['x1'], z - 0.1, z, -0.6, 1.6, iron)
        box(fe['x1'] - 0.06, fe['x1'], z, z + 1.05, -0.6, 1.6, iron)
        box(fe['x0'] + 0.35, fe['x1'], z + 1.0, z + 1.06, 1.5, 1.6, iron)
        for xx in (fe['x0'] + 0.9, fe['x0'] + 1.6, fe['x1'] - 0.4):
            box(xx, xx + 0.04, z, z + 1.0, 1.52, 1.58, iron)
    fl = fe['flight']
    steps(fl['x0'], FL[fl['from']], fl['x1'], FL[fl['to']], 10, iron, 0.3, 1.3, stringer=iron)
    box(fe['x1'] - 0.12, fe['x1'], 0.0, FL[2] + 1.05, 1.6, 1.72, iron)
    # dressing: F1 lobby
    neon = mat('checkin', srgb('#ff6aa0'), rough=0.3, emit=srgb('#ff3f6a'), night=14.0, day=1.0, noise=0)
    box(-6.6, -3.7, 1.65, 2.65, YB - 0.12, YB - 0.04, mat('signplate', srgb('#2a2236'), rough=0.6, noise=0.05))
    t = B.text_obj('CHECK IN', (-5.15, YB - 0.14, 2.15), 0.55, neon, extrude=0.04)
    t.rotation_euler = (math.pi / 2, 0, 0)
    for i in range(6):
        box(-3.85 + i * 0.22, -3.7 + i * 0.22, 1.5, 1.62, YB - 0.1, YB - 0.04, mat('key', srgb('#e8c050'), rough=0.3, metal=1.0, noise=0))
    pot = mat('pot', srgb('#c0603a'), rough=0.8, noise=0.1)
    leaf = mat('leaf', srgb('#4f8a3a'), rough=0.8, noise=0.25, noise_scale=10)
    for px, fz in ((-2.6, FL[0]), (5.0, FL[2]), (-7.0, FL[2])):
        cyl((px, 1.6, fz + 0.3), 0.25, 0.6, pot)
        for k in range(6):
            sphere((px + rnd.uniform(-0.35, 0.35), 1.6 + rnd.uniform(-0.2, 0.2), fz + 0.8 + rnd.uniform(0, 0.6)), 0.28, leaf, scale=(1.0, 0.7, 0.6))
    # F2 rooms: bed frames + nightstands, a low dresser for the TV, pictures
    for bx, fz in ((-6.2, FL[1]), (4.2, FL[2])):
        box(bx - 1.0, bx + 1.0, fz, fz + 0.35, 0.2, 2.3, dark_wood)
        box(bx - 1.05, bx - 0.9, fz, fz + 1.3, 0.2, 2.3, dark_wood)
        box(bx - 0.9, bx + 1.0, fz + 0.35, fz + 0.62, 0.3, 2.2, mat('sheet', srgb('#f2eee4'), rough=1.0, noise=0.1))
        box(bx - 0.1, bx + 1.0, fz + 0.62, fz + 0.66, 0.3, 2.2, mat('blanket', srgb('#c83c4a'), rough=1.0, noise=0.2, noise_scale=12))
    tv = SG['traps'][1]
    box(tv['x'] - 0.75, tv['x'] + 0.75, FL[1], FL[1] + 0.9, 1.2, 2.3, wood, bevel=0.03)
    for i in range(3):
        box(tv['x'] - 0.7, tv['x'] + 0.7, FL[1] + 0.12 + i * 0.26, FL[1] + 0.14 + i * 0.26, 1.18, 1.2, dark_wood)
    for fi in range(3):
        for k in range(2):
            px = rnd.uniform(X0 + 1, X1 - 1)
            pz = FL[fi] + rnd.uniform(1.6, 2.2)
            box(px - 0.4, px + 0.4, pz, pz + 0.55, YB - 0.08, YB - 0.02, trim)
            box(px - 0.32, px + 0.32, pz + 0.07, pz + 0.48, YB - 0.1, YB - 0.07, mat('art', srgb(rnd.choice(['#ff9a5c', '#3fa8d0', '#e8708e', '#f4cf62'])), rough=0.9, noise=0.3, noise_scale=8))
    # palms flanking the motel
    B.palm_tree(-10.2, 2.6, rnd, height=9.5, lean_m=0.8)
    B.palm_tree(10.8, 2.8, rnd, height=11.0, lean_m=0.9)


def bake_motel():
    B.reset()
    side_light()
    build_motel()
    x0, x1, z0, z1 = -12.0, 12.4, -0.6, 15.6
    cx, cz, w, h = (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0
    set_pass('color')
    side_frame(cx, cz, w, h)
    sc = bpy.context.scene
    sc.camera.data.ortho_scale = max(w, h)
    sc.render.resolution_x, sc.render.resolution_y = int(round(w * PPM)), int(round(h * PPM))
    if w < h:  # ortho_scale spans the larger side
        pass
    render(f'{TMP}/motel_c.png')
    col = ink(kuwahara(load_np(f'{TMP}/motel_c.png'), 2), 0.6, 0.22)
    save_np(col, f'{OUT}/motel_color.webp')
    set_pass('night')
    render(f'{TMP}/motel_n.png')
    nig = B.night_clean(load_np(f'{TMP}/motel_n.png'))
    save_np(nig, f'{OUT}/motel_night.webp')
    MAN['motel'] = {'color': entry('siege/motel_color.webp', cx, cz, w, h), 'night': entry('siege/motel_night.webp', cx, cz, w, h)}
    save_man()
    clear_asset()


# ============================================================================= GEMINI'S PROPS
# Barricades, traps and fixtures were painted by Gemini (shots/siege-sprites/, SPRITES.md) at the
# cutaway's scale (2 px per unit); this copies them in and records their size. Anchors: 'base' =
# bottom centre on the floor, 'mid' = centre (wall fixtures, things in flight).
GEMINI = {
    'vend': ('trap_vend_intact', 32, 40, 'base'), 'vend_down': ('trap_vend_dropped', 48, 32, 'base'),
    'tv': ('trap_tv_intact', 24, 24, 'base'), 'tv_broken': ('trap_tv_broken', 28, 24, 'base'),
    'cart': ('trap_cart_intact', 36, 32, 'base'), 'cart_tipped': ('trap_cart_tipped', 42, 28, 'base'),
    'ac': ('trap_ac_intact', 28, 24, 'mid'), 'ac_dropped': ('trap_ac_dropped', 32, 28, 'base'),
    'fusebox': ('trap_fusebox_intact', 20, 24, 'mid'), 'fusebox_shorted': ('trap_fusebox_shorted', 24, 28, 'mid'),
    'desk': ('barricade_desk_intact', 48, 32, 'base'), 'desk_damaged': ('barricade_desk_damaged', 48, 32, 'base'),
    'mattress': ('barricade_mattress', 44, 24, 'base'), 'dresser': ('barricade_dresser', 32, 40, 'base'),
    'hatch': ('prop_roof_hatch_closed', 44, 16, 'mid'), 'hatch_open': ('prop_roof_hatch_open', 48, 44, 'mid'),
    'ext_ladder': ('prop_ext_ladder', 24, 72, 'base'), 'neon': ('prop_neon_motel_sign', 96, 56, 'base'),
}


def copy_props():
    import shutil
    src = os.path.join(ROOT, 'shots', 'siege-sprites')
    MAN['props'] = {}
    for k, (f, w, h, anchor) in GEMINI.items():
        # through the same paint filter as our own bakes, so the flat vector fills pick up brushwork
        im = bpy.data.images.load(os.path.join(src, f + '.webp'))
        W_, H_ = im.size
        a = np.empty(W_ * H_ * 4, dtype=np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
        arr = a.reshape(H_, W_, 4)[::-1].copy()
        save_np(kuwahara(arr, 1), os.path.join(OUT, f + '.webp'))
        MAN['props'][k] = {'file': f'siege/{f}.webp', 'w': w, 'h': h, 'ox': -w / 2, 'oy': -h if anchor == 'base' else -h / 2}
    save_man()
    print('props copied:', len(GEMINI), flush=True)


GROUPS = {'peds': bake_side_peds, 'motel': bake_motel, 'props': copy_props}

if __name__ == '__main__':
    todo = list(GROUPS) if GROUP == 'all' else [GROUP]
    for g in todo:
        GROUPS[g]()

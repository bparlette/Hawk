"""build_laurel_fleet.py — Blender 5.x Cycles (Metal GPU) true-silhouette 32-angle car sprite
& 3/4 hero portrait baker for Laurel/Fulton (TASK G2 + G10 v2 + Nov 17 Owner Corrections).
10 signature cars at exact 1:1 metre dimensions with unmistakable silhouettes:
  - brad_camaro87:   1987 Chevy Camaro IROC-Z (4.88x1.85m, low 1.27m wedge, two-tone white/maroon, yellow lights)
  - clayton_camaro:  1987 Chevy Camaro IROC-Z (4.88x1.85m, green metallic, low wedge, T-tops, 3-piece spoiler)
  - rigg_celica87:   1987 Toyota Celica GT ST162 (4.37x1.71m, sleek 4th-gen liftback wedge, pop-up headlights, blue)
  - lamar_mustang87: 1987 Ford Mustang GT (4.56x1.75m, Fox-body hatchback + ground effects + GT wing + ON FIRE)
  - kosack_cavalier: 1996 Chevy Cavalier Sedan (4.58x1.72m, red, rounded 3rd-gen aero nose & arched roof)
  - jason_camry89:   1989 Toyota Camry V20 (4.52x1.71m, white, plain 3-box sedan, black rub-strip)
  - zack_tracer:     1991 Mercury Tracer (4.34x1.69m, green, compact upright hatchback)
  - jimmy_astro96:   1996 Chevy Astro (4.82x1.97m, silver, tall van box w/ protruding aero nose & roof rack)
  - billy_astro94:   1994 Chevy Astro (4.75x1.96m, teal-blue, tall vertical 1st-gen flat-nose box)
  - grant_brougham:  1990 Cadillac Brougham "USS Mino" (5.61x1.91m, maroon, massive formal land-yacht slab + landau)
Usage: /opt/homebrew/bin/blender -b -P tools/build_laurel_fleet.py
"""
import os, math, shutil, subprocess
import bpy, bmesh
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.join(ROOT, 'shots', 'fleet-sprites-v2')
SIL_DIR = os.path.join(ROOT, 'shots', 'fleet-silhouettes')
TMP_DIR = '/tmp/laurel_fleet_v2'
for d in (OUT_DIR, SIL_DIR, TMP_DIR):
    os.makedirs(d, exist_ok=True)
CWEBP = '/opt/homebrew/bin/cwebp' if os.path.exists('/opt/homebrew/bin/cwebp') else 'cwebp'

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = (d.type == 'METAL')
    s.cycles.device = 'GPU'
    s.cycles.samples = 20
    s.cycles.use_denoising = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.film_transparent = True
    s.view_settings.view_transform = 'Standard'
    return s

def make_mat(name, col, metallic=0.25, roughness=0.35, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emit > 0:
        bsdf.inputs['Emission Color'].default_value = (*col, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m

def add_loft(bm, stations, mat_idx=0):
    """Loft a smooth multi-station profile along X: stations = [(x, half_w, z_bot, z_top), ...]"""
    rings = []
    for (x, hw, zb, zt) in stations:
        v0 = bm.verts.new((x, -hw, zb))
        v1 = bm.verts.new((x,  hw, zb))
        v2 = bm.verts.new((x,  hw, zt))
        v3 = bm.verts.new((x, -hw, zt))
        rings.append((v0, v1, v2, v3))
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            nk = (k + 1) % 4
            f = bm.faces.new((a[k], a[nk], b[nk], b[k]))
            f.material_index = mat_idx
    f0 = bm.faces.new((rings[0][3], rings[0][2], rings[0][1], rings[0][0])); f0.material_index = mat_idx
    f1 = bm.faces.new(rings[-1]); f1.material_index = mat_idx

def add_box(bm, cx, cy, cz, sx, sy, sz, mat_idx=0):
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret['verts']
    for v in verts:
        v.co.x = cx + v.co.x * sx
        v.co.y = cy + v.co.y * sy
        v.co.z = cz + v.co.z * sz
    for f in bm.faces:
        if all(v in verts for v in f.verts):
            f.material_index = mat_idx
    return verts

def add_cabin(bm, x0, x1, w_bot, w_top, z_bot, z_top, rake_f=0.45, rake_r=0.40, mat_glass=2, mat_roof=0):
    v000 = bm.verts.new((x0, -w_bot/2, z_bot))
    v010 = bm.verts.new((x0,  w_bot/2, z_bot))
    v100 = bm.verts.new((x1, -w_bot/2, z_bot))
    v110 = bm.verts.new((x1,  w_bot/2, z_bot))
    v001 = bm.verts.new((x0 + rake_r, -w_top/2, z_top))
    v011 = bm.verts.new((x0 + rake_r,  w_top/2, z_top))
    v101 = bm.verts.new((x1 - rake_f, -w_top/2, z_top))
    v111 = bm.verts.new((x1 - rake_f,  w_top/2, z_top))
    for vs in [(v000,v010,v011,v001), (v100,v101,v111,v110), (v000,v001,v101,v100), (v010,v110,v111,v011)]:
        f = bm.faces.new(vs); f.material_index = mat_glass
    f_top = bm.faces.new((v001, v011, v111, v101)); f_top.material_index = mat_roof

def add_wheels(bm, x_front, x_rear, track, r, w, mat_tire, mat_rim):
    for wx in (x_front, x_rear):
        for wy in (-track/2, track/2):
            ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=18, radius1=r, radius2=r, depth=w)
            verts = ret['verts']
            for v in verts:
                v.co = Vector((wx + v.co.x, wy + v.co.z, r + v.co.y))
            for f in bm.faces:
                if all(v in verts for v in f.verts):
                    f.material_index = mat_tire
            sign = 1 if wy > 0 else -1
            ret2 = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=14, radius1=r*0.58, radius2=r*0.58, depth=0.04)
            v2 = ret2['verts']
            for v in v2:
                v.co = Vector((wx + v.co.x, wy + sign*(w*0.48) + v.co.z, r + v.co.y))
            for f in bm.faces:
                if all(v in v2 for v in f.verts):
                    f.material_index = mat_rim

FLEET = [
    ('brad_camaro87',   'Brad · 87 Camaro IROC-Z',   4.88, 1.85, 'camaro',   (0.95, 0.94, 0.92), (0.48, 0.08, 0.14), (1.0, 0.86, 0.25), 'twotone'),
    ('clayton_camaro',  'Clayton · 87 Camaro',       4.88, 1.85, 'camaro',   (0.11, 0.39, 0.22), (0.11, 0.39, 0.22), (1.0, 0.95, 0.84), None),
    ('rigg_celica87',   'Rigg · 87 Celica GT',       4.37, 1.71, 'celica87', (0.14, 0.38, 0.78), (0.12, 0.13, 0.16), (0.42, 0.78, 1.0), 'popup'),
    ('lamar_mustang87', 'Lamar · 87 Mustang GT',     4.56, 1.75, 'mustang87',(0.62, 0.65, 0.70), (0.14, 0.14, 0.17), (1.0, 0.95, 0.82), 'fire'),
    ('kosack_cavalier', 'Kosack · 96 Cavalier',      4.58, 1.72, 'cavalier96',(0.80, 0.11, 0.14),(0.14, 0.14, 0.16), (1.0, 0.96, 0.85), None),
    ('jason_camry89',   'Jason · 89 Camry V20',      4.52, 1.71, 'camry89',  (0.93, 0.93, 0.91), (0.15, 0.15, 0.17), (1.0, 0.95, 0.84), None),
    ('zack_tracer',     'Zack · Mercury Tracer',     4.34, 1.69, 'tracer',   (0.16, 0.46, 0.26), (0.16, 0.17, 0.19), (1.0, 0.95, 0.84), None),
    ('jimmy_astro96',   'Jimmy · 96 Astro (Aero)',   4.82, 1.97, 'astro96',  (0.76, 0.78, 0.82), (0.15, 0.16, 0.18), (1.0, 0.96, 0.88), None),
    ('billy_astro94',   'Billy · 94 Astro (Boxy)',   4.75, 1.96, 'astro94',  (0.11, 0.48, 0.56), (0.14, 0.15, 0.18), (1.0, 0.95, 0.82), None),
    ('grant_brougham',  'Grant · Cadillac USS Mino', 5.61, 1.91, 'brougham', (0.44, 0.08, 0.14), (0.26, 0.05, 0.08), (1.0, 0.95, 0.82), None),
]

def build_car_mesh(spec):
    cid, _, L, W, style, c1, c2, lcol, extra = spec
    bm = bmesh.new()
    mats = [
        make_mat('p1', c1, metallic=0.35, roughness=0.28),
        make_mat('p2', c2, metallic=0.25 if style == 'camaro' else 0.08, roughness=0.35 if style == 'camaro' else 0.7),
        make_mat('glass', (0.07, 0.11, 0.17), metallic=0.1, roughness=0.12),
        make_mat('tire', (0.06, 0.06, 0.07), metallic=0.0, roughness=0.85),
        make_mat('chrome', (0.86, 0.88, 0.90), metallic=0.9, roughness=0.18),
        make_mat('hl', lcol, metallic=0.0, roughness=0.2, emit=1.8),
        make_mat('tl', (0.82, 0.10, 0.12), metallic=0.0, roughness=0.25, emit=0.9),
        make_mat('fire_o', (1.0, 0.34, 0.04), metallic=0.0, roughness=0.5, emit=3.8),
        make_mat('fire_y', (1.0, 0.82, 0.14), metallic=0.0, roughness=0.4, emit=4.8),
    ]
    hx, hw = L / 2, W / 2

    if style == 'camaro':
        mfront, mrear = 0, (1 if extra == 'twotone' else 0)
        add_loft(bm, [(0.15, hw*0.97, 0.18, 0.72), (1.35, hw*0.94, 0.19, 0.64), (hx-0.30, hw*0.86, 0.21, 0.50), (hx, hw*0.68, 0.24, 0.40)], mfront)
        add_loft(bm, [(-hx, hw*0.88, 0.20, 0.76), (-hx+0.35, hw*0.95, 0.18, 0.78), (0.15, hw*0.97, 0.18, 0.72)], mrear)
        for sy in (-0.30, 0.30): add_box(bm, 0.85, sy, 0.64, 0.62, 0.20, 0.04, 3)
        add_cabin(bm, -1.78, 0.28, hw*1.60, hw*1.42, 0.73, 1.16, 0.68, 0.92, 2, mrear)
        for sy in (-0.34, 0.34): add_box(bm, -0.58, sy, 1.17, 0.42, 0.38, 0.02, 2)
        add_box(bm, -hx + 0.14, 0.0, 0.84, 0.24, W * 0.92, 0.07, mrear)
        add_wheels(bm, 1.28, -1.28, W * 0.88, 0.32, 0.24, 3, 4)

    elif style == 'celica87':
        add_loft(bm, [(-hx, hw*0.86, 0.20, 0.76), (-1.2, hw*0.96, 0.18, 0.78), (0.35, hw*0.96, 0.18, 0.72), (1.45, hw*0.90, 0.20, 0.60), (hx, hw*0.74, 0.22, 0.44)], 0)
        for sy in (-hw*0.58, hw*0.58):
            add_box(bm, hx - 0.36, sy, 0.56, 0.34, 0.30, 0.12, 0)
            add_box(bm, hx - 0.18, sy, 0.56, 0.06, 0.26, 0.10, 5)
        add_cabin(bm, -1.78, 0.30, hw*1.58, hw*1.38, 0.74, 1.22, 0.64, 0.88, 2, 0)
        add_box(bm, -hx + 0.12, 0, 0.80, 0.18, W * 0.86, 0.05, 0)
        add_wheels(bm, 1.26, -1.26, W * 0.88, 0.30, 0.21, 3, 4)

    elif style == 'mustang87':
        add_loft(bm, [(-hx, hw*0.90, 0.18, 0.80), (-1.1, hw*0.97, 0.16, 0.80), (0.35, hw*0.97, 0.16, 0.76), (1.50, hw*0.92, 0.18, 0.66), (hx, hw*0.80, 0.20, 0.52)], 0)
        for sy in (-0.28, 0.28): add_box(bm, 0.92, sy, 0.75, 0.45, 0.18, 0.07, 1)
        add_cabin(bm, -1.85, 0.35, hw*1.62, hw*1.44, 0.78, 1.28, 0.54, 0.84, 2, 0)
        add_box(bm, -hx + 0.16, 0, 0.90, 0.28, W * 0.90, 0.08, 0)
        for fx, fy, fz, fr in [(1.15, 0.15, 0.88, 0.30), (0.85, -0.22, 0.95, 0.36), (1.35, -0.10, 0.80, 0.24), (0.60, 0.10, 1.12, 0.28)]:
            ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=fr)
            for v in ret['verts']: v.co = Vector((fx + v.co.x*1.1, fy + v.co.y, fz + v.co.z*1.7))
            for f in bm.faces:
                if all(v in ret['verts'] for v in f.verts): f.material_index = 7
        for fx, fy, fz, fr in [(1.05, 0.05, 0.98, 0.20), (0.82, -0.12, 1.10, 0.22)]:
            ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=fr)
            for v in ret['verts']: v.co = Vector((fx + v.co.x, fy + v.co.y, fz + v.co.z*1.5))
            for f in bm.faces:
                if all(v in ret['verts'] for v in f.verts): f.material_index = 8
        add_wheels(bm, 1.30, -1.26, W * 0.88, 0.31, 0.23, 3, 4)

    elif style == 'cavalier96':
        add_loft(bm, [(-hx, hw*0.84, 0.22, 0.78), (-1.4, hw*0.95, 0.20, 0.80), (0.45, hw*0.95, 0.20, 0.76), (1.55, hw*0.90, 0.21, 0.64), (hx, hw*0.74, 0.24, 0.50)], 0)
        add_cabin(bm, -1.48, 0.48, hw*1.60, hw*1.42, 0.78, 1.32, 0.56, 0.52, 2, 0)
        add_wheels(bm, 1.32, -1.30, W * 0.88, 0.29, 0.20, 3, 4)

    elif style == 'brougham':
        add_loft(bm, [(-hx, hw*0.96, 0.22, 0.84), (0.45, hw*0.98, 0.22, 0.86), (hx, hw*0.94, 0.24, 0.78)], 0)
        add_box(bm, hx + 0.04, 0, 0.34, 0.14, W * 0.96, 0.18, 4)
        add_box(bm, -hx - 0.04, 0, 0.34, 0.14, W * 0.96, 0.18, 4)
        add_box(bm, hx - 0.32, 0, 0.87, 0.08, 0.08, 0.06, 4)
        add_cabin(bm, -1.45, 0.52, hw*1.68, hw*1.58, 0.85, 1.42, 0.28, 0.18, 2, 0)
        add_box(bm, -0.84, 0, 1.425, 0.82, W * 0.80, 0.04, 1)
        add_wheels(bm, 1.64, -1.52, W * 0.90, 0.35, 0.24, 3, 4)

    elif style in ('astro96', 'astro94'):
        nose = 0.72 if style == 'astro96' else 0.24
        cab_x1 = hx - nose
        add_loft(bm, [(-hx, hw*0.96, 0.22, 1.06), (cab_x1, hw*0.98, 0.22, 1.06), (hx, hw*(0.84 if style=='astro96' else 0.95), 0.26, 0.78 if style=='astro96' else 1.00)], 0)
        add_cabin(bm, -hx + 0.06, cab_x1 - 0.04, hw*1.84, hw*1.68, 1.04, 1.86, 0.52 if style=='astro96' else 0.20, 0.10, 2, 0)
        add_box(bm, hx - 0.03, 0, 0.30, 0.12, W * 0.92, 0.14, 1)
        add_box(bm, -hx + 0.03, 0, 0.30, 0.12, W * 0.94, 0.14, 1)
        if style == 'astro96':
            for sy in (-0.54, 0.54): add_box(bm, -0.45, sy, 1.89, 2.2, 0.06, 0.05, 3)
            for rx in (-1.35, -0.45, 0.40): add_box(bm, rx, 0, 1.88, 0.06, 1.08, 0.04, 3)
        add_wheels(bm, 1.38, -1.42, W * 0.90, 0.35, 0.24, 3, 4)

    elif style == 'tracer':
        add_loft(bm, [(-hx, hw*0.92, 0.22, 0.80), (0.35, hw*0.96, 0.22, 0.78), (hx, hw*0.86, 0.24, 0.62)], 0)
        add_cabin(bm, -hx + 0.10, 0.38, hw*1.68, hw*1.52, 0.78, 1.35, 0.38, 0.20, 2, 0)
        add_wheels(bm, 1.22, -1.20, W * 0.88, 0.29, 0.20, 3, 4)

    else:
        add_loft(bm, [(-hx, hw*0.90, 0.22, 0.78), (0.40, hw*0.96, 0.22, 0.78), (hx, hw*0.86, 0.24, 0.64)], 0)
        for sy in (-hw*0.97, hw*0.97): add_box(bm, 0, sy, 0.48, L * 0.92, 0.03, 0.07, 1)
        add_cabin(bm, -1.40, 0.42, hw*1.62, hw*1.46, 0.78, 1.32, 0.44, 0.40, 2, 0)
        add_wheels(bm, 1.28, -1.26, W * 0.88, 0.30, 0.21, 3, 4)

    hl_z = 0.52 if style in ('astro96', 'astro94') else 0.46
    for sy in (-W * 0.33, W * 0.33):
        if style != 'celica87':
            add_box(bm, hx - 0.02, sy, hl_z, 0.08, 0.26, 0.12, 5)
        add_box(bm, -hx + 0.02, sy, hl_z, 0.08, 0.28, 0.12, 6)

    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.022, segments=2, affect='EDGES', clamp_overlap=True)
    mesh = bpy.data.meshes.new(cid)
    bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(cid, mesh)
    for m in mats: obj.data.materials.append(m)
    return obj

def setup_lights(s):
    sun = bpy.data.lights.new('Sun', type='SUN')
    sun.energy = 3.6; sun.color = (1.0, 0.93, 0.82)
    sobj = bpy.data.objects.new('Sun', sun)
    sobj.rotation_euler = (math.radians(38), math.radians(15), math.radians(-115))
    s.collection.objects.link(sobj)
    world = bpy.data.worlds.new('W'); world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.55, 0.58, 0.72, 1.0); bg.inputs['Strength'].default_value = 0.9
    s.world = world

for spec in FLEET:
    cid = spec[0]
    s = clear_scene()
    setup_lights(s)
    car = build_car_mesh(spec)
    s.collection.objects.link(car)

    # 1) 3/4 Hero Portrait (320x200)
    cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 45
    cam = bpy.data.objects.new('Cam', cam_d)
    s.collection.objects.link(cam); s.camera = cam
    cam.location = Vector((4.9, -4.5, 2.35))
    cam.rotation_euler = (Vector((0, 0, 0.55)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.resolution_x = 320; s.render.resolution_y = 200
    hp = os.path.join(TMP_DIR, f'{cid}_hero.png'); s.render.filepath = hp
    bpy.ops.render.render(write_still=True)
    subprocess.run([CWEBP, '-q', '92', '-alpha_q', '100', hp, '-o', os.path.join(OUT_DIR, f'{cid}_hero.webp')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2) Side-profile silhouette (pure alpha mask for G10 silhouette check!)
    cam_d.type = 'ORTHO'; cam_d.ortho_scale = 6.2
    cam.location = Vector((0.0, -10.0, 0.9))
    cam.rotation_euler = (Vector((0, 0, 0.9)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.resolution_x = 260; s.render.resolution_y = 110
    sp = os.path.join(SIL_DIR, f'{cid}_side.png'); s.render.filepath = sp
    bpy.ops.render.render(write_still=True)

    # 3) Top-down 32-angle sprite sheet (1280x640, 2.5 px/wu)
    cam_d.ortho_scale = 6.4
    cam.location = Vector((0.0, -0.55, 12.0))
    cam.rotation_euler = (math.radians(2.6), 0.0, 0.0)
    s.render.resolution_x = 160; s.render.resolution_y = 160
    arr = np.zeros((160 * 4, 160 * 8, 4), dtype=np.float32)
    for i in range(32):
        car.rotation_euler = (0.0, 0.0, i * math.tau / 32.0)
        fp = os.path.join(TMP_DIR, f'{cid}_{i:02d}.png')
        s.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        if i == 0:
            shutil.copyfile(fp, os.path.join(SIL_DIR, f'{cid}_top.png'))
        im = bpy.data.images.load(fp, check_existing=False)
        px = np.array(im.pixels[:], dtype=np.float32).reshape((160, 160, 4))
        col, row = i % 8, 3 - (i // 8)
        arr[row * 160:(row + 1) * 160, col * 160:(col + 1) * 160] = px
        bpy.data.images.remove(im)
    sh_img = bpy.data.images.new('sheet', width=160 * 8, height=160 * 4, alpha=True)
    sh_img.pixels[:] = arr.ravel()
    sheet_png = os.path.join(TMP_DIR, f'{cid}_sheet.png')
    sh_img.filepath_raw = sheet_png; sh_img.file_format = 'PNG'; sh_img.save()
    bpy.data.images.remove(sh_img)
    subprocess.run([CWEBP, '-q', '90', '-alpha_q', '100', sheet_png, '-o', os.path.join(OUT_DIR, f'{cid}.webp')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

shutil.rmtree(TMP_DIR, ignore_errors=True)
print('LAUREL FLEET V2 BAKED:', OUT_DIR)

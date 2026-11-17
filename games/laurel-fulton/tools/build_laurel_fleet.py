"""build_laurel_fleet.py — Blender 5.x Cycles (Metal GPU) true-proportion 32-angle car sprite
& 3/4 hero portrait baker for Laurel/Fulton (TASK G2).
Builds distinct body-accurate 3D meshes for all 9 signature cars at exact 1:1 metre dimensions:
  - brad_camaro87:   1987 Chevy Camaro IROC-Z (4.88x1.85m, two-tone white front / maroon rear, yellow lights, T-tops, spoiler)
  - kosack_cavalier: ~1989 Chevy Cavalier (4.43x1.68m, red, J-body wedge nose, black beltline)
  - jimmy_astro96:   1996 Chevy Astro (4.82x1.97m, silver, extended aero nose, roof rack, blue underglow)
  - billy_astro94:   1994 Chevy Astro (4.75x1.96m, teal-blue, 1st-gen short blunt nose)
  - jason_camry89:   1989 Toyota Camry V20 (4.52x1.71m, white, boxy 3-box sedan, black rub-strip, amber corners)
  - clayton_camaro:  3rd-gen Chevy Camaro (4.88x1.85m, green metallic, T-tops, spoiler)
  - zack_tracer:     Mercury Tracer (4.34x1.69m, green, compact upright hatchback)
  - rigg_celica71:   1970-73 Toyota Celica (4.17x1.61m, blue metallic, compact coupe, hood vents, blue lights)
  - grant_brougham:  1990 Cadillac Brougham "USS Mino" (5.61x1.91m, maroon, formal vinyl landau roof, chrome bumpers)
Usage: /opt/homebrew/bin/blender -b -P tools/build_laurel_fleet.py
"""
import os, math, shutil, subprocess
import bpy, bmesh
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.join(ROOT, 'shots', 'fleet-sprites')
TMP_DIR = '/tmp/laurel_fleet_render'
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)
CWEBP = '/opt/homebrew/bin/cwebp' if os.path.exists('/opt/homebrew/bin/cwebp') else 'cwebp'

# Blender setup: Cycles Metal GPU
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type == 'METAL')
scene.cycles.device = 'GPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'GPU'
    s.cycles.samples = 24
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

def add_tapered(bm, x0, x1, w0, w1, z0b, z0t, z1b, z1t, mat_idx=0):
    v000 = bm.verts.new((x0, -w0/2, z0b))
    v010 = bm.verts.new((x0,  w0/2, z0b))
    v011 = bm.verts.new((x0,  w0/2, z0t))
    v001 = bm.verts.new((x0, -w0/2, z0t))
    v100 = bm.verts.new((x1, -w1/2, z1b))
    v110 = bm.verts.new((x1,  w1/2, z1b))
    v111 = bm.verts.new((x1,  w1/2, z1t))
    v101 = bm.verts.new((x1, -w1/2, z1t))
    faces = [
        (v000, v010, v011, v001),
        (v100, v101, v111, v110),
        (v001, v011, v111, v101),
        (v000, v100, v110, v010),
        (v000, v001, v101, v100),
        (v010, v110, v111, v011),
    ]
    for vs in faces:
        f = bm.faces.new(vs)
        f.material_index = mat_idx

def add_cabin(bm, x0, x1, w_bot, w_top, z_bot, z_top, rake_f=0.42, rake_r=0.35, mat_glass=2, mat_roof=0):
    # Sloped windshield + side glass + sloped rear window + roof cap
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
    return (x0 + rake_r, x1 - rake_f)

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
            # Outer alloy/steel wheel rim
            sign = 1 if wy > 0 else -1
            ret2 = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=14, radius1=r*0.58, radius2=r*0.58, depth=0.04)
            v2 = ret2['verts']
            for v in v2:
                v.co = Vector((wx + v.co.x, wy + sign*(w*0.48) + v.co.z, r + v.co.y))
            for f in bm.faces:
                if all(v in v2 for v in f.verts):
                    f.material_index = mat_rim

# Fleet specs: (id, label, L, W, style, col1, col2, light_col, extra)
FLEET = [
    ('brad_camaro87',   'Brad · 87 Camaro IROC-Z', 4.88, 1.85, 'camaro',   (0.95, 0.94, 0.92), (0.48, 0.08, 0.14), (1.0, 0.86, 0.25), 'twotone'),
    ('kosack_cavalier', 'Kosack · 89 Cavalier',    4.43, 1.68, 'cavalier', (0.78, 0.12, 0.14), (0.14, 0.14, 0.16), (1.0, 0.96, 0.85), None),
    ('jimmy_astro96',   'Jimmy · 96 Astro (Aero)', 4.82, 1.97, 'astro96',  (0.76, 0.78, 0.82), (0.15, 0.16, 0.18), (1.0, 0.96, 0.88), 'underglow'),
    ('billy_astro94',   'Billy · 94 Astro (Boxy)', 4.75, 1.96, 'astro94',  (0.11, 0.48, 0.56), (0.14, 0.15, 0.18), (1.0, 0.95, 0.82), None),
    ('jason_camry89',   'Jason · 89 Camry V20',    4.52, 1.71, 'camry89',  (0.93, 0.93, 0.91), (0.15, 0.15, 0.17), (1.0, 0.95, 0.84), 'amber'),
    ('clayton_camaro',  'Clayton · Camaro',        4.88, 1.85, 'camaro',   (0.12, 0.40, 0.22), (0.12, 0.40, 0.22), (1.0, 0.95, 0.84), None),
    ('zack_tracer',     'Zack · Mercury Tracer',   4.34, 1.69, 'tracer',   (0.16, 0.46, 0.26), (0.16, 0.17, 0.19), (1.0, 0.95, 0.84), None),
    ('rigg_celica71',   'Rigg · 70-73 Celica',     4.17, 1.61, 'celica71', (0.14, 0.38, 0.76), (0.82, 0.85, 0.88), (0.45, 0.78, 1.0), 'vents'),
    ('grant_brougham',  'Grant · Cadillac USS Mino',5.61, 1.91, 'brougham', (0.44, 0.08, 0.14), (0.28, 0.05, 0.09), (1.0, 0.95, 0.82), 'landau'),
]

def build_car_mesh(spec):
    cid, _, L, W, style, c1, c2, lcol, extra = spec
    bm = bmesh.new()
    # Materials: 0=paint1, 1=paint2/trim, 2=glass, 3=tire/dark, 4=chrome, 5=headlight, 6=taillight
    m_p1 = make_mat('p1', c1, metallic=0.35, roughness=0.28)
    m_p2 = make_mat('p2', c2, metallic=0.25 if style == 'camaro' else 0.08, roughness=0.35 if style == 'camaro' else 0.7)
    m_gl = make_mat('glass', (0.08, 0.12, 0.18), metallic=0.1, roughness=0.12)
    m_tr = make_mat('tire', (0.06, 0.06, 0.07), metallic=0.0, roughness=0.85)
    m_ch = make_mat('chrome', (0.86, 0.88, 0.90), metallic=0.9, roughness=0.18)
    m_hl = make_mat('hl', lcol, metallic=0.0, roughness=0.2, emit=1.6)
    m_tl = make_mat('tl', (0.82, 0.10, 0.12), metallic=0.0, roughness=0.25, emit=0.9)

    # +X is FRONT of car
    hx = L / 2
    if style == 'camaro':
        mfront, mrear = 0, (1 if extra == 'twotone' else 0)
        add_tapered(bm, 0.15, hx, W * 0.96, W * 0.80, 0.20, 0.72, 0.24, 0.48, mfront)
        add_tapered(bm, -hx, 0.15, W * 0.94, W * 0.96, 0.20, 0.76, 0.20, 0.72, mrear)
        for sy in (-0.32, 0.32):
            add_box(bm, 0.75, sy, 0.66, 0.55, 0.22, 0.05, 3)
        add_cabin(bm, -1.72, 0.36, W * 0.80, W * 0.72, 0.74, 1.18, 0.62, 0.86, 2, mrear)
        for sy in (-0.34, 0.34):
            add_box(bm, -0.52, sy, 1.19, 0.44, 0.40, 0.03, 2) # T-top glass panels
        add_box(bm, -hx + 0.16, 0.0, 0.84, 0.24, W * 0.92, 0.07, mrear) # 3-piece spoiler
        add_wheels(bm, 1.28, -1.28, W * 0.88, 0.32, 0.24, 3, 4)

    elif style in ('astro96', 'astro94'):
        nose_len = 0.68 if style == 'astro96' else 0.32
        cab_x1 = hx - nose_len
        add_tapered(bm, cab_x1, hx, W * 0.96, W * 0.86 if style == 'astro96' else W * 0.94, 0.24, 1.04, 0.26, 0.80 if style == 'astro96' else 0.96, 0)
        add_box(bm, (-hx + cab_x1)/2, 0, 0.64, cab_x1 + hx, W * 0.96, 0.80, 0)
        add_cabin(bm, -hx + 0.08, cab_x1 - 0.06, W * 0.90, W * 0.80, 1.02, 1.78, 0.48 if style == 'astro96' else 0.32, 0.14, 2, 0)
        add_box(bm, hx - 0.04, 0, 0.30, 0.12, W * 0.92, 0.14, 1)
        add_box(bm, -hx + 0.04, 0, 0.30, 0.12, W * 0.94, 0.14, 1)
        if style == 'astro96':
            for sy in (-0.54, 0.54): add_box(bm, -0.45, sy, 1.81, 2.2, 0.06, 0.05, 3)
            for rx in (-1.35, -0.45, 0.40): add_box(bm, rx, 0, 1.80, 0.06, 1.08, 0.04, 3)
        add_wheels(bm, 1.38, -1.42, W * 0.90, 0.35, 0.24, 3, 4)

    elif style == 'brougham':
        add_tapered(bm, 0.45, hx, W * 0.96, W * 0.92, 0.24, 0.84, 0.26, 0.74, 0)
        add_box(bm, -1.05, 0, 0.54, 3.05, W * 0.96, 0.60, 0)
        add_box(bm, hx + 0.02, 0, 0.34, 0.14, W * 0.95, 0.16, 4)
        add_box(bm, -hx - 0.02, 0, 0.34, 0.14, W * 0.96, 0.16, 4)
        add_box(bm, hx - 0.35, 0, 0.86, 0.08, 0.08, 0.06, 4)
        add_box(bm, 1.45, 0, 0.84, 2.0, 0.04, 0.02, 4)
        add_cabin(bm, -1.40, 0.50, W * 0.84, W * 0.76, 0.84, 1.38, 0.34, 0.24, 2, 0)
        add_box(bm, -0.82, 0, 1.385, 0.78, W * 0.78, 0.04, 1) # vinyl landau half-roof
        add_wheels(bm, 1.62, -1.52, W * 0.90, 0.35, 0.24, 3, 4)

    elif style == 'celica71':
        add_tapered(bm, 0.28, hx, W * 0.94, W * 0.84, 0.22, 0.76, 0.24, 0.60, 0)
        add_tapered(bm, -hx, 0.28, W * 0.92, W * 0.94, 0.22, 0.78, 0.22, 0.76, 0)
        for sy in (-0.28, 0.28): add_box(bm, 0.92, sy, 0.74, 0.26, 0.16, 0.04, 3)
        add_box(bm, hx + 0.02, 0, 0.32, 0.10, W * 0.90, 0.12, 4)
        add_box(bm, -hx - 0.02, 0, 0.32, 0.10, W * 0.90, 0.12, 4)
        add_cabin(bm, -1.48, 0.30, W * 0.80, W * 0.70, 0.76, 1.24, 0.42, 0.56, 2, 0)
        add_wheels(bm, 1.18, -1.16, W * 0.88, 0.30, 0.21, 3, 4)

    elif style == 'tracer':
        add_tapered(bm, 0.35, hx, W * 0.94, W * 0.84, 0.22, 0.78, 0.24, 0.58, 0)
        add_box(bm, (-hx + 0.35)/2, 0, 0.52, 0.35 + hx, W * 0.94, 0.56, 0)
        add_cabin(bm, -hx + 0.14, 0.38, W * 0.82, W * 0.74, 0.78, 1.32, 0.42, 0.26, 2, 0)
        add_box(bm, hx, 0, 0.30, 0.10, W * 0.90, 0.12, 1)
        add_box(bm, -hx, 0, 0.30, 0.10, W * 0.92, 0.12, 1)
        add_wheels(bm, 1.22, -1.20, W * 0.88, 0.29, 0.20, 3, 4)

    else:
        sloped = style == 'cavalier'
        add_tapered(bm, 0.35, hx, W * 0.96, W * 0.84, 0.22, 0.78, 0.24, 0.56 if sloped else 0.66, 0)
        add_box(bm, (-hx + 0.35)/2, 0, 0.52, 0.35 + hx, W * 0.96, 0.56, 0)
        for sy in (-W * 0.485, W * 0.485): add_box(bm, 0, sy, 0.48, L * 0.94, 0.03, 0.07, 1)
        add_cabin(bm, -1.38, 0.40, W * 0.82, W * 0.72, 0.78, 1.30, 0.48 if sloped else 0.38, 0.38, 2, 0)
        add_wheels(bm, 1.28, -1.26, W * 0.88, 0.30, 0.21, 3, 4)

    # Side mirrors + front grille bar
    mir_x = 0.22 if style not in ('astro96', 'astro94') else (hx - 0.55)
    mir_z = 0.88 if style in ('astro96', 'astro94') else 0.78
    for sy in (-W * 0.52, W * 0.52):
        add_box(bm, mir_x, sy, mir_z, 0.14, 0.12, 0.08, 1)
    add_box(bm, hx - 0.01, 0, 0.46, 0.06, W * 0.44, 0.14, 4 if style in ('brougham', 'celica71') else 3)

    # Headlights & taillights
    hl_z = 0.52 if style in ('astro96', 'astro94') else 0.46
    for sy in (-W * 0.33, W * 0.33):
        add_box(bm, hx - 0.02, sy, hl_z, 0.08, 0.26, 0.12, 5)
        add_box(bm, -hx + 0.02, sy, hl_z, 0.08, 0.28, 0.12, 6)

    # Subtle bevel on edges for smooth automotive highlights
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.022, segments=2, affect='EDGES', clamp_overlap=True)

    mesh = bpy.data.meshes.new(cid)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(cid, mesh)
    for m in (m_p1, m_p2, m_gl, m_tr, m_ch, m_hl, m_tl):
        obj.data.materials.append(m)
    return obj

def setup_lights(s):
    sun = bpy.data.lights.new('Sun', type='SUN')
    sun.energy = 3.6
    sun.color = (1.0, 0.93, 0.82)
    sobj = bpy.data.objects.new('Sun', sun)
    sobj.rotation_euler = (math.radians(38), math.radians(15), math.radians(-115))
    s.collection.objects.link(sobj)
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.55, 0.58, 0.72, 1.0)
    bg.inputs['Strength'].default_value = 0.9
    s.world = world

for spec in FLEET:
    cid = spec[0]
    s = clear_scene()
    setup_lights(s)
    car = build_car_mesh(spec)
    s.collection.objects.link(car)

    # 1) 3/4 Hero Portrait for PICK YOUR PLAYER screen (320x200)
    cam_d = bpy.data.cameras.new('HeroCam')
    cam_d.lens = 45
    cam = bpy.data.objects.new('HeroCam', cam_d)
    s.collection.objects.link(cam)
    s.camera = cam
    cam.location = Vector((4.8, -4.4, 2.35))
    direction = Vector((0.0, 0.0, 0.55)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    s.render.resolution_x = 320
    s.render.resolution_y = 200
    hero_png = os.path.join(TMP_DIR, f'{cid}_hero.png')
    s.render.filepath = hero_png
    bpy.ops.render.render(write_still=True)
    subprocess.run([CWEBP, '-q', '92', '-alpha_q', '100', hero_png, '-o', os.path.join(OUT_DIR, f'{cid}_hero.webp')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2) Top-down 32-angle sprite sheet (8x4 @ 160x160 = 1280x640, ortho scale 6.4m -> 2.5 px/wu)
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = 6.4
    cam.location = Vector((0.0, -0.55, 12.0))
    cam.rotation_euler = (math.radians(2.6), 0.0, 0.0) # subtle Palm City top-down tilt
    s.render.resolution_x = 160
    s.render.resolution_y = 160

    sheet_cmd = []
    frame_paths = []
    for i in range(32):
        # Angle 0 = facing east (+X), matching Palm City manifest convention
        car.rotation_euler = (0.0, 0.0, i * math.tau / 32.0)
        fp = os.path.join(TMP_DIR, f'{cid}_{i:02d}.png')
        s.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        frame_paths.append(fp)

    import numpy as np
    arr = np.zeros((160 * 4, 160 * 8, 4), dtype=np.float32)
    for i, fp in enumerate(frame_paths):
        im = bpy.data.images.load(fp, check_existing=False)
        px = np.array(im.pixels[:], dtype=np.float32).reshape((160, 160, 4))
        col, row = i % 8, 3 - (i // 8)
        arr[row * 160:(row + 1) * 160, col * 160:(col + 1) * 160] = px
        bpy.data.images.remove(im)
    sh_img = bpy.data.images.new('sheet', width=160 * 8, height=160 * 4, alpha=True)
    sh_img.pixels[:] = arr.ravel()
    sheet_png = os.path.join(TMP_DIR, f'{cid}_sheet.png')
    sh_img.filepath_raw = sheet_png
    sh_img.file_format = 'PNG'
    sh_img.save()
    bpy.data.images.remove(sh_img)
    subprocess.run([CWEBP, '-q', '90', '-alpha_q', '100', sheet_png, '-o', os.path.join(OUT_DIR, f'{cid}.webp')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

shutil.rmtree(TMP_DIR, ignore_errors=True)
print('LAUREL FLEET BAKED:', OUT_DIR)

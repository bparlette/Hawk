"""bake_sprites.py — model Palm City's cars, people, buildings and props in Blender and render
them straight down as sprites with the golden-hour sun baked in.

Run (from games/palm-city/):
    blender -b -P tools/bake_sprites.py -- cars            # one group
    blender -b -P tools/bake_sprites.py -- all             # everything
    blender -b -P tools/bake_sprites.py -- buildings hotel # one building
    add --quick for low-sample previews

Every asset gets up to three passes, all orthographic, camera looking straight down:
  color  : the object lit by the low warm sun + cool sky fill, transparent background
  shadow : shadow-catcher ground only (object invisible to camera) -> alpha = shadow density
  night  : sun off, black sky, emissive windows / lamps / headlights lighting a ground plane ->
           an additive light layer the game fades in at dusk
Rotating things (cars, people) are rendered at many angles so the baked light stays fixed in
world space. Output: assets/*.png + assets/manifest.json (sprite frames in world units).
"""
import bpy, bmesh, json, math, os, sys, random, time
import numpy as np
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets')
TMP = os.path.join('/tmp', 'palm_bake')
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
LAYOUT = json.load(open(os.path.join(ROOT, 'layout.json')))
UPM = LAYOUT['unitsPerMetre']  # world units per metre

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
QUICK = '--quick' in argv
argv = [a for a in argv if not a.startswith('--')]
GROUP = argv[0] if argv else 'all'
ONLY = set(argv[1:])

SUN_AZ = math.radians(LAYOUT['sun']['azimuthDeg'])
SUN_EL = math.radians(LAYOUT['sun']['elevationDeg'])
SUN_VEC = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))
SHADOW_DIR = Vector((-SUN_VEC.x, -SUN_VEC.y, 0)).normalized()  # direction shadows fall on the ground
SHADOW_PER_M = 1 / math.tan(SUN_EL)

MANIFEST_PATH = os.path.join(OUT, 'manifest.json')
MANIFEST = json.load(open(MANIFEST_PATH)) if os.path.exists(MANIFEST_PATH) else {}


# ----------------------------------------------------------------------------- scene setup
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU setup failed, using CPU:', e)
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.render.resolution_percentage = 100
    # world: cool violet sky fill
    w = bpy.data.worlds.new('sky')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.42, 0.46, 0.78, 1)
    bg.inputs[1].default_value = 0.55
    # sun
    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = 4.2
    ld.color = (1.0, 0.74, 0.50)
    ld.angle = math.radians(2.5)
    sun = bpy.data.objects.new('sun', ld)
    sc.collection.objects.link(sun)
    sun.rotation_euler = SUN_VEC.to_track_quat('Z', 'Y').to_euler()
    # camera
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.clip_start = 0.1
    cd.clip_end = 500
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    # ground plane (shadow catcher / night light catcher)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    g = bpy.context.active_object
    g.name = 'ground'
    gm = bpy.data.materials.new('ground')
    gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.52, 0.5, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    g.data.materials.append(gm)
    return sc


def set_samples(n):
    bpy.context.scene.cycles.samples = max(4, n // 4) if QUICK else n


ASSET_OBJS = []
EMITTERS = []  # (material, night strength, day strength)


def track(o):
    ASSET_OBJS.append(o)
    return o


def clear_asset():
    for o in list(ASSET_OBJS):
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except ReferenceError:
            pass
    ASSET_OBJS.clear()
    EMITTERS.clear()
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)
    for l in list(bpy.data.lights):
        if l.users == 0:
            bpy.data.lights.remove(l)


def set_pass(mode):
    """mode: color | shadow | night"""
    sc = bpy.context.scene
    ground = bpy.data.objects['ground']
    sun = bpy.data.objects['sun']
    bg = sc.world.node_tree.nodes['Background']
    for o in ASSET_OBJS:
        o.visible_camera = (mode != 'shadow')
    for o in ASSET_OBJS:
        if o.type == 'LIGHT':
            o.hide_render = (mode != 'night')
    if mode == 'color':
        sc.render.film_transparent = True
        ground.hide_render = True
        sun.hide_render = False
        bg.inputs[1].default_value = 0.55
        set_samples(48)
    elif mode == 'shadow':
        sc.render.film_transparent = True
        ground.hide_render = False
        ground.is_shadow_catcher = True
        sun.hide_render = False
        bg.inputs[1].default_value = 0.55
        set_samples(32)
    else:  # night
        sc.render.film_transparent = False
        ground.hide_render = False
        ground.is_shadow_catcher = False
        sun.hide_render = True
        bg.inputs[1].default_value = 0.0
        set_samples(64)
    for mat, night, day in EMITTERS:
        mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = night if mode == 'night' else day


def frame(cx, cy, wm, hm, ppm):
    sc = bpy.context.scene
    cam = sc.camera
    cam.location = (cx, cy, 200)
    cam.rotation_euler = (0, 0, 0)
    cam.data.ortho_scale = max(wm, hm)
    sc.render.resolution_x = max(4, int(round(wm * ppm)))
    sc.render.resolution_y = max(4, int(round(hm * ppm)))


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ----------------------------------------------------------------------------- image helpers (numpy)
def load_np(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1].copy()  # top-down rows


def save_np(arr, path):
    h, w = arr.shape[:2]
    im = bpy.data.images.new('out', w, h, alpha=True)
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


def box_mean(a, r):
    """mean over (2r+1)^2 window via integral image, edge-clamped. a: HxW or HxWxC"""
    p = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def kuwahara(img, r=2):
    """Painterly Kuwahara filter on premultiplied RGB; alpha preserved. img: HxWx4 straight alpha."""
    if r <= 0:
        return img
    a = img[..., 3:4]
    rgb = img[..., :3] * a
    lum = rgb.mean(axis=2)
    H, W = lum.shape
    m = box_mean(rgb, r // 2 if r > 1 else 1)
    best = None
    bestv = None
    ofs = [(-r // 2 - 1, -r // 2 - 1), (-r // 2 - 1, r // 2 + 1), (r // 2 + 1, -r // 2 - 1), (r // 2 + 1, r // 2 + 1)] if r > 1 else [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    rr = max(1, r // 2)
    mean_l = box_mean(lum, rr)
    var_l = box_mean(lum * lum, rr) - mean_l ** 2
    mean_c = box_mean(rgb, rr)
    for dy, dx in ofs:
        v = np.roll(np.roll(var_l, dy, 0), dx, 1)
        c = np.roll(np.roll(mean_c, dy, 0), dx, 1)
        if best is None:
            best, bestv = c.copy(), v.copy()
        else:
            sel = v < bestv
            best[sel] = c[sel]
            bestv[sel] = v[sel]
    out = img.copy()
    am = np.maximum(a, 1e-4)
    out[..., :3] = np.where(a > 0.02, best / am, img[..., :3])
    out[..., :3] = np.clip(out[..., :3], 0, 1)
    return out


def shadow_to_alpha(img):
    """Cycles shadow catcher with transparent film: keep alpha, colour -> black."""
    out = np.zeros_like(img)
    out[..., 3] = np.clip(img[..., 3], 0, 1)
    return out


# ----------------------------------------------------------------------------- materials
def mat(name, color, rough=0.6, metal=0.0, coat=0.0, noise=0.08, noise_scale=6.0, emit=None, night=0.0, day=0.0, transmission=0.0, spec=0.5):
    """Principled material with painterly colour variation (noise-driven ramp between two tints)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Specular IOR Level'].default_value = spec
    if transmission:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    c = list(color) + [1] if len(color) == 3 else list(color)
    if noise > 0:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = noise_scale
        tex.inputs['Detail'].default_value = 3.0
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        lo = [max(0, x * (1 - noise * 1.4)) for x in c[:3]] + [1]
        hi = [min(1, x * (1 + noise)) for x in c[:3]] + [1]
        ramp.color_ramp.elements[0].color = lo
        ramp.color_ramp.elements[1].color = hi
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[1].position = 0.7
        nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = c
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = list(emit) + [1]
        bsdf.inputs['Emission Strength'].default_value = day
        EMITTERS.append((m, night, day))
    return m


def srgb(hexs):
    hexs = hexs.lstrip('#')
    v = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in v)


# ----------------------------------------------------------------------------- geometry helpers
def cube(loc, size, material, bevel=0.0, segs=3, name='box', rot=None, taper=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    if rot is not None:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if taper is not None:  # shrink the top face (x, y factors) -> sloped sides that catch the sun
        for v in o.data.vertices:
            if v.co.z > 0:
                v.co.x *= taper[0]
                v.co.y *= taper[1]
    if bevel > 0:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = segs
        b.limit_method = 'NONE'
    o.data.materials.append(material)
    return track(o)


def cyl(loc, r, depth, material, verts=24, name='cyl', rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    if rot is not None:
        o.rotation_euler = rot
    o.data.materials.append(material)
    return track(o)


def sphere(loc, r, material, scale=(1, 1, 1), name='sph', segs=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segs, ring_count=segs // 2)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return track(o)


def quads_mesh(name, quads, material):
    """One object from many quads [(v0,v1,v2,v3), ...] — fast for hundreds of windows."""
    verts, faces = [], []
    for q in quads:
        i = len(verts)
        verts.extend(q)
        faces.append((i, i + 1, i + 2, i + 3))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return track(o)


def text_obj(body, loc, size, material, rot_z=0.0, extrude=0.04):
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new('txt', cu)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, rot_z)
    o.data.materials.append(material)
    return track(o)


def point_light(loc, energy, color, radius=0.2):
    ld = bpy.data.lights.new('pl', 'POINT')
    ld.energy = energy
    ld.color = color
    ld.shadow_soft_size = radius
    o = bpy.data.objects.new('pl', ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return track(o)


def spot_light(loc, rot, energy, color, size_deg=60, blend=0.6):
    ld = bpy.data.lights.new('sl', 'SPOT')
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = 0.1
    o = bpy.data.objects.new('sl', ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return track(o)


def parent_all(root, objs):
    for o in objs:
        if o is not root and o.parent is None:
            o.parent = root


def manifest_entry(file, cx, cy, wm, hm):
    """sprite placement relative to the asset's anchor, in world units (x right, y down)."""
    return {'file': file, 'ox': round((cx - wm / 2) * UPM, 2), 'oy': round(-(cy + hm / 2) * UPM, 2),
            'w': round(wm * UPM, 2), 'h': round(hm * UPM, 2)}


def save_manifest():
    json.dump(MANIFEST, open(MANIFEST_PATH, 'w'), indent=1, sort_keys=True)


def sheet(frames, cols):
    h, w = frames[0].shape[:2]
    rows = math.ceil(len(frames) / cols)
    out = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols)
        out[r * h:(r + 1) * h, c * w:(c + 1) * w] = f
    return out


def shadow_frame_for(xmin, ymin, xmax, ymax, height, margin=1.5):
    L = height * SHADOW_PER_M
    sx, sy = SHADOW_DIR.x * L, SHADOW_DIR.y * L
    x0 = min(xmin, xmin + sx) - margin
    x1 = max(xmax, xmax + sx) + margin
    y0 = min(ymin, ymin + sy) - margin
    y1 = max(ymax, ymax + sy) + margin
    return (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0


# ============================================================================= CARS
CAR_ANGLES = 32
CAR_PPM = 20      # colour pass pixels per metre (2 px per world unit)
CAR_FRAME = 6.4   # metres, square
CAR_SH_PPM = 10
CAR_SH_FRAME = 9.6


def build_car(kind, paint):
    """Car pointing north (+Y). Returns root empty. ~4.6 m long."""
    root = bpy.data.objects.new('car', None)
    bpy.context.scene.collection.objects.link(root)
    track(root)
    body = mat('paint', srgb(paint), rough=0.32, coat=0.9, noise=0.05, noise_scale=3)
    glass = mat('glass', srgb('#141c30'), rough=0.05, spec=1.0, coat=1.0, noise=0)
    trim = mat('trim', srgb('#22202a'), rough=0.6, noise=0)
    chrome = mat('chrome', (0.8, 0.8, 0.8), rough=0.15, metal=1.0, noise=0)
    tyre = mat('tyre', srgb('#16151a'), rough=0.9, noise=0)
    head = mat('headl', (1, 0.95, 0.85), rough=0.2, emit=(1.0, 0.86, 0.62), night=40, day=0.6, noise=0)
    tail = mat('taill', srgb('#c0102a'), rough=0.3, emit=(1.0, 0.08, 0.06), night=30, day=0.5, noise=0)
    objs = []
    L, Wd = 4.6, 1.9
    if kind == 'van':
        L, Wd = 4.9, 2.0
    # wheels (peek out at the sides)
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(cyl((sx * (Wd / 2 - 0.12), sy * (L / 2 - 0.85), 0.34), 0.34, 0.26, tyre, rot=(0, math.pi / 2, 0)))
    if kind == 'van':
        objs.append(cube((0, 0, 0.95), (Wd, L, 1.5), body, bevel=0.22, name='body'))
        objs.append(cube((0, L / 2 - 0.65, 1.1), (Wd - 0.18, 0.9, 1.2), glass, bevel=0.15))  # windscreen wrap
        objs.append(cube((0, -0.2, 1.72), (Wd - 0.12, L - 1.3, 0.06), body, bevel=0.02))
        for i in range(4):  # roof rack slats
            objs.append(cube((0, -1.3 + i * 0.7, 1.8), (Wd - 0.35, 0.07, 0.05), chrome))
        objs.append(cube((0, L / 2 - 0.08, 0.7), (Wd - 0.3, 0.1, 0.25), chrome))
    else:
        objs.append(cube((0, 0, 0.55), (Wd, L, 0.62), body, bevel=0.24, segs=4, name='body', taper=(0.9, 0.97)))
        for yy in (L / 2 - 0.95, -L / 2 + 0.75):  # hood / trunk shut lines
            objs.append(cube((0, yy, 0.86), (Wd - 0.5, 0.025, 0.02), trim))
        objs.append(cube((0, L / 2 - 0.55, 0.865), (0.03, 0.7, 0.015), trim))  # hood crease
        if kind == 'convertible':
            seat = mat('seat', srgb('#e9dcc4'), rough=0.7, noise=0.1)
            objs.append(cube((0, 0.3, 0.86), (Wd - 0.35, 0.6, 0.06), glass, bevel=0.02))
            objs.append(cube((0, 0.55, 1.1), (Wd - 0.3, 0.08, 0.35), glass, rot=(0.5, 0, 0)))
            for sx in (-0.45, 0.45):
                objs.append(cube((sx, -0.4, 0.95), (0.6, 0.65, 0.18), seat, bevel=0.08))
                objs.append(cube((sx, -0.75, 1.15), (0.55, 0.15, 0.45), seat, bevel=0.06))
            objs.append(cube((0, -1.4, 0.88), (Wd - 0.4, 0.9, 0.08), body, bevel=0.05))
        else:
            cab_len = 2.2 if kind != 'taxi' else 2.1
            objs.append(cube((0, -0.25, 1.05), (Wd - 0.3, cab_len, 0.55), glass, bevel=0.12, segs=3, name='cabin', taper=(0.78, 0.62)))
            objs.append(cube((0, -0.3, 1.33), (Wd - 0.62, cab_len - 1.0, 0.05), body, bevel=0.06, name='roof'))
    # lights
    for sx in (-1, 1):
        objs.append(cube((sx * (Wd / 2 - 0.32), L / 2 - 0.04, 0.62), (0.42, 0.1, 0.16), head, bevel=0.03))
        objs.append(cube((sx * (Wd / 2 - 0.3), -L / 2 + 0.04, 0.66), (0.4, 0.1, 0.14), tail, bevel=0.03))
        objs.append(cube((sx * (Wd / 2 + 0.06), 0.55, 0.95), (0.14, 0.1, 0.08), trim))  # mirrors
    objs.append(cube((0, -L / 2 + 0.03, 0.42), (Wd - 0.2, 0.08, 0.12), chrome))  # bumper
    objs.append(cube((0, L / 2 - 0.03, 0.42), (Wd - 0.2, 0.08, 0.12), chrome))
    if kind == 'taxi':
        sign = mat('taxisign', srgb('#fff4d8'), rough=0.4, emit=(1.0, 0.85, 0.5), night=8, day=0.3, noise=0)
        objs.append(cube((0, -0.3, 1.48), (0.9, 0.3, 0.22), sign, bevel=0.05))
        check = mat('check', srgb('#1a1a1a'), rough=0.5, noise=0)
        for i in range(6):
            objs.append(cube((Wd / 2 + 0.005, -1.3 + i * 0.35, 0.62), (0.02, 0.17, 0.12), check))
            objs.append(cube((-Wd / 2 - 0.005, -1.3 + i * 0.35, 0.62), (0.02, 0.17, 0.12), check))
    if kind == 'police':
        white = mat('pwhite', srgb('#f1ece2'), rough=0.35, coat=0.8, noise=0.03)
        objs.append(cube((0, 0, 1.36), (Wd - 0.4, 1.0, 0.04), white, bevel=0.04))   # white roof
        objs.append(cube((0, 1.55, 0.88), (Wd - 0.5, 0.9, 0.04), white, bevel=0.04))  # hood panel
        red = mat('lbr', srgb('#d01a2a'), rough=0.3, emit=(1, 0.1, 0.1), night=6, day=0.4, noise=0)
        blue = mat('lbb', srgb('#1a3ad0'), rough=0.3, emit=(0.1, 0.3, 1), night=6, day=0.4, noise=0)
        objs.append(cube((-0.4, -0.05, 1.46), (0.7, 0.32, 0.16), red, bevel=0.05))
        objs.append(cube((0.4, -0.05, 1.46), (0.7, 0.32, 0.16), blue, bevel=0.05))
    parent_all(root, objs)
    return root


def car_headlight_rig(kind):
    L = 4.9 if kind == 'van' else 4.6
    for sx in (-0.65, 0.65):
        # spot aims north and down ~16 degrees
        spot_light((sx, L / 2 + 0.1, 0.75), (math.radians(90 - 11), 0, 0), 2200, (1.0, 0.88, 0.66), size_deg=40, blend=0.8)
    point_light((0, -L / 2 - 0.4, 0.6), 18, (1.0, 0.12, 0.08), radius=0.4)


CAR_SET = [
    ('sedan_coral', 'sedan', '#e0644f'),
    ('sedan_teal', 'sedan', '#2f9c9a'),
    ('sedan_cream', 'sedan', '#efe0bd'),
    ('sedan_plum', 'sedan', '#7a4a8c'),
    ('conv_mint', 'convertible', '#7fd1b9'),
    ('conv_rose', 'convertible', '#f08aa8'),
    ('van_sky', 'van', '#7fb2de'),
    ('van_sun', 'van', '#f2b134'),
    ('taxi', 'taxi', '#f7c23c'),
    ('police', 'police', '#1d2233'),
]


def bake_cars():
    sc = reset()
    MANIFEST.setdefault('cars', {})
    for name, kind, paint in CAR_SET:
        if ONLY and name not in ONLY:
            continue
        t0 = time.time()
        root = build_car(kind, paint)
        col, sh = [], []
        for k in range(CAR_ANGLES):
            th = k * 2 * math.pi / CAR_ANGLES          # game heading: 0 = east, clockwise on screen
            root.rotation_euler = (0, 0, -th - math.pi / 2)
            set_pass('color')
            frame(0, 0, CAR_FRAME, CAR_FRAME, CAR_PPM)
            render(f'{TMP}/c.png')
            col.append(kuwahara(load_np(f'{TMP}/c.png'), 1))
            set_pass('shadow')
            scx, scy = SHADOW_DIR.x * 1.2, SHADOW_DIR.y * 1.2
            frame(scx, scy, CAR_SH_FRAME, CAR_SH_FRAME, CAR_SH_PPM)
            render(f'{TMP}/s.png')
            sh.append(shadow_to_alpha(load_np(f'{TMP}/s.png')))
        save_np(sheet(col, 8), f'{OUT}/car_{name}.png')
        save_np(sheet(sh, 8), f'{OUT}/car_{name}_sh.png')
        # light pass: one frame, car facing north, rotated by the game
        root.rotation_euler = (0, 0, 0)
        car_headlight_rig(kind)
        set_pass('night')
        frame(0, 5.0, 7.0, 22.0, 8)
        render(f'{TMP}/n.png')
        save_np(load_np(f'{TMP}/n.png'), f'{OUT}/car_{name}_light.png')
        MANIFEST['cars'][name] = {
            'kind': kind, 'angles': CAR_ANGLES, 'cols': 8,
            'color': manifest_entry(f'car_{name}.png', 0, 0, CAR_FRAME, CAR_FRAME),
            'shadow': manifest_entry(f'car_{name}_sh.png', scx, scy, CAR_SH_FRAME, CAR_SH_FRAME),
            'light': manifest_entry(f'car_{name}_light.png', 0, 5.0, 7.0, 22.0),
            'length': (4.9 if kind == 'van' else 4.6) * UPM, 'width': (2.0 if kind == 'van' else 1.9) * UPM,
        }
        save_manifest()
        clear_asset()
        print(f'car {name} baked in {time.time() - t0:.1f}s', flush=True)



# ============================================================================= PEOPLE
PED_ANGLES = 16
PED_SCALE = 1.7   # people are drawn ~1.7x true scale so they read on a phone next to cars
PED_PPM = 24
PED_FRAME = 2.8
PED_SH_PPM = 10
PED_SH_FRAME = 8.0
PED_POSES = [1.0, 0.0, -1.0]  # stride: left foot forward, passing, right foot forward

PED_SET = [
    # name, shirt, pants, skin, hair, headwear ('cap' / 'hat' / None), shoes
    ('player', '#25b8ac', '#2c3452', '#c68a64', '#2a1d18', 'cap', '#f4f0e6'),
    ('ped_sun', '#f4cf62', '#f4cf62', '#e8b48e', '#e8c26a', None, '#b24a3a'),
    ('ped_rose', '#e8708e', '#3c3a52', '#8a5a40', '#1d1412', None, '#ffffff'),
    ('ped_white', '#f2eee4', '#7a8aa6', '#5e3b2a', '#141010', None, '#2a2a2a'),
    ('ped_blue', '#6b92d8', '#d8c4a0', '#f0c8a8', '#b8452c', None, '#6a4a32'),
    ('ped_straw', '#a874d0', '#4a5a40', '#d09a74', '#3a2a20', 'hat', '#e8e0d0'),
    ('cop', '#24335a', '#1c2440', '#b07a58', '#1a1410', 'cop', '#111111'),
]


def build_ped(shirt, pants, skin, hair, headwear, shoes):
    root = bpy.data.objects.new('ped', None)
    bpy.context.scene.collection.objects.link(root)
    track(root)
    m_shirt = mat('shirt', srgb(shirt), rough=0.8, noise=0.12, noise_scale=12)
    m_pants = mat('pants', srgb(pants), rough=0.8, noise=0.1, noise_scale=12)
    m_skin = mat('skin', srgb(skin), rough=0.55, noise=0.05)
    m_hair = mat('hair', srgb(hair), rough=0.7, noise=0.15, noise_scale=30)
    m_shoe = mat('shoe', srgb(shoes), rough=0.6, noise=0)
    limbs = {}
    objs = []

    def limb(name, pivot, length, radius, material, end_mat=None, end_r=0.0, foot=False):
        piv = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(piv)
        track(piv)
        piv.location = pivot
        c = cyl((0, 0, -length / 2), radius, length, material, verts=12)
        c.parent = piv
        if end_mat is not None:
            if foot:
                f = cube((0, 0.07, -length - 0.02), (0.12, 0.26, 0.09), end_mat, bevel=0.04)
            else:
                f = sphere((0, 0, -length), end_r, end_mat, segs=10)
            f.parent = piv
        limbs[name] = piv
        return piv

    objs.append(limb('legL', (-0.1, 0, 0.9), 0.82, 0.075, m_pants, m_shoe, foot=True))
    objs.append(limb('legR', (0.1, 0, 0.9), 0.82, 0.075, m_pants, m_shoe, foot=True))
    objs.append(sphere((0, 0, 0.98), 0.17, m_pants, scale=(1.05, 0.75, 0.7)))
    objs.append(sphere((0, 0, 1.28), 0.24, m_shirt, scale=(1.0, 0.6, 1.2)))      # torso
    objs.append(sphere((0, 0, 1.47), 0.25, m_shirt, scale=(1.0, 0.55, 0.38)))    # shoulders
    objs.append(limb('armL', (-0.27, 0, 1.48), 0.55, 0.06, m_shirt, m_skin, end_r=0.06))
    objs.append(limb('armR', (0.27, 0, 1.48), 0.55, 0.06, m_shirt, m_skin, end_r=0.06))
    objs.append(sphere((0, 0.01, 1.66), 0.115, m_skin))                           # head
    objs.append(sphere((0, -0.02, 1.70), 0.12, m_hair, scale=(1.0, 1.0, 0.75)))   # hair
    if headwear == 'cap':
        cm = mat('cap', srgb('#f05a38'), rough=0.6, noise=0.06)
        objs.append(sphere((0, 0, 1.74), 0.125, cm, scale=(1.0, 1.0, 0.55)))
        objs.append(cube((0, 0.13, 1.73), (0.18, 0.14, 0.02), cm, bevel=0.03))
    elif headwear == 'hat':
        hm = mat('straw', srgb('#e9cf86'), rough=0.8, noise=0.2, noise_scale=40)
        objs.append(cyl((0, 0, 1.74), 0.24, 0.02, hm, verts=24))
        objs.append(sphere((0, 0, 1.76), 0.12, hm, scale=(1, 1, 0.6)))
    elif headwear == 'cop':
        cm = mat('copcap', srgb('#1a2442'), rough=0.5, noise=0)
        badge = mat('badge', srgb('#e8c050'), rough=0.3, metal=1.0, noise=0)
        objs.append(cyl((0, 0, 1.75), 0.135, 0.08, cm, verts=20))
        objs.append(cube((0, 0.14, 1.73), (0.2, 0.1, 0.02), cm, bevel=0.03))
        objs.append(cube((0, 0.12, 1.79), (0.05, 0.03, 0.04), badge))
    parent_all(root, objs + [limbs[k] for k in limbs])
    root.scale = (PED_SCALE,) * 3
    return root, limbs


def pose_ped(limbs, stride):
    a = math.radians(32) * stride
    limbs['legL'].rotation_euler = (a, 0, 0)
    limbs['legR'].rotation_euler = (-a, 0, 0)
    limbs['armL'].rotation_euler = (-a * 0.9, 0, 0.12)
    limbs['armR'].rotation_euler = (a * 0.9, 0, -0.12)


def bake_peds():
    reset()
    MANIFEST.setdefault('peds', {})
    for name, shirt, pants, skin, hair, headwear, shoes in PED_SET:
        if ONLY and name not in ONLY:
            continue
        t0 = time.time()
        root, limbs = build_ped(shirt, pants, skin, hair, headwear, shoes)
        col, sh = [], []
        scx, scy = SHADOW_DIR.x * 2.6, SHADOW_DIR.y * 2.6
        for k in range(PED_ANGLES):
            th = k * 2 * math.pi / PED_ANGLES
            root.rotation_euler = (0, 0, -th - math.pi / 2)
            for stride in PED_POSES:
                pose_ped(limbs, stride)
                set_pass('color')
                frame(0, 0, PED_FRAME, PED_FRAME, PED_PPM)
                render(f'{TMP}/c.png')
                col.append(kuwahara(load_np(f'{TMP}/c.png'), 1))
                set_pass('shadow')
                frame(scx, scy, PED_SH_FRAME, PED_SH_FRAME, PED_SH_PPM)
                render(f'{TMP}/s.png')
                sh.append(shadow_to_alpha(load_np(f'{TMP}/s.png')))
        cols = len(PED_POSES) * 4  # 4 angles per row
        save_np(sheet(col, cols), f'{OUT}/ped_{name}.png')
        save_np(sheet(sh, cols), f'{OUT}/ped_{name}_sh.png')
        MANIFEST['peds'][name] = {
            'angles': PED_ANGLES, 'poses': len(PED_POSES), 'cols': cols,
            'color': manifest_entry(f'ped_{name}.png', 0, 0, PED_FRAME, PED_FRAME),
            'shadow': manifest_entry(f'ped_{name}_sh.png', scx, scy, PED_SH_FRAME, PED_SH_FRAME),
        }
        save_manifest()
        clear_asset()
        print(f'ped {name} baked in {time.time() - t0:.1f}s', flush=True)



# ============================================================================= BUILDINGS
BLD_PPM = 20
BLD_SH_PPM = 8
BLD_NIGHT_PPM = 8
NEON = {'SOLANA': '#ff4fa8', 'TACOS': '#ff8a3c', 'DINER': '#3fe0ff', 'MOTEL': '#ff3f6a', 'NOVA': '#b45cff'}
WARM_WINDOW = (1.0, 0.72, 0.38)


def hip_roof(cx, cy, W, D, z, rise, material, overhang=0.4):
    """Hip roof as one mesh (two trapezoids + two triangles). Slopes catch the low sun differently."""
    W2, D2 = W / 2 + overhang, D / 2 + overhang
    if W >= D:
        r = max(0.0, W2 - D2)
        ridge = [(cx - r, cy, z + rise), (cx + r, cy, z + rise)]
        verts = [(cx - W2, cy - D2, z), (cx + W2, cy - D2, z), (cx + W2, cy + D2, z), (cx - W2, cy + D2, z)] + ridge
        faces = [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)]
    else:
        r = max(0.0, D2 - W2)
        ridge = [(cx, cy - r, z + rise), (cx, cy + r, z + rise)]
        verts = [(cx - W2, cy - D2, z), (cx + W2, cy - D2, z), (cx + W2, cy + D2, z), (cx - W2, cy + D2, z)] + ridge
        faces = [(1, 2, 5, 4), (3, 0, 4, 5), (0, 1, 4), (2, 3, 5)]
    me = bpy.data.meshes.new('roof')
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new('roof', me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return track(o)


def tile_mat(name, color):
    """Terracotta tiles: wave-texture courses modulating a painterly base."""
    m = mat(name, srgb(color), rough=0.75, noise=0.14, noise_scale=4)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    ramp = [n for n in nt.nodes if n.type == 'VALTORGB'][0]
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 1.6
    wave.inputs['Distortion'].default_value = 1.5
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.35
    nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
    nt.links.new(wave.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m


def facade_windows(W, D, floors, rnd, lit=0.75, shop=False, floor_h=3.2):
    """Emissive window panes on all four walls of a WxD box (lower floors only: they light the street)."""
    win = mat('window', srgb('#3a3a52'), rough=0.2, emit=WARM_WINDOW, night=7.0, day=0.0, noise=0)
    quads = []
    eps = 0.03
    for f in range(min(floors, 4)):
        z0 = 0.9 + f * floor_h if not (shop and f == 0) else 0.3
        z1 = z0 + (1.5 if not (shop and f == 0) else 2.6)
        for side in range(4):
            span = W if side in (0, 2) else D
            n = max(1, int(span / 2.6))
            for i in range(n):
                if rnd.random() > lit:
                    continue
                a = -span / 2 + (i + 0.5) * span / n
                hw = (span / n) * (0.42 if (shop and f == 0) else 0.3)
                if side == 0:   # north wall (y = +D/2)
                    y = D / 2 + eps
                    quads.append([(a - hw, y, z0), (a + hw, y, z0), (a + hw, y, z1), (a - hw, y, z1)])
                elif side == 2:  # south
                    y = -D / 2 - eps
                    quads.append([(a + hw, y, z0), (a - hw, y, z0), (a - hw, y, z1), (a + hw, y, z1)])
                elif side == 1:  # east
                    x = W / 2 + eps
                    quads.append([(x, a + hw, z0), (x, a - hw, z0), (x, a - hw, z1), (x, a + hw, z1)])
                else:
                    x = -W / 2 - eps
                    quads.append([(x, a - hw, z0), (x, a + hw, z0), (x, a + hw, z1), (x, a - hw, z1)])
    if quads:
        quads_mesh('windows', quads, win)


def flat_block(cx, cy, W, D, H, wall, roof, parapet, par_h=0.6, par_w=0.35):
    cube((cx, cy, H / 2), (W, D, H), wall)
    cube((cx, cy, H + 0.02), (W - 0.1, D - 0.1, 0.06), roof)
    for (px, py, sx, sy) in [(cx, cy + D / 2 - par_w / 2, W, par_w), (cx, cy - D / 2 + par_w / 2, W, par_w),
                             (cx + W / 2 - par_w / 2, cy, par_w, D), (cx - W / 2 + par_w / 2, cy, par_w, D)]:
        cube((px, py, H + par_h / 2), (sx, sy, par_h), parapet, bevel=0.05)


def ac_unit(x, y, z, metal, dark):
    cube((x, y, z + 0.4), (1.3, 1.0, 0.8), metal, bevel=0.05)
    cyl((x, y + 0.1, z + 0.81), 0.33, 0.04, dark, verts=16)


def water_tank(x, y, z, wood, dark):
    for dx in (-0.8, 0.8):
        for dy in (-0.8, 0.8):
            cube((x + dx, y + dy, z + 0.6), (0.15, 0.15, 1.2), dark)
    cyl((x, y, z + 2.2), 1.25, 2.0, wood, verts=28)
    bpy.ops.mesh.primitive_cone_add(radius1=1.35, radius2=0.1, depth=0.8, vertices=28, location=(x, y, z + 3.6))
    c = bpy.context.active_object
    c.data.materials.append(dark)
    track(c)


def skylights(cx, cy, W, D, z, nx, ny, rnd, glow=4.0):
    glass = mat('skylight', srgb('#9fb6d8'), rough=0.08, spec=1.0, emit=(1.0, 0.8, 0.5), night=glow, day=0.0, noise=0)
    frame_m = mat('skyframe', srgb('#d8d0c4'), rough=0.6, noise=0)
    for i in range(nx):
        for j in range(ny):
            x = cx - W / 2 + (i + 0.5) * W / nx
            y = cy - D / 2 + (j + 0.5) * D / ny
            cube((x, y, z + 0.25), (W / nx * 0.8 + 0.2, D / ny * 0.8 + 0.2, 0.5), frame_m)
            cube((x, y, z + 0.52), (W / nx * 0.8, D / ny * 0.8, 0.06), glass, taper=(0.9, 0.9))


def neon_sign(text, x, y, z, size, rot=0.0, plate=True):
    col = srgb(NEON.get(text, '#ff4fa8'))
    tube = mat('neon_' + text, tuple(min(1, c * 1.2 + 0.25) for c in col), rough=0.3, emit=col, night=16.0, day=1.2, noise=0)
    if plate:
        back = mat('signback', srgb('#2a2236'), rough=0.6, noise=0.05)
        w = size * len(text) * 0.62 + 0.8
        cube((x, y, z - 0.08), (w, size * 1.15, 0.12), back, bevel=0.06, rot=(0, 0, rot))
    text_obj(text, (x, y, z), size, tube, rot_z=rot, extrude=0.05)


def awning(x, y, z, w, depth, colors, facing):
    """Striped awning sloping out over the sidewalk. facing: 'n','s','e','w'."""
    n = max(3, int(w / 0.7))
    for i in range(n):
        m = colors[i % len(colors)]
        a = -w / 2 + (i + 0.5) * w / n
        if facing in ('n', 's'):
            sgn = 1 if facing == 'n' else -1
            cube((x + a, y + sgn * depth / 2, z), (w / n, depth, 0.06), m, rot=(-0.28 * sgn, 0, 0))
        else:
            sgn = 1 if facing == 'e' else -1
            cube((x + sgn * depth / 2, y + a, z), (depth, w / n, 0.06), m, rot=(0, 0.28 * sgn, 0))


def string_lights(points, z, rnd):
    bulb = mat('bulb', srgb('#ffe2a0'), rough=0.3, emit=(1.0, 0.8, 0.45), night=40.0, day=0.8, noise=0)
    wire = mat('wire', srgb('#2a2430'), rough=0.6, noise=0)
    for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(L / 0.9))
        for i in range(n + 1):
            t = i / n
            sphere((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z - math.sin(t * math.pi) * 0.4), 0.09, bulb, segs=8)


def palm_crown(x, y, z, rnd, radius=3.0, fronds=11):
    leaf = mat('frond', srgb('#4f8a3c'), rough=0.7, noise=0.25, noise_scale=8)
    leaf2 = mat('frond2', srgb('#7aa646'), rough=0.7, noise=0.25, noise_scale=8)
    for f in range(fronds):
        ang = f / fronds * math.pi * 2 + rnd.uniform(-0.2, 0.2)
        L = radius * rnd.uniform(0.85, 1.1)
        verts, faces = [], []
        n = 14
        for i in range(n + 1):
            t = i / n
            d = L * t
            h = z + 0.6 * t - 1.7 * t * t  # droop
            hw = 0.55 * math.sin(math.pi * min(1, t * 1.15)) ** 0.6 + 0.02
            serr = 0.22 if i % 2 else -0.05
            cx_, cy_ = x + math.cos(ang) * d, y + math.sin(ang) * d
            px, py = -math.sin(ang), math.cos(ang)
            fw = (hw + serr * hw) 
            back = -0.12 if i % 2 else 0
            verts.append((cx_ + px * fw + math.cos(ang) * back, cy_ + py * fw + math.sin(ang) * back, h - 0.15 * hw))
            verts.append((cx_, cy_, h + 0.08))
            verts.append((cx_ - px * fw + math.cos(ang) * back, cy_ - py * fw + math.sin(ang) * back, h - 0.15 * hw))
        for i in range(n):
            a = i * 3
            faces.append((a, a + 3, a + 4, a + 1))
            faces.append((a + 1, a + 4, a + 5, a + 2))
        me = bpy.data.meshes.new('frond')
        me.from_pydata(verts, [], faces)
        o = bpy.data.objects.new('frond', me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(leaf if f % 2 else leaf2)
        track(o)
    nut = mat('nut', srgb('#6a4a26'), rough=0.8, noise=0)
    for i in range(4):
        a = i * 1.7
        sphere((x + math.cos(a) * 0.25, y + math.sin(a) * 0.25, z - 0.2), 0.16, nut, segs=8)


def palm_tree(x, y, rnd, height=None):
    trunk = mat('trunk', srgb('#8a6a4a'), rough=0.9, noise=0.2, noise_scale=20)
    H = height or rnd.uniform(7.0, 10.0)
    lean = rnd.uniform(0, math.pi * 2)
    lx, ly = math.cos(lean), math.sin(lean)
    segs = 8
    px, py, pz = x, y, 0
    for i in range(segs):
        t = (i + 1) / segs
        nx_, ny_ = x + lx * 1.2 * t * t, y + ly * 1.2 * t * t
        nz = H * t
        mx, my, mz = (px + nx_) / 2, (py + ny_) / 2, (pz + nz) / 2
        dv = Vector((nx_ - px, ny_ - py, nz - pz))
        c = cyl((mx, my, mz), 0.24 - 0.08 * t, dv.length + 0.05, trunk, verts=10)
        c.rotation_euler = dv.to_track_quat('Z', 'Y').to_euler()
        px, py, pz = nx_, ny_, nz
    palm_crown(px, py, H, rnd)
    return H


def build_building(b):
    rnd = random.Random(b['seed'])
    W, D, H = b['w'] / UPM, b['d'] / UPM, b['h']
    style = b['style']
    feat_h = 0.6
    dark = mat('dark', srgb('#2e2a36'), rough=0.6, noise=0.05)
    metal = mat('metal', srgb('#c8c4c0'), rough=0.4, metal=0.6, noise=0.08, noise_scale=10)
    wood = mat('wood', srgb('#9a6a44'), rough=0.8, noise=0.25, noise_scale=14)
    gravel = lambda c: mat('roof', srgb(c), rough=0.95, noise=0.18, noise_scale=26)
    floors = max(1, int(H / 3.2))
    if style == 'hotel':
        wall = mat('wall', srgb('#f2d6b8'), rough=0.7)
        flat_block(0, 0, W, D, H, wall, gravel('#cfc2b4'), mat('par', srgb('#fbe8d2'), rough=0.6))
        # rooftop pool deck on the south half
        deck = mat('deck', srgb('#b8865a'), rough=0.7, noise=0.25, noise_scale=10)
        water = mat('pool', srgb('#3fc6d8'), rough=0.05, spec=1.0, emit=(0.3, 0.85, 1.0), night=3.5, day=0.15, noise=0.1, noise_scale=3)
        cube((0, -D / 4, H + 0.1), (W - 2.0, D / 2 - 1.5, 0.12), deck)
        cube((-W / 6, -D / 4, H + 0.17), (W / 2.2, D / 4, 0.06), water)
        for i in range(5):
            cube((W / 4, -D / 2 + 2.2 + i * 1.6, H + 0.4), (1.6, 0.7, 0.25), mat('lounger', srgb('#f6efe2'), rough=0.6, noise=0), bevel=0.08)
        for i, c in enumerate(['#ff6f61', '#ffd166', '#4ecdc4']):
            ux, uy = -W / 2 + 2.5 + i * 3.2, -D / 2 + 2.0
            cyl((ux, uy, H + 1.2), 0.04, 2.2, dark)
            bpy.ops.mesh.primitive_cone_add(radius1=1.3, radius2=0.05, depth=0.5, vertices=8, location=(ux, uy, H + 2.4))
            u = bpy.context.active_object
            u.data.materials.append(mat('umb', srgb(c), rough=0.7, noise=0.05))
            track(u)
        # mechanical penthouse + tanks on the north half
        cube((W / 5, D / 4, H + 1.5), (W / 2.4, D / 3.2, 3.0), wall, bevel=0.1)
        cube((W / 5, D / 4, H + 3.05), (W / 2.4 - 0.4, D / 3.2 - 0.4, 0.1), gravel('#bfb2a4'))
        water_tank(-W / 4, D / 4, H, wood, dark)
        for i in range(3):
            ac_unit(W / 5 - 2 + i * 2, D / 4, H + 3.1, metal, dark)
        string_lights([(-W / 2 + 1, -1.0), (W / 2 - 1, -1.0)], H + 2.2, rnd)
        neon_sign(b.get('sign', 'SOLANA'), 0, D / 2 - 1.2, H + 0.75, 1.8)
        facade_windows(W, D, floors, rnd, lit=0.8, shop=True)
        feat_h = 4.2
    elif style == 'shops':
        n = 4
        cols = ['#e8a87c', '#f4d58d', '#9cc9b4', '#e98fa0']
        roofs = ['#b9a48e', '#c9b89c', '#a7a0a4', '#c4a690']
        aw = [('#e94f37', '#f6f0e0'), ('#2a9d8f', '#f6f0e0'), ('#f4a259', '#5b3758'), ('#3d5a80', '#f6f0e0')]
        for i in range(n):
            sw = W / n
            x = -W / 2 + sw * (i + 0.5)
            hh = H + rnd.uniform(-1.0, 1.5)
            flat_block(x, 0, sw - 0.15, D, hh, mat('wall', srgb(cols[i]), rough=0.7), gravel(roofs[i]), mat('par', srgb(cols[i]), rough=0.6), par_h=0.8)
            ac_unit(x + rnd.uniform(-1.5, 1.5), rnd.uniform(-1.5, 1.5), hh, metal, dark)
            if rnd.random() < 0.6:
                skylights(x, -D / 4, sw * 0.5, 1.4, hh, 2, 1, rnd)
            awning(x, D / 2, 3.2, sw - 1.0, 1.8, [mat('aw', srgb(aw[i][0]), rough=0.7, noise=0.1), mat('aw2', srgb(aw[i][1]), rough=0.7, noise=0.1)], 'n')
        neon_sign(b.get('sign', 'TACOS'), -W / 2 + W / 8, D / 2 - 1.6, H + 1.0, 1.3)
        facade_windows(W, D, 2, rnd, lit=0.9, shop=True)
        feat_h = 2.0
    elif style == 'diner':
        chrome = mat('chrome', srgb('#e6e2dc'), rough=0.25, metal=0.8, noise=0.04)
        wall = mat('wall', srgb('#f4efe6'), rough=0.5)
        flat_block(0, 0, W, D, H, wall, mat('roof', srgb('#d8d2ca'), rough=0.4, metal=0.3, noise=0.1, noise_scale=6), chrome, par_h=0.4)
        for i in range(int(W / 1.2)):  # corrugated stripes
            cube((-W / 2 + 0.6 + i * 1.2, 0, H + 0.12), (0.12, D - 0.8, 0.12), chrome)
        stripe = mat('stripe', srgb('#e63e5c'), rough=0.4, noise=0)
        cube((0, D / 2 - 0.7, H + 0.3), (W - 0.8, 0.6, 0.12), stripe)
        cube((0, -D / 2 + 0.7, H + 0.3), (W - 0.8, 0.6, 0.12), stripe)
        neon_sign(b.get('sign', 'DINER'), 0, -D / 2 + 2.6, H + 0.6, 2.2)
        for i in range(3):
            ac_unit(-W / 3 + i * W / 3, D / 5, H, metal, dark)
        facade_windows(W, D, 1, rnd, lit=1.0, shop=True)
        string_lights([(-W / 2 - 1.5, -D / 2 - 1.5), (W / 2 + 1.5, -D / 2 - 1.5)], 3.5, rnd)
    elif style == 'apartment':
        wall = mat('wall', srgb('#d9a07c'), rough=0.7)
        flat_block(0, 0, W, D, H, wall, gravel('#b8a898'), mat('par', srgb('#eec4a2'), rough=0.6))
        soil = mat('soil', srgb('#6a4a32'), rough=1.0, noise=0.2, noise_scale=20)
        bush = mat('bush', srgb('#4f8a3c'), rough=0.8, noise=0.3, noise_scale=10)
        bush2 = mat('bush2', srgb('#7aa646'), rough=0.8, noise=0.3, noise_scale=10)
        flower = mat('flower', srgb('#f28fb0'), rough=0.7, noise=0.1)
        for i in range(4):
            px_ = -W / 2 + 2.2 + i * (W - 4.4) / 3
            cube((px_, -D / 4, H + 0.35), (2.6, D / 2 - 3, 0.7), soil, bevel=0.05)
            for j in range(5):
                sphere((px_ + rnd.uniform(-0.8, 0.8), -D / 4 + rnd.uniform(-D / 4 + 2, D / 4 - 2), H + 0.9), rnd.uniform(0.5, 0.9), bush if j % 2 else bush2, scale=(1, 1, 0.7), segs=10)
            sphere((px_ + 0.5, -D / 4, H + 1.4), 0.3, flower, segs=8)
        string_lights([(-W / 2 + 1, -2), (W / 2 - 1, -D / 2 + 1)], H + 2.6, rnd)
        string_lights([(-W / 2 + 1, -D / 2 + 1), (W / 2 - 1, -2)], H + 2.6, rnd)
        water_tank(W / 4, D / 4, H, wood, dark)
        water_tank(-W / 4, D / 4 + 0.5, H, wood, dark)
        cube((0, D / 3, H + 1.3), (3.0, 2.5, 2.6), wall, bevel=0.1)
        ac_unit(W / 2 - 2, D / 2 - 2, H, metal, dark)
        facade_windows(W, D, floors, rnd, lit=0.7)
        feat_h = 4.0
    elif style == 'motel':
        wall = mat('wall', srgb('#9fd8cf'), rough=0.7)
        roof_m = gravel('#e8d8c0')
        par = mat('par', srgb('#f6efe2'), rough=0.6)
        # L-shape: west wing + north wing, pool court in the south-east
        flat_block(-W / 2 + 4.5, 0, 9.0, D, H, wall, roof_m, par)
        flat_block(4.5, D / 2 - 4.0, W - 9.0, 8.0, H, wall, roof_m, par)
        court = mat('court', srgb('#e9d9bf'), rough=0.8, noise=0.15, noise_scale=8)
        water = mat('pool', srgb('#43c8dc'), rough=0.05, spec=1.0, emit=(0.3, 0.85, 1.0), night=3.0, day=0.15, noise=0.1, noise_scale=3)
        cube((4.5, -4.0, 0.06), (W - 9.4, D - 8.4, 0.1), court)
        cube((4.5, -4.5, 0.13), (W - 15, D - 15, 0.06), water, bevel=0.6)
        for i in range(4):
            cube((W / 2 - 2.0, -D / 2 + 2 + i * 1.6, 0.4), (1.6, 0.7, 0.25), mat('lounger', srgb('#ffd166'), rough=0.6, noise=0), bevel=0.08)
        # walkway canopy along the wings
        canopy = mat('canopy', srgb('#f08a7e'), rough=0.6, noise=0.08)
        cube((-W / 2 + 9.6, 0, 3.2), (1.6, D - 0.4, 0.12), canopy)
        cube((4.5, D / 2 - 8.6, 3.2), (W - 9.4, 1.6, 0.12), canopy)
        for i in range(6):
            ac_unit(-W / 2 + 4.5, -D / 2 + 2 + i * (D - 4) / 5, H, metal, dark)
        neon_sign(b.get('sign', 'MOTEL'), W / 2 - 5, -D / 2 + 1.2, 6.5, 1.6)
        cyl((W / 2 - 5, -D / 2 + 1.2, 3.2), 0.12, 6.4, dark)
        facade_windows(W, D, 1, rnd, lit=0.8)
        string_lights([(-W / 2 + 10, -D / 2 + 1), (W / 2 - 1, -D / 2 + 1)], 3.0, rnd)
    elif style == 'office':
        wall = mat('wall', srgb('#c9cdd8'), rough=0.5)
        flat_block(0, 0, W, D, H, wall, gravel('#9ea0a8'), mat('par', srgb('#e8e6ea'), rough=0.5), par_h=1.0, par_w=0.5)
        glassroof = mat('atrium', srgb('#7fa6c8'), rough=0.06, spec=1.0, emit=(1.0, 0.78, 0.5), night=5.0, day=0.0, noise=0)
        cube((-W / 5, -D / 5, H + 1.0), (W / 2.6, D / 2.6, 2.0), wall)
        cube((-W / 5, -D / 5, H + 2.1), (W / 2.6 - 0.3, D / 2.6 - 0.3, 0.5), glassroof, taper=(0.4, 1.0))
        cube((W / 4, D / 4, H + 2.0), (W / 3, D / 3, 4.0), wall, bevel=0.1)
        cube((W / 4, D / 4, H + 4.05), (W / 3 - 0.5, D / 3 - 0.5, 0.1), gravel('#8e9098'))
        for i in range(2):
            for j in range(2):
                ac_unit(W / 4 - 1.2 + i * 2.4, D / 4 - 1 + j * 2, H + 4.1, metal, dark)
        skylights(W / 4, -D / 4, W / 3, D / 3, H, 3, 3, rnd, glow=3.0)
        heli = mat('helipad', srgb('#3a3c46'), rough=0.8, noise=0.05)
        cyl((-W / 4, D / 4, H + 0.12), 3.2, 0.1, heli, verts=40)
        text_obj('H', (-W / 4, D / 4, H + 0.2), 3.0, mat('hpaint', srgb('#f2e6c8'), rough=0.7, noise=0), extrude=0.01)
        facade_windows(W, D, floors, rnd, lit=0.85)
        feat_h = 4.2
    elif style == 'club':
        wall = mat('wall', srgb('#3b2f52'), rough=0.6)
        flat_block(0, 0, W, D, H, wall, gravel('#4a405e'), mat('par', srgb('#5d4f78'), rough=0.5))
        edge = mat('edgeglow', srgb('#ff5cd6'), rough=0.3, emit=(1.0, 0.3, 0.85), night=14.0, day=0.6, noise=0)
        for (px, py, sx, sy) in [(0, D / 2 - 0.1, W, 0.15), (0, -D / 2 + 0.1, W, 0.15), (W / 2 - 0.1, 0, 0.15, D), (-W / 2 + 0.1, 0, 0.15, D)]:
            cube((px, py, H + 0.68), (sx, sy, 0.12), edge)
        neon_sign(b.get('sign', 'NOVA'), 0, 0, H + 0.5, 4.0, plate=False)
        for i in range(4):
            ac_unit(-W / 2 + 2 + i * 1.8, D / 2 - 2, H, metal, dark)
        cube((W / 2 - 3, -D / 2 + 3, H + 1.2), (3, 3, 2.4), wall)
        facade_windows(W, D, 1, rnd, lit=0.6, shop=True)
        string_lights([(-W / 2 - 1.2, -D / 2 - 1.2), (W / 2 + 1.2, -D / 2 - 1.2)], 3.2, rnd)
    elif style == 'police':
        wall = mat('wall', srgb('#d8dde6'), rough=0.6)
        flat_block(0, 0, W, D, H, wall, gravel('#a8adb8'), mat('par', srgb('#3c4e78'), rough=0.5), par_h=0.8)
        heli = mat('helipad', srgb('#2e3442'), rough=0.8, noise=0.05)
        cyl((W / 5, 0, H + 0.12), 4.0, 0.1, heli, verts=40)
        ring = mat('hring', srgb('#f2c14e'), rough=0.6, noise=0)
        cyl((W / 5, 0, H + 0.13), 3.6, 0.1, ring, verts=40)
        cyl((W / 5, 0, H + 0.14), 3.3, 0.1, heli, verts=40)
        text_obj('H', (W / 5, 0, H + 0.2), 3.6, mat('hpaint', srgb('#f2e6c8'), rough=0.7, noise=0), extrude=0.01)
        for i in range(4):
            ac_unit(-W / 3, -D / 3 + i * 2.2, H, metal, dark)
        mast = mat('mast', srgb('#d0d0d0'), rough=0.4, metal=0.8, noise=0)
        cyl((-W / 2 + 2, D / 2 - 2, H + 3), 0.1, 6, mast)
        blue = mat('beacon', srgb('#2a5aff'), rough=0.3, emit=(0.2, 0.4, 1.0), night=20, day=1.0, noise=0)
        sphere((-W / 2 + 2, D / 2 - 2, H + 6.1), 0.25, blue)
        sign = mat('signblue', srgb('#2a4aa8'), rough=0.5, noise=0)
        cube((0, -D / 2 - 0.6, 3.6), (8, 1.2, 0.15), sign)
        text_obj('POLICE', (0, -D / 2 - 0.6, 3.72), 0.8, mat('ptxt', srgb('#ffffff'), rough=0.6, emit=(0.9, 0.95, 1.0), night=8, day=0.3, noise=0), extrude=0.01)
        facade_windows(W, D, floors, rnd, lit=0.85, shop=True)
        feat_h = 6.0
    elif style == 'warehouse':
        wall = mat('wall', srgb('#c98b6b'), rough=0.8)
        cube((0, 0, H / 2), (W, D, H), wall)
        roofm = mat('saw', srgb('#bcb4ac'), rough=0.5, metal=0.4, noise=0.12, noise_scale=8)
        glass = mat('sawglass', srgb('#8fb0cc'), rough=0.1, spec=1.0, emit=(1.0, 0.8, 0.55), night=3.0, day=0.0, noise=0)
        n = int(W / 4.0)
        for i in range(n):
            x0 = -W / 2 + i * W / n
            x1 = x0 + W / n
            verts = [(x0, -D / 2, H), (x1, -D / 2, H), (x1, D / 2, H), (x0, D / 2, H), (x0, -D / 2, H + 2.0), (x0, D / 2, H + 2.0)]
            me = bpy.data.meshes.new('saw')
            me.from_pydata(verts, [], [(0, 1, 2, 3), (1, 4, 5, 2), (0, 4, 1), (3, 2, 5)])
            o = bpy.data.objects.new('saw', me)
            bpy.context.scene.collection.objects.link(o)
            o.data.materials.append(roofm)
            track(o)
            gq = [(x0 + 0.05, -D / 2 + 0.3, H + 0.2), (x0 + 0.05, D / 2 - 0.3, H + 0.2), (x0 + 0.05, D / 2 - 0.3, H + 1.85), (x0 + 0.05, -D / 2 + 0.3, H + 1.85)]
            quads_mesh('sawg', [gq], glass)
        doors = mat('door', srgb('#e8d6b0'), rough=0.6, noise=0.05)
        for i in range(3):
            cube((-W / 3 + i * W / 3, -D / 2 - 0.05, 2.0), (4.0, 0.1, 4.0), doors)
        facade_windows(W, D, 1, rnd, lit=0.5)
        feat_h = 2.0
    elif style in ('house', 'villa'):
        wall = mat('wall', srgb(rnd.choice(['#f4e3c8', '#f2c6b0', '#d8e8d0', '#f6d8a8'])), rough=0.7)
        tiles = tile_mat('tiles', rnd.choice(['#c4583a', '#b8603c', '#d07048']))
        hw, hd = W * 0.62, D * 0.55
        hx, hy = -W / 2 + hw / 2 + 0.5, D / 2 - hd / 2 - 0.5
        cube((hx, hy, H / 2), (hw, hd, H), wall)
        hip_roof(hx, hy, hw, hd, H, min(hw, hd) * 0.32, tiles)
        if style == 'villa':
            wing_w, wing_d = W * 0.35, D * 0.4
            wx, wy = hx + hw / 2 + wing_w / 2 - 0.5, hy + hd / 2 - wing_d / 2
            cube((wx, wy, (H - 2) / 2), (wing_w, wing_d, H - 2), wall)
            hip_roof(wx, wy, wing_w, wing_d, H - 2, min(wing_w, wing_d) * 0.32, tiles)
        # yard: pool, deck, hedge, lounge
        deck = mat('deck', srgb('#c89a6a'), rough=0.7, noise=0.25, noise_scale=12)
        water = mat('pool', srgb('#3fc6d8'), rough=0.05, spec=1.0, emit=(0.3, 0.85, 1.0), night=3.0, day=0.15, noise=0.1, noise_scale=3)
        pw, pd = W * 0.42, D * 0.22
        px_, py_ = W / 2 - pw / 2 - 1.2, -D / 2 + pd / 2 + 1.5
        cube((px_, py_, 0.05), (pw + 2.2, pd + 2.2, 0.1), deck)
        cube((px_, py_, 0.11), (pw, pd, 0.06), water, bevel=0.4)
        hedge = mat('hedge', srgb('#3f7a3a'), rough=0.9, noise=0.3, noise_scale=12)
        for (ax, ay, sx, sy) in [(0, -D / 2 + 0.4, W, 0.8), (-W / 2 + 0.4, 0, 0.8, D), (W / 2 - 0.4, 0, 0.8, D)]:
            cube((ax, ay, 0.6), (sx, sy, 1.2), hedge, bevel=0.3)
        for i in range(2):
            cube((px_ - pw / 2 + 1 + i * 1.6, py_ + pd / 2 + 1.6, 0.35), (0.7, 1.6, 0.25), mat('lounger', srgb('#f6efe2'), rough=0.6, noise=0), bevel=0.08)
        palm_tree(-W / 2 + 2.0, -D / 2 + 2.5, rnd, height=6.5)
        if style == 'villa':
            palm_tree(W / 2 - 2.0, D / 2 - 2.0, rnd, height=8.0)
        facade_windows(hw, hd, 1, rnd, lit=0.9)
        for o in ASSET_OBJS[-1:]:
            if o.name.startswith('windows'):
                o.location = (hx, hy, 0)
        string_lights([(px_ - pw / 2 - 1, py_ - pd / 2 - 1.2), (px_ + pw / 2 + 1, py_ - pd / 2 - 1.2)], 2.4, rnd)
        feat_h = 3.0 if style == 'house' else 2.0
    return H + feat_h


def bake_buildings():
    reset()
    MANIFEST.setdefault('buildings', {})
    for b in LAYOUT['buildings']:
        if ONLY and b['id'] not in ONLY:
            continue
        t0 = time.time()
        top = build_building(b)
        W, D = b['w'] / UPM, b['d'] / UPM
        m = 3.0
        set_pass('color')
        frame(0, 0, W + 2 * m, D + 2 * m, BLD_PPM)
        render(f'{TMP}/c.png')
        save_np(kuwahara(load_np(f'{TMP}/c.png'), 2), f'{OUT}/bld_{b["id"]}.png')
        set_pass('shadow')
        scx, scy, sw, shh = shadow_frame_for(-W / 2 - 1, -D / 2 - 1, W / 2 + 1, D / 2 + 1, top)
        frame(scx, scy, sw, shh, BLD_SH_PPM)
        render(f'{TMP}/s.png')
        save_np(shadow_to_alpha(load_np(f'{TMP}/s.png')), f'{OUT}/bld_{b["id"]}_sh.png')
        set_pass('night')
        nm = 9.0
        frame(0, 0, W + 2 * nm, D + 2 * nm, BLD_NIGHT_PPM)
        render(f'{TMP}/n.png')
        save_np(load_np(f'{TMP}/n.png'), f'{OUT}/bld_{b["id"]}_night.png')
        MANIFEST['buildings'][b['id']] = {
            'color': manifest_entry(f'bld_{b["id"]}.png', 0, 0, W + 2 * m, D + 2 * m),
            'shadow': manifest_entry(f'bld_{b["id"]}_sh.png', scx, scy, sw, shh),
            'night': manifest_entry(f'bld_{b["id"]}_night.png', 0, 0, W + 2 * nm, D + 2 * nm),
        }
        save_manifest()
        clear_asset()
        print(f'building {b["id"]} baked in {time.time() - t0:.1f}s', flush=True)


# ============================================================================= main
GROUPS = {'cars': bake_cars, 'peds': bake_peds, 'buildings': bake_buildings}

if __name__ == '__main__':
    todo = list(GROUPS) if GROUP == 'all' else [GROUP]
    for gname in todo:
        if gname in GROUPS:
            GROUPS[gname]()
    print('BAKE DONE', todo)

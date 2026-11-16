"""bake_slice.py — Asset baker for Palm City Gemini Asset Slice.

Bakes real game-ready WebP sprite sheets into gemini-slice/assets/ and updates
gemini-slice/assets/manifest.json, matching the baked golden-hour sun
(azimuth 255 deg, elevation 30 deg, warm (1.0, 0.74, 0.50), cool violet sky fill).

Usage (from games/palm-city/gemini-slice/):
    blender -b -P tools/bake_slice.py -- buildings club office garage apartments motel
    blender -b -P tools/bake_slice.py -- cars
    blender -b -P tools/bake_slice.py -- props
    blender -b -P tools/bake_slice.py -- peds
"""
import bpy
import json
import math
import os
import random
import sys
import time
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets')
TMP = os.path.join('/tmp', 'palm_slice_bake')
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

LAYOUT = json.load(open(os.path.join(ROOT, 'layout.json')))
UPM = LAYOUT['unitsPerMetre']

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
QUICK = '--quick' in argv
argv = [a for a in argv if not a.startswith('--')]
GROUP = argv[0] if argv else 'all'
ONLY = set(argv[1:])

SUN_AZ = math.radians(LAYOUT['sun']['azimuthDeg'])
SUN_EL = math.radians(LAYOUT['sun']['elevationDeg'])
SUN_VEC = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))
SHADOW_DIR = Vector((-SUN_VEC.x, -SUN_VEC.y, 0)).normalized()
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

    w = bpy.data.worlds.new('sky')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.42, 0.46, 0.78, 1)
    bg.inputs[1].default_value = 0.55

    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = 4.4
    ld.color = (1.0, 0.74, 0.50)
    ld.angle = math.radians(2.2)
    sun = bpy.data.objects.new('sun', ld)
    sc.collection.objects.link(sun)
    sun.rotation_euler = SUN_VEC.to_track_quat('Z', 'Y').to_euler()

    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.clip_start = 0.1
    cd.clip_end = 500
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam

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
    bpy.context.scene.cycles.samples = max(8, n // 3) if QUICK else n


ASSET_OBJS = []
EMITTERS = []


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
    else:
        sc.render.film_transparent = False
        ground.hide_render = False
        ground.is_shadow_catcher = False
        sun.hide_render = True
        bg.inputs[1].default_value = 0.0
        set_samples(64)
    for m, night, day in EMITTERS:
        m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = night if mode == 'night' else day


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


# ----------------------------------------------------------------------------- painterly pipeline
def load_np(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1].copy()


def save_np(arr, path):
    h, w = arr.shape[:2]
    assert h <= 2048 and w <= 2048, f'Phone rule violation: {path} is {w}x{h} (>2048)'
    im = bpy.data.images.new('out', w, h, alpha=True)
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    if path.endswith('.webp'):
        st = bpy.context.scene.render.image_settings
        old = (st.file_format, st.color_mode)
        st.file_format = 'WEBP'
        st.color_mode = 'RGBA'
        st.quality = 90
        im.save_render(path, scene=bpy.context.scene)
        st.file_format, st.color_mode = old
    else:
        im.filepath_raw = path
        im.file_format = 'PNG'
        im.save()
    bpy.data.images.remove(im)


def box_mean(a, r):
    p = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def kuwahara(img, r=2):
    if r <= 0:
        return img
    a = img[..., 3:4]
    rgb = img[..., :3] * a
    lum = rgb.mean(axis=2)
    best, bestv = None, None
    step = max(1, r // 2 + 1) if r > 1 else 1
    ofs = [(-step, -step), (-step, step), (step, -step), (step, step)]
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


def oriented_stroke_pass(img, rad=3, strength=0.32, sat_boost=1.14):
    """Structure-tensor tangent brush stroke pass: smears oil dabs along contour tangents + impasto relief."""
    out = img.copy()
    a = out[..., 3]
    rgb = out[..., :3]
    lum = rgb.mean(axis=2)
    # Smooth gradient for stable tangent flow
    sm = box_mean(lum, 1)
    gx = np.roll(sm, -1, 1) - np.roll(sm, 1, 1)
    gy = np.roll(sm, -1, 0) - np.roll(sm, 1, 0)
    mag = np.sqrt(gx * gx + gy * gy) + 1e-5
    tx = -gy / mag
    ty = gx / mag

    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    acc = np.zeros_like(rgb)
    wsum = np.zeros((H, W, 1), dtype=np.float32)
    for s in range(-rad, rad + 1):
        sx = np.clip(np.round(xx + tx * s).astype(np.int32), 0, W - 1)
        sy = np.clip(np.round(yy + ty * s).astype(np.int32), 0, H - 1)
        wt = (1.0 - abs(s) / (rad + 1.5)) * (a[sy, sx] > 0.1)[..., None]
        acc += rgb[sy, sx] * wt
        wsum += wt
    smeared = np.where(wsum > 1e-4, acc / np.maximum(wsum, 1e-4), rgb)
    # Impasto tactile ridge relief along cross-stroke normal
    nx_hi = np.clip(np.round(xx + gx / mag).astype(np.int32), 0, W - 1)
    ny_hi = np.clip(np.round(yy + gy / mag).astype(np.int32), 0, H - 1)
    ridge = (lum - lum[ny_hi, nx_hi])[..., None] * 0.45
    blended = np.clip(rgb * (1.0 - strength) + smeared * strength + ridge, 0.0, 1.0)
    # Gentle saturation lift
    l_new = blended.mean(axis=2, keepdims=True)
    blended = np.clip(l_new + (blended - l_new) * sat_boost, 0.0, 1.0)
    out[..., :3] = np.where((a > 0.02)[..., None], blended, rgb)
    return out


def ink(img, line=0.72, inner=0.35):
    a = img[..., 3]
    dil = a.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        dil = np.maximum(dil, np.roll(np.roll(a, dy, 0), dx, 1))
    rim = np.clip(dil - a, 0, 1) * line
    lum = (img[..., :3] * a[..., None]).mean(axis=2)
    gy = np.abs(np.roll(lum, 1, 0) - np.roll(lum, -1, 0))
    gx = np.abs(np.roll(lum, 1, 1) - np.roll(lum, -1, 1))
    edge = np.clip((gx + gy) * 2.5, 0, 1) * inner
    out = img.copy()
    plum = np.array([0.13, 0.06, 0.18], dtype=np.float32)
    out[..., :3] = out[..., :3] * (1 - edge[..., None]) + plum * edge[..., None]
    na = a + rim * (1 - a)
    w = np.where(na > 1e-4, rim * (1 - a) / np.maximum(na, 1e-4), 0)
    out[..., :3] = out[..., :3] * (1 - w[..., None]) + plum * w[..., None]
    out[..., 3] = na
    return out


def paint_finish(img, kuw_r=3, stroke_r=3, stroke_s=0.32, line=0.72, inner=0.36):
    return ink(oriented_stroke_pass(kuwahara(img, kuw_r), rad=stroke_r, strength=stroke_s), line=line, inner=inner)


def night_clean(img, fade=0.12):
    rgb = img[..., :3].copy()
    h, w = rgb.shape[:2]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    floor = np.percentile(border, 60, axis=0)
    rgb = np.clip(rgb - floor * 1.05, 0, 1)
    yy = np.linspace(0, 1, h)[:, None]
    xx = np.linspace(0, 1, w)[None, :]
    ramp = lambda t: (np.clip(t / fade, 0, 1) ** 2) * (3 - 2 * np.clip(t / fade, 0, 1))
    mask = ramp(xx) * ramp(1 - xx) * ramp(yy) * ramp(1 - yy)
    out = np.zeros((h, w, 4), dtype=np.float32)
    out[..., :3] = rgb * mask[..., None]
    out[..., 3] = 1
    return out


def shadow_to_alpha(img, full=0.6):
    out = np.zeros_like(img)
    out[..., 3] = np.clip(img[..., 3] / full, 0, 1)
    return out


# ----------------------------------------------------------------------------- materials & geo
def mat(name, color, rough=0.6, metal=0.0, coat=0.0, noise=0.08, noise_scale=6.0, emit=None, night=0.0, day=0.0, transmission=0.0, spec=0.5):
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
        tex.inputs['Detail'].default_value = 4.0
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        lo = [max(0, x * (1 - noise * 1.5)) for x in c[:3]] + [1]
        hi = [min(1, x * (1 + noise * 1.1)) for x in c[:3]] + [1]
        ramp.color_ramp.elements[0].color = lo
        ramp.color_ramp.elements[1].color = hi
        ramp.color_ramp.elements[0].position = 0.28
        ramp.color_ramp.elements[1].position = 0.72
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


def cube(loc, size, material, bevel=0.0, segs=3, name='box', rot=None, taper=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    if rot is not None:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if taper is not None:
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


# ============================================================================= CARS (16 angles, glossier roof glints)
CAR_ANGLES = 16   # >= 8 angles minimum requested for the slice
CAR_PPM = 20
CAR_FRAME = 6.4
CAR_SH_PPM = 10
CAR_SH_FRAME = 9.6

CAR_SET = [
    ('sedan_coral', 'sedan', '#e65a46'),
    ('sedan_teal', 'sedan', '#24a6a2'),
    ('sedan_cream', 'sedan', '#f2dfb4'),
    ('sedan_plum', 'sedan', '#844ca0'),
    ('conv_mint', 'convertible', '#6eddc0'),
    ('conv_rose', 'convertible', '#f47ca2'),
    ('van_sky', 'van', '#6caee8'),
    ('van_sun', 'van', '#f5b028'),
    ('taxi', 'taxi', '#ffc818'),
    ('police', 'police', '#1a2238'),
]


def build_car(kind, paint):
    root = bpy.data.objects.new('car', None)
    bpy.context.scene.collection.objects.link(root)
    track(root)
    body = mat('paint', srgb(paint), rough=0.22, coat=1.0, noise=0.06, noise_scale=3, spec=0.85)
    glass = mat('glass', srgb('#141c34'), rough=0.04, spec=1.0, coat=1.0, noise=0)
    trim = mat('trim', srgb('#1f1d28'), rough=0.55, noise=0)
    chrome = mat('chrome', (0.86, 0.88, 0.92), rough=0.1, metal=1.0, noise=0)
    tyre = mat('tyre', srgb('#141318'), rough=0.9, noise=0)
    head = mat('headl', (1, 0.95, 0.85), rough=0.2, emit=(1.0, 0.86, 0.62), night=42, day=0.6, noise=0)
    tail = mat('taill', srgb('#c8142e'), rough=0.3, emit=(1.0, 0.1, 0.08), night=32, day=0.5, noise=0)
    objs = []
    L, Wd = (4.9, 2.0) if kind == 'van' else (4.6, 1.9)
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(cyl((sx * (Wd / 2 - 0.12), sy * (L / 2 - 0.85), 0.34), 0.34, 0.26, tyre, rot=(0, math.pi / 2, 0)))

    hl = mat('roofhl', tuple(min(1, c * 1.8 + 0.24) for c in srgb(paint)), rough=0.08, coat=1.0, spec=1.0, noise=0)
    w_glint = mat('windglint', (0.62, 0.76, 0.96), rough=0.05, coat=1.0, spec=1.0, noise=0)
    if kind == 'van':
        objs.append(cube((0, 0, 0.95), (Wd, L, 1.5), body, bevel=0.22, name='body'))
        objs.append(cube((0, L / 2 - 0.65, 1.1), (Wd - 0.18, 0.9, 1.2), glass, bevel=0.15))
        objs.append(cube((0, -0.2, 1.72), (Wd - 0.12, L - 1.3, 0.06), body, bevel=0.02))
        objs.append(cube((-0.22, -0.1, 1.76), (0.48, L - 1.7, 0.015), hl))
        objs.append(cube((0.35, -0.3, 1.76), (0.14, L - 2.1, 0.012), w_glint))
        for i in range(4):
            objs.append(cube((0, -1.3 + i * 0.7, 1.8), (Wd - 0.35, 0.07, 0.05), chrome))
        objs.append(cube((0, L / 2 - 0.08, 0.7), (Wd - 0.3, 0.1, 0.25), chrome))
    else:
        objs.append(cube((0, 0, 0.55), (Wd, L, 0.62), body, bevel=0.24, segs=4, name='body', taper=(0.9, 0.97)))
        for yy in (L / 2 - 0.95, -L / 2 + 0.75):
            objs.append(cube((0, yy, 0.86), (Wd - 0.5, 0.025, 0.02), trim))
        objs.append(cube((-0.25, L / 2 - 0.6, 0.865), (0.42, 0.65, 0.015), hl))  # hood glint
        if kind == 'convertible':
            seat = mat('seat', srgb('#f2e3c8'), rough=0.65, noise=0.1)
            objs.append(cube((0, 0.3, 0.86), (Wd - 0.35, 0.6, 0.06), glass, bevel=0.02))
            objs.append(cube((0, 0.55, 1.1), (Wd - 0.3, 0.08, 0.35), glass, rot=(0.5, 0, 0)))
            objs.append(cube((-0.25, 0.53, 1.24), (0.55, 0.05, 0.04), w_glint))
            for sx in (-0.45, 0.45):
                objs.append(cube((sx, -0.4, 0.95), (0.6, 0.65, 0.18), seat, bevel=0.08))
                objs.append(cube((sx, -0.75, 1.15), (0.55, 0.15, 0.45), seat, bevel=0.06))
            objs.append(cube((0, -1.4, 0.88), (Wd - 0.4, 0.9, 0.08), body, bevel=0.05))
        else:
            cab_len = 2.2 if kind != 'taxi' else 2.1
            objs.append(cube((0, -0.25, 1.05), (Wd - 0.3, cab_len, 0.55), glass, bevel=0.12, segs=3, name='cabin', taper=(0.78, 0.62)))
            objs.append(cube((0, -0.3, 1.33), (Wd - 0.62, cab_len - 1.0, 0.05), body, bevel=0.06, name='roof'))
            # Glossier dual-ribbon roof + windshield glints so cars catch sun at game zoom
            objs.append(cube((-0.18, -0.18, 1.37), (0.45, cab_len - 1.15, 0.014), hl))
            objs.append(cube((0.26, -0.32, 1.37), (0.14, cab_len - 1.35, 0.012), hl))
            objs.append(cube((-0.15, 0.52, 1.15), (0.72, 0.18, 0.02), w_glint, rot=(0.35, 0, 0)))
    for sx in (-1, 1):
        objs.append(cube((sx * (Wd / 2 - 0.32), L / 2 - 0.04, 0.62), (0.42, 0.1, 0.16), head, bevel=0.03))
        objs.append(cube((sx * (Wd / 2 - 0.3), -L / 2 + 0.04, 0.66), (0.4, 0.1, 0.14), tail, bevel=0.03))
        objs.append(cube((sx * (Wd / 2 + 0.06), 0.55, 0.95), (0.14, 0.1, 0.08), trim))
    objs.append(cube((0, -L / 2 + 0.03, 0.42), (Wd - 0.2, 0.08, 0.12), chrome))
    objs.append(cube((0, L / 2 - 0.03, 0.42), (Wd - 0.2, 0.08, 0.12), chrome))
    if kind == 'taxi':
        sign = mat('taxisign', srgb('#fff4d8'), rough=0.4, emit=(1.0, 0.85, 0.5), night=8, day=0.3, noise=0)
        objs.append(cube((0, -0.3, 1.48), (0.9, 0.3, 0.22), sign, bevel=0.05))
        check = mat('check', srgb('#1a1a1a'), rough=0.5, noise=0)
        for i in range(6):
            objs.append(cube((Wd / 2 + 0.005, -1.3 + i * 0.35, 0.62), (0.02, 0.17, 0.12), check))
            objs.append(cube((-Wd / 2 - 0.005, -1.3 + i * 0.35, 0.62), (0.02, 0.17, 0.12), check))
    if kind == 'police':
        white = mat('pwhite', srgb('#f4efe4'), rough=0.25, coat=1.0, noise=0.03)
        objs.append(cube((0, 0, 1.36), (Wd - 0.4, 1.0, 0.04), white, bevel=0.04))
        objs.append(cube((0, 1.55, 0.88), (Wd - 0.5, 0.9, 0.04), white, bevel=0.04))
        red = mat('lbr', srgb('#e01a2a'), rough=0.3, emit=(1, 0.1, 0.1), night=7, day=0.4, noise=0)
        blue = mat('lbb', srgb('#1a44e0'), rough=0.3, emit=(0.1, 0.3, 1), night=7, day=0.4, noise=0)
        objs.append(cube((-0.4, -0.05, 1.46), (0.7, 0.32, 0.16), red, bevel=0.05))
        objs.append(cube((0.4, -0.05, 1.46), (0.7, 0.32, 0.16), blue, bevel=0.05))
    parent_all(root, objs)
    return root


def car_headlight_rig(kind):
    L = 4.9 if kind == 'van' else 4.6
    for sx in (-0.65, 0.65):
        spot_light((sx, L / 2 + 0.1, 0.75), (math.radians(90 - 11), 0, 0), 2200, (1.0, 0.88, 0.66), size_deg=40, blend=0.8)
    point_light((0, -L / 2 - 0.4, 0.6), 18, (1.0, 0.12, 0.08), radius=0.4)


def bake_cars():
    reset()
    MANIFEST.setdefault('cars', {})
    for name, kind, paint in CAR_SET:
        if ONLY and name not in ONLY:
            continue
        t0 = time.time()
        root = build_car(kind, paint)
        col, sh = [], []
        scx, scy = SHADOW_DIR.x * 1.2, SHADOW_DIR.y * 1.2
        for k in range(CAR_ANGLES):
            th = k * 2 * math.pi / CAR_ANGLES
            root.rotation_euler = (0, 0, -th - math.pi / 2)
            set_pass('color')
            frame(0, 0, CAR_FRAME, CAR_FRAME, CAR_PPM)
            render(f'{TMP}/c.png')
            col.append(paint_finish(load_np(f'{TMP}/c.png'), kuw_r=2, stroke_r=2, stroke_s=0.28, line=0.68, inner=0.32))
            set_pass('shadow')
            frame(scx, scy, CAR_SH_FRAME, CAR_SH_FRAME, CAR_SH_PPM)
            render(f'{TMP}/s.png')
            sh.append(shadow_to_alpha(load_np(f'{TMP}/s.png')))
        cols = 8
        save_np(sheet(col, cols), f'{OUT}/car_{name}.webp')
        save_np(sheet(sh, cols), f'{OUT}/car_{name}_sh.webp')
        root.rotation_euler = (0, 0, 0)
        car_headlight_rig(kind)
        set_pass('night')
        frame(0, 5.0, 7.0, 22.0, 8)
        render(f'{TMP}/n.png')
        save_np(night_clean(load_np(f'{TMP}/n.png'), 0.06), f'{OUT}/car_{name}_light.webp')
        MANIFEST['cars'][name] = {
            'kind': kind, 'angles': CAR_ANGLES, 'cols': cols,
            'color': manifest_entry(f'car_{name}.webp', 0, 0, CAR_FRAME, CAR_FRAME),
            'shadow': manifest_entry(f'car_{name}_sh.webp', scx, scy, CAR_SH_FRAME, CAR_SH_FRAME),
            'light': manifest_entry(f'car_{name}_light.webp', 0, 5.0, 7.0, 22.0),
            'length': (4.9 if kind == 'van' else 4.6) * UPM, 'width': (2.0 if kind == 'van' else 1.9) * UPM,
        }
        save_manifest()
        clear_asset()
        print(f'car {name} ({CAR_ANGLES} angles) baked in {time.time() - t0:.1f}s', flush=True)


# ============================================================================= PEOPLE (1.7x scale, 8 angles, readable hats/shirts/stride)
PED_ANGLES = 8      # >= 4 angles minimum requested for the slice
PED_SCALE = 2.4 * 1.7
PED_PPM = 18        # 6.63m * 18 = 119px per frame -> cols=6 (4 angles * 3 poses? 2 angles * 3 = 6 cols) -> <= 960px sheet
PED_FRAME = 3.9 * 1.7
PED_SH_PPM = 7
PED_SH_FRAME = 11.0 * 1.7
PED_POSES = [1.0, 0.0, -1.0]

PED_SET = [
    ('player', '#19c4b4', '#263256', '#d08e64', '#241814', 'cap', '#f8f2e4'),
    ('ped_sun', '#f8cf52', '#e8aa38', '#ebb690', '#e8b85a', 'straw_visor', '#b84230'),
    ('ped_rose', '#ec6286', '#30324c', '#8a5a40', '#181010', 'beret', '#f8f8f8'),
    ('ped_white', '#f6f2e8', '#4c6ea8', '#5e3b2a', '#141010', 'cap_navy', '#262626'),
    ('ped_blue', '#4c88e0', '#e0c69a', '#f2caa8', '#b8452c', None, '#5a3a22'),
    ('ped_straw', '#9e62d0', '#3f5638', '#d29a74', '#3a2a20', 'hat', '#eae2d0'),
    ('cop', '#1e3264', '#162040', '#b47c58', '#1a1410', 'cop', '#111111'),
]


def build_ped(shirt, pants, skin, hair, headwear, shoes):
    root = bpy.data.objects.new('ped', None)
    bpy.context.scene.collection.objects.link(root)
    track(root)
    m_shirt = mat('shirt', srgb(shirt), rough=0.75, noise=0.14, noise_scale=10)
    m_pants = mat('pants', srgb(pants), rough=0.8, noise=0.1, noise_scale=12)
    m_skin = mat('skin', srgb(skin), rough=0.55, noise=0.05)
    m_hair = mat('hair', srgb(hair), rough=0.7, noise=0.15, noise_scale=25)
    m_shoe = mat('shoe', srgb(shoes), rough=0.5, noise=0)
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
                f = cube((0, 0.11, -length - 0.02), (0.14, 0.34, 0.10), end_mat, bevel=0.04)
            else:
                f = sphere((0, 0, -length), end_r * 1.15, end_mat, segs=10)
            f.parent = piv
        limbs[name] = piv
        return piv

    objs.append(limb('legL', (-0.12, 0, 0.9), 0.84, 0.082, m_pants, m_shoe, foot=True))
    objs.append(limb('legR', (0.12, 0, 0.9), 0.84, 0.082, m_pants, m_shoe, foot=True))
    objs.append(sphere((0, 0, 0.98), 0.18, m_pants, scale=(1.08, 0.78, 0.72)))
    objs.append(sphere((0, 0, 1.28), 0.28, m_shirt, scale=(1.05, 0.68, 1.22)))
    objs.append(sphere((0, 0, 1.48), 0.31, m_shirt, scale=(1.08, 0.64, 0.42)))
    # Crisp collar/stripe accent so shirts read distinctly at 420x860
    stripe_col = tuple(min(1, c * 1.45 + 0.18) for c in srgb(shirt))
    m_stripe = mat('sh_accent', stripe_col, rough=0.6, noise=0)
    objs.append(cube((0, 0, 1.56), (0.28, 0.18, 0.06), m_stripe, bevel=0.02))
    objs.append(limb('armL', (-0.30, 0, 1.48), 0.56, 0.068, m_shirt, m_skin, end_r=0.068))
    objs.append(limb('armR', (0.30, 0, 1.48), 0.56, 0.068, m_shirt, m_skin, end_r=0.068))
    objs.append(sphere((0, 0.01, 1.67), 0.125, m_skin))
    objs.append(sphere((0, -0.02, 1.71), 0.132, m_hair, scale=(1.0, 1.0, 0.75)))
    if headwear == 'cap':
        cm = mat('cap', srgb('#ff5232'), rough=0.55, noise=0.06)
        objs.append(sphere((0, 0, 1.75), 0.135, cm, scale=(1.0, 1.0, 0.58)))
        objs.append(cube((0, 0.15, 1.74), (0.20, 0.18, 0.025), cm, bevel=0.03))
    elif headwear == 'cap_navy':
        cm = mat('capn', srgb('#e84a5f'), rough=0.55, noise=0.06)
        objs.append(sphere((0, 0, 1.75), 0.135, cm, scale=(1.0, 1.0, 0.58)))
        objs.append(cube((0, 0.15, 1.74), (0.20, 0.18, 0.025), cm, bevel=0.03))
    elif headwear == 'straw_visor':
        vm = mat('visor', srgb('#f6f0dc'), rough=0.6, noise=0.1)
        objs.append(cube((0, 0.14, 1.74), (0.22, 0.16, 0.025), vm, bevel=0.03))
    elif headwear == 'beret':
        bm = mat('beret', srgb('#f4efe4'), rough=0.7, noise=0.08)
        objs.append(sphere((0.02, -0.01, 1.77), 0.15, bm, scale=(1.05, 1.05, 0.42)))
    elif headwear == 'hat':
        hm = mat('straw', srgb('#edd484'), rough=0.75, noise=0.2, noise_scale=35)
        band = mat('hband', srgb('#d94a38'), rough=0.6, noise=0)
        objs.append(cyl((0, 0, 1.75), 0.27, 0.025, hm, verts=24))
        objs.append(cyl((0, 0, 1.78), 0.138, 0.04, band, verts=20))
        objs.append(sphere((0, 0, 1.77), 0.13, hm, scale=(1, 1, 0.62)))
    elif headwear == 'cop':
        cm = mat('copcap', srgb('#142048'), rough=0.45, noise=0)
        badge = mat('badge', srgb('#ffd24a'), rough=0.2, metal=1.0, noise=0)
        objs.append(cyl((0, 0, 1.76), 0.145, 0.09, cm, verts=20))
        objs.append(cube((0, 0.15, 1.74), (0.22, 0.13, 0.025), cm, bevel=0.03))
        objs.append(cube((0, 0.13, 1.81), (0.06, 0.04, 0.04), badge))
    parent_all(root, objs + [limbs[k] for k in limbs])
    root.scale = (PED_SCALE,) * 3
    return root, limbs


def pose_ped(limbs, stride):
    # Boosted stride angle (26 deg vs original 17 deg) so stride silhouette reads clearly at game zoom
    a = math.radians(26) * stride
    limbs['legL'].rotation_euler = (a, 0, 0)
    limbs['legR'].rotation_euler = (-a, 0, 0)
    limbs['armL'].rotation_euler = (-a * 1.35, -0.16, 0)
    limbs['armR'].rotation_euler = (a * 1.35, 0.16, 0)


def bake_peds():
    reset()
    MANIFEST.setdefault('peds', {})
    for name, shirt, pants, skin, hair, headwear, shoes in PED_SET:
        if ONLY and name not in ONLY:
            continue
        t0 = time.time()
        root, limbs = build_ped(shirt, pants, skin, hair, headwear, shoes)
        col, sh = [], []
        scx, scy = SHADOW_DIR.x * 3.6 * 1.7, SHADOW_DIR.y * 3.6 * 1.7
        for k in range(PED_ANGLES):
            th = k * 2 * math.pi / PED_ANGLES
            root.rotation_euler = (0, 0, -th - math.pi / 2)
            for stride in PED_POSES:
                pose_ped(limbs, stride)
                set_pass('color')
                frame(0, 0, PED_FRAME, PED_FRAME, PED_PPM)
                render(f'{TMP}/c.png')
                col.append(paint_finish(load_np(f'{TMP}/c.png'), kuw_r=2, stroke_r=2, stroke_s=0.25, line=0.74, inner=0.35))
                set_pass('shadow')
                frame(scx, scy, PED_SH_FRAME, PED_SH_FRAME, PED_SH_PPM)
                render(f'{TMP}/s.png')
                sh.append(shadow_to_alpha(load_np(f'{TMP}/s.png')))
        cols = len(PED_POSES) * 4  # 4 angles * 3 poses = 12 cols x 2 rows
        save_np(sheet(col, cols), f'{OUT}/ped_{name}.webp')
        save_np(sheet(sh, cols), f'{OUT}/ped_{name}_sh.webp')
        MANIFEST['peds'][name] = {
            'angles': PED_ANGLES, 'poses': len(PED_POSES), 'cols': cols,
            'color': manifest_entry(f'ped_{name}.webp', 0, 0, PED_FRAME, PED_FRAME),
            'shadow': manifest_entry(f'ped_{name}_sh.webp', scx, scy, PED_SH_FRAME, PED_SH_FRAME),
        }
        save_manifest()
        clear_asset()
        print(f'ped {name} (1.7x, {PED_ANGLES} angles) baked in {time.time() - t0:.1f}s', flush=True)


# ============================================================================= BUILDINGS & PROPS
BLD_PPM = 20
BLD_SH_PPM = 8
BLD_NIGHT_PPM = 8
NEON = {'SOLANA': '#ff4fa8', 'TACOS': '#ff8a3c', 'DINER': '#3fe0ff', 'MOTEL': '#ff3f6a', 'NOVA': '#ff48d8'}
WARM_WINDOW = (1.0, 0.72, 0.28)


def tile_mat(name, color):
    m = mat(name, srgb(color), rough=0.72, noise=0.16, noise_scale=5)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    ramp = [n for n in nt.nodes if n.type == 'VALTORGB'][0]
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 1.8
    wave.inputs['Distortion'].default_value = 1.2
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 0.42
    nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
    nt.links.new(wave.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m


def painted_roof(color, seed):
    m = mat('roofp', srgb(color), rough=0.88, noise=0.25, noise_scale=7)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    ramp = [n for n in nt.nodes if n.type == 'VALTORGB'][0]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.35, 4.2, 1.0)
    mp.inputs['Rotation'].default_value = (0, 0, (seed % 7) * 0.45)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    streak = nt.nodes.new('ShaderNodeTexNoise')
    streak.inputs['Scale'].default_value = 3.2
    streak.inputs['Detail'].default_value = 8.0
    nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
    stain = nt.nodes.new('ShaderNodeTexNoise')
    stain.inputs['Scale'].default_value = 0.35
    stain.noise_dimensions = '4D'
    stain.inputs['W'].default_value = seed
    sr = nt.nodes.new('ShaderNodeValToRGB')
    sr.color_ramp.elements[0].position = 0.45
    sr.color_ramp.elements[0].color = (0.76, 0.72, 0.78, 1)
    sr.color_ramp.elements[1].position = 0.65
    sr.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(stain.outputs['Fac'], sr.inputs['Fac'])
    m1 = nt.nodes.new('ShaderNodeMix'); m1.data_type = 'RGBA'; m1.blend_type = 'OVERLAY'
    m1.inputs['Factor'].default_value = 0.35
    nt.links.new(ramp.outputs['Color'], m1.inputs['A'])
    nt.links.new(streak.outputs['Color'], m1.inputs['B'])
    m2 = nt.nodes.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'
    m2.inputs['Factor'].default_value = 1.0
    nt.links.new(m1.outputs['Result'], m2.inputs['A'])
    nt.links.new(sr.outputs['Color'], m2.inputs['B'])
    nt.links.new(m2.outputs['Result'], bsdf.inputs['Base Color'])
    return m


# Deepened, higher-chroma coastal palette from GEMINI-DELTA.md
PASTEL = ['#e0825c', '#58b4a0', '#d96e8c', '#e8a258', '#685ca6', '#3c629c']


def flat_block(cx, cy, W, D, H, wall, roof_col, par_col, par_h=0.95, par_w=0.5, seed=7):
    cube((cx, cy, H / 2), (W, D, H), wall)
    pm = mat('par', srgb(par_col), rough=0.6, noise=0.14, noise_scale=8)
    cap = mat('cap', tuple(min(1, c * 1.25 + 0.06) for c in srgb(par_col)), rough=0.5, noise=0.06)
    cube((cx, cy, H + 0.02), (W - 0.1, D - 0.1, 0.06), painted_roof(roof_col, seed))
    for (px, py, sx, sy) in [(cx, cy + D / 2 - par_w / 2, W, par_w), (cx, cy - D / 2 + par_w / 2, W, par_w),
                             (cx + W / 2 - par_w / 2, cy, par_w, D), (cx - W / 2 + par_w / 2, cy, par_w, D)]:
        cube((px, py, H + par_h / 2), (sx, sy, par_h), pm, bevel=0.05)
        cube((px, py, H + par_h + 0.04), (sx + 0.12, sy + 0.12, 0.08), cap, bevel=0.03)


def ac_unit(x, y, z, metal, dark):
    cube((x, y, z + 0.4), (1.3, 1.0, 0.8), metal, bevel=0.05)
    cyl((x, y + 0.1, z + 0.81), 0.35, 0.04, dark, verts=16)


def cafe_umbrella(x, y, z, col, pole_m):
    cyl((x, y, z + 1.1), 0.05, 2.2, pole_m, verts=8)
    bpy.ops.mesh.primitive_cone_add(radius1=1.45, radius2=0.06, depth=0.52, vertices=8, location=(x, y, z + 2.35))
    u = bpy.context.active_object
    u.data.materials.append(mat('umb', srgb(col), rough=0.65, noise=0.08))
    track(u)


def patio_set(x, y, z, wood, chair_col, table_r=0.75):
    cyl((x, y, z + 0.45), 0.08, 0.9, wood, verts=8)
    cyl((x, y, z + 0.92), table_r, 0.08, wood, verts=16)
    cm = mat('chair', srgb(chair_col), rough=0.7, noise=0.05)
    for k in range(4):
        ang = k * math.pi / 2 + 0.35
        cube((x + math.cos(ang) * (table_r + 0.38), y + math.sin(ang) * (table_r + 0.38), z + 0.45),
             (0.46, 0.46, 0.45), cm, bevel=0.04)


def garden_bed(cx, cy, w, d, z, rnd, night_lit=False):
    soil = mat('soil', srgb('#5a3d28'), rough=1.0, noise=0.2, noise_scale=18)
    border = mat('bedborder', srgb('#9e5a38'), rough=0.7, noise=0.1)
    bush_a = mat('bA', srgb('#2e6f30'), rough=0.8, noise=0.25, noise_scale=10)
    bush_b = mat('bB', srgb('#5ea442'), rough=0.8, noise=0.25, noise_scale=10)
    fl_cols = ['#ff6b94', '#ffd24e', '#fff6dc', '#e882f2']
    fls = [mat('fl', srgb(c), rough=0.6, noise=0) for c in fl_cols]
    cube((cx, cy, z + 0.25), (w, d, 0.5), border, bevel=0.05)
    cube((cx, cy, z + 0.48), (w - 0.3, d - 0.3, 0.1), soil)
    count = max(4, int(w * d / 1.6))
    for i in range(count):
        bx = cx + rnd.uniform(-w / 2 + 0.45, w / 2 - 0.45)
        by = cy + rnd.uniform(-d / 2 + 0.45, d / 2 - 0.45)
        sphere((bx, by, z + 0.72), rnd.uniform(0.38, 0.65), bush_a if i % 2 else bush_b, scale=(1.0, 1.0, 0.72), segs=10)
        if rnd.random() < 0.55:
            sphere((bx + rnd.uniform(-0.2, 0.2), by + rnd.uniform(-0.2, 0.2), z + 1.05), 0.16, fls[i % len(fls)], segs=6)
    if night_lit:
        point_light((cx, cy, z + 2.4), 180, (1.0, 0.74, 0.32), radius=0.4)


def clothesline(p0, p1, z, rnd):
    wire = mat('wire', srgb('#2a2232'), rough=0.6, noise=0)
    cols = ['#f6efe2', '#e24c3b', '#387cc4', '#f4c644', '#3aa888', '#e86898']
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    ang = math.atan2(dy, dx)
    cube(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z), (L, 0.04, 0.04), wire, rot=(0, 0, ang))
    n = max(4, int(L / 1.1))
    for i in range(n):
        t = (i + 0.5) / n
        sag = math.sin(t * math.pi) * 0.25
        lx = p0[0] + dx * t
        ly = p0[1] + dy * t
        cm = mat('cloth', srgb(cols[(i + int(rnd.random() * 6)) % len(cols)]), rough=0.75, noise=0.05)
        cube((lx, ly, z - 0.25 - sag), (0.62, 0.14, 0.62), cm, bevel=0.03, rot=(0.18, 0, ang + rnd.uniform(-0.15, 0.15)))


def palm_crown(x, y, z, rnd, radius=3.0, fronds=12):
    leaf = mat('frond', srgb('#32762e'), rough=0.68, noise=0.25, noise_scale=8)
    leaf2 = mat('frond2', srgb('#6ea83e'), rough=0.68, noise=0.25, noise_scale=8)
    for f in range(fronds):
        ang = f / fronds * math.pi * 2 + rnd.uniform(-0.18, 0.18)
        L = radius * rnd.uniform(0.85, 1.12)
        verts, faces = [], []
        n = 14
        for i in range(n + 1):
            t = i / n
            d = L * t
            h = z + 0.65 * t - 1.75 * t * t
            hw = 0.58 * math.sin(math.pi * min(1, t * 1.15)) ** 0.6 + 0.02
            serr = 0.24 if i % 2 else -0.05
            cx_, cy_ = x + math.cos(ang) * d, y + math.sin(ang) * d
            px, py = -math.sin(ang), math.cos(ang)
            fw = hw + serr * hw
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


def palm_tree(x, y, rnd, height=None, lean_m=1.1, radius=3.0):
    trunk = mat('trunk', srgb('#8a6242'), rough=0.9, noise=0.2, noise_scale=20)
    H = height or rnd.uniform(7.0, 10.0)
    lean = rnd.uniform(0, math.pi * 2)
    lx, ly = math.cos(lean), math.sin(lean)
    segs = 8
    px, py, pz = x, y, 0
    for i in range(segs):
        t = (i + 1) / segs
        nx_, ny_ = x + lx * lean_m * t * t, y + ly * lean_m * t * t
        nz = H * t
        mx, my, mz = (px + nx_) / 2, (py + ny_) / 2, (pz + nz) / 2
        dv = Vector((nx_ - px, ny_ - py, nz - pz))
        c = cyl((mx, my, mz), 0.24 - 0.08 * t, dv.length + 0.05, trunk, verts=10)
        c.rotation_euler = dv.to_track_quat('Z', 'Y').to_euler()
        px, py, pz = nx_, ny_, nz
    palm_crown(px, py, H, rnd, radius=radius)
    return H


def facade_windows(W, D, floors, rnd, lit=0.8, shop=False, floor_h=3.2):
    win = mat('window', srgb('#3a3a52'), rough=0.2, emit=WARM_WINDOW, night=3.2, day=0.0, noise=0)
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
                if side == 0:
                    y = D / 2 + eps
                    quads.append([(a - hw, y, z0), (a + hw, y, z0), (a + hw, y, z1), (a - hw, y, z1)])
                elif side == 2:
                    y = -D / 2 - eps
                    quads.append([(a + hw, y, z0), (a - hw, y, z0), (a - hw, y, z1), (a + hw, y, z1)])
                elif side == 1:
                    x = W / 2 + eps
                    quads.append([(x, a + hw, z0), (x, a - hw, z0), (x, a - hw, z1), (x, a + hw, z1)])
                else:
                    x = -W / 2 - eps
                    quads.append([(x, a - hw, z0), (x, a + hw, z0), (x, a + hw, z1), (x, a - hw, z1)])
    if quads:
        quads_mesh('windows', quads, win)


def skylights(cx, cy, W, D, z, nx, ny, rnd, glow=1.35):
    glass = mat('skylight', srgb('#5c6f96'), rough=0.16, spec=0.85, emit=(1.0, 0.78, 0.30), night=glow, day=0.0, noise=0)
    frame_m = mat('skyframe', srgb('#d4c8b4'), rough=0.55, noise=0)
    for i in range(nx):
        for j in range(ny):
            x = cx - W / 2 + (i + 0.5) * W / nx
            y = cy - D / 2 + (j + 0.5) * D / ny
            cube((x, y, z + 0.25), (W / nx * 0.8 + 0.2, D / ny * 0.8 + 0.2, 0.5), frame_m)
            cube((x, y, z + 0.52), (W / nx * 0.8, D / ny * 0.8, 0.06), glass, taper=(0.9, 0.9))


def neon_sign(text, x, y, z, size, rot=0.0, plate=True, strength=15.0):
    col = srgb(NEON.get(text, '#ff48d8'))
    tube = mat('neon_' + text, tuple(min(1, c * 1.25 + 0.25) for c in col), rough=0.3, emit=col, night=strength, day=1.3, noise=0)
    if plate:
        back = mat('signback', srgb('#261d34'), rough=0.6, noise=0.05)
        w = size * len(text) * 0.62 + 0.8
        cube((x, y, z - 0.08), (w, size * 1.15, 0.12), back, bevel=0.06, rot=(0, 0, rot))
    text_obj(text, (x, y, z), size, tube, rot_z=rot, extrude=0.055)


def hip_roof(cx, cy, W, D, z, rise, material, overhang=0.4):
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


def build_slice_building(b):
    rnd = random.Random(b['seed'])
    W, D, H = b['w'] / UPM, b['d'] / UPM, b['h']
    style = b['style']
    feat_h = 1.8
    dark = mat('dark', srgb('#262230'), rough=0.6, noise=0.05)
    metal = mat('metal', srgb('#cfd0d8'), rough=0.38, metal=0.65, noise=0.08, noise_scale=10)
    wood = mat('wood', srgb('#9e6036'), rough=0.78, noise=0.22, noise_scale=12)
    floors = max(1, int(H / 3.2))

    if style == 'club':
        # NOVA nightclub: coral-terracotta roof in golden hour -> plum under indigo dusk, ribbed tile coping,
        # clean lounge café tables + potted palms, NO blown-out front sidewalk string bulbs
        wall = mat('wall', srgb('#663c6a'), rough=0.65)
        flat_block(0, 0, W, D, H, wall, '#aa5c62', '#6a3c60', par_h=0.75, par_w=0.48, seed=b['seed'])
        # Ribbed terracotta edge moulding along all 4 parapets (pops warm coral in golden hour!)
        tiles = tile_mat('tiles_club', '#c85838')
        for py, sx, sy in [(D / 2 - 0.25, W + 0.4, 0.8), (-D / 2 + 0.25, W + 0.4, 0.8)]:
            cube((0, py, H + 0.9), (sx, sy, 0.22), tiles, bevel=0.05)
        for px, sx, sy in [(W / 2 - 0.25, 0.8, D + 0.4), (-W / 2 + 0.25, 0.8, D + 0.4)]:
            cube((px, 0, H + 0.9), (sx, sy, 0.22), tiles, bevel=0.05)
        neon_sign(b.get('sign', 'NOVA'), 0, 0, H + 0.45, 4.1, plate=False, strength=14.0)
        for i in range(4):
            ac_unit(-W / 2 + 2.2 + i * 2.0, D / 2 - 2.0, H, metal, dark)
        # Organized café tables & potted corner palms
        for lx, ly in [(-W / 2 + 3.4, 0.0), (W / 2 - 3.6, 0.0), (-W / 2 + 4.8, -D / 2 + 3.2), (W / 2 - 4.8, D / 2 - 3.2)]:
            patio_set(lx, ly, H, wood, '#c9885c', table_r=0.8)
        for gx, gy in [(0.0, D / 2 - 2.0), (-0.8, -D / 2 + 2.2), (W / 2 - 2.4, -D / 2 + 2.5)]:
            garden_bed(gx, gy, 3.2, 2.0, H, rnd)
            palm_crown(gx, gy, H + 1.8, rnd, radius=1.9, fronds=9)
        # Three downward-washing storefront sign bars along the south curb overhang (drives wet reflection ribbons!)
        for sx, hex_c in [(-W * 0.24, '#ff48d8'), (0.0, '#ffbf58'), (W * 0.24, '#3fe0ff')]:
            ec = srgb(hex_c)
            bar_m = mat('marquee', ec, rough=0.3, emit=ec, night=6.0, day=0.2, noise=0)
            cube((sx, -D / 2 - 0.12, 3.4), (3.8, 0.28, 0.22), bar_m)
            point_light((sx, -D / 2 - 1.2, 3.6), 240, ec, radius=0.4)
        # Warm soft perimeter facade uplights (no white dot bulbs!)
        for sx in (-W * 0.32, W * 0.32):
            point_light((sx, D / 2 + 1.0, H * 0.7), 160, (1.0, 0.68, 0.28), radius=0.5)
        facade_windows(W, D, 1, rnd, lit=0.7, shop=True)
        feat_h = 2.6

    elif style == 'office':
        # Office block: rich slate cobalt roof membrane + crisp helipad + sunlit cedar courtyard garden w/ laundry,
        # café terrace w/ umbrellas, + glowing 3x3 saffron skylights & HVAC units
        wall = mat('wall', srgb('#6a769c'), rough=0.55)
        flat_block(0, 0, W, D, H, wall, '#38528a', '#98a6cc', par_h=0.9, par_w=0.45, seed=b['seed'])
        # Top-left (-W/4, +D/4): Crisp dark helipad
        heli = mat('helipad', srgb('#262e42'), rough=0.8, noise=0.05)
        cyl((-W / 4, D / 4, H + 0.12), 3.4, 0.1, heli, verts=40)
        h_ring = mat('hring', srgb('#d4dce8'), rough=0.6, noise=0)
        cyl((-W / 4, D / 4, H + 0.13), 3.15, 0.08, h_ring, verts=40)
        cyl((-W / 4, D / 4, H + 0.14), 2.9, 0.08, heli, verts=40)
        text_obj('H', (-W / 4, D / 4, H + 0.22), 3.2, mat('hpaint', srgb('#eef2f8'), rough=0.7, noise=0), extrude=0.01)

        # Top-right (+W/4, +D/4): Cedar courtyard terrace, greenery, clothesline & palm (seen in golden + dusk!)
        deck = mat('deck', srgb('#ab683a'), rough=0.7, noise=0.22, noise_scale=12)
        cube((W / 4, D / 4, H + 0.12), (W / 2 - 1.6, D / 2 - 1.8, 0.2), deck, bevel=0.04)
        # Terracotta hip shed over west strip of terrace
        tiles = tile_mat('tiles_off', '#c65634')
        hip_roof(-W * 0.06, D / 4, 4.2, D / 2 - 2.4, H + 1.4, 1.4, tiles, overhang=0.35)
        cube((-W * 0.06, D / 4, H + 0.7), (3.8, D / 2 - 2.6, 1.4), mat('wter', srgb('#e8c49c'), rough=0.7))
        garden_bed(W / 4, D / 2 - 1.6, W / 2 - 3.0, 2.0, H + 0.2, rnd, night_lit=True)
        garden_bed(W / 2 - 1.8, D / 4, 2.0, D / 2 - 3.6, H + 0.2, rnd)
        clothesline((W / 4 - 2.4, D / 4 + 1.0), (W / 4 + 2.8, D / 4 + 0.5), H + 1.45, rnd)
        clothesline((W / 4 - 2.2, D / 4 - 1.3), (W / 4 + 2.5, D / 4 - 1.6), H + 1.45, rnd)
        palm_crown(W / 2 - 2.3, D / 4 - 2.4, H + 2.2, rnd, radius=2.3, fronds=11)

        # Bottom-right (+W/4, -D/4): Cafe terrace paving + umbrellas + hot 3x3 saffron skylight grid + HVAC
        pave = mat('pave', srgb('#dcc6a6'), rough=0.75, noise=0.15, noise_scale=8)
        cube((W / 4, -D / 4, H + 0.1), (W / 2 - 1.4, D / 2 - 1.6, 0.16), pave, bevel=0.04)
        skylights(W / 4 + 0.5, -D / 4 + 1.4, W / 3.1, D / 3.4, H + 0.16, 3, 3, rnd, glow=1.35)
        cafe_umbrella(W / 4 + 2.4, -D / 4 - 2.6, H + 0.16, '#e89668', dark)
        cafe_umbrella(W / 4 - 2.2, -D / 4 - 2.2, H + 0.16, '#f4cf6a', dark)
        patio_set(W / 4 + 0.2, -D / 4 - 3.0, H + 0.16, wood, '#c28050', table_r=0.7)
        for i in range(2):
            ac_unit(W / 2 - 3.2 - i * 2.2, -D / 2 + 1.8, H + 0.16, metal, dark)

        # Bottom-left (-W/4, -D/4): Lit glass atrium + lush courtyard garden
        glassroof = mat('atrium', srgb('#465a84'), rough=0.16, spec=0.85, emit=(1.0, 0.72, 0.28), night=1.4, day=0.0, noise=0)
        cube((-W / 4, -D / 4, H + 0.8), (W / 2.8, D / 2.8, 1.5), wall)
        cube((-W / 4, -D / 4, H + 1.6), (W / 2.8 - 0.3, D / 2.8 - 0.3, 0.45), glassroof, taper=(0.45, 1.0))
        garden_bed(-W / 2 + 2.1, -D / 4, 2.0, D / 2 - 3.6, H, rnd, night_lit=True)
        facade_windows(W, D, floors, rnd, lit=0.85)
        feat_h = 4.5

    elif style == 'warehouse':
        # Garage building: signature emerald-teal & ultramarine cobalt striped awning roof + twin HVAC manifolds
        wall = mat('wall', srgb('#364c7c'), rough=0.65)
        flat_block(0, 0, W, D, H, wall, '#56648a', '#24a898', par_h=0.75, par_w=0.45, seed=b['seed'])
        m_teal = mat('str_teal', srgb('#169e86'), rough=0.6, noise=0.1, noise_scale=8)
        m_blue = mat('str_blue', srgb('#1e3d94'), rough=0.6, noise=0.1, noise_scale=8)
        stripe_n = int(W / 1.85)
        sw = W / stripe_n
        for i in range(stripe_n):
            sx = -W / 2 + (i + 0.5) * sw
            m_use = m_teal if i % 2 == 0 else m_blue
            # bold sloped awning stripes across front (north) edge and upper canopy
            cube((sx, 0, H + 0.25), (sw - 0.04, D - 1.1, 0.16), m_use, bevel=0.03)
        # Bold teal coping rail & east HVAC deck (matches bottom of golden & dusk targets!)
        t_deck = mat('tdeck', srgb('#cbb89e'), rough=0.75, noise=0.18, noise_scale=10)
        cube((W / 2 - 4.8, 0, H + 0.38), (8.2, D - 1.6, 0.12), t_deck, bevel=0.04)
        for dx_ in (-2.2, 1.8):
            ac_unit(W / 2 - 4.8 + dx_, -1.2, H + 0.44, metal, dark)
            ac_unit(W / 2 - 4.8 + dx_, 2.0, H + 0.44, metal, dark)
        cube((W / 2 - 4.8, 0.4, H + 0.85), (4.6, 0.32, 0.28), metal)
        cube((W / 2 - 4.8, 2.0, H + 0.85), (4.6, 0.32, 0.28), metal)
        facade_windows(W, D, 1, rnd, lit=0.6)
        feat_h = 2.0

    elif style == 'apartment':
        wall = mat('wall', srgb('#d47e56'), rough=0.7)
        flat_block(0, 0, W, D, H, wall, '#b66848', '#e6a878', par_h=0.9, par_w=0.45, seed=b['seed'])
        tiles = tile_mat('tiles_apt', '#c45032')
        hip_roof(-W / 4, 0, W / 2 - 0.8, D - 1.6, H + 0.2, 2.2, tiles, overhang=0.35)
        deck = mat('deck_apt', srgb('#a66236'), rough=0.75, noise=0.2, noise_scale=10)
        cube((W / 4, 0, H + 0.1), (W / 2 - 1.4, D - 2.0, 0.16), deck)
        garden_bed(W / 4, D / 2 - 2.0, W / 2 - 2.2, 2.0, H + 0.18, rnd, night_lit=True)
        garden_bed(W / 4, -D / 2 + 2.0, W / 2 - 2.2, 2.0, H + 0.18, rnd)
        clothesline((1.2, D / 4), (W / 2 - 1.6, D / 4 - 0.8), H + 1.5, rnd)
        clothesline((1.5, -D / 4 + 0.5), (W / 2 - 1.4, -D / 4 - 0.5), H + 1.5, rnd)
        palm_crown(W / 2 - 2.2, -2.0, H + 2.0, rnd, radius=2.1, fronds=10)
        facade_windows(W, D, floors, rnd, lit=0.75)
        feat_h = 3.2

    elif style == 'motel':
        wall = mat('wall', srgb('#44b8a8'), rough=0.68)
        flat_block(-W / 2 + 4.5, 0, 9.0, D, H, wall, '#e6b88a', '#f8e6c8', seed=b['seed'])
        flat_block(4.5, D / 2 - 4.0, W - 9.0, 8.0, H, wall, '#e6b88a', '#f8e6c8', seed=b['seed'] + 1)
        court = mat('court', srgb('#e4c898'), rough=0.8, noise=0.15, noise_scale=8)
        water = mat('pool', srgb('#26acc8'), rough=0.05, spec=1.0, emit=(0.3, 0.85, 1.0), night=0.8, day=0.0, noise=0.3, noise_scale=9)
        cube((4.5, -4.0, 0.06), (W - 9.4, D - 8.4, 0.1), court)
        cube((4.5, -4.5, 0.13), (W - 15, D - 15, 0.06), water, bevel=0.6)
        canopy = mat('canopy', srgb('#e86c5a'), rough=0.6, noise=0.08)
        cube((-W / 2 + 9.6, 0, 3.2), (1.6, D - 0.4, 0.12), canopy)
        cube((4.5, D / 2 - 8.6, 3.2), (W - 9.4, 1.6, 0.12), canopy)
        cafe_umbrella(W / 2 - 2.5, -2.0, 0.2, '#ffd166', dark)
        neon_sign(b.get('sign', 'MOTEL'), W / 2 - 5, -D / 2 + 1.2, 6.5, 1.6)
        cyl((W / 2 - 5, -D / 2 + 1.2, 3.2), 0.12, 6.4, dark)
        facade_windows(W, D, 1, rnd, lit=0.8)
        feat_h = 4.0
    return H + feat_h


def bake_buildings():
    reset()
    MANIFEST.setdefault('buildings', {})
    targets = ONLY or {'club', 'office', 'garage', 'apartments', 'motel'}
    for b in LAYOUT['buildings']:
        if b['id'] not in targets:
            continue
        t0 = time.time()
        top = build_slice_building(b)
        W, D = b['w'] / UPM, b['d'] / UPM
        m = 3.0
        set_pass('color')
        frame(0, 0, W + 2 * m, D + 2 * m, BLD_PPM)
        render(f'{TMP}/c.png')
        save_np(paint_finish(load_np(f'{TMP}/c.png'), kuw_r=3, stroke_r=3, stroke_s=0.34, line=0.74, inner=0.38),
                f'{OUT}/bld_{b["id"]}.webp')
        set_pass('shadow')
        scx, scy, sw, shh = shadow_frame_for(-W / 2 - 1, -D / 2 - 1, W / 2 + 1, D / 2 + 1, top)
        frame(scx, scy, sw, shh, BLD_SH_PPM)
        render(f'{TMP}/s.png')
        save_np(shadow_to_alpha(load_np(f'{TMP}/s.png')), f'{OUT}/bld_{b["id"]}_sh.webp')
        set_pass('night')
        nm = 9.0
        frame(0, 0, W + 2 * nm, D + 2 * nm, BLD_NIGHT_PPM)
        render(f'{TMP}/n.png')
        save_np(night_clean(load_np(f'{TMP}/n.png')), f'{OUT}/bld_{b["id"]}_night.webp')
        MANIFEST['buildings'][b['id']] = {
            'color': manifest_entry(f'bld_{b["id"]}.webp', 0, 0, W + 2 * m, D + 2 * m),
            'shadow': manifest_entry(f'bld_{b["id"]}_sh.webp', scx, scy, sw, shh),
            'night': manifest_entry(f'bld_{b["id"]}_night.webp', 0, 0, W + 2 * nm, D + 2 * nm),
        }
        save_manifest()
        clear_asset()
        print(f'building {b["id"]} baked in {time.time() - t0:.1f}s', flush=True)


# ============================================================================= PROPS (Palms + 4 Bush types)
def bake_static(name, half, top, ppm=BLD_PPM, kuw=3):
    hx, hy = half if isinstance(half, tuple) else (half, half)
    set_pass('color')
    frame(0, 0, hx * 2, hy * 2, ppm)
    render(f'{TMP}/c.png')
    save_np(paint_finish(load_np(f'{TMP}/c.png'), kuw_r=kuw, stroke_r=3, stroke_s=0.32, line=0.76, inner=0.38),
            f'{OUT}/{name}.webp')
    entry = {'color': manifest_entry(f'{name}.webp', 0, 0, hx * 2, hy * 2)}
    set_pass('shadow')
    scx, scy, sw, shh = shadow_frame_for(-hx, -hy, hx, hy, top)
    frame(scx, scy, sw, shh, BLD_SH_PPM)
    render(f'{TMP}/s.png')
    save_np(shadow_to_alpha(load_np(f'{TMP}/s.png')), f'{OUT}/{name}_sh.webp')
    entry['shadow'] = manifest_entry(f'{name}_sh.webp', scx, scy, sw, shh)
    return entry


def bake_props():
    reset()
    P = MANIFEST.setdefault('props', {})
    want = lambda n: not ONLY or n in ONLY
    for i, (hgt, seed) in enumerate([(8.5, 101), (10.0, 202), (7.0, 303)]):
        if not want(f'palm{i}'):
            continue
        rnd = random.Random(seed)
        palm_tree(0, 0, rnd, height=hgt, lean_m=0.6, radius=3.1)
        P[f'palm{i}'] = bake_static(f'palm{i}', 4.6, hgt + 0.8, kuw=3)
        save_manifest(); clear_asset()
    bush_specs = [
        (1.1, '#2b6e2c', '#5fa63e', '#ff6494', 6),
        (1.6, '#1f5e40', '#4a9652', '#ffd44c', 8),
        (0.85, '#64922c', '#a8c84a', '#ffffff', 5),
        (1.3, '#386074', '#6aa29e', '#f48ee0', 7),
    ]
    for i, (r, col, col2, fcol, n) in enumerate(bush_specs):
        if not want(f'bush{i}'):
            continue
        rnd = random.Random(400 + i)
        a = mat('bA', srgb(col), rough=0.8, noise=0.32, noise_scale=10)
        b = mat('bB', srgb(col2), rough=0.8, noise=0.32, noise_scale=10)
        fl = mat('bF', srgb(fcol), rough=0.65, noise=0)
        for k in range(n):
            ang = rnd.uniform(0, 6.28); d = rnd.uniform(0, r * 0.62)
            sphere((math.cos(ang) * d, math.sin(ang) * d, r * 0.5), rnd.uniform(r * 0.45, r * 0.82), a if k % 2 else b, scale=(1, 1, 0.75), segs=12)
        for k in range(8 if i != 3 else 4):
            ang = rnd.uniform(0, 6.28); d = rnd.uniform(0, r * 0.82)
            sphere((math.cos(ang) * d, math.sin(ang) * d, r * 1.05), 0.16, fl, segs=6)
        P[f'bush{i}'] = bake_static(f'bush{i}', r * 1.6, r * 1.3, kuw=3)
        save_manifest(); clear_asset()
    print('palms + 4 bush types baked.', flush=True)


def bake_ground():
    raw = '/tmp/palm_ground_slice_raw.png'
    assert os.path.exists(raw), f'Run gen_ground_slice.mjs first ({raw} missing)'
    arr = load_np(raw)
    arr = oriented_stroke_pass(arr, rad=4, strength=0.30, sat_boost=1.10)
    save_np(arr, f'{OUT}/ground_slice.webp')
    MANIFEST['groundSlice'] = {'file': 'ground_slice.webp', 'x': 680, 'y': 710, 'w': 860, 'h': 990}
    save_manifest()
    print(f'ground_slice.webp baked ({arr.shape[1]}x{arr.shape[0]}).', flush=True)


if GROUP in ('buildings', 'all'):
    bake_buildings()
if GROUP in ('ground', 'all'):
    bake_ground()
if GROUP in ('cars', 'all'):
    bake_cars()
if GROUP in ('peds', 'all'):
    bake_peds()
if GROUP in ('props', 'all'):
    bake_props()

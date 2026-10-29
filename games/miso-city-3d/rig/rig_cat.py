#!/usr/bin/env python3
"""
rig_cat.py -- deterministic free rigging for a quadruped (cat) mesh.

Builds a fitted armature for an UNRIGGED mesh, skins it with distance-based
weights (numpy, top-4 influences), authors a procedural trot WALK cycle
(diagonal leg pairs, body bob, head counter-bob, tail sway), exports a
rigged + animated GLB, and renders proof stills.

Usage:
  blender --background --factory-startup --python rig_cat.py -- \
      INPUT.glb OUTPUT.glb STILLS_DIR [facing]
  facing: auto | +x | -x | +y | -y   (default auto: detect from an existing
          skeleton's Head/Tail bones if the source file has one, else the
          longer horizontal axis, + direction)

Run with Blender 4.2 (~/workspace/tools/blender-4.2.3-linux-x64/blender).
"""
import sys, os, json, math
import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, STILLS = argv[0], argv[1], argv[2]
FACING = argv[3] if len(argv) > 3 else "auto"
os.makedirs(STILLS, exist_ok=True)
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(SRC)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=SRC)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=SRC)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=SRC)
else:
    raise SystemExit(f"unsupported input {SRC}")

# Detect facing from a source skeleton before deleting it.
fwd_hint = None
for ob in bpy.data.objects:
    if ob.type == "ARMATURE":
        heads = [b.head_local for b in ob.data.bones
                 if b.name.lower().startswith(("head", "neck"))]
        tails = [b.head_local for b in ob.data.bones
                 if b.name.lower().startswith("tail")]
        if heads and tails:
            h = sum((v for v in heads), Vector()) / len(heads)
            t = sum((v for v in tails), Vector()) / len(tails)
            d = (ob.matrix_world @ h) - (ob.matrix_world @ t)
            d.z = 0.0
            if d.length > 1e-6:
                fwd_hint = d.normalized()

# Keep only meshes; drop imported armatures / empties / cameras / lights.
# Preserve each mesh's WORLD transform first: source files often carry
# their real scale on a parent node (e.g. x100 on an armature), and
# deleting the parent without this step silently shrinks the mesh.
meshes = []
for ob in list(bpy.data.objects):
    if ob.type == "MESH":
        mw_copy = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = mw_copy
        meshes.append(ob)
    else:
        bpy.data.objects.remove(ob, do_unlink=True)
if not meshes:
    raise SystemExit("no mesh in input")
# Drop stray debris meshes (export leftovers like a unit test sphere):
# anything under 10% of the largest mesh's vertex count goes.
if len(meshes) > 1:
    biggest = max(len(m.data.vertices) for m in meshes)
    keep = []
    for m in meshes:
        if len(m.data.vertices) >= 0.1 * biggest:
            keep.append(m)
        else:
            print(f"dropping stray mesh {m.name} "
                  f"({len(m.data.vertices)} verts vs {biggest})")
            bpy.data.objects.remove(m, do_unlink=True)
    meshes = keep

bpy.ops.object.select_all(action="DESELECT")
for m in meshes:
    m.select_set(True)
    m.vertex_groups.clear()
    for mod in list(m.modifiers):
        if mod.type == "ARMATURE":
            m.modifiers.remove(mod)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------------------------------------------------------------- frame
def read_verts():
    v = np.empty(len(mesh.data.vertices) * 3, dtype=np.float64)
    mesh.data.vertices.foreach_get("co", v)
    return v.reshape(-1, 3)

verts = read_verts()
# Normalise scale: source files arrive at arbitrary units (this test cat
# is 2.16 m long). Scale the mesh data so the horizontal footprint's
# longest side is 0.55 m -- a sane game-unit cat.
_h = verts.max(axis=0) - verts.min(axis=0)
_k = 0.55 / max(_h[0], _h[1])
if abs(_k - 1.0) > 0.01:
    from mathutils import Matrix
    mesh.data.transform(Matrix.Scale(_k, 4))
    mesh.data.update()
    verts = read_verts()
mn, mx = verts.min(axis=0), verts.max(axis=0)
size = mx - mn
ctr = (mn + mx) / 2.0

if FACING != "auto":
    sgn = -1.0 if FACING.startswith("-") else 1.0
    ax = 0 if FACING[1] == "x" else 1
    F = np.zeros(3); F[ax] = sgn
elif fwd_hint is not None:
    F = np.array([fwd_hint.x, fwd_hint.y, 0.0]); F /= np.linalg.norm(F)
else:
    ax = 0 if size[0] >= size[1] else 1
    F = np.zeros(3); F[ax] = 1.0
S = np.array([-F[1], F[0], 0.0])          # side (cat's left when F is fwd)
U = np.array([0.0, 0.0, 1.0])

fpos = verts @ F                            # coordinate along forward axis
spos = verts @ S
zpos = verts[:, 2]
fmin, fmax = fpos.min(), fpos.max()
flen = fmax - fmin
ground = mn[2]
# Body top excluding the tail: use the 92nd percentile of z for robustness.
body_top = np.percentile(zpos, 92)
height = body_top - ground

def P(f_frac, side_off, z):
    """World point: f_frac along length (0=rear,1=front), side offset in
    metres along S, absolute z."""
    f = fmin + f_frac * flen
    base = F * f + S * side_off
    return Vector((base[0], base[1], z))

# Landmarks (fractions tuned for a generic quadruped silhouette).
spine_z = ground + 0.80 * height
belly_z = ground + 0.52 * height
shoulder_f, hip_f = 0.78, 0.24
body_half_w = 0.5 * (spos.max() - spos.min()) * 0.36

bones = []  # (name, head, tail, parent)
zone = {}   # name -> (kind, f_frac, side) for skinning region masks
def B(name, head, tail, parent=None):
    bones.append((name, head, tail, parent))

B("root",     P(hip_f, 0, spine_z),        P(shoulder_f, 0, spine_z))
B("spine",    P(shoulder_f, 0, spine_z),   P(0.88, 0, spine_z + 0.02 * height), "root")
B("neck",     P(0.88, 0, spine_z + 0.02 * height), P(0.95, 0, spine_z + 0.10 * height), "spine")
B("head",     P(0.95, 0, spine_z + 0.10 * height), P(1.03, 0, spine_z + 0.13 * height), "neck")
B("tail.01",  P(hip_f - 0.02, 0, spine_z), P(hip_f - 0.16, 0, spine_z + 0.30 * height), "root")
B("tail.02",  P(hip_f - 0.16, 0, spine_z + 0.30 * height),
              P(hip_f - 0.20, 0, spine_z + 0.58 * height), "tail.01")

leg_defs = [  # (suffix, f_frac, side_sign)
    ("FL", shoulder_f, +1), ("FR", shoulder_f, -1),
    ("HL", hip_f, +1),      ("HR", hip_f, -1),
]
zone.update({"root": ("all", 0, 0), "spine": ("front", 0.55, 0),
             "neck": ("front", 0.78, 0), "head": ("front", 0.86, 0),
             "tail.01": ("rear", 0.34, 0), "tail.02": ("rear", 0.34, 0)})
for sfx, ff, sd in leg_defs:
    for part in ("upperleg", "lowerleg", "foot"):
        zone[f"{part}.{sfx}"] = ("leg", ff, sd)
    hip = P(ff, sd * body_half_w, belly_z + 0.06 * height)
    knee = P(ff + (0.035 if sfx.startswith("H") else -0.03),
             sd * body_half_w * 1.05, ground + 0.30 * height)
    ankle = P(ff + (-0.01 if sfx.startswith("H") else 0.0),
              sd * body_half_w * 1.05, ground + 0.10 * height)
    toe = ankle + Vector(F * 0.10 * flen) + Vector((0, 0, -0.085 * height))
    parent = "root"
    B(f"upperleg.{sfx}", hip, knee, parent)
    B(f"lowerleg.{sfx}", knee, ankle, f"upperleg.{sfx}")
    B(f"foot.{sfx}", ankle, toe, f"lowerleg.{sfx}")

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("CatRig")
arm = bpy.data.objects.new("CatRig", arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
side_v = Vector(S)
for name, head, tail, parent in bones:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = head, tail
    eb.align_roll(side_v)          # local Z ~= side axis -> euler Z = swing
    if parent:
        eb.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- skinning
# Distance-based weights: w = (1/(d + 0.15*avg_len))^6, top-4, normalised.
seg_a = np.array([[b[1].x, b[1].y, b[1].z] for b in bones])
seg_b = np.array([[b[2].x, b[2].y, b[2].z] for b in bones])
ab = seg_b - seg_a
ab_len2 = np.einsum("ij,ij->i", ab, ab)
avg_len = float(np.sqrt(ab_len2).mean())
n = len(verts)
W = np.zeros((n, len(bones)), dtype=np.float64)
CH = 20000
for i in range(0, n, CH):
    v = verts[i:i + CH]
    ap = v[:, None, :] - seg_a[None, :, :]
    t = np.einsum("vbi,bi->vb", ap, ab) / np.maximum(ab_len2[None, :], 1e-12)
    t = np.clip(t, 0.0, 1.0)
    closest = seg_a[None, :, :] + t[:, :, None] * ab[None, :, :]
    d = np.linalg.norm(v[:, None, :] - closest, axis=2)
    W[i:i + CH] = 1.0 / np.power(d + 0.18 * avg_len, 4)
# Region masks: keep each bone from claiming verts outside its anatomy
# (otherwise the muzzle, sitting right above the front legs, gets dragged
# around by the leg swing -- observed in the first test render).
f_frac = (fpos - fmin) / flen
for j, (name, *_r) in enumerate(bones):
    kind, ff, sd = zone[name]
    if kind == "leg":
        lo, hi = (ff - 0.20, ff + 0.10) if ff > 0.5 else (ff - 0.10, ff + 0.20)
        ok = (f_frac >= lo) & (f_frac <= hi) & (f_frac < 0.84) \
             & (spos * sd >= -0.03)
    elif kind == "front":
        ok = f_frac >= ff - 0.04
    elif kind == "rear":
        ok = f_frac <= ff
    else:
        ok = np.ones(n, dtype=bool)
    W[~ok, j] = 0.0
top = np.argsort(-W, axis=1)[:, :4]
Wtop = np.take_along_axis(W, top, axis=1)
Wtop /= Wtop.sum(axis=1, keepdims=True)
_mz = int(np.argmax(fpos))  # muzzle vertex: sanity-print its influences
print("muzzle influences:",
      [(bones[top[_mz][k]][0], round(float(Wtop[_mz][k]), 2)) for k in range(3)])

for j, (name, *_rest) in enumerate(bones):
    vg = mesh.vertex_groups.new(name=name)
    sel = top == j
    rows, cols = np.where(sel)
    wts = Wtop[rows, cols]
    for vi, wv in zip(rows.tolist(), wts.tolist()):
        vg.add([vi], float(wv), "REPLACE")
mod = mesh.modifiers.new("CatRig", "ARMATURE")
mod.object = arm
mesh.parent = arm

# ---------------------------------------------------------------- walk cycle
FPS = 24
CYCLE = 24                      # frames per loop
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, CYCLE
arm.animation_data_create()
act = bpy.data.actions.new("Walk")
arm.animation_data.action = act

phases = {"FL": 0.0, "HR": 0.0, "FR": 0.5, "HL": 0.5}   # diagonal pairs
AMP_U = math.radians(24)        # upper-leg swing
bob_amp = 0.022 * height

def key_rot(bone_name, frame, z=0.0, x=0.0):
    pb = arm.pose.bones[bone_name]
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = (x, 0.0, z)
    pb.keyframe_insert("rotation_euler", frame=frame)

def key_loc(bone_name, frame, zoff):
    pb = arm.pose.bones[bone_name]
    pb.location = (0.0, 0.0, zoff)
    pb.keyframe_insert("location", frame=frame)

for f in range(1, CYCLE + 2):
    t = (f - 1) / CYCLE         # 0..1
    w = 2 * math.pi * t
    for sfx, ph in phases.items():
        s = math.sin(w + 2 * math.pi * ph)
        c = math.cos(w + 2 * math.pi * ph)
        key_rot(f"upperleg.{sfx}", f, z=AMP_U * s)
        lift = max(0.0, -c)     # fold lower leg while it swings forward
        key_rot(f"lowerleg.{sfx}", f, z=-math.radians(30) * lift)
        key_rot(f"foot.{sfx}", f, z=-(AMP_U * s) * 0.55
                + math.radians(20) * lift)
    key_loc("root", f, bob_amp * math.sin(2 * w))
    key_rot("root", f, z=math.radians(2.2) * math.sin(w))
    key_rot("head", f, z=math.radians(3.5) * math.sin(2 * w + 0.6))
    key_rot("neck", f, z=math.radians(2.5) * math.sin(2 * w + 0.3))
    key_rot("tail.01", f, x=math.radians(9) * math.sin(w - 0.7))
    key_rot("tail.02", f, x=math.radians(13) * math.sin(w - 1.2))
for fc in act.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = "BEZIER"

# ---------------------------------------------------------------- export
# Purge any animations that came in with the source file: they target a
# skeleton that no longer exists and would pollute the export.
for other in list(bpy.data.actions):
    if other != act:
        bpy.data.actions.remove(other)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
kw = dict(filepath=DST, export_format="GLB", export_animations=True,
          export_skins=True, export_all_influences=False,
          export_frame_range=False)
try:
    bpy.ops.export_scene.gltf(export_animation_mode="ACTIONS", **kw)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)

# ---------------------------------------------------------------- stills
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.25, 0.25, 0.28, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
center = Vector(ctr) + Vector((0, 0, 0.1 * height))
dist = 2.4 * max(size)
off = (F * 0.85 + S * 1.0 + U * 0.42)
off = off / np.linalg.norm(off) * dist
cam.location = center + Vector(off)
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()

# Cycles CPU: the only engine that renders on this GPU-less VM
# (Workbench/EEVEE need libEGL, which this sandbox cannot provide).
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = False
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55

# Ground disc so the legs read against something (added AFTER the GLB
# export above, so it never pollutes the deliverable).
bpy.ops.mesh.primitive_circle_add(radius=float(dist), fill_type="NGON",
                                  location=(ctr[0], ctr[1], ground + 0.001))
disc = bpy.context.view_layer.objects.active
gmat = bpy.data.materials.new("Ground")
gmat.diffuse_color = (0.16, 0.16, 0.18, 1)
disc.data.materials.append(gmat)

scene.render.resolution_x, scene.render.resolution_y = 640, 480
scene.render.image_settings.file_format = "PNG"

for label, fr in (("phase0", 1), ("phase25", 7), ("phase50", 13)):
    scene.frame_set(fr)
    scene.render.filepath = os.path.join(STILLS, f"walk_{label}.png")
    bpy.ops.render.render(write_still=True)

print("RIG_RESULT " + json.dumps({
    "bones": len(bones), "verts": int(n),
    "bbox_size": [round(float(x), 3) for x in size],
    "forward": [round(float(x), 3) for x in F],
    "facing_source": "provided" if FACING != "auto" else
                     ("skeleton" if fwd_hint is not None else "bbox"),
    "output": DST,
}))

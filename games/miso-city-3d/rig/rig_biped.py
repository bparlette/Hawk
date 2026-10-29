#!/usr/bin/env python3
"""
rig_biped.py -- deterministic free rigging for a BIPED (chibi cat) mesh.

Sibling of rig_cat.py (same machinery, same CLI shape), but the skeleton,
landmarks, region masks and animation are for an upright two-legged
character with arms -- Miso's actual body plan. rig_cat.py's quadruped rig
cannot pose him; Meshy's auto-rig only offers "Quadruped Dog" for animals.

Builds a fitted 20-bone armature for an UNRIGGED mesh, skins it with
distance-based weights (numpy, top-4 influences) constrained by anatomical
region masks, authors a procedural BIPED walk cycle (alternating strides,
knee fold on swing, opposite arm swing, body bob + forward lean, head
counter-bob, tail sway), exports a rigged + animated GLB, and renders
proof stills (Workbench).

Usage:
  blender --background --factory-startup --python rig_biped.py -- \
      INPUT.glb OUTPUT.glb STILLS_DIR [facing]
  facing: auto | +x | -x | +y | -y   (default auto: skeleton hint if the
          source has one, else forward = the SHORTER horizontal axis --
          a standing biped is wider than deep -- with the sign from the
          feet: at ground level the toes protrude further forward than
          the heels protrude back; tail-band vertex counts break ties.
          Generated meshes vary, so check the proof stills and re-run
          with an explicit facing if he moonwalks.)

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
# Drop stray debris meshes (export leftovers) -- but ONLY meshes that are
# small in BOTH vertex count AND spatial extent. rig_cat.py's verts-only
# rule would amputate a multi-part character: a 24-vert foot box or a
# 96-vert limb cylinder is real anatomy next to a 1,488-vert head sphere.
# A genuine stray speck fails both tests; a body part fails at most one.
if len(meshes) > 1:
    biggest = max(len(m.data.vertices) for m in meshes)

    def world_diag(m):
        cs = np.array([[c.x, c.y, c.z] for c in
                       (m.matrix_world @ Vector(corner)
                        for corner in m.bound_box)])
        return float(np.linalg.norm(cs.max(axis=0) - cs.min(axis=0)))

    all_cs = np.concatenate([
        np.array([[c.x, c.y, c.z] for c in
                  (m.matrix_world @ Vector(corner)
                   for corner in m.bound_box)]) for m in meshes])
    total_diag = float(np.linalg.norm(all_cs.max(axis=0)
                                      - all_cs.min(axis=0)))
    keep = []
    for m in meshes:
        if len(m.data.vertices) < 0.1 * biggest \
                and world_diag(m) < 0.10 * total_diag:
            print(f"dropping stray mesh {m.name} "
                  f"({len(m.data.vertices)} verts vs {biggest}, "
                  f"diag {world_diag(m):.3f} vs {total_diag:.3f})")
            bpy.data.objects.remove(m, do_unlink=True)
        else:
            keep.append(m)
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
# Normalise scale: a biped is sized by HEIGHT. Scale so the standing
# height (z extent) is exactly 1.0 m -- a sane game-unit character.
_h = verts.max(axis=0) - verts.min(axis=0)
_k = 1.0 / _h[2]
if abs(_k - 1.0) > 0.01:
    from mathutils import Matrix
    mesh.data.transform(Matrix.Scale(_k, 4))
    mesh.data.update()
    verts = read_verts()
mn, mx = verts.min(axis=0), verts.max(axis=0)
size = mx - mn
ctr = (mn + mx) / 2.0
ground = mn[2]
H = size[2]                      # == 1.0 after normalisation
zfr_all = (verts[:, 2] - ground) / H

facing_source = "provided"
if FACING != "auto":
    sgn = -1.0 if FACING.startswith("-") else 1.0
    ax = 0 if FACING[1] == "x" else 1
    F = np.zeros(3); F[ax] = sgn
elif fwd_hint is not None:
    F = np.array([fwd_hint.x, fwd_hint.y, 0.0]); F /= np.linalg.norm(F)
    facing_source = "skeleton"
else:
    # Biped auto-detect: forward axis = SHORTER horizontal extent (a
    # standing character is wider across the shoulders than deep).
    ax = 0 if size[0] <= size[1] else 1
    d = np.zeros(3); d[ax] = 1.0
    rel = verts @ d
    rel = rel - (rel.max() + rel.min()) / 2.0
    # Sign cue 1 -- the feet: at ground level, toes protrude further
    # forward than heels protrude back.
    gb = zfr_all <= 0.12
    ep, en = rel[gb].max(), -rel[gb].min()
    if abs(ep - en) > 0.25 * max(ep, en):
        sgn = 1.0 if ep > en else -1.0
        facing_source = "feet"
    else:
        # Sign cue 2 -- the tail: at hip height, the rear side strings
        # more vertices out past half the body's depth (the tail) than
        # the front does.
        tb = (zfr_all >= 0.35) & (zfr_all <= 0.75)
        rt = rel[tb]
        epos, eneg = rt.max(), -rt.min()
        cpos = int((rt > 0.5 * epos).sum()) if epos > 1e-9 else 0
        cneg = int((rt < -0.5 * eneg).sum()) if eneg > 1e-9 else 0
        sgn = -1.0 if cneg > cpos else 1.0   # forward = away from tail
        facing_source = "tail" if cneg != cpos else "bbox-default"
    F = np.zeros(3); F[ax] = sgn
S = np.array([-F[1], F[0], 0.0])          # side (character's left)
U = np.array([0.0, 0.0, 1.0])

fpos = verts @ F                            # coordinate along forward axis
spos = verts @ S
zpos = verts[:, 2]
ctr_f = (fpos.max() + fpos.min()) / 2.0
ctr_s = (spos.max() + spos.min()) / 2.0
frel = fpos - ctr_f
srel = spos - ctr_s
halfW = (spos.max() - spos.min()) / 2.0     # half width (incl. arms/head)
halfD = (fpos.max() - fpos.min()) / 2.0     # half depth (incl. tail)
zfr = zfr_all

def P(f_off, s_off, z_frac):
    """World point from offsets (metres along F / S from bbox centre)
    and a height fraction of H above ground."""
    base = F * (ctr_f + f_off) + S * (ctr_s + s_off)
    return Vector((base[0], base[1], ground + z_frac * H))

# Landmarks (fractions tuned for a chibi biped: head = top ~32%).
leg_off = 0.30 * halfW
sh_off = 0.52 * halfW
el_off = 0.72 * halfW
ha_off = 0.80 * halfW

bones = []  # (name, head, tail, parent)
zone = {}   # name -> (kind, side_sign) for skinning region masks
def B(name, head, tail, parent, kind, sd=0):
    bones.append((name, head, tail, parent))
    zone[name] = (kind, sd)

B("root",  P(0, 0, 0.44), P(0, 0, 0.50), None, "root")
B("hips",  P(0, 0, 0.50), P(0, 0, 0.56), "root", "hips")
B("spine", P(0, 0, 0.56), P(0, 0, 0.66), "hips", "spine")
B("chest", P(0, 0, 0.66), P(0, 0, 0.76), "spine", "chest")
B("neck",  P(0, 0, 0.76), P(0, 0, 0.82), "chest", "neck")
B("head",  P(0.01 * H, 0, 0.82), P(0.02 * H, 0, 1.02), "neck", "head")
B("tail.01", P(-0.40 * halfD, 0, 0.54), P(-0.72 * halfD, 0, 0.63),
  "hips", "tail")
B("tail.02", P(-0.72 * halfD, 0, 0.63), P(-0.98 * halfD, 0, 0.78),
  "tail.01", "tail")
for sfx, sd in (("L", +1), ("R", -1)):
    B(f"thigh.{sfx}", P(0, sd * leg_off, 0.52),
      P(0.03 * H, sd * leg_off * 1.05, 0.28), "hips", "thigh", sd)
    B(f"shin.{sfx}", P(0.03 * H, sd * leg_off * 1.05, 0.28),
      P(0.01 * H, sd * leg_off * 1.08, 0.075), f"thigh.{sfx}", "shin", sd)
    B(f"foot.{sfx}", P(0.01 * H, sd * leg_off * 1.08, 0.075),
      P(0.085 * H, sd * leg_off * 1.08, 0.02), f"shin.{sfx}", "foot", sd)
    B(f"upperarm.{sfx}", P(0, sd * sh_off, 0.72),
      P(-0.005 * H, sd * el_off, 0.57), "chest", "uarm", sd)
    B(f"forearm.{sfx}", P(-0.005 * H, sd * el_off, 0.57),
      P(0, sd * ha_off, 0.44), f"upperarm.{sfx}", "farm", sd)
    B(f"hand.{sfx}", P(0, sd * ha_off, 0.44),
      P(0.01 * H, sd * ha_off * 1.02, 0.37), f"forearm.{sfx}", "hand", sd)

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("BipedRig")
arm = bpy.data.objects.new("BipedRig", arm_data)
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
# Distance-based weights (same recipe as rig_cat): w = 1/(d + eps)^4,
# top-4 influences, normalised.
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
# Region masks: keep each bone inside its anatomy. The chibi lesson from
# rig_cat applies twice over here -- the oversized head sits directly
# beside the shoulders, so arm bones are capped BELOW the head zone and
# pushed outboard, or the arm swing drags the cheeks around.
for j, (name, *_r) in enumerate(bones):
    kind, sd = zone[name]
    if kind == "head":
        ok = zfr >= 0.68
    elif kind == "neck":
        ok = (zfr >= 0.70) & (np.abs(srel) <= 0.50 * halfW)
    elif kind == "chest":
        ok = (zfr >= 0.58) & (zfr <= 0.84) & (np.abs(srel) <= 0.85 * halfW)
    elif kind == "spine":
        ok = (zfr >= 0.46) & (zfr <= 0.74) & (np.abs(srel) <= 0.80 * halfW)
    elif kind == "hips":
        ok = (zfr <= 0.64) & (np.abs(srel) <= 0.90 * halfW)
    elif kind == "root":
        ok = zfr <= 0.60
    elif kind == "tail":
        ok = (frel <= -0.28 * halfD) & (zfr >= 0.28) & (zfr <= 0.88)
    elif kind == "thigh":
        ok = (zfr >= 0.22) & (zfr <= 0.60) & (srel * sd >= 0.02 * halfW)
    elif kind == "shin":
        ok = (zfr >= 0.02) & (zfr <= 0.38) & (srel * sd >= 0.02 * halfW)
    elif kind == "foot":
        ok = (zfr <= 0.15) & (srel * sd >= 0.0)
    elif kind == "uarm":
        ok = (zfr >= 0.48) & (zfr <= 0.72) & (srel * sd >= 0.35 * halfW)
    elif kind == "farm":
        ok = (zfr >= 0.32) & (zfr <= 0.64) & (srel * sd >= 0.07 * halfW)
    elif kind == "hand":
        ok = (zfr <= 0.48) & (srel * sd >= 0.07 * halfW)
    else:
        ok = np.ones(n, dtype=bool)
    W[~ok, j] = 0.0
top = np.argsort(-W, axis=1)[:, :4]
Wtop = np.take_along_axis(W, top, axis=1)
Wtop /= Wtop.sum(axis=1, keepdims=True)

def influences(vi, label):
    print(f"{label} influences:",
          [(bones[top[vi][k]][0], round(float(Wtop[vi][k]), 2))
           for k in range(3)])
influences(int(np.argmax(zpos)), "head-top vertex")
_hand_zone = np.where(zfr < 0.50, srel, -1e9)
influences(int(np.argmax(_hand_zone)), "hand-zone vertex")
_foot_zone = np.where(zfr < 0.10, srel, -1e9)
influences(int(np.argmax(_foot_zone)), "foot-zone vertex")

for j, (name, *_rest) in enumerate(bones):
    vg = mesh.vertex_groups.new(name=name)
    sel = top == j
    rows, cols = np.where(sel)
    wts = Wtop[rows, cols]
    for vi, wv in zip(rows.tolist(), wts.tolist()):
        vg.add([vi], float(wv), "REPLACE")
mod = mesh.modifiers.new("BipedRig", "ARMATURE")
mod.object = arm
mesh.parent = arm

# ---------------------------------------------------------------- walk cycle
# Biped gait, 24-frame loop. Legs use rig_cat's PROVEN phase formulas for
# downward bones (swing about local Z; knee fold peaks as the leg swings
# forward through centre, lifting the foot). Arms swing opposite to the
# same-side leg; elbows flex forward (opposite sign to knees).
FPS = 24
CYCLE = 24
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, CYCLE
arm.animation_data_create()
act = bpy.data.actions.new("Walk")
arm.animation_data.action = act

AMP_T = math.radians(26)        # thigh swing
AMP_A = math.radians(18)        # upper-arm swing
bob_amp = 0.018 * H

def key_rot(bone_name, frame, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone_name]
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = (x, y, z)
    pb.keyframe_insert("rotation_euler", frame=frame)

def key_loc(bone_name, frame, yoff):
    pb = arm.pose.bones[bone_name]
    pb.location = (0.0, yoff, 0.0)   # root bone points up: local Y = world up
    pb.keyframe_insert("location", frame=frame)

for f in range(1, CYCLE + 2):
    t = (f - 1) / CYCLE
    w = 2 * math.pi * t
    for sfx, ph in (("L", 0.0), ("R", 0.5)):
        s = math.sin(w + 2 * math.pi * ph)
        c = math.cos(w + 2 * math.pi * ph)
        lift = max(0.0, -c)     # knee fold while leg swings forward
        key_rot(f"thigh.{sfx}", f, z=AMP_T * s)
        key_rot(f"shin.{sfx}", f, z=-math.radians(38) * lift)
        key_rot(f"foot.{sfx}", f, z=-(AMP_T * s) * 0.5
                + math.radians(16) * lift)
        # arm: opposite phase to the same-side leg; elbow flexes forward
        key_rot(f"upperarm.{sfx}", f, z=-AMP_A * s)
        key_rot(f"forearm.{sfx}", f, z=math.radians(12)
                + math.radians(10) * max(0.0, -s))
        key_rot(f"hand.{sfx}", f, z=math.radians(6) * (-s))
    key_loc("root", f, bob_amp * math.sin(2 * w))
    key_rot("root", f, y=math.radians(4) * math.sin(w))       # hip twist
    key_rot("spine", f, z=math.radians(3) + math.radians(1) * math.sin(2 * w))
    key_rot("chest", f, y=-math.radians(3.5) * math.sin(w),   # counter-twist
            z=math.radians(4) + math.radians(1.5) * math.sin(2 * w + 0.3))
    key_rot("neck", f, z=-math.radians(3)
            + math.radians(2) * math.sin(2 * w + 0.5))
    key_rot("head", f, y=-math.radians(2.5) * math.sin(w),
            z=-math.radians(3.5) + math.radians(2.5) * math.sin(2 * w + 0.8))
    key_rot("tail.01", f, x=math.radians(8) * math.sin(w - 0.7))
    key_rot("tail.02", f, x=math.radians(12) * math.sin(w - 1.2))
for fc in act.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = "BEZIER"

# ---------------------------------------------------------------- export
# Purge any animations that came in with the source file.
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
center = Vector((ctr[0], ctr[1], ground + 0.5 * H))
dist = 2.6 * max(size)
off = (F * 0.85 + S * 1.0 + U * 0.30)
off = off / np.linalg.norm(off) * dist
cam.location = center + Vector(off)
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()

# Workbench: verified working on this VM (libegl1 landed 2026-10-28)
# and much faster than Cycles CPU.
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.background_type = "WORLD"

# Ground disc so the feet read against something (added AFTER the GLB
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
    "facing_source": facing_source,
    "output": DST,
}))

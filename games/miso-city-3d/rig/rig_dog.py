#!/usr/bin/env python3
"""
rig_dog.py -- rig the procedural enemy dogs (make_dogs.py output) on
the SAME 20-bone biped skeleton as rig_biped.py, so one animation
vocabulary drives Miso and every dog.

Differences from rig_biped.py:
  * height normalises to a per-dog TARGET (Dane 1.35, Beagle 0.72,
    Bulldog 1.15 game units; Miso is 1.0) instead of always 1.0;
  * bone landmarks and skinning region masks come from a per-dog
    PROFILE (fractions of height / of bbox half-width) -- a fat
    beagle's joints do not live at a chibi cat's fractions;
  * FOUR actions are authored procedurally: Walk (the proven gait),
    Attack (crouch -> lunge + both-paw swipe), Hit (flinch back),
    Down (fall backward, settle, hold).

Usage:
  blender --background --factory-startup --python rig_dog.py -- \
      INPUT.glb OUTPUT.glb STILLS_DIR PROFILE TARGET
  PROFILE: dane | beagle | bulldog      TARGET: final height in units
"""
import sys, os, json, math
import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST, STILLS, PROFILE = argv[0], argv[1], argv[2], argv[3]
TARGET = float(argv[4])
os.makedirs(STILLS, exist_ok=True)
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)

# ---------------------------------------------------------------- profiles
# Bone-joint heights as fractions of total height; offsets as fractions
# of bbox half-width; mask ranges as (z_lo, z_hi) height fractions.
PROFILES = {
    "dane": dict(
        hip=0.54, knee=0.30, ankle=0.075, toe_z=0.03, toe_f=0.075,
        chain=(0.46, 0.52, 0.58, 0.68, 0.78, 0.86, 1.05),
        sh_z=0.71, el_z=0.565, wr_z=0.435, ha_z=0.375,
        leg_off=0.34, sh_off=0.62, el_off=0.76, ha_off=0.85,
        tail=(0.55, 0.64, 0.79),
        head_m=0.70, neck_m=0.72,
        chest_m=(0.60, 0.86), spine_m=(0.48, 0.76), hips_m=0.66,
        uarm_m=(0.50, 0.75), farm_m=(0.34, 0.66), hand_m=0.50,
        thigh_m=(0.24, 0.62), shin_m=(0.02, 0.40), foot_m=0.16),
    "beagle": dict(
        hip=0.46, knee=0.26, ankle=0.08, toe_z=0.03, toe_f=0.070,
        chain=(0.40, 0.46, 0.53, 0.62, 0.71, 0.77, 1.00),
        sh_z=0.665, el_z=0.585, wr_z=0.515, ha_z=0.470,
        leg_off=0.54, sh_off=0.63, el_off=0.76, ha_off=0.83,
        tail=(0.46, 0.55, 0.68),
        head_m=0.60, neck_m=0.64,
        chest_m=(0.52, 0.80), spine_m=(0.40, 0.68), hips_m=0.58,
        uarm_m=(0.52, 0.72), farm_m=(0.42, 0.64), hand_m=0.56,
        thigh_m=(0.18, 0.54), shin_m=(0.02, 0.34), foot_m=0.14),
    "bulldog": dict(
        hip=0.50, knee=0.28, ankle=0.085, toe_z=0.03, toe_f=0.080,
        chain=(0.44, 0.50, 0.56, 0.65, 0.74, 0.81, 1.03),
        sh_z=0.685, el_z=0.545, wr_z=0.425, ha_z=0.360,
        leg_off=0.40, sh_off=0.71, el_off=0.83, ha_off=0.87,
        tail=(0.52, 0.60, 0.72),
        head_m=0.64, neck_m=0.68,
        chest_m=(0.56, 0.82), spine_m=(0.44, 0.72), hips_m=0.62,
        uarm_m=(0.46, 0.72), farm_m=(0.32, 0.60), hand_m=0.46,
        thigh_m=(0.20, 0.58), shin_m=(0.02, 0.36), foot_m=0.15),
}
PR = PROFILES[PROFILE]

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

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
# Normalise scale so the standing height is exactly TARGET units.
_h = verts.max(axis=0) - verts.min(axis=0)
_k = TARGET / _h[2]
if abs(_k - 1.0) > 0.001:
    from mathutils import Matrix
    mesh.data.transform(Matrix.Scale(_k, 4))
    mesh.data.update()
    verts = read_verts()
mn, mx = verts.min(axis=0), verts.max(axis=0)
size = mx - mn
ctr = (mn + mx) / 2.0
ground = mn[2]
H = size[2]                      # == TARGET after normalisation

# Builders face +X by construction.
F = np.array([1.0, 0.0, 0.0])
S = np.array([0.0, 1.0, 0.0])    # character's left
U = np.array([0.0, 0.0, 1.0])

fpos = verts @ F
spos = verts @ S
zpos = verts[:, 2]
ctr_f = (fpos.max() + fpos.min()) / 2.0
ctr_s = (spos.max() + spos.min()) / 2.0
frel = fpos - ctr_f
srel = spos - ctr_s
halfW = (spos.max() - spos.min()) / 2.0
halfD = (fpos.max() - fpos.min()) / 2.0
zfr = (zpos - ground) / H

def P(f_off, s_off, z_frac):
    base = F * (ctr_f + f_off) + S * (ctr_s + s_off)
    return Vector((base[0], base[1], ground + z_frac * H))

# Landmarks from the profile.
leg_off = PR["leg_off"] * halfW
sh_off = PR["sh_off"] * halfW
el_off = PR["el_off"] * halfW
ha_off = PR["ha_off"] * halfW
c0, c1, c2, c3, c4, c5, c6 = PR["chain"]   # root a/b, hips, spine, chest, neck/head, head tip

bones = []
zone = {}
def B(name, head, tail, parent, kind, sd=0):
    bones.append((name, head, tail, parent))
    zone[name] = (kind, sd)

B("root",  P(0, 0, c0), P(0, 0, c1), None, "root")
B("hips",  P(0, 0, c1), P(0, 0, c2), "root", "hips")
B("spine", P(0, 0, c2), P(0, 0, c3), "hips", "spine")
B("chest", P(0, 0, c3), P(0, 0, c4), "spine", "chest")
B("neck",  P(0, 0, c4), P(0, 0, c5), "chest", "neck")
B("head",  P(0.01 * H, 0, c5), P(0.02 * H, 0, c6), "neck", "head")
t0, t1, t2 = PR["tail"]
B("tail.01", P(-0.40 * halfD, 0, t0), P(-0.72 * halfD, 0, t1), "hips", "tail")
B("tail.02", P(-0.72 * halfD, 0, t1), P(-0.98 * halfD, 0, t2), "tail.01", "tail")
for sfx, sd in (("L", +1), ("R", -1)):
    B(f"thigh.{sfx}", P(0, sd * leg_off, PR["hip"]),
      P(0.03 * H, sd * leg_off * 1.05, PR["knee"]), "hips", "thigh", sd)
    B(f"shin.{sfx}", P(0.03 * H, sd * leg_off * 1.05, PR["knee"]),
      P(0.01 * H, sd * leg_off * 1.08, PR["ankle"]), f"thigh.{sfx}", "shin", sd)
    B(f"foot.{sfx}", P(0.01 * H, sd * leg_off * 1.08, PR["ankle"]),
      P(PR["toe_f"] * H, sd * leg_off * 1.08, PR["toe_z"]), f"shin.{sfx}",
      "foot", sd)
    B(f"upperarm.{sfx}", P(0, sd * sh_off, PR["sh_z"]),
      P(-0.005 * H, sd * el_off, PR["el_z"]), "chest", "uarm", sd)
    B(f"forearm.{sfx}", P(-0.005 * H, sd * el_off, PR["el_z"]),
      P(0, sd * ha_off, PR["wr_z"]), f"upperarm.{sfx}", "farm", sd)
    B(f"hand.{sfx}", P(0, sd * ha_off, PR["wr_z"]),
      P(0.01 * H, sd * ha_off * 1.02, PR["ha_z"]), f"forearm.{sfx}", "hand", sd)

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("DogRig")
arm = bpy.data.objects.new("DogRig", arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
side_v = Vector(S)
for name, head, tail, parent in bones:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = head, tail
    eb.align_roll(side_v)
    if parent:
        eb.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- skinning
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

for j, (name, *_r) in enumerate(bones):
    kind, sd = zone[name]
    if kind == "head":
        ok = zfr >= PR["head_m"]
    elif kind == "neck":
        ok = (zfr >= PR["neck_m"]) & (np.abs(srel) <= 0.50 * halfW)
    elif kind == "chest":
        lo, hi = PR["chest_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (np.abs(srel) <= 0.85 * halfW)
    elif kind == "spine":
        lo, hi = PR["spine_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (np.abs(srel) <= 0.80 * halfW)
    elif kind == "hips":
        ok = (zfr <= PR["hips_m"]) & (np.abs(srel) <= 0.90 * halfW)
    elif kind == "root":
        ok = zfr <= PR["hips_m"] - 0.04
    elif kind == "tail":
        ok = (frel <= -0.28 * halfD) & (zfr >= 0.28) & (zfr <= 0.88)
    elif kind == "thigh":
        lo, hi = PR["thigh_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (srel * sd >= 0.02 * halfW)
    elif kind == "shin":
        lo, hi = PR["shin_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (srel * sd >= 0.02 * halfW)
    elif kind == "foot":
        ok = (zfr <= PR["foot_m"]) & (srel * sd >= 0.0)
    elif kind == "uarm":
        lo, hi = PR["uarm_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (srel * sd >= 0.35 * halfW)
    elif kind == "farm":
        lo, hi = PR["farm_m"]
        ok = (zfr >= lo) & (zfr <= hi) & (srel * sd >= 0.07 * halfW)
    elif kind == "hand":
        ok = (zfr <= PR["hand_m"]) & (srel * sd >= 0.07 * halfW)
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
_hand_zone = np.where(zfr < PR["hand_m"] + 0.05, srel, -1e9)
influences(int(np.argmax(_hand_zone)), "hand-zone vertex")

for j, (name, *_rest) in enumerate(bones):
    vg = mesh.vertex_groups.new(name=name)
    sel = top == j
    rows, cols = np.where(sel)
    wts = Wtop[rows, cols]
    for vi, wv in zip(rows.tolist(), wts.tolist()):
        vg.add([vi], float(wv), "REPLACE")
mod = mesh.modifiers.new("DogRig", "ARMATURE")
mod.object = arm
mesh.parent = arm

# ---------------------------------------------------------------- actions
FPS = 24
scene = bpy.context.scene
scene.render.fps = FPS
arm.animation_data_create()

def key_rot(bone_name, frame, x=0.0, y=0.0, z=0.0):
    pb = arm.pose.bones[bone_name]
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = (x, y, z)
    pb.keyframe_insert("rotation_euler", frame=frame)

# Root-bone pose location is expressed in the bone's rest orientation;
# convert world-space offsets so lunges/drops read correctly.
_RB_INV = arm.data.bones["root"].matrix_local.to_3x3().inverted()
def key_loc_world(bone_name, frame, world_off):
    pb = arm.pose.bones[bone_name]
    pb.location = _RB_INV @ Vector(world_off) if bone_name == "root" \
        else Vector(world_off)
    pb.keyframe_insert("location", frame=frame)

def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)

def new_action(name):
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    reset_pose()
    return act

def _fcurves(act):
    # Blender <=4.x: act.fcurves; 5.x layered actions: layers/strips/channelbags
    if hasattr(act, "fcurves"):
        return act.fcurves
    return [fc for l in act.layers for st in l.strips
            for cb in st.channelbags for fc in cb.fcurves]

def bezier(act):
    for fc in _fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"

RAD = math.radians

# ---- Walk: rig_biped's proven gait, 24-frame loop -------------------
act_walk = new_action("Walk")
scene.frame_start, scene.frame_end = 1, 24
AMP_T, AMP_A = RAD(26), RAD(18)
bob_amp = 0.018 * H

def key_loc_root_y(frame, yoff):
    pb = arm.pose.bones["root"]
    pb.location = (0.0, yoff, 0.0)   # root bone points up: local Y = up
    pb.keyframe_insert("location", frame=frame)

for f in range(1, 26):
    t = (f - 1) / 24
    w = 2 * math.pi * t
    for sfx, ph in (("L", 0.0), ("R", 0.5)):
        s = math.sin(w + 2 * math.pi * ph)
        c = math.cos(w + 2 * math.pi * ph)
        lift = max(0.0, -c)
        key_rot(f"thigh.{sfx}", f, z=AMP_T * s)
        key_rot(f"shin.{sfx}", f, z=-RAD(38) * lift)
        key_rot(f"foot.{sfx}", f, z=-(AMP_T * s) * 0.5 + RAD(16) * lift)
        key_rot(f"upperarm.{sfx}", f, z=-AMP_A * s)
        key_rot(f"forearm.{sfx}", f, z=RAD(12) + RAD(10) * max(0.0, -s))
        key_rot(f"hand.{sfx}", f, z=RAD(6) * (-s))
    key_loc_root_y(f, bob_amp * math.sin(2 * w))
    key_rot("root", f, y=RAD(4) * math.sin(w))
    key_rot("spine", f, z=RAD(3) + RAD(1) * math.sin(2 * w))
    key_rot("chest", f, y=-RAD(3.5) * math.sin(w),
            z=RAD(4) + RAD(1.5) * math.sin(2 * w + 0.3))
    key_rot("neck", f, z=-RAD(3) + RAD(2) * math.sin(2 * w + 0.5))
    key_rot("head", f, y=-RAD(2.5) * math.sin(w),
            z=-RAD(3.5) + RAD(2.5) * math.sin(2 * w + 0.8))
    key_rot("tail.01", f, x=RAD(8) * math.sin(w - 0.7))
    key_rot("tail.02", f, x=RAD(12) * math.sin(w - 1.2))
bezier(act_walk)

# ---- Attack: coil back, snap-lunge forward, head bites down (12 fr) --
# 1 neutral -> 3 coil (weight back, head cocked up, paws drawn in)
# -> 5 STRIKE (body shoots forward, head + neck thrust down-forward
# into the bite, front paw reaches) -> 7 hold/chomp shake -> 10 -> 12.
act_atk = new_action("Attack")
scene.frame_start, scene.frame_end = 1, 12
_ALL = ("spine", "chest", "neck", "head")
def atk_pose(f, root, spine, chest, neck, head, uarm, farm, hand,
             thL, thR, shL, shR, tail1, tail2):
    key_loc_world("root", f, root)
    key_rot("spine", f, z=RAD(spine)); key_rot("chest", f, z=RAD(chest))
    key_rot("neck", f, z=RAD(neck)); key_rot("head", f, z=RAD(head))
    for sfx, ua, th, sh in (("L", uarm, thL, shL), ("R", uarm * 0.8, thR, shR)):
        key_rot(f"upperarm.{sfx}", f, z=RAD(ua))
        key_rot(f"forearm.{sfx}", f, z=RAD(farm))
        key_rot(f"hand.{sfx}", f, z=RAD(hand))
        key_rot(f"thigh.{sfx}", f, z=RAD(th))
        key_rot(f"shin.{sfx}", f, z=RAD(sh))
    key_rot("tail.01", f, x=RAD(tail1)); key_rot("tail.02", f, x=RAD(tail2))
atk_pose(1,  (0, 0, 0),                  0,  0,  0,   0,   0,  8,  0,   0,   0,  0,  0,   0,  0)
atk_pose(3,  (-0.06*H, 0, -0.03*H),     -9, -8, -10, -14,  30, 34, -8,  10, -14, -12, 16,  -8, -10)
atk_pose(5,  (0.17*H, 0, -0.03*H),      14, 10,  4,  -6, -70, 8,  -10, 30, -20, -10, 22,  14, 18)
atk_pose(7,  (0.15*H, 0, -0.035*H),     16, 12,  8,   2, -72, 10, -8,  28, -18, -10, 20,  16, 20)
atk_pose(10, (0.05*H, 0, -0.01*H),      6,  4,  3,   2,  -28, 12, 0,   10, -6,  -4,  6,   6,  8)
atk_pose(12, (0, 0, 0),                  0,  0,  0,   0,   0,  8,  0,   0,   0,  0,  0,   0,  0)
bezier(act_atk)

# ---- Hit: flinch backward, head snap (7 fr, ~0.25 s) -----------------
act_hit = new_action("Hit")
scene.frame_start, scene.frame_end = 1, 7
key_loc_world("root", 1, (0, 0, 0))
key_rot("spine", 1, z=0.0); key_rot("chest", 1, z=0.0); key_rot("head", 1, z=0.0)
for sfx in ("L", "R"):
    key_rot(f"upperarm.{sfx}", 1, z=0.0)
    key_rot(f"forearm.{sfx}", 1, z=RAD(8))
key_loc_world("root", 3, (-0.035 * H, 0, 0.012 * H))
key_rot("spine", 3, z=-RAD(10)); key_rot("chest", 3, z=-RAD(12))
key_rot("neck", 3, z=-RAD(6)); key_rot("head", 3, z=-RAD(15))
for sfx in ("L", "R"):
    key_rot(f"upperarm.{sfx}", 3, z=-RAD(26))
    key_rot(f"forearm.{sfx}", 3, z=RAD(32))
    key_rot(f"hand.{sfx}", 3, z=-RAD(8))
key_rot("tail.01", 3, x=-RAD(8))
key_loc_world("root", 5, (-0.015 * H, 0, 0.005 * H))
key_rot("spine", 5, z=-RAD(5)); key_rot("chest", 5, z=-RAD(6))
key_rot("head", 5, z=-RAD(7))
for sfx in ("L", "R"):
    key_rot(f"upperarm.{sfx}", 5, z=-RAD(12))
    key_rot(f"forearm.{sfx}", 5, z=RAD(18))
key_loc_world("root", 7, (0, 0, 0))
key_rot("spine", 7, z=0.0); key_rot("chest", 7, z=0.0); key_rot("head", 7, z=0.0)
for sfx in ("L", "R"):
    key_rot(f"upperarm.{sfx}", 7, z=0.0)
    key_rot(f"forearm.{sfx}", 7, z=RAD(8))
bezier(act_hit)

# ---- Down: fall backward and stay (15 fr, ~0.6 s, held end) ----------
act_down = new_action("Down")
scene.frame_start, scene.frame_end = 1, 15
key_loc_world("root", 1, (0, 0, 0))
key_rot("root", 1, z=0.0)
key_rot("spine", 1, z=0.0); key_rot("chest", 1, z=0.0); key_rot("head", 1, z=0.0)
for sfx in ("L", "R"):
    key_rot(f"thigh.{sfx}", 1, z=0.0)
    key_rot(f"upperarm.{sfx}", 1, z=0.0)
# tipping
key_rot("root", 5, z=-RAD(32))
key_loc_world("root", 5, (-0.02 * H, 0, -0.08 * H))
key_rot("spine", 5, z=-RAD(6)); key_rot("head", 5, z=-RAD(10))
for sfx in ("L", "R"):
    key_rot(f"thigh.{sfx}", 5, z=RAD(14))
    key_rot(f"upperarm.{sfx}", 5, z=-RAD(20))
# falling
key_rot("root", 9, z=-RAD(68))
key_loc_world("root", 9, (-0.04 * H, 0, -0.20 * H))
key_rot("spine", 9, z=RAD(6)); key_rot("chest", 9, z=RAD(5))
key_rot("head", 9, z=RAD(10))
for sfx in ("L", "R"):
    key_rot(f"thigh.{sfx}", 9, z=RAD(30))
    key_rot(f"shin.{sfx}", 9, z=-RAD(18))
    key_rot(f"upperarm.{sfx}", 9, z=-RAD(42))
    key_rot(f"forearm.{sfx}", 9, z=RAD(20))
key_rot("tail.01", 9, x=RAD(16)); key_rot("tail.02", 9, x=RAD(20))
# landed, held (identical keys at 13 and 15)
for f in (13, 15):
    key_rot("root", f, z=-RAD(84))
    key_loc_world("root", f, (-0.05 * H, 0, -0.29 * H))
    key_rot("spine", f, z=RAD(10)); key_rot("chest", f, z=RAD(8))
    key_rot("neck", f, z=RAD(6)); key_rot("head", f, z=RAD(14))
    for sfx in ("L", "R"):
        key_rot(f"thigh.{sfx}", f, z=RAD(36))
        key_rot(f"shin.{sfx}", f, z=-RAD(24))
        key_rot(f"foot.{sfx}", f, z=RAD(12))
        key_rot(f"upperarm.{sfx}", f, z=-RAD(48))
        key_rot(f"forearm.{sfx}", f, z=RAD(24))
        key_rot(f"hand.{sfx}", f, z=RAD(10))
    key_rot("tail.01", f, x=RAD(18)); key_rot("tail.02", f, x=RAD(22))
bezier(act_down)

# Auto-ground Down: the -84-degree root pitch swings the lowest body
# point below the floor (measured -0.32 units on the Dane). Evaluate
# the skinned mesh at the held end frame, then lift the root location
# keys by the residual (ramped 0 / 0.3 / 0.7 / 1.0 across the fall) so
# the settled pose rests exactly on the ground plane.
arm.animation_data.action = act_down
scene.frame_set(15)
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
_ev = mesh.evaluated_get(_dg)
_em = _ev.to_mesh()
_resid = ground - min((mesh.matrix_world @ v.co).z for v in _em.vertices)
_ev.to_mesh_clear()
print(f"Down end residual before grounding: {_resid:+.3f}")
if abs(_resid) > 0.005:
    _lift_local = _RB_INV @ Vector((0, 0, _resid))
    for fc in _fcurves(act_down):
        if fc.data_path == 'pose.bones["root"].location':
            for kp in fc.keyframe_points:
                wgt = {1: 0.0, 5: 0.3, 9: 0.7}.get(int(kp.co.x), 1.0)
                kp.co.y += _lift_local[fc.array_index] * wgt
                kp.handle_left.y += _lift_local[fc.array_index] * wgt
                kp.handle_right.y += _lift_local[fc.array_index] * wgt
    scene.frame_set(15)
    bpy.context.view_layer.update()
    _ev = mesh.evaluated_get(_dg)
    _em = _ev.to_mesh()
    _resid2 = ground - min((mesh.matrix_world @ v.co).z for v in _em.vertices)
    _ev.to_mesh_clear()
    print(f"Down end residual after grounding: {_resid2:+.3f}")

# ---------------------------------------------------------------- export
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
# NOTE: no Workbench proof stills here -- libEGL is absent on this VM
# and the Workbench render aborts the process (found 2026-10-29, after
# a successful export). Proof stills are rendered separately with
# Cycles by render_actions.py from the exported GLB.

print("RIG_RESULT " + json.dumps({
    "profile": PROFILE, "bones": len(bones), "verts": int(n),
    "height": round(float(H), 3),
    "bbox_size": [round(float(x), 3) for x in size],
    "actions": [a.name for a in bpy.data.actions],
    "output": DST,
}))

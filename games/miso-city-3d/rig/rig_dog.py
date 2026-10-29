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
  * SEVEN actions are authored procedurally: Walk (the proven gait),
    Attack (the jaw-rig bite: coil -> burst -> clamp -> shake -> toss),
    Swipe, JumpKick, Uppercut, Hit (flinch back), Down (fall
    backward, settle, hold). A 21st bone (jaw) is weighted to the
    separate JawMesh part from make_dogs.py. Fcurve access goes
    through _fcurves() so the script runs on Blender <=4.x and on
    5.x layered actions.

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
        thigh_m=(0.18, 0.54), shin_m=(0.02, 0.34), foot_m=0.14,
        # Beagle-only Attack tuning: at full pitch stack the muzzle
        # dives INTO the belly and the belly skinning creases (seen in
        # the review frames), so his spine/chest/neck/head pitches are
        # scaled down; the lunge read comes from root travel + stance.
        atk_pitch=0.65, atk_pitch_rear=1.0, jaw_scale=1.3, bite_yaw=-20),
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
# JawMesh (kept separate by make_dogs.py): capture its world-space
# verts BEFORE the join so the exact jaw vertices can be weighted to
# the new jaw bone after every transform is baked.
_jaw_src = []
for ob in meshes:
    if ob.name.startswith("JawMesh"):
        for v in ob.data.vertices:
            _jaw_src.append(tuple(ob.matrix_world @ v.co))
jaw_pts = np.array(_jaw_src) if _jaw_src else np.zeros((0, 3))
print("jaw source verts:", len(jaw_pts))
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

# ---- jaw vertex mask: exact position match against the JawMesh part
is_jaw = np.zeros(len(verts), dtype=bool)
if len(jaw_pts):
    _jp = jaw_pts * (_k if abs(_k - 1.0) > 0.001 else 1.0)
    for i in range(0, len(verts), 4000):
        _d = np.linalg.norm(verts[i:i + 4000, None, :] - _jp[None, :, :],
                            axis=2)
        is_jaw[i:i + 4000] = _d.min(axis=1) < 0.0025
    print(f"jaw verts matched: {int(is_jaw.sum())} / {len(_jp)}")

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
# jaw (21st bone, added 2026-10-29): hinge near the jaw part's
# top-back, tip at its front-centre -- measured from the matched jaw
# verts when available. Pose sign (probed): jaw euler +z = chin drops.
if is_jaw.any():
    _jv = verts[is_jaw]
    _jmn, _jmx = _jv.min(axis=0), _jv.max(axis=0)
    # Hinge placement v2 (2026-10-29): the original measured hinge
    # sat at the jaw part's TOP-BACK corner -- i.e. ON the mouth
    # seam. Rotating around it swung the chin underside but left the
    # seam itself shut (measured: 58 deg keyed = only ~0.08 world
    # drop at the jaw front, no visible gape). A jaw joint belongs
    # BEHIND the jaw part at its vertical centre, inside the skull:
    # hinge there and the whole mouth line gapes along its length
    # (front drop becomes lever x sin(angle), lever ~= full jaw
    # length + the setback).
    _hinge = Vector((_jmn[0] - 0.30 * (_jmx[0] - _jmn[0]),
                     (_jmn[1] + _jmx[1]) / 2.0,
                     (_jmn[2] + _jmx[2]) / 2.0))
    _tip = Vector((_jmx[0] + 0.015 * H, (_jmn[1] + _jmx[1]) / 2.0,
                   (_jmn[2] + _jmx[2]) / 2.0))
else:
    _hinge = P(0.03 * H, 0, PR.get("jaw_z", 0.80))
    _tip = P(0.16 * H, 0, PR.get("jaw_z", 0.80) - 0.03)
B("jaw", _hinge, _tip, "head", "jaw")
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
    if kind == "jaw":
        ok = is_jaw
    elif kind == "head":
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
# the jaw bone must DOMINATE its own vertices -- distance alone
# leaves the head bone competitive near the hinge. Other bones keep
# a small share so the jaw blends at its edges instead of tearing.
_jaw_j = [j for j, (nm, *_r) in enumerate(bones) if nm == "jaw"][0]
W[is_jaw, _jaw_j] *= 8.0
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

# ---- Attack: coil -> explosive lunge -> bite snap -> hold -> recover
# (12 fr, 0.50 s -- same length as the original clip; the game times
# its telegraph/strike states around ~0.5 s.)
# RE-AUTHORED 2026-10-29: the original clip was a vertical bow/chop --
# measured on the exported GLB, the paws swept BACKWARD past the body
# (upperarm z +52 swings a down-pointing limb bone backward) while the
# torso pitched and the body sank ~3 cm through the floor (clip review,
# review/REVIEW.md). Sign conventions on this rig, verified by
# evaluating the old GLB frame by frame: spine/chest/neck/head +z
# pitches the part FORWARD; on the down-pointing limb bones (upperarm,
# forearm, thigh, shin) +z swings the limb BACKWARD, -z FORWARD.
# Shape of the new clip: f1 neutral -> f4 coil (root back+down, chest
# recoils, head stays aimed, paws tucked back, knees bent) -> f6
# launch -> f7 full extension (root +0.17H forward, paws reach past
# the snout line, lead leg planted forward, trail leg extended in
# push-off) -> f8 jaw snap (head pitches +18 deg in one frame) ->
# f9 brief hold -> f10/f12 recover to the exact f1 stance.
act_atk = new_action("Attack")
scene.frame_start, scene.frame_end = 1, 12

_AP = PR.get("atk_pitch", 1.0)   # per-profile Attack pitch scale
def atk_pose(f, root_off, spine, chest, neck, head,
             uarm, farm, hand, legL, legR, tailx=(0, 0)):
    key_loc_world("root", f, root_off)
    key_rot("spine", f, z=RAD(spine * _AP))
    key_rot("chest", f, z=RAD(chest * _AP))
    key_rot("neck", f, z=RAD(neck * _AP))
    key_rot("head", f, z=RAD(head * _AP))
    key_rot("tail.01", f, x=RAD(tailx[0])); key_rot("tail.02", f, x=RAD(tailx[1]))
    for sfx in ("L", "R"):
        key_rot(f"upperarm.{sfx}", f, z=RAD(uarm))
        key_rot(f"forearm.{sfx}", f, z=RAD(farm))
        key_rot(f"hand.{sfx}", f, z=RAD(hand))
    for sfx, (th, sh, ft) in (("L", legL), ("R", legR)):
        key_rot(f"thigh.{sfx}", f, z=RAD(th))
        key_rot(f"shin.{sfx}", f, z=RAD(sh))
        key_rot(f"foot.{sfx}", f, z=RAD(ft))

# leg tuples are (thigh, shin, foot) in degrees; -z = forward swing.
atk_pose(1, (0, 0, 0), 0, 0, 0, 0,
         0, 8, 0, (0, 0, 0), (0, 0, 0))
# coil / anticipation (frame 4): root pulls back and down, torso
# recoils, neck+head counter-pitch so the snout stays on target,
# paws tuck back, knees bend (thigh forward + shin back = flexion).
atk_pose(4, (-0.035 * H, 0, -0.030 * H), -7, -6, 10, 6,
         30, 30, 6, (-18, 24, -6), (14, 12, 6), tailx=(6, 8))
# launch (frame 6): root drives forward, limbs unfold toward target.
atk_pose(6, (0.10 * H, 0, -0.014 * H), 6, 8, 10, 4,
         -38, 4, -4, (-30, 8, -2), (26, 4, 12), tailx=(10, 14))
# full extension (frame 7): head thrust at target height, paws reach
# forward, lead leg planted ahead, trail leg straight behind (drive,
# not a kick: knee extended, low line).
atk_pose(7, (0.17 * H, 0, -0.008 * H), 11, 13, 14, 8,
         -58, -4, -8, (-38, 10, 0), (34, 2, 16), tailx=(12, 16))
# bite snap (frame 8): head pitches down hard in a single frame.
atk_pose(8, (0.175 * H, 0, -0.010 * H), 12, 14, 16, 26,
         -60, -6, -8, (-38, 10, 0), (34, 2, 16), tailx=(12, 16))
# hold (frame 9): snap released, extension kept.
atk_pose(9, (0.16 * H, 0, -0.006 * H), 10, 11, 12, 12,
         -52, 0, -6, (-32, 10, 0), (28, 4, 12), tailx=(10, 14))
# recover (frames 10, 12 -> neutral)
atk_pose(10, (0.09 * H, 0, -0.002 * H), 5, 6, 6, 4,
         -26, 6, 0, (-18, 14, -2), (14, 8, 4), tailx=(6, 8))
atk_pose(12, (0, 0, 0), 0, 0, 0, 0,
         0, 8, 0, (0, 0, 0), (0, 0, 0))
bezier(act_atk)
# Crisp snap: the head's f7->f8->f9 segments are linear, not bezier.
for fc in _fcurves(act_atk):
    if 'pose.bones["head"]' in fc.data_path:
        for kp in fc.keyframe_points:
            if int(kp.co.x) in (7, 8):
                kp.interpolation = "LINEAR"

# Auto-ground Attack (same idea as Down's pass, but per-frame): the
# coil drops the root and the pitches swing body mass low; evaluate
# the skinned mesh at EVERY frame and lift the root location keys so
# no frame penetrates the floor. Root location keys are densified to
# all 12 frames with their evaluated values plus the lift, so the
# authored root path is preserved, only raised where it dug in.
arm.animation_data.action = act_atk
_dg = bpy.context.evaluated_depsgraph_get()
_loc_fcs = [fc for fc in _fcurves(act_atk)
            if fc.data_path == 'pose.bones["root"].location']
def _atk_minz(f):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    _ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    _em = _ev.to_mesh()
    _mz = min((mesh.matrix_world @ v.co).z for v in _em.vertices)
    _ev.to_mesh_clear()
    return _mz - ground
_atk_before = {f: _atk_minz(f) for f in range(1, 13)}
print("Attack ground offsets BEFORE grounding:",
      {f: round(v, 4) for f, v in _atk_before.items()})
if min(_atk_before.values()) < -0.001:
    _pb_root = arm.pose.bones["root"]
    for f in range(1, 13):
        _cur = Vector([fc.evaluate(f) for fc in
                       sorted(_loc_fcs, key=lambda c: c.array_index)])
        _lift = max(0.0, -_atk_before[f])
        _pb_root.location = _cur + _RB_INV @ Vector((0, 0, _lift))
        _pb_root.keyframe_insert("location", frame=f)
    _atk_after = {f: _atk_minz(f) for f in range(1, 13)}
    print("Attack ground offsets AFTER grounding:",
          {f: round(v, 4) for f, v in _atk_after.items()})

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

# ================================================================ ATTACK SET v2
# 2026-10-29 overhaul. The single lunge authored above as "Attack"
# was rejected in play ("looks horrible, like a very slight nod or
# headbutt -- all attacks are exaggerated"). It is REMOVED here and
# replaced by a dramatic move set on the jaw-equipped rig:
#   Attack   = BITE: lunge in with the mouth opening WIDE, clamp,
#              then a multi-swing head SHAKE while holding, toss out.
#   Swipe    = two-hit paw combination with torso unwind + overshoot.
#   JumpKick = crouch, leap, airborne hind-leg kick at the apex.
#   Uppercut = deep crouch, rising paw that launches the target.
# Pose signs (probed on this rig, jaw_probe.py + the old clip's
# measurements): spine/chest/neck/head +z = pitch forward/down;
# head +y = yaw (snout swings sideways); jaw +z = chin drops (OPEN);
# limb bones -z = forward swing, +z = back swing.
bpy.data.actions.remove(act_atk)

def KP(f, root=(0, 0, 0), spine=0, chest=0, chestY=0, neck=0, head=0,
       headY=0, jaw=0, armL=(0, 0, 8, 0), armR=(0, 0, 8, 0),
       legL=(0, 0, 0), legR=(0, 0, 0), tail=(0, 0)):
    """One full-body keyframe. Angles in degrees; arms are
    (x-rot, upperarm z, forearm z, hand z); root is (fwd, side, up)
    in H units. Torso pitches are scaled by the profile's _AP for
    forward pitch; REARWARD pitch uses _PS_REAR (defaults to _AP;
    the Bite sets it from atk_pitch_rear -- rearward pitch lifts the
    muzzle AWAY from the belly, so the beagle can rear fully even
    though his forward pitch is capped). Jaw keys are multiplied by
    _JS (the Bite sets it from the profile's jaw_scale)."""
    def _ps(v):
        return v * _AP if v >= 0 else v * _PS_REAR
    key_loc_world("root", f, (root[0] * H, root[1] * H, root[2] * H))
    key_rot("spine", f, z=RAD(_ps(spine)))
    key_rot("chest", f, y=RAD(chestY), z=RAD(_ps(chest)))
    key_rot("neck", f, z=RAD(_ps(neck)))
    key_rot("head", f, y=RAD(headY), z=RAD(_ps(head)))
    key_rot("jaw", f, z=RAD(jaw * _JS))
    key_rot("tail.01", f, x=RAD(tail[0]))
    key_rot("tail.02", f, x=RAD(tail[1]))
    for sfx, (ax, uz, fz, hz) in (("L", armL), ("R", armR)):
        key_rot(f"upperarm.{sfx}", f, x=RAD(ax), z=RAD(uz))
        key_rot(f"forearm.{sfx}", f, z=RAD(fz))
        key_rot(f"hand.{sfx}", f, z=RAD(hz))
    for sfx, (th, sh, ft) in (("L", legL), ("R", legR)):
        key_rot(f"thigh.{sfx}", f, z=RAD(th))
        key_rot(f"shin.{sfx}", f, z=RAD(sh))
        key_rot(f"foot.{sfx}", f, z=RAD(ft))

def set_linear(act, bone, frames):
    for fc in _fcurves(act):
        if f'pose.bones["{bone}"]' in fc.data_path:
            for kp in fc.keyframe_points:
                if int(kp.co.x) in frames:
                    kp.interpolation = "LINEAR"

def autoground(act, n_frames, label):
    """Lift-only per-frame ground pass (the Down/Attack pattern):
    raises root keys so no frame penetrates; airborne frames of a
    jump are positive-offset and stay untouched."""
    arm.animation_data.action = act
    loc_fcs = [fc for fc in _fcurves(act)
               if fc.data_path == 'pose.bones["root"].location']
    def minz(f):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        em = ev.to_mesh()
        mz = min((mesh.matrix_world @ v.co).z for v in em.vertices)
        ev.to_mesh_clear()
        return mz - ground
    before = {f: minz(f) for f in range(1, n_frames + 1)}
    if min(before.values()) < -0.001:
        pb = arm.pose.bones["root"]
        for f in range(1, n_frames + 1):
            cur = Vector([fc.evaluate(f) for fc in
                          sorted(loc_fcs, key=lambda c: c.array_index)])
            pb.location = cur + _RB_INV @ Vector(
                (0, 0, max(0.0, -before[f])))
            pb.keyframe_insert("location", frame=f)
    after = {f: minz(f) for f in range(1, n_frames + 1)}
    print(f"{label} ground BEFORE:",
          {f: round(v, 3) for f, v in before.items()})
    print(f"{label} ground AFTER:",
          {f: round(v, 3) for f, v in after.items()})
    return after

# ---- BITE ("Attack", 36 fr = 1.50 s) --------------------------------
# v3 (2026-10-29, exaggeration pass 2): v2 FAILED the frozen-frame
# bar -- it read as a slow bow/nod. Measured causes: (1) the approach
# spread root travel over 10 frames of bezier = a lean, not a burst;
# (2) at reach the pitch stack (spine+chest+neck+head = ~48 deg down)
# pointed the snout at the floor, so the 64 deg jaw opening rotated
# the chin scoop down BEHIND the snout wedge and the open mouth faced
# the ground -- invisible from the review camera; (3) the shake's
# snout-tip lateral travel measured only ~0.05 units (chest
# counter-yaw cancelled half the head yaw, and yaw on a
# floor-pointing head produces almost no silhouette change).
# v3 fixes: wind-up compressed to f4, root BURSTS f4->f9 (0.26H,
# linear segments); at reach the head REARS BACK (neck/head negative)
# so the wide-open jaw silhouettes against the chest in profile and
# faces the camera; the shake runs with the head UP (pitch stack
# ~27 deg), head yaw +-33 deg LINEAR, chest yaw FOLLOWING the head
# one frame late (traveling wave, adds whip instead of cancelling),
# root swaying with the throw, tail alternating as lag garnish.
# Game contract kept: 36 fr / 1.50 s, clamp at f11 (ct 0.46 s),
# shake f13-24, toss f26.
_PS_REAR = PR.get("atk_pitch_rear", _AP)
_JS = PR.get("jaw_scale", 1.0)
_BITE_YAW = PR.get("bite_yaw", 0)   # reach-frames head yaw (beagle:
                                    # turns the white jaw against his
                                    # brown cheek so the gape reads)
act_bite = new_action("Attack")
scene.frame_start, scene.frame_end = 1, 36
KP(1)
# COIL (f4): deep, fast -- body recoils low/back, snout stays aimed
KP(4, root=(-0.055, 0, -0.045), spine=-10, chest=-9, neck=13, head=9,
   jaw=10, armL=(0, 30, 28, 4), armR=(0, 30, 28, 4),
   legL=(-20, 26, -6), legR=(14, 12, 4), tail=(8, 10))
# BURST (f6): root explodes forward, body uncoils, jaw cracking open,
# head starting to rear so the mouth comes up into silhouette
KP(6, root=(0.055, 0, -0.005), spine=5, chest=7, neck=2, head=-5,
   jaw=26, armL=(0, -44, 0, -6), armR=(0, -44, 0, -6),
   legL=(-34, 6, -2), legR=(30, 2, 14), tail=(12, 16))
# EXTEND (f8): nearly full reach, jaw wide, head reared back
KP(8, root=(0.165, 0, 0.004), spine=8, chest=10, neck=-3, head=-14,
   headY=_BITE_YAW, jaw=46, armL=(0, -56, -4, -8), armR=(0, -56, -4, -8),
   legL=(-40, 8, 0), legR=(36, 0, 16), tail=(13, 17))
# REACH (f9-10): mouth WIDE OPEN, held two frames, head reared --
# the open jaw is the silhouette, not a dip
KP(9, root=(0.200, 0, 0.002), spine=9, chest=11, neck=-8, head=-19,
   headY=_BITE_YAW, jaw=58, armL=(0, -56, -4, -8), armR=(0, -56, -4, -8),
   legL=(-38, 10, 0), legR=(34, 2, 16), tail=(12, 16))
KP(10, root=(0.205, 0, 0.0), spine=9, chest=11, neck=-8, head=-22,
   headY=_BITE_YAW, jaw=62, armL=(0, -56, -4, -8), armR=(0, -56, -4, -8),
   legL=(-38, 10, 0), legR=(34, 2, 16), tail=(12, 16))
# CLAMP (f11): jaw slams shut in one frame + head chops down onto it
KP(11, root=(0.210, 0, -0.004), spine=10, chest=12, neck=2, head=13,
   jaw=2, armL=(0, -58, -10, -8), armR=(0, -58, -10, -8),
   legL=(-38, 10, 0), legR=(34, 2, 16), tail=(12, 16))
KP(12, root=(0.205, 0, -0.006), spine=10, chest=12, neck=4, head=8,
   jaw=3, armL=(0, -50, -16, -6), armR=(0, -50, -16, -6),
   legL=(-30, 14, -2), legR=(26, 8, 10), tail=(10, 14))
# SHAKE (f13-24): head UP, yaw slams +-33 deg LINEAR, root sways
# with the throw, tail alternates a beat behind the head
for f, hy, rs, tl in ((13, 33, 0.020, (18, 24)), (15, -33, -0.020, (8, 10)),
                      (17, 29, 0.018, (18, 24)), (19, -29, -0.018, (8, 10)),
                      (21, 20, 0.012, (16, 20)), (23, -12, -0.008, (10, 12)),
                      (24, 0, 0.0, (12, 16))):
    KP(f, root=(0.205, rs, -0.006), spine=7, chest=8, chestY=0,
       neck=5, head=7, headY=hy, jaw=3,
       armL=(0, -48, -18, -6), armR=(0, -48, -18, -6),
       legL=(-26, 14, -2), legR=(24, 8, 10), tail=tl)
# TOSS: head flicks up/back, jaw re-opens to spit the target out
KP(26, root=(0.16, 0, 0.012), spine=-5, chest=-7, neck=-6, head=-20,
   jaw=30, armL=(0, -20, 6, 0), armR=(0, -20, 6, 0),
   legL=(-16, 14, -2), legR=(14, 8, 4), tail=(8, 10))
KP(30, root=(0.07, 0, 0.0), spine=3, chest=4, neck=5, head=3, jaw=6,
   armL=(0, -10, 8, 0), armR=(0, -10, 8, 0),
   legL=(-8, 8, 0), legR=(6, 6, 2), tail=(4, 6))
KP(36)
bezier(act_bite)
set_linear(act_bite, "jaw", {8, 9, 10, 11, 12})
set_linear(act_bite, "head", {10, 11, 12, 13, 15, 17, 19, 21, 23, 24})
set_linear(act_bite, "root", {4, 6, 8})
# chest-yaw LAG keys (inserted AFTER bezier() so they stay LINEAR):
# the chest chases the head one frame late at ~0.3x, same sign -- a
# traveling wave down the body (whip), where v2's same-frame
# counter-yaw just cancelled the snout travel.
for fc in _fcurves(act_bite):
    if fc.data_path == 'pose.bones["chest"].rotation_euler' \
            and fc.array_index == 1:
        for f, cy in ((14, 10), (16, -10), (18, 9), (20, -9),
                      (22, 6), (24, -4)):
            kp = fc.keyframe_points.insert(f, RAD(cy))
            kp.interpolation = "LINEAR"
autoground(act_bite, 36, "Bite")
_PS_REAR = _AP   # Bite-only overrides end here (Swipe/JK/UC use _AP)
_JS = 1.0

# ---- SWIPE (22 fr = 0.92 s): two-hit paw combination ----------------
act_swipe = new_action("Swipe")
scene.frame_start, scene.frame_end = 1, 22
KP(1)
# windup: torso twists away, right paw chambers back
KP(5, root=(-0.02, 0, -0.03), spine=4, chest=6, chestY=24, neck=4,
   head=4, jaw=8, armL=(0, -18, 20, 0), armR=(0, 34, 30, 4),
   legL=(-14, 18, -4), legR=(10, 10, 4), tail=(6, 8))
# SWIPE 1: right paw slashes across the body, torso unwinds hard
KP(8, root=(0.05, 0, -0.012), spine=8, chest=10, chestY=-22, neck=6,
   head=10, jaw=26, armL=(0, 6, 14, 0), armR=(38, -102, -12, -6),
   legL=(-26, 10, 0), legR=(22, 6, 10), tail=(12, 16))
# recock: left paw chambers
KP(11, root=(0.055, 0, -0.02), spine=5, chest=7, chestY=14, neck=4,
   head=6, jaw=10, armL=(0, 30, 28, 4), armR=(6, -34, 8, 0),
   legL=(-18, 14, -2), legR=(14, 8, 6), tail=(8, 10))
# SWIPE 2: left paw, bigger, with a step-in
KP(14, root=(0.085, 0, -0.014), spine=9, chest=11, chestY=26, neck=6,
   head=11, jaw=30, armL=(-38, -108, -10, -6), armR=(0, 10, 16, 0),
   legL=(-30, 10, 0), legR=(26, 6, 12), tail=(13, 17))
KP(18, root=(0.06, 0, -0.005), spine=4, chest=5, chestY=6, neck=3,
   head=4, jaw=6, armL=(0, -22, 10, 0), armR=(0, -16, 10, 0),
   legL=(-12, 10, 0), legR=(10, 6, 4), tail=(6, 8))
KP(22)
bezier(act_swipe)
autoground(act_swipe, 22, "Swipe")

# ---- JUMP KICK (24 fr = 1.00 s): leap + airborne hind-leg kick -----
act_jk = new_action("JumpKick")
scene.frame_start, scene.frame_end = 1, 24
KP(1)
# deep crouch
KP(4, root=(-0.01, 0, -0.085), spine=8, chest=12, neck=6, head=4,
   jaw=6, armL=(0, 24, 18, 0), armR=(0, 24, 18, 0),
   legL=(-38, 52, -14), legR=(-30, 44, -10), tail=(4, 6))
# launch: legs tuck
KP(7, root=(0.05, 0, 0.10), spine=4, chest=6, neck=8, head=6, jaw=12,
   armL=(0, -30, 6, 0), armR=(0, -30, 6, 0),
   legL=(-52, 68, -20), legR=(-46, 60, -16), tail=(10, 14))
# APEX: right hind leg snaps straight out forward, body pitched in
KP(11, root=(0.16, 0, 0.20), spine=12, chest=16, neck=10, head=8,
   jaw=22, armL=(0, 22, 10, 0), armR=(0, -52, -6, 0),
   legL=(18, 38, 10), legR=(-95, -4, -30), tail=(14, 18))
# retract
KP(14, root=(0.20, 0, 0.17), spine=8, chest=10, neck=8, head=6,
   jaw=10, armL=(0, 6, 10, 0), armR=(0, -26, 12, 0),
   legL=(8, 24, 4), legR=(-50, 40, -10), tail=(10, 14))
# descend, legs reaching for the ground
KP(18, root=(0.23, 0, 0.05), spine=5, chest=7, neck=5, head=4, jaw=4,
   armL=(0, -6, 10, 0), armR=(0, -6, 10, 0),
   legL=(-12, 10, 0), legR=(-16, 14, 0), tail=(6, 8))
# land: knees absorb
KP(20, root=(0.24, 0, -0.03), spine=6, chest=8, neck=5, head=4, jaw=2,
   armL=(0, 4, 12, 0), armR=(0, 4, 12, 0),
   legL=(-26, 30, -8), legR=(-20, 24, -6), tail=(5, 7))
KP(24, root=(0.12, 0, 0.0))
bezier(act_jk)
autoground(act_jk, 24, "JumpKick")

# ---- UPPERCUT (20 fr = 0.83 s): crouch -> rising paw launch --------
act_uc = new_action("Uppercut")
scene.frame_start, scene.frame_end = 1, 20
KP(1)
# deep crouch, right paw chambered low by the hip
KP(5, root=(-0.01, 0, -0.10), spine=10, chest=16, neck=8, head=6,
   jaw=8, armL=(0, -20, 16, 0), armR=(0, 18, 64, 6),
   legL=(-30, 40, -10), legR=(-24, 34, -8), tail=(4, 6))
# EXPLODE up: paw rockets up-forward, torso uncoils backward
KP(9, root=(0.02, 0, 0.055), spine=-10, chest=-14, neck=-8, head=-12,
   jaw=28, armL=(0, 30, 10, 0), armR=(0, -150, -18, -4),
   legL=(-6, 4, 0), legR=(8, 2, 4), tail=(12, 16))
# peak hold: paw at the top of the arc
KP(12, root=(0.02, 0, 0.065), spine=-11, chest=-15, neck=-9, head=-14,
   jaw=24, armL=(0, 28, 10, 0), armR=(0, -158, -8, -4),
   legL=(-4, 4, 0), legR=(10, 2, 4), tail=(12, 16))
KP(16, root=(0.01, 0, 0.0), spine=-3, chest=-4, neck=-2, head=-4,
   jaw=6, armL=(0, 8, 10, 0), armR=(0, -70, 4, 0),
   legL=(-12, 12, -2), legR=(-8, 10, 0), tail=(6, 8))
KP(20)
bezier(act_uc)
autoground(act_uc, 20, "Uppercut")

# ---- numeric clip checks (geometry, not vibes) ----------------------
_bone_idx = {nm: j for j, (nm, *_r) in enumerate(bones)}
def _centroid_of(bone_name, f):
    idxs = np.where(top[:, 0] == _bone_idx[bone_name])[0]
    if not len(idxs):
        return np.zeros(3)
    scene.frame_set(f)
    bpy.context.view_layer.update()
    ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    em = ev.to_mesh()
    co = np.empty(len(em.vertices) * 3)
    em.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    ev.to_mesh_clear()
    mw = np.array(mesh.matrix_world)
    return (co[idxs] @ mw[:3, :3].T + mw[:3, 3]).mean(axis=0)

if is_jaw.any():
    _front = np.where(is_jaw & (verts[:, 0] >
                      np.percentile(verts[is_jaw, 0], 55)))[0]
    def _jawz(f):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        em = ev.to_mesh()
        co = np.empty(len(em.vertices) * 3)
        em.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        ev.to_mesh_clear()
        mw = np.array(mesh.matrix_world)
        w = co @ mw[:3, :3].T + mw[:3, 3]
        return float(w[_front][:, 2].mean())
    arm.animation_data.action = act_bite
    print("CLIPCHECK bite jaw-front z: f1 closed / f10 OPEN / "
          "f11 clamp / f18 shake:",
          [round(_jawz(f), 4) for f in (1, 10, 11, 18)])
arm.animation_data.action = act_swipe
print("CLIPCHECK swipe hand.R f1 -> f8 (want fwd +x, across -y->+):",
      [np.round(_centroid_of("hand.R", f), 3).tolist() for f in (1, 8)],
      " hand.L f11 -> f14:",
      [np.round(_centroid_of("hand.L", f), 3).tolist() for f in (11, 14)])
arm.animation_data.action = act_jk
print("CLIPCHECK jumpkick foot.R f1 -> f11 (want fwd +x):",
      [np.round(_centroid_of("foot.R", f), 3).tolist() for f in (1, 11)])
arm.animation_data.action = act_uc
print("CLIPCHECK uppercut hand.R f1 -> f9 (want UP +z):",
      [np.round(_centroid_of("hand.R", f), 3).tolist() for f in (1, 9)])

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

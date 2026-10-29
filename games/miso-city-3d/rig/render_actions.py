#!/usr/bin/env python3
"""
render_actions.py -- quick Cycles proof stills of each action's key
pose from a rigged dog GLB (Workbench is unusable on this VM: no
libEGL). Each pose is re-grounded (min-z shifted onto the ground
plane) purely for presentation.

Usage:
  blender --background --factory-startup --python render_actions.py -- \
      INPUT.glb OUT_DIR TAG
Writes OUT_DIR/TAG-walk.png, TAG-attack.png, TAG-hit.png, TAG-down.png
"""
import os
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_DIR, TAG = argv[0], argv[1], argv[2]
os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
imported = [o for o in bpy.data.objects if o not in before]
meshes = [o for o in imported if o.type == "MESH" and len(o.data.vertices) > 1000]
arm = next((o for o in imported if o.type == "ARMATURE"), None)
roots = [o for o in imported if o.parent is None or o.parent not in imported]
print("actions available:", [a.name for a in bpy.data.actions])

scene = bpy.context.scene
scene.render.fps = 24

def srgb_to_lin(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

_mats = set()
for o in meshes:
    for slot in o.material_slots:
        if slot.material:
            _mats.add(slot.material)
for m in _mats:
    if not m.use_nodes:
        continue
    for nd in m.node_tree.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            inp = nd.inputs["Base Color"]
            if not inp.links:
                r, g, b, a = inp.default_value
                inp.default_value = (srgb_to_lin(r), srgb_to_lin(g),
                                     srgb_to_lin(b), a)

def eval_min_z():
    dg = bpy.context.evaluated_depsgraph_get()
    mn = 1e9
    for o in meshes:
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        mw = ev.matrix_world
        for v in m.vertices:
            z = (mw @ v.co).z
            if z < mn:
                mn = z
        ev.to_mesh_clear()
    return mn

def bbox():
    xs, ys, zs = [], [], []
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    return (sum(xs) / len(xs), sum(ys) / len(ys), max(zs) - min(zs))

# bind-pose ground level
if arm and arm.animation_data:
    arm.animation_data.action = None
if arm:
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
arm_mod = None
for o in meshes:
    for md in o.modifiers:
        if md.type == "ARMATURE":
            arm_mod = md
if arm_mod:
    arm_mod.show_viewport = False
    arm_mod.show_render = False
scene.frame_set(1)
bpy.context.view_layer.update()
GZ = eval_min_z()
CX, CY, HH = bbox()
if arm_mod:
    arm_mod.show_viewport = True
    arm_mod.show_render = True
print(f"bind ground z={GZ:.4f} centre=({CX:.3f},{CY:.3f}) height={HH:.3f}")

def flat_mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1.0)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (
        *rgb, 1.0)
    return m

bpy.ops.mesh.primitive_circle_add(radius=4.0, vertices=48, fill_type="NGON",
                                  location=(CX, CY, GZ))
disc = bpy.context.view_layer.objects.active
disc.data.materials.append(flat_mat("Ground", (0.90, 0.90, 0.92)))

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.96, 0.96, 0.98, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 1.7
sun_data.angle = 0.45
sun = bpy.data.objects.new("Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (0.91, 0, 0.61)

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
dist = 2.2 * max(HH, 0.8)
cam.location = Vector((CX + 0.62 * dist, CY - 0.46 * dist, GZ + 0.52 * HH + 0.25))
target = Vector((CX, CY, GZ + 0.45 * HH))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 42
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.resolution_x = 560
scene.render.resolution_y = 420
scene.render.image_settings.file_format = "PNG"

base_z = {o: o.location.z for o in roots}
# The glTF importer suffixes action names with the armature name
# ("Walk_DogRig") and parks them in NLA tracks; mute the tracks and
# look actions up by prefix.
if arm and arm.animation_data:
    for tr in arm.animation_data.nla_tracks:
        tr.mute = True

def find_action(name):
    for a in bpy.data.actions:
        if a.name == name or a.name.startswith(name + "_"):
            return a
    return None

for label, act_name, fr in (("walk", "Walk", 7), ("attack", "Attack", 7),
                            ("hit", "Hit", 3), ("down", "Down", 15)):
    act = find_action(act_name)
    if act is None or arm is None:
        print("MISSING action", act_name)
        continue
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = act
    scene.frame_set(fr)
    bpy.context.view_layer.update()
    mz = eval_min_z()
    dz = GZ - mz
    for o in roots:
        o.location.z = base_z[o] + dz
    bpy.context.view_layer.update()
    print(f"{label}: frame {fr} min z {mz:.3f} -> shift {dz:+.3f}")
    scene.render.filepath = os.path.join(OUT_DIR, f"{TAG}-{label}.png")
    bpy.ops.render.render(write_still=True)
    print("WROTE", scene.render.filepath)
    for o in roots:
        o.location.z = base_z[o]
print("ACTIONS_DONE")

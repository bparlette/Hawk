#!/usr/bin/env python3
"""
render_grounded.py -- grounded shots of the rigged Miso biped.

Standing: bind/rest pose (action cleared), feet planted on a visible
ground disc (subtle concentric radial shading) with a soft contact
shadow built from stacked fade rings. Walk: phase 25 (frame 7), same
setup. Cycles CPU -- GPU engines cannot init on this VM (no libEGL).

Usage:
  blender --background --factory-startup --python render_grounded.py -- [LIGHT] [SCALE] [TAG]
  LIGHT arg kept for CLI compat (ignored; Cycles lighting is scene-based)
Outputs: stills-miso/standing[TAG].png, stills-miso/walk_grounded[TAG].png
"""
import os
import sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "miso-ninja-biped-rigged-walk.glb")
OUT_DIR = os.path.join(HERE, "stills-ninja")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LIGHT = argv[0] if len(argv) > 0 else "STUDIO"
SCALE = float(argv[1]) if len(argv) > 1 else 1.0
TAG = argv[2] if len(argv) > 2 else ""

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
imported = [o for o in bpy.data.objects if o not in before]
# NOTE: this Blender build's glTF importer spawns a phantom 42-vert
# "Icosphere" (in the excluded glTF_not_exported collection, never
# renders, but its base verts sit at z=-1 and poison ground maths).
# Only the real character mesh counts: filter by vertex count.
meshes = [o for o in imported if o.type == "MESH" and len(o.data.vertices) > 1000]
arm = next((o for o in imported if o.type == "ARMATURE"), None)
action = arm.animation_data.action if (arm and arm.animation_data) else None
print("imported:", [(o.name, o.type) for o in imported], "action:", action)

scene = bpy.context.scene
scene.render.fps = 24

# The character's material colours were authored as raw sRGB values in
# the Principled base-colour slots, which Blender reads as LINEAR --
# rendered raw they wash out to pale yellow. Convert sRGB->linear in
# this render scene only (the GLB file itself is untouched) so his
# orange reads as the saturated orange of the reference sprite.
def srgb_to_lin(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

_char_mats = set()
for o in meshes:
    for slot in o.material_slots:
        if slot.material:
            _char_mats.add(slot.material)
for m in _char_mats:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            inp = n.inputs["Base Color"]
            if not inp.links:
                r, g, b, a = inp.default_value
                inp.default_value = (srgb_to_lin(r), srgb_to_lin(g),
                                     srgb_to_lin(b), a)
    r, g, b, a = m.diffuse_color
    m.diffuse_color = (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), a)
print("colour-converted materials:", sorted(m.name for m in _char_mats))


def world_min_z():
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


def bbox_center_xy():
    xs, ys = [], []
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            xs.append(w.x)
            ys.append(w.y)
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def flat_mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (
        rgb[0], rgb[1], rgb[2], 1.0)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    return m


def disc(radius, z, mat, name):
    bpy.ops.mesh.primitive_circle_add(radius=radius, vertices=48,
                                      fill_type="NGON", location=(cx, cy, z))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(mat)
    return o


# ---------------- TRUE bind pose for the standing shot:
# clear the action, zero every pose bone, AND switch the Armature
# modifier off at render/viewport level -- belt and braces, because
# merely clearing the action left a walk pose in the evaluated mesh.
arm_mod = None
for o in meshes:
    for md in o.modifiers:
        if md.type == "ARMATURE":
            arm_mod = md
if arm and arm.animation_data:
    arm.animation_data.action = None
if arm:
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)
if arm_mod:
    arm_mod.show_viewport = False
    arm_mod.show_render = False
scene.frame_set(1)
bpy.context.view_layer.update()
gz = world_min_z()
cx, cy = bbox_center_xy()
print(f"REST ground z = {gz:.4f}  centre xy = ({cx:.3f},{cy:.3f})")

# ---------------- ground: subtle radial shading via concentric discs
disc(4.00, gz, flat_mat("GroundFar", (0.885, 0.885, 0.90)), "GroundFar")
disc(2.10, gz + 0.0006, flat_mat("GroundMid", (0.915, 0.915, 0.93)), "GroundMid")
disc(1.05, gz + 0.0012, flat_mat("GroundNear", (0.945, 0.945, 0.955)), "GroundNear")

# ---------------- soft contact shadow: fade rings, darkest at centre
steps = 8
for i in range(steps):
    t = i / (steps - 1)              # 0 outer -> 1 centre
    r = 0.42 - 0.30 * t              # 0.42 -> 0.12
    g = 0.78 - 0.44 * t              # 0.78 -> 0.34 grey
    disc(r, gz + 0.002 + 0.0007 * i, flat_mat(f"Blob{i}", (g, g, g + 0.01)), f"Blob{i}")

# ---------------- world / lights / camera
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
wbg = world.node_tree.nodes["Background"]
wbg.inputs[0].default_value = (0.965, 0.965, 0.98, 1)
wbg.inputs[1].default_value = 0.55

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 1.7
sun_data.angle = 0.45
sun = bpy.data.objects.new("Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (0.91, 0, 0.61)

fill_data = bpy.data.lights.new("Fill", "SUN")
fill_data.energy = 0.45
fill = bpy.data.objects.new("Fill", fill_data)
scene.collection.objects.link(fill)
fill.rotation_euler = (1.22, 0, -2.09)

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((cx + 1.5, cy - 1.12, gz + 0.60))
target = Vector((cx, cy, gz + 0.50))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 42
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.resolution_x = int(640 * SCALE)
scene.render.resolution_y = int(760 * SCALE)
scene.render.image_settings.file_format = "PNG"

suffix = f"_{TAG}" if TAG else ""
scene.render.filepath = os.path.join(OUT_DIR, f"standing{suffix}.png")
bpy.ops.render.render(write_still=True)
print("WROTE", scene.render.filepath)

# ---- walk phase 25 = frame 7: restore rig + action first
if arm_mod:
    arm_mod.show_viewport = True
    arm_mod.show_render = True
if arm and action is not None:
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = action
scene.frame_set(7)
bpy.context.view_layer.update()
wz = world_min_z()
delta = gz - wz
print(f"WALK frame7 min z = {wz:.4f}  (ground {gz:.4f}, delta {delta:+.4f})")
if abs(delta) > 0.004:
    roots = [o for o in imported if o.parent is None or o.parent not in imported]
    for o in roots:
        o.location.z += delta
    bpy.context.view_layer.update()
    print(f"  nudged roots by {delta:+.4f}; new min z = {world_min_z():.4f}")
scene.render.filepath = os.path.join(OUT_DIR, f"walk_grounded{suffix}.png")
bpy.ops.render.render(write_still=True)
print("WROTE", scene.render.filepath)
print("RENDER_GROUNDED_DONE light=", LIGHT)

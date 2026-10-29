#!/usr/bin/env python3
"""
render_dog.py -- one grounded STANDING still of a rigged dog, using
render_grounded.py's recipe: true bind pose, ground discs with radial
shading, stacked fade-ring contact shadow, sRGB->linear material fix,
Cycles CPU (GPU engines cannot init on this VM).

Usage:
  blender --background --factory-startup --python render_dog.py -- INPUT.glb OUT.png
"""
import os
import sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
imported = [o for o in bpy.data.objects if o not in before]
# This Blender build's glTF importer can spawn a phantom low-vert
# "Icosphere" that poisons ground maths -- keep only the real mesh.
meshes = [o for o in imported if o.type == "MESH" and len(o.data.vertices) > 1000]
arm = next((o for o in imported if o.type == "ARMATURE"), None)
print("imported:", [(o.name, o.type) for o in imported])

scene = bpy.context.scene
scene.render.fps = 24

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
    for nd in m.node_tree.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            inp = nd.inputs["Base Color"]
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

def disc(radius, z, matl, name):
    bpy.ops.mesh.primitive_circle_add(radius=radius, vertices=48,
                                      fill_type="NGON", location=(cx, cy, z))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(matl)
    return o

# ---- true bind pose: clear action, zero pose bones, disable modifier
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

disc(4.00, gz, flat_mat("GroundFar", (0.885, 0.885, 0.90)), "GroundFar")
disc(2.10, gz + 0.0006, flat_mat("GroundMid", (0.915, 0.915, 0.93)), "GroundMid")
disc(1.05, gz + 0.0012, flat_mat("GroundNear", (0.945, 0.945, 0.955)), "GroundNear")

steps = 8
for i in range(steps):
    t = i / (steps - 1)
    r = 0.42 - 0.30 * t
    g = 0.78 - 0.44 * t
    disc(r, gz + 0.002 + 0.0007 * i, flat_mat(f"Blob{i}", (g, g, g + 0.01)),
         f"Blob{i}")

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

# Character height from bind-pose bbox for camera framing.
zs = []
for o in meshes:
    for c in o.bound_box:
        zs.append((o.matrix_world @ Vector(c)).z)
top = max(zs)
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((cx + 1.5, cy - 1.12, gz + 0.60))
target = Vector((cx, cy, gz + (top - gz) * 0.50))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 42
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT)

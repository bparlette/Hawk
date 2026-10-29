#!/usr/bin/env python3
"""Quick back-left bind-pose check render of the ninja Miso (ribbons).
Cycles CPU, low samples -- verification only, not a beauty shot."""
import os
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "miso-ninja-biped-rigged-walk.glb")
OUT = os.path.join(HERE, "stills-ninja", "back.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
imported = [o for o in bpy.data.objects if o not in before]
meshes = [o for o in imported if o.type == "MESH" and len(o.data.vertices) > 1000]
arm = next((o for o in imported if o.type == "ARMATURE"), None)
if arm and arm.animation_data:
    arm.animation_data.action = None
if arm:
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)
for o in meshes:
    for md in o.modifiers:
        if md.type == "ARMATURE":
            md.show_viewport = False
            md.show_render = False

def srgb_to_lin(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

_mats = set()
for o in meshes:
    for slot in o.material_slots:
        if slot.material:
            _mats.add(slot.material)
for m in _mats:
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                inp = n.inputs["Base Color"]
                if not inp.links:
                    r, g, b, a = inp.default_value
                    inp.default_value = (srgb_to_lin(r), srgb_to_lin(g),
                                         srgb_to_lin(b), a)
    r, g, b, a = m.diffuse_color
    m.diffuse_color = (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), a)

scene = bpy.context.scene
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
sun.rotation_euler = (0.91, 0, 2.5)

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((-1.75, 1.30, 1.05))
target = Vector((-0.05, 0.0, 0.55))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 42
scene.camera = cam
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
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

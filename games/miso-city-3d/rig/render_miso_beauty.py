#!/usr/bin/env python3
"""
render_miso_beauty.py -- extra front 3/4 beauty still of the rigged Miso
at walk phase 0, rendered from miso-biped-rigged-walk.glb.

Run: blender --background --factory-startup --python render_miso_beauty.py
"""
import os
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "miso-biped-rigged-walk.glb")
OUT = os.path.join(HERE, "stills-miso", "beauty_phase0.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

scene = bpy.context.scene
scene.frame_set(1)  # walk phase 0

# Workbench, material colours, soft studio-ish shading
scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_cavity = True
shading.cavity_type = "WORLD"
scene.render.resolution_x = 640
scene.render.resolution_y = 760
scene.render.filepath = OUT

# camera at front-right 3/4, looking at character centre (faces +X)
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((1.55, -1.15, 0.62))
target = Vector((0, 0, 0.50))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 42
scene.camera = cam

# ground shadow-catcher feel: none (Workbench flat bg is fine) -- set world
scene.world = bpy.data.worlds.new("W")
scene.world.color = (0.92, 0.92, 0.94)

bpy.ops.render.render(write_still=True)
print("BEAUTY written:", OUT)

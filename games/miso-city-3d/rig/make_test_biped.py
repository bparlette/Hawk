#!/usr/bin/env python3
"""
make_test_biped.py -- build a simple procedural BIPED test character
(Miso-like proportions: head ~35% of height, arms, legs, tail) and export
it UNRIGGED as test-biped.glb, as a stand-in for the TRELLIS/Hunyuan Miso
mesh when proving rig_biped.py end-to-end.

Character faces +X. Blender coords: X forward, Y side, Z up.
Run: blender --background --factory-startup --python make_test_biped.py
"""
import os
import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "test-biped.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    MATS[name] = m
    return m

ORANGE = mat("Orange", (0.93, 0.44, 0.10))
CREAM = mat("Cream", (0.98, 0.90, 0.74))
GREEN = mat("Green", (0.10, 0.58, 0.26))
DARK = mat("Dark", (0.25, 0.12, 0.05))

def finish(ob, material):
    if material:
        ob.data.materials.append(material)
    return ob

def sphere(name, loc, scale, material, r=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=24, ring_count=16,
                                         location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, material)

def box(name, loc, dims, material):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, material)

def limb(name, p1, p2, r, material):
    """Cylinder between two points."""
    a, b = Vector(p1), Vector(p2)
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length,
                                        vertices=16, location=mid)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(b - a)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(ob, material)

def cone(name, loc, r, h, material, tilt_x=0.0):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0.0, depth=h,
                                    vertices=16, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_euler = (tilt_x, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(ob, material)

# --- legs + feet (hips z 0.52 -> ankles z 0.08; feet protrude +X)
for sd, tag in ((+1, "L"), (-1, "R")):
    limb(f"Leg.{tag}", (0, sd * 0.085, 0.06), (0, sd * 0.085, 0.52),
         0.052, ORANGE)
    box(f"Foot.{tag}", (0.02, sd * 0.085, 0.025), (0.16, 0.09, 0.05), DARK)

# --- body + scarf
sphere("Body", (0, 0, 0.585), (0.141, 0.125, 0.189), ORANGE)
sphere("Belly", (0.055, 0, 0.55), (0.10, 0.095, 0.13), CREAM)
bpy.ops.mesh.primitive_torus_add(major_radius=0.125, minor_radius=0.038,
                                 major_segments=24, minor_segments=10,
                                 location=(0, 0, 0.715))
scarf = bpy.context.view_layer.objects.active
scarf.name = "Scarf"
finish(scarf, GREEN)

# --- arms (shoulder -> elbow -> wrist, hanging slightly out)
for sd, tag in ((+1, "L"), (-1, "R")):
    limb(f"UpperArm.{tag}", (0, sd * 0.165, 0.70), (-0.01, sd * 0.215, 0.565),
         0.038, ORANGE)
    limb(f"Forearm.{tag}", (-0.01, sd * 0.215, 0.565),
         (0.005, sd * 0.235, 0.45), 0.034, ORANGE)
    sphere(f"Hand.{tag}", (0.005, sd * 0.235, 0.435), (0.048, 0.048, 0.048),
           CREAM)

# --- head (sphere dia 0.34: z 0.675..1.015), muzzle, ears
sphere("Head", (0.005, 0, 0.845), (0.17, 0.17, 0.17), ORANGE)
sphere("Muzzle", (0.145, 0, 0.80), (0.068, 0.058, 0.048), CREAM)
for sd, tag in ((+1, "L"), (-1, "R")):
    cone(f"Ear.{tag}", (-0.01, sd * 0.105, 1.03), 0.062, 0.13, ORANGE,
         tilt_x=-sd * 0.25)
    sphere(f"EarTip.{tag}", (-0.01 - 0.0, sd * 0.121, 1.088),
           (0.02, 0.02, 0.03), DARK)

# --- tail (two segments curling up behind, -X)
limb("Tail.1", (-0.12, 0, 0.53), (-0.24, 0, 0.60), 0.032, ORANGE)
limb("Tail.2", (-0.24, 0, 0.60), (-0.315, 0, 0.72), 0.026, ORANGE)
sphere("TailTip", (-0.315, 0, 0.72), (0.03, 0.03, 0.03), DARK)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB",
                          export_animations=False, export_skins=False)
print("TEST_BIPED written:", OUT)

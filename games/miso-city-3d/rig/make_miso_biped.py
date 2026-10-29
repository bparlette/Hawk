#!/usr/bin/env python3
"""
make_miso_biped.py -- build a MISO likeness as a procedural biped and
export it UNRIGGED as miso-biped.glb, ready for rig_biped.py.

Proportions measured from ~/workspace/miso-3d-rig/miso-reference-upscaled.png
(720x846; character bbox 695x820 px; fractions of total height H):
  head + ears        0.52 H (skull alone ~0.44 H; chin at z~0.48)
  head width         0.60 H  vs body width 0.36 H  (head = 1.65x body)
  ears               ~0.17 H tall, tips = top of silhouette
  scarf band         z 0.35..0.47 (thickness 0.12 H); hanging tail to z~0.19
  legs + feet        bottom 0.18 H
  tail               upright behind body, ~0.35 H visible, ~0.13 H thick
  eyes               centres z~0.62, spacing 0.17 H, ~0.06 x 0.075 H ovals
  nose               z~0.56, small pink; muzzle cream zone z 0.48..0.58

Character faces +X. Blender coords: X forward, Y side, Z up. Built at
H = 1.0 (rig_biped.py re-normalises anyway). All parts are smooth
subdivided primitives, joined into ONE mesh (per-part materials kept)
so the rigger's debris filter can never amputate a small part.

Revision 2 anchors on Cherie's own frame (miso-reference-photo.jpg),
which supersedes the painting where they differ: tail tip only reaches
~hip height (z~0.52), whisker marks on both cheeks, scarf's loose end
ends ~chest level, feet are small rounded paws.

Run: blender --background --factory-startup --python make_miso_biped.py
"""
import os
import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "miso-biped.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------- materials
def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    return m

ORANGE = mat("CoatOrange", (0.95, 0.52, 0.13))      # ~#E8892B
DARKOR = mat("StripeDark", (0.66, 0.33, 0.07))      # tabby stripes
CREAM = mat("Cream", (0.98, 0.90, 0.74))            # muzzle/belly/paws
GREEN = mat("ScarfGreen", (0.20, 0.62, 0.32))
GREEN_D = mat("ScarfGreenDark", (0.13, 0.47, 0.24))
PINK = mat("NosePink", (0.85, 0.42, 0.47))
INNER = mat("InnerEar", (0.90, 0.60, 0.52))
EYECOL = mat("EyeDark", (0.13, 0.07, 0.04))

# ---------------------------------------------------------------- helpers
def finish(ob, material):
    ob.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return ob

def sphere(name, loc, scale, material, seg=32, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=seg,
                                         ring_count=rings, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(ob, material)

def capsule(name, p1, p2, r, material, seg=20):
    """Sphere-ended limb segment between two points."""
    a, b = Vector(p1), Vector(p2)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length,
                                        vertices=seg, location=(a + b) / 2)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(b - a)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    finish(ob, material)
    sphere(name + ".a", tuple(a), (r, r, r), material, seg=seg, rings=12)
    sphere(name + ".b", tuple(b), (r, r, r), material, seg=seg, rings=12)
    return ob

def cone(name, loc, r1, r2, h, material, tilt_x=0.0, seg=24):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h,
                                    vertices=seg, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_euler = (tilt_x, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(ob, material)

def torus(name, loc, major, minor, material, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=36, minor_segments=12,
                                     location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_euler = rot
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(ob, material)

# ---------------------------------------------------------------- legs/feet
# hips z~0.20, feet on ground; legs short (bottom 0.18 H)
for sd, tag in ((+1, "L"), (-1, "R")):
    capsule(f"Leg.{tag}", (0.005, sd * 0.082, 0.205), (0.01, sd * 0.085, 0.055),
            0.052, ORANGE)
    # small oval foot pointing forward (+X), toe cap cream
    sphere(f"Foot.{tag}", (0.030, sd * 0.085, 0.030), (0.085, 0.060, 0.033),
           ORANGE)
    sphere(f"Toe.{tag}", (0.088, sd * 0.085, 0.028), (0.038, 0.050, 0.026),
           CREAM)

# ---------------------------------------------------------------- body
# chubby egg: width 0.36 H, z 0.13..0.52 (top hides under scarf/head)
sphere("Body", (0, 0, 0.325), (0.150, 0.178, 0.195), ORANGE, seg=40, rings=28)
# cream belly patch, slightly proud of the front (kept small + high:
# a bigger, lower patch rendered like a bib in the first pass)
sphere("Belly", (0.118, 0, 0.315), (0.058, 0.088, 0.105), CREAM)

# ---------------------------------------------------------------- arms
# tucked under the scarf, hanging at the sides; paws reach z~0.27
for sd, tag in ((+1, "L"), (-1, "R")):
    capsule(f"Arm.{tag}", (0.01, sd * 0.168, 0.435), (0.02, sd * 0.198, 0.315),
            0.044, ORANGE)
    sphere(f"Paw.{tag}", (0.025, sd * 0.205, 0.285), (0.052, 0.052, 0.058),
           CREAM)

# ---------------------------------------------------------------- tail
# Curls up behind the body (-X); per Cherie's photo the tip reaches only
# ~hip/scarf height (z~0.52), NOT up beside the head. Bushy sphere chain.
tail_pts = [(-0.130, 0.0, 0.17, 0.064), (-0.175, 0.0, 0.26, 0.068),
            (-0.200, 0.0, 0.36, 0.066), (-0.205, 0.0, 0.45, 0.060),
            (-0.190, 0.0, 0.52, 0.052)]
for i, (x, y, z, r) in enumerate(tail_pts):
    sphere(f"Tail.{i}", (x, y, z), (r, r, r * 1.12), ORANGE, seg=24, rings=16)
# two dark bands around the near-vertical tail
torus("TailStripe.1", (-0.203, 0, 0.405), 0.056, 0.015, DARKOR, scale=(1, 1, 0.55))
torus("TailStripe.2", (-0.198, 0, 0.485), 0.050, 0.014, DARKOR, scale=(1, 1, 0.55))

# ---------------------------------------------------------------- head
# skull: centre z 0.73, spans z 0.49..0.97, width 0.60 H, depth 0.46 H
sphere("Head", (0, 0, 0.73), (0.228, 0.298, 0.242), ORANGE, seg=48, rings=32)
# cheek fluff: a wider, lower second sphere softens the jaw
sphere("Cheeks", (0.005, 0, 0.655), (0.205, 0.285, 0.175), ORANGE,
       seg=40, rings=28)

# ears: triangular cones, rounded tips, slight outward tilt; inner ear inset
for sd, tag in ((+1, "L"), (-1, "R")):
    cone(f"Ear.{tag}", (-0.01, sd * 0.168, 0.955), 0.088, 0.018, 0.19,
         ORANGE, tilt_x=-sd * 0.22)
    sphere(f"EarTip.{tag}", (-0.01 - 0.0, sd * 0.189, 1.045),
           (0.020, 0.020, 0.026), ORANGE, seg=16, rings=12)
    cone(f"InnerEar.{tag}", (0.030, sd * 0.163, 0.935), 0.038, 0.008, 0.095,
         INNER, tilt_x=-sd * 0.22, seg=16)

# forehead stripes: three short dark bands lying on top of the skull
for i, yoff in enumerate((-0.075, 0.0, 0.075)):
    sphere(f"ForeStripe.{i}", (-0.015, yoff, 0.962), (0.075, 0.017, 0.014),
           DARKOR, seg=20, rings=12)

# muzzle: cream bulge low on the face + small pink nose + dark oval eyes
sphere("Muzzle", (0.182, 0, 0.588), (0.072, 0.096, 0.052), CREAM,
       seg=32, rings=24)
sphere("Nose", (0.238, 0, 0.622), (0.028, 0.036, 0.020), PINK, seg=20, rings=14)
for sd, tag in ((+1, "L"), (-1, "R")):
    sphere(f"Eye.{tag}", (0.198, sd * 0.098, 0.668), (0.033, 0.043, 0.055),
           EYECOL, seg=24, rings=18)

# whisker marks: three short dark dashes per cheek, lying on the face
# surface (called out in Cherie's photo; tiny flattened elongated spheres)
for sd, tag in ((+1, "L"), (-1, "R")):
    for i, (wy, wz) in enumerate(((0.205, 0.628), (0.222, 0.603),
                                  (0.232, 0.578))):
        w = sphere(f"Whisker.{tag}.{i}", (0.148, sd * wy, wz),
                   (0.007, 0.034, 0.0055), EYECOL, seg=12, rings=8)
        w.rotation_euler = (sd * (0.10 - i * 0.10), 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True,
                                       scale=False)

# ---------------------------------------------------------------- scarf
# band at the neck (z 0.35..0.47) + hanging tail at his left front
torus("ScarfBand", (0, 0, 0.452), 0.150, 0.052, GREEN, scale=(1.12, 1.18, 0.92))
sphere("ScarfHang", (0.115, 0.128, 0.360), (0.048, 0.066, 0.110), GREEN,
       seg=28, rings=20)
sphere("ScarfHangTip", (0.118, 0.130, 0.262), (0.046, 0.062, 0.042), GREEN_D,
       seg=24, rings=16)

# ---------------------------------------------------------------- join + export
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["Head"]
bpy.ops.object.join()
miso = bpy.context.view_layer.objects.active
miso.name = "Miso"
print("MISO verts:", len(miso.data.vertices), "materials:",
      [m.name if m else None for m in miso.data.materials])

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB",
                          export_animations=False, export_skins=False)
print("MISO_BIPED written:", OUT)

#!/usr/bin/env python3
"""
make_dogs.py -- procedural enemy dogs for the Miso game, built with the
same smooth-primitive recipe as make_miso_biped.py: every dog is ONE
joined mesh with per-part materials, facing +X, built at local H = 1.0
(rig_dog.py scales to the dog's game height and fits the shared 20-bone
biped skeleton).

Usage:
  blender --background --factory-startup --python make_dogs.py -- dane|beagle|bulldog
Exports dog-<name>-raw.glb (unrigged) next to this script.

Designs (from the approved roster art in ~/workspace/miso-3d-rig/):
  dane    blue-grey, huge floppy ears, long neck, cream tape wraps,
          chunky gold chain + medallion, long thin tail      (1.35x)
  beagle  tri-color (brown / black saddle+head patch / white belly
          and blaze), huge round belly, ears past the jaw,
          black spiked collar, stub legs, white tail tip     (0.72x)
  bulldog white + brindle patches, jowls + underbite fangs,
          steel chain, black vest open at the front,
          black forearm wraps, nub tail                      (1.15x)
"""
import os
import sys
import math
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:]
DOG = argv[0]
OUT = os.path.join(HERE, f"dog-{DOG}-raw.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------- materials
def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    return m

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

def spike_ring(centre, radius, z, n, r, h, material):
    """Cones pointing radially outward in the horizontal plane."""
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), math.sin(a), 0))
        loc = Vector((centre[0], centre[1], z)) + d * radius
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0.0, depth=h,
                                        vertices=10,
                                        location=loc + d * (h / 2 - 0.006))
        ob = bpy.context.view_layer.objects.active
        ob.name = f"Spike.{i}"
        ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
        bpy.ops.object.transform_apply(location=False, rotation=True,
                                       scale=False)
        finish(ob, material)

def tail_chain(name, pts, material, tip_material=None):
    for i, (x, y, z, r) in enumerate(pts):
        m = tip_material if (tip_material is not None
                             and i == len(pts) - 1) else material
        sphere(f"{name}.{i}", (x, y, z), (r, r, r * 1.1), m,
               seg=20, rings=14)

SDS = ((+1, "L"), (-1, "R"))

# ================================================================ DANE
def build_dane():
    COAT = mat("DaneCoat", (0.36, 0.44, 0.57))       # blue-grey
    DARK = mat("DaneEar", (0.28, 0.35, 0.48))
    PALE = mat("DanePale", (0.74, 0.77, 0.82))       # muzzle / chest / paws
    TAPE = mat("DaneTape", (0.88, 0.85, 0.78))       # cream wraps
    GOLD = mat("Gold", (0.85, 0.62, 0.15))
    NOSE = mat("NoseDark", (0.10, 0.09, 0.10))
    EYE = mat("EyeAmber", (0.30, 0.17, 0.04))
    INN = mat("InnerEar", (0.85, 0.55, 0.52))

    # legs: long and thin; tape wraps on the shins like the design
    for sd, tag in SDS:
        capsule(f"Leg.{tag}", (0.0, sd * 0.055, 0.54), (0.01, sd * 0.058, 0.30),
                0.030, COAT)
        capsule(f"Shin.{tag}", (0.01, sd * 0.058, 0.30),
                (0.005, sd * 0.060, 0.07), 0.024, COAT)
        capsule(f"ShinWrap.{tag}", (0.008, sd * 0.059, 0.22),
                (0.006, sd * 0.060, 0.10), 0.031, TAPE)
        sphere(f"Foot.{tag}", (0.035, sd * 0.060, 0.036), (0.078, 0.044, 0.032),
               PALE)
    # torso: slim, deep chest
    sphere("Body", (0, 0, 0.615), (0.155, 0.105, 0.185), COAT, seg=40, rings=28)
    sphere("Hips", (-0.01, 0, 0.53), (0.130, 0.095, 0.110), COAT)
    sphere("ChestPatch", (0.115, 0, 0.60), (0.055, 0.060, 0.100), PALE)
    # long neck + chain with medallion
    capsule("Neck", (0.03, 0, 0.70), (0.055, 0, 0.845), 0.052, COAT)
    torus("Chain", (0.05, 0, 0.745), 0.082, 0.017, GOLD, rot=(0.35, 0, 0))
    sphere("Medallion", (0.145, 0, 0.685), (0.012, 0.034, 0.034), GOLD,
           seg=24, rings=18)
    # head: skull + long pale snout
    sphere("Skull", (0.065, 0, 0.905), (0.105, 0.092, 0.098), COAT,
           seg=40, rings=28)
    sphere("Snout", (0.155, 0, 0.862), (0.095, 0.058, 0.052), PALE,
           seg=32, rings=24)
    sphere("Jaw", (0.140, 0, 0.812), (0.075, 0.050, 0.030), PALE)
    sphere("Nose", (0.238, 0, 0.878), (0.030, 0.036, 0.024), NOSE,
           seg=20, rings=14)
    for sd, tag in SDS:
        sphere(f"Eye.{tag}", (0.128, sd * 0.048, 0.918), (0.020, 0.026, 0.034),
               EYE, seg=20, rings=14)
        # huge floppy ears hanging beside the head, pink inner face
        sphere(f"Ear.{tag}", (-0.005, sd * 0.098, 0.845),
               (0.052, 0.020, 0.145), DARK, seg=28, rings=20)
        sphere(f"EarInner.{tag}", (0.014, sd * 0.106, 0.850),
               (0.038, 0.008, 0.105), INN, seg=20, rings=14)
    # arms: thin, tape-wrapped forearms
    for sd, tag in SDS:
        capsule(f"Arm.{tag}", (0.01, sd * 0.105, 0.71),
                (0.015, sd * 0.125, 0.565), 0.027, COAT)
        capsule(f"Forearm.{tag}", (0.015, sd * 0.125, 0.565),
                (0.02, sd * 0.138, 0.435), 0.022, COAT)
        capsule(f"ArmWrap.{tag}", (0.017, sd * 0.129, 0.525),
                (0.019, sd * 0.135, 0.455), 0.028, TAPE)
        sphere(f"Paw.{tag}", (0.025, sd * 0.142, 0.40), (0.045, 0.042, 0.050),
               PALE)
    # long thin tail, hanging with a slight curve
    capsule("Tail.0", (-0.10, 0, 0.545), (-0.175, 0, 0.625), 0.020, COAT)
    capsule("Tail.1", (-0.175, 0, 0.625), (-0.245, 0, 0.775), 0.015, COAT)
    return "Skull"

# ================================================================ BEAGLE
def build_beagle():
    BROWN = mat("BeagleBrown", (0.55, 0.35, 0.18))
    EARB = mat("BeagleEar", (0.40, 0.22, 0.10))
    BLACK = mat("BeagleBlack", (0.13, 0.11, 0.10))
    WHITE = mat("BeagleWhite", (0.95, 0.92, 0.85))
    COLLAR = mat("CollarBlack", (0.08, 0.08, 0.09))
    STEEL = mat("Steel", (0.72, 0.74, 0.78))
    NOSE = mat("NosePink", (0.32, 0.13, 0.12))
    EYE = mat("EyeBrown", (0.16, 0.08, 0.03))

    # huge round white belly, low on the torso
    sphere("Belly", (0.01, 0, 0.40), (0.270, 0.295, 0.235), WHITE,
           seg=44, rings=30)
    # brown upper body behind it, black saddle capping the back
    sphere("Body", (0, 0, 0.58), (0.200, 0.220, 0.160), BROWN, seg=40, rings=28)
    sphere("Saddle", (-0.055, 0, 0.615), (0.185, 0.205, 0.125), BLACK,
           seg=36, rings=26)
    # stub legs poking out under the belly, black shin wraps, white feet
    for sd, tag in SDS:
        capsule(f"Leg.{tag}", (0.0, sd * 0.160, 0.44),
                (0.005, sd * 0.163, 0.27), 0.058, BROWN)
        capsule(f"Shin.{tag}", (0.005, sd * 0.163, 0.27),
                (0.005, sd * 0.163, 0.10), 0.050, BROWN)
        capsule(f"ShinWrap.{tag}", (0.005, sd * 0.163, 0.15),
                (0.005, sd * 0.163, 0.075), 0.056, COLLAR)
        sphere(f"Foot.{tag}", (0.030, sd * 0.163, 0.035), (0.070, 0.050, 0.032),
               WHITE)
    # short arms at the chest sides, dark wrap band on the forearm
    for sd, tag in SDS:
        capsule(f"Arm.{tag}", (0.02, sd * 0.185, 0.665),
                (0.03, sd * 0.225, 0.585), 0.052, BROWN)
        capsule(f"Forearm.{tag}", (0.03, sd * 0.225, 0.585),
                (0.035, sd * 0.245, 0.515), 0.046, BROWN)
        capsule(f"ArmWrap.{tag}", (0.032, sd * 0.233, 0.565),
                (0.034, sd * 0.242, 0.525), 0.048, COLLAR)
        sphere(f"Paw.{tag}", (0.04, sd * 0.250, 0.475), (0.055, 0.050, 0.055),
               WHITE)
    # head: round brown skull, black patch over the top, white blaze+muzzle
    sphere("Skull", (0.01, 0, 0.85), (0.168, 0.175, 0.148), BROWN,
           seg=44, rings=30)
    sphere("HeadPatch", (0.005, 0.05, 0.915), (0.140, 0.120, 0.095), BLACK,
           seg=32, rings=24)
    sphere("Blaze", (0.150, 0, 0.865), (0.050, 0.032, 0.095), WHITE,
           seg=24, rings=18)
    sphere("Muzzle", (0.130, 0, 0.765), (0.085, 0.095, 0.062), WHITE,
           seg=32, rings=24)
    sphere("Nose", (0.205, 0, 0.80), (0.030, 0.037, 0.024), NOSE,
           seg=20, rings=14)
    for sd, tag in SDS:
        sphere(f"Eye.{tag}", (0.135, sd * 0.078, 0.85), (0.027, 0.036, 0.047),
               EYE, seg=24, rings=18)
        # long floppy ears down past the jaw
        sphere(f"Ear.{tag}", (0.0, sd * 0.172, 0.72), (0.068, 0.027, 0.175),
               EARB, seg=32, rings=22)
    # spiked collar right under the jaw
    torus("Collar", (0.01, 0, 0.685), 0.148, 0.034, COLLAR)
    spike_ring((0.01, 0), 0.175, 0.685, 10, 0.020, 0.060, STEEL)
    # little tail sticking out behind, white tip
    capsule("Tail.0", (-0.115, 0.02, 0.545), (-0.205, 0.03, 0.63), 0.030,
            BROWN)
    capsule("Tail.1", (-0.205, 0.03, 0.63), (-0.295, 0.04, 0.795), 0.026,
            WHITE)
    return "Skull"

# ================================================================ BULLDOG
def build_bulldog():
    WHITE = mat("BullWhite", (0.93, 0.91, 0.87))
    BRIN = mat("Brindle", (0.42, 0.28, 0.16))
    VEST = mat("VestBlack", (0.09, 0.09, 0.11))
    BELT = mat("BeltBlack", (0.06, 0.06, 0.07))
    STEEL = mat("ChainSteel", (0.55, 0.57, 0.62))
    NOSE = mat("NoseBrown", (0.25, 0.15, 0.12))
    EYE = mat("EyeDark", (0.13, 0.07, 0.04))
    FANG = mat("Fang", (0.97, 0.95, 0.90))

    # stocky legs, black shin wraps
    for sd, tag in SDS:
        capsule(f"Leg.{tag}", (0.0, sd * 0.105, 0.50),
                (0.01, sd * 0.108, 0.28), 0.062, WHITE)
        capsule(f"Shin.{tag}", (0.01, sd * 0.108, 0.28),
                (0.005, sd * 0.110, 0.09), 0.052, WHITE)
        capsule(f"ShinWrap.{tag}", (0.007, sd * 0.109, 0.175),
                (0.006, sd * 0.110, 0.08), 0.058, VEST)
        sphere(f"Foot.{tag}", (0.035, sd * 0.110, 0.035), (0.080, 0.055, 0.035),
               WHITE)
    # broad white torso; black vest sphere caps back/sides/shoulders,
    # shifted back so the white chest and belly front stay visible
    sphere("Body", (0, 0, 0.60), (0.165, 0.200, 0.185), WHITE, seg=44, rings=30)
    sphere("Vest", (-0.018, 0, 0.665), (0.178, 0.212, 0.135), VEST,
           seg=40, rings=28)
    torus("Belt", (0, 0, 0.475), 0.155, 0.018, BELT, scale=(0.82, 1.0, 1.0))
    # brindle patch on one thigh (the design's marked leg)
    sphere("LegPatch", (0.0, -0.115, 0.38), (0.060, 0.040, 0.070), BRIN)
    # chunky steel chain
    torus("Chain", (0.01, 0, 0.775), 0.155, 0.030, STEEL, rot=(0.25, 0, 0))
    # head: big skull, jowl cheeks, muzzle, underbite jaw with fangs
    sphere("Skull", (0.01, 0, 0.865), (0.155, 0.168, 0.125), WHITE,
           seg=48, rings=32)
    sphere("HeadPatch", (0.0, 0.075, 0.90), (0.130, 0.105, 0.095), BRIN,
           seg=36, rings=26)
    for sd, tag in SDS:
        sphere(f"Jowl.{tag}", (0.085, sd * 0.088, 0.775),
               (0.095, 0.075, 0.080), WHITE, seg=32, rings=24)
    sphere("Muzzle", (0.125, 0, 0.775), (0.085, 0.105, 0.060), WHITE,
           seg=36, rings=26)
    sphere("Jaw", (0.155, 0, 0.715), (0.070, 0.090, 0.032), WHITE,
           seg=32, rings=22)
    for sd, tag in SDS:
        cone(f"Fang.{tag}", (0.190, sd * 0.045, 0.748), 0.009, 0.0, 0.028,
             FANG, seg=10)
        sphere(f"Eye.{tag}", (0.125, sd * 0.072, 0.875), (0.022, 0.030, 0.038),
               EYE, seg=24, rings=18)
        # small folded ears, brindle
        sphere(f"Ear.{tag}", (-0.03, sd * 0.115, 0.955), (0.055, 0.028, 0.050),
               BRIN, seg=24, rings=18)
    sphere("Nose", (0.200, 0, 0.830), (0.032, 0.042, 0.024), NOSE,
           seg=20, rings=14)
    # thick arms with black forearm wraps; brindle patch on one shoulder
    for sd, tag in SDS:
        capsule(f"Arm.{tag}", (0.01, sd * 0.185, 0.685),
                (0.015, sd * 0.215, 0.545), 0.068, WHITE)
        capsule(f"Forearm.{tag}", (0.015, sd * 0.215, 0.545),
                (0.02, sd * 0.225, 0.425), 0.058, WHITE)
        capsule(f"ArmWrap.{tag}", (0.017, sd * 0.219, 0.515),
                (0.019, sd * 0.223, 0.445), 0.065, VEST)
        sphere(f"Paw.{tag}", (0.025, sd * 0.230, 0.385), (0.055, 0.052, 0.055),
               WHITE)
    sphere("ArmPatch", (0.0, 0.190, 0.635), (0.070, 0.050, 0.080), BRIN)
    # nub tail
    capsule("Tail.0", (-0.085, 0, 0.545), (-0.155, 0, 0.62), 0.030, WHITE)
    return "Skull"

BUILDERS = {"dane": build_dane, "beagle": build_beagle,
            "bulldog": build_bulldog}
active_name = BUILDERS[DOG]()

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects[active_name]
bpy.ops.object.join()
dog = bpy.context.view_layer.objects.active
dog.name = f"Dog-{DOG}"
print(f"DOG {DOG} verts:", len(dog.data.vertices), "materials:",
      [m.name if m else None for m in dog.data.materials])

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB",
                          export_animations=False, export_skins=False)
print("DOG_RAW written:", OUT)

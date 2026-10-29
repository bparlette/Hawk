#!/usr/bin/env python3
"""
make_miso_ninja.py -- make_miso_biped.py plus the locked NINJA design
(headband + plate, wraps, flat chest strap, hip pouch; v2: neck scarf
and bell dropped per Cherie's no-scarf design master).
Exports UNRIGGED as miso-ninja-biped.glb, ready for rig_biped.py.

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
from math import pi, sqrt
import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "miso-ninja-biped.glb")

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
CHARCOAL = mat("NinjaCharcoal", (0.16, 0.15, 0.17))  # wraps / strap / pouch
GOLD = mat("BellGold", (0.96, 0.70, 0.18))
GOLD_D = mat("BellGoldDark", (0.60, 0.41, 0.10))
STEEL = mat("PlateSteel", (0.80, 0.82, 0.85))
STEEL_D = mat("PlateSteelDark", (0.40, 0.42, 0.46))

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

def cyl(name, p1, p2, r, material, seg=24):
    """Plain cylinder between two points (wrap bands, emblem disc)."""
    a, b = Vector(p1), Vector(p2)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length,
                                        vertices=seg, location=(a + b) / 2)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(b - a)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(ob, material)

def box(name, loc, dims, material, rot=(0, 0, 0), bevel=0.0):
    """Rounded box: unit cube scaled to dims, optional bevel."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.scale = dims
    ob.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        mod = ob.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(ob, material)

def ellip(name, p1, p2, r_side, r_flat, material):
    """Flattened ellipsoid stretched between two points (ribbons)."""
    a, b = Vector(p1), Vector(p2)
    d = b - a
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=24,
                                         ring_count=16, location=(a + b) / 2)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.scale = (d.length / 2, r_side, r_flat)
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = Vector((1, 0, 0)).rotation_difference(d)
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
# v2 design (Cherie, Oct 28 late): neck scarf and bell DROPPED entirely
# -- bare neck, cream chest fully visible. The headband ribbons below
# stay (they belong to the headband, not the scarf).

# ================================================================ NINJA kit
# Anchored on the locked design illustration
# (media-generation-miso-ninja-*.png): green headband + steel forehead
# plate with yarn emblem, ribbon tails, charcoal wraps, chest strap.

# ---------------------------------------------------------------- headband
# Forehead band: horizontal torus fitted to the head's cross-section at
# z 0.812 (head radii there: x 0.215, y 0.281). Spans z 0.764..0.860 --
# clears the eye tops (0.723) and tucks just under the ear bases (0.86).
torus("Headband", (0, 0, 0.812), 0.272, 0.032, GREEN,
      scale=(0.815, 1.045, 1.15))

# steel forehead plate, centred on the band's front
box("Plate", (0.253, 0, 0.812), (0.020, 0.128, 0.068), STEEL, bevel=0.007)
for ry in (-0.048, 0.048):
    for rz in (0.792, 0.832):
        sphere("PlateRivet", (0.264, ry, rz), (0.006, 0.006, 0.006),
               STEEL_D, seg=12, rings=8)
# yarn emblem: dark disc + two groove rings on the plate face
cyl("Emblem", (0.261, 0, 0.812), (0.269, 0, 0.812), 0.021, STEEL_D)
torus("EmblemRing1", (0.268, 0, 0.812), 0.0135, 0.0028, STEEL_D,
      rot=(0, pi / 2, 0))
torus("EmblemRing2", (0.268, 0, 0.812), 0.007, 0.0025, STEEL_D,
      rot=(0, pi / 2, 0))

# ribbon tails at the back-left of the head, wind-blown
sphere("BandKnot", (-0.190, 0.198, 0.815), (0.036, 0.036, 0.030), GREEN_D,
       seg=20, rings=14)
ellip("RibbonA", (-0.200, 0.205, 0.830), (-0.345, 0.275, 0.945),
      0.034, 0.013, GREEN)
ellip("RibbonB", (-0.200, 0.210, 0.800), (-0.335, 0.285, 0.715),
      0.030, 0.012, GREEN_D)

# ---------------------------------------------------------------- wraps
# charcoal bands MID-SEGMENT on each forearm and shin (never across the
# elbow/knee), slightly proud of the limb capsule so skinning carries
# them with the limb instead of tearing them.
def _lerp(p, q, t):
    return tuple(p[i] + (q[i] - p[i]) * t for i in range(3))

for sd, tag in ((+1, "L"), (-1, "R")):
    A = (0.01, sd * 0.168, 0.435)          # arm capsule top
    Bp = (0.02, sd * 0.198, 0.315)         # arm capsule bottom (paw base)
    for i, tc in enumerate((0.60, 0.80)):
        c = _lerp(A, Bp, tc)
        d = tuple((Bp[i] - A[i]) * 0.09 for i in range(3))
        cyl(f"WrapArm.{tag}.{i}",
            tuple(c[i] - d[i] for i in range(3)),
            tuple(c[i] + d[i] for i in range(3)), 0.052, CHARCOAL)
    A = (0.005, sd * 0.082, 0.205)         # leg capsule top
    Bp = (0.01, sd * 0.085, 0.055)         # leg capsule bottom (ankle)
    for i, tc in enumerate((0.52, 0.72)):
        c = _lerp(A, Bp, tc)
        d = tuple((Bp[i] - A[i]) * 0.09 for i in range(3))
        cyl(f"WrapShin.{tag}.{i}",
            tuple(c[i] - d[i] for i in range(3)),
            tuple(c[i] + d[i] for i in range(3)), 0.060, CHARCOAL)

# ---------------------------------------------------------------- chest strap
# ONE flat slim band (v2 fix: the v1 strap was 7 ellipsoid beads that
# read as a chunky sausage chain across the belly). A ribbon strip
# sampled along the diagonal, back face sunk into the torso, front face
# ~0.011 proud of the surface, so it lies ON the chest/belly like the
# art. Direction matches the locked art: his RIGHT shoulder -> his LEFT
# hip, ending at the pouch.
def _surf_x(y, z):
    vals = []
    t = 1 - (y / 0.178) ** 2 - ((z - 0.325) / 0.195) ** 2
    if t > 0:
        vals.append(0.150 * sqrt(t))                    # body ellipsoid
    t = 1 - (y / 0.088) ** 2 - ((z - 0.315) / 0.105) ** 2
    if t > 0:
        vals.append(0.118 + 0.058 * sqrt(t))            # belly patch
    return max(vals) if vals else 0.10

def strap_band():
    N = 28
    HW = 0.028                       # half width -> 0.056 slim band
    dy, dz = 0.21, -0.17
    L = sqrt(dy * dy + dz * dz)
    ey, ez = (-dz / L) * HW, (dy / L) * HW   # in-plane perpendicular
    verts, faces = [], []
    for i in range(N):
        t = i / (N - 1)
        by = -0.105 + dy * t
        bz = 0.445 + dz * t
        xs = _surf_x(by, bz)
        xf, xb = xs + 0.011, xs - 0.012
        verts += [(xf, by - ey, bz - ez), (xf, by + ey, bz + ez),
                  (xb, by - ey, bz - ez), (xb, by + ey, bz + ez)]
    for i in range(N - 1):
        a, b = 4 * i, 4 * (i + 1)
        faces += [(a, b, b + 1, a + 1), (a + 3, b + 3, b + 2, a + 2),
                  (a + 2, b + 2, b, a), (a + 1, b + 1, b + 3, a + 3)]
    e = 4 * (N - 1)
    faces += [(0, 1, 3, 2), (e, e + 2, e + 3, e + 1)]
    me = bpy.data.meshes.new("StrapMesh")
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new("Strap", me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(CHARCOAL)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob

strap_band()

# pouch at his LEFT hip (matches the locked art) + lid + gold clasp;
# smaller and flatter than the v1 blob so the cream belly stays visible
box("Pouch", (0.030, 0.185, 0.232), (0.048, 0.034, 0.062), CHARCOAL,
    bevel=0.008)
box("PouchLid", (0.030, 0.185, 0.255), (0.052, 0.038, 0.016), CHARCOAL,
    bevel=0.005)
sphere("PouchClasp", (0.057, 0.185, 0.242), (0.007, 0.009, 0.009), GOLD,
       seg=12, rings=8)

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

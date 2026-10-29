#!/usr/bin/env python3
"""
miso_look.py -- LOOK pass on the already-rigged test cat. (v2)

Loads test-cat-rigged-walk.glb (18-bone rig + Walk, KEEP both), paints it
as Miso by ANATOMICAL REGION (face-level material assignment, zones use the
same forward/height frame math as rig_cat.py), adds a green scarf skinned
100% to the neck bone so it rides the walk, exports test-cat-miso-look.glb
and renders proof stills at walk phases 0/25/50% (Cycles, same lighting
recipe as the original rig/stills so colors are directly comparable).

The test cat is BLOCKY (Quaternius): body cube s +/-0.167, z 0.121-0.358;
head cube s +/-0.107 from f~0.86; muzzle box at f>0.94. So the scarf is a
BOX band around the head/body seam (a torus cannot hug a cube), and the
belly/chest cream rules are centre-strip only, so the chunky legs' step
ledges don't get creamed.

Colors sampled from miso-reference-upscaled.png (bucketed pixel census):
  coat orange  #F2A03C  (dominant sprite buckets #F0A040 / #F09030)
  dark orange  #C96A1E  (tabby bands)
  cream        #F7EAD7  (muzzle / chest / belly / paws)
  scarf green  #3FA34D  (sprite green cluster #50A040, shaded family)
"""
import sys, os, json, math
import bpy
import numpy as np
from mathutils import Vector, Matrix

RIG = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(RIG, "test-cat-rigged-walk.glb")
DST = os.path.join(RIG, "test-cat-miso-look.glb")
STILLS = os.path.join(RIG, "stills-miso-look")
os.makedirs(STILLS, exist_ok=True)

def srgb(r, g, b):
    """sRGB 0-1 -> linear 0-1 (Blender color properties are linear; feeding
    sRGB values raw renders everything washed-out tan/mint)."""
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)

COAT  = srgb(0.949, 0.627, 0.235)   # #F2A03C
DARK  = srgb(0.788, 0.416, 0.118)   # #C96A1E
CREAM = srgb(0.969, 0.918, 0.843)   # #F7EAD7
GREEN = srgb(0.247, 0.639, 0.302)   # #3FA34D

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for ob in list(bpy.data.objects):
    if ob.name.startswith("Icosphere"):
        bpy.data.objects.remove(ob, do_unlink=True)
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("mesh:", mesh.name, "armature:", arm.name)

# ---------------------------------------------------------------- frame
def read_verts():
    v = np.empty(len(mesh.data.vertices) * 3, dtype=np.float64)
    mesh.data.vertices.foreach_get("co", v)
    return v.reshape(-1, 3)

verts = read_verts()
mn, mx = verts.min(axis=0), verts.max(axis=0)
size = mx - mn
ctr = (mn + mx) / 2.0
ground = float(mn[2])
body_top = float(np.percentile(verts[:, 2], 92))
height = body_top - ground

heads = [b.head_local for b in arm.data.bones
         if b.name.lower().startswith(("head", "neck"))]
tails = [b.head_local for b in arm.data.bones
         if b.name.lower().startswith("tail")]
h = sum((v for v in heads), Vector()) / len(heads)
t = sum((v for v in tails), Vector()) / len(tails)
d = h - t; d.z = 0.0
F = np.array([d.x, d.y, 0.0]); F /= np.linalg.norm(F)
S = np.array([-F[1], F[0], 0.0])
U = np.array([0.0, 0.0, 1.0])
print("forward:", F, "size:", [round(float(x), 3) for x in size],
      "height:", round(height, 3))

fpos = verts @ F
fmin, fmax = float(fpos.min()), float(fpos.max())
flen = fmax - fmin
half_w = 0.5 * float((verts @ S).max() - (verts @ S).min())

def station(f_frac):
    """Point on the body axis at length fraction f_frac (z filled later)."""
    return F * (fmin + f_frac * flen)

# ---------------------------------------------------------------- materials
def make_mat(name, rgba):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.85
    return m

M_COAT = make_mat("MisoCoat", COAT)
M_DARK = make_mat("MisoDarkStripes", DARK)
M_CREAM = make_mat("MisoCream", CREAM)
M_SCARF = make_mat("MisoScarf", GREEN)
mesh.data.materials.clear()
for m in (M_COAT, M_DARK, M_CREAM):
    mesh.data.materials.append(m)
IDX = {"coat": 0, "dark": 1, "cream": 2}

# Old Quaternius vertex colors would tint the new materials in some
# viewers; drop them so the look is purely the region materials.
for attr in list(mesh.data.color_attributes):
    mesh.data.color_attributes.remove(attr)

# ---------------------------------------------------------------- regions
def in_bands(x, bands):
    return any(lo <= x <= hi for lo, hi in bands)

BACK_BANDS = [(0.30, 0.38), (0.46, 0.54), (0.62, 0.70)]
TAIL_BANDS = [(0.13, 0.18), (0.05, 0.10)]

counts = {"coat": 0, "dark": 0, "cream": 0}
for poly in mesh.data.polygons:
    idx = list(poly.vertices)
    fc = verts[idx].mean(axis=0)
    f = float((fc @ F - fmin) / flen)
    zr = float((fc[2] - ground) / height)
    s = abs(float(fc @ S))
    nz = float(poly.normal.z)
    region = "coat"
    # tabby bands: back top + upright tail
    if (zr > 0.84 and nz > 0.25 and in_bands(f, BACK_BANDS)) or \
       (zr > 0.80 and in_bands(f, TAIL_BANDS)):
        region = "dark"
    # muzzle box + lower face / jaw
    elif (f >= 0.965 and zr <= 0.98) or (f >= 0.92 and zr <= 0.78):
        region = "cream"
    # throat + chest: front of the shoulder line, centred strip only
    elif 0.84 <= f <= 0.95 and zr <= 0.62 and s < 0.50 * half_w:
        region = "cream"
    # belly: strongly downward faces, centre strip only
    elif nz < -0.5 and zr <= 0.45 and 0.15 <= f <= 0.85 and s < 0.55 * half_w:
        region = "cream"
    # paw tips
    elif zr <= 0.14 and f <= 0.90:
        region = "cream"
    poly.material_index = IDX[region]
    counts[region] += 1
print("region face counts:", counts)

# ---------------------------------------------------------------- scarf
# Box band around the head/body seam (f ~ 0.862, measured sections:
# head s +/-0.107 z 0.129-0.358; body s +/-0.167). Band is wider/taller
# than the head, narrower than the body; its rear sinks into the body
# front face, which reads as attached and hides the seam.
band_c = station(0.862); band_c[2] = 0.202
band_dims = (0.238, 0.05, 0.19)          # (S width, F thickness, U height)
flap_c = station(0.90); flap_c[2] = 0.115
flap_dims = (0.085, 0.018, 0.08)         # (S width, F thickness, U length)

def box(center, dims, tilt_deg=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    ob = bpy.context.view_layer.objects.active
    basis = Matrix.Identity(4)
    basis.col[0][:3] = Vector(S) * dims[0]
    basis.col[1][:3] = Vector(F) * dims[1]
    basis.col[2][:3] = Vector(U) * dims[2]
    M = Matrix.Translation(Vector(center)) \
        @ Matrix.Rotation(math.radians(tilt_deg), 4, Vector(S)) @ basis
    ob.data.transform(M)
    ob.matrix_world = Matrix.Identity(4)
    return ob

bpy.ops.object.select_all(action="DESELECT")
band = box(band_c, band_dims)
flap = box(flap_c, flap_dims, tilt_deg=12.0)
band.select_set(True); flap.select_set(True)
bpy.context.view_layer.objects.active = band
bpy.ops.object.join()
scarf = bpy.context.view_layer.objects.active
scarf.name = "Scarf"
scarf.data.materials.append(M_SCARF)
print("scarf band centre:", [round(float(x), 3) for x in band_c],
      "dims:", band_dims)

# Skin scarf 100% to the neck bone: same mechanism as the body, so it
# follows Walk exactly (neck sway + root bob included).
vg = scarf.vertex_groups.new(name="neck")
vg.add(list(range(len(scarf.data.vertices))), 1.0, "REPLACE")
mod = scarf.modifiers.new("CatRig", "ARMATURE")
mod.object = arm
scarf.parent = arm

# ---------------------------------------------------------------- export
for other in list(bpy.data.actions):
    if arm.animation_data and other != arm.animation_data.action:
        bpy.data.actions.remove(other)
bpy.ops.object.select_all(action="DESELECT")
for ob in (mesh, arm, scarf):
    ob.select_set(True)
bpy.context.view_layer.objects.active = arm
kw = dict(filepath=DST, export_format="GLB", export_animations=True,
          export_skins=True, export_all_influences=False,
          export_frame_range=False, use_selection=True)
try:
    bpy.ops.export_scene.gltf(export_animation_mode="ACTIONS", **kw)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("exported:", DST, os.path.getsize(DST), "bytes")

# ---------------------------------------------------------------- stills
# Same lighting/camera recipe as rig_cat.py (Cycles CPU + sun) so the
# stills are directly comparable with rig/stills/walk_phase*.png.
scene = bpy.context.scene
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.25, 0.25, 0.28, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
center = Vector(ctr) + Vector((0, 0, 0.1 * height))
dist = 2.4 * float(max(size))
off = (F * 0.85 + S * 1.0 + U * 0.42)
off = off / np.linalg.norm(off) * dist
cam.location = center + Vector(off)
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = False

# Ground disc AFTER export, same as the original stills.
bpy.ops.mesh.primitive_circle_add(radius=float(dist), fill_type="NGON",
                                  location=(ctr[0], ctr[1], ground + 0.001))
disc = bpy.context.view_layer.objects.active
gmat = bpy.data.materials.new("Ground")
gmat.diffuse_color = (0.16, 0.16, 0.18, 1)
disc.data.materials.append(gmat)

scene.render.resolution_x, scene.render.resolution_y = 640, 480
scene.render.image_settings.file_format = "PNG"
for label, fr in (("phase0", 1), ("phase25", 7), ("phase50", 13)):
    scene.frame_set(fr)
    scene.render.filepath = os.path.join(STILLS, f"walk_{label}.png")
    bpy.ops.render.render(write_still=True)

print("LOOK_RESULT " + json.dumps({
    "regions": counts, "output": DST,
    "scarf": {"type": "box band + flap", "bone": "neck",
              "band_dims": band_dims},
    "stills": STILLS,
}))

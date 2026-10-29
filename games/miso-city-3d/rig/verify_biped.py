#!/usr/bin/env python3
"""
verify_biped.py -- numeric proof for a rig_biped.py output GLB.

Imports the EXPORTED file fresh, finds the vertices most weighted to
foot.L / foot.R / hips / head, and tracks their evaluated world positions
across the walk cycle. A real biped gait shows:
  - each foot sweeping forward/back through a stride range,
  - each foot LIFTING (z peaks) mid-swing, out of phase with the other,
  - the pelvis bobbing twice per cycle,
  - the head staying comparatively steady.

Usage: blender --background --factory-startup --python verify_biped.py \
           -- RIGGED.glb [FORWARD_AXIS]   (FORWARD_AXIS: x or y, default x)
"""
import sys
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
FAX = 0 if (len(argv) < 2 or argv[1] == "x") else 1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

mesh = next(o for o in bpy.data.objects if o.type == "MESH")
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
act = arm.animation_data.action if arm.animation_data else None
print("action:", act.name if act else None,
      "| joints:", len(arm.data.bones))

def top_vertex(group_name):
    g = mesh.vertex_groups[group_name].index
    best, bw = -1, -1.0
    for v in mesh.data.vertices:
        for e in v.groups:
            if e.group == g and e.weight > bw:
                best, bw = v.index, e.weight
    return best, bw

track = {}
for name in ("foot.L", "foot.R", "hips", "head"):
    vi, w = top_vertex(name)
    track[name] = vi
    print(f"track {name}: vertex {vi} (rest weight {w:.2f})")

scene = bpy.context.scene
scene.render.fps = 24
frames = [1, 4, 7, 10, 13, 16, 19, 22, 25]
pos = {name: [] for name in track}
dg = bpy.context.evaluated_depsgraph_get()
for f in frames:
    scene.frame_set(f)
    bpy.context.view_layer.update()
    ev = mesh.evaluated_get(dg)
    for name, vi in track.items():
        co = ev.matrix_world @ ev.data.vertices[vi].co
        pos[name].append((co.x, co.y, co.z))

def arr(name):
    return np.array(pos[name])

for name in ("foot.L", "foot.R"):
    a = arr(name)
    print(f"{name}: forward sweep = {a[:, FAX].max() - a[:, FAX].min():.3f} m"
          f" | z range {a[:, 2].min():.3f}..{a[:, 2].max():.3f}"
          f" (lift {a[:, 2].max() - a[0, 2]:+.3f} vs frame 1)")
    print(f"   per-frame (fwd, z): "
          + " ".join(f"({p[FAX]:+.3f},{p[2]:.3f})" for p in pos[name]))
a = arr("hips")
print(f"hips: z range {a[:, 2].min():.3f}..{a[:, 2].max():.3f}"
      f" (bob amplitude ~{(a[:, 2].max() - a[:, 2].min()) / 2:.3f} m)")
a = arr("head")
print(f"head: forward drift range = {a[:, FAX].max() - a[:, FAX].min():.3f} m"
      f" | z range {a[:, 2].min():.3f}..{a[:, 2].max():.3f}")
l, r = arr("foot.L"), arr("foot.R")
corr = np.corrcoef(l[:, 2], r[:, 2])[0, 1]
print(f"foot z correlation L vs R: {corr:+.2f} (negative = alternating gait)")

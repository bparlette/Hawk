#!/usr/bin/env python3
"""verify_glb.py -- parse a GLB and report meshes, skin joints, actions.
Usage: python3 verify_glb.py FILE.glb [FILE.glb ...]"""
import json
import struct
import sys

for path in sys.argv[1:]:
    with open(path, "rb") as f:
        data = f.read()
    assert data[:4] == b"glTF", path
    jlen = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    meshes = gltf.get("meshes", [])
    skins = gltf.get("skins", [])
    anims = []
    for a in gltf.get("animations", []):
        dur = 0.0
        for ch in a.get("channels", []):
            sampler = a["samplers"][ch["sampler"]]
            acc = gltf["accessors"][sampler["input"]]
            dur = max(dur, acc.get("max", [0])[0])
        anims.append((a.get("name"), round(dur, 2)))
    nverts = 0
    for m in meshes:
        for p in m["primitives"]:
            nverts += gltf["accessors"][p["attributes"]["POSITION"]]["count"]
    print(f"{path}  ({len(data)} bytes)")
    print(f"  meshes={len(meshes)} verts={nverts} "
          f"skins={[(len(s['joints'])) for s in skins]} "
          f"nodes={len(gltf.get('nodes', []))}")
    print(f"  animations={anims}")

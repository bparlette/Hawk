# tools/qa_table.py — turn a shoot.mjs REPORT file (viewer frame jobs + the tools/qa.html job) into the README's measured
# tables. Usage: python3 tools/qa_table.py <report.json> [<before_report.json>]   With a second report it also prints a
# before -> after table. Every number printed here comes from the runs; nothing is typed in.
import json, sys
R = json.load(open(sys.argv[1]))
qa = next(x['report'] for x in R if x['report'] and 'members' in x['report'])
frames = {x['q']: x['report']['frame'] for x in R if x['report'] and 'frame' in x['report'] and 'show=' in x['q'] and x['out'] == ''}
errs = sum(len(x['errors']) for x in R)
cm = lambda v: f"{v * 100:.1f} cm"
m_ = lambda v: f"{v:.3f} m"
print(f"QA run: {len(R)} jobs, {errs} console errors/warnings. All acceptance checks: {'PASS' if qa['allPass'] else 'FAIL'}.\n")
print("| member | LOD | parts | tris | hull tris | hulls | materials | shadow casters | draw calls (meshes + hulls) | height | feet min y (idle) |")
print("|---|---|---|---|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    for lod in ('hd', 'lod'):
        b = v[lod]
        print(f"| {m} | {'HD' if lod == 'hd' else '1'} | {b['parts']} | {b['tris']:,} | {b['hullTris']:,} | {b['hulls']} | {b['mats']} | {b['casters']} | {b['drawCalls']} | {m_(b['height'])} | {m_(b['feetMinY'])} |")
print()
for q, f in frames.items():
    print(f"- Whole frame, all four members + ground, `{q}`: **{f['calls']} draw calls, {f['triangles']:,} triangles** (incl. shadow pass).")
print("\n**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`):\n")
print("| member | knock-down 60 fps | + animateGang | attack 60 fps | + animateGang | run 60 fps | + animateGang | pose sweeps | LOD 1 (knock-down / attack / run) |")
print("|---|---|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    s = v['sequences']; w = lambda k: f"{cm(s[k]['worst']['y'])} ({s[k]['worst']['part']}, {s[k]['worst']['phase']})" if k in s else 'n/a'
    l = v['lodSequences']
    print(f"| {m} | {w('knockdown')} | {w('knockdown+anim')} | {w('attack')} | {w('attack+anim')} | {w('run')} | {w('run+anim')} | {cm(v['sweeps']['worst']['y'])} ({v['sweeps']['worst']['part']}, {v['sweeps']['worst']['pose']}) | {cm(l['knockdown']['worst']['y'])} / {cm(l['attack']['worst']['y'])} / {cm(l['run']['worst']['y'])} |")
print("\n**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):\n")
print("| member | shoulder gap down L / R | shoulder gap windup L / R | tail min y, down(1,true) | tail min y, knock-down end | head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |")
print("|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    gd, gw, de, ke = v['shoulderGapDown'], v['shoulderGapWindup'], v['downEndSnapped'], v['sequences']['knockdown']['downEnd']
    print(f"| {m} | {cm(gd['L'])} / {cm(gd['R'])} | {cm(gw['L'])} / {cm(gw['R'])} | {cm(de.get('tail', float('nan')))} | {cm(ke.get('tail', float('nan')))} | {cm(de['head'])} | {cm(v['downEndSnappedMinY'])} |")
print("\n**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views):\n")
print("| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |")
print("|---|---|---|---|---|")
for m, v in qa['members'].items():
    hb = max(v['hullOverlap'], key=lambda x: x['buried']); hs = max(v['hullOverlap'], key=lambda x: x['maxStrayPx'])
    sv = max(hs['strayPx'], key=lambda k: hs['strayPx'][k]) if hs['strayPx'] else ''
    iou = v['silhouetteIoU']
    print(f"| {m} | {hb['buried'] * 100:.1f} % ({hb['part']}) | {hs['maxStrayPx']} ({hs['part']}, {sv}) | {len(v['hd']['shadowRule'])} / {len(v['lod']['shadowRule'])} | {iou['front']:.3f} / {iou['three']:.3f} / {iou['side']:.3f} |")
print("\n**The game's real `mergeRig()`** (`tools/game/04b_rig_merge.js`, run on the HD rig):\n")
print("| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre (r = 1.9) |")
print("|---|---|---|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    g = v['merge']; am = f"{g['animMoves']['moved_m'] * 100:.1f} cm ({g['animMoves']['tailVerts']} verts)" if g.get('animMoves') else 'n/a'
    edge = g['renderDiffPx'] - g['renderDiffInteriorPx']
    print(f"| {m} | {g['meshesBefore']} + {g['hullsBefore']} | {g['mergedMeshes']} ({g['mergedSolid']} + {g['mergedOutline']}) | {g['bones']} | {g['drawCalls']} + {g['shadowCalls']} | {g['maxVertexDy_m'] * 1000:.3f} mm | {g['flashPx']['unflashedPx']} of {g['flashPx']['rigPx']} | {am} | {g['renderDiffInteriorPx']} / {edge} (of {g['renderRigPx']}) | {v['cullReachMax']:.2f} m |")
if len(sys.argv) > 2:
    B = json.load(open(sys.argv[2])); qb = next(x['report'] for x in B if x['report'] and 'members' in x['report'])
    def row(v):
        lw = min(x['worst']['y'] for x in v['lodSequences'].values()); hw = min(x['worst']['y'] for x in v['sequences'].values())
        return (v['hd']['parts'], v['hd']['tris'], v['lod']['parts'], v['lod']['tris'], max(x['buried'] for x in v['hullOverlap']), max(x['maxStrayPx'] for x in v['hullOverlap']), hw, lw, min(v['silhouetteIoU'].values()))
    print(f"\n**Before → after** (`{sys.argv[2]}` → this run; both measured by this QA, real timings and real mergeRig):\n")
    print("| member | HD parts | HD tris | LOD parts | LOD tris | worst buried | worst stray px | HD ground worst | LOD ground worst | LOD IoU min |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for m in qa['members']:
        a, b = row(qb['members'][m]), row(qa['members'][m])
        f = [f"{a[0]} → {b[0]}", f"{a[1]:,} → {b[1]:,}", f"{a[2]} → {b[2]}", f"{a[3]:,} → {b[3]:,}", f"{a[4] * 100:.1f} % → {b[4] * 100:.1f} %", f"{a[5]} → {b[5]}", f"{cm(a[6])} → {cm(b[6])}", f"{cm(a[7])} → {cm(b[7])}", f"{a[8]:.3f} → {b[8]:.3f}"]
        print(f"| {m} | " + " | ".join(f) + " |")
print("\nPer-member pass flags (caps, margins, ground, shoulders, stray hulls, shadows, flash, hulls, merge, height, feet):", ', '.join(f"{m}: {'PASS' if all(v['pass'].values()) else 'FAIL ' + ','.join(k for k, x in v['pass'].items() if not x)}" for m, v in qa['members'].items()))

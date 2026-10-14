# tools/qa_table.py — turn a shoot.mjs REPORT file (viewer frame jobs + the tools/qa.html job) into the README's measured
# tables. Usage: python3 tools/qa_table.py <report.json> [<before_report.json>]   With a second report it also prints a
# before -> after table. Every number printed here comes from the runs; nothing is typed in.
import json, sys
R = json.load(open(sys.argv[1]))
qa = next(x['report'] for x in R if x['report'] and 'members' in x['report'])
frames = {x['q']: x['report']['frame'] for x in R if x['report'] and 'frame' in x['report'] and 'show=' in x['q'] and x['out'] == ''}
errs = sum(len(x['errors']) for x in R)
cm = lambda v: f"{(round(v * 100, 1) or 0.0):.1f} cm".replace("-", "−")   # no "-0.0"; true minus sign
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
print("\n**Ground clearance** (lowest non-hull vertex, worst frame; floor is −3.0 cm; feet and weapon exempt only in `down`; A = with animateGang):\n")
SEQS = [k for k in ('knockdown', 'attack', 'run', 'dizzy') if k in next(iter(qa['members'].values()))['sequences']]
print("| member | " + " | ".join(f"{k} 60 fps | {k} A" for k in SEQS) + " | pose sweeps | LOD 1 (" + " / ".join(SEQS) + ") |")
print("|---|" + "---|" * (2 * len(SEQS) + 2))
for m, v in qa['members'].items():
    s_ = v['sequences']; w = lambda k: f"{cm(s_[k]['worst']['y'])} ({s_[k]['worst']['part']}, {s_[k]['worst']['phase']})" if k in s_ else 'n/a'
    l = v['lodSequences']
    print(f"| {m} | " + " | ".join(f"{w(k)} | {w(k + '+anim')}" for k in SEQS) + f" | {cm(v['sweeps']['worst']['y'])} ({v['sweeps']['worst']['part']}, {v['sweeps']['worst']['pose']}) | " + " / ".join(cm(l[k]['worst']['y']) for k in SEQS) + " |")
if 'stars' in next(iter(qa['members'].values())):
    print("\n**Dizzy** (hurt → `THUG_POSES.dizzy` 3 s at rate 10 → chase; stars sprite at 2.2 × scale + 0.15 m above the root):\n")
    print("| member | stars height | clearance below stars HD (highest part) | with animateGang | LOD 1 | worst shoulder gap in dizzy L / R |")
    print("|---|---|---|---|---|---|")
    for m, v in qa['members'].items():
        st = v['stars']; g = v['shoulderGapDizzy']
        print(f"| {m} | {st['hd']['starsY']:.2f} m | {cm(st['hd']['clearance'])} ({st['hd']['part']}) | {cm(st['hdAnim']['clearance']) if st.get('hdAnim') else 'n/a'} | {cm(st['lod']['clearance'])} ({st['lod']['part']}) | {cm(g['L'])} / {cm(g['R'])} |")
print("\n**Down pose and shoulders** (`down(1, true)` snapped; knock-down end = last frame of the 60 fps `down` phase):\n")
W06 = 'shoulderGapWindup06' in next(iter(qa['members'].values()))
EARS = 'ears' in next(iter(qa['members'].values()))['downEndSnapped']
print("| member | shoulder gap down L / R | shoulder gap windup(1) L / R |" + (" windup(0.6) L / R |" if W06 else "") + " tail min y, down(1,true) | tail min y, knock-down end |" + (" ears min y, down(1,true) | tail / ears with animateGang |" if EARS else "") + " head min y, down(1,true) | min y excl. feet+weapon, down(1,true) |")
print("|---|---|---|---|---|---|---|" + ("---|" if W06 else "") + ("---|---|" if EARS else ""))
for m, v in qa['members'].items():
    gd, gw, de, ke = v['shoulderGapDown'], v['shoulderGapWindup'], v['downEndSnapped'], v['sequences']['knockdown']['downEnd']
    w6 = f" {cm(v['shoulderGapWindup06']['L'])} / {cm(v['shoulderGapWindup06']['R'])} |" if W06 else ""
    da = v.get('downEndSnappedAnim', {}); ea = f" {cm(de['ears'])} | {cm(da['tail'])} / {cm(da['ears'])} |" if EARS and da else (" n/a | n/a |" if EARS else "")
    print(f"| {m} | {cm(gd['L'])} / {cm(gd['R'])} | {cm(gw['L'])} / {cm(gw['R'])} |{w6} {cm(de.get('tail', float('nan')))} | {cm(ke.get('tail', float('nan')))} |{ea} {cm(de['head'])} | {cm(v['downEndSnappedMinY'])} |")
print("\n**Outlines, shadows, LOD silhouette** (buried = share of a part's surface inside other outlined parts; stray ink rendered at 6 m, 256², 4 views, in idle and both dizzy sway extremes):\n")
print("| member | worst buried share (part) | worst stray ink px (part, view) | shadow-rule violations HD / LOD | LOD IoU front / 3/4 / side |")
print("|---|---|---|---|---|")
for m, v in qa['members'].items():
    hb = max(v['hullOverlap'], key=lambda x: x['buried']); hs = max(v['hullOverlap'], key=lambda x: x['maxStrayPx'])
    sv = max(hs['strayPx'], key=lambda k: hs['strayPx'][k]) if hs['strayPx'] else ''
    iou = v['silhouetteIoU']
    print(f"| {m} | {hb['buried'] * 100:.1f} % ({hb['part']}) | {hs['maxStrayPx']} ({hs['part']}, {sv}) | {len(v['hd']['shadowRule'])} / {len(v['lod']['shadowRule'])} | {iou['front']:.3f} / {iou['three']:.3f} / {iou['side']:.3f} |")
print("\n**The game's real `mergeRig()`** (" + ("`kit/real_mergeRig.js`, the ZIP's copy" if qa.get('kit', '').startswith('zip') else "`tools/game/04b_rig_merge.js`") + ", run on the HD rig):\n")
print("| member | meshes + hulls before | merged meshes (solid + outline) | bones | draw calls + shadow calls | max vertex Δ merged vs parts (7 poses) | flash: unflashed px of rig px (flash 0.85) | animateGang moves merged tail | render diff px: interior / edge (of rig px) | farthest vertex from culling sphere centre, all sequences (pass: r = " + str(qa.get('cullRadius', 2.6)) + (f"; info: ZIP kit r = {qa['cullRadiusZip']}" if 'cullRadiusZip' in qa else '') + ") |")
print("|---|---|---|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    g = v['merge']; am = f"{g['animMoves']['moved_m'] * 100:.1f} cm ({g['animMoves']['tailVerts']} verts)" if g.get('animMoves') else 'n/a'
    edge = g['renderDiffPx'] - g['renderDiffInteriorPx']
    print(f"| {m} | {g['meshesBefore']} + {g['hullsBefore']} | {g['mergedMeshes']} ({g['mergedSolid']} + {g['mergedOutline']}) | {g['bones']} | {g['drawCalls']} + {g['shadowCalls']} | {g['maxVertexDy_m'] * 1000:.3f} mm | {g['flashPx']['unflashedPx']} of {g['flashPx']['rigPx']} | {am} | {g['renderDiffInteriorPx']} / {edge} (of {g['renderRigPx']}) | {v['cullReachMax']:.2f} m" + (f" ({'inside' if v['cullReachMax'] <= qa['cullRadiusZip'] else 'outside'} 1.9)" if 'cullRadiusZip' in qa else '') + " |")
if 'idleReach' in next(iter(qa['members'].values())):
    print("\n**Idle reach and determinism** (reach = farthest non-hull vertex from the root's vertical axis over idle t = 0 .. 2 s at 15 fps, weapon excepted, minus META.radius; hash = every part's world vertices, colours and joint transforms after `idle(0)`):\n")
    print("| member | META.radius | farthest reach (part) | beyond radius (limit 0.35 m) | hash seed 7 (twice) | HD and LOD same seed → same hash | seed 8 hash (differs) |")
    print("|---|---|---|---|---|---|---|")
    for m, v in qa['members'].items():
        r, d = v['idleReach'], v['determinism']
        print(f"| {m} | {r['radius_m']:.2f} m | {r['reach_m']:.3f} m ({r['part']}, t = {r.get('t', 0):.2f} s) | {r['beyond_m']:.3f} m | `{d['hashSeed7']}` | {'yes' if d['same'] and d['sameLod'] else 'NO'} | `{d['hashSeed8']}` ({'yes' if d['seedChangesRig'] else 'no'}) |")
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

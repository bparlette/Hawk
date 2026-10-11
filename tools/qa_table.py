# tools/qa_table.py — turn a shoot.mjs REPORT file (viewer frame jobs + the tools/qa.html job) into the README's measured
# tables. Usage: python3 tools/qa_table.py <report.json>    Every number printed here comes from the run; nothing is typed in.
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
print("\n**Outlines, shadows, merge, LOD silhouette**:\n")
print("| member | worst buried share (part) | worst stray ink px @6 m (part, view) | shadow-rule violations HD / LOD | mergeRig: meshes before → after, hulls after | flash shared + covers after merge | mapped sub-materials | animateGang moves merged tail | LOD IoU front / 3/4 / side |")
print("|---|---|---|---|---|---|---|---|---|")
for m, v in qa['members'].items():
    hb = max(v['hullOverlap'], key=lambda x: x['buried']); hs = max(v['hullOverlap'], key=lambda x: x['maxStrayPx'])
    sv = max(hs['strayPx'], key=lambda k: hs['strayPx'][k]) if hs['strayPx'] else ''
    mg = v['merge']; iou = v['silhouetteIoU']
    am = f"yes, {cm(mg['animMoves']['moved_m'])}" if mg['animMoves'] else 'n/a'
    print(f"| {m} | {hb['buried'] * 100:.1f} % ({hb['part']}) | {hs['maxStrayPx']} ({hs['part']}, {sv}) | {len(v['hd']['shadowRule'])} / {len(v['lod']['shadowRule'])} | {mg['meshesBefore']} → {mg['meshesAfter']}, {mg['hullsAfter']} | {'yes' if mg['flashShared'] and mg['flashCovers'] else 'NO'} | {mg['mappedSubMaterials']} | {am} | {iou['front']:.3f} / {iou['three']:.3f} / {iou['side']:.3f} |")
print("\nPer-member pass flags:", ', '.join(f"{m}: {'PASS' if all(v['pass'].values()) else 'FAIL ' + ','.join(k for k, x in v['pass'].items() if not x)}" for m, v in qa['members'].items()))

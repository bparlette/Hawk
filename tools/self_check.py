# tools/self_check.py — fill the brief's §7 self-check table from the measured runs; nothing is typed in.
# Usage: python3 tools/self_check.py <report.json> <results_gang.json> [<previews_report.json>]
#   report.json           shoot.mjs REPORT of tools/previews_key_hwy_otters.json: the kit/real_viewer.html renders (with
#                         window.__report.seq.minY and console output) and the tools/qa.html job (?gang=key_hwy_otters&kit=zip...)
#   results_gang.json     harness/measure_gang.mjs output (Hark's harness, run unchanged)
#   previews_report.json  optional: the renders' REPORT when they were run separately from the QA job
import json, sys
def qa_of(path): R = json.load(open(path)); return next(x['report'] for x in R if x['report'] and 'members' in x['report'])
qa = qa_of(sys.argv[1]); H = json.load(open(sys.argv[2])); P = json.load(open(sys.argv[3] if len(sys.argv) > 3 else sys.argv[1]))
M = list(qa['members'])
cm = lambda v: f"{(round(v * 100, 1) or 0.0):.1f} cm".replace("-", "−")   # no "-0.0"; true minus sign
m_ = lambda v: f"{v:.3f} m"
def seq_min(member, lod=False):
    # real_viewer &seq=knockdown, one rig per job; window.__report.seq.minY = { rig id: lowest non-hull y, feet + weapon excepted }
    for x in P:
        q = x['q']
        if 'seq=knockdown' in q and f'show=key_hwy_otters.{member}&' in q + '&' and ('lod=1' in q) == lod and 'merge=1' not in q and x['report']:
            v = list(x['report']['seq']['minY'].values()); return min(v) if v else None
def lineup_seq_min(member, lod):
    for x in P:
        q = x['q']
        if 'seq=knockdown' in q and 'show=key_hwy_otters&' in q + '&' and ('lod=1' in q) == lod and x['report']:
            return x['report']['seq']['minY'].get(f'key_hwy_otters.{member}')   # keyed by rig id
day = [x for x in P if x['q'].startswith('mods=') and 'night=1' not in x['q']]; night = [x for x in P if x['q'].startswith('mods=') and 'night=1' in x['q']]
errs_day, errs_night = sum(len(x['errors']) for x in day), sum(len(x['errors']) for x in night)
rows = []
def row(name, f, thr): rows.append(f"| {name} | " + " | ".join(f(m) for m in M) + f" | {thr} |")
row('HD parts / tris / materials', lambda m: f"{qa['members'][m]['hd']['parts']} / {qa['members'][m]['hd']['tris']:,} / {qa['members'][m]['hd']['mats']}", '≤ 36 / ≤ 10,800 / ≤ 3')
row('LOD 1 parts / tris', lambda m: f"{qa['members'][m]['lod']['parts']} / {qa['members'][m]['lod']['tris']:,}", '≤ 12 / ≤ 2,700')
row('Hulls / shadow casters (HD)', lambda m: f"{qa['members'][m]['hd']['hulls']} / {qa['members'][m]['hd']['casters']}", 'report')
row('Height (idle, t = 0) / feet min y', lambda m: f"{m_(qa['members'][m]['hd']['height'])} / {m_(qa['members'][m]['hd']['feetMinY'])}", '1.8–2.2 m (×1.2 bruiser: 2.16–2.64) / ≥ −0.03')
row('Lowest non-hull point: real down(1,true) / knock-down seq.minY', lambda m: f"{cm(qa['members'][m]['downEndSnappedMinY'])} / {cm(seq_min(m))}", '≥ −3.0 cm')
def tail_ear(m):
    a, b = qa['members'][m]['downEndSnapped'], qa['members'][m].get('downEndSnappedAnim', {})
    return f"tail {cm(a['tail'])} / {cm(b['tail'])}; ears {cm(a['ears'])} / {cm(b['ears'])}"
row('Tail / ear lowest point in down(1,true), without / with animateGang', tail_ear, '≥ −3.0 cm')
row('LOD 1 lowest point in knock-down (QA 60 fps / real_viewer seq.minY)', lambda m: f"{cm(qa['members'][m]['lodSequences']['knockdown']['worst']['y'])} / {cm(lineup_seq_min(m, True))}", '≥ −2.0 cm')
row('Shoulder gap down(1,true) / windup(0.6)', lambda m: f"{cm(max(qa['members'][m]['shoulderGapDown'].values()))} / {cm(max(qa['members'][m]['shoulderGapWindup06'].values()))}", '≤ 1 cm')
def mg(m):
    g = qa['members'][m]['merge']; a = g.get('animMoves')
    return f"{g['drawCalls']} / {'yes' if g['flashCovers'] and g['flashPx']['unflashedPx'] == 0 else 'no'} / {'yes' if a and a['moved_m'] > 0 else 'no'}"
row('Real mergeRig: draw calls after / flash covers all / animateGang moves bones', mg, '≤ 3 / yes / yes')
row('Max horizontal reach beyond META.radius in idle (weapon excepted)', lambda m: f"{cm(qa['members'][m]['idleReach']['beyond_m'])}", '≤ 35 cm')
row('outline:false parts without shadow:false', lambda m: f"{len(qa['members'][m]['hd']['shadowRule']) + len(qa['members'][m]['lod']['shadowRule'])}", '0')
row('Console errors (viewer, day + night)', lambda m: f"{sum(len(x['errors']) for x in P if f'show=key_hwy_otters.{m}&' in x['q'] + '&')}", '0')
row('Determinism: same seed → same hash', lambda m: f"{'yes' if qa['members'][m]['determinism']['same'] and qa['members'][m]['determinism']['sameLod'] and H['determinism']['starterKit'][m]['sameSeedEqual'] else 'no'} ({qa['members'][m]['determinism']['hashSeed7']})", 'yes')
print("| Check | " + " | ".join(M) + " | Threshold |")
print("|---|" + "---|" * (len(M) + 1))
print("\n".join(rows))
print(f"\nViewer console errors and warnings over all {len(P)} evidence jobs: {sum(len(x['errors']) for x in P)} (real_viewer day {errs_day}, night {errs_night}). "
      f"QA: {'ALL PASS' if qa['allPass'] else 'FAIL'} on the {qa['kit']} kit, dizzy attached at test time: {'yes' if qa['dizzyAttachedAtTestTime'] else 'no (kit already has it)'}.")

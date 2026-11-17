#!/usr/bin/env python3
"""check_factory.py — task L4 acceptance: run the factory on the Laurel/Fulton spec and diff it against the HAND-BUILT game.
  python3 tools/factory/check_factory.py [--tiles <osm tile cache>]        (from games/laurel-fulton/)
The public spec has streets only; the private house numbers (data/addresses.local.json, git-ignored) are merged into a
TEMPORARY spec outside the repo, so the build is exact and nothing with a number is ever written into Hawk.
Checks: every POI anchor present; every person's house within 5 m of the hand-built roster; the meet-up identical; every
parked car (the sim's own placement) within a few metres of the hand-built game's, and no two parked cars overlapping.
Writes a diff report to stdout (paste it into the DONE entry)."""
import os, sys, json, math, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); LF = os.path.dirname(os.path.dirname(HERE))
a = sys.argv[1:]; tiles = a[a.index('--tiles') + 1] if '--tiles' in a else '/tmp/lf_osm_tiles'
spec = open(os.path.join(HERE, 'examples', 'laurel-fulton.spec')).read()
book = json.load(open(os.path.join(LF, 'data', 'addresses.local.json')))
lines = []
for ln in spec.splitlines():
    t = ln.split()
    if t[:1] == ['person'] and t[1] in book and 'number' not in t: ln = ln.replace(' car ', f' number {book[t[1]][0]} car ', 1)
    lines.append(ln)
tmp = tempfile.mkdtemp(prefix='factory_laurel_'); sp = os.path.join(tmp, 'laurel.private.spec'); open(sp, 'w').write('\n'.join(lines) + '\n')
out = os.path.join(tmp, 'build')
r = subprocess.run(['python3', os.path.join(HERE, 'city_factory.py'), sp, out, '--tiles', tiles], cwd=LF, capture_output=True, text=True)
if r.returncode: print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit('factory failed')
H = json.load(open(os.path.join(LF, 'data', 'roster.json'))); B = json.load(open(os.path.join(out, 'data', 'roster.json')))
Hg = json.load(open(os.path.join(LF, 'data', 'graph.json'))); Bg = json.load(open(os.path.join(out, 'data', 'graph.json')))
fails = 0
def check(ok, name, info=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + name + ' ' + info); fails += 0 if ok else 1
need = {'ledo', 'atholton_hs', 'reservoir_hs'}
check(need <= set(Bg['anchors']), 'every POI anchor present', str(sorted(need & set(Bg['anchors']))))
check(len(Bg['edges']) == len(Hg['edges']), 'the same drivable graph', f"{len(Bg['edges'])} vs {len(Hg['edges'])} edges")
hb = {p['id']: p for p in H['people']}; worst = 0
for p in B['people']:
    q = hb.get(p['id']); d = math.hypot(p['house'][0] - q['house'][0], p['house'][1] - q['house'][1]) / 10 if (q and p.get('active') and q.get('active')) else 1e9
    worst = max(worst, d); print(f"     {p['id']:8s} factory vs hand: {d:.1f} m")
check(worst <= 5, 'every person within 5 m of their hand-built house', f'worst {worst:.1f} m')
check(B['meetup']['pos'] == H['meetup']['pos'], 'the meet-up is the same place', B['meetup']['name'])
# parked cars: the game's own placement, both builds, through the real sim
js = """
import fs from 'node:fs';
const [lf, out] = process.argv.slice(2);
const { GraphWorld } = await import(lf + '/src/world_graph.js'); const { LFSim } = await import(lf + '/src/lf_sim.js');
const place = (root, fleet) => { const G = JSON.parse(fs.readFileSync(root + '/data/graph.json')), R = JSON.parse(fs.readFileSync(root + '/data/roster.json'));
  const F = {}; for (const p of R.people) if (p.car && p.car.sprite) F[p.car.sprite] = fleet[p.car.sprite] || Object.values(fleet)[0];
  const S = new LFSim(new GraphWorld(G), R, F, { spawn: { x: 0, y: 0 }, model: Object.keys(F)[0] });
  return S.cars.filter(c => c.owner).map(c => ({ id: c.owner, x: c.x, y: c.y, len: c.len, wid: c.wid })); };
const fleet = JSON.parse(fs.readFileSync(lf + '/assets/fleet.json'));
console.log(JSON.stringify({ hand: place(lf, fleet), fac: place(out, fleet) }));
"""
jf = os.path.join(tmp, 'place.mjs'); open(jf, 'w').write(js)
pr = json.loads(subprocess.check_output(['node', jf, LF, out], cwd=LF))
hc = {c['id']: c for c in pr['hand']}; worst = 0
for c in pr['fac']:
    h = hc.get(c['id']); d = math.hypot(c['x'] - h['x'], c['y'] - h['y']) / 10 if h else 1e9; worst = max(worst, d)
check(worst <= 3, 'every car parked within 3 m of its hand-placed spot', f'worst {worst:.1f} m over {len(pr["fac"])} cars')
ov = [(a['id'], b['id']) for i, a in enumerate(pr['fac']) for b in pr['fac'][i + 1:] if math.hypot(a['x'] - b['x'], a['y'] - b['y']) < (a['wid'] + b['wid']) / 2]
check(not ov, 'no two parked cars overlap', str(ov))
print(f'(temporary build: {out} — outside the repo)')
print('FACTORY CHECK OK' if not fails else f'FACTORY CHECK FAIL ({fails})'); sys.exit(1 if fails else 0)

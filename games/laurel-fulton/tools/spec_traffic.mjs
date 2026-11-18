// spec_traffic.mjs — TEST-FIRST spec for task L15 (part 1), LIGHT AMBIENT TRAFFIC (src/lf_traffic.js; red until built).
//   node tools/spec_traffic.mjs        (from games/laurel-fulton/)   exit 0 = green
// A long headless run: the player cruises the real roads on lf_pilot's stick autopilot (so cars spawn/despawn around a MOVING
// player) while the ambient population is sampled every step. Proves: alive-count never above AMBIENT_MAX (and the street is not
// empty either: it still reaches the cap of 1 — owner, Nov 18: traffic halved, then halved again), spawns are sparse
// and out of sight, cars keep to the road (no teleports, <5% off-road, in the
// right-hand lane), nothing stays wedged, passing cars do not wreck each other, ambient cars are not GET-IN-able, sim.unstick is reused.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const { Pilot } = await import('../src/lf_pilot.js'); const { createFoot, nearAnyCar } = await import('../src/lf_foot.js');
let TR = null; try { TR = await import('../src/lf_traffic.js'); } catch (e) { check(false, 'src/lf_traffic.js loads', String(e).slice(0, 160)); }
if (TR) {
  const AREAS = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
  const W = new GraphWorld(G), DT = 1 / 60, MIN = Number(process.env.TRAFFIC_MIN || 12);
  const S = new LFSim(W, ROSTER, FLEET, { bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green });
  const T = new TR.Traffic(S, W, { seed: 7 });
  check(TR.AMBIENT_MAX === 1, 'AMBIENT_MAX is a named constant = 1 (owner, Nov 18: traffic halved, then halved again — still way too many cars)', String(TR.AMBIENT_MAX));
  check(/unstick/.test(fs.readFileSync(path.join(ROOT, 'src/lf_traffic.js'), 'utf8')), 'wedge recovery reuses sim.unstick');
  const pilot = new Pilot(S, W, null), places = [...Object.values(G.anchors).map(a => W.verts[a.v]), ...ROSTER.people.filter(p => p.house).map(p => ({ x: p.house[0], y: p.house[1] }))];
  let pi = 0; const goTo = () => { const q = places[pi++ % places.length]; pilot.plan(q.x, q.y, false); };
  goTo();
  const track = new Map(), jumps = []; let maxAlive = 0, aliveSum = 0, samples = 0, offRoad = 0, roadN = 0, lane = 0, laneN = 0, maxStuck = 0, ambHits = 0, firstSeen = 0;
  const spawnAt = new Set();
  for (let i = 0; i < MIN * 60 * 60; i++) {
    const inp = pilot.steer(DT); if (pilot.pts && Math.hypot(pilot.pts[pilot.pts.length - 1][0] - S.player.x, pilot.pts[pilot.pts.length - 1][1] - S.player.y) < 250) goTo();
    S.step(DT, inp); T.step(DT);
    const amb = S.cars.filter(c => c.ambient); maxAlive = Math.max(maxAlive, amb.length); aliveSum += amb.length; samples++;
    for (const c of amb) {
      let t = track.get(c); if (!t) { t = { x: c.x, y: c.y, still: 0, born: S.time }; track.set(c, t); firstSeen++; }
      else { const d = Math.hypot(c.x - t.x, c.y - t.y); if (d > 40) jumps.push([+S.time.toFixed(1), Math.round(d)]); }
      t.x = c.x; t.y = c.y;
      t.still = Math.abs(c.v) < 5 ? t.still + DT : 0; maxStuck = Math.max(maxStuck, t.still);
      if (i % 30 === 0) {
        const sf = W.surfaceAt(c.x, c.y, c.layer); roadN++; if (sf !== 'road' && sf !== 'service') offRoad++;
        if (Math.abs(c.v) > 40) { const r = W.roadInfo(c.x, c.y, c.layer); if (r.e && r.d < r.hw && r.hw > 0 && r.e.oneway === 0 && r.d > 3) { laneN++; const along = r.dx * c.dirx + r.dy * c.diry; if (rightOf(W, c, r) * Math.sign(along) > 0) lane++; } }
      }
    }
    if (amb.some(c => c.dmg > 0.6)) ambHits++;
  }
  function rightOf(W, c, r) { const ex = r.e, P = ex.pts; let best = 1e18, nx = 0, ny = 0; for (let k = 0; k + 1 < P.length; k++) { const vx = P[k + 1][0] - P[k][0], vy = P[k + 1][1] - P[k][1], L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((c.x - P[k][0]) * vx + (c.y - P[k][1]) * vy) / L2)), px = P[k][0] + vx * t, py = P[k][1] + vy * t, d = (px - c.x) ** 2 + (py - c.y) ** 2; if (d < best) { best = d; nx = c.x - px; ny = c.y - py; } } return nx * -r.dy + ny * r.dx; }   // side of the centreline in the edge's own direction (+ = right when y is down)
  const st = T.stats, mph = Math.round(aliveSum / samples * 100) / 100;
  check(maxAlive <= TR.AMBIENT_MAX, `alive ambient never exceeds the cap over ${MIN} sim-minutes`, `peak ${maxAlive} / ${TR.AMBIENT_MAX}`);
  check(maxAlive >= 1, 'the street is not dead: the population still reaches the cap of 1', `peak ${maxAlive}`);
  check(mph >= 0.4 && mph <= 1.6, 'light traffic: the average alive count sits in the ~1 band (half of the old 2.09)', `mean ${mph}`);
  check(st.spawns.length >= 4, 'cars do spawn over a long drive', `${st.spawns.length} spawns, ${firstSeen} seen`);
  check(st.spawns.every(s => s.d >= 800), 'every spawn is out of sight of the player (>= 80 m)', `min ${Math.min(...st.spawns.map(s => s.d)) | 0}`);
  const gaps = st.spawns.slice(1).map((s, k) => s.t - st.spawns[k].t);
  check(gaps.every(g => g >= TR.SPAWN_GAP[0] - 0.6), 'sparse: long quiet gaps between spawns', `min gap ${gaps.length ? Math.min(...gaps).toFixed(1) : '-'} s (>= ${TR.SPAWN_GAP[0]})`);
  check(jumps.length === 0, 'no teleports: an ambient car never jumps > 40 units in a step', jumps.slice(0, 4).map(j => j.join('@')).join(' '));
  check(offRoad / Math.max(1, roadN) < 0.05, 'ambient cars stay on the roads (< 5% of samples off the tarmac)', `${(100 * offRoad / Math.max(1, roadN)).toFixed(1)}% of ${roadN}`);
  check(laneN < 20 || lane / laneN > 0.8, 'lane-correct: on two-way roads they keep to the right-hand side', `${lane}/${laneN}`);
  check(maxStuck < 20, 'traffic never wedges for long (worst stand-still < 20 s)', `${maxStuck.toFixed(1)} s`);
  check(ambHits === 0, 'cars passing each other do not wreck one another', `${ambHits} frames with a wreck`);
  // not GET-IN-able
  const a = S.cars.find(c => c.ambient) || T.spawnAt(S.player.x + 400, S.player.y, 0);
  const F = createFoot(ROSTER.people[0]); F.x = a.x; F.y = a.y + 12; F.z = 0;
  check(nearAnyCar(F, [a]) === null, 'an ambient car cannot be GOT INTO (it is not a crew car)');
  // the cap holds even if you try to over-fill it
  for (let k = 0; k < 8; k++) T.spawn('ambient'); check(S.cars.filter(c => c.ambient).length <= TR.AMBIENT_MAX, 'spawn() refuses past the cap');
}
console.log(fails ? `FAIL: ${fails} check(s)` : 'ALL PASS'); process.exit(fails ? 1 : 0);

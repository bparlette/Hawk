// spec_l3.mjs — TEST-FIRST spec for task L3, speed bumps that launch you (red until lf_sim.js has bumps).
//   node tools/spec_l3.mjs          (from games/laurel-fulton/)   exit 0 = green
// The SAME real bump (data/bumps.json, residential only) crossed slow vs fast by the stick, measured:
// slow = a jolt that scrubs speed, no air; fast = an airborne arc (air time + height measured) that scales
// with entry speed; clean landing keeps the speed, a bad (steering) landing costs some. Then a real rally:
// the convoy takes the same physics — followers catch air too, in sequence behind you.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f)));
const G = J('data/graph.json'), RO = J('data/roster.json'), F = J('assets/fleet.json'), B = J('data/bumps.json').bumps;
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const MI = await import('../src/lf_mission.js'); const { Pilot } = await import('../src/lf_pilot.js');
const W = new GraphWorld(G), DT = 1 / 60;
check(B.length > 200, 'bumps placed from data on residential streets', `${B.length}`);
const bad = B.filter(b => { const r = W.roadInfo(b.x, b.y, 0); return !r.e || r.e.hw !== 'residential' && r.e.hw !== 'living_street' || (/Maple Lawn/.test(r.e.name) || r.e.name === 'Scaggsville Road') || /MD|US|I /.test(r.e.ref || ''); });
check(bad.length === 0, 'never on MD-216 / freeways / Maple Lawn Blvd — residential only', `${bad.length} misplaced`);
// a bump on a long straight street: approach from 70 m back along the road
const pickBump = () => B.find(b => { for (let s = -900; s <= 300; s += 50) { const r = W.roadInfo(b.x + b.dx * s, b.y + b.dy * s, 0); if (!r.e || r.d > 15 || Math.abs(r.dx * b.dx + r.dy * b.dy) < 0.98) return false; } return true; });
const bump = pickBump();
check(!!bump, 'found a bump on a straight residential run', bump ? `${bump.x},${bump.y}` : '');
function cross(vTarget, steerInAir = false) {                      // hold a speed like a driver: throttle up to it, brake above it
  const S = new LFSim(W, { people: [] }, F, { spawn: { x: bump.x - bump.dx * 900, y: bump.y - bump.dy * 900 }, h: Math.atan2(bump.dy, bump.dx), bumps: B });
  const c = S.player; c.h = Math.atan2(bump.dy, bump.dx);
  let vIn = 0, vOut = null, vAfter = null, air = 0, zMax = 0, t = 0, crossed = false;
  while (t < 15 && vOut === null) {
    const along = (c.x - bump.x) * bump.dx + (c.y - bump.y) * bump.dy;
    if (!crossed && along > -40 && along < 0) vIn = Math.abs(c.v);
    let inp = c.v > vTarget + 6 ? { jx: 0, jy: 0, jm: 0, keys: { down: true } } : { jx: bump.dx, jy: bump.dy, jm: c.v < vTarget - 6 ? 1 : 0.2, keys: {} };
    if (c.z > 0 && steerInAir) inp = { jx: -bump.dy, jy: bump.dx, jm: 1, keys: {} };   // yanking the wheel mid-air
    S.step(DT, inp); t += DT;
    if (c.z > 0) { air += DT; zMax = Math.max(zMax, c.z); }
    if (along > 0) { if (!crossed) vAfter = Math.abs(c.v); crossed = true; }   // the speed the instant after the hump
    if (crossed && along > 140 && c.z === 0) vOut = Math.abs(c.v);
  }
  return { vIn, vOut: vOut ?? -1, vAfter, air, zMax, done: vOut !== null };
}
const slow = cross(90), fast = cross(290), mid = cross(200), bent = cross(290, true);
check([slow, fast, mid, bent].every(r => r.done), 'every test run actually crosses the bump and drives on (no silent pass)');
check(slow.zMax === 0 && slow.vAfter < slow.vIn * 0.85, 'SLOW: a jolt that scrubs speed, no air', `in ${(slow.vIn / 4.47).toFixed(0)} mph -> over the hump ${(slow.vAfter / 4.47).toFixed(0)} mph, air ${slow.air.toFixed(2)} s`);
check(fast.air > 0.3 && fast.zMax > 15, 'FAST: the car LAUNCHES (air time + height measured)', `in ${(fast.vIn / 4.47).toFixed(0)} mph: ${fast.air.toFixed(2)} s in the air, ${(fast.zMax / 10).toFixed(1)} m high`);
check(mid.air > 0 && mid.air < fast.air && mid.zMax < fast.zMax, 'the arc scales with entry speed', `${(mid.vIn / 4.47).toFixed(0)} mph -> ${mid.air.toFixed(2)} s / ${(mid.zMax / 10).toFixed(1)} m  vs  ${(fast.vIn / 4.47).toFixed(0)} mph -> ${fast.air.toFixed(2)} s / ${(fast.zMax / 10).toFixed(1)} m`);
check(fast.vOut > fast.vIn * 0.9, 'a clean landing keeps the speed', `${(fast.vIn / 4.47).toFixed(0)} -> ${(fast.vOut / 4.47).toFixed(0)} mph`);
check(bent.vOut < fast.vOut * 0.9, 'a bad landing (wheel yanked mid-air) costs speed', `${(bent.vOut / 4.47).toFixed(0)} mph vs clean ${(fast.vOut / 4.47).toFixed(0)}`);
// the convoy: same physics, no special-casing — run a real rally and count follower launches
const S = new LFSim(W, RO, F, { spawn: { x: 0, y: 0 }, bumps: B }), M = MI.startRally(S, RO, 'jason'), P = new Pilot(S, W, M);
let launches = 0, me = 0, seq = 0; const was = new Map();
for (let i = 0; i < 60 * 60 * 9 && !M.complete; i++) {
  S.step(DT, M.beat ? { jx: 0, jy: 0, jm: 0, keys: {} } : P.input(DT)); MI.stepRally(S, M, DT);
  for (const c of S.cars) { const up = c.z > 0; if (up && !was.get(c)) { if (c === S.player) me++; else { launches++; if (me) seq++; } } was.set(c, up); }
}
check(launches > 0 && seq > 0, 'the CONVOY catches air too — same physics, in sequence behind you', `you ${me} launches, followers ${launches}`);
console.log(fails ? `SPEC L3 FAIL (${fails})` : 'SPEC L3 OK'); process.exit(fails ? 1 : 0);

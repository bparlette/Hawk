// spec_koth_disc.mjs — KOTH circle road (owner, Nov 17): the candidate/active cul-de-sac's disc
// is REAL pavement — surfaceAt says road inside it, the ground painter invalidates exactly the
// chunks the disc touches, the sim gives road grip (no lawn drag), and the skid layer lays
// BLACK marks there instead of tearing brown dirt.
//   node tools/spec_koth_disc.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { GraphWorld } = await import(path.join(ROOT, 'src/world_graph.js'));
const { LFSim } = await import(path.join(ROOT, 'src/lf_sim.js'));
const { GroundPainter, CHUNK } = await import(path.join(ROOT, 'src/lf_ground.js'));
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const W = new GraphWorld(J('data/graph.json')), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps, SACS = J('data/culdesacs.json');
let fails = 0; const check = (ok, label, extra = '') => { console.log((ok ? 'PASS' : 'FAIL'), label, extra); if (!ok) fails++; };

// pick the grassiest sac: the disc must cover real lawn, or there is nothing to prove
let sac = null, grassPt = null, bestGrass = 0;
for (const s of SACS) {
  let grass = 0, pt = null;
  for (let k = 0; k < 16; k++) for (const rr of [0.45, 0.65, 0.85]) {
    const x = s.x + Math.cos(k / 16 * Math.PI * 2) * s.r * rr, y = s.y + Math.sin(k / 16 * Math.PI * 2) * s.r * rr;
    if (W.surfaceAt(x, y, 0) === 'ground') { grass++; if (rr <= 0.65 && !pt) pt = { x, y }; }
  }
  if (pt && grass > bestGrass) { bestGrass = grass; sac = s; grassPt = pt; }
}
check(!!sac, 'found a cul-de-sac whose disc covers real grass', sac ? `${sac.name} (${bestGrass} grass samples)` : 'none');
check(W.surfaceAt(grassPt.x, grassPt.y, 0) === 'ground', 'the test point starts as grass', W.surfaceAt(grassPt.x, grassPt.y, 0));
const layer1Before = W.surfaceAt(grassPt.x, grassPt.y, 1);
const farPt = { x: sac.x + sac.r * 1.6, y: sac.y };
const farBefore = W.surfaceAt(farPt.x, farPt.y, 0);

// 1) the surface override, driven through the painter (the real owner of the state)
const GP = new GroundPainter(W, 64, null, []);
GP.setPave(sac);
check(W.pave && W.pave.x === sac.x && W.pave.r === sac.r, 'setPave syncs the world override');
check(W.surfaceAt(grassPt.x, grassPt.y, 0) === 'road', 'inside the disc: grass reads as ROAD');
check(W.surfaceAt(sac.x, sac.y, 0) === 'road', 'the disc centre reads as road');
check(W.surfaceAt(grassPt.x, grassPt.y, 1) === layer1Before, 'layer 1 (bridge decks) is untouched by the disc', layer1Before);
check(W.surfaceAt(farPt.x, farPt.y, 0) === farBefore, 'outside the disc: surface unchanged', farBefore);
GP.setPave(null);
check(!W.pave && W.surfaceAt(grassPt.x, grassPt.y, 0) === 'ground', 'clearing the disc: grass is grass again');

// 2) chunk invalidation: exactly the chunks the disc touches, only on a real change
const GP2 = new GroundPainter(W, 64, null, []);
const discChunks = new Set(), FARKEY = '999,999';
for (let cy = Math.floor((sac.y - sac.r - 10) / CHUNK); cy <= Math.floor((sac.y + sac.r + 10) / CHUNK); cy++)
  for (let cx = Math.floor((sac.x - sac.r - 10) / CHUNK); cx <= Math.floor((sac.x + sac.r + 10) / CHUNK); cx++) {
    const nx = Math.max(cx * CHUNK, Math.min(sac.x, cx * CHUNK + CHUNK)), ny = Math.max(cy * CHUNK, Math.min(sac.y, cy * CHUNK + CHUNK));
    if (Math.hypot(nx - sac.x, ny - sac.y) <= sac.r + 10) discChunks.add(GP2.key(cx, cy));
  }
for (const k of discChunks) GP2.cache.set(k, {});
GP2.cache.set(FARKEY, {});
GP2.setPave(sac);
check([...discChunks].every(k => !GP2.cache.has(k)), 'setPave drops every cached chunk the disc touches', discChunks.size + ' chunks');
check(GP2.cache.has(FARKEY), 'setPave leaves distant chunks cached');
GP2.cache.set([...discChunks][0], {});
GP2.setPave(sac);   // same sac again: no state change, no repaint
check(GP2.cache.has([...discChunks][0]), 'setPave with the same sac is a no-op (no repaint churn)');
GP2.setPave(null);
check(!GP2.cache.has([...discChunks][0]), 'clearing the disc drops the chunks again (grass repaints)');

// 3) sim grip: rolling at 200 u/s across the grass part of the disc — lawn drag vs road grip
const UP = { jx: 0, jy: 0, jm: 0, keys: { up: true }, action: false, punch: false, turbo: false };
const roll = (paved) => {
  const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: grassPt.x, y: grassPt.y }, bumps: BUMPS });
  const P = S.player, a = Math.atan2(grassPt.y - sac.y, grassPt.x - sac.x) + Math.PI / 2;   // tangent: the long chord across the disc
  P.h = a; P.dirx = Math.cos(a); P.diry = Math.sin(a); P.v = 200;
  W.pave = paved ? { x: sac.x, y: sac.y, r: sac.r } : null;
  for (let i = 0; i < 20; i++) S.step(1 / 60, UP);   // 1/3 s: the paved roll (~70 units) stays on the chord inside the disc
  const inside = Math.hypot(P.x - sac.x, P.y - sac.y) < sac.r;
  W.pave = null;
  return { v: P.v, inside };
};
const gRoll = roll(false), pRoll = roll(true);
check(gRoll.inside && pRoll.inside, 'both test rolls stayed inside the disc');
check(gRoll.v < 175, 'on grass the lawn drag caps the roll', 'v=' + gRoll.v.toFixed(0));
check(pRoll.v > gRoll.v + 20, 'on the paved disc the car keeps road speed', `v=${pRoll.v.toFixed(0)} vs grass ${gRoll.v.toFixed(0)}`);

// 4) skid marks: a donut on the grass part of the disc — brown dirt unpaved, black when paved
const DONUT = { jx: 0, jy: 0, jm: 0, keys: { up: true, left: true }, action: false, punch: false, turbo: false };
const donut = (paved) => {
  const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: grassPt.x, y: grassPt.y }, bumps: BUMPS });
  const P = S.player; P.h = 0; P.dirx = 1; P.diry = 0; P.v = 0;
  W.pave = paved ? { x: sac.x, y: sac.y, r: sac.r } : null;
  for (let i = 0; i < 90; i++) S.step(1 / 60, DONUT);
  W.pave = null;
  const K = S.skid, flags = [];
  for (let n = 0; n < K.w; n++) flags.push(K.buf[(n % 2048) * 7 + 6]);
  return flags;
};
const dirt = donut(false), black = donut(true);
check(dirt.length > 4 && dirt.some(f => f === 2), 'unpaved control: the donut tears BROWN dirt marks', dirt.length + ' segments');
check(black.length > 4 && black.every(f => f === 0), 'paved disc: the same donut lays only BLACK marks', black.length + ' segments');

console.log(fails ? `SPEC KOTH DISC FAIL (${fails})` : 'SPEC KOTH DISC OK'); process.exit(fails ? 1 : 0);

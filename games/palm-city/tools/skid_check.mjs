// skid_check.mjs — 7E: tyre marks only where tyres slip, on the real sim.
//   donut  : full lock + feathered throttle paints a ring (every direction covered, hollow middle)
//   drift  : a fast corner leaves marks that curve with the car's path
//   calm   : 10 s of straight, gentle driving leaves nothing
//   launch : flooring it from rest leaves a short mark, then stops
//   brake  : hard braking marks all four tyres
//   sand   : soft ground carves ruts (flagged as a different surface)
//   caps   : the segment ring and the tile pool are fixed size
// Usage: node tools/skid_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { SEGS, CELL, TILE, TILE_CAP, TrackLayer } from '../src/skid.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
function fresh(x, y, h) {
  const s = new Sim(world, M, 9, () => {});
  const c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  s.peds = [P.ped]; s.cars = [c]; s.addStars = () => {}; s.spawnTraffic = () => null; s.spawnPed = () => null;   // empty streets
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  c.x = x; c.y = y; c.h = h; c.v = 0;
  return { s, c };
}
const cells = (s) => { const K = s.skid, out = []; for (let i = 0; i < K.grid.length; i++) if (K.grid[i]) out.push([(i % K.gw + 0.5) * CELL, (Math.floor(i / K.gw) + 0.5) * CELL]); return out; };
const segs = (s) => { const K = s.skid, n = Math.min(K.w, SEGS), out = []; for (let i = 0; i < n; i++) out.push(Array.from(K.buf.subarray(i * 7, i * 7 + 7))); return out; };

{ // donut at the street crossing
  const { s, c } = fresh(780, 800, 0);
  for (let i = 0; i < 60 * 7; i++) s.step(DT, inp({ keys: { left: true, up: c.v < 70 } }));
  const P = cells(s), cx = P.reduce((a, p) => a + p[0], 0) / P.length, cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const R = P.map(p => Math.hypot(p[0] - cx, p[1] - cy)), mean = R.reduce((a, b) => a + b, 0) / R.length;
  const sd = Math.sqrt(R.reduce((a, r) => a + (r - mean) ** 2, 0) / R.length);
  const sectors = new Set(P.map(p => Math.floor((Math.atan2(p[1] - cy, p[0] - cx) + Math.PI) / (Math.PI / 6)) % 12));
  const hollow = P.filter(p => Math.hypot(p[0] - cx, p[1] - cy) < mean * 0.35).length;
  check(s.skid.cover > 25, 'donut: the track layer gains coverage', `${s.skid.cover} cells, ${s.skid.w} segments`);
  check(sectors.size === 12 && hollow === 0 && sd / mean < 0.4, 'donut: the marks form a ring (all 12 directions, hollow middle)', `radius ${mean.toFixed(0)} ± ${sd.toFixed(0)} units, sectors ${sectors.size}/12, cells in the middle ${hollow}`);
}
{ // drift: arrive fast, throw it right
  const { s, c } = fresh(560, 203, 0);
  for (let i = 0; i < 150; i++) s.step(DT, inp({ keys: { up: true } }));
  const before = s.skid.w, h0 = c.h;
  for (let i = 0; i < 40; i++) s.step(DT, inp({ keys: { up: true, right: true } }));
  const S = segs(s).slice(before), a0 = Math.atan2(S[0][3] - S[0][1], S[0][2] - S[0][0]), a1 = Math.atan2(S.at(-1)[3] - S.at(-1)[1], S.at(-1)[2] - S.at(-1)[0]);
  const turn = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
  check(S.length > 40 && turn > 0.6, 'drift: a fast corner lays marks that curve with the path', `${S.length} segments, mark direction turns ${(turn * 57.3).toFixed(0)}°, car turned ${(Math.abs(c.h - h0) * 57.3).toFixed(0)}°`);
  check(S.some((q, i) => i >= 0 && q[5] > 0.6), 'drift: heavy slip, heavy mark', `max strength ${Math.max(...S.map(q => q[5])).toFixed(2)}`);
}
{ // calm: 10 s straight and gentle (re-placed on the top road so it never runs out)
  const { s, c } = fresh(500, 203, 0);
  let top = 0;
  for (let i = 0; i < 600; i++) { if (c.x > 1000) c.x = 500; c.y = 203; c.h = 0; s.step(DT, inp({ jx: 1, jy: 0, jm: 0.5 })); top = Math.max(top, c.v); }
  check(s.skid.w === 0 && s.skid.cover === 0 && top > 250, 'calm: 10 s of straight, gentle driving leaves nothing — even at full speed', `${s.skid.w} segments, top speed ${top.toFixed(0)} u/s`);
}
{ // launch
  const { s, c } = fresh(500, 203, 0);
  for (let i = 0; i < 120; i++) s.step(DT, inp({ keys: { up: true } }));
  const n = s.skid.w, len = segs(s).reduce((a, q) => a + Math.hypot(q[2] - q[0], q[3] - q[1]), 0) / 2;
  for (let i = 0; i < 60; i++) s.step(DT, inp({ keys: { up: true } }));
  check(n > 4 && len < 40 && s.skid.w === n, 'launch: flooring it from rest leaves a short pair of marks, then nothing', `${len.toFixed(0)} units per tyre`);
}
{ // brake
  const { s, c } = fresh(500, 203, 0);
  for (let i = 0; i < 150; i++) s.step(DT, inp({ keys: { up: true } }));
  const before = s.skid.w;
  for (let i = 0; i < 20; i++) s.step(DT, inp({ keys: { down: true } }));
  check(s.skid.w - before >= 4 * 15, 'brake: hard braking marks all four tyres', `${s.skid.w - before} segments in 20 steps`);
}
{ // sand
  const { s, c } = fresh(1350, 600, Math.PI / 2);
  for (let i = 0; i < 90; i++) s.step(DT, inp({ keys: { up: true } }));
  const soft = segs(s).filter(q => q[6] === 1).length;
  check(soft > 10, 'sand: tyres carve ruts (their own colour, same system)', `${soft} sand segments, surface ${world.surfaceAt(c.x, c.y)}`);
}
{ // caps
  const { s, c } = fresh(780, 800, 0);
  for (let i = 0; i < 60 * 30; i++) s.step(DT, inp({ keys: { left: true, up: c.v < 70 } }));
  check(s.skid.buf.length === SEGS * 7 && s.skid.w > SEGS, 'cap: segments live in a fixed ring (it wraps, it never grows)', `${s.skid.w} written into ${SEGS} slots`);
  let made = 0; const fake = () => { made++; const g = new Proxy({}, { get: () => () => {}, set: () => true }); return { getContext: () => g }; };
  const L = new TrackLayer(fake);
  for (let i = 0; i < 100; i++) L.tile(i % 10, (i / 10) | 0, true);
  check(made === TILE_CAP && L.byKey.size === TILE_CAP, `cap: the tile pool is ${TILE_CAP} tiles of ${TILE} px, oldest reused`, `${made} canvases after touching 100 tiles`);
}
console.log(fails ? `SKID FAIL (${fails})` : 'SKID OK'); process.exit(fails ? 1 : 0);

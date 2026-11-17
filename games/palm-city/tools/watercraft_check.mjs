// watercraft_check.mjs — headless checks of the watercraft rules using the real sim:
// the jetski + cigarette boat at the pier (mount, speed, turbo, turning, never leaving the
// water, dismount at the dock) and the police boat (spawns at 2+ stars on the water, closes,
// pins for a bust, breaks off when you step ashore; absent at 0-1 stars).
// Usage: node tools/watercraft_check.mjs   (exit 0 = all pass)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World, mulberry32 } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { CRAFT_SPECS, craftSpeed } from '../src/watercraft.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
const STEP = 1 / 60;
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };
const stick = (a, m = 1, extra = {}) => ({ jx: Math.cos(a), jy: Math.sin(a), jm: m, action: false, punch: false, turbo: false, keys: {}, ...extra });
const idle = (extra = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...extra });
function fresh() {
  const ev = [];
  const s = new Sim(world, M, 3, (n, v) => ev.push(n));
  s.cars = s.cars.filter(c => c.parked);  // quiet streets for deterministic checks
  s.peds = [s.player.ped];
  return { s, ev };
}
const run = (s, n, inp) => { for (let i = 0; i < n; i++) s.step(STEP, typeof inp === 'function' ? inp(i) : inp); };
const PIER = layout.pier;
const onWater = (s, cr) => s.W.surfaceAt(cr.x, cr.y) === 'water';
const inPier = (cr) => cr.x > PIER.x && cr.x < PIER.x + PIER.w && cr.y > PIER.y && cr.y < PIER.y + PIER.h;

// Walk to a moored craft and hop on through the real action-button path.
function mountAt(s, kind) {
  const cr = s.water.craft.find(c => c.kind === kind);
  s.player.ped.x = cr.x; s.player.ped.y = PIER.y + PIER.h - 6;   // the deck edge alongside it
  run(s, 1, idle({ action: true }));
  return cr;
}

// Drive a mounted craft somewhere open, at speed, ready to measure.
function toOpenWater(s, cr, x, y, h) {
  cr.x = x; cr.y = y; cr.h = h; cr.vx = Math.cos(h) * cr.spec.top * 0.9; cr.vy = Math.sin(h) * cr.spec.top * 0.9;
}

// 1. jetski: mount at the pier, throttle builds real speed, spray flies, hull stays on water
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  check('action button at the dock mounts the jetski', s.player.mode === 'water' && s.water.ride === cr);
  toOpenWater(s, cr, 1700, 1500, -Math.PI / 2);   // out of the mooring cluster, into the bay
  cr.vx = cr.vy = 0;
  let vmax = 0, maxSpray = 0, wet = true;
  for (let i = 0; i < 300; i++) {
    s.step(STEP, stick(-Math.PI / 2));
    vmax = Math.max(vmax, craftSpeed(cr));
    maxSpray = Math.max(maxSpray, s.water.spray.length);
    if (!onWater(s, cr) || inPier(cr)) wet = false;
  }
  check('jetski throttle builds speed', vmax > 170, `vmax ${vmax.toFixed(0)} (top ${cr.spec.top})`);
  check('jetski throws painted spray at speed', maxSpray > 25, `peak spray ${maxSpray}`);
  check('jetski stays on the water', wet);
}
// 2. jetski turbo: A held raises the top speed measurably
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  toOpenWater(s, cr, 1700, 1900, -Math.PI / 2);
  cr.vx = cr.vy = 0;
  let v1 = 0;
  for (let i = 0; i < 300; i++) { s.step(STEP, stick(-Math.PI / 2)); v1 = Math.max(v1, craftSpeed(cr)); }
  let v2 = 0;
  for (let i = 0; i < 150; i++) { s.step(STEP, stick(-Math.PI / 2, 1, { turbo: true })); v2 = Math.max(v2, craftSpeed(cr)); }
  check('jetski turbo raises top speed', v2 > v1 * 1.12, `cruise ${v1.toFixed(0)} -> turbo ${v2.toFixed(0)}`);
}
// 3. a long random-input run never leaves the water (jetski)
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  const rng = mulberry32(99);
  let a = -Math.PI / 2, wet = true;
  for (let i = 0; i < 3600; i++) {
    if (i % 90 === 0) a = rng() * Math.PI * 2;
    s.step(STEP, stick(a, 0.4 + rng() * 0.6, { turbo: rng() < 0.3 }));
    if (!onWater(s, cr) || inPier(cr)) { wet = false; break; }
  }
  check('random 60 s run never leaves the water', wet, `ended at ${cr.x.toFixed(0)},${cr.y.toFixed(0)}`);
}
// 4. dismount at the dock returns the player to foot, on the pier
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  run(s, 1, idle({ action: true }));
  check('action at the dock hops off', s.player.mode === 'foot' && !cr.ridden);
  check('dismount lands on the pier deck', s.W.onPier(s.player.ped.x, s.player.ped.y, 4),
    `ped ${s.player.ped.x.toFixed(0)},${s.player.ped.y.toFixed(0)}`);
}
// 5. cigarette boat: mounts the same way, much faster, and turns much wider than the jetski
function turnRadius(kind) {
  const { s } = fresh();
  const cr = mountAt(s, kind);
  toOpenWater(s, cr, 1740, 1700, -Math.PI / 2);
  let dist = 0, dth = 0, px = cr.x, py = cr.y, ph = cr.h;
  for (let i = 0; i < 300 && dth < 1.2; i++) {
    s.step(STEP, stick(Math.PI));
    dist += Math.hypot(cr.x - px, cr.y - py);
    let dh = cr.h - ph; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    dth += Math.abs(dh); px = cr.x; py = cr.y; ph = cr.h;
  }
  return dist / Math.max(0.2, dth);
}
{
  const { s } = fresh();
  const cr = mountAt(s, 'boat');
  check('action button at the dock mounts the cigarette boat', s.player.mode === 'water' && s.water.ride === cr);
  toOpenWater(s, cr, 1700, 2080, -Math.PI / 2);
  cr.vx = cr.vy = 0;
  let vmax = 0, wet = true;
  for (let i = 0; i < 600; i++) {
    s.step(STEP, stick(-Math.PI / 2));
    vmax = Math.max(vmax, craftSpeed(cr));
    if (!onWater(s, cr)) wet = false;
  }
  check('cigarette boat is much faster than the jetski', vmax > 330, `vmax ${vmax.toFixed(0)} (top ${cr.spec.top})`);
  check('cigarette boat stays on the water', wet);
  const rSki = turnRadius('jetski'), rBoat = turnRadius('boat');
  check('cigarette boat turns much wider than the jetski', rBoat > rSki * 1.7, `ski r${rSki.toFixed(0)} vs boat r${rBoat.toFixed(0)}`);
}
// 6. police boat: the speed ladder leaves a clean getaway possible
{
  check('police top speed sits below the boat turbo top, above its cruise',
    CRAFT_SPECS.cop.top < CRAFT_SPECS.boat.top * 1.4 && CRAFT_SPECS.cop.top > CRAFT_SPECS.boat.top,
    `cop ${CRAFT_SPECS.cop.top} vs boat ${CRAFT_SPECS.boat.top} x1.4 = ${(CRAFT_SPECS.boat.top * 1.4).toFixed(0)}`);
}
// 7. police boat: absent at 0-1 stars on the water, and absent ashore at 3 stars
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  s.stars = 1;
  run(s, 240, stick(-Math.PI / 2));
  check('no police boat at 1 star on the water', !s.water.cop);
  const { s: s2 } = fresh();
  s2.stars = 3;
  run(s2, 180, idle());
  check('no police boat while the player is ashore', !s2.water.cop);
}
// 8. police boat: spawns at 2 stars and closes on a fleeing jetski
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  s.stars = 2;
  run(s, 30, idle());
  check('police boat spawns at 2 stars on the water', !!s.water.cop);
  const cop = s.water.cop, d0 = Math.hypot(cop.x - cr.x, cop.y - cr.y);
  let dMin = 1e9;
  for (let i = 0; i < 360; i++) {
    s.step(STEP, stick(-Math.PI / 3));
    dMin = Math.min(dMin, Math.hypot(cop.x - cr.x, cop.y - cr.y));
  }
  check('police boat closes on a fleeing jetski', dMin < d0 * 0.45, `spawn ${d0.toFixed(0)} -> closest ${dMin.toFixed(0)}`);
}
// 9. police boat: hold still alongside it and you are busted, on the car bust timing
{
  const { s, ev } = fresh();
  mountAt(s, 'jetski');
  s.stars = 3;
  let steps = 0;
  while (!s.busted && steps < 1100) { s.step(STEP, idle()); steps++; }
  check('pinned by the police boat = busted', !!s.busted && ev.includes('busted'), `after ${(steps / 60).toFixed(1)} s`);
  run(s, 300, idle());
  check('water bust respawns on foot ashore', s.player.mode === 'foot' && !s.water.ride && s.W.surfaceAt(s.player.ped.x, s.player.ped.y) !== 'water');
}
// 10. police boat: step ashore and it breaks off and goes home
{
  const { s } = fresh();
  const cr = mountAt(s, 'jetski');
  s.stars = 3;
  run(s, 60, idle());
  check('police boat out before the break-off', !!s.water.cop);
  cr.x = 1592; cr.y = PIER.y + PIER.h + 36; cr.vx = cr.vy = 0;      // back alongside the dock
  run(s, 1, idle({ action: true }));
  check('player steps ashore', s.player.mode === 'foot');
  let gone = false;
  for (let i = 0; i < 1500 && !gone; i++) { s.step(STEP, idle()); gone = !s.water.cop; }
  check('police boat breaks off and despawns ashore', gone);
}
console.log(fails ? `WATERCRAFT FAIL (${fails})` : 'WATERCRAFT OK');
process.exit(fails ? 1 : 0);

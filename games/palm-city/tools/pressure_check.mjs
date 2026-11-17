// pressure_check.mjs — rule checks for Sky + Street Pressure (src/pressure.js) on the real sim.
// Usage: node tools/pressure_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };
const run = (sim, secs, inp = none, until = null) => { for (let i = 0; i < secs * 60; i++) { sim.step(DT, typeof inp === 'function' ? inp(i) : inp); if (until && until()) return true; } return false; };
function fresh(stars) {
  const sim = new Sim(world, M, 5, () => {});
  sim.cars = sim.cars.filter(c => c.parked); sim.peds = [sim.player.ped];     // quiet streets
  sim.stars = stars; sim.addStars = () => {};
  // no squad cars in these checks: they would bust the player and hide what the chopper does
  const add = sim.addCar.bind(sim);
  sim.addCar = (...a) => a[4] === 'police' ? { v: 0 } : add(...a);
  return sim;
}

// chopper arrives at 3 stars, not before
{
  const s2 = fresh(2); run(s2, 3);
  check(!s2.chopper, 'no chopper at 2 stars');
  const s3 = fresh(3); run(s3, 0.1);
  check(!!s3.chopper, 'a chopper arrives at 3 stars');
}
// standing still in the open it finds you, and while it holds you the heat can't cool
{
  const s = fresh(3);
  const found = run(s, 25, none, () => s.chopper && s.chopper.lock);
  check(found, 'the searchlight finds a player standing in the open', s.chopper ? `${s.chopper.t.toFixed(1)} s` : '');
  run(s, 20);
  check(s.stars === 3 && s.chopper.lock, 'held in the light for 20 s, the stars never drop (no police cars near)', `stars ${s.stars}`);
}
// with no chopper, the same 20 s alone would have cooled a star (control)
{
  const s = fresh(2); s.lostT = 0;
  run(s, 24);
  check(s.stars === 1, 'control: at 2 stars (no chopper) alone in the open, a star cools in ~22 s', `stars ${s.stars}`);
}
// a fast car outruns the beam at 3 stars: lock breaks
{
  const s = fresh(3);
  run(s, 25, none, () => s.chopper && s.chopper.lock);
  // the car runs a straight line at 280 u/s (placed each step, so walls can't stop it: this checks
  // the beam's slew against car speed, not the street layout)
  const P = s.player, c = s.addCar(P.ped.x, P.ped.y, 0, 'sedan_coral', 'player');
  P.mode = 'car'; P.car = c; P.ped.hidden = true;
  let broke = false;
  for (let i = 0; i < 6 * 60; i++) { c.v = 0; c.x += 280 * DT; s.step(DT, none); if (!s.chopper || !s.chopper.lock) { broke = !!s.chopper; break; } }
  check(broke, 'a car at speed outruns the 3-star beam');
}
// it leaves when the heat is gone, and stays out of the motel
{
  const s = fresh(3); run(s, 2);
  s.stars = 0; run(s, 12);
  check(!s.chopper, 'at zero stars the chopper flies off and despawns');
  const s2 = fresh(3); run(s2, 2);
  const p = s2.player.ped; [p.x, p.y] = layout.motelDoor;
  s2.step(DT, { ...none, action: true });
  run(s2, 1);
  check(s2.siege && (!s2.chopper || s2.chopper.leaving), 'inside the motel the street chopper leaves (the siege has its own)');
}
// ---- street pressure
const inCar = (s, x, y, h) => { const P = s.player, c = s.addCar(x, y, h, 'sedan_coral', 'player'); P.mode = 'car'; P.car = c; P.ped.hidden = true; return c; };
// a roadblock appears ahead of a car being driven at 4 stars — not at 3
{
  for (const stars of [3, 4]) {
    const s = fresh(stars);
    const q = world.loopAt(600, 12), c = inCar(s, q.x, q.y, Math.atan2(q.ty, q.tx));
    s.playerS = 600;
    for (let i = 0; i < 5 * 60 && !s.roadblocks; i++) { c.v = 150; s.step(DT, { ...none, keys: { up: true } }); }
    if (stars === 3) check(!s.roadblocks, 'no roadblock at 3 stars');
    else {
      check(s.roadblocks === 1 && s.sawhorses.length === 2 && s.spikes.length === 1, 'at 4 stars a roadblock goes up: two cruisers, two sawhorses, a spike strip', `${s.sawhorses.length} ${s.spikes.length}`);
      const rb = s.cars.filter(k => k.roadblock), d = Math.hypot(rb[0].x - c.x, rb[0].y - c.y);
      check(rb.length === 2 && d > 300 && d < 900, 'it is set up ahead, out of sight', `${Math.round(d)} units`);
      // the kerb-side gap: project the cruisers onto the line across the road; one kerb must keep
      // a clear stretch wider than a car (20) with only sawhorses — or nothing — in the way
      const q = world.loopAt(world.loopNearest(rb[0].x, rb[0].y)), nx = -q.ty, ny = q.tx, hr = world.halfRoad;
      const off = (k) => (k.x - q.x) * nx + (k.y - q.y) * ny;
      const span = rb.map(k => [off(k) - k.len / 2, off(k) + k.len / 2]);
      const lo = Math.min(...span.map(a => a[0])), hi = Math.max(...span.map(a => a[1]));
      const gap = Math.max(hr - hi, lo + hr);
      check(gap > 22, 'one kerb keeps a gap a car fits through (sawhorses are all that stand in it)', `${Math.round(gap)} units`);
    }
  }
}
// sawhorses: shatter at speed and you keep most of it; slow, they stop you short
{
  for (const [v, name] of [[220, 'fast'], [90, 'slow']]) {
    const s = fresh(0);
    const q = world.loopAt(600, 12), h = Math.atan2(q.ty, q.tx), c = inCar(s, q.x, q.y, h);
    const saw = { x: q.x + Math.cos(h) * 40, y: q.y + Math.sin(h) * 40, a: h + Math.PI / 2, broken: false, t: 0 };
    s.sawhorses.push(saw); c.v = v;
    let vAfter = v;
    for (let i = 0; i < 60 && !saw.broken; i++) { c.v = v; s.step(DT, none); vAfter = c.v; }
    if (name === 'fast') check(saw.broken && vAfter > v * 0.85 && (s.score || 0) >= 60, 'a sawhorse hit at speed shatters: ~8% lost, +60', `v ${v} -> ${Math.round(vAfter)}`);
    else check(saw.broken && vAfter < v * 0.5, 'hit slowly it stops you short', `v ${v} -> ${Math.round(vAfter)}`);
  }
}
// spikes: the player rides ON RIMS for ~8 s (polish bundle), then the tyres give up and the limp lands
{
  const s = fresh(0);
  // staging (push #2): the traffic loop was rebuilt for the shell, so the old fixed arc point
  // (600) now lands on a curve in the oncoming lane — the pin cut chords onto grass and met
  // head-on traffic, poisoning the measurement. Scan for a clean straight of the CURRENT loop
  // (all-road, heading drift < 0.1 over 160 units) and stage there instead.
  let ms = -1, q = null;
  for (let a = 0; a < world.loopPath.len - 200 && ms < 0; a += 20) {
    const p0 = world.loopAt(a, 12), p1 = world.loopAt(a + 80, 12), p2 = world.loopAt(a + 160, 12);
    const dh = Math.abs(Math.atan2(p2.ty, p2.tx) - Math.atan2(p0.ty, p0.tx));
    if (world.surfaceAt(p0.x, p0.y) === 'road' && world.surfaceAt(p1.x, p1.y) === 'road' && world.surfaceAt(p2.x, p2.y) === 'road' && Math.min(dh, Math.PI * 2 - dh) < 0.1) { ms = a; q = p0; }
  }
  if (!q) { check(false, 'rim-run staging finds a clean straight on the traffic loop', 'none found'); }
  const h = Math.atan2(q.ty, q.tx), c = inCar(s, q.x, q.y, h);
  s.spikes.push({ x: q.x + Math.cos(h) * 50, y: q.y + Math.sin(h) * 50, a: h + Math.PI / 2 });
  let tRims = -1, t1 = -1, v1 = 0;
  for (let i = 0; i < 14 * 60; i++) {
    if (t1 < 0 && !c.spiked) c.v = 240;
    if (t1 >= 0) { ms += c.v * DT; const qq = world.loopAt(ms, 12); c.x = qq.x; c.y = qq.y; c.h = Math.atan2(qq.ty, qq.tx); }   // the rim run ends wherever it ends — measure the limp pinned to the loop, floored, clear of grass drag and the fighting wheel
    s.step(DT, { ...none, keys: { up: true } });
    if ((c.rims || 0) > 0 && tRims < 0) tRims = i;
    if (c.spiked && t1 < 0) { t1 = i; c.v = 240; c.dmg = 0; c.wreck = false; s.cars = s.cars.filter(o => o === c || o.parked); }   // the forced rim run also wrecks the car against the city — clear the crash damage so this measures the TYRE limp (wrecking has its own checks); moving traffic leaves too: a same-direction rear-ender in the window is RNG weather, not limp
    if (t1 >= 0 && i === t1 + 60) { v1 = Math.abs(c.v); break; }
  }
  check(tRims >= 0 && t1 > tRims && (t1 - tRims) / 60 > 7 && (t1 - tRims) / 60 < 9.5, 'a spike strip puts the player ON RIMS for ~8 s before the tyres give up', tRims >= 0 ? `${((t1 - tRims) / 60).toFixed(1)} s` : 'never rimmed');
  check(c.spiked && v1 > 110 && v1 < 165, 'after the rim run the car is limping at ~150', `v ${Math.round(v1)}`);
}
console.log(fails ? `PRESSURE FAIL (${fails})` : 'PRESSURE OK');
process.exit(fails ? 1 : 0);

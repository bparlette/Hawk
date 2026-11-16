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
  run(s, 16);
  check(s.stars === 1, 'control: at 2 stars (no chopper) alone in the open, a star cools in ~14 s', `stars ${s.stars}`);
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
console.log(fails ? `PRESSURE FAIL (${fails})` : 'PRESSURE OK');
process.exit(fails ? 1 : 0);

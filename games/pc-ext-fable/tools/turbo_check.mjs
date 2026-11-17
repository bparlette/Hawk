// turbo_check.mjs — 7D: the A button is PUNCH on foot and TURBO in a car, on the real sim.
// Checks: the label/action flips on car enter and exit; a job vehicle shows its job action instead;
// a wreck shows nothing; held turbo tops out measurably above an unboosted run (~1.4x); it burns
// out after TURBO.burn seconds, locks for TURBO.cool, then works again; a tap of A in a car never
// throws a punch.   Usage: node tools/turbo_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { buttonA, TURBO } from '../src/controls.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
function fresh() {
  const ev = [], s = new Sim(world, M, 9, (n) => ev.push(n));
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked); s.addStars = () => {};
  return { s, ev };
}
const lab = (s) => { const a = buttonA(s); return a ? a.label : null; };
// top speed over a long straight: the car is held on the top road heading east and re-placed so it never runs out of road
function topSpeed(turbo) {
  const { s } = fresh(), c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  let top = 0;
  for (let i = 0; i < 150; i++) { c.x = 700; c.y = 180; c.h = 0; s.step(DT, inp({ keys: { up: true }, turbo })); top = Math.max(top, c.v); }
  return top;
}
{ // label flips with the mode, through the real action button
  const { s } = fresh(), P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
  check(lab(s) === 'PUNCH', 'on foot the A button is PUNCH', String(lab(s)));
  P.ped.x = c.x + 22; P.ped.y = c.y;
  s.step(DT, inp({ action: true }));
  check(P.mode === 'car' && lab(s) === 'TURBO', 'get in a car (action button) and it becomes TURBO', `${P.mode} ${lab(s)}`);
  s.step(DT, inp({ punch: true, turbo: true }));
  check(!(P.punchN > 0), 'pressing A in a car does not throw a punch');
  for (let i = 0; i < 5; i++) s.step(DT, inp());
  s.step(DT, inp({ action: true }));
  check(P.mode === 'foot' && lab(s) === 'PUNCH', 'get out and it is PUNCH again', `${P.mode} ${lab(s)}`);
}
{ // a job vehicle: the job action owns the button until the job is running
  const { s } = fresh(), P = s.player, c = s.cars.find(k => k.job === 'taxi');
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  check(/^START/.test(lab(s) || ''), 'in a job vehicle the A button is the job action', String(lab(s)));
  s.step(DT, inp({ punch: true, turbo: true }));
  check(!!s.job && lab(s) === 'TURBO', 'once the job is running (no job action armed) it is TURBO', `job ${s.job && s.job.kind} label ${lab(s)}`);
}
{ // a wreck offers nothing
  const { s } = fresh(), P = s.player, c = s.cars.find(k => k.model === 'conv_mint');
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true; c.wreck = true;
  check(buttonA(s) === null, 'a wrecked car shows no A action (never a dead button)');
}
{ // speed
  const base = topSpeed(false), fast = topSpeed(true);
  check(fast > base * 1.3 && fast < base * (TURBO.mult + 0.05), 'held turbo tops out well above an unboosted run', `${base.toFixed(0)} → ${fast.toFixed(0)} u/s (x${(fast / base).toFixed(2)})`);
}
{ // burn, lockout, recovery
  const { s, ev } = fresh(), c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  const hold = (n) => { for (let i = 0; i < n; i++) { c.x = 700; c.y = 180; c.h = 0; s.step(DT, inp({ keys: { up: true }, turbo: true })); } };
  hold(60);
  check(c.turbo > 0.9 && ev.includes('turbo'), 'turbo engages while held');
  hold(Math.round(TURBO.burn * 60));
  check(c.turboLock > 0 && lab(s) === 'COOLING' && ev.includes('turbo_out'), `it burns out after ${TURBO.burn} s and the button reads COOLING`, `lock ${c.turboLock.toFixed(2)}`);
  hold(60);
  check(c.turbo === 0, 'no boost during the cooldown', `turbo ${c.turbo.toFixed(2)}`);
  hold(Math.round(TURBO.cool * 60));
  check(lab(s) === 'TURBO' && c.turbo > 0.5, `after ${TURBO.cool} s it is back`, `${lab(s)} turbo ${c.turbo.toFixed(2)}`);
}
{ // let go: speed eases back, it does not snap
  const { s } = fresh(), c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  for (let i = 0; i < 120; i++) { c.x = 700; c.y = 180; c.h = 0; s.step(DT, inp({ keys: { up: true }, turbo: true })); }
  const v0 = c.v; c.x = 700; s.step(DT, inp({ keys: { up: true } }));
  check(v0 - c.v < 6, 'releasing turbo eases the speed back, no snap', `${v0.toFixed(0)} → ${c.v.toFixed(0)} in one step`);
}
console.log(fails ? `TURBO FAIL (${fails})` : 'TURBO OK'); process.exit(fails ? 1 : 0);

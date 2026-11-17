// owner_tuning_check.mjs — owner directives, Nov 16:
//   1. A DRIVEN car absorbs 3x the damage it used to before it is a wreck (HERO 0.6 -> 0.2 in
//      destruct.js); punching a car through its stages is exactly as fast as before (0.13/punch).
//   2. On a legal job (TAXI / TOW / BUS) the cops stand down: no new stars, no pursuit, no bust.
//      GETAWAY is a crime by design and keeps full enforcement.
// Usage: node tools/owner_tuning_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { carImpact, punchWorld, impactDamage } from '../src/destruct.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };
const press = (s) => s.step(DT, { ...none, punch: true });

function freshCar() {
  const s = new Sim(world, M, 9, () => {});
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked);
  const c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  c.x = 600; c.y = 800; c.h = 0; c.v = 0;
  return { s, c };
}
// start a real job the way jobs_check does: sit in the job vehicle, press the job button
function freshJob(kind) {
  const s = new Sim(world, M, 9, () => {});
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked);
  const c = s.cars.find(k => k.job === kind), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  c.x = 600; c.y = 800; c.h = 0; c.v = 0;
  press(s);
  return { s, c };
}
const pinnedCop = (s, c) => {
  const cop = s.addCar(c.x, c.y + 30, 0, 'police', 'police', { s: 0, dir: 1 });
  return (step) => { c.v = 0; cop.x = c.x; cop.y = c.y + 30; cop.v = 0; s.step(DT, none); return cop; };
};

// 1a. driving: one impact dents the driven car by exactly HERO x the raw impact damage
{
  const { s, c } = freshCar();
  carImpact(s, c, 200, 'player');
  check(Math.abs(c.dmg - impactDamage(200) * 0.2) < 1e-9, 'one crash dents the driven car at the new HERO rate', `dmg ${c.dmg.toFixed(4)}`);
}
// 1b. driving: hits-to-wreck is 3x the old count (continuous expectation, +-1 for stage rounding)
{
  const { s, c } = freshCar();
  let hits = 0;
  while (!c.wreck && hits < 500) { s.time += 0.31; carImpact(s, c, 200, 'player'); hits++; }
  const oldContinuous = 1 / (impactDamage(200) * 0.6);
  check(c.wreck && Math.abs(hits - 3 * oldContinuous) <= 1, 'driven car takes 3x the crashes to wreck', `${hits} hits vs old ~${oldContinuous.toFixed(1)}`);
}
// 1c. an AI car at the same speed still wrecks at the un-heroed rate
{
  const { s } = freshCar();
  const c = s.cars.find(k => k !== s.player.car && !k.job);
  c.driver = 'ai'; c.parked = false; c.x = 300; c.y = 300; c.h = 0;
  let hits = 0;
  while (!c.wreck && hits < 500) { s.time += 0.31; carImpact(s, c, 200, 'world'); hits++; }
  check(hits === Math.ceil(1 / impactDamage(200)), 'AI car wreck rate unchanged', `${hits} hits`);
}
// 1d. punches: same count to wreck a parked car as before the change (0.13 per punch -> 8)
{
  const { s } = freshCar();
  const c = s.cars.find(k => k !== s.player.car && !k.job);
  c.x = 400; c.y = 400; c.h = 0;
  const p = s.player.ped;
  s.player.mode = 'foot'; p.hidden = false; p.x = c.x; p.y = c.y + c.wid / 2 + 8; p.h = -Math.PI / 2;
  let punches = 0;
  while (!c.wreck && punches < 50) { if (punchWorld(s, p)) punches++; else break; }
  check(c.wreck && punches === 8, 'punching a car to a wreck still takes 8 punches', `${punches} punches`);
}
// 2a. legal jobs: stars cannot rise while the job runs
for (const kind of ['taxi', 'tow', 'bus']) {
  const { s } = freshJob(kind);
  check(!!s.job && s.legalJob(), `${kind}: job started and reads as legal`);
  s.addStars(3, 'test');
  check(s.stars === 0, `${kind}: addStars is a no-op on a legal job`);
}
// 2b. legal job: a pinned stop next to a cop never busts, and the cop stands down to traffic
{
  const { s, c } = freshJob('taxi');
  s.stars = 3;                                    // heat from before the job: enforcement still pauses
  const pin = pinnedCop(s, c);
  let cop;
  for (let i = 0; i < 300; i++) cop = pin(i);
  check(!s.busted, 'taxi: 5 s pinned beside a cop is NOT busted');
  check(cop.driver === 'ai', 'taxi: the pursuing cop stands down to traffic', `driver=${cop.driver}`);
}
// 2c. getaway: enforcement is fully intact
{
  const { s, c } = freshJob('getaway');
  check(!!s.job && !s.legalJob(), 'getaway: job started and does NOT read as legal');
  s.addStars(2, 'test');
  check(s.stars === 2, 'getaway: stars still rise');
  const pin = pinnedCop(s, c);
  let t = null;
  for (let i = 0; i < 600 && t === null; i++) { pin(i); if (s.busted) t = i * DT; }
  check(t !== null, 'getaway: a pinned stop still busts', t === null ? 'never' : `${t.toFixed(2)} s`);
}
// 2d. no job: enforcement unchanged (the bust_check scenario still busts)
{
  const { s, c } = freshCar();
  s.stars = 2;
  const pin = pinnedCop(s, c);
  let t = null;
  for (let i = 0; i < 600 && t === null; i++) { pin(i); if (s.busted) t = i * DT; }
  check(t !== null, 'no job: a pinned stop still busts', t === null ? 'never' : `${t.toFixed(2)} s`);
}
console.log(fails ? `OWNER TUNING FAIL (${fails})` : 'OWNER TUNING OK');
process.exit(fails ? 1 : 0);

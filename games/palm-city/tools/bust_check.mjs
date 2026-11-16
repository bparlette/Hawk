// bust_check.mjs — 7C: the open-world bust is a driving failure, not a timer. Three scripted bots on the real sim:
//   A: driving at speed with a cop alongside for 10 s is NOT busted; B: stopped / pinned is busted inside ~3 s;
//   C: crash, then recover: the meter drains. Usage: node tools/bust_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };
function fresh() {
  const s = new Sim(world, M, 9, () => {});
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked); s.stars = 2; s.addStars = () => {};
  const c = s.cars.find(k => k.model === 'conv_mint'), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  c.x = 600; c.y = 800; c.h = 0; c.v = 0;
  const cop = s.addCar(600, 830, 0, 'police', 'police', { s: 0, dir: 1 });
  return { s, c, cop };
}
// the cop rides alongside (kept within 40 units of the car, as a boxed-in/pursuing cruiser would be)
const stepBot = (s, c, cop, v) => { cop.x = c.x; cop.y = c.y + 30; cop.h = c.h; cop.v = v; if (v != null) c.v = v; s.step(DT, none); };
{ // A
  const { s, c, cop } = fresh(); let max = 0;
  for (let i = 0; i < 600; i++) { c.x = 600 + (i % 300); c.y = 800; stepBot(s, c, cop, 200); max = Math.max(max, s.bustT); if (s.busted) break; }
  check(!s.busted && max === 0, 'A: 10 s at speed (200 u/s) with a cop alongside is NOT busted; the meter never fills', `max bustT ${max.toFixed(2)}`);
}
{ // B
  const { s, c, cop } = fresh(); let t = null;
  for (let i = 0; i < 600 && t === null; i++) { c.v = 0; cop.x = c.x; cop.y = c.y + 30; cop.v = 0; s.step(DT, none); if (s.busted) t = i * DT; }
  check(t !== null && t > 2 && t < 3.3, 'B: stopped and pinned by a cop is busted in about 3 s (2.8 s fill)', t === null ? 'never' : `${t.toFixed(2)} s`);
}
{ // C
  const { s, c, cop } = fresh();
  for (let i = 0; i < 90; i++) { c.v = 0; cop.x = c.x; cop.y = c.y + 30; cop.v = 0; s.step(DT, none); }
  const peak = s.bustT; check(peak > 1.2 && !s.busted, 'C: a crash that pins you fills the meter', `${peak.toFixed(2)} s of 2.8`);
  for (let i = 0; i < 30; i++) { c.x += 3.3; stepBot(s, c, cop, 200); }
  check(s.bustT < peak - 1 && !s.busted, 'C: driving off drains it fast (3x the fill rate)', `${peak.toFixed(2)} → ${s.bustT.toFixed(2)} in 0.5 s`);
  for (let i = 0; i < 60; i++) { c.x += 3.3; stepBot(s, c, cop, 200); }
  check(s.bustT === 0, 'C: and it is empty again after a second of clean driving');
}
console.log(fails ? `\nBUST FAILED: ${fails}` : '\nBUST OK'); process.exit(fails ? 1 : 0);

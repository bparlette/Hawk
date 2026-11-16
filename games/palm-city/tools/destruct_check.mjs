// destruct_check.mjs — headless rule checks for the destruction pass (src/destruct.js), run on the
// real sim in Node. Usage: node tools/destruct_check.mjs   (exit 0 = all pass)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { DEBRIS_CAP, stageOf, impactDamage } from '../src/destruct.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const none = { jx: 0, jy: 0, jm: 0, action: false, keys: {} };
const fresh = () => { const ev = []; const s = new Sim(world, M, 7, (n, v) => ev.push(n)); s.events = ev; return s; };
const run = (s, secs, inp = none) => { for (let i = 0; i < secs * 60; i++) s.step(1 / 60, inp); };
// stand the player beside something and throw n punches through the real input path
const punchN = (s, n) => { for (let i = 0; i < n; i++) { s.step(1 / 60, { ...none, punch: true }); run(s, 0.45); } };
const clearCops = (s) => { s.cars = s.cars.filter(c => c.kind !== 'police'); };

// ---- cars
{
  const s = fresh(); clearCops(s);
  const c = s.cars.find(c => c.model === 'conv_mint');            // parked at 1302,1300 facing north
  const p = s.player.ped; p.x = c.x + 22; p.y = c.y; p.h = Math.PI;
  for (const o of s.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 60) o.x += 400;
  punchN(s, 1);
  check('a punch dents a parked car (scuff, not a wreck)', c.dmg > 0 && c.dmg < 0.25 && !c.wreck, `dmg ${c.dmg.toFixed(2)}`);
  check('the struck side panel takes the dent', c.dent[3] > 0 || c.dent[2] > 0, JSON.stringify(c.dent.map(v => +v.toFixed(2))));
  const stages = new Set();
  for (let i = 0; i < 12 && !c.wreck; i++) { punchN(s, 1); stages.add(stageOf(c.dmg, 'car')); }
  check('repeated punches pass through every stage, never binary', stages.has(1) && stages.has(2) && stages.has(3), [...stages].join(','));
  check('enough punches make a smoking wreck', c.wreck && c.dmg >= 1);
  run(s, 1);
  check('a wreck smokes (pooled puffs)', s.smoke.some(q => q.on));
  check('debris settles and stays', (run(s, 3), s.debris.filter(d => d.on).every(d => d.rest)), `${s.debris.filter(d => d.on).length} pieces`);
  check('punching cars scores', s.score > 0, `score ${s.score}`);
  p.x = c.x + 12; s.step(1 / 60, { ...none, action: true });
  check('a wreck cannot be jacked', s.player.mode === 'foot');
}
{
  // impact damage scales with speed: a slow nudge only scuffs, flat out crumples
  check('slow nudge (40 u/s) only scuffs', impactDamage(40) < 0.02 && impactDamage(40) > 0);
  check('city-speed crash (120) dents', impactDamage(120) > 0.05 && impactDamage(120) < 0.25);
  check('flat-out hit (290) crumples in one go', impactDamage(290) > 0.45 && impactDamage(290) < 1);
}
{
  // driving into a wall dents the leading panel, scaled by speed; the hero car takes less
  const s = fresh(); clearCops(s);
  const mk = (v) => { const c = s.addCar(560, 1140, -Math.PI / 2, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = v; return c; };
  // find a wall north of the start: drive until blocked
  const fast = mk(260); run(s, 1.5, { ...none, keys: { up: true } });
  check('a fast wall hit dents the front', fast.dent[0] > 0.1, `front ${fast.dent[0].toFixed(2)} dmg ${fast.dmg.toFixed(2)}`);
}
{
  // two cars meet: both are damaged; the lighter one more
  const s = fresh(); clearCops(s);
  const a = s.addCar(700, 1450, 0, 'sedan_coral', 'player'); s.player.mode = 'car'; s.player.car = a; s.player.ped.hidden = true; a.v = 240;
  const b = s.addCar(780, 1450, 0, 'sedan_plum', null, { parked: true });
  run(s, 0.6, { ...none, keys: { up: true } });
  check('a car crash damages both cars', a.dmg > 0.05 && b.dmg > 0.05, `player ${a.dmg.toFixed(2)} parked ${b.dmg.toFixed(2)}`);
  check('the parked car (lighter, not the hero) takes more', b.dmg > a.dmg);
}
{
  // a wrecked AI car stops for good; its driver bails out and runs
  const s = fresh(); clearCops(s);
  const c = s.cars.find(c => c.driver === 'ai');
  const before = s.peds.length;
  c.dmg = 0.95; s.step(1 / 60, none);
  const { hitCar } = await import('../src/destruct.js');
  hitCar(s, c, 0.1, 1, 0, 'world');
  check('its driver bails out', s.peds.length > before && s.peds.some(o => o.mode === 'flee' && Math.hypot(o.x - c.x, o.y - c.y) < 30));
  run(s, 2);
  check('a wrecked traffic car stops and stays', c.wreck && c.driver === null && Math.abs(c.v) < 1 && s.cars.includes(c));
  check('world-caused damage scores nothing', !s.score);
}
{
  // the player's car wrecked: dead, you have to get out
  const s = fresh(); clearCops(s);
  const c = s.addCar(700, 1450, 0, 'sedan_coral', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true;
  const { hitCar } = await import('../src/destruct.js');
  hitCar(s, c, 1, 1, 0, 'world');
  run(s, 1, { ...none, keys: { up: true } });
  check('a wrecked car will not drive', c.wreck && Math.abs(c.v) < 1, `v ${c.v.toFixed(1)}`);
  s.step(1 / 60, { ...none, action: true });
  check('you can climb out of a wreck', s.player.mode === 'foot');
}
{
  // debris is pooled and capped: no matter how much breaks, the pool never grows
  const s = fresh(); clearCops(s);
  const { burst, D } = await import('../src/destruct.js');
  for (let i = 0; i < 100; i++) burst(s, D.GLASS, 10, 700, 1450, 1, 0, 80, 1);
  check('debris pool is capped', s.debris.length === DEBRIS_CAP && s.debris.filter(d => d.on).length <= DEBRIS_CAP);
}
{
  // destruction in a cop's view feeds wanted
  const s = fresh();
  const c = s.cars.find(c => c.model === 'conv_mint');
  const cop = s.cars.find(c => c.kind === 'police'); cop.x = c.x - 120; cop.y = c.y; cop.v = 0;
  const p = s.player.ped; p.x = c.x + 22; p.y = c.y; p.h = Math.PI;
  for (let i = 0; i < 8 && s.stars === 0; i++) punchN(s, 1);
  check('smashing a car in a cop\'s view raises wanted', s.stars > 0, `stars ${s.stars}`);
}
console.log(fails ? `DESTRUCT FAIL (${fails})` : 'DESTRUCT OK');
process.exit(fails ? 1 : 0);

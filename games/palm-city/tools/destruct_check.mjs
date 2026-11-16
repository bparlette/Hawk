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
  check('debris settles and stays', (run(s, 3), s.debris.filter(d => d.on && d.born < s.time - 2).every(d => d.rest)), `${s.debris.filter(d => d.on).length} pieces`);
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
// ---- palms
{
  const s = fresh(); clearCops(s);
  const t = s.palms[10];                                  // promenade palm at 1290,880
  const p = s.player.ped; p.x = t.x - t.r - 8; p.y = t.y; p.h = 0;
  for (const o of s.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 80) o.x += 400;
  punchN(s, 1);
  check('a punch on a palm shakes it and marks it', t.dmg > 0 && t.stage === 0 && !!s.shakes[t.i]);
  const stages = new Set([t.stage]);
  for (let i = 0; i < 12 && !t.fall; i++) { punchN(s, 1); stages.add(t.stage); }
  check('punched palm cracks, cracks deeper, then snaps', stages.has(1) && stages.has(2) && stages.has(3), [...stages].join(','));
  check('it falls away from the punches', t.fall && t.fall.ax > 0.5, t.fall ? `fall dir ${t.fall.ax.toFixed(2)},${t.fall.ay.toFixed(2)}` : '');
  check('a snapped palm no longer blocks', !s.W.hitTrunk(t.x, t.y, 0));
  run(s, 1);
  check('it lands (thud, fronds)', t.fall.landed && s.events.includes('timber'));
  // walk across the log: a hop
  const hops = s.events.filter(e => e === 'hop').length;
  p.x = t.x + 30; p.y = t.y - 20; p.h = Math.PI / 2;
  run(s, 1, { ...none, jx: 0, jy: 1, jm: 0.6 });
  check('on foot you hop the fallen trunk', s.events.filter(e => e === 'hop').length > hops);
}
{
  // a slow car only scuffs a palm and stops; a fast one snaps it and ploughs on
  const s = fresh(); clearCops(s);
  const t = s.palms[10];
  const mk = (x, v) => { const c = s.addCar(x, 880, 0, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = v; return c; };
  const slow = mk(t.x - t.r - 26, 42); run(s, 2);
  check('a slow nudge only scuffs a palm', t.dmg > 0 && t.stage === 0 && !t.fall, `dmg ${t.dmg.toFixed(2)}`);
  s.cars = s.cars.filter(c => c !== slow);
  const fast = mk(1150, 150); run(s, 1.2, { ...none, keys: { up: true } });
  check('a fast car snaps the palm', !!t.fall, `dmg ${t.dmg.toFixed(2)}`);
  check('and keeps going, slower', fast.x > t.x, `car x ${fast.x.toFixed(0)}`);
  check('the car takes its own damage', fast.dmg > 0.05, `car dmg ${fast.dmg.toFixed(2)}`);
}
{
  // a falling palm crushes what it lands on
  const s = fresh(); clearCops(s);
  const t = s.palms[10];
  const victim = s.addCar(t.x - 70, t.y, 0, 'sedan_cream', null, { parked: true });
  const { hitThing } = await import('../src/destruct.js');
  hitThing(s, t, 1, -1, 0, 'player', 0);                  // hit from the east: it falls west, onto the car
  run(s, 1);
  check('a falling palm crushes the car it lands on', victim.dmg >= 0.5, `car dmg ${victim.dmg.toFixed(2)}`);
}
// ---- bushes
{
  const s = fresh(); clearCops(s);
  check('sim and renderer share the 141 seeded bushes', s.bushes.length === world.bushes.length && s.bushes.length > 100, `${s.bushes.length}`);
  // an isolated bush with open ground to its west (so every punch lands on it)
  const t = s.bushes.find(b => !s.bushes.some(o => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 40) && s.canStand(b.x - b.r - 8, b.y) && !s.W.hitTrunk(b.x - 20, b.y, 10));
  const p = s.player.ped; p.x = t.x - t.r - 8; p.y = t.y; p.h = 0;
  for (const o of s.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 80) o.x += 400;
  const stages = [];
  for (let i = 0; i < 4 && t.stage < 3; i++) { punchN(s, 1); stages.push(t.stage); }
  check('punches shear, flatten, then tear a bush out', stages.join(',') === '1,2,3', stages.join(','));
  check('a torn-out bush throws leaves, petals and soil', s.debris.filter(d => d.on && (d.kind === 4 || d.kind === 10 || d.kind === 6)).length >= 10);
  const P = s.player; p.x = t.x - 40; run(s, 0.8, { ...none, jx: 1, jy: 0, jm: 1 });
  check('you still walk through bushes', p.x > t.x);
}
{
  const s = fresh(); clearCops(s);
  const near = s.bushes.filter(b => Math.hypot(b.x - 198, b.y - 1771) < 30);
  const c = s.addCar(34, 1771, 0, 'sedan_coral', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 120;
  run(s, 1.6, { ...none, keys: { up: true } });
  check('a car ploughs through a cluster without stopping', c.x > 230, `x ${c.x.toFixed(0)}`);
  check('the bushes it ran over are flattened or torn out', near.filter(b => b.stage >= 2).length >= 2, near.map(b => b.stage).join(','));
  check('nothing breaks below walking pace', (() => { const s2 = fresh(); const b = s2.bushes[0]; const c2 = s2.addCar(b.x - 30, b.y, 0, 'sedan_teal', null); c2.v = 20; run(s2, 1); return b.dmg === 0; })());
}
// ---- benches and street props
{
  const s = fresh(); clearCops(s);
  const bt = s.benches[2].thing;                          // promenade bench at 1300,1420 (along y)
  const p = s.player.ped; p.x = bt.x - 22; p.y = bt.y; p.h = 0;
  for (const o of s.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 80) o.x += 400;
  const stages = new Set();
  for (let i = 0; i < 8 && bt.stage < 3; i++) { punchN(s, 1); stages.add(bt.stage); }
  check('punched bench cracks, snaps in half, collapses', stages.has(1) && stages.has(2) && stages.has(3), [...stages].join(','));
  check('a collapsed bench no longer blocks (or counts for ollies)', !s.obst.some(o => o.thing === bt) && s.benches[2].broken);
}
{
  const s = fresh(); clearCops(s);
  const bt = s.benches[2].thing;
  const mk = (x, v) => { const c = s.addCar(x, bt.y, 0, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = v; return c; };
  const slow = mk(bt.x - 34, 40); run(s, 1.5);
  check('a slow nudge only scuffs a bench, and the car stops', bt.stage <= 1 && slow.x < bt.x, `bench dmg ${bt.dmg.toFixed(2)} car x ${slow.x.toFixed(0)}`);
  s.cars = s.cars.filter(c => c !== slow);
  const fast = mk(1150, 160); run(s, 1.4, { ...none, keys: { up: true } });
  check('a fast car smashes through the bench and carries on', bt.stage >= 3 && fast.x > bt.x, `bench ${bt.stage} car x ${fast.x.toFixed(0)}`);
  check('the car pays for it', fast.dmg > 0.05, `car dmg ${fast.dmg.toFixed(2)}`);
}
{
  const s = fresh(); clearCops(s);
  const L = s.lamps[6];                                   // 1230,1100
  const c = s.addCar(L.x, L.y - 150, Math.PI / 2, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 120;
  run(s, 1.5, { ...none, keys: { up: true } });
  check('a car clips a street lamp: it goes down', L.stage >= 2, `lamp ${L.stage} dmg ${L.dmg.toFixed(2)}`);
  check('the car takes a dent and a jolt', c.dmg > 0, `car dmg ${c.dmg.toFixed(3)}`);
  const s2 = fresh(); clearCops(s2);
  const L2 = s2.lamps[6], p = s2.player.ped; p.x = L2.x - 12; p.y = L2.y; p.h = 0;
  for (const o of s2.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 80) o.x += 400;
  const st = new Set(); for (let i = 0; i < 10 && L2.stage < 3; i++) { punchN(s2, 1); st.add(L2.stage); }
  check('punched lamp skews, bends, falls', st.has(1) && st.has(2) && st.has(3), [...st].join(','));
}
{
  const s = fresh(); clearCops(s);
  const T = s.towers.find(Boolean);                       // lifeguard tower at 1354,640
  const c = s.addCar(1190, T.y, 0, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 200;
  run(s, 1.5, { ...none, keys: { up: true } });
  check('a fast car wrecks a lifeguard tower', T.stage >= 2, `tower ${T.stage} dmg ${T.dmg.toFixed(2)}`);
  const n0 = s.score;
  check('smashing street props scores', n0 > 0, `score ${n0}`);
}
{
  // rails: the fence line breaks a section at a time; a bent section can't be grinded
  const s = fresh(); clearCops(s);
  const r = s.rails[1];                                   // promenade rail x=1334, y 1080..2120
  const c = s.addCar(1200, 1250, 0, 'sedan_teal', 'player'); s.player.mode = 'car'; s.player.car = c; s.player.ped.hidden = true; c.v = 200;
  run(s, 1, { ...none, keys: { up: true } });
  const hit = r.segs.filter(g => g.stage > 0);
  check('a car crossing a rail breaks just the section it hit', hit.length >= 1 && hit.length <= 2 && hit[0].stage >= 2, hit.map(g => g.k + ':' + g.stage).join(','));
  const { railBroken } = await import('../src/destruct.js');
  check('a broken section is not grindable; the rest still is', railBroken(r, hit[0].s0 + 5) && !railBroken(r, 900));
}
console.log(fails ? `DESTRUCT FAIL (${fails})` : 'DESTRUCT OK');
process.exit(fails ? 1 : 0);

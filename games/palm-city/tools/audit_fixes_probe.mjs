// audit_fixes_probe.mjs — regression probes for the Nov 17 whole-game audit FIX-FIRST
// items H1/H2/M2/M3 (fixed Nov 18, Moth). Node only, on the real Sim, through the real
// jump() path. Usage: node tools/audit_fixes_probe.mjs  (exit 0 = all pass)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { EVENTS } from '../src/events.js';
import { gridCar } from '../src/openroad.js';
import { jump } from '../src/activities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const sj = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell.json')));
const sl = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell_layout.json')));
const shell = { ...sj, buildings: sl.buildings, palms: sl.palms, extraRoads: sl.roads };
const world = new World(layout, shell);

let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60;
const none = { jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {} };
const run = (s, secs) => { for (let i = 0; i < secs * 60; i++) s.step(DT, none); };
const SITE = EVENTS.openroad.site;

function fresh() {
  const s = new Sim(world, M, 9, () => {});
  s.spawnTraffic = () => null; s.spawnPed = () => null;
  s.cars = s.cars.filter(c => c.parked); s.peds = [s.player.ped];
  s.stars = 0;
  return s;
}
function rideJetski(s) {
  const cr = s.water.craft[0], P = s.player;
  cr.ridden = true; s.water.ride = cr;
  P.mode = 'water'; P.ped.x = cr.x; P.ped.y = cr.y;
  return cr;
}

// H1a: JUMP from a mounted jetski to the MOTEL (a foot target) used to snap back —
// the player stayed in 'water' mode and the next stepCraft re-seated them.
{
  const s = fresh(); const cr = rideJetski(s);
  const ok = jump(s, 'motel');
  check(ok && s.player.mode === 'foot' && cr.ridden === false && s.water.ride === null &&
    Math.hypot(cr.x - cr.home.x, cr.y - cr.home.y) < 1,
    'H1a JUMP jetski->MOTEL leaves the water, craft freed and home',
    `mode=${s.player.mode} ridden=${cr.ridden}`);
}
// H1b: JUMP from a mounted jetski to TAXI (a job) used to strand the craft ridden forever.
{
  const s = fresh(); const cr = rideJetski(s);
  const ok = jump(s, 'taxi');
  check(ok && s.player.mode === 'car' && cr.ridden === false && s.water.ride === null &&
    Math.hypot(cr.x - cr.home.x, cr.y - cr.home.y) < 1,
    'H1b JUMP jetski->TAXI seats the cab, craft freed and home',
    `mode=${s.player.mode} ridden=${cr.ridden}`);
}
// M3: BOATS JUMP with the jetski out in the bay used to place the player in open water.
{
  const s = fresh(); const cr = s.water.craft[0];
  cr.x = 2200; cr.y = 2300;   // the jetski is nowhere near its mooring
  const P = s.player; P.mode = 'foot'; P.ped.x = 900; P.ped.y = 900;
  const ok = jump(s, 'boats');
  check(ok && Math.hypot(cr.x - cr.home.x, cr.y - cr.home.y) < 1 && s.canStand(P.ped.x, P.ped.y),
    'M3 BOATS JUMP brings the jetski home and lands the player on the pier',
    `player at ${Math.round(P.ped.x)},${Math.round(P.ped.y)} canStand=${s.canStand(P.ped.x, P.ped.y)}`);
}
// M2: JUMP -> OPEN ROAD from the start page used to seat a borrowed sedan and stack
// the race car on top. Now: on foot in the circle beside the grid car, singleton intact.
{
  const s = fresh();   // no steps yet — the JUMP arrives before stepEvents ever ran
  const ok = jump(s, 'openroad');
  const roses = s.cars.filter(c => c.openroad);
  check(ok && s.player.mode === 'foot' && roses.length === 1 &&
    Math.hypot(s.player.ped.x - SITE[0], s.player.ped.y - SITE[1]) < 70,
    'M2 JUMP->OPEN ROAD lands on foot in the circle, one grid car waiting',
    `mode=${s.player.mode} roses=${roses.length}`);
  run(s, 1);
  check(s.cars.filter(c => c.openroad).length === 1 && s.player.mode === 'foot',
    'M2 still exactly one grid car after a second of steps');
}
// H2: loop traffic shoving the grid car out of its circle used to breed duplicates.
{
  const s = fresh(); run(s, 0.3);
  const g = gridCar(s);
  check(!!g, 'H2 grid car exists at idle');
  for (let i = 0; i < 6; i++) { g.x += 35; run(s, 0.2); }   // six 35-unit nudges
  const roses = s.cars.filter(c => c.openroad);
  check(roses.length === 1 && roses[0] === g && Math.hypot(g.x - SITE[0], g.y - SITE[1]) < 30,
    'H2 six nudges leave ONE grid car, home in the circle', `roses=${roses.length}`);
}

console.log(fails ? `AUDIT-FIXES FAIL (${fails})` : 'AUDIT-FIXES OK');
process.exit(fails ? 1 : 0);

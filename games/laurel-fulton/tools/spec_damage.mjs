// spec_damage.mjs — car damage, Palm City's numbers + Laurel's self-heal (owner, Nov 17 2026:
// "beat each other's cars exact same way as palm city even fire. But after 10 seconds back to
// normal no matter what stage it was in. Self healing").
// Proves: (1) a head-on at closing ~290 damages BOTH cars by Palm City's formula, the driven
// car taking HERO (0.2) of its share; (2) repeated hits climb the stages to a wreck at dmg 1;
// (3) a wreck won't drive; (4) 10 s after the LAST hit the car is fully healed — dents, glass,
// wreck — and a fresh hit at 9 s restarts the clock.
//   node tools/spec_damage.mjs     exit 0 = green
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/graph.json'))), ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roster.json')));
const FLEET = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/fleet.json')));
const BUMPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bumps.json'))).bumps;
const { GraphWorld } = await import('../src/world_graph.js');
const { LFSim, impactDamage, stageOfCar, HERO } = await import('../src/lf_sim.js');
const W = new GraphWorld(G), DT = 1 / 60;
const S = new LFSim(W, ROSTER, FLEET, { spawn: { x: 0, y: 0 }, bumps: BUMPS });
const me = S.player;
// a second, unparked car to beat on (a parked crew car, woken up)
const other = S.cars.find(c => c !== me && c.parked); other.parked = false;

// --- 1: one head-on, closing 290: expected share per car = impactDamage(290) x 1.5 x 0.5
function headOn(sp, keepDmg = false) {
  me.x = 0; me.y = 0; me.h = 0; me.dirx = 1; me.diry = 0; me.v = sp / 2; me.hitT = -9;
  other.x = (me.len + other.len) / 4 + (me.wid + other.wid) / 4 - 2; other.y = 0; other.h = Math.PI; other.dirx = -1; other.diry = 0; other.v = sp / 2; other.hitT = -9;
  if (!keepDmg) { me.dmg = 0; me.wreck = false; other.dmg = 0; other.wreck = false; }
  S.step(DT, {});
  return [me.dmg, other.dmg];
}
const [dMe, dOther] = headOn(290);
const share = impactDamage(290) * 1.5 * 0.5;
check(Math.abs(dOther - share) < 0.02, 'head-on at 290: the other car takes Palm City\u2019s share', `got ${dOther.toFixed(3)}, formula ${share.toFixed(3)}`);
check(Math.abs(dMe - share * HERO) < 0.01, 'the driven car takes HERO (0.2) of its share', `got ${dMe.toFixed(3)}, expected ${(share * HERO).toFixed(3)}`);
check(stageOfCar(dOther) >= 1, 'one hard hit already dents (stage >= 1)', `stage ${stageOfCar(dOther)}`);

// --- 2: keep hitting the other car until it wrecks
let guard = 0;
while (!other.wreck && guard++ < 12) headOn(290, true);
check(other.wreck && other.dmg >= 1, 'repeated flat-out hits wreck it (dmg 1, stage 3)', `after ${guard} hits dmg=${other.dmg.toFixed(2)}`);

// --- 3: a wreck won't drive
other.x = 0; other.y = 5000; other.v = 0;
S.driveCar(other, 1, 0, 0.5, 290);
check(other.v === 0, 'a wrecked car does not move under full throttle', `v=${other.v}`);

// --- 4: self-heal: still wrecked at 9.9 s, pristine at 10 s after the last hit
other.hitT = S.time;
for (let i = 0; i < Math.round(9.9 / DT); i++) S.step(DT, {});
check(other.wreck, 'still wrecked 9.9 s after the last hit');
S.step(DT * 12, {});   // step past the 10 s mark
check(!other.wreck && other.dmg === 0 && other.dent.every(d => d === 0) && other.glass.every(g => g === 0), 'at 10 s it is back to normal — wreck, damage, dents, glass all cleared', `dmg=${other.dmg} wreck=${other.wreck}`);
check(S.events.some(e => e.kind === 'healed' && e.model === other.model), 'a healed event fired');

// --- 5: a fresh hit restarts the clock
other.dmg = 0.5; other.hitT = S.time - 9;                  // hit 9 s ago...
S.hitCar(other, 0.1, 1, 0);                                  // ...and again just now
for (let i = 0; i < Math.round(9.9 / DT); i++) S.step(DT, {});
check(other.dmg > 0, 'a hit at 9 s restarts the 10 s clock (still damaged 9.9 s later)', `dmg=${other.dmg.toFixed(2)}`);
for (let i = 0; i < 30; i++) S.step(DT, {});
check(other.dmg === 0, 'then it heals once 10 quiet seconds pass', `dmg=${other.dmg}`);

console.log(fails ? `SPEC DAMAGE FAILED (${fails})` : 'SPEC DAMAGE OK');
process.exit(fails ? 1 : 0);

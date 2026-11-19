// spec_drift.mjs — TEST-FIRST spec for DRIFT BANKING (src/lf_drift.js, owner Nov 18).
//   node tools/spec_drift.mjs        (from games/laurel-fulton/)   exit 0 = green
// Two layers. (1) The banking mechanics driven directly at stepDrift with a fabricated car:
// bank grows at slip x speed with a rising chain multiplier, grip for ~0.5 s cashes it in,
// a straight-line launch (high slip, no lateral load) banks nothing, loseDrift wipes the bank
// without touching the total. (2) Integration on the REAL Laurel map: the player's car, driven
// through the real sim (real skid slip, real physics), banks by circling at full lock, cashes
// in when it coasts back to grip, and loses the bank when it is driven hard into a building.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const DR = await import('../src/lf_drift.js');
const AREAS = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
const W = new GraphWorld(G), DT = 1 / 60;
const S = new LFSim(W, ROSTER, FLEET, { bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green });
const D = S.drift;

// ---------- (1) the mechanics, driven directly ----------
check(!!D && D.bank === 0 && D.total === 0 && Array.isArray(D.popups), 'drift state initialised on the sim by LFSim');
const fake = { x: 0, y: 0, v: 220, z: 0, spinT: 0, model: 'spec' };
for (let i = 0; i < 180; i++) DR.stepDrift(S, fake, 0.8, 1, 1, DT);          // 3 s of hard drift: slip .8, 220 u/s, full lock
check(D.bank > 300 && D.bank < 650, 'bank grows at slip x speed (~420 expected over 3 s)', `bank ${D.bank.toFixed(0)}`);
check(Math.abs(D.mult - 2.2) < 0.06, 'chain multiplier grows with the unbroken drift (1 + 0.4 x 3 s = x2.2)', `x${D.mult.toFixed(2)}`);
for (let i = 0; i < 24; i++) DR.stepDrift(S, fake, 0, 0, 1, DT);             // 0.4 s of grip: not yet
check(D.bank > 0 && D.total === 0, 'no cash-in before ~0.5 s of grip');
for (let i = 0; i < 12; i++) DR.stepDrift(S, fake, 0, 0, 1, DT);             // 0.6 s of grip: cashed
check(D.bank === 0 && D.total > 300, 'grip for ~0.5 s cashes the bank into the total', `total ${D.total}`);
check(S.events.some(e => e.kind === 'drift_cash' && e.pts === D.total), 'a drift_cash event carries the cashed points');
check(D.popups.some(p => p.kind === 'cash' && /DRIFT \+\d+/.test(p.txt)), 'a DRIFT +N popup is queued at the car', D.popups.map(p => p.txt).join(' '));
const totalAfterCash = D.total;
for (let i = 0; i < 120; i++) DR.stepDrift(S, fake, 0.9, 0, 1, DT);          // hard LAUNCH: slip .9 but steer 0 -> no lateral load
check(D.bank === 0, 'a straight-line launch banks nothing (slip without lateral load is not a drift)');
for (let i = 0; i < 120; i++) DR.stepDrift(S, fake, 0.8, 1, 1, DT);          // bank again...
check(D.bank > 100, 'bank rebuilds for the loss test', `bank ${D.bank.toFixed(0)}`);
DR.loseDrift(S, fake);
check(D.bank === 0 && D.total === totalAfterCash, 'loseDrift wipes the bank and leaves the total untouched');
check(S.events.some(e => e.kind === 'drift_lost'), 'a drift_lost event fires');
check(D.popups.some(p => p.kind === 'lost'), 'a DRIFT LOST popup is queued');

// ---------- (2) integration: the real car, the real map ----------
const P = S.player;
const place = (x, y, h) => { P.x = x; P.y = y; P.h = h; P.dirx = Math.cos(h); P.diry = Math.sin(h); P.v = 0; P.z = 0; P.vz = 0; P.dmg = 0; P.wreck = false; P.layer = 0; };
let spot = null;
for (const v of W.verts) { if (v && !S.nearBuilding(v.x, v.y, 300) && W.surfaceAt(v.x, v.y, 0) === 'road') { spot = v; break; } }
check(!!spot, 'found an open road spot (>= 300 units from any building) for the circle drift', spot ? `${spot.x | 0},${spot.y | 0}` : 'none');
if (spot) {
  place(spot.x, spot.y, 0);
  for (let i = 0; i < 120; i++) S.step(DT, { keys: { up: true } });                       // control: 2 s straight, full throttle
  check(D.bank === 0, 'real car, straight line at full throttle: no bank', `bank ${D.bank.toFixed(1)} v ${P.v.toFixed(0)}`);
  place(spot.x, spot.y, 0);
  let b1 = 0, b3 = 0;
  for (let i = 0; i < 180; i++) { S.step(DT, { keys: { up: true, left: true } }); if (i === 59) b1 = D.bank; if (i === 179) b3 = D.bank; }   // 3 s of full-lock circling
  check(b1 > 0, 'real drift banks within the first second', `bank@1s ${b1.toFixed(0)}`);
  check(b3 > b1 && b3 > 120, 'the bank keeps growing while the drift holds', `bank@3s ${b3.toFixed(0)}`);
  const totalBefore = D.total;
  for (let i = 0; i < 150 && D.bank > 0; i++) S.step(DT, { keys: {} });                    // coast: grip returns, the bank cashes
  check(D.bank === 0 && D.total > totalBefore, 'coasting back to grip cashes the real bank in', `total ${totalBefore} -> ${D.total}`);
  // lose it on a building: rebuild a bank synthetically, then drive hard at the biggest house
  P.v = 220; P.z = 0;                                                                          // pin the speed stepDrift reads (it never changes v itself)
  for (let i = 0; i < 120; i++) DR.stepDrift(S, P, 0.8, 1, 1, DT);
  check(D.bank > 100, 'bank rebuilt for the building test', `bank ${D.bank.toFixed(0)}`);
  const evMark = S.events.length;
  // Aim at the footprint's westmost VERTEX: the polygon boundary passes through it exactly, so
  // contact is a few steps away whatever the surface — well inside the 0.5 s grip window, the
  // bank still live at impact, as it is for a player who slides into a wall mid-drift. (Aiming
  // at a bbox centre is not a test: bboxes overhang the polygon, and a long approach is grip
  // driving, which cashes the bank first — by design.)
  let vx = null, vy = 0;
  for (let i = 0; i < AREAS.buildings.length && vx === null; i++) { const bb = S.houseBox[i], a = (bb[2] - bb[0]) * (bb[3] - bb[1]); if (a < 8000 || a > 150000) continue; const f = AREAS.buildings[i]; vx = 1e18; for (let k = 0; k < f.length; k += 2) if (f[k] < vx) { vx = f[k]; vy = f[k + 1]; } }
  check(vx !== null, 'found a house footprint for the wall test');
  place(vx - 30, vy, 0);
  const totalPre = D.total; let lost = false;
  for (let i = 0; i < 120 && !lost; i++) {
    if (Math.abs(P.v) < 230) P.v = 240;
    S.step(DT, { keys: { up: true } });
    lost = S.events.slice(evMark).some(e => e.kind === 'drift_lost');
  }
  check(lost && D.bank === 0, 'a hard building hit loses the bank (drift_lost fired, bank zeroed)');
  check(D.total === totalPre, 'the loss costs only the un-banked points — the total is untouched', `total ${D.total}`);
}
console.log(fails ? `FAIL: ${fails} check(s)` : 'ALL PASS'); process.exit(fails ? 1 : 0);

// spec_wanted.mjs — spec for WANTED GAUGES + STAR DECAY (src/lf_cops.js, owner Nov 18).
//   node tools/spec_wanted.mjs        (from games/laurel-fulton/)   exit 0 = green
// The cop system already ran two invisible timers — lostT (cooling) and bustT (the bust meter).
// This spec proves the gauges read them honestly: gain 2 stars with no chasers able to spawn
// (noSpawn/noPatrol — the player is unseen and away by construction), the ESCAPING fraction
// fills linearly, a star drops at ~20 s and the clock restarts, the second star follows ~20 s
// later; a chaser held close keeps the heat on (lostT pinned at 0); the same chaser held
// inside BUST_R with the player stopped fills the BUSTED fraction and completes the bust.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const { Traffic } = await import('../src/lf_traffic.js');
const CP = await import('../src/lf_cops.js');
const AREAS = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json'), BUMPS = J('data/bumps.json').bumps;
const W = new GraphWorld(G), DT = 1 / 60;
const S = new LFSim(W, ROSTER, FLEET, { bumps: BUMPS, buildings: AREAS.buildings, greens: AREAS.green });
const T = new Traffic(S, W, { seed: 7 });
const C = new CP.Cops(S, W, T, { seed: 7, noPatrol: true, noSpawn: true });
const P = S.player;
const step = (n) => { for (let i = 0; i < n; i++) { S.step(DT, { keys: {} }); T.step(DT); C.step(DT, { inCar: true }); } };

check(CP.COOL_TIME === 20, 'star decay is 20 s of unseen-and-away (the approved Gridline number)', `COOL_TIME ${CP.COOL_TIME}`);
check(typeof C.escapeFrac === 'function' && typeof C.bustFrac === 'function', 'the gauges are exposed on the Cops instance');

// two stars, the honest way (offense gap respected)
C.offense('collision'); step(210);
C.offense('collision');
check(C.level === 2, 'two offenses raise the level to 2', `level ${C.level}`);
step(600);                                                                                     // 10 s unseen and away
check(C.level === 2 && C.escapeFrac() > 0.42 && C.escapeFrac() < 0.58, 'at 10 s the ESCAPING gauge is half full and no star has dropped', `frac ${C.escapeFrac().toFixed(2)}`);
step(640);                                                                                     // ~20.7 s
check(C.level === 1, 'a star drops at ~20 s unseen', `level ${C.level}`);
check(C.lostT < 1.5 && C.escapeFrac() < 0.1, 'the decay clock restarts after the drop', `lostT ${C.lostT.toFixed(2)}`);
step(1240);                                                                                    // another ~20.7 s
check(C.level === 0 && C.escapeFrac() === 0, 'the second star decays ~20 s later and the gauge clears', `level ${C.level}`);

// heat: a chaser held close keeps lostT pinned at zero
C.offense('collision'); check(C.level === 1, 'wanted again for the heat test');
const cop = C.spawnPatrol(P.x + 120, P.y, 0);
for (let i = 0; i < 90; i++) { S.step(DT, { keys: {} }); T.step(DT); const cc = C.chasers[0] || cop; cc.x = P.x + 120; cc.y = P.y; cc.v = 0; C.step(DT, { inCar: true }); }
check(C.chasers.length === 1, 'the nearby patrol joined the pursuit', `${C.chasers.length} chaser(s)`);
check(C.lostT === 0 && C.escapeFrac() === 0, 'a chaser inside COOL_NEAR keeps the heat on: no escaping progress', `lostT ${C.lostT}`);

// busted: player stopped, chaser inside BUST_R — the meter fills and completes
let fracMid = 0;
for (let i = 0; i < 200 && !C.busted; i++) { S.step(DT, { keys: {} }); T.step(DT); const cc = C.chasers[0] || cop; cc.x = P.x + 60; cc.y = P.y; cc.v = 0; C.step(DT, { inCar: true }); if (i === 89) fracMid = C.bustFrac(); }
check(fracMid > 0.4 && fracMid < 0.85, 'the BUSTED gauge fills while pinned (~0.6 at 1.5 s)', `frac ${fracMid.toFixed(2)}`);
check(!!C.busted && C.hold === true && C.stats.busts === 1, 'the bust completes at BUST_TIME: BUSTED beat, input held, level cleared', `busts ${C.stats.busts} level ${C.level}`);
check(C.level === 0 && C.bustFrac() === 0, 'after the bust the gauges are clear');
console.log(fails ? `FAIL: ${fails} check(s)` : 'ALL PASS'); process.exit(fails ? 1 : 0);

// heli_check.mjs — the HOSPITAL HELICOPTER (heli.js), on the real sim:
//   - the hospital roof is walkable: in through the west parapet gap, and the parapet is solid
//     everywhere else
//   - STEAL on the roof: mode 'air' and +2 stars; flight crosses the city and the bay without ever
//     colliding; the camera zoom value opens up airborne
//   - LAND on a street: down, on foot, the heli parked and re-boardable for free; LAND over water
//     is refused and you stay airborne
//   - ram the police chopper: both crash — CHOPPER DOWN +1000, the police chopper gone; on land you
//     walk away from a wreck, over water you wash ashore and the heli is lost
//   - a wrecked/lost heli is replaced on the pad after 60 s
// Usage: node tools/heli_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { inRoof, landableAt, nearHeli } from '../src/heli.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
const fresh = () => {
  const s = new Sim(world, M, 7, () => {});
  s.spawnTraffic = () => null;
  s.cars = s.cars.filter(c => c.parked);
  s.peds = s.peds.filter(p => p.outfit === 'player');
  return s;
};
const steps = (s, n, i = inp()) => { for (let k = 0; k < n; k++) s.step(DT, i); };
const PAD = layout.hospital.pad;

{ // ---- the roof: in through the gap, solid everywhere else
  const s = fresh(), p = s.player.ped;
  p.x = 838; p.y = 1009;                                        // the sidewalk at the foot of the stairs
  steps(s, 240, inp({ jx: 1, jm: 1 }));
  check(s.player.roof && inRoof(s, p.x, p.y) && p.x > 900, 'walk east through the parapet gap and you are on the roof', `at ${Math.round(p.x)},${Math.round(p.y)}`);
  steps(s, 300, inp({ jx: -1, jm: 1 }));
  check(!s.player.roof && p.x < 860, 'walk back out through the gap and you are on the street again', `at ${Math.round(p.x)},${Math.round(p.y)}`);
  const s2 = fresh(), p2 = s2.player.ped;
  p2.x = 990; p2.y = 1160;                                      // the parking strip south of the hospital
  steps(s2, 240, inp({ jy: -1, jm: 1 }));
  check(!s2.player.roof && p2.y > 1130, 'the parapet is solid away from the gap', `stopped at y=${Math.round(p2.y)}`);
}

{ // ---- the landable matrix
  const s = fresh();
  check(landableAt(s, PAD[0], PAD[1]) === true, 'the pad is landable');
  check(landableAt(s, 780, 600) === true, 'a street is landable');
  check(landableAt(s, 1500, 1035) === true, 'the pier deck is landable');
  check(landableAt(s, 1600, 1009) === false, 'open water is not landable');
  check(landableAt(s, 990, 1265) === false, 'a nightclub roof is not landable');
}

// steal once, on a fresh sim, and hand back the airborne sim
function airborne() {
  const s = fresh(), p = s.player.ped;
  p.x = PAD[0] - 40; p.y = PAD[1];
  steps(s, 2);
  if (!nearHeli(s)) throw new Error('test setup: STEAL not armed on the roof');
  s.step(DT, inp({ action: true }));
  return s;
}

{ // ---- STEAL and flight
  const s = airborne(), H = s.heli;
  check(s.player.mode === 'air' && s.stars === 2, 'STEAL: airborne with +2 stars', `mode ${s.player.mode}, stars ${s.stars}`);
  H.x = 250; H.y = 300; H.state = 'fly'; H.alt = 1; H.vx = 0; H.vy = 0;   // the west edge: a full-map run east
  const x0 = H.x;
  steps(s, 60, inp({ jx: 1, jm: 1 }));                          // one second to bend up to speed
  const xa = H.x; steps(s, 60, inp({ jx: 1, jm: 1 }));
  check(H.x - xa > 380, 'top speed is scout-fast (~450 u/s)', `${Math.round(H.x - xa)} u in 1 s`);
  steps(s, 240, inp({ jx: 1, jm: 1 }));                          // keep going: across the city, the pier and out over the bay
  check(H.x > s.W.shoreX(H.y) + 150 && s.player.mode === 'air', 'flight crosses the city and out over the bay, never colliding', `x ${Math.round(x0)} -> ${Math.round(H.x)} (shore ~${Math.round(s.W.shoreX(H.y))})`);
  check(H.alt > 0.95 && H.zoom > 0.9, 'at cruise height the camera zoom value opens up', `alt ${H.alt.toFixed(2)}, zoom ${H.zoom.toFixed(2)}`);
}

{ // ---- LAND on a street, re-board for free
  const s = airborne(), H = s.heli, p = s.player.ped;
  H.x = 780; H.y = 600; H.state = 'fly'; H.alt = 1;
  s.step(DT, inp({ action: true }));
  check(H.state === 'landing', 'LAND over a street starts the descent');
  steps(s, 120);
  const d = Math.hypot(p.x - H.x, p.y - H.y);
  check(s.player.mode === 'foot' && H.state === 'parked' && !H.onRoof && d > 15 && d < 60, 'touchdown: on foot beside the parked heli', `ped-heli ${Math.round(d)} u`);
  check(H.zoom < 0.1, 'the camera settles back to walking width on the ground', `zoom ${H.zoom.toFixed(2)}`);
  const stars = s.stars;
  s.step(DT, inp({ action: true }));
  check(s.player.mode === 'air' && s.stars === stars, 're-boarding in the field is free (FLY, no new stars)', `stars ${s.stars}`);
}

{ // ---- LAND over water is refused
  const s = airborne(), H = s.heli;
  H.x = 1550; H.y = 1009; H.state = 'fly'; H.alt = 1;
  s.step(DT, inp({ action: true }));
  steps(s, 30);
  check(s.player.mode === 'air' && H.state === 'fly' && /NO LANDING/.test((s.msg && s.msg.text) || ''), 'LAND over the bay is refused — still airborne', `msg "${s.msg && s.msg.text}"`);
}

function duel(x, y) {                                            // an airborne sim + the police chopper, teleported together
  const s = airborne(), H = s.heli;
  s.stars = 3;
  for (let k = 0; k < 600 && !s.chopper; k++) s.step(DT, inp());
  if (!s.chopper) throw new Error('test setup: the police chopper never came');
  H.x = x; H.y = y; H.state = 'fly'; H.alt = 1; H.vx = 0; H.vy = 0;
  s.chopper.x = x + 15; s.chopper.y = y; s.chopper.bx = x + 15; s.chopper.by = y; s.chopper.lock = true;
  const score = s.score;
  steps(s, 3);
  return { s, H, score };
}

{ // ---- the duel, over land
  const { s, H, score } = duel(300, 1009), p = s.player.ped;
  check(s.chopper === null, 'the ram takes the police chopper down');
  check(s.score === score + 1000 && s.lastTrick && s.lastTrick.name === 'CHOPPER DOWN', 'CHOPPER DOWN +1000', `score ${score} -> ${s.score}`);
  steps(s, 120);
  check(s.player.mode === 'foot' && H.state === 'wreck' && s.canStand(p.x, p.y), 'the player walks away from the wreck', `heli ${H.state}, ped at ${Math.round(p.x)},${Math.round(p.y)}`);
  s.stars = 0;
  steps(s, 62 * 60);
  check(H.state === 'pad' && H.home && Math.hypot(H.x - PAD[0], H.y - PAD[1]) < 1, 'a replacement heli is on the pad after 60 s', `state ${H.state}`);
}

{ // ---- the duel, over the bay
  const { s, H } = duel(1500, 1009), p = s.player.ped;
  steps(s, 120);
  check(s.player.mode === 'foot' && H.state === 'gone' && s.canStand(p.x, p.y) && p.x < s.W.shoreX(p.y), 'over water: the heli is lost and the player washes ashore', `heli ${H.state}, ped at ${Math.round(p.x)},${Math.round(p.y)}`);
  s.stars = 0;
  steps(s, 62 * 60);
  check(H.state === 'pad' && H.home, 'the lost heli is also replaced on the pad after 60 s', `state ${H.state}`);
}

console.log(fails ? `HELI FAIL (${fails})` : 'HELI OK');
process.exit(fails ? 1 : 0);

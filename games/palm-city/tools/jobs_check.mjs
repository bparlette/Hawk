// jobs_check.mjs — rule checks for the Jobs Board (src/jobs.js) on the real sim in Node. The job
// button is pressed through the real input object (inp.punch while driving).
// Usage: node tools/jobs_check.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js';
import { Sim } from '../src/sim.js';
import { jobButton, PLACES, JOBS } from '../src/jobs.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const DT = 1 / 60, none = { jx: 0, jy: 0, jm: 0, keys: {} };
const run = (s, secs, f) => { for (let i = 0; i < secs * 60; i++) { if (f && f(i) === false) return; s.step(DT, none); } };
const press = (s) => s.step(DT, { ...none, punch: true });
function fresh(job, stars = 0) {
  const s = new Sim(world, M, 9, () => {});
  s.peds = [s.player.ped]; s.cars = s.cars.filter(c => c.parked);
  s.stars = stars; s.addStars = () => {};
  const add = s.addCar.bind(s); s.addCar = (...a) => a[4] === 'police' && !s.allowCops ? { v: 0 } : add(...a);
  const c = s.cars.find(k => k.job === job), P = s.player;
  P.mode = 'car'; P.car = c; c.driver = 'player'; c.parked = false; P.ped.hidden = true;
  return { s, c };
}
const put = (c, p, dx = 0) => { c.x = p[0] + dx; c.y = p[1]; c.v = 0; };
const score = (s) => s.score || 0;

// ---- the board
{
  const { s, c } = fresh('taxi');
  check(['taxi', 'tow', 'bus', 'getaway'].every(k => s.cars.some(q => q.job === k)), 'all four job vehicles are parked in the city');
  check(jobButton(s).label === 'START TAXI', 'in the cab the job button reads START TAXI');
  s.player.car = s.cars.find(k => !k.job); check(jobButton(s) === null, 'in an ordinary car there is no job button');
  s.player.car = c; press(s);
  check(s.job && s.job.kind === 'taxi' && s.job.phase === 'pickup', 'pressing it starts the job', s.job && s.job.spotName);
  s.exitCar(); run(s, 0.1);
  check(!s.job, 'getting out ends the job cleanly');
}
// ---- TAXI
{
  const { s, c } = fresh('taxi'); press(s);
  const j = s.job;
  put(c, j.spot); run(s, 0.1);
  check(j.phase === 'drop' && j.fare, 'stop at the halo and the fare gets in', j.fare && `${j.fare.type} → ${j.spotName}`);
  const s0 = score(s); j.fare.mood = 90;
  put(c, j.spot); run(s, 0.1);
  check(score(s) - s0 >= 300 && j.streak === 1 && j.phase === 'pickup', 'a happy drop pays double and starts a streak', `+${score(s) - s0}`);
  // moods
  put(c, j.spot); run(s, 0.1); j.fare.type = 'speed'; j.fare.mood = 50; j.timer = 99;
  run(s, 2, () => { c.x = 600; c.y = 800; c.v = 250; c.h = 0; });
  const up = j.fare.mood;
  run(s, 2, () => { c.x = 600; c.y = 800; c.v = 30; });
  check(up > 60 && j.fare.mood < up - 15, 'a Speed Freak cheers at 250 and sulks at a crawl', `${up.toFixed(0)} → ${j.fare.mood.toFixed(0)}`);
  j.fare.type = 'vip'; j.fare.mood = 50; c.dmg += 0.05; run(s, 0.05, () => { c.x = 600; c.y = 800; c.v = 100; });
  check(j.fare.mood < 34, 'a VIP loses 18 mood on a crash', j.fare.mood.toFixed(0));
  j.fare.type = 'speed'; j.fare.mood = 1; j.streak = 3;
  run(s, 1, () => { c.x = 600; c.y = 800; c.v = 20; });
  check(j.phase === 'pickup' && j.streak === 0, 'at zero mood the fare bails and the streak is gone');
  j.timer = 0.05; run(s, 0.2);
  check(!s.job, 'the clock running out ends the shift');
}
// the undercover fed
{
  let fedSeen = null;
  for (let seed = 0; seed < 30 && !fedSeen; seed++) {
    const { s, c } = fresh('taxi', 3); s.rnd = (() => { let a = seed * 7919 + 1; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    press(s); put(c, s.job.spot); run(s, 0.1);
    if (s.job.fare.fed) fedSeen = { s, c };
  }
  check(!!fedSeen, 'at 3 stars some fares are undercover feds');
  const { s, c } = fedSeen, j = s.job; j.timer = 99;
  run(s, 9, () => { c.x = 600; c.y = 800; c.v = 150; c.h = 0; return !j.fare.revealed; });
  check(j.fare.revealed && s.stars >= 4, 'a few seconds in, the fed blows cover and the heat jumps to 4 stars', `${j.fare.t.toFixed(1)} s`);
  const s0 = score(s);
  run(s, 0.5, () => { c.x = 600; c.y = 800; c.v = 275; });
  run(s, 0.5, () => { c.x = 600; c.y = 800; c.v = 90; return score(s) === s0; });
  check(score(s) - s0 === 600, 'flat out then hard on the brakes throws the fed: FED SHOOK +600');
  put(c, s.job.spot); run(s, 0.1); s.job.fare.fed = true; s.job.fare.revealed = true; s.job.timer = 99;
  run(s, 2, () => { c.v = 0; });
  check(!!s.busted, 'stop for a revealed fed and you are busted');
}
// ---- TOW
{
  const { s, c } = fresh('tow'); press(s);
  const j = s.job, t = j.target;
  check(t && t.towTarget && jobButton(s) === null, 'a marked car is the contract; no HOOK until you are close');
  c.x = 500; c.y = 1444; c.h = 0; c.v = 0; t.x = 440; t.y = 1444; t.h = 0;
  check(jobButton(s).label === 'HOOK', 'backed up to it, the button reads HOOK');
  press(s);
  check(j.hooked, 'HOOK latches the cable');
  let maxD = 0;
  run(s, 4, (i) => { c.v = Math.min(170, i * 1.5); c.h = 0; c.y = 1444; const d = Math.hypot(t.x - (c.x - c.len / 2), t.y - c.y); maxD = Math.max(maxD, d); });
  check(t.x > 650 && j.hooked && maxD <= JOBS.CABLE.max + 0.5, 'the payload follows on the cable, never past its length', `payload x ${Math.round(t.x)}, max ${maxD.toFixed(1)}`);
  // wrecking ball: a cruiser in the payload's path
  s.allowCops = true;
  const cop = s.addCar(t.x + 30, t.y, Math.PI / 2, 'police', null, { parked: true });
  const s0 = score(s);
  run(s, 1, () => { c.v = 170; c.h = 0; c.y = 1444; });
  check(cop.dmg > 0.2 && score(s) - s0 >= 250 && cop.towPaid, 'the swinging payload wrecks what it hits: cruiser smashed, +250 on top of the wreck', `cruiser dmg ${cop.dmg.toFixed(2)}`);
  cop.x = -999; if (!j.hooked) { t.x = c.x - 70; t.y = c.y; press(s); }
  // the sling flight needs a clear street ahead: the Garage kerb row (y 1444) now has the whole
  // job fleet parked on it by design (instant-start homes), so this phase stages on the open y 800 road
  c.x = 500; c.y = 800; c.h = 0; t.x = c.x - 70; t.y = 800;
  run(s, 1.5, () => { c.v = 170; c.h = 0; c.y = 800; c.x = Math.min(c.x, 1000); });
  check(jobButton(s).label === 'SLING', 'at speed the button reads SLING (second look)') ;
  const px = t.x; press(s); run(s, 0.8, () => { c.v = 0; });
  check(!j.hooked && t.x - px > 60, 'SLING lets the payload fly ahead on its own', `+${Math.round(t.x - px)} units`);
  // deliver
  run(s, 2);
  // haul it home: hooked, payload on the apron, truck slow
  const s1 = score(s);
  c.x = PLACES.GARAGE[0] + 60; c.y = PLACES.GARAGE[1]; c.h = 0; c.v = 0; t.x = PLACES.GARAGE[0]; t.y = PLACES.GARAGE[1];
  press(s); run(s, 0.2);
  check(score(s) - s1 === 400 && j.n === 1 && j.target !== t, 'hauled onto the Garage apron: +400 and the next contract', `+${score(s) - s1}`);
  // snap
  const t2 = j.target; c.x = 500; c.y = 1444; c.h = 0; c.v = 0; t2.x = 440; t2.y = 1444; press(s);
  check(j.hooked, 'the next target hooks the same way');
  for (let k = 0; k < 2; k++) { c.x = t2.x + c.len / 2 + 85; run(s, 0.05); run(s, 0.6, () => { c.v = 0; }); }   // yank the truck 85 units clear of the payload, twice
  check(!j.hooked, 'two hard jerks snap the cable');
}
// ---- BUS
{
  const { s, c } = fresh('bus'); press(s);
  const j = s.job;
  check(c.heavy && j.spotName === 'SOLANA', 'the route starts at SOLANA');
  put(c, j.spot); const s0 = score(s); run(s, 1); check(j.dwell > 0.8 && j.stop === 0, 'riders board while you wait at the kerb');
  run(s, 1); check(score(s) - s0 === 120 && j.stop === 1, 'a full 1.8 s dwell: +120, next stop', j.spotName);
  put(c, j.spot); run(s, 0.6); const s1 = score(s); c.x += 200; run(s, 0.1);
  check(score(s) - s1 === 60 && j.stop === 2, 'pulling out early pays half');
  const s2 = score(s);
  for (let k = 0; k < 4; k++) { put(c, j.spot); run(s, 1.9); }
  check(j.lap === 2 && score(s) - s2 === 4 * 120 + 700, 'all six stops under 75 s: route bonus + on-time tip, lap 2 begins', `+${score(s) - s2}`);
}
// ---- GETAWAY
{
  const { s, c } = fresh('getaway'); press(s);
  const j = s.job, n0 = s.spikes.length;
  put(c, j.spot); run(s, 1.7);
  check(j.phase === 'run' && j.crew === 2 && s.stars >= 3 && s.spikes.length === n0 + 1, 'the crew piles in: alarm, 3 stars, a spike strip goes down ahead');
  s.allowCops = true;
  const cop = s.addCar(c.x - 80, c.y, 0, 'police', 'police', {}); cop.v = 200;
  const s0 = score(s); press(s); run(s, 0.5);
  check(j.decoys === 2 && score(s) - s0 === 200 && cop.v < 120, 'DECOY: a cloud of bills, the cruiser behind brakes, +200', `cop v ${Math.round(cop.v)}`);
  cop.x = -999; cop.driver = null;
  const st = s.stars, s1 = score(s);
  put(c, JOBS.SAFEHOUSE); run(s, 0.1);
  check(!s.job && score(s) - s1 === 1000 && s.stars === st - 2, 'the safe house: +1000, two stars shed');
}
{ // tandem bail
  const { s, c } = fresh('getaway'); press(s); const j = s.job;
  put(c, j.spot); run(s, 1.7);
  c.x = JOBS.SAFEHOUSE[0]; c.y = JOBS.SAFEHOUSE[1] - 200; c.v = 0; c.spiked = true;
  check(jobButton(s).label === 'BAIL', 'spiked near the safe house, the button reads BAIL');
  press(s);
  check(s.player.mode === 'board' && j.tandem, 'BAIL puts you and the crew on the board');
  const s0 = score(s); s.board.x = JOBS.SAFEHOUSE[0]; s.board.y = JOBS.SAFEHOUSE[1]; run(s, 0.1);
  check(!s.job && score(s) - s0 === 1400, 'skating into the safe house: +1000 +400 tandem finish');
}
console.log(fails ? `JOBS FAIL (${fails})` : 'JOBS OK');
process.exit(fails ? 1 : 0);

// voice_world_check.mjs — owner directive, Nov 16: the voices must be mixed into the NORMAL
// WORLD too, not just jobs and mini-games. Drives the real Voice ambient director (src/voice.js)
// with mock sims in Node; playback is stubbed, file existence is stubbed true (the files are in
// the repo — this checks the director's trigger logic, not the audio).
// Usage: node tools/voice_world_check.mjs
import { Voice } from '../src/voice.js';
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };

function rig() {
  const v = new Voice();
  v.unlocked = true;
  v.exists = () => true;
  const plays = [];
  v.start = (id, pri, name) => { plays.push({ id, pri, name }); v.cur = null; return true; };
  return { v, plays };
}
function mockSim() {
  return {
    time: 0, stars: 0, busted: null, siege: null, chopper: null, job: null, event: null,
    player: { mode: 'car', car: { v: 100, dmg: 0, x: 0, y: 0, job: null, wreck: false }, ped: { x: 0, y: 0 } },
    focus: () => ({ x: 0, y: 0 }), cars: [], peds: [],
    W: { surfaceAt: () => 'road' },
  };
}
const run = (v, s, secs, dt = 0.1) => { for (let t = 0; t < secs; t += dt) { s.time += dt; v.update(s, dt, 0.4); } };
const isRadio = (p) => /^rad0[2-5]$/.test(p.id), isCop = (p) => /^cop0[1-6]$/.test(p.id), isPed = (p) => /^ped0[1-5]$/.test(p.id);

// A. calm free roam: Palm City FM actually talks — at least twice in 3 minutes
{
  const { v, plays } = rig(), s = mockSim();
  run(v, s, 180);
  check(plays.filter(isRadio).length >= 2, 'free roam: radio idents play on a real cadence', `${plays.filter(isRadio).length} in 180 s`);
}
// B. but the radio still stays out of jobs (job hooks own that space)
{
  const { v, plays } = rig(), s = mockSim();
  s.job = { kind: 'taxi' };
  run(v, s, 180);
  check(plays.filter(isRadio).length === 0, 'on a job: no radio idents', `${plays.filter(isRadio).length}`);
}
// C. a 1-star chase is no longer silent: cop barks at 1 star with a cruiser near
{
  const { v, plays } = rig(), s = mockSim();
  s.stars = 1; s.cars = [{ driver: 'police', x: 100, y: 0 }];
  run(v, s, 60);
  check(plays.filter(isCop).length >= 2, '1-star chase: cop barks fire', `${plays.filter(isCop).length} in 60 s`);
}
// D. the moment the heat rises, a cop answers (copT is forced, not left to the 8-15 s roll)
{
  const { v, plays } = rig(), s = mockSim();
  s.cars = [{ driver: 'police', x: 100, y: 0 }];
  run(v, s, 5);
  s.stars = 2;
  run(v, s, 1);
  check(plays.filter(isCop).length >= 1, 'star rise: a cop bark lands within a second');
}
// E. busted in the world has a voice now
{
  const { v, plays } = rig(), s = mockSim();
  s.stars = 2;
  run(v, s, 2);
  plays.length = 0;
  s.busted = { t: 0 };
  run(v, s, 0.3);
  check(plays.some(isCop), 'busted: a cop line plays on the bust');
}
// F. a city-speed near-miss (90 u/s) gets a ped shout — 110 was highway-only
{
  const { v, plays } = rig(), s = mockSim();
  s.player.car.v = 90;
  s.peds = [{ hidden: false, mode: 'walk', x: 20, y: 0 }];
  run(v, s, 6);
  check(plays.some(isPed), 'near-miss at 90 u/s: the ped shouts');
}
console.log(fails ? `VOICE WORLD FAIL (${fails})` : 'VOICE WORLD OK');
process.exit(fails ? 1 : 0);

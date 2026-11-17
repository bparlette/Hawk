// spotlight_check.mjs — SPOTLIGHT RAVE, on the real sim.
//   register : a street marker, a map POI and a HELP row (the registry contract), START armed at the ring
//   start    : JUMP puts you in a car on the ring; A starts it — three stars, the real chopper comes,
//              a crowd gathers on the verges
//   hype     : parked inside the beam earns nothing; drifting inside it fills the meter
//   beam-out : hype decays outside the beam; five continuous seconds out = LOST THE LIGHT (fail card)
//   bust     : pinned by a cruiser mid-rave = BUSTED fail card, the event cleared
//   tiers    : hype 34 -> tier 2 (four stars, +1 cruiser, the pin follows); hype 67 -> tier 3 (five
//              stars, +1 cruiser, the beam homes at slew 225 instead of searching)
//   win      : full hype = FULL HYPE! card, score = hype points + time bonus, crowd leaves
//   clock    : the 120 s clock ends the rave with a card either way
// Usage: node tools/spotlight_check.mjs   (exit 0 = all pass)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { World } from '../src/world.js'; import { Sim } from '../src/sim.js';
import { SPOT } from '../src/spotlight.js'; import { jobButton } from '../src/jobs.js';
import { markers } from '../src/activities.js'; import { mapPOIs } from '../src/map.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json'))), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const world = new World(layout);
let fails = 0; const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const DT = 1 / 60, inp = (o = {}) => ({ jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, ...o });
function fresh(start = true) {
  const ev = [], s = new Sim(world, M, 7, (n) => ev.push(n));
  s.spawnTraffic = () => null; s.spawnPed = () => null; s.cars = s.cars.filter(c => c.parked); s.peds = [s.player.ped];
  s.step(DT, inp({ jump: 'spot' }));
  if (start) s.step(DT, inp({ punch: true }));
  return { s, ev };
}
const glue = (s) => { if (s.chopper) { const c = s.player.car; s.chopper.bx = c.x; s.chopper.by = c.y; } };
const parkBeam = (s) => { if (s.chopper) { s.chopper.bx = 100; s.chopper.by = 100; } };
const step = (s, secs, f) => { for (let i = 0; i < secs * 60; i++) { if (f) f(); s.step(DT, inp()); } };
const countdown = (s) => step(s, 3.4, () => glue(s));
// hold the stick on a heading that rotates at 2.2 rad/s: the car chases it into a donut
const donut = (s, secs, beam = glue) => {
  const c = s.player.car; let a = c.h;
  for (let i = 0; i < secs * 60; i++) { a += 2.2 * DT; beam(s); s.step(DT, inp({ jx: Math.cos(a), jy: Math.sin(a), jm: 0.5 })); }
};
const cops = (s) => s.cars.filter(c => c.driver === 'police').length;
const noCops = (s) => { s.cars = s.cars.filter(c => c.driver !== 'police'); s.peds = s.peds.filter(p => p.mode !== 'cop'); };
const crowd = (s) => s.peds.filter(p => p.crowd);

{ const { s } = fresh(false);
  check(markers(s).some(m => m.a.id === 'spot') && mapPOIs(world, s).some(p => p.activity === 'spot' && p.name === 'SPOTLIGHT RAVE'), 'the ring has a street marker and a map POI');
  check(jobButton(s) && jobButton(s).label === 'START SPOTLIGHT RAVE', 'in a car on the ring, the button reads START SPOTLIGHT RAVE', jobButton(s) && jobButton(s).label);
  check(crowd(s).length === 0, 'no crowd before the rave starts');
}
{ const { s, ev } = fresh();
  check(s.event && s.event.kind === 'spot' && s.stars === 3, 'A starts SPOTLIGHT RAVE: wanted pins at three stars', `stars ${s.stars}`);
  step(s, 0.5);
  check(!!s.chopper, 'the real pressure chopper arrives', s.chopper ? 'spawned' : 'none');
  const cr = crowd(s);
  check(cr.length >= 12, 'a crowd gathers for the rave', `${cr.length} peds`);
  check(cr.every(p => { const t = world.surfaceAt(p.x, p.y); return t !== 'road' && t !== 'water'; }), 'the crowd stands on verges, never the road or the water');
  check(cr.every(p => Math.hypot(p.x - SPOT.site[0], p.y - SPOT.site[1]) < 420), 'the crowd clusters around the plaza');
  check(ev.includes('vox_evt_spot_start'), 'the VOX_EVT_SPOT_START hook fires (silent until the lines land)');
}
{ const { s } = fresh(); countdown(s);
  step(s, 3, () => glue(s));
  check(s.event && s.event.inBeam && s.event.outT === 0, 'parked in the beam: locked, no beam-out pressure');
  check(s.event.hype === 0 && s.event.pts === 0, 'parked in the beam earns NOTHING — stunts or silence', `hype ${s.event.hype}`);
}
{ const { s } = fresh(); countdown(s);
  donut(s, 5);
  // threshold note (push #2): the donut car is now the instant-start ring car (conv_mint) —
  // measured hype 11.8 vs 12.2 for the conv_rose the lane era borrowed. The old >12 line was
  // a coin-flip; >10 keeps the gate's meaning (parked in the beam earns exactly 0).
  check(s.event && s.event.hype > 10, 'donuts inside the beam fill the HYPE meter', `hype ${s.event.hype.toFixed(1)} after 5 s`);
  check(s.event.pts >= s.event.hype * 9, 'hype banks as points as it fills', `${s.event.pts} pts`);
}
{ const { s } = fresh(); countdown(s);
  donut(s, 3);
  const h0 = s.event.hype;
  check(h0 > 3, 'setup: the rave has hype to lose', `hype ${h0.toFixed(1)}`);
  // still driving, out of the light, with the cruisers called off — this block tests the beam
  // timer alone (a wedged car would get busted first; the bust has its own block below)
  const outDriving = (x) => { parkBeam(x); noCops(x); };
  donut(s, 2, outDriving);
  check(s.event && s.event.hype < h0, 'outside the beam the hype decays', `${h0.toFixed(1)} -> ${s.event.hype.toFixed(1)}`);
  donut(s, 3.6, outDriving);
  check(!s.event && s.eventResult && !s.eventResult.ok && /LOST THE LIGHT/.test(s.eventResult.text), 'five continuous seconds out = LOST THE LIGHT fail card', s.eventResult && s.eventResult.text);
  check(crowd(s).length === 0, 'the crowd goes home when the rave ends');
}
{ const { s } = fresh(); countdown(s);
  const c = s.player.car;
  s.addCar(c.x + 40, c.y, Math.PI, 'police', 'police', {});
  let sawBust = false;
  for (let i = 0; i < 6 * 60 && s.event; i++) { parkBeam(s); s.step(DT, inp()); sawBust ||= !!s.busted; }
  check(sawBust, 'a cruiser pinning the car busts the player mid-rave');
  step(s, 0.5, () => parkBeam(s));
  check(!s.event && s.eventResult && !s.eventResult.ok && /BUSTED/.test(s.eventResult.text), 'the bust ends the rave with a fail card', s.eventResult && s.eventResult.text);
}
{ const { s } = fresh(); countdown(s);
  const n0 = cops(s);
  s.event.hype = 40; step(s, 0.1, () => glue(s));
  check(s.event.tier === 2 && s.stars === 4 && s.event.floor === 4, 'hype 34+ = tier 2: the pin rises to four stars', `tier ${s.event.tier} stars ${s.stars}`);
  check(cops(s) >= n0 + 1, 'tier 2 calls in a backup cruiser', `${n0} -> ${cops(s)}`);
  s.stars = 1; step(s, 0.1, () => glue(s));
  check(s.stars === 4, 'the heat cannot drop below the tier floor while the rave runs', `stars ${s.stars}`);
  const n1 = cops(s);
  s.event.hype = 70; step(s, 0.1, () => glue(s));
  check(s.event.tier === 3 && s.stars === 5 && cops(s) >= n1 + 1, 'hype 67+ = tier 3: five stars and another cruiser', `tier ${s.event.tier} stars ${s.stars} cops ${n1} -> ${cops(s)}`);
  const c = s.player.car; s.chopper.bx = c.x + 400; s.chopper.by = c.y;
  step(s, 1.5);
  const d = Math.hypot(s.chopper.bx - c.x, s.chopper.by - c.y);
  check(d < 150, 'at five stars the beam LEADS and homes (slew 225) instead of searching a figure-8', `beam closed to ${Math.round(d)} units in 1.5 s`);
}
{ const { s } = fresh(); countdown(s);
  s.event.hype = 99.5;
  donut(s, 3);
  const r = s.eventResult;
  check(!s.event && r && r.ok && /FULL HYPE/.test(r.text), 'full hype = the FULL HYPE! win card', r && r.text);
  check(r && r.hype === 100 && r.pts > 1700, 'score = hype points + the time bonus (ceil(timer) x 15), banked on the card', r && `${r.pts} pts`);
  check(s.eventStats.spot === 1, 'the run is counted in the event stats');
  check(crowd(s).length === 0, 'the crowd leaves after the win');
}
{ const { s } = fresh(); countdown(s);
  s.event.timer = 0.05; step(s, 0.3, () => glue(s));
  check(!s.event && s.eventResult && /TIME UP/.test(s.eventResult.text), 'the 120 s clock ends the rave with a card either way', s.eventResult && s.eventResult.text);
}
console.log(fails ? `SPOTLIGHT FAIL (${fails})` : 'SPOTLIGHT OK'); process.exit(fails ? 1 : 0);

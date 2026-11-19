// spec_handling.mjs — SPEC: per-car handling (src/lf_handling.js, owner Nov 18).
//   node tools/spec_handling.mjs        (from games/laurel-fulton/)   exit 0 = green
// Each hero model must DRIVE measurably differently through the one physics choke point
// (LFSim.driveCar): the Camaro bites, the Astro wallows and lets go, the Cadillac is lazy off
// the line but has the long legs, the Celica turns quickest, and Jason's Camry is EXACTLY the
// stock car. The table applies only to the player's car and convoy followers — a parked or
// traffic car of the same model keeps stock physics. Cars are driven through driveCar in
// isolation, pinned to one open road spot so the surface (and so vmax) never changes mid-test.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0; const check = (ok, name, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fails++; };
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { GraphWorld } = await import('../src/world_graph.js'); const { LFSim } = await import('../src/lf_sim.js');
const SKID = await import('../src/lf_skid.js'); const HND = await import('../src/lf_handling.js');
const AREAS = J('data/areas.json'), G = J('data/graph.json'), ROSTER = J('data/roster.json'), FLEET = J('assets/fleet.json');
const W = new GraphWorld(G), DT = 1 / 60;
const SPOT = { x: -17348, y: 18057 };   // open road, no building within 300 u (the drift spec's spot)

function simWith(model) {
  const S = new LFSim(W, ROSTER, FLEET, { bumps: [], buildings: AREAS.buildings, greens: AREAS.green });
  const c = S.player; c.model = model; c.x = SPOT.x; c.y = SPOT.y; c.h = 0; c.v = 0;
  return S;
}
function drive(S, throttle, steer, steps, vmax = 290) {   // pin position: powertrain only
  const c = S.player;
  for (let i = 0; i < steps; i++) { c.x = SPOT.x; c.y = SPOT.y; S.driveCar(c, throttle, steer, DT, vmax); }
  return c;
}

// ---- turn rate: heading change over 0.5 s at v=200, full lock ----
function turnOf(model) {
  const S = simWith(model), c = S.player; c.v = 200;
  let dh = 0, prev = c.h;
  for (let i = 0; i < 30; i++) { c.x = SPOT.x; c.y = SPOT.y; S.driveCar(c, 0, 1, DT, 290); let d = c.h - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; dh += d; prev = c.h; }
  return dh;
}
const tCelica = turnOf('celica_rigg'), tCamry = turnOf('camry_jason'), tAstro = turnOf('astro_jimmy'), tCamaro = turnOf('camaro_brad');
check(tCelica > tCamry * 1.1, 'Celica turns quicker than the neutral Camry', `${tCelica.toFixed(2)} vs ${tCamry.toFixed(2)} rad`);
check(tAstro < tCamry * 0.93 && tCamry - tAstro > 0.1, 'Astro turns in slowly (wallowy)', `${tAstro.toFixed(2)} vs ${tCamry.toFixed(2)} rad`);
check(tCamaro > tCamry * 1.05, 'Camaro bites on turn-in', `${tCamaro.toFixed(2)} vs ${tCamry.toFixed(2)} rad`);
check(Math.abs(tCamry - 2.7 * 0.5) < 0.2, 'Camry turn rate is the stock 2.7 rad/s', `${tCamry.toFixed(2)} rad in 0.5 s`);

// ---- acceleration: v after 1 s from rest, full throttle ----
const aOf = model => drive(simWith(model), 1, 0, 60).v;
const aCamaro = aOf('camaro_brad'), aCamry = aOf('camry_jason'), aCaddy = aOf('brougham_grant');
check(aCamaro > aCamry + 8, 'Camaro accelerates harder than the Camry', `${aCamaro.toFixed(0)} vs ${aCamry.toFixed(0)} u/s`);
check(aCaddy < aCamry - 25, 'Cadillac is lazy off the line', `${aCaddy.toFixed(0)} vs ${aCamry.toFixed(0)} u/s`);

// ---- top speed: v after 20 s full throttle (asymptote = vmax x top) ----
const topOf = model => drive(simWith(model), 1, 0, 60 * 20).v;
const topCaddy = topOf('brougham_grant'), topCamry = topOf('camry_jason'), topAstro = topOf('astro_jimmy');
check(topCaddy > 312, 'Cadillac has the long legs (top x1.12)', `${topCaddy.toFixed(0)} u/s`);
check(topCamry > 282 && topCamry < 292, 'Camry top speed is the stock 290', `${topCamry.toFixed(0)} u/s`);
check(topAstro < 280, 'Astro tops out lower (x0.95)', `${topAstro.toFixed(0)} u/s`);

// ---- slip: the same cornering input, judged by the one slip detector ----
const slipAt = (model, v) => Math.abs(SKID.slipOf({ v, spinT: 0 }, 1, 1, 1, false, HND.HANDLING[model].grip));
check(slipAt('camaro_brad', 170) === 0, 'Camaro does NOT slide at v=170 full lock (grip 1.25)', `slip ${slipAt('camaro_brad', 170).toFixed(2)}`);
check(slipAt('astro_jimmy', 170) > 0.8, 'Astro lets go at the same input (grip 0.70)', `slip ${slipAt('astro_jimmy', 170).toFixed(2)}`);
check(slipAt('camry_jason', 170) > 0.4 && slipAt('camry_jason', 170) < 0.5, 'Camry slip is the stock number', `slip ${slipAt('camry_jason', 170).toFixed(3)}`);

// ---- gating: who gets a row ----
{
  const S = simWith('camry_jason');
  check(HND.handlingOf(S.player, S) === HND.HANDLING.camry_jason, 'the player car gets its row');
  const parked = S.addCar('camaro_brad', SPOT.x + 500, SPOT.y, 0, { parked: true });
  check(HND.handlingOf(parked, S) === null, 'a parked Camaro (not player, not follower) stays stock');
  const follower = S.addCar('astro_jimmy', SPOT.x + 900, SPOT.y, 0, {});
  follower.follower = true;
  check(HND.handlingOf(follower, S) === HND.HANDLING.astro_jimmy, 'a convoy follower gets its row');
  const cop = S.addCar('cavalier_black', SPOT.x + 1300, SPOT.y, 0, {});
  check(HND.handlingOf(cop, S) === null, 'a cop-model car stays stock');
  const dre = HND.HANDLING.dre_camry;
  check(dre && dre.grip === 1 && dre.turn === 1 && dre.accel === 1 && dre.top === 1 && HND.HANDLING.moe_camaro.grip === 1.25 && HND.HANDLING.juno_astro.grip === 0.70 && HND.HANDLING.pike_brougham.top === 1.12,
    'College Park model keys carry the same archetypes');
}

console.log(fails ? `FAIL (${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);

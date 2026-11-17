// spotlight.js — SPOTLIGHT RAVE, a city event. STAY IN THE LIGHT: a score-attack in a car
// around the plaza fountain. Starting pins the wanted level at three stars, so the REAL
// pressure system (pressure.js) brings its helicopter and cruisers — there is no fake
// chopper; the searchlight pool (radius 70, slew-capped by tier) is the stage.
//
// HYPE is the score, and it only fills while you are inside the beam AND stunting:
//   · drifting — read from the car's yaw: the same lateral-load threshold the skid marks
//     use (skid.js slipOf: |v · yaw| > 430), plus a donut branch (hard yaw at low speed);
//   · near-misses — traffic passing inside a 20–38 unit band at speed (event-local: the
//     game scores near-misses only on the board, so the read is taken here);
//   · destruction popups — the sim.score delta (destruct.report banks points there);
//   · turbo — held boost at speed.
// Parked in the beam earns exactly nothing. Five continuous seconds out of the beam ends
// the rave (LOST THE LIGHT); a bust ends it too, and is the clip — in-beam stunts fire a
// heavy 'rave' director mark so the bust highlight centres on the beam sequence.
//
// Escalation is the wanted system itself: hype tiers raise the star floor (3 → 4 → 5), so
// the beam slew (120 → 175 → 225 u/s) and the velocity lead (4★+) come from pressure.js
// untouched, and each tier also calls in one backup cruiser on the stepWanted recipe.
// A crowd gathers on the plaza verges (peds with a 'crowd' path — sim.js stands them at
// home facing the action, bouncing harder as the hype rises; at tier 3 some press closer).
// Voice hooks are vox_evt_spot_* — silent until the wave-2 lines land, like the jobs'.

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export const SPOT = {
  name: 'SPOTLIGHT RAVE', site: [1000, 560], time: 120,
  outLimit: 5, grace: 5, tiers: [34, 67],                    // hype % where tier 2 / tier 3 land
  driftRate: 8, turboRate: 2.5, scoreRate: 0.04, decay: 1.5, // hype per second / per point
  nearPts: 40, nearHype: 4, winPerSec: 15,
};
// crowd clusters on the plaza verges (grass insets + paving edges — audience, never the road)
const CLUSTERS = [[790, 470], [1090, 420], [1020, 640], [730, 600]];
const OUTFITS = ['ped_sun', 'ped_rose', 'ped_white', 'ped_blue', 'ped_straw'];
const STAGE = [1000, 470];                                   // the fountain, what tier 3 presses toward

function bank(ev, pts) { ev.ptsF += pts; ev.pts = Math.floor(ev.ptsF); }
function addHype(ev, amt) { ev.hype = Math.min(100, ev.hype + amt); bank(ev, amt * 10); }
const res = (ev) => ({ hype: Math.round(ev.hype), tier: ev.tier });

// ---------------------------------------------------------------- the crowd
function spawnCrowd(sim) {
  const out = [];
  for (const [cx, cy] of CLUSTERS) {
    const n = 4 + Math.floor(sim.fxr() * 2);
    for (let i = 0; i < n; i++) {
      const x = cx + (sim.fxr() - 0.5) * 56, y = cy + (sim.fxr() - 0.5) * 40;
      const surf = sim.W.surfaceAt(x, y);
      if (surf === 'road' || surf === 'water' || sim.W.hitSolid(x, y, 6)) continue;
      const p = sim.makePed(x, y, OUTFITS[(sim.fxr() * OUTFITS.length) | 0], { type: 'crowd', x, y });
      p.crowd = true; p.cheer = 0;
      sim.peds.push(p); out.push(p);
    }
  }
  return out;
}

// at tier 3 some of the crowd presses closer to the fountain (their 'crowd' home moves;
// sim.js walks them there and keeps them facing the action)
function crowdCloser(ev) {
  ev.crowd.forEach((p, i) => {
    if (i % 2 || p.gone) return;
    p.path.x += (STAGE[0] - p.path.x) * 0.3;
    p.path.y += (STAGE[1] - p.path.y) * 0.3;
  });
}

export function endSpot(sim, ev) {
  if (ev.crowd && ev.crowd.length) sim.peds = sim.peds.filter(p => !p.crowd);
  ev.crowd = [];
}

// ---------------------------------------------------------------- backup (the stepWanted recipe)
function spawnBackup(sim) {
  const W = sim.W, f = sim.focus();
  let s0 = sim.playerS;
  if (s0 === undefined) s0 = W.loopNearest(f.x, f.y);
  for (const back of [-1, 1]) {
    const dir = -back;
    for (let k = 0; k < 8; k++) {
      const s = s0 + back * (430 + k * 60), p = W.loopAt(s, 23 * dir);
      if (Math.hypot(p.x - f.x, p.y - f.y) < 380) continue;
      if (sim.cars.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 60)) continue;
      const c = sim.addCar(p.x, p.y, Math.atan2(p.ty * dir, p.tx * dir), 'police', 'police', { s, dir });
      c.v = 160; sim.ev('siren');
      return c;
    }
  }
  return null;
}

// ---------------------------------------------------------------- near-misses (traffic only)
function nearMisses(sim, ev, pay) {
  const c = ev.car;
  const cvx = Math.cos(c.h) * c.v, cvy = Math.sin(c.h) * c.v;
  for (const o of sim.cars) {
    if (o === c || o.driver !== 'ai' || o.parked) continue;
    if ((ev.nearCd[o.id] || 0) > sim.time) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < 20 || d > 38) continue;
    const rel = Math.hypot(Math.cos(o.h) * o.v - cvx, Math.sin(o.h) * o.v - cvy);
    if (rel < 100) continue;
    ev.nearCd[o.id] = sim.time + 3;
    pay(SPOT.nearPts, 'NEAR MISS');
    bank(ev, SPOT.nearPts);
    addHype(ev, SPOT.nearHype);
    sim.ev('trick');
  }
}

// ---------------------------------------------------------------- start / step
export function startSpot(sim, ev) {
  Object.assign(ev, {
    hype: 0, ptsF: 0, tier: 1, floor: 3, outT: 0, armT: 0, everLock: false, inBeam: false,
    warned: false, grace: SPOT.grace, lastH: ev.car ? ev.car.h : 0, lastScore: sim.score || 0,
    nearCd: {}, markT: 0, crowd: [],
  });
  ev.spot = SPOT.site;
  ev.crowd = spawnCrowd(sim);
  if (sim.stars < 3) { sim.stars = 3; sim.lostT = 0; sim.ev('star', 3); }   // the cops come at three stars
  sim.say('SPOTLIGHT RAVE — 3', 1);
  sim.ev('vox_evt_spot_start');
}

export function stepSpot(sim, ev, dt, end, pay) {
  const P = sim.player, c = ev.car;
  // the pin: while the rave runs the heat never drops below the tier floor
  if (sim.stars < ev.floor) { sim.stars = ev.floor; sim.lostT = 0; sim.ev('star', ev.floor); }
  if (!c || P.mode !== 'car' || P.car !== c) { end('ON FOOT', false, res(ev)); return; }
  if (c.wreck) { end('WRECKED', false, res(ev)); return; }
  if (ev.count > 0) {
    ev.count -= dt;
    sim.say(ev.count > 2 ? 'SPOTLIGHT RAVE — 3' : ev.count > 1 ? 'SPOTLIGHT RAVE — 2' : ev.count > 0 ? 'SPOTLIGHT RAVE — 1' : 'GO!', 1);
    if (ev.count <= 0) { ev.count = 0; sim.say('GO!', 1.2); }
    ev.lastH = c.h; ev.lastScore = sim.score || 0;
    return;
  }
  ev.timer -= dt;
  if (ev.timer <= 0) { end('TIME UP', ev.tier >= 2, res(ev)); return; }

  // ---- the beam is the stage (pressure.js owns it; lock === inside the pool)
  const chop = sim.chopper;
  const inBeam = !!(chop && chop.lock && !chop.leaving);
  ev.inBeam = inBeam;
  if (inBeam) ev.everLock = true;
  ev.armT += dt;
  if (inBeam) { ev.outT = 0; ev.warned = false; }
  else if (ev.everLock || ev.armT > ev.grace) {
    ev.outT += dt;
    if (ev.outT > 2.5 && !ev.warned) { ev.warned = true; sim.say('BACK IN THE LIGHT!', 1.2); sim.ev('vox_evt_spot_beam'); }
    if (ev.outT >= SPOT.outLimit) { end('LOST THE LIGHT', false, res(ev)); return; }
  }

  // ---- stunts: the only way hype fills, and only in the light
  const gained = (sim.score || 0) - ev.lastScore;            // destruction popups banked since last tick
  let stunting = false;
  if (inBeam && gained > 0) { addHype(ev, gained * SPOT.scoreRate); stunting = true; }
  const yaw = wrap(c.h - ev.lastH) / dt, lat = Math.abs(c.v * yaw);
  const donut = Math.abs(yaw) > 1.7 && Math.abs(c.v) > 14 && Math.abs(c.v) < 170;
  const slip = lat > 430 ? Math.min(1, 0.35 + (lat - 430) / 300) : donut ? 0.9 : 0;
  if (inBeam && slip > 0) { addHype(ev, SPOT.driftRate * slip * dt); stunting = true; }
  if (inBeam && (c.turbo || 0) > 0.3 && Math.abs(c.v) > 120) { addHype(ev, SPOT.turboRate * dt); stunting = true; }
  if (inBeam) nearMisses(sim, ev, pay);
  if (!inBeam && chop) ev.hype = Math.max(0, ev.hype - SPOT.decay * dt);
  if (stunting) { ev.markT -= dt; if (ev.markT <= 0) { ev.markT = 0.5; sim.ev('rave'); } }   // heavy director marks in the beam
  for (const p of ev.crowd) p.cheer = ev.tier >= 3 ? 2 : ev.hype >= 20 ? 1 : 0;

  // ---- tiers: the wanted system escalates itself (slew + lead live in pressure.js)
  const tier = ev.hype >= SPOT.tiers[1] ? 3 : ev.hype >= SPOT.tiers[0] ? 2 : 1;
  if (tier > ev.tier) {
    ev.tier = tier; ev.floor = 2 + tier;
    if (sim.stars < ev.floor) { sim.stars = ev.floor; sim.lostT = 0; sim.ev('star', ev.floor); }
    spawnBackup(sim);
    sim.say(tier === 2 ? 'THE CROWD WANTS MORE' : 'FULL RAVE — THEY ARE LOSING IT', 1.8);
    sim.ev(tier === 2 ? 'vox_evt_spot_tier2' : 'vox_evt_spot_tier3');
    if (tier === 3) crowdCloser(ev);
    sim.punchZoom = 1;
  }

  if (ev.hype >= 100) {
    const bonus = Math.ceil(ev.timer) * SPOT.winPerSec;
    pay(bonus, 'FULL HYPE BONUS'); bank(ev, bonus);
    sim.ev('vox_evt_spot_win');
    end('FULL HYPE!', true, res(ev));
    return;
  }
  ev.lastScore = sim.score || 0;
  ev.lastH = c.h;
}

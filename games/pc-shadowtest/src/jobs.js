// jobs.js — THE JOBS BOARD (v2 step 5): TAXI, TOW, BUS, GETAWAY DRIVER. Gemini's design spec:
// shots/jobs-spec.md. One job runs at a time (sim.job). A job starts from its marked vehicle: get
// in and the FIGHT button — idle in a car otherwise — becomes the job button (START, then HOOK /
// SLING, DECOY, BAIL as the job calls for). Getting out, getting busted or wrecking the vehicle
// ends the job cleanly. Money is score. All job points are kerb-side on the real road grid.
import { hitCar, impactDamage, burst, hitThing, palmImpact, D } from './destruct.js';
import { mount } from './skate.js';
import { eventButton, startEvent } from './events.js';

export const PLACES = {
  SOLANA: [392, 535], DINER: [550, 770], NOVA: [990, 1390], MOTEL: [570, 1390], PIER: [1232, 1035],
  TACOS: [880, 212], PLAZA: [1168, 470], GARAGE: [920, 1452], VILLAS: [700, 1988], OFFICE: [812, 1150],
};
const FARE_SPOTS = ['SOLANA', 'DINER', 'NOVA', 'MOTEL', 'PIER', 'VILLAS', 'TACOS'];
const BUS_STOPS = ['SOLANA', 'TACOS', 'PLAZA', 'PIER', 'NOVA', 'GARAGE'];
const SAFEHOUSE = [1232, 1350];
const TOW_TARGETS = [[852, 1146, 0, 'sedan_teal'], [470, 770, 0, 'van_sky'], [1168, 700, Math.PI / 2, 'sedan_plum'], [640, 1988, Math.PI, 'conv_rose']];
const TITLES = { taxi: 'TAXI', tow: 'TOW', bus: 'BUS', getaway: 'GETAWAY' };
const CABLE = { rest: 44, max: 74, k: 28, damp: 0.85, snap: 34 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dxy = (o, p) => Math.hypot(o.x - p[0], o.y - p[1]);

// INSTANT-START (owner rule, Nov 16): every job vehicle has a home on the Garage kerb —
// all four advertised together at the JOBS hub — and a guardian restocks it there.
export const JOB_HOMES = { getaway: [785, 1456, 0], tow: [860, 1456, 0], taxi: [935, 1456, 0], bus: [1010, 1456, 0] };
const KERB = [897, 1456];   // the kerb centre the guardian watches

export function initJobs(sim) {
  sim.job = null; sim.jobOffer = null; sim.jobStats = { fares: 0, tows: 0, stops: 0, heists: 0 };
  const M = sim.M.cars;
  // the job vehicles, parked at the kerb outside the Garage (the taxi and the getaway van already exist)
  sim.addCar(860, 1456, 0, M.tow_truck ? 'tow_truck' : 'van_sun', null, { parked: true, job: 'tow' });
  sim.addCar(1010, 1456, 0, M.bus ? 'bus' : 'van_sky', null, { parked: true, job: 'bus', heavy: true });
  for (const c of sim.cars) { if (c.model === 'taxi') c.job = 'taxi'; if (c.model === 'van_sun' && !c.job) c.job = 'getaway'; }
  // INSTANT-START: the taxi and the getaway van move to their kerb homes; every job car gets a home
  for (const c of sim.cars) {
    const h = c.job && JOB_HOMES[c.job];
    if (h) { c.x = h[0]; c.y = h[1]; c.h = h[2]; c.home = { x: h[0], y: h[1], h: h[2] }; c.waitT = 0; }
  }
}

// the site guardian for the job fleet: a job car that is wrecked or left >200 from its kerb
// home rolls back (repaired) once the player has been at the kerb for a continuous 10 s.
// It only ever mutates the one flagged singleton — no car is ever spawned here.
function guardJobCars(sim, dt) {
  const f = sim.focus();
  const nearKerb = Math.hypot(f.x - KERB[0], f.y - KERB[1]) < 420;
  for (const k of ['taxi', 'tow', 'bus', 'getaway']) {
    const c = sim.cars.find(x => x.job === k);
    if (!c || !c.home) continue;
    const inUse = c.driver === 'player' || sim.player.car === c || (sim.job && sim.job.car === c) || (sim.event && sim.event.car === c);
    const away = c.wreck || Math.hypot(c.x - c.home.x, c.y - c.home.y) > 200;
    if (!inUse && away && nearKerb) c.waitT = (c.waitT || 0) + dt; else c.waitT = 0;
    if (c.waitT >= 10) {
      c.x = c.home.x; c.y = c.home.y; c.h = c.home.h; c.v = 0; c.driver = null; c.parked = true;
      c.dmg = 0; c.dent = [0, 0, 0, 0]; c.glass = [0, 0]; c.wreck = false; c.waitT = 0;
    }
  }
}

// what the job button does right now: { label } or null (also drives the HUD)
export function jobButton(sim) {
  const P = sim.player, j = sim.job;
  if (P.mode !== 'car') return null;
  const c = P.car;
  if (!j && sim.event) return null;                                  // an event owns the button's time
  if (!j) return eventButton(sim) || (c.job && !c.wreck ? { kind: 'start', label: 'START ' + TITLES[c.job] } : null);
  if (j.kind === 'tow') {
    if (j.hooked) return Math.abs(c.v) > 140 ? { kind: 'sling', label: 'SLING' } : { kind: 'unhook', label: 'UNHOOK' };
    const t = j.target;
    if (t && Math.hypot(t.x - rearOf(c).x, t.y - rearOf(c).y) < CABLE.max) return { kind: 'hook', label: 'HOOK' };
    return null;
  }
  if (j.kind === 'getaway' && j.phase === 'run') {
    if ((c.spiked || c.dmg >= 0.6) && dxy(c, SAFEHOUSE) < 350 && Math.abs(c.v) < 90) return { kind: 'bail', label: 'BAIL' };
    return j.decoys > 0 ? { kind: 'decoy', label: 'DECOY ×' + j.decoys } : null;
  }
  return null;
}

const rearOf = (c) => ({ x: c.x - Math.cos(c.h) * c.len / 2, y: c.y - Math.sin(c.h) * c.len / 2 });

function pay(sim, pts, label) {
  sim.score = (sim.score || 0) + pts;
  sim.lastTrick = { name: label, pts, t: 1.6, mult: 1 };
  sim.ev('jobpay');
}

function endJob(sim, text, ok) {
  const j = sim.job;
  if (!j) return;
  if (j.kind === 'tow' && j.target) { j.target.towed = false; j.target.towTarget = false; }
  sim.job = null;
  if (text) sim.say(text, 2);
  sim.ev(ok ? 'jobdone' : 'jobfail');
}

// leave the running job, exactly as getting out of the vehicle does (used by JUMP)
export function quitJob(sim) { if (sim.job) endJob(sim, TITLES[sim.job.kind] + ' OVER', true); }

export function startJob(sim, kind) {
  const c = sim.player.car, r = sim.rnd;
  const j = sim.job = { kind, car: c, t: 0, timer: 0, phase: '', target: null, spot: null, n: 0, earned: sim.score || 0 };
  sim.ev('jobstart', kind);
  if (kind === 'taxi') { j.streak = 0; nextFare(sim, j); sim.say('TAXI — FIND A FARE', 1.8); }
  else if (kind === 'tow') { nextTow(sim, j); sim.say('TOW — HOOK THE MARKED CAR', 1.8); }
  else if (kind === 'bus') { j.stop = 0; j.lap = 1; j.dwell = 0; j.lapT = 0; j.spot = PLACES[BUS_STOPS[0]]; j.spotName = BUS_STOPS[0]; j.timer = 36; j.phase = 'drive'; sim.say('BUS — COASTAL LOOP', 1.8); }
  else if (kind === 'getaway') { j.phase = 'goto'; j.spot = PLACES.OFFICE; j.spotName = 'OFFICE'; j.timer = 40; j.decoys = 3; j.crew = 0; sim.say('GETAWAY — PICK UP THE CREW', 1.8); }
  void r;
  return j;
}

// ---------------------------------------------------------------- TAXI
function nextFare(sim, j) {
  const c = j.car, r = sim.rnd;
  let name;
  do { name = FARE_SPOTS[(r() * FARE_SPOTS.length) | 0]; } while (dxy(c, PLACES[name]) < 260 || name === j.spotName);
  j.phase = 'pickup'; j.spot = PLACES[name]; j.spotName = name;
  j.timer = j.n < 2 ? 32 : 24 + r() * 4;
  j.fare = null;
}

function boardFare(sim, j) {
  const r = sim.rnd, type = ['speed', 'vip', 'chaos'][(r() * 3) | 0];
  const fed = sim.stars >= 3 && r() < 0.35;
  let name;
  do { name = FARE_SPOTS[(r() * FARE_SPOTS.length) | 0]; } while (name === j.spotName || dxy({ x: j.spot[0], y: j.spot[1] }, PLACES[name]) < (j.n < 2 ? 300 : 600));
  j.fare = { type, fed, mood: 60, t: 0, revealAt: 5 + r() * 3, revealed: false, from: j.spot, dmg0: j.car.dmg, score0: sim.score || 0, stopT: 0, fastT: -9 };
  j.phase = 'drop'; j.spot = PLACES[name]; j.spotName = name;
  j.timer = (j.n < 2 ? 32 : 24 + r() * 4) + dxy({ x: j.fare.from[0], y: j.fare.from[1] }, j.spot) / 60;
  sim.ev('door'); sim.ev(type === 'vip' ? 'vox_taxi_vip' : 'vox_taxi_chill');
  sim.say({ speed: 'SPEED FREAK — FLOOR IT', vip: 'VIP — SMOOTH AND CLEAN', chaos: 'TOURIST — SHOW THEM CHAOS' }[type] + ' → ' + name, 2);
}

function stepTaxi(sim, j, dt) {
  const c = j.car, sp = Math.abs(c.v);
  if (j.phase === 'pickup') {
    if (dxy(c, j.spot) < 46 && sp < 40) boardFare(sim, j);
    return;
  }
  const f = j.fare;
  f.t += dt;
  // mood
  const hurt = c.dmg - f.dmg0; f.dmg0 = c.dmg;
  const scored = (sim.score || 0) - f.score0; f.score0 = sim.score || 0;
  if (f.type === 'speed') f.mood += (sp > 220 ? 9 : sp < 80 ? -11 : 1) * dt;
  else if (f.type === 'vip') { f.mood += (sp > 60 && sp < 230 ? 4 : -2) * dt; if (hurt > 0.01) f.mood -= 18; }
  else { f.mood -= 3 * dt; if (hurt > 0.01 || scored > 0) f.mood += 15; }
  f.mood = Math.max(0, Math.min(100, f.mood));
  if (f.mood < 25 && !f.warned) { f.warned = true; sim.ev('vox_taxi_mood'); }
  // the undercover fed
  if (f.fed && !f.revealed && f.t > f.revealAt) {
    f.revealed = true; sim.stars = Math.max(sim.stars, 4);
    sim.say('FEDERAL AGENT — PULL OVER!', 2.2); sim.ev('siren'); sim.ev('vox_taxi_fed');
  }
  if (f.fed && f.revealed) {
    c.h += Math.sin(sim.time * 11) * 0.25 * dt * Math.min(1, sp / 80);        // a hand on the wheel
    f.stopT = sp < 40 ? f.stopT + dt : 0;
    if (f.stopT > 1.5 && !sim.busted) { sim.busted = { t: 0 }; sim.say('BUSTED', 4.2); sim.ev('busted'); endJob(sim, null, false); return; }
    if (sp > 260) f.fastT = sim.time;
    if (sim.time - f.fastT < 1.2 && sp < 110) {                               // flat out, then stand on the brakes
      pay(sim, 600, 'FED SHOOK!'); burst(sim, D.GLASS, 8, c.x, c.y, Math.cos(c.h), Math.sin(c.h), 120, 1);
      j.n++; nextFare(sim, j); return;
    }
    return;
  }
  if (f.mood <= 0) { j.streak = 0; sim.say('FARE BAILED OUT', 1.8); sim.ev('jobfail'); nextFare(sim, j); return; }
  if (dxy(c, j.spot) < 46 && sp < 40) {
    const trip = dxy({ x: f.from[0], y: f.from[1] }, j.spot);
    j.streak = Math.min(5, j.streak + 1);
    const base = (150 + Math.round(trip * 0.25)) * (f.mood >= 80 ? 2 : 1) * j.streak;
    pay(sim, base, `FARE ×${j.streak}${f.mood >= 80 ? ' · HAPPY' : ''}`);
    if (f.mood >= 75) sim.ev('vox_taxi_drop');
    j.n++; sim.jobStats.fares++;
    nextFare(sim, j);
  }
}

// ---------------------------------------------------------------- TOW
function nextTow(sim, j) {
  const T = TOW_TARGETS[j.n % TOW_TARGETS.length];
  for (const c of sim.cars) if (c !== j.car && Math.hypot(c.x - T[0], c.y - T[1]) < 50) { c.x = -999; c.y = -999; }
  j.target = sim.addCar(T[0], T[1], T[2], T[3], null, { parked: true, fixed: false, towTarget: true });
  j.hooked = false; j.strain = 0; j.pvx = 0; j.pvy = 0; j.flying = 0;
  j.phase = 'fetch'; j.spot = [T[0], T[1]]; j.spotName = 'TARGET'; j.timer = 60;
}

function payloadHits(sim, j, t, sp, dt) {
  if (sp < 60) return;
  const ux = j.pvx / sp, uy = j.pvy / sp;
  for (const c of sim.cars) {
    if (c === t || c === j.car || dist(c, t) > (c.len + t.len) / 2 - 2 || sim.time - (c.towHitT || -9) < 0.6) continue;
    c.towHitT = sim.time;
    hitCar(sim, c, impactDamage(sp * 2.2), ux, uy, 'player');           // 2.2x: the payload is the heavy end of the whip
    hitCar(sim, t, impactDamage(sp) * 0.5, -ux, -uy, 'world');
    c.v += (ux * Math.cos(c.h) + uy * Math.sin(c.h)) * sp * 0.6;
    j.pvx *= 0.45; j.pvy *= 0.45;
    sim.ev('crash', sp * 1.5); sim.ev('vox_tow_hit'); sim.punchZoom = 1;
    if (c.kind === 'police' && !c.towPaid) { c.towPaid = true; pay(sim, j.flying > 0 ? 400 : 250, j.flying > 0 ? 'SLINGSHOT TAKEDOWN' : 'WRECKING BALL'); sim.ev('vox_tow_cop'); sim.ev('vox_dsp_towcop'); }
  }
  for (const p of sim.peds) {
    if (p.hidden || p.mode === 'down' || p === sim.player.ped || dist(p, t) > t.len / 2) continue;
    sim.knockDown(p, ux * sp * 0.6, uy * sp * 0.6, 2.4);
  }
  const tr = sim.W.hitTrunk(t.x, t.y, 9);
  if (tr && sim.palms && sim.palms[tr.i] && sim.time - (j.palmT || -9) > 0.5) { j.palmT = sim.time; hitThing(sim, sim.palms[tr.i], palmImpact(sp * 1.6), ux, uy, 'player', sp); j.pvx *= 0.4; j.pvy *= 0.4; }
  void dt;
}

function stepTow(sim, j, dt) {
  const c = j.car, t = j.target, W = sim.W;
  if (!t || t.gone) { nextTow(sim, j); return; }
  if (j.hooked || j.flying > 0) {
    // the payload is a body on a spring-damper cable from the truck's boom (rear hitch)
    const H = rearOf(c);
    let dx = H.x - t.x, dy = H.y - t.y, d = Math.hypot(dx, dy) || 1;
    if (j.hooked) {
      const ext = d - CABLE.rest;
      if (ext > 0) { const a = CABLE.k * ext; j.pvx += dx / d * a * dt; j.pvy += dy / d * a * dt; }
      if (ext > CABLE.snap) { if (!j.over) { j.over = true; j.strain++; j.strainT = sim.time; } } else j.over = false;
      if (j.strain && sim.time - j.strainT > 5) j.strain = 0;                    // one shock is forgiven after 5 s; two close together snap it
      c.v *= 1 - Math.min(0.5, Math.max(0, ext) / 80) * dt;                     // the load drags on the truck
    }
    const fr = Math.pow(j.flying > 0 ? 0.55 : CABLE.damp * 0.35, dt);
    j.pvx *= fr; j.pvy *= fr;
    let nx = t.x + j.pvx * dt, ny = t.y + j.pvy * dt;
    if (!W.isDrivable(nx, ny) || W.hitSolid(nx, ny, 6)) { j.pvx *= -0.3; j.pvy *= -0.3; nx = t.x; ny = t.y; sim.ev('bump'); }
    t.x = nx; t.y = ny;
    if (j.hooked) {                                                             // never beyond the cable's length
      dx = H.x - t.x; dy = H.y - t.y; d = Math.hypot(dx, dy) || 1;
      if (d > CABLE.max) { t.x = H.x - dx / d * CABLE.max; t.y = H.y - dy / d * CABLE.max; const vr = -(j.pvx * dx + j.pvy * dy) / d; if (vr > 0) { j.pvx += dx / d * vr; j.pvy += dy / d * vr; } }
    }
    const sp = Math.hypot(j.pvx, j.pvy);
    if (sp > 25) { let dh = Math.atan2(j.pvy, j.pvx) - t.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; t.h += dh * Math.min(1, dt * 5); }
    t.v = 0; j.tension = Math.max(0, (d - CABLE.rest) / (CABLE.max - CABLE.rest));
    payloadHits(sim, j, t, sp, dt);
    if (j.flying > 0) { j.flying -= dt; if (j.flying <= 0 || sp < 30) { j.flying = 0; t.towed = false; } }
    if (j.hooked && j.strain >= 2) { j.hooked = false; t.towed = false; j.strain = 0; sim.say('CABLE SNAPPED!', 1.8); sim.ev('snap'); sim.ev('vox_tow_snap'); }
    if (W.surfaceAt(t.x, t.y) === 'water') { endJob(sim, 'PAYLOAD LOST AT SEA', false); return; }
    // delivered: the payload settles on the Garage apron
    if (j.hooked && dxy(t, PLACES.GARAGE) < 70 && Math.abs(c.v) < 60) {
      j.hooked = false; t.towed = false; t.towTarget = false; t.parked = true;
      pay(sim, 400, 'TOW DELIVERED'); sim.ev('vox_tow_done'); sim.jobStats.tows++;
      j.n++; nextTow(sim, j);
    }
  }
  j.spot = j.hooked ? PLACES.GARAGE : [t.x, t.y]; j.spotName = j.hooked ? 'GARAGE' : 'TARGET';
}

// ---------------------------------------------------------------- BUS
function stepBus(sim, j, dt) {
  const c = j.car;
  j.lapT += dt;
  const at = dxy(c, j.spot) < 50;
  if (at && Math.abs(c.v) < 35) {
    if (j.dwell === 0) sim.ev('vox_bus_board');
    j.dwell += dt;
    if (j.dwell >= 1.8) busNext(sim, j, 120, 'ALL ABOARD');
  } else if (j.dwell > 0.3 && !at) { sim.ev('vox_bus_skip'); busNext(sim, j, 60, 'HALF THE LINE LEFT BEHIND'); }
  else if (!at) j.dwell = 0;
}
function busNext(sim, j, pts, label) {
  pay(sim, pts, label); sim.jobStats.stops++;
  j.dwell = 0; j.stop++;
  if (j.stop >= BUS_STOPS.length) {
    pay(sim, 500 + (j.lapT < 75 ? 200 : 0), j.lapT < 75 ? 'FULL ROUTE · ON TIME' : 'FULL ROUTE');
    sim.ev('vox_bus_finish'); j.stop = 0; j.lap++; j.lapT = 0;
  }
  j.spotName = BUS_STOPS[j.stop]; j.spot = PLACES[j.spotName];
  j.timer = [36, 30, 24][Math.min(2, j.lap - 1)];
}

// ---------------------------------------------------------------- GETAWAY
function stepGetaway(sim, j, dt) {
  const c = j.car, P = sim.player;
  if (j.phase === 'goto') {
    if (dxy(c, j.spot) < 50 && Math.abs(c.v) < 40) {
      j.wait = (j.wait || 0) + dt;
      if (j.wait > 1.5) {
        j.phase = 'run'; j.crew = 2; j.spot = SAFEHOUSE; j.spotName = 'SAFE HOUSE'; j.timer = 75;
        sim.stars = Math.max(sim.stars, 3);
        sim.say('ALARM! GO GO GO', 2); sim.ev('siren'); sim.ev('vox_getaway_alarm');
        // the police unroll a strip on the way out
        const s = sim.W.loopNearest(c.x, c.y), q = sim.W.loopAt(s + 420, 20);
        sim.spikes.push({ x: q.x, y: q.y, a: Math.atan2(q.ty, q.tx) + Math.PI / 2 });
      }
    } else j.wait = 0;
    return;
  }
  if (c.spiked && !j.spikedSaid) { j.spikedSaid = true; sim.ev('vox_getaway_tire'); }
  for (const k of sim.cars) if (k.decoyT > 0) { k.decoyT -= dt; k.v *= Math.pow(0.12, dt); }
  const who = j.tandem ? sim.board : c;
  if (dxy(who, SAFEHOUSE) < 60 && (j.tandem || Math.abs(c.v) < 60)) {
    pay(sim, 1000 + (j.tandem ? 400 : 0), j.tandem ? 'CLEAN CUT · TANDEM FINISH' : 'CLEAN CUT');
    sim.stars = Math.max(0, sim.stars - 2); sim.lostT = 0; sim.jobStats.heists++;
    sim.ev('vox_getaway_clear');
    endJob(sim, 'HEIST CLEAR', true);
  }
  void P;
}

function throwDecoy(sim, j) {
  const c = j.car;
  j.decoys--;
  burst(sim, D.LEAF, 14, c.x - Math.cos(c.h) * 26, c.y - Math.sin(c.h) * 26, -Math.cos(c.h), -Math.sin(c.h), 90, 1.1);
  sim.ev('vox_getaway_decoy'); sim.ev('rustle', 0.6);
  let n = 0;
  for (const k of sim.cars) if (k.driver === 'police' && dist(k, c) < 160) { k.decoyT = 3; n++; }
  if (n) pay(sim, 200 * n, n > 1 ? `DECOY ×${n}` : 'DECOY CLEAN');
}

function tandemBail(sim, j) {
  const c = j.car, P = sim.player, b = sim.board;
  c.driver = null; c.parked = true; c.fixed = false; c.v = 0;
  P.ped.x = c.x; P.ped.y = c.y; P.ped.h = Math.atan2(SAFEHOUSE[1] - c.y, SAFEHOUSE[0] - c.x); P.ped.hidden = false; P.car = null; P.mode = 'foot';
  b.x = c.x + Math.cos(P.ped.h) * 24; b.y = c.y + Math.sin(P.ped.h) * 24; b.ridden = false;
  P.ped.x = b.x; P.ped.y = b.y;
  mount(sim);
  b.vx = Math.cos(P.ped.h) * 120; b.vy = Math.sin(P.ped.h) * 120;
  j.tandem = true;
  sim.say('TANDEM BAIL — SKATE!', 1.8); sim.ev('vox_getaway_bail');
}

// ---------------------------------------------------------------- step + button
export function pressJobButton(sim) {
  const a = jobButton(sim), j = sim.job;
  if (!a) return false;
  if (a.kind === 'start') startJob(sim, sim.player.car.job);
  else if (a.kind === 'evstart') startEvent(sim, a.ev);
  else if (a.kind === 'hook') { j.hooked = true; j.target.towed = true; j.target.parked = false; j.pvx = 0; j.pvy = 0; j.strain = 0; sim.ev('snap'); sim.ev('vox_tow_hooked'); sim.say('HOOKED — HAUL IT TO THE GARAGE', 1.6); }
  else if (a.kind === 'unhook') { j.hooked = false; j.target.towed = false; }
  else if (a.kind === 'sling') {
    const c = j.car; j.hooked = false; j.flying = 1.6;
    j.pvx += Math.cos(c.h) * c.v * 1.15; j.pvy += Math.sin(c.h) * c.v * 1.15;
    sim.ev('vox_tow_sling'); sim.ev('hop');
  } else if (a.kind === 'decoy') throwDecoy(sim, j);
  else if (a.kind === 'bail') tandemBail(sim, j);
  return true;
}

export function stepJobs(sim, dt, inp) {
  guardJobCars(sim, dt);   // INSTANT-START: the kerb restocks even while no job is running
  const P = sim.player;
  if (inp && inp.punch && P.mode === 'car') pressJobButton(sim);
  const j = sim.job;
  if (!j) return;
  j.t += dt;
  if (sim.busted) { endJob(sim, null, false); return; }
  if (j.car.wreck) { endJob(sim, TITLES[j.kind] + ' — WRECKED', false); return; }
  const inJobCar = P.mode === 'car' && P.car === j.car;
  if (!inJobCar && !(j.kind === 'getaway' && j.tandem && P.mode === 'board')) {
    if (j.kind === 'getaway' && j.phase === 'run' && !j.tandem) { j.outT = (j.outT || 0) + dt; if (j.outT > 20) endJob(sim, 'CREW LEFT BEHIND', false); return; }
    endJob(sim, TITLES[j.kind] + ' OVER', true); return;
  }
  j.outT = 0;
  j.timer -= dt;
  if (j.timer <= 0) { endJob(sim, 'OUT OF TIME', false); return; }
  if (j.kind === 'taxi') stepTaxi(sim, j, dt);
  else if (j.kind === 'tow') stepTow(sim, j, dt);
  else if (j.kind === 'bus') stepBus(sim, j, dt);
  else stepGetaway(sim, j, dt);
}

export const JOBS = { CABLE, BUS_STOPS, SAFEHOUSE, TITLES };

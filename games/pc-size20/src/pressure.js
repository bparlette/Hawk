// pressure.js — SKY + STREET PRESSURE (v2 step 4). At 3 stars a police helicopter arrives and hunts
// you with its searchlight: inside the beam's pool you're seen, so the heat can't cool. At 3 stars it
// sweeps a figure-8 ahead of where it last saw you; at 4-5 it leads your heading and tightens.
// You can outrun the beam (a fast car beats its slew), or go inside (the motel).
// Street pressure (roadblocks, spike strips, the SWAT van) lives here too.
// Gemini's look spec: shots/PRESSURE-DELTA.md; sprites: assets/pressure/ (tools/import_pressure.mjs).

import { burst, report, D, spawnSpark } from './destruct.js';

const ALT = 120;                         // chopper altitude (world units) — sets its shadow offset
const POOL_R = 70;                       // searchlight pool radius on the ground
const SLEW = [0, 0, 0, 120, 175, 225];   // beam hotspot max speed by stars (u/s); a car tops out ~290
const FLY = 170;                         // chopper cruise speed (u/s)

export function initPressure(sim) {
  sim.chopper = null;
  sim.sawhorses = [];        // { x, y, a, broken, t }
  sim.spikes = [];           // { x, y, a } — a strip 44 units long across a lane
  sim.rbNext = 0; sim.roadblocks = 0;
}

// ---------------------------------------------------------------- street pressure (4-5 stars)
// A roadblock one stretch ahead of where you're driving: two cruisers nosed together in a shallow V
// across the road (the second is the SWAT van at 5 stars), sawhorses closing most of what's left,
// a spike strip on the approach. One kerb-side gap is always open — and the sawhorses shatter if
// you hit them fast enough, so there's a risky way and a brave way through, never a wall.
const SMASH_V = 130;         // ~45% of a car's top speed: above this a sawhorse shatters and you keep going
const SPIKE_VMAX = 150;      // blown tyres: this is all the car will do
const RIMS_T = 8;            // the player's grace on blown tyres: 8 s ON RIMS before the limp
const RIMS_VMAX = 210;       // the cap at the start of the rim run, decaying to SPIKE_VMAX

export function spawnRoadblock(sim, sAt, dirIn) {
  const W = sim.W, r = sim.rnd;
  let s = sAt, dir = dirIn;
  if (s === undefined) {
    const c = sim.player.car, tp = W.loopAt(sim.playerS);
    const along = (Math.cos(c.h) * tp.tx + Math.sin(c.h) * tp.ty) * Math.sign(c.v || 1);
    dir = along >= 0 ? 1 : -1;
    s = null;
    for (let k = 0; k < 8 && s === null; k++) {         // a straight stretch, 500-800 units ahead
      const t = sim.playerS + dir * (500 + k * 40), a = W.loopAt(t - 70), b = W.loopAt(t + 70);
      if (a.tx * b.tx + a.ty * b.ty > 0.985) s = t;
    }
    if (s === null) return false;
  }
  const q = W.loopAt(s), nx = -q.ty, ny = q.tx, hr = W.halfRoad, h = Math.atan2(q.ty, q.tx);
  const side = r() < 0.5 ? -1 : 1;                      // which kerb keeps the gap
  const at = (across, along) => [q.x + nx * across + q.tx * along, q.y + ny * across + q.ty * along];
  if (sim.cars.some(c => Math.hypot(c.x - q.x, c.y - q.y) < 70)) return false;
  const van = sim.stars >= 5 && sim.M.cars.swat_van ? 'swat_van' : 'police';
  const extra = { parked: true, fixed: false, roadblock: true, siren: true };
  const [ax, ay] = at(-side * hr * 0.55, 0), [bx, by] = at(-side * hr * 0.02, 0);
  sim.addCar(ax, ay, h + side * 1.15, 'police', null, extra);
  sim.addCar(bx, by, h - side * 1.15, van, null, extra);
  for (const k of [0.5, 0.82]) { const [x, y] = at(side * hr * k, (k - 0.6) * 14); sim.sawhorses.push({ x, y, a: h + Math.PI / 2 + (r() - 0.5) * 0.3, broken: false, t: 0 }); }
  const [sx, sy] = at(side * hr * 0.5, -dir * 95);      // spikes on the approach, in the lane that leads to the gap
  sim.spikes.push({ x: sx, y: sy, a: h + Math.PI / 2 });
  sim.roadblocks++;
  sim.ev('siren');
  sim.say(van === 'swat_van' ? 'SWAT ROADBLOCK AHEAD' : 'ROADBLOCK AHEAD', 1.6);
  return true;
}

function stepStreet(sim, dt) {
  const f = sim.focus();
  if (sim.stars >= 4 && !sim.busted && !(sim.legalJob && sim.legalJob()) && sim.player.mode === 'car' && Math.abs(sim.player.car.v) > 80 && sim.time > sim.rbNext) {
    sim.rbNext = sim.time + (spawnRoadblock(sim) ? 16 : 2);
  }
  // sawhorses: smash through at speed, or get stopped short
  for (const h of sim.sawhorses) {
    if (h.broken) { h.t += dt; continue; }
    for (const c of sim.cars) {
      const sp = Math.abs(c.v);
      if (sp < 20 || Math.hypot(c.x - h.x, c.y - h.y) > c.len / 2 + 7) continue;
      const lx = (h.x - c.x) * Math.cos(c.h) + (h.y - c.y) * Math.sin(c.h), ly = -(h.x - c.x) * Math.sin(c.h) + (h.y - c.y) * Math.cos(c.h);
      if (Math.abs(lx) > c.len / 2 + 5 || Math.abs(ly) > c.wid / 2 + 7) continue;
      h.broken = true; h.t = 0;
      const dx = Math.cos(c.h) * Math.sign(c.v), dy = Math.sin(c.h) * Math.sign(c.v), mine = c.driver === 'player';
      burst(sim, D.WOOD, sp > SMASH_V ? 9 : 4, h.x, h.y, dx, dy, sp * 0.7, 1.1);
      if (sp > SMASH_V) { c.v *= 0.92; sim.ev('crack'); if (mine) { report(sim, h.x, h.y, 60, 0, 'player', 'SMASHED THROUGH'); sim.punchZoom = 1; } }
      else { c.v *= 0.35; sim.ev('bump'); }
      break;
    }
  }
  // spike strips: any car that crosses one loses its tyres. Cop cars (and traffic) blow straight
  // to the limp; the PLAYER gets 8 s ON RIMS first — sparks, a fishtail and a decaying cap — because
  // a desperate rim run to the safe house is a better story than an instant hobble.
  for (const k of sim.spikes) {
    const ca = Math.cos(k.a), sa = Math.sin(k.a);
    for (const c of sim.cars) {
      if (c.spiked || (c.rims || 0) > 0 || Math.abs(c.v) < 30) continue;
      const u = (c.x - k.x) * ca + (c.y - k.y) * sa, w = -(c.x - k.x) * sa + (c.y - k.y) * ca;
      if (Math.abs(u) > 22 + c.wid / 2 || Math.abs(w) > c.len / 2) continue;
      burst(sim, D.TIRE, 3, c.x, c.y, Math.cos(c.h), Math.sin(c.h), 60, 1);
      sim.ev('snap');
      if (c.driver === 'player') { c.rims = RIMS_T; sim.say('ON RIMS!', 1.6); }
      else { c.spiked = true; }
    }
  }
  // ON RIMS (player only): the cap decays 210 -> 150 over the 8 s, the back end steps out in a
  // fishtail (heading wander + a lateral slide), and the wheels throw a stream of sparks. When the
  // clock runs out the tyres' remains give up: the ordinary blown-tyre limp takes over.
  for (const c of sim.cars) {
    if (!((c.rims || 0) > 0)) continue;
    c.rims -= dt;
    const sp = Math.abs(c.v);
    if (c.rims <= 0) {
      c.rims = 0; c.spiked = true;
      if (c.driver === 'player') sim.say('TYRES BLOWN', 1.6);
      continue;
    }
    const cap = SPIKE_VMAX + (RIMS_VMAX - SPIKE_VMAX) * (c.rims / RIMS_T);
    if (sp > cap) c.v = Math.sign(c.v) * Math.max(cap, sp - 420 * dt);
    const sway = Math.min(1, sp / 140);
    c.h += Math.sin(sim.time * 11 + c.id * 2.7) * 0.55 * dt * sway;                       // the wheel fights, harder
    const slide = Math.sin(sim.time * 6.3 + c.id * 1.9) * 34 * sway;                      // ...and the tail slides
    c.x += -Math.sin(c.h) * slide * dt; c.y += Math.cos(c.h) * slide * dt;
    if (sp > 40) {                                                                        // sparks off both rear wheels
      const ca = Math.cos(c.h), sa = Math.sin(c.h), r = sim.fxr;
      for (const s of [-1, 1]) {
        const wx = c.x - ca * c.len * 0.32 - sa * s * c.wid * 0.42, wy = c.y - sa * c.len * 0.32 + ca * s * c.wid * 0.42;
        for (let n = 0; n < 2; n++) spawnSpark(sim, wx, wy, -ca * sp * (0.25 + r() * 0.4) + (r() - 0.5) * 90, -sa * sp * (0.25 + r() * 0.4) + (r() - 0.5) * 90);
      }
    }
  }
  // blown tyres: drag down to a limp, and the wheel fights you
  for (const c of sim.cars) {
    if (!c.spiked) continue;
    const sp = Math.abs(c.v);
    if (sp > SPIKE_VMAX) c.v = Math.sign(c.v) * Math.max(SPIKE_VMAX, sp - 420 * dt);   // rims on asphalt: no throttle beats this
    c.h += Math.sin(sim.time * 13 + c.id) * 0.22 * dt * Math.min(1, sp / 120);
  }
  // tidy up what's far behind
  if (sim.sawhorses.length) sim.sawhorses = sim.sawhorses.filter(h => Math.hypot(h.x - f.x, h.y - f.y) < 1300 && !(h.broken && h.t > 20));
  if (sim.spikes.length) sim.spikes = sim.spikes.filter(k => Math.hypot(k.x - f.x, k.y - f.y) < 1300);
}

function spawnChopper(sim, f) {
  // in from off-screen, upwind of the player
  const a = sim.fxr() * Math.PI * 2;
  const x = f.x + Math.cos(a) * 700, y = f.y + Math.sin(a) * 700;
  sim.chopper = { x, y, h: Math.atan2(f.y - y, f.x - x), vx: 0, vy: 0, bx: f.x + Math.cos(a) * 300, by: f.y + Math.sin(a) * 300,
                  lock: false, lockT: 0, lockTotal: 0, seenX: f.x, seenY: f.y, leaving: false, t: 0, ghostA: 0 };
  sim.ev('chopper');
  sim.say('POLICE CHOPPER', 1.6);
}

export function stepPressure(sim, dt) {
  stepStreet(sim, dt);
  const f = sim.focus();
  const wantChopper = sim.stars >= 3 && !sim.busted && !sim.siege && !(sim.legalJob && sim.legalJob());
  let c = sim.chopper;
  if (!c && wantChopper) { spawnChopper(sim, f); c = sim.chopper; }
  if (!c) return;
  c.t += dt;
  if (!wantChopper && !c.leaving) { c.leaving = true; c.lock = false; }
  if (c.leaving) {
    // bank away and climb out of the city
    const dx = c.x - f.x, dy = c.y - f.y, d = Math.hypot(dx, dy) || 1;
    c.vx += (dx / d * FLY * 1.3 - c.vx) * Math.min(1, dt * 1.2); c.vy += (dy / d * FLY * 1.3 - c.vy) * Math.min(1, dt * 1.2);
    c.x += c.vx * dt; c.y += c.vy * dt; c.h = Math.atan2(c.vy, c.vx);
    c.bx += (c.x - c.bx) * Math.min(1, dt * 2); c.by += (c.y - c.by) * Math.min(1, dt * 2);
    if (d > 1100) sim.chopper = null;
    return;
  }
  const stars = Math.min(5, sim.stars);
  // where the beam wants to be
  const fv = sim.player.mode === 'car' ? { x: Math.cos(sim.player.car.h) * sim.player.car.v, y: Math.sin(sim.player.car.h) * sim.player.car.v }
    : sim.player.mode === 'board' ? { x: sim.board.vx, y: sim.board.vy } : { x: 0, y: 0 };
  let tx, ty;
  if (c.lock || stars >= 4) {
    const lead = stars >= 5 ? 0.55 : 0.4;
    tx = f.x + fv.x * lead; ty = f.y + fv.y * lead;
  } else {
    // 3 stars: a figure-8 search ahead of where it last had you
    const u = c.t * 0.7;
    tx = c.seenX + Math.sin(u) * 110; ty = c.seenY + Math.sin(u * 2) * 55;
  }
  // the hotspot slews toward the target at a capped speed — you can outrun it
  const sx = tx - c.bx, sy = ty - c.by, sd = Math.hypot(sx, sy), smax = SLEW[stars] * dt;
  if (sd > smax) { c.bx += sx / sd * smax; c.by += sy / sd * smax; } else { c.bx = tx; c.by = ty; }
  // the aircraft holds a stand-off point behind and up-sun of the beam, turning to face it
  const hx = c.bx - 80, hy = c.by - 120;    // close enough to share the phone frame with its pool
  const ax = (hx - c.x) * 5 - c.vx * 3.6, ay = (hy - c.y) * 5 - c.vy * 3.6;   // a firm hold on station, slightly under-damped
  c.vx += ax * dt; c.vy += ay * dt;
  const sp = Math.hypot(c.vx, c.vy); if (sp > FLY) { c.vx *= FLY / sp; c.vy *= FLY / sp; }
  c.x += c.vx * dt; c.y += c.vy * dt;
  const want = Math.atan2(c.by - c.y, c.bx - c.x);
  let dh = want - c.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  c.h += dh * Math.min(1, dt * 2.5);
  c.ghostA += (Math.atan2(c.by - c.y, c.bx - c.x) - c.ghostA) * Math.min(1, dt * 3);
  // lock: the player inside the pool of light
  const inPool = Math.hypot(f.x - c.bx, f.y - c.by) < POOL_R;
  if (inPool && !c.lock) sim.ev('lock');
  c.lock = inPool;
  if (inPool) { c.lockT += dt; c.lockTotal += dt; c.seenX = f.x; c.seenY = f.y; sim.lostT = 0; }
  else c.lockT = 0;
}

export const CHOPPER = { ALT, POOL_R };
export const STREET = { SMASH_V, SPIKE_VMAX, RIMS_T, RIMS_VMAX };

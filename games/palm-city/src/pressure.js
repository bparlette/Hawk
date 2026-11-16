// pressure.js — SKY + STREET PRESSURE (v2 step 4). At 3 stars a police helicopter arrives and hunts
// you with its searchlight: inside the beam's pool you're seen, so the heat can't cool. At 3 stars it
// sweeps a figure-8 ahead of where it last saw you; at 4-5 it leads your heading and tightens.
// You can outrun the beam (a fast car beats its slew), or go inside (the motel).
// Street pressure (roadblocks, spike strips, the SWAT van) lives here too.
// Gemini's look spec: shots/PRESSURE-DELTA.md; sprites: assets/pressure/ (tools/import_pressure.mjs).

const ALT = 120;                         // chopper altitude (world units) — sets its shadow offset
const POOL_R = 70;                       // searchlight pool radius on the ground
const SLEW = [0, 0, 0, 120, 175, 225];   // beam hotspot max speed by stars (u/s); a car tops out ~290
const FLY = 170;                         // chopper cruise speed (u/s)

export function initPressure(sim) {
  sim.chopper = null;
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
  const f = sim.focus();
  const wantChopper = sim.stars >= 3 && !sim.busted && !sim.siege;
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
  const ax = (hx - c.x) * 0.9 - c.vx * 1.1, ay = (hy - c.y) * 0.9 - c.vy * 1.1;
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

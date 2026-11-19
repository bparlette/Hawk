// watercraft.js — the fourth way to move: two craft moored at the pier, plus the police boat
// that hunts you on the water. Scope is skateboard-sized on purpose: one module, heading +
// velocity physics with drift, a painted spray system, and a mount/dismount at the dock.
//   JETSKI         small (about twice the board's footprint): quick, carvy, modest top speed.
//   CIGARETTE BOAT long offshore racer: much faster, slower to wind up, wide sweeping turns.
//   POLICE BOAT    AI: patrols from the marina side, pursues at 2+ stars while you're on the
//                  water, pins you for the standard car-bust time and you're busted.
// On the water the A button is TURBO (controls.js) — the same hold-to-boost as a car.
// The spray is painted, not particles-in-grey: foam-white and aqua dabs thrown off the stern
// that arc, spread and fade — a choppy plume on the ski, a tall rooster tail on the boats.

import { stepTurbo, TURBO } from './controls.js';

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export const CRAFT_SPECS = {
  jetski: { len: 30, wid: 14, accel: 300, top: 240, turn: 3.3, carve: 5.5, spray: 110, vz0: 25, vz1: 75, life: 0.9 },
  boat: { len: 76, wid: 18, accel: 165, top: 400, turn: 1.45, carve: 1.7, spray: 210, vz0: 60, vz1: 160, life: 1.25 },
  cop: { len: 64, wid: 17, accel: 205, top: 470, turn: 1.6, carve: 2.0, spray: 190, vz0: 55, vz1: 145, life: 1.2 },
};
// cop top speed 470 sits below the cigarette boat's turbo top (400 x 1.4 = 560) and above its
// cruise (400): hold the turbo and you walk away; cruise or carve sloppily and it runs you down.

const SPRAY_COLS = ['#fbf0d8', '#ffffff', '#aee6ef', '#5ab8cf', '#fbf0d8', '#dff6f2'];
const BUST_T = 2.8;          // the car bust time (sim.js stepWanted): pinned this long = busted
const BUST_R = 64;           // the boat has you when it is this close and neither of you is moving

function makeCraft(kind, x, y, h) {
  return { kind, spec: CRAFT_SPECS[kind], x, y, h, vx: 0, vy: 0, v: 0, ridden: false,
           turbo: 0, turboHeat: 0, turboLock: 0, aHeld: false, turboArmed: false, sprayAcc: 0, bumpT: -9,
           phase: kind === 'jetski' ? 0.7 : kind === 'boat' ? 2.9 : 4.4 };   // bob phase: fixed, the sim is seeded
}

// The pier's baked sprite carries three moored boats of its own (two north, one south);
// they are scenery, and solid. Centres/radii read off assets/pier.webp.
// exported: the seaplane (seaplane.js) pushes off the same painted hulls when it taxis
export const BAKED_BOATS = [{ x: 1520, y: 1005, r: 30 }, { x: 1619, y: 999, r: 40 }, { x: 1508, y: 1069, r: 45 }];

export function initWatercraft(sim) {
  const P = sim.W.L.pier;
  sim.water = {
    craft: [
      makeCraft('jetski', 1592, P.y + P.h + 36, 0),          // south side of the pier, clear of the baked boats
      makeCraft('boat', 1652, P.y + P.h + 38, Math.PI),      // east of it, bow west toward the marina
    ],
    ride: null,              // the craft the player is on (player.mode === 'water')
    cop: null,               // the police boat, when it is out
    spray: [],               // painted foam: { x, y, z, vx, vy, vz, t, life, size, col, rot }
    buoys: [                 // three marks out in the bay, to round for fun
      { x: 1742, y: 862 }, { x: 1696, y: 1212 }, { x: 1748, y: 1562 },
    ],
    hintT: -9,
  };
  // INSTANT-START (owner rule, Nov 16): each player craft remembers its mooring
  for (const cr of sim.water.craft) { cr.home = { x: cr.x, y: cr.y, h: cr.h }; cr.farT = 0; }
  // the sea edge reads in play: a buoy line along the open-water limits (east + south)
  const sE = sim.W.seaE, sS = sim.W.seaS;
  if (sE && sS) {
    for (let y = 260; y <= sS - 260; y += 215) sim.water.buoys.push({ x: sE - 55, y });
    for (let x = 1560; x <= sE - 260; x += 215) sim.water.buoys.push({ x, y: sS - 55 });
  }
}

export const craftSpeed = (cr) => Math.hypot(cr.vx, cr.vy);

// ------------------------------------------------------------------ mount / dismount
export function nearCraft(sim) {
  const p = sim.player.ped;
  for (const cr of sim.water.craft) {
    if (!cr.ridden && Math.hypot(cr.x - p.x, cr.y - p.y) < 46) return cr;
  }
  return null;
}

export function mountCraft(sim, cr) {
  const P = sim.player;
  P.mode = 'water';
  cr.ridden = true;
  sim.water.ride = cr;
  cr.vx = cr.vy = 0;
  P.ped.x = cr.x; P.ped.y = cr.y; P.ped.h = cr.h;
  sim.ev('door');
}

// Distance from a point to the pier deck rectangle (0 when alongside it).
function pierDist(sim, x, y) {
  const P = sim.W.L.pier;
  const dx = Math.max(P.x - x, 0, x - (P.x + P.w)), dy = Math.max(P.y - y, 0, y - (P.y + P.h));
  return Math.hypot(dx, dy);
}

export function canDismount(sim) {
  const cr = sim.water && sim.water.ride;
  return !!cr && craftSpeed(cr) < 70 && pierDist(sim, cr.x, cr.y) < 56;
}

export function dismountCraft(sim) {
  const cr = sim.water.ride;
  if (!cr || !canDismount(sim)) return false;
  const P = sim.W.L.pier, p = sim.player.ped;
  p.x = clamp(cr.x, P.x + 10, P.x + P.w - 6);            // step back up onto the deck
  p.y = cr.y < P.y + P.h / 2 ? P.y + 7 : P.y + P.h - 7;
  p.h = cr.h;
  cr.ridden = false; cr.vx *= 0.25; cr.vy *= 0.25;
  sim.water.ride = null;
  sim.player.mode = 'foot';
  sim.ev('door');
  return true;
}

// ------------------------------------------------------------------ physics
// Hard stops (axis-slide against these): land — anything that is not open water — the pier
// deck, and the world edge. Round things (the pier's baked boats, the other craft) are NOT
// hard stops: a centre that strays inside one is pushed back out along the centre line, the
// way walkers slide round palms — axis-sliding alone wedges a hull inside a circle's margin.
function hardBlocked(sim, cr, x, y) {
  const W = sim.W;
  // the open sea runs past the land world's east/south edges (world.seaE/seaS); west and
  // north limits are unchanged — the shell's causeway water stays as it was
  if (x < 10 || y < 10 || x > (W.seaE || W.L.world.w) - 10 || y > (W.seaS || W.L.world.h) - 10) return true;
  if (W.surfaceAt(x, y) !== 'water') return true;
  const P = W.L.pier, r = cr.spec.wid * 0.62;
  return x > P.x - r && x < P.x + P.w + r && y > P.y - r && y < P.y + P.h + r;
}

function circleResolve(sim, cr) {
  let pushed = false;
  const push = (ox, oy, R) => {
    const dx = cr.x - ox, dy = cr.y - oy, d = Math.hypot(dx, dy);
    if (d >= R) return;
    if (d < 0.01) { cr.x = ox + R; pushed = true; return; }
    cr.x = ox + dx / d * R; cr.y = oy + dy / d * R; pushed = true;
  };
  for (const b of BAKED_BOATS) push(b.x, b.y, b.r + cr.spec.wid * 0.5);
  const others = sim.water.cop && sim.water.cop !== cr ? [...sim.water.craft, sim.water.cop] : sim.water.craft;
  for (const o of others) if (o !== cr) push(o.x, o.y, cr.spec.len * 0.30 + o.spec.len * 0.34 + 2);
  return pushed;
}

// grinding along a wall/hull at speed: spray and a bump (gated), but no velocity cut —
// the slide itself is the cost. Called from physStep's slide branches only.
function slideBump(sim, cr, spd) {
  if (spd > 110 && sim.time - cr.bumpT > 0.45) { cr.bumpT = sim.time; if (cr.ridden || cr.kind === 'cop') sim.ev('bump'); burstSpray(sim, cr, 8); }
}

// One physics step for any craft. throttle 0..1, targetH the heading it wants (null = hold),
// boost = the turbo is firing (player craft only; the cop passes false).
function physStep(sim, cr, dt, throttle, targetH, boost) {
  const sp = cr.spec;
  if (targetH !== null && targetH !== undefined) {
    const d = wrap(targetH - cr.h), m = sp.turn * dt;
    cr.h = wrap(cr.h + clamp(d, -m, m));
  }
  const top = sp.top * (1 + (TURBO.mult - 1) * (cr.turbo || 0));
  const acc = sp.accel * (boost ? TURBO.accel : 1);
  if (throttle > 0) { cr.vx += Math.cos(cr.h) * acc * throttle * dt; cr.vy += Math.sin(cr.h) * acc * throttle * dt; }
  let spd = craftSpeed(cr);
  if (spd > 1) {                                   // velocity bends toward the heading: the ski
    const va = Math.atan2(cr.vy, cr.vx);           // carves after it, the boats slide wide
    const nv = va + wrap(cr.h - va) * Math.min(1, sp.carve * dt);
    cr.vx = Math.cos(nv) * spd; cr.vy = Math.sin(nv) * spd;
  }
  const f = Math.exp(-(acc / top) * dt * (throttle > 0 ? 1 : 2.4));   // drag: terminal = top
  cr.vx *= f; cr.vy *= f;
  // move, sliding along whatever stops us; a hard arrival costs speed and throws spray.
  // A slide that SUCCEEDS is not a hit: it costs only the into-wall component. (The old code
  // also cut ALL velocity x0.55 on every blocked step, slides included — a slow-turning hull
  // could never swing its velocity clear before the next cut landed, so the boat glued to the
  // first thing it touched and "only rotated". Owner report, Nov 16.)
  const nx = cr.x + cr.vx * dt, ny = cr.y + cr.vy * dt;
  if (!hardBlocked(sim, cr, nx, ny)) { cr.x = nx; cr.y = ny; }
  else if (!hardBlocked(sim, cr, nx, cr.y)) { cr.x = nx; cr.vy *= 0.35; slideBump(sim, cr, spd); }
  else if (!hardBlocked(sim, cr, cr.x, ny)) { cr.y = ny; cr.vx *= 0.35; slideBump(sim, cr, spd); }
  else {
    cr.vx *= -0.15; cr.vy *= -0.15;                       // nose-dead: bounce off
    if (spd > 130) {                                      // a fast arrival is a real hit
      if (sim.time - cr.bumpT > 0.45) { cr.bumpT = sim.time; if (cr.ridden || cr.kind === 'cop') sim.ev('bump'); burstSpray(sim, cr, 10); }
      cr.vx *= 0.55; cr.vy *= 0.55;
    }
  }
  if (circleResolve(sim, cr)) {           // shouldered off a boat or the other craft: the push-out
    if (sim.time - cr.bumpT > 0.45) {     // is positional every step, but the speed cost lands once
      cr.bumpT = sim.time;                // per contact, not per frame — grinding round a hull is free
      cr.vx *= 0.7; cr.vy *= 0.7;
      if (spd > 110) { if (cr.ridden || cr.kind === 'cop') sim.ev('bump'); burstSpray(sim, cr, 8); }
    }
  }
  cr.v = craftSpeed(cr);
  emitSpray(sim, cr, dt, boost);
}

// ------------------------------------------------------------------ spray
function sprayOne(sim, cr, back, spread, vzMul) {
  const S = sim.water.spray, r = sim.fxr, sp = cr.spec, spd = craftSpeed(cr);
  const ca = Math.cos(cr.h), sa = Math.sin(cr.h), side = (r() - 0.5) * sp.wid * 0.8;
  S.push({
    x: cr.x - ca * sp.len * back - sa * side, y: cr.y - sa * sp.len * back + ca * side,
    z: 0, vx: -ca * spd * (0.22 + r() * 0.25) + -sa * (r() - 0.5) * spread, vy: -sa * spd * (0.22 + r() * 0.25) + ca * (r() - 0.5) * spread,
    vz: (sp.vz0 + r() * (sp.vz1 - sp.vz0)) * vzMul * (0.4 + 0.6 * spd / sp.top),
    t: 0, life: sp.life * (0.6 + r() * 0.7), size: 2 + r() * 3.6, col: SPRAY_COLS[(r() * SPRAY_COLS.length) | 0], rot: r() * TAU,
  });
  if (S.length > 520) S.splice(0, S.length - 520);
}

function burstSpray(sim, cr, n) { for (let i = 0; i < n; i++) sprayOne(sim, cr, 0.3, 60, 0.7); }

function emitSpray(sim, cr, dt, boost) {
  const spd = craftSpeed(cr);
  if (spd < 26) { cr.sprayAcc = 0; return; }
  const k = spd / cr.spec.top;
  cr.sprayAcc += cr.spec.spray * k * (boost ? 2 : 1) * dt;
  while (cr.sprayAcc >= 1) { cr.sprayAcc -= 1; sprayOne(sim, cr, 0.5, 26 + spd * 0.1, boost ? 1.35 : 1); }
  // bow foam: a dab or two thrown off the shoulders while it is planing
  if (spd > 90 && sim.fxr() < dt * 22 * k) sprayOne(sim, cr, -0.32, 40, 0.4);
}

// ------------------------------------------------------------------ the player on a craft
export function stepCraft(sim, dt, inp) {
  const cr = sim.water.ride;
  if (!cr) return;
  if (inp.action) {
    if (dismountCraft(sim)) return;
    if (sim.time - sim.water.hintT > 3) { sim.water.hintT = sim.time; sim.say('HOP OFF AT THE PIER', 1.4); }
  }
  let jx = inp.jx, jy = inp.jy, jm = inp.jm;
  const k = inp.keys || {};
  if (k.up || k.down || k.left || k.right) {
    jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    jm = Math.hypot(jx, jy) ? 1 : 0;
    if (jm) { const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
  }
  cr.v = craftSpeed(cr);
  const boost = stepTurbo(sim, cr, !!inp.turbo, jm, dt);        // A held: TURBO (controls.js)
  physStep(sim, cr, dt, jm > 0.12 ? jm : 0, jm > 0.12 ? Math.atan2(jy, jx) : null, boost);
  const p = sim.player.ped;
  p.x = cr.x; p.y = cr.y; p.h = cr.h; p.pose = 1;
}

// ------------------------------------------------------------------ the police boat
function spawnCop(sim) {
  const f = sim.focus(), P = sim.W.L.pier;
  // It comes along the bay from the player's own side of the pier first — the deck and its
  // moored boats wall off the direct line from the far side. Always a real approach away,
  // never on top of the player: the bay is a narrow strip, so it comes along it.
  const south = f.y > P.y + P.h / 2;
  const cands = south
    ? [[f.x + 60, f.y + 390], [f.x - 40, f.y + 430], [P.x + P.w + 26, P.y + P.h / 2], [f.x + 60, f.y - 390], [1720, 1900]]
    : [[f.x + 60, f.y - 390], [f.x - 40, f.y - 430], [P.x + P.w + 26, P.y + P.h / 2], [f.x + 60, f.y + 390], [1720, 300]];
  for (const [x, y] of cands) {
    if (x < 30 || y < 30 || x > (sim.W.seaE || sim.W.L.world.w) - 30 || y > (sim.W.seaS || sim.W.L.world.h) - 30) continue;
    if (sim.W.surfaceAt(x, y) !== 'water') continue;
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 240 || d > 760) continue;
    const cop = makeCraft('cop', x, y, Math.atan2(f.y - y, f.x - x));
    cop.mode = 'chase';
    sim.water.cop = cop;
    sim.ev('siren');
    return cop;
  }
  return null;
}

function stepCop(sim, dt) {
  const W = sim.water, P = sim.player;
  const onWater = P.mode === 'water' && !sim.busted;
  if (!W.cop) {
    if (onWater && sim.stars >= 2) spawnCop(sim);
    return;
  }
  const cop = W.cop, ride = W.ride;
  if (!onWater || sim.stars < 2) cop.mode = 'leave';                   // ashore or cooled off: land cops' job
  if (cop.mode === 'leave') {
    const ty = cop.y < 1100 ? 700 : 1600;                            // break off east, out to open water
    const seaE = sim.W.seaE || sim.W.L.world.w;
    physStep(sim, cop, dt, 0.85, Math.atan2(ty - cop.y, seaE - 60 - cop.x), false);
    if (cop.x > seaE - 110 || Math.hypot(cop.x - sim.focus().x, cop.y - sim.focus().y) > 880) W.cop = null;
    return;
  }
  // chase: steer at where the player's craft will be, ease off alongside so it can pin, not orbit
  const tx = ride.x + ride.vx * 0.35, ty = ride.y + ride.vy * 0.35;
  const d = Math.hypot(ride.x - cop.x, ride.y - cop.y);
  let throttle = d > 120 ? 1 : d > BUST_R ? 0.55 + 0.45 * (d - BUST_R) / (120 - BUST_R) : Math.min(1, craftSpeed(ride) / cop.spec.top + 0.06);
  let targetH = Math.atan2(ty - cop.y, tx - cop.x);
  // anti-wedge: full throttle and going nowhere means it is pressed against the pier or a
  // moored hull — break east into open water for a moment, then come at the player again
  if (throttle > 0.5 && craftSpeed(cop) < 25) cop.stuckT = (cop.stuckT || 0) + dt; else cop.stuckT = 0;
  if (cop.stuckT > 0.8) { cop.unwedge = 0.7; cop.stuckT = 0; }
  if (cop.unwedge > 0) { cop.unwedge -= dt; targetH = 0; throttle = 1; }
  physStep(sim, cop, dt, throttle, targetH, false);
  // contact: it shoulders your craft — a shove and speed off both of you, never an overlap
  const dx = ride.x - cop.x, dy = ride.y - cop.y, dd = Math.hypot(dx, dy), minD = ride.spec.len * 0.30 + cop.spec.len * 0.34 + 4;
  if (dd < minD && dd > 0.01) {
    const nx = dx / dd, ny = dy / dd, push = minD - dd;
    cop.x -= nx * push * 0.6; cop.y -= ny * push * 0.6;
    ride.x += nx * push * 0.4; ride.y += ny * push * 0.4;
    const rel = Math.abs((ride.vx - cop.vx) * nx + (ride.vy - cop.vy) * ny);
    if (rel > 70 && sim.time - cop.bumpT > 0.5) {          // a real shoulder, not a nudge: swap some way
      cop.bumpT = sim.time;
      ride.vx += (cop.vx - ride.vx) * 0.25; ride.vy += (cop.vy - ride.vy) * 0.25;
      cop.vx *= 0.72; cop.vy *= 0.72;
      sim.ev('bump'); burstSpray(sim, cop, 8); burstSpray(sim, ride, 8);
    }
  }
  // the pin: close alongside at matched speed and the shared bust meter fills (car timing);
  // it drains at 3x the moment you move away — stepWanted leaves bustT to us on the water
  const relSpd = Math.hypot(ride.vx - cop.vx, ride.vy - cop.vy);
  if (d < BUST_R && relSpd < 48) {
    sim.bustT += dt;
    if (sim.bustT > BUST_T) {
      sim.busted = { t: 0 };
      sim.bustT = 0;
      sim.say('BUSTED', 4.2);
      sim.ev('busted');
      W.cop = null;
    }
  } else sim.bustT = Math.max(0, sim.bustT - dt * 3);
}

// ------------------------------------------------------------------ always-on water life
export function stepWaterFx(sim, dt) {
  const W = sim.water;
  if (!W) return;
  stepCop(sim, dt);
  const S = W.spray;
  for (let i = S.length - 1; i >= 0; i--) {
    const p = S[i];
    p.t += dt;
    if (p.t >= p.life) { S.splice(i, 1); continue; }
    p.vz -= 300 * dt;
    p.z += p.vz * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.25; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.exp(-1.5 * dt); p.vx *= f; p.vy *= f;
  }
  for (const cr of W.craft) {                       // a moored craft settles back to still
    if (cr.ridden) continue;
    cr.vx *= Math.exp(-2 * dt); cr.vy *= Math.exp(-2 * dt);
    cr.v = craftSpeed(cr);
    // INSTANT-START stranding guardian: a craft left >260 from its mooring while the player
    // is far away drifts home after 20 s, so the pier always has a craft waiting
    if (cr.home) {
      if (Math.hypot(cr.x - cr.home.x, cr.y - cr.home.y) > 260) {
        cr.farT = (cr.farT || 0) + dt;
        if (cr.farT > 20) {
          const f = sim.focus();
          if (Math.hypot(f.x - cr.x, f.y - cr.y) > 500) { cr.x = cr.home.x; cr.y = cr.home.y; cr.h = cr.home.h; cr.vx = 0; cr.vy = 0; cr.farT = 0; }
        }
      } else cr.farT = 0;
    }
  }
}

// ------------------------------------------------------------------ render side
function hullPath(g, L, Wd) {
  g.beginPath();
  g.moveTo(L * 0.5, 0);
  g.quadraticCurveTo(L * 0.34, -Wd * 0.52, -L * 0.18, -Wd * 0.5);
  g.quadraticCurveTo(-L * 0.46, -Wd * 0.46, -L * 0.48, 0);
  g.quadraticCurveTo(-L * 0.46, Wd * 0.46, -L * 0.18, Wd * 0.5);
  g.quadraticCurveTo(L * 0.34, Wd * 0.52, L * 0.5, 0);
  g.closePath();
}

// The world's cast direction: the baked sprites were lit by a sun at azimuth 255° /
// elevation 30°, so every shadow in the game falls east-north-east and long. render.js
// offsets its procedural shadows (chopper, board lift) by (+0.8, -0.3) per unit — the
// same vector, normalised once here.
const SUN_DX = 0.936, SUN_DY = -0.351;

function drawCraftShape(g, cr, time) {
  const sp = cr.spec, L = sp.len, Wd = sp.wid;
  const bob = cr.ridden ? 0 : Math.sin(time * 1.25 + cr.phase) * 1.1;
  const spd = Math.hypot(cr.vx, cr.vy);
  // CAST SHADOW (round 2 — owner, on the live build: "Everything has a shade and long.
  // But jetski has none."): round 1's blob was a heading-rotated ellipse barely larger
  // than the hull, so past the hull it left a few px of faint halo — nothing at phone
  // size, worst on the little jetski, parked or mounted. Now the craft casts like
  // everything else in the world: a LONG soft shadow down-sun, sun-locked (it does NOT
  // turn with the hull), deep-teal so it sits IN the water, reaching well past the hull
  // toward ENE — the same read as the pier's baked boats in the very same frame.
  const reach = (L * 0.62 + 18) * (1 + Math.min(0.2, (spd / sp.top) * 0.2));   // cast length past the hull, + a touch of speed smear
  const srx = L * 0.5 + reach * 0.55, sry = Wd * 0.72 + 3;
  g.save();
  g.translate(cr.x + SUN_DX * reach * 0.55, cr.y + 2 + SUN_DY * reach * 0.55 + bob * 0.3);
  g.rotate(Math.atan2(SUN_DY, SUN_DX));
  g.scale(1, sry / srx);
  const cg = g.createRadialGradient(0, 0, srx * 0.35, 0, 0, srx);
  cg.addColorStop(0, 'rgba(8,46,66,0.52)');
  cg.addColorStop(0.5, 'rgba(8,46,66,0.38)');
  cg.addColorStop(0.8, 'rgba(8,46,66,0.16)');
  cg.addColorStop(1, 'rgba(8,46,66,0)');
  g.fillStyle = cg;
  g.beginPath(); g.arc(0, 0, srx, 0, TAU); g.fill();
  g.restore();
  // CONTACT SHADOW (round 1, kept): one soft water shadow for craft + rider together
  // (a mounted rider casts no walking shadow — render.js skips it): a deep-teal ellipse
  // a touch larger than the waterline, feathered to nothing at the rim, grounding the
  // hull in the water under the cast shadow, and stretching a little with speed.
  const rx = L * 0.58 * (1 + Math.min(0.30, (spd / sp.top) * 0.30)), ry = Wd * 0.80;
  g.save();
  g.translate(cr.x + 5, cr.y + 3 + bob * 0.4);                       // soft water shadow, down-sun
  g.rotate(cr.h);
  g.scale(1, ry / rx);
  const wg = g.createRadialGradient(0, 0, rx * 0.45, 0, 0, rx);
  wg.addColorStop(0, 'rgba(10,54,72,0.34)');
  wg.addColorStop(0.72, 'rgba(10,54,72,0.20)');
  wg.addColorStop(1, 'rgba(10,54,72,0)');
  g.fillStyle = wg;
  g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
  g.save();
  g.translate(cr.x, cr.y + bob);
  g.rotate(cr.h + Math.sin(time * 1.7 + cr.phase) * (cr.ridden ? 0.004 : 0.012));
  hullPath(g, L, Wd);
  if (cr.kind === 'jetski') {
    g.fillStyle = '#d94f43'; g.fill();
    g.save(); hullPath(g, L, Wd); g.clip();
    g.fillStyle = '#f2e3ce'; g.fillRect(-L * 0.1, -Wd * 0.55, L * 0.2, Wd * 1.1);        // cream band across the bow deck
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(-L * 0.5, -Wd * 0.5, L, Wd * 0.3); // brush light from above
    g.restore();
    hullPath(g, L * 0.8, Wd * 0.72); g.fillStyle = '#e8d9bd'; g.fill();                  // inner deck
    g.fillStyle = '#33244a'; g.beginPath(); g.roundRect(-L * 0.38, -Wd * 0.21, L * 0.42, Wd * 0.42, 3); g.fill();   // seat
    g.strokeStyle = '#33244a'; g.lineWidth = 2;                                          // bars
    g.beginPath(); g.moveTo(L * 0.13, -Wd * 0.2); g.lineTo(L * 0.2, 0); g.lineTo(L * 0.13, Wd * 0.2); g.stroke();
  } else {
    const cop = cr.kind === 'cop';
    g.fillStyle = cop ? '#f2f0e9' : '#f4ead8'; g.fill();
    g.save(); hullPath(g, L, Wd); g.clip();
    g.fillStyle = cop ? '#2a62c9' : '#e8544f';                                            // the long side stripe
    g.fillRect(-L * 0.5, -Wd * 0.5, L, Wd * 0.17); g.fillRect(-L * 0.5, Wd * 0.33, L, Wd * 0.17);
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(-L * 0.5, -Wd * 0.5, L, Wd * 0.34);
    g.fillStyle = 'rgba(70,50,30,0.10)'; g.fillRect(-L * 0.5, Wd * 0.28, L, Wd * 0.22);
    g.restore();
    hullPath(g, L * 0.86, Wd * 0.66); g.fillStyle = cop ? '#dfe5ea' : '#e9dcc2'; g.fill();  // deck
    g.fillStyle = '#33244a'; g.beginPath(); g.roundRect(-L * 0.02, -Wd * 0.26, L * 0.24, Wd * 0.52, 3); g.fill();   // cockpit
    g.fillStyle = 'rgba(150,220,235,0.75)'; g.beginPath(); g.roundRect(L * 0.2, -Wd * 0.24, L * 0.07, Wd * 0.48, 2); g.fill();  // windshield
    g.strokeStyle = 'rgba(51,36,74,0.6)'; g.lineWidth = 1.4;                              // stern hatches
    g.beginPath(); g.moveTo(-L * 0.3, -Wd * 0.3); g.lineTo(-L * 0.3, Wd * 0.3); g.moveTo(-L * 0.4, -Wd * 0.3); g.lineTo(-L * 0.4, Wd * 0.3); g.stroke();
    if (cop) {                                                                             // the light bar: red / blue, strobing
      const ph = Math.floor(time * 5) % 2;
      g.fillStyle = '#33244a'; g.beginPath(); g.roundRect(L * 0.02, -Wd * 0.3, L * 0.09, Wd * 0.6, 2); g.fill();
      g.fillStyle = ph ? '#ff4a5c' : 'rgba(255,74,92,0.25)'; g.beginPath(); g.roundRect(L * 0.025, -Wd * 0.28, L * 0.038, Wd * 0.26, 2); g.fill();
      g.fillStyle = ph ? 'rgba(64,150,255,0.25)' : '#4096ff'; g.beginPath(); g.roundRect(L * 0.07, Wd * 0.02, L * 0.038, Wd * 0.26, 2); g.fill();
    }
  }
  hullPath(g, L, Wd);
  g.strokeStyle = 'rgba(46,28,60,0.55)'; g.lineWidth = 1.6; g.stroke();                    // the plum ink line
  g.restore();
}

// Everything the water adds to the colour pass: buoys, spray (under the hulls), the craft.
// Called from render.js after the board, before the peds — so the rider stands on the deck.
export function drawWatercraft(g, S, time, vx0, vy0, vx1, vy1) {
  const W = S.water;
  for (let i = 0; i < W.buoys.length; i++) {
    const b = W.buoys[i], bob = Math.sin(time * 1.7 + i * 2.1) * 1.6;
    if (b.x < vx0 - 30 || b.x > vx1 + 30 || b.y < vy0 - 30 || b.y > vy1 + 30) continue;
    g.globalAlpha = 0.30; g.fillStyle = '#fbf0d8';
    g.beginPath(); g.ellipse(b.x, b.y + 5 + bob * 0.3, 11, 4.4, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    g.save(); g.translate(b.x, b.y + bob); g.rotate(Math.sin(time * 1.1 + i) * 0.07);
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fillStyle = '#ff7a3c'; g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.clip(); g.fillStyle = '#fff4e0'; g.fillRect(-7, -2.2, 14, 4.4); g.restore();
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.strokeStyle = 'rgba(46,28,60,0.55)'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-2.4, -2.8, 2.2, 1.4, -0.6, 0, TAU); g.fill();
    g.restore();
  }
  for (const p of W.spray) {
    if (p.x < vx0 - 20 || p.x > vx1 + 20 || p.y < vy0 - 20 || p.y > vy1 + 20) continue;
    const u = p.t / p.life, r = p.size * (1 + u * 1.7 + p.z * 0.012);
    g.globalAlpha = 0.5 * (1 - u) * Math.min(1, p.t * 9);
    g.fillStyle = p.col;
    g.beginPath(); g.ellipse(p.x, p.y - p.z * 0.55, r, r * 0.62, p.rot, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  for (const cr of W.craft) if (cr.x > vx0 - 120 && cr.x < vx1 + 120 && cr.y > vy0 - 120 && cr.y < vy1 + 120) drawCraftShape(g, cr, time);
  if (W.cop && W.cop.x > vx0 - 120 && W.cop.x < vx1 + 120 && W.cop.y > vy0 - 120 && W.cop.y < vy1 + 120) drawCraftShape(g, W.cop, time);
}

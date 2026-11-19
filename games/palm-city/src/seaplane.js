// seaplane.js — the DODO: a blue-and-white floatplane (the reference is the GTA Dodo across
// the eras: blue nose, black prop with yellow tips, twin floats) moored at the END of the
// pier, east tip, bow out to sea. The fifth way to move, built from the two patterns that
// already work here: boarding and the dock are the watercraft's (walk out on the deck, one
// ACTION press, HOP OFF back at the pier), the flight and the camera are the helicopter's
// (a state machine on sim.plane, an eased zoom main.js consumes, a wreck that resolves and
// is replaced at its home after a minute).
//
//   docked ──ACTION──▶ water: taxi (stick steers like the boats, A / ↑ spools the throttle)
//   water ──148 u/s + pull up (or 178 u/s regardless)──▶ air
//   air ──descend onto water──▶ water (touchdown spray)   air ──descend onto land / clip a
//   building below roof height──▶ falling ──▶ wreck (on land) / gone (in the bay)
//   wreck / gone ──60 s (3 s if you're waiting at the dock)──▶ docked again
//
// It is a FLOATplane: takeoffs and landings are water-only. Cruise (250 height units) is
// above every roof in the layout, so the whole world — city, shell, the open sea out to
// seaE/seaS — is flyable; come down low over a footprint and you crash, never clip through.
// Throttle is a state, not a hold: A (or ↑) spools it up, the big button held (or ↓) winds
// it down, and it stays where you left it, the way a real throttle quadrant does. Pushing
// the stick forward on the water also feeds throttle demand (the boats' feel), and whatever
// the stick was asking for at liftoff is baked into the throttle so the climb continues.
import { burst, puff, D } from './destruct.js';
import { BAKED_BOATS } from './watercraft.js';

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export const PLANE_LEN = 88, PLANE_SPAN = 116;
const BOARD_R = 86;              // ACTION range from the plane's centre (it floats off the pier tip)
const TAKEOFF_V = 148;           // u/s on the water where the wing starts to lift (~53 km/h at 10 u/m)
const ROTATE_V = 178;            // u/s where it lifts whether you pull up or not
const STALL_V = 125;             // below this in the air it sinks, whatever the stick says
const CEIL_ALT = 250;            // height units above the surface; cruise clears every roof
const ROOF_ALT = 118;            // below this, a building footprint is a crash, not a flyover
const TOP_WATER = 228;           // terminal speed on the water at full throttle
const TOP_AIR = 520;             // terminal speed in the air at full throttle (the heli does 450)
const ACC = 165;                 // water thrust constant (the drag formula makes TOP_WATER the terminal)
const RESPAWN_S = 60;            // a wrecked/lost plane is replaced at the dock after a minute

const SPRAY_COLS = ['#fbf0d8', '#ffffff', '#aee6ef', '#5ab8cf', '#fbf0d8', '#dff6f2'];
// the world's cast direction (watercraft.js has the same pair): sun azimuth 255°, shadows ENE
const SUN_DX = 0.936, SUN_DY = -0.351;

export function dockPos(sim) { const P = sim.W.L.pier; return { x: P.x + P.w + 58, y: P.y + P.h / 2 }; }

export function initPlane(sim) {
  const d = dockPos(sim);
  sim.plane = {
    x: d.x, y: d.y, h: 0, vx: 0, vy: 0, v: 0,          // bow east, out to sea: throttle up and go
    alt: 0, altV: 0, throttle: 0, prop: 0, propA: 0, bank: 0,
    state: 'docked', ridden: false, onLand: false, landArm: false,
    zoom: 0, respawnT: 0, farT: 0, hintT: -9, smokeT: 0, sprayAcc: 0, fallT: 0, phase: 1.3,
    home: { x: d.x, y: d.y, h: 0 },
  };
}

export const planeSpeed = (PL) => Math.hypot(PL.vx, PL.vy);

// ------------------------------------------------------------------ board / exit
export function nearPlane(sim) {
  const PL = sim.plane, P = sim.player;
  if (!PL || P.mode !== 'foot' || P.ped.hidden) return false;
  if (PL.state !== 'docked' && PL.state !== 'water') return false;
  if (PL.ridden) return false;
  const d = Math.hypot(P.ped.x - PL.x, P.ped.y - PL.y);
  return d < BOARD_R && (sim.W.onPier(P.ped.x, P.ped.y, 0) || d < 58);
}

export function boardPlane(sim) {
  const PL = sim.plane, P = sim.player, p = P.ped;
  PL.ridden = true;
  if (PL.state === 'docked') PL.state = 'water';
  PL.landArm = false;
  P.mode = 'flight'; p.hidden = true; p.x = PL.x; p.y = PL.y; p.h = PL.h;
  sim.ev('door');
}

// Distance from a point to the pier deck rectangle (0 when alongside it) — watercraft's measure.
function pierDist(sim, x, y) {
  const P = sim.W.L.pier;
  const dx = Math.max(P.x - x, 0, x - (P.x + P.w)), dy = Math.max(P.y - y, 0, y - (P.y + P.h));
  return Math.hypot(dx, dy);
}

export function canExitPlane(sim) {
  const PL = sim.plane;
  return !!PL && PL.ridden && PL.state === 'water' && PL.v < 30 && PL.throttle < 0.06 && pierDist(sim, PL.x, PL.y) < 100;
}

export function exitPlane(sim) {
  const PL = sim.plane;
  if (!canExitPlane(sim)) return false;
  const Pr = sim.W.L.pier, p = sim.player.ped;
  let placed = false;
  for (const [x, y] of [[Pr.x + Pr.w - 10, PL.y], [Pr.x + Pr.w - 10, Pr.y + Pr.h / 2], [Pr.x + Pr.w - 34, Pr.y + Pr.h / 2], [Pr.x + Pr.w - 64, Pr.y + Pr.h / 2]]) {
    if (sim.canStand(x, y)) { p.x = x; p.y = y; placed = true; break; }
  }
  if (!placed) return false;
  p.h = PL.h; p.hidden = false;
  PL.ridden = false; PL.vx *= 0.2; PL.vy *= 0.2; PL.landArm = false;
  PL.state = Math.hypot(PL.x - PL.home.x, PL.y - PL.home.y) < 44 ? 'docked' : 'water';
  sim.player.mode = 'foot';
  sim.ev('door');
  return true;
}

// What the big button says while you're in the plane (hud.js): LAND in the air, HOP OFF at the dock.
export function planeLabel(sim) {
  const PL = sim.plane;
  if (!PL || !PL.ridden) return '';
  if (PL.state === 'air') return PL.landArm ? '' : 'LAND';
  if (canExitPlane(sim)) return 'HOP OFF';
  return '';
}

// ------------------------------------------------------------------ spray (shared pool: watercraft.js steps and draws it)
function sprayOne(sim, PL, back, spread, vzMul) {
  const S = sim.water && sim.water.spray; if (!S) return;
  const r = sim.fxr, spd = planeSpeed(PL);
  const ca = Math.cos(PL.h), sa = Math.sin(PL.h), side = (r() - 0.5) * 26;
  S.push({
    x: PL.x - ca * PLANE_LEN * back - sa * side, y: PL.y - sa * PLANE_LEN * back + ca * side,
    z: 0, vx: -ca * spd * (0.22 + r() * 0.25) + -sa * (r() - 0.5) * spread, vy: -sa * spd * (0.22 + r() * 0.25) + ca * (r() - 0.5) * spread,
    vz: (26 + r() * 52) * vzMul * (0.4 + 0.6 * spd / TOP_WATER),
    t: 0, life: 1.0 * (0.6 + r() * 0.7), size: 2 + r() * 3.8, col: SPRAY_COLS[(r() * SPRAY_COLS.length) | 0], rot: r() * TAU,
  });
  if (S.length > 520) S.splice(0, S.length - 520);
}
function burstSpray(sim, PL, n) { for (let i = 0; i < n; i++) sprayOne(sim, PL, 0.3, 70, 0.8); }

function emitSpray(sim, PL, dt) {
  const spd = planeSpeed(PL);
  if (spd < 26 || PL.alt > 2) { PL.sprayAcc = 0; return; }
  const k = spd / TOP_WATER;
  PL.sprayAcc += 150 * k * dt;
  while (PL.sprayAcc >= 1) { PL.sprayAcc -= 1; sprayOne(sim, PL, 0.5, 26 + spd * 0.1, 1); }
  if (spd > 110 && sim.fxr() < dt * 24 * k) sprayOne(sim, PL, -0.34, 44, 0.45);   // bow foam off the floats
}

// ------------------------------------------------------------------ water blocking (the watercraft's rules, hull-sized)
function hardBlocked(sim, PL, x, y) {
  const W = sim.W;
  if (x < (W.bounds ? W.bounds.x0 : 0) + 12 || y < 12 || x > (W.seaE || W.L.world.w) - 12 || y > (W.seaS || W.L.world.h) - 12) return true;
  if (W.surfaceAt(x, y) !== 'water') return true;
  const P = W.L.pier, r = 13;
  return x > P.x - r && x < P.x + P.w + r && y > P.y - r && y < P.y + P.h + r;
}

function circleResolve(sim, PL) {
  const push = (ox, oy, R) => {
    const dx = PL.x - ox, dy = PL.y - oy, d = Math.hypot(dx, dy);
    if (d >= R || d < 0.01) return;
    PL.x = ox + dx / d * R; PL.y = oy + dy / d * R;
  };
  for (const b of BAKED_BOATS) push(b.x, b.y, b.r + 15);
  if (sim.water) {
    for (const o of sim.water.craft) push(o.x, o.y, PLANE_LEN * 0.3 + o.spec.len * 0.34 + 2);
    if (sim.water.cop) push(sim.water.cop.x, sim.water.cop.y, PLANE_LEN * 0.3 + sim.water.cop.spec.len * 0.34 + 2);
  }
}

// ------------------------------------------------------------------ the crash
function startCrash(sim) {
  const PL = sim.plane, f = sim.focus();
  burst(sim, D.METAL, 14, PL.x, PL.y, PL.x - f.x, PL.y - f.y);
  burst(sim, D.GLASS, 7, PL.x, PL.y, PL.x - f.x, PL.y - f.y);
  puff(sim, PL.x, PL.y, false, 1.6);
  sim.ev('wreck', 150); sim.ev('crash', 200);
  sim.say('PLANE DOWN', 2.2);
  PL.state = 'falling'; PL.fallT = 0.5; PL.vx *= 0.35; PL.vy *= 0.35; PL.landArm = false;
}

// The fall resolves like the heli's: wreck on land (walk away from it), lost in the bay (wash ashore).
function resolveCrash(sim) {
  const PL = sim.plane, P = sim.player, p = P.ped, W = sim.W;
  PL.alt = 0; PL.altV = 0; PL.throttle = 0; PL.ridden = false;
  P.mode = 'foot'; p.hidden = false; P.stunT = Math.max(P.stunT || 0, 0.8);
  const inWater = W.surfaceAt(PL.x, PL.y) === 'water' && !W.onPier(PL.x, PL.y, 0);
  if (inWater) {
    PL.state = 'gone'; PL.respawnT = RESPAWN_S;
    let done = false;                                     // wash up: scan west, then along the shore
    for (let dy = 0; dy <= 400 && !done; dy += 40)
      for (const yy of dy === 0 ? [PL.y] : [PL.y + dy, PL.y - dy])
        for (let dx = 20; dx <= 760; dx += 20)
          if (sim.canStand(PL.x - dx, yy)) { p.x = PL.x - dx; p.y = yy; done = true; break; }
    if (!done) { p.x = PL.home.x - 190; p.y = PL.home.y; }
    sim.say('PLANE LOST', 2);
    return;
  }
  PL.state = 'wreck'; PL.onLand = true; PL.respawnT = RESPAWN_S;
  if (W.hitSolid(PL.x, PL.y, 0)) {                        // came down inside a footprint: the wreck slides clear
    outer: for (let r = 30; r <= 190; r += 20)
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, x = PL.x + Math.cos(a) * r, y = PL.y + Math.sin(a) * r;
        if (!W.hitSolid(x, y, 0) && W.surfaceAt(x, y) !== 'water') { PL.x = x; PL.y = y; break outer; }
      }
  }
  let placed = false;
  for (let r = 44; r <= 240 && !placed; r += 22)
    for (let k = 0; k < 10 && !placed; k++) {
      const a = k * Math.PI / 5, x = PL.x + Math.cos(a) * r, y = PL.y + Math.sin(a) * r;
      if (sim.canStand(x, y)) { p.x = x; p.y = y; placed = true; }
    }
  if (!placed) { const [rx, ry] = W.L.spawn.respawn; p.x = rx; p.y = ry; }
}

// ------------------------------------------------------------------ input reading
// Throttle is a state: A held (inp.turbo) or ↑ spools up, the big button held (inp.btn) or ↓ winds down.
function stepThrottle(sim, PL, dt, inp) {
  const k = inp.keys || {};
  if (inp.turbo || k.up) PL.throttle = Math.min(1, PL.throttle + 0.5 * dt);
  if (inp.btn || k.down) PL.throttle = Math.max(0, PL.throttle - 0.7 * dt);
}

// Pitch input -1..1 (+ = climb): the stick's Y, the ↑/↓ keys, an armed landing, and a gentle
// power bias so a keyboard-only pilot still gets a climb at full throttle and a sink at idle.
function pitchInput(sim, PL, inp) {
  let ci = 0;
  if (inp.jm > 0.12) ci = -inp.jy;
  const k = inp.keys || {};
  if (k.up) ci += 0.7;
  if (k.down) ci -= 0.85;
  if (PL.landArm) ci = Math.min(ci, -0.6);
  ci += (PL.throttle - 0.55) * 0.3;
  return clamp(ci, -1, 1);
}

// ------------------------------------------------------------------ the step (sim calls this while player.mode === 'flight')
export function stepPlane(sim, dt, inp) {
  const PL = sim.plane, P = sim.player, p = P.ped, W = sim.W;
  if (!PL || !PL.ridden) return;
  if (PL.state === 'falling') {
    PL.fallT -= dt; PL.alt = Math.max(0, PL.fallT / 0.5 * 40);
    PL.x += PL.vx * dt; PL.y += PL.vy * dt;
    if (PL.fallT <= 0) { resolveCrash(sim); return; }   // resolveCrash places the player — do not sync over it
    p.x = PL.x; p.y = PL.y; return;
  }
  stepThrottle(sim, PL, dt, inp);
  if (inp.action) {
    if (PL.state === 'air') { PL.landArm = true; sim.say('LAND ON WATER', 1.3); }
    else if (exitPlane(sim)) return;
    else if (sim.time - PL.hintT > 3) { PL.hintT = sim.time; sim.say('HOP OFF AT THE PIER END', 1.4); }
  }
  const k = inp.keys || {};
  const steer = inp.jm > 0.12 ? inp.jx : (k.right ? 1 : 0) - (k.left ? 1 : 0);

  if (PL.state === 'water') {
    // throttle demand: the quadrant, or the stick pushed forward the way the boats read it
    let effT = PL.throttle;
    if (inp.jm > 0.12) {
      const diff = wrap(Math.atan2(inp.jy, inp.jx) - PL.h);
      if (Math.cos(diff) > 0.25) effT = Math.max(effT, inp.jm * Math.cos(diff));
    }
    // steering: toward the stick's direction (boats), else by the steer axis
    if (inp.jm > 0.12) {
      const want = Math.atan2(inp.jy, inp.jx), d = wrap(want - PL.h), m = (0.9 + planeSpeed(PL) * 0.004) * dt;
      PL.h = wrap(PL.h + clamp(d, -m, m));
    } else if (steer) PL.h = wrap(PL.h + steer * 1.15 * (0.35 + 0.65 * Math.min(1, planeSpeed(PL) / 80)) * dt);
    // thrust + drag (terminal = TOP_WATER at full throttle), velocity carves toward the bow
    const ca = Math.cos(PL.h), sa = Math.sin(PL.h);
    PL.vx += ca * ACC * effT * dt; PL.vy += sa * ACC * effT * dt;
    let spd = planeSpeed(PL);
    if (spd > 1) {
      const va = Math.atan2(PL.vy, PL.vx), nv = va + wrap(PL.h - va) * Math.min(1, 2.6 * dt);
      PL.vx = Math.cos(nv) * spd; PL.vy = Math.sin(nv) * spd;
    }
    const f = Math.exp(-(ACC / TOP_WATER) * dt * (effT > 0.02 ? 1 : 2.2));
    PL.vx *= f; PL.vy *= f;
    const nx = PL.x + PL.vx * dt, ny = PL.y + PL.vy * dt;
    if (!hardBlocked(sim, PL, nx, ny)) { PL.x = nx; PL.y = ny; }
    else if (!hardBlocked(sim, PL, nx, PL.y)) { PL.x = nx; PL.vy *= 0.35; }
    else if (!hardBlocked(sim, PL, PL.x, ny)) { PL.y = ny; PL.vx *= 0.35; }
    else { PL.vx *= -0.15; PL.vy *= -0.15; if (spd > 130) { sim.ev('bump'); burstSpray(sim, PL, 10); } }
    circleResolve(sim, PL);
    PL.v = planeSpeed(PL);
    emitSpray(sim, PL, dt);
    // liftoff: enough speed and a pull — or so much speed it comes off the water regardless
    if (PL.v >= TAKEOFF_V && (pitchInput(sim, PL, inp) > 0.12 || PL.v >= ROTATE_V)) {
      PL.state = 'air'; PL.altV = 20;
      PL.throttle = Math.max(PL.throttle, effT);        // bake the stick's demand into the quadrant
      burstSpray(sim, PL, 12);
      sim.ev('land');
    }
  } else if (PL.state === 'air') {
    if (pitchInput(sim, PL, inp) > 0.25) PL.landArm = false;   // pulling up cancels the landing
    // banked turns: the bank eases toward the steer, the nose follows the bank, faster = wider
    const bankT = steer * 1.02;
    PL.bank += clamp(bankT - PL.bank, -2.4 * dt, 2.4 * dt);
    PL.h = wrap(PL.h + PL.bank * 1.5 * clamp(PL.v / 320, 0.3, 1) * dt);
    // speed: chases the throttle's target, bleeding in a climb and gaining in a dive
    const ci = pitchInput(sim, PL, inp);
    const target = 118 + PL.throttle * (TOP_AIR - 118);
    PL.v += (target - PL.v) * Math.min(1, 0.5 * dt) - ci * 55 * dt;
    PL.v = clamp(PL.v, 55, 580);
    PL.vx = Math.cos(PL.h) * PL.v; PL.vy = Math.sin(PL.h) * PL.v;
    PL.x += PL.vx * dt; PL.y += PL.vy * dt;
    // altitude: pitch, minus the stall sink and an idle-power sag
    let climb = ci * 64;
    if (PL.v < STALL_V) climb -= (STALL_V - PL.v) * 0.6;
    if (PL.throttle < 0.2) climb -= 7;
    PL.altV += clamp(climb - PL.altV, -180 * dt, 180 * dt);
    PL.alt += PL.altV * dt;
    if (PL.alt >= CEIL_ALT) { PL.alt = CEIL_ALT; PL.altV = Math.min(PL.altV, 0); }
    // the world edge is a soft stop (the full flyable extent: shell west, the open sea east/south)
    const x0 = (W.bounds ? W.bounds.x0 : 0) + 40, x1 = (W.seaE || W.L.world.w) - 40, y1 = (W.seaS || W.L.world.h) - 40;
    PL.x = clamp(PL.x, x0, x1); PL.y = clamp(PL.y, 40, y1);
    if (PL.alt <= 0) {                                   // touchdown — water or trouble
      PL.alt = 0; PL.altV = 0;
      if (W.surfaceAt(PL.x, PL.y) === 'water' && !W.onPier(PL.x, PL.y, 0)) {
        PL.state = 'water'; PL.landArm = false; PL.bank = 0;
        burstSpray(sim, PL, 16); sim.ev('land');
      } else startCrash(sim);
    } else if (PL.alt < ROOF_ALT && W.hitSolid(PL.x, PL.y, 4)) startCrash(sim);   // low over a roof = into it
    else if (PL.alt < 26 && W.onPier(PL.x, PL.y, 0)) startCrash(sim);             // the pier deck is ground level
    PL.v = planeSpeed(PL);
  }
  p.x = PL.x; p.y = PL.y; p.h = PL.h;
}

// ------------------------------------------------------------------ always-on housekeeping
export function stepPlaneState(sim, dt) {
  const PL = sim.plane, P = sim.player; if (!PL) return;
  // prop: spins up with the throttle while you're in it, winds down otherwise
  const propGoal = PL.ridden ? 0.16 + 0.84 * PL.throttle : 0;
  PL.prop += clamp(propGoal - PL.prop, -dt / 1.6, dt / 0.7);
  if (PL.prop > 0.02) PL.propA += dt * (6 + 46 * PL.prop);
  if (!PL.ridden && PL.state === 'water') { PL.vx *= Math.exp(-2 * dt); PL.vy *= Math.exp(-2 * dt); PL.v = planeSpeed(PL); }
  // camera zoom (main.js consumes it like the heli's): out with altitude, a touch with water speed
  let zoomGoal = 0;
  if (PL.ridden && PL.state === 'air') zoomGoal = clamp(0.35 + PL.alt / CEIL_ALT * 0.75, 0, 1);
  else if (PL.ridden && PL.state === 'water') zoomGoal = 0.22 * clamp(PL.v / TOP_WATER, 0, 1);
  PL.zoom += clamp(zoomGoal - PL.zoom, -dt / 1.4, dt / 1.6);
  if (PL.state === 'wreck') {                            // a wreck smoulders (the heli's habit)
    PL.smokeT -= dt;
    if (PL.smokeT <= 0) { PL.smokeT = 0.45; puff(sim, PL.x + (sim.fxr() - 0.5) * 18, PL.y + (sim.fxr() - 0.5) * 18, true, 0.8); }
  }
  if ((PL.state === 'wreck' || PL.state === 'gone') && PL.respawnT > 0) {
    // INSTANT-START (owner rule, Nov 16): waiting at the dock cuts the replacement to 3 s
    const p0 = P.ped;
    if (P.mode === 'foot' && (sim.W.onPier(p0.x, p0.y, 0) || Math.hypot(p0.x - PL.home.x, p0.y - PL.home.y) < 190)) PL.respawnT = Math.min(PL.respawnT, 3);
    PL.respawnT -= dt;
    if (PL.respawnT <= 0) {
      PL.x = PL.home.x; PL.y = PL.home.y; PL.h = PL.home.h; PL.vx = 0; PL.vy = 0; PL.v = 0;
      PL.alt = 0; PL.throttle = 0; PL.onLand = false; PL.state = 'docked';
    }
  }
  // stranding guardian (the watercraft's): left far from the dock with the player far away, it drifts home
  if (PL.state === 'water' && !PL.ridden) {
    if (Math.hypot(PL.x - PL.home.x, PL.y - PL.home.y) > 300) {
      PL.farT += dt;
      if (PL.farT > 25) {
        const f = sim.focus();
        if (Math.hypot(f.x - PL.x, f.y - PL.y) > 600) { PL.x = PL.home.x; PL.y = PL.home.y; PL.h = PL.home.h; PL.vx = 0; PL.vy = 0; PL.state = 'docked'; PL.farT = 0; }
      }
    } else PL.farT = 0;
  }
}

// ------------------------------------------------------------------ drawing (render.js calls these)
// The silhouette the shadow pass stamps: offset down-sun and shrinking as the altitude grows,
// so the height reads on a phone screen long before the plane itself looks any different.
export function drawPlaneShadow(sg, PL) {
  if (!PL || PL.state === 'gone' || PL.alt <= 1.5) return;
  const a = PL.alt;
  sg.save();
  sg.globalAlpha = clamp(0.52 - a * 0.0013, 0.16, 0.52);
  sg.translate(PL.x + SUN_DX * a * 0.55, PL.y + SUN_DY * a * 0.55);
  sg.rotate(PL.h);
  const s = 1 - a * 0.0008;
  sg.scale(s, s);
  sg.fillStyle = '#000';
  planePath(sg);
  sg.fill();
  sg.restore();
}

// On the water (or just off it): drawn in the watercraft pass, before the peds.
export function drawPlaneLow(g, S, time, vx0, vy0, vx1, vy1) {
  const PL = S.plane;
  if (!PL || PL.state === 'gone' || PL.onLand || PL.alt >= 28) return;
  if (PL.x < vx0 - 140 || PL.x > vx1 + 140 || PL.y < vy0 - 140 || PL.y > vy1 + 140) return;
  drawPlaneBody(g, PL, time, true);
}

// Airborne (or a wreck on land): drawn above the roofs, with the helicopter.
export function drawPlaneHigh(g, S, time, vx0, vy0, vx1, vy1) {
  const PL = S.plane;
  if (!PL || PL.state === 'gone') return;
  if (!PL.onLand && PL.alt < 28) return;
  if (PL.x < vx0 - 140 || PL.x > vx1 + 140 || PL.y < vy0 - 140 || PL.y > vy1 + 140) return;
  drawPlaneBody(g, PL, time, false);
}

// The plane's outline in local space (bow +x): fuselage, wing, tail — shared by body and shadow.
function planePath(g) {
  g.beginPath();
  g.moveTo(46, 0);                                        // nose
  g.quadraticCurveTo(40, -9, 18, -10);
  g.lineTo(14, -58); g.lineTo(2, -58);                    // wing, far side
  g.lineTo(-2, -11);
  g.lineTo(-30, -9); g.lineTo(-38, -23); g.lineTo(-46, -23); g.lineTo(-44, -8);   // tailplane
  g.lineTo(-46, 0); g.lineTo(-44, 8);
  g.lineTo(-46, 23); g.lineTo(-38, 23); g.lineTo(-30, 9);
  g.lineTo(-2, 11);
  g.lineTo(2, 58); g.lineTo(14, 58);                      // wing, near side
  g.lineTo(18, 10);
  g.quadraticCurveTo(40, 9, 46, 0);
  g.closePath();
}

function drawPlaneBody(g, PL, time, onWater) {
  const spd = planeSpeed(PL);
  const bob = PL.alt < 1 ? Math.sin(time * 1.25 + PL.phase) * 1.1 : 0;
  if (onWater) {
    // cast shadow: long down-sun in the water, like the craft (watercraft.js) — plus the contact patch
    const L = PLANE_LEN, reach = L * 0.62 + 20;
    const srx = L * 0.5 + reach * 0.55, sry = 34;
    g.save();
    g.translate(PL.x + SUN_DX * reach * 0.55, PL.y + 2 + SUN_DY * reach * 0.55 + bob * 0.3);
    g.rotate(Math.atan2(SUN_DY, SUN_DX));
    g.scale(1, sry / srx);
    const cg = g.createRadialGradient(0, 0, srx * 0.35, 0, 0, srx);
    cg.addColorStop(0, 'rgba(8,46,66,0.50)'); cg.addColorStop(0.5, 'rgba(8,46,66,0.36)');
    cg.addColorStop(0.8, 'rgba(8,46,66,0.15)'); cg.addColorStop(1, 'rgba(8,46,66,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, srx, 0, TAU); g.fill();
    g.restore();
    const rx = L * 0.62 * (1 + Math.min(0.25, (spd / TOP_WATER) * 0.25)), ry = 30;
    g.save();
    g.translate(PL.x + 5, PL.y + 3 + bob * 0.4); g.rotate(PL.h); g.scale(1, ry / rx);
    const wg = g.createRadialGradient(0, 0, rx * 0.45, 0, 0, rx);
    wg.addColorStop(0, 'rgba(10,54,72,0.34)'); wg.addColorStop(0.72, 'rgba(10,54,72,0.20)'); wg.addColorStop(1, 'rgba(10,54,72,0)');
    g.fillStyle = wg; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
    g.restore();
  }
  const lift = 1 + PL.alt * 0.0008;                       // higher = nearer the camera = a touch larger
  g.save();
  g.translate(PL.x, PL.y + bob);
  g.rotate(PL.h + (PL.state === 'wreck' ? 0.14 : PL.bank * 0.10));
  g.scale(lift, lift);
  const ink = 'rgba(46,28,60,0.55)';
  // floats: twin pontoons outboard, on struts — they read first in top-down
  g.strokeStyle = 'rgba(51,36,74,0.7)'; g.lineWidth = 2.4;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(18, s * 9); g.lineTo(24, s * 17); g.moveTo(-16, s * 9); g.lineTo(-20, s * 17); g.stroke();
    g.beginPath(); g.roundRect(-30, s * 17 - 4, 64, 8, 4); g.fillStyle = '#d7dee2'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = '#2a62c9'; g.fillRect(14, s * 17 - 4, 10, 8);        // blue float noses
  }
  // wing: white, blue tips, one brush-light pass
  g.beginPath(); g.roundRect(-8, -58, 24, 116, 5); g.fillStyle = '#f6f1e6'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#2a62c9';
  g.beginPath(); g.roundRect(-8, -58, 24, 13, 5); g.fill();
  g.beginPath(); g.roundRect(-8, 45, 24, 13, 5); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(-8, -58, 24, 34);
  g.strokeStyle = 'rgba(51,36,74,0.35)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(12, -44); g.lineTo(12, -14); g.moveTo(12, 14); g.lineTo(12, 44); g.stroke();   // aileron seams
  // tailplane + the blue fin (a slim wedge on the centreline in top-down)
  g.beginPath(); g.roundRect(-46, -23, 12, 46, 4); g.fillStyle = '#f6f1e6'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
  g.beginPath(); g.moveTo(-30, 0); g.lineTo(-47, -3.4); g.lineTo(-47, 3.4); g.closePath(); g.fillStyle = '#2a62c9'; g.fill();
  // fuselage: white with the blue cheatline, brush light from above, shade below (the boats' recipe)
  planePath(g); g.fillStyle = '#f8f4ea'; g.fill();
  g.save(); planePath(g); g.clip();
  g.fillStyle = '#2a62c9'; g.fillRect(-46, -10, 92, 4.4); g.fillRect(-46, 5.6, 92, 4.4);
  g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(-46, -10, 92, 6);
  g.fillStyle = 'rgba(70,50,30,0.10)'; g.fillRect(-46, 4, 92, 6);
  g.restore();
  // the blue nose cowling + dark intake (the reference photo's face)
  g.beginPath(); g.moveTo(46, 0); g.quadraticCurveTo(40, -9, 22, -9.6); g.lineTo(22, 9.6); g.quadraticCurveTo(40, 9, 46, 0); g.closePath();
  g.fillStyle = '#2a62c9'; g.fill();
  g.beginPath(); g.arc(41, 0, 4.6, 0, TAU); g.fillStyle = '#33244a'; g.fill();
  // cockpit glass
  g.beginPath(); g.roundRect(4, -6.8, 17, 13.6, 5); g.fillStyle = 'rgba(150,220,235,0.80)'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(9, -2.6, 3.4, 1.8, -0.5, 0, TAU); g.fill();
  planePath(g); g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke();   // the plum ink line
  // the prop: a blur disc while it turns, black blades with yellow tips underneath (the reference)
  if (PL.prop > 0.03) {
    const reach = 23, half = reach * Math.max(0.22, Math.abs(Math.cos(PL.propA)));
    g.save(); g.translate(47.5, 0);
    g.fillStyle = 'rgba(38,34,46,0.9)';
    g.beginPath(); g.roundRect(-2.2, -half, 4.4, half * 2, 2); g.fill();
    g.fillStyle = '#ffd23f';
    g.fillRect(-2.2, -half, 4.4, 4.6); g.fillRect(-2.2, half - 4.6, 4.4, 4.6);
    if (PL.prop > 0.3) { g.beginPath(); g.ellipse(0, 0, 3.2, reach, 0, 0, TAU); g.fillStyle = `rgba(40,36,50,${0.10 + PL.prop * 0.13})`; g.fill(); }
    g.restore();
    g.beginPath(); g.arc(47.5, 0, 3, 0, TAU); g.fillStyle = '#26222e'; g.fill();
  } else {
    g.save(); g.translate(47.5, 0); g.rotate(0.5);
    g.fillStyle = 'rgba(38,34,46,0.95)'; g.beginPath(); g.roundRect(-2.2, -22, 4.4, 44, 2); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(-2.2, -22, 4.4, 4.6); g.fillRect(-2.2, 17.4, 4.4, 4.6);
    g.restore();
    g.beginPath(); g.arc(47.5, 0, 3, 0, TAU); g.fillStyle = '#26222e'; g.fill();
  }
  if (PL.state === 'wreck') { g.fillStyle = 'rgba(20,14,26,0.28)'; planePath(g); g.fill(); }   // a wreck reads burnt
  g.restore();
}

// destruct.js — the destruction system. Everything you can hit breaks in stages, never in one go:
//   0 intact -> 1 scuffed/dented -> 2 cracked/bent -> 3 destroyed
// One damage number per object (0..1) drives the stage; the stage thresholds per kind follow the
// look spec (shots/DESTRUCTION-DELTA.md) and its sprites (assets/destruct/). Punches, car impacts
// (scaled by speed) and falling trees all feed it. Broken things stay broken for the session.
//
// Debris and smoke come from fixed pools allocated once (no per-hit allocation): a new piece takes
// the oldest slot, so the count is capped and the oldest settled debris is what gets recycled.
// Player-caused destruction scores points and, in view of a cop or a witness, feeds wanted.
// Cosmetic randomness uses sim.fxr only, so effects never disturb the seeded run.

const TAU = Math.PI * 2;
// [stage 1, stage 2, stage 3] damage thresholds per kind
export const STAGES = {
  car: [0.25, 0.6, 1], palm: [0.3, 0.65, 1], bush: [0.35, 0.7, 1],
  bench: [0.25, 0.65, 1], lamp: [0.3, 0.65, 1], lifeguard: [0.3, 0.65, 1], rail: [0.25, 0.65, 1],
};
export const stageOf = (d, kind = 'car') => { const T = STAGES[kind]; return d >= T[2] ? 3 : d >= T[1] ? 2 : d >= T[0] ? 1 : 0; };

export const DEBRIS_CAP = 180;
export const SMOKE_CAP = 56;
// debris kinds (index into the renderer's palette)
export const D = { GLASS: 0, METAL: 1, WOOD: 2, CHIP: 3, LEAF: 4, BARK: 5, DIRT: 6, STONE: 7, TIRE: 8, FROND: 9, PETAL: 10 };

export function initDestruct(sim) {
  sim.debris = new Array(DEBRIS_CAP);
  for (let i = 0; i < DEBRIS_CAP; i++) sim.debris[i] = { on: false, kind: 0, v: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, s: 1, c: 0, rest: false };
  sim.debrisN = 0;
  sim.smoke = new Array(SMOKE_CAP);
  for (let i = 0; i < SMOKE_CAP; i++) sim.smoke[i] = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, s: 1, dark: 0 };
  sim.smokeN = 0;
  sim.things = [];          // non-car destructibles: { kind, x, y, r, dmg, stage, ... } (palms, bushes, props)
  sim.heat = 0;             // witness reports since the last witness star
  sim.lastWreckStar = -9; sim.lastWitnessStar = -9;
  sim.wrecks = 0;
  initPalms(sim);
  initBushes(sim);
}

export function spawnDebris(sim, kind, x, y, vx, vy, s, c = 0) {
  const d = sim.debris[sim.debrisN];
  sim.debrisN = (sim.debrisN + 1) % DEBRIS_CAP;
  d.on = true; d.kind = kind; d.v = (sim.fxr() * 3) | 0; d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.s = s; d.c = c; d.rest = false;
  d.rot = sim.fxr() * TAU; d.vr = (sim.fxr() - 0.5) * 18;
}

// A spray of n pieces from (x, y), thrown along (ax, ay) with some spread.
export function burst(sim, kind, n, x, y, ax, ay, speed, s, c = 0) {
  const r = sim.fxr, l = Math.hypot(ax, ay) || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ay / l, ax / l) + (r() - 0.5) * 2.2, v = speed * (0.35 + r() * 0.9);
    spawnDebris(sim, kind, x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, Math.cos(a) * v, Math.sin(a) * v, s * (0.6 + r() * 0.8), c);
  }
}

export function puff(sim, x, y, dark, s = 1) {
  const p = sim.smoke[sim.smokeN];
  sim.smokeN = (sim.smokeN + 1) % SMOKE_CAP;
  const r = sim.fxr;
  p.on = true; p.x = x + (r() - 0.5) * 6; p.y = y + (r() - 0.5) * 6; p.t = 0; p.life = 1.4 + r() * 1.2;
  p.vx = 9 + r() * 8; p.vy = -10 - r() * 10;          // the sea breeze carries it inland-ish and up-screen
  p.s = s * (0.8 + r() * 0.5); p.dark = dark;
}

// Line of sight between two points: no building in between.
export function clearLine(W, ax, ay, bx, by) {
  for (let i = 1; i < 8; i++) if (W.hitSolid(ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, 0)) return false;
  return true;
}

// Player-caused destruction: points, and in a cop's or a witness's view, wanted.
// severity: 0 (a scuff: points only), 1 (cracked/bent), 2 (destroyed).
export function report(sim, x, y, pts, severity, cause, label) {
  if (cause !== 'player' || sim.busted) return;
  sim.score = (sim.score || 0) + pts;
  sim.lastTrick = { name: label, pts, t: 1.2, mult: 1 };
  if (severity <= 0) return;
  if (sim.copSees(x, y)) {
    if (sim.time - sim.lastWreckStar > 2.5) { sim.lastWreckStar = sim.time; sim.addStars(1, 'destruction'); sim.say('A COP SAW THAT', 1.6); }
    return;
  }
  // witnesses: anyone walking nearby with a clear view runs or stops and stares, and reports it
  let seen = false;
  for (const o of sim.peds) {
    if (o.hidden || o.outfit === 'player' || o.mode === 'cop' || o.mode === 'down') continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy > 170 * 170 || !clearLine(sim.W, o.x, o.y, x, y)) continue;
    seen = true;
    if (o.mode === 'walk' || o.mode === 'return') {
      if (sim.fxr() < 0.55) { o.mode = 'flee'; o.fleeT = 2.5; o.from = { x, y }; } else o.gawkT = 1.2 + sim.fxr();
    }
  }
  if (!seen) return;
  sim.heat += severity;
  if (sim.heat >= 3 && sim.time - sim.lastWitnessStar > 4) {
    sim.heat = 0; sim.lastWitnessStar = sim.time;
    sim.addStars(1, 'witness'); sim.say('A WITNESS CALLED IT IN', 1.8);
  }
}

// ------------------------------------------------------------------ cars
// Damage lives on the car: c.dmg (0..1, the stage), four panel dents (front, rear, left, right),
// front/rear glass. A wreck (dmg 1) is crumpled, smoking and dead: its driver bails out.
const CAR_PTS = [0, 25, 150, 600];
export function carState(c) {
  if (!c.dent) { c.dmg = 0; c.dent = [0, 0, 0, 0]; c.glass = [0, 0]; c.wreck = false; c.hitT = -9; c.dentSeed = (c.id * 2654435761) >>> 0; }
  return c;
}

// Which panel faces a blow arriving along (dx, dy) (from the hitter toward the car).
function panelFor(c, dx, dy) {
  const ca = Math.cos(c.h), sa = Math.sin(c.h);
  const u = -(dx * ca + dy * sa), v = -(-dx * sa + dy * ca);    // where the blow lands, in the car's frame
  if (Math.abs(u) * 0.6 > Math.abs(v)) return u > 0 ? 0 : 1;
  return v < 0 ? 2 : 3;
}

export function hitCar(sim, c, amt, dx, dy, cause) {
  carState(c);
  if (amt <= 0.004) return;
  const before = stageOf(c.dmg, 'car');
  const panel = panelFor(c, dx, dy);
  c.dent[panel] = Math.min(1, c.dent[panel] + amt * 1.7);
  if (panel < 2 && amt > 0.06) {
    const g0 = c.glass[panel];
    c.glass[panel] = Math.min(1, g0 + amt * 1.5);
    if ((g0 < 0.3) !== (c.glass[panel] < 0.3) || c.glass[panel] >= 1 && g0 < 1) {
      const ca = Math.cos(c.h), sa = Math.sin(c.h), k = panel === 0 ? 0.25 : -0.3;
      burst(sim, D.GLASS, 5 + ((c.glass[panel] * 6) | 0), c.x + ca * c.len * k, c.y + sa * c.len * k, dx, dy, 60, 1);
      sim.ev('glass', c.glass[panel]);
    }
  }
  c.dmg = Math.min(1, c.dmg + amt);
  // metal flecks off the struck panel
  const ca = Math.cos(c.h), sa = Math.sin(c.h);
  const pu = panel === 0 ? c.len / 2 : panel === 1 ? -c.len / 2 : 0, pv = panel === 2 ? -c.wid / 2 : panel === 3 ? c.wid / 2 : 0;
  burst(sim, D.METAL, 1 + Math.min(6, (amt * 14) | 0), c.x + ca * pu - sa * pv, c.y + sa * pu + ca * pv, dx, dy, 40 + amt * 120, 1, c.kind === 'police' ? -1 : 0);
  c.hitT = sim.time;
  sim.ev('dent', amt);
  const after = stageOf(c.dmg, 'car');
  if (after > before) report(sim, c.x, c.y, CAR_PTS[after], after >= 3 ? 2 : after >= 2 ? 1 : 0, cause, after >= 3 ? 'WRECKED' : after >= 2 ? 'CRUMPLED' : 'DENT');
  if (c.dmg >= 1 && !c.wreck) wreckCar(sim, c);
}

function wreckCar(sim, c) {
  c.wreck = true; c.v = 0; c.siren = false;
  for (let i = 0; i < 6; i++) puff(sim, c.x, c.y, 1, 1.3);
  burst(sim, D.METAL, 5, c.x, c.y, 0, 0, 70, 1.2, c.kind === 'police' ? -1 : 0);
  burst(sim, D.TIRE, 2, c.x, c.y, 0, 0, 55, 1);                // a wheel comes off
  sim.ev('wreck');
  sim.wrecks++;
  if (c.driver === 'player') { sim.say('WRECKED — GET OUT', 1.8); return; }
  if (c.driver === 'ai' || c.driver === 'police') {
    // the driver crawls out and runs (a cop comes after you on foot if you're wanted)
    const cop = c.driver === 'police' || c.kind === 'police';
    const p = sim.makePed(c.x - Math.sin(c.h) * 18, c.y + Math.cos(c.h) * 18, cop ? 'cop' : 'ped_white', null);
    if (cop && sim.stars > 0) { p.mode = 'cop'; p.speed = 82; } else { p.mode = 'flee'; p.fleeT = 4; p.from = { x: c.x, y: c.y }; }
    sim.peds.push(p);
  }
  c.driver = null; c.parked = true; c.fixed = true; c.patrol = false;
}

// Impact damage by speed: a slow nudge only scuffs; it grows steeply with speed, so traffic bumps
// leave dents, a hard crash crumples, and two or three flat-out hits make a wreck.
// The car you're driving is the hero car: it takes HERO of what an impact would do to any other.
const HERO = 0.6;
export function impactDamage(sp) {
  if (sp < 30) return 0;
  const k = Math.max(0, (sp - 55) / 250);
  return 0.012 + 0.6 * k * Math.sqrt(k);
}

// A car runs into something solid (building, palm, prop) at speed sp: dent the leading panel.
export function carImpact(sim, c, sp, cause) {
  carState(c);
  if (sp < 30 || sim.time - c.hitT < 0.3) return;
  const dir = c.v >= 0 ? 1 : -1;
  // the blow arrives from what it ran into, i.e. against the direction of travel
  hitCar(sim, c, impactDamage(sp) * (c.driver === 'player' ? HERO : 1), -Math.cos(c.h) * dir, -Math.sin(c.h) * dir, cause);
}

// Two cars meet: each takes damage from the closing speed, the lighter one more.
export function carsCollide(sim, a, b, rel, nx, ny, ma, mb) {
  carState(a); carState(b);
  const amt = impactDamage(rel), cause = a.driver === 'player' || b.driver === 'player' ? 'player' : 'world';
  if (amt <= 0) return;
  // the crash energy is shared: the lighter car takes the bigger share
  const ka = a.driver === 'player' ? HERO : 1, kb = b.driver === 'player' ? HERO : 1;
  if (sim.time - a.hitT > 0.3) hitCar(sim, a, amt * 1.5 * ka * mb / (ma + mb), -nx, -ny, cause);
  if (sim.time - b.hitT > 0.3) hitCar(sim, b, amt * 1.5 * kb * ma / (ma + mb), nx, ny, cause);
}

// ------------------------------------------------------------------ the fist
// A punch that found no person: hits the nearest breakable thing roughly in front, if any.
// Returns true if something took the blow.
export function punchWorld(sim, p) {
  const fx = Math.cos(p.h), fy = Math.sin(p.h);
  let best = null, bd = 1e9, kind = null;
  // cars: distance from the fist to the car's box
  for (const c of sim.cars) {
    const lx = p.x - c.x, ly = p.y - c.y, ca = Math.cos(c.h), sa = Math.sin(c.h);
    const u = lx * ca + ly * sa, v = -lx * sa + ly * ca;
    const du = Math.max(0, Math.abs(u) - c.len / 2), dv = Math.max(0, Math.abs(v) - c.wid / 2), d = Math.hypot(du, dv);
    if (d > 16) continue;
    const tx = c.x - p.x, ty = c.y - p.y;
    if (d > 6 && (tx * fx + ty * fy) < 0) continue;      // has to be roughly in front
    if (d < bd) { bd = d; best = c; kind = 'car'; }
  }
  for (const t of sim.things) {
    if (t.stage >= 3 || t.noPunch) continue;
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) - t.r;
    if (d > 16) continue;
    if (d > 6 && (dx * fx + dy * fy) < 0) continue;
    if (d < bd) { bd = d; best = t; kind = 'thing'; }
  }
  if (!best) return false;
  const nx = best.x - p.x, ny = best.y - p.y, l = Math.hypot(nx, ny) || 1;
  p.h = Math.atan2(ny, nx);
  const reach = Math.min(14, Math.max(4, l - (kind === 'car' ? best.wid / 2 : best.r)));
  sim.fx.push({ kind: 'pow', x: p.x + nx / l * reach, y: p.y + ny / l * reach, t: 0 });
  sim.ev('punch');
  if (kind === 'car') hitCar(sim, best, 0.13, nx / l, ny / l, 'player');
  else hitThing(sim, best, best.punch || 0.2, nx / l, ny / l, 'player', 0);
  return true;
}

// ------------------------------------------------------------------ generic things
// Handlers per kind are registered by each object class (palms, bushes, props): `onHit(sim, t,
// before, after, dx, dy, cause, speed)` reacts to a hit (effects, stage changes).
const HANDLERS = {};
export function registerKind(kind, handler) { HANDLERS[kind] = handler; }

export function hitThing(sim, t, amt, dx, dy, cause, speed) {
  if (t.stage >= 3 || amt <= 0) return;
  const before = t.stage;
  t.dmg = Math.min(1, t.dmg + amt);
  t.stage = stageOf(t.dmg, t.kind);
  t.hitT = sim.time;
  const h = HANDLERS[t.kind];
  if (h) h(sim, t, before, t.stage, dx, dy, cause, speed || 0);
}

// ------------------------------------------------------------------ step
export function stepDestruct(sim, dt) {
  const W = sim.W, f = Math.exp(-4.5 * dt);
  for (let i = 0; i < DEBRIS_CAP; i++) {
    const d = sim.debris[i];
    if (!d.on || d.rest) continue;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (W.hitSolid(nx, ny, 0)) { d.vx *= -0.3; d.vy *= -0.3; } else { d.x = nx; d.y = ny; }
    d.vx *= f; d.vy *= f;
    d.rot += d.vr * dt; d.vr *= f;
    if (d.vx * d.vx + d.vy * d.vy < 4) { d.vx = d.vy = 0; d.rest = true; }      // settles, and stays
  }
  for (let i = 0; i < SMOKE_CAP; i++) {
    const p = sim.smoke[i];
    if (!p.on) continue;
    p.t += dt;
    if (p.t >= p.life) { p.on = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  // damaged cars smoke (look spec): a bent car puffs dark from the hood every 0.35 s, a wreck
  // trails pale grey wisps on the breeze
  for (const c of sim.cars) {
    if (!c.dent || c.dmg < STAGES.car[1]) continue;
    c.smokeT = (c.smokeT || 0) - dt;
    if (c.smokeT <= 0) {
      c.smokeT = c.wreck ? 0.2 : 0.35;
      const ca = Math.cos(c.h), sa = Math.sin(c.h), u = c.dent[0] >= c.dent[1] ? c.len * 0.3 : -c.len * 0.3;
      puff(sim, c.x + ca * u, c.y + sa * u, c.wreck ? 0 : 1, c.wreck ? 1.3 : 0.7);
    }
  }
  for (const t of sim.things) if (t.step) t.step(sim, t, dt);
  carsThroughBushes(sim);
}

// ------------------------------------------------------------------ palms
// A palm takes knocks (the existing shake + leaves), then cracks at the collar and leans away from
// the blows (stage 1), cracks deeper and leans further (stage 2), then SNAPS (stage 3): it falls away
// from the hit over FALL_T seconds, lands with weight and crushes what it lands on, and lies there for
// the session as a log behind a split stump. world.felled marks it so it no longer blocks.
export const FALL_T = 0.55;
const PALM_PTS = [0, 60, 150, 500];
export const palmReach = (t) => 77 * t.sc;            // stump to crown centre of the fallen sprite (SPRITES.md palm_s2)

function initPalms(sim) {
  const W = sim.W;
  W.felled = new Uint8Array(W.trunks.length);          // reset per run: the world object is shared
  sim.palms = [];
  for (const tr of W.trunks) {
    const t = { kind: 'palm', i: tr.i, tr, x: tr.x, y: tr.y, r: tr.r, sc: tr.sc, dmg: 0, stage: 0, hitT: -9, punch: 0.12, lx: 0, ly: 0, fall: null, step: stepPalm };
    sim.things.push(t); sim.palms.push(t);
  }
}

// Damage a car impact at speed sp does to a palm: a nudge only scuffs; flat out snaps it.
// (crack from ~160 u/s, snap from ~210: ordinary fast driving fells a palm)
export function palmImpact(sp) { return sp < 25 ? 0 : sp < 50 ? 0.03 : Math.min(1, impactDamage(sp) * 3.4); }

registerKind('palm', (sim, t, before, after, dx, dy, cause, speed) => {
  const l = Math.hypot(dx, dy) || 1, nx = dx / l, ny = dy / l;
  sim.shakeTree(t.tr, Math.min(1, 0.3 + t.dmg * 0.7), nx, ny);
  burst(sim, D.BARK, 2 + after, t.x - nx * t.r, t.y - ny * t.r, -nx, -ny, 45, 0.8);
  // the lean follows the blows
  t.lx += nx * 0.6; t.ly += ny * 0.6; const k = Math.hypot(t.lx, t.ly) || 1; t.lx /= k; t.ly /= k;
  if (after > before) {
    report(sim, t.x, t.y, PALM_PTS[after], after >= 3 ? 2 : after >= 2 ? 1 : 0, cause, after >= 3 ? 'TIMBER' : 'CRACKED PALM');
    sim.ev(after >= 3 ? 'snap' : 'crack', after);
  }
  if (after >= 3 && !t.fall) {
    t.fall = { t: 0, ax: nx, ay: ny, landed: false, cause };
    sim.W.felled[t.i] = 1;
  }
});

// Falling and fallen palms. Called from stepDestruct through t.step.
export function stepPalm(sim, t, dt) {
  const F = t.fall;
  if (!F) return;
  if (F.landed) { stepLog(sim, t, F); return; }
  F.t += dt;
  if (F.t < FALL_T) return;
  F.landed = true;
  // it lands: a thud, fronds everywhere, and anything under the trunk or crown is crushed
  const L = palmReach(t), cx = t.x + F.ax * L, cy = t.y + F.ay * L, crown = 24 * t.sc;
  burst(sim, D.FROND, 7, cx, cy, F.ax, F.ay, 70, 1);
  burst(sim, D.FROND, 3, cx, cy, -F.ax, -F.ay, 50, 0.9);
  sim.ev('timber');
  const under = (x, y, pad) => {                         // distance to the trunk segment, or inside the crown
    const u = Math.max(0, Math.min(L, (x - t.x) * F.ax + (y - t.y) * F.ay));
    const px = t.x + F.ax * u, py = t.y + F.ay * u;
    return Math.hypot(x - px, y - py) < 6 * t.sc + pad || Math.hypot(x - cx, y - cy) < crown + pad;
  };
  for (const c of sim.cars) if (under(c.x, c.y, c.wid / 2)) hitCar(sim, c, 0.55, F.ax, F.ay, F.cause);
  for (const p of sim.peds) if (!p.hidden && p.mode !== 'down' && under(p.x, p.y, 4)) { sim.knockDown(p, F.ax * 60, F.ay * 60, 3); sim.ev('hit'); }
  for (const o of sim.things) {
    if (o === t || o.stage >= 3 || !under(o.x, o.y, o.r)) continue;
    if (o.kind === 'palm') sim.shakeTree(o.tr, 1, F.ax, F.ay);
    else hitThing(sim, o, 0.8, F.ax, F.ay, F.cause, 200);
  }
}

// A fallen palm is a log on the ground: on foot you hop it (a beat of slowdown), a car bumps over it.
function stepLog(sim, t, F) {
  const L = palmReach(t) - 18 * t.sc;
  const near = (x, y, pad) => {
    const u = (x - t.x) * F.ax + (y - t.y) * F.ay;
    if (u < 0 || u > L) return false;
    return Math.abs((x - t.x) * -F.ay + (y - t.y) * F.ax) < 4 * t.sc + pad;
  };
  const P = sim.player;
  if (P.mode === 'foot' && near(P.ped.x, P.ped.y, 2) && !(P.ped.hopT > 0) && sim.time - (t.hopT || -9) > 0.6) {
    t.hopT = sim.time; P.ped.hopT = 0.26; P.slowT = Math.max(P.slowT || 0, 0.18); sim.ev('hop');
  }
  for (const c of sim.cars) {
    if (Math.abs(c.v) < 30 || !near(c.x, c.y, c.wid / 2) || sim.time - (c.logT || -9) < 0.6) continue;
    c.logT = sim.time; c.v *= 0.8; if (c.driver === 'player') sim.ev('bump');
  }
}

// ------------------------------------------------------------------ bushes
// Bushes are scenery you walk through, so they never block. Hit one (fist, car, falling tree) and it
// bursts leaves and petals and shears away from the hit (stage 1), is flattened into a splayed,
// bruised oval (stage 2), and is finally torn out, leaving a root pit (stage 3) — look spec §3.
const BUSH_PTS = [0, 20, 60, 150];

function initBushes(sim) {
  sim.bushes = [];
  for (const b of sim.W.bushes) {
    const t = { kind: 'bush', i: b.i, x: b.x, y: b.y, r: 8 * b.sc, sc: b.sc, v: b.v, dmg: 0, stage: 0, hitT: -9, punch: 0.36, ax: 1, ay: 0 };
    sim.things.push(t); sim.bushes.push(t);
  }
}

// What a car ploughing through at speed sp does to a bush: anything quick flattens it; flat out
// tears it out of the ground.
export function bushImpact(sp) { return sp < 25 ? 0 : Math.min(1, 0.2 + sp / 300); }

registerKind('bush', (sim, t, before, after, dx, dy, cause, speed) => {
  const l = Math.hypot(dx, dy) || 1;
  t.ax = dx / l; t.ay = dy / l;
  if (speed > 0) t.track = true;                       // run over by a car: tyre tracks through it
  // thrown clear of the canopy (from its far edge, outward), so they land where you can see them
  const ex = t.x + t.ax * t.r, ey = t.y + t.ay * t.r;
  burst(sim, D.LEAF, 3 + after * 2, ex, ey, t.ax, t.ay, 110, 0.9 * t.sc);
  burst(sim, D.PETAL, 2 + after * 2, ex, ey, t.ax, t.ay, 95, 1);
  burst(sim, D.LEAF, 2, t.x - t.ax * t.r, t.y - t.ay * t.r, -t.ax, -t.ay, 70, 0.8 * t.sc);
  if (after >= 3) burst(sim, D.DIRT, 5, ex, ey, t.ax, t.ay, 60, 1.2);
  sim.ev('rustle', 0.3 + 0.2 * after);
  if (after > before) report(sim, t.x, t.y, BUSH_PTS[after], after >= 3 ? 1 : 0, cause, after >= 3 ? 'TORN OUT' : after >= 2 ? 'FLATTENED' : 'BUSHWHACKED');
});

// Cars plough through bushes (they never stop a car): the bush takes damage scaled by speed,
// the car loses a little speed.
function carsThroughBushes(sim) {
  for (const c of sim.cars) {
    const sp = Math.abs(c.v);
    if (sp < 25) continue;
    const reach = c.len / 2;
    for (const t of sim.bushes) {
      if (t.stage >= 3) continue;
      const dx = t.x - c.x, dy = t.y - c.y;
      if (dx > reach + t.r || dx < -reach - t.r || dy > reach + t.r || dy < -reach - t.r) continue;
      const ca = Math.cos(c.h), sa = Math.sin(c.h), u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (Math.abs(u) > c.len / 2 + t.r * 0.5 || Math.abs(v) > c.wid / 2 + t.r * 0.5 || sim.time - t.hitT < 0.5) continue;
      hitThing(sim, t, bushImpact(sp), ca * Math.sign(c.v), sa * Math.sign(c.v), c.driver === 'player' ? 'player' : 'world', sp);
      c.v *= 0.95;
    }
  }
}

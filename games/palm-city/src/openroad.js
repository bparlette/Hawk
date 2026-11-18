// openroad.js — OPEN ROAD v2: the point-to-point coast race. v1 looped the old city; the owner
// corrected it (Nov 16): the race heads OUT — grid at the core's west edge by the MacArthur
// Causeway landfall, west across the bay on the causeway, sweeping turns through the shell
// downtown leg, finish at the port terminus — under a painted OutRun CHASE CAMERA (chasecam.js
// holds the camera maths; render.js composites it). The OutRun economy carries over: a starting
// bank, checkpoints that ADD time, near-miss and drift pay, a finish bonus plus per-second-left.
// Exactly two pursuit cars and the pressure chopper, stars pinned at 3. Out of time is a
// throttle-dead roll-stop, never a bust; getting pinned is a bust like anywhere else.
//
// THE COURSE (route distance 0..4496, east to west):
//   [330,1275] grid approach on the seam connector -> the connector -> the MacArthur Causeway
//   polyline (shell.json's trace, westbound) -> a downtown S-leg on the mainland paving ->
//   finish at Port Boulevard's west end [-3220,800]. 5 grant checkpoints + the finish line.
// The shell has no traffic system, so the event runs its own: route-following cars (driver
// 'route', stepped below) cruise the course near the player in both directions — they are the
// near-miss fodder. They never touch the core's loop traffic.
//
// SELF-SUFFICIENT START (owner rule, Nov 16): an activity's start marker must contain whatever
// it needs. A race car (the rose convertible) waits IN the start circle at all times —
// ensureGridCar() keeps it there. Walk in on foot and the A button reads START OPEN ROAD:
// one press seats you in that car and starts the countdown. Arrive in your own car and the
// ring works exactly like the other events.
import { puff } from './destruct.js';

const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export const OPENROAD = {
  bank: 12, grants: [7, 6, 6, 6, 5],          // seconds: the starting bank + per-checkpoint +TIME (42 total for the 4,511-unit course; the check's autopilot finishes ~19 s up, a human runs it close)
  cpPts: 400, nearPts: 150, driftPts: 100,    // score: checkpoint / near miss / held drift
  finishPts: 1000, perSec: 25,                // score: the line, plus 25 per second left
  cpR: 110,                                   // checkpoint capture radius
  gripMul: 1.45,                              // skid.js: the tyres bite — the chase cam's easier steering
};
const SITE = [372, 1275];                     // == EVENTS.openroad.site (events.js): the start circle
const GRID_S = 150;                           // route distance of the start line (on the connector)
const CP_FRAC = [0.16, 0.34, 0.52, 0.70, 0.86];
const GRID_MODEL = 'conv_rose';               // the waiting race car: a rose convertible
const TRAFFIC_MODELS = ['sedan_coral', 'sedan_teal', 'sedan_cream', 'sedan_plum', 'conv_mint', 'conv_rose', 'van_sky', 'van_sun'];
const CHEER_R = 250;

// the course polyline: seam connector, then the MacArthur Causeway westbound (shell.json's
// points reversed), then the downtown S-leg to the port.
const WAYPOINTS = [
  [330, 1275], [100, 1275], [-245, 1275],
  [-320, 1305], [-450, 1380], [-600, 1445], [-760, 1435], [-900, 1378], [-1100, 1287],
  [-1300, 1195], [-1500, 1095], [-1700, 998], [-1900, 902], [-2100, 807], [-2150, 783],
  [-2180, 720], [-2280, 580], [-2400, 430], [-2560, 330], [-2730, 300], [-2900, 308], [-3140, 308],
  [-3260, 360], [-3330, 470], [-3340, 590], [-3330, 690], [-3280, 760], [-3220, 800],
];
// crowd clusters: the grid, the causeway's scenic bend, the downtown landfall, the line
const CLUSTERS = [
  { x: 372, y: 1275, n: 6, r: 85, tag: 'start' },
  { x: -2245, y: 655, n: 5, r: 60, tag: 'bend' },
  { x: -3075, y: 415, n: 5, r: 65, tag: 'downtown' },
  { x: -3220, y: 800, n: 8, r: 95, tag: 'finish' },
];
const OUTFITS = ['ped_sun', 'ped_rose', 'ped_white', 'ped_blue', 'ped_straw'];

// ------------------------------------------------------------------ the route
let ROUTE = null;
export function route() {
  if (ROUTE) return ROUTE;
  const pts = WAYPOINTS.map(([x, y]) => ({ x, y })), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return ROUTE = { pts, cum, len: cum[cum.length - 1] };
}

// point at route distance s, offset off to the right of travel (routeAt mirrors world.loopAt)
export function routeAt(R, s, off = 0) {
  s = clamp(s, 0, R.len);
  let i = 0;
  while (i < R.pts.length - 2 && R.cum[i + 1] < s) i++;
  const seg = R.cum[i + 1] - R.cum[i] || 1, u = (s - R.cum[i]) / seg;
  const a = R.pts[i], b = R.pts[i + 1];
  const tx = (b.x - a.x) / seg, ty = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * u - ty * off, y: a.y + (b.y - a.y) * u + tx * off, tx, ty };
}

// route distance of a world point: a local search around the hint (the course is an open
// polyline, so unlike the loop there is no wrap; a cold call scans the whole route coarsely)
export function routeSOf(R, x, y, hint) {
  const d2 = (s) => { const p = routeAt(R, s, 0); return (p.x - x) ** 2 + (p.y - y) ** 2; };
  let best = 1e18, bs = hint == null ? 0 : hint;
  if (hint == null) { for (let s = 0; s <= R.len; s += 20) { const d = d2(s); if (d < best) { best = d; bs = s; } } }
  else for (let ds = -170; ds <= 170; ds += 8) { const s = clamp(hint + ds, 0, R.len), d = d2(s); if (d < best) { best = d; bs = s; } }
  for (let ds = -8; ds <= 8; ds += 1) { const s = clamp(bs + ds, 0, R.len), d = d2(s); if (d < best) { best = d; bs = s; } }
  return bs;
}

// ------------------------------------------------------------------ the grid car (self-sufficient start)
export function gridCar(sim) {
  const c = sim.openroadCar;
  return c && !c.wreck && sim.cars.includes(c) ? c : null;
}

// Keep the race car waiting in the start circle whenever no run is live. The grid car is a
// SINGLETON (fixed: true, so the population filter never culls it — the job vehicles'
// trick): it is never released-and-respawned. If traffic shoved it out of the circle or it
// was left across town, it is brought home and repaired, the guardRingCars pattern — the
// old release-and-respawn bred permanent duplicates (audit H2). A fresh one spawns only
// when the singleton is wrecked or gone.
export function ensureGridCar(sim) {
  if (sim.event) return gridCar(sim);
  const old = sim.openroadCar;
  if (old && !old.wreck && sim.cars.includes(old)) {
    if (old.driver === 'player' || sim.player.car === old) return old;   // in the player's hands — it comes home when they leave it
    if (Math.hypot(old.x - SITE[0], old.y - SITE[1]) >= 30) {
      old.x = SITE[0]; old.y = SITE[1]; old.h = Math.PI;
      old.dmg = 0; old.dent = [0, 0, 0, 0]; old.glass = [0, 0];
    }
    if (!old.parked) { old.parked = true; old.driver = null; old.v = 0; }
    old.fixed = true; old.openroad = true;
    return old;
  }
  if (old) old.openroad = false;
  sim.openroadCar = null;
  const c = sim.addCar(SITE[0], SITE[1], Math.PI, GRID_MODEL, null, { parked: true, fixed: true, openroad: true });
  sim.openroadCar = c;
  return c;
}

// is START OPEN ROAD armed? On foot, inside the start circle, the grid car waiting.
export function openRoadArmed(sim) {
  const P = sim.player;
  return P.mode === 'foot' && !sim.event && !sim.job && !sim.busted && !sim.siege &&
    Math.hypot(P.ped.x - SITE[0], P.ped.y - SITE[1]) < 70 && !!ensureGridCar(sim);
}

// ------------------------------------------------------------------ crowds
function spawnCrowds(sim) {
  const out = [];
  for (const cl of CLUSTERS) {
    const peds = [];
    for (let i = 0; i < cl.n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const a = sim.fxr() * Math.PI * 2, rr = cl.r * (0.45 + sim.fxr() * 0.55);
        const x = cl.x + Math.cos(a) * rr, y = cl.y + Math.sin(a) * rr;
        const sf = sim.W.surfaceAt(x, y);
        if (sf === 'road' || sf === 'water' || !sim.canStand(x, y)) continue;   // verges and shores only — never in the racing line
        const p = sim.makePed(x, y, OUTFITS[(sim.fxr() * OUTFITS.length) | 0], { type: 'line', x, y, dir: 1 }, 0);
        p.keep = true; p.crowd = true; p.cheerT = 0;
        sim.peds.push(p); peds.push(p);
        break;
      }
    }
    out.push({ ...cl, peds, cheered: false });
  }
  return out;
}

function cheer(sim, cluster) {
  cluster.cheered = true;
  const f = sim.focus();
  for (const p of cluster.peds) { p.cheerT = 1.6 + sim.fxr() * 0.5; p.h = Math.atan2(f.y - p.y, f.x - p.x); }
  sim.ev('vox_evt_openroad_cheer');
}

// ------------------------------------------------------------------ the chase camera state
// Stepped here (and drained by events.js after the run) so the state lives on the sim: the
// director's re-sim reproduces the camera exactly. blend 0..1 (0 = the normal top-down view),
// rot = the world rotation that puts the car's heading at the top of the screen.
export function stepChaseCam(sim, dt) {
  const ch = sim.chase; if (!ch) return;
  const P = sim.player;
  const live = !!(sim.event && sim.event.kind === 'openroad' && !ch.out && P.mode === 'car');
  const target = live ? 1 : 0;
  ch.blend = clamp(ch.blend + clamp(target - ch.blend, -dt / 0.9, dt / 0.9), 0, 1);
  if (P.mode === 'car' && P.car) {
    const want = -Math.PI / 2 - P.car.h;
    ch.rot += wrapA(want - ch.rot) * (1 - Math.exp(-dt * 3.5));
  }
  if (ch.blend <= 0 && !live) sim.chase = null;
}

// ------------------------------------------------------------------ start / step
export function startOpenRoad(sim, ev) {
  const R = route(), P = sim.player;
  // the self-sufficient start: on foot, you are seated in the waiting grid car (no jack, no
  // star — it is your race car). In your own car, you simply race it.
  if (P.mode !== 'car') {
    const c = ensureGridCar(sim);
    if (c) {
      c.driver = 'player'; c.parked = false; c.fixed = false; c.v = 0; c.siren = false;
      P.mode = 'car'; P.car = c; P.ped.hidden = true; P.ped.x = c.x; P.ped.y = c.y;
      sim.ev('door');
    }
  }
  ev.car = P.car;
  const car = P.car;
  // the grid: you on the start line, the pursuit stacked behind you on the connector
  const g = routeAt(R, GRID_S, 0);
  car.x = g.x; car.y = g.y; car.h = Math.atan2(g.ty, g.tx); car.v = 0; car.dmg = 0; car.wreck = false;
  P.ped.x = car.x; P.ped.y = car.y;
  ev.cops = [];
  for (const gs of [60, 15]) {                          // stacked on the grid behind you, held until GO
    const p = routeAt(R, gs, 0);
    const cop = sim.addCar(p.x, p.y, Math.atan2(p.ty, p.tx), 'police', 'police', { s: 0, dir: 1 });
    cop.v = 0; ev.cops.push(cop);
  }
  ev.cps = CP_FRAC.map((fr, i) => { const s = fr * R.len, p = routeAt(R, s, 0); return { s, x: p.x, y: p.y, grant: OPENROAD.grants[i] }; });
  const fin = routeAt(R, R.len, 0);
  ev.cps.push({ s: R.len, x: fin.x, y: fin.y, grant: 0, finish: true });
  Object.assign(ev, {
    timer: OPENROAD.bank,   // the bank lives here (startEvent seeded ev.timer from the registry's nominal time)
    idx: 0, routeS: GRID_S, prog: 0, near: 0, nm: new Map(), nmCd: new Map(), driftT: 0,
    gain: 0, gainT: 0, finishing: null, finishT: 0, routeSpawnT: 0,
    screechT: 0, smokeT: 0, smokeSide: 1, prevH: car.h, crowds: spawnCrowds(sim),
  });
  sim.gripMul = OPENROAD.gripMul;                       // the tyres bite for the whole run (skid.js)
  sim.chase = { blend: 0, rot: 0, routeS: GRID_S, out: false };
  if (sim.stars < 3) { sim.stars = 3; sim.lostT = 0; sim.ev('star', 3); }
  sim.say('OPEN ROAD — RACE THE CAUSEWAY', 2.4);
}

export function stepOpenRoad(sim, ev, dt, end, pay) {
  const R = route(), P = sim.player, c = P.car;
  if (ev.gainT > 0) ev.gainT -= dt;
  stepChaseCam(sim, dt);
  if (P.mode !== 'car' || !c) return end('ON FOOT', false, { left: Math.max(0, ev.timer), secs: Math.round(ev.t), near: ev.near });
  ev.routeS = routeSOf(R, c.x, c.y, ev.routeS);
  if (sim.chase) sim.chase.routeS = ev.routeS;
  const prevS = ev.idx === 0 ? 0 : ev.cps[ev.idx - 1].s, nextS = ev.idx < ev.cps.length ? ev.cps[ev.idx].s : R.len;
  ev.prog = clamp((ev.routeS - prevS) / Math.max(1, nextS - prevS), 0, 1);
  if (sim.stars < 3) sim.stars = 3;                     // pinned: the race runs at three stars
  // crowds cheer as you pass (the finish crowd waits for the line)
  for (const cl of ev.crowds) {
    if (cl.cheered || cl.tag === 'finish') continue;
    if (Math.hypot(cl.x - c.x, cl.y - c.y) < CHEER_R) cheer(sim, cl);
  }
  if (ev.finishing) {                                   // the beats after the line / after the clock
    ev.finishT += dt;
    if (ev.finishing === 'time') { P.stunT = Math.max(P.stunT || 0, dt * 2); c.v *= Math.pow(0.06, dt); }   // throttle-dead: a gentle roll-stop, never a bust
    if (ev.finishing === 'win' && ev.finishT >= 1.2) {
      pay(OPENROAD.finishPts + OPENROAD.perSec * Math.floor(Math.max(0, ev.timer)), 'FINISH');
      return end('FINISHED', true, { left: Math.max(0, ev.timer), secs: Math.round(ev.t), near: ev.near });
    }
    if (ev.finishing === 'time' && ev.finishT >= 1.4) return end('OUT OF TIME', false, { left: 0, secs: Math.round(ev.t), near: ev.near });
    return;
  }
  if (ev.count > 0) {                                   // the three-count: the clock waits, the camera blends in
    for (const cop of ev.cops) cop.v = 0;               // the grid holds: nobody launches before GO
    c.v = 0;                                            // ...and neither does the player: rolling through a checkpoint during the count would strand it (the CP check only ever tests the NEXT gate), so the whole grid waits for GO
    const before = Math.ceil(ev.count);
    ev.count -= dt;
    if (Math.ceil(ev.count) !== before) sim.ev(before === 1 ? 'go' : 'count');
    if (ev.count <= 0) { ev.count = 0; sim.say('GO!', 0.9); }
    ev.prevH = c.h;
    return;
  }
  ev.timer -= dt;
  if (!ev.warned && ev.timer < 10) { ev.warned = true; sim.say('10 SECONDS!', 1.6); }
  if (ev.timer <= 0) { ev.timer = 0; ev.finishing = 'time'; ev.finishT = 0; ev.prevH = c.h; return; }
  // checkpoints: gold, additive — crossing banks the grant and pays
  const cp = ev.cps[ev.idx];
  if (cp && Math.hypot(cp.x - c.x, cp.y - c.y) < OPENROAD.cpR && ev.routeS > cp.s - 80) {
    ev.idx++;
    if (cp.finish) {
      ev.finishing = 'win'; ev.finishT = 0;
      const fc = ev.crowds.find(k => k.tag === 'finish'); if (fc) cheer(sim, fc);
      sim.ev('checkpoint');
    } else {
      ev.timer += cp.grant; ev.gain = cp.grant; ev.gainT = 1.1;
      pay(OPENROAD.cpPts, 'CHECKPOINT');
      sim.ev('checkpoint');
    }
  }
  // near misses: slip past a car inside the band and leave it undamaged at speed
  for (const o of sim.cars) {
    if (o === c || o.wreck || o.driver === 'police') continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y), band = (o.len + c.len) / 4 + 22;
    const st = ev.nm.get(o.id);
    if (d < band) { if (!st) ev.nm.set(o.id, { dmg: o.dmg }); }
    else if (st) {
      ev.nm.delete(o.id);
      if (o.dmg <= st.dmg && Math.abs(c.v) > 150 && sim.time - (ev.nmCd.get(o.id) || -9) > 4) {
        ev.nmCd.set(o.id, sim.time); ev.near++;
        pay(OPENROAD.nearPts, 'NEAR MISS');
      }
    }
  }
  // held drifts pay (with the grippier tyres this takes real speed — see skid.js)
  if (c.skidOn && Math.abs(c.v) > 100) { ev.driftT += dt; if (ev.driftT >= 0.5) { ev.driftT = 0; pay(OPENROAD.driftPts, 'DRIFT'); } }
  else ev.driftT = Math.max(0, ev.driftT - dt);
  stepRouteTraffic(sim, ev, dt);
  stepScreech(sim, ev, dt, c);
  ev.prevH = c.h;
}

// ------------------------------------------------------------------ shell traffic (driver 'route')
// The smallest route-follower on the existing car system: aim at a point 55 ahead on the
// course, cruise, queue behind whatever is in front (sim.aheadClear). Cars are kept near the
// player — ahead in both directions, a couple behind — and the population filter reaps them
// past 1250 units like any other loose car. Core loop traffic is untouched.
export function stepRouteCar(sim, c, dt) {
  const R = route();
  c.rs = routeSOf(R, c.x, c.y, c.rs == null ? null : c.rs);
  const tgt = routeAt(R, c.rs + c.rdir * 55, c.lane);
  const diff = wrapA(Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.h);
  const clear = sim.aheadClear(c, 75);
  const want = clear ? c.cruise * (1 - Math.min(0.5, Math.abs(diff))) : 0;
  const throttle = c.v < want ? 0.8 : (c.v > want + 20 ? -1 : 0);
  sim.driveCar(c, throttle, clamp(diff * 3, -1, 1), dt, 200);
  if (Math.abs(c.v) < 5 && want > 0) { c.stuck += dt; if (c.stuck > 3) { c.v = -60; c.stuck = 0; } } else c.stuck = 0;
}

function stepRouteTraffic(sim, ev, dt) {
  ev.routeSpawnT -= dt;
  if (ev.routeSpawnT > 0) return;
  const mine = sim.cars.filter(k => k.driver === 'route');
  if (mine.length >= 5) return;
  ev.routeSpawnT = 0.7;
  const R = route();
  const slots = [
    { off: 520, rdir: 1, lane: 11 }, { off: 880, rdir: -1, lane: -11 }, { off: 1250, rdir: 1, lane: 11 },
    { off: -420, rdir: 1, lane: 11 }, { off: -800, rdir: 1, lane: 11 },
  ];
  for (const sl of slots) {
    const s = ev.routeS + sl.off;
    if (s < 60 || s > R.len - 60) continue;
    if (mine.some(k => Math.abs((k.rs == null ? -1e9 : k.rs) - s) < 140)) continue;
    const p = routeAt(R, s, sl.lane);
    const c = sim.addCar(p.x, p.y, Math.atan2(p.ty * sl.rdir, p.tx * sl.rdir), TRAFFIC_MODELS[(sim.rnd() * TRAFFIC_MODELS.length) | 0], 'route',
      { rs: s, rdir: sl.rdir, lane: sl.lane, cruise: 95 + sim.rnd() * 45 });
    c.v = c.cruise * 0.8;
    return;                                             // one per upkeep tick is plenty
  }
}

// ------------------------------------------------------------------ tire screech
// At hard steer in chase view: white smoke off the rear tyres (the shared smoke pool) and the
// 'screech' synth hook. Cornering load is read from the car's own yaw rate, so it fires exactly
// when the tyres are at the limit — and not at a gentle steer.
function stepScreech(sim, ev, dt, c) {
  const yaw = Math.abs(wrapA(c.h - ev.prevH)) / Math.max(dt, 1e-4);
  const lat = Math.abs(c.v) * yaw;
  const surf = sim.W.surfaceAt(c.x, c.y);
  if (!(lat > 560 && Math.abs(c.v) > 120 && sim.chase && sim.chase.blend > 0.5 && (surf === 'road' || surf === 'paving'))) return;
  ev.smokeT -= dt;
  if (ev.smokeT <= 0) {
    ev.smokeT = 0.085; ev.smokeSide = -ev.smokeSide;
    const ca = Math.cos(c.h), sa = Math.sin(c.h);
    puff(sim, c.x - ca * c.len * 0.32 - sa * c.wid * 0.36 * ev.smokeSide, c.y - sa * c.len * 0.32 + ca * c.wid * 0.36 * ev.smokeSide, 0, 0.9);
  }
  ev.screechT -= dt;
  if (ev.screechT <= 0) { ev.screechT = 0.42; sim.ev('screech'); }
}

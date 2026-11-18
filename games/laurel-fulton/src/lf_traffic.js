// lf_traffic.js — task L15: LIGHT ambient traffic on the real road graph. Pure logic (no DOM); main.js steps it once per sim tick.
//
//   const T = new Traffic(sim, W, { seed })     T.step(dt)     T.cars (ambient + patrol)     T.stats { spawns:[{t,d}], despawns, unsticks }
//
// "Not much traffic though." (owner, Nov 18): Scaggsville is a quiet suburb. AMBIENT_MAX cars alive at once (the cap IS the perf
// budget: the per-frame cost is one look-ahead scan over ~15 cars per ambient car), sparse spawns with long quiet gaps, always
// OUT OF SIGHT, despawning once they fall far behind. The same population is what the fake-cop game tails and the convoy shares
// the road with (they are ordinary sim.cars, flagged `ambient`).
//
// REUSE (no parallel systems):
//   * lf_pilot.roadPath    — the route on the road graph (edge-aware: gets onto the current edge, follows the destination
//                            edge's real shape) — the SAME planner the rally autopilot and the CPU crew drive by.
//   * sim.driveCar         — Palm City's car physics, unchanged; this file only decides throttle + steer (a CPU driver).
//   * the look-ahead YIELD — lf_world.js's CrewWorld.cpu(): a driver sees the car ahead, eases off and stops short of it, and
//                            after YIELD_GIVEUP s of waiting creeps on (never jams forever).
//   * sim.unstick          — the anti-wedge: a car that sits (or sits off the tarmac) is lifted back to the road and re-plans.
//   * Palm City's traffic idea (cars cruise a path, brake for what is ahead, never jam) — adapted from its loop to the graph.
// Palm City's traffic DENSITY and numbers do not transfer (it is a busy city); every number here is a named constant.
import { roadPath } from './lf_pilot.js';

export const AMBIENT_MAX = 2;                         // alive ambient cars, hard cap (owner, Nov 18: "half as many car traffic" — was 4)
export const FIRST_SPAWN = [4, 9];                    // s until the first car after boot
export const SPAWN_GAP = [24, 64];                    // s between spawns (was [10, 26]; stretched with the halving so the MEAN alive count halves too, not just the cap)
export const SPAWN_R = [900, 1700];                   // spawn ring around the player, world units (10/m): beyond the screen (half-height ~ 700)
export const DESPAWN_R = 2400;                        // an ambient car this far behind is removed
export const VISIBLE_R = 950;                         // inside this a car is "on screen": never popped away
export const PASS_R = [250, 900];                     // the point near the player a new car is routed through (so it PASSES by)
export const MPH = 4.47;                              // world u/s per mph
export const LIMIT_MPH = { living_street: 15, service: 15, residential: 25, unclassified: 30, tertiary: 35, secondary: 40, primary: 45, trunk: 50, motorway: 55 };
export const limitMph = (e) => (e && LIMIT_MPH[e.hw.replace('_link', '')]) || 25;   // the posted limit of a road edge
export const AMBIENT_FRAC = 0.9;                      // ambient drivers cruise at 90% of the limit
export const SPAWN_CLASSES = ['residential', 'unclassified', 'tertiary', 'secondary', 'primary'];   // no lot aisles, no highways, no ramps
export const LANE_FRAC = 0.5;                         // right-hand lane: this fraction of the half-width off the centreline
export const LOOKAHEAD = 70, LOOKAHEAD_V = 0.25;      // pure-pursuit look-ahead: units + this x speed
export const YIELD_D = 150, YIELD_LAT = 22, YIELD_CONE = 0.5, YIELD_GIVEUP = 4;   // lf_world's look-ahead yield (140 / cone 0.5 / 4 s), lateral gate added for two-lane roads
export const STUCK_UNSTICK = 5, WEDGE_KILL = 14, OFFROAD_KILL = 5;   // s: sat still -> unstick; sat still while unseen -> removed; off the tarmac -> unstick
export const PATROL_FRAC = 0.95;
const VCELL = 512;                                    // vertex bucket size for pickVertex

const TAU = Math.PI * 2, clamp = (x, a, b) => x < a ? a : x > b ? b : x, wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function dense(pts, step = 20) {                // a polyline sampled every ~step units (the follower looks up the nearest sample)
  const o = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) o.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
  return o;
}

export class Traffic {
  constructor(S, W, opts = {}) {
    this.S = S; this.W = W; this.rnd = rngOf(opts.seed || 20261118); this.t = 0; this.cars = []; this.enabled = true;
    this.quiet = !!opts.quiet;                         // no automatic spawns (tests that place cars by hand)
    this.models = (opts.models || ['camry_jason', 'tracer_zack', 'brougham_grant']).filter(m => S.fleet[m]);   // generic bodies from assets/fleet.json (no new bakes)
    if (!this.models.length) this.models = Object.keys(S.fleet);   // a city whose fleet holds none of the Laurel bodies (College Park) drives its OWN cars as the generic traffic: an empty list made spawn() pick models[0] === undefined, and addCar() threw on fleet[undefined].length inside the frame loop — car frozen at spawn, error banner up (owner's phone, Nov 18)
    this.vkeys = [...W.adj.keys()].filter(v => (W.adj.get(v) || []).some(([, , ei]) => SPAWN_CLASSES.includes(W.edges[ei].hw) && W.edges[ei].L === 0));
    this.vgrid = new Map(); for (const v of this.vkeys) { const q = W.verts[v], k = Math.floor(q.x / VCELL) * 100003 + Math.floor(q.y / VCELL); let l = this.vgrid.get(k); if (!l) this.vgrid.set(k, l = []); l.push(v); }
    this.nextSpawn = FIRST_SPAWN[0] + this.rnd() * (FIRST_SPAWN[1] - FIRST_SPAWN[0]); this.sweepT = 0;
    this.stats = { spawns: [], despawns: 0, unsticks: 0 };
  }
  get ambient() { return this.cars.filter(c => c.kind === 'ambient'); }

  // ---- paths ---------------------------------------------------------------------------------------------------------------
  // the centreline route (lf_pilot.roadPath), sampled, then shifted into the right-hand lane. null if the two points are not connected.
  route(fx, fy, tx, ty) {
    const r = roadPath(this.W, this.S, fx, fy, tx, ty);
    if (r.length <= 2 && Math.hypot(tx - fx, ty - fy) > 300) return null;   // roadPath's straight-line fallback: not connected
    return dense(r);
  }
  lanePath(pts, frac = LANE_FRAC) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let dx = q[0] - o[0], dy = q[1] - o[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const r = this.W.roadInfo(p[0], p[1], 0), off = r.e && r.d < r.hw + 12 ? Math.min(r.hw, 90) * frac : 0;
      out.push([p[0] - dy * off, p[1] + dx * off]);    // right of travel with y down is (-dy, dx)
    }
    return out;
  }
  pickVertex(near, rMin, rMax) {                        // a random road vertex between rMin and rMax of `near`, on an allowed ground-level road, nobody close
    const G = this.vgrid, cx0 = Math.floor((near.x - rMax) / VCELL), cx1 = Math.floor((near.x + rMax) / VCELL), cy0 = Math.floor((near.y - rMax) / VCELL), cy1 = Math.floor((near.y + rMax) / VCELL), ok = [];
    for (let i = cx0; i <= cx1; i++) for (let j = cy0; j <= cy1; j++) for (const v of G.get(i * 100003 + j) || []) {
      const q = this.W.verts[v], d = Math.hypot(q.x - near.x, q.y - near.y); if (d >= rMin && d <= rMax) ok.push(q);
    }
    for (let k = 0; k < 6 && ok.length; k++) {
      const i = Math.floor(this.rnd() * ok.length), q = ok[i];
      if (this.S.cars.some(c => Math.hypot(c.x - q.x, c.y - q.y) < 160)) { ok.splice(i, 1); continue; }
      return q;
    }
    return null;
  }
  newGoal(from) {                                       // somewhere 1500-3500 units on, by road
    for (let k = 0; k < 20; k++) { const q = this.pickVertex(from, 1500, 3500); if (!q) continue; const p = this.route(from.x, from.y, q.x, q.y); if (p) return { goal: q, pts: this.lanePath(p) }; }
    return null;
  }

  // ---- spawning -------------------------------------------------------------------------------------------------------------
  // kind 'ambient' (the light traffic) or 'patrol' (a cruising cop, lf_cops.js). Out of sight, routed to pass by the player, then on.
  spawn(kind = 'ambient', model = null) {
    const S = this.S, P = S.player; if (!P || !this.enabled) return null;
    if (!model && !this.models.length) return null;   // no usable body in this city's fleet: skip the spawn rather than throw inside the frame loop
    if (kind === 'ambient' && this.ambient.length >= AMBIENT_MAX) return null;
    for (let tries = 0; tries < 12; tries++) {
      const q = this.pickVertex(P, SPAWN_R[0], SPAWN_R[1]); if (!q) continue;
      const via = this.pickVertex(P, PASS_R[0], PASS_R[1]); if (!via) continue;
      const a = this.route(q.x, q.y, via.x, via.y); if (!a || a.length < 15) continue;
      const g = this.pickVertex(via, 1500, 3500), b = g && this.route(via.x, via.y, g.x, g.y);
      const pts = this.lanePath(b ? a.concat(b.slice(1)) : a);
      let k = 1; while (k < pts.length - 1 && Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]) < 24) k++;
      const h = Math.atan2(pts[k][1] - pts[0][1], pts[k][0] - pts[0][0]);
      const c = this.addDriver(model || this.models[Math.floor(this.rnd() * this.models.length)], pts[0][0], pts[0][1], h, kind, pts, g || via);
      this.stats.spawns.push({ t: this.t, d: dist(c, P), kind }); return c;
    }
    return null;
  }
  // put a driven car on a path (also the test hook behind spawnAt)
  addDriver(model, x, y, h, kind, pts, goal) {
    const S = this.S, r = S.W.roadInfo(x, y, 0), lim = limitMph(r.e) * MPH;
    const c = S.addCar(model, x, y, h, { ambient: kind === 'ambient', kind, tr: { pts, pi: 0, goal, stuckT: 0, offT: 0, yieldT: 0, wedgeT: 0 } });
    c.cruise = lim * (kind === 'patrol' ? PATROL_FRAC : AMBIENT_FRAC) * (0.92 + this.rnd() * 0.16); c.v = Math.min(c.cruise, 60);
    c.driveFn = (car, dt) => this.drive(car, dt); this.cars.push(c); return c;
  }
  // a car parked/idling in the road (test hook; `still` = a stalled car that does not move)
  spawnAt(x, y, h, o = {}) {
    const c = this.addDriver(o.model || this.models[0], x, y, h, o.kind || 'ambient', null, null);
    if (o.still) { c.parked = true; c.v = 0; c.driveFn = null; } else this.replan(c);
    this.stats.spawns.push({ t: this.t, d: this.S.player ? dist(c, this.S.player) : 0, kind: c.kind, hand: true }); return c;
  }
  remove(c) { const S = this.S, i = S.cars.indexOf(c); if (i >= 0) S.cars.splice(i, 1); const j = this.cars.indexOf(c); if (j >= 0) this.cars.splice(j, 1); this.stats.despawns++; }
  forget(c) { const j = this.cars.indexOf(c); if (j >= 0) this.cars.splice(j, 1); }   // hand a car to another driver (lf_cops chasers)

  // ---- driving --------------------------------------------------------------------------------------------------------------
  replan(c) {                                           // a fresh route from where the car is, to a new goal
    const st = c.tr, g = this.newGoal(c); if (!g) { st.pts = null; return; }
    const first = this.route(c.x, c.y, g.goal.x, g.goal.y); st.pts = first ? this.lanePath(first) : g.pts; st.pi = 0; st.goal = g.goal;
  }
  // is a car in the way? lf_world's look-ahead yield: something within YIELD_D, in a narrow cone, in your lane; give up after YIELD_GIVEUP s of waiting
  blocked(c, st) {
    if (st.yieldT > YIELD_GIVEUP) return false;
    const S = this.S, ca = c.dirx, sa = c.diry;
    for (const o of S.cars) {
      if (o === c || o.layer !== c.layer || o.parked) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy); if (d > YIELD_D) continue;
      if (Math.abs(wrap(Math.atan2(dy, dx) - c.h)) > YIELD_CONE) continue;
      if (Math.abs(-dx * sa + dy * ca) > YIELD_LAT) continue;                // not in my lane (oncoming traffic passes on its own side)
      if (c.v > 40 || d < 70) return true;
    }
    return false;
  }
  // pure-pursuit one step along st.pts at up to `cruise` u/s. Returns the speed it wanted (0 = braking for something).
  follow(c, st, dt, cruise, brake = false) {
    const S = this.S, pts = st.pts; if (!pts || pts.length < 2) { S.driveCar(c, c.v > 5 ? -1 : 0, 0, dt, 40); return 0; }
    let best = 1e18, bi = st.pi; const hi = Math.min(pts.length, st.pi + 45);
    for (let i = Math.max(0, st.pi - 4); i < hi; i++) { const d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < best) { best = d; bi = i; } }
    st.pi = bi; const LA = LOOKAHEAD + Math.abs(c.v) * LOOKAHEAD_V; let j = bi, acc = 0;
    while (j + 1 < pts.length && acc < LA) { acc += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; }
    let j2 = j, a2 = 0; while (j2 + 1 < pts.length && a2 < LA * 1.8) { a2 += Math.hypot(pts[j2 + 1][0] - pts[j2][0], pts[j2 + 1][1] - pts[j2][1]); j2++; }
    const tx = pts[j][0] - c.x, ty = pts[j][1] - c.y, ta = Math.atan2(ty, tx), rel = wrap(ta - c.h);
    const b = wrap(Math.atan2(pts[j2][1] - pts[j][1], pts[j2][0] - pts[j][0]) - ta), bend = Math.abs(b);
    st.end = bi >= pts.length - 2 && Math.hypot(pts[pts.length - 1][0] - c.x, pts[pts.length - 1][1] - c.y) < 90;
    let want = brake ? 0 : cruise * (1 - Math.min(0.55, bend * 0.7)) * (1 - Math.min(0.45, Math.abs(rel) * 0.5));
    if (Math.abs(rel) > 1.6 && c.v < 60) { S.driveCar(c, 0.5, Math.sign(rel || 1), dt, 70); return want; }   // pointing the wrong way: swing round going forward
    const throttle = c.v < want ? 0.8 : c.v > want + 12 ? -1 : 0;
    S.driveCar(c, throttle, clamp(rel * 2.4, -1, 1), dt, Math.max(40, cruise * 1.1 + 6));
    return want;
  }
  drive(c, dt) {                                         // an ambient / patrol driver (sim.step calls this for the car)
    const S = this.S, st = c.tr; if (!st || c.wreck) return;
    if (!st.pts || st.end) { this.replan(c); }
    const bl = this.blocked(c, st);
    st.yieldT = bl ? st.yieldT + dt : Math.max(0, st.yieldT - dt * 2);
    const want = this.follow(c, st, dt, c.cruise, bl);
    // wedged? sat still with somewhere to go (not by choice at a yield): lift back onto the road and re-plan (sim.unstick)
    if (!bl && want > 20 && Math.abs(c.v) < 6) st.stuckT += dt; else st.stuckT = Math.max(0, st.stuckT - dt);
    st.wedgeT = Math.abs(c.v) < 6 ? st.wedgeT + dt : 0;
    const sf = c.surface; st.offT = (sf === 'ground' || sf === 'sidewalk') && c.z === 0 ? st.offT + dt : 0;
    if (st.stuckT > STUCK_UNSTICK || st.offT > OFFROAD_KILL) { S.unstick(c); this.stats.unsticks++; st.stuckT = st.offT = 0; this.replan(c); }
  }

  // ---- the manager -----------------------------------------------------------------------------------------------------------
  step(dt) {
    const S = this.S, P = S.player; this.t += dt; if (!P || !this.enabled) return;
    for (let i = this.cars.length - 1; i >= 0; i--) if (S.cars.indexOf(this.cars[i]) < 0) this.cars.splice(i, 1);   // removed elsewhere (e.g. fake-cop game)
    if ((this.sweepT -= dt) <= 0) {                     // twice a second: who is far behind / wedged / burning where nobody looks
      this.sweepT = 0.5;
      for (const c of this.cars.slice()) {
        const d = dist(c, P), st = c.tr, unseen = d > VISIBLE_R;
        if (d > DESPAWN_R || (unseen && (c.wreck || (st && st.wedgeT > WEDGE_KILL)))) this.remove(c);
        else if (c.kind === 'patrol' && unseen && this.cars.filter(o => o.kind === 'patrol').length > (this.patrolMax ?? 1)) this.remove(c);   // surplus cruisers (stood-down chasers) leave
      }
    }
    if (!this.quiet && this.t >= this.nextSpawn) {
      this.nextSpawn = this.t + SPAWN_GAP[0] + this.rnd() * (SPAWN_GAP[1] - SPAWN_GAP[0]);
      this.spawn('ambient');
    }
  }
}

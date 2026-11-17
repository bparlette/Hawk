// lf_sim.js — Laurel/Fulton's simulation (task L1 sample): the player's car on the REAL road graph.
// Car physics and the stick-to-steer mapping are Palm City's own (games/palm-city/src/sim.js
// stepPlayerCar / driveCar — its opening streets are the physics BAR), unchanged numbers. What is new:
// two levels (a car carries `layer`; bridge decks are layer 1 — it climbs onto a deck only where the deck
// is the road under it, and drops back where the ground road takes over), and collisions only between
// cars on the same level. Units: 10 per metre, x east, y south; heading 0 = east.
//
//   const S = new LFSim(world, roster, fleet); S.step(dt, input)   input: Palm City's {jx, jy, jm, keys, action, turbo}

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const TOP = 290, TURBO_MULT = 1.4;
// L3 speed bumps: below `launch` u/s (~30 mph) a crossing is a jolt (speed x jolt); above it the car leaves the
// ground with vz = vz0 + (speed - launch) * k under game gravity g — arc height/length scale with entry speed.
export const BUMP = { launch: 135, jolt: 0.72, vz0: 55, k: 0.9, g: 620 };                 // Palm City: 290 u/s top, turbo x1.4

export class LFSim {
  constructor(W, roster, fleet, opts = {}) {
    this.W = W; this.roster = roster; this.fleet = fleet; this.time = 0; this.cars = []; this.events = [];
    // task L3: speed bumps (data/bumps.json), indexed by 256-unit cell for the crossing test
    this.bumps = opts.bumps || []; this.bumpGrid = new Map();
    this.bumps.forEach((b, i) => { const k = Math.floor(b.x / 256) * 100003 + Math.floor(b.y / 256); let l = this.bumpGrid.get(k); if (!l) this.bumpGrid.set(k, l = []); l.push(i); });
    // every crew car parked at its owner's house, nose toward the street
    for (const p of roster.people) {
      if (!p.active || !p.car || !p.car.sprite || !fleet[p.car.sprite]) continue;
      const [hx, hy] = p.house, r = W.roadInfo(hx, hy, 0);
      const toRoad = Math.atan2(-(hy - (hy - 1)), 0);
      const c = this.addCar(p.car.sprite, hx, hy, 0, { owner: p.id, parked: true });
      if (r.e) {                                          // in the driveway: between the house and the kerb, facing the street
        const k = Math.max(0, r.d - r.hw - 20) / Math.max(1, r.d);
        const nx = hx + (this.nearPt(hx, hy, r).x - hx) * (1 - k * 0.15), ny = hy + (this.nearPt(hx, hy, r).y - hy) * (1 - k * 0.15);
        const sx = hx + (nx - hx) * 0.55, sy = hy + (ny - hy) * 0.55;
        c.x = sx; c.y = sy; c.h = Math.atan2(ny - hy, nx - hx);
      } else c.h = toRoad;
      const hk = hx + ',' + hy, nth = (this._atHouse = this._atHouse || new Map()).get(hk) || 0;   // a shared driveway (data: same house):
      this._atHouse.set(hk, nth + 1);                                                          // the 2nd, 3rd... car parks alongside
      if (nth) { const side = (nth % 2 ? 1 : -1) * Math.ceil(nth / 2) * 28; c.x += Math.cos(c.h + Math.PI / 2) * side; c.y += Math.sin(c.h + Math.PI / 2) * side; }
    }
    const A0 = W.G.anchors.ledo || Object.values(W.G.anchors)[0];   // Laurel: Ledo's lot aisle; any city: its first POI
    const sp = opts.spawn || (A0 ? W.verts[A0.v] : W.verts[W.G.edges[0].a]);   // Ledo's lot aisle (the anchor's graph vertex), not the restaurant's point inside its footprint
    const model = opts.model || (fleet.camaro_brad ? 'camaro_brad' : Object.keys(fleet)[0]);   // any city: its first car
    const start = this.addCar(model, sp.x, sp.y, opts.h ?? 0, { player: true });
    this.player = start;
    const r = W.roadInfo(sp.x, sp.y, 0);
    if (r.e && !opts.h) start.h = Math.atan2(r.dy, r.dx);
  }

  nearPt(x, y, r) {                                       // the nearest point on r's edge polyline
    let best = 1e18, bp = { x, y };
    const P = r.e.pts;
    for (let k = 0; k + 1 < P.length; k++) {
      const [ax, ay] = P[k], [bx, by] = P[k + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1), px = ax + vx * t, py = ay + vy * t, d = (px - x) ** 2 + (py - y) ** 2;
      if (d < best) { best = d; bp = { x: px, y: py }; }
    }
    return bp;
  }

  addCar(model, x, y, h, extra = {}) {
    const m = this.fleet[model];
    const c = { model, x, y, h, v: 0, layer: 0, z: 0, vz: 0, len: m.length, wid: m.width, turbo: 0, ...extra };
    this.cars.push(c); return c;
  }

  // the level a car is on: stay on a deck while the deck is under you; step up where the deck is the road
  // under you and the ground road has ended; step down the same way.
  layerAt(c, x, y) {
    const W = this.W;
    if (c.layer === 1) { const r1 = W.roadInfo(x, y, 1); if (r1.e && r1.d < r1.hw + 6) return 1; return 0; }
    const r1 = W.roadInfo(x, y, 1); if (!(r1.e && r1.d < r1.hw)) return 0;
    const r0 = W.roadInfo(x, y, 0);
    return (r0.e && r0.d < r0.hw && Math.abs(r0.dx * c.dirx + r0.dy * c.diry) > 0.85 && r0.e.L === 0 &&
            Math.abs(r1.dx * c.dirx + r1.dy * c.diry) < 0.6) ? 0 : 1;   // a ground road you are driving ALONG wins over a deck crossing above it
  }

  step(dt, inp = {}) {
    this.time += dt;
    const c = this.player, k = inp.keys || {};
    let throttle = 0, steer = 0;
    if (k.up || k.down || k.left || k.right) {
      throttle = (k.up ? 1 : 0) - (k.down ? 1 : 0); steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    } else if (inp.jm > 0.15) {                           // Palm City's stick: point where you want to go
      const ta = Math.atan2(inp.jy, inp.jx), diff = wrap(ta - c.h);
      if (Math.abs(diff) > 2.3 && c.v < 70) { throttle = -inp.jm * 0.7; steer = clamp(-wrap(ta + Math.PI - c.h) * 2.2, -1, 1); }
      else { throttle = inp.jm * (1 - Math.min(0.55, Math.abs(diff) / 3)); steer = clamp(diff * 2.4, -1, 1); }
    }
    c.turbo = clamp(c.turbo + ((inp.turbo && throttle > 0) ? dt / 0.4 : -dt / 0.6), 0, 1);
    const top = TOP * (1 + (TURBO_MULT - 1) * c.turbo);
    this.driveCar(c, throttle * (inp.turbo ? 1.6 : 1), steer, dt, top);
    for (const o of this.cars) if (o !== c && !o.parked && o.driveFn) o.driveFn(o, dt);
    this.collide();
  }

  // task L3: the bump the car's centre crossed this step (old -> new position), or null
  bumpCrossed(c, nx, ny) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const bi of this.bumpGrid.get((Math.floor(nx / 256) + i) * 100003 + Math.floor(ny / 256) + j) || []) {
        const b = this.bumps[bi], s0 = (c.x - b.x) * b.dx + (c.y - b.y) * b.dy, s1 = (nx - b.x) * b.dx + (ny - b.y) * b.dy;
        if (s0 * s1 > 0 || s0 === s1) continue;
        if (Math.abs(-(nx - b.x) * b.dy + (ny - b.y) * b.dx) < b.w / 2 + 6) return b;
      }
    }
    return null;
  }

  // Palm City driveCar, verbatim numbers — plus the L3 airborne state (z, vz)
  driveCar(c, throttle, steer, dt, vmax) {
    if (c.z > 0) {                                        // airborne: no grip, no throttle — you keep the line you left on
      c.z += c.vz * dt; c.vz -= BUMP.g * dt; c.airSteer += Math.abs(steer) * dt;
      c.x += c.dirx * c.v * dt; c.y += c.diry * c.v * dt;
      if (c.z <= 0) {                                     // touchdown: clean keeps the speed, a yanked wheel costs some
        c.z = 0; c.vz = 0;
        const bad = Math.min(1, c.airSteer / 0.25); c.v *= 0.97 - 0.2 * bad;
        this.events.push({ t: this.time, kind: bad > 0.5 ? 'land_bad' : 'land', model: c.model });
      }
      c.surface = this.W.surfaceAt(c.x, c.y, c.layer); return;
    }
    const accel = throttle > 0 ? (c.v < 0 ? 520 : 240) : throttle < 0 ? (c.v > 0 ? 520 : 200) : 0;
    c.v += throttle * accel * dt;
    if (throttle === 0) c.v *= Math.pow(0.35, dt);
    const surf = this.W.surfaceAt(c.x, c.y, c.layer);
    if (surf === 'ground') vmax *= 0.55;                 // off the tarmac: lawns and verges drag (Palm City's sand rule)
    c.v = clamp(c.v, -100, vmax);
    c.v *= Math.pow(0.9, dt);
    const grip = Math.min(1, Math.abs(c.v) / 70);
    c.h = wrap(c.h + steer * 2.7 * grip * Math.sign(c.v) * dt);
    c.dirx = Math.cos(c.h); c.diry = Math.sin(c.h);
    const nx = c.x + c.dirx * c.v * dt, ny = c.y + c.diry * c.v * dt;
    const bump = this.bumps.length && c.layer === 0 ? this.bumpCrossed(c, nx, ny) : null;
    if (bump) {
      const sp = Math.abs(c.v);
      if (sp < BUMP.launch) { c.v *= BUMP.jolt; c.jolt = 0.22; this.events.push({ t: this.time, kind: 'jolt', model: c.model }); }   // crawl over: a jolt that scrubs momentum
      else { c.vz = BUMP.vz0 + (sp - BUMP.launch) * BUMP.k; c.z = 0.01; c.airSteer = 0; this.events.push({ t: this.time, kind: 'launch', model: c.model, v: sp }); }   // fast: LAUNCH
    }
    if (c.jolt > 0) c.jolt -= dt;
    c.layer = this.layerAt(c, nx, ny);
    c.x = nx; c.y = ny;
    c.surface = this.W.surfaceAt(c.x, c.y, c.layer);
  }

  // car-car contact (Palm City's separation rule), only between cars on the same level
  collide() {
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.layer !== b.layer) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), reach = (a.len + b.len) / 4 + (a.wid + b.wid) / 4;
      if (d > reach || d < 0.01) continue;
      const push = reach - d, nx = dx / d, ny = dy / d, ma = a.parked ? 3 : 1, mb = b.parked ? 3 : 1;
      a.x -= nx * push * mb / (ma + mb); a.y -= ny * push * mb / (ma + mb); b.x += nx * push * ma / (ma + mb); b.y += ny * push * ma / (ma + mb);
      if (Math.abs(a.v - b.v) > 60) this.events.push({ t: this.time, kind: 'bump', a: a.model, b: b.model });
      a.v *= 0.75; b.v *= 0.75;
    }
  }
}

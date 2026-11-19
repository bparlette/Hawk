// lf_sim.js — Laurel/Fulton's simulation (task L1 sample): the player's car on the REAL road graph.
// Car physics and the stick-to-steer mapping are Palm City's own (games/palm-city/src/sim.js
// stepPlayerCar / driveCar — its opening streets are the physics BAR), unchanged numbers. What is new:
// two levels (a car carries `layer`; bridge decks are layer 1 — it climbs onto a deck only where the deck
// is the road under it, and drops back where the ground road takes over), and collisions only between
// cars on the same level. Units: 10 per metre, x east, y south; heading 0 = east.
//
//   const S = new LFSim(world, roster, fleet); S.step(dt, input)   input: Palm City's {jx, jy, jm, keys, action, turbo}

import { initSkid, layMarks } from './lf_skid.js';   // Palm City's skid module, stolen (owner, Nov 17)
import { initDrift, stepDrift, loseDrift, ageDrift, DRIFT } from './lf_drift.js';   // drift banking off the skid slip (owner, Nov 18)
import { buildRails, railsNear, bushesNear } from './lf_veg.js';   // crashable guardrails + bushes (owner, Nov 18)

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const TOP = 290, TURBO_MULT = 1.4;
// L3 speed bumps: below `launch` u/s (~30 mph) a crossing is a jolt (speed x jolt); above it the car leaves the
// ground with vz = vz0 + (speed - launch) * k under game gravity g — arc height/length scale with entry speed.
export const BUMP = { launch: 135, jolt: 0.72, vz0: 55, k: 0.9, g: 620 };                 // Palm City: 290 u/s top, turbo x1.4

// Car damage — Palm City's destruct.js, exact numbers (owner, Nov 17: "beat each other's cars
// exact same way as palm city even fire"): one dmg number 0..1, stages at [0.25, 0.6, 1] =
// dented / crumpled (smoking) / wreck (burning, dead). The driven car is the hero: HERO 0.2 of
// any impact (Palm City's Nov 16 tuning: absorbs 3x). Laurel's twist, also the owner's: SELF-
// HEALING — 10 s after the last hit a car is back to normal, no matter what stage it was in.
export const STAGES_CAR = [0.25, 0.6, 1];
export const stageOfCar = (d) => d >= STAGES_CAR[2] ? 3 : d >= STAGES_CAR[1] ? 2 : d >= STAGES_CAR[0] ? 1 : 0;
export const HERO = 0.2, HEAL_AFTER = 10;
export const LANE_PASS = 0.35;   // L15: oncoming ambient traffic passes in its own lane — contact needs lateral overlap < (a.wid + b.wid) x this
export function impactDamage(sp) { if (sp < 30) return 0; const k = Math.max(0, (sp - 55) / 250); return 0.012 + 0.6 * k * Math.sqrt(k); }

export class LFSim {
  constructor(W, roster, fleet, opts = {}) {
    this.W = W; this.roster = roster; this.fleet = fleet; this.time = 0; this.cars = []; this.events = [];
    this.kothBoost = false;   // Cul-de-Sac King of the Hill sets this during a round (bumper rules)
    initSkid(this);
    initDrift(this);
    // task L3: speed bumps (data/bumps.json), indexed by 256-unit cell for the crossing test
    this.bumps = opts.bumps || []; this.bumpGrid = new Map();
    this.bumps.forEach((b, i) => { const k = Math.floor(b.x / 256) * 100003 + Math.floor(b.y / 256); let l = this.bumpGrid.get(k); if (!l) this.bumpGrid.set(k, l = []); l.push(i); });
    // houses (owner, Nov 17): the painted generic footprints are SOLID — you drive around them and
    // bounce off. Indexed by setBuildings (not only the ctor) because main.js now boots BEFORE
    // areas.json lands (the load split) and calls it again on arrival.
    this.houses = []; this.houseGrid = new Map(); this.houseBox = [];
    if (opts.buildings) this.setBuildings(opts.buildings);
    // crashable scenery (owner, Nov 18): guardrails from the road graph (built now, the
    // graph is here at boot), bushes as a hash scatter (lf_veg) — squashed bushes are
    // remembered here so the renderer flattens the same ones; they regrow after 20 s.
    this.rails = buildRails(W); this.squashed = new Map(); this.greens = opts.greens || null;
    this._bushBuf = []; this._railBuf = [];
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
    const c = { model, x, y, h, v: 0, layer: 0, z: 0, vz: 0, len: m.length, wid: m.width, turbo: 0, dirx: Math.cos(h), diry: Math.sin(h), dmg: 0, dent: [0, 0, 0, 0], glass: [0, 0], wreck: false, hitT: -9, ...extra };
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

  // Palm City's hitCar, verbatim amounts: the struck panel dents at amt x 1.7, front/rear glass
  // cracks at amt x 1.5 on a hard panel hit, dmg climbs to the wreck at 1. A hit under 0.004
  // doesn't count — and doesn't restart the self-heal clock.
  setBuildings(buildings) {
    this.houses = buildings || []; this.houseGrid = new Map(); this.houseBox = [];
    this.houses.forEach((f, i) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); }
      this.houseBox.push([x0, y0, x1, y1]);
      for (let cx = Math.floor(x0 / 256); cx <= Math.floor(x1 / 256); cx++) for (let cy = Math.floor(y0 / 256); cy <= Math.floor(y1 / 256); cy++) { const key = cx * 100003 + cy; let l = this.houseGrid.get(key); if (!l) this.houseGrid.set(key, l = []); l.push(i); }
    });
  }

  setGreens(greens) { this.greens = greens || null; }   // areas.json green polygons — bush country (main.js phase 2)

  // is there a house footprint within d of (x, y)? (the bush rule + the anti-stuck test)
  nearBuilding(x, y, d = 110) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      for (const hi of this.houseGrid.get((Math.floor(x / 256) + i) * 100003 + Math.floor(y / 256) + j) || []) {
        const bb = this.houseBox[hi];
        if (x > bb[0] - d && x < bb[2] + d && y > bb[1] - d && y < bb[3] + d) return true;
      }
    return false;
  }

  // the player's car is hard against (or inside) a house footprint — houseCollide's
  // neighbourhood test, read-only.
  touchingHouse(c) {
    const R = (c.len + c.wid) / 4 + 2, seen = new Set();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      for (const hi of this.houseGrid.get((Math.floor(c.x / 256) + i) * 100003 + Math.floor(c.y / 256) + j) || []) {
        if (seen.has(hi)) continue; seen.add(hi);
        const bb = this.houseBox[hi];
        if (c.x > bb[0] - R && c.x < bb[2] + R && c.y > bb[1] - R && c.y < bb[3] + R) return true;
      }
    return false;
  }

  // anti-stuck recovery: back to the nearest road centreline point, stopped, wreck cleared
  unstick(c) {
    const r = this.W.roadInfo(c.x, c.y, 0);
    let tx = null, ty = null;
    // a target only counts if the car would be CLEAR of the houses there. The nearest
    // centreline point can sit in the same pocket that wedged the car (a service aisle
    // threading a slot between two footprints narrower than the car — Dre's driveway,
    // College Park, Nov 18): dropping it back there re-wedges it on the spot, the
    // anti-stuck fires forever, and no input ever gets the player out.
    const clearAt = (x, y) => { const px = c.x, py = c.y; c.x = x; c.y = y; const t = this.touchingHouse(c); c.x = px; c.y = py; return !t; };
    if (r && r.e) { const p = this.nearPt(c.x, c.y, r); if (clearAt(p.x, p.y)) { tx = p.x; ty = p.y; } }
    if (tx === null) for (let ring = 60; ring <= 900 && tx === null; ring += 60)
      for (let k = 0; k < 24; k++) { const x = c.x + Math.cos(k / 24 * Math.PI * 2) * ring, y = c.y + Math.sin(k / 24 * Math.PI * 2) * ring; if (this.W.surfaceAt(x, y, 0) === 'road' && clearAt(x, y)) { tx = x; ty = y; break; } }
    if (tx === null) return;
    c.x = tx; c.y = ty; c.v = 0; c.z = 0; c.vz = 0; c.wreck = false;
    this.events.push({ t: this.time, kind: 'unstuck', model: c.model });
  }

  // guardrails (owner, Nov 18): a scrape, not a wall — the car is pushed out of the
  // rail line and SLIDES along it (no heading bounce: a bounce is what wedges cars
  // against houses). A fast hit bites a little damage; the slide itself is free.
  railCollide() {
    if (!this.rails || !this.rails.segs.length) return;
    for (const c of this.cars) {
      if (c.parked || c.remote || c.z > 0 || c !== this.player) continue;   // Nov 18: rails are the PLAYER's scenery to crash into; CPU drivers + convoy followers hug the edge and ground along them (51k scrapes / 78 wrecks per 12 CPU-min, stalled rallies)
      const R = (c.len + c.wid) / 4;
      for (const s of railsNear(this.rails, c.x, c.y, c.layer, this._railBuf)) {
        const vx = s.x1 - s.x0, vy = s.y1 - s.y0, L2 = vx * vx + vy * vy || 1;
        const t = clamp(((c.x - s.x0) * vx + (c.y - s.y0) * vy) / L2, 0, 1), px = s.x0 + vx * t, py = s.y0 + vy * t;
        const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
        if (d >= R || d < 0.001) continue;
        const nx = dx / d, ny = dy / d;
        c.x += nx * (R - d); c.y += ny * (R - d);
        const vn = c.dirx * nx + c.diry * ny;              // kill only the into-rail motion: the car keeps its slide
        if (vn < 0) { const sp = Math.abs(c.v); if (sp > 60) { this.hitCar(c, impactDamage(sp) * 0.5 * (c === this.player ? HERO : 1), -nx, -ny); this.events.push({ t: this.time, kind: 'rail', model: c.model, v: sp }); } c.v *= 0.94; }
      }
    }
  }

  // bushes (owner, Nov 18): soft — driving in squashes the bush flat and drags the
  // car hard, but a bush can never stop or wedge anyone. Regrow after 20 s.
  bushCollide(dt) {
    for (const [id, t] of this.squashed) if (this.time - t > 20) this.squashed.delete(id);
    for (const c of this.cars) {
      if (c.parked || c.remote || c.layer !== 0 || c.z > 0 || Math.abs(c.v) < 4) continue;
      const R = (c.len + c.wid) / 4;
      for (const b of bushesNear(c.x, c.y, R + 18, this.W, (x, y) => this.nearBuilding(x, y), this.greens, this._bushBuf)) {
        if (Math.hypot(b.x - c.x, b.y - c.y) >= R + b.r) continue;
        if (!this.squashed.has(b.id)) { this.squashed.set(b.id, this.time); if (c === this.player) this.events.push({ t: this.time, kind: 'bush', model: c.model }); }
        c.v *= Math.pow(0.18, dt);                          // ploughing through foliage: heavy drag, never a wall
      }
    }
  }

  hitCar(c, amt, dx, dy) {
    if (amt <= 0.004 || this.time - c.hitT < 0.3) return;
    const before = stageOfCar(c.dmg);
    const ca = Math.cos(c.h), sa = Math.sin(c.h);
    const u = -(dx * ca + dy * sa), v = -(-dx * sa + dy * ca);          // where the blow lands, in the car's frame (Palm City panelFor)
    const panel = Math.abs(u) * 0.6 > Math.abs(v) ? (u > 0 ? 0 : 1) : (v < 0 ? 2 : 3);
    c.dent[panel] = Math.min(1, c.dent[panel] + amt * 1.7);
    if (panel < 2 && amt > 0.06) c.glass[panel] = Math.min(1, c.glass[panel] + amt * 1.5);
    c.dmg = Math.min(1, c.dmg + amt);
    c.hitT = this.time;
    const after = stageOfCar(c.dmg);
    if (after > before) this.events.push({ t: this.time, kind: after >= 3 ? 'wreck' : after >= 2 ? 'crumple' : 'dent', model: c.model, stage: after });
    if (c.dmg >= 1 && !c.wreck) { c.wreck = true; c.v = 0; this.events.push({ t: this.time, kind: 'wrecked', model: c.model }); }
  }

  // houses: a moving car (circle, R from its size) against the footprint polygons in nearby cells.
  // On contact: push out through the nearest wall and reflect the heading off it — an arcade
  // bounce that keeps 45% of the speed. Parked cars are exempt (they sit in driveways by design),
  // and so are remote cars (L6: their own machine resolves their contacts).
  houseCollide() {
    if (!this.houses.length) return;
    for (const c of this.cars) {
      if (c.parked || c.layer !== 0 || c.remote) continue;
      const R = (c.len + c.wid) / 4, seen = new Set();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
        for (const hi of this.houseGrid.get((Math.floor(c.x / 256) + i) * 100003 + Math.floor(c.y / 256) + j) || []) {
          if (seen.has(hi)) continue; seen.add(hi);
          const f = this.houses[hi], bb = this.houseBox[hi];
          if (c.x < bb[0] - R || c.x > bb[2] + R || c.y < bb[1] - R || c.y > bb[3] + R) continue;
          let best = 1e18, bx = 0, by = 0, inside = false;
          for (let k = 0; k < f.length; k += 2) {
            const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length];
            const vx = ex - ax, vy = ey - ay, L2 = vx * vx + vy * vy || 1;
            const t = clamp(((c.x - ax) * vx + (c.y - ay) * vy) / L2, 0, 1), px = ax + vx * t, py = ay + vy * t, d = (px - c.x) ** 2 + (py - c.y) ** 2;
            if (d < best) { best = d; bx = px; by = py; }
            if ((ay > c.y) !== (ey > c.y) && c.x < (ex - ax) * (c.y - ay) / (ey - ay) + ax) inside = !inside;
          }
          const dist = Math.sqrt(best);
          if (!inside && dist >= R) continue;
          let nx = c.x - bx, ny = c.y - by; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          if (inside) { nx = -nx; ny = -ny; c.x = bx + nx * (R + 1); c.y = by + ny * (R + 1); }
          else { c.x += nx * (R - dist); c.y += ny * (R - dist); }
          const dot = c.dirx * nx + c.diry * ny;
          if (dot < 0) { const rx = c.dirx - 2 * dot * nx, ry = c.diry - 2 * dot * ny; c.h = Math.atan2(ry, rx); c.dirx = Math.cos(c.h); c.diry = Math.sin(c.h); }
          if (Math.abs(c.v) > 40) this.events.push({ t: this.time, kind: 'house', model: c.model, v: Math.abs(c.v) });
          // Palm City carImpact: running into something solid dents the leading panel too
          const sp = Math.abs(c.v), sgn = c.v >= 0 ? 1 : -1;
          if (c === this.player && sp >= DRIFT.hardHit) loseDrift(this, c);   // DRIFT BANKING: a hard building hit loses the bank (lf_drift.js)
          this.hitCar(c, impactDamage(sp) * (c === this.player && !c.parked ? HERO : 1), -(c.dirx || 1) * sgn, -(c.diry || 0) * sgn);
          c.v *= 0.45; if (c.z > 0) c.vz = Math.min(c.vz, 0);
          c.jolt = 0.22;
        }
    }
  }

  step(dt, inp = {}) {
    this.time += dt;
    ageDrift(this, dt);   // drift-bank popups age in sim time, whatever mode the player is in
    if (this.player && inp) this.stickDrive(this.player, inp, dt);
    for (const o of this.cars) if (o !== this.player && !o.parked && !o.remote && o.driveFn) o.driveFn(o, dt);
    this.collide();
    this.houseCollide();
    this.railCollide();
    this.bushCollide(dt);
    // ANTI-STUCK (owner, Nov 18 — the friend review: "got stuck in a tree... couldn't get
    // back in my car"): the PLAYER's car can never stay wedged. Stick held, car barely
    // moving on the ground, and the spot is off-road, wrecked, or hard against a house
    // for 1.5 s straight -> it is lifted back to the nearest road point, stopped.
    const P = this.player;
    if (P && inp && !P.remote) {
      const want = (inp.jm || 0) > 0.15 || !!((inp.keys || {}).up || (inp.keys || {}).down);
      if (want && Math.abs(P.v) < 8 && !P.z && (P.surface !== 'road' || P.wreck || this.touchingHouse(P))) P.stuckT = (P.stuckT || 0) + dt;
      else P.stuckT = 0;
      if (P.stuckT > 1.5) { P.stuckT = 0; this.unstick(P); }
    }
    // SELF-HEALING (owner, Nov 17): 10 s after a car's last hit it is back to normal — dents,
    // glass, damage and even the wreck itself, whatever stage it had reached.
    for (const o of this.cars) if ((o.dmg > 0 || o.wreck) && this.time - o.hitT >= HEAL_AFTER) {
      o.dmg = 0; o.dent = [0, 0, 0, 0]; o.glass = [0, 0];
      if (o.wreck) { o.wreck = false; this.events.push({ t: this.time, kind: 'healed', model: o.model }); }
    }
  }

  // Palm City's stick -> throttle/steer, for ANY car (the player, or a CPU crew member driven by lf_pilot — task L6)
  stickDrive(c, inp, dt) {
    const k = inp.keys || {};
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
    if (c.wreck) { throttle = 0; steer = 0; }             // a wreck goes nowhere (Palm City) — until Laurel's 10 s self-heal revives it
    vmax *= 1 - 0.4 * (c.dmg || 0);                       // a battered car is slower (Palm City: vmax x (1 - 0.4 dmg))
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
    if (c === this.player || c.driveFn) { const sl = layMarks(this, c, throttle, steer, grip, dt); if (c === this.player) stepDrift(this, c, sl, steer, grip, dt); }   // slipping tyres leave marks (Palm City); the player's slip also feeds drift banking (lf_drift.js)
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
      // L15 LANE PASS-BY: the circle test above is wider than a two-lane street, so oncoming cars would 'collide' while passing in their own
      // lanes. For ambient traffic heading the opposite way, only a real lateral overlap (head-on / wrong lane) counts as contact.
      if ((a.ambient || b.ambient) && (a.dirx || 0) * (b.dirx || 0) + (a.diry || 0) * (b.diry || 0) < -0.3 && Math.abs(-dx * (a.diry || 0) + dy * (a.dirx || 0)) > (a.wid + b.wid) * LANE_PASS) continue;
      const push = Math.min(reach - d, 8), nx = dx / d, ny = dy / d, ma = a.remote ? 1e9 : a.parked ? 3 : 1, mb = b.remote ? 1e9 : b.parked ? 3 : 1;   // L6: a car another machine drives is immovable here (its own machine resolves its contacts)
      a.x -= nx * push * mb / (ma + mb); a.y -= ny * push * mb / (ma + mb); b.x += nx * push * ma / (ma + mb); b.y += ny * push * ma / (ma + mb);
      if (Math.abs(a.v - b.v) > 60) this.events.push({ t: this.time, kind: 'bump', a: a.model, b: b.model });
      // Palm City carsCollide: damage from the closing speed along the contact normal, shared
      // between the two cars; the one you're driving takes HERO of its share. Laurel convoy
      // rule: when BOTH cars are crew followers driving together, contact is convoy touch,
      // not demolition — HERO for both. (Measured: unscaled, a rally ground itself to 3
      // wrecks on follower-follower taps alone; the player can still total any car at full
      // Palm City numbers, and followers still wreck on real smashes.) Remote cars take no
      // damage here (L6: their own machine owns their state).
      const approach = ((a.dirx || 0) * a.v - (b.dirx || 0) * b.v) * nx + ((a.diry || 0) * a.v - (b.diry || 0) * b.v) * ny;
      if (approach > 45 && !this.kothBoost) {
        const amt = impactDamage(approach);
        if (amt > 0) {
          const convoy = a.follower && b.follower;
          if (!a.remote) this.hitCar(a, amt * 1.5 * 0.5 * ((a === this.player && !a.parked) || convoy ? HERO : 1), -nx, -ny);
          if (!b.remote) this.hitCar(b, amt * 1.5 * 0.5 * ((b === this.player && !b.parked) || convoy ? HERO : 1), nx, ny);
        }
      if (!a.remote) a.v *= 0.75; if (!b.remote) b.v *= 0.75;
      }
      // Cul-de-Sac King of the Hill: during a round, contacts are BUMPER cars — no damage (the
      // block above is skipped), headings glance off the contact axis, speed mostly kept.
      if (this.kothBoost && approach > -20) {
        for (const [c, tx, ty] of [[a, nx, ny], [b, -nx, -ny]]) {
          if (c.remote || c.parked) continue;
          const dot = (c.dirx || 0) * tx + (c.diry || 0) * ty;
          if (dot > -0.2) { const rx = c.dirx - 2 * dot * tx, ry = c.diry - 2 * dot * ty; c.h = Math.atan2(ry, rx); c.dirx = Math.cos(c.h); c.diry = Math.sin(c.h); c.v = Math.abs(c.v) * 0.92 + 18; }
        }
      }
    }
  }
}

// lf_climb.js — task L5, CLIMB THE ATHOLTON ROOF: heights for the on-foot player (lf_foot.js, Palm City's walker).
// Pure logic (the spec and main.js both call it); drawing is lf_roof.js. Data: data/roof.json (tools/roof_build.py) —
// Atholton's real OSM outline + courtyards, the climb chains, the roof kit.
//
//   const RF = new Roof(roofJson)        RF.support(x, y) -> { top, kind }   the highest surface under a point (units, 10/m)
//   stepOnFoot(F, dt, inp, RF)           Palm City's stepFoot, then heights: step / mantle / ledge grab / blocked / fall
//   lookout(F, RF, S, M)                 the closing-shot camera {x, y, zoom} while you are up on the roof
//   project(x, y, z, cam)                where a point at height z draws (GTA-2-style top-down perspective, shared with lf_roof.js)
//
// THE CLIMB VOCABULARY (Palm City's siege climbs at 2.2 m/s; the air is the speed-bump launch):
//   step up    <= 0.4 m             you just walk up it (kerbs, vents, pipes, the low parapet lip)
//   MANTLE     <= 2.0 m             push into it -> you haul yourself on top (dumpster, HVAC box, an AC unit, a planter)
//   LEDGE GRAB <= 4.4 m, roof only  push into the wall from a hold -> hang, pull over the parapet
//   anything taller is a wall: you stop (sliding along it), never an invisible one — every solid is drawn
//   off an edge: running -> a hop (BUMP.vz0) then fall under BUMP.g; land -> a roll if it was a real drop. No damage, ever.
import { stepFoot } from './lf_foot.js';
import { BUMP } from './lf_sim.js';

export const CLIMB = { up: 4, mantle: 20, grab: 44, rate: 22, hang: 0.3, hop: BUMP.vz0, g: BUMP.g, roll: 0.35, rollFrom: 25, runHop: 60 };
export const PERSP = { k: 300, min: 520 }; // camera height = max(k / zoom, min) world units: roofs lean away from the view centre ~15% at any zoom

const inside = (x, y, f) => {
  let c = false;
  for (let i = 0, n = f.length; i < n; i += 2) {
    const x1 = f[i], y1 = f[i + 1], x2 = f[(i + 2) % n], y2 = f[(i + 3) % n];
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

export class Roof {
  constructor(R) {
    this.R = R; this.h = R.h; this.name = R.name;
    this.boxes = [];
    for (const ch of R.chains) for (const b of ch.holds) this.boxes.push({ ...b, ca: Math.cos(b.a), sa: Math.sin(b.a) });
    for (const a of R.ac) this.boxes.push({ ...a, kind: 'ac', ca: Math.cos(a.a), sa: Math.sin(a.a) });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const O = R.outer;
    for (let i = 0; i < O.length; i += 2) { x0 = Math.min(x0, O[i]); x1 = Math.max(x1, O[i]); y0 = Math.min(y0, O[i + 1]); y1 = Math.max(y1, O[i + 1]); }
    this.bb = { x0: x0 - 60, y0: y0 - 60, x1: x1 + 60, y1: y1 + 60 };
  }
  inRoof(x, y) { return inside(x, y, this.R.outer) && !this.R.inner.some(r => inside(x, y, r)); }
  inBox(b, x, y) { const dx = x - b.x, dy = y - b.y; return Math.abs(dx * b.ca + dy * b.sa) < b.w / 2 && Math.abs(-dx * b.sa + dy * b.ca) < b.d / 2; }
  support(x, y) {
    const B = this.bb; if (x < B.x0 || x > B.x1 || y < B.y0 || y > B.y1) return { top: 0, kind: 'ground' };
    let s = this.inRoof(x, y) ? { top: this.h, kind: 'roof' } : { top: 0, kind: 'ground' };
    for (const b of this.boxes) if (b.top > s.top && this.inBox(b, x, y)) s = { top: b.top, kind: b.kind, box: b };
    return s;
  }
}

const ev = (F, kind) => { (F.events || (F.events = [])).push({ kind, t: F.t || 0 }); };

export function stepOnFoot(F, dt, inp, RF) {
  if (F.z == null) { F.z = 0; F.vz = 0; F.air = false; F.climb = null; F.land = 0; }
  F.t = (F.t || 0) + dt;
  if (F.climb) {                                         // hauling up: rise first, then roll over onto the top
    const c = F.climb; c.t += dt; const u = Math.min(1, c.t / c.dur), up = Math.min(1, u / 0.7), over = Math.max(0, (u - 0.7) / 0.3);
    F.z = c.z0 + (c.z1 - c.z0) * up * up * (3 - 2 * up); F.sup = over > 0 ? c.z1 : c.z0;
    F.x = c.x0 + (c.x1 - c.x0) * over; F.y = c.y0 + (c.y1 - c.y0) * over;
    F.walk += dt * 26; F.pose = [0, 1, 2, 1][Math.floor(F.walk / 9) % 4];
    if (u >= 1) { F.z = c.z1; F.climb = null; ev(F, c.kind); if (F.onClimb) F.onClimb(c); }
    return null;
  }
  if (F.air) {                                           // ballistic: you keep the line you left on (the bump rule)
    const px = F.x, py = F.y;
    F.x += F.avx * dt; F.y += F.avy * dt; F.z += F.vz * dt; F.vz -= CLIMB.g * dt; F.peak = Math.max(F.peak, F.z);
    let s = RF ? RF.support(F.x, F.y) : { top: 0 };
    if (s.top > F.z + CLIMB.up) { F.x = px; F.y = py; F.avx = F.avy = 0; s = RF.support(F.x, F.y); }   // flew into a wall on the way down: slide down it
    F.sup = s.top;
    if (F.z <= s.top) {
      F.z = s.top; F.air = false; F.vz = 0;
      if (F.peak - F.z > CLIMB.rollFrom) { F.land = CLIMB.roll; ev(F, 'land_roll'); } else ev(F, 'land');
    }
    F.pose = 2;
    return null;
  }
  if (F.land > 0) F.land -= dt;
  const x0 = F.x, y0 = F.y, r = stepFoot(F, dt, inp);
  if (!RF) { F.z = 0; return r; }
  let s = RF.support(F.x, F.y);
  if (s.top > F.z + CLIMB.up) {                          // something taller than a step is in the way
    const rise = s.top - F.z, pushing = Math.hypot(F.x - x0, F.y - y0) > 0.01 && !(F.punchT > 0);
    if (pushing && (rise <= CLIMB.mantle || (s.kind === 'roof' && rise <= CLIMB.grab))) {
      let k = 6, tx = F.x, ty = F.y;
      for (; k <= 40; k += 3) { tx = F.x + Math.cos(F.h) * k; ty = F.y + Math.sin(F.h) * k; if (RF.support(tx, ty).top === s.top) break; }
      if (k <= 40) {
        const grab = rise > CLIMB.mantle;
        F.climb = { kind: grab ? 'grab' : 'mantle', t: 0, dur: rise / CLIMB.rate + (grab ? CLIMB.hang : 0.15), z0: F.z, z1: s.top, x0, y0, x1: tx, y1: ty, onto: s.kind };
        F.x = x0; F.y = y0;
        return 'climb';
      }
    }
    const ok = (x, y) => RF.support(x, y).top <= F.z + CLIMB.up, mv = Math.hypot(F.x - x0, F.y - y0);
    const px = -Math.sin(F.h) * mv, py = Math.cos(F.h) * mv;            // blocked: slide along whichever axis is free,
    if (F.y !== y0 && ok(x0, F.y)) F.x = x0;                           // else round the corner you grazed (no sticky corners)
    else if (F.x !== x0 && ok(F.x, y0)) F.y = y0;
    else if (ok(x0 + px, y0 + py) && !ok(x0 - px, y0 - py)) { F.x = x0 + px; F.y = y0 + py; }
    else if (ok(x0 - px, y0 - py) && !ok(x0 + px, y0 + py)) { F.x = x0 - px; F.y = y0 - py; }
    else { F.x = x0; F.y = y0; }
    s = RF.support(F.x, F.y);
  }
  if (s.top < F.z - CLIMB.up) {                          // walked off an edge: airborne
    const vx = (F.x - x0) / dt, vy = (F.y - y0) / dt;
    F.air = true; F.vz = Math.hypot(vx, vy) > CLIMB.runHop ? CLIMB.hop : 0; F.avx = vx; F.avy = vy; F.peak = F.z; ev(F, 'leap');
  } else F.z = s.top;
  F.sup = F.air ? s.top : F.z;
  return r;
}

// where a point at height z draws, for a camera {x, y, zoom}: pushed away from the view centre by D / (D - z)
export function project(x, y, z, cam) {
  if (!z) return { x, y, k: 1 };
  const D = Math.max(PERSP.k / cam.zoom, PERSP.min), k = D / Math.max(D * 0.2, D - z);
  return { x: cam.x + (x - cam.x) * k, y: cam.y + (y - cam.y) * k, k };
}

// THE CLOSING SHOT: up on the roof, frame you + every burning car + (rally done) the whole parked convoy and your car,
// pulled back as far as that needs (never tighter than the street view), held a little toward the lot.
export function lookout(F, RF, S, M, view = { w: 420, h: 860 }) {
  const pts = [];
  for (const c of S.cars) { const p = S.roster.people.find(q => q.id === c.owner); if (p && p.car && (p.car.fx || []).includes('on_fire')) pts.push([c.x, c.y]); }
  if (M && M.complete) { pts.push([S.player.x, S.player.y]); for (const f of M.convoy) pts.push([f.car.x, f.car.y]); }
  let cam = { x: F.x, y: F.y, zoom: 0.62 };
  for (let it = 0; it < 4; it++) {                       // you draw where the perspective puts you: settle the frame on that
    const me = project(F.x, F.y, F.z, cam), all = [...pts, [me.x, me.y]];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const zoom = Math.max(0.3, Math.min(0.62, (view.w - 90) / Math.max(1, x1 - x0), (view.h - 300) / Math.max(1, y1 - y0)));
    // you are the foreground: hold your spot ~72% of the way down (looking OUT over the lot), unless that crops a car
    const top = 130 / zoom, half = view.h / 2 / zoom, want = me.y - 0.22 * view.h / zoom;
    cam = { x: (x0 + x1) / 2, y: Math.min(want, y0 - top + half), zoom };
    cam.y = Math.max(cam.y, y1 + 170 / zoom - half);
  }
  return cam;
}

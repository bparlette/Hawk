// lf_copgame.js — L17: the fake-cop mini game's SIREN, built on Palm City's own audio (games/palm-city/src/audio.js).
// The alt snapshot ported Palm City's siren recipe into a parallel Siren class; the live game instead drives the REAL Palm City `Audio`
// siren bus (the triangle swept by a 0.9 Hz LFO through a band-pass, `sirG`), with Palm City's own distance rule (audio.js update():
// gain 0.05 * (1 - d/1300) for the nearest siren car within 1200 u). Everything else in Audio (engine, city hum, sea) is muted —
// Laurel/Fulton has its own sound later. No audio context (node specs) = silent no-op.
//   const bus = new SirenBus();  bus.update(cars, focus, urgent)   // cars carry `fcSiren` (Palm City's `c.siren`, renamed so lf_cops never mistakes Kosack for police)
import { Audio } from '../../palm-city/src/audio.js';

export class SirenBus {
  constructor() { this.a = new Audio(); this.lfoHz = 0.9; this.level = 0; }
  update(cars, focus, urgent = false) {
    let near = 1e9; for (const p of cars) if (p.fcSiren) near = Math.min(near, Math.hypot(p.x - focus.x, p.y - focus.y));
    const on = near < 1200; this.level = on ? 0.05 * (1 - near / 1300) : 0;
    if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return;
    if (!this.a.ctx) { if (!on) return; try { this.a.start(); } catch (e) { return; } if (!this.a.ctx) return; this.a.cityG.gain.value = 0; this.a.seaG.gain.value = 0; }   // start() builds the whole bus: keep only the siren audible
    if (this.a.ctx.state === 'suspended') this.a.ctx.resume().catch(() => {});
    this.a.cityG.gain.value = 0; this.a.seaG.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.05);
    this.a.sirG.gain.setTargetAtTime(this.level, this.a.ctx.currentTime, 0.2);
  }
}

// ---- L17: CIVILIAN DRIVERS (ported from the alt's lf_copgame.js) ----------------------------------------------------------------------
// The live fake-cop traffic spawned nothing (it read segment fields the GraphWorld does not have) and, even fixed, drove straight till a
// dead end. These are real drivers: lf_pilot's road router to a random destination, a steady cruise, easing off behind any car ahead.
import { Pilot } from './lf_pilot.js';
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const CIV = { cruise: 165, near: 350, far: 1100 };
export class Civilians {
  constructor() { this.rnd = (() => { let s = 424242; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); }
  // one more civilian on a street vertex 35-110 m from you (never on top of a car); null if there is no room
  spawn(S, models, extra = {}) {
    const W = S.W, P = S.player, cand = [];
    for (const [v] of W.adj) { const q = W.verts[v], d = Math.hypot(q.x - P.x, q.y - P.y); if (d > CIV.near && d < CIV.far) cand.push(v); }
    for (let guard = 0; cand.length && guard++ < 30;) {
      const v = cand.splice(Math.floor(this.rnd() * cand.length), 1)[0], q = W.verts[v], e = (W.adj.get(v) || [])[0], nb = e && W.verts[e[0]];
      if (S.cars.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 90)) continue;
      const h = nb ? Math.atan2(nb.y - q.y, nb.x - q.x) : this.rnd() * TAU, m = models[Math.floor(this.rnd() * models.length)];
      const c = S.addCar(m, q.x, q.y, h, { traffic: true, ...extra }); c.v = CIV.cruise * 0.6;
      c.pilot = new Pilot({ player: c }, W, null); c.cruise = CIV.cruise * (0.9 + this.rnd() * 0.2); return c;
    }
    return null;
  }
  newDest(S, c) {
    const W = S.W, vs = []; for (const [v] of W.adj) { const q = W.verts[v], d = Math.hypot(q.x - c.x, q.y - c.y); if (d > 500 && d < 2400) vs.push(v); }
    if (!vs.length) return; const q = W.verts[vs[Math.floor(this.rnd() * vs.length)]]; c.pilot.plan(q.x, q.y, false);
  }
  // top: a speed cap (a hesitating driver); weave: steering wobble
  drive(S, c, dt, top = 0, weave = 0) {
    if (!c.pilot.pts || (c.pilot.pts.length && Math.hypot(c.pilot.pts[c.pilot.pts.length - 1][0] - c.x, c.pilot.pts[c.pilot.pts.length - 1][1] - c.y) < 140)) this.newDest(S, c);
    if (!c.pilot.pts) return;
    const inp = c.pilot.steer(dt), ta = Math.atan2(inp.jy, inp.jx), diff = inp.jm > 0.15 ? wrap(ta - c.h) : 0;
    const cruise = top ? Math.min(c.cruise, top) : c.cruise;
    let want = cruise * (1 - Math.min(0.6, Math.abs(diff) / 2.2)), blocked = false;
    if (!(c.nudgeT > 0)) for (const o of S.cars) { if (o === c || o.layer !== c.layer || o.parked) continue; const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy); if (d < 120 && Math.abs(wrap(Math.atan2(dy, dx) - c.h)) < 0.45) { want = Math.min(want, Math.max(0, o.v * 0.9 - (d < 60 ? 30 : 0))); blocked = true; } }
    c.waitT = blocked && c.v < 4 ? (c.waitT || 0) + dt : 0;                // two cars waiting on each other: after 2 s one noses through anyway
    if (c.nudgeT > 0) c.nudgeT -= dt; else if (c.waitT > 2) { c.nudgeT = 2.5; c.waitT = 0; }
    S.driveCar(c, c.v < want - 6 ? 1 : c.v > want + 10 ? -0.6 : 0, clamp(diff * 2.4 + weave, -1, 1), dt, cruise * 1.1);
  }
}

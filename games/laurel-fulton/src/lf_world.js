// lf_world.js — task L6, THE ONE WORLD: every crew member lives in it full-time as a CPU, and a friend TAKES OVER one in
// place (and hands back) at any moment, mid-drive included. Pure logic — the server (server/server.js) runs it 24/7;
// tools/spec_l6.mjs drives it directly.
//
//   const WD = new CrewWorld(W, roster, fleet, { bumps, seed })   all crew parked at home, every one a CPU
//   WD.step(dt)                                                   CPU crew live; human-driven cars are left alone
//   WD.takeover(id, who) -> state | null                          the car as it is RIGHT NOW (pos, heading, speed, air)
//   WD.drive(id, state)                                           the human's machine reports its car (it is authoritative)
//   WD.release(id)                                                back to the CPU, from exactly where it is
//   WD.snapshot()                                                 every crew car, compact
//
// THE CPU LIFE (no Palm City equivalent: Palm City's traffic is anonymous; its DRIVER is reused — lf_pilot's stick
// autopilot, the same input path a thumb uses): home (parked, a while) -> drive to somewhere real (a POI or another crew
// house) -> hang out -> drive home -> repeat. Lamar stays parked burning at the school (owner: his car is on fire).
import { LFSim } from './lf_sim.js';
import { Pilot } from './lf_pilot.js';

const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class CrewWorld {
  constructor(W, roster, fleet, opts = {}) {
    this.W = W; this.roster = roster; this.rnd = rngOf(opts.seed || 20261118);
    const S = this.S = new LFSim(W, roster, fleet, { spawn: { x: 0, y: 0 }, bumps: opts.bumps || [] });
    S.cars = S.cars.filter(c => c !== S.player); S.player = null;     // no local player on the server: everyone is crew
    this.places = Object.entries(W.G.anchors || {}).map(([k, a]) => ({ name: k, x: W.verts[a.v].x, y: W.verts[a.v].y }));
    this.crew = new Map();
    for (const c of S.cars) {
      const p = roster.people.find(q => q.id === c.owner); if (!p) continue;
      const still = (p.car.fx || []).includes('on_fire');                // a burning car does not go anywhere
      const B = { id: p.id, name: p.name, car: c, home: { x: c.x, y: c.y, h: c.h }, state: 'home', t: 2 + this.rnd() * (opts.firstWait ?? 40), still, human: null, trips: 0 };
      B.pilot = new Pilot({ player: c }, W, null);
      c.driveFn = (car, dt) => this.cpu(B, dt);
      this.crew.set(p.id, B);
    }
  }
  pick(B) {                                                // somewhere real: a POI, or another crew house
    const homes = [...this.crew.values()].filter(o => o !== B).map(o => ({ name: o.name, x: o.home.x, y: o.home.y }));
    const all = [...this.places, ...homes]; return all[Math.floor(this.rnd() * all.length)];
  }
  go(B, x, y) { B.car.parked = false; B.pilot.plan(x, y, true); B.dest = { x, y }; B.state = 'drive'; B.trips++; }
  cpu(B, dt) {
    const c = B.car;
    if (B.state === 'drive') {
      const end = B.pilot.pts[B.pilot.pts.length - 1];
      if (Math.hypot(end[0] - c.x, end[1] - c.y) < 170 && Math.abs(c.v) < 12) { B.state = B.back ? 'home' : 'stay'; B.t = 15 + this.rnd() * 45; c.v = 0; c.parked = true; return; }
      this.S.stickDrive(c, B.pilot.steer(dt), dt);
    }
  }
  step(dt) {
    for (const B of this.crew.values()) {
      if (B.human || B.still || B.state === 'drive') continue;
      if ((B.t -= dt) > 0) continue;
      if (B.state === 'home') { const d = this.pick(B); B.back = false; this.go(B, d.x, d.y); }
      else { B.back = true; this.go(B, B.home.x, B.home.y); }        // 'stay' is over: head home
    }
    this.S.step(dt, null);
  }
  state(c) { return { x: c.x, y: c.y, h: c.h, v: c.v, z: c.z || 0, vz: c.vz || 0, layer: c.layer, dirx: c.dirx ?? Math.cos(c.h), diry: c.diry ?? Math.sin(c.h) }; }
  takeover(id, who) {
    const B = this.crew.get(id); if (!B || B.human) return null;
    B.human = who; B.car.remote = true; B.car.parked = false;
    return this.state(B.car);
  }
  drive(id, st) {
    const B = this.crew.get(id); if (!B || !B.human) return;
    const c = B.car; for (const k of ['x', 'y', 'h', 'v', 'z', 'vz', 'layer']) if (Number.isFinite(st[k])) c[k] = st[k];
    c.dirx = Math.cos(c.h); c.diry = Math.sin(c.h);
  }
  release(id) {                                            // back to the CPU from wherever the human left it, still rolling
    const B = this.crew.get(id); if (!B || !B.human) return;
    B.human = null; B.car.remote = false;
    if (B.still) { B.car.parked = true; return; }
    const atHome = Math.hypot(B.car.x - B.home.x, B.car.y - B.home.y) < 200;
    if (atHome && Math.abs(B.car.v) < 20) { B.state = 'home'; B.t = 10 + this.rnd() * 30; B.car.parked = true; B.car.v = 0; return; }
    B.back = true; this.go(B, B.home.x, B.home.y);                // the character carries on: drives home from there
  }
  who() { return [...this.crew.values()].map(B => ({ id: B.id, name: B.name, human: B.human })); }
  snapshot() { return [...this.crew.values()].map(B => { const c = B.car; return [B.id, Math.round(c.x), Math.round(c.y), +c.h.toFixed(3), Math.round(c.v), Math.round(c.z || 0), c.layer, B.human || 0]; }); }   // [7] = the friend driving it, or 0 = CPU
}

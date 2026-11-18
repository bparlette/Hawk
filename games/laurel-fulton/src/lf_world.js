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
//   B.inside / B.spot  (L7 remainder, Nov 18)   a CPU who is HOME is not "just a parked car": if their house has an interior kit (opts.kits,
//                      data/interiors/<id>.json) they idle INSIDE — B.inside = 'brad', B.spot = the kit's cpuIdle {floor, x} (Brad: by the
//                      fire with a beer). It clears the moment they leave (drive, rally, a friend's takeover). In the snapshot as [8].
//
// THE CPU LIFE (no Palm City equivalent: Palm City's traffic is anonymous; its DRIVER is reused — lf_pilot's stick
// autopilot, the same input path a thumb uses): home (parked, a while) -> drive to somewhere real (a POI or another crew
// house) -> hang out -> drive home -> repeat. Lamar stays parked burning at the school (owner: his car is on fire).
import { LFSim } from './lf_sim.js';
import { Pilot } from './lf_pilot.js';
import { join, follow, pushTrail, reorder, players } from './lf_mission.js';

const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class CrewWorld {
  constructor(W, roster, fleet, opts = {}) {
    this.kits = opts.kits || {};
    this.W = W; this.roster = roster; this.rnd = rngOf(opts.seed || 20261118); this.autoRally = opts.autoRally ?? null; this.rally = null;
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
  // ---- THE RALLY IN THE ONE WORLD (L6): ANY crew member — CPU or a friend — can lead; housemates ride from the start;
  // whoever leads is followed by the crew they've collected, on the SAME follower logic as the solo rally (lf_mission.follow).
  // A friend taking over a CPU leader mid-rally just becomes the leader; a leader who leaves hands the lead back to the CPU.
  startRally(leaderId) {
    const L = this.crew.get(leaderId); if (!L || this.rally) return null;
    const S = this.S, R = this.rally = { leader: leaderId, M: { time: 0, stops: [], convoy: [], beat: null, complete: false, trail: { x: [], y: [], s: [] }, meet: this.roster.meetup, msg: '' }, msgT: 0, pilot: null };
    R.S2 = Object.create(S); R.S2.player = L.car; R.S2.driveCar = S.driveCar.bind(S);
    const me = this.roster.people.find(p => p.id === leaderId), key = (p) => p.house[0] + ',' + p.house[1], groups = new Map();
    for (const p of players(this.roster)) { if (p.id === leaderId || !this.crew.has(p.id)) continue; const k = key(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const [k, ppl] of groups) {
      const cars = ppl.map(p => this.crew.get(p.id).car);
      if (me && me.house && k === key(me)) { for (let i = 0; i < ppl.length; i++) this.enlist(R, ppl[i], cars[i]); continue; }
      const x = cars.reduce((a, c) => a + c.x, 0) / cars.length, y = cars.reduce((a, c) => a + c.y, 0) / cars.length, r = S.W.roadInfo(x, y, 0), kerb = r.e ? S.nearPt(x, y, r) : { x, y };
      R.M.stops.push({ x, y, kx: kerb.x, ky: kerb.y, people: ppl, cars, done: false });
    }
    L.rallying = true; pushTrail(R.M, L.car.x, L.car.y, true); this.setPilot(R); R.msg = 'RALLY THE CREW'; return R;
  }
  enlist(R, person, car) {
    const B = this.crew.get(person.id); if (!B || B.human) return;
    B.state = 'follow'; B.rallying = true; join(R.S2, R.M, person, car);
    const f = R.M.convoy[0]; const fn = car.driveFn; B.fn = fn; car.driveFn = (c, dt) => { if (B.human || R.M.complete) return; follow(R.S2, R.M, f, dt); };
  }
  setPilot(R) { const L = this.crew.get(R.leader); R.pilot = new Pilot(R.S2, this.W, R.M); L.pilot = R.pilot; }
  stepRally(dt) {
    const R = this.rally; if (!R) return; const M = R.M, L = this.crew.get(R.leader), P = L.car; M.time += dt; if (R.msgT > 0) R.msgT -= dt;
    R.S2.player = P; pushTrail(M, P.x, P.y); if ((R._ro = (R._ro || 0) + dt) > 0.5) { R._ro = 0; reorder(M); }
    if (!M.complete) for (const st of M.stops) {                    // pulled in slow at a crew house: they climb in behind you
      if (st.done || Math.min(Math.hypot(P.x - st.x, P.y - st.y), Math.hypot(P.x - st.kx, P.y - st.ky)) > 190 || Math.abs(P.v) > 45) continue;
      st.done = true; for (let i = 0; i < st.people.length; i++) this.enlist(R, st.people[i], st.cars[i]);
      R.msg = st.people.map(p => p.name.split(' ')[0]).join(' + ') + (st.people.length > 1 ? ' ARE IN' : ' IS IN'); R.msgT = 2.5; break;
    }
    if (!M.complete && M.stops.every(s => s.done)) {
      const [mx, my] = M.meet.pos;
      if (Math.hypot(P.x - mx, P.y - my) < 450 && Math.abs(P.v) < 30 && M.convoy.every(f => Math.hypot(f.car.x - mx, f.car.y - my) < 900)) {
        M.complete = true; R.msg = 'THE CREW IS ASSEMBLED'; R.msgT = 6; R.doneAt = M.time;
        for (const f of M.convoy) { f.car.v = 0; f.car.parked = true; } P.v = 0;
      }
    }
    if (M.complete && M.time - R.doneAt > 40) this.endRally();   // hang out 40 s, then everyone heads home
  }
  endRally() {
    const R = this.rally; if (!R) return; this.rally = null;
    for (const B of this.crew.values()) if (B.rallying) { B.rallying = false; B.pilot = new Pilot({ player: B.car }, this.W, null); B.car.driveFn = (c, dt) => this.cpu(B, dt); B.car.follower = false; if (!B.human && !B.still) { B.back = true; this.go(B, B.home.x, B.home.y); } }
    this.nextRally = this.S.time + 60 + this.rnd() * 120;
  }
  pick(B) {                                                // somewhere real: a POI, or another crew house
    const homes = [...this.crew.values()].filter(o => o !== B).map(o => ({ name: o.name, x: o.home.x, y: o.home.y }));
    const all = [...this.places, ...homes]; return all[Math.floor(this.rnd() * all.length)];
  }
  go(B, x, y) { B.car.parked = false; B.pilot.plan(x, y, true); B.dest = { x, y }; B.state = 'drive'; B.trips++; }
  cpu(B, dt) {
    const c = B.car;
    if (this.rally && this.rally.leader === B.id) return;      // the rally leader is driven by the rally pilot (step), once per tick
    if (B.state === 'drive') {
      const end = B.pilot.pts[B.pilot.pts.length - 1];
      if (Math.hypot(end[0] - c.x, end[1] - c.y) < 170 && Math.abs(c.v) < 12) { B.state = B.back ? 'home' : 'stay'; B.t = 15 + this.rnd() * 45; c.v = 0; c.parked = true; return; }
      let inp = B.pilot.steer(dt), yielded = false;
      for (const o of this.S.cars) {                          // a driver sees the car ahead: ease off, and stop short of it
        if (o === c || o.layer !== c.layer || o.parked || (B.yieldT || 0) > 4) continue; const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
        if (d < 140 && Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - c.h), Math.cos(Math.atan2(dy, dx) - c.h))) < 0.5 && (c.v > 40 || d < 70)) { inp = { jx: 0, jy: 0, jm: 0, keys: c.v > 10 ? { down: true } : {} }; if (d < 55) c.v = Math.min(c.v, 8); B.yieldT = (B.yieldT || 0) + dt; yielded = true; break; }
      }
      if (!yielded) B.yieldT = Math.max(0, (B.yieldT || 0) - dt * 2);
      this.S.stickDrive(c, inp, dt);
    }
  }
  step(dt) {
    for (const B of this.crew.values()) {
      if (B.human || B.still || B.state === 'drive' || B.rallying) continue;
      if ((B.t -= dt) > 0) continue;
      if (B.state === 'home') { const d = this.pick(B); B.back = false; this.go(B, d.x, d.y); }
      else { B.back = true; this.go(B, B.home.x, B.home.y); }        // 'stay' is over: head home
    }
    const R = this.rally, L = R && this.crew.get(R.leader);
    if (L && !L.human) { R.S2.player = L.car; L.car.parked = false; if (!R.pilot || L.pilot !== R.pilot) this.setPilot(R); this.S.stickDrive(L.car, R.pilot.input(dt), dt); }   // a CPU leader drives the rally on the stick autopilot
    this.S.step(dt, null); this.stepRally(dt); this.syncInside();
    if (!this.rally && this.autoRally && this.S.time > (this.nextRally ?? this.autoRally)) { const c = [...this.crew.values()].filter(B => !B.still && !B.human && B.state === 'home' && players(this.roster).some(p => p.id === B.id)); if (c.length) this.startRally(c[Math.floor(this.rnd() * c.length)].id); else this.nextRally = this.S.time + 30; }
  }
  // CPU crew at home with a kit are inside, idling at the kit's cpuIdle spot (and out the moment they are not home / not CPU / not free)
  syncInside() {
    for (const B of this.crew.values()) {
      const K = this.kits[B.id], ok = K && K.cpuIdle && B.state === 'home' && !B.human && !B.rallying && !B.still && B.car.parked;
      if (ok) { B.inside = B.id; B.spot = { floor: K.cpuIdle.floor, x: K.cpuIdle.x, doing: 'beer' }; } else { B.inside = null; B.spot = null; }
    }
  }
  state(c) { return { x: c.x, y: c.y, h: c.h, v: c.v, z: c.z || 0, vz: c.vz || 0, layer: c.layer, dirx: c.dirx ?? Math.cos(c.h), diry: c.diry ?? Math.sin(c.h) }; }
  takeover(id, who) {
    const B = this.crew.get(id); if (!B || B.human) return null;
    B.human = who; B.car.remote = true; B.car.parked = false; B.car.follower = false;
    if (!this.rally && !B.still && players(this.roster).some(p => p.id === id)) this.startRally(id);   // pick a crew member -> their rally starts (a friend leads their own)
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
    if (this.rally && this.rally.leader === id) { B.car.parked = false; this.setPilot(this.rally); return; }   // the leader left: the CPU keeps leading the rally from right there
    if (B.rallying) { B.state = 'follow'; B.car.parked = false; return; }
    if (B.still) { B.car.parked = true; return; }
    const atHome = Math.hypot(B.car.x - B.home.x, B.car.y - B.home.y) < 200;
    if (atHome && Math.abs(B.car.v) < 20) { B.state = 'home'; B.t = 10 + this.rnd() * 30; B.car.parked = true; B.car.v = 0; return; }
    B.back = true; this.go(B, B.home.x, B.home.y);                // the character carries on: drives home from there
  }
  rallyState() { const R = this.rally; return R ? { leader: R.leader, crew: R.M.convoy.length + 1, total: R.M.convoy.length + 1 + R.M.stops.filter(s => !s.done).reduce((a, s) => a + s.people.length, 0), msg: R.msgT > 0 ? R.msg : '', complete: R.M.complete } : null; }
  who() { return [...this.crew.values()].map(B => ({ id: B.id, name: B.name, human: B.human })); }
  snapshot() { return [...this.crew.values()].map(B => { const c = B.car; return [B.id, Math.round(c.x), Math.round(c.y), +c.h.toFixed(3), Math.round(c.v), Math.round(c.z || 0), c.layer, B.human || 0, B.inside ? [B.inside, B.spot.floor, +B.spot.x.toFixed(2)] : 0]; }); }   // [7] = the friend driving it, or 0 = CPU; [8] = [house, floor, x] while idling indoors, else 0
}

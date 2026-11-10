// World (car-league's World layer): owns the Matter engine, the bodies, the fixed step, car handling, the ball's
// heat and curve, power-ups, hazards and collision events. No DOM, no rendering, no clocks: one call to step()
// is exactly one 1/60 s tick, and every timer in here is a tick counter.
import { HZ } from './config.js';
import { CAT, createArena, createBall, createCar, goalZones } from './physics.js';
import { buildArena } from './arenas.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const STEP_MS = 1000 / HZ;

export class World {
  /** opts: { arena: id, surface: 'asphalt'|'ice'|'dirt' (default: the arena's own), hazards: { pads, pylons, tilt }, rand } */
  constructor(M, cfg, opts = {}) {
    this.M = M; this.cfg = cfg; this.rand = opts.rand || Math.random;
    this.arena = buildArena(opts.arena, cfg.rink.netDepth);
    this.surfaceName = cfg.surfaces[opts.surface] ? opts.surface : this.arena.surface; this.surface = cfg.surfaces[this.surfaceName];
    this.hazards = { pads: false, pylons: false, tilt: false, ...(opts.hazards || {}) };
    this.engine = M.Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, enableSleeping: false });
    this.engine.positionIterations = 8; this.engine.velocityIterations = 6;
    this.walls = createArena(M, cfg, this.arena);
    this.ball = { body: createBall(M, cfg, this.arena), px: 0, py: 0, pa: 0, stuck: 0, heat: 0, curve: 0, laser: 0, lastHit: -999, lastStrike: null, magnetBy: null };
    this.cars = []; this.zones = goalZones(cfg, this.arena);
    this.events = [];           // this tick: hits plus shunt / spin / flatten / pickup / item / shock / onetimer / pylon
    this._contacts = [];
    this.ticks = 0; this.live = false; this.tiltOn = false;
    this.stats = { shots: [0, 0], shunts: [0, 0], spinOuts: [0, 0], topSpeed: [0, 0] };
    this.boxes = this.arena.items.map(([x, y]) => ({ x, y, active: false })); this.itemTimer = cfg.items.first; this.itemPhase = 0;
    this.slicks = [];
    const py = cfg.hazards.pylons;
    this.pylons = this.arena.pylons.map(([x, y]) => ({ x, y, up: false, body: null }));
    this.sweepers = this.arena.sweepers.map((s) => ({ ...s, a: 0 })); this.tethers = []; this.pylonTimer = py.down; this.pylonsUp = false;
    M.Composite.add(this.engine.world, [...this.walls, this.ball.body]);
    M.Events.on(this.engine, 'collisionStart', (e) => this._onCollisions(e.pairs));
  }

  addCar(cls, team, x, y, angle) {
    const body = createCar(this.M, this.cfg, cls, x, y, angle);
    const car = { index: this.cars.length, team, clsName: cls, cls: this.cfg.classes[cls], body, spawn: { x, y, angle }, baseMass: body.mass,
      turbo: 1, turboOn: false, drafting: false, slip: 0, drift: false, throttle: 0, steer: 0, px: x, py: y, pa: angle,
      pitT: 0, pitAt: null, shuntHot: 0, shuntT: 0, shuntDir: 0, shuntCd: 0, spinT: 0, immune: 0, flatT: 0, item: null, magnetT: 0, windup: 0, cowT: 0, padT: 0, _shunt: 0, _use: false };
    body.plugin.bba.car = car;
    this.cars.push(car); this.M.Composite.add(this.engine.world, body);
    return car;
  }

  /** Put the ball on the centre spot and every car on its face-off spot (ice-bumpers resetPuck). */
  faceOff() {
    const B = this.M.Body, ball = this.ball;
    const spot = this.arena.kick[(this.faceOffs = (this.faceOffs || 0) + 1) % 2];
    B.setPosition(ball.body, { x: spot[0], y: spot[1] }); B.setVelocity(ball.body, { x: 0, y: 0 }); B.setAngularVelocity(ball.body, 0); B.setAngle(ball.body, 0);
    Object.assign(ball, { stuck: 0, heat: 0, curve: 0, laser: 0, lastStrike: null, magnetBy: null });
    for (const c of this.cars) {
      B.setPosition(c.body, { x: c.spawn.x, y: c.spawn.y }); B.setAngle(c.body, c.spawn.angle); B.setVelocity(c.body, { x: 0, y: 0 }); B.setAngularVelocity(c.body, 0);
      if (c.cowT > 0) { c.cowT = 0; B.setMass(c.body, c.baseMass); }
      Object.assign(c, { slip: 0, turboOn: false, drift: false, shuntT: 0, spinT: 0, flatT: 0, magnetT: 0, windup: 0, immune: 0, padT: 0, pitT: 0 });
    }
    this.slicks.length = 0; this.tethers.length = 0;
    this._snapshot();
  }

  _snapshot() {
    const b = this.ball.body; this.ball.px = b.position.x; this.ball.py = b.position.y; this.ball.pa = b.angle;
    for (const c of this.cars) { c.px = c.body.position.x; c.py = c.body.position.y; c.pa = c.body.angle; }
  }

  /** inputs[i] = { throttle, steer, turbo, brake, shunt: -1|0|1, use } for car i, or null to freeze that car. */
  step(inputs) {
    this.events.length = 0; this._contacts.length = 0; this.ticks++;
    this._snapshot();
    this._drafting();
    if (this.live) { this._boxes(); this._pylons(); }
    for (const c of this.cars) this._drive(c, inputs[c.index]);
    this._ballPre();
    this._fields();
    this._tethers();
    this.M.Engine.update(this.engine, STEP_MS);
    this._resolveContacts();
    this._sweep();
    if (this.live) this._pits();
    this._ballPost();
    if (this.live) this._pickupsAndSlicks();
    for (const c of this.cars) { // a hard ceiling on car speed (stacked shoves, pads and pulses must not launch anyone), then the top-speed stat
      const v = this.M.Body.getVelocity(c.body); let s = Math.hypot(v.x, v.y); const cap = this.cfg.car.hardCap;
      if (s > cap) { this.M.Body.setVelocity(c.body, { x: (v.x / s) * cap, y: (v.y / s) * cap }); s = cap; }
      if (this.live && s > this.stats.topSpeed[c.team]) this.stats.topSpeed[c.team] = s;
    }
  }

  // ---------------------------------------------------------------------------- cars
  // Handling. GameKart's recipe (throttle gated by measured forward speed, sideways speed bled off by a grip
  // factor that drops while drifting) with kfarr's steering maths (yaw rate scales with speed, flips in reverse),
  // but NOT kfarr's velocity pinning: we only ever add to the forward component and decay the sideways one,
  // so whatever a ram or a shunt put into the car stays in the car.
  _drive(car, inp) {
    const B = this.M.Body, b = car.body, c = car.cls, K = this.cfg.car, T = this.cfg.turbo, S = this.surface, I = this.cfg.items;
    const v = B.getVelocity(b), fx = Math.cos(b.angle), fy = Math.sin(b.angle);
    let vf = v.x * fx + v.y * fy, vl = -v.x * fy + v.y * fx;
    for (const k of ['slip', 'shuntCd', 'immune', 'padT', 'shuntHot']) if (car[k] > 0) car[k]--;
    if (car.shuntT > 0 && --car.shuntT === 0) car.shuntDir = 0;
    if (car.cowT > 0 && --car.cowT === 0) B.setMass(b, car.baseMass);
    if (car.magnetT > 0 && --car.magnetT === 0) this._releaseMagnet(car);
    if (car.windup > 0 && --car.windup === 0) this._shockwave(car);
    if (car.pitT > 0) { car.pitT--; B.setVelocity(b, { x: 0, y: 0 }); B.setAngularVelocity(b, 0); car.turboOn = false; car.throttle = 0; car.steer = 0; car._shunt = inp ? inp.shunt || 0 : 0; car._use = !!(inp && inp.use); return; } // fished out of a pit: sitting on its spot
    if (!inp) { // frozen for a face-off or a celebration (ice-bumpers disableCars)
      B.setVelocity(b, { x: v.x * 0.86, y: v.y * 0.86 }); B.setAngularVelocity(b, B.getAngularVelocity(b) * 0.8);
      car.turboOn = false; car.drift = false; car.throttle = 0; car.steer = 0; car._shunt = 0; car._use = false; return;
    }
    if (car.spinT > 0 || car.flatT > 0) { // spun out or flattened: no throttle, no steering, until it wears off
      if (car.spinT > 0) car.spinT--; if (car.flatT > 0) car.flatT--;
      vl -= vl * K.driftRate * S.grip; vf -= vf * 0.02;
      B.setVelocity(b, { x: fx * vf - fy * vl, y: fy * vf + fx * vl }); B.setAngularVelocity(b, B.getAngularVelocity(b) * (car.spinT > 0 ? 0.985 : 0.9));
      car.turboOn = false; car.drift = false; car.throttle = 0; car.steer = 0; car._shunt = inp.shunt || 0; car._use = !!inp.use; return;
    }
    const throttle = clamp(inp.throttle || 0, -1, 1); let steer = clamp(inp.steer || 0, -1, 1);
    car.throttle = throttle; car.steer = steer; car.drift = !!inp.brake;
    // lateral shunt: an instant sideways barge on the edge of the button
    const sh = inp.shunt || 0;
    if (sh && !car._shunt && car.shuntCd === 0 && this.live) { car.shuntT = this.cfg.shunt.ticks; car.shuntHot = 12; car.shuntDir = sh; car.shuntCd = this.cfg.shunt.cooldown; vl += sh * this.cfg.shunt.speed; this.stats.shunts[car.team]++; this.events.push({ type: 'shunt', car: car.index, dir: sh, x: b.position.x, y: b.position.y }); }
    car._shunt = sh;
    if (inp.use && !car._use && car.item && this.live) this._useItem(car);
    car._use = !!inp.use;
    // turbo: a regenerating meter; slipstreaming a teammate refills it faster
    if (inp.turbo && throttle > 0 && car.turbo > (car.turboOn ? 0 : T.minStart)) { car.turboOn = true; car.turbo = Math.max(0, car.turbo - 1 / T.drainTicks); }
    else { car.turboOn = false; car.turbo = Math.min(1, car.turbo + (car.drafting ? T.draftBonus : 1) / T.regenTicks); }
    const top = c.maxSpeed * S.top * (car.turboOn ? T.speed : 1) * (car.padT > 0 ? this.cfg.hazards.padPush.top : 1), acc = c.accel * S.accel * (car.turboOn ? T.accel : 1);
    if (throttle > 0) { if (vf < top) vf = Math.min(top, vf + acc * throttle); }
    else if (throttle < 0) { if (vf > 0.05) vf = Math.max(0, vf + c.brake * S.accel * throttle); else if (vf > -c.maxSpeed * K.reverse) vf += acc * 0.8 * throttle; }
    else vf -= vf * K.coast * S.coast;
    if (vf > top) vf -= (vf - top) * 0.04;                      // ease back down after turbo or a shove
    if (car.drift) vf -= vf * 0.012;
    const hold = car.slip > 0 ? K.slipFactor + (1 - K.slipFactor) * (1 - car.slip / K.slipTicks) : 1; // grip fades back in after a hit
    if (car.shuntT === 0) vl -= vl * Math.min(0.9, (car.drift ? K.driftRate * S.drift : K.gripRate * S.grip)) * hold;
    B.setVelocity(b, { x: fx * vf - fy * vl, y: fy * vf + fx * vl });
    if (car.magnetT > 0) steer *= I.magnet.steer;
    const speedF = Math.max(K.pivot, Math.min(1, Math.abs(vf) / (c.maxSpeed * 0.45)));
    const want = steer * c.turn * S.steer * (car.cowT > 0 ? I.cow.turn : 1) * speedF * (vf < -0.3 ? -1 : 1) * (car.drift ? K.driftTurn : 1);
    const w = B.getAngularVelocity(b);
    B.setAngularVelocity(b, w + (want - w) * K.steerResponse * hold);
  }

  /** GameKart's triggerSpinOut(), in ticks: yaw spin, speed cut, input lockout. */
  spinOut(car, by, turns = 1) {
    if (car.spinT > 0 || car.immune > 0) return false;
    const B = this.M.Body, S = this.cfg.spin, v = B.getVelocity(car.body);
    car.spinT = Math.round(S.ticks * turns); car.immune = car.spinT + S.immune; car.magnetT > 0 && this._releaseMagnet(car); car.magnetT = 0;
    B.setAngularVelocity(car.body, S.rate * (this.rand() < 0.5 ? -1 : 1)); B.setVelocity(car.body, { x: v.x * S.speedKeep, y: v.y * S.speedKeep });
    if (by && by.team !== car.team) this.stats.spinOuts[by.team]++;
    this.events.push({ type: 'spin', car: car.index, by: by ? by.index : null, x: car.body.position.x, y: car.body.position.y });
    return true;
  }

  // Slipstream: tucked in close behind your teammate, both moving, pointing the same way.
  _drafting() {
    const D = this.cfg.turbo.draft, B = this.M.Body;
    for (const c of this.cars) {
      c.drafting = false;
      for (const m of this.cars) {
        if (m === c || m.team !== c.team) continue;
        const mv = B.getVelocity(m.body), cv = B.getVelocity(c.body), ms = Math.hypot(mv.x, mv.y);
        if (ms < D.minSpeed || Math.hypot(cv.x, cv.y) < D.minSpeed) continue;
        const dx = c.body.position.x - m.body.position.x, dy = c.body.position.y - m.body.position.y, ux = mv.x / ms, uy = mv.y / ms;
        const behind = -(dx * ux + dy * uy), side = Math.abs(-dx * uy + dy * ux);
        if (behind > D.near && behind < D.far && side < D.lateral && Math.abs(wrap(c.body.angle - Math.atan2(uy, ux))) < D.maxAngle) c.drafting = true;
      }
    }
  }

  // ---------------------------------------------------------------------------- power-ups (GameKart ItemBox flow)
  _boxes() { // two boxes appear every 20 s, alternating between the top/bottom pair and the left/right pair
    if (--this.itemTimer > 0) return;
    this.itemTimer = this.cfg.items.period; const pair = this.itemPhase++ % 2 === 0 ? [0, 1] : [2, 3];
    this.boxes.forEach((b, i) => { b.active = pair.includes(i); });
    this.events.push({ type: 'boxes' });
  }
  _pickupsAndSlicks() {
    const I = this.cfg.items;
    for (const box of this.boxes) {
      if (!box.active) continue;
      for (const c of this.cars) {
        if (c.item || c.spinT > 0 || Math.hypot(c.body.position.x - box.x, c.body.position.y - box.y) > I.pickR) continue; // a distance check, as in the donor
        box.active = false; c.item = I.pool[Math.floor(this.rand() * I.pool.length)];
        this.events.push({ type: 'pickup', car: c.index, item: c.item, x: box.x, y: box.y }); break;
      }
    }
    for (const s of this.slicks) {
      s.t--;
      for (const c of this.cars) {
        if (c.index === s.by && s.age < I.oil.arm) continue;
        if (Math.hypot(c.body.position.x - s.x, c.body.position.y - s.y) < I.oil.r + 8) this.spinOut(c, this.cars[s.by], 1.35); // teammates included
      }
      s.age++;
    }
    this.slicks = this.slicks.filter((s) => s.t > 0);
  }
  _useItem(car) {
    const I = this.cfg.items, B = this.M.Body, b = car.body, item = car.item;
    if (item === 'harpoon' && !this._harpoon(car)) { this.events.push({ type: 'miss', car: car.index }); return; } // nothing in range: keep it
    car.item = null;
    if (item === 'magnet') car.magnetT = I.magnet.ticks;
    else if (item === 'shock') car.windup = I.shock.windup;
    else if (item === 'cow') { car.cowT = I.cow.ticks; B.setMass(b, car.baseMass * I.cow.mass); }
    else if (item === 'oil') this.slicks.push({ x: b.position.x - Math.cos(b.angle) * (car.cls.len / 2 + I.oil.r), y: b.position.y - Math.sin(b.angle) * (car.cls.len / 2 + I.oil.r), by: car.index, t: I.oil.ticks, age: 0 });
    this.events.push({ type: 'item', item, car: car.index, x: b.position.x, y: b.position.y });
  }
  _shockwave(car) { // air horn: a radial pulse that shoves every other car and the ball
    const S = this.cfg.items.shock, B = this.M.Body, p = car.body.position;
    const push = (body, k) => { const dx = body.position.x - p.x, dy = body.position.y - p.y, d = Math.hypot(dx, dy) || 1; if (d > S.radius) return; const f = k * (1 - 0.6 * d / S.radius), v = B.getVelocity(body); B.setVelocity(body, { x: v.x + (dx / d) * f, y: v.y + (dy / d) * f }); };
    for (const c of this.cars) if (c !== car) { push(c.body, S.car); if (Math.hypot(c.body.position.x - p.x, c.body.position.y - p.y) < S.radius) { c.slip = this.cfg.car.slipTicks; if (c.magnetT > 0) { c.magnetT = 0; this._releaseMagnet(c); } } }
    if (this.ball.magnetBy !== car) push(this.ball.body, S.ball);
    this.events.push({ type: 'shock', car: car.index, x: p.x, y: p.y, r: S.radius });
  }
  _releaseMagnet(car) {
    if (this.ball.magnetBy !== car) return;
    const B = this.M.Body, v = B.getVelocity(car.body); this.ball.magnetBy = null;
    B.setVelocity(this.ball.body, { x: v.x + Math.cos(car.body.angle) * 1.5, y: v.y + Math.sin(car.body.angle) * 1.5 });
  }

  // ---------------------------------------------------------------------------- hazards
  _pylons() { // bumper posts on a timer: up for 8 s, down for 8 s; a post waits if something is parked on its hatch
    if (!this.hazards.pylons) return;
    const P = this.cfg.hazards.pylons, M = this.M;
    if (--this.pylonTimer <= 0) { this.pylonsUp = !this.pylonsUp; this.pylonTimer = this.pylonsUp ? P.up : P.down; }
    for (const p of this.pylons) {
      if (this.pylonsUp && !p.up) {
        const blocked = [...this.cars.map((c) => c.body), this.ball.body].some((b) => Math.hypot(b.position.x - p.x, b.position.y - p.y) < P.r + P.clear);
        if (blocked) continue;
        p.body = M.Bodies.circle(p.x, p.y, P.r, { isStatic: true, label: 'pylon', restitution: 1, friction: 0, collisionFilter: { category: CAT.WALL, mask: CAT.BALL | CAT.CAR } });
        p.body.plugin.bba = { type: 'wall', name: 'pylon', kind: 'pylon' }; M.Composite.add(this.engine.world, p.body); p.up = true; this.events.push({ type: 'pylon', up: true, x: p.x, y: p.y });
      } else if (!this.pylonsUp && p.up) { M.Composite.remove(this.engine.world, p.body); p.body = null; p.up = false; this.events.push({ type: 'pylon', up: false, x: p.x, y: p.y }); }
    }
  }
  _fields() { // conveyor / speed pads along the side boards, and the final-minute floor tilt toward the goal mouths
    const B = this.M.Body, H = this.cfg.hazards, ball = this.ball.body;
    if (this.hazards.pads) for (const z of this.arena.pads) {
      const inside = (p) => p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1;
      for (const c of this.cars) if (inside(c.body.position)) { const v = B.getVelocity(c.body); c.padT = 30; B.setVelocity(c.body, { x: v.x + z.dir * H.padPush.car, y: v.y }); }
      if (inside(ball.position) && !this.ball.magnetBy) { const v = B.getVelocity(ball); B.setVelocity(ball, { x: v.x + z.dir * H.padPush.ball, y: v.y }); }
    }
    if (this.hazards.tilt && this.tiltOn) {
      const cx = this.arena.cx, pull = (body, k) => { const v = B.getVelocity(body); B.setVelocity(body, { x: v.x + Math.sign(body.position.x - cx) * k, y: v.y }); };
      if (!this.ball.magnetBy) pull(ball, H.tilt.ball); for (const c of this.cars) pull(c.body, H.tilt.car);
    }
  }

  // ---------------------------------------------------------------------------- ball
  _ballPre() {
    const B = this.M.Body, ball = this.ball, b = ball.body, H = this.cfg.heat, C = this.cfg.curve, I = this.cfg.items;
    b.frictionAir = this.cfg.ball.frictionAir * this.surface.ballAir * (ball.laser > 0 ? 0.25 : 1);
    if (ball.laser > 0) ball.laser--;
    const v = B.getVelocity(b), sp = Math.hypot(v.x, v.y);
    // english: a ball struck across its face keeps bending the same way, and loses the bend over time
    if (ball.curve && sp > 1 && ball.laser === 0) { const c = Math.cos(ball.curve), s = Math.sin(ball.curve); B.setVelocity(b, { x: v.x * c - v.y * s, y: v.x * s + v.y * c }); }
    ball.curve *= C.decay; if (Math.abs(ball.curve) < 0.0005) ball.curve = 0;
    // heat: dies when the ball stops, fades when it rolls free
    if (sp < H.stopSpeed) ball.heat = Math.max(0, ball.heat - 0.03); else if (this.ticks - ball.lastHit > H.freeTicks) ball.heat = Math.max(0, ball.heat - H.decay);
    // magnet grille: the ball rides the front bumper
    ball.magnetBy = null;
    for (const c of this.cars) {
      if (c.magnetT <= 0) continue;
      const fx = Math.cos(c.body.angle), fy = Math.sin(c.body.angle), px = c.body.position.x + fx * (c.cls.len / 2 + this.cfg.ball.r + 3), py = c.body.position.y + fy * (c.cls.len / 2 + this.cfg.ball.r + 3); // just clear of the bumper, so the held ball never shoves its own car
      const d = Math.hypot(b.position.x - px, b.position.y - py);
      if (d > (c.magnetLocked ? I.magnet.hold : I.magnet.grab)) { c.magnetLocked = false; continue; }
      const cv = B.getVelocity(c.body); c.magnetLocked = true; ball.magnetBy = c; ball.curve = 0;
      B.setVelocity(b, { x: cv.x + clamp((px - b.position.x) * 0.45, -9, 9), y: cv.y + clamp((py - b.position.y) * 0.45, -9, 9) });
      this.events.push({ type: 'hold', car: c.index });
      break;
    }
    for (const c of this.cars) if (c.magnetT <= 0) c.magnetLocked = false;
  }

  _onCollisions(pairs) {
    const B = this.M.Body;
    for (const p of pairs) {
      const A = p.bodyA.plugin.bba, Z = p.bodyB.plugin.bba; if (!A || !Z) continue;
      if (A.kind === 'lip' || Z.kind === 'lip') continue;
      const va = B.getVelocity(p.bodyA), vb = B.getVelocity(p.bodyB), n = p.collision.normal;
      const force = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y), s = p.collision.supports[0] || p.bodyA.position;
      const kind = [A.type, Z.type].sort().join('-'); // ball-car, ball-wall, car-car, car-wall
      this.events.push({ type: 'hit', kind, x: s.x, y: s.y, force, cars: [A.car, Z.car].filter(Boolean).map((c) => c.index), pylon: A.kind === 'pylon' || Z.kind === 'pylon' });
      // remember the moment of contact (velocities here are from before the solver acts)
      this._contacts.push({ kind, force, a: A, z: Z, bodyA: p.bodyA, bodyB: p.bodyB, va: { x: va.x, y: va.y }, vb: { x: vb.x, y: vb.y }, wa: B.getAngularVelocity(p.bodyA), wb: B.getAngularVelocity(p.bodyB) });
    }
  }

  _resolveContacts() {
    const B = this.M.Body, K = this.cfg.car, ball = this.ball;
    for (const c of this._contacts) {
      if (c.kind === 'ball-wall') { ball.curve *= this.cfg.curve.wallKeep; continue; }
      if (c.kind === 'car-wall') { const car = c.a.car || c.z.car; if (c.force > K.slipImpact) car.slip = K.slipTicks; continue; }
      if (c.kind === 'car-car') {
        const [A, Z] = [c.a.car, c.z.car];
        if (c.force > K.slipImpact) { A.slip = K.slipTicks; Z.slip = K.slipTicks; }
        this._tbone(A, Z, c.va, c.vb, c.force); this._tbone(Z, A, c.vb, c.va, c.force);
        continue;
      }
      const carFirst = c.a.type === 'car', car = carFirst ? c.a.car : c.z.car, cv = carFirst ? c.va : c.vb, bv = carFirst ? c.vb : c.va, cw = carFirst ? c.wa : c.wb;
      this._ballContact(car, cv, bv, cw, c.force);
    }
  }

  // T-bone: hit an opponent's flank or rear quarter at speed (a shunt, or a full-charge ram with your nose) and they spin out.
  _tbone(att, vic, va, vv, force) {
    const S = this.cfg.spin; if (att.team === vic.team) return;
    const dx = att.body.position.x - vic.body.position.x, dy = att.body.position.y - vic.body.position.y;
    const where = Math.abs(wrap(Math.atan2(dy, dx) - vic.body.angle));                 // 0 = victim's nose, pi = its tail
    if (where < S.flank) return;
    const nose = Math.abs(wrap(Math.atan2(-dy, -dx) - att.body.angle)) < 0.75, charge = nose && force >= S.chargeForce && Math.hypot(va.x, va.y) > Math.hypot(vv.x, vv.y);
    // shuntHot: the barge still counts for a few ticks after the shove itself ends
    if (att.shuntHot > 0 || charge) { if (vic.magnetT > 0) { vic.magnetT = 0; this._releaseMagnet(vic); } this.spinOut(vic, att); }
  }

  _ballContact(car, cv, bv, cw, force) {
    const B = this.M.Body, ball = this.ball, b = ball.body, H = this.cfg.heat, C = this.cfg.curve, O = this.cfg.oneTimer, I = this.cfg.items;
    if (ball.magnetBy === car) return;
    let nx = b.position.x - car.body.position.x, ny = b.position.y - car.body.position.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const carIn = cv.x * nx + cv.y * ny, ballIn = -(bv.x * nx + bv.y * ny), preSpeed = Math.hypot(bv.x, bv.y);
    const strike = carIn > 0.8 && carIn >= ballIn - 0.5;
    if (!strike) { // the ball came to the car. At full heat a front-on block gets flattened.
      const front = Math.abs(wrap(Math.atan2(ny, nx) - car.body.angle)) < 1.05;
      if (ball.heat >= 0.999 && ballIn >= H.blockForce && front && car.flatT === 0 && car.cowT === 0) {
        const s = preSpeed || 1; car.flatT = H.flatTicks; car.slip = this.cfg.car.slipTicks; B.setVelocity(car.body, { x: (bv.x / s) * H.knock, y: (bv.y / s) * H.knock });
        B.setVelocity(b, { x: bv.x * 0.55, y: bv.y * 0.55 }); ball.heat = 0.4;
        this.events.push({ type: 'flatten', car: car.index, x: car.body.position.x, y: car.body.position.y });
      }
      return;
    }
    // a strike: the bumper's punch (heavier classes, and the cowcatcher, hit harder)
    let v = B.getVelocity(b); const punch = force * car.cls.punch * (car.cowT > 0 ? I.cow.mass : 1);
    v = { x: v.x + nx * punch, y: v.y + ny * punch };
    if (this.ticks - ball.lastHit >= H.hitGap) {
      // kinetic heat: consecutive strikes on a ball that has not stopped speed it up 12.5% a hit
      if (preSpeed > H.stopSpeed) { ball.heat = Math.min(1, ball.heat + H.step); v.x *= 1 + H.boost; v.y *= 1 + H.boost; } else ball.heat = 0;
      // english: dragging the bumper across the ball bends the shot
      const tx = -ny, ty = nx, swipe = (cv.x - bv.x) * tx + (cv.y - bv.y) * ty + cw * d * 0.6;
      ball.curve = Math.abs(swipe) > C.minSwipe ? clamp(swipe * C.gain, -C.max, C.max) : 0;
      // one-timer: a teammate struck it less than 1.5 s ago -> +30% and a dead-straight shot
      const L = ball.lastStrike;
      if (L && L.team === car.team && L.car !== car.index && this.ticks - L.tick <= O.window) { v.x *= O.boost; v.y *= O.boost; ball.curve = 0; ball.laser = O.laserTicks; this.events.push({ type: 'onetimer', car: car.index, from: L.car, x: b.position.x, y: b.position.y }); }
      ball.lastStrike = { car: car.index, team: car.team, tick: this.ticks }; ball.lastHit = this.ticks;
      // a shot: struck firmly and on course for the far goal mouth
      const G = this.arena.goals[1 - car.team], dir = G.dir, sp = Math.hypot(v.x, v.y);
      if (v.x * dir > 3 && sp > 5) { const yAt = b.position.y + v.y * ((G.x - b.position.x) / v.x); if (Math.abs(yAt - G.y) < G.half + 30) this.stats.shots[car.team]++; }
      this.events.push({ type: 'strike', car: car.index, heat: ball.heat, curve: ball.curve });
    }
    B.setVelocity(b, v);
  }

  _ballPost() {
    const B = this.M.Body, ball = this.ball, b = ball.body, v = B.getVelocity(b), sp = Math.hypot(v.x, v.y);
    const max = this.cfg.ball.maxSpeed * (1 + this.cfg.heat.capBonus * ball.heat) * (ball.laser > 0 ? this.cfg.oneTimer.boost : 1);
    if (sp > max) B.setVelocity(b, { x: (v.x / sp) * max, y: (v.y / sp) * max });
    // ice-bumpers lets a puck sit pinned against a wall forever; here a dead ball near the boards rolls back in.
    const A = this.arena, off = Math.hypot(b.position.x - A.cx, b.position.y - A.cy);
    if (sp < 0.25 && off > 170 && !ball.magnetBy) ball.stuck++; else ball.stuck = 0;
    if (ball.stuck > this.cfg.ball.stuckTicks) { B.setVelocity(b, { x: ((A.cx - b.position.x) / off) * 3, y: ((A.cy - b.position.y) / off) * 3 }); ball.stuck = 0; }
  }

  // ---------------------------------------------------------------------------- landscape: pits, sweeping booms, harpoon lines
  _pits() { // a car that drives into a hole is fished out onto its own face-off spot (the ball is too big to fall in)
    const B = this.M.Body, A = this.arena;
    for (const p of A.pits) {
      for (const c of this.cars) {
        if (c.pitT > 0 || Math.hypot(c.body.position.x - p.x, c.body.position.y - p.y) > p.r - 8) continue;
        if (c.magnetT > 0) { c.magnetT = 0; this._releaseMagnet(c); } if (c.cowT > 0) { c.cowT = 0; B.setMass(c.body, c.baseMass); }
        c.pitT = 80; c.pitAt = { x: p.x, y: p.y, tick: this.ticks }; c.spinT = 0; c.flatT = 0; c.immune = 140;
        B.setPosition(c.body, { x: c.spawn.x, y: c.spawn.y }); B.setAngle(c.body, c.spawn.angle); B.setVelocity(c.body, { x: 0, y: 0 }); B.setAngularVelocity(c.body, 0);
        this.tethers = this.tethers.filter((t) => t.car !== c && t.target !== c);
        this.events.push({ type: 'pit', car: c.index, x: p.x, y: p.y });
      }
    }
  }
  _sweep() { // a boom arm turning about its pivot bats away whatever it meets
    const B = this.M.Body;
    for (const s of this.sweepers) {
      s.a += s.speed; const ux = Math.cos(s.a), uy = Math.sin(s.a);
      const hit = (body, rad, car) => {
        const px = body.position.x - s.x, py = body.position.y - s.y, u = Math.max(-s.len, Math.min(s.len, px * ux + py * uy)), qx = ux * u, qy = uy * u;
        let nx = px - qx, ny = py - qy; const d = Math.hypot(nx, ny), min = s.r + rad; if (d >= min || d < 1e-6) return; nx /= d; ny /= d;
        const v = B.getVelocity(body), rel = (v.x + uy * s.speed * u) * nx + (v.y - ux * s.speed * u) * ny; // closing speed against the moving arm
        B.setPosition(body, { x: s.x + qx + nx * min, y: s.y + qy + ny * min });
        if (rel < 0) { B.setVelocity(body, { x: v.x - 1.8 * rel * nx, y: v.y - 1.8 * rel * ny }); if (car && -rel > this.cfg.car.slipImpact) car.slip = this.cfg.car.slipTicks; if (-rel > 1.2) this.events.push({ type: 'hit', kind: car ? 'car-wall' : 'ball-wall', x: s.x + qx, y: s.y + qy, force: -rel, cars: car ? [car.index] : [] }); }
      };
      for (const c of this.cars) if (c.pitT === 0) hit(c.body, c.cls.wid / 2 + 6, c);
      if (!this.ball.magnetBy) hit(this.ball.body, this.cfg.ball.r, null);
    }
  }
  /** True when the straight line between two points is cut by a post: a pole, a rock, a goal post, a raised pylon. */
  lineBlocked(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, cut = (cx, cy, r) => { const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / l2)); return Math.hypot(x0 + dx * t - cx, y0 + dy * t - cy) < r; };
    return this.arena.blockers.some((b) => !b.pit && !b.soft && cut(b.x, b.y, b.r)) || this.pylons.some((p) => p.up && cut(p.x, p.y, this.cfg.hazards.pylons.r))
      || this.arena.goals.some((g) => cut(g.x, g.y - g.half, this.cfg.rink.postR + 2) || cut(g.x, g.y + g.half, this.cfg.rink.postR + 2));
  }
  _harpoon(car) { // snag the ball or an opponent in front of you; false if there is nothing to hit
    const H = this.cfg.items.harpoon, p = car.body.position, a = car.body.angle;
    const opts = [{ body: this.ball.body, target: 'ball' }, ...this.cars.filter((c) => c.team !== car.team && c.pitT === 0).map((c) => ({ body: c.body, target: c }))]
      .map((o) => ({ ...o, d: Math.hypot(o.body.position.x - p.x, o.body.position.y - p.y), off: Math.abs(wrap(Math.atan2(o.body.position.y - p.y, o.body.position.x - p.x) - a)) }))
      .filter((o) => o.d < H.range && o.off < H.cone && !this.lineBlocked(p.x, p.y, o.body.position.x, o.body.position.y)).sort((x, y) => x.d - y.d);
    if (!opts.length) return false;
    this.tethers.push({ car, target: opts[0].target, body: opts[0].body, rest: opts[0].d, t: H.ticks }); return true;
  }
  _tethers() { // the line reels in, drags its catch, and snaps the moment a post gets between the two ends
    const B = this.M.Body, H = this.cfg.items.harpoon;
    this.tethers = this.tethers.filter((t) => {
      const p = t.car.body.position, q = t.body.position, dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
      if (--t.t <= 0 || this.lineBlocked(p.x, p.y, q.x, q.y)) { this.events.push({ type: 'snap', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, cut: t.t > 0 }); return false; }
      t.rest = Math.max(H.minRest, t.rest * 0.985);
      if (d > t.rest) { const ball = t.target === 'ball', k = Math.min(ball ? 1.3 : 0.6, (d - t.rest) * (ball ? 0.03 : 0.012)), v = B.getVelocity(t.body), cv = B.getVelocity(t.car.body);
        B.setVelocity(t.body, { x: v.x + (dx / d) * k, y: v.y + (dy / d) * k }); B.setVelocity(t.car.body, { x: cv.x - (dx / d) * k * (ball ? 0.08 : 0.35), y: cv.y - (dy / d) * k * (ball ? 0.08 : 0.35) });
        if (ball) this.events.push({ type: 'hold', car: t.car.index }); }
      return true;
    });
  }

  /** Which net is the ball in, if any. */
  ballInNet() {
    const p = this.ball.body.position;
    return this.zones.find((z) => p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1) || null;
  }
}

// race.js — checkpoints, finish, respawn, and the autopilot. Shared by the game and the headless sim.
export class Race {
  constructor(THREE, track) {
    this.T = THREE; this.track = track;
    this.cps = track.gates.filter((g) => g.kind === 'cp');
    this.finish = track.gates.find((g) => g.kind === 'finish') || track.gates.find((g) => g.kind === 'start');
    this.circuit = !track.gates.some((g) => g.kind === 'finish');
    this._d = new Map(); this.reset();
  }
  reset() { this.taken = new Set(); this.order = []; this.splits = []; this.done = false; this.lastCp = null; this.lastCpVel = 0; this._d.clear(); }
  gateFrame(g, back = 0, lift = 0.75) { // spawn pose at a gate
    const T = this.T, p = new T.Vector3(g.p[0] - g.f[0] * back + g.u[0] * lift, g.p[1] - g.f[1] * back + g.u[1] * lift, g.p[2] - g.f[2] * back + g.u[2] * lift);
    const m = new T.Matrix4().makeBasis(new T.Vector3(-g.s[0], -g.s[1], -g.s[2]), new T.Vector3(g.u[0], g.u[1], g.u[2]), new T.Vector3(g.f[0], g.f[1], g.f[2]));
    return { p, q: new T.Quaternion().setFromRotationMatrix(m), f: new T.Vector3(g.f[0], g.f[1], g.f[2]) };
  }
  spawn() { const st = this.track.start || this.track.gates[0]; return this.gateFrame(st, 3.2); }
  // call once per fixed tick with the car position and current race time. Returns events array (reused).
  update(pos, speed, time, ev) {
    ev.length = 0; if (this.done) return ev;
    for (const g of this.track.gates) {
      const rx = pos.x - g.p[0], ry = pos.y - g.p[1], rz = pos.z - g.p[2];
      const d = rx * g.f[0] + ry * g.f[1] + rz * g.f[2], lat = rx * g.s[0] + ry * g.s[1] + rz * g.s[2], up = rx * g.u[0] + ry * g.u[1] + rz * g.u[2];
      const pd = this._d.has(g) ? this._d.get(g) : d; this._d.set(g, d);
      if (!(pd < 0 && d >= 0 && Math.abs(lat) < g.hw + 0.5 && up > -1.5 && up < g.ph + 1)) continue;
      if (g.kind === 'cp' && !this.taken.has(g)) {
        this.taken.add(g); this.order.push(g); this.splits.push(time); this.lastCp = g; this.lastCpVel = speed;
        ev.push({ type: 'cp', gate: g, n: this.taken.size, of: this.cps.length, time });
      } else if (g === this.finish) {
        if (this.taken.size === this.cps.length && (!this.circuit || time > 3)) { this.done = true; ev.push({ type: 'finish', time }); }
        else if (time > 1) ev.push({ type: 'missing', n: this.cps.length - this.taken.size });
      }
    }
    return ev;
  }
  respawnPose() { return this.lastCp ? this.gateFrame(this.lastCp, -1.5) : this.spawn(); }
}

// Autopilot: follows the track centre line with a speed plan. Used for the attract mode and to time the author medal.
export class Autopilot {
  constructor(THREE, track, opts = {}) {
    this.T = THREE; this.line = track.line; this.i = 0; this.o = Object.assign({ look: 2.5, lookV: 0.2, gain: 1, kc: 2.2, lane: 0 }, opts);
    const n = this.line.length; this.vmax = new Float32Array(n);
    // speed plan from curvature (+ piece hints)
    for (let i = 0; i < n; i++) {
      const L = this.line[i]; let v = 70;
      if (L.type === 'turn') v = this.o.vTurn ?? 13.5;
      if (L.type === 'bank') v = this.o.vBank ?? 27;
      this.vmax[i] = v;
    }
    // backwards pass: braking envelope
    const dec = this.o.dec ?? 16;
    for (let pass = 0; pass < 2; pass++) for (let k = n * 2; k > 0; k--) {
      const i = k % n, j = (k + 1) % n; const a = this.line[i].p, b = this.line[j].p;
      const ds = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (ds > 30) continue;
      this.vmax[i] = Math.min(this.vmax[i], Math.sqrt(this.vmax[j] ** 2 + 2 * dec * ds));
    }
    this._t = new THREE.Vector3(); this._l = new THREE.Vector3(); this._f = new THREE.Vector3(); this.out = { throttle: 0, brake: 0, steer: 0 };
  }
  reset() { this.i = 0; }
  drive(car) {
    const L = this.line, n = L.length, p = car.pos; let bi = this.i, bd = 1e9;
    for (let k = -4; k < 40; k++) { const i = (this.i + k + n) % n, q = L[i].p; const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    if (bd > 400) { for (let i = 0; i < n; i++) { const q = L[i].p; const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } } }
    this.i = bi;
    // Stanley-style steering in the road's own frame (works upside down in the loop)
    const v = car.vel.length(), la = this.o.look + v * this.o.lookV;
    let j = bi, acc = 0; while (acc < la) { const a = L[j].p, b = L[(j + 1) % n].p; const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (d > 30) break; acc += d; j = (j + 1) % n; if (j === bi) break; }
    const tp = L[j], cp = L[bi], lane = this.o.lane;
    const left = this._l.set(1, 0, 0).applyQuaternion(car.quat), fwd = this._f.set(0, 0, 1).applyQuaternion(car.quat);
    // heading error: road tangent vs car forward, measured about the car's up (sign from the left axis)
    const fu = tp.f[0] * cp.u[0] + tp.f[1] * cp.u[1] + tp.f[2] * cp.u[2]; // drop the part that bends along the road normal (loop)
    const hx = tp.f[0] - cp.u[0] * fu, hy = tp.f[1] - cp.u[1] * fu, hz = tp.f[2] - cp.u[2] * fu;
    const head = Math.atan2(hx * left.x + hy * left.y + hz * left.z, Math.max(0.05, hx * fwd.x + hy * fwd.y + hz * fwd.z));
    const ex = p.x - (cp.p[0] + cp.s[0] * lane), ey = p.y - (cp.p[1] + cp.s[1] * lane), ez = p.z - (cp.p[2] + cp.s[2] * lane);
    const cross = ex * cp.s[0] + ey * cp.s[1] + ez * cp.s[2]; // + = car is right of the line
    const ang = head + Math.atan2(this.o.kc * cross, Math.max(4, v)); this.dbg = cross.toFixed(2) + " h" + head.toFixed(2); // + angle = need to turn left
    const sMax = car.cfg.steerMax / (1 + Math.max(0, car.fwdSpeed) / car.cfg.steerFalloff);
    let steer = -ang / sMax * this.o.gain; steer = Math.max(-1, Math.min(1, steer));
    let vt = this.vmax[bi]; for (let k = 1; k < 6; k++) vt = Math.min(vt, this.vmax[(bi + k) % n]);
    const o = this.out; o.steer = steer;
    if (car.grounded === 0) { o.throttle = 0.5; o.brake = 0; o.steer = 0; // keep the nose level in the air
      const up = this._t.set(0, 1, 0).applyQuaternion(car.quat), pitch = fwd.y; o.throttle = pitch > 0.12 ? 1 : 0; o.brake = pitch < -0.25 ? 1 : 0; }
    else if (v > vt + 1.5) { o.throttle = 0; o.brake = Math.min(1, (v - vt) / 6); }
    else { o.throttle = v < vt - 0.5 ? 1 : 0.4; o.brake = 0; }
    return o;
  }
}

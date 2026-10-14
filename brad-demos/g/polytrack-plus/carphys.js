// carphys.js — reusable raycast-suspension car (fixed timestep). No scene / render code in here.
// Hark, 2026. Free to borrow inside Brad's demos (vanzombie etc).
//
//   import { RaycastCar } from './carphys.js';
//   const car = new RaycastCar(THREE, { ...overrides });
//   car.reset(position, quaternion);
//   car.step(1 / 60, { throttle: 0..1, brake: 0..1, steer: -1..1 (+ = right) }, world);
//
// world must provide (TriGrid in track.js does):
//   raycast(ox,oy,oz, dx,dy,dz, maxT, hit) -> bool   front faces only; fills hit.t, hit.nx/ny/nz
//   sphere(cx,cy,cz, r, cb)                          cb(nx,ny,nz, depth) per penetration
//
// Body frame: +z forward, +y up, +x = driver's LEFT (three.js right-handed). Mass is 1, so forces are accelerations.
// Each step runs `substeps` fixed sub-steps (default 2 -> 120 Hz). Everything is allocation-free per step.
export const CAR_DEFAULTS = {
  gravity: 18, substeps: 2,
  wheels: [ // body-space mount points (top of suspension travel)
    { x: 0.86, y: -0.02, z: 1.32, front: true }, { x: -0.86, y: -0.02, z: 1.32, front: true },
    { x: 0.88, y: -0.02, z: -1.26, front: false }, { x: -0.88, y: -0.02, z: -1.26, front: false },
  ],
  rest: 0.42, radius: 0.37, spring: 44, damper: 5.2, maxSpring: 900, bump: 2600, bumpStart: 0.26, // progressive bump stop for loops / big landings
  engine: 17, topSpeed: 56, reverse: 9, reverseTop: 14, brake: 30, rolling: 0.25, drag: 0.0009,
  grip: 1.9, slideGrip: 1.5, latStiff: 13, longGrip: 1.7,
  steerMax: 0.62, steerFalloff: 23, steerRate: 9, steerReturn: 13,
  downforce: 0.006, rollHeight: 0.75,
  inertia: [1.9, 2.1, 1.1], angDampGround: 1.4, angDampAir: 0.5,
  airPitch: 5.5, airYaw: 4.2, airRoll: 0, // air control torques (rad/s^2)
  body: { r: 0.3, pts: [[0.74, 0.28, 1.8], [-0.74, 0.28, 1.8], [0.74, 0.28, -1.8], [-0.74, 0.28, -1.8],
    [0.68, 0.72, 0.8], [-0.68, 0.72, 0.8], [0.68, 0.72, -1.1], [-0.68, 0.72, -1.1], [0, 0.95, -0.2], [0, 0.3, 2.0], [0, 0.3, -2.0], [0, 0.12, 0]] },
  restitution: 0.12, wallFriction: 0.35,
};

export class RaycastCar {
  constructor(THREE, opts = {}) {
    this.T = THREE; const c = this.cfg = Object.assign({}, CAR_DEFAULTS, opts);
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.vel = new THREE.Vector3(); this.ang = new THREE.Vector3();
    this.wheels = c.wheels.map((w) => ({ mount: new THREE.Vector3(w.x, w.y, w.z), front: w.front, contact: false, wasContact: false, len: c.rest + c.radius,
      comp: 0, hit: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0), spin: 0, spinV: 0, steer: 0, slip: 0, load: 0 }));
    this.steer = 0; this.grounded = 0; this.airTime = 0; this.slip = 0; this.scrape = 0; this.impact = 0; this.landing = 0; this.speed = 0; this.fwdSpeed = 0;
    this.sliding = false;
    // scratch
    this._ax = new THREE.Vector3(); this._ay = new THREE.Vector3(); this._az = new THREE.Vector3();
    this._F = new THREE.Vector3(); this._Tq = new THREE.Vector3(); this._p = new THREE.Vector3(); this._r = new THREE.Vector3();
    this._v = new THREE.Vector3(); this._f = new THREE.Vector3(); this._s = new THREE.Vector3(); this._t = new THREE.Vector3(); this._t2 = new THREE.Vector3();
    this._m = new THREE.Matrix3(); this._q = new THREE.Quaternion(); this._hit = { t: 0, nx: 0, ny: 0, nz: 0 };
    this._cn = new THREE.Vector3(); this._cd = 0; this._ccount = 0;
  }
  reset(p, q, v) {
    this.pos.copy(p); this.quat.copy(q); this.vel.set(0, 0, 0); if (v) this.vel.copy(v); this.ang.set(0, 0, 0); this.steer = 0; this.airTime = 0;
    for (const w of this.wheels) { w.contact = w.wasContact = false; w.comp = 0; w.spinV = 0; w.len = this.cfg.rest + this.cfg.radius; w.slip = 0; }
    this.impact = this.landing = this.scrape = this.slip = 0; this.sliding = false;
  }
  axes() { // body axes into _ax/_ay/_az
    const m = this._m.setFromMatrix4 ? null : null; // (kept simple)
    this._ax.set(1, 0, 0).applyQuaternion(this.quat); this._ay.set(0, 1, 0).applyQuaternion(this.quat); this._az.set(0, 0, 1).applyQuaternion(this.quat);
  }
  // world-space inverse inertia applied to vector v (in place)
  _iinv(v) {
    const I = this.cfg.inertia, ax = this._ax, ay = this._ay, az = this._az;
    const x = v.dot(ax) / I[0], y = v.dot(ay) / I[1], z = v.dot(az) / I[2];
    return v.set(ax.x * x + ay.x * y + az.x * z, ax.y * x + ay.y * y + az.y * z, ax.z * x + ay.z * y + az.z * z);
  }
  _applyAt(px, py, pz, fx, fy, fz) { // force at world point
    this._F.x += fx; this._F.y += fy; this._F.z += fz;
    const rx = px - this.pos.x, ry = py - this.pos.y, rz = pz - this.pos.z;
    this._Tq.x += ry * fz - rz * fy; this._Tq.y += rz * fx - rx * fz; this._Tq.z += rx * fy - ry * fx;
  }
  step(dt, inp, world) {
    const c = this.cfg, n = c.substeps, h = dt / n;
    this.impact = 0; this.landing = 0; this.scrape = 0; let slipMax = 0;
    // steering (smoothed, speed-sensitive)
    const sp = this.vel.length();
    const sMax = c.steerMax / (1 + Math.max(0, this.fwdSpeed) / c.steerFalloff);
    const target = -(inp.steer || 0) * sMax; // + steer = right = towards -x
    const rate = Math.abs(target) < Math.abs(this.steer) ? c.steerReturn : c.steerRate;
    this.steer += (target - this.steer) * (1 - Math.exp(-rate * dt));
    for (let k = 0; k < n; k++) slipMax = Math.max(slipMax, this._sub(h, inp, world));
    this.slip = slipMax; this.speed = this.vel.length();
    this.axes(); this.fwdSpeed = this.vel.dot(this._az);
    for (const w of this.wheels) { w.spin += w.spinV * dt; w.steer = w.front ? this.steer : 0; }
    if (this.grounded) this.airTime = 0; else this.airTime += dt;
    return this;
  }
  _sub(h, inp, world) {
    const c = this.cfg, hit = this._hit; this.axes();
    const ax = this._ax, ay = this._ay, az = this._az, F = this._F.set(0, -c.gravity, 0), Tq = this._Tq.set(0, 0, 0);
    const maxLen = c.rest + c.radius; let grounded = 0, slipMax = 0;
    const thr = Math.max(0, Math.min(1, inp.throttle || 0)), brk = Math.max(0, Math.min(1, inp.brake || 0));
    const vF = this.vel.dot(az);
    for (const w of this.wheels) {
      const p = this._p.copy(w.mount).applyQuaternion(this.quat).add(this.pos);
      w.wasContact = w.contact;
      if (world.raycast(p.x, p.y, p.z, -ay.x, -ay.y, -ay.z, maxLen, hit)) {
        w.contact = true; grounded++;
        const len = hit.t, comp = maxLen - len; w.n.set(hit.nx, hit.ny, hit.nz);
        w.hit.set(p.x - ay.x * len, p.y - ay.y * len, p.z - ay.z * len);
        // point velocity
        const r = this._r.subVectors(w.hit, this.pos), v = this._v.crossVectors(this.ang, r).add(this.vel);
        const vUp = v.dot(ay);
        if (!w.wasContact && vUp < -3) this.landing = Math.max(this.landing, -vUp);
        const bs = Math.max(0, comp - c.bumpStart);
        let fs = c.spring * comp + c.bump * bs * bs - c.damper * vUp * (1 + bs * 6); fs = Math.max(0, Math.min(c.maxSpring, fs));
        w.comp = comp; w.len = len; w.load = fs;
        // contact frame: forward projected onto surface plane
        const nn = w.n, f = this._f.copy(az);
        if (w.front && w.steer !== 0) f.applyAxisAngle(ay, w.steer);
        f.addScaledVector(nn, -f.dot(nn)).normalize();
        const s = this._s.crossVectors(nn, f); // driver's left
        const vl = v.dot(f), vs = v.dot(s);
        // longitudinal
        let fl = 0;
        if (thr > 0 && vl > -1) fl += thr * c.engine * Math.max(0, 1 - (Math.max(0, vl) / c.topSpeed) ** 2) / 4;
        if (brk > 0) { if (vl > 1) fl -= brk * c.brake / 4; else if (vl > -c.reverseTop) fl -= brk * c.reverse / 4; }
        if (thr > 0 && vl < -1) fl += thr * c.brake / 4; // gas while rolling backwards = brake
        fl -= Math.sign(vl) * Math.min(Math.abs(vl), c.rolling) * 0.25;
        // lateral (kill sideways velocity, limited by grip)
        let fsd = -vs * c.latStiff / 4 * 4; // latStiff is per car
        fsd /= 4;
        const mu = (this.sliding ? c.slideGrip : c.grip) * fs, muL = c.longGrip * fs;
        if (Math.abs(fl) > muL) fl = Math.sign(fl) * muL;
        const tot = Math.hypot(fl * 0.6, fsd);
        let sl = 0; if (tot > mu && tot > 1e-6) { const k = mu / tot; fsd *= k; fl *= Math.min(1, k * 1.4); sl = Math.abs(vs); }
        w.slip = sl; slipMax = Math.max(slipMax, sl);
        w.spinV = vl / c.radius;
        // apply: suspension along body up at the hit point; tyre forces lifted towards the centre of mass (less roll)
        const lift = r.dot(ay) * c.rollHeight;
        const px = w.hit.x - ay.x * lift, py = w.hit.y - ay.y * lift, pz = w.hit.z - ay.z * lift;
        this._applyAt(w.hit.x, w.hit.y, w.hit.z, ay.x * fs, ay.y * fs, ay.z * fs);
        this._applyAt(px, py, pz, f.x * fl + s.x * fsd, f.y * fl + s.y * fsd, f.z * fl + s.z * fsd);
      } else { w.contact = false; w.comp = 0; w.len = maxLen; w.load = 0; w.slip = 0; w.spinV *= 0.995; if (thr > 0) w.spinV += 60 * h; }
    }
    this.grounded = grounded;
    this.sliding = slipMax > (this.sliding ? 2.0 : 4.0);
    const sp2 = this.vel.lengthSq();
    if (grounded >= 2) F.addScaledVector(ay, -c.downforce * sp2);
    F.addScaledVector(this.vel, -c.drag * Math.sqrt(sp2));
    // air control (direct angular acceleration in body axes)
    const angAcc = this._t.set(0, 0, 0);
    if (grounded === 0) {
      const pitch = (thr - brk) * c.airPitch, yaw = -(inp.steer || 0) * c.airYaw, roll = (inp.roll || 0) * c.airRoll;
      angAcc.addScaledVector(ax, pitch).addScaledVector(ay, yaw).addScaledVector(az, roll);
    }
    // integrate
    this.vel.addScaledVector(F, h);
    this._iinv(Tq); this.ang.addScaledVector(Tq, h).addScaledVector(angAcc, h);
    this.ang.multiplyScalar(Math.exp(-(grounded ? c.angDampGround : c.angDampAir) * h));
    this.pos.addScaledVector(this.vel, h);
    const q = this._q.set(this.ang.x * h * 0.5, this.ang.y * h * 0.5, this.ang.z * h * 0.5, 0).multiply(this.quat);
    this.quat.x += q.x; this.quat.y += q.y; this.quat.z += q.z; this.quat.w += q.w; this.quat.normalize();
    this._body(world);
    return slipMax;
  }
  // chassis spheres vs world: positional push-out + impulse with friction
  _body(world) {
    const c = this.cfg, b = c.body; this.axes();
    for (let i = 0; i < b.pts.length; i++) {
      const lp = b.pts[i];
      const p = this._p.set(lp[0], lp[1], lp[2]).applyQuaternion(this.quat).add(this.pos);
      this._ccount = 0; this._cn.set(0, 0, 0); this._cd = 0;
      world.sphere(p.x, p.y, p.z, b.r, (nx, ny, nz, d) => { if (d > this._cd) { this._cd = d; this._cn.set(nx, ny, nz); } this._ccount++; });
      if (!this._ccount) continue;
      const nrm = this._cn, depth = this._cd;
      this.pos.addScaledVector(nrm, depth * 0.85);
      const r = this._r.subVectors(p, this.pos), v = this._v.crossVectors(this.ang, r).add(this.vel);
      const vn = v.dot(nrm); if (vn >= 0) continue;
      // effective mass along n
      const rn = this._t.crossVectors(r, nrm); this._iinv(rn); const k = 1 + this._t2.crossVectors(rn, r).dot(nrm);
      const j = -(1 + c.restitution) * vn / k;
      const tng = this._s.copy(v).addScaledVector(nrm, -vn); const vt = tng.length();
      this.vel.addScaledVector(nrm, j); this._applyImpulse(r, nrm, j);
      if (vt > 1e-3) { tng.multiplyScalar(-1 / vt); const jt = Math.min(vt / k, c.wallFriction * j); this.vel.addScaledVector(tng, jt); this._applyImpulse(r, tng, jt); }
      this.impact = Math.max(this.impact, -vn); this.scrape = Math.max(this.scrape, vt);
    }
  }
  _applyImpulse(r, dir, j) { const t = this._t2.crossVectors(r, dir).multiplyScalar(j); this._iinv(t); this.ang.add(t); }
}

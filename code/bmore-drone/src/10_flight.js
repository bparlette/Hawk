
// ======================= flight model: ARCADE (assisted, self-levelling) and ACRO (rate mode, thrust along the body up axis) =======================
const FLY = {
  maxSpd: 25, boostSpd: 38, yawRate: 2.5, climb: 11, accel: 3.4,
  acroRate: 6.4, acroYaw: 3.6, g: 9.81, thrustMax: 2.7, drag: 0.32,
  boostDrain: 0.42, boostRegen: 0.04,
};
function newCraft(colKey, opts = {}) {
  const mesh = buildDrone(colKey, opts); scene.add(mesh);
  return { mesh, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), yaw: 0, pitch: 0, roll: 0,
    thr: 0, boost: 1, boosting: false, alive: true, inv: 0, assist: true };
}
const _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3(), _tv = new THREE.Vector3(), _qa = new THREE.Quaternion(), _eu = new THREE.Euler();
function placeCraft(D, p, yaw) {
  D.pos.copy(p); D.prev.copy(p); D.vel.set(0, 0, 0); D.yaw = yaw; D.pitch = D.roll = 0; D.q.setFromEuler(_eu.set(0, yaw, 0, 'YXZ'));
  D.mesh.position.copy(p); D.mesh.quaternion.copy(D.q);
}
// arcade: in = {lx yaw, ly lift, rx strafe, ry forward, boost}; assistT = the next gate centre (altitude + aim assist) or null
function flyArcade(D, inp, dt, assistT) {
  const boosting = D.boosting = inp.boost && D.boost > 0.02 && inp.ry > -0.2;
  if (boosting) D.boost = Math.max(0, D.boost - FLY.boostDrain * dt); else D.boost = Math.min(1, D.boost + FLY.boostRegen * dt);
  let yawIn = inp.lx, lift = inp.ly, fwd = inp.ry, str = inp.rx;
  if (boosting) fwd = 1;
  // assist: when the nose is roughly on the next gate, nudge yaw onto it and hold its altitude when the pilot isn't climbing
  if (assistT && D.assist) {
    _tv.copy(assistT).sub(D.pos); const hd = Math.hypot(_tv.x, _tv.z); const want = Math.atan2(_tv.x, _tv.z), err = angTo(D.yaw, want);
    if (hd > 2 && hd < 40 && Math.abs(err) < 0.35 && fwd > 0.1 && Math.abs(yawIn) < 0.5) yawIn -= clamp(err * 1.6, -0.4, 0.4);
    if (Math.abs(lift) < 0.15 && hd < 55) lift = clamp((assistT.y - D.pos.y) * 0.22, -0.8, 0.8) * clamp(1.4 - hd / 55, 0.25, 1);
  }
  D.yaw = wrapA(D.yaw - yawIn * FLY.yawRate * dt * (0.75 + 0.25 * Math.min(1, D.vel.length() / 10)));
  const top = boosting ? FLY.boostSpd : FLY.maxSpd;
  _fw.set(Math.sin(D.yaw), 0, Math.cos(D.yaw)); _rt.set(-_fw.z, 0, _fw.x);
  _tv.copy(_fw).multiplyScalar(fwd * top).addScaledVector(_rt, str * top * 0.55);
  const k = 1 - Math.exp(-(boosting ? 3.2 : FLY.accel) * dt);
  D.vel.x += (_tv.x - D.vel.x) * k; D.vel.z += (_tv.z - D.vel.z) * k;
  D.vel.y += (lift * FLY.climb - D.vel.y) * (1 - Math.exp(-4 * dt));
  D.prev.copy(D.pos); D.pos.addScaledVector(D.vel, dt);
  // look: lean into the motion (pitch from forward speed, roll from turn + strafe)
  const fs = D.vel.x * _fw.x + D.vel.z * _fw.z, ss = D.vel.x * _rt.x + D.vel.z * _rt.z;
  D.pitch = damp(D.pitch, clamp(fs / top, -1, 1) * 0.42 + (boosting ? 0.1 : 0), 6, dt);
  D.roll = damp(D.roll, clamp(yawIn * 0.55 * Math.min(1, fs / 8) + ss / top * 0.5, -0.9, 0.9), 6, dt);
  D.q.setFromEuler(_eu.set(D.pitch, D.yaw, D.roll, 'YXZ'));
  D.thr = clamp(0.35 + Math.abs(fwd) * 0.5 + Math.abs(lift) * 0.2 + (boosting ? 0.3 : 0), 0, 1);
}
// acro: rate mode. ly = throttle (centre = hover), lx = yaw rate, ry = pitch rate, rx = roll rate. Expo on the sticks.
function flyAcro(D, inp, dt) {
  const boosting = D.boosting = inp.boost && D.boost > 0.02;
  if (boosting) D.boost = Math.max(0, D.boost - FLY.boostDrain * dt); else D.boost = Math.min(1, D.boost + FLY.boostRegen * dt);
  const ex = (v) => v * (0.35 + 0.65 * v * v);
  const pr = ex(inp.ry) * FLY.acroRate, rr = ex(inp.rx) * FLY.acroRate, yr = ex(inp.lx) * FLY.acroYaw;
  // body rates: nose down on stick forward (+x), right wing down on stick right (+z for a +z-nosed craft), yaw right = -y
  _qa.setFromEuler(_eu.set(pr * dt, -yr * dt, rr * dt, 'XYZ')); D.q.multiply(_qa).normalize();
  const thrust = FLY.g * clamp(1 + inp.ly * 1.1, 0, FLY.thrustMax) * (boosting ? 1.6 : 1);
  _up.set(0, 1, 0).applyQuaternion(D.q);
  D.vel.addScaledVector(_up, thrust * dt); D.vel.y -= FLY.g * dt;
  const sp = D.vel.length(); D.vel.multiplyScalar(Math.max(0, 1 - (FLY.drag + sp * 0.006) * dt));
  D.prev.copy(D.pos); D.pos.addScaledVector(D.vel, dt);
  // expose yaw / pitch / roll for the camera + HUD
  _eu.setFromQuaternion(D.q, 'YXZ'); D.yaw = _eu.y; D.pitch = _eu.x; D.roll = _eu.z;
  D.thr = clamp(0.3 + (inp.ly + 1) * 0.3 + (boosting ? 0.3 : 0), 0, 1);
}
// the visible mesh: the toon model is built nose +z; our pitch is nose-down positive => rotate about x by +pitch
function poseCraft(D, dt) { D.mesh.position.copy(D.pos); D.mesh.quaternion.copy(D.q); spinDrone(D.mesh, D.thr, dt); }

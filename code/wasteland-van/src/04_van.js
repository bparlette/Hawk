
// ---------------- the rig: hero model (lifted war van, spikes, cage, blower, mounted weapons) ----------------
const vanMat = toonMat({}, 'van');
const VAN = { root: new THREE.Group(), body: new THREE.Group() };
scene.add(VAN.root); VAN.root.add(VAN.body);
const RED = '#e8312a', RED2 = '#b8211f', GUN = '#3b3f46', CHROME = '#d5dde3', YEL = '#ffcf2e', DARK = '#1b1f27', RUSTP = '#8f4e36', SPIKE = '#e9eef2';
function spikeCone(r, h, pos, rot) { return P(GEO.cone(r, h, 5), SPIKE, pos, rot); }
(function buildVan() {
  const parts = [];
  // side silhouette (z, y) -> extruded body
  const sh = new THREE.Shape();
  sh.moveTo(-2.5, -0.42); sh.lineTo(2.15, -0.42); sh.lineTo(2.45, -0.08); sh.lineTo(2.45, 0.38); sh.lineTo(1.42, 0.56);
  sh.lineTo(0.92, 1.28); sh.lineTo(-2.35, 1.3); sh.lineTo(-2.5, 1.12); sh.lineTo(-2.5, -0.42);
  const ex = new THREE.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 1 });
  ex.rotateY(-Math.PI / 2); ex.translate(1.0, 0, 0);
  parts.push(P(ex, RED));
  // lower armour skirt + rocker plates with rivet strips
  parts.push(P(GEO.box(2.26, 0.42, 4.7), GUN, [0, -0.28, -0.05]));
  for (const s of [-1, 1]) {
    for (let z = -2.0; z <= 1.6; z += 1.2) parts.push(P(GEO.box(0.08, 0.62, 1.1), (z > 0) ? RUSTP : '#7a3f2c', [s * 1.11, 0.15, z], [0, 0, s * 0.05], null, { jitter: 0.15 }));
    // side windows with bars
    parts.push(P(GEO.box(0.06, 0.42, 2.5), DARK, [s * 1.075, 0.98, -0.95]));
    for (let z = -2.0; z <= 0.2; z += 0.55) parts.push(P(GEO.box(0.09, 0.5, 0.08), CHROME, [s * 1.1, 0.98, z]));
    // fender flares over each wheel
    for (const wz of [-1.6, 1.62]) parts.push(P(GEO.box(0.42, 0.18, 1.75), GUN, [s * 1.18, 0.02, wz], [0, 0, -s * 0.28]));
    // exhaust stacks (chrome) rising behind the cab
    parts.push(P(GEO.cyl(0.13, 0.15, 2.0, 8), CHROME, [s * 1.16, 1.05, -0.35]));
    parts.push(P(GEO.cyl(0.17, 0.13, 0.25, 8), '#333', [s * 1.16, 2.1, -0.35]));
    // side spikes along the skirt
    for (let z = -2.1; z <= 2.0; z += 0.7) parts.push(spikeCone(0.09, 0.42, [s * 1.3, -0.3, z], [0, 0, -s * 1.57]));
  }
  // windshield + armour grille
  parts.push(P(GEO.box(1.86, 0.84, 0.05), DARK, [0, 0.92, 1.2], [-0.59, 0, 0]));
  for (let x = -0.75; x <= 0.76; x += 0.375) parts.push(P(GEO.box(0.07, 0.9, 0.08), CHROME, [x, 0.93, 1.24], [-0.59, 0, 0]));
  parts.push(P(GEO.box(1.95, 0.08, 0.1), CHROME, [0, 0.66, 1.38], [-0.59, 0, 0]));
  // hood blower: supercharger body, intake scoop, butterflies
  parts.push(P(GEO.box(0.78, 0.32, 0.9), CHROME, [0, 0.7, 1.9]));
  parts.push(P(GEO.box(0.62, 0.34, 0.5), GUN, [0, 1.0, 1.95]));
  parts.push(P(GEO.box(0.66, 0.06, 0.54), YEL, [0, 1.19, 1.95]));
  for (const x of [-0.18, 0.18]) parts.push(P(GEO.box(0.18, 0.04, 0.4), DARK, [x, 1.23, 1.95]));
  // hood stripes
  for (const x of [-0.55, 0.55]) parts.push(P(GEO.box(0.22, 0.02, 1.0), YEL, [x, 0.53, 1.9], [-0.18, 0, 0]));
  // front cow-catcher ram: converging bars + big forward spikes
  parts.push(P(GEO.box(2.5, 0.34, 0.36), GUN, [0, -0.2, 2.55]));
  for (let i = -3; i <= 3; i++) parts.push(P(GEO.box(0.12, 0.12, 1.1), CHROME, [i * 0.36, -0.42 + Math.abs(i) * 0.05, 2.95], [0.55, -i * 0.08, 0]));
  parts.push(P(GEO.box(2.3, 0.12, 0.14), CHROME, [0, -0.66, 3.35]));
  for (let i = -3; i <= 3; i++) parts.push(spikeCone(0.13, 0.85, [i * 0.38, -0.2, 3.05 - Math.abs(i) * 0.08], [1.57, 0, 0]));
  for (let i = -2; i <= 2; i++) parts.push(spikeCone(0.1, 0.6, [i * 0.45, -0.66, 3.55], [1.57, 0, 0]));
  // headlights + roof light bar
  for (const x of [-0.85, 0.85]) parts.push(P(GEO.cyl(0.16, 0.16, 0.1, 10), '#fff6c4', [x, 0.18, 2.5], [1.57, 0, 0]));
  // roll cage on the roof + roof spikes
  for (const s of [-1, 1]) {
    parts.push(P(GEO.cyl(0.06, 0.06, 3.0, 6), CHROME, [s * 0.92, 1.55, -0.7], [1.57, 0, 0]));
    for (const z of [-2.1, -0.75, 0.7]) parts.push(P(GEO.cyl(0.06, 0.06, 0.5, 6), CHROME, [s * 0.92, 1.42, z]));
    for (let z = -2.1; z <= 0.8; z += 0.55) parts.push(spikeCone(0.07, 0.4, [s * 1.0, 1.66, z], [0, 0, -s * 0.5]));
  }
  for (const z of [-2.1, 0.7]) parts.push(P(GEO.cyl(0.06, 0.06, 1.84, 6), CHROME, [0, 1.55, z], [0, 0, 1.57]));
  for (const x of [-0.6, -0.2, 0.2, 0.6]) parts.push(P(GEO.cyl(0.11, 0.11, 0.12, 10), '#fff6c4', [x, 1.68, 0.7], [1.57, 0, 0]));
  // rear: spare tyre, ladder, jerry cans, rear spikes
  parts.push(P(GEO.tor(0.48, 0.2, 6, 14), '#26201f', [0, 0.5, -2.62]));
  parts.push(P(GEO.cyl(0.3, 0.3, 0.12, 10), YEL, [0, 0.5, -2.62], [1.57, 0, 0]));
  for (const x of [-0.75, 0.75]) parts.push(P(GEO.box(0.32, 0.55, 0.22), '#4e6b3a', [x, 0.2, -2.68]));
  for (let i = -2; i <= 2; i++) parts.push(spikeCone(0.09, 0.5, [i * 0.45, -0.3, -2.75], [-1.57, 0, 0]));
  // tail lights
  for (const x of [-0.9, 0.9]) parts.push(P(GEO.box(0.2, 0.3, 0.06), '#ff3b2f', [x, 0.75, -2.55]));
  const g = merge(parts); const m = withOutline(g, vanMat, OUT_VAN, VAN.body); m.castShadow = true;
  // painted side decals (original): flames, number 13, skull-and-piston
  const mkDecal = (flip) => canvasTex(512, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.save(); if (flip) { c.translate(w, 0); c.scale(-1, 1); }
    const fl = (y0, col, s) => { c.fillStyle = col; c.beginPath(); c.moveTo(w, y0 - 40 * s); for (let x = w; x > 40; x -= 46) { const t = (w - x) / w; c.quadraticCurveTo(x - 10, y0 - (60 - t * 40) * s, x - 34, y0 - 8 * s); c.quadraticCurveTo(x - 12, y0 + 4, x - 46, y0 + (30 - t * 20) * s); } c.lineTo(w, y0 + 40 * s); c.closePath(); c.fill(); };
    fl(104, '#ffcf2e', 1.0); fl(108, '#ff7a1a', 0.62);
    c.restore();
    c.lineWidth = 7; c.strokeStyle = '#1b1f27'; c.lineJoin = 'round';
    c.font = '900 84px Impact, "Arial Black", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#fff4dc';
    const tx = flip ? 380 : 132; c.strokeText('13', tx, 58); c.fillText('13', tx, 58);
  });
  for (const s of [-1, 1]) {
    // local +x of the plane points to the rear on the +x side and to the front on the -x side; flames trail backwards
    const dm = new THREE.MeshToonMaterial({ gradientMap: GRAD, map: mkDecal(s > 0), transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.38), dm);
    pl.position.set(s * 1.072, 0.2, -0.05); pl.rotation.y = s * Math.PI / 2; VAN.body.add(pl);
  }
  // wheels: tyre + tread lugs + yellow rim + spiked hub
  const wp = [P(GEO.cyl(0.72, 0.72, 0.58, 18), '#2a2526', null, [0, 0, 1.57])];
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; wp.push(P(GEO.box(0.62, 0.14, 0.2), '#211c1d', [0, Math.cos(a) * 0.72, Math.sin(a) * 0.72], [a, 0, 0])); }
  wp.push(P(GEO.cyl(0.42, 0.42, 0.62, 10), YEL, null, [0, 0, 1.57]));
  wp.push(P(GEO.cyl(0.16, 0.16, 0.7, 8), CHROME, null, [0, 0, 1.57]));
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; wp.push(P(GEO.box(0.64, 0.1, 0.1), GUN, [0, Math.cos(a) * 0.27, Math.sin(a) * 0.27], [a, 0, 0])); }
  const wgL = merge(wp.map((g) => g.clone()).concat([spikeCone(0.1, 0.45, [-0.5, 0, 0], [0, 0, 1.57])]));
  const wgR = merge(wp.map((g) => g.clone()).concat([spikeCone(0.1, 0.45, [0.5, 0, 0], [0, 0, -1.57])]));
  VAN.wheels = [];
  const MOUNTS = [[-1.08, 1.62, 1], [1.08, 1.62, 1], [-1.08, -1.6, 0], [1.08, -1.6, 0]];
  for (const [x, z, front] of MOUNTS) {
    const steer = new THREE.Group(); steer.position.set(x, -0.35, z); VAN.body.add(steer);
    const spin = withOutline(x < 0 ? wgL : wgR, vanMat, OUT_VAN, steer); spin.castShadow = true;
    // coil-over strut (stretched each frame)
    const strut = withOutline(merge([P(GEO.cyl(0.09, 0.09, 1, 6), CHROME), P(GEO.cyl(0.16, 0.16, 0.7, 8), YEL, [0, 0.1, 0])]), vanMat, OUT_VAN, VAN.body);
    VAN.wheels.push({ x, y: -0.35, z, front: !!front, steer, spin, strut, comp: 0, t: 1.2, contact: false, rot: 0, slip: 0 });
  }
})();
// ---------------- mounted weapons (visual rigs) ----------------
const RIG = {};
(function buildWeapons() {
  // roof machine gun turret
  RIG.turret = new THREE.Group(); RIG.turret.position.set(0, 1.42, -0.55); VAN.body.add(RIG.turret);
  withOutline(merge([P(GEO.cyl(0.55, 0.62, 0.22, 12), GUN), P(GEO.box(0.5, 0.36, 0.7), '#4a5058', [0, 0.3, 0.05]), P(GEO.box(0.9, 0.5, 0.06), GUN, [0, 0.42, 0.5], [-0.2, 0, 0]),
    P(GEO.box(0.3, 0.26, 0.36), '#4e6b3a', [0.42, 0.3, -0.1]), P(GEO.box(0.06, 0.2, 0.06), YEL, [0, 0.72, 0.5])]), vanMat, OUT_VAN, RIG.turret).castShadow = true;
  RIG.barrels = [];
  for (const x of [0, -0.26]) {
    const b = new THREE.Group(); b.position.set(x, 0.32, 0.3); RIG.turret.add(b);
    withOutline(merge([P(GEO.cyl(0.07, 0.07, 1.5, 8), '#2d3138', [0, 0, 0.75], [1.57, 0, 0]), P(GEO.cyl(0.1, 0.1, 0.25, 8), '#2d3138', [0, 0, 1.45], [1.57, 0, 0]),
      P(GEO.cyl(0.035, 0.035, 1.3, 6), CHROME, [0.08, 0, 0.7], [1.57, 0, 0]), P(GEO.cyl(0.035, 0.035, 1.3, 6), CHROME, [-0.08, 0, 0.7], [1.57, 0, 0])]), vanMat, OUT_VAN, b);
    RIG.barrels.push(b);
  }
  RIG.barrels[1].visible = false;
  // flamethrower: twin nozzles under the ram + side fuel tanks
  RIG.flame = new THREE.Group(); VAN.body.add(RIG.flame);
  withOutline(merge([P(GEO.cyl(0.13, 0.1, 0.9, 8), CHROME, [-0.55, 0.05, 2.65], [1.57, 0, 0]), P(GEO.cyl(0.13, 0.1, 0.9, 8), CHROME, [0.55, 0.05, 2.65], [1.57, 0, 0]),
    P(GEO.cyl(0.2, 0.2, 0.12, 8), '#ff7a1a', [-0.55, 0.05, 3.12], [1.57, 0, 0]), P(GEO.cyl(0.2, 0.2, 0.12, 8), '#ff7a1a', [0.55, 0.05, 3.12], [1.57, 0, 0]),
    P(GEO.cap(0.24, 1.2, 8), '#c0392b', [-1.32, 0.62, -1.5], [1.57, 0, 0]), P(GEO.cap(0.24, 1.2, 8), '#c0392b', [1.32, 0.62, -1.5], [1.57, 0, 0])]), vanMat, OUT_VAN, RIG.flame);
  RIG.flame.visible = false;
  // side saw arms + discs
  RIG.saws = [];
  const sawGeo = (() => { const p = [P(GEO.cyl(0.85, 0.85, 0.06, 20), '#c9d1d8', null, [0, 0, 1.57]), P(GEO.cyl(0.3, 0.3, 0.12, 10), '#c0392b', null, [0, 0, 1.57])];
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; p.push(P(GEO.cone(0.1, 0.3, 3), '#eef3f6', [0, Math.cos(a) * 0.95, Math.sin(a) * 0.95], [a, 0, 0])); } return merge(p); })();
  RIG.sawGeo = sawGeo;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 1.15, -0.05, 0.35); VAN.body.add(arm);
    withOutline(merge([P(GEO.box(0.9, 0.16, 0.22), GUN, [s * 0.45, 0, 0]), P(GEO.box(0.2, 0.3, 0.3), YEL, [s * 0.9, 0, 0])]), vanMat, OUT_VAN, arm);
    const disc = withOutline(sawGeo, vanMat, OUT_VAN, arm); disc.position.set(s * 1.0, 0, 0); disc.castShadow = true;
    arm.visible = false; RIG.saws.push({ arm, disc, s });
  }
  // halo saws (evolution): 4 orbiting discs, parented to the root (not the tilting body)
  RIG.halo = [];
  for (let i = 0; i < 4; i++) { const d = withOutline(sawGeo, vanMat, OUT_VAN, VAN.root); d.scale.setScalar(1.35); d.visible = false; RIG.halo.push(d); }
  // harpoon launcher on the roof rear
  RIG.harp = new THREE.Group(); RIG.harp.position.set(0, 1.5, -1.9); VAN.body.add(RIG.harp);
  withOutline(merge([P(GEO.box(0.5, 0.3, 0.5), GUN), P(GEO.cyl(0.12, 0.14, 1.4, 8), '#5b3a2c', [0, 0.22, 0.4], [1.4, 0, 0]), P(GEO.cyl(0.3, 0.3, 0.2, 10), YEL, [0.32, 0.1, -0.1], [0, 0, 1.57])]), vanMat, OUT_VAN, RIG.harp);
  RIG.harp.visible = false;
})();

// ---------------- van physics: raycast suspension rigid body ----------------
const VP = {
  M: 1650, G: 15.5, L0: 0.95, WR: 0.72, K: 21000, C: 2600,
  I: new THREE.Vector3(3700, 4100, 1350),
  CY: 1650 * 12, MU: 1.15, ROLL: 45,
};
const VS = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
  ppos: new THREE.Vector3(), pq: new THREE.Quaternion(),
  steer: 0, contacts: 0, air: 0, airMax: 0, airRot: 0, speed: 0, fwdSpeed: 0, drift: 0, slipRear: 0, upY: 1, stuck: 0,
  nitro: 0, boosting: false, rpm: 0, gear: 1, landImpact: 0, hullHit: 0, lastAirT: 0, flipAcc: 0,
};
const VAN_HULL = [[-1.05, -0.42, -2.5], [1.05, -0.42, -2.5], [-1.05, -0.42, 2.45], [1.05, -0.42, 2.45], [-1.05, 1.32, -2.4], [1.05, 1.32, -2.4], [-1.0, 1.3, 0.9], [1.0, 1.3, 0.9], [0, -0.3, 3.4], [0, 1.9, -0.4]];
const VAN_CIRC = [[-1.75, 1.3], [0, 1.3], [1.75, 1.3], [2.9, 0.9]];
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3(), _F = new THREE.Vector3(), _T = new THREE.Vector3();
const _mp = new THREE.Vector3(), _cp = new THREE.Vector3(), _rv = new THREE.Vector3(), _vp = new THREE.Vector3(), _fw = new THREE.Vector3(), _sw = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _mInv = new THREE.Matrix3();
function vanAxes() { _ax.set(1, 0, 0).applyQuaternion(VS.q); _ay.set(0, 1, 0).applyQuaternion(VS.q); _az.set(0, 0, 1).applyQuaternion(VS.q); }
function vanReset(x, z, yaw) {
  VS.pos.set(x, groundH(x, z) + 1.75, z); VS.vel.set(0, 0, 0); VS.w.set(0, 0, 0);
  VS.q.setFromAxisAngle(_tmp.set(0, 1, 0), yaw); VS.ppos.copy(VS.pos); VS.pq.copy(VS.q);
  VS.steer = 0; VS.air = 0; VS.airMax = 0; VS.airRot = 0; VS.stuck = 0; VS.drift = 0; VS.flipAcc = 0;
  for (const w of VAN.wheels) { w.comp = 0.3; w.contact = true; }
}
function applyForceAt(F, p) { _F.add(F); _r.subVectors(p, VS.pos); _T.add(_tmp.crossVectors(_r, F)); }
function applyImpulseAt(J, p) {
  VS.vel.addScaledVector(J, 1 / VP.M);
  _r.subVectors(p, VS.pos); _tmp.crossVectors(_r, J); angInvApply(_tmp); VS.w.add(_tmp);
}
// world-space inverse inertia applied to a vector in place
function angInvApply(v) {
  _tq.copy(VS.q).invert(); v.applyQuaternion(_tq);
  v.x /= VP.I.x; v.y /= VP.I.y; v.z /= VP.I.z; v.applyQuaternion(VS.q); return v;
}
// suspension ray: distance along -up from mount to the ground, or -1
function rayGround(m, dy, maxT) {
  const f0 = m.y - groundH(m.x, m.z);
  if (f0 <= 0) return 0;
  const fx = -_ay.x, fy = -_ay.y, fz = -_ay.z;
  const f1 = (m.y + fy * maxT) - groundH(m.x + fx * maxT, m.z + fz * maxT);
  if (f1 > 0) return -1;
  let a = 0, b = maxT;
  for (let i = 0; i < 9; i++) { const t = (a + b) * 0.5; const f = (m.y + fy * t) - groundH(m.x + fx * t, m.z + fz * t); if (f > 0) a = t; else b = t; }
  return (a + b) * 0.5;
}
const INP = { gas: 0, brake: 0, steer: 0, nitro: false, drift: false, reset: false };
function vanStep(h, inp, mods) {
  vanAxes();
  _F.set(0, -VP.G * VP.M, 0); _T.set(0, 0, 0);
  const maxT = VP.L0 + VP.WR;
  // speed-sensitive steering, dt-smoothed
  const sp = Math.hypot(VS.vel.x, VS.vel.z);
  const maxSteer = 0.6 / (1 + sp / 22);
  VS.steer = damp(VS.steer, inp.steer * maxSteer, 9, h);
  const fwdSpeed = VS.vel.dot(_az); VS.fwdSpeed = fwdSpeed;
  const top = (36 + mods.engine * 3) * (VS.boosting ? 1.45 : 1);
  let drive = 0;
  if (inp.gas > 0) drive = inp.gas * VP.M * (10.5 + mods.engine * 0.8) * Math.max(0, 1 - Math.max(0, fwdSpeed) / top);
  if (VS.boosting) drive += VP.M * 13 * Math.max(0, 1 - fwdSpeed / (top + 4));
  let brake = 0;
  if (inp.brake > 0) { if (fwdSpeed > 1.5) brake = inp.brake * VP.M * 16; else drive -= inp.brake * VP.M * 8 * Math.max(0, 1 + fwdSpeed / 13); }
  let contacts = 0; for (const w of VAN.wheels) if (w.contact) contacts++;
  let slipR = 0;
  for (const w of VAN.wheels) {
    _mp.set(w.x, w.y, w.z).applyQuaternion(VS.q).add(VS.pos);
    const t = rayGround(_mp, 0, maxT);
    if (t < 0) { w.contact = false; w.comp = 0; w.t = damp(w.t, VP.L0, 10, h); continue; }
    w.contact = true; w.t = t - VP.WR;
    const comp = maxT - t; const cv = (comp - w.comp) / h; w.comp = comp;
    let Fs = VP.K * comp + VP.C * cv; if (Fs < 0) Fs = 0; if (Fs > VP.M * VP.G * 3) Fs = VP.M * VP.G * 3;
    _cp.copy(_mp).addScaledVector(_ay, -t);
    groundN(_cp.x, _cp.z, _n);
    applyForceAt(_f.copy(_ay).multiplyScalar(Fs), _cp);
    // wheel frame on the ground plane
    const st = w.front ? VS.steer : 0, cs = Math.cos(st), sn = Math.sin(st);
    _fw.copy(_az).multiplyScalar(cs).addScaledVector(_ax, -sn); _fw.addScaledVector(_n, -_fw.dot(_n)).normalize();
    _sw.crossVectors(_n, _fw).normalize(); // points to the van's left
    _r.subVectors(_cp, VS.pos); _vp.crossVectors(VS.w, _r).add(VS.vel);
    const vl = _vp.dot(_fw), vs = _vp.dot(_sw);
    const rear = !w.front;
    let cy = VP.CY, mu = VP.MU * (1 + mods.grip * 0.06);
    if (rear && inp.drift) { cy *= 0.22; mu *= 0.5; }
    if (rear && inp.gas > 0 && Math.abs(inp.steer) > 0.5 && sp > 14) mu *= 0.86; // power-oversteer
    let Fy = -vs * cy / 4 * (sp < 2 ? sp / 2 + 0.2 : 1);
    let Fx = drive / Math.max(1, contacts) * (rear ? 1.15 : 0.85) - vl * VP.ROLL;
    if (brake > 0) Fx -= Math.sign(vl) * Math.min(brake / 4, Math.abs(vl) * VP.M * 2);
    if (rear && inp.drift) Fx -= Math.sign(vl) * VP.M * 1.4;
    const maxF = mu * Fs, mag = Math.hypot(Fx, Fy);
    if (mag > maxF) { const k = maxF / mag; Fx *= k; Fy *= k; if (rear) slipR += Math.abs(vs); }
    // apply tyre forces a little above the contact (keeps the tall rig from tripping over itself)
    _tmp.copy(_cp).addScaledVector(_ay, 0.9);
    applyForceAt(_f.copy(_fw).multiplyScalar(Fx).addScaledVector(_sw, Fy), _tmp);
    w.rot += vl / VP.WR * h; w.slip = Math.abs(vs);
  }
  contacts = 0; for (const w of VAN.wheels) if (w.contact) contacts++;
  VS.contacts = contacts; VS.slipRear = slipR;
  // hull vs ground (penalty contacts for rough landings and roll-overs)
  VS.hullHit = 0;
  for (const c of VAN_HULL) {
    _mp.set(c[0], c[1], c[2]).applyQuaternion(VS.q).add(VS.pos);
    const g = groundH(_mp.x, _mp.z), pen = g - _mp.y;
    if (pen > 0) {
      groundN(_mp.x, _mp.z, _n); _r.subVectors(_mp, VS.pos); _vp.crossVectors(VS.w, _r).add(VS.vel);
      const vn = _vp.dot(_n); let Fn = VP.M * 260 * Math.min(pen, 0.6) - VP.M * 18 * vn; if (Fn < 0) Fn = 0;
      _f.copy(_n).multiplyScalar(Fn);
      _tmp.copy(_vp).addScaledVector(_n, -vn); const vt = _tmp.length(); if (vt > 0.01) _f.addScaledVector(_tmp, -Math.min(0.55 * Fn, VP.M * 40 * vt) / vt);
      applyForceAt(_f, _mp);
      if (-vn > VS.hullHit) VS.hullHit = -vn;
    }
  }
  // drag
  _F.addScaledVector(VS.vel, -0.42 * sp);
  // drift assist: steer adds yaw while the rear is sliding; air control when airborne
  VS.drift = damp(VS.drift, (inp.drift || slipR > 6) && sp > 9 && contacts >= 2 ? 1 : 0, 6, h);
  if (contacts >= 2) {
    _T.addScaledVector(_ay, -inp.steer * VP.I.y * 1.6 * VS.drift);
    // mild upright assist
    _tmp.crossVectors(_ay, _v3.set(0, 1, 0)); _T.addScaledVector(_tmp, VP.I.x * 4);
  }
  // integrate
  VS.vel.addScaledVector(_F, h / VP.M);
  angInvApply(_T); VS.w.addScaledVector(_T, h);
  if (contacts === 0) {
    // air control: pitch with gas/brake, yaw + roll with steer
    const ac = 3.4 * h;
    VS.w.addScaledVector(_ax, (inp.gas - inp.brake) * ac * 1.1);
    VS.w.addScaledVector(_ay, -inp.steer * ac * 1.2);
    VS.w.addScaledVector(_az, inp.steer * ac * 0.35);
    VS.w.multiplyScalar(Math.exp(-0.6 * h));
  } else VS.w.multiplyScalar(Math.exp(-1.6 * h));
  VS.pos.addScaledVector(VS.vel, h);
  const wl = VS.w.length();
  if (wl > 1e-6) { _tq.setFromAxisAngle(_tmp.copy(VS.w).divideScalar(wl), wl * h); VS.q.premultiply(_tq).normalize(); }
  VS.speed = sp; VS.upY = _ay.y;
}
// static circles, barrels, arena edge, ramp side walls
function vanCollide(onHit) {
  vanAxes();
  let worst = 0;
  for (const c of VAN_CIRC) {
    const px = VS.pos.x + _az.x * c[0], pz = VS.pos.z + _az.z * c[0], r = c[1];
    for (let i = 0; i < COLS.length; i++) {
      const o = COLS[i], dx = px - o.x, dz = pz - o.z, rr = r + o.r, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
      VS.pos.x += nx * pen; VS.pos.z += nz * pen;
      const vn = VS.vel.x * nx + VS.vel.z * nz;
      if (vn < 0) {
        _mp.set(px - nx * r, VS.pos.y, pz - nz * r);
        applyImpulseAt(_f.set(nx, 0, nz).multiplyScalar(-vn * VP.M * 1.35), _mp);
        if (-vn > worst) worst = -vn;
      }
    }
    // ramp side walls / under-lip
    for (const rp of RAMPS) {
      const dx = px - rp.x, dz = pz - rp.z, u = dx * rp.fx + dz * rp.fz, v = dx * rp.fz - dz * rp.fx;
      const hw = rp.W / 2 + r * 0.8;
      if (u < 0.5 || u > rp.L + r * 0.8 || Math.abs(v) > hw) continue;
      const topY = rp.y0 + rp.H * Math.pow(Math.min(u, rp.L) / rp.L, rp.pw);
      if (VS.pos.y - 1.2 > topY - 0.7) continue;
      const pv = hw - Math.abs(v), pu = rp.L + r * 0.8 - u;
      let nx, nz, pen;
      if (pu < pv) { nx = rp.fx; nz = rp.fz; pen = pu; } else { const s = v > 0 ? 1 : -1; nx = rp.fz * s; nz = -rp.fx * s; pen = pv; }
      VS.pos.x += nx * pen; VS.pos.z += nz * pen;
      const vn = VS.vel.x * nx + VS.vel.z * nz; if (vn < 0) { VS.vel.x -= nx * vn * 1.3; VS.vel.z -= nz * vn * 1.3; if (-vn > worst) worst = -vn; }
    }
  }
  const rr = Math.hypot(VS.pos.x, VS.pos.z);
  if (rr > ARENA_R) { const nx = -VS.pos.x / rr, nz = -VS.pos.z / rr; VS.pos.x += nx * (rr - ARENA_R); VS.pos.z += nz * (rr - ARENA_R); const vn = VS.vel.x * nx + VS.vel.z * nz; if (vn < 0) { VS.vel.x -= nx * vn * 1.4; VS.vel.z -= nz * vn * 1.4; if (-vn > worst) worst = -vn; } }
  if (worst > 0 && onHit) onHit(worst);
}
// visual sync (interpolated)
function vanVisual(alpha, dt) {
  VAN.root.position.lerpVectors(VS.ppos, VS.pos, alpha);
  VAN.root.quaternion.slerpQuaternions(VS.pq, VS.q, alpha);
  for (const w of VAN.wheels) {
    const y = w.y - w.t;
    w.steer.position.y = y; w.steer.rotation.y = w.front ? VS.steer : 0; w.spin.rotation.x = w.rot;
    w.strut.position.set(w.x * 0.78, (w.y + 0.25 + y) / 2, w.z); w.strut.scale.set(1, Math.max(0.3, (w.y + 0.25 - y)), 1);
  }
}

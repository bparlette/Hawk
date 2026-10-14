
// ================= input =================
const KEYS = new Set();
const TCH = { steer: 0, gas: false, brake: false, nitro: false, drift: false, stickId: -1, sx: 0, sy: 0, ax: 0, ay: 0, shown: false };
function readInput() {
  const I = _ip;
  if (G.state !== 'play') { I.gas = I.brake = I.steer = 0; I.nitro = I.drift = false; I.reset = false; return I; }
  const k = (a, b) => KEYS.has(a) || (b && KEYS.has(b));
  let steer = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  if (TCH.stickId >= 0) steer = TCH.steer;
  I.steer = clamp(steer, -1, 1);
  I.gas = k('KeyW', 'ArrowUp') || TCH.gas || (TCH.stickId >= 0 && TCH.ay < -0.45) ? 1 : 0;
  I.brake = k('KeyS', 'ArrowDown') || TCH.brake || (TCH.stickId >= 0 && TCH.ay > 0.55) ? 1 : 0;
  I.nitro = k('Space') || TCH.nitro;
  I.drift = k('ShiftLeft', 'ShiftRight') || k('KeyJ') || TCH.drift;
  I.reset = INP.reset; INP.reset = false;
  return I;
}
// attract / ?bot autopilot: drives the real game through its own input object
const BOTS = { tx: 0, tz: 40, re: 0, ramp: 0, stuck: 0, rev: 0 };
function botInput(dt) {
  const I = _ip; I.reset = false; I.brake = 0; I.drift = false; I.nitro = false;
  const x = VS.pos.x, z = VS.pos.z;
  BOTS.re -= dt;
  if (BOTS.re <= 0 && !BOTS.ramp) {
    BOTS.re = rnd(1.1, 2.0);
    const boss = BIGS.find((b) => !b.dead);
    if (EXT.open) { BOTS.tx = EXTRACT.x; BOTS.tz = EXTRACT.z; }
    else if (boss && Math.hypot(boss.x - x, boss.z - z) < 55) {
      if (boss.st === 'recover' || boss.st === 'stun' || boss.st === 'walk') { BOTS.tx = boss.x; BOTS.tz = boss.z; BOTS.re = 0.4; }
      else { const a = Math.atan2(x - boss.x, z - boss.z) + 1.2; BOTS.tx = boss.x + Math.sin(a) * 30; BOTS.tz = boss.z + Math.cos(a) * 30; }
    } else if (z < -40 && Math.abs(x) < 60 && Math.random() < 0.45) { BOTS.ramp = 1; }
    else {
      let best = -1, bx = 0, bz = 0;
      for (let k = 0; k < 24; k++) { const i = (Math.random() * zHigh) | 0; if (ZS[i] !== 1) continue; const d = Math.hypot(ZX[i] - x, ZZ[i] - z); if (d > 75 || d < 10) continue; const n = hQuery(ZX[i], ZZ[i], 7) - d * 0.05; if (n > best) { best = n; bx = ZX[i]; bz = ZZ[i]; } }
      if (best >= 0) { BOTS.tx = bx; BOTS.tz = bz; } else { BOTS.tx = rnd(-90, 90); BOTS.tz = rnd(-90, 90); }
    }
  }
  if (BOTS.ramp === 1) { BOTS.tx = 0; BOTS.tz = -62; if (Math.hypot(x, z + 62) < 9) BOTS.ramp = 2; }
  if (BOTS.ramp === 2) { BOTS.tx = 0; BOTS.tz = 20; if (z > 12 || z < -75 || Math.abs(x) > 12) { BOTS.ramp = 0; BOTS.re = 0; } }
  let tx = BOTS.tx, tz = BOTS.tz;
  // the Rift: the middle under the landing ramp is a dead end; cross it off to the side
  if (!BOTS.ramp && ((z < 44 && tz > 44) || (z > 6 && tz < 6)) && Math.abs(x) < 26 && Math.abs(z - TZ) < 30) { tx = x >= 0 ? 34 : -34; tz = z; if (Math.abs(x) > 24) tz = tz > z ? z + 30 : z - 30; }
  // dodge telegraphs
  for (const T of TELE) {
    if (!T.on) continue;
    if (T.kind === 0) { const d = Math.hypot(x - T.x, z - T.z); if (d < T.r + 4) { const ex = (x - T.x) / (d + 0.1), ez = (z - T.z) / (d + 0.1); tx = x + ex * 30; tz = z + ez * 30; } }
    else { const dx = x - T.x, dz = z - T.z, fx = Math.sin(T.yaw), fz = Math.cos(T.yaw), u = dx * fx + dz * fz, v = dx * fz - dz * fx; if (u > -3 && u < T.len + 3 && Math.abs(v) < T.r + 3) { const s = v >= 0 ? 1 : -1; tx = x + fz * s * 30; tz = z - fx * s * 30; } }
  }
  if (Math.hypot(x, z) > ARENA_R - 22) { tx = 0; tz = 0; }
  const ang = wrapA(Math.atan2(tx - x, tz - z) - vanYaw());
  I.steer = clamp(-ang * 2.4, -1, 1); I.gas = 1;
  if (Math.abs(ang) > 0.85 && VS.speed > 15) I.drift = true;
  if (Math.abs(ang) < 0.2 && G.nitro > 55 && (BOTS.ramp === 2 || VS.speed > 18)) I.nitro = true;
  if (VS.contacts === 0) { I.steer = 0; I.gas = _az.y > 0.12 ? 1 : 0; I.brake = _az.y < -0.2 ? 1 : 0; I.nitro = false; }
  if (VS.speed < 2.5 && VS.contacts > 0) BOTS.stuck += dt; else BOTS.stuck = Math.max(0, BOTS.stuck - dt);
  if (BOTS.stuck > 1.1) { BOTS.rev = 1.0; BOTS.stuck = 0; }
  if (BOTS.rev > 0) { BOTS.rev -= dt; I.gas = 0; I.brake = 1; I.steer = -I.steer; }
  return I;
}

// ================= camera =================
let camSnap = true; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), _cl = new THREE.Vector3(); let camYaw = 0, camFov = 62, PORTRAIT = false;
function cameraUpdate(dt) {
  const vp = VAN.root.position;
  _az.set(0, 0, 1).applyQuaternion(VAN.root.quaternion);
  const fy = Math.atan2(_az.x, _az.z);
  let hy = fy; const air = VS.contacts === 0;
  if (VS.speed > 6 && VS.fwdSpeed > 0) hy = fy + wrapA(Math.atan2(VS.vel.x, VS.vel.z) - fy) * 0.45;
  if (camSnap) camYaw = hy;
  camYaw += wrapA(hy - camYaw) * (1 - Math.exp(-(air ? 0.8 : 3.6) * dt));
  let dist = PORTRAIT ? 16.5 : 12.8, height = PORTRAIT ? 10.5 : 6.6;
  dist += Math.min(5, VS.speed * 0.09); height += Math.min(2, VS.speed * 0.03);
  const boss = BIGS.find((b) => !b.dead && b.boss);
  if (boss && Math.hypot(boss.x - vp.x, boss.z - vp.z) < 45) { dist += 4; height += 3; }
  if (G.state === 'dead' || G.state === 'win') { dist += 3; height += 3; camYaw += dt * 0.25; }
  const sx = Math.sin(camYaw), sz = Math.cos(camYaw);
  _cl.set(vp.x - sx * dist, vp.y + height, vp.z - sz * dist);
  const ch = hm(_cl.x, _cl.z) + 2.5; if (_cl.y < ch) _cl.y = ch;
  if (camSnap) camPos.copy(_cl); else { camPos.x = damp(camPos.x, _cl.x, 7, dt); camPos.y = damp(camPos.y, _cl.y, 5, dt); camPos.z = damp(camPos.z, _cl.z, 7, dt); }
  const ahead = PORTRAIT ? 7.5 : 6.5;
  _cl.set(vp.x + sx * ahead + VS.vel.x * 0.12, vp.y + (PORTRAIT ? 0.6 : 1.4), vp.z + sz * ahead + VS.vel.z * 0.12);
  if (camSnap) camLook.copy(_cl); else camLook.lerp(_cl, 1 - Math.exp(-10 * dt));
  camSnap = false;
  // trauma shake (decays with real dt)
  const s = G.shake * G.shake, tt = G.real * 40;
  camera.position.set(camPos.x + Math.sin(tt * 1.1) * s * 0.9, camPos.y + Math.sin(tt * 1.7 + 1) * s * 0.7, camPos.z + Math.sin(tt * 1.3 + 2) * s * 0.9);
  camera.lookAt(camLook);
  const base = PORTRAIT ? 70 : 60;
  const fov = base + Math.min(14, VS.speed * 0.3) + (VS.boosting ? 9 : 0);
  camFov = damp(camFov, fov, 4, dt);
  if (Math.abs(camera.fov - camFov) > 0.05) { camera.fov = camFov; camera.updateProjectionMatrix(); }
  // shadow camera follows the rig
  sun.target.position.copy(vp); sun.position.copy(vp).addScaledVector(SUN_DIR, 90);
}

// ================= per-frame visuals =================
function hordeVisual() {
  const te = zMesh.instanceMatrix.array, be = blobMesh.instanceMatrix.array;
  for (let i = 0; i < zHigh; i++) {
    const o = i * 16, st = ZS[i];
    if (!st) { te[o] = te[o + 5] = te[o + 10] = 0; te[o + 15] = 1; te[o + 12] = te[o + 13] = te[o + 14] = 0; be[o] = be[o + 5] = be[o + 10] = 0; continue; }
    const T = ZTYPES[ZT[i]], sc = ZSC[i], sx = T.sx * sc, sy = T.sy * sc;
    if (st === 1) {
      const c = Math.cos(ZYAW[i]), s = Math.sin(ZYAW[i]);
      te[o] = c * sx; te[o + 1] = 0; te[o + 2] = -s * sx; te[o + 3] = 0;
      te[o + 4] = 0; te[o + 5] = sy; te[o + 6] = 0; te[o + 7] = 0;
      te[o + 8] = s * sx; te[o + 9] = 0; te[o + 10] = c * sx; te[o + 11] = 0;
      te[o + 12] = ZX[i]; te[o + 13] = ZY[i]; te[o + 14] = ZZ[i]; te[o + 15] = 1;
    } else {
      const qx = ZQ[i * 4], qy = ZQ[i * 4 + 1], qz = ZQ[i * 4 + 2], qw = ZQ[i * 4 + 3];
      const sink = ZLIFE[i] < 1 ? Math.max(0.01, ZLIFE[i]) : 1;
      _q.set(qx, qy, qz, qw);
      // pivot around the body centre (1 m up)
      const yx = 2 * (qx * qy - qw * qz), yy = 1 - 2 * (qx * qx + qz * qz), yz = 2 * (qy * qz + qw * qx);
      _m4.compose(_v1.set(ZX[i] - yx * sy, ZY[i] - yy * sy - (1 - sink) * 0.8, ZZ[i] - yz * sy), _q, _v2.set(sx * sink, sy * sink, sx * sink));
      _m4.toArray(te, o);
    }
    const bs = (st === 1 ? 1.25 : 1.6) * sx;
    be[o] = bs; be[o + 1] = be[o + 2] = be[o + 3] = be[o + 4] = 0; be[o + 5] = 1; be[o + 6] = be[o + 7] = be[o + 8] = be[o + 9] = 0; be[o + 10] = bs; be[o + 11] = 0;
    be[o + 12] = ZX[i]; be[o + 13] = hm(ZX[i], ZZ[i]) + 0.06; be[o + 14] = ZZ[i]; be[o + 15] = 1;
    ZDATA[i * 4] = ZPH[i]; ZDATA[i * 4 + 1] = ZMODE[i]; ZDATA[i * 4 + 2] = ZFL[i] > 0 ? Math.min(0.8, ZFL[i]) : 0; ZDATA[i * 4 + 3] = ZBURN[i] > 0 ? Math.min(1, ZBURN[i] * 0.6) : 0;
  }
  zMesh.count = zOl.count = blobMesh.count = zHigh;
  zMesh.instanceMatrix.needsUpdate = true; blobMesh.instanceMatrix.needsUpdate = true; zGeo.attributes.iData.needsUpdate = true;
}
const _qd = new THREE.Quaternion(), _Z = new THREE.Vector3(0, 0, 1);
function pickupVisual(t) {
  for (let i = 0; i < GEMN; i++) {
    if (!GM.st[i]) { _m4.makeScale(0, 0, 0); gemMesh.setMatrixAt(i, _m4); continue; }
    const s = GM.v[i] >= 20 ? 1.8 : GM.v[i] >= 4 ? 1.3 : 1;
    _q.setFromAxisAngle(_UP, t * 3 + i); _m4.compose(_v1.set(GM.x[i], GM.y[i] + Math.sin(t * 4 + i) * 0.15, GM.z[i]), _q, _v2.set(s, s, s)); gemMesh.setMatrixAt(i, _m4);
  }
  gemMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < SCRN; i++) {
    if (!SC.st[i]) { _m4.makeScale(0, 0, 0); scrapMesh.setMatrixAt(i, _m4); continue; }
    _e.set(0.5, t * 4 + i, 0); _q.setFromEuler(_e); _m4.compose(_v1.set(SC.x[i], SC.y[i] + 0.2, SC.z[i]), _q, _v2.set(1, 1, 1)); scrapMesh.setMatrixAt(i, _m4);
  }
  scrapMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < BN; i++) {
    if (BU.life[i] <= 0) { _m4.makeScale(0, 0, 0); tracerMesh.setMatrixAt(i, _m4); continue; }
    _v3.set(BU.vx[i], BU.vy[i], BU.vz[i]).normalize(); _qd.setFromUnitVectors(_Z, _v3);
    _m4.compose(_v1.set(BU.x[i], BU.y[i], BU.z[i]), _qd, _v2.set(BU.boom[i] ? 2.4 : 1, BU.boom[i] ? 2.4 : 1, 1)); tracerMesh.setMatrixAt(i, _m4);
  }
  tracerMesh.instanceMatrix.needsUpdate = true;
}
function decalVisual(dt) {
  for (let i = 0; i < DECN; i++) {
    if (DEC.life[i] <= 0) continue;
    DEC.life[i] -= dt;
    if (DEC.life[i] <= 0) { _m4.makeScale(0, 0, 0); decMesh.setMatrixAt(i, _m4); DEC.dirty = true; }
    else if (DEC.life[i] < 3) writeDecal(i, DEC.s[i] * DEC.life[i] / 3);
  }
  if (DEC.dirty) { decMesh.instanceMatrix.needsUpdate = true; DEC.dirty = false; }
}
function rigVisual(dt) {
  RIG.turret.rotation.y = W.mgYaw;
  for (const b of RIG.barrels) b.rotation.z += dt * (G.evo.minigun ? 40 : 0);
  for (const s of RIG.saws) s.disc.rotation.x = -W.spin * s.s;
  if (G.evo.halo) for (let k = 0; k < 4; k++) { const a = W.haloA + k * TAU / 4, d = RIG.halo[k]; _tq.copy(VAN.root.quaternion).invert(); d.position.set(Math.sin(a) * 4.8, -0.6, Math.cos(a) * 4.8); d.position.applyQuaternion(_tq); d.quaternion.copy(_tq); d.rotateY(a + Math.PI / 2); d.rotateX(W.spin); }
  harpoonVisual();
  vanMat.userData.flash.value = Math.max(0, vanMat.userData.flash.value - dt * 3);
  // extraction beam
  if (EXT.open) { EXT.mat.opacity = 0.25 + 0.1 * Math.sin(G.real * 5); EXT.ringMat.opacity = 0.6 + 0.3 * Math.sin(G.real * 7); EXT.beam.rotation.y += dt; } else { EXT.mat.opacity = 0; EXT.ringMat.opacity = 0; }
  // blood moon
  SKY_U.uRed.value = damp(SKY_U.uRed.value, G.bloodMoon, 0.8, dt);
  const r = SKY_U.uRed.value; FOGC.setRGB(lerp(0.965, 0.75, r), lerp(0.79, 0.36, r), lerp(0.6, 0.3, r)); scene.background.copy(FOGC);
  sun.color.setRGB(1, lerp(0.95, 0.62, r), lerp(0.84, 0.5, r)); hemi.intensity = lerp(1.55, 1.15, r);
  scene.fog.near = lerp(90, 60, r); scene.fog.far = lerp(330, 240, r); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far;
}

// ================= HUD (one canvas) =================
const hud = $('hud'), hx = hud.getContext('2d');
const HUD = { w: 1, h: 1, s: 1, top: 0, bot: 0 };
const ICONIMG = {};
for (const k of ['mg', 'flame', 'saw', 'harpoon', 'spikes', 'armor', 'nitro', 'magnet', 'engine']) { const im = new Image(); im.src = 'data:image/svg+xml,' + encodeURIComponent(ICON(k).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" ')); ICONIMG[k] = im; }
const FONT = (px, w = 900) => `${w} ${px | 0}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
function txt(s, x, y, px, col, align = 'left', stroke = 0.16) {
  hx.font = FONT(px); hx.textAlign = align; hx.textBaseline = 'middle'; hx.lineJoin = 'round';
  hx.lineWidth = Math.max(3, px * stroke); hx.strokeStyle = '#1a0f12'; hx.strokeText(s, x, y); hx.fillStyle = col; hx.fillText(s, x, y);
}
function bar(x, y, w, h, k, col, back = '#2a1d1a') {
  hx.fillStyle = '#1a0f12'; hx.fillRect(x - 3, y - 3, w + 6, h + 6);
  hx.fillStyle = back; hx.fillRect(x, y, w, h);
  hx.fillStyle = col; hx.fillRect(x, y, w * clamp(k, 0, 1), h);
  hx.fillStyle = 'rgba(255,255,255,0.28)'; hx.fillRect(x, y, w * clamp(k, 0, 1), Math.max(2, h * 0.3));
}
const _pj = new THREE.Vector3(), _pr = [0, 0, false];
function project(x, y, z) { _pj.set(x, y, z).project(camera); _pr[0] = (_pj.x * 0.5 + 0.5) * HUD.w; _pr[1] = (-_pj.y * 0.5 + 0.5) * HUD.h; _pr[2] = _pj.z < 1 && _pj.z > -1; return _pr; }
function edgeArrow(x, y, z, col, label) {
  _pj.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); const behind = _pj.z > 0;
  _pj.set(x, y, z).project(camera); let sx = _pj.x, sy = -_pj.y; if (behind) { sx = -sx; sy = -sy; }
  const on = !behind && Math.abs(sx) < 0.92 && Math.abs(sy) < 0.85;
  const W = HUD.w, H = HUD.h;
  let px = (sx * 0.5 + 0.5) * W, py = (sy * 0.5 + 0.5) * H;
  if (!on) { const m = Math.max(Math.abs(sx) / 0.86, Math.abs(sy) / 0.6, 1e-3); px = (sx / m * 0.5 + 0.5) * W; py = (sy / m * 0.5 + 0.5) * H; py = clamp(py, HUD.top + 150, H - HUD.bot - 60); }
  const a = Math.atan2(py - H / 2, px - W / 2);
  hx.save(); hx.translate(px, py);
  px = clamp(px, 46, W - 46);
  if (!on) { hx.rotate(a); hx.fillStyle = col; hx.strokeStyle = '#1a0f12'; hx.lineWidth = 4; hx.beginPath(); hx.moveTo(18, 0); hx.lineTo(-10, -13); hx.lineTo(-4, 0); hx.lineTo(-10, 13); hx.closePath(); hx.stroke(); hx.fill(); hx.rotate(-a); }
  if (label) txt(label, 0, on ? -24 : 28, 15, col, 'center');
  hx.restore();
}
const SLOTK = ['mg', 'flame', 'saw', 'harpoon', 'spikes', 'armor', 'nitro', 'magnet', 'engine'];
function drawHUD(dt) {
  const W = HUD.w, H = HUD.h; hx.setTransform(HUD.s, 0, 0, HUD.s, 0, 0); hx.clearRect(0, 0, W, H);
  // damage vignette + low-hull pulse
  const low = G.state === 'play' ? clamp(1 - G.hp / G.maxHp / 0.3, 0, 1) * (0.5 + 0.5 * Math.sin(G.real * 8)) : 0;
  G.flashR = Math.max(0, G.flashR - dt * 1.8);
  const vg = Math.max(G.flashR, low * 0.6);
  if (vg > 0.01) { const g = hx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${0.55 * vg})`); hx.fillStyle = g; hx.fillRect(0, 0, W, H); }
  // speed lines when boosting
  if (VS.boosting && G.state === 'play') { hx.strokeStyle = 'rgba(255,255,255,0.35)'; hx.lineWidth = 2; for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU + G.real * 0.7, r0 = Math.max(W, H) * (0.36 + 0.12 * Math.sin(G.real * 23 + k * 7)), r1 = r0 + Math.max(W, H) * 0.2; hx.beginPath(); hx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); hx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); hx.stroke(); } }
  // floating texts
  for (const f of FT) { if (!f.on) continue; f.t += dt; if (f.t > 1) { f.on = false; continue; } const p = project(f.x, f.y + f.t * 2, f.z); if (p[2]) txt(f.txt, p[0], p[1], 22 * f.size * (1 + Math.max(0, 0.2 - f.t) * 1.5), f.col, 'center'); }
  if (G.state === 'attract') return;
  const Pt = PORTRAIT, pad = 12, top = HUD.top + 10;
  // hull + nitro
  const hw = Pt ? Math.min(W * 0.5, 220) : Math.min(320, W * 0.26);
  const hk = G.hp / G.maxHp;
  txt('HULL', pad, top + 8, 15, '#fff4dc');
  bar(pad + 48, top, hw - 48, 16, hk, hk > 0.5 ? '#7dff6a' : hk > 0.25 ? '#ffcf2e' : '#ff4a3a');
  txt(Math.ceil(G.hp) + '', pad + hw - 6, top + 8, 13, '#fff', 'right', 0.25);
  txt('NOS', pad, top + 32, 15, '#9be7ff');
  bar(pad + 48, top + 26, hw - 48, 11, G.nitro / G.nitroMax, VS.boosting ? '#ffffff' : '#4fc9ff');
  // timer / objective
  const tl = Math.max(0, RUN_LEN - G.t);
  const tY = Pt ? top + 70 : top + 18, tS = Pt ? 40 : 38;
  if (!G.extract) { txt(fmtT(tl), W / 2, tY, tS, tl < 30 ? '#ffcf2e' : '#fff4dc', 'center'); txt(G.boss && !G.boss.dead ? 'KILL GRAVEMAW · OR SURVIVE' : 'SURVIVE', W / 2, tY + tS * 0.62, 14, '#ffcf2e', 'center'); }
  else { const d = Math.hypot(VS.pos.x - EXTRACT.x, VS.pos.z - EXTRACT.z); txt('EXTRACT!', W / 2, tY, tS * 0.9, '#7dffb0', 'center'); txt(Math.round(d) + ' m · FOLLOW THE BEAM', W / 2, tY + tS * 0.6, 14, '#7dffb0', 'center'); }
  // kills + combo (right, under the buttons)
  const kY = Pt ? top + 64 : top + 58;
  txt(G.kills.toLocaleString(), W - pad, kY, 26, '#fff4dc', 'right'); txt('KILLS', W - pad, kY + 20, 12, '#ffcf2e', 'right');
  if (G.combo >= 5) { const pulse = 1 + Math.max(0, G.comboT - 2.3) * 0.8; const cY = Pt ? top + 146 : kY + 46; txt('x' + G.combo, W - pad, cY, 26 * pulse, G.combo >= 50 ? '#ff4a3a' : G.combo >= 20 ? '#ff8a1e' : '#ffcf2e', 'right'); txt('COMBO', W - pad, cY + 20, 11, '#fff', 'right'); }
  // XP bar + level
  const xY = Pt ? top + 112 : top + 52, xW = Pt ? W - pad * 2 - 44 : W * 0.4, xX = Pt ? pad + 44 : (W - xW) / 2;
  bar(xX, xY, xW, 9, G.xp / G.need, '#5dff7a', '#1d3324');
  txt('LV' + G.level, xX - 6, xY + 5, 15, '#5dff7a', 'right');
  // weapon slots
  const sz = Pt ? 26 : 30, sY = Pt ? xY + 18 : top + 48; let si = 0;
  for (const k of SLOTK) {
    if (!G.lv[k]) continue;
    const x = pad + si * (sz + 6), y = sY; si++;
    const evo = EVOS.some((e) => e.w === k && G.evo[e.id]);
    hx.fillStyle = evo ? '#ff4fd8' : UPG[k].kind === 'weapon' ? '#3b3f46' : '#2a1d1a'; hx.strokeStyle = '#1a0f12'; hx.lineWidth = 3; hx.beginPath(); hx.rect(x, y, sz, sz); hx.fill(); hx.stroke();
    if (ICONIMG[k].complete) hx.drawImage(ICONIMG[k], x + 2, y + 2, sz - 4, sz - 4);
    const l = G.lv[k]; for (let p = 0; p < l; p++) { hx.fillStyle = evo ? '#ff4fd8' : '#ffcf2e'; hx.fillRect(x + 2 + p * ((sz - 4) / 5), y + sz + 2, (sz - 4) / 5 - 1.5, 4); }
  }
  // boss bar
  let boss = null; for (const b of BIGS) if (b.boss && !b.dead) boss = b;
  if (boss) { const bw = Math.min(W * 0.8, 520), by = Pt ? sY + 50 : top + 96; txt('GRAVEMAW' + (boss.phase === 2 ? ' · ENRAGED' : ''), W / 2, by - 4, 18, '#ff4a3a', 'center'); bar((W - bw) / 2, by + 8, bw, 14, boss.hp / boss.max, boss.phase === 2 ? '#ff2a1a' : '#e84a2a'); }
  // bruiser bars + off-screen threat arrows
  for (const B of BIGS) { if (B.dead) continue; const p = project(B.x, B.y + 5 * B.sc, B.z); const vis = p[2], sx = p[0], sy = p[1]; if (vis && !B.boss && sx > 0 && sx < W && sy > HUD.top + 140) bar(sx - 34, sy, 68, 7, B.hp / B.max, '#ff4a3a'); if (!vis || sx < 0 || sx > W || sy < 0 || sy > H) edgeArrow(B.x, B.y + 3, B.z, '#ff4a3a', B.boss ? 'GRAVEMAW' : 'BRUISER'); }
  if (EXT.open) edgeArrow(EXTRACT.x, hm(EXTRACT.x, EXTRACT.z) + 6, EXTRACT.z, '#7dffb0', 'EXTRACT');
  // speedometer
  const kmh = Math.round(VS.speed * 3.6);
  const spY = Pt ? H - HUD.bot - 6 : H - HUD.bot - 30, spX = Pt ? pad + 40 : W / 2;
  txt(kmh + '', spX, spY, Pt ? 28 : 34, VS.boosting ? '#4fc9ff' : '#fff4dc', 'center'); txt('KM/H', spX + (Pt ? 32 : 40), spY + 6, 12, '#ffcf2e', 'left');
  if (G.airT > 0.35) txt('AIR ' + G.airT.toFixed(1) + 's', W / 2, spY - 34, 20, '#4fc9ff', 'center');
  drawBanners(dt);
}
function drawBanners(dt) {
  const W = HUD.w, H = HUD.h;
  const by = PORTRAIT ? H * 0.31 : H * 0.3;
  for (let k = 0; k < G.banners.length; k++) {
    const b = G.banners[k]; b.t += dt; if (b.t > b.dur) { G.banners.splice(k, 1); k--; continue; }
    if (k !== G.banners.length - 1) continue;
    const a = Math.min(1, b.t * 6, (b.dur - b.t) * 3), pop = 1 + Math.max(0, 0.15 - b.t) * 3;
    hx.globalAlpha = a;
    let px = Math.max(30, H * 0.065) * pop; hx.font = FONT(px); const tw = hx.measureText(b.txt).width; if (tw > W * 0.92) px *= W * 0.92 / tw;
    txt(b.txt, W / 2, by, px, b.col, 'center', 0.14);
    if (b.sub) { let sp = Math.max(13, H * 0.022); hx.font = FONT(sp); const sw = hx.measureText(b.sub).width; if (sw > W * 0.92) sp *= W * 0.92 / sw; txt(b.sub, W / 2, by + px * 0.72, sp, '#fff4dc', 'center', 0.2); }
    hx.globalAlpha = 1;
  }
  if (G.callout && G.state !== 'attract') { const c = G.callout; c.t += dt; if (c.t > 1.4) G.callout = null; else { hx.globalAlpha = Math.min(1, (1.4 - c.t) * 3); const px = Math.max(22, H * 0.036) * (1 + Math.max(0, 0.12 - c.t) * 4); txt(c.txt, W / 2, by + H * (PORTRAIT ? 0.1 : 0.13), px, c.col, 'center'); hx.globalAlpha = 1; } }
}

// ================= 16-BIT mode (low-res render + palette snap + ordered dither) =================
let BIT16 = localStorage.getItem('rr_16') === '1';
const RT16 = new THREE.WebGLRenderTarget(320, 180, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const PAL = ['#1a0f12', '#3b2a2a', '#5d3a34', '#8f4e36', '#c4623e', '#e08a52', '#f4cf98', '#fff4dc', '#ecb47c', '#a84a33', '#e8312a', '#9e1b26', '#ffcf2e', '#ff8a1e', '#47a7e0', '#4fc9ff', '#2b4a6b', '#9bbf8a', '#5e7a4a', '#7dffb0', '#5dff7a', '#ff4fd8', '#8a9096', '#d5dde3'].map((c) => new THREE.Color(c));
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tD: { value: RT16.texture }, uPal: { value: PAL.map((c) => new THREE.Vector3(c.r, c.g, c.b)) }, uRes: { value: new THREE.Vector2(320, 180) } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tD; uniform vec3 uPal[24]; uniform vec2 uRes; varying vec2 vU;
    float bayer(vec2 p){ float x = mod(p.x, 4.0), y = mod(p.y, 4.0);
      float a = mod(x, 2.0), b = mod(y, 2.0), c = floor(x / 2.0), d = floor(y / 2.0);
      float v = 4.0 * (2.0 * a * (1.0 - b) + 3.0 * a * b + 1.0 * (1.0 - a) * b) + (2.0 * c * (1.0 - d) + 3.0 * c * d + (1.0 - c) * d);
      return v / 16.0 - 0.5; }
    void main(){ vec3 c = texture2D(tD, vU).rgb; vec3 s = pow(max(c, 0.0), vec3(1.0/2.2));
      s += bayer(floor(vU * uRes)) * 0.09;
      vec3 best = uPal[0]; float bd = 1e9;
      for (int k = 0; k < 24; k++) { vec3 p = pow(uPal[k], vec3(1.0/2.2)); vec3 d = s - p; float dd = dot(d * d, vec3(0.3, 0.59, 0.11)); if (dd < bd) { bd = dd; best = uPal[k]; } }
      gl_FragColor = vec4(best, 1.0);
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
}));
const postScene = new THREE.Scene(); postScene.add(post); post.frustumCulled = false; const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function set16(on) { BIT16 = on; localStorage.setItem('rr_16', on ? '1' : '0'); $('b16').classList.toggle('on', on); resize(); }

// ================= UI wiring =================
function resize() {
  const w = innerWidth, h = innerHeight; PORTRAIT = w / h < 0.8;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const hs = Math.min(2, window.devicePixelRatio || 1); hud.width = w * hs; hud.height = h * hs; HUD.w = w; HUD.h = h; HUD.s = hs;
  const sa = getComputedStyle($('safe')); HUD.top = parseFloat(sa.paddingTop) || 0; HUD.bot = (parseFloat(sa.paddingBottom) || 0) + (TCH.shown ? (PORTRAIT ? 200 : 130) : 0);
  const s = 224 / Math.min(w, h); const rw = Math.max(160, Math.round(w * s)), rh = Math.max(160, Math.round(h * s));
  RT16.setSize(rw, rh); post.material.uniforms.uRes.value.set(rw, rh);
  PS_A.mat.uniforms.uScale.value = PS_X.mat.uniforms.uScale.value = (BIT16 ? rh : h * DPR) * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  DOTSIZE.value = BIT16 ? 2.0 : 5.0 * DPR;
  document.body.classList.toggle('portrait', PORTRAIT);
}
addEventListener('resize', resize);
function startPlay() {
  auInit();
  document.body.classList.remove('att', 'res'); $('title').classList.remove('on'); $('result').classList.remove('on'); $('pause').classList.remove('on'); $('cards').classList.remove('on'); CARDS = null;
  resetRun(false); G.state = 'play'; G.botOn = BOT;
  banner('GO!', 'SURVIVE 6:00 · REACH EXTRACTION', '#ffcf2e', 2.4);
}
function togglePause(force) {
  if (G.state === 'play' && force !== false) { G.state = 'paused'; $('pause').classList.add('on'); auSilence(); if (AU.ac) AU.ac.suspend(); }
  else if (G.state === 'paused' && force !== true) { G.state = 'play'; $('pause').classList.remove('on'); if (AU.ac) AU.ac.resume(); }
}
function attract() { G.state = 'attract'; resetRun(true); $('title').classList.add('on'); document.body.classList.add('att'); }
let resultT = 0;
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  KEYS.add(e.code);
  if (e.repeat) return;
  auInit();
  if (e.code === 'KeyM') { auMute(!AU.muted); $('bmute').classList.toggle('on', AU.muted); return; }
  if (e.code === 'KeyH') { set16(!BIT16); return; }
  if (G.state === 'attract') { startPlay(); return; }
  if (G.state === 'levelup') {
    if (performance.now() - cardOpenT < 250) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') chooseCard(0); else if (e.code === 'Digit2' || e.code === 'Numpad2') chooseCard(1); else if (e.code === 'Digit3' || e.code === 'Numpad3') chooseCard(2);
    else if (['KeyA', 'ArrowLeft', 'KeyW', 'ArrowUp'].includes(e.code)) { cardSel = (cardSel + 2) % 3; highlightCard(); }
    else if (['KeyD', 'ArrowRight', 'KeyS', 'ArrowDown'].includes(e.code)) { cardSel = (cardSel + 1) % 3; highlightCard(); }
    else if (['Enter', 'Space', 'KeyJ', 'NumpadEnter'].includes(e.code)) chooseCard(cardSel);
    return;
  }
  if ((G.state === 'dead' || G.state === 'win')) { if (['Enter', 'Space', 'KeyR', 'NumpadEnter'].includes(e.code) && performance.now() - resultT > 700) startPlay(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter') { togglePause(); return; }
  if (e.code === 'KeyR' && G.state === 'play') INP.reset = true;
});
addEventListener('keyup', (e) => KEYS.delete(e.code));
addEventListener('blur', () => { KEYS.clear(); TCH.gas = TCH.brake = TCH.nitro = TCH.drift = false; TCH.stickId = -1; TCH.steer = 0; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { KEYS.clear(); togglePause(true); } });
// tap anywhere on the title / attract
$('gl').addEventListener('pointerdown', (e) => { auInit(); if (G.state === 'attract') { e.preventDefault(); startPlay(); } });
$('title').addEventListener('pointerdown', (e) => { e.preventDefault(); startPlay(); });
$('retry').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); startPlay(); });
$('resume').addEventListener('pointerdown', (e) => { e.preventDefault(); togglePause(false); });
$('restart').addEventListener('pointerdown', (e) => { e.preventDefault(); startPlay(); });
$('bpause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.state === 'play' || G.state === 'paused') togglePause(); else if (G.state === 'attract') startPlay(); });
$('bmute').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); auInit(); auMute(!AU.muted); $('bmute').classList.toggle('on', AU.muted); });
$('b16').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); set16(!BIT16); });
$('bmute').classList.toggle('on', AU.muted); $('b16').classList.toggle('on', BIT16);
// touch controls: floating steer stick (left half) + GAS / BRAKE / NITRO / DRIFT
function showTouch() { if (TCH.shown) return; TCH.shown = true; document.body.classList.add('touch'); document.querySelector('#title .go').textContent = 'TAP TO DRIVE'; $('touch').classList.add('on'); resize(); }
if (TOUCH) showTouch();
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') showTouch(); }, true);
const stickZone = $('stickzone'), knob = $('knob'), ring = $('ring');
stickZone.addEventListener('pointerdown', (e) => {
  e.preventDefault(); auInit(); if (G.state === 'attract') { startPlay(); }
  if (G.state !== 'play') return;
  stickZone.setPointerCapture(e.pointerId); TCH.stickId = e.pointerId; TCH.sx = e.clientX; TCH.sy = e.clientY; TCH.steer = 0; TCH.ay = 0;
  ring.style.transform = `translate(${e.clientX - 60}px,${e.clientY - 60}px)`; ring.classList.add('on'); knob.style.transform = 'translate(0px,0px)';
});
stickZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== TCH.stickId) return;
  const dx = clamp(e.clientX - TCH.sx, -55, 55), dy = clamp(e.clientY - TCH.sy, -55, 55);
  TCH.steer = Math.abs(dx) < 6 ? 0 : dx / 55; TCH.ay = dy / 55; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const endStick = (e) => { if (e.pointerId !== TCH.stickId) return; TCH.stickId = -1; TCH.steer = 0; TCH.ay = 0; ring.classList.remove('on'); };
stickZone.addEventListener('pointerup', endStick); stickZone.addEventListener('pointercancel', endStick);
for (const [id, key] of [['tgas', 'gas'], ['tbrake', 'brake'], ['tnitro', 'nitro'], ['tdrift', 'drift']]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); auInit(); if (G.state === 'attract') startPlay(); b.setPointerCapture(e.pointerId); TCH[key] = true; b.classList.add('down'); });
  const up = () => { TCH[key] = false; b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
}
addEventListener('contextmenu', (e) => e.preventDefault());
let lastNitroCss = -1;
function touchVisual() {
  if (!TCH.shown) return;
  const k = Math.round(G.nitro / G.nitroMax * 20); if (k !== lastNitroCss) { lastNitroCss = k; $('tnitro').style.setProperty('--n', (k * 5) + '%'); }
}
function bestLine() { const b = G.best; $('tbest').textContent = b ? `BEST RUN · ${b.score.toLocaleString()} pts · ${b.kills} kills · ${fmtT(b.t)}${b.won ? ' · EXTRACTED' : ''}` : 'NO RUNS YET · BE THE FIRST ROADKILL'; }

// ================= main loop =================
const FPS = { v: 0, n: 0, t: 0, min: 999, simMs: 0, rMs: 0 };
let last = performance.now();
let MANUAL = false;
function frame(now, forced) {
  if (forced === undefined) { requestAnimationFrame(frame); if (MANUAL) { last = now; return; } }
  let dt = forced !== undefined ? forced : (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
  G.real += dt; G.frames++;
  FPS.n++; FPS.t += dt; if (FPS.t >= 1) { FPS.v = FPS.n / FPS.t; FPS.min = Math.min(FPS.min, FPS.v); FPS.n = 0; FPS.t = 0; }
  const t0 = performance.now();
  const sim = G.state === 'play' || G.state === 'attract' || G.state === 'dead' || G.state === 'win';
  if (G.hitstop > 0) G.hitstop -= dt;
  else if (sim) {
    if (G.slowT > 0) G.slowT -= dt;
    G.timeScale = G.slowT > 0 ? 0.28 : 1;
    G.acc += dt * G.timeScale; let n = 0;
    while (G.acc >= STEP && n < 6) { simStep(STEP); G.acc -= STEP; n++; if (!(G.state === 'play' || G.state === 'attract' || G.state === 'dead' || G.state === 'win')) break; }
    if (n >= 6) G.acc = 0;
  }
  G.shake = Math.max(0, G.shake - dt * 1.6);
  FPS.simMs = damp(FPS.simMs, performance.now() - t0, 3, dt);
  render(dt, clamp(G.acc / STEP, 0, 1));
}
function render(dt, alpha) {
  const t1 = performance.now();
  const animDt = G.state === 'paused' || G.state === 'levelup' ? 0 : dt * (G.hitstop > 0 ? 0 : G.timeScale);
  vanVisual(alpha, dt);
  cameraUpdate(dt);
  hordeVisual(); pickupVisual(G.real); decalVisual(animDt); gibRender(); rigVisual(animDt);
  for (const B of BIGS) bigPose(B, animDt);
  psStep(PS_A, animDt); psStep(PS_X, animDt); ringsStep(animDt);
  if (DEC.dirty) { decMesh.instanceMatrix.needsUpdate = true; DEC.dirty = false; }
  if (BIT16) { renderer.setRenderTarget(RT16); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam); }
  else renderer.render(scene, camera);
  drawHUD(dt); touchVisual();
  if (AU.on) {
    if (G.state === 'play' || G.state === 'attract') {
      // rpm from a simple 5-speed box
      const v = Math.abs(VS.fwdSpeed), tops = [0, 9, 16, 24, 33, 60];
      let g = VS.gear || 1; if (v > tops[g] * 0.98 && g < 5) g++; else if (g > 1 && v < tops[g - 1] * 0.72) g--; VS.gear = g;
      const lo = tops[g - 1] * 0.6, rpmT = VS.contacts === 0 ? (_ip.gas ? 6200 : 3200) : 900 + clamp((v - lo) / (tops[g] - lo), 0, 1) * 5200 + (_ip.gas ? 400 : 0);
      VS.rpm = damp(VS.rpm || 900, rpmT, 8, dt);
      auEngine(VS.rpm, _ip.gas, VS.boosting, W.flameOn, !!G.lv.saw, W.sawHit, VS.speed, VS.drift > 0.5 && VS.speed > 10, dt);
      AU.mus.gain.setTargetAtTime(G.state === 'attract' ? 0.18 : 0.3, AU.ac.currentTime, 0.3);
      auMusic();
    }
  }
  if (G.state === 'dead' || G.state === 'win') { if (!resultT) resultT = performance.now(); } else resultT = 0;
  FPS.rMs = damp(FPS.rMs, performance.now() - t1, 3, dt);
}
// ================= test hooks =================
window.__wv = {
  G, VS, FPS, BIGS, HORDE, renderer, get zHigh() { return zHigh; },
  start: () => startPlay(), attract,
  bot: (on) => { G.botOn = on; },
  advance: (sec) => { const n = Math.round(sec / STEP); for (let k = 0; k < n; k++) { if (G.state === 'levelup' && CARDS) chooseCard(0); if (G.state === 'paused') break; simStep(STEP); } render(1 / 60, 1); return __wv.stats(); },
  stats: () => ({ st: G.state, t: +G.t.toFixed(1), hp: Math.round(G.hp), kills: G.kills, alive: HORDE.alive, corpses: HORDE.corpses, lvl: G.level, lv: JSON.stringify(G.lv), evo: Object.keys(G.evo).join(','), fps: +FPS.v.toFixed(1), simMs: +FPS.simMs.toFixed(2), rMs: +FPS.rMs.toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, spd: +VS.speed.toFixed(1), y: +VS.pos.y.toFixed(1), pos: [+VS.pos.x.toFixed(0), +VS.pos.z.toFixed(0)], up: +VS.upY.toFixed(2), bigs: BIGS.length, boss: G.boss ? Math.round(G.boss.hp) : -1, ext: G.extract, zt: zGeo.attributes.position.count / 3 | 0, err: __wvErr.n, el: __wvErr.last }),
  give: (k, n = 1) => { G.lv[k] = Math.min(5, (G.lv[k] || 0) + n); updateWeaponRigs(); },
  evo: (id) => { G.evo[id] = true; updateWeaponRigs(); },
  manual: (on) => { MANUAL = on; }, frame: (dt) => frame(performance.now(), dt),
  hurtBoss: (d) => { if (G.boss && !G.boss.dead) bigHurt(G.boss, d, 'mg'); },
  kill: () => vanDamage(9999, false),
  setHp: (v) => { G.hp = v; }, spawnBoss, bruiser, openExtraction, set16, place: (x, z, yaw) => vanReset(x, z, yaw || 0),
};
resize(); bestLine(); attract();
requestAnimationFrame(frame);


// =====================================================================================================
// LIVE AT ELEVEN: the camera is a character. A WKRK Action News crew (camera operator + reporter Dana Vex)
// follows the hero on foot; the game view is their camera feed. Ratings = score, earned only on camera.
// =====================================================================================================
const PORTRAIT = () => innerHeight > innerWidth * 1.15;
const GAME_LEN = 165;                 // game seconds for the 10:57:00 -> 11:00:00 PM broadcast clock (sped up)
const TARGET = 70;                    // ratings goal (0-100)
const EV = { crewDown: 0, crewUp: 0, replays: 0, offCam: 0, offWhy: {}, cops: 0, copEvaded: 0, busted: 0, pizzaThrown: 0, pizzaEaten: 0, heads: [], hostile: 0, cheer: 0 };
const NEWS = { over: false, won: false, endT: -1, endWhy: '', seen: { ok: false, good: false, why: 'NO FEED', x: 0, y: 0 }, lastCrewAtk: -99, shyDone: false, replayPend: null, wrapT: -1 };
const RT = { v: 26, peak: 26, lastGain: 0, mult: 1, viewers: 12400, vShown: 12400, vPeak: 12400, style: 0, lowT: 0, cheerOn: false };
const _p = new THREE.Vector3(), _w = new THREE.Vector3(), _w2 = new THREE.Vector3();

// ---------------- rigs ----------------
function buildOperator() {
  const J = buildThug({ jacket: '#3b4f6b', pants: '#262636', skin: '#d29a70', hair: 'beanie', hairC: '#2fd3ff', shoe: '#14101f', weapon: null, sleeve: true });
  const cam = J.cam = grp(J.torso, -0.25, 0.8, 0.04); cam.userData.mat = J.mat;
  part(cam, G.box(0.24, 0.28, 0.62), '#2b2d3a', 0, 0, 0.02);
  part(cam, G.cyl(0.1, 0.125, 0.26, 12), '#14101f', 0, 0, 0.44, { rot: [Math.PI / 2, 0, 0] });
  part(cam, G.box(0.06, 0.07, 0.34), '#2b2d3a', 0, 0.2, 0.04);
  part(cam, G.box(0.02, 0.1, 0.4), '#ffd23c', 0.125, 0, 0.02, { outline: false });
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2040', fog: false })); tl.position.set(0, 0.17, 0.3); cam.add(tl); J.tally = tl;
  part(J.torso, G.box(0.46, 0.2, 0.05), '#ffd23c', 0, 0.36, -0.2, { outline: false }); // "PRESS" vest band
  return J;
}
function buildReporter() {
  const J = buildThug({ jacket: '#e8384f', pants: '#14101f', skin: '#a8714a', hair: 'none', hairC: '#2a1a12', shoe: '#14101f', weapon: null, sleeve: true });
  part(J.head, G.sph(0.205, 0.18, 0.205), '#2a1a12', 0, 0.29, -0.03);
  part(J.head, G.box(0.42, 0.26, 0.2), '#2a1a12', 0, 0.17, -0.11);
  const m = grp(J.haL, 0, -0.04, 0); m.userData.mat = J.mat;
  part(m, G.cyl(0.025, 0.02, 0.26, 8), '#14101f', 0, 0.1, 0); part(m, G.sph(0.065, 0.065, 0.065), '#9aa3c5', 0, 0.25, 0); part(m, G.box(0.11, 0.09, 0.11), '#ffd23c', 0, 0.15, 0);
  return J;
}
function buildOfficer() {
  const J = buildThug({ jacket: '#1f3f8f', pants: '#14204a', skin: '#c98a5a', hair: 'cap', hairC: '#14204a', shoe: '#14101f', weapon: null, sleeve: true });
  part(J.head, G.box(0.26, 0.03, 0.17), '#14101f', 0, 0.3, 0.2); part(J.head, G.box(0.08, 0.06, 0.02), '#ffd23c', 0, 0.36, 0.17, { outline: false });
  part(J.torso, G.box(0.08, 0.09, 0.03), '#ffd23c', 0.12, 0.42, 0.2, { outline: false });
  return J;
}
const BYS_LOOKS = [
  { jacket: '#ffd23c', pants: '#2f5bd3', skin: '#8d5a3b', hair: 'beanie', hairC: '#ff3d6e', shoe: '#fff' },
  { jacket: '#22c4b4', pants: '#3a2f5a', skin: '#f0b989', hair: 'cap', hairC: '#ff8a3d', shoe: '#14101f' },
  { jacket: '#c9a6ff', pants: '#2c2c3c', skin: '#c98a5a', hair: 'spikes', hairC: '#7dff6b', shoe: '#ffd23c' },
  { jacket: '#ff8a3d', pants: '#14204a', skin: '#e8a878', hair: 'mohawk', hairC: '#2fd3ff', shoe: '#fff' },
];

// ---------------- the crew ----------------
const CREW = { op: new Fighter(buildOperator(), { x: 0, z: 37.5, yaw: Math.PI, hp: 1, r: 0.42 }), rep: new Fighter(buildReporter(), { x: 1.6, z: 37, yaw: Math.PI, hp: 1, r: 0.4 }),
  bear: 0, side: 1, stuckT: 0, dropYaw: 0, run: 0, get state() { return this.op.state; } };
CREW.op.set('film'); CREW.rep.set('film'); CREW.op.crew = true; ALL.push(CREW.op);
// the camera operator NPC tries to keep the hero framed from `bear` (camera yaw convention), can lag, get blocked, get hit
function streetClamp(x, z) {
  x = clamp(x, -LIM + 1, LIM - 1); z = clamp(z, -LIM + 1, LIM - 1);
  const W = SW - 0.6; if (Math.abs(x) > W && Math.abs(z) > W) { if (Math.abs(x) - W < Math.abs(z) - W) x = Math.sign(x) * W; else z = Math.sign(z) * W; }
  return [x, z];
}
function blockedAt(x, z, r) {
  if (Math.abs(x) > SW - 0.5 && Math.abs(z) > SW - 0.5) return true;
  if (Math.abs(x) > LIM - 0.5 || Math.abs(z) > LIM - 0.5) return true;
  for (const c of COLL) {
    if (c.r !== undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; }
    else if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
function updateCrew(dt) {
  const o = CREW.op, rp = CREW.rep; o.st += dt; o.at += dt; rp.st += dt; rp.at += dt;
  let pose, rate = 14;
  o.J.tally.visible = o.state === 'film' && (S.time % 1 < 0.7);
  if (o.state === 'down' || o.state === 'help') {
    o.vel.set(o.kb.x, o.kb.y); o.kb.multiplyScalar(Math.exp(-dt * 3.5)); o.vy -= 22 * dt; o.y = Math.max(0, o.y + o.vy * dt);
    pose = THUG_POSES.down(o.st, o.y <= 0 && o.st > 0.15); rate = 13;
    if (o.state === 'help') { pose.torso = [0.6, 0, 0]; }
  } else if (o.state === 'getup') {
    o.vel.set(0, 0); pose = filmPose(THUG_POSES.getup(clamp(o.st / 0.6, 0, 1), o.J)); if (o.st > 0.6) o.set('film');
  } else {
    // where the shot wants us: behind the hero along the crew bearing, a little further back in portrait
    const D = (PORTRAIT() ? 7.6 : 6.3) + (lockT ? 0.5 : 0);
    const f = camFwd(CREW.bear); let [tx, tz] = streetClamp(hero.pos.x - f[0] * D, hero.pos.z - f[1] * D);
    const dx = tx - o.pos.x, dz = tz - o.pos.z, d = Math.hypot(dx, dz);
    const hd = Math.hypot(hero.pos.x - o.pos.x, hero.pos.z - o.pos.z);
    const top = hd > 11 ? 6.1 : 5.2; // always a touch slower than the hero (6.6): the crew lags when you sprint
    const charged = enemies.some((e) => e.tgtCrew && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 3.2);
    let sp = d < 0.4 || charged ? 0 : Math.min(top, d * 2.2), ux = d > 1e-3 ? dx / d : 0, uz = d > 1e-3 ? dz / d : 0;
    if (sp > 0.3) { // steer around cars, props and buildings
      const ang0 = Math.atan2(ux, uz); let ok = !blockedAt(o.pos.x + ux * 0.9, o.pos.z + uz * 0.9, o.r * 0.8);
      if (!ok) { for (const k of [0.6, 1.2, 1.8, 2.4]) { for (const sd of [CREW.side, -CREW.side]) { const a = ang0 + k * sd; const qx = Math.sin(a), qz = Math.cos(a);
        if (!blockedAt(o.pos.x + qx * 0.9, o.pos.z + qz * 0.9, o.r * 0.8)) { ux = qx; uz = qz; ok = true; CREW.side = sd; break; } } if (ok) break; } }
    }
    o.vel.x = damp(o.vel.x, ux * sp, 6, dt); o.vel.y = damp(o.vel.y, uz * sp, 6, dt);
    o.speed = Math.hypot(o.vel.x, o.vel.y); CREW.run = damp(CREW.run, clamp(o.speed / 5, 0, 1), 5, dt);
    o.yaw += angTo(o.yaw, Math.atan2(hero.pos.x - o.pos.x, hero.pos.z - o.pos.z)) * (1 - Math.exp(-dt * 7));
    pose = filmPose(o.speed > 0.6 ? THUG_POSES.run(o.at, o.speed, o.J) : THUG_POSES.idle(o.at, o.J));
  }
  const ox = o.pos.x, oz = o.pos.z; o.pos.x += o.vel.x * dt; o.pos.z += o.vel.y * dt; collide(o);
  CREW.stuckT = (o.state === 'film' && Math.hypot(o.vel.x, o.vel.y) > 2 && Math.hypot(o.pos.x - ox, o.pos.z - oz) < dt * 0.8) ? CREW.stuckT + dt : Math.max(0, CREW.stuckT - dt);
  applyPose(o.J, pose, rate, dt, false); o.sync(dt);
  // Dana Vex keeps beside the camera (off its right shoulder), mic up; rushes to the operator when he goes down
  let rx, rz, rpose;
  if (o.state === 'down' || o.state === 'help') { rx = o.pos.x + 1.0; rz = o.pos.z + 0.6; }
  else { const f = camFwd(CREW.bear), r = [-f[1], f[0]]; rx = o.pos.x + r[0] * 1.5 + f[0] * 0.4; rz = o.pos.z + r[1] * 1.5 + f[1] * 0.4; [rx, rz] = streetClamp(rx, rz); }
  const ddx = rx - rp.pos.x, ddz = rz - rp.pos.z, dd = Math.hypot(ddx, ddz), rsp = dd < 0.3 ? 0 : Math.min(5.6, dd * 2.5);
  rp.vel.set(dd > 1e-3 ? ddx / dd * rsp : 0, dd > 1e-3 ? ddz / dd * rsp : 0); rp.pos.x += rp.vel.x * dt; rp.pos.z += rp.vel.y * dt; collide(rp);
  const lookAt = (o.state === 'down' || o.state === 'help') ? o.pos : hero.pos;
  rp.yaw += angTo(rp.yaw, Math.atan2(lookAt.x - rp.pos.x, lookAt.z - rp.pos.z)) * (1 - Math.exp(-dt * 6));
  if (rsp > 0.6) rpose = THUG_POSES.run(rp.at, rsp, rp.J); else { rpose = THUG_POSES.idle(rp.at, rp.J); }
  rpose.shL = [-1.5, 0.2, 0.25]; rpose.elL = [-1.2, 0, 0]; rpose.shR = [0.05, 0, -0.12]; rpose.elR = [-0.3, 0, 0]; rpose.torso = [0.02, 0.1, 0]; rpose.neck = [0, 0, 0]; rpose.hips = [0, 0, 0];
  if (o.state === 'down') { rpose.shR = [-1.6, 0, -0.4]; rpose.elR = [-1.4, 0, 0]; }
  applyPose(rp.J, rpose, 12, dt, false); rp.sync(dt);
}
function filmPose(p) { // camera up on the right shoulder, left hand on the lens
  p.shR = [-2.55, 0, -0.25]; p.elR = [-1.75, 0, 0]; p.haR = [0, 0, 0]; p.shL = [-1.45, 0.35, 0.35]; p.elL = [-1.15, 0, 0];
  p.torso = [p.torso[0] * 0.4, 0, 0]; p.neck = [0, 0, 0]; p.hips = [0, 0, 0]; return p;
}
NEWS.wantCrewAttack = (e) => {
  if (CREW.state !== 'film' || NEWS.over || REPLAY.on) return false;
  const d = Math.hypot(CREW.op.pos.x - e.pos.x, CREW.op.pos.z - e.pos.z);
  let go = false;
  if (!NEWS.shyDone && S.kills >= 1 && d < 10 && S.time > 25) { go = true; NEWS.shyDone = true; }            // one camera-shy thug per broadcast, guaranteed
  else if (NEWS.shyDone && d < 3.2 && S.time - NEWS.lastCrewAtk > 28 && Math.random() < 0.003) go = true;  // after that, only crews that crowd the fight
  if (go) { NEWS.lastCrewAtk = S.time; spawnSprite(WTX.nocam, _w.set(e.pos.x, e.pos.y + 2.6 * e.scale, e.pos.z), 0.95, 1.4, { kind: 'word', aspect: 512 / 160 }); dana('nocam'); }
  return go;
};
NEWS.hitCrew = (e) => {
  const o = CREW.op; if (o.state !== 'film') return;
  const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  o.set('down'); o.kb.set(dx / d * 5, dz / d * 5); o.vy = 4; o.y = 0.01; o.flash = 1;
  CREW.dropYaw = CAM.yaw + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.7); // the camera lands looking roughly where it was pointing
  S.shake = 1; EV.crewDown++; sfx('heavy'); sfx2('crash');
  headline('WKRK CREW ATTACKED ON LIVE TV', 'alert'); dana('crewdown');
  spawnSprite(FXT.star, _w.set(o.pos.x, o.pos.y + 1.5, o.pos.z), 1.2, 0.3);
};
NEWS.interact = () => pressed('e', 'f');
NEWS.canHelp = () => CREW.state === 'down' && CREW.op.st > 0.5 && Math.hypot(hero.pos.x - CREW.op.pos.x, hero.pos.z - CREW.op.pos.z) < 2.4;
NEWS.startHelp = () => { CREW.op.set('help'); };
NEWS.finishHelp = () => {
  const o = CREW.op; o.set('getup'); o.y = 0; EV.crewUp++;
  CREW.bear = Math.atan2(-(hero.pos.x - o.pos.x), -(hero.pos.z - o.pos.z)); // pick the shot back up from where he stands
  headline('HERO HELPS WKRK CREW BACK ON ITS FEET', 'hype'); dana('crewup'); flashBack();
  gain(6, 'CREW SAVED', true);
};

// ---------------- the camera: the operator's shoulder cam (or the fallen one) ----------------
const CAMV = { look: new THREE.Vector3(0, 1.2, 28), fov: 58, t: 0, roll: 0, eye: new THREE.Vector3() };
function updateCamera(dt, rdt) {
  CAMV.t += rdt;
  // orbit input = direct the crew: Q/E, drag or the right stick changes where the operator stands
  CREW.bear -= IN.look * rdt * 2.0; CREW.bear -= IN.dragX * 0.0062; IN.dragX = IN.dragY = 0;
  const p = hero.pos, fighting = lockT && lockT.alive;
  const idleLook = S.time - IN.lastLook > 1.4;
  if (idleLook && hero.speed > 1 && hero.state === 'move') { // swing round behind a running hero (slowly: the crew has to physically get there)
    const heading = Math.atan2(-hero.vel.x, -hero.vel.y), d = angTo(CREW.bear, heading);
    if (Math.abs(d) < 2.2) CREW.bear += d * (1 - Math.exp(-rdt * 0.6 * clamp(hero.speed / 6, 0, 1)));
  }
  if (fighting && idleLook) { const tx = lockT.pos.x - p.x, tz = lockT.pos.z - p.z, ty = Math.atan2(-tx, -tz), d = angTo(CREW.bear, ty); if (Math.abs(d) > 0.6) CREW.bear += (d - Math.sign(d) * 0.6) * (1 - Math.exp(-rdt * 1.6)); }
  CREW.bear = wrapA(CREW.bear);
  const o = CREW.op, down = o.state === 'down' || o.state === 'help';
  let eye = CAMV.eye, sway = 0.005 + CREW.run * 0.014;
  if (down) { // the camera lies on the asphalt next to him, tilted, still rolling
    const a = CREW.dropYaw, f = camFwd(a), r = [-f[1], f[0]];
    eye.set(o.pos.x + r[0] * 0.55, 0.34 + o.pos.y, o.pos.z + r[1] * 0.55);
    CAMV.look.set(eye.x + f[0] * 6, 0.95, eye.z + f[1] * 6); CAMV.roll = damp(CAMV.roll, 0.48, 8, rdt); sway = 0.02;
  } else {
    o.J.cam.localToWorld(eye.set(0, 0.04, 0.72)); // just in front of the lens
    const tx = p.x + (fighting ? (lockT.pos.x - p.x) * 0.25 : 0), tz = p.z + (fighting ? (lockT.pos.z - p.z) * 0.25 : 0), ty = p.y + 1.1 + hero.y * 0.6;
    const pan = o.state === 'getup' ? 2 : 4.5 - CREW.run * 1.2; // pan lag: the operator can't whip the camera instantly
    CAMV.look.x = damp(CAMV.look.x, tx, pan, rdt); CAMV.look.z = damp(CAMV.look.z, tz, pan, rdt); CAMV.look.y = damp(CAMV.look.y, ty, pan, rdt);
    CAMV.roll = damp(CAMV.roll, 0, 3, rdt);
  }
  camera.position.copy(eye);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.12; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.up.set(0, 1, 0); camera.lookAt(CAMV.look);
  const t = CAMV.t; // handheld sway
  camera.rotateY((Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.9 + 1)) * sway); camera.rotateX((Math.sin(t * 1.7 + 2) + 0.4 * Math.sin(t * 3.7)) * sway * 0.8);
  camera.rotateZ(CAMV.roll + Math.sin(t * 0.9) * sway * 0.7 + (down ? Math.sin(t * 23) * 0.012 : 0));
  // zoom: the operator rides the zoom to keep the hero a readable size (wider in portrait)
  const dist = Math.max(1, Math.hypot(p.x - eye.x, p.z - eye.z)), aspect = innerWidth / innerHeight;
  const tanH = Math.max(3.7 / dist, (aspect < 1 ? 3.1 : 6.2) / dist / aspect);
  const fovW = down ? 74 : clamp(2 * Math.atan(tanH) * 180 / Math.PI, 30, 84);
  CAMV.fov = damp(CAMV.fov, fovW, 2.5, rdt); if (Math.abs(camera.fov - CAMV.fov) > 0.05) { camera.fov = CAMV.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  // control frame = what the viewer sees
  const fx = CAMV.look.x - eye.x, fz = CAMV.look.z - eye.z; if (Math.hypot(fx, fz) > 0.2) CAM.yaw = Math.atan2(-fx, -fz);
  computeSeen();
}
function computeSeen() {
  const r = NEWS.seen; r.ok = false; r.good = false;
  if (CREW.state === 'down' || CREW.state === 'help') { r.why = 'NO FEED'; return; }
  _p.set(hero.pos.x, hero.pos.y + 1.0 + hero.y, hero.pos.z).project(camera); r.x = _p.x; r.y = _p.y;
  if (_p.z > 1 || Math.abs(_p.x) > 0.94 || Math.abs(_p.y) > 0.94) { r.why = 'OUT OF FRAME'; return; }
  const e = camera.position, hx = hero.pos.x, hy = hero.pos.y + 1.0 + hero.y, hz = hero.pos.z;
  for (const b of BLD) if (segBox(e.x, e.y, e.z, hx, hy, hz, b, 0) < 0.97) { r.why = 'VIEW BLOCKED'; return; }
  r.ok = true; r.why = ''; r.dist = Math.hypot(hx - e.x, hz - e.z); r.good = frameGood(lockT && lockT.alive ? lockT : null);
}
function frameGood(foe) {
  const r = NEWS.seen; if (!r.ok || Math.abs(r.x) > 0.4 || Math.abs(r.y) > 0.55 || r.dist > 10.5) return false;
  if (foe) { _w2.set(foe.pos.x, foe.pos.y + 1.0 + foe.y, foe.pos.z).project(camera); if (_w2.z > 1 || Math.abs(_w2.x) > 0.88 || Math.abs(_w2.y) > 0.92) return false; }
  return true;
}

// ---------------- ratings ----------------
function gain(amt, label, force, foe) {
  const s = NEWS.seen;
  if (!force && !s.ok) { offCamera(s.why); return 0; }
  const m = force ? 1 : (frameGood(foe) ? 2 : 1); const g = amt * m;
  RT.v = clamp(RT.v + g, 0, 100); RT.peak = Math.max(RT.peak, RT.v); RT.lastGain = S.time; RT.mult = m;
  popGain('+' + g.toFixed(g < 10 ? 1 : 0) + (m > 1 ? ' ×2' : '') + (label ? ' ' + label : ''), m > 1);
  return g;
}
let offT = 0;
function offCamera(why) {
  EV.offCam++; EV.offWhy[why] = (EV.offWhy[why] || 0) + 1; offT = 1.4;
  $('offWhy').textContent = why === 'NO FEED' ? 'NO FEED · NO RATINGS' : why === 'VIEW BLOCKED' ? 'VIEW BLOCKED · NO RATINGS' : 'OUT OF FRAME · NO RATINGS';
  $('offcam').classList.add('on');
}
NEWS.onHit = (e, dmg, heavy, kill) => {
  if (e.tgtCrew && e.state !== 'windup' && e.state !== 'attack') { e.tgtCrew = false; if (CREW.state === 'film') { headline('HERO SHIELDS NEWS CREW FROM ATTACK', 'hype'); } }
  const air = hero.state === 'airatk' || hero.y > 0.3;
  const g = gain((heavy ? 1.0 : 0.5) * (1 + Math.min(S.combo, 12) * 0.05) * (air ? 1.3 : 1), S.combo >= 3 ? S.combo + ' HITS' : '', false, e);
  if (g > 0) {
    RT.style += (S.combo >= 3 ? S.combo * 35 : 10) + (air ? 260 : 0);
    if (!NEWS.firstHit) { NEWS.firstHit = true; headline('MASKED VIGILANTE BRAWLS ON 5TH & GRAND', 'news'); }
    else if (S.combo === 5 || S.combo === 8) headline(S.combo + '-HIT COMBO STUNS WITNESSES ON GRAND AVE', 'hype');
  }
  if (kill) {
    const seen = NEWS.seen.ok;
    if (seen && (heavy || S.combo >= 4 || e.big) && !NEWS.replayPend && !REPLAY.on && S.time - REPLAY.lastT > 7) {
      NEWS.replayPend = { t: 0.75, e, combo: S.combo, big: e.big, air, kind: air ? 'AIR SLASH' : (hero.atkN === 3 ? 'SPIN SLASH' : 'COMBO'), gain: 0 };
    }
  }
};
NEWS.onKO = (e) => {
  const left = enemies.filter((q) => q.alive && q.state !== 'dead').length;
  const g = gain(5 + (e.big ? 3 : 0), 'TAKEDOWN', false, e);
  if (g > 0) { RT.style += 600; if (NEWS.replayPend && NEWS.replayPend.e === e) NEWS.replayPend.gain = g; }
  if (left === 0) headline('STREET GANG BROKEN UP AT 5TH & GRAND', 'hype');
  else if (e.big) headline('BIGGEST GANG MEMBER TOPPLED ON GRAND AVE', 'hype');
  else if (g > 0) headline(['GANG MEMBER DOWN — ' + left + ' LEFT', 'ANOTHER THUG HITS THE PAVEMENT — ' + left + ' TO GO', 'STREET GANG ON THE ROPES — ' + left + ' LEFT'][S.kills % 3], 'news');
  else headline('REPORTS OF A TAKEDOWN JUST OFF CAMERA', 'news');
  dana(g > 0 ? 'ko' : 'missed');
};
NEWS.onHeroDown = (ko) => { if (ko) { RT.v = Math.max(0, RT.v - 8); headline('VIGILANTE TAKES A BEATING AT 5TH & GRAND', 'hostile'); } };
function updateRatings(dt) {
  const idle = S.time - RT.lastGain;
  if (idle > 2.5) RT.v = Math.max(0, RT.v - (NEWS.seen.why === 'NO FEED' ? 2.0 : 1.1) * dt);
  RT.viewers = 9000 + RT.v * 820 + RT.style;
  RT.vShown = damp(RT.vShown, RT.viewers, 1.5, dt); RT.vPeak = Math.max(RT.vPeak, RT.vShown);
  // low ratings: hostile chyron, then the police get called
  if (RT.v < 22 && S.time > 4 && !NEWS.hostile) { NEWS.hostile = true; EV.hostile++; headline(['IS THIS MASKED "HERO" A MENACE?', 'VIGILANTE OR VANDAL? VIEWERS UNIMPRESSED'][EV.hostile % 2], 'hostile'); dana('low'); }
  if (RT.v > 32) NEWS.hostile = false;
  RT.lowT = RT.v < 15 ? RT.lowT + dt : 0;
  if (RT.lowT > 2 && !COP.on && S.time - COP.lastEnd > 20 && !NEWS.over) callCops();
  // high ratings: the corners cheer and toss a slice
  const hype = RT.v >= 65;
  if (hype && !RT.cheerOn) { RT.cheerOn = true; EV.cheer++; headline('CROWD CHEERS MASKED HERO AT 5TH & GRAND', 'hype'); BYS.tossT = 0.8; }
  if (RT.v < 58) RT.cheerOn = false;
}

// ---------------- bystanders on the corners ----------------
const BYS = { list: [], tossT: 99 };
[[9.7, 9.7], [-9.7, 9.7], [9.7, -9.7], [-9.7, -9.7]].forEach(([x, z], i) => {
  const look = Object.assign({ weapon: null, sleeve: i % 2 === 0 }, BYS_LOOKS[i]); const J = buildThug(look); scene.add(J.root);
  J.root.position.set(x, CURB, z); const yaw = Math.atan2(-x, -z); J.root.rotation.y = yaw;
  BYS.list.push({ J, x, z, yaw, t: Math.random() * 5, woo: rnd(1, 3) });
});
function updateBystanders(dt) {
  for (const b of BYS.list) {
    b.t += dt; const p = blank(); legsStance(p, 0.1, 0.12);
    const ty = Math.atan2(hero.pos.x - b.x, hero.pos.z - b.z); b.yaw += angTo(b.yaw, ty) * (1 - Math.exp(-dt * 2)); b.J.root.rotation.y = b.yaw;
    if (RT.cheerOn) { const j = Math.abs(Math.sin(b.t * 7)); p.y = j * 0.12; p.shL = [-2.8 + j * 0.3, 0, 0.35]; p.shR = [-2.8 + j * 0.3, 0, -0.35]; p.elL = p.elR = [-0.3, 0, 0];
      b.woo -= dt; if (b.woo <= 0) { b.woo = rnd(1.8, 3.5); spawnSprite(WTX.woo, _w.set(b.x, 2.6, b.z), 0.7, 1.0, { kind: 'word', aspect: 512 / 160, depth: true }); } }
    else if (NEWS.hostile) { p.shL = [-1.2, 0.9, 0.3]; p.shR = [-1.2, -0.9, -0.3]; p.elL = [-1.6, 0, 0]; p.elR = [-1.6, 0, 0]; p.neck = [0.15, Math.sin(b.t * 2) * 0.3, 0];
      b.woo -= dt; if (b.woo <= 0) { b.woo = rnd(2.5, 5); spawnSprite(WTX.boo, _w.set(b.x, 2.6, b.z), 0.6, 1.0, { kind: 'word', aspect: 512 / 160, depth: true }); } }
    else { p.shL = [0.08, 0, 0.12]; p.shR = [0.08, 0, -0.12]; p.elL = p.elR = [-0.25, 0, 0]; p.y = Math.sin(b.t * 2) * 0.01; }
    applyPose(b.J, p, 10, dt, false);
  }
  if (RT.cheerOn) { BYS.tossT -= dt; if (BYS.tossT <= 0) { BYS.tossT = 12; tossPizza(); } }
  updatePizza(dt);
}
// pizza slice: a thrown health pickup
const PIZ = [];
function buildSlice() {
  const g = new THREE.Group(), mat = toonMat();
  const add = (geo, col, ol = true) => { bakeColor(geo, col); if (ol) addOdir(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); if (ol) m.add(new THREE.Mesh(geo, OUT_PROP)); return m; };
  const w = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 3); w.scale(1, 1, 0.75); add(w, '#ffcf6a');
  const c = new THREE.BoxGeometry(0.66, 0.11, 0.13); c.translate(0, 0.01, -0.33); add(c, '#c9772d');
  for (const [x, z] of [[0.05, 0.05], [-0.1, -0.12], [0.14, -0.15]]) { const s = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10); s.translate(x, 0.045, z); add(s, '#e8384f', false); }
  g.visible = false; scene.add(g); return g;
}
function tossPizza() {
  if (NEWS.over) return; let best = null, bd = 1e9;
  for (const b of BYS.list) { const d = Math.hypot(b.x - hero.pos.x, b.z - hero.pos.z); if (d < bd) { bd = d; best = b; } }
  let s = PIZ.find((q) => !q.g.visible); if (!s) { if (PIZ.length > 3) return; s = { g: buildSlice() }; PIZ.push(s); }
  const [tx, tz] = streetClamp(hero.pos.x + rnd(-1.5, 1.5), hero.pos.z + rnd(-1.5, 1.5));
  Object.assign(s, { state: 'fly', t: 0, dur: 1.1, ax: best.x, az: best.z, tx, tz, life: 16 }); s.g.visible = true; EV.pizzaThrown++;
  spawnSprite(WTX.slice, _w.set(best.x, 2.7, best.z), 0.8, 1.2, { kind: 'word', aspect: 512 / 160 }); sfx2('cheer');
  headline('FANS TOSS A SLICE TO THE MASKED HERO', 'hype');
}
function updatePizza(dt) {
  for (const s of PIZ) {
    if (!s.g.visible) continue; s.t += dt;
    if (s.state === 'fly') { const u = Math.min(1, s.t / s.dur); s.g.position.set(lerp(s.ax, s.tx, u), CURB + 1.4 + Math.sin(u * Math.PI) * 3.2 - u * 1.0, lerp(s.az, s.tz, u)); s.g.rotation.set(s.t * 9, s.t * 5, 0); if (u >= 1) { s.state = 'land'; s.t = 0; } }
    else { s.g.position.y = groundY(s.tx, s.tz) + 0.45 + Math.sin(s.t * 4) * 0.08; s.g.rotation.set(0.35, s.t * 2.5, 0); s.life -= dt;
      if (Math.hypot(hero.pos.x - s.tx, hero.pos.z - s.tz) < 1.2) { s.g.visible = false; hero.hp = Math.min(hero.maxHp, hero.hp + 30); EV.pizzaEaten++; sfx2('pickup'); spawnSprite(WTX.yum, _w.set(hero.pos.x, 2.4, hero.pos.z), 0.8, 1.0, { kind: 'word', aspect: 512 / 160 }); gain(2, 'CROWD PLEASER'); }
      if (s.life <= 0) s.g.visible = false; }
  }
}

// ---------------- police: low ratings send one cruiser; no fighting cops, avoid or outrun ----------------
function buildCruiser() {
  const g = new THREE.Group(), mat = toonMat();
  const add = (geo, col, ol = true) => { bakeColor(geo, col); if (ol) addOdir(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); if (ol) m.add(new THREE.Mesh(geo, OUT_PROP)); return m; };
  const B = (w, h, d, x, y, z) => { const q = new THREE.BoxGeometry(w, h, d); q.translate(x, y, z); return q; };
  add(B(1.9, 0.75, 4.3, 0, 0.72, 0), '#f2f2f2'); add(B(1.94, 0.42, 1.9, 0, 0.66, 0.05), '#1b2a5a', false);
  add(B(1.7, 0.7, 2.2, 0, 1.45, -0.2), '#f2f2f2');
  add(B(1.5, 0.48, 0.05, 0, 1.47, 0.9), '#5d8ab8', false); add(B(1.5, 0.48, 0.05, 0, 1.47, -1.31), '#5d8ab8', false);
  for (const s of [-1, 1]) add(B(0.05, 0.46, 1.8, s * 0.86, 1.47, -0.2), '#5d8ab8', false);
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2b2340'); }
  add(B(1.5, 0.18, 0.06, 0, 0.86, 2.16), '#fff6b0', false); add(B(1.5, 0.16, 0.06, 0, 0.86, -2.16), '#ff3d6e', false);
  add(B(1.3, 0.14, 0.36, 0, 1.87, -0.2), '#14101f');
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#ff2040', fog: false })); red.position.set(-0.36, 1.99, -0.2); g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#2f6bff', fog: false })); blue.position.set(0.36, 1.99, -0.2); g.add(blue);
  // door decal: an original "CITY PATROL" lettering
  const dt = canvasTex(256, 64, (c) => { c.fillStyle = '#1b2a5a'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = '900 34px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CITY PATROL', 128, 34); });
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.4), new THREE.MeshBasicMaterial({ map: dt })); pl.position.set(s * 0.985, 0.66, 0.05); pl.rotation.y = s * Math.PI / 2; g.add(pl); }
  g.userData = { red, blue }; g.visible = false; scene.add(g); return g;
}
const COP = { on: false, car: buildCruiser(), f: new Fighter(buildOfficer(), { x: 0, z: -60, yaw: 0, hp: 1, r: 0.42 }), state: 'off', t: 0, lastEnd: -99, path: [], pi: 0, chaseT: 0, farT: 0, coll: null, bld: null };
COP.f.root.visible = false;
function armOf(x, z) { if (Math.abs(x) < RW + 3 && Math.abs(z) < RW + 3) return null; return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)]; }
function callCops() {
  COP.on = true; COP.state = 'drive'; COP.t = 0; EV.cops++;
  // enter from the end of a street arm the hero isn't on, swing through the intersection, pull up near the hero
  const ha = armOf(hero.pos.x, hero.pos.z), arms = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((a) => !ha || a[0] !== ha[0] || a[1] !== ha[1]);
  const A = arms[(Math.random() * arms.length) | 0], lane = 2.6;
  const start = [A[0] * 41 + (A[1] ? -A[1] * lane : 0), A[1] * 41 + (A[0] ? A[0] * lane : 0)];
  const mid = [A[0] * 9 + (A[1] ? -A[1] * lane : 0), A[1] * 9 + (A[0] ? A[0] * lane : 0)];
  let stop;
  if (ha) { const along = ha[0] ? hero.pos.x : hero.pos.z, s = Math.sign(along), at = clamp(Math.abs(along) - 10, 8, 36) * s; stop = ha[0] ? [at, -s * lane] : [s * lane, at]; }
  else { stop = [A[0] * 12 + (A[1] ? -A[1] * lane : 0), A[1] * 12 + (A[0] ? A[0] * lane : 0)]; }
  COP.path = [start, mid, stop]; COP.pi = 1; COP.car.position.set(start[0], 0, start[1]); COP.car.visible = true;
  COP.car.rotation.y = Math.atan2(mid[0] - start[0], mid[1] - start[1]);
  headline('POLICE CALLED TO 5TH & GRAND', 'hostile'); dana('cops'); sfx2('siren');
}
function carCollider(on) {
  const i = COLL.indexOf(COP.coll); if (i >= 0) COLL.splice(i, 1); const j = BLD.indexOf(COP.bld); if (j >= 0) BLD.splice(j, 1); COP.coll = COP.bld = null;
  if (!on) return; const c = COP.car.position, along = Math.abs(Math.sin(COP.car.rotation.y)) > 0.5;
  const bx = along ? 2.2 : 1.0, bz = along ? 1.0 : 2.2;
  COP.coll = { x0: c.x - bx, x1: c.x + bx, z0: c.z - bz, z1: c.z + bz }; COP.bld = { x0: c.x - bx, x1: c.x + bx, z0: c.z - bz, z1: c.z + bz, h: 1.9 };
  COLL.push(COP.coll); BLD.push(COP.bld);
}
function updateCop(dt) {
  const car = COP.car, f = COP.f;
  if (car.visible) { const k = (S.time * 6) % 2 < 1; car.userData.red.material.color.set(k ? '#ff2040' : '#4a0a14'); car.userData.blue.material.color.set(k ? '#1a2440' : '#2f8bff'); }
  if (!COP.on) return; COP.t += dt;
  const drive = (sp) => { // follow waypoints; shove anyone in the way
    const w = COP.path[COP.pi]; const dx = w[0] - car.position.x, dz = w[1] - car.position.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { COP.pi++; return COP.pi >= COP.path.length; }
    const ty = Math.atan2(dx, dz); car.rotation.y += angTo(car.rotation.y, ty) * (1 - Math.exp(-dt * 5));
    const s = Math.min(sp, d * 2 + 2); car.position.x += Math.sin(car.rotation.y) * s * dt; car.position.z += Math.cos(car.rotation.y) * s * dt;
    for (const a of [...ALL, CREW.rep]) { const ddx = a.pos.x - car.position.x, ddz = a.pos.z - car.position.z, dd = Math.hypot(ddx, ddz); if (dd < 2.4 && dd > 1e-3) { a.pos.x = car.position.x + ddx / dd * 2.4; a.pos.z = car.position.z + ddz / dd * 2.4; } }
    return false;
  };
  if (COP.state === 'drive') {
    if (drive(14)) { COP.state = 'exit'; COP.t = 0; carCollider(true);
      const r = car.rotation.y; f.pos.set(car.position.x + Math.cos(r) * 1.5, 0, car.position.z - Math.sin(r) * 1.5); f.yaw = r; f.root.visible = true; f.set('run'); COP.chaseT = 0; COP.farT = 0; COP.winded = false;
      spawnSprite(WTX.freeze, _w.set(f.pos.x, 2.7, f.pos.z), 1.0, 1.4, { kind: 'word', aspect: 512 / 160 }); }
  } else if (COP.state === 'exit' || COP.state === 'chase') {
    COP.state = 'chase'; COP.chaseT += dt; f.st += dt; f.at += dt;
    const dx = hero.pos.x - f.pos.x, dz = hero.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    COP.farT = d > 11 ? COP.farT + dt : 0;
    if (hero.state !== 'cuffed' && d < 1.0 && hero.y < 0.5 && hero.state !== 'down') { // gotcha: detained (a penalty, not a fight)
      hero.set('cuffed'); hero.vel.set(0, 0); EV.busted++; RT.v = Math.max(0, RT.v - 10); S.combo = 0;
      headline('VIGILANTE DETAINED BY POLICE AT 5TH & GRAND', 'hostile'); dana('busted'); COP.state = 'cuff'; COP.t = 0;
    } else if (COP.farT > 1.5 || COP.chaseT > 12 || RT.v > 48) { // gave up / stood down
      if (RT.v <= 48) { EV.copEvaded++; headline('VIGILANTE GIVES POLICE THE SLIP', 'news'); dana('evade'); } else headline('POLICE STAND DOWN AS CROWD BACKS HERO', 'hype');
      COP.state = 'back';
    } else {
      const sp = COP.chaseT < 4 ? 5.2 : 3.9; if (COP.chaseT >= 4 && !COP.winded) { COP.winded = true; spawnSprite(WTX.huff, _w.set(f.pos.x, 2.5, f.pos.z), 0.7, 1.2, { kind: 'word', aspect: 512 / 160 }); }
      f.vel.set(dx / (d || 1) * sp, dz / (d || 1) * sp); f.yaw += angTo(f.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 10));
      f.pos.x += f.vel.x * dt; f.pos.z += f.vel.y * dt; collide(f);
      const p = THUG_POSES.run(f.at, sp, f.J); p.shR = [-1.6, 0, -0.2]; p.elR = [-0.2, 0, 0]; applyPose(f.J, p, 14, dt, false);
    }
  } else if (COP.state === 'cuff') {
    f.st += dt; const p = THUG_POSES.idle(f.at, f.J); p.shL = p.shR = [-0.9, 0, 0]; p.elL = p.elR = [-0.6, 0, 0]; applyPose(f.J, p, 10, dt, false);
    f.yaw += angTo(f.yaw, Math.atan2(hero.pos.x - f.pos.x, hero.pos.z - f.pos.z)) * (1 - Math.exp(-dt * 8));
    if (hero.state !== 'cuffed') COP.state = 'back';
  } else if (COP.state === 'back') { // walk back to the cruiser, then drive off
    f.at += dt; const r = car.rotation.y, dx = car.position.x + Math.cos(r) * 1.5 - f.pos.x, dz = car.position.z - Math.sin(r) * 1.5 - f.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.8) { f.root.visible = false; f.pos.set(0, 0, -80); carCollider(false); COP.state = 'leave'; COP.path = [COP.path[2], COP.path[1], COP.path[0]]; COP.pi = 1; }
    else { f.vel.set(dx / d * 4.5, dz / d * 4.5); f.pos.x += f.vel.x * dt; f.pos.z += f.vel.y * dt; collide(f); f.yaw += angTo(f.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 10)); applyPose(f.J, THUG_POSES.run(f.at, 4.5, f.J), 14, dt, false); }
  } else if (COP.state === 'leave') {
    if (drive(14)) { car.visible = false; COP.on = false; COP.state = 'off'; COP.lastEnd = S.time; }
  }
  f.sync(dt);
}
NEWS.onReleased = () => { headline('VIGILANTE RELEASED WITH A WARNING', 'news'); };

// ---------------- word sprites (original) ----------------
const wordTex = (w, fill) => canvasTex(512, 160, (c) => { comicText(c, w, 256, 86, w.length > 8 ? 62 : 84, fill, null, { sx: 1 }); });
const WTX = { woo: wordTex('WOO!', '#ffd23c'), boo: wordTex('BOO!', '#c9a6ff'), nocam: wordTex('NO CAMERAS!', '#ff5fa2'), freeze: wordTex('FREEZE!', '#7fe8ff'), slice: wordTex('HEADS UP!', '#ffd23c'), yum: wordTex('+HP', '#7dff6b'), huff: wordTex('HUFF.. PUFF..', '#c9a6ff'), help: wordTex('HELP!', '#ffd23c') };

// ---------------- instant replay: ring buffer of rig snapshots, played back slow from a new angle ----------------
const REPLAY = { on: false, buf: [], acc: 0, u: 0, dur: 2.7, t0: 0, t1: 0, lastT: -99, focus: new THREE.Vector3(), ang: 0, now: null, info: null, best: null, thumbDone: false };
const ACTJ = () => [hero.J, ...enemies.map((e) => e.J), CREW.op.J, CREW.rep.J, COP.f.J];
const NJ = JOINTS.length * 3 + 7;
function snap(time) {
  const js = ACTJ(), a = new Float32Array(js.length * NJ);
  js.forEach((J, i) => { let k = i * NJ; const r = J.root; a[k++] = r.position.x; a[k++] = r.position.y; a[k++] = r.position.z; a[k++] = r.rotation.y; a[k++] = r.visible ? 1 : 0; a[k++] = J.tilt.position.y; a[k++] = J.hips.position.y;
    for (const j of JOINTS) { const g = J[j]; if (g) { a[k] = g.rotation.x; a[k + 1] = g.rotation.y; a[k + 2] = g.rotation.z; } k += 3; } });
  return { time, a, car: [COP.car.position.x, COP.car.position.z, COP.car.rotation.y, COP.car.visible ? 1 : 0] };
}
function applySnap(A, B, u) {
  const js = ACTJ(), a = A.a, b = B.a;
  js.forEach((J, i) => { let k = i * NJ; const r = J.root, L = (q) => a[q] + (b[q] - a[q]) * u, LA = (q) => a[q] + angTo(a[q], b[q]) * u;
    r.position.set(L(k), L(k + 1), L(k + 2)); r.rotation.y = LA(k + 3); r.visible = a[k + 4] > 0.5; J.tilt.position.y = L(k + 5); J.hips.position.y = L(k + 6); k += 7;
    for (const j of JOINTS) { const g = J[j]; if (g) g.rotation.set(LA(k), LA(k + 1), LA(k + 2)); k += 3; } });
  COP.car.position.x = A.car[0]; COP.car.position.z = A.car[1]; COP.car.rotation.y = A.car[2]; COP.car.visible = A.car[3] > 0.5;
}
function recordReplay(dt) {
  REPLAY.acc += dt; if (REPLAY.acc < 1 / 30) return; REPLAY.acc = 0;
  REPLAY.buf.push(snap(S.time)); if (REPLAY.buf.length > 90) REPLAY.buf.shift();
}
function startReplay(info) {
  if (REPLAY.buf.length < 20) return;
  REPLAY.on = true; REPLAY.u = 0; REPLAY.info = info; REPLAY.thumbDone = false; REPLAY.lastT = S.time; EV.replays++;
  REPLAY.t1 = S.time - 0.15; REPLAY.t0 = REPLAY.t1 - 1.35; REPLAY.now = snap(S.time);
  const e = info.e; REPLAY.focus.set((hero.pos.x + e.pos.x) / 2, 0.9, (hero.pos.z + e.pos.z) / 2);
  const live = Math.atan2(camera.position.x - REPLAY.focus.x, camera.position.z - REPLAY.focus.z), F = REPLAY.focus, others = [CREW.op, CREW.rep, COP.f, ...enemies.filter((q) => q !== e && q.alive && q.state !== 'dead')];
  let best = live + 1.7, bs = -1e9; // a different angle from the live shot, with a clear line to the action
  for (let k = 0; k < 16; k++) { const a = live + 1.1 + k / 16 * (TAU - 2.2), cx = F.x + Math.sin(a) * 4.4, cz = F.z + Math.cos(a) * 4.4; let clear = 9;
    for (const q of others) { if (!q.root.visible) continue; const vx = F.x - cx, vz = F.z - cz, L = Math.hypot(vx, vz), u = clamp(((q.pos.x - cx) * vx + (q.pos.z - cz) * vz) / (L * L), 0, 1); clear = Math.min(clear, Math.hypot(q.pos.x - (cx + vx * u), q.pos.z - (cz + vz * u))); }
    const axis = Math.atan2(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z), side = Math.abs(Math.sin(a - axis)); // side-on to the hero/thug line so both read
    if (blockedAt(cx, cz, 0.3)) clear -= 5; const sc = Math.min(clear, 2.5) + side * 2.2 - Math.abs(angTo(live + Math.PI, a)) * 0.1; if (sc > bs) { bs = sc; best = a; } }
  REPLAY.ang = best;
  fxLayer.visible = false; lockRing.visible = false; for (const s of SLASHES) s.m.visible = false; for (const q of enemies) q.hpS.visible = false;
  document.body.classList.add('replay'); $('liveT').textContent = 'REPLAY'; $('wipe').classList.remove('go'); void $('wipe').offsetWidth; $('wipe').classList.add('go'); sfx2('whoosh');
  $('rpCap').textContent = info.kind + (info.big ? ' ON THE BRUISER' : '') + (info.combo >= 3 ? ' · ' + info.combo + '-HIT COMBO' : '');
}
function updateReplay(rdt) {
  REPLAY.u += rdt; const u = clamp(REPLAY.u / REPLAY.dur, 0, 1);
  const tau = REPLAY.t0 + (REPLAY.t1 - REPLAY.t0) * ease(u) ;
  const B = REPLAY.buf; let i = B.findIndex((s) => s.time >= tau); if (i <= 0) i = 1; if (i < 0 || i >= B.length) i = B.length - 1;
  const A = B[i - 1], C = B[i]; applySnap(A, C, clamp((tau - A.time) / Math.max(1e-4, C.time - A.time), 0, 1));
  // low, slowly orbiting "angle 2" camera
  const por = PORTRAIT(), a = REPLAY.ang + u * 0.4, R = (por ? 6.2 : 4.4) - u * 0.7, F = REPLAY.focus;
  camera.position.set(F.x + Math.sin(a) * R, 1.0 + u * 0.3, F.z + Math.cos(a) * R); camera.up.set(0, 1, 0); camera.lookAt(F.x, 1.0, F.z); camera.rotateZ(0.08);
  const fov = por ? 72 : 50; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (u >= 1) {
    REPLAY.on = false; applySnap(REPLAY.now, REPLAY.now, 0); fxLayer.visible = true; document.body.classList.remove('replay'); $('liveT').textContent = 'LIVE';
    $('wipe').classList.remove('go'); void $('wipe').offsetWidth; $('wipe').classList.add('go'); CAMV.fov = 58;
  }
}
function replayThumb() { // grab a frame of this replay for the sign-off card (same task as the render, so no preserveDrawingBuffer needed)
  if (REPLAY.thumbDone || REPLAY.u / REPLAY.dur < 0.55) return; REPLAY.thumbDone = true;
  const info = REPLAY.info, score = (info.gain || 8) + info.combo * 2 + (info.big ? 10 : 0) + (info.kind === 'AIR SLASH' ? 6 : 0);
  if (REPLAY.best && REPLAY.best.score >= score) return;
  try { const W = canvas.width, H = canvas.height, k = Math.min(320 / W, 320 / H), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d');
    g.drawImage(canvas, 0, 0, W, H, 0, 0, c.width, c.height);
    REPLAY.best = { score, cap: $('rpCap').textContent, img: c.toDataURL('image/jpeg', 0.8), at: clockText(S.time) };
  } catch (err) { REPLAY.best = { score, cap: $('rpCap').textContent, img: null, at: clockText(S.time) }; }
}

// ---------------- broadcast HUD ----------------
function clockText(t) { const s = 82620 + Math.min(GAME_LEN, t) * 180 / GAME_LEN; const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s % 60); return (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ' PM'; }
const CHY = { cur: '', t: 99, queue: [], subT: 0 };
function headline(text, kind = 'news') {
  if (CHY.cur === text) return; EV.heads.push(text);
  CHY.queue = CHY.queue.filter((q) => q.kind === 'alert'); CHY.queue.push({ text, kind });
}
function updateChyron(dt) {
  CHY.t += dt; CHY.subT -= dt;
  if (CHY.queue.length && (CHY.t > 2.6 || CHY.queue[0].kind === 'alert')) {
    const q = CHY.queue.shift(); CHY.cur = q.text; CHY.t = 0;
    const L = $('lower'); L.className = 'ui k-' + q.kind; $('chyTag').textContent = { news: 'BREAKING', hype: 'LIVE', hostile: 'DEVELOPING', alert: 'ALERT' }[q.kind] || 'BREAKING';
    const h = $('chyHead'); h.textContent = q.text; h.classList.remove('in'); void h.offsetWidth; h.classList.add('in');
  }
  if (CHY.subT <= 0 && CHY.subT > -1) { $('chySub').textContent = 'DANA VEX · REPORTING LIVE · 5TH & GRAND'; CHY.subT = -2; }
}
const QUOTES = {
  open: '"We\'re live at 5th & Grand, where a masked figure has squared off with a street gang."',
  nocam: '"He\'s coming right at us — keep rolling, keep rolling!"', crewdown: '"Our camera is down! Are you okay?!"', crewup: '"He... helped us up. We\'re back, folks!"',
  ko: ['"Did you see that? Another one down!"', '"Incredible scenes here on Grand Avenue."', '"The crowd is going wild, folks."'], missed: '"We missed that one — get the shot!"',
  low: '"Viewers are asking: hero, or public nuisance?"', cops: '"We\'re hearing sirens. Police are on the way."', busted: '"Officers have detained the masked man."', evade: '"And he\'s lost them!"',
};
function dana(k) { let q = QUOTES[k]; if (!q) return; if (Array.isArray(q)) q = q[(Math.random() * q.length) | 0]; $('chySub').textContent = 'DANA VEX: ' + q; CHY.subT = 4.5; }
let popT = 0;
function popGain(txt, good) { const p = $('pop'); p.textContent = txt; p.classList.toggle('good', !!good); p.classList.remove('on'); void p.offsetWidth; p.classList.add('on'); popT = 1; }
function flashBack() { const b = $('backOn'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
const TICK = ['WKRK ACTION NEWS · LIVE AT ELEVEN', 'WEATHER: CLEAR AND COOL TONIGHT, LOW OF 52', 'CITY COUNCIL DELAYS VOTE ON GRAND AVE BIKE LANES', 'SPORTS: HARBOR HOUNDS EDGE RIVER KINGS 3-2 IN EXTRAS',
  'TRAFFIC: BRIDGE LANE CLOSURES OVERNIGHT', 'GRAND AVE SLICE FEST RETURNS THIS WEEKEND', 'MAYOR TO ADDRESS LATE-NIGHT NOISE COMPLAINTS', 'COMING UP: WHO IS THE MASKED VIGILANTE OF 5TH & GRAND?'];
function buildTicker() { const live = 'VIEWERS TUNED IN: ' + Math.round(RT.vShown).toLocaleString('en-US') + ' AND CLIMBING'; const s = [TICK[0], live, ...TICK.slice(1)].join('   ◆   ') + '   ◆   ';
  $('tickIn').innerHTML = '<span>' + s + '</span><span>' + s + '</span>'; }
buildTicker(); $('tickIn').addEventListener('animationiteration', buildTicker);
const STAT = { c: $('static'), g: null, img: null, a: 0 };
STAT.c.width = 160; STAT.c.height = 90; STAT.g = STAT.c.getContext('2d'); STAT.img = STAT.g.createImageData(160, 90);
function drawStatic(a) {
  STAT.a = damp(STAT.a, a, 6, 1 / 30); STAT.c.style.opacity = STAT.a.toFixed(3); if (STAT.a < 0.01) return;
  const d = STAT.img.data, roll = (CAMV.t * 40) % 90;
  for (let y = 0; y < 90; y++) { const band = Math.abs(y - roll) < 6 ? 60 : 0; for (let x = 0; x < 160; x++) { const v = (Math.random() * 255) | 0, i = (y * 160 + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.min(255, v + band); d[i + 3] = 255; } }
  STAT.g.putImageData(STAT.img, 0, 0);
}
let tickBuilt = 0, lastRat = -1;
function newsHud(dt, rdt) {
  const t = S.time;
  $('clock').textContent = clockText(t); $('clock').classList.toggle('late', GAME_LEN - t < 20);
  const f = Math.floor(CAMV.t * 30) % 30, sec = Math.floor(CAMV.t); $('rec').textContent = 'REC ' + [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60, f].map((v) => String(v).padStart(2, '0')).join(':');
  const rv = Math.round(RT.v); if (rv !== lastRat) { lastRat = rv; $('ratFill').style.width = RT.v + '%'; $('ratN').textContent = rv; }
  $('ratPeak').style.left = RT.peak + '%'; $('rat').classList.toggle('hit', RT.peak >= TARGET);
  const s = NEWS.seen, chip = $('mult');
  if (!s.ok) { chip.textContent = s.why === 'NO FEED' ? 'NO FEED' : 'OFF CAMERA'; chip.className = 'off'; }
  else if (s.good) { chip.textContent = '×2 GOOD FRAME'; chip.className = 'good'; } else { chip.textContent = '×1 ON CAMERA'; chip.className = ''; }
  $('frame').classList.toggle('good', s.ok && s.good);
  $('view').textContent = Math.round(RT.vShown).toLocaleString('en-US');
  $('gangN').textContent = S.kills + '/5';
  $('objR').classList.toggle('ok', RT.peak >= TARGET); $('objG').classList.toggle('ok', S.kills >= 5);
  offT -= rdt; if (offT <= 0) $('offcam').classList.remove('on');
  // crew down: technical difficulties
  const down = CREW.state === 'down' || CREW.state === 'help';
  document.body.classList.toggle('crewdown', down);
  if (down) { const d = Math.hypot(hero.pos.x - CREW.op.pos.x, hero.pos.z - CREW.op.pos.z); $('helpD').textContent = d < 2.4 ? (TOUCH ? 'TAP HELP TO GET THE CREW UP' : 'PRESS E TO HELP THE CREW UP') : 'GET TO THE CREW (THE CAMERA ON THE GROUND) · ' + Math.round(d) + 'M'; $('tech').classList.toggle('near', d < 2.4); }
  drawStatic(down ? 0.42 : COP.state === 'drive' ? 0.04 : S.shake > 0.6 ? 0.08 : 0);
  if (REPLAY.on) drawStatic(0);
  document.body.classList.toggle('hostile', !!NEWS.hostile); document.body.classList.toggle('hype', RT.cheerOn);
}

// ---------------- win / lose: make the 11 o'clock news ----------------
function checkEnd(dt) {
  if (NEWS.over || NEWS.wrapT >= 0) return;
  if (S.kills >= 5 && !REPLAY.on && !NEWS.replayPend) { NEWS.won = RT.peak >= TARGET; NEWS.endWhy = NEWS.won ? 'made' : 'short'; NEWS.wrapT = 2.2; banner2(NEWS.won ? "THAT'S A WRAP!" : 'NOT ENOUGH FOR THE TOP STORY'); if (NEWS.won) headline('MASKED HERO LEADS AT ELEVEN', 'hype'); }
  else if (S.time >= GAME_LEN) { NEWS.won = false; NEWS.endWhy = 'time'; NEWS.wrapT = 1.6; banner2("WE'RE OUT OF TIME"); }
}
function banner2(t) { const b = $('banner'); b.textContent = t; b.classList.add('on'); bannerT = 2.2; }
function grade() {
  const pts = RT.peak + S.kills * 4 + (REPLAY.best ? 5 : 0) - EV.busted * 8;
  if (NEWS.won) { if (pts >= 112 && !EV.busted) return ['A+', 'LEAD STORY: MASKED HERO CLEANS UP 5TH & GRAND']; if (pts >= 100) return ['A', 'TOP OF THE HOUR: VIGILANTE BREAKS UP STREET GANG']; if (pts >= 92) return ['B+', 'MASKED HERO MAKES THE ELEVEN']; return ['B', 'MASKED HERO SQUEAKS INTO THE ELEVEN']; }
  if (S.kills >= 5) return ['C', 'STREET FIGHT RUNS AFTER SPORTS'];
  if (S.kills >= 2) return ['D', 'BRIEF MENTION, AFTER THE WEATHER'];
  return ['F', 'STORY SPIKED: NOTHING TO SEE AT 5TH & GRAND'];
}
function showEnd() {
  NEWS.over = true; NEWS.endT = S.time; const [g, h] = grade(); NEWS.grade = g;
  $('endGrade').textContent = g; $('endHead').textContent = h; $('end').classList.toggle('won', NEWS.won);
  $('endWhy').textContent = NEWS.endWhy === 'made' ? 'Made the 11 o\'clock news' : NEWS.endWhy === 'short' ? 'Gang beaten, but the ratings fell short of the top story' : 'Out of time at 11:00 PM';
  const rows = [['Peak ratings', Math.round(RT.peak) + ' / goal ' + TARGET], ['Final ratings', Math.round(RT.v)], ['Peak viewers', Math.round(RT.vPeak).toLocaleString('en-US')], ['Gang taken down', S.kills + ' / 5'],
    ['Best combo', S.maxCombo + ' hits'], ['Instant replays', EV.replays], ['Crew knockdowns', EV.crewDown + (EV.crewDown ? ' (helped up ' + EV.crewUp + ')' : '')], ['Police', EV.cops ? (EV.busted ? 'detained ' + EV.busted + '×' : '') + (EV.copEvaded ? (EV.busted ? ', ' : '') + 'evaded ' + EV.copEvaded + '×' : '') || 'called' : 'never called']];
  $('endStats').innerHTML = rows.map(([k, v]) => '<div><span>' + k + '</span><b>' + v + '</b></div>').join('');
  const b = REPLAY.best; $('endRp').innerHTML = b ? (b.img ? '<img alt="best replay" src="' + b.img + '">' : '') + '<p><b>BEST REPLAY</b> ' + b.cap + ' · ' + b.at + '</p>' : '<p><b>BEST REPLAY</b> none: big finishers on camera trigger a replay</p>';
  document.body.classList.add('ended'); document.body.classList.remove('crewdown', 'replay');
}
$('again').addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => { if (NEWS.over && (e.key === 'r' || e.key === 'R' || e.key === 'Enter')) location.reload(); });

// one news-layer step (inside the fixed-step loop)
function newsStep(dt) {
  updateCrew(dt); updateCop(dt); updateBystanders(dt); updateRatings(dt); recordReplay(dt);
  if (NEWS.replayPend) { NEWS.replayPend.t -= dt; if (NEWS.replayPend.t <= 0) { const info = NEWS.replayPend; NEWS.replayPend = null; startReplay(info); } }
  if (NEWS.wrapT >= 0) { NEWS.wrapT -= dt; if (NEWS.wrapT < 0) showEnd(); }
  checkEnd(dt);
}
headline('LIVE: MASKED VIGILANTE SPOTTED AT 5TH & GRAND', 'news'); dana('open');
function sfx2(kind) {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  try {
    const g = AC.createGain(); g.connect(AC.destination);
    if (kind === 'crash') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); s.start(t); s.stop(t + 0.4); }
    else if (kind === 'siren') { const o = AC.createOscillator(); o.type = 'triangle'; for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 620 : 860, t + i * 0.28); o.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.1); g.gain.setValueAtTime(0.07, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7); o.start(t); o.stop(t + 1.72); }
    else if (kind === 'cheer') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3); s.start(t); s.stop(t + 1.32); }
    else if (kind === 'pickup') { const o = AC.createOscillator(); o.type = 'square'; [660, 880, 1320].forEach((fq, i) => o.frequency.setValueAtTime(fq, t + i * 0.07)); o.connect(g); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.31); }
    else if (kind === 'whoosh') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.35); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); s.start(t); s.stop(t + 0.4); }
  } catch (e) { /* audio is optional */ }
}
NEWS.callCops = () => callCops(); // test hook


// ---------------- BRUISERS (mini-bosses) and GRAVEMAW (the tank boss): jointed toon rigs, merged per joint ----------------
function jointMesh(parent, parts, mat, ol, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  if (parts.length) { const m = withOutline(merge(parts), mat, ol, g); m.castShadow = true; }
  return g;
}
const OUT_BIG = outlineMat(0.0034);
function buildBrute(boss) {
  const mat = toonMat({}, boss ? 'boss' : 'brute');
  const SK = boss ? '#7f9a6a' : '#93ad7f', SK2 = boss ? '#647d55' : '#78926a', PANT = '#5a4a3a', REBAR = '#6b4a3a', MET = '#8a9096', BLOOD = '#7a1a22', EYE = '#fff36a', MAW = '#ffb030';
  const R = { boss, mat, root: new THREE.Group() };
  R.tilt = new THREE.Group(); R.root.add(R.tilt);
  R.hips = jointMesh(R.tilt, [P(GEO.sph(0.62, 0.42, 0.48, 10, 8), PANT), P(GEO.box(1.3, 0.16, 0.9), '#3a2c25', [0, 0.15, 0])], mat, OUT_BIG, 0, 1.55, 0);
  const torsoParts = [
    P(GEO.sph(1.0, 0.86, 0.76, 12, 9), SK, [0, 0.78, 0.18], [0.4, 0, 0], null, { jitter: 0.06 }),
    P(GEO.sph(0.62, 0.5, 0.42, 9, 7), SK2, [0.62, 1.22, 0.1]), P(GEO.sph(0.62, 0.5, 0.42, 9, 7), SK2, [-0.62, 1.22, 0.1]),
    P(GEO.sph(0.3, 0.36, 0.12, 7, 5), BLOOD, [0.3, 0.6, 0.86], [0.3, 0, 0]),
  ];
  for (let i = 0; i < 6; i++) torsoParts.push(P(GEO.cyl(0.05, 0.08, 1.3, 5), REBAR, [(i - 2.5) * 0.3, 1.0 + (i & 1) * 0.3, -0.45], [-0.8 - (i & 1) * 0.3, 0, (i - 2.5) * 0.18]));
  if (boss) {
    torsoParts.push(P(GEO.sph(0.5, 0.42, 0.25, 10, 8), MAW, [0, 0.7, 0.78], [0.3, 0, 0]));
    for (let i = 0; i < 6; i++) torsoParts.push(P(GEO.cone(0.08, 0.36, 4), '#f3ead8', [Math.cos(i / 6 * TAU) * 0.42, 0.7 + Math.sin(i / 6 * TAU) * 0.34, 0.92], [1.2, 0, 0]));
    torsoParts.push(P(GEO.tor(0.55, 0.22, 6, 12), '#26201f', [0, 1.5, 0.35], [1.2, 0, 0]), P(GEO.tor(0.5, 0.2, 6, 12), '#26201f', [0, 1.75, 0.4], [1.3, 0, 0.2]));
    torsoParts.push(P(GEO.box(1.6, 0.8, 0.1), '#c0392b', [0, 1.1, -0.72], [0.3, 0, 0]), P(GEO.box(1.2, 0.3, 0.12), '#d8d2c2', [0, 1.25, -0.75], [0.3, 0, 0]));
  }
  R.torso = jointMesh(R.hips, torsoParts, mat, OUT_BIG, 0, 0.2, 0);
  R.head = jointMesh(R.torso, [
    P(GEO.sph(0.34, 0.36, 0.34, 9, 7), SK, [0, 0.15, 0.1]), P(GEO.box(0.5, 0.16, 0.3), SK2, [0, 0.0, 0.3], [0.3, 0, 0]),
    P(GEO.box(0.42, 0.18, 0.06), MET, [0, 0.0, 0.46]), P(GEO.box(0.06, 0.24, 0.06), MET, [0.12, 0.0, 0.47]), P(GEO.box(0.06, 0.24, 0.06), MET, [-0.12, 0.0, 0.47]),
    P(GEO.sph(0.06, 0.05, 0.03, 5, 4), EYE, [0.13, 0.24, 0.41]), P(GEO.sph(0.06, 0.05, 0.03, 5, 4), EYE, [-0.13, 0.24, 0.41]),
  ], mat, OUT_BIG, 0, 1.55, 0.6);
  R.arms = [];
  for (const s of [1, -1]) {
    const up = jointMesh(R.torso, [P(GEO.cap(0.3, 0.6, 8), SK, [0, -0.45, 0]), P(GEO.cyl(0.33, 0.33, 0.2, 8), '#3a2c25', [0, -0.75, 0])], mat, OUT_BIG, s * 1.05, 1.2, 0.2);
    const fp = [P(GEO.cap(0.42, 0.7, 9), SK2, [0, -0.55, 0], null, null, { jitter: 0.08 }), P(GEO.sph(0.48, 0.42, 0.46, 9, 7), SK, [0, -1.15, 0.05])];
    for (let k = 0; k < 3; k++) fp.push(P(GEO.cone(0.07, 0.4, 4), '#f3ead8', [s * 0.3, -0.4 - k * 0.25, -0.2], [0, 0, -s * 1.3]));
    if (boss && s < 0) fp.push(P(GEO.box(0.14, 1.7, 1.2), '#8f6a4a', [s * 0.45, -0.7, 0.2]), P(GEO.box(0.16, 0.5, 0.7), '#2b2a33', [s * 0.47, -0.45, 0.2]), P(GEO.box(0.18, 0.1, 1.24), '#c9d1d8', [s * 0.47, -1.5, 0.2]));
    if (boss && s > 0) fp.push(P(GEO.tor(0.38, 0.1, 6, 12, Math.PI), MET, [0, -1.75, 0.2], [0, 1.57, 0]), P(GEO.cyl(0.05, 0.05, 1.2, 5), MET, [0, -1.0, 0.25]));
    const fore = jointMesh(up, fp, mat, OUT_BIG, 0, -0.85, 0);
    R.arms.push({ up, fore, s });
  }
  R.legs = [];
  for (const s of [1, -1]) {
    const lg = jointMesh(R.hips, [P(GEO.cap(0.3, 0.5, 8), PANT, [0, -0.38, 0]), P(GEO.cap(0.26, 0.45, 8), SK2, [0, -0.98, 0.02]), P(GEO.box(0.5, 0.22, 0.75), '#2a2222', [0, -1.38, 0.15])], mat, OUT_BIG, s * 0.45, -0.05, 0);
    R.legs.push(lg);
  }
  R.root.visible = false; scene.add(R.root);
  return R;
}
const BRUTES = [buildBrute(false), buildBrute(false)];
const BOSS_RIG = buildBrute(true);
// thrown rocks
const ROCKS = [];
const rockGeo = merge([P(GEO.dod(1.1), '#a84a33'), P(GEO.dod(0.6), '#c4623e', [0.5, 0.4, 0])]);
for (let i = 0; i < 4; i++) { const m = withOutline(rockGeo, worldMat, OUT_WORLD, scene); m.visible = false; m.castShadow = true; ROCKS.push({ m, on: false, t: 0, dur: 1, sx: 0, sy: 0, sz: 0, tx: 0, tz: 0 }); }
// big-enemy state (the rigs are pooled: 2 bruisers + 1 boss)
const BIGS = [];
function bigReset() { BIGS.length = 0; for (const R of [...BRUTES, BOSS_RIG]) { R.root.visible = false; R.mat.userData.flash.value = 0; R.mat.userData.char.value = 0; } for (const r of ROCKS) { r.on = false; r.m.visible = false; } }
function bigSpawn(boss, x, z, hpMul) {
  const R = boss ? BOSS_RIG : BRUTES.find((b) => !b.root.visible); if (!R) return null;
  const sc = boss ? 1.75 : 1.05;
  const B = { R, boss, x, z, y: hm(x, z), yaw: 0, hp: (boss ? 5200 : 650) * hpMul, max: (boss ? 5200 : 650) * hpMul, sc, rad: boss ? 3.4 : 1.9,
    st: 'walk', t: 0, cd: 2.5, ph: 0, dirX: 0, dirZ: 1, chargeLeft: 0, hitVan: false, flash: 0, stun: 0, phase: 1, dead: false, deathT: 0, vx: 0, vz: 0, speed: boss ? 4.3 : 5.6, tele: null, ramCd: 0 };
  R.root.visible = true; R.root.scale.setScalar(sc); R.tilt.rotation.set(0, 0, 0); R.mat.userData.char.value = 0;
  BIGS.push(B); return B;
}
// pose the rig from its state (called per frame)
function bigPose(B, dt) {
  const R = B.R; B.ph += dt * (B.st === 'charge' ? 11 : B.st === 'walk' ? 4.2 : 2) * (B.boss ? 0.75 : 1);
  R.root.position.set(B.x, B.y, B.z); R.root.rotation.y = B.yaw;
  const s = Math.sin(B.ph);
  let legA = s * 0.45, armUp = -s * 0.3, foreB = -0.5, lean = 0.15, headX = 0;
  if (B.st === 'charge') { legA = s * 0.9; armUp = 0.7; foreB = -0.9; lean = 0.6; }
  else if (B.st === 'slamWind') { const k = Math.min(1, B.t / 0.5); armUp = -2.8 * k; foreB = -0.4; lean = -0.25 * k; legA = 0; headX = -0.4 * k; }
  else if (B.st === 'slam') { const k = Math.min(1, B.t / 0.12); armUp = -2.8 + 3.6 * k; foreB = -0.2; lean = 0.55 * k; legA = 0; }
  else if (B.st === 'chargeWind' || B.st === 'throwWind') { armUp = B.st === 'throwWind' ? -2.4 : 0.4; lean = B.st === 'throwWind' ? -0.3 : 0.4 + Math.sin(B.t * 30) * 0.04; legA = 0; headX = 0.3; }
  else if (B.st === 'recover' || B.st === 'stun') { lean = 0.75; armUp = 0.2 + Math.sin(B.ph) * 0.1; legA = 0; headX = 0.5; }
  if (B.dead) { R.tilt.rotation.x = damp(R.tilt.rotation.x, -1.45, 4, dt); legA = 0.2; armUp = -1.2; }
  R.torso.rotation.x = damp(R.torso.rotation.x, lean, 10, dt); R.head.rotation.x = headX;
  R.legs[0].rotation.x = legA; R.legs[1].rotation.x = -legA;
  for (const a of R.arms) { a.up.rotation.x = damp(a.up.rotation.x, armUp + (B.st === 'walk' ? s * 0.4 * a.s : 0), 14, dt); a.fore.rotation.x = foreB; a.up.rotation.z = a.s * 0.25; }
  R.mat.userData.flash.value = Math.max(0, B.flash);
  R.mat.userData.flashC.value.set(B.phase === 2 && B.flash <= 0.05 ? '#ff3020' : '#ffffff');
  if (B.boss && B.phase === 2 && B.flash <= 0) R.mat.userData.flash.value = 0.12 + 0.08 * Math.sin(B.ph * 3);
}

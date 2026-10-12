// ======================= THE CHIP KID, HARBORPLACE: a cane-brawl mech duel (DESIGN.md "More game-style fights" + "Homage bosses"; reworked for FUN, Brad 2026-10-12:
// "way too hard ... the stick punch is not animated or fun enough ... the power button doesn't do anything special ... it should be easily beaten, with special moves
// and lots of animated action scenes worthy of replay").
// A behind-the-player view: Harold in a makeshift ring on the Harborplace plaza, Mavis cheering from the corner, facing The Chip Kid's giant
// crab-chip-bag mech (an original red / yellow snack look: "LIL' CRUNCH CRAB CHIPS", no real brand). The kid (pigtails, big eyes, bonnet-style hat) sits in the cockpit dome.
// CANE: SWING chains a 3-hit cane combo (forehand, backhand, overhead SMASH finisher). Every hit lands: wind-up + swing arc with a motion trail, hitstop, camera shake,
//   sparks + flying chip crumbs + foil shreds, the mech flinches back with a white flash, floating damage numbers, chunky hit sounds, a combo counter. After an attack the
//   mech is OPEN (it sags): hits there are CRITS (x1.5, gold numbers).
// POWER (ACT): hits and dodges fill the meter fast; when it is full the bar glows, the ACT button pulses and a POWER READY prompt shows. Specials rotate:
//   OLD BAY CYCLONE (a spinning seasoning-tornado cane flurry), CRAB-MALLET POUND (leap + giant mallet + shockwave, the mech bounces), "HON!" HOMER (a charged home-run
//   swing that sends the mech flying off into the sky and crashing back down). Each has slow-mo, zoom, big flashes and big damage; Harold can't be hurt during one.
// The mech's attacks are slow and loudly telegraphed (it flashes, a "!" pops over the dome, the danger shows on the ground):
//   SEASONING CLOUD (shakers tip + glow orange, orange ring on the middle lane) -> DUCK or DODGE   ·   CHIP-CAN BARRAGE (hatch opens, lanes flash) -> step out of the lane
//   BAG-SLAM (crouch + leap, red shadow on the middle lane) -> DODGE   ·   CLAW JAB (claw pulls back + flashes, lanes flash) -> dodge away or duck
// Forgiving: half the old damage, long i-frames after a hit, Mavis tosses crab cakes when Harold is low, one "second wind" per fight, full health between rounds.
// 3 short rounds; the final blow plays a slow-mo KO: the mech blows apart into a chip cloud, the kid tumbles out, sulks and runs off; then a grade (stars) + REMATCH.
// Controls: phone: stick left / right (or the white buttons) dodge, stick down / JUMP = DUCK, SWING = cane, ACT = POWER. Desktop: A / D (arrows) dodge, S duck, J swing,
// E power. Gamepad: left stick or LB / RB dodge, A duck, X swing, Y power.
// Tests: ?duel=chipkid&duelbot=win|mash|lose (mash = only mashes SWING), &ckhp=N start HP N with no crab cakes / second wind (test-only, for the lose path), &ckround=N.
// Rig hook: window.buildChipKid({ THREE, toonMat, outlineMat, addOdir, QUAL }) may return { root, bag?, armL?, armR?, shakers?, hatch?, dome?, kid?, flash? }.
(function () {
  const C = { scene: null, cam: null, title: 'THE CHIP KID', pips: 3,
    hint: '<b>J</b> swing (3-hit combo) · <b>E</b> POWER special · <b>A / D</b> dodge · <b>S</b> duck',
    labels: { a: 'SWING', b: 'DUCK', c: 'POWER', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 4.4, LANE = 1.35; // the mech stands at z = MZ facing -z; Harold at z = 0 facing +z. Screen right is world -x here.
  const RHP = [200, 220, 240]; // mech HP per round
  const RND = [ // per round: tell lengths (slow + loud), how many cans, can spacing / speed, guard time, open time, attack order
    { cloud: 1.6, cans: 2, gap: 0.95, cspd: 3.4, slam: 1.7, jab: 1.2, guard: [1.7, 2.4], open: 1.8, mix: ['jab', 'cloud', 'cans', 'slam'] },
    { cloud: 1.45, cans: 3, gap: 0.85, cspd: 3.6, slam: 1.55, jab: 1.1, guard: [1.4, 2.1], open: 1.7, mix: ['cans', 'jab', 'cloud', 'slam', 'jab'] },
    { cloud: 1.3, cans: 3, gap: 0.8, cspd: 3.9, slam: 1.45, jab: 1.0, guard: [1.2, 1.9], open: 1.6, mix: ['slam', 'cans', 'jab', 'cloud', 'jab', 'cans'] },
  ];
  const DMG_TO_HAROLD = { cloud: 5, can: 4, slam: 10, jab: 5 };
  const SWINGS = [ // the 3-hit cane combo: duration, hit moment (s), damage, meter
    { dur: 0.3, hit: 0.12, dmg: 6, pw: 8, name: 'fore' }, { dur: 0.3, hit: 0.12, dmg: 7, pw: 8, name: 'back' }, { dur: 0.48, hit: 0.22, dmg: 14, pw: 16, name: 'smash' }];
  const SPECIALS = [{ id: 'cyclone', name: 'OLD BAY CYCLONE!', ban: 'OLD BAY<br>CYCLONE!', dur: 2.2 }, { id: 'mallet', name: 'CRAB-MALLET POUND!', ban: 'CRAB-MALLET<br>POUND!', dur: 2.3 }, { id: 'homer', name: '"HON!" HOMER!', ban: '"HON!"<br>HOMER!', dur: 3.3 }];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE; // screen lane (-1 left, 0 centre, 1 right) -> world x
  const TOUCH = () => document.body.classList.contains('touch');

  // ---------------- textures ----------------
  function labelTex() { return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8262a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23c'; g.fillRect(0, h * 0.06, w, h * 0.08); g.fillRect(0, h * 0.86, w, h * 0.08);
    g.save(); g.translate(w / 2, h * 0.48); g.fillStyle = '#fff3c4'; g.strokeStyle = '#7a1010'; g.lineWidth = 12; g.beginPath(); g.ellipse(0, 0, w * 0.43, h * 0.3, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
    // an original cartoon crab
    g.save(); g.translate(w / 2, h * 0.36); g.fillStyle = '#e8501e'; g.strokeStyle = '#5a1a0a'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 70, 40, 0, 0, TAU); g.fill(); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 95, -30, 26, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 20, -44, 11, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#14101f'; g.beginPath(); g.arc(s * 20, -44, 5, 0, TAU); g.fill(); g.fillStyle = '#e8501e'; }
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 70px ' + FONT; g.lineJoin = 'round'; g.strokeStyle = '#7a1010'; g.lineWidth = 14; g.fillStyle = '#d8262a';
    g.strokeText("LIL' CRUNCH", w / 2, h * 0.56); g.fillText("LIL' CRUNCH", w / 2, h * 0.56);
    g.font = '900 40px ' + FONT; g.fillStyle = '#7a1010'; g.fillText('CRAB CHIPS', w / 2, h * 0.7);
    g.font = '900 22px ' + FONT; g.fillStyle = '#7a1010'; g.fillText('CHESAPEAKE CRAB SPICE \u00b7 NET WT 99 OZ', w / 2, h * 0.9);
  }, 256); }
  function brickTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6a3a2e'; g.fillRect(0, 0, w, h); SEED = 21;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const o = (y % 2) * 16; g.fillStyle = ['#9a5040', '#8a4a3a', '#a8604a', '#7e4234'][Math.floor(srnd() * 4)]; g.fillRect(x * 32 + o + 1, y * 16 + 1, 30, 14); } }, 256); }
  function matTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a5a8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffd23c'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, TAU); g.fill(); }, 256); }

  // ---------------- the arena: the Harborplace plaza at dusk, a makeshift ring, the pavilions + string lights behind ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    // sky: back-faced sphere with a dusk gradient
    const sk = new THREE.SphereGeometry(80, 24, 12).toNonIndexed(); const sp = sk.attributes.position, sc2 = new Float32Array(sp.count * 3), c0 = new THREE.Color('#1c1a48'), c1 = new THREE.Color('#e8705a'), c2 = new THREE.Color('#ffc078');
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 80, c = y > 0.12 ? c0.clone().lerp(c1, clamp(1 - (y - 0.12) * 2.2, 0, 1)) : c1.clone().lerp(c2, clamp(1 - y * 8, 0, 1)); sc2.set([c.r, c.g, c.b], i * 3); }
    sk.setAttribute('color', new THREE.BufferAttribute(sc2, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    // the plaza (brick) + harbour water off to the left
    const bt = brickTex(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(10, 10);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ map: bt })); pl.rotation.x = -Math.PI / 2; sc.add(pl);
    const wt = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), new THREE.MeshLambertMaterial({ color: '#244a6a', emissive: '#182a48' })); wt.rotation.x = -Math.PI / 2; wt.position.set(42, -0.3, 10); sc.add(wt);
    // ring mat + posts + ropes (red / white / yellow), one mesh for the hardware
    const rm = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.2, 9.6), new THREE.MeshLambertMaterial({ map: matTex() })); // one material: one draw call
    rm.position.set(0, 0.1, 2.2); sc.add(rm);
    const R = K(); const P = [[4, -2.4], [-4, -2.4], [4, 6.8], [-4, 6.8]];
    for (const [x, z] of P) R.add(G.cyl(0.13, 0.15, 1.9, 8), '#d8d8e0', x, 1.15, z).add(G.box(0.36, 0.36, 0.36), '#d8262a', x, 2.1, z);
    const rope = (a, b, y, col) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); R.add(G.cyl(0.035, 0.035, L, 5), col, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.PI / 2, Math.atan2(dx, dz), 0); };
    for (const [a, b] of [[P[0], P[2]], [P[1], P[3]], [P[2], P[3]]]) { rope(a, b, 0.75, '#d8262a'); rope(a, b, 1.25, '#f4f0e6'); rope(a, b, 1.75, '#ffd23c'); }
    // Harborplace pavilions behind: glassy two-storey boxes with green hip roofs, lit windows, "HARBORPLACE"-style fascia (drawn in sText-free blocks)
    for (const [x, z, w, d] of [[-9, 24, 18, 8], [14, 30, 14, 7]]) { R.add(G.box(w, 5.2, d), '#c8d4cc', x, 2.6, z).add(G.box(w + 0.4, 0.5, d + 0.4), '#2f5a44', x, 5.4, z);
      R.add(new THREE.CylinderGeometry(0.3, Math.max(w, d) * 0.62, 2.6, 4, 1), '#4f8a6a', x, 6.9, z, 0, Math.PI / 4, 0, w / Math.max(w, d), 1, d / Math.max(w, d));
      for (let k = 0; k < Math.floor(w / 1.6); k++) for (const y of [1.4, 3.6]) R.add(G.box(1.1, 1.3, 0.05), (k + y) % 3 < 1 ? '#ffe6a0' : '#ffd27a', x - w / 2 + 0.9 + k * 1.6, y, z - d / 2 - 0.03); }
    // a couple of lamp posts + benches on the plaza
    for (const [x, z] of [[-7, 6], [7, 9], [-8, -4], [8, -3]]) R.add(G.cyl(0.08, 0.1, 4, 6), '#2a2a30', x, 2, z).add(G.sph(0.32, 8, 6), '#fff2c0', x, 4.1, z);
    sc.add(R.mesh(toonMat(), null, 0.003));
    // string lights between the pavilions and the lamps: one Points cloud
    const n = 90, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = (i % 45) / 44, row = i < 45 ? 0 : 1; pos.set([lerp(-16, 18, u), 6.2 + Math.sin(u * Math.PI * 3) * -0.7 + row * 0.8, 17 + row * 4 + Math.sin(u * 9) * 0.5], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sc.add(new THREE.Points(g, new THREE.PointsMaterial({ map: DUELS.dot('#ffe8a0'), size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  }

  // ---------------- the mech stand-in: a crab-chip-bag on four crab legs, piston arms with crab claws, shoulder seasoning shakers, cockpit dome + the kid ----------------
  function pillow(w, h, d, seg = 10) { const g = new THREE.BoxGeometry(w, h, d, seg, seg, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); const k = (1 - x * x * 0.6) * (1 - Math.pow(Math.abs(y), 3) * 0.85); p.setZ(i, p.getZ(i) * (0.35 + 0.75 * k)); p.setX(i, p.getX(i) * (1 - Math.pow(Math.abs(y), 4) * 0.08)); }
    g.computeVertexNormals(); return g; }
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), flash: [] };
    const mM = toonMat(), aM = [toonMat(), toonMat()], sM = toonMat(); R.flash = [mM, aM[0], aM[1], sM]; R.mM = mM; R.aM = aM; R.sM = sM;
    R.hip = new THREE.Group(); R.hip.position.y = 1.5; R.root.add(R.hip);
    // legs (crab legs: two a side), one mesh
    const L = K(); for (const s of [-1, 1]) for (const z of [-0.35, 0.45]) { L.add(G.cyl(0.14, 0.18, 1.5, 7), '#e8501e', s * 1.15, -0.25, z, 0, 0, s * 0.9).add(G.sph(0.2, 8, 6), '#c43a12', s * 1.75, -0.7, z).add(G.cone(0.14, 1.1, 6), '#e8501e', s * 1.95, -1.15, z, 0, 0, -s * 0.35); }
    L.add(G.cyl(0.7, 0.85, 0.5, 10), '#5a5a64', 0, 0.05, 0).add(G.cyl(0.5, 0.5, 0.2, 10), '#ffd23c', 0, 0.35, 0);
    R.legs = L.mesh(mM, R.hip);
    // the bag (pillow + crimped seams top and bottom) + the label on the front
    R.bag = new THREE.Group(); R.bag.position.y = 2.15; R.hip.add(R.bag);
    const B = K(); B.add(pillow(3.3, 3.6, 1.8), '#d8262a', 0, 0, 0);
    for (const y of [1.86, -1.86]) for (let k = 0; k < 11; k++) B.add(G.box(0.3, 0.32, 0.5), k % 2 ? '#ffd23c' : '#b81e22', -1.5 + k * 0.3, y, 0, 0, 0, 0.785);
    B.add(G.box(3.25, 0.3, 0.92), '#ffd23c', 0, -1.25, 0.06).add(G.box(0.5, 0.5, 0.4), '#5a5a64', 0, 1.05, -0.75); // the yellow band + a back vent
    // the belly hatch frame (the cans roll out of it)
    B.add(G.box(1.5, 0.12, 0.2), '#14101f', 0, -0.62, 0.86).add(G.box(1.5, 0.12, 0.2), '#14101f', 0, -1.5, 0.86);
    R.bagM = B.mesh(mM, R.bag);
    const lg = new THREE.PlaneGeometry(2.25, 2.25, 12, 12); { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 1.65, y = (p.getY(i) + 0.42) / 1.8, k = (1 - x * x * 0.6) * (1 - Math.pow(Math.abs(y), 3) * 0.85); p.setZ(i, 0.9 * (0.35 + 0.75 * k) + 0.025); } lg.computeVertexNormals(); }
    const lab = new THREE.Mesh(lg, toonMat({ map: labelTex(), vertexColors: false })); lab.material.userData.flash = mM.userData.flash; lab.material.userData.flashC = mM.userData.flashC;
    lab.material.customProgramCacheKey = () => 'ckLab'; lab.position.set(0, 0.42, 0); R.bag.add(lab);
    R.hatch = new THREE.Group(); R.hatch.position.set(0, -0.62, 0.9); R.bag.add(R.hatch);
    { const H = K(); H.add(G.box(1.4, 0.86, 0.08), '#ffd23c', 0, -0.43, 0).add(G.box(1.0, 0.1, 0.1), '#d8262a', 0, -0.43, 0.05); H.mesh(mM, R.hatch, 0); }
    // shoulder shakers (the seasoning cloud): two mesh-merged shakers on a yoke that tips forward
    R.shakers = new THREE.Group(); R.shakers.position.set(0, 1.6, -0.1); R.bag.add(R.shakers);
    { const S = K(); for (const s of [-1, 1]) { S.add(G.cyl(0.32, 0.36, 1.0, 10), '#ffd23c', s * 1.45, 0.5, 0).add(G.cyl(0.34, 0.3, 0.26, 10), '#c8c8d0', s * 1.45, 1.1, 0).add(G.box(0.7, 0.18, 0.4), '#5a5a64', s * 1.2, 0.05, 0)
        .add(G.box(0.62, 0.3, 0.05), '#d8262a', s * 1.45, 0.5, 0.33); }
      S.mesh(sM, R.shakers); }
    R.nozzles = [new THREE.Object3D(), new THREE.Object3D()]; R.nozzles[0].position.set(-1.45, 1.3, 0.1); R.nozzles[1].position.set(1.45, 1.3, 0.1); R.nozzles.forEach((o) => R.shakers.add(o));
    // arms: shoulder pivot > piston > the crab claw (left = mech's left, i.e. screen right)
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 1.8, 0.4, 0.1); R.bag.add(sh);
      const A = K(); A.add(G.sph(0.42, 10, 8), '#5a5a64', 0, 0, 0).add(G.cyl(0.18, 0.18, 1.3, 8), '#9a9aa4', s * 0.15, -0.2, 0.6, Math.PI / 2 - 0.35, 0, 0).add(G.cyl(0.24, 0.24, 0.5, 8), '#5a5a64', s * 0.12, -0.05, 0.25, Math.PI / 2 - 0.35, 0, 0)
        .add(G.sph(1, 12, 9), '#e8501e', s * 0.25, -0.55, 1.45, 0, 0, 0, 0.62, 0.55, 0.8).add(G.cone(0.28, 1.0, 8), '#e8501e', s * 0.25, -0.38, 2.25, Math.PI / 2, 0, 0, 1, 1, 0.7)
        .add(G.cone(0.2, 0.8, 7), '#c43a12', s * 0.25, -0.85, 2.05, Math.PI / 2 - 0.25, 0, 0).add(G.cone(0.1, 0.25, 5), '#14101f', s * 0.25, -0.36, 2.8, Math.PI / 2, 0, 0);
      A.mesh(aM[s < 0 ? 0 : 1], sh); R.arms.push({ sh, s }); }
    // cockpit dome on top + the kid inside
    R.domeG = new THREE.Group(); R.domeG.position.set(0, 1.95, 0.1); R.bag.add(R.domeG);
    { const D = K(); D.add(G.cyl(0.95, 1.05, 0.3, 14), '#5a5a64', 0, 0, 0).add(G.tor(0.98, 0.07, TAU, 6, 18), '#ffd23c', 0, 0.15, 0, Math.PI / 2, 0, 0); D.mesh(mM, R.domeG, 0.003); }
    R.dome = new THREE.Mesh(new THREE.SphereGeometry(0.98, 16, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.32, emissive: '#204a60', depthWrite: false }));
    R.dome.position.y = 0.15; R.domeG.add(R.dome);
    R.kid = buildKid(); R.kid.root.position.set(0, 0.12, 0); R.kid.root.scale.setScalar(0.62); R.domeG.add(R.kid.root);
    return R;
  }
  // the kid: an original pig-tailed snack-brand-style kid (~1.15 m tall unscaled): big eyes, bonnet-style hat (yellow, red trim), red dress, white collar
  function buildKid() {
    const K = DUELS.kit, G = DUELS.GEO, M = toonMat(), Kd = { root: new THREE.Group(), mat: M };
    Kd.body = new THREE.Group(); Kd.root.add(Kd.body);
    const B = K(); B.add(G.cyl(0.2, 0.36, 0.55, 12), '#d8262a', 0, 0.62, 0).add(G.cyl(0.21, 0.23, 0.08, 12), '#f4f0e6', 0, 0.9, 0).add(G.sph(0.17, 10, 8), '#d8262a', 0, 0.9, 0, 0, 0, 0, 1, 0.6, 1)
      .add(G.box(0.36, 0.05, 0.02), '#ffd23c', 0, 0.48, 0.3);
    B.mesh(M, Kd.body);
    Kd.legs = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.1, 0.36, 0); Kd.body.add(g); const L = K(); L.add(G.cyl(0.055, 0.05, 0.3, 6), '#f2c8a0', 0, -0.15, 0).add(G.box(0.12, 0.08, 0.2), '#7a1010', 0, -0.32, 0.04); L.mesh(M, g, 0); Kd.legs.push(g); }
    Kd.arms = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 0.22, 0.86, 0); Kd.body.add(g); const A = K(); A.add(G.cyl(0.05, 0.045, 0.34, 6), '#f2c8a0', 0, -0.17, 0).add(G.sph(0.07, 6, 5), '#d8262a', 0, 0, 0).add(G.sph(0.055, 6, 5), '#f2c8a0', 0, -0.35, 0); A.mesh(M, g, 0); Kd.arms.push(g); }
    Kd.head = new THREE.Group(); Kd.head.position.y = 1.0; Kd.body.add(Kd.head);
    const H = K(); H.add(G.sph(0.27, 14, 10), '#f2c8a0', 0, 0.2, 0)
      .add(G.sph(0.075, 10, 8), '#ffffff', -0.1, 0.24, 0.22, 0, 0, 0, 1, 1.25, 0.5).add(G.sph(0.075, 10, 8), '#ffffff', 0.1, 0.24, 0.22, 0, 0, 0, 1, 1.25, 0.5)
      .add(G.sph(0.045, 8, 6), '#3a2a6a', -0.1, 0.23, 0.255).add(G.sph(0.045, 8, 6), '#3a2a6a', 0.1, 0.23, 0.255).add(G.sph(0.015, 5, 4), '#ffffff', -0.085, 0.25, 0.29).add(G.sph(0.015, 5, 4), '#ffffff', 0.115, 0.25, 0.29)
      .add(G.sph(0.04, 6, 5), '#f08a8a', -0.16, 0.13, 0.2, 0, 0, 0, 1, 0.6, 0.5).add(G.sph(0.04, 6, 5), '#f08a8a', 0.16, 0.13, 0.2, 0, 0, 0, 1, 0.6, 0.5)
      .add(G.box(0.09, 0.025, 0.02), '#8a2a2a', 0, 0.08, 0.26)
      .add(G.sph(0.28, 14, 8), '#8a4a2a', 0, 0.3, -0.04, 0, 0, 0, 1.02, 0.9, 1);  // hair
    for (const s of [-1, 1]) H.add(G.sph(0.12, 10, 8), '#8a4a2a', s * 0.36, 0.08, -0.04, 0, 0, s * 0.4, 0.8, 1.4, 0.8).add(G.sph(0.05, 6, 5), '#d8262a', s * 0.3, 0.2, -0.04); // pigtails + bows
    // the bonnet-style hat: a deep yellow brim framing the face, red ribbon band + bow under the chin, a little frill
    H.add(G.sph(0.33, 14, 9), '#ffd23c', 0, 0.3, -0.06, -0.25, 0, 0, 1, 0.95, 0.95).add(G.tor(0.31, 0.055, TAU, 6, 20), '#ffd23c', 0, 0.24, 0.1, 0.15, 0, 0).add(G.tor(0.335, 0.03, TAU, 5, 20), '#d8262a', 0, 0.24, 0.12, 0.15, 0, 0)
      .add(G.sph(0.06, 6, 5), '#d8262a', 0.13, -0.04, 0.16).add(G.cone(0.05, 0.14, 5), '#d8262a', 0.16, -0.12, 0.15, 0, 0, 0.4);
    H.mesh(M, Kd.head, 0.0036);
    return Kd;
  }

  // little canvas textures for the hit fx
  function starTex() { return canvasTex(64, 64, (g) => { g.translate(32, 32); const r = g.createRadialGradient(0, 0, 1, 0, 0, 30); r.addColorStop(0, '#fff'); r.addColorStop(0.35, '#fff6a0'); r.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = r; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 9 : 31; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }, 64); }
  function ringTex() { return canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 20, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.6, 'rgba(255,255,255,.95)'); r.addColorStop(0.75, 'rgba(255,240,170,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, 128); }
  function warnTex() { return canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke(); g.lineWidth = 5; g.setLineDash([12, 10]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill(); }, 128); }
  function bangTex() { return canvasTex(128, 128, (g) => { g.fillStyle = '#ffd23c'; g.strokeStyle = '#14101f'; g.lineWidth = 8; g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 116); g.lineTo(6, 116); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d8262a'; g.font = '900 78px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 80); }, 128); }

  // ---------------- build ----------------
  { const cs = document.createElement('style'); cs.textContent = 'body.duel-chipkid #duel .dsay { top: calc(env(safe-area-inset-top, 0px) + 136px); } body.duel-chipkid.ck-ko #duel .dpow { display: none; }'; document.head.appendChild(cs); }
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#5a4060', 26, 70);
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 200);
    DUELS.sceneLights(sc, '#ffd8c0', '#4a3048', 1.4, '#ffe0b8', 1.8, new THREE.Vector3(-0.6, 1, -0.7));
    const pl = new THREE.PointLight('#ffb070', 30, 18, 1.4); pl.position.set(0, 6, 1); sc.add(pl);
    buildArena(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildChipKid === 'function') rig = window.buildChipKid({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['hip', 'bag', 'shakers', 'hatch', 'domeG']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.root.add(rig[k]); }
    rig.arms = rig.arms || []; rig.flash = rig.flash || []; rig.nozzles = rig.nozzles || [rig.shakers, rig.shakers]; if (!rig.kid) { rig.kid = buildKid(); rig.domeG.add(rig.kid.root); }
    C.R = rig; rig.root.position.set(0, 0.2, MZ); rig.root.rotation.y = Math.PI; sc.add(rig.root);
    C.base = { hipY: rig.hip.position.y, bagY: rig.bag.position.y };
    // chip cans (instanced), lane flash strips, the slam shadow, the ground warning ring, seasoning puffs (instanced quads)
    const can = DUELS.kit(); can.add(DUELS.GEO.cyl(0.3, 0.3, 0.9, 12), '#d8262a', 0, 0, 0).add(DUELS.GEO.cyl(0.31, 0.31, 0.25, 12), '#ffd23c', 0, 0, 0).add(DUELS.GEO.cyl(0.29, 0.29, 0.05, 12), '#c8c8d0', 0, 0.46, 0).add(DUELS.GEO.cyl(0.29, 0.29, 0.05, 12), '#c8c8d0', 0, -0.46, 0);
    const cg = can.geo(); cg.rotateZ(Math.PI / 2);
    C.canM = new THREE.InstancedMesh(cg, toonMat(), 8); C.canM.count = 0; C.canM.frustumCulled = false; sc.add(C.canM); C.cans = [];
    C.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.22, MZ / 2); sc.add(m); return m; });
    C.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })); C.shadow.rotation.x = -Math.PI / 2; C.shadow.position.set(0, 0.22, 0.4); sc.add(C.shadow);
    C.warn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: warnTex(), color: '#ff3030', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.warn.rotation.x = -Math.PI / 2; C.warn.position.set(0, 0.24, 0.1); C.warn.renderOrder = 2; sc.add(C.warn);
    C.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex(), transparent: true, depthWrite: false, depthTest: false, fog: false })); C.bang.scale.setScalar(0.7); C.bang.visible = false; C.bang.renderOrder = 5; sc.add(C.bang);
    const puffT = DUELS.dot('#ff9a3a'); C.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffT, transparent: true, depthWrite: false, fog: false }), 48); C.puffM.count = 0; C.puffM.frustumCulled = false; sc.add(C.puffM); C.puffs = [];
    // shared juice systems from the duel core: sparks, impact rings, chip crumbs + foil shreds, seasoning swirls / KO cloud, the cane trail
    C.spk = DUELS.sprites(sc, starTex(), 110, true); C.rng = DUELS.sprites(sc, ringTex(), 14, true); C.deb = DUELS.debris(sc, 220);
    C.cloud = DUELS.sprites(sc, DUELS.dot('#f0a050'), 70, false); C.trail = DUELS.trail(sc, '#fff1a8', 16, 0.15);
    // the shockwave (mallet pound) + the giant crab mallet + Mavis's crab cake
    C.shock = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffcf6a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); C.shock.rotation.x = -Math.PI / 2; C.shock.position.y = 0.26; C.shock.visible = false; sc.add(C.shock);
    { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.cyl(0.05, 0.06, 1.3, 8), '#8a5a2a', 0, 0.55, 0).add(G.cyl(0.36, 0.36, 0.95, 14), '#e8b040', 0, 1.3, 0, 0, 0, Math.PI / 2).add(G.cyl(0.38, 0.38, 0.12, 14), '#d8262a', 0.42, 1.3, 0, 0, 0, Math.PI / 2).add(G.cyl(0.38, 0.38, 0.12, 14), '#d8262a', -0.42, 1.3, 0, 0, 0, Math.PI / 2)
      .add(G.sph(0.16, 8, 6), '#e8501e', 0, 1.3, 0.34, 0, 0, 0, 1.4, 0.8, 0.5);
      C.mallet = K.mesh(toonMat(), null, 0.004); C.mallet.visible = false; C.malletG = new THREE.Group(); C.malletG.scale.setScalar(1.45); C.malletG.add(C.mallet); C.H.swR.add(C.malletG); }
    { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.cyl(0.2, 0.22, 0.12, 12), '#c8822e', 0, 0, 0).add(G.sph(0.19, 10, 6), '#d89a44', 0, 0.04, 0, 0, 0, 0, 1, 0.45, 1); C.cake = K.mesh(toonMat(), null, 0.003); C.cake.visible = false; sc.add(C.cake); }
  };

  // ---------------- state ----------------
  const mercy = () => !Q.get('ckhp');
  function newStats() { return { swings: 0, hits: 0, crits: 0, smashes: 0, specials: 0, dodges: 0, hitsTaken: 0, dmgTaken: 0, maxCombo: 0, cakes: 0, secondWind: 0, hitsBy: { cloud: 0, can: 0, slam: 0, jab: 0 }, attacks: { cloud: 0, cans: 0, slam: 0, jab: 0 }, rounds: 0, knockdowns: 0, t0: DUELS.t || 0 }; }
  function reset(round, hp = 100) {
    const keep = C.st && C.st.stats;
    const st = C.st = { t: 0, round, mhp: RHP[round], hp, meter: C.st ? C.st.meter || 0 : 0, lane: 0, duck: false, laneT: 0, lockT: 0, inv: 0, hurtT: 0, blindT: 0, hz: 0,
      sw: null, combo: 0, chainT: 0, bufA: 0, bufC: 0, chits: 0, chitT: 0, sp: null, spI: C.st ? C.st.spI || 0 : 0, fly: null, bounce: null, cake: null, cakes: 2, cakeCd: 0, wind: C.st ? !!C.st.wind : false,
      ms: 'intro', mt: 0, mdur: round === 0 ? 2.4 : 1.4, mixI: 0, jabSide: 1, cansLeft: 0, canT: 0, dodged: false, hitThis: false, over: false, won: false, outT: 0, downPending: false,
      stats: keep || newStats() };
    if (Q.get('ckhp')) st.hp = Math.max(1, +Q.get('ckhp') || 1);
    C.cans.length = 0; C.canM.count = 0; C.puffs.length = 0; C.puffM.count = 0; DUELS.blind(0); C.spk.clear(); C.deb.clear(); C.cloud.clear(); C.rng.clear(); C.trail.clear(); C.knock = 0; C.fl = 0; C.mallet.visible = false; C.cake.visible = false; C.shock.visible = false;
    const R = C.R; R.root.visible = true; R.root.position.set(0, 0.2, MZ); R.root.rotation.set(0, Math.PI, 0); R.hip.position.y = C.base.hipY; R.bag.position.y = C.base.bagY; R.bag.rotation.set(0, 0, 0); R.bag.scale.set(1, 1, 1);
    R.domeG.visible = true; if (R.dome) { R.dome.visible = true; R.dome.position.set(0, 0.15, 0); R.dome.rotation.set(0, 0, 0); } const kid = R.kid; kid.root.visible = true; if (kid.root.parent !== R.domeG) { R.domeG.add(kid.root); } kid.root.position.set(0, 0.12, 0); kid.root.rotation.set(0, 0, 0); kid.root.scale.setScalar(0.62);
    for (const a of kid.arms) a.rotation.set(0, 0, 0); for (const l of kid.legs) l.rotation.set(0, 0, 0); kid.head.rotation.set(0, 0, 0);
    DUELS.bars(st.hp / 100, 1); return st;
  }
  function subHud(st) { DUELS.sub('', 'ROUND ' + (st.round + 1) + '/3'); }
  function powHud(st) { const rdy = st.meter >= 100; DUELS.power(st.meter / 100, rdy, rdy ? 'POWER READY!' : 'POWER'); }
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'harborplace'); return L && L.boss && L.boss.lines; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  C.start = function () {
    document.body.classList.remove('ck-ko'); C.st = null; const r0 = clamp((+Q.get('ckround') || 1) - 1, 0, 2) | 0; const st = reset(r0); DUELS.log.push('chipkid:' + C.rigKind); subHud(st); powHud(st);
    DUELS.banner('THE CHIP KID<small>HARBORPLACE · ROUND ' + (r0 + 1) + '</small>', 2.2);
    const l = lines(); if (l) DUELS.say('THE CHIP KID', pick(l.intro), 3.2);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 3, MZ);
  };
  C.again = function () { C.st = null; C.start(); DUELS.log.push('chipkid:rematch'); };
  C.retry = function () { const r = C.st.round; reset(r); C.st.ms = 'guard'; C.st.mdur = 1.6; C.st.meter = 100; subHud(C.st); powHud(C.st); DUELS.banner('ROUND ' + (r + 1) + '<small>AGAIN! FULL HEALTH + FULL POWER</small>', 1.8); };
  C.exit = function () { DUELS.blind(0); document.body.classList.remove('ck-ko'); };
  C.buffer = function (I) { const st = C.st; if (!st) return; if (I.a) st.bufA = 0.32; if (I.c) st.bufC = 0.32; };

  function bell(n = 1) { if (!AC || AC.state !== 'running') return; try { for (let k = 0; k < n; k++) { const t = AC.currentTime + k * 0.22, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + 0.55); } } catch (e) {} }
  function puff(p, v, life = 1.2, s = 1) { if (C.puffs.length < 48) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  const CHIP = ['#f2c25a', '#e8a83a', '#ffd98a', '#d98a2a'], FOIL = ['#d8262a', '#ffd23c', '#c8c8d0', '#b81e22'];
  function hitFx(p, big = 0) { // sparks + an impact ring + chip crumbs + foil shreds
    C.spk.burst(p, 8 + big * 10, { spd: 5 + big * 3, size: 0.32 + big * 0.12, life: 0.35, grav: 4 });
    C.rng.burst(p, 1, { v: V3.set(0, 0, 0), size: 0.9 + big * 0.9, grow: 2.2, life: 0.18 + big * 0.06, grav: 0, drag: 0 });
    C.deb.burst(p, 10 + big * 14, { cols: CHIP, spd: 3 + big * 2.5, up: 3.2, size: 0.17, life: 1.5, vz: -1.5 });
    C.deb.burst(p, 3 + big * 6, { cols: FOIL, spd: 2.6 + big * 2, up: 2.6, size: 0.2, sy: 0.45, life: 1.7, vz: -1.2 });
  }
  function mechFacePoint(st, out, side = 0) { return out.set(sx(st.lane) * 0.3 + side * 0.45 + rnd(-0.15, 0.15), 2.5 + rnd(-0.3, 0.5), MZ - 1.05 + C.knock + (st.fly ? 0 : 0)); }
  function moment(name) { const w = window.__ckShot; if (w && (w === name || name.startsWith(w + ':'))) { window.__ckShot = null; window.__ckShotAt = name; DUELS.hold = true; } } // test screenshots
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.sp) return false; st.hp -= dmg; st.inv = 1.3; st.hurtT = 0.45; st.stats.hitsBy[kind]++; st.stats.hitsTaken++; st.stats.dmgTaken += dmg; DUELS.hurt(); sfx('hurt'); C.hflash = 1; st.lane = 0; st.duck = false; st.lockT = 0.3; st.sw = null; st.combo = 0;
    st.meter = Math.min(100, st.meter + 6); powHud(st); DUELS.shake(0.25); V.set(C.H.root.position.x, 2.2, 0.2); DUELS.pop('-' + dmg, V, ''); DUELS.log.push('hurt:' + kind);
    if (st.hp <= 0) {
      if (mercy() && !st.wind) { st.wind = true; st.hp = 50; st.stats.secondWind++; st.inv = 2.2; DUELS.banner('SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 1.8); DUELS.say('MAVIS', 'Get UP, Harold! You promised me crab cakes!', 2.4); DUELS.flash('#9dff6b', 0.45); V.set(C.H.root.position.x, 2.4, 0.2); DUELS.pop('+50', V, 'heal'); st.meter = 100; powHud(st); return true; }
      st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('chipkid:lose:' + kind);
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'T.K.O.!', 'The Chip Kid\'s mech flattened Harold. Retry round ' + (st.round + 1) + ' with full health and a full POWER meter.'); }, SIM ? 300 : 1400); }
    return true;
  }
  function dodgeOk(st) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; st.meter = Math.min(100, st.meter + 14); powHud(st); DUELS.tell('NICE DODGE! +POWER', 0.7); }

  // ---------------- damage to the mech (every hit funnels through here) ----------------
  function dmgMech(st, base, o = {}) {
    if (st.mhp <= 0 || st.ms === 'down' || st.ms === 'ko') return 0;
    const crit = !o.special && (st.ms === 'open' || st.ms === 'stun'), dmg = Math.round(base * (crit ? 1.5 : 1));
    st.mhp = Math.max(0, st.mhp - dmg); st.stats.hits++; if (crit) st.stats.crits++;
    st.chits++; st.chitT = 1.6; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.chits); DUELS.combo(st.chits);
    if (!o.special) { st.meter = Math.min(100, st.meter + (o.pw || 8)); powHud(st); }
    const p = o.pos || mechFacePoint(st, V2, o.side || 0); const big = o.big || 0;
    hitFx(p, big); C.knock = Math.min(1.4, C.knock + (o.kb ?? (0.16 + big * 0.3))); C.fl = Math.min(1.5, C.fl + 0.6 + big * 0.5);
    for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set('#ffffff'); m.userData.flash.value = 1; }
    DUELS.pop(String(dmg), V3.copy(p).add(V.set(rnd(-0.3, 0.3), 0.3, -0.3)), big >= 2 ? 'big' : crit || big ? 'crit' : '');
    if (o.word) DUELS.pop(o.word, V3.copy(p).add(V.set(0, 1.0, -0.4)), 'word');
    DUELS.impact({ stop: o.stop ?? (big ? 0.085 : 0.065), shake: o.shake ?? (0.16 + big * 0.24), sfx: o.sfx || (big ? 'heavy' : 'light') });
    if (big) DUELS.hitSfx('crunch');
    if (st.mhp <= 0) { if (st.sp) st.downPending = true; else knockdown(st); }
    return dmg;
  }
  function knockdown(st) {
    st.downPending = false; st.stats.knockdowns++; C.cans.length = 0; st.sw = null; C.trail.clear(); const l = lines();
    if (st.round >= 2) { // the final blow: slow-mo KO cinematic
      setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; bell(3); DUELS.impact({ stop: 0.12, slow: 0.25, slowT: 1.4, zoom: 1.45, zoomT: 1.6, flash: '#fff', flashA: 0.9, shake: 0.6, sfx: 'mega' });
      DUELS.banner('K.O.!!<small>THE FINAL BLOW</small>', 2.6); document.body.classList.add('ck-ko'); DUELS.log.push('chipkid:ko'); DUELS.combo(0); DUELS.ready(null);
    } else {
      setM(st, 'down', 2.8); bell(2); DUELS.impact({ stop: 0.1, slow: 0.35, slowT: 0.7, zoom: 1.25, zoomT: 0.9, flash: '#fff', flashA: 0.6, shake: 0.5, sfx: 'mega' });
      DUELS.banner('DOWN!<small>ROUND ' + (st.round + 1) + ' TO HAROLD</small>', 2.2); C.R.bag.getWorldPosition(V); V.y += 1; C.deb.burst(V, 40, { cols: CHIP, spd: 5, up: 4, size: 0.18, life: 1.8, vz: -2 }); C.deb.burst(V, 14, { cols: FOIL, spd: 4, up: 3, size: 0.22, sy: 0.45, life: 1.8 });
      DUELS.say('MAVIS', ['That\u2019s my Harold!', 'Give that mech another one, dear!', 'Look at you go, hon!'][st.round % 3], 2.2);
      if (l && l.taunt && Math.random() < 0.5) setTimeout(() => { if (DUELS.cur === C && C.st === st) DUELS.say('THE CHIP KID', pick(l.taunt), 2.4); }, SIM ? 100 : 1800);
    }
  }

  // ---------------- the mech's brain (slow, loud telegraphs) ----------------
  function mechThink(st, dt) {
    const P = RND[st.round]; st.mt += dt; const u = st.mt / st.mdur;
    if (st.sp && st.ms !== 'down' && st.ms !== 'ko') { if (st.ms !== 'stun') setM(st, 'stun', 99); return; }
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.6); break;
      case 'guard': if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++; DUELS.hitSfx('power');
          if (a === 'cloud') { setM(st, 'cloudTell', P.cloud); DUELS.tell('SEASONING CLOUD! DUCK OR DODGE!', P.cloud); }
          else if (a === 'cans') { setM(st, 'cansTell', 1.0); st.cansLeft = P.cans; st.canT = 0; DUELS.tell('CHIP-CAN BARRAGE! STEP OUT OF THE RED LANE!', 1.4); }
          else if (a === 'slam') { setM(st, 'slamTell', P.slam); DUELS.tell('BAG-SLAM! DODGE LEFT OR RIGHT!', P.slam); }
          else { st.jabSide = Math.random() < 0.5 ? -1 : 1; setM(st, 'jabTell', P.jab); DUELS.tell('CLAW JAB! DODGE ' + (st.jabSide < 0 ? 'RIGHT \u25b6' : '\u25c0 LEFT') + ' OR DUCK!', P.jab); } }
        break;
      case 'cloudTell': if (st.mt > st.mdur) { setM(st, 'cloud', 0.7); sfx('swing'); } break;
      case 'cloud': { // two jets of seasoning at face height down the middle lane
        C.R.nozzles.forEach((n) => { n.getWorldPosition(V); for (let k = 0; k < 2; k++) puff(V, V2.set(rnd(-0.4, 0.4) - V.x * 0.8, rnd(-0.5, 0.1), -6.5 + rnd(-1, 1)), 0.9, rnd(0.8, 1.4)); });
        if (u > 0.3 && u < 0.85 && !st.hitThis && st.lane === 0 && !st.duck) { if (hurtHarold(st, DMG_TO_HAROLD.cloud, 'cloud')) { st.hitThis = true; st.blindT = 0.9; } }
        if (st.mt > st.mdur) { if (!st.hitThis) dodgeOk(st); setM(st, 'open', P.open); DUELS.tell('IT\u2019S OPEN! SWING!', 0.9); } break; }
      case 'cansTell': if (st.mt > st.mdur) setM(st, 'cans', 99); break;
      case 'cans': st.canT -= dt;
        if (st.cansLeft > 0 && st.canT <= 0) { st.cansLeft--; st.canT = P.gap; const lane = Math.random() < 0.45 ? st.lane : [-1, 0, 1][Math.floor(Math.random() * 3)]; C.cans.push({ lane, z: MZ - 0.6, t: 0, hit: false, spd: P.cspd }); sfx('hit'); }
        if (st.cansLeft <= 0 && C.cans.length === 0) { if (!st.hitThis) dodgeOk(st); setM(st, 'open', P.open); DUELS.tell('IT\u2019S OPEN! SWING!', 0.9); }
        break;
      case 'slamTell': if (st.mt > st.mdur) setM(st, 'slam', 0.3); break;
      case 'slam': if (!st.hitThis && st.mt > 0.18) { st.hitThis = true; DUELS.hitSfx('boom'); DUELS.shake(0.55); C.deb.burst(V.set(sx(st.lane) * 0.2, 0.3, 0.8), 18, { cols: ['#8a6a5a', '#a07a64', '#6a4a3a'], spd: 4, up: 2.5, size: 0.14, life: 1 });
          if (st.lane === 0) hurtHarold(st, DMG_TO_HAROLD.slam, 'slam'); else dodgeOk(st); }
        if (st.mt > st.mdur) { setM(st, 'open', P.open + 0.6); DUELS.tell('IT\u2019S STUCK! SWING AWAY!', 1.0); } break;
      case 'jabTell': if (st.mt > st.mdur) { setM(st, 'jab', 0.28); sfx('swing'); } break;
      case 'jab': if (!st.hitThis && st.mt > 0.14) { st.hitThis = true; const safe = st.duck || st.lane === -st.jabSide; if (!safe) hurtHarold(st, DMG_TO_HAROLD.jab, 'jab'); else dodgeOk(st); sfx('hit'); }
        if (st.mt > st.mdur) setM(st, 'open', P.open * 0.8); break;
      case 'open': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'stun': setM(st, 'open', 1.3); break; // (a special just ended)
      case 'down': if (st.mt > st.mdur) { st.round++; st.stats.rounds++; st.mhp = RHP[st.round]; const heal = 100 - st.hp; st.hp = 100; st.cakes = 2; setM(st, 'guard', 1.6); subHud(st); bell(1);
          if (heal > 0) { V.set(C.H.root.position.x, 2.4, 0.2); DUELS.pop('+' + Math.round(heal), V, 'heal'); }
          DUELS.banner('ROUND ' + (st.round + 1) + '<small>' + (st.round === 2 ? 'FINAL ROUND! FULL HEALTH' : 'FIGHT! FULL HEALTH') + '</small>', 1.6); } break;
      case 'ko': break;
    }
  }
  function stepCans(st, dt) {
    for (let i = C.cans.length - 1; i >= 0; i--) { const c = C.cans[i]; c.t += dt; c.z -= c.spd * dt;
      if (!c.hit && c.z < 0.5 && c.z > -0.4) { c.hit = true; if (st.lane === c.lane) hurtHarold(st, DMG_TO_HAROLD.can, 'can'); }
      if (c.z < -3) C.cans.splice(i, 1); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(); C.cans.forEach((c, i) => { q.setFromAxisAngle(V.set(1, 0, 0), -c.t * 14); m.compose(V2.set(sx(c.lane), 0.52, c.z), q, V.set(1, 1, 1)); C.canM.setMatrixAt(i, m); });
    C.canM.count = C.cans.length; C.canM.visible = C.cans.length > 0; C.canM.instanceMatrix.needsUpdate = true;
    // lane warnings: a lane glows while a can is on its way down it, or while a claw jab is aimed at it
    const warn = [0, 0, 0]; for (const c of C.cans) if (c.z > 0.4) warn[c.lane + 1] = Math.max(warn[c.lane + 1], 0.45 + 0.3 * Math.sin(st.t * 30));
    if (st.ms === 'jabTell') { const k = 0.3 + 0.25 * Math.sin(st.t * 24); warn[st.jabSide + 1] = Math.max(warn[st.jabSide + 1], k); warn[1] = Math.max(warn[1], k); }
    C.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 20, dt); l.visible = l.material.opacity > 0.01; });
  }

  // ---------------- Harold: cane combo, dodges, POWER specials ----------------
  C.step = function (dt, I) {
    const st = C.st; if (!st) return; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.lockT -= dt; st.chainT -= dt; st.bufA -= dt; st.bufC -= dt; st.cakeCd -= dt;
    if (I.a) st.bufA = 0.32; if (I.c) st.bufC = 0.32;
    if (st.chitT > 0 && (st.chitT -= dt) <= 0) { st.chits = 0; DUELS.combo(0); }
    if (st.blindT > 0) { st.blindT -= dt; DUELS.blind(clamp(st.blindT / 0.9, 0, 1) * 0.6); } else DUELS.blind(0);
    const fighting = !st.over && st.ms !== 'down' && st.ms !== 'ko' && st.ms !== 'intro';
    if (!st.over) {
      // dodge / duck: held stick or buttons; a dodge lasts at most ~1.1 s, then Harold steps back to the middle
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; const duck = I.my < -0.5 || I.bh;
      const busy = st.sw || st.sp; if (st.lockT > 0 || busy) want = busy ? 0 : st.lane;
      if (want !== 0 && st.lane === want) { st.laneT += dt; if (st.laneT > 1.1) { st.lane = 0; st.lockT = 0.3; st.laneT = 0; } }
      else if (st.lockT <= 0 || busy) { st.lane = want; st.laneT = 0; }
      st.duck = st.lockT <= 0 && !busy && st.lane === 0 && duck;
      // POWER special
      if (st.bufC > 0 && fighting && !st.sp && st.hurtT <= 0) { st.bufC = 0;
        if (st.meter >= 100) startSpecial(st); else if (!st.nopowT || st.t > st.nopowT) { DUELS.tell('POWER CHARGING: HIT THE MECH TO FILL IT', 0.9); st.nopowT = st.t + 1; } }
      // cane swings (a buffered press chains the next hit of the combo)
      if (st.bufA > 0 && fighting && !st.sw && !st.sp && st.hurtT <= 0) { st.bufA = 0;
        const i = st.chainT > 0 ? (st.combo + 1) % 3 : 0; st.combo = i; st.sw = { i, t: 0, hit: false }; st.stats.swings++; st.lane = 0; st.duck = false; DUELS.hitSfx(i === 2 ? 'whoosh' : 'whoosh'); }
      if (st.sw) { const W = SWINGS[st.sw.i]; st.sw.t += dt;
        if (!st.sw.hit && st.sw.t >= W.hit) { st.sw.hit = true; const fin = st.sw.i === 2; if (fin) st.stats.smashes++;
          dmgMech(st, W.dmg, { pw: W.pw, big: fin ? 1 : 0, side: st.sw.i === 0 ? -1 : st.sw.i === 1 ? 1 : 0, word: fin ? pick(['SMASH!', 'WHACK!', 'CRUNCH!', 'BONK!']) : null, sfx: fin ? 'heavy' : 'light' }); }
        if (st.sw && st.sw.hit && st.sw.i === 2 && st.sw.t > W.hit + 0.07) moment('hit');
        if (st.sw && st.sw.t >= W.dur) { st.chainT = st.sw.i === 2 ? 0 : 0.45; if (st.sw.i === 2) st.combo = 2; st.sw = null; } }
      // Mavis tosses a crab cake when Harold is low (twice a round)
      if (mercy() && fighting && !st.cake && st.cakes > 0 && st.hp < 55 && st.cakeCd <= 0) { st.cakes--; st.cakeCd = 5; st.cake = { t: 0 }; C.cake.visible = true; DUELS.say('MAVIS', pick(['Catch, hon! Crab cake!', 'Eat something, Harold!', 'Here, dear, fresh from Lexington!']), 1.8); sfx('jump'); }
    }
    if (st.cake) { const k = (st.cake.t += dt) / 0.8; C.M.root.getWorldPosition(V); V.y += 1.6; V2.set(C.H.root.position.x, 1.5, st.hz); C.cake.position.lerpVectors(V, V2, Math.min(1, k)); C.cake.position.y += Math.sin(Math.min(1, k) * Math.PI) * 2; C.cake.rotation.x += dt * 12;
      if (k >= 1) { st.cake = null; C.cake.visible = false; const heal = Math.min(25, 100 - st.hp); st.hp += heal; st.stats.cakes++; DUELS.pop('+' + Math.round(heal) + ' CRAB CAKE', V2.setY(2.4), 'heal'); DUELS.flash('#9dff6b', 0.3); sfx('ko'); } }
    if (st.sp) stepSpecial(st, dt);
    mechThink(st, dt); stepCans(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, (st.mhp / RHP[st.round] + (2 - st.round)) / 3);
    const rdy = st.meter >= 100 && fighting && !st.sp; DUELS.hot(rdy); DUELS.ready(rdy ? '\u26a1 ' + (TOUCH() ? 'TAP' : 'PRESS') + ' <b>' + (TOUCH() ? 'POWER' : 'E') + '</b>: ' + SPECIALS[st.spI % 3].name : null);
    if (st.ms === 'ko') outro(st, dt);
  };

  // ---------------- POWER specials ----------------
  function startSpecial(st) {
    const S0 = SPECIALS[st.spI++ % 3]; st.sp = { id: S0.id, t: 0, dur: S0.dur, n: 0, done: false, ang: 0 }; st.meter = 0; powHud(st); st.stats.specials++; st.sw = null; st.lane = 0; st.duck = false; C.cans.length = 0; st.cansLeft = 0;
    DUELS.banner(S0.ban + '<small>POWER SPECIAL</small>', 1.5); DUELS.hitSfx('power'); DUELS.flash('#ffd23c', 0.5); DUELS.log.push('special:' + S0.id); DUELS.ready(null);
    setM(st, 'stun', 99);
  }
  function stepSpecial(st, dt) {
    const sp = st.sp, t = (sp.t += dt), hx = C.H.root.position.x;
    if (sp.id === 'cyclone') { // spin up, slide in, 6 quick hits inside an orange seasoning tornado, a big last whack
      sp.ang += dt * (t < 0.3 ? 10 : 24); st.hz = t < 1.75 ? Math.min(1.9, t * 4) : Math.max(0, 1.9 - (t - 1.75) * 5);
      if (t > 0.1 && t < 1.7) for (let k = 0; k < 2; k++) { const a = sp.ang + k * Math.PI + rnd(-0.3, 0.3), r = rnd(0.7, 1.3); C.cloud.burst(V.set(hx + Math.cos(a) * r, rnd(0.3, 2.4), st.hz + Math.sin(a) * r), 1, { v: V2.set(-Math.sin(a) * 4, rnd(1, 2.5), Math.cos(a) * 4), size: rnd(0.5, 0.9), grow: 1.2, life: 0.6, grav: 0, drag: 2 }); }
      if (t > 0.35 && sp.n < 6 && t > 0.35 + sp.n * 0.17) { sp.n++; dmgMech(st, 6, { special: true, big: 0, stop: 0.035, shake: 0.2, kb: 0.1, side: sp.n % 2 ? -1 : 1 }); DUELS.hitSfx('whoosh'); }
      if (t > 1.5 && sp.n === 6) { sp.n++; dmgMech(st, 14, { special: true, big: 2, stop: 0.09, shake: 0.6, word: 'OLD BAY!' }); DUELS.impact({ slow: 0.3, slowT: 0.45, zoom: 1.3, zoomT: 0.6, flash: '#ff9a3a', flashA: 0.55 }); }
    } else if (sp.id === 'mallet') { // crouch, leap with the giant crab mallet, slow-mo at the top, POUND: a shockwave rolls across the ring and bounces the mech
      C.mallet.visible = t > 0.12 && t < 2.1; C.mallet.scale.setScalar(clamp((t - 0.12) / 0.15, 0.01, 1) * (t > 1.9 ? Math.max(0.01, (2.1 - t) / 0.2) : 1));
      st.hz = t < 0.35 ? 0 : t < 0.95 ? (t - 0.35) / 0.6 * 1.3 : Math.max(0, 1.3 - Math.max(0, t - 1.7) * 3);
      if (t > 0.6 && !sp.apex) { sp.apex = true; DUELS.impact({ slow: 0.3, slowT: 0.4, zoom: 0.85, zoomT: 0.7 }); DUELS.hitSfx('whoosh'); }
      if (t > 0.95 && !sp.pound) { sp.pound = true; C.shock.visible = true; sp.shT = 0; DUELS.impact({ stop: 0.1, shake: 1.0, flash: '#fff', flashA: 0.75, sfx: 'boom', zoom: 1.2, zoomT: 0.5 }); DUELS.hitSfx('mega');
        C.deb.burst(V.set(hx, 0.3, 1.6), 30, { cols: ['#8a6a5a', '#a07a64', '#6a4a3a', '#ffd23c'], spd: 6, up: 4, size: 0.16, life: 1.3 }); C.spk.burst(V.set(hx, 0.5, 1.6), 16, { spd: 7, size: 0.4, life: 0.4 }); DUELS.pop('POUND!', V.set(hx, 1.6, 1.6), 'word'); }
      if (sp.pound) { sp.shT += dt; const r = 0.5 + sp.shT * 9; C.shock.scale.setScalar(r); C.shock.position.set(hx, 0.26, 1.6); C.shock.material.opacity = Math.max(0, 1 - sp.shT / 0.6); if (sp.shT > 0.6) C.shock.visible = false;
        if (!sp.hit && sp.shT > 0.28) { sp.hit = true; st.bounce = { t: 0 }; dmgMech(st, 50, { special: true, big: 2, stop: 0.08, shake: 0.7, kb: 0.5 }); } }
    } else if (sp.id === 'homer') { // charge ("HON!"), step in, the home-run swing: the mech flies off into the sky, spins, and crashes back down
      st.hz = t < 0.95 ? 0 : t < 1.15 ? (t - 0.95) / 0.2 * 1.6 : Math.max(0, 1.6 - Math.max(0, t - 2.4) * 2.5);
      if (t < 0.95) { C.H.swR.getWorldPosition(V); V.y += 0.4; C.spk.burst(V.clone().add(V2.set(rnd(-1.4, 1.4), rnd(-0.6, 1.4), rnd(-1, 1))), 1, { v: V2.multiplyScalar(-2.5), size: 0.3, life: 0.35, grav: 0, drag: 0 }); }
      if (t > 0.45 && !sp.hon) { sp.hon = true; DUELS.pop('HON!', V.set(hx, 2.9, 0.4), 'word'); DUELS.hitSfx('power'); DUELS.flash('#ffd23c', 0.35); DUELS.zoom(1.15, 0.6); }
      if (t > 1.12 && !sp.hit) { sp.hit = true; st.fly = { t: 0 }; dmgMech(st, 60, { special: true, big: 2, stop: 0.13, shake: 1.0, kb: 0, word: 'HOME RUN!' }); DUELS.impact({ slow: 0.22, slowT: 0.7, zoom: 1.4, zoomT: 0.9, flash: '#fff', flashA: 0.9, sfx: 'mega' }); bell(2); }
    }
    if ((sp.id === 'cyclone' && t > 1.58) || (sp.id === 'mallet' && sp.shT > 0.32) || (sp.id === 'homer' && st.fly && st.fly.t > 0.25)) moment('special:' + sp.id);
    if (t >= sp.dur) { st.sp = null; C.mallet.visible = false; C.shock.visible = false; st.hz = 0; if (st.downPending) knockdown(st); else if (st.ms === 'stun') setM(st, 'open', 1.3); }
  }

  // ---------------- the ending: slow-mo, the mech shakes, blows apart into a chip cloud, the kid tumbles out, sulks, and runs off; then the grade ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R, kid = R.kid;
    if (t < 0.9) { R.root.position.x = rnd(-0.08, 0.08) * (t / 0.9); R.bag.scale.set(1 + 0.18 * t, 1 + 0.12 * t, 1 + 0.18 * t); for (const m of R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(Math.sin(t * 40) > 0 ? '#ff3030' : '#ffffff'); m.userData.flash.value = 0.4 + 0.5 * t; }
      if (Math.random() < dt * 30) { R.bag.getWorldPosition(V); V.x += rnd(-1.4, 1.4); V.y += rnd(-1, 1.6); C.spk.burst(V, 3, { spd: 4, size: 0.35 }); } }
    if (t >= 0.9 && !st.boom) { st.boom = true; R.bag.getWorldPosition(V); kid.root.getWorldPosition(V2); C.scene.attach(kid.root); kid.root.scale.setScalar(1); st.kid0 = kid.root.position.clone(); R.root.visible = false;
      DUELS.impact({ stop: 0.06, shake: 1.3, flash: '#fff', flashA: 1, sfx: 'boom', zoom: 0.8, zoomT: 1.2 }); DUELS.hitSfx('mega');
      C.deb.burst(V, 150, { cols: CHIP, spd: 9, up: 6, size: 0.22, life: 2.6 }); C.deb.burst(V, 50, { cols: FOIL, spd: 8, up: 5, size: 0.3, sy: 0.45, life: 2.8 });
      C.cloud.burst(V, 40, { spd: 5, size: 1.2, grow: 2.2, life: 1.4, grav: -0.6, drag: 2.2 }); C.spk.burst(V, 50, { spd: 10, size: 0.5, life: 0.6 }); C.rng.burst(V, 3, { v: V3.set(0, 0, 0), size: 2.5, grow: 4, life: 0.4, grav: 0, drag: 0 });
      DUELS.pop('KABOOM!', V.clone().add(V3.set(0, -1.2, -1.5)), 'big'); DUELS.say('MAVIS', 'Harold! You popped the whole bag!', 2.4); }
    if (st.boom && t > 1.45) moment('ko');
    if (st.boom) { const k = t - 0.9; const land = V2.set(-2.4, 0.2, 2.2);
      if (k < 1.1) { const u = k / 1.1; kid.root.position.lerpVectors(st.kid0, land, u); kid.root.position.y = lerp(st.kid0.y, 0.2, u) + Math.sin(u * Math.PI) * 3.2; kid.root.rotation.set(u * TAU * 1.5, Math.PI + u * TAU, 0); }
      else if (k < 3.7) { kid.root.position.copy(land); kid.root.rotation.set(0, Math.PI + 0.8, 0); // sulk: arms crossed, a stomp or two, head down
        kid.arms[0].rotation.set(-1.2, 0, -1.2); kid.arms[1].rotation.set(-1.2, 0, 1.2); kid.head.rotation.x = 0.25 + Math.sin(k * 3) * 0.05; kid.head.rotation.y = Math.sin(k * 1.3) * 0.4;
        const stomp = Math.max(0, Math.sin(k * 9)) * (k < 2.6 ? 1 : 0); kid.legs[0].rotation.x = -stomp * 0.6; kid.root.position.y = 0.2 + stomp * 0.04;
        if (!st.sulkSaid) { st.sulkSaid = true; const l = lines(); if (l) DUELS.say('THE CHIP KID', pick(l.defeat), 3.0); } }
      else if (k < 5.6) { const u = (k - 3.7) / 1.9; kid.root.rotation.set(0, -Math.PI / 2, 0); // runs off to screen right (-x), out under the ropes
        kid.root.position.set(lerp(-2.4, -10, u), 0.2 + Math.abs(Math.sin(k * 14)) * 0.1, 2.2 + u * 2); kid.arms[0].rotation.set(Math.sin(k * 14) * 0.9, 0, 0); kid.arms[1].rotation.set(-Math.sin(k * 14) * 0.9, 0, 0); kid.legs[0].rotation.x = Math.sin(k * 14) * 0.8; kid.legs[1].rotation.x = -Math.sin(k * 14) * 0.8; kid.head.rotation.set(0, 0, 0); }
      else if (!st.winDone) { st.winDone = true; kid.root.visible = false; if (!DUELS.cleared.harborplace) DUELS.bossCleared('harborplace', 'chipkid-duel');
        const S1 = st.stats, secs = Math.round((DUELS.t || 0) - S1.t0), stars = S1.hitsTaken <= 3 ? 3 : S1.hitsTaken <= 8 ? 2 : 1, grade = ['', 'B', 'A', 'S'][stars];
        st.grade = { stars, grade, secs }; DUELS.log.push('chipkid:win:' + grade);
        const txt = '<span style="color:#ffd23c;font-size:22px;letter-spacing:4px">' + '\u2605'.repeat(stars) + '<span style="opacity:.25">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + grade +
          '<br>MAX COMBO ' + S1.maxCombo + ' · SPECIALS ' + S1.specials + ' · HITS TAKEN ' + S1.hitsTaken + '<br>Harborplace is clear. Crime at Harborplace: 0.';
        setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'THE CHIP KID<br>RAN HOME!', txt, { again: true }); }, SIM ? 300 : 900); } }
  }
  function stepFx(dt) {
    const m = new THREE.Matrix4(), q = C.cam.quaternion;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.2); p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.6 + p.t * 2.2); m.compose(p.p, q, V.set(s, s, s)); C.puffM.setMatrixAt(i, m); }); C.puffM.count = C.puffs.length; C.puffM.visible = C.puffs.length > 0; C.puffM.instanceMatrix.needsUpdate = true;
    C.spk.update(dt, C.cam); C.rng.update(dt, C.cam); C.deb.update(dt); C.cloud.update(dt, C.cam);
    C.knock = Math.max(0, C.knock - dt * 2.2); C.fl = Math.max(0, C.fl - dt * 5);
  }

  // ---------------- poses + render ----------------
  function canePose(i, u) { // 0 forehand (right -> left), 1 backhand (left -> right), 2 overhead SMASH; u 0..1 over the swing; the hit lands near u = hit / dur
    const p = blank(); legsStance(p, 0.22, 0.6); const W = SWINGS[i], hu = W.hit / W.dur, wind = hu * 0.55;
    const a = u < wind ? 0 : ease(clamp((u - wind) / (hu - wind + 0.12), 0, 1)), back = u < wind ? ease(u / wind) : 1; // back: into the wind-up, a: through the arc
    p.shL = [-0.6, 0, 0.5]; p.elL = [-1.2, 0, 0]; p.lgL = [-0.6, 0, 0.16]; p.knL = [0.7, 0, 0]; p.lgR = [0.3, 0, -0.16]; p.knR = [0.3, 0, 0];
    if (i === 0) { p.torso = [0.25, lerp(-0.2, lerp(-0.95, 1.0, a), back), 0]; p.hips = [0, lerp(-0.45, 0.45, a), 0]; p.shR = [lerp(-1.0, -1.45, a), 0, lerp(lerp(-0.4, -1.35, back), 0.65, a)]; p.elR = [lerp(-0.9, -0.1, a), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(-0.7, 0.4, a)]; }
    else if (i === 1) { p.torso = [0.25, lerp(0.6, lerp(1.0, -1.0, a), back), 0]; p.hips = [0, lerp(0.45, -0.45, a), 0]; p.shR = [lerp(-1.1, -1.45, a), 0, lerp(lerp(0.2, 0.75, back), -1.35, a)]; p.elR = [lerp(-1.3, -0.1, a), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(0.5, -0.5, a)]; }
    else { p.torso = [lerp(lerp(0.1, -0.35, back), 0.65, a), 0.1, 0]; p.neck = [lerp(-0.3, 0.2, a), 0, 0]; p.shR = [lerp(lerp(-1.4, -3.0, back), -0.55, a), 0, -0.2]; p.elR = [lerp(-0.8, 0, a), 0, 0]; p.swR = [Math.PI / 2 - 0.2, 0, 0];
      p.shL = [lerp(-2.6, -0.7, a), 0, 0.3]; p.y = Math.sin(clamp(u / hu, 0, 1) * Math.PI) * 0.22; }
    return p;
  }
  function haroldPose(st, t) {
    let p;
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.won && st.ms === 'ko' && st.outT > 1.0) { p = HERO_POSES.idle(t); p.shR = [-3.0, 0, -0.3]; p.elR = [-0.2, 0, 0]; p.swR = [Math.PI / 2 - 0.2, 0, 0]; p.y = Math.abs(Math.sin(t * 6)) * 0.18; p.shL = [-2.7, 0, 0.5]; return p; } // victory: cane raised high
    if (st.sp) { const sp = st.sp, u = sp.t;
      if (sp.id === 'cyclone') { p = HERO_POSES.atk3(0.5); p.tilt = [0, -sp.ang, 0]; p.y = 0.15 + Math.sin(u * 20) * 0.05; p.shR = [-1.45, 0, -1.5]; p.elR = [0, 0, 0]; p.swR = [Math.PI / 2, 0, 0.2]; return p; }
      if (sp.id === 'mallet') { p = HERO_POSES.idle(t);
        if (u < 0.35) { legsStance(p, 0.26, 1.3); p.y -= 0.35; p.torso = [0.6, 0, 0]; p.shR = p.shL = [-0.9, 0, 0]; }
        else if (u < 0.95) { const k = (u - 0.35) / 0.6; p.lgL = [-1.0, 0, 0.15]; p.knL = [1.6, 0, 0]; p.lgR = [-0.6, 0, -0.15]; p.knR = [1.2, 0, 0]; p.shR = [-3.0, 0, -0.2]; p.shL = [-3.0, 0, 0.2]; p.elR = p.elL = [-0.4, 0, 0]; p.torso = [-0.3 * k, 0, 0]; p.swR = [Math.PI / 2 - 0.3, 0, 0]; p.y = Math.sin(k * Math.PI) * 2.0 + 0.3 * k; }
        else { legsStance(p, 0.3, 1.1); p.y -= 0.3; p.torso = [0.75, 0, 0]; p.shR = [-0.55, 0, -0.15]; p.shL = [-0.6, 0, 0.15]; p.elR = p.elL = [0, 0, 0]; p.swR = [Math.PI / 2 - 0.1, 0, 0]; }
        return p; }
      if (sp.id === 'homer') { p = blank(); legsStance(p, 0.3, 0.8);
        if (u < 1.0) { p.torso = [0.2, 1.2, 0]; p.hips = [0, 0.6, 0]; p.shR = [-1.3, 0, 0.9]; p.elR = [-1.6, 0, 0]; p.shL = [-1.3, 0, 0.8]; p.elL = [-1.5, 0, 0]; p.swR = [Math.PI / 2 + 0.5, 0, 0.9]; p.y = -0.15 + Math.sin(u * 30) * 0.02; p.lgR = [0.4, 0, -0.2]; }
        else { const k = ease(clamp((u - 1.0) / 0.14, 0, 1)); p.torso = [0.2, lerp(1.2, -1.3, k), 0]; p.hips = [0, lerp(0.6, -0.7, k), 0]; p.shR = [lerp(-1.3, -1.6, k), 0, lerp(0.9, -1.2, k)]; p.elR = [lerp(-1.6, 0, k), 0, 0]; p.shL = [-1.3, 0, lerp(0.8, -0.4, k)]; p.elL = [lerp(-1.5, -0.2, k), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(0.9, -0.6, k)]; p.lgL = [-0.7, 0, 0.2]; p.knL = [0.6, 0, 0]; }
        return p; } }
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.45);
    if (st.sw) return canePose(st.sw.i, clamp(st.sw.t / SWINGS[st.sw.i].dur, 0, 1));
    p = HERO_POSES.idle(t); legsStance(p, 0.2, 0.45);
    // ready stance: cane held up across the body like a bat
    p.shR = [-1.1, 0, -0.5]; p.elR = [-1.3, 0, 0]; p.shL = [-1.0, 0, 0.5]; p.elL = [-1.4, 0, 0]; p.swR = [Math.PI / 2 + 0.7, 0, 0.5]; p.torso = [0.15, 0.25, 0]; p.y = Math.sin(t * 6) * 0.03;
    if (st.duck) { legsStance(p, 0.26, 1.25); p.y -= 0.32; p.torso = [0.55, 0, 0]; }
    if (st.lane) { p.tilt = [0, 0, st.lane * 0.22]; p.torso = [0.2, 0, st.lane * 0.25]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' || st.sp || st.chits > 2 ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.cake && st.cake.t < 0.25) { p.shR = [-2.8, 0, -0.3]; p.elR = [-0.1, 0, 0]; } return p; }
  const TELLS = ['cloudTell', 'cansTell', 'slamTell', 'jabTell'];
  function poseMech(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur), b = C.base; if (st.ms === 'ko') { C.bang.visible = false; C.warn.visible = false; C.shadow.visible = false; return; }
    let hipY = b.hipY + Math.sin(t * 3) * 0.05, bagY = b.bagY, bagRX = 0, bagRZ = Math.sin(t * 1.7) * 0.03, shk = 0, hatch = 0, rootY = 0.2, sq = 1;
    const armsT = [[-0.2, 0.1], [-0.2, -0.1]]; // [rx, ry] guard: claws up in front
    let glow = { m: null, c: '#ff3d6e', v: 0 }, warnV = 0, warnC = '#ff3030';
    switch (st.ms) {
      case 'cloudTell': shk = -1.25 * ease(clamp(u * 1.6, 0, 1)); sq = 1 + 0.08 * Math.sin(st.mt * 16); glow = { m: R.sM, c: '#ff9a3a', v: 0.3 + 0.4 * (Math.sin(st.mt * 20) * 0.5 + 0.5) }; warnV = 0.5 + 0.35 * Math.sin(st.mt * 18); warnC = '#ff9a2a'; break;
      case 'cloud': shk = -1.25; sq = 0.95; warnV = 0.6; warnC = '#ff9a2a'; break;
      case 'cansTell': hatch = ease(clamp(u * 2, 0, 1)); bagRX = 0.08; glow = { m: R.mM, c: '#ff3d6e', v: 0.25 + 0.25 * (Math.sin(st.mt * 20) * 0.5 + 0.5) }; break;
      case 'cans': hatch = 1; bagRX = 0.08; break;
      case 'slamTell': { const k = clamp(u, 0, 1); if (k < 0.45) { hipY -= 0.5 * ease(k / 0.45); } else { rootY = 0.2 + 3.2 * ease((k - 0.45) / 0.55); hipY = b.hipY; } bagRX = -0.15 * k; glow = { m: R.mM, c: '#ff3d6e', v: 0.25 + 0.3 * (Math.sin(st.mt * 22) * 0.5 + 0.5) }; warnV = 0.4 + 0.5 * k; break; }
      case 'slam': rootY = 3.4 * (1 - ease(clamp(st.mt / 0.18, 0, 1))) + 0.2; sq = st.mt > 0.18 ? 0.82 : 1; warnV = st.mt < 0.2 ? 0.9 : 0; break;
      case 'jabTell': { const i = st.jabSide < 0 ? 0 : 1; armsT[i] = [0.4, (i ? -1 : 1) * 0.7]; glow = { m: R.aM && R.aM[i], c: '#ff3030', v: 0.35 + 0.35 * (Math.sin(st.mt * 26) * 0.5 + 0.5) }; break; }
      case 'jab': { const i = st.jabSide < 0 ? 0 : 1; armsT[i] = [-0.15, (i ? 1 : -1) * 0.25]; break; }
      case 'open': case 'stun': hipY -= 0.3; bagRX = 0.22 + Math.sin(st.t * 10) * 0.04; armsT[0] = [0.9, 0.3]; armsT[1] = [0.9, -0.3]; if (Math.random() < dt * 8) { R.bag.getWorldPosition(V); V.y += rnd(0.5, 1.6); V.x += rnd(-1.2, 1.2); C.spk.burst(V, 2, { spd: 2, size: 0.2 }); } break;
      case 'down': hipY -= 0.9 * ease(clamp(st.mt / 0.5, 0, 1)); bagRX = 0.55; armsT[0] = [1.2, 0.4]; armsT[1] = [1.2, -0.4]; if (Math.random() < dt * 10) { R.bag.getWorldPosition(V); V.y += rnd(0.5, 1.6); C.spk.burst(V, 2, { spd: 2, size: 0.25 }); } break;
    }
    // special reactions: the homer sends it flying and it crashes back down; the mallet bounces it
    let flyZ = 0, flyRX = 0;
    if (st.fly) { const f = st.fly; f.t += dt; const k = f.t;
      if (k < 1.1) { flyZ = k * 13; rootY = 0.2 + Math.sin(Math.min(1, k / 1.1) * Math.PI * 0.5) * 11; flyRX = -k * 9; }
      else if (k < 1.7) { flyZ = 0; rootY = 0.2 + 16 * Math.pow(1 - (k - 1.1) / 0.6, 2); flyRX = -(k - 1.1) * 6; }
      else { if (!f.crash) { f.crash = true; DUELS.impact({ shake: 1.1, sfx: 'boom', flash: '#fff', flashA: 0.4 }); DUELS.pop('CRASH!', V.set(0, 1.4, MZ - 1), 'word'); C.deb.burst(V.set(0, 0.4, MZ - 0.5), 40, { cols: ['#8a6a5a', '#a07a64', '#ffd23c', '#d8262a'], spd: 6, up: 4, size: 0.18, life: 1.4 }); C.cloud.burst(V.set(0, 0.6, MZ), 14, { spd: 4, size: 1, grow: 1.6, life: 0.9, grav: -0.5 }); }
        sq = 0.75; if (k > 2.1) st.fly = null; }
      R.root.position.y = rootY; R.root.position.z = MZ + flyZ; R.root.rotation.x = flyRX; }
    else { R.root.rotation.x = damp(R.root.rotation.x, 0, 10, dt); }
    if (st.bounce) { const k = (st.bounce.t += dt); rootY = 0.2 + Math.max(0, Math.sin(Math.min(1, k / 0.75) * Math.PI)) * 2.4; if (k > 0.75 && !st.bounce.land) { st.bounce.land = true; DUELS.shake(0.6); DUELS.hitSfx('heavy'); } if (k > 0.95) st.bounce = null; R.root.position.y = rootY; }
    if (!st.fly) { R.root.position.y = st.bounce ? rootY : damp(R.root.position.y, rootY, st.ms === 'slam' ? 60 : 14, dt); R.root.position.z = MZ + C.knock; }
    R.hip.position.y = damp(R.hip.position.y, hipY, 12, dt); R.bag.position.y = bagY;
    R.bag.rotation.x = damp(R.bag.rotation.x, bagRX, 10, dt) - C.fl * 0.04; R.bag.rotation.z = bagRZ + Math.sin(st.t * 40) * C.fl * 0.05;
    R.bag.scale.y = damp(R.bag.scale.y, sq - C.fl * 0.06, 18, dt); R.bag.scale.x = damp(R.bag.scale.x, 2 - sq + C.fl * 0.08, 18, dt);
    R.shakers.rotation.x = damp(R.shakers.rotation.x, shk, 12, dt); R.hatch.rotation.x = damp(R.hatch.rotation.x, hatch * 1.4, 12, dt);
    R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, armsT[i][0] + C.fl * 0.5, 14, dt); a.sh.rotation.y = damp(a.sh.rotation.y, armsT[i][1], 14, dt); });
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 5);
    if (glow.m && glow.m.userData.flash) { glow.m.userData.flashC.value.set(glow.c); glow.m.userData.flash.value = Math.max(glow.m.userData.flash.value, glow.v); }
    C.shadow.material.opacity = st.ms === 'slamTell' ? 0.55 * clamp((u - 0.4) / 0.6, 0, 1) : st.ms === 'slam' ? 0.6 : 0; C.shadow.scale.setScalar(0.6 + C.shadow.material.opacity * 1.2); C.shadow.visible = C.shadow.material.opacity > 0.01;
    // ground warning ring on the middle lane + the "!" over the dome while it winds up
    C.warn.material.color.set(warnC); C.warn.material.opacity = damp(C.warn.material.opacity, Math.max(0, warnV), 22, dt); C.warn.visible = C.warn.material.opacity > 0.02; C.warn.rotation.z += dt * 2; C.warn.scale.setScalar(1 + 0.08 * Math.sin(st.t * 14));
    const tell = TELLS.includes(st.ms); C.bang.visible = tell; if (tell) { R.domeG.getWorldPosition(V); C.bang.position.set(V.x + 1.5, V.y + 1.0 + Math.abs(Math.sin(st.t * 8)) * 0.2, V.z); C.bang.scale.setScalar(0.75 + 0.18 * Math.abs(Math.sin(st.t * 12))); }
    // the kid in the cockpit: bouncing, pointing, fists shaking; wincing when hit
    const kid = R.kid; kid.head.rotation.y = Math.sin(t * 1.8) * 0.3 + C.fl * Math.sin(t * 50) * 0.3; kid.arms[0].rotation.set(-1.4 + Math.sin(t * 8) * 0.4, 0, -0.3); kid.arms[1].rotation.set(st.ms === 'open' || st.ms === 'down' || C.fl > 0.3 ? -0.2 : -2.4, 0, 0.3); kid.root.position.y = 0.12 + Math.abs(Math.sin(t * 4)) * 0.05;
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)), t = st.t;
    const H = C.H; const hx = sx(st.lane) * 0.95; H.root.position.set(damp(H.root.position.x, hx, 18, dt), 0.2, damp(H.root.position.z, st.sw ? (st.sw.i === 2 ? 1.5 : 1.1) : st.hz, st.sw || st.sp ? 22 : 10, dt)); H.root.rotation.y = 0;
    applyPose(H, haroldPose(st, t), st.sw || st.sp ? 42 : 18, dt, !!(st.sp && st.sp.id === 'cyclone'));
    if (!(st.sp && st.sp.id === 'cyclone') && Math.abs(H.tilt.rotation.y) > 0.01) H.tilt.rotation.y = wrapA(H.tilt.rotation.y) * Math.max(0, 1 - dt * 12);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); H.mat.userData.flash.value = C.hflash * 0.8; } else if (st.inv > 0 && !st.sp) H.mat.userData.flash.value = Math.sin(st.t * 30) > 0 ? 0.35 : 0; else H.mat.userData.flash.value = 0;
    if (st.sp && st.sp.id === 'homer' && st.sp.t < 1.0) { H.mat.userData.flashC.value.set('#ffd23c'); H.mat.userData.flash.value = 0.25 + 0.2 * Math.sin(st.t * 30); } else H.mat.userData.flashC.value.set('#ffffff');
    // the cane trail: base + tip of the cane each frame while it swings
    H.root.updateMatrixWorld(true); const swinging = (st.sw && st.sw.t > SWINGS[st.sw.i].hit * 0.4) || (st.sp && (st.sp.id === 'cyclone' && st.sp.t > 0.1 && st.sp.t < 1.75 || st.sp.id === 'homer' && st.sp.t > 0.98 && st.sp.t < 1.45 || st.sp.id === 'mallet' && st.sp.t > 0.85 && st.sp.t < 1.1));
    if (swinging) { const L = C.mallet.visible ? 2.3 : 0.68; H.swR.localToWorld(V.set(0, 0.15, 0)); H.swR.localToWorld(V2.set(0, L, 0)); C.trail.col.set(st.sp ? (st.sp.id === 'cyclone' ? '#ffb050' : '#fff2a0') : st.sw && st.sw.i === 2 ? '#ffe070' : '#ffffff'); C.trail.push(V, V2); }
    C.trail.update(dt);
    const M = C.M; M.root.position.set(3.35, 0.2, 6.3); M.root.rotation.y = -2.3; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseMech(st, dt);
    // camera: low behind Harold's right shoulder, the mech filling the top of the frame; portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 70 : 52; C.cam.updateProjectionMatrix();
    V.set(-0.55 + H.root.position.x * 0.35, port ? 2.75 : 2.45, (port ? -4.6 : -3.6) + H.root.position.z * 0.35); V2.set(H.root.position.x * 0.2, port ? 2.9 : 3.3, MZ);
    if (st.ms === 'intro' && st.round === 0) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(4.5, 5.5, 9), V.clone(), k); V2.lerpVectors(V3.set(0, 3.2, MZ), V2.clone(), k); }
    if (st.sp) { const sp = st.sp;
      if (sp.id === 'cyclone') { const a = 0.5 * Math.sin(sp.t * 1.5); V.set(Math.sin(a) * 4.2, 2.2, sp.t * 0.6 - 3.4); V2.set(0, 2.0, 2.4); }
      else if (sp.id === 'mallet' && sp.t > 0.35 && sp.t < 1.2) { V.set(2.6, port ? 5 : 4.2, -3.6); V2.set(0, 2.2, 2.4); }
      else if (sp.id === 'homer') { if (sp.t < 1.0) { V.set(-2.4, 1.6, 1.0); V2.set(0, 1.4, 0.2); } else if (st.fly && st.fly.t < 1.2) { V.set(1.6, 2.2, -2.5); C.R.root.getWorldPosition(V2); V2.y += 2; } } }
    if (st.ms === 'ko') { if (st.outT < 0.9) { V.set(-1.4, 2.2, 0.6); V2.set(0, 3.2, MZ); } else if (st.outT < 2.4) { V.set(-0.5, 3.4, -5); V2.set(-0.8, 2.6, 3); } else { V.set(-1.5, 3.2, -4.6); V2.set(-0.6, 1.6, 2.6); } }
    if (st.ms === 'slam' && st.mt < 0.35) { V.x += rnd(-0.12, 0.12); V.y += rnd(-0.12, 0.12); }
    const cr = st.sp || st.ms === 'ko' ? 5 : 7; C.camP.lerp(V, 1 - Math.exp(-cr * dt)); C.camL.lerp(V2, 1 - Math.exp(-cr * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 26; OUT_U.fogF.value = 70;
  };
  C.onResize = () => {};

  // ---------------- test bots: win (dodges + specials), mash (only mashes SWING, like a first-time player), lose (stands still) ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt;
    if (B.mode === 'mash') { if (B.cd <= 0) { B.a = true; B.cd = 0.12; } return; }
    const left = st.mdur - st.mt;
    if (st.ms === 'cloud' || (st.ms === 'cloudTell' && left < 0.3)) B.bh = true;
    if (st.ms === 'slamTell' && left < 0.4 || st.ms === 'slam') B.mx = -1;
    if (st.ms === 'jabTell' && left < 0.3 || st.ms === 'jab') B.mx = -st.jabSide;
    if (st.ms === 'cans' || st.ms === 'cansTell') { const bad = new Set(C.cans.filter((c) => c.z > 0.3 && c.z < 3.0).map((c) => c.lane)); if (!bad.size) B.lane = 0; else if (bad.has(B.lane || 0)) B.lane = [0, -1, 1].find((l) => !bad.has(l)) ?? 0; if (B.lane) B.mx = B.lane; }
    const safe = B.mx === 0 && !B.bh && !['slamTell', 'jabTell', 'cloudTell', 'cans', 'cansTell'].includes(st.ms) || (st.ms.endsWith('Tell') && left > 0.9);
    if (B.cd <= 0 && safe) { if (st.meter >= 100) B.c = true; else B.a = true; B.cd = 0.14; }
  };
  DUELS.reg('chipkid', C);
  // entrance: the ring in the middle of the Harborplace (Light St) plaza
  const L = LANDMARKS.find((l) => l.id === 'harborplace'); if (L && L.boss) DUELS.addTrigger('chipkid', L, L.boss.x, L.boss.z, L.boss.x + 2.2, L.boss.z - 1.8, '#ffd23c'); // on the promenade in front of the Light St pavilion
})();

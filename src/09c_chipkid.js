
// ======================= THE CHIP KID, HARBORPLACE: a Punch-Out-style mech duel (DESIGN.md "More game-style fights" + "Homage bosses").
// A behind-the-player view: Harold in a makeshift ring on the Harborplace plaza, Mavis cheering from the corner, facing The Chip Kid's giant
// crab-chip-bag mech (an original red / yellow snack look: "LIL' CRUNCH CRAB CHIPS", no real brand). The kid (pigtails, big eyes,
// bonnet-style hat) sits in the cockpit dome on top. Read the tells and dodge:
//   SEASONING CLOUD: the shoulder shakers swing forward and glow orange, the bag puffs up  -> DUCK (a hit blinds you for a moment)
//   CHIP-CAN BARRAGE: the belly hatch drops open and cans roll down the lanes; each lane flashes before its can arrives -> step out of that lane
//   BAG-SLAM: the mech crouches, leaps and its shadow grows under you -> DODGE left or right (ducking gets you squashed)
//   CLAW JAB (filler): one claw pulls back and flashes -> dodge to the other side or duck
// After every attack the mech is OPEN (it sags, sparks fly): PUNCH. A clean dodge of a cloud or a slam earns a STAR: UPPERCUT spends one (big hit).
// Punching a guarding mech is BLOCKED and may draw a quick counter-jab. 3 rounds (100 HP each); Harold heals a little between rounds.
// At the end the mech collapses, the kid pops out, sulks and runs off. The kid is never a target: all hits go to the mech.
// Controls: phone: stick left / right / down (or the white buttons) dodge, SWING = PUNCH, JUMP = DUCK, ACT = UPPERCUT. Desktop: A / D (arrows) dodge,
// S duck, J punch, E uppercut. Gamepad: left stick or LB / RB dodge, A duck, X punch, Y uppercut.
// Rig hook: window.buildChipKid({ THREE, toonMat, outlineMat, addOdir, QUAL }) may return { root, bag?, armL?, armR?, shakers?, hatch?, dome?, kid?, flash? }.
(function () {
  const C = { scene: null, cam: null, title: 'THE CHIP KID', pips: 3,
    hint: '<b>A / D</b> dodge · <b>S</b> duck · <b>J</b> punch · <b>E</b> uppercut (stars)',
    labels: { a: 'PUNCH', b: 'DUCK', c: 'UPPER', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 4.4, LANE = 1.35; // the mech stands at z = MZ facing -z; Harold at z = 0 facing +z. Screen right is world -x here.
  const RND = [ // per round: tell lengths, how many cans, can spacing, how often each attack comes up
    { cloud: 1.05, cans: 3, gap: 0.62, slam: 1.15, jab: 0.62, guard: [1.1, 1.8], open: 1.0, mix: ['cloud', 'cans', 'jab', 'slam', 'jab'] },
    { cloud: 0.9, cans: 4, gap: 0.5, slam: 1.0, jab: 0.52, guard: [0.8, 1.4], open: 0.85, mix: ['cans', 'jab', 'cloud', 'slam', 'jab', 'cans'] },
    { cloud: 0.78, cans: 6, gap: 0.42, slam: 0.9, jab: 0.45, guard: [0.6, 1.1], open: 0.75, mix: ['slam', 'cans', 'jab', 'cloud', 'jab', 'slam', 'cans'] },
  ];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE; // screen lane (-1 left, 0 centre, 1 right) -> world x

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

  // ---------------- build ----------------
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
    // chip cans (instanced), lane flash strips, the slam shadow, seasoning puffs (instanced quads)
    const can = DUELS.kit(); can.add(DUELS.GEO.cyl(0.3, 0.3, 0.9, 12), '#d8262a', 0, 0, 0).add(DUELS.GEO.cyl(0.31, 0.31, 0.25, 12), '#ffd23c', 0, 0, 0).add(DUELS.GEO.cyl(0.29, 0.29, 0.05, 12), '#c8c8d0', 0, 0.46, 0).add(DUELS.GEO.cyl(0.29, 0.29, 0.05, 12), '#c8c8d0', 0, -0.46, 0);
    const cg = can.geo(); cg.rotateZ(Math.PI / 2);
    C.canM = new THREE.InstancedMesh(cg, toonMat(), 8); C.canM.count = 0; C.canM.frustumCulled = false; sc.add(C.canM); C.cans = [];
    C.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.22, MZ / 2); sc.add(m); return m; });
    C.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })); C.shadow.rotation.x = -Math.PI / 2; C.shadow.position.set(0, 0.22, 0.4); sc.add(C.shadow);
    const puffT = DUELS.dot('#ff9a3a'); C.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffT, transparent: true, depthWrite: false, fog: false }), 48); C.puffM.count = 0; C.puffM.frustumCulled = false; sc.add(C.puffM); C.puffs = [];
    C.spark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({ map: DUELS.dot('#fff6a0', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 32); C.spark.count = 0; C.spark.frustumCulled = false; sc.add(C.spark); C.sparks = [];
  };

  // ---------------- state ----------------
  function reset(round, hp = 100) {
    const st = C.st = { t: 0, round, mhp: 100, hp, stars: 0, lane: 0, duck: false, laneT: 0, lockT: 0, punchT: -1, punchSide: 1, punchCd: 0, upT: -1, hurtT: 0, inv: 0, blindT: 0,
      ms: 'intro', mt: 0, mdur: round === 0 ? 2.8 : 1.6, mixI: Math.floor(Math.random() * 3), jabSide: 1, cansLeft: 0, canT: 0, dodged: false, hitThis: false, over: false, won: false, outT: 0,
      stats: C.st && C.st.stats || { punches: 0, landed: 0, blocked: 0, uppers: 0, counters: 0, dodges: 0, hits: { cloud: 0, can: 0, slam: 0, jab: 0 }, attacks: { cloud: 0, cans: 0, slam: 0, jab: 0 }, rounds: 0, knockdowns: 0 } };
    C.cans.length = 0; C.canM.count = 0; C.puffs.length = 0; C.puffM.count = 0; DUELS.blind(0);
    const R = C.R; R.root.visible = true; R.root.position.set(0, 0.2, MZ); R.root.rotation.set(0, Math.PI, 0); R.hip.position.y = C.base.hipY; R.bag.position.y = C.base.bagY; R.bag.rotation.set(0, 0, 0); R.bag.scale.set(1, 1, 1);
    R.domeG.visible = true; if (R.dome) { R.dome.position.set(0, 0.15, 0); R.dome.rotation.set(0, 0, 0); } const kid = R.kid; kid.root.visible = true; if (kid.root.parent !== R.domeG) { R.domeG.add(kid.root); } kid.root.position.set(0, 0.12, 0); kid.root.rotation.set(0, 0, 0); kid.root.scale.setScalar(0.62);
    DUELS.bars(hp / 100, 1); return st;
  }
  function subHud(st) { DUELS.sub('<span class="stars">' + '\u2605'.repeat(st.stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - st.stars) + '</span></span>', 'ROUND ' + (st.round + 1) + '/3'); }
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'harborplace'); return L && L.boss && L.boss.lines; };
  C.start = function () {
    C.st = null; const st = reset(0); DUELS.log.push('chipkid:' + C.rigKind); subHud(st);
    DUELS.banner('THE CHIP KID<small>HARBORPLACE · ROUND 1</small>', 2.4);
    const l = lines(); if (l) DUELS.say('THE CHIP KID', l.intro[Math.floor(Math.random() * l.intro.length)], 3.4);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 3, MZ);
  };
  C.retry = function () { const r = C.st.round; reset(r); C.st.ms = 'guard'; C.st.mdur = 1.4; subHud(C.st); DUELS.banner('ROUND ' + (r + 1) + '<small>AGAIN! FULL HEALTH</small>', 1.6); };
  C.exit = function () { DUELS.blind(0); };

  function bell(n = 1) { if (!AC || AC.state !== 'running') return; try { for (let k = 0; k < n; k++) { const t = AC.currentTime + k * 0.22, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + 0.55); } } catch (e) {} }
  function puff(p, v, life = 1.2, s = 1) { if (C.puffs.length < 48) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function spark(p, n = 6) { for (let k = 0; k < n && C.sparks.length < 32; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 1)), t: 0, life: rnd(0.3, 0.6) }); }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over) return false; st.hp -= dmg; st.inv = 0.5; st.hurtT = 0.4; st.stats.hits[kind]++; DUELS.hurt(); sfx('hurt'); C.hflash = 1; st.lane = 0; st.duck = false; st.lockT = 0.35;
    if (st.hp <= 0) { st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('chipkid:lose:' + kind);
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'T.K.O.!', 'The Chip Kid\'s mech flattened Harold. Retry round ' + (st.round + 1) + ' with full health.'); }, SIM ? 300 : 1400); }
    return true;
  }
  function dodgeOk(st, why) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; if (why && st.stars < 3) { st.stars++; subHud(st); DUELS.tell('NICE DODGE! \u2605', 0.7); } }

  // ---------------- the mech's brain ----------------
  function mechThink(st, dt) {
    const P = RND[st.round]; st.mt += dt; const u = st.mt / st.mdur;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.8); break;
      case 'guard': if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++;
          if (a === 'cloud') { setM(st, 'cloudTell', P.cloud); DUELS.tell('SEASONING CLOUD! DUCK!', P.cloud); }
          else if (a === 'cans') { setM(st, 'cansTell', 0.8); st.cansLeft = P.cans; st.canT = 0; DUELS.tell('CHIP-CAN BARRAGE! WATCH THE LANES!', 1.0); }
          else if (a === 'slam') { setM(st, 'slamTell', P.slam); DUELS.tell('BAG-SLAM! DODGE LEFT OR RIGHT!', P.slam); }
          else { st.jabSide = Math.random() < 0.5 ? -1 : 1; setM(st, 'jabTell', P.jab); } }
        break;
      case 'cloudTell': if (st.mt > st.mdur) { setM(st, 'cloud', 0.7); sfx('swing'); } break;
      case 'cloud': { // two jets of seasoning at face height
        C.R.nozzles.forEach((n) => { n.getWorldPosition(V); for (let k = 0; k < 2; k++) puff(V, V2.set(rnd(-0.6, 0.6) - V.x * 0.6, rnd(-0.5, 0.1), -6.5 + rnd(-1, 1)), 0.9, rnd(0.8, 1.4)); });
        if (u > 0.3 && u < 0.85 && !st.hitThis) { if (!st.duck) { if (hurtHarold(st, 10, 'cloud')) { st.hitThis = true; st.blindT = 2.2; } } }
        if (st.mt > st.mdur) { if (!st.hitThis) dodgeOk(st, true); setM(st, 'open', P.open + 0.2); } break; }
      case 'cansTell': if (st.mt > st.mdur) setM(st, 'cans', 99); break;
      case 'cans': st.canT -= dt;
        if (st.cansLeft > 0 && st.canT <= 0) { st.cansLeft--; st.canT = P.gap; const lane = Math.random() < 0.45 ? st.lane : [-1, 0, 1][Math.floor(Math.random() * 3)]; C.cans.push({ lane, z: MZ - 0.6, t: 0, warned: 0, hit: false, spd: 4.6 + st.round * 0.6 }); sfx('hit'); }
        if (st.cansLeft <= 0 && C.cans.length === 0) { if (!st.hitThis) dodgeOk(st, false); setM(st, 'open', P.open); }
        break;
      case 'slamTell': if (st.mt > st.mdur) { setM(st, 'slam', 0.3); } break;
      case 'slam': if (!st.hitThis && st.mt > 0.18) { st.hitThis = true; sfx('heavy'); spark(V.set(0, 0.3, 0.6), 12); if (st.lane === 0) { hurtHarold(st, 22, 'slam'); st.slamHit = true; } else { st.slamHit = false; dodgeOk(st, true); } }
        if (st.mt > st.mdur) setM(st, 'open', P.open + 0.9); break;
      case 'jabTell': if (st.mt > st.mdur) { setM(st, 'jab', 0.28); sfx('swing'); } break;
      case 'jab': if (!st.hitThis && st.mt > 0.14) { st.hitThis = true; const safe = st.duck || st.lane === -st.jabSide; if (!safe) hurtHarold(st, 9, 'jab'); else dodgeOk(st, false); sfx('hit'); }
        if (st.mt > st.mdur) setM(st, 'open', P.open * 0.7); break;
      case 'open': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'counterTell': if (st.mt > st.mdur) { setM(st, 'jab', 0.28); sfx('swing'); } break;
      case 'down': if (st.mt > st.mdur) { st.round++; st.stats.rounds++; st.mhp = 100; st.hp = Math.min(100, st.hp + 35); setM(st, 'guard', 1.2); subHud(st); bell(1); DUELS.banner('ROUND ' + (st.round + 1) + '<small>' + (st.round === 2 ? 'FINAL ROUND!' : 'FIGHT!') + '</small>', 1.6); } break;
      case 'ko': break;
    }
  }
  function stepCans(st, dt) {
    for (let i = C.cans.length - 1; i >= 0; i--) { const c = C.cans[i]; c.t += dt; c.z -= c.spd * dt;
      if (!c.hit && c.z < 0.5 && c.z > -0.4) { c.hit = true; if (st.lane === c.lane) hurtHarold(st, 8, 'can'); }
      if (c.z < -3) C.cans.splice(i, 1); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(); C.cans.forEach((c, i) => { q.setFromAxisAngle(V.set(1, 0, 0), -c.t * 14); m.compose(V2.set(sx(c.lane), 0.52, c.z), q, V.set(1, 1, 1)); C.canM.setMatrixAt(i, m); });
    C.canM.count = C.cans.length; C.canM.visible = C.cans.length > 0; C.canM.instanceMatrix.needsUpdate = true;
    // lane warnings: a lane glows while a can is on its way down it
    const warn = [0, 0, 0]; for (const c of C.cans) if (c.z > 0.4) warn[c.lane + 1] = Math.max(warn[c.lane + 1], 0.4 + 0.3 * Math.sin(st.t * 30));
    if (st.ms === 'jabTell') warn[st.jabSide + 1] = Math.max(warn[st.jabSide + 1], 0.3 + 0.2 * Math.sin(st.t * 30)), warn[1] = Math.max(warn[1], 0.25);
    C.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 20, dt); l.visible = l.material.opacity > 0.01; });
  }

  // ---------------- Harold ----------------
  C.step = function (dt, I) {
    const st = C.st; if (!st) return; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.punchCd -= dt; st.lockT -= dt;
    if (st.blindT > 0) { st.blindT -= dt; DUELS.blind(clamp(st.blindT / 1.2, 0, 1) * 0.92); } else DUELS.blind(0);
    if (!st.over) {
      // dodge / duck: held stick or buttons; a dodge lasts at most ~1.1 s, then Harold steps back to the middle (no camping in a lane)
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; const duck = I.my < -0.5 || I.bh;
      if (st.lockT > 0 || st.punchT >= 0) want = st.punchT >= 0 ? 0 : st.lane;
      if (want !== 0 && st.lane === want) { st.laneT += dt; if (st.laneT > 1.1) { st.lane = 0; st.lockT = 0.35; st.laneT = 0; } }
      else if (st.lockT <= 0) { st.lane = want; st.laneT = 0; }
      st.duck = st.lockT <= 0 && st.punchT < 0 && st.lane === 0 && duck;
      // punches: in the mech's openings they land; on its guard they are blocked (and may draw a quick counter-jab)
      const can = st.lane === 0 && !st.duck && st.punchCd <= 0 && st.hurtT <= 0;
      const upper = I.c && st.stars > 0 && can, jab = I.a && can;
      if (upper || jab) { st.punchT = 0; st.punchUp = upper; st.punchSide = -st.punchSide; st.punchCd = upper ? 0.55 : 0.24; st.punchHit = false; if (upper) { st.stars--; st.stats.uppers++; subHud(st); } else st.stats.punches++; sfx('swing'); }
      else if (I.c && st.stars === 0 && st.punchCd <= 0) { DUELS.tell('NO STARS YET: DODGE A CLOUD OR A SLAM', 0.8); st.punchCd = 0.4; }
      if (st.punchT >= 0) { st.punchT += dt; if (st.punchT > 0.09 && !st.punchHit) { st.punchHit = true; landPunch(st); } if (st.punchT > (st.punchUp ? 0.45 : 0.22)) st.punchT = -1; }
    }
    mechThink(st, dt); stepCans(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, (st.mhp / 100 + (2 - st.round)) / 3);
    if (st.ms === 'ko') outro(st, dt);
  };
  function landPunch(st) {
    const R = C.R; V.set(sx(0) + st.punchSide * 0.3, st.punchUp ? 3.4 : 2.6, MZ - 1.1);
    if (st.ms === 'open') {
      const dmg = st.punchUp ? 16 : 4; st.mhp -= dmg; st.stats.landed++; sfx(st.punchUp ? 'heavy' : 'hit'); spark(V, st.punchUp ? 14 : 6); for (const m of R.flash) if (m.userData.flashC) { m.userData.flashC.value.set('#ffffff'); m.userData.flash.value = 0.8; }
      if (st.mt < 0.35 && !st.punchUp) st.stats.counters++;
      if (st.mhp <= 0) { st.mhp = 0; st.stats.knockdowns++; C.cans.length = 0;
        if (st.round >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; bell(3); DUELS.banner('K.O.!<small>THE MECH IS DOWN</small>', 2.4); }
        else { setM(st, 'down', 2.6); bell(2); DUELS.banner('DOWN!<small>ROUND ' + (st.round + 1) + ' TO HAROLD</small>', 2.2); if (Math.random() < 0.6) DUELS.say('MAVIS', ['That\u2019s my Harold!', 'Give her mech another one, dear!', 'Mind your back, hon!'][st.round % 3], 2.2); } }
    } else if (['guard', 'intro'].includes(st.ms)) { st.stats.blocked++; sfx('hit'); DUELS.tell('BLOCKED! WAIT FOR THE OPENING', 0.7); if (Math.random() < 0.3 && st.ms === 'guard') { st.jabSide = Math.random() < 0.5 ? -1 : 1; setM(st, 'counterTell', 0.34); } }
  }
  // ---------------- the ending: the mech collapses, the kid pops out of the dome, sulks, and runs off ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R, kid = R.kid;
    if (t < 1.4) { const k = ease(clamp(t / 1.4, 0, 1)); R.bag.rotation.x = -0.9 * k; R.bag.scale.set(1 + 0.1 * k, 1 - 0.35 * k, 1); R.hip.position.y = C.base.hipY - 0.9 * k; if (Math.random() < dt * 20) { R.bag.getWorldPosition(V); V.y += rnd(0, 2); spark(V, 3); } }
    if (t > 1.4 && !st.popped) { st.popped = true; sfx('jump'); // the kid pops out: re-parent to the scene at her world spot
      kid.root.getWorldPosition(V); C.scene.attach(kid.root); kid.root.scale.setScalar(1); st.kid0 = kid.root.position.clone(); if (R.dome) R.dome.visible = false; }
    if (st.popped) { const k = t - 1.4; const land = V2.set(-2.4, 0.2, 2.2);
      if (k < 0.9) { const u = k / 0.9; kid.root.position.lerpVectors(st.kid0, land, u); kid.root.position.y = lerp(st.kid0.y, 0.2, u) + Math.sin(u * Math.PI) * 2.2; kid.root.rotation.y = Math.PI + u * TAU; }
      else if (k < 4.2) { kid.root.position.copy(land); kid.root.rotation.y = Math.PI + 0.8; // sulk: arms crossed, a stomp or two, head down
        kid.arms[0].rotation.set(-1.2, 0, -1.2); kid.arms[1].rotation.set(-1.2, 0, 1.2); kid.head.rotation.x = 0.25 + Math.sin(k * 3) * 0.05; kid.head.rotation.y = Math.sin(k * 1.3) * 0.4;
        const stomp = Math.max(0, Math.sin(k * 9)) * (k < 2.6 ? 1 : 0); kid.legs[0].rotation.x = -stomp * 0.6; kid.root.position.y = 0.2 + stomp * 0.04;
        if (!st.sulkSaid) { st.sulkSaid = true; const l = lines(); if (l) DUELS.say('THE CHIP KID', l.defeat[Math.floor(Math.random() * l.defeat.length)], 3.2); } }
      else if (k < 6.4) { const u = (k - 4.2) / 2.2; kid.root.rotation.y = -Math.PI / 2; // runs off to screen right (-x), out under the ropes
        kid.root.position.set(lerp(-2.4, -10, u), 0.2 + Math.abs(Math.sin(k * 14)) * 0.1, 2.2 + u * 2); kid.arms[0].rotation.set(Math.sin(k * 14) * 0.9, 0, 0); kid.arms[1].rotation.set(-Math.sin(k * 14) * 0.9, 0, 0); kid.legs[0].rotation.x = Math.sin(k * 14) * 0.8; kid.legs[1].rotation.x = -Math.sin(k * 14) * 0.8; kid.head.rotation.set(0, 0, 0); }
      else if (!st.winDone) { st.winDone = true; kid.root.visible = false; DUELS.bossCleared('harborplace', 'chipkid-duel');
        setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'THE CHIP KID<br>RAN HOME', 'Her mech is scrap and Harborplace is clear. Crime at Harborplace: 0.'); }, SIM ? 300 : 1200); } }
  }
  function stepFx(dt) {
    const m = new THREE.Matrix4(), q = C.cam.quaternion;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.2); p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.6 + p.t * 2.2); m.compose(p.p, q, V.set(s, s, s)); C.puffM.setMatrixAt(i, m); }); C.puffM.count = C.puffs.length; C.puffM.visible = C.puffs.length > 0; C.puffM.instanceMatrix.needsUpdate = true;
    for (let i = C.sparks.length - 1; i >= 0; i--) { const p = C.sparks[i]; p.t += dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.sparks.splice(i, 1); }
    C.sparks.forEach((p, i) => { m.compose(p.p, q, V.set(1, 1, 1)); C.spark.setMatrixAt(i, m); }); C.spark.count = C.sparks.length; C.spark.visible = C.sparks.length > 0; C.spark.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    let p;
    if (st.over && !st.won) { p = HERO_POSES.down(1, true); return p; }
    if (st.hurtT > 0) { p = HERO_POSES.hurt(1 - st.hurtT / 0.4); return p; }
    p = HERO_POSES.idle(t); legsStance(p, 0.2, 0.45);
    // boxing guard: both fists up (the cane tucked under the arm)
    p.shL = [-1.5, 0, 0.55]; p.elL = [-1.6, 0, 0]; p.shR = [-1.5, 0, -0.55]; p.elR = [-1.6, 0, 0]; p.swR = [Math.PI / 2 + 1.2, 0, 0]; p.torso = [0.12, 0, 0]; p.y = Math.sin(t * 6) * 0.03;
    if (st.punchT >= 0) { const u = clamp(st.punchT / (st.punchUp ? 0.45 : 0.22), 0, 1), k = Math.sin(u * Math.PI), s = st.punchSide;
      const arm = s > 0 ? 'R' : 'L'; p['sh' + arm] = st.punchUp ? [-1.6 - k * 1.3, 0, s > 0 ? -0.3 : 0.3] : [-1.5 - k * 0.1, 0, (s > 0 ? -0.55 : 0.55) * (1 - k)]; p['el' + arm] = [-1.6 * (1 - k), 0, 0]; p.torso = [0.12, -s * 0.5 * k, 0]; if (st.punchUp) p.y += k * 0.25; }
    if (st.duck) { legsStance(p, 0.26, 1.25); p.y -= 0.32; p.torso = [0.55, 0, 0]; }
    if (st.lane) { p.tilt = [0, 0, st.lane * 0.22]; p.torso = [0.2, 0, st.lane * 0.25]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer; return p; }
  function poseMech(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur), b = C.base; if (st.ms === 'ko') return;
    let hipY = b.hipY + Math.sin(t * 3) * 0.05, bagY = b.bagY, bagRX = 0, bagRZ = Math.sin(t * 1.7) * 0.03, shk = 0, hatch = 0, rootY = 0.2, sq = 1;
    const armsT = [[-0.2, 0.1], [-0.2, -0.1]]; // [rx, ry] guard: claws up in front
    let glow = { m: null, c: '#ff3d6e', v: 0 };
    switch (st.ms) {
      case 'cloudTell': shk = -1.25 * ease(clamp(u * 1.6, 0, 1)); sq = 1 + 0.08 * Math.sin(st.mt * 16); glow = { m: R.sM, c: '#ff9a3a', v: 0.25 + 0.3 * (Math.sin(st.mt * 24) * 0.5 + 0.5) }; break;
      case 'cloud': shk = -1.25; sq = 0.95; break;
      case 'cansTell': hatch = ease(clamp(u * 2, 0, 1)); bagRX = 0.08; break;
      case 'cans': hatch = 1; bagRX = 0.08; break;
      case 'slamTell': { const k = clamp(u, 0, 1); if (k < 0.45) { hipY -= 0.5 * ease(k / 0.45); } else { rootY = 0.2 + 3.2 * ease((k - 0.45) / 0.55); hipY = b.hipY; } bagRX = -0.15 * k; glow = { m: R.mM, c: '#ff3d6e', v: 0.2 * k }; break; }
      case 'slam': rootY = 3.4 * (1 - ease(clamp(st.mt / 0.18, 0, 1))) + 0.2; sq = st.mt > 0.18 ? 0.82 : 1; break;
      case 'jabTell': case 'counterTell': { const i = st.jabSide < 0 ? 0 : 1; armsT[i] = [0.4, (i ? -1 : 1) * 0.7]; glow = { m: R.aM && R.aM[i], c: '#ff3030', v: 0.3 + 0.3 * (Math.sin(st.mt * 30) * 0.5 + 0.5) }; break; }
      case 'jab': { const i = st.jabSide < 0 ? 0 : 1; armsT[i] = [-0.15, (i ? 1 : -1) * 0.25]; break; }
      case 'open': hipY -= 0.25; bagRX = 0.2 + Math.sin(st.mt * 10) * 0.03; armsT[0] = [0.9, 0.3]; armsT[1] = [0.9, -0.3]; if (Math.random() < dt * 8) { R.bag.getWorldPosition(V); V.y += rnd(0.5, 1.6); V.x += rnd(-1.2, 1.2); spark(V, 2); } break;
      case 'down': hipY -= 0.9 * ease(clamp(st.mt / 0.5, 0, 1)); bagRX = 0.55; armsT[0] = [1.2, 0.4]; armsT[1] = [1.2, -0.4]; if (Math.random() < dt * 10) { R.bag.getWorldPosition(V); V.y += rnd(0.5, 1.6); spark(V, 2); } break;
    }
    R.root.position.y = damp(R.root.position.y, rootY, st.ms === 'slam' ? 60 : 14, dt); R.hip.position.y = damp(R.hip.position.y, hipY, 12, dt); R.bag.position.y = bagY;
    R.bag.rotation.x = damp(R.bag.rotation.x, bagRX, 10, dt); R.bag.rotation.z = bagRZ; R.bag.scale.y = damp(R.bag.scale.y, sq, 18, dt); R.bag.scale.x = damp(R.bag.scale.x, 2 - sq, 18, dt);
    R.shakers.rotation.x = damp(R.shakers.rotation.x, shk, 12, dt); R.hatch.rotation.x = damp(R.hatch.rotation.x, hatch * 1.4, 12, dt);
    R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, armsT[i][0], 14, dt); a.sh.rotation.y = damp(a.sh.rotation.y, armsT[i][1], 14, dt); });
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow.m && glow.m.userData.flash) { glow.m.userData.flashC.value.set(glow.c); glow.m.userData.flash.value = Math.max(glow.m.userData.flash.value, glow.v); }
    C.shadow.material.opacity = st.ms === 'slamTell' ? 0.55 * clamp((u - 0.4) / 0.6, 0, 1) : st.ms === 'slam' ? 0.6 : 0; C.shadow.scale.setScalar(0.6 + C.shadow.material.opacity * 1.2); C.shadow.visible = C.shadow.material.opacity > 0.01;
    // the kid in the cockpit: bouncing, pointing, fists shaking on her guard
    const kid = R.kid; kid.head.rotation.y = Math.sin(t * 1.8) * 0.3; kid.arms[0].rotation.set(-1.4 + Math.sin(t * 8) * 0.4, 0, -0.3); kid.arms[1].rotation.set(st.ms === 'open' || st.ms === 'down' ? -0.2 : -2.4, 0, 0.3); kid.root.position.y = 0.12 + Math.abs(Math.sin(t * 4)) * 0.05;
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)), t = st.t;
    const H = C.H; const hx = sx(st.lane) * 0.95; H.root.position.set(damp(H.root.position.x, hx, 18, dt), 0.2, 0); H.root.rotation.y = 0; applyPose(H, haroldPose(st, t), 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); H.mat.userData.flash.value = C.hflash * 0.8; }
    const M = C.M; M.root.position.set(3.35, 0.2, 6.3); M.root.rotation.y = -2.3; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseMech(st, dt);
    DUELS.hot(st.stars > 0 && st.ms === 'open');
    // camera: low behind Harold's right shoulder, the mech filling the top of the frame; portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 70 : 52; C.cam.updateProjectionMatrix();
    V.set(-0.55 + H.root.position.x * 0.35, port ? 2.75 : 2.3, port ? -4.6 : -3.4); V2.set(H.root.position.x * 0.2, port ? 2.9 : 2.85, MZ);
    if (st.ms === 'intro' && st.round === 0) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V.clone().set(4.5, 5.5, 9), V, k); V2.lerpVectors(V2.clone().set(0, 3.2, MZ), V2, k); }
    if (st.ms === 'ko') { V.set(-1.5, 3.2, -4.6); V2.set(-0.6, 1.6, 2.6); }
    if (st.ms === 'slam' && st.mt < 0.35) { V.x += rnd(-0.12, 0.12); V.y += rnd(-0.12, 0.12); }
    C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 26; OUT_U.fogF.value = 70;
  };
  C.onResize = () => {};

  // ---------------- test bot ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt; const left = st.mdur - st.mt;
    if (st.ms === 'cloud' || (st.ms === 'cloudTell' && left < 0.15)) B.bh = true;
    if (st.ms === 'slamTell' && left < 0.3 || st.ms === 'slam') B.mx = -1;
    if ((st.ms === 'jabTell' || st.ms === 'counterTell') && left < 0.2 || st.ms === 'jab') B.mx = -st.jabSide;
    if (st.ms === 'cans' || st.ms === 'cansTell') { const bad = new Set(C.cans.filter((c) => c.z > 0.3 && c.z < 3.0).map((c) => c.lane)); if (!bad.size) B.lane = 0; else if (bad.has(B.lane || 0)) B.lane = [0, -1, 1].find((l) => !bad.has(l)) ?? 0; if (B.lane) B.mx = B.lane; }
    if (st.ms === 'open' && B.cd <= 0) { if (st.stars > 0 && st.mt < st.mdur - 0.5) B.c = true; else B.a = true; B.cd = 0.26; }
  };
  DUELS.reg('chipkid', C);
  // entrance: the ring in the middle of the Harborplace (Light St) plaza
  const L = LANDMARKS.find((l) => l.id === 'harborplace'); if (L && L.boss) DUELS.addTrigger('chipkid', L, L.boss.x, L.boss.z, L.boss.x + 2.2, L.boss.z - 1.8, '#ffd23c'); // on the promenade in front of the Light St pavilion
})();

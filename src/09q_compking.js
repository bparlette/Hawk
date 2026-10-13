
// ======================= THE COMPRESSION KING, SWEATFORGE PIER GEAR OUTLET (boss #16 in BOSS_GANG_UPGRADE_PLAN; DESIGN.md "fight in a clothing store").
// Homage rule: the store is an ORIGINAL athletic-gear outlet, "SWEATFORGE PIER" (GR34 athletic_gear_landmark_names). No real brand name, mark or logo anywhere.
// The King: an athleisure mannequin brute (featureless egg head, charcoal compression gear with teal piping, a crown of stacked sweatbands), ~3 m tall.
// A free-move lock-on brawl inside the store: Harold walks the shop floor (camera behind him, always facing the King), Mavis cheers by the register.
//   MANNEQUIN FREEZE: the store lights cycle GREEN / YELLOW / RED (red-light/green-light). Move or swing on RED and a display mannequin lunges at you.
//                     On GREEN the King is frozen in a pose: free crits.
//   BIG SQUEEZE:      a 1.2 s crouch with arms wide + a red lane to Harold, then a bear-hug lunge. DODGE sideways. Caught = MASH SWING to break free
//                     (break free = the King staggers, open for crits; fail = a crushing squeeze).
//   HANGER BOOMERANG: he winds back a chrome hanger; a dashed arc shows its path on the floor, out past Harold and back. Step off the arc or DODGE through it.
//                     Phase 2 throws two, mirrored.
// After every attack he is OPEN (panting): gold crits. Harold: SWING = a 3-hit cane combo with this fight's own finisher (PRICE CHECK overhead tag-slam,
// teal trail, "MARKDOWN!" pops), JUMP = dodge hop (i-frames), ACT = POWER special "CLEARANCE SALE" (team-up: Mavis shoves a clothing rack, Harold spins
// through it in a fabric tornado; slow-mo + zoom + flash) once the meter is full (hits + clean dodges + breaking free fill it).
// Easy-but-not-trivial per the Chip Kid standard: tells >= 1.0 s with a "!" + floor marks, 1.3 s i-frames, Mavis's crab cake when low, one SECOND WIND.
// KO: slow-mo, his seams split, he deflates like a vacuum-sealed bag and flops into the BARGAIN BIN. Star grade by hits taken (<=3 S, <=8 A, else B).
// Win -> DUELS.bossCleared(<this landmark's id>) -> BOSS_CLEAR.clear(...) (the Tide Point / south-shore landmark whose boss is "The Compression King").
// Lose -> RETRY (from the phase reached, full health) or LEAVE. Exit (DUELS.exit) restores the city, camera, radio duck and the arcade labels.
// Controls: phone: stick moves, SWING / JUMP (dodge) / ACT (power), any button mashes in the squeeze. Desktop: WASD, J swing, K dodge, E power.
// Gamepad: left stick, X swing, A dodge (via the duel core mapping), Y power.
// Test params: ?compking=1 starts it; &compkingauto=win|lose|mash plays it by itself (also ?duel=compking&duelbot=...). ?compkingphase=2 starts at phase 2.
// Entry in the city: the glowing FIGHT ring at the landmark's boss anchor (LANDMARKS[i].boss x/z, the real DESIGN anchor).
//
// RIG HOOK CONTRACT (for a real rig later):
//   window.buildCompressionKing({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> {
//     root: Object3D (feet at y=0, faces +z, ~3 m tall),
//     hip?, torso?, head?: Object3D           (posed by rotation; hip.position.y is bobbed),
//     armL?, armR?: Object3D                   (shoulder pivots; rotation.x < 0 raises forward, rotation.z spreads),
//     legL?, legR?: Object3D                   (hip pivots),
//     hand?: Object3D                          (where the hanger sits during the wind-up; defaults to armR),
//     flash?: Material[]                       (toonMat-style materials with userData.flash / flashC for hit + tell glows),
//     update?(dt, state)                       (optional: called each frame with the King's state name)
//   }  Missing parts are filled with empty groups so the fight still runs.
(function () {
  const C = { scene: null, cam: null, title: 'THE COMPRESSION KING', pips: 2,
    hint: '<b>WASD</b> move · <b>J</b> swing · <b>K</b> dodge · <b>E</b> power · freeze on <b>RED</b>',
    labels: { a: 'SWING', b: 'DODGE', c: 'POWER', l: '', r: '' } };
  const STORE = 'SWEATFORGE PIER', AR = 9.2, BHP = 300; // store name (original homage), arena half-size, boss HP (2 phases of 150)
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), QQ = new THREE.Quaternion(), CO = new THREE.Color();
  const PH = [ // per phase
    { mix: ['freeze', 'squeeze', 'hanger', 'squeeze', 'hanger', 'freeze', 'hanger', 'squeeze'], stalk: [1.4, 2.1], sqTell: 1.2, hgTell: 1.1, green: 1.9, red: 1.6, cycles: 3, mash: 9, hangers: 1, open: 1.5 },
    { mix: ['hanger', 'squeeze', 'freeze', 'hanger', 'squeeze', 'hanger', 'freeze', 'squeeze'], stalk: [1.1, 1.7], sqTell: 1.2, hgTell: 1.0, green: 1.5, red: 1.9, cycles: 3, mash: 11, hangers: 2, open: 1.3 },
  ];
  const WORDS = ['MARKDOWN!', 'PRICE CHECK!', 'FINAL SALE!', '50% OFF!', 'NO REFUNDS!', 'RESTOCKED!'];
  const lmk = () => LANDMARKS.find((l) => l.boss && l.boss.name === 'The Compression King');
  const lines = () => { const L = lmk(); return L && L.boss && L.boss.lines; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- textures (all procedural, original lettering) ----------------
  function signTex() { return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#14161c'; g.fillRect(0, 0, w, h); g.fillStyle = '#1fd1c1'; g.fillRect(0, h - 22, w, 10); g.fillRect(0, 12, w, 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 120px ' + FONT; g.lineJoin = 'round';
    g.strokeStyle = '#0a5e58'; g.lineWidth = 16; g.strokeText(STORE, w / 2, h * 0.44); g.fillStyle = '#f4f6f8'; g.fillText(STORE, w / 2, h * 0.44);
    g.font = '900 34px ' + FONT; g.fillStyle = '#1fd1c1'; g.fillText('GEAR OUTLET \u00b7 LOCUST POINT \u00b7 EST. 1996', w / 2, h * 0.8);
    // an original mark: a forged anvil-drop shape (not any real logo)
    for (const s of [-1, 1]) { g.save(); g.translate(w / 2 + s * 455, h * 0.44); g.fillStyle = '#1fd1c1'; g.beginPath(); g.moveTo(-26, -30); g.lineTo(26, -30); g.lineTo(14, 0); g.lineTo(0, 34); g.lineTo(-14, 0); g.closePath(); g.fill(); g.restore(); }
  }, 1024); }
  function floorTex() { return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h); SEED = 33;
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(80,70,60,' + (0.04 + srnd() * 0.06) + ')'; g.fillRect(srnd() * w, srnd() * h, 2 + srnd() * 6, 2 + srnd() * 6); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 90, 0, TAU); g.stroke(); g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(14, h / 2); g.lineTo(w - 14, h / 2); g.stroke();
    g.fillStyle = 'rgba(31,209,193,.28)'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, TAU); g.fill();
  }, 512); }
  function binTex() { return canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#ffd23c'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8262a'; g.fillRect(0, 0, w, 22); g.fillRect(0, h - 22, w, 22);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 38px ' + FONT; g.fillStyle = '#14101f'; g.fillText('BARGAIN BIN', w / 2, h * 0.45); g.font = '900 20px ' + FONT; g.fillStyle = '#d8262a'; g.fillText('90% OFF \u00b7 AS IS', w / 2, h * 0.72); }, 256); }
  function bangTex() { return canvasTex(64, 128, (g, w, h) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 110px ' + FONT; g.lineWidth = 12; g.strokeStyle = '#14101f'; g.strokeText('!', w / 2, h / 2); g.fillStyle = '#ffd23c'; g.fillText('!', w / 2, h / 2); }, 128); }
  function ringTex() { return canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128); }

  // ---------------- the store: one merged toon mesh for walls / racks / shelves / register / bin, plus the sign, the lights, the traffic light ----------------
  function buildStore(sc) {
    const K = DUELS.kit, G = DUELS.GEO, S = K();
    const ft = floorTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(2, 2);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * AR + 6, 2 * AR + 6), new THREE.MeshLambertMaterial({ map: ft })); fl.rotation.x = -Math.PI / 2; sc.add(fl);
    const W = AR + 3, Hh = 6.5;
    // walls: slatwall bands (vertex colours), a dark ceiling with light troffers
    S.add(G.box(2 * W, Hh, 0.4), '#d9dde2', 0, Hh / 2, W).add(G.box(2 * W, Hh, 0.4), '#d9dde2', 0, Hh / 2, -W).add(G.box(0.4, Hh, 2 * W), '#cfd4da', W, Hh / 2, 0).add(G.box(0.4, Hh, 2 * W), '#cfd4da', -W, Hh / 2, 0);
    for (let k = 0; k < 9; k++) { const y = 0.6 + k * 0.42; S.add(G.box(2 * W - 0.6, 0.06, 0.08), '#9aa2ac', 0, y, W - 0.24).add(G.box(0.08, 0.06, 2 * W - 0.6), '#9aa2ac', W - 0.24, y, 0).add(G.box(0.08, 0.06, 2 * W - 0.6), '#9aa2ac', -W + 0.24, y, 0); }
    S.add(G.box(2 * W, 0.3, 2 * W), '#2a2e36', 0, Hh, 0).add(G.box(2 * W, 0.5, 0.5), '#14161c', 0, 0.25, W - 0.3).add(G.box(0.5, 0.5, 2 * W), '#14161c', W - 0.3, 0.25, 0).add(G.box(0.5, 0.5, 2 * W), '#14161c', -W + 0.3, 0.25, 0);
    // shirts on the slatwall: rows of folded tees / hoodies in original colourways
    const COLS = ['#1fd1c1', '#2a2e36', '#f4f6f8', '#e8501e', '#3a5aa8', '#9a9aa4', '#ffd23c'];
    SEED = 71;
    for (const [axis, sgn] of [['z', 1], ['x', 1], ['x', -1]]) for (let k = 0; k < 11; k++) for (const y of [1.6, 2.6, 3.6]) {
      const u = -W + 2 + k * ((2 * W - 4) / 10), c = COLS[Math.floor(srnd() * COLS.length)];
      if (axis === 'z') S.add(G.box(0.9, 0.7, 0.22), c, u, y, sgn * (W - 0.4)); else S.add(G.box(0.22, 0.7, 0.9), c, sgn * (W - 0.4), y, u);
    }
    // clothing racks (chrome round racks with hanging tops) round the floor edge
    const RACKS = [[-7.4, 3.5], [7.4, 2.5], [-7.2, -5.5], [7.6, -6], [-3.5, 8.6], [3.8, 8.2]];
    for (const [x, z] of RACKS) { S.add(G.cyl(0.05, 0.05, 1.5, 6), '#d8dce4', x, 0.75, z).add(G.cyl(0.5, 0.6, 0.06, 10), '#5a5a64', x, 0.03, z).add(G.tor(0.85, 0.035, TAU, 5, 18), '#d8dce4', x, 1.5, z, Math.PI / 2, 0, 0);
      for (let a = 0; a < 10; a++) { const t = (a / 10) * TAU; S.add(G.box(0.42, 0.8, 0.08), COLS[(a + Math.floor(x)) % COLS.length], x + Math.cos(t) * 0.85, 1.08, z + Math.sin(t) * 0.85, 0, -t + Math.PI / 2, 0); } }
    // shoe wall behind the King (boxes) + benches + the register where Mavis stands
    for (let k = 0; k < 14; k++) for (let r = 0; r < 4; r++) S.add(G.box(0.7, 0.32, 0.4), ['#e8501e', '#2a2e36', '#1fd1c1', '#f4f6f8'][(k + r) % 4], -6 + k * 0.92, 0.25 + r * 0.36, W - 0.7);
    S.add(G.box(2.6, 1.1, 0.9), '#2a2e36', 6.2, 0.55, -8.2).add(G.box(2.7, 0.08, 1.0), '#1fd1c1', 6.2, 1.12, -8.2).add(G.box(0.5, 0.4, 0.4), '#14161c', 5.6, 1.35, -8.2);
    for (const [x, z] of [[-4.5, -8.6], [0, -9.0]]) S.add(G.box(2.4, 0.45, 0.6), '#5a3a2a', x, 0.45, z).add(G.box(0.12, 0.45, 0.5), '#2a2e36', x - 1.0, 0.22, z).add(G.box(0.12, 0.45, 0.5), '#2a2e36', x + 1.0, 0.22, z);
    // the bargain bin (the KO lands him here)
    S.add(G.box(2.4, 1.0, 1.6), '#5a5a64', C.BIN.x, 0.5, C.BIN.z).add(G.box(2.5, 0.1, 1.7), '#d8262a', C.BIN.x, 1.02, C.BIN.z);
    for (let k = 0; k < 6; k++) S.add(G.sph(0.28, 7, 5), COLS[k % COLS.length], C.BIN.x - 0.8 + k * 0.32, 1.05, C.BIN.z + (k % 2 ? 0.3 : -0.3), 0, 0, 0, 1, 0.5, 1);
    sc.add(S.mesh(toonMat(), null, 0.003));
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: binTex(), fog: false })); bl.position.set(C.BIN.x, 0.55, C.BIN.z - 0.81); bl.rotation.y = Math.PI; sc.add(bl);
    // the big original sign over the shoe wall
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({ map: signTex(), fog: false })); sg.position.set(0, 4.9, W - 0.25); sg.rotation.y = Math.PI; sc.add(sg);
    // ceiling light troffers: one mesh, colour driven by the freeze lights
    const LG = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const g = new THREE.PlaneGeometry(2.4, 0.9); g.rotateX(Math.PI / 2); g.translate(i * 4.2, Hh - 0.2, j * 4.2); LG.push(g); }
    C.lightM = new THREE.MeshBasicMaterial({ color: '#fff8ea', fog: false }); sc.add(new THREE.Mesh(mergeG(LG), C.lightM));
    // the traffic light on the back wall (red / yellow / green discs): 3 tiny basic meshes
    C.tl = ['#ff2a3a', '#ffd23c', '#3dff6a'].map((c, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshBasicMaterial({ color: c, fog: false })); m.position.set(-7.2 + 0, 4.6 - i * 1.0, W - 0.3); m.rotation.y = Math.PI; m.material.color.multiplyScalar(0.18); m.userData.c = new THREE.Color(c); sc.add(m); return m; });
    { const T = K(); T.add(G.box(1.3, 3.3, 0.3), '#14161c', -7.2, 3.6, W - 0.15); sc.add(T.mesh(toonMat(), null, 0)); }
  }
  function mergeG(gs) { let n = 0; for (const g of gs) n += g.index ? g.index.count : g.attributes.position.count; const P = new Float32Array(n * 3); let o = 0;
    for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; P.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.computeBoundingSphere(); return out; }

  // ---------------- the King stand-in: a mannequin brute in compression gear (original look) ----------------
  const SKIN = '#e9e4dc', GEAR = '#2a2e36', TEAL = '#1fd1c1', BLK = '#14161c';
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group() };
    const mB = toonMat(), mA = toonMat(), mL = toonMat(); R.flash = [mB, mA, mL];
    R.hip = new THREE.Group(); R.hip.position.y = 1.35; R.root.add(R.hip);
    R.legL = new THREE.Group(); R.legR = new THREE.Group(); R.legL.position.set(0.4, 0, 0); R.legR.position.set(-0.4, 0, 0); R.hip.add(R.legL, R.legR);
    for (const [lg, s] of [[R.legL, 1], [R.legR, -1]]) { const L = K();
      L.add(G.cyl(0.3, 0.26, 0.62, 10), BLK, 0, -0.28, 0).add(G.box(0.05, 0.5, 0.05), TEAL, s * 0.29, -0.3, 0).add(G.sph(0.2, 8, 6), SKIN, 0, -0.66, 0.02)
        .add(G.cyl(0.21, 0.16, 0.42, 9), SKIN, 0, -0.86, 0).add(G.cyl(0.18, 0.17, 0.2, 9), TEAL, 0, -1.08, 0).add(G.box(0.38, 0.2, 0.62), '#f4f6f8', 0, -1.25, 0.1)
        .add(G.box(0.4, 0.06, 0.64), TEAL, 0, -1.33, 0.1);
      L.mesh(mL, lg); }
    R.torso = new THREE.Group(); R.hip.add(R.torso);
    const T = K();
    T.add(G.box(0.95, 0.4, 0.55), BLK, 0, 0.0, 0).add(G.box(0.98, 0.1, 0.58), TEAL, 0, 0.2, 0)          // shorts + waistband
      .add(G.sph(1, 14, 10), GEAR, 0, 0.78, 0, 0, 0, 0, 0.82, 0.7, 0.5)                                   // the big chest
      .add(G.box(0.08, 0.95, 0.06), TEAL, 0.62, 0.72, 0.18, 0, 0, -0.25).add(G.box(0.08, 0.95, 0.06), TEAL, -0.62, 0.72, 0.18, 0, 0, 0.25) // piping
      .add(G.box(0.5, 0.06, 0.05), TEAL, 0, 1.06, 0.44).add(G.sph(0.24, 8, 6), GEAR, 0.22, 0.55, 0.36, 0, 0, 0, 1, 0.5, 0.35).add(G.sph(0.24, 8, 6), GEAR, -0.22, 0.55, 0.36, 0, 0, 0, 1, 0.5, 0.35) // collar + abs
      .add(G.sph(0.36, 10, 8), GEAR, 0.86, 1.05, 0).add(G.sph(0.36, 10, 8), GEAR, -0.86, 1.05, 0)           // traps / delts
      .add(G.cyl(0.16, 0.2, 0.25, 9), SKIN, 0, 1.38, 0);                                                     // neck
    R.torsoM = T.mesh(mB, R.torso);
    R.head = new THREE.Group(); R.head.position.y = 1.5; R.torso.add(R.head);
    const Hd = K(); Hd.add(G.sph(0.34, 14, 10), SKIN, 0, 0.32, 0, 0, 0, 0, 1, 1.25, 1.05).add(G.tor(0.345, 0.012, TAU, 4, 22), '#b8b0a4', 0, 0.32, 0, 0, Math.PI / 2, 0, 1, 1.25, 1) // egg head + seam
      .add(G.box(0.36, 0.05, 0.03), BLK, 0, 0.38, 0.33)                                                       // a visor-slit "face" (no features)
      .add(G.tor(0.3, 0.07, TAU, 6, 18), TEAL, 0, 0.66, 0, Math.PI / 2, 0, 0).add(G.tor(0.29, 0.06, TAU, 6, 18), '#f4f6f8', 0, 0.76, 0, Math.PI / 2, 0, 0).add(G.tor(0.28, 0.06, TAU, 6, 18), '#ffd23c', 0, 0.85, 0, Math.PI / 2, 0, 0);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; Hd.add(G.cone(0.07, 0.24, 5), '#ffd23c', Math.sin(a) * 0.26, 1.0, Math.cos(a) * 0.26); } // crown points
    Hd.mesh(mB, R.head, 0.0036);
    R.eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: '#1fd1c1', fog: false })); R.eye.position.set(0, 0.38, 0.345); R.head.add(R.eye);
    R.armL = new THREE.Group(); R.armR = new THREE.Group(); R.armL.position.set(0.98, 1.0, 0); R.armR.position.set(-0.98, 1.0, 0); R.torso.add(R.armL, R.armR);
    for (const [ar, s] of [[R.armL, 1], [R.armR, -1]]) { const A = K();
      A.add(G.cyl(0.24, 0.2, 0.7, 9), GEAR, s * 0.08, -0.36, 0).add(G.box(0.05, 0.6, 0.05), TEAL, s * 0.3, -0.36, 0).add(G.sph(0.19, 8, 6), SKIN, s * 0.1, -0.74, 0)
        .add(G.cyl(0.18, 0.15, 0.55, 9), SKIN, s * 0.1, -1.02, 0).add(G.cyl(0.17, 0.17, 0.14, 9), TEAL, s * 0.1, -1.24, 0).add(G.sph(0.22, 9, 7), SKIN, s * 0.1, -1.42, 0.02);
      A.mesh(mA, ar); }
    R.hand = new THREE.Object3D(); R.hand.position.set(-0.1, -1.45, 0.1); R.armR.add(R.hand);
    return R;
  }
  // display mannequins (the freeze strikers): plain white mannequins in store tees, one mesh each
  function mannequin(col) {
    const K = DUELS.kit, G = DUELS.GEO, m = toonMat(), M = K();
    M.add(G.cyl(0.03, 0.03, 0.2, 5), '#5a5a64', 0, 0.1, 0).add(G.cyl(0.3, 0.3, 0.04, 10), '#5a5a64', 0, 0.02, 0)
      .add(G.cyl(0.1, 0.08, 0.8, 7), SKIN, 0.12, 0.6, 0).add(G.cyl(0.1, 0.08, 0.8, 7), SKIN, -0.12, 0.6, 0).add(G.box(0.42, 0.25, 0.26), BLK, 0, 1.05, 0)
      .add(G.sph(1, 10, 8), col, 0, 1.42, 0, 0, 0, 0, 0.3, 0.36, 0.2).add(G.cyl(0.07, 0.06, 0.62, 6), SKIN, 0.36, 1.32, 0, 0, 0, 0.35).add(G.cyl(0.07, 0.06, 0.62, 6), SKIN, -0.36, 1.32, 0, 0, 0, -0.35)
      .add(G.cyl(0.06, 0.07, 0.12, 6), SKIN, 0, 1.82, 0).add(G.sph(0.17, 10, 8), SKIN, 0, 2.0, 0, 0, 0, 0, 1, 1.25, 1);
    const root = new THREE.Group(); const mesh = M.mesh(m, root, 0.0036);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: '#ff2a3a', fog: false })); eye.position.set(0, 2.03, 0.17); eye.visible = false; root.add(eye);
    return { root, mat: m, eye, mesh };
  }
  function hangerGeo() { const K = DUELS.kit(), G = DUELS.GEO; // a chrome hanger: bottom bar, two shoulders, the hook
    K.add(G.cyl(0.025, 0.025, 0.9, 5), '#e8ecf2', 0, 0, 0, 0, 0, Math.PI / 2).add(G.cyl(0.025, 0.025, 0.56, 5), '#e8ecf2', 0.22, 0.17, 0, 0, 0, 1.02).add(G.cyl(0.025, 0.025, 0.56, 5), '#e8ecf2', -0.22, 0.17, 0, 0, 0, -1.02)
      .add(G.tor(0.08, 0.02, Math.PI * 1.4, 4, 10), '#e8ecf2', 0, 0.42, 0).add(G.box(0.16, 0.04, 0.04), TEAL, 0, 0.34, 0);
    const g = K.geo(); g.rotateX(Math.PI / 2); return g; } // lies flat, spins about y

  // ---------------- build ----------------
  C.BIN = { x: 5.2, z: 7.4 };
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#3a3f4a', 22, 60); sc.background = new THREE.Color('#2a2e36');
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 120);
    C.lights = DUELS.sceneLights(sc, '#f2f6ff', '#5a5650', 1.5, '#ffffff', 1.4, new THREE.Vector3(0.4, 1, -0.5));
    buildStore(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildCompressionKing === 'function') rig = window.buildCompressionKing({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['hip', 'torso', 'head', 'armL', 'armR', 'legL', 'legR']) if (!rig[k]) { rig[k] = new THREE.Group(); (k === 'hip' ? rig.root : k === 'torso' ? rig.hip : k === 'head' || k.startsWith('arm') ? rig.torso : rig.hip).add(rig[k]); }
    rig.flash = rig.flash || []; rig.hand = rig.hand || rig.armR; C.R = rig; sc.add(rig.root);
    C.base = { hipY: rig.hip.position.y };
    // display mannequins round the floor
    C.mq = [[-5.6, 5.6], [5.8, 5.2], [-7.6, -0.8], [7.8, -1.6], [-4.8, -6.6], [3.6, -7.0]].map(([x, z], i) => { const m = mannequin(['#1fd1c1', '#e8501e', '#3a5aa8', '#ffd23c', '#f4f6f8', '#9a9aa4'][i]); m.home = new THREE.Vector3(x, 0, z); m.root.position.copy(m.home); m.root.rotation.y = Math.atan2(-x, -z); m.s = 'idle'; m.t = 0; sc.add(m.root); return m; });
    // hangers
    const hg = hangerGeo(), hm = toonMat(); C.hangers = [0, 1].map(() => { const m = new THREE.Mesh(hg, hm); m.visible = false; sc.add(m); return { m, on: false }; });
    // dashed arc (instanced dashes), the squeeze lane, the tell ring, the "!", blob shadows, particles, the clearance rack
    C.dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0.85, depthWrite: false, fog: false }), 56); C.dash.count = 0; C.dash.frustumCulled = false; sc.add(C.dash);
    C.lane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.lane.position.y = 0.03; C.lane.visible = false; sc.add(C.lane);
    C.ring = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex(), color: '#ff3d6e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.ring.position.y = 0.04; C.ring.visible = false; sc.add(C.ring);
    C.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex(), depthTest: false, fog: false })); C.bang.scale.set(0.55, 1.1, 1); C.bang.visible = false; C.bang.renderOrder = 5; sc.add(C.bang);
    const sh = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), shm = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false });
    C.shB = new THREE.Mesh(sh, shm); C.shB.scale.setScalar(1.1); C.shB.position.y = 0.02; sc.add(C.shB);
    C.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }), 72); C.fx.count = 0; C.fx.frustumCulled = false;
    C.fx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(72 * 3), 3); sc.add(C.fx); C.parts = [];
    { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.cyl(0.04, 0.04, 1.5, 5), '#d8dce4', -0.9, 0.75, 0).add(G.cyl(0.04, 0.04, 1.5, 5), '#d8dce4', 0.9, 0.75, 0).add(G.cyl(0.035, 0.035, 1.9, 5), '#d8dce4', 0, 1.5, 0, 0, 0, Math.PI / 2);
      for (let k = 0; k < 7; k++) K.add(G.box(0.08, 0.8, 0.5), ['#1fd1c1', '#e8501e', '#ffd23c', '#3a5aa8'][k % 4], -0.75 + k * 0.25, 1.06, 0);
      C.rack = K.mesh(toonMat(), null, 0.003); C.rack.visible = false; sc.add(C.rack); }
    // HUD extras inside the duel HUD: the freeze light pill, the mash meter, the power bar, floating pops
    const css = document.createElement('style'); css.textContent = `
    #duel .ckl { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%); font-size: 15px; padding: 7px 14px 8px; border-radius: 18px; border: 3px solid #14101f; box-shadow: 3px 3px 0 #14101f; display: none; white-space: nowrap; letter-spacing: 1px; }
    #duel .ckl.on { display: block; } #duel .ckl.g { background: #3dff6a; color: #14101f; } #duel .ckl.y { background: #ffd23c; color: #14101f; } #duel .ckl.r { background: #ff2a3a; color: #fff; animation: cklr .3s infinite alternate; }
    @keyframes cklr { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.07); } }
    #duel .ckm { position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%); text-align: center; display: none; font-size: 22px; color: #ffd23c; text-shadow: 3px 3px 0 #14101f; }
    #duel .ckm.on { display: block; animation: ckm .12s infinite alternate; } @keyframes ckm { from { margin-top: -2px; } to { margin-top: 2px; } }
    #duel .ckm .t { width: 200px; height: 14px; margin: 8px auto 0; background: #14101f; border: 2px solid #14101f; border-radius: 7px; overflow: hidden; } #duel .ckm .t i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #1fd1c1, #3dff6a); }
    #duel .ckp { display: inline-block; vertical-align: middle; width: 96px; height: 9px; background: #14101f; border: 2px solid #14101f; border-radius: 5px; overflow: hidden; margin-left: 4px; } #duel .ckp i { display: block; height: 100%; background: linear-gradient(90deg, #1fd1c1, #b8fff6); }
    #duel .ckp.rdy i { background: linear-gradient(90deg, #ffd23c, #fff6a0); animation: dlow .25s infinite alternate; }
    #duel .ckpop { position: absolute; left: 0; top: 0; font-size: 16px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; pointer-events: none; opacity: 0; transform: translate(-50%, -50%); }
    #duel .ckpop.crit { color: #ffd23c; font-size: 20px; } #duel .ckpop.word { color: #1fd1c1; font-size: 18px; }
    @media (max-width: 480px) { #duel .ckl { font-size: 13px; } #duel .ckm { font-size: 18px; } #duel .ckp { width: 70px; } }`;
    document.head.appendChild(css);
    const hud = DUELS.hudEl; const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; hud.appendChild(e); return e; };
    C.hl = mk('ckl'); C.hm = mk('ckm', 'MASH SWING!<div class="t"><i></i></div>'); C.hmI = C.hm.querySelector('i');
    C.pops = []; for (let i = 0; i < 10; i++) C.pops.push({ e: mk('ckpop'), t: 9, p: new THREE.Vector3() });
  };

  // ---------------- state ----------------
  function reset(phase) {
    const old = C.st, st = C.st = { t: 0, phase, hp: 100, bhp: phase === 2 ? BHP / 2 : BHP, hx: 0, hz: -5, bx: 0, bz: 4.5, byaw: Math.PI, hy: 0,
      atk: -1, atkN: 0, atkHit: false, queued: false, comboT: 0, combo: 0, dodgeT: -1, dodgeCd: 0, dx: 0, dz: 0, inv: 0, hurtT: 0, power: old ? old.power : 0, sp: -1,
      bs: 'intro', bt: 0, bdur: phase === 1 && !old ? 2.6 : 1.4, mixI: 0, light: 'off', lt: 0, cyc: 0, spotCd: 0, lockX: 0, lockZ: 1, lunge: 0, grabN: 0, grabT: 0,
      sw: old ? old.sw : false, cake: old ? old.cake : false, cakeT: -1, over: false, won: false, ko: 0, hs: 0, shake: 0, slow: 0, slowK: 1, zoom: 0, said: {},
      stats: old && old.stats || { swings: 0, landed: 0, crits: 0, taken: 0, dodges: 0, specials: 0, breaks: 0, spotted: 0, attacks: { freeze: 0, squeeze: 0, hanger: 0 }, hitsBy: { mannequin: 0, squeeze: 0, hanger: 0 } } };
    for (const m of C.mq) { m.s = 'idle'; m.t = 0; m.root.position.copy(m.home); m.eye.visible = false; m.root.rotation.y = Math.atan2(-m.home.x, -m.home.z); }
    for (const h of C.hangers) { h.on = false; h.m.visible = false; } C.dash.count = 0; C.parts.length = 0; C.lane.visible = C.ring.visible = C.bang.visible = false; C.rack.visible = false;
    const R = C.R; R.root.visible = true; R.root.scale.set(1, 1, 1); R.root.rotation.set(0, Math.PI, 0); R.root.position.set(st.bx, 0, st.bz); R.hip.position.y = C.base.hipY;
    C.hm.classList.remove('on'); setLight(st, 'off'); DUELS.bars(1, st.bhp / BHP); return st;
  }
  function subHud(st) { const p = Math.floor(st.power / 5) * 5; DUELS.sub('POWER<span class="ckp' + (st.power >= 100 ? ' rdy' : '') + '"><i style="width:' + p + '%"></i></span>', (st.combo > 1 ? '<span style="color:#1fd1c1">' + st.combo + ' HIT</span> \u00b7 ' : '') + 'PHASE ' + st.phase + '/2'); }
  C.start = function () {
    C.st = null; const ph = Q.get('compkingphase') === '2' ? 2 : 1; const st = reset(ph); DUELS.log.push('compking:' + C.rigKind); subHud(st);
    DUELS.banner('THE COMPRESSION KING<small>' + STORE + ' \u00b7 GEAR OUTLET</small>', 2.4);
    const l = lines(); DUELS.say('THE COMPRESSION KING', l && l.intro ? pick(l.intro) : 'Feel the squeeze, old man!', 3.4);
    C.camP = new THREE.Vector3(0, 6, -12); C.camL = new THREE.Vector3(0, 2, 2);
  };
  C.retry = function () { const ph = C.st.phase; reset(ph); C.st.bs = 'stalk'; C.st.bdur = 1.6; subHud(C.st); DUELS.banner('PHASE ' + ph + '<small>AGAIN! FULL HEALTH</small>', 1.6); };
  C.exit = function () { C.hl.classList.remove('on'); C.hm.classList.remove('on'); for (const p of C.pops) { p.t = 9; p.e.style.opacity = 0; } };

  // ---------------- juice (local: this branch predates the shared JUICE core) ----------------
  function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  const sting = () => { tone(880, 880, 0.12, 'square', 0.08); tone(1175, 1175, 0.16, 'square', 0.08, 0.12); };
  const beep = (red) => tone(red ? 330 : 660, red ? 300 : 680, 0.22, 'triangle', 0.12);
  function pop(p, text, cls = '') { const P = C.pops.find((q) => q.t > 0.9) || C.pops[0]; P.t = 0; P.p.copy(p); P.e.className = 'ckpop' + (cls ? ' ' + cls : ''); P.e.textContent = text; }
  function burst(p, n, cols, spd = 3.5, life = 0.6, up = 2.5) { for (let k = 0; k < n && C.parts.length < 72; k++) C.parts.push({ p: p.clone(), v: new THREE.Vector3(rnd(-spd, spd), rnd(0.5, up + 1.5), rnd(-spd, spd)), t: 0, life: rnd(life * 0.6, life), c: CO.set(pick(cols)).clone(), r: rnd(0, TAU), s: rnd(0.7, 1.4) }); }
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = Math.max(m.userData.flash.value, v); } }
  function hitstop(st, s) { st.hs = Math.max(st.hs, s); } function shake(st, s) { st.shake = Math.max(st.shake, s); } function slowmo(st, k, s) { st.slowK = k; st.slow = s; }

  // ---------------- lights (Mannequin Freeze) ----------------
  function setLight(st, l) { st.light = l; st.lt = 0; const on = l !== 'off';
    C.hl.classList.toggle('on', on); C.hl.className = 'ckl' + (on ? ' on ' + l[0] : ''); C.hl.textContent = l === 'green' ? 'GREEN: MOVE! HIT HIM!' : l === 'yellow' ? 'YELLOW: GET READY\u2026' : l === 'red' ? 'RED: FREEZE! DON\u2019T MOVE!' : '';
    C.tl.forEach((m, i) => { m.material.color.copy(m.userData.c).multiplyScalar((l === 'red' && i === 0) || (l === 'yellow' && i === 1) || (l === 'green' && i === 2) ? 1.25 : 0.18); });
    C.lightM.color.set(l === 'red' ? '#ff5a5a' : l === 'yellow' ? '#ffe27a' : l === 'green' ? '#a8ffb8' : '#fff8ea');
    if (on) beep(l === 'red'); }

  // ---------------- the King's brain ----------------
  function setB(st, s, dur) { st.bs = s; st.bt = 0; st.bdur = dur; st.hitThis = false; }
  const dist = (st) => Math.hypot(st.hx - st.bx, st.hz - st.bz);
  function bossThink(st, dt) {
    const P = PH[st.phase - 1]; st.bt += dt; const left = st.bdur - st.bt;
    const face = (k = 6) => { const y = Math.atan2(st.hx - st.bx, st.hz - st.bz); let d = y - st.byaw; d = Math.atan2(Math.sin(d), Math.cos(d)); st.byaw += d * Math.min(1, k * dt); };
    switch (st.bs) {
      case 'intro': face(); if (st.bt > st.bdur) setB(st, 'stalk', 1.2); break;
      case 'roar': face(); if (st.bt > st.bdur) setB(st, 'stalk', 0.8); break;
      case 'stalk': { face(); const d = dist(st); if (d > 2.4) { const s = (st.phase === 2 ? 1.9 : 1.5) * dt / d; st.bx += (st.hx - st.bx) * s; st.bz += (st.hz - st.bz) * s; }
        if (st.bt > st.bdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++;
          if (a === 'freeze') { setB(st, 'freezeTell', 1.3); DUELS.tell('MANNEQUIN FREEZE! DON\u2019T MOVE ON RED!', 1.3); sting(); }
          else if (a === 'squeeze') { setB(st, 'sqTell', P.sqTell); DUELS.tell('BIG SQUEEZE! DODGE SIDEWAYS!', P.sqTell); sting(); }
          else { setB(st, 'hgTell', P.hgTell); DUELS.tell('HANGER BOOMERANG! STEP OFF THE ARC!', P.hgTell); sting(); planHangers(st, P); } }
        break; }
      // --- Mannequin Freeze: he strikes a pose in the middle of the floor; the lights cycle
      case 'freezeTell': face(); if (st.bt > st.bdur) { setB(st, 'freeze', 99); st.cyc = 0; setLight(st, 'green'); } break;
      case 'freeze': { st.lt += dt;
        if (st.light === 'green' && st.lt > P.green) setLight(st, 'yellow');
        else if (st.light === 'yellow' && st.lt > 0.9) setLight(st, 'red');
        else if (st.light === 'red' && st.lt > P.red) { st.cyc++; if (st.cyc >= P.cycles) { setLight(st, 'off'); setB(st, 'open', P.open); } else setLight(st, 'green'); }
        break; }
      // --- Big Squeeze: 1.2 s crouch tell (tracks Harold until the last 0.3 s, then locks), a lunge, a grab + mash
      case 'sqTell': if (left > 0.3) { face(10); st.lockX = Math.sin(st.byaw); st.lockZ = Math.cos(st.byaw); } if (st.bt > st.bdur) { setB(st, 'squeeze', 0.5); sfx('swing'); tone(140, 60, 0.4, 'sawtooth', 0.1); } break;
      case 'squeeze': { const sp = 12 * dt; st.bx = clamp(st.bx + st.lockX * sp, -AR + 1, AR - 1); st.bz = clamp(st.bz + st.lockZ * sp, -AR + 1, AR - 1);
        if (!st.hitThis && dist(st) < 1.35) { st.hitThis = true; if (st.inv <= 0 && st.dodgeT < 0) { setB(st, 'grab', 2.6); st.grabN = 0; C.hm.classList.add('on'); C.hmI.style.width = '0%'; st.atk = -1; DUELS.tell('', 0.01); sfx('heavy'); shake(st, 0.35); }
          else perfectDodge(st, 'squeeze'); }
        if (st.bs === 'squeeze' && st.bt > st.bdur) { if (!st.hitThis) perfectDodge(st, 'squeeze'); setB(st, 'open', P.open + 0.4); DUELS.tell('HE STUMBLED! HIT HIM!', 0.9); } break; }
      case 'grab': { const need = P.mash; C.hmI.style.width = Math.min(100, (st.grabN / need) * 100).toFixed(0) + '%'; st.hx = st.bx + Math.sin(st.byaw) * 1.0; st.hz = st.bz + Math.cos(st.byaw) * 1.0;
        if (Math.random() < dt * 6) shake(st, 0.12);
        if (st.grabN >= need) { C.hm.classList.remove('on'); st.stats.breaks++; addPower(st, 22); setB(st, 'stagger', 2.2); pop(V.set(st.hx, 2.2, st.hz), 'BREAK FREE!', 'word'); sfx('heavy'); flashBoss('#ffffff', 0.7); shake(st, 0.4); hitstop(st, 0.1); knock(st, 1.8);
          DUELS.tell('HE\u2019S DIZZY! WAIL ON HIM!', 1.2); }
        else if (st.bt > st.bdur) { C.hm.classList.remove('on'); st.inv = 0; hurt(st, 14, 'squeeze'); knock(st, 2.6); setB(st, 'open', 0.9); }
        break; }
      case 'stagger': if (st.bt > st.bdur) setB(st, 'stalk', rnd(...P.stalk)); break;
      // --- Hanger Boomerang
      case 'hgTell': face(10); if (st.bt > st.bdur) { setB(st, 'hanger', 99); for (const h of C.hangers) if (h.plan) { h.on = true; h.u = -h.delay; h.hit = false; h.m.visible = true; } sfx('swing'); } break;
      case 'hanger': { let live = 0;
        for (const h of C.hangers) { if (!h.on) continue; h.u += dt / 1.7; if (h.u < 0) { live++; continue; } if (h.u >= 1) { h.on = false; h.m.visible = false; h.plan = false; continue; } live++;
          hangerAt(h, h.u, V); h.m.position.set(V.x, 1.05, V.z); h.m.rotation.y += dt * 22;
          if (!h.hit && Math.hypot(V.x - st.hx, V.z - st.hz) < 0.85) { h.hit = true; if (st.inv <= 0 && st.dodgeT < 0) hurt(st, 7, 'hanger'); else perfectDodge(st, 'hanger'); } }
        if (!live) { C.dash.count = 0; setB(st, 'open', P.open); DUELS.tell('HE\u2019S OPEN!', 0.8); } break; }
      case 'open': if (st.bt > st.bdur) setB(st, 'stalk', rnd(...P.stalk)); break;
      case 'ko': break;
    }
    // the display mannequins (freeze strikers)
    for (const m of C.mq) { m.t += dt;
      if (m.s === 'tell') { m.eye.visible = Math.sin(m.t * 40) > -0.3; m.root.rotation.y = Math.atan2(st.hx - m.root.position.x, st.hz - m.root.position.z); if (m.t > 0.5) { m.s = 'lunge'; m.t = 0; m.from = m.root.position.clone(); m.to = V3.set(st.hx, 0, st.hz).clone(); sfx('swing'); } }
      else if (m.s === 'lunge') { const u = clamp(m.t / 0.3, 0, 1); m.root.position.lerpVectors(m.from, m.to, ease(u)); m.root.position.y = Math.sin(u * Math.PI) * 0.5;
        if (u >= 1) { if (Math.hypot(st.hx - m.to.x, st.hz - m.to.z) < 1.3 && st.inv <= 0 && st.dodgeT < 0) hurt(st, 8, 'mannequin'); else perfectDodge(st, 'mannequin'); m.s = 'back'; m.t = 0; m.from = m.root.position.clone(); } }
      else if (m.s === 'back') { const u = clamp(m.t / 0.8, 0, 1); m.root.position.lerpVectors(m.from, m.home, ease(u)); m.eye.visible = false; if (u >= 1) { m.s = 'idle'; m.root.rotation.y = Math.atan2(-m.home.x, -m.home.z); } } }
  }
  function spot(st) { // moved on RED: the nearest idle mannequin's eyes light up, it lunges
    if (st.spotCd > 0) return; st.spotCd = 1.5; st.stats.spotted++; let best = null, bd = 1e9; for (const m of C.mq) { if (m.s !== 'idle') continue; const d = Math.hypot(m.home.x - st.hx, m.home.z - st.hz); if (d < bd) { bd = d; best = m; } }
    if (!best) return; best.s = 'tell'; best.t = 0; DUELS.tell('SPOTTED! A MANNEQUIN\u2019S COMING!', 0.8); tone(520, 260, 0.3, 'sawtooth', 0.1); }
  // hanger flight: out along a curve past Harold, back along the mirror curve (quadratic beziers)
  function planHangers(st, P) {
    const n = P.hangers; for (let i = 0; i < 2; i++) { const h = C.hangers[i]; h.plan = i < n; if (!h.plan) continue;
      const dx = st.hx - st.bx, dz = st.hz - st.bz, d = Math.max(1.5, Math.hypot(dx, dz)), ux = dx / d, uz = dz / d, nx = -uz, nz = ux, s = n === 1 ? (Math.random() < 0.5 ? 1 : -1) : (i ? -1 : 1);
      h.a = new THREE.Vector2(st.bx + ux * 0.8, st.bz + uz * 0.8); h.b = new THREE.Vector2(clamp(st.hx + ux * 1.6, -AR, AR), clamp(st.hz + uz * 1.6, -AR, AR));
      const mx = (h.a.x + h.b.x) / 2, mz = (h.a.y + h.b.y) / 2, w = n === 1 ? 2.0 : 2.6; h.c1 = new THREE.Vector2(mx + nx * s * w, mz + nz * s * w); h.c2 = new THREE.Vector2(mx - nx * s * w * 1.25, mz - nz * s * w * 1.25); h.delay = i * 0.25; }
    // the dashed arc on the floor
    let k = 0; for (const h of C.hangers) { if (!h.plan) continue; for (let j = 0; j < 28; j++) { const u = (j + 0.5) / 28; hangerAt(h, u, V); hangerAt(h, Math.min(1, u + 0.01), V2);
      QQ.setFromAxisAngle(V3.set(0, 1, 0), Math.atan2(V2.x - V.x, V2.z - V.z) + Math.PI / 2); M4.compose(V.setY(0.05), QQ, V3.set(1, 1, 1)); C.dash.setMatrixAt(k++, M4); } }
    C.dash.count = k; C.dash.instanceMatrix.needsUpdate = true; }
  function hangerAt(h, u, out) { const bz = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
    if (u < 0.5) { const t = u * 2; out.set(bz(h.a.x, h.c1.x, h.b.x, t), 0, bz(h.a.y, h.c1.y, h.b.y, t)); } else { const t = (u - 0.5) * 2; out.set(bz(h.b.x, h.c2.x, h.a.x, t), 0, bz(h.b.y, h.c2.y, h.a.y, t)); } return out; }

  // ---------------- Harold ----------------
  function addPower(st, n) { const was = st.power >= 100; st.power = Math.min(100, st.power + n); if (!was && st.power >= 100) { DUELS.tell('POWER READY! PRESS ACT: CLEARANCE SALE', 1.2); tone(660, 1320, 0.25, 'triangle', 0.1); } subHud(st); }
  function perfectDodge(st, kind) { if (st.dodgeT >= 0 || st.inv > 0) { st.stats.dodges++; addPower(st, 12); pop(V.set(st.hx, 2.0, st.hz), 'DODGE!', 'word'); } }
  function knock(st, k) { const d = Math.max(0.01, dist(st)); st.hx = clamp(st.hx + (st.hx - st.bx) / d * k, -AR, AR); st.hz = clamp(st.hz + (st.hz - st.bz) / d * k, -AR, AR); }
  function hurt(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.sp >= 0) return false; st.hp -= dmg; st.inv = 1.3; st.hurtT = 0.4; st.stats.taken++; st.stats.hitsBy[kind]++; st.atk = -1; st.combo = 0;
    DUELS.hurt(); sfx('hurt'); C.hflash = 1; shake(st, 0.3); hitstop(st, 0.06); pop(V.set(st.hx, 1.6, st.hz), '-' + dmg, '');
    if (st.hp <= 35 && !st.cake && st.hp > 0) { st.cake = true; st.cakeT = 0.9; DUELS.say('MAVIS', 'Catch, hon! A crab cake from the register!', 2.2); }
    if (st.hp <= 0) {
      if (!st.sw) { st.sw = true; st.hp = 30; st.inv = 2.0; DUELS.banner('SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 1.8); tone(440, 880, 0.4, 'triangle', 0.12); }
      else { st.hp = 0; st.over = true; sfx('ko'); setLight(st, 'off'); C.hm.classList.remove('on'); DUELS.log.push('compking:lose:' + kind);
        setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'SQUEEZED OUT!', 'The Compression King folded Harold like a clearance tee. Retry phase ' + st.phase + ' with full health.'); }, SIM ? 300 : 1400); } }
    return true;
  }
  function damageBoss(st, dmg, crit, word) {
    if (st.bs === 'roar' || st.bs === 'ko' || st.bs === 'intro') return;
    const d = Math.round(crit ? dmg * 1.6 : dmg); st.bhp -= d; st.stats.landed++; if (crit) st.stats.crits++;
    st.combo++; st.comboT = 1.4; addPower(st, crit ? 9 : 6);
    V.set(st.bx, 2.3 + rnd(-0.2, 0.4), st.bz); pop(V, String(d), crit ? 'crit' : ''); if (word) pop(V2.set(st.bx + rnd(-0.6, 0.6), 3.4, st.bz), word, 'word');
    burst(V.set(st.bx * 0.6 + st.hx * 0.4, 1.6, st.bz * 0.6 + st.hz * 0.4), crit ? 10 : 6, crit ? ['#ffd23c', '#fff6a0', '#1fd1c1'] : ['#ffffff', '#1fd1c1', '#2a2e36']);
    flashBoss('#ffffff', 0.85); sfx(crit || word ? 'heavy' : 'hit'); hitstop(st, word ? 0.1 : crit ? 0.085 : 0.065); shake(st, word ? 0.3 : 0.15); C.bflinch = 1;
    const l = lines(); if (Math.random() < 0.12 && l && l.hurt) DUELS.say('THE COMPRESSION KING', pick(l.hurt), 1.8);
    if (st.phase === 1 && st.bhp <= BHP / 2) { st.bhp = BHP / 2; st.phase = 2; st.mixI = 0; setLight(st, 'off'); for (const h of C.hangers) { h.on = false; h.m.visible = false; h.plan = false; } C.dash.count = 0; C.hm.classList.remove('on');
      setB(st, 'roar', 1.6); DUELS.banner('PHASE 2<small>HE\u2019S TIGHTENING UP!</small>', 1.8); DUELS.say('THE COMPRESSION KING', 'Extra-tight fit! Size XXXL!', 2.2); shake(st, 0.4); subHud(st); }
    else if (st.bhp <= 0) { st.bhp = 0; ko(st); }
    subHud(st);
  }
  const isOpen = (st) => ['open', 'stagger'].includes(st.bs) || (st.bs === 'freeze' && st.light === 'green');
  function ko(st) { setB(st, 'ko', 99); st.over = true; st.won = true; st.ko = 0; setLight(st, 'off'); C.hm.classList.remove('on'); for (const h of C.hangers) { h.on = false; h.m.visible = false; } C.dash.count = 0;
    slowmo(st, 0.3, 1.4); shake(st, 0.6); flashBoss('#ffffff', 1); DUELS.banner('K.O.!<small>EVERYTHING MUST GO</small>', 2.4); tone(1320, 660, 0.6, 'triangle', 0.12); DUELS.log.push('compking:ko'); }

  C.step = function (dt0, I) {
    const st = C.st; if (!st) return;
    // slow-mo + hitstop scale the fight's clock; HUD timers keep real time
    if (st.slow > 0) st.slow -= dt0; const sk = st.slow > 0 ? st.slowK : 1; let dt = dt0 * sk;
    if (st.hs > 0) { st.hs -= dt0; dt = 0; }
    st.t += dt; st.inv -= dt; st.hurtT -= dt; st.dodgeCd -= dt; st.spotCd -= dt; st.comboT -= dt; if (st.comboT <= 0 && st.combo) { st.combo = 0; subHud(st); }
    if (st.cakeT > 0 && (st.cakeT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 30); pop(V.set(st.hx, 1.8, st.hz), '+30 CRAB CAKE', 'word'); tone(660, 990, 0.2, 'triangle', 0.1); }
    const P = PH[st.phase - 1];
    if (!st.over) {
      const mv = Math.hypot(I.mx, I.my) > 0.25, act = I.a || I.b || I.c;
      if (st.bs === 'grab') { if (act) { st.grabN++; tone(300 + st.grabN * 40, 200, 0.06, 'square', 0.06); } }
      else if (st.sp >= 0) special(st, dt);
      else {
        // move (camera-relative: forward = towards the King)
        const fx = st.bx - st.hx, fz = st.bz - st.hz, fd = Math.max(0.01, Math.hypot(fx, fz)), ux = fx / fd, uz = fz / fd, rx = -uz, rz = ux;
        let wx = ux * I.my + rx * I.mx, wz = uz * I.my + rz * I.mx; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
        if (st.dodgeT >= 0) { st.dodgeT += dt; st.hx += st.dx * 7 * dt; st.hz += st.dz * 7 * dt; st.hy = Math.sin(clamp(st.dodgeT / 0.42, 0, 1) * Math.PI) * 0.5; if (st.dodgeT > 0.42) { st.dodgeT = -1; st.hy = 0; } }
        else if (st.atk < 0 && st.hurtT <= 0) { const sp = 4.4 * dt; st.hx += wx * sp; st.hz += wz * sp; }
        // dodge hop
        if (I.b && st.dodgeT < 0 && st.dodgeCd <= 0) { st.dodgeT = 0; st.dodgeCd = 0.6; st.inv = Math.max(st.inv, 0.45); st.atk = -1; if (wl > 0.2) { st.dx = wx / Math.max(wl, 1e-3); st.dz = wz / Math.max(wl, 1e-3); } else { st.dx = rx; st.dz = rz; } sfx('jump'); }
        // swing combo (3 hits; the 3rd is this fight's finisher: PRICE CHECK overhead tag-slam)
        if (I.a && st.dodgeT < 0 && st.hurtT <= 0) { if (st.atk < 0) startSwing(st, 0); else if (st.atk > (st.atkN === 2 ? 0.3 : 0.14)) st.queued = true; }
        if (st.atk >= 0) { st.atk += dt; const dur = st.atkN === 2 ? 0.46 : 0.3;
          if (!st.atkHit && st.atk > dur * 0.42) { st.atkHit = true; landSwing(st); }
          if (st.atk > dur) { if (st.queued && st.atkN < 2) startSwing(st, st.atkN + 1); else st.atk = -1; } }
        // power
        if (I.c && st.power >= 100 && st.dodgeT < 0) startSpecial(st); else if (I.c && st.power < 100) { if (!st.pwNag || st.t - st.pwNag > 1.2) { st.pwNag = st.t; DUELS.tell('POWER ' + Math.floor(st.power) + '%: LAND HITS + DODGE', 0.8); } }
        // RED light: any move, dodge or swing is spotted (0.25 s grace when it turns red)
        if (st.bs === 'freeze' && st.light === 'red' && st.lt > 0.25 && (mv || I.a || I.b || st.dodgeT >= 0)) spot(st);
      }
      // keep apart from the King + inside the store
      const d = dist(st); if (d < 1.5 && st.bs !== 'grab') { const k = (1.5 - d) / Math.max(d, 0.01); st.hx += (st.hx - st.bx) * k; st.hz += (st.hz - st.bz) * k; }
      st.hx = clamp(st.hx, -AR, AR); st.hz = clamp(st.hz, -AR, AR);
    }
    if (st.bs !== 'ko') bossThink(st, dt); else outro(st, dt0 * sk);
    stepFx(dt);
    DUELS.bars(st.hp / 100, st.bhp / BHP);
  };
  function startSwing(st, n) { st.atk = 0; st.atkN = n; st.atkHit = false; st.queued = false; st.stats.swings++; sfx('swing'); }
  function landSwing(st) {
    const reach = dist(st) < 2.6; const n = st.atkN;
    // the cane's teal trail: a fan of sparks in front of Harold
    const yaw = Math.atan2(st.bx - st.hx, st.bz - st.hz); for (let k = 0; k < 4; k++) { const a = yaw + (n === 1 ? -1 : 1) * (k - 1.5) * 0.35; burst(V.set(st.hx + Math.sin(a) * 1.0, n === 2 ? 1.8 - k * 0.3 : 1.0, st.hz + Math.cos(a) * 1.0), 1, ['#1fd1c1', '#b8fff6'], 0.6, 0.35, 0.5); }
    if (!reach) return;
    damageBoss(st, n === 2 ? 14 : 7, isOpen(st), n === 2 ? pick(WORDS) : null);
    if (n === 2) { burst(V.set(st.bx, 2.8, st.bz), 6, ['#ffd23c', '#ffffff', '#d8262a'], 2, 0.8, 3); } // price tags fly
  }
  // ---------------- POWER special: CLEARANCE SALE (team-up with Mavis) ----------------
  function startSpecial(st) { st.sp = 0; st.power = 0; st.stats.specials++; st.atk = -1; st.inv = 3; subHud(st); st.spTicks = 0;
    slowmo(st, 0.4, 0.9); st.zoom = 1; DUELS.banner('CLEARANCE SALE!<small>EVERYTHING MUST GO</small>', 1.8); DUELS.say('MAVIS', 'Rack coming through, Harold!', 1.8); tone(330, 990, 0.5, 'sawtooth', 0.1);
    C.rack.visible = true; C.rack.position.set(C.M.root.position.x, 0, C.M.root.position.z); st.rack0 = C.rack.position.clone(); }
  function special(st, dt) { st.sp += dt; const t = st.sp;
    // 0-0.6: Mavis shoves the rack to Harold. 0.6-2.0: Harold spins through it towards the King, a fabric tornado, 4 hits. 2.0: done
    if (t < 0.6) { C.rack.position.lerpVectors(st.rack0, V.set(st.hx, 0, st.hz), ease(t / 0.6)); }
    else if (t < 2.0) { const u = (t - 0.6) / 1.4; C.rack.visible = false; const d = dist(st); if (d > 1.7) { st.hx += (st.bx - st.hx) / d * 5 * dt; st.hz += (st.bz - st.hz) / d * 5 * dt; }
      for (let k = 0; k < 3; k++) { const a = st.t * 14 + k * 2.1; burst(V.set(st.hx + Math.cos(a) * 1.1, 0.4 + u * 2.2 + k * 0.3, st.hz + Math.sin(a) * 1.1), 1, ['#1fd1c1', '#e8501e', '#ffd23c', '#3a5aa8', '#f4f6f8'], 1.2, 0.7, 1.5); }
      const due = Math.floor(u * 4.5); while (st.spTicks < Math.min(4, due)) { st.spTicks++; if (dist(st) < 3.2) damageBoss(st, 9, false, st.spTicks === 4 ? 'EVERYTHING MUST GO!' : null); else pop(V.set(st.hx, 2, st.hz), 'WHIFF', ''); if (st.over) break; } }
    else { st.sp = -1; st.inv = 0.4; st.zoom = 0; C.rack.visible = false; }
    if (st.over) { st.sp = -1; st.zoom = 0; C.rack.visible = false; } }

  // ---------------- the KO: seams split, he deflates like a vacuum bag into the bargain bin ----------------
  function outro(st, dt) {
    st.ko += dt; const t = st.ko, R = C.R;
    if (t < 1.2) { const u = t / 1.2; if (Math.random() < 0.5) burst(V.set(st.bx + rnd(-0.8, 0.8), rnd(1, 3), st.bz + rnd(-0.5, 0.5)), 2, ['#f4f6f8', '#1fd1c1', '#2a2e36'], 2.5, 0.6, 2); R.root.rotation.z = Math.sin(t * 40) * 0.04 * (1 - u); flashBoss(Math.sin(t * 30) > 0 ? '#ffffff' : '#1fd1c1', 0.5); }
    else if (t < 2.6) { const u = ease((t - 1.2) / 1.4); R.root.scale.set(1 - 0.55 * u + Math.sin(t * 50) * 0.03 * (1 - u), 1 - 0.78 * u, 1 - 0.55 * u); if (!st.said.hiss) { st.said.hiss = true; tone(1800, 200, 1.3, 'sawtooth', 0.06); const l = lines(); DUELS.say('THE COMPRESSION KING', l && l.defeat ? pick(l.defeat) : 'My seams... they\u2019re splitting...', 3.0); } }
    else if (t < 3.6) { const u = clamp((t - 2.6) / 1.0, 0, 1); if (!st.from) st.from = new THREE.Vector3(st.bx, 0, st.bz); st.bx = lerp(st.from.x, C.BIN.x, u); st.bz = lerp(st.from.z, C.BIN.z, u); R.root.position.y = Math.sin(u * Math.PI) * 2.2 + u * 0.7; R.root.rotation.x = u * TAU; }
    else if (!st.done) { st.done = true; R.root.visible = false; burst(V.set(C.BIN.x, 1.3, C.BIN.z), 14, ['#ffd23c', '#f4f6f8', '#1fd1c1'], 2, 0.8, 3); sfx('heavy'); pop(V.set(C.BIN.x, 2.2, C.BIN.z), '90% OFF!', 'crit');
      const n = st.stats.taken, grade = n <= 3 ? 'S' : n <= 8 ? 'A' : 'B', stars = grade === 'S' ? 3 : grade === 'A' ? 2 : 1; st.grade = grade; DUELS.log.push('compking:win:' + grade);
      const L = lmk(); if (L) DUELS.bossCleared(L.id, 'compking-duel');
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'THE COMPRESSION KING<br>DEFLATED', '<span style="color:#ffd23c;font-size:16px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span> GRADE ' + grade + ' \u00b7 hits taken: ' + n + '<br>He\u2019s in the bargain bin. ' + STORE + ' is clear. Crime here: 0.'); }, SIM ? 300 : 1400); }
    R.root.position.x = st.bx; R.root.position.z = st.bz;
  }

  function stepFx(dt) {
    const q = C.cam.quaternion;
    for (let i = C.parts.length - 1; i >= 0; i--) { const p = C.parts[i]; p.t += dt; p.v.y -= 7 * dt; p.v.multiplyScalar(1 - dt * 1.5); p.p.addScaledVector(p.v, dt); p.r += dt * 9; if (p.t > p.life || p.p.y < 0) C.parts.splice(i, 1); }
    C.parts.forEach((p, i) => { const s = p.s * (1 - p.t / p.life * 0.6); QQ.setFromAxisAngle(V3.set(0, 0, 1), p.r); QQ.premultiply(q); M4.compose(p.p, QQ, V2.set(s, s, s)); C.fx.setMatrixAt(i, M4); C.fx.setColorAt(i, p.c); });
    C.fx.count = C.parts.length; C.fx.visible = C.parts.length > 0; C.fx.instanceMatrix.needsUpdate = true; if (C.fx.instanceColor) C.fx.instanceColor.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.bs === 'grab') { const p = HERO_POSES.hurt(0.2); p.y = 0.4 + Math.sin(t * 30) * 0.04; p.shL = [-0.2, 0, 0.2]; p.shR = [-0.2, 0, -0.2]; legsStance(p, 0.05, 0.05); return p; }
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    if (st.sp >= 0 && st.sp > 0.6) { const p = HERO_POSES.atk3(0.5); p.tilt = [0, -st.sp * 22, 0]; p.y = 0.25; return p; }
    if (st.dodgeT >= 0) return HERO_POSES.jump(st.dodgeT < 0.2 ? 1 : -1);
    if (st.atk >= 0) { const dur = st.atkN === 2 ? 0.46 : 0.3, u = clamp(st.atk / dur, 0, 1);
      if (st.atkN === 2) { const p = HERO_POSES.idle(t); legsStance(p, 0.22, 0.6); const a = ease(clamp((u - 0.15) / 0.4, 0, 1)); // PRICE CHECK: the overhead tag-slam
        p.shR = [lerp(-3.0, -0.6, a), 0, -0.2]; p.elR = [lerp(-0.5, -0.05, a), 0, 0]; p.shL = [lerp(-2.8, -0.7, a), 0, 0.2]; p.elL = [-0.4, 0, 0]; p.torso = [lerp(-0.3, 0.6, a), 0, 0]; p.y = Math.sin(clamp(u / 0.4, 0, 1) * Math.PI) * 0.35; return p; }
      return st.atkN === 0 ? HERO_POSES.atk1(u) : HERO_POSES.atk2(u); }
    const mv = Math.hypot(C.lastMv || 0, 0); if (mv > 0.05) return HERO_POSES.run(t, 4);
    return HERO_POSES.idle(t);
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || isOpen(st) ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.sp >= 0 && st.sp < 0.7) { p.shL = [-1.5, 0, 0.2]; p.shR = [-1.5, 0, -0.2]; p.elL = p.elR = [-0.1, 0, 0]; p.torso = [0.5, 0, 0]; } return p; }
  function poseBoss(st, dt) {
    const R = C.R, t = st.t, u = st.bt / Math.max(0.01, st.bdur), b = C.base; if (st.bs === 'ko') { R.root.rotation.y = st.byaw; return; }
    let hipY = b.hipY + Math.sin(t * 2.6) * 0.04, lean = 0, aL = [0, 0, 0.15], aR = [0, 0, -0.15], lg = 0, head = 0, glow = 0, gc = '#ff3d6e';
    const walk = st.bs === 'stalk' && dist(st) > 2.4; if (walk) { lg = Math.sin(t * 7) * 0.5; aL = [-lg * 0.6, 0, 0.2]; aR = [lg * 0.6, 0, -0.2]; hipY += Math.abs(Math.sin(t * 7)) * 0.06; }
    switch (st.bs) {
      case 'intro': case 'roar': aL = [-2.6, 0, 0.6]; aR = [-2.6, 0, -0.6]; head = -0.3; hipY += Math.sin(t * 20) * 0.03; break;
      case 'freezeTell': aL = [-1.4 * ease(u), 0, 1.0]; aR = [-0.4, 0, -1.2 * ease(u)]; glow = 0.25 * (Math.sin(st.bt * 24) * 0.5 + 0.5); gc = '#ffd23c'; break;
      case 'freeze': aL = [-2.9, 0, 0.3]; aR = [-0.2, 0, -1.5]; lean = -0.1; hipY = b.hipY; head = 0.15; break; // the pose: one arm up, a showroom flex
      case 'sqTell': { const k = ease(clamp(u * 1.4, 0, 1)); hipY -= 0.45 * k; lean = 0.45 * k; aL = [-1.3, 0, 1.5 * k]; aR = [-1.3, 0, -1.5 * k]; glow = 0.3 + 0.3 * (Math.sin(st.bt * 26) * 0.5 + 0.5); break; }
      case 'squeeze': lean = 0.6; aL = [-1.5, 0, 1.2]; aR = [-1.5, 0, -1.2]; hipY -= 0.2; break;
      case 'grab': lean = 0.1; aL = [-1.45, 0, -0.35]; aR = [-1.45, 0, 0.35]; hipY += Math.sin(t * 30) * 0.03; break;
      case 'hgTell': { const k = ease(clamp(u * 1.3, 0, 1)); aR = [-0.6 - 1.6 * k, -0.6 * k, -1.2]; lean = -0.15 * k; glow = 0.25 + 0.25 * (Math.sin(st.bt * 24) * 0.5 + 0.5); gc = '#ff3d6e'; break; }
      case 'hanger': aR = [-1.4, 0, -0.4]; lean = 0.15; break;
      case 'open': case 'stagger': hipY -= 0.3; lean = 0.35 + Math.sin(st.bt * 8) * 0.05; aL = [0.3, 0, 0.5]; aR = [0.3, 0, -0.5]; head = 0.4 + (st.bs === 'stagger' ? Math.sin(st.bt * 9) * 0.25 : 0); break;
    }
    if (C.bflinch > 0) { C.bflinch = Math.max(0, C.bflinch - dt * 6); lean -= 0.25 * C.bflinch; }
    R.root.position.set(st.bx, R.root.position.y * 0, st.bz); R.root.rotation.y = st.byaw;
    R.hip.position.y = damp(R.hip.position.y, hipY, 14, dt); R.torso.rotation.x = damp(R.torso.rotation.x, lean, 12, dt); R.head.rotation.x = damp(R.head.rotation.x, head, 10, dt);
    for (const [g, a] of [[R.armL, aL], [R.armR, aR]]) { g.rotation.x = damp(g.rotation.x, a[0], 14, dt); g.rotation.y = damp(g.rotation.y, a[1], 14, dt); g.rotation.z = damp(g.rotation.z, a[2], 14, dt); }
    R.legL.rotation.x = damp(R.legL.rotation.x, lg, 14, dt); R.legR.rotation.x = damp(R.legR.rotation.x, -lg, 14, dt);
    if (st.phase === 2 && st.bs === 'roar') R.root.scale.setScalar(1 + 0.08 * ease(clamp(st.bt / 1.2, 0, 1))); else if (st.phase === 2) R.root.scale.setScalar(1.08);
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow && R.flash[0] && R.flash[0].userData.flash) { for (const m of R.flash) { m.userData.flashC.value.set(gc); m.userData.flash.value = Math.max(m.userData.flash.value, glow); } }
    if (R.eye) R.eye.material.color.set(st.bs === 'freeze' ? (st.light === 'red' ? '#ff2a3a' : '#3dff6a') : glow ? '#ff3d6e' : '#1fd1c1');
    if (R.update) { try { R.update(dt, st.bs); } catch (e) {} }
    // tells: the "!" over his head, the squeeze lane, the ring under him
    const tell = ['sqTell', 'hgTell', 'freezeTell'].includes(st.bs); C.bang.visible = tell; if (tell) { C.bang.position.set(st.bx, 4.2 * R.root.scale.y + Math.sin(st.t * 12) * 0.08, st.bz); }
    C.ring.visible = tell; if (tell) { C.ring.position.set(st.bx, 0.04, st.bz); C.ring.material.opacity = 0.5 + 0.3 * Math.sin(st.t * 20); C.ring.material.color.set(st.bs === 'freezeTell' ? '#ffd23c' : '#ff3d6e'); C.ring.rotation.y += dt * 2; }
    C.lane.visible = st.bs === 'sqTell' || st.bs === 'squeeze'; if (C.lane.visible) { C.lane.position.set(st.bx, 0.03, st.bz); C.lane.rotation.y = Math.atan2(st.lockX, st.lockZ); C.lane.scale.set(1, 1, 6.5); C.lane.material.opacity = st.bs === 'squeeze' ? 0.35 : 0.25 + 0.25 * (Math.sin(st.t * 26) * 0.5 + 0.5); }
    if (st.bs === 'hgTell') { const h = C.hangers[0]; h.m.visible = true; R.hand.getWorldPosition(V); h.m.position.copy(V); h.m.rotation.y += dt * 2; }
    C.dash.visible = C.dash.count > 0; if (C.dash.visible) C.dash.material.opacity = 0.55 + 0.35 * Math.sin(st.t * 16);
    C.shB.position.set(st.bx, 0.02, st.bz);
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.slow > 0 ? st.slowK : 1), t = st.t;
    const H = C.H; const px = H.root.position.x, pz = H.root.position.z; C.lastMv = Math.hypot(st.hx - px, st.hz - pz) / Math.max(dt, 1e-3) > 0.8 ? 1 : 0;
    H.root.position.set(st.hx, st.hy, st.hz); H.root.rotation.y = Math.atan2(st.bx - st.hx, st.bz - st.hz); applyPose(H, haroldPose(st, t), 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); H.mat.userData.flash.value = C.hflash * 0.8; } else if (st.inv > 0 && !st.over && st.sp < 0) H.mat.userData.flash.value = Math.sin(st.t * 30) > 0 ? 0.35 : 0; else H.mat.userData.flash.value = 0;
    const M = C.M; M.root.position.set(6.2, 0, -7.2); M.root.rotation.y = Math.atan2(st.hx - 6.2, st.hz + 7.2); applyPose(M, mavisPose(st, t), 12, dt, false);
    poseBoss(st, dt);
    DUELS.hot(st.power >= 100 && !st.over);
    // pops
    for (const p of C.pops) { if (p.t > 0.9) { if (p.e.style.opacity !== '0') p.e.style.opacity = '0'; continue; } p.t += Math.min(0.05, rdt); V.copy(p.p); V.y += p.t * 1.2; V.project(C.cam);
      p.e.style.opacity = String(clamp(1.4 - p.t * 1.6, 0, 1)); p.e.style.left = ((V.x * 0.5 + 0.5) * VW()).toFixed(0) + 'px'; p.e.style.top = ((-V.y * 0.5 + 0.5) * VH()).toFixed(0) + 'px'; p.e.style.transform = 'translate(-50%,-50%) scale(' + (1 + Math.max(0, 0.25 - p.t) * 2).toFixed(2) + ')'; }
    // camera: behind Harold, looking past him at the King (lock-on); portrait pulls back + up. Zoom on the special, orbit on the KO.
    const port = VH() > VW(); C.cam.fov = (port ? 68 : 52) - (st.zoom ? 8 : 0); C.cam.updateProjectionMatrix();
    const fx = st.bx - st.hx, fz = st.bz - st.hz, fd = Math.max(0.5, Math.hypot(fx, fz)), ux = fx / fd, uz = fz / fd, back = port ? 6.4 : 5.2, up = port ? 4.4 : 3.4;
    V.set(st.hx - ux * back - uz * 0.8, up, st.hz - uz * back + ux * 0.8); V2.set((st.hx + st.bx) / 2, 1.7, (st.hz + st.bz) / 2);
    if (st.bs === 'intro' && !st.said.cam) { const k = ease(clamp(st.bt / st.bdur, 0, 1)); V.lerpVectors(V3.set(st.bx + 4, 3.2, st.bz - 5.5), V.clone(), k); V2.lerpVectors(V3.set(st.bx, 2.6, st.bz), V2.clone(), k); }
    if (st.bs === 'ko') { const a = st.ko * 0.6; V.set(st.bx + Math.sin(a) * 7, 3.6, st.bz - Math.cos(a) * 7); V2.set(st.bx, 1.5, st.bz); }
    V.x = clamp(V.x, -AR - 2.2, AR + 2.2); V.z = clamp(V.z, -AR - 2.2, AR + 2.2);
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.4; V.y += rnd(-1, 1) * st.shake * 0.4; st.shake = Math.max(0, st.shake - Math.min(0.05, rdt) * 2.2); }
    C.camP.lerp(V, 1 - Math.exp(-8 * Math.min(0.05, rdt * (SIM || 1)))); C.camL.lerp(V2, 1 - Math.exp(-9 * Math.min(0.05, rdt * (SIM || 1)))); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 22; OUT_U.fogF.value = 60;
  };
  C.onResize = () => {};

  // ---------------- test bot: win (dodges, freezes, mashes, uses POWER) | mash (SWING only + walks in) | lose (stands still, never mashes) ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt; const d = dist(st), left = st.bdur - st.bt, win = B.mode !== 'mash';
    if (st.bs === 'grab') { if (B.mode !== 'lose' && (B.mt = (B.mt || 0) - dt) <= 0) { B.a = true; B.mt = 0.09; } return; }
    const frozen = st.bs === 'freeze' && (st.light === 'red' || st.light === 'yellow' && st.lt > 0.6); if (frozen && win) return; // statue
    if (st.bs === 'freezeTell' && win) return;
    if (win) {
      if (st.bs === 'sqTell' && left < 0.32 && st.dodgeCd <= 0 && d < 7) { B.b = true; B.mx = 1; return; }
      if (st.bs === 'squeeze' && d < 3 && st.dodgeCd <= 0) { B.b = true; B.mx = 1; return; }
      if (st.bs === 'hanger') { for (const h of C.hangers) { if (!h.on || h.u < 0) continue; hangerAt(h, Math.min(1, h.u + 0.12), V); if (Math.hypot(V.x - st.hx, V.z - st.hz) < 1.2 && st.dodgeCd <= 0) { B.b = true; B.mx = -1; return; } } }
      if (st.power >= 100 && d < 4 && !(st.bs === 'freeze')) { B.c = true; return; }
      if (st.bs === 'hgTell' || st.bs === 'sqTell') { B.mx = 0.6; return; } // circle a little while he winds up
    }
    if (d > 2.2) B.my = 1; else if (B.cd <= 0) { B.a = true; B.cd = 0.11; }
  };
  DUELS.reg('compking', C);
  // city entry: the FIGHT ring at the landmark's real boss anchor (DESIGN's south-shore gear landmark), one step out towards the street
  const L = lmk(); if (L && L.boss) DUELS.addTrigger('compking', L, L.boss.x, L.boss.z, L.boss.x, L.boss.z - 2.2, '#1fd1c1');
  // ?compking=1 [&compkingauto=win|lose|mash] starts it straight away (after the first frames, skipping the intro)
  if (Q.get('compking')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; DUELS.start('compking', Q.get('compkingauto') ? { bot: Q.get('compkingauto') } : {}); } }); }
  window.__compking = C;
})();

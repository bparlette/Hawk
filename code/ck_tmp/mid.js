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


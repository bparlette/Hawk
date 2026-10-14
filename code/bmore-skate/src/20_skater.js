
// ======================= TOAD CITY SKATE: the rider (TAD) + the board =======================
// TAD is built with Toad City Baltimore's own procedural rig system (04c_rigs.js): the same 28-bone skeleton, the same SDF body
// (smooth-unioned ellipsoids / round cones meshed with surface nets, quadric-decimated, skin-weighted), the same cel toonMat and the
// same weighted-skinning ink hull as Harold / Mavis. Only the proportions (a young toad, longer legs) and the outfit spec are new:
// backwards orange cap, purple hoodie with a gold chest stripe, baggy denim, red high-tops. The poses are code-authored (SKR.pose).
const SKR = (function () {
  const D = { hip: 0.74, torsoY: 0.05, chestY: 0.22, neckY: 0.52, legX: 0.13, thigh: 0.36, shin: 0.33, shX: 0.31, shY: 0.42, upper: 0.27, fore: 0.25,
    jaw: [0, 0.1, -0.06], must: [0, 0.12, 0.3], mono: [0.14, 0.32, 0.26], fg: [0, -0.06, 0.04], toe: [0, -0.03, 0.1], s: 1 };
  const spec = ({ E, C, K, PE, PB, A }, d) => {
    const SK = '#6fae3a', SK2 = '#d6d48c', WART = '#5a9030', HOOD = '#5b3aa0', HOOD2 = '#4a2c88', GOLD = '#f2b52a', JEAN = '#3d5f96', JEAN2 = '#2f4c7c', SHOE = '#d8342c', SOLE = '#f4f0e6', CAP = '#f07a1a', CAPB = '#1a1420';
    // trunk: baggy jeans at the hips, a roomy hoodie
    E('hips', [0, 0.02, 0], [0.23, 0.15, 0.19], JEAN);
    E('torso', [0, 0.1, -0.01], [0.25, 0.2, 0.21], HOOD); E('chest', [0, 0.03, -0.02], [0.28, 0.25, 0.22], HOOD);
    E('chest', [0, 0.25, -0.15], [0.19, 0.09, 0.11], HOOD2, { k: 0.04 }); // the hood bunched behind the neck
    // head: the wide flat toad head (Harold's construction, younger + rounder), pale throat on the jaw, eye bulges
    E('head', [0, 0.15, 0.03], [0.3, 0.2, 0.27], SK); E('head', [0, -0.02, 0.12], [0.26, 0.11, 0.22], SK2, { b: 'jaw', k: 0.05 });
    for (const s of [-1, 1]) E('head', [s * 0.13, 0.28, 0.13], [0.1, 0.095, 0.095], SK, { k: 0.04 });
    // backwards cap: crown (rigid) + the brim out the back
    E('head', [0, 0.35, -0.07], [0.25, 0.11, 0.23], CAP, { rigid: true, k: 0.03 });
    A('head', RG.box(0.27, 0.03, 0.2), CAPB, [0, 0.33, -0.33], { rot: [-0.18, 0, 0] });
    A('head', RG.sph(0.035, 0.02, 0.035, 6, 4), CAPB, [0, 0.46, -0.06], { outline: false });
    for (const k of ['L', 'R']) {
      // hoodie sleeves with gold cuffs, toad hands
      E('sh' + k, [0, 0, 0], [0.11, 0.11, 0.11], HOOD); C('sh' + k, [0, 0, 0], [0, -d.upper, 0], 0.088, 0.078, HOOD, { b: 'sh' + k });
      C('el' + k, [0, 0, 0], [0, -d.fore + 0.03, 0], 0.078, 0.07, HOOD);
      PB('el' + k, [0, -d.fore + 0.05, 0], [0.11, 0.028, 0.11], GOLD, { on: ['el' + k] });
      E('ha' + k, [0, -0.035, 0.01], [0.085, 0.05, 0.085], SK, { k: 0.03 }); E('fg' + k, [0, -0.01, 0.03], [0.08, 0.045, 0.075], SK, { k: 0.03 });
      // baggy jeans, rolled cuffs, red high-tops with white soles
      C('lg' + k, [0, 0.02, 0], [0, -d.thigh, 0], 0.118, 0.108, JEAN); C('kn' + k, [0, 0, 0], [0, -d.shin + 0.05, 0], 0.108, 0.1, JEAN);
      PB('kn' + k, [0, -d.shin + 0.07, 0], [0.16, 0.03, 0.16], JEAN2, { on: ['kn' + k] });
      E('ft' + k, [0, -0.02, 0.0], [0.1, 0.095, 0.11], SHOE, { k: 0.02, rigid: true }); E('toe' + k, [0, -0.005, 0.05], [0.1, 0.062, 0.125], SHOE, { k: 0.02, rigid: true });
      PB('ft' + k, [0, -0.085, 0.04], [0.14, 0.03, 0.24], SOLE, { on: ['ft' + k, 'toe' + k] }); PB('toe' + k, [0, -0.045, 0.05], [0.14, 0.022, 0.2], SOLE, { on: ['ft' + k, 'toe' + k] });
    }
    // hoodie: the gold chest stripe, kangaroo pocket, drawstrings
    PB('chest', [0, 0.02, 0], [0.5, 0.04, 0.5], GOLD, { on: ['chest'] });
    PB('torso', [0, 0.04, 0.19], [0.15, 0.075, 0.06], HOOD2, { on: ['torso'] });
    for (const s of [-1, 1]) A('chest', RG.box(0.018, 0.16, 0.018), '#f4f0e6', [s * 0.06, 0.12, 0.2], { outline: false, surf: [0, 0, 1, 0.01] });
    // face: mouth line + corners, gold toad eyes with black horizontal pupils, brow ridges, warts
    A('head', RG.box(0.38, 0.022, 0.04), '#2a1a14', [0, 0.105, 0.29], { outline: false, surf: [0, 0, 1, -0.005] });
    for (const s of [-1, 1]) {
      A('head', RG.box(0.06, 0.022, 0.04), '#2a1a14', [s * 0.2, 0.115, 0.25], { rot: [0, s * 0.5, s * 0.3], outline: false }); // a grin
      A('head', RG.sph(0.078, 0.074, 0.05), '#f0d050', [s * 0.13, 0.305, 0.2]); A('head', RG.box(0.075, 0.03, 0.02), '#121010', [s * 0.13, 0.305, 0.248], { outline: false });
      A('head', RG.sph(0.016, 0.016, 0.01, 5, 4), '#ffffff', [s * 0.13 + 0.02, 0.325, 0.255], { outline: false });
      A('head', RG.box(0.1, 0.026, 0.035), SK, [s * 0.13, 0.36, 0.2], { rot: [0.5, 0, s * -0.12] });
      A('head', RG.sph(0.028, 0.02, 0.02, 5, 4), WART, [s * 0.23, 0.19, 0.16], { outline: false, surf: [s * 0.6, 0.3, 0.7, -0.008] });
    }
  };
  // rig kind "tad": grid step, skin blend, bounding sphere, triangle budget (Harold's budget class)
  RIG_KINDS.tad = () => [D, spec, 0.032, 0.03, [0.9, 2.2], 3600];

  // ---------------- the board: popsicle deck with kicked nose + tail, black grip, purple / gold graphic, trucks, cream wheels; ink hull ----------------
  function boardGroup() {
    const g = new THREE.Group(), HB2 = new HB();
    const L = 0.56, W = 0.21, T = 0.028, KL = 0.14, KA = 0.32; // flat length, width, thickness, kick length, kick angle
    const plank = (len, z0, ang, col, y0, th) => { const b = new THREE.BoxGeometry(W, th, len); b.translate(0, 0, Math.sign(z0) * len / 2); b.rotateX(-Math.sign(z0) * ang); b.translate(0, y0, z0); return b; };
    HB2.geo(new THREE.BoxGeometry(W, T, L).translate(0, 0, 0), '#6a3ab8');
    for (const s of [-1, 1]) HB2.geo(plank(KL, s * L / 2, KA, null, 0, T), '#6a3ab8');
    // grip tape (top skin) + the graphic stripe on the bottom
    HB2.geo(new THREE.BoxGeometry(W - 0.012, 0.004, L).translate(0, T / 2 + 0.002, 0), '#16141a', { ol: false });
    for (const s of [-1, 1]) HB2.geo(plank(KL - 0.01, s * L / 2, KA, null, T / 2 + 0.002, 0.004), '#16141a', { ol: false });
    HB2.geo(new THREE.BoxGeometry(W - 0.03, 0.004, 0.08).translate(0, -T / 2 - 0.002, 0.1), '#f2b52a', { ol: false });
    HB2.geo(new THREE.BoxGeometry(W - 0.03, 0.004, 0.05).translate(0, -T / 2 - 0.002, -0.06), '#f2b52a', { ol: false });
    HB2.geo(new THREE.CylinderGeometry(0.045, 0.045, 0.004, 10).translate(0, -T / 2 - 0.003, 0.02), '#6fae3a', { ol: false });
    // trucks + wheels
    for (const z of [-0.2, 0.2]) {
      HB2.box(-0.03, -T / 2 - 0.035, z - 0.03, 0.03, -T / 2, z + 0.03, '#b8bcc4');
      HB2.geo(new THREE.CylinderGeometry(0.012, 0.012, W + 0.04, 6).rotateZ(Math.PI / 2).translate(0, -T / 2 - 0.045, z), '#9aa0a8', { ol: false });
      for (const s of [-1, 1]) HB2.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 10).rotateZ(Math.PI / 2).translate(s * (W / 2 + 0.01), -T / 2 - 0.045, z), '#efe6c8');
    }
    const m = HB2.build(); m.traverse((o) => { if (o.isMesh) { o.castShadow = o.material !== OUT_CITY; o.frustumCulled = false; } });
    if (m.userData.hull) m.userData.hull.material = OUT_CHAR;
    g.add(m); return g;
  }

  // ---------------- poses: code-authored, on the shared JOINTS pose API (blank / applyPose) ----------------
  // the rider stands across the board (rig +Z = facing the toe side); regular stance: left foot toward the nose
  const P = {
    roll(t, lean, push, sp) { // knees soft, arms loose; lean = carve (+ toe side), push = 0..1 push-kick phase weight
      const p = blank(); const b = Math.sin(t * 2.4) * 0.02;
      p.lgL = [-0.28 - lean * 0.2, 0, 0.16]; p.lgR = [-0.22 - lean * 0.2, 0, -0.16]; p.knL = [0.55 + lean * 0.25, 0, 0]; p.knR = [0.5 + lean * 0.25, 0, 0];
      p.ftL = [-0.25, 0, -0.16]; p.ftR = [-0.25, 0, 0.16]; p.y = -0.075 - lean * 0.03 + b;
      p.torso = [0.22 + lean * 0.22, 0.18, 0]; p.chest = [0.06, 0.08, 0]; p.neck = [-0.12, 0.95, 0]; p.hips = [0, 0.05, 0];
      p.shL = [-0.25, 0, 0.55 + lean * 0.2]; p.elL = [-0.45, 0, 0]; p.shR = [0.1, 0, -0.45]; p.elR = [-0.5, 0, 0];
      p.tilt = [lean * 0.22, 0, 0];
      if (push > 0) { // the back foot comes off and kicks
        const k = Math.sin(push * Math.PI); p.lgR = [lerp(p.lgR[0], 0.55, k), 0, lerp(-0.16, -0.05, k)]; p.knR = [lerp(p.knR[0], 0.25, k), 0, 0]; p.knL = [0.85, 0, 0]; p.y -= 0.08 * k; p.torso[0] += 0.18 * k; }
      return p;
    },
    crouch(k) { const p = P.roll(0, 0, 0, 0); p.knL = [0.55 + 0.9 * k, 0, 0]; p.knR = [0.5 + 0.9 * k, 0, 0]; p.lgL[0] -= 0.45 * k; p.lgR[0] -= 0.45 * k; p.y -= 0.2 * k; p.torso[0] += 0.3 * k; p.shL = [-0.5, 0, 0.9]; p.shR = [-0.3, 0, -0.9]; return p; },
    air(vy, tuck) { // tucked knees, arms out for balance
      const p = blank(); const k = tuck;
      p.lgL = [-0.7 - 0.4 * k, 0, 0.2]; p.lgR = [-0.6 - 0.4 * k, 0, -0.2]; p.knL = [1.2 + 0.6 * k, 0, 0]; p.knR = [1.1 + 0.6 * k, 0, 0]; p.ftL = [-0.4, 0, -0.2]; p.ftR = [-0.4, 0, 0.2];
      p.y = -0.2 - 0.12 * k; p.torso = [0.3 + 0.15 * k, 0.2, 0]; p.chest = [0.1, 0.05, 0]; p.neck = [-0.25, 0.9, 0]; p.hips = [0, 0.05, 0];
      p.shL = [-0.6, 0, 1.15]; p.shR = [-0.4, 0, -1.2]; p.elL = [-0.3, 0, 0]; p.elR = [-0.35, 0, 0];
      return p;
    },
    grab(kind, k) { // a hand reaches the board: INDY (back hand, toe edge), MELON (front hand, heel edge), NOSEGRAB, TAILGRAB, METHOD (arched)
      const p = P.air(0, 1);
      if (kind === 'METHOD') { p.torso = [-0.2, 0.9, 0]; p.lgL = [0.3, 0, 0.25]; p.lgR = [0.4, 0, -0.25]; p.knL = p.knR = [1.9, 0, 0]; p.shL = [-1.6, 0, 1.3]; p.shR = [0.7, 0, -0.7]; p.elR = [-1.2, 0, 0]; }
      else if (kind === 'NOSEGRAB') { p.torso = [0.9, 0.3, 0]; p.shL = [-0.6, 0, -0.2]; p.elL = [-0.2, 0, 0]; p.shR = [-0.6, 0, -1.4]; }
      else if (kind === 'TAILGRAB') { p.torso = [0.85, 0.85, 0]; p.shR = [-0.5, 0, 0.2]; p.elR = [-0.2, 0, 0]; p.shL = [-0.6, 0, 1.4]; }
      else if (kind === 'MELON') { p.torso = [0.75, 0.2, 0]; p.shL = [0.4, 0, 0.1]; p.elL = [-0.3, 0, 0]; p.shR = [-1.5, 0, -1.1]; }
      else { p.torso = [0.75, 0.75, 0]; p.shR = [-0.45, 0, -0.05]; p.elR = [-0.35, 0, 0]; p.shL = [-1.7, 0, 1.0]; } // INDY
      p.neck = [-0.35, 0.4, 0];
      for (const j of ['torso', 'shL', 'shR', 'elL', 'elR']) { const a = P.air(0, 1)[j]; p[j] = [lerp(a[0], p[j][0], k), lerp(a[1], p[j][1], k), lerp(a[2], p[j][2], k)]; }
      return p;
    },
    grind(bal, kind, t) { // balance crouch, arms out wide, the body leans with the balance
      const p = P.roll(t, 0, 0, 0); p.knL = [0.85, 0, 0]; p.knR = [0.8, 0, 0]; p.lgL[0] = -0.45; p.lgR[0] = -0.4; p.y = -0.13;
      p.shL = [-0.2, 0, 1.25 - bal * 0.5]; p.shR = [-0.2, 0, -1.25 - bal * 0.5]; p.elL = p.elR = [-0.15, 0, 0];
      p.tilt = [0, 0, -bal * 0.35]; p.torso = [0.3, kind === 'slide' ? 0.05 : 0.2, -bal * 0.25];
      return p;
    },
    manual(bal, nose) { // weight over one truck, a hand up
      const p = P.roll(0, 0, 0, 0); const s = nose ? -1 : 1;
      p.lgL = [-0.35, 0, 0.12 + s * 0.08]; p.lgR = [-0.3, 0, -0.12 + s * 0.08]; p.knL = [nose ? 0.85 : 0.45, 0, 0]; p.knR = [nose ? 0.45 : 0.85, 0, 0];
      p.shL = [-0.6, 0, 1.4 + bal * 0.3]; p.shR = [-0.2, 0, -0.6 - bal * 0.3]; p.elL = [-0.3, 0, 0]; p.tilt = [0, 0, s * 0.12 - bal * 0.3]; p.torso = [0.3, 0.55, -bal * 0.2];
      return p;
    },
    bail(u) { // sprawl: tipped onto the back, limbs out
      const p = blank(); p.tilt = [-Math.PI / 2 * clamp(u * 2.5, 0, 1) + 0.1, 0, 0]; p.ty = 0.22;
      p.lgL = [-0.9, 0, 0.45]; p.knL = [1.2, 0, 0]; p.lgR = [-0.3, 0, -0.3]; p.knR = [0.5, 0, 0];
      p.shL = [-2.5, 0, 0.9]; p.shR = [-2.2, 0, -1.1]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.35, 0, 0];
      return p;
    },
    getup(u) { const p = P.roll(0, 0, 0, 0); p.knL = [0.55 + 1.4 * (1 - u), 0, 0]; p.knR = [0.5 + 1.4 * (1 - u), 0, 0]; p.y -= 0.35 * (1 - u); p.torso[0] += 0.7 * (1 - u); return p; },
    special(u) { const p = P.air(0, 1); p.shL = [-2.9, 0, 0.5]; p.shR = [-2.9, 0, -0.5]; p.elL = p.elR = [-0.1, 0, 0]; p.torso = [0.1, 0.5, 0]; return p; },
  };

  let J = null, board = null;
  const root = new THREE.Group(), riderPivot = new THREE.Group(), boardPivot = new THREE.Group(), boardSpin = new THREE.Group();
  root.rotation.order = 'YXZ'; boardPivot.rotation.order = 'YXZ'; boardSpin.rotation.order = 'YXZ';
  root.add(riderPivot); root.add(boardPivot); boardPivot.add(boardSpin);
  riderPivot.rotation.y = -Math.PI / 2; riderPivot.position.y = 0.105;
  boardPivot.position.y = 0.075;
  // a soft blob shadow under the board (reads on every surface, also when the sun shadow misses)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#14101f', transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
  blob.renderOrder = 1; scene.add(blob);
  function build() {
    const t0 = performance.now();
    J = rigBuild('tad'); riderPivot.add(J.root);
    board = boardGroup(); boardSpin.add(board);
    scene.add(root);
    applyPose(J, P.roll(0, 0, 0, 0), 1, 1, true);
    return Math.round(performance.now() - t0);
  }
  function pose(p, rate, dt, snap) { if (J) applyPose(J, p, rate, dt, snap); }
  return { root, riderPivot, boardPivot, boardSpin, blob, build, pose, P, get J() { return J; }, get board() { return board; }, D };
})();

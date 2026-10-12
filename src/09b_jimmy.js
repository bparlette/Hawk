
// ======================= BIG JIMMY, NATIONAL AQUARIUM: the underwater swim fight (DESIGN.md "More game-style fights").
// A 3D swim inside the big tank (caustic light on the sand and rocks, swaying kelp, light shafts, rising bubbles, all procedural).
// Big Jimmy, a giant blue crab, snaps his claws (tell: a claw rises, opens and flashes red; DASH sideways) and spits bubble blasts
// (tell: his mouth froths and he glows cyan; swim or dash out of the line). After a snap combo he REARS UP and shows his soft
// underside (it glows gold): swim in under him and STRIKE. The AIR meter drains; bubble vents on the tank floor refill it.
// 3 phases (300 HP, 100 per phase), each faster with more snaps, wider and then homing bubble spreads and quicker air drain.
// Controls: phone: arcade stick + UP / DOWN (the white buttons), SWING = STRIKE, JUMP = DASH. Desktop: WASD / arrows, SPACE up,
// SHIFT (or C) down, J (or E) strike, K dash. Gamepad: left stick, RT/RB up, LT/LB down (or the right stick), X strike, A dash.
// Rig hook: if window.buildBigJimmy exists it is called as buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL }) and must return
// { root, body?, soft?, mouth?, claws?: [{ arm, top, bot, tip }] x2, legs?: [left, right], flash?: [materials] } (Object3Ds; any
// missing optional piece is skipped). Otherwise the procedural stand-in below is used.
(function () {
  const TANK = { x: 15.5, z: 15.5, y0: 0.7, y1: 14.5, h: 16.5 }; // the swimmable box (the glass walls sit a little outside)
  const VENTS = [[-9.5, -6], [10, -4.5], [0.5, 10.5]];
  const PH = [ // per phase
    { tell: 0.8, snaps: 1, bubbles: 1, bSpd: 6, home: 0, rear: 2.6, idle: [1.3, 2.1], drain: 1 / 30, speed: 1.6 },
    { tell: 0.66, snaps: 2, bubbles: 3, bSpd: 7, home: 0, rear: 2.2, idle: [1.0, 1.7], drain: 1 / 25, speed: 2.1 },
    { tell: 0.55, snaps: 3, bubbles: 5, bSpd: 7.5, home: 0.7, rear: 1.9, idle: [0.7, 1.3], drain: 1 / 21, speed: 2.6 },
  ];
  const HPB = 300, HIT = 20; // 5 belly hits a phase, at most 2 per rear
  const J = { scene: null, cam: null, title: 'BIG JIMMY', pips: 3,
    hint: '<b>WASD</b> swim · <b>SPACE</b> up · <b>SHIFT</b> down · <b>J</b> strike · <b>K</b> dash',
    labels: { a: 'STRIKE', b: 'DASH', c: 'STRIKE', l: '&#9660; DOWN', r: 'UP &#9650;' } };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let U_T = { value: 0 };

  // ---------------- materials with caustics (the sand, rocks and vents) and swaying kelp ----------------
  const CAU = `float cau(vec2 uv, float t) { vec2 p = mod(uv, 6.28318) - 250.0; vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 4; n++) { float tt = t * (1.0 - (3.5 / float(n + 1))); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten))); }
      c /= 4.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }`;
  function cauMat(opts, k = 1) {
    const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts));
    m.onBeforeCompile = (sh) => { sh.uniforms.uT = U_T;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT;\n' + CAU)
        .replace('#include <opaque_fragment>', `{ float up = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0); float cc = cau(vWP.xz * 0.42 + vec2(vWP.y * 0.2), uT * 0.55);
          outgoingLight += vec3(0.62, 0.92, 1.0) * cc * (0.35 + 0.65 * up) * ${k.toFixed(2)} * (0.6 + diffuseColor.r); }
        #include <opaque_fragment>`); };
    m.customProgramCacheKey = () => 'jcau' + k; return m;
  }
  function kelpMat() {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => { sh.uniforms.uT = U_T;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 kw; uniform float uT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat w = kw.x * kw.x; transformed.x += sin(uT * 1.1 + kw.y + position.y * 0.45) * 0.9 * w; transformed.z += cos(uT * 0.8 + kw.y * 1.7 + position.y * 0.3) * 0.6 * w;'); };
    m.customProgramCacheKey = () => 'jkelp'; return m;
  }

  // ---------------- the tank ----------------
  function buildTank(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    // glass walls + back rockwork: one back-faced box with a depth gradient (lighter up top, deep blue below), window mullions painted in
    const wall = new THREE.BoxGeometry(TANK.x * 2 + 3, TANK.h + 1, TANK.z * 2 + 3, 8, 8, 8).toNonIndexed(); const wp = wall.attributes.position, wc = new Float32Array(wp.count * 3);
    for (let i = 0; i < wp.count; i++) { const y = (wp.getY(i) + (TANK.h + 1) / 2) / (TANK.h + 1), x = wp.getX(i), z = wp.getZ(i);
      const mull = (Math.abs(((x + z) / 6.3) % 1) < 0.05) ? 0.7 : 1; const c = new THREE.Color().setHSL(0.55, 0.65, (0.08 + y * 0.32) * mull); wc.set([c.r, c.g, c.b], i * 3); }
    wall.setAttribute('color', new THREE.BufferAttribute(wc, 3)); wall.translate(0, (TANK.h + 1) / 2 - 0.5, 0);
    sc.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: true })));
    // sand floor with dunes + ripples
    const fl = new THREE.PlaneGeometry(TANK.x * 2 + 3, TANK.z * 2 + 3, 40, 40); fl.rotateX(-Math.PI / 2); const fp = fl.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); fp.setY(i, Math.sin(x * 0.35) * 0.25 + Math.cos(z * 0.27 + x * 0.1) * 0.35 + Math.sin((x + z) * 1.7) * 0.05 + Math.max(0, Math.hypot(x, z) - 14) * 0.25); }
    fl.computeVertexNormals(); bakeColor(fl, '#c9b98c');
    const sandM = cauMat({}, 1.25); sc.add(new THREE.Mesh(fl, sandM));
    // rocks along the walls + coral heads + the three bubble vents (rock rings with a dark throat), all one mesh
    const R = K(); SEED = 41;
    for (let i = 0; i < 46; i++) { const a = srnd() * TAU, edge = srnd() < 0.75; const r = edge ? 14 + srnd() * 3 : 4 + srnd() * 8; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!edge && VENTS.some((v) => Math.hypot(v[0] - x, v[1] - z) < 3)) continue; const s = edge ? 1.2 + srnd() * 2.6 : 0.5 + srnd() * 1.1;
      R.add(new THREE.DodecahedronGeometry(1, 0), ['#6a6658', '#7e7462', '#5a5e5a', '#8a6f5a'][i % 4], clamp(x, -17, 17), s * 0.3, clamp(z, -17, 17), srnd() * 3, srnd() * 3, 0, s, s * (0.6 + srnd() * 0.7), s); }
    for (let i = 0; i < 14; i++) { const a = srnd() * TAU, r = 6 + srnd() * 8; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (VENTS.some((v) => Math.hypot(v[0] - x, v[1] - z) < 2.6)) continue;
      const col = ['#e86a5a', '#f0a050', '#c860a8', '#f4d070'][i % 4]; for (let k = 0; k < 4; k++) R.add(G.cyl(0.08, 0.16, 1.2 + srnd(), 5), col, x + rnd(-0.4, 0.4), 0.6, z + rnd(-0.4, 0.4), rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6));
      R.add(G.sph(0.55, 8, 6), col, x, 0.3, z, 0, 0, 0, 1, 0.6, 1); }
    for (const [x, z] of VENTS) { for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; R.add(new THREE.DodecahedronGeometry(0.55, 0), '#5a544a', x + Math.cos(a) * 0.95, 0.35, z + Math.sin(a) * 0.95, k, k * 2, 0, 1, 0.9, 1); }
      R.add(G.cyl(0.62, 0.7, 0.3, 10), '#15202a', x, 0.45, z); }
    sc.add(R.mesh(cauMat({}, 0.9), null, 0));
    // kelp: ribbons rooted on the floor, swaying in the vertex shader (kw.x = height fraction, kw.y = phase)
    const strands = []; SEED = 77;
    for (let i = 0; i < 30; i++) { const a = srnd() * TAU, r = i < 18 ? 12.5 + srnd() * 3 : 5 + srnd() * 7; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (VENTS.some((v) => Math.hypot(v[0] - x, v[1] - z) < 2.5)) continue;
      const h = 5 + srnd() * 8, g = new THREE.PlaneGeometry(0.55, h, 1, 10).toNonIndexed(); g.translate(0, h / 2, 0); g.rotateY(srnd() * Math.PI); g.translate(x, 0, z);
      const p = g.attributes.position, kw = new Float32Array(p.count * 2), ph = srnd() * 6, c = new Float32Array(p.count * 3), base = new THREE.Color(['#3c7a2e', '#4f8a32', '#2f6a3a', '#6a8a2a'][i % 4]);
      for (let k = 0; k < p.count; k++) { const f = p.getY(k) / h; kw[k * 2] = f; kw[k * 2 + 1] = ph; p.setX(k, p.getX(k) + Math.sin(f * 7 + ph) * 0.12); const cc = base.clone().multiplyScalar(0.6 + f * 0.7); c.set([cc.r, cc.g, cc.b], k * 3); }
      g.setAttribute('kw', new THREE.BufferAttribute(kw, 2)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); strands.push(g); }
    const kg = mergeGeos(strands); sc.add(new THREE.Mesh(kg, kelpMat()));
    // light shafts from the surface (additive gradient quads) + the bright rippling surface seen from below
    const shT = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(210,250,255,0.9)'); gr.addColorStop(1, 'rgba(210,250,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); }, 128);
    const sh = []; SEED = 9; for (let i = 0; i < 9; i++) { const g = new THREE.PlaneGeometry(2.2 + srnd() * 2.5, 17); g.translate(0, -8.5, 0); g.rotateZ((srnd() - 0.5) * 0.35); g.rotateY(srnd() * Math.PI); g.translate(-12 + srnd() * 24, TANK.h, -12 + srnd() * 24); sh.push(g); }
    J.shafts = new THREE.Mesh(mergeGeos(sh), new THREE.MeshBasicMaterial({ map: shT, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    sc.add(J.shafts);
    const surT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2f8fb0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(220,255,255,0.85)'; g.lineWidth = 5; SEED = 3;
      for (let i = 0; i < 60; i++) { const x = srnd() * w, y = srnd() * h, r = 12 + srnd() * 26; g.beginPath(); g.ellipse(x, y, r, r * 0.7, srnd() * 3, 0, TAU); g.stroke(); } }, 256);
    surT.wrapS = surT.wrapT = THREE.RepeatWrapping; surT.repeat.set(3, 3); J.surT = surT;
    const sur = new THREE.Mesh(new THREE.PlaneGeometry(TANK.x * 2 + 3, TANK.z * 2 + 3), new THREE.MeshBasicMaterial({ map: surT, fog: false, side: THREE.DoubleSide }));
    sur.rotation.x = Math.PI / 2; sur.position.y = TANK.h - 0.05; sc.add(sur);
  }
  function mergeGeos(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count; const out = new THREE.BufferGeometry();
    for (const name of Object.keys(list[0].attributes)) { const sz = list[0].attributes[name].itemSize, a = new Float32Array(n * sz); let o = 0; for (const g of list) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(a, sz)); }
    for (const g of list) g.dispose(); out.computeBoundingSphere(); return out;
  }

  // ---------------- bubbles: one Points cloud (ambient risers, the vent columns, mouth froth + hit bursts) ----------------
  const NB = 420, NAMB = 150, NVENT = 3 * 55;
  const BUB = { pos: new Float32Array(NB * 3), v: new Float32Array(NB * 3), life: new Float32Array(NB), next: NAMB + NVENT, pts: null };
  function buildBubbles(sc) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(BUB.pos, 3));
    BUB.pts = new THREE.Points(g, new THREE.PointsMaterial({ map: DUELS.dot('#e8fcff', false), size: 0.22, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
    BUB.pts.frustumCulled = false; sc.add(BUB.pts); SEED = 5;
    for (let i = 0; i < NB; i++) { BUB.life[i] = 0; BUB.pos[i * 3 + 1] = -50; }
    for (let i = 0; i < NAMB; i++) { BUB.pos.set([rnd(-15, 15), rnd(0, 16), rnd(-15, 15)], i * 3); BUB.v[i * 3 + 1] = rnd(0.6, 1.4); BUB.life[i] = 1; }
    for (let i = 0; i < NVENT; i++) { const v = VENTS[i % 3]; BUB.pos.set([v[0], rnd(0, 13), v[1]], (NAMB + i) * 3); BUB.v[(NAMB + i) * 3 + 1] = rnd(2.2, 3.6); BUB.life[NAMB + i] = 1; }
  }
  function burst(p, n, spd = 2, up = 1.5) { for (let k = 0; k < n; k++) { const i = BUB.next; BUB.next = BUB.next + 1 >= NB ? NAMB + NVENT : BUB.next + 1;
    BUB.pos.set([p.x + rnd(-0.3, 0.3), p.y + rnd(-0.3, 0.3), p.z + rnd(-0.3, 0.3)], i * 3); BUB.v.set([rnd(-spd, spd), rnd(0, spd) + up, rnd(-spd, spd)], i * 3); BUB.life[i] = rnd(0.8, 1.6); } }
  function stepBubbles(dt) {
    const P = BUB.pos, Vv = BUB.v, t = U_T.value;
    for (let i = 0; i < NB; i++) { const o = i * 3;
      if (i < NAMB) { P[o + 1] += Vv[o + 1] * dt; P[o] += Math.sin(t * 2 + i) * 0.25 * dt; if (P[o + 1] > TANK.h - 0.3) { P[o + 1] = 0.2; P[o] = rnd(-15, 15); P[o + 2] = rnd(-15, 15); } }
      else if (i < NAMB + NVENT) { const v = VENTS[(i - NAMB) % 3]; const on = J.ventOn((i - NAMB) % 3); P[o + 1] += Vv[o + 1] * dt; const y = P[o + 1];
        P[o] = v[0] + Math.sin(t * 3 + i * 1.7) * (0.25 + y * 0.03); P[o + 2] = v[1] + Math.cos(t * 2.6 + i) * (0.25 + y * 0.03);
        if (y > TANK.h - 0.3) { P[o + 1] = on ? 0.4 : -50; } else if (y < -10 && on && Math.random() < dt * 2) P[o + 1] = 0.4; }
      else if (BUB.life[i] > 0) { BUB.life[i] -= dt; Vv[o + 1] += 2.5 * dt; Vv[o] *= 1 - 2 * dt; Vv[o + 2] *= 1 - 2 * dt; P[o] += Vv[o] * dt; P[o + 1] += Vv[o + 1] * dt; P[o + 2] += Vv[o + 2] * dt; if (BUB.life[i] <= 0) P[o + 1] = -50; } }
    BUB.pts.geometry.attributes.position.needsUpdate = true;
  }

  // ---------------- Big Jimmy stand-in rig (procedural blue crab, ~8 m across the claws) ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), claws: [], legs: [], flash: [] };
    const bodyM = toonMat(), clawM = [toonMat(), toonMat()], softM = toonMat(); R.flash = [bodyM, ...clawM]; R.softM = softM;
    const pitch = new THREE.Group(); R.root.add(pitch); R.pitch = pitch; // rearing pivots here (at the back edge, low)
    const body = new THREE.Group(); body.position.set(0, 0, 0); pitch.add(body); R.body = body;
    const B = K();
    B.add(G.sph(1, 20, 12), '#3f78b0', 0, 0, 0, 0, 0, 0, 3.0, 0.85, 2.0)          // carapace
      .add(G.sph(1, 16, 10), '#5a92c8', 0, 0.22, 0.1, 0, 0, 0, 2.4, 0.55, 1.6)     // the lighter crown
      .add(G.sph(1, 18, 8), '#efe4c6', 0, -0.2, 0, 0, 0, 0, 2.85, 0.6, 1.9);       // underside rim
    for (const s of [-1, 1]) { B.add(G.cone(0.42, 2.1, 7), '#2f6496', s * 3.6, 0.05, 0.35, 0, 0, -s * Math.PI / 2, 1, 1, 0.8); // the lateral spines
      for (let k = 0; k < 7; k++) B.add(G.cone(0.13, 0.45, 5), '#2f5f8e', s * (0.6 + k * 0.38), 0.12, 1.55 + Math.sin(k * 0.4) * 0.25 - k * 0.12, 0.9, 0, 0); // front teeth
      B.add(G.cyl(0.08, 0.1, 0.7, 6), '#3f78b0', s * 0.55, 0.55, 1.65, -0.3, 0, s * 0.15).add(G.sph(0.24, 10, 8), '#14101f', s * 0.62, 0.92, 1.8).add(G.sph(0.08, 6, 5), '#ffffff', s * 0.68, 1.0, 1.98); } // eye stalks
    B.add(G.box(0.9, 0.25, 0.3), '#c46a3a', 0, -0.1, 1.95).add(G.box(1.3, 0.12, 0.12), '#14101f', 0, 0.06, 1.98); // mouth parts + the scowl
    B.mesh(bodyM, body);
    // soft underside: the apron (the T-shaped belly plate) on its own material so it can glow
    const A = K(); A.add(G.sph(1, 14, 8), '#f4ecd6', 0, -0.66, 0.1, 0, 0, 0, 1.7, 0.22, 1.6).add(G.box(0.7, 0.14, 1.9), '#ead9b6', 0, -0.84, 0.0);
    A.mesh(softM, body); R.soft = new THREE.Object3D(); R.soft.position.set(0, -0.9, 0); body.add(R.soft);
    R.mouth = new THREE.Object3D(); R.mouth.position.set(0, -0.05, 2.2); body.add(R.mouth);
    // claws: shoulder group at the front corner > arm (two segments) > the pincer (fixed top finger + hinged lower finger)
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 2.1, -0.05, 1.3); body.add(sh);
      const a = K(); a.add(G.cyl(0.32, 0.38, 2.0, 8), '#3f78b0', 0, 0, 1.0, Math.PI / 2, 0, 0).add(G.sph(0.42, 10, 8), '#5a92c8', 0, 0, 0).add(G.sph(0.4, 10, 8), '#5a92c8', 0, 0, 2.0)
        .add(G.cone(0.12, 0.4, 5), '#2f5f8e', s * 0.32, 0.12, 1.3, 0, 0, -s * 1.3);
      a.mesh(clawM[s < 0 ? 0 : 1], sh);
      const hand = new THREE.Group(); hand.position.set(0, 0, 2.0); sh.add(hand);
      const top = K(); top.add(G.sph(1, 14, 10), '#4a86c0', 0, 0, 0.75, 0, 0, 0, 0.75, 0.62, 1.05).add(G.cone(0.32, 1.7, 8), '#4a86c0', 0, 0.12, 2.3, Math.PI / 2, 0, 0, 1, 1, 0.75)
        .add(G.cone(0.2, 0.55, 6), '#f4f0e6', 0, 0.12, 3.25, Math.PI / 2, 0, 0).add(G.box(0.12, 0.1, 1.2), '#f4f0e6', 0, -0.12, 2.3);
      const tm = top.mesh(clawM[s < 0 ? 0 : 1], hand);
      const bot = new THREE.Group(); bot.position.set(0, -0.35, 1.5); hand.add(bot);
      const bm = K(); bm.add(G.cone(0.26, 1.6, 7), '#4a86c0', 0, 0, 0.8, Math.PI / 2, 0, 0, 1, 0.75, 1).add(G.cone(0.16, 0.45, 6), '#f4f0e6', 0, 0, 1.75, Math.PI / 2, 0, 0).add(G.box(0.1, 0.1, 1.0), '#f4f0e6', 0, 0.12, 0.9);
      bm.mesh(clawM[s < 0 ? 0 : 1], bot);
      const tip = new THREE.Object3D(); tip.position.set(0, 0, 3.0); hand.add(tip);
      R.claws.push({ sh, arm: sh, hand, top: tm, bot, tip, s });
    }
    // legs: three walking legs + the swimming paddle on each side, one mesh a side, fluttered as a whole
    for (const s of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(s * 1.8, -0.3, -0.2); body.add(lg); const L = K();
      for (let k = 0; k < 3; k++) { const z = 0.6 - k * 0.6; L.add(G.cyl(0.1, 0.13, 1.6, 6), '#3f78b0', s * 0.75, -0.2, z, 0, 0, s * 1.1).add(G.cyl(0.07, 0.1, 1.4, 6), '#4a86c0', s * 1.65, -0.85, z - 0.1, 0.1, 0, s * 0.35); }
      L.add(G.cyl(0.1, 0.13, 1.5, 6), '#3f78b0', s * 0.7, -0.15, -1.4, 0, 0, s * 1.1).add(G.sph(1, 10, 6), '#5a92c8', s * 1.5, -0.5, -1.6, 0.3, 0, s * 0.6, 0.55, 0.08, 0.38);
      L.mesh(bodyM, lg); R.legs.push(lg); }
    return R;
  }

  // ---------------- build ----------------
  J.build = function () {
    const sc = (J.scene = new THREE.Scene()); sc.background = new THREE.Color('#0d4460'); sc.fog = new THREE.FogExp2('#0f5272', 0.03);
    J.cam = new THREE.PerspectiveCamera(62, VW() / VH(), 0.1, 120);
    DUELS.sceneLights(sc, '#a8e6ff', '#2a4a50', 1.5, '#e8fbff', 1.7, new THREE.Vector3(0.3, 1, 0.2));
    buildTank(sc); buildBubbles(sc);
    // bubble blasts: one instanced mesh
    J.blasts = []; J.blastM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 14, 10), new THREE.MeshLambertMaterial({ color: '#c8f4ff', emissive: '#2a7aa0', transparent: true, opacity: 0.62, depthWrite: false }), 16);
    J.blastM.count = 0; J.blastM.frustumCulled = false; sc.add(J.blastM);
    // Harold (his own copy of the hero rig)
    J.H = buildHero(); sc.add(J.H.root);
    // Big Jimmy: the O-batch rig if it is in, else the stand-in
    let rig = null; try { if (typeof window.buildBigJimmy === 'function') rig = window.buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    J.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    rig.claws = rig.claws || []; rig.legs = rig.legs || []; rig.flash = rig.flash || []; rig.pitch = rig.pitch || rig.root; rig.body = rig.body || rig.root;
    if (!rig.soft) { rig.soft = new THREE.Object3D(); rig.soft.position.set(0, -0.9, 0); rig.body.add(rig.soft); } if (!rig.mouth) { rig.mouth = new THREE.Object3D(); rig.mouth.position.set(0, 0, 2.2); rig.body.add(rig.mouth); }
    J.R = rig; sc.add(rig.root);
    // the soft-spot marker: a gold glow ring under him while he rears
    J.ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 28), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sc.add(J.ring); J.ring.visible = false;
  };
  J.ventOn = (i) => !(J.st && J.st.phase === 2 && Math.floor(J.st.t / 9) % 3 === i); // phase 3: one vent sleeps at a time (9 s each)

  // ---------------- state ----------------
  function reset(phase) {
    const st = J.st = { t: 0, phase, bhp: HPB - phase * 100, hp: 100, air: 1, p: new THREE.Vector3(0, 4.5, -10), v: new THREE.Vector3(), yaw: 0, pitch: 0,
      inv: 0, dashCd: 0, dashT: 0, atkT: -1, atkCd: 0, hitDone: false, hurtT: 0, swimT: 0, drownT: 0,
      bp: new THREE.Vector3(0, 5, 5), byaw: Math.PI, bs: 'intro', bt: 0, bdur: 2.6, combo: 0, side: 1, snapTo: new THREE.Vector3(), rear: 0, roar: 0, lungeV: new THREE.Vector3(),
      over: false, won: false, stats: { snaps: 0, snapHits: 0, bubbles: 0, bubbleHits: 0, strikes: 0, softHits: 0, clangs: 0, dashes: 0, ventT: 0, airOut: 0, phaseUps: 0 } };
    J.blasts.length = 0; J.blastM.count = 0; J.ring.visible = false;
    DUELS.bars(1, st.bhp / HPB); return st;
  }
  J.start = function () {
    const st = reset(0); J.stats0 = st.stats; DUELS.log.push('jimmy:' + J.rigKind);
    DUELS.sub('<div class="air"><div class="n">AIR</div><div class="t"><i></i></div></div>', 'PHASE 1/3'); J.airEl = DUELS.hudEl.querySelector('.air'); J.airI = J.airEl.querySelector('i');
    const L = LANDMARKS.find((l) => l.id === 'aquarium'), lines = L && L.boss && L.boss.lines;
    DUELS.banner('BIG JIMMY<small>NATIONAL AQUARIUM · THE BIG TANK</small>', 2.4);
    if (lines) DUELS.say('BIG JIMMY', lines.intro[Math.floor(Math.random() * lines.intro.length)], 3.2);
    J.camP = new THREE.Vector3(0, 12, -18); J.camL = new THREE.Vector3(0, 4, 0);
  };
  J.retry = function () { const ph = J.st.phase; reset(ph); J.st.bs = 'idle'; J.st.bdur = 1.2; DUELS.sub(J.airEl.outerHTML, 'PHASE ' + (ph + 1) + '/3'); J.airEl = DUELS.hudEl.querySelector('.air'); J.airI = J.airEl.querySelector('i'); DUELS.banner('ROUND AGAIN!<small>PHASE ' + (ph + 1) + ' · FULL AIR</small>', 1.6); };
  J.exit = function () {};

  // ---------------- audio: a little blub ----------------
  function blub(f = 380) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.12);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + 0.18); } catch (e) {} }

  // ---------------- the fight ----------------
  function lockFrame(st) { V.set(st.bp.x - st.p.x, 0, st.bp.z - st.p.z); if (V.lengthSq() < 1e-4) V.set(0, 0, 1); V.normalize(); return { f: V.clone(), r: new THREE.Vector3(V.z, 0, -V.x).multiplyScalar(-1) }; }
  function hurtHarold(st, dmg, from, kind) {
    if (st.inv > 0 || st.over) return false; st.hp -= dmg; st.inv = 0.9; st.hurtT = 0.35; DUELS.hurt(); sfx('hurt');
    V2.copy(st.p).sub(from); V2.y *= 0.5; if (V2.lengthSq() < 1e-4) V2.set(0, 0, -1); st.v.addScaledVector(V2.normalize(), 9); J.H.mat.userData.flash.value = 1; J.hflash = 1;
    burst(st.p, 10, 2.5); if (kind) st.stats[kind]++; return true;
  }
  function setB(st, s, dur) { st.bs = s; st.bt = 0; st.bdur = dur; }
  function bossThink(st, dt) {
    const P = PH[st.phase]; st.bt += dt; const toH = V3.copy(st.p).sub(st.bp), dist = toH.length();
    // face Harold (not while rearing / dead)
    if (st.bs !== 'rear' && st.bs !== 'dead' && st.bs !== 'roar') { const want = Math.atan2(toH.x, toH.z); st.byaw += angTo(st.byaw, want) * Math.min(1, dt * (st.bs === 'snap' ? 2 : 3.2)); }
    // drift: hold ~5.5 m from Harold at about his height (closing in when far)
    if (st.bs === 'idle' || st.bs === 'bubbleTell' || st.bs === 'snapTell') {
      const want = V2.copy(st.p).addScaledVector(toH.clone().normalize(), -(st.bs === 'snapTell' ? 4.6 : 5.6)); want.y = clamp(st.p.y + 0.4, 2.5, TANK.y1 - 2.5);
      const sp = P.speed * (dist > 10 ? 1.8 : 1); V2.sub(st.bp); const l = V2.length(); if (l > 0.05) st.bp.addScaledVector(V2, Math.min(1, sp * dt / l)); }
    if (st.bs === 'intro') { if (st.bt > st.bdur) setB(st, 'idle', 1.0); return; }
    if (st.bs === 'idle') { if (st.bt > st.bdur) {
      if (st.combo > 0) { st.side = -st.side; setB(st, 'snapTell', P.tell); return; }
      const r = Math.random(); if (dist > 9 && r < 0.55) { setB(st, 'bubbleTell', P.tell + 0.15); return; }
      if (r < 0.62) { st.combo = P.snaps; st.side = Math.random() < 0.5 ? -1 : 1; setB(st, 'snapTell', P.tell); } else setB(st, 'bubbleTell', P.tell + 0.15); }
      return; }
    if (st.bs === 'snapTell') { if (st.bt > st.bdur) { st.snapTo.copy(st.p); st.lungeV.copy(st.p).sub(st.bp).setY(0).normalize().multiplyScalar(7); setB(st, 'snap', 0.42); st.stats.snaps++; st.snapHit = false; sfx('swing'); } return; }
    if (st.bs === 'snap') { const u = st.bt / st.bdur; if (u < 0.6) st.bp.addScaledVector(st.lungeV, dt);
      const c = J.R.claws[st.side < 0 ? 0 : 1]; if (c && u > 0.25 && u < 0.85 && !st.snapHit) { c.tip.getWorldPosition(V2); if (V2.distanceTo(st.p) < 2.1 || (st.p.distanceTo(st.bp) < 3.6)) { if (hurtHarold(st, 22, st.bp, 'snapHits')) { st.snapHit = true; sfx('heavy'); DUELS.tell('SNAP!', 0.6); } } }
      if (st.bt > st.bdur) { st.combo--; if (st.combo > 0) setB(st, 'idle', 0.25); else { setB(st, 'rear', P.rear); st.rearHits = 0; st.combo = 0; DUELS.tell('HE REARS UP! STRIKE HIS BELLY!', 1.4); sfx('ko'); } } return; }
    if (st.bs === 'rear') { if (st.bt > st.bdur) setB(st, 'idle', rnd(...P.idle)); return; }
    if (st.bs === 'bubbleTell') { if (Math.random() < dt * 30) { J.R.mouth.getWorldPosition(V2); burst(V2, 1, 0.8, 0.5); } if (st.bt > st.bdur) { fireBubbles(st, P); setB(st, 'idle', rnd(...P.idle)); } return; }
    if (st.bs === 'roar') { if (st.bt > st.bdur) setB(st, 'idle', 0.8); return; }
    if (st.bs === 'dead') { st.bp.y = Math.max(1.6, st.bp.y - dt * 1.2); return; }
  }
  function fireBubbles(st, P) {
    J.R.mouth.getWorldPosition(V2); const dir = V3.copy(st.p).sub(V2).normalize(), n = P.bubbles; st.stats.bubbles += n; blub(240);
    for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.28; const d = dir.clone().applyAxisAngle(UP, a); if (J.blasts.length < 16) J.blasts.push({ p: V2.clone(), v: d.multiplyScalar(P.bSpd), t: 0, home: P.home, r: 0.6 }); }
  }
  function stepBlasts(st, dt) {
    for (let i = J.blasts.length - 1; i >= 0; i--) { const b = J.blasts[i]; b.t += dt;
      if (b.home > 0 && b.t < 2) { const want = V2.copy(st.p).sub(b.p).normalize().multiplyScalar(b.v.length()); b.v.lerp(want, Math.min(1, b.home * dt)); }
      b.p.addScaledVector(b.v, dt); b.r = 0.6 + Math.sin(b.t * 12) * 0.05;
      let gone = b.t > 4.5 || Math.abs(b.p.x) > TANK.x + 1 || Math.abs(b.p.z) > TANK.z + 1 || b.p.y < 0 || b.p.y > TANK.h;
      if (!gone && b.p.distanceTo(st.p) < 1.05) { if (hurtHarold(st, 12, b.p, 'bubbleHits')) blub(520); gone = true; }
      if (gone) { burst(b.p, 8, 2); J.blasts.splice(i, 1); } }
    J.blastM.count = J.blasts.length; J.blastM.visible = J.blasts.length > 0; const m = new THREE.Matrix4(); J.blasts.forEach((b, i) => { m.makeScale(b.r, b.r, b.r).setPosition(b.p); J.blastM.setMatrixAt(i, m); }); J.blastM.instanceMatrix.needsUpdate = true;
  }
  function damageBoss(st) {
    st.bhp -= HIT; st.stats.softHits++; J.R.softM && (J.R.softM.userData.flash.value = 1); sfx('heavy'); DUELS.tell('BELLY HIT!', 0.6); burst(st.bp, 12, 3); DUELS.impact({ stop: 0.07, shake: 0.3, sfx: 'heavy', pop: String(HIT), pos: st.bp.clone().setY(st.bp.y + 1.2), cls: 'crit' }); // chipkid-fun: shared core hit juice
    const floor = HPB - (st.phase + 1) * 100; st.rearHits = (st.rearHits || 0) + 1;
    if (st.rearHits >= 2 && st.bhp > floor) { setB(st, 'idle', rnd(...PH[st.phase].idle)); DUELS.tell('HE SLAMS DOWN! TWO HITS A REAR', 0.9); } // two belly hits per rear
    if (st.bhp <= floor) { st.bhp = floor;
      if (st.phase === 2) { st.bs = 'dead'; st.bt = 0; st.won = true; st.over = true; win(st); }
      else { st.phase++; st.stats.phaseUps++; setB(st, 'roar', 2.0); st.combo = 0; J.blasts.length = 0; st.air = Math.max(st.air, 0.75);
        DUELS.banner(st.phase === 1 ? 'PHASE 2<small>JIMMY\'S GETTING STEAMED!</small>' : 'PHASE 3<small>ONE VENT SLEEPS AT A TIME!</small>', 1.8); DUELS.sub(J.airEl.outerHTML, 'PHASE ' + (st.phase + 1) + '/3'); J.airEl = DUELS.hudEl.querySelector('.air'); J.airI = J.airEl.querySelector('i'); } }
  }
  function win(st) {
    const L = LANDMARKS.find((l) => l.id === 'aquarium'), lines = L && L.boss && L.boss.lines; if (lines) DUELS.say('BIG JIMMY', lines.defeat[Math.floor(Math.random() * lines.defeat.length)], 4);
    DUELS.banner('TANK CLEARED!<small>BIG JIMMY IS BEATEN</small>', 3); sfx('ko'); DUELS.bossCleared('aquarium', 'jimmy-swim');
    setTimeout(() => { if (DUELS.cur === J) DUELS.over('win', 'BIG JIMMY<br>DEFEATED', 'The Aquarium is clear. Crime at the National Aquarium: 0.'); }, SIM ? 400 : 2600);
  }
  function lose(st, why) { st.over = true; sfx('ko'); DUELS.over('lose', why === 'air' ? 'OUT OF AIR!' : 'STEAMED!', 'Big Jimmy got the best of Harold. Retry from phase ' + (st.phase + 1) + ' with full health and air.'); DUELS.log.push('jimmy:lose:' + why); }

  J.step = function (dt, I) {
    const st = J.st; if (!st) return; st.t += dt; U_T.value += dt; const P = PH[st.phase];
    if (!st.over) {
      // ---- Harold swims (lock-on frame: stick X circles Jimmy, stick Y closes in / backs off, UP / DOWN rise and sink)
      const { f, r } = lockFrame(st); const want = new THREE.Vector3().addScaledVector(r, I.mx).addScaledVector(f, I.my); want.y = (I.up ? 1 : 0) - (I.down ? 1 : 0);
      want.multiplyScalar(5.2); if (want.y) want.y *= 0.8;
      st.v.lerp(want, 1 - Math.exp(-3.2 * dt));
      st.dashCd -= dt; st.inv -= dt; st.dashT -= dt; st.atkCd -= dt; st.hurtT -= dt;
      if (I.b && st.dashCd <= 0) { const d = want.lengthSq() > 0.01 ? want.clone().normalize() : f.clone().multiplyScalar(-1); st.v.addScaledVector(d, 13); st.dashCd = 0.75; st.dashT = 0.3; st.inv = Math.max(st.inv, 0.42); st.stats.dashes++; burst(st.p, 8, 1.5); blub(300); }
      st.p.addScaledVector(st.v, dt);
      st.p.x = clamp(st.p.x, -TANK.x, TANK.x); st.p.z = clamp(st.p.z, -TANK.z, TANK.z); st.p.y = clamp(st.p.y, TANK.y0, TANK.y1);
      // body collision with Jimmy
      V2.copy(st.p).sub(st.bp); const dd = V2.length(); const br = st.bs === 'rear' ? 2.3 : 3.0; if (dd < br && dd > 1e-3 && st.bs !== 'dead') st.p.addScaledVector(V2, (br - dd) / dd);
      // facing: toward Jimmy
      V2.copy(st.bp).sub(st.p); st.yaw += angTo(st.yaw, Math.atan2(V2.x, V2.z)) * Math.min(1, dt * 8); st.pitch = damp(st.pitch, clamp(Math.atan2(V2.y, Math.hypot(V2.x, V2.z)), -0.7, 0.7), 6, dt);
      // ---- strike
      if ((I.a || I.c) && st.atkCd <= 0) { st.atkT = 0; st.atkCd = 0.42; st.hitDone = false; st.stats.strikes++; sfx('swing'); }
      if (st.atkT >= 0) { st.atkT += dt; if (st.atkT > 0.12 && !st.hitDone) { st.hitDone = true;
          V2.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)).multiplyScalar(1.1).add(st.p); J.R.soft.getWorldPosition(V3);
          if (st.bs === 'rear' && V2.distanceTo(V3) < 2.6) damageBoss(st);
          else if (V2.distanceTo(st.bp) < 4.2) { st.stats.clangs++; sfx('hit'); DUELS.tell('CLANG! WAIT FOR HIM TO REAR UP', 0.8); V3.copy(st.p).sub(st.bp).normalize(); st.v.addScaledVector(V3, 4); } }
        if (st.atkT > 0.4) st.atkT = -1; }
      // ---- air: drains, vents refill (stand in the bubble column)
      let inVent = false; VENTS.forEach((v, i) => { if (J.ventOn(i) && Math.hypot(st.p.x - v[0], st.p.z - v[1]) < 1.8 && st.p.y < TANK.y1 - 0.5) inVent = true; });
      if (inVent) { st.air = Math.min(1, st.air + dt * 0.5); st.stats.ventT += dt; if (Math.random() < dt * 6) blub(600 + Math.random() * 300); }
      else st.air = Math.max(0, st.air - P.drain * dt);
      if (st.air <= 0) { st.hp -= 9 * dt; st.drownT += dt; st.stats.airOut += dt; if (Math.random() < dt * 3) DUELS.hurt(); }
      if (st.hp <= 0) { st.hp = 0; lose(st, st.air <= 0 ? 'air' : 'hit'); }
    }
    bossThink(st, dt); stepBlasts(st, dt); stepBubbles(dt);
    st.bp.x = clamp(st.bp.x, -TANK.x + 2, TANK.x - 2); st.bp.z = clamp(st.bp.z, -TANK.z + 2, TANK.z - 2); st.bp.y = clamp(st.bp.y, 1.6, TANK.y1 - 1.5);
    DUELS.bars(st.hp / 100, st.bhp / HPB);
    if (J.airI) { J.airI.style.width = (st.air * 100).toFixed(1) + '%'; const low = st.air < 0.3; if (low !== J.airLow) { J.airLow = low; J.airEl.classList.toggle('low', low); } }
  };

  // ---------------- poses + render ----------------
  function swimPose(t, st) {
    let p;
    if (st.atkT >= 0) { p = HERO_POSES.atk1(clamp(st.atkT / 0.4, 0, 1)); p.tilt = [0.55 - st.pitch * 0.6, 0, 0]; p.lgL = [0.35 + Math.sin(t * 9) * 0.3, 0, 0.1]; p.lgR = [0.35 - Math.sin(t * 9) * 0.3, 0, -0.1]; return p; }
    if (st.hurtT > 0) { p = HERO_POSES.hurt(1 - st.hurtT / 0.35); p.tilt = [0.3, 0, 0]; return p; }
    if (st.over && !st.won) { p = HERO_POSES.down(1, false); p.tilt = [-1.2, 0, 0.3]; return p; }
    p = blank(); const sp = st.v.length(), k = Math.min(1, sp / 5), ph = t * (4 + k * 6);
    p.tilt = [0.25 + k * 0.95 - st.pitch * 0.7, 0, 0];
    p.lgL = [0.25 + Math.sin(ph) * 0.55 * (0.4 + k), 0, 0.12]; p.lgR = [0.25 - Math.sin(ph) * 0.55 * (0.4 + k), 0, -0.12]; p.knL = [0.5 + Math.max(0, Math.sin(ph)) * 0.5, 0, 0]; p.knR = [0.5 + Math.max(0, -Math.sin(ph)) * 0.5, 0, 0];
    const st2 = Math.sin(t * 3.2); p.shL = [-1.3 - st2 * 0.9 * (0.3 + k), 0, 0.7 + st2 * 0.3]; p.elL = [-0.4, 0, 0]; p.shR = [-1.0 + st2 * 0.5, 0, -0.5]; p.elR = [-0.6, 0, 0]; p.swR = [Math.PI / 2 + 0.6, 0, 0]; p.swL = [Math.PI / 2, 0, 0];
    p.neck = [-0.5 * k + st.pitch * 0.3, 0, 0]; p.y = Math.sin(t * 2) * 0.05; return p;
  }
  function poseBoss(st, dt) {
    const R = J.R, t = st.t, u = st.bt / Math.max(0.01, st.bdur);
    R.root.position.copy(st.bp); R.root.position.y += Math.sin(t * 1.4) * 0.15; R.root.rotation.y = st.byaw;
    let pitch = 0, roll = Math.sin(t * 0.9) * 0.04;
    if (st.bs === 'rear') pitch = -1.05 * ease(clamp(st.bt / 0.35, 0, 1)) * (st.bt > st.bdur - 0.3 ? clamp((st.bdur - st.bt) / 0.3, 0, 1) : 1);
    if (st.bs === 'roar') pitch = -0.5 + Math.sin(st.bt * 18) * 0.06;
    if (st.bs === 'dead') { pitch = 0; roll = Math.min(Math.PI, st.bt * 2.4); }
    R.pitch.rotation.x = damp(R.pitch.rotation.x, pitch, 10, dt); R.pitch.rotation.z = damp(R.pitch.rotation.z, roll, 6, dt);
    R.legs.forEach((lg, i) => { lg.rotation.z = Math.sin(t * (st.bs === 'dead' ? 2 : 7) + i * Math.PI) * 0.28; lg.rotation.x = Math.sin(t * 5 + i) * 0.12; });
    R.claws.forEach((c, i) => { const s = c.s || (i ? 1 : -1), mine = st.side === s;
      let ry = -s * 0.35, rx = 0.15, open = 0.12 + Math.sin(t * 2.2 + i) * 0.06;
      if ((st.bs === 'snapTell') && mine) { rx = -0.9 * ease(clamp(u * 2, 0, 1)); ry = -s * 0.7; open = 0.75; }
      if (st.bs === 'snap' && mine) { rx = lerp(-0.9, 0.35, ease(clamp(u * 2.2, 0, 1))); ry = lerp(-s * 0.7, s * 0.1, ease(clamp(u * 2, 0, 1))); open = u < 0.35 ? 0.8 : 0.0; }
      if (st.bs === 'rear' || st.bs === 'roar') { rx = -1.1; ry = -s * 1.0; open = 0.6 + Math.sin(t * 12) * 0.15; }
      if (st.bs === 'dead') { rx = 0.6; ry = -s * 1.3; open = 0.5; }
      c.sh.rotation.x = damp(c.sh.rotation.x, rx, 12, dt); c.sh.rotation.y = damp(c.sh.rotation.y, ry, 12, dt); if (c.bot) c.bot.rotation.x = damp(c.bot.rotation.x, open, 18, dt); });
    // tells: snap claw flashes red, bubble tell glows cyan, the belly glows gold while he rears
    const fl = R.flash; for (const m of fl) if (m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (st.bs === 'snapTell' && R.flash[st.side < 0 ? 1 : 2]) { const m = R.flash[st.side < 0 ? 1 : 2]; m.userData.flashC.value.set('#ff3030'); m.userData.flash.value = 0.25 + 0.35 * (Math.sin(st.bt * 30) * 0.5 + 0.5); }
    if (st.bs === 'bubbleTell' && R.flash[0]) { R.flash[0].userData.flashC.value.set('#7fe8ff'); R.flash[0].userData.flash.value = 0.15 + 0.3 * (Math.sin(st.bt * 20) * 0.5 + 0.5); }
    if (R.softM) { const g = st.bs === 'rear' ? 0.35 + 0.3 * (Math.sin(t * 14) * 0.5 + 0.5) : 0; R.softM.userData.flashC.value.set('#ffd23c'); R.softM.userData.flash.value = Math.max(g, R.softM.userData.flash.value - dt * 3); }
    DUELS.hot(st.bs === 'rear'); J.ring.visible = st.bs === 'rear'; if (J.ring.visible) { R.soft.getWorldPosition(J.ring.position); J.ring.lookAt(st.p); J.ring.scale.setScalar(1 + Math.sin(t * 10) * 0.12); }
  }
  J.render = function (rdt) {
    const st = J.st, dt = Math.min(0.05, rdt * (SIM || 1));
    const H = J.H; H.root.position.copy(st.p); H.root.position.y -= 0.7; H.root.rotation.y = st.yaw; applyPose(H, swimPose(st.t, st), 14, dt, false);
    if (J.hflash > 0) { J.hflash = Math.max(0, J.hflash - dt * 5); H.mat.userData.flash.value = J.hflash * 0.8; } H.root.visible = !(st.inv > 0 && st.hurtT < 0 && Math.floor(st.t * 20) % 2 === 0);
    poseBoss(st, dt);
    if (Math.random() < dt * 0.8) { V2.set(Math.sin(st.yaw) * 0.3, 1.1, Math.cos(st.yaw) * 0.3).add(st.p).setY(st.p.y + 0.6); burst(V2, 2, 0.3, 0.8); } // Harold's breath
    // camera: behind Harold on the line away from Jimmy, a little above; looks between them (biased to Jimmy); portrait pulls back + widens
    const port = VH() > VW(); J.cam.fov = port ? 74 : 60; J.cam.updateProjectionMatrix();
    const { f } = lockFrame(st); const back = port ? 7.2 : 6.0;
    V2.copy(st.p).addScaledVector(f, -back); V2.y = st.p.y + (port ? 2.6 : 1.9) + Math.max(0, st.bp.y - st.p.y) * 0.25;
    V2.x = clamp(V2.x, -TANK.x - 1, TANK.x + 1); V2.z = clamp(V2.z, -TANK.z - 1, TANK.z + 1); V2.y = clamp(V2.y, 0.9, TANK.h - 0.6);
    V3.copy(st.p).lerp(st.bp, 0.55); V3.y = lerp(st.p.y, st.bp.y, 0.5) + (st.bs === 'rear' ? -0.5 : 0);
    if (st.bs === 'intro') { const k = ease(clamp(st.bt / st.bdur, 0, 1)); V2.lerpVectors(new THREE.Vector3(st.bp.x + 6, st.bp.y + 2, st.bp.z + 9), V2, k); V3.lerpVectors(st.bp, V3, k); }
    J.camP.lerp(V2, 1 - Math.exp(-6 * dt)); J.camL.lerp(V3, 1 - Math.exp(-8 * dt)); J.cam.position.copy(J.camP); J.cam.lookAt(J.camL);
    J.surT.offset.set(Math.sin(st.t * 0.21) * 0.3, st.t * 0.03); J.shafts.material.opacity = 0.17 + Math.sin(st.t * 0.7) * 0.05;
    OUT_U.fogC.value.copy(J.scene.fog.color); OUT_U.fogN.value = 14; OUT_U.fogF.value = 60;
  };
  J.onResize = () => {};

  // ---------------- test bot: ?duel=jimmy&duelbot=win|lose ----------------
  J.botThink = function (B, dt) {
    const st = J.st; if (!st || st.over) return; B.mx = B.my = 0; B.up = B.down = false; if (B.mode === 'lose') return; // lose: float still, take every hit
    const { f, r } = lockFrame(st); let tgt = null, keep = false;
    B.cd = (B.cd || 0) - dt;
    // air low: go to the nearest awake vent and hover in the column until full
    if (st.air < (B.airing ? 0.97 : 0.38) && st.bs !== 'rear') { B.airing = true; let best = null, bd = 1e9; VENTS.forEach((v, i) => { if (!J.ventOn(i)) return; const d = Math.hypot(st.p.x - v[0], st.p.z - v[1]); if (d < bd) { bd = d; best = v; } }); if (best) tgt = new THREE.Vector3(best[0], 3, best[1]); } else B.airing = false;
    if (st.bs === 'rear') { J.R.soft.getWorldPosition(V3); tgt = V3.clone().addScaledVector(V2.copy(st.p).sub(V3).setY(0).normalize(), 1.2); tgt.y = V3.y - 0.3; if (st.p.distanceTo(V3) < 3.0 && B.cd <= 0) { B.a = true; B.cd = 0.45; } }
    else if (!tgt) { V3.copy(st.p).sub(st.bp).setY(0).normalize(); tgt = st.bp.clone().addScaledVector(V3, 6.5); tgt.y = st.bp.y; }
    // dodge the snap at the end of the tell, and any bubble coming close
    if (st.bs === 'snapTell' && st.bdur - st.bt < 0.22 && st.p.distanceTo(st.bp) < 9 && B.cd <= 0) { B.mx = st.side > 0 ? -1 : 1; B.b = true; B.cd = 0.5; keep = true; }
    for (const b of J.blasts) { const d = b.p.distanceTo(st.p); if (d < 3.2 && b.v.dot(V2.copy(st.p).sub(b.p)) > 0 && B.cd <= 0) { B.mx = (B.flip = !B.flip) ? 1 : -1; B.up = true; B.b = true; B.cd = 0.5; keep = true; } }
    if (keep) return;
    V2.copy(tgt).sub(st.p); const l = V2.length(); if (l < 0.6) return; V2.divideScalar(l);
    B.mx = clamp(V2.dot(r) * 1.6, -1, 1); B.my = clamp(V2.dot(f) * 1.6, -1, 1); B.up = V2.y > 0.25; B.down = V2.y < -0.25;
  };
  DUELS.reg('jimmy', J);
  // entrance: the glowing ring at the Aquarium's Pratt St doors (the LMHOOK.aquarium stub's door), back out onto the pier after
  const L = LANDMARKS.find((l) => l.id === 'aquarium'); const door = LMHOOK.aquarium && LMHOOK.aquarium.door;
  if (L && door) { if (LMHOOK.aquarium) LMHOOK.aquarium.duel = 'jimmy'; DUELS.addTrigger('jimmy', L, door.x, door.z - 1.6, door.x, door.z - 3.4, '#5fe0ff'); }
})();

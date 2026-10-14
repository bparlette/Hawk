
// ======================= POE STEALTH NIGHT, Westminster Burying Ground (DESIGN.md: "Poe stealth night", "Poe night: three roses and an unlabeled bottle",
// "Poe night goes full horror" for the catacomb chapter, which is a later pass; this file is chapter 1, the graveyard).
// NIGHT ONLY. A top-down sneak across the graveyard: lay THREE ROSES on the old graves and the UNLABELED BOTTLE on Poe's grave (the last), then slip out the gate.
//   Three crow sentries (the Raven King's flock) patrol with lantern cones. Hide behind tombstones (a stone blocks the cone), SNEAK (hold SHIFT / the L button:
//   slower, but the cones reach 40% less), and toss PEBBLES (K / B) to pull a crow's stare to the clatter for a couple of seconds.
//   Stay in a cone and the ALERT meter fills: full = SPOTTED, the crows caw and chase you out (RETRY / LEAVE). A clean finish = the NEVERMORE FEATHER
//   (saved; window.hasNevermoreFeather() is the gate the Raven King ring in 09v reads: no feather, no fight).
// Entry: the ring inside the corner gate at Westminster (POE_ANCHOR). By day the ring says 'POE: AFTER DARK'. Tests: ?poe=1 (&poenight is implied), &poeauto=win|lose,
// ?duel=poe&duelbot=win|lose. The win bot is a flow test: it runs the route with detection off (st.ghost); window.__poe.seen() is unit-tested for LOS / sneak / cone.
// Rig hook (Opus, optional): window.buildCrowSentry({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, update?(dt, alert) }.
(function () {
  const P = { scene: null, cam: null, title: 'CROW WATCH', pips: 1,
    hint: '<b>WASD</b> move · hold <b>SHIFT</b> sneak · <b>J</b> offer · <b>K</b> pebble · <b>E</b> leave',
    labels: { a: 'OFFER', b: 'PEBBLE', c: 'LEAVE', l: 'SNEAK', r: '' } };
  const LS = 'tcb_poe';
  let save = { feather: false, clears: 0, spotted: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) {} };
  window.hasNevermoreFeather = () => !!save.feather || BOT || Q.has('feather') || Q.has('duels') || Q.has('duel');
  const BX = 11.4, BZ0 = -5.3, BZ1 = 7.1; // walkable box
  const START = [-2, 5.2], GATE = [0, 6.9];
  const MARKS = [ // roses (any order), then the bottle on Poe's grave
    { id: 'r1', x: -8, z: -0.8, kind: 'rose', name: 'OLD GRAVE' }, { id: 'r2', x: -3.2, z: 4.3, kind: 'rose', name: 'OLD GRAVE' }, { id: 'r3', x: 4.8, z: -2.3, kind: 'rose', name: 'OLD GRAVE' },
    { id: 'poe', x: 7.7, z: 1.8, kind: 'bottle', name: "POE'S GRAVE" }];
  const STONES = [[-9.5, -3.2], [-9, 2.8], [-6, 5.2], [-5.6, -1.6], [-4.2, 1.8], [-2, -3.1], [-0.6, 1.6], [1.2, -3.6], [2.4, 3.2], [3.6, -0.6], [6.2, -3.8], [6.4, 4.8], [9, -2.6], [-7.6, 3.2], [0.8, 4.4]];
  const SR = 0.5; // tombstone block radius for the sight line + collision
  const CROWS = [
    { path: [[-10, -4.6], [-10, 4.2], [-6.4, 4.2], [-6.4, -4.6]], sp: 1.5 },
    { path: [[-3.6, -4.6], [3.6, -4.6], [3.6, 1.2], [-3.6, 1.2]], sp: 1.4 },
    { path: [[10, -4.6], [10, 4.6], [5.6, 4.6], [5.6, -4.6]], sp: 1.7 }];
  const RANGE = 5.2, HALF = 0.46, SNEAKK = 0.6, CLOSE = 0.9, GRACE = 2.5, PEB = 8;
  const V = new THREE.Vector3();
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const isNight = () => NIGHT.value > 0.5 || Q.has('poenight') || Q.has('poe') || Q.has('duel');

  // ---------------- sight: cone + range + a tombstone in the way blocks it ----------------
  function blocked(ax, az, bx, bz) { // segment a->b against every tombstone circle
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
    for (const s of STONES) { const t = clamp(((s[0] - ax) * dx + (s[1] - az) * dz) / l2, 0.05, 0.95), cx = ax + dx * t - s[0], cz = az + dz * t - s[1]; if (cx * cx + cz * cz < SR * SR) return true; }
    return false;
  }
  function seen(c, px, pz, sneak) { // crow c: {x, z, yaw}
    const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz), rng = RANGE * (sneak ? SNEAKK : 1);
    if (d > rng) return 0;
    if (d < CLOSE && !sneak) return 1 - d / rng; // a crow hears you at your heels
    if (Math.abs(angDiff(c.yaw, Math.atan2(dx, dz))) > HALF) return 0;
    if (blocked(c.x, c.z, px, pz)) return 0;
    return 1 - d / rng;
  }
  P.seen = seen; P.blocked = blocked;

  // ---------------- meshes (all procedural) ----------------
  const groundTex = () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1d3a2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (30 + (i * 7) % 30) + ',' + (70 + (i * 13) % 40) + ',' + (45 + (i * 5) % 20) + ',.55)'; g.fillRect((i * 53) % w, (i * 97) % h, 3, 2 + (i % 3)); }
    g.fillStyle = '#4a4a50'; g.fillRect(0, 118, w, 20); g.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < w; x += 24) g.fillRect(x, 120, 12, 3); // the stone path
  }, 256);
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 36, 0, TAU); g.stroke(); });
  const winTex = () => canvasTex(64, 64, (g) => { g.fillStyle = '#ffd070'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#6a3a10'; g.fillRect(30, 0, 4, 64); g.fillRect(0, 30, 64, 4); });
  function crowRig() {
    let rig = null; try { if (typeof window.buildCrowSentry === 'function') rig = window.buildCrowSentry({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    if (rig && rig.root) { rig.kind = 'hook'; return rig; }
    const K = DUELS.kit(), G = DUELS.GEO, R = { root: new THREE.Group(), kind: 'standin' };
    // original stand-in: a fat inky crow with a lantern on a hook, facing +z
    K.add(G.sph(0.42, 10, 8), '#1a1824', 0, 0.62, 0, 0, 0, 0, 0.9, 1, 1.25).add(G.sph(0.27, 10, 8), '#242232', 0, 0.98, 0.5).add(G.cone(0.1, 0.34, 5), '#e8a030', 0, 0.94, 0.86, Math.PI / 2, 0, 0)
      .add(G.sph(0.06, 5, 4), '#fff', -0.12, 1.04, 0.7).add(G.sph(0.06, 5, 4), '#fff', 0.12, 1.04, 0.7).add(G.sph(0.03, 4, 4), '#000', -0.12, 1.04, 0.75).add(G.sph(0.03, 4, 4), '#000', 0.12, 1.04, 0.75)
      .add(G.box(0.1, 0.6, 0.55), '#14121e', -0.5, 0.66, -0.05, 0, 0, 0.35).add(G.box(0.1, 0.6, 0.55), '#14121e', 0.5, 0.66, -0.05, 0, 0, -0.35).add(G.cone(0.18, 0.6, 4), '#14121e', 0, 0.55, -0.7, -1.9, 0, 0)
      .add(G.cyl(0.04, 0.04, 0.3, 4), '#e8a030', -0.12, 0.2, 0.1).add(G.cyl(0.04, 0.04, 0.3, 4), '#e8a030', 0.12, 0.2, 0.1)
      .add(G.cyl(0.02, 0.02, 0.7, 4), '#8a8a90', 0.62, 1.1, 0.3).add(G.box(0.16, 0.22, 0.16), '#ffe080', 0.62, 0.7, 0.3);
    K.mesh(toonMat(), R.root); return R;
  }
  function stoneMesh() {
    const K = DUELS.kit(), G = DUELS.GEO;
    STONES.forEach((s, i) => { const col = ['#8a8a94', '#7a7a86', '#9a9aa4'][i % 3], ry = ((i * 37) % 11 - 5) * 0.06;
      if (i % 4 === 3) K.add(G.box(0.18, 1.1, 0.14), col, s[0], 0.55, s[1], 0, ry, 0.04).add(G.box(0.6, 0.18, 0.14), col, s[0], 0.82, s[1], 0, ry, 0.04).add(G.box(0.8, 0.14, 0.5), '#6a6a74', s[0], 0.07, s[1], 0, ry, 0);
      else K.add(G.box(0.62, 0.9, 0.16), col, s[0], 0.45, s[1], 0, ry, ((i * 13) % 7 - 3) * 0.02).add(G.cyl(0.31, 0.31, 0.16, 10), col, s[0], 0.9, s[1], Math.PI / 2, 0, 0, 1, 1, 1).add(G.box(0.8, 0.14, 0.5), '#6a6a74', s[0], 0.07, s[1], 0, ry, 0); });
    return K.mesh(toonMat(), null, 0.005);
  }
  function setPiece() {
    const K = DUELS.kit(), G = DUELS.GEO, sc = P.scene;
    // brick church wall (north) with lancet windows + a buttressed gable; iron fence round the rest
    K.add(G.box(24, 3.2, 1.6), '#9a4a34', 0, 1.6, -6.1).add(G.box(9, 2.4, 1.7), '#8a3e2c', 0, 4.1, -6.1).add(G.cone(5.4, 2.6, 4), '#3a3a48', 0, 6.4, -6.1, 0, Math.PI / 4, 0, 1, 1, 0.34);
    for (let i = -5; i <= 5; i++) K.add(G.box(0.42, 3.4, 0.5), '#7a3a2a', i * 2.2, 1.7, -5.2);
    for (let i = -3; i <= 3; i += 2) K.add(G.box(0.5, 1.6, 0.1), '#ffd070', i * 1.6, 1.9, -5.22);
    K.add(G.box(1.6, 2.2, 0.2), '#2a1a14', 0, 1.1, -5.28); // the catacomb door (chapter 2 later)
    for (let x = -12; x <= 12; x += 1.2) K.add(G.cyl(0.04, 0.04, 1.3, 4), '#2a2a34', x, 0.65, 7.6).add(G.cone(0.07, 0.2, 4), '#2a2a34', x, 1.4, 7.6);
    for (let z = -5; z <= 7.6; z += 1.2) K.add(G.cyl(0.04, 0.04, 1.3, 4), '#2a2a34', -12, 0.65, z).add(G.cone(0.07, 0.2, 4), '#2a2a34', -12, 1.4, z).add(G.cyl(0.04, 0.04, 1.3, 4), '#2a2a34', 12, 0.65, z).add(G.cone(0.07, 0.2, 4), '#2a2a34', 12, 1.4, z);
    K.add(G.box(24, 0.06, 0.06), '#2a2a34', 0, 1.0, 7.6).add(G.box(0.06, 0.06, 12.6), '#2a2a34', -12, 1.0, 1.15).add(G.box(0.06, 0.06, 12.6), '#2a2a34', 12, 1.0, 1.15);
    // the gate arch (south)
    K.add(G.box(0.3, 2.6, 0.3), '#4a4a54', -1.3, 1.3, 7.6).add(G.box(0.3, 2.6, 0.3), '#4a4a54', 1.3, 1.3, 7.6).add(G.box(3, 0.3, 0.3), '#4a4a54', 0, 2.6, 7.6);
    // dead trees
    for (const [x, z] of [[-11, -4.4], [11, -4.4], [-10.8, 6], [10.8, 6]]) K.add(G.cyl(0.14, 0.26, 2.6, 6), '#2a2018', x, 1.3, z).add(G.cyl(0.05, 0.1, 1.3, 5), '#2a2018', x + 0.5, 2.5, z, 0, 0, -0.9).add(G.cyl(0.05, 0.1, 1.2, 5), '#2a2018', x - 0.5, 2.3, z, 0, 0, 0.9);
    // Poe's grave: a bigger marker with a raven on top
    const px = MARKS[3].x + 0.9, pz = MARKS[3].z;
    K.add(G.box(1.1, 0.12, 2.0), '#5a5a64', MARKS[3].x + 0.2, 0.06, pz).add(G.box(0.34, 1.5, 0.9), '#6a6a76', px, 0.8, pz).add(G.sph(0.17, 8, 6), '#14121e', px, 1.72, pz, 0, 0, 0, 1, 0.9, 1.4).add(G.cone(0.05, 0.16, 4), '#e8a030', px - 0.2, 1.74, pz, 0, 0, Math.PI / 2);
    P.deco = K.mesh(toonMat(), sc, 0.005); P.stones = stoneMesh(); sc.add(P.stones);
    // moon + stars + a lit church window glow so the north side reads
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18), new THREE.MeshBasicMaterial({ color: '#fff6d0', fog: false })); moon.position.set(-9, 11, -14); sc.add(moon); P.moon = moon;
  }
  function coneMesh(col) {
    const N = 14, pos = [], idx = [], r = RANGE; pos.push(0, 0.07, 0); for (let i = 0; i <= N; i++) { const a = -HALF + (2 * HALF * i) / N; pos.push(Math.sin(a) * r, 0.07, Math.cos(a) * r); if (i > 0) idx.push(0, i, i + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 2; return m;
  }
  const flat = (col, s, op = 0.8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: ringT, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; };

  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); P.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.1, 90);
    sc.fog = new THREE.Fog('#0c1022', 24, 52); sc.background = new THREE.Color('#080a18');
    DUELS.sceneLights(sc, '#7a86c8', '#16182a', 0.95, '#a8b8ff', 0.8, new THREE.Vector3(-0.5, 1, 0.6));
    const gt = groundTex(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshLambertMaterial({ map: gt })); gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0, 0.8); sc.add(gr);
    setPiece();
    P.H = buildHero(); sc.add(P.H.root);
    P.crows = CROWS.map((cd, i) => { const r = crowRig(); sc.add(r.root); const cn = coneMesh('#ffe27a'); sc.add(cn); return { cd, rig: r, cone: cn, x: cd.path[0][0], z: cd.path[0][1], yaw: 0, wp: 1, pause: 0, lure: 0, lx: 0, lz: 0, seenT: 0 }; });
    P.marks = MARKS.map((m) => { const ring = flat(m.kind === 'rose' ? '#ff6aa8' : '#ffd23c', 1.9); ring.position.set(m.x, 0.06, m.z); sc.add(ring);
      const K = DUELS.kit(), G = DUELS.GEO; let item;
      if (m.kind === 'rose') { K.add(G.cyl(0.02, 0.02, 0.5, 4), '#2a7a3a', 0, 0.25, 0).add(G.sph(0.13, 8, 6), '#e0204a', 0, 0.55, 0).add(G.sph(0.09, 6, 5), '#ff5a7a', 0.03, 0.62, 0.02).add(G.sph(0.13, 8, 6), '#e0204a', 0.3, 0.1, 0.1, 0, 0, 0, 1, 0.5, 1); item = K.mesh(toonMat(), null, 0.004); }
      else { K.add(G.cyl(0.13, 0.15, 0.5, 8), '#5a3a1a', 0, 0.25, 0).add(G.cyl(0.05, 0.08, 0.22, 6), '#5a3a1a', 0, 0.6, 0).add(G.cyl(0.06, 0.06, 0.05, 6), '#c8a060', 0, 0.74, 0).add(G.box(0.2, 0.22, 0.01), '#e8e0c0', 0, 0.28, 0.14); item = K.mesh(toonMat(), null, 0.004); } // the label stays BLANK
      item.position.set(m.x, 0, m.z); item.visible = false; sc.add(item); return { m, ring, item, done: false }; });
    P.gate = flat('#6aff8a', 2.4); P.gate.position.set(GATE[0], 0.06, GATE[1] - 0.6); sc.add(P.gate); P.gate.visible = false;
    P.pebble = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: '#d8d0c0' })); P.pebble.visible = false; sc.add(P.pebble);
    P.pring = flat('#fff', 1.2, 0.9); P.pring.visible = false; sc.add(P.pring);
    P.layout();
  };
  P.layout = function () { const port = VH() > VW(); P.cam.fov = port ? 52 : 42; P.cam.aspect = VW() / VH(); P.cam.updateProjectionMatrix(); P.camH = port ? 19 : 15.5; P.camZ = port ? 8.2 : 7.4; };
  P.onResize = () => { if (P.cam) P.layout(); };

  // ---------------- state ----------------
  function reset() {
    const st = (P.st = { t: 0, x: START[0], z: START[1], yaw: 0, spd: 0, sneak: false, alert: 0, roses: 0, bottle: false, peb: PEB, pcd: 0, pf: null, over: false, ghost: !!(DUELS.bot && DUELS.bot.mode === 'win'), grace: GRACE, gateOpen: false, sn: 0 });
    for (const c of P.crows) { c.x = c.cd.path[0][0]; c.z = c.cd.path[0][1]; c.wp = 1; c.pause = 0; c.lure = 0; c.yaw = Math.atan2(c.cd.path[1][0] - c.x, c.cd.path[1][1] - c.z); c.seenT = 0; }
    for (const k of P.marks) { k.done = false; k.item.visible = false; k.ring.visible = true; } P.gate.visible = false; DUELS.bars(0, 0); ui(); return st;
  }
  function ui() { const st = P.st; if (!st) return; DUELS.sub('ROSES ' + st.roses + '/3 · BOTTLE ' + (st.bottle ? '1/1' : '0/1'), 'PEBBLES ' + st.peb); DUELS.bars((st.roses + (st.bottle ? 1 : 0)) / 4, st.alert); }
  P.start = function (opts = {}) {
    reset();
    DUELS.banner('POE NIGHT<small>WESTMINSTER BURYING GROUND</small>', 2.2);
    DUELS.say('HAROLD', pickA(['Three roses and a bottle. Quietly, Mavis.', 'The crows keep a tidy lantern schedule.', 'Stay low. Mind the stones.']), 3.2);
    DUELS.log.push('poe:start');
  };
  const pickA = (a) => a[Math.floor(Math.random() * a.length)];
  P.retry = function () { reset(); DUELS.banner('ONCE MORE<small>THE CROWS ARE LISTENING</small>', 1.4); };
  P.exit = function () { persist(); try { dispatchEvent(new CustomEvent('tcb:poe', { detail: { save } })); } catch (e) {} };

  // ---------------- the loop ----------------
  P.step = function (dt, I) {
    const st = P.st; if (!st) return; st.t += dt; if (st.over) return;
    if (I.c) { DUELS.exit('leave'); return; }
    // move (screen right = +x, stick up = away from the camera = -z)
    let mx = I.mx, my = I.my; const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
    st.sneak = !!(I.down || I.lh); const sp = (st.sneak ? 1.9 : 3.5) * Math.min(1, L);
    if (L > 0.12) { st.x += mx * sp * dt; st.z += -my * sp * dt; st.yaw = Math.atan2(mx, -my); st.spd = sp; } else st.spd = 0;
    st.x = clamp(st.x, -BX, BX); st.z = clamp(st.z, BZ0, BZ1);
    for (const s of STONES) { const dx = st.x - s[0], dz = st.z - s[1], d = Math.hypot(dx, dz), r = SR + 0.2; if (d < r && d > 1e-4) { st.x = s[0] + (dx / d) * r; st.z = s[1] + (dz / d) * r; } }
    // offer
    if (I.a) {
      let near = null, nd = 1.35; for (const k of P.marks) { if (k.done) continue; const d = Math.hypot(k.m.x - st.x, k.m.z - st.z); if (d < nd) { nd = d; near = k; } }
      if (!near) DUELS.tell('NOTHING TO LAY HERE', 0.8);
      else if (near.m.kind === 'bottle' && st.roses < 3) DUELS.tell('LAY ALL THREE ROSES FIRST', 1.2);
      else { near.done = true; near.item.visible = true; near.ring.visible = false; if (near.m.kind === 'rose') { st.roses++; DUELS.tell('ROSE LAID ' + st.roses + '/3', 1.1); } else { st.bottle = true; DUELS.say('HAROLD', 'Evermore, old friend. Cheers.', 3); DUELS.banner('POE REMEMBERED<small>NOW SLIP OUT THE GATE</small>', 2); }
        CITY.log.push('poe:' + near.m.id + '@' + S.time.toFixed(1)); ui(); }
    }
    // pebble
    st.pcd -= dt;
    if (I.b && st.peb > 0 && st.pcd <= 0 && !st.pf) { const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw); st.peb--; st.pcd = 0.45; st.pf = { x0: st.x, z0: st.z, x1: clamp(st.x + fx * 4.6, -BX, BX), z1: clamp(st.z + fz * 4.6, BZ0, BZ1), u: 0 }; ui(); }
    else if (I.b && st.peb <= 0 && st.pcd <= 0) { st.pcd = 0.6; DUELS.tell('OUT OF PEBBLES', 0.8); }
    if (st.pf) { st.pf.u += dt / 0.5; if (st.pf.u >= 1) { const f = st.pf; st.pf = null; st.pl = { x: f.x1, z: f.z1, life: 0.6 }; DUELS.log.push('pebble');
      for (const c of P.crows) if (Math.hypot(c.x - f.x1, c.z - f.z1) < 5.4) { c.lure = 2.6; c.lx = f.x1; c.lz = f.z1; } } }
    if (st.pl && (st.pl.life -= dt) <= 0) st.pl = null;
    // crows
    for (const c of P.crows) {
      if (c.lure > 0) { c.lure -= dt; c.yaw += clamp(angDiff(c.yaw, Math.atan2(c.lx - c.x, c.lz - c.z)), -3 * dt, 3 * dt); }
      else if (c.pause > 0) { c.pause -= dt; c.yaw += Math.sin(st.t * 2.4 + c.wp) * 0.9 * dt; }
      else { const w = c.cd.path[c.wp], dx = w[0] - c.x, dz = w[1] - c.z, d = Math.hypot(dx, dz); c.yaw += clamp(angDiff(c.yaw, Math.atan2(dx, dz)), -3.2 * dt, 3.2 * dt);
        if (d < 0.2) { c.wp = (c.wp + 1) % c.cd.path.length; c.pause = 0.9; } else { const s = Math.min(d, c.cd.sp * dt); c.x += (dx / d) * s; c.z += (dz / d) * s; } }
    }
    // detection
    st.grace -= dt; let vis = 0, by = null;
    if (!st.ghost && st.grace <= 0) for (const c of P.crows) { const v = seen(c, st.x, st.z, st.sneak); c.seenT = v > 0 ? 1 : Math.max(0, c.seenT - dt * 3); if (v > vis) { vis = v; by = c; } } else for (const c of P.crows) c.seenT = 0;
    if (vis > 0) { st.alert = Math.min(1.02, st.alert + (0.9 + vis * 1.1) * dt); if (st.alert > 0.4 && (st.sn += dt) > 0.8) { st.sn = 0; DUELS.tell('A CROW EYES YOU...', 0.8); } } else st.alert = Math.max(0, st.alert - 0.35 * dt);
    DUELS.bars((st.roses + (st.bottle ? 1 : 0)) / 4, clamp(st.alert, 0, 1));
    if (st.alert >= 1) { st.over = true; save.spotted++; persist(); DUELS.hurt(); DUELS.banner('CAW! CAW!<small>SPOTTED</small>', 1.6); DUELS.over('lose', 'SPOTTED', 'The crows raised the alarm and chased you out. ' + st.roses + ' roses laid' + (st.bottle ? ', bottle left' : '') + '.'); return; }
    // the gate opens once everything is laid
    if (!st.gateOpen && st.bottle) { st.gateOpen = true; P.gate.visible = true; }
    if (st.gateOpen && Math.hypot(st.x - GATE[0], st.z - (GATE[1] - 0.6)) < 1.3) {
      st.over = true; const first = !save.feather; save.feather = true; save.clears++; persist(); CITY.log.push('poe:feather@' + S.time.toFixed(1)); try { dispatchEvent(new CustomEvent('tcb:feather', { detail: { first } })); } catch (e) {}
      DUELS.over('win', 'NEVERMORE FEATHER', 'A black feather drifts down onto the stoop of the gate. The Raven King will answer to it now (M&amp;T Stadium).'); }
  };

  // ---------------- render ----------------
  P.render = function (rdt) {
    const st = P.st; if (!st) return; const t = st.t, H = P.H;
    H.root.position.set(st.x, 0, st.z); H.root.rotation.y = st.yaw;
    let p = st.spd > 0.2 ? HERO_POSES.run(t, st.spd) : HERO_POSES.idle(t); if (st.sneak) { p.y = (p.y || 0) - 0.22; if (p.torso) p.torso[0] += 0.35; }
    applyPose(H, p, 16, rdt, false);
    for (const c of P.crows) { c.rig.root.position.set(c.x, 0.05 + Math.abs(Math.sin(t * 5 + c.wp)) * 0.04, c.z); c.rig.root.rotation.y = c.yaw; c.cone.position.set(c.x, 0, c.z); c.cone.rotation.y = c.yaw; c.cone.material.color.set(c.seenT > 0.5 ? '#ff5a4a' : c.lure > 0 ? '#9ad8ff' : '#ffe27a'); c.cone.material.opacity = 0.2 + 0.1 * Math.sin(t * 3 + c.wp) + (c.seenT > 0.5 ? 0.12 : 0); if (c.rig.update) c.rig.update(rdt, st.alert); }
    for (const k of P.marks) if (k.ring.visible) { k.ring.rotation.z += rdt * 0.8; k.ring.material.opacity = 0.5 + 0.35 * Math.sin(t * 3); }
    if (P.gate.visible) { P.gate.rotation.z += rdt; }
    if (st.pf) { const f = st.pf; P.pebble.visible = true; P.pebble.position.set(lerp(f.x0, f.x1, f.u), 0.9 + Math.sin(f.u * Math.PI) * 1.4 - 0.5 * f.u, lerp(f.z0, f.z1, f.u)); } else P.pebble.visible = false;
    if (st.pl) { P.pring.visible = true; P.pring.position.set(st.pl.x, 0.07, st.pl.z); const s = 0.6 + (1 - st.pl.life / 0.6) * 2.6; P.pring.scale.set(s, s, s); } else P.pring.visible = false;
    // follow cam
    const cx = clamp(st.x, -8, 8), cz = clamp(st.z, BZ0 + 1, BZ1 - 2); P.cam.position.set(cx, P.camH, cz + P.camZ); P.cam.lookAt(cx, 0.2, cz - 0.4);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 24; OUT_U.fogF.value = 52;
  };

  // ---------------- test bot ----------------
  P.botThink = function (B, dt) {
    const st = P.st; if (!st || st.over) return; B.mx = B.my = 0; B.up = B.down = false; B.lh = false;
    const go = (tx, tz) => { const dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz); if (d < 0.15) return d; B.mx = dx / d; B.my = -dz / d; return d; };
    if (B.mode === 'lose') { const c = P.crows[1], tx = c.x + Math.sin(c.yaw) * 2.2, tz = c.z + Math.cos(c.yaw) * 2.2; go(tx, tz); return; }
    const todo = P.marks.filter((k) => !k.done); let tgt;
    if (todo.length) { tgt = todo.find((k) => k.m.kind === 'rose') || todo[0]; const ap = tgt.m.kind === 'bottle' ? [tgt.m.x - 0.4, tgt.m.z] : [tgt.m.x, tgt.m.z]; const d = go(ap[0], ap[1]); if (d < 0.7) B.a = true; }
    else go(GATE[0], GATE[1] - 0.6);
  };
  DUELS.reg('poe', P);

  // ---------------- the city side: the ring inside the corner gate at Westminster; night only ----------------
  let n = 0;
  MODE.ticks.push((rdt) => {
    n++;
    if (n === 1 && window.POE_ANCHOR) {
      const A = window.POE_ANCHOR, rx = A.x + 1.5, rz = A.z + 1.8, y = groundY(rx, rz);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ringT, color: '#b49aff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(rx, y + 0.05, rz); ring.renderOrder = 2; ring.visible = false; scene.add(ring); P.ring = ring;
      const act = { kind: 'poe', x: rx, z: rz, r: 1.7, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('poe')), go: () => { if (!isNight() ) { banner('POE ONLY WALKS AFTER DARK. COME BACK AT NIGHT.', 2.4); return; } DUELS.start('poe'); } };
      Object.defineProperty(act, 'label', { get: () => (isNight() ? (save.feather ? 'POE NIGHT AGAIN' : 'POE NIGHT') : 'POE: AFTER DARK'), configurable: true });
      ACTIONS.push(act); P.act = act;
    }
    if (P.ring) { const d = Math.hypot(P.ring.position.x - hero.pos.x, P.ring.position.z - hero.pos.z); P.ring.visible = d < 16 && !DUELS.cur; if (P.ring.visible) { P.ring.rotation.z += rdt * 0.7; P.ring.material.opacity = 0.6 + 0.3 * Math.sin(S.time * 3); } }
    if (n === 3 && Q.has('poe') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('poeauto'); DUELS.start('poe', m === 'win' || m === 'lose' ? { bot: m } : {}); }
  });
  window.__poe = P; P.save = save; P.reset = () => { Object.assign(save, { feather: false, clears: 0, spotted: 0 }); persist(); };
})();

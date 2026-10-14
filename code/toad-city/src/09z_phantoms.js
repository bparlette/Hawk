
// ======================= FELLS POINT PHANTOMS, Broadway pier (DESIGN.md "Fells Point Phantoms", "Ghost lantern is guaranteed", item g of the build order).
// NIGHT ONLY. Pirate ghosts drift in on the fog off the Broadway pier: BOSUN BONES (big, slow, club), DECKHAND DREAD (fast, cutlass) and POWDER MONKEYS (they lob spectral bombs).
// Ghosts WALK ON WATER and swings pass straight through them, so knocking them into the harbour does nothing, UNLESS they are SOLID:
//   J = cane swing (3-hit combo, the 3rd is a spinning finisher). On a ghost that isn't solid it only STUNS (WHOOSH), so it can never be KO'd that way.
//   K = GHOST LANTERN flash (needs the ghost lantern from Harbor Fishing, the first night cast off this pier lands it): every ghost within reach goes SOLID for ~5 s
//   (and is stunned a beat). Solid ghosts take damage, and a solid ghost knocked off the pier SINKS. 7 s lantern cooldown.
//   3 waves (2 / 3 / 5 ghosts). Bombs show a landing ring, step out of it. Mavis tosses one crab cake of health under 35%.
// Win = the Phantoms are off the pier (saved, window.phantomsCleared(), CITY.log + 'tcb:phantoms' event for the crime/win-state pass). Captain Cobblestone leads them, his own fight is 09u.
// Entry: a ring on the Broadway pier (the recreation pier, Pendry side). By day: 'PHANTOMS: AFTER DARK'; at night without the lantern: it points you to the fishing ring beside it.
// Tests: ?phantoms=1 (night + lantern implied; &nolantern=1 removes the lantern), &phauto=win|lose, ?duel=phantoms&duelbot=win|lose.
// Rig hook (Opus, optional): window.buildPhantomPirate({ THREE, toonMat, outlineMat, addOdir, QUAL, kind: 'bosun'|'dread'|'monkey' }) ->
//   { root, ghost?: [materials made see-through until SOLID], arm?: shoulder pivot (rotation.x < 0 raises it), update?(dt, info) }, facing +z, about 1.6 tall at scale 1.
(function () {
  const P = { scene: null, cam: null, title: 'PHANTOM PIER', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> swing · <b>K</b> lantern (ghosts go solid) · <b>E</b> leave',
    labels: { a: 'SWING', b: 'LANTERN', c: 'LEAVE', l: '', r: '' } };
  const LS = 'tcb_phantoms';
  let save = { cleared: false, clears: 0, losses: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) {} };
  window.phantomsCleared = () => !!save.cleared;
  const hasLantern = () => !!(window.__fishing && __fishing.save && __fishing.save.lantern) || ((BOT || Q.has('phantoms') || Q.has('duel')) && !Q.has('nolantern'));
  const isNight = () => NIGHT.value > 0.5 || Q.has('phantoms') || Q.has('duel');
  const PX = 11.6, PZ = 4.3; // the pier deck: |x| <= PX, |z| <= PZ
  const WAVES = [['dread', 'dread'], ['bosun', 'monkey', 'monkey'], ['bosun', 'dread', 'dread', 'monkey', 'monkey']];
  const TOTAL = WAVES.reduce((a, w) => a + w.length, 0);
  const KIND = {
    bosun: { name: 'BOSUN BONES', hp: 4, sp: 1.55, r: 0.62, rng: 2.1, wind: 0.8, dmg: 14, sc: 1.28, cd: [1.6, 2.4] },
    dread: { name: 'DECKHAND DREAD', hp: 2, sp: 3.1, r: 0.42, rng: 1.55, wind: 0.42, dmg: 7, sc: 1.0, cd: [1.0, 1.7] },
    monkey: { name: 'POWDER MONKEY', hp: 2, sp: 2.3, r: 0.38, rng: 0, wind: 0.6, dmg: 11, sc: 0.85, cd: [2.4, 3.4] } };
  const SOLID_T = 5, LAN_CD = 7, LAN_R = 8, BOMB_R = 1.5, BOMB_T = 1.1;
  const V = new THREE.Vector3();
  const rnd = (a, b) => a + Math.random() * (b - a), pickA = (a) => a[Math.floor(Math.random() * a.length)];
  const sfx = (k) => { try { DUELS.hitSfx(k); } catch (e) {} };

  // ---------------- meshes (all procedural, original) ----------------
  const plankTex = () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(' + (70 + (y * 3) % 30) + ',' + (54 + (y * 5) % 20) + ',' + (40 + (y * 7) % 16) + ',1)'; g.fillRect(0, y + 1, w, 14);
      for (let x = (y * 11) % 90; x < w; x += 90 + (y % 3) * 20) { g.fillStyle = '#1e160e'; g.fillRect(x, y, 2, 16); } }
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 90; i++) g.fillRect((i * 53) % w, (i * 31) % h, 5, 1);
  }, 256);
  const waterTex = () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#0d2a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(' + (60 + (i * 7) % 60) + ',' + (140 + (i * 11) % 60) + ',' + (170 + (i * 5) % 60) + ',.22)'; g.fillRect((i * 37) % w, (i * 59) % h, 10 + (i % 4) * 6, 2); }
  }, 128);
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 36, 0, TAU); g.stroke(); });
  const discT = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, 64);
  const flat = (col, s, op = 0.8, tex = ringT) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; };

  // original stand-in rigs: ghost pirates (teal, see-through, no legs, a wisp tail), facing +z
  function phantomRig(kind) {
    let rig = null; try { if (typeof window.buildPhantomPirate === 'function') rig = window.buildPhantomPirate({ THREE, toonMat, outlineMat, addOdir, QUAL, kind }); } catch (e) { console.error(e); rig = null; }
    if (rig && rig.root) { rig.kind = 'hook'; rig.ghost = rig.ghost || []; return rig; }
    const K = DUELS.kit(), G = DUELS.GEO, R = { root: new THREE.Group(), ghost: [], kind: 'standin' };
    const gm = (em) => { const m = toonMat({ transparent: true, opacity: 0.5 }); m.emissive = new THREE.Color(em || '#1c6a5a'); R.ghost.push(m); return m; };
    const body = '#8ad8cc', coat = kind === 'bosun' ? '#5a8aa8' : kind === 'dread' ? '#9a6aa8' : '#c8a86a', skull = '#e8f4ec';
    R.body = new THREE.Group(); R.root.add(R.body);
    const big = kind === 'bosun', sm = kind === 'monkey';
    // wisp tail (cones stacked), torso, head
    K.add(G.cone(0.44, 0.9, 8), body, 0, 0.42, 0, Math.PI, 0, 0).add(G.cone(0.2, 0.7, 6), body, 0, 0.1, -0.1, Math.PI * 0.8, 0, 0)
      .add(G.sph(0.4, 10, 8), coat, 0, 1.0, 0, 0, 0, 0, big ? 1.25 : 1, 1.05, 0.9)
      .add(G.sph(0.26, 10, 8), skull, 0, 1.58, 0.05).add(G.sph(0.07, 6, 5), '#0a0a14', -0.1, 1.62, 0.26).add(G.sph(0.07, 6, 5), '#0a0a14', 0.1, 1.62, 0.26)
      .add(G.sph(0.03, 5, 4), '#7dffc8', -0.1, 1.62, 0.31).add(G.sph(0.03, 5, 4), '#7dffc8', 0.1, 1.62, 0.31).add(G.box(0.16, 0.04, 0.04), '#1a1a22', 0, 1.47, 0.28);
    if (kind === 'bosun') K.add(G.box(0.62, 0.1, 0.62), '#e04a3a', 0, 1.8, 0.02).add(G.sph(0.2, 8, 6), '#e04a3a', 0, 1.82, -0.2).add(G.box(0.8, 0.16, 0.5), '#2a4a68', 0, 0.98, 0.18).add(G.box(0.8, 0.12, 0.5), '#8ad8cc', 0, 1.2, 0.18);
    else if (kind === 'dread') K.add(G.cone(0.34, 0.24, 3), '#2a2438', 0, 1.86, 0, 0, 0, 0, 1.5, 1, 1).add(G.box(0.7, 0.05, 0.26), '#2a2438', 0, 1.78, 0).add(G.box(0.5, 0.06, 0.06), '#ffe080', 0, 0.9, 0.34);
    else K.add(G.sph(0.24, 8, 6), '#6a4a2a', 0, 1.8, 0, 0, 0, 0, 1.2, 0.5, 1.2).add(G.sph(0.12, 6, 5), '#6a4a2a', 0, 1.85, 0.1).add(G.cyl(0.2, 0.2, 0.34, 8), '#8a5a2a', 0, 1.0, -0.42, Math.PI / 2, 0, 0).add(G.cyl(0.21, 0.21, 0.04, 8), '#3a2a1a', 0, 1.0, -0.26, Math.PI / 2, 0, 0);
    K.mesh(gm(), R.body);
    // the arm + weapon on a shoulder pivot
    R.arm = new THREE.Group(); R.arm.position.set(big ? 0.5 : 0.38, 1.12, 0.05); R.root.add(R.arm);
    const W = DUELS.kit();
    if (kind === 'bosun') W.add(G.cyl(0.07, 0.1, 0.5, 6), coat, 0, -0.25, 0.05).add(G.cyl(0.09, 0.15, 0.9, 6), '#7a5a3a', 0, -0.6, 0.45, Math.PI / 2, 0, 0).add(G.sph(0.18, 8, 6), '#7a5a3a', 0, -0.6, 0.95);
    else if (kind === 'dread') W.add(G.cyl(0.05, 0.07, 0.45, 6), coat, 0, -0.22, 0.05).add(G.box(0.05, 0.05, 1.0), '#c8e8e8', 0, -0.5, 0.65).add(G.box(0.2, 0.05, 0.06), '#d8a030', 0, -0.5, 0.2);
    else W.add(G.cyl(0.05, 0.07, 0.4, 6), coat, 0, -0.2, 0.05).add(G.sph(0.17, 8, 6), '#1a1824', 0, -0.4, 0.3).add(G.sph(0.06, 5, 4), '#7dffc8', 0, -0.25, 0.3).add(G.cyl(0.015, 0.015, 0.14, 4), '#ffe080', 0, -0.2, 0.3);
    W.mesh(gm('#103a30'), R.arm);
    return R;
  }
  function setPiece() {
    const K = DUELS.kit(), G = DUELS.GEO, sc = P.scene;
    // pier piles, bollards and lamp posts along both long edges; the open edge is the drop into the harbour
    for (let x = -PX; x <= PX + 0.1; x += 2.9) for (const z of [-PZ - 0.2, PZ + 0.2]) K.add(G.cyl(0.2, 0.24, 1.2, 7), '#2a2018', x, -0.2, z);
    for (const x of [-PX + 0.5, 0, PX - 0.5]) for (const z of [-PZ + 0.1, PZ - 0.1]) K.add(G.cyl(0.14, 0.18, 0.4, 7), '#3a3a44', x, 0.2, z).add(G.sph(0.14, 7, 5), '#3a3a44', x, 0.42, z);
    for (const [x, z] of [[-PX + 0.2, -PZ - 0.1], [PX - 0.2, -PZ - 0.1], [-PX + 0.2, PZ + 0.1], [PX - 0.2, PZ + 0.1]]) K.add(G.cyl(0.07, 0.09, 2.6, 6), '#2a2a34', x, 1.3, z).add(G.box(0.34, 0.4, 0.34), '#ffd890', x, 2.7, z).add(G.cone(0.3, 0.22, 4), '#2a2a34', x, 3.0, z, 0, Math.PI / 4, 0);
    // crates, rope coils, a pair of barrels stacked at the shore end (west)
    K.add(G.box(0.9, 0.8, 0.9), '#7a5a3a', -PX + 1.2, 0.4, -PZ + 1.0).add(G.box(0.7, 0.6, 0.7), '#8a6a44', -PX + 1.4, 1.1, -PZ + 1.0, 0, 0.4, 0).add(G.cyl(0.4, 0.4, 0.7, 10), '#6a4a2a', -PX + 1.2, 0.35, PZ - 1.0).add(G.tor(0.3, 0.1, Math.PI * 2, 6, 12), '#c8b080', PX - 1.6, 0.1, PZ - 1.1, Math.PI / 2, 0, 0);
    P.deco = K.mesh(toonMat(), sc, 0.005);
    // Fells Point skyline across the water (north, -z): dark rowhouses with a few lit windows, a church steeple, a tall-ship mast
    const S = DUELS.kit(); let x = -34;
    for (let i = 0; x < 34; i++) { const w = 2.6 + (i * 7) % 3 * 0.5, h = 3 + (i * 5) % 4 * 0.8; S.add(G.box(w, h, 2.2), ['#2a2230', '#30263a', '#262034'][i % 3], x + w / 2, h / 2, -17); S.add(G.cone(w * 0.62, 0.9, 4), '#1c1824', x + w / 2, h + 0.4, -17, 0, Math.PI / 4, 0, 1, 1, 0.6);
      if (i % 2 === 0) S.add(G.box(0.4, 0.5, 0.05), '#ffd070', x + w / 2 - 0.5, h * 0.55, -15.85); if (i % 3 === 1) S.add(G.box(0.4, 0.5, 0.05), '#ffd070', x + w / 2 + 0.5, h * 0.35, -15.85); x += w + 0.15; }
    S.add(G.box(1.4, 8, 1.4), '#2a2230', 12, 4, -18).add(G.cone(0.95, 3, 4), '#1c1824', 12, 9.5, -18, 0, Math.PI / 4, 0).add(G.cyl(0.08, 0.1, 11, 5), '#1a1620', -16, 5.5, -22).add(G.box(5, 0.08, 0.08), '#1a1620', -16, 8.5, -22).add(G.box(4, 0.08, 0.08), '#1a1620', -16, 6.2, -22);
    S.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), sc);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18), new THREE.MeshBasicMaterial({ color: '#e6f4ff', fog: false })); moon.position.set(10, 13, -26); sc.add(moon); P.moon = moon;
  }
  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); P.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.1, 110);
    sc.fog = new THREE.Fog('#0a1420', 22, 52); sc.background = new THREE.Color('#07101a');
    DUELS.sceneLights(sc, '#8aa8e0', '#1c2c44', 1.5, '#c0d8ff', 0.9, new THREE.Vector3(-0.4, 1, 0.5));
    const pt = plankTex(); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(6, 3);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(PX * 2 + 0.6, PZ * 2 + 0.6), new THREE.MeshLambertMaterial({ map: pt })); deck.rotation.x = -Math.PI / 2; sc.add(deck);
    const wt = waterTex(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(16, 12); P.wt = wt;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshLambertMaterial({ map: wt })); water.rotation.x = -Math.PI / 2; water.position.y = -0.45; sc.add(water);
    setPiece();
    P.H = buildHero(); sc.add(P.H.root);
    // fog banks: big soft sprites drifting over the water (the ghosts come in on them)
    P.fog = []; for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: discT, color: '#b8dccf', transparent: true, opacity: 0.2, depthWrite: false, fog: false })); s.scale.set(9, 3, 1); s.position.set(-22 + i * 5.5, 0.9 + (i % 3) * 0.4, (i % 2 ? 1 : -1) * (7 + (i % 4) * 2)); sc.add(s); P.fog.push(s); }
    // pools: ghosts (made per start), bombs, ring effects
    P.ghosts = [];
    P.bombs = []; for (let i = 0; i < 6; i++) { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.sph(0.22, 8, 6), '#1a1824', 0, 0, 0).add(G.sph(0.08, 6, 5), '#7dffc8', 0, 0.2, 0).add(G.cyl(0.015, 0.015, 0.16, 4), '#ffe080', 0, 0.3, 0);
      const m = K.mesh(toonMat(), sc, 0.004); m.visible = false; const mk = flat('#7dffc8', 3.0, 0.7); mk.visible = false; sc.add(mk); P.bombs.push({ m, mk, on: false }); }
    P.fx = []; for (let i = 0; i < 12; i++) { const m = flat('#fff', 1, 0.8); m.visible = false; sc.add(m); P.fx.push({ m, on: false, t: 0, max: 0.5, s0: 1, s1: 3 }); }
    P.lanLight = new THREE.PointLight('#aaffe0', 0, 14, 1.4); P.lanLight.position.set(0, 1.4, 0); sc.add(P.lanLight);
    P.layout();
  };
  P.layout = function () { const port = VH() > VW(); P.cam.fov = port ? 54 : 42; P.cam.aspect = VW() / VH(); P.cam.updateProjectionMatrix(); P.camH = port ? 18 : 14; P.camZ = port ? 8.4 : 7.6; };
  P.onResize = () => { if (P.cam) P.layout(); };
  function fx(x, z, col, s0, s1, max, y = 0.08) { const f = P.fx.find((q) => !q.on) || P.fx[0]; f.on = true; f.t = 0; f.max = max; f.s0 = s0; f.s1 = s1; f.m.visible = true; f.m.position.set(x, y, z); f.m.material.color.set(col); }

  // ---------------- state ----------------
  function spawnGhost(kind, i, n) {
    const d = KIND[kind]; let g = P.ghosts.find((q) => q.free && q.kind === kind);
    if (!g) { const rig = phantomRig(kind); P.scene.add(rig.root); g = { kind, rig, free: true }; P.ghosts.push(g); }
    const side = (i + n) % 4, x = side === 0 ? -rnd(14, 17) : side === 1 ? rnd(14, 17) : rnd(-9, 9), z = side === 2 ? -rnd(8, 10) : side === 3 ? rnd(8, 10) : rnd(-5, 5);
    Object.assign(g, { free: false, d, x, z, yaw: 0, hp: d.hp, state: 'in', t: 0, cd: rnd(0.6, 1.6), solid: 0, stun: 0, kx: 0, kz: 0, alpha: 0, flash: 0, bob: Math.random() * 6, sink: 0, hit: false, strafe: Math.random() < 0.5 ? 1 : -1 });
    g.rig.root.visible = true; g.rig.root.scale.setScalar(d.sc); return g;
  }
  function reset(fromWave) {
    const st = (P.st = { t: 0, x: -8, z: 0, yaw: Math.PI / 2, spd: 0, hp: 100, inv: 0, hurt: 0, healUsed: false, healT: 0, atk: null, atkCd: 0, comboN: 0, comboT: 0, lan: 0, lanT: 0, wave: fromWave || 0, nextT: 1.3, left: 0, over: false, won: false, outT: 0,
      ghost: !!(DUELS.bot && DUELS.bot.mode === 'win'), hits: 0, solidHits: 0, sunk: 0, taken: 0, phased: 0, told: false, killed: 0 });
    for (const g of P.ghosts) { g.free = true; g.rig.root.visible = false; } for (const b of P.bombs) { b.on = false; b.m.visible = false; b.mk.visible = false; } for (const f of P.fx) { f.on = false; f.m.visible = false; }
    st.killed = WAVES.slice(0, st.wave).reduce((a, w) => a + w.length, 0); st.pending = 0; ui(); return st;
  }
  const alive = () => P.ghosts.filter((g) => !g.free && g.state !== 'sink');
  function ui() { const st = P.st; if (!st) return; const rem = TOTAL - st.killed; DUELS.sub('WAVE ' + Math.max(1, st.wave) + '/3 · GHOSTS ' + rem, st.lan > 0 ? 'LANTERN ' + Math.ceil(st.lan) + 's' : 'LANTERN READY (K)'); DUELS.bars(st.hp / 100, rem / TOTAL); }
  P.start = function (opts = {}) {
    reset(0);
    DUELS.banner('FELLS POINT PHANTOMS<small>BROADWAY PIER · AFTER DARK</small>', 2.4);
    DUELS.say('MAVIS', pickA(['Fog\'s rolling in, Harold. Hold up that lantern, hon!', 'They walk on water, Harold. Make them solid first!', 'Flash the lantern, THEN swing, dear!']), 3.4);
    DUELS.log.push('phantoms:start');
  };
  P.retry = function () { const w = P.st ? P.st.wave : 0; reset(Math.max(0, w - 1)); DUELS.banner('ONCE MORE<small>THE FOG IS BACK</small>', 1.4); DUELS.log.push('retry'); };
  P.exit = function () { persist(); try { dispatchEvent(new CustomEvent('tcb:phantoms', { detail: { save } })); } catch (e) {} };

  function hurtHero(dmg, why) {
    const st = P.st; if (st.inv > 0 || st.over) return; st.inv = 0.8; st.hurt = 0.35; st.taken++;
    st.hp -= dmg * (st.ghost ? 0.12 : 1); DUELS.hurt(); try { DUELS.shake(0.25); } catch (e) {} sfx('heavy'); DUELS.pop('-' + dmg, V.set(st.x, 2.2, st.z), '');
    if (st.hp <= 0) { st.hp = 0; st.over = true; save.losses++; persist(); DUELS.log.push('phantoms:lose:' + why); ui(); DUELS.over('lose', 'HAUNTED', 'The Phantoms chased you off the pier. ' + st.killed + '/' + TOTAL + ' ghosts down.'); return; }
    if (st.hp < 35 && !st.healUsed) { st.healUsed = true; st.healT = 0.9; }
  }
  function killGhost(g, why) {
    const st = P.st; g.state = 'sink'; g.sink = 0; st.killed++; st.sunk++; sfx('boom'); fx(g.x, g.z, '#9ae8ff', 0.6, 3.2, 0.6); DUELS.pop(why, V.set(g.x, 2.4, g.z), 'w'); DUELS.log.push('phantoms:sunk:' + g.kind);
  }
  function swingHit(n) {
    const st = P.st, fx0 = Math.sin(st.yaw), fz0 = Math.cos(st.yaw), spin = n === 3, rng = spin ? 2.9 : 2.4; let any = false;
    for (const g of alive()) { if (g.state === 'in') continue;
      const dx = g.x - st.x, dz = g.z - st.z, d = Math.hypot(dx, dz); if (d > rng + g.d.r) continue; if (!spin && d > 0.5 && (dx * fx0 + dz * fz0) / d < 0.15) continue;
      any = true; st.hits++; const ux = d > 1e-3 ? dx / d : fx0, uz = d > 1e-3 ? dz / d : fz0;
      if (g.solid > 0) {
        const dmg = spin ? 2 : 1; g.hp -= dmg; st.solidHits++; g.kx = ux * (spin ? 15 : 9); g.kz = uz * (spin ? 15 : 9); g.stun = spin ? 0.7 : 0.4; g.flash = 1; g.state = g.state === 'in' ? 'in' : 'stun'; g.t = 0; g.hit = false;
        sfx(spin ? 'heavy' : 'light'); DUELS.pop('-' + dmg, V.set(g.x, 2.2, g.z), ''); try { DUELS.hitstop(spin ? 0.07 : 0.04); } catch (e) {}
        if (g.hp <= 0) killGhost(g, 'GHOST BUSTED!');
      } else { // a ghost: the cane passes through (stun only)
        st.phased++; g.kx = ux * 3.5; g.kz = uz * 3.5; g.stun = 0.5; g.state = 'stun'; g.t = 0; g.hit = false; sfx('whoosh'); DUELS.pop('WHOOSH', V.set(g.x, 2.2, g.z), '');
        if (!st.told || st.phased % 6 === 0) { st.told = true; DUELS.tell(hasLantern() ? 'IT\'S A GHOST! FLASH THE LANTERN (K)' : 'NO GHOST LANTERN: FISH ONE UP AT THIS PIER', 1.6); }
      }
    }
    if (!any) sfx('whoosh');
  }
  function lantern(st) {
    if (!hasLantern()) { DUELS.tell('NO GHOST LANTERN: FISH ONE UP AT THIS PIER (NIGHT)', 1.6); return; }
    if (st.lan > 0) { DUELS.tell('LANTERN RECHARGING', 0.7); return; }
    st.lan = LAN_CD; st.lanT = 0.6; fx(st.x, st.z, '#bfffe8', 1, LAN_R * 1.15, 0.6, 0.1); sfx('power'); try { DUELS.flash('#bfffe8', 0.45); } catch (e) {}
    let n = 0; for (const g of alive()) if (Math.hypot(g.x - st.x, g.z - st.z) < LAN_R) { g.solid = SOLID_T; g.stun = Math.max(g.stun, 0.45); if (g.state === 'move' || g.state === 'in') g.state = 'stun'; g.t = 0; g.hit = false; n++; }
    DUELS.tell(n ? 'SOLID! GET THEM!' : 'NO GHOSTS IN RANGE', 1.0); DUELS.log.push('phantoms:lantern:' + n);
  }

  // ---------------- the loop ----------------
  P.step = function (dt, I) {
    const st = P.st; if (!st) return; st.t += dt;
    if (st.over) { if (st.won && !st.carded && (st.outT += dt) > 1.5) { st.carded = true; DUELS.over('win', 'PIER CLEARED', 'The Fells Point Phantoms are off the Broadway pier. Captain Cobblestone still haunts the USS Constellation after dark.'); } return; }
    if (I.c) { DUELS.exit('leave'); return; }
    st.inv -= dt; st.hurt -= dt; st.atkCd -= dt; st.comboT -= dt; st.lanT -= dt; if (st.lan > 0) { st.lan = Math.max(0, st.lan - dt); } 
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 35); DUELS.say('MAVIS', 'Here, hon: a crab cake! Eat!', 2); DUELS.pop('+35', V.set(st.x, 2.2, st.z), 'w'); sfx('power'); }
    // move
    let mx = I.mx, my = I.my; const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
    const swinging = st.atk && st.atk.u < 1; const sp = (swinging ? 1.2 : 4.0) * Math.min(1, L);
    if (L > 0.12) { st.x += mx * sp * dt; st.z += -my * sp * dt; if (!swinging) st.yaw = Math.atan2(mx, -my); st.spd = sp; } else st.spd = 0;
    st.x = clamp(st.x, -PX, PX); st.z = clamp(st.z, -PZ, PZ);
    // swing (auto-aims at the nearest ghost in reach)
    if (I.a && st.atkCd <= 0 && !swinging) {
      let tg = null, td = 3.4; for (const g of alive()) { const d = Math.hypot(g.x - st.x, g.z - st.z); if (d < td) { td = d; tg = g; } } if (tg) st.yaw = Math.atan2(tg.x - st.x, tg.z - st.z);
      st.comboN = st.comboT > 0 ? (st.comboN % 3) + 1 : 1; st.atk = { u: 0, n: st.comboN, hit: false }; st.atkCd = st.comboN === 3 ? 0.62 : 0.34; sfx('whoosh'); }
    if (st.atk) { const dur = st.atk.n === 3 ? 0.6 : 0.36; st.atk.u += dt / dur; if (!st.atk.hit && st.atk.u > 0.5) { st.atk.hit = true; swingHit(st.atk.n); } if (st.atk.u >= 1) { st.comboT = 0.7; st.atk = null; } }
    if (I.b) lantern(st);
    // waves
    const act = alive(); st.left = act.length;
    if (st.wave < WAVES.length && st.left === 0 && !st.pending) { if ((st.nextT -= dt) <= 0) { const w = WAVES[st.wave]; st.pending = 1; st.wave++; w.forEach((k, i) => spawnGhost(k, i, st.wave)); st.pending = 0; st.nextT = 1.6;
      DUELS.banner('WAVE ' + st.wave + '/3<small>' + w.map((k) => KIND[k].name).filter((v, i, a) => a.indexOf(v) === i).join(' · ') + '</small>', 1.8); DUELS.log.push('phantoms:wave:' + st.wave); } }
    else if (st.wave >= WAVES.length && st.left === 0 && !st.won) { st.over = true; st.won = true; st.outT = 0; save.cleared = true; save.clears++; persist(); CITY.log.push('phantoms:cleared@' + S.time.toFixed(1)); try { JUICE.ko(); } catch (e) {} DUELS.banner('PIER CLEARED!<small>THE FOG LIFTS</small>', 2.4); DUELS.log.push('phantoms:win'); ui(); return; }
    // ghosts
    for (const g of act) {
      const d = g.d, dx = st.x - g.x, dz = st.z - g.z, dist = Math.hypot(dx, dz) || 1e-3, toH = Math.atan2(dx, dz);
      g.t += dt; g.cd -= dt; if (g.solid > 0) g.solid -= dt; g.flash = Math.max(0, g.flash - dt * 3); g.alpha = Math.min(1, g.alpha + dt * 1.4);
      if (Math.abs(g.kx) + Math.abs(g.kz) > 0.05) { g.x += g.kx * dt; g.z += g.kz * dt; const e = Math.exp(-dt * 6); g.kx *= e; g.kz *= e; }
      if (g.solid > 0 && g.state !== 'in' && (Math.abs(g.x) > PX + 0.4 || Math.abs(g.z) > PZ + 0.4)) { killGhost(g, 'OVERBOARD!'); continue; } // a solid ghost knocked off the pier sinks
      switch (g.state) {
        case 'in': { g.yaw = toH; const s = d.sp * 1.3 * dt; g.x += (dx / dist) * s; g.z += (dz / dist) * s; if (g.t > 0.9) { g.state = 'move'; g.t = 0; } break; }
        case 'move': {
          const dy = angDiff(g.yaw, toH); g.yaw += clamp(dy, -5 * dt, 5 * dt);
          if (g.kind === 'monkey') { const want = dist > 6.2 ? 1 : dist < 4 ? -1 : 0; g.x += (dx / dist) * want * d.sp * dt + (dz / dist) * g.strafe * 0.7 * dt; g.z += (dz / dist) * want * d.sp * dt - (dx / dist) * g.strafe * 0.7 * dt;
            if (g.cd <= 0 && dist < 9.5) { g.state = 'wind'; g.t = 0; g.hit = false; } }
          else { if (dist > d.rng * 0.85) { g.x += (dx / dist) * d.sp * dt; g.z += (dz / dist) * d.sp * dt; } if (dist < d.rng && g.cd <= 0) { g.state = 'wind'; g.t = 0; g.hit = false; } }
          break; }
        case 'wind': { g.yaw += clamp(angDiff(g.yaw, toH), -4 * dt, 4 * dt); if (g.t >= d.wind) { g.state = 'strike'; g.t = 0; g.hit = false; if (g.kind === 'monkey') throwBomb(g, st); } break; }
        case 'strike': { if (g.kind !== 'monkey' && !g.hit && g.t > 0.08) { g.hit = true; if (dist < d.rng + 0.35 && Math.abs(angDiff(g.yaw, toH)) < 1.2) hurtHero(d.dmg, g.kind); } if (g.t > (g.kind === 'bosun' ? 0.45 : 0.3)) { g.state = 'move'; g.t = 0; g.cd = rnd(d.cd[0], d.cd[1]); } break; }
        case 'stun': { if (g.t > g.stun) { g.state = 'move'; g.t = 0; g.cd = Math.min(g.cd, 0.5) + 0.2; } break; }
      }
      // keep ghosts off Harold and off each other
      if (g.state !== 'in') { const m = d.r + 0.45; if (dist < m) { g.x -= (dx / dist) * (m - dist); g.z -= (dz / dist) * (m - dist); } }
      for (const o of act) { if (o === g || o.state === 'in') continue; const ox = g.x - o.x, oz = g.z - o.z, od = Math.hypot(ox, oz), mm = d.r + o.d.r; if (od < mm && od > 1e-4) { g.x += (ox / od) * (mm - od) * 0.5; g.z += (oz / od) * (mm - od) * 0.5; } }
    }
    for (const g of P.ghosts) if (!g.free && g.state === 'sink') { g.sink += dt; if (g.sink > 1.0) { g.free = true; g.rig.root.visible = false; } }
    // bombs: arc to the marked spot, then a burst
    for (const b of P.bombs) if (b.on) { b.u += dt / BOMB_T; if (b.u >= 1) { b.on = false; b.m.visible = false; b.mk.visible = false; fx(b.x1, b.z1, '#9affc8', 0.5, BOMB_R * 2.6, 0.45); sfx('boom'); try { DUELS.shake(0.2); } catch (e) {}
      if (Math.hypot(st.x - b.x1, st.z - b.z1) < BOMB_R) hurtHero(11, 'bomb'); } }
    // ring fx
    for (const f of P.fx) if (f.on) { f.t += dt; const u = f.t / f.max; if (u >= 1) { f.on = false; f.m.visible = false; } else { const s = lerp(f.s0, f.s1, 1 - (1 - u) * (1 - u)); f.m.scale.set(s, s, s); f.m.material.opacity = 0.55 * (1 - u); } }
    ui();
  };
  function throwBomb(g, st) {
    const b = P.bombs.find((q) => !q.on); if (!b) return; const lead = st.spd > 0.5 ? 0.5 : 0;
    b.on = true; b.u = 0; b.x0 = g.x; b.z0 = g.z; b.x1 = clamp(st.x + Math.sin(st.yaw) * lead * st.spd * 0.5, -PX, PX); b.z1 = clamp(st.z + Math.cos(st.yaw) * lead * st.spd * 0.5, -PZ, PZ); b.m.visible = true; b.mk.visible = true; b.mk.position.set(b.x1, 0.09, b.z1); sfx('light');
    g.state = 'strike'; g.t = 0; g.hit = true;
  }
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

  // ---------------- render ----------------
  P.render = function (rdt) {
    const st = P.st; if (!st) return; const t = st.t, H = P.H;
    H.root.position.set(st.x, 0, st.z); H.root.rotation.y = st.yaw;
    let p; if (st.over && !st.won) p = HERO_POSES.hurt(0.8); else if (st.atk) p = HERO_POSES['atk' + st.atk.n](clamp(st.atk.u, 0, 1)); else if (st.hurt > 0) p = HERO_POSES.hurt(clamp(1 - st.hurt / 0.35, 0, 1)); else p = st.spd > 0.2 ? HERO_POSES.run(t, st.spd) : HERO_POSES.idle(t);
    applyPose(H, p, 16, rdt, false);
    for (const g of P.ghosts) { if (g.free) { continue; } const R = g.rig, d = g.d; let y = 0.35 + Math.sin(t * 2.2 + g.bob) * 0.12, tilt = 0, arm = 0.1;
      if (g.state === 'wind') { const u = clamp(g.t / d.wind, 0, 1); arm = -2.2 * u; tilt = -0.25 * u; y += 0.1 * u; if (R.arm) { } }
      else if (g.state === 'strike') { const u = clamp(g.t / 0.3, 0, 1); arm = lerp(-2.2, 1.1, Math.min(1, u * 3)); tilt = 0.35 * (1 - u); }
      else if (g.state === 'stun') { tilt = Math.sin(t * 30) * 0.12; arm = 0.6; }
      let sk = 1; if (g.state === 'sink') { const u = clamp(g.sink / 1.0, 0, 1); y -= u * 1.8; sk = 1 - u * 0.5; }
      R.root.position.set(g.x, y, g.z); R.root.rotation.y = g.yaw; R.root.scale.setScalar(d.sc * sk); if (R.body) R.body.rotation.x = tilt; if (R.arm) R.arm.rotation.x = arm;
      const target = g.solid > 0 ? 1 : 0.6, fade = g.state === 'sink' ? clamp(1 - g.sink / 1.0, 0, 1) : g.alpha;
      for (const m of R.ghost) { m.opacity = damp(m.opacity, target * fade, 10, rdt); const tr = m.opacity < 0.98; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = !tr || m.opacity > 0.7; if (m.emissive) m.emissive.set(g.solid > 0 ? (g.solid < 1 && Math.floor(t * 12) % 2 ? '#1c6a5a' : '#4a9a80') : '#1c6a5a'); if (m.userData && m.userData.flash) m.userData.flash.value = g.flash; }
      if (R.update) R.update(rdt, { state: g.state, solid: g.solid > 0, t: g.t }); }
    for (const b of P.bombs) if (b.on) { b.m.position.set(lerp(b.x0, b.x1, b.u), 0.9 + Math.sin(b.u * Math.PI) * 2.6 - 0.9 * b.u, lerp(b.z0, b.z1, b.u)); b.mk.rotation.z += rdt * 2; b.mk.material.opacity = 0.35 + 0.35 * Math.sin(t * 14); }
    P.wt.offset.set(t * 0.012, t * 0.02);
    P.fog.forEach((s, i) => { s.position.x += Math.sin(t * 0.2 + i) * rdt * 0.3; });
    P.lanLight.position.set(st.x, 1.6, st.z); P.lanLight.intensity = st.lanT > 0 ? 18 * clamp(st.lanT / 0.6, 0, 1) : 0;
    const cx = clamp(st.x, -6.5, 6.5); P.cam.position.set(cx, P.camH, st.z * 0.3 + P.camZ); P.cam.lookAt(cx, 0.2, st.z * 0.3 - 0.4);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 22; OUT_U.fogF.value = 52;
  };

  // ---------------- test bot ----------------
  P.botThink = function (B, dt) {
    const st = P.st; if (!st || st.over) return; B.mx = B.my = 0;
    if (B.mode === 'lose') return; // stands still and gets haunted
    const gs = alive().filter((g) => g.state !== 'in'); if (!gs.length) return;
    if (st.lan <= 0 && gs.some((g) => g.solid <= 0.5 && Math.hypot(g.x - st.x, g.z - st.z) < LAN_R - 1)) B.b = true;
    let tg = null, td = 1e9; for (const g of gs) { const d = Math.hypot(g.x - st.x, g.z - st.z) - (g.solid > 0 ? 3 : 0); if (d < td) { td = d; tg = g; } }
    const dx = tg.x - st.x, dz = tg.z - st.z, d = Math.hypot(dx, dz); if (d > 1.5) { B.mx = dx / d; B.my = -dz / d; } else if (d > 0.9) { B.mx = 0; B.my = 0; }
    if (d < 2.1) B.a = true;
  };
  DUELS.reg('phantoms', P);

  // ---------------- the city side: a ring on the Broadway pier; night only (the lantern comes from fishing here) ----------------
  const SPOT = { x: 134, z: -22.6 };
  let n = 0;
  MODE.ticks.push((rdt) => {
    n++;
    if (n === 1) {
      const y = groundY(SPOT.x, SPOT.z);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: ringT, color: '#7dffc8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(SPOT.x, y + 0.05, SPOT.z); ring.renderOrder = 2; ring.visible = false; scene.add(ring); P.ring = ring;
      const act = { kind: 'phantoms', x: SPOT.x, z: SPOT.z, r: 1.7, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('phantoms')),
        go: () => { if (!isNight()) { banner('THE PHANTOMS ONLY COME OUT AFTER DARK. COME BACK AT NIGHT.', 2.4); return; }
          if (!hasLantern()) { banner('THE PHANTOMS WALK ON WATER. FISH UP A GHOST LANTERN FROM THIS PIER (NIGHT) FIRST.', 3.2); return; }
          DUELS.start('phantoms'); } };
      Object.defineProperty(act, 'label', { get: () => (!isNight() ? 'PHANTOMS: AFTER DARK' : !hasLantern() ? 'PHANTOMS: NEED LANTERN' : save.cleared ? 'PHANTOMS AGAIN' : 'FIGHT PHANTOMS'), configurable: true });
      ACTIONS.push(act); P.act = act;
    }
    if (P.ring) { const d = Math.hypot(SPOT.x - hero.pos.x, SPOT.z - hero.pos.z); P.ring.visible = d < 20 && !DUELS.cur; if (P.ring.visible) { P.ring.rotation.z += rdt * 0.7; P.ring.material.opacity = 0.6 + 0.3 * Math.sin(S.time * 3); } }
    if (n === 3 && Q.has('phantoms') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('phauto'); DUELS.start('phantoms', m === 'win' || m === 'lose' ? { bot: m } : {}); }
  });
  window.__phantoms = P; P.save = save; P.KIND = KIND; P.reset = () => { Object.assign(save, { cleared: false, clears: 0, losses: 0 }); persist(); };
})();

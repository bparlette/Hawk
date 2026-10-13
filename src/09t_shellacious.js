
// ======================= DR. SHELLACIOUS, SCIENCE CENTER IMAX: a mad-scientist turtle duel in front of the giant dome screen (DESIGN.md "Bosses":
// Science Center: Dr. Shellacious, mad snapping-turtle scientist, IMAX; BOSS_GANG_UPGRADE_PLAN #13). A behind-the-player view down the front aisle of the
// big theater: Harold on the carpet, Mavis by the front row with a popcorn tub, Dr. Shellacious (an original snapping turtle in a lab coat, goggles, wild
// white hair, a glowing beaker) in front of the huge curved screen playing an original monster movie ("ATTACK OF THE 50-FOOT TADPOLE" in fake 3D).
// No real logos: the screen shows only made-up titles; signs are generic ("NOW SHOWING", "EXIT").
// Attacks (every tell >= 1.0 s: a "!" over the doctor, a floor / lane glow, a sound sting, a HUD call-out):
//   SHELL RICOCHET: he tucks into his shell (it glows green) and the bounce path lights up across the floor as a chain of dots; then the shell ricochets off the
//        walls and through Harold's row 2 times (3 in phases 2-3, one per lane). The lane it crosses NEXT flashes red: stand in a lane that isn't flashing.
//   3D BEAKER LOB: the movie goes red / cyan (fake 3D), he swirls a beaker, and the beakers' SHADOWS grow on the floor in two lanes. Stand in the lane with no
//        shadow before they land (green goo splash).
//   FREEZE-FRAME: the projector PAUSES the movie (pause bars on the screen) and a glowing film strip charges at chest height in front of him, then runs down the
//        aisle at Harold: DUCK under it (phase 3: a double feature, two strips back to back).
// After every attack he is OPEN (dizzy from the ricochet / beaker arm out / the projector overheats): SWING. 3-hit cane combo with this fight's own finisher:
// a spinning "REEL SPIN" cane twirl (cyan sparks, words CUT! / THAT'S A WRAP! / SPOILER!). Swinging into his guard is BLOCKED. Hits and clean dodges fill
// POWER; full POWER = ACT "PLOT TWIST" (team-up: Mavis rolls her popcorn tub under his feet, Harold cane-hooks his leg and flips him onto his back; he spins
// helplessly on his shell: big damage). 3 phases (the HP bar has 3 pips).
// Easy-but-not-trivial (Chip Kid standard): ~half damage, 1.3 s i-frames, Mavis tosses popcorn when Harold is low (once a phase), one SECOND WIND,
// a heal between phases. A mash-SWING-only bot wins while taking hits.
// KO: he spins helplessly on his back while original end credits roll up the screen. Then DUELS.bossCleared('science') -> BOSS_CLEAR.clear('science')
// (src/06g0_boss_clear.js, unchanged). Star grade by hits taken (<=3 S, <=8 A, else B) on the win card; the entry ring stays lit for a REMATCH.
// Controls (the duel conventions): phone: stick left / right (or the white buttons) dodge, stick down or JUMP = DUCK, SWING = cane, ACT = PLOT TWIST.
// Desktop: A / D dodge, S or K duck, J swing, E plot twist. Gamepad: left stick / LB / RB dodge, A duck, X swing, Y plot twist.
// Entry: the glowing ring at the Science Center boss anchor (LANDMARKS 'science' boss {x -54, z 41}; DESIGN anchor, not temporary). ACT = FIGHT DR. SHELL.
// Tests: ?shellacious=1 starts at load; &shellaciousauto=win|lose|mash plays it by itself (also ?duel=shellacious&duelbot=...); ?shellaciousphase=N starts at phase N.
// Writing: GR1 bosses.dr_shellacious intro / defeat lines (06e_gr1_data.js), GR10 clear banner "DR. SHELLACIOUS CRACKED!", + short placeholder lines below.
// Shared files: none edited (new file only; build.sh picks up src/0*.js).
//
// RIG HOOK (Opus): if window.buildDrShellacious exists it is called as buildDrShellacious({ THREE, toonMat, outlineMat, addOdir, QUAL }) and may return
//   { root, body?, head?, armL?, armR?, beaker?, ball?, flash?: [materials], update?(dt, state, info) }
//   root: Object3D, feet at y 0 on the theater floor, facing +z (toward Harold / the camera), about 2.6 m tall with the hair.
//   body: the part that tilts / flips (rotation.x tips him back; the PLOT TWIST + KO lay him on his back: body rotation.x = -PI/2, position y 0.78 / z 1.3, and spin root.rotation.y).
//   armL / armR: shoulder pivots (armL = his left = screen right). rotation.x < 0 raises the arm. beaker: a group in his right hand, swirled during the lob tell.
//   ball: optional "tucked in shell" object (about 1.3 m wide, centred on its origin; placed at y 0.62) used for the SHELL RICOCHET; else a stand-in shell ball.
//   update(dt, state, info): optional, called every frame; state one of intro | guard | shellTell | shell | lobTell | lob | frzTell | frz | open | flipped |
//     down | ko; info = { t, u (0..1 through the state), lane (next crossing lane -1..1, or the safe lane), phase }. If update exists the core skips its own
//     part animation. Missing pieces are skipped (stand-in groups fill them). Otherwise the procedural stand-in turtle below is used.
(function () {
  const C = { scene: null, cam: null, title: 'DR. SHELLACIOUS', pips: 3,
    hint: '<b>A / D</b> dodge · <b>S</b> duck · <b>J</b> swing · <b>E</b> plot twist (POWER)',
    labels: { a: 'SWING', b: 'DUCK', c: 'TWIST', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 5.4, SZ = 13, LANE = 1.4; // the doctor at z = MZ facing -z, the screen at z = SZ, Harold at z = 0 facing +z. Screen right = world -x.
  const PH = [ // per phase: tell lengths, shell speed + crossings, freeze strip speed + count, open window, guard time, attack mix
    { shell: 1.5, spd: 7.0, n: 2, lob: 1.45, frz: 1.45, fspd: 9, fn: 1, guard: [1.0, 1.5], open: 1.8, mix: ['shell', 'lob', 'frz', 'lob', 'shell', 'frz'] },
    { shell: 1.35, spd: 7.5, n: 3, lob: 1.3, frz: 1.3, fspd: 10, fn: 1, guard: [0.8, 1.3], open: 1.6, mix: ['lob', 'frz', 'shell', 'frz', 'shell', 'lob'] },
    { shell: 1.2, spd: 8.0, n: 3, lob: 1.15, frz: 1.2, fspd: 11, fn: 2, guard: [0.6, 1.0], open: 1.45, mix: ['frz', 'shell', 'lob', 'shell', 'frz', 'lob', 'shell'] },
  ];
  const DMG = { shell: 8, beaker: 8, freeze: 10 }, SWING = [6, 6, 13], TWIST = 26;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const TAUNT = ['Welcome to my lab! The screen is HUGE!', 'My experiments need a test toad!', 'Goggles down! Science is about to hurt!'];
  const MID = ['Observe! A toad in its natural habitat: losing!', 'Hypothesis: you dodge left. Ha! Noted.', 'Put on your 3D glasses, Harold!', 'Shell-ebrate good times, come on!', 'Peer review THIS!'];
  const MAVIS = ['Get him, Harold! He talks during the movie!', 'Mind the beakers, hon!', 'Shh! Some of us paid for this show!', 'Plot twist, hon!'];
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'science'); const g = (window.GR1 || (typeof GR1 !== 'undefined' ? GR1 : null)); return (g && g.bosses && g.bosses.dr_shellacious) || (L && L.boss && L.boss.lines) || null; };

  // ---------------- textures ----------------
  function carpetTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a1640'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = rnd(0, w), y = rnd(0, h), r = rnd(6, 16); g.strokeStyle = ['#e0b020', '#3ad0ff', '#ff5fa2'][i % 3]; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, rnd(0, 3), rnd(3, 6.2)); g.stroke(); } }, 256); }
  function wallTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1a1030'; g.fillRect(0, 0, w, h); for (let x = 0; x < 8; x++) { g.fillStyle = x % 2 ? '#22143c' : '#1c1034'; g.fillRect(x * 32, 0, 30, h); } g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, w, 8); }, 128); }
  // the "movie": an original 1950s-style creature feature, drawn wide; FAKE 3D = red / cyan doubled outlines
  function movieTex() { return canvasTex(1024, 448, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a2a5a'); gr.addColorStop(0.62, '#3a7ab8'); gr.addColorStop(0.63, '#1a4a3a'); gr.addColorStop(1, '#0a2a1a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) { const bw = rnd(30, 60), bh = rnd(50, 150), x = i * 48; g.fillStyle = '#0c1a2a'; g.fillRect(x, h * 0.63 - bh, bw, bh); g.fillStyle = '#ffd86a'; for (let k = 0; k < 6; k++) g.fillRect(x + 6 + (k % 2) * 16, h * 0.63 - bh + 10 + Math.floor(k / 2) * 22, 6, 8); }
    const blob = (dx, col) => { g.save(); g.translate(560 + dx, 250); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 120, 92, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-100, 30); g.quadraticCurveTo(-260, 120, -330, 30); g.quadraticCurveTo(-250, 70, -110, -10); g.fill(); g.restore(); };
    g.globalAlpha = 0.65; blob(-10, '#ff2a4a'); blob(10, '#2affff'); g.globalAlpha = 1; blob(0, '#2a3a2a');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(600, 220, 26, 0, TAU); g.arc(520, 220, 26, 0, TAU); g.fill(); g.fillStyle = '#14101f'; g.beginPath(); g.arc(606, 226, 11, 0, TAU); g.arc(526, 226, 11, 0, TAU); g.fill();
    g.fillStyle = '#14101f'; g.fillRect(520, 280, 90, 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 54px ' + FONT; // the title card along the bottom (the camera looks down over the doctor's head at it; the top edge sits under the HUD bars)
    g.fillStyle = '#ff2a4a'; g.fillText('ATTACK OF THE 50-FOOT TADPOLE', w / 2 - 4, h - 74); g.fillStyle = '#2affff'; g.fillText('ATTACK OF THE 50-FOOT TADPOLE', w / 2 + 4, h - 74);
    g.fillStyle = '#fff2a0'; g.fillText('ATTACK OF THE 50-FOOT TADPOLE', w / 2, h - 74); g.font = '700 26px ' + FONT; g.fillStyle = '#fff'; g.fillText('IN SHELL-O-VISION 3D!', w / 2, h - 30); }, 512); }
  function pauseTex() { return canvasTex(512, 224, (g, w, h) => { g.fillStyle = 'rgba(10,30,60,0.55)'; g.fillRect(0, 0, w, h); g.fillStyle = '#bff4ff'; g.fillRect(w / 2 - 70, 30, 44, 130); g.fillRect(w / 2 + 26, 30, 44, 130);
    g.textAlign = 'center'; g.font = '900 34px ' + FONT; g.fillText('FREEZE-FRAME', w / 2, 200); }, 256); }
  function filmTex() { return canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#0a1420'; g.fillRect(0, 0, w, h); g.fillStyle = '#bff4ff';
    for (let x = 6; x < w; x += 22) { g.fillRect(x, 6, 12, 12); g.fillRect(x, h - 18, 12, 12); }
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#5ad8ff' : '#9ff0ff'; g.fillRect(10 + k * 84, 26, 74, 44); g.fillStyle = '#0a1420'; g.beginPath(); g.arc(47 + k * 84, 48, 12, 0, TAU); g.fill(); } }, 256); }
  function creditsTex() { return canvasTex(512, 1024, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    const L = [['900 40px', '#ffd23c', 'SHELL SHOCKED'], ['700 20px', '#fff', 'a Toad City picture'], ['', '', ''], ['700 18px', '#9ff0ff', 'STARRING'], ['900 30px', '#fff', 'HAROLD'], ['700 18px', '#9ff0ff', 'AND'], ['900 30px', '#fff', 'MAVIS'],
      ['700 16px', '#9ff0ff', '(best supporting popcorn)'], ['', '', ''], ['700 18px', '#9ff0ff', 'WITH'], ['900 26px', '#fff', 'DR. SHELLACIOUS'], ['700 16px', '#9ff0ff', 'as himself, upside down'], ['', '', ''],
      ['700 18px', '#fff', 'CANE CHOREOGRAPHY .... HAROLD'], ['700 18px', '#fff', 'BEAKER WRANGLER .... NOBODY'], ['700 18px', '#fff', 'FILMED ON LOCATION IN'], ['900 24px', '#ffd23c', 'BALTIMORE, HON'], ['', '', ''],
      ['700 15px', '#cfc8ef', 'No turtles were harmed.'], ['700 15px', '#cfc8ef', 'One was extremely embarrassed.'], ['', '', ''], ['900 40px', '#ffd23c', 'THE END']];
    let y = 120; for (const [f, c, t] of L) { if (t) { g.font = f + ' ' + FONT; g.fillStyle = c; g.fillText(t, w / 2, y); } y += t ? 40 : 30; } }, 512); }
  function signTex(text, bg, fg) { return canvasTex(512, 128, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 64px ' + FONT; g.fillText(text, w / 2, h / 2); }, 256); }

  // ---------------- the arena: the front of the big theater ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const ct = carpetTex(); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 34), new THREE.MeshLambertMaterial({ map: ct })); floor.rotation.x = -Math.PI / 2; floor.position.z = 5; sc.add(floor);
    const wt = wallTex(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(5, 2);
    const wallM = new THREE.MeshLambertMaterial({ map: wt });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), wallM); w.position.set(s * 9.5, 6, 5); w.rotation.y = -s * Math.PI / 2; sc.add(w); }
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), wallM); bw.position.set(0, 6, SZ + 0.6); bw.rotation.y = Math.PI; sc.add(bw);
    // the giant screen (curved: 5 panels on an arc, one texture across them), then the pause / credits overlays on top
    C.movieT = movieTex(); C.movieT.wrapS = THREE.RepeatWrapping;
    C.screenM = new THREE.MeshBasicMaterial({ map: C.movieT, fog: false, color: '#ffffff' });
    C.screen = new THREE.Group(); sc.add(C.screen);
    const PW = 3.9, PHt = 8.4, Rr = 15;
    for (let i = 0; i < 5; i++) { const g = new THREE.PlaneGeometry(PW + 0.03, PHt);
      const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 5);
      const th = (2 - i) * (PW / Rr); // panel i = 0 is screen left (world +x); each faces the arc's centre
      const m = new THREE.Mesh(g, C.screenM); m.position.set(Rr * Math.sin(th), 5.5, SZ - Rr + Rr * Math.cos(th)); m.rotation.y = Math.PI + th; C.screen.add(m); }
    C.pause = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.94), new THREE.MeshBasicMaterial({ map: pauseTex(), transparent: true, fog: false, depthWrite: false })); C.pause.position.set(0, 5.6, SZ - 0.4); C.pause.rotation.y = Math.PI; C.pause.visible = false; sc.add(C.pause);
    const crT = creditsTex(); crT.repeat.set(1, 0.42); crT.offset.y = 1; C.credT = crT;
    C.credits = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 8.2), new THREE.MeshBasicMaterial({ map: crT, fog: false })); C.credits.position.set(0, 5.5, SZ - 2.6); // in front of the curve's centre panels C.credits.rotation.y = Math.PI; C.credits.visible = false; sc.add(C.credits);
    const R = K();
    R.add(G.box(20.6, 0.4, 0.3), '#14101f', 0, 1.15, SZ - 0.9).add(G.box(20.6, 0.4, 0.3), '#14101f', 0, 9.85, SZ - 0.9); // screen frame (top + bottom)
    // the low stage lip in front of the screen, the front rows of seats on both sides, a speaker stack each side, wall sconces
    R.add(G.box(16, 0.5, 1.4), '#3a2450', 0, 0.25, SZ - 2.8).add(G.box(16.2, 0.06, 1.45), '#e0b020', 0, 0.52, SZ - 2.8);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) { const x = s * (4.6 + k * 1.05); R.add(G.box(0.9, 0.5, 0.8), '#b0203a', x, 0.45, -0.6).add(G.box(0.9, 0.9, 0.18), '#b0203a', x, 0.85, -1.0).add(G.box(0.12, 0.6, 0.8), '#2a1a3a', x + 0.5, 0.4, -0.6); }
      for (let k = 0; k < 4; k++) { const x = s * (4.6 + k * 1.05); R.add(G.box(0.9, 0.5, 0.8), '#b0203a', x, 0.75, -2.4).add(G.box(0.9, 0.9, 0.18), '#b0203a', x, 1.15, -2.8); }
      R.add(G.box(1.4, 3.2, 1.2), '#1a1424', s * 8.4, 1.6, SZ - 3.4).add(G.cyl(0.45, 0.45, 0.06, 14), '#3a3448', s * 8.4, 2.4, SZ - 4.02, Math.PI / 2, 0, 0).add(G.cyl(0.3, 0.3, 0.06, 12), '#3a3448', s * 8.4, 1.1, SZ - 4.02, Math.PI / 2, 0, 0);
      for (let k = 0; k < 5; k++) R.add(G.box(0.4, 0.5, 0.08), '#ffd86a', s * 9.4, 2.6, -1 + k * 3);
    }
    // his portable lab bench on screen left (world +x): flasks + a little tesla coil
    R.add(G.box(2.4, 0.95, 0.9), '#5a5e66', 4.4, 0.48, MZ + 0.6).add(G.box(2.5, 0.08, 1.0), '#2a2c30', 4.4, 0.99, MZ + 0.6)
      .add(G.cyl(0.08, 0.12, 1.2, 8), '#8a8e96', 3.6, 1.6, MZ + 0.6).add(G.tor(0.18, 0.05, TAU, 6, 12), '#c87a3a', 3.6, 2.0, MZ + 0.6, Math.PI / 2, 0, 0).add(G.tor(0.26, 0.05, TAU, 6, 12), '#c87a3a', 3.6, 1.7, MZ + 0.6, Math.PI / 2, 0, 0)
      .add(G.sph(0.22, 10, 8), '#c8d0d6', 3.6, 2.3, MZ + 0.6);
    for (let k = 0; k < 3; k++) R.add(G.cyl(0.08, 0.2, 0.42, 10), ['#7dff9a', '#ff5fa2', '#3ad0ff'][k], 4.4 + k * 0.45, 1.24, MZ + 0.5);
    sc.add(R.mesh(toonMat(), null, 0.003));
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTex('NOW SHOWING', '#14101f', '#ffd23c'), fog: false })); ns.position.set(-9.4, 4.4, 6); ns.rotation.y = Math.PI / 2; sc.add(ns);
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ map: signTex('EXIT', '#1a5a2a', '#9dff6b'), fog: false })); ex.position.set(9.4, 3.2, 2); ex.rotation.y = -Math.PI / 2; sc.add(ex);
    const n = 24, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(i % 2 ? -1 : 1) * 3.0, 0.06, -3 + Math.floor(i / 2) * 1.4], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sc.add(new THREE.Points(g, new THREE.PointsMaterial({ map: DUELS.dot('#ffd86a'), size: 0.25, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  }

  // ---------------- the doctor stand-in: an upright snapping turtle in a lab coat, goggles, wild white hair, a beaker; + a shell ball for the ricochet ----------------
  function shellBall() {
    const K = DUELS.kit, G = DUELS.GEO, g = new THREE.Group(), m = toonMat();
    const B = K(); B.add(G.sph(0.66, 16, 10), '#3a6a2a', 0, 0, 0, 0, 0, 0, 1, 0.62, 1).add(G.cyl(0.67, 0.67, 0.12, 16), '#d8c88a', 0, -0.05, 0);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; B.add(G.sph(0.2, 8, 6), '#2a4a1e', Math.cos(a) * 0.36, 0.28, Math.sin(a) * 0.36, 0, 0, 0, 1, 0.5, 1); }
    B.add(G.sph(0.2, 8, 6), '#2a4a1e', 0, 0.4, 0, 0, 0, 0, 1, 0.5, 1);
    B.mesh(m, g, 0.003); g.userData.m = m; return g;
  }
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), flash: [] };
    const bM = toonMat(), aM = [toonMat(), toonMat()]; R.flash = [bM, aM[0], aM[1]]; R.bM = bM;
    R.body = new THREE.Group(); R.root.add(R.body);
    const B = K();
    for (const s of [-1, 1]) B.add(G.cyl(0.18, 0.22, 0.6, 8), '#5a8a3a', s * 0.32, 0.3, 0).add(G.sph(0.26, 8, 6), '#4a7a2a', s * 0.34, 0.08, 0.1, 0, 0, 0, 1, 0.5, 1.3);
    // the shell on his back (dome toward -z), the plastron in front
    B.add(G.sph(0.8, 16, 10), '#3a6a2a', 0, 1.25, -0.25, 0, 0, 0, 0.95, 1.05, 0.6);
    for (let k = 0; k < 5; k++) B.add(G.sph(0.24, 8, 6), '#2a4a1e', (k % 3 - 1) * 0.36, 1.0 + Math.floor(k / 3) * 0.45, -0.66, 0, 0, 0, 1, 1, 0.4);
    B.add(G.sph(0.66, 14, 10), '#d8c88a', 0, 1.2, 0.05, 0, 0, 0, 0.9, 1.05, 0.55);
    // the lab coat: open-front white coat panels + collar, a pocket with pens
    for (const s of [-1, 1]) B.add(G.box(0.42, 1.25, 0.9), '#f4f4f0', s * 0.6, 1.15, -0.1).add(G.box(0.18, 0.5, 0.12), '#f4f4f0', s * 0.42, 1.75, 0.3, 0, 0, s * 0.3);
    B.add(G.box(0.2, 0.22, 0.04), '#e4e4e0', -0.62, 1.2, 0.37).add(G.cyl(0.02, 0.02, 0.18, 5), '#2a5ad8', -0.58, 1.33, 0.38).add(G.cyl(0.02, 0.02, 0.18, 5), '#d8302a', -0.66, 1.33, 0.38);
    // the head: neck, a hooked snapping-turtle beak, big goggles on the forehead, wild white hair
    B.add(G.cyl(0.2, 0.26, 0.45, 10), '#5a8a3a', 0, 1.95, 0.08, 0.25, 0, 0).add(G.sph(0.38, 14, 10), '#5a8a3a', 0, 2.25, 0.2, 0, 0, 0, 1, 0.9, 1.15);
    B.add(G.cone(0.13, 0.28, 8), '#c8b060', 0, 2.12, 0.62, Math.PI / 2 + 0.5, 0, 0).add(G.box(0.36, 0.04, 0.2), '#2a3a1a', 0, 2.1, 0.48);
    for (const s of [-1, 1]) B.add(G.sph(0.09, 8, 6), '#ffffff', s * 0.17, 2.32, 0.5).add(G.sph(0.045, 6, 5), '#14101f', s * 0.17, 2.32, 0.58)
      .add(G.tor(0.12, 0.035, TAU, 6, 12), '#8a5a2a', s * 0.16, 2.5, 0.42, 0.3, 0, 0).add(G.cyl(0.11, 0.11, 0.03, 12), '#5ad8ff', s * 0.16, 2.5, 0.43, Math.PI / 2 + 0.3, 0, 0);
    B.add(G.box(0.62, 0.05, 0.05), '#5a3a1a', 0, 2.5, 0.25);
    for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.6; B.add(G.cone(0.1, 0.38, 6), '#f4f4f4', Math.sin(a) * 0.36, 2.55 + Math.cos(a) * 0.12, -0.05 - Math.abs(Math.sin(a)) * 0.05, 0, 0, -a * 0.9); }
    B.add(G.sph(0.2, 8, 6), '#f4f4f4', -0.32, 2.38, -0.05).add(G.sph(0.2, 8, 6), '#f4f4f4', 0.32, 2.38, -0.05);
    R.bodyM = B.mesh(bM, R.body);
    R.head = R.body;
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.8, 1.68, 0.05); R.body.add(sh);
      const A = K(); A.add(G.sph(0.2, 8, 6), '#f4f4f0', 0, 0, 0).add(G.cyl(0.14, 0.17, 0.62, 8), '#f4f4f0', 0, -0.32, 0.05).add(G.sph(0.14, 8, 6), '#5a8a3a', 0, -0.7, 0.08)
        .add(G.cone(0.04, 0.12, 5), '#c8b060', 0.06, -0.82, 0.12).add(G.cone(0.04, 0.12, 5), '#c8b060', -0.06, -0.82, 0.12);
      A.mesh(aM[s > 0 ? 0 : 1], sh); R.arms.push({ sh, s }); }
    R.armL = R.arms[0].sh; R.armR = R.arms[1].sh;
    R.beaker = new THREE.Group(); R.beaker.position.set(0, -0.86, 0.14); R.armR.add(R.beaker);
    { const T = K(); T.add(G.cyl(0.13, 0.17, 0.34, 10), '#cfeaf0', 0, 0, 0).add(G.cyl(0.07, 0.11, 0.14, 8), '#cfeaf0', 0, 0.22, 0); T.mesh(toonMat(), R.beaker, 0.003);
      const L = K(); L.add(G.cyl(0.135, 0.175, 0.24, 10), '#7dff9a', 0, -0.06, 0); R.liqM = toonMat(); L.mesh(R.liqM, R.beaker, 0); R.flash.push(R.liqM); }
    return R;
  }

  // ---------------- build ----------------
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#120a22', 22, 48);
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 120);
    DUELS.sceneLights(sc, '#c8d4ff', '#2a1a40', 1.25, '#ffffff', 1.3, new THREE.Vector3(0.3, 1, -0.6));
    const pl = new THREE.PointLight('#9fd8ff', 30, 20, 1.2); pl.position.set(0, 5, SZ - 3.5); sc.add(pl); C.scrL = pl;
    buildArena(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildDrShellacious === 'function') rig = window.buildDrShellacious({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    if (!rig.body) rig.body = rig.root;
    if (!rig.beaker) { rig.beaker = new THREE.Group(); rig.body.add(rig.beaker); }
    if (!rig.arms) { rig.arms = []; if (rig.armL) rig.arms.push({ sh: rig.armL, s: -1 }); if (rig.armR) rig.arms.push({ sh: rig.armR, s: 1 }); }
    rig.flash = rig.flash || [];
    C.R = rig; rig.root.position.set(0, 0, MZ); rig.root.rotation.y = Math.PI; sc.add(rig.root);
    C.ball = rig.ball || shellBall(); C.ball.visible = false; sc.add(C.ball);
    // lane warning strips (Harold's row), the ricochet path dots, beaker shadows + flying beakers, the freeze strips, puffs, sparks, the popcorn tub
    C.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.6), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.03, 0); m.visible = false; sc.add(m); return m; });
    C.dots = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ map: DUELS.dot('#d8ff4a', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 96);
    C.dots.count = 0; C.dots.frustumCulled = false; C.dots.visible = false; sc.add(C.dots);
    const shT = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 60); r.addColorStop(0, 'rgba(0,0,0,.95)'); r.addColorStop(0.7, 'rgba(10,0,20,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#ff3d3d'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke(); }, 128);
    C.shadows = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: shT, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.05, 0); m.visible = false; sc.add(m); return m; });
    C.beakers = [0, 1].map(() => { const g = new THREE.Group(), T = DUELS.kit(); T.add(DUELS.GEO.cyl(0.2, 0.26, 0.5, 10), '#cfeaf0', 0, 0, 0).add(DUELS.GEO.cyl(0.21, 0.27, 0.32, 10), '#7dff9a', 0, -0.07, 0).add(DUELS.GEO.cyl(0.1, 0.16, 0.2, 8), '#cfeaf0', 0, 0.34, 0); T.mesh(toonMat(), g, 0.003); g.visible = false; sc.add(g); return g; });
    const ft = filmTex();
    C.strips = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.8), new THREE.MeshBasicMaterial({ map: ft, color: '#bff4ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })); m.position.set(0, 1.4, MZ - 1); m.visible = false; sc.add(m); return m; });
    C.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#7dff9a'), transparent: true, depthWrite: false, fog: false }), 60); C.puffM.count = 0; C.puffM.frustumCulled = false; sc.add(C.puffM); C.puffs = [];
    C.spark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: DUELS.dot('#bff4ff', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 48); C.spark.count = 0; C.spark.frustumCulled = false; sc.add(C.spark); C.sparks = [];
    C.tub = new THREE.Group(); C.tub.visible = false; sc.add(C.tub);
    { const S = DUELS.kit(); S.add(DUELS.GEO.cyl(0.42, 0.3, 0.7, 12), '#e02a3a', 0, 0, 0).add(DUELS.GEO.cyl(0.43, 0.43, 0.12, 12), '#f4f4f0', 0, 0.12, 0).add(DUELS.GEO.sph(0.4, 10, 8), '#ffe08a', 0, 0.38, 0, 0, 0, 0, 1, 0.5, 1); S.mesh(toonMat(), C.tub, 0.003); }
    // DOM: the "!" over the doctor, damage pops, the POWER bar (in the sub HUD), the red / cyan fake-3D overlay, the frozen frost
    const css = document.createElement('style');
    css.textContent = `#duel .shbang { position: absolute; left: 0; top: 0; font-size: 34px; color: #7dff9a; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; transform: translate(-50%, -100%); display: none; animation: shb .3s infinite alternate; }
    @keyframes shb { from { transform: translate(-50%, -100%) scale(1); } to { transform: translate(-50%, -110%) scale(1.2); } }
    #duel .shpop { position: absolute; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; transform: translate(-50%, -50%); animation: shp .8s ease-out forwards; white-space: nowrap; }
    #duel .shpop.big { font-size: 22px; color: #5ad8ff; } #duel .shpop.w { font-size: 18px; color: #7dff9a; }
    @keyframes shp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.6); } 20% { transform: translate(-50%, -80%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
    #duel .shpow { display: inline-block; width: 92px; height: 9px; border: 2px solid #14101f; background: #1a2a40; border-radius: 6px; overflow: hidden; vertical-align: middle; margin-left: 4px; }
    #duel .shpow i { display: block; height: 100%; background: linear-gradient(#bff4ff, #3ab8ff); }
    #duel .shpow.full i { background: linear-gradient(#fff, #7dff9a); animation: dlow .3s infinite alternate; }
    #duel .sh3d { position: absolute; inset: 0; opacity: 0; background: linear-gradient(90deg, rgba(255,30,60,.42), rgba(255,30,60,0) 38%, rgba(30,255,255,0) 62%, rgba(30,255,255,.42)); }
    #duel .shfrost { position: absolute; inset: 0; opacity: 0; box-shadow: inset 0 0 80px 28px rgba(160,235,255,.9); background: rgba(160,235,255,.12); }
    body.duel-shellacious #duel .dtell { white-space: normal; max-width: 88vw; text-align: center; top: 25%; }
    @media (max-width: 480px) { #duel .shpow { width: 70px; } body.duel-shellacious #duel .dtell { font-size: 11px; } }`;
    document.head.appendChild(css);
    C.bang = document.createElement('div'); C.bang.className = 'shbang'; C.bang.textContent = '!'; DUELS.hudEl.appendChild(C.bang);
    C.ana = document.createElement('div'); C.ana.className = 'sh3d'; DUELS.hudEl.insertBefore(C.ana, DUELS.hudEl.firstChild);
    C.frost = document.createElement('div'); C.frost.className = 'shfrost'; DUELS.hudEl.insertBefore(C.frost, DUELS.hudEl.firstChild);
  };

  // ---------------- state ----------------
  function reset(phase, hp = 100) {
    const old = C.st;
    const st = C.st = { t: 0, phase, mhp: 100, hp, pow: old ? old.pow * 0.5 : 0, lane: 0, duck: false, lockT: 0, swingT: -1, combo: 0, comboT: 0, swingCd: 0, hurtT: 0, inv: 0, frozeT: 0,
      ms: 'intro', mt: 0, mdur: phase === 0 && !old ? 2.6 : 1.4, mixI: Math.floor(Math.random() * 2), cross: [], crossI: 0, path: null, safe: 0, fz: [99, 99], fhit: [false, false], hitThis: false, dodged: false, gotHit: false,
      over: false, won: false, outT: 0, stop: 0, slow: 1, slowT: 0, shake: 0, twT: -1, healUsed: false, wind: old ? old.wind : true,
      stats: old && old.stats || { swings: 0, landed: 0, blocked: 0, twists: 0, dodges: 0, hitsTaken: 0, hits: { shell: 0, beaker: 0, freeze: 0 }, attacks: { shell: 0, lob: 0, frz: 0 }, heals: 0, winds: 0, maxCombo: 0 } };
    C.puffs.length = 0; C.sparks.length = 0; clearFx();
    const R = C.R; R.root.visible = true; R.root.position.set(0, 0, MZ); R.root.rotation.set(0, Math.PI, 0); R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0);
    C.ball.visible = false; C.tub.visible = false; C.credits.visible = false; C.pause.visible = false; C.screenM.color.set('#ffffff'); if (C.ana) C.ana.style.opacity = '0';
    return st;
  }
  function subHud(st) { const f = st.pow >= 1;
    DUELS.sub('POWER<span class="shpow' + (f ? ' full' : '') + '"><i style="width:' + Math.round(st.pow * 100) + '%"></i></span>' + (st.combo > 1 ? ' <span style="color:#5ad8ff">x' + st.combo + '</span>' : ''), 'PHASE ' + (st.phase + 1) + '/3'); }
  C.start = function () {
    C.st = null; const ph = clamp(+(Q.get('shellaciousphase') || 1) - 1, 0, 2) | 0; const st = reset(ph); DUELS.log.push('shellacious:' + C.rigKind); subHud(st);
    DUELS.banner('DR. SHELLACIOUS<small>SCIENCE CENTER THEATER · PHASE ' + (ph + 1) + '</small>', 2.4);
    const l = lines(); DUELS.say('DR. SHELLACIOUS', l && l.intro ? pick(l.intro) : pick(TAUNT), 3.4);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 2.4, MZ);
  };
  C.retry = function () { const p = C.st.phase; C.st = null; reset(p); C.st.ms = 'guard'; C.st.mdur = 1.4; subHud(C.st); DUELS.banner('PHASE ' + (p + 1) + '<small>RE-SHOOT! FULL HEALTH</small>', 1.6); };
  C.exit = function () { clearFx(); if (C.bang) C.bang.style.display = 'none'; if (C.ana) C.ana.style.opacity = '0'; if (C.frost) C.frost.style.opacity = '0'; C.hudPops(true); };

  // ---------------- small fx + sound ----------------
  function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  function noise(dur, vol = 0.12, hp = 1200, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); s.start(t); } catch (e) {} }
  const sting = (k) => { if (k === 'shell') { for (let i = 0; i < 4; i++) tone(220 + i * 110, 260 + i * 110, 0.12, 'square', 0.07, i * 0.12); } else if (k === 'lob') { tone(400, 900, 0.5, 'sine', 0.08); tone(420, 920, 0.5, 'sine', 0.06, 0.05); noise(0.4, 0.05, 2500, 0.2); }
    else if (k === 'frz') { tone(1200, 300, 0.7, 'sawtooth', 0.05); for (let i = 0; i < 6; i++) noise(0.03, 0.12, 4000, i * 0.09); } else if (k === 'ding') { tone(1760, 1700, 0.5, 'triangle', 0.14); } else if (k === 'boing') { tone(160, 520, 0.18, 'triangle', 0.14); } };
  function puff(p, v, life = 1.0, s = 1) { if (C.puffs.length < 60) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function spark(p, n = 6) { for (let k = 0; k < n && C.sparks.length < 48; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 1)), t: 0, life: rnd(0.3, 0.6) }); }
  const POPS = [];
  function pop(text, p, cls = '') { const e = document.createElement('div'); e.className = 'shpop ' + cls; e.textContent = text; V3.copy(p).project(C.cam); e.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; e.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 0 }); }
  C.hudPops = function (clear, dt = 0) { for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].t += dt; if (clear || POPS[i].t > 0.85) { POPS[i].e.remove(); POPS.splice(i, 1); } } };
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; st.gotHit = false; }
  function addPow(st, v) { const was = st.pow >= 1; st.pow = clamp(st.pow + v, 0, 1); if (!was && st.pow >= 1) { DUELS.tell('POWER FULL: ACT = PLOT TWIST!', 1.2); sting('ding'); } subHud(st); }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.twT >= 0) return false;
    st.hp -= dmg; st.inv = 1.3; st.hurtT = 0.4; st.stats.hits[kind]++; st.stats.hitsTaken++; st.combo = 0; DUELS.hurt(); sfx('hurt'); C.hflash = 1; C.hflashC = kind === 'freeze' ? '#9ff0ff' : kind === 'beaker' ? '#7dff9a' : '#ffffff';
    st.lane = 0; st.duck = false; st.lockT = 0.3; st.shake = 0.35; st.stop = 0.06; st.gotHit = true;
    pop('-' + dmg, V.set(sx(0), 2.0, 0.2), '');
    if (st.hp <= 0) {
      if (st.wind) { st.wind = false; st.hp = 45; st.stats.winds++; st.inv = 2.0; st.frozeT = 0; DUELS.banner('SECOND WIND!<small>HAROLD\'S BACK UP</small>', 1.6); DUELS.say('MAVIS', 'Up you get, Harold! The movie\'s not over!', 2.2); return true; }
      st.hp = 0; st.over = true; st.frozeT = 0; sfx('ko'); DUELS.log.push('shellacious:lose:' + kind); clearFx();
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'CUT! BAD TAKE!', 'Dr. Shellacious wrote Harold out of the script. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400);
    } else if (st.hp < 35 && !st.healUsed) { st.healUsed = true; st.healT = 0.9; }
    return true;
  }
  function clearFx() { if (!C.lanes) return; C.lanes.forEach((l) => { l.material.opacity = 0; l.visible = false; }); C.shadows.forEach((s) => { s.visible = false; }); C.beakers.forEach((b) => { b.visible = false; }); C.strips.forEach((s) => { s.visible = false; s.material.opacity = 0; }); C.dots.visible = false; C.pause.visible = false; }
  function dodgeOk(st, what) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; addPow(st, 0.15); pop(what || 'DODGE!', V.set(sx(st.lane) * 0.95, 2.4, 0.2), 'w'); }

  // ---------------- the shell ricochet path: off a side wall, through Harold's row once per crossing (a back rail / a front bumper between), home ----------------
  function makePath(st, P) {
    let L; if (P.n === 2) { const a = [-1, 0, 1][Math.floor(Math.random() * 3)]; let b; do { b = [-1, 0, 1][Math.floor(Math.random() * 3)]; } while (b === a); L = [a, b]; }
    else { L = [-1, 0, 1]; for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; } }
    const side = Math.random() < 0.5 ? -1 : 1, pts = [[0, MZ - 0.7], [side * 4.2, 2.6]], cidx = [];
    L.forEach((l, i) => { cidx.push(pts.length); pts.push([sx(l) * 0.95, 0]); if (i < L.length - 1) pts.push([(sx(l) + sx(L[i + 1])) * 0.475, i % 2 === 0 ? -1.7 : 1.7]); });
    if (L.length % 2) { pts.push([sx(L[L.length - 1]) * 0.5 - side * 1.6, -1.7]); pts.push([-side * 4.4, -0.6]); } // still heading toward the camera: off the back rail and out wide of the lanes
    pts.push([-side * 4.2, 2.6]); pts.push([0, MZ - 0.7]);
    const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    st.cross = L; st.crossI = 0; st.path = { pts, d, len: d[d.length - 1], cd: cidx.map((i) => d[i]), s: 0 };
  }
  function pathAt(p, s, out) { const { pts, d } = p; let i = 1; while (i < d.length - 1 && d[i] < s) i++; const u = clamp((s - d[i - 1]) / Math.max(1e-4, d[i] - d[i - 1]), 0, 1);
    return out.set(lerp(pts[i - 1][0], pts[i][0], u), 0.62, lerp(pts[i - 1][1], pts[i][1], u)); }

  // ---------------- the doctor's brain ----------------
  function docThink(st, dt) {
    const P = PH[st.phase]; st.mt += dt;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.8); break;
      case 'guard': if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++;
          if (a === 'shell') { setM(st, 'shellTell', P.shell); makePath(st, P); DUELS.tell('SHELL RICOCHET! WATCH THE PATH!', P.shell); sting('shell'); }
          else if (a === 'lob') { setM(st, 'lobTell', P.lob); st.safe = [-1, 0, 1][Math.floor(Math.random() * 3)]; DUELS.tell('3D BEAKERS! STAND OFF THE SHADOWS!', P.lob); sting('lob'); }
          else { setM(st, 'frzTell', P.frz); DUELS.tell('FREEZE-FRAME! DUCK THE FILM!', P.frz); sting('frz'); }
          if (Math.random() < 0.25) DUELS.say('DR. SHELLACIOUS', pick(MID), 2.0); }
        break;
      // SHELL RICOCHET: the path shows for the whole tell, then the shell runs it; each crossing of Harold's row checks his lane
      case 'shellTell': if (st.mt > st.mdur) { setM(st, 'shell', 99); st.path.s = 0; st.anyHit = false; sting('boing'); } break;
      case 'shell': { const p = st.path, s0 = p.s; p.s += P.spd * dt; pathAt(p, Math.min(p.s, p.len), C.ball.position);
        while (st.crossI < st.cross.length && p.s >= p.cd[st.crossI]) { const l = st.cross[st.crossI++]; sfx('heavy'); st.shake = Math.max(st.shake, 0.14); spark(V.set(sx(l) * 0.95, 0.7, 0), 6);
          if (st.lane === l) { if (hurtHarold(st, DMG.shell, 'shell')) st.anyHit = true; } }
        for (let i = 1; i < p.d.length - 1; i++) if (s0 < p.d[i] && p.s >= p.d[i] && !p.cd.includes(p.d[i])) sting('boing');
        if (p.s >= p.len) { if (!st.anyHit) dodgeOk(st, 'PERFECT!'); setM(st, 'open', P.open + 0.3); }
        break; }
      // 3D BEAKER LOB: shadows on the two unsafe lanes for the tell, then two beakers arc in and splash
      case 'lobTell': if (st.mt > st.mdur) { setM(st, 'lob', 0.6); sfx('swing'); } break;
      case 'lob': if (st.mt > 0.5 && !st.hitThis) { st.hitThis = true; const bad = [-1, 0, 1].filter((l) => l !== st.safe);
          for (const l of bad) { sfx('hit'); for (let k = 0; k < 6; k++) puff(V.set(sx(l), 0.3, 0), V2.set(rnd(-1.5, 1.5), rnd(1, 2.6), rnd(-1.5, 1)), 0.8, rnd(0.6, 1.0)); }
          if (bad.includes(st.lane)) hurtHarold(st, DMG.beaker, 'beaker'); else dodgeOk(st, 'DODGED!'); }
        if (st.mt > st.mdur) setM(st, 'open', P.open); break;
      // FREEZE-FRAME: the strip charges in front of him, then runs down the aisle at chest height (phase 3: a second one behind it)
      case 'frzTell': if (st.mt > st.mdur) { setM(st, 'frz', 99); st.fz = [MZ - 1, MZ - 1 + P.fspd * 0.55]; st.fhit = [false, false]; noise(0.5, 0.1, 2500); } break;
      case 'frz': { let done = true; for (let k = 0; k < P.fn; k++) { const z0 = st.fz[k], z1 = z0 - P.fspd * dt; st.fz[k] = z1;
          if (z1 > -3) done = false;
          if (!st.fhit[k] && z0 > 0 && z1 <= 0) { st.fhit[k] = true; if (!st.duck) { if (hurtHarold(st, DMG.freeze, 'freeze')) { st.frozeT = 1.0; DUELS.tell('FROZEN! HANG ON!', 1.0); } } } }
        if (done) { if (!st.gotHit) dodgeOk(st, 'DUCKED!'); setM(st, 'open', P.open + 0.2); } break; }
      case 'open': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'flipped': if (st.mt > st.mdur) { if (st.mhp <= 0) phaseDown(st); else setM(st, 'open', 1.0); } break;
      case 'down': if (st.mt > st.mdur) { st.phase++; st.mhp = 100; st.hp = Math.min(100, st.hp + 30); st.healUsed = false; setM(st, 'guard', 1.2); subHud(st); sting('ding');
          DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 2 ? 'THE DIRECTOR\'S CUT!' : 'THE SEQUEL!') + '</small>', 1.6); } break;
      case 'ko': break;
    }
    // Mavis's popcorn (once a phase, when Harold drops low)
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 35); st.stats.heals++; DUELS.say('MAVIS', 'Here, hon: popcorn! Extra butter!', 2.0); pop('+35', V.set(sx(st.lane) * 0.95, 2.2, 0.2), 'w'); sfx('jump'); }
  }
  function phaseDown(st) { clearFx();
    if (st.phase >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.slow = 0.35; st.slowT = 1.3; JUICE.ko(); DUELS.banner('K.O.!<small>THAT\'S A WRAP</small>', 2.2); sting('ding'); sfx('ko'); }
    else { setM(st, 'down', 2.4); DUELS.banner('CUT!<small>PHASE ' + (st.phase + 1) + ' TO HAROLD</small>', 2.0); if (Math.random() < 0.7) DUELS.say('MAVIS', pick(MAVIS.slice(0, 3)), 2.2); }
  }

  // ---------------- Harold ----------------
  C.step = function (dt0, I) {
    const st = C.st; if (!st) return;
    C.hudPops(false, dt0);
    if (st.stop > 0) { st.stop -= dt0; return; } // hitstop
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    const dt = dt0 * st.slow; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.swingCd -= dt; st.lockT -= dt; st.comboT -= dt; if (st.comboT <= 0 && st.combo) { st.combo = 0; subHud(st); }
    if (st.frozeT > 0) st.frozeT -= dt;
    if (!st.over && st.twT < 0) {
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; const duck = I.my < -0.5 || I.bh;
      if (st.frozeT > 0) want = st.lane; else if (st.lockT > 0 || st.swingT >= 0) want = st.swingT >= 0 ? st.lane : 0;
      st.lane = want;
      st.duck = st.lockT <= 0 && st.frozeT <= 0 && st.swingT < 0 && duck;
      const can = !st.duck && st.swingCd <= 0 && st.hurtT <= 0 && st.frozeT <= 0;
      if (I.c && st.pow >= 1 && ['open', 'guard', 'intro', 'shellTell', 'lobTell', 'frzTell'].includes(st.ms)) startTwist(st);
      else if (I.c && st.pow < 1 && st.swingCd <= 0) { DUELS.tell('NEED POWER: HIT + DODGE', 0.8); st.swingCd = 0.3; }
      else if (I.a && can) { const k = st.comboT > 0 ? st.combo % 3 : 0; st.swingT = 0; st.swingK = k; st.swingCd = k === 2 ? 0.42 : 0.24; st.swingHit = false; st.stats.swings++; sfx('swing'); }
      if (st.swingT >= 0) { st.swingT += dt; if (st.swingT > 0.09 && !st.swingHit) { st.swingHit = true; landSwing(st); } if (st.swingT > (st.swingK === 2 ? 0.4 : 0.22)) st.swingT = -1; }
    }
    if (st.twT >= 0) stepTwist(st, dt);
    docThink(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, (st.mhp / 100 + (2 - st.phase)) / 3);
    if (st.ms === 'ko') outro(st, dt);
  };
  const WORDS = [['WHAP!', 'TAP!', 'BONK!'], ['WHACK!', 'THWAP!'], ['CUT!', 'THAT\'S A WRAP!', 'SPOILER!']];
  function landSwing(st) {
    const k = st.swingK; V.set(sx(st.lane) * 0.5 + rnd(-0.3, 0.3), k === 2 ? 2.4 : 1.8, MZ - 0.8);
    if (st.ms === 'open' || st.ms === 'flipped') {
      const crit = st.ms === 'open' && st.mt < 0.4, dmg = SWING[k] + (crit ? 2 : 0); st.mhp -= dmg; st.stats.landed++; st.combo++; st.comboT = 1.1; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.combo);
      sfx(k === 2 ? 'heavy' : 'hit'); spark(V, k === 2 ? 16 : 6); flashBoss(k === 2 ? '#5ad8ff' : '#ffffff'); st.stop = k === 2 ? 0.085 : 0.065; st.shake = Math.max(st.shake, k === 2 ? 0.3 : 0.12);
      pop((k === 2 ? pick(WORDS[2]) + ' ' : '') + dmg, V, k === 2 || crit ? 'big' : ''); addPow(st, k === 2 ? 0.09 : 0.05);
      if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); }
    } else if (['guard', 'intro'].includes(st.ms)) { st.stats.blocked++; st.combo = 0; sfx('hit'); spark(V, 3); DUELS.tell('BLOCKED! WAIT FOR IT!', 0.7); }
    else { st.combo = 0; }
    subHud(st);
  }
  // PLOT TWIST (team-up): Mavis rolls her popcorn tub under his feet, Harold cane-hooks his leg and flips him onto his back; he spins helplessly
  function startTwist(st) { st.twT = 0; st.pow = 0; st.stats.twists++; st.slow = 0.5; st.slowT = 1.6; st.inv = 3; st.lane = 0; st.duck = false; clearFx(); C.puffs.length = 0;
    C.screenM.color.set('#ffffff'); C.ana.style.opacity = '0';
    setM(st, 'flipped', 2.8); DUELS.banner('PLOT TWIST!<small>MAVIS + HAROLD</small>', 1.8); DUELS.say('MAVIS', MAVIS[3], 1.6); sting('ding'); subHud(st); C.tub.visible = true; }
  function stepTwist(st, dt) {
    st.twT += dt; const t = st.twT;
    if (t < 0.55) { C.tub.position.set(lerp(-5, 0.2, ease(t / 0.55)), 0.4, MZ - 0.4); C.tub.rotation.set(0, 0, Math.PI / 2 + t * 14); }
    if (t > 0.6 && !st.twHit) { st.twHit = true; st.mhp -= TWIST; sfx('heavy'); spark(V.set(0, 1.4, MZ - 0.5), 20); flashBoss('#7dff9a', 1); st.stop = 0.1; st.shake = 0.5; pop('PLOT TWIST! ' + TWIST, V.set(0, 3.0, MZ - 0.5), 'big');
      for (let k = 0; k < 10; k++) puff(V.set(0.2, 0.6, MZ - 0.4), V2.set(rnd(-2, 2), rnd(1.5, 3.5), rnd(-1, 1)), 0.9, rnd(0.3, 0.5)); }
    if (t > 2.1) { st.twT = -1; st.twHit = false; C.tub.visible = false; if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); } }
  }
  // ---------------- the KO: flipped on his back, spinning helplessly while the end credits roll ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R;
    R.root.visible = true; C.ball.visible = false;
    const u = ease(clamp(t / 0.6, 0, 1)); R.body.rotation.x = -u * Math.PI / 2; R.body.position.y = u * 0.78 + Math.sin(t * 9) * 0.03; R.body.position.z = u * 1.3; R.root.rotation.y = Math.PI + t * lerp(9, 3, clamp(t / 6, 0, 1));
    R.arms.forEach((a, i) => { a.sh.rotation.x = -2.6 + Math.sin(t * 14 + i * 3) * 0.6; }); // flailing
    if (Math.random() < dt * 10) { V3.set(rnd(-0.6, 0.6), 1.4, MZ + rnd(-0.4, 0.4)); spark(V3, 1); }
    if (t > 0.8) { C.credits.visible = true; C.screenM.color.setRGB(0.08, 0.08, 0.1); C.credT.offset.y = lerp(1, -0.45, clamp((t - 0.8) / 5.5, 0, 1)); }
    if (t > 1.6 && !st.saidBye) { st.saidBye = true; const l = lines(); DUELS.say('DR. SHELLACIOUS', l && l.defeat ? pick(l.defeat) : 'My hypothesis... was wrong...', 3.0); }
    if (t > 3.4 && !st.winDone) { st.winDone = true; DUELS.bossCleared('science', 'shellacious-duel');
      const h = st.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('shellacious:grade:' + g);
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'DR. SHELLACIOUS<br>CRACKED!', '<span style="color:#ffd23c;font-size:18px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · hits taken ' + h + ' · best combo x' + st.stats.maxCombo + '<br>The Science Center is clear. Crime at the Science Center: 0. Rematch any time at the ring.'); }, SIM ? 300 : 1100); }
  }
  function stepFx(dt) {
    const m = new THREE.Matrix4(), q = C.cam.quaternion;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.4); p.v.y -= 3 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.5 + p.t * 1.6); m.compose(p.p, q, V3.set(s, s, s)); C.puffM.setMatrixAt(i, m); }); C.puffM.count = C.puffs.length; C.puffM.visible = C.puffs.length > 0; C.puffM.instanceMatrix.needsUpdate = true;
    for (let i = C.sparks.length - 1; i >= 0; i--) { const p = C.sparks[i]; p.t += dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.sparks.splice(i, 1); }
    C.sparks.forEach((p, i) => { m.compose(p.p, q, V3.set(1, 1, 1)); C.spark.setMatrixAt(i, m); }); C.spark.count = C.sparks.length; C.spark.visible = C.sparks.length > 0; C.spark.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    let p;
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    p = HERO_POSES.idle(t); legsStance(p, 0.22, 0.45);
    p.shR = [-1.1, 0, -0.5]; p.elR = [-0.9, 0, 0]; p.torso = [0.1, 0, 0]; p.y = Math.sin(t * 6) * 0.03; // cane ready at the hip
    if (st.frozeT > 0) { p.shR = [-1.3, 0, -0.6]; p.shL = [-1.3, 0, 0.6]; p.y = 0; return p; }
    if (st.swingT >= 0) { const k = st.swingK, u = clamp(st.swingT / (k === 2 ? 0.4 : 0.22), 0, 1);
      if (k === 2) { p.shR = [-1.6, 0, -1.4 + u * 0.4]; p.elR = [-0.2, 0, 0]; p.shL = [-1.4, 0, 1.2]; p.torso = [0.1, 0, 0]; p.y += Math.sin(u * Math.PI) * 0.35; } // REEL SPIN: arms out, the whole body twirls (render)
      else { const d = k === 0 ? 1 : -1; p.shR = [-1.5, 0, -0.5 + d * (u - 0.5) * 2.0]; p.elR = [-0.4, 0, 0]; p.torso = [0.15, -d * (u - 0.5) * 1.2, 0]; } }
    if (st.twT >= 0) { const u = clamp(st.twT / 0.6, 0, 1); p.shR = [-0.6 - u * 2.2, 0, -0.4]; p.torso = [0.5 * u, 0, 0]; legsStance(p, 0.3, 0.9); p.y += Math.sin(Math.min(1, st.twT / 1.2) * Math.PI) * 0.5; }
    if (st.duck) { legsStance(p, 0.26, 1.25); p.y -= 0.34; p.torso = [0.6, 0, 0]; }
    if (st.lane) { p.tilt = [0, 0, st.lane * 0.2]; p.torso = [0.18, 0, st.lane * 0.22]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' || st.twT >= 0 ? 1 : 0.35, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.healT > 0 || (st.twT >= 0 && st.twT < 0.4)) { p.shR = [-0.4, 0, -0.2]; p.torso = [0.5, 0, 0]; } return p; }
  function poseDoc(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur); if (st.ms === 'ko') return;
    const tucked = st.ms === 'shell' && st.path && st.path.s > 0.2 && st.path.s < st.path.len - 0.3;
    R.root.visible = !tucked; C.ball.visible = tucked;
    if (tucked) { C.ball.rotation.y += dt * 18; C.ball.rotation.x = Math.sin(st.t * 30) * 0.15; const bm = C.ball.userData.m; if (bm && bm.userData.flash) { bm.userData.flashC.value.set('#7dff9a'); bm.userData.flash.value = 0.45; } }
    if (R.update) { try { R.update(dt, st.ms, { t, u, lane: st.ms === 'shell' || st.ms === 'shellTell' ? st.cross[st.crossI] : st.safe, phase: st.phase }); } catch (e) { console.error(e); R.update = null; } return; }
    let bodyRX = 0, bodyRZ = Math.sin(t * 1.6) * 0.05, bodyY = Math.abs(Math.sin(t * 3)) * 0.03, bodyZ = 0, rootRY = Math.PI; const arm = [[-0.3, 0], [-0.5, 0]];
    let glow = null;
    switch (st.ms) {
      case 'guard': case 'intro': arm[0] = [-0.4 + Math.sin(t * 4) * 0.2, 0]; arm[1] = [-1.2 + Math.sin(t * 4 + 1) * 0.25, 0]; break; // cackling, beaker raised
      case 'shellTell': { const k = clamp(u, 0, 1); bodyY = -0.5 * k; bodyRX = 0.9 * k; arm[0] = [0.6 * k, 0]; arm[1] = [0.6 * k, 0]; rootRY = Math.PI + Math.sin(st.mt * 30) * 0.08 * k; glow = { m: R.bM, c: '#7dff9a', v: 0.25 + 0.3 * (Math.sin(st.mt * 22) * 0.5 + 0.5) }; break; }
      case 'shell': bodyY = -0.5; bodyRX = 0.9; break;
      case 'lobTell': arm[1] = [-2.6, 0]; arm[0] = [-1.6, 0.4]; R.beaker.rotation.z = Math.sin(st.mt * 16) * 0.5; bodyRX = -0.15; glow = { m: R.liqM, c: '#7dff9a', v: 0.4 + 0.4 * (Math.sin(st.mt * 20) * 0.5 + 0.5) }; break;
      case 'lob': arm[1] = [-0.2, 0]; arm[0] = [-0.2, 0]; bodyRX = 0.25; break;
      case 'frzTell': arm[0] = [-2.4, 0.5]; arm[1] = [-2.4, -0.5]; bodyRX = -0.2; bodyY = 0.05 * Math.sin(st.mt * 30); break; // both hands up like a director: "FREEZE!"
      case 'frz': arm[0] = [-1.6, 0.9]; arm[1] = [-1.6, -0.9]; break;
      case 'open': bodyRX = 0.4 + Math.sin(st.mt * 9) * 0.05; arm[0] = [0.4, 0.3]; arm[1] = [0.4, -0.3]; bodyY = -0.08; rootRY = Math.PI + Math.sin(st.mt * 5) * 0.25; if (Math.random() < dt * 6) { V3.set(R.root.position.x + rnd(-0.5, 0.5), 2.7, MZ); spark(V3, 1); } break; // dizzy
      case 'flipped': { const k = st.mt; if (k > 0.6 && k < 2.4) { const a = clamp((k - 0.6) / 0.3, 0, 1); bodyRX = -Math.PI / 2 * a; bodyY = 0.78 * a; bodyZ = 1.3 * a; rootRY = Math.PI + (k - 0.6) * 10; arm[0] = [-2.6 + Math.sin(k * 14) * 0.6, 0]; arm[1] = [-2.6 - Math.sin(k * 14) * 0.6, 0]; }
        else if (k >= 2.4) rootRY = Math.PI; break; }
      case 'down': bodyRX = 0.65; bodyY = -0.3 * ease(clamp(st.mt / 0.5, 0, 1)); arm[0] = [0.9, 0.5]; arm[1] = [0.9, -0.5]; if (Math.random() < dt * 8) { V3.set(rnd(-0.5, 0.5), 2.6, MZ); spark(V3, 2); } break;
    }
    if (st.ms !== 'lobTell') R.beaker.rotation.z = damp(R.beaker.rotation.z, 0, 8, dt);
    const flip = st.ms === 'flipped' && st.mt > 0.6 && st.mt < 2.4;
    if (flip) R.root.rotation.y = rootRY; else { const cur = R.root.rotation.y, tgt = rootRY + Math.round((cur - rootRY) / TAU) * TAU; R.root.rotation.y = damp(cur, tgt, 10, dt); }
    R.body.position.y = damp(R.body.position.y, bodyY, flip ? 30 : 12, dt); R.body.position.z = damp(R.body.position.z, bodyZ, flip ? 30 : 12, dt); R.body.rotation.x = damp(R.body.rotation.x, bodyRX, flip ? 20 : 10, dt); R.body.rotation.z = bodyRZ;
    R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, arm[i][0], 14, dt); a.sh.rotation.y = damp(a.sh.rotation.y, arm[i][1], 14, dt); });
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    const bm = C.ball.userData.m; if (!tucked && bm && bm.userData.flash) bm.userData.flash.value = 0;
    if (glow && glow.m && glow.m.userData.flash) { glow.m.userData.flashC.value.set(glow.c); glow.m.userData.flash.value = Math.max(glow.m.userData.flash.value, glow.v); }
  }
  const M4 = new THREE.Matrix4(), QF = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  function tells(st, dt) {
    const P = PH[st.phase], pulse = 0.62 + 0.3 * Math.sin(st.t * 28), warn = [0, 0, 0];
    // ricochet: the dots along the path during the tell (eaten by the shell during the run); the next crossing lane flashes red
    const sOn = (st.ms === 'shellTell' || st.ms === 'shell') && st.path;
    if (sOn) { const p = st.path, n = 90; let c = 0; for (let i = 0; i < n; i++) { const s = (i + 0.5) / n * p.len; if (st.ms === 'shell' && s < p.s) continue; pathAt(p, s, V3); V3.y = 0.06; const k = st.ms === 'shellTell' ? clamp(st.mt / 0.5 - i / n, 0, 1) : 1; M4.compose(V3, QF, V2.set(k, k, k)); C.dots.setMatrixAt(c++, M4); }
      C.dots.count = c; C.dots.instanceMatrix.needsUpdate = true; C.dots.material.opacity = 0.6 + 0.35 * Math.sin(st.t * 18); if (st.crossI < st.cross.length) warn[st.cross[st.crossI] + 1] = pulse; }
    C.dots.visible = !!sOn && C.dots.count > 0;
    // beakers: shadows grow on the two unsafe lanes; the beakers arc from his hand to the shadows
    const lOn = st.ms === 'lobTell' || (st.ms === 'lob' && st.mt < 0.55);
    C.shadows.forEach((s, i) => { const l = i - 1; s.visible = lOn && l !== st.safe; if (s.visible) { const k = st.ms === 'lob' ? 1 + st.mt * 0.6 : 0.45 + 0.55 * clamp(st.mt / st.mdur, 0, 1); s.scale.set(k, k, k); s.material.opacity = 0.75 + 0.25 * Math.sin(st.t * 24); } });
    if (lOn) [-1, 0, 1].filter((l) => l !== st.safe).forEach((l) => { warn[l + 1] = Math.max(warn[l + 1], st.ms === 'lob' ? 0.9 : 0.35 * pulse); });
    const bOn = st.ms === 'lob' && st.mt < 0.5; let bi = 0;
    for (const l of [-1, 0, 1]) { if (l === st.safe) continue; const b = C.beakers[bi++]; b.visible = bOn; if (bOn) { const k = clamp(st.mt / 0.5, 0, 1); C.R.beaker.getWorldPosition(V3); b.position.set(lerp(V3.x, sx(l), k), lerp(V3.y, 0.3, k) + Math.sin(k * Math.PI) * 3.2, lerp(V3.z, 0, k)); b.rotation.set(k * 9, 0, k * 5); } }
    // the fake-3D red / cyan look during the lob (the screen tints, the overlay comes up)
    const a3 = st.ms === 'lobTell' ? clamp(st.mt / 0.4, 0, 1) : st.ms === 'lob' ? clamp(1 - st.mt / st.mdur, 0, 1) : 0; C.ana.style.opacity = a3.toFixed(2);
    if (st.ms !== 'ko') C.screenM.color.setRGB(1, 1 - a3 * 0.5, 1 - a3 * 0.2);
    // freeze-frame: the screen pauses, the strip(s) charge in front of him and then run down the aisle
    const fT = st.ms === 'frzTell', fR = st.ms === 'frz'; C.pause.visible = fT || fR;
    C.strips.forEach((s, k) => { const on = (fT && k === 0) || (fR && k < P.fn && st.fz[k] > -3); s.visible = on; if (!on) return;
      if (fT) { const kk = clamp(st.mt / st.mdur, 0, 1); s.position.set(0, 1.4, MZ - 1); s.scale.set(0.3 + 0.7 * kk, 1, 1); s.material.opacity = 0.35 + 0.5 * kk * (0.6 + 0.4 * Math.sin(st.t * 30)); }
      else { s.position.set(0, 1.4, Math.min(MZ - 1, st.fz[k])); s.scale.set(1, 1, 1); s.material.opacity = 0.95; } });
    if (fT) warn[0] = warn[1] = warn[2] = 0.18 * pulse;
    C.scrL.intensity = 30 + (fT || fR ? 20 : 0) + a3 * 10;
    C.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 24, dt); l.visible = l.material.opacity > 0.01; });
    C.frost.style.opacity = st.frozeT > 0 ? clamp(st.frozeT / 0.6, 0, 1).toFixed(2) : '0';
    // the "!" over the doctor's head on every tell
    const bang = ['shellTell', 'lobTell', 'frzTell'].includes(st.ms) && !st.over;
    if (bang) { V3.set(C.R.root.position.x, 3.2, MZ).project(C.cam); C.bang.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; C.bang.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; }
    if (C.bang.__on !== bang) { C.bang.__on = bang; C.bang.style.display = bang ? 'block' : 'none'; }
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.stop > 0 ? 0.15 : st.slow), t = st.t;
    const H = C.H; const hx = sx(st.lane) * 0.95, hz = st.twT >= 0 ? lerp(0, 2.6, clamp(st.twT / 0.5, 0, 1)) * (st.twT < 1.7 ? 1 : Math.max(0, 1 - (st.twT - 1.7) / 0.4)) : 0;
    H.root.position.set(damp(H.root.position.x, hx, 18, dt), 0, damp(H.root.position.z, hz, 10, dt));
    H.root.rotation.y = st.swingT >= 0 && st.swingK === 2 ? clamp(st.swingT / 0.36, 0, 1) * TAU : 0; // REEL SPIN finisher: a full twirl
    applyPose(H, haroldPose(st, t), 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); if (H.mat.userData.flashC) H.mat.userData.flashC.value.set(C.hflashC || '#ffffff'); H.mat.userData.flash.value = C.hflash * 0.8; }
    if (st.frozeT > 0 && H.mat.userData.flashC) { H.mat.userData.flashC.value.set('#9ff0ff'); H.mat.userData.flash.value = 0.55; }
    const M = C.M; M.root.position.set(-4.2, 0, 2.4); M.root.rotation.y = 0.6; applyPose(M, mavisPose(st, t), 12, dt, false);
    if (!(st.ms === 'frzTell' || st.ms === 'frz')) C.movieT.offset.x = (C.movieT.offset.x + dt * 0.006) % 1;
    poseDoc(st, dt); tells(st, dt);
    DUELS.hot(st.pow >= 1 && !st.over);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 1.6);
    // camera: low behind Harold, the doctor + the big screen filling the frame; portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 68 : 54; C.cam.updateProjectionMatrix();
    V.set(H.root.position.x * 0.55, port ? 4.3 : 4.1, port ? -5.0 : -5.6); V2.set(H.root.position.x * 0.3, port ? 1.7 : 1.5, MZ + 0.5); // high enough to see the doctor over Harold + the floor tells
    if (st.ms === 'intro' && st.phase === 0 && st.t < 3) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(3.5, 4.0, 1.5), V, k); V2.lerpVectors(V3.set(0, 3.5, SZ), V2, k); }
    if (st.twT >= 0) { V.set(-3.4, 2.4, 1.6); V2.set(0, 1.6, MZ - 0.2); }
    if (st.ms === 'ko') { V.set(1.2, 3.4, port ? -3.4 : -2.0); V2.set(0, 3.4, MZ + 2); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
    C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 22; OUT_U.fogF.value = 48;
  };
  C.onResize = () => {};

  // ---------------- test bot: win = reads every tell; mash = SWING only, never dodges; lose = stands still ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt;
    if (B.mode === 'mash') { if (B.cd <= 0) { B.a = true; B.cd = 0.25; } return; }
    const left = st.mdur - st.mt;
    if (st.ms === 'shellTell' || st.ms === 'shell') { const rest = st.cross.slice(st.crossI), next = rest[0]; if (next !== undefined) { const free = [0, 1, -1].find((l) => !rest.includes(l)); B.mx = free !== undefined ? free : [0, 1, -1].find((l) => l !== next); } }
    if (st.ms === 'lobTell' || st.ms === 'lob') B.mx = st.safe;
    if (st.ms === 'frzTell' && left < 0.15 || st.ms === 'frz') B.bh = true;
    if (st.pow >= 1 && st.ms === 'open' && B.cd <= 0) { B.c = true; B.cd = 0.5; }
    else if ((st.ms === 'open' || st.ms === 'flipped') && B.cd <= 0 && st.twT < 0) { B.a = true; B.cd = 0.26; }
  };
  DUELS.reg('shellacious', C);

  // ---------------- the city side: the ring at the Science Center boss anchor (DESIGN anchor), REMATCH once cleared; ?shellacious=1 ----------------
  const L = LANDMARKS.find((l) => l.id === 'science');
  if (L && L.boss) { DUELS.addTrigger('shellacious', L, L.boss.x, L.boss.z, L.boss.x + 1.6, L.boss.z - 2.4, '#7dff9a');
    const act = ACTIONS[ACTIONS.length - 1]; Object.defineProperty(act, 'label', { get: () => (L.boss.cleared ? 'REMATCH DR. SHELL' : 'FIGHT DR. SHELL'), configurable: true });
    act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
    const bm = DUELS.BEAM.list[DUELS.BEAM.list.length - 1]; if (bm) bm.L = { boss: { get cleared() { return false; } } }; } // keep the ring lit for rematches
  let n = 0; MODE.ticks.push(() => { n++; if (n === 3 && Q.has('shellacious') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('shellaciousauto'); DUELS.start('shellacious', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__shellacious = C; C.PH = PH;
})();

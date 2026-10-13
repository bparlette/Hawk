
// ======================= RIPTIDE RODNEY, RASH FIELD: 2v2 lacrosse (DESIGN.md "Additions (Brad, 2026-10-12)", rodney).
// Harold (cane stick) and Mavis (purse stick, AI) vs the Key Highway Otters' captain Riptide Rodney and his wingman, on the waterfront
// Rash Field. First to 5 goals. The camera sits behind the near sideline, Harold's side attacks the right-hand goal.
//   CRADLE: walk over a loose ball to scoop it; the ball rides in the stick pocket until you throw it or get checked.
//   SHOOT (SWING): throws at the goal. A sweeping AIM meter (HUD, top right) decides where it flies: fire while the marker is in the green
//     middle and it is on target; a defender standing in the lane blocks it. No ball: SWING is a cane CHECK.
//   PASS (JUMP): flips the ball to Mavis. (Without the ball it calls for the ball, Mavis passes back when she can.)
//   CHECK (ACT): a cane check knocks the nearest player in front of you back ~2 m and makes them drop the ball.
//   HARBOR RULE: the far sideline is the seawall. A player checked into the water is OUT for 30 s (then climbs back in at their own goal).
// Controls: phone: stick = run, SWING = shoot/check, JUMP = pass, ACT = check. Desktop: WASD / arrows, J shoot, K pass, E check. Gamepad: stick, X, A, Y.
// Entry: the ring on Rash Field (anchor: window.RASH_ANCHOR / LANDMARKS 'rashfield' from the Lexington branch; a TEMPORARY landmark is
// added here only when that one is missing). ?duel=rodney starts it, &duelbot=win|lose plays it (tests). Boss cleared -> BOSS_CLEAR 'rashfield'.
// Rig hook (Opus drops its otter in): window.buildRiptideRodney({ THREE, toonMat, outlineMat, addOdir, QUAL, wing }) may return
//   { root (faces +z, feet at y = 0), body?, armL?, armR?, legL?, legR?, tail?, stick? }. Missing parts are created. Called twice (captain, then wing:true).
(function () {
  const R = { scene: null, cam: null, title: 'RIPTIDE RODNEY', pips: 5,
    hint: '<b>WASD</b> run · <b>J</b> shoot / check · <b>K</b> pass · <b>E</b> check · first to 5',
    labels: { a: 'SHOOT', b: 'PASS', c: 'CHECK', l: '&#9664;', r: '&#9654;' } };
  const FX = 14, GW = 2.0, WZ = -8.9, WALL = -9.2, WIN = 5, OUTS = 30;
  const V = new THREE.Vector3();
  const LINES = { // Grok GR8 lines (content/gr8_cast_tips.json); LANDMARKS 'rashfield'.boss.lines overrides when present
    intro: ["Rash Field's my turf. Key Highway Otters take the field!", "Two on two, first to five. Bring your cane and a towel."],
    score: ["That's a cane, not a stick. Wrong sport, grandpa.", "Purse checks? Lady, I've been hit harder by waves.", "Otters were born for this. You were born in 1940.", "Another one in the net? Ha! Wrong net.", "Hope you two can swim. Harbor's right there."],
    hurt: ["Hey! That check was legal? Fine.", "Splash! Ugh, my fur. My beautiful fur.", "Okay, the old folks can move."], win: ["Five goals? From a cane? I need a nap.", "Otters, back to the water. We'll train harder.", "Good game, grandpa. You and Mavis are legit."], lose: ['Back to the retirement home!', 'Five to nothing is how we say hello.'] };
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'rashfield'); return L && L.boss && L.boss.lines; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- the arena: Rash Field on the harbor, a seawall behind the far sideline ----------------
  function stripeTex() { return canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4f9a3c' : '#5aa845'; g.fillRect(i * w / 8, 0, w / 8, h); } }, 256); }
  function netTex() { return canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); } }, 128); }
  function signTex() { return canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#17606a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2ead0'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 54px ' + FONT; g.fillStyle = '#f2ead0'; g.fillText('RASH FIELD', w / 2, h * 0.42); g.font = '900 22px ' + FONT; g.fillStyle = '#ffd23c'; g.fillText('KEY HIGHWAY \u00b7 INNER HARBOR', w / 2, h * 0.76); }, 512); }
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const sk = new THREE.SphereGeometry(90, 24, 12).toNonIndexed(); const sp = sk.attributes.position, sc2 = new Float32Array(sp.count * 3), c0 = new THREE.Color('#4a88c8'), c1 = new THREE.Color('#f0b080'), c2 = new THREE.Color('#ffe0b0');
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 90, c = y > 0.1 ? c0.clone().lerp(c1, clamp(1 - (y - 0.1) * 2.4, 0, 1)) : c1.clone().lerp(c2, clamp(1 - y * 8, 0, 1)); sc2.set([c.r, c.g, c.b], i * 3); }
    sk.setAttribute('color', new THREE.BufferAttribute(sc2, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    const gt = stripeTex(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(4, 1);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(36, 20), new THREE.MeshLambertMaterial({ map: gt })); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0, 0.6); sc.add(grass);
    const wt = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), new THREE.MeshLambertMaterial({ color: '#2d6a8e', emissive: '#16405c' })); wt.rotation.x = -Math.PI / 2; wt.position.set(0, -1.2, -70); sc.add(wt); R.water = wt;
    const A = K();
    // pitch lines, seawall + bollards, goals, bleachers, skyline across the harbor: one kit mesh
    const ln = (x0, z0, x1, z1) => A.add(G.box(Math.abs(x1 - x0) + 0.12, 0.02, Math.abs(z1 - z0) + 0.12), '#f4f6ee', (x0 + x1) / 2, 0.03, (z0 + z1) / 2);
    ln(-FX, WZ + 0.2, FX, WZ + 0.2); ln(-FX, 9, FX, 9); ln(-FX, WZ + 0.2, -FX, 9); ln(FX, WZ + 0.2, FX, 9); ln(0, WZ + 0.2, 0, 9);
    A.add(G.cyl(2.3, 2.3, 0.02, 24), '#f4f6ee', 0, 0.04, 0.1).add(G.cyl(2.12, 2.12, 0.03, 24), '#53a141', 0, 0.045, 0.1);
    A.add(G.box(60, 1.0, 1.2), '#a8a39a', 0, -0.35, -9.8).add(G.box(60, 0.18, 1.5), '#c4bfb4', 0, 0.2, -9.8);
    for (let x = -26; x <= 26; x += 4) A.add(G.cyl(0.16, 0.2, 0.5, 8), '#2a2a30', x, 0.5, -9.5);
    for (const s of [-1, 1]) { const gx = s * FX; // goal: two posts + crossbar + back bar
      A.add(G.cyl(0.07, 0.07, 1.9, 8), '#e8e8f0', gx, 0.95, -GW).add(G.cyl(0.07, 0.07, 1.9, 8), '#e8e8f0', gx, 0.95, GW).add(G.cyl(0.07, 0.07, GW * 2, 8), '#e8e8f0', gx, 1.9, 0, Math.PI / 2, 0, 0);
      A.add(G.cyl(0.05, 0.05, 1.9, 6), '#c8c8d0', gx + s * 1.5, 0.95, -GW).add(G.cyl(0.05, 0.05, 1.9, 6), '#c8c8d0', gx + s * 1.5, 0.95, GW).add(G.cyl(0.05, 0.05, GW * 2, 6), '#c8c8d0', gx + s * 1.5, 1.9, 0, Math.PI / 2, 0, 0); }
    for (let r = 0; r < 4; r++) { A.add(G.box(34, 0.5, 1.1), r % 2 ? '#7d8691' : '#6d7681', 0, 0.4 + r * 0.55, 11.6 + r * 1.15); SEED = 5 + r; // bleachers on the near side + a crowd of heads
      for (let k = 0; k < 17; k++) if (srnd() > 0.15) { const cx = -16 + k * 2 + srnd() * 0.5; A.add(G.sph(0.3, 7, 5), ['#e8b890', '#c68c60', '#f0cba0', '#8a5a3a', '#e0a070'][Math.floor(srnd() * 5)], cx, 1.15 + r * 0.55, 11.6 + r * 1.15).add(G.box(0.55, 0.5, 0.35), srnd() > 0.5 ? '#1d8c93' : ['#d8262a', '#ffd23c', '#e8e8f0', '#4a5ab0'][Math.floor(srnd() * 4)], cx, 0.7 + r * 0.55, 11.6 + r * 1.15); } }
    SEED = 11; for (let i = 0; i < 16; i++) { const w = 6 + srnd() * 8, h = 8 + srnd() * 22, x = -70 + i * 9 + srnd() * 4; A.add(G.box(w, h, 6), ['#6c7a94', '#8a8294', '#7a8a8a', '#9a8a7a'][Math.floor(srnd() * 4)], x, h / 2 - 1.2, -62 - srnd() * 10);
      for (let k = 0; k < 4; k++) A.add(G.box(w * 0.7, 0.5, 0.1), '#ffe6a0', x, 2 + k * (h / 4.5), -58.9); }
    A.add(G.sph(7, 14, 8), '#b8c8d4', -38, 0.5, -48, 0, 0, 0, 1, 0.6, 1); // the Science Center dome across the water
    sc.add(A.mesh(toonMat(), null, 0.003));
    for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2 + 0.2, 1.9), new THREE.MeshBasicMaterial({ map: netTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); n.position.set(s * (FX + 0.75), 0.95, 0); n.rotation.y = Math.PI / 2; n.scale.x = 0.0 + 1; sc.add(n); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: signTex(), fog: false })); sg.position.set(0, 3.7, 10.4); sg.rotation.x = 0.0; sc.add(sg);
  }

  // ---------------- the Key Highway Otters: procedural stand-ins behind window.buildRiptideRodney ----------------
  function standInOtter(wing) {
    const K = DUELS.kit, G = DUELS.GEO, fur = wing ? '#6b4a34' : '#7a5236', jer = wing ? '#2a6a9a' : '#1d8c93', mat = toonMat();
    const root = new THREE.Group(), body = new THREE.Group(), O = { root, body };
    body.position.y = 0.95; root.add(body);
    K().add(G.sph(0.42, 12, 9), jer, 0, 0, 0, 0, 0, 0, 1, 1.15, 0.85).add(G.sph(0.3, 10, 8), '#e8d4b0', 0, -0.05, 0.22, 0, 0, 0, 1, 1.05, 0.5).add(G.box(0.86, 0.12, 0.62), '#14101f', 0, -0.35, 0).add(G.box(0.9, 0.1, 0.66), wing ? '#ffd23c' : '#f2ead0', 0, 0.12, 0).mesh(mat, body, 0.004);
    const head = new THREE.Group(); head.position.set(0, 0.68, 0.05); body.add(head); O.head = head;
    const hk = K().add(G.sph(0.3, 12, 9), fur, 0, 0, 0, 0, 0, 0, 1, 0.92, 1).add(G.sph(0.17, 10, 8), '#e8d4b0', 0, -0.08, 0.28, 0, 0, 0, 1.3, 0.8, 1).add(G.sph(0.06, 6, 5), '#14101f', 0, 0.0, 0.43)
      .add(G.sph(0.07, 6, 5), '#fff', -0.12, 0.1, 0.24).add(G.sph(0.07, 6, 5), '#fff', 0.12, 0.1, 0.24).add(G.sph(0.035, 6, 5), '#14101f', -0.12, 0.1, 0.3).add(G.sph(0.035, 6, 5), '#14101f', 0.12, 0.1, 0.3)
      .add(G.sph(0.09, 6, 5), fur, -0.24, 0.24, -0.02).add(G.sph(0.09, 6, 5), fur, 0.24, 0.24, -0.02) // ears
      .add(new THREE.SphereGeometry(0.34, 12, 6, 0, TAU, 0, Math.PI * 0.5), jer, 0, 0.06, -0.02, 0, 0, 0, 1, 0.9, 1).add(G.box(0.07, 0.26, 0.5), '#f2ead0', 0, 0.22, 0.0); // helmet + stripe
    hk.mesh(mat, head, 0.004);
    const arm = (s) => { const g = new THREE.Group(); g.position.set(s * 0.46, 0.35, 0); body.add(g); K().add(G.cyl(0.09, 0.08, 0.55, 8), fur, 0, -0.27, 0).add(G.sph(0.1, 7, 5), '#14101f', 0, -0.56, 0).mesh(mat, g, 0.004); return g; };
    O.armL = arm(1); O.armR = arm(-1);
    const leg = (s) => { const g = new THREE.Group(); g.position.set(s * 0.2, -0.3, 0); body.add(g); K().add(G.cyl(0.11, 0.09, 0.62, 8), fur, 0, -0.31, 0).add(G.box(0.2, 0.1, 0.34), '#14101f', 0, -0.62, 0.07).mesh(mat, g, 0.004); return g; };
    O.legL = leg(1); O.legR = leg(-1);
    const tail = new THREE.Group(); tail.position.set(0, -0.2, -0.38); body.add(tail); K().add(G.cone(0.14, 0.95, 8), fur, 0, 0, -0.45, -Math.PI / 2, 0, 0).mesh(mat, tail, 0.004); O.tail = tail;
    return O;
  }
  function stickMesh(col, kind) { // a lacrosse stick built into a group (handle + ring head + net); kind: 'cane' | 'purse' | 'otter'
    const K = DUELS.kit, G = DUELS.GEO, g = new THREE.Group(), k = K();
    k.add(G.cyl(0.035, 0.035, 1.7, 6), col, 0, 0, 0).add(G.tor(0.2, 0.025, 6, 14), '#e8e4d8', 0, 0.98, 0, 0, Math.PI / 2, 0, 1, 1.25, 1).add(G.sph(0.17, 8, 5), '#d8d4c8', 0, 0.9, 0, 0, 0, 0, 0.2, 1.1, 1);
    if (kind === 'cane') k.add(G.tor(0.09, 0.03, 5, 10, Math.PI), col, 0, -0.9, 0.0, 0, Math.PI / 2, 0);
    if (kind === 'purse') k.add(G.box(0.22, 0.16, 0.08), '#e2437e', 0, 0.62, 0.0).add(G.tor(0.07, 0.015, 5, 10, Math.PI), '#7a1040', 0, 0.72, 0);
    k.mesh(toonMat(), g, 0.004); return g;
  }

  // ---------------- state ----------------
  const A = []; // actors: 0 Harold (you), 1 Mavis, 2 Rodney, 3 wingman
  const ST = R.st = null;
  function mkActor(i, name, team, rig, o) { return Object.assign({ i, name, team, dir: team ? -1 : 1, rig, x: 0, z: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: team ? -Math.PI / 2 : Math.PI / 2, stun: 0, out: 0, imm: 0, cd: 0, swing: 0, has: false, react: 0, passCd: 0, shootT: -1, ph: Math.random() * 6, anim: 0, call: 0, spd: 5.2, skill: 0.9, aggro: 1, sy: 0 }, o); }
  function placeAll() {
    const P = [[-3, 0.5, -0.3], [-7, 3, 0], [3, -0.5, 0], [7, -3, 0]];
    A.forEach((a, i) => { a.x = P[i][0]; a.z = P[i][1]; a.vx = a.vz = a.kx = a.kz = 0; a.stun = 0; a.out = 0; a.imm = 0.6; a.cd = 0; a.swing = 0; a.has = false; a.shootT = -1; a.react = 0; a.call = 0; a.sy = 0; a.yaw = a.team ? -Math.PI / 2 : Math.PI / 2; a.rig.root.visible = true; });
  }
  function reset(full) {
    const st = R.st = { t: 0, score: full === false && R.st ? R.st.score : [0, 0], phase: 'intro', pt: 0, over: false, won: false, mt: 0, meter: 0, noPickT: 1.2, noPickId: -1, trail: 0,
      stats: R.st && R.st.stats || { goals: [0, 0], checks: 0, checksHit: 0, shots: 0, saved: 0, passes: 0, picks: 0, water: [0, 0, 0, 0], interceptions: 0, hits: 0 },
      ball: { x: 0, y: 0.2, z: 0, vx: 0, vz: 0, mode: 'loose', car: null, tgt: null, team: 0, t: 0, from: 0 }, tellT: 0 };
    placeAll(); DUELS.bars(1, 1); subHud(st); return st;
  }
  const B = () => R.st.ball;
  function subHud(st) { DUELS.sub('<span style="color:#ffd23c">HAROLD &amp; MAVIS ' + st.score[0] + '</span> &nbsp;\u2013&nbsp; <span style="color:#7fe0e8">' + st.score[1] + ' OTTERS</span>', st.phase === 'play' && A[0].has ? meterHtml(st) : 'FIRST TO ' + WIN); }
  function meterHtml(st) { const m = st.meter, n = 15, c = Math.round((m * 0.5 + 0.5) * (n - 1)); let s = ''; for (let i = 0; i < n; i++) { const g = Math.abs((i / (n - 1)) * 2 - 1) < 0.5; s += '<span style="color:' + (i === c ? '#fff' : g ? '#5ee05a' : '#e0503a') + '">' + (i === c ? '\u25cf' : '\u25ae') + '</span>'; } return 'AIM ' + s; }
  const pocket = (a) => { const c = Math.cos(a.yaw), s = Math.sin(a.yaw), px = a.i === 0 || a.i === 1 ? -0.5 : -0.45, pz = 1.0; return [a.x + px * c + pz * s, a.z - px * s + pz * c]; };
  const opp = (a) => A.filter((o) => o.team !== a.team);
  const mate = (a) => A.find((o) => o.team === a.team && o !== a);
  const ok = (a) => a.out <= 0 && a.stun <= 0;

  // ---------------- ball ----------------
  function drop(a, vx = 0, vz = 0) { const b = B(); if (!a.has) return; a.has = false; b.car = null; b.mode = 'loose'; b.x = a.x; b.z = a.z; b.y = 0.9; b.vx = vx; b.vz = vz; R.st.noPickT = 0.3; R.st.noPickId = a.i; }
  function take(a) { const b = B(), st = R.st; if (b.car) b.car.has = false; a.has = true; b.car = a; b.mode = 'carried'; b.tgt = null; b.vx = b.vz = 0; a.shootT = -1; if (a.i === 0) { st.stats.picks++; sfx('jump'); } }
  function shoot(a, m) {
    const b = B(), st = R.st; if (!a.has) return; const [px, pz] = pocket(a); a.has = false; b.car = null; b.mode = 'shot'; b.team = a.team; b.from = a.i; b.x = px; b.z = pz; b.y = 1.2; b.t = 0;
    const gz = clamp(m * 3.7, -5, 5), dx = a.dir * FX - px, dz = gz - pz, L = Math.hypot(dx, dz) || 1; b.vx = dx / L * 19; b.vz = dz / L * 19; st.noPickT = 0.35; st.noPickId = a.i; a.swing = 0.3; a.yaw = Math.atan2(dx, dz);
    st.stats.shots++; sfx('swing'); if (a.i === 0) DUELS.tell(Math.abs(m) < 0.52 ? 'ON TARGET' : 'WIDE!', 0.6);
  }
  function pass(a, t) {
    const b = B(), st = R.st; if (!a.has || !t || t.out > 0) return false; const [px, pz] = pocket(a); a.has = false; b.car = null; b.mode = 'pass'; b.tgt = t; b.team = a.team; b.from = a.i; b.x = px; b.z = pz; b.y = 1.2; b.t = 0; a.passCd = 1.0; a.yaw = Math.atan2(t.x - a.x, t.z - a.z);
    st.noPickT = 0.2; st.noPickId = a.i; st.stats.passes++; sfx('swing'); return true;
  }
  function goal(team, by) {
    const st = R.st; st.score[team]++; st.stats.goals[team]++; st.phase = 'goal'; st.pt = 0; const b = B(); b.mode = 'loose'; b.vx = b.vz = 0; b.y = 0.4; b.x = clamp(b.x, -FX, FX); b.z = clamp(b.z, -GW, GW);
    DUELS.bars(1 - st.score[1] / WIN, 1 - st.score[0] / WIN); subHud(st); sfx('ko'); if (team === 0) DUELS.pips && 0;
    DUELS.banner((team ? 'OTTERS SCORE' : 'GOAL!') + '<small>' + st.score[0] + ' \u2013 ' + st.score[1] + '</small>', 1.8);
    const l = lines() || LINES; if (team) DUELS.say('RIPTIDE RODNEY', pick(l.score || LINES.score), 2.6);
    DUELS.log.push('rodney:goal:' + team + ':' + st.score.join('-') + ':' + (A[by] ? A[by].name : ''));
    if (st.score[team] >= WIN) { st.over = true; st.won = team === 0; st.phase = 'over'; st.pt = 0; DUELS.log.push('rodney:' + (st.won ? 'win' : 'lose')); }
  }
  function ballStep(dt) {
    const st = R.st, b = B(); st.noPickT = Math.max(0, st.noPickT - dt);
    if (b.mode === 'carried' && b.car) { const [px, pz] = pocket(b.car); b.x = px; b.z = pz; b.y = 1.25 + Math.sin(st.t * 14) * 0.02; return; }
    if (b.mode === 'loose') {
      b.x += b.vx * dt; b.z += b.vz * dt; b.vx = damp(b.vx, 0, 2.2, dt); b.vz = damp(b.vz, 0, 2.2, dt); b.y = Math.max(0.2, b.y - dt * 4);
      if (b.x < -FX - 1.2 || b.x > FX + 1.2) { b.x = clamp(b.x, -FX - 1, FX + 1); b.vx *= -0.4; } if (b.z > 9) { b.z = 9; b.vz *= -0.4; }
      if (b.z < WZ - 0.4) { b.z = WZ - 0.4; b.vz = Math.abs(b.vz) * 0.4; } // the wall bounces it back (the ball never swims)
      if (st.phase === 'play') { let best = null, bd = 0.95; for (const a of A) { if (!ok(a) || (st.noPickT > 0 && st.noPickId === a.i)) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd && (st.noPickT <= 0.05 || st.noPickId !== a.i)) { bd = d; best = a; } } if (best && st.noPickT <= 0.0) take(best); }
      return;
    }
    b.t += dt; const ho = b.mode === 'shot';
    if (b.mode === 'pass') { const t = b.tgt; if (!t || t.out > 0) { b.mode = 'loose'; b.vx = b.vz = 0; return; } const [px, pz] = [t.x, t.z], dx = px - b.x, dz = pz - b.z, L = Math.hypot(dx, dz) || 1; b.vx = dx / L * 16; b.vz = dz / L * 16; b.y = 1.3; if (L < 0.8 && ok(t)) { take(t); return; } if (b.t > 2) { b.mode = 'loose'; b.vx = b.vz = 0; } }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (ho || b.mode === 'pass') for (const o of A) { if (o.team === b.team || o.out > 0) continue; if (Math.hypot(o.x - b.x, o.z - b.z) < 0.85 && b.t > 0.06) { // intercepted / blocked
        if (ho) { st.stats.saved++; b.mode = 'loose'; b.vx = (b.vx * -0.25) + rnd(-1, 1); b.vz = rnd(-1.5, 1.5); b.y = 1; st.noPickT = 0.25; st.noPickId = -1; DUELS.tell('BLOCKED!', 0.7); sfx('hit'); }
        else { st.stats.interceptions++; take(o); DUELS.tell('INTERCEPTED!', 0.8); sfx('hit'); } return; } }
    if (ho) { b.y = 1.2 + Math.sin(clamp(b.t * 2, 0, Math.PI)) * 0.3; const dirx = b.team ? -1 : 1;
      if ((dirx > 0 && b.x >= FX) || (dirx < 0 && b.x <= -FX)) { if (Math.abs(b.z) <= GW) goal(b.team, b.from); else { b.mode = 'loose'; b.x = dirx * (FX - 0.6); b.vx = -dirx * 2; b.vz = rnd(-2, 2); st.noPickT = 0.2; st.noPickId = -1; DUELS.tell('WIDE', 0.6); } } }
  }

  // ---------------- checks + water ----------------
  function check(a) {
    const st = R.st; if (a.cd > 0 || !ok(a)) return false; a.cd = a.i === 2 ? 0.8 : 0.7; a.swing = 0.34; sfx('swing'); if (a.i === 0) st.stats.checks++;
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw); let best = null, bd = 2.25;
    for (const o of opp(a)) { if (o.out > 0 || o.imm > 0) continue; const dx = o.x - a.x, dz = o.z - a.z, d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.2) { bd = d; best = o; } }
    if (!best) return true; const dx = best.x - a.x, dz = best.z - a.z, L = Math.hypot(dx, dz) || 1, K = a.i === 2 ? 11 : a.i === 3 ? 9.5 : 9;
    best.kx = dx / L * K; best.kz = dz / L * K; best.stun = 0.55; best.imm = 0.55; best.swing = 0; best.shootT = -1; drop(best, dx / L * 2, dz / L * 2);
    if (a.i === 0) st.stats.checksHit++; if (best.i === 0) { st.stats.hits++; DUELS.hurt(); } sfx(a.i === 2 ? 'heavy' : 'hit'); fxPuff(best.x, 1.1, best.z);
    if (best.i === 2 && Math.random() < 0.5) { const l = lines() || LINES; DUELS.say('RIPTIDE RODNEY', pick(l.hurt || LINES.hurt), 2); }
    return true;
  }
  function toWater(a) { const st = R.st; a.out = OUTS; a.stun = 0; a.kx = a.kz = a.vx = a.vz = 0; drop(a, 0, 0); st.stats.water[a.i]++; fxSplash(a.x, a.z); sfx('hurt');
    DUELS.tell(a.name + ' IS IN THE HARBOR \u00b7 OUT ' + OUTS + 's', 1.6); DUELS.log.push('rodney:water:' + a.name); }

  // ---------------- AI ----------------
  function steer(a, tx, tz, dt, m = 1) { const dx = tx - a.x, dz = tz - a.z, L = Math.hypot(dx, dz); if (L < 0.25) { a.vx = damp(a.vx, 0, 10, dt); a.vz = damp(a.vz, 0, 10, dt); return L; } a.vx = damp(a.vx, dx / L * a.spd * m, 9, dt); a.vz = damp(a.vz, dz / L * a.spd * m, 9, dt); return L; }
  function ai(a, dt) {
    const st = R.st, b = B(), dir = a.dir, goalX = dir * FX, os = opp(a), tm = mate(a); a.cd = Math.max(0, a.cd - dt); a.passCd = Math.max(0, a.passCd - dt); a.call = Math.max(0, a.call - dt);
    if (!ok(a) || st.phase !== 'play') { a.vx = damp(a.vx, 0, 8, dt); a.vz = damp(a.vz, 0, 8, dt); return; }
    if (a.i === 1 && R.idleMavis) { a.vx = damp(a.vx, 0, 8, dt); a.vz = damp(a.vz, 0, 8, dt); return; }
    const near = os.filter((o) => o.out <= 0).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    if (a.has) { // ---- carrier: run at the goal, dodge the nearest defender, shoot in range, flip it when pressed
      let tz = 0, nd = near ? Math.hypot(near.x - a.x, near.z - a.z) : 99;
      if (near && nd < 5) tz = clamp(a.z + (a.z >= near.z ? 1 : -1) * 4, -7, 7); else tz = a.z * 0.6;
      if (near && nd < 5 && a.z - near.z === 0) tz = a.z + 3;
      steer(a, a.x + dir * 6, tz, dt, 0.95);
      const range = a.i === 2 ? 9.5 : 8; if ((goalX - a.x) * dir < range) { if (a.shootT < 0) a.shootT = rnd(0.35, 0.85) / a.aggro; else if ((a.shootT -= dt) <= 0) { shoot(a, (Math.random() * 2 - 1) * a.skill); a.shootT = -1; } } else a.shootT = -1;
      if (tm && tm.out <= 0 && a.passCd <= 0 && ((nd < 2.1 && Math.random() < dt * 2.2) || (a.call > 0 && Math.random() < dt * 3))) { if ((tm.x - a.x) * dir > -3) pass(a, tm); }
      if (near && nd < 1.7 && a.cd <= 0 && (a.react -= dt) <= 0) { check(a); a.react = rnd(0.3, 0.6); }
      a.yaw = lerpYaw(a.yaw, Math.atan2(a.vx, a.vz), 12, dt); return;
    }
    const carrier = b.car, theirs = carrier && carrier.team !== a.team;
    if (theirs) { // ---- they have it: the captain (or whoever is nearest) hunts the carrier, the other guards the goal
      const hunter = a.i === 2 || a.i === 1 || (!ok(tm) && a.i === 3) || (Math.hypot(carrier.x - a.x, carrier.z - a.z) < 5);
      let L;
      if (hunter) { L = steer(a, carrier.x + carrier.vx * 0.25, carrier.z + carrier.vz * 0.25, dt, 1.0); } else { L = steer(a, -dir * 0 + (a.team ? 1 : -1) * (FX - 5), clamp(carrier.z, -5, 5), dt, 0.85); }
      const d = Math.hypot(carrier.x - a.x, carrier.z - a.z); a.yaw = lerpYaw(a.yaw, Math.atan2(carrier.x - a.x, carrier.z - a.z), 10, dt);
      if (d < 1.9 && a.cd <= 0) { if ((a.react -= dt) <= 0) { check(a); a.react = rnd(0.28, 0.55); } } else a.react = Math.max(a.react, rnd(0.2, 0.4)); return;
    }
    if (carrier && carrier === tm) { // ---- a mate has it: get open, ahead and on the other wing
      const side = tm.z > 0 ? -1 : 1; steer(a, clamp(tm.x + dir * 5, -FX + 2, FX - 2), clamp(side * 3.2, -7, 7), dt, 0.9);
      if (near && Math.hypot(near.x - a.x, near.z - a.z) < 1.7 && a.cd <= 0) check(a); a.yaw = lerpYaw(a.yaw, Math.atan2(a.vx, a.vz), 8, dt); return;
    }
    // ---- loose ball: the nearer of us goes
    if (b.mode === 'pass' && b.tgt === a) { steer(a, b.x, b.z, dt, 1); return; }
    const mine = Math.hypot(b.x - a.x, b.z - a.z), his = tm && ok(tm) && !(tm.i === 0 && false) ? Math.hypot(b.x - tm.x, b.z - tm.z) : 99;
    const go = mine <= his + (a.i === 1 ? 0.8 : 0) || !tm || !ok(tm);
    if (b.mode === 'shot' || b.mode === 'pass') { steer(a, clamp(b.x, -FX + 2, FX - 2), clamp(b.z, -7, 7), dt, 0.9); }
    else if (go) steer(a, b.x, b.z, dt, 1); else steer(a, clamp(b.x + dir * 3, -FX + 2, FX - 2), clamp(-b.z * 0.5, -6, 6), dt, 0.8);
    if (near && Math.hypot(near.x - a.x, near.z - a.z) < 1.6 && a.cd <= 0 && near.has) check(a);
    a.yaw = lerpYaw(a.yaw, Math.atan2(a.vx, a.vz), 8, dt);
  }
  function lerpYaw(a, b, r, dt) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * (1 - Math.exp(-r * dt)); }

  // ---------------- fx (instanced soft quads) ----------------
  const FXQ = [];
  function fxPuff(x, y, z) { for (let k = 0; k < 6 && FXQ.length < 40; k++) FXQ.push({ x, y, z, vx: rnd(-2, 2), vy: rnd(1, 3), vz: rnd(-2, 2), t: 0, life: rnd(0.3, 0.6), s: rnd(0.25, 0.5), c: 0 }); }
  function fxSplash(x, z) { for (let k = 0; k < 22 && FXQ.length < 40; k++) FXQ.push({ x, y: -0.2, z: Math.min(z, WALL), vx: rnd(-2.5, 2.5), vy: rnd(3, 7), vz: rnd(-2, 1), t: 0, life: rnd(0.6, 1.0), s: rnd(0.3, 0.6), c: 1, g: 14 }); }

  // ---------------- build ----------------
  R.build = function () {
    const sc = (R.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#bcd6e8', 40, 130);
    R.cam = new THREE.PerspectiveCamera(50, VW() / VH(), 0.1, 300);
    DUELS.sceneLights(sc, '#fff0d8', '#6a7a58', 1.5, '#fff0d0', 1.9, new THREE.Vector3(-0.5, 1.2, 0.7));
    buildArena(sc);
    const H = buildHero(), M = buildHero({ wife: true }); sc.add(H.root, M.root);
    const hs = stickMesh('#7a5232', 'cane'); hs.position.set(-0.5, 0.95, 0.35); hs.rotation.x = 0.35; H.root.add(hs); H.stick = hs;
    const ms = stickMesh('#d86a9a', 'purse'); ms.position.set(-0.5, 0.95, 0.35); ms.rotation.x = 0.35; M.root.add(ms); M.stick = ms;
    const mk = (wing) => { let rig = null; try { if (typeof window.buildRiptideRodney === 'function') rig = window.buildRiptideRodney({ THREE, toonMat, outlineMat, addOdir, QUAL, wing: !!wing }); } catch (e) { console.error(e); rig = null; }
      R.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standInOtter(wing); if (!rig.body) rig.body = rig.root; if (!rig.stick) { rig.stick = stickMesh(wing ? '#2a6a9a' : '#e8e4d8', 'otter'); rig.stick.position.set(-0.5, 0.95, 0.35); rig.stick.rotation.x = 0.35; rig.root.add(rig.stick); } sc.add(rig.root); return rig; };
    const Rr = mk(false), Wr = mk(true);
    A.length = 0;
    A.push(mkActor(0, 'HAROLD', 0, H, { spd: 5.3 }), mkActor(1, 'MAVIS', 0, M, { spd: 5.1, skill: 0.85 }), mkActor(2, 'RODNEY', 1, Rr, { spd: 5.5, skill: 0.95, aggro: 1.15 }), mkActor(3, 'WING', 1, Wr, { spd: 5.1, skill: 1.0 }));
    // the ball + soft shadows (instanced) + fx quads (instanced)
    R.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff8a1e' })); sc.add(R.ball);
    R.sh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: '#0a1408', transparent: true, opacity: 0.35, depthWrite: false }), 5); R.sh.frustumCulled = false; sc.add(R.sh);
    R.fxM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffffff'), transparent: true, depthWrite: false, fog: false }), 40); R.fxM.count = 0; R.fxM.frustumCulled = false; sc.add(R.fxM);
    R.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 20), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); R.ring.rotation.x = -Math.PI / 2; sc.add(R.ring);
  };
  R.start = function () {
    R.st = null; R.idleMavis = !!(DUELS.bot && DUELS.bot.mode === 'lose'); FXQ.length = 0; reset(true); DUELS.log.push('rodney:' + R.rigKind);
    DUELS.banner('RIPTIDE RODNEY<small>RASH FIELD \u00b7 FIRST TO ' + WIN + '</small>', 2.2); const l = lines() || LINES; DUELS.say('RIPTIDE RODNEY', pick(l.intro || LINES.intro), 3.2);
    R.camP = new THREE.Vector3(0, 12, 17); R.camL = new THREE.Vector3(0, 0, -1);
  };
  R.retry = function () { reset(true); R.idleMavis = !!(DUELS.bot && DUELS.bot.mode === 'lose' && DUELS.bot.retried === false); DUELS.banner('RASH FIELD<small>FIRST TO ' + WIN + ' \u00b7 AGAIN!</small>', 1.6); };
  R.exit = function () { };

  // ---------------- step ----------------
  R.step = function (dt, I) {
    const st = R.st; if (!st) return; st.t += dt; st.pt += dt; st.meter = Math.sin(st.t * 4.6);
    const h = A[0], b = B();
    if (st.phase === 'intro') { if (st.pt > 2.4) { st.phase = 'play'; st.pt = 0; DUELS.banner('PLAY!', 0.7); subHud(st); } }
    else if (st.phase === 'goal') { if (st.pt > 2.4) { const sc = st.score; reset(false); R.st.score = sc; R.st.phase = 'play'; R.st.stats = st.stats; DUELS.bars(1 - sc[1] / WIN, 1 - sc[0] / WIN); subHud(R.st); DUELS.banner('FACE-OFF', 0.6); return; } }
    else if (st.phase === 'over') { if (st.pt > 1.6 && !st.card) { st.card = true;
      if (st.won) { DUELS.bossCleared('rashfield'); const l = lines() || LINES; DUELS.say('RIPTIDE RODNEY', pick(l.win || LINES.win), 3); DUELS.over('win', 'RASH FIELD IS YOURS!', 'Harold and Mavis beat Riptide Rodney ' + st.score[0] + '\u2013' + st.score[1] + '.<br>The Key Highway Otters hand over the field.'); }
      else { const l = lines() || LINES; DUELS.say('RIPTIDE RODNEY', pick(l.lose || LINES.lose), 3); DUELS.over('lose', 'FINAL BUZZER', 'The Otters took it ' + st.score[1] + '\u2013' + st.score[0] + '. Retry from 0\u20130, and mind the seawall.'); } } }
    const play = st.phase === 'play';
    // ---- your player
    h.cd = Math.max(0, h.cd - dt); h.passCd = Math.max(0, h.passCd - dt);
    if (play && ok(h)) {
      const mx = I.mx, mz = -I.my, L = Math.hypot(mx, mz); const sp = h.spd * (h.has ? 0.95 : 1);
      if (L > 0.12) { const k = Math.min(1, L); h.vx = damp(h.vx, mx / L * sp * k, 12, dt); h.vz = damp(h.vz, mz / L * sp * k, 12, dt); h.yaw = lerpYaw(h.yaw, Math.atan2(mx, mz), 14, dt); } else { h.vx = damp(h.vx, 0, 12, dt); h.vz = damp(h.vz, 0, 12, dt); }
      if (I.a) { if (h.has) { shoot(h, st.meter); } else check(h); }
      if (I.c) check(h);
      if (I.b) { if (h.has) pass(h, A[1]); else A[1].call = 1.6; }
    } else { h.vx = damp(h.vx, 0, 8, dt); h.vz = damp(h.vz, 0, 8, dt); }
    for (let i = 1; i < 4; i++) ai(A[i], dt);
    // ---- integrate
    for (const a of A) {
      a.imm = Math.max(0, a.imm - dt); a.swing = Math.max(0, a.swing - dt); a.stun = Math.max(0, a.stun - dt);
      if (a.out > 0) { a.out -= dt; a.sy = Math.max(-1.6, a.sy - dt * 3); if (a.out <= 0) { a.out = 0; a.sy = 0; a.x = -a.dir * (FX - 3.5); a.z = 0; a.imm = 1.5; a.vx = a.vz = a.kx = a.kz = 0; a.rig.root.visible = true; fxSplash(a.x, 0); } continue; }
      a.x += (a.vx + a.kx) * dt; a.z += (a.vz + a.kz) * dt; a.kx = damp(a.kx, 0, 4.2, dt); a.kz = damp(a.kz, 0, 4.2, dt);
      const knock = Math.hypot(a.kx, a.kz) > 0.6;
      if (!knock) a.z = Math.max(a.z, WZ); a.z = Math.min(a.z, 9); a.x = clamp(a.x, -FX - 2.5, FX + 2.5);
      if (a.z < WALL && st.phase !== 'over') toWater(a);
      if (a.i !== 0 && a.has === false && a.i !== 1) a.cd = Math.max(0, a.cd - 0); // (cds tick in ai())
    }
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const p = A[i], q = A[j]; if (p.out > 0 || q.out > 0) continue; const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001) { const f = (0.8 - d) * 0.5; p.x -= dx / d * f; p.z -= dz / d * f; q.x += dx / d * f; q.z += dz / d * f; } }
    ballStep(dt);
    for (const f of FXQ) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= (f.g || 4) * dt; } for (let i = FXQ.length - 1; i >= 0; i--) if (FXQ[i].t > FXQ[i].life) FXQ.splice(i, 1);
    if ((st.t * 4) % 1 < dt * 4) subHud(st);
    if (play && h.out > 0) DUELS.tell('YOU ARE OUT \u00b7 ' + Math.ceil(h.out) + 's', 0.3);
  };

  // ---------------- render ----------------
  R.render = function (rdt) {
    const st = R.st; if (!st) return; const dt = Math.min(0.05, rdt * (SIM || 1)), t = st.t;
    for (const a of A) {
      const J = a.rig, sp = Math.hypot(a.vx, a.vz), vis = a.out <= 0 || a.sy > -1.5; J.root.visible = vis; J.root.position.set(a.x, a.out > 0 ? a.sy : 0, a.z); J.root.rotation.y = a.yaw; a.ph += dt * (6 + sp * 1.4);
      if (a.out > 0) { J.root.rotation.z = Math.sin(t * 6 + a.i) * 0.2; continue; } J.root.rotation.z = 0;
      if (a.i < 2) { let p; const u = 1 - a.swing / 0.34;
        if (a.stun > 0) p = HERO_POSES.hurt(clamp(1 - a.stun / 0.55, 0, 1)); else if (a.swing > 0 && !a.has) p = HERO_POSES.atk1(clamp(u, 0, 1)); else if (sp > 0.6) p = HERO_POSES.run(a.ph / 7, sp); else p = HERO_POSES.idle(t + a.i);
        if (a.swing > 0 && a.has) { p.torso = [0.2, -0.6 * Math.sin(clamp(u, 0, 1) * Math.PI), 0]; }
        applyPose(J, p, 14, dt, false); J.stick.rotation.x = 0.35 + (a.swing > 0 ? -0.9 * Math.sin(clamp(u, 0, 1) * Math.PI) : 0) + Math.sin(a.ph) * 0.1 * (sp > 0.6 ? 1 : 0);
      } else { const b = J.body, ph = a.ph, run = clamp(sp / 5, 0, 1), u = clamp(1 - a.swing / 0.34, 0, 1);
        if (J.legL) { J.legL.rotation.x = Math.sin(ph) * 0.9 * run; J.legR.rotation.x = -Math.sin(ph) * 0.9 * run; } if (J.armL) { J.armL.rotation.x = -Math.sin(ph) * 0.7 * run; J.armR.rotation.x = Math.sin(ph) * 0.7 * run - (a.swing > 0 ? Math.sin(u * Math.PI) * 1.4 : 0); }
        if (b !== J.root) { b.position.y = 0.95 + Math.abs(Math.sin(ph)) * 0.06 * run; b.rotation.x = (a.stun > 0 ? -0.5 : 0.18 * run); } if (J.tail) J.tail.rotation.y = Math.sin(t * 4 + a.i) * 0.3;
        J.stick.rotation.x = 0.35 + (a.swing > 0 ? -0.9 * Math.sin(u * Math.PI) : 0); }
      const sm = R.sh; _sh(sm, a.i, a.x, a.z, a.out > 0 ? 0 : 1);
    }
    const b = B(); R.ball.position.set(b.x, b.mode === 'carried' ? b.y : b.y, b.z); _sh(R.sh, 4, b.x, b.z, 0.5); R.sh.instanceMatrix.needsUpdate = true;
    // the “you” ring under Harold
    const h = A[0]; R.ring.visible = h.out <= 0; R.ring.position.set(h.x, 0.06, h.z); R.ring.material.opacity = 0.6 + 0.3 * Math.sin(t * 8); DUELS.hot && DUELS.hot(false);
    // fx quads
    let n = 0; for (const f of FXQ) { const k = 1 - f.t / f.life; _m.compose(_p.set(f.x, f.y, f.z), _q.copy(R.cam.quaternion), _s.setScalar(f.s * (0.6 + k))); R.fxM.setMatrixAt(n, _m); n++; } R.fxM.count = n; R.fxM.instanceMatrix.needsUpdate = true;
    // camera: behind the near sideline, following the ball; portrait pulls back and up
    const port = VH() > VW(), fx = clamp(b.x * 0.55 + (A[0].x * 0.25), -FX + 5, FX - 5);
    R.cam.fov = port ? 64 : 46; R.cam.updateProjectionMatrix();
    V.set(fx, port ? 14.5 : 12.5, port ? 19 : 16.5); R.camP.lerp(V, 1 - Math.exp(-4 * dt)); V.set(fx * 0.9, 0, port ? -1.5 : -0.5); R.camL.lerp(V, 1 - Math.exp(-4 * dt));
    R.cam.position.copy(R.camP); R.cam.lookAt(R.camL);
    if (OUT_U && OUT_U.fogC) { OUT_U.fogC.value.copy(R.scene.fog.color); OUT_U.fogN.value = 40; OUT_U.fogF.value = 130; }
  };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function _sh(mesh, i, x, z, on) { _m.compose(_p.set(x, 0.05, z), _q.setFromAxisAngle(_s.set(1, 0, 0), -Math.PI / 2), _s.set(on, on, on)); mesh.setMatrixAt(i, _m); }

  // ---------------- test bot: win = plays properly (chase, carry, shoot in the green, check); lose = stands still and Mavis stands still ----------------
  R.botThink = function (Bt, dt) {
    const st = R.st; if (!st) return; Bt.mx = 0; Bt.my = 0; Bt.bh = false; Bt.lh = Bt.rh = false; if (Bt.mode === 'lose' || st.phase !== 'play') return;
    const h = A[0], b = B(); if (h.out > 0) return; Bt.cd = (Bt.cd || 0) - dt;
    const go = (tx, tz) => { const dx = tx - h.x, dz = tz - h.z, L = Math.hypot(dx, dz); if (L > 0.2) { Bt.mx = dx / L; Bt.my = -dz / L; } return L; };
    if (h.has) { // dodge the nearest otter in front, run at the goal, throw when the meter is green and we are in range
      const o = A.filter((q) => q.team === 1 && q.out <= 0).sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0]; let tz = 0;
      if (o && Math.hypot(o.x - h.x, o.z - h.z) < 4.5 && o.x > h.x - 1) tz = clamp(h.z + (h.z >= o.z ? 1 : -1) * 4, -6, 6); else tz = h.z * 0.5;
      go(h.x + 6, tz); if (FX - h.x < 8.5 && Math.abs(st.meter) < 0.3 && Bt.cd <= 0) { Bt.a = true; Bt.cd = 0.6; }
    } else if (b.car && b.car.team === 1) { const c = b.car; const L = go(c.x, c.z); if (L < 1.9 && Bt.cd <= 0) { Bt.c = true; Bt.cd = 0.5; } }
    else if (b.car && b.car.team === 0) { go(b.car.x + 4, -b.car.z * 0.6); if (b.car === A[1] && Math.random() < dt * 0.5) Bt.b = true; }
    else go(b.x, b.z);
    const o2 = A.find((q) => q.team === 1 && q.out <= 0 && Math.hypot(q.x - h.x, q.z - h.z) < 1.8); if (o2 && !h.has && Bt.cd <= 0 && (b.car === o2 || Math.random() < dt * 1.5)) { Bt.c = true; Bt.cd = 0.5; }
  };

  R.stats = () => { const st = R.st; return st && { phase: st.phase, score: st.score.slice(), won: st.won, over: st.over, stats: st.stats, ball: B().mode, has: A.map((a) => a.has), out: A.map((a) => +a.out.toFixed(1)), t: +st.t.toFixed(1) }; };
  R.A = A; window.__rodney = R;
  DUELS.reg('rodney', R);
  // entrance: the ring at Rash Field's centre spot. LANDMARKS 'rashfield' comes from the Lexington branch (RASH_ANCHOR); TEMPORARY stand-in here when it is not merged yet.
  let L = LANDMARKS.find((l) => l.id === 'rashfield');
  if (!L) { const ax = window.RASH_ANCHOR ? window.RASH_ANCHOR.x : -29, az = window.RASH_ANCHOR ? window.RASH_ANCHOR.z : 50; // TEMPORARY anchor (south shore between the Science Center and Federal Hill)
    L = { id: 'rashfield', name: 'RASH FIELD', x: ax, z: az, r: 12, boss: { name: 'Riptide Rodney', x: ax, z: az, temp: true } }; LANDMARKS.push(L); }
  if (L && L.boss) DUELS.addTrigger('rodney', L, L.boss.x, L.boss.z, L.boss.x - 2.2, L.boss.z + 2.4, '#7fe0e8');
})();

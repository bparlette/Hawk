
// ======================= THE HON QUEEN, FEDERAL HILL: a king-of-the-hill slope brawl (DESIGN.md roster "Fed Hill: The Hon Queen (beehive, cat-eye
// glasses, hairspray clouds, pushes you down the hill)"; BOSS_GANG_UPGRADE_PLAN #14). Branch hark/boss-hon-queen. Runs on the DUELS core (09a): own scene +
// camera, radio ducked, city HUD hidden, arcade panel relabelled.
// A view up the grassy south slope of Federal Hill. The Hon Queen (an ORIGINAL cartoon toad-lady: towering red beehive with a pink bow, rhinestone cat-eye
// glasses, turquoise blouse, pink feather boa, leopard capris, a giant can of EXTRA HOLD hairspray) holds the hilltop. Harold climbs (uphill is slower),
// and everything she does tries to shove him back DOWN THE HILL: get knocked past the bottom path and Harold tumbles to the street (damage) and climbs back.
// Every attack is telegraphed >= 1.0 s with a "!" over her head plus a ground / lane / volume marker:
//   HAIRSPRAY CLOUD: she shakes the can (rattle + pink glow); a pink cone shows where she'll spray (it tracks Harold, then locks red for the last 0.5 s)
//                    -> step sideways out of the cone. A hit stings, blinds a moment and blasts Harold downhill.
//   BEEHIVE BOULDER: she shuffles over, lifts her hive off her head; a LIT LANE runs down the slope -> step off the lane or HOP the hive as it rolls by.
//                    After it she's bare-headed in curlers and OPEN until it puffs back up.
//   LAWN-FLAMINGO TOSS: she pulls plastic lawn flamingos from her purse; a landing RING marks each one -> keep out of the rings.
//   HIP CHECK (when Harold is close): she plants and wiggles, a red ring spreads round her -> back off, or get shoved way downhill.
// After every attack she is OPEN (fanning herself, glasses askew): climb up and cane her. 3 phases x 110 HP.
// Harold's move set here (per-fight variant): cane combo TEASE! > BACKCOMB! > EXTRA HOLD! (a hopping spin with a pink hairspray trail), HOP (jump).
// POWER fills from hits and dodges; ACT at full = SALON SHOWDOWN (team-up special): slow-mo, Mavis charges up the hill, afro vs beehive, Mavis pins her,
// Harold vaults up for a SALON SMASH (big damage), she stays pinned for a free beating.
// Help: 1.2 s i-frames, Mavis tosses a crab cake once a phase when Harold is low, one SECOND WIND per fight, +35 HP between phases.
// KO: slow-mo, the beehive deflates, she rolls all the way down the hill onto a marble stoop: "Go get a crab cake, hon." Win = BOSS_CLEAR.clear('fedhill').
// Grade card: stars by hits taken (<=3 S, <=8 A, else B). Lose = RETRY the phase with full health, or LEAVE.
// Entry: the glowing ring at the Federal Hill boss anchor on the hilltop (LANDMARKS fedhill .boss = HILL top) -> ACT "FIGHT".
// Tests: ?honqueen=1 (&honqueenauto=win|lose), or ?duel=honqueen&duelbot=win|lose; &honqueenphase=1..3, &honqueenhp=N. __honqueen = the mode object.
// RIG HOOK (procedural stand-in until a real rig lands):
//   window.buildHonQueen({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, body?, hips?, hive?, can?, armL?, armR?, glasses?, mats? }
//     root: feet at y 0, faces +z, ~2.7 m to the top of the head (hive adds ~1.1 m). body: the group that tips over (rotation.x) for the KO roll.
//     hips: group wiggled (rotation.y / z) for HIP CHECK. hive: the beehive group sitting on the head (it is hidden and a clone() of it rolls down the
//     lane for BEEHIVE BOULDER; its scale.y squashes on the KO). armL / armR: shoulder groups (rotation.x swings forward / up, -PI = straight up).
//     can: the hairspray can, in the right hand (shaken during the tell). glasses: optional (tilted when she's OPEN). mats: toon materials flashed on hits.
//   window.buildLawnFlamingo() -> optional BufferGeometry (vertex coloured, ~0.9 m, stake at y 0) for the thrown flamingos.
(function () {
  if (typeof DUELS === 'undefined') return;
  const P = { scene: null, cam: null, title: 'THE HON QUEEN', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> cane · <b>K</b> hop · <b>E</b> SALON SHOWDOWN (full power)',
    labels: { a: 'CANE', b: 'HOP', c: 'SALON', l: '', r: '' } };
  // the slope: rises toward +z. Street at z <= ZS (y 0), slope SL up to the hilltop terrace at z >= ZT. Harold tumbles if pushed below ZB.
  const ZS = -15, ZT = 7, SL = 0.24, HT = (ZT - ZS) * SL, ZB = -9.5, X0 = -7, X1 = 7, ZE = 12.6, QZ = 9.4, SA = Math.atan(SL);
  const gy = (z) => (clamp(z, ZS, ZT) - ZS) * SL;
  const PHASES = [ // tells (s), flamingos, hive roll accel, rest between attacks, open time, attack mix
    { spray: 1.35, hive: 1.35, flam: 1.25, shove: 1.15, nfl: 3, hacc: 9, rest: [1.2, 1.7], open: 2.7, mix: ['spray', 'flam', 'hive', 'spray', 'hive', 'flam'] },
    { spray: 1.25, hive: 1.25, flam: 1.15, shove: 1.1, nfl: 4, hacc: 10.5, rest: [1.0, 1.5], open: 2.5, mix: ['hive', 'spray', 'flam', 'hive', 'flam', 'spray'] },
    { spray: 1.15, hive: 1.15, flam: 1.05, shove: 1.05, nfl: 5, hacc: 12, rest: [0.9, 1.3], open: 2.4, mix: ['spray', 'hive', 'flam', 'flam', 'spray', 'hive'], combo: true },
  ];
  const QHP = 110;
  const DMG = { spray: 10, hive: 12, flam: 9, shove: 10, tumble: 8 };
  const HALF = 0.23; // hairspray cone half-angle (rad)
  const COMBO = [{ d: 7, t: 0.3, w: 'TEASE!', pose: 'atk1' }, { d: 7, t: 0.3, w: 'BACKCOMB!', pose: 'atk2' }, { d: 15, t: 0.46, w: 'EXTRA HOLD!', pose: 'atk3' }];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E3 = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1);
  const lines = () => (typeof GR1 !== 'undefined' && GR1.bosses && GR1.bosses.hon_queen) || { intro: ['Hey hon! Come up the hill, hon!'], defeat: ['Okay hon, you win. Go get a crab cake.'] };
  const TAUNT = ['Down you go, hon!', 'Mind the hill, sweetie!', 'Roll on home, hon!', 'Ooh, watch your step, hon!'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const dampAngle = (a, b, k, dt) => { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

  // ---------------- HUD extras: POWER bar, damage pops ----------------
  const css = document.createElement('style');
  css.textContent = `
  #duel .hqpw { display: inline-flex; align-items: center; gap: 6px; color: #ffb0d8; }
  #duel .hqpw .t { width: 92px; height: 9px; background: #2a0a1a; border: 2px solid #14101f; border-radius: 5px; overflow: hidden; display: inline-block; position: relative; }
  #duel .hqpw .t i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(#ffd0ea, #ff5fa2); }
  #duel .hqpw.full { color: #ffd23c; } #duel .hqpw.full .t i { background: linear-gradient(#fff6a0, #ffb020); animation: dlow .3s infinite alternate; }
  #duel .hqpop { position: absolute; left: 0; top: 0; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; pointer-events: none; opacity: 0; will-change: transform; }
  #duel .hqpop.g { color: #ffd23c; font-size: 18px; } #duel .hqpop.b { color: #7fe6ff; } #duel .hqpop.r { color: #ff6a7a; } #duel .hqpop.p { color: #ff8ad0; font-size: 17px; }
  body.duel-honqueen #duel .dtell { white-space: normal; max-width: 92vw; text-align: center; }
  @media (max-width: 480px) { #duel .hqpw .t { width: 70px; } #duel .hqpop { font-size: 12px; } #duel .hqpop.g, #duel .hqpop.p { font-size: 14px; } }`;
  document.head.appendChild(css);
  const POPS = []; for (let i = 0; i < 10; i++) { const e = document.createElement('div'); e.className = 'hqpop'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 9, life: 1, p: new THREE.Vector3() }); }
  let popI = 0;
  function pop(p, text, cls = '', life = 0.9) { const o = POPS[popI++ % POPS.length]; o.p.copy(p); o.t = 0; o.life = life; o.e.className = 'hqpop ' + cls; o.e.textContent = text; }
  function popTick(dt) {
    const w = VW(), h = VH();
    for (const o of POPS) { if (o.t >= o.life) { if (o.e.style.opacity !== '0') o.e.style.opacity = '0'; continue; } o.t += dt; const u = o.t / o.life;
      V.copy(o.p); V.y += u * 1.2; V.project(P.cam); const x = (V.x * 0.5 + 0.5) * w, y = (-V.y * 0.5 + 0.5) * h, s = u < 0.15 ? 0.6 + u / 0.15 * 0.7 : 1.3 - Math.min(0.3, (u - 0.15) * 0.8);
      o.e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%) scale(${s.toFixed(2)})`; o.e.style.opacity = String(u > 0.75 ? (1 - u) / 0.25 : 1); }
  }
  // a short hairspray hiss (noise through a high band-pass)
  function hiss(dur = 0.6, vol = 0.12) { if (!AC || AC.state !== 'running' || typeof NOISE === 'undefined') return; try { const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NOISE; s.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); s.start(t); s.stop(t + dur + 0.05); } catch (e) {} }
  function rattle() { if (!AC || AC.state !== 'running') return; try { for (let k = 0; k < 4; k++) { const t = AC.currentTime + k * 0.11, o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(1900 + k * 60, t);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + 0.06); } } catch (e) {} }

  // ---------------- textures ----------------
  function grassTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5aa04a'; g.fillRect(0, 0, w, h); SEED = 44;
    for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,40,0,.06)'; g.fillRect(0, y * 32, w, 32); } // mowing stripes
    for (let k = 0; k < 900; k++) { g.fillStyle = ['#4e9440', '#68b054', '#3f8436', '#74ba5e'][k % 4]; g.fillRect(srnd() * w, srnd() * h, 2, 3 + srnd() * 3); }
    for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#fff6c8' : '#ffd23c'; g.beginPath(); g.arc(srnd() * w, srnd() * h, 2, 0, TAU); g.fill(); } }, 256); }
  function lineTex() { return canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, '#fff'); gr.addColorStop(0.7, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w / 2, y + 40); g.lineTo(w, y); g.lineTo(w, y + 22); g.lineTo(w / 2, y + 62); g.lineTo(0, y + 22); g.closePath(); g.fill(); } }, 64); } // downhill chevrons
  function ringTex() { return canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke(); g.lineWidth = 4; g.globalAlpha = 0.6; g.beginPath(); g.arc(64, 64, 40, 0, TAU); g.stroke(); g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.fill(); }, 128); }
  function bangTex() { return canvasTex(64, 128, (g, w, h) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 110px ' + FONT; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#14101f'; g.strokeText('!', w / 2, h / 2 + 6); g.fillStyle = '#ffd23c'; g.fillText('!', w / 2, h / 2 + 6); }, 64); }

  // ---------------- the arena: the south slope of Federal Hill, the hilltop park, rowhouses behind, the harbor skyline off to the side ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const sk = new THREE.SphereGeometry(110, 24, 12).toNonIndexed(); const sp = sk.attributes.position, cc = new Float32Array(sp.count * 3), c0 = new THREE.Color('#4a8ad8'), c1 = new THREE.Color('#a8d0f0'), c2 = new THREE.Color('#ffd8a8');
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 110, c = y > 0.1 ? c0.clone().lerp(c1, clamp(1 - (y - 0.1) * 2.4, 0, 1)) : c1.clone().lerp(c2, clamp(1 - (y + 0.05) * 7, 0, 1)); cc.set([c.r, c.g, c.b], i * 3); }
    sk.setAttribute('color', new THREE.BufferAttribute(cc, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    // the hill: one grass sheet following gy(z) from the street up over the terrace
    const hg = new THREE.PlaneGeometry(44, 48, 4, 48); hg.rotateX(-Math.PI / 2); hg.translate(0, 0, -1); { const p = hg.attributes.position, uv = hg.attributes.uv; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, gy(z)); uv.setXY(i, p.getX(i) / 5, -z / 5); } hg.computeVertexNormals(); }
    const gt = grassTex(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; sc.add(new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ map: gt })));
    const R = K();
    // the street at the foot of the hill + the far curb, a brick path across the slope at the tumble line (Harold rolls off below it)
    R.add(G.box(60, 0.1, 14), '#4a4a52', 0, -0.05, ZS - 6).add(G.box(60, 0.2, 0.5), '#b8b4aa', 0, 0.05, ZS - 0.4);
    { const z = ZB - 0.35, y = gy(z); R.add(G.box(30, 0.08, 1.1), '#a8583e', 0, y + 0.02, z, -SA, 0, 0); for (let x = -14; x <= 14; x += 2) R.add(G.cyl(0.05, 0.05, 0.7, 5), '#22242a', x, gy(ZB - 1.1) + 0.35, ZB - 1.1); R.add(G.box(30, 0.06, 0.06), '#22242a', 0, gy(ZB - 1.1) + 0.68, ZB - 1.1); }
    // a stair path up the west side of the slope (concrete steps)
    for (let z = ZS + 0.5; z < ZT; z += 0.9) R.add(G.box(1.6, 0.22, 0.9), '#c8c4b8', -9.2, gy(z) + 0.02, z);
    // hilltop: the big flagpole, an old cannon on its carriage, benches, lamp posts, a low stone wall at the back
    R.add(G.cyl(0.09, 0.12, 11, 8), '#d8d8e0', -5.2, HT + 5.5, 11.6).add(G.sph(0.2, 8, 6), '#ffd23c', -5.2, HT + 11.1, 11.6);
    for (let k = 0; k < 7; k++) R.add(G.box(0.03, 0.26, 3.4), k % 2 ? '#f4f0e6' : '#c8262a', -5.2, HT + 10.4 - k * 0.26, 11.6 - 1.75); // a plain striped pennant on the pole
    R.add(G.box(0.03, 1.04, 1.4), '#2a3a8a', -5.2, HT + 10.1, 11.6 - 0.75);
    R.add(G.cyl(0.18, 0.26, 2.4, 10), '#24242a', 4.6, HT + 0.85, 10.6, Math.PI / 2 - 0.15, 0.5, 0).add(G.cyl(0.42, 0.42, 0.12, 12), '#5a3a22', 4.0, HT + 0.42, 10.2, 0, 0, Math.PI / 2).add(G.cyl(0.42, 0.42, 0.12, 12), '#5a3a22', 5.0, HT + 0.42, 11.0, 0, 0, Math.PI / 2)
      .add(G.box(0.6, 0.3, 1.5), '#6a4a2a', 4.5, HT + 0.45, 10.7, 0, 0.5, 0);
    for (const [x, z, r] of [[-2.2, 12.2, 0], [2.2, 12.2, 0], [6.2, 8.6, -1.2]]) { R.add(G.box(1.8, 0.08, 0.5), '#7a4a2a', x, HT + 0.48, z, 0, r, 0).add(G.box(1.8, 0.5, 0.08), '#7a4a2a', x, HT + 0.75, z + 0.25, 0, r, 0);
      for (const s of [-0.75, 0.75]) R.add(G.box(0.08, 0.48, 0.5), '#24242a', x + s * Math.cos(r), HT + 0.24, z - s * Math.sin(r), 0, r, 0); }
    for (const [x, z] of [[-6.4, 8], [6.8, 12.4], [-7.6, 0], [7.6, -2], [-7.6, -8]]) R.add(G.cyl(0.07, 0.09, 3.6, 6), '#24242a', x, gy(z) + 1.8, z).add(G.sph(0.26, 8, 6), '#fff2c0', x, gy(z) + 3.7, z);
    R.add(G.box(26, 0.7, 0.6), '#9a8a76', 0, HT + 0.35, ZE + 0.6);
    // the Federal Hill rowhouses behind the park (brick, white marble stoops, cornices, lit windows)
    SEED = 61; for (let k = 0; k < 9; k++) { const x = -16 + k * 4, h = 7 + srnd() * 1.6, z = ZE + 6, col = ['#9a4a3a', '#b35a3a', '#8a3a2e', '#a8543c'][k % 4];
      R.add(G.box(3.9, h, 6), col, x, HT + h / 2, z).add(G.box(4.0, 0.45, 6.2), '#f0ece0', x, HT + h + 0.2, z).add(G.box(1.2, 0.6, 1.0), '#f4f2ec', x + 0.8, HT + 0.3, z - 3.4);
      for (const wy of [1.6, 3.8, 5.8]) for (const wx of [-1.1, 0.0, 1.1]) { if (wy === 1.6 && wx === 1.1) continue; R.add(G.box(0.7, 1.1, 0.06), (k + wy + wx) % 3 < 1 ? '#ffe6a0' : '#3a4a6a', x + wx, HT + wy, z - 3.02); } R.add(G.box(0.8, 1.7, 0.06), '#5a2a1a', x + 0.8, HT + 1.45, z - 3.02); }
    // trees on the hilltop + down the slope edges
    for (const [x, z] of [[-9.5, 10], [9.6, 9], [-12, 2], [11.5, -3], [-11.8, -7], [12, 5]]) R.add(G.cyl(0.18, 0.24, 2.6, 6), '#5a3a22', x, gy(z) + 1.3, z).add(G.sph(1.7, 9, 7), '#3f8a3a', x, gy(z) + 3.4, z).add(G.sph(1.2, 8, 6), '#4fa046', x + 0.6, gy(z) + 4.3, z - 0.3);
    // the stoop at the foot of the hill (where she rolls at the end): a rowhouse end + 3 white marble steps facing up the hill
    { const x = 6.2, z = ZB - 1.6, y = gy(z); R.add(G.box(4.2, 6, 1.6), '#a8543c', x, y + 2.6, z - 1.5).add(G.box(0.9, 1.7, 0.06), '#5a2a1a', x, y + 1.45, z - 0.67);
      for (let k = 0; k < 3; k++) R.add(G.box(1.6, 0.2, 0.5), '#f4f2ec', x, y + 0.1 + k * 0.2, z + 0.6 - k * 0.42); }
    // the harbor + downtown skyline far off to the sides (the hill looks north over the harbor)
    R.add(G.box(80, 0.1, 50), '#2d6f8f', -70, -2, 20).add(G.box(80, 0.1, 50), '#2d6f8f', 70, -2, 20);
    SEED = 12; for (let k = 0; k < 12; k++) { const s = k % 2 ? 1 : -1, x = s * (36 + srnd() * 30), z = -20 + srnd() * 70, h = 10 + srnd() * 30; R.add(G.box(7, h, 7), ['#8aa0b8', '#c8ccd2', '#6a7a8a', '#b0b8c0'][k % 4], x, h / 2 - 2, z); }
    sc.add(R.mesh(toonMat(), null, 0.0028));
  }

  // ---------------- the Hon Queen stand-in: an original cartoon toad-lady (mint skin), towering red beehive + pink bow, rhinestone cat-eye glasses,
  // turquoise blouse, pink feather boa, leopard capris, a big EXTRA HOLD hairspray can ----------------
  function hiveParts(K, G) { // the beehive, base at y 0 (~1.15 m tall)
    K.add(G.sph(1, 14, 10), '#d8502a', 0, 0.22, -0.02, 0, 0, 0, 0.5, 0.36, 0.52).add(G.sph(1, 14, 10), '#e0602e', 0, 0.55, -0.04, 0, 0, 0, 0.46, 0.36, 0.46)
      .add(G.sph(1, 12, 9), '#d8502a', 0, 0.86, -0.04, 0, 0, 0, 0.38, 0.3, 0.38).add(G.sph(1, 10, 8), '#e86a34', 0, 1.06, -0.04, 0, 0, 0, 0.24, 0.16, 0.24);
    for (let k = 0; k < 3; k++) K.add(G.tor(0.43 - k * 0.07, 0.025, TAU, 4, 18), '#b8401e', 0, 0.36 + k * 0.3, -0.03, Math.PI / 2, 0, 0); // swirl rings
    K.add(G.sph(0.13, 8, 6), '#ff5fa2', 0.32, 0.28, 0.3).add(G.cone(0.12, 0.26, 5), '#ff5fa2', 0.48, 0.28, 0.3, 0, 0, -Math.PI / 2).add(G.cone(0.12, 0.26, 5), '#ff5fa2', 0.16, 0.28, 0.3, 0, 0, Math.PI / 2); // bow
    return K;
  }
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, M = toonMat(), R = { root: new THREE.Group(), mats: [M] };
    const SK = '#8fd0a0', SKD = '#6fb488', BL = '#3fc8c0', PK = '#ff6fb8';
    R.body = new THREE.Group(); R.root.add(R.body);
    R.hips = new THREE.Group(); R.hips.position.y = 1.0; R.body.add(R.hips);
    // lower body (wiggles): leopard capris (tan + brown spots), mint calves, pink kitten heels
    const Lw = K();
    Lw.add(G.sph(1, 14, 10), '#e0b060', 0, 0.0, 0, 0, 0, 0, 0.7, 0.5, 0.6);
    for (const s of [-1, 1]) Lw.add(G.cyl(0.24, 0.2, 0.62, 8), '#e0b060', s * 0.3, -0.42, 0).add(G.cyl(0.14, 0.11, 0.36, 8), SK, s * 0.3, -0.86, 0).add(G.box(0.22, 0.1, 0.36), PK, s * 0.3, -1.0, 0.06).add(G.cyl(0.03, 0.03, 0.12, 4), PK, s * 0.3, -1.02, -0.1);
    SEED = 8; for (let k = 0; k < 22; k++) { const a = srnd() * TAU, y = -0.6 + srnd() * 0.7, s = k % 2 ? 1 : -1, r = y > -0.15 ? 0.68 : 0.23; Lw.add(G.sph(0.045, 5, 4), '#6a3a1a', (y > -0.15 ? 0 : s * 0.3) + Math.sin(a) * r, y, Math.cos(a) * r * 0.9); }
    Lw.mesh(M, R.hips, 0.0036);
    // upper body: turquoise blouse, big belly, boa, the head (wide toad smile, red lipstick, rosy cheeks, cat-eye glasses, hoop earrings)
    const B = K();
    B.add(G.sph(1, 16, 12), BL, 0, 1.55, 0, 0, 0, 0, 0.82, 0.68, 0.68).add(G.sph(1, 12, 9), '#ffffff', 0, 1.6, 0.42, 0, 0, 0, 0.3, 0.42, 0.3);
    for (let k = 0; k < 4; k++) B.add(G.sph(0.045, 6, 5), '#ffd23c', 0, 1.88 - k * 0.2, 0.68);
    for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; B.add(G.sph(0.17, 7, 5), k % 2 ? PK : '#ff9ad0', Math.sin(a) * 0.62, 2.12 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.5 + 0.05); } // feather boa
    B.add(G.sph(1, 16, 12), SK, 0, 2.6, 0.06, 0, 0, 0, 0.62, 0.5, 0.56).add(G.sph(1, 12, 9), SKD, 0, 2.42, 0.18, 0, 0, 0, 0.5, 0.28, 0.42); // head + jowl
    B.add(G.box(0.52, 0.07, 0.1), '#d8203a', 0, 2.38, 0.6).add(G.sph(0.06, 6, 5), '#d8203a', -0.27, 2.41, 0.56).add(G.sph(0.06, 6, 5), '#d8203a', 0.27, 2.41, 0.56); // lipstick smile
    for (const s of [-1, 1]) { B.add(G.sph(0.14, 10, 8), '#ffffff', s * 0.24, 2.84, 0.4).add(G.sph(0.07, 8, 6), '#2a1a3a', s * 0.24, 2.84, 0.52).add(G.sph(0.08, 6, 5), '#ff8aa0', s * 0.42, 2.55, 0.42, 0, 0, 0, 1, 0.6, 0.5);
      B.add(G.tor(0.12, 0.022, TAU, 4, 14), '#ffcc33', s * 0.6, 2.42, 0.06, 0, Math.PI / 2, 0); for (let k = 0; k < 3; k++) B.add(G.box(0.12, 0.03, 0.03), SKD, s * 0.24, 2.98 + k * 0.0, 0.48 - k * 0.0, 0, 0, s * (0.25 + k * 0.1)); }
    B.mesh(M, R.body, 0.0038);
    R.glasses = new THREE.Group(); R.glasses.position.set(0, 2.86, 0.55); R.body.add(R.glasses);
    { const Gl = K(); for (const s of [-1, 1]) { Gl.add(G.tor(0.15, 0.03, TAU, 4, 14), '#d82a8a', s * 0.24, 0, 0, 0, 0, 0, 1.15, 0.85, 1).add(G.cone(0.07, 0.22, 4), '#d82a8a', s * 0.44, 0.1, 0, 0, 0, -s * 1.1);
        for (let k = 0; k < 3; k++) Gl.add(G.sph(0.022, 4, 3), '#ffffff', s * (0.32 + k * 0.05), 0.08 + k * 0.03, 0.03); } Gl.add(G.box(0.14, 0.03, 0.03), '#d82a8a', 0, 0.02, 0); Gl.mesh(M, R.glasses, 0); }
    R.hive = new THREE.Group(); R.hive.position.set(0, 2.98, 0.0); R.body.add(R.hive); { const hg = new THREE.Group(); hg.scale.set(1.12, 1.4, 1.12); R.hive.add(hg); hiveParts(K(), G).mesh(M, hg, 0.0036); }
    // arms: shoulder > upper arm (blouse puff sleeve) > mint forearm > hand. Right hand holds the hairspray can, left a pink purse on the wrist.
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.78, 1.95, 0.02); R.body.add(sh);
      const A = K(); A.add(G.sph(0.26, 10, 8), BL, 0, -0.04, 0).add(G.cyl(0.12, 0.1, 0.8, 8), SK, 0, -0.48, 0).add(G.sph(0.14, 8, 6), SK, 0, -0.9, 0).add(G.tor(0.08, 0.02, TAU, 4, 10), '#ffcc33', 0, -0.78, 0, Math.PI / 2, 0, 0);
      if (s < 0) A.add(G.box(0.42, 0.32, 0.16), PK, 0, -1.2, 0.04).add(G.tor(0.12, 0.022, Math.PI, 4, 10), '#ffcc33', 0, -1.02, 0.04).add(G.box(0.1, 0.06, 0.18), '#ffd23c', 0, -1.18, 0.06);
      A.mesh(M, sh, 0.0035); if (s < 0) R.armL = sh; else R.armR = sh; }
    R.can = new THREE.Group(); R.can.position.set(0, -1.05, 0.12); R.armR.add(R.can);
    { const C = K(); C.add(G.cyl(0.15, 0.15, 0.62, 12), '#ff5fa2', 0, 0, 0).add(G.cyl(0.155, 0.155, 0.16, 12), '#ffd23c', 0, 0.05, 0).add(G.cyl(0.11, 0.15, 0.1, 12), '#d8d8e0', 0, 0.36, 0).add(G.cyl(0.05, 0.05, 0.08, 6), '#ffffff', 0, 0.45, 0).add(G.box(0.05, 0.03, 0.05), '#14101f', 0, 0.47, 0.05);
      C.mesh(M, R.can, 0.003); }
    return R;
  }
  function flamingoGeo() { // an original plastic lawn flamingo on a wire stake (~0.95 m)
    const K = DUELS.kit(), G = DUELS.GEO;
    K.add(G.cyl(0.012, 0.012, 0.5, 4), '#3a3a40', -0.05, 0.25, 0).add(G.cyl(0.012, 0.012, 0.5, 4), '#3a3a40', 0.05, 0.25, 0)
      .add(G.sph(1, 10, 8), '#ff6fb8', 0, 0.6, 0, 0, 0, 0, 0.14, 0.12, 0.24).add(G.cone(0.08, 0.2, 5), '#ff4fa0', 0, 0.62, -0.26, -Math.PI / 2 - 0.3, 0, 0)
      .add(G.cyl(0.03, 0.035, 0.28, 6), '#ff6fb8', 0, 0.78, 0.18, -0.5, 0, 0).add(G.cyl(0.028, 0.03, 0.2, 6), '#ff6fb8', 0, 0.93, 0.2, 0.4, 0, 0)
      .add(G.sph(0.065, 8, 6), '#ff6fb8', 0, 1.02, 0.16).add(G.cone(0.03, 0.1, 5), '#14101f', 0, 0.99, 0.24, Math.PI / 2 + 0.6, 0, 0).add(G.sph(0.016, 4, 3), '#14101f', 0.04, 1.04, 0.19).add(G.sph(0.016, 4, 3), '#14101f', -0.04, 1.04, 0.19);
    return K.geo();
  }
  function laneGeo(w) { // a strip down the slope at x 0 (follows gy), from the terrace to the street, uv v in metres / 2
    const zs = [ZT + 3, ZT, ZS, ZS - 2], P3 = [], U = [], I = [];
    zs.forEach((z, i) => { P3.push(-w / 2, gy(z) + 0.06, z, w / 2, gy(z) + 0.06, z); U.push(0, (ZT + 3 - z) / 2, 1, (ZT + 3 - z) / 2); if (i) { const a = (i - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g; }

  // ---------------- build ----------------
  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#cfe2f0', 45, 150);
    P.cam = new THREE.PerspectiveCamera(55, VW() / VH(), 0.1, 300);
    DUELS.sceneLights(sc, '#eef6ff', '#6a7a4a', 1.35, '#fff0d0', 1.9, new THREE.Vector3(0.5, 1, -0.6));
    buildArena(sc);
    P.H = buildHero(); sc.add(P.H.root); P.M = buildHero({ wife: true }); sc.add(P.M.root);
    let rig = null; try { if (typeof window.buildHonQueen === 'function') rig = window.buildHonQueen({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    P.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'hips', 'hive', 'armL', 'armR', 'can', 'glasses']) if (!rig[k]) { rig[k] = new THREE.Group(); (k === 'body' ? rig.root : k === 'can' ? (rig.armR || rig.body || rig.root) : (rig.body || rig.root)).add(rig[k]); }
    rig.mats = rig.mats || []; P.R = rig; sc.add(rig.root); P.hive0 = { y: rig.hive.position.y, s: rig.hive.scale.y };
    // the rolling beehive (a clone of hers), the lit lane, the hairspray cone, rings + flamingos (instanced), puffs + sparks, the "!" over her head
    P.roll = new THREE.Group(); { const c = rig.hive.clone(); c.position.set(0, -0.55, 0); c.scale.setScalar(1.15); P.roll.add(c); } P.roll.visible = false; sc.add(P.roll);
    const lt = lineTex(); lt.wrapT = THREE.RepeatWrapping;
    P.lane = new THREE.Mesh(laneGeo(1.7), new THREE.MeshBasicMaterial({ map: lt, color: '#ff8a3a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); P.lane.renderOrder = 4; P.lane.visible = false; sc.add(P.lane);
    const cg = new THREE.ConeGeometry(Math.tan(HALF), 1, 22, 1, true); cg.translate(0, -0.5, 0); cg.rotateX(-Math.PI / 2);
    P.cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: '#ff7ac8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); P.cone.renderOrder = 4; P.cone.visible = false; sc.add(P.cone);
    P.ringM = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 10); P.ringM.count = 0; P.ringM.frustumCulled = false; P.ringM.renderOrder = 5; sc.add(P.ringM);
    for (let i = 0; i < 10; i++) P.ringM.setColorAt(i, new THREE.Color('#ff3d6e'));
    let fg = null; try { if (typeof window.buildLawnFlamingo === 'function') fg = window.buildLawnFlamingo(); } catch (e) { fg = null; } if (!fg || !fg.attributes) fg = flamingoGeo();
    P.flamM = new THREE.InstancedMesh(fg, toonMat(), 8); P.flamM.count = 0; P.flamM.frustumCulled = false; sc.add(P.flamM); P.flams = [];
    P.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffc8e8'), transparent: true, depthWrite: false, fog: false }), 56); P.puffM.count = 0; P.puffM.frustumCulled = false; sc.add(P.puffM); P.puffs = [];
    P.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffffff', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 64); P.fx.count = 0; P.fx.frustumCulled = false; sc.add(P.fx); P.fxs = [];
    P.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex(), transparent: true, depthWrite: false, depthTest: false, fog: false })); P.bang.scale.set(0.55, 1.1, 1); P.bang.visible = false; P.bang.renderOrder = 9; sc.add(P.bang);
    P.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false })); P.shadow.renderOrder = 2; sc.add(P.shadow);
  };

  // ---------------- state ----------------
  function reset(phase, hp = 100) {
    const old = P.st; const st = P.st = { t: 0, phase, hp, qhp: QHP, power: old ? old.power : 0, ts: 1, tsT: 0, hs: 0, shake: 0,
      hx: 0.5, hz: -3.5, hy: 0, vy: 0, yaw: 0, kbx: 0, kbz: 0, tumbleT: -1, atkI: -1, atkT: -1, atkHit: false, chainT: 0, hurtT: 0, inv: 0, combo: 0, comboT: 0, blindT: 0,
      salT: -1, cakeUsed: false, cake: null, tellT: 0,
      ms: 'intro', mt: 0, mdur: phase === 0 && !old ? 2.6 : 1.2, mixI: 0, qx: 0, qz: QZ, qyaw: Math.PI, pose: 'guard', ax: 0, az: 1, lx: 0, rhz: 0, rvz: 0, hiveS: 1, shoveCd: 3, hitThis: false,
      over: false, won: false, outT: 0, secondWind: old ? old.secondWind : false,
      stats: old && old.stats || { hitsTaken: 0, swings: 0, landed: 0, dodges: 0, tumbles: 0, specials: 0, maxCombo: 0, attacks: { spray: 0, hive: 0, flam: 0, shove: 0 }, hits: { spray: 0, hive: 0, flam: 0, shove: 0, tumble: 0 } } };
    P.flams.length = 0; P.fxs.length = 0; P.puffs.length = 0; DUELS.blind(0);
    const R = P.R; R.root.visible = true; R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0); R.hive.visible = true; R.hive.scale.set(1, P.hive0.s, 1); R.hive.position.y = P.hive0.y; P.roll.visible = false;
    DUELS.bars(hp / 100, 1); return st;
  }
  function subHud(st) { const p = Math.round(st.power * 100), full = st.power >= 1;
    DUELS.sub('<span class="hqpw' + (full ? ' full' : '') + '">' + (full ? 'SALON!' : 'POWER') + ' <span class="t"><i style="width:' + p + '%"></i></span></span>', 'PHASE ' + (st.phase + 1) + '/3'); }
  P.start = function () {
    P.st = null; const st = reset(clamp(+(Q.get('honqueenphase') || 1) - 1, 0, 2) | 0); DUELS.log.push('honqueen:' + P.rigKind); subHud(st);
    if (Q.get('honqueenhp')) st.hp = clamp(+Q.get('honqueenhp'), 1, 100);
    DUELS.banner('THE HON QUEEN<small>FEDERAL HILL · PHASE 1</small>', 2.4);
    DUELS.say('THE HON QUEEN', pick(lines().intro), 3.4);
    P.camP = new THREE.Vector3(0, HT + 6, 2); P.camL = new THREE.Vector3(0, HT + 2, QZ);
  };
  P.retry = function () { const ph = P.st.phase; reset(ph); P.st.ms = 'guard'; P.st.mdur = 1.6; subHud(P.st); DUELS.banner('PHASE ' + (ph + 1) + '<small>AGAIN! FULL HEALTH</small>', 1.6); };
  P.exit = function () { for (const o of POPS) { o.t = 9; o.e.style.opacity = '0'; } DUELS.blind(0); };

  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; }
  function addPower(st, v) { const was = st.power >= 1; st.power = Math.min(1, st.power + v); if (!was && st.power >= 1) { DUELS.tell('POWER FULL! ACT = SALON SHOWDOWN', 1.4); sfx('jump'); } subHud(st); }
  function spark(x, y, z, n = 8, spd = 3) { for (let k = 0; k < n && P.fxs.length < 64; k++) P.fxs.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(rnd(-spd, spd), rnd(1, spd + 2), rnd(-spd, spd)), t: 0, life: rnd(0.35, 0.7) }); }
  function puff(p, v, life = 1, s = 1) { if (P.puffs.length < 56) P.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  const haroldY = (st) => gy(st.hz) + st.hy;
  function hurtHarold(st, dmg, kind, kbz = -6, kbx = 0) {
    if (st.inv > 0 || st.over || st.salT >= 0 || st.tumbleT >= 0) return false;
    st.hp -= dmg; st.inv = 1.2; st.hurtT = 0.4; st.atkT = -1; st.combo = 0; st.stats.hitsTaken++; st.stats.hits[kind]++; DUELS.hurt(); sfx('hurt'); P.hflash = 1; st.shake = Math.max(st.shake, 0.4); st.hs = 0.06;
    st.kbz = Math.min(st.kbz, kbz); st.kbx += kbx; V.set(st.hx, haroldY(st) + 1.8, st.hz); pop(V, '-' + dmg, 'r', 0.8);
    if (st.hp <= 0 && !st.secondWind) { st.secondWind = true; st.hp = 40; DUELS.banner('SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 1.8); DUELS.log.push('honqueen:secondwind'); return true; }
    if (st.hp <= 0) { st.hp = 0; st.over = true; st.kbz = 0; st.kbx = 0; sfx('ko'); DUELS.log.push('honqueen:lose:' + kind);
      setTimeout(() => { if (DUELS.cur === P) DUELS.over('lose', 'ROLLED, HON!', 'The Hon Queen sent Harold down the hill. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400); }
    else if (st.hp < 35 && !st.cakeUsed && !st.cake) { st.cakeUsed = true; st.cake = { t: 0 }; DUELS.say('MAVIS', 'Crab cake, hon! Catch!', 1.8); }
    if (Math.random() < 0.35 && kind !== 'tumble') DUELS.say('THE HON QUEEN', pick(TAUNT), 1.6);
    return true;
  }
  function dodged(st, what) { st.stats.dodges++; addPower(st, 0.08); V.set(st.hx, haroldY(st) + 2.1, st.hz); pop(V, what, 'b', 0.7); }

  // ---------------- her brain ----------------
  const hittable = (st) => ['open', 'stun', 'curlers'].includes(st.ms);
  function hqDist(st) { return Math.hypot(st.hx - st.qx, st.hz - st.qz); }
  function nextAttack(st) {
    const PH = PHASES[st.phase];
    if (st.shoveCd <= 0 && hqDist(st) < 3.6) { st.stats.attacks.shove++; st.shoveCd = 5; setM(st, 'shoveTell', PH.shove); DUELS.tell('HIP CHECK! BACK OFF!', PH.shove); sfx('jump'); return; }
    const a = PH.mix[st.mixI++ % PH.mix.length]; st.stats.attacks[a]++;
    if (a === 'spray') { setM(st, 'sprayTell', PH.spray); DUELS.tell('HAIRSPRAY! GET OUT OF THE CONE!', PH.spray); rattle(); aimAt(st); }
    else if (a === 'hive') { st.lx = clamp(st.hx, X0 + 1.2, X1 - 1.2); setM(st, 'hiveTell', PH.hive); DUELS.tell('BEEHIVE BOULDER! OFF THE LIT LANE!', PH.hive); }
    else { setM(st, 'flamTell', PH.flam); DUELS.tell('LAWN FLAMINGOS! STAY OUT OF THE RINGS!', PH.flam); st.fl = [];
      for (let i = 0; i < PH.nfl; i++) { let x = st.hx, z = st.hz; if (i) { const a2 = rnd(0, TAU), r = rnd(1.6, 3.6); x += Math.cos(a2) * r; z += Math.sin(a2) * r * 0.8; }
        st.fl.push({ x: clamp(x, X0 + 0.5, X1 - 0.5), z: clamp(z, ZB + 0.6, ZE - 1), go: false }); } }
  }
  function aimAt(st) { const dx = st.hx - st.qx, dz = st.hz - st.qz, l = Math.hypot(dx, dz) || 1; st.ax = dx / l; st.az = dz / l; st.alen = clamp(l + 3.5, 6, 20); }
  function inCone(st, x, z, pad = 0) { const dx = x - st.qx, dz = z - st.qz, l = Math.hypot(dx, dz); if (l < 0.6) return true; if (l > st.alen + 0.5) return false;
    const c = (dx * st.ax + dz * st.az) / l; return Math.acos(clamp(c, -1, 1)) < HALF + pad + 0.35 / l; }
  function qThink(st, dt) {
    const PH = PHASES[st.phase]; st.mt += dt; st.shoveCd -= dt; const u = clamp(st.mt / st.mdur, 0, 1);
    const track = (spd) => { st.qx = damp(st.qx, clamp(st.hx * 0.6, -4.5, 4.5), spd, dt); st.qyaw = dampAngle(st.qyaw, Math.atan2(st.hx - st.qx, st.hz - st.qz), 6, dt); };
    switch (st.ms) {
      case 'intro': track(1); st.pose = 'guard'; if (st.mt > st.mdur) setM(st, 'guard', 1.0); break;
      case 'guard': track(1.4); st.pose = 'guard'; if (st.mt > st.mdur) nextAttack(st); break;
      // HAIRSPRAY CLOUD: shake the can (tell, cone tracks Harold, locks for the last 0.5 s), then a 0.8 s blast
      case 'sprayTell': st.pose = 'shake'; st.qyaw = dampAngle(st.qyaw, Math.atan2(st.ax, st.az), 10, dt); if (st.mdur - st.mt > 0.5) aimAt(st); if (Math.floor(st.mt / 0.45) !== Math.floor((st.mt - dt) / 0.45)) rattle();
        if (st.mt > st.mdur) { setM(st, 'spray', 0.8); hiss(0.9); } break;
      case 'spray': { st.pose = 'spray'; const nz = V.set(st.qx + st.ax * 0.9, HT + 2.0, st.qz + st.az * 0.9);
        for (let k = 0; k < 2; k++) { const s = rnd(0.55, 1) * 9; puff(nz, V2.set((st.ax + rnd(-HALF, HALF) * st.az) * s, rnd(-1.6, -0.2), (st.az - rnd(-HALF, HALF) * st.ax) * s), rnd(0.9, 1.3), rnd(0.7, 1.2)); }
        if (u > 0.15 && !st.hitThis && st.tumbleT < 0 && inCone(st, st.hx, st.hz)) { st.hitThis = true; if (hurtHarold(st, DMG.spray, 'spray', -9, st.ax * 3)) st.blindT = 1.6; }
        if (st.mt > st.mdur) { if (!st.hitThis) dodged(st, 'DODGED THE SPRAY!'); setM(st, 'open', PH.open); DUELS.tell('SHE\u2019S WINDED: HIT HER!', 1.0); } break; }
      // BEEHIVE BOULDER: shuffle over to the lane, lift the hive (tell), then it rolls down the lit lane; she's bare-headed (curlers) = OPEN
      case 'hiveTell': st.pose = 'lift'; st.qx = damp(st.qx, st.lx, 5, dt); st.qyaw = dampAngle(st.qyaw, Math.PI, 8, dt);
        if (st.mt > st.mdur) { setM(st, 'hiveRoll', 9); st.rhz = st.qz - 1.0; st.rvz = -3; st.qx = st.lx; sfx('heavy'); st.shake = 0.2; st.rolled = false; } break;
      case 'hiveRoll': st.pose = 'curl'; st.rvz = Math.max(-15, st.rvz - PH.hacc * dt); st.rhz += st.rvz * dt;
        if (!st.hitThis && st.tumbleT < 0 && Math.abs(st.hx - st.lx) < 1.05 && Math.abs(st.hz - st.rhz) < 0.95) { if (st.hy < 0.55) { st.hitThis = true; hurtHarold(st, DMG.hive, 'hive', -10, 0); } else if (!st.rolled) { st.rolled = true; dodged(st, 'HOPPED THE HIVE!'); } }
        if (!st.hitThis && !st.rolled && st.rhz < st.hz - 1.2) { st.rolled = true; dodged(st, 'CLEAR!'); }
        if (st.rhz < ZS - 1) { setM(st, 'curlers', PH.open + 0.4); st.hiveS = 0; DUELS.tell('NO HIVE! HIT HER NOW!', 1.0); } break;
      case 'curlers': st.pose = 'curl'; if (st.mt > st.mdur) { st.hiveS = 1; spark(st.qx, HT + 3.2, st.qz, 10); sfx('jump'); setM(st, 'guard', rnd(...PH.rest)); } break;
      // LAWN-FLAMINGO TOSS: rings on the landing spots (tell), then the flamingos arc in one after another
      case 'flamTell': st.pose = 'purse'; track(2); if (st.mt > st.mdur) { setM(st, 'flamThrow', 0.12 * st.fl.length + 1.2); st.fi = 0; } break;
      case 'flamThrow': st.pose = 'throw';
        while (st.fi < st.fl.length && st.mt > st.fi * 0.12) { const f = st.fl[st.fi++]; f.go = true; P.flams.push({ x0: st.qx + 0.6, z0: st.qz, y0: HT + 2.4, x: f.x, z: f.z, t: 0, T: 0.95, landed: false, stuck: 0, spin: rnd(-6, 6), ring: f }); sfx('swing'); }
        if (st.mt > st.mdur) { if (!st.hitThis) dodged(st, 'FLAMINGO-PROOF!'); setM(st, 'open', PH.open); DUELS.tell('SHE\u2019S OUT OF FLAMINGOS: HIT HER!', 1.0); } break;
      // HIP CHECK: plant + wiggle with a spreading red ring (tell), then a shove that sends Harold way downhill
      case 'shoveTell': st.pose = 'wiggle'; st.qyaw = dampAngle(st.qyaw, Math.atan2(st.hx - st.qx, st.hz - st.qz), 8, dt); if (st.mt > st.mdur) { setM(st, 'shove', 0.35); sfx('swing'); } break;
      case 'shove': st.pose = 'shove'; if (!st.hitThis && st.mt > 0.12) { st.hitThis = true; sfx('heavy'); st.shake = 0.35; spark(st.qx, HT + 1, st.qz - 1, 8);
          if (hqDist(st) < 3.0) hurtHarold(st, DMG.shove, 'shove', -17, (st.hx - st.qx) * 2); else dodged(st, 'NOT TODAY, HON!'); }
        if (st.mt > st.mdur) setM(st, 'open', PH.open * 0.8); break;
      case 'open': st.pose = 'open'; if (st.mt > st.mdur) { if (PH.combo && Math.random() < 0.35) { setM(st, 'guard', 0.4); } else setM(st, 'guard', rnd(...PH.rest)); } break;
      case 'stun': st.pose = 'pinned'; if (st.mt > st.mdur) setM(st, 'guard', rnd(...PH.rest)); break;
      case 'down': st.pose = 'open'; if (st.mt > st.mdur) { st.phase++; st.qhp = QHP; st.hp = Math.min(100, st.hp + 35); st.cakeUsed = false; st.mixI = 0; st.hiveS = 1; setM(st, 'guard', 1.4); subHud(st);
          DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 1 ? 'MORE FLAMINGOS, HON!' : 'EXTRA HOLD!') + '</small>', 2.0); } break;
      case 'ko': break;
    }
  }
  function stepFlams(st, dt) {
    for (let i = P.flams.length - 1; i >= 0; i--) { const f = P.flams[i];
      if (!f.landed) { f.t += dt; if (f.t >= f.T) { f.landed = true; f.stuck = 1.6; spark(f.x, gy(f.z) + 0.2, f.z, 6, 2); sfx('hit');
          if (st.tumbleT < 0 && Math.hypot(st.hx - f.x, st.hz - f.z) < 1.0 && st.hy < 0.5) { if (hurtHarold(st, DMG.flam, 'flam', -5, (st.hx - f.x) * 3)) st.hitThis = true; } } }
      else { f.stuck -= dt; if (f.stuck <= 0) { spark(f.x, gy(f.z) + 0.5, f.z, 4, 1.5); P.flams.splice(i, 1); } } }
  }

  // ---------------- Harold ----------------
  function hitQueen(st, dmg, word, cls) {
    st.qhp -= dmg; st.stats.landed++; addPower(st, 0.06); st.combo++; st.comboT = 1.4; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.combo);
    const R = P.R; for (const m of R.mats) if (m && m.userData.flashC) { m.userData.flashC.value.set('#ffffff'); m.userData.flash.value = 0.85; }
    V.set(st.qx, HT + 2.2, st.qz); pop(V, word || String(dmg), cls || '', 0.85); V2.copy(V); V.y += 0.5; pop(V, '-' + dmg, '', 0.7); spark(V2.x, V2.y - 0.4, V2.z - 0.4, 7);
    if (st.combo >= 3 && st.combo % 3 === 0) { V.set(st.hx, haroldY(st) + 2.6, st.hz); pop(V, st.combo + ' HIT COMBO!', 'p', 0.9); }
    if (st.qhp <= 0) { st.qhp = 0; P.flams.length = 0;
      if (st.phase >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.ts = 0.3; st.tsT = 1.8; DUELS.banner('K.O.!<small>THE BEEHIVE IS FLAT</small>', 2.4); DUELS.log.push('honqueen:ko'); }
      else { setM(st, 'down', 2.6); st.hiveS = 1; DUELS.banner('PHASE CLEAR!<small>SHE\u2019S FIXING HER HAIR</small>', 2.0); st.ts = 0.4; st.tsT = 0.6;
        if (Math.random() < 0.7) DUELS.say('MAVIS', ['That\u2019s my Harold!', 'Her hair\u2019s not the only thing coming down, hon!', 'Mind the hill, dear!'][st.phase % 3], 2.0); } }
  }
  function landSwing(st) {
    const c = COMBO[st.atkI]; const d = hqDist(st);
    if (d < 2.7 && st.ms !== 'ko' && st.ms !== 'down') {
      if (hittable(st)) { hitQueen(st, c.d + (st.ms === 'stun' ? 3 : 0), c.w, st.atkI === 2 ? 'p' : ''); sfx(st.atkI === 2 ? 'heavy' : 'hit'); st.hs = st.atkI === 2 ? 0.11 : 0.07; st.shake = Math.max(st.shake, st.atkI === 2 ? 0.35 : 0.15);
        if (st.atkI === 2) for (let k = 0; k < 10; k++) puff(V.set(st.hx + rnd(-0.6, 0.6), haroldY(st) + rnd(0.6, 1.8), st.hz + rnd(-0.4, 0.6)), V2.set(rnd(-2, 2), rnd(0, 2), rnd(-1, 2)), 0.6, 0.6); return true; }
      if (st.tellT <= 0) { st.tellT = 1.4; DUELS.tell('SHE\u2019S GUARDING HER HAIR: DODGE FIRST!', 0.9); sfx('hit'); V.set(st.qx, HT + 3.4, st.qz); pop(V, 'BOING!', 'b', 0.6); } }
    return false;
  }
  function salon(st) { // SALON SHOWDOWN (team-up): Mavis charges up, afro vs beehive, pins her; Harold vaults up for the SALON SMASH
    st.power = 0; subHud(st); st.stats.specials++; st.salT = 0; st.ts = 0.4; st.tsT = 2.2; st.atkT = -1; P.flams.length = 0; st.salHit = false; st.sal0 = { mx: P.M.root.position.x, mz: P.M.root.position.z, hx: st.hx, hz: st.hz };
    if (st.ms === 'hiveRoll') { st.rhz = ZS - 2; } setM(st, 'stun', 4.2); st.hiveS = 1;
    DUELS.banner('SALON SHOWDOWN!<small>AFRO VS. BEEHIVE</small>', 1.8); DUELS.say('MAVIS', 'Honey, my hair\u2019s been doing this since 1962!', 2.0); sfx('heavy'); st.shake = 0.3; DUELS.log.push('honqueen:salon');
  }
  function stepSalon(st, dt) {
    if (st.salT < 0) return; st.salT += dt; const t = st.salT;
    if (t > 1.0 && t - dt <= 1.0) { sfx('heavy'); st.shake = 0.6; st.hs = 0.1; spark(st.qx - 0.5, HT + 3, st.qz - 0.4, 16, 4); V.set(st.qx, HT + 3.6, st.qz); pop(V, 'AFRO WINS!', 'g', 1.0); }
    if (t > 1.3 && t < 1.65) { const k = (t - 1.3) / 0.35; st.hx = lerp(st.sal0.hx, st.qx + 0.3, k); st.hz = lerp(st.sal0.hz, st.qz - 1.5, k); st.hy = Math.sin(k * Math.PI) * 2.2; st.yaw = Math.atan2(st.qx - st.hx, st.qz - st.hz); }
    if (t > 1.65 && !st.salHit) { st.salHit = true; st.hy = 0; st.atkI = 2; st.atkT = 0; st.atkHit = true; hitQueen(st, 26, 'SALON SMASH!', 'g'); sfx('heavy'); st.hs = 0.14; st.shake = 0.7; if (st.ms === 'stun') DUELS.tell('SHE\u2019S PINNED: GET HER!', 1.2); }
    if (t > 2.3) st.salT = -1;
  }
  P.step = function (rdt, I) {
    const st = P.st; if (!st) return;
    if (st.tsT > 0) { st.tsT -= rdt; if (st.tsT <= 0) st.ts = 1; }
    if (st.hs > 0) { st.hs -= rdt; stepFx(rdt * 0.3); popTick(rdt); return; }
    const dt = rdt * st.ts; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.tellT -= dt; st.chainT -= dt; st.comboT -= dt; if (st.comboT <= 0) st.combo = 0;
    if (st.blindT > 0) { st.blindT -= dt; DUELS.blind(clamp(st.blindT / 1.0, 0, 1) * 0.6); } else DUELS.blind(0);
    if (!st.over) {
      if (st.tumbleT >= 0) { // rolled down the hill to the street: tumble, then hop back up onto the path
        st.tumbleT += dt; const k = st.tumbleT; st.hz = Math.max(ZS - 1, st.hz - 9 * dt * (1 - k)); st.hy = 0;
        if (k > 1.1) { st.tumbleT = -1; st.hz = ZB + 1.6; st.hx = clamp(st.hx, X0 + 1, X1 - 1); st.inv = 1.2; st.kbx = st.kbz = 0; sfx('jump'); }
      } else if (st.salT < 0 || st.salT > 1.65) {
        // move: stick up = uphill (+z, away from the camera); screen right = world -x. Uphill is slower, downhill a touch quicker.
        let vx = -I.mx, vz = I.my; const m = Math.hypot(vx, vz); if (m > 1) { vx /= m; vz /= m; }
        const slow = st.atkT >= 0 ? 0.25 : st.hurtT > 0 ? 0.3 : 1, hill = st.hz < ZT ? (vz > 0 ? 0.8 : 1.12) : 1; st.moving = m > 0.15;
        st.hx += (vx * 6.2 * slow + st.kbx) * dt; st.hz += (vz * 6.2 * slow * hill + st.kbz) * dt; if (st.moving && st.atkT < 0) st.yaw = dampAngle(st.yaw, Math.atan2(vx, vz), 14, dt);
        st.kbx *= Math.exp(-4 * dt); st.kbz *= Math.exp(-3.2 * dt); if (Math.abs(st.kbz) < 0.2) st.kbz = 0;
        st.hx = clamp(st.hx, X0, X1); st.hz = Math.min(st.hz, ZE);
        const dq = hqDist(st); if (dq < 1.25 && st.ms !== 'ko') { st.hx = st.qx + (st.hx - st.qx) / (dq || 1) * 1.25; st.hz = st.qz + (st.hz - st.qz) / (dq || 1) * 1.25; }
        if (st.hz < ZB) { st.tumbleT = 0; st.atkT = -1; st.hy = 0; st.vy = 0; st.combo = 0; st.stats.tumbles++; V.set(st.hx, gy(st.hz) + 2, st.hz); pop(V, 'DOWN THE HILL!', 'r', 1.0);
          if (st.inv <= 0) { st.hp -= DMG.tumble; st.stats.hitsTaken++; st.stats.hits.tumble++; DUELS.hurt(); sfx('hurt'); if (st.hp <= 0) { st.inv = 0; st.hp = 1; hurtHarold(st, 1, 'tumble'); } }
          if (Math.random() < 0.6) DUELS.say('THE HON QUEEN', pick(TAUNT), 1.6); }
        // hop
        if (I.b && st.hy <= 0.001 && st.hurtT <= 0 && st.tumbleT < 0) { st.vy = 7.2; sfx('jump'); }
        // cane combo (auto-faces her when she's in reach)
        if (I.a && st.hurtT <= 0 && st.tumbleT < 0 && (st.atkT < 0 || (st.atkT > COMBO[st.atkI].t * 0.6 && st.atkI < 2))) {
          st.atkI = st.atkT >= 0 || st.chainT > 0 ? Math.min(2, st.atkI + 1) : 0; if (st.atkI < 0) st.atkI = 0; st.atkT = 0; st.atkHit = false; st.stats.swings++; sfx('swing');
          const d = hqDist(st); if (d < 3.4) { st.yaw = Math.atan2(st.qx - st.hx, st.qz - st.hz); if (d > 1.6) { st.hx += Math.sin(st.yaw) * 0.45; st.hz += Math.cos(st.yaw) * 0.45; } } }
        // SALON SHOWDOWN
        if (I.c && st.salT < 0) { if (st.power >= 1 && !['down', 'intro', 'ko'].includes(st.ms)) salon(st); else if (st.power < 1 && st.tellT <= 0) { st.tellT = 1; DUELS.tell('POWER NOT FULL YET', 0.9); } }
      }
      if (st.hy > 0 || st.vy > 0) { st.vy -= 22 * dt; st.hy = Math.max(0, st.hy + st.vy * dt); if (st.hy === 0) st.vy = 0; }
      if (st.atkT >= 0) { st.atkT += dt; const c = COMBO[st.atkI]; if (!st.atkHit && st.atkT > c.t * 0.38) { st.atkHit = true; landSwing(st); } if (st.atkT > c.t) { st.atkT = -1; st.chainT = 0.35; if (st.atkI >= 2) st.chainT = 0; } }
      // Mavis' crab cake
      if (st.cake) { st.cake.t += dt; if (st.cake.t > 0.9) { st.hp = Math.min(100, st.hp + 30); V.set(st.hx, haroldY(st) + 2, st.hz); pop(V, '+30 CRAB CAKE', 'g', 1.0); st.cake = null; sfx('jump'); } }
    }
    qThink(st, dt); stepFlams(st, dt); stepSalon(st, dt); stepFx(dt); popTick(rdt);
    st.shake = Math.max(0, st.shake - rdt * 1.6);
    DUELS.bars(st.hp / 100, (st.qhp / QHP + (2 - st.phase)) / 3); DUELS.hot(st.power >= 1);
    if (st.ms === 'ko') outro(st, dt);
  };
  // ---------------- the ending: the beehive deflates, she rolls all the way down the hill onto the stoop ----------------
  const STOOP = { x: 6.2, z: ZB - 1.6 + 0.35 };
  function outro(st, dt) {
    st.outT += dt; const t = st.outT;
    if (!st.ko0) st.ko0 = { x: st.qx, z: st.qz };
    if (t < 0.9) { st.pose = 'deflate'; st.hiveS = 1 - 0.7 * ease(t / 0.9); if (Math.random() < dt * 30) puff(V.set(st.qx + rnd(-0.4, 0.4), HT + 3.3, st.qz), V2.set(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)), 0.8, 0.5); }
    else if (t < 3.6) { st.pose = 'roll'; const u = ease((t - 0.9) / 2.7); st.qx = lerp(st.ko0.x, STOOP.x, u); st.qz = lerp(st.ko0.z, STOOP.z, u); st.rollA = (st.rollA || 0) + dt * 9 * (1 - u * 0.6);
      if (!st.wee) { st.wee = true; DUELS.say('THE HON QUEEN', 'Whoa-oa-oa, hon!', 1.6); } }
    else { st.pose = 'stoop'; st.qx = STOOP.x; st.qz = STOOP.z; if (!st.saidD) { st.saidD = true; st.ts = 1; DUELS.say('THE HON QUEEN', 'Go get a crab cake, hon.', 3.2); sfx('hit'); } }
    if (t > 5.4 && !st.winDone) { st.winDone = true; DUELS.bossCleared('fedhill', 'honqueen-duel');
      const h = st.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('honqueen:win:' + g);
      setTimeout(() => { if (DUELS.cur === P) DUELS.over('win', 'THE HON QUEEN<br>TOOK A SEAT', '<span style="color:#ffd23c;font-size:16px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · HITS TAKEN ' + h + ' · BEST COMBO ' + st.stats.maxCombo + '<br>Federal Hill is clear. Crime at Federal Hill: 0.'); }, SIM ? 300 : 900); }
  }
  function stepFx(dt) {
    const q = P.cam.quaternion;
    for (let i = P.fxs.length - 1; i >= 0; i--) { const p = P.fxs[i]; p.t += dt; p.v.y -= 12 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) P.fxs.splice(i, 1); }
    P.fxs.forEach((p, i) => { const s = 1 - p.t / p.life * 0.6; M4.compose(p.p, q, V.set(s, s, s)); P.fx.setMatrixAt(i, M4); }); P.fx.count = P.fxs.length; P.fx.visible = P.fxs.length > 0; P.fx.instanceMatrix.needsUpdate = true;
    for (let i = P.puffs.length - 1; i >= 0; i--) { const p = P.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.4); p.p.addScaledVector(p.v, dt); if (p.t > p.life) P.puffs.splice(i, 1); }
    P.puffs.forEach((p, i) => { const s = p.s * (0.5 + p.t * 2.4); M4.compose(p.p, q, V.set(s, s, s)); P.puffM.setMatrixAt(i, M4); }); P.puffM.count = P.puffs.length; P.puffM.visible = P.puffs.length > 0; P.puffM.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.tumbleT >= 0) { const p = HERO_POSES.down(1, true); p.tilt = [-Math.PI / 2 - st.tumbleT * 14, 0, 0]; return p; }
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    if (st.atkT >= 0) { const c = COMBO[st.atkI]; return HERO_POSES[c.pose](clamp(st.atkT / c.t, 0, 1)); }
    if (st.hy > 0.02) return HERO_POSES.jump(st.vy);
    if (st.moving) return HERO_POSES.run(t, 6);
    return HERO_POSES.idle(t);
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || hittable(st) || st.cake ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    if (st.salT >= 0 && st.salT < 1.0) return HERO_POSES.run(t, 8);
    if (st.salT >= 1.0 && st.ms === 'stun') { const pp = HERO_POSES.idle(t); legsStance(pp, 0.3, 0.8); pp.shL = [-2.0, 0, 0.3]; pp.shR = [-2.0, 0, -0.3]; pp.elL = pp.elR = [-0.2, 0, 0]; pp.torso = [0.5, 0, 0]; return pp; } // pinning her
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.cake && st.cake.t < 0.4) p.shR = [-2.8, 0, -0.3]; return p; }
  function poseQueen(st, dt) {
    const R = P.R, t = st.t; let armL = -0.2, armR = -0.3, armRz = 0, armLz = 0, canShake = 0, bodyRX = 0, bodyRZ = Math.sin(t * 1.6) * 0.03, hipY = 0, hipZ = 0, yOff = 0, glow = null, glassZ = 0;
    const u = clamp(st.mt / Math.max(0.01, st.mdur), 0, 1);
    switch (st.pose) {
      case 'guard': armR = -0.9 + Math.sin(t * 2) * 0.08; armL = -0.4; hipY = Math.sin(t * 2.4) * 0.12; break; // can at the ready, purse swinging
      case 'shake': armR = -1.6 + Math.sin(st.mt * 34) * 0.35; armRz = Math.sin(st.mt * 34) * 0.15; canShake = Math.sin(st.mt * 40) * 0.35; armL = -0.5; glow = ['#ff7ac8', 0.2 + 0.3 * (Math.sin(st.mt * 22) * 0.5 + 0.5)]; break;
      case 'spray': armR = -1.55; armL = -0.8; bodyRX = 0.12; break;
      case 'lift': { const k = ease(u); armL = -2.9 * k; armR = -2.9 * k; armLz = 0.3 * k; armRz = -0.3 * k; glow = ['#ff8a3a', 0.15 + 0.25 * (Math.sin(st.mt * 20) * 0.5 + 0.5)]; break; }
      case 'curl': armL = -0.3; armR = -1.0 + Math.sin(t * 7) * 0.3; armRz = -0.4; glassZ = 0.25; break; // patting her curlers
      case 'purse': armL = -1.4 - Math.sin(st.mt * 12) * 0.2; armR = -0.6; glow = ['#ff6fb8', 0.15 + 0.25 * (Math.sin(st.mt * 22) * 0.5 + 0.5)]; break;
      case 'throw': armR = -0.6; armL = -2.6 + Math.sin(st.mt * 26) * 1.0; break;
      case 'wiggle': hipY = Math.sin(st.mt * 16) * 0.5; hipZ = Math.sin(st.mt * 16) * 0.12; armL = -0.4; armR = -0.4; armLz = 0.6; armRz = -0.6; glow = ['#ff3040', 0.2 + 0.3 * (Math.sin(st.mt * 26) * 0.5 + 0.5)]; break;
      case 'shove': hipY = 1.2 * Math.sin(clamp(st.mt / 0.25, 0, 1) * Math.PI); bodyRZ = 0.2; break;
      case 'open': armR = -0.2; armL = -1.8 + Math.sin(t * 14) * 0.25; armLz = 0.4; bodyRX = 0.1; glassZ = 0.35; break; // fanning herself, glasses askew
      case 'pinned': bodyRX = -0.35; yOff = -0.25; armL = -2.6; armR = -2.6; armLz = 0.8; armRz = -0.8; glassZ = 0.5; break;
      case 'deflate': armL = -2.4; armR = -2.4; glassZ = 0.4; break;
      case 'roll': bodyRX = st.rollA; yOff = 0.9; armL = -2.8; armR = -2.8; break;
      case 'stoop': bodyRX = -0.25; yOff = 0.15; armL = -0.7; armR = -0.7; armLz = 0.5; armRz = -0.5; glassZ = 0.3; break;
    }
    const qy = st.pose === 'stoop' ? gy(STOOP.z) + 0.45 : st.pose === 'roll' ? gy(st.qz) : HT;
    R.root.position.set(st.qx, qy + yOff, st.qz); R.root.rotation.y = st.pose === 'roll' || st.pose === 'stoop' ? Math.PI * (st.pose === 'stoop' ? 0 : 1) : st.qyaw;
    R.body.rotation.x = st.pose === 'roll' ? bodyRX : damp(R.body.rotation.x, bodyRX, 10, dt); R.body.rotation.z = damp(R.body.rotation.z, bodyRZ, 10, dt);
    R.hips.rotation.y = damp(R.hips.rotation.y, hipY, 18, dt); R.hips.rotation.z = damp(R.hips.rotation.z, hipZ, 18, dt);
    R.armL.rotation.x = damp(R.armL.rotation.x, armL, 12, dt); R.armR.rotation.x = damp(R.armR.rotation.x, armR, 14, dt); R.armL.rotation.z = damp(R.armL.rotation.z, armLz, 12, dt); R.armR.rotation.z = damp(R.armR.rotation.z, armRz, 12, dt);
    R.can.rotation.z = canShake; R.can.position.y = -1.05 + canShake * 0.1; R.glasses.rotation.z = damp(R.glasses.rotation.z, glassZ, 8, dt);
    // the hive: on her head (lifted during the tell), gone while it rolls / in curlers, deflated on the KO
    const lift = st.ms === 'hiveTell' ? ease(u) * 0.9 : 0; R.hive.visible = st.ms !== 'hiveRoll' && !(st.ms === 'curlers' && st.hiveS < 0.5);
    R.hive.position.y = P.hive0.y + lift; const hs = st.ms === 'ko' ? st.hiveS : 1; R.hive.scale.set(1 + (1 - hs) * 0.3, P.hive0.s * hs, 1 + (1 - hs) * 0.3);
    for (const m of R.mats) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow) for (const m of R.mats) if (m && m.userData.flash) { m.userData.flashC.value.set(glow[0]); m.userData.flash.value = Math.max(m.userData.flash.value, glow[1]); }
  }
  function poseTells(st, dt) {
    const tell = ['sprayTell', 'hiveTell', 'flamTell', 'shoveTell'].includes(st.ms);
    P.bang.visible = tell; if (tell) { P.bang.position.set(st.qx, HT + 4.6 + Math.sin(st.t * 10) * 0.08, st.qz); const s = 1 + 0.15 * Math.sin(st.t * 18); P.bang.scale.set(0.55 * s, 1.1 * s, 1); }
    // hairspray cone: from the can toward Harold, pink while tracking, red once locked, bright during the blast
    const cv = st.ms === 'sprayTell' || st.ms === 'spray'; P.cone.visible = cv;
    if (cv) { const locked = st.ms === 'spray' || st.mdur - st.mt <= 0.5; P.cone.position.set(st.qx + st.ax * 0.7, HT + 1.9, st.qz + st.az * 0.7); V.set(P.cone.position.x + st.ax, HT + 1.9 - 0.22, P.cone.position.z + st.az); P.cone.lookAt(V);
      P.cone.scale.set(st.alen, st.alen * 0.55, st.alen); P.cone.material.color.set(locked ? '#ff3a6a' : '#ff9ad8'); P.cone.material.opacity = st.ms === 'spray' ? 0.38 : 0.12 + 0.14 * (Math.sin(st.t * (locked ? 30 : 12)) * 0.5 + 0.5); }
    // the lit lane for the beehive
    const lv = st.ms === 'hiveTell' || st.ms === 'hiveRoll'; P.lane.visible = lv;
    if (lv) { P.lane.position.x = st.ms === 'hiveTell' ? st.qx : st.lx; P.lane.material.map.offset.y = st.t * 2.2; P.lane.material.opacity = st.ms === 'hiveRoll' ? 0.55 : 0.3 + 0.35 * (Math.sin(st.t * 20) * 0.5 + 0.5); }
    P.roll.visible = st.ms === 'hiveRoll';
    if (P.roll.visible) { P.roll.position.set(st.lx, gy(st.rhz) + 0.62, st.rhz); P.roll.rotation.set(-(st.qz - st.rhz) / 0.6, 0, 0); }
    // rings: flamingo landing spots (tell + flight) and the hip-check radius
    let n = 0; const ringAt = (x, z, s, col, y) => { if (n >= 10) return; E3.set(-Math.PI / 2 - (z < ZT ? SA : 0), 0, st.t * 2); Q4.setFromEuler(E3); M4.compose(V.set(x, (y ?? gy(z)) + 0.08, z), Q4, V2.set(s, s, s)); P.ringM.setMatrixAt(n, M4); P.ringM.setColorAt(n, col); n++; };
    const pulse = 0.55 + 0.45 * Math.sin(st.t * 24);
    if (st.ms === 'flamTell' || st.ms === 'flamThrow') for (const f of st.fl || []) { const fl = P.flams.find((o) => o.ring === f); if (fl && fl.landed) continue; ringAt(f.x, f.z, 1.0, new THREE.Color('#ff3d6e').multiplyScalar(pulse)); }
    if (st.ms === 'shoveTell') { const k = clamp(st.mt / st.mdur, 0, 1); ringAt(st.qx, st.qz, 1.2 + 1.8 * k, new THREE.Color('#ff2a3a').multiplyScalar(pulse), HT); }
    P.ringM.count = n; P.ringM.visible = n > 0; P.ringM.instanceMatrix.needsUpdate = true; if (P.ringM.instanceColor) P.ringM.instanceColor.needsUpdate = true;
    // flamingos in flight / stuck in the lawn
    let m = 0; for (const f of P.flams) { if (m >= 8) break; let x, y, z, rx = 0, ry = 0;
      if (!f.landed) { const k = f.t / f.T; x = lerp(f.x0, f.x, k); z = lerp(f.z0, f.z, k); y = lerp(f.y0, gy(f.z), k) + 4.2 * k * (1 - k) * 2; rx = k * f.spin; ry = k * 3; }
      else { x = f.x; z = f.z; y = gy(f.z) - 0.1; ry = f.spin; }
      E3.set(rx, ry, 0); Q4.setFromEuler(E3); M4.compose(V.set(x, y, z), Q4, V2.set(1.25, 1.25, 1.25)); P.flamM.setMatrixAt(m++, M4); }
    P.flamM.count = m; P.flamM.visible = m > 0; P.flamM.instanceMatrix.needsUpdate = true;
    P.shadow.position.set(st.hx, gy(st.hz) + 0.04, st.hz); P.shadow.rotation.set(-Math.PI / 2 - (st.hz < ZT ? SA : 0), 0, 0); P.shadow.scale.setScalar(0.55 - Math.min(0.25, st.hy * 0.15)); P.shadow.visible = st.tumbleT < 0;
  }
  P.render = function (rdt) {
    const st = P.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.hs > 0 ? 0.15 : st.ts), t = st.t;
    const H = P.H; H.root.position.set(st.hx, haroldY(st), st.hz); H.root.rotation.y = st.yaw; applyPose(H, haroldPose(st, t), 18, dt, st.tumbleT >= 0);
    if (P.hflash > 0) { P.hflash = Math.max(0, P.hflash - dt * 5); H.mat.userData.flash.value = P.hflash * 0.8; } else if (st.inv > 0) H.mat.userData.flash.value = Math.sin(st.t * 40) > 0 ? 0.25 : 0;
    // Mavis: cheering from the side of the slope; charges up the hill for the SALON SHOWDOWN and pins the Queen
    const M = P.M; let mx = 5.6, mz = -1.5, myaw = -0.9;
    if (st.salT >= 0 || (st.ms === 'stun' && st.sal0)) { const k = st.salT >= 0 ? clamp(st.salT / 1.0, 0, 1) : 1; mx = lerp(st.sal0.mx, st.qx + 0.9, ease(k)); mz = lerp(st.sal0.mz, st.qz - 0.9, ease(k)); myaw = Math.atan2(st.qx - mx, st.qz - mz); }
    M.root.position.set(damp(M.root.position.x, mx, st.salT >= 0 ? 30 : 4, dt), 0, damp(M.root.position.z, mz, st.salT >= 0 ? 30 : 4, dt)); M.root.position.y = gy(M.root.position.z); M.root.rotation.y = dampAngle(M.root.rotation.y, myaw, 8, dt); applyPose(M, mavisPose(st, t), 12, dt, false);
    if (st.ms !== 'stun' && st.salT < 0 && st.sal0 && st.ms !== 'ko') st.sal0 = null;
    poseQueen(st, dt); poseTells(st, dt);
    // camera: low behind Harold down the slope, looking uphill at her; portrait pulls up + back; the KO follows her roll to the stoop
    const port = VH() > VW(); P.cam.fov = port ? 64 : 50; P.cam.updateProjectionMatrix();
    const fx = st.hx * 0.45 + st.qx * 0.2, fz = Math.min(st.hz, QZ - 3), lz = lerp(st.hz, st.qz, 0.55);
    V.set(fx, gy(fz) + (port ? 4.1 : 3.4), fz - (port ? 8.6 : 7.4)); V2.set(lerp(st.hx, st.qx, 0.45), lerp(haroldY(st), HT, 0.6) + (port ? 2.0 : 1.7), lz);
    if (st.ms === 'intro' && st.phase === 0) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(st.qx + 3, HT + 3.2, st.qz - 5), V, k); V2.lerpVectors(V3.set(st.qx, HT + 2.4, st.qz), V2, k); }
    if (st.salT >= 0) { V.lerp(V3.set(st.qx - 3.5, HT + 3.2, st.qz - 5.5), 0.6); V2.set(st.qx, HT + 2, st.qz); }
    if (st.ms === 'ko') { const sy = gy(st.qz); V.set(st.qx - 4.5, sy + 4.5, st.qz + 6.5); V2.set(st.qx, sy + 1, st.qz); if (st.pose === 'stoop') { V.set(STOOP.x - 3.4, gy(STOOP.z) + 3, STOOP.z + 5.5); V2.set(STOOP.x, gy(STOOP.z) + 1.4, STOOP.z); } }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.5; V.y += rnd(-1, 1) * st.shake * 0.5; }
    const kk = 1 - Math.exp(-6 * dt / Math.max(0.2, st.ts)); P.camP.lerp(V, kk); P.camL.lerp(V2, kk); P.cam.position.copy(P.camP); P.cam.lookAt(P.camL);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 45; OUT_U.fogF.value = 150;
  };
  P.onResize = () => {};

  // ---------------- test bot: win = reads every tell, climbs into openings, hops the hive, SALON at full power; lose = stands still ----------------
  P.botThink = function (B, dt) {
    const st = P.st; if (!st || st.over) return; B.mx = 0; B.my = 0; if (B.mode === 'lose') return;
    if (B.mode === 'mash') { B.cd = (B.cd || 0) - dt; if (st.tumbleT >= 0) return; const dx = st.qx - st.hx, dz = st.qz - 1.6 - st.hz, l = Math.hypot(dx, dz); if (l > 0.5) { B.mx = -dx / l; B.my = dz / l; } if (B.cd <= 0) { B.a = true; B.cd = 0.2; } return; } // SWING-mash only (no special): walk at her, never dodge
    B.cd = (B.cd || 0) - dt; B.jcd = (B.jcd || 0) - dt; if (st.tumbleT >= 0) return;
    let flee = null, gx = null, gz = null; const left = st.mdur - st.mt;
    const away = (x, z, w = 1) => { const dx = st.hx - x, dz = st.hz - z, l = Math.hypot(dx, dz) || 1; flee = flee || [0, 0]; flee[0] += dx / l * w; flee[1] += dz / l * w; };
    if (st.ms === 'sprayTell' || st.ms === 'spray') { if (inCone(st, st.hx, st.hz, 0.15)) { const side = (st.hx - st.qx) * st.az - (st.hz - st.qz) * st.ax; let s = side >= 0 ? 1 : -1; const px = st.az * s; if (st.hx + px * 2 > X1 - 0.5 || st.hx + px * 2 < X0 + 0.5) s = -s; flee = [st.az * s, -st.ax * s]; } }
    if (st.ms === 'hiveTell' || st.ms === 'hiveRoll') { const lx = st.ms === 'hiveTell' ? st.qx : st.lx; if (Math.abs(st.hx - lx) < 1.9) { let s = st.hx >= lx ? 1 : -1; if (lx + s * 2.2 > X1 - 0.3 || lx + s * 2.2 < X0 + 0.3) s = -s; flee = [s, 0]; }
      if (st.ms === 'hiveRoll' && Math.abs(st.hx - st.lx) < 1.1 && st.rhz - st.hz < 1.6 && st.rhz > st.hz && B.jcd <= 0 && st.hy === 0) { B.b = true; B.jcd = 0.6; } }
    if (st.ms === 'flamTell' || st.ms === 'flamThrow') for (const f of st.fl || []) { const d = Math.hypot(st.hx - f.x, st.hz - f.z); if (d < 1.6) away(f.x, f.z + 0.01, 1.6 - d + 0.3); }
    if (st.ms === 'shoveTell' || (st.ms === 'shove' && st.mt < 0.15)) { if (hqDist(st) < 3.8) away(st.qx, st.qz, 1); }
    if (st.power >= 1 && st.salT < 0 && !['down', 'intro', 'ko', 'hiveRoll'].includes(st.ms) && !flee) B.c = true;
    if (!flee) {
      if (hittable(st)) { gx = st.qx; gz = st.qz - 1.6; if (hqDist(st) < 2.5 && B.cd <= 0) { B.a = true; B.cd = 0.16; } }
      else { gx = st.qx * 0.4; gz = st.qz - 5.2; }
    }
    if (st.hz < ZB + 1.6) { flee = flee || [0, 0]; flee[1] = Math.abs(flee[1]) + 1; }
    let dx = 0, dz = 0; if (flee) { dx = flee[0]; dz = flee[1]; } else if (gx !== null) { dx = gx - st.hx; dz = gz - st.hz; if (Math.hypot(dx, dz) < 0.6) dx = dz = 0; }
    const l = Math.hypot(dx, dz); if (l > 0.01) { B.mx = -dx / l; B.my = dz / l; }
  };

  DUELS.reg('honqueen', P); window.__honqueen = P;
  // entrance: the ring at the Federal Hill boss anchor on the hilltop (LANDMARKS 'fedhill' .boss = HILL top; DESIGN.md roster: Fed Hill: The Hon Queen)
  const L = LANDMARKS.find((l) => l.id === 'fedhill'); if (L && L.boss) DUELS.addTrigger('honqueen', L, L.boss.x, L.boss.z, L.boss.x + 2.4, L.boss.z - 2.4, '#ff5fa2');
  // ?honqueen=1 starts it straight away; &honqueenauto=win|lose plays it with the bot
  if (Q.has('honqueen')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('honqueenauto'); DUELS.start('honqueen', m === 'win' || m === 'lose' || m === 'mash' ? { bot: m } : {}); } }); }
})();

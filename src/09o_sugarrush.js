
// ======================= SUGAR RUSH, SUGAR REFINERY ROOF: a 3D arena brawl beside the giant neon sign (boss #15, DESIGN.md roster + BOSS_GANG_UPGRADE_PLAN §3.15).
// Signage: the refinery is the real Domino Sugars plant; its "Domino / Sugars" neon script sign is drawn on a canvas in code (DESIGN.md real-signage rule,
// Brad 2026-10-11: real landmark signs stay real, only bosses/characters are original). No logo file.
// Sugar Rush is an original sugar-crystal golem (rock-candy ponytail, crystal tiara, sugar-cube limbs, glowing candy-pink eyes). Harold fights her on foot on the
// refinery roof (camera locked on behind him), Mavis cheers from the elevator house and helps.
// Her moves (every tell is >= 1.0 s: a "!" over her head + a tell card + a ground mark):
//   CRYSTAL SPIKES: glowing rings open on the roof (one under Harold), then sugar-crystal spikes burst out of them   -> get out of the rings (or ROLL)
//   SUGAR-HIGH DASH: pink after-images trace her path across the roof, then she dashes down it                       -> step off the line (or ROLL); she is dizzy after
//   MOLASSES POOL: she scoops and lobs a blob of molasses, an amber ring marks where it lands; the pool stays and slows you (no rolling in it)
// After an attack she is OPEN (sagging, her crystal heart glowing): hits land as gold crits. On her guard, hits only chip.
// Harold: 3-hit cane combo (swing, backhand, then this fight's finisher, the ROCK-CANDY CRACKER: a spin-sweep with a pink candy trail), ROLL (i-frames),
// POWER meter (hits, chips and close rolls fill it) -> ACT fires a special, alternating: NEON OVERLOAD (Harold cane-cracks the sign's conduit and a neon
// beam fries her) and MAVIS BACK-BOOST (team-up: Mavis crouches, Harold vaults off her back into a flying cane strike).
// 3 phases (100 HP each, full heal between phases), half-damage hits, 1.3 s i-frames, Mavis tosses a crab cake once a phase when Harold is low,
// one SECOND WIND per attempt. KO: slow-mo final blow, she bursts into a sugar avalanche that rains sugar cubes, then a star grade (S/A/B by hits taken).
// Win = DUELS.bossCleared('domino') -> BOSS_CLEAR.clear('domino') (the refinery landmark's id in 03_city.js). Lose = RETRY (from the phase reached) or LEAVE.
// Controls: phone: stick move, SWING = cane, JUMP = ROLL, ACT = POWER. Desktop: WASD move, J swing, K roll, E power. Gamepad: left stick, X swing, A roll, Y power.
// Entry: ACT (FIGHT) on the pink ring at the refinery's west door ("elevator to the roof"); tests: ?sugarrush=1 starts it, &sugarrushauto=win|lose plays it.
// RIG HOOK CONTRACT: window.buildSugarRush({ THREE, toonMat, outlineMat, addOdir, QUAL }) may return an Object3D or
//   { root, body?, head?, armL?, armR?, heart?, flash?: [materials with userData.flash/flashC], update?(dt, state) }.
//   root: feet at y 0, facing +z, about 3.2 m tall. arm groups pivot at the shoulder (rotation.x raises them forward). heart: a mesh shown while she is OPEN.
//   state = { ms, u (0..1 through the current move), phase, open, dash, hp }. Missing parts get empty groups; the stand-in below is used when no hook exists.
(function () {
  const C = { scene: null, cam: null, title: 'SUGAR RUSH', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> swing · <b>K</b> roll · <b>E</b> power',
    labels: { a: 'SWING', b: 'ROLL', c: 'POWER', l: '', r: '' } };
  const NAME = 'DOMINO SUGARS'; // the real refinery name (DESIGN.md real-signage rule, Brad 2026-10-11)
  const BX = 9.6, BZ0 = -7.2, BZ1 = 8.4; // roof bounds the fighters stay inside
  const SIGN_Z = 11.2, CONDUIT = new THREE.Vector3(-5.2, 0, 9.4);
  const PH = [ // per phase: tell lengths (all >= 1.0 s), counts, gaps, open window
    { spikes: 1.35, rings: 3, dash: 1.3, dashes: 1, pool: 1.25, pools: 1, guard: [1.3, 1.9], open: 1.5, mix: ['spikes', 'dash', 'pool', 'spikes', 'dash'] },
    { spikes: 1.2, rings: 4, dash: 1.15, dashes: 1, pool: 1.15, pools: 2, guard: [1.0, 1.6], open: 1.35, mix: ['dash', 'pool', 'spikes', 'dash', 'spikes', 'pool'] },
    { spikes: 1.05, rings: 5, dash: 1.0, dashes: 2, pool: 1.05, pools: 2, guard: [0.75, 1.25], open: 1.2, mix: ['spikes', 'dash', 'pool', 'dash', 'spikes', 'pool', 'dash'] },
  ];
  const DMG = { spike: 12, dash: 15, splash: 5 }, INV = 1.3, HR = 0.45, BR = 1.15;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'domino'); const l = L && L.boss && L.boss.lines; return l && l.intro ? l : {
    intro: ["I'm sweet, but I hit like a truck!", 'Glitter and grit, toad! Taste it!', 'Neon on, sugar high, you\u2019re done!'],
    defeat: ["I'm... dissolving...", 'Too sweet... to keep fighting...', "Somebody sweep me up. I'm crumbs."] }; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- HUD extras: damage pops, POWER bar, KO tag (inside the duel HUD) ----------------
  const css = document.createElement('style');
  css.textContent = `
  #duel .srpop { position: absolute; left: 0; top: 0; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; pointer-events: none; opacity: 0; will-change: transform; }
  #duel .srpop.crit { color: #ffd23c; font-size: 19px; } #duel .srpop.chip { color: #cfc8ef; font-size: 11px; } #duel .srpop.word { color: #ff7ab8; font-size: 17px; } #duel .srpop.heal { color: #9dff6b; font-size: 13px; }
  #duel .srpow { display: inline-block; width: 92px; height: 9px; background: #14101f; border: 2px solid #14101f; border-radius: 5px; vertical-align: middle; position: relative; overflow: hidden; margin-left: 4px; }
  #duel .srpow i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #ff7ab8, #ffd23c); }
  #duel .srpow.full i { animation: srful .25s infinite alternate; } @keyframes srful { from { filter: brightness(1); } to { filter: brightness(1.7); } }
  #duel .srko { position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; display: none; }
  #duel .srko.on { display: block; } #duel .srko:before, #duel .srko:after { content: ''; position: absolute; left: 0; right: 0; height: 9%; background: #000; }
  #duel .srko:before { top: 0; } #duel .srko:after { bottom: 0; }
  #duel .srko span { position: absolute; right: 12px; bottom: 11%; font-size: 10px; color: #ffd23c; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  @media (max-width: 480px) { #duel .srpow { width: 70px; } }`;
  document.head.appendChild(css);
  const POPS = []; let koTag = null;
  function hudInit() {
    if (POPS.length) return; const root = DUELS.hudEl;
    for (let i = 0; i < 10; i++) { const e = document.createElement('div'); e.className = 'srpop'; root.appendChild(e); POPS.push({ e, t: 9, life: 0.9, p: new THREE.Vector3() }); }
    koTag = document.createElement('div'); koTag.className = 'srko'; koTag.innerHTML = '<span>FINAL BLOW \u00b7 SLOW-MO \u00b7 TAP TO SKIP</span>'; root.appendChild(koTag);
  }
  let popI = 0;
  function pop(p, text, cls = '') { const P = POPS[popI++ % POPS.length]; if (!P) return; P.p.copy(p); P.t = 0; P.life = cls === 'word' ? 1.1 : 0.85; P.e.className = 'srpop ' + cls; P.e.textContent = text; P.dx = rnd(-18, 18); }
  function popsTick(dt) {
    for (const P of POPS) { if (P.t > P.life) continue; P.t += dt; const u = P.t / P.life;
      V.copy(P.p).project(C.cam); if (V.z > 1) { P.e.style.opacity = '0'; continue; }
      const x = (V.x * 0.5 + 0.5) * VW() + P.dx * u, y = (-V.y * 0.5 + 0.5) * VH() - 46 * ease(Math.min(1, u * 1.6));
      P.e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%) scale(${(u < 0.15 ? 0.6 + u * 4 : 1).toFixed(2)})`; P.e.style.opacity = String(u > 0.7 ? (1 - u) / 0.3 : 1); }
  }

  // ---------------- textures (all drawn in code) ----------------
  // the real Domino Sugars sign (DESIGN.md signage rule, Brad 2026-10-11): "Domino" script over "Sugars" in a rounded box, red-orange neon at night,
  // drawn on canvas in the same style as the city's rooftop sign (03_city.js dominoTex night), no logo file.
  function signTex() { return canvasTex(1024, 640, (g, w, h) => {
    g.clearRect(0, 0, w, h); const RED = '#ff3a1c', CORE = '#ffc2a6';
    const glow = (b) => { g.shadowColor = b ? '#ff2a10' : 'rgba(0,0,0,0)'; g.shadowBlur = b; };
    g.lineJoin = 'round'; rrect(g, 34, 34, 956, 572, 64); glow(34); g.strokeStyle = RED; g.lineWidth = 20; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 5; g.stroke();
    const word = (txt, x, y, font, slant, fillW) => { g.save(); g.translate(x, y); g.transform(1, 0, -slant, 1, 0, 0); g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      glow(30); g.fillStyle = RED; g.fillText(txt, 0, 0, fillW); g.lineWidth = 9; g.strokeStyle = RED; g.strokeText(txt, 0, 0, fillW); glow(0); g.lineWidth = 3.5; g.strokeStyle = CORE; g.strokeText(txt, 0, 0, fillW); g.restore(); };
    word('Domino', 512, 330, 'italic 900 318px "Brush Script MT", "Snell Roundhand", "Apple Chancery", Georgia, "Times New Roman", "DejaVu Serif", serif', 0.16, 900);
    g.save(); g.beginPath(); g.moveTo(170, 372); g.bezierCurveTo(360, 410, 650, 404, 880, 346); g.lineCap = 'round';
    glow(26); g.strokeStyle = RED; g.lineWidth = 15; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 4; g.stroke(); g.restore();
    word('Sugars', 520, 555, 'bold 172px Georgia, "Times New Roman", "DejaVu Serif", serif', 0.02, 600);
  }, 512); }
  function roofTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4744'; g.fillRect(0, 0, w, h); SEED = 15;
    for (let i = 0; i < 900; i++) { g.fillStyle = srnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(srnd() * w, srnd() * h, 2, 2); }
    g.strokeStyle = 'rgba(20,18,16,.5)'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(0, k * 64); g.lineTo(w, k * 64); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 40; i++) g.fillRect(srnd() * w, srnd() * h, 6, 3); }, 256); }
  function ringTex() { return canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke();
    g.lineWidth = 3; g.setLineDash([9, 7]); g.beginPath(); g.arc(64, 64, 40, 0, TAU); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.fill(); }, 128); }
  function poolTex() { return canvasTex(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 126); r.addColorStop(0, '#7a3606'); r.addColorStop(0.6, '#a24c0a'); r.addColorStop(0.86, '#d0781a'); r.addColorStop(0.95, '#f0a040'); r.addColorStop(1, 'rgba(240,160,64,0)');
    g.fillStyle = r; g.beginPath(); g.arc(w / 2, h / 2, 127, 0, TAU); g.fill(); SEED = 7; g.fillStyle = 'rgba(255,214,140,.55)';
    for (let i = 0; i < 14; i++) { const a = srnd() * TAU, d = srnd() * 90; g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 3 + srnd() * 7, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(255,230,170,.6)'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2 - 20, h / 2 - 24, 60, 3.6, 4.6); g.stroke(); }, 256); }
  function bangTex() { return canvasTex(64, 128, (g, w, h) => { g.font = '900 104px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#14101f'; g.strokeText('!', w / 2, h / 2 + 4); g.fillStyle = '#ffd23c'; g.fillText('!', w / 2, h / 2 + 4); }, 64); }

  // ---------------- arena: the refinery roof at night; tar roof + parapet, the sign lattice + neon sign, elevator house, harbour + skyline beyond ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const sk = new THREE.SphereGeometry(90, 24, 12).toNonIndexed(); const sp = sk.attributes.position, cc = new Float32Array(sp.count * 3), c0 = new THREE.Color('#0d0b26'), c1 = new THREE.Color('#3a1f58'), c2 = new THREE.Color('#ff7a6a');
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 90, c = y > 0.1 ? c0.clone().lerp(c1, clamp(1 - (y - 0.1) * 3, 0, 1)) : c1.clone().lerp(c2, clamp(1 - y * 10, 0, 1) * 0.6); cc.set([c.r, c.g, c.b], i * 3); }
    sk.setAttribute('color', new THREE.BufferAttribute(cc, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    const rt = roofTex(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(5, 4);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(26, 24), new THREE.MeshLambertMaterial({ map: rt })); roof.rotation.x = -Math.PI / 2; roof.position.z = 1.5; sc.add(roof);
    const wt = new THREE.Mesh(new THREE.PlaneGeometry(220, 140), new THREE.MeshLambertMaterial({ color: '#16284a', emissive: '#0c1830' })); wt.rotation.x = -Math.PI / 2; wt.position.set(0, -23, 80); sc.add(wt);
    const R = K();
    // building body below the roof edge + parapet
    R.add(G.box(26, 23, 24), '#6a5a4c', 0, -11.6, 1.5);
    for (const [x, z, w, d] of [[0, -10.6, 26.4, 0.5], [0, 13.6, 26.4, 0.5], [-13.1, 1.5, 0.5, 24.4], [13.1, 1.5, 0.5, 24.4]]) R.add(G.box(w, 0.9, d), '#7a6a5a', x, 0.45, z).add(G.box(w + 0.1, 0.12, d + 0.1), '#9a8a78', x, 0.95, z);
    // the sign's steel lattice along the back (harbour) edge
    const y0 = 0, sw = 22, sx0 = -sw / 2; const LC = '#2e2a28';
    for (let k = 0; k <= 10; k++) R.add(G.box(0.24, 9.4, 0.24), LC, sx0 + k * (sw / 10), y0 + 4.7, SIGN_Z + 0.3);
    for (const y of [0.8, 4.7, 8.9]) R.add(G.box(sw + 0.3, 0.22, 0.22), LC, 0, y, SIGN_Z + 0.3);
    for (let k = 0; k < 10; k++) for (const [ya, yb] of [[0.8, 4.7], [4.7, 8.9]]) { const xa = sx0 + k * (sw / 10), L = Math.hypot(sw / 10, yb - ya); R.add(G.box(L, 0.08, 0.08), LC, xa + sw / 20, (ya + yb) / 2, SIGN_Z + 0.32, 0, 0, (k % 2 ? 1 : -1) * Math.atan2(yb - ya, sw / 10)); }
    for (const x of [-10, -3.5, 3.5, 10]) R.add(G.box(0.18, 0.18, 4.4), LC, x, 2.2, SIGN_Z + 1.9, -0.85, 0, 0);
    // the conduit box at the sign's foot (NEON OVERLOAD target) + its cable up the lattice
    R.add(G.box(1.3, 1.5, 0.7), '#5a6068', CONDUIT.x, 0.75, CONDUIT.z).add(G.box(1.32, 0.18, 0.72), '#ffd23c', CONDUIT.x, 1.25, CONDUIT.z).add(G.cyl(0.07, 0.07, 7.8, 6), '#ff9a3a', CONDUIT.x + 0.4, 5.2, SIGN_Z + 0.1);
    // elevator head house (Mavis stands at its door) + roof vents + pipes
    R.add(G.box(4.2, 3.6, 3.4), '#857464', -9.6, 1.8, -7.6).add(G.box(4.5, 0.3, 3.7), '#5a4a3e', -9.6, 3.75, -7.6).add(G.box(1.5, 2.3, 0.08), '#3a3a40', -8.4, 1.15, -5.88).add(G.box(0.12, 0.12, 0.05), '#ffcf6a', -7.5, 1.4, -5.84);
    for (const [x, z] of [[10.6, -7.8], [11.2, 5.6], [-11.4, 4.2]]) R.add(G.cyl(0.55, 0.6, 1.4, 10), '#9aa0a8', x, 0.7, z).add(G.cone(0.75, 0.5, 10), '#7a8088', x, 1.65, z);
    R.add(G.cyl(0.18, 0.18, 22, 8), '#6a6e74', -12.4, 0.5, 1.5, Math.PI / 2, 0, 0).add(G.cyl(0.12, 0.12, 22, 8), '#8a6a4a', -12.4, 0.85, 1.5, Math.PI / 2, 0, 0);
    // sugar sacks + a spilled sugar heap by the vents (set dressing)
    for (const [x, z, r] of [[9.8, 3.2, 0.2], [10.6, 2.4, -0.4], [10.2, 2.8, 0.9]]) R.add(G.box(0.9, 0.45, 0.6), '#efe6d2', x, 0.25 + (r > 0.5 ? 0.45 : 0), z, 0, r, 0);
    R.add(new THREE.SphereGeometry(1.2, 10, 6, 0, TAU, 0, Math.PI / 2), '#fbf8f0', 9.6, 0, 4.6, 0, 0, 0, 1, 0.35, 1);
    sc.add(R.mesh(toonMat(), null, 0.003));
    // skyline across the harbour: dark blocks + lit windows (Points)
    const S = K(); SEED = 41; const win = [];
    for (let i = 0; i < 34; i++) { const x = -90 + i * 5.4 + srnd() * 2, z = 70 + srnd() * 30, w = 3 + srnd() * 4, hgt = 6 + srnd() * (Math.abs(x) < 30 ? 34 : 18); S.add(G.box(w, hgt, 4), srnd() < 0.5 ? '#1a1830' : '#221e3a', x, -23 + hgt / 2, z);
      for (let k = 0; k < 7; k++) if (srnd() < 0.7) win.push(x + (srnd() - 0.5) * w * 0.8, -23 + srnd() * hgt, z - 2.05); }
    const sm = S.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), null, 0); sc.add(sm);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(win), 3));
    sc.add(new THREE.Points(wg, new THREE.PointsMaterial({ color: '#ffd890', size: 0.9, sizeAttenuation: true, fog: false })));
    // the neon sign itself + a soft red halo behind it
    C.sign = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 8.5), new THREE.MeshBasicMaterial({ map: signTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    C.sign.position.set(0, 5.6, SIGN_Z); C.sign.rotation.y = Math.PI; sc.add(C.sign); // faces the arena (-z)
    C.halo = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ff3040'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    C.halo.position.set(0, 5.6, SIGN_Z + 0.6); C.halo.rotation.y = Math.PI; sc.add(C.halo);
  }

  // ---------------- the Sugar Rush stand-in: a sugar-crystal golem (~3.2 m) ----------------
  function crystal(r, h) { const g = new THREE.OctahedronGeometry(1, 0); g.scale(r, h, r); return g; }
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group() };
    const bM = toonMat(), aM = toonMat(); R.flash = [bM, aM];
    R.body = new THREE.Group(); R.body.position.y = 1.25; R.root.add(R.body);
    // legs: stacked sugar cubes, crystal feet
    const L = K(); for (const s of [-1, 1]) { L.add(G.box(0.55, 0.5, 0.55), '#f7f3ea', s * 0.42, -0.95, 0, 0, s * 0.2, 0).add(G.box(0.5, 0.48, 0.5), '#efe9dc', s * 0.4, -0.5, 0.02, 0, -s * 0.15, 0)
      .add(crystal(0.42, 0.22), '#ffd6ea', s * 0.42, -1.2, 0.12); }
    L.add(G.box(1.2, 0.4, 0.7), '#f2ece0', 0, -0.2, 0); L.mesh(bM, R.body);
    // torso: a big faceted crystal with pink + ice-blue shards, the crystal heart in the chest
    const B = K(); B.add(new THREE.IcosahedronGeometry(1, 0), '#fff0f6', 0, 0.75, 0, 0, 0.3, 0, 1.0, 1.15, 0.78)
      .add(crystal(0.22, 0.6), '#ff7ab8', 0.85, 1.45, -0.1, 0, 0, -0.5).add(crystal(0.2, 0.55), '#9fe8ff', -0.85, 1.45, -0.1, 0, 0, 0.5)
      .add(crystal(0.16, 0.42), '#ff9ecb', 0.55, 1.75, -0.3, 0.3, 0, -0.25).add(crystal(0.15, 0.4), '#c8f2ff', -0.5, 1.8, -0.25, 0.3, 0, 0.25)
      .add(crystal(0.14, 0.38), '#ff7ab8', 0.2, 0.4, 0.62, 1.2, 0, 0.3).add(G.box(1.05, 0.22, 0.75), '#ff7ab8', 0, -0.05, 0) // a candy-pink belt
      .add(G.box(0.25, 0.25, 0.1), '#ffd23c', 0, -0.05, 0.4, 0, 0, 0.785);
    B.mesh(bM, R.body);
    R.heart = new THREE.Mesh(crystal(0.24, 0.34), new THREE.MeshBasicMaterial({ color: '#ff4fa8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    R.heart.position.set(0, 0.85, 0.78); R.body.add(R.heart);
    // head: a smaller crystal, candy-pink glowing eyes, a crystal tiara and a rock-candy ponytail
    R.head = new THREE.Group(); R.head.position.y = 1.95; R.body.add(R.head);
    const H = K(); H.add(new THREE.IcosahedronGeometry(0.48, 1), '#fff6fa', 0, 0.3, 0, 0, 0, 0, 1, 1.05, 0.95)
      .add(G.sph(0.09, 8, 6), '#ff2f8f', -0.17, 0.36, 0.4).add(G.sph(0.09, 8, 6), '#ff2f8f', 0.17, 0.36, 0.4).add(G.sph(0.03, 5, 4), '#ffffff', -0.15, 0.39, 0.48).add(G.sph(0.03, 5, 4), '#ffffff', 0.19, 0.39, 0.48)
      .add(G.box(0.24, 0.04, 0.04), '#c0306a', 0, 0.12, 0.44, 0, 0, 0.12)
      .add(G.sph(0.06, 6, 5), '#ff9ecb', -0.3, 0.2, 0.33, 0, 0, 0, 1, 0.6, 0.5).add(G.sph(0.06, 6, 5), '#ff9ecb', 0.3, 0.2, 0.33, 0, 0, 0, 1, 0.6, 0.5);
    for (let k = -2; k <= 2; k++) H.add(crystal(0.07, 0.2 - Math.abs(k) * 0.03), k % 2 ? '#9fe8ff' : '#ff7ab8', k * 0.13, 0.78 - Math.abs(k) * 0.04, 0.05, 0, 0, -k * 0.2);
    for (let k = 0; k < 5; k++) H.add(crystal(0.13 - k * 0.012, 0.17), ['#ff7ab8', '#ffd6ea', '#ff9ecb', '#9fe8ff', '#ff7ab8'][k], 0, 0.62 - k * 0.24, -0.5 - k * 0.12, -0.5, 0, 0);
    H.mesh(bM, R.head, 0.0036);
    // arms: shoulder pivot > sugar-cube upper + fore > big crystal fist
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 1.12, 1.25, 0); R.body.add(sh);
      const A = K(); A.add(G.sph(0.34, 10, 8), '#ffd6ea', 0, 0, 0).add(G.box(0.42, 0.62, 0.42), '#f7f3ea', s * 0.08, -0.45, 0, 0, 0, s * 0.1).add(G.box(0.38, 0.58, 0.38), '#efe9dc', s * 0.12, -1.0, 0.05, 0.1, 0.3, 0)
        .add(new THREE.IcosahedronGeometry(0.42, 0), '#ffe0ef', s * 0.14, -1.48, 0.1).add(crystal(0.1, 0.26), '#ff7ab8', s * 0.3, -1.6, 0.3, 0.9, 0, s * 0.4).add(crystal(0.1, 0.24), '#9fe8ff', s * 0.02, -1.62, 0.36, 1.0, 0, -s * 0.2);
      A.mesh(aM, sh); R.arms.push({ sh, s }); }
    R.armL = R.arms[0].sh; R.armR = R.arms[1].sh;
    return R;
  }

  // ---------------- build ----------------
  C.build = function () {
    hudInit();
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#2a1840', 30, 120);
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 260);
    DUELS.sceneLights(sc, '#c8b8ff', '#3a2a40', 1.25, '#ffd8e8', 1.3, new THREE.Vector3(0.4, 1, -0.6));
    C.neonL = new THREE.PointLight('#ff3a4a', 40, 26, 1.3); C.neonL.position.set(0, 5.5, SIGN_Z - 2); sc.add(C.neonL);
    buildArena(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildSugarRush === 'function') rig = window.buildSugarRush({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    if (rig && rig.isObject3D) rig = { root: rig };
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'head', 'armL', 'armR']) if (!rig[k]) { rig[k] = new THREE.Group(); (k === 'body' ? rig.root : rig.body).add(rig[k]); }
    if (!rig.arms) rig.arms = [{ sh: rig.armL, s: -1 }, { sh: rig.armR, s: 1 }]; rig.flash = rig.flash || [];
    if (!rig.heart) { rig.heart = new THREE.Mesh(crystal(0.24, 0.34), new THREE.MeshBasicMaterial({ color: '#ff4fa8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); rig.heart.position.set(0, 0.85, 0.8); rig.body.add(rig.heart); }
    C.R = rig; C.base = { bodyY: rig.body.position.y }; sc.add(rig.root);
    // fx: spike rings (decals), crystal spikes (instanced), dash after-images (instanced ghosts) + path stripe, molasses pools + blob, sugar cubes, sparkles, "!" sprite, neon beam
    const rT = ringTex();
    C.rings = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rT, color: '#ff7ab8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; sc.add(m); C.rings.push(m); }
    const spG = new THREE.ConeGeometry(0.22, 1.6, 5); spG.translate(0, 0.8, 0);
    C.spikeM = new THREE.InstancedMesh(spG, new THREE.MeshLambertMaterial({ color: '#ffe6f2', emissive: '#7a3a5a' }), 48); C.spikeM.count = 0; C.spikeM.frustumCulled = false; sc.add(C.spikeM);
    const gh = DUELS.kit(); gh.add(new THREE.IcosahedronGeometry(1, 0), '#ffffff', 0, 2.0, 0, 0, 0, 0, 1, 1.15, 0.78).add(new THREE.IcosahedronGeometry(0.48, 0), '#ffffff', 0, 3.4, 0).add(DUELS.GEO.box(1.1, 1.3, 0.6), '#ffffff', 0, 0.7, 0);
    C.ghostM = new THREE.InstancedMesh(gh.geo(), new THREE.MeshBasicMaterial({ color: '#ff5fb0', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 8); C.ghostM.count = 0; C.ghostM.frustumCulled = false; sc.add(C.ghostM);
    C.path = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ff3d8e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.path.rotation.order = 'YXZ'; C.path.visible = false; sc.add(C.path);
    const poolT = poolTex(); C.pools = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshLambertMaterial({ map: poolT, color: '#ffffff', emissive: '#3a1a02', transparent: true, opacity: 0.92, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; sc.add(m); C.pools.push({ m, t: 0, life: 0, r: 2.2, on: false }); }
    C.blob = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshLambertMaterial({ color: '#d9781a', emissive: '#6a3006' })); C.blob.visible = false; sc.add(C.blob);
    const cub = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    C.cubeM = new THREE.InstancedMesh(cub, new THREE.MeshLambertMaterial({ color: '#fbf8f0', emissive: '#4a4440' }), 120); C.cubeM.count = 0; C.cubeM.frustumCulled = false; sc.add(C.cubeM); C.cubes = [];
    C.spark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffd6f0', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 64); C.spark.count = 0; C.spark.frustumCulled = false; sc.add(C.spark); C.sparks = [];
    C.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex(), depthTest: false, transparent: true, fog: false })); C.bang.scale.set(0.7, 1.4, 1); C.bang.visible = false; C.bang.renderOrder = 5; sc.add(C.bang);
    C.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ff4a6a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); C.beam.visible = false; sc.add(C.beam);
    C.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false })); C.shadow.rotation.x = -Math.PI / 2; C.shadow.position.y = 0.02; sc.add(C.shadow);
  };

  // ---------------- state ----------------
  function reset(phase, keepStats) {
    const old = C.st;
    const st = C.st = { t: 0, phase, hp: 100, bhp: 100, hx: 0, hz: -4.2, hyaw: 0, vx: 0, vz: 0, bx: 0, bz: 3.6, byaw: Math.PI, ms: 'intro', mt: 0, mdur: phase === 0 && !keepStats ? 2.6 : 1.4,
      mixI: Math.floor(Math.random() * 3), atk: [], dash: null, poolsLeft: 0, inv: 0, hurtT: 0, roll: -1, rollCd: 0, rdx: 0, rdz: 0, combo: 0, swing: -1, swingHit: false, comboT: 0, chain: 0,
      power: old && keepStats ? old.power : 0, specI: old && keepStats ? old.specI : 0, spec: null, hs: 0, shake: 0, slow: 1, over: false, won: false, outT: 0, cake: false, wind: false, flash: 0,
      stats: (keepStats && old && old.stats) || { swings: 0, landed: 0, crits: 0, chips: 0, rolls: 0, close: 0, specials: 0, hits: { spike: 0, dash: 0, splash: 0 }, attacks: { spikes: 0, dash: 0, pool: 0 }, phases: 0, maxChain: 0, taken: 0 } };
    for (const p of C.pools) { p.on = false; p.m.visible = false; } C.blob.visible = false; C.cubes.length = 0; C.sparks.length = 0; C.spikeM.count = 0; C.ghostM.count = 0; C.path.visible = false; C.beam.visible = false;
    for (const r of C.rings) { r.visible = false; } C.bang.visible = false;
    const R = C.R; R.root.visible = true; R.root.scale.setScalar(1); R.body.position.y = C.base.bodyY; R.body.rotation.set(0, 0, 0);
    if (koTag) koTag.classList.remove('on');
    DUELS.bars(1, 1); return st;
  }
  function subHud(st) { const k = Math.round(st.power / 5) * 5;
    DUELS.sub('POWER<span class="srpow' + (st.power >= 100 ? ' full' : '') + '"><i style="width:' + k + '%"></i></span>' + (st.chain > 1 ? ' <span style="color:#ffd23c">x' + st.chain + '</span>' : ''), 'PHASE ' + (st.phase + 1) + '/3'); }
  C.start = function () {
    C.st = null; const st = reset(0); DUELS.log.push('sugarrush:' + C.rigKind); subHud(st);
    DUELS.banner('SUGAR RUSH<small>' + NAME + ' \u00b7 ROOF</small>', 2.4);
    DUELS.say('SUGAR RUSH', pick(lines().intro), 3.4);
    C.camP = new THREE.Vector3(6, 7, -10); C.camL = new THREE.Vector3(0, 3, 4); C.shk = new THREE.Vector3();
  };
  C.retry = function () { const ph = C.st.phase; reset(ph, true); C.st.power = 0; C.st.ms = 'guard'; C.st.mdur = 1.4; subHud(C.st); DUELS.banner('PHASE ' + (ph + 1) + '<small>AGAIN! FULL HEALTH</small>', 1.6); };
  C.exit = function () { if (koTag) koTag.classList.remove('on'); for (const P of POPS) { P.t = 9; P.e.style.opacity = '0'; } };

  // ---------------- small fx + sound helpers ----------------
  function tone(f0, f1, dur, type = 'triangle', vol = 0.14) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  const sting = () => { tone(880, 1320, 0.18, 'square', 0.08); setTimeout(() => tone(1320, 1760, 0.16, 'square', 0.06), 90); }; // tell sting
  function spark(p, n = 6, col) { for (let k = 0; k < n && C.sparks.length < 64; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3.5, 3.5), rnd(1, 5), rnd(-3.5, 3.5)), t: 0, life: rnd(0.3, 0.7) }); }
  function cubes(p, n, spd = 5, life = 1.6) { for (let k = 0; k < n && C.cubes.length < 120; k++) C.cubes.push({ p: p.clone().add(V3.set(rnd(-0.6, 0.6), rnd(-0.4, 0.8), rnd(-0.6, 0.6))), v: new THREE.Vector3(rnd(-spd, spd), rnd(spd * 0.4, spd * 1.3), rnd(-spd, spd)), r: new THREE.Vector3(rnd(0, 6), rnd(0, 6), rnd(0, 6)), t: 0, life: life + rnd(0, 0.6) }); }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; }
  const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  function addPower(st, n) { const was = st.power; st.power = Math.min(100, st.power + n); if (was < 100 && st.power >= 100) { DUELS.tell('POWER READY! ACT!', 1.2); tone(660, 1320, 0.3, 'square', 0.08); } subHud(st); }
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m.userData && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function inPool(st) { for (const p of C.pools) if (p.on && p.t > 0 && dist2(st.hx, st.hz, p.m.position.x, p.m.position.z) < p.r) return p; return null; }

  // ---------------- Harold gets hit ----------------
  function hurtHarold(st, dmg, kind) {
    if (st.over || st.spec) return false;
    if (st.roll >= 0) { // a roll through the hit: a close dodge (POWER)
      if (!st.hitThis) { st.stats.close++; addPower(st, 14); pop(V.set(st.hx, 2.2, st.hz), 'CLOSE!', 'word'); } return false; }
    if (st.inv > 0) return false;
    st.hp -= dmg; st.inv = INV; st.hurtT = 0.45; st.stats.hits[kind]++; st.stats.taken++; st.chain = 0; st.combo = 0; st.swing = -1; DUELS.hurt(); sfx('hurt'); st.flash = 1; st.shake = Math.max(st.shake, 0.35); st.hs = 0.06;
    pop(V.set(st.hx, 2.1, st.hz), '-' + dmg, ''); subHud(st);
    if (st.hp <= 0) {
      if (!st.wind) { st.wind = true; st.hp = 40; st.inv = 2.2; DUELS.banner('SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 1.8); DUELS.log.push('sugarrush:secondwind'); return true; }
      st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('sugarrush:lose:' + kind);
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'SUGAR CRASH!', 'Sugar Rush buried Harold in crystal. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400);
    } else if (st.hp < 35 && !st.cake) { st.cake = true; st.cakeT = 0.9; } // Mavis tosses a crab cake (once a phase)
    return true;
  }

  // ---------------- her brain ----------------
  function chooseRings(st, n) { const out = [{ x: st.hx, z: st.hz }]; let guard = 0;
    while (out.length < n && guard++ < 60) { const a = rnd(0, TAU), d = out.length < 3 ? rnd(2.4, 4.2) : rnd(3, 8); const x = clamp(st.hx + Math.cos(a) * d, -BX, BX), z = clamp(st.hz + Math.sin(a) * d, BZ0, BZ1);
      if (out.every((o) => dist2(o.x, o.z, x, z) > 2.3)) out.push({ x, z }); }
    return out.map((o) => ({ x: o.x, z: o.z, r: 1.45 })); }
  function bossThink(st, dt) {
    const P = PH[st.phase]; st.mt += dt; const u = st.mt / st.mdur;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.9); break;
      case 'guard': { // stalk to ~3.4 m
        const d = dist2(st.bx, st.bz, st.hx, st.hz), sp = 1.6 + st.phase * 0.35; if (d > 3.4) { st.bx += (st.hx - st.bx) / d * sp * dt; st.bz += (st.hz - st.bz) / d * sp * dt; }
        if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++; sting(); C.bangT = 1;
          if (a === 'spikes') { st.atk = chooseRings(st, P.rings); setM(st, 'spikesTell', P.spikes); DUELS.tell('SPIKES! LEAVE THE RINGS!', P.spikes); }
          else if (a === 'dash') { st.dashesLeft = P.dashes; startDash(st, P.dash); }
          else { st.poolsLeft = P.pools; startPool(st, P.pool); } }
        break; }
      case 'spikesTell': if (st.mt > st.mdur) { setM(st, 'spikes', 0.75); sfx('heavy'); st.shake = Math.max(st.shake, 0.3);
          for (const r of st.atk) { V.set(r.x, 0.2, r.z); spark(V, 3); } } break;
      case 'spikes': if (!st.hitThis && st.mt > 0.05) { st.hitThis = true; const hit = st.atk.some((r) => dist2(st.hx, st.hz, r.x, r.z) < r.r + HR * 0.5); if (hit) hurtHarold(st, DMG.spike, 'spike'); st.hitThis = true; }
        if (st.mt > st.mdur) { st.atk = []; setM(st, 'open', P.open); } break;
      case 'dashTell': if (st.mt > st.mdur) { setM(st, 'dash', st.dash.len / 17); sfx('swing'); } break;
      case 'dash': { const D = st.dash, k = clamp(st.mt / st.mdur, 0, 1); st.bx = lerp(D.x0, D.x1, k); st.bz = lerp(D.z0, D.z1, k);
        if (Math.random() < dt * 30) { V.set(st.bx, rnd(0.5, 2.5), st.bz); spark(V, 1); }
        if (!st.hitThis && dist2(st.bx, st.bz, st.hx, st.hz) < BR + HR + 0.15) { if (hurtHarold(st, DMG.dash, 'dash') || st.roll >= 0) st.hitThis = true; }
        if (st.mt > st.mdur) { st.dashesLeft--; if (st.dashesLeft > 0) { startDash(st, Math.max(1.0, P.dash * 0.85)); sting(); C.bangT = 1; } else setM(st, 'dizzy', P.open + 0.3); }
        break; }
      case 'poolTell': if (u > 0.55 && !C.blob.visible) { C.blob.visible = true; st.blob0 = new THREE.Vector3(st.bx, 3.2, st.bz); sfx('swing'); }
        if (C.blob.visible) { const k = clamp((u - 0.55) / 0.45, 0, 1), T = st.atk[0]; C.blob.position.set(lerp(st.blob0.x, T.x, k), lerp(3.2, 0.3, k) + Math.sin(k * Math.PI) * 3.4, lerp(st.blob0.z, T.z, k)); }
        if (st.mt > st.mdur) { C.blob.visible = false; const T = st.atk[0]; const p = C.pools.find((q) => !q.on) || C.pools.reduce((a, b) => (a.t > b.t ? a : b));
          p.on = true; p.t = 0; p.life = 7.5; p.r = 2.1; p.m.position.set(T.x, 0.03, T.z); p.m.scale.setScalar(0.1); p.m.visible = true; sfx('heavy'); V.set(T.x, 0.3, T.z); cubes(V, 6, 3, 0.8);
          if (dist2(st.hx, st.hz, T.x, T.z) < p.r) hurtHarold(st, DMG.splash, 'splash');
          st.atk = []; st.poolsLeft--; if (st.poolsLeft > 0) startPool(st, Math.max(1.0, P.pool * 0.9)); else setM(st, 'open', P.open * 0.8); }
        break;
      case 'open': case 'dizzy': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'stun': if (st.mt > st.mdur) setM(st, 'open', 0.8); break; // held by a special
      case 'down': if (st.mt > st.mdur) { st.phase++; st.stats.phases++; st.bhp = 100; st.hp = 100; st.cake = false; for (const p of C.pools) { p.on = false; p.m.visible = false; }
          setM(st, 'guard', 1.2); subHud(st); DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 2 ? 'FINAL PHASE! SUGAR HIGH!' : 'SHE\u2019S CRYSTALLISING!') + '</small>', 1.8); } break;
      case 'ko': break;
    }
  }
  function startDash(st, tell) { // path: from her through Harold's spot, on past him (clamped to the roof)
    const dx = st.hx - st.bx, dz = st.hz - st.bz, d = Math.max(0.5, Math.hypot(dx, dz)), ext = d + 3.2;
    let x1 = st.bx + dx / d * ext, z1 = st.bz + dz / d * ext; x1 = clamp(x1, -BX, BX); z1 = clamp(z1, BZ0, BZ1);
    st.dash = { x0: st.bx, z0: st.bz, x1, z1, len: Math.max(1, dist2(st.bx, st.bz, x1, z1)) }; setM(st, 'dashTell', tell); DUELS.tell('DASH! STEP OFF THE LINE!', tell);
  }
  function startPool(st, tell) { st.atk = [{ x: clamp(st.hx + st.vx * 0.3, -BX, BX), z: clamp(st.hz + st.vz * 0.3, BZ0, BZ1), r: 2.1 }]; setM(st, 'poolTell', tell); DUELS.tell('MOLASSES! MOVE!', tell); }

  // ---------------- Harold ----------------
  C.step = function (rdt, I) {
    const st = C.st; if (!st) return;
    if (st.hs > 0) { st.hs -= rdt; fxStep(rdt * 0.15); return; } // hitstop
    const dt = rdt * st.slow; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.rollCd -= dt; st.comboT -= dt; st.shake = Math.max(0, st.shake - dt * 1.6);
    if (st.ms === 'ko') { outro(st, rdt, I); fxStep(dt); popsTick(rdt); return; }
    if (st.spec) special(st, dt); else if (!st.over) {
      // camera-relative movement (the camera looks from Harold toward her)
      const fx = st.bx - st.hx, fz = st.bz - st.hz, fd = Math.max(0.01, Math.hypot(fx, fz)), Fx = fx / fd, Fz = fz / fd, Rx = -Fz, Rz = Fx;
      const pool = inPool(st), slowK = pool ? 0.42 : 1;
      let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      let wx = (Fx * my + Rx * mx), wz = (Fz * my + Rz * mx);
      if (st.roll >= 0) { st.roll += dt; wx = st.rdx; wz = st.rdz; const k = st.roll < 0.32 ? 8.8 : 3; st.hx += wx * k * dt; st.hz += wz * k * dt; if (st.roll > 0.42) st.roll = -1; }
      else if (st.hurtT <= 0) {
        const busy = st.swing >= 0; const sp = (busy ? 1.2 : 5.0) * slowK; st.vx = damp(st.vx, wx * sp, 14, dt); st.vz = damp(st.vz, wz * sp, 14, dt); st.hx += st.vx * dt; st.hz += st.vz * dt;
        if (ml > 0.2 && !busy) st.hyaw = Math.atan2(wx, wz);
        // ROLL (JUMP): i-frames; not in molasses
        if (I.b && st.rollCd <= 0) { if (pool) { DUELS.tell('STUCK! WALK OUT', 0.7); st.rollCd = 0.4; }
          else { const l = Math.hypot(wx, wz); st.rdx = l > 0.2 ? wx / l : -Fx; st.rdz = l > 0.2 ? wz / l : -Fz; st.roll = 0; st.rollCd = 0.6; st.swing = -1; st.stats.rolls++; sfx('jump'); st.hyaw = Math.atan2(st.rdx, st.rdz); } }
        // SWING: 3-hit combo, finisher = ROCK-CANDY CRACKER
        if (I.a && st.roll < 0) { if (st.swing < 0 || st.swing > (st.combo === 2 ? 0.42 : 0.24)) { st.combo = st.swing >= 0 || st.comboT > 0 ? (st.combo + 1) % 3 : 0; st.swing = 0; st.swingHit = false; st.stats.swings++; st.hyaw = Math.atan2(Fx, Fz); sfx('swing'); } }
        if (I.c) { if (st.power >= 100) startSpecial(st); else DUELS.tell('HIT HER TO FILL POWER', 0.8); }
      }
      if (st.swing >= 0) { st.swing += dt; const dur = st.combo === 2 ? 0.55 : 0.34, at = st.combo === 2 ? 0.26 : 0.13;
        if (st.swing < at) { st.hx += Fx * 1.6 * dt; st.hz += Fz * 1.6 * dt; }
        if (!st.swingHit && st.swing > at) { st.swingHit = true; landHit(st); }
        if (st.combo === 2 && st.swing < 0.45) { cane(V); spark(V, 1); }
        if (st.swing > dur) { st.swing = -1; st.comboT = 0.4; if (st.combo === 2) st.combo = -1; } }
      // keep apart from her + inside the roof
      const d = dist2(st.hx, st.hz, st.bx, st.bz); if (d < BR + HR && st.ms !== 'dash') { const k = (BR + HR - d) / Math.max(0.01, d); st.hx += (st.hx - st.bx) * k; st.hz += (st.hz - st.bz) * k; }
      st.hx = clamp(st.hx, -BX, BX); st.hz = clamp(st.hz, BZ0, BZ1); st.bx = clamp(st.bx, -BX, BX); st.bz = clamp(st.bz, BZ0, BZ1);
      if (st.cake && st.cakeT > 0 && (st.cakeT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 30); pop(V.set(st.hx, 2.3, st.hz), '+30 CRAB CAKE', 'heal'); DUELS.say('MAVIS', pick(['Eat this, hon!', 'Crab cake, dear! Chew!', 'Sugar\u2019s bad for you anyway!']), 2); tone(523, 784, 0.25); }
    }
    if (!st.spec) { st.slow = 1; C.beam.visible = false; bossThink(st, dt); }
    for (const p of C.pools) if (p.on) { p.t += dt; if (p.t > p.life) { p.on = false; p.m.visible = false; } }
    fxStep(dt); popsTick(rdt);
    DUELS.bars(st.hp / 100, (st.bhp / 100 + (2 - st.phase)) / 3);
  };
  function cane(out) { const sw = C.H.swR || C.H.haR; if (!sw) return out.set(C.st.hx, 1, C.st.hz); sw.updateWorldMatrix(true, false); return out.set(0, 0.62, 0).applyMatrix4(sw.matrixWorld); }
  function landHit(st) {
    const d = dist2(st.hx, st.hz, st.bx, st.bz), reach = BR + (st.combo === 2 ? 2.0 : 1.55);
    if (d > reach || ['down', 'ko', 'intro'].includes(st.ms)) return;
    const open = st.ms === 'open' || st.ms === 'dizzy' || st.ms === 'stun', base = st.combo === 2 ? 14 : 7;
    const dmg = Math.max(1, Math.round(base * (open ? 1.0 : 0.22))); V.set(st.bx, 2.2 + rnd(-0.3, 0.6), st.bz);
    if (st.t - (st.lastHitT || -9) > 1.6) st.chain = 0; st.lastHitT = st.t; st.chain++; st.stats.maxChain = Math.max(st.stats.maxChain, st.chain);
    if (open) { st.stats.landed++; st.stats.crits++; pop(V, String(dmg), 'crit'); addPower(st, st.combo === 2 ? 9 : 6); } else { st.stats.chips++; pop(V, 'CHIP ' + dmg, 'chip'); addPower(st, 3); }
    if (st.combo === 2) { pop(V2.set(st.bx, 3.4, st.bz), pick(['CRACK!', 'SWEET!', 'CRUNCH!', 'ROCK-CANDY CRACKER!']), 'word'); st.hs = 0.085; st.shake = Math.max(st.shake, 0.4); sfx('heavy'); cubes(V, 5, 4, 1); }
    else { st.hs = 0.065; st.shake = Math.max(st.shake, 0.18); sfx('hit'); }
    spark(V, open ? 8 : 3); flashBoss(open ? '#ffffff' : '#c8c8ff', open ? 0.9 : 0.4); C.bflinch = 1;
    damageBoss(st, dmg);
  }
  function damageBoss(st, dmg) {
    st.bhp -= dmg; subHud(st);
    if (st.bhp <= 0) { st.bhp = 0; for (const p of C.pools) { p.on = false; p.m.visible = false; } st.atk = []; st.dash = null; C.blob.visible = false;
      if (st.phase >= 2) { st.spec = null; setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.hp = Math.max(st.hp, 1); DUELS.banner('K.O.!<small>SUGAR CRASH</small>', 2.2); DUELS.log.push('sugarrush:ko'); }
      else { st.spec = null; setM(st, 'down', 2.4); DUELS.banner('CRACKED!<small>PHASE ' + (st.phase + 1) + ' TO HAROLD</small>', 2); if (Math.random() < 0.7) DUELS.say('MAVIS', pick(['That\u2019s my Harold!', 'Crack her again, dear!', 'Mind the spikes, hon!']), 2.2); } }
  }

  // ---------------- POWER specials: NEON OVERLOAD and MAVIS BACK-BOOST (team-up) ----------------
  function startSpecial(st) {
    if (['down', 'intro', 'ko'].includes(st.ms)) { DUELS.tell('WAIT FOR IT...', 0.6); return; }
    C.blob.visible = false; st.atk = []; st.poolsLeft = 0; st.dashesLeft = 0;
    const kind = st.specI % 2 === 0 ? 'neon' : 'boost'; st.specI++; st.power = 0; st.stats.specials++; subHud(st); st.swing = -1; st.roll = -1;
    st.spec = { kind, t: 0, hx0: st.hx, hz0: st.hz, done: false }; setM(st, 'stun', kind === 'neon' ? 2.6 : 2.4); C.bang.visible = false;
    DUELS.banner(kind === 'neon' ? 'NEON OVERLOAD!' : 'MAVIS BACK-BOOST!<small>TEAM-UP</small>', 1.6); tone(220, 880, 0.5, 'sawtooth', 0.08); DUELS.log.push('sugarrush:special:' + kind);
  }
  function special(st, dt) {
    const S = st.spec; S.t += dt; const t = S.t; st.inv = 0.5;
    st.slow = t > 0.85 && t < 1.6 ? 0.4 : 1;
    if (S.kind === 'neon') {
      if (t < 0.6) { const k = ease(t / 0.6); st.hx = lerp(S.hx0, CONDUIT.x + 0.9, k); st.hz = lerp(S.hz0, CONDUIT.z - 1.3, k); st.hyaw = Math.atan2(CONDUIT.x - st.hx, CONDUIT.z - st.hz); }
      if (t > 0.7 && !S.crack) { S.crack = true; V.set(CONDUIT.x, 1.3, CONDUIT.z); spark(V, 16); sfx('heavy'); st.shake = 0.3; }
      C.beam.visible = t > 0.85 && t < 2.1;
      if (C.beam.visible) { V.set(rnd(-6, 6), 6.3, SIGN_Z - 0.2); V2.set(st.bx, 2.2, st.bz); const L = V.distanceTo(V2); C.beam.position.copy(V).lerp(V2, 0.5); C.beam.scale.set(1 + Math.sin(t * 60) * 0.3, L, 1 + Math.sin(t * 60) * 0.3); C.beam.lookAt(V2); C.beam.rotateX(Math.PI / 2);
        flashBoss('#ff4a6a', 0.7); if (Math.random() < dt * 40) spark(V2.clone().add(V3.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))), 2); }
      if (t > 1.25 && !S.done) { S.done = true; st.hs = 0.12; st.shake = 0.6; pop(V.set(st.bx, 3.4, st.bz), 'FRIED! 40', 'crit'); cubes(V.set(st.bx, 2, st.bz), 10, 5, 1.2); damageBoss(st, 40); }
      if (t > 2.3) { C.beam.visible = false; st.spec = null; st.slow = 1; if (st.ms === 'stun') setM(st, 'open', 1.0); }
    } else {
      const fx = st.bx - S.hx0, fz = st.bz - S.hz0, fd = Math.max(0.01, Math.hypot(fx, fz)), mx = st.bx - fx / fd * 2.6, mz = st.bz - fz / fd * 2.6; S.mx = mx; S.mz = mz;
      if (t < 0.55) { st.hx = S.hx0; st.hz = S.hz0; } // Mavis runs in (posed in render)
      else if (t < 0.85) { const k = (t - 0.55) / 0.3; st.hx = lerp(S.hx0, mx - fx / fd * 0.4, k); st.hz = lerp(S.hz0, mz - fz / fd * 0.4, k); }
      else if (t < 1.4) { const k = (t - 0.85) / 0.55; st.hx = lerp(mx, st.bx - fx / fd * 1.1, k); st.hz = lerp(mz, st.bz - fz / fd * 1.1, k); S.air = Math.sin(k * Math.PI) * 3.0 + k * 1.2; }
      else { S.air = Math.max(0, (S.air || 0) - dt * 6); }
      st.hyaw = Math.atan2(fx, fz);
      if (t > 1.4 && !S.done) { S.done = true; st.hs = 0.14; st.shake = 0.7; sfx('heavy'); pop(V.set(st.bx, 3.6, st.bz), 'BACK-BOOST! 35', 'crit'); spark(V.set(st.bx, 2.8, st.bz), 18); cubes(V, 10, 5, 1.2); flashBoss('#ffffff', 1); damageBoss(st, 35); }
      if (t > 2.2) { S.air = 0; st.spec = null; st.slow = 1; if (st.ms === 'stun') setM(st, 'open', 1.0); }
    }
  }

  // ---------------- KO: slow-mo final blow, she bursts into a sugar avalanche, sugar cubes rain; grade card ----------------
  function grade(st) { const n = st.stats.taken; return n <= 3 ? 'S' : n <= 8 ? 'A' : 'B'; }
  function outro(st, rdt, I) {
    st.outT += rdt; const t = st.outT, R = C.R;
    if (koTag && t < 3.2) koTag.classList.add('on');
    if (t > 0.5 && (I.a || I.ok || I.c) && t < 3.0) st.outT = 3.0; // tap to skip
    st.slow = t < 1.6 ? 0.3 : 1;
    if (t < 1.1) { const k = t / 1.1; R.body.rotation.z = Math.sin(t * 40) * 0.05 * k; flashBoss('#ffffff', 0.4 + 0.5 * k); if (Math.random() < rdt * 30) spark(V.set(st.bx + rnd(-1, 1), rnd(0.5, 3), st.bz + rnd(-1, 1)), 2); }
    if (t > 1.1 && !st.burst) { st.burst = true; R.root.visible = false; sfx('ko'); st.shake = 0.9; tone(1200, 200, 1.2, 'sawtooth', 0.07);
      cubes(V.set(st.bx, 1.6, st.bz), 60, 6, 2.6); }
    if (st.burst && t < 3.6 && Math.random() < rdt * 40) { const c = { p: new THREE.Vector3(st.bx + rnd(-5, 5), 9 + rnd(0, 3), st.bz + rnd(-5, 5)), v: new THREE.Vector3(0, -2, 0), r: new THREE.Vector3(rnd(0, 6), rnd(0, 6), rnd(0, 6)), t: 0, life: 3 }; if (C.cubes.length < 120) C.cubes.push(c); }
    if (t > 3.2 && koTag) koTag.classList.remove('on');
    if (t > 3.3 && !st.said) { st.said = true; DUELS.say('SUGAR RUSH', pick(lines().defeat), 3); }
    if (t > 4.6 && !st.winDone) { st.winDone = true; DUELS.bossCleared('domino', 'sugarrush-duel');
      const g = grade(st), s = st.stats;
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'SUGAR RUSH<br>SWEPT UP', 'GRADE <b style="color:#ffd23c;font-size:16px">' + g + '</b> \u00b7 hits taken ' + s.taken + ' \u00b7 best chain x' + s.maxChain + '<br>The refinery roof is clear. Crime at ' + NAME + ': 0.'); }, SIM ? 300 : 900); }
  }

  function fxStep(dt) {
    const q = C.cam.quaternion;
    for (let i = C.sparks.length - 1; i >= 0; i--) { const p = C.sparks[i]; p.t += dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.sparks.splice(i, 1); }
    C.sparks.forEach((p, i) => { M4.compose(p.p, q, ONE); C.spark.setMatrixAt(i, M4); }); C.spark.count = C.sparks.length; C.spark.visible = C.sparks.length > 0; C.spark.instanceMatrix.needsUpdate = true;
    for (let i = C.cubes.length - 1; i >= 0; i--) { const c = C.cubes[i]; c.t += dt; c.v.y -= 11 * dt; c.p.addScaledVector(c.v, dt); if (c.p.y < 0.13) { c.p.y = 0.13; c.v.y *= -0.3; c.v.x *= 0.6; c.v.z *= 0.6; } else c.r.addScaledVector(ONE, dt * 4); if (c.t > c.life) C.cubes.splice(i, 1); }
    C.cubes.forEach((c, i) => { Q4.setFromEuler(new THREE.Euler(c.r.x, c.r.y, c.r.z)); const s = c.t > c.life - 0.3 ? (c.life - c.t) / 0.3 : 1; M4.compose(c.p, Q4, V3.set(s, s, s)); C.cubeM.setMatrixAt(i, M4); });
    C.cubeM.count = C.cubes.length; C.cubeM.visible = C.cubes.length > 0; C.cubeM.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.45);
    if (st.roll >= 0) { const p = HERO_POSES.jump(1); p.tilt = [clamp(st.roll / 0.42, 0, 1) * TAU, 0, 0]; p.ty = 0.2; return p; }
    if (st.spec && st.spec.kind === 'boost' && st.spec.t > 0.85 && st.spec.t < 1.5) return HERO_POSES.airatk(clamp((st.spec.t - 0.85) / 0.55, 0, 1));
    if (st.spec && st.spec.kind === 'neon' && st.spec.t > 0.55 && st.spec.t < 1.0) return HERO_POSES.atk1(clamp((st.spec.t - 0.55) / 0.4, 0, 1));
    if (st.swing >= 0) { const dur = st.combo === 2 ? 0.55 : 0.34, u = clamp(st.swing / dur, 0, 1); return st.combo === 0 ? HERO_POSES.atk1(u) : st.combo === 1 ? HERO_POSES.atk2(u) : HERO_POSES.atk3(u); }
    const sp = Math.hypot(st.vx, st.vz); if (sp > 0.6) return HERO_POSES.run(t, sp);
    return HERO_POSES.idle(t);
  }
  function mavisPose(st, t) {
    const S = st.spec;
    if (S && S.kind === 'boost' && S.t < 1.6) { if (S.t < 0.55) return HERO_POSES.run(t, 5); const p = HERO_POSES.idle(t); legsStance(p, 0.3, 1.4); p.y -= 0.35; p.torso = [1.2, 0, 0]; p.shL = [-0.6, 0, 0.4]; p.shR = [-0.6, 0, -0.4]; return p; }
    const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' || st.ms === 'dizzy' ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.cake && st.cakeT > 0) { p.shR = [-2.8, 0, -0.3]; } return p;
  }
  const MAVIS_HOME = new THREE.Vector3(-7.6, 0, -5.0);
  function poseBoss(st, dt) {
    const R = C.R, t = st.t, u = clamp(st.mt / Math.max(0.01, st.mdur), 0, 1), b = C.base;
    let bodyY = b.bodyY + Math.sin(t * 2.6) * 0.06, lean = 0, roll = Math.sin(t * 1.3) * 0.03, arms = [[-0.25, 0], [-0.25, 0]], heart = 0, sq = 1, glow = null;
    switch (st.ms) {
      case 'spikesTell': arms = [[-2.8 * ease(Math.min(1, u * 1.5)), 0.2], [-2.8 * ease(Math.min(1, u * 1.5)), -0.2]]; bodyY += 0.25 * u; glow = ['#9fe8ff', 0.2 + 0.3 * (Math.sin(st.mt * 24) * 0.5 + 0.5)]; break;
      case 'spikes': arms = [[-0.6, 0.3], [-0.6, -0.3]]; lean = 0.5; bodyY -= 0.35; sq = 0.88; break;
      case 'dashTell': lean = 0.45 * ease(u); bodyY -= 0.3 * u; arms = [[0.9, 0.2], [0.9, -0.2]]; glow = ['#ff3d8e', 0.25 + 0.35 * (Math.sin(st.mt * 28) * 0.5 + 0.5)]; break;
      case 'dash': lean = 0.7; arms = [[1.2, 0.3], [1.2, -0.3]]; break;
      case 'poolTell': { const k = u < 0.55 ? u / 0.55 : 1; arms = [[lerp(0.6, -3.0, ease(k)), 0.3], [-0.3, 0]]; lean = u < 0.55 ? 0.4 * k : -0.2; glow = ['#ff9a3a', 0.2 + 0.25 * (Math.sin(st.mt * 22) * 0.5 + 0.5)]; break; }
      case 'open': bodyY -= 0.3; lean = 0.35 + Math.sin(st.mt * 9) * 0.04; arms = [[0.5, 0.4], [0.5, -0.4]]; heart = 0.75 + 0.25 * Math.sin(st.mt * 14); break;
      case 'dizzy': case 'stun': bodyY -= 0.35; lean = 0.25; roll = Math.sin(st.mt * 6) * 0.18; arms = [[0.3, 0.6], [0.3, -0.6]]; heart = 0.8 + 0.2 * Math.sin(st.mt * 14);
        if (Math.random() < dt * 6) spark(V.set(st.bx + Math.cos(st.t * 5) * 0.7, 3.7, st.bz + Math.sin(st.t * 5) * 0.7), 1); break;
      case 'down': bodyY -= 0.8 * ease(Math.min(1, st.mt / 0.5)); lean = 0.6; arms = [[0.9, 0.5], [0.9, -0.5]]; if (Math.random() < dt * 10) cubes(V.set(st.bx, 2, st.bz), 1, 2, 0.8); break;
      case 'intro': arms = [[-2.6 + Math.sin(t * 6) * 0.3, 0.3], [-0.3, 0]]; break;
    }
    if (C.bflinch > 0) { C.bflinch = Math.max(0, C.bflinch - dt * 6); lean -= 0.25 * C.bflinch; }
    // face Harold (not mid-dash)
    if (st.ms === 'dash' || st.ms === 'dashTell') { const D = st.dash; if (D) st.byaw = Math.atan2(D.x1 - D.x0, D.z1 - D.z0); } else if (st.ms !== 'ko') st.byaw = damp(wrapA(st.byaw), wrapA(Math.atan2(st.hx - st.bx, st.hz - st.bz)), 6, dt);
    R.root.position.set(st.bx, 0, st.bz); R.root.rotation.y = st.byaw;
    R.body.position.y = damp(R.body.position.y, bodyY, 12, dt); R.body.rotation.x = damp(R.body.rotation.x, lean, 10, dt); R.body.rotation.z = roll; R.body.scale.y = damp(R.body.scale.y, sq, 16, dt);
    R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, arms[i][0], 12, dt); a.sh.rotation.z = damp(a.sh.rotation.z, arms[i][1] * (a.s || 1), 12, dt); });
    if (R.heart && R.heart.material) { R.heart.material.opacity = damp(R.heart.material.opacity, heart, 14, dt); R.heart.visible = R.heart.material.opacity > 0.02; }
    for (const m of R.flash) if (m && m.userData && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow) for (const m of R.flash) if (m.userData && m.userData.flashC) { m.userData.flashC.value.set(glow[0]); m.userData.flash.value = Math.max(m.userData.flash.value, glow[1]); }
    if (R.update) { try { R.update(dt, { ms: st.ms, u, phase: st.phase, open: heart > 0.1, dash: st.ms === 'dash', hp: st.bhp }); } catch (e) {} }
    C.shadow.position.set(st.bx, 0.02, st.bz); C.shadow.visible = R.root.visible;
  }
  function telegraphs(st, dt) {
    const u = clamp(st.mt / Math.max(0.01, st.mdur), 0, 1);
    // spike rings: grow + pulse through the tell, then the spikes
    let ri = 0, si = 0;
    if (st.ms === 'spikesTell' || st.ms === 'spikes') for (const r of st.atk) { const m = C.rings[ri++]; if (!m) break; m.visible = true; m.position.set(r.x, 0.05, r.z);
      const s = st.ms === 'spikes' ? r.r * 2 : r.r * 2 * (0.35 + 0.65 * ease(u)); m.scale.set(s, s, 1); m.material.color.set(st.ms === 'spikes' ? '#ffffff' : '#ff7ab8');
      m.material.opacity = st.ms === 'spikes' ? Math.max(0, 1 - st.mt / st.mdur) : 0.45 + 0.4 * Math.sin(st.mt * (10 + u * 20));
      if (st.ms === 'spikes') { const up = Math.min(1, st.mt / 0.08) * (st.mt > st.mdur - 0.2 ? Math.max(0, (st.mdur - st.mt) / 0.2) : 1);
        for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + r.x, rr = k === 0 ? 0 : r.r * 0.62; Q4.setFromEuler(new THREE.Euler(Math.sin(a) * 0.25, a, Math.cos(a) * 0.25)); M4.compose(V.set(r.x + Math.cos(a) * rr * (k ? 1 : 0), 0, r.z + Math.sin(a) * rr * (k ? 1 : 0)), Q4, V2.set(1, up * (k === 0 ? 1.4 : 1), 1)); C.spikeM.setMatrixAt(si++, M4); } } }
    if (st.ms === 'poolTell' && st.atk[0]) { const r = st.atk[0], m = C.rings[ri++]; m.visible = true; m.position.set(r.x, 0.06, r.z); const s = r.r * 2 * (0.4 + 0.6 * ease(u)); m.scale.set(s, s, 1); m.material.color.set('#ffa024'); m.material.opacity = 0.5 + 0.4 * Math.sin(st.mt * 18); }
    for (; ri < C.rings.length; ri++) C.rings[ri].visible = false;
    C.spikeM.count = si; C.spikeM.visible = si > 0; C.spikeM.instanceMatrix.needsUpdate = true;
    // dash after-images along the path + a stripe
    let gi = 0; const D = st.dash;
    if (D && (st.ms === 'dashTell' || st.ms === 'dash')) { const n = 5, yaw = Math.atan2(D.x1 - D.x0, D.z1 - D.z0);
      for (let k = 1; k <= n; k++) { const f = k / n; if (st.ms === 'dashTell' && u < f * 0.8) continue; if (st.ms === 'dash' && st.mt / st.mdur > f) continue;
        Q4.setFromAxisAngle(V3.set(0, 1, 0), yaw); M4.compose(V.set(lerp(D.x0, D.x1, f), 0, lerp(D.z0, D.z1, f)), Q4, V2.set(1, 1, 1)); C.ghostM.setMatrixAt(gi++, M4); }
      C.path.visible = true; C.path.position.set((D.x0 + D.x1) / 2, 0.04, (D.z0 + D.z1) / 2); C.path.rotation.set(-Math.PI / 2, 0, 0); C.path.rotation.y = yaw; C.path.rotation.x = -Math.PI / 2; C.path.scale.set(1.9, D.len + 1.5, 1);
      C.path.material.opacity = st.ms === 'dash' ? 0.25 : 0.2 + 0.25 * (Math.sin(st.mt * 26) * 0.5 + 0.5); }
    else C.path.visible = false;
    C.ghostM.count = gi; C.ghostM.visible = gi > 0; C.ghostM.instanceMatrix.needsUpdate = true;
    // pools: spread in, wobble, shrink out
    for (const p of C.pools) if (p.on) { const k = Math.min(1, p.t / 0.35) * (p.t > p.life - 0.8 ? Math.max(0, (p.life - p.t) / 0.8) : 1); p.m.scale.setScalar(Math.max(0.05, p.r * k * (1 + Math.sin(p.t * 3) * 0.02))); }
    // "!" over her head during every tell
    const tell = ['spikesTell', 'dashTell', 'poolTell'].includes(st.ms); C.bang.visible = tell; if (tell) { C.bang.position.set(st.bx, 4.6 + Math.sin(st.t * 12) * 0.1, st.bz); const s = 1 + 0.15 * Math.sin(st.t * 20); C.bang.scale.set(0.7 * s, 1.4 * s, 1); }
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.hs > 0 ? 0.15 : st.slow), t = st.t;
    const H = C.H, air = st.spec && st.spec.air ? st.spec.air : 0;
    H.root.position.set(st.hx, air, st.hz); H.root.rotation.y = damp(wrapA(H.root.rotation.y), wrapA(st.hyaw), 16, dt); applyPose(H, haroldPose(st, t), 18, dt, st.roll >= 0);
    if (st.flash > 0) { st.flash = Math.max(0, st.flash - dt * 5); H.mat.userData.flash.value = st.flash * 0.8; } else if (st.inv > 0 && !st.spec) H.mat.userData.flash.value = (Math.sin(st.t * 30) > 0 ? 0.25 : 0);
    else H.mat.userData.flash.value = 0;
    const M = C.M; let mp = MAVIS_HOME;
    if (st.spec && st.spec.kind === 'boost' && st.spec.mx !== undefined && st.spec.t < 1.8) { const k = clamp(st.spec.t / 0.55, 0, 1); mp = V3.set(lerp(MAVIS_HOME.x, st.spec.mx, ease(k)), 0, lerp(MAVIS_HOME.z, st.spec.mz, ease(k))); M.root.rotation.y = Math.atan2(st.bx - mp.x, st.bz - mp.z); }
    else M.root.rotation.y = Math.atan2(st.hx - MAVIS_HOME.x, st.hz - MAVIS_HOME.z);
    M.root.position.set(damp(M.root.position.x, mp.x, 10, dt), 0, damp(M.root.position.z, mp.z, 10, dt)); applyPose(M, mavisPose(st, t), 12, dt, false);
    poseBoss(st, dt); telegraphs(st, dt);
    C.halo.material.opacity = 0.3 + 0.06 * Math.sin(S.time * 7) + (C.beam.visible ? 0.3 : 0); C.neonL.intensity = 40 + (C.beam.visible ? 60 : 0);
    DUELS.hot(st.power >= 100 && !st.spec && !st.over);
    // camera: behind Harold looking at her (lock-on); portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 66 : 52; C.cam.updateProjectionMatrix();
    const fx = st.bx - st.hx, fz = st.bz - st.hz, fd = Math.max(0.01, Math.hypot(fx, fz)), Fx = fx / fd, Fz = fz / fd, back = port ? 8.6 : 6.6, up = port ? 5.4 : 4.0;
    V.set(st.hx - Fx * back + Fz * 0.8, up + air * 0.5, st.hz - Fz * back - Fx * 0.8); V2.set(st.hx + Fx * Math.max(2.2, Math.min(fd, 5) * 0.75), port ? 2.4 : 2.1, st.hz + Fz * Math.max(2.2, Math.min(fd, 5) * 0.75));
    if (st.ms === 'intro' && st.phase === 0) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(st.bx + 5, 4.5, st.bz - 6), V, k); V2.lerpVectors(V3.set(st.bx, 3, st.bz).clone(), V2, k); }
    if (st.spec && st.spec.kind === 'neon' && st.spec.t > 0.6 && st.spec.t < 2.2) { V.set(st.bx + 6, 4.2, st.bz - 7); V2.set((st.bx + CONDUIT.x) / 2, 3.6, (st.bz + SIGN_Z) / 2); }
    if (st.ms === 'ko') { const a = st.outT * 0.7; V.set(st.bx + Math.sin(a) * 8, 4.2, st.bz - Math.cos(a) * 8); V2.set(st.bx, 2, st.bz); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
    C.camP.lerp(V, 1 - Math.exp(-8 * Math.max(dt, rdt * 0.5))); C.camL.lerp(V2, 1 - Math.exp(-8 * Math.max(dt, rdt * 0.5))); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 30; OUT_U.fogF.value = 120;
  };
  C.onResize = () => {};

  // ---------------- test bot: win = fight it out (walk in, combo in her openings, dodges ~72% of tells, POWER when full); mash = walk in + SWING/POWER only, never dodges; lose = stand still ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over || st.spec) return; B.mx = 0; B.my = 0; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt; const d = dist2(st.hx, st.hz, st.bx, st.bz), left = st.mdur - st.mt;
    const fx = (st.bx - st.hx) / Math.max(0.01, d), fz = (st.bz - st.hz) / Math.max(0.01, d);
    if (st.ms !== B.lastMs) { B.lastMs = st.ms; if (/Tell$/.test(st.ms)) B.react = Math.random() < 0.72; }
    if (B.mode === 'mash') { if (st.power >= 100 && ['open', 'dizzy', 'guard'].includes(st.ms)) { B.c = true; return; } if (d > BR + 1.2) B.my = 1; if (d < BR + 1.6 && B.cd <= 0) { B.a = true; B.cd = 0.15; } return; }
    const threat = (x, z) => { if (!B.react) return false; if (st.ms === 'spikesTell' && left < 0.5) return st.atk.some((r) => dist2(x, z, r.x, r.z) < r.r + 0.6);
      if ((st.ms === 'dashTell' && left < 0.6 || st.ms === 'dash') && st.dash) { const D = st.dash, ax = D.x1 - D.x0, az = D.z1 - D.z0, L2 = ax * ax + az * az || 1, k = clamp(((x - D.x0) * ax + (z - D.z0) * az) / L2, 0, 1); return dist2(x, z, D.x0 + ax * k, D.z0 + az * k) < BR + HR + 0.7; }
      if (st.ms === 'poolTell' && st.atk[0] && left < 0.5) return dist2(x, z, st.atk[0].x, st.atk[0].z) < st.atk[0].r + 0.3; return false; };
    if (threat(st.hx, st.hz)) { // step sideways (screen right/left) to the safer side
      const R1 = threat(st.hx - fz * 2.2, st.hz + fx * 2.2), L1 = threat(st.hx + fz * 2.2, st.hz - fx * 2.2); B.mx = !R1 ? 1 : !L1 ? -1 : 1; B.my = -0.6;
      if (B.cd <= 0 && left < 0.25 && !inPool(st) && Math.random() < 0.5) { B.b = true; B.cd = 0.5; } return; }
    if (inPool(st)) { B.my = -1; B.mx = 0.6; return; }
    if (st.power >= 100 && ['open', 'dizzy', 'guard'].includes(st.ms)) { B.c = true; return; }
    if (d > BR + 1.2) B.my = 1;
    if (d < BR + 1.6 && B.cd <= 0 && ['open', 'dizzy', 'guard', 'stun'].includes(st.ms)) { B.a = true; B.cd = 0.2; }
  };
  DUELS.reg('sugarrush', C);
  // entrance: a pink ring at the refinery's west door ("elevator to the roof"); the boss anchor itself sits on the roof (y = CURB + DOM_H)
  const L = LANDMARKS.find((l) => l.id === 'domino'); // sugarrush: entry ACT (FIGHT) at the refinery's west door; see SR_DOOR below
  const SR_DOOR = { x: 69.6, z: 53.5, ox: 67.6, oz: 53.5 };
  if (L && L.boss) DUELS.addTrigger('sugarrush', L, SR_DOOR.x, SR_DOOR.z, SR_DOOR.ox, SR_DOOR.oz, '#ff7ab8');
  window.__sugarrush = C;
  // test entry: ?sugarrush=1 starts it (after a few frames, intro skipped); &sugarrushauto=win|lose plays it with the bot
  if (Q.get('sugarrush')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; DUELS.start('sugarrush', { bot: Q.get('sugarrushauto') || null }); } }); }
})();

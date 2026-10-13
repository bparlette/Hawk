
// ======================= THE POOL SHARK, PENDRY: a rooftop pool-deck brawl (DESIGN.md: "Pendry: relax in the pool, then throw thugs into the harbor";
// BOSS_GANG_UPGRADE_PLAN #18). Branch hark/boss-pool-shark. Runs on the DUELS core (09a): own scene + camera, radio ducked, city HUD hidden.
// A 3/4 view over the Pendry roof pool deck: Harold walks the deck (stick / WASD), CANE (3-hit combo: SCRATCH! > CORNER POCKET! > 8-BALL! spin),
// HOP (jump), BANK (ACT: spends a full POWER meter). The Pool Shark (an original cartoon shark hustler: loud cabana shirt, gold chain,
// shades on his forehead, a pool cue) lives in the pool and only comes out to attack. Every attack is telegraphed >= 1.0 s:
//   CUE-BALL BREAK: he surfaces at the pool edge with his cue; glowing AIM LINES fan across the deck, then the balls fly down them -> step off a line or HOP
//   CANNONBALL: he leaps out of the pool, a landing SHADOW + ring sits on Harold, he lands and a WAVE RING rolls out over the deck -> move off the shadow, HOP the wave
//   FIN CIRCLE (phase 2+): only the dorsal fin circles while a red ring closes around Harold; when it closes he lunges at that spot -> step out of the ring
// After each attack he is OPEN (on the edge with his cue, or beached and flopping on the deck): beat on him. 3 phases x 100 HP.
// Phase 3 "HARBOR THROWS": Cobblestone Catfish goons climb onto the deck; a combo finisher launches a goon over the rail into the harbor (POWER),
// and a goon launched past the shark BANKS off him for bonus damage. POWER fills from hits, dodges and harbor throws; BANK SHOT (ACT) = slow-mo:
// Harold whacks a giant cue ball, it banks off the pool edge into the shark (big damage + stun) and sends every goon on deck into the harbor.
// Help: 1.2 s i-frames, Mavis tosses a crab cake once a phase when Harold is low, one SECOND WIND per fight, +35 HP between phases.
// KO: slow-mo belly flop into the pool with NO splash ("...plip."), then he drifts off on a pink pool float with his shades down. Win = BOSS_CLEAR.clear('pendry').
// Grade card: stars by hits taken (<=3 S, <=8 A, else B).
// Entry: the glowing ring at the Pendry boss anchor (LANDMARKS pendry .boss, 126, -19.5) -> ACT "FIGHT". Tests: ?poolshark=1 (&poolsharkauto=win|lose),
// or ?duel=poolshark&duelbot=win|lose. __poolshark = the mode object.
// RIG HOOKS (procedural stand-ins until real rigs land):
//   window.buildPoolShark({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, body?, armL?, armR?, cue?, fin?, shades?, float?, mats? }
//     root: feet at y 0, faces +z, ~2.7 m tall. body: the group that tilts (rotation.x = PI/2 lies him face-down, head toward +z). fin: the dorsal fin group
//     (its tip must sit ~2.4 m up so it shows above the water when root.y = -1.95). armL/armR: shoulder groups (rotation.x swings forward). cue: in the right hand.
//     shades: sunglasses group (moved from forehead to eyes on the KO). float: a pool float (hidden until the KO). mats: toon materials to flash on hits.
//   window.buildCatfishGoon({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, arm?, mat? } (feet y 0, faces +z, ~1.7 m).
(function () {
  if (typeof DUELS === 'undefined') return;
  const P = { scene: null, cam: null, title: 'THE POOL SHARK', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> cane · <b>K</b> hop · <b>E</b> BANK SHOT (full power)',
    labels: { a: 'CANE', b: 'HOP', c: 'BANK', l: '', r: '' } };
  const PX0 = -4.5, PX1 = 4.5, PZ0 = 0.5, PZ1 = 6.5, PCX = 0, PCZ = 3.5; // the pool (deck at y 0)
  const DX0 = -9.6, DX1 = 9.6, DZ0 = -7.4, DZ1 = 8.4; // walkable deck
  const WY = -0.32; // pool water level
  const PHASES = [ // tells (s), balls, ball speed, wave speed, rest between attacks, open time, the attack mix
    { cue: 1.45, balls: 3, bspd: 7.0, cann: 1.55, wave: 6.0, fin: 1.8, rest: [1.3, 1.9], open: 2.3, mix: ['cue', 'cann', 'cue', 'cann'] },
    { cue: 1.3, balls: 4, bspd: 8.0, cann: 1.4, wave: 6.6, fin: 1.7, rest: [1.1, 1.6], open: 2.1, mix: ['fin', 'cue', 'cann', 'fin', 'cann', 'cue'] },
    { cue: 1.15, balls: 5, bspd: 8.8, cann: 1.25, wave: 7.2, fin: 1.55, rest: [1.0, 1.5], open: 2.0, mix: ['fin', 'cann', 'cue', 'fin', 'cue', 'cann'], goons: true },
  ];
  const BHP = 125; // shark HP per phase
  const DMG = { ball: 9, land: 16, wave: 8, lunge: 15, goon: 6 };
  const COMBO = [{ d: 7, t: 0.3, w: 'SCRATCH!', pose: 'atk1' }, { d: 7, t: 0.3, w: 'CORNER POCKET!', pose: 'atk2' }, { d: 14, t: 0.46, w: '8-BALL!', pose: 'atk3' }];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  const lines = () => (typeof GR1 !== 'undefined' && GR1.bosses && GR1.bosses.pool_shark) || { intro: ['Rack \'em up, grandpa!'], defeat: ['You hustled the hustler. Respect.'] };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const inPool = (x, z, m = 0) => x > PX0 - m && x < PX1 + m && z > PZ0 - m && z < PZ1 + m;
  // nearest point on the pool's rim to (x, z), with the outward normal
  function edgePt(x, z) {
    let cx = clamp(x, PX0, PX1), cz = clamp(z, PZ0, PZ1);
    if (cx === x && cz === z) { const d = [x - PX0, PX1 - x, z - PZ0, PZ1 - z], i = d.indexOf(Math.min(...d)); if (i === 0) cx = PX0; else if (i === 1) cx = PX1; else if (i === 2) cz = PZ0; else cz = PZ1; }
    let nx = 0, nz = 0; if (cx === PX0) nx = -1; else if (cx === PX1) nx = 1; if (cz === PZ0) nz = -1; else if (cz === PZ1) nz = 1; const l = Math.hypot(nx, nz) || 1;
    return { x: cx, z: cz, nx: nx / l, nz: nz / l };
  }

  // ---------------- HUD extras: POWER bar, damage pops ----------------
  const css = document.createElement('style');
  css.textContent = `
  #duel .pspw { display: inline-flex; align-items: center; gap: 6px; color: #9fe8ff; }
  #duel .pspw .t { width: 92px; height: 9px; background: #0a1a2a; border: 2px solid #14101f; border-radius: 5px; overflow: hidden; display: inline-block; position: relative; }
  #duel .pspw .t i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(#bff4ff, #39b6ff); }
  #duel .pspw.full { color: #ffd23c; } #duel .pspw.full .t i { background: linear-gradient(#fff6a0, #ffb020); animation: dlow .3s infinite alternate; }
  #duel .pspop { position: absolute; left: 0; top: 0; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; pointer-events: none; opacity: 0; will-change: transform; }
  #duel .pspop.g { color: #ffd23c; font-size: 18px; } #duel .pspop.b { color: #7fe6ff; } #duel .pspop.r { color: #ff6a7a; }
  body.duel-poolshark #duel .dtell { white-space: normal; max-width: 92vw; text-align: center; }
  @media (max-width: 480px) { #duel .pspw .t { width: 70px; } #duel .pspop { font-size: 12px; } #duel .pspop.g { font-size: 15px; } }`;
  document.head.appendChild(css);
  const POPS = []; for (let i = 0; i < 10; i++) { const e = document.createElement('div'); e.className = 'pspop'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 9, life: 1, p: new THREE.Vector3() }); }
  let popI = 0;
  function pop(p, text, cls = '', life = 0.9) { const o = POPS[popI++ % POPS.length]; o.p.copy(p); o.t = 0; o.life = life; o.e.className = 'pspop ' + cls; o.e.textContent = text; }
  function popTick(dt) {
    const w = VW(), h = VH();
    for (const o of POPS) { if (o.t >= o.life) { if (o.e.style.opacity !== '0') o.e.style.opacity = '0'; continue; } o.t += dt; const u = o.t / o.life;
      V.copy(o.p); V.y += u * 1.2; V.project(P.cam); const x = (V.x * 0.5 + 0.5) * w, y = (-V.y * 0.5 + 0.5) * h, s = u < 0.15 ? 0.6 + u / 0.15 * 0.7 : 1.3 - Math.min(0.3, (u - 0.15) * 0.8);
      o.e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%) scale(${s.toFixed(2)})`; o.e.style.opacity = String(u > 0.75 ? (1 - u) / 0.25 : 1); }
  }

  // ---------------- textures ----------------
  function woodTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b07a4a'; g.fillRect(0, 0, w, h); SEED = 33;
    for (let y = 0; y < 16; y++) { const o = Math.floor(srnd() * 4) * 64; g.fillStyle = ['#b98450', '#a87244', '#c08c58', '#9e6a3e'][y % 4]; g.fillRect(0, y * 16 + 1, w, 14); g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(o, y * 16, 2, 16); g.fillRect((o + 128) % w, y * 16, 2, 16);
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(80,40,10,.12)'; g.fillRect(srnd() * w, y * 16 + 3 + srnd() * 9, 30 + srnd() * 40, 1); } } }, 256); }
  function waterTex() { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#3fc4e8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; SEED = 7;
    for (let k = 0; k < 18; k++) { const x = srnd() * w, y = srnd() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 10, y - 6, x + 20, y + 6, x + 30, y); g.stroke(); } }, 128); }
  function lineTex() { return canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, '#fff'); gr.addColorStop(0.65, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 20); }, 64); }
  function ringTex() { return canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke(); g.lineWidth = 4; g.globalAlpha = 0.6; g.beginPath(); g.arc(64, 64, 42, 0, TAU); g.stroke(); }, 128); }

  // ---------------- the arena: the Pendry roof pool deck over Fells Point, harbor below ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const sk = new THREE.SphereGeometry(90, 24, 12).toNonIndexed(); const sp = sk.attributes.position, cc = new Float32Array(sp.count * 3), c0 = new THREE.Color('#3f8ee0'), c1 = new THREE.Color('#9fd4f4'), c2 = new THREE.Color('#ffe2b0');
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 90, c = y > 0.1 ? c0.clone().lerp(c1, clamp(1 - (y - 0.1) * 2.4, 0, 1)) : c1.clone().lerp(c2, clamp(1 - (y + 0.05) * 7, 0, 1)); cc.set([c.r, c.g, c.b], i * 3); }
    sk.setAttribute('color', new THREE.BufferAttribute(cc, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    // harbor far below + the deck (wood) with a hole for the pool (four planks around it)
    const hb = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: '#2d6f8f', emissive: '#123a52' })); hb.rotation.x = -Math.PI / 2; hb.position.y = -9; sc.add(hb);
    const wt = woodTex(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    const deckG = []; const addDeck = (x0, x1, z0, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4); deckG.push(g); };
    addDeck(-11, 11, -9, PZ0 - 0.4); addDeck(-11, 11, PZ1 + 0.4, 10.6); addDeck(-11, PX0 - 0.4, PZ0 - 0.4, PZ1 + 0.4); addDeck(PX1 + 0.4, 11, PZ0 - 0.4, PZ1 + 0.4);
    const dm = new THREE.Mesh(mergeGeos(deckG), new THREE.MeshLambertMaterial({ map: wt })); sc.add(dm);
    const R = K();
    // pool: coping, tiled walls, floor, a ladder, the deep-end stripe
    const cw = PX1 - PX0, cd = PZ1 - PZ0;
    R.add(G.box(cw + 0.8, 0.12, 0.4), '#efe9dc', PCX, 0.03, PZ0 - 0.2).add(G.box(cw + 0.8, 0.12, 0.4), '#efe9dc', PCX, 0.03, PZ1 + 0.2)
      .add(G.box(0.4, 0.12, cd), '#efe9dc', PX0 - 0.2, 0.03, PCZ).add(G.box(0.4, 0.12, cd), '#efe9dc', PX1 + 0.2, 0.03, PCZ);
    R.add(G.box(cw, 1.7, 0.05), '#2a9ccc', PCX, -0.85, PZ0 + 0.02).add(G.box(cw, 1.7, 0.05), '#2a9ccc', PCX, -0.85, PZ1 - 0.02).add(G.box(0.05, 1.7, cd), '#2a9ccc', PX0 + 0.02, -0.85, PCZ).add(G.box(0.05, 1.7, cd), '#2a9ccc', PX1 - 0.02, -0.85, PCZ);
    R.add(G.box(cw, 0.05, cd), '#58b8dc', PCX, -1.7, PCZ).add(G.box(0.3, 0.02, cd - 0.6), '#1a5a8a', PCX, -1.67, PCZ);
    for (const s of [-0.35, 0.35]) R.add(G.cyl(0.035, 0.035, 1.3, 6), '#d8dde4', PX1 - 0.6 + s, 0.15, PZ0 + 0.1, 0.25, 0, 0);
    // glass + steel railing round the roof edge
    for (let x = -10.5; x <= 10.6; x += 1.5) for (const z of [-8.6, 10.2]) R.add(G.box(0.08, 1.1, 0.08), '#5a6068', x, 0.55, z);
    for (let z = -8.6; z <= 10.3; z += 1.5) for (const x of [-10.5, 10.5]) R.add(G.box(0.08, 1.1, 0.08), '#5a6068', x, 0.55, z);
    R.add(G.box(21.1, 0.08, 0.12), '#c8ccd2', 0, 1.12, -8.6).add(G.box(21.1, 0.08, 0.12), '#c8ccd2', 0, 1.12, 10.2).add(G.box(0.12, 0.08, 18.9), '#c8ccd2', -10.5, 1.12, 0.8).add(G.box(0.12, 0.08, 18.9), '#c8ccd2', 10.5, 1.12, 0.8);
    // loungers + towels, umbrellas, a cabana bar, the shark's pool table (his "office") at the far end
    for (const [x, z, r, tc] of [[-8.2, -1.5, 0, '#ff5fa2'], [-8.2, 1.5, 0, '#ffd23c'], [8.2, -1.5, Math.PI, '#39b6ff'], [8.2, 1.5, Math.PI, '#ff8a4a'], [-6.5, -6.6, Math.PI / 2, '#9dff6b']]) {
      const c = Math.cos(r), s = Math.sin(r), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
      let [a, b] = at(0, 0); R.add(G.box(0.7, 0.12, 1.9), '#f4f0e6', a, 0.32, b, 0, r, 0).add(G.box(0.62, 0.04, 1.5), tc, a, 0.4, b, 0, r, 0);
      [a, b] = at(0, -0.85); R.add(G.box(0.7, 0.1, 0.7), '#f4f0e6', a, 0.62, b, -0.9, r, 0);
      for (const [dx, dz] of [[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.8], [0.3, -0.8]]) { [a, b] = at(dx, dz); R.add(G.cyl(0.03, 0.03, 0.3, 5), '#c8ccd2', a, 0.15, b); } }
    for (const [x, z, c1, c2] of [[-8.6, 0, '#ff5fa2', '#fff4e6'], [8.6, 0, '#39b6ff', '#fff4e6'], [-6.5, -5.2, '#ffd23c', '#ff8a4a']]) {
      R.add(G.cyl(0.05, 0.05, 2.6, 6), '#f4f0e6', x, 1.3, z); for (let k = 0; k < 8; k++) R.add(new THREE.ConeGeometry(1.5, 0.6, 3, 1, true, k * TAU / 8, TAU / 8), k % 2 ? c1 : c2, x, 2.75, z); }
    R.add(G.box(3.2, 1.05, 0.8), '#7a4a2a', 7.2, 0.52, -6.6).add(G.box(3.4, 0.08, 1.0), '#efe9dc', 7.2, 1.08, -6.6);
    for (const [x, c] of [[6.2, '#ff5fa2'], [6.8, '#9dff6b'], [7.4, '#ffd23c'], [8, '#39b6ff']]) R.add(G.cyl(0.07, 0.06, 0.3, 6), c, x, 1.27, -6.5);
    for (const [x, z] of [[5.6, -7.6], [8.8, -7.6]]) R.add(G.cyl(0.05, 0.05, 2.5, 5), '#7a4a2a', x, 1.25, z); R.add(G.box(3.6, 0.12, 1.5), '#f4f0e6', 7.2, 2.5, -7.3);
    R.add(G.box(3.2, 0.2, 1.7), '#1f7a46', -6.5, 0.95, 9.4).add(G.box(3.5, 0.18, 0.18), '#5a2a14', -6.5, 1.0, 8.5).add(G.box(3.5, 0.18, 0.18), '#5a2a14', -6.5, 1.0, 10.3)
      .add(G.box(0.18, 0.18, 1.9), '#5a2a14', -8.2, 1.0, 9.4).add(G.box(0.18, 0.18, 1.9), '#5a2a14', -4.8, 1.0, 9.4);
    for (const [x, z] of [[-7.9, 8.7], [-5.1, 8.7], [-7.9, 10.1], [-5.1, 10.1]]) R.add(G.cyl(0.1, 0.12, 0.85, 6), '#5a2a14', x, 0.43, z);
    for (const [x, z, c] of [[-6.9, 9.3, '#ffd23c'], [-6.6, 9.5, '#d8262a'], [-6.3, 9.3, '#14101f'], [-5.9, 9.6, '#3a5ad8']]) R.add(G.sph(0.11, 8, 6), c, x, 1.16, z);
    // the Pendry's clock tower rising beside the deck + Fells Point rowhouses and the harbor shore far below
    R.add(G.box(3, 16, 3), '#b35a3a', 13.5, -2, 8).add(G.box(3.3, 0.4, 3.3), '#efe9dc', 13.5, 6.2, 8).add(G.cyl(0.2, 2.3, 2.2, 4), '#4a6a5a', 13.5, 7.5, 8, 0, Math.PI / 4, 0);
    R.add(G.cyl(0.9, 0.9, 0.1, 16), '#f4f0e6', 13.5, 4.8, 6.45, Math.PI / 2, 0, 0).add(G.box(0.08, 0.7, 0.05), '#14101f', 13.5, 4.95, 6.38).add(G.box(0.5, 0.08, 0.05), '#14101f', 13.7, 4.8, 6.38);
    R.add(G.box(24, 9, 6), '#9a4a3a', 0, -4.6, 13.8).add(G.box(6, 9, 26), '#a85a44', -14, -4.6, 1).add(G.box(6, 9, 26), '#a85a44', 14, -4.6, -1); // the old pier building under the deck
    SEED = 91; for (let k = 0; k < 16; k++) { const x = -60 + k * 8, h = 4 + srnd() * 6; R.add(G.box(7, h, 6), ['#9a4a3a', '#b35a3a', '#8a3a2e', '#c8a080'][k % 4], x, -9 + h / 2, -62); R.add(G.box(7.2, 0.5, 6.2), '#2a2a30', x, -9 + h + 0.25, -62); }
    for (let k = 0; k < 12; k++) { const x = -70 + k * 12, h = 10 + srnd() * 26; R.add(G.box(8, h, 8), ['#8aa0b8', '#c8ccd2', '#6a7a8a', '#b0b8c0'][k % 4], x, -9 + h / 2, 80 + srnd() * 10); }
    sc.add(R.mesh(toonMat(), null, 0.0028));
    // pool water: animated ripples (one mesh)
    const wtex = waterTex(); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(3, 2);
    P.water = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), new THREE.MeshLambertMaterial({ map: wtex, color: '#bff0ff', emissive: '#0a4a6a', transparent: true, opacity: 0.84, depthWrite: false }));
    P.water.rotation.x = -Math.PI / 2; P.water.position.set(PCX, WY, PCZ); P.water.renderOrder = 3; sc.add(P.water);
  }
  function mergeGeos(gs) { let n = 0; for (const g of gs) n += (g.index ? g.index.count : g.attributes.position.count);
    const P3 = new Float32Array(n * 3), N3 = new Float32Array(n * 3), U2 = new Float32Array(n * 2); let o = 0;
    for (let g of gs) { if (g.index) g = g.toNonIndexed(); const c = g.attributes.position.count; P3.set(g.attributes.position.array, o * 3); N3.set(g.attributes.normal.array, o * 3); U2.set(g.attributes.uv.array, o * 2); o += c; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P3, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N3, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U2, 2)); out.computeBoundingSphere(); return out; }

  // ---------------- the Pool Shark stand-in: cartoon shark hustler (original): cabana shirt, gold chain, shades up, pool cue ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, M = toonMat(), R = { root: new THREE.Group(), mats: [M] };
    R.body = new THREE.Group(); R.root.add(R.body);
    const GR = '#6f8fa8', GD = '#4f6f88', SH = '#ff4f9a', BL = '#eef2f4';
    const B = K();
    for (const s of [-1, 1]) B.add(G.cyl(0.2, 0.24, 0.72, 8), '#2a3a6a', s * 0.32, 0.4, 0).add(G.box(0.36, 0.12, 0.6), GD, s * 0.34, 0.06, 0.14, 0, s * 0.2, 0); // board shorts + flipper feet
    B.add(G.sph(0.62, 12, 9), '#2a3a6a', 0, 0.85, 0, 0, 0, 0, 1.15, 0.6, 0.9); // shorts seat
    B.add(G.sph(1, 14, 10), SH, 0, 1.5, 0, 0, 0, 0, 0.9, 0.85, 0.72); // the cabana shirt
    B.add(G.sph(1, 12, 9), BL, 0, 1.45, 0.36, 0, 0, 0, 0.42, 0.7, 0.42); // belly through the open shirt
    SEED = 5; for (let k = 0; k < 16; k++) { const a = srnd() * TAU, y = 1.05 + srnd() * 0.85; if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) > 0) continue; const r = 0.86 * Math.sqrt(Math.max(0.1, 1 - Math.pow((y - 1.5) / 0.85, 2)));
      B.add(G.sph(0.08, 6, 5), k % 3 ? '#ffd23c' : '#3fe0c8', Math.sin(a) * r * 1.0, y, Math.cos(a) * r * 0.8); } // shirt flowers
    for (const s of [-1, 1]) B.add(G.box(0.34, 0.5, 0.08), SH, s * 0.33, 1.8, 0.55, -0.25, s * 0.5, s * 0.2); // collar flaps
    B.add(G.tor(0.36, 0.045, TAU, 6, 18), '#ffcc33', 0, 1.88, 0.18, 1.2, 0, 0).add(G.sph(0.09, 8, 6), '#ffcc33', 0, 1.62, 0.5); // gold chain + medallion
    // head: big rounded shark head, snout forward, toothy grin, angry brows
    B.add(G.sph(1, 16, 12), GR, 0, 2.4, 0.12, 0, 0, 0, 0.66, 0.66, 0.88).add(G.sph(1, 12, 9), BL, 0, 2.2, 0.42, 0, 0, 0, 0.5, 0.32, 0.6)
      .add(G.cone(0.42, 0.75, 10), GR, 0, 2.48, 0.92, Math.PI / 2, 0, 0, 1, 1, 0.7).add(G.box(0.72, 0.1, 0.32), '#5a1a2a', 0, 2.18, 0.86);
    for (let k = 0; k < 7; k++) B.add(G.cone(0.05, 0.12, 4), '#ffffff', -0.3 + k * 0.1, 2.2, 0.98, Math.PI, 0, 0);
    for (const s of [-1, 1]) { B.add(G.sph(0.13, 10, 8), '#ffffff', s * 0.3, 2.62, 0.66).add(G.sph(0.065, 8, 6), '#14101f', s * 0.3, 2.62, 0.77).add(G.box(0.28, 0.06, 0.08), '#2a3a4a', s * 0.3, 2.8, 0.7, 0, 0, s * 0.35);
      for (let k = 0; k < 3; k++) B.add(G.box(0.03, 0.26, 0.12), '#3a5068', s * 0.6, 2.32 - k * 0.0, 0.1 - k * 0.14); } // eyes, brows, gills
    B.add(G.cone(0.32, 1.0, 6), GR, 0, 0.95, -0.75, -Math.PI / 2 - 0.5, 0, 0, 1, 1, 0.35).add(G.cone(0.2, 0.7, 5), GD, 0, 1.4, -1.25, -0.4, 0, 0, 0.3, 1, 1).add(G.cone(0.2, 0.6, 5), GD, 0, 0.6, -1.2, Math.PI + 0.5, 0, 0, 0.3, 1, 1); // tail + flukes
    B.mesh(M, R.body, 0.0038);
    R.fin = new THREE.Group(); R.fin.position.set(0, 2.25, -0.45); R.body.add(R.fin);
    { const F = K(); F.add(G.cone(0.5, 1.1, 4), GR, 0, 0.45, -0.1, -0.35, 0, 0, 0.22, 1, 1).add(G.cone(0.44, 0.9, 4), '#ffffff', 0, 0.42, -0.1, -0.35, 0, 0, 0.12, 0.6, 0.6); F.mesh(M, R.fin, 0.0038); }
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.82, 1.9, 0.05); R.body.add(sh);
      const A = K(); A.add(G.sph(0.3, 10, 8), SH, 0, -0.05, 0).add(G.cyl(0.16, 0.13, 0.85, 8), GR, 0, -0.5, 0).add(G.sph(0.17, 8, 6), GR, 0, -0.95, 0).add(G.cone(0.14, 0.3, 4), GD, s * 0.08, -0.4, -0.15, -2.4, 0, 0, 0.4, 1, 1); A.mesh(M, sh, 0.0035);
      if (s < 0) R.armL = sh; else R.armR = sh; }
    R.cue = new THREE.Group(); R.cue.position.set(0, -0.95, 0.05); R.armR.add(R.cue);
    { const C = K(); C.add(G.cyl(0.025, 0.05, 2.7, 6), '#e8c890', 0, 0.2, 0).add(G.cyl(0.052, 0.055, 0.7, 6), '#3a1a0a', 0, -0.8, 0).add(G.cyl(0.026, 0.026, 0.06, 6), '#3a7ad8', 0, 1.57, 0); C.mesh(M, R.cue, 0.003); }
    R.cue.rotation.set(1.3, 0, 0);
    R.shades = new THREE.Group(); R.shades.position.set(0, 2.95, 0.42); R.body.add(R.shades);
    { const S = K(); for (const s of [-1, 1]) S.add(G.box(0.3, 0.17, 0.06), '#14101f', s * 0.2, 0, 0).add(G.box(0.3, 0.025, 0.07), '#ff4f9a', s * 0.2, 0.09, 0); S.add(G.box(0.12, 0.04, 0.05), '#14101f', 0, 0.03, 0); S.mesh(M, R.shades, 0); }
    R.shades.rotation.x = -0.5;
    R.float = new THREE.Group(); R.root.add(R.float); R.float.visible = false;
    { const F = K(); for (let k = 0; k < 8; k++) F.add(new THREE.TorusGeometry(1.05, 0.34, 8, 6, TAU / 8), k % 2 ? '#ff7ab8' : '#ffffff', 0, 0, 0, Math.PI / 2, 0, k * TAU / 8); F.mesh(toonMat(), R.float, 0.003); }
    return R;
  }
  // Cobblestone Catfish goon stand-in (the gang's colours: teal + slate)
  function goonStandIn() {
    const K = DUELS.kit, G = DUELS.GEO, M = toonMat(), R = { root: new THREE.Group(), mat: M };
    const B = K();
    for (const s of [-1, 1]) B.add(G.cyl(0.11, 0.12, 0.55, 6), '#3a4a58', s * 0.18, 0.28, 0).add(G.box(0.2, 0.08, 0.32), '#2a2a30', s * 0.18, 0.04, 0.05);
    B.add(G.sph(1, 12, 9), '#3f8f8a', 0, 0.95, 0, 0, 0, 0, 0.42, 0.5, 0.36).add(G.sph(1, 10, 8), '#c8e0c8', 0, 0.9, 0.18, 0, 0, 0, 0.26, 0.36, 0.22)
      .add(G.sph(1, 12, 9), '#3f8f8a', 0, 1.48, 0.06, 0, 0, 0, 0.42, 0.3, 0.4).add(G.box(0.46, 0.06, 0.12), '#1a3a3a', 0, 1.38, 0.38)
      .add(G.sph(0.07, 6, 5), '#ffffff', -0.22, 1.58, 0.3).add(G.sph(0.07, 6, 5), '#ffffff', 0.22, 1.58, 0.3).add(G.sph(0.035, 5, 4), '#14101f', -0.22, 1.58, 0.36).add(G.sph(0.035, 5, 4), '#14101f', 0.22, 1.58, 0.36)
      .add(G.sph(1, 10, 6), '#4a5a68', 0, 1.7, 0.0, 0, 0, 0, 0.36, 0.14, 0.36).add(G.box(0.3, 0.04, 0.24), '#4a5a68', 0, 1.67, 0.32);
    for (const s of [-1, 1]) B.add(G.cyl(0.02, 0.012, 0.6, 4), '#1a3a3a', s * 0.32, 1.28, 0.3, 0.2, 0, s * 0.9).add(G.cone(0.08, 0.3, 4), '#2f6f6a', s * 0.42, 1.0, -0.1, 0, 0, s * 1.2, 0.4, 1, 1);
    B.mesh(M, R.root, 0.0035);
    R.arm = new THREE.Group(); R.arm.position.set(0.4, 1.15, 0); R.root.add(R.arm);
    { const A = K(); A.add(G.cyl(0.07, 0.06, 0.6, 6), '#3f8f8a', 0, -0.3, 0).add(G.sph(0.1, 6, 5), '#3f8f8a', 0, -0.62, 0); A.mesh(M, R.arm, 0.003); }
    return R;
  }

  // ---------------- build ----------------
  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#bfe0f0', 40, 140);
    P.cam = new THREE.PerspectiveCamera(55, VW() / VH(), 0.1, 260);
    DUELS.sceneLights(sc, '#e8f4ff', '#7a6a58', 1.35, '#fff0d0', 1.9, new THREE.Vector3(-0.5, 1, -0.6));
    buildArena(sc);
    P.H = buildHero(); sc.add(P.H.root); P.M = buildHero({ wife: true }); sc.add(P.M.root);
    let rig = null; try { if (typeof window.buildPoolShark === 'function') rig = window.buildPoolShark({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    P.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'armL', 'armR', 'cue', 'fin', 'shades', 'float']) if (!rig[k]) { rig[k] = new THREE.Group(); (k === 'float' ? rig.root : (rig.body || rig.root)).add(rig[k]); }
    rig.mats = rig.mats || []; P.R = rig; sc.add(rig.root);
    // cue balls (instanced), aim lines, rings (wave / landing / fin), the cannonball shadow, splashes + sparks, the BANK SHOT ball
    const bk = DUELS.kit(); bk.add(new THREE.SphereGeometry(0.3, 12, 9), '#ffffff', 0, 0, 0); const bg = bk.geo();
    P.ballM = new THREE.InstancedMesh(bg, toonMat(), 8); P.ballM.count = 0; P.ballM.frustumCulled = false; sc.add(P.ballM); P.balls = [];
    const BCOL = ['#ffd23c', '#3a5ad8', '#d8262a', '#7a3ab8', '#ff8a2a', '#1f9a46', '#8a2a1a', '#14101f']; for (let i = 0; i < 8; i++) P.ballM.setColorAt(i, new THREE.Color(BCOL[i]));
    const lt = lineTex(); lt.wrapT = THREE.RepeatWrapping;
    P.aims = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1), new THREE.MeshBasicMaterial({ map: lt.clone(), color: '#ffe23c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.material.map.wrapT = THREE.RepeatWrapping; m.material.map.needsUpdate = true; m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; sc.add(m); P.aims.push(m); }
    const rt = ringTex(); const ring = (col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; m.visible = false; sc.add(m); return m; };
    P.waveR = ring('#bff4ff'); P.landR = ring('#ff3d6e'); P.finR = ring('#ff3d6e');
    P.waveM = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 6, 40), new THREE.MeshLambertMaterial({ color: '#8fe4ff', emissive: '#2a8ab8', transparent: true, opacity: 0.85 })); P.waveM.rotation.x = -Math.PI / 2; P.waveM.visible = false; sc.add(P.waveM);
    P.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false })); P.shadow.rotation.x = -Math.PI / 2; P.shadow.renderOrder = 2; P.shadow.visible = false; sc.add(P.shadow);
    P.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffffff', false), transparent: true, depthWrite: false, fog: false }), 64); P.fx.count = 0; P.fx.frustumCulled = false; sc.add(P.fx); P.fxs = [];
    P.bank = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toonMat()); bakeColor(P.bank.geometry, '#ffffff'); P.bank.visible = false; sc.add(P.bank);
    // goons (2 pooled)
    P.goons = []; for (let i = 0; i < 2; i++) { let g = null; try { if (typeof window.buildCatfishGoon === 'function') g = window.buildCatfishGoon({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); g = null; }
      if (!g || !g.root) g = goonStandIn(); g.arm = g.arm || new THREE.Group(); g.root.visible = false; sc.add(g.root); P.goons.push({ R: g, on: false }); }
  };

  // ---------------- state ----------------
  function reset(phase, hp = 100) {
    const old = P.st; const st = P.st = { t: 0, phase, hp, bhp: BHP, power: old ? old.power : 0, ts: 1, tsT: 0, hs: 0, shake: 0,
      hx: 0, hz: -4, hy: 0, vy: 0, yaw: 0, atkI: -1, atkT: -1, atkHit: false, chain: 0, chainT: 0, hurtT: 0, inv: 0, bankT: -1, cakeUsed: false, cake: null,
      ms: 'intro', mt: 0, mdur: phase === 0 && !old ? 2.6 : 1.2, mixI: 0, sx: PCX, sz: PCZ, sy: -1.95, syaw: 0, pose: 'sub', finA: 0, tx: 0, tz: 0, ax: 0, az: 0, aims: [], wave: null, hitThis: false,
      gT: 2.5, over: false, won: false, outT: 0, saidT: 0, poolTellT: 0, secondWind: old ? old.secondWind : false,
      stats: old && old.stats || { hitsTaken: 0, swings: 0, landed: 0, dodges: 0, throws: 0, banks: 0, specials: 0, attacks: { cue: 0, cann: 0, fin: 0 }, hits: { ball: 0, land: 0, wave: 0, lunge: 0, goon: 0 } } };
    P.balls.length = 0; P.fxs.length = 0; for (const g of P.goons) { g.on = false; g.R.root.visible = false; }
    const R = P.R; R.root.visible = true; R.float.visible = false; R.shades.position.set(0, 2.95, 0.42); R.shades.rotation.set(-0.5, 0, 0); R.body.rotation.set(0, 0, 0);
    DUELS.bars(hp / 100, 1); return st;
  }
  function subHud(st) { const p = Math.round(st.power * 100), full = st.power >= 1;
    DUELS.sub('<span class="pspw' + (full ? ' full' : '') + '">' + (full ? 'BANK!' : 'POWER') + ' <span class="t"><i style="width:' + p + '%"></i></span></span>', 'PHASE ' + (st.phase + 1) + '/3'); }
  P.start = function () {
    P.st = null; const st = reset(clamp(+(Q.get('poolsharkphase') || 1) - 1, 0, 2) | 0); DUELS.log.push('poolshark:' + P.rigKind); subHud(st);
    if (Q.get('poolsharkhp')) st.hp = clamp(+Q.get('poolsharkhp'), 1, 100); // tests: start low
    if (st.phase === 2) st.gT = 1.5;
    DUELS.banner('THE POOL SHARK<small>PENDRY ROOF DECK · PHASE 1</small>', 2.4);
    DUELS.say('THE POOL SHARK', pick(lines().intro), 3.4);
    P.camP = new THREE.Vector3(0, 14, -14); P.camL = new THREE.Vector3(0, 0, 2);
  };
  P.retry = function () { const ph = P.st.phase; reset(ph); P.st.ms = 'swim'; P.st.mdur = 1.6; subHud(P.st); DUELS.banner('PHASE ' + (ph + 1) + '<small>AGAIN! FULL HEALTH</small>', 1.6); if (ph === 2) P.st.gT = 1.5; };
  P.exit = function () { for (const o of POPS) { o.t = 9; o.e.style.opacity = '0'; } };

  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; }
  function addPower(st, v) { const was = st.power >= 1; st.power = Math.min(1, st.power + v); if (!was && st.power >= 1) { DUELS.tell('POWER FULL! ACT = BANK SHOT', 1.4); sfx('jump'); } subHud(st); }
  function splash(x, y, z, n = 10, col = 1) { for (let k = 0; k < n && P.fxs.length < 64; k++) P.fxs.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(rnd(-2.5, 2.5), rnd(2, 5.5), rnd(-2.5, 2.5)), t: 0, life: rnd(0.4, 0.8), c: col }); }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.bankT >= 0) return false;
    st.hp -= dmg; st.inv = 1.2; st.hurtT = 0.4; st.atkT = -1; st.stats.hitsTaken++; st.stats.hits[kind]++; DUELS.hurt(); sfx('hurt'); P.hflash = 1; st.shake = Math.max(st.shake, 0.35); st.hs = 0.06;
    V.set(st.hx, 1.8, st.hz); pop(V, '-' + dmg, 'r', 0.8);
    if (st.hp <= 0 && !st.secondWind) { st.secondWind = true; st.hp = 40; DUELS.banner('SECOND WIND!<small>MAVIS: GET UP, HAROLD!</small>', 1.8); DUELS.log.push('poolshark:secondwind'); return true; }
    if (st.hp <= 0) { st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('poolshark:lose:' + kind);
      setTimeout(() => { if (DUELS.cur === P) DUELS.over('lose', 'SUNK!', 'The Pool Shark ran the table on Harold. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400); }
    else if (st.hp < 35 && !st.cakeUsed && !st.cake) { st.cakeUsed = true; st.cake = { t: 0 }; DUELS.say('MAVIS', 'Crab cake, hon! Catch!', 1.8); }
    return true;
  }
  function dodged(st, what) { st.stats.dodges++; addPower(st, 0.08); V.set(st.hx, 2.1, st.hz); pop(V, what, 'b', 0.7); }

  // ---------------- the shark's brain ----------------
  const sharkHittable = (st) => ['open', 'beached', 'stun', 'return'].includes(st.ms);
  function nextAttack(st) {
    const PH = PHASES[st.phase], a = PH.mix[st.mixI++ % PH.mix.length]; st.stats.attacks[a]++;
    if (a === 'cue') { const e = edgePt(st.hx, st.hz); st.ex = e; st.tx = e.x - e.nx * 0.35; st.tz = e.z - e.nz * 0.35; setM(st, 'cueSurf', 0.45);
      DUELS.tell('CUE BREAK! OFF THE LINES!', PH.cue + 0.45); }
    else if (a === 'cann') { setM(st, 'cannUp', PH.cann); st.ax = st.sx; st.az = st.sz; st.tx = clamp(st.hx, DX0 + 1, DX1 - 1); st.tz = clamp(st.hz, DZ0 + 1, DZ1 - 1); if (inPool(st.tx, st.tz, 0.6)) { const e = edgePt(st.tx, st.tz); st.tx = e.x + e.nx * 1.4; st.tz = e.z + e.nz * 1.4; }
      sfx('jump'); splash(st.sx, WY, st.sz, 14); DUELS.tell('CANNONBALL! MOVE, THEN HOP!', PH.cann + 0.3); }
    else { setM(st, 'finTell', PH.fin); DUELS.tell('FIN CIRCLE! GET OUT OF THE RING!', PH.fin); st.tx = st.hx; st.tz = st.hz; }
  }
  function sharkThink(st, dt) {
    const PH = PHASES[st.phase]; st.mt += dt; const u = clamp(st.mt / st.mdur, 0, 1);
    const swimTo = (spd) => { st.finA += dt * spd; const x = PCX + Math.cos(st.finA) * 3.4, z = PCZ + Math.sin(st.finA) * 2.2; st.syaw = Math.atan2(x - st.sx, z - st.sz); st.sx = x; st.sz = z; st.sy = damp(st.sy, -1.95, 8, dt); st.pose = 'sub'; };
    switch (st.ms) {
      case 'intro': swimTo(1.2); if (st.mt > st.mdur) setM(st, 'swim', 1.0); break;
      case 'swim': swimTo(1.6); if (st.mt > st.mdur) nextAttack(st); break;
      // CUE-BALL BREAK: surface at the edge nearest Harold, aim lines fan out (the tell), then the break
      case 'cueSurf': st.sx = damp(st.sx, st.tx, 10, dt); st.sz = damp(st.sz, st.tz, 10, dt); st.sy = damp(st.sy, -1.0, 10, dt); st.pose = 'edge'; st.syaw = Math.atan2(st.ex.nx, st.ex.nz);
        if (st.mt > st.mdur) { setM(st, 'cueTell', PH.cue); const base = Math.atan2(st.hx - st.ex.x, st.hz - st.ex.z), n = PH.balls; st.aims = [];
          for (let i = 0; i < n; i++) { let a = base + (i - (n - 1) / 2) * (n > 3 ? 0.3 : 0.38); if (i === Math.floor(n / 2)) a = base; st.aims.push(a); } splash(st.sx, WY, st.sz, 10); } break;
      case 'cueTell': st.pose = 'edge'; if (st.mt > st.mdur) { setM(st, 'cueGo', 0.5); sfx('heavy'); st.shake = 0.15;
          st.aims.forEach((a, i) => P.balls.push({ x: st.ex.x + Math.sin(a) * 0.4, z: st.ex.z + Math.cos(a) * 0.4, dx: Math.sin(a), dz: Math.cos(a), spd: PH.bspd, t: -i * 0.05, hit: false, near: false, c: i })); } break;
      case 'cueGo': st.pose = 'edge'; if (st.mt > st.mdur) { setM(st, 'open', PH.open); DUELS.tell('HE\'S OPEN: HIT HIM!', 1.0); } break;
      // CANNONBALL: leap out, the shadow + ring on Harold's spot, land, a wave ring rolls out
      case 'cannUp': { st.pose = 'air'; const k = u; st.sx = lerp(st.ax, st.tx, k); st.sz = lerp(st.az, st.tz, k); st.sy = lerp(-1.95, 0, k) + 7 * 4 * k * (1 - k) * (k < 0.5 ? 1 : 1); st.syaw += dt * 9;
        if (st.mt > st.mdur) { setM(st, 'beached', PH.open); st.sy = 0; sfx('heavy'); st.shake = 0.6; st.hs = 0.05; splash(st.tx, 0.2, st.tz, 18);
          if (Math.hypot(st.hx - st.tx, st.hz - st.tz) < 1.7 && st.hy < 0.5) { if (hurtHarold(st, DMG.land, 'land')) st.hitThis = true; } else dodged(st, 'DODGED!');
          st.wave = { x: st.tx, z: st.tz, r: 0.6, spd: PH.wave, hit: false, passed: false }; } break; }
      case 'beached': st.pose = 'deck'; if (st.mt > st.mdur) { setM(st, 'return', 0.8); const e = edgePt(st.sx, st.sz); st.ax = st.sx; st.az = st.sz; st.tx = e.x - e.nx * 1.2; st.tz = e.z - e.nz * 1.2; } break;
      case 'return': st.pose = 'deck'; st.sx = lerp(st.ax, st.tx, ease(u)); st.sz = lerp(st.az, st.tz, ease(u)); st.syaw = Math.atan2(st.tx - st.ax, st.tz - st.az);
        if (st.mt > st.mdur) { splash(st.sx, WY, st.sz, 14); st.finA = Math.atan2((st.sz - PCZ) / 2.2, (st.sx - PCX) / 3.4); setM(st, 'swim', rnd(...PH.rest)); } break;
      // FIN CIRCLE: the fin races round the pool, a red ring closes round Harold (follows him until the last 0.45 s), then the lunge
      case 'finTell': swimTo(4.2); if (st.mdur - st.mt > 0.45) { st.tx = st.hx; st.tz = st.hz; }
        if (st.mt > st.mdur) { const e = edgePt(st.tx, st.tz); st.ax = clamp(st.tx, PX0 + 0.5, PX1 - 0.5); st.az = clamp(st.tz, PZ0 + 0.5, PZ1 - 0.5); if (!inPool(st.tx, st.tz)) { st.ax = e.x - e.nx * 0.5; st.az = e.z - e.nz * 0.5; }
          setM(st, 'lunge', 0.38); sfx('swing'); splash(st.ax, WY, st.az, 14); } break;
      case 'lunge': { st.pose = 'air'; st.sx = lerp(st.ax, st.tx, u); st.sz = lerp(st.az, st.tz, u); st.sy = lerp(-1.2, 0, u) + 1.6 * Math.sin(u * Math.PI); st.syaw = Math.atan2(st.tx - st.ax, st.tz - st.az);
        if (st.mt > st.mdur) { sfx('heavy'); st.shake = 0.45; splash(st.tx, 0.2, st.tz, 12); if (Math.hypot(st.hx - st.tx, st.hz - st.tz) < 1.6) hurtHarold(st, DMG.lunge, 'lunge'); else dodged(st, 'WHIFF!'); setM(st, 'beached', PH.open); st.sy = 0; } break; }
      case 'open': st.pose = 'edge'; if (st.mt > st.mdur) { setM(st, 'swim', rnd(...PH.rest)); splash(st.sx, WY, st.sz, 8); st.finA = Math.atan2((st.sz - PCZ) / 2.2, (st.sx - PCX) / 3.4); } break;
      case 'stun': st.pose = st.sy > -0.5 ? 'deck' : 'edge'; if (st.mt > st.mdur) { if (st.pose === 'deck') { setM(st, 'return', 0.8); const e = edgePt(st.sx, st.sz); st.ax = st.sx; st.az = st.sz; st.tx = e.x - e.nx * 1.2; st.tz = e.z - e.nz * 1.2; } else setM(st, 'swim', rnd(...PH.rest)); } break;
      case 'down': st.pose = 'sub'; swimTo(2.4); if (st.mt > st.mdur) { st.phase++; st.bhp = BHP; st.hp = Math.min(100, st.hp + 35); st.cakeUsed = false; st.mixI = 0; setM(st, 'swim', 1.4); subHud(st);
          DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 1 ? 'WATCH FOR THE FIN!' : 'HARBOR THROWS! TOSS THE CATFISH!') + '</small>', 2.0); if (st.phase === 2) st.gT = 1.2; } break;
      case 'ko': break;
    }
  }
  function stepBalls(st, dt) {
    for (let i = P.balls.length - 1; i >= 0; i--) { const b = P.balls[i]; b.t += dt; if (b.t < 0) continue; b.x += b.dx * b.spd * dt; b.z += b.dz * b.spd * dt;
      const d = Math.hypot(st.hx - b.x, st.hz - b.z);
      if (!b.hit && d < 0.62) { if (st.hy < 0.45) { b.hit = true; hurtHarold(st, DMG.ball, 'ball'); } else if (!b.near) { b.near = true; dodged(st, 'HOPPED!'); } }
      else if (!b.hit && !b.near && d < 1.6 && b.t > 0.3) { const ahead = (st.hx - b.x) * b.dx + (st.hz - b.z) * b.dz; if (ahead < 0) { b.near = true; dodged(st, 'CLOSE ONE!'); } }
      if (b.x < -11.5 || b.x > 11.5 || b.z < -9.5 || b.z > 11) P.balls.splice(i, 1); }
    let n = 0; for (const b of P.balls) { if (b.t < 0) continue; M4.compose(V.set(b.x, 0.3, b.z), Q4.setFromAxisAngle(V2.set(b.dz, 0, -b.dx), b.t * b.spd / 0.3), ONE); P.ballM.setMatrixAt(n, M4); P.ballM.setColorAt(n, new THREE.Color(['#ffd23c', '#3a5ad8', '#d8262a', '#7a3ab8', '#ff8a2a', '#1f9a46', '#8a2a1a', '#14101f'][b.c % 8])); n++; }
    P.ballM.count = n; P.ballM.visible = n > 0; P.ballM.instanceMatrix.needsUpdate = true; if (P.ballM.instanceColor) P.ballM.instanceColor.needsUpdate = true;
    // the wave ring
    const w = st.wave; if (w) { w.r += w.spd * dt; const d = Math.hypot(st.hx - w.x, st.hz - w.z);
      if (!w.hit && !w.passed && Math.abs(d - w.r) < 0.42) { if (st.hy < 0.35) { w.hit = true; hurtHarold(st, DMG.wave, 'wave'); } else { w.passed = true; dodged(st, 'WAVE HOP!'); } }
      if (w.r > 15) st.wave = null; }
  }
  // ---------------- goons (phase 3) ----------------
  function stepGoons(st, dt) {
    if (st.phase < 2 || st.over) return;
    st.gT -= dt; const live = P.goons.filter((g) => g.on).length;
    if (st.gT <= 0 && live < 2 && st.ms !== 'down') { const g = P.goons.find((g) => !g.on); if (g) { const c = [[-9, -6.8], [9, -6.8], [-9, 8], [9, 8]][Math.floor(Math.random() * 4)];
        Object.assign(g, { on: true, x: c[0], z: c[1], y: 0, hp: 3, s: 'climb', t: 0, yaw: 0, vx: 0, vz: 0, vy: 0, inv: 0 }); g.R.root.visible = true; if (!st.goonSaid) { st.goonSaid = true; DUELS.say('CATFISH GOON', pick(GR1.gangs.cobble_catfish.taunt), 2.4); } }
      st.gT = 5.5; }
    for (const g of P.goons) { if (!g.on) continue; g.t += dt; g.inv -= dt; const dx = st.hx - g.x, dz = st.hz - g.z, d = Math.hypot(dx, dz);
      switch (g.s) {
        case 'climb': g.y = Math.min(0, -1.2 + g.t * 2.4); if (g.t > 0.6) { g.s = 'walk'; g.t = 0; } break;
        case 'walk': g.yaw = Math.atan2(dx, dz); if (d > 1.3) { g.x += dx / d * 2.3 * dt; g.z += dz / d * 2.3 * dt; } else if (st.ms !== 'ko') { g.s = 'wind'; g.t = 0; } break;
        case 'wind': if (g.t > 0.9) { g.s = 'swipe'; g.t = 0; sfx('swing'); if (d < 1.7) hurtHarold(st, DMG.goon, 'goon'); } break;
        case 'swipe': if (g.t > 0.5) { g.s = 'walk'; g.t = 0; } break;
        case 'hurt': if (g.t > 0.35) { g.s = 'walk'; g.t = 0; } break;
        case 'fly': g.x += g.vx * dt; g.z += g.vz * dt; g.vy -= 14 * dt; g.y += g.vy * dt;
          if (!g.banked && sharkHittable(st) && Math.hypot(g.x - st.sx, g.z - st.sz) < 1.8) { g.banked = true; hitShark(st, 12, 'BANK!', true); g.vx = -g.vx * 0.6 + rnd(-2, 2); g.vz = Math.abs(g.vz) + 6; st.stats.banks++; }
          if (g.y < -8.6) { g.on = false; g.R.root.visible = false; splash(g.x, -8.8, g.z, 16); } break;
      }
      if (g.s !== 'fly' && inPool(g.x, g.z, 0.4)) { const e = edgePt(g.x, g.z); g.x = e.x + e.nx * 0.45; g.z = e.z + e.nz * 0.45; }
    }
  }
  function launchGoon(st, g) { g.s = 'fly'; g.t = 0; g.banked = false; let dx = g.x - st.hx, dz = g.z - st.hz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // aim the throw over the nearest rail (a goon headed past the shark banks off him)
    g.vx = dx * 9; g.vz = dz * 9; g.vy = 7; st.stats.throws++; addPower(st, 0.3); V.set(g.x, 2.2, g.z); pop(V, 'HARBOR THROW!', 'g', 1.0); sfx('heavy'); st.shake = 0.3; st.hs = 0.08;
    if (Math.random() < 0.7) DUELS.say('CATFISH GOON', pick(GR1.gangs.cobble_catfish.ko), 1.6); }

  // ---------------- Harold ----------------
  function hitShark(st, dmg, word, gold) {
    st.bhp -= dmg; st.stats.landed++; addPower(st, 0.06); const R = P.R; for (const m of R.mats) if (m && m.userData.flashC) { m.userData.flashC.value.set('#ffffff'); m.userData.flash.value = 0.85; }
    V.set(st.sx, (st.pose === 'deck' ? 0.8 : 1.8) + (st.pose === 'edge' ? -0.6 : 0), st.sz); pop(V, word || String(dmg), gold ? 'g' : '', 0.85); V2.copy(V); V.y += 0.4; pop(V, '-' + dmg, '', 0.7); splash(V2.x, V2.y, V2.z, 6, 0);
    if (st.bhp <= 0) { st.bhp = 0; P.balls.length = 0; st.wave = null;
      if (st.phase >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.ts = 0.3; st.tsT = 1.6; DUELS.banner('K.O.!<small>THE SHARK IS SUNK</small>', 2.4); for (const g of P.goons) if (g.on && g.s !== 'fly') launchGoon(st, g); }
      else { setM(st, 'down', 2.6); DUELS.banner('PHASE CLEAR!<small>HE DOVE FOR THE DEEP END</small>', 2.0); splash(st.sx, WY, st.sz, 16); st.ts = 0.4; st.tsT = 0.6;
        if (Math.random() < 0.7) DUELS.say('MAVIS', ['That\u2019s my Harold!', 'Scratch on that, fishface!', 'Mind the edge, hon!'][st.phase % 3], 2.0); } }
  }
  function landSwing(st) {
    const c = COMBO[st.atkI]; let any = false; const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw);
    // the shark (open / beached / stunned only)
    const sd = Math.hypot(st.sx - st.hx, st.sz - st.hz);
    if (sd < 2.6 && st.ms !== 'ko' && st.ms !== 'down') {
      if (sharkHittable(st)) { any = true; hitShark(st, c.d + (st.ms === 'stun' ? 3 : 0), c.w, st.atkI === 2); sfx(st.atkI === 2 ? 'heavy' : 'hit'); st.hs = st.atkI === 2 ? 0.11 : 0.07; st.shake = Math.max(st.shake, st.atkI === 2 ? 0.35 : 0.15); }
      else if (st.poolTellT <= 0) { st.poolTellT = 1.5; DUELS.tell(st.pose === 'sub' ? 'UNDERWATER: WAIT FOR HIM' : 'NOT NOW: DODGE FIRST!', 0.9); } }
    for (const g of P.goons) { if (!g.on || g.s === 'fly' || g.s === 'climb' || g.inv > 0) continue; const dx = g.x - st.hx, dz = g.z - st.hz, d = Math.hypot(dx, dz);
      if (d < 2.0 && (dx * fx + dz * fz) > -0.3) { any = true; g.inv = 0.15; g.hp--; sfx('hit'); st.hs = 0.06; V.set(g.x, 1.9, g.z); splash(g.x, 1.1, g.z, 5, 0);
        if (g.hp <= 0 || st.atkI === 2) launchGoon(st, g); else { g.s = 'hurt'; g.t = 0; pop(V, 'BONK!', '', 0.6); if (Math.random() < 0.3) DUELS.say('CATFISH GOON', pick(GR1.gangs.cobble_catfish.hit), 1.2); } } }
    return any;
  }
  function bankShot(st) {
    st.power = 0; subHud(st); st.stats.specials++; st.bankT = 0; st.ts = 0.35; st.tsT = 1.8; st.atkT = -1; // team-up: Mavis racks the ball to Harold, he banks it
    const e = edgePt(st.hx, st.hz); st.bk = { m: new THREE.Vector3(-6.9, 1.4, -0.4), a: new THREE.Vector3(st.hx + Math.sin(st.yaw) * 0.8, 0.55, st.hz + Math.cos(st.yaw) * 0.8), b: new THREE.Vector3(e.x, 0.55, e.z) }; DUELS.say('MAVIS', 'Racked and ready, hon!', 1.4);
    DUELS.banner('BANK SHOT!<small>OFF THE RAIL, INTO THE SHARK</small>', 1.6); sfx('heavy'); st.shake = 0.3; DUELS.log.push('poolshark:bank');
    for (const g of P.goons) if (g.on && g.s !== 'fly') launchGoon(st, g);
  }
  function stepBank(st, dt) {
    if (st.bankT < 0) return; st.bankT += dt; const t0 = st.bankT, B = st.bk, b = P.bank; b.visible = true;
    if (t0 < 0.3) { b.position.lerpVectors(B.m, B.a, t0 / 0.3); b.position.y += Math.sin(t0 / 0.3 * Math.PI) * 2; if (t0 > 0.18 && st.atkT < 0) { st.atkI = 2; st.atkT = 0; st.atkHit = true; } return; }
    const t = t0 - 0.3; if (!B.whack) { B.whack = true; sfx('heavy'); st.hs = 0.08; V.copy(B.a); V.y = 1.6; pop(V, 'WHACK!', 'g', 0.8); }
    if (t < 0.35) b.position.lerpVectors(B.a, B.b, t / 0.35);
    else { if (!B.hitE) { B.hitE = true; splash(B.b.x, 0.4, B.b.z, 8, 0); sfx('hit'); B.c = new THREE.Vector3(st.sx, st.pose === 'sub' ? WY + 0.4 : 1.2, st.sz); }
      const u = clamp((t - 0.35) / 0.3, 0, 1); b.position.lerpVectors(B.b, B.c, u); b.position.y += Math.sin(u * Math.PI) * 1.2;
      if (u >= 1 && !B.hitS) { B.hitS = true; b.visible = false; st.bankT = -1; st.shake = 0.6; st.hs = 0.12; P.balls.length = 0;
        if (st.pose === 'sub' || st.ms === 'finTell' || st.ms === 'swim' || st.ms === 'intro') { const e = edgePt(st.hx, st.hz); st.ex = e; st.sx = e.x - e.nx * 0.35; st.sz = e.z - e.nz * 0.35; st.sy = -1.0; st.syaw = Math.atan2(e.nx, e.nz); }
        if (st.ms === 'cannUp' || st.ms === 'lunge') { st.sx = st.tx; st.sz = st.tz; st.sy = 0; }
        setM(st, 'stun', 2.8); st.pose = st.sy > -0.5 ? 'deck' : 'edge'; hitShark(st, 22, 'BANK SHOT!', true); if (st.ms === 'stun') DUELS.tell('SEEING STARS: GET HIM!', 1.2); } }
  }
  P.step = function (rdt, I) {
    const st = P.st; if (!st) return;
    if (st.tsT > 0) { st.tsT -= rdt; if (st.tsT <= 0) st.ts = 1; }
    if (st.hs > 0) { st.hs -= rdt; stepFx(rdt * 0.3); popTick(rdt); return; }
    const dt = rdt * st.ts; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.poolTellT -= dt; st.chainT -= dt;
    if (!st.over) {
      // move: stick up = away from the camera (+z); screen right = world -x
      let vx = -I.mx, vz = I.my; const m = Math.hypot(vx, vz); if (m > 1) { vx /= m; vz /= m; }
      const slow = st.atkT >= 0 ? 0.25 : st.hurtT > 0 ? 0.3 : 1; st.moving = m > 0.15;
      st.hx += vx * 6.2 * slow * dt; st.hz += vz * 6.2 * slow * dt; if (st.moving && st.atkT < 0) st.yaw = dampAngle(st.yaw, Math.atan2(vx, vz), 14, dt);
      st.hx = clamp(st.hx, DX0, DX1); st.hz = clamp(st.hz, DZ0, DZ1);
      if (inPool(st.hx, st.hz, 0.35)) { const e = edgePt(st.hx, st.hz); st.hx = e.x + e.nx * 0.36; st.hz = e.z + e.nz * 0.36; }
      // hop
      if (I.b && st.hy <= 0.001 && st.hurtT <= 0) { st.vy = 7.2; sfx('jump'); }
      if (st.hy > 0 || st.vy > 0) { st.vy -= 22 * dt; st.hy = Math.max(0, st.hy + st.vy * dt); if (st.hy === 0) st.vy = 0; }
      // cane combo (auto-faces the nearest target in reach)
      if (I.a && st.hurtT <= 0 && (st.atkT < 0 || (st.atkT > COMBO[st.atkI].t * 0.6 && st.atkI < 2))) {
        st.atkI = st.atkT >= 0 || st.chainT > 0 ? Math.min(2, st.atkI + 1) : 0; if (st.atkI < 0) st.atkI = 0; st.atkT = 0; st.atkHit = false; st.stats.swings++; sfx('swing');
        let best = null, bd = 3.2; if (sharkHittable(st)) { const d = Math.hypot(st.sx - st.hx, st.sz - st.hz); if (d < bd) { bd = d; best = [st.sx, st.sz]; } }
        for (const g of P.goons) if (g.on && g.s !== 'fly') { const d = Math.hypot(g.x - st.hx, g.z - st.hz); if (d < bd) { bd = d; best = [g.x, g.z]; } }
        if (best) { st.yaw = Math.atan2(best[0] - st.hx, best[1] - st.hz); if (bd > 1.5) { st.hx += Math.sin(st.yaw) * 0.45; st.hz += Math.cos(st.yaw) * 0.45; } } }
      if (st.atkT >= 0) { st.atkT += dt; const c = COMBO[st.atkI]; if (!st.atkHit && st.atkT > c.t * 0.38) { st.atkHit = true; landSwing(st); } if (st.atkT > c.t) { st.atkT = -1; st.chainT = 0.35; if (st.atkI >= 2) st.chainT = 0; } }
      // BANK SHOT
      if (I.c) { if (st.power >= 1 && st.bankT < 0 && st.ms !== 'down' && st.ms !== 'intro') bankShot(st); else if (st.power < 1 && st.poolTellT <= 0) { st.poolTellT = 1; DUELS.tell('POWER NOT FULL YET', 0.9); } }
      // Mavis' crab cake: lands at Harold's feet, walk over it (or it reaches you)
      if (st.cake) { st.cake.t += dt; if (st.cake.t > 0.9) { st.hp = Math.min(100, st.hp + 30); V.set(st.hx, 2, st.hz); pop(V, '+30 CRAB CAKE', 'g', 1.0); st.cake = null; sfx('jump'); } }
    }
    sharkThink(st, dt); stepBalls(st, dt); stepGoons(st, dt); stepBank(st, dt); stepFx(dt); popTick(rdt);
    st.shake = Math.max(0, st.shake - rdt * 1.6);
    DUELS.bars(st.hp / 100, (st.bhp / BHP + (2 - st.phase)) / 3); DUELS.hot(st.power >= 1);
    if (st.ms === 'ko') outro(st, dt);
  };
  function dampAngle(a, b, k, dt) { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * (1 - Math.exp(-k * dt)); }
  // ---------------- the ending: a belly flop with NO splash, then he floats off on a pool float, shades down ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = P.R;
    if (!st.ko0) { st.ko0 = { x: st.sx, z: st.sz, y: st.sy }; }
    if (t < 1.3) { const u = t / 1.3; st.pose = 'flop'; st.sx = lerp(st.ko0.x, PCX, u); st.sz = lerp(st.ko0.z, PCZ, u); st.sy = lerp(st.ko0.y, WY - 0.2, u) + 5 * Math.sin(u * Math.PI); st.flopU = u; }
    else if (!st.plip) { st.plip = true; st.sy = WY - 0.25; DUELS.banner('...plip.<small>BELLY FLOP. NO SPLASH.</small>', 1.8); sfx('hit'); }
    if (t > 2.2) { st.pose = 'float'; R.float.visible = true; const k = t - 2.2; st.sx = PCX + Math.sin(k * 0.6) * 1.2; st.sz = PCZ + k * 0.35; st.syaw = Math.PI + Math.sin(k * 0.8) * 0.3;
      R.shades.position.y = damp(R.shades.position.y, 2.62, 4, dt); R.shades.position.z = damp(R.shades.position.z, 0.78, 4, dt); R.shades.rotation.x = damp(R.shades.rotation.x, 0, 4, dt);
      if (!st.saidD) { st.saidD = true; DUELS.say('THE POOL SHARK', pick(lines().defeat), 3.0); } }
    if (t > 5.2 && !st.winDone) { st.winDone = true; DUELS.bossCleared('pendry', 'poolshark-duel');
      const h = st.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('poolshark:win:' + g);
      setTimeout(() => { if (DUELS.cur === P) DUELS.over('win', 'THE POOL SHARK<br>FLOATED OFF', '<span style="color:#ffd23c;font-size:16px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · HITS TAKEN ' + h + ' · HARBOR THROWS ' + st.stats.throws + '<br>The Pendry deck is clear. Crime at Pendry: 0.'); }, SIM ? 300 : 900); }
  }
  function stepFx(dt) {
    const q = P.cam.quaternion;
    for (let i = P.fxs.length - 1; i >= 0; i--) { const p = P.fxs[i]; p.t += dt; p.v.y -= 12 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) P.fxs.splice(i, 1); }
    P.fxs.forEach((p, i) => { const s = 1 - p.t / p.life * 0.6; M4.compose(p.p, q, V.set(s, s, s)); P.fx.setMatrixAt(i, M4); }); P.fx.count = P.fxs.length; P.fx.visible = P.fxs.length > 0; P.fx.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    if (st.atkT >= 0) { const c = COMBO[st.atkI]; return HERO_POSES[c.pose](clamp(st.atkT / c.t, 0, 1)); }
    if (st.hy > 0.02) return HERO_POSES.jump(st.vy);
    if (st.moving) return HERO_POSES.run(t, 6);
    return HERO_POSES.idle(t);
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || sharkHittable(st) || st.cake ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if ((st.cake && st.cake.t < 0.4) || (st.bankT >= 0 && st.bankT < 0.3)) { p.shR = [-2.8, 0, -0.3]; } return p; }
  function poseShark(st, dt) {
    const R = P.R, t = st.t, B = R.body; let bodyRX = 0, rootY = st.sy, armL = -0.2, armR = 0.9, cueRX = 1.3, finS = 1, glow = null;
    switch (st.pose) {
      case 'sub': rootY = st.sy; bodyRX = 0.25; armL = 0.3; armR = 0.3; break;
      case 'edge': rootY = st.sy; bodyRX = 0.35; armL = -0.8 + Math.sin(t * 3) * 0.1; armR = -1.2; cueRX = 1.45;
        if (st.ms === 'cueTell') { const k = st.mt / st.mdur; armR = -1.35 - Math.sin(k * 10) * 0.15; cueRX = 1.55 + Math.sin(k * 10) * 0.1; glow = ['#ffd23c', 0.25 + 0.3 * (Math.sin(st.mt * 24) * 0.5 + 0.5)]; }
        if (st.ms === 'cueGo') { armR = -0.6; cueRX = 1.6; }
        if (st.ms === 'open' || st.ms === 'stun') { armR = -0.3 + Math.sin(t * 6) * 0.2; cueRX = 0.4; bodyRX = 0.6 + Math.sin(t * 4) * 0.05; }
        break;
      case 'air': rootY = st.sy; bodyRX = st.ms === 'lunge' ? 1.2 : -0.5 + st.mt; armL = -2.6; armR = -2.6; glow = ['#ff3d6e', 0.3]; break;
      case 'deck': rootY = 0.45 + Math.abs(Math.sin(t * 9)) * 0.12; bodyRX = Math.PI / 2; armL = -0.5 + Math.sin(t * 9) * 0.6; armR = -0.5 - Math.sin(t * 9) * 0.6; cueRX = 0.2; break;
      case 'flop': rootY = st.sy + 0.3; bodyRX = Math.PI / 2 * clamp(st.flopU * 1.6, 0, 1); armL = -1.6; armR = -1.6; break;
      case 'float': rootY = WY + 0.12 + Math.sin(t * 2) * 0.04; bodyRX = -Math.PI / 2 + 0.25; armL = -1.4 - Math.sin(t * 3) * 0.6; armR = -2.8; cueRX = 0.2; break;
    }
    if (st.ms === 'stun') { R.body.rotation.z = Math.sin(t * 8) * 0.12; if (Math.random() < 0.1) { V.set(st.sx + rnd(-0.5, 0.5), (st.pose === 'deck' ? 1.0 : 2.0), st.sz); splash(V.x, V.y, V.z, 1, 2); } } else R.body.rotation.z = damp(R.body.rotation.z, 0, 8, dt);
    R.root.position.set(st.sx, st.ms === 'cannUp' || st.ms === 'lunge' || st.pose === 'flop' ? rootY : damp(R.root.position.y, rootY, 12, dt), st.sz);
    if (st.pose === 'deck' && st.ms !== 'return') R.root.position.y = rootY;
    R.root.rotation.y = st.pose === 'air' && st.ms === 'cannUp' ? st.syaw : dampAngle(R.root.rotation.y, st.pose === 'edge' || st.pose === 'deck' && st.ms === 'beached' ? st.syaw : st.syaw, 10, dt);
    if ((st.ms === 'beached' || st.ms === 'stun') && st.pose === 'deck') R.root.rotation.y = dampAngle(R.root.rotation.y, Math.atan2(st.hx - st.sx, st.hz - st.sz), 3, dt);
    B.rotation.x = damp(B.rotation.x, bodyRX, st.pose === 'flop' ? 30 : 10, dt);
    R.armL.rotation.x = damp(R.armL.rotation.x, armL, 12, dt); R.armR.rotation.x = damp(R.armR.rotation.x, armR, 12, dt); R.cue.rotation.x = damp(R.cue.rotation.x, cueRX, 12, dt);
    R.cue.visible = st.pose !== 'float' && st.pose !== 'flop'; R.fin.scale.setScalar(finS);
    for (const m of R.mats) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow) for (const m of R.mats) if (m && m.userData.flash) { m.userData.flashC.value.set(glow[0]); m.userData.flash.value = Math.max(m.userData.flash.value, glow[1]); }
  }
  function poseTells(st, dt) {
    // aim lines while the cue tell runs (+ fading through the break)
    const showAim = st.ms === 'cueTell' || (st.ms === 'cueGo' && st.mt < 0.25);
    P.aims.forEach((m, i) => { const a = st.aims[i]; if (!showAim || a === undefined) { m.visible = false; m.material.opacity = 0; return; }
      const L = 15, x = st.ex.x + Math.sin(a) * L / 2, z = st.ex.z + Math.cos(a) * L / 2; m.visible = true; m.position.set(x, 0.05, z); m.rotation.set(-Math.PI / 2, 0, a + Math.PI); m.scale.set(1, L, 1);
      m.material.map.repeat.set(1, L / 2); m.material.map.offset.y = -st.t * 3; m.material.opacity = st.ms === 'cueGo' ? 0.4 : 0.35 + 0.35 * (Math.sin(st.t * 22) * 0.5 + 0.5); });
    // cannonball: shadow + landing ring on the target
    const cann = st.ms === 'cannUp'; P.shadow.visible = cann; P.landR.visible = cann || (st.ms === 'lunge');
    if (cann) { const u = st.mt / st.mdur; P.shadow.position.set(st.tx, 0.04, st.tz); P.shadow.material.opacity = 0.2 + 0.45 * u; P.shadow.scale.setScalar(0.5 + 0.7 * u);
      P.landR.position.set(st.tx, 0.06, st.tz); P.landR.scale.setScalar(1.7); P.landR.material.opacity = 0.5 + 0.4 * Math.sin(st.t * 25); }
    // fin circle: a red ring closing round Harold (locks for the last 0.45 s)
    P.finR.visible = st.ms === 'finTell' || st.ms === 'lunge';
    if (P.finR.visible) { const u = st.ms === 'lunge' ? 1 : clamp(st.mt / st.mdur, 0, 1); P.finR.position.set(st.tx, 0.07, st.tz); P.finR.scale.setScalar(lerp(3.4, 1.5, u)); P.finR.rotation.z += dt * 3;
      P.finR.material.color.set(st.mdur - st.mt < 0.45 || st.ms === 'lunge' ? '#ff2040' : '#ff8a9a'); P.finR.material.opacity = 0.55 + 0.35 * Math.sin(st.t * (u > 0.7 ? 30 : 12)); }
    if (st.ms === 'lunge') { P.landR.position.set(st.tx, 0.06, st.tz); P.landR.scale.setScalar(1.6); P.landR.material.opacity = 0.8; }
    // the wave
    const w = st.wave; P.waveM.visible = P.waveR.visible = !!w;
    if (w) { P.waveM.position.set(w.x, 0.12, w.z); P.waveM.scale.set(w.r, w.r, 1 + Math.min(1.5, w.r * 0.15)); P.waveM.material.opacity = clamp(1.2 - w.r / 15, 0, 0.85);
      P.waveR.position.set(w.x, 0.05, w.z); P.waveR.scale.setScalar(w.r + 0.3); P.waveR.material.opacity = clamp(1 - w.r / 15, 0, 0.6); }
    // goons
    for (const g of P.goons) { if (!g.on) continue; const r = g.R.root; r.position.set(g.x, g.y, g.z); r.rotation.y = g.yaw;
      if (g.s === 'fly') { r.rotation.x += dt * 12; } else r.rotation.x = 0;
      g.R.arm.rotation.x = g.s === 'wind' ? -2.6 + Math.sin(g.t * 30) * 0.15 : g.s === 'swipe' ? 0.6 : Math.sin(st.t * 8 + g.x) * 0.4;
      const m = g.R.mat; if (m && m.userData.flash) { if (g.s === 'wind') { m.userData.flashC.value.set('#3fe0c8'); m.userData.flash.value = 0.25 + 0.35 * (Math.sin(g.t * 26) * 0.5 + 0.5); } else if (g.s === 'hurt') { m.userData.flashC.value.set('#ffffff'); m.userData.flash.value = 0.7; } else m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4); } }
  }
  P.render = function (rdt) {
    const st = P.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.hs > 0 ? 0.15 : st.ts), t = st.t;
    const H = P.H; H.root.position.set(st.hx, st.hy, st.hz); H.root.rotation.y = st.yaw; applyPose(H, haroldPose(st, t), 18, dt, false);
    if (P.hflash > 0) { P.hflash = Math.max(0, P.hflash - dt * 5); H.mat.userData.flash.value = P.hflash * 0.8; } else if (st.inv > 0) H.mat.userData.flash.value = Math.sin(st.t * 40) > 0 ? 0.25 : 0;
    const M = P.M; M.root.position.set(-6.9, 0, -0.4); M.root.rotation.y = 1.2; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseShark(st, dt); poseTells(st, dt);
    if (P.water.material.map) { P.water.material.map.offset.x = t * 0.03; P.water.material.map.offset.y = Math.sin(t * 0.7) * 0.05; }
    // camera: 3/4 view from the south end of the deck, following Harold, pulled up + back in portrait; BANK SHOT punches in; the KO frames the pool
    const port = VH() > VW(); P.cam.fov = port ? 62 : 50; P.cam.updateProjectionMatrix();
    const fx = st.hx * 0.6, fz = lerp(1.5, st.hz, 0.55);
    V.set(fx, port ? 12.5 : 8.6, fz - (port ? 11 : 10.5)); V2.set(fx, 0, fz + (port ? 3.6 : 3.0));
    if (st.ms === 'intro' && st.phase === 0) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V.clone().set(0, 7, 16), V, k); V2.lerpVectors(V2.clone().set(0, 0, 2), V2, k); }
    if (st.bankT >= 0) { V.lerp(V2.clone().set(st.hx, 3, st.hz - 4), 0.45); }
    if (st.ms === 'ko') { V.set(st.sx * 0.5, 7.5, st.sz - 9); V2.set(st.sx, 0, st.sz); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.5; V.y += rnd(-1, 1) * st.shake * 0.5; }
    P.camP.lerp(V, 1 - Math.exp(-6 * dt / Math.max(0.2, st.ts))); P.camL.lerp(V2, 1 - Math.exp(-6 * dt / Math.max(0.2, st.ts))); P.cam.position.copy(P.camP); P.cam.lookAt(P.camL);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 40; OUT_U.fogF.value = 140;
  };
  P.onResize = () => {};

  // ---------------- test bot: win = reads every tell, chases openings, hops waves/balls, banks when full; lose = stands still ----------------
  P.botThink = function (B, dt) {
    const st = P.st; if (!st || st.over) return; B.mx = 0; B.my = 0; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt; B.jcd = (B.jcd || 0) - dt;
    let gx = null, gz = null, flee = null;
    const go = (x, z) => { gx = x; gz = z; };
    const left = st.mdur - st.mt;
    if (st.ms === 'cannUp') { const d = Math.hypot(st.hx - st.tx, st.hz - st.tz); if (d < 3.2) flee = [st.hx - st.tx, st.hz - st.tz]; }
    if (st.ms === 'finTell' && left < 0.5 || st.ms === 'lunge') { const d = Math.hypot(st.hx - st.tx, st.hz - st.tz); if (d < 2.6) flee = [st.hx - st.tx || 1, st.hz - st.tz || -1]; }
    if ((st.ms === 'cueTell' && left < 0.5) || st.ms === 'cueGo') { // step sideways off the nearest aim line
      let best = null, bd = 9; for (const a of st.aims) { const dx = st.hx - st.ex.x, dz = st.hz - st.ex.z, along = dx * Math.sin(a) + dz * Math.cos(a), perp = dx * Math.cos(a) - dz * Math.sin(a); if (along > 0 && Math.abs(perp) < bd) { bd = Math.abs(perp); best = [a, perp]; } }
      if (best && bd < 1.1) { const s = best[1] >= 0 ? 1 : -1; flee = [Math.cos(best[0]) * s, -Math.sin(best[0]) * s]; } }
    for (const b of P.balls) { if (b.t < 0) continue; const d = Math.hypot(st.hx - b.x, st.hz - b.z), ahead = (st.hx - b.x) * b.dx + (st.hz - b.z) * b.dz; if (d < 1.15 && ahead > 0 && B.jcd <= 0 && st.hy === 0) { B.b = true; B.jcd = 0.5; } }
    if (st.wave) { const d = Math.hypot(st.hx - st.wave.x, st.hz - st.wave.z); if (d > st.wave.r && d - st.wave.r < 0.9 && B.jcd <= 0 && st.hy === 0) { B.b = true; B.jcd = 0.5; } }
    if (st.power >= 1 && st.bankT < 0 && st.ms !== 'down' && st.ms !== 'intro' && !flee) B.c = true;
    if (!flee) {
      if (sharkHittable(st)) { const e = st.pose === 'edge' ? edgePt(st.sx, st.sz) : null; if (e) go(e.x + e.nx * 1.0, e.z + e.nz * 1.0); else go(st.sx, st.sz); if (Math.hypot(st.sx - st.hx, st.sz - st.hz) < 2.3 && B.cd <= 0) { B.a = true; B.cd = 0.16; } }
      else { let g = null, gd = 7; for (const o of P.goons) if (o.on && o.s !== 'fly' && o.s !== 'climb') { const d = Math.hypot(o.x - st.hx, o.z - st.hz); if (d < gd) { gd = d; g = o; } }
        if (g) { go(g.x, g.z); if (gd < 1.8 && B.cd <= 0) { B.a = true; B.cd = 0.18; } } else go(0, -3.5); }
    }
    let dx = 0, dz = 0; if (flee) { dx = flee[0]; dz = flee[1]; } else if (gx !== null) { dx = gx - st.hx; dz = gz - st.hz; if (Math.hypot(dx, dz) < 0.9) dx = dz = 0; }
    const l = Math.hypot(dx, dz); if (l > 0.01) { B.mx = -dx / l; B.my = dz / l; }
  };

  DUELS.reg('poolshark', P); window.__poolshark = P;
  // entrance: the ring at the Pendry boss anchor (LANDMARKS 'pendry' .boss = 126, -19.5, DESIGN.md roster: Pendry: The Pool Shark)
  const L = LANDMARKS.find((l) => l.id === 'pendry'); if (L && L.boss) DUELS.addTrigger('poolshark', L, L.boss.x, L.boss.z, L.boss.x, L.boss.z - 2.2, '#39d8ff');
  // ?poolshark=1 starts it straight away; &poolsharkauto=win|lose plays it with the bot
  if (Q.has('poolshark')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('poolsharkauto'); DUELS.start('poolshark', m === 'win' || m === 'lose' ? { bot: m } : {}); } }); }
})();

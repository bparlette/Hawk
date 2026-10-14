
// ======================= THE PENTHOUSE PIGEON, WORLD TRADE CENTER (boss 16): a Rampage-style climb, then a ground fight (DESIGN.md "Additions (Brad, 2026-10-12 09:54)").
// Runs as a DUELS kind (09a_duel_core.js: own scene + camera, HUD, input, bot, RETRY / LEAVE, radio duck, exit back to the street).
// PART 1, THE CLIMB: Harold clings to the five-sided tower (the city WTC's look: tan precast spandrels, dark ribbon glass, solid corner piers, crown band).
//   Stick / WASD climbs; going past a corner swings him round onto the next face. SMASH (cane) breaks the window at his chest: points pop up and each
//   window hides something, seeded per run: a crab cake (health), a thug (TONGUE-grab to eat him for health, or SMASH him off the wall: Mavis, down on
//   the promenade, bats every falling thug into the harbor), a frying pan swung at Harold's face (move off that window), or, about 1 in 40 and at most
//   one per face, the golden crab mallet: the next SMASH breaks that whole floor. Every face has a damage meter shown as spreading cracks (one cheap
//   alpha-tested decal per face); all 5 faces must be wrecked. Hazards: the Pigeon walks the roof edge dropping poop (a shadow on the wall shows where it
//   will land; a hit knocks Harold down a floor) and circles out on bombing runs: when he swoops close, SMASH (punch) or TONGUE-grab him for big damage,
//   or he pecks. A police helicopter strafes the wall with a spotlight (it fires when the light sits on Harold; SMASH it when it swings in close: it spins
//   off for bonus points). Sparking live-wire windows zap on a smash or a grab. Harbor-patrol boats spray water cannons from below that shove Harold
//   sideways. Window-washer platforms knock him off when they come down on him, or carry him up when he steps on a rising one.
//   All 5 faces wrecked: Harold leaps clear onto the promenade, the tower crumbles top-down into a dust cloud, and a score tally rolls.
// PART 2, THE GROUND FIGHT on the promenade by the rubble: walking head-bob pecks (he leaves slippery poop puddles), bombing runs with ground shadows,
//   and the opening: when he dives low, TONGUE-grab him, Harold slams him down, then SMASH combos while he is dazed. At 0 HP he is dizzy: knock him
//   into the harbor to finish.
// The tower only falls inside this set piece: the city WTC (03b_landmarks_hd.js / parts/h_landmarks.js) is never touched, so it is intact afterwards.
// Win = BOSS_CLEAR.clear('wtc') (DUELS.bossCleared). Lose = RETRY from the part reached (part 1 keeps the faces already wrecked) or LEAVE.
// Entry: ACT "CLIMB WTC" on the glowing ring at the WTC base (north side, the Pratt St promenade). Tests: ?pigeon=1 (&pigeonpart=2 starts the ground
// fight), &pigeonauto=win|lose plays it (the duel bot), &pigeonquick=1 (a third of the face damage needed), &pigeonseed=N (window contents).
// Controls: stick / WASD climb (part 1) or walk (part 2); the white buttons climb DOWN / UP; SWING (J, pad X) = SMASH; JUMP (K, pad A) = a hop (part 1: a
// quick leap a floor up or sideways along the wall); ACT (E, pad Y) = TONGUE (the set-piece-only tongue-grab verb).
// RIG HOOK (Opus delivers the real pigeon to this exact contract): window.buildPenthousePigeon({ THREE, toonMat, outlineMat, QUAL }) returns
//   { root, wings: [L, R], head, update?(dt, st) }. root: Object3D, feet at y 0, facing +z, about 2.4 m tall (scaled to 2.4 m by its bounding box if not).
//   wings[0] is the bird's LEFT wing (+x side), wings[1] its right (-x); each is a pivot at the shoulder: the game sets rotation.z (+ raises the left
//   wing, - raises the right). head: a pivot at the neck: the game sets rotation.x (peck / bob) and position.z offsets (head-bob).
//   update(dt, st) is called every frame if present, st = { mode, t, part, hp } with mode one of perch | walk | circle | swoopTell | swoop | hurt | return |
//   peckTell | peck | takeoff | bomb | divePrep | dive | grabbed | slam | dazed | land | finish | splash | flee. The procedural stand-in below meets the same contract.
const buildPenthousePigeonStandIn = function ({ THREE, toonMat }) {
  const K = () => DUELS.kit(), G = DUELS.GEO, root = new THREE.Group(), mat = toonMat();
  const body = K();
  body.add(G.sph(0.78, 14, 10), '#8d93a6', 0, 1.15, 0, 0, 0, 0, 1, 0.92, 1.22) // round grey body
    .add(G.sph(0.6, 12, 9), '#b4b9c8', 0, 1.2, 0.42, 0, 0, 0, 1, 1, 0.8) // pale chest
    .add(G.sph(0.8, 14, 10), '#6a1f2e', 0, 1.0, 0.05, 0, 0, 0, 1.04, 0.62, 1.16) // the burgundy smoking jacket
    .add(G.box(0.12, 0.6, 0.05), '#e0b84a', 0.2, 1.15, 0.86, -0.25, 0, 0.35).add(G.box(0.12, 0.6, 0.05), '#e0b84a', -0.2, 1.15, 0.86, -0.25, 0, -0.35) // gold lapels
    .add(G.cyl(0.03, 0.03, 0.5, 6), '#e8c860', 0, 0.95, 0.9, 0, 0, Math.PI / 2) // a watch chain
    .add(G.box(0.95, 0.08, 0.7), '#4a4f5e', 0, 1.15, -1.05, -0.35, 0, 0).add(G.box(0.8, 0.06, 0.5), '#2e323c', 0, 1.05, -1.35, -0.45, 0, 0); // tail fan
  for (const s of [-1, 1]) body.add(G.cyl(0.07, 0.06, 0.55, 6), '#d86a7a', s * 0.26, 0.3, 0.1).add(G.box(0.26, 0.06, 0.34), '#c85a6a', s * 0.26, 0.03, 0.2);
  const bm = body.mesh(mat, root, 0.0035);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0.42); root.add(head);
  const hk = K(); hk.add(G.sph(0.4, 12, 9), '#3f8a6e', 0, -0.2, 0, 0, 0, 0, 1, 1.1, 0.9) // iridescent neck
    .add(G.tor(0.34, 0.06, TAU, 6, 14), '#7a4a9a', 0, -0.32, 0, Math.PI / 2, 0, 0)
    .add(G.sph(0.34, 12, 9), '#9aa0b2', 0, 0.12, 0.08) // head
    .add(G.cone(0.1, 0.36, 7), '#c8b8a0', 0, 0.06, 0.5, Math.PI / 2, 0, 0).add(G.sph(0.08, 8, 6), '#f0ece0', 0, 0.14, 0.38) // beak + cere
    .add(G.box(0.36, 0.08, 0.1), '#d8c070', 0, -0.36, 0.3); // ascot knot
  for (const s of [-1, 1]) hk.add(G.sph(0.09, 8, 6), '#ff8a2a', s * 0.2, 0.2, 0.3).add(G.sph(0.045, 6, 5), '#14101f', s * 0.22, 0.21, 0.37);
  hk.add(G.tor(0.11, 0.02, TAU, 5, 12), '#e8c860', -0.21, 0.2, 0.39); // a gold monocle
  hk.mesh(mat, head, 0.0035);
  const wings = [1, -1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.62, 1.42, -0.05); root.add(w);
    const wk = K(); wk.add(G.sph(0.6, 10, 7), '#868c9e', s * 0.75, 0, -0.1, 0, 0, 0, 1.25, 0.16, 0.7).add(G.box(0.7, 0.05, 0.12), '#3a3e4a', s * 0.85, 0.07, -0.05).add(G.box(0.6, 0.05, 0.1), '#3a3e4a', s * 0.85, 0.07, -0.3)
      .add(G.sph(0.4, 8, 6), '#5a6070', s * 1.45, -0.02, -0.25, 0, 0, 0, 0.9, 0.12, 0.9); // dark primaries
    wk.mesh(mat, w, 0.0035); return w; });
  return { root, wings, head, mat, flash: [mat] };
};
(function () {
  const P = { scene: null, cam: null, title: 'PENTHOUSE PIGEON', pips: 1,
    hint: '<b>WASD</b> climb / walk · <b>J</b> smash · <b>K</b> jump · <b>E</b> tongue-grab',
    labels: { a: 'SMASH', b: 'JUMP', c: 'TONGUE', l: '&#9660; DOWN', r: 'UP &#9650;' } };
  const LM = 'wtc'; // the WTC district id in LANDMARKS / BOSS_CLEAR
  const QUICK = Q.has('pigeonquick');
  // ---------------- the tower (set-piece coords: the tower axis at the origin, north = -z = the Pratt St land, harbour on the other sides) ----------------
  const R = 8.2, ROT = 0.3, NF = 12, FL = 3.0, Y0 = 5.0, NC = 5, PIER = 0.9;
  const AP = R * Math.cos(Math.PI / 5), LEN = 2 * R * Math.sin(Math.PI / 5), CW = (LEN - 2 * PIER) / NC, PER = LEN * 5;
  const TOPY = Y0 + NF * FL, CROWN = 3.6, ROOFY = TOPY + CROWN, YMIN = Y0 + 0.25, YMAX = Y0 + (NF - 1) * FL + 0.3;
  const GR = 20, LANDZ = -7.5, C2 = { x: 0, z: 13.2, r: 6.4 }, RUB = 9.6; // promenade disk radius, land north of LANDZ, the ground-fight ring, rubble radius
  const isWater = (x, z) => Math.hypot(x, z) > GR && z > LANDZ;
  const DMG_WIN = QUICK ? 0.22 : 1 / 13, DMG_WALL = QUICK ? 0.06 : 0.02, DMG_FLOOR = 0.45;
  const VX = [], FACE = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + ROT; VX.push([Math.sin(a) * R, Math.cos(a) * R]); }
  for (let i = 0; i < 5; i++) { const [ax, az] = VX[i], [bx, bz] = VX[(i + 1) % 5], tx = (bx - ax) / LEN, tz = (bz - az) / LEN; let nx = tz, nz = -tx;
    if ((ax + bx) * nx + (az + bz) * nz < 0) { nx = -nx; nz = -nz; } FACE.push({ ax, az, tx, tz, nx, nz }); }
  const wrapS = (s) => ((s % PER) + PER) % PER;
  const dS = (a, b) => { let d = wrapS(a) - wrapS(b); if (d > PER / 2) d -= PER; if (d < -PER / 2) d += PER; return d; }; // signed shortest a - b round the tower
  const _w = { x: 0, z: 0, nx: 0, nz: 0, f: 0, u: 0 };
  function onWall(s, off, out = _w) { // a point on the wall at perimeter s, pushed `off` metres out (corners round off: Harold swings round them)
    s = wrapS(s); const f = Math.min(4, Math.floor(s / LEN)), u = s - f * LEN, F = FACE[f]; let nx = F.nx, nz = F.nz;
    const c = u < 0.7 ? u : LEN - u < 0.7 ? LEN - u : -1;
    if (c >= 0) { const Gf = FACE[u < 0.7 ? (f + 4) % 5 : (f + 1) % 5], k = 0.5 * (1 - c / 0.7); nx = lerp(nx, Gf.nx, k); nz = lerp(nz, Gf.nz, k); const l = Math.hypot(nx, nz); nx /= l; nz /= l; off += (1 - c / 0.7) * 0.5; }
    out.x = F.ax + F.tx * u + nx * off; out.z = F.az + F.tz * u + nz * off; out.nx = nx; out.nz = nz; out.f = f; out.u = u; return out;
  }
  const winS = (f, c) => f * LEN + PIER + (c + 0.5) * CW, winY = (k) => Y0 + k * FL + 1.9, WI = (f, k, c) => (f * NF + k) * NC + c;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4(), QQ = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // ---------------- writing (Grok GR6 + the GR1 boss lines on the landmark) ----------------
  const TXT = {
    taunts: ["Coo! Climbing up here with that cane? Bold move, gramps.", "The penthouse is MINE. The view, the breadcrumbs, all of it.", "Watch your step! That ledge is older than you.", "I've got the high ground and the high crumbs.", "Down below you're a toad. Up here you're a snack.", "Flap flap! Oh wait, you can't. Ha!", "Every window on this tower knows my name.", "Penthouse rules: no frogs, no toads, no exceptions.", "You call that climbing? I've seen moss move faster.", "Coo-coo! Here comes a flowerpot. Duck!", "My grandpappy roosted here. His grandpappy too.", "The wind's picking up, toad. Hope you're glued on.", "I can see the whole harbor. And you, sweating.", "Halfway there? Cute. The top half is the hard half.", "Leave now and I'll only drop a little on your hat.", "Coo! You made it this far? Okay, now I'm nervous."],
    popups: ["Hey! I'm watching my stories!", "Get off my window box, you toad!", "Is that a toad? On the 20th floor?", "Hon, call somebody. There's a toad!", "Don't touch the tomatoes!", "Shoo! Shoo! This is a nice building!", "Want some lemonade? No? Okay then.", "I'm calling the super!", "Mind the laundry line, sweetie!", "Climbing again, Harold? At your age?", "You dropped your cane? Here, catch!", "Go get that pigeon, hon!"],
    score: ["LEDGE GRAB!", "WINDOW DODGE!", "NO-SLIP CLIMB!", "FLOWERPOT DODGED!", "HALFWAY UP!", "PENTHOUSE REACHED!", "PIGEON PLUCKED!", "SKYLINE CHAMPION!"],
    ground: ["Coo! Nobody knocks down MY tower!", "You'll pay for every window, toad!", "Down here I still out-strut you.", "My penthouse! My view! My crumbs!"],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lines = () => { const L = LANDMARKS.find((l) => l.id === LM); return L && L.boss && L.boss.lines; };

  // ---------------- HUD extras: point pop-ups + the score tally ----------------
  const css = document.createElement('style');
  css.textContent = `#duel .ppop { position: absolute; left: 0; top: 0; font-size: 13px; color: #ffd23c; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; opacity: 0; transform: translate(-50%, -50%); }
  #duel .ppop.g { color: #9dff6b; } #duel .ppop.r { color: #ff6a7a; } #duel .ppop.b { font-size: 17px; color: #fff3a0; }
  #duel .ptally { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); background: rgba(20,16,31,.86); border: 3px solid #ffd23c; box-shadow: 4px 4px 0 #000; border-radius: 12px; padding: 10px 14px; width: min(330px, 86vw); box-sizing: border-box; display: none; font-size: 10px; line-height: 1.9; }
  @media (max-width: 480px) { #duel .ptally { font-size: 8px; } #duel .ptally h3 { font-size: 13px; } }
  #duel .ptally.on { display: block; } #duel .ptally h3 { margin: 0 0 6px; font-size: 15px; color: #ffd23c; text-align: center; font-weight: normal; }
  #duel .ptally div { display: flex; justify-content: space-between; gap: 10px; white-space: nowrap; opacity: 0; transition: opacity .2s; } #duel .ptally div.on { opacity: 1; } #duel .ptally div.t { color: #9dff6b; border-top: 2px solid #ffd23c; margin-top: 4px; font-size: 13px; }
  body.duel-pigeon #duel .dtell { top: 70%; }
  #duel .pfaces { display: inline-flex; gap: 3px; vertical-align: middle; } #duel .pfaces i { display: block; width: 16px; height: 8px; background: #14101f; border: 1px solid #000; position: relative; overflow: hidden; }
  #duel .pfaces i b { position: absolute; left: 0; top: 0; bottom: 0; background: #ff9a3a; } #duel .pfaces i.on { outline: 2px solid #fff; } #duel .pfaces i.done b { background: #9dff6b; }`;
  document.head.appendChild(css);
  let POPS = [], TALLY = null;
  function hudBits() {
    if (POPS.length) return;
    for (let i = 0; i < 8; i++) { const e = document.createElement('div'); e.className = 'ppop'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 9, p: new THREE.Vector3() }); }
    TALLY = document.createElement('div'); TALLY.className = 'ptally'; DUELS.hudEl.appendChild(TALLY);
  }
  let popI = 0;
  function pop(text, p, cls = '') { const o = POPS[popI++ % POPS.length]; o.e.textContent = text; o.e.className = 'ppop ' + cls; o.p.copy(p); o.t = 0; }
  function popTick(dt) {
    const w = DUELS.hudEl.clientWidth || VW(), h = DUELS.hudEl.clientHeight || VH();
    for (const o of POPS) { if (o.t > 1.1) { if (o.e.style.opacity !== '0') o.e.style.opacity = '0'; continue; } o.t += dt;
      V.copy(o.p); V.y += o.t * 1.4; V.project(P.cam); if (V.z > 1) { o.e.style.opacity = '0'; continue; }
      o.e.style.left = ((V.x * 0.5 + 0.5) * w).toFixed(0) + 'px'; o.e.style.top = ((-V.y * 0.5 + 0.5) * h).toFixed(0) + 'px'; o.e.style.opacity = String(clamp(1.4 - o.t * 1.3, 0, 1)); }
  }

  // ---------------- textures ----------------
  function crackTex(seed) { return canvasTex(160, 600, (g, w, h) => { // alpha map: grey level = how early a crack shows (white first); alphaTest reveals it as the face takes damage
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rng(seed), segs = [], NS = 14;
    for (let j = 0; j < NS; j++) { const x0 = w * (0.1 + r() * 0.8), y0 = h * (0.05 + r() * 0.9); let a = r() * TAU;
      for (let b = 0; b < 3; b++) { let x = x0, y = y0, aa = a + b * 2.1 + r() * 0.6; for (let gN = 0; gN < 9; gN++) { const l = 10 + r() * 22, nx = x + Math.cos(aa) * l, ny = y + Math.sin(aa) * l;
        segs.push({ x, y, nx, ny, v: 1 - clamp(0.55 * j / NS + 0.42 * gN / 9, 0, 0.97), wd: Math.max(1.2, 5 - gN * 0.45) }); x = nx; y = ny; aa += (r() - 0.5) * 1.1;
        if (r() < 0.22) { let bx = x, by = y, ba = aa + (r() < 0.5 ? 1 : -1) * 1.1; for (let q = 0; q < 3; q++) { const l2 = 8 + r() * 12, ex = bx + Math.cos(ba) * l2, ey = by + Math.sin(ba) * l2; segs.push({ x: bx, y: by, nx: ex, ny: ey, v: 1 - clamp(0.55 * j / NS + 0.42 * (gN + q + 1) / 9, 0, 0.97), wd: 1.4 }); bx = ex; by = ey; ba += (r() - 0.5); } } } } }
    segs.sort((a, b) => a.v - b.v); g.lineCap = 'round';
    for (const s of segs) { const c = Math.round(s.v * 255); g.strokeStyle = `rgb(${c},${c},${c})`; g.lineWidth = s.wd; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.nx, s.ny); g.stroke(); }
  }, 600); }
  function brickTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7a3e30'; g.fillRect(0, 0, w, h); const r = rng(7);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 9; x++) { const o = (y % 2) * 14; g.fillStyle = ['#a65a44', '#94503c', '#b0644c', '#8a4634'][Math.floor(r() * 4)]; g.fillRect(x * 29 + o - 14, y * 16 + 1, 27, 14); } }, 256); }

  // ---------------- build ----------------
  P.build = function () {
    hudBits();
    const sc = (P.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#c4cdd2', 70, 230);
    P.cam = new THREE.PerspectiveCamera(55, VW() / VH(), 0.2, 400);
    DUELS.sceneLights(sc, '#e4ecff', '#8a7f74', 1.35, '#fff1d6', 1.9, new THREE.Vector3(-0.5, 1.4, 0.7));
    const K = DUELS.kit, G = DUELS.GEO;
    // sky: a back-faced sphere, afternoon blue to a warm haze
    { const sk = new THREE.SphereGeometry(300, 24, 12).toNonIndexed(), sp = sk.attributes.position, cc = new Float32Array(sp.count * 3), c0 = new THREE.Color('#4a86c8'), c1 = new THREE.Color('#a8c8dc'), c2 = new THREE.Color('#e4dccb');
      for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / 300, c = y > 0.08 ? c1.clone().lerp(c0, clamp((y - 0.08) * 2.2, 0, 1)) : c2.clone().lerp(c1, clamp(y * 12, 0, 1)); cc.set([c.r, c.g, c.b], i * 3); }
      sk.setAttribute('color', new THREE.BufferAttribute(cc, 3)); sc.add(new THREE.Mesh(sk, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))); }
    // water + the promenade pier (brick) + the land to the north (Pratt St) + a distant skyline (one merged mesh each)
    const wt = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: '#2f6a8a', emissive: '#10283a' })); wt.rotation.x = -Math.PI / 2; wt.position.y = -0.7; sc.add(wt);
    const bt = brickTex(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(9, 9);
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(GR, GR, 1.4, 48), new THREE.MeshLambertMaterial({ map: bt })); pier.position.y = -0.7; sc.add(pier);
    const land = K(); land.add(G.box(240, 1.4, 120), '#5c5c62', 0, -0.7, LANDZ - 60).add(G.box(240, 0.06, 1.2), '#e8e0c0', 0, 0.01, LANDZ - 9).add(G.box(240, 0.3, 6), '#9a948a', 0, 0.15, LANDZ - 3);
    const sr = rng(41); for (let i = 0; i < 46; i++) { const a = -Math.PI * 0.95 + sr() * Math.PI * 1.9, d = 95 + sr() * 70, x = Math.sin(a) * d, z = -Math.abs(Math.cos(a)) * d - 20, w = 8 + sr() * 14, h = 12 + sr() * (sr() < 0.25 ? 70 : 35);
      land.add(G.box(w, h, w * (0.7 + sr() * 0.6)), ['#8a96a6', '#a49a8a', '#6e7a8a', '#b8b0a0', '#7a8696'][Math.floor(sr() * 5)], x, h / 2, z); }
    for (const [x, z] of [[-60, 70], [70, 60], [10, 110]]) land.add(G.box(30, 6, 60), '#6a7a5a', x, 2.4, z); // the far shores
    sc.add(land.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), null, 0));
    // promenade rail + lamps along the pier edge (one mesh)
    const rail = K(); for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, x = Math.sin(a) * (GR - 0.3), z = Math.cos(a) * (GR - 0.3); if (z < LANDZ + 1) continue; rail.add(G.cyl(0.05, 0.05, 1.0, 5), '#2a2a30', x, 0.5, z); if (i % 5 === 0 && z < 6) rail.add(G.cyl(0.07, 0.09, 4, 6), '#22262c', x * 0.97, 2, z * 0.97).add(G.sph(0.25, 8, 6), '#fff4c8', x * 0.97, 4.1, z * 0.97); }
    rail.add(G.tor(GR - 0.3, 0.04, TAU, 4, 64), '#2a2a30', 0, 1.0, 0, Math.PI / 2, 0, 0); P.rail = rail.mesh(toonMat(), sc, 0);
    // ---- the climb tower (the city WTC's look) in one group: static mesh + instanced windows + 5 crack decals
    const TG = (P.towerG = new THREE.Group()); sc.add(TG);
    const T = K(), TAN = '#cfba92', TAN2 = '#b8a27c';
    const pent = (rad, y0, h, col) => T.add(G.cyl(rad, rad, h, 5), col, 0, y0 + h / 2, 0, 0, ROT, 0);
    pent(R + 0.6, 0, 0.6, '#8a8278'); pent(R - 0.8, 0.6, Y0 - 0.6, '#28323c'); pent(R - 0.25, Y0, NF * FL, '#22343a');
    for (let k = 0; k < NF; k++) pent(R * 1.02, Y0 + k * FL, 0.9, k % 4 === 0 ? TAN2 : TAN);
    pent(R * 1.02, TOPY, CROWN, TAN); pent(R - 0.6, ROOFY, 1.2, TAN2); pent(R - 0.35, ROOFY + 1.2, 0.3, '#e0d2b4');
    for (const [x, z] of VX) T.add(G.box(1.25, ROOFY - 0.6, 1.25), TAN, x * 0.99, 0.6 + (ROOFY - 0.6) / 2, z * 0.99, 0, Math.atan2(x, z) + Math.PI / 4, 0);
    for (let i = 0; i < 5; i++) { const F = FACE[i]; for (let u = 1.8; u < LEN - 1.4; u += 1.6) T.add(G.box(0.3, Y0 - 0.6, 0.3), '#9a9288', F.ax + F.tx * u + F.nx * -0.4, 0.6 + (Y0 - 0.6) / 2, F.az + F.tz * u + F.nz * -0.4); }
    T.add(G.box(4, 2.3, 4), '#9a8e78', 0, ROOFY + 1.5 + 1.15, 0).add(G.cyl(0.08, 0.1, 6, 6), '#c8c8c0', 1.4, ROOFY + 3.8 + 3, 0).add(G.cyl(0.06, 0.08, 3.5, 6), '#c8c8c0', -1.6, ROOFY + 3.8 + 1.75, 0.9);
    // the granite name wall facing the promenade (north)
    T.add(G.box(10, 2.2, 0.6), '#958b80', 0, 1.1, -(AP + 1.6));
    P.towerMesh = T.mesh(toonMat(), TG, 0.003);
    { const sg = canvasTex(1024, 64, (g, w, h) => { g.fillStyle = '#958b80'; g.fillRect(0, 0, w, h); g.fillStyle = '#d6b25a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '500 40px ' + SERIF; g.fillText('THE WORLD TRADE CENTER \u00b7 BALTIMORE', w / 2, h / 2 + 2); }, 1024);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.58), new THREE.MeshLambertMaterial({ map: sg })); s.position.set(0, 1.2, -(AP + 1.92)); s.rotation.y = Math.PI; TG.add(s); }
    // windows: 300 instances, one draw call; per-instance colour = state (glass / sky glint / broken / live wire)
    const NW = 5 * NF * NC; P.win = new THREE.InstancedMesh(new THREE.BoxGeometry(CW - 0.16, 1.86, 0.12), new THREE.MeshLambertMaterial({ color: '#ffffff' }), NW);
    P.win.frustumCulled = false; TG.add(P.win);
    for (let f = 0; f < 5; f++) { const F = FACE[f], ry = Math.atan2(F.nx, F.nz); QQ.setFromAxisAngle(UPV, ry);
      for (let k = 0; k < NF; k++) for (let c = 0; c < NC; c++) { const u = PIER + (c + 0.5) * CW; M4.compose(V.set(F.ax + F.tx * u + F.nx * -0.04, winY(k), F.az + F.tz * u + F.nz * -0.04), QQ, ONE); P.win.setMatrixAt(WI(f, k, c), M4); } }
    P.win.instanceMatrix.needsUpdate = true; P.win.setColorAt(0, new THREE.Color()); 
    // crack decals: one plane + one material (alphaTest = the reveal) per face
    const ct = [crackTex(11), crackTex(29)];
    P.cracks = FACE.map((F, f) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(LEN - 0.3, NF * FL + CROWN), new THREE.MeshBasicMaterial({ color: '#2a1d14', alphaMap: ct[f % 2], alphaTest: 1.01, polygonOffset: true, polygonOffsetFactor: -2, fog: true }));
      const u = LEN / 2; m.position.set(F.ax + F.tx * u + F.nx * 0.2, Y0 + (NF * FL + CROWN) / 2, F.az + F.tz * u + F.nz * 0.2); m.rotation.y = Math.atan2(F.nx, F.nz); if (f > 1) m.scale.x = -1; m.visible = false; TG.add(m); return m; });
    // rubble (part 2): the crumbled tower as a low heap of precast chunks
    { const rb = K(), r2 = rng(5); for (let i = 0; i < 70; i++) { const a = r2() * TAU, d = Math.sqrt(r2()) * (R + 0.5), s = 0.8 + r2() * 2.2;
        rb.add(G.box(s * 1.6, s * 0.7, s), r2() < 0.7 ? (r2() < 0.5 ? TAN : TAN2) : '#3a4a50', Math.sin(a) * d, (1 - d / (R + 1)) * 3.2 + s * 0.2, Math.cos(a) * d, r2() * 0.6, r2() * 3, r2() * 0.6); }
      P.rubble = rb.mesh(toonMat(), sc, 0.003); P.rubble.visible = false; }
    // ---- characters
    P.H = buildHero(); sc.add(P.H.root); P.M = buildHero({ wife: true }); sc.add(P.M.root);
    P.malletM = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: '#f2c230', emissive: '#7a5a00' })); P.malletM.position.set(0, 0.66, 0); P.H.swR.add(P.malletM); P.malletM.visible = false;
    let rig = null; try { if (typeof window.buildPenthousePigeon === 'function') rig = window.buildPenthousePigeon({ THREE, toonMat, outlineMat, QUAL }); } catch (e) { console.error(e); rig = null; }
    P.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = buildPenthousePigeonStandIn({ THREE, toonMat, outlineMat, QUAL });
    rig.wings = rig.wings || []; rig.flash = rig.flash || []; if (!rig.head) rig.head = new THREE.Group();
    if (P.rigKind === 'hook') { const bb = new THREE.Box3().setFromObject(rig.root), hgt = bb.max.y - bb.min.y; if (hgt > 0.2 && (hgt < 1.8 || hgt > 3.4)) rig.root.scale.multiplyScalar(2.4 / hgt);
      if (!rig.flash.length) rig.root.traverse((o) => { if (o.material && o.material.userData && o.material.userData.flash && !rig.flash.includes(o.material)) rig.flash.push(o.material); }); }
    P.pigBase = rig.root.scale.x; P.headZ = rig.head.position.z;
    const pg = (P.pig = new THREE.Group()); pg.add(rig.root); sc.add(pg); P.R = rig;
    P.thugs = [0, 2].map((i) => { const J = buildThug(THUG_LOOKS[i]); J.root.visible = false; sc.add(J.root); return { J, busy: false }; });
    // window items: crab cake, frying pan, the golden mallet
    const it = (fn) => { const k = K(); fn(k); const m = k.mesh(toonMat(), sc, 0.003); m.visible = false; return m; };
    P.items = {
      cake: it((k) => k.add(G.cyl(0.32, 0.36, 0.2, 12), '#c88a3a', 0, 0, 0).add(G.sph(0.1, 6, 5), '#e8d070', 0.1, 0.12, 0.05).add(G.box(0.12, 0.02, 0.2), '#d84a2a', -0.12, 0.11, 0)),
      pan: it((k) => k.add(G.cyl(0.42, 0.36, 0.09, 14), '#2a2a30', 0, 0, 0).add(G.box(0.1, 0.06, 0.7), '#4a3020', 0, 0, 0.7)),
      mallet: it((k) => k.add(G.box(0.5, 0.3, 0.3), '#f2c230', 0, 0.5, 0).add(G.cyl(0.05, 0.05, 0.8, 6), '#8a5a2a', 0, 0.05, 0)),
    };
    // helicopter (police blue / white), its rotor, the spotlight beam + the lit spot on the wall
    { const k = K(); k.add(G.sph(1.1, 12, 8), '#1c2e6a', 0, 0, 0, 0, 0, 0, 1, 0.8, 1.5).add(G.sph(0.7, 10, 7), '#9ad0ff', 0, 0.15, 1.0, 0, 0, 0, 1, 0.7, 0.7).add(G.box(2.1, 0.12, 0.6), '#f2f2ee', 0, -0.1, 0.1)
        .add(G.cyl(0.18, 0.08, 3.2, 6), '#1c2e6a', 0, 0.2, -2.4, Math.PI / 2, 0, 0).add(G.box(0.08, 0.8, 0.5), '#f2f2ee', 0, 0.55, -3.9)
        .add(G.box(0.08, 0.08, 2.2), '#2a2a30', 0.7, -0.95, 0).add(G.box(0.08, 0.08, 2.2), '#2a2a30', -0.7, -0.95, 0).add(G.sph(0.22, 8, 6), '#fff6c0', 0, -0.55, 1.3);
      P.heli = new THREE.Group(); k.mesh(toonMat(), P.heli, 0.003); const ro = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.26), new THREE.MeshLambertMaterial({ color: '#2a2a30' })); ro.position.y = 0.95; P.heli.add(ro); P.rotor = ro;
      P.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.1, 1, 14, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      P.spot = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), new THREE.MeshBasicMaterial({ color: '#fff8d0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }));
      sc.add(P.heli, P.beam, P.spot); P.heli.visible = P.beam.visible = P.spot.visible = false; }
    // harbour-patrol boat + its water-cannon stream
    { const k = K(); k.add(G.box(2.4, 0.9, 5.6), '#f2f2ee', 0, 0.3, 0).add(G.box(2.5, 0.25, 5.7), '#1c3a7a', 0, -0.05, 0).add(G.box(1.6, 1.1, 1.8), '#e8e8e4', 0, 1.2, -0.6).add(G.box(1.62, 0.3, 1.82), '#1c3a7a', 0, 1.6, -0.6)
        .add(G.cone(1.2, 1.6, 4), '#f2f2ee', 0, 0.3, 3.5, Math.PI / 2, Math.PI / 4, 0).add(G.cyl(0.12, 0.15, 0.9, 6), '#c8202a', 0, 1.1, 1.6, -0.9, 0, 0).add(G.box(0.5, 0.18, 0.3), '#c8202a', 0, 1.85, -0.6);
      P.boat = k.mesh(toonMat(), sc, 0.003); P.boat.visible = false;
      P.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 1, 8, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide })); P.stream.visible = false; sc.add(P.stream); }
    // window-washer platforms (plank + rails) and their cables
    P.plats = [0, 1].map(() => { const k = K(); k.add(G.box(2.5, 0.14, 0.7), '#c8c8c0', 0, 0, 0.35).add(G.box(2.5, 0.06, 0.06), '#3a6ac8', 0, 0.9, 0.68).add(G.box(0.06, 0.9, 0.06), '#3a6ac8', 1.2, 0.45, 0.68).add(G.box(0.06, 0.9, 0.06), '#3a6ac8', -1.2, 0.45, 0.68)
        .add(G.box(0.5, 0.5, 0.4), '#2a4a9a', 0.7, 0.3, 0.35);
      const m = k.mesh(toonMat(), sc, 0.003), cab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#2a2a30' })), cab2 = cab.clone(); sc.add(cab, cab2);
      return { m, cab, cab2, s: 0, y: YMIN, dir: 1, wait: 0, on: false }; });
    // tongue
    P.tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: '#ff6a8a', emissive: '#7a1a3a' })); P.tongue.visible = false; sc.add(P.tongue);
    // instanced fx pools: poop blobs, shadows (wall + ground), puddles, dust puffs, sparks / shards / splashes
    const ip = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; sc.add(m); return m; };
    P.poopM = ip(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshLambertMaterial({ color: '#f2f2e8', emissive: '#404038' }), 20);
    P.shadM = ip(new THREE.CircleGeometry(0.75, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 20);
    P.pudM = ip(new THREE.CircleGeometry(0.95, 14), new THREE.MeshLambertMaterial({ color: '#e4e8d0', emissive: '#3a3c30', polygonOffset: true, polygonOffsetFactor: -2 }), 10);
    P.dustM = ip(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#e2d6bc'), transparent: true, depthWrite: false }), 90);
    P.sparkM = ip(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: DUELS.dot('#fff8c0', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 64);
    P.fx = { dust: [], spark: [] };
  };

  // ---------------- run state ----------------
  const C_GL = [new THREE.Color('#355a64'), new THREE.Color('#40707a'), new THREE.Color('#2a4a52')], C_SKY = new THREE.Color('#9cc0d2'), C_BROKE = new THREE.Color('#0b0d10'), C_LIVE = new THREE.Color('#ffe060'), C_LIVE2 = new THREE.Color('#b8c4ff'), _c = new THREE.Color();
  function seedWindows(seed) {
    const r = rng(seed); P.W = [];
    for (let f = 0; f < 5; f++) { let mal = 0;
      for (let k = 0; k < NF; k++) for (let c = 0; c < NC; c++) { const x = r(); let it = null;
        if (x < 1 / 40 && !mal && k > 0) { it = 'mallet'; mal = 1; } else if (x < 0.15) it = 'cake'; else if (x < 0.29) it = 'thug'; else if (x < 0.41) it = 'pan'; else if (x < 0.47) it = 'live';
        const i = WI(f, k, c); P.W[i] = { f, k, c, it, broken: false, base: r() < 0.16 ? C_SKY : C_GL[Math.floor(r() * 3)] }; P.win.setColorAt(i, P.W[i].base); } }
    P.live = P.W.filter((w) => w.it === 'live'); P.win.instanceColor.needsUpdate = true;
  }
  function newPig(part) { return { m: part === 1 ? 'perch' : 'walk', mt: 0, md: 0, s: 0, pos: new THREE.Vector3(0, ROOFY, AP), yaw: 0, vy: 0, hitThis: false, poopT: 3, swoopT: 9, a: 0, peckCd: 1.5, walkT: 0, pecks: 0, pudT: 2, from: new THREE.Vector3(), to: new THREE.Vector3(), kb: new THREE.Vector3(), combo: 0, mavT: 0, flap: 0 }; }
  function reset1(keep) {
    const o = P.st; const st = P.st = { part: 1, ph: keep ? 'climb' : 'intro', pt: 0, t: 0, hp: 100, s: keep ? keep.s : LEN * 0.5 + 0 * LEN, y: YMIN, inv: 0, hurtT: 0, stunT: 0, fallT: 0, fallFrom: 0, fallTo: 0, smashT: -1, smashCd: 0, tongueT: -1, tongueCd: 0, tongueP: new THREE.Vector3(), jumpT: -1, jumpFrom: 0, jumpTo: 0, jumpS0: 0, jumpS1: 0, ride: null, climbPh: 0, mallet: false,
      dmg: keep ? keep.dmg : [0, 0, 0, 0, 0], score: keep ? keep.score : 0, pigHP: keep ? keep.pigHP : 100, stats: keep ? keep.stats : { windows: 0, floors: 0, pigeonHits: 0, helis: 0, eaten: 0, harbor: 0, cakes: 0, pans: 0, zaps: 0, poops: 0, washes: 0, knockoffs: 0, rides: 0 },
      said: keep ? keep.said : {}, pig: newPig(1), heli: null, heliT: 12, boat: null, boatT: 7, poops: [], thug: null, falls: [], pan: null, item: null, sayT: 7, popT: 0, faceSeen: keep ? keep.faceSeen : 0, won: false, over: false, hudT: 0, mav: { x: 0, z: AP + 3.4, tgt: null, swingT: -1 } };
    st.pig.s = st.s; P.items.cake.visible = P.items.pan.visible = P.items.mallet.visible = false; P.thugs.forEach((t) => { t.busy = false; t.J.root.visible = false; });
    P.heli.visible = P.beam.visible = P.spot.visible = P.boat.visible = P.stream.visible = false; P.fx.dust.length = P.fx.spark.length = 0;
    P.towerG.visible = true; P.towerG.position.set(0, 0, 0); P.towerG.scale.set(1, 1, 1); P.rubble.visible = false; P.rail.visible = true;
    P.plats.forEach((p, i) => { p.on = true; p.s = wrapS(st.s + (i ? 2.2 : -2.6) * LEN * 0.5 + i * LEN * 1.5); p.y = i ? TOPY - 3 : YMIN + 0.2; p.dir = i ? -1 : 1; p.wait = 0; });
    if (TALLY) TALLY.classList.remove('on'); DUELS.bars(st.hp / 100, st.pigHP / 100); faceHud(st, true); return st;
  }
  function reset2(hp0) {
    const o = P.st || {}; const st = P.st = { part: 2, ph: 'intro2', pt: 0, t: 0, hp: 100, x: C2.x - 2.5, z: C2.z - 3.2, vx: 0, vz: 0, yaw: Math.PI * 0.8, hy: 0, jumpT: -1, inv: 0, hurtT: 0, stunT: 0, smashT: -1, smashCd: 0, tongueT: -1, tongueCd: 0, tongueP: new THREE.Vector3(), slip: 0,
      score: o.score || 0, stats: o.stats || { windows: 0, floors: 0, pigeonHits: 0, helis: 0, eaten: 0, harbor: 0, cakes: 0, pans: 0, zaps: 0, poops: 0, washes: 0, knockoffs: 0, rides: 0 }, said: o.said || {}, dmg: [1, 1, 1, 1, 1],
      pigHP: hp0, p2hp0: hp0, pig: newPig(2), poops: [], puds: [], thug: null, falls: [], sayT: 6, won: false, over: false, hudT: 0, mav: { x: C2.x + 3, z: C2.z - 3.5, tgt: null, swingT: -1 }, slamT: 0 };
    st.pig.pos.set(C2.x + 1.5, 0, C2.z + 2.5); st.pig.m = 'walk';
    P.towerG.visible = false; P.rubble.visible = true; P.heli.visible = P.beam.visible = P.spot.visible = P.boat.visible = P.stream.visible = false; P.plats.forEach((p) => { p.on = false; });
    P.items.cake.visible = P.items.pan.visible = P.items.mallet.visible = false; P.thugs.forEach((t) => { t.busy = false; t.J.root.visible = false; }); P.malletM.visible = false;
    if (TALLY) TALLY.classList.remove('on'); DUELS.bars(1, st.pigHP / 100); DUELS.sub(scoreHtml(st), 'GROUND FIGHT'); return st;
  }
  const scoreHtml = (st) => 'SCORE ' + Math.round(st.score).toLocaleString('en-US');
  function faceHud(st, force) {
    const f = st.part === 1 ? Math.min(4, Math.floor(wrapS(st.s) / LEN)) : -1;
    const html = '<span class="pfaces">' + st.dmg.map((d, i) => `<i class="${i === f ? 'on' : ''} ${d >= 1 ? 'done' : ''}"><b style="width:${Math.round(clamp(d, 0, 1) * 100)}%"></b></i>`).join('') + '</span>';
    DUELS.sub(scoreHtml(st), html);
  }
  function addScore(st, n, p, label, cls) { st.score += n; if (p) pop(label || '+' + n, p, cls || (n >= 500 ? 'b' : '')); }
  P.start = function (opts = {}) {
    P.st = null; const part = +(opts.part || Q.get('pigeonpart') || 1);
    seedWindows(+(Q.get('pigeonseed') || 0) || ((Date.now() % 100000) + 1));
    if (part === 2) { reset2(70); DUELS.banner('THE PENTHOUSE PIGEON<small>PART 2 \u00b7 THE PROMENADE</small>', 2.4); }
    else { reset1(null); DUELS.banner('THE PENTHOUSE PIGEON<small>WORLD TRADE CENTER \u00b7 WRECK ALL 5 FACES</small>', 2.6); }
    const l = lines(); if (l) DUELS.say('PENTHOUSE PIGEON', pick(l.intro), 3.2);
    DUELS.log.push('pigeon:' + P.rigKind + ':part' + part);
    P.camP = new THREE.Vector3(0, 8, 40); P.camL = new THREE.Vector3(0, 10, 0); P.camA = 0; P.shake = 0;
  };
  P.retry = function () {
    const st = P.st; if (!st) return;
    if (st.part === 1) { reset1(st); P.st.y = YMIN; DUELS.banner('BACK ON THE WALL!<small>FULL HEALTH \u00b7 WRECKED FACES STAY WRECKED</small>', 1.8); }
    else { reset2(st.p2hp0); P.st.ph = 'fight'; DUELS.banner('ROUND AGAIN!<small>PART 2 \u00b7 FULL HEALTH</small>', 1.6); }
  };
  P.exit = function () { DUELS.blind(0); if (TALLY) TALLY.classList.remove('on'); for (const o of POPS) { o.t = 9; o.e.style.opacity = '0'; } P.tongue.visible = false; };

  // ---------------- shared helpers ----------------
  function puff(p, n = 4, s = 1.2, up = 1.2, life = 1.4) { for (let k = 0; k < n && P.fx.dust.length < 90; k++) P.fx.dust.push({ p: p.clone().add(V3.set(rnd(-0.5, 0.5), rnd(-0.3, 0.3), rnd(-0.5, 0.5))), v: new THREE.Vector3(rnd(-1, 1), rnd(0.3, 1) * up, rnd(-1, 1)), t: 0, life: life * rnd(0.7, 1.2), s: s * rnd(0.7, 1.3) }); }
  function spark(p, n = 6, spd = 3, g = 9) { for (let k = 0; k < n && P.fx.spark.length < 64; k++) P.fx.spark.push({ p: p.clone(), v: new THREE.Vector3(rnd(-spd, spd), rnd(0.5, spd * 1.2), rnd(-spd, spd)), t: 0, life: rnd(0.3, 0.7), g }); }
  function flashPig(c = '#ffffff', v = 0.9) { for (const m of P.R.flash) if (m && m.userData && m.userData.flash) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function hurtHarold(st, dmg, kind, opts = {}) {
    if (st.inv > 0 || st.over || (st.part === 2 && st.jumpT >= 0 && !opts.air)) return false;
    st.hp -= dmg; st.inv = opts.inv ?? 0.7; st.hurtT = 0.4; DUELS.hurt(); sfx('hurt'); P.H.mat && P.H.mat.userData && (P.H.mat.userData.flash.value = 0.8);
    DUELS.log.push('hurt:' + kind); harPos(st, V); pop('-' + dmg, V.setY(V.y + 1.8), 'r');
    if (st.hp <= 0) { st.hp = 0; st.over = true; st.ph = 'dead'; st.pt = 0; sfx('ko'); DUELS.log.push('pigeon:lose:' + kind);
      if (Math.random() < 0.8) DUELS.say('PENTHOUSE PIGEON', pick(st.part === 1 ? TXT.taunts : TXT.ground), 2.4);
      setTimeout(() => { if (DUELS.cur === P && P.st === st) DUELS.over('lose', st.part === 1 ? 'OFF THE WALL!' : 'PECKED OUT!', st.part === 1 ? 'Harold took the long way down. Retry the climb with full health: the faces you wrecked stay wrecked.' : 'The Pigeon got the best of Harold on the promenade. Retry the ground fight with full health.'); }, SIM ? 400 : 1600); }
    return true;
  }
  function healHarold(st, n, p) { st.hp = Math.min(100, st.hp + n); pop('+' + n + ' HP', p, 'g'); }
  function harPos(st, out) { if (st.part === 1) { onWall(st.s, 0.62); return out.set(_w.x, st.y, _w.z); } return out.set(st.x, st.hy || 0, st.z); }
  function chest(st, out) { harPos(st, out); out.y += 1.1; if (st.part === 1) { out.x -= _w.nx * 0.1; out.z -= _w.nz * 0.1; } return out; }
  function hitPigeon(st, dmg, how, p) {
    const pig = st.pig; const cap = st.part === 1 ? 55 : 0; const before = st.pigHP; st.pigHP = Math.max(cap, st.pigHP - dmg);
    st.stats.pigeonHits++; flashPig(); sfx('heavy'); spark(p || pig.pos, 10, 4); puff(p || pig.pos, 3, 0.8, 0.5, 0.8);
    addScore(st, how === 'tongue' ? 500 : how === 'slam' ? 400 : 250, (p || pig.pos).clone().setY((p || pig.pos).y + 1.5)); P.shake = Math.max(P.shake, 0.3);
    if (st.part === 1 && before <= cap) pop('MAX!', pig.pos, 'b');
  }
  function sayTaunt(st, dt) { st.sayT -= dt; if (st.sayT <= 0) { st.sayT = rnd(9, 13); DUELS.say('PENTHOUSE PIGEON', pick(st.part === 1 ? TXT.taunts : TXT.ground), 2.8); } }
  function once(st, key, fn) { if (!st.said[key]) { st.said[key] = 1; fn(); } }

  // ================= PART 1: THE CLIMB =================
  function winAt(st) { // the window in reach of Harold's cane (his face, his chest height), or -1
    const s = wrapS(st.s), f = Math.min(4, Math.floor(s / LEN)), u = s - f * LEN; const c = Math.floor((u - PIER) / CW), k = Math.floor((st.y + 1.2 - Y0) / FL);
    if (u < PIER - 0.35 || u > LEN - PIER + 0.35 || k < 0 || k >= NF) return -1; return WI(f, k, clamp(c, 0, NC - 1));
  }
  function winPos(i, out) { const w = P.W[i], F = FACE[w.f], u = PIER + (w.c + 0.5) * CW; return out.set(F.ax + F.tx * u + F.nx * 0.3, winY(w.k), F.az + F.tz * u + F.nz * 0.3); }
  function faceDamage(st, f, d, p) {
    const was = st.dmg[f]; st.dmg[f] = Math.min(1, st.dmg[f] + d);
    if (was < 1 && st.dmg[f] >= 1) { DUELS.tell('FACE ' + (f + 1) + ' WRECKED!' + (st.dmg.filter((x) => x >= 1).length < 5 ? ' SWING ROUND THE CORNER' : ''), 1.6); addScore(st, 1000, p || V.set(0, st.y + 2, 0), 'FACE WRECKED +1000', 'b'); sfx('heavy'); P.shake = 0.5;
      for (let k = 0; k < 8; k++) { onWall(f * LEN + rnd(0.5, LEN - 0.5), 0.4); puff(V.set(_w.x, rnd(Y0, TOPY), _w.z), 2, 2, 0.6, 1.6); } }
  }
  function breakWin(st, i, viaMallet) {
    const w = P.W[i]; if (w.broken) return false; w.broken = true; P.win.setColorAt(i, C_BROKE); P.win.instanceColor.needsUpdate = true; st.stats.windows++;
    winPos(i, V2); spark(V2, viaMallet ? 3 : 7, 3, 12); sfx('hit'); if (!viaMallet) { addScore(st, 50, V2.clone()); faceDamage(st, w.f, DMG_WIN, V2); }
    if (viaMallet) return true;
    switch (w.it) {
      case 'live': st.stats.zaps++; spark(V2, 14, 5, 2); DUELS.tell('ZAP! LIVE WIRE!', 0.9); hurtHarold(st, 8, 'zap'); st.stunT = 0.6; break;
      case 'cake': st.item = { kind: 'cake', i, t: 0 }; st.stats.cakes++; break;
      case 'mallet': st.item = { kind: 'mallet', i, t: 0 }; DUELS.tell('GOLDEN CRAB MALLET! NEXT SMASH BREAKS THE FLOOR', 1.8); sfx('jump'); break;
      case 'pan': st.pan = { i, t: 0, hit: false }; DUELS.tell('FRYING PAN! MOVE!', 0.6); break;
      case 'thug': { const T = P.thugs.find((t) => !t.busy); if (T) { T.busy = true; st.thug = { T, i, t: 0, punched: false }; DUELS.tell('THUG! TONGUE-GRAB TO EAT HIM', 1.2); } break; }
      default: if (Math.random() < 0.22 && st.popT <= 0) { st.popT = 5; DUELS.say('TENANT, FLOOR ' + (w.k + 2), pick(TXT.popups), 2.2); }
    }
    return true;
  }
  function floorBreak(st, f, k) {
    let n = 0; for (let c = 0; c < NC; c++) if (breakWin(st, WI(f, k, c), true)) n++;
    for (let c = 0; c < NC; c++) { winPos(WI(f, k, c), V); puff(V, 3, 1.8, 0.6, 1.8); }
    st.stats.floors++; faceDamage(st, f, DMG_FLOOR + n * 0.02, V); addScore(st, 1000, V.clone().setY(V.y + 1), 'FLOOR BUSTER +1000', 'b'); sfx('heavy'); P.shake = 0.7; DUELS.tell('FLOOR BUSTED!', 1.2);
  }
  function smash1(st) {
    const pig = st.pig; chest(st, V);
    if ((pig.m === 'swoop' || pig.m === 'swoopTell') && pig.pos.distanceTo(V) < 2.7) { hitPigeon(st, 9, 'punch', pig.pos); setPig(pig, 'hurt', 1.3); DUELS.tell('POW! RIGHT IN THE BEAK', 0.9); return; }
    const H = st.heli; if (H && !H.swat && H.pos.distanceTo(V) < 3.5) { H.swat = true; H.st = 'swat'; H.t = 0; st.stats.helis++; addScore(st, 500, H.pos.clone(), 'HELI SWATTED +500', 'b'); sfx('heavy'); spark(H.pos, 12, 4); DUELS.tell('SWATTED! THE CHOPPER SPINS OFF', 1.2); return; }
    if (st.thug && !st.thug.out) { winPos(st.thug.i, V2); if (V2.distanceTo(V) < 2.6) { knockThug(st); return; } }
    const i = winAt(st); const f = Math.min(4, Math.floor(wrapS(st.s) / LEN));
    if (i >= 0 && st.mallet) { st.mallet = false; P.malletM.visible = false; floorBreak(st, P.W[i].f, P.W[i].k); return; }
    if (i >= 0 && breakWin(st, i, false)) return;
    // a broken window or the wall: chips the face a little
    faceDamage(st, f, DMG_WALL); puff(V2.copy(V).addScaledVector(V3.set(_w.nx, 0, _w.nz), 0.4), 1, 0.7, 0.4, 0.7); addScore(st, 10, null); sfx('swing');
  }
  function knockThug(st) { const t = st.thug; winPos(t.i, V2); st.thug = null; addScore(st, 100, V2.clone(), '+100'); sfx('heavy');
    const w = P.W[t.i], F = FACE[w.f]; st.falls.push({ T: t.T, p: V2.clone().setY(V2.y - 0.9), v: new THREE.Vector3(F.nx * 2.2, 2, F.nz * 2.2), st: 'fall', t: 0, spin: rnd(4, 7) }); }
  function tongue1(st) {
    const pig = st.pig; chest(st, V);
    if ((pig.m === 'swoop' || pig.m === 'swoopTell') && pig.pos.distanceTo(V) < 3.3) { st.tongueP.copy(pig.pos); hitPigeon(st, 16, 'tongue', pig.pos); setPig(pig, 'hurt', 1.6); DUELS.tell(TXT.score[6], 1.0); return; }
    if (st.thug && !st.thug.out) { winPos(st.thug.i, V2); if (V2.distanceTo(V) < 3.2) { st.tongueP.copy(V2); st.stats.eaten++; healHarold(st, 15, V2.clone()); addScore(st, 300, V2.clone().setY(V2.y + 0.6), 'GULP! +300'); st.thug.T.busy = false; st.thug.T.J.root.visible = false; st.thug = null; sfx('jump'); return; } }
    const i = winAt(st); if (i >= 0) { winPos(i, st.tongueP); const w = P.W[i]; if (w.it === 'live' && !w.broken) { st.stats.zaps++; spark(st.tongueP, 12, 4, 2); DUELS.tell('ZAP! DON\u2019T LICK THE WIRES', 0.9); hurtHarold(st, 8, 'zap'); st.stunT = 0.6; } return; }
    st.tongueP.copy(V).addScaledVector(V3.set(-_w.nx, 0, -_w.nz), 1.2);
  }
  function knockDown(st, floors, why) {
    const to = Math.max(YMIN, st.y - floors * FL); st.fallT = 0.45; st.fallFrom = st.y; st.fallTo = to; st.ride = null; st.jumpT = -1;
    if (to === st.y) st.fallT = 0; DUELS.tell(why, 1.0);
  }
  function setPig(pig, m, md) { pig.m = m; pig.mt = 0; pig.md = md; pig.hitThis = false; }
  function pigeon1(st, dt) {
    const pig = st.pig; pig.mt += dt; const hp = chest(st, V2).clone(), prog = st.dmg.reduce((a, b) => a + b, 0) / 5;
    switch (pig.m) {
      case 'perch': { // walk the roof edge above Harold, drop poop
        const d = dS(st.s, pig.s); pig.s = wrapS(pig.s + clamp(d, -4.2 * dt, 4.2 * dt)); onWall(pig.s, 0.5); pig.pos.set(_w.x, ROOFY, _w.z); pig.yaw = Math.atan2(_w.nx, _w.nz);
        pig.poopT -= dt; if (pig.poopT <= 0 && Math.abs(d) < 2.2 && st.y < ROOFY - 6) { pig.poopT = lerp(3.6, 2.2, prog) + rnd(0, 1); st.poops.push({ s: pig.s + clamp(d, -0.6, 0.6), y: ROOFY - 0.4, vy: -3, off: 0.75, hit: false, wall: true }); sfx('swing'); }
        pig.swoopT -= dt; if (pig.swoopT <= 0 && st.ph === 'climb') { pig.swoopT = lerp(11, 7.5, prog) + rnd(0, 2); setPig(pig, 'circle', 1.8); pig.a = Math.atan2(pig.pos.x, pig.pos.z); }
        break; }
      case 'circle': { pig.a += dt * 1.1; const r = R + 9; pig.pos.x = damp(pig.pos.x, Math.sin(pig.a) * r, 3, dt); pig.pos.z = damp(pig.pos.z, Math.cos(pig.a) * r, 3, dt); pig.pos.y = damp(pig.pos.y, st.y + 4, 2, dt); pig.yaw = pig.a + Math.PI / 2;
        if (pig.mt > pig.md) { onWall(st.s, 0.62); const dir = Math.random() < 0.5 ? 1 : -1, F = FACE[_w.f]; pig.from.set(_w.x - F.tx * dir * 7 + _w.nx * 3, st.y + 1.2, _w.z - F.tz * dir * 7 + _w.nz * 3); pig.to.set(_w.x + F.tx * dir * 7 + _w.nx * 1.3, st.y + 1.1, _w.z + F.tz * dir * 7 + _w.nz * 1.3);
          setPig(pig, 'swoopTell', 0.85); DUELS.tell('BOMBING RUN! SMASH OR TONGUE HIM AS HE SWOOPS', 1.2); } break; }
      case 'swoopTell': pig.pos.lerp(pig.from, 1 - Math.exp(-6 * dt)); pig.yaw = Math.atan2(pig.to.x - pig.from.x, pig.to.z - pig.from.z); if (pig.mt > pig.md) setPig(pig, 'swoop', 1.15); break;
      case 'swoop': { const u = clamp(pig.mt / pig.md, 0, 1); pig.pos.lerpVectors(pig.from, pig.to, u); pig.pos.y += Math.sin(u * Math.PI) * -0.3;
        if (!pig.hitThis && pig.pos.distanceTo(hp) < 1.5) { pig.hitThis = true; if (hurtHarold(st, 10, 'swoop')) { spark(hp, 6); DUELS.tell('PECKED!', 0.7); } }
        if (pig.mt > pig.md) setPig(pig, 'return', 1.6); break; }
      case 'hurt': { pig.pos.y -= dt * 2.5; pig.pos.x += Math.sin(pig.yaw) * dt * 3; pig.pos.z += Math.cos(pig.yaw) * dt * 3; if (pig.mt > pig.md) setPig(pig, 'return', 1.6); break; }
      case 'return': { onWall(st.s + 1.5, 0.9); pig.pos.lerp(V3.set(_w.x, ROOFY, _w.z), 1 - Math.exp(-3.2 * dt)); pig.yaw = Math.atan2(V3.x - pig.pos.x, V3.z - pig.pos.z);
        if (pig.mt > pig.md) { setPig(pig, 'perch', 0); pig.s = wrapS(st.s + 1.5); pig.poopT = 1.4; } break; }
      case 'flee': pig.pos.y += dt * 6; pig.pos.x += dt * 4; pig.yaw = 1.2; break;
    }
  }
  function poops1(st, dt) {
    for (let i = st.poops.length - 1; i >= 0; i--) { const p = st.poops[i]; p.vy -= 16 * dt; p.y += p.vy * dt;
      if (!p.hit && st.fallT <= 0 && p.y < st.y + 1.9 && p.y > st.y - 0.2 && Math.abs(dS(p.s, st.s)) < 0.8) { p.hit = true; st.stats.poops++; harPos(st, V); spark(V.setY(st.y + 1.9), 8, 2.5); sfx('hit');
        if (hurtHarold(st, 5, 'poop', { inv: 0.9 })) knockDown(st, 1, 'SPLAT! DOWN A FLOOR'); }
      else if (!p.hit && !p.near && p.y < st.y + 0.4 && Math.abs(dS(p.s, st.s)) < 1.6) { p.near = true; if (Math.random() < 0.4) { harPos(st, V); addScore(st, 100, V.setY(st.y + 2), TXT.score[3], 'g'); } }
      if (p.y < 0.3) { onWall(p.s, p.off); puff(V.set(_w.x, 0.3, _w.z), 2, 0.8, 0.3, 0.8); st.poops.splice(i, 1); } }
  }
  function heli1(st, dt) {
    st.heliT -= dt; if (!st.heli && st.heliT <= 0 && st.ph === 'climb') { onWall(st.s, 30); st.heli = { st: 'in', t: 0, pos: new THREE.Vector3(_w.x, st.y + 12, _w.z), s: st.s, off: 5, spotS: st.s + 3, spotY: st.y + 4, lock: 0, fireCd: 0, strafe: 2.2, life: 15, swat: false, yaw: 0 }; DUELS.tell('POLICE CHOPPER! SWAT IT WHEN IT SWINGS IN', 1.4); }
    const H = st.heli; if (!H) return; H.t += dt;
    if (H.st === 'swat') { H.pos.y -= dt * (3 + H.t * 9); H.yaw += dt * 14; onWall(H.s, H.off + H.t * 6); H.pos.x = _w.x; H.pos.z = _w.z; if (Math.random() < dt * 20) puff(H.pos, 1, 1, 0.5, 1);
      if (H.pos.y < 0) { spark(H.pos.setY(0), 14, 4); puff(H.pos, 4, 2, 1, 1.4); st.heli = null; st.heliT = rnd(14, 18); } return; }
    if (H.st === 'out') { H.pos.y += dt * 6; H.off += dt * 10; onWall(H.s, H.off); H.pos.x = _w.x; H.pos.z = _w.z; if (H.t > 3) { st.heli = null; st.heliT = rnd(12, 16); } return; }
    H.s = wrapS(H.s + clamp(dS(st.s, H.s), -1.6 * dt, 1.6 * dt)); H.strafe -= dt;
    const close = H.strafe < 0 && H.strafe > -1.5; if (H.strafe < -1.5) H.strafe = rnd(2.4, 3.4);
    H.off = damp(H.off, close ? 2.0 : 5.5, 3, dt); onWall(H.s, H.off); H.pos.x = _w.x; H.pos.z = _w.z; H.pos.y = damp(H.pos.y, st.y + (close ? 1.2 : 2.6) + Math.sin(H.t * 2) * 0.3, 3, dt); H.yaw = Math.atan2(-_w.nx, -_w.nz) + Math.sin(H.t) * 0.2;
    H.spotS = H.spotS + clamp(dS(st.s, H.spotS), -2.1 * dt, 2.1 * dt); H.spotY = damp(H.spotY, st.y + 1.1, 2.2, dt);
    H.fireCd -= dt; const on = Math.abs(dS(H.spotS, st.s)) < 0.9 && Math.abs(H.spotY - st.y - 1.1) < 1.0;
    H.lock = on ? H.lock + dt : Math.max(0, H.lock - dt * 2);
    if (H.lock > 0.85 && H.fireCd <= 0) { H.fireCd = 1.6; H.lock = 0; chest(st, V); spark(V, 6, 2); sfx('hit'); if (hurtHarold(st, 5, 'heli')) DUELS.tell('RAT-A-TAT! GET OUT OF THE LIGHT', 0.8); }
    if (H.t > H.life) { H.st = 'out'; H.t = 0; }
  }
  function boat1(st, dt) {
    st.boatT -= dt; if (!st.boat && st.boatT <= 0 && st.ph === 'climb') { onWall(st.s, 17); if (isWater(_w.x, _w.z)) { const dir = Math.random() < 0.5 ? 1 : -1; st.boat = { st: 'tell', t: 0, x: _w.x, z: _w.z, yaw: Math.atan2(-_w.nx, -_w.nz), s0: st.s - dir * 3, dir, ws: st.s - dir * 3 }; DUELS.tell('HARBOR PATROL! WATER CANNON!', 1.0); } else st.boatT = 2.5; }
    const B = st.boat; if (!B) return; B.t += dt;
    if (B.st === 'tell' && B.t > 1.0) { B.st = 'spray'; B.t = 0; sfx('swing'); }
    if (B.st === 'spray') { B.ws += B.dir * 3.1 * dt; if (Math.abs(dS(B.ws, st.s)) < 1.0 && st.fallT <= 0) { st.s += B.dir * 3.6 * dt; st.ride = null; if (!B.hitSaid) { B.hitSaid = true; st.stats.washes++; DUELS.tell('WHOOSH! SHOVED SIDEWAYS', 0.8); } } if (B.t > 1.8) { B.st = 'go'; B.t = 0; } }
    if (B.st === 'go' && B.t > 2) { st.boat = null; st.boatT = rnd(9, 13); }
  }
  function plats1(st, dt) {
    for (const p of P.plats) { if (!p.on) continue;
      if (p.wait > 0) { p.wait -= dt; if (p.wait <= 0) { p.dir = -p.dir; if (p.dir > 0 && Math.random() < 0.7) { p.s = wrapS(st.s + rnd(-3.5, 3.5)); } } continue; }
      p.y += p.dir * (p.dir > 0 ? 1.7 : 1.9) * dt; if (p.y > TOPY - 1.2 || p.y < YMIN) { p.y = clamp(p.y, YMIN, TOPY - 1.2); p.wait = 1.4; if (st.ride === p) { st.ride = null; once(st, 'top' + Math.round(st.t), () => {}); } }
      const over = Math.abs(dS(st.s, p.s)) < 1.35;
      if (over && p.dir < 0 && st.ride !== p && st.fallT <= 0 && p.y > st.y + 1.3 && p.y < st.y + 1.85) { st.stats.knockoffs++; harPos(st, V); spark(V.setY(st.y + 1.8), 6); if (hurtHarold(st, 8, 'platform', { inv: 1.0 })) knockDown(st, 2, 'KNOCKED OFF BY THE WASHERS!'); }
      if (over && p.dir > 0 && !st.ride && st.fallT <= 0 && st.jumpT < 0 && Math.abs(p.y - st.y) < 0.45) { st.ride = p; st.stats.rides++; DUELS.tell('HOP ON! RIDE IT UP', 0.9); }
    }
  }
  function falls(st, dt) { // knocked-off thugs: fall, Mavis bats them into the harbour
    for (let i = st.falls.length - 1; i >= 0; i--) { const f = st.falls[i]; f.t += dt;
      if (f.st === 'fall') { f.v.y -= 14 * dt; f.p.addScaledVector(f.v, dt); if (f.p.y <= 0) { f.p.y = 0; f.st = 'ground'; f.t = 0; puff(f.p, 3, 1, 0.5, 0.9); sfx('hit'); st.mav.tgt = f; } }
      else if (f.st === 'ground') { if (f.t > 3.5) { f.st = 'fly'; f.t = 0; } }
      else if (f.st === 'fly') { f.v.y -= 12 * dt; f.p.addScaledVector(f.v, dt); if (f.p.y < -0.6) { if (isWater(f.p.x, f.p.z)) { spark(V.set(f.p.x, -0.2, f.p.z), 14, 3.5, 9); puff(V, 3, 1.4, 1.5, 0.9); st.stats.harbor++; addScore(st, 200, V.clone().setY(1.5), 'INTO THE HARBOR +200'); }
          f.T.busy = false; f.T.J.root.visible = false; if (st.mav.tgt === f) st.mav.tgt = null; st.falls.splice(i, 1); } } }
  }
  function mavis(st, dt) { const M = st.mav;
    if (!M.tgt && M.swingT >= 0) { M.swingT += dt; if (M.swingT > 0.6) M.swingT = -1; }
    if (M.tgt && M.tgt.st === 'ground') { const f = M.tgt, d = Math.hypot(f.p.x - M.x, f.p.z - M.z);
      if (d > 1.1) { M.x += (f.p.x - M.x) / d * 5.5 * dt; M.z += (f.p.z - M.z) / d * 5.5 * dt; }
      else if (M.swingT < 0) M.swingT = 0;
      if (M.swingT >= 0) { M.swingT += dt; if (M.swingT > 0.25 && f.st === 'ground') { const r = Math.hypot(f.p.x, f.p.z) || 1; let ox = f.p.x / r, oz = f.p.z / r; if (oz < -0.3) { oz = 0.2; ox = Math.sign(ox || 1); } f.st = 'fly'; f.t = 0; f.v.set(ox * 11, 7, oz * 11); sfx('heavy'); spark(V.set(f.p.x, 1, f.p.z), 8); if (Math.random() < 0.5) DUELS.say('MAVIS', pick(['Into the drink, hon!', 'And STAY down there!', 'Swim home, sweetie!', 'Harbor\u2019s that way!']), 1.8); }
        if (M.swingT > 0.6) { M.swingT = -1; M.tgt = null; } } return; }
    let tx, tz; if (st.part === 1) { onWall(st.s, 3.6); tx = _w.x; tz = _w.z; } else if (st.pig.m === 'dazed') { tx = st.pig.pos.x + 1.1; tz = st.pig.pos.z - 0.9; } else { tx = st.x + 2.5; tz = st.z - 2; [tx, tz] = inRing(tx, tz); }
    const d = Math.hypot(tx - M.x, tz - M.z); if (d > 0.5) { const sp = Math.min(d * 2, 4.5); M.x += (tx - M.x) / d * sp * dt; M.z += (tz - M.z) / d * sp * dt; }
    if (st.part === 1) { const r = Math.hypot(M.x, M.z); if (r < AP + 1.4) { M.x *= (AP + 1.4) / r; M.z *= (AP + 1.4) / r; } }
  }
  function step1(st, dt, I) {
    st.pt += dt; st.t += dt; st.inv -= dt; st.hurtT -= dt; st.stunT -= dt; st.smashCd -= dt; st.tongueCd -= dt; st.popT -= dt;
    if (st.smashT >= 0) { st.smashT += dt; if (st.smashT > 0.3) st.smashT = -1; } if (st.tongueT >= 0) { st.tongueT += dt; if (st.tongueT > 0.32) st.tongueT = -1; }
    if (st.ph === 'intro') { pigeon1(st, dt); if (st.pt > 2.4) { st.ph = 'climb'; st.pt = 0; } return; }
    if (st.ph === 'collapse') return collapse(st, dt);
    if (st.ph === 'tally') return tally(st, dt);
    if (st.ph === 'dead') { st.y = Math.max(0, st.y - dt * (6 + st.pt * 14)); falls(st, dt); mavis(st, dt); return; }
    // ---- Harold on the wall
    let mx = I.mx, my = I.my; if (I.up) my = 1; if (I.down) my = -1;
    if (st.fallT > 0) { st.fallT -= dt; st.y = lerp(st.fallTo, st.fallFrom, clamp(st.fallT / 0.45, 0, 1) ** 2); if (st.fallT <= 0) { st.y = st.fallTo; st.inv = Math.max(st.inv, 0.8); if (Math.random() < 0.5) once(st, 'ledge', () => DUELS.tell(TXT.score[0], 0.8)); } }
    else if (st.jumpT >= 0) { st.jumpT += dt; const u = clamp(st.jumpT / 0.38, 0, 1); st.y = lerp(st.jumpFrom, st.jumpTo, ease(u)); st.s = lerp(st.jumpS0, st.jumpS1, ease(u)); if (u >= 1) st.jumpT = -1; }
    else if (st.stunT <= 0) {
      if (st.ride) { st.y = st.ride.y; if (Math.abs(mx) > 0.5 || my < -0.5) st.ride = null; }
      const hs = st.smashT >= 0 ? 0.35 : 1; st.s += mx * 3.1 * hs * dt; if (!st.ride) st.y += my * (my > 0 ? 2.7 : 3.3) * hs * dt;
      if (Math.abs(mx) > 0.2 || Math.abs(my) > 0.2) st.climbPh += dt * 9;
      if (I.b) { st.jumpT = 0; st.jumpFrom = st.y; st.jumpS0 = st.s; st.ride = null; if (Math.abs(mx) > 0.4) { st.jumpTo = st.y + 0.6; st.jumpS1 = st.s + Math.sign(mx) * 2.4; } else { st.jumpTo = Math.min(YMAX, st.y + FL * (my < -0.4 ? -1 : 1)); st.jumpS1 = st.s; } st.jumpTo = clamp(st.jumpTo, YMIN, YMAX); sfx('jump'); }
      if (I.a && st.smashCd <= 0) { st.smashCd = 0.27; st.smashT = 0; sfx('swing'); smash1(st); }
      if (I.c && st.tongueCd <= 0) { st.tongueCd = 0.45; st.tongueT = 0; tongue1(st); }
    }
    st.y = clamp(st.y, YMIN, YMAX); st.s = wrapS(st.s);
    const fl = Math.floor((st.y + 1.2 - Y0) / FL); if (fl >= 6) once(st, 'half', () => { DUELS.tell(TXT.score[4], 1.0); addScore(st, 250, chest(st, V).clone(), '+250'); }); if (fl >= NF - 1) once(st, 'top', () => { DUELS.tell(TXT.score[5], 1.0); addScore(st, 500, chest(st, V).clone(), '+500', 'b'); });
    // ---- window events in progress
    if (st.item) { const it = st.item; it.t += dt; if (it.t > 0.55) { winPos(it.i, V); if (it.kind === 'cake') { healHarold(st, 12, V.clone()); addScore(st, 150, null); sfx('jump'); } else { st.mallet = true; P.malletM.visible = true; addScore(st, 250, V.clone().setY(V.y + 0.6), 'GOLDEN MALLET +250', 'b'); } st.item = null; } }
    if (st.pan) { const pn = st.pan; pn.t += dt; if (pn.t > 0.5 && !pn.hit) { pn.hit = true; const w = P.W[pn.i]; const here = winAt(st) === pn.i || (Math.abs(dS(st.s, winS(w.f, w.c))) < 0.95 && Math.abs(st.y + 1.2 - winY(w.k)) < 1.4);
        if (here) { st.stats.pans++; winPos(pn.i, V); spark(V, 8); sfx('heavy'); hurtHarold(st, 9, 'pan'); st.stunT = 0.35; DUELS.tell('CLANG! A FRYING PAN TO THE FACE', 0.9); } else { winPos(pn.i, V); addScore(st, 100, V.clone(), TXT.score[1], 'g'); } }
      if (pn.t > 0.95) st.pan = null; }
    if (st.thug) { const t = st.thug; t.t += dt; if (t.t > 2.4 && !t.punched) { t.punched = true; winPos(t.i, V); if (V.distanceTo(chest(st, V2)) < 2.6) { hurtHarold(st, 6, 'thug'); DUELS.tell('THE THUG SOCKED HIM', 0.7); } }
      if (t.t > 3.0) { t.T.busy = false; t.T.J.root.visible = false; st.thug = null; } }
    pigeon1(st, dt); poops1(st, dt); heli1(st, dt); boat1(st, dt); plats1(st, dt); falls(st, dt); mavis(st, dt); sayTaunt(st, dt);
    // live windows flicker
    const fz = Math.floor(st.t * 14) % 2; if (fz !== P.lastFz) { P.lastFz = fz; for (const w of P.live) { if (w.broken) continue; P.win.setColorAt(WI(w.f, w.k, w.c), Math.random() < 0.55 ? C_LIVE : C_LIVE2); } P.win.instanceColor.needsUpdate = true; }
    if (Math.random() < dt * 3) { const w = pick(P.live); if (w && !w.broken) spark(winPos(WI(w.f, w.k, w.c), V), 2, 1.5, 6); }
    st.hudT -= dt; if (st.hudT <= 0) { st.hudT = 0.2; faceHud(st); DUELS.bars(st.hp / 100, st.pigHP / 100); }
    if (st.dmg.every((d) => d >= 1)) startCollapse(st);
  }
  function startCollapse(st) {
    st.ph = 'collapse'; st.pt = 0; onWall(st.s, 0.62); st.leapFrom = new THREE.Vector3(_w.x, st.y, _w.z); let ox = _w.nx, oz = _w.nz; if (Math.hypot(_w.x, _w.z) > 0 && _w.z + oz * 8 < LANDZ) { /* landing on the north side is fine: the land */ }
    st.leapTo = new THREE.Vector3(_w.x + ox * 6.5, 0, _w.z + oz * 6.5); const r = Math.hypot(st.leapTo.x, st.leapTo.z); if (r > GR - 1.5) st.leapTo.multiplyScalar((GR - 1.5) / r);
    st.heli && (st.heli.st = 'out'); st.boat = null; st.poops.length = 0; st.thug && (st.thug.T.busy = false, st.thug.T.J.root.visible = false, st.thug = null); st.pan = null; st.item = null;
    setPig(st.pig, 'flee', 9); DUELS.banner('ALL 5 FACES WRECKED!<small>JUMP, HAROLD!</small>', 2.2); sfx('heavy'); DUELS.log.push('pigeon:collapse');
  }
  function collapse(st, dt) {
    const t = st.pt; pigeon1(st, dt); falls(st, dt);
    const u = clamp(t / 1.3, 0, 1); V.lerpVectors(st.leapFrom, st.leapTo, ease(u)); st.leapP = V.clone(); st.leapP.y = lerp(st.leapFrom.y, 0, u * u) + Math.sin(u * Math.PI) * 3;
    st.mav.x = damp(st.mav.x, st.leapTo.x + 1.6, 2, dt); st.mav.z = damp(st.mav.z, st.leapTo.z + 0.8, 2, dt);
    if (t > 0.5) P.shake = Math.max(P.shake, 0.25);
    if (t > 1.0) { const k = t - 1.0, sink = Math.min(ROOFY + 8, 2.2 * k * k + 4 * k); P.towerG.position.y = -sink; P.towerG.position.x = Math.sin(t * 37) * 0.25; P.towerG.position.z = Math.cos(t * 31) * 0.25;
      if (Math.random() < dt * 60 && sink < ROOFY + 6) { const a = rnd(0, TAU), r = R + rnd(-1, 2); puff(V.set(Math.sin(a) * r, rnd(0, 4), Math.cos(a) * r), 1, rnd(3, 5.5), rnd(0.8, 2), 2.6); }
      if (t > 1.4 && !st.rub) { st.rub = true; P.rubble.visible = true; P.rubble.scale.set(1, 0.01, 1); }
      if (st.rub) P.rubble.scale.y = clamp((t - 1.4) / 3, 0.01, 1);
      if (sink >= ROOFY + 7.9) P.towerG.visible = false; }
    if (t > 5.2) { st.ph = 'tally'; st.pt = 0; st.tallyN = 0; showTally(st); }
  }
  function showTally(st) {
    const S = st.stats, rows = [['WINDOWS SMASHED', S.windows, 50], ['FLOORS BUSTED', S.floors, 1000], ['FACES WRECKED', 5, 1000], ['PIGEON HITS', S.pigeonHits, 250], ['CHOPPERS SWATTED', S.helis, 500], ['THUGS EATEN', S.eaten, 300], ['THUGS IN THE HARBOR', S.harbor, 200]];
    TALLY.innerHTML = '<h3>' + TXT.score[7] + '</h3>' + rows.map(([n, c, p]) => `<div><span>${n} \u00d7${c}</span><span>${(c * p).toLocaleString('en-US')}</span></div>`).join('') + `<div class="t"><span>SCORE</span><span>${Math.round(st.score).toLocaleString('en-US')}</span></div>`;
    faceHud(st, true); TALLY.classList.add('on'); st.tallyRows = [...TALLY.querySelectorAll('div')]; sfx('jump');
  }
  function tally(st, dt) {
    const n = Math.min(st.tallyRows.length, Math.floor(st.pt / 0.35) + 1); while (st.tallyN < n) { st.tallyRows[st.tallyN++].classList.add('on'); sfx('hit'); }
    for (let i = 0; i < P.fx.dust.length; i++) P.fx.dust[i].life = Math.min(P.fx.dust[i].life, P.fx.dust[i].t + 1.5);
    if (st.pt > 4.6) { const hp0 = Math.max(55, Math.round(st.pigHP)); TALLY.classList.remove('on'); reset2(hp0); P.st.ph = 'intro2'; DUELS.banner('PART 2<small>KNOCK HIM INTO THE HARBOR!</small>', 2.2); DUELS.say('PENTHOUSE PIGEON', TXT.ground[0], 2.8); DUELS.log.push('pigeon:part2'); }
  }

  // ================= PART 2: THE GROUND FIGHT =================
  function inRing(x, z, wide) { // keep walkers on the promenade between the rubble and the rail (wide: the whole pier, for the harbor finish)
    let dx = x - C2.x, dz = z - C2.z, d = Math.hypot(dx, dz); if (!wide && d > C2.r) { x = C2.x + dx / d * C2.r; z = C2.z + dz / d * C2.r; }
    const r = Math.hypot(x, z); if (r < RUB) { x *= RUB / r; z *= RUB / r; } if (Math.hypot(x, z) > GR - 0.6) { const k = (GR - 0.6) / Math.hypot(x, z); x *= k; z *= k; }
    return [x, z];
  }
  function step2(st, dt, I) {
    st.pt += dt; st.t += dt; st.inv -= dt; st.hurtT -= dt; st.stunT -= dt; st.smashCd -= dt; st.tongueCd -= dt;
    if (st.smashT >= 0) { st.smashT += dt; if (st.smashT > 0.32) st.smashT = -1; } if (st.tongueT >= 0) { st.tongueT += dt; if (st.tongueT > 0.32) st.tongueT = -1; }
    if (st.ph === 'intro2') { if (st.pt > 2.0) { st.ph = 'fight'; st.pt = 0; } mavis(st, dt); return; }
    if (st.ph === 'dead') return;
    if (st.ph === 'won') { st.pig.pos.y -= dt * 1.2; return; }
    // ---- Harold walks (camera-relative), slips on puddles, hops
    const f = V.copy(P.cam.position).sub(V2.set(st.x, 0, st.z)); f.y = 0; f.normalize().negate(); const rx = -f.z, rz = f.x; // forward + right on the ground
    let wx = (I.mx * rx + I.my * f.x), wz = (I.mx * rz + I.my * f.z); const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    st.slip = st.puds.some((p) => Math.hypot(p.x - st.x, p.z - st.z) < 1.0) && st.jumpT < 0 ? 1 : 0;
    if (st.slip) once(st, 'slip', () => DUELS.tell('SLIPPERY! POOP PUDDLE', 0.9));
    const canMove = st.stunT <= 0 && st.slamT <= 0, acc = st.slip ? 2.5 : 22, fr = st.slip ? 0.4 : 10, sp = st.smashT >= 0 ? 1.6 : 4.8;
    if (canMove) { st.vx += (wx * sp - st.vx) * (1 - Math.exp(-acc * dt)) * (wl > 0.05 ? 1 : 0); st.vz += (wz * sp - st.vz) * (1 - Math.exp(-acc * dt)) * (wl > 0.05 ? 1 : 0); }
    if (wl <= 0.05 || !canMove) { st.vx *= Math.exp(-fr * dt); st.vz *= Math.exp(-fr * dt); }
    st.x += st.vx * dt; st.z += st.vz * dt; [st.x, st.z] = inRing(st.x, st.z, st.pig.m === 'finish');
    if (Math.hypot(st.vx, st.vz) > 0.4) st.yaw = Math.atan2(st.vx, st.vz);
    if (st.jumpT >= 0) { st.jumpT += dt; st.hy = Math.sin(clamp(st.jumpT / 0.55, 0, 1) * Math.PI) * 1.1; if (st.jumpT > 0.55) { st.jumpT = -1; st.hy = 0; } }
    const pig = st.pig;
    if (canMove && st.ph === 'fight') {
      if (I.b && st.jumpT < 0) { st.jumpT = 0; sfx('jump'); }
      if (I.a && st.smashCd <= 0) { st.smashCd = 0.3; st.smashT = 0; sfx('swing'); smash2(st); }
      if (I.c && st.tongueCd <= 0) { st.tongueCd = 0.5; st.tongueT = 0; tongue2(st); }
    }
    if (st.slamT > 0) st.slamT -= dt;
    pigeon2(st, dt); poops2(st, dt); mavis(st, dt); sayTaunt(st, dt);
    st.hudT -= dt; if (st.hudT <= 0) { st.hudT = 0.2; DUELS.sub(scoreHtml(st), pig.m === 'finish' ? 'KNOCK HIM IN!' : 'GROUND FIGHT'); DUELS.bars(st.hp / 100, st.pigHP / 100); }
  }
  const pigD = (st) => Math.hypot(st.pig.pos.x - st.x, st.pig.pos.z - st.z);
  function smash2(st) {
    const pig = st.pig, d = pigD(st), dy = Math.abs(pig.pos.y - st.hy);
    if (st.pig.m !== 'dazed' && st.pig.m !== 'finish' && d < 3) st.yaw = Math.atan2(pig.pos.x - st.x, pig.pos.z - st.z);
    if (d > 2.5 || dy > 2.2) return;
    st.yaw = Math.atan2(pig.pos.x - st.x, pig.pos.z - st.z);
    if (pig.m === 'finish') { const k = 1 / Math.max(0.3, d), r = Math.hypot(pig.pos.x, pig.pos.z) || 1; V3.set((pig.pos.x - st.x) * k + pig.pos.x / r * 0.5, 0, (pig.pos.z - st.z) * k + pig.pos.z / r * 0.5).normalize(); pig.kb.set(V3.x * 7, 0, V3.z * 7); pig.kbT = 0.42; flashPig(); sfx('heavy'); spark(V.copy(pig.pos).setY(1.4), 8); addScore(st, 150, V.clone().setY(2.4), '+150'); DUELS.log.push('pigeon:knock'); return; }
    if (pig.m === 'dazed') { pig.combo++; const dmg = pig.combo % 4 === 0 ? 8 : 4; hitPigeon(st, dmg, 'combo', V.copy(pig.pos).setY(1.2)); if (pig.combo % 4 === 0) DUELS.tell('COMBO \u00d7' + pig.combo + '!', 0.7); }
    else if (pig.m === 'dive' || pig.m === 'walk' || pig.m === 'peckTell' || pig.m === 'land') { hitPigeon(st, 4, 'punch', V.copy(pig.pos).setY(pig.pos.y + 1.2)); if (pig.m === 'dive') setPig(pig, 'land', 0.7); else { pig.peckCd = Math.max(pig.peckCd, 0.8); } }
    checkFinish(st);
  }
  function tongue2(st) {
    const pig = st.pig; V.set(st.x, st.hy + 1.1, st.z); V2.copy(pig.pos).setY(pig.pos.y + 1.2);
    if ((pig.m === 'dive' || pig.m === 'divePrep') && V2.distanceTo(V) < 3.4) { st.tongueP.copy(V2); setPig(pig, 'grabbed', 0.42); st.slamT = 1.0; st.yaw = Math.atan2(pig.pos.x - st.x, pig.pos.z - st.z); DUELS.tell(TXT.score[6] + ' SLAM HIM!', 1.0); sfx('jump'); addScore(st, 200, V2.clone(), '+200'); DUELS.log.push('pigeon:grab'); return; }
    st.tongueP.copy(V).add(V3.set(Math.sin(st.yaw) * 2.4, 0, Math.cos(st.yaw) * 2.4));
  }
  function checkFinish(st) { const pig = st.pig; if (st.pigHP <= 0 && pig.m !== 'finish' && pig.m !== 'splash') { st.pigHP = 0; setPig(pig, 'finish', 99); pig.pos.y = 0; DUELS.banner('HE\u2019S DIZZY!<small>KNOCK HIM INTO THE HARBOR</small>', 2.2); DUELS.log.push('pigeon:finish'); } }
  function pigeon2(st, dt) {
    const pig = st.pig; pig.mt += dt; const d = pigD(st); const toH = Math.atan2(st.x - pig.pos.x, st.z - pig.pos.z);
    const ground = (spd) => { const nx = pig.pos.x + Math.sin(pig.yaw) * spd * dt, nz = pig.pos.z + Math.cos(pig.yaw) * spd * dt; [pig.pos.x, pig.pos.z] = inRing(nx, nz); };
    switch (pig.m) {
      case 'walk': pig.pos.y = damp(pig.pos.y, 0, 10, dt); pig.yaw = toH; pig.walkT += dt; pig.peckCd -= dt; if (d > 2.0) ground(1.8);
        pig.pudT -= dt; if (pig.pudT <= 0) { pig.pudT = rnd(2.4, 3.4); if (st.puds.length < 6) st.puds.push({ x: pig.pos.x - Math.sin(pig.yaw) * 1.2, z: pig.pos.z - Math.cos(pig.yaw) * 1.2, t: 0 }); }
        if (d < 2.7 && pig.peckCd <= 0) setPig(pig, 'peckTell', 0.6);
        else if (pig.walkT > 6.5 || pig.pecks >= 2) { pig.walkT = 0; pig.pecks = 0; setPig(pig, 'takeoff', 0.7); DUELS.tell('HE\u2019S TAKING OFF! WATCH THE SHADOWS', 1.0); }
        break;
      case 'peckTell': pig.yaw = toH; if (pig.mt > pig.md) setPig(pig, 'peck', 0.24); break;
      case 'peck': if (!pig.hitThis && pig.mt > 0.1) { pig.hitThis = true; pig.pecks++; const fwd = Math.cos(toH - pig.yaw); if (d < 2.6 && fwd > 0.4 && hurtHarold(st, 10, 'peck')) { st.vx += Math.sin(pig.yaw) * 6; st.vz += Math.cos(pig.yaw) * 6; DUELS.tell('PECK!', 0.5); } }
        if (pig.mt > pig.md) { pig.peckCd = 1.3; setPig(pig, 'walk', 0); } break;
      case 'takeoff': pig.pos.y = damp(pig.pos.y, 6.5, 3, dt); if (pig.mt > pig.md) { const a = rnd(0, TAU); pig.from.set(st.x - Math.sin(a) * 9, 6.5, st.z - Math.cos(a) * 9); pig.to.set(st.x + Math.sin(a) * 9, 6.5, st.z + Math.cos(a) * 9); pig.drops = 0; setPig(pig, 'bomb', 2.6); } break;
      case 'bomb': { const u = clamp(pig.mt / pig.md, 0, 1); V.lerpVectors(pig.from, pig.to, u); pig.pos.lerp(V, 1 - Math.exp(-10 * dt)); pig.yaw = Math.atan2(pig.to.x - pig.from.x, pig.to.z - pig.from.z);
        const want = Math.floor(clamp((u - 0.2) / 0.6, 0, 0.999) * 5) + (u > 0.2 ? 1 : 0); while (pig.drops < want) { pig.drops++; st.poops.push({ x: pig.pos.x, z: pig.pos.z, y: pig.pos.y - 0.4, vy: 0, hit: false }); sfx('swing'); }
        if (pig.mt > pig.md) setPig(pig, 'divePrep', 1.1); break; }
      case 'divePrep': { const a = Math.atan2(pig.pos.x - st.x, pig.pos.z - st.z); V.set(st.x + Math.sin(a) * 9, 5, st.z + Math.cos(a) * 9); pig.pos.lerp(V, 1 - Math.exp(-3 * dt)); pig.yaw = toH;
        if (pig.mt > pig.md) { pig.from.copy(pig.pos); const dx = st.x - pig.pos.x, dz = st.z - pig.pos.z, l = Math.hypot(dx, dz) || 1; pig.to.set(st.x + dx / l * 5, 0.9, st.z + dz / l * 5); pig.diveL = l; setPig(pig, 'dive', 1.3); DUELS.tell('HE\u2019S DIVING LOW! TONGUE-GRAB HIM!', 1.1); } break; }
      case 'dive': { const u = clamp(pig.mt / pig.md, 0, 1); pig.pos.x = lerp(pig.from.x, pig.to.x, u); pig.pos.z = lerp(pig.from.z, pig.to.z, u); pig.pos.y = lerp(pig.from.y, 0.4, ease(clamp(u * 1.7, 0, 1))); pig.yaw = Math.atan2(pig.to.x - pig.from.x, pig.to.z - pig.from.z);
        if (!pig.hitThis && d < 1.3 && pig.pos.y < 2) { pig.hitThis = true; if (hurtHarold(st, 10, 'dive')) DUELS.tell('DIVE-BOMBED!', 0.6); }
        if (pig.mt > pig.md) setPig(pig, 'land', 0.6); break; }
      case 'grabbed': { V.set(st.x + Math.sin(st.yaw) * 1.2, 1.4, st.z + Math.cos(st.yaw) * 1.2); pig.pos.lerp(V, 1 - Math.exp(-12 * dt)); st.tongueP.copy(pig.pos).setY(pig.pos.y + 0.8); st.tongueT = 0.05;
        if (pig.mt > pig.md) { setPig(pig, 'slam', 0.4); } break; }
      case 'slam': { pig.pos.y = Math.max(0, pig.pos.y - dt * 12); if (!pig.hitThis && pig.mt > 0.18) { pig.hitThis = true; hitPigeon(st, 12, 'slam', V.copy(pig.pos).setY(0.6)); P.shake = 0.6; puff(V, 5, 1.4, 0.4, 1); DUELS.tell('SLAM! NOW COMBO HIM!', 1.0); }
        if (pig.mt > pig.md) { pig.combo = 0; setPig(pig, 'dazed', 3.4); checkFinish(st); } break; }
      case 'dazed': pig.pos.y = 0; pig.mavT -= dt; if (Math.hypot(st.mav.x - pig.pos.x, st.mav.z - pig.pos.z) < 1.6 && pig.mavT <= 0) { pig.mavT = 1.0; st.mav.swingT = 0; st.pigHP = Math.max(0, st.pigHP - 2); flashPig('#ffb0d0', 0.5); sfx('hit'); }
        if (Math.random() < dt * 8) spark(V.copy(pig.pos).setY(2.6), 1, 1.2, 0); checkFinish(st); if (pig.m === 'dazed' && pig.mt > pig.md) setPig(pig, 'walk', 0); break;
      case 'land': pig.pos.y = damp(pig.pos.y, 0, 8, dt); if (pig.mt > pig.md) setPig(pig, 'walk', 0); break;
      case 'finish': { pig.pos.y = 0; if (pig.kbT > 0) { pig.kbT -= dt; pig.pos.x += pig.kb.x * dt; pig.pos.z += pig.kb.z * dt; const r = Math.hypot(pig.pos.x, pig.pos.z); if (r < RUB) { pig.pos.x *= RUB / r; pig.pos.z *= RUB / r; } }
        else { pig.yaw += dt * 2.2; pig.pos.x += Math.sin(pig.yaw) * 0.5 * dt; pig.pos.z += Math.cos(pig.yaw) * 0.5 * dt; const r = Math.hypot(pig.pos.x, pig.pos.z), k = clamp(r, RUB, GR - 0.8) / r; pig.pos.x *= k; pig.pos.z *= k; }
        if (Math.random() < dt * 8) spark(V.copy(pig.pos).setY(2.6), 1, 1.2, 0);
        if (isWater(pig.pos.x, pig.pos.z) || (pig.kbT > 0 && Math.hypot(pig.pos.x, pig.pos.z) > GR - 0.3 && pig.pos.z > LANDZ)) { setPig(pig, 'splash', 1.6); const r = Math.hypot(pig.pos.x, pig.pos.z); pig.kb.set(pig.pos.x / r * 4, 0, pig.pos.z / r * 4); sfx('heavy'); JUICE.ko(); DUELS.log.push('pigeon:splash'); }
        break; }
      case 'splash': { pig.pos.x += pig.kb.x * dt; pig.pos.z += pig.kb.z * dt; pig.pos.y = pig.mt < 0.4 ? Math.sin(pig.mt / 0.4 * Math.PI) * 1.2 : -(pig.mt - 0.4) * 2.5;
        if (!pig.splashed && pig.pos.y < -0.4) { pig.splashed = true; spark(V.copy(pig.pos).setY(-0.2), 26, 4.5, 9); puff(V, 5, 2, 1.5, 1.2); sfx('ko'); }
        if (pig.mt > pig.md && !st.won) win(st); break; }
    }
    if (pig.pos.y < 0 && pig.m !== 'splash') pig.pos.y = 0;
  }
  function poops2(st, dt) {
    for (let i = st.poops.length - 1; i >= 0; i--) { const p = st.poops[i]; p.vy -= 9.8 * dt; p.y += p.vy * dt;
      if (p.y <= 0.1) { if (Math.hypot(p.x - st.x, p.z - st.z) < 0.95 && st.hy < 0.6) { st.stats.poops++; if (hurtHarold(st, 8, 'bomb')) DUELS.tell('SPLAT!', 0.5); } else { const [x, z] = inRing(p.x, p.z); if (st.puds.length < 8 && Math.random() < 0.5) st.puds.push({ x, z, t: 0 }); }
        puff(V.set(p.x, 0.2, p.z), 2, 0.8, 0.3, 0.7); st.poops.splice(i, 1); } }
    for (let i = st.puds.length - 1; i >= 0; i--) { st.puds[i].t += dt; if (st.puds[i].t > 12) st.puds.splice(i, 1); }
  }
  function win(st) {
    st.won = true; st.over = true; st.ph = 'won'; addScore(st, 5000, V.set(st.x, 2.5, st.z), 'HARBOR KO +5000', 'b'); faceHud(st, true); DUELS.sub(scoreHtml(st), 'K.O.!');
    const l = lines(); if (l) DUELS.say('PENTHOUSE PIGEON', pick(l.defeat), 3.6);
    DUELS.banner('SPLASHDOWN!<small>THE PENTHOUSE PIGEON IS ALL WET</small>', 3); DUELS.bossCleared(LM, 'pigeon-climb'); DUELS.log.push('pigeon:win:' + Math.round(st.score));
    setTimeout(() => { if (DUELS.cur === P) DUELS.over('win', 'THE PENTHOUSE PIGEON<br>IS ALL WET', 'Final score ' + Math.round(st.score).toLocaleString('en-US') + '. The World Trade Center is clear. Crime at the WTC: 0. (The tower is back up: it only fell in the fight.)'); }, SIM ? 400 : 2400);
  }

  P.step = function (dt, I) { const st = P.st; if (!st) return; if (st.part === 1) step1(st, dt, I); else step2(st, dt, I); stepFx(dt); };

  // ---------------- fx ----------------
  function stepFx(dt) {
    const D = P.fx.dust, S2 = P.fx.spark;
    for (let i = D.length - 1; i >= 0; i--) { const p = D[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 0.8); p.p.addScaledVector(p.v, dt); if (p.t > p.life) D.splice(i, 1); }
    for (let i = S2.length - 1; i >= 0; i--) { const p = S2[i]; p.t += dt; p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) S2.splice(i, 1); }
  }
  function drawFx() {
    const q = P.cam.quaternion, D = P.fx.dust, S2 = P.fx.spark;
    D.forEach((p, i) => { const s = p.s * (0.5 + p.t * 1.1); M4.compose(p.p, q, V.set(s, s, s)); P.dustM.setMatrixAt(i, M4); }); P.dustM.count = D.length; P.dustM.visible = D.length > 0; P.dustM.instanceMatrix.needsUpdate = true;
    S2.forEach((p, i) => { M4.compose(p.p, q, ONE); P.sparkM.setMatrixAt(i, M4); }); P.sparkM.count = S2.length; P.sparkM.visible = S2.length > 0; P.sparkM.instanceMatrix.needsUpdate = true;
    const st = P.st, po = st.poops || []; let ns = 0;
    po.forEach((p, i) => { if (st.part === 1) { onWall(p.s, p.off); V.set(_w.x, p.y, _w.z); } else V.set(p.x, p.y, p.z); M4.compose(V, QQ.identity(), V2.set(1, 1.2, 1)); P.poopM.setMatrixAt(i, M4);
      if (st.part === 1) { if (p.y > st.y + 0.5 && Math.abs(dS(p.s, st.s)) < 4) { onWall(p.s, 0.2); const k = clamp(1 - (p.y - st.y - 1) / 18, 0.2, 1); QQ.setFromAxisAngle(UPV, Math.atan2(_w.nx, _w.nz)); M4.compose(V.set(_w.x, st.y + 1.3, _w.z), QQ, V2.set(k * 1.1, k * 1.4, 1)); P.shadM.setMatrixAt(ns++, M4); } }
      else { QQ.setFromAxisAngle(V3.set(1, 0, 0), -Math.PI / 2); const k = clamp(1 - p.y / 7, 0.25, 1); M4.compose(V.set(p.x, 0.04, p.z), QQ, V2.set(k, k, 1)); P.shadM.setMatrixAt(ns++, M4); } });
    QQ.identity(); P.poopM.count = po.length; P.poopM.visible = po.length > 0; P.poopM.instanceMatrix.needsUpdate = true;
    if (st.part === 2 && ['takeoff', 'bomb', 'divePrep', 'dive'].includes(st.pig.m) && !isWater(st.pig.pos.x, st.pig.pos.z)) { QQ.setFromAxisAngle(V3.set(1, 0, 0), -Math.PI / 2); const k = clamp(1.4 - st.pig.pos.y / 8, 0.4, 1.3); M4.compose(V.set(st.pig.pos.x, 0.05, st.pig.pos.z), QQ, V2.set(k * 1.6, k * 1.6, 1)); P.shadM.setMatrixAt(ns++, M4); }
    P.shadM.count = ns; P.shadM.visible = ns > 0; P.shadM.instanceMatrix.needsUpdate = true;
    const pu = st.puds || []; QQ.setFromAxisAngle(V3.set(1, 0, 0), -Math.PI / 2); pu.forEach((p, i) => { const k = clamp(p.t * 4, 0.2, 1) * (p.t > 11 ? 12 - p.t : 1); M4.compose(V.set(p.x, 0.03, p.z), QQ, V2.set(k, k * 0.8, 1)); P.pudM.setMatrixAt(i, M4); }); QQ.identity();
    P.pudM.count = pu.length; P.pudM.visible = pu.length > 0; P.pudM.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses ----------------
  function climbPose(st, t) {
    const p = blank(), ph = st.climbPh, s = Math.sin(ph), c = Math.cos(ph);
    p.shL = [-2.7 + s * 0.35, 0, 0.45]; p.elL = [-0.5 - Math.max(0, s) * 0.6, 0, 0]; p.shR = [-2.7 - s * 0.35, 0, -0.45]; p.elR = [-0.5 - Math.max(0, -s) * 0.6, 0, 0];
    p.lgL = [-0.7 - c * 0.35, 0, 0.25]; p.knL = [1.1 + c * 0.4, 0, 0]; p.lgR = [-0.7 + c * 0.35, 0, -0.25]; p.knR = [1.1 - c * 0.4, 0, 0]; p.ftL = p.ftR = [0.5, 0, 0];
    p.torso = [0.12, 0, 0]; p.neck = [-0.25, 0, 0]; p.swR = [Math.PI - 0.4, 0, 0]; p.swL = [Math.PI / 2, 0, 0]; p.y = -0.05; return p;
  }
  function haroldPose(st, t) {
    if (st.part === 1) {
      if (st.ph === 'collapse') return HERO_POSES.jump(st.pt < 0.65 ? 1 : -1);
      if (st.ph === 'dead') { const p = HERO_POSES.jump(-1); p.tilt = [st.pt * 4, 0, 0]; return p; }
      if (st.ph === 'tally') return HERO_POSES.idle(t);
      if (st.fallT > 0 || st.jumpT >= 0) { const p = HERO_POSES.jump(st.fallT > 0 ? -1 : 1); if (st.fallT > 0) { p.shL = [-2.9, 0, 0.9]; p.shR = [-2.9, 0, -0.9]; } return p; }
      if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
      if (st.smashT >= 0) { const p = HERO_POSES.atk1(clamp(st.smashT / 0.3, 0, 1)); p.shL = [-2.6, 0, 0.45]; p.elL = [-0.5, 0, 0]; return p; }
      const p = climbPose(st, t); if (st.tongueT >= 0) p.neck = [0.2, 0, 0]; if (st.ride) { legsStance(p, 0.18, 0.3); p.shL = [-2.9, 0, 0.3]; p.shR = [-2.9, 0, -0.3]; } return p;
    }
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.jumpT >= 0) return HERO_POSES.jump(st.jumpT < 0.27 ? 1 : -1);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    if (st.smashT >= 0) return HERO_POSES.atk1(clamp(st.smashT / 0.32, 0, 1));
    if (st.slamT > 0) { const p = HERO_POSES.atk3(clamp(1 - st.slamT, 0, 1)); return p; }
    const sp = Math.hypot(st.vx, st.vz); if (sp > 0.6 && !st.slip) return HERO_POSES.run(t, sp);
    const p = HERO_POSES.idle(t); if (st.slip) { p.shL = [-0.4, 0, 1.2]; p.shR = [-0.4, 0, -1.2]; p.tilt = [0, 0, Math.sin(t * 9) * 0.2]; } if (st.won) { p.shR = [-2.8, 0, -0.3]; p.y += Math.abs(Math.sin(t * 6)) * 0.12; } return p;
  }
  function mavisPose(st, t) {
    const M = st.mav; if (M.swingT >= 0) return HERO_POSES.atk1(clamp(M.swingT / 0.5, 0, 1));
    if (M.moving) return HERO_POSES.run(t, 4);
    const p = HERO_POSES.idle(t), w = Math.sin(t * 9); p.shL = [-2.6 - w * 0.3, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.05; return p;
  }
  function posePigeon(st, dt) {
    const pig = st.pig, R2 = P.R, t = st.t, m = pig.m; let flap = 0.25 + Math.sin(t * 2) * 0.05, fly = false, head = 0, bob = 0, tilt = 0;
    switch (m) {
      case 'perch': bob = Math.sin(t * 7) * 0.12; head = 0.5; break; // peering down the wall
      case 'circle': case 'return': case 'takeoff': case 'divePrep': case 'flee': fly = true; break;
      case 'swoopTell': case 'swoop': case 'bomb': case 'dive': fly = true; tilt = 0.35; break;
      case 'hurt': fly = true; tilt = -0.6; break;
      case 'walk': bob = Math.sin(t * 9) * 0.16; head = Math.max(0, Math.sin(t * 9)) * 0.25; break;
      case 'peckTell': head = -0.7; bob = -0.25; break;
      case 'peck': head = 1.1; bob = 0.35; break;
      case 'grabbed': flap = 1.0 + Math.sin(t * 40) * 0.5; tilt = 0.6; break;
      case 'slam': case 'dazed': case 'finish': flap = -0.3; tilt = m === 'slam' ? 1.2 : 0.15; head = 0.4 + Math.sin(t * 5) * 0.3; break;
      case 'land': flap = 0.9; break;
      case 'splash': flap = 1.0 + Math.sin(t * 30) * 0.6; tilt = 0.5; break;
    }
    if (fly) flap = Math.sin(t * (m === 'swoop' || m === 'dive' ? 6 : 14)) * 0.9 + (m === 'swoop' || m === 'dive' ? 0.2 : 0.1);
    pig.flap = damp(pig.flap, flap, 18, dt);
    if (R2.wings[0]) R2.wings[0].rotation.z = pig.flap; if (R2.wings[1]) R2.wings[1].rotation.z = -pig.flap;
    R2.head.rotation.x = damp(R2.head.rotation.x, head, 14, dt); R2.head.position.z = (P.headZ || 0) + bob;
    P.pig.position.copy(pig.pos); P.pig.rotation.set(tilt, pig.yaw, m === 'dazed' || m === 'finish' ? Math.sin(t * 4) * 0.12 : 0); P.pig.scale.setScalar(1.15);
    if (m === 'slam') P.pig.rotation.z = 1.4;
    for (const mm of R2.flash) if (mm && mm.userData && mm.userData.flash) mm.userData.flash.value = Math.max(0, mm.userData.flash.value - dt * 4);
    if ((m === 'peckTell' || m === 'divePrep') && R2.flash[0] && R2.flash[0].userData.flash) { R2.flash[0].userData.flashC.value.set('#ff3d3d'); R2.flash[0].userData.flash.value = Math.max(R2.flash[0].userData.flash.value, 0.2 + 0.25 * (Math.sin(t * 30) * 0.5 + 0.5)); }
    if (R2.update) { try { R2.update(dt, { mode: m, t: pig.mt, part: st.part, hp: st.pigHP }); } catch (e) { console.error(e); R2.update = null; } }
  }

  // ---------------- render ----------------
  P.render = function (rdt) {
    const st = P.st; if (!st) return; const dt = SIM ? SIM / 60 : rdt, t = st.t, port = VH() > VW();
    const H = P.H; let hx, hy, hz, hyaw;
    if (st.part === 1) {
      if (st.ph === 'collapse' && st.leapP) { hx = st.leapP.x; hy = st.leapP.y; hz = st.leapP.z; hyaw = Math.atan2(st.leapTo.x - st.leapFrom.x, st.leapTo.z - st.leapFrom.z); }
      else if (st.ph === 'tally') { hx = st.leapTo.x; hy = 0; hz = st.leapTo.z; hyaw = Math.atan2(-st.leapTo.x, -st.leapTo.z); }
      else { onWall(st.s, 0.62); hx = _w.x; hy = st.y; hz = _w.z; hyaw = Math.atan2(-_w.nx, -_w.nz); if (st.ph === 'dead') { hx += _w.nx * st.pt * 2; hz += _w.nz * st.pt * 2; } }
    } else { hx = st.x; hy = st.hy; hz = st.z; hyaw = st.yaw; }
    H.root.position.set(hx, hy, hz); H.root.rotation.y = hyaw; H.root.scale.setScalar(st.part === 1 && st.ph !== 'tally' ? 1.3 : 1); applyPose(H, haroldPose(st, t), st.part === 1 && st.smashT < 0 ? 12 : 18, dt, false);
    if (H.mat && H.mat.userData && H.mat.userData.flash) H.mat.userData.flash.value = Math.max(0, H.mat.userData.flash.value - dt * 4);
    // Mavis
    const M = st.mav, mm = P.M; const oldx = mm.root.position.x, oldz = mm.root.position.z; mm.root.position.set(M.x, 0, M.z); M.moving = Math.hypot(M.x - oldx, M.z - oldz) > dt * 1.2;
    mm.root.rotation.y = M.tgt ? Math.atan2(M.tgt.p.x - M.x, M.tgt.p.z - M.z) : st.part === 1 ? Math.atan2(-M.x, -M.z) : Math.atan2(st.pig.pos.x - M.x, st.pig.pos.z - M.z); applyPose(mm, mavisPose(st, t), 12, dt, false);
    posePigeon(st, dt);
    // window thug / falling thugs
    for (const T of P.thugs) T.J.root.visible = false;
    if (st.thug) { const T = st.thug.T, w = P.W[st.thug.i], F = FACE[w.f], u = PIER + (w.c + 0.5) * CW; T.J.root.visible = true; T.J.root.position.set(F.ax + F.tx * u + F.nx * 0.15, winY(w.k) - 1.25, F.az + F.tz * u + F.nz * 0.15); T.J.root.rotation.set(0.25, Math.atan2(F.nx, F.nz), 0); T.J.root.scale.setScalar(0.95);
      applyPose(T.J, st.thug.t > 2.1 ? THUG_POSES.attack(clamp((st.thug.t - 2.1) / 0.5, 0, 1), T.J) : THUG_POSES.windup(0, T.J), 14, dt, false); }
    for (const f of st.falls || []) { const J = f.T.J; J.root.visible = true; J.root.position.copy(f.p); J.root.rotation.set(f.st === 'ground' ? 0 : f.t * f.spin, 0, f.st === 'ground' ? 0 : f.t * 2); J.root.scale.setScalar(0.95); applyPose(J, f.st === 'ground' ? THUG_POSES.down(1, true) : THUG_POSES.hurt(0.2, J), 14, dt, f.st !== 'ground'); }
    // items in windows
    for (const k in P.items) P.items[k].visible = false;
    if (st.item) { const m = P.items[st.item.kind]; winPos(st.item.i, V); chest(st, V2); V.lerp(V2, ease(clamp(st.item.t / 0.55, 0, 1))); m.visible = true; m.position.copy(V); m.rotation.set(0.5, st.t * 6, 0); m.scale.setScalar(st.item.kind === 'mallet' ? 1.6 : 1.4); }
    if (st.pan) { const m = P.items.pan, w = P.W[st.pan.i], F = FACE[w.f]; winPos(st.pan.i, V); const k = clamp((st.pan.t - 0.3) / 0.25, 0, 1); m.visible = true; m.position.copy(V).addScaledVector(V2.set(F.nx, 0, F.nz), 0.3 + k * 0.9); m.rotation.set(-Math.PI / 2 + k * 1.4, Math.atan2(F.nx, F.nz), 0); m.scale.setScalar(1.6); }
    P.malletM.visible = !!st.mallet;
    // tongue
    if (st.tongueT >= 0) { H.head.getWorldPosition(V); V.y += 0.1; const u = st.tongueT < 0.12 ? st.tongueT / 0.12 : clamp(1 - (st.tongueT - 0.12) / 0.2, 0, 1); V2.copy(st.tongueP).sub(V); const L = V2.length() * u; P.tongue.visible = L > 0.05; if (P.tongue.visible) { P.tongue.position.copy(V); P.tongue.quaternion.setFromUnitVectors(UPV, V2.normalize()); P.tongue.scale.set(1, L, 1); } }
    else P.tongue.visible = false;
    // cracks: reveal = face damage
    if (st.part === 1) st.dmg.forEach((d, f) => { const c = P.cracks[f]; c.visible = d > 0.01; c.material.alphaTest = 1.01 - Math.min(1, d) * 0.99; });
    // heli + spotlight
    const Hc = st.part === 1 ? st.heli : null; P.heli.visible = !!Hc; P.beam.visible = P.spot.visible = !!Hc && Hc.st !== 'swat' && Hc.st !== 'out';
    if (Hc) { P.heli.position.copy(Hc.pos); P.heli.rotation.set(Hc.st === 'swat' ? 0.4 : 0.12, Hc.yaw, Hc.st === 'swat' ? Math.sin(Hc.t * 9) * 0.6 : 0); P.rotor.rotation.y += dt * 40;
      if (P.spot.visible) { onWall(Hc.spotS, 0.25); V.set(_w.x, Hc.spotY, _w.z); P.spot.position.copy(V); P.spot.rotation.set(0, Math.atan2(_w.nx, _w.nz), 0); const lk = clamp(Hc.lock / 0.85, 0, 1); P.spot.material.color.setRGB(1, 1 - lk * 0.6, 0.8 - lk * 0.6); P.spot.material.opacity = 0.35 + lk * 0.4;
        V2.copy(Hc.pos).setY(Hc.pos.y - 0.5); P.beam.position.copy(V2); V3.copy(V2).sub(V); P.beam.quaternion.setFromUnitVectors(UPV, V3.clone().normalize()); P.beam.scale.set(1, V3.length(), 1); } }
    // boat + water cannon
    const B = st.part === 1 ? st.boat : null; P.boat.visible = !!B; P.stream.visible = !!B && (B.st === 'spray' || (B.st === 'tell' && B.t > 0.4));
    if (B) { P.boat.position.set(B.x, -0.2 + Math.sin(st.t * 2) * 0.08 - (B.st === 'go' ? B.t * 0.1 : 0), B.z); P.boat.rotation.y = B.yaw; if (B.st === 'go') { B.x += Math.sin(B.yaw + 1.6) * dt * 6; B.z += Math.cos(B.yaw + 1.6) * dt * 6; }
      if (P.stream.visible) { V.set(B.x, 1.4, B.z); onWall(B.ws, 0.3); V2.set(_w.x, st.y + 1.1, _w.z); P.stream.position.copy(V); V3.copy(V2).sub(V); P.stream.quaternion.setFromUnitVectors(UPV, V3.clone().normalize()); P.stream.scale.set(B.st === 'tell' ? 0.25 : 1, V3.length(), B.st === 'tell' ? 0.25 : 1);
        if (B.st === 'spray' && Math.random() < dt * 30) spark(V2, 2, 2, 6); } }
    // platforms
    for (const p of P.plats) { const on = p.on && st.part === 1 && P.towerG.visible && st.ph !== 'collapse'; p.m.visible = p.cab.visible = p.cab2.visible = on; if (!on) continue;
      onWall(p.s, 0.05); const ry = Math.atan2(_w.nx, _w.nz); p.m.position.set(_w.x, p.y - 0.07, _w.z); p.m.rotation.y = ry; const F = FACE[_w.f];
      for (const [cb, sgn] of [[p.cab, 1], [p.cab2, -1]]) { cb.position.set(_w.x + F.tx * 1.15 * sgn + _w.nx * 0.65, p.y + 0.9, _w.z + F.tz * 1.15 * sgn + _w.nz * 0.65); cb.scale.y = Math.max(0.1, ROOFY - p.y - 0.9); } }
    drawFx(); popTick(dt);
    // ---- camera
    const cam = P.cam; cam.fov = port ? 62 : 52; cam.updateProjectionMatrix(); let tgtP = V.set(0, 0, 0), tgtL = V2.set(0, 0, 0);
    if (st.part === 1 && (st.ph === 'climb' || st.ph === 'intro' || st.ph === 'dead')) {
      onWall(st.s, 0); const a = Math.atan2(_w.nx, _w.nz); let da = a - P.camA; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; P.camA += da * (1 - Math.exp(-4 * dt));
      const D = port ? 29 : 21, cy = Math.max(2, st.y + (port ? 1.6 : 1.4)); const cx = Math.sin(P.camA), cz = Math.cos(P.camA);
      tgtP.set(_w.x * 0.35 + cx * (AP + D) * 0.85, cy, _w.z * 0.35 + cz * (AP + D) * 0.85); tgtL.set(_w.x * 0.8, st.y + (port ? 3.6 : 2.4), _w.z * 0.8);
      if (st.ph === 'intro') { const k = ease(clamp(st.pt / 2.4, 0, 1)); tgtP.lerp(V3.set(cx * 46, 14, cz * 46), 1 - k); tgtL.lerp(V3.set(0, ROOFY * 0.6, 0), 1 - k); }
    } else if (st.part === 1) { // collapse + tally: pull back, watch it come down
      const cx = Math.sin(P.camA), cz = Math.cos(P.camA); tgtP.set(cx * 46, 15, cz * 46); tgtL.set(0, st.ph === 'tally' ? 6 : 14, 0);
    } else {
      // beat-em-up framing from the harbor side, looking in at the rubble: the heap is always behind the action, the harbor (the finish) toward the camera
      const pig = st.pig, mx = clamp((st.x * 0.6 + pig.pos.x * 0.4), -8, 8), mz = clamp(st.z * 0.6 + pig.pos.z * 0.4, 8, 18);
      tgtP.set(mx * 0.75, port ? 9 : 6.8, mz + (port ? 11.5 : 9.5)); tgtL.set(mx, 1.0 + Math.min(2.5, pig.pos.y * 0.3), mz - (port ? 3.2 : 1.0));
      if (st.ph === 'won') { tgtP.set(pig.pos.x * 0.8, 4, pig.pos.z + 7); tgtL.set(pig.pos.x, 0.3, pig.pos.z); }
    }
    P.camP.lerp(tgtP, 1 - Math.exp(-(st.part === 1 && st.ph === 'climb' ? 6 : 3) * dt)); P.camL.lerp(tgtL, 1 - Math.exp(-6 * dt));
    P.shake = Math.max(0, P.shake - dt * 1.5); cam.position.copy(P.camP); if (P.shake > 0) cam.position.add(V3.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(P.shake * 0.5)); cam.lookAt(P.camL);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 70; OUT_U.fogF.value = 230;
    DUELS.hot(st.part === 2 && (st.pig.m === 'dive' || st.pig.m === 'divePrep') || (st.part === 1 && (st.pig.m === 'swoop' || !!(st.thug))));
  };
  P.onResize = () => {};

  // ---------------- test bot (?pigeonauto=win|lose) ----------------
  P.botThink = function (B, dt) {
    const st = P.st; B.mx = 0; B.my = 0; B.up = B.down = false; if (!st || st.over || B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt; B.tcd = (B.tcd || 0) - dt;
    if (st.part === 1) {
      if (st.ph !== 'climb') return; const pig = st.pig; chest(st, V);
      if ((pig.m === 'swoop' || pig.m === 'swoopTell') && pig.pos.distanceTo(V) < 3.0 && B.tcd <= 0) { B.c = true; B.tcd = 0.5; return; }
      if (st.heli && st.heli.st === 'hover' || st.heli && st.heli.st === 'in') { if (st.heli.pos.distanceTo(V) < 3.3 && B.cd <= 0) { B.a = true; B.cd = 0.3; return; } }
      if (st.thug && !st.thug.out && B.tcd <= 0) { winPos(st.thug.i, V2); if (V2.distanceTo(V) < 3.0) { B.c = true; B.tcd = 0.5; return; } }
      if (st.fallT > 0 || st.jumpT >= 0 || st.stunT > 0) return;
      // dodge: poop above me, the frying pan, a platform coming down on me
      let dodge = 0; for (const p of st.poops) if (p.y > st.y && p.y < st.y + 16 && Math.abs(dS(p.s, st.s)) < 1.2) dodge = dS(st.s, p.s) >= 0 ? 1 : -1;
      if (st.pan && !st.pan.hit) { const w = P.W[st.pan.i]; dodge = dS(st.s, winS(w.f, w.c)) >= 0 ? 1 : -1; }
      for (const p of P.plats) if (p.on && p.dir < 0 && p.wait <= 0 && Math.abs(dS(st.s, p.s)) < 1.6 && p.y > st.y + 1 && p.y < st.y + 5) dodge = dS(st.s, p.s) >= 0 ? 1 : -1;
      if (st.boat && st.boat.st === 'spray') return;
      if (dodge) { B.mx = dodge; return; }
      const f = Math.min(4, Math.floor(wrapS(st.s) / LEN));
      if (st.dmg[f] >= 1) { B.mx = 1; return; } // on to the next face (swing round the corner)
      if (st.mallet) { const i = winAt(st); if (i >= 0) { if (B.cd <= 0) { B.a = true; B.cd = 0.3; } return; } }
      // nearest intact, safe window on this face
      let best = -1, bd = 1e9; for (let k = 0; k < NF; k++) for (let c = 0; c < NC; c++) { const w = P.W[WI(f, k, c)]; if (w.broken || w.it === 'live') continue; const d = Math.abs(dS(winS(f, c), st.s)) + Math.abs(winY(w.k) - (st.y + 1.2)) * 0.8; if (d < bd) { bd = d; best = WI(f, k, c); } }
      if (best < 0) { const i = winAt(st); if (B.cd <= 0) { B.a = true; B.cd = 0.3; } if (i < 0) B.my = 1; return; } // only broken / live ones left: chip the wall
      const w = P.W[best], ds = dS(winS(f, w.c), st.s), dy = winY(w.k) - (st.y + 1.2);
      if (Math.abs(ds) > 0.3) B.mx = clamp(ds * 2, -1, 1); if (Math.abs(dy) > 0.5) B.my = clamp(dy * 1.5, -1, 1);
      if (winAt(st) === best && B.cd <= 0) { B.a = true; B.cd = 0.3; }
      return;
    }
    // part 2
    if (st.ph !== 'fight') return; const pig = st.pig, d = pigD(st); const go = (x, z, sp = 1) => { const dx = x - st.x, dz = z - st.z, l = Math.hypot(dx, dz); if (l < 0.3) return; const f = V.copy(P.cam.position).sub(V2.set(st.x, 0, st.z)); f.y = 0; f.normalize().negate(); const rx = -f.z, rz = f.x;
      const wx = dx / l, wz = dz / l; B.my = clamp((wx * f.x + wz * f.z) * sp, -1, 1); B.mx = clamp((wx * rx + wz * rz) * sp, -1, 1); };
    if (pig.m === 'finish') { const r = Math.hypot(pig.pos.x, pig.pos.z) || 1, ox = pig.pos.x / r, oz = pig.pos.z / r; const tx = pig.pos.x - ox * 1.5, tz = pig.pos.z - oz * 1.5; if (Math.hypot(tx - st.x, tz - st.z) > 0.6) go(tx, tz); else if (B.cd <= 0) { B.a = true; B.cd = 0.35; } return; }
    if (pig.m === 'dazed' || pig.m === 'slam') { if (d > 1.7) go(pig.pos.x, pig.pos.z); if (d < 2.3 && B.cd <= 0) { B.a = true; B.cd = 0.32; } return; }
    if (pig.m === 'dive' || pig.m === 'divePrep') { V.copy(pig.pos).setY(pig.pos.y + 1.2); if (V.distanceTo(V2.set(st.x, 1.1, st.z)) < 3.1 && pig.m === 'dive' && B.tcd <= 0) { B.c = true; B.tcd = 0.6; } return; }
    for (const p of st.poops) if (Math.hypot(p.x - st.x, p.z - st.z) < 1.4) { go(st.x + (st.x - p.x) * 3, st.z + (st.z - p.z) * 3); return; }
    if ((pig.m === 'walk' || pig.m === 'peckTell') && d < 3.4) { go(st.x + (st.x - pig.pos.x) * 3, st.z + (st.z - pig.pos.z) * 3); if (pig.m === 'peckTell' && d < 2.4 && st.jumpT < 0) B.b = true; return; }
  };

  DUELS.reg('pigeon', P);
  // ---------------- city entry: the glowing ring at the WTC base (north side, on the Pratt St promenade): ACT = CLIMB WTC ----------------
  const L = LANDMARKS.find((l) => l.id === LM);
  if (L && L.boss) { const n0 = ACTIONS.length; DUELS.addTrigger('pigeon', L, -12, -30.3, -12, -31.8, '#9fdcff'); for (let i = n0; i < ACTIONS.length; i++) if (ACTIONS[i].kind === 'boss') ACTIONS[i].label = 'CLIMB WTC'; }
  // tests: ?pigeon=1 [&pigeonpart=2] [&pigeonauto=win|lose] start it straight away (after the first frames, skipping the intro)
  if (Q.has('pigeon')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; DUELS.start('pigeon', { bot: Q.get('pigeonauto') || null, part: +(Q.get('pigeonpart') || 1) }); } }); }
  window.__pigeon = P;
})();

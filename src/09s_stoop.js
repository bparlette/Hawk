
// ======================= THE STOOP SCRUBBER, WASHINGTON MONUMENT: the marble-steps brawl (boss 17; DESIGN.md boss list + handoff/BOSS_GANG_UPGRADE_PLAN.md #20).
// (Not the queued "stoop-defense" / Hold the Stoop tower-defense mode: this file, its ids and its params all say "scrubber".)
// A set piece on the duel core (09a: MODE.duel, the shared HUD, RETRY / LEAVE, radio duck, panel relabel, exit back to the street).
// The arena: the monument's marble steps on Mount Vernon Place at golden hour. The Stoop Scrubber (an original stout goose matriarch in a
// housecoat, kerchief + curlers, yellow rubber gloves, a giant scrub brush and a tin bucket) holds the TOP of the steps; Harold fights on the
// brick plaza below, Mavis cheers by the fountain. Every attack is telegraphed >= 1.0 s (a "!" tell card + a lit decal on the ground):
//   SUDS SLICK: she tips the bucket and 2-3 of the 5 foam lanes running down the steps flash; then foam floods them. Standing in foam = Harold
//               slips (spin, damage). Always >= 2 safe lanes. JUMP over the foam while it's live also keeps you upright.
//   BUCKET DUMP: she hurls her bucket high; its SHADOW grows under where Harold stood; then SPLASH (phase 3: two buckets, the 2nd leads you).
//   MARBLE GLARE: she buffs a step to a mirror shine; a thin LIT LINE runs from her across the plaza through Harold; then the reflected
//               beam fires along it (damage + a short white-out). Step off the line. (phase 3: two lines in a V)
//   After each attack she hops DOWN to the bottom step to scrub it: that is the opening. The first ~1.2 s she's WINDED (gold crits). If Harold
//   hangs in front of her too long she does a BRUSH SWEEP (raised brush + red ground ring, 1.0 s tell). Then she hops back up.
// Harold: stick moves, SWING = 3-hit cane combo; the 3rd hit is this fight's own finisher, the SCRUB-A-DUB SPIN (a cyan bubble-trail spin sweep,
// "SPLOOSH!" pops). JUMP = a dodge hop (short i-frames, clears foam). POWER fills from hits and clean dodges; when full, ACT = the team-up special
// STOOP SURF: Mavis flings the spare scrub brush up the steps, Harold surfs it down the suds in slow-mo and bowls the Scrubber over (big damage).
// 3 phases (boss HP 66 / 33). KO: she slips on her own suds and slides down every step in slow-mo, across the plaza into the fountain: "Okay hon."
// Win = BOSS_CLEAR.clear('monument') via DUELS.bossCleared (Mount Vernon district crime -> 0) + a star grade by hits taken. Lose = RETRY / LEAVE.
// Entry: ACT "SCRUB-OFF" at the landmark's own boss anchor (LANDMARKS 'monument' boss {x:-20, z:-84}, the south face of the plinth): REAL anchor.
// Tests: ?scrubber=1 starts the fight at load, &scrubberauto=win|lose plays it by itself (also ?duel=scrubber&duelbot=win|lose). ?scrubberphase=N.
// Writing: Grok's GR10 / GR1 stoop_scrubber lines (hawk-relay content/gr10_bosses.json, gr1_writing.json), embedded below.
//
// Rig hook (Opus): if window.buildStoopScrubber exists it is called as buildStoopScrubber({ THREE, toonMat, outlineMat, addOdir, QUAL }) and must return
//   { root, body?, head?, armL?, armR?, brush?, bucket?, flash?: [materials], update?(dt, mode, info) }
//   root: Object3D, origin on the ground between her feet, facing +z (down the steps, toward Harold / the camera), about 2.3 m tall.
//   armR: right shoulder pivot holding the scrub brush (brush head ~1.1 m from the shoulder); armL: left shoulder pivot holding the bucket.
//   brush / bucket (optional): Object3D children of the hands; the mode hides `bucket` while a thrown bucket is in the air.
//   update(dt, mode, info) (optional) is called every frame; if present the mode skips its own part animation. mode is one of
//     'idle' | 'suds' (tipping the bucket) | 'throw' (bucket wind-up + throw) | 'glare' (polishing a step) | 'hop' | 'scrub' | 'sweepTell' | 'sweep'
//     | 'hurt' | 'dizzy' | 'ko' (slipping + sliding) | 'win' (Harold lost; she laughs); info = { t, u (0..1 through the current move), hp (0..1) }.
//   Missing optional pieces are skipped; otherwise the procedural stand-in below is used.
(function () {
  const GR = { intro: ["Hon, I scrubbed these steps at dawn. Don't you DARE.", "Muddy feet on my marble? Oh, it's ON, toad.", 'Get off my clean steps, hon!'],
    taunt: ["Slippery, ain't it? That's elbow grease, hon.", "My bucket's full and my brush is angry.", 'Wipe your feet! WIPE THEM!', 'These steps shine brighter than your future.', 'Suds in your eyes, sweetie? Oops.', 'Suds up! Slip and slide, toad!'],
    hurt: ['My bucket! You kicked my bucket!', 'Ugh, a scuff! A SCUFF, hon!', 'Now I gotta scrub that twice!'],
    defeat: ['Alright, hon. You can sit. Just wipe your feet.', 'My brush is bent. My pride too.', 'Clean fight, toad. Cleaner than my steps.', 'Okay hon, you can sit on the stoop.'],
    clear: 'STOOP SCRUBBED CLEAN!' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const dampA = (a, b, r, dt) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * (1 - Math.exp(-r * dt)); };
  // ---------------- tuning ----------------
  const XL = 6.0, Z0 = 0.35, Z1 = 6.0; // Harold's plaza box
  const LANES = [-5.2, -2.6, 0, 2.6, 5.2], LW = 2.6;
  const TOPZ = -4.1, TOPY = 1.2, LOWZ = -1.05, LOWY = 0.3; // her spots: top landing / bottom step
  const REACH = 2.0, SPD = 5.4, HP0 = 100, BHP0 = 100;
  const DMG = { slip: 8, bucket: 11, glare: 9, sweep: 9 };
  const HIT = [3, 3, 6], CRIT = 1.5, POW_HIT = 5, POW_DODGE = 12, SURF_DMG = 18, FX = -5.9, FZ = 7.9; // FX/FZ: the fountain
  const PH = [ // per phase: tell secs, scrub window, attacks per visit up top, lanes foamed
    { tell: 1.35, win: 3.4, n: 1, lanes: 2 }, { tell: 1.2, win: 3.0, n: 1, lanes: 3 }, { tell: 1.05, win: 2.6, n: 2, lanes: 3 }];
  const S = { scene: null, cam: null, title: 'THE STOOP SCRUBBER', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> swing · <b>K</b> dodge hop · <b>E</b> STOOP SURF when POWER is full',
    labels: { a: 'SWING', b: 'HOP', c: 'POWER', l: '', r: '' } };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E3 = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1);

  // ---------------- textures (canvas only; no real logos anywhere) ----------------
  function marbleTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#efeae0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(150,140,130,' + rnd(0.08, 0.22).toFixed(2) + ')'; g.lineWidth = rnd(0.6, 2); g.beginPath(); let x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-40, 40); y += rnd(-20, 40); g.lineTo(x, y); } g.stroke(); } }, 256); }
  function brickTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { g.fillStyle = ['#9a4430', '#a24a34', '#8c3c2c', '#b0563c'][(x * 7 + y * 3) % 4]; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); } }, 256); }
  function rowTex() { return canvasTex(512, 256, (g, w, h) => { // a rowhouse face: brick, white trim windows, a marble stoop drawn at the base, formstone on one
    g.fillStyle = '#7a3428'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    const n = 4, bw = w / n; for (let i = 0; i < n; i++) { const x = i * bw; if (i === 2) { g.fillStyle = '#9a9488'; g.fillRect(x, 0, bw, h); g.fillStyle = 'rgba(60,50,40,.25)'; for (let k = 0; k < 40; k++) g.fillRect(x + rnd(0, bw), rnd(0, h), rnd(8, 22), 2); }
      g.fillStyle = '#f4efe2'; g.fillRect(x + 4, 6, bw - 8, 8); for (const yy of [30, 100]) for (const xx of [14, 70]) { g.fillStyle = '#f4efe2'; g.fillRect(x + xx - 3, yy - 3, 40, 52); g.fillStyle = (i + xx + yy) % 3 ? '#2a3448' : '#ffd890'; g.fillRect(x + xx, yy, 34, 46); }
      g.fillStyle = '#3a1e18'; g.fillRect(x + 76, 168, 28, 60); g.fillStyle = '#f4efe2'; for (let s = 0; s < 4; s++) g.fillRect(x + 66 - s * 4, 228 + s * 7, 48 + s * 8, 7); }
  }, 512); }
  function foamTex() { return canvasTex(128, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const r = rnd(5, 16), x = rnd(r, w - r), y = rnd(r, h - r); const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, 'rgba(230,248,255,.95)'); gr.addColorStop(1, 'rgba(160,220,255,.0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }, 256); }
  function stripeTex() { return canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.95)'; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(8, y + 24); g.lineTo(w / 2, y + 6); g.lineTo(w - 8, y + 24); g.lineTo(w - 8, y + 30); g.lineTo(w / 2, y + 12); g.lineTo(8, y + 30); g.fill(); } g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); }, 256); }
  function ringTex(c) { return canvasTex(128, 128, (g) => { g.strokeStyle = c; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke(); g.globalAlpha = 0.35; g.fillStyle = c; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill(); }, 128); }
  function signTex() { return canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1e3a2a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8c070'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f4e8c0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 40px ' + FONT; g.fillText('MOUNT VERNON PLACE', w / 2, h / 2 + 2); }, 512); }

  // ---------------- the stand-in Scrubber: a stout goose matriarch in a housecoat ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group() }, mat = toonMat(); R.flash = [mat];
    const WH = '#f6f2ea', WH2 = '#ddd6c8', BILL = '#f0962a', COAT = '#5aa8a0', COAT2 = '#3f8a84', DOT = '#f4e2f0', KER = '#d8405a', GLOVE = '#ffd23c';
    R.body = new THREE.Group(); R.root.add(R.body);
    const B = K();
    B.add(G.sph(0.82, 18, 14), WH, 0, 1.05, 0, 0, 0, 0, 1.0, 1.05, 0.9) // the round goose body
      .add(G.cyl(0.84, 0.98, 1.1, 18), COAT, 0, 0.82, 0.02) // housecoat skirt
      .add(G.cyl(0.8, 0.82, 0.55, 18), COAT2, 0, 1.4, 0.0) // housecoat top
      .add(G.box(0.08, 1.2, 0.05), '#fff', 0, 1.0, 0.86, 0.06, 0, 0).add(G.sph(0.05, 6, 4), '#fff', 0, 1.35, 0.88).add(G.sph(0.05, 6, 4), '#fff', 0, 1.05, 0.9) // placket + buttons
      .add(G.box(0.5, 0.28, 0.06), '#f8f8f0', 0.45, 0.85, 0.82, 0, -0.35, 0) // apron pocket with a rag poking out
      .add(G.box(0.18, 0.2, 0.04), KER, 0.48, 1.02, 0.86, 0, -0.35, 0.3)
      .add(G.cyl(0.11, 0.13, 0.3, 8), BILL, -0.32, 0.15, 0.1).add(G.cyl(0.11, 0.13, 0.3, 8), BILL, 0.32, 0.15, 0.1) // legs
      .add(G.box(0.34, 0.08, 0.46), BILL, -0.32, 0.03, 0.22).add(G.box(0.34, 0.08, 0.46), BILL, 0.32, 0.03, 0.22) // webbed feet
      .add(G.cone(0.32, 0.5, 6), WH2, 0, 1.0, -0.86, -1.2, 0, 0); // tail
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; B.add(G.sph(0.07, 6, 4), DOT, Math.sin(a) * 0.85, 0.7 + (i % 3) * 0.25, Math.cos(a) * 0.82, 0, 0, 0, 1, 1, 0.4); } // housecoat polka dots
    B.mesh(mat, R.body);
    // neck + head (head turns): long goose neck, bill, kerchief, curlers peeking out, cat-eye-free reading glasses on a chain
    R.head = new THREE.Group(); R.head.position.set(0, 1.75, 0.18); R.body.add(R.head);
    const Hd = K();
    Hd.add(G.cyl(0.16, 0.22, 0.6, 10), WH, 0, 0.2, 0, 0.15, 0, 0).add(G.sph(0.32, 14, 10), WH, 0, 0.6, 0.05, 0, 0, 0, 1, 1.05, 1.05)
      .add(G.cone(0.16, 0.48, 8), BILL, 0, 0.52, 0.48, Math.PI / 2, 0, 0, 1.2, 1, 0.6).add(G.box(0.24, 0.04, 0.3), '#d87a1a', 0, 0.47, 0.42)
      .add(G.sph(0.08, 8, 6), '#fff', -0.15, 0.68, 0.27).add(G.sph(0.08, 8, 6), '#fff', 0.15, 0.68, 0.27)
      .add(G.sph(0.045, 6, 4), '#14101f', -0.14, 0.67, 0.34).add(G.sph(0.045, 6, 4), '#14101f', 0.14, 0.67, 0.34)
      .add(G.box(0.16, 0.04, 0.04), '#14101f', -0.15, 0.79, 0.3, 0, 0, 0.3).add(G.box(0.16, 0.04, 0.04), '#14101f', 0.15, 0.79, 0.3, 0, 0, -0.3) // stern brows
      .add(G.tor(0.075, 0.012, TAU, 4, 12), '#b0a080', -0.15, 0.68, 0.33).add(G.tor(0.075, 0.012, TAU, 4, 12), '#b0a080', 0.15, 0.68, 0.33) // glasses
      .add(G.sph(0.35, 14, 8, ), KER, 0, 0.74, -0.04, -0.25, 0, 0, 1.05, 0.8, 1.05) // kerchief
      .add(G.cone(0.12, 0.3, 4), KER, 0, 0.62, -0.38, -2.3, 0, 0); // kerchief knot tails
    for (let i = 0; i < 4; i++) Hd.add(G.cyl(0.05, 0.05, 0.14, 8), ['#7ad0ff', '#ff9ac8', '#a8f080', '#ffd23c'][i], -0.24 + i * 0.16, 0.86, 0.22, 0, 0, Math.PI / 2); // curlers
    Hd.mesh(mat, R.head);
    // arms: shoulder pivot > wing-arm > yellow glove; armR holds the brush, armL the bucket
    const arm = (s) => { const sh = new THREE.Group(); sh.position.set(s * 0.82, 1.42, 0.05); R.body.add(sh);
      const A = K(); A.add(G.sph(0.2, 10, 8), COAT2, 0, 0, 0).add(G.cyl(0.15, 0.13, 0.62, 9), WH, 0, -0.34, 0).add(G.cyl(0.15, 0.17, 0.22, 9), GLOVE, 0, -0.68, 0).add(G.sph(0.14, 8, 6), GLOVE, 0, -0.82, 0);
      A.mesh(mat, sh); const hand = new THREE.Group(); hand.position.set(0, -0.86, 0); sh.add(hand); sh.userData.hand = hand; return sh; };
    R.armL = arm(-1); R.armR = arm(1);
    { const Br = K(); Br.add(G.cyl(0.04, 0.04, 1.0, 6), '#a87a48', 0, -0.35, 0).add(G.box(0.62, 0.14, 0.26), '#c8402a', 0, -0.9, 0).add(G.box(0.58, 0.14, 0.22), '#f4e2b0', 0, -1.02, 0, 0, 0, 0, 1, 1, 1);
      R.brush = Br.mesh(toonMat(), R.armR.userData.hand); R.brush.rotation.x = 0.4; }
    { const Bu = K(); Bu.add(G.cyl(0.24, 0.19, 0.36, 12), '#a8b0b8', 0, -0.28, 0).add(G.tor(0.17, 0.012, Math.PI, 4, 10), '#606870', 0, -0.08, 0, 0, 0, 0).add(G.cyl(0.22, 0.22, 0.02, 12), '#d8f4ff', 0, -0.12, 0);
      R.bucket = Bu.mesh(toonMat(), R.armL.userData.hand); }
    return R;
  }
  function bucketMesh() { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.cyl(0.26, 0.2, 0.38, 12), '#a8b0b8', 0, 0, 0).add(G.tor(0.18, 0.014, Math.PI, 4, 10), '#606870', 0, 0.2, 0); return K.mesh(toonMat(), null); }

  // ---------------- build ----------------
  S.build = function () {
    const sc = (S.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#f2c89a', 24, 70); sc.background = new THREE.Color('#f6c890');
    S.cam = new THREE.PerspectiveCamera(52, VW() / VH(), 0.1, 160);
    DUELS.sceneLights(sc, '#fff0d8', '#5a4a40', 1.2, '#ffe0b0', 1.55, new THREE.Vector3(-0.6, 1, 0.7));
    const K = DUELS.kit(), G = DUELS.GEO;
    // plaza (brick) + marble steps + the plinth + the column + statue (one merged mesh) ; rowhouse fronts both sides ; the fountain front-left
    const bt = brickTex(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(7, 6);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshLambertMaterial({ map: bt })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 6); sc.add(fl);
    const mt = marbleTex(); mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(4, 1);
    const marble = new THREE.MeshLambertMaterial({ map: mt, color: '#ffffff' }); S.marble = marble;
    const steps = new THREE.Group(); sc.add(steps);
    // each step is a 15 m slab from its front edge back to the plinth
    for (let k = 0; k < 4; k++) { const front = -0.6 - k * 1.0, back = -7.0, h = 0.3 * (k + 1); const m = new THREE.Mesh(new THREE.BoxGeometry(15, h, front - back), marble); m.position.set(0, h / 2, (front + back) / 2); steps.add(m); DUELS.inkHull(m, 0.003); }
    K.add(G.box(9, 4.2, 5), '#e8e2d4', 0, 1.2 + 2.1, -9.0).add(G.box(9.6, 0.4, 5.6), '#d8d2c4', 0, 1.2 + 4.4, -9.0).add(G.box(7, 1.6, 4.2), '#e8e2d4', 0, 1.2 + 5.4, -9.0) // plinth
      .add(G.cyl(1.35, 1.65, 34, 14), '#f0eadc', 0, 7.4 + 17, -9.0).add(G.box(3.6, 0.8, 3.6), '#d8d2c4', 0, 7.4 + 34.4, -9.0).add(G.cyl(0.55, 0.75, 3.4, 8), '#7a8a6a', 0, 7.4 + 36.5, -9.0) // column + statue
      .add(G.box(1.6, 2.2, 0.1), '#2a2a30', 0, 1.2 + 1.1, -6.48); // the plinth door
    for (const s of [-1, 1]) K.add(G.cyl(0.12, 0.14, 3.6, 8), '#22262a', s * 7.6, 1.8, -0.2).add(G.sph(0.32, 10, 8), '#fff4c8', s * 7.6, 3.75, -0.2) // lamp posts
      .add(G.box(0.06, 0.9, 12), '#22262a', s * 8.6, 0.45, 5).add(G.box(0.1, 0.08, 12), '#22262a', s * 8.6, 0.9, 5); // iron fence
    // the fountain (behind Harold, front-centre): a round basin with a spray
    K.add(G.cyl(1.7, 1.85, 0.6, 20), '#d8d2c4', FX, 0.3, FZ).add(G.cyl(1.5, 1.5, 0.05, 20), '#5ab0d8', FX, 0.5, FZ).add(G.cyl(0.3, 0.42, 1.2, 10), '#d8d2c4', FX, 0.6, FZ).add(G.cyl(0.75, 0.4, 0.16, 14), '#d8d2c4', FX, 1.25, FZ);
    S.stage = K.mesh(toonMat(), sc, 0.003);
    const rt = rowTex(), rmat = new THREE.MeshLambertMaterial({ map: rt });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(26, 11), rmat); w.position.set(s * 12.5, 5.5, 2); w.rotation.y = -s * Math.PI / 2; sc.add(w); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 16), rmat); back.position.set(0, 8, -16); sc.add(back);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshLambertMaterial({ map: signTex() })); sign.position.set(-4.6, 2.4, -6.49); sc.add(sign);
    // foam lanes (one plane per lane, laid down the steps + plaza, bent onto the step tops via a stair-shaped strip) and their telegraph stripes
    const ft = foamTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1, 4);
    const st = stripeTex(); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(1, 6);
    S.lanes = LANES.map((x) => { const g = stairStrip(LW - 0.2), foam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      const tel = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: st, color: '#1e9cff', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      foam.position.x = tel.position.x = x; foam.renderOrder = 3; tel.renderOrder = 4; foam.visible = tel.visible = false; sc.add(foam, tel); return { x, foam, tel }; });
    S.ft = ft; S.stt = st;
    // bucket shadows (2), the thrown buckets (2), glare lines (2), the sweep ring
    const dotT = DUELS.dot('#000', false);
    S.shadows = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dotT, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; m.visible = false; sc.add(m); return m; });
    S.shRings = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex('#ff3d6e'), transparent: true, opacity: 0, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 6; m.visible = false; sc.add(m); return m; });
    S.buckets = [0, 1].map(() => { const m = bucketMesh(); m.visible = false; sc.add(m); return m; });
    S.lines = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); m.renderOrder = 7; m.visible = false; sc.add(m); return m; });
    S.sweepRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex('#ff3d6e'), transparent: true, opacity: 0, depthWrite: false, fog: false })); S.sweepRing.rotation.x = -Math.PI / 2; S.sweepRing.renderOrder = 6; S.sweepRing.visible = false; sc.add(S.sweepRing);
    // the surf brush (Harold rides it in STOOP SURF)
    { const B2 = DUELS.kit(); B2.add(G.box(0.7, 0.16, 1.5), '#c8402a', 0, 0.08, 0).add(G.box(0.64, 0.12, 1.4), '#f4e2b0', 0, -0.05, 0); S.surf = B2.mesh(toonMat(), sc); S.surf.visible = false; }
    // fx: bubbles / splash / sparkle (instanced quads, one draw call)
    S.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: DUELS.dot('#eaffff', false), transparent: true, depthWrite: false, fog: false }), 90); S.fx.count = 0; S.fx.frustumCulled = false; S.fx.renderOrder = 8; sc.add(S.fx); S.fxs = [];
    // Harold, Mavis, the Scrubber
    S.H = buildHero(); sc.add(S.H.root); S.M = buildHero({ wife: true }); sc.add(S.M.root);
    let rig = null; try { if (typeof window.buildStoopScrubber === 'function') rig = window.buildStoopScrubber({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    S.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'head', 'armL', 'armR']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.root.add(rig[k]); }
    rig.flash = rig.flash || []; S.R = rig; sc.add(rig.root);
    S.base = { aL: rig.armL.rotation.clone(), aR: rig.armR.rotation.clone(), hd: rig.head.rotation.clone() };
    // extra HUD: POWER meter + hit pops + phase/grade line (inside the duel HUD, this fight only)
    const css = document.createElement('style'); css.textContent = `
      #scrubui { position: absolute; inset: 0; display: none; pointer-events: none; }
      body.duel-scrubber #scrubui { display: block; }
      #scrubui .pw { position: absolute; left: 10px; bottom: 34px; font-size: 10px; text-shadow: 2px 2px 0 #14101f; }
      #scrubui .pw .t { width: 150px; height: 12px; background: #14101f; border: 2px solid #14101f; box-shadow: 3px 3px 0 #14101f; border-radius: 6px; position: relative; overflow: hidden; margin-top: 3px; }
      #scrubui .pw .t i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #7adfff, #ffffff 50%, #7adfff); border-radius: 4px; }
      #scrubui .pw.full .n { color: #7adfff; animation: scrpw .3s infinite alternate; } @keyframes scrpw { from { opacity: 1; } to { opacity: .45; } }
      #scrubui .pop { position: absolute; left: 0; top: 0; font-size: 16px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; opacity: 0; transform: translate(-50%, -50%); }
      #scrubui .pop.c { color: #ffd23c; font-size: 20px; } #scrubui .pop.w { color: #7adfff; font-size: 18px; }
      #scrubui .bang { position: absolute; left: 0; top: 0; font-size: 28px; color: #ffd23c; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; opacity: 0; transform: translate(-50%, -100%); }
      body.duel-scrubber #duel .dtell { top: 64%; white-space: normal; max-width: 88vw; text-align: center; line-height: 1.4; }
      @media (max-width: 480px) { #scrubui .pw .t { width: 120px; } #scrubui .pop { font-size: 13px; } #scrubui .pop.c { font-size: 16px; } }`;
    document.head.appendChild(css);
    const ui = document.createElement('div'); ui.id = 'scrubui'; ui.innerHTML = '<div class="pw"><div class="n">POWER</div><div class="t"><i></i></div></div><div class="bang">!</div>' + '<div class="pop"></div>'.repeat(8);
    DUELS.hudEl.appendChild(ui);
    S.ui = { el: ui, pw: ui.querySelector('.pw'), pwBar: ui.querySelector('.pw .t i'), bang: ui.querySelector('.bang'), pops: [...ui.querySelectorAll('.pop')].map((el) => ({ el, t: 0, p: new THREE.Vector3() })), popI: 0 };
  };
  // a strip that follows the stairs: from the top landing (z -4.6, y 1.2) down each step riser and across the plaza to z 7.2 (non-indexed quads)
  function stairStrip(w) {
    const prof = [[-4.6, 1.21]]; for (let k = 3; k >= 0; k--) { const front = -0.6 - k * 1.0, y = 0.3 * (k + 1) + 0.01; prof.push([front, y], [front + 0.001, 0.3 * k + 0.01]); }
    prof.push([7.2, 0.01]); const P = [], U = []; let v = 0, len = 0; for (let i = 1; i < prof.length; i++) len += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
    for (let i = 1; i < prof.length; i++) { const [z0, y0] = prof[i - 1], [z1, y1] = prof[i], d = Math.hypot(z1 - z0, y1 - y0), v0 = v / len * 3, v1 = (v + d) / len * 3; v += d;
      P.push(-w / 2, y0, z0, w / 2, y0, z0, w / 2, y1, z1, -w / 2, y0, z0, w / 2, y1, z1, -w / 2, y1, z1); U.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
  }
  const stepY = (z) => (z >= -0.6 ? 0 : z <= -3.6 ? 1.2 : 0.3 * (Math.floor((-0.6 - z) / 1.0) + 1));

  // ---------------- state ----------------
  function reset(phase = 0) {
    const st = S.st = { t: 0, phase, hp: HP0, bhp: [BHP0, 66, 33][phase], bs: 'intro', bt: 0, bdur: 2.4, hits: 0, over: false, won: false, outT: 0,
      h: { x: 0, z: 4.2, vx: 0, vz: 0, yaw: Math.PI, jumpT: -1, jy: 0, inv: 0, hurtT: -1, slipT: -1, swT: -1, swN: 0, swHit: false, queued: false, comboT: 0, blindT: 0 },
      b: { x: 0, y: TOPY, z: TOPZ, fromX: 0, fromY: TOPY, fromZ: TOPZ, toX: 0, toY: TOPY, toZ: TOPZ, flash: 0, hurtT: -1, open: 0, near: 0, left: 0, last: '' },
      atk: null, pow: 0, surf: null, hs: 0, slow: 1, slowT: 0, shk: 0, stats: { hitsTaken: 0, dodges: 0, landed: 0, crits: 0, surfs: 0, retries: 0 } };
    S.lanes.forEach((L) => { L.foam.visible = L.tel.visible = false; }); S.shadows.forEach((m) => (m.visible = false)); S.shRings.forEach((m) => (m.visible = false));
    S.buckets.forEach((m) => (m.visible = false)); S.lines.forEach((m) => (m.visible = false)); S.sweepRing.visible = false; S.surf.visible = false; S.fxs.length = 0;
    DUELS.blind(0); hud(st); return st;
  }
  function hud(st) { DUELS.bars(st.hp / HP0, Math.max(0, st.bhp) / BHP0); S.ui.pwBar.style.width = clamp(st.pow, 0, 100).toFixed(0) + '%'; S.ui.pw.classList.toggle('full', st.pow >= 100);
    DUELS.sub('PHASE ' + (st.phase + 1) + '/3', 'HITS TAKEN ' + st.stats.hitsTaken); }
  const say = (txt, d = 2.6) => DUELS.say('THE STOOP SCRUBBER', txt, d);
  S.start = function () {
    const p0 = clamp(+(Q.get('scrubberphase') || 1) - 1, 0, 2) | 0; reset(p0); DUELS.log.push('scrubber:' + S.rigKind);
    DUELS.banner('THE STOOP SCRUBBER<small>WASHINGTON MONUMENT · MOUNT VERNON</small>', 2.4); say(GR.intro[0], 3.2);
    S.camP = new THREE.Vector3(0, 9, 16); S.camL = new THREE.Vector3(0, 1, -2);
  };
  S.retry = function () { const st = reset(0); st.stats.retries = (DUELS.retries || 0); st.bdur = 1.6; DUELS.banner('ROUND TWO, HON<small>FRESH SUDS · FULL HEALTH</small>', 1.6); say(pick(GR.taunt), 2.4); };
  S.exit = function () { DUELS.blind(0); S.ui.bang.style.opacity = '0'; };

  // ---------------- small juice helpers (local: the shared JUICE core isn't on integration yet) ----------------
  function pop(p, txt, cls = '') { const P = S.ui.pops[S.ui.popI++ % S.ui.pops.length]; P.el.textContent = txt; P.el.className = 'pop ' + cls; P.t = 0.9; P.p.copy(p); }
  function bubbles(x, y, z, n = 8, spd = 2.2, up = 2.4, life = 0.8) { for (let k = 0; k < n && S.fxs.length < 90; k++) S.fxs.push({ p: new THREE.Vector3(x + rnd(-0.2, 0.2), y + rnd(0, 0.3), z + rnd(-0.2, 0.2)), v: new THREE.Vector3(rnd(-spd, spd), rnd(up * 0.4, up), rnd(-spd, spd)), t: 0, life: rnd(life * 0.5, life), g: 5 }); }
  function splashSfx() { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime, g = AC.createGain(); g.connect(SFXBUS || AC.destination); const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.5); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); s.start(t); s.stop(t + 0.6); } catch (e) {} }
  function sting() { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime; for (let k = 0; k < 2; k++) { const o = AC.createOscillator(), g = AC.createGain(), t2 = t + k * 0.09; o.type = 'square'; o.frequency.value = k ? 990 : 660; g.gain.setValueAtTime(0.07, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.12); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t2); o.stop(t2 + 0.14); } } catch (e) {} }
  function tell(text, dur) { DUELS.tell('! ' + text, dur); sting(); S.bangT = dur; }

  // ---------------- Harold: hurt / dodge bookkeeping ----------------
  function haroldHit(st, dmg, kind) {
    const h = st.h; if (h.inv > 0 || st.over || st.surf) return false;
    st.hp = Math.max(0, st.hp - dmg); h.inv = 1.3; h.hurtT = 0; st.stats.hitsTaken++; DUELS.hurt(); sfx('hurt'); st.shk = Math.max(st.shk, 0.35);
    pop(V.set(h.x, 2.0, h.z), '-' + dmg, ''); h.swT = -1; h.queued = false;
    if (kind === 'slip') { h.slipT = 0; h.vz = 3.2; h.vx = rnd(-1.5, 1.5); }
    if (kind === 'glare') h.blindT = 1.1;
    if (Math.random() < 0.35) say(pick(GR.taunt), 2.0);
    hud(st); if (st.hp <= 0) lose(st); return true;
  }
  function dodged(st, what) { st.stats.dodges++; st.pow = Math.min(100, st.pow + POW_DODGE); pop(V.set(st.h.x, 2.1, st.h.z), what, 'w'); hud(st); }

  // ---------------- the Scrubber's brain ----------------
  function setB(st, bs, dur) { st.bs = bs; st.bt = 0; st.bdur = dur; }
  function hopTo(st, x, y, z, dur) { const b = st.b; b.fromX = b.x; b.fromY = b.y; b.fromZ = b.z; b.toX = x; b.toY = y; b.toZ = z; setB(st, 'hop', dur); }
  function chooseAttack(st) { const opts = ['suds', 'bucket', 'glare'].filter((a) => a !== st.b.last); const a = opts[Math.floor(Math.random() * opts.length)]; st.b.last = a; return a; }
  function startAttack(st, kind) {
    const P = PH[st.phase], h = st.h, b = st.b; const A = st.atk = { kind, t: 0, tell: P.tell, done: false, hitDone: false };
    if (kind === 'suds') { const n = P.lanes, idx = [0, 1, 2, 3, 4]; const hl = laneOf(h.x); // always include Harold's lane, leave >= 2 safe lanes
      const pickL = [hl]; while (pickL.length < n) { const c = idx[Math.floor(Math.random() * 5)]; if (!pickL.includes(c)) pickL.push(c); }
      A.lanes = pickL; A.live = 2.4; S.lanes.forEach((L, i) => { L.tel.visible = A.lanes.includes(i); L.tel.material.opacity = 0; L.foam.visible = false; });
      tell('SUDS SLICK! FIND A DRY LANE', P.tell); }
    else if (kind === 'bucket') { A.targets = [{ x: h.x, z: h.z }]; if (st.phase >= 2) A.targets.push({ x: clamp(h.x + h.vx * 0.9 + (Math.random() < 0.5 ? -2 : 2), -XL, XL), z: clamp(h.z + h.vz * 0.6, Z0, Z1) });
      A.tell = P.tell + 0.1; tell(A.targets.length > 1 ? 'BUCKET DUMP x2! LEAVE THE SHADOWS' : 'BUCKET DUMP! LEAVE THE SHADOW', A.tell); }
    else { const dirs = [Math.atan2(h.x - b.x, h.z - b.z)]; if (st.phase >= 2) { dirs[0] -= 0.22; dirs.push(dirs[0] + 0.44); }
      A.dirs = dirs; A.beam = 0.55; tell('MARBLE GLARE! OFF THE LIT LINE', P.tell); }
    if (Math.random() < 0.4) say(pick(GR.taunt), 2.2);
  }
  const laneOf = (x) => clamp(Math.round((x + 5.2) / 2.6), 0, 4);
  function stepAttack(st, dt) {
    const A = st.atk, h = st.h, b = st.b; if (!A) return true; A.t += dt;
    if (A.kind === 'suds') {
      if (A.t < A.tell) return false;
      if (!A.on) { A.on = true; A.wasIn = inFoam(A, h.x); splashSfx(); for (const i of A.lanes) bubbles(LANES[i], 1.3, -4.2, 6, 1.0, 1.8, 0.7); }
      if (A.t < A.tell + A.live) { if (inFoam(A, h.x) && h.jumpT < 0 && h.slipT < 0 && h.inv <= 0) { haroldHit(st, DMG.slip, 'slip'); A.hitDone = true; } return false; }
      if (!A.hitDone) dodged(st, 'DRY FEET!'); return true;
    }
    if (A.kind === 'bucket') {
      const T = A.tell; if (A.t < T) return false;
      if (!A.on) { A.on = true; splashSfx(); st.shk = Math.max(st.shk, 0.3); let hit = false;
        for (const tg of A.targets) { bubbles(tg.x, 0.1, tg.z, 16, 2.8, 3.2, 0.9); if (Math.hypot(h.x - tg.x, h.z - tg.z) < 1.45 && !hit) hit = haroldHit(st, DMG.bucket, 'bucket'); }
        if (!hit && h.inv <= 0.01) dodged(st, 'MISSED ME!'); A.hitDone = hit; }
      return A.t > T + 0.35;
    }
    // glare
    if (A.t < A.tell) return false;
    if (!A.on) { A.on = true; sfx('heavy'); let hit = false;
      for (const d of A.dirs) { const dx = Math.sin(d), dz = Math.cos(d), rx = h.x - b.x, rz = h.z - b.z, along = rx * dx + rz * dz, perp = Math.abs(rx * dz - rz * dx); if (along > 0 && perp < 0.85 && !hit) hit = haroldHit(st, DMG.glare, 'glare'); }
      if (!hit && h.inv <= 0.01) dodged(st, 'NOT BLINDED!'); A.hitDone = hit; }
    return A.t > A.tell + A.beam;
  }
  const inFoam = (A, x) => A.lanes.some((i) => Math.abs(x - LANES[i]) < LW / 2 - 0.05);

  function stepBoss(st, dt) {
    const b = st.b, h = st.h, P = PH[st.phase]; st.bt += dt; b.flash = Math.max(0, b.flash - dt * 4); b.open -= dt; if (b.hurtT >= 0 && (b.hurtT += dt) > 0.3) b.hurtT = -1;
    switch (st.bs) {
      case 'intro': if (st.bt > st.bdur) { setB(st, 'top', 0.6); b.left = P.n; } break;
      case 'top': if (st.bt > st.bdur) { startAttack(st, chooseAttack(st)); setB(st, 'attack', 99); } break;
      case 'attack': if (stepAttack(st, dt)) { st.atk = null; b.left--; clearAttackFx(); if (b.left > 0) setB(st, 'top', 0.45); else hopTo(st, clamp(h.x * 0.8, -4.5, 4.5), LOWY, LOWZ, 0.8); } break;
      case 'hop': { const u = clamp(st.bt / st.bdur, 0, 1); b.x = lerp(b.fromX, b.toX, u); b.z = lerp(b.fromZ, b.toZ, u); b.y = lerp(b.fromY, b.toY, u) + Math.sin(u * Math.PI) * 0.9;
        if (u >= 1) { if (b.toY < 0.5) { setB(st, 'scrub', P.win); b.open = 1.25; b.near = 0; sfx('jump'); st.shk = Math.max(st.shk, 0.2); DUELS.tell('SHE\u2019S DOWN ON THE STEP: SWING!', 1.0); }
          else { setB(st, 'top', 0.7); b.left = P.n; } } break; }
      case 'scrub': { const d = Math.hypot(h.x - b.x, h.z - b.z); b.near = d < 2.4 ? b.near + dt : Math.max(0, b.near - dt * 0.5);
        b.x = damp(b.x, clamp(h.x, b.x - 1.5, b.x + 1.5), 0.6, dt); b.x = clamp(b.x, -5, 5); // shuffles along the step toward him a little
        if (st.bt > st.bdur) { hopTo(st, clamp(b.x, -4, 4), TOPY, TOPZ, 0.75); b.left = P.n; break; }
        if (b.near > (st.phase === 0 ? 1.4 : 1.0) && b.open <= 0) { setB(st, 'sweepTell', 1.0); S.sweepRing.visible = true; tell('BRUSH SWEEP! BACK OFF OR HOP', 1.0); } break; }
      case 'sweepTell': if (st.bt > st.bdur) { setB(st, 'sweep', 0.35); sfx('swing'); const d = Math.hypot(h.x - b.x, h.z - b.z);
          if (d < 2.4 && h.jumpT < 0) haroldHit(st, DMG.sweep, 'sweep'); else if (d < 3.4) dodged(st, 'WHIFF!'); bubbles(b.x, 0.4, b.z + 1.0, 10, 2.5, 1.5); } break;
      case 'sweep': if (st.bt > st.bdur) { S.sweepRing.visible = false; b.near = 0; setB(st, 'scrub', Math.max(1.0, PH[st.phase].win * 0.5)); } break;
      case 'dizzy': if (st.bt > st.bdur) { b.open = 0; hopTo(st, clamp(b.x, -4, 4), TOPY, TOPZ, 0.75); b.left = PH[st.phase].n; } break;
      case 'ko': break;
    }
  }
  function clearAttackFx() { S.lanes.forEach((L) => { L.tel.visible = false; L.foam.visible = false; }); S.shadows.forEach((m) => (m.visible = false)); S.shRings.forEach((m) => (m.visible = false)); S.buckets.forEach((m) => (m.visible = false)); S.lines.forEach((m) => (m.visible = false)); }
  const bossLow = (st) => st.b.y < 0.75 && (st.bs === 'scrub' || st.bs === 'sweepTell' || st.bs === 'sweep' || st.bs === 'dizzy');

  // ---------------- Harold ----------------
  const SWD = [0.3, 0.3, 0.48];
  function stepHarold(st, dt, I) {
    const h = st.h; h.inv -= dt; h.comboT -= dt; h.blindT -= dt;
    if (h.hurtT >= 0 && (h.hurtT += dt) > 0.45) h.hurtT = -1;
    if (h.slipT >= 0) { h.slipT += dt; h.yaw += dt * 14; h.x += h.vx * dt; h.z += h.vz * dt; h.vx *= 0.94; h.vz *= 0.94; if (h.slipT > 0.75) h.slipT = -1; clampH(h); return; }
    // move (camera looks north up the steps: stick up = toward her)
    let mx = I.mx, mz = -I.my; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const sp = (h.swT >= 0 ? 0.35 : 1) * SPD * (h.jumpT >= 0 ? 1.35 : 1);
    h.vx = damp(h.vx, mx * sp, 14, dt); h.vz = damp(h.vz, mz * sp, 14, dt); h.x += h.vx * dt; h.z += h.vz * dt; clampH(h);
    if (ml > 0.2 && h.swT < 0) h.yaw = dampA(h.yaw, Math.atan2(mx, mz), 14, dt);
    // dodge hop
    if (I.b && h.jumpT < 0) { h.jumpT = 0; h.inv = Math.max(h.inv, 0.32); sfx('jump'); if (ml < 0.2) { h.vz += 2.5; } else { h.vx += mx * 3; h.vz += mz * 3; } }
    if (h.jumpT >= 0) { h.jumpT += dt; h.jy = Math.sin(clamp(h.jumpT / 0.5, 0, 1) * Math.PI) * 0.75; if (h.jumpT > 0.5) { h.jumpT = -1; h.jy = 0; } }
    // swing combo
    if (I.a) { if (h.swT < 0) startSwing(st, h.comboT > 0 ? (h.swN + 1) % 3 : 0); else if (h.swT > SWD[h.swN] * 0.35) h.queued = true; }
    if (h.swT >= 0) { h.swT += dt; const D = SWD[h.swN];
      if (!h.swHit && h.swT > D * 0.38) { h.swHit = true; tryHit(st); }
      if (h.swN === 2) { const a = h.yaw + h.swT * 14; bubbles(h.x + Math.sin(a) * 1.1, 0.9, h.z + Math.cos(a) * 1.1, 1, 0.4, 0.6, 0.45); }
      if (h.swT > D) { h.swT = -1; h.comboT = 0.45; if (h.queued) { h.queued = false; startSwing(st, (h.swN + 1) % 3); } } }
    // face her while swinging
    if (h.swT >= 0 && bossLow(st)) h.yaw = dampA(h.yaw, Math.atan2(st.b.x - h.x, st.b.z - h.z), 20, dt);
    // POWER: STOOP SURF
    if (I.c && st.pow >= 100 && !st.surf && !st.over) startSurf(st);
  }
  function clampH(h) { h.x = clamp(h.x, -XL, XL); h.z = clamp(h.z, Z0, Z1); }
  function startSwing(st, n) { const h = st.h; h.swN = n; h.swT = 0; h.swHit = false; sfx('swing'); }
  function tryHit(st) {
    const h = st.h, b = st.b; if (!bossLow(st) || st.over) return; const d = Math.hypot(b.x - h.x, b.z - h.z); if (d > REACH + (h.swN === 2 ? 0.4 : 0)) return;
    const crit = b.open > 0 || st.bs === 'dizzy'; let dmg = HIT[h.swN] * (crit ? CRIT : 1); dmg = Math.round(dmg);
    st.bhp -= dmg; st.stats.landed++; if (crit) st.stats.crits++; st.pow = Math.min(100, st.pow + POW_HIT); b.flash = 1; b.hurtT = 0;
    st.hs = h.swN === 2 ? 0.085 : 0.065; st.shk = Math.max(st.shk, h.swN === 2 ? 0.45 : 0.22); sfx(h.swN === 2 ? 'heavy' : 'hit');
    pop(V.set(b.x, b.y + 2.3, b.z), (h.swN === 2 ? 'SPLOOSH! ' : '') + dmg + (crit ? '!' : ''), crit ? 'c' : h.swN === 2 ? 'w' : '');
    bubbles(b.x, b.y + 1.2, b.z + 0.5, h.swN === 2 ? 14 : 6, 2.4, 2.4, 0.6);
    if (h.swN === 2 && st.bs === 'sweepTell') { S.sweepRing.visible = false; setB(st, 'scrub', 1.2); DUELS.tell('INTERRUPTED!', 0.7); } // a finisher cancels the sweep
    if (Math.random() < 0.18) say(pick(GR.hurt), 1.8);
    checkPhase(st); hud(st);
  }
  function checkPhase(st) {
    if (st.bhp <= 0) { koStart(st); return; }
    const np = st.bhp <= 33 ? 2 : st.bhp <= 66 ? 1 : 0; if (np > st.phase) { st.phase = np; DUELS.banner('PHASE ' + (np + 1) + '<small>' + (np === 1 ? 'MORE SUDS, HON' : 'DOUBLE BUCKETS · TWIN GLARE') + '</small>', 1.6); say(pick(GR.taunt), 2.2);
      st.atk = null; clearAttackFx(); S.sweepRing.visible = false; if (!st.surf) { hopTo(st, clamp(st.b.x, -4, 4), TOPY, TOPZ, 0.75); } }
  }
  // ---------------- STOOP SURF (team-up special) ----------------
  function startSurf(st) {
    st.pow = 0; st.stats.surfs++; st.atk = null; clearAttackFx(); S.sweepRing.visible = false; st.surf = { t: 0, hit: false, x0: st.h.x, z0: st.h.z };
    st.slow = 0.45; st.slowT = 1.9; DUELS.banner('STOOP SURF!<small>MAVIS SENDS THE BRUSH</small>', 1.6); DUELS.say('MAVIS', 'Ride it, Harold! Down the steps!', 1.8); sfx('jump'); hud(st);
    const b = st.b; if (b.y > 0.75 || st.bs === 'hop') { b.x = clamp(b.x, -4, 4); }
  }
  function stepSurf(st, dt) {
    const s = st.surf, h = st.h, b = st.b; s.t += dt; h.inv = 0.5;
    // 0..0.55: Mavis flings, Harold leaps to the top step;  0.55..1.35: surf down the suds toward her;  impact;  ..1.9 settle
    const bx = b.x, bz = (b.y > 0.75 ? TOPZ + 0.6 : LOWZ + 0.6);
    if (s.t < 0.55) { const u = s.t / 0.55; h.x = lerp(s.x0, bx, u); h.z = lerp(s.z0, -4.2, u); h.jy = Math.sin(u * Math.PI) * 2.6 + u * 1.2; }
    else if (s.t < 1.35) { const u = (s.t - 0.55) / 0.8; h.x = bx; h.z = lerp(-4.2, bz + 0.2, u); if (b.y > 0.75) h.z = lerp(-4.4, bz, u); h.jy = stepY(h.z) + 0.15; bubbles(h.x, h.jy, h.z + 0.3, 2, 1.2, 1.2, 0.4); }
    else if (!s.hit) { s.hit = true; const dmg = SURF_DMG; st.bhp -= dmg; b.flash = 1; b.hurtT = 0; st.hs = 0.12; st.shk = 0.8; sfx('heavy'); splashSfx(); pop(V.set(b.x, b.y + 2.4, b.z), 'STOOP SURF! ' + dmg, 'c'); bubbles(b.x, b.y + 1, b.z, 24, 3.4, 3.4, 1.0);
      st.stats.landed++; hud(st); if (st.bhp <= 0) { st.surf = null; h.jy = 0; h.x = clamp(h.x, -XL, XL); h.z = Z0 + 0.4; koStart(st); return; }
      checkPhase(st); }
    else if (s.t > 1.9) { st.surf = null; h.jy = 0; h.z = Math.max(Z0 + 0.3, Z0); h.vx = 0; h.vz = 2; setB(st, 'dizzy', 2.0); b.open = 2.0; if (b.y > 0.75) { b.y = LOWY; b.z = LOWZ; } DUELS.tell('SHE\u2019S DIZZY: FINISH IT!', 1.2); }
    S.surf.visible = !!st.surf;
  }

  // ---------------- win / lose ----------------
  function koStart(st) { if (st.over) return; st.over = true; st.won = true; st.bhp = 0; st.atk = null; clearAttackFx(); S.sweepRing.visible = false; setB(st, 'ko', 99); st.outT = 0;
    st.slow = 0.35; st.slowT = 2.4; st.ko = { x: st.b.x, y: st.b.y, z: st.b.z }; DUELS.log.push('scrubber:win'); DUELS.banner('K.O.!<small>SHE SLIPPED ON HER OWN SUDS</small>', 2.2); hud(st);
    S.lanes.forEach((L) => { L.foam.visible = true; L.foam.material.opacity = 0.75; }); }
  function stepKO(st, dt) {
    st.outT += dt; const b = st.b, k = st.ko, u = clamp(st.outT / 3.0, 0, 1); // slide from where she fell, down the steps, across the plaza into the fountain
    const e = ease(u), z = lerp(k.z, FZ, e), x = lerp(k.x, FX, e * e); b.x = x; b.z = z; b.y = u < 0.82 ? stepY(z) + 0.05 : 0.05 + Math.sin(clamp((u - 0.82) / 0.18, 0, 1) * Math.PI) * 1.3;
    if (st.outT < 3 && Math.random() < 0.5) bubbles(b.x, b.y + 0.2, b.z, 2, 1.0, 1.0, 0.5);
    if (u >= 1 && !st.splashed) { st.splashed = true; splashSfx(); sfx('ko'); st.shk = 0.6; bubbles(FX, 0.6, FZ, 40, 3.6, 4.4, 1.2); }
    if (st.outT > 3.4 && !st.said) { st.said = true; { const l = pick(GR.defeat); DUELS.say('THE STOOP SCRUBBER', /^okay hon/i.test(l) ? l : 'Okay hon. ' + l, 3.2); } }
    if (st.outT > 5.6 && !st.done) { st.done = true; DUELS.bossCleared('monument', 'scrubber');
      const n = st.stats.hitsTaken, g = n <= 3 ? '★★★ S' : n <= 7 ? '★★ A' : '★ B';
      setTimeout(() => { if (DUELS.cur === S) DUELS.over('win', GR.clear.replace('!', '') + '!<br><span style="font-size:15px;color:#ffd23c">' + g + '</span>',
        'Hits taken: ' + n + ' · Dodges: ' + st.stats.dodges + ' · Stoop Surfs: ' + st.stats.surfs + '. Mount Vernon is clear. Crime at the Washington Monument: 0.'); }, SIM ? 300 : 700); }
  }
  function lose(st) { if (st.over) return; st.over = true; st.won = false; st.atk = null; clearAttackFx(); S.sweepRing.visible = false; setB(st, 'win', 99); DUELS.log.push('scrubber:lose'); sfx('ko');
    say('Now wipe your feet on the way out, hon.', 2.6);
    setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', 'SCRUBBED OUT!', 'Watch the foam lanes, step out of the bucket shadow, and get off the lit line. Then swing while she\u2019s down on the step.'); }, SIM ? 300 : 1400); }

  // ---------------- main step ----------------
  S.step = function (dt0, I) {
    const st = S.st; if (!st) return;
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    if (st.hs > 0) { st.hs -= dt0; dt0 *= 0.06; }
    const dt = dt0 * st.slow; st.t += dt; st.shk = Math.max(0, st.shk - dt0 * 1.6);
    if (st.over) { if (st.won) stepKO(st, dt); stepFx(dt); return; }
    if (st.surf) stepSurf(st, dt); else stepHarold(st, dt, I);
    if (!st.over) stepBoss(st, dt);
    DUELS.hot(st.pow >= 100);
    stepFx(dt); if ((st._hudT = (st._hudT || 0) - dt) < 0) { st._hudT = 0.1; hud(st); }
  };
  function stepFx(dt) {
    const q = S.cam.quaternion;
    for (let i = S.fxs.length - 1; i >= 0; i--) { const p = S.fxs[i]; p.t += dt; p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) S.fxs.splice(i, 1); }
    S.fxs.forEach((p, i) => { const s = 1 - p.t / p.life * 0.6; M4.compose(p.p, q, V.set(s, s, s)); S.fx.setMatrixAt(i, M4); }); S.fx.count = S.fxs.length; S.fx.visible = S.fxs.length > 0; S.fx.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    const h = st.h; let p;
    if (st.over && !st.won) { p = HERO_POSES.down(1, true); return p; }
    if (st.surf) { p = HERO_POSES.idle(t); legsStance(p, 0.3, 0.6); p.shL = [-0.3, 0, 1.3]; p.shR = [-0.3, 0, -1.3]; p.elL = p.elR = [-0.2, 0, 0]; p.torso = [0.25, 0.5, 0]; return p; }
    if (st.over && st.won) { p = HERO_POSES.idle(t); p.shR = [-2.9, 0, -0.3]; p.elR = [-0.2, 0, 0]; p.y += Math.abs(Math.sin(t * 5)) * 0.1; return p; }
    if (h.slipT >= 0) { p = HERO_POSES.hurt(0.2); p.shL = [-2.6, 0, 1.2]; p.shR = [-2.6, 0, -1.2]; p.lgL = [-1.2, 0, 0.3]; p.y = 0.1; return p; }
    if (h.hurtT >= 0) return HERO_POSES.hurt(h.hurtT / 0.45);
    if (h.swT >= 0) { const u = h.swT / SWD[h.swN]; return h.swN === 0 ? HERO_POSES.atk1(u) : h.swN === 1 ? HERO_POSES.atk2(u) : HERO_POSES.atk3(u); }
    if (h.jumpT >= 0) return HERO_POSES.jump(h.jumpT < 0.25 ? 1 : -1);
    const sp = Math.hypot(h.vx, h.vz); return sp > 0.6 ? HERO_POSES.run(t, sp) : HERO_POSES.idle(t);
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t);
    if (st.surf && st.surf.t < 0.6) { const k = clamp(st.surf.t / 0.35, 0, 1); p.shR = [lerp(0.6, -2.6, k), 0, -0.3]; p.elR = [-0.2, 0, 0]; p.torso = [lerp(0.3, -0.2, k), -0.5, 0]; return p; }
    const cheer = st.won ? 1 : 0.4, w = Math.sin(t * (6 + cheer * 6)); p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.2 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer; return p; }
  function poseBoss(st, dt) {
    const R = S.R, b = st.b, t = st.t, B0 = S.base; let mode = st.bs === 'attack' && st.atk ? ({ suds: 'suds', bucket: 'throw', glare: 'glare' })[st.atk.kind] : st.bs;
    if (mode === 'intro' || mode === 'top') mode = 'idle'; if (b.hurtT >= 0 && mode !== 'ko') mode = 'hurt';
    R.root.position.set(b.x, b.y, b.z);
    const face = st.bs === 'ko' ? Math.PI * 0.1 + st.outT * 3 : Math.atan2(st.h.x - b.x, st.h.z - b.z) * 0.6; R.root.rotation.y = damp(R.root.rotation.y, face, 8, dt);
    const u = st.atk ? clamp(st.atk.t / st.atk.tell, 0, 1) : clamp(st.bt / Math.max(0.01, st.bdur), 0, 1);
    for (const m of R.flash) if (m && m.userData && m.userData.flash) { m.userData.flash.value = Math.max(b.flash * 0.32, st.bs === 'sweepTell' ? (Math.sin(t * 24) * 0.5 + 0.5) * 0.3 : 0); if (m.userData.flashC) m.userData.flashC.value.set(st.bs === 'sweepTell' ? '#ff3d6e' : '#ffffff'); }
    if (R.update) { try { R.update(dt, mode, { t, u, hp: Math.max(0, st.bhp) / BHP0 }); } catch (e) { console.error(e); R.update = null; } return; }
    let aLx = -0.2, aLz = 0.2, aRx = -0.3, aRz = -0.2, hX = 0, hY = 0, lean = 0, bob = Math.sin(t * 2.6) * 0.03, roll = 0;
    if (mode === 'suds') { const k = ease(u); aLx = lerp(-0.2, -2.0, k); aLz = lerp(0.2, -0.6, k); lean = 0.25 * k; }
    if (mode === 'throw') { const k = ease(u); aLx = lerp(-0.2, -3.0, k); aLz = 0.3; lean = -0.2 * k; hX = -0.3 * k; if (st.atk.on) { aLx = -1.0; lean = 0.3; } }
    if (mode === 'glare') { aRx = -1.4 + Math.sin(t * 14) * 0.25; aRz = -0.3 + Math.cos(t * 14) * 0.35; lean = 0.45; hX = 0.35; }
    if (mode === 'hop') { aLx = aRx = -2.4; aLz = 0.6; aRz = -0.6; }
    if (mode === 'scrub') { aRx = -1.3 + Math.sin(t * 12) * 0.3; aRz = Math.sin(t * 6) * 0.6; lean = 0.55; hX = 0.3; if (b.open > 0) { lean = 0.75; hX = 0.6; bob = Math.sin(t * 9) * 0.05; } }
    if (mode === 'sweepTell') { const k = ease(clamp(st.bt / st.bdur, 0, 1)); aRx = lerp(-1.3, -2.9, k); aRz = lerp(0, 1.2, k); lean = -0.15 * k; }
    if (mode === 'sweep') { const k = clamp(st.bt / st.bdur, 0, 1); aRx = -1.4; aRz = lerp(1.2, -1.6, k); lean = 0.3; }
    if (mode === 'dizzy') { roll = Math.sin(t * 6) * 0.15; hY = Math.sin(t * 4) * 0.5; aLx = aRx = -0.2; aLz = 0.8; aRz = -0.8; }
    if (mode === 'hurt') { lean = -0.3; hX = -0.4; }
    if (mode === 'ko') { lean = -1.3; aLx = aRx = -2.8; aLz = 1.0; aRz = -1.0; roll = Math.sin(t * 8) * 0.3; }
    if (mode === 'win') { aRx = -2.6; aRz = 0.3; bob = Math.abs(Math.sin(t * 6)) * 0.08; hX = -0.3; }
    R.body.rotation.x = damp(R.body.rotation.x, lean, 10, dt); R.body.rotation.z = damp(R.body.rotation.z, roll, 10, dt); R.body.position.y = bob;
    R.head.rotation.x = damp(R.head.rotation.x, B0.hd.x + hX, 10, dt); R.head.rotation.y = damp(R.head.rotation.y, B0.hd.y + hY, 10, dt);
    R.armL.rotation.x = damp(R.armL.rotation.x, aLx, 12, dt); R.armL.rotation.z = damp(R.armL.rotation.z, aLz, 12, dt);
    R.armR.rotation.x = damp(R.armR.rotation.x, aRx, 16, dt); R.armR.rotation.z = damp(R.armR.rotation.z, aRz, 16, dt);
    if (R.bucket) R.bucket.visible = !(st.atk && st.atk.kind === 'bucket' && st.atk.t > st.atk.tell * 0.45);
  }
  function poseAttackFx(st) {
    const A = st.atk, t = st.t, b = st.b;
    if (A && A.kind === 'suds') { const live = A.t >= A.tell; for (let i = 0; i < 5; i++) { const L = S.lanes[i], on = A.lanes.includes(i); L.tel.visible = on && !live; L.foam.visible = on && live;
        if (L.tel.visible) L.tel.material.opacity = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * (10 + 14 * A.t / A.tell))); if (L.foam.visible) L.foam.material.opacity = Math.min(0.92, (A.t - A.tell) * 5) * (A.t > A.tell + A.live - 0.4 ? clamp((A.tell + A.live - A.t) / 0.4, 0, 1) : 1); }
      S.ft.offset.y = -t * 0.9; S.stt.offset.y = t * 1.6; }
    if (A && A.kind === 'bucket') A.targets.forEach((tg, i) => { const k = clamp(A.t / A.tell, 0, 1), sh = S.shadows[i], rg = S.shRings[i], bk = S.buckets[i];
      sh.visible = rg.visible = A.t < A.tell; sh.position.set(tg.x, 0.03, tg.z); const s = lerp(0.6, 2.9, k); sh.scale.set(s, s, 1); sh.material.opacity = 0.25 + 0.45 * k;
      rg.position.set(tg.x, 0.035, tg.z); rg.scale.set(2.9, 2.9, 1); rg.material.opacity = 0.4 + 0.4 * Math.sin(t * 18);
      const ku = clamp((A.t - A.tell * 0.45) / (A.tell * 0.55), 0, 1); bk.visible = A.t > A.tell * 0.45 && A.t < A.tell + 0.05;
      if (bk.visible) { bk.position.set(lerp(b.x - 0.8, tg.x, ku), lerp(b.y + 2.2, 0.3, ku) + Math.sin(ku * Math.PI) * 7, lerp(b.z, tg.z, ku)); bk.rotation.set(ku * 9, 0, ku * 4); } });
    if (A && A.kind === 'glare') A.dirs.forEach((d, i) => { const m = S.lines[i], live = A.t >= A.tell, len = 16; m.visible = true;
      const w = live ? 1.7 : 0.18 + 0.08 * Math.sin(t * 30); m.scale.set(w, len, 1); E3.set(-Math.PI / 2, 0, -d); m.quaternion.setFromEuler(E3);
      m.position.set(b.x + Math.sin(d) * len / 2, 0.06, b.z + Math.cos(d) * len / 2); m.material.opacity = live ? clamp(1 - (A.t - A.tell) / A.beam, 0, 1) * 0.95 : 0.55 + 0.35 * Math.sin(t * 22);
      if (live && A.t - A.tell < 0.05) bubbles(b.x, b.y + 0.4, b.z + 0.6, 4, 1.5, 2, 0.4); });
    if (S.sweepRing.visible) { const k = clamp(st.bt / Math.max(0.01, st.bdur), 0, 1); S.sweepRing.position.set(b.x, 0.04, b.z + 0.6); const s = 4.8; S.sweepRing.scale.set(s, s, 1); S.sweepRing.material.opacity = st.bs === 'sweep' ? 0.9 : 0.35 + 0.45 * k + 0.15 * Math.sin(t * 26); }
  }
  S.render = function (rdt) {
    const st = S.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.hs > 0 ? 0.1 : st.slow), t = st.t, h = st.h;
    const H = S.H; H.root.position.set(h.x, (st.surf ? h.jy : h.jy), h.z); H.root.rotation.y = h.yaw; applyPose(H, haroldPose(st, t), 18, dt, h.slipT >= 0);
    if (H.mat.userData.flash) H.mat.userData.flash.value = h.inv > 0 && !st.surf ? (Math.sin(t * 30) > 0 ? 0.35 : 0) : Math.max(0, H.mat.userData.flash.value - dt * 4);
    S.surf.visible = !!st.surf; if (st.surf) { S.surf.position.set(h.x, h.jy - 0.05, h.z); S.surf.rotation.y = 0; }
    const M = S.M, mx = st.surf && st.surf.t < 0.6 ? lerp(-5.2, h.x - 1.2, 0.25) : st.won && st.outT > 3.5 ? -3.4 : -4.4; M.root.position.set(damp(M.root.position.x, mx, 4, dt), 0, damp(M.root.position.z, 6.4, 4, dt)); M.root.rotation.y = Math.atan2(h.x - M.root.position.x, h.z - M.root.position.z) * 0.6 + Math.PI * 0.85; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseBoss(st, dt); poseAttackFx(st);
    // camera: behind + above Harold looking up the steps; portrait sits higher and further back so the whole step face and her shadows fit
    const port = VH() > VW(); S.cam.fov = port ? 60 : 50; S.cam.updateProjectionMatrix();
    let cx = h.x * 0.4, cy = port ? 8.6 : 6.4, cz = h.z * 0.55 + (port ? 10.4 : 9.6), lx = h.x * 0.3 + st.b.x * 0.15, ly = port ? 0.9 : 1.4, lz = port ? -1.4 : -2.2;
    if (st.surf) { cx = h.x + 3; cy = 3.2; cz = h.z + 5; lx = h.x; ly = 1.2; lz = h.z - 2; }
    if (st.over && st.won) { cx = 3.5; cy = port ? 6.5 : 4.5; cz = 15; lx = st.b.x * 0.6; ly = 0.8; lz = st.b.z - 1.5; }
    V.set(cx, cy, cz); V2.set(lx, ly, lz);
    if (st.bs === 'intro' && st.bt < st.bdur) { const k = ease(clamp(st.bt / st.bdur, 0, 1)); V.lerpVectors(V3.set(0, 3.5, 3), V, k); V2.lerpVectors(V3.set(0, 2.5, -4), V2, k); }
    S.camP.lerp(V, 1 - Math.exp(-5 * dt)); S.camL.lerp(V2, 1 - Math.exp(-6 * dt));
    S.cam.position.copy(S.camP); if (st.shk > 0) S.cam.position.add(V3.set(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(st.shk * 0.25)); S.cam.lookAt(S.camL);
    // blind (Marble Glare) + "!" over her head + pops
    DUELS.blind(h.blindT > 0 ? clamp(h.blindT / 1.1, 0, 1) * 0.75 : 0);
    const W = VW(), Hh = VH(); S.bangT = (S.bangT || 0) - dt;
    if (S.bangT > 0 && !st.over) { V.set(st.b.x, st.b.y + 3.0, st.b.z).project(S.cam); S.ui.bang.style.opacity = (Math.sin(t * 20) > -0.3 ? '1' : '0.4'); S.ui.bang.style.left = ((V.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; S.ui.bang.style.top = ((-V.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px'; }
    else S.ui.bang.style.opacity = '0';
    for (const P of S.ui.pops) { if (P.t <= 0) { if (P.el.style.opacity !== '0') P.el.style.opacity = '0'; continue; } P.t -= Math.min(0.05, rdt * (SIM || 1)); P.p.y += rdt * (SIM || 1) * 1.2; V.copy(P.p).project(S.cam);
      P.el.style.opacity = clamp(P.t * 2.5, 0, 1).toFixed(2); P.el.style.left = ((V.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; P.el.style.top = ((-V.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px'; }
    OUT_U.fogC.value.copy(S.scene.fog.color); OUT_U.fogN.value = 24; OUT_U.fogF.value = 70;
  };
  S.onResize = () => {};

  // ---------------- test bot: ?scrubberauto=win plays it clean (reads every tell); lose stands in the open and never swings ----------------
  S.botThink = function (B, dt) {
    const st = S.st; if (!st || st.over) return; const h = st.h, b = st.b, A = st.atk; B.mx = B.my = 0; if (st.surf) return;
    if (B.mode === 'lose') { const tx = 0, tz = 3.2; B.mx = clamp((tx - h.x) * 0.8, -1, 1); B.my = -clamp((tz - h.z) * 0.8, -1, 1); return; }
    let tx = h.x, tz = h.z, danger = false;
    if (A && A.kind === 'suds' && A.t < A.tell + A.live) { const safe = [0, 1, 2, 3, 4].filter((i) => !A.lanes.includes(i)); let best = safe[0]; for (const i of safe) if (Math.abs(LANES[i] - h.x) < Math.abs(LANES[best] - h.x)) best = i; tx = LANES[best]; tz = clamp(h.z, 2.5, Z1); danger = inFoam(A, h.x); }
    else if (A && A.kind === 'bucket' && A.t < A.tell) { let ax = 0, az = 0; for (const tg of A.targets) { const dx = h.x - tg.x, dz = h.z - tg.z, d = Math.hypot(dx, dz) || 0.01; if (d < 2.6) { ax += dx / d; az += dz / d; danger = true; } }
      if (danger) { if (Math.hypot(ax, az) < 0.2) ax = h.x > 0 ? -1 : 1; tx = h.x + ax * 3; tz = h.z + az * 3; if (Math.abs(tx) > XL - 0.5) { tx = h.x; tz = h.z + (h.z < 3.5 ? 3 : -3); } } }
    else if (A && A.kind === 'glare' && A.t < A.tell + 0.1) { let ax = 0, az = 0; for (const d of A.dirs) { const dx = Math.sin(d), dz = Math.cos(d), rx = h.x - b.x, rz = h.z - b.z, cr = rx * dz - rz * dx; if (Math.abs(cr) < 1.6) { const s = cr >= 0 ? 1 : -1; ax += dz * s; az += -dx * s; danger = true; } }
      if (danger) { tx = h.x + ax * 3; tz = h.z + az * 3; if (Math.abs(tx) > XL - 0.3) { tx = h.x - ax * 3; tz = h.z - az * 3; } } }
    else if (st.bs === 'sweepTell') { tx = b.x + (h.x >= b.x ? 3.2 : -3.2); tz = 3.6; danger = true; }
    else if (bossLow(st)) { tx = b.x + (h.x >= b.x ? 0.5 : -0.5); tz = Z0 + 0.3; const d = Math.hypot(b.x - h.x, b.z - h.z); if (d < REACH - 0.15) { B.ctr = (B.ctr || 0) - dt; if (B.ctr <= 0) { B.a = true; B.ctr = 0.12; } } }
    else { tx = clamp(b.x * 0.5, -3, 3); tz = 3.0; }
    if (st.pow >= 100 && bossLow(st) && st.bs === 'scrub') B.c = true;
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz); if (d > 0.15) { B.mx = clamp(dx / Math.max(d, 0.5), -1, 1); B.my = -clamp(dz / Math.max(d, 0.5), -1, 1); }
    if (danger && A && A.kind === 'suds' && A.t >= A.tell - 0.15 && inFoam(A, h.x) && h.jumpT < 0) B.b = true;
  };
  DUELS.reg('scrubber', S);

  // ---------------- the city side: ACT "SCRUB-OFF" at the Washington Monument's boss anchor (REAL landmark anchor, not temporary) ----------------
  function setupTrigger() {
    const L = LANDMARKS.find((l) => l.id === 'monument'); if (!L || !L.boss) return;
    const x = L.boss.x, z = L.boss.z; DUELS.addTrigger('scrubber', L, x, z, x, z + 2.4, '#7adfff');
    const act = ACTIONS[ACTIONS.length - 1]; if (act && act.kind === 'boss') Object.defineProperty(act, 'label', { get: () => (L.boss.cleared ? 'REMATCH' : 'SCRUB-OFF'), configurable: true });
    if (act) act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
  }
  let n = 0; MODE.ticks.push(() => { n++;
    if (n === 1) setupTrigger();
    if (n === 3 && Q.has('scrubber') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('scrubberauto'); DUELS.start('scrubber', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__scrubber = S; S.GR = GR;
})();

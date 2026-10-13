
// ======================= CHEF CRABCAKE, FOUR SEASONS: a hotel-kitchen line fight (boss 13; DESIGN.md Bosses + BOSS_GANG_UPGRADE_PLAN #17).
// A behind-the-player view across the steel pass of a big Harbor East hotel kitchen: Harold on the floor side, Mavis by the dish station, Chef Crabcake
// (an original red crab in chef's whites and a tall toque, two wooden crab mallets) behind the counter, ranges, hoods, hanging pots and the walk-in behind him.
// No real logos: the kitchen signs are generic ("PASS", "WALK-IN", "CHESAPEAKE SPICE").
// Attacks (every tell >= 1.0 s: a "!" over the chef, a lane / counter glow, a sound sting, a HUD call-out):
//   SEASONING BLIND: he rattles a giant spice tin (it glows orange) while a target ring follows Harold's lane; it locks red, then the cloud flies.
//        DODGE out of that lane (or DUCK). A hit = the screen goes orange for a couple of seconds + a little damage.
//   TWIN-MALLET DRUMROLL: both mallets go up (drum roll); then 4 slams on the counter, one lane at a time. Each lane flashes red before its slam:
//        stand in a lane that isn't flashing.
//   FLAMBE LINE: he lifts the big pan and tilts it (the pan flares, the counter edge glows orange end to end), then a fire line races along the counter
//        at chest height: DUCK under it.
// After every attack he is OPEN (mallets stuck in the counter / pan too hot): SWING. 3-hit cane combo (forehand, backhand, overhead "spatula smash"
// finisher). Swinging into his guard is BLOCKED. Hits and clean dodges fill POWER; full POWER = ACT "CHEF'S FLIP" (team-up: Mavis slides Harold a giant
// skillet down the pass, Harold vaults onto the counter and flips the chef in slow-mo: big damage). 3 phases (the HP bar has 3 pips).
// Easy-but-not-trivial (Chip Kid standard): half-ish damage, 1.3 s i-frames, Mavis tosses a crab cake when Harold is low (once a phase), one SECOND WIND,
// a heal between phases. A mash-SWING-only bot wins while taking hits.
// KO: slow-mo launch into the walk-in, the door slams, an "86'D" sign drops. Then DUELS.bossCleared('fourseasons') -> BOSS_CLEAR.clear('fourseasons')
// (src/06g0_boss_clear.js, unchanged). Star grade by hits taken (<=3 S, <=8 A, else B) on the win card; the entry ring stays lit for a REMATCH.
// Controls (the duel conventions): phone: stick left / right (or the white buttons) dodge, stick down or JUMP = DUCK, SWING = cane, ACT = CHEF'S FLIP.
// Desktop: A / D dodge, S or K duck, J swing, E flip. Gamepad: left stick / LB / RB dodge, A duck, X swing, Y flip.
// Entry: the glowing ring at the Four Seasons boss anchor on Pratt St (LANDMARKS 'fourseasons' boss {x 82, z -42}; DESIGN anchor, not temporary). ACT = FIGHT.
// Tests: ?crabcake=1 starts at load; &crabcakeauto=win|lose|mash plays it by itself (also ?duel=crabcake&duelbot=...); ?crabcakephase=N starts at phase N.
// Writing: GR1 bosses.chef_crabcake intro / defeat lines (06e_gr1_data.js) + short placeholder lines below.
//
// RIG HOOK (Opus): if window.buildChefCrabcake exists it is called as buildChefCrabcake({ THREE, toonMat, outlineMat, addOdir, QUAL }) and may return
//   { root, body?, head?, armL?, armR?, tin?, pan?, flash?: [materials], update?(dt, state, info) }
//   root: Object3D, feet at y 0 on the kitchen floor, facing +z (toward Harold / the camera), about 2.5 m tall with the toque.
//   armL / armR: shoulder pivots holding the mallets (armL = his left = screen right). rotation.x < 0 raises the mallet, > 0 brings it down onto the counter
//     in front of him (the counter top is 1.0 m high, 1.0 m in front of the root); rotation.y aims it toward a lane.
//   tin: the spice tin group (shaken: position / rotation jitter). pan: the flambé pan group (rotation.z tilts it toward screen left).
//   update(dt, state, info): optional, called every frame; state one of intro | guard | tinTell | tin | drumTell | drum | panTell | pan | open | flipped |
//     down | ko; info = { t, u (0..1 through the state), lane (-1..1 target), phase }. If update exists the core skips its own part animation.
//   Missing pieces are skipped (stand-in groups fill them). Otherwise the procedural stand-in chef below is used.
(function () {
  const C = { scene: null, cam: null, title: 'CHEF CRABCAKE', pips: 3,
    hint: '<b>A / D</b> dodge · <b>S</b> duck · <b>J</b> swing · <b>E</b> chef\'s flip (POWER)',
    labels: { a: 'SWING', b: 'DUCK', c: 'FLIP', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 4.7, CZ = 2.75, LANE = 1.4; // chef at z = MZ facing -z, the counter (the pass) at z = CZ, Harold at z = 0 facing +z. Screen right = world -x.
  const PH = [ // per phase: tell lengths, drum gap, open window, guard time, attack mix
    { tin: 1.4, drum: 1.35, gap: 0.68, pan: 1.5, guard: [1.0, 1.5], open: 1.7, mix: ['tin', 'drum', 'pan', 'drum', 'tin', 'pan'] },
    { tin: 1.25, drum: 1.2, gap: 0.6, pan: 1.35, guard: [0.8, 1.3], open: 1.5, mix: ['drum', 'pan', 'tin', 'drum', 'pan', 'tin'] },
    { tin: 1.1, drum: 1.1, gap: 0.54, pan: 1.2, guard: [0.6, 1.0], open: 1.35, mix: ['pan', 'drum', 'tin', 'drum', 'pan', 'tin', 'drum'] },
  ];
  const DMG = { tin: 7, slam: 8, fire: 11 }, SWING = [6, 6, 13], FLIP = 26;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const TAUNT = ['Order up! One toad, well done!', 'Taste my seasoning! In your eyes!', 'Two mallets, one Harold. Let\'s cook!'];
  const MID = ['Behind! Hot pan coming through!', 'Yes, chef? No, CHEF!', 'You call that a cane? I call it a whisk.', 'Mise en place, toad. Your place: the floor.'];
  const MAVIS = ['Get him, Harold! He oversalts!', 'Mind the hot pan, hon!', 'That\'s my husband, chef!', 'Here, hon, catch!'];
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'fourseasons'); const g = (window.GR1 || (typeof GR1 !== 'undefined' ? GR1 : null)); return (g && g.bosses && g.bosses.chef_crabcake) || (L && L.boss && L.boss.lines) || null; };

  // ---------------- textures ----------------
  function tileTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c9d2d6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const o = (y % 2) * 16; g.fillStyle = (x + y) % 5 ? '#f2f5f4' : '#e6ecec'; g.fillRect(x * 32 + o + 1, y * 16 + 1, 30, 14); } }, 256); }
  function floorTex() { return canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#3a3236' : '#8a2a2a'; g.fillRect(x * 32, y * 32, 32, 32); } g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, w, 6); }, 256); }
  function steelTex() { return canvasTex(128, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#9aa4ac'); gr.addColorStop(0.5, '#e4eaee'); gr.addColorStop(1, '#a4aeb6'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,90,100,.25)'; for (let i = 0; i < 40; i++) { g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.lineTo(w, y + rnd(-2, 2)); g.stroke(); } }, 128); }
  function signTex(text, bg, fg, sub) { return canvasTex(512, 160, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 ' + (sub ? 70 : 84) + 'px ' + FONT; g.fillText(text, w / 2, sub ? h * 0.42 : h / 2); if (sub) { g.font = '700 28px ' + FONT; g.fillText(sub, w / 2, h * 0.8); } }, 256); }
  function tinTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e0b020'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a3a7a'; g.fillRect(0, h * 0.22, w, h * 0.56);
    g.fillStyle = '#ffd23c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 40px ' + FONT; g.fillText('CHESAPEAKE', w / 2, h * 0.4); g.font = '900 52px ' + FONT; g.fillText('SPICE', w / 2, h * 0.6);
    g.fillStyle = '#c4161c'; g.font = '900 22px ' + FONT; g.fillText('CHEF\'S OWN BLEND', w / 2, h * 0.12); }, 256); }
  function ticketTex() { return canvasTex(128, 64, (g, w, h) => { for (let i = 0; i < 6; i++) { g.fillStyle = '#fffbea'; g.fillRect(4 + i * 20, 4, 17, 56); g.fillStyle = '#555'; for (let k = 0; k < 6; k++) g.fillRect(7 + i * 20, 12 + k * 7, rnd(6, 12), 2); } }, 128); }

  // ---------------- the arena: a hotel kitchen line ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const fl = floorTex(); fl.wrapS = fl.wrapT = THREE.RepeatWrapping; fl.repeat.set(9, 9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ map: fl })); floor.rotation.x = -Math.PI / 2; floor.position.z = 4; sc.add(floor);
    const tl = tileTex(); tl.wrapS = tl.wrapT = THREE.RepeatWrapping; tl.repeat.set(6, 2);
    const wallM = new THREE.MeshLambertMaterial({ map: tl });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), wallM); back.position.set(0, 3.5, 10.5); back.rotation.y = Math.PI; sc.add(back);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), wallM); w.position.set(s * 8, 3.5, 3); w.rotation.y = -s * Math.PI / 2; sc.add(w); }
    // the pass: a long steel counter between Harold and the chef, with a heat-lamp shelf over it + ticket rail
    const st = steelTex(); const steel = new THREE.MeshLambertMaterial({ map: st, color: '#ffffff' });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 1.15), steel); top.position.set(0, 1.0, CZ); sc.add(top);
    const R = K();
    R.add(G.box(6.4, 0.9, 1.0), '#7c868e', 0, 0.47, CZ).add(G.box(6.5, 0.06, 1.05), '#5a626a', 0, 0.3, CZ); // the counter body + undershelf
    for (let k = 0; k < 5; k++) R.add(G.cyl(0.22, 0.2, 0.06, 12), '#f4f4f0', -2.9 + k * 0.32, 1.09, CZ - 0.2).add(G.sph(0.12, 8, 6), '#c8843a', -2.9 + k * 0.32, 1.15, CZ - 0.2, 0, 0, 0, 1, 0.55, 1); // plated crab cakes up on the pass
    // back line: ranges with burner glow, ovens, the big hood, hanging pots
    R.add(G.box(9, 0.95, 1.3), '#4a4e56', 0, 0.48, 8.2).add(G.box(9.1, 0.08, 1.35), '#2a2c30', 0, 0.99, 8.2);
    for (let k = 0; k < 6; k++) R.add(G.box(1.2, 0.6, 0.05), '#22242a', -3.75 + k * 1.5, 0.45, 7.53).add(G.box(0.7, 0.05, 0.05), '#b8c0c6', -3.75 + k * 1.5, 0.72, 7.5);
    R.add(G.box(10, 1.2, 2.2), '#a8b0b6', 0, 4.6, 8.6).add(G.box(10.2, 0.15, 2.3), '#7c868e', 0, 4.0, 8.4);
    for (let k = 0; k < 7; k++) { const x = -3.6 + k * 1.2; R.add(G.cyl(0.015, 0.015, 0.6, 4), '#555', x, 3.55, 6.8).add(G.cyl(0.32 - (k % 3) * 0.06, 0.26 - (k % 3) * 0.05, 0.28, 10), k % 2 ? '#c87a3a' : '#9aa4ac', x, 3.15, 6.8); }
    R.add(G.box(16, 0.1, 0.6), '#7c868e', 0, 3.85, 6.8); // pot rack
    // side stations: dish pit on screen right (world -x), prep tables + a reach-in on screen left
    R.add(G.box(1.2, 0.95, 4), '#8c969e', -6.2, 0.48, 2).add(G.box(1.1, 1.8, 1.0), '#c8d0d6', 6.2, 0.9, 5.8).add(G.box(1.2, 0.95, 3), '#8c969e', 6.2, 0.48, 1.5);
    for (let k = 0; k < 5; k++) R.add(G.cyl(0.25, 0.25, 0.04, 12), '#f4f4f0', -6.2, 1.0 + k * 0.05, 1.2);
    // the walk-in: a steel box in the back-left corner (screen left = +x) with a door frame; the door itself swings (separate mesh)
    R.add(G.box(3.0, 3.4, 2.4), '#b8c0c6', 5.6, 1.7, 9.2).add(G.box(1.5, 2.3, 0.06), '#1a1c20', 5.0, 1.15, 7.98);
    sc.add(R.mesh(toonMat(), null, 0.003));
    // the walk-in door (hinged on its screen-left edge) + signs
    C.door = new THREE.Group(); C.door.position.set(5.75, 0, 7.94); sc.add(C.door);
    { const D = K(); D.add(G.box(1.5, 2.3, 0.1), '#d4dadf', -0.75, 1.15, 0).add(G.box(0.12, 0.5, 0.12), '#555', -1.35, 1.2, -0.08).add(G.box(1.3, 0.08, 0.02), '#9aa4ac', -0.75, 0.3, -0.06); D.mesh(toonMat(), C.door, 0.003); }
    const wsign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshBasicMaterial({ map: signTex('WALK-IN', '#1a3a7a', '#ffffff'), fog: false })); wsign.position.set(-0.75, 2.0, -0.07); wsign.rotation.y = Math.PI; C.door.add(wsign);
    const pass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.42), new THREE.MeshBasicMaterial({ map: signTex('THE PASS', '#14101f', '#ffd23c', 'HARBOR EAST · KITCHEN'), fog: false })); pass.position.set(1.9, 0.62, CZ - 0.52); pass.rotation.y = Math.PI; sc.add(pass);
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.42), new THREE.MeshBasicMaterial({ map: ticketTex(), fog: false })); tk.position.set(-4.5, 2.7, 10.45); tk.rotation.y = Math.PI; sc.add(tk);
    // the "86'D" sign that drops on the walk-in door at the KO
    C.sign86 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: signTex("86'D", '#c4161c', '#ffffff', 'KITCHEN CLOSED'), side: THREE.DoubleSide, fog: false })); C.sign86.visible = false; C.sign86.rotation.y = Math.PI; sc.add(C.sign86);
    // burner flames on the back range: one Points cloud
    const n = 36, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([-3.75 + (i % 6) * 1.5 + rnd(-0.2, 0.2), 1.08 + rnd(0, 0.08), 8.0 + Math.floor(i / 6) * 0.08], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    C.burners = new THREE.Points(g, new THREE.PointsMaterial({ map: DUELS.dot('#5aa8ff'), size: 0.28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sc.add(C.burners);
  }

  // ---------------- the chef stand-in: a big red crab in whites + toque, eye stalks, a mustache, two crab mallets, a spice tin, a flambé pan ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), flash: [] };
    const bM = toonMat(), aM = [toonMat(), toonMat()]; R.flash = [bM, aM[0], aM[1]]; R.bM = bM; R.aM = aM;
    R.body = new THREE.Group(); R.body.position.y = 0; R.root.add(R.body);
    const B = K();
    // legs (crab legs splayed under the coat)
    for (const s of [-1, 1]) for (const z of [-0.25, 0.2]) B.add(G.cyl(0.08, 0.1, 0.9, 6), '#d8401e', s * 0.55, 0.38, z, 0, 0, s * 0.55).add(G.cone(0.08, 0.4, 6), '#b8301a', s * 0.85, 0.06, z, 0, 0, -s * 0.2);
    // chef coat (double-breasted whites) + apron + neckerchief
    B.add(G.cyl(0.62, 0.72, 1.05, 14), '#f4f2ec', 0, 1.15, 0).add(G.cyl(0.66, 0.66, 0.1, 14), '#f4f2ec', 0, 1.7, 0);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) B.add(G.sph(0.045, 6, 5), '#14101f', s * 0.2, 1.5 - k * 0.2, 0.62);
    B.add(G.box(0.95, 0.75, 0.05), '#2a3a6a', 0, 0.9, 0.7).add(G.tor(0.3, 0.07, TAU, 6, 14), '#c4161c', 0, 1.78, 0.05, Math.PI / 2, 0, 0);
    // the crab shell head: wide, red, spiky edge, white eyes on stalks, a big mustache
    B.add(G.sph(1, 16, 10), '#e0401e', 0, 2.05, 0.05, 0, 0, 0, 0.95, 0.42, 0.62);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) B.add(G.cone(0.08, 0.26, 5), '#b8301a', s * (0.85 + k * 0.05), 2.05 - k * 0.07, 0.1, 0, 0, s * (-1.2 - k * 0.15));
    for (const s of [-1, 1]) B.add(G.cyl(0.04, 0.05, 0.36, 6), '#e0401e', s * 0.24, 2.48, 0.32, 0.2, 0, s * -0.15).add(G.sph(0.13, 10, 8), '#ffffff', s * 0.27, 2.68, 0.37).add(G.sph(0.06, 8, 6), '#14101f', s * 0.27, 2.68, 0.49);
    B.add(G.sph(0.16, 8, 6), '#3a2416', -0.16, 1.98, 0.62, 0, 0, 0.3, 1.4, 0.5, 0.6).add(G.sph(0.16, 8, 6), '#3a2416', 0.16, 1.98, 0.62, 0, 0, -0.3, 1.4, 0.5, 0.6).add(G.box(0.24, 0.04, 0.04), '#5a1a0a', 0, 1.88, 0.62);
    // the toque: band + a tall puffy top
    B.add(G.cyl(0.42, 0.42, 0.3, 14), '#ffffff', 0, 2.55, -0.02).add(G.sph(0.52, 14, 10), '#ffffff', 0, 2.95, -0.02, 0, 0, 0, 1, 0.75, 1).add(G.sph(0.3, 10, 8), '#f4f4f4', 0.2, 3.2, 0.02).add(G.sph(0.3, 10, 8), '#f4f4f4', -0.22, 3.18, -0.04);
    R.bodyM = B.mesh(bM, R.body);
    R.head = R.body; // (the head is baked into the body mesh)
    // arms: shoulder pivot > claw arm > a wooden crab mallet held upright (mallet head toward +y when raised)
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.78, 1.6, 0.1); R.body.add(sh);
      const A = K(); A.add(G.sph(0.2, 8, 6), '#f4f2ec', 0, 0, 0).add(G.cyl(0.11, 0.12, 0.7, 7), '#e0401e', s * 0.05, 0, 0.35, Math.PI / 2, 0, 0)
        .add(G.sph(1, 10, 8), '#e0401e', s * 0.05, 0, 0.78, 0, 0, 0, 0.24, 0.2, 0.3)
        .add(G.cyl(0.045, 0.05, 0.95, 6), '#c8a060', s * 0.05, 0.1, 1.15, Math.PI / 2, 0, 0) // the handle, pointing forward from the claw
        .add(G.cyl(0.17, 0.17, 0.42, 10), '#a8743a', s * 0.05, 0.1, 1.62, 0, 0, Math.PI / 2).add(G.cyl(0.175, 0.175, 0.06, 10), '#7a4a1a', s * 0.05 + 0.18, 0.1, 1.62, 0, 0, Math.PI / 2).add(G.cyl(0.175, 0.175, 0.06, 10), '#7a4a1a', s * 0.05 - 0.18, 0.1, 1.62, 0, 0, Math.PI / 2);
      A.mesh(aM[s > 0 ? 0 : 1], sh); R.arms.push({ sh, s }); }
    R.armL = R.arms[0].sh; R.armR = R.arms[1].sh;
    // the spice tin (held up over his head when shaking) and the flambé pan (raised in front for the flambé line)
    R.tin = new THREE.Group(); R.tin.position.set(0, 3.0, 0.5); R.tin.visible = false; R.body.add(R.tin);
    { const T = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 14), toonMat({ map: tinTex(), vertexColors: false })); T.material.customProgramCacheKey = () => 'ccTin'; R.tin.add(T); R.tinM = T.material; R.flash.push(T.material);
      const L = K(); L.add(G.cyl(0.36, 0.36, 0.1, 14), '#c8c8d0', 0, 0.44, 0).add(G.cyl(0.36, 0.36, 0.06, 14), '#c8c8d0', 0, -0.42, 0); L.mesh(toonMat(), R.tin, 0.003); }
    R.pan = new THREE.Group(); R.pan.position.set(0, 1.45, 0.95); R.pan.visible = false; R.body.add(R.pan);
    { const P = K(); P.add(G.cyl(0.5, 0.42, 0.14, 16), '#2a2c30', 0, 0, 0).add(G.cyl(0.45, 0.45, 0.02, 16), '#5a5e66', 0, 0.07, 0).add(G.cyl(0.05, 0.05, 0.8, 6), '#2a2c30', 0.85, 0.04, 0, 0, 0, Math.PI / 2); R.panM = toonMat(); P.mesh(R.panM, R.pan, 0.003); R.flash.push(R.panM); }
    return R;
  }

  // ---------------- build ----------------
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#2a2430', 18, 40);
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 120);
    DUELS.sceneLights(sc, '#fff4e8', '#3a3040', 1.35, '#ffffff', 1.6, new THREE.Vector3(0.3, 1, -0.6));
    const pl = new THREE.PointLight('#ffb070', 22, 14, 1.4); pl.position.set(0, 4.2, 6); sc.add(pl); C.fireL = pl;
    buildArena(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildChefCrabcake === 'function') rig = window.buildChefCrabcake({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    if (!rig.body) rig.body = rig.root;
    for (const k of ['tin', 'pan']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.body.add(rig[k]); }
    if (!rig.arms) { rig.arms = []; if (rig.armL) rig.arms.push({ sh: rig.armL, s: -1 }); if (rig.armR) rig.arms.push({ sh: rig.armR, s: 1 }); }
    rig.flash = rig.flash || [];
    C.R = rig; rig.root.position.set(0, 0, MZ); rig.root.rotation.y = Math.PI; sc.add(rig.root);
    // lane warning strips on the floor (Harold's side), the seasoning target ring, the counter-edge glow, puffs (seasoning + fire), sparks, the skillet
    C.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.8), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.03, 0.6); m.visible = false; sc.add(m); return m; });
    C.cmarks = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.position.set(sx(l), 1.08, CZ); m.visible = false; sc.add(m); return m; });
    const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(64, 4); g.lineTo(64, 34); g.moveTo(64, 94); g.lineTo(64, 124); g.moveTo(4, 64); g.lineTo(34, 64); g.moveTo(94, 64); g.lineTo(124, 64); g.stroke(); }, 128);
    C.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: ringT, color: '#ff9a3a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.ring.rotation.x = -Math.PI / 2; C.ring.position.set(0, 0.05, 0); C.ring.visible = false; sc.add(C.ring);
    C.edge = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.edge.position.set(0, 1.1, CZ - 0.6); C.edge.visible = false; sc.add(C.edge);
    C.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ff9a3a'), transparent: true, depthWrite: false, fog: false }), 60); C.puffM.count = 0; C.puffM.frustumCulled = false; sc.add(C.puffM); C.puffs = [];
    C.fireM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffb030'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 60); C.fireM.count = 0; C.fireM.frustumCulled = false; sc.add(C.fireM); C.fires = [];
    C.spark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: DUELS.dot('#fff2a0', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 40); C.spark.count = 0; C.spark.frustumCulled = false; sc.add(C.spark); C.sparks = [];
    C.skillet = new THREE.Group(); C.skillet.visible = false; sc.add(C.skillet);
    { const S = DUELS.kit(); S.add(DUELS.GEO.cyl(1.25, 1.05, 0.22, 20), '#2a2c30', 0, 0, 0).add(DUELS.GEO.cyl(1.15, 1.15, 0.03, 20), '#6a6e76', 0, 0.12, 0).add(DUELS.GEO.cyl(0.09, 0.09, 1.6, 6), '#2a2c30', 0, 0.05, -1.95, Math.PI / 2, 0, 0); S.mesh(toonMat(), C.skillet, 0.003); }
    // DOM: the "!" over the chef, damage pops, the POWER bar (in the sub HUD)
    const css = document.createElement('style');
    css.textContent = `#duel .ccbang { position: absolute; left: 0; top: 0; font-size: 34px; color: #ffd23c; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; transform: translate(-50%, -100%); display: none; animation: ccb .3s infinite alternate; }
    @keyframes ccb { from { transform: translate(-50%, -100%) scale(1); } to { transform: translate(-50%, -110%) scale(1.2); } }
    #duel .ccpop { position: absolute; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; transform: translate(-50%, -50%); animation: ccp .8s ease-out forwards; white-space: nowrap; }
    #duel .ccpop.big { font-size: 22px; color: #ffb030; } #duel .ccpop.w { font-size: 18px; color: #ffd23c; }
    @keyframes ccp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.6); } 20% { transform: translate(-50%, -80%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
    #duel .ccpow { display: inline-block; width: 92px; height: 9px; border: 2px solid #14101f; background: #2a1650; border-radius: 6px; overflow: hidden; vertical-align: middle; margin-left: 4px; }
    #duel .ccpow i { display: block; height: 100%; background: linear-gradient(#ffe08a, #ff8a1a); }
    #duel .ccpow.full i { background: linear-gradient(#fff, #ffd23c); animation: dlow .3s infinite alternate; }
    body.duel-crabcake #duel .dtell { white-space: normal; max-width: 88vw; text-align: center; }
    @media (max-width: 480px) { #duel .ccpow { width: 70px; } body.duel-crabcake #duel .dtell { font-size: 11px; } }`;
    document.head.appendChild(css);
    C.bang = document.createElement('div'); C.bang.className = 'ccbang'; C.bang.textContent = '!'; DUELS.hudEl.appendChild(C.bang);
  };

  // ---------------- state ----------------
  function reset(phase, hp = 100) {
    const old = C.st;
    const st = C.st = { t: 0, phase, mhp: 100, hp, pow: old ? old.pow * 0.5 : 0, lane: 0, duck: false, lockT: 0, swingT: -1, combo: 0, comboT: 0, swingCd: 0, hurtT: 0, inv: 0, blindT: 0,
      ms: 'intro', mt: 0, mdur: phase === 0 && !old ? 2.6 : 1.4, mixI: Math.floor(Math.random() * 2), target: 0, seq: [], seqI: 0, slamT: 0, fireX: 0, fireDir: 1, hitThis: false, dodged: false,
      over: false, won: false, outT: 0, stop: 0, slow: 1, slowT: 0, shake: 0, flipT: -1, healUsed: false, wind: old ? old.wind : true,
      stats: old && old.stats || { swings: 0, landed: 0, blocked: 0, flips: 0, dodges: 0, hitsTaken: 0, hits: { tin: 0, slam: 0, fire: 0 }, attacks: { tin: 0, drum: 0, pan: 0 }, heals: 0, winds: 0, maxCombo: 0 } };
    C.puffs.length = 0; C.fires.length = 0; C.sparks.length = 0; DUELS.blind(0);
    const R = C.R; R.root.visible = true; R.root.position.set(0, 0, MZ); R.root.rotation.set(0, Math.PI, 0); R.body.rotation.set(0, 0, 0); R.body.position.y = 0; R.tin.visible = false; R.pan.visible = false;
    C.door.rotation.y = -1.4; C.sign86.visible = false; C.skillet.visible = false;
    return st;
  }
  function subHud(st) { const f = st.pow >= 1;
    DUELS.sub('POWER<span class="ccpow' + (f ? ' full' : '') + '"><i style="width:' + Math.round(st.pow * 100) + '%"></i></span>' + (st.combo > 1 ? ' <span style="color:#ffd23c">x' + st.combo + '</span>' : ''), 'PHASE ' + (st.phase + 1) + '/3'); }
  C.start = function (opts) {
    C.st = null; const ph = clamp(+(Q.get('crabcakephase') || 1) - 1, 0, 2) | 0; const st = reset(ph); DUELS.log.push('crabcake:' + C.rigKind); subHud(st);
    DUELS.banner('CHEF CRABCAKE<small>FOUR SEASONS KITCHEN · PHASE ' + (ph + 1) + '</small>', 2.4);
    const l = lines(); DUELS.say('CHEF CRABCAKE', l && l.intro ? pick(l.intro) : pick(TAUNT), 3.4);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 2.4, MZ);
  };
  C.retry = function () { const p = C.st.phase; C.st = null; reset(p); C.st.ms = 'guard'; C.st.mdur = 1.4; subHud(C.st); DUELS.banner('PHASE ' + (p + 1) + '<small>BACK ON THE LINE! FULL HEALTH</small>', 1.6); };
  C.exit = function () { DUELS.blind(0); if (C.bang) C.bang.style.display = 'none'; C.hudPops(true); };

  // ---------------- small fx + sound ----------------
  function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  function noise(dur, vol = 0.12, hp = 1200, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); s.start(t); } catch (e) {} }
  const sting = (k) => { if (k === 'tin') { for (let i = 0; i < 6; i++) noise(0.06, 0.1, 3000, i * 0.11); } else if (k === 'drum') { for (let i = 0; i < 10; i++) tone(180, 120, 0.06, 'triangle', 0.12, i * 0.09); } else if (k === 'pan') { noise(0.9, 0.08, 400); tone(300, 600, 0.4, 'sawtooth', 0.04); } else if (k === 'ding') { tone(1760, 1700, 0.5, 'triangle', 0.14); } };
  function puff(p, v, life = 1.0, s = 1) { if (C.puffs.length < 60) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function fire(p, v, life = 0.5, s = 1) { if (C.fires.length < 60) C.fires.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function spark(p, n = 6) { for (let k = 0; k < n && C.sparks.length < 40; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 1)), t: 0, life: rnd(0.3, 0.6) }); }
  const POPS = [];
  function pop(text, p, cls = '') { const e = document.createElement('div'); e.className = 'ccpop ' + cls; e.textContent = text; V3.copy(p).project(C.cam); e.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; e.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 0 }); }
  C.hudPops = function (clear, dt = 0) { for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].t += dt; if (clear || POPS[i].t > 0.85) { POPS[i].e.remove(); POPS.splice(i, 1); } } };
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; }
  function addPow(st, v) { const was = st.pow >= 1; st.pow = clamp(st.pow + v, 0, 1); if (!was && st.pow >= 1) { DUELS.tell('POWER FULL: ACT = FLIP!', 1.2); sting('ding'); } subHud(st); }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.flipT >= 0) return false;
    st.hp -= dmg; st.inv = 1.3; st.hurtT = 0.4; st.stats.hits[kind]++; st.stats.hitsTaken++; st.combo = 0; DUELS.hurt(); sfx('hurt'); C.hflash = 1; st.lane = 0; st.duck = false; st.lockT = 0.3; st.shake = 0.35; st.stop = 0.06;
    pop('-' + dmg, V.set(sx(0), 2.0, 0.2), '');
    if (st.hp <= 0) {
      if (st.wind) { st.wind = false; st.hp = 45; st.stats.winds++; st.inv = 2.0; DUELS.banner('SECOND WIND!<small>HAROLD\'S BACK UP</small>', 1.6); DUELS.say('MAVIS', 'Up you get, Harold! Dinner\'s not over!', 2.2); return true; }
      st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('crabcake:lose:' + kind); clearFx();
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'EIGHTY-SIXED!', 'Chef Crabcake ran Harold off the line. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400);
    } else if (st.hp < 35 && !st.healUsed) { st.healUsed = true; st.healT = 0.9; }
    return true;
  }
  function clearFx() { C.lanes.forEach((l) => { l.material.opacity = 0; l.visible = false; }); C.cmarks.forEach((l) => { l.material.opacity = 0; l.visible = false; }); C.ring.visible = false; C.edge.visible = false; }
  function dodgeOk(st, what) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; addPow(st, 0.15); pop(what || 'DODGE!', V.set(sx(st.lane) * 0.95, 2.4, 0.2), 'w'); }

  // ---------------- the chef's brain ----------------
  function chefThink(st, dt) {
    const P = PH[st.phase]; st.mt += dt; const u = st.mt / st.mdur;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.8); break;
      case 'guard': if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++;
          if (a === 'tin') { setM(st, 'tinTell', P.tin); DUELS.tell('SPICE! DODGE THE RING!', P.tin); sting('tin'); }
          else if (a === 'drum') { setM(st, 'drumTell', P.drum); DUELS.tell('DRUMROLL! WATCH LANES!', P.drum); sting('drum');
            const s = []; let prev = 9; for (let k = 0; k < 4; k++) { let l; do { l = [-1, 0, 1][Math.floor(Math.random() * 3)]; } while (l === prev); s.push(l); prev = l; } st.seq = s; st.seqI = 0; st.slamT = 0; }
          else { setM(st, 'panTell', P.pan); DUELS.tell('FLAMBÉ LINE! DUCK!', P.pan); sting('pan'); st.fireDir = Math.random() < 0.5 ? -1 : 1; }
          if (Math.random() < 0.25) DUELS.say('CHEF CRABCAKE', pick(MID), 2.0); }
        break;
      // SEASONING BLIND: the ring follows Harold's lane, locks for the last 0.4 s, then the cloud flies at the locked lane
      case 'tinTell': if (st.mdur - st.mt > 0.4) st.target = st.lane; if (st.mt > st.mdur) { setM(st, 'tin', 0.65); sfx('swing'); } break;
      case 'tin': { C.R.tin.getWorldPosition(V); if (st.mt < 0.35) for (let k = 0; k < 3; k++) puff(V, V2.set((sx(st.target) - V.x) * 1.6 + rnd(-0.5, 0.5), rnd(-2.2, -1.2), -(V.z - 0.2) * 1.6 + rnd(-0.5, 0.5)), 0.9, rnd(0.9, 1.5));
        if (st.mt > 0.32 && !st.hitThis) { st.hitThis = true; if (st.lane === st.target && !st.duck) { if (hurtHarold(st, DMG.tin, 'tin')) { st.blindT = 2.6; DUELS.tell('BLINDED! KEEP MOVING!', 1.2); } } else dodgeOk(st, 'DODGED!'); }
        if (st.mt > st.mdur) setM(st, 'open', P.open); break; }
      // TWIN-MALLET DRUMROLL: 4 slams, one lane each, gap P.gap; each lane warns for one gap before its slam
      case 'drumTell': if (st.mt > st.mdur) { setM(st, 'drum', 99); st.slamT = P.gap; st.seqI = 0; st.drumHit = false; } break;
      case 'drum': st.slamT -= dt;
        if (st.slamT <= 0 && st.seqI < st.seq.length) { const l = st.seq[st.seqI++]; st.slamT = P.gap; st.lastSlam = l; st.slamFx = 0.25; sfx('heavy'); st.shake = Math.max(st.shake, 0.18);
          spark(V.set(sx(l), 1.1, CZ), 8); if (st.lane === l) { if (hurtHarold(st, DMG.slam, 'slam')) st.drumHit = true; } }
        if (st.seqI >= st.seq.length && st.slamT <= P.gap - 0.3) { if (!st.drumHit) dodgeOk(st, 'PERFECT!'); setM(st, 'open', P.open + 0.3); }
        break;
      // FLAMBE LINE: the pan tilts, the counter edge glows, then a fire line runs along the counter at chest height (duck)
      case 'panTell': if (st.mt > st.mdur) { setM(st, 'pan', 1.0); st.fireX = st.fireDir * 3.6; noise(0.8, 0.14, 300); } break;
      case 'pan': { const x = st.fireDir * 3.6 - st.fireDir * 7.2 * clamp(st.mt / 0.85, 0, 1); st.fireX = x;
        for (let k = 0; k < 2; k++) fire(V.set(x + rnd(-0.3, 0.3), 1.25 + rnd(0, 0.5), CZ - 0.75 + rnd(-0.2, 0.2)), V2.set(rnd(-0.5, 0.5), rnd(1.5, 3), -rnd(0.5, 1.5)), rnd(0.35, 0.6), rnd(0.7, 1.2));
        const hx = sx(st.lane) * 0.95; if (!st.hitThis && Math.abs(x - hx) < 0.7) { st.hitThis = true; if (!st.duck) { if (hurtHarold(st, DMG.fire, 'fire')) st.burnT = 0.6; else st.fireMiss = true; } else st.ducked = true; }
        if (st.mt > st.mdur) { if (st.ducked || (!st.hitThis)) dodgeOk(st, 'DUCKED!'); st.ducked = false; setM(st, 'open', P.open + 0.2); } break; }
      case 'open': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'flipped': if (st.mt > st.mdur) { if (st.mhp <= 0) phaseDown(st); else setM(st, 'open', 1.0); } break;
      case 'down': if (st.mt > st.mdur) { st.phase++; st.mhp = 100; st.hp = Math.min(100, st.hp + 30); st.healUsed = false; setM(st, 'guard', 1.2); subHud(st); sting('ding');
          DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 2 ? 'LAST CALL!' : 'THE DINNER RUSH!') + '</small>', 1.6); } break;
      case 'ko': break;
    }
    // Mavis's crab cake (once a phase, when Harold drops low)
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 35); st.stats.heals++; DUELS.say('MAVIS', 'Here, hon: a crab cake! Eat!', 2.0); pop('+35', V.set(sx(st.lane) * 0.95, 2.2, 0.2), 'w'); sfx('jump'); }
  }
  function phaseDown(st) { clearFx();
    if (st.phase >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.slow = 0.35; st.slowT = 1.3; DUELS.banner('K.O.!<small>CHEF\'S DONE</small>', 2.2); sting('ding'); sfx('ko'); }
    else { setM(st, 'down', 2.4); DUELS.banner('ORDER UP!<small>PHASE ' + (st.phase + 1) + ' TO HAROLD</small>', 2.0); if (Math.random() < 0.7) DUELS.say('MAVIS', pick(MAVIS.slice(0, 3)), 2.2); }
  }

  // ---------------- Harold ----------------
  C.step = function (dt0, I) {
    const st = C.st; if (!st) return;
    C.hudPops(false, dt0);
    if (st.stop > 0) { st.stop -= dt0; return; } // hitstop
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    const dt = dt0 * st.slow; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.swingCd -= dt; st.lockT -= dt; st.comboT -= dt; if (st.comboT <= 0 && st.combo) { st.combo = 0; subHud(st); }
    if (st.blindT > 0) { st.blindT -= dt; DUELS.blind(clamp(st.blindT / 1.3, 0, 1) * 0.86); } else DUELS.blind(st.ms === 'tinTell' ? 0.12 * clamp(st.mt / st.mdur, 0, 1) : 0);
    if (!st.over && st.flipT < 0) {
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; const duck = I.my < -0.5 || I.bh;
      if (st.lockT > 0 || st.swingT >= 0) want = st.swingT >= 0 ? st.lane : 0;
      st.lane = want;
      st.duck = st.lockT <= 0 && st.swingT < 0 && duck;
      const can = !st.duck && st.swingCd <= 0 && st.hurtT <= 0;
      if (I.c && st.pow >= 1 && ['open', 'guard', 'intro', 'tinTell', 'drumTell', 'panTell'].includes(st.ms)) startFlip(st);
      else if (I.c && st.pow < 1 && st.swingCd <= 0) { DUELS.tell('NEED POWER: HIT + DODGE', 0.8); st.swingCd = 0.3; }
      else if (I.a && can) { const k = st.comboT > 0 ? st.combo % 3 : 0; st.swingT = 0; st.swingK = k; st.swingCd = k === 2 ? 0.42 : 0.24; st.swingHit = false; st.stats.swings++; sfx('swing'); }
      if (st.swingT >= 0) { st.swingT += dt; if (st.swingT > 0.09 && !st.swingHit) { st.swingHit = true; landSwing(st); } if (st.swingT > (st.swingK === 2 ? 0.4 : 0.22)) st.swingT = -1; }
    }
    if (st.flipT >= 0) stepFlip(st, dt);
    chefThink(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, (st.mhp / 100 + (2 - st.phase)) / 3);
    if (st.ms === 'ko') outro(st, dt);
  };
  const WORDS = [['WHAP!', 'TAP!', 'BONK!'], ['WHACK!', 'THWAP!'], ['SIZZLE!', 'SEARED!', 'ORDER UP!']];
  function landSwing(st) {
    const k = st.swingK; V.set(sx(st.lane) * 0.6 + rnd(-0.3, 0.3), k === 2 ? 2.6 : 2.0, MZ - 0.9);
    if (st.ms === 'open' || st.ms === 'flipped') {
      const crit = st.ms === 'open' && st.mt < 0.4, dmg = SWING[k] + (crit ? 2 : 0); st.mhp -= dmg; st.stats.landed++; st.combo++; st.comboT = 1.1; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.combo);
      sfx(k === 2 ? 'heavy' : 'hit'); spark(V, k === 2 ? 14 : 6); flashBoss(k === 2 ? '#ffb030' : '#ffffff'); st.stop = k === 2 ? 0.085 : 0.065; st.shake = Math.max(st.shake, k === 2 ? 0.3 : 0.12);
      pop((k === 2 ? pick(WORDS[2]) + ' ' : '') + dmg, V, k === 2 || crit ? 'big' : ''); addPow(st, k === 2 ? 0.09 : 0.05);
      if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); }
    } else if (['guard', 'intro'].includes(st.ms)) { st.stats.blocked++; st.combo = 0; sfx('hit'); spark(V, 3); DUELS.tell('BLOCKED! WAIT FOR IT!', 0.7); }
    else { st.combo = 0; }
    subHud(st);
  }
  // CHEF'S FLIP (team-up): Mavis slides the giant skillet down the pass, Harold vaults onto the counter and flips the chef in slow-mo
  function startFlip(st) { st.flipT = 0; st.pow = 0; st.stats.flips++; st.slow = 0.5; st.slowT = 1.6; st.inv = 3; st.lane = 0; st.duck = false; clearFx(); C.puffs.length = 0; C.fires.length = 0;
    setM(st, 'flipped', 2.6); DUELS.banner("CHEF'S FLIP!<small>MAVIS + HAROLD</small>", 1.8); DUELS.say('MAVIS', MAVIS[3], 1.6); sting('ding'); subHud(st); C.skillet.visible = true; }
  function stepFlip(st, dt) {
    st.flipT += dt; const t = st.flipT;
    // the skillet slides in from screen right along the counter, under the chef, then catapults him up
    if (t < 0.5) C.skillet.position.set(lerp(-4.5, 0, ease(t / 0.5)), 1.12, CZ + 0.2);
    if (t > 0.6 && !st.flipHit) { st.flipHit = true; st.mhp -= FLIP; sfx('heavy'); spark(V.set(0, 2.6, MZ - 0.5), 18); flashBoss('#ffd23c', 1); st.stop = 0.1; st.shake = 0.5; pop('CHEF\'S FLIP! ' + FLIP, V.set(0, 3.2, MZ - 0.5), 'big'); }
    C.skillet.rotation.x = t > 0.6 && t < 1.0 ? -Math.sin((t - 0.6) / 0.4 * Math.PI) * 0.7 : 0;
    if (t > 1.9) { st.flipT = -1; st.flipHit = false; C.skillet.visible = false; if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); } }
  }
  // ---------------- the KO: slow-mo launch into the walk-in, the door slams, the 86'D sign drops ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R;
    const p0 = V.set(0, 0, MZ), p1 = V2.set(5.0, 0.4, 9.0);
    if (t < 1.3) { const u = ease(clamp(t / 1.3, 0, 1)); R.root.position.lerpVectors(p0, p1, u); R.root.position.y = Math.sin(u * Math.PI) * 3.0 + u * 0.4; R.body.rotation.x = -u * TAU * 1.5; R.body.rotation.z = u * 1.2; C.door.rotation.y = -1.4;
      if (Math.random() < dt * 30) { R.root.getWorldPosition(V3); V3.y += 1.5; spark(V3, 2); } }
    else if (!st.inside) { st.inside = true; R.root.visible = false; sfx('heavy'); st.shake = 0.4; }
    if (st.inside) { const k = t - 1.3; C.door.rotation.y = lerp(-1.4, 0, ease(clamp(k / 0.25, 0, 1))); if (k > 0.25 && !st.slam) { st.slam = true; sfx('heavy'); st.shake = 0.5; noise(0.3, 0.2, 200); }
      if (k > 0.5) { C.sign86.visible = true; const u = clamp((k - 0.5) / 0.35, 0, 1); C.sign86.position.set(5.0, lerp(5.5, 2.95, ease(u)), 7.85); C.sign86.rotation.z = Math.sin(k * 9) * 0.12 * Math.max(0, 1 - (k - 0.85) * 1.2); }
      if (k > 1.0 && !st.saidBye) { st.saidBye = true; const l = lines(); DUELS.say('CHEF CRABCAKE', l && l.defeat ? pick(l.defeat) : 'My kitchen... it\'s closed...', 3.0); }
      if (k > 2.6 && !st.winDone) { st.winDone = true; DUELS.bossCleared('fourseasons', 'crabcake-duel');
        const h = st.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('crabcake:grade:' + g);
        setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'CHEF CRABCAKE<br>IS 86\'D', '<span style="color:#ffd23c;font-size:18px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · hits taken ' + h + ' · best combo x' + st.stats.maxCombo + '<br>The Four Seasons kitchen is clear. Crime at Four Seasons: 0. Rematch any time at the ring.'); }, SIM ? 300 : 1100); } }
  }
  function stepFx(dt) {
    const m = new THREE.Matrix4(), q = C.cam.quaternion;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.4); p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.5 + p.t * 2.4); m.compose(p.p, q, V3.set(s, s, s)); C.puffM.setMatrixAt(i, m); }); C.puffM.count = C.puffs.length; C.puffM.visible = C.puffs.length > 0; C.puffM.instanceMatrix.needsUpdate = true;
    for (let i = C.fires.length - 1; i >= 0; i--) { const p = C.fires[i]; p.t += dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.fires.splice(i, 1); }
    C.fires.forEach((p, i) => { const s = p.s * (1 - p.t / p.life * 0.6); m.compose(p.p, q, V3.set(s, s * 1.3, s)); C.fireM.setMatrixAt(i, m); }); C.fireM.count = C.fires.length; C.fireM.visible = C.fires.length > 0; C.fireM.instanceMatrix.needsUpdate = true;
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
    if (st.swingT >= 0) { const k = st.swingK, u = clamp(st.swingT / (k === 2 ? 0.4 : 0.22), 0, 1), s = Math.sin(u * Math.PI);
      if (k === 2) { p.shR = [-3.0 + u * 2.6, 0, -0.3]; p.elR = [-0.3, 0, 0]; p.torso = [0.1 + u * 0.5, 0, 0]; p.y += s * 0.3; } // overhead spatula smash
      else { const d = k === 0 ? 1 : -1; p.shR = [-1.5, 0, -0.5 + d * (u - 0.5) * 2.0]; p.elR = [-0.4, 0, 0]; p.torso = [0.15, -d * (u - 0.5) * 1.2, 0]; } }
    if (st.flipT >= 0) { const u = clamp(st.flipT / 0.6, 0, 1); p.shR = [-3.0, 0, -0.4]; p.shL = [-2.6, 0, 0.6]; p.y += Math.sin(Math.min(1, st.flipT / 1.6) * Math.PI) * 1.1; p.torso = [0.4 * u, 0, 0]; }
    if (st.duck) { legsStance(p, 0.26, 1.25); p.y -= 0.34; p.torso = [0.6, 0, 0]; }
    if (st.lane) { p.tilt = [0, 0, st.lane * 0.2]; p.torso = [0.18, 0, st.lane * 0.22]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' || st.flipT >= 0 ? 1 : 0.35, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.healT > 0) { p.shR = [-2.8, 0, -0.2]; } return p; }
  function poseChef(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur); if (st.ms === 'ko') return;
    if (R.update) { try { R.update(dt, st.ms, { t, u, lane: st.ms === 'drum' ? st.lastSlam : st.target, phase: st.phase }); } catch (e) { console.error(e); R.update = null; } return; }
    let bodyRX = 0, bodyRZ = Math.sin(t * 1.6) * 0.04, bodyY = Math.abs(Math.sin(t * 3)) * 0.03, rootX = 0; const arm = [[0.3, 0], [0.3, 0]]; // [rx, ry] guard: mallets up-forward
    let glow = null; R.tin.visible = false; R.pan.visible = false;
    switch (st.ms) {
      case 'tinTell': R.tin.visible = true; R.tin.position.set(Math.sin(st.mt * 40) * 0.12, 3.05 + Math.abs(Math.sin(st.mt * 20)) * 0.15, 0.5); R.tin.rotation.z = Math.sin(st.mt * 40) * 0.35; arm[0] = [-2.4, 0.4]; arm[1] = [-2.4, -0.4];
        glow = { m: R.tinM, c: '#ff8a1a', v: 0.3 + 0.35 * (Math.sin(st.mt * 26) * 0.5 + 0.5) }; bodyRX = -0.12; break;
      case 'tin': R.tin.visible = st.mt < 0.4; R.tin.position.set(0, 2.6, 0.9); R.tin.rotation.set(1.3, 0, 0); arm[0] = [-0.6, 0.3]; arm[1] = [-0.6, -0.3]; bodyRX = 0.2; break;
      case 'drumTell': arm[0] = [-2.5 + Math.sin(st.mt * 30) * 0.15, 0.2]; arm[1] = [-2.5 - Math.sin(st.mt * 30) * 0.15, -0.2]; bodyRX = -0.1; glow = { m: R.bM, c: '#ff3d3d', v: 0.15 + 0.15 * (Math.sin(st.mt * 22) * 0.5 + 0.5) }; break;
      case 'drum': { const nx = st.seqI < st.seq.length ? st.seq[st.seqI] : st.lastSlam, k = clamp(st.slamT / PH[st.phase].gap, 0, 1); rootX = damp(R.root.position.x, sx(nx) * 0.45, 8, dt);
        const i = st.seqI % 2, up = -2.4 * k + 0.9 * (1 - k); arm[i] = [up, (i ? -1 : 1) * 0.15]; arm[1 - i] = [0.9 - 0.4 * (st.slamFx > 0 ? 1 : 0), (i ? 1 : -1) * 0.15]; bodyRX = 0.25 * (1 - k); break; }
      case 'panTell': R.pan.visible = true; R.pan.position.set(0, 2.25 + 0.15 * u, 1.0); R.pan.rotation.z = st.fireDir * 0.5 * ease(clamp(u, 0, 1)); R.pan.rotation.x = 0.25 * u; arm[0] = [0.4, 0.9]; arm[1] = [0.4, -0.9];
        glow = { m: R.panM, c: '#ff7a1a', v: 0.3 + 0.4 * u }; if (Math.random() < dt * 30) { R.pan.getWorldPosition(V3); fire(V3.add(V2.set(rnd(-0.3, 0.3), 0.2, rnd(-0.2, 0.2))), V2.set(rnd(-0.3, 0.3), rnd(1, 2), 0), 0.4, 0.4 + u * 0.6); } break;
      case 'pan': R.pan.visible = true; R.pan.position.set(0, 2.1, 1.1); R.pan.rotation.z = st.fireDir * 0.9; arm[0] = [0.4, 0.9]; arm[1] = [0.4, -0.9]; bodyRX = 0.15; break;
      case 'open': bodyRX = 0.45 + Math.sin(st.mt * 9) * 0.04; arm[0] = [1.1, 0.25]; arm[1] = [1.1, -0.25]; bodyY = -0.1; if (Math.random() < dt * 6) { R.root.getWorldPosition(V3); V3.y += 2.6; V3.x += rnd(-0.5, 0.5); spark(V3, 1); } break; // mallets stuck in the counter, dazed
      case 'flipped': { const k = st.mt; if (k > 0.6 && k < 1.9) { const a = (k - 0.6) / 1.3; bodyY = Math.sin(a * Math.PI) * 2.6; bodyRX = -a * TAU; } else bodyRX = 0.5; arm[0] = [-2.8, 0.8]; arm[1] = [-2.8, -0.8]; break; }
      case 'down': bodyRX = 0.65; bodyY = -0.3 * ease(clamp(st.mt / 0.5, 0, 1)); arm[0] = [1.3, 0.5]; arm[1] = [1.3, -0.5]; if (Math.random() < dt * 8) { R.root.getWorldPosition(V3); V3.y += 2.6; spark(V3, 2); } break;
    }
    if (st.slamFx > 0) st.slamFx -= dt;
    R.root.position.x = st.ms === 'drum' ? rootX : damp(R.root.position.x, 0, 6, dt);
    R.body.position.y = damp(R.body.position.y, bodyY, st.ms === 'flipped' ? 40 : 12, dt); R.body.rotation.x = st.ms === 'flipped' ? bodyRX : damp(R.body.rotation.x, bodyRX, 10, dt); R.body.rotation.z = bodyRZ;
    R.arms.forEach((a, i) => { const ki = st.ms === 'drum' ? 30 : 14; a.sh.rotation.x = damp(a.sh.rotation.x, arm[i][0], ki, dt); a.sh.rotation.y = damp(a.sh.rotation.y, arm[i][1], ki, dt); });
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow && glow.m && glow.m.userData.flash) { glow.m.userData.flashC.value.set(glow.c); glow.m.userData.flash.value = Math.max(glow.m.userData.flash.value, glow.v); }
  }
  function tells(st, dt) {
    // lanes: drumroll warnings (the next lane glows during the gap before its slam; the first one during the end of the tell)
    const warn = [0, 0, 0], P = PH[st.phase], pulse = 0.62 + 0.3 * Math.sin(st.t * 28);
    if (st.ms === 'drumTell' && st.mdur - st.mt < P.gap) warn[st.seq[0] + 1] = pulse;
    if (st.ms === 'drum' && st.seqI < st.seq.length) warn[st.seq[st.seqI] + 1] = pulse * (1.2 - clamp(st.slamT / P.gap, 0, 1) * 0.4);
    if (st.ms === 'drum' && st.slamFx > 0) warn[st.lastSlam + 1] = Math.max(warn[st.lastSlam + 1], 0.9);
    C.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 24, dt); l.visible = l.material.opacity > 0.01; const c = C.cmarks[i]; c.material.opacity = l.material.opacity; c.visible = l.visible; });
    // the seasoning ring: orange while it follows Harold, red once locked
    const tinOn = st.ms === 'tinTell' || (st.ms === 'tin' && st.mt < 0.35); C.ring.visible = tinOn;
    if (tinOn) { const locked = st.ms === 'tin' || st.mdur - st.mt <= 0.4; C.ring.position.x = damp(C.ring.position.x, sx(st.target) * 0.95, 14, dt); C.ring.material.color.set(locked ? '#ff2020' : '#ff9a3a'); C.ring.material.opacity = 0.55 + 0.35 * Math.sin(st.t * 24); C.ring.rotation.z += dt * 2; }
    // the counter edge glow: flambé tell (pulses, end to end), then the fire line
    const eOn = st.ms === 'panTell' || st.ms === 'pan'; C.edge.visible = eOn; if (eOn) C.edge.material.opacity = st.ms === 'pan' ? 0.9 : 0.25 + 0.5 * clamp(st.mt / st.mdur, 0, 1) * (0.6 + 0.4 * Math.sin(st.t * 26));
    C.fireL.intensity = 22 + (st.ms === 'pan' ? 40 : st.ms === 'panTell' ? 18 * (st.mt / st.mdur) : 0);
    // the "!" over the chef's head on every tell
    const bang = ['tinTell', 'drumTell', 'panTell'].includes(st.ms) && !st.over;
    if (bang) { V3.set(C.R.root.position.x, 3.9, MZ).project(C.cam); C.bang.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; C.bang.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; }
    if (C.bang.__on !== bang) { C.bang.__on = bang; C.bang.style.display = bang ? 'block' : 'none'; }
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.stop > 0 ? 0.15 : st.slow), t = st.t;
    const H = C.H; const hx = sx(st.lane) * 0.95, hz = st.flipT >= 0 ? lerp(0, 1.6, clamp(st.flipT / 0.5, 0, 1)) * (st.flipT < 1.6 ? 1 : 1 - (st.flipT - 1.6) / 0.3) : 0;
    H.root.position.set(damp(H.root.position.x, hx, 18, dt), 0, damp(H.root.position.z, hz, 10, dt)); H.root.rotation.y = 0; applyPose(H, haroldPose(st, t), 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); H.mat.userData.flash.value = C.hflash * 0.8; }
    const M = C.M; M.root.position.set(-4.4, 0, 3.4); M.root.rotation.y = 1.1; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseChef(st, dt); tells(st, dt);
    DUELS.hot(st.pow >= 1 && !st.over);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 1.6);
    // camera: low behind Harold, the chef + the pass filling the frame; portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 68 : 52; C.cam.updateProjectionMatrix();
    V.set(0.5 + H.root.position.x * 0.35, port ? 2.9 : 2.6, port ? -4.4 : -3.5); V2.set(H.root.position.x * 0.2, port ? 2.0 : 2.3, MZ);
    if (st.ms === 'intro' && st.phase === 0 && st.t < 3) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(-3.5, 4.5, 9.5), V, k); V2.lerpVectors(V3.set(0, 2.2, MZ), V2, k); }
    if (st.flipT >= 0) { V.set(-3.6, 2.6, 0.8); V2.set(0, 2.4, MZ - 0.4); }
    if (st.ms === 'ko') { V.set(-1.2, 3.0, 1.0); V2.set(3.8, 2.0, 8.4); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
    C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 18; OUT_U.fogF.value = 40;
  };
  C.onResize = () => {};

  // ---------------- test bot: win = reads every tell; mash = SWING only, never dodges; lose = stands still ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt;
    if (B.mode === 'mash') { if (B.cd <= 0) { B.a = true; B.cd = 0.25; } return; }
    const left = st.mdur - st.mt, P = PH[st.phase];
    if (st.ms === 'tinTell' && left < 0.3 || st.ms === 'tin') B.mx = st.target === 0 ? 1 : 0; // step to a lane the locked ring isn't on (from a side lane, back to the middle)
    if (st.ms === 'panTell' && left < 0.15 || st.ms === 'pan') B.bh = true;
    if (st.ms === 'drumTell' || st.ms === 'drum') { const next = st.ms === 'drumTell' ? st.seq[0] : st.seq[st.seqI]; if (next !== undefined) { const safe = [0, 1, -1].find((l) => l !== next); B.mx = safe; } }
    if (st.pow >= 1 && st.ms === 'open' && B.cd <= 0) { B.c = true; B.cd = 0.5; }
    else if ((st.ms === 'open' || st.ms === 'flipped') && B.cd <= 0 && st.flipT < 0) { B.a = true; B.cd = 0.26; }
  };
  DUELS.reg('crabcake', C);

  // ---------------- the city side: the ring at the Four Seasons boss anchor on Pratt St (DESIGN anchor), REMATCH once cleared; ?crabcake=1 ----------------
  const L = LANDMARKS.find((l) => l.id === 'fourseasons');
  if (L && L.boss) { DUELS.addTrigger('crabcake', L, L.boss.x, L.boss.z, L.boss.x + 2.2, L.boss.z + 2.0, '#ff8a3a');
    const act = ACTIONS[ACTIONS.length - 1]; Object.defineProperty(act, 'label', { get: () => (L.boss.cleared ? 'REMATCH CHEF' : 'FIGHT CHEF'), configurable: true });
    act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
    const bm = DUELS.BEAM.list[DUELS.BEAM.list.length - 1]; if (bm) bm.L = { boss: { get cleared() { return false; } } }; } // keep the ring lit for rematches
  let n = 0; MODE.ticks.push(() => { n++; if (n === 3 && Q.has('crabcake') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('crabcakeauto'); DUELS.start('crabcake', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__crabcake = C; C.PH = PH;
})();

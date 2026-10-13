
// ======================= CAPTAIN COBBLESTONE, USS CONSTELLATION (night): a ghost-privateer duel on the main deck (boss 15 in DESIGN's roster; BOSS_GANG_UPGRADE_PLAN #19).
// A behind-the-player view down the moonlit main deck of the old sloop-of-war: Harold amidships, Mavis by the capstan, Captain Cobblestone (an original ghost
// sea-captain: a see-through teal coat, a battered tricorn, a fog beard, a peg leg, a ghost lantern in one hand and a cobblestone-in-a-net "persuader" in the
// other) on the deck aft, three haunted deck guns behind him, the mainmast + rigging over him, the harbor skyline in the fog. Fells Point Phantoms (stand-in
// ghost silhouettes) drift along the rails and cheer him on. No real people, logos or ship insignia: the name boards are generic.
// He is a GHOST: swings pass straight through him (WHOOSH) except when he is SOLID. He turns solid for a short window after every attack (his lantern
// gutters out), or when Harold's GHOST-LANTERN FLARE catches him.
// Attacks (every tell >= 1.0 s: a "!" over the captain, a deck / lane glow, a sound sting, a HUD call-out):
//   LANTERN SWEEP: he hoists the lantern (it pulses green) and 2 of the 3 deck lanes fill with faint green light; the safe lane stays dark in the mast's shadow.
//        Then the beam floods the lit lanes for ~1.3 s: standing in the light turns Harold ghostly and DRAINS health. Stand in the dark lane.
//        From phase 2 he sweeps twice (the second sweep re-tells for >= 1.0 s with a new safe lane).
//   ECTO-BROADSIDE: the three ghost guns behind him wheel round and their touch-holes glow; then volleys of spectral cannonballs roll down the deck,
//        one lane per volley (two lanes per volley in phase 3). Each lane flashes green before its gun fires: stand in a lane that isn't flashing.
//   RIGGING SWING: he grabs a rope off the main yard and crouches; a shadow arc is painted across the deck and the rope glows; then he swings across the deck
//        at chest height, boots first: DUCK under him. He lands right in front of Harold, solid and dizzy (a longer open window).
// SWING = 3-hit cane combo (forehand, backhand, overhead "belaying-pin smash" finisher). Swinging at him while he's a ghost: WHOOSH, no damage.
// Hits and clean dodges fill POWER; full POWER = ACT "GHOST-LANTERN FLARE" (Mavis tosses Harold the ghost lantern, it flares white, the captain turns solid and
// stunned, and Harold lands a slow-mo 6-hit cane flurry: big damage). 3 phases (the HP bar has 3 pips).
// Easy-but-not-trivial (Chip Kid standard): moderate damage, 1.3 s i-frames, Mavis tosses a crab cake when Harold is low (once a phase), one SECOND WIND,
// a heal between phases. A mash-SWING-only bot wins while taking hits.
// KO: he dissolves into fog, his tricorn clunks onto the deck, the ship's bell tolls three times, and the Phantoms scatter off over the rails.
// Then DUELS.bossCleared('constellation') -> BOSS_CLEAR.clear('constellation') (src/06g0_boss_clear.js, unchanged). Star grade by hits taken (<=3 S, <=8 A,
// else B) on the win card; the entry ring stays lit for a REMATCH.
// Controls (the duel conventions): phone: stick left / right (or the white buttons) dodge, stick down or JUMP = DUCK, SWING = cane, ACT = FLARE.
// Desktop: A / D dodge, S or K duck, J swing, E flare. Gamepad: left stick / LB / RB dodge, A duck, X swing, Y flare.
// Entry: the glowing ring on the Constellation's pier, beside the ship (LANDMARKS 'constellation' boss anchor x -31 z -18 is on the hull over the water, so the
// ring sits on pier p1 at (-36.4, -18), a step off the gangway: a real-landmark anchor, not temporary). NIGHT ONLY (DESIGN fit tweak): by day the ACT reads
// "CAPTAIN: AFTER DARK" and gives a "come back after dark" banner. The ghost lantern from fishing is not built yet, so the fight is not gated on it
// (merge note: when fishing lands, gate act.go on the lantern flag if wanted; the in-fight lantern is Mavis's).
// Tests: ?cobblestone=1 starts at load; &cobblestoneauto=win|lose|mash plays it by itself (also ?duel=cobblestone&duelbot=...); ?cobblestonephase=N starts at
// phase N; ?cobblestonenight=1 forces the city entry to night rules.
// Writing: GR1 bosses.captain_cobblestone intro / defeat lines (06e_gr1_data.js) + short placeholder lines below.
//
// RIG HOOK (Opus): if window.buildCaptainCobblestone exists it is called as buildCaptainCobblestone({ THREE, toonMat, outlineMat, addOdir, QUAL }) and may return
//   { root, body?, hat?, lantern?, lanternLight?, armL?, armR?, ghost?: [materials], flash?: [materials], update?(dt, state, info) }
//   root: Object3D, feet (peg) at y 0 on the deck, facing +z (toward Harold / the camera), about 2.4 m tall with the tricorn.
//   body: the group that bobs / leans / flips (child of root). hat: the tricorn group (child of body); at the KO the core re-parents it to the scene and drops it.
//   armL / armR: shoulder pivots (armL = his left = screen right holds the lantern; armR holds the cobblestone net). rotation.x < 0 raises the arm.
//   lantern: the lantern group (the core lights it green on the sweep tell). lanternLight: an optional PointLight the core drives.
//   ghost: materials the core makes see-through (opacity ~0.45) while he's a ghost and opaque while SOLID (they must be transparent-capable Lambert / toonMat).
//   flash: materials that take the white hit flash (toonMat userData.flash / flashC).
//   update(dt, state, info): optional, called every frame; state one of intro | guard | sweepTell | sweep | broadTell | broad | ropeTell | rope | open | flared |
//     down | ko; info = { t, u (0..1 through the state), lanes (lit lanes or the next volley), phase, solid }. If update exists the core skips its own part animation.
//   Missing pieces are skipped (stand-in groups fill them). Otherwise the procedural stand-in captain below is used.
(function () {
  const C = { scene: null, cam: null, title: 'CAPT. COBBLESTONE', pips: 3,
    hint: '<b>A / D</b> dodge · <b>S</b> duck · <b>J</b> swing · <b>E</b> lantern flare (POWER)',
    labels: { a: 'SWING', b: 'DUCK', c: 'FLARE', l: '&#9664; DODGE', r: 'DODGE &#9654;' } };
  const MZ = 5.0, GZ = 7.4, LANE = 1.4; // captain at z = MZ facing -z, the ghost guns at z = GZ, Harold at z = 0 facing +z. Screen right = world -x.
  const PH = [ // per phase: tell lengths (all >= 1.0 s), volley gap, open window, guard time, attack mix, sweeps, volleys
    { sweep: 1.5, broad: 1.4, gap: 0.8, rope: 1.5, guard: [1.0, 1.5], open: 1.8, sweeps: 1, volleys: 3, pair: false, mix: ['sweep', 'broad', 'rope', 'broad', 'sweep', 'rope'] },
    { sweep: 1.35, broad: 1.25, gap: 0.72, rope: 1.35, guard: [0.8, 1.3], open: 1.6, sweeps: 2, volleys: 4, pair: false, mix: ['broad', 'rope', 'sweep', 'broad', 'rope', 'sweep'] },
    { sweep: 1.2, broad: 1.15, gap: 0.7, rope: 1.2, guard: [0.6, 1.0], open: 1.45, sweeps: 2, volleys: 3, pair: true, mix: ['rope', 'broad', 'sweep', 'broad', 'rope', 'sweep', 'broad'] },
  ];
  const DMG = { drain: 9, ball: 7, rope: 10 }, SWING = [6, 6, 13], FLARE = [4, 4, 4, 4, 4, 8];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const sx = (lat) => -lat * LANE;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const TAUNT = ['Yarr! This ship be haunted, toad!', 'My lantern lights the way to your doom!', 'Ghosts don\'t feel canes, matey!'];
  const MID = ['Swab the deck with ye, I will!', 'Two hundred years on this deck, and ye think a CANE scares me?', 'Mind the cobbles, landlubber!', 'Phantoms! Look lively!'];
  const MAVIS = ['Swing when he goes solid, Harold!', 'Stay out of that green light, hon!', 'That\'s my husband, you old spook!', 'Harold! Catch the lantern!'];
  const PHANTOM = ['Ooooo! Get him, Cap\'n!', 'Arr, the old toad\'s quick!', 'Boo! ...was that scary?'];
  const lines = () => { const L = LANDMARKS.find((l) => l.id === 'constellation'); const g = (window.GR1 || (typeof GR1 !== 'undefined' ? GR1 : null)); return (g && g.bosses && g.bosses.captain_cobblestone) || (L && L.boss && L.boss.lines) || null; };

  // ---------------- textures ----------------
  function plankTex() { return canvasTex(256, 256, (g, w, h) => { for (let x = 0; x < 8; x++) { const c = 70 + ((x * 37) % 23); g.fillStyle = `rgb(${c + 40},${c + 22},${c})`; g.fillRect(x * 32, 0, 32, h);
      g.fillStyle = 'rgba(20,12,6,.55)'; g.fillRect(x * 32, 0, 2, h); for (let k = 0; k < 2; k++) { const y = ((x * 71 + k * 128) % 256); g.fillRect(x * 32, y, 32, 2); g.fillStyle = 'rgba(30,20,10,.6)'; g.fillRect(x * 32 + 6, y + 6, 2, 2); g.fillRect(x * 32 + 24, y + 6, 2, 2); g.fillStyle = 'rgba(20,12,6,.55)'; } }
    g.strokeStyle = 'rgba(255,240,210,.05)'; for (let i = 0; i < 60; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rnd(-1, 1), y + rnd(8, 30)); g.stroke(); } }, 256); }
  function hullTex() { return canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#20232a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d0'; g.fillRect(0, h * 0.42, w, h * 0.18);
    for (let k = 0; k < 4; k++) { g.fillStyle = '#14161a'; g.fillRect(18 + k * 62, h * 0.44, 26, h * 0.14); } g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < h; y += 9) g.fillRect(0, y, w, 1); }, 256); }
  function signTex(text, bg, fg, sub) { return canvasTex(512, 160, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 ' + (sub ? 66 : 80) + 'px ' + FONT; g.fillText(text, w / 2, sub ? h * 0.42 : h / 2); if (sub) { g.font = '700 28px ' + FONT; g.fillText(sub, w / 2, h * 0.8); } }, 256); }
  function moonTex() { return canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 10, 64, 64, 62); r.addColorStop(0, '#fffbe8'); r.addColorStop(0.45, '#f4eed0'); r.addColorStop(0.55, 'rgba(220,230,255,.35)'); r.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(180,170,140,.35)'; g.beginPath(); g.arc(52, 54, 7, 0, TAU); g.arc(74, 70, 5, 0, TAU); g.arc(60, 78, 4, 0, TAU); g.fill(); }, 128); }
  function fogTex() { return canvasTex(128, 64, (g, w, h) => { const r = g.createRadialGradient(64, 32, 4, 64, 32, 62); r.addColorStop(0, 'rgba(190,230,220,.55)'); r.addColorStop(1, 'rgba(190,230,220,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 128); }
  function arcTex() { return canvasTex(256, 64, (g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.setLineDash([22, 12]); g.beginPath(); g.moveTo(8, h - 8); g.quadraticCurveTo(w / 2, -h * 0.6, w - 8, h - 8); g.stroke(); }, 256); }

  // ---------------- the arena: the Constellation's moonlit main deck ----------------
  function buildArena(sc) {
    const K = DUELS.kit, G = DUELS.GEO;
    const pl = plankTex(); pl.wrapS = pl.wrapT = THREE.RepeatWrapping; pl.repeat.set(3, 9);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 32), new THREE.MeshLambertMaterial({ map: pl })); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, 4); sc.add(deck);
    // the harbor around the ship: a dark water plane with a moon glint strip
    const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: '#0a1424' })); water.rotation.x = -Math.PI / 2; water.position.y = -2.2; sc.add(water);
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(3, 80), new THREE.MeshBasicMaterial({ map: DUELS.dot('#9ab0e0'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glint.rotation.x = -Math.PI / 2; glint.position.set(-14, -2.15, 40); sc.add(glint);
    const hm = new THREE.MeshLambertMaterial({ map: hullTex() });
    const R = K();
    // bulwarks (the ship's side walls) with a cap rail, gunports, and deck guns along both sides
    for (const s of [-1, 1]) { R.add(G.box(0.3, 1.05, 32), '#2a2d34', s * 4.75, 0.52, 4).add(G.box(0.48, 0.1, 32), '#7a5a36', s * 4.75, 1.08, 4);
      for (let k = 0; k < 7; k++) { const z = -8 + k * 3.6; R.add(G.box(0.34, 0.42, 0.6), '#101216', s * 4.72, 0.55, z);
        if (k > 1 && k < 6) R.add(G.box(0.9, 0.32, 0.8), '#4a3220', s * 3.95, 0.2, z).add(G.cyl(0.13, 0.17, 1.3, 8), '#1c1e22', s * 4.15, 0.48, z, 0, 0, s * Math.PI / 2).add(G.cyl(0.16, 0.16, 0.08, 8), '#2a2420', s * 3.65, 0.2, z - 0.36, 0, 0, Math.PI / 2).add(G.cyl(0.16, 0.16, 0.08, 8), '#2a2420', s * 3.65, 0.2, z + 0.36, 0, 0, Math.PI / 2); }
      // shrouds: rope ladders from the rail up to the mainmast top
      for (let k = 0; k < 5; k++) { const z = 8.0 + k * 0.45, x0 = s * 4.7, x1 = s * 0.5; const dx = x1 - x0, dy = 11.5 - 1.1, len = Math.hypot(dx, dy); R.add(G.cyl(0.025, 0.025, len, 4), '#3a2e22', (x0 + x1) / 2, (1.1 + 11.5) / 2, z, 0, 0, Math.atan2(-dx, dy)); }
      for (let k = 0; k < 9; k++) { const y = 1.6 + k * 1.05, f = (y - 1.1) / 10.4, x = s * (4.7 - 4.2 * f); R.add(G.box(0.02, 0.02, 1.9), '#3a2e22', x, y, 8.9); } }
    // the mainmast behind the captain (pale lower mast, a fighting top, the main yard with a furled sail), and the mizzen further aft
    R.add(G.cyl(0.32, 0.38, 13, 10), '#d8cfb4', 0, 6.5, 9.3).add(G.box(2.4, 0.18, 1.6), '#4a3220', 0, 11.6, 9.3).add(G.cyl(0.16, 0.16, 9.4, 8), '#6a4a2a', 0, 9.6, 9.0, 0, 0, Math.PI / 2)
      .add(G.cyl(0.32, 0.32, 8.6, 10), '#e8e0c8', 0, 9.25, 9.05, 0, 0, Math.PI / 2).add(G.cyl(0.22, 0.26, 12, 8), '#d8cfb4', 1.2, 6, 19);
    R.add(G.cyl(0.42, 0.5, 0.9, 12), '#5a3e24', -2.6, 0.45, 2.6).add(G.cyl(0.55, 0.55, 0.12, 12), '#7a5a36', -2.6, 0.95, 2.6); // the capstan (Mavis's spot)
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; R.add(G.box(1.3, 0.08, 0.08), '#8a6a40', -2.6 + Math.cos(a) * 0.5, 0.9, 2.6 + Math.sin(a) * 0.5, 0, -a, 0); }
    // the quarterdeck step + rail aft of the captain, the binnacle, the ship's wheel and the ship's bell on its belfry
    R.add(G.box(9.2, 0.55, 6), '#4a3624', 0, 0.27, 12.4).add(G.box(9.2, 0.08, 0.3), '#7a5a36', 0, 0.58, 9.45);
    for (let k = 0; k < 13; k++) R.add(G.cyl(0.05, 0.05, 0.7, 6), '#c8bea0', -4.2 + k * 0.7, 0.95, 9.55);
    R.add(G.box(9.2, 0.08, 0.12), '#7a5a36', 0, 1.3, 9.55);
    R.add(G.cyl(0.04, 0.04, 1.4, 6), '#4a3220', 2.9, 1.25, 11.0).add(G.tor(0.62, 0.05, TAU, 6, 16), '#6a4a2a', 2.9, 1.9, 11.0);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; R.add(G.cyl(0.03, 0.03, 1.5, 4), '#6a4a2a', 2.9 + Math.cos(a) * 0.05, 1.9 + Math.sin(a) * 0.05, 11.0, 0, 0, a); }
    // the belfry (screen right of the captain) — the bell itself swings (separate mesh)
    R.add(G.box(0.12, 2.2, 0.12), '#5a3e24', -3.1, 1.1, 6.9).add(G.box(0.12, 2.2, 0.12), '#5a3e24', -2.1, 1.1, 6.9).add(G.box(1.3, 0.14, 0.2), '#5a3e24', -2.6, 2.2, 6.9);
    // the name board on the quarterdeck rail: generic, no ship insignia
    sc.add(R.mesh(toonMat(), null, 0.003));
    const bwalls = new THREE.Mesh(new THREE.BoxGeometry(9.8, 1.6, 32.4), hm); bwalls.position.set(0, -0.8, 4); sc.add(bwalls);
    C.bell = new THREE.Group(); C.bell.position.set(-2.6, 2.12, 6.9); sc.add(C.bell);
    { const B = K(); B.add(G.cyl(0.16, 0.32, 0.5, 12), '#c8a040', 0, -0.32, 0).add(G.sph(0.06, 6, 5), '#7a5a20', 0, -0.62, 0); B.mesh(toonMat(), C.bell, 0.003); }
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: signTex('QUARTERDECK', '#1a1410', '#d8b04a', 'MIND THE GHOSTS'), fog: false })); nb.position.set(1.8, 0.95, 9.38); nb.rotation.y = Math.PI; sc.add(nb);
    // the three haunted deck guns aft of the captain, one per lane, aimed down the deck (their touch-holes glow on the broadside tell)
    C.guns = [-1, 0, 1].map((l) => { const g = new THREE.Group(); g.position.set(sx(l), 0, GZ); sc.add(g);
      const Gk = K(); Gk.add(G.box(0.9, 0.34, 1.0), '#3a2a1c', 0, 0.22, 0).add(G.cyl(0.16, 0.22, 1.5, 10), '#1a2420', 0, 0.55, -0.35, Math.PI / 2, 0, 0).add(G.tor(0.17, 0.05, TAU, 6, 10), '#1a2420', 0, 0.55, -1.08)
        .add(G.cyl(0.2, 0.2, 0.09, 10), '#2a2016', 0.47, 0.2, -0.3, 0, 0, Math.PI / 2).add(G.cyl(0.2, 0.2, 0.09, 10), '#2a2016', -0.47, 0.2, -0.3, 0, 0, Math.PI / 2).add(G.cyl(0.2, 0.2, 0.09, 10), '#2a2016', 0.47, 0.2, 0.3, 0, 0, Math.PI / 2).add(G.cyl(0.2, 0.2, 0.09, 10), '#2a2016', -0.47, 0.2, 0.3, 0, 0, Math.PI / 2);
      const m = toonMat(); m.emissive = new THREE.Color('#000000'); Gk.mesh(m, g, 0.003); g.userData.m = m;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: DUELS.dot('#7dffc8'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.set(0, 0.85, 0.2); g.add(glow); g.userData.glow = glow; return g; });
    // sky: the moon, harbor-skyline lights in the fog, low fog banks drifting over the rails
    const moon = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: moonTex(), transparent: true, depthWrite: false, fog: false })); moon.position.set(-18, 24, 70); moon.rotation.y = Math.PI; sc.add(moon);
    { const n = 160, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd(-1.2, 1.2), r = rnd(55, 75); pos.set([Math.sin(a) * r, rnd(-1.5, 9) * (Math.random() < 0.2 ? 2.2 : 1), Math.cos(a) * r], i * 3); const c = new THREE.Color(pick(['#ffd28a', '#fff0c8', '#9ad0ff', '#ff9a6a'])); col.set([c.r, c.g, c.b], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      sc.add(new THREE.Points(g, new THREE.PointsMaterial({ map: DUELS.dot('#ffffff'), size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); }
    { const n = 14, ft = fogTex(); C.fogM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, fog: false }), n); C.fogM.frustumCulled = false; C.fogs = [];
      for (let i = 0; i < n; i++) C.fogs.push({ x: rnd(-9, 9), y: rnd(0.6, 1.6), z: rnd(4, 18), s: rnd(3, 5.5), v: rnd(0.2, 0.5) }); sc.add(C.fogM); } // fog banks stay aft of Harold: never between the camera and him
    C.sign = null;
  }

  // ---------------- the Phantoms (stand-ins until Opus's O8 gang rigs land): ghost silhouettes drifting along the rails ----------------
  function buildPhantoms(sc) {
    const K = DUELS.kit, G = DUELS.GEO; C.phantoms = [];
    const mk = (kind) => { const P = K();
      if (kind === 'bones') P.add(G.sph(0.42, 10, 8), '#c8fff0', 0, 1.5, 0, 0, 0, 0, 1, 1.1, 0.9).add(G.cone(0.45, 1.2, 10), '#8ae8d0', 0, 0.75, 0, Math.PI, 0, 0).add(G.box(0.7, 0.08, 0.1), '#14101f', 0, 1.56, 0.36).add(G.cyl(0.5, 0.5, 0.12, 10), '#3a5a54', 0, 1.88, 0);
      else if (kind === 'dread') P.add(G.sph(0.34, 10, 8), '#c8fff0', 0, 1.35, 0).add(G.cone(0.38, 1.1, 10), '#8ae8d0', 0, 0.65, 0, Math.PI, 0, 0).add(G.tor(0.36, 0.06, TAU, 6, 12), '#c4161c', 0, 1.5, 0, Math.PI / 2, 0, 0).add(G.sph(0.06, 6, 5), '#14101f', -0.12, 1.4, 0.3).add(G.sph(0.06, 6, 5), '#14101f', 0.12, 1.4, 0.3);
      else P.add(G.sph(0.26, 10, 8), '#c8fff0', 0, 1.0, 0).add(G.cone(0.28, 0.8, 8), '#8ae8d0', 0, 0.5, 0, Math.PI, 0, 0).add(G.sph(0.18, 8, 6), '#1a1a1a', 0.32, 0.9, 0.1).add(G.cyl(0.02, 0.02, 0.2, 4), '#ffb030', 0.36, 1.1, 0.1);
      const m = toonMat({ transparent: true, opacity: 0.55, depthWrite: false }); m.emissive = new THREE.Color('#1a6a5a'); const g = new THREE.Group(); P.mesh(m, g, 0); sc.add(g); return g; };
    [['bones', 4.2, 4.2], ['dread', -4.3, 3.0], ['monkey', 4.4, -0.8], ['dread', -4.4, 8.0], ['monkey', 3.9, 10.5]].forEach(([k, x, z], i) => { const g = mk(k); g.position.set(x, 1.15, z); g.rotation.y = Math.PI + (x > 0 ? -0.6 : 0.6); C.phantoms.push({ g, x, z, ph: i * 1.3, flee: 0, dir: x > 0 ? 1 : -1 }); });
  }

  // ---------------- the captain stand-in: an original ghost privateer ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), flash: [], ghost: [] };
    const gm = () => { const m = toonMat({ transparent: true, opacity: 0.5 }); m.emissive = new THREE.Color('#0e3a32'); R.ghost.push(m); R.flash.push(m); return m; };
    R.body = new THREE.Group(); R.root.add(R.body);
    const B = K();
    // peg leg + one boot, a long teal frock coat flaring into wisps, a sash, brass buttons
    B.add(G.cyl(0.07, 0.05, 0.75, 6), '#8a6a40', -0.22, 0.38, 0).add(G.cyl(0.13, 0.15, 0.6, 8), '#1a1a20', 0.22, 0.32, 0).add(G.box(0.26, 0.14, 0.4), '#1a1a20', 0.22, 0.07, 0.08);
    B.add(G.cyl(0.5, 0.82, 1.25, 14), '#2a7a6c', 0, 1.15, 0).add(G.cyl(0.52, 0.52, 0.14, 14), '#e8d27a', 0, 1.28, 0);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) B.add(G.sph(0.045, 6, 5), '#e8c040', s * 0.18, 1.62 - k * 0.2, 0.5 - k * 0.02);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; B.add(G.cone(0.18, 0.5, 6), '#3a9a88', Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.62, Math.PI, 0, 0); } // coat-tail wisps
    B.add(G.cyl(0.46, 0.5, 0.5, 14), '#2a7a6c', 0, 1.9, 0).add(G.box(0.7, 0.4, 0.1), '#f0ecdc', 0, 1.85, 0.42); // chest + a jabot
    for (const s of [-1, 1]) B.add(G.sph(0.22, 8, 6), '#e8c040', s * 0.5, 2.1, 0, 0, 0, 0, 1, 0.45, 1); // epaulettes
    // the head: a pale-green face, a big fog-white beard, a red nose, one eye patch, bushy brows
    B.add(G.sph(0.36, 14, 10), '#bff0dc', 0, 2.4, 0.05).add(G.sph(0.4, 12, 8), '#eef8f4', 0, 2.2, 0.18, 0, 0, 0, 1, 0.9, 0.7).add(G.cone(0.22, 0.55, 8), '#eef8f4', 0, 1.88, 0.22, Math.PI, 0, 0)
      .add(G.sph(0.08, 8, 6), '#e86a6a', 0, 2.42, 0.4).add(G.sph(0.07, 8, 6), '#14101f', 0.13, 2.53, 0.33).add(G.cyl(0.1, 0.1, 0.04, 10), '#14101f', -0.13, 2.53, 0.34, Math.PI / 2, 0, 0)
      .add(G.box(0.72, 0.03, 0.03), '#14101f', 0, 2.56, 0.3, 0, 0, 0.25).add(G.box(0.16, 0.05, 0.05), '#eef8f4', 0.14, 2.64, 0.33, 0, 0, -0.3).add(G.box(0.16, 0.05, 0.05), '#eef8f4', -0.14, 2.64, 0.33, 0, 0, 0.3);
    R.bodyM = B.mesh(gm(), R.body);
    // the tricorn (its own group so it can fall off at the KO)
    R.hat = new THREE.Group(); R.hat.position.set(0, 2.68, 0.0); R.body.add(R.hat);
    { const Hk = K(); Hk.add(G.cyl(0.3, 0.36, 0.26, 12), '#1c2228', 0, 0.12, 0); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + Math.PI / 2; Hk.add(G.box(0.62, 0.22, 0.1), '#1c2228', Math.cos(a) * 0.33, 0.12, Math.sin(a) * 0.33, 0, -a + Math.PI / 2, 0).add(G.box(0.62, 0.03, 0.03), '#e8c040', Math.cos(a) * 0.37, 0.23, Math.sin(a) * 0.37, 0, -a + Math.PI / 2, 0); }
      Hk.add(G.box(0.24, 0.2, 0.03), '#f0ecdc', 0, 0.14, 0.42).add(G.box(0.06, 0.06, 0.04), '#14101f', -0.05, 0.16, 0.44).add(G.box(0.06, 0.06, 0.04), '#14101f', 0.05, 0.16, 0.44); R.hatM = gm(); Hk.mesh(R.hatM, R.hat); }
    // arms: shoulder pivots. armL (his left = screen right) holds the ghost lantern; armR swings the cobblestone in a net bag on a rope
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.58, 2.0, 0.05); R.body.add(sh);
      const A = K(); A.add(G.sph(0.16, 8, 6), '#2a7a6c', 0, 0, 0).add(G.cyl(0.11, 0.13, 0.75, 8), '#2a7a6c', 0, -0.38, 0).add(G.cyl(0.15, 0.13, 0.14, 8), '#f0ecdc', 0, -0.78, 0).add(G.sph(0.12, 8, 6), '#bff0dc', 0, -0.9, 0);
      if (s > 0) A.add(G.cyl(0.015, 0.015, 0.7, 4), '#5a4a32', 0, -1.25, 0).add(G.sph(1, 8, 6), '#5a5a60', 0, -1.7, 0, 0.3, 0.4, 0, 0.24, 0.2, 0.22).add(G.tor(0.2, 0.015, TAU, 4, 10), '#8a7a5a', 0, -1.7, 0, Math.PI / 2, 0, 0).add(G.tor(0.2, 0.015, TAU, 4, 10), '#8a7a5a', 0, -1.7, 0, 0, 0, 0);
      A.mesh(gm(), sh); R.arms.push({ sh, s }); }
    R.armL = R.arms[0].sh; R.armR = R.arms[1].sh;
    // the ghost lantern in his left hand: a brass cage with green glass (its glow is a sprite + a point light the core drives)
    R.lantern = new THREE.Group(); R.lantern.position.set(0, -1.15, 0); R.armL.add(R.lantern);
    { const Lk = K(); Lk.add(G.cyl(0.18, 0.2, 0.06, 8), '#b8902a', 0, 0.26, 0).add(G.cyl(0.2, 0.2, 0.06, 8), '#b8902a', 0, -0.24, 0).add(G.cone(0.18, 0.16, 8), '#b8902a', 0, 0.36, 0).add(G.tor(0.08, 0.015, TAU, 4, 8), '#b8902a', 0, 0.48, 0)
        .add(G.cyl(0.15, 0.15, 0.44, 8), '#7dffc8', 0, 0.01, 0); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; Lk.add(G.cyl(0.015, 0.015, 0.5, 4), '#b8902a', Math.cos(a) * 0.18, 0.01, Math.sin(a) * 0.18); }
      R.lanternM = toonMat(); R.lanternM.emissive = new THREE.Color('#3aff9a'); R.lanternM.emissiveIntensity = 0.5; Lk.mesh(R.lanternM, R.lantern, 0.003); }
    return R;
  }

  // ---------------- build ----------------
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#0c1a2a', 16, 60); sc.background = new THREE.Color('#0a1422');
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 160);
    DUELS.sceneLights(sc, '#7a90d0', '#1a1a2a', 0.85, '#b8c8ff', 1.1, new THREE.Vector3(-0.4, 1, 0.8));
    C.deckL = new THREE.PointLight('#ffb070', 10, 10, 1.6); C.deckL.position.set(-2.6, 3.0, 1.6); sc.add(C.deckL); // a ship's lamp over the capstan (warm, Harold's side)
    buildArena(sc); buildPhantoms(sc);
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    let rig = null; try { if (typeof window.buildCaptainCobblestone === 'function') rig = window.buildCaptainCobblestone({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    if (!rig.body) rig.body = rig.root;
    for (const k of ['hat', 'lantern']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.body.add(rig[k]); }
    if (!rig.arms) { rig.arms = []; if (rig.armL) rig.arms.push({ sh: rig.armL, s: -1 }); if (rig.armR) rig.arms.push({ sh: rig.armR, s: 1 }); }
    rig.flash = rig.flash || []; rig.ghost = rig.ghost || [];
    if (!rig.lanternLight) { rig.lanternLight = new THREE.PointLight('#5affb0', 6, 9, 1.4); rig.lantern.add(rig.lanternLight); }
    rig.hatHome = { parent: rig.hat.parent, p: rig.hat.position.clone(), r: rig.hat.rotation.clone() };
    rig.hulls = []; rig.root.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial) rig.hulls.push(o); });
    C.R = rig; rig.root.position.set(0, 0, MZ); rig.root.rotation.y = Math.PI; sc.add(rig.root);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: DUELS.dot('#7dffc8'), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); rig.lantern.add(lg); C.lanGlow = lg;
    // lane floods (the lantern sweep), lane warning strips (the broadside), the rope's shadow arc + glowing rope, cannonballs, puffs (fog / ecto), sparks
    const ADD = (c, o = 0) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
    C.floods = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 6.2), ADD('#5affb0')); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.03, 1.6); m.visible = false; sc.add(m); return m; });
    C.cones = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.75, 1, 12, 1, true), ADD('#5affb0')); m.visible = false; sc.add(m); m.userData.l = l; return m; });
    C.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 7.2), ADD('#7dffc8')); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.04, 3.4); m.visible = false; sc.add(m); return m; });
    C.arc = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.8), new THREE.MeshBasicMaterial({ map: arcTex(), color: '#14101f', transparent: true, opacity: 0, depthWrite: false, fog: false })); C.arc.rotation.x = -Math.PI / 2; C.arc.position.set(0, 0.05, 0.7); C.arc.visible = false; sc.add(C.arc);
    C.arcG = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.8), new THREE.MeshBasicMaterial({ map: arcTex(), color: '#7dffc8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); C.arcG.position.set(0, 1.2, 0.4); C.arcG.visible = false; sc.add(C.arcG);
    C.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), new THREE.MeshBasicMaterial({ color: '#c8b07a', fog: false })); C.rope.visible = false; sc.add(C.rope); C.ropeTop = new THREE.Vector3(0, 9.5, 6.0);
    C.balls = []; C.ballM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshBasicMaterial({ color: '#9affd8', transparent: true, opacity: 0.85, fog: false }), 8); C.ballM.count = 0; C.ballM.frustumCulled = false; sc.add(C.ballM);
    C.puffM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#bff4e4'), transparent: true, depthWrite: false, fog: false }), 70); C.puffM.count = 0; C.puffM.frustumCulled = false; sc.add(C.puffM); C.puffs = [];
    C.spark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: DUELS.dot('#eafff4', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 50); C.spark.count = 0; C.spark.frustumCulled = false; sc.add(C.spark); C.sparks = [];
    C.flareS = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffffff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); C.flareS.visible = false; sc.add(C.flareS);
    // Harold's held ghost lantern for the FLARE (a small copy, shown only during the special)
    C.hLan = new THREE.Group(); C.hLan.visible = false; sc.add(C.hLan);
    { const Lk = DUELS.kit(), G = DUELS.GEO; Lk.add(G.cyl(0.12, 0.13, 0.04, 8), '#b8902a', 0, 0.17, 0).add(G.cyl(0.13, 0.13, 0.04, 8), '#b8902a', 0, -0.16, 0).add(G.cyl(0.1, 0.1, 0.3, 8), '#eafff4', 0, 0, 0); const m = toonMat(); m.emissive = new THREE.Color('#9affd8'); Lk.mesh(m, C.hLan, 0); }
    // DOM: the "!" over the captain, damage pops, the POWER bar (in the sub HUD), a green "ghostly" vignette
    const css = document.createElement('style');
    css.textContent = `#duel .cbbang { position: absolute; left: 0; top: 0; font-size: 34px; color: #9affd8; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; transform: translate(-50%, -100%); display: none; animation: cbb .3s infinite alternate; }
    @keyframes cbb { from { transform: translate(-50%, -100%) scale(1); } to { transform: translate(-50%, -110%) scale(1.2); } }
    #duel .cbpop { position: absolute; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; transform: translate(-50%, -50%); animation: cbp .8s ease-out forwards; white-space: nowrap; }
    #duel .cbpop.big { font-size: 22px; color: #9affd8; } #duel .cbpop.w { font-size: 18px; color: #ffd23c; } #duel .cbpop.g { font-size: 14px; color: #bfeee0; opacity: .8; }
    @keyframes cbp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.6); } 20% { transform: translate(-50%, -80%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
    #duel .cbpow { display: inline-block; width: 92px; height: 9px; border: 2px solid #14101f; background: #102a28; border-radius: 6px; overflow: hidden; vertical-align: middle; margin-left: 4px; }
    #duel .cbpow i { display: block; height: 100%; background: linear-gradient(#d8fff0, #3ad8a0); }
    #duel .cbpow.full i { background: linear-gradient(#fff, #9affd8); animation: dlow .3s infinite alternate; }
    #duel .cbghost { position: absolute; inset: 0; box-shadow: inset 0 0 110px 40px rgba(90,255,176,.75); opacity: 0; transition: opacity .2s; }
    #duel .cbsolid { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 96px); transform: translateX(-50%); font-size: 10px; letter-spacing: 1px; color: #14101f; background: #9affd8; border: 2px solid #14101f; border-radius: 8px; padding: 3px 8px; display: none; }
    body.duel-cobblestone #duel .dtell { white-space: normal; max-width: 88vw; text-align: center; border-color: #9affd8; }
    body.duel-cobblestone #duel .dsay { box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #3ad8a0; background: #10302c; top: calc(env(safe-area-inset-top, 0px) + 124px); }
    @media (max-width: 480px) { #duel .cbpow { width: 70px; } body.duel-cobblestone #duel .dtell { font-size: 11px; } }`;
    document.head.appendChild(css);
    C.bang = document.createElement('div'); C.bang.className = 'cbbang'; C.bang.textContent = '!'; DUELS.hudEl.appendChild(C.bang);
    C.ghostV = document.createElement('div'); C.ghostV.className = 'cbghost'; DUELS.hudEl.insertBefore(C.ghostV, DUELS.hudEl.firstChild);
    C.solidTag = document.createElement('div'); C.solidTag.className = 'cbsolid'; C.solidTag.textContent = 'SOLID! SWING!'; DUELS.hudEl.appendChild(C.solidTag);
  };

  // ---------------- state ----------------
  function reset(phase, hp = 100) {
    const old = C.st;
    const st = C.st = { t: 0, phase, mhp: 100, hp, pow: old ? old.pow * 0.5 : 0, lane: 0, duck: false, lockT: 0, swingT: -1, combo: 0, comboT: 0, swingCd: 0, hurtT: 0, inv: 0, drainT: 0,
      ms: 'intro', mt: 0, mdur: phase === 0 && !old ? 2.6 : 1.4, mixI: Math.floor(Math.random() * 2), lit: [], sweepN: 0, vol: [], volI: 0, volT: 0, ropeDir: 1, hitThis: false, dodged: false, drained: false,
      solid: 0, over: false, won: false, outT: 0, stop: 0, slow: 1, slowT: 0, shake: 0, flareT: -1, healUsed: false, wind: old ? old.wind : true, bx: 0, bz: MZ,
      stats: old && old.stats || { swings: 0, landed: 0, whiffs: 0, flares: 0, dodges: 0, hitsTaken: 0, hits: { drain: 0, ball: 0, rope: 0 }, attacks: { sweep: 0, broad: 0, rope: 0 }, heals: 0, winds: 0, maxCombo: 0 } };
    C.puffs.length = 0; C.sparks.length = 0; C.balls.length = 0; DUELS.blind(0);
    const R = C.R; R.root.visible = true; R.root.position.set(0, 0, MZ); R.root.rotation.set(0, Math.PI, 0); R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0); R.body.scale.set(1, 1, 1);
    if (R.hat.parent !== R.hatHome.parent) { R.hatHome.parent.add(R.hat); } R.hat.position.copy(R.hatHome.p); R.hat.rotation.copy(R.hatHome.r); R.hat.visible = true;
    C.bell.rotation.set(0, 0, 0); C.hLan.visible = false; C.flareS.visible = false;
    for (const P of C.phantoms) { P.flee = 0; P.g.visible = true; P.g.position.set(P.x, 1.15, P.z); }
    return st;
  }
  function subHud(st) { const f = st.pow >= 1;
    DUELS.sub('POWER<span class="cbpow' + (f ? ' full' : '') + '"><i style="width:' + Math.round(st.pow * 100) + '%"></i></span>' + (st.combo > 1 ? ' <span style="color:#9affd8">x' + st.combo + '</span>' : ''), 'PHASE ' + (st.phase + 1) + '/3'); }
  C.start = function (opts) {
    C.st = null; const ph = clamp(+(Q.get('cobblestonephase') || 1) - 1, 0, 2) | 0; const st = reset(ph); DUELS.log.push('cobblestone:' + C.rigKind); subHud(st);
    DUELS.banner('CAPTAIN COBBLESTONE<small>USS CONSTELLATION · MIDNIGHT · PHASE ' + (ph + 1) + '</small>', 2.4);
    const l = lines(); DUELS.say('CAPTAIN COBBLESTONE', l && l.intro ? pick(l.intro) : pick(TAUNT), 3.4);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 2.4, MZ);
  };
  C.retry = function () { const p = C.st.phase; C.st = null; reset(p); C.st.ms = 'guard'; C.st.mdur = 1.4; subHud(C.st); DUELS.banner('PHASE ' + (p + 1) + '<small>BACK ON DECK! FULL HEALTH</small>', 1.6); };
  C.exit = function () { DUELS.blind(0); if (C.bang) C.bang.style.display = 'none'; if (C.ghostV) C.ghostV.style.opacity = '0'; if (C.solidTag) C.solidTag.style.display = 'none'; C.hudPops(true); };

  // ---------------- small fx + sound ----------------
  function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  function noise(dur, vol = 0.12, hp = 1200, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); s.start(t); } catch (e) {} }
  const sting = (k) => { if (k === 'sweep') { tone(220, 440, 0.9, 'sine', 0.1); tone(330, 660, 0.9, 'sine', 0.06, 0.05); } else if (k === 'broad') { for (let i = 0; i < 3; i++) { noise(0.12, 0.1, 2400, i * 0.3); tone(90, 60, 0.2, 'triangle', 0.1, i * 0.3); } }
    else if (k === 'rope') { tone(500, 200, 0.5, 'sawtooth', 0.04); noise(0.6, 0.06, 2000, 0.1); } else if (k === 'ding') { tone(1320, 1300, 0.6, 'triangle', 0.13); } else if (k === 'boom') { noise(0.5, 0.2, 120); tone(110, 40, 0.4, 'square', 0.12); }
    else if (k === 'whoosh') { noise(0.25, 0.09, 600); tone(700, 300, 0.25, 'sine', 0.05); } else if (k === 'bell') { tone(523, 520, 1.8, 'triangle', 0.16); tone(1046, 1040, 1.2, 'sine', 0.06); } };
  function puff(p, v, life = 1.0, s = 1) { if (C.puffs.length < 70) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function spark(p, n = 6) { for (let k = 0; k < n && C.sparks.length < 50; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 1)), t: 0, life: rnd(0.3, 0.6) }); }
  const POPS = [];
  function pop(text, p, cls = '') { const e = document.createElement('div'); e.className = 'cbpop ' + cls; e.textContent = text; V3.copy(p).project(C.cam); e.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; e.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 0 }); }
  C.hudPops = function (clear, dt = 0) { for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].t += dt; if (clear || POPS[i].t > 0.85) { POPS[i].e.remove(); POPS.splice(i, 1); } } };
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; }
  function addPow(st, v) { const was = st.pow >= 1; st.pow = clamp(st.pow + v, 0, 1); if (!was && st.pow >= 1) { DUELS.tell('POWER FULL: ACT = LANTERN FLARE!', 1.2); sting('ding'); } subHud(st); }
  // a hit (inv-gated) or a drain tick (not inv-gated, small): both go through here
  function damage(st, dmg, kind, drain) {
    if (st.over || st.flareT >= 0) return false;
    if (!drain) { if (st.inv > 0) return false; st.inv = 1.3; st.hurtT = 0.4; st.lockT = 0.3; st.shake = 0.35; st.stop = 0.06; DUELS.hurt(); sfx('hurt'); C.hflash = 1; st.lane = st.lane; st.duck = false; pop('-' + dmg, V.set(sx(st.lane) * 0.95, 2.0, 0.2), ''); }
    st.hp -= dmg;
    if (!drain || !st.drained) { st.stats.hits[kind]++; st.stats.hitsTaken++; st.combo = 0; if (drain) st.drained = true; }
    if (st.hp <= 0) {
      if (st.wind) { st.wind = false; st.hp = 45; st.stats.winds++; st.inv = 2.0; st.drainT = 0; DUELS.banner('SECOND WIND!<small>HAROLD\'S BACK UP</small>', 1.6); DUELS.say('MAVIS', 'Up you get, Harold! It\'s only a ghost!', 2.2); return true; }
      st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('cobblestone:lose:' + kind); clearFx();
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'WALKED THE PLANK!', 'Captain Cobblestone haunted Harold right off the deck. Retry phase ' + (st.phase + 1) + ' with full health.'); }, SIM ? 300 : 1400);
    } else if (st.hp < 35 && !st.healUsed) { st.healUsed = true; st.healT = 0.9; }
    return true;
  }
  function clearFx() { C.lanes.forEach((l) => { l.material.opacity = 0; l.visible = false; }); C.floods.forEach((l) => { l.material.opacity = 0; l.visible = false; }); C.cones.forEach((c) => { c.visible = false; }); C.arc.visible = false; C.arcG.visible = false; C.rope.visible = false; C.balls.length = 0; }
  function dodgeOk(st, what) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; addPow(st, 0.15); pop(what || 'DODGE!', V.set(sx(st.lane) * 0.95, 2.4, 0.2), 'w'); }
  function pickLit() { const safe = [-1, 0, 1][Math.floor(Math.random() * 3)]; return [-1, 0, 1].filter((l) => l !== safe); }

  // ---------------- the captain's brain ----------------
  function capThink(st, dt) {
    const P = PH[st.phase]; st.mt += dt;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.8); break;
      case 'guard': if (st.mt > st.mdur) { const a = P.mix[st.mixI++ % P.mix.length]; st.stats.attacks[a]++;
          if (a === 'sweep') { st.sweepN = 0; st.lit = pickLit(); setM(st, 'sweepTell', P.sweep); DUELS.tell('LANTERN SWEEP! FIND THE DARK LANE!', P.sweep); sting('sweep'); }
          else if (a === 'broad') { setM(st, 'broadTell', P.broad); DUELS.tell('ECTO-BROADSIDE! WATCH THE GUNS!', P.broad); sting('broad');
            const v = []; let prev = 9; for (let k = 0; k < P.volleys; k++) { let l; do { l = [-1, 0, 1][Math.floor(Math.random() * 3)]; } while (l === prev); prev = l; v.push(P.pair ? [-1, 0, 1].filter((x) => x !== l) : [l]); } st.vol = v; st.volI = 0; }
          else { setM(st, 'ropeTell', P.rope); DUELS.tell('RIGGING SWING! DUCK!', P.rope); sting('rope'); st.ropeDir = Math.random() < 0.5 ? -1 : 1; }
          if (Math.random() < 0.25) DUELS.say('CAPTAIN COBBLESTONE', pick(MID), 2.0); }
        break;
      // LANTERN SWEEP: the lit lanes glow faintly through the tell; then the beam floods them and drains anyone standing in the light
      case 'sweepTell': if (st.mt > st.mdur) { setM(st, 'sweep', 1.3); st.drained = false; noise(0.9, 0.08, 800); } break;
      case 'sweep': { const inLight = st.lit.includes(st.lane);
        if (inLight && st.mt > 0.12) { st.drainT += dt; if (st.drainT > 0.25) { st.drainT -= 0.25; damage(st, Math.round(DMG.drain * 0.25 * 10) / 10, 'drain', true); C.hflash = 0.6; if (!st.saidLight) { st.saidLight = true; DUELS.tell('IN THE LIGHT! GET TO THE DARK LANE!', 0.8); } } }
        if (st.mt > st.mdur) { if (!st.drained) dodgeOk(st, 'IN THE SHADOWS!'); st.drainT = 0; st.saidLight = false; st.sweepN++;
          if (st.sweepN < P.sweeps && !st.over) { const old = st.lit; do { st.lit = pickLit(); } while (st.lit.join() === old.join()); setM(st, 'sweepTell', 1.05); DUELS.tell('AGAIN! THE LIGHT MOVES!', 1.05); sting('sweep'); }
          else setM(st, 'open', P.open); }
        break; }
      // ECTO-BROADSIDE: volleys down the lanes; each volley's lanes flash for one gap before the guns fire; the balls roll down the deck
      case 'broadTell': if (st.mt > st.mdur) { setM(st, 'broad', 99); st.volT = 0.01; st.volI = 0; st.broadHit = false; } break;
      case 'broad': st.volT -= dt;
        if (st.volT <= 0 && st.volI < st.vol.length) { const ls = st.vol[st.volI++]; st.volT = P.gap; sting('boom'); st.shake = Math.max(st.shake, 0.15);
          for (const l of ls) { C.balls.push({ l, z: GZ - 1.1, hit: false }); C.guns[l + 1].getWorldPosition(V); V.y = 0.6; V.z -= 1.1; for (let k = 0; k < 5; k++) puff(V, V2.set(rnd(-0.6, 0.6), rnd(0.3, 1.2), rnd(-1.5, -0.5)), 0.7, rnd(0.6, 1.0)); } }
        if (st.volI >= st.vol.length && C.balls.length === 0) { if (!st.broadHit) dodgeOk(st, 'BROADSIDE DODGED!'); setM(st, 'open', P.open); }
        break;
      // RIGGING SWING: he crouches with the rope, the shadow arc + glowing rope show the path; then he swings across at chest height (duck), lands solid in front
      case 'ropeTell': if (st.mt > st.mdur) { setM(st, 'rope', 1.0); sfx('swing'); noise(0.5, 0.1, 900); } break;
      case 'rope': { const u = clamp(st.mt / 0.85, 0, 1);
        if (!st.hitThis && u > 0.48) { st.hitThis = true; if (!st.duck) damage(st, DMG.rope, 'rope'); else dodgeOk(st, 'DUCKED!'); }
        if (st.mt > st.mdur) { setM(st, 'open', P.open + 0.5); st.landed = true; sfx('heavy'); st.shake = Math.max(st.shake, 0.25); } break; }
      case 'open': if (st.mt > st.mdur) { st.landed = false; setM(st, 'guard', rnd(...P.guard)); } break;
      case 'flared': if (st.mt > st.mdur) { if (st.mhp <= 0) phaseDown(st); else setM(st, 'open', 1.0); } break;
      case 'down': if (st.mt > st.mdur) { st.phase++; st.mhp = 100; st.hp = Math.min(100, st.hp + 30); st.healUsed = false; setM(st, 'guard', 1.2); subHud(st); sting('ding');
          DUELS.banner('PHASE ' + (st.phase + 1) + '<small>' + (st.phase === 2 ? 'THE WITCHING HOUR!' : 'ALL HANDS ON DECK!') + '</small>', 1.6); } break;
      case 'ko': break;
    }
    // Mavis's crab cake (once a phase, when Harold drops low)
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 35); st.stats.heals++; DUELS.say('MAVIS', 'Here, hon: a crab cake! Eat!', 2.0); pop('+35', V.set(sx(st.lane) * 0.95, 2.2, 0.2), 'w'); sfx('jump'); }
  }
  function phaseDown(st) { clearFx();
    if (st.phase >= 2) { setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.slow = 0.35; st.slowT = 1.3; DUELS.banner('K.O.!<small>BACK TO THE FOG</small>', 2.2); sting('ding'); sfx('ko'); }
    else { setM(st, 'down', 2.4); DUELS.banner('AVAST!<small>PHASE ' + (st.phase + 1) + ' TO HAROLD</small>', 2.0); if (Math.random() < 0.7) DUELS.say(Math.random() < 0.5 ? 'MAVIS' : 'A PHANTOM', Math.random() < 0.5 ? pick(MAVIS.slice(0, 3)) : pick(PHANTOM), 2.2); }
  }
  const isSolid = (st) => st.ms === 'open' || st.ms === 'flared' || st.ms === 'down' || st.ms === 'ko';

  // ---------------- Harold ----------------
  C.step = function (dt0, I) {
    const st = C.st; if (!st) return;
    C.hudPops(false, dt0);
    if (st.stop > 0) { st.stop -= dt0; return; } // hitstop
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    const dt = dt0 * st.slow; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.swingCd -= dt; st.lockT -= dt; st.comboT -= dt; if (st.comboT <= 0 && st.combo) { st.combo = 0; subHud(st); }
    if (!st.over && st.flareT < 0) {
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; const duck = I.my < -0.5 || I.bh;
      if (st.lockT > 0 || st.swingT >= 0) want = st.swingT >= 0 ? st.lane : st.lane;
      st.lane = want;
      st.duck = st.lockT <= 0 && st.swingT < 0 && duck;
      const can = !st.duck && st.swingCd <= 0 && st.hurtT <= 0;
      if (I.c && st.pow >= 1 && ['open', 'guard', 'intro', 'sweepTell', 'broadTell', 'ropeTell'].includes(st.ms)) startFlare(st);
      else if (I.c && st.pow < 1 && st.swingCd <= 0) { DUELS.tell('NEED POWER: HIT + DODGE', 0.8); st.swingCd = 0.3; }
      else if (I.a && can) { const k = st.comboT > 0 ? st.combo % 3 : 0; st.swingT = 0; st.swingK = k; st.swingCd = k === 2 ? 0.42 : 0.24; st.swingHit = false; st.stats.swings++; sfx('swing'); }
      if (st.swingT >= 0) { st.swingT += dt; if (st.swingT > 0.09 && !st.swingHit) { st.swingHit = true; landSwing(st); } if (st.swingT > (st.swingK === 2 ? 0.4 : 0.22)) st.swingT = -1; }
    }
    if (st.flareT >= 0) stepFlare(st, dt);
    capThink(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, (st.mhp / 100 + (2 - st.phase)) / 3);
    if (st.ms === 'ko') outro(st, dt);
  };
  const WORDS = [['WHAP!', 'TAP!', 'BONK!'], ['WHACK!', 'THWAP!'], ['AVAST!', 'BELAYED!', 'SHIVERED!']];
  function landSwing(st) {
    const k = st.swingK; V.set(sx(st.lane) * 0.6 + rnd(-0.3, 0.3), k === 2 ? 2.4 : 1.9, st.landed ? 1.6 : MZ - 0.6);
    if (isSolid(st) && st.ms !== 'down') {
      const crit = st.ms === 'open' && st.mt < 0.4, dmg = SWING[k] + (crit ? 2 : 0); st.mhp -= dmg; st.stats.landed++; st.combo++; st.comboT = 1.1; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.combo);
      sfx(k === 2 ? 'heavy' : 'hit'); spark(V, k === 2 ? 14 : 6); flashBoss(k === 2 ? '#9affd8' : '#ffffff'); st.stop = k === 2 ? 0.085 : 0.065; st.shake = Math.max(st.shake, k === 2 ? 0.3 : 0.12);
      pop((k === 2 ? pick(WORDS[2]) + ' ' : '') + dmg, V, k === 2 || crit ? 'big' : ''); addPow(st, k === 2 ? 0.09 : 0.05);
      if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); }
    } else if (!isSolid(st)) { st.stats.whiffs++; st.combo = 0; sting('whoosh'); for (let i = 0; i < 3; i++) puff(V, V2.set(rnd(-1, 1), rnd(0, 1), rnd(-1, 0)), 0.6, 0.5); pop('WHOOSH!', V, 'g'); DUELS.tell('HE\'S A GHOST! WAIT TILL HE\'S SOLID!', 0.7); }
    else { st.combo = 0; }
    subHud(st);
  }
  // GHOST-LANTERN FLARE: Mavis tosses Harold the lantern, it flares white, the captain turns solid + stunned, a slow-mo 6-hit cane flurry
  function startFlare(st) { st.flareT = 0; st.flareN = 0; st.pow = 0; st.stats.flares++; st.slow = 0.5; st.slowT = 2.0; st.inv = 3.5; st.duck = false; clearFx();
    setM(st, 'flared', 3.0); DUELS.banner('GHOST-LANTERN FLARE!<small>MAVIS + HAROLD</small>', 1.8); DUELS.say('MAVIS', MAVIS[3], 1.6); sting('ding'); subHud(st); C.hLan.visible = true; }
  function stepFlare(st, dt) {
    st.flareT += dt; const t = st.flareT;
    if (t > 0.45 && !st.flared) { st.flared = true; C.flareS.visible = true; sting('bell'); noise(0.4, 0.12, 2000); st.shake = 0.3; DUELS.tell('SOLID! FLURRY!', 1.0); }
    if (C.flareS.visible) { const u = clamp((t - 0.45) / 0.6, 0, 1); C.flareS.material.opacity = (1 - u) * 0.95; const s = 1 + u * 9; C.flareS.scale.set(s, s, s); C.hLan.getWorldPosition(C.flareS.position); C.flareS.quaternion.copy(C.cam.quaternion); if (u >= 1) C.flareS.visible = false; }
    const hitAt = 0.85 + st.flareN * 0.17;
    if (st.flareN < FLARE.length && t > hitAt) { const k = st.flareN++, d = FLARE[k]; st.mhp -= d; st.stats.landed++; V.set(rnd(-0.6, 0.6), rnd(1.6, 2.6), MZ - 0.6); spark(V, k === FLARE.length - 1 ? 18 : 6); flashBoss(k === FLARE.length - 1 ? '#9affd8' : '#ffffff', 1);
      sfx(k === FLARE.length - 1 ? 'heavy' : 'hit'); st.stop = k === FLARE.length - 1 ? 0.1 : 0.04; st.shake = Math.max(st.shake, k === FLARE.length - 1 ? 0.5 : 0.15); pop(k === FLARE.length - 1 ? 'FLARE FINISH! ' + d : '' + d, V, k === FLARE.length - 1 ? 'big' : ''); }
    if (t > 2.3) { st.flareT = -1; st.flared = false; C.hLan.visible = false; if (st.mhp <= 0) { st.mhp = 0; phaseDown(st); } }
  }
  // ---------------- the KO: dissolves into fog, the tricorn clunks on the deck, the bell tolls, the Phantoms scatter ----------------
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R;
    if (!st.hatOff) { st.hatOff = true; R.hat.getWorldPosition(V); R.hat.getWorldQuaternion(R.hat.quaternion); C.scene.add(R.hat); R.hat.position.copy(V); st.hatV = new THREE.Vector3(rnd(-0.3, 0.3), 1.6, -1.2); st.hatBounce = 0; }
    // dissolve: rise a little, stretch, fade, shed fog puffs
    const u = clamp(t / 1.6, 0, 1); R.body.position.y = u * 0.8; R.body.scale.set(1 - u * 0.4, 1 + u * 0.6, 1 - u * 0.4); for (const m of R.ghost) { m.transparent = true; m.opacity = 0.55 * (1 - u); }
    for (const h of R.hulls) h.visible = false; if (R.lanternLight) R.lanternLight.intensity = 6 * (1 - u); if (C.lanGlow) C.lanGlow.material.opacity = 0.5 * (1 - u);
    if (u < 1 && Math.random() < dt * 40) { V.set(R.root.position.x + rnd(-0.6, 0.6), rnd(0.4, 2.6) + u, R.root.position.z + rnd(-0.4, 0.4)); puff(V, V2.set(rnd(-0.6, 0.6), rnd(0.4, 1.2), rnd(-0.4, 0.4)), 1.4, rnd(0.8, 1.4)); }
    if (u >= 1) R.root.visible = false;
    // the tricorn falls and clunks
    if (st.hatV) { st.hatV.y -= 9 * dt; R.hat.position.addScaledVector(st.hatV, dt); R.hat.rotation.x += dt * 3; R.hat.rotation.z += dt * 2;
      if (R.hat.position.y < 0.12) { R.hat.position.y = 0.12; if (st.hatBounce < 2 && st.hatV.y < -1) { st.hatV.y *= -0.35; st.hatV.x *= 0.5; st.hatV.z *= 0.5; st.hatBounce++; sfx('hit'); tone(160, 90, 0.15, 'square', 0.12); } else { st.hatV = null; R.hat.rotation.set(0, R.hat.rotation.y, 0); } } }
    // the bell tolls three times
    for (let k = 0; k < 3; k++) if (t > 1.2 + k * 0.8 && !(st['bell' + k])) { st['bell' + k] = true; sting('bell'); }
    if (t > 1.2) C.bell.rotation.x = Math.sin((t - 1.2) * 7.8) * 0.45 * Math.max(0, 1 - (t - 1.2) / 3.2);
    // the Phantoms scatter over the rails
    if (t > 1.0) for (const P of C.phantoms) { P.flee = Math.min(1, P.flee + dt * 0.6); P.g.position.x += P.dir * dt * (2 + P.flee * 6); P.g.position.y += dt * 1.5; P.g.rotation.z = -P.dir * P.flee * 0.6; if (P.flee >= 1) P.g.visible = false; }
    if (t > 2.0 && !st.saidBye) { st.saidBye = true; const l = lines(); DUELS.say('CAPTAIN COBBLESTONE', l && l.defeat ? pick(l.defeat) : 'Back to the fog... I go...', 3.0); }
    if (t > 3.8 && !st.winDone) { st.winDone = true; DUELS.bossCleared('constellation', 'cobblestone-duel');
      const h = st.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('cobblestone:grade:' + g);
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'THE GHOST<br>IS LAID TO REST', '<span style="color:#9affd8;font-size:18px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · hits taken ' + h + ' · best combo x' + st.stats.maxCombo + '<br>The Constellation is clear and the Phantoms have fled. Crime at the Constellation: 0. Rematch any night at the ring.'); }, SIM ? 300 : 1100); }
  }
  function stepFx(dt) {
    const m = new THREE.Matrix4(), q = C.cam.quaternion, st = C.st;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.4); p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.5 + p.t * 2.0); m.compose(p.p, q, V3.set(s, s, s)); C.puffM.setMatrixAt(i, m); }); C.puffM.count = C.puffs.length; C.puffM.visible = C.puffs.length > 0; C.puffM.instanceMatrix.needsUpdate = true;
    for (let i = C.sparks.length - 1; i >= 0; i--) { const p = C.sparks[i]; p.t += dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.sparks.splice(i, 1); }
    C.sparks.forEach((p, i) => { m.compose(p.p, q, V3.set(1, 1, 1)); C.spark.setMatrixAt(i, m); }); C.spark.count = C.sparks.length; C.spark.visible = C.sparks.length > 0; C.spark.instanceMatrix.needsUpdate = true;
    // cannonballs: roll down their lane; hit Harold if he's in it when the ball reaches him
    for (let i = C.balls.length - 1; i >= 0; i--) { const b = C.balls[i]; b.z -= dt * 11;
      if (!b.hit && b.z < 0.5) { b.hit = true; if (st.lane === b.l && damage(st, DMG.ball, 'ball')) st.broadHit = true; }
      if (b.z < -4) C.balls.splice(i, 1); }
    C.balls.forEach((b, i) => { m.compose(V.set(sx(b.l), 0.3 + Math.abs(Math.sin(b.z * 1.5)) * 0.12, b.z), q, V3.set(1, 1, 1)); C.ballM.setMatrixAt(i, m); }); C.ballM.count = C.balls.length; C.ballM.visible = C.balls.length > 0; C.ballM.instanceMatrix.needsUpdate = true;
    // drifting fog banks
    C.fogs.forEach((f, i) => { f.x += f.v * dt; if (f.x > 10) f.x = -10; m.compose(V.set(f.x, f.y, f.z), q, V3.set(f.s, f.s * 0.45, 1)); C.fogM.setMatrixAt(i, m); }); C.fogM.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    let p;
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    p = HERO_POSES.idle(t); legsStance(p, 0.22, 0.45);
    p.shR = [-1.1, 0, -0.5]; p.elR = [-0.9, 0, 0]; p.torso = [0.1, 0, 0]; p.y = Math.sin(t * 6) * 0.03;
    if (st.swingT >= 0) { const k = st.swingK, u = clamp(st.swingT / (k === 2 ? 0.4 : 0.22), 0, 1), s = Math.sin(u * Math.PI);
      if (k === 2) { p.shR = [-3.0 + u * 2.6, 0, -0.3]; p.elR = [-0.3, 0, 0]; p.torso = [0.1 + u * 0.5, 0, 0]; p.y += s * 0.3; }
      else { const d = k === 0 ? 1 : -1; p.shR = [-1.5, 0, -0.5 + d * (u - 0.5) * 2.0]; p.elR = [-0.4, 0, 0]; p.torso = [0.15, -d * (u - 0.5) * 1.2, 0]; } }
    if (st.flareT >= 0) { const t2 = st.flareT; if (t2 < 0.85) { p.shL = [-3.0, 0, 0.3]; p.elL = [-0.2, 0, 0]; } else { const w = Math.sin(t2 * 30); p.shL = [-2.8, 0, 0.4]; p.shR = [-1.6, 0, -0.5 + w * 1.0]; p.torso = [0.2, -w * 0.5, 0]; } }
    if (st.duck) { legsStance(p, 0.26, 1.25); p.y -= 0.34; p.torso = [0.6, 0, 0]; }
    if (st.lane && st.flareT < 0) { p.tilt = [0, 0, st.lane * 0.2]; p.torso = [0.18, 0, st.lane * 0.22]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'down' || st.ms === 'open' || st.flareT >= 0 ? 1 : 0.35, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.healT > 0 || (st.flareT >= 0 && st.flareT < 0.45)) { p.shR = [-2.8, 0, -0.2]; } return p; }
  function setGhost(R, solid, dt) {
    const target = solid ? 1 : 0.58; for (const m of R.ghost) { const o = damp(m.opacity, target, 10, dt); m.opacity = o; const tr = o < 0.98; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = !tr || o > 0.7; }
    for (const h of R.hulls) h.visible = QUAL.hd && solid;
  }
  function poseCap(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur), P = PH[st.phase]; if (st.ms === 'ko') return;
    const solid = isSolid(st); setGhost(R, solid, dt);
    let lanI = 0.25, lanGlow = 0.35;
    if (R.update) { try { R.update(dt, st.ms, { t, u, lanes: st.ms.startsWith('sweep') ? st.lit : st.ms.startsWith('broad') ? (st.vol[st.volI] || []) : [], phase: st.phase, solid }); } catch (e) { console.error(e); R.update = null; } }
    else {
      let bodyRX = 0, bodyRZ = Math.sin(t * 1.3) * 0.06, bodyY = 0.12 + Math.sin(t * 2.2) * 0.1, rootX = 0, rootZ = MZ; const arm = [[0.2, 0], [0.4, 0]]; // ghosts hover; arm[0] = lantern arm
      switch (st.ms) {
        case 'sweepTell': arm[0] = [-2.6 - Math.sin(st.mt * 18) * 0.1, 0.1]; bodyRX = -0.15; lanI = 4 + 8 * u; lanGlow = 0.5 + 0.4 * (Math.sin(st.mt * 24) * 0.5 + 0.5); break;
        case 'sweep': arm[0] = [-2.4, 0.1]; bodyRX = 0.1; lanI = 16; lanGlow = 1; break;
        case 'broadTell': arm[1] = [-2.0 + Math.sin(st.mt * 14) * 0.3, -0.5]; arm[0] = [-0.6, 0.3]; bodyRZ = 0.2; break; // "FIRE!" arm up
        case 'broad': arm[1] = [-1.3, 0.2]; arm[0] = [-0.6, 0.3]; bodyRX = -0.1; break;
        case 'ropeTell': arm[0] = [-3.0, 0]; arm[1] = [-3.0, 0]; bodyY = -0.15 * u; bodyRX = 0.25; rootX = -st.ropeDir * 3.2 * ease(clamp(u * 1.6, 0, 1)); break;
        case 'rope': { const k = clamp(st.mt / 0.85, 0, 1), a = (k - 0.5) * 2.2; rootX = -st.ropeDir * 3.2 * Math.cos(k * Math.PI) ; rootZ = lerp(MZ, 1.6, Math.sin(k * Math.PI * 0.5)); bodyY = 1.1 - Math.cos(a) * 0.4; bodyRX = -0.6; arm[0] = [-3.0, 0]; arm[1] = [-3.0, 0]; break; }
        case 'open': rootZ = st.landed ? 1.8 : MZ; bodyRX = 0.4 + Math.sin(st.mt * 9) * 0.05; bodyY = -0.05; arm[0] = [0.5, 0.3]; arm[1] = [0.6, -0.3]; lanI = 0.5; lanGlow = 0.1; if (Math.random() < dt * 6) { V3.set(R.root.position.x + rnd(-0.4, 0.4), 2.7, R.root.position.z); spark(V3, 1); } break;
        case 'flared': { const k = st.mt; rootZ = st.landed ? 1.8 : MZ; bodyRX = 0.35 + (k > 0.85 && k < 2.0 ? Math.sin(k * 30) * 0.12 : 0); arm[0] = [-0.2, 0.9]; arm[1] = [-0.2, -0.9]; lanI = 0.3; lanGlow = 0.1; break; }
        case 'down': bodyRX = 0.6; bodyY = -0.25 * ease(clamp(st.mt / 0.5, 0, 1)); arm[0] = [1.0, 0.5]; arm[1] = [1.0, -0.5]; lanI = 0.2; lanGlow = 0.05; rootZ = MZ; if (Math.random() < dt * 8) { V3.set(R.root.position.x, 2.6, R.root.position.z); spark(V3, 2); } break;
        default: if (st.ms === 'guard' && st.landed) st.landed = false;
      }
      const ropeMode = st.ms === 'rope';
      R.root.position.x = ropeMode ? rootX : damp(R.root.position.x, rootX, st.ms === 'ropeTell' ? 6 : 4, dt);
      R.root.position.z = ropeMode ? rootZ : damp(R.root.position.z, rootZ, 5, dt);
      R.body.position.y = damp(R.body.position.y, bodyY, ropeMode ? 30 : 8, dt); R.body.rotation.x = damp(R.body.rotation.x, bodyRX, 10, dt); R.body.rotation.z = bodyRZ;
      R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, arm[i][0], 12, dt); a.sh.rotation.y = damp(a.sh.rotation.y, arm[i][1], 12, dt); });
      for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    }
    if (R.lanternLight) R.lanternLight.intensity = damp(R.lanternLight.intensity, lanI * 2 + 2, 10, dt);
    if (C.lanGlow) { C.lanGlow.material.opacity = lanGlow * 0.55; const s = 1 + lanGlow * 0.5; C.lanGlow.scale.set(s, s, s); C.lanGlow.quaternion.copy(C.cam.quaternion); R.lantern.getWorldQuaternion(V3q).invert(); C.lanGlow.quaternion.premultiply(V3q); }
  }
  const V3q = new THREE.Quaternion();
  function tells(st, dt) {
    const P = PH[st.phase], pulse = 0.55 + 0.3 * Math.sin(st.t * 26);
    // LANTERN SWEEP: faint pulsing floods on the lit lanes through the tell, full floods + light cones from the lantern during the sweep
    const fl = [0, 0, 0]; if (st.ms === 'sweepTell') for (const l of st.lit) fl[l + 1] = (0.08 + 0.16 * clamp(st.mt / st.mdur, 0, 1)) * (0.7 + 0.3 * Math.sin(st.t * 20)); if (st.ms === 'sweep') for (const l of st.lit) fl[l + 1] = 0.3 + 0.06 * Math.sin(st.t * 30);
    C.floods.forEach((f, i) => { f.material.opacity = damp(f.material.opacity, fl[i], 18, dt); f.visible = f.material.opacity > 0.01; });
    C.R.lantern.getWorldPosition(V);
    C.cones.forEach((c) => { const on = st.ms === 'sweep' && st.lit.includes(c.userData.l); c.visible = on; if (!on) return; V2.set(sx(c.userData.l), 0, 0.6); const d = V2.clone().sub(V), len = d.length();
      c.scale.set(1.2, len, 1.2); c.position.copy(V).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V3.set(0, -1, 0), d.normalize()); c.material.opacity = 0.08 + 0.03 * Math.sin(st.t * 30); });
    // ECTO-BROADSIDE: the next volley's lanes flash (from the end of the tell), the guns' touch-holes glow, the guns recoil
    const warn = [0, 0, 0];
    if (st.ms === 'broadTell') { for (const g of C.guns) { g.userData.glow.material.opacity = 0.35 + 0.35 * (Math.sin(st.t * 20) * 0.5 + 0.5); } if (st.mdur - st.mt < P.gap) for (const l of st.vol[0]) warn[l + 1] = pulse; }
    else if (st.ms === 'broad') { const nx = st.vol[st.volI]; if (nx) for (const l of nx) warn[l + 1] = pulse * (1.2 - clamp(st.volT / P.gap, 0, 1) * 0.4); C.guns.forEach((g, i) => { g.userData.glow.material.opacity = warn[i] ? 0.9 : 0.15; }); }
    else C.guns.forEach((g) => { g.userData.glow.material.opacity = damp(g.userData.glow.material.opacity, 0, 8, dt); });
    C.guns.forEach((g, i) => { g.position.z = damp(g.position.z, GZ, 6, dt); g.userData.glow.visible = g.userData.glow.material.opacity > 0.01; });
    if (st.ms === 'broad' && st.volT > P.gap - 0.05) for (const l of (st.vol[st.volI - 1] || [])) C.guns[l + 1].position.z = GZ + 0.4;
    C.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 24, dt); l.visible = l.material.opacity > 0.01; });
    // RIGGING SWING: the shadow arc on the deck + a glowing chest-height arc + the rope from the main yard to his hands
    const rOn = st.ms === 'ropeTell' || st.ms === 'rope'; C.arc.visible = C.arcG.visible = rOn && !st.over;
    if (rOn) { const k = st.ms === 'ropeTell' ? clamp(st.mt / st.mdur, 0, 1) : 1; C.arc.material.opacity = 0.35 + 0.35 * k; C.arcG.material.opacity = st.ms === 'ropeTell' ? (0.25 + 0.4 * k) * (0.7 + 0.3 * Math.sin(st.t * 22)) : 0.15; C.arc.scale.x = C.arcG.scale.x = st.ropeDir; }
    C.rope.visible = rOn && !st.over; if (C.rope.visible) { C.R.root.getWorldPosition(V); V.y += 2.5 + C.R.body.position.y; const d = V2.copy(C.ropeTop).sub(V), len = d.length(); C.rope.scale.set(1, len, 1); C.rope.position.copy(V).addScaledVector(d, 0.5); C.rope.quaternion.setFromUnitVectors(V3.set(0, 1, 0), d.normalize()); }
    // the ghostly vignette while Harold stands in the lantern light
    const inL = st.ms === 'sweep' && st.lit.includes(st.lane) && !st.over; C.ghostV.style.opacity = inL ? '1' : '0';
    // "SOLID! SWING!" tag while he can be hit
    const sol = (st.ms === 'open' || st.ms === 'flared') && !st.over; if (C.solidTag.__on !== sol) { C.solidTag.__on = sol; C.solidTag.style.display = sol ? 'block' : 'none'; }
    // the "!" over the captain on every tell
    const bang = ['sweepTell', 'broadTell', 'ropeTell'].includes(st.ms) && !st.over;
    if (bang) { V3.set(C.R.root.position.x, 3.5, C.R.root.position.z).project(C.cam); C.bang.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; C.bang.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; }
    if (C.bang.__on !== bang) { C.bang.__on = bang; C.bang.style.display = bang ? 'block' : 'none'; }
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.stop > 0 ? 0.15 : st.slow), t = st.t;
    const H = C.H; const hx = sx(st.lane) * 0.95;
    H.root.position.set(damp(H.root.position.x, hx, 18, dt), 0, 0); H.root.rotation.y = 0; applyPose(H, haroldPose(st, t), 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); H.mat.userData.flashC && H.mat.userData.flashC.value.set(st.ms === 'sweep' ? '#7dffc8' : '#ffffff'); H.mat.userData.flash.value = C.hflash * 0.8; }
    if (C.hLan.visible) { C.hLan.position.set(H.root.position.x + 0.35, st.flareT < 0.85 ? 2.5 : 2.1, 0.3); }
    const M = C.M; M.root.position.set(-3.4, 0, 2.2); M.root.rotation.y = 0.9; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseCap(st, dt); tells(st, dt);
    for (const P of C.phantoms) if (!st.won) { P.g.position.y = 1.15 + Math.sin(t * 1.7 + P.ph) * 0.2; P.g.position.x = P.x + Math.sin(t * 0.6 + P.ph) * 0.15; }
    DUELS.hot(st.pow >= 1 && !st.over);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 1.6);
    // camera: low behind Harold, the captain + the guns + the mast filling the frame; portrait pulls back and up
    const port = VH() > VW(); C.cam.fov = port ? 68 : 52; C.cam.updateProjectionMatrix();
    V.set(0.5 + H.root.position.x * 0.35, port ? 2.9 : 2.5, port ? -4.6 : -3.7); V2.set(H.root.position.x * 0.2, port ? 2.2 : 2.4, MZ);
    if (st.ms === 'intro' && st.phase === 0 && st.t < 3) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(-3.8, 5.5, 12), V, k); V2.lerpVectors(V3.set(0, 2.2, MZ), V2, k); }
    if (st.ms === 'rope' || (st.ms === 'open' && st.landed)) { V.z -= 0.6; V.y += 0.2; V2.z = 2.6; }
    if (st.flareT >= 0) { V.set(-3.4, 2.4, -0.4); V2.set(0, 2.0, MZ - 1.0); }
    if (st.ms === 'ko') { V.set(-1.6, 2.6, 0.2); V2.set(0, 1.4, MZ); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
    C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 16; OUT_U.fogF.value = 60;
  };
  C.onResize = () => {};

  // ---------------- test bot: win = reads every tell; mash = SWING only, never dodges; lose = stands still ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt;
    if (B.mode === 'mash') { if (B.cd <= 0) { B.a = true; B.cd = 0.25; } return; }
    const left = st.mdur - st.mt, P = PH[st.phase];
    const toLane = (l) => l; // B.mx -1 / 0 / 1 maps straight to the lane
    if (st.ms === 'sweepTell' && left < 0.5 || st.ms === 'sweep') { const safe = [-1, 0, 1].find((l) => !st.lit.includes(l)); B.mx = toLane(safe); }
    if (st.ms === 'ropeTell' && left < 0.2 || st.ms === 'rope' && st.mt < 0.6) B.bh = true;
    if (st.ms === 'broadTell' || st.ms === 'broad') { const pend = C.balls.filter((b) => !b.hit).map((b) => b.l), next = st.ms === 'broadTell' ? st.vol[0] : (st.vol[st.volI] || []); const bad = new Set([...pend, ...(st.ms === 'broadTell' && left > P.gap ? [] : next)]);
      const safe = [st.lane, 0, 1, -1].find((l) => !bad.has(l)); B.mx = safe === undefined ? st.lane : safe; }
    if (st.pow >= 1 && st.ms === 'open' && B.cd <= 0) { B.c = true; B.cd = 0.5; }
    else if ((st.ms === 'open' || st.ms === 'flared') && B.cd <= 0 && st.flareT < 0) { B.a = true; B.cd = 0.26; }
  };
  DUELS.reg('cobblestone', C);

  // ---------------- the city side: the ring on the Constellation's pier beside the gangway, night only; REMATCH once cleared; ?cobblestone=1 ----------------
  const L = LANDMARKS.find((l) => l.id === 'constellation');
  const RX = -36.4, RZ = -18; // pier p1 (x -40..-35), alongside the ship (the boss anchor x -31 is on the hull over the water)
  if (L && L.boss) { DUELS.addTrigger('cobblestone', L, RX, RZ, RX - 1.6, RZ + 2.2, '#5affb0');
    const act = ACTIONS[ACTIONS.length - 1]; C.act = act; const night = () => NIGHT.value > 0.5 || Q.has('cobblestonenight');
    Object.defineProperty(act, 'label', { get: () => (night() ? (L.boss.cleared ? 'REMATCH CAPTAIN' : 'FIGHT CAPTAIN') : 'CAPTAIN: AFTER DARK'), configurable: true });
    act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
    act.go = () => { if (!night()) { banner('THE CAPTAIN ONLY HAUNTS AFTER DARK. COME BACK AT NIGHT.', 2.4); return; } DUELS.start('cobblestone'); };
    const bm = DUELS.BEAM.list[DUELS.BEAM.list.length - 1]; if (bm) bm.L = { boss: { get cleared() { return false; } } }; } // keep the ring lit for rematches
  let n = 0; MODE.ticks.push(() => { n++; if (n === 3 && Q.has('cobblestone') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('cobblestoneauto'); DUELS.start('cobblestone', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__cobblestone = C; C.PH = PH;
})();

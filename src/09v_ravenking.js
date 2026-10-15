
// ======================= THE RAVEN KING, M&T STADIUM: the "Nevermore" blitz on the field (boss 12; DESIGN.md boss list + handoff/BOSS_GANG_UPGRADE_PLAN.md #12).
// A set piece on the duel core (09a: MODE.duel, the shared HUD, RETRY / LEAVE, radio duck, panel relabel, exit back to the street).
// The arena: the stadium's own field under the night lights (an ORIGINAL homage: no team names, logos or real people; generic purple/black/gold
// crowd, an original crowned raven, the end zone + scoreboard read "NEVERMORE"). The Raven King (a giant crowned raven linebacker in shoulder pads)
// holds his end of the field; Harold fights from midfield, Mavis cheers on the sideline. Every attack is telegraphed >= 1.0 s (a "!" card + a ground decal):
//   NEVERMORE BLITZ: he drops into a three-point stance (ref whistle) and a black FEATHER TRAIL runs from him through Harold. The trail follows
//              Harold for the first 60% of the tell, then LOCKS (turns red) and he charges straight down it. Sidestep off the trail (or hop late).
//   FEATHER FUMBLE: he caws, a crow swarm circles over Harold and its SHADOW chases him, then locks and the swarm dives. Caught = the crows knock
//              the cane loose: MASH SWING to grab it back (6 taps in 2.4 s) or take an extra peck. Then he swoops down to gloat.
//   SHOULDER-PAD SACK: he leaps sky-high; his LANDING SHADOW (red ring) grows under Harold, follows, then locks; he slams down with a turf shockwave.
//              Get out of the ring (a hop at the landing also clears the shockwave).
//   After every attack he is OPEN where he ended up (winded after the blitz, pads stuck in the turf after the sack, showboating after the swarm):
//   the first ~1.2 s are gold crits. Then he struts back to his end. Phase 3 chains two attacks per visit.
// Harold: stick moves, SWING = 3-hit cane combo (3rd = the "BLINDSIDE" overhead), JUMP = dodge hop (short i-frames). POWER fills from hits and
// clean dodges; when full ACT = the team-up special HAIL MAVIS: Mavis tosses Harold her purse and he throws it in a slow-mo spiral downfield
// into the Raven King (big damage, dizzy). 3 phases (boss HP 175, phases at 2/3 and 1/3 (raised from 100 after QA: bots won in ~31 s), Mavis patches Harold up a little at each phase change).
// KO: flattened in the end zone, feathers rain as confetti, the scoreboard flips "NEVERMORE" to "EVERMORE". Win = DUELS.bossCleared('ravens')
// -> BOSS_CLEAR.clear('ravens') (M&T district crime -> 0) + a star grade by hits taken. Lose = RETRY / LEAVE.
// Entry: ACT "FIGHT RAVEN" ring at the stadium's boss anchor (LANDMARKS 'ravens' boss {x:-106, z:76}: midfield on the
// city stadium's own grass, walk in through the east-stand gap: REAL landmark anchor). DESIGN gates this fight behind the Poe night's Nevermore Feather; Poe night is not built yet,
// so the gate is a hook: if window.hasNevermoreFeather is a function and returns false, the ring shows "NEED THE FEATHER" and won't start.
// Tests: ?ravenking=1 starts the fight at load, &ravenkingauto=win|lose|mash plays it by itself (also ?duel=ravenking&duelbot=...). ?ravenkingphase=N.
// Writing: Grok's GR1 raven_king intro/defeat lines + the GR10 clear banner (hawk-relay content), embedded below; taunts are Hark placeholders.
//
// Rig hook (Opus O5-O7): if window.buildRavenKing exists it is called as buildRavenKing({ THREE, toonMat, outlineMat, addOdir, QUAL }) and must return
//   { root, body?, head?, armL?, armR?, flash?: [materials], update?(dt, mode, info) }
//   root: Object3D, origin on the ground between his talons, facing +z (toward Harold / the camera), about 3.4 m tall.
//   armL / armR: wing-arm shoulder pivots (rest pose hangs down). head: neck pivot. body: everything above the legs (lean pivot at the hips).
//   update(dt, mode, info) (optional) is called every frame; if present the mode skips its own part animation. mode is one of
//     'idle' | 'stance' (blitz tell, three-point stance) | 'blitz' (charging) | 'caw' (swarm call, wings up) | 'leap' (airborne) | 'land'
//     | 'open' (winded / showboating) | 'swoop' | 'strut' (walking back) | 'hurt' | 'dizzy' | 'ko' (flattened) | 'win' (Harold lost; end-zone dance);
//     info = { t, u (0..1 through the current move), hp (0..1), y (height off the ground) }.
//   Missing optional pieces are skipped; otherwise the procedural stand-in below is used.
(function () {
  const GR = { intro: ['Nevermore will you cross my field!', 'Hut! Hut! Hike up those pants, toad!', 'Shoulder pads on. Mercy off.'],
    taunt: ['Caw! That\u2019s a fifteen-yard penalty on your face.', 'Read the feathers, old toad. Or don\u2019t.', 'My flock covers the whole field.', 'Fourth and long, Harold. Fourth and LONG.', 'Nevermore! Nevermore! NEVERMORE!', 'You call that a cane? I call it a fumble.'],
    hurt: ['Caw! Roughing the raven!', 'My feathers! Those were pressed!', 'Flag! Somebody throw a flag!'],
    defeat: ['Nevermore... means me now...', 'I got sacked by a senior...', 'Flag on the play. Me. I\u2019m the flag.'],
    clear: 'THE RAVEN KING FALLS!' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const dampA = (a, b, r, dt) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * (1 - Math.exp(-r * dt)); };
  // ---------------- tuning ----------------
  const XL = 7.5, Z0 = -4.0, Z1 = 7.0; // Harold's box on the field
  const BX = 8.5, BZ0 = -9.0, BZ1 = 7.6, HOMEZ = -8.0; // the Raven King's box + his spot at his end
  const REACH = 2.1, SPD = 5.6, HP0 = 100, BHP0 = 175, BLITZ_V = 19;
  const DMG = { blitz: 12, swarm: 5, peck: 7, sack: 12 };
  const HIT = [3, 3, 6], CRIT = 1.5, POW_HIT = 5, POW_DODGE = 12, HAIL_DMG = 30, PATCH = 18;
  const PH = [ // per phase: tell secs (>= 1.0), open window, attacks per visit
    { tell: 1.4, win: 3.3, n: 1 }, { tell: 1.2, win: 2.9, n: 1 }, { tell: 1.05, win: 2.5, n: 2 }];
  const S = { scene: null, cam: null, title: 'THE RAVEN KING', pips: 3,
    hint: '<b>WASD</b> move · <b>J</b> swing · <b>K</b> dodge hop · <b>E</b> HAIL MAVIS when POWER is full',
    labels: { a: 'SWING', b: 'HOP', c: 'POWER', l: '', r: '' } };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), M4 = new THREE.Matrix4(), E3 = new THREE.Euler(), Q4 = new THREE.Quaternion(), C3 = new THREE.Color();

  // ---------------- textures (canvas only; original art, no team marks) ----------------
  function fieldTex() { return canvasTex(256, 256, (g, w, h) => { for (let k = 0; k < 2; k++) { g.fillStyle = k ? '#2f8a3a' : '#38a046'; g.fillRect(0, k * 128, w, 128); }
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,40,0,' + rnd(0.03, 0.1).toFixed(2) + ')'; g.fillRect(rnd(0, w), rnd(0, h), 2, rnd(2, 6)); }
    g.fillStyle = 'rgba(255,255,255,.92)'; for (const y of [0, 128]) g.fillRect(0, y, w, 5); for (const y of [32, 64, 96, 160, 192, 224]) for (const x of [80, 172]) g.fillRect(x, y, 4, 12);
    g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); }, 256); }
  function endzoneTex(txt) { return canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#2a1650'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 12, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 64px ' + FONT;
    g.lineWidth = 8; g.strokeStyle = '#14101f'; g.strokeText(txt, w / 2, h / 2 + 4); g.fillStyle = '#e8c04a'; g.fillText(txt, w / 2, h / 2 + 4); }, 512); }
  function boardDraw(g, w, h, top, sub, gold) { g.fillStyle = '#0a0812'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 * 3; x < w; x += 6) g.fillRect(x, y, 3, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = gold ? '#ffd23c' : '#ff9a2a'; g.shadowBlur = 18; g.fillStyle = gold ? '#ffe680' : '#ffb04a'; g.font = '900 72px ' + FONT; g.fillText(top, w / 2, h * 0.42);
    g.shadowBlur = 8; g.font = '700 26px ' + FONT; g.fillStyle = '#c8b8ff'; g.fillText(sub, w / 2, h * 0.82); g.shadowBlur = 0; }
  function trailTex() { return canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); // feather chevrons pointing down the charge (+v)
    for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(20,10,34,.95)'; g.beginPath(); g.moveTo(w / 2, y + 30); g.quadraticCurveTo(w - 4, y + 12, w - 10, y + 2); g.lineTo(w / 2, y + 14); g.lineTo(10, y + 2); g.quadraticCurveTo(4, y + 12, w / 2, y + 30); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.fillRect(w / 2 - 1, y + 6, 2, 22); }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); }, 256); }
  function ringTex(c) { return canvasTex(128, 128, (g) => { g.strokeStyle = c; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke(); g.globalAlpha = 0.3; g.fillStyle = c; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill(); }, 128); }
  function featherTex() { return canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(54, 30, 32, 60); g.quadraticCurveTo(10, 30, 32, 4); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(31, 8, 2, 50); }, 64); }

  // ---------------- the stand-in Raven King: a giant crowned raven linebacker ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group() }, mat = toonMat(); R.flash = [mat];
    const BLK = '#1c1626', BLK2 = '#2a2236', JER = '#3c2470', JER2 = '#2a1858', PAD = '#3a3a46', GOLD = '#e8b83a', BEAK = '#3a3640', TAL = '#c8a040', EYE = '#ff3046';
    R.body = new THREE.Group(); R.body.position.y = 0.95; R.root.add(R.body);
    const L = K(); // legs + talons stay planted (not under the lean pivot)
    for (const s of [-1, 1]) L.add(G.cyl(0.12, 0.1, 0.95, 8), '#2a2430', s * 0.38, 0.48, 0).add(G.box(0.5, 0.1, 0.36), TAL, s * 0.38, 0.05, 0.18).add(G.cone(0.06, 0.32, 5), TAL, s * 0.38 + 0.14, 0.05, 0.42, Math.PI / 2, 0, 0).add(G.cone(0.06, 0.32, 5), TAL, s * 0.38 - 0.14, 0.05, 0.42, Math.PI / 2, 0, 0)
      .add(G.cyl(0.2, 0.16, 0.24, 8), '#f2f2f2', s * 0.38, 0.78, 0); // white sock tops
    L.mesh(mat, R.root);
    const B = K();
    B.add(G.sph(1.0, 18, 14), BLK, 0, 0.75, 0, 0, 0, 0, 1.0, 1.12, 0.9) // the barrel body
      .add(G.cyl(1.04, 0.92, 1.05, 18), JER, 0, 0.7, 0) // jersey
      .add(G.cyl(1.06, 1.06, 0.12, 18), '#f0eadc', 0, 0.38, 0).add(G.cyl(1.06, 1.06, 0.07, 18), GOLD, 0, 0.5, 0) // hem stripes
      .add(G.box(0.62, 0.62, 0.05), '#f0eadc', 0, 0.85, 0.93).add(G.box(0.46, 0.46, 0.06), JER2, 0, 0.85, 0.95) // a plain chest patch (no number, no mark)
      .add(G.cone(0.14, 0.34, 4), GOLD, 0, 0.92, 0.99, Math.PI / 2, 0, Math.PI / 4) // a gold crown pip on the patch: his own crest
      .add(G.sph(0.75, 14, 10), PAD, 0, 1.5, 0, 0, 0, 0, 1.6, 0.42, 1.05) // shoulder-pad dome
      .add(G.box(0.7, 0.14, 0.8), '#d8d4e0', -0.85, 1.62, 0, 0, 0, 0.35).add(G.box(0.7, 0.14, 0.8), '#d8d4e0', 0.85, 1.62, 0, 0, 0, -0.35) // pad caps
      .add(G.cone(0.42, 0.9, 6), BLK2, 0, 0.55, -0.9, -2.0, 0, 0).add(G.cone(0.3, 0.8, 6), BLK, -0.28, 0.5, -0.85, -2.1, 0.3, 0).add(G.cone(0.3, 0.8, 6), BLK, 0.28, 0.5, -0.85, -2.1, -0.3, 0) // tail feathers
      .add(G.cyl(0.42, 0.5, 0.5, 12), BLK, 0, 1.75, 0.12); // neck ruff
    B.mesh(mat, R.body);
    R.head = new THREE.Group(); R.head.position.set(0, 2.0, 0.2); R.body.add(R.head);
    const Hd = K();
    Hd.add(G.sph(0.58, 16, 12), BLK, 0, 0.42, 0, 0, 0, 0, 1, 1.0, 1.08)
      .add(G.cone(0.2, 0.85, 8), BEAK, 0, 0.32, 0.88, Math.PI / 2, 0, 0, 1.15, 1, 0.75).add(G.cone(0.08, 0.2, 6), GOLD, 0, 0.32, 1.32, Math.PI / 2, 0, 0) // big hooked beak, gold tip
      .add(G.box(0.9, 0.06, 0.06), '#9a98a8', 0, 0.2, 0.62).add(G.box(0.06, 0.32, 0.06), '#9a98a8', -0.24, 0.32, 0.63).add(G.box(0.06, 0.32, 0.06), '#9a98a8', 0.24, 0.32, 0.63) // facemask bars (no helmet shell, no decal)
      .add(G.sph(0.12, 8, 6), '#ffe8e0', -0.26, 0.55, 0.46).add(G.sph(0.12, 8, 6), '#ffe8e0', 0.26, 0.55, 0.46)
      .add(G.sph(0.07, 6, 4), EYE, -0.26, 0.55, 0.56).add(G.sph(0.07, 6, 4), EYE, 0.26, 0.55, 0.56)
      .add(G.box(0.3, 0.07, 0.08), '#0a0810', -0.25, 0.7, 0.5, 0, 0, -0.45).add(G.box(0.3, 0.07, 0.08), '#0a0810', 0.25, 0.7, 0.5, 0, 0, 0.45) // angry brows
      .add(G.cyl(0.36, 0.42, 0.28, 10), GOLD, 0, 1.0, -0.04); // crown band
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; Hd.add(G.cone(0.09, 0.3, 4), GOLD, Math.sin(a) * 0.36, 1.27, -0.04 + Math.cos(a) * 0.36); }
    Hd.add(G.sph(0.08, 8, 6), '#9a4aff', 0, 1.02, 0.36); // crown gem
    for (let i = 0; i < 3; i++) Hd.add(G.cone(0.08, 0.36, 4), BLK2, -0.12 + i * 0.12, 0.92, -0.42, -0.9, 0, 0); // crest feathers out the back
    Hd.mesh(mat, R.head);
    const wing = (s) => { const sh = new THREE.Group(); sh.position.set(s * 1.12, 1.5, 0); R.body.add(sh);
      const A = K(); A.add(G.sph(0.3, 10, 8), PAD, 0, 0, 0).add(G.box(0.24, 1.35, 0.75), BLK, s * 0.05, -0.72, 0);
      for (let k = 0; k < 4; k++) A.add(G.cone(0.13, 0.55, 4), k % 2 ? BLK2 : BLK, s * 0.05, -1.45, -0.27 + k * 0.18, Math.PI, 0, 0); // primary feathers = fingers
      A.mesh(mat, sh); return sh; };
    R.armL = wing(-1); R.armR = wing(1);
    return R;
  }
  function purseMesh() { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.box(0.5, 0.36, 0.2), '#d8406a', 0, 0, 0).add(G.tor(0.17, 0.03, Math.PI, 4, 10), '#5a1a2a', 0, 0.18, 0).add(G.box(0.12, 0.08, 0.22), '#ffd23c', 0, 0.06, 0); return K.mesh(toonMat(), null); }
  function caneMesh() { const K = DUELS.kit(), G = DUELS.GEO; K.add(G.cyl(0.035, 0.035, 0.95, 6), '#6a3a1a', 0, 0, 0).add(G.tor(0.09, 0.03, Math.PI, 4, 8), '#6a3a1a', 0.09, 0.47, 0); return K.mesh(toonMat(), null); }

  // ---------------- build ----------------
  S.build = function () {
    const sc = (S.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#1a1030', 34, 96); sc.background = new THREE.Color('#130b24');
    S.cam = new THREE.PerspectiveCamera(52, VW() / VH(), 0.1, 200);
    DUELS.sceneLights(sc, '#dcd8ff', '#2a2440', 1.15, '#fffbea', 1.5, new THREE.Vector3(0.35, 1, 0.55));
    const K = DUELS.kit(), G = DUELS.GEO;
    // the field: striped turf + yard lines, an end zone behind him, a sideline band
    const ft = fieldTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1, 6);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(26, 48), new THREE.MeshLambertMaterial({ map: ft })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 6); sc.add(fl);
    const ez = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), new THREE.MeshLambertMaterial({ map: endzoneTex('NEVERMORE') })); ez.rotation.x = -Math.PI / 2; ez.position.set(0, 0.012, -14.5); sc.add(ez);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshLambertMaterial({ color: '#24402a' })); side.rotation.x = -Math.PI / 2; side.position.set(0, -0.02, 0); sc.add(side);
    // goalpost (generic yellow), the bowl (3 tiers of stands in a ring), light towers, the scoreboard frame
    K.add(G.cyl(0.14, 0.14, 3.2, 8), '#ffd23c', 0, 1.6, -18.2).add(G.box(6.4, 0.22, 0.22), '#ffd23c', 0, 3.2, -18.2).add(G.cyl(0.1, 0.1, 6, 8), '#ffd23c', -3.1, 6.2, -18.2).add(G.cyl(0.1, 0.1, 6, 8), '#ffd23c', 3.1, 6.2, -18.2)
      .add(G.box(0.5, 1.4, 0.5), '#3c2470', 0, 0.7, -18.2);
    const segs = 30; S.crowd = [];
    for (let i = 0; i < segs; i++) { const a = (i + 0.5) / segs * TAU, ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < 3; k++) { const rx = 17.5 + k * 3.2, rz = 25 + k * 3.2, x = sa * rx, z = ca * rz + 2, hh = 1.6 + k * 2.4, wd = (TAU * (rx + rz) / 2) / segs + 0.4;
        K.add(G.box(wd, hh, 3.1), k % 2 ? '#3a3448' : '#4a4458', x, hh / 2, z, 0, a, 0); S.crowd.push({ x, z, y: hh, a, wd }); } }
    for (const [x, z] of [[-19, -22], [19, -22], [-19, 26], [19, 26]]) K.add(G.cyl(0.35, 0.5, 22, 8), '#3a3a44', x, 11, z).add(G.box(5, 2.4, 0.6), '#2a2a34', x, 22.6, z, 0, Math.atan2(-x, -z + 2), 0);
    K.add(G.box(16, 6.4, 0.8), '#1a1824', 0, 19, -31.5).add(G.box(0.6, 16, 0.6), '#2a2a34', -5, 8, -31.6).add(G.box(0.6, 16, 0.6), '#2a2a34', 5, 8, -31.6);
    S.stage = K.mesh(toonMat(), sc, 0.003);
    // light banks (one basic mesh) + glows (additive quads, one instanced draw)
    { const L2 = DUELS.kit(); for (const [x, z] of [[-19, -22], [19, -22], [-19, 26], [19, 26]]) L2.add(G.box(4.4, 1.8, 0.3), '#fffbe8', x, 22.6, z + (z < 0 ? 0.4 : -0.4), 0, Math.atan2(-x, -z + 2), 0);
      S.lightBanks = L2.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), sc, 0); }
    // crowd: instanced little fans in the stands, generic purple / black / white / gold (one draw call)
    { const n = S.crowd.length * 7, fans = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.7, 0.4), new THREE.MeshLambertMaterial(), n); let j = 0; const cols = ['#5a3a9a', '#1c1626', '#f0eadc', '#e8b83a', '#3c2470', '#7a5ac8'];
      for (const s of S.crowd) for (let k = 0; k < 7; k++) { const off = (k - 3) / 7 * s.wd; V.set(s.x + Math.cos(s.a) * off, s.y + 0.36, s.z - Math.sin(s.a) * off); E3.set(0, s.a, 0); Q4.setFromEuler(E3); M4.compose(V, Q4, V2.set(1, rnd(0.85, 1.2), 1)); fans.setMatrixAt(j, M4); fans.setColorAt(j, C3.set(cols[(j * 7 + k) % cols.length])); j++; }
      fans.count = j; fans.instanceMatrix.needsUpdate = true; if (fans.instanceColor) fans.instanceColor.needsUpdate = true; sc.add(fans); S.fans = fans; S.fanBase = []; for (let i = 0; i < j; i++) { fans.getMatrixAt(i, M4); S.fanBase.push(M4.clone()); } }
    // the scoreboard: NEVERMORE, flips to EVERMORE on the KO
    { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; S.board = { cv, g: cv.getContext('2d') }; S.boardTex = new THREE.CanvasTexture(cv); if ('colorSpace' in S.boardTex) S.boardTex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 5.6), new THREE.MeshBasicMaterial({ map: S.boardTex, fog: false })); m.position.set(0, 19, -31.05); sc.add(m); S.boardMesh = m; boardSet('NEVERMORE', 'QTR 1 · HAROLD vs THE RAVEN KING', false); }
    // telegraph decals: the blitz feather trail (2), swarm shadow, sack shadow + ring, the shockwave ring
    const tt = trailTex(); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; S.trailT = tt;
    S.trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tt, transparent: true, opacity: 0, depthWrite: false, fog: false, color: '#ffffff' })); S.trail.renderOrder = 4; S.trail.visible = false; sc.add(S.trail);
    const dotT = DUELS.dot('#000', false), deco = (map, ro) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = ro; m.visible = false; sc.add(m); return m; };
    S.shadow = deco(dotT, 5); S.ring = deco(ringTex('#ff3d6e'), 6); S.wave = deco(ringTex('#fff2c0'), 6); S.swarmSh = deco(dotT, 5); S.swarmRing = deco(ringTex('#b48cff'), 6);
    // the crow swarm (instanced, one draw)
    { const g = new THREE.ConeGeometry(0.16, 0.6, 3); g.rotateX(Math.PI / 2); g.scale(1.6, 0.35, 1); S.crows = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#141018' }), 26); S.crows.count = 0; S.crows.frustumCulled = false; sc.add(S.crows);
      S.crowSeed = Array.from({ length: 26 }, (_, i) => ({ a: i / 26 * TAU, r: rnd(0.6, 1.0), h: rnd(-0.5, 0.5), s: rnd(0.8, 1.3) })); }
    // props: Mavis's purse (HAIL MAVIS), the fumbled cane
    S.purse = purseMesh(); S.purse.visible = false; sc.add(S.purse); S.dropCane = caneMesh(); S.dropCane.visible = false; sc.add(S.dropCane);
    // fx: feathers / turf / sparkle (instanced, per-instance colour, one draw call)
    S.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }), 140);
    S.fx.count = 0; S.fx.frustumCulled = false; S.fx.renderOrder = 8; for (let i = 0; i < 140; i++) S.fx.setColorAt(i, C3.set('#fff')); sc.add(S.fx); S.fxs = [];
    // Harold, Mavis, the Raven King
    S.H = buildHero(); sc.add(S.H.root); S.M = buildHero({ wife: true }); sc.add(S.M.root);
    S.cane = S.H.cane || S.H.swR || (S.H.J && S.H.J.swR) || null; S.bag = S.M.swR || (S.M.J && S.M.J.swR) || null; // the cane / Mavis's handbag (hidden while fumbled / thrown)
    let rig = null; try { if (typeof window.buildRavenKing === 'function') rig = window.buildRavenKing({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    S.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'head', 'armL', 'armR']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.root.add(rig[k]); }
    rig.flash = rig.flash || []; S.R = rig; sc.add(rig.root);
    S.base = { aL: rig.armL.rotation.clone(), aR: rig.armR.rotation.clone(), hd: rig.head.rotation.clone(), by: rig.body.position.y };
    // extra HUD: POWER meter + hit pops + the "!" (inside the duel HUD, this fight only)
    const css = document.createElement('style'); css.textContent = `
      #ravenui { position: absolute; inset: 0; display: none; pointer-events: none; }
      body.duel-ravenking #ravenui { display: block; }
      #ravenui .pw { position: absolute; left: 10px; bottom: 34px; font-size: 10px; text-shadow: 2px 2px 0 #14101f; }
      #ravenui .pw .t { width: 150px; height: 12px; background: #14101f; border: 2px solid #14101f; box-shadow: 3px 3px 0 #14101f; border-radius: 6px; position: relative; overflow: hidden; margin-top: 3px; }
      #ravenui .pw .t i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #b48cff, #ffffff 50%, #b48cff); border-radius: 4px; }
      #ravenui .pw.full .n { color: #ffd23c; animation: rvpw .3s infinite alternate; } @keyframes rvpw { from { opacity: 1; } to { opacity: .45; } }
      #ravenui .pop { position: absolute; left: 0; top: 0; font-size: 16px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; white-space: nowrap; opacity: 0; transform: translate(-50%, -50%); }
      #ravenui .pop.c { color: #ffd23c; font-size: 20px; } #ravenui .pop.w { color: #c8a8ff; font-size: 18px; }
      #ravenui .bang { position: absolute; left: 0; top: 0; font-size: 30px; color: #ffd23c; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; opacity: 0; transform: translate(-50%, -100%); }
      #ravenui .mash { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); font-size: 22px; color: #ffd23c; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; opacity: 0; text-align: center; }
      #ravenui .mash .m { display: block; margin: 8px auto 0; width: 160px; height: 12px; background: #14101f; border: 2px solid #14101f; border-radius: 6px; overflow: hidden; }
      #ravenui .mash .m i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #ffd23c, #fff); }
      body.duel-ravenking #duel .dtell { top: 64%; white-space: normal; max-width: 88vw; text-align: center; line-height: 1.4; }
      @media (max-width: 480px) { #ravenui .pw .t { width: 120px; } #ravenui .pop { font-size: 13px; } #ravenui .pop.c { font-size: 16px; } #ravenui .mash { font-size: 18px; } }`;
    document.head.appendChild(css);
    const ui = document.createElement('div'); ui.id = 'ravenui'; ui.innerHTML = '<div class="pw"><div class="n">POWER</div><div class="t"><i></i></div></div><div class="bang">!</div><div class="mash">MASH SWING!<span class="m"><i></i></span></div>' + '<div class="pop"></div>'.repeat(8);
    DUELS.hudEl.appendChild(ui);
    S.ui = { el: ui, pw: ui.querySelector('.pw'), pwBar: ui.querySelector('.pw .t i'), bang: ui.querySelector('.bang'), mash: ui.querySelector('.mash'), mashBar: ui.querySelector('.mash .m i'), pops: [...ui.querySelectorAll('.pop')].map((el) => ({ el, t: 0, p: new THREE.Vector3() })), popI: 0 };
  };
  function boardSet(top, sub, gold) { if (!S.board) return; boardDraw(S.board.g, 512, 192, top, sub, gold); S.boardTex.needsUpdate = true; S.boardTop = top; }

  // ---------------- state ----------------
  function reset(phase = 0) {
    const st = S.st = { t: 0, phase, hp: HP0, bhp: [BHP0, BHP0 * 2 / 3, BHP0 / 3][phase], bs: 'intro', bt: 0, bdur: 2.4, over: false, won: false, outT: 0,
      h: { x: 0, z: 4.2, vx: 0, vz: 0, yaw: Math.PI, jumpT: -1, jy: 0, inv: 0, hurtT: -1, swT: -1, swN: 0, swHit: false, queued: false, comboT: 0 },
      b: { x: 0, y: 0, z: HOMEZ, yaw: 0, fromX: 0, fromZ: HOMEZ, toX: 0, toZ: HOMEZ, flash: 0, hurtT: -1, open: 0, left: 0, last: '', sq: 1 },
      atk: null, fum: null, pow: 0, hail: null, hs: 0, slow: 1, slowT: 0, shk: 0, stats: { hitsTaken: 0, dodges: 0, landed: 0, crits: 0, hails: 0, fumbles: 0, retries: 0 } };
    clearAttackFx(); S.purse.visible = false; S.dropCane.visible = false; if (S.cane) S.cane.visible = true; S.fxs.length = 0; S.ui.mash.style.opacity = '0';
    boardSet('NEVERMORE', 'QTR ' + (phase + 1) + ' · HAROLD vs THE RAVEN KING', false);
    hud(st); return st;
  }
  function hud(st) { DUELS.bars(st.hp / HP0, Math.max(0, st.bhp) / BHP0); S.ui.pwBar.style.width = clamp(st.pow, 0, 100).toFixed(0) + '%'; S.ui.pw.classList.toggle('full', st.pow >= 100);
    DUELS.sub('QUARTER ' + (st.phase + 1) + '/3', 'HITS TAKEN ' + st.stats.hitsTaken); }
  const say = (txt, d = 2.6) => DUELS.say('THE RAVEN KING', txt, d);
  S.start = function () {
    const p0 = clamp(+(Q.get('ravenkingphase') || 1) - 1, 0, 2) | 0; reset(p0); DUELS.log.push('ravenking:' + S.rigKind);
    DUELS.banner('THE RAVEN KING<small>M&amp;T STADIUM · NEVERMORE BLITZ</small>', 2.4); say(GR.intro[0], 3.2); whistle();
    S.camP = new THREE.Vector3(0, 9, 16); S.camL = new THREE.Vector3(0, 1.5, -4);
  };
  S.retry = function () { const st = reset(0); st.stats.retries = (DUELS.retries || 0); st.bdur = 1.6; DUELS.banner('SECOND HALF<small>FRESH LEGS · FULL HEALTH</small>', 1.6); say(pick(GR.taunt), 2.4); };
  S.exit = function () { DUELS.blind(0); S.ui.bang.style.opacity = '0'; S.ui.mash.style.opacity = '0'; if (S.cane) S.cane.visible = true; };

  // ---------------- small juice helpers (local) ----------------
  function pop(p, txt, cls = '') { const P = S.ui.pops[S.ui.popI++ % S.ui.pops.length]; P.el.textContent = txt; P.el.className = 'pop ' + cls; P.t = 0.9; P.p.copy(p); }
  function burst(x, y, z, n, col, spd = 2.2, up = 2.4, life = 0.8, g = 5) { for (let k = 0; k < n && S.fxs.length < 140; k++) S.fxs.push({ p: new THREE.Vector3(x + rnd(-0.25, 0.25), y + rnd(0, 0.3), z + rnd(-0.25, 0.25)), v: new THREE.Vector3(rnd(-spd, spd), rnd(up * 0.4, up), rnd(-spd, spd)), t: 0, life: rnd(life * 0.5, life), g, c: Array.isArray(col) ? col[k % col.length] : col, spin: rnd(-6, 6) }); }
  const FEATH = ['#141018', '#2a1e3a', '#141018'], TURF = ['#3a8a3a', '#6a4a2a', '#2f7a32'], CONF = ['#141018', '#3c2470', '#e8b83a', '#f0eadc', '#7a5ac8'];
  function tone(type, f0, f1, dur, vol, t0 = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  function noise(dur, f0, f1, vol, t0 = 0) { if (!AC || AC.state !== 'running' || !NOISE) return; try { const t = AC.currentTime + t0, g = AC.createGain(), s = AC.createBufferSource(), f = AC.createBiquadFilter(); s.buffer = NOISE; f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t); s.stop(t + dur + 0.05); } catch (e) {} }
  const whistle = () => { tone('sine', 2600, 2500, 0.28, 0.06); tone('sine', 2600, 2400, 0.4, 0.05, 0.32); };
  const caw = () => { tone('sawtooth', 820, 360, 0.22, 0.07); tone('sawtooth', 760, 330, 0.26, 0.06, 0.26); noise(0.2, 3000, 800, 0.05); };
  const thud = () => { tone('sine', 120, 40, 0.4, 0.22); noise(0.45, 900, 120, 0.25); };
  const roar = () => noise(2.2, 1400, 500, 0.12);
  function tell(text, dur) { DUELS.tell('! ' + text, dur); tone('square', 660, 660, 0.12, 0.06); tone('square', 990, 990, 0.12, 0.06, 0.09); S.bangT = dur; }

  // ---------------- Harold: hurt / dodge bookkeeping ----------------
  function haroldHit(st, dmg, kind, kx = 0, kz = 0) {
    const h = st.h; if (h.inv > 0 || st.over || st.hail) return false;
    dmg = BOSSX.hurt(st, dmg); if (dmg <= 0) return false; 
    st.hp = Math.max(0, st.hp - dmg); h.inv = 1.3; h.hurtT = 0; st.stats.hitsTaken++; DUELS.hurt(); sfx('hurt'); st.shk = Math.max(st.shk, 0.4);
    pop(V.set(h.x, 2.0, h.z), '-' + dmg, ''); h.swT = -1; h.queued = false; h.vx = kx; h.vz = kz;
    if (Math.random() < 0.35) say(pick(GR.taunt), 2.0);
    hud(st); if (st.hp <= 0) lose(st); return true;
  }
  function dodged(st, what) { st.stats.dodges++; st.pow = Math.min(100, st.pow + POW_DODGE); pop(V.set(st.h.x, 2.1, st.h.z), what, 'w'); hud(st); }

  // ---------------- the Raven King's brain ----------------
  function setB(st, bs, dur) { st.bs = bs; st.bt = 0; st.bdur = dur; }
  function moveTo(st, bs, x, z, dur) { const b = st.b; b.fromX = b.x; b.fromZ = b.z; b.toX = clamp(x, -BX, BX); b.toZ = clamp(z, BZ0, BZ1); setB(st, bs, dur); }
  function chooseAttack(st) { const opts = ['blitz', 'swarm', 'sack'].filter((a) => a !== st.b.last); const a = opts[Math.floor(Math.random() * opts.length)]; st.b.last = a; return a; }
  function startAttack(st, kind) {
    const P = PH[st.phase], h = st.h; const A = st.atk = { kind, t: 0, tell: P.tell, lock: P.tell * 0.6, tx: h.x, tz: h.z, hit: false, on: false };
    if (kind === 'blitz') { A.dir = 0; A.run = 0; A.len = 10; tell('NEVERMORE BLITZ! GET OFF THE FEATHER TRAIL', P.tell); whistle(); }
    else if (kind === 'swarm') { A.lock = P.tell * 0.65; tell('FEATHER FUMBLE! OUT FROM UNDER THE CROWS', P.tell); caw(); }
    else { A.lock = P.tell * 0.55; A.sx = st.b.x; A.sz = st.b.z; tell('SHOULDER-PAD SACK! OUT OF THE RING', P.tell); sfx('jump'); }
    if (Math.random() < 0.4) say(pick(GR.taunt), 2.2);
  }
  function stepAttack(st, dt) { // returns true when the attack is over (st.b left where it ended)
    const A = st.atk, h = st.h, b = st.b; if (!A) return true; A.t += dt; const P = PH[st.phase];
    if (A.kind === 'blitz') {
      if (A.t < A.lock) { A.dir = Math.atan2(h.x - b.x, h.z - b.z); A.len = Math.hypot(h.x - b.x, h.z - b.z) + 1.6; }
      if (A.t < A.tell) return false;
      if (!A.on) { A.on = true; sfx('heavy'); st.shk = Math.max(st.shk, 0.2); A.sx = b.x; A.sz = b.z; }
      const step = BLITZ_V * dt; A.run += step; const nx = b.x + Math.sin(A.dir) * step, nz = b.z + Math.cos(A.dir) * step;
      const out = Math.abs(nx) > BX || nz < BZ0 || nz > BZ1; b.x = clamp(nx, -BX, BX); b.z = clamp(nz, BZ0, BZ1);
      if (Math.random() < 0.6) burst(b.x, 0.1, b.z, 1, TURF, 1.2, 1.6, 0.5);
      if (!A.hit && Math.hypot(h.x - b.x, h.z - b.z) < 1.4) { const kx = Math.cos(A.dir) * (h.x - b.x >= 0 ? 1 : -1); if (haroldHit(st, DMG.blitz, 'blitz', Math.cos(A.dir) * 4 * Math.sign((h.x - b.x) * Math.cos(A.dir) - (h.z - b.z) * Math.sin(A.dir)) || kx * 4, Math.sin(A.dir) * 2 + 2)) A.hit = true; }
      if (A.run >= A.len || out) { if (!A.hit && !A.dodgeSaid) dodged(st, 'JUKED HIM!'); burst(b.x, 0.2, b.z, 10, TURF, 2.2, 2.0, 0.7); A.end = 'winded'; return true; }
      return false;
    }
    if (A.kind === 'swarm') {
      if (A.t < A.lock) { A.tx = damp(A.tx, h.x, 6, dt); A.tz = damp(A.tz, h.z, 6, dt); }
      if (A.t < A.tell + 0.3) return false;
      if (!A.on) { A.on = true; caw(); burst(A.tx, 0.6, A.tz, 14, FEATH, 2.6, 2.2, 0.9, 2);
        if (Math.hypot(h.x - A.tx, h.z - A.tz) < 1.6 && haroldHit(st, DMG.swarm, 'swarm')) { A.hit = true; if (!st.over) startFumble(st); } else if (h.inv <= 0.01) dodged(st, 'NO FUMBLE!'); }
      if (st.fum) return false;
      if (A.t < A.tell + 0.9) return false;
      A.end = 'swoop'; return true;
    }
    // sack: the leap is the tell; he follows Harold until the lock, then drops on the locked spot
    if (A.t < A.lock) { A.tx = clamp(damp(A.tx, h.x, 5, dt), -BX, BX); A.tz = clamp(damp(A.tz, h.z, 5, dt), BZ0 + 2, BZ1); }
    const u = clamp(A.t / A.tell, 0, 1); b.x = lerp(A.sx, A.tx, ease(Math.min(1, u * 1.15))); b.z = lerp(A.sz, A.tz, ease(Math.min(1, u * 1.15))); b.y = u < 1 ? Math.sin(Math.min(1, u * 1.12) * Math.PI * 0.5) * 9 * (u < 0.85 ? 1 : (1 - u) / 0.15) : 0;
    if (A.t < A.tell) return false;
    if (!A.on) { A.on = true; b.y = 0; thud(); st.shk = Math.max(st.shk, 0.7); burst(b.x, 0.1, b.z, 22, TURF, 3.4, 3.0, 0.9); A.waveT = 0;
      const d = Math.hypot(h.x - b.x, h.z - b.z); if (d < 2.1 && h.jumpT < 0) { const k = 4 / Math.max(0.3, d); if (haroldHit(st, DMG.sack, 'sack', (h.x - b.x) * k || 4, (h.z - b.z) * k + 1)) A.hit = true; } else if (d < 4.5 && h.inv <= 0.01) dodged(st, d < 2.1 ? 'HOPPED IT!' : 'NOT SACKED!'); }
    A.waveT += dt; return A.t > A.tell + 0.4 + (A.end = 'stuck', 0);
  }
  function startFumble(st) { st.fum = { t: 0, n: 0, need: 6, dur: 2.4 }; st.stats.fumbles++; if (S.cane) S.cane.visible = false; const h = st.h; S.dropCane.visible = true; S.dropCane.position.set(h.x + 0.9, 0.06, h.z + 0.4); S.dropCane.rotation.set(Math.PI / 2, 0, 0.4); DUELS.tell('FUMBLE! MASH SWING TO GRAB YOUR CANE', 1.2); }
  function stepFumble(st, dt, I) {
    const F = st.fum, h = st.h; F.t += dt; h.vx = h.vz = 0; if (I.a) { F.n++; tone('square', 520 + F.n * 60, 520 + F.n * 60, 0.06, 0.05); burst(h.x + 0.9, 0.3, h.z + 0.4, 2, FEATH, 1.2, 1.4, 0.5); }
    S.ui.mash.style.opacity = '1'; S.ui.mashBar.style.width = (F.n / F.need * 100).toFixed(0) + '%';
    if (F.n >= F.need) { endFumble(st); pop(V.set(h.x, 2.1, h.z), 'GOT IT BACK!', 'w'); st.pow = Math.min(100, st.pow + 6); hud(st); return; }
    if (F.t > F.dur) { endFumble(st); st.hp = Math.max(0, st.hp - DMG.peck); st.stats.hitsTaken++; DUELS.hurt(); sfx('hurt'); pop(V.set(h.x, 2.0, h.z), '-' + DMG.peck + ' PECKED', ''); hud(st); if (st.hp <= 0) lose(st); }
  }
  function endFumble(st) { st.fum = null; S.ui.mash.style.opacity = '0'; S.dropCane.visible = false; if (S.cane) S.cane.visible = true; st.h.inv = Math.max(st.h.inv, 0.6); }

  function stepBoss(st, dt) {
    const b = st.b, h = st.h, P = PH[st.phase]; st.bt += dt; b.flash = Math.max(0, b.flash - dt * 4); b.open -= dt; if (b.hurtT >= 0 && (b.hurtT += dt) > 0.3) b.hurtT = -1;
    const lerpMove = (arc) => { const u = clamp(st.bt / st.bdur, 0, 1), e = ease(u); b.x = lerp(b.fromX, b.toX, e); b.z = lerp(b.fromZ, b.toZ, e); b.y = Math.sin(u * Math.PI) * arc; return u >= 1; };
    switch (st.bs) {
      case 'intro': if (st.bt > st.bdur) { setB(st, 'home', 0.6); b.left = P.n; } break;
      case 'home': if (st.bt > st.bdur) { startAttack(st, chooseAttack(st)); setB(st, 'attack', 99); } break;
      case 'attack': if (stepAttack(st, dt)) { const A = st.atk; st.atk = null; b.left--; clearAttackFx(); b.y = 0;
          if (b.left > 0) { setB(st, 'home', 0.45); break; }
          if (A.end === 'swoop') { const dx = b.x - h.x, dz = b.z - h.z, d = Math.hypot(dx, dz) || 1; moveTo(st, 'swoop', h.x + dx / d * 1.7, h.z + dz / d * 1.7, 0.75); }
          else openUp(st, A.end === 'winded' ? 'WINDED! SWING!' : 'PADS STUCK IN THE TURF! SWING!'); } break;
      case 'swoop': if (lerpMove(2.4)) openUp(st, 'SHOWBOATING! SWING!'); break;
      case 'open': if (st.bt > st.bdur) moveTo(st, 'strut', clamp(b.x * 0.4, -3, 3), HOMEZ, 1.0); break;
      case 'dizzy': if (st.bt > st.bdur) { b.open = 0; moveTo(st, 'strut', clamp(b.x * 0.4, -3, 3), HOMEZ, 1.0); } break;
      case 'strut': if (lerpMove(0.6)) { setB(st, 'home', 0.55); b.left = PH[st.phase].n; } break;
      case 'ko': break;
    }
  }
  function openUp(st, msg) { setB(st, 'open', PH[st.phase].win); st.b.open = 1.2; st.b.y = 0; DUELS.tell(msg, 1.0); }
  function clearAttackFx() { if (!S.trail) return; S.trail.visible = false; S.shadow.visible = S.ring.visible = S.wave.visible = S.swarmSh.visible = S.swarmRing.visible = false; S.crows.count = 0; }
  const bossOpen = (st) => (st.bs === 'open' || st.bs === 'dizzy') && st.b.y < 0.6;

  // ---------------- Harold ----------------
  const SWD = [0.3, 0.3, 0.48];
  function stepHarold(st, dt, I) {
    const h = st.h; h.inv -= dt; h.comboT -= dt;
    if (h.hurtT >= 0 && (h.hurtT += dt) > 0.45) h.hurtT = -1;
    if (st.fum) { stepFumble(st, dt, I); if (h.jumpT >= 0) { h.jumpT = -1; h.jy = 0; } return; }
    let mx = I.mx, mz = -I.my; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const sp = (h.swT >= 0 ? 0.35 : 1) * SPD * (h.jumpT >= 0 ? 1.35 : 1);
    const kb = h.hurtT >= 0 && h.hurtT < 0.3; // knockback: keep the shove for a moment
    if (kb) { h.vx *= Math.exp(-4 * dt); h.vz *= Math.exp(-4 * dt); } else { h.vx = damp(h.vx, mx * sp, 14, dt); h.vz = damp(h.vz, mz * sp, 14, dt); }
    h.x += h.vx * dt; h.z += h.vz * dt; clampH(h);
    if (ml > 0.2 && h.swT < 0) h.yaw = dampA(h.yaw, Math.atan2(mx, mz), 14, dt);
    if (I.b && h.jumpT < 0) { h.jumpT = 0; h.inv = Math.max(h.inv, 0.32); sfx('jump'); if (ml > 0.2) { h.vx += mx * 3; h.vz += mz * 3; } }
    if (h.jumpT >= 0) { h.jumpT += dt; h.jy = Math.sin(clamp(h.jumpT / 0.5, 0, 1) * Math.PI) * 0.8; if (h.jumpT > 0.5) { h.jumpT = -1; h.jy = 0; } }
    if (I.a) { if (h.swT < 0) startSwing(st, h.comboT > 0 ? (h.swN + 1) % 3 : 0); else if (h.swT > SWD[h.swN] * 0.35) h.queued = true; }
    if (h.swT >= 0) { h.swT += dt; const D = SWD[h.swN];
      if (!h.swHit && h.swT > D * 0.38) { h.swHit = true; tryHit(st); }
      if (h.swT > D) { h.swT = -1; h.comboT = 0.45; if (h.queued) { h.queued = false; startSwing(st, (h.swN + 1) % 3); } } }
    if (h.swT >= 0 && bossOpen(st)) h.yaw = dampA(h.yaw, Math.atan2(st.b.x - h.x, st.b.z - h.z), 20, dt);
    if (I.c && st.pow >= 100 && !st.hail && !st.over) startHail(st);
  }
  function clampH(h) { h.x = clamp(h.x, -XL, XL); h.z = clamp(h.z, Z0, Z1); }
  function startSwing(st, n) { const h = st.h; h.swN = n; h.swT = 0; h.swHit = false; sfx('swing'); }
  function tryHit(st) {
    const h = st.h, b = st.b; if (!bossOpen(st) || st.over) return; const d = Math.hypot(b.x - h.x, b.z - h.z); if (d > REACH + (h.swN === 2 ? 0.4 : 0)) return;
    const crit = b.open > 0 || st.bs === 'dizzy'; const dmg = BOSSX.hit(st, Math.round(HIT[h.swN] * (crit ? CRIT : 1)), 'bhp');
    st.bhp -= dmg; st.stats.landed++; if (crit) st.stats.crits++; st.pow = Math.min(100, st.pow + POW_HIT); b.flash = 1; b.hurtT = 0;
    st.hs = h.swN === 2 ? 0.085 : 0.065; st.shk = Math.max(st.shk, h.swN === 2 ? 0.45 : 0.22); sfx(h.swN === 2 ? 'heavy' : 'hit');
    pop(V.set(b.x, 3.6, b.z), (h.swN === 2 ? 'BLINDSIDE! ' : '') + dmg + (crit ? '!' : ''), crit ? 'c' : h.swN === 2 ? 'w' : '');
    burst(b.x, 2.0, b.z + 0.6, h.swN === 2 ? 12 : 5, FEATH, 2.4, 2.2, 0.9, 2.5);
    if (Math.random() < 0.18) say(pick(GR.hurt), 1.8);
    checkPhase(st); hud(st);
  }
  function checkPhase(st) {
    if (st.bhp <= 0) { koStart(st); return; }
    const np = st.bhp <= BHP0 / 3 ? 2 : st.bhp <= BHP0 * 2 / 3 ? 1 : 0; if (np > st.phase) { st.phase = np; DUELS.banner('QUARTER ' + (np + 1) + '<small>' + (np === 1 ? 'THE FLOCK GETS FASTER' : 'TWO-PLAY DRIVES · NO HUDDLE') + '</small>', 1.6); say(pick(GR.taunt), 2.2);
      st.hp = Math.min(HP0, st.hp + PATCH); DUELS.say('MAVIS', 'Water break, Harold! Drink, hon!', 1.6); boardSet('NEVERMORE', 'QTR ' + (np + 1) + ' · HAROLD vs THE RAVEN KING', false);
      if (st.fum) endFumble(st); st.atk = null; clearAttackFx(); if (!st.hail) { st.b.y = 0; moveTo(st, 'strut', clamp(st.b.x * 0.4, -3, 3), HOMEZ, 1.0); } }
  }
  // ---------------- HAIL MAVIS (team-up special) ----------------
  function startHail(st) {
    st.pow = 0; st.stats.hails++; if (st.fum) endFumble(st); st.atk = null; clearAttackFx(); const b = st.b; b.y = 0; if (st.bs === 'attack' || st.bs === 'swoop') setB(st, 'open', 1.2);
    st.hail = { t: 0, hit: false }; st.slow = 0.4; st.slowT = 2.6; DUELS.banner('HAIL MAVIS!<small>A PURSE IN A PERFECT SPIRAL</small>', 1.8); DUELS.say('MAVIS', 'Go long, Harold! Throw it!', 1.8); sfx('jump'); hud(st);
  }
  function stepHail(st, dt) {
    const s = st.hail, h = st.h, b = st.b; s.t += dt; h.inv = 0.5; h.vx = h.vz = 0;
    // 0..0.5: Mavis tosses him the purse;  0.5..0.75: Harold winds up;  0.75..1.75: the spiral;  hit;  ..2.3 settle
    if (s.t > 1.75 && !s.hit) { s.hit = true; st.bhp -= HAIL_DMG; b.flash = 1; b.hurtT = 0; st.hs = 0.12; st.shk = 0.8; sfx('heavy'); thud(); roar(); pop(V.set(b.x, 3.8, b.z), 'TOUCHDOWN! ' + HAIL_DMG, 'c'); burst(b.x, 2.4, b.z, 26, CONF, 3.4, 3.4, 1.2, 2);
      st.stats.landed++; hud(st); if (st.bhp <= 0) { st.hail = null; S.purse.visible = false; koStart(st); return; } checkPhase(st); }
    if (s.t > 2.3) { st.hail = null; S.purse.visible = false; setB(st, 'dizzy', 2.2); b.open = 2.2; b.y = 0; DUELS.tell('HE\u2019S SEEING STARS: FINISH HIM!', 1.2); }
  }

  // ---------------- win / lose ----------------
  function koStart(st) { if (st.over) return; st.over = true; st.won = true; st.bhp = 0; if (st.fum) endFumble(st); st.atk = null; clearAttackFx(); setB(st, 'ko', 99); st.outT = 0;
    st.slow = 0.35; st.slowT = 2.2; st.ko = { x: st.b.x, z: st.b.z }; DUELS.log.push('ravenking:win'); JUICE.ko(); DUELS.banner('K.O.!<small>SACKED IN HIS OWN END ZONE</small>', 2.2); roar(); hud(st); }
  function stepKO(st, dt) {
    st.outT += dt; const b = st.b, k = st.ko, u = clamp(st.outT / 1.8, 0, 1); // tumbles back into the end zone and flattens
    b.x = lerp(k.x, 0, ease(u)); b.z = lerp(k.z, -14.2, ease(u)); b.y = u < 1 ? Math.sin(u * Math.PI) * 3.2 : 0; b.sq = u < 1 ? 1 : Math.max(0.22, b.sq - dt * 6);
    if (u >= 1 && !st.flat) { st.flat = true; thud(); sfx('ko'); st.shk = 0.7; burst(b.x, 0.3, b.z, 30, FEATH, 3.2, 3.0, 1.0, 3); boardSet('EVERMORE', 'FINAL · HAROLD WINS', true); roar(); }
    if (st.flat && st.outT < 6 && S.fxs.length < 130) for (let i = 0; i < 2; i++) S.fxs.push({ p: new THREE.Vector3(rnd(-9, 9), rnd(7, 11), rnd(-16, 6)), v: new THREE.Vector3(rnd(-0.6, 0.6), rnd(-1.6, -0.8), rnd(-0.6, 0.6)), t: 0, life: 4.5, g: 0, c: CONF[(Math.random() * CONF.length) | 0], spin: rnd(-5, 5) });
    if (st.outT > 2.8 && !st.said) { st.said = true; DUELS.say('THE RAVEN KING', pick(GR.defeat), 3.2); }
    if (st.outT > 5.0 && !st.done) { st.done = true; DUELS.bossCleared('ravens', 'ravenking');
      const n = st.stats.hitsTaken, g = n <= 3 ? '★★★ S' : n <= 7 ? '★★ A' : '★ B';
      setTimeout(() => { if (DUELS.cur === S) DUELS.over('win', GR.clear + '<br><span style="font-size:15px;color:#ffd23c">' + g + '</span>',
        'Hits taken: ' + n + ' · Dodges: ' + st.stats.dodges + ' · Hail Mavis: ' + st.stats.hails + '. The scoreboard reads EVERMORE. Crime around M&amp;T Stadium: 0.'); }, SIM ? 300 : 700); }
  }
  function lose(st) { if (st.over) return; st.over = true; st.won = false; if (st.fum) endFumble(st); st.atk = null; clearAttackFx(); st.b.y = 0; setB(st, 'win', 99); DUELS.log.push('ravenking:lose'); sfx('ko');
    say('Nevermore, toad. NEVERMORE!', 2.6);
    setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', 'SACKED!', 'Watch the feather trail turn red and step off it, get out from under the crow shadow, and leave the red ring before he lands. Then swing while he\u2019s winded.'); }, SIM ? 300 : 1400); }

  // ---------------- main step ----------------
  S.step = function (dt0, I) {
    const st = S.st; if (!st) return;
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    if (st.hs > 0) { st.hs -= dt0; dt0 *= 0.06; }
    const dt = dt0 * st.slow; st.t += dt; st.shk = Math.max(0, st.shk - dt0 * 1.6);
    if (st.over) { if (st.won) stepKO(st, dt); stepFx(dt); return; }
    if (st.hail) stepHail(st, dt); else stepHarold(st, dt, I);
    if (!st.over && !st.hail) stepBoss(st, dt); else if (!st.over) { st.b.flash = Math.max(0, st.b.flash - dt * 4); if (st.b.hurtT >= 0 && (st.b.hurtT += dt) > 0.3) st.b.hurtT = -1; }
    DUELS.hot(st.pow >= 100);
    stepFx(dt); if ((st._hudT = (st._hudT || 0) - dt) < 0) { st._hudT = 0.1; hud(st); }
  };
  function stepFx(dt) {
    const q = S.cam.quaternion;
    for (let i = S.fxs.length - 1; i >= 0; i--) { const p = S.fxs[i]; p.t += dt; p.v.y -= p.g * dt; if (p.g < 3) { p.v.x += Math.sin(p.t * 3 + i) * dt * 0.8; } p.p.addScaledVector(p.v, dt); if (p.p.y < 0.02) { p.p.y = 0.02; p.v.set(0, 0, 0); } if (p.t > p.life) S.fxs.splice(i, 1); }
    S.fxs.forEach((p, i) => { const s = 1 - p.t / p.life * 0.5; E3.set(0, 0, p.t * p.spin); Q4.setFromEuler(E3).premultiply(q); M4.compose(p.p, Q4, V.set(s, s, s)); S.fx.setMatrixAt(i, M4); S.fx.setColorAt(i, C3.set(p.c || '#fff')); });
    S.fx.count = S.fxs.length; S.fx.visible = S.fxs.length > 0; S.fx.instanceMatrix.needsUpdate = true; if (S.fx.instanceColor) S.fx.instanceColor.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    const h = st.h; let p;
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hail) { const s = st.hail.t; p = HERO_POSES.idle(t); if (s > 0.5 && s < 1.75) { const k = clamp((s - 0.5) / 0.3, 0, 1); p.shR = [lerp(-0.4, -3.0, k) + (s > 0.8 ? 2.4 * clamp((s - 0.8) / 0.15, 0, 1) : 0), 0, -0.3]; p.elR = [-0.4, 0, 0]; p.torso = [s > 0.8 ? 0.3 : -0.2, -0.4, 0]; } return p; }
    if (st.over && st.won) { p = HERO_POSES.idle(t); p.shR = [-2.9, 0, -0.3]; p.shL = [-2.9, 0, 0.3]; p.elR = p.elL = [-0.2, 0, 0]; p.y += Math.abs(Math.sin(t * 5)) * 0.12; return p; }
    if (st.fum) { p = HERO_POSES.hurt(0.3); p.shL = [-1.4 + Math.sin(t * 30) * 0.4, 0, 0.6]; p.shR = [-1.4 + Math.cos(t * 30) * 0.4, 0, -0.6]; p.torso = [0.5, 0, 0]; return p; }
    if (h.hurtT >= 0) return HERO_POSES.hurt(h.hurtT / 0.45);
    if (h.swT >= 0) { const u = h.swT / SWD[h.swN]; return h.swN === 0 ? HERO_POSES.atk1(u) : h.swN === 1 ? HERO_POSES.atk2(u) : HERO_POSES.atk3(u); }
    if (h.jumpT >= 0) return HERO_POSES.jump(h.jumpT < 0.25 ? 1 : -1);
    const sp = Math.hypot(h.vx, h.vz); return sp > 0.6 ? HERO_POSES.run(t, sp) : HERO_POSES.idle(t);
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t);
    if (st.hail && st.hail.t < 0.6) { const k = clamp(st.hail.t / 0.4, 0, 1); p.shR = [lerp(0.6, -2.4, k), 0, -0.3]; p.elR = [-0.2, 0, 0]; p.torso = [lerp(0.3, -0.2, k), -0.5, 0]; return p; }
    const cheer = st.won ? 1 : 0.45, w = Math.sin(t * (6 + cheer * 6)); p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.2 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer; return p; }
  function poseBoss(st, dt) {
    const R = S.R, b = st.b, t = st.t, B0 = S.base, A = st.atk; let mode = st.bs;
    if (mode === 'attack' && A) mode = A.kind === 'blitz' ? (A.t < A.tell ? 'stance' : 'blitz') : A.kind === 'swarm' ? 'caw' : (A.t < A.tell ? 'leap' : 'land');
    if (mode === 'intro' || mode === 'home') mode = 'idle'; if (st.hail && mode !== 'dizzy') mode = 'idle'; if (b.hurtT >= 0 && mode !== 'ko') mode = 'hurt';
    R.root.position.set(b.x, b.y, b.z);
    let face = Math.atan2(st.h.x - b.x, st.h.z - b.z); if (A && A.kind === 'blitz' && A.t >= A.lock) face = A.dir; if (mode === 'ko') face = 0;
    b.yaw = dampA(b.yaw, face, 9, dt); R.root.rotation.y = b.yaw; R.root.scale.set(1 + (1 - b.sq) * 0.6, b.sq, 1 + (1 - b.sq) * 0.6);
    for (const m of R.flash) if (m && m.userData && m.userData.flash) { const tellOn = A && A.t < A.tell; m.userData.flash.value = Math.max(b.flash * 0.32, tellOn ? (Math.sin(t * 24) * 0.5 + 0.5) * 0.22 : 0); if (m.userData.flashC) m.userData.flashC.value.set(tellOn ? '#ff3d6e' : '#ffffff'); }
    const u = A ? clamp(A.t / A.tell, 0, 1) : clamp(st.bt / Math.max(0.01, st.bdur), 0, 1);
    if (R.update) { try { R.update(dt, mode, { t, u, hp: Math.max(0, st.bhp) / BHP0, y: b.y }); } catch (e) { console.error(e); R.update = null; } return; }
    let aLx = 0, aLz = 0.15, aRx = 0, aRz = -0.15, hX = 0, hY = 0, lean = 0, bob = Math.sin(t * 2.4) * 0.04, roll = 0;
    if (mode === 'idle') { aLz = 0.35 + Math.sin(t * 2.4) * 0.08; aRz = -0.35 - Math.sin(t * 2.4) * 0.08; hY = Math.sin(t * 1.3) * 0.25; }
    if (mode === 'stance') { const k = ease(u); lean = 0.85 * k; aRx = -1.0 * k; aRz = -0.1; aLx = 0.2; aLz = 0.7 * k; hX = -0.6 * k; bob = -0.25 * k + Math.sin(t * 18) * 0.02 * k; }
    if (mode === 'blitz') { lean = 0.7; aLx = aRx = 0.9; aLz = 0.5; aRz = -0.5; hX = -0.5; bob = Math.abs(Math.sin(t * 16)) * 0.12; }
    if (mode === 'caw') { const fl = Math.sin(t * 16); aLz = 1.9 + fl * 0.5; aRz = -1.9 - fl * 0.5; lean = -0.25; hX = 0.6 * Math.min(1, u * 3); }
    if (mode === 'leap') { aLz = 2.4; aRz = -2.4; aLx = aRx = -0.3; lean = u > 0.7 ? 0.4 : -0.2; }
    if (mode === 'land') { lean = 0.9; aLz = 1.4; aRz = -1.4; aLx = aRx = 0.8; bob = -0.35; }
    if (mode === 'open') { const winded = b.open > 0; lean = winded ? 0.55 : 0.1; hX = winded ? 0.5 + Math.sin(t * 7) * 0.12 : -0.3; aLz = winded ? 0.2 : 1.2 + Math.sin(t * 8) * 0.5; aRz = winded ? -0.2 : -1.2 - Math.sin(t * 8) * 0.5; bob = winded ? Math.sin(t * 7) * 0.06 - 0.12 : Math.abs(Math.sin(t * 8)) * 0.1; }
    if (mode === 'swoop') { aLz = 1.8 + Math.sin(t * 20) * 0.4; aRz = -1.8 - Math.sin(t * 20) * 0.4; lean = 0.3; }
    if (mode === 'strut') { aLz = 0.4; aRz = -0.4; aLx = Math.sin(t * 9) * 0.4; aRx = -Math.sin(t * 9) * 0.4; roll = Math.sin(t * 9) * 0.08; hX = -0.2; }
    if (mode === 'dizzy') { roll = Math.sin(t * 6) * 0.18; hY = Math.sin(t * 4) * 0.6; aLz = 0.9; aRz = -0.9; lean = 0.2; }
    if (mode === 'hurt') { lean = -0.3; hX = -0.4; }
    if (mode === 'ko') { lean = -0.4; aLz = 1.6; aRz = -1.6; roll = st.flat ? 0 : Math.sin(t * 9) * 0.5; }
    if (mode === 'win') { aLz = 2.6 + Math.sin(t * 9) * 0.4; aRz = -2.6 - Math.sin(t * 9) * 0.4; bob = Math.abs(Math.sin(t * 6)) * 0.12; roll = Math.sin(t * 6) * 0.1; hX = -0.4; }
    R.body.rotation.x = damp(R.body.rotation.x, lean, 10, dt); R.body.rotation.z = damp(R.body.rotation.z, roll, 10, dt); R.body.position.y = B0.by + bob;
    R.head.rotation.x = damp(R.head.rotation.x, B0.hd.x + hX, 10, dt); R.head.rotation.y = damp(R.head.rotation.y, B0.hd.y + hY, 10, dt);
    R.armL.rotation.x = damp(R.armL.rotation.x, B0.aL.x + aLx, 12, dt); R.armL.rotation.z = damp(R.armL.rotation.z, B0.aL.z + aLz, 12, dt);
    R.armR.rotation.x = damp(R.armR.rotation.x, B0.aR.x + aRx, 12, dt); R.armR.rotation.z = damp(R.armR.rotation.z, B0.aR.z + aRz, 12, dt);
  }
  function poseAttackFx(st) {
    const A = st.atk, t = st.t, b = st.b;
    if (A && A.kind === 'blitz' && A.t < A.tell + 0.05) { const m = S.trail, locked = A.t >= A.lock, len = 24; m.visible = true;
      m.scale.set(locked ? 1.9 : 1.5, len, 1); E3.set(-Math.PI / 2, 0, -A.dir + Math.PI); m.quaternion.setFromEuler(E3); m.position.set(b.x + Math.sin(A.dir) * len / 2, 0.04, b.z + Math.cos(A.dir) * len / 2);
      m.material.color.set(locked ? '#ff6a6a' : '#ffffff'); m.material.opacity = locked ? 0.75 + 0.25 * Math.sin(t * 30) : 0.5 + 0.3 * Math.sin(t * 14); S.trailT.repeat.set(1, len / 2.2); S.trailT.offset.y = -t * (locked ? 3 : 1.2); }
    else S.trail.visible = false;
    if (A && A.kind === 'swarm') { const live = A.t >= A.tell, dive = clamp((A.t - A.tell) / 0.3, 0, 1), k = clamp(A.t / A.tell, 0, 1);
      S.swarmSh.visible = S.swarmRing.visible = A.t < A.tell + 0.3; S.swarmSh.position.set(A.tx, 0.03, A.tz); const s = lerp(1.4, 3.2, k); S.swarmSh.scale.set(s, s, 1); S.swarmSh.material.opacity = 0.2 + 0.4 * k;
      S.swarmRing.position.set(A.tx, 0.035, A.tz); S.swarmRing.scale.set(3.2, 3.2, 1); S.swarmRing.material.opacity = (A.t >= A.lock ? 0.6 : 0.3) + 0.3 * Math.sin(t * 20);
      S.crows.count = 26; const cx = live ? A.tx : lerp(b.x, A.tx, Math.min(1, k * 2.5)), cz = live ? A.tz : lerp(b.z, A.tz, Math.min(1, k * 2.5));
      S.crowSeed.forEach((c, i) => { const a = c.a + t * 4.2 * c.s, scat = A.t > A.tell + 0.3 ? (A.t - A.tell - 0.3) * 9 : 0, r = (live ? lerp(2.2, 0.4, dive) : 2.6) * c.r + scat, hh = (live ? lerp(5.5, 0.9, dive) : 5.5 + c.h) + scat * 0.7;
        V.set(cx + Math.sin(a) * r, hh + Math.sin(t * 9 + i) * 0.2, cz + Math.cos(a) * r); E3.set(Math.sin(t * 22 + i) * 0.3, a + Math.PI / 2, 0); Q4.setFromEuler(E3); M4.compose(V, Q4, V2.set(1, 1, 1)); S.crows.setMatrixAt(i, M4); });
      S.crows.instanceMatrix.needsUpdate = true; if (A.t > A.tell + 0.9) S.crows.count = 0; }
    else S.crows.count = 0;
    if (A && A.kind === 'sack') { const k = clamp(A.t / A.tell, 0, 1); S.shadow.visible = S.ring.visible = A.t < A.tell; S.shadow.position.set(A.tx, 0.03, A.tz); const s = lerp(1.0, 4.2, k); S.shadow.scale.set(s, s, 1); S.shadow.material.opacity = 0.25 + 0.5 * k;
      S.ring.position.set(A.tx, 0.035, A.tz); S.ring.scale.set(4.2, 4.2, 1); S.ring.material.opacity = (A.t >= A.lock ? 0.6 : 0.3) + 0.35 * Math.sin(t * 18);
      S.wave.visible = A.on && A.waveT < 0.4; if (S.wave.visible) { const w = 1 + A.waveT * 14; S.wave.position.set(b.x, 0.05, b.z); S.wave.scale.set(w, w, 1); S.wave.material.opacity = 1 - A.waveT / 0.4; } }
    else { S.shadow.visible = S.ring.visible = S.wave.visible = false; }
    // the dropped cane wobbles while you mash for it
    if (st.fum) S.dropCane.rotation.z = 0.4 + Math.sin(t * 30) * 0.15 * (st.fum.n / st.fum.need);
    // Mavis's purse: from her to Harold, then the slow-mo spiral to the Raven King
    if (st.hail) { const s = st.hail.t, h = st.h, M = S.M.root.position; S.purse.visible = s < 1.8;
      if (s < 0.5) { const k = s / 0.5; S.purse.position.set(lerp(M.x, h.x, k), 1.2 + Math.sin(k * Math.PI) * 1.6, lerp(M.z, h.z, k)); S.purse.rotation.set(k * 6, 0, 0); }
      else if (s < 0.75) { S.purse.position.set(h.x + 0.3, 1.9, h.z + 0.2); }
      else { const k = clamp((s - 0.75) / 1.0, 0, 1); S.purse.position.set(lerp(h.x, b.x, k), lerp(2.0, 2.4, k) + Math.sin(k * Math.PI) * 5.5, lerp(h.z, b.z, k)); V.set(b.x - h.x, 0, b.z - h.z); S.purse.rotation.set(0, Math.atan2(V.x, V.z), 0); S.purse.rotateZ(s * 22); if (Math.random() < 0.5) burst(S.purse.position.x, S.purse.position.y, S.purse.position.z, 1, '#ffd23c', 0.3, 0.3, 0.5, 0); } }
  }
  S.render = function (rdt) {
    const st = S.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.hs > 0 ? 0.1 : st.slow), t = st.t, h = st.h;
    const H = S.H; H.root.position.set(h.x, h.jy, h.z); H.root.rotation.y = st.hail ? Math.atan2(st.b.x - h.x, st.b.z - h.z) : h.yaw; applyPose(H, haroldPose(st, t), 18, dt, false);
    if (H.mat.userData.flash) H.mat.userData.flash.value = h.inv > 0 && !st.hail ? (Math.sin(t * 30) > 0 ? 0.35 : 0) : Math.max(0, H.mat.userData.flash.value - dt * 4);
    const M = S.M, mx = st.hail && st.hail.t < 0.6 ? h.x - 2.2 : st.won && st.outT > 3 ? -3.2 : -8.2, mz = st.hail && st.hail.t < 0.6 ? h.z + 1.2 : 4.5;
    M.root.position.set(damp(M.root.position.x, mx, 4, dt), 0, damp(M.root.position.z, mz, 4, dt)); M.root.rotation.y = Math.atan2(h.x - M.root.position.x, h.z - M.root.position.z) * 0.7 + Math.PI * 0.2; applyPose(M, mavisPose(st, t), 12, dt, false);
    poseBoss(st, dt); poseAttackFx(st);
    // the crowd bounces (a few rows a frame) when something big happens
    const hype = st.won ? 1 : st.hail ? 0.8 : 0.2; if (S.fans && hype > 0.25) { for (let i = 0; i < S.fanBase.length; i += 3) { const j = (i + ((st.t * 60) | 0) % 3) % S.fanBase.length; M4.copy(S.fanBase[j]); M4.elements[13] += Math.abs(Math.sin(t * 9 + j)) * 0.25 * hype; S.fans.setMatrixAt(j, M4); } S.fans.instanceMatrix.needsUpdate = true; }
    // camera: behind + above Harold looking up the field at the Raven King; portrait sits higher and further back
    const port = VH() > VW(); S.cam.fov = port ? 62 : 50; S.cam.updateProjectionMatrix(); const b = st.b;
    let cx = h.x * 0.45, cy = port ? 9.0 : 6.6, cz = h.z * 0.55 + (port ? 11.6 : 10.0), lx = h.x * 0.3 + b.x * 0.2, ly = (port ? 1.0 : 1.6) + b.y * 0.35, lz = Math.min(-2.5, b.z * 0.4 - 1.2);
    if (st.hail) { const s = st.hail.t; if (s < 0.8) { cx = h.x + 3.2; cy = 2.8; cz = h.z + 4.2; lx = h.x; ly = 1.6; lz = h.z - 1; } else { const P = S.purse.position; cx = P.x + 2.5; cy = P.y + 1.6; cz = P.z + 5.5; lx = P.x; ly = P.y; lz = P.z - 2; } }
    if (st.over && st.won) { cx = 3; cy = 6; cz = port ? 6 : 4; lx = 0; ly = st.outT > 2 ? 6.5 : 1; lz = st.outT > 2 ? -20 : -13; } // the KO: the flattened King in the end zone + the EVERMORE board above
    V.set(cx, cy, cz); V2.set(lx, ly, lz);
    if (st.bs === 'intro' && st.bt < st.bdur) { const k = ease(clamp(st.bt / st.bdur, 0, 1)); V.lerpVectors(V3.set(1.5, 3.2, -2.5), V, k); V2.lerpVectors(V3.set(0, 2.6, -8), V2, k); }
    S.camP.lerp(V, 1 - Math.exp(-5 * dt)); S.camL.lerp(V2, 1 - Math.exp(-6 * dt));
    S.cam.position.copy(S.camP); if (st.shk > 0) S.cam.position.add(V3.set(rnd(-1, 1), rnd(-1, 1), 0).multiplyScalar(st.shk * 0.25)); S.cam.lookAt(S.camL);
    const W = VW(), Hh = VH(); S.bangT = (S.bangT || 0) - dt;
    if (S.bangT > 0 && !st.over) { V.set(b.x, b.y + 4.0, b.z).project(S.cam); S.ui.bang.style.opacity = (Math.sin(t * 20) > -0.3 ? '1' : '0.4'); S.ui.bang.style.left = ((V.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; S.ui.bang.style.top = ((-V.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px'; }
    else S.ui.bang.style.opacity = '0';
    for (const P of S.ui.pops) { if (P.t <= 0) { if (P.el.style.opacity !== '0') P.el.style.opacity = '0'; continue; } P.t -= Math.min(0.05, rdt * (SIM || 1)); P.p.y += rdt * (SIM || 1) * 1.2; V.copy(P.p).project(S.cam);
      P.el.style.opacity = clamp(P.t * 2.5, 0, 1).toFixed(2); P.el.style.left = ((V.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; P.el.style.top = ((-V.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px'; }
    OUT_U.fogC.value.copy(S.scene.fog.color); OUT_U.fogN.value = 34; OUT_U.fogF.value = 96;
  };
  S.onResize = () => {};

  // ---------------- test bot: win reads every tell; mash = SWING only, never moves; lose stands still and never swings ----------------
  S.botThink = function (B, dt) {
    const st = S.st; if (!st || st.over) return; const h = st.h, b = st.b, A = st.atk; B.mx = B.my = 0; if (st.hail) return;
    if (B.mode === 'mash') { B.cd = (B.cd || 0) - dt; if (B.cd <= 0) { B.a = true; B.cd = 0.25; } return; }
    if (B.mode === 'lose') { const tx = 0, tz = 3.2; B.mx = clamp((tx - h.x) * 0.8, -1, 1); B.my = -clamp((tz - h.z) * 0.8, -1, 1); return; }
    if (st.fum) { B.cd = (B.cd || 0) - dt; if (B.cd <= 0) { B.a = true; B.cd = 0.12; } return; }
    let tx = h.x, tz = h.z, danger = false;
    if (A && A.kind === 'blitz' && (A.t < A.tell || !A.end)) { const dx = Math.sin(A.dir), dz = Math.cos(A.dir), rx = h.x - b.x, rz = h.z - b.z, cr = rx * dz - rz * dx;
      if (A.t >= A.lock - 0.1 && Math.abs(cr) < 2.4) { let s = cr >= 0 ? 1 : -1; if (Math.abs(h.x + dz * s * 3) > XL - 0.4) s = -s; tx = h.x + dz * s * 3; tz = h.z - dx * s * 3; danger = true; }
      else if (A.t < A.lock - 0.1) { tx = clamp(h.x, -4, 4); tz = 3.5; } }
    else if (A && A.kind === 'swarm' && A.t < A.tell + 0.35) { if (A.t >= A.lock - 0.1) { const dx = h.x - A.tx, dz = h.z - A.tz, d = Math.hypot(dx, dz) || 0.01; if (d < 2.6) { danger = true; let ux = dx / d, uz = dz / d; if (d < 0.2) { ux = h.x > 0 ? -1 : 1; uz = 0; } tx = h.x + ux * 3; tz = h.z + uz * 3; if (Math.abs(tx) > XL - 0.4 || tz < Z0 + 0.3 || tz > Z1 - 0.3) { tx = h.x - uz * 3 * Math.sign(h.x || 1); tz = h.z + ux * 3; } } } }
    else if (A && A.kind === 'sack' && A.t < A.tell + 0.05) { if (A.t >= A.lock - 0.15) { const dx = h.x - A.tx, dz = h.z - A.tz, d = Math.hypot(dx, dz) || 0.01; if (d < 3.0) { danger = true; let ux = dx / d, uz = dz / d; if (d < 0.2) { ux = h.x > 0 ? -1 : 1; uz = 0; } tx = h.x + ux * 3.5; tz = h.z + uz * 3.5; if (Math.abs(tx) > XL - 0.4 || tz < Z0 + 0.3 || tz > Z1 - 0.3) { tx = h.x + uz * 3.5 * (h.x > 0 ? -1 : 1); tz = h.z - ux * 2; } } } }
    else if (bossOpen(st)) { const d = Math.hypot(b.x - h.x, b.z - h.z); tx = b.x; tz = b.z + 1.3; if (d < REACH - 0.15) { tx = h.x; tz = h.z; B.ctr = (B.ctr || 0) - dt; if (B.ctr <= 0) { B.a = true; B.ctr = 0.12; } } }
    else if (st.bs === 'swoop' || st.bs === 'attack') { tx = h.x; tz = h.z; }
    else { tx = clamp(b.x * 0.5, -3, 3); tz = 3.0; }
    if (st.pow >= 100 && bossOpen(st)) B.c = true;
    const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz); if (d > 0.15) { B.mx = clamp(dx / Math.max(d, 0.5), -1, 1); B.my = -clamp(dz / Math.max(d, 0.5), -1, 1); }
    if (A && A.kind === 'blitz' && A.on && Math.hypot(h.x - b.x, h.z - b.z) < 2.2 && h.jumpT < 0) B.b = true; // late hop as a backup
  };
  DUELS.reg('ravenking', S);

  // ---------------- the city side: ACT "FIGHT RAVEN" by M&T Stadium's boss anchor (REAL landmark anchor) ----------------
  const gated = () => typeof window.hasNevermoreFeather === 'function' && !window.hasNevermoreFeather();
  function setupTrigger() {
    const L = LANDMARKS.find((l) => l.id === 'ravens'); if (!L || !L.boss) return;
    const x = L.boss.x + RING_DX, z = L.boss.z + RING_DZ; DUELS.addTrigger('ravenking', L, x, z, x + 2.6, z, '#b48cff');
    const act = ACTIONS[ACTIONS.length - 1]; if (act && act.kind === 'boss') Object.defineProperty(act, 'label', { get: () => (gated() ? 'NEED THE FEATHER' : L.boss.cleared ? 'REMATCH' : 'FIGHT RAVEN'), configurable: true });
    if (act) { act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels')); const go = act.go; act.go = () => { if (gated()) { DUELS.log.push('ravenking:gated'); return false; } return go(); }; }
  }
  const RING_DX = 0, RING_DZ = 0; // the anchor is midfield inside the bowl (open grass, reached through the east-stand gap at z 70-82)
  let n = 0; MODE.ticks.push(() => { n++;
    if (n === 1) setupTrigger();
    if (n === 3 && Q.has('ravenking') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('ravenkingauto'); DUELS.start('ravenking', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__ravenking = S; S.GR = GR;
})();

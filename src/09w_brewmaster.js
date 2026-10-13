
// ======================= THE ONE-EYED BREWMASTER: the FINAL boss, a three-part finale on the DUELS core (DESIGN.md "Final boss: The One-Eyed Brewmaster in 3 parts",
// Brad 2026-10-12; roster #21 FINAL). An ORIGINAL homage per hawk-relay/relay/briefs/HOMAGE.md: a round-headed, one-eyed (one big eye behind a gold monocle,
// the other squinted shut), big-handlebar-mustache brewery mascot with a single curl of hair, in his own outfit (rolled white shirt sleeves, a rust-copper
// vest, a leather brewer's apron, a teal bow tie). No real beer brand, name, logo or official mascot face on him, his truck or his brewery: the lettering is
// all original ("ONE-EYE BREWERY", "ONE-EYE BREWING CO. · HARBOR DELIVERY"), per DESIGN.md's "original lit brewery-tower sign with original lettering".
//   PART 1 ROOFTOP (lane duel, camera behind Harold): CAN-TOWER SLAM (cans stack into towers over two lanes, their shadows grow on the roof; the towers topple:
//        stand in the gap), FOAM GEYSER (the roof bubbles under your lane: roll out before it blows), MUSTACHE-TWIRL SPIN (he twirls the mustache and spins
//        across every lane at knee height: HOP over it). Every tell >= 1.0 s with a "!" over him, a ground mark and a HUD call-out. At 50% health he leaps off
//        the roof into his beer truck and peels out.
//   PART 2 THE CHASE (short, phone-friendly): Mavis drives, Harold leans out with the cane. 3 lanes down the rowhouse streets toward the brewery; the truck drops
//        rolling kegs and foam slicks (each with a "!" over the truck + a lit lane strip >= 1.2 s ahead). Mavis closes the gap on her own; when you catch him
//        she rams him (SWING in the ram = CANE CHECK, extra). 3 rams run him off the road at the brewery gates. POWER here = TURBO (instant ram).
//   PART 3 LAST CALL AT THE BREWERY (lane duel in the brewery yard over the harbor, under the lit brew tower): same three attacks, faster, plus the phase-3
//        LAST CALL COMBO (slam -> geyser -> spin back to back, each tell still >= 1.0 s) once he is under 25%. POWER here = the big team-up HON HAYMAKER with
//        Mavis. KO = slow-mo, a 2.6 s FINAL BLOW replay (letterboxed, side camera, half speed), then he sails over the railing into the harbor (splash).
// Harold: 3-hit cane combo with this fight's own finisher (LAST CALL UPPERCUT), roll (lane change) + hop i-frames, POWER special (part 1 CANE QUAKE solo,
// part 3 HON HAYMAKER team-up), Mavis's crab cake heal (once a part, when low), one SECOND WIND, hit-stop / shake / damage pops, star grade on the ending card.
// Win: DUELS.bossCleared('brewery') -> BOSS_CLEAR.clear('brewery') + a 'tcb:finale' window event (for the celebration / drone unlock, not built here).
// Controls (duel conventions): phone: stick left / right or the white buttons = ROLL a lane, JUMP = HOP, SWING = cane, ACT = POWER. Desktop: A / D roll,
// K hop, J swing, E power. Gamepad: left stick / LB / RB roll, A hop, X swing, Y power.
// Entry: the ring at the brewery anchor. There is NO brewery landmark in 03_city.js yet, so this file registers LANDMARKS 'brewery' (ONE-EYE BREWERY) at a
// TEMPORARY anchor on the nearest street to the north-east edge (Brewers Hill direction, ~(200,-70)). The ring is LOCKED (dim, "BREWMASTER: N LEFT")
// until every other landmark boss is cleared; then ACT = FIGHT BREWMASTER (REMATCH once beaten).
// Tests: ?brewmaster=1 starts at load (ignores the gate); &brewmasterpart=1..3 starts at a part; &brewmasterauto=win|lose|mash plays it by itself;
// &brewmasterhp=N sets Harold's start HP (fast lose tests). Writing: GR1 bosses.one_eyed_brewmaster if present, else hawk-relay gr11_finale.json
// brewmaster_finale lines (copied below), GR10 clear banner "LAST CALL, BREWMASTER!".
// Shared files: none edited (new file only; build.sh picks up src/0*.js). Merge note: when a real brewery landmark lands in 03_city.js with id 'brewery',
// this file reuses it instead of registering its own.
//
// RIG HOOK (Opus): if window.buildBrewmaster exists it is called as buildBrewmaster({ THREE, toonMat, outlineMat, addOdir, QUAL }) and may return
//   { root, body?, head?, armL?, armR?, mustache?, paddle?, flash?: [materials], update?(dt, state, info) }
//   root: Object3D, feet at y 0, facing +z, about 2.8 m tall. The core turns it to face Harold, moves it (spin slides, the flee leap, the harbor KO arc).
//   body: the part that leans / reels (rotation.x > 0 leans forward). head: optional (bobbed on taunts). armL / armR: shoulder pivots (armL = his left);
//   rotation.x < 0 raises the arm. mustache: a group at the upper lip, twirled (rotation.z) on the spin tell. paddle: a prop group in his right hand (mash paddle).
//   update(dt, state, info): optional, called every frame; state one of intro | guard | towerTell | tower | geyTell | gey | spinTell | spin | open | quaked |
//     haymaker | flee | drive | ko; info = { t, u (0..1 through the state), part (1..3), lanes (marked lanes) }. If update exists the core skips its own
//     part animation (it still moves root). Missing pieces are skipped. Otherwise the procedural stand-in below is used.
(function () {
  const C = { scene: null, cam: null, title: 'THE ONE-EYED BREWMASTER', pips: 2,
    hint: '<b>A / D</b> roll · <b>K</b> hop · <b>J</b> swing · <b>E</b> power',
    labels: { a: 'SWING', b: 'HOP', c: 'POWER', l: '&#9664; ROLL', r: 'ROLL &#9654;' } };
  const LBL_DUEL = C.labels, LBL_CHASE = { a: 'CANE', b: 'HONK', c: 'TURBO', l: '&#9664; LANE', r: 'LANE &#9654;' };
  const HINT_DUEL = C.hint, HINT_CHASE = '<b>A / D</b> change lane · <b>J</b> cane · <b>E</b> turbo (POWER)';
  const MZ = 5.4, LANE = 1.4, LANE2 = 2.3;
  const sx = (lat) => -lat * LANE;
  const PH = { // per part: tell lengths (all >= 1.0 s), open window, guard time, attack mix
    1: { tower: 1.45, gey: 1.35, spin: 1.4, spd: 8, open: 1.9, guard: [0.9, 1.4], mix: ['tower', 'gey', 'spin', 'gey', 'tower', 'spin'] },
    3: { tower: 1.2, gey: 1.15, spin: 1.2, spd: 9.5, open: 1.6, guard: [0.6, 1.0], mix: ['spin', 'tower', 'gey', 'tower', 'spin', 'gey'] },
  };
  const DMG = { tower: 9, gey: 8, spin: 9, keg: 8, slick: 5 }, SWING = [6, 6, 13], QUAKE = 18, HAYMAKER = 24;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // writing (hawk-relay content/gr11_finale.json brewmaster_finale + gr10_bosses.json one_eyed_brewmaster); GR1 overrides when it carries the boss
  const W11 = {
    p1: { intro: ['Welcome to my rooftop, toads. Last stop before closing time.', 'My sign lights the whole harbor. Tonight, you two are the toast.'],
      taunt: ["Stack 'em high, watch 'em fall. Like your little crusade.", "Foam's up! Hope you two brought towels.", 'Spin cycle, sugarplums! Mind the mustache.', "One eye's all I need to see you're beat."],
      hurt: ["Ow! That's a vintage mustache!", 'My monocle! Do you know what squinting costs?', 'Lucky shot, hoptoad. Pour another.'],
      end: ['Half-empty? Never! Fill her up in the truck!', "Last call's on wheels, toads. Catch me if you can!"] },
    p2: { intro: ["Keys in, foam out! The whole harbor's my bar tab!", 'Ten tons of kegs and no brakes. Try and keep up.'],
      taunt: ['Kegs away! Bowling night, harbor style!', "Slick road ahead. Foam's my favorite pothole.", 'You drive like a Sunday ride-out, hon.', "Three bumps won't stop a full delivery!"],
      hurt: ['My paint job! That was fresh off the line!', 'Hey! The deliveries are FRAGILE!', 'Quit ramming my bumper, you warty menace!'],
      end: ["The truck's busted, but this brewmaster ain't!", 'Crawling out mad now. Somebody hand me a sign.'] },
    p3: { intro: ['No roof, no truck, no rules. Just me and a busted sign.', 'You wrecked my tower and my ride. Now I wreck you.'],
      taunt: ['Broken sign, sharp edges. Dirty fighting is my brew.', "I've got one eye and twice your nerve.", "Hold still, I'll put you on a coaster.", "This city ran on my tap. It'll run again!"],
      hurt: ['Ugh, my handlebars are sagging!', "That cane's harder than it looks, gramps!", "Okay, okay, the curl's coming loose!"],
      end: ['Last round of the night. Make it count.', 'My knees are foam. Not done yet!'] },
    defeat: ["Fine! The tap is closed. Tell the harbor I'm cut off.", "Splash! Ugh, the harbor's colder than my kegs.", 'You two... drink water. Stay out of trouble. Hic.', 'The one-eyed era is over. The stoops are yours, toads.'],
  };
  const MAVIS = { heal: 'Crab cake, Harold! Fresh off the stall!', wind: "Up you get, Harold! Last call ain't over!", chase: ["Hang on to your hat, Harold!", "I'm flooring it, hon!", 'Lean out and give him the cane!'], hay: 'Hold my handbag... no, WATCH my handbag!' };
  const gr1 = () => { const g = (window.GR1 || (typeof GR1 !== 'undefined' ? GR1 : null)); return g && g.bosses && g.bosses.one_eyed_brewmaster; };
  const line = (part, k) => { const g = gr1(); if (g && part === 1 && g[k] && g[k].length) return pick(g[k]); const P = W11['p' + part]; return P && P[k] ? pick(P[k]) : ''; };
  const defeatLine = () => { const g = gr1(); return g && g.defeat && g.defeat.length ? pick(g.defeat) : pick(W11.defeat); };

  // ---------------- textures (all procedural canvas; original lettering only) ----------------
  function neonSign(text, sub, w = 1024, h = 256) { return canvasTex(w, h, (g) => {
    g.fillStyle = '#16100c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a1a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    // an original hop-cone + one-eye wink icon, both sides
    const hop = (x) => { g.save(); g.translate(x, h / 2); g.shadowColor = '#7dff6a'; g.shadowBlur = 18; g.fillStyle = '#9dff6b'; for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) { g.beginPath(); g.ellipse((k - r / 2) * 22, -44 + r * 26, 13, 15, 0, 0, TAU); g.fill(); } g.restore(); };
    hop(90); hop(w - 90);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 ' + Math.round(h * 0.36) + 'px ' + FONT;
    g.shadowColor = '#ff9a2a'; g.shadowBlur = 24; g.fillStyle = '#ffd08a'; g.fillText(text, w / 2, h * 0.42); g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#ff7a1a'; g.strokeText(text, w / 2, h * 0.42);
    if (sub) { g.font = '700 ' + Math.round(h * 0.15) + 'px ' + FONT; g.shadowColor = '#ff3d6e'; g.shadowBlur = 14; g.fillStyle = '#ffb0c8'; g.fillText(sub, w / 2, h * 0.8); }
  }, 512); }
  function liveryTex() { return canvasTex(1024, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f5a3a'); gr.addColorStop(1, '#123a26'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c070'; g.fillRect(0, 22, w, 10); g.fillRect(0, h - 32, w, 10);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, h - 70 - k * 16 + Math.sin(x / 40 + k) * 6); g.stroke(); }
    g.save(); g.translate(150, 170); g.fillStyle = '#9dff6b'; for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) { g.beginPath(); g.ellipse((k - r / 2) * 30, -60 + r * 34, 17, 20, 0, 0, TAU); g.fill(); } g.restore();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff2d0'; g.font = '900 88px ' + FONT; g.fillText('ONE-EYE', 270, 130);
    g.font = '900 52px ' + FONT; g.fillStyle = '#e8c070'; g.fillText('BREWING CO.', 276, 205); g.font = '700 34px ' + FONT; g.fillStyle = '#fff'; g.fillText('HARBOR DELIVERY · BALTIMORE, HON', 276, 268);
  }, 512); }
  function roofTex() { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3a3640'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = ['#4a4652', '#2e2a34', '#55505e'][i % 3]; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, k * 64 + 2); g.lineTo(w, k * 64 + 2); g.stroke(); } }, 256); }
  function brickTex(lit) { return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a2a22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) for (let x = ((y / 12) % 2) * 14; x < w; x += 28) { g.fillStyle = ['#8a3a2a', '#7a3426', '#94422e'][(x * 7 + y) % 3]; g.fillRect(x + 1, y + 1, 26, 10); }
    if (lit) for (let k = 0; k < 4; k++) { const x = 18 + k * 60; g.fillStyle = '#1a1010'; g.fillRect(x - 3, 70, 40, 100); g.fillStyle = '#ffcf6a'; g.beginPath(); g.moveTo(x, 110); g.arc(x + 17, 110, 17, Math.PI, 0); g.lineTo(x + 34, 166); g.lineTo(x, 166); g.fill(); g.fillStyle = '#1a1010'; g.fillRect(x + 15, 92, 3, 74); } }, 256); }
  function skylineTex() { return canvasTex(1024, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0a24'); gr.addColorStop(0.7, '#2a1a40'); gr.addColorStop(1, '#3a2048'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(rnd(0, w), rnd(0, h * 0.4), 2, 2); }
    let x = 0; while (x < w) { const bw = rnd(26, 70), bh = rnd(50, 190); g.fillStyle = '#100c1e'; g.fillRect(x, h - bh, bw, bh); g.fillStyle = '#ffd86a';
      for (let yy = h - bh + 8; yy < h - 6; yy += 12) for (let xx = x + 5; xx < x + bw - 6; xx += 10) if (Math.random() < 0.35) g.fillRect(xx, yy, 4, 5); x += bw + rnd(2, 10); } }, 512); }
  function roadTex() { return canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#2e2c34'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = i % 2 ? '#36343c' : '#26242c'; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
    g.fillStyle = '#f0e8c0'; for (const x of [w / 3, w * 2 / 3]) for (let y = 0; y < h; y += 128) g.fillRect(x - 3, y, 6, 70); g.fillStyle = '#e0b020'; g.fillRect(4, 0, 5, h); g.fillRect(w - 9, 0, 5, h); }, 256); }
  function rowTex() { return canvasTex(512, 256, (g, w, h) => { const cols = ['#8a3a2a', '#9a5a3a', '#7a4a5a', '#8a6a4a'];
    for (let k = 0; k < 4; k++) { const x = k * 128; g.fillStyle = cols[k]; g.fillRect(x, 0, 128, h); g.fillStyle = '#d8d0c0'; g.fillRect(x, 0, 128, 14);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { g.fillStyle = '#1a1414'; g.fillRect(x + 18 + c * 56, 40 + r * 70, 36, 48); g.fillStyle = Math.random() < 0.6 ? '#ffcf6a' : '#3a4a6a'; g.fillRect(x + 21 + c * 56, 43 + r * 70, 30, 42); }
      g.fillStyle = '#2a1a14'; g.fillRect(x + 50, 190, 28, 50); g.fillStyle = '#f4f4f0'; for (let s = 0; s < 3; s++) g.fillRect(x + 42 - s * 4, 240 + s * 5 - 10, 44 + s * 8, 6); } }, 256); }
  function markTex(kind) { return canvasTex(128, 128, (g) => {
    if (kind === 'foam') { g.fillStyle = 'rgba(255,250,230,.0)'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ff3d3d'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke();
      g.strokeStyle = '#fff6d8'; g.lineWidth = 4; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.stroke(); }
      g.fillStyle = '#fff6d8'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(rnd(30, 98), rnd(30, 98), rnd(5, 11), 0, TAU); g.fill(); } }
    else { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.9)'); r.addColorStop(0.75, 'rgba(10,0,10,.7)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ff3d3d'; g.lineWidth = 6; g.strokeRect(4, 4, 120, 120); }
  }, 128); }

  // ---------------- the Brewmaster stand-in (original: round head, one big monocled eye + one squint, handlebar mustache, a single curl, vest + apron + bow tie) ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group(), flash: [] };
    const bM = toonMat(), aM = [toonMat(), toonMat()], hM = toonMat(); R.flash = [bM, aM[0], aM[1], hM];
    R.body = new THREE.Group(); R.root.add(R.body);
    const B = K();
    for (const s of [-1, 1]) B.add(G.cyl(0.2, 0.17, 0.9, 8), '#2a2e48', s * 0.26, 0.5, 0).add(G.box(0.3, 0.16, 0.48), '#141018', s * 0.26, 0.08, 0.08);
    B.add(G.sph(0.66, 16, 12), '#f4f0e6', 0, 1.42, 0, 0, 0, 0, 1, 1.05, 0.85); // round shirt belly
    B.add(G.sph(0.67, 16, 12), '#b0562a', 0, 1.46, -0.04, 0, 0, 0, 1.0, 1.04, 0.8); // vest (back + sides)
    for (const s of [-1, 1]) B.add(G.box(0.26, 0.9, 0.12), '#b0562a', s * 0.36, 1.48, 0.5, 0, s * -0.35, 0);
    for (let k = 0; k < 3; k++) B.add(G.sph(0.04, 6, 5), '#e8c070', 0.2, 1.7 - k * 0.2, 0.58);
    B.add(G.box(0.7, 1.05, 0.06), '#6a4428', 0, 1.06, 0.6).add(G.box(0.62, 0.06, 0.07), '#4a2e1a', 0, 1.56, 0.62).add(G.box(0.3, 0.22, 0.03), '#5a3a22', 0, 0.98, 0.64); // leather apron + pocket
    B.add(G.cyl(0.67, 0.67, 0.1, 16), '#3a2a1a', 0, 0.98, 0); // belt
    // head: big round, ears, bulb nose, ONE big eye with a gold monocle (his right = screen left when he faces us), the other a squint crease
    const HG = new THREE.Group(); HG.position.set(0, 2.28, 0.04); R.body.add(HG); R.head = HG;
    const Hd = K();
    Hd.add(G.sph(0.6, 18, 14), '#f2c49a', 0, 0, 0).add(G.sph(0.14, 8, 6), '#e8b088', -0.6, 0, 0).add(G.sph(0.14, 8, 6), '#e8b088', 0.6, 0, 0);
    Hd.add(G.sph(0.15, 10, 8), '#e89a7a', 0, -0.08, 0.6);
    Hd.add(G.sph(0.17, 12, 10), '#ffffff', -0.22, 0.13, 0.5).add(G.sph(0.085, 8, 6), '#14101f', -0.21, 0.13, 0.64).add(G.sph(0.03, 5, 4), '#ffffff', -0.18, 0.17, 0.71);
    Hd.add(G.tor(0.2, 0.035, TAU, 6, 16), '#e8c070', -0.22, 0.13, 0.6).add(G.cyl(0.008, 0.008, 0.5, 4), '#e8c070', -0.36, -0.1, 0.56, 0, 0, 0.5); // monocle + chain
    Hd.add(G.box(0.22, 0.035, 0.05), '#5a3018', 0.22, 0.13, 0.56, 0, 0, -0.18).add(G.box(0.24, 0.05, 0.05), '#4a2a16', 0.22, 0.26, 0.54, 0, 0, 0.12); // squint + brow
    Hd.add(G.box(0.3, 0.07, 0.06), '#4a2a16', -0.22, 0.36, 0.52, 0, 0, -0.1); // raised brow over the big eye
    Hd.add(G.tor(0.12, 0.04, Math.PI * 1.6, 6, 12), '#3a2210', 0, 0.66, 0.05, 0, Math.PI / 2, 0.4); // the single curl of hair
    Hd.add(G.box(0.18, 0.04, 0.04), '#8a3a3a', 0, -0.32, 0.54); // mouth
    R.headM = Hd.mesh(hM, HG);
    // handlebar mustache: its own group (twirls)
    R.mustache = new THREE.Group(); R.mustache.position.set(0, -0.2, 0.6); HG.add(R.mustache);
    { const M = K(); for (const s of [-1, 1]) M.add(G.cyl(0.07, 0.1, 0.42, 8), '#3a2210', s * 0.2, 0, 0, 0, 0, s * 1.35).add(G.tor(0.08, 0.035, Math.PI * 1.5, 6, 10), '#3a2210', s * 0.42, 0.06, 0, 0, 0, s > 0 ? 0 : Math.PI);
      M.mesh(toonMat(), R.mustache, 0.003); }
    B.add(G.box(0.34, 0.12, 0.08), '#2ab0a0', 0, 1.96, 0.42).add(G.sph(0.07, 6, 5), '#1a8a7a', 0, 1.96, 0.46); // teal bow tie
    R.bodyM = B.mesh(bM, R.body);
    R.arms = [];
    for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * 0.72, 1.8, 0); R.body.add(sh);
      const A = K(); A.add(G.sph(0.22, 8, 6), '#f4f0e6', 0, 0, 0).add(G.cyl(0.15, 0.17, 0.5, 8), '#f4f0e6', 0, -0.28, 0).add(G.cyl(0.13, 0.15, 0.42, 8), '#f2c49a', 0, -0.68, 0.04).add(G.sph(0.17, 8, 6), '#f2c49a', 0, -0.94, 0.06);
      A.mesh(aM[s < 0 ? 0 : 1], sh); R.arms.push({ sh, s }); }
    R.armL = R.arms[1].sh; R.armR = R.arms[0].sh;
    R.paddle = new THREE.Group(); R.paddle.position.set(0, -0.95, 0.08); R.armR.add(R.paddle);
    { const P = K(); P.add(G.cyl(0.05, 0.05, 1.5, 6), '#a07040', 0, -0.4, 0.2, 1.2, 0, 0).add(G.box(0.36, 0.08, 0.6), '#b8844a', 0, -0.72, 0.96, 1.2, 0, 0); P.mesh(toonMat(), R.paddle, 0.003); }
    return R;
  }

  // ---------------- small helpers ----------------
  function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  function noise(dur, vol = 0.12, hp = 1200, delay = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(SFXBUS || AC.destination); s.start(t); } catch (e) {} }
  const sting = (k) => { if (k === 'tower') { for (let i = 0; i < 5; i++) tone(300 + i * 90, 320 + i * 90, 0.09, 'square', 0.06, i * 0.1); } else if (k === 'gey') { noise(0.9, 0.06, 600); tone(120, 60, 0.8, 'sawtooth', 0.05); }
    else if (k === 'spin') { for (let i = 0; i < 6; i++) tone(500, 900, 0.08, 'triangle', 0.06, i * 0.08); } else if (k === 'ding') { tone(1760, 1700, 0.5, 'triangle', 0.14); } else if (k === 'horn') { tone(220, 210, 0.5, 'sawtooth', 0.08); tone(277, 270, 0.5, 'sawtooth', 0.06); }
    else if (k === 'crash') { noise(0.8, 0.2, 300); tone(90, 40, 0.6, 'square', 0.1); } else if (k === 'splash') { noise(1.0, 0.18, 800); } else if (k === 'combo') { for (let i = 0; i < 3; i++) tone(440 * (i + 1), 460 * (i + 1), 0.14, 'square', 0.08, i * 0.14); } };
  const POPS = [];
  function pop(text, p, cls = '') { const e = document.createElement('div'); e.className = 'bwpop ' + cls; e.textContent = text; V3.copy(p).project(C.cam); e.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; e.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; DUELS.hudEl.appendChild(e); POPS.push({ e, t: 0 }); }
  C.hudPops = function (clear, dt = 0) { for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].t += dt; if (clear || POPS[i].t > 0.85) { POPS[i].e.remove(); POPS.splice(i, 1); } } };
  function puff(p, v, life = 1.0, s = 1) { if (C.puffs.length < 70) C.puffs.push({ p: p.clone(), v: v.clone(), t: 0, life, s }); }
  function spark(p, n = 6) { for (let k = 0; k < n && C.sparks.length < 60; k++) C.sparks.push({ p: p.clone(), v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 1)), t: 0, life: rnd(0.3, 0.6) }); }
  function flashBoss(c = '#ffffff', v = 0.85) { for (const m of C.R.flash) if (m && m.userData.flashC) { m.userData.flashC.value.set(c); m.userData.flash.value = v; } }
  function setM(st, s, dur) { st.ms = s; st.mt = 0; st.mdur = dur; st.hitThis = false; st.dodged = false; st.gotHit = false; }
  function setLabels(map, hint) { C.labels = map; C.lbl = false; const h = DUELS.hudEl.querySelector('.dhint'); if (h) h.innerHTML = hint; }

  // ---------------- arenas ----------------
  function fxLayer(sc) { // per-scene particle layers (puffs / sparks / foam), pooled
    const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#fff6d8'), transparent: true, depthWrite: false, fog: false }), 70); pm.count = 0; pm.frustumCulled = false; sc.add(pm);
    const sp = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffd86a', false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 60); sp.count = 0; sp.frustumCulled = false; sc.add(sp);
    return { pm, sp };
  }
  function duelFx(sc, A) { // lane strips, tower pair, geysers, foam marks, tower shadows, spin band, crab cake
    A.lanes = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.03, 0.2); m.visible = false; sc.add(m); return m; });
    const shT = markTex('shadow'), foT = markTex('foam');
    A.shadows = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, MZ), new THREE.MeshBasicMaterial({ map: shT, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.05, MZ / 2 - 0.4); m.visible = false; sc.add(m); return m; });
    A.foams = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: foT, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(sx(l), 0.06, 0); m.visible = false; sc.add(m); return m; });
    const K = DUELS.kit, G = DUELS.GEO, T = K(); // one can tower (pivot at its base), cloned per lane
    for (let i = 0; i < 9; i++) T.add(G.cyl(0.3, 0.3, 0.7, 10), i % 2 ? '#d8d8e0' : '#e8c070', (i % 2 ? 0.04 : -0.04), 0.35 + i * 0.7, 0).add(G.cyl(0.31, 0.31, 0.06, 10), '#3a8a5a', 0, 0.6 + i * 0.7, 0);
    const tg = T.geo(), tm = toonMat();
    A.towers = [0, 1].map(() => { const g = new THREE.Group(), m = new THREE.Mesh(tg, tm); DUELS.inkHull(m, 0.003); g.add(m); g.visible = false; sc.add(g); return g; });
    A.geysers = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 1, 12, 1, true), new THREE.MeshLambertMaterial({ color: '#fff6dc', emissive: '#6a5a3a', transparent: true, opacity: 0.92 })); m.position.set(sx(l), 0, 0); m.visible = false; sc.add(m); return m; });
    A.band = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.4), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); A.band.rotation.x = -Math.PI / 2; A.band.position.set(0, 0.04, 0.4); A.band.visible = false; sc.add(A.band);
    A.cake = new THREE.Group(); A.cake.visible = false; sc.add(A.cake);
    { const S = K(); S.add(G.cyl(0.26, 0.28, 0.16, 12), '#c8823a', 0, 0, 0).add(G.sph(0.2, 8, 6), '#e0a050', 0, 0.06, 0, 0, 0, 0, 1, 0.4, 1); S.mesh(toonMat(), A.cake, 0.003); }
    Object.assign(A, fxLayer(sc));
  }
  function buildRoof() {
    const sc = new THREE.Scene(); sc.fog = new THREE.Fog('#1a1230', 26, 70); const A = { sc };
    DUELS.sceneLights(sc, '#a8b4ff', '#2a1a30', 1.15, '#ffd8b0', 1.1, new THREE.Vector3(-0.4, 1, -0.5));
    const sl = new THREE.PointLight('#ffb060', 26, 18, 1.3); sl.position.set(0, 6, MZ + 3); sc.add(sl); A.light = sl;
    const rt = roofTex(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(4, 4);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshLambertMaterial({ map: rt })); fl.rotation.x = -Math.PI / 2; fl.position.z = 3; sc.add(fl);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), new THREE.MeshBasicMaterial({ map: skylineTex(), fog: false })); sky.position.set(0, 9, 48); sky.rotation.y = Math.PI; sc.add(sky);
    const K = DUELS.kit, G = DUELS.GEO, R = K();
    for (const s of [-1, 1]) R.add(G.box(0.5, 1.0, 20), '#7a3a2a', s * 8, 0.5, 3).add(G.box(0.6, 0.12, 20), '#c8c0b0', s * 8, 1.04, 3);
    R.add(G.box(16.5, 1.0, 0.5), '#7a3a2a', 0, 0.5, 13).add(G.box(16.6, 0.12, 0.6), '#c8c0b0', 0, 1.04, 13);
    // water tower (screen right, world -x), AC units, the sign frame behind him
    R.add(G.cyl(1.3, 1.3, 2.4, 14), '#8a6a4a', -5.6, 4.6, 10).add(G.cone(1.45, 1.0, 14), '#5a4a3a', -5.6, 6.3, 10);
    for (const x of [-6.2, -5.0]) R.add(G.cyl(0.08, 0.08, 3.4, 5), '#3a3440', x, 1.7, 9.4).add(G.cyl(0.08, 0.08, 3.4, 5), '#3a3440', x, 1.7, 10.6);
    R.add(G.box(1.6, 1.0, 1.2), '#8a8e96', 5.4, 0.5, 8).add(G.box(1.6, 1.0, 1.2), '#8a8e96', 5.6, 0.5, 2.5).add(G.cyl(0.4, 0.4, 0.1, 10), '#3a3a40', 5.4, 1.05, 8);
    for (const x of [-4, 0, 4]) R.add(G.box(0.18, 6, 0.18), '#2a2630', x, 3, 12.2);
    R.add(G.box(9.4, 0.2, 0.3), '#2a2630', 0, 4.1, 12.2).add(G.box(9.4, 0.2, 0.3), '#2a2630', 0, 7.0, 12.2);
    sc.add(R.mesh(toonMat(), null, 0.003));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: neonSign('ONE-EYE BREWERY', 'BREWED ON THE HARBOR'), fog: false })); sign.position.set(0, 5.55, 12.0); sign.rotation.y = Math.PI; sc.add(sign); A.sign = sign;
    duelFx(sc, A); return A;
  }
  function buildYard() {
    const sc = new THREE.Scene(); sc.fog = new THREE.Fog('#141030', 26, 80); const A = { sc };
    DUELS.sceneLights(sc, '#9aa8ff', '#2a1a20', 1.1, '#ffcf9a', 1.0, new THREE.Vector3(0.5, 1, -0.4));
    const sl = new THREE.PointLight('#ff9a40', 30, 20, 1.3); sl.position.set(4, 6, MZ + 1); sc.add(sl); A.light = sl;
    const bt = brickTex(false); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(5, 6);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshLambertMaterial({ map: bt, color: '#b0a0a0' })); fl.rotation.x = -Math.PI / 2; fl.position.z = 2.5; sc.add(fl);
    const wat = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshLambertMaterial({ color: '#16304a', emissive: '#0a1a2c' })); wat.rotation.x = -Math.PI / 2; wat.position.set(0, -1.2, 44); sc.add(wat); A.water = wat;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(140, 32), new THREE.MeshBasicMaterial({ map: skylineTex(), fog: false })); sky.position.set(0, 10, 66); sky.rotation.y = Math.PI; sc.add(sky);
    const K = DUELS.kit, G = DUELS.GEO, R = K();
    R.add(G.box(18, 0.3, 0.3), '#2a2630', 0, 1.1, 9.4).add(G.box(18, 0.12, 0.12), '#2a2630', 0, 0.6, 9.4); // railing over the harbor
    for (let x = -8; x <= 8; x += 2) R.add(G.box(0.12, 1.1, 0.12), '#2a2630', x, 0.55, 9.4);
    R.add(G.box(18, 1.4, 0.6), '#5a5660', 0, -0.6, 9.8); // pier edge
    for (let k = 0; k < 3; k++) R.add(G.cyl(1.0, 1.1, 2.6, 14), '#c87a3a', -5.6, 1.3, 2 + k * 2.4).add(G.sph(1.0, 12, 8), '#d88a4a', -5.6, 2.6, 2 + k * 2.4, 0, 0, 0, 1, 0.6, 1).add(G.cyl(0.12, 0.12, 2, 6), '#a06030', -5.6, 3.8, 2 + k * 2.4); // copper kettles (screen right)
    for (let k = 0; k < 6; k++) R.add(G.cyl(0.42, 0.42, 0.8, 12), '#9a9ea8', 5.6 + (k % 3) * 0.9, 0.4 + Math.floor(k / 3) * 0.8, 3.4); // keg stack
    sc.add(R.mesh(toonMat(), null, 0.003));
    // the brewhouse wall + brew tower (screen left, world +x) with the lit original sign
    const bw = brickTex(true); bw.wrapS = THREE.RepeatWrapping; bw.repeat.set(2, 1);
    const house = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 14), new THREE.MeshLambertMaterial({ map: bw })); house.position.set(8.6, 4, 3); sc.add(house);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 18, 3.4), new THREE.MeshLambertMaterial({ map: bw })); tower.position.set(5.6, 9, 12.2); sc.add(tower);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: neonSign('ONE-EYE', 'BREWERY · EST. ON THE HARBOR', 512, 128), fog: false })); sign.position.set(5.6, 14.5, 10.45); sign.rotation.y = Math.PI; sc.add(sign); A.sign = sign;
    duelFx(sc, A); return A;
  }
  function buildChase() {
    const sc = new THREE.Scene(); sc.fog = new THREE.Fog('#1a1430', 30, 95); const A = { sc };
    DUELS.sceneLights(sc, '#a8b4ff', '#2a1a30', 1.2, '#ffd8b0', 1.0, new THREE.Vector3(0.3, 1, 0.5));
    A.roadT = roadTex(); A.roadT.wrapS = A.roadT.wrapT = THREE.RepeatWrapping; A.roadT.repeat.set(1, 12);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(LANE2 * 3 + 0.6, 160), new THREE.MeshLambertMaterial({ map: A.roadT })); road.rotation.x = -Math.PI / 2; road.position.z = 60; sc.add(road);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(3, 160), new THREE.MeshLambertMaterial({ color: '#8a8478' })); sw.rotation.x = -Math.PI / 2; sw.position.set(s * (LANE2 * 1.5 + 1.8), 0.12, 60); sc.add(sw); }
    A.rowT = rowTex(); A.rowT.wrapS = THREE.RepeatWrapping; A.rowT.repeat.set(14, 1);
    A.rows = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 9), new THREE.MeshLambertMaterial({ map: A.rowT, emissive: '#2a1a10' })); m.position.set(s * (LANE2 * 1.5 + 3.3), 4.5, 60); m.rotation.y = s * -Math.PI / 2 * -1; m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; sc.add(m); return m; });
    // street lamps (instanced, wrap around), the brewery tower far ahead (grows nearer with each ram)
    A.lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), new THREE.MeshLambertMaterial({ color: '#2a2630' }), 12); A.lamps.frustumCulled = false; sc.add(A.lamps);
    A.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffcf6a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 12); A.glows.frustumCulled = false; sc.add(A.glows);
    A.lampZ = Array.from({ length: 12 }, (_, i) => (i >> 1) * 14 + (i & 1) * 7);
    const bw = brickTex(true); A.btower = new THREE.Group(); sc.add(A.btower);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), new THREE.MeshLambertMaterial({ map: bw })); tw.position.y = 11; A.btower.add(tw);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: neonSign('ONE-EYE', 'BREWERY', 512, 128), fog: false })); sg.position.set(0, 19, -2.6); sg.rotation.y = Math.PI; A.btower.add(sg);
    // the truck (original livery) + Mavis's convertible
    const K = DUELS.kit, G = DUELS.GEO;
    A.truck = new THREE.Group(); sc.add(A.truck);
    { const T = K(); T.add(G.box(2.1, 1.5, 1.6), '#1f5a3a', 0, 1.25, 2.3).add(G.box(1.9, 0.7, 0.06), '#9fd8ff', 0, 1.65, 3.12).add(G.box(2.2, 0.3, 0.4), '#c8c0b0', 0, 0.55, 3.2)
      .add(G.box(2.3, 2.3, 4.0), '#123a26', 0, 1.7, -0.6).add(G.box(2.32, 0.2, 4.02), '#e8c070', 0, 0.6, -0.6);
      for (const s of [-1, 1]) for (const z of [2.2, -1.6]) T.add(G.cyl(0.45, 0.45, 0.3, 12), '#141018', s * 1.08, 0.45, z, 0, 0, Math.PI / 2);
      T.add(G.box(0.3, 0.2, 0.06), '#ff3030', 0.9, 1.0, -2.62).add(G.box(0.3, 0.2, 0.06), '#ff3030', -0.9, 1.0, -2.62);
      for (let k = 0; k < 3; k++) T.add(G.cyl(0.32, 0.32, 0.6, 10), '#9a9ea8', -0.7 + k * 0.7, 0.95, -2.85, Math.PI / 2, 0, 0); // kegs on the tail lift
      T.mesh(toonMat(), A.truck, 0.003); }
    const lv = liveryTex(); for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.42), new THREE.MeshBasicMaterial({ map: lv })); m.position.set(s * 1.17, 1.85, -0.6); m.rotation.y = s * Math.PI / 2; A.truck.add(m); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.0), new THREE.MeshBasicMaterial({ map: neonSign('ONE-EYE', 'HOW\'S MY DRIVING?', 512, 128) })); back.position.set(0, 2.2, -2.62); back.rotation.y = Math.PI; A.truck.add(back);
    A.cab = new THREE.Group(); A.cab.position.set(0.4, 0.95, 2.4); A.truck.add(A.cab);
    A.car = new THREE.Group(); sc.add(A.car);
    { const T = K(); T.add(G.box(1.9, 0.6, 3.8), '#4ab0a8', 0, 0.62, 0).add(G.box(1.92, 0.12, 3.82), '#f4f0e6', 0, 0.95, 0).add(G.box(1.7, 0.5, 0.08), '#bfe8ff', 0, 1.25, 0.9, -0.4, 0, 0)
      .add(G.box(1.6, 0.4, 1.6), '#6a2a3a', 0, 0.85, -0.6).add(G.box(0.4, 0.14, 0.06), '#fff6c0', 0.6, 0.65, 1.92).add(G.box(0.4, 0.14, 0.06), '#fff6c0', -0.6, 0.65, 1.92);
      for (const s of [-1, 1]) for (const z of [1.2, -1.2]) T.add(G.cyl(0.36, 0.36, 0.26, 12), '#141018', s * 0.95, 0.36, z, 0, 0, Math.PI / 2);
      T.mesh(toonMat(), A.car, 0.003); }
    A.kegs = Array.from({ length: 6 }, () => { const g = new THREE.Group(), T = K(); T.add(G.cyl(0.42, 0.42, 0.9, 12), '#9a9ea8', 0, 0, 0, 0, 0, Math.PI / 2).add(G.cyl(0.43, 0.43, 0.08, 12), '#5a5e66', 0.3, 0, 0, 0, 0, Math.PI / 2).add(G.cyl(0.43, 0.43, 0.08, 12), '#5a5e66', -0.3, 0, 0, 0, 0, Math.PI / 2); T.mesh(toonMat(), g, 0.003); g.visible = false; sc.add(g); return { g, on: false }; });
    const foT = markTex('foam');
    A.slicks = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.2), new THREE.MeshBasicMaterial({ map: foT, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.visible = false; sc.add(m); return { g: m, on: false }; });
    A.strips = [-1, 0, 1].map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE2 - 0.3, 7), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(-l * LANE2, 0.05, 3.5); m.visible = false; sc.add(m); return m; });
    Object.assign(A, fxLayer(sc)); return A;
  }

  // ---------------- build ----------------
  C.build = function () {
    C.cam = new THREE.PerspectiveCamera(56, VW() / VH(), 0.1, 160);
    C.A = { 1: buildRoof(), 2: buildChase(), 3: buildYard() };
    C.H = buildHero(); C.M = buildHero({ wife: true });
    let rig = null; try { if (typeof window.buildBrewmaster === 'function') rig = window.buildBrewmaster({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    C.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    if (!rig.body) rig.body = rig.root;
    if (!rig.arms) { rig.arms = []; if (rig.armL) rig.arms.push({ sh: rig.armL, s: 1 }); if (rig.armR) rig.arms.push({ sh: rig.armR, s: -1 }); }
    rig.flash = rig.flash || []; C.R = rig;
    C.puffs = []; C.sparks = [];
    const css = document.createElement('style');
    css.textContent = `#duel .bwbang { position: absolute; left: 0; top: 0; font-size: 36px; color: #ffb040; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; transform: translate(-50%, -100%); display: none; animation: bwb .3s infinite alternate; }
    @keyframes bwb { from { transform: translate(-50%, -100%) scale(1); } to { transform: translate(-50%, -112%) scale(1.22); } }
    #duel .bwpop { position: absolute; font-size: 15px; color: #fff; text-shadow: 2px 2px 0 #14101f, -1px -1px 0 #14101f; transform: translate(-50%, -50%); animation: bwp .8s ease-out forwards; white-space: nowrap; }
    #duel .bwpop.big { font-size: 22px; color: #ffb040; } #duel .bwpop.w { font-size: 18px; color: #9dff6b; } #duel .bwpop.r { font-size: 18px; color: #ff6a6a; }
    @keyframes bwp { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.6); } 20% { transform: translate(-50%, -80%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
    #duel .bwpow { display: inline-block; width: 92px; height: 9px; border: 2px solid #14101f; background: #2a1a10; border-radius: 6px; overflow: hidden; vertical-align: middle; margin-left: 4px; }
    #duel .bwpow i { display: block; height: 100%; background: linear-gradient(#ffe0a0, #ff9a2a); }
    #duel .bwpow.full i { background: linear-gradient(#fff, #9dff6b); animation: dlow .3s infinite alternate; }
    #duel .bwbox { position: absolute; left: 0; right: 0; height: 0; background: #000; transition: height .3s; z-index: 1; }
    #duel .bwbox.t { top: 0; } #duel .bwbox.b { bottom: 0; } #duel.bwrep .bwbox { height: 11%; }
    #duel .bwrept { position: absolute; left: 14px; top: calc(11% + 8px); font-size: 13px; color: #ff4a4a; text-shadow: 2px 2px 0 #000; display: none; letter-spacing: 2px; z-index: 2; }
    #duel.bwrep .bwrept { display: block; animation: dlow .5s infinite alternate; }
    body.duel-brewmaster #duel .dtell { white-space: normal; max-width: 88vw; text-align: center; top: auto; bottom: 12%; font-size: 13px; border-color: #ffb040; }
    body.duel-brewmaster #duel .dover { background: rgba(10,8,20,.72); }
    @media (max-width: 480px) { #duel .bwpow { width: 70px; } body.duel-brewmaster #duel .dtell { font-size: 11px; } }`;
    document.head.appendChild(css);
    C.bang = document.createElement('div'); C.bang.className = 'bwbang'; C.bang.textContent = '!'; DUELS.hudEl.appendChild(C.bang);
    for (const k of ['t', 'b']) { const e = document.createElement('div'); e.className = 'bwbox ' + k; DUELS.hudEl.appendChild(e); }
    C.repT = document.createElement('div'); C.repT.className = 'bwrept'; C.repT.textContent = '\u25CF REPLAY · FINAL BLOW'; DUELS.hudEl.appendChild(C.repT);
  };

  // ---------------- parts: move the heroes + the boss into the part's scene ----------------
  function setPart(st, part) {
    st.part = part; const A = C.A[part]; C.scene = A.sc; C.fx = A;
    C.puffs.length = 0; C.sparks.length = 0;
    const R = C.R; R.root.scale.setScalar(1); R.root.rotation.set(0, Math.PI, 0); R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0);
    if (part === 2) { A.car.add(C.H.root); A.car.add(C.M.root); C.H.root.position.set(-0.45, 0.55, -0.3); C.M.root.position.set(0.45, 0.55, 0.1); C.H.root.rotation.set(0, 0, 0); C.M.root.rotation.set(0, 0, 0);
      A.cab.add(R.root); R.root.position.set(0, -0.6, 0); R.root.scale.setScalar(0.42); R.root.rotation.set(0, 0, 0); setLabels(LBL_CHASE, HINT_CHASE); }
    else { A.sc.add(C.H.root); A.sc.add(C.M.root); A.sc.add(R.root); C.H.root.position.set(0, 0, 0); C.M.root.position.set(part === 1 ? 2.7 : -2.7, 0, 0.8); R.root.position.set(0, 0, MZ); setLabels(LBL_DUEL, HINT_DUEL); }
    if (R.paddle) R.paddle.visible = part === 1;
    clearFx();
  }
  function reset(part, hp) {
    const old = C.st;
    const st = C.st = { t: 0, part: 0, hp: hp ?? (+(Q.get('brewmasterhp') || 0) || 100), bhp: part === 1 ? 100 : 50, pow: old ? old.pow * 0.5 : 0, lane: 0, rollT: 0, hopT: -1, hopY: 0, lockT: 0, swingT: -1, combo: 0, comboT: 0, swingCd: 0, hurtT: 0, inv: 0,
      ms: 'intro', mt: 0, mdur: 2.4, mixI: Math.floor(Math.random() * 2), marked: [], queue: [], comboDone: false, spinZ: MZ, hitThis: false, dodged: false, gotHit: false,
      over: false, won: false, outT: 0, stop: 0, slow: 1, slowT: 0, shake: 0, spT: -1, healUsed: false, wind: old ? old.wind : true, rec: [], rep: null,
      ch: null, stats: old && old.stats || { swings: 0, landed: 0, blocked: 0, powers: 0, dodges: 0, hops: 0, hitsTaken: 0, hits: { tower: 0, gey: 0, spin: 0, keg: 0, slick: 0 }, attacks: { tower: 0, gey: 0, spin: 0, combo: 0 }, rams: 0, caneChecks: 0, heals: 0, winds: 0, maxCombo: 0, parts: [] } };
    setPart(st, part); C.R.root.visible = true;
    if (part === 2) chaseInit(st);
    return st;
  }
  function subHud(st) { const f = st.pow >= 1, nm = st.part === 2 ? 'TURBO' : 'POWER';
    const r = st.part === 1 ? 'PART 1/3 · ROOFTOP' : st.part === 2 ? 'PART 2/3 · RAMS ' + (st.ch ? st.ch.rams : 0) + '/3' : 'PART 3/3 · BREWERY';
    DUELS.sub(nm + '<span class="bwpow' + (f ? ' full' : '') + '"><i style="width:' + Math.round(st.pow * 100) + '%"></i></span>' + (st.combo > 1 ? ' <span style="color:#ffb040">x' + st.combo + '</span>' : ''), r); }
  function partIntro(st) {
    const p = st.part;
    DUELS.banner(['', 'PART 1: THE ROOFTOP<small>THE ONE-EYED BREWMASTER</small>', 'PART 2: THE CHASE<small>CATCH THAT TRUCK! RAM HIM 3 TIMES</small>', 'PART 3: LAST CALL<small>THE BREWERY · FINAL ROUND</small>'][p], 2.4);
    DUELS.say('BREWMASTER', line(p, 'intro'), 3.4);
    if (p === 2) setTimeout(() => { if (DUELS.cur === C && C.st && C.st.part === 2) DUELS.say('MAVIS', pick(MAVIS.chase), 2.2); }, SIM ? 400 : 3600);
  }
  C.start = function () {
    C.st = null; const part = clamp(+(Q.get('brewmasterpart') || 1) | 0, 1, 3); const st = reset(part); DUELS.log.push('brewmaster:' + C.rigKind + ':part' + part); subHud(st); partIntro(st);
    C.camP = new THREE.Vector3(0, 5, -7); C.camL = new THREE.Vector3(0, 2.4, MZ);
  };
  C.retry = function () { const p = C.st.part; C.st = null; const st = reset(p, 100); st.ms = p === 2 ? 'chase' : 'guard'; st.mdur = 1.4; subHud(st); DUELS.banner('PART ' + p + '<small>ANOTHER ROUND! FULL HEALTH</small>', 1.6); DUELS.log.push('brewmaster:retry:part' + p); };
  C.exit = function () { clearFx(); if (C.bang) C.bang.style.display = 'none'; DUELS.hudEl.classList.remove('bwrep'); C.hudPops(true); };

  function addPow(st, v) { const was = st.pow >= 1; st.pow = clamp(st.pow + v, 0, 1); if (!was && st.pow >= 1) { DUELS.tell(st.part === 2 ? 'TURBO READY: ACT!' : st.part === 3 ? 'POWER FULL: ACT = HON HAYMAKER!' : 'POWER FULL: ACT = CANE QUAKE!', 1.2); sting('ding'); } subHud(st); }
  function hurtHarold(st, dmg, kind) {
    if (st.inv > 0 || st.over || st.spT >= 0) return false;
    st.hp -= dmg; st.inv = 1.3; st.hurtT = 0.4; st.stats.hits[kind]++; st.stats.hitsTaken++; st.combo = 0; DUELS.hurt(); sfx('hurt'); C.hflash = 1;
    st.lockT = 0.3; st.shake = Math.max(st.shake, 0.35); st.stop = 0.06; st.gotHit = true;
    pop('-' + dmg, st.part === 2 ? V.set(C.fx.car.position.x, 2.2, 0) : V.set(sx(st.lane) * 0.95, 2.0, 0.2), 'r');
    if (st.hp <= 0) {
      if (st.wind) { st.wind = false; st.hp = 45; st.stats.winds++; st.inv = 2.0; DUELS.banner('SECOND WIND!<small>HAROLD\'S BACK UP</small>', 1.6); DUELS.say('MAVIS', MAVIS.wind, 2.2); return true; }
      st.hp = 0; st.over = true; sfx('ko'); DUELS.log.push('brewmaster:lose:part' + st.part + ':' + kind); clearFx();
      setTimeout(() => { if (DUELS.cur === C) DUELS.over('lose', 'CUT OFF!', 'The Brewmaster called last call on Harold. Retry part ' + st.part + ' with full health, or leave and come back.'); }, SIM ? 300 : 1400);
    } else if (st.hp < 38 && !st.healUsed) { st.healUsed = true; st.healT = 1.0; }
    return true;
  }
  function clearFx() { const A = C.fx; if (!A) return;
    if (A.lanes) { A.lanes.forEach((l) => { l.material.opacity = 0; l.visible = false; }); A.shadows.forEach((s) => { s.visible = false; }); A.foams.forEach((s) => { s.visible = false; }); A.towers.forEach((t) => { t.visible = false; }); A.geysers.forEach((g) => { g.visible = false; }); A.band.visible = false; A.cake.visible = false; }
    if (A.strips) { A.strips.forEach((s) => { s.visible = false; s.material.opacity = 0; }); A.kegs.forEach((k) => { k.on = false; k.g.visible = false; }); A.slicks.forEach((k) => { k.on = false; k.g.visible = false; }); } }
  function dodgeOk(st, what) { if (st.dodged) return; st.dodged = true; st.stats.dodges++; addPow(st, 0.14); pop(what || 'DODGE!', V.set(sx(st.lane) * 0.95, 2.4, 0.2), 'w'); }
  const air = (st) => st.hopY > 0.3;

  // ---------------- the Brewmaster's brain (parts 1 + 3) ----------------
  function startAttack(st, a, P) {
    st.stats.attacks[a]++;
    if (a === 'tower') { let safe = [-1, 0, 1][Math.floor(Math.random() * 3)]; if (safe === st.lane && Math.random() < 0.6) safe = [-1, 0, 1].filter((l) => l !== st.lane)[Math.floor(Math.random() * 2)];
      st.safe = safe; st.marked = [-1, 0, 1].filter((l) => l !== safe); setM(st, 'towerTell', P.tower); DUELS.tell('! CAN-TOWER SLAM! FIND THE GAP!', P.tower); sting('tower'); }
    else if (a === 'gey') { const m = [st.lane]; if (st.part === 3 || Math.random() < 0.4) m.push([-1, 0, 1].filter((l) => l !== st.lane)[Math.floor(Math.random() * 2)]); st.marked = m; st.safe = [-1, 0, 1].find((l) => !m.includes(l));
      setM(st, 'geyTell', P.gey); DUELS.tell('! FOAM GEYSER! ROLL OFF THE BUBBLES!', P.gey); sting('gey'); }
    else { st.marked = [-1, 0, 1]; st.spinZ = MZ; setM(st, 'spinTell', P.spin); DUELS.tell('! MUSTACHE-TWIRL SPIN! HOP OVER IT!', P.spin); sting('spin'); }
  }
  function nextOrOpen(st, P, extra = 0) { if (st.queue.length) { startAttack(st, st.queue.shift(), P); return; } setM(st, 'open', P.open + extra + (st.wasCombo ? 0.6 : 0)); st.wasCombo = false; }
  function bossThink(st, dt) {
    const P = PH[st.part]; st.mt += dt;
    switch (st.ms) {
      case 'intro': if (st.mt > st.mdur) setM(st, 'guard', 0.8); break;
      case 'guard': if (st.mt > st.mdur) {
          if (st.part === 3 && st.bhp <= 25 && !st.comboDone) { st.comboDone = true; st.wasCombo = true; st.stats.attacks.combo++; st.queue = ['spin', 'gey']; DUELS.banner('LAST CALL COMBO!<small>SLAM · GEYSER · SPIN</small>', 1.4); sting('combo'); DUELS.say('BREWMASTER', line(3, 'taunt'), 2.2); startAttack(st, 'tower', P); break; }
          if (st.part === 3 && st.bhp <= 25 && Math.random() < 0.35) { st.wasCombo = true; st.stats.attacks.combo++; st.queue = ['gey', 'spin']; DUELS.tell('LAST CALL COMBO!', 1.0); sting('combo'); startAttack(st, 'tower', P); break; }
          startAttack(st, P.mix[st.mixI++ % P.mix.length], P); if (Math.random() < 0.25) DUELS.say('BREWMASTER', line(st.part, 'taunt'), 2.0); }
        break;
      case 'towerTell': if (st.mt > st.mdur) { setM(st, 'tower', 0.75); sfx('swing'); } break;
      case 'tower': if (st.mt > 0.32 && !st.hitThis) { st.hitThis = true; sfx('heavy'); sting('crash'); st.shake = Math.max(st.shake, 0.4);
          for (const l of st.marked) for (let k = 0; k < 5; k++) { spark(V.set(sx(l), 0.4, rnd(0.5, MZ - 1)), 2); puff(V.set(sx(l), 0.3, rnd(0, MZ - 1)), V2.set(rnd(-1.4, 1.4), rnd(0.8, 2.2), rnd(-1, 1)), 0.7, rnd(0.5, 0.9)); }
          if (st.marked.includes(st.lane) && !(st.rollT > 0)) hurtHarold(st, DMG.tower, 'tower'); else dodgeOk(st, 'IN THE GAP!'); }
        if (st.mt > st.mdur) nextOrOpen(st, P); break;
      case 'geyTell': if (st.mt > st.mdur) { setM(st, 'gey', 0.9); noise(0.6, 0.14, 500); } break;
      case 'gey': if (st.mt > 0.08 && !st.hitThis) { st.hitThis = true; st.shake = Math.max(st.shake, 0.22);
          for (const l of st.marked) for (let k = 0; k < 8; k++) puff(V.set(sx(l), 1.4, 0), V2.set(rnd(-1.2, 1.2), rnd(3, 6), rnd(-1, 1)), 0.9, rnd(0.6, 1.1));
          if (st.marked.includes(st.lane) && !(st.rollT > 0)) hurtHarold(st, DMG.gey, 'gey'); else dodgeOk(st, 'DRY!'); }
        if (st.mt > st.mdur) nextOrOpen(st, P); break;
      case 'spinTell': if (st.mt > st.mdur) { setM(st, 'spin', 99); st.spinZ = MZ; st.spinBack = false; noise(0.5, 0.08, 2000); } break;
      case 'spin': { const z0 = st.spinZ; st.spinZ += (st.spinBack ? 1 : -1) * P.spd * dt;
          if (!st.spinBack && z0 > 0.9 && st.spinZ <= 0.9) { if (!air(st) && !(st.rollT > 0)) hurtHarold(st, DMG.spin, 'spin'); else { st.stats.hops++; dodgeOk(st, 'HOPPED IT!'); } }
          if (!st.spinBack && st.spinZ <= -0.8) st.spinBack = true;
          if (st.spinBack && st.spinZ >= MZ) { st.spinZ = MZ; nextOrOpen(st, P, 0.2); }
          break; }
      case 'open': if (st.mt > st.mdur) setM(st, 'guard', rnd(...P.guard)); break;
      case 'quaked': if (st.mt > st.mdur) setM(st, 'open', 0.9); break;
      case 'haymaker': break;
      case 'flee': fleeStep(st, dt); break;
      case 'ko': break;
    }
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 35); st.stats.heals++; st.cakeT = 0.6; DUELS.say('MAVIS', MAVIS.heal, 2.0); pop('+35 CRAB CAKE', V.set(sx(st.lane) * 0.95, 2.4, 0.2), 'w'); sfx('jump'); }
  }
  function bossHit(st, dmg, color, cls, label) { // part 1 drains 100 -> 50, part 3 50 -> 0 (damage scaled so each part lasts a few rounds)
    const d = Math.max(1, Math.round(dmg * (st.part === 3 ? 0.5 : 0.62))); st.bhp -= d; flashBoss(color); pop((label ? label + ' ' : '') + d, V.set(C.R.root.position.x, 2.6, C.R.root.position.z - 0.6), cls);
    if (Math.random() < 0.18) DUELS.say('BREWMASTER', line(st.part, 'hurt'), 1.6);
    if (st.part === 1 && st.bhp <= 50) { st.bhp = 50; startFlee(st); return; }
    if (st.part === 3 && st.bhp <= 0) { st.bhp = 0; startKO(st); }
  }

  // ---------------- part 1 end: he leaps off the roof into his truck ----------------
  function startFlee(st) { clearFx(); st.queue.length = 0; st.spT = -1; setM(st, 'flee', 3.4); st.stats.parts.push({ part: 1, t: +st.t.toFixed(1) }); DUELS.banner('HE\'S RUNNING!<small>HALF A TANK LEFT</small>', 1.8); DUELS.say('BREWMASTER', line(1, 'end'), 2.6); sting('horn'); DUELS.log.push('brewmaster:flee'); }
  function fleeStep(st, dt) {
    const R = C.R, t = st.mt;
    if (t < 1.1) { R.root.rotation.y = damp(R.root.rotation.y, 0, 8, dt); R.root.position.z = lerp(MZ, 11.8, ease(clamp((t - 0.3) / 0.8, 0, 1))); }
    else if (t < 2.0) { const u = (t - 1.1) / 0.9; R.root.position.z = lerp(11.8, 15, u); R.root.position.y = Math.sin(u * Math.PI) * 3 - u * u * 6; }
    else R.root.visible = false;
    if (t > 2.1 && !st.honked) { st.honked = true; sting('horn'); noise(0.9, 0.1, 300); }
    if (t > st.mdur) { R.root.visible = true; st.hp = Math.min(100, st.hp + 30); st.healUsed = false; setPart(st, 2); chaseInit(st); setM(st, 'chase', 0); subHud(st); partIntro(st); DUELS.log.push('brewmaster:part2'); }
  }

  // ---------------- part 2: the chase ----------------
  function chaseInit(st) { st.ch = { gap: 0.95, lane: 0, carX: 0, tl: 0, tx: 0, tlT: 2.2, rams: 0, dropT: 2.0, warnT: -1, warnLane: 0, warnKind: 'keg', ramT: -1, ramHit: false, cane: false, spinT: 0, prog: 0, crashT: -1, scroll: 0 }; st.ms = 'chase'; st.mt = 0; }
  function chaseStep(st, dt, I) {
    const c = st.ch, A = C.fx; st.mt += dt;
    if (c.crashT >= 0) { crashStep(st, dt); return; }
    // steering: one lane per press / held stick (Mavis swerves where Harold points)
    if (c.ramT < 0 && !st.over) { let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1; if (c.spinT > 0) want = c.lane; c.lane = want; }
    if (I.b) { sting('horn'); }
    if (I.c && st.pow >= 1 && c.ramT < 0 && !st.over) { st.pow = 0; st.stats.powers++; c.gap = 0; DUELS.banner('TURBO!<small>MAVIS FLOORS IT</small>', 1.0); sfx('heavy'); subHud(st); }
    else if (I.c && st.pow < 1) DUELS.tell('NEED TURBO: DODGE + CANE', 0.7);
    // truck lane changes (with a blink), gap closing, drops
    c.tlT -= dt; if (c.tlT <= 0 && c.ramT < 0) { c.tl = [-1, 0, 1].filter((l) => l !== c.tl)[Math.floor(Math.random() * 2)]; c.tlT = rnd(1.8, 2.8); }
    c.tx = damp(c.tx, -c.tl * LANE2, 3.5, dt);
    if (c.ramT < 0) c.gap = Math.max(0, c.gap - dt * 0.095);
    const truckZ = 5.2 + c.gap * 14;
    if (c.ramT < 0 && c.gap > 0.42) { c.dropT -= dt; if (c.dropT <= 0 && c.warnT < 0) { c.warnT = 0.55; c.warnLane = Math.random() < 0.7 ? c.tl : [-1, 0, 1][Math.floor(Math.random() * 3)]; c.warnKind = Math.random() < 0.68 ? 'keg' : 'slick'; DUELS.tell(c.warnKind === 'keg' ? '! KEGS! CHANGE LANES!' : '! FOAM SLICK! CHANGE LANES!', 1.2); if (Math.random() < 0.3) DUELS.say('BREWMASTER', line(2, 'taunt'), 1.8); } }
    if (c.warnT >= 0 && (c.warnT -= dt) < 0) { const pool = c.warnKind === 'keg' ? A.kegs : A.slicks, o = pool.find((k) => !k.on);
      if (o) { o.on = true; o.lane = c.warnLane; o.z = truckZ - 3; o.v = o.z / 1.35; o.hit = false; o.g.visible = true; o.g.position.set(-o.lane * LANE2, c.warnKind === 'keg' ? 0.42 : 0.07, o.z); sfx('swing'); }
      c.dropT = rnd(1.0, 1.7); }
    for (const pool of [A.kegs, A.slicks]) for (const o of pool) { if (!o.on) continue; const z0 = o.z; o.z -= o.v * dt; o.g.position.z = o.z; if (pool === A.kegs) o.g.rotation.x -= dt * 9;
      if (!o.hit && z0 > 0.6 && o.z <= 0.6) { o.hit = true; if (c.lane === o.lane && c.ramT < 0) { if (pool === A.kegs) { if (hurtHarold(st, DMG.keg, 'keg')) { c.gap = Math.min(1, c.gap + 0.14); sfx('heavy'); spark(V.set(c.carX, 1, 1.4), 10); } }
          else { if (hurtHarold(st, DMG.slick, 'slick')) { c.gap = Math.min(1, c.gap + 0.1); c.spinT = 0.8; } } } else { st.stats.dodges++; addPow(st, 0.12); pop(pool === A.kegs ? 'SWERVE!' : 'CLEAN!', V.set(c.carX, 2.2, 1), 'w'); } }
      if (o.z < -6) { o.on = false; o.g.visible = false; } }
    // ram: when the gap closes Mavis lines up with him and rams; SWING in the window = CANE CHECK
    if (c.ramT < 0 && c.gap <= 0) { c.ramT = 0; c.ramHit = false; c.cane = false; DUELS.tell('RAM HIM! SWING = CANE CHECK!', 1.0); DUELS.say('MAVIS', 'Hold on, hon!', 1.2); }
    if (c.ramT >= 0) { c.ramT += dt; c.lane = c.tl; if (I.a && c.ramT < 0.75 && !c.cane) { c.cane = true; st.swingT = 0; sfx('swing'); }
      if (c.ramT > 0.5 && !c.ramHit) { c.ramHit = true; c.rams++; st.stats.rams++; sfx('heavy'); sting('crash'); st.shake = 0.5; st.stop = 0.09; spark(V.set(c.tx, 1.4, 4.2), 18); flashBoss('#ff8a6a', 1);
        pop((c.cane ? 'CANE CHECK! ' : 'RAM! ') + c.rams + '/3', V.set(c.tx, 3, 5), 'big'); addPow(st, c.cane ? 0.3 : 0.18); if (c.cane) st.stats.caneChecks++;
        DUELS.say('BREWMASTER', line(2, 'hurt'), 1.8); subHud(st); }
      if (c.ramT > 1.05) { c.ramT = -1; c.gap = 0.75; c.tl = [-1, 0, 1].filter((l) => l !== c.tl)[Math.floor(Math.random() * 2)]; c.tlT = rnd(1.6, 2.4); if (c.rams >= 3) { c.crashT = 0; clearFx(); DUELS.banner('OFF THE ROAD!<small>THE BREWERY GATES</small>', 2.0); DUELS.say('BREWMASTER', line(2, 'end'), 2.6); st.stats.parts.push({ part: 2, t: +st.t.toFixed(1) }); DUELS.log.push('brewmaster:crash'); } } }
    c.carX = damp(c.carX, -c.lane * LANE2 * (c.ramT >= 0 ? 0.6 : 1) + (c.ramT >= 0 ? c.tx * 0.4 : 0), 7, dt);
    c.prog = clamp(c.rams / 3 + (1 - c.gap) * 0.1, 0, 1);
    if (st.healT > 0 && (st.healT -= dt) <= 0) { st.hp = Math.min(100, st.hp + 30); st.stats.heals++; DUELS.say('MAVIS', 'Crab cake from the glovebox, hon!', 1.8); pop('+30 CRAB CAKE', V.set(c.carX, 2.4, 0), 'w'); }
    if (st.swingT >= 0) { st.swingT += dt; if (st.swingT > 0.3) st.swingT = -1; }
    if (I.a && c.ramT < 0 && st.swingT < 0) { st.swingT = 0; sfx('swing'); }
    c.scroll += dt * (c.crashT >= 0 ? 4 : 22);
  }
  function crashStep(st, dt) {
    const c = st.ch; c.crashT += dt; c.scroll += dt * Math.max(0, 14 - c.crashT * 8); const A = C.fx;
    c.tx = damp(c.tx, -6, 1.5, dt); c.gap = Math.min(1.2, c.gap + dt * 0.25);
    if (c.crashT > 0.9 && !c.boom) { c.boom = true; sting('crash'); st.shake = 0.7; for (let k = 0; k < 16; k++) puff(V.set(c.tx, 1.5, 5.2 + c.gap * 14), V2.set(rnd(-2, 2), rnd(1, 4), rnd(-1, 2)), 1.2, rnd(0.8, 1.6)); }
    if (c.crashT > 2.8) { c.boom = false; st.hp = Math.min(100, st.hp + 30); st.healUsed = false; st.bhp = 50; setPart(st, 3); setM(st, 'intro', 2.0); subHud(st); partIntro(st); DUELS.log.push('brewmaster:part3'); }
  }

  // ---------------- KO + final-blow replay + into the harbor ----------------
  function startKO(st) { clearFx(); st.queue.length = 0; setM(st, 'ko', 99); st.over = true; st.won = true; st.outT = 0; st.koAt = st.t; st.slow = 0.3; st.slowT = 1.1; DUELS.banner('K.O.!<small>LAST CALL</small>', 1.6); sting('ding'); sfx('ko'); st.stats.parts.push({ part: 3, t: +st.t.toFixed(1) }); DUELS.log.push('brewmaster:ko'); }
  function outro(st, dt) {
    st.outT += dt; const t = st.outT, R = C.R;
    if (t < 1.2) { R.root.position.z = damp(R.root.position.z, MZ + 1.2, 3, dt); R.body.rotation.x = damp(R.body.rotation.x, -0.5, 5, dt); }
    if (t >= 1.2 && !st.rep && !st.repDone) { st.rep = { t: 0, a: st.koAt - 1.5, b: st.koAt + 0.35 }; DUELS.hudEl.classList.add('bwrep'); DUELS.log.push('brewmaster:replay'); }
    if (st.rep) { st.rep.t += dt; if (st.rep.t > 2.6) { st.rep = null; st.repDone = true; st.flyT = 0; DUELS.hudEl.classList.remove('bwrep'); sfx('heavy'); st.shake = 0.5; } return; }
    if (st.repDone) { st.flyT += dt; const u = clamp(st.flyT / 1.4, 0, 1);
      R.root.position.set(lerp(0, 1.5, u), Math.sin(u * Math.PI) * 4.5 - u * 2.4, lerp(MZ + 1.2, 13, u)); R.root.rotation.x = -u * 5; R.body.rotation.x = -0.6;
      if (u >= 1 && !st.splashed) { st.splashed = true; R.root.visible = false; sting('splash'); for (let k = 0; k < 24; k++) puff(V.set(1.5, -1, 13), V2.set(rnd(-2.5, 2.5), rnd(3, 7), rnd(-1.5, 1.5)), 1.3, rnd(0.6, 1.3)); DUELS.say('BREWMASTER', defeatLine(), 3.2); }
      if (st.flyT > 3.0 && !st.winDone) { st.winDone = true; DUELS.bossCleared('brewery', 'brewmaster-finale');
        try { dispatchEvent(new CustomEvent('tcb:finale', { detail: { boss: 'brewmaster', stats: st.stats } })); } catch (e) {}
        const h = st.stats.hitsTaken, g = h <= 4 ? 'S' : h <= 10 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; DUELS.log.push('brewmaster:grade:' + g);
        setTimeout(() => { if (DUELS.cur === C) DUELS.over('win', 'LAST CALL,<br>BREWMASTER!', '<span style="color:#ffd23c;font-size:18px;letter-spacing:3px">' + '\u2605'.repeat(stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - stars) + '</span></span><br>GRADE ' + g + ' · hits taken ' + h + ' · best combo x' + st.stats.maxCombo + ' · rams ' + st.stats.rams + '/3'
          + '<br><br><span style="color:#ffb040">THE END?</span><br>Every gang in Toad City poured through the One-Eye Brewery. Not anymore. The sign is dark, the harbor is quiet, and the stoops belong to the neighbors again.<br>Thanks for playing, hon. Rematch any time at the brewery ring.'); }, SIM ? 300 : 1200); }
    }
  }

  // ---------------- Harold (parts 1 + 3) ----------------
  C.step = function (dt0, I) {
    const st = C.st; if (!st) return;
    C.hudPops(false, dt0);
    if (st.stop > 0) { st.stop -= dt0; return; } // hitstop
    if (st.slowT > 0) { st.slowT -= dt0; if (st.slowT <= 0) st.slow = 1; }
    const dt = dt0 * st.slow; st.t += dt;
    st.inv -= dt; st.hurtT -= dt; st.swingCd -= dt; st.lockT -= dt; st.comboT -= dt; st.rollT -= dt; if (st.comboT <= 0 && st.combo) { st.combo = 0; subHud(st); }
    if (st.cakeT > 0) st.cakeT -= dt;
    if (st.part === 2) { chaseStep(st, dt, I); DUELS.bars(st.hp / 100, st.bhp / 100); return; }
    if (!st.over && st.spT < 0 && st.ms !== 'flee') {
      let want = 0; if (I.mx < -0.5 || I.lh) want = -1; else if (I.mx > 0.5 || I.rh) want = 1;
      if (st.lockT > 0) want = st.lane; else if (st.swingT >= 0) want = st.lane;
      if (want !== st.lane) { st.lane = want; st.rollT = 0.22; } // ROLL: a short i-frame window on every lane change
      if (I.b && st.hopT < 0 && st.lockT <= 0) { st.hopT = 0; sfx('jump'); }
      const can = st.swingCd <= 0 && st.hurtT <= 0 && st.hopT < 0;
      if (I.c && st.pow >= 1 && ['open', 'guard', 'intro', 'towerTell', 'geyTell', 'spinTell', 'quaked'].includes(st.ms)) startSpecial(st);
      else if (I.c && st.pow < 1 && st.swingCd <= 0) { DUELS.tell('NEED POWER: HIT + DODGE', 0.8); st.swingCd = 0.3; }
      else if (I.a && can) { const k = st.comboT > 0 ? st.combo % 3 : 0; st.swingT = 0; st.swingK = k; st.swingCd = k === 2 ? 0.44 : 0.24; st.swingHit = false; st.stats.swings++; sfx('swing'); }
      if (st.swingT >= 0) { st.swingT += dt; if (st.swingT > 0.09 && !st.swingHit) { st.swingHit = true; landSwing(st); } if (st.swingT > (st.swingK === 2 ? 0.42 : 0.22)) st.swingT = -1; }
    }
    if (st.hopT >= 0) { st.hopT += dt; const u = st.hopT / 0.55; st.hopY = Math.sin(clamp(u, 0, 1) * Math.PI) * 1.1; if (u >= 1) { st.hopT = -1; st.hopY = 0; } }
    if (st.spT >= 0) stepSpecial(st, dt);
    bossThink(st, dt); stepFx(dt);
    DUELS.bars(st.hp / 100, st.bhp / 100);
    if (st.ms === 'ko') outro(st, dt);
  };
  const WORDS = [['WHAP!', 'TAP!', 'BONK!'], ['WHACK!', 'THWAP!'], ['CHEERS!', 'BOTTOMS UP!', 'CLOSING TIME!']];
  function landSwing(st) {
    const k = st.swingK; V.set(sx(st.lane) * 0.5 + rnd(-0.3, 0.3), k === 2 ? 2.6 : 1.8, MZ - 0.8);
    if (st.ms === 'open' || st.ms === 'quaked') {
      const crit = st.ms === 'open' && st.mt < 0.4, dmg = SWING[k] + (crit ? 2 : 0); st.stats.landed++; st.combo++; st.comboT = 1.1; st.stats.maxCombo = Math.max(st.stats.maxCombo, st.combo);
      sfx(k === 2 ? 'heavy' : 'hit'); spark(V, k === 2 ? 18 : 6); st.stop = k === 2 ? 0.09 : 0.065; st.shake = Math.max(st.shake, k === 2 ? 0.34 : 0.12);
      if (k === 2) { st.upT = 0.5; for (let i = 0; i < 6; i++) puff(V, V2.set(rnd(-1.5, 1.5), rnd(1.5, 3), rnd(-1, 1)), 0.7, 0.5); } // LAST CALL UPPERCUT: he pops up off his feet
      addPow(st, k === 2 ? 0.1 : 0.055);
      bossHit(st, dmg, k === 2 ? '#ffb040' : '#ffffff', k === 2 || crit ? 'big' : '', k === 2 ? pick(WORDS[2]) : '');
    } else if (['guard', 'intro'].includes(st.ms)) { st.stats.blocked++; st.combo = 0; sfx('hit'); spark(V, 3); DUELS.tell('BLOCKED! WAIT FOR THE OPENING!', 0.7); }
    else { st.combo = 0; }
    subHud(st);
  }
  // POWER: part 1 CANE QUAKE (Harold solo), part 3 HON HAYMAKER (team-up with Mavis)
  function startSpecial(st) { st.spT = 0; st.spHit = false; st.pow = 0; st.stats.powers++; st.inv = 3.5; st.lane = 0; st.hopT = -1; st.hopY = 0; clearFx(); st.queue.length = 0; C.puffs.length = 0;
    if (st.part === 3) { setM(st, 'haymaker', 3.0); st.slow = 0.55; st.slowT = 2.0; DUELS.banner('HON HAYMAKER!<small>MAVIS + HAROLD TEAM-UP</small>', 2.0); DUELS.say('MAVIS', MAVIS.hay, 1.8); }
    else { setM(st, 'quaked', 2.4); st.slow = 0.6; st.slowT = 1.0; DUELS.banner('CANE QUAKE!<small>POWER</small>', 1.5); }
    sting('ding'); subHud(st); }
  function stepSpecial(st, dt) {
    st.spT += dt; const t = st.spT;
    if (st.part === 3) {
      if (t > 0.9 && !st.spHit) { st.spHit = true; sfx('heavy'); st.stop = 0.12; st.shake = 0.6; spark(V.set(0, 1.6, MZ - 0.5), 24); for (let k = 0; k < 12; k++) puff(V.set(0, 0.5, MZ - 0.4), V2.set(rnd(-2, 2), rnd(2, 4), rnd(-1, 1)), 1.0, rnd(0.4, 0.7)); st.upT = 1.2; }
      if (t > 1.9 && !st.spHit2) { st.spHit2 = true; sfx('heavy'); st.stop = 0.14; st.shake = 0.8; spark(V.set(0, 4, MZ), 30); bossHit(st, HAYMAKER, '#ff5fa2', 'big', 'HON HAYMAKER!'); }
      if (t > 2.6) { st.spT = -1; st.spHit2 = false; if (st.ms === 'haymaker') setM(st, 'open', 1.2); }
    } else {
      if (t > 0.55 && !st.spHit) { st.spHit = true; sfx('heavy'); st.stop = 0.1; st.shake = 0.6; for (let k = 0; k < 14; k++) puff(V.set(rnd(-2, 2), 0.3, rnd(1, MZ)), V2.set(rnd(-1, 1), rnd(1, 3), rnd(-1, 1)), 0.8, rnd(0.5, 0.9)); spark(V.set(0, 1.4, MZ - 0.5), 20); bossHit(st, QUAKE, '#ffd23c', 'big', 'CANE QUAKE!'); }
      if (t > 1.2) st.spT = -1;
    }
  }
  function stepFx(dt) {
    const A = C.fx; if (!A || !A.pm) return; const m = new THREE.Matrix4(), q = C.cam.quaternion;
    for (let i = C.puffs.length - 1; i >= 0; i--) { const p = C.puffs[i]; p.t += dt; p.v.multiplyScalar(1 - dt * 1.4); p.v.y -= 3 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.puffs.splice(i, 1); }
    C.puffs.forEach((p, i) => { const s = p.s * (0.5 + p.t * 1.6); m.compose(p.p, q, V3.set(s, s, s)); A.pm.setMatrixAt(i, m); }); A.pm.count = C.puffs.length; A.pm.visible = C.puffs.length > 0; A.pm.instanceMatrix.needsUpdate = true;
    for (let i = C.sparks.length - 1; i >= 0; i--) { const p = C.sparks[i]; p.t += dt; p.v.y -= 9 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) C.sparks.splice(i, 1); }
    C.sparks.forEach((p, i) => { m.compose(p.p, q, V3.set(1, 1, 1)); A.sp.setMatrixAt(i, m); }); A.sp.count = C.sparks.length; A.sp.visible = C.sparks.length > 0; A.sp.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    let p;
    if (st.over && !st.won) return HERO_POSES.down(1, true);
    if (st.hurtT > 0) return HERO_POSES.hurt(1 - st.hurtT / 0.4);
    if (st.hopT >= 0) { p = HERO_POSES.jump(st.hopT < 0.27 ? 1 : -1); p.shR = [-1.4, 0, -0.6]; return p; }
    p = HERO_POSES.idle(t); legsStance(p, 0.22, 0.45);
    p.shR = [-1.1, 0, -0.5]; p.elR = [-0.9, 0, 0]; p.torso = [0.1, 0, 0]; p.y = Math.sin(t * 6) * 0.03;
    if (st.won) { p.shR = [-2.8, 0, -0.3]; p.shL = [-2.6, 0, 0.4]; p.y = Math.abs(Math.sin(t * 6)) * 0.12; return p; }
    if (st.swingT >= 0) { const k = st.swingK, u = clamp(st.swingT / (k === 2 ? 0.42 : 0.22), 0, 1);
      if (k === 2) { p.shR = [lerp(0.6, -3.0, u), 0, -0.3]; p.elR = [-0.2, 0, 0]; p.torso = [lerp(0.5, -0.3, u), 0, 0]; legsStance(p, 0.26, lerp(1.1, 0.2, u)); p.y += Math.sin(u * Math.PI) * 0.45; } // LAST CALL UPPERCUT
      else { const d = k === 0 ? 1 : -1; p.shR = [-1.5, 0, -0.5 + d * (u - 0.5) * 2.0]; p.elR = [-0.4, 0, 0]; p.torso = [0.15, -d * (u - 0.5) * 1.2, 0]; } }
    if (st.spT >= 0) { if (st.part === 3) { const u = clamp((st.spT - 1.2) / 0.7, 0, 1); p.shR = [lerp(0.8, -3.0, u), 0, -0.4]; p.torso = [lerp(0.5, -0.4, u), 0, 0]; p.y += u > 0 && u < 1 ? Math.sin(u * Math.PI) * 1.4 : 0; }
      else { const u = clamp(st.spT / 0.55, 0, 1); p.shR = [-0.6 - u * 2.4, 0, -0.4]; p.torso = [0.6 * u, 0, 0]; p.y += Math.sin(Math.min(1, st.spT / 0.55) * Math.PI) * 0.9; } }
    if (st.rollT > 0) { p.tilt = [0, 0, -Math.sign(st.lane || 1) * (1 - st.rollT / 0.22) * TAU * 0.5]; legsStance(p, 0.2, 1.3); p.y -= 0.3; }
    else if (st.lane) { p.torso = [0.18, 0, st.lane * 0.22]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t), cheer = st.won || st.ms === 'open' || st.spT >= 0 ? 1 : 0.35, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.6 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer;
    if (st.healT > 0 || st.cakeT > 0) { p.shR = [-2.4, 0, -0.2]; p.torso = [0.3, 0, 0]; }
    if (st.part === 3 && st.spT >= 0 && st.spT < 1.2) { p.shR = [-1.2, st.spT * 12, -1.4]; p.shL = [-1.2, -st.spT * 12, 1.4]; p.tilt = [0, st.spT * 14, 0]; } // the handbag spin
    return p; }
  function seatPose(p) { p.lgL = [-1.5, 0, 0.1]; p.lgR = [-1.5, 0, -0.1]; p.knL = [1.5, 0, 0]; p.knR = [1.5, 0, 0]; p.ftL = [0, 0, 0]; p.ftR = [0, 0, 0]; p.y = -0.25; return p; }
  function poseBoss(st, dt) {
    const R = C.R, t = st.t, u = st.mt / Math.max(0.01, st.mdur); for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4); if (st.ms === 'ko' || st.ms === 'flee') return;
    const P = PH[st.part];
    // root motion the core always owns: the spin slide
    const spinning = st.ms === 'spin';
    R.root.position.z = spinning ? st.spinZ : damp(R.root.position.z, MZ, 8, dt); R.root.position.x = damp(R.root.position.x, 0, 8, dt); R.root.position.y = damp(R.root.position.y, st.upT > 0 ? 0.9 : 0, st.upT > 0 ? 18 : 10, dt);
    if (st.upT > 0) st.upT -= dt;
    if (R.update) { try { R.update(dt, st.ms, { t, u, part: st.part, lanes: st.marked }); } catch (e) { console.error(e); R.update = null; } if (spinning) R.root.rotation.y += dt * 22; return; }
    let bodyRX = 0, bodyRZ = Math.sin(t * 1.6) * 0.05, bodyY = Math.abs(Math.sin(t * 3)) * 0.03, rootRY = Math.PI, must = Math.sin(t * 2) * 0.05; const arm = [[-0.3, 0], [-0.4, 0]];
    let glow = null;
    switch (st.ms) {
      case 'guard': case 'intro': arm[0] = [-0.5 + Math.sin(t * 4) * 0.2, 0]; arm[1] = [-1.0 + Math.sin(t * 4 + 1) * 0.25, 0]; if (R.head) R.head.rotation.z = Math.sin(t * 5) * 0.08; break;
      case 'towerTell': { const k = clamp(u, 0, 1); arm[0] = [-2.4 * k, 0.3]; arm[1] = [-2.4 * k, -0.3]; bodyRX = -0.2 * k; bodyY = 0.1 * Math.sin(st.mt * 20); glow = { c: '#ffd23c', v: 0.25 + 0.25 * (Math.sin(st.mt * 22) * 0.5 + 0.5) }; break; }
      case 'tower': arm[0] = [0.4, 0]; arm[1] = [0.4, 0]; bodyRX = 0.5; break;
      case 'geyTell': { bodyRX = 0.35; bodyY = -0.2; arm[0] = [-0.4, 0.8]; arm[1] = [-0.4, -0.8]; R.root.position.y = Math.abs(Math.sin(st.mt * 18)) * 0.08; glow = { c: '#fff6d8', v: 0.2 + 0.3 * (Math.sin(st.mt * 18) * 0.5 + 0.5) }; break; } // stomping the roof
      case 'gey': bodyRX = -0.2; arm[0] = [-2.6, 0]; arm[1] = [-2.6, 0]; break;
      case 'spinTell': { arm[1] = [-1.9, -0.6]; arm[0] = [-0.6, 0.4]; must = Math.sin(st.mt * 26) * 0.5; rootRY = Math.PI + Math.sin(st.mt * 14) * 0.25 * u; glow = { c: '#ff5fa2', v: 0.2 + 0.3 * u }; break; } // twirling the mustache
      case 'spin': arm[0] = [-1.5, 1.2]; arm[1] = [-1.5, -1.2]; must = 0.6; break;
      case 'open': bodyRX = 0.45 + Math.sin(st.mt * 9) * 0.05; arm[0] = [0.4, 0.3]; arm[1] = [0.4, -0.3]; bodyY = -0.1; rootRY = Math.PI + Math.sin(st.mt * 5) * 0.25; if (Math.random() < dt * 6) { V3.set(R.root.position.x + rnd(-0.5, 0.5), 3.1, R.root.position.z); spark(V3, 1); } break; // winded
      case 'quaked': bodyRX = -0.4; arm[0] = [-2.4, 0.4]; arm[1] = [-2.4, -0.4]; if (Math.random() < dt * 8) { V3.set(rnd(-0.5, 0.5), 3.1, MZ); spark(V3, 2); } break;
      case 'haymaker': { const k = st.mt; if (k < 0.9) { bodyRX = 0.2; } else if (k < 1.9) { R.root.position.y = Math.sin(clamp((k - 0.9) / 1.0, 0, 1) * Math.PI * 0.5) * 2.6; bodyRX = -0.6; arm[0] = [-2.8, 0]; arm[1] = [-2.8, 0]; } else { R.root.position.y = damp(R.root.position.y, 0, 6, dt); bodyRX = 0.6; } break; }
    }
    if (spinning) R.root.rotation.y += dt * 22; else { const cur = R.root.rotation.y, tgt = rootRY + Math.round((cur - rootRY) / TAU) * TAU; R.root.rotation.y = damp(cur, tgt, 10, dt); }
    R.body.position.y = damp(R.body.position.y, bodyY, 12, dt); R.body.rotation.x = damp(R.body.rotation.x, bodyRX, 10, dt); R.body.rotation.z = bodyRZ;
    if (R.mustache) R.mustache.rotation.z = damp(R.mustache.rotation.z, must, 16, dt);
    R.arms.forEach((a, i) => { a.sh.rotation.x = damp(a.sh.rotation.x, arm[i][0], 14, dt); a.sh.rotation.y = damp(a.sh.rotation.y, arm[i][1], 14, dt); });
    for (const m of R.flash) if (m && m.userData.flash) m.userData.flash.value = Math.max(0, m.userData.flash.value - dt * 4);
    if (glow && R.flash[0] && R.flash[0].userData.flash) { R.flash[0].userData.flashC.value.set(glow.c); R.flash[0].userData.flash.value = Math.max(R.flash[0].userData.flash.value, glow.v); }
    void P;
  }
  function tells(st, dt) {
    const A = C.fx, pulse = 0.62 + 0.3 * Math.sin(st.t * 28), warn = [0, 0, 0];
    const tT = st.ms === 'towerTell', tR = st.ms === 'tower';
    // can towers: rise behind him over the two marked lanes, their long shadows grow on the roof; then topple toward Harold
    let ti = 0; for (const l of [-1, 0, 1]) { const sh = A.shadows[l + 1], on = (tT || (tR && st.mt < 0.4)) && st.marked.includes(l); sh.visible = on;
      if (on) { const k = tT ? 0.35 + 0.65 * clamp(st.mt / st.mdur, 0, 1) : 1; sh.scale.set(1, k, 1); sh.position.z = MZ - 0.4 - MZ * k / 2; sh.material.opacity = 0.65 + 0.3 * Math.sin(st.t * 22); warn[l + 1] = Math.max(warn[l + 1], tR ? 0.9 : 0.4 * pulse); }
      if (st.marked.includes(l) && (tT || tR) && ti < 2) { const g = A.towers[ti++]; g.visible = true; g.position.set(sx(l), 0, MZ + 0.9);
        if (tT) { g.scale.set(1, clamp(st.mt / (st.mdur * 0.7), 0.05, 1), 1); g.rotation.x = Math.sin(st.t * 30) * 0.02 * clamp(st.mt / st.mdur, 0, 1); }
        else { g.scale.set(1, 1, 1); g.rotation.x = -Math.PI / 2 * ease(clamp(st.mt / 0.32, 0, 1)); } } }
    for (; ti < 2; ti++) A.towers[ti].visible = false;
    // foam geysers: bubbling marks for the tell, then the columns blow
    const gT = st.ms === 'geyTell', gR = st.ms === 'gey';
    for (const l of [-1, 0, 1]) { const f = A.foams[l + 1], gy = A.geysers[l + 1], on = st.marked.includes(l);
      f.visible = (gT || gR) && on; if (f.visible) { const k = gT ? 0.6 + 0.4 * clamp(st.mt / st.mdur, 0, 1) : 1; f.scale.set(k, k, k); f.rotation.z += dt * 2; f.material.opacity = 0.8 + 0.2 * Math.sin(st.t * 30); warn[l + 1] = Math.max(warn[l + 1], gR ? 0.9 : 0.45 * pulse); if (gT && Math.random() < dt * 10) puff(V.set(sx(l) + rnd(-0.4, 0.4), 0.15, rnd(-0.4, 0.4)), V2.set(0, rnd(0.6, 1.2), 0), 0.5, 0.25); }
      gy.visible = gR && on; if (gy.visible) { const h = 5.5 * Math.sin(clamp(st.mt / st.mdur, 0, 1) * Math.PI); gy.scale.set(1, Math.max(0.01, h), 1); gy.position.y = h / 2; } }
    // the spin: a red band across every lane at Harold's row, pulsing for the tell
    const sT = st.ms === 'spinTell', sR = st.ms === 'spin' && !st.spinBack; A.band.visible = sT || sR;
    if (A.band.visible) { A.band.material.opacity = sR ? 0.75 : 0.25 + 0.35 * (Math.sin(st.t * 24) * 0.5 + 0.5); if (sT) warn[0] = warn[1] = warn[2] = 0.18 * pulse; }
    A.lanes.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, warn[i], 24, dt); l.visible = l.material.opacity > 0.01; });
    // Mavis's crab cake arc
    A.cake.visible = st.cakeT > 0; if (A.cake.visible) { const k = 1 - st.cakeT / 0.6; A.cake.position.set(lerp(C.M.root.position.x, C.H.root.position.x, k), 1.2 + Math.sin(k * Math.PI) * 2, lerp(C.M.root.position.z, 0.2, k)); A.cake.rotation.y += dt * 10; }
    const bang = (tT || gT || sT) && !st.over;
    if (bang) { V3.set(C.R.root.position.x, 3.5, C.R.root.position.z).project(C.cam); C.bang.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; C.bang.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; }
    setBang(bang);
  }
  function setBang(on) { if (C.bang.__on !== on) { C.bang.__on = on; C.bang.style.display = on ? 'block' : 'none'; } }
  // final-blow replay: record the last few seconds of part 3 (boss + Harold transforms + Harold's pose), play them back slowed from a side camera
  function record(st, hp) { const R = C.R, H = C.H; st.rec.push({ t: st.t, hx: H.root.position.x, hy: H.root.position.y, hz: H.root.position.z, hr: H.root.rotation.y, p: hp,
    bx: R.root.position.x, by: R.root.position.y, bz: R.root.position.z, br: R.root.rotation.y, bb: R.body.rotation.x, a: R.arms.map((a) => a.sh.rotation.x) }); if (st.rec.length > 260) st.rec.shift(); }
  function playback(st, dt) {
    const rp = st.rep, k = clamp(rp.t / 2.6, 0, 1), tt = lerp(rp.a, rp.b, k), R = C.R, H = C.H; let f = st.rec[0];
    for (const r of st.rec) { if (r.t > tt) break; f = r; } if (!f) return;
    H.root.position.set(f.hx, f.hy, f.hz); H.root.rotation.y = f.hr; if (f.p) applyPose(H, f.p, 40, dt, true);
    R.root.visible = true; R.root.position.set(f.bx, f.by, f.bz); R.root.rotation.y = f.br; R.body.rotation.x = f.bb; R.arms.forEach((a, i) => { a.sh.rotation.x = f.a[i] ?? 0; });
    const mx = (f.hx + f.bx) / 2, my = (f.hy + f.by) / 2 + 1.3, mz = (f.hz + f.bz) / 2, ang = lerp(-0.35, 0.25, k), dist = 7.5; // a slow dolly around the side of the blow
    V.set(mx + Math.cos(ang) * dist, my + 1.2, mz + Math.sin(ang) * dist - 1.2); V2.set(mx, my, mz);
    C.camP.copy(V); C.camL.copy(V2);
  }
  C.render = function (rdt) {
    const st = C.st, dt = Math.min(0.05, rdt * (SIM || 1)) * (st.stop > 0 ? 0.15 : st.slow), t = st.t;
    const port = VH() > VW();
    if (st.part === 2) { renderChase(st, dt, port); return; }
    const H = C.H, M = C.M;
    if (st.rep) { playback(st, dt); setBang(false); }
    else {
      const hx = sx(st.lane) * 0.95, hz = st.spT >= 0 && st.part === 3 ? lerp(0, 2.8, clamp((st.spT - 1.0) / 0.4, 0, 1)) * (st.spT < 2.2 ? 1 : 0) : st.spT >= 0 ? lerp(0, 2.2, clamp(st.spT / 0.4, 0, 1)) : 0;
      H.root.position.set(damp(H.root.position.x, hx, st.rollT > 0 ? 24 : 18, dt), st.hopY, damp(H.root.position.z, hz, 10, dt));
      H.root.rotation.y = 0;
      const hp = haroldPose(st, t); applyPose(H, hp, 18, dt, false);
      if (st.part === 3 && !st.repDone) record(st, hp);
      // Mavis: by the side; the HON HAYMAKER brings her in under him
      let mx = st.part === 1 ? 2.7 : -2.7, mz = 0.8; if (st.part === 3 && st.spT >= 0 && st.spT < 2.2) { mx = 1.3; mz = MZ - 1.2; }
      M.root.position.set(damp(M.root.position.x, mx, 8, dt), 0, damp(M.root.position.z, mz, 8, dt)); M.root.rotation.y = mx > 0 ? -0.6 : 0.6; applyPose(M, mavisPose(st, t), 12, dt, false);
      poseBoss(st, dt); tells(st, dt);
    }
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); if (H.mat.userData.flashC) H.mat.userData.flashC.value.set('#ffffff'); H.mat.userData.flash.value = C.hflash * 0.8; }
    if (C.fx.sign) C.fx.sign.material.color.setScalar(st.ms === 'ko' && st.splashed ? 0.25 : 0.85 + 0.15 * Math.sin(t * 9) * (Math.random() < 0.03 ? -3 : 1));
    DUELS.hot(st.pow >= 1 && !st.over);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 1.6);
    C.cam.fov = port ? 68 : 54; C.cam.updateProjectionMatrix();
    if (!st.rep) {
      V.set(H.root.position.x * 0.55, port ? 4.4 : 4.1, port ? -5.0 : -5.6); V2.set(H.root.position.x * 0.3, port ? 1.8 : 1.6, MZ + 0.5);
      if (st.ms === 'intro' && st.t < 2.6) { const k = ease(clamp(st.mt / st.mdur, 0, 1)); V.lerpVectors(V3.set(3.0, 3.0, 2.2), V, k); V2.lerpVectors(V3.set(0, 2.6, MZ), V2, k); }
      if (st.spT >= 0) { if (st.part === 3) { V.set(-5.2, 3.4, 0.4); V2.set(0.2, 2.6, MZ - 0.8); } else { V.set(-3.6, 2.4, 1.4); V2.set(0, 1.8, MZ - 0.2); } }
      if (st.ms === 'flee') { V.set(0, 4.6, -6.2); V2.set(0, 2.2, 12); }
      if (st.ms === 'ko' && st.repDone) { V.set(-3.5, 4.0, 1.0); V2.set(1, 0.5, 11); }
      if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
      C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt));
    }
    C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = C.scene.fog.near; OUT_U.fogF.value = C.scene.fog.far;
  };
  function renderChase(st, dt, port) {
    const c = st.ch, A = C.fx, t = st.t; if (!c) return;
    A.roadT.offset.y = -(c.scroll / 13.3) % 1; A.rowT.offset.x = (c.scroll / 11.4) % 1;
    const m = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) { let z = ((A.lampZ[i] - c.scroll) % 84 + 84) % 84 - 6; const x = (i & 1 ? -1 : 1) * (LANE2 * 1.5 + 1.0); m.makeTranslation(x, 2.1, z); A.lamps.setMatrixAt(i, m); m.makeTranslation(x * 0.9, 4.2, z); A.glows.setMatrixAt(i, m); }
    A.lamps.instanceMatrix.needsUpdate = true; A.glows.instanceMatrix.needsUpdate = true; A.glows.quaternion.copy(C.cam.quaternion); A.glows.quaternion.identity();
    A.btower.position.set(-4, 0, lerp(150, 46, c.prog));
    const truckZ = 5.2 + c.gap * 14; A.truck.position.set(c.tx + (c.crashT >= 0 ? 0 : Math.sin(t * 3) * 0.08), 0, truckZ); A.truck.rotation.y = c.crashT >= 0 ? clamp(c.crashT * 0.9, 0, 1.2) : (c.ramT > 0.5 && c.ramT < 1.0 ? Math.sin((c.ramT - 0.5) * 20) * 0.12 : 0); A.truck.rotation.z = c.crashT > 0.9 ? 0.4 : 0;
    A.car.position.set(c.carX, 0, c.ramT >= 0 ? lerp(0, truckZ - 4.6, Math.sin(clamp(c.ramT / 1.05, 0, 1) * Math.PI)) : 0); A.car.rotation.y = c.spinT > 0 ? Math.sin(c.spinT * 18) * 0.5 : (c.carX - (A.car.userData.px ?? c.carX)) * -2; A.car.userData.px = c.carX; if (c.spinT > 0) c.spinT -= dt;
    // Harold leans out the right window with the cane, Mavis at the wheel
    const hp = seatPose(HERO_POSES.idle(t)); hp.torso = [0.1, 0, -0.5]; hp.shR = st.swingT >= 0 ? [-1.6, 0, lerp(-1.6, 0.4, clamp(st.swingT / 0.3, 0, 1))] : [-1.2, 0, -1.3 + Math.sin(t * 4) * 0.2]; hp.elR = [-0.3, 0, 0];
    if (st.over && !st.won) Object.assign(hp, { torso: [0.6, 0, 0] }); applyPose(C.H, hp, 18, dt, false);
    const mp = seatPose(HERO_POSES.idle(t)); mp.shL = [-1.3, 0, 0.3]; mp.shR = [-1.3, 0, -0.3]; mp.elL = mp.elR = [-0.6, 0, 0]; mp.torso = [0.15, 0, Math.sin(t * 2) * 0.05]; applyPose(C.M, mp, 18, dt, false);
    if (C.hflash > 0) { C.hflash = Math.max(0, C.hflash - dt * 5); C.H.mat.userData.flash.value = C.hflash * 0.8; }
    // the boss in the cab (a head in the window), lane warnings for incoming drops, "!" over the truck when he's about to drop
    const R = C.R; for (const mm of R.flash) if (mm && mm.userData.flash) mm.userData.flash.value = Math.max(0, mm.userData.flash.value - dt * 4);
    const warn = [0, 0, 0], pulse = 0.55 + 0.35 * Math.sin(t * 26);
    for (const pool of [A.kegs, A.slicks]) for (const o of pool) if (o.on && !o.hit) warn[o.lane + 1] = Math.max(warn[o.lane + 1], o.z < 7 ? 0.85 : 0.45 * pulse);
    if (c.warnT >= 0) warn[c.warnLane + 1] = Math.max(warn[c.warnLane + 1], 0.35 * pulse);
    A.strips.forEach((s, i) => { s.material.opacity = damp(s.material.opacity, warn[i], 20, dt); s.visible = s.material.opacity > 0.01; });
    const bang = c.warnT >= 0 && !st.over; if (bang) { V3.set(A.truck.position.x, 4.4, truckZ).project(C.cam); C.bang.style.left = ((V3.x + 1) / 2 * 100).toFixed(1) + '%'; C.bang.style.top = ((1 - V3.y) / 2 * 100).toFixed(1) + '%'; } setBang(bang);
    stepFx(dt);
    DUELS.hot(st.pow >= 1 && !st.over);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 1.6);
    C.cam.fov = port ? 72 : 58; C.cam.updateProjectionMatrix();
    V.set(c.carX * 0.5, port ? 5.6 : 4.4, port ? -7.0 : -6.6); V2.set(c.carX * 0.3 + c.tx * 0.2, 0.8, 12);
    if (c.crashT >= 0) { V.set(-1, 3.4, -3); V2.set(c.tx * 0.6, 1.5, truckZ); }
    if (st.shake > 0) { V.x += rnd(-1, 1) * st.shake * 0.35; V.y += rnd(-1, 1) * st.shake * 0.35; }
    C.camP.lerp(V, 1 - Math.exp(-7 * dt)); C.camL.lerp(V2, 1 - Math.exp(-7 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = C.scene.fog.near; OUT_U.fogF.value = C.scene.fog.far;
  }
  C.onResize = () => {};

  // ---------------- test bot: win reads every tell; mash = SWING only, never dodges; lose = stands still ----------------
  C.botThink = function (B, dt) {
    const st = C.st; if (!st || st.over) return; B.mx = 0; B.my = 0; B.bh = false; B.lh = B.rh = false; if (B.mode === 'lose') return;
    B.cd = (B.cd || 0) - dt;
    if (B.mode === 'mash') { if (B.cd <= 0) { B.a = true; B.cd = 0.25; } return; }
    if (st.part === 2) { const c = st.ch, A = C.fx; if (!c) return; const danger = [false, false, false];
      for (const pool of [A.kegs, A.slicks]) for (const o of pool) if (o.on && !o.hit && o.z < 12) danger[o.lane + 1] = true;
      if (c.warnT >= 0) danger[c.warnLane + 1] = true;
      const pref = [c.tl, 0, -1, 1]; const l = pref.find((x) => !danger[x + 1]); B.mx = l ?? 0;
      if (c.ramT >= 0 && c.ramT < 0.6 && B.cd <= 0) { B.a = true; B.cd = 0.3; } if (st.pow >= 1 && c.gap > 0.5 && B.cd <= 0) { B.c = true; B.cd = 0.5; } return; }
    if (['towerTell', 'tower', 'geyTell', 'gey'].includes(st.ms)) { B.mx = st.safe ?? 0; }
    if (st.ms === 'spin' && !st.spinBack && st.spinZ < 2.4 && st.hopT < 0 && B.cd <= 0) { B.b = true; B.cd = 0.4; }
    if (st.pow >= 1 && (st.ms === 'open') && B.cd <= 0) { B.c = true; B.cd = 0.5; }
    else if ((st.ms === 'open' || st.ms === 'quaked') && B.cd <= 0 && st.spT < 0) { B.a = true; B.cd = 0.26; }
  };
  DUELS.reg('brewmaster', C);

  // ---------------- the city side: the brewery landmark (temporary anchor), the gated ring, ?brewmaster=1 ----------------
  let L = LANDMARKS.find((l) => l.id === 'brewery');
  if (!L) { // no brewery in 03_city.js yet: the nearest street point to the north-east edge (Brewers Hill direction)
    let ax = 200, az = -70, best = null;
    for (let r = 0; r < 40 && !best; r += 1) for (let a = 0; a < 24 && !best; a++) { const x = Math.round(200 + Math.cos(a / 24 * TAU) * r), z = Math.round(-70 + Math.sin(a / 24 * TAU) * r);
      if (x > WB.x0 + 4 && x < WB.x1 - 4 && z > WB.z0 + 4 && z < WB.z1 - 4 && isRoad(x, z) && !isWater(x, z) && isRoad(x + 2, z) && isRoad(x - 2, z) && isRoad(x, z + 2) && isRoad(x, z - 2)) best = [x, z]; }
    if (best) { ax = best[0]; az = best[1]; }
    landmark('brewery', 'ONE-EYE BREWERY', ax, az, 8, { name: 'The One-Eyed Brewmaster', x: ax, z: az, final: true, temp: true });
    L = LANDMARKS[LANDMARKS.length - 1];
    if (BOSS_CLEAR.cleared.has('brewery')) { L.boss.cleared = true; BOSS_CLEAR.crime.brewery = 0; } else BOSS_CLEAR.crime.brewery = 100;
  }
  const others = () => LANDMARKS.filter((l) => l.boss && l.id !== 'brewery');
  const left = () => others().filter((l) => !l.boss.cleared).length;
  C.gate = { left, others, open: () => left() === 0 };
  if (L && L.boss) { DUELS.addTrigger('brewmaster', L, L.boss.x, L.boss.z, L.boss.x + 2.0, L.boss.z + 2.0, '#ffb040');
    const act = ACTIONS[ACTIONS.length - 1];
    Object.defineProperty(act, 'label', { get: () => { const n = left(); return n ? 'BREWMASTER: ' + n + ' LEFT' : (L.boss.cleared ? 'REMATCH BREWMASTER' : 'FIGHT BREWMASTER'); }, configurable: true });
    act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
    act.go = () => { const n = left(); if (n) { banner('BEAT ' + n + ' MORE BOSS' + (n > 1 ? 'ES' : '') + '!', 2.6); DUELS.log.push('brewmaster:gated:' + n); return; } DUELS.start('brewmaster'); };
    const bm = DUELS.BEAM.list[DUELS.BEAM.list.length - 1];
    if (bm) { bm.L = { boss: { get cleared() { return false; } } }; C.ringB = bm; // always shown; dim + slow while locked, amber when open
      MODE.ticks.push(() => { const o = left() === 0; if (bm.__o !== o) { bm.__o = o; bm.ring.material.color.set(o ? '#ffb040' : '#5a5060'); bm.beam.material.color.set(o ? '#ffb040' : '#5a5060'); } }); } }
  let n = 0; MODE.ticks.push(() => { n++; if (n === 3 && Q.has('brewmaster') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('brewmasterauto'); DUELS.start('brewmaster', ['win', 'lose', 'mash'].includes(m) ? { bot: m } : {}); } });
  window.__brewmaster = C; C.PH = PH; C.L = L;
})();

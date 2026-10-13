
// ======================= PIT BEEF PETE, LEXINGTON MARKET: the eating contest (boss 18; DESIGN.md 2026-10-12 "New bosses with their own game style" + "Fit tweaks").
// A night event inside the market hall: Harold and Pit Beef Pete (a huge hog in a butcher's apron and paper cap) side by side at a long stall counter,
// plates in front of them, Mavis behind Harold. Five courses, all Baltimore: CRAB CAKE, PIT BEEF, LAKE TROUT, CODDIES, COOKIE TOWER (fudge-topped
// cookies, described generically, no brand). Each course is a race to clear your plate first; first to 3 courses wins and Pete waddles off.
// The loop (DESIGN: "Mash to eat while a fullness meter climbs; sip lemonade to cool it; hit hiccup prompts or lose a bite; Mavis fans Harold with her
// purse between courses; Pete cheats by sliding food onto your plate, so swat it back"):
//   EAT (SWING / J / pad X): each press = one bite off Harold's plate and a little FULLNESS. A steady rhythm is best: presses closer than 0.11 s are a
//        GULP (extra fullness), three gulps in a row = a coughing fit (no eating for a moment). Fullness drains slowly by itself.
//   SIP (ACT / E / pad Y, or the left white button): lemonade, -26 fullness, 2 cups per course.
//   HICCUP: "HIC! TAP ACT!" pops up now and then (more often when Harold is full). Tap ACT inside the window (a free sip, no cup used) or Harold loses
//        a bite (food back on the plate) and gains fullness. While hiccuping he can't swallow.
//   PETE'S CHEAT: Pete glances over (tell: "PETE'S SNEAKING FOOD!", his near arm lifts), then flicks a portion along the counter at Harold's plate.
//        SWAT (JUMP / K / pad A, or the right white button) while it crosses the glowing strip by Harold's plate: it flies back onto Pete's plate.
//        Too early = a whiff (short cooldown); miss it and it lands on Harold's plate (+bites). Pete stops eating while he cheats.
//   FULLNESS 100% = Harold is too full to croak: contest lost. Pete winning 3 courses: lost. A loss offers RETRY (a fresh contest) or LEAVE.
//   Mavis fans Harold with her purse between courses (fullness drains fast) and cheers swats.
// Win: Pete pushes back his stool and waddles off, then BOSS_CLEAR.clear(<lexington district id>) (Lexington Market is its own crime district).
// Runs on the boss-duel core (09a_duel_core.js: MODE.duel, the shared HUD, RETRY / LEAVE, radio duck, panel relabel, exit back to the street).
// Entry: ACT "EAT-OFF PETE" at the market (night only; by day ACT reads "PETE: AFTER DARK"). The ring sits at window.LEX_ANCHOR when the Lexington Market
// landmark build exports one ({x, z} or {pete|boss: {x, z}} or [x, z]); otherwise at a TEMPORARY anchor on the street just north of Oriole Park, at
// the edge of the planned downtown-west district (TEMP_ANCHOR below), until the market lands.
// Tests: ?pete=1 starts the contest at load, &peteauto=win|lose plays it by itself (also ?duel=pete&duelbot=win|lose). ?petecourse=N starts at course N.
// Writing: Grok's GR4 pack (hawk-relay content/gr4_new_content.json, modes.pete_eating), embedded below as GR4_PETE.
//
// Rig hook (Opus): if window.buildPitBeefPete exists it is called as buildPitBeefPete({ THREE, toonMat, outlineMat, addOdir, QUAL }) and must return
//   { root, body?, head?, jaw?, armL?, armR?, flash?: [materials], update?(dt, mode, info) }
//   root: Object3D, origin on the floor under his seat centre, facing +z (toward the camera), about 2.6 m tall standing (he is placed behind a 0.95 m counter).
//   armL / armR: shoulder pivots (Object3D); armL is his arm nearest Harold (Harold sits on his -x side, i.e. screen left). Rest pose = forearms on the counter.
//     The mode rotates them: rotation.x (reach forward / up) and rotation.z (sweep toward Harold) are driven while he cheats.
//   jaw: pivot, rotation.x opens it (chewing). head: pivot (turns to glance at Harold). body: bob + belly scale.
//   update(dt, mode, info) (optional) is called every frame with mode one of 'eat' | 'tell' | 'slide' | 'swatted' | 'idle' | 'win' (Pete won) | 'lose' (Pete lost)
//     | 'waddle'; info = { t, chew (0..1 jaw), full (0..1 his plate eaten) }. If update exists the core skips its own part animation.
//   Missing optional pieces are skipped. Otherwise the procedural stand-in hog below is used.
(function () {
  const GR4_PETE = {"course_cards":["COURSE 1: CRAB CAKE","COURSE 2: PIT BEEF","COURSE 3: LAKE TROUT","COURSE 4: CODDIES","COURSE 5: COOKIE TOWER"],"pete_taunts":["Pull up a stool, toad. Pete don't lose at the counter.","Here, have some of mine. No, I insist. Heh.","Lake trout ain't trout, and you ain't hungry enough.","My apron's seen more beef than your whole block.","Chew faster, grandpa. The market closes at six!","Cookie tower's coming. Hope you saved room, hon."],"hiccup":["HIC! TAP NOW!","HICCUP! SIP!","HIC-HIC! STEADY!"],"swat_back":["Harold: Keep your scraps on your own plate, Pete!","Harold: Nice try. That coddie's going back to you.","Harold: I've been swatting flies since Truman, pal."],"mavis_fan":["Mavis: Breathe, Harold! Little bites, hon!","Mavis: Sip that lemonade and show him who's boss!","Mavis: You out-ate my brother at Easter. Go!"],"win":["Pete's apron strings snap. Harold takes the crown!","Last cookie down. The whole market cheers.","Pete pushes back his stool. 'Okay. You're hungry.'"],"lose":["Harold taps out. Pete licks the plate clean.","Too full to croak. Pete wins this round.","The fullness meter pops. Loosen the belt, retry."]};
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const split = (s) => { const i = s.indexOf(': '); return i > 0 && i < 10 ? [s.slice(0, i).toUpperCase(), s.slice(i + 2)] : ['', s]; };
  // course table: bites to clear, fullness per bite, Pete's bites / s, cheats this course, slide time, the taunt for it
  const COURSES = [
    { id: 'crab', name: 'CRAB CAKE', bites: 28, full: 2.0, pete: 5.0, cheats: 2, slide: 1.35, taunt: 0 },
    { id: 'beef', name: 'PIT BEEF', bites: 34, full: 2.2, pete: 6.0, cheats: 2, slide: 1.25, taunt: 3 },
    { id: 'trout', name: 'LAKE TROUT', bites: 32, full: 2.15, pete: 5.7, cheats: 3, slide: 1.15, taunt: 2 },
    { id: 'coddies', name: 'CODDIES', bites: 32, full: 2.15, pete: 6.0, cheats: 3, slide: 1.05, taunt: 1 },
    { id: 'cookie', name: 'COOKIE TOWER', bites: 38, full: 2.5, pete: 6.4, cheats: 3, slide: 0.95, taunt: 5 },
  ];
  const GULP = 0.11, SIP = 26, SIPS = 2, DRAIN = 1.6, CHEAT_BITES = 6, WIN_N = 3;
  const HX = -1.05, PX = 1.28, CZ = -0.3, TOP = 0.95, PLZ = -0.15; // Harold / Pete x, counter z centre, counter top, plate z
  const WIN0 = 0.5, WIN1 = 0.93; // swat window (fraction of the slide)
  const P = { scene: null, cam: null, title: "PETE'S PLATE", pips: 1,
    hint: '<b>J</b> eat (steady!) · <b>K</b> swat Pete\'s slide · <b>E</b> sip lemonade / beat a hiccup',
    labels: { a: 'EAT', b: 'SWAT', c: 'SIP', l: 'SIP', r: 'SWAT' } };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion();

  // ---------------- textures (all canvas; the market's own name in its real white sans lettering, stall signs original) ----------------
  function wallTex() { return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#2a2830'; g.fillRect(0, 0, w, h);
    // gray standing-seam band up top with the market name
    g.fillStyle = '#8c9096'; g.fillRect(0, 0, w, 120); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, 120);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 64px "Helvetica Neue", Arial, sans-serif'; g.fillText('LEXINGTON', w / 2, 46);
    g.font = '700 26px "Helvetica Neue", Arial, sans-serif'; const mk = 'M A R K E T'; g.fillText(mk, w / 2, 96);
    g.font = '700 20px "Helvetica Neue", Arial, sans-serif'; g.fillText('WORLD FAMOUS', 140, 70); g.fillText('SINCE 1782', w - 140, 70);
    // stall fronts with original signs
    const S = [['PIT BEEF', '#b8321e', '#ffe6b0'], ['LAKE TROUT', '#1f5a8a', '#fff'], ['CODDIES', '#e0a020', '#3a1a08'], ['CRAB CAKES', '#c8401a', '#fff2d8'], ['FUDGE COOKIES', '#4a2416', '#ffd8a8']];
    const sw = w / S.length;
    S.forEach(([t, bg, fg], i) => { const x = i * sw;
      g.fillStyle = '#6a2a20'; g.fillRect(x + 4, 140, sw - 8, h - 140); // brick pier
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 140; y < h; y += 14) g.fillRect(x + 4, y, sw - 8, 2);
      g.fillStyle = bg; g.fillRect(x + 14, 150, sw - 28, 62); g.strokeStyle = '#14101f'; g.lineWidth = 5; g.strokeRect(x + 14, 150, sw - 28, 62);
      g.fillStyle = fg; g.font = '900 ' + (t.length > 10 ? 25 : 32) + 'px ' + FONT; g.fillText(t, x + sw / 2, 182);
      g.fillStyle = '#ffd890'; g.fillRect(x + 22, 228, sw - 44, 150); // lit stall window
      g.fillStyle = 'rgba(120,70,30,.5)'; for (let k = 0; k < 4; k++) g.fillRect(x + 30 + k * (sw - 60) / 4, 300, (sw - 60) / 4 - 10, 70);
      g.fillStyle = '#e8e0d0'; g.fillRect(x + 22, 378, sw - 44, 16); });
    g.fillStyle = 'rgba(255,200,120,.08)'; g.fillRect(0, 120, w, h);
  }, 512); }
  function floorTex() { return canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#d8d0c0' : '#7a3a2a'; g.fillRect(x * 32, y * 32, 32, 32); } }, 256); }
  function frontTex() { return canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#7a3420'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
    g.fillStyle = '#ffd23c'; g.fillRect(0, 10, w, 8); g.fillRect(0, h - 18, w, 8);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 54px ' + FONT; g.lineJoin = 'round'; g.strokeStyle = '#14101f'; g.lineWidth = 10;
    g.strokeText('NIGHT MARKET EAT-OFF', w / 2, h / 2 + 2); g.fillStyle = '#fff3c4'; g.fillText('NIGHT MARKET EAT-OFF', w / 2, h / 2 + 2);
  }, 512); }

  // ---------------- food: each course is N pieces (one merged mesh each), eaten one by one ----------------
  function foodGeos(id) {
    const K = DUELS.kit, G = DUELS.GEO, out = [];
    const piece = (fn) => { const k = K(); fn(k); out.push(k.geo()); };
    if (id === 'crab') { // six round crab cakes (golden, darker flecks) + a lemon wedge on the first
      const at = [[-0.2, -0.06], [0, -0.1], [0.2, -0.06], [-0.12, 0.1], [0.12, 0.1], [0, 0.0]];
      at.forEach(([x, z], i) => piece((k) => { k.add(G.cyl(0.085, 0.095, 0.07, 12), '#d89a48', x, 0.04 + (i === 5 ? 0.07 : 0), z).add(G.sph(0.08, 10, 6), '#e8b060', x, 0.07 + (i === 5 ? 0.07 : 0), z, 0, 0, 0, 1, 0.35, 1);
        for (let f = 0; f < 3; f++) k.add(G.sph(0.018, 5, 4), f % 2 ? '#b0602a' : '#f0d8a0', x + Math.cos(f * 2.1) * 0.05, 0.095 + (i === 5 ? 0.07 : 0), z + Math.sin(f * 2.1) * 0.05);
        if (i === 0) k.add(G.cone(0.04, 0.09, 5), '#f4e04a', x - 0.06, 0.05, z - 0.09, 0, 0, Math.PI / 2); }));
    } else if (id === 'beef') { // pit beef sandwich quarters: kaiser bun, piled thin-sliced beef (pink / brown), raw onion ring, horseradish dab
      const at = [[-0.13, -0.08], [0.13, -0.08], [-0.13, 0.1], [0.13, 0.1]];
      at.forEach(([x, z]) => piece((k) => { k.add(G.cyl(0.11, 0.11, 0.04, 12), '#c88a48', x, 0.03, z);
        for (let l = 0; l < 4; l++) k.add(G.cyl(0.115 - l * 0.004, 0.12, 0.022, 10), l % 2 ? '#a8505a' : '#c87070', x + (l % 2 ? 0.01 : -0.01), 0.065 + l * 0.022, z, 0, l, 0.08 * (l % 2 ? 1 : -1));
        k.add(G.tor(0.07, 0.012, TAU, 5, 12), '#f4eef0', x, 0.155, z, Math.PI / 2, 0, 0).add(G.sph(0.1, 12, 7), '#d89a50', x, 0.175, z, 0, 0, 0, 1.1, 0.5, 1.1).add(G.sph(0.03, 6, 4), '#f8f4e0', x + 0.05, 0.2, z + 0.06, 0, 0, 0, 1, 0.4, 1); }));
    } else if (id === 'trout') { // lake trout: fried whiting fillets on white bread slices, hot-sauce dots
      for (let i = 0; i < 5; i++) piece((k) => { const x = -0.2 + i * 0.1, z = (i % 2 ? 0.05 : -0.05), y = 0.02 + i * 0.012;
        k.add(G.box(0.16, 0.025, 0.16), '#f4f0e4', x, y, z, 0, 0.3 * (i - 2), 0).add(G.box(0.17, 0.02, 0.17), '#c89a5a', x, y - 0.004, z, 0, 0.3 * (i - 2), 0)
          .add(G.sph(0.09, 10, 6), '#d8962e', x, y + 0.035, z, 0, 0.3 * (i - 2), 0, 1.25, 0.35, 0.6).add(G.sph(0.012, 4, 3), '#c81a10', x + 0.03, y + 0.06, z + 0.02).add(G.sph(0.012, 4, 3), '#c81a10', x - 0.02, y + 0.06, z - 0.02); });
    } else if (id === 'coddies') { // coddies: round golden cod-and-potato cakes, each on a saltine with a mustard dab
      const at = [[-0.2, -0.07], [0, -0.09], [0.2, -0.07], [-0.11, 0.09], [0.11, 0.09], [0, 0.0]];
      at.forEach(([x, z], i) => piece((k) => { const y = i === 5 ? 0.06 : 0; k.add(G.box(0.12, 0.012, 0.12), '#f0d8a0', x, 0.012 + y, z, 0, 0.4, 0)
        .add(G.sph(0.065, 10, 7), '#c8862e', x, 0.06 + y, z, 0, 0, 0, 1, 0.75, 1).add(G.sph(0.022, 5, 4), '#f4d020', x, 0.105 + y, z, 0, 0, 0, 1, 0.5, 1); }));
    } else { // cookie tower: soft vanilla cookies under thick fudge domes, stacked; eaten from the top down
      for (let i = 0; i < 7; i++) piece((k) => { const y = 0.03 + i * 0.075, x = Math.sin(i * 1.7) * 0.015;
        k.add(G.cyl(0.11, 0.115, 0.03, 14), '#f0d0a0', x, y, 0).add(G.sph(0.105, 14, 7), '#4a2414', x, y + 0.03, 0, 0, 0, 0, 1, 0.38, 1).add(G.sph(0.03, 5, 3), '#6a3420', x + 0.04, y + 0.065, 0.02, 0, 0, 0, 1, 0.4, 1); });
    }
    return out;
  }

  // ---------------- the stand-in Pete: a huge hog in a butcher's apron + paper cap ----------------
  function standIn() {
    const K = DUELS.kit, G = DUELS.GEO, R = { root: new THREE.Group() }, mat = toonMat(); R.flash = [mat];
    const PINK = '#f0a2a4', PINK2 = '#d8808a', DARK = '#3a1a20', AP = '#f2eee4';
    R.body = new THREE.Group(); R.root.add(R.body);
    const B = K();
    B.add(G.sph(1, 18, 14), PINK, 0, 1.35, 0, 0, 0, 0, 1.22, 1.08, 1.0) // the big round body
      .add(G.cyl(0.42, 0.5, 0.9, 10), PINK2, -0.55, 0.42, 0.05).add(G.cyl(0.42, 0.5, 0.9, 10), PINK2, 0.55, 0.42, 0.05) // stubby legs
      .add(G.sph(0.3, 8, 6), DARK, -0.55, 0.0, 0.18, 0, 0, 0, 1, 0.5, 1.3).add(G.sph(0.3, 8, 6), DARK, 0.55, 0.0, 0.18, 0, 0, 0, 1, 0.5, 1.3)
      .add(G.tor(0.14, 0.045, TAU * 0.8, 5, 10), PINK2, 0, 1.35, -1.02, 0, 0, 0); // curly tail
    // the apron: a wrapped front panel, straps, neck loop, waist tie, a few honest stains
    const ap = new THREE.CylinderGeometry(1.24, 1.3, 1.55, 18, 1, true, -1.0, 2.0); B.add(ap, AP, 0, 1.15, 0.02, 0, 0, 0, 1, 1, 0.84);
    B.add(G.box(0.16, 0.9, 0.05), AP, -0.5, 2.15, 0.62, -0.35, 0, 0.15).add(G.box(0.16, 0.9, 0.05), AP, 0.5, 2.15, 0.62, -0.35, 0, -0.15)
      .add(G.tor(1.26, 0.05, TAU, 4, 22), '#c8c0b0', 0, 1.45, 0, Math.PI / 2, 0, 0, 1, 0.82, 1)
      .add(G.sph(0.09, 6, 4), '#a8443a', 0.35, 1.25, 1.08, 0, 0, 0, 1, 1, 0.3).add(G.sph(0.07, 6, 4), '#8a4a2a', -0.3, 0.9, 1.08, 0, 0, 0, 1, 1, 0.3).add(G.sph(0.06, 6, 4), '#c8a020', 0.1, 0.75, 1.1, 0, 0, 0, 1, 1, 0.3);
    B.mesh(mat, R.body);
    // head (turns), jaw (chews), cap
    R.head = new THREE.Group(); R.head.position.set(0, 2.45, 0.1); R.body.add(R.head);
    const Hd = K();
    Hd.add(G.sph(0.66, 16, 12), PINK, 0, 0, 0, 0, 0, 0, 1.05, 0.95, 1.0)
      .add(G.cyl(0.27, 0.3, 0.32, 14), PINK2, 0, -0.08, 0.66, Math.PI / 2, 0, 0).add(G.cyl(0.255, 0.255, 0.02, 14), '#e89098', 0, -0.08, 0.83, Math.PI / 2, 0, 0)
      .add(G.sph(0.05, 6, 4), DARK, -0.09, -0.07, 0.84).add(G.sph(0.05, 6, 4), DARK, 0.09, -0.07, 0.84)
      .add(G.sph(0.11, 8, 6), '#fff', -0.25, 0.18, 0.55).add(G.sph(0.11, 8, 6), '#fff', 0.25, 0.18, 0.55)
      .add(G.sph(0.055, 6, 4), '#14101f', -0.23, 0.17, 0.65).add(G.sph(0.055, 6, 4), '#14101f', 0.23, 0.17, 0.65)
      .add(G.box(0.26, 0.06, 0.06), DARK, -0.25, 0.33, 0.6, 0, 0, -0.32).add(G.box(0.26, 0.06, 0.06), DARK, 0.25, 0.33, 0.6, 0, 0, 0.32) // sly brows
      .add(G.cone(0.2, 0.42, 6), PINK2, -0.48, 0.52, 0.0, 0.3, 0, 0.75).add(G.cone(0.2, 0.42, 6), PINK2, 0.48, 0.52, 0.0, 0.3, 0, -0.75) // ears
      .add(G.cyl(0.42, 0.46, 0.34, 14), '#ffffff', 0, 0.62, -0.06, -0.12, 0, 0.06).add(G.box(0.86, 0.08, 0.5), '#e8e8e8', 0, 0.48, 0.0, -0.12, 0, 0.06) // paper cap
      .add(G.box(0.4, 0.07, 0.02), '#c8302a', 0, 0.62, 0.38, -0.12, 0, 0.06);
    Hd.mesh(mat, R.head);
    R.jaw = new THREE.Group(); R.jaw.position.set(0, -0.3, 0.45); R.head.add(R.jaw);
    { const J = K(); J.add(G.box(0.46, 0.1, 0.32), PINK2, 0, -0.05, 0.08).add(G.box(0.4, 0.05, 0.26), '#6a1a24', 0, 0.01, 0.08).add(G.cone(0.03, 0.08, 4), '#fff8e0', -0.15, 0.04, 0.2).add(G.cone(0.03, 0.08, 4), '#fff8e0', 0.15, 0.04, 0.2); J.mesh(mat, R.jaw); }
    // arms: shoulder pivot > arm > trotter-hand (armL = his arm on Harold's side, -x)
    const arm = (s) => { const sh = new THREE.Group(); sh.position.set(s * 1.08, 1.95, 0.25); R.body.add(sh);
      const A = K(); A.add(G.sph(0.32, 10, 8), PINK, 0, 0, 0).add(G.cyl(0.24, 0.2, 1.0, 9), PINK, 0, -0.5, 0).add(G.sph(0.22, 9, 7), PINK2, 0, -1.02, 0).add(G.box(0.3, 0.1, 0.16), DARK, 0, -1.2, 0.04)
        .add(G.cyl(0.26, 0.26, 0.16, 9), AP, 0, -0.08, 0); // rolled sleeve cuff
      A.mesh(mat, sh); return sh; };
    R.armL = arm(-1); R.armR = arm(1);
    return R;
  }

  // ---------------- build ----------------
  P.build = function () {
    const sc = (P.scene = new THREE.Scene()); sc.fog = new THREE.Fog('#2a1c18', 14, 40);
    P.cam = new THREE.PerspectiveCamera(50, VW() / VH(), 0.1, 120);
    DUELS.sceneLights(sc, '#ffe8c8', '#3a2420', 1.25, '#fff0d0', 1.5, new THREE.Vector3(0.4, 1, 0.9));
    const pl = new THREE.PointLight('#ffb070', 26, 14, 1.3); pl.position.set(0, 4.2, 1.4); sc.add(pl);
    // hall: floor, back wall of stalls, side walls, a ceiling, string lights (instanced: one draw call)
    const ft = floorTex(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(8, 6);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshLambertMaterial({ map: ft })); fl.rotation.x = -Math.PI / 2; fl.position.z = 2; sc.add(fl);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), new THREE.MeshBasicMaterial({ map: wallTex(), fog: false, color: '#d8c8b8' })); wl.position.set(0, 4.3, -5.2); sc.add(wl);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshLambertMaterial({ color: '#4a2a22' })); sw.position.set(s * 9, 4.3, 1.5); sw.rotation.y = -s * Math.PI / 2; sc.add(sw); }
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe0a0', fog: false }), 44); let n = 0;
    for (const z of [-3.6, -0.6]) for (let i = 0; i < 22; i++) { const x = -8 + i * 0.76; M4.makeTranslation(x, 5.2 - Math.sin((i % 11) / 10 * Math.PI) * 0.6 + (z > -1 ? 0.4 : 0), z); bulbs.setMatrixAt(n++, M4); }
    bulbs.instanceMatrix.needsUpdate = true; sc.add(bulbs);
    // the counter: wood body, marble top, a front sign; plates; Harold's lemonade cup; the swat strip
    const K = DUELS.kit(), G = DUELS.GEO;
    K.add(G.box(7.6, TOP - 0.06, 1.0), '#6a3020', 0, (TOP - 0.06) / 2, CZ).add(G.box(7.8, 0.06, 1.15), '#efe8dc', 0, TOP - 0.03, CZ)
      .add(G.cyl(0.38, 0.3, 0.04, 18), '#fbfbf6', HX, TOP + 0.02, PLZ).add(G.cyl(0.42, 0.34, 0.04, 18), '#fbfbf6', PX, TOP + 0.02, PLZ) // plates
      .add(G.cyl(0.32, 0.32, 0.005, 18), '#d8402a', HX, TOP + 0.042, PLZ).add(G.cyl(0.35, 0.35, 0.005, 18), '#d8402a', PX, TOP + 0.042, PLZ)
      .add(G.box(0.5, 0.3, 0.3), '#c8c0b0', 3.2, TOP + 0.15, CZ - 0.25).add(G.cyl(0.08, 0.08, 0.3, 8), '#c82a1a', 2.75, TOP + 0.15, CZ - 0.3).add(G.cyl(0.07, 0.07, 0.24, 8), '#f4c820', 2.55, TOP + 0.12, CZ - 0.3) // napkins + hot sauce + mustard
      .add(G.cyl(0.07, 0.07, 0.24, 8), '#f4c820', -3.0, TOP + 0.12, CZ - 0.3).add(G.cyl(0.08, 0.08, 0.3, 8), '#c82a1a', -3.2, TOP + 0.15, CZ - 0.3);
    for (const x of [HX, PX]) K.add(G.cyl(0.32, 0.36, 0.1, 12), '#c8302a', x, 0.62, CZ - 0.9).add(G.cyl(0.05, 0.05, 0.6, 6), '#9a9aa4', x, 0.3, CZ - 0.9); // stools (behind)
    P.counter = K.mesh(toonMat(), sc);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 0.62), new THREE.MeshLambertMaterial({ map: frontTex() })); fr.position.set(0, 0.5, CZ + 0.505); sc.add(fr);
    // lemonade: a cup (lifted to Harold's mouth when he sips)
    { const C = DUELS.kit(); C.add(G.cyl(0.09, 0.07, 0.24, 10), '#fff6a0', 0, 0.12, 0).add(G.cyl(0.095, 0.095, 0.05, 10), '#f8f8f0', 0, 0.21, 0).add(G.cyl(0.012, 0.012, 0.22, 4), '#e8402a', 0.03, 0.32, 0, 0, 0, 0.2).add(G.box(0.03, 0.06, 0.08), '#f4e04a', 0.09, 0.2, 0);
      P.cup = C.mesh(toonMat(), sc); P.cupHome = new THREE.Vector3(HX - 0.62, TOP, PLZ + 0.1); P.cup.position.copy(P.cupHome); }
    P.strip = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    P.strip.rotation.x = -Math.PI / 2; P.strip.position.set(HX + 0.85, TOP + 0.012, PLZ); P.strip.renderOrder = 3; sc.add(P.strip);
    // food: per course, N piece geometries shared by both plates (+ the slide piece)
    const fm = toonMat(); P.foodMat = fm; P.food = COURSES.map((c) => { const gs = foodGeos(c.id);
      const mk = (x, s) => { const g = new THREE.Group(); g.position.set(x, TOP + 0.045, PLZ); g.scale.setScalar(s); g.visible = false; sc.add(g); return gs.map((geo) => { const m = new THREE.Mesh(geo, fm); g.add(m); return m; }); };
      const hg = mk(HX, 1.6), pg = mk(PX, 1.85); return { gs, h: hg, p: pg, hG: hg[0].parent, pG: pg[0].parent }; });
    P.slideM = new THREE.Mesh(P.food[0].gs[0], fm); P.slideM.scale.setScalar(1.6); P.slideM.visible = false; sc.add(P.slideM);
    // crumbs / sparkle (instanced quads)
    P.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffe0a0', false), transparent: true, depthWrite: false, fog: false }), 40); P.fx.count = 0; P.fx.frustumCulled = false; sc.add(P.fx); P.fxs = [];
    // Harold, Mavis (behind him, purse ready), Pete
    P.H = buildHero(); sc.add(P.H.root); P.M = buildHero({ wife: true }); sc.add(P.M.root);
    let rig = null; try { if (typeof window.buildPitBeefPete === 'function') rig = window.buildPitBeefPete({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    P.rigKind = rig && rig.root ? 'hook' : 'standin'; if (!rig || !rig.root) rig = standIn();
    for (const k of ['body', 'head', 'jaw', 'armL', 'armR']) if (!rig[k]) { rig[k] = new THREE.Group(); rig.root.add(rig[k]); }
    rig.flash = rig.flash || []; P.R = rig; rig.root.scale.setScalar(P.rigKind === 'hook' ? 1 : 0.8); sc.add(rig.root);
    P.base = { aL: rig.armL.rotation.clone(), aR: rig.armR.rotation.clone(), hd: rig.head.rotation.clone(), jw: rig.jaw.rotation.clone() };
    // extra HUD: fullness gauge + lemonade cups (inside the duel HUD, shown only for this fight)
    const css = document.createElement('style'); css.textContent = `
      #peteui { position: absolute; left: 10px; bottom: 34px; display: none; font-size: 10px; text-shadow: 2px 2px 0 #14101f; }
      body.duel-pete #peteui { display: block; }
      #peteui .fl { width: 150px; height: 13px; background: #14101f; border: 2px solid #14101f; box-shadow: 3px 3px 0 #14101f; border-radius: 7px; position: relative; overflow: hidden; margin-top: 3px; }
      #peteui .fl i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #9dff6b, #ffd23c 60%, #ff3d6e); background-size: 150px 100%; border-radius: 5px; }
      #peteui.hot .fl { animation: pfh .25s infinite alternate; } @keyframes pfh { from { box-shadow: 3px 3px 0 #14101f; } to { box-shadow: 0 0 10px 3px #ff3d6e; } }
      #peteui .cups { margin-top: 6px; color: #fff6a0; letter-spacing: 1px; } #peteui .cups b { display: inline-block; width: 10px; height: 13px; margin-left: 4px; background: #fff6a0; border: 2px solid #14101f; border-radius: 0 0 4px 4px; vertical-align: -3px; }
      #peteui .cups b.e { background: transparent; opacity: .45; }
      body.duel-pete #duel .dtell { top: 50%; font-size: 13px; }`;
    document.head.appendChild(css);
    const ui = document.createElement('div'); ui.id = 'peteui'; ui.innerHTML = '<div class="n">FULLNESS</div><div class="fl"><i></i></div><div class="cups">LEMONADE<span></span></div>'; DUELS.hudEl.appendChild(ui);
    P.ui = { el: ui, bar: ui.querySelector('.fl i'), cups: ui.querySelector('.cups span'), pn: DUELS.hudEl.querySelector('.dbar.p .n') };
  };

  // ---------------- state ----------------
  function reset(course = 0) {
    const st = P.st = { t: 0, c: course, ph: 'intro', pt: 0, pdur: course === 0 ? 2.6 : 1.8, hw: 0, pw: 0, results: [], full: 0, sips: SIPS, hRem: 0, pRem: 0,
      lastEat: -9, gulps: 0, coughT: 0, biteT: 0, biteN: 0, swatT: -1, swatCd: 0, sipT: -1, hic: null, hicT: 0, chew: 0,
      cheat: null, cheatT: 0, cheatsLeft: 0, over: false, won: false, outT: 0, hurtT: 0,
      stats: P.st && P.st.stats && P.st.retain ? P.st.stats : { bites: 0, gulps: 0, coughs: 0, sips: 0, hicOk: 0, hicMiss: 0, swats: 0, whiffs: 0, cheatsLanded: 0, cheats: 0, courses: [] } };
    startCourse(st, course); return st;
  }
  function startCourse(st, c) {
    const C = COURSES[c]; st.c = c; st.hRem = C.bites; st.pRem = C.bites * 1.15 / 1.15; st.sips = SIPS; st.cheatsLeft = C.cheats; st.cheat = null; st.hic = null;
    st.cheatT = rnd(2.2, 3.2); st.hicT = rnd(3.5, 6); st.gulps = 0; st.coughT = 0;
    P.food.forEach((f, i) => { f.hG.visible = f.pG.visible = i === c; f.h.forEach((m) => (m.visible = true)); f.p.forEach((m) => (m.visible = true)); });
    P.slideM.geometry = P.food[c].gs[0]; P.slideM.visible = false; plates(st); hud(st);
  }
  function plates(st) { const C = COURSES[st.c], F = P.food[st.c], n = F.h.length;
    const hv = Math.ceil(clamp(st.hRem / C.bites, 0, 1.6) * n - 1e-6), pv = Math.ceil(clamp(st.pRem / C.bites, 0, 1.6) * n - 1e-6);
    F.h.forEach((m, i) => (m.visible = i < hv)); F.p.forEach((m, i) => (m.visible = i < pv)); }
  function hud(st) {
    const C = COURSES[st.c]; DUELS.bars(clamp(st.hRem / C.bites, 0, 1), clamp(st.pRem / C.bites, 0, 1));
    DUELS.sub('', 'COURSE ' + (st.c + 1) + '/5 · ' + C.name + ' &nbsp; <span style="color:#9dff6b">' + st.hw + '</span>-<span style="color:#ff8ab0">' + st.pw + '</span>');
    P.ui.bar.style.width = clamp(st.full, 0, 100).toFixed(1) + '%'; P.ui.el.classList.toggle('hot', st.full > 78);
    const cups = '<b></b>'.repeat(st.sips) + '<b class="e"></b>'.repeat(SIPS - st.sips); if (P.ui.cups.__h !== cups) { P.ui.cups.innerHTML = cups; P.ui.cups.__h = cups; }
  }
  const sayLine = (s, d = 2.6) => { const [who, txt] = split(s); DUELS.say(who || 'MAVIS', txt, d); };
  const pete = (txt, d = 3) => DUELS.say('PIT BEEF PETE', txt, d);
  P.start = function (opts = {}) {
    P.st = null; const c0 = clamp(+(Q.get('petecourse') || 1) - 1, 0, 4) | 0; const st = reset(c0); DUELS.log.push('pete:' + P.rigKind + ':' + LEX.id + ':' + LEX.src);
    P.ui.pn.textContent = "HAROLD'S PLATE"; DUELS.banner('PIT BEEF PETE<small>LEXINGTON MARKET · EAT-OFF</small>', 2.4);
    pete(GR4_PETE.pete_taunts[0], 3.2);
    P.camP = new THREE.Vector3(0, 3.4, 7); P.camL = new THREE.Vector3(0, 1.4, CZ);
  };
  P.retry = function () { const st = reset(0); st.pdur = 1.8; DUELS.banner('REMATCH!<small>FRESH PLATES, EMPTY BELLY</small>', 1.6); pete(pick(GR4_PETE.pete_taunts), 2.6); };
  P.exit = function () { if (P.ui) P.ui.pn.textContent = 'HAROLD'; P.slideM.visible = false; P.strip.material.opacity = 0; };

  // ---------------- sounds (tiny Web Audio blips on the shared sfx bus) ----------------
  function blip(kind) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime, g = AC.createGain(); g.connect(SFXBUS || AC.destination);
    if (kind === 'chomp') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = rnd(700, 1100); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.start(t); s.stop(t + 0.08); }
    else if (kind === 'slurp') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.3); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); s.start(t); s.stop(t + 0.36); }
    else if (kind === 'bell') { for (let k = 0; k < 2; k++) { const o = AC.createOscillator(), g2 = AC.createGain(), t2 = t + k * 0.18; o.type = 'triangle'; o.frequency.value = 1180; g2.gain.setValueAtTime(0.14, t2); g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.45); o.connect(g2); g2.connect(SFXBUS || AC.destination); o.start(t2); o.stop(t2 + 0.5); } }
    else if (kind === 'slide') { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.5); o.connect(g); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.start(t); o.stop(t + 0.52); }
  } catch (e) {} }

  function crumbs(x, y, z, n = 5, col) { for (let k = 0; k < n && P.fxs.length < 40; k++) P.fxs.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(rnd(-1.2, 1.2), rnd(0.8, 2.4), rnd(0, 1.2)), t: 0, life: rnd(0.35, 0.7) }); }

  // ---------------- the contest ----------------
  function setPh(st, ph, dur) { st.ph = ph; st.pt = 0; st.pdur = dur; }
  function lose(st, why) {
    if (st.over) return; st.over = true; st.won = false; st.why = why; P.st.retain = true; setPh(st, 'lost', 99); st.cheat = null; P.slideM.visible = false; DUELS.log.push('pete:lose:' + why); sfx('ko');
    const txt = why === 'full' ? GR4_PETE.lose.find((l) => /full|meter/i.test(l)) || GR4_PETE.lose[1] : GR4_PETE.lose[0];
    pete(why === 'full' ? 'Heh. Belt\u2019s a little snug there, toad.' : 'Plate\u2019s clean. Pete don\u2019t lose at the counter.', 2.6);
    setTimeout(() => { if (DUELS.cur === P) DUELS.over('lose', why === 'full' ? 'TOO FULL!' : 'PETE WINS', txt + ' Retry for a fresh contest.'); }, SIM ? 300 : 1500);
  }
  function courseOver(st, harold) {
    if (st.ph !== 'eat') return; const C = COURSES[st.c]; st.results.push(harold ? 'H' : 'P'); st.stats.courses.push((harold ? 'H' : 'P') + ':' + st.t.toFixed(1)); if (harold) st.hw++; else st.pw++;
    st.cheat = null; st.hic = null; P.slideM.visible = false; P.strip.material.opacity = 0; blip('bell'); hud(st);
    if (st.hw >= WIN_N) { st.over = true; st.won = true; JUICE.ko(); setPh(st, 'waddle', 99); st.outT = 0; DUELS.banner('HAROLD WINS!<small>' + st.hw + '-' + st.pw + ' · ' + C.name + ' CLEARED</small>', 2.6); DUELS.log.push('pete:win:' + st.hw + '-' + st.pw); return; }
    if (st.pw >= WIN_N) { DUELS.banner('PETE TAKES IT<small>' + st.pw + '-' + st.hw + '</small>', 2.2); lose(st, 'courses'); return; }
    DUELS.banner((harold ? 'PLATE CLEAN!' : 'PETE\u2019S PLATE CLEAN!') + '<small>' + C.name + ' TO ' + (harold ? 'HAROLD' : 'PETE') + ' · ' + st.hw + '-' + st.pw + '</small>', 1.8);
    setPh(st, 'fan', 3.0); sayLine(GR4_PETE.mavis_fan[(st.c) % GR4_PETE.mavis_fan.length], 2.6);
  }
  function startCheat(st) { st.cheatsLeft--; st.stats.cheats++; st.cheat = { ph: 'tell', t: 0, dur: 0.75, u: 0, swatted: false, whiff: 0 }; DUELS.tell("PETE'S SNEAKING FOOD! GET READY TO SWAT", 0.9); }
  function stepCheat(st, dt) {
    const ch = st.cheat; if (!ch) return; ch.t += dt; const C = COURSES[st.c];
    if (ch.ph === 'tell') { if (ch.t > ch.dur) { ch.ph = 'slide'; ch.t = 0; ch.dur = C.slide; P.slideM.visible = true; blip('slide'); if (st.pRem > 1) { st.pRem = Math.max(0.5, st.pRem - 1); plates(st); } } }
    else if (ch.ph === 'slide') { ch.u = ch.t / ch.dur;
      if (ch.u >= 1) { st.hRem += CHEAT_BITES; st.stats.cheatsLanded++; st.cheat = null; P.slideM.visible = false; crumbs(HX, TOP + 0.2, PLZ, 6); DUELS.tell('IT LANDED! +' + CHEAT_BITES + ' BITES', 0.9); sfx('hit');
        if (Math.random() < 0.6) pete(GR4_PETE.pete_taunts[1], 2.2); plates(st); } }
    else if (ch.ph === 'back') { ch.u = ch.t / 0.45; if (ch.u >= 1) { st.pRem += 4; st.cheat = null; P.slideM.visible = false; crumbs(PX, TOP + 0.2, PLZ, 6); plates(st); } }
  }
  function trySwat(st) {
    if (st.swatCd > 0 || st.swatT >= 0) return; st.swatT = 0; st.swatCd = 0.42; sfx('swing'); const ch = st.cheat;
    if (ch && ch.ph === 'slide' && ch.u >= WIN0 && ch.u <= WIN1 + 0.04) { ch.ph = 'back'; ch.t = 0; ch.from = P.slideM.position.clone(); st.stats.swats++; sfx('hit'); crumbs(P.slideM.position.x, P.slideM.position.y, P.slideM.position.z, 6);
      DUELS.tell('SWATTED BACK!', 0.8); const l = GR4_PETE.swat_back[st.stats.swats % GR4_PETE.swat_back.length]; if (st.c === 3 || !/coddie/i.test(l)) sayLine(l, 2.2); else sayLine(GR4_PETE.swat_back[0], 2.2); }
    else if (ch && (ch.ph === 'slide' || ch.ph === 'tell')) { st.stats.whiffs++; DUELS.tell('TOO EARLY! WAIT FOR THE STRIP', 0.7); }
    else { st.swatCd = 0.3; }
  }
  function eat(st) {
    if (st.coughT > 0 || st.hic) return; const C = COURSES[st.c], dtE = st.t - st.lastEat; st.lastEat = st.t;
    st.hRem = Math.max(0, st.hRem - 1); st.full += C.full; st.stats.bites++; st.biteT = 0; st.biteN++; blip('chomp'); crumbs(HX + 0.08, TOP + 1.15, PLZ + 0.25, 2);
    if (dtE < GULP) { st.full += 3.6; st.gulps++; st.stats.gulps++; if (st.gulps === 1) DUELS.tell('TOO FAST! GULP!', 0.5); if (st.gulps >= 3) { st.coughT = 0.7; st.gulps = 0; st.stats.coughs++; DUELS.tell('*COUGH COUGH* EASY, HAROLD!', 0.8); sfx('hurt'); } }
    else st.gulps = 0;
    plates(st); if (st.hRem <= 0) courseOver(st, true);
  }
  P.step = function (dt, I) {
    const st = P.st; if (!st) return; st.t += dt; st.pt += dt; st.swatCd -= dt; st.hurtT -= dt;
    if (st.swatT >= 0 && (st.swatT += dt) > 0.32) st.swatT = -1; if (st.sipT >= 0 && (st.sipT += dt) > 0.7) st.sipT = -1; st.biteT += dt;
    const C = COURSES[st.c];
    switch (st.ph) {
      case 'intro': if (st.pt > st.pdur) { setPh(st, 'eat', 999); DUELS.banner((GR4_PETE.course_cards[st.c] || C.name) + '<small>EAT!</small>', 1.3); blip('bell');
          if (st.c > 0) pete(GR4_PETE.pete_taunts[C.taunt], 2.6); } break;
      case 'eat': {
        // inputs
        const sipBtn = I.c || I.l, swatBtn = I.b || I.r;
        if (st.hic) { st.hic.t += dt; if (sipBtn) { st.hic = null; st.stats.hicOk++; st.full = Math.max(0, st.full - 4); DUELS.tell('STEADY!', 0.5); st.sipT = 0; blip('slurp'); }
          else if (st.hic.t > st.hic.win) { st.hic = null; st.stats.hicMiss++; st.hRem = Math.min(C.bites * 1.6, st.hRem + 2); st.full += 6; DUELS.tell('HIC! LOST A BITE', 0.7); sfx('jump'); plates(st); } }
        else if (sipBtn && st.sipT < 0) { if (st.sips > 0) { st.sips--; st.stats.sips++; st.full = Math.max(0, st.full - SIP); st.sipT = 0; blip('slurp'); } else DUELS.tell('OUT OF LEMONADE THIS COURSE', 0.7); }
        if (swatBtn) trySwat(st);
        if (I.a) eat(st);
        if (st.ph !== 'eat') break;
        // fullness drains; hiccups; Pete eats or cheats
        st.coughT -= dt; st.full = Math.max(0, st.full - DRAIN * dt);
        if (!st.hic && st.sipT < 0) { st.hicT -= dt * (st.full > 55 ? 1.6 : 1); if (st.hicT <= 0) { st.hic = { t: 0, win: 1.0 - st.c * 0.04 }; st.hicT = rnd(5, 8); DUELS.tell(GR4_PETE.hiccup[st.stats.hicOk % 3].replace('TAP NOW', 'TAP ACT') + ' (ACT / E)', st.hic.win); sfx('jump'); } }
        if (!st.cheat && st.cheatsLeft > 0) { st.cheatT -= dt; if (st.cheatT <= 0 && st.pRem > 4) { startCheat(st); st.cheatT = rnd(2.4, 3.6) - st.c * 0.15; } }
        stepCheat(st, dt);
        if (!st.cheat || st.cheat.ph === 'back') { st.pRem -= C.pete * dt * (st.t % 4 < 3.4 ? 1.08 : 0.55); st.chew += dt * 9; } // he chomps in bursts
        plates(st);
        if (st.full >= 100) { st.full = 100; hud(st); lose(st, 'full'); break; }
        if (st.pRem <= 0) { st.pRem = 0; courseOver(st, false); }
        break; }
      case 'fan': st.full = Math.max(0, st.full - 16 * dt); if (st.pt > st.pdur) { startCourse(st, st.c + 1); setPh(st, 'intro', 1.4); DUELS.banner(GR4_PETE.course_cards[st.c] || COURSES[st.c].name, 1.3); } break;
      case 'waddle': winOutro(st, dt); break;
      case 'lost': break;
    }
    DUELS.hot(!!st.hic || (st.cheat && st.cheat.ph === 'slide' && st.cheat.u >= WIN0));
    stepFx(dt); hud(st);
  };
  function winOutro(st, dt) {
    st.outT += dt;
    if (!st.winSaid && st.outT > 0.6) { st.winSaid = true; pete("Okay. You're hungry. Pete knows when to push back the stool.", 3.0); }
    if (st.outT > 5.2 && !st.winDone) { st.winDone = true; clearLex(); const w = st.c === 4 ? GR4_PETE.win[1] : pick([GR4_PETE.win[0], GR4_PETE.win[2]]);
      setTimeout(() => { if (DUELS.cur === P) DUELS.over('win', 'PIT BEEF PETE<br>WADDLED OFF', w + ' Lexington Market is clear. Crime at Lexington Market: 0.'); }, SIM ? 300 : 900); }
  }
  function stepFx(dt) {
    const q = P.cam.quaternion;
    for (let i = P.fxs.length - 1; i >= 0; i--) { const p = P.fxs[i]; p.t += dt; p.v.y -= 7 * dt; p.p.addScaledVector(p.v, dt); if (p.t > p.life) P.fxs.splice(i, 1); }
    P.fxs.forEach((p, i) => { M4.compose(p.p, q, V.set(1, 1, 1)); P.fx.setMatrixAt(i, M4); }); P.fx.count = P.fxs.length; P.fx.visible = P.fxs.length > 0; P.fx.instanceMatrix.needsUpdate = true;
  }

  // ---------------- poses + render ----------------
  function haroldPose(st, t) {
    let p;
    if (st.ph === 'lost' && st.why === 'full') { p = HERO_POSES.hurt(0.6); p.torso = [-0.25, 0, 0]; p.y = -0.08; return p; }
    if (st.ph === 'waddle') { p = HERO_POSES.idle(t); legsStance(p, 0.18, 0.3); p.shL = [-2.9, 0, 0.4]; p.shR = [-2.9, 0, -0.4]; p.elL = p.elR = [-0.2, 0, 0]; p.y += Math.abs(Math.sin(t * 6)) * 0.12; p.torso = [-0.1, 0, 0]; return p; }
    p = HERO_POSES.idle(t); legsStance(p, 0.16, 0.25); p.torso = [0.22, 0, 0]; p.neck = [-0.15, 0, 0]; p.hips = [0, 0, 0];
    p.shL = [-1.0, 0, 0.35]; p.elL = [-0.9, 0, 0]; p.shR = [-1.0, 0, -0.35]; p.elR = [-0.9, 0, 0]; p.swR = [Math.PI / 2 + 1.3, 0, 0]; // forearms toward the plate, cane tucked
    if (st.biteT < 0.16) { const k = Math.sin(clamp(st.biteT / 0.16, 0, 1) * Math.PI), s = st.biteN % 2 ? 'L' : 'R'; p['sh' + s] = [-1.0 - k * 1.0, 0, (s === 'L' ? 0.35 : -0.35) * (1 - k * 0.6)]; p['el' + s] = [-0.9 - k * 1.2, 0, 0]; p.neck = [-0.15 + k * 0.25, 0, 0]; p.torso = [0.22 + k * 0.12, 0, 0]; }
    if (st.sipT >= 0) { const k = Math.sin(clamp(st.sipT / 0.7, 0, 1) * Math.PI); p.shL = [-1.0 - k * 1.3, 0, 0.25]; p.elL = [-0.9 - k * 1.0, 0, 0]; p.neck = [-0.15 - k * 0.35, 0, 0]; }
    if (st.swatT >= 0) { const u = clamp(st.swatT / 0.32, 0, 1), k = Math.sin(u * Math.PI); p.shR = [-1.2 - k * 0.3, 0, lerp(-1.1, 0.7, ease(u))]; p.elR = [-0.2, 0, 0]; p.swR = [Math.PI / 2, 0, lerp(-0.5, 0.5, u)]; p.torso = [0.2, lerp(-0.6, 0.7, ease(u)), 0]; }
    if (st.hic) { const k = Math.max(0, Math.sin(st.hic.t * 18)); p.y += k * 0.06; p.neck = [-0.4 * k, 0, 0]; }
    if (st.coughT > 0) { p.torso = [0.55 + Math.sin(st.t * 30) * 0.08, 0, 0]; p.shR = [-1.4, 0, -0.2]; p.elR = [-1.9, 0, 0]; }
    if (st.ph === 'lost') { p.torso = [0.6, 0, 0]; p.shL = p.shR = [-0.4, 0, 0]; }
    return p;
  }
  function mavisPose(st, t) { const p = HERO_POSES.idle(t);
    if (st.ph === 'fan') { const w = Math.sin(t * 22); p.shR = [-1.7 + w * 0.5, 0, -0.9 + w * 0.6]; p.elR = [-0.4, 0, 0]; p.shL = [-0.7, 0, 0.4]; p.elL = [-1.2, 0, 0]; p.torso = [0.2, -0.4, 0]; return p; }
    const cheer = st.won ? 1 : st.cheat && st.cheat.ph === 'back' ? 1 : 0.35, w = Math.sin(t * (6 + cheer * 6));
    p.shL = [-2.6 - w * 0.3 * cheer, 0, 0.5]; p.elL = [-0.3, 0, 0]; p.shR = [-1.4 - cheer * 0.9 + w * 0.25, 0, -0.4]; p.elR = [-0.5, 0, 0]; p.y = Math.abs(Math.sin(t * 5)) * 0.08 * cheer; return p; }
  function poseCup(st, dt) { const H = P.H, cup = P.cup;
    if (st.sipT >= 0) { H.haL.getWorldPosition(V); V.y += 0.02; V.z += 0.05; cup.position.lerp(V, 1 - Math.exp(-30 * dt)); cup.rotation.x = damp(cup.rotation.x, -0.5, 14, dt); }
    else { cup.position.lerp(P.cupHome, 1 - Math.exp(-14 * dt)); cup.rotation.x = damp(cup.rotation.x, 0, 14, dt); } }
  function posePete(st, dt) {
    const R = P.R, t = st.t, b = P.base, ch = st.cheat;
    let mode = 'eat'; if (st.ph === 'waddle') mode = 'waddle'; else if (st.ph === 'lost') mode = 'win'; else if (st.ph !== 'eat') mode = 'idle'; else if (ch) mode = ch.ph === 'tell' ? 'tell' : ch.ph === 'slide' ? 'slide' : 'swatted';
    // root: seated behind the counter; the win outro stands him up and waddles him off to the right
    let rx = PX + 0.15, ry = 0, rz = CZ - 1.05, yaw = 0;
    if (mode === 'waddle') { const u = st.outT; if (u > 1.2) { const k = u - 1.2; ry = Math.min(0.25, k * 0.6); yaw = Math.min(1, k / 0.6) * (Math.PI / 2 + 0.25); if (k > 0.6) { rx += (k - 0.6) * 2.0; rz -= (k - 0.6) * 0.5; ry = 0.25 + Math.abs(Math.sin(k * 7)) * 0.08; } } R.root.rotation.z = Math.sin(st.outT * 7) * (st.outT > 1.8 ? 0.09 : 0); }
    R.root.position.set(rx, ry, rz); R.root.rotation.y = yaw;
    const chew = mode === 'eat' ? Math.max(0, Math.sin(st.chew)) : mode === 'win' ? Math.max(0, Math.sin(t * 9)) * 0.6 : 0;
    if (R.update) { try { R.update(dt, mode, { t, chew, full: 1 - st.pRem / COURSES[st.c].bites }); } catch (e) { console.error(e); R.update = null; } return; }
    R.body.position.y = Math.sin(t * 2.4) * 0.03 + chew * 0.03; R.body.scale.set(1 + st.pw * 0.03, 1, 1 + st.pw * 0.03);
    R.jaw.rotation.x = b.jw.x + chew * 0.45;
    let hY = 0, hX = 0, aLx = -1.25, aLz = 0, aRx = -1.25 + Math.sin(st.chew * 0.5) * 0.15, aRz = 0;
    if (mode === 'eat') { aRx = -1.6 - chew * 0.5; hX = 0.15; } // feeding himself with his far trotter
    if (mode === 'tell') { const k = clamp(ch.t / ch.dur, 0, 1); hY = -0.55 * k; aLx = -1.25 - 0.4 * k; aLz = 0.3 * k; hX = -0.05; }
    if (mode === 'slide') { const k = ease(clamp(ch.u * 3, 0, 1)); hY = -0.55; aLx = -1.55; aLz = lerp(0.3, -0.9, k); }
    if (mode === 'swatted') { hY = -0.2 + Math.sin(t * 20) * 0.08; aLx = -2.2; aLz = 0.6; }
    if (mode === 'win') { aLx = aRx = -2.6; aLz = 0.5; aRz = -0.5; hX = -0.25; }
    if (mode === 'waddle') { aLx = aRx = -0.3 + Math.sin(st.outT * 7) * 0.3; hY = 0; hX = 0.1; }
    if (mode === 'idle') { aRx = -1.3; hY = Math.sin(t * 0.8) * 0.3; }
    R.head.rotation.y = damp(R.head.rotation.y, b.hd.y + hY, 10, dt); R.head.rotation.x = damp(R.head.rotation.x, b.hd.x + hX, 10, dt);
    R.armL.rotation.x = damp(R.armL.rotation.x, aLx, 12, dt); R.armL.rotation.z = damp(R.armL.rotation.z, aLz, 12, dt); R.armR.rotation.x = damp(R.armR.rotation.x, aRx, 14, dt); R.armR.rotation.z = damp(R.armR.rotation.z, aRz, 12, dt);
    for (const m of R.flash) if (m && m.userData && m.userData.flash) m.userData.flash.value = mode === 'swatted' ? 0.25 : Math.max(0, m.userData.flash.value - dt * 3);
  }
  function poseSlide(st) {
    const ch = st.cheat, m = P.slideM; P.strip.material.opacity = 0; if (!ch || ch.ph === 'tell') { m.visible = false; if (ch) P.strip.material.opacity = 0.12 + 0.1 * Math.sin(st.t * 20); return; }
    if (ch.ph === 'slide') { const u = ch.u, x0 = PX - 0.35, x1 = HX + 0.15; m.position.set(lerp(x0, x1, u), TOP + 0.02, PLZ + 0.1 + Math.sin(u * Math.PI) * 0.06); m.rotation.y = u * 4;
      P.strip.material.opacity = u >= WIN0 && u <= WIN1 ? 0.55 + 0.25 * Math.sin(st.t * 30) : 0.18; }
    else if (ch.ph === 'back') { const u = clamp(ch.u, 0, 1); m.position.set(lerp(ch.from.x, PX, u), lerp(ch.from.y, TOP + 0.1, u) + Math.sin(u * Math.PI) * 0.9, lerp(ch.from.z, PLZ, u)); m.rotation.y += 0.4; m.rotation.x += 0.3; }
  }
  P.render = function (rdt) {
    const st = P.st, dt = Math.min(0.05, rdt * (SIM || 1)), t = st.t;
    const H = P.H; H.root.position.set(HX, 0.36, CZ - 0.95); // perched on his stool H.root.rotation.y = 0; applyPose(H, haroldPose(st, t), 18, dt, false);
    const bl = 1 + st.full / 100 * 0.32; H.torso.scale.set(bl, 1 + st.full / 100 * 0.06, bl); // his belly fills out
    if (H.mat.userData.flash) H.mat.userData.flash.value = st.full > 85 ? (Math.sin(t * 16) * 0.5 + 0.5) * 0.25 : Math.max(0, H.mat.userData.flash.value - dt * 3);
    if (H.mat.userData.flashC) H.mat.userData.flashC.value.set(st.full > 85 ? '#ff4060' : '#ffffff');
    const M = P.M; const fan = st.ph === 'fan'; M.root.position.set(damp(M.root.position.x, fan ? HX - 0.68 : HX - 0.92, 6, dt), 0.12, damp(M.root.position.z, fan ? CZ - 1.4 : CZ - 1.85, 6, dt)); M.root.rotation.y = fan ? 0.9 : 0.35; applyPose(M, mavisPose(st, t), 12, dt, false);
    posePete(st, dt); poseSlide(st); poseCup(st, dt);
    // camera: in front of the counter, a little above; portrait pulls back so Mavis, Harold and Pete all fit
    const port = VH() > VW(); P.cam.fov = port ? 56 : 44; P.cam.updateProjectionMatrix();
    V.set(0.12, port ? 2.35 : 2.2, port ? 7.0 : 5.0); V2.set(0.15, port ? 1.42 : 1.5, CZ - 0.4);
    if (st.ph === 'intro' && st.c === 0 && st.pt < st.pdur) { const k = ease(clamp(st.pt / st.pdur, 0, 1)); V.lerpVectors(V2.clone().set(4.5, 4.4, 8.5), V, k); }
    if (st.cheat && st.cheat.ph === 'slide') { V.x -= 0.25; V.z -= 0.3; }
    if (st.ph === 'waddle' && st.outT > 1.2) { V.x += 0.8; V2.x += 0.7; }
    P.camP.lerp(V, 1 - Math.exp(-5 * dt)); P.camL.lerp(V2, 1 - Math.exp(-5 * dt)); P.cam.position.copy(P.camP); P.cam.lookAt(P.camL);
    OUT_U.fogC.value.copy(P.scene.fog.color); OUT_U.fogN.value = 14; OUT_U.fogF.value = 40;
  };
  P.onResize = () => {};

  // ---------------- test bot: ?peteauto=win plays a clean steady contest; lose over-mashes until Harold is too full ----------------
  P.botThink = function (B, dt) {
    const st = P.st; if (!st || st.over) return; B.mx = B.my = 0;
    if (B.mode === 'lose') { if (st.ph === 'eat') B.a = true; return; }
    if (st.ph !== 'eat') return;
    B.eatT = (B.eatT || 0) - dt; B.hicT = st.hic ? (B.hicT || 0) + dt : 0;
    if (st.hic && B.hicT > 0.25) { B.c = true; return; }
    const ch = st.cheat; if (ch && ch.ph === 'slide' && ch.u > WIN0 + 0.12 && ch.u < WIN1 - 0.05 && st.swatCd <= 0 && st.swatT < 0) { B.b = true; return; }
    if (st.full > 62 && st.sips > 0 && st.sipT < 0 && !st.hic) { B.c = true; return; }
    if (B.eatT <= 0 && !st.hic && st.coughT <= 0) { B.a = true; B.eatT = 0.17; }
  };
  DUELS.reg('pete', P);

  // ---------------- the city side: Lexington district id, anchor, ACT "EAT-OFF PETE" (night) ----------------
  const TEMP_ANCHOR = { x: -118, z: -41, ox: -118, oz: -38.6 }; // TEMPORARY: the street on the north edge of Oriole Park, toward the planned downtown-west district (DESIGN fit tweaks)
  const lexL = () => LANDMARKS.find((l) => l.id === 'lexington') || LANDMARKS.find((l) => /lexington/i.test(l.id));
  const LEX = { id: 'lexington', src: 'temp', L: null, act: null };
  function anchorFrom(a) { if (!a) return null; if (Array.isArray(a)) return { x: +a[0], z: +a[1] }; const o = a.pete || a.boss || a; if (o && isFinite(o.x) && isFinite(o.z)) return { x: +o.x, z: +o.z, ox: o.ox, oz: o.oz }; return null; }
  function setupTrigger() {
    const real = lexL(); LEX.L = real || { id: 'lexington', name: 'LEXINGTON MARKET', boss: { name: 'Pit Beef Pete', cleared: false } }; LEX.id = LEX.L.id;
    if (!real && BOSS_CLEAR.cleared.has(LEX.id)) LEX.L.boss.cleared = true;
    if (!LEX.L.boss) LEX.L.boss = { name: 'Pit Beef Pete' };
    let A = anchorFrom(window.LEX_ANCHOR); LEX.src = A ? 'LEX_ANCHOR' : 'temp'; if (!A) A = TEMP_ANCHOR;
    const ox = A.ox ?? A.x, oz = A.oz ?? A.z + 2.4;
    DUELS.addTrigger('pete', LEX.L, A.x, A.z, ox, oz, '#ff9a3a');
    const act = ACTIONS[ACTIONS.length - 1]; LEX.act = act; const night = () => NIGHT.value > 0.5 || Q.has('petenight');
    Object.defineProperty(act, 'label', { get: () => (night() ? (LEX.L.boss.cleared ? 'REMATCH PETE' : 'EAT-OFF PETE') : 'PETE: AFTER DARK'), configurable: true });
    act.ok = () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels'));
    act.go = () => { if (!night()) { banner("PETE'S EAT-OFF STARTS AFTER DARK", 2.2); return; } DUELS.start('pete'); };
    const bm = DUELS.BEAM.list[DUELS.BEAM.list.length - 1]; if (bm) bm.L = { boss: { get cleared() { return false; } } }; // keep the ring lit for rematches (the duel core hides cleared ones)
  }
  function clearLex() {
    const st = P.st, info = { how: 'pete-eatoff', retries: DUELS.retries, secs: +DUELS.t.toFixed(1), courses: st ? st.hw + '-' + st.pw : '' };
    if (lexL()) { DUELS.bossCleared(LEX.id, 'pete-eatoff'); return; }
    // the Lexington landmark isn't in this build yet: same effect as BOSS_CLEAR.clear() for a district without a landmark entry
    const C = BOSS_CLEAR, first = !C.cleared.has(LEX.id); C.cleared.add(LEX.id); C.crime[LEX.id] = 0; LEX.L.boss.cleared = true;
    try { localStorage.setItem('tcb_boss_clear', JSON.stringify([...C.cleared])); } catch (e) {}
    const d = Object.assign({ lm: LEX.id, boss: 'Pit Beef Pete', first, city: C.cityCrime(), at: +S.time.toFixed(1) }, info); C.log.push(d);
    DUELS.cleared[LEX.id] = { boss: 'Pit Beef Pete', how: 'pete-eatoff', at: d.at }; CITY.log.push('boss:' + LEX.id + '@' + S.time.toFixed(1));
    for (const f of C.fns) { try { f(d); } catch (e) { console.error(e); } }
    try { dispatchEvent(new CustomEvent('tcb:bossclear', { detail: d })); } catch (e) {}
  }
  // set up after every src file has run (the Lexington landmark build may define LEX_ANCHOR / its LANDMARKS entry later in the bundle); ?pete=1 starts it
  let n = 0; MODE.ticks.push(() => { n++;
    if (n === 1) setupTrigger();
    else if (n > 1 && n < 600 && LEX.src === 'temp' && window.LEX_ANCHOR && LEX.act) { const A = anchorFrom(window.LEX_ANCHOR); if (A) { LEX.src = 'LEX_ANCHOR'; const K = P.trigger, bm = DUELS.BEAM.list.find((b) => b.K === P);
        K.x = A.x; K.z = A.z; K.ox = A.ox ?? A.x; K.oz = A.oz ?? A.z + 2.4; LEX.act.x = A.x; LEX.act.z = A.z; if (bm) { const y = groundY(A.x, A.z); bm.ring.position.set(A.x, y + 0.04, A.z); bm.beam.position.set(A.x, y + 3.5, A.z); } } }
    if (n === 3 && Q.has('pete') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('peteauto'); DUELS.start('pete', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__pete = P; P.LEX = LEX; P.COURSES = COURSES;
})();

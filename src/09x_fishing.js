
// ======================= HARBOR FISHING + CHOMPY (DESIGN.md 2026-10-12 "New side missions", "Fit tweaks": ghost lantern guaranteed, Chompy is original).
// Walk to a glowing ring at the end of any pier and press ACT (FISH). A side-on dock scene: Harold rigs a line on his cane.
//   CAST (A / J / tap): a power marker sweeps back and forth, stop it in the green band for a PERFECT cast (quicker, better bites; rare odds up).
//   BITE: the bobber nibbles, then plunges: tap A inside 0.9 s to set the hook (too early = reel in empty; too late = it got away).
//   REEL (hold B / K / the B button): progress climbs, LINE TENSION climbs too. Release to ease off. Fish make RUNS (a tell shows): let go or the line
//        SNAPS. Three snaps and the mission is lost (RETRY / LEAVE). Land 5 catches to win (CONTINUE). ACT / E = LEAVE any time.
//   Catches: separate day and night lists (fish, blue crabs, eels, junk: boots, tires, carts, cones, buckets). JUNK feeds CHOMPY, an original googly-eyed
//   trash wheel anchored beside the pier; his meter unlocks the CANE and PURSE upgrades (saved, flags exported on window.__fishing.save).
//   Rare: the GHOST LANTERN (the first NIGHT cast off the Broadway pier always lands it, so the Phantoms gang can't be blocked by luck) and the SUNKEN KEY
//   (a true rare, opens the sewer stash: flag save.key, the stash itself is wired with the city pass).
// Piers with spots: Harborplace plaza, Constellation pier, Aquarium (pier 3), Power Plant (pier 4), BROADWAY PIER (Pendry recreation pier, Fells Point side).
// Runs on the boss-duel core (09a: MODE.duel, shared HUD, RETRY / LEAVE, radio duck, exit back to the street). No boss clear, a side mission.
// Tests: ?fish=1 starts at load (&fishspot=broadway|p1|p3|p4|hp, &fishnight=1 forces night, &fishauto=win|lose plays itself, also ?duel=fishing&duelbot=win|lose).
// Rig hook (Opus, optional): window.buildChompy({ THREE, toonMat, outlineMat, addOdir, QUAL }) -> { root, wheel?, eyes?: [pupil objects], update?(dt, chew) }.
(function () {
  const F = { scene: null, cam: null, title: 'CATCH', pips: 1,
    hint: '<b>A / J</b> cast (stop in green) + hook on BITE · hold <b>B / K</b> reel: keep TENSION in the GREEN · <b>Y / E</b> leave',
    labels: { a: 'CAST', b: 'REEL', c: 'LEAVE', l: '', r: '' } };
  const SPOTS = [
    { id: 'hp', name: 'HARBORPLACE PLAZA', x: -52, z: -28.2 },
    { id: 'p1', name: 'CONSTELLATION PIER', x: -37.5, z: -28.2 },
    { id: 'p3', name: 'AQUARIUM PIER', x: 19, z: -28.2 },
    { id: 'p4', name: 'POWER PLANT PIER', x: 56, z: -28.2 },
    { id: 'broadway', name: 'BROADWAY PIER', x: 126, z: -28.2 },
  ];
  const GOAL = 5, LINES = 4, BITE_WIN = 1.0, UPG = [{ at: 100, id: 'cane', name: 'CANE UPGRADE' }, { at: 240, id: 'purse', name: 'PURSE UPGRADE' }];
  // name, colour, fight size (0.6 easy .. 1.4 hard), kind, Chompy points (junk only feeds him)
  const DAY = [['PERCH', '#e8b030', 0.8, 'fish'], ['BLUEGILL', '#3a8a9a', 0.75, 'fish'], ['STRIPED ROCKFISH', '#8a9a7a', 1.1, 'fish'], ['WHITE PERCH', '#c8ccd0', 0.85, 'fish']];
  const NIGHT_L = [['CHANNEL CATFISH', '#5a5648', 1.2, 'fish'], ['AMERICAN EEL', '#3a4a2a', 1.0, 'eel'], ['BLACK DRUM', '#4a4a58', 1.25, 'fish'], ['SNAPPER BLUEFISH', '#4a7a90', 1.0, 'fish']];
  const CRAB = ['BLUE CRAB', '#2a6ab0', 0.9, 'crab'];
  const JUNK = [['OLD BOOT', '#6a4a2a', 0.8, 'boot'], ['BALD TIRE', '#2a2a30', 1.0, 'tire'], ['SHOPPING CART', '#b8bcc4', 1.2, 'cart'], ['TRAFFIC CONE', '#ff7a1a', 0.7, 'cone'], ['RUSTY BUCKET', '#8a6a4a', 0.75, 'bucket']];
  const LANTERN = ['GHOST LANTERN', '#8affd8', 0.7, 'lantern'], KEY = ['SUNKEN KEY', '#e8c040', 0.8, 'key'];
  // fight patterns (Brad 2026-10-15 playability pass): steady / runner (long runs: ease off) / diver (hard tugs every few s) / thrasher (jerky tension) / heavy junk (slow, no fight)
  const PAT = { 'PERCH': 'steady', 'BLUEGILL': 'steady', 'WHITE PERCH': 'steady', 'STRIPED ROCKFISH': 'runner', 'SNAPPER BLUEFISH': 'runner', 'CHANNEL CATFISH': 'diver', 'BLACK DRUM': 'diver', 'AMERICAN EEL': 'thrasher', 'BLUE CRAB': 'thrasher' };
  const PATN = { steady: 'STEADY', runner: 'RUNNER: EASE OFF WHEN IT RUNS', diver: 'DIVER: BIG TUGS', thrasher: 'THRASHER: JERKY LINE', heavy: 'DEAD WEIGHT' };
  const G0 = 0.3, G1 = 0.78; // the green tension band
  const rnd = (a, b) => a + Math.random() * (b - a), pickA = (a) => a[Math.floor(Math.random() * a.length)];
  const V = new THREE.Vector3(), V3 = new THREE.Vector3();
  // ---------------- saved progress ----------------
  const LS = 'tcb_fish';
  let save = { caught: {}, bucket: 0, junk: 0, chompy: 0, cane: false, purse: false, lantern: false, key: false, casts: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) {} };
  // R-056 repair: older builds dropped the cane/purse when a fish or crab crossed the threshold. Upgrades are earned by points, so re-grant on load.
  { let fixd = false; for (const u of UPG) if (save.chompy >= u.at && !save[u.id]) { save[u.id] = true; fixd = true; } if (fixd) persist(); }
  const isNight = () => NIGHT.value > 0.5 || Q.has('fishnight');

  // ---------------- catch meshes (all procedural, vertex-coloured, toon) ----------------
  function catchMesh(c) {
    const K = DUELS.kit(), G = DUELS.GEO, col = c[1], kind = c[3];
    if (kind === 'fish') K.add(G.sph(0.3, 12, 8), col, 0, 0, 0, 0, 0, 0, 1.5, 0.7, 0.55).add(G.cone(0.2, 0.32, 6), col, -0.55, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.3).add(G.cone(0.14, 0.2, 5), '#2a2a30', 0, 0.2, 0, 0, 0, 0, 1.4, 1, 0.3).add(G.sph(0.05, 6, 4), '#fff', 0.34, 0.07, 0.15).add(G.sph(0.025, 5, 4), '#14101f', 0.37, 0.07, 0.17).add(G.sph(0.22, 8, 5), '#f2ecd8', 0.02, -0.12, 0, 0, 0, 0, 1.3, 0.4, 0.8);
    else if (kind === 'eel') { for (let i = 0; i < 9; i++) K.add(G.sph(0.11, 8, 6), col, -0.5 + i * 0.13, Math.sin(i * 0.9) * 0.08, 0, 0, 0, 0, 1.2, 1, 1); K.add(G.sph(0.05, 5, 4), '#e8e050', 0.66, 0.05, 0.08); }
    else if (kind === 'crab') K.add(G.sph(0.24, 10, 6), col, 0, 0, 0, 0, 0, 0, 1.4, 0.55, 1).add(G.sph(0.09, 6, 4), '#e04a2a', -0.4, 0.12, 0.15).add(G.sph(0.09, 6, 4), '#e04a2a', 0.4, 0.12, 0.15).add(G.cyl(0.02, 0.02, 0.25, 4), '#c8d0e0', -0.3, 0.05, 0.12, 0, 0, 0.9).add(G.cyl(0.02, 0.02, 0.25, 4), '#c8d0e0', 0.3, 0.05, 0.12, 0, 0, -0.9).add(G.sph(0.035, 5, 4), '#fff', 0.1, 0.16, 0.18).add(G.sph(0.035, 5, 4), '#fff', -0.1, 0.16, 0.18);
    else if (kind === 'boot') K.add(G.box(0.22, 0.5, 0.26), col, 0, 0.1, 0).add(G.box(0.55, 0.18, 0.26), col, 0.18, -0.12, 0).add(G.box(0.26, 0.04, 0.3), '#222', 0.18, -0.22, 0);
    else if (kind === 'tire') K.add(G.tor(0.3, 0.12, Math.PI * 2, 8, 14), col, 0, 0, 0).add(G.cyl(0.17, 0.17, 0.04, 10), '#6a6a74', 0, 0, 0, Math.PI / 2, 0, 0);
    else if (kind === 'cart') { K.add(G.box(0.7, 0.04, 0.4), col, 0, -0.2, 0).add(G.box(0.7, 0.34, 0.03), col, 0, 0, 0.2).add(G.box(0.7, 0.34, 0.03), col, 0, 0, -0.2).add(G.box(0.03, 0.34, 0.4), col, 0.35, 0, 0).add(G.cyl(0.02, 0.02, 0.5, 4), col, -0.35, 0.2, 0, 0, 0, 0.6); for (const x of [-0.28, 0.28]) K.add(G.cyl(0.06, 0.06, 0.04, 8), '#222', x, -0.3, 0.15, Math.PI / 2, 0, 0).add(G.cyl(0.06, 0.06, 0.04, 8), '#222', x, -0.3, -0.15, Math.PI / 2, 0, 0); }
    else if (kind === 'cone') K.add(G.cone(0.2, 0.55, 8), col, 0, 0.1, 0).add(G.cyl(0.12, 0.14, 0.12, 8), '#fff', 0, 0.02, 0).add(G.box(0.5, 0.05, 0.5), '#2a2a30', 0, -0.2, 0);
    else if (kind === 'bucket') K.add(G.cyl(0.26, 0.2, 0.4, 10), col, 0, 0, 0).add(G.tor(0.26, 0.02, Math.PI, 4, 10), '#4a4a50', 0, 0.2, 0, 0, 0, 0);
    else if (kind === 'lantern') K.add(G.box(0.26, 0.34, 0.26), '#6a8a8a', 0, 0, 0).add(G.box(0.2, 0.28, 0.2), col, 0, 0, 0).add(G.cone(0.2, 0.14, 4), '#4a6464', 0, 0.24, 0, 0, Math.PI / 4, 0).add(G.tor(0.08, 0.015, Math.PI, 4, 8), '#4a6464', 0, 0.36, 0);
    else if (kind === 'key') K.add(G.tor(0.12, 0.04, Math.PI * 2, 6, 12), col, -0.28, 0, 0).add(G.cyl(0.035, 0.035, 0.55, 6), col, 0.05, 0, 0, 0, 0, Math.PI / 2).add(G.box(0.06, 0.14, 0.04), col, 0.24, -0.08, 0).add(G.box(0.06, 0.1, 0.04), col, 0.32, -0.06, 0);
    const m = K.mesh(toonMat(), null, 0.006); m.userData.glow = kind === 'lantern'; return m;
  }
  function pickCatch(spot, perfect) {
    if (!save.lantern && spot.id === 'broadway' && isNight()) return { c: LANTERN, why: 'guaranteed' };
    const r = Math.random(); if (r < (perfect ? 0.06 : 0.03)) return { c: KEY };
    const night = isNight(), q = Math.random();
    if (q < (night ? 0.45 : 0.6)) return { c: pickA(night ? NIGHT_L : DAY) };
    if (q < (night ? 0.6 : 0.75)) return { c: CRAB };
    return { c: pickA(JUNK) };
  }

  // ---------------- the scene ----------------
  const skyTex = (night) => canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); if (night) { gr.addColorStop(0, '#0a0a24'); gr.addColorStop(1, '#3a2a5a'); } else { gr.addColorStop(0, '#6ec0ff'); gr.addColorStop(1, '#ffe8c0'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (night) { for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.6) + ')'; g.fillRect(Math.random() * w, Math.random() * h * 0.6, 2, 2); } g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(400, 60, 22, 0, TAU); g.fill(); }
    else { g.fillStyle = 'rgba(255,255,255,.8)'; for (const [x, y, r] of [[90, 60, 26], [130, 66, 20], [330, 40, 24], [370, 48, 18]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
    // far skyline silhouette with lit windows
    g.fillStyle = night ? '#14122a' : '#7a8aa8';
    for (let x = 0, i = 0; x < w; x += 22 + (i++ % 3) * 8) { const bh = 40 + ((i * 53) % 70); g.fillRect(x, h - 20 - bh, 20, bh + 20); if (night) { g.fillStyle = '#ffd070'; for (let y = h - 14 - bh; y < h - 20; y += 12) if (((x + y) * 7) % 5 < 2) g.fillRect(x + 4, y, 3, 4); g.fillStyle = '#14122a'; } }
  }, 512);
  const waterTex = (night) => canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); if (night) { gr.addColorStop(0, '#1a3a5a'); gr.addColorStop(1, '#06101e'); } else { gr.addColorStop(0, '#4aa0c0'); gr.addColorStop(1, '#0e3a5a'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = night ? 'rgba(160,200,255,.15)' : 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const y = 10 + i * 17, x = (i * 71) % 200; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 6, x + 44, y); g.stroke(); }
  }, 256);
  const plankTex = () => canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 4; x < w; x += 16) g.fillRect(x, 6, 8, 3); }, 128);

  function buildChompy() {
    const K = DUELS.kit(), G = DUELS.GEO, R = { root: new THREE.Group() };
    let rig = null; try { if (typeof window.buildChompy === 'function') rig = window.buildChompy({ THREE, toonMat, outlineMat, addOdir, QUAL }); } catch (e) { console.error(e); rig = null; }
    if (rig && rig.root) { rig.kind = 'hook'; return rig; }
    // original stand-in: a teal scow, an orange paddle wheel, a purple dome with big googly eyes and a hopper mouth (no real trash-wheel design copied)
    K.add(G.box(1.5, 0.35, 0.9), '#2a8a9a', 0, 0, 0).add(G.box(1.6, 0.08, 1.0), '#f4d23a', 0, 0.2, 0).add(G.cyl(0.42, 0.5, 0.5, 12), '#7a4aa8', -0.25, 0.5, 0).add(G.box(0.62, 0.1, 0.5), '#ffe29a', -0.25, 0.8, 0)
      .add(G.box(0.5, 0.2, 0.4), '#14101f', -0.1, 0.38, 0.4).add(G.cyl(0.04, 0.04, 0.6, 5), '#c8c0b0', 0.3, 0.75, 0.15);
    R.body = K.mesh(toonMat(), R.root);
    const W = DUELS.kit(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; W.add(G.box(0.1, 0.5, 0.52), '#ff8a2a', Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 0, 0, a); } W.add(G.cyl(0.1, 0.1, 0.6, 8), '#c8c0b0', 0, 0, 0, Math.PI / 2, 0, 0);
    R.wheel = W.mesh(toonMat(), R.root); R.wheel.position.set(0.58, 0.5, 0);
    const wm = new THREE.MeshBasicMaterial({ color: '#ffffff' }), pm = new THREE.MeshBasicMaterial({ color: '#14101f' }); R.eyes = [];
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), wm), p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pm); p.position.set(0, 0, 0.12); e.add(p); e.position.set(-0.4 + s * 0.2, 1.0, 0.18); R.root.add(e); R.eyes.push(p); }
    R.kind = 'standin'; return R;
  }

  F.build = function () {
    const sc = (F.scene = new THREE.Scene()); F.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.1, 120);
    F.night = isNight(); sc.fog = new THREE.Fog(F.night ? '#14122a' : '#a8d4ee', 26, 60);
    DUELS.sceneLights(sc, F.night ? '#8a90d0' : '#fff2d8', F.night ? '#1a1a30' : '#4a6a7a', F.night ? 0.85 : 1.2, F.night ? '#aab4ff' : '#fff0d0', F.night ? 0.9 : 1.4, new THREE.Vector3(-0.4, 1, 0.8));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshBasicMaterial({ map: skyTex(F.night), fog: false })); sky.position.set(0, 7, -24); sc.add(sky); F.sky = sky;
    // cross-section of the water behind the dock + the translucent surface in front of it
    const wt = waterTex(F.night); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(6, 2.5); F.wt = wt;
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ map: wt, fog: false })); wb.position.set(0, -7.35, -0.7); sc.add(wb);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ color: F.night ? '#10284a' : '#3a98c0', transparent: true, opacity: 0.7, fog: false })); ws.rotation.x = -Math.PI / 2; ws.position.set(0, -0.35, 6); sc.add(ws);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), new THREE.MeshBasicMaterial({ color: F.night ? '#0e2040' : '#5aa8c8', fog: false })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.36, -9); sc.add(far);
    // dock: planks + pilings + a bollard + lamp (lit at night)
    const pt = plankTex(); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(10, 1);
    F.dock = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 2.4), [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshLambertMaterial({ map: pt }))); sc.add(F.dock);
    const K = DUELS.kit(), G = DUELS.GEO; for (let i = 0; i < 4; i++) K.add(G.cyl(0.13, 0.15, 2.2, 8), '#4a3422', -5.2 + i * 3.2, -0.9, 0.9).add(G.cyl(0.13, 0.15, 2.2, 8), '#4a3422', -5.2 + i * 3.2, -0.9, -0.9);
    K.add(G.cyl(0.1, 0.13, 0.3, 8), '#2a2a30', 5, 0.3, 0.8).add(G.cyl(0.04, 0.04, 1.8, 5), '#2a2a30', 5.3, 1.1, -0.8).add(G.sph(0.14, 8, 6), F.night ? '#ffe090' : '#bbb', 5.3, 2.0, -0.8).add(G.box(0.4, 0.3, 0.3), '#8a6a3a', 4.2, 0.3, 0.2);
    F.deco = K.mesh(toonMat(), sc); F.deco.userData.dockX = true;
    if (F.night) { const pl = new THREE.PointLight('#ffd890', 10, 9, 1.4); sc.add(pl); F.lamp = pl; }
    // Harold, rod, line, bobber, a held catch, Chompy
    F.H = buildHero(); sc.add(F.H.root); F.H.root.rotation.y = Math.PI / 2;
    const rk = DUELS.kit(); rk.add(G.cyl(0.018, 0.03, 2.1, 6), '#4a3a2a', 0, 1.05, 0).add(G.sph(0.06, 6, 4), '#c8c0b0', 0, 0.1, 0).add(G.cyl(0.05, 0.05, 0.1, 8), '#2a2a30', 0.0, 0.3, 0.06, Math.PI / 2, 0, 0);
    F.rod = new THREE.Group(); const rm = rk.mesh(toonMat(), F.rod, 0.003); sc.add(F.rod);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); F.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#fff', transparent: true, opacity: 0.85, fog: false })); F.line.frustumCulled = false; sc.add(F.line);
    const bk = DUELS.kit(); bk.add(G.sph(0.11, 10, 7), '#f4f4f4', 0, 0, 0).add(G.sph(0.1, 10, 5), '#e83a2a', 0, 0.045, 0, 0, 0, 0, 1, 0.55, 1).add(G.cyl(0.012, 0.012, 0.16, 4), '#ffd23c', 0, 0.16, 0);
    F.bob = bk.mesh(toonMat(), sc, 0.004);
    F.item = null; F.items = {}; F.pop = new THREE.Group(); sc.add(F.pop);
    F.C = buildChompy(); F.C.root.scale.setScalar(1); sc.add(F.C.root);
    // ring splash drops (one instanced mesh)
    F.fx = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffffff', false), transparent: true, depthWrite: false, fog: false }), 30); F.fx.count = 0; F.fx.frustumCulled = false; sc.add(F.fx); F.fxs = [];
    // UI: cast meter + Chompy meter + catch list, inside the duel HUD
    const ui = document.createElement('div'); ui.className = 'fshui';
    ui.innerHTML = '<div class="tn" style="display:none;margin:4px 0"><div style="font-size:10px;color:#ffd23c">TENSION \u00b7 KEEP IT IN THE GREEN <span class="tp" style="color:#9fe8ff"></span></div><div style="position:relative;height:12px;border:2px solid #14101f;border-radius:6px;background:linear-gradient(90deg,#3a5a7a 0 ' + G0 * 100 + '%,#3fd13a ' + G0 * 100 + '% ' + G1 * 100 + '%,#ff3d6e ' + G1 * 100 + '%)"><i style="position:absolute;top:-4px;width:5px;height:18px;background:#fff;border:1px solid #14101f;left:0"></i></div><div class="tw" style="font-size:10px;font-weight:900;height:12px"></div></div>'
      + '<div class="how" style="font-size:9px;line-height:1.35;opacity:.92">GOAL: LAND ' + GOAL + ' CATCHES \u00b7 ' + LINES + ' LINES<br>CAST: A / J \u00b7 BITE: A / J FAST \u00b7 REEL: HOLD B / K \u00b7 LEAVE: Y / E</div>'
      + '<div class="m"><u></u><i></i></div><div class="cm"><span class="cn">CHOMPY</span><b><em></em></b></div><div class="lst"></div>';
    DUELS.hudEl.appendChild(ui); F.ui = { tn: ui.querySelector('.tn'), ti: ui.querySelector('.tn i'), tw: ui.querySelector('.tw'), tp: ui.querySelector('.tp'), el: ui, m: ui.querySelector('.m'), mi: ui.querySelector('.m i'), mu: ui.querySelector('.m u'), cm: ui.querySelector('.cm em'), cn: ui.querySelector('.cn'), lst: ui.querySelector('.lst'), pn: DUELS.hudEl.querySelector('.dbar.p .n'), bn: DUELS.hudEl.querySelector('.dbar.b .n') };
    const css = document.createElement('style'); css.textContent = `
      #duel .fshui { display: none; position: absolute; inset: 0; pointer-events: none; }
      body.duel-fishing #duel .fshui { display: block; }
      #duel .fshui .m { position: absolute; left: 50%; top: 70%; transform: translateX(-50%); width: min(260px, 70vw); height: 16px; background: #14101f; border: 3px solid #fff; border-radius: 9px; overflow: hidden; opacity: 0; transition: opacity .15s; }
      #duel .fshui .m.on { opacity: 1; }
      #duel .fshui .m u { position: absolute; top: 0; bottom: 0; left: 56%; width: 24%; background: #54e04a; }
      #duel .fshui .m i { position: absolute; top: -2px; bottom: -2px; width: 5px; background: #ffd23c; box-shadow: 0 0 6px #fff; left: 0; }
      #duel .fshui .cm { position: absolute; left: 10px; right: 10px; top: calc(env(safe-area-inset-top, 0px) + 104px); font-size: 9px; display: flex; align-items: center; gap: 6px; text-shadow: 2px 2px 0 #14101f; }
      #duel .fshui .cm .cn { color: #ffd23c; white-space: nowrap; }
      #duel .fshui .cm b { flex: 1; max-width: 150px; height: 8px; background: #14101f; border: 2px solid #14101f; border-radius: 5px; overflow: hidden; position: relative; }
      #duel .fshui .cm b em { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(#c89aff, #7a4aa8); width: 0; }
      #duel .fshui .lst { position: absolute; left: 10px; right: 10px; bottom: 34px; text-align: center; font-size: 9px; color: #e8e4ff; text-shadow: 2px 2px 0 #14101f; line-height: 1.5; }`;
    document.head.appendChild(css);
    F.layout();
  };
  // layout in screen-relative units: the camera's half-width at the dock plane
  F.layout = function () {
    const port = VH() > VW(); F.cam.fov = port ? 62 : 44; F.cam.updateProjectionMatrix();
    const D = port ? 7.2 : 9.5; F.camD = D; F.cam.position.set(0, port ? 1.5 : 1.3, D); F.cam.lookAt(0, port ? -0.2 : -0.1, 0);
    F.W = Math.tan(F.cam.fov * Math.PI / 360) * D * F.cam.aspect * 0.94;
    const W = F.W; F.hx = -W * 0.62; F.dock.position.set(-W * 0.45 - 6 + 0.3, -0.15, 0.1); // right edge of the dock at about -W*0.45 + 0.3
    F.deco.position.x = -W * 0.45 + 0.3 - 6 + 6; // (posts / lamp are baked around x = -6..6 of the dock; shift with it)
    F.deco.position.x = F.dock.position.x; F.deco.position.y = -0.15; F.deco.position.z = 0.1;
    F.chx = W * 0.66; F.chs = Math.min(1, W / 2.4) * 0.9;
  };
  F.onResize = () => { if (F.cam) F.layout(); };

  // ---------------- state ----------------
  function reset() {
    const st = (F.st = { ph: 'ready', t: 0, m: 0.1, dir: 1, power: 0.5, perfect: false, ct: 0, wt: 0, biteAt: 3, bt: 0, nib: 0, lines: LINES, catches: 0, list: [], hook: null, p: 0, ten: 0, run: 0, runT: 1.8, tellT: 0, landT: 0, bobx: 0, boby: -0.35, tx: 0, snap: 0, cd: 0, first: true, chew: 0, over: false, held: null });
    updateUI(); return st;
  }
  function updateUI() {
    const st = F.st; if (!st) return; const lv = UPG.filter((u) => save.chompy >= u.at).length, nxt = UPG[lv];
    F.ui.cm.style.width = (nxt ? clamp((save.chompy - (UPG[lv - 1] ? UPG[lv - 1].at : 0)) / (nxt.at - (UPG[lv - 1] ? UPG[lv - 1].at : 0)), 0, 1) * 100 : 100).toFixed(0) + '%';
    F.ui.cn.textContent = 'CHOMPY ' + (nxt ? 'NEXT: ' + nxt.name : 'FULL');
    DUELS.sub('CATCH ' + st.catches + '/' + GOAL + ' · LINES ' + '♥'.repeat(Math.max(0, st.lines)) + ' · SCORE ' + (st.score || 0), F.spot ? F.spot.name : '');
    F.ui.lst.textContent = st.list.slice(-4).join(' · ');
  }
  F.start = function (opts = {}) {
    F.spot = F.spotNext || SPOTS.find((s) => s.id === (Q.get('fishspot') || 'p1')) || SPOTS[1]; F.spotNext = null;
    if (F.night !== isNight()) { F.rebuildSky(); }
    F.ui.pn.textContent = 'LINE'; F.ui.bn.textContent = 'CATCH';
    reset(); DUELS.banner('HARBOR FISHING<small>' + F.spot.name + (F.night ? ' · NIGHT' : '') + '<br>CAST A / J \u00b7 HOOK ON THE BITE \u00b7 HOLD B / K, TENSION IN THE GREEN</small>', 3.2);
    DUELS.say('HAROLD', pickA(['Nothing like a quiet pier, Mavis.', 'Fish, crabs, and the occasional shopping cart.', 'Chompy eats whatever I hook. Delightful.']), 3);
    F.camP = new THREE.Vector3(); F.log = DUELS.log.push('fish:' + F.spot.id + ':' + (F.night ? 'night' : 'day') + ':' + F.C.kind);
  };
  F.rebuildSky = function () { F.night = isNight(); F.sky.material.map = skyTex(F.night); F.sky.material.needsUpdate = true; F.scene.fog.color.set(F.night ? '#14122a' : '#a8d4ee'); };
  F.retry = function () { reset(); DUELS.banner('NEW LINE<small>THREE FRESH HOOKS</small>', 1.4); };
  F.exit = function () { persist(); F.ui.m.classList.remove('on'); try { dispatchEvent(new CustomEvent('tcb:fish', { detail: { save, session: F.st ? F.st.list : [] } })); } catch (e) {} };

  // ---------------- the loop ----------------
  const fxAdd = (x, y, z, vx, vy, vz, life) => { if (F.fxs.length < 30) F.fxs.push({ x, y, z, vx, vy, vz, life, max: life }); };
  function setTell(t, d = 0.9) { DUELS.tell(t, d); }
  function beginBite(st) {
    const r = pickCatch(F.spot, st.perfect); st.hook = r.c; st.guar = r.why === 'guaranteed';
    st.ph = 'bite'; st.bt = 0; setTell('BITE! PRESS A / J NOW!', BITE_WIN); sfx('jump'); sfx('hit'); fxAdd(st.bobx, -0.3, 0.1, 0, 1.8, 0, 0.5);
  }
  function finishCatch(st) {
    const c = st.hook, kind = c[3], junk = ['boot', 'tire', 'cart', 'cone', 'bucket'].includes(kind), rare = kind === 'lantern' || kind === 'key';
    const prevPts = save.chompy; // R-056: upgrades are judged against the points before THIS catch (fish/crab as well as junk)
    st.catches++; st.landT = 0; st.ph = 'land'; st.list.push(c[0]); save.caught[c[0]] = (save.caught[c[0]] || 0) + 1; let sub = '';
    if (junk) { save.junk++; save.chompy += 20; sub = 'FEEDS CHOMPY +20'; st.feed = true; } else if (!rare) { save.bucket++; save.chompy += kind === 'crab' ? 6 : 4;
      const lb = +(c[2] * rnd(3.5, 9) * (st.perfect ? 1.15 : 1) * (st.cleanReel ? 1.1 : 1)).toFixed(1), pts = Math.round(lb * 10 * (st.cleanReel ? 1.5 : 1)); save.best = save.best || {}; const rec = !(save.best[c[0]] >= lb); if (rec) save.best[c[0]] = lb;
      st.score = (st.score || 0) + pts; save.score = (save.score || 0) + pts; sub = lb + ' LB \u00b7 +' + pts + (st.cleanReel ? ' CLEAN REEL!' : '') + (rec ? ' \u00b7 NEW BEST!' : ''); }
    if (kind === 'lantern') { save.lantern = true; sub = 'PHANTOMS CAN BE FLASHED NOW'; }
    if (kind === 'key') { save.key = true; sub = 'OPENS THE SEWER STASH'; }
    for (const u of UPG) if (save.chompy >= u.at && (prevPts < u.at || !save[u.id])) { save[u.id] = true; DUELS.say('CHOMPY', 'BURP! ' + u.name + ' UNLOCKED', 3.6); }
    persist(); DUELS.banner((rare ? 'RARE! ' : 'CAUGHT! ') + c[0] + '<small>' + sub + '</small>', 2.2); CITY.log.push('fish:' + c[0] + '@' + S.time.toFixed(1));
    st.held = c; showItem(st, c); updateUI();
  }
  function showItem(st, c) { if (F.item) { F.pop.remove(F.item); F.item = null; } const key = c[0]; F.items[key] = F.items[key] || catchMesh(c); F.item = F.items[key]; F.pop.add(F.item); F.item.visible = true; }
  F.step = function (dt, I) {
    const st = F.st; if (!st) return; st.t += dt; st.cd = Math.max(0, st.cd - dt); F.wt.offset.x += dt * 0.012;
    if (st.over) return;
    if (I.c || I.back) { DUELS.exit('leave'); return; }
    const hold = !!(I.bh || I.rh), W = F.W;
    if (st.ph === 'ready') {
      st.m += st.dir * dt * 1.15; if (st.m > 1) { st.m = 1; st.dir = -1; } if (st.m < 0) { st.m = 0; st.dir = 1; }
      F.ui.m.classList.add('on'); F.ui.mi.style.left = (st.m * 97).toFixed(1) + '%';
      if (I.a && st.cd <= 0) { st.power = st.m; st.perfect = st.m >= 0.56 && st.m <= 0.8; st.ph = 'cast'; st.ct = 0; save.casts++; st.tx = lerp(-W * 0.15, W * 0.58, st.power);
        st.bobx = F.hx + 1.4; st.boby = 1.4; F.ui.m.classList.remove('on'); if (st.perfect) DUELS.banner('PERFECT CAST!', 0.9); }
    } else if (st.ph === 'cast') {
      st.ct += dt; const u = clamp(st.ct / 0.65, 0, 1), x0 = F.hx + 1.4; st.bobx = lerp(x0, st.tx, ease(u)); st.boby = lerp(1.4, -0.35, u) + Math.sin(u * Math.PI) * 1.4;
      if (u >= 1) { st.ph = 'wait'; st.wt = 0; st.nib = 0; st.biteAt = (!save.lantern && F.spot.id === 'broadway' && isNight() ? 1.4 : rnd(1.8, 4.2)) - (st.perfect ? 0.8 : 0); if (st.biteAt < 1) st.biteAt = 1; fxAdd(st.bobx, -0.3, 0.1, 0, 1.2, 0, 0.5); fxAdd(st.bobx + 0.1, -0.3, 0.1, 0.5, 1.0, 0, 0.5); }
    } else if (st.ph === 'wait') {
      st.wt += dt; st.boby = -0.35 + Math.sin(st.t * 3) * 0.02; st.bobx = st.tx;
      if (st.wt > st.biteAt - 0.9 && !st.nib) { st.nib = 1; setTell('SOMETHING NIBBLES...', 0.8); }
      if (st.nib) st.boby -= Math.max(0, Math.sin(st.t * 22)) * 0.05;
      if (I.a) { st.ph = 'ready'; st.cd = 0.3; DUELS.tell('TOO EARLY, REEL IN', 0.7); }
      else if (st.wt >= st.biteAt) beginBite(st);
    } else if (st.ph === 'bite') {
      st.bt += dt; st.boby = -0.35 - 0.24 * Math.min(1, st.bt * 8); st.bobx = st.tx;
      if (I.a) { st.ph = 'reel'; st.p = 0.18; st.ten = 0.25; st.run = 0; st.runT = rnd(1.4, 2.4); st.tellT = 0; const c = st.hook, kind = c[3]; st.size = c[2]; st.noRun = ['boot', 'tire', 'cart', 'cone', 'bucket', 'lantern', 'key'].includes(kind) && kind !== 'key' || st.guar; st.pat = st.noRun ? 'heavy' : PAT[c[0]] || 'steady'; st.cleanReel = true; st.dive = rnd(1.6, 2.6); if (st.pat !== 'runner' && st.pat !== 'heavy') st.noRun = true; DUELS.tell(PATN[st.pat], 1.2); showItem(st, c); DUELS.banner('HOOKED!<small>HOLD B · EASE OFF ON RUNS</small>', 1.4); }
      else if (st.bt >= BITE_WIN) { st.ph = 'ready'; st.cd = 0.4; DUELS.tell('IT GOT AWAY...', 1); st.hook = null; }
    } else if (st.ph === 'reel') {
      const sz = st.size, rate = (0.17 / sz) * (st.perfect ? 1.2 : 1) * (save.cane ? 1.2 : 1) * (st.noRun ? 1.15 : 1);
      if (!st.noRun) { if (st.run > 0) { st.run -= dt; if (st.run <= 0) { st.runT = rnd(1.5, 2.6); } } else { st.runT -= dt; if (st.runT <= 0.5 && st.tellT <= 0) { st.tellT = 0.5; setTell('IT RUNS! EASE OFF!', 0.9); } if (st.runT <= 0) { st.run = 0.9; st.tellT = 0; } } }
      // pattern pulls on the line
      let pull = st.run > 0 ? 0.95 * sz : 0; if (st.pat === 'diver') { st.dive -= dt; if (st.dive < 0.5 && st.dive > 0 && st.tellT <= 0) { st.tellT = 0.5; setTell('TUG INCOMING! EASE OFF!', 0.6); } if (st.dive <= 0) { pull = 1.6 * sz; if (st.dive < -0.55) { st.dive = rnd(1.6, 2.6); st.tellT = 0; } } }
      if (st.pat === 'thrasher') pull += Math.abs(Math.sin(st.t * 9)) * 0.55 * sz;
      if (hold) st.ten += (0.36 + pull) * dt; else st.ten -= (0.62 - pull * 0.4) * dt;
      const green = st.ten >= G0 && st.ten <= G1;
      if (hold) st.p += rate * dt * (green ? 1.5 : st.ten > G1 ? 0.6 : 0.4); else st.p -= (st.run > 0 ? 0.05 : 0.02) * dt;
      if (!green && st.ten > G1) st.cleanReel = false; if (st.ten < G0 && !hold) st.p -= 0.02 * dt;
      st.ten = clamp(st.ten, 0, 1.01); st.p = clamp(st.p, 0, 1); DUELS.bars(st.ten, st.p);
      F.ui.tn.style.display = 'block'; F.ui.ti.style.left = (clamp(st.ten, 0, 1) * 98).toFixed(1) + '%'; F.ui.tp.textContent = PATN[st.pat] || '';
      F.ui.tw.textContent = st.ten > 0.9 ? 'LET GO! ABOUT TO SNAP' : st.ten > G1 ? 'TOO TIGHT' : green ? (hold ? 'GOOD! REELING' : 'HOLD B / K') : 'SLACK: HOLD B / K'; F.ui.tw.style.color = st.ten > G1 ? '#ff3d6e' : green ? '#3fd13a' : '#9fe8ff';
      st.bobx = lerp(st.tx, F.hx + 1.5, ease(st.p)); st.boby = -0.35 + Math.sin(st.t * 12) * 0.03 * (hold ? 1 : 0.4);
      if (hold && Math.random() < dt * 8) fxAdd(st.bobx, -0.3, 0.1, rnd(-0.5, 0.5), rnd(0.8, 1.6), 0, 0.4);
      if (st.ten >= 1 || st.p >= 1) F.ui.tn.style.display = 'none';
      if (st.ten >= 1) { st.lines--; st.ph = 'snap'; st.snap = 0; st.hook = null; DUELS.hurt(); DUELS.banner('SNAP!<small>LINE BROKE</small>', 1.2); updateUI(); DUELS.bars(0, 0); }
      else if (st.p >= 1) { DUELS.bars(0, 0); finishCatch(st); }
    } else if (st.ph === 'snap') {
      st.snap += dt; if (st.snap > 1.1) { if (st.lines <= 0) { st.over = true; st.ph = 'lost'; DUELS.over('lose', 'OUT OF LINE', 'Three snaps. Chompy is not impressed. ' + st.catches + ' of ' + GOAL + ' landed.'); } else { st.ph = 'ready'; st.cd = 0.2; } }
    } else if (st.ph === 'land') {
      st.landT += dt; const u = clamp(st.landT / 1.6, 0, 1); st.chew = st.feed ? u : 0; st.bobx = F.hx + 1.5; st.boby = 0.6 + Math.sin(u * Math.PI) * 0.6;
      if (st.feed) { st.bobx = lerp(F.hx + 1.5, F.chx, ease(u)); st.boby = lerp(0.6, 0.8, u) + Math.sin(u * Math.PI) * 1.0; }
      if (u >= 1) { if (F.item) F.item.visible = false; st.feed = false; st.held = null; st.chew = 0;
        if (st.catches >= GOAL) { st.over = true; st.ph = 'won'; DUELS.over('win', 'HAUL LANDED', st.list.join(', ') + '. Chompy: ' + save.chompy + ' pts.'); updateUI(); }
        else { st.ph = 'ready'; st.cd = 0.2; updateUI(); } }
    }
    // fx
    for (let i = F.fxs.length - 1; i >= 0; i--) { const f = F.fxs[i]; f.life -= dt; if (f.life <= 0) { F.fxs.splice(i, 1); continue; } f.vy -= 4 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.y < -0.36) { f.y = -0.36; f.vy = Math.abs(f.vy) * 0.2; } }
    F.chewT = (F.chewT || 0) + dt;
  };

  // ---------------- render ----------------
  F.render = function (rdt) {
    const st = F.st; if (!st) return; const t = st.t, W = F.W;
    // Harold on the dock, facing the water
    const H = F.H; H.root.position.set(F.hx, 0.0, 0.2); H.root.rotation.y = Math.PI / 2;
    const cast = st.ph === 'cast' ? clamp(st.ct / 0.65, 0, 1) : st.ph === 'ready' ? -st.m * 0.5 : 0, hold = st.ph === 'reel';
    let p = HERO_POSES.idle(t); legsStance(p, 0.14, 0.2); p.torso = [hold ? -0.2 : 0.05, 0, 0]; p.shR = [-1.3 + (st.ph === 'cast' ? -0.8 * Math.sin(cast * Math.PI) : 0) + (hold ? Math.sin(t * 9) * 0.05 : 0), 0, -0.1]; p.elR = [-0.5, 0, 0]; p.shL = [-1.0, 0, 0.25]; p.elL = [-1.0, 0, 0];
    if (st.ph === 'land') { p.torso = [-0.1, 0, 0]; p.shR = [-1.6, 0, 0]; p.y += Math.max(0, Math.sin(t * 14)) * 0.06; }
    if (st.ph === 'snap') { p = HERO_POSES.hurt(0.6); }
    applyPose(H, p, 16, rdt, false);
    // rod: hand position, angle by phase
    const ang = st.ph === 'cast' ? lerp(2.2, 0.65, ease(cast)) : st.ph === 'reel' ? 0.95 + Math.sin(t * 10) * 0.04 + st.ten * 0.35 : st.ph === 'bite' ? 0.75 + Math.sin(t * 40) * 0.05 : st.ph === 'ready' ? 1.0 : 0.85;
    F.rod.position.set(F.hx + 0.55, 1.0, 0.25); F.rod.rotation.set(0, 0, -(Math.PI / 2 - ang) - 0.0); F.rod.rotation.z = -(Math.PI / 2 - ang);
    V.set(0, 2.1, 0).applyEuler(F.rod.rotation).add(F.rod.position); // rod tip
    // bobber + line + item
    const showBob = st.ph !== 'ready'; F.bob.visible = showBob; F.bob.position.set(st.bobx, st.boby, 0.15);
    const ib = F.bob.position, la = F.line.geometry.attributes.position.array; const hid = st.ph === 'ready' || st.ph === 'snap';
    la[0] = V.x; la[1] = V.y; la[2] = V.z; la[3] = (V.x + ib.x) / 2; la[4] = Math.min(V.y, ib.y) - (hold ? 0.05 : 0.35) + (st.ph === 'wait' ? -0.1 : 0); la[5] = (V.z + ib.z) / 2; la[6] = ib.x; la[7] = ib.y; la[8] = ib.z; F.line.geometry.attributes.position.needsUpdate = true; F.line.visible = !hid;
    if (F.item) { const underwater = st.ph === 'reel'; F.item.visible = st.ph === 'reel' || st.ph === 'land';
      if (underwater) { const d = 0.9 + (1 - st.p) * 0.9; F.item.position.set(ib.x - 0.1, -0.35 - d + Math.sin(t * (st.run > 0 ? 18 : 6)) * 0.12, -0.15); F.item.rotation.set(0, 0, Math.sin(t * (st.run > 0 ? 22 : 8)) * 0.4); F.item.scale.setScalar(0.9 + (st.hook && st.hook[3] === 'cart' ? 0.1 : 0)); }
      else if (st.ph === 'land') { F.item.position.set(ib.x, ib.y - 0.1, 0.1); F.item.rotation.set(0, t * 1.2, Math.sin(t * 5) * 0.2); } }
    if (F.item && F.item.userData.glow) F.item.material.emissive && F.item.material.emissive.set('#4affc0');
    // Chompy: chews junk, wheel turns, googly eyes wander
    const C = F.C; C.root.position.set(F.chx, -0.25 + Math.sin(t * 1.4) * 0.03, -0.25); C.root.scale.setScalar(F.chs); C.root.rotation.y = -0.5;
    if (C.wheel) C.wheel.rotation.z -= rdt * (0.6 + st.chew * 6); if (C.eyes) for (let i = 0; i < C.eyes.length; i++) C.eyes[i].position.set(Math.sin(t * 1.7 + i) * 0.05, Math.cos(t * 2.1 + i) * 0.05 - st.chew * 0.04, 0.12);
    if (C.update) C.update(rdt, st.chew);
    // fx
    F.fx.count = F.fxs.length; for (let i = 0; i < F.fxs.length; i++) { const f = F.fxs[i], s = 0.5 + 1.8 * (f.life / f.max); V3.set(f.x, f.y, f.z + 0.2); const M = new THREE.Matrix4().compose(V3, new THREE.Quaternion(), new THREE.Vector3(s, s, s)); F.fx.setMatrixAt(i, M); } F.fx.instanceMatrix.needsUpdate = true;
    if (F.lamp) F.lamp.position.set(F.dock.position.x + 5.3, 2.2, 0.4);
    OUT_U.fogC.value.copy(F.scene.fog.color); OUT_U.fogN.value = 26; OUT_U.fogF.value = 60;
  };

  // ---------------- test bot: win = steady cast, quick hook, reel in pulses, ease on runs; lose = holds B so every line snaps ----------------
  F.botThink = function (B, dt) {
    const st = F.st; if (!st || st.over) return; B.mx = B.my = 0; B.bh = false;
    if (st.ph === 'ready' && st.cd <= 0) { if (B.mode === 'lose' || (st.m > 0.62 && st.m < 0.74)) B.a = true; }
    else if (st.ph === 'bite') { B.bt = (B.bt || 0) + dt; if (B.bt > 0.2) { B.a = true; B.bt = 0; } }
    else if (st.ph === 'reel') { B.bt = 0; if (B.mode === 'lose') B.bh = true; else B.bh = st.run <= 0 && st.runT > 0.55 && st.ten < 0.62; }
    else B.bt = 0;
  };
  DUELS.reg('fishing', F);

  // ---------------- the city side: a ring at each fishing spot, ACT = FISH ----------------
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 8, 0, TAU); g.fill(); }, 128);
  const rings = [];
  function setup() {
    for (const sp of SPOTS) {
      const y = groundY(sp.x, sp.z);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: ringT, color: '#4ad8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, y + 0.05, sp.z); ring.renderOrder = 2; ring.visible = false; scene.add(ring); rings.push({ ring, sp });
      ACTIONS.push({ kind: 'fish', label: 'FISH', x: sp.x, z: sp.z, r: 1.6, y: 2.2, ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('duels') || Q.has('fish')), go: () => { F.spotNext = sp; DUELS.start('fishing'); } });
    }
  }
  MODE.ticks.push((rdt) => { for (const r of rings) { const d = Math.hypot(r.sp.x - hero.pos.x, r.sp.z - hero.pos.z); r.ring.visible = d < 22 && !DUELS.cur; if (r.ring.visible) { r.ring.rotation.z += rdt * 0.7; r.ring.material.opacity = 0.7 + 0.3 * Math.sin(S.time * 3); } } });
  let n = 0; MODE.ticks.push(() => { n++; if (n === 1) setup();
    if (n === 3 && Q.has('fish') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('fishauto'); DUELS.start('fishing', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__fishing = F; F.save = save; F.SPOTS = SPOTS; F.reset = () => { Object.assign(save, { caught: {}, bucket: 0, junk: 0, chompy: 0, cane: false, purse: false, lantern: false, key: false, casts: 0 }); persist(); };
})();

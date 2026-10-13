// ======================= FINALE PAYOFF: the celebration after the One-Eyed Brewmaster (Brad 2026-10-13, "FINALE PAYOFF").
// Trigger: the 'tcb:finale' window event that 09w_brewmaster.js fires after his harbor splash. When the brewmaster duel exits (the win card's CONTINUE),
// this file takes over the screen through MODE.duel (07_main) with its own small scene + camera, then hands the city back. No shared file is edited.
//   1) DOCK: Harold (bald, glasses, cane) and Mavis (gray afro, purse), their own buildHero() rigs, on an Inner Harbor dock at night: they watch,
//      cheer (cane in the air, Mavis hops), then turn and hug.
//   2) FIREWORKS: procedural shells (peony, ring, willow, crackle) over the harbor in one additive Points system; the SAME buffers drawn a second time
//      mirrored under the water plane as wobbling vertical streaks = the reflections; flashes tint the water + light the couple. WebAudio pops (thump +
//      noise crack + a launch whistle, delayed by distance). The radio is held (paused) for the scene and released after.
//   3) DRONE UNLOCKED card ("DRONE UNLOCKED — fly over Toad City"), saved in localStorage (tcb_finale.drone). In the city afterwards: ACT (when no other
//      action is in reach and no fight is on) = DRONE, also key V and the DRONE chip under the HD button. Free-fly camera over the city: stick / WASD
//      moves, drag / Q R / L R buttons / right stick turns, JUMP (K / Space) climbs, SWING (J / Shift / C) dives, ACT / V / Esc / ✕ lands (exits).
//      The city sim is paused while flying (thugs hold still); the camera, radio and controls are restored on landing.
//   4) CREDITS roll: Harold & Mavis, the 19 bosses by name (from the brewery gate's own list, 09w C.gate.others(), else LANDMARKS bosses), the final
//      boss, and RADIO CREDITS built from 08_radio.js's track data (window.__radio.TRACKS: title, artist, prod, licence). Tap skips.
//   5) Back in the free-roam city on the Harborplace promenade: banner CITY SAVED, every district's crime -> 0 (BOSS_CLEAR.crime) and a
//      "CITY SAVED · CRIME 0%" meter chip (saved, shown on every later visit).
// Length ~51 s (dock 15 s, drone card 4 s, credits 32 s). Tap / A / B / ACT / Space after 1 s = skip ahead (dock -> credits, credits -> city);
// SKIP ▸▸ button / Esc = straight back to the city.
// Tests: ?finale=1 jumps straight to the celebration (skips the intro). &finaleauto=1 = CI timing (dock 6 s, card 2.2 s, credits 7 s), then in the city a
// scripted 3.5 s drone flight (enter, climb + fly, land). State on window.__finale (F.phase, F.log, F.bursts, credits counts, drone state).
(function () {
  const LS = 'tcb_finale', AUTO = Q.has('finaleauto');
  let save = { saved: false, drone: false, runs: 0, flights: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)); } catch (e) {} };
  const TL = AUTO ? { dock: 6, card: 2.2, cred: 7 } : { dock: 15, card: 4, cred: 32 };
  const F = { on: false, phase: 'off', t: 0, pt: 0, log: [], runs: 0, bursts: 0, auto: AUTO, pending: false, cardShown: false, save, credits: null };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const pickA = (a) => a[(Math.random() * a.length) | 0];
  const ease2 = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

  // ================= DOM: overlay (title, card, credits, skip) + city chips (crime meter, DRONE) + drone HUD =================
  ICONS.drone = '<path d="M5 6h4M15 6h4M7 6v3M17 6v3M8 10h8l1.5 3.5h-11zM10 13.5l-1 3M14 13.5l1 3"/><circle cx="12" cy="11.5" r="1.2"/>';
  const css = document.createElement('style');
  css.textContent = `
  body.finale #hpbox, body.finale #p2, body.finale #ko, body.finale #face, body.finale #clock, body.finale #qbtn, body.finale #combo, body.finale #banner, body.finale #lmk,
  body.finale #mmap, body.finale #hint, body.finale #prompt, body.finale #proto, body.finale #rid, body.finale #rcard, body.finale #bark, body.finale #lmkb, body.finale #lbT,
  body.finale #lbB, body.finale #title, body.finale #fcrime, body.finale #fdrbtn,
  body.drone #prompt, body.drone #hpbox, body.drone #p2, body.drone #ko, body.drone #face, body.drone #mmap, body.drone #lmk, body.drone #bark, body.drone #lmkb, body.drone #hint, body.drone #combo, body.drone #fdrbtn, body.drone #title { display: none !important; }
  body.duel #fcrime, body.duel #fdrbtn, body.fort #fcrime, body.fort #fdrbtn, body.derby #fcrime, body.derby #fdrbtn, body.vicfight #fcrime, body.vicfight #fdrbtn,
  body.rbmode #fcrime, body.rbmode #fdrbtn { display: none !important; }
  #fin { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 45; display: none; pointer-events: none; overflow: hidden; font-family: 'PX', monospace; color: #fff; -webkit-user-select: none; user-select: none; }
  body.finale #fin { display: block; }
  #fin .ftl { position: absolute; left: 0; right: 0; top: 13%; text-align: center; font-size: 17px; line-height: 1.6; color: #ffd23c; text-shadow: 3px 3px 0 #000, -1px -1px 0 #000; opacity: 0; transform: scale(.85); transition: opacity .6s, transform .6s; }
  #fin .ftl small { display: block; font-size: 8px; color: #e8e0ff; letter-spacing: 1px; margin-top: 6px; }
  #fin .ftl.on { opacity: 1; transform: scale(1); }
  #fin .fsay { position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%); width: min(84vw, 380px); padding: 8px 10px; background: #1b1030e6; border: 2px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff9ad0; font-size: 9px; line-height: 1.7; text-align: center; opacity: 0; transition: opacity .3s; }
  #fin .fsay b { display: block; color: #ffd23c; font-weight: normal; font-size: 7px; margin-bottom: 2px; } #fin .fsay.on { opacity: 1; }
  #fin .fcard { position: absolute; left: 50%; top: 42%; width: min(86vw, 360px); padding: 16px 12px 14px; transform: translate(-50%, -50%) scale(.6); opacity: 0; background: #14101fee; border: 3px solid #000;
    box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #6bffd8, 0 0 40px #6bffd855; text-align: center; transition: opacity .35s, transform .45s cubic-bezier(.2,1.6,.4,1); }
  #fin .fcard.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  #fin .fcard svg { width: 54px; height: 54px; fill: none; stroke: #6bffd8; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  #fin .fcard h2 { margin: 6px 0 8px; font-size: 16px; line-height: 1.4; font-weight: normal; color: #6bffd8; text-shadow: 2px 2px 0 #000; }
  #fin .fcard p { margin: 0 0 8px; font-size: 10px; line-height: 1.6; color: #fff; } #fin .fcard p.k { font-size: 7px; color: #cfc8ef; margin: 0; line-height: 1.8; }
  #fin .fcred { position: absolute; inset: 0; opacity: 0; transition: opacity .8s; background: linear-gradient(90deg, #05040ccc, #05040c66 30%, #05040c66 70%, #05040ccc); }
  #fin .fcred.on { opacity: 1; }
  #fin .froll { position: absolute; left: 0; right: 0; top: 0; text-align: center; will-change: transform; padding: 0 12px; }
  #fin .froll h1 { font-size: 18px; line-height: 1.5; color: #ffd23c; text-shadow: 3px 3px 0 #000; font-weight: normal; margin: 0 0 6px; }
  #fin .froll h3 { font-size: 10px; color: #ff9ad0; font-weight: normal; letter-spacing: 2px; margin: 34px 0 12px; text-shadow: 2px 2px 0 #000; }
  #fin .froll p { font-size: 9px; line-height: 1.7; margin: 0 0 9px; text-shadow: 2px 2px 0 #000; }
  #fin .froll p small { display: block; font-size: 7px; color: #b8b0d8; }
  #fin .froll p.r { font-size: 7px; line-height: 1.7; margin: 0 auto 7px; max-width: 420px; color: #e8e0ff; }
  #fin .froll p.r i { font-style: normal; color: #ffd23c; }
  #fin .froll .end { margin-top: 44px; font-size: 14px; color: #6bffd8; }
  #fin .fskip { all: unset; position: absolute; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 8px); pointer-events: auto; cursor: pointer; padding: 7px 9px; border: 2px solid #000; background: #2a1650; color: #ffd23c; font: 8px 'PX', monospace; box-shadow: 2px 2px 0 #000; opacity: 0; transition: opacity .4s; touch-action: manipulation; }
  #fin .fskip.on { opacity: 1; }
  #fin .ftap { position: absolute; left: 0; right: 0; bottom: 3%; text-align: center; font-size: 7px; color: #ffffffaa; text-shadow: 1px 1px 0 #000; opacity: 0; transition: opacity .5s; }
  #fin .ftap.on { opacity: 1; }
  #finblk { position: fixed; inset: 0; z-index: 70; background: #000; opacity: 0; pointer-events: none; }
  #fcrime, #fdrbtn { position: fixed; z-index: 60; right: calc(env(safe-area-inset-right, 0px) + 10px); font: 7px/1 'PX', monospace; border: 2px solid #000; box-shadow: 2px 2px 0 #000; padding: 5px 6px; display: none; }
  #fcrime { top: calc(env(safe-area-inset-top, 0px) + 136px); background: #14301e; color: #7dff6b; pointer-events: none; }
  #fcrime.on, #fdrbtn.on { display: block; }
  #fdrbtn { all: unset; position: fixed; z-index: 60; right: calc(env(safe-area-inset-right, 0px) + 10px); top: calc(env(safe-area-inset-top, 0px) + 158px); font: 8px/1 'PX', monospace; color: #14101f; background: #6bffd8;
    border: 2px solid #000; box-shadow: 2px 2px 0 #000; padding: 5px 6px; cursor: pointer; pointer-events: auto; touch-action: manipulation; display: none; }
  #fdrbtn.on { display: block; }
  #fdrone { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 44; display: none; pointer-events: none; font-family: 'PX', monospace; color: #fff; }
  body.drone #fdrone { display: block; }
  #fdrone .dt { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 36px); transform: translateX(-50%); font-size: 9px; color: #6bffd8; text-shadow: 2px 2px 0 #000; white-space: nowrap; }
  #fdrone .dt small { display: block; text-align: center; font-size: 7px; color: #fff; margin-top: 5px; }
  #fdrone .dh { position: absolute; left: 0; right: 0; bottom: 3%; text-align: center; font-size: 7px; line-height: 1.8; text-shadow: 1px 1px 0 #000; opacity: .9; }
  #fdrone .dx { all: unset; position: absolute; right: 8px; top: calc(env(safe-area-inset-top, 0px) + 36px); pointer-events: auto; cursor: pointer; width: 30px; height: 30px; border-radius: 6px; border: 2px solid #000; background: #2a1650; color: #6bffd8; text-align: center; font: 900 16px/28px system-ui, sans-serif; box-shadow: 2px 2px 0 #000; }
  #fdrone .dret { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border: 2px solid #6bffd888; border-radius: 50%; }
  @media (max-width: 480px) { #fin .ftl { font-size: 14px; top: 11%; } #fin .fcard h2 { font-size: 13px; } #fin .froll h1 { font-size: 15px; } }`;
  document.head.appendChild(css);
  const DRONE_SVG = '<svg viewBox="0 0 24 24">' + ICONS.drone + '</svg>';
  const root = document.createElement('div'); root.id = 'fin';
  root.innerHTML = `<div class="fcred"><div class="froll"></div></div><div class="ftl"></div><div class="fsay"></div>
    <div class="fcard">${DRONE_SVG}<h2>DRONE UNLOCKED</h2><p>— fly over Toad City</p><p class="k">${TOUCH ? 'In the city: tap ACT (or the DRONE chip) to take off' : 'In the city: ACT / E or V to take off'}</p></div>
    <button class="fskip" type="button">SKIP &#9656;&#9656;</button><div class="ftap"></div>`;
  document.body.appendChild(root);
  const blk = document.createElement('div'); blk.id = 'finblk'; document.body.appendChild(blk);
  const crimeChip = document.createElement('div'); crimeChip.id = 'fcrime'; document.body.appendChild(crimeChip);
  const drBtn = document.createElement('button'); drBtn.id = 'fdrbtn'; drBtn.type = 'button'; drBtn.textContent = 'DRONE'; document.body.appendChild(drBtn);
  const dhud = document.createElement('div'); dhud.id = 'fdrone';
  dhud.innerHTML = `<div class="dt">DRONE<small></small></div><div class="dret"></div><button class="dx" type="button" aria-label="Land the drone">✕</button>
    <div class="dh">${TOUCH ? 'STICK FLY · DRAG TURN · JUMP UP · SWING DOWN · ACT LAND' : 'WASD FLY · DRAG / Q R TURN · SPACE / K UP · SHIFT / J DOWN · E / V / ESC LAND'}</div>`;
  document.body.appendChild(dhud);
  const q = (s) => root.querySelector(s);
  const D = { tl: q('.ftl'), say: q('.fsay'), card: q('.fcard'), cred: q('.fcred'), roll: q('.froll'), skip: q('.fskip'), tap: q('.ftap'), alt: dhud.querySelector('.dt small') };
  for (const ev of ['pointerdown', 'touchstart']) D.skip.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  D.skip.addEventListener('click', (e) => { e.stopPropagation(); if (F.on && F.t > 1) { F.log.push('skip:all'); finish(); } });
  drBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); droneToggle('chip'); });
  dhud.querySelector('.dx').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); droneExit('x'); });
  canvas.addEventListener('pointerdown', () => { if (F.on && !F.leaving) tapSkip('tap'); });
  function layout() { const h = VH() + 'px'; root.style.height = h; dhud.style.height = h; }
  addEventListener('resize', () => { if (F.on || DR.on) { layout(); resizeCam(); } });
  function chips() {
    const cityOk = save.saved; crimeChip.classList.toggle('on', cityOk); drBtn.classList.toggle('on', !!save.drone && !BOT);
    if (cityOk) crimeChip.textContent = 'CITY SAVED · CRIME ' + (typeof BOSS_CLEAR !== 'undefined' ? BOSS_CLEAR.cityCrime() : 0) + '%';
  }
  function citySaved() { if (typeof BOSS_CLEAR === 'undefined') return; for (const k of Object.keys(BOSS_CLEAR.crime)) BOSS_CLEAR.crime[k] = 0; }
  if (save.saved) citySaved();
  setTimeout(chips, 0);
  const LBL = ['a', 'b', 'c', 'l', 'r'], LBL0 = {};
  for (const n of LBL) { const e = $('albl-' + n); LBL0[n] = e ? e.innerHTML : ''; }
  const labels = (map) => { for (const n of LBL) { const e = $('albl-' + n); if (e) e.innerHTML = map ? map[n] || '' : LBL0[n]; } };

  // ================= the dock scene =================
  let SC = null, CAM2 = null, FX = null, H = null, M = null, WATER = null, FLASH = null, HEMI = null, BULBS = null;
  const deckY = 0.55;
  function tex(w, h, fn, max = 1024) { return canvasTex(w, h, fn, max); }
  function build() {
    SC = new THREE.Scene(); SC.fog = new THREE.Fog('#070a18', 120, 560);
    CAM2 = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    HEMI = new THREE.HemisphereLight('#5a6aa8', '#141420', 0.75); const moon = new THREE.DirectionalLight('#9ab0ff', 0.7); moon.position.set(-30, 50, -40); SC.add(HEMI, moon, moon.target);
    const lamp = new THREE.PointLight('#ffb070', 9, 9, 1.5); lamp.position.set(2.2, 3.1, 1.6); SC.add(lamp);
    FLASH = new THREE.PointLight('#ffffff', 0, 140, 1.2); FLASH.position.set(0, 26, -40); SC.add(FLASH);
    // sky dome: gradient, stars, a moon
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: tex(512, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#02030a'); gr.addColorStop(0.42, '#070b22'); gr.addColorStop(0.5, '#1a1a40'); gr.addColorStop(0.53, '#2a2050'); gr.addColorStop(1, '#05060e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 260; i++) { const y = r() * h * 0.46; g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.7})`; g.fillRect(r() * w, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(w * 0.62, h * 0.26, 9, 0, TAU); g.fill(); g.fillStyle = '#e8dcb8'; g.beginPath(); g.arc(w * 0.62 + 3, h * 0.26 - 2, 2, 0, TAU); g.fill(); }, 512) }));
    sky.renderOrder = -10; SC.add(sky); SC.userData.sky = sky;
    // the harbor water: a dark, slightly see-through plane (the mirrored fireworks draw underneath it)
    WATER = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: '#0a1430', transparent: true, opacity: 0.72, depthWrite: false }));
    WATER.rotation.x = -Math.PI / 2; WATER.renderOrder = 2; SC.add(WATER); WATER.userData.base = new THREE.Color('#0a1430');
    // skyline cut-outs on three shores (lit windows; a dark ONE-EYE BREWERY sign: the lights are out for good)
    const skyline = (seed, sign) => tex(1024, 256, (g, w, h) => {
      let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); g.clearRect(0, 0, w, h);
      for (let x = 0; x < w;) { const bw = 26 + r() * 50, bh = 40 + r() * 150 + (r() < 0.12 ? 60 : 0); g.fillStyle = r() < 0.5 ? '#0c0e1c' : '#11132a'; g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 6; wy < h - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 5; wx += 8) if (r() < 0.32) { g.fillStyle = r() < 0.8 ? '#ffd890' : '#a8d8ff'; g.fillRect(wx, wy, 3, 4); }
        if (r() < 0.15) { g.fillStyle = '#ff3d3d'; g.fillRect(x + bw / 2 - 1, h - bh - 6, 3, 3); } x += bw + r() * 6; }
      if (sign) { g.fillStyle = '#1a1612'; g.fillRect(w * 0.7, h - 230, 190, 30); g.font = 'bold 18px monospace'; g.fillStyle = '#3a3228'; g.fillText('ONE-EYE BREWERY', w * 0.7 + 12, h - 209); } });
    const shore = (t, wd, ht, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, fog: false })); m.position.set(x, ht / 2 - 0.5, z); m.rotation.y = ry; SC.add(m);
      const land = new THREE.Mesh(new THREE.BoxGeometry(wd, 1.2, 6), new THREE.MeshBasicMaterial({ color: '#06070f', fog: false })); land.position.set(x, 0.1, z); land.rotation.y = ry; land.translateZ(-2.5); SC.add(land); };
    shore(skyline(7, true), 520, 130, 0, -230, 0); shore(skyline(23), 420, 105, -190, -60, Math.PI / 2); shore(skyline(41), 420, 105, 190, -60, -Math.PI / 2);
    // the dock: planks, posts, bollards, a lamp, a string of bulbs (one merged mesh + one bulb Points)
    const K = DUELS.kit(), G = DUELS.GEO;
    for (let i = 0; i < 14; i++) K.add(G.box(0.42, 0.12, 12), i % 3 ? '#6a4a30' : '#5a3e28', -2.75 + i * 0.425, deckY - 0.06, 3.6);
    for (const x of [-2.9, 2.9]) for (let z = -2.2; z <= 9; z += 2.2) K.add(G.cyl(0.16, 0.18, 3, 7), '#3a2a1e', x, deckY - 1.4, z);
    for (const x of [-2.9, 2.9]) K.add(G.box(0.18, 0.18, 12), '#4a3424', x, deckY + 0.05, 3.6);
    for (const x of [-2.3, 2.3]) K.add(G.cyl(0.14, 0.18, 0.42, 8), '#2a2a30', x, deckY + 0.2, -2.0).add(G.sph(0.17, 8, 5), '#2a2a30', x, deckY + 0.42, -2.0);
    K.add(G.cyl(0.06, 0.08, 2.9, 6), '#1e1e24', 2.6, deckY + 1.45, 1.6).add(G.box(0.34, 0.3, 0.34), '#1e1e24', 2.6, deckY + 2.95, 1.6).add(G.box(0.22, 0.2, 0.22), '#ffe0a0', 2.6, deckY + 2.82, 1.6);
    // a couple of moored boats out on the water (the launch barges)
    for (const [x, z] of [[-26, -70], [4, -96], [30, -78]]) K.add(G.box(9, 1.2, 3.2), '#14161e', x, 0.3, z).add(G.box(3, 1.4, 2.2), '#1c1e28', x - 1, 1.4, z);
    K.mesh(toonMat(), SC, 0.004);
    const bp = [], bc = [], bz = [];
    for (let i = 0; i < 22; i++) { const s = i < 11 ? -1 : 1, z = -2 + (i % 11) * 1.0; bp.push(s * 2.9, deckY + 1.9 + Math.sin((i % 11) / 10 * Math.PI) * -0.35, z); const c = new THREE.Color(pickA(['#ffd890', '#ff9ad0', '#9adfff', '#ffe08a'])); bc.push(c.r, c.g, c.b, 1); bz.push(0.32); }
    const lineK = DUELS.kit(); for (const s of [-1, 1]) lineK.add(G.cyl(0.012, 0.012, 10, 3), '#111', s * 2.9, deckY + 1.75, 3, Math.PI / 2, 0, 0);
    lineK.add(G.cyl(0.03, 0.03, 1.8, 4), '#111', -2.9, deckY + 0.95, -2.2).add(G.cyl(0.03, 0.03, 1.8, 4), '#111', 2.9, deckY + 0.95, -2.2);
    lineK.mesh(toonMat(), SC, 0);
    BULBS = pointsMesh(new Float32Array(bp), new Float32Array(bc), new Float32Array(bz), false); BULBS.geometry.setDrawRange(0, 22); SC.add(BULBS);
    // the couple
    H = buildHero(); M = buildHero({ wife: true }); SC.add(H.root, M.root);
    // fireworks: one particle system, drawn twice (sky + its reflection)
    FX = PSys(2600); SC.add(FX.pts, FX.refl);
  }
  // ---- points: shared shader (sky = round soft dots; refl = vertical streaks with a wobble, dimmer) ----
  const PU = { uScale: { value: 300 }, uT: { value: 0 } };
  function ptsMat(refl, additive = true) {
    return new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec4 pcol; attribute float psize; uniform float uScale; uniform float uT; varying vec4 vC; void main(){ vC = pcol; vec3 p = position;
        ${refl ? 'p.x += sin(uT * 3.1 + p.y * 0.45) * (0.25 + p.y * 0.012);' : ''} vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(psize * uScale ${refl ? '* 1.5' : ''} / max(0.5, -mv.z), 1.0, 160.0); }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = ${refl ? 'd.x * d.x * 26.0 + d.y * d.y * 4.0' : 'dot(d, d) * 4.0'}; if (r > 1.0) discard;
        float a = vC.a * (1.0 - r) * ${refl ? '0.6' : '(1.0 - r)'}; gl_FragColor = vec4(vC.rgb, a); }` });
  }
  function pointsMesh(P, C, Z, refl) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('pcol', new THREE.BufferAttribute(C, 4)); g.setAttribute('psize', new THREE.BufferAttribute(Z, 1));
    const m = new THREE.Points(g, ptsMat(refl)); m.frustumCulled = false; m.renderOrder = 6; return m; }
  function PSys(cap) {
    const P = new Float32Array(cap * 3), C = new Float32Array(cap * 4), Z = new Float32Array(cap), st = new Float32Array(cap * 12); let n = 0;
    const g = new THREE.BufferGeometry(); const aP = new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage), aC = new THREE.BufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage), aZ = new THREE.BufferAttribute(Z, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', aP); g.setAttribute('pcol', aC); g.setAttribute('psize', aZ); g.setDrawRange(0, 0);
    const pts = new THREE.Points(g, ptsMat(false)); pts.frustumCulled = false; pts.renderOrder = 6;
    const refl = new THREE.Points(g, ptsMat(true)); refl.frustumCulled = false; refl.renderOrder = 1; refl.scale.y = -0.5; // mirrored under the water (y 0), squashed toward the horizon like a reflection on chop
    // st: 0-2 vel, 3 age, 4 life, 5 size, 6-8 rgb, 9 drag, 10 grav, 11 flags (1 flicker, 2 trail-emitter, 4 shell)
    function emit(x, y, z, vx, vy, vz, life, size, col, drag = 0, grav = 0, flags = 0) {
      if (n >= cap) return -1; const i = n++, o = i * 12; P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      st[o] = vx; st[o + 1] = vy; st[o + 2] = vz; st[o + 3] = 0; st[o + 4] = life; st[o + 5] = size; st[o + 6] = col.r; st[o + 7] = col.g; st[o + 8] = col.b; st[o + 9] = drag; st[o + 10] = grav; st[o + 11] = flags; return i; }
    const shells = [];
    function step(dt, t) {
      for (let i = 0; i < n; i++) { const o = i * 12; st[o + 3] += dt;
        if (st[o + 3] >= st[o + 4]) { n--; if (i !== n) { P.copyWithin(i * 3, n * 3, n * 3 + 3); st.copyWithin(o, n * 12, n * 12 + 12); } i--; continue; }
        const dr = Math.exp(-st[o + 9] * dt); st[o] *= dr; st[o + 1] = st[o + 1] * dr - st[o + 10] * dt; st[o + 2] *= dr;
        P[i * 3] += st[o] * dt; P[i * 3 + 1] += st[o + 1] * dt; P[i * 3 + 2] += st[o + 2] * dt;
        const u = st[o + 3] / st[o + 4], f = st[o + 11]; let a = u < 0.08 ? 1 : Math.pow(1 - u, 1.4);
        if (f & 1) a *= Math.sin(t * 40 + i * 3.7) > -0.2 ? 1 : 0.15;
        const hot = Math.max(0, 1 - u * 5); // the first instant of a star burns white-hot
        C[i * 4] = Math.min(1, st[o + 6] + hot * 0.6); C[i * 4 + 1] = Math.min(1, st[o + 7] + hot * 0.6); C[i * 4 + 2] = Math.min(1, st[o + 8] + hot * 0.6); C[i * 4 + 3] = a;
        Z[i] = st[o + 5] * (f & 4 ? 1 : 0.55 + 0.45 * (1 - u));
        if ((f & 2) && Math.random() < dt * 30 && n < cap - 1) { const j = emit(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], 0, -0.4, 0, 0.5, st[o + 5] * 0.6, _tc.setRGB(st[o + 6], st[o + 7] * 0.8, st[o + 8] * 0.5), 1, 1.5, 0); }
      }
      g.setDrawRange(0, n); aP.needsUpdate = aC.needsUpdate = aZ.needsUpdate = true;
      for (let k = shells.length - 1; k >= 0; k--) { const s = shells[k]; s.t += dt; s.p.addScaledVector(s.v, dt); s.v.y -= 9 * dt;
        if (Math.random() < dt * 60) emit(s.p.x + rnd(-0.15, 0.15), s.p.y, s.p.z, rnd(-0.4, 0.4), rnd(-1.5, -0.4), rnd(-0.4, 0.4), 0.55, 0.55, _gold, 0.6, 2, 0);
        if (s.t >= s.fuse) { shells.splice(k, 1); burst(s.p, s.kind, s.cols); } }
    }
    return { pts, refl, emit, step, shells, clear() { n = 0; shells.length = 0; g.setDrawRange(0, 0); }, get n() { return n; } };
  }
  const _tc = new THREE.Color(), _gold = new THREE.Color('#ffcf7a');
  const PAL = [['#ff3d3d', '#ffd23c'], ['#3d8bff', '#ffffff'], ['#6bff7a', '#ffd23c'], ['#ff6be8', '#9adfff'], ['#ffd23c'], ['#ff8a3d', '#ffffff'], ['#b46bff', '#6bffd8'], ['#ff3d3d', '#ffffff', '#3d6dff']];
  const KINDS = ['peony', 'peony', 'ring', 'willow', 'crackle', 'peony2'];
  function launch(kind, big = 1) {
    const x = rnd(-40, 40), z = rnd(-88, -52), apex = rnd(20, 38) * (0.9 + 0.15 * big), vy = Math.sqrt(2 * 9 * apex), fuse = vy / 9 * rnd(0.92, 1.0);
    FX.shells.push({ p: new THREE.Vector3(x, 0.4, z), v: new THREE.Vector3(rnd(-1.5, 1.5), vy, rnd(-1, 1)), t: 0, fuse, kind: kind || pickA(KINDS), cols: pickA(PAL).map((c) => new THREE.Color(c)), big });
    whistle(z);
  }
  const FL = { k: 0, col: new THREE.Color() };
  function burst(p, kind, cols) {
    F.bursts++; const n = kind === 'ring' ? 70 : kind === 'willow' ? 90 : 110, sp = kind === 'willow' ? 9 : kind === 'ring' ? 13 : 14;
    const ax = new THREE.Vector3(rnd(-0.4, 0.4), 1, rnd(-0.4, 0.4)).normalize(), t1 = new THREE.Vector3(1, 0, 0).cross(ax).normalize(), t2 = ax.clone().cross(t1);
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length]; let vx, vy, vz;
      if (kind === 'ring') { const a = i / n * TAU; V.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).multiplyScalar(sp * rnd(0.95, 1.05)); vx = V.x; vy = V.y; vz = V.z; }
      else { const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), s = sp * (kind === 'peony2' && i % 2 ? 0.55 : rnd(0.85, 1.05)); vx = r * Math.cos(a) * s; vy = u * s; vz = r * Math.sin(a) * s; }
      if (kind === 'willow') FX.emit(p.x, p.y, p.z, vx, vy, vz, rnd(2.6, 3.4), 1.3, _gold, 1.1, 3.2, 2);
      else FX.emit(p.x, p.y, p.z, vx, vy, vz, rnd(1.4, 2.0), 1.6, c, 1.6, 2.4, kind === 'crackle' ? 1 : 0);
    }
    FX.emit(p.x, p.y, p.z, 0, 0, 0, 0.18, 9, _tc.set('#ffffff'), 0, 0, 4); // the flash ball
    FL.k = Math.min(1.6, FL.k + 0.9); FL.col.copy(cols[0]); FLASH.position.set(p.x * 0.5, p.y, p.z * 0.5);
    boom(p);
  }

  // ---------------- WebAudio: launch whistle, the boom (thump + crack, delayed by distance), crackle ----------------
  const AOK = () => AC && AC.state === 'running' && !AUTO;
  function whistle(z) { if (!AOK()) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1900, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + 1.25); }
  function boom(p) {
    if (!AOK()) return; const d = Math.hypot(p.x, p.y, p.z), t = AC.currentTime + Math.min(0.35, d / 340), out = SFXBUS || AC.destination, k = clamp(70 / d, 0.4, 1);
    const o = AC.createOscillator(), og = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.75);
    if (NOISE) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = rnd(900, 1800); f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.4);
      for (let i = 0; i < 6; i++) { const s2 = AC.createBufferSource(), g2 = AC.createGain(), t2 = t + 0.35 + Math.random() * 0.9; s2.buffer = NOISE; g2.gain.setValueAtTime(0.06 * k, t2); g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.03); s2.connect(g2); g2.connect(out); s2.start(t2, Math.random() * 0.3); s2.stop(t2 + 0.04); } }
  }
  function fanfare() { if (!AOK()) return; const t0 = AC.currentTime + 0.05, out = SFXBUS || AC.destination; // ta-da-DAAA (G C E G)
    [[392, 0, 0.14], [523, 0.15, 0.14], [659, 0.3, 0.14], [784, 0.45, 0.9]].forEach(([f, dt, len]) => { for (const [ty, v] of [['square', 0.05], ['triangle', 0.08]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = ty; o.frequency.value = f; const t = t0 + dt;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02); } }); }

  // ---------------- poses (the shared HERO joint set; buildHero rigs face +z) ----------------
  function poseStand(t) { return HERO_POSES.idle(t); }
  function poseCheerH(t) { const p = HERO_POSES.idle(0); const w = Math.sin(t * 7); p.shR = [-2.85, 0, -0.25 + w * 0.25]; p.elR = [-0.25, 0, 0]; p.swR = [Math.PI - 0.1, 0, 0]; p.shL = [-1.9, 0, 0.7]; p.elL = [-0.6, 0, 0];
    p.torso = [-0.12, 0, 0]; p.neck = [-0.35, 0, 0]; p.y += Math.max(0, Math.sin(t * 7)) * 0.06; return p; }
  function poseCheerM(t) { const p = HERO_POSES.idle(0); const hop = Math.max(0, Math.sin(t * 8)); p.shL = [-2.8, 0, 0.5 + hop * 0.2]; p.shR = [-2.8, 0, -0.5 - hop * 0.2]; p.elL = p.elR = [-0.3, 0, 0];
    p.torso = [-0.15, 0, 0]; p.neck = [-0.4, 0, 0]; p.y += hop * 0.16; p.knL = [0.5 * (1 - hop), 0, 0]; p.knR = [0.5 * (1 - hop), 0, 0]; return p; }
  function poseHug(t, side) { const p = HERO_POSES.idle(0); const s = Math.sin(t * 2.2) * 0.06;
    p.shL = [-1.35, 0, -0.55]; p.elL = [-1.15, 0, 0]; p.shR = [-1.35, 0, 0.55]; p.elR = [-1.15, 0, 0]; p.swR = [Math.PI / 2 + 1.2, 0, 0]; p.swL = [Math.PI / 2 + 1.2, 0, 0];
    p.torso = [0.28, 0, s]; p.neck = [0.15, side * 0.35, side * 0.25]; p.hips = [0, 0, 0]; return p; }

  // ---------------- the timeline ----------------
  const SAYS = [['HAROLD', 'Would you look at that, hon. The whole harbor lit up for us.'], ['MAVIS', 'Forty-two years and you still know how to show a girl a night out.'], ['HAROLD', 'Toad City is safe. Now, where did I park the cane?'], ['MAVIS', "It's in your hand, Harold."]];
  function say(i) { const s = SAYS[i]; if (!s) return; D.say.innerHTML = '<b>' + s[0] + '</b>' + s[1]; D.say.classList.add('on'); F.sayT = AUTO ? 1.2 : 3.4; }
  function title(t, sub, secs) { D.tl.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); D.tl.classList.add('on'); F.tlT = secs; }
  let fireT = 0;
  function start(why) {
    if (F.on) return; if (!SC) build();
    F.on = true; F.runs++; F.pending = false; F.phase = 'dock'; F.t = 0; F.pt = 0; F.cardShown = false; F.saidI = 0; F.leaving = false; F.why = why; F.log.push('start:' + why); fireT = 0.8; F.bursts = 0; F.sayT = 0; F.tlT = 0; F.cardT = 0;
    FX.clear(); FL.k = 0; save.saved = true; save.drone = true; save.runs++; persist(); citySaved();
    audioInit(); if (AC && AC.state === 'suspended' && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) AC.resume().catch(() => {});
    try { window.__radio && __radio.hold && __radio.hold(true); } catch (e) {}
    document.body.classList.add('finale'); layout(); resizeCam(); buildCredits();
    labels({ a: 'SKIP', b: 'SKIP', c: 'SKIP', l: '', r: '' }); if (APANEL) APANEL.setAct({ kind: 'drone', label: 'SKIP' }, 1);
    D.card.classList.remove('on'); D.cred.classList.remove('on'); D.say.classList.remove('on'); D.skip.classList.remove('on'); D.tap.classList.remove('on');
    title('TOAD CITY IS SAVED!', 'Inner Harbor · the night after last call', AUTO ? 2.5 : 4.5);
    H.root.position.set(-0.42, deckY, -1.2); M.root.position.set(0.42, deckY, -1.2); H.root.rotation.set(0, Math.PI, 0); M.root.rotation.set(0, Math.PI, 0);
    applyPose(H, poseStand(0), 60, 1, true); applyPose(M, poseStand(0), 60, 1, true);
    MODE.duel = FIN; KEYS.clear(); PRESS.clear(); IN.mx = IN.my = 0;
    blk.style.transition = 'none'; blk.style.opacity = '1'; requestAnimationFrame(() => { blk.style.transition = 'opacity .9s'; blk.style.opacity = '0'; });
    for (let i = 0; i < 3; i++) launch('peony', 1);
  }
  function tapSkip(how) {
    if (!F.on || F.leaving || F.t < 1) return;
    if (F.phase === 'dock' || F.phase === 'card') { F.log.push('skip:' + F.phase + ':' + how); toCredits(true); }
    else if (F.phase === 'cred' && F.pt > 1) { F.log.push('skip:cred:' + how); finish(); }
  }
  function toCard() { F.phase = 'card'; F.pt = 0; F.log.push('card'); showCard(); for (let i = 0; i < 6; i++) setTimeout(() => F.on && launch(pickA(KINDS), 1.3), i * 140); }
  function showCard() { F.cardShown = true; F.cardT = AUTO ? 2 : 3.6; D.card.classList.add('on'); D.say.classList.remove('on'); D.tl.classList.remove('on'); fanfare(); F.log.push('drone:unlocked'); }
  function toCredits(skipped) {
    F.phase = 'cred'; F.pt = 0; F.log.push('credits'); if (!F.cardShown) showCard(); else if (!skipped) D.card.classList.remove('on');
    D.cred.classList.add('on'); D.tap.classList.remove('on'); D.say.classList.remove('on'); D.tl.classList.remove('on'); F.rollH = D.roll.offsetHeight || 1200;
  }
  function buildCredits() {
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let bosses = [];
    try { bosses = window.__brewmaster && __brewmaster.gate ? __brewmaster.gate.others() : []; } catch (e) {}
    if (!bosses.length) bosses = LANDMARKS.filter((l) => l.boss && l.id !== 'brewery');
    const fin = LANDMARKS.find((l) => l.id === 'brewery');
    let tracks = [];
    try { const T = window.__radio && __radio.TRACKS; if (T) tracks = [...new Set(Object.values(T).flat())].filter(Boolean); } catch (e) {}
    const who = (t) => (t.artist ? t.artist : '') + (t.prod ? (t.artist ? ' · ' : '') + 'prod. ' + t.prod : '');
    let h = '<h1>TOAD CITY<br>BALTIMORE</h1><p><small>THE END</small></p>';
    h += '<h3>STARRING</h3><p>HAROLD<small>the bald toad with the cane</small></p><p>MAVIS<small>gray afro · the purse · the brains</small></p>';
    h += '<h3>THE BOSSES</h3>' + bosses.map((l) => `<p>${esc(l.boss.name)}<small>${esc(l.name)}</small></p>`).join('');
    if (fin && fin.boss) h += `<h3>FINAL BOSS</h3><p>${esc(fin.boss.name)}<small>${esc(fin.name)}</small></p>`;
    if (tracks.length) h += '<h3>RADIO CREDITS</h3>' + tracks.map((t) => `<p class="r"><i>"${esc(t.title)}"</i>${t.tag ? ' (' + esc(t.tag) + ')' : ''} · ${esc(who(t))}${t.lic ? ' · ' + esc(t.lic) : ''}</p>`).join('')
      + '<p class="r">Played through the artists\u2019 own YouTube / Bandcamp embeds. No audio ships with the game.</p>';
    h += '<p class="end">THE CITY IS SAVED<br><br>Thanks for playing, hon.</p>';
    D.roll.innerHTML = h; F.credits = { bosses: bosses.length, bossNames: bosses.map((l) => l.boss.name), final: fin && fin.boss ? fin.boss.name : null, tracks: tracks.length };
  }
  function finish() {
    if (!F.on || F.leaving) return; F.leaving = true; F.log.push('finish'); blk.style.transition = 'opacity .35s'; blk.style.opacity = '1';
    setTimeout(() => {
      F.on = false; F.leaving = false; F.phase = 'off'; MODE.duel = null; FX.clear();
      document.body.classList.remove('finale'); D.card.classList.remove('on'); D.cred.classList.remove('on'); D.say.classList.remove('on'); D.tl.classList.remove('on'); D.skip.classList.remove('on'); D.tap.classList.remove('on');
      try { window.__radio && __radio.hold && __radio.hold(false); } catch (e) {}
      labels(null); if (APANEL) APANEL.setAct({ label: 'ACT', kind: 'reset' }, 1);
      // back on the Harborplace promenade, looking out over the harbor
      const x = -40, z = -33; hero.pos.set(x, groundY(x, z), z); hero.vel.set(0, 0); hero.yaw = 0; try { hero.set('move'); } catch (e) {}
      partner.pos.set(x + 1.1, groundY(x + 1.1, z - 0.6), z - 0.6); partner.vel.set(0, 0); CAM.yaw = Math.PI; snapCam(); IN.dragX = IN.dragY = 0;
      citySaved(); chips(); banner('CITY SAVED!', 4); F.log.push('city:saved:' + BOSS_CLEAR.cityCrime());
      setTimeout(() => { if (!F.on && !DR.on) banner(TOUCH ? 'DRONE READY · TAP ACT' : 'DRONE READY · PRESS V', 3.2); }, 4200);
      KEYS.clear(); PRESS.clear(); last = performance.now(); F.done = true;
      requestAnimationFrame(() => { blk.style.transition = 'opacity .7s'; blk.style.opacity = '0'; });
      if (AUTO) autoDrone();
    }, 380);
  }
  function resizeCam() { if (CAM2) { const a = VW() / VH(); CAM2.aspect = a; CAM2.fov = a < 0.75 ? 70 : a < 1.1 ? 60 : 50; CAM2.updateProjectionMatrix(); } if (DR.on) { camera.aspect = VW() / VH(); camera.updateProjectionMatrix(); } }

  // ---- camera shots (dock-local: the couple at z -1.2 facing -z, the fireworks out at z -66..-112) ----
  const SH = [ // [u0, u1, from pos, to pos, from look, to look]
    [0, 0.36, [1.9, 1.6, 4.6], [1.1, 1.45, 2.7], [0, 3.5, -40], [0, 7, -40]],
    [0.36, 0.62, [2.7, 1.25, 2.6], [2.2, 1.35, 1.9], [-0.7, 3.2, -10], [-0.7, 4.2, -10]],
    [0.62, 1.0, [1.3, 1.45, 3.0], [-1.1, 1.6, 2.8], [0, 1.4, -1.2], [0, 1.75, -1.2]],
  ];
  const _lk = new THREE.Vector3();
  function shot(u) {
    if (F.phase === 'dock') { const s = SH.find((s) => u >= s[0] && u <= s[1]) || SH[2], k = ease2(clamp((u - s[0]) / (s[1] - s[0]), 0, 1));
      CAM2.position.set(lerp(s[2][0], s[3][0], k), lerp(s[2][1], s[3][1], k), lerp(s[2][2], s[3][2], k)); _lk.set(lerp(s[4][0], s[5][0], k), lerp(s[4][1], s[5][1], k), lerp(s[4][2], s[5][2], k)); }
    else { const k = ease2(clamp(F.phase === 'card' ? F.pt / TL.card * 0.4 : 0.4 + F.pt / TL.cred * 0.6, 0, 1)); // a slow crane up and back over the dock
      CAM2.position.set(lerp(1.2, 0, k), lerp(2.2, 7.5, k), lerp(4.2, 13, k)); _lk.set(0, lerp(4, 16, k), -40); }
    CAM2.lookAt(_lk);
  }
  // ================= the mode (runs through MODE.duel) =================
  const FIN = { frame(rdt0) {
    const rdt = AUTO ? Math.min(0.25, rdt0 * 2.5) : rdt0; // (CI: a software GPU renders ~10 fps; the auto run keeps wall time short)
    F.t += rdt; F.pt += rdt; PU.uT.value += rdt;
    // input: tap / A / B / ACT / Space / Enter skip ahead, Esc skips everything
    const kp = PRESS.has('j') || PRESS.has('k') || PRESS.has('e') || PRESS.has(' ') || PRESS.has('enter'); PRESS.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let pb = false; for (const gp of pads) { if (gp && gp.buttons.some((b) => b.pressed)) pb = true; } if (pb && !F.padHeld) tapSkip('pad'); F.padHeld = pb;
    if (kp) tapSkip('key'); if (KEYS.has('escape') && F.t > 1) { KEYS.delete('escape'); F.log.push('skip:all:esc'); finish(); }
    if (F.t > 1 && !D.skip.classList.contains('on') && F.phase !== 'cred') { D.skip.classList.add('on'); D.tap.textContent = TOUCH ? 'TAP TO SKIP' : 'CLICK / SPACE TO SKIP · ESC ENDS'; D.tap.classList.add('on'); }
    if (F.tlT > 0) { F.tlT -= rdt; if (F.tlT <= 0) D.tl.classList.remove('on'); }
    if (F.sayT > 0) { F.sayT -= rdt; if (F.sayT <= 0) D.say.classList.remove('on'); }
    if (F.cardT > 0) { F.cardT -= rdt; if (F.cardT <= 0) D.card.classList.remove('on'); }
    // timeline
    if (F.phase === 'dock') { const u = F.pt / TL.dock;
      const sayAt = [0.2, 0.42, 0.66, 0.84]; if (F.saidI < 4 && u >= sayAt[F.saidI]) say(F.saidI++);
      if (u >= 1) toCard(); }
    else if (F.phase === 'card' && F.pt >= TL.card) toCredits(false);
    else if (F.phase === 'cred') { const h = VH(), k = clamp(F.pt / TL.cred, 0, 1); D.roll.style.transform = `translateY(${(h - (h + F.rollH) * k).toFixed(1)}px)`; if (F.pt >= TL.cred + 0.3) finish(); }
    // fireworks: steady in the dock scene, a barrage under the card, gentler under the credits
    fireT -= rdt; if (fireT <= 0) { const rate = F.phase === 'card' ? 0.22 : F.phase === 'cred' ? 1.1 : 0.55; fireT = rate * rnd(0.6, 1.4); launch(); if (F.phase !== 'cred' && Math.random() < 0.3) launch(); }
    FX.step(rdt, F.t);
    // flash: tints the water + lights the couple
    FL.k = Math.max(0, FL.k - rdt * 2.4); FLASH.color.copy(FL.col); FLASH.intensity = FL.k * 700;
    WATER.material.color.copy(WATER.userData.base).lerp(FL.col, Math.min(0.16, FL.k * 0.1)); HEMI.intensity = 0.75 + FL.k * 0.35;
    // the couple: watch -> cheer -> turn + hug
    const u = F.phase === 'dock' ? F.pt / TL.dock : 1, t = F.t;
    let ph, pm;
    if (u < 0.36) { ph = poseStand(t); pm = poseStand(t + 1); }
    else if (u < 0.6) { ph = poseCheerH(t); pm = poseCheerM(t); }
    else { const k = clamp((u - 0.6) / 0.08, 0, 1); ph = poseHug(t, 1); pm = poseHug(t + 0.4, -1);
      H.root.rotation.y = lerp(Math.PI, Math.PI / 2 + 0.05, k); M.root.rotation.y = lerp(Math.PI, -Math.PI / 2 - 0.05, k);
      H.root.position.x = lerp(-0.42, -0.26, k); M.root.position.x = lerp(0.42, 0.26, k);
      if (k >= 1 && !F.hugged) { F.hugged = true; F.log.push('hug'); for (let i = 0; i < 14; i++) FX.emit(rnd(-0.3, 0.3), deckY + 1.5 + rnd(0, 0.4), -1.2, rnd(-0.5, 0.5), rnd(0.6, 1.4), rnd(-0.3, 0.3), 1.4, 0.18, _tc.set('#ff6bb0'), 1, -0.3, 0); } }
    if (u < 0.6) { F.hugged = false; H.root.rotation.y = M.root.rotation.y = Math.PI; H.root.position.x = -0.42; M.root.position.x = 0.42; }
    if (u >= 0.36 && !F.cheered) { F.cheered = true; F.log.push('cheer'); } if (u < 0.36) F.cheered = false;
    applyPose(H, ph, 10, rdt); applyPose(M, pm, 10, rdt);
    shot(u); PU.uScale.value = LOW.h * 1.15;
    draw(SC, CAM2);
  } };

  // ================= DRONE: free-fly camera over the city =================
  const DR = { on: false, pos: new THREE.Vector3(), yaw: 0, pitch: -0.35, vel: new THREE.Vector3(), t: 0, bank: 0, auto: null, fogFar: 0 };
  function droneEnter(how) {
    if (DR.on || F.on || !save.drone || MODE.duel || FORT.on || DERBY.on || VIC.on || RB.mode || FMAP.F.open) return false;
    DR.on = true; DR.t = 0; DR.how = how; DR.yaw = CAM.yaw; DR.pitch = -0.32; DR.vel.set(0, 0, 0); DR.bank = 0;
    DR.pos.copy(camera.position); DR.pos.y = Math.max(DR.pos.y, hero.pos.y + 6);
    save.flights++; save.lastOn = true; persist(); F.log.push('drone:on:' + how);
    document.body.classList.add('drone'); layout(); MODE.duel = DRONE; labels({ a: 'DOWN', b: 'UP', c: 'LAND', l: '&#9664; TURN', r: 'TURN &#9654;' }); if (APANEL) APANEL.setAct({ kind: 'drone', label: 'LAND' }, 1);
    hero.vel.set(0, 0); KEYS.clear(); PRESS.clear(); IN.mx = IN.my = 0; return true;
  }
  function droneExit(how) {
    if (!DR.on) return; DR.on = false; DR.auto = null; MODE.duel = null; save.lastOn = false; persist(); F.log.push('drone:off:' + how);
    document.body.classList.remove('drone'); labels(null); if (APANEL) APANEL.setAct({ label: 'ACT', kind: 'reset' }, 1);
    camera.rotation.set(0, 0, 0); camera.fov = CAM.fov || 58; camera.updateProjectionMatrix(); snapCam(); IN.dragX = IN.dragY = 0; KEYS.clear(); PRESS.clear(); last = performance.now();
  }
  function droneToggle(how) { if (DR.on) droneExit(how); else droneEnter(how); }
  addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (e.repeat) return;
    if (k === 'v' && !F.on) { if (DR.on) droneExit('v'); else if (!CINE.intro) droneEnter('v'); }
    else if (k === 'escape' && DR.on) { e.preventDefault(); droneExit('esc'); } });
  // ACT = DRONE whenever nothing else wants ACT (no action in reach, no fight, not riding): an always-in-range entry that steps aside for every other action
  const DACT = { kind: 'drone', label: 'DRONE', r: 0.5, y: 2.2, get x() { return hero.pos.x; }, get z() { return hero.pos.z; },
    ok: () => { if (!save.drone || BOT || F.on || DR.on || hero.roof || inFight()) return false;
      for (const A of ACTIONS) { if (A === DACT) continue; let ok = false; try { ok = A.ok(); } catch (e) {} if (ok && Math.hypot(A.x - hero.pos.x, A.z - hero.pos.z) < A.r) return false; } return true; },
    go: () => droneEnter('act') };
  ACTIONS.push(DACT);
  const _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const DRONE = { frame(rdt) {
    DR.t += rdt; readInput();
    let mx = IN.mx, my = IN.my, up = 0, look = IN.look;
    if (KEYS.has(' ') || KEYS.has('k') || TOUCHS.btn.b) up += 1; if (KEYS.has('shift') || KEYS.has('j') || KEYS.has('c') || TOUCHS.btn.a) up -= 1;
    for (const gp of (navigator.getGamepads ? navigator.getGamepads() : [])) { if (!gp) continue; if (gp.buttons[0] && gp.buttons[0].pressed) up += 1; if ((gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[6] && gp.buttons[6].pressed)) up -= 1; }
    if (DR.auto) { const a = DR.auto; a.t += rdt; mx = 0.15; my = 1; up = a.t < 1.4 ? 1 : 0; look = 0.25; if (a.t >= a.dur) { const d = a.done; DR.auto = null; droneExit('auto'); d && d(); return; } }
    const exitP = PRESS.has('e') && DR.t > 0.3; PRESS.clear(); if (exitP) { droneExit('act'); return; }
    DR.yaw -= look * rdt * 1.8 + IN.dragX * 0.005; DR.pitch = clamp(DR.pitch - IN.dragY * 0.004 - IN.lookY * rdt * 1.2, -1.35, 0.5); IN.dragX = IN.dragY = 0;
    const sp = 24, fx = -Math.sin(DR.yaw), fz = -Math.cos(DR.yaw), rx = -fz, rz = fx;
    V.set(fx * my + rx * mx, up * 0.8, fz * my + rz * mx).multiplyScalar(sp);
    DR.vel.x = damp(DR.vel.x, V.x, 3, rdt); DR.vel.y = damp(DR.vel.y, V.y, 3, rdt); DR.vel.z = damp(DR.vel.z, V.z, 3, rdt);
    DR.pos.addScaledVector(DR.vel, rdt);
    DR.pos.x = clamp(DR.pos.x, WB.x0 - 30, WB.x1 + 40); DR.pos.z = clamp(DR.pos.z, WB.z0 - 30, WB.z1 + 30);
    const gy = groundY(clamp(DR.pos.x, WB.x0, WB.x1), clamp(DR.pos.z, WB.z0, WB.z1)); DR.pos.y = clamp(DR.pos.y, gy + 1.6, 110);
    DR.bank = damp(DR.bank, -mx * 0.18, 4, rdt);
    camera.position.copy(DR.pos); camera.position.y += Math.sin(DR.t * 2.1) * 0.06; _e.set(DR.pitch, DR.yaw, DR.bank); camera.quaternion.setFromEuler(_e);
    const a = VW() / VH(), fov = a < 0.75 ? 72 : 62; if (camera.fov !== fov || camera.aspect !== a) { camera.fov = fov; camera.aspect = a; camera.updateProjectionMatrix(); }
    window.__sky.position.copy(camera.position);
    updateCycle(rdt); scene.fog.near = Math.max(scene.fog.near, 60); scene.fog.far = Math.max(scene.fog.far, 230); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far;
    DR.fr = (DR.fr || 0) + rdt; if (DR.fr > 0.25) { DR.fr = 0; NIGHTFX.near(DR.pos.x, DR.pos.z); D.alt.textContent = 'ALT ' + Math.round(DR.pos.y - gy) + ' m · ' + (CITY.lmk ? CITY.lmk.name : nearLm()); }
    draw();
  } };
  function nearLm() { let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - DR.pos.x, L.z - DR.pos.z); if (d < bd) { bd = d; best = L; } } return best ? best.name : 'TOAD CITY'; }
  function autoDrone() { setTimeout(() => { F.log.push('drone:auto:start'); if (!droneEnter('auto')) { F.log.push('drone:auto:fail'); return; } DR.auto = { t: 0, dur: 3.5, done: () => F.log.push('drone:auto:done') }; }, 1500); }

  // ================= hooks: the brewmaster's finale event, test params, city chips =================
  addEventListener('tcb:finale', () => { F.pending = true; F.log.push('event'); });
  let n = 0;
  MODE.ticks.push(() => {
    n++;
    if (n === 3 && Q.has('finale') && !F.on && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; start('param'); return; }
    if (F.pending && !F.on && !DUELS.cur && !MODE.duel && !FORT.on) start('brewmaster');
    if (n % 30 === 0) chips();
  });
  window.__finale = { F, DR, start, finish, skip: tapSkip, drone: droneToggle, get save() { return save; }, get phase() { return F.phase; } };
})();

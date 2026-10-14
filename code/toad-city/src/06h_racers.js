
// ---------------- RACER BOSSES (DESIGN.md "More game-style fights"): Arabber Al's CHASE RACER (Fells Point) + the Dragon Boat Duchess's
// BOAT RAMMING RACE (the roaming water boss who ambushes the first boat ride), plus the harbour WATER TAXI / PADDLE BOAT rides she needs.
// Both fights run in their own little scene + camera (the city sim pauses, like the full map); Harold + Mavis's real rigs are lent to it.
//  - Al: a behind-the-car racer round a Fells Point cobblestone loop (rowhouse streets, narrow alleys, two water-taxi crossings where a
//    sliding water-taxi deck is the only way over). Al's souped-up horse-drawn produce cart flings watermelons / cabbages / tomato crates.
//    Ram him 3 times before the clock (90 s) runs out. Steer: stick / A-D / pad; BOOST: SWING or ACT (J / E / pad X,Y); HOP: JUMP (K / pad A).
//  - Duchess: a harbour arena in whatever boat you were riding. She stalks, swings her paddle-sceptre (tell: raised + glowing) and fires
//    splash waves (tell: the dragon head rears; HOP over them). Ram her so she is knocked INTO a pier or buoy: 3 crashes sink her. Lose the
//    hull = retry. Once she is beaten a saved flag (localStorage tcb_duchess_beaten) stops her coming back, and the boat ride carries on.
// Rig hooks: if a boss module defines buildArabberAl() / buildDragonBoatDuchess(), its rig replaces the stand-in rider. Contract: returns a
// THREE.Object3D or { root } (optional .update(dt, st) with st = { t, state, throwK|swingK|rearK }); feet at y = 0, facing +z, ~1.8 m tall.
// Entry: ACT "CHASE" at Al's parked cart (Fells Point boss anchor); BOARD at a water-taxi stop or the Harborplace paddle boats.
// Tests: ?rb=al | duchess | duchess-paddle | ride (jump in), ?rbauto=win|lose (scripted pilot), ?rbtime=N (Al's clock), ?rbfresh=1 (ignore saves).
// polish (hark/polish): the Duchess fight runs on the DUELS core via src/09bd_duchess.js (?duchess=1[&duchessauto=win|lose|mash], paddle: ?duchess=paddle).
const RB = { mode: null, t: 0, calls: 0, maxCalls: 0, auto: Q.get('rbauto') || null, log: [], freeze: false };
window.__rb = RB;
const RB_LS = 'tcb_duchess_beaten';
if (Q.has('rbfresh')) { try { localStorage.removeItem(RB_LS); localStorage.removeItem('tcb_boss_clear'); } catch (e) {} BOSS_CLEAR.cleared.clear(); for (const L of LANDMARKS) if (L.boss) L.boss.cleared = false; }
const rbDuchessBeaten = () => { try { return localStorage.getItem(RB_LS) === '1'; } catch (e) { return !!RB.duchessBeaten; } };
const rbLines = (id) => GR1.bosses[id] || {};
const rbPick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
const rbLog = (s) => { RB.log.push(+(RB.t).toFixed(2) + ' ' + s); if (RB.log.length > 80) RB.log.shift(); };

// ---------------- HUD (DOM over the game view) ----------------
const RBH = (function () {
  const st = document.createElement('style');
  st.textContent = `
  body.rbmode #hpbox, body.rbmode #p2, body.rbmode #mmap, body.rbmode #lmk, body.rbmode #combo, body.rbmode #prompt, body.rbmode #hint, body.rbmode #ko, body.rbmode #lbT, body.rbmode #lbB, body.rbmode #banner, body.rbmode #clock, body.rbmode #proto, body.rbmode #qbtn, body.rbmode .rbhide { display: none !important; }
  #rbhud { display: none; overflow: hidden; z-index: 25; font-family: 'PX', 'Courier New', monospace; }
  #rbhud.on { display: block; }
  #rbhud .rbtop { position: absolute; left: 8px; right: 8px; top: 8px; display: flex; align-items: center; gap: 8px; text-shadow: 2px 2px 0 #000; }
  body.radio #rbhud .rbtop { top: 40px; }
  #rbhud .rbname { font-size: 11px; color: #ffd23c; white-space: nowrap; }
  #rbhud .rbpips { display: flex; gap: 4px; }
  #rbhud .rbpips i { width: 14px; height: 14px; border: 2px solid #14101f; background: #3a3a48; transform: rotate(45deg); box-shadow: 1px 1px 0 #000; }
  #rbhud .rbpips i.on { background: #ff3d6e; }
  #rbhud .rbclock { margin-left: auto; font-size: 18px; color: #fff; }
  #rbhud .rbclock.low { color: #ff5f5f; }
  #rbhud .rbbar { position: absolute; left: 8px; top: 34px; width: 132px; height: 9px; border: 2px solid #14101f; background: #2a2a34; }
  body.radio #rbhud .rbbar { top: 66px; }
  #rbhud .rbbar i { display: block; height: 100%; width: 50%; background: #7dffc0; }
  #rbhud .rbbar b { position: absolute; left: 0; top: 12px; font-size: 7px; font-weight: normal; color: #cfe; text-shadow: 1px 1px 0 #000; white-space: nowrap; }
  #rbhud .rbsay { position: absolute; left: 50%; top: 22%; transform: translateX(-50%) scale(.9); max-width: 86%; background: #fff; color: #14101f; border: 3px solid #14101f;
    border-radius: 14px; padding: 8px 12px; font: 700 14px/1.25 system-ui, -apple-system, sans-serif; opacity: 0; transition: opacity .2s, transform .2s; text-align: center; }
  #rbhud .rbsay.on { opacity: 1; transform: translateX(-50%) scale(1); }
  #rbhud .rbsay b { display: block; font: 9px 'PX', monospace; color: #c02a5a; margin-bottom: 4px; }
  #rbhud .rbbig { position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%); font-size: 34px; color: #ffd23c; text-shadow: 3px 3px 0 #a02a2a, 6px 6px 0 #000; white-space: nowrap; opacity: 0; transition: opacity .15s; }
  #rbhud .rbbig.on { opacity: 1; }
  #rbhud .rbhint { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); font-size: 8px; color: #fff; text-shadow: 1px 1px 0 #000; white-space: nowrap; opacity: .9; }
  #rbhud .rbretry { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(10,8,20,.62); pointer-events: auto; }
  #rbhud .rbretry.on { display: flex; }
  #rbhud .rbretry .rbrt { font-size: 22px; color: #ff5fa2; text-shadow: 3px 3px 0 #000; text-align: center; line-height: 1.4; padding: 0 10px; }
  #rbhud .rbretry button { font: 14px 'PX', monospace; color: #14101f; background: #ffd23c; border: 3px solid #14101f; box-shadow: 4px 4px 0 #000; padding: 12px 18px; min-width: 200px; }
  #rbhud .rbretry button.q { background: #cfd3e0; font-size: 11px; }
  #rbhud .rbretry small { font-size: 7px; color: #ccd; }
  @media (max-width: 480px) { #rbhud .rbbig { font-size: 22px; } #rbhud .rbclock { font-size: 15px; } #rbhud .rbname { font-size: 9px; } #rbhud .rbsay { font-size: 12px; } }`;
  document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'rbhud'; el.className = 'ui';
  el.innerHTML = '<div class="rbtop"><b class="rbname"></b><span class="rbpips"><i></i><i></i><i></i></span><span class="rbclock"></span></div>' +
    '<div class="rbbar"><i></i><b></b></div><div class="rbsay"><b></b><span></span></div><div class="rbbig"></div><div class="rbhint"></div>' +
    '<div class="rbretry"><div class="rbrt"></div><button class="r">TRY AGAIN</button><button class="q">QUIT</button><small></small></div>';
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const H = { el, name: q('.rbname'), pips: [...el.querySelectorAll('.rbpips i')], clock: q('.rbclock'), bar: q('.rbbar i'), barL: q('.rbbar b'), say: q('.rbsay'), sayB: q('.rbsay b'), sayT: q('.rbsay span'),
    big: q('.rbbig'), hint: q('.rbhint'), retry: q('.rbretry'), rt: q('.rbrt'), rtS: q('.rbretry small'), sayLeft: 0, bigLeft: 0, choice: null, cur: {} };
  q('.rbretry .r').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); H.choice = 'retry'; });
  q('.rbretry .q').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); H.choice = 'quit'; });
  const set = (k, node, v, prop = 'textContent') => { if (H.cur[k] !== v) { H.cur[k] = v; node[prop] = v; } };
  H.place = () => { const r = canvas.getBoundingClientRect(); Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); };
  H.show = (name, hint) => { H.place(); el.classList.add('on'); set('name', H.name, name); set('hint', H.hint, hint); H.retry.classList.remove('on'); H.choice = null; H.say.classList.remove('on'); H.big.classList.remove('on'); };
  H.hide = () => { el.classList.remove('on'); H.say.classList.remove('on'); H.big.classList.remove('on'); H.retry.classList.remove('on'); };
  H.pips = H.pips; H.setPips = (n) => H.pips.forEach((p, i) => p.classList.toggle('on', i < n));
  H.setClock = (s) => { set('clock', H.clock, s); };
  H.clockLow = (on) => H.clock.classList.toggle('low', !!on);
  H.setBar = (f, col, label) => { const w = Math.round(clamp(f, 0, 1) * 100) + '%'; if (H.cur.bw !== w) { H.cur.bw = w; H.bar.style.width = w; } if (H.cur.bc !== col) { H.cur.bc = col; H.bar.style.background = col; } set('bl', H.barL, label); };
  H.speak = (who, line, t = 3.4) => { if (!line) return; H.sayB.textContent = who; H.sayT.textContent = line; H.say.classList.add('on'); H.sayLeft = t; rbLog('say ' + who + ': ' + line); };
  H.shout = (txt, t = 1.1, col = '#ffd23c') => { H.big.textContent = txt; H.big.style.color = col; H.big.classList.add('on'); H.bigLeft = t; };
  H.setHint = (s) => set('hint', H.hint, s);
  H.showRetry = (title) => { H.rt.innerHTML = title; H.rtS.textContent = DEV === 'pad' ? 'A / X: TRY AGAIN    Y: QUIT' : DEV === 'touch' ? 'tap a button (SWING = try again, ACT = quit)' : 'J / K / ENTER: TRY AGAIN    E / ESC: QUIT'; H.retry.classList.add('on'); H.choice = null; };
  H.tick = (dt) => { if (H.sayLeft > 0 && (H.sayLeft -= dt) <= 0) H.say.classList.remove('on'); if (H.bigLeft > 0 && (H.bigLeft -= dt) <= 0) H.big.classList.remove('on'); };
  addEventListener('resize', () => { if (el.classList.contains('on')) H.place(); });
  return H;
})();

// ---------------- shared bits: merged stand-in rigs, a spray particle pool, mode enter / leave ----------------
function rgrp(parent, x = 0, y = 0, z = 0) { const g = grp(parent, x, y, z); let p = parent; while (p && !p.userData.mat) p = p.parent; g.userData.mat = p && p.userData.mat; return g; } // a bone group that keeps the rig's material
function rbRig(build, R = 4, cy = 1) { // parts on a root (+ sub-groups as bones) -> mergeRig: ~2 draw calls per material
  const root = new THREE.Group(); root.userData.mat = toonMat(); const J = { root };
  build(root, J); mergeRig(J);
  for (const m of J.merged || []) { m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, cy, 0), R); m.castShadow = false; }
  return J;
}
const RB_GLOW = basicSnap({ color: '#fff4c0' });
const RB_GLOWR = basicSnap({ color: '#ff8a3a' });
const RB_BLUE = basicSnap({ color: '#7de8ff' });
function rbHook(fnName, get) { // an external boss rig, when a boss module provides one (get: () => the builder or null; module scope, so no window lookup needed)
  let f = null; try { f = get(); } catch (e) { f = null; }
  if (!f && typeof window[fnName] === 'function') f = window[fnName];
  if (!f) return null;
  try { const r = f(); const obj = r && (r.isObject3D ? r : r.root || r.group); if (!obj) return null; RB.hooks = (RB.hooks || []).concat(fnName); return { obj, upd: r.update ? r.update.bind(r) : null }; } catch (e) { console.warn('[rb] ' + fnName + ' failed', e); return null; }
}
function rbSpray(sc, n = 96) { // one Points draw call: produce splats, sparks, water spray
  const t = canvasTex(32, 32, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16, 14, 0, TAU); c.fill(); }, 32);
  const g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), C = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.42, map: t, alphaTest: 0.5, vertexColors: true, sizeAttenuation: true, fog: true }));
  pts.frustumCulled = false; sc.add(pts);
  const A = []; for (let i = 0; i < n; i++) { A.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 }); P[i * 3 + 1] = -99; }
  let k = 0; const _c = new THREE.Color();
  return {
    burst(x, y, z, col, cnt = 12, sp = 5, up = 5) { _c.set(col); for (let j = 0; j < cnt; j++) { const p = A[k]; const i = k; k = (k + 1) % n; const a = Math.random() * TAU, s = sp * (0.4 + Math.random() * 0.6);
      Object.assign(p, { life: 0.5 + Math.random() * 0.5, x, y, z, vx: Math.cos(a) * s, vy: up * (0.5 + Math.random() * 0.8), vz: Math.sin(a) * s }); C[i * 3] = _c.r; C[i * 3 + 1] = _c.g; C[i * 3 + 2] = _c.b; } g.attributes.color.needsUpdate = true; },
    tick(dt, floor = 0) { for (let i = 0; i < n; i++) { const p = A[i]; if (p.life <= 0) { P[i * 3 + 1] = -99; continue; } p.life -= dt; p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < floor) { p.y = floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      P[i * 3] = p.x; P[i * 3 + 1] = p.life > 0 ? p.y : -99; P[i * 3 + 2] = p.z; } g.attributes.position.needsUpdate = true; },
    clear() { for (const p of A) p.life = 0; },
  };
}
function rbScene(fogC, near, far, sky, ground, sunC, sunI, dir) {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(fogC); sc.fog = new THREE.Fog(fogC, near, far);
  sc.add(new THREE.HemisphereLight(sky, ground, 1.35)); const d = new THREE.DirectionalLight(sunC, sunI); d.position.set(dir[0], dir[1], dir[2]); sc.add(d, d.target);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.15, far + 40); return { sc, cam };
}
// seated pose (driving / riding): thighs forward, shins down, hands forward on the wheel (or in the lap for Mavis)
function rbSeatPose(wheel, t = 0, bump = 0) {
  const p = blank(); p.lgL = [-1.45, 0, 0.12]; p.lgR = [-1.45, 0, -0.12]; p.knL = p.knR = [1.45, 0, 0];
  p.torso = [0.05 + bump * 0.1, 0, 0]; p.neck = [-0.05, Math.sin(t * 0.7) * 0.15, 0];
  if (wheel) { p.shL = [-1.05, 0, 0.25]; p.shR = [-1.05, 0, -0.25]; p.elL = p.elR = [-0.55, 0, 0]; }
  else { p.shL = [-0.35, 0, 0.3]; p.shR = [-0.35, 0, -0.3]; p.elL = p.elR = [-1.0, 0, 0]; }
  p.swL = p.swR = [Math.PI / 2 + 0.9, 0, 0]; return p;
}
function rbSwingPose(u) { // Mavis's handbag swing from the seat (a ram / a hit)
  const p = rbSeatPose(false); const a = Math.sin(clamp(u, 0, 1) * Math.PI);
  p.shR = [-2.6 * a - 0.3, 0, -0.9 * a]; p.elR = [-0.3, 0, 0]; p.torso = [0, -0.6 * a, 0]; return p;
}
const RBM = { saved: null };
function rbLend(parentL, posL, parentR, posR) { // put Harold (driver) + Mavis on a vehicle rig
  hero.root.position.set(posL[0], posL[1], posL[2]); hero.root.rotation.set(0, posL[3] || 0, 0); parentL.add(hero.root);
  partner.root.position.set(posR[0], posR[1], posR[2]); partner.root.rotation.set(0, posR[3] || 0, 0); parentR.add(partner.root);
  hero.root.visible = partner.root.visible = true;
}
function rbReturnRigs() { scene.add(hero.root); scene.add(partner.root); hero.root.rotation.set(0, hero.yaw, 0); partner.root.rotation.set(0, partner.yaw, 0); }
function rbEnterFight(name, hint) {
  document.body.classList.add('rbmode'); try { BARK.hide(); BARK.lmBlurb(null); BARK.lb.classList.add('rbhide'); BARK.el.classList.add('rbhide'); } catch (e) {}
  try { if (window.__radio && __radio.duckTo) __radio.duckTo(0.2); } catch (e) {}
  RBH.show(name, hint); RB.fightOn = true;
}
function rbLeaveFight() {
  document.body.classList.remove('rbmode'); RBH.hide(); RB.fightOn = false; try { BARK.lb.classList.remove('rbhide'); BARK.el.classList.remove('rbhide'); } catch (e) {}
  try { if (window.__radio && __radio.duckTo) __radio.duckTo(1); } catch (e) {}
}
function rbDraw(sc, cam) { // render one of the boss scenes, counting its draw calls
  cam.aspect = camera.aspect; cam.updateProjectionMatrix();
  OUT_U.fogC.value.copy(sc.fog.color); OUT_U.fogN.value = sc.fog.near; OUT_U.fogF.value = sc.fog.far;
  const I = renderer.info; I.autoReset = false; I.reset(); renderer.setRenderTarget(RT); renderer.render(sc, cam); RB.calls = I.render.calls; RB.tris = I.render.triangles;
  RB.maxCalls = Math.max(RB.maxCalls, RB.calls); I.autoReset = true; renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
const rbPortrait = () => VH() > VW() * 1.15;
// input helpers for the fights (keyboard / touch panel / gamepad all funnel into IN + PRESS)
const rbBoost = () => PRESS.has('j') || PRESS.has('e') || PRESS.has('shift');
const rbHop = () => PRESS.has('k') || PRESS.has(' ');
function rbRetryInput() {
  if (RBH.choice) { const c = RBH.choice; RBH.choice = null; return c; }
  if (PRESS.has('j') || PRESS.has('k') || PRESS.has('enter') || PRESS.has(' ')) return 'retry';
  if (PRESS.has('e') || PRESS.has('escape')) return 'quit';
  return null;
}

// ---------------- stand-in rigs ----------------
// Harold's car: an old two-tone convertible land-yacht (original), open top so the toads show
function rbBuildCar() {
  return rbRig((r, J) => {
    const B = '#2f8f8a', B2 = '#e8e0c8';
    part(r, G.box(2.0, 0.5, 4.7), B, 0, 0.62, 0); part(r, G.box(1.96, 0.26, 1.55), B, 0, 1.0, 1.5); part(r, G.box(1.96, 0.26, 1.25), B, 0, 1.0, -1.65);
    for (const s of [-1, 1]) { part(r, G.box(0.14, 0.34, 2.0), B, s * 0.93, 1.04, -0.2); part(r, G.box(0.06, 0.08, 4.6), B2, s * 1.01, 0.82, 0, { outline: false }); }
    part(r, G.box(2.12, 0.18, 0.22), '#dcdce6', 0, 0.48, 2.42); part(r, G.box(2.12, 0.18, 0.22), '#dcdce6', 0, 0.48, -2.42);
    part(r, G.box(1.84, 0.06, 0.06), '#dcdce6', 0, 1.62, 0.7, { outline: false }); for (const s of [-1, 1]) part(r, G.box(0.06, 0.5, 0.06), '#dcdce6', s * 0.9, 1.38, 0.7, { outline: false });
    part(r, G.box(1.76, 0.44, 0.04), '#9fd4e6', 0, 1.36, 0.7, { outline: false });
    part(r, G.box(1.8, 0.55, 0.32), '#8a2a2a', 0, 1.0, -0.95); part(r, G.box(1.8, 0.16, 0.9), '#8a2a2a', 0, 0.82, -0.6, { outline: false });
    part(r, G.cyl(0.2, 0.2, 0.04, 10), '#222', -0.45, 1.25, 0.32, { rot: [1.1, 0, 0], outline: false });
    for (const s of [-1, 1]) { part(r, G.sph(0.16, 0.16, 0.08), '#fff', s * 0.72, 0.84, 2.34, { mat: RB_GLOW, outline: false }); part(r, G.box(0.28, 0.12, 0.05), '#ff3d6e', s * 0.72, 0.84, -2.34, { mat: RB_GLOWR, outline: false }); }
    part(r, G.box(2.3, 0.02, 4.9), '#1c1a18', 0, 0.03, 0, { outline: false });
    J.wheels = [];
    for (const [wx, wz] of [[-0.98, 1.45], [0.98, 1.45], [-0.98, -1.45], [0.98, -1.45]]) { const w = rgrp(r, wx, 0.4, wz); part(w, G.cyl(0.4, 0.4, 0.3, 10), '#1a1a1a', 0, 0, 0, { rot: [0, 0, Math.PI / 2] });
      part(w, G.cyl(0.25, 0.25, 0.32, 8), '#f0f0f0', 0, 0, 0, { rot: [0, 0, Math.PI / 2], outline: false }); part(w, G.box(0.33, 0.08, 0.36), '#888', 0, 0, 0, { outline: false }); J.wheels.push(w); }
  }, 3.6, 0.8);
}
// Al's souped-up produce cart: a painted arabber wagon (scalloped canopy, bells, produce stacked high) behind a plumed horse,
// hot-rodded with chrome side pipes + flame jets, a rear spoiler, big rear wheels and an under-glow. All original.
function rbBuildAlCart(withAl = true) {
  return rbRig((r, J) => {
    // wagon
    part(r, G.box(1.9, 0.5, 2.8), '#e8432f', 0, 0.95, -0.6); part(r, G.box(2.0, 0.12, 2.9), '#ffd23c', 0, 1.24, -0.6);
    for (const s of [-1, 1]) { part(r, G.box(0.08, 0.36, 2.7), '#2a8a4a', s * 0.98, 0.95, -0.6, { outline: false }); part(r, G.box(0.06, 0.06, 2.6), '#ffd23c', s * 1.0, 0.86, -0.6, { outline: false }); }
    for (const [x, z] of [[-0.85, 0.75], [0.85, 0.75], [-0.85, -1.95], [0.85, -1.95]]) part(r, G.cyl(0.05, 0.05, 1.5, 6), '#ffd23c', x, 1.95, z);
    part(r, G.box(2.15, 0.12, 3.1), '#2a7ac8', 0, 2.74, -0.6); part(r, G.box(2.0, 0.16, 2.9), '#ff3d6e', 0, 2.86, -0.6);
    for (let k = 0; k < 7; k++) for (const s of [-1, 1]) part(r, G.sph(0.17, 0.12, 0.17), k % 2 ? '#ffd23c' : '#ffffff', s * 1.06, 2.62, -1.95 + k * 0.45, { outline: false });
    // produce pile
    const PC = ['#3a8a2a', '#e83a2a', '#ffb02a', '#9ad040', '#ff7a1a', '#6a3a8a'];
    for (let k = 0; k < 16; k++) part(r, G.sph(0.22, 0.2, 0.22, 7, 5), PC[k % PC.length], ((k * 37) % 9 - 4) * 0.19, 1.42 + (k % 3) * 0.16, -1.6 + (k % 6) * 0.38, { outline: k % 3 === 0 });
    part(r, G.sph(0.42, 0.32, 0.32), '#2f7a2a', 0.35, 1.62, -0.2); part(r, G.box(0.6, 0.45, 0.6), '#a07a4a', -0.5, 1.5, -1.75);
    // spoiler + pipes + flames + glow
    part(r, G.box(2.3, 0.08, 0.5), '#14101f', 0, 2.0, -2.25); for (const s of [-1, 1]) part(r, G.box(0.08, 0.6, 0.12), '#14101f', s * 0.9, 1.7, -2.15);
    for (const s of [-1, 1]) { part(r, G.cyl(0.09, 0.09, 2.2, 8), '#e0e0ea', s * 1.12, 0.62, -0.7, { rot: [Math.PI / 2, 0, 0] }); part(r, G.cyl(0.04, 0.16, 0.5, 6), '#ff8a3a', s * 1.12, 0.62, -2.05, { rot: [-Math.PI / 2, 0, 0], mat: RB_GLOWR, outline: false }); }
    part(r, G.box(1.7, 0.03, 2.4), '#7de8ff', 0, 0.12, -0.6, { mat: RB_BLUE, outline: false });
    part(r, G.box(2.4, 0.02, 6.2), '#1c1a18', 0, 0.03, 0.6, { outline: false });
    // bells on a bar
    part(r, G.box(1.9, 0.05, 0.05), '#ffd23c', 0, 2.4, 0.95, { outline: false }); for (let k = 0; k < 5; k++) part(r, G.sph(0.08, 0.1, 0.08), '#ffd23c', -0.8 + k * 0.4, 2.3, 0.95, { outline: false });
    // shafts to the horse
    for (const s of [-1, 1]) part(r, G.box(0.08, 0.08, 2.2), '#8a5a2a', s * 0.55, 1.05, 1.9, { outline: false });
    J.wheels = [];
    for (const s of [-1, 1]) { const w = rgrp(r, s * 1.12, 0.62, -1.1); part(w, G.tor(0.56, 0.07), '#ffd23c', 0, 0, 0, { rot: [0, Math.PI / 2, 0] }); part(w, G.cyl(0.6, 0.6, 0.2, 12), '#1a1a1a', 0, 0, 0, { rot: [0, 0, Math.PI / 2] });
      for (let k = 0; k < 3; k++) part(w, G.box(0.04, 1.05, 0.06), '#e8432f', s * 0.12, 0, 0, { rot: [k * Math.PI / 3, 0, 0], outline: false }); J.wheels.push(w); }
    { const w = rgrp(r, 0, 0.36, 0.3); part(w, G.cyl(0.34, 0.34, 1.9, 10), '#1a1a1a', 0, 0, 0, { rot: [0, 0, Math.PI / 2] }); J.wheels.push(w); }
    // the horse (plumed, white blaze, racing blanket)
    const H = J.horse = rgrp(r, 0, 0, 3.0);
    part(H, G.cap(0.42, 1.25, 8), '#8a5232', 0, 1.42, 0, { rot: [Math.PI / 2, 0, 0] }); part(H, G.box(0.9, 0.08, 1.1), '#ff3d6e', 0, 1.86, 0, { outline: false });
    part(H, G.box(0.92, 0.1, 0.1), '#ffd23c', 0, 1.88, 0.5, { outline: false });
    const N = J.hneck = rgrp(H, 0, 1.6, 0.85); part(N, G.cap(0.2, 0.55, 6), '#8a5232', 0, 0.3, 0.12, { rot: [0.55, 0, 0] });
    part(N, G.box(0.3, 0.3, 0.7), '#8a5232', 0, 0.62, 0.48); part(N, G.box(0.1, 0.22, 0.4), '#ffffff', 0, 0.68, 0.62, { outline: false });
    for (const s of [-1, 1]) part(N, G.box(0.06, 0.18, 0.06), '#5a3220', s * 0.1, 0.86, 0.3, { outline: false });
    part(N, G.box(0.08, 0.5, 0.42), '#2a1a12', 0, 0.55, 0.02); part(N, G.sph(0.12, 0.3, 0.12), '#ff3d6e', 0, 1.02, 0.18, { outline: false });
    part(N, G.box(0.34, 0.08, 0.14), '#14101f', 0, 0.72, 0.4, { outline: false });
    J.legs = [];
    for (const [x, z] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.55], [0.24, -0.55]]) { const L = rgrp(H, x, 1.25, z); part(L, G.cyl(0.08, 0.06, 1.1, 6), '#8a5232', 0, -0.55, 0); part(L, G.box(0.14, 0.12, 0.16), '#2a1a12', 0, -1.15, 0.02, { outline: false }); J.legs.push(L); }
    const T = J.tail = rgrp(H, 0, 1.55, -0.85); part(T, G.cap(0.08, 0.5, 5), '#2a1a12', 0, -0.25, -0.12, { rot: [0.4, 0, 0] });
    if (withAl) { // Al (stand-in): a big toad arabber in a straw boater, red shirt, apron, mustache; throwing arm is a bone
      const A = J.al = rgrp(r, 0, 1.25, 0.55);
      part(A, G.sph(0.36, 0.42, 0.32), '#c83a2a', 0, 0.42, 0); part(A, G.box(0.56, 0.5, 0.06), '#f0ead8', 0, 0.36, 0.3, { outline: false });
      part(A, G.sph(0.3, 0.26, 0.28), '#6f8a3a', 0, 0.98, 0.04); part(A, G.box(0.36, 0.06, 0.1), '#2a1a12', 0, 0.9, 0.3, { outline: false });
      for (const s of [-1, 1]) part(A, G.sph(0.07, 0.07, 0.05), '#fff', s * 0.12, 1.06, 0.27, { outline: false });
      part(A, G.cyl(0.42, 0.42, 0.05, 12), '#e8d080', 0, 1.2, 0.02); part(A, G.cyl(0.24, 0.26, 0.2, 10), '#e8d080', 0, 1.3, 0.02); part(A, G.cyl(0.25, 0.25, 0.06, 10), '#c83a2a', 0, 1.25, 0.02, { outline: false });
      const AR = J.alArm = rgrp(A, 0.36, 0.62, 0); part(AR, G.cap(0.08, 0.42, 5), '#c83a2a', 0, -0.24, 0); part(AR, G.sph(0.1, 0.1, 0.1), '#6f8a3a', 0, -0.52, 0);
      const AL = J.alArmL = rgrp(A, -0.36, 0.62, 0); part(AL, G.cap(0.08, 0.42, 5), '#c83a2a', 0, -0.24, 0, { rot: [0, 0, 0] });
    }
  }, 5.5, 1.2);
}
// the souped-up cart's rider: a boss module's rig if there is one
function rbAlRider(J) {
  const h = rbHook('buildArabberAl', () => (typeof buildArabberAl === 'function' ? buildArabberAl : null)); if (!h) return null;
  if (J.al) J.al.visible = false; h.obj.position.set(0, 1.25, 0.55); J.root.add(h.obj); return h;
}
// water taxi (white hull, blue stripe + canopy: an original livery) and a two-seat paddle boat
function rbBuildTaxi() {
  return rbRig((r, J) => {
    part(r, G.box(2.5, 0.9, 6.2), '#f4f4f0', 0, 0.35, 0); part(r, G.box(2.0, 0.9, 1.2), '#f4f4f0', 0, 0.35, 3.4, { rot: [0, Math.PI / 4, 0] });
    part(r, G.box(2.56, 0.18, 6.3), '#2a6ac8', 0, 0.55, 0, { outline: false }); part(r, G.box(2.3, 0.08, 6.0), '#c8a070', 0, 0.82, 0, { outline: false });
    for (const [x, z] of [[-1.1, 1.6], [1.1, 1.6], [-1.1, -2.4], [1.1, -2.4]]) part(r, G.cyl(0.05, 0.05, 1.6, 6), '#e8e8f0', x, 1.62, z, { outline: false });
    part(r, G.box(2.6, 0.12, 4.4), '#2a6ac8', 0, 2.44, -0.4); part(r, G.box(2.7, 0.24, 0.1), '#ffd23c', 0, 2.3, 1.8, { outline: false });
    part(r, G.box(2.0, 0.4, 0.4), '#2a4a8a', 0, 1.05, -1.6); part(r, G.box(2.0, 0.4, 0.4), '#2a4a8a', 0, 1.05, 0.2);
    part(r, G.box(0.5, 0.7, 0.5), '#e8e8f0', 0, 1.15, 2.4); part(r, G.cyl(0.2, 0.2, 0.04, 8), '#222', 0, 1.55, 2.25, { rot: [1.0, 0, 0], outline: false });
    for (const s of [-1, 1]) part(r, G.cyl(0.18, 0.18, 0.7, 8), '#ff8a3a', s * 1.28, 0.6, -0.4, { rot: [Math.PI / 2, 0, 0], outline: false });
  }, 4.5, 1);
}
function rbBuildPaddle() {
  return rbRig((r, J) => {
    part(r, G.box(1.9, 0.6, 2.8), '#f4f4f0', 0, 0.25, 0); part(r, G.sph(0.95, 0.3, 0.9), '#f4f4f0', 0, 0.25, 1.4, { outline: false });
    part(r, G.box(1.96, 0.14, 2.86), '#3a9ad8', 0, 0.48, 0, { outline: false });
    for (const [x, z] of [[-0.85, 0.7], [0.85, 0.7], [-0.85, -1.2], [0.85, -1.2]]) part(r, G.cyl(0.04, 0.04, 1.3, 6), '#e8e8f0', x, 1.2, z, { outline: false });
    part(r, G.box(2.0, 0.1, 2.3), '#ffd23c', 0, 1.88, -0.25); part(r, G.box(1.7, 0.36, 0.4), '#3a9ad8', 0, 0.75, -0.7);
    J.wheel = rgrp(r, 0, 0.45, -1.55); for (let k = 0; k < 4; k++) part(J.wheel, G.box(1.2, 0.08, 0.7), '#ff8a3a', 0, 0, 0, { rot: [k * Math.PI / 4, 0, 0], outline: false });
  }, 3, 0.8);
}
// the Duchess's giant dragon paddle boat: scaled red/gold hull, rearing dragon head on a long neck (a bone), curled tail, two paddle
// wheels, a throne dais; the Duchess (stand-in): a grand toad in a purple gown, ermine cape and tiara with a crowned paddle-sceptre (arm bone)
function rbBuildDuchessBoat(withRider = true) {
  return rbRig((r, J) => {
    part(r, G.box(3.6, 1.1, 8.0), '#b8282a', 0, 0.35, 0); part(r, G.box(3.0, 1.0, 1.8), '#b8282a', 0, 0.35, 4.3, { rot: [0, Math.PI / 4, 0] });
    part(r, G.box(3.66, 0.2, 8.1), '#ffc83a', 0, 0.82, 0, { outline: false });
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) part(r, G.sph(0.32, 0.26, 0.4), '#2a8a5a', s * 1.82, 0.42, -3.2 + k * 1.25, { outline: false });
    part(r, G.box(3.2, 0.1, 7.6), '#7a3a2a', 0, 0.92, 0, { outline: false });
    const N = J.neck = rgrp(r, 0, 1.0, 4.2);
    part(N, G.cap(0.42, 1.6, 8), '#b8282a', 0, 1.0, 0.5, { rot: [0.45, 0, 0] }); for (let k = 0; k < 4; k++) part(N, G.box(0.12, 0.34, 0.3), '#ffc83a', 0, 0.55 + k * 0.42, 0.1 + k * 0.22, { rot: [0.45, 0, 0], outline: false });
    const HD = J.head = rgrp(N, 0, 2.05, 1.1);
    part(HD, G.box(0.95, 0.75, 1.3), '#c8302a', 0, 0, 0.35); part(HD, G.box(0.85, 0.3, 0.9), '#c8302a', 0, -0.38, 0.75); part(HD, G.box(0.8, 0.12, 0.8), '#fff4e0', 0, -0.2, 0.85, { outline: false });
    for (const s of [-1, 1]) { part(HD, G.sph(0.17, 0.17, 0.12), '#ffd23c', s * 0.42, 0.18, 0.62, { mat: RB_GLOW, outline: false }); part(HD, G.cyl(0.02, 0.12, 0.7, 6), '#ffc83a', s * 0.3, 0.62, -0.1, { rot: [-0.6, 0, s * 0.3] });
      part(HD, G.box(0.05, 0.45, 0.4), '#2a8a5a', s * 0.52, 0.05, -0.15, { rot: [0, 0, s * 0.5], outline: false }); }
    const T = J.tail = rgrp(r, 0, 1.0, -4.0); part(T, G.cap(0.32, 1.1, 6), '#b8282a', 0, 0.6, -0.5, { rot: [-0.7, 0, 0] }); part(T, G.cone ? G.cone(0.3, 0.6) : G.cyl(0.0, 0.34, 0.7, 6), '#ffc83a', 0, 1.25, -1.0, { rot: [-0.7, 0, 0] });
    J.wheels = [];
    for (const s of [-1, 1]) { const w = rgrp(r, s * 2.0, 0.75, -1.0); part(w, G.cyl(1.05, 1.05, 0.5, 12), '#ffc83a', 0, 0, 0, { rot: [0, 0, Math.PI / 2] });
      for (let k = 0; k < 4; k++) part(w, G.box(0.55, 2.2, 0.22), '#7a1a1a', s * 0.02, 0, 0, { rot: [k * Math.PI / 4, 0, 0], outline: false }); J.wheels.push(w); }
    part(r, G.box(1.6, 0.5, 1.6), '#ffc83a', 0, 1.15, -1.6); part(r, G.box(1.3, 1.2, 0.25), '#6a2a8a', 0, 1.9, -2.3);
    part(r, G.box(4.0, 0.02, 9.0), '#14303f', 0, 0.02, 0, { outline: false });
    if (withRider) {
      const D = J.duch = rgrp(r, 0, 1.4, -1.5);
      part(D, G.cyl(0.32, 0.72, 1.0, 10), '#7a3aa8', 0, 0.5, 0); part(D, G.sph(0.36, 0.34, 0.3), '#7a3aa8', 0, 1.05, 0);
      part(D, G.box(0.9, 1.05, 0.08), '#f4f0f0', 0, 0.7, -0.32, { outline: false }); for (let k = 0; k < 5; k++) part(D, G.box(0.06, 0.1, 0.02), '#14101f', -0.32 + k * 0.16, 0.5 + (k % 2) * 0.3, -0.37, { outline: false });
      part(D, G.sph(0.34, 0.3, 0.32), '#7f9a3e', 0, 1.58, 0.03); part(D, G.box(0.42, 0.05, 0.1), '#c02a5a', 0, 1.47, 0.3, { outline: false });
      for (const s of [-1, 1]) { part(D, G.sph(0.09, 0.09, 0.06), '#fff', s * 0.13, 1.68, 0.27, { outline: false }); part(D, G.sph(0.04, 0.04, 0.03), '#14101f', s * 0.13, 1.68, 0.32, { outline: false }); }
      part(D, G.cyl(0.24, 0.28, 0.16, 10), '#ffd23c', 0, 1.9, 0.02); for (let k = 0; k < 5; k++) part(D, G.box(0.06, 0.16, 0.06), '#ffd23c', Math.sin(k / 5 * TAU) * 0.25, 2.02, Math.cos(k / 5 * TAU) * 0.25, { outline: false });
      part(D, G.sph(0.07, 0.07, 0.07), '#7de8ff', 0, 1.96, 0.27, { mat: RB_BLUE, outline: false });
      const AR = J.arm = rgrp(D, 0.4, 1.2, 0); part(AR, G.cap(0.09, 0.45, 5), '#7a3aa8', 0, -0.25, 0);
      const SC = J.sceptre = rgrp(AR, 0, -0.5, 0); part(SC, G.cyl(0.05, 0.05, 2.4, 6), '#ffd23c', 0, 0.55, 0.0); part(SC, G.box(0.5, 0.9, 0.08), '#7a1a1a', 0, -0.75, 0);
      part(SC, G.cyl(0.18, 0.12, 0.25, 8), '#ffd23c', 0, 1.85, 0); J.sceptreGlow = part(SC, G.sph(0.16, 0.16, 0.16), '#ff8a3a', 0, 2.08, 0, { mat: RB_GLOWR, outline: false });
    }
  }, 7, 1.5);
}
function rbDuchessRider(J) {
  const h = rbHook('buildDragonBoatDuchess', () => (typeof buildDragonBoatDuchess === 'function' ? buildDragonBoatDuchess : null)); if (!h) return null;
  if (J.duch) J.duch.visible = false; h.obj.position.set(0, 1.4, -1.5); J.root.add(h.obj); return h;
}

// ======================================================================================================================
// 1) ARABBER AL: CHASE RACER
// ======================================================================================================================
const AL_N = {};
const AL = (function () {
  const { sc, cam } = rbScene('#e8c49a', 70, 330, '#ffe8cc', '#6a5444', '#ffd8a0', 1.75, [-60, 90, 40]);
  // ---- the loop: four streets + four corners (closes exactly); zones: alleys, the market square, two water-taxi crossings ----
  const SA = 230, SB = 150, CR = 16, CQ = Math.PI * CR / 2, SEG = [[SA, 0], [CQ, 1 / CR], [SB, 0], [CQ, 1 / CR], [SA, 0], [CQ, 1 / CR], [SB, 0], [CQ, 1 / CR]];
  const PX = [], PZ = [], PH = [], K = [];
  { let x = 0, z = 0, h = 0; for (const [len, k] of SEG) { const n = Math.round(len); const d = len / n; for (let i = 0; i < n; i++) { PX.push(x); PZ.push(z); PH.push(h); K.push(k); x += Math.cos(h + k * d / 2) * d; z += Math.sin(h + k * d / 2) * d; h += k * d; } } }
  const L = PX.length; // ~1 m per sample
  const S0 = [0]; for (const [len] of SEG) S0.push(S0[S0.length - 1] + Math.round(len)); // segment starts (in samples)
  const st = (i) => S0[i * 2]; // straight i start
  const ZONES = [
    { a: st(0) + 55, b: st(0) + 112, w: 5.8, kind: 'alley' }, { a: st(0) + 165, b: st(0) + 191, w: 6.6, kind: 'water', ph: 0 },
    { a: st(1) + 50, b: st(1) + 95, w: 5.8, kind: 'alley' }, { a: st(2) + 40, b: st(2) + 66, w: 6.6, kind: 'water', ph: 2.1 },
    { a: st(2) + 120, b: st(2) + 175, w: 5.8, kind: 'alley' }, { a: st(3) + 30, b: st(3) + 105, w: 15, kind: 'square' },
  ];
  const WZ = ZONES.filter((z) => z.kind === 'water');
  const wrap = (s) => ((s % L) + L) % L;
  const gapS = (a, b) => { let d = wrap(a - b); if (d > L / 2) d -= L; return d; }; // a - b along the loop
  function zoneAt(s) { s = wrap(s); for (const z of ZONES) if (s >= z.a && s < z.b) return z; return null; }
  function widthAt(s) { s = wrap(s); let w = 11; for (const z of ZONES) { const ramp = z.kind === 'water' ? 10 : 7; const d = s < z.a ? z.a - s : s > z.b ? s - z.b : 0; const dd = Math.min(d, L - d); if (dd < ramp) w = lerp(w, z.w, 1 - ease(dd / ramp)); } return w; }
  const _c = { x: 0, z: 0, h: 0, k: 0 };
  function at(s) { s = wrap(s); const i = Math.floor(s), f = s - i, j = (i + 1) % L; _c.x = lerp(PX[i], PX[j], f); _c.z = lerp(PZ[i], PZ[j], f); _c.h = PH[i] + angTo(PH[i], PH[j]) * f; _c.k = K[i]; return _c; }
  function world(s, x, out) { const c = at(s), rx = -Math.sin(c.h), rz = Math.cos(c.h); out.x = c.x + rx * x; out.z = c.z + rz * x; out.h = c.h; return out; }
  const deckO = (z, t) => 2.3 * Math.sin(t * 0.55 + z.ph);

  // ---- ground: road + curbs + sidewalks + lots in one strip mesh (gaps over the water crossings), water underneath ----
  const COB = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a7064'; c.fillRect(0, 0, w, h); let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const ox = (y % 2) * 16, l = 120 + r() * 70 | 0; c.fillStyle = `rgb(${l},${l - 8},${l - 22})`; c.beginPath(); c.ellipse(x * 32 + ox + 16, y * 32 + 16, 13 + r() * 2, 12 + r() * 2, r(), 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,240,.25)'; c.beginPath(); c.ellipse(x * 32 + ox + 12, y * 32 + 11, 5, 3, 0, 0, TAU); c.fill(); } }, 128);
  COB.wrapS = COB.wrapT = THREE.RepeatWrapping;
  {
    const P = [], C = [], U = [], I = []; const col = (h) => new THREE.Color(h);
    const cLot = col('#8a7a6a'), cSide = col('#c09080'), cCurb = col('#d8d0c4'), cRoad = col('#ffffff'), cAlley = col('#d8c8b0');
    const STEP = 2, N = Math.floor(L / STEP); let prevOk = false, base = -1;
    for (let n = 0; n <= N; n++) {
      const s = (n * STEP) % L, w = widthAt(s), z = zoneAt(s), alley = w < 8, sw = alley ? 0.7 : 2.6, lot = alley ? 22 : 30, wet = z && z.kind === 'water';
      const c = at(s), rx = -Math.sin(c.h), rz = Math.cos(c.h);
      const lat = [-(w / 2 + sw + lot), -(w / 2 + sw), -w / 2, -w / 2, w / 2, w / 2, w / 2 + sw, w / 2 + sw + lot], ys = [0.15, 0.15, 0.15, 0, 0, 0.15, 0.15, 0.15];
      const cs = [cLot, cSide, cCurb, alley ? cAlley : cRoad, alley ? cAlley : cRoad, cCurb, cSide, cLot];
      const b0 = P.length / 3;
      for (let j = 0; j < 8; j++) { P.push(c.x + rx * lat[j], ys[j], c.z + rz * lat[j]); C.push(cs[j].r, cs[j].g, cs[j].b); U.push(lat[j] / 2.2, n * STEP / 2.2); }
      const ok = !wet;
      if (ok && prevOk) for (let j = 0; j < 7; j++) { const a = base + j, b = base + j + 1, cc = b0 + j, d = b0 + j + 1; I.push(a, b, cc, b, d, cc); }
      if (ok !== prevOk && n > 0) { // a quay wall where the street meets a crossing
        const qb = ok ? b0 : base, q0 = P.length / 3;
        for (let j = 0; j < 8; j++) { P.push(P[(qb + j) * 3], 0.15, P[(qb + j) * 3 + 2], P[(qb + j) * 3], WY - 0.4, P[(qb + j) * 3 + 2]); C.push(0.55, 0.5, 0.46, 0.4, 0.36, 0.34); U.push(j, 0, j, 0.6); }
        for (let j = 0; j < 7; j++) { const a = q0 + j * 2, b = a + 1, cc = a + 2, d = a + 3; if (ok) I.push(a, cc, b, cc, d, b); else I.push(a, b, cc, b, d, cc); }
      }
      prevOk = ok; base = b0;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, toonMat({ map: COB, side: THREE.DoubleSide })); m.frustumCulled = false; sc.add(m);
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), toonMat({ color: '#2f7fa6', vertexColors: false })); wm.position.set(120, WY, 80); sc.add(wm);
  }
  // ---- rowhouses / warehouses (one instanced box + one instanced cornice), lamps, the market hall, a far skyline ----
  const FAC = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.07)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1);
    for (let f = 0; f < 3; f++) for (let k = 0; k < 2; k++) { const x = 18 + k * 56, y = 12 + f * 38; c.fillStyle = '#f4efe6'; c.fillRect(x - 3, y - 3, 34, 30); c.fillStyle = '#2a3a4a'; c.fillRect(x, y, 28, 24); c.fillStyle = '#9fc4d8'; c.fillRect(x + 2, y + 2, 11, 9); c.fillRect(x + 15, y + 2, 11, 9); }
    c.fillStyle = '#f0ece4'; c.fillRect(0, 118, w, 10); }, 128);
  {
    const sp = []; let s = 0, n = 0;
    while (s < L) { const bw = 5.5 + ((n * 7919) % 5) * 0.4; for (const side of [-1, 1]) { const z = zoneAt(s); const nearW = WZ.some((q) => { const d = gapS(s, (q.a + q.b) / 2); return Math.abs(d) < (q.b - q.a) / 2 + 3; });
        if (nearW) continue; const inner = side > 0 && K[Math.floor(s) % L] > 0; if (inner && (n % 2)) continue;
        const w = widthAt(s), alley = w < 8, sw = alley ? 0.7 : 2.6, dep = alley ? 9 : 11, ht = alley ? 10 + ((n * 31) % 4) : z && z.kind === 'square' ? 6.5 + ((n * 13) % 3) : 7 + ((n * 17) % 4) * 1.2;
        sp.push({ s: s + bw / 2, x: side * (w / 2 + sw + dep / 2), w: bw - 0.15, d: dep, h: ht, alley, n: n + side }); } s += bw; n++; }
    const geo = G.box(1, 1, 1); bakeColor(geo, '#ffffff'); const im = new THREE.InstancedMesh(geo, toonMat({ map: FAC }), sp.length);
    const cg = G.box(1, 1, 1); bakeColor(cg, '#ffffff'); const cm = new THREE.InstancedMesh(cg, toonMat(), sp.length);
    const BR = ['#a84a3a', '#b8604a', '#8a3a30', '#c87a5a', '#9a5040', '#d8b090', '#7a8aa0', '#b8a07a'], CO = ['#f0e8dc', '#3a3030', '#e8d8b0', '#2a3a4a'];
    const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), V = new THREE.Vector3(), Sx = new THREE.Vector3(), o = {}, cc = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    sp.forEach((b, i) => { world(b.s, b.x, o); Qn.setFromAxisAngle(up, Math.PI / 2 - o.h);
      M.compose(V.set(o.x, b.h / 2 + 0.15, o.z), Qn, Sx.set(b.d, b.h, b.w)); im.setMatrixAt(i, M); im.setColorAt(i, cc.set(b.alley ? (b.n % 2 ? '#8a5a48' : '#7a6a5a') : BR[(b.n * 5 + 3) % BR.length]));
      M.compose(V.set(o.x, b.h + 0.35, o.z), Qn, Sx.set(b.d + 0.4, 0.45, b.w + 0.1)); cm.setMatrixAt(i, M); cm.setColorAt(i, cc.set(CO[(b.n * 3) % CO.length])); });
    im.frustumCulled = cm.frustumCulled = false; sc.add(im, cm); AL_N.bld = sp.length;
    // lamps: instanced posts + glowing heads
    const lp = []; for (let s2 = 6; s2 < L; s2 += 26) { if (zoneAt(s2) && zoneAt(s2).kind === 'water') continue; const w = widthAt(s2); if (w < 8) continue; lp.push([s2, -(w / 2 + 0.6)], [s2 + 13, w / 2 + 0.6]); }
    const pg = G.cyl(0.07, 0.09, 3.6, 6); pg.translate(0, 1.8, 0); bakeColor(pg, '#1a1a22'); const pm = new THREE.InstancedMesh(pg, toonMat(), lp.length);
    const hg = G.sph(0.22, 0.26, 0.22, 6, 5); hg.translate(0, 3.7, 0); const hm = new THREE.InstancedMesh(hg, basicSnap({ color: '#fff0c0' }), lp.length);
    lp.forEach(([s2, x], i) => { world(s2, x, o); M.makeTranslation(o.x, 0.15, o.z); pm.setMatrixAt(i, M); hm.setMatrixAt(i, M); }); pm.frustumCulled = hm.frustumCulled = false; sc.add(pm, hm);
    // skyline far beyond the harbour (downtown + Domino-ish sugar tanks, in the haze)
    const sk = []; for (let k = 0; k < 40; k++) { const a = -0.3 + k / 40 * 3.2, R2 = 230 + (k * 37) % 60; sk.push([115 + Math.cos(a) * R2 * 1.2, 75 - Math.sin(a) * R2, 10 + (k * 53) % 40, 12 + (k % 3) * 8]); }
    const kg = G.box(1, 1, 1); kg.translate(0, 0.5, 0); bakeColor(kg, '#ffffff'); const km = new THREE.InstancedMesh(kg, toonMat(), sk.length);
    sk.forEach(([x, z, h, w], i) => { M.compose(V.set(x, WY, z), Qn.identity(), Sx.set(w, h + 10, w)); km.setMatrixAt(i, M); km.setColorAt(i, cc.set(i % 4 ? '#b89a8a' : '#c8b8a8')); }); km.frustumCulled = false; sc.add(km);
    // the market hall on the square (long brick shed, clerestory, a cupola) + bollards at the quays
    const MH = rbRig((r) => { part(r, G.box(9, 5, 28), '#9a4a3a', 0, 2.5, 0); part(r, G.box(9.6, 0.4, 28.6), '#f0e8dc', 0, 5.1, 0); part(r, G.box(5, 1.6, 26), '#9a4a3a', 0, 6.0, 0); part(r, G.box(5.6, 0.3, 26.6), '#3a3030', 0, 6.9, 0);
      part(r, G.box(2, 2, 2), '#f0e8dc', 0, 8.0, 0); part(r, G.cyl(0.0, 1.5, 1.4, 8), '#3a6a5a', 0, 9.7, 0); for (let k = -3; k <= 3; k++) part(r, G.box(0.1, 2.4, 1.6), '#2a3a4a', 4.55, 1.6, k * 3.6, { outline: false }); }, 18, 4);
    world(st(3) + 68, 15 / 2 + 2.6 + 4.6, o); MH.root.position.set(o.x, 0.15, o.z); MH.root.rotation.y = Math.PI / 2 - o.h; sc.add(MH.root);
  }
  // ---- ferries (water-taxi decks across the crossings), the player's car, Al's cart, produce, spray ----
  const FERRY = WZ.map((z) => { const J = rbRig((r) => { part(r, G.box(6.0, 0.7, 24.5), '#f4f4f0', 0, -0.3, 0); part(r, G.box(6.06, 0.16, 24.6), '#2a6ac8', 0, -0.05, 0, { outline: false });
      part(r, G.box(5.6, 0.06, 24.0), '#c8a070', 0, 0.06, 0, { outline: false }); for (const s of [-1, 1]) part(r, G.box(0.12, 0.5, 24.0), '#ffd23c', s * 2.95, 0.3, 0, { outline: false }); }, 14, 0); sc.add(J.root); return { z, J }; });
  const car = rbBuildCar(); sc.add(car.root);
  const cart = rbBuildAlCart(true); sc.add(cart.root); const rider = rbAlRider(cart);
  const TYPES = [{ col: '#2f8a2a', geo: () => G.sph(0.55, 0.45, 0.45, 8, 6), splat: '#ff5a6a' }, { col: '#9ad050', geo: () => G.sph(0.42, 0.38, 0.42, 7, 5), splat: '#c8f080' }, { col: '#e83a2a', geo: () => G.box(0.9, 0.55, 0.7), splat: '#ff3a2a' }];
  const POOL = 14; const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(1, 1, 1), _E = new THREE.Euler();
  TYPES.forEach((T) => { const g = T.geo(); bakeColor(g, T.col); T.im = new THREE.InstancedMesh(g, toonMat(), POOL); T.im.count = 0; T.im.frustumCulled = false; sc.add(T.im); });
  const spray = rbSpray(sc, 120);
  const S = { on: false, phase: 'intro', t: 0, pt: 0, time: 90, hits: 0, items: [], win: false };
  const pl = { s: 0, x: 0, v: 0, y: 0, vy: 0, boost: 0, meter: 1, wob: 0, ramCd: 0, sunk: 0, steer: 0, scrape: 0, swing: 0 };
  const al = { s: 0, x: 0, v: 0, stun: 0, throwT: 2, throwK: 0, weave: 0, tx: 0, crash: 0 };
  const o1 = {}, o2 = {};
  function reset() {
    S.phase = 'intro'; S.said = false; S.cn = undefined; S.t = 0; S.pt = 0; S.time = Q.has('rbtime') ? +Q.get('rbtime') : 90; S.hits = 0; S.win = false; S.items.length = 0; spray.clear();
    Object.assign(pl, { s: st(3) + 112, x: 0, v: 0, y: 0, vy: 0, boost: 0, meter: 1, wob: 0, ramCd: 0, sunk: 0, steer: 0, swing: 0 });
    Object.assign(al, { s: st(3) + 136, x: 0, v: 0, stun: 0, burst: 0, throwT: 2.2, throwK: 0, weave: 0, tx: 0, crash: 0 });
    RBH.setPips(0); RBH.clockLow(false); RB.alStats = { ok: true, hits: 0, splashes: 0, produceHits: 0, throws: 0, scrapes: 0 };
  }
  function lim(s) { return widthAt(s) / 2 - 1.05; }
  function throwProduce() {
    const T = Math.floor(Math.random() * 3), dist = rnd(9, 20) + al.v * 0.35, s1 = al.s - dist, l = Math.max(0.5, lim(s1));
    let x1 = clamp(pl.x + rnd(-2.2, 2.2), -l, l); const z = zoneAt(s1); if (z && z.kind === 'water') x1 = deckO(z, S.t + 0.9) + rnd(-2, 2);
    S.items.push({ T, s0: al.s - 1.2, x0: al.x, s1, x1, t: 0, dur: 0.9, alive: true, land: false, rot: rnd(0, TAU) }); al.throwK = 1; RB.alStats.throws++;
    if (S.items.length > 30) S.items.shift();
  }
  function itemPos(it) { const u = clamp(it.t / it.dur, 0, 1); const s = lerp(it.s0, it.s1, u), x = lerp(it.x0, it.x1, u), y = it.land ? 0.15 : 1.9 + Math.sin(u * Math.PI) * 2.6 - u * 1.6; return { s, x, y: Math.max(0.15, y) }; }
  // ---- the scripted pilot (tests): chase Al's line, boost when close, hop produce / line up the ferries ----
  function autoPilot() {
    if (RB.auto !== 'win') { IN.mx = 0; IN.my = RB.auto === 'lose' ? -1 : 0; return; }
    const gap = gapS(al.s, pl.s); let tx = al.x;
    const zA = zoneAt(pl.s + 14) || zoneAt(pl.s + 6) || zoneAt(pl.s); if (zA && zA.kind === 'water') tx = deckO(zA, S.t + 0.5);
    for (const it of S.items) { if (!it.alive || !it.land) continue; const d = gapS(it.s1, pl.s); if (d > 0 && d < 9 && Math.abs(it.x1 - pl.x) < 1.6) { if (pl.y === 0 && d < 5) PRESS.add('k'); else tx = it.x1 + (it.x1 > pl.x ? -2.6 : 2.6); } }
    IN.mx = clamp((tx - pl.x) * 0.9, -1, 1); IN.my = 1;
    if (gap > 2 && gap < 22 && pl.meter > 0.98 && pl.boost <= 0) PRESS.add('j');
  }
  function start() {
    reset(); RB.mode = 'al'; S.on = true; rbEnterFight('ARABBER AL', TOUCH ? 'STICK steer · SWING boost · JUMP hop' : DEV === 'pad' ? 'stick steer · X boost · A hop' : 'A/D steer · W/S gas · J boost · K hop');
    rbLend(car.root, [-0.45, 0.22, -0.55], car.root, [0.45, 0.22, -0.55]);
    rbLog('al start'); place(0);
  }
  function exit(won) {
    S.on = false; RB.mode = null; rbReturnRigs(); rbLeaveFight();
    hero.pos.set(164, groundY(164, -52), -52); partner.pos.set(162.5, groundY(162.5, -53), -53); hero.yaw = partner.yaw = Math.PI; hero.set('move'); partner.set('move'); hero.sync(0); partner.sync(0);
    CAM.yaw = 0; CITYAL.update(); rbLog('al exit ' + (won ? 'won' : 'quit'));
  }
  function win() {
    S.phase = 'won'; S.pt = 0; S.win = true; al.crash = 0.001; RBH.speak('ARABBER AL', rbPick(rbLines('arabber_al').defeat), 4.2); RBH.shout('BUSTED!', 2.4, '#7dffc0');
    const first = BOSS_CLEAR.clear('fells', { mode: 'chase', time: +(S.time).toFixed(1) }); RB.alStats.cleared = first; RB.alStats.city = BOSS_CLEAR.cityCrime();
    sfx('ko'); S.wasWin = true; rbLog('al WIN hits=' + S.hits + ' left=' + S.time.toFixed(1));
  }
  function lose(why) { S.phase = 'lost'; S.pt = 0; RBH.shout(why, 2, '#ff5f5f'); RBH.speak('ARABBER AL', 'Hee-yah! Can\'t catch Al, old timer!', 3); sfx('hurt'); rbLog('al LOSE ' + why); }
  function step(dt) {
    S.t += dt; S.pt += dt; const P = S.phase;
    if (P === 'intro') {
      if (S.pt > 0.4 && !S.said) { S.said = true; RBH.speak('ARABBER AL', rbPick(rbLines('arabber_al').intro), 3.4); }
      if (S.pt > 3.6 || (S.pt > 0.8 && (PRESS.has('j') || PRESS.has('k') || PRESS.has('e') || RB.auto))) { S.phase = 'count'; S.pt = 0; RBH.setHint('RAM HIM 3 TIMES BEFORE THE CLOCK RUNS OUT!'); }
      al.v = 0;
    } else if (P === 'count') {
      const n = 3 - Math.floor(S.pt / 0.8); if (n !== S.cn) { S.cn = n; if (n > 0) { RBH.shout(String(n), 0.7); sfx('jump'); } else { RBH.shout('GO!', 0.9, '#7dffc0'); sfx('ko'); } }
      if (S.pt > 2.4) { S.phase = 'race'; S.pt = 0; S.said = false; RBH.setHint(TOUCH ? 'SWING = BOOST · JUMP = HOP OVER PRODUCE' : 'BOOST J / E · HOP K · don\'t miss the water-taxi decks!'); }
    } else if (P === 'race') {
      if (RB.auto) autoPilot();
      S.time -= dt; if (S.time <= 0) { S.time = 0; lose('HE GOT AWAY!'); }
      simPlayer(dt); simAl(dt); collide();
    } else if (P === 'won' || P === 'lost') {
      pl.v = damp(pl.v, 0, 1.5, dt); pl.s += pl.v * dt; if (P === 'won') { al.v = damp(al.v, 0, 3, dt); al.s += al.v * dt; al.crash += dt; } else { al.v = damp(al.v, 24, 1, dt); al.s += al.v * dt; }
      if (P === 'won' && (S.pt > 4.5 || (S.pt > 1.5 && (PRESS.has('j') || PRESS.has('k') || PRESS.has('e'))))) { exit(true); return; }
      if (P === 'lost' && S.pt > 1.8) { S.phase = 'retry'; RBH.showRetry('ARABBER AL GOT AWAY<br><span style="font-size:11px;color:#fff">rams ' + S.hits + ' / 3</span>'); }
    } else if (P === 'retry') {
      const c = RB.auto ? (RB.autoQuit ? 'quit' : null) : rbRetryInput();
      if (c === 'retry') { RBH.retry.classList.remove('on'); reset(); RB.alStats.retries = (RB.alStats.retries || 0) + 1; rbLog('al retry'); }
      else if (c === 'quit') { exit(false); return; }
    }
    // items: flight + landing
    for (const it of S.items) { if (!it.alive) continue; if (!it.land) { it.t += dt; if (it.t >= it.dur) { it.land = true; const z = zoneAt(it.s1); if (z && z.kind === 'water' && Math.abs(it.x1 - deckO(z, S.t)) > 2.8) { it.alive = false; world(it.s1, it.x1, o1); spray.burst(o1.x, WY + 0.2, o1.z, '#e8f8ff', 10, 3, 5); } } }
      if (it.land && gapS(pl.s, it.s1) > 30) it.alive = false; }
    pl.ramCd -= dt; pl.swing = Math.max(0, pl.swing - dt * 1.6);
    spray.tick(dt, 0.15);
  }
  function simPlayer(dt) {
    if (pl.sunk > 0) { pl.sunk -= dt; if (pl.sunk <= 0) { const z = zoneAt(pl.s) || WZ.find((q) => Math.abs(gapS(pl.s, q.b)) < 30); pl.s = (z ? z.b : pl.s) + 4; pl.x = 0; pl.y = 0; pl.vy = 0; pl.v = 8; } return; }
    pl.meter = Math.min(1, pl.meter + dt / 5.5); pl.boost -= dt;
    if (rbBoost() && pl.meter >= 1 && pl.boost <= 0) { pl.boost = 1.3; pl.meter = 0; RBH.shout('BOOST!', 0.6, '#7de8ff'); sfx('swing'); }
    if (rbHop() && pl.y <= 0.001) { pl.vy = 6.4; sfx('jump'); }
    const top = pl.boost > 0 ? 33 : 24 + Math.max(0, IN.my) * 2, acc = pl.boost > 0 ? 22 : 8;
    if (IN.my < -0.3) pl.v = Math.max(0, pl.v - 22 * dt * -IN.my); else pl.v = Math.min(top, pl.v + acc * dt * (pl.v > top ? -2 : 1));
    if (pl.wob > 0) { pl.wob -= dt; pl.v = Math.min(pl.v, 14); }
    pl.steer = damp(pl.steer, IN.mx, 8, dt);
    pl.x += pl.steer * (6.5 + pl.v * 0.16) * dt; pl.x -= at(pl.s).k * pl.v * pl.v * 0.012 * dt;
    pl.s = wrap(pl.s + pl.v * dt);
    pl.vy -= 22 * dt; pl.y = Math.max(0, pl.y + pl.vy * dt); if (pl.y === 0) pl.vy = 0;
    const z = zoneAt(pl.s);
    if (z && z.kind === 'water') { const o = deckO(z, S.t); if (pl.y < 0.05 && Math.abs(pl.x - o) > 2.4) { pl.sunk = 1.4; pl.v = 0; world(pl.s, pl.x, o1); spray.burst(o1.x, WY + 0.3, o1.z, '#e8f8ff', 26, 5, 8); RBH.shout('SPLASH!', 1, '#6fd8ff'); sfx('heavy'); RB.alStats.splashes++; S.shake = 0.5; }
      pl.x = clamp(pl.x, o - 4, o + 4); }
    else { const l = lim(pl.s); if (Math.abs(pl.x) > l) { pl.x = Math.sign(pl.x) * l; pl.v *= Math.exp(-1.6 * dt); if ((pl.scrape -= dt) <= 0) { pl.scrape = 0.08; world(pl.s, pl.x + Math.sign(pl.x) * 1, o1); spray.burst(o1.x, 0.6, o1.z, '#ffd23c', 3, 2, 3); RB.alStats.scrapes++; } } }
  }
  function simAl(dt) {
    const gap = gapS(al.s, pl.s); al.stun -= dt; al.throwK = Math.max(0, al.throwK - dt * 3);
    let vt = 21 + S.hits * 1.3; if (gap > 70) vt = 14; else if (gap > 42) vt = 18; else if (gap < 9) vt += 3.5;
    if (al.burst > 0) { al.burst -= dt; vt = 28; } // the getaway gallop after a ram
    if (al.stun > 0) { vt = 7; if (al.stun - dt <= 0) al.burst = 2.2; }
    al.v = damp(al.v, vt, al.stun > 0 ? 4 : 1.6, dt); al.s = wrap(al.s + al.v * dt);
    const l = lim(al.s), z = zoneAt(al.s + 6) || zoneAt(al.s);
    al.weave += dt * (0.6 + S.hits * 0.15); let tx = Math.sin(al.weave) * l * 0.65;
    const dodge = gap < 13 && gap > 0 && al.stun <= 0; if (dodge) tx = pl.x > 0 ? -l * 0.85 : l * 0.85; // dodge the ram
    if (z && z.kind === 'water') tx = deckO(z, S.t);
    al.x = clamp(damp(al.x, tx, dodge ? 2.2 : 1.4, dt), -Math.max(l, 2.6), Math.max(l, 2.6));
    if ((zoneAt(al.s) || {}).kind !== 'water') al.x = clamp(al.x, -l, l);
    al.throwT -= dt; if (al.throwT <= 0 && al.stun <= 0 && gap > 3 && gap < 90) { throwProduce(); al.throwT = rnd(1.1, 1.9) - S.hits * 0.18 - (gap < 25 ? 0.3 : 0); }
  }
  function collide() {
    if (pl.sunk > 0) return;
    for (const it of S.items) { if (!it.alive || !it.land) continue; const d = gapS(it.s1, pl.s); if (Math.abs(d) < 1.7 && Math.abs(it.x1 - pl.x) < 1.45 && pl.y < 0.55) {
      it.alive = false; pl.v *= 0.5; pl.wob = 0.7; world(it.s1, it.x1, o1); spray.burst(o1.x, 0.7, o1.z, TYPES[it.T].splat, 18, 5, 6); sfx('hit'); S.shake = 0.35; RB.alStats.produceHits++; RBH.shout('SPLAT!', 0.6, '#ff5a6a'); } }
    const gap = gapS(al.s, pl.s), dx = al.x - pl.x;
    if (gap > -1.5 && gap < 4.6 && Math.abs(dx) < 2.05 && pl.y < 0.9) {
      const rel = pl.v - al.v;
      if (pl.ramCd <= 0 && (rel > 1.5 || pl.boost > 0) && gap > 0.5) {
        S.hits++; RB.alStats.hits = S.hits; al.stun = 1.6; al.v *= 0.4; pl.v = Math.max(4, al.v - 2); pl.ramCd = 2.0; pl.swing = 1; pl.boost = 0; RBH.setPips(S.hits); S.shake = 0.7; S.hitstop = 0.12;
        world(al.s - 1, al.x, o1); spray.burst(o1.x, 1.4, o1.z, '#ffb02a', 22, 6, 7); spray.burst(o1.x, 1.4, o1.z, '#e83a2a', 14, 5, 6); sfx('heavy'); rbLog('al RAM ' + S.hits);
        if (S.hits >= 3) win(); else { RBH.shout('RAM! ' + S.hits + '/3', 1.1); if (S.hits === 2) RBH.speak('ARABBER AL', 'Watch the melons! WATCH THE MELONS!', 2.4); }
      } else if (gap > 0) { pl.v = Math.min(pl.v, al.v * 0.97); pl.x -= Math.sign(dx || 1) * 3 * (1 / 60); }
    }
  }
  // ---- placing everything + the chase camera ----
  const camP = new THREE.Vector3(), camL = new THREE.Vector3();
  function place(dt) {
    // car
    world(pl.s, pl.x, o1); const sunk = pl.sunk > 0 ? (1.4 - pl.sunk) : 0;
    car.root.position.set(o1.x, (pl.sunk > 0 ? -sunk * 1.2 : 0) + pl.y + 0.02, o1.z); car.root.rotation.set(-pl.vy * 0.025, Math.PI / 2 - o1.h - pl.steer * 0.22 + (pl.wob > 0 ? Math.sin(pl.wob * 30) * 0.12 : 0), -pl.steer * 0.05);
    for (const w of car.wheels) w.rotation.x += pl.v * dt / 0.4;
    // ferries
    for (const F of FERRY) { const mid = (F.z.a + F.z.b) / 2; world(mid, deckO(F.z, S.t), o2); F.J.root.position.set(o2.x, Math.sin(S.t * 1.3 + F.z.ph) * 0.04, o2.z); F.J.root.rotation.y = Math.PI / 2 - o2.h; }
    // Al's cart
    world(al.s, al.x, o2); const cr = al.crash;
    cart.root.position.set(o2.x, cr > 0 ? Math.max(0, Math.sin(Math.min(cr, 0.8) * 4) * 1.2) : Math.abs(Math.sin(S.t * 9)) * 0.05, o2.z);
    cart.root.rotation.set(cr > 0 ? -Math.min(cr * 0.6, 0.25) : 0, Math.PI / 2 - o2.h + (al.stun > 0 ? Math.sin(al.stun * 18) * 0.25 : 0) + (cr > 0 ? Math.min(cr * 2.5, 1.1) : 0), cr > 0 ? Math.min(cr * 0.8, 0.35) : 0);
    const gal = S.t * (al.v * 0.45 + 2);
    cart.legs.forEach((g, i) => { g.rotation.x = Math.sin(gal + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.6) * Math.min(0.75, 0.1 + al.v * 0.04); });
    cart.hneck.rotation.x = Math.sin(gal * 2) * 0.08; cart.tail.rotation.x = 0.3 + Math.sin(gal * 1.5) * 0.25; for (const w of cart.wheels) w.rotation.x += al.v * dt / 0.6;
    if (cart.alArm) { cart.alArm.rotation.x = -2.6 * al.throwK + Math.sin(S.t * 3) * 0.1; cart.alArm.rotation.z = -0.3 * al.throwK; cart.al.rotation.y = al.throwK > 0 ? Math.PI * 0.85 : Math.sin(S.t * 0.8) * 0.4; }
    if (rider && rider.upd) rider.upd(dt, { t: S.t, state: S.phase, throwK: al.throwK, stun: al.stun });
    // produce instances
    for (const T of TYPES) T.im.count = 0;
    for (const it of S.items) { if (!it.alive) continue; const T = TYPES[it.T]; if (T.im.count >= POOL) continue; const p = itemPos(it); world(p.s, p.x, o2); const spin = it.land ? it.rot : it.rot + it.t * 9;
      _M.compose(_V.set(o2.x, p.y + 0.3, o2.z), _Q.setFromEuler(_E.set(spin * 0.7, spin, 0)), _S); T.im.setMatrixAt(T.im.count++, _M); }
    for (const T of TYPES) T.im.instanceMatrix.needsUpdate = true;
    // toads
    const bump = Math.abs(Math.sin(S.t * 13)) * Math.min(1, pl.v / 20) * 0.5;
    applyPose(hero.J, rbSeatPose(true, S.t, bump), 14, Math.max(dt, 1 / 60)); applyPose(partner.J, pl.swing > 0 ? rbSwingPose(1 - pl.swing) : rbSeatPose(false, S.t + 1.3, bump), 14, Math.max(dt, 1 / 60));
    // camera: low behind the car, looking down the street; the intro orbits Al
    const portrait = rbPortrait(), back = portrait ? 9.6 : 7.6, hgt = portrait ? 4.2 : 3.1;
    let tx, ty, tz, lx, ly, lz;
    if (S.phase === 'intro') { world(al.s, 0, o2); const a = o2.h + 2.2 - S.pt * 0.35; tx = o2.x + Math.cos(a) * 9; tz = o2.z + Math.sin(a) * 9; ty = 3.2; lx = o2.x; ly = 1.8; lz = o2.z; }
    else { const h = o1.h, dx = Math.cos(h), dz = Math.sin(h); tx = o1.x - dx * back; tz = o1.z - dz * back; ty = hgt + pl.y * 0.5 + (pl.sunk > 0 ? 1 : 0); lx = o1.x + dx * 9; ly = 1.4; lz = o1.z + dz * 9;
      if (S.phase === 'won') { world(al.s, al.x, o2); lx = lerp(lx, o2.x, 0.6); lz = lerp(lz, o2.z, 0.6); } }
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * (S.phase === 'intro' ? 3 : 7));
    camP.x += (tx - camP.x) * k; camP.y += (ty - camP.y) * k; camP.z += (tz - camP.z) * k; camL.x += (lx - camL.x) * k; camL.y += (ly - camL.y) * k; camL.z += (lz - camL.z) * k;
    S.shake = Math.max(0, (S.shake || 0) - dt * 1.8); const sh = S.shake * 0.35;
    cam.position.set(camP.x + rnd(-sh, sh), camP.y + rnd(-sh, sh), camP.z + rnd(-sh, sh)); cam.lookAt(camL);
    cam.fov = (portrait ? 72 : 62) + (pl.boost > 0 ? 8 : 0) + Math.min(6, pl.v * 0.15); cam.updateProjectionMatrix();
    // HUD
    RBH.setClock(S.time.toFixed(1)); RBH.clockLow(S.time < 15);
    RBH.setBar(pl.meter, pl.meter >= 1 ? '#7dffc0' : '#4a8a6a', pl.meter >= 1 ? 'BOOST READY' : 'BOOST');
    if (APANEL) APANEL.setAct({ kind: 'power', label: 'BOOST', ready: pl.meter >= 1 }, pl.meter);
  }
  function frame(rdt) {
    const steps = RB.freeze ? 0 : SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) { if (k > 0) readInput(); let dt = SIM ? 1 / 60 : rdt; if (S.hitstop > 0) { S.hitstop -= dt; dt *= 0.1; } RB.t += dt; step(dt); if (!S.on) return; if (k < steps - 1) { place(dt); PRESS.clear(); } }
    place(steps ? (SIM ? 1 / 60 : rdt) : 0); RBH.tick(SIM ? rdt * SIM : rdt); PRESS.clear(); rbDraw(sc, cam);
  }
  return { S, pl, al, start, exit, frame, L, ZONES, at, world, widthAt, zoneAt, gapS, deckO, sc, cam, car, cart, rider: () => rider, place };
})();

// ---- the parked cart at Fells Point (the city side): ACT "CHASE" starts the race; it is gone (busted) once Al is beaten ----
const CITYAL = (function () {
  const B = (LANDMARKS.find((l) => l.id === 'fells') || {}).boss; if (!B) return { update() {} };
  const J = rbBuildAlCart(true); J.root.position.set(B.x, CURB, B.z); J.root.rotation.y = -Math.PI / 2 + 0.35; scene.add(J.root); rbAlRider(J);
  const C = { J, update() { J.root.visible = !(B.cleared); } };
  ACTIONS.push({ kind: 'boss', get label() { return 'CHASE AL'; }, x: B.x - 1.6, z: B.z + 2.6, r: 3.0, y: 2.4, ok: () => !RB.mode && !B.cleared && !hero.roof, go: () => AL.start() });
  C.update(); return C;
})();

// ======================================================================================================================
// 2) HARBOUR RIDES: water taxi (3 stops) + the Harborplace paddle boats. The FIRST ride of any kind is ambushed by the Duchess.
// ======================================================================================================================
const RIDES = (function () {
  const STOPS = [
    { id: 'hp', name: 'HARBORPLACE', land: [-51.4, -1], boat: [-47.6, -1], yaw: Math.PI / 2 },
    { id: 'fh', name: 'FEDERAL HILL', land: [-8, 31.6], boat: [-8, 27.0], yaw: Math.PI },
    { id: 'fp', name: 'FELLS POINT', land: [152, -31.6], boat: [152, -27.0], yaw: 0 },
  ];
  // waypoints between stops (clear of the piers): out from the dock, across, in to the next dock
  const LEGS = { 'hp>fh': [[-42, 4], [-14, 21]], 'fh>fp': [[0, 18], [135, -2], [150, -19]], 'fp>hp': [[150, -19], [130, 2], [-38, 4]] };
  const PADDLE = { land: [-51.4, -12], boat: [-47.6, -12], loop: [[-44, -6], [-30, 0], [-26, 12], [-44, 14], [-47, 2]] };
  const boats = STOPS.map((s) => { const J = rbBuildTaxi(); J.root.position.set(s.boat[0], WY - 0.05, s.boat[1]); J.root.rotation.y = s.yaw; scene.add(J.root); return J; });
  const dockOf = boats.map((_, i) => i); // which stop each taxi sits at
  const pb = rbBuildPaddle(); pb.root.position.set(PADDLE.boat[0], WY - 0.02, PADDLE.boat[1]); pb.root.rotation.y = Math.PI / 2; scene.add(pb.root);
  const R = { on: false, kind: null, t: 0, s: 0, pts: null, len: 0, boat: null, from: -1, to: -1, ambushed: false, ambushT: 0, done: 0, log: [], speed: 10, yaw: 0 };
  STOPS.forEach((s, i) => VEHICLES.push({ kind: 'boat', label: 'WATER TAXI', x: s.land[0], z: s.land[1], r: 2.8, enter: () => start('taxi', i), exit: () => {} }));
  VEHICLES.push({ kind: 'boat', label: 'PADDLE BOAT', x: PADDLE.land[0], z: PADDLE.land[1], r: 2.8, enter: () => start('paddle', -1), exit: () => {} });
  function path(kind, i) {
    if (kind === 'paddle') { const P = [PADDLE.boat, ...PADDLE.loop, PADDLE.boat]; return P; }
    const j = (i + 1) % STOPS.length, key = STOPS[i].id + '>' + STOPS[j].id; return [STOPS[i].boat, ...LEGS[key], STOPS[j].boat];
  }
  function start(kind, i) {
    R.on = true; R.kind = kind; R.t = 0; R.s = 0; R.from = i; R.to = kind === 'paddle' ? -1 : (i + 1) % STOPS.length; R.ambushed = false; R.ambushT = 0; R.speed = kind === 'paddle' ? 4.5 : 10;
    R.boat = kind === 'paddle' ? pb : boats[dockOf.indexOf(i)]; R.pts = path(kind, i); R.seg = []; R.len = 0;
    for (let k = 1; k < R.pts.length; k++) { const l = Math.hypot(R.pts[k][0] - R.pts[k - 1][0], R.pts[k][1] - R.pts[k - 1][1]); R.seg.push(l); R.len += l; }
    RB.mode = 'ride'; const deck = kind === 'paddle' ? 0.3 : 0.62;
    rbLend(R.boat.root, kind === 'paddle' ? [-0.42, deck, -0.5] : [-0.5, deck + 0.18, 0.15], R.boat.root, kind === 'paddle' ? [0.42, deck, -0.5] : [0.5, deck + 0.18, 0.15]);
    hero.set('move'); RIDE.v = { kind: 'boat' };
    banner(kind === 'paddle' ? 'PADDLE BOAT!' : 'WATER TAXI \u2192 ' + STOPS[R.to].name, 1.8); rbLog('ride start ' + kind + ' ' + (i >= 0 ? STOPS[i].id : 'paddle'));
    R.yaw = R.boat.root.rotation.y; R.camInit = false;
  }
  function posAt(s, out) { let k = 0; while (k < R.seg.length - 1 && s > R.seg[k]) { s -= R.seg[k]; k++; } const a = R.pts[k], b = R.pts[k + 1], u = clamp(s / R.seg[k], 0, 1); out.x = lerp(a[0], b[0], u); out.z = lerp(a[1], b[1], u); out.dx = b[0] - a[0]; out.dz = b[1] - a[1]; return out; }
  const _p = {};
  function finish() {
    R.on = false; RB.mode = null; RIDE.v = null; rbReturnRigs();
    let land;
    if (R.kind === 'paddle') land = PADDLE.land; else {
      const bi = boats.indexOf(R.boat), other = dockOf.indexOf(R.to); dockOf[bi] = R.to; // the taxi stays at its new stop; the one that sat there goes back to the old stop
      if (other >= 0 && other !== bi) { dockOf[other] = R.from; const s = STOPS[R.from]; boats[other].root.position.set(s.boat[0], WY - 0.05, s.boat[1]); boats[other].root.rotation.y = s.yaw; }
      const s = STOPS[R.to]; R.boat.root.position.set(s.boat[0], WY - 0.05, s.boat[1]); R.boat.root.rotation.y = s.yaw; land = s.land;
    }
    if (R.kind === 'paddle') { pb.root.position.set(PADDLE.boat[0], WY - 0.02, PADDLE.boat[1]); pb.root.rotation.y = Math.PI / 2; }
    hero.pos.set(land[0], groundY(land[0], land[1]), land[1]); partner.pos.set(land[0] - 0.8, groundY(land[0], land[1]), land[1] - 1.2); hero.vel.set(0, 0); hero.speed = 0;
    hero.set('move'); partner.set('move'); hero.sync(0); partner.sync(0); R.done++; banner(R.kind === 'paddle' ? 'BACK AT THE DOCK' : STOPS[R.to].name, 1.6); rbLog('ride end ' + R.kind);
  }
  function step(dt) {
    R.t += dt;
    if (!R.ambushed && !rbDuchessBeaten() && R.t > 2.6) { // the Duchess ambush (once per ride, until she is beaten for good)
      R.ambushed = true; R.ambushT = 2.4; banner('AMBUSH!', 2.0); DUCH.ambushLine(); sfx('heavy'); S.shake = 0.6; rbLog('ride ambush');
    }
    if (R.ambushT > 0) { R.ambushT -= dt; if (R.ambushT <= 0) { DUCH.start(R.kind); return; } }
    const slow = R.ambushT > 0 ? 0.25 : 1, ed = Math.min(R.s, R.len - R.s);
    R.s = Math.min(R.len, R.s + R.speed * slow * clamp(0.25 + ed / 6, 0.25, 1) * dt);
    posAt(R.s, _p); const yawT = Math.atan2(_p.dx, _p.dz); R.yaw += angTo(R.yaw, yawT) * (1 - Math.exp(-dt * 2.2));
    const B = R.boat.root; B.position.set(_p.x, WY - 0.05 + Math.sin(R.t * 2.1) * 0.05, _p.z); B.rotation.set(Math.sin(R.t * 1.7) * 0.02, R.yaw, Math.sin(R.t * 1.3) * 0.025);
    if (R.boat.wheel) R.boat.wheel.rotation.x += dt * 4;
    const v = R.speed * slow; hero.pos.set(_p.x, WY + 0.6, _p.z); hero.vel.set(Math.sin(R.yaw) * v, Math.cos(R.yaw) * v); hero.speed = v; hero.yaw = R.yaw;
    partner.pos.set(_p.x + 0.8, WY + 0.6, _p.z);
    applyPose(hero.J, rbSeatPose(R.kind === 'paddle', R.t), 10, dt); applyPose(partner.J, rbSeatPose(false, R.t + 2), 10, dt);
    if (PRESS.has('e') && R.ambushT <= 0 && R.t > 1) { R.s = R.len; } // ACT: hop off at the next stop now (skip the ride)
    if (R.s >= R.len - 0.01) finish();
  }
  function frame(rdt) {
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) { if (k > 0) readInput(); const dt = SIM ? 1 / 60 : rdt; S.time += dt; RB.t += dt; step(dt); if (RB.mode !== 'ride') return; if (k < steps - 1) PRESS.clear(); }
    const dt = rdt; // the ride camera: low behind the boat (just under the canopy line, so the toads show), sweeping round as it turns
    { const back = rbPortrait() ? 10 : 8.5, B = R.boat.root.position, yb = R.yaw; CAM.yaw = wrapA(yb + Math.PI); CAM.pivot.set(hero.pos.x, hero.pos.y + 1.55, hero.pos.z);
      const k = R.camInit ? 1 - Math.exp(-dt * 3) : 1; R.camInit = true; R.cp = R.cp || new THREE.Vector3();
      R.cp.x += (B.x - Math.sin(yb) * back - R.cp.x) * k; R.cp.y += (WY + 2.35 - R.cp.y) * k; R.cp.z += (B.z - Math.cos(yb) * back - R.cp.z) * k;
      camera.position.copy(R.cp); camera.lookAt(B.x + Math.sin(yb) * 6, WY + 1.1, B.z + Math.cos(yb) * 6); }
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70); window.__sky.position.copy(camera.position);
    updateSprites(rdt); hud(rdt); if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    updateCycle(SIM ? rdt * SIM : rdt); cityHud(rdt); BARK.tick(rdt); RBH.tick(rdt);
    if (APANEL) APANEL.setAct(R.ambushT > 0 ? null : { kind: 'boat', label: 'HOP OFF' }, 1);
    PRESS.clear(); draw();
  }
  function resume() { R.camInit = false; RB.mode = 'ride'; rbLend(R.boat.root, R.kind === 'paddle' ? [-0.42, 0.3, -0.5] : [-0.5, 0.8, 0.15], R.boat.root, R.kind === 'paddle' ? [0.42, 0.3, -0.5] : [0.5, 0.8, 0.15]); RIDE.v = { kind: 'boat' }; }
  return { R, STOPS, boats, pb, start, frame, resume, finish, PADDLE };
})();

// ======================================================================================================================
// 3) DRAGON BOAT DUCHESS: BOAT RAMMING RACE (harbour arena)
// ======================================================================================================================
const DUCH = (function () {
  const { sc, cam } = rbScene('#a8c8dc', 60, 300, '#e8f4ff', '#3a5a6a', '#fff2d8', 1.8, [50, 90, 30]);
  const AW = 70, AD = 48; // half extents of the arena
  const PIERS = [ // the arena's piers and seawalls: x0, x1, z0, z1
    [-AW - 6, AW + 6, -AD - 6, -AD], [-AW - 6, AW + 6, AD, AD + 6], [-AW - 6, -AW, -AD, AD], [AW, AW + 6, -AD, AD],
    [-44, -38, -AD, -16], [8, 14, -AD, -20], [38, 44, -AD, -26], [-22, -16, 18, AD], [24, 30, 24, AD], [-62, -48, 8, 14], [52, AW, -4, 2],
  ].map(([x0, x1, z0, z1]) => ({ x0, x1, z0, z1 }));
  const BUOYS = [[-20, -10], [0, -32], [22, -6], [-34, 6], [-6, 10], [16, 14], [44, 16], [-54, -26], [58, -30], [-30, 32], [2, 36], [48, 36], [-8, -14], [30, -36], [-48, 30], [62, 24]].map(([x, z], i) => ({ x, z, r: 0.95, i, bob: 0, hitT: 0 }));
  // water, piers (instanced) + posts, buoys (instanced + their lights), a skyline across the water
  { const wm = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), toonMat({ color: '#3a86b0', vertexColors: false })); wm.position.y = WY; sc.add(wm);
    const M = new THREE.Matrix4(), V = new THREE.Vector3(), Sx = new THREE.Vector3(), Qn = new THREE.Quaternion(), cc = new THREE.Color();
    const DECK = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(60,40,20,.35)'; for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 2, h); }, 64);
    const pg = G.box(1, 1, 1); bakeColor(pg, '#ffffff'); const pm = new THREE.InstancedMesh(pg, toonMat({ map: DECK }), PIERS.length);
    PIERS.forEach((p, i) => { M.compose(V.set((p.x0 + p.x1) / 2, (CURB + WY) / 2 + 0.4, (p.z0 + p.z1) / 2), Qn, Sx.set(p.x1 - p.x0, CURB - WY + 0.8, p.z1 - p.z0)); pm.setMatrixAt(i, M); pm.setColorAt(i, cc.set(i < 4 ? '#c8b8a0' : '#ffffff')); });
    pm.frustumCulled = false; sc.add(pm);
    const posts = []; PIERS.slice(4).forEach((p) => { for (let x = p.x0; x <= p.x1 + 0.01; x += (p.x1 - p.x0)) for (let z = p.z0; z <= p.z1; z += 4) posts.push([x, z]); });
    const qg = G.cyl(0.22, 0.22, 2.2, 6); bakeColor(qg, '#4a3a2a'); const qm = new THREE.InstancedMesh(qg, toonMat(), posts.length); posts.forEach(([x, z], i) => { M.makeTranslation(x, WY + 0.9, z); qm.setMatrixAt(i, M); }); qm.frustumCulled = false; sc.add(qm);
    const sk = []; for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; sk.push([Math.cos(a) * (150 + (k * 29) % 50), Math.sin(a) * (120 + (k * 41) % 40), 12 + (k * 53) % 45, 14 + (k % 3) * 9]); }
    const kg = G.box(1, 1, 1); kg.translate(0, 0.5, 0); bakeColor(kg, '#ffffff'); const km = new THREE.InstancedMesh(kg, toonMat(), sk.length);
    sk.forEach(([x, z, h, w], i) => { M.compose(V.set(x, WY, z), Qn, Sx.set(w, h, w)); km.setMatrixAt(i, M); km.setColorAt(i, cc.set(['#c8b8a8', '#a89888', '#d8c8b0', '#8a98a8'][i % 4])); }); km.frustumCulled = false; sc.add(km);
  }
  const bg = G.cyl(0.55, 0.95, 1.9, 8); bakeColor(bg, '#ffffff'); const BIM = new THREE.InstancedMesh(bg, toonMat(), BUOYS.length); BIM.frustumCulled = false; sc.add(BIM);
  const bl = G.sph(0.3, 0.3, 0.3, 6, 4); const BLM = new THREE.InstancedMesh(bl, basicSnap({ color: '#ffffff' }), BUOYS.length); BLM.frustumCulled = false; sc.add(BLM);
  { const cc = new THREE.Color(); BUOYS.forEach((b, i) => { BIM.setColorAt(i, cc.set(i % 2 ? '#e83a2a' : '#2a9a4a')); BLM.setColorAt(i, cc.set(i % 2 ? '#ff8a6a' : '#8aff9a')); }); }
  // splash waves (pooled: a curved foam crest + a darker trough each)
  const WAVES = []; for (let k = 0; k < 4; k++) { const g = new THREE.TorusGeometry(9, 0.45, 4, 18, 1.1); g.rotateX(Math.PI / 2); g.rotateY(0.55 - Math.PI / 2); g.translate(0, 0, -9); /* arc middle at the origin, ends curling back */ bakeColor(g, '#f4fbff'); const m = new THREE.Mesh(g, toonMat()); m.visible = false; m.frustumCulled = false; sc.add(m); WAVES.push({ m, on: false, x: 0, z: 0, dx: 0, dz: 0, t: 0, hit: false }); }
  const spray = rbSpray(sc, 120);
  const boatT = rbBuildTaxi(), boatP = rbBuildPaddle(); sc.add(boatT.root, boatP.root);
  const duch = rbBuildDuchessBoat(true); sc.add(duch.root); const rider = rbDuchessRider(duch);
  // ---- polish (hark/polish): tells you can read ("!" over her + marks on the water >= 1.1 s), Harold's cane combo on a dizzy Duchess, a POWER meter,
  // Mavis's crab cake + one second wind, a JUICE KO + star grade. The fight now runs on the DUELS core (09a) through src/09bd_duchess.js: DUELS HUD / RETRY card /
  // shared JUICE kit / CI runner. Without DUELS (never in this build) it still runs in the old RB mode.
  const TELL_SW = 1.1, TELL_WV = 1.15, BHP = 300, CANE = [6, 6, 12], CANE_W = ['WHACK!', 'THWACK!', 'ROYAL BONK!'];
  const bangT = canvasTex(128, 128, (g) => { g.fillStyle = '#ffd23c'; g.strokeStyle = '#14101f'; g.lineWidth = 8; g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 116); g.lineTo(6, 116); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d8262a'; g.font = '900 78px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 80); }, 128);
  const BANG = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangT, transparent: true, depthWrite: false, depthTest: false, fog: false })); BANG.scale.setScalar(2.2); BANG.visible = false; BANG.renderOrder = 6; sc.add(BANG);
  // sceptre reach: a red ring (+ a faint disc) on the water around her, radius = her swing reach (8 m)
  const RING = new THREE.Mesh(new THREE.RingGeometry(7.3, 8.1, 44).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide })); // (normal blend: reads RED on the blue water)
  const DISC = new THREE.Mesh(new THREE.CircleGeometry(7.3, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
  RING.renderOrder = DISC.renderOrder = 3; RING.visible = DISC.visible = false; sc.add(RING, DISC);
  // splash-wave lanes: a chevron strip on the water along each wave's path (from her bow out to ~38 m)
  const laneT = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,70,50,0.95)'); gr.addColorStop(1, 'rgba(255,70,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 6; for (let y = h - 20; y > 10; y -= 40) { g.beginPath(); g.moveTo(10, y); g.lineTo(w / 2, y - 18); g.lineTo(w - 10, y); g.stroke(); } }, 64);
  const LANES = []; for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(9, 34); g.rotateX(-Math.PI / 2); g.translate(0, 0, 21.6); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: laneT, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.renderOrder = 3; m.visible = false; sc.add(m); LANES.push(m); }
  const S = { on: false, phase: 'intro', t: 0, pt: 0, hits: 0, kind: 'taxi', shake: 0, hitstop: 0, duel: false, bot: null, bhp: BHP, pow: 0, combo: 0, comboT: 0, caneK: 0, caneCd: 0, caneT: 0, spT: -1, cakeUsed: false, cakeT: 0, windUsed: false, overShown: false, stats: null };
  const pl = { x: 0, z: 0, h: 0, vx: 0, vz: 0, y: 0, vy: 0, hull: 100, boost: 0, cd: 0, r: 1.6, inv: 0, swing: 0 };
  const du = { x: 0, z: 0, h: 0, vx: 0, vz: 0, st: 'stalk', stT: 0, r: 2.5, swingK: 0, rearK: 0, orbit: 1, wavesFired: 0, sink: 0, stun: 0 };
  const CI = { mx: 0, my: 0, a: false, b: false, c: false }; // this step's input (DUELS input in duel mode, IN / PRESS in the old RB mode)
  const _pv = new THREE.Vector3();
  const pv = (x, y, z) => _pv.set(x, y, z);
  const shout = (txt, t = 1.1, col) => { if (S.duel) DUELS.banner(txt, t); else RBH.shout(txt.replace(/<small>.*<\/small>/, ''), t, col); };
  const speak = (who, line, t) => { if (S.duel) DUELS.say(who, line, t); else RBH.speak(who, line, t); };
  const callout = (txt, t = 1.2) => { if (S.duel) DUELS.tell(txt, t); else RBH.setHint(txt); };
  const stop = (s) => { if (S.duel) DUELS.hitstop(s); else S.hitstop = Math.max(S.hitstop, s); };
  const popAt = (txt, x, y, z, cls) => { if (S.duel) DUELS.pop(txt, pv(x, y, z), cls); };
  function newStats() { return { hitsTaken: 0, canes: 0, maxCombo: 0, powers: 0, dodges: 0, heals: 0, winds: 0, t0: 0 }; }
  function reset() {
    S.phase = 'intro'; S.t = 0; S.pt = 0; S.hits = 0; S.said = false; spray.clear(); for (const w of WAVES) { w.on = false; w.m.visible = false; }
    const pb = S.kind === 'paddle'; Object.assign(pl, { x: -30, z: 20, h: Math.PI * 0.8, vx: 0, vz: 0, y: 0, vy: 0, hull: 100, boost: 0, cd: 0, r: pb ? 1.2 : 1.6, inv: 0, swing: 0 });
    Object.assign(du, { x: 10, z: -8, h: -Math.PI * 0.3, vx: 0, vz: 0, st: 'stalk', stT: 2.5, swingK: 0, rearK: 0, orbit: 1, wavesFired: 0, sink: 0, stun: 0, swung: false });
    Object.assign(S, { bhp: BHP, pow: S.pow * 0.5, combo: 0, comboT: 0, caneK: 0, caneCd: 0, caneT: 0, spT: -1, cakeUsed: false, cakeT: 0, overShown: false });
    BANG.visible = RING.visible = DISC.visible = false; for (const l of LANES) l.visible = false;
    RBH.setPips(0); RB.duStats = { hits: 0, rams: 0, knocks: 0, wavesHit: 0, swingsHit: 0, waves: 0, swings: 0, misses: 0 };
  }
  const myBoat = () => (S.kind === 'paddle' ? boatP : boatT);
  function ambushLine() { RBH.place(); RBH.el.classList.add('on'); RBH.name.textContent = ''; RBH.setHint(''); RBH.speak('DRAGON BOAT DUCHESS', rbPick(rbLines('dragon_boat_duchess').boat_ambush), 2.6); }
  function lend() { const deck = S.kind === 'paddle' ? 0.3 : 0.8; rbLend(myBoat().root, S.kind === 'paddle' ? [-0.42, deck, -0.5] : [-0.5, deck, 0.15], myBoat().root, S.kind === 'paddle' ? [0.42, deck, -0.5] : [0.5, deck, 0.15]); }
  function start(kind, opts = {}) {
    S.kind = kind === 'paddle' ? 'paddle' : 'taxi';
    // polish: the fight runs on the DUELS core when it is there (src/09bd_duchess.js registers the 'duchess' kind)
    if (typeof DUELS !== 'undefined' && DUELS.kinds.duchess && !DUELS.cur) { RBH.hide(); if (DUELS.start('duchess', { kind: S.kind, bot: opts.bot || RB.auto || null })) return; }
    S.duel = false; S.bot = null; S.stats = newStats(); S.pow = 0; S.windUsed = false; reset(); S.on = true; RB.mode = 'duchess';
    boatT.root.visible = S.kind === 'taxi'; boatP.root.visible = S.kind === 'paddle';
    rbEnterFight('DRAGON BOAT DUCHESS', TOUCH ? 'STICK steer · SWING ram-boost · JUMP hop waves' : DEV === 'pad' ? 'stick steer · X ram-boost · A hop' : 'A/D steer · W/S throttle · J ram-boost · K hop');
    lend(); rbLog('duchess start ' + S.kind); place(0);
  }
  function duelStart(K, opts = {}) { // called by DUELS.start through the 'duchess' kind
    S.duel = true; S.bot = DUELS.bot ? DUELS.bot.mode : null; S.stats = newStats(); S.pow = 0; S.windUsed = false; reset(); S.on = true; RB.mode = null; // (MODE.duel owns the frame now)
    if (opts.kind) S.kind = opts.kind === 'paddle' ? 'paddle' : 'taxi';
    boatT.root.visible = S.kind === 'taxi'; boatP.root.visible = S.kind === 'paddle'; lend();
    DUELS.banner('DRAGON BOAT DUCHESS<small>HARBOUR AMBUSH!</small>', 2.2); DUELS.sub('CRASHES 0/3', ''); DUELS.power(0, false, 'POWER'); DUELS.bars(1, 1);
    rbLog('duchess start ' + S.kind + ' (duel)'); place(0); syncK(K);
  }
  function exit(won) {
    S.on = false; if (!S.duel) rbLeaveFight(); BANG.visible = RING.visible = DISC.visible = false; rbLog('duchess exit ' + (won ? 'won' : 'quit'));
    if (RIDES.R.on) RIDES.resume(); else { RB.mode = null; rbReturnRigs(); }
  }
  function grade() { const h = S.stats.hitsTaken, g = h <= 3 ? 'S' : h <= 8 ? 'A' : 'B', stars = g === 'S' ? 3 : g === 'A' ? 2 : 1; return { g, stars, h }; }
  function win() {
    S.phase = 'won'; S.pt = 0; du.st = 'sink'; du.sink = 0.001; S.bhp = 0; S.spT = -1; speak('DRAGON BOAT DUCHESS', rbPick(rbLines('dragon_boat_duchess').defeat), 4.2); sfx('ko');
    if (S.duel) { // polish: one shared JUICE KO (final-blow replay), a big impact + slow-mo, then she sinks; the grade card follows
      JUICE.ko(new THREE.Vector3(du.x, WY + 2, du.z)); DUELS.impact({ stop: 0.14, shake: 1.2, flash: '#ffffff', flashA: 0.7, zoom: 1.2, zoomT: 0.6, sfx: 'mega', pop: 'K.O.!', pos: pv(du.x, WY + 4.5, du.z), cls: 'big' });
      DUELS.slowmo(0.35, 1.0); DUELS.banner('K.O.!<small>DUCHESS SUNK!</small>', 2.4); DUELS.combo(0); DUELS.ready(null); DUELS.hot(false);
    } else RBH.shout('DUCHESS SUNK!', 2.4, '#7dffc0');
    RB.duchessBeaten = true; try { localStorage.setItem(RB_LS, '1'); } catch (e) {}
    const d = { lm: null, boss: 'Dragon Boat Duchess', id: 'dragon_boat_duchess', roaming: true, first: true, city: BOSS_CLEAR.cityCrime(), at: +S.t.toFixed(1), mode: 'ram' };
    BOSS_CLEAR.log.push(d); for (const f of BOSS_CLEAR.fns) { try { f(d); } catch (e) { console.error(e); } } try { dispatchEvent(new CustomEvent('tcb:bossclear', { detail: d })); } catch (e) {}
    const G = grade(); rbLog('duchess WIN grade ' + G.g); if (S.duel) DUELS.log.push('duchess:win:' + G.g);
  }
  function lose() { S.phase = 'lost'; S.pt = 0; shout('SUNK!', 2, '#ff5f5f'); speak('DRAGON BOAT DUCHESS', 'Off with their boat! Ha!', 3); sfx('hurt'); rbLog('duchess LOSE'); if (S.duel) { DUELS.log.push('duchess:lose'); DUELS.ready(null); DUELS.hot(false); } }
  function addPow(v) { const was = S.pow >= 1; S.pow = clamp(S.pow + v, 0, 1); if (!was && S.pow >= 1) { callout('POWER FULL! ACT = DRAGON-SLAYER RAM', 1.4); if (S.duel) DUELS.hitSfx('power'); } }
  function dodged(txt, v = 0.12) { S.stats.dodges++; addPow(v); popAt(txt, pl.x, WY + 3, pl.z, 'word'); }
  // ---- physics helpers ----
  function hitObstacles(o, r, bounce) { // circle vs piers / buoys; returns what it hit (or null); pushes o out + reflects its velocity
    let hit = null;
    for (const p of PIERS) { const cx = clamp(o.x, p.x0, p.x1), cz = clamp(o.z, p.z0, p.z1), dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
      if (d < r) { const nx = d > 1e-4 ? dx / d : 0, nz = d > 1e-4 ? dz / d : 1; o.x = cx + nx * r; o.z = cz + nz * r; const vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= (1 + bounce) * vn * nx; o.vz -= (1 + bounce) * vn * nz; } hit = hit || { kind: 'pier', p, vn: -vn, x: cx, z: cz }; } }
    for (const b of BUOYS) { const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), rr = r + b.r;
      if (d < rr) { const nx = dx / (d || 1), nz = dz / (d || 1); o.x = b.x + nx * rr; o.z = b.z + nz * rr; const vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= (1 + bounce) * vn * nx; o.vz -= (1 + bounce) * vn * nz; } hit = hit || { kind: 'buoy', b, vn: -vn, x: b.x, z: b.z }; } }
    return hit;
  }
  function nearestObstacle(x, z) { let best = null, bd = 1e9; for (const p of PIERS) { const cx = clamp(x, p.x0, p.x1), cz = clamp(z, p.z0, p.z1), d = Math.hypot(x - cx, z - cz); if (d < bd) { bd = d; best = { x: cx, z: cz, d }; } }
    for (const b of BUOYS) { const d = Math.hypot(x - b.x, z - b.z) - b.r; if (d < bd) { bd = d; best = { x: b.x, z: b.z, d }; } } return best; }
  // the scripted pilot (?rbauto= / the DUELS bot): win = lines her up against a pier or buoy and rams, hops waves, canes her while she is dizzy, spends POWER;
  // mash = a first-timer: holds the stick at her and mashes SWING (no hops, no POWER); lose = reverses away and takes the hits
  function pilot(mode, o) {
    o.mx = 0; o.my = 0; o.a = o.b = o.c = false;
    if (mode === 'lose') { o.my = -1; return; }
    const dDu = Math.hypot(pl.x - du.x, pl.z - du.z);
    if (mode === 'mash') { const want = Math.atan2(du.x - pl.x, du.z - pl.z), d = angTo(pl.h, want); o.mx = clamp(-d * 2.2, -1, 1); o.my = 1; S.mashT = (S.mashT || 0) + 1; if (S.mashT % 7 === 0) o.a = true; return; }
    if (S.pow >= 1 && S.spT < 0 && du.st !== 'sink') { o.c = true; return; }
    if (du.st === 'stunned' && dDu < 8 && S.caneCd <= 0) { o.a = true; }
    // line up behind her, on the far side from the nearest obstacle, then charge through her toward it
    const ob = nearestObstacle(du.x, du.z); let tx = du.x, tz = du.z, charge = true;
    if (ob) { const ax = du.x - ob.x, az = du.z - ob.z, l = Math.hypot(ax, az) || 1; const bx = du.x + ax / l * 6, bz = du.z + az / l * 6;
      const dPl = Math.hypot(pl.x - bx, pl.z - bz);
      const aligned = ((du.x - pl.x) * -ax + (du.z - pl.z) * -az) / (l * (dDu || 1)) > 0.8;
      if (!aligned && dPl > 2.5) { tx = bx; tz = bz; charge = false; } }
    const want = Math.atan2(tx - pl.x, tz - pl.z), d = angTo(pl.h, want); o.mx = clamp(-d * 2.2, -1, 1); o.my = Math.abs(d) > 1.6 ? -0.2 : 1;
    if (charge && du.st !== 'stunned' && Math.abs(d) < 0.3 && dDu < 12 && pl.cd <= 0) o.a = true;
    for (const w of WAVES) if (w.on && !w.hit) { const rx = pl.x - w.x, rz = pl.z - w.z, along = rx * w.dx + rz * w.dz; if (along > 0 && along < 5) o.b = true; }
    if (du.st === 'swingTell' && dDu < 9.5) { o.mx = clamp(-angTo(pl.h, Math.atan2(pl.x - du.x, pl.z - du.z)) * 2.2, -1, 1); o.my = 1; o.a = false; } // steer out of the red ring
  }
  function autoPilot() { pilot(RB.auto === 'win' ? 'win' : RB.auto, CI); IN.mx = CI.mx; IN.my = CI.my; }
  function simPlayer(dt) {
    const pb = S.kind === 'paddle', top = pb ? 11.5 : 13.5;
    pl.cd -= dt; pl.boost -= dt; pl.inv -= dt; S.caneCd -= dt; S.caneT -= dt; S.comboT -= dt; if (S.comboT <= 0 && S.combo) { S.combo = 0; if (S.duel) DUELS.combo(0); }
    const dDu = Math.hypot(du.x - pl.x, du.z - pl.z);
    // POWER: DRAGON-SLAYER RAM (Mavis floors it; she freezes, Harold homes in, and the hit sends her into the nearest pier / buoy)
    if (CI.c && S.pow >= 1 && S.spT < 0 && du.st !== 'sink') { S.spT = 0; S.pow = 0; S.stats.powers++; du.st = 'stunned'; du.stT = 2.2; pl.inv = 2.6;
      shout('DRAGON-SLAYER RAM!<small>MAVIS FLOORS IT</small>', 1.6, '#ffd23c'); speak('MAVIS', 'Hold your hat, Harold!', 1.6);
      if (S.duel) { DUELS.slowmo(0.55, 0.7); DUELS.hitSfx('power'); DUELS.flash('#ffd23c', 0.45); } }
    else if (CI.c && S.pow < 1 && S.duel && S.caneCd <= 0) { callout('NEED POWER: CANE HER + DODGE', 0.9); S.caneCd = 0.3; }
    // SWING: the cane when she is dizzy and alongside, else the ram boost
    if (CI.a && S.spT < 0) {
      if (du.st === 'stunned' && dDu < 8.5) { if (S.caneCd <= 0) cane(); }
      else if (pl.cd <= 0) { pl.boost = 0.9; pl.cd = 2.4; sfx('swing'); if (S.duel) { DUELS.hitSfx('whoosh'); popAt('RAM!', pl.x, WY + 3, pl.z, 'word'); } else RBH.shout('RAM!', 0.5, '#7de8ff'); }
    }
    if (CI.b && pl.y <= 0.001) { pl.vy = 6.2; sfx('jump'); }
    pl.vy -= 20 * dt; pl.y = Math.max(0, pl.y + pl.vy * dt); if (pl.y === 0) { if (pl.vy < -4) spray.burst(pl.x, WY + 0.3, pl.z, '#e8f8ff', 8, 3, 4); pl.vy = 0; }
    const sp = Math.hypot(pl.vx, pl.vz);
    if (S.spT >= 0) { // the special: auto-steer onto her at full tilt
      S.spT += dt; pl.h += angTo(pl.h, Math.atan2(du.x - pl.x, du.z - pl.z)) * Math.min(1, dt * 8); pl.vx = damp(pl.vx, Math.sin(pl.h) * 24, 6, dt); pl.vz = damp(pl.vz, Math.cos(pl.h) * 24, 6, dt);
      if (Math.random() < dt * 30) spray.burst(pl.x, WY + 0.4, pl.z, '#ffd23c', 3, 3, 3);
      if (S.spT > 2.2) S.spT = -1;
    } else {
      pl.h -= CI.mx * dt * 2.0 * (0.45 + 0.55 * Math.min(1, sp / 6));
      const thr = pl.boost > 0 ? 1.7 : clamp(0.62 + CI.my * 0.5, -0.4, 1.12), fx = Math.sin(pl.h), fz = Math.cos(pl.h), grip = pl.boost > 0 ? 4 : 2.1;
      pl.vx = damp(pl.vx, fx * top * thr, grip, dt); pl.vz = damp(pl.vz, fz * top * thr, grip, dt);
    }
    pl.x += pl.vx * dt; pl.z += pl.vz * dt;
    const h = hitObstacles(pl, pl.r, 0.4); if (h && h.vn > 5) { pl.hull -= Math.min(8, h.vn * 0.4); S.shake = 0.35; spray.burst(pl.x, WY + 0.6, pl.z, '#e8f8ff', 8, 3, 4); sfx('hit'); }
  }
  // Harold leans out with the cane: a 3-hit combo (WHACK, THWACK, ROYAL BONK finisher) on a dizzy Duchess; chips her bar, fills POWER, keeps her dizzy a moment longer
  function cane() {
    const k = S.comboT > 0 ? (S.caneK + 1) % 3 : 0; S.caneK = k; S.caneCd = k === 2 ? 0.42 : 0.24; S.caneT = 0.32; pl.swing = 1; S.combo++; S.comboT = 1.3; S.stats.canes++; S.stats.maxCombo = Math.max(S.stats.maxCombo, S.combo);
    const floor = BHP - 100 * (S.hits + 1) + 6, dmg = CANE[k]; S.bhp = Math.max(floor, S.bhp - dmg); du.stT = Math.min(du.stT + 0.18, 2.4); addPow(k === 2 ? 0.2 : 0.1);
    spray.burst(du.x, WY + 2.2, du.z, '#ffd23c', k === 2 ? 22 : 10, 5, 6); S.shake = Math.max(S.shake, k === 2 ? 0.5 : 0.25); sfx(k === 2 ? 'heavy' : 'hit');
    if (S.duel) { DUELS.impact({ stop: k === 2 ? 0.1 : 0.06, shake: k === 2 ? 0.55 : 0.25, sfx: k === 2 ? 'heavy' : 'light', pop: CANE_W[k] + ' ' + dmg, pos: pv(du.x, WY + 3.4, du.z), cls: k === 2 ? 'big' : 'crit' });
      if (k === 2) DUELS.flash('#ffffff', 0.35); DUELS.combo(S.combo); }
    else S.hitstop = Math.max(S.hitstop, k === 2 ? 0.1 : 0.06);
  }
  function damage(n, nx, nz, why) { if (pl.inv > 0 || pl.y > 0.35 || S.spT >= 0) return false; pl.hull -= n; pl.inv = 0.8; pl.vx += nx * 11; pl.vz += nz * 11; S.shake = 0.6; stop(0.08); S.combo = 0; S.stats.hitsTaken++;
    spray.burst(pl.x, WY + 0.8, pl.z, '#e8f8ff', 22, 5, 7); sfx('hurt');
    if (S.duel) { DUELS.hurt(); DUELS.combo(0); popAt('-' + n, pl.x, WY + 2.6, pl.z, ''); DUELS.tell(why, 0.8); } else RBH.shout(why, 0.8, '#ff5f5f');
    if (pl.hull < 35 && pl.hull > 0 && !S.cakeUsed) { S.cakeUsed = true; S.cakeT = 0.9; } // Mavis's crab cake (once a try)
    return true; }
  function simDuchess(dt) {
    du.stT -= dt; du.swingK = Math.max(0, du.swingK - dt * 2); const dx = pl.x - du.x, dz = pl.z - du.z, dist = Math.hypot(dx, dz), bear = Math.atan2(dx, dz);
    if (du.st === 'stalk') {
      const want = 13 - S.hits, tang = du.orbit, nx = dx / (dist || 1), nz = dz / (dist || 1);
      const vx = (-nz * tang) * 8.5 + nx * (dist - want) * 0.9, vz = (nx * tang) * 8.5 + nz * (dist - want) * 0.9;
      du.vx = damp(du.vx, vx, 1.6, dt); du.vz = damp(du.vz, vz, 1.6, dt); du.h += angTo(du.h, Math.atan2(du.vx, du.vz)) * (1 - Math.exp(-dt * 3));
      if (du.stT <= 0) { if (dist < 9) { du.st = 'swingTell'; du.stT = TELL_SW; RB.duStats.swings++; callout('! SCEPTRE SWING! STEER OUT OF THE RED RING!', TELL_SW); }
        else { du.st = 'waveTell'; du.stT = TELL_WV; RB.duStats.waves++; callout('! SPLASH WAVE! JUMP TO HOP IT!', TELL_WV); } if (S.duel) DUELS.hitSfx('whoosh'); }
      if (Math.random() < dt * 0.15) du.orbit *= -1;
    } else if (du.st === 'swingTell') { du.vx = damp(du.vx, dx / (dist || 1) * 4, 2, dt); du.vz = damp(du.vz, dz / (dist || 1) * 4, 2, dt); du.h += angTo(du.h, bear) * (1 - Math.exp(-dt * 5)); du.swingK = 0;
      if (du.stT <= 0) { du.st = 'swing'; du.stT = 0.4; du.swung = false; sfx('swing'); }
    } else if (du.st === 'swing') { du.swingK = 1; if (!du.swung && dist < 8 && Math.abs(angTo(du.h, bear)) < 1.5) { du.swung = true; if (damage(14, dx / (dist || 1), dz / (dist || 1), 'SCEPTRE!')) RB.duStats.swingsHit++; }
      if (du.stT <= 0) { if (!du.swung && dist < 16 && S.phase === 'fight') dodged('DODGED!'); du.st = 'stalk'; du.stT = rnd(1.6, 2.6) - S.hits * 0.3; du.swung = false; }
    } else if (du.st === 'waveTell') { du.vx = damp(du.vx, 0, 2, dt); du.vz = damp(du.vz, 0, 2, dt); du.h += angTo(du.h, bear) * (1 - Math.exp(-dt * 4)); du.rearK = Math.min(1, du.rearK + dt * 2.5);
      if (du.stT <= 0) { const n = S.hits >= 1 ? 3 : 1; for (let k = 0; k < n; k++) fireWave(du.h + (k - (n - 1) / 2) * 0.55); du.st = 'stalk'; du.stT = rnd(2.0, 3.0) - S.hits * 0.3; }
    } else if (du.st === 'knocked') { du.vx = damp(du.vx, 0, 1.0, dt); du.vz = damp(du.vz, 0, 1.0, dt); du.h += dt * 3;
      if (du.stT <= 0 || Math.hypot(du.vx, du.vz) < 2.5) { du.st = 'stalk'; du.stT = 1.2; RB.duStats.misses++; if (RB.duStats.misses % 2 === 1) callout('KNOCK HER INTO A PIER OR A BUOY!', 1.6); }
    } else if (du.st === 'stunned') { du.vx = damp(du.vx, 0, 3, dt); du.vz = damp(du.vz, 0, 3, dt); du.h += dt * 5; if (du.stT <= 0) { du.st = 'stalk'; du.stT = 1.0; } }
    else if (du.st === 'sink') { du.vx = damp(du.vx, 0, 2, dt); du.vz = damp(du.vz, 0, 2, dt); du.sink += dt; }
    if (du.st !== 'waveTell') du.rearK = Math.max(0, du.rearK - dt * 2);
    du.x += du.vx * dt; du.z += du.vz * dt;
    const knocked = du.st === 'knocked', vBefore = Math.hypot(du.vx, du.vz);
    const h = hitObstacles(du, du.r, knocked ? 0.5 : 0.2);
    if (h && knocked && vBefore > 3.5) { // CRASH: the hit that counts
      S.hits++; RB.duStats.hits = S.hits; du.st = 'stunned'; du.stT = 2.2; RBH.setPips(S.hits); S.shake = 0.9; if (h.b) h.b.hitT = 1; S.bhp = Math.min(S.bhp, BHP - 100 * S.hits); addPow(0.15);
      spray.burst(du.x, WY + 1, du.z, '#ffc83a', 18, 6, 7); spray.burst(du.x, WY + 0.6, du.z, '#e8f8ff', 26, 6, 8); sfx('heavy'); rbLog('duchess CRASH ' + h.kind + ' ' + S.hits);
      if (S.hits >= 3) win(); else {
        stop(0.15); if (S.duel) DUELS.impact({ shake: 0.8, sfx: 'mega', flash: '#ffffff', flashA: 0.3 });
        shout((h.kind === 'buoy' ? 'BUOY BONK! ' : 'PIER SMASH! ') + S.hits + '/3', 1.2);
        if (S.hits === 2) speak('DRAGON BOAT DUCHESS', 'My hull! Do you know what dragon scales COST?', 2.6); }
    }
    // the player rams her
    const rx = du.x - pl.x, rz = du.z - pl.z, rd = Math.hypot(rx, rz);
    if (rd < du.r + pl.r + (S.spT >= 0 ? 0.6 : 0)) { const nx = rx / (rd || 1), nz = rz / (rd || 1), rel = (pl.vx - du.vx) * nx + (pl.vz - du.vz) * nz;
      const push = Math.max(0, du.r + pl.r - rd); pl.x -= nx * push * 0.6; pl.z -= nz * push * 0.6; du.x += nx * push * 0.4; du.z += nz * push * 0.4;
      if (S.spT >= 0 && du.st !== 'sink') { // the DRAGON-SLAYER RAM lands: aimed at the nearest pier / buoy
        const ob = nearestObstacle(du.x, du.z); let ax = nx, az = nz; if (ob) { const l = Math.hypot(ob.x - du.x, ob.z - du.z) || 1; ax = (ob.x - du.x) / l; az = (ob.z - du.z) / l; }
        du.vx = ax * 30; du.vz = az * 30; du.st = 'knocked'; du.stT = 2.5; S.spT = -1; RB.duStats.knocks++; pl.vx *= 0.2; pl.vz *= 0.2; pl.swing = 1; S.shake = 0.8;
        spray.burst(du.x, WY + 1.2, du.z, '#ffd23c', 30, 7, 8); sfx('heavy'); rbLog('duchess SLAYER ram');
        if (S.duel) DUELS.impact({ stop: 0.12, shake: 0.9, flash: '#ffd23c', flashA: 0.5, sfx: 'mega', pop: 'SLAYER RAM!', pos: pv(du.x, WY + 4, du.z), cls: 'big' }); }
      else if (rel > 3 && du.st !== 'sink' && du.st !== 'stunned') { const k = 6 + rel * 1.25 + (pl.boost > 0 ? 6 : 0); du.vx = nx * k; du.vz = nz * k; du.st = 'knocked'; du.stT = 2.0; RB.duStats.knocks++; addPow(0.08);
        pl.vx -= nx * rel * 0.7; pl.vz -= nz * rel * 0.7; pl.boost = 0; pl.swing = 1; S.shake = 0.45; spray.burst((pl.x + du.x) / 2, WY + 0.8, (pl.z + du.z) / 2, '#e8f8ff', 14, 5, 5); sfx('hit'); rbLog('duchess knock ' + k.toFixed(1));
        if (S.duel) DUELS.impact({ stop: 0.05, shake: 0.35, sfx: 'heavy', pop: 'RAMMED!', pos: pv(du.x, WY + 3.6, du.z), cls: 'word' }); }
      else if (rel > 0) { pl.vx -= nx * rel; pl.vz -= nz * rel; } }
  }
  function fireWave(ang) { const w = WAVES.find((q) => !q.on); if (!w) return; Object.assign(w, { on: true, x: du.x + Math.sin(du.h) * 4.6, z: du.z + Math.cos(du.h) * 4.6, dx: Math.sin(ang), dz: Math.cos(ang), t: 0, hit: false }); w.m.visible = true; sfx('heavy');
    spray.burst(w.x, WY + 0.5, w.z, '#e8f8ff', 16, 4, 6); }
  function simWaves(dt) {
    for (const w of WAVES) { if (!w.on) continue; w.t += dt; const sp = 15; w.x += w.dx * sp * dt; w.z += w.dz * sp * dt;
      const rx = pl.x - w.x, rz = pl.z - w.z, along = rx * w.dx + rz * w.dz, lat = Math.abs(rx * w.dz - rz * w.dx);
      if (!w.hit && Math.abs(along + 9 * (1 - Math.cos(Math.min(lat / 9, 0.55)))) < 1.3 && lat < 5) { w.hit = true; if (pl.y > 0.35 && S.phase === 'fight') dodged('HOPPED!', 0.15); else if (damage(12, w.dx, w.dz, 'SPLASH WAVE!')) RB.duStats.wavesHit++; }
      if (w.t > 2.6) { w.on = false; w.m.visible = false; } }
  }
  function readCI(I) { // this step's input: the DUELS snapshot (keys / panel / pad / bot) or, in the old RB mode, IN + PRESS
    if (I) { CI.mx = I.mx + (I.rh ? 1 : 0) - (I.lh ? 1 : 0); CI.mx = clamp(CI.mx, -1, 1); CI.my = I.my; CI.a = !!I.a; CI.b = !!I.b; CI.c = !!I.c; return; }
    CI.mx = IN.mx; CI.my = IN.my; CI.a = rbBoost(); CI.b = rbHop(); CI.c = false;
  }
  function step(dt, I) {
    S.t += dt; S.pt += dt; const P = S.phase;
    if (P === 'intro') { readCI(I); if (S.pt > 0.3 && !S.said) { S.said = true; speak('DRAGON BOAT DUCHESS', rbPick(rbLines('dragon_boat_duchess').intro), 3.2); }
      if (S.pt > 3.4 || (S.pt > 0.8 && (CI.a || CI.b || CI.c || PRESS.has('k') || RB.auto || S.bot))) { S.phase = 'fight'; S.pt = 0; S.stats.t0 = S.t; shout('RAM HER!<small>INTO A PIER OR A BUOY · 3 CRASHES</small>', 1.4); if (!S.duel) RBH.setHint('KNOCK HER INTO PIERS + BUOYS 3 TIMES · HOP THE SPLASH WAVES'); } }
    else if (P === 'fight') { if (I && S.bot) readCI(I); else if (I) readCI(I); else { readCI(null); if (RB.auto) autoPilot(); }
      simPlayer(dt); simDuchess(dt); simWaves(dt);
      if (S.cakeT > 0 && (S.cakeT -= dt) <= 0) { const heal = Math.min(30, 100 - pl.hull); pl.hull += heal; S.stats.heals++; speak('MAVIS', rbPick(['Crab cake, Harold! Eat it while you steer!', 'Here, hon! Fresh from the cooler!', 'Patch the hull later, eat this now!']), 2.2); popAt('+' + Math.round(heal) + ' CRAB CAKE', pl.x, WY + 3.2, pl.z, 'heal'); sfx('jump'); }
      if (pl.hull <= 0) { if (S.duel && !S.windUsed) { S.windUsed = true; S.stats.winds++; pl.hull = 40; pl.inv = 2.2; DUELS.banner('SECOND WIND!<small>MAVIS BAILS OUT THE BOAT</small>', 1.8); DUELS.say('MAVIS', 'Bail, Harold, BAIL! We are not sinking today!', 2.4); DUELS.flash('#9dff6b', 0.45); }
        else { pl.hull = 0; lose(); } } }
    else if (P === 'won') { simDuchess(dt); pl.vx = damp(pl.vx, 0, 1, dt); pl.vz = damp(pl.vz, 0, 1, dt); pl.x += pl.vx * dt; pl.z += pl.vz * dt;
      if (S.duel) { if (S.pt > 3.0 && !S.overShown) { S.overShown = true; const G = grade();
          DUELS.over('win', 'DRAGON BOAT<br>DUCHESS SUNK!', '<span style="color:#ffd23c;font-size:18px;letter-spacing:3px">' + '\u2605'.repeat(G.stars) + '<span style="opacity:.3">' + '\u2605'.repeat(3 - G.stars) + '</span></span><br>GRADE ' + G.g + ' · hits taken ' + G.h + ' · best cane combo x' + S.stats.maxCombo + '<br>The harbour is safe. The boat ride carries on.'); } }
      else if (S.pt > 4.5 || (S.pt > 1.5 && (PRESS.has('j') || PRESS.has('k') || PRESS.has('e')))) { exit(true); return; } }
    else if (P === 'lost') { pl.vx = damp(pl.vx, 0, 2, dt); pl.vz = damp(pl.vz, 0, 2, dt);
      if (S.pt > 1.8) { S.phase = 'retry';
        if (S.duel) DUELS.over('lose', 'SUNK!', 'The Duchess sank your boat (crashes ' + S.hits + ' / 3). Retry with a fresh hull.');
        else RBH.showRetry('THE DUCHESS SANK YOU<br><span style="font-size:11px;color:#fff">crashes ' + S.hits + ' / 3</span>'); } }
    else if (P === 'retry' && !S.duel) { const c = RB.auto ? (RB.autoQuit ? 'quit' : null) : rbRetryInput();
      if (c === 'retry') { RBH.retry.classList.remove('on'); reset(); RB.duStats.retries = (RB.duStats.retries || 0) + 1; rbLog('duchess retry'); } else if (c === 'quit') { exit(false); return; } }
    for (const b of BUOYS) { b.hitT = Math.max(0, b.hitT - dt); }
    pl.swing = Math.max(0, pl.swing - dt * 1.6); spray.tick(dt, WY + 0.1);
  }
  function duelRetry() { const st = S.stats; reset(); S.stats = st; S.phase = 'fight'; S.pt = 0; DUELS.banner('ROUND AGAIN!<small>FRESH HULL · SHE\'S BACK TO FULL</small>', 1.6); RB.duStats.retries = (RB.duStats.retries || 0) + 1; rbLog('duchess retry'); }
  const camP = new THREE.Vector3(30, 10, 40), camL = new THREE.Vector3(), _M = new THREE.Matrix4(), _V = new THREE.Vector3(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _S1 = new THREE.Vector3(1, 1, 1), _S0 = new THREE.Vector3(0.001, 0.001, 0.001);
  function place(dt) {
    const B = myBoat().root; B.position.set(pl.x, WY - 0.05 + pl.y + Math.sin(S.t * 2) * 0.05 - (S.phase === 'lost' || S.phase === 'retry' ? Math.min(1.2, S.pt * 0.8) : 0), pl.z);
    B.rotation.set(-pl.vy * 0.03 + Math.sin(S.t * 1.7) * 0.02, pl.h, -CI.mx * 0.06 + Math.sin(S.t * 1.3) * 0.03); if (myBoat().wheel) myBoat().wheel.rotation.x += dt * (3 + Math.hypot(pl.vx, pl.vz));
    const D = duch.root; D.position.set(du.x, WY - 0.05 - (du.sink > 0 ? Math.min(3, du.sink * 0.7) : 0) + Math.sin(S.t * 1.6) * 0.06, du.z);
    D.rotation.set(du.sink > 0 ? -Math.min(0.5, du.sink * 0.25) : 0, du.h, du.sink > 0 ? Math.min(1.1, du.sink * 0.5) : du.st === 'stunned' ? Math.sin(S.t * 14) * 0.08 : 0);
    for (const w of duch.wheels) w.rotation.x += dt * (2 + Math.hypot(du.vx, du.vz) * 0.8);
    duch.neck.rotation.x = -0.55 * du.rearK + Math.sin(S.t * 1.4) * 0.06; duch.head.rotation.x = 0.4 * du.rearK; duch.tail.rotation.y = Math.sin(S.t * 1.8) * 0.3;
    if (duch.arm) { const tell = du.st === 'swingTell' ? Math.min(1, (TELL_SW - du.stT) / 0.6) : 0; duch.arm.rotation.x = -2.8 * tell - (du.swingK > 0 ? lerp(2.8, -0.6, 1 - du.swingK) : 0) * (du.st === 'swing' ? 1 : 0); duch.arm.rotation.z = du.st === 'swing' ? -1.4 * (1 - du.swingK) : 0.2;
      duch.sceptreGlow.scale.setScalar(1 + tell * 1.6 + Math.sin(S.t * 20) * 0.15 * tell); duch.duch.rotation.y = du.st === 'swing' ? -1.2 * (1 - du.swingK) : 0; }
    if (rider && rider.upd) rider.upd(dt, { t: S.t, state: du.st, swingK: du.swingK, rearK: du.rearK });
    for (const w of WAVES) if (w.on) { w.m.position.set(w.x, WY + 0.15, w.z); w.m.rotation.y = Math.atan2(w.dx, w.dz); w.m.scale.set(1, 1 + Math.sin(w.t * 9) * 0.25, 1); }
    // polish: tells. "!" over her (bobbing), the red reach ring for the sceptre, chevron lanes on the water for the splash waves
    const swT = du.st === 'swingTell' || (du.st === 'swing' && du.stT > 0.15), wvT = du.st === 'waveTell', tellOn = (du.st === 'swingTell' || wvT) && S.phase === 'fight';
    BANG.visible = tellOn; if (tellOn) { BANG.position.set(du.x, WY + 6.4 + Math.abs(Math.sin(S.t * 8)) * 0.4, du.z); BANG.scale.setScalar(2.2 + 0.35 * Math.abs(Math.sin(S.t * 12))); }
    const pulse = 0.55 + 0.35 * Math.sin(S.t * 22);
    RING.visible = DISC.visible = swT && S.phase === 'fight'; if (RING.visible) { const u = du.st === 'swing' ? 1 : clamp((TELL_SW - du.stT) / TELL_SW, 0, 1); RING.position.set(du.x, WY + 0.09, du.z); DISC.position.set(du.x, WY + 0.07, du.z); RING.material.opacity = (0.35 + 0.55 * u) * pulse + 0.1; DISC.material.opacity = 0.08 + 0.16 * u; RING.rotation.y += dt * 1.5; }
    const nW = wvT && S.phase === 'fight' ? (S.hits >= 1 ? 3 : 1) : 0;
    LANES.forEach((l, k) => { l.visible = k < nW; if (!l.visible) return; const a = du.h + (k - (nW - 1) / 2) * 0.55, u = clamp((TELL_WV - du.stT) / TELL_WV, 0, 1); l.position.set(du.x, WY + 0.08 + k * 0.004, du.z); l.rotation.y = a; l.material.opacity = (0.2 + 0.45 * u) * pulse + 0.05; });
    applyPose(hero.J, S.caneT > 0 ? rbSwingPose(1 - S.caneT / 0.32) : rbSeatPose(S.kind === 'paddle', S.t), 14, Math.max(dt, 1 / 60)); applyPose(partner.J, pl.swing > 0 && S.caneT <= 0 ? rbSwingPose(1 - pl.swing) : rbSeatPose(false, S.t + 1), 12, Math.max(dt, 1 / 60));
    // camera: behind the boat, yawed partway toward the Duchess so she stays in frame
    const portrait = rbPortrait(), back = portrait ? 10.5 : 9.0, hgt = (S.kind === 'paddle' ? 1.7 : 1.95) + (portrait ? 0.25 : 0); // just under the canopy line, so the toads show
    let yaw = pl.h; const bear = Math.atan2(du.x - pl.x, du.z - pl.z), dd = Math.hypot(du.x - pl.x, du.z - pl.z); if (dd < 45) yaw += angTo(yaw, bear) * 0.45;
    let tx = pl.x - Math.sin(yaw) * back, tz = pl.z - Math.cos(yaw) * back, ty = hgt, lx = pl.x + Math.sin(yaw) * 8, lz = pl.z + Math.cos(yaw) * 8, ly = 0.7;
    if (S.phase === 'intro') { const a = du.h + 2.4 - S.pt * 0.3; tx = du.x + Math.sin(a) * 13; tz = du.z + Math.cos(a) * 13; ty = 4.5; lx = du.x; lz = du.z; ly = 2.2; }
    if (S.phase === 'won') { const a = du.h + 1.2 + S.pt * 0.25; tx = du.x + Math.sin(a) * 15; tz = du.z + Math.cos(a) * 15; ty = 5; lx = du.x; lz = du.z; ly = 1.2; } // polish: hold on her as she sinks
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * 4);
    camP.x += (tx - camP.x) * k; camP.y += (ty - camP.y) * k; camP.z += (tz - camP.z) * k; camL.x += (lx - camL.x) * k; camL.y += (ly - camL.y) * k; camL.z += (lz - camL.z) * k;
    S.shake = Math.max(0, S.shake - dt * 1.8); const sh = S.shake * 0.35; cam.position.set(camP.x + rnd(-sh, sh), camP.y + rnd(-sh, sh), camP.z + rnd(-sh, sh)); cam.lookAt(camL);
    cam.fov = portrait ? 70 : 60; cam.updateProjectionMatrix();
    for (const b of BUOYS) { const y = WY + 0.55 + Math.sin(S.t * 1.8 + b.i) * 0.12, tilt = b.hitT * 0.5 * Math.sin(S.t * 25);
      const near = Math.hypot(b.x - cam.position.x, b.z - cam.position.z) < 6.5, sc1 = near ? _S0 : _S1; /* a buoy right at the lens is hidden */ _M.compose(_V.set(b.x, y, b.z), _Q.setFromEuler(_E.set(tilt, 0, tilt)), sc1); BIM.setMatrixAt(b.i, _M); _M.compose(_V.set(b.x, y + 1.15, b.z), _Q.identity(), sc1); BLM.setMatrixAt(b.i, _M); }
    BIM.instanceMatrix.needsUpdate = BLM.instanceMatrix.needsUpdate = true;
    if (S.duel) return; // (the DUELS HUD is fed from duelStep)
    RBH.setClock(''); RBH.setBar(pl.hull / 100, pl.hull > 40 ? '#7dffc0' : '#ff5f5f', 'HULL ' + Math.ceil(pl.hull) + '%   ' + (pl.cd <= 0 ? 'RAM READY' : ''));
    if (APANEL) APANEL.setAct({ kind: 'power', label: 'RAM', ready: pl.cd <= 0 }, pl.cd <= 0 ? 1 : 1 - pl.cd / 2.4);
  }
  function frame(rdt) { // the old RB-mode loop (unused while the DUELS kind is registered)
    const steps = RB.freeze ? 0 : SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) { if (k > 0) readInput(); let dt = SIM ? 1 / 60 : rdt; if (S.hitstop > 0) { S.hitstop -= dt; dt *= 0.1; } RB.t += dt; step(dt); if (!S.on) return; if (k < steps - 1) { place(dt); PRESS.clear(); } }
    place(steps ? (SIM ? 1 / 60 : rdt) : 0); RBH.tick(SIM ? rdt * SIM : rdt); PRESS.clear(); rbDraw(sc, cam);
  }
  // ---- the DUELS side (src/09bd_duchess.js wires these into the 'duchess' kind) ----
  function syncK(K) { const s = K.st; s.hp = pl.hull; s.bhp = S.bhp; s.phase = S.hits; s.over = S.phase === 'lost' || S.phase === 'retry' || S.phase === 'won'; s.won = S.phase === 'won'; }
  function duelStep(dt, I, K) {
    RB.t += dt; step(dt, I); if (!S.on) return;
    DUELS.bars(pl.hull / 100, S.bhp / BHP); DUELS.sub('CRASHES ' + S.hits + '/3' + (S.combo > 1 ? ' <span style="color:#ffd23c">x' + S.combo + '</span>' : ''), S.kind === 'paddle' ? 'PADDLE BOAT' : 'WATER TAXI');
    const rdy = S.pow >= 1 && S.phase === 'fight' && S.spT < 0; DUELS.power(S.pow, rdy, rdy ? 'POWER READY! ACT' : 'POWER'); DUELS.hot(rdy);
    const near = du.st === 'stunned' && S.phase === 'fight' && S.spT < 0 && Math.hypot(du.x - pl.x, du.z - pl.z) < 8.5; DUELS.ready(near ? 'SWING = CANE HER!' : null);
    syncK(K);
  }
  function duelRender(rdt, K) { place(rdt > 0 ? Math.min(0.05, rdt * (SIM || 1)) : 1e-4); OUT_U.fogC.value.copy(sc.fog.color); OUT_U.fogN.value = sc.fog.near; OUT_U.fogF.value = sc.fog.far; cam.aspect = VW() / VH(); cam.updateProjectionMatrix(); }
  function duelBot(B, dt) { if (S.phase !== 'fight') { B.a = B.b = B.c = false; B.mx = B.my = 0; return; } const o = {}; pilot(B.mode === 'mash' ? 'mash' : B.mode === 'lose' ? 'lose' : 'win', o); B.mx = o.mx; B.my = o.my; if (o.a) B.a = true; if (o.b) B.b = true; if (o.c) B.c = true; }
  return { S, pl, du, start, exit, frame, ambushLine, PIERS, BUOYS, WAVES, sc, cam, duch, rider: () => rider, place, reset, camL, duelStart, duelStep, duelRender, duelRetry, duelBot, BANG, RING, LANES };
})();

RB.frame = (rdt) => { if (RB.mode === 'al') AL.frame(rdt); else if (RB.mode === 'duchess') DUCH.frame(rdt); else if (RB.mode === 'ride') RIDES.frame(rdt); };
Object.assign(RB, { AL, DUCH, RIDES, CITYAL, BOSS_CLEAR, rbDuchessBeaten });


// ======================= COUCH CO-OP: Player 2 drives MAVIS (COOP_PLAN.md) =======================
// Drop-in: P1 = keyboard + touch + the first pad that sends input (sticky); any OTHER pad pressing Start or A joins as P2 (Mavis's AI
// switches off, the pad drives her). Keyboard / touch P1 + one pad: Start on the pad joins it as P2. P2 leaves: pad unplugged, or hold Start 3 s.
// Camera: one SHARED view framing both while together (pulls back + tilts as they spread, max MAXSEP apart); a toad walking away at the edge is
// HELD there. Only an INTENTIONAL leave splits: in 'move', at the edge, stick held away from the partner for SPLIT_T (2 s) continuously
// (0.15 s jitter grace; hits, jumps, swings, cinematics, letting go all reset it). Split = two views (side by side in landscape, stacked in
// portrait), same world. Back within MERGE_D on the same level for 0.4 s = smooth merge. Bosses / minigames (own-scene modes) = TURN ROTATION:
// P1's pad only while P1 plays; on exit a P2'S TURN card (P2: A play / B skip) replays the same ring with P2's pad.
// With no second pad COOP.on stays false and every call site in 06_game / 07_main takes its original path.
const COOP = (function () {
  const C = { on: false, p1: null, p2: null, kbUsed: false, prevR: {}, prev2: [], split: false, k: 0, edgeT: 0, edgeWho: null, graceT: 0, mergeT: 0, levelT: 0, farT: 0, koT: 0,
    leaveT: 0, turn: 0, mode: null, modeAct: null, lastAct: null, lastActT: -1e9, card: null, cardT: 0, log: [], splits: 0, merges: 0, holds: 0, joins: 0, turns: 0, draws2: 0 };
  const SPLIT_T = 2.0, GRACE = 0.15;
  const portraitNow = () => VW() / VH() < 1 / 1.15;
  const MAXSEP = () => (portraitNow() ? 10 : 13), MERGE_D = () => (portraitNow() ? 7.5 : 9);
  const IN2 = { mx: 0, my: 0, look: 0, lookY: 0, dragX: 0, dragY: 0, lastLook: -9, atk: false, jump: false, act: false, actHeld: false, aE: false, bE: false };
  const SH = { yaw: 0, pitch: 0.17, dist: 6, pivot: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const CAM2 = { yaw: 0, pitch: 0.17, dist: 4.4, cur: 4.4, sh: 0.72, pivot: new THREE.Vector3(), look: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 58, lockYawT: 0, fightK: 0, aspect: 1 };
  const camera2 = new THREE.PerspectiveCamera(62, 1, 0.12, 260);
  const rawGP = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  const log = (s) => { C.log.push(s + '@' + (typeof S !== 'undefined' ? S.time.toFixed(1) : 0)); if (C.log.length > 60) C.log.shift(); };
  // ---- turn rotation: while a mode runs, the mode only sees the active player's pad ----
  if (navigator.getGamepads) { try { Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: function () { const a = rawGP(); return C.on && C.mode ? filterPads(a) : a; } }); } catch (e) {} }
  function filterPads(a) { const act = C.turn === 1 ? C.p2 : C.p1; const out = []; for (let i = 0; i < a.length; i++) { const g = a[i]; out.push(g && (g.index === act || (C.turn === 0 && C.p1 === null && g.index !== C.p2)) ? g : null); } return out; }
  addEventListener('keydown', () => { C.kbUsed = true; });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') C.kbUsed = true; }, true);
  addEventListener('gamepaddisconnected', (e) => { const i = e.gamepad && e.gamepad.index; if (i === C.p2) leave('unplugged'); else if (i === C.p1) C.p1 = null; });
  const pressedB = (gp, k) => !!(gp.buttons[k] && gp.buttons[k].pressed);
  function anyIn(gp) { if (gp.buttons.some((b) => b && b.pressed)) return true; for (let i = 0; i < Math.min(4, gp.axes.length); i++) if (Math.abs(gp.axes[i] || 0) > 0.5) return true; return false; }
  // called by readInput (06_game) for every pad: 'p1' = feeds Harold as before; anything else is skipped there
  function padRole(gp) {
    const i = gp.index; if (C.p2 === i) return 'p2';
    const pv = C.prevR[i] || [], startE = pressedB(gp, 9) && !pv[9], aE = pressedB(gp, 0) && !pv[0]; let role;
    if (C.p1 === null) {
      if (startE && C.kbUsed && C.p2 === null && !C.mode) { join(i); role = 'join'; } // keyboard / touch is P1: Start on the pad joins it as P2
      else { if (anyIn(gp)) C.p1 = i; role = 'p1'; }
    } else if (C.p1 === i) role = 'p1';
    else if ((startE || aE) && C.p2 === null && !C.mode) { join(i); role = 'join'; }
    else role = 'skip';
    C.prevR[i] = gp.buttons.map((x) => !!(x && x.pressed));
    return role;
  }
  // ---- HUD bits (injected; no index.html edit) ----
  const st = document.createElement('style');
  st.textContent = `
  #coopdiv { position: fixed; z-index: 4; background: #14101f; pointer-events: none; display: none; box-shadow: 0 0 0 1px #ff9ad0; }
  .cooptag { position: fixed; z-index: 5; font: 9px/1 'PX', monospace; color: #fff; background: #14101f; border: 2px solid #000; padding: 3px 5px; pointer-events: none; display: none; }
  #cooptag2 { color: #ff9ad0; } #cooptag1 { color: #9dff6b; }
  #coopedge { position: fixed; z-index: 6; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; pointer-events: none; display: none;
    background: conic-gradient(#ff9ad0 calc(var(--p) * 1turn), rgba(20,16,31,.55) 0); -webkit-mask: radial-gradient(circle, transparent 13px, #000 14px); mask: radial-gradient(circle, transparent 13px, #000 14px); }
  #coopedgeL { position: fixed; z-index: 6; font: 7px/1 'PX', monospace; color: #fff; text-shadow: 1px 1px 0 #000; pointer-events: none; display: none; transform: translate(-50%, 0); white-space: nowrap; }
  #coopturn { position: fixed; z-index: 30; left: 50%; top: 34%; transform: translate(-50%, -50%); background: #1a1220; border: 3px solid #000; box-shadow: 4px 4px 0 #000; padding: 12px 16px; text-align: center; font: 12px/1.6 'PX', monospace; color: #ff9ad0; display: none; pointer-events: none; max-width: 90vw; }
  #coopturn b { display: block; font-size: 18px; color: #fff; margin-bottom: 4px; } #coopturn i { display: block; font-style: normal; color: #ffe08a; font-size: 10px; }
  @media (max-width: 480px) { #coopturn { font-size: 9px; } #coopturn b { font-size: 13px; } }`;
  document.head.appendChild(st);
  const mk = (id, cls) => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); return e; };
  const elDiv = mk('coopdiv'), elT1 = mk('cooptag1', 'cooptag'), elT2 = mk('cooptag2', 'cooptag'), elEdge = mk('coopedge'), elEdgeL = mk('coopedgeL'), elTurn = mk('coopturn');
  elT1.textContent = 'P1 HAROLD'; elT2.textContent = 'P2 MAVIS'; elEdgeL.textContent = 'KEEP GOING TO SPLIT';
  let tagSpr = null;
  function tags() { if (tagSpr) return tagSpr; const mkS = (txt, col) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 128, (c) => comicText(c, txt, 128, 66, 84, col, null, { sx: 1 })), depthTest: false, transparent: true })); s.scale.set(0.9, 0.45, 1); s.renderOrder = 20; s.visible = false; scene.add(s); return s; };
    tagSpr = [mkS('P1', '#9dff6b'), mkS('P2', '#ff9ad0')]; return tagSpr; }
  const hideHud = () => { for (const e of [elDiv, elT1, elT2, elEdge, elEdgeL]) e.style.display = 'none'; if (tagSpr) tagSpr.forEach((s) => (s.visible = false)); };
  // ---- join / leave ----
  function join(i) {
    C.p2 = i; C.on = true; C.joins++; C.split = false; C.k = 0; C.edgeT = 0; C.turn = 0; C.prev2 = []; log('join:pad' + i);
    initShared(true);
    const P = partner; if (Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z) > MAXSEP() * 0.8 || !!P.roof !== !!hero.roof) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'coop-join'); }
    if (P.state === 'revive') P.set('move');
    const n = $('p2n'); if (n) n.textContent = 'P2 MAVIS'; tags();
    if (typeof banner === 'function') banner('PLAYER 2 JOINED!', 1.8); sfx('ko');
  }
  function leave(why) {
    if (!C.on) return; log('leave:' + why); if (C.split || C.k > 0) merge(true);
    C.on = false; C.p2 = null; C.card = null; elTurn.style.display = 'none'; C.turn = 0;
    delete CAM.aspect; camera.aspect = VW() / VH(); camera.far = 260; camera.updateProjectionMatrix(); CAM.yaw = SH.yaw;
    if (partner.state === 'air' || partner.state === 'airatk') { partner.y = 0; partner.vy = 0; partner.set('move'); } else if (partner.state === 'revive') partner.set('move');
    const n = $('p2n'); if (n) n.textContent = 'MAVIS'; hideHud();
    resize(); if (typeof banner === 'function') banner('PLAYER 2 LEFT', 1.4);
  }
  // ---- P2 input (raw pad) ----
  function readP2(dt) {
    const gp = rawGP()[C.p2]; IN2.atk = IN2.jump = IN2.act = false;
    if (!gp || gp.connected === false) { leave('gone'); return false; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v), b = (k) => pressedB(gp, k), pv = C.prev2;
    let mx = dz(gp.axes[0] || 0), my = -dz(gp.axes[1] || 0); if (b(14)) mx -= 1; if (b(15)) mx += 1; if (b(12)) my += 1; if (b(13)) my -= 1;
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    let look = dz(gp.axes[2] || 0); if (b(4)) look -= 1; if (b(5)) look += 1;
    IN2.mx = mx; IN2.my = my; IN2.look = clamp(look, -1, 1); IN2.lookY = dz(gp.axes[3] || 0); if (IN2.look || IN2.lookY) IN2.lastLook = S.time;
    const e = (k) => b(k) && !pv[k];
    IN2.aE = IN2.aE || e(0); IN2.bE = IN2.bE || e(1); IN2.jump = e(0); IN2.atk = e(2) || e(1); IN2.act = e(3); IN2.actHeld = b(3);
    if (e(8) && !C.card) FMAP.open('pad');
    C.leaveT = b(9) ? C.leaveT + dt : 0; // hold Start ~3 s to drop out
    C.prev2 = gp.buttons.map((x) => !!(x && x.pressed));
    if (C.card) { IN2.mx = IN2.my = 0; IN2.atk = IN2.jump = IN2.act = false; IN2.actHeld = false; }
    if (C.leaveT > 3) { leave('start-held'); return false; }
    return true;
  }
  // ---- P2 drives Mavis (scripted states: intro / tp / hop / boost / pclimb / tag / hurt / down / getup / ko stay in 06c updatePartner) ----
  const OWN = new Set(['move', 'idle', 'atk', 'air', 'airatk', 'revive']);
  function p2Target(dx, dz, maxD) { const P = partner; let best = null, bs = 1e9;
    for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.state === 'drown' || e.fin) continue; const ex = e.pos.x - P.pos.x, ez = e.pos.z - P.pos.z, d = Math.hypot(ex, ez); if (d > maxD) continue;
      const ang = Math.acos(clamp((ex * dx + ez * dz) / (d || 1), -1, 1)), s = d + ang * 2.2 + (e.state === 'down' ? 4 : 0); if (s < bs) { bs = s; best = e; } }
    return best; }
  function p2Attack(n, wx, wz) { const P = partner; P.set('atk'); P.atkN = n; P.queued = false; P.hitDone = false; P.hit2 = false;
    let dx = Math.sin(P.yaw), dz = Math.cos(P.yaw); const wl = Math.hypot(wx, wz); if (wl > 0.1) { dx = wx / wl; dz = wz / wl; }
    const t = p2Target(dx, dz, 5.2); P.atkT = t; P.yaw = t ? Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z) : Math.atan2(dx, dz); sfx('swing'); }
  function p2Revivable() { const H = hero; return H.state === 'ko' && !PART.over && !!H.roof === !!partner.roof && Math.hypot(H.pos.x - partner.pos.x, H.pos.z - partner.pos.z) < REVIVE_R ? H : null; }
  function updateP2(dt) {
    const P = partner; if (!OWN.has(P.state) || CINE.intro || PART.over) { updatePartner(dt); return; }
    P.st += dt; P.at += dt; P.inv = Math.max(0, P.inv - dt); P.ghost = !(P.state === 'move' || P.state === 'atk');
    const f = camFwd(C.split ? CAM2.yaw : CAM.yaw), r = [-f[1], f[0]];
    const wx = r[0] * IN2.mx + f[0] * IN2.my, wz = r[1] * IN2.mx + f[1] * IN2.my, wl = Math.hypot(wx, wz);
    let pose, rate = 16, snapTilt = false;
    const move = (spd, acc) => { P.vel.x = damp(P.vel.x, wx * spd, acc, dt); P.vel.y = damp(P.vel.y, wz * spd, acc, dt); };
    switch (P.state) {
      case 'idle': case 'move': {
        P.state = 'move'; move(6.6, 12); if (wl > 0.1) P.yaw += angTo(P.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 14));
        P.speed = Math.hypot(P.vel.x, P.vel.y); pose = P.speed > 0.6 ? HERO_POSES.run(P.at, P.speed) : HERO_POSES.idle(P.at);
        if (P.speed > 4 && Math.random() < dt * 4) dust(P.pos.x, P.pos.y, P.pos.z, 1);
        if (IN2.actHeld && p2Revivable()) { P.set('revive'); P.rv = 0; P.vel.set(0, 0); break; }
        if (IN2.atk) p2Attack(1, wx, wz); else if (IN2.jump) { P.set('air'); P.vy = 8.2; sfx('jump'); dust(P.pos.x, P.pos.y, P.pos.z, 3); }
        break;
      }
      case 'atk': {
        const A = ATK[P.atkN] || ATK[1], u = P.st / A.dur, T = P.atkT; P.speed = 0;
        let lsp = u < 0.45 ? 2.2 : 0;
        if (T && T.alive && T.state !== 'dying') { const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, d = Math.hypot(dx, dz); P.yaw += angTo(P.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 20)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 9) : 0; }
        P.vel.set(Math.sin(P.yaw) * lsp, Math.cos(P.yaw) * lsp);
        const skip = (e) => e.fin;
        if (!P.hitDone && P.st >= A.hit * A.dur) { P.hitDone = true; spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95 + (P.atkN === 3 ? 0.25 : 0), P.pos.z), P.yaw + (P.atkN === 1 ? 0.25 : P.atkN === 2 ? -0.25 : 0), A.slash, A.roll, P.atkN === 2 ? -1 : 1); resolveSwing(A, P.atkN === 3, P, skip); }
        if (P.atkN === 3 && !P.hit2 && P.st >= 0.62 * A.dur) { P.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true, P, skip); }
        if (IN2.atk && u > 0.25) P.queued = true;
        if (u >= (P.atkN === 3 ? 1 : 0.78) && P.queued && P.atkN < 3) p2Attack(P.atkN + 1, wx, wz);
        else if (u >= 1) { P.set('move'); P.at = 0; }
        pose = (P.atkN === 3 && HERO_POSES.purse ? HERO_POSES.purse : HERO_POSES[A.pose])(Math.min(u, 1)); rate = 30; snapTilt = P.atkN === 3;
        if (IN2.jump && u > 0.6) { P.set('air'); P.vy = 8.2; sfx('jump'); }
        break;
      }
      case 'air': case 'airatk': {
        move(6.0, 4); P.vy -= 24 * dt; P.y += P.vy * dt;
        if (wl > 0.1 && P.state === 'air') P.yaw += angTo(P.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 8));
        if (P.state === 'air' && IN2.atk) { P.set('airatk'); P.vy = Math.max(P.vy, 3.5); const t = p2Target(Math.sin(P.yaw), Math.cos(P.yaw), 5); if (t) P.yaw = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z); sfx('swing'); }
        if (P.state === 'airatk') { pose = HERO_POSES.airatk(P.st / 0.42); snapTilt = true; rate = 30; if (P.st > 0.25) P.vy = Math.min(P.vy, -10); } else pose = HERO_POSES.jump(P.vy);
        if (P.y <= 0) { P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 3);
          if (P.state === 'airatk') { spawnSlash(_v.set(P.pos.x, P.pos.y + 0.4, P.pos.z), P.yaw, 'spin', 0); resolveSwing({ range: 2.6, cone: Math.PI, dmg: 3, heavy: true }, true, P, (e) => e.fin); S.shake = Math.max(S.shake, 0.5); }
          P.vy = 0; P.set('move'); P.J.tilt.rotation.x = 0; }
        break;
      }
      case 'revive': {
        P.vel.set(0, 0); P.inv = Math.max(P.inv, 0.2); const H = p2Revivable(); pose = HERO_POSES.revive(P.st); rate = 14;
        if (H) P.yaw += angTo(P.yaw, Math.atan2(H.pos.x - P.pos.x, H.pos.z - P.pos.z)) * (1 - Math.exp(-dt * 12));
        if (!H || !IN2.actHeld) { P.rv = 0; P.set('move'); break; }
        P.rv = (P.rv || 0) + dt; if (P.rv >= REVIVE_T) { reviveTurtle(hero, P); P.set('move'); log('p2revive'); }
        break;
      }
    }
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; collide(P);
    finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, true);
  }
  // ---- per step: remember positions, read P2 ----
  const P0 = { hx: 0, hz: 0, px: 0, pz: 0 };
  function preStep(dt) { P0.hx = hero.pos.x; P0.hz = hero.pos.z; P0.px = partner.pos.x; P0.pz = partner.pos.z; readP2(dt); }
  const P2FREE = new Set(['move', 'idle', 'atk', 'air', 'airatk', 'revive', 'hurt', 'down', 'getup', 'ko']);
  function worldIn(I, yaw) { const f = camFwd(yaw), r = [-f[1], f[0]]; return [r[0] * I.mx + f[0] * I.my, r[1] * I.mx + f[1] * I.my]; }
  function step(dt) {
    if (!C.on) return;
    const H = hero, P = partner; let dx = P.pos.x - H.pos.x, dz = P.pos.z - H.pos.z, sep = Math.hypot(dx, dz);
    const scripted = CINE.intro || PART.over || CINE_ST.has(H.state) || !P2FREE.has(P.state), levels = !!H.roof !== !!P.roof, MS = MAXSEP();
    if (!C.split) {
      // 1. held at the edge: remove the away-from-partner part of this step's motion (walking, knockback, jumps alike)
      if (!scripted && !levels && sep > MS) {
        const prevSep = Math.hypot(P0.px - P0.hx, P0.pz - P0.hz), lim = Math.max(MS, prevSep);
        if (sep > lim + 1e-4) { const ux = dx / sep, uz = dz / sep;
          const a1 = Math.max(0, -((H.pos.x - P0.hx) * ux + (H.pos.z - P0.hz) * uz)), a2 = Math.max(0, (P.pos.x - P0.px) * ux + (P.pos.z - P0.pz) * uz), ex = sep - lim, tot = a1 + a2;
          const s1 = tot > 1e-6 ? ex * a1 / tot : ex / 2, s2 = ex - s1;
          H.pos.x += ux * s1; H.pos.z += uz * s1; P.pos.x -= ux * s2; P.pos.z -= uz * s2; collide(H); collide(P); C.holds++;
          dx = P.pos.x - H.pos.x; dz = P.pos.z - H.pos.z; sep = Math.hypot(dx, dz); }
      }
      // 2. the intentional-split timer: someone in 'move', at the edge, stick held away from the partner, 2 s without a break
      let who = null;
      if (!scripted && !levels && sep >= MS - 0.3 && !C.card) { const ux = dx / sep, uz = dz / sep;
        const yw = CAM.yaw, w1 = worldIn(IN, yw), w2 = worldIn(IN2, yw), m1 = Math.hypot(w1[0], w1[1]), m2 = Math.hypot(w2[0], w2[1]);
        if (H.state === 'move' && m1 > 0.5 && -(w1[0] * ux + w1[1] * uz) / m1 > 0.45) who = 'p1';
        else if (P.state === 'move' && m2 > 0.5 && (w2[0] * ux + w2[1] * uz) / m2 > 0.45) who = 'p2'; }
      if (who && (C.edgeWho === who || C.edgeT === 0)) { C.edgeT += dt; C.edgeWho = who; C.graceT = 0; }
      else { C.graceT += dt; if (C.graceT > GRACE) { C.edgeT = 0; C.edgeWho = null; } }
      if (C.edgeT >= SPLIT_T) doSplit();
      // 3. different levels in one view (Harold climbed / dropped): puff Mavis over
      if (levels && !scripted && P.state === 'move') { C.levelT += dt; if (C.levelT > 0.5) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-level'); C.levelT = 0; } } else C.levelT = 0;
      // 4. carried far apart by a cinematic: puff Mavis back beside Harold
      if (!scripted && sep > MS * 1.5 && P.state === 'move') { C.farT += dt; if (C.farT > 1) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-far'); C.farT = 0; } } else C.farT = 0;
    } else {
      C.edgeT = 0;
      if (sep < MERGE_D() && !levels && !scripted) { C.mergeT += dt; if (C.mergeT > 0.4) merge(false); } else C.mergeT = 0;
      if (sep < MERGE_D() && levels && !scripted && P.state === 'move') { C.levelT += dt; if (C.levelT > 1.0) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-level'); C.levelT = 0; } } else if (!levels) C.levelT = 0;
    }
    // a toad KO'd far from its partner (split) gets back up beside the partner after 8 s
    const down = H.state === 'ko' ? H : P.state === 'ko' ? P : null, other = down === H ? P : H;
    if (down && other.hp > 0 && other.state !== 'ko' && sep > 20 && !PART.over) { C.koT += dt; if (C.koT > 8) { const s = settle(other.pos.x - 1.2, other.pos.z + 0.6, !!other.roof); down.roof = !!other.roof; down.pos.set(s.x, s.y, s.z); reviveTurtle(down, other); C.koT = 0; log('farRevive'); } } else C.koT = 0;
    if (PART.over && (C.split || C.k > 0)) merge(true);
  }
  function doSplit() { C.split = true; C.splits++; C.edgeT = 0; C.mergeT = 0; log('split:' + C.edgeWho);
    CAM.yaw = SH.yaw; CAM.pivot.copy(SH.pivot); CAM.cur = CAM.dist = Math.max(4.4, SH.dist * 0.6); IN.lastLook = S.time;
    CAM2.yaw = SH.yaw; CAM2.pitch = CAM.pitch; CAM2.pivot.copy(SH.pivot); CAM2.cur = CAM2.dist = CAM.cur; CAM2.fightK = 0; IN2.lastLook = S.time; resize(); }
  function merge(instant) { if (C.split) { C.merges++; log('merge' + (instant ? ':instant' : '')); } C.split = false; C.mergeT = 0; initShared(instant); if (instant) { C.k = 0; delete CAM.aspect; } resize(); }
  function initShared(instant) {
    SH.yaw = CAM.yaw; SH.pitch = CAM.pitch; SH.dist = CAM.cur || 4.4;
    if (instant) SH.pivot.set((hero.pos.x + partner.pos.x) / 2, (hero.pos.y + partner.pos.y) / 2 + 1.4, (hero.pos.z + partner.pos.z) / 2); else SH.pivot.copy(CAM.pivot);
  }
  // ---- cameras ----
  function views() { // viewport rects as fractions of the screen (x, y from the bottom-left, w, h) for k: 0 = one view, 1 = split
    const k = C.k, land = VW() >= VH();
    if (land) return [[0, 0, 1 - k / 2, 1], [1 - k / 2, 0, 0.5, 1], land];
    return [[0, k / 2, 1, 1 - k / 2], [0, -0.5 + k / 2, 1, 0.5], land]; // portrait: P1 on top, P2 slides up from the bottom
  }
  function sharedCam(dt, rdt, aspect) {
    const H = hero, P = partner;
    SH.yaw -= (IN.look + IN2.look) * rdt * 2.3; SH.yaw -= IN.dragX * 0.0062; SH.pitch = clamp(SH.pitch + IN.dragY * 0.0035 + (IN.lookY + IN2.lookY) * rdt * 1.4, 0.02, 0.9); IN.dragX = IN.dragY = 0;
    const idle = S.time - Math.max(IN.lastLook, IN2.lastLook) > 1.4, vx = (H.vel.x + P.vel.x) / 2, vz = (H.vel.y + P.vel.y) / 2, sp = Math.hypot(vx, vz);
    if (idle && sp > 1) { const d = angTo(SH.yaw, Math.atan2(-vx, -vz)); if (Math.abs(d) < 2.2) SH.yaw += d * (1 - Math.exp(-rdt * 0.9 * clamp(sp / 6, 0, 1))); }
    SH.yaw = wrapA(SH.yaw); CAM.yaw = SH.yaw; // P1's stick is relative to the shared camera
    const sep = Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z), sk = clamp((sep - 2) / 10, 0, 1), portrait = aspect < 1 / 1.15;
    const mx = (H.pos.x + P.pos.x) / 2, mz = (H.pos.z + P.pos.z) / 2, my = (H.pos.y + P.pos.y) / 2 + 1.4 + (H.y + P.y) * 0.22;
    SH.pivot.x = damp(SH.pivot.x, mx, 6, rdt); SH.pivot.z = damp(SH.pivot.z, mz, 6, rdt); SH.pivot.y = damp(SH.pivot.y, my, 5, rdt);
    setFov(58, camera, aspect); const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const half = sep / 2 + 1.8, want = Math.max(4.6 + (portrait ? 1.4 : 0), half / Math.tan(Math.min(vf, hf) / 2) * 1.05);
    SH.dist = damp(SH.dist, want, 2.4, rdt);
    const pitch = clamp(SH.pitch + sk * 0.42, 0.05, 1.05), f = camFwd(SH.yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
    const px = SH.pivot.x, py = SH.pivot.y, pz = SH.pivot.z, wx = px - f[0] * SH.dist * cp, wy = py + SH.dist * spp, wz = pz - f[1] * SH.dist * cp;
    let t = 1; for (const b of BLD) { if (b.x1 < Math.min(px, wx) - 1 || b.x0 > Math.max(px, wx) + 1 || b.z1 < Math.min(pz, wz) - 1 || b.z0 > Math.max(pz, wz) + 1) continue; const hh = segBox(px, py, pz, wx, wy, wz, b, 0.3); if (hh < t) t = hh; }
    const d = Math.max(sep > 3 ? SH.dist * 0.72 : 0.9, SH.dist * t - 0.15);
    SH.pos.set(px - f[0] * d * cp, Math.max(py + d * spp, H.pos.y + 0.5), pz - f[1] * d * cp); SH.look.set(px + f[0] * 0.8, py - 0.2 - sk * 0.4, pz + f[1] * 0.8);
    const T = S.time; SH.pos.x += Math.sin(T * 0.73) * 0.03; SH.pos.y += Math.sin(T * 1.13 + 2) * 0.025;
    camera.position.copy(SH.pos); if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const kk = S.shake * S.shake * 0.25; camera.position.x += rnd(-kk, kk); camera.position.y += rnd(-kk, kk); }
    camera.up.set(0, 1, 0); camera.lookAt(SH.look); CAM.pos.copy(SH.pos); CAM.look.copy(SH.look); CAM.pivot.copy(SH.pivot); CAM.cur = d;
  }
  function setAspect(cam, a) { if (Math.abs(cam.aspect - a) > 1e-4) { cam.aspect = a; cam.updateProjectionMatrix(); } }
  function cam(dt, rdt) {
    C.k = damp(C.k, C.split ? 1 : 0, 7, rdt); if (!C.split && C.k < 0.004) C.k = 0; if (C.split && C.k > 0.996) C.k = 1;
    const two = C.split || C.k > 0, [v1, v2] = views(), sw = VW(), sh = VH();
    const a1 = (sw * v1[2]) / (sh * v1[3]), a2 = (sw * v2[2]) / (sh * v2[3]);
    if (two) CAM.aspect = a1; else delete CAM.aspect;
    setAspect(camera, a1);
    if (CINE.intro) camStep(dt, rdt);
    else if (C.split) camStep(dt, rdt); // P1's own follow camera (cinematics included)
    else if (cineCamActive()) cineCamera(rdt);
    else sharedCam(dt, rdt, a1);
    if (two) { CAM2.aspect = a2; setAspect(camera2, a2); updateCameraFor(CAM2, camera2, partner, IN2, null, dt, rdt); }
  }
  // ---- draw: two viewports into the low-res target, then the post pass once ----
  const _sky = new THREE.Vector3();
  function draw2() {
    const W = RT.width, Hh = RT.height, [v1, v2] = views(); C.draws2++;
    const rect = (v) => [Math.round(v[0] * W), Math.round(v[1] * Hh), Math.round(v[2] * W), Math.round(v[3] * Hh)];
    const r1 = rect(v1), r2 = rect(v2);
    RT.scissorTest = true;
    RT.viewport.set(r1[0], r1[1], r1[2], r1[3]); RT.scissor.set(r1[0], r1[1], r1[2], r1[3]);
    renderer.setRenderTarget(RT); renderer.render(scene, camera);
    const x0 = Math.max(0, r2[0]), y0 = Math.max(0, r2[1]), x1 = Math.min(W, r2[0] + r2[2]), y1 = Math.min(Hh, r2[1] + r2[3]);
    if (x1 - x0 > 1 && y1 - y0 > 1) {
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; _sky.copy(window.__sky.position); window.__sky.position.copy(camera2.position);
      RT.viewport.set(r2[0], r2[1], r2[2], r2[3]); RT.scissor.set(x0, y0, x1 - x0, y1 - y0);
      renderer.setRenderTarget(RT); renderer.render(scene, camera2);
      renderer.shadowMap.autoUpdate = au; window.__sky.position.copy(_sky);
    }
    RT.scissorTest = false; RT.viewport.set(0, 0, W, Hh); RT.scissor.set(0, 0, W, Hh);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  // ---- after the city frame: perf trims in split, HUD, edge ring, tags, the P2'S TURN card ----
  const _p = new THREE.Vector3();
  function post(rdt) {
    const two = C.split || C.k > 0, [v1, v2, land] = views(), sw = VW(), sh = VH();
    const far = two ? 200 : 260; if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); } if (camera2.far !== 200) { camera2.far = 200; camera2.updateProjectionMatrix(); }
    if (two) { const ff = Math.min(scene.fog.far, 110), fn = Math.min(scene.fog.near, 30); scene.fog.far = ff; scene.fog.near = fn; OUT_U.fogF.value = ff; OUT_U.fogN.value = fn; }
    if (two) { elDiv.style.display = 'block';
      if (land) { const x = sw * (1 - C.k / 2); Object.assign(elDiv.style, { left: (x - 2) + 'px', top: '0px', width: '4px', height: sh + 'px' }); Object.assign(elT1.style, { left: '8px', bottom: '8px' }); Object.assign(elT2.style, { left: (x + 8) + 'px', bottom: '8px' }); }
      else { const y = sh * (C.k / 2); Object.assign(elDiv.style, { left: '0px', top: (sh - y - 2) + 'px', width: sw + 'px', height: '4px' }); Object.assign(elT1.style, { left: '8px', bottom: (y + 8) + 'px' }); Object.assign(elT2.style, { left: '8px', bottom: '8px' }); }
      elT1.style.display = elT2.style.display = C.k > 0.6 ? 'block' : 'none';
    } else { elDiv.style.display = elT1.style.display = elT2.style.display = 'none'; }
    // edge ring over the toad pushing away (fills over the 2 s)
    if (!C.split && C.edgeT > 0.15) { const f = C.edgeWho === 'p2' ? partner : hero; _p.set(f.pos.x, f.pos.y + f.y + 2.3, f.pos.z).project(camera);
      const x = (_p.x + 1) / 2 * sw, y = (1 - _p.y) / 2 * sh; elEdge.style.display = elEdgeL.style.display = 'block'; elEdge.style.left = x + 'px'; elEdge.style.top = y + 'px'; elEdge.style.setProperty('--p', clamp(C.edgeT / SPLIT_T, 0, 1).toFixed(3));
      elEdgeL.style.left = x + 'px'; elEdgeL.style.top = (y + 26) + 'px'; }
    else elEdge.style.display = elEdgeL.style.display = 'none';
    if (tagSpr) { const [t1, t2] = tagSpr; t1.visible = hero.root.visible; t2.visible = partner.root.visible; t1.position.set(hero.pos.x, hero.pos.y + hero.y + 2.45, hero.pos.z); t2.position.set(partner.pos.x, partner.pos.y + partner.y + 2.45, partner.pos.z); }
    if (C.card) { C.cardT += rdt;
      if (IN2.aE) { const A = C.card.act; C.card = null; elTurn.style.display = 'none'; C.turn = 1; C.turns++; log('turn:p2:' + A.label); try { A.go(); } catch (e) { C.turn = 0; } }
      else if (IN2.bE || C.cardT > 15) { log('turn:skip'); C.card = null; elTurn.style.display = 'none'; } }
    IN2.aE = IN2.bE = false;
  }
  // ---- mode tracking (runs every frame, before any mode's own frame) ----
  function modeNow() {
    if (DERBY.on) return 'derby'; if (VIC.on) return 'vic'; if (FORT.on) return 'fort';
    if (MODE.duel) { const d = MODE.duel; return 'duel:' + ((d.cur && d.cur.id) || d.id || 'x'); } if (RB.mode) return 'rb:' + RB.mode; return null;
  }
  function pre(rdt) {
    const m = modeNow();
    if (m && !C.mode) { C.mode = m; if (C.split || C.k > 0) merge(true); C.card = null; elTurn.style.display = 'none';
      C.modeAct = C.turn === 0 && C.lastAct && performance.now() - C.lastActT < 2000 && C.lastAct.kind !== 'boat' && !/^rb:ride/.test(m) ? C.lastAct : null; C.lastAct = null; log('mode:' + m + ':turn' + C.turn); hideHud(); }
    else if (m && C.mode && m !== C.mode) { log('mode:' + C.mode + '->' + m); C.mode = m; C.modeAct = null; } // chained (e.g. Brewmaster -> finale): no P2 replay
    else if (!m && C.mode) { log('exit:' + C.mode + ':turn' + C.turn); C.mode = null; merge(true);
      if (Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z) > 4 || !!partner.roof !== !!hero.roof) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'coop-mode'); }
      if (C.turn === 1) { C.turn = 0; if (typeof banner === 'function') banner('P1 BACK IN CONTROL', 1.4); }
      else if (C.modeAct && C.p2 !== null) { const A = C.modeAct; C.card = { act: A }; C.cardT = 0;
        const nm = (CITY.lmk && CITY.lmk.name) || ''; elTurn.innerHTML = '<b>P2\u2019S TURN!</b>' + (nm ? nm.replace(/[<>&]/g, '') + '<br>' : '') + 'P2: A = PLAY \u00b7 B = SKIP<i>' + String(A.label || 'PLAY').replace(/[<>&]/g, '') + ' \u00b7 PLAYER 2 PLAYS AS HAROLD</i>'; elTurn.style.display = 'block'; log('card'); }
      C.modeAct = null; }
    return false;
  }
  function noteAct(c) { if (!C.on || C.mode) return; C.lastAct = c; C.lastActT = performance.now(); }
  function resK() { return C.on && C.split && TOUCH ? 0.8 : 1; }
  const api = { get on() { return C.on; }, padRole, noteAct, pre, preStep, updateP2, step, cam, post, draw: draw2, split: () => C.split || C.k > 0, resK, C, IN2, SH, CAM2, camera2, join, leave, MAXSEP, MERGE_D, SPLIT_T };
  window.__coop = api;
  return api;
})();

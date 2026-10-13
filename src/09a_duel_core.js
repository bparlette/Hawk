
// ======================= BOSS DUELS: game-style boss fights that take over the screen as their own mode (Brad 2026-10-11, DESIGN.md "More game-style fights").
// 09b: Big Jimmy, National Aquarium: an underwater swim fight in the big tank.   09c: The Chip Kid, Harborplace: a Punch-Out-style mech duel.
// A duel builds its own small scene + camera on first start (kept after), runs from the main loop through MODE.duel (07_main), ducks the radio,
// hides the city HUD, relabels the arcade panel, and on a win marks the landmark's boss cleared (DUELS.bossCleared -> BOSS_CLEAR.clear(lmId):
// LANDMARKS[i].boss.cleared, district crime -> 0, 'tcb:bossclear' event; plus CITY.log and DUELS.hooks.onClear listeners). A loss offers RETRY (from the phase / round
// reached) or LEAVE. Entry: walk to the glowing ring at the landmark (Aquarium door, Harborplace plaza) and press ACT (FIGHT); ?duel=jimmy|chipkid
// starts one straight away (tests), ?duelbot=win|lose plays it by itself. Rig hooks: window.buildBigJimmy / window.buildChipKid (see 09b / 09c).
const DUELS = (function () {
  const D = { cur: null, kinds: {}, cleared: {}, log: [], hooks: { onClear: [] }, frames: 0, bot: null, I: null };
  // ---------------- HUD (DOM, over the game canvas; the arcade panel stays live below it) ----------------
  const css = document.createElement('style');
  css.textContent = `
  body.duel #hpbox, body.duel #combo, body.duel #banner, body.duel #lmk, body.duel #lmkb, body.duel #mmap, body.duel #hint, body.duel #prompt, body.duel #bark,
  body.duel #clock, body.duel #proto, body.duel #qbtn, body.duel #title, body.duel #lbT, body.duel #lbB, body.duel #fmtab { display: none !important; }
  #duel { position: fixed; left: 0; top: 0; width: 100vw; height: calc(100vh - var(--panel, 0px)); height: calc(100dvh - var(--panel, 0px)); pointer-events: none; z-index: 40; display: none; font-family: 'PX', 'Courier New', monospace; color: #fff; overflow: hidden; }
  body.duel #duel { display: block; }
  #duel .dtop { position: absolute; left: 10px; right: 10px; top: calc(env(safe-area-inset-top, 0px) + 40px); display: flex; justify-content: space-between; gap: 14px; }
  #duel .dbar { flex: 1; max-width: 300px; }
  #duel .dbar.b { text-align: right; }
  #duel .dbar .n { font-size: 11px; letter-spacing: 1px; color: #ffd23c; text-shadow: 2px 2px 0 #14101f; margin-bottom: 4px; white-space: nowrap; }
  #duel .dbar.b .n { color: #ff8ab0; }
  #duel .dbar .t { height: 12px; background: #14101f; border: 2px solid #14101f; box-shadow: 3px 3px 0 #14101f; transform: skewX(-14deg); position: relative; overflow: hidden; }
  #duel .dbar .t i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: linear-gradient(#9dff6b, #3fd13a); transition: width .1s; }
  #duel .dbar.b .t i { left: auto; right: 0; background: linear-gradient(#ff8a6a, #e0372b); }
  #duel .dbar .t em { position: absolute; top: 0; bottom: 0; width: 2px; background: #14101f; }
  #duel .dsub { position: absolute; left: 10px; right: 10px; top: calc(env(safe-area-inset-top, 0px) + 78px); display: flex; justify-content: space-between; align-items: center; font-size: 10px; text-shadow: 2px 2px 0 #14101f; }
  #duel .air { width: 140px; }
  #duel .air .t { height: 9px; background: #0a1a2a; border: 2px solid #14101f; position: relative; overflow: hidden; border-radius: 6px; }
  #duel .air .t i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: linear-gradient(#bff4ff, #39b6ff); }
  #duel .air.low .t i { background: linear-gradient(#ffd0d0, #ff3d6e); animation: dlow .35s infinite alternate; }
  #duel .air .n { margin-bottom: 3px; color: #9fe8ff; }
  @keyframes dlow { from { opacity: 1; } to { opacity: .35; } }
  #duel .stars { color: #ffd23c; letter-spacing: 3px; font-size: 13px; }
  #duel .dban { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%) rotate(-4deg) scale(.7); font-size: 30px; text-align: center; line-height: 1.15; color: #ffd23c; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f, 2px -2px 0 #14101f, -2px 2px 0 #14101f; opacity: 0; transition: opacity .18s, transform .18s; white-space: nowrap; }
  #duel .dban.on { opacity: 1; transform: translate(-50%, -50%) rotate(-4deg) scale(1); }
  #duel .dban small { display: block; font-size: 12px; color: #fff; margin-top: 8px; }
  #duel .dsay { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 100px); transform: translateX(-50%); max-width: min(330px, 86vw); background: #2a1650; border: 3px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff3d6e; border-radius: 10px; padding: 7px 10px 8px; font-size: 11px; line-height: 1.45; opacity: 0; transition: opacity .2s; text-align: center; }
  #duel .dsay.on { opacity: 1; }
  #duel .dsay b { color: #ffd23c; display: block; font-size: 9px; margin-bottom: 3px; letter-spacing: 1px; }
  #duel .dtell { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); font-size: 12px; color: #fff; background: rgba(20,16,31,.78); border: 2px solid #ffd23c; border-radius: 8px; padding: 5px 9px; opacity: 0; transition: opacity .12s; white-space: nowrap; }
  #duel .dtell.on { opacity: 1; }
  /* R-055: long tells (Compression King etc.) wrap inside the viewport instead of running off a 390px phone */
  #duel .dtell { white-space: normal; width: max-content; max-width: min(92vw, 560px); box-sizing: border-box; text-align: center; line-height: 1.35; overflow-wrap: break-word; }
  @media (max-width: 480px) { #duel .dtell { font-size: 11px; padding: 4px 8px; } }
  #duel .dhint { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); font-size: 9px; background: rgba(20,16,31,.7); padding: 6px 10px; border-radius: 14px; white-space: nowrap; }
  #duel .dhint b { color: #ffd23c; }
  body.touch #duel .dhint { display: none; }
  #duel .dhurt { position: absolute; inset: 0; box-shadow: inset 0 0 90px 30px rgba(255,40,60,.85); opacity: 0; transition: opacity .25s; }
  #duel .dhurt.on { opacity: 1; transition: none; }
  #duel .dblind { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, rgba(255,170,60,.25), rgba(214,96,24,.92) 70%); opacity: 0; transition: opacity .6s; }
  #duel .dover { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(10,8,20,.62); pointer-events: auto; text-align: center; }
  #duel .dover.on { display: flex; }
  #duel .dover h2 { margin: 0; font-size: 22px; color: #ff5fa2; text-shadow: 3px 3px 0 #000; line-height: 1.3; font-weight: normal; }
  #duel .dover p { margin: 0 18px; font-size: 10px; line-height: 1.6; color: #e8e4ff; max-width: 340px; }
  #duel .dover .bt { display: flex; gap: 12px; }
  #duel .dover button { font: inherit; font-size: 12px; padding: 12px 16px; border-radius: 10px; border: 3px solid #14101f; box-shadow: 3px 3px 0 #14101f; background: #ffd23c; color: #14101f; cursor: pointer; }
  #duel .dover button.l { background: #cfc8ef; }
  @media (max-width: 480px) { #duel .dban { font-size: 22px; } #duel .dbar .n { font-size: 9px; } }`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'duel';
  hud.innerHTML = `<div class="dblind"></div><div class="dhurt"></div>
    <div class="dtop"><div class="dbar p"><div class="n">HAROLD</div><div class="t"><i></i></div></div><div class="dbar b"><div class="n">BOSS</div><div class="t"><i></i></div></div></div>
    <div class="dsub"><div class="l"></div><div class="r"></div></div>
    <div class="dsay"></div><div class="dtell"></div><div class="dban"></div><div class="dhint"></div>
    <div class="dover"><h2></h2><p></p><div class="bt"><button type="button" class="r">RETRY</button><button type="button" class="l">LEAVE</button></div></div>`;
  document.body.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const H = { pf: q('.dbar.p i'), bf: q('.dbar.b i'), bn: q('.dbar.b .n'), bt: q('.dbar.b .t'), subL: q('.dsub .l'), subR: q('.dsub .r'), say: q('.dsay'), tell: q('.dtell'), ban: q('.dban'), hint: q('.dhint'),
    hurt: q('.dhurt'), blind: q('.dblind'), over: q('.dover'), oh: q('.dover h2'), op: q('.dover p'), ob1: q('.dover button.r'), ob2: q('.dover button.l') };
  let sayT = 0, banT = 0, tellT = 0, hurtT = 0;
  D.say = (who, text, dur = 3.4) => { if (!text) return; H.say.innerHTML = '<b>' + who + '</b>' + text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); H.say.classList.add('on'); sayT = dur; D.log.push('say:' + text); };
  D.banner = (html, dur = 1.6) => { H.ban.innerHTML = html; H.ban.classList.add('on'); banT = dur; };
  D.tell = (text, dur = 1) => { H.tell.textContent = text; H.tell.classList.add('on'); tellT = dur; };
  D.hurt = () => { H.hurt.classList.add('on'); hurtT = 0.12; try { navigator.vibrate && navigator.vibrate(40); } catch (e) {} };
  D.blind = (v) => { H.blind.style.opacity = String(v); };
  D.bars = (p, b) => { H.pf.style.width = (clamp(p, 0, 1) * 100).toFixed(1) + '%'; H.bf.style.width = (clamp(b, 0, 1) * 100).toFixed(1) + '%'; };
  D.pips = (n) => { H.bt.querySelectorAll('em').forEach((e) => e.remove()); for (let i = 1; i < n; i++) { const e = document.createElement('em'); e.style.left = (100 - (i / n) * 100) + '%'; H.bt.appendChild(e); } };
  D.sub = (l, r) => { if (H.subL.__h !== l) { H.subL.innerHTML = l; H.subL.__h = l; } if (H.subR.__h !== r) { H.subR.innerHTML = r; H.subR.__h = r; } };
  function hudTick(dt) {
    if (sayT > 0 && (sayT -= dt) <= 0) H.say.classList.remove('on');
    if (banT > 0 && (banT -= dt) <= 0) H.ban.classList.remove('on');
    if (tellT > 0 && (tellT -= dt) <= 0) H.tell.classList.remove('on');
    if (hurtT > 0 && (hurtT -= dt) <= 0) H.hurt.classList.remove('on');
  }
  // loss / win card: RETRY | LEAVE, or CONTINUE after a win
  let overMode = null;
  D.over = (mode, title, text) => { overMode = mode; H.oh.innerHTML = title; H.op.innerHTML = text || ''; H.ob1.textContent = mode === 'win' ? 'CONTINUE' : 'RETRY'; H.ob2.style.display = mode === 'win' ? 'none' : ''; H.over.classList.add('on'); D.overT = 0; };
  const overClose = () => { H.over.classList.remove('on'); const m = overMode; overMode = null; return m; };
  D.overOn = () => !!overMode;
  function overPick(retry) { if (!overMode || D.overT < 0.6) return; const m = overClose(); if (m === 'win') D.exit('win'); else if (retry) { D.log.push('retry'); D.retries++; D.cur.retry(); } else D.exit('leave'); }
  H.ob1.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); overPick(true); });
  H.ob2.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); overPick(false); });
  D.overPick = overPick;

  // ---------------- input: one snapshot per frame from keys, the arcade panel, gamepads and the test bot ----------------
  const prevB = { l: false, r: false, a: false, b: false, c: false }, padPrev = {};
  function input() {
    readInput(); // IN.mx / IN.my (keys, the panel stick, the left pad stick, normalised) + PRESS edges for j / k / e from every device
    const I = { mx: IN.mx, my: IN.my, up: false, down: false, a: false, b: false, c: false, l: false, r: false, lh: false, rh: false, ok: false, back: false, ry: IN.lookY || 0 };
    I.up = KEYS.has(' ') || KEYS.has('pageup') || !!TOUCHS.btn.r; I.down = KEYS.has('shift') || KEYS.has('c') || KEYS.has('pagedown') || !!TOUCHS.btn.l;
    I.lh = !!TOUCHS.btn.l; I.rh = !!TOUCHS.btn.r; I.bh = !!TOUCHS.btn.b || KEYS.has('k') || KEYS.has('l');
    I.a = PRESS.has('j') || PRESS.has('f'); I.b = PRESS.has('k') || PRESS.has('l'); I.c = PRESS.has('e') || PRESS.has('u');
    I.ok = PRESS.has('enter') || PRESS.has('e') || PRESS.has('j') || PRESS.has(' '); I.back = PRESS.has('escape');
    for (const n of ['l', 'r']) { const v = !!TOUCHS.btn[n]; if (v && !prevB[n]) I[n] = true; prevB[n] = v; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) { if (!gp) continue; const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), pv = padPrev[gp.index] || {};
      if (b(7) || b(5) || (gp.axes[3] || 0) < -0.5) I.up = true; if (b(6) || b(4) || (gp.axes[3] || 0) > 0.5) I.down = true;
      if (b(12)) I.my = Math.max(I.my, 1); if (b(13)) I.my = Math.min(I.my, -1); if (b(14)) I.mx = -1; if (b(15)) I.mx = 1;
      if (b(4) && !pv[4]) I.l = true; if (b(5) && !pv[5]) I.r = true; if (b(4)) I.lh = true; if (b(5)) I.rh = true;
      if (b(0) && !pv[0]) I.ok = true; if (b(1) && !pv[1]) I.back = true;
      if (b(0)) I.bh = true; padPrev[gp.index] = { 0: b(0), 1: b(1), 4: b(4), 5: b(5) }; }
    if (D.bot) { const B = D.bot; I.mx = B.mx || 0; I.my = B.my || 0; I.up = !!B.up; I.down = !!B.down; I.lh = !!B.lh; I.rh = !!B.rh; I.bh = !!B.bh;
      if (B.a) I.a = true; if (B.b) I.b = true; if (B.c) I.c = true; if (B.ok) I.ok = true; if (B.back) I.back = true; if (B.l) I.l = true; if (B.r) I.r = true; B.a = B.b = B.c = B.ok = B.back = B.l = B.r = false; }
    return I;
  }

  // ---------------- small procedural kit for duel rigs: parts baked into one vertex-coloured geometry per moving piece (+ an ink hull in HD) ----------------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function kit() {
    const parts = [];
    const K = {
      add(g, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
        _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); parts.push({ g, col, m: _m4.clone() }); return K; },
      addM(g, col, m) { parts.push({ g, col, m }); return K; },
      geo() { // merge (non-indexed, baked colours, uvs kept when every part has them)
        const gs = parts.map((p) => { let g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m); if (!g.attributes.normal) g.computeVertexNormals(); bakeColor(g, p.col); return g; });
        let n = 0; for (const g of gs) n += g.attributes.position.count; const uv = gs.every((g) => g.attributes.uv);
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = uv ? new Float32Array(n * 2) : null; let o = 0;
        for (const g of gs) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (U) U.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); }
        const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        out.computeBoundingSphere(); return out; },
      mesh(mat, parent, ink = 0.0042) { const g = K.geo(), m = new THREE.Mesh(g, mat); if (parent) parent.add(m); if (ink) inkHull(m, ink); return m; },
    };
    return K;
  }
  const INKS = new Map();
  function inkHull(m, w = 0.0042) { addOdir(m.geometry); let om = INKS.get(w); if (!om) { om = outlineMat(w); INKS.set(w, om); } const h = new THREE.Mesh(m.geometry, om); h.visible = QUAL.hd; QUAL.outlines.push(h); m.add(h); return h; }
  const GEO = { sph: (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h), box: (x, y, z) => new THREE.BoxGeometry(x, y, z), cyl: (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s), cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s), tor: (r, t, a = TAU, rs = 6, ts = 14) => new THREE.TorusGeometry(r, t, rs, ts, a) };
  function sceneLights(sc, sky, ground, hi, dirCol, di, dir) { const h = new THREE.HemisphereLight(sky, ground, hi); const d = new THREE.DirectionalLight(dirCol, di); d.position.copy(dir); sc.add(h, d, d.target); return { h, d }; }
  function dot(c = '#fff', soft = true) { return canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, c); r.addColorStop(soft ? 0.5 : 0.8, c); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, 64); }
  D.kit = kit; D.GEO = GEO; D.inkHull = inkHull; D.sceneLights = sceneLights; D.dot = dot;

  // ---------------- boss cleared: the hook the crime meter / win state read ----------------
  D.bossCleared = function (lmId, how = 'duel') {
    const L = LANDMARKS.find((l) => l.id === lmId); if (!L || !L.boss) return;
    D.cleared[lmId] = { boss: L.boss.name, how, at: +S.time.toFixed(1) }; CITY.log.push('boss:' + lmId + '@' + S.time.toFixed(1));
    BOSS_CLEAR.clear(lmId, { how, retries: D.retries, secs: +D.t.toFixed(1) }); // the shared boss-clear / crime-meter hook (06g0_boss_clear.js)
    for (const f of D.hooks.onClear) { try { f(L, how); } catch (e) { console.error(e); } }
  };

  // ---------------- run / exit ----------------
  const LBL = ['a', 'b', 'c', 'l', 'r'], LBL0 = {};
  for (const n of LBL) { const e = $('albl-' + n); LBL0[n] = e ? e.innerHTML : ''; }
  function labels(map) { for (const n of LBL) { const e = $('albl-' + n); if (e) e.innerHTML = map ? map[n] || '' : LBL0[n]; } }
  D.hudEl = hud;
  D.hot = (on) => { const e = $('aact'); if (e && e.__hot !== on) { e.__hot = on; e.classList.toggle('hot', !!on); e.classList.remove('cool'); } };
  D.reg = (id, impl) => { D.kinds[id] = impl; impl.id = id; };
  D.start = function (id, opts = {}) {
    const K = D.kinds[id]; if (!K || D.cur) return false;
    if (!navigator.userActivation || navigator.userActivation.hasBeenActive) { audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); } // (a ?duel= test start has no gesture yet)
    if (!K.built) { K.build(); K.built = true; }
    D.cur = K; D.t = 0; D.retries = 0; D.result = null; D.bot = opts.bot ? { mode: opts.bot } : (Q.get('duelbot') ? { mode: Q.get('duelbot') } : null);
    D.ret = { x: hero.pos.x, z: hero.pos.z, yaw: hero.yaw };
    document.body.classList.add('duel', 'duel-' + id); H.over.classList.remove('on'); overMode = null; D.blind(0);
    H.bn.textContent = K.title; D.pips(K.pips || 1); H.hint.innerHTML = K.hint || ''; labels(K.labels);
    $('aico') && ($('aico').style.visibility = 'hidden');
    try { window.__radio && __radio.fightDuck(true); } catch (e) {}
    KEYS.clear(); PRESS.clear(); IN.mx = IN.my = 0;
    MODE.duel = D; K.lbl = false; D.log.push('start:' + id); K.start(opts); resizeCam(); return true;
  };
  D.exit = function (why) {
    const K = D.cur; if (!K) return; D.log.push('exit:' + K.id + ':' + why); D.result = why;
    if (K.exit) K.exit(why);
    MODE.duel = null; D.cur = null; D.bot = null;
    document.body.classList.remove('duel', 'duel-' + K.id); H.over.classList.remove('on'); overMode = null; H.say.classList.remove('on'); H.ban.classList.remove('on'); H.tell.classList.remove('on'); D.blind(0);
    labels(null); $('aico') && ($('aico').style.visibility = ''); if (APANEL) APANEL.setAct({ label: 'ACT', kind: 'reset' }, 1);
    try { window.__radio && __radio.fightDuck(false); } catch (e) {}
    const T = K.trigger || D.ret; // back to the street, a step out from the entrance
    if (T) { hero.pos.set(T.ox ?? T.x, 0, T.oz ?? T.z); hero.pos.y = groundY(hero.pos.x, hero.pos.z); hero.vel.set(0, 0); hero.set('move');
      partner.pos.set(hero.pos.x - 1.2, hero.pos.y, hero.pos.z - 0.8); partner.vel.set(0, 0); }
    KEYS.clear(); PRESS.clear(); last = performance.now();
  };
  function resizeCam() { const K = D.cur; if (!K || !K.cam) return; K.cam.aspect = VW() / VH(); K.cam.updateProjectionMatrix(); if (K.onResize) K.onResize(); }
  addEventListener('resize', () => setTimeout(resizeCam, 0));
  D.frame = function (rdt) {
    const K = D.cur; if (!K) return; D.frames++;
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) {
      const dt = SIM ? 1 / 60 : rdt; D.t += dt;
      if (D.bot && !overMode && K.botThink) K.botThink(D.bot, dt);
      if (D.bot && overMode) { D.bot.overT = (D.bot.overT || 0) + dt; if (D.bot.overT > 1.2) { D.bot.overT = 0; if (overMode === 'win') D.bot.ok = true; else if (D.bot.mode === 'lose' && !D.bot.retried) { D.bot.retried = true; D.bot.ok = true; } else if (D.bot.mode === 'win') D.bot.ok = true; else D.bot.back = true; } }
      const I = (D.I = input()); if (k < steps - 1) PRESS.clear();
      if (overMode) { D.overT += dt; if (I.ok || I.a) overPick(true); else if (I.back || I.b) overPick(false); if (!D.cur) return; }
      if (!K.lbl) { K.lbl = true; labels(K.labels); } // (re-applied on the first duel frame: the city HUD may have relabelled ACT in the frame the duel started)
    K.step(dt, I); if (!D.cur) return; hudTick(dt);
    }
    K.render(rdt); draw(K.scene, K.cam);
    PRESS.clear();
  };

  // ---------------- city side: a glowing ring + soft beam at each duel entrance; ACT there = FIGHT ----------------
  const BEAM = { list: [] };
  const ringT = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128);
  D.addTrigger = function (id, L, x, z, ox, oz, col) {
    const K = D.kinds[id]; if (!K || !L || !L.boss) return;
    K.trigger = { x, z, ox, oz, lm: L.id }; const y = groundY(x, z);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: ringT, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.04, z); ring.renderOrder = 2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.2, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beam.position.set(x, y + 3.5, z); scene.add(ring, beam); BEAM.list.push({ ring, beam, L, K });
    ACTIONS.push({ kind: 'boss', label: 'FIGHT', x, z, r: 1.7, y: 2.2, ok: () => !L.boss.cleared && !D.cur && (!BOT || Q.has('duels')), go: () => D.start(id) });
  };
  MODE.ticks.push((rdt) => { for (const b of BEAM.list) { const d = Math.hypot(b.ring.position.x - hero.pos.x, b.ring.position.z - hero.pos.z), on = !b.L.boss.cleared; // one extra draw call at most: the beam from afar, the ring up close
    b.beam.visible = on && d > 9 && d < 45; b.ring.visible = on && d <= 9; if (b.ring.visible) b.ring.rotation.z += rdt * 0.8; if (b.beam.visible) b.beam.material.opacity = 0.12 + 0.06 * Math.sin(S.time * 3); } });
  D.BEAM = BEAM;
  // start straight away: ?duel=jimmy | chipkid (after the first frames, skipping the intro)
  if (Q.get('duel')) { const id = Q.get('duel'); let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !D.cur) { if (CINE.intro) CINE.intro.skip = true; D.start(id); } }); }
  window.__duels = D; D.BC = BOSS_CLEAR;
  return D;
})();

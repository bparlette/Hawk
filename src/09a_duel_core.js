
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
  @media (max-width: 480px) { #duel .dban { font-size: 22px; } #duel .dbar .n { font-size: 9px; } #duel .dban small { font-size: 10px; }
    #duel .dtell { font-size: 10px; white-space: normal; max-width: 92vw; width: max-content; text-align: center; line-height: 1.4; box-sizing: border-box; }
    #duel .dover h2 { font-size: 18px; } #duel .dover p { font-size: 9px; } #duel .dover button { font-size: 11px; padding: 11px 12px; } }`; // polish: nothing clips at 390 px
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
  D.over = (mode, title, text, opts) => { overMode = mode; H.oh.innerHTML = title; H.op.innerHTML = text || ''; H.ob1.textContent = mode === 'win' ? 'CONTINUE' : 'RETRY'; D.overAgain = !!(opts && opts.again && mode === 'win'); H.ob2.textContent = D.overAgain ? 'REMATCH' : 'LEAVE'; H.ob2.style.display = mode === 'win' && !D.overAgain ? 'none' : ''; H.over.classList.add('on'); D.overT = 0; }; // chipkid-fun: opts.again = a REMATCH button on the win card (calls K.again)
  const overClose = () => { H.over.classList.remove('on'); const m = overMode; overMode = null; return m; };
  D.overOn = () => !!overMode;
  function overPick(retry) { if (!overMode || D.overT < 0.6) return; const again = D.overAgain; D.overAgain = false; const m = overClose(); if (m === 'win' && !retry && again && D.cur.again) { D.log.push('again'); D.cur.again(); } else if (m === 'win') D.exit('win'); else if (retry) { D.log.push('retry'); D.retries++; D.cur.retry(); } else D.exit('leave'); }
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


  // ---------------- chipkid-fun: shared hit juice for every duel (all opt-in: a duel that never calls these renders and plays exactly as before) ----------------
  // D.hitstop(s) freeze the sim · D.slowmo(scale, s) · D.shake(a) · D.zoom(k, s) · D.flash(css colour, a) · D.pop(text, worldPos, cls 'big'|'crit'|'heal'|'word')
  // D.combo(n) hit counter · D.power(v 0..1, ready, label) meter under the player bar · D.ready(html|null) big pulsing prompt · D.hitSfx(kind)
  // D.impact({ stop, shake, flash, flashA, zoom, zoomT, slow, slowT, sfx, pop, pos, cls }) all-in-one · D.trail(scene, col) cane / weapon motion ribbon (1 draw call)
  // D.debris(scene, max) tumbling chips / shreds (1 draw call) · D.sprites(scene, tex, max, additive) camera-facing sparks / puffs / rings (1 draw call)
  const J = { hs: 0, slow: 1, slowT: 0, sh: 0, zk: 1, zT: 0, zT0: 0, fl: 0 };
  { const c2 = document.createElement('style'); c2.textContent = `
  #duel .dflash { position: absolute; inset: 0; opacity: 0; background: #fff; }
  #duel .dpop { position: absolute; left: 0; top: 0; font-size: 18px; color: #fff; text-shadow: 2px 2px 0 #14101f, -2px -2px 0 #14101f, 2px -2px 0 #14101f, -2px 2px 0 #14101f; white-space: nowrap; opacity: 0; will-change: transform; }
  #duel .dpop.crit { color: #ffd23c; font-size: 22px; } #duel .dpop.big { color: #ff5a3c; font-size: 30px; } #duel .dpop.heal { color: #9dff6b; } #duel .dpop.word { color: #fff36a; font-size: 26px; letter-spacing: 1px; }
  #duel .dcombo { position: absolute; right: 12px; top: 38%; text-align: right; color: #ffd23c; font-size: 30px; line-height: 1; text-shadow: 3px 3px 0 #14101f, -2px -2px 0 #14101f; opacity: 0; transition: opacity .25s; }
  #duel .dcombo small { display: block; font-size: 11px; color: #fff; letter-spacing: 2px; margin-top: 3px; }
  #duel .dcombo.on { opacity: 1; transition: none; }
  #duel .dpow { position: absolute; left: 10px; top: calc(env(safe-area-inset-top, 0px) + 98px); width: min(220px, 46vw); display: none; }
  body.duel-pw #duel .dpow { display: block; }
  #duel .dpow .n { font-size: 9px; color: #9ff8ff; letter-spacing: 1px; margin-bottom: 3px; text-shadow: 2px 2px 0 #14101f; }
  #duel .dpow .t { height: 11px; background: #14101f; border: 2px solid #14101f; border-radius: 7px; position: relative; overflow: hidden; box-shadow: 2px 2px 0 #14101f; }
  #duel .dpow .t i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #39b6ff, #b06bff); transition: width .12s; }
  #duel .dpow.rdy .t i { background: linear-gradient(90deg, #ffd23c, #ff7a2a, #ffd23c); background-size: 200% 100%; animation: dpw .5s linear infinite; }
  #duel .dpow.rdy .t { box-shadow: 0 0 12px 3px #ffd23c, 2px 2px 0 #14101f; } #duel .dpow.rdy .n { color: #ffd23c; }
  @keyframes dpw { from { background-position: 0 0; } to { background-position: 200% 0; } }
  #duel .dready { position: absolute; left: 50%; bottom: 5%; transform: translateX(-50%); font-size: 16px; color: #14101f; background: #ffd23c; border: 3px solid #14101f; border-radius: 12px; padding: 8px 14px; box-shadow: 0 0 18px 4px rgba(255,210,60,.8), 3px 3px 0 #14101f; white-space: nowrap; display: none; animation: drdy .45s ease-in-out infinite alternate; }
  #duel .dready.on { display: block; }
  @keyframes drdy { from { transform: translateX(-50%) scale(.94); } to { transform: translateX(-50%) scale(1.06); } }
  body.duel-pw #aact.hot { animation: dpbtn .35s ease-in-out infinite alternate; }
  @keyframes dpbtn { from { filter: brightness(1.1) drop-shadow(0 0 4px #ffd23c); transform: translate(-50%, -50%) scale(1); } to { filter: brightness(1.45) drop-shadow(0 0 16px #ffd23c); transform: translate(-50%, -50%) scale(1.12); } }
  @media (max-width: 480px) { #duel .dready { font-size: 13px; white-space: normal; max-width: 90vw; width: max-content; text-align: center; box-sizing: border-box; } #duel .dcombo { font-size: 24px; }
    #duel .dpop { font-size: 14px; } #duel .dpop.crit { font-size: 17px; } #duel .dpop.big { font-size: 22px; } #duel .dpop.word { font-size: 19px; } }`; document.head.appendChild(c2); }
  const jx = document.createElement('div'); jx.innerHTML = '<div class="dflash"></div><div class="dcombo"></div><div class="dpow"><div class="n">POWER</div><div class="t"><i></i></div></div><div class="dready"></div>';
  while (jx.firstChild) hud.insertBefore(jx.firstChild, H.over);
  const JH = { fl: q('.dflash'), co: q('.dcombo'), pw: q('.dpow'), pwi: q('.dpow i'), pwn: q('.dpow .n'), rd: q('.dready'), pops: [] };
  for (let i = 0; i < 12; i++) { const e = document.createElement('div'); e.className = 'dpop'; hud.insertBefore(e, H.over); JH.pops.push({ e, t: 9, life: 0.9, p: new THREE.Vector3(), dx: 0 }); }
  let popI = 0, coT = 0;
  D.hitstop = (s) => { J.hs = Math.max(J.hs, s); };
  D.slowmo = (k, s) => { J.slow = k; J.slowT = Math.max(J.slowT, s); };
  D.shake = (a) => { J.sh = Math.max(J.sh, a); };
  D.zoom = (k, s) => { J.zk = k; J.zT = J.zT0 = s; };
  D.flash = (col = '#fff', a = 0.7) => { JH.fl.style.background = col; J.fl = Math.max(J.fl, a); };
  D.pop = (text, pos, cls = '') => { const o = JH.pops[popI++ % JH.pops.length]; o.e.className = 'dpop ' + cls; o.e.textContent = text; o.p.copy(pos); o.t = 0; o.life = cls === 'word' || cls === 'big' ? 1.1 : 0.85; o.dx = (Math.random() - 0.5) * 40; o.w = 0; };
  D.combo = (n) => { if (n < 2) { JH.co.classList.remove('on'); return; } JH.co.innerHTML = n + '<small>HIT COMBO!</small>'; JH.co.classList.add('on'); JH.co.style.transform = 'scale(1.35) rotate(-4deg)'; coT = 1.4; };
  D.power = (v, ready, label) => { document.body.classList.add('duel-pw'); JH.pwi.style.width = (clamp(v, 0, 1) * 100).toFixed(1) + '%'; JH.pw.classList.toggle('rdy', !!ready); const n = label || (ready ? 'POWER READY!' : 'POWER'); if (JH.pwn.__h !== n) { JH.pwn.textContent = n; JH.pwn.__h = n; } };
  D.ready = (html) => { if (!html) { JH.rd.classList.remove('on'); return; } if (JH.rd.__h !== html) { JH.rd.innerHTML = html; JH.rd.__h = html; } JH.rd.classList.add('on'); };
  D.impact = (o = {}) => { if (o.stop) D.hitstop(o.stop); if (o.shake) D.shake(o.shake); if (o.flash) D.flash(o.flash, o.flashA ?? 0.6); if (o.zoom) D.zoom(o.zoom, o.zoomT ?? 0.35); if (o.slow) D.slowmo(o.slow, o.slowT ?? 0.4); if (o.sfx) D.hitSfx(o.sfx); if (o.pop && o.pos) D.pop(o.pop, o.pos, o.cls || ''); try { if (o.stop >= 0.08 && navigator.vibrate) navigator.vibrate(30); } catch (e) {} };
  // chunky hit sounds (WebAudio, through the shared SFX bus): light | heavy | mega | boom | whoosh | power | crunch
  D.hitSfx = (kind = 'light') => { if (!AC || AC.state !== 'running') return; const t = AC.currentTime; try {
    const out = AC.createGain(); out.connect(SFXBUS || AC.destination);
    const thump = (f0, f1, dur, vol) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); };
    const noise = (type, f, q, dur, vol, f2) => { const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02); };
    const crack = (f, dur, vol) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.3, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); };
    if (kind === 'light') { thump(170, 55, 0.14, 0.32); noise('bandpass', 2200, 1.2, 0.07, 0.22); crack(420, 0.05, 0.06); }
    else if (kind === 'heavy') { thump(140, 38, 0.24, 0.45); noise('lowpass', 3000, 0.7, 0.16, 0.3); crack(300, 0.09, 0.09); noise('highpass', 5000, 0.8, 0.12, 0.12); }
    else if (kind === 'mega') { thump(110, 28, 0.5, 0.55); noise('lowpass', 1800, 0.7, 0.45, 0.4, 300); crack(240, 0.16, 0.12); noise('highpass', 4200, 0.8, 0.3, 0.16); }
    else if (kind === 'boom') { thump(90, 22, 0.9, 0.6); noise('lowpass', 1200, 0.6, 0.9, 0.5, 120); }
    else if (kind === 'crunch') { for (let k = 0; k < 3; k++) { const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(), tt = t + k * 0.035; s.buffer = NOISE; fl.type = 'bandpass'; fl.frequency.value = 2600 + k * 900; fl.Q.value = 3; g.gain.setValueAtTime(0.16, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05); s.connect(fl); fl.connect(g); g.connect(out); s.start(tt); s.stop(tt + 0.06); } }
    else if (kind === 'whoosh') noise('bandpass', 500, 1.5, 0.22, 0.2, 2600);
    else if (kind === 'power') { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.62); }
  } catch (e) {} };
  // motion ribbon: push(base, tip) each frame while swinging; fades over `life` s
  D.trail = (sc, col = '#fff', n = 16, life = 0.16) => { const P = new Float32Array(n * 2 * 3), Cc = new Float32Array(n * 2 * 3), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; m.visible = false; m.renderOrder = 3; sc.add(m);
    const S = [], c = new THREE.Color(col); const T = { mesh: m, col: c, push(a, b) { S.unshift({ a: a.clone(), b: b.clone(), t: 0 }); if (S.length > n) S.pop(); }, clear() { S.length = 0; m.visible = false; },
      update(dt) { for (const s of S) s.t += dt; while (S.length && S[S.length - 1].t > life) S.pop(); m.visible = S.length > 1; if (!m.visible) return;
        for (let i = 0; i < n; i++) { const s = S[Math.min(i, S.length - 1)], k = i < S.length ? Math.max(0, 1 - s.t / life) * (1 - i / n) : 0; P.set([s.a.x, s.a.y, s.a.z], i * 6); P.set([s.b.x, s.b.y, s.b.z], i * 6 + 3); Cc.set([c.r * k * 0.25, c.g * k * 0.25, c.b * k * 0.25], i * 6); Cc.set([c.r * k, c.g * k, c.b * k], i * 6 + 3); }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeBoundingSphere(); } }; return T; };
  // tumbling debris (chips, foil shreds): burst(pos, n, { cols, spd, up, size, life, floor })
  D.debris = (sc, max = 160) => { const g = new THREE.CircleGeometry(0.5, 7); const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }), max); m.count = 0; m.frustumCulled = false; sc.add(m);
    const L = [], M4 = new THREE.Matrix4(), Qq = new THREE.Quaternion(), E = new THREE.Euler(), Sv = new THREE.Vector3(), cc = new THREE.Color(); m.setColorAt(0, cc.set('#fff'));
    const B = { mesh: m, list: L, burst(p, n, o = {}) { const cols = o.cols || ['#f2c25a', '#e8a83a', '#ffd98a'], spd = o.spd ?? 4, up = o.up ?? 3; for (let k = 0; k < n && L.length < max; k++) { const a = Math.random() * TAU;
        L.push({ p: p.clone(), v: new THREE.Vector3(Math.cos(a) * spd * Math.random() + (o.vx || 0), up * (0.5 + Math.random()) , Math.sin(a) * spd * Math.random() + (o.vz || 0)), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(rnd(-14, 14), rnd(-14, 14), rnd(-6, 6)), s: (o.size || 0.16) * rnd(0.6, 1.3), sy: o.sy ?? rnd(0.7, 1), t: 0, life: (o.life || 1.4) * rnd(0.7, 1.2), col: cols[Math.floor(Math.random() * cols.length)], floor: o.floor ?? 0.22 }); } },
      clear() { L.length = 0; m.count = 0; },
      update(dt) { for (let i = L.length - 1; i >= 0; i--) { const d = L[i]; d.t += dt; d.v.y -= 9.5 * dt; d.p.addScaledVector(d.v, dt); if (d.p.y < d.floor) { d.p.y = d.floor; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); } d.r.addScaledVector(d.w, dt); if (d.t > d.life) L.splice(i, 1); }
        L.forEach((d, i) => { const k = d.s * Math.min(1, (d.life - d.t) * 4); M4.compose(d.p, Qq.setFromEuler(E.set(d.r.x, d.r.y, d.r.z)), Sv.set(k, k * d.sy, k)); m.setMatrixAt(i, M4); m.setColorAt(i, cc.set(d.col)); });
        m.count = L.length; m.visible = L.length > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }; return B; };
  // camera-facing sprites: burst(pos, n, { spd, up, size, grow, life, grav, drag })
  D.sprites = (sc, tex, max = 64, add = true) => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }), max); m.count = 0; m.frustumCulled = false; m.renderOrder = 4; sc.add(m);
    const L = [], M4 = new THREE.Matrix4(), Sv = new THREE.Vector3();
    const B = { mesh: m, list: L, burst(p, n, o = {}) { for (let k = 0; k < n && L.length < max; k++) { const v = o.v ? o.v.clone() : new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 0.3)).normalize().multiplyScalar((o.spd ?? 4) * rnd(0.4, 1)); if (o.up) v.y += o.up;
        L.push({ p: p.clone(), v, s: (o.size || 0.3) * rnd(0.7, 1.3), grow: o.grow || 0, t: 0, life: (o.life || 0.45) * rnd(0.8, 1.2), grav: o.grav ?? 6, drag: o.drag ?? 1.5 }); } },
      clear() { L.length = 0; m.count = 0; },
      update(dt, cam) { for (let i = L.length - 1; i >= 0; i--) { const d = L[i]; d.t += dt; d.v.y -= d.grav * dt; d.v.multiplyScalar(Math.max(0, 1 - d.drag * dt)); d.p.addScaledVector(d.v, dt); if (d.t > d.life) L.splice(i, 1); }
        L.forEach((d, i) => { const u = d.t / d.life, k = d.s * (1 + d.grow * u) * (d.grow ? 1 : 1 - u * 0.7); M4.compose(d.p, cam.quaternion, Sv.set(k, k, k)); m.setMatrixAt(i, M4); }); m.count = L.length; m.visible = L.length > 0; m.instanceMatrix.needsUpdate = true; } }; return B; };
  const _jv = new THREE.Vector3();
  J.tick = (dt) => { if (coT > 0 && (coT -= dt) <= 0) JH.co.classList.remove('on'); };
  J.draw = (K, rdt) => { const cam = K.cam, w = hud.clientWidth || VW(), h = hud.clientHeight || VH();
    if (coT > 0) JH.co.style.transform = 'scale(' + (1 + Math.max(0, coT - 1.25) * 2.4).toFixed(2) + ') rotate(-4deg)';
    if (J.fl > 0) { JH.fl.style.opacity = J.fl.toFixed(2); J.fl = Math.max(0, J.fl - rdt * 3.2); if (J.fl === 0) JH.fl.style.opacity = '0'; }
    for (const o of JH.pops) { if (o.t >= o.life) continue; o.t += rdt; const u = o.t / o.life; _jv.copy(o.p); _jv.y += u * 1.1; _jv.project(cam);
      if (o.t >= o.life || _jv.z > 1) { o.e.style.opacity = '0'; o.t = 9; continue; } const sc = u < 0.12 ? 0.6 + u / 0.12 * 0.9 : 1.5 - Math.min(0.5, (u - 0.12) * 2);
      if (!o.w) o.w = o.e.offsetWidth || 1; const hw = o.w * sc / 2 + 4, px = clamp((_jv.x * 0.5 + 0.5) * w + o.dx * u, Math.min(w / 2, hw), Math.max(w / 2, w - hw)); // polish: keep the whole pop on screen
      o.e.style.opacity = String(u > 0.7 ? (1 - u) / 0.3 : 1); o.e.style.transform = `translate(${px.toFixed(1)}px, ${((-_jv.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`; }
    const sh = J.sh, zoom = J.zT > 0; let fov0 = 0;
    if (sh > 0.001) { _jv.copy(cam.position); cam.position.x += (Math.random() - 0.5) * sh * 0.6; cam.position.y += (Math.random() - 0.5) * sh * 0.6; cam.position.z += (Math.random() - 0.5) * sh * 0.3; J.sh = Math.max(0, sh - rdt * Math.max(1.2, sh * 4)); }
    if (zoom) { J.zT -= rdt; fov0 = cam.fov; const u = 1 - Math.max(0, J.zT) / J.zT0, k = 1 + (J.zk - 1) * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5) * (u > 0.75 ? (1 - u) / 0.25 : 1); cam.fov = fov0 / k; cam.updateProjectionMatrix(); }
    draw(K.scene, cam);
    if (sh > 0.001) cam.position.copy(_jv); if (zoom) { cam.fov = fov0; cam.updateProjectionMatrix(); } };
  D.juiceReset = () => { J.hs = 0; J.slowT = 0; J.slow = 1; J.sh = 0; J.zT = 0; J.fl = 0; JH.fl.style.opacity = '0'; JH.co.classList.remove('on'); coT = 0; JH.rd.classList.remove('on'); for (const o of JH.pops) { o.t = 9; o.e.style.opacity = '0'; } };
  D.J = J;
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
    D.juiceReset(); document.body.classList.remove('duel-pw'); // chipkid-fun
    MODE.duel = D; K.lbl = false; D.log.push('start:' + id); K.start(opts); resizeCam(); return true;
  };
  D.exit = function (why) {
    const K = D.cur; if (!K) return; D.log.push('exit:' + K.id + ':' + why); D.result = why;
    if (K.exit) K.exit(why);
    MODE.duel = null; D.cur = null; D.bot = null;
    D.juiceReset(); D.hold = false; document.body.classList.remove('duel-pw'); // chipkid-fun
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
    if (D.hold) { K.render(0); draw(K.scene, K.cam); PRESS.clear(); return; } // chipkid-fun: test freeze (screenshots)
    for (let k = 0; k < steps; k++) {
      let dt = SIM ? 1 / 60 : rdt;
      if (J.hs > 0) { J.hs -= dt; J.tick(dt); hudTick(dt); if (K.buffer && !overMode) { if (D.bot && K.botThink) K.botThink(D.bot, 0); K.buffer(input()); if (k < steps - 1) PRESS.clear(); } continue; } // (no K.buffer: presses wait in PRESS for the first frame after the stop) // chipkid-fun: hitstop freezes the duel sim (render keeps going)
      if (J.slowT > 0) { J.slowT -= dt; dt *= J.slow; } J.tick(dt); D.t += dt;
      if (D.bot && !overMode && K.botThink) K.botThink(D.bot, dt);
      if (D.bot && overMode) { D.bot.overT = (D.bot.overT || 0) + dt; if (D.bot.overT > 1.2) { D.bot.overT = 0; if (overMode === 'win') D.bot.ok = true; else if (D.bot.mode === 'lose' && !D.bot.retried) { D.bot.retried = true; D.bot.ok = true; } else if (D.bot.mode === 'win') D.bot.ok = true; else D.bot.back = true; } }
      const I = (D.I = input()); if (k < steps - 1) PRESS.clear();
      if (overMode) { D.overT += dt; if (I.ok || I.a) overPick(true); else if (I.back || I.b) overPick(false); if (!D.cur) return; }
      if (!K.lbl) { K.lbl = true; labels(K.labels); } // (re-applied on the first duel frame: the city HUD may have relabelled ACT in the frame the duel started)
    BOSSX.frame(dt, I); K.step(dt * BOSSX.tempo(), I); if (!D.cur) return; hudTick(dt); if (D.hold) break; // chipkid-fun: (test freeze)
    }
    const frozen = J.hs > 0; K.render(frozen ? 0 : rdt); J.draw(K, rdt); // chipkid-fun: J.draw = draw() with the shared shake / zoom / pop layer (no-ops unless a duel asks); polish: poses hold still during a hitstop
    if (!(frozen && !K.buffer)) PRESS.clear();
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

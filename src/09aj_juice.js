
// ======================= JUICE: shared game-feel kit for every boss duel (hark/juice, 2026-10-13).
// Loaded right after 09a_duel_core.js (name sorts after "09a_" and before "09b" in both C and en_US collation) and before every boss file.
//   JUICE.hitstop(ms[, st])     freeze the duel for ms. With a fight's own state object st it only raises st.hs (that fight's own clock keeps it, unchanged feel).
//   JUICE.shake(amp, ms[, st])  camera shake. With st it only raises st.shake (the fight's own camera code reads it). Without, a decaying offset on the duel camera.
//   JUICE.pop(text, pos, style) a world-anchored damage / word pop in the duel HUD (style: 'hit' | 'crit' | 'word' | 'ko' | 'combo' | {color, size}).
//   JUICE.combo(n)              a punchy "N HITS" chip (n < 2 hides it).
//   JUICE.ko([focus])           call at a boss KO: the last ~3 s are already in the ring buffer; ~0.5 s later the fight pauses and the final-blow replay plays.
//   JUICE.finalBlowReplay([o])  play the replay now (2-3 s, slow-mo around the blow, low dramatic orbit, letterbox, TAP TO SKIP). Returns false with no footage.
// The replay records the duel camera + the transforms (pos / quat / scale / visible) of every moving object in the duel scene, ~30 Hz, into a ring buffer.
// While it plays, the fight's step() is NOT called (sim, timers, the bot all wait), the camera + actors are driven from the footage, then everything is put back
// exactly as it was at replay start and the fight carries on (its own KO outro, then the WIN card). A DUELS.over('win') issued during or before the replay
// is held and shown when it ends; a duel that never called JUICE.ko still gets a replay of its last seconds right before its WIN card (fallback).
// Any fresh tap / click / key / pad button skips it. LEAVE / exit restores and stops it. Tests: window.__juice (replays, skips, last, on).
const JUICE = (function () {
  const J = { on: false, replays: 0, skips: 0, last: null, log: [] };
  // ---------------- HUD bits (inside the duel HUD so they hide with it) ----------------
  const css = document.createElement('style');
  css.textContent = `
  #duel .jpop { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); font-size: 14px; color: #fff; white-space: nowrap; pointer-events: none; opacity: 0;
    text-shadow: 2px 2px 0 #14101f, -2px -2px 0 #14101f, 2px -2px 0 #14101f, -2px 2px 0 #14101f; will-change: transform, opacity; }
  #duel .jpop.crit { color: #ffd23c; font-size: 18px; } #duel .jpop.word { color: #ff8ab0; font-size: 16px; } #duel .jpop.ko { color: #ffd23c; font-size: 26px; } #duel .jpop.combo { color: #9dff6b; font-size: 13px; }
  #duel .jcombo { position: absolute; left: 10px; top: 44%; font-size: 12px; color: #ffd23c; text-shadow: 2px 2px 0 #14101f; opacity: 0; transition: opacity .25s; pointer-events: none; }
  #duel .jcombo b { font-size: 22px; display: inline-block; margin-right: 4px; } #duel .jcombo.on { opacity: 1; } #duel .jcombo.k b { animation: jpunch .22s ease-out; }
  @keyframes jpunch { from { transform: scale(1.7) rotate(-8deg); } to { transform: scale(1) rotate(0); } }
  #duel.jrp > *:not(.jrp) { visibility: hidden !important; }
  #duel .jrp { position: absolute; inset: 0; display: none; pointer-events: auto; touch-action: none; }
  #duel.jrp .jrp { display: block; }
  #duel .jrp i { position: absolute; left: 0; right: 0; height: 12%; background: #000; transition: transform .28s ease-out; }
  #duel .jrp i.t { top: 0; transform: translateY(-100%); } #duel .jrp i.b { bottom: 0; transform: translateY(100%); }
  #duel .jrp.in i { transform: none; }
  #duel .jrp .tag { position: absolute; left: 12px; top: calc(12% - 22px); font-size: 11px; color: #fff; letter-spacing: 2px; }
  #duel .jrp .tag:before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ff3d4a; margin-right: 7px; vertical-align: 0; animation: jrec .8s infinite alternate; }
  @keyframes jrec { to { opacity: .2; } }
  #duel .jrp .sk { position: absolute; right: 12px; bottom: calc(6% - 6px); font-size: 11px; color: #ffd23c; letter-spacing: 1px; animation: jrec .9s infinite alternate; }
  #duel .jrp .fl { position: absolute; inset: 0; background: #fff; opacity: 0; transition: opacity .25s; pointer-events: none; }
  #duel .jrp .fl.on { opacity: .75; transition: none; }`;
  document.head.appendChild(css);
  let hud = null, ov = null, ovFl = null, comboEl = null; const POPS = [];
  function ui() {
    if (hud) return hud; hud = DUELS.hudEl;
    for (let i = 0; i < 8; i++) { const e = document.createElement('div'); e.className = 'jpop'; hud.appendChild(e); POPS.push({ e, t: 9, life: 1, p: new THREE.Vector3(), rise: 1 }); }
    comboEl = document.createElement('div'); comboEl.className = 'jcombo'; hud.appendChild(comboEl);
    ov = document.createElement('div'); ov.className = 'jrp'; ov.innerHTML = '<i class="t"></i><i class="b"></i><div class="tag">FINAL BLOW \u00b7 REPLAY</div><div class="sk">TAP TO SKIP \u25b6</div><div class="fl"></div>';
    hud.appendChild(ov); ovFl = ov.querySelector('.fl');
    ov.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tapped = true; });
    return hud;
  }

  // ---------------- hitstop / shake / pop / combo ----------------
  let hsT = 0, shA = 0, shT = 0, shD = 0; const shOff = new THREE.Vector3(); let shCam = null;
  J.hitstop = (ms, st) => { const s = Math.max(0, +ms || 0) / 1000; if (st) { st.hs = Math.max(st.hs || 0, s); return; } hsT = Math.max(hsT, Math.min(0.4, s)); };
  J.shake = (amp, ms, st) => { amp = +amp || 0; if (st) { st.shake = Math.max(st.shake || 0, amp); return; } if (amp >= shA * (shD > 0 ? shT / shD : 0)) { shA = amp; shD = shT = Math.max(0.05, (+ms || 250) / 1000); } };
  J.pop = (text, pos, style = 'hit') => { ui(); const P = POPS.find((q) => q.t >= q.life) || POPS.reduce((a, b) => (a.t > b.t ? a : b)); P.t = 0; P.p.copy(pos);
    const o = typeof style === 'object' ? style : null; P.e.className = 'jpop' + (o ? '' : ' ' + style); P.e.style.color = o && o.color || ''; P.e.style.fontSize = o && o.size ? o.size + 'px' : '';
    P.life = style === 'ko' ? 1.4 : 0.9; P.rise = style === 'ko' ? 0.6 : 1.2; P.e.textContent = text; };
  let comboT = 0;
  J.combo = (n) => { ui(); if (!(n >= 2)) { comboEl.classList.remove('on'); comboT = 0; return; } comboEl.innerHTML = '<b>' + n + '</b>HITS'; comboEl.classList.remove('k'); void comboEl.offsetWidth; comboEl.classList.add('on', 'k'); comboT = 1.4; };
  const PV = new THREE.Vector3();
  function hudTick(dt, cam) {
    for (const P of POPS) { if (P.t >= P.life) continue; P.t += dt; const u = Math.min(1, P.t / P.life);
      if (u >= 1 || !cam) { P.e.style.opacity = '0'; continue; }
      PV.copy(P.p); PV.y += u * P.rise; PV.project(cam); if (PV.z > 1) { P.e.style.opacity = '0'; continue; }
      const x = (PV.x * 0.5 + 0.5) * VW(), y = (-PV.y * 0.5 + 0.5) * VH(), s = u < 0.15 ? 1.6 - u * 4 : 1;
      P.e.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + s.toFixed(2) + ')'; P.e.style.opacity = String(u > 0.7 ? (1 - u) / 0.3 : 1); }
    if (comboT > 0 && (comboT -= dt) <= 0) comboEl.classList.remove('on');
  }

  // ---------------- ring buffer: camera + every moving object of the duel scene ----------------
  const NS = 110, RATE = 1 / 30, CAP = 1500, F = 11;
  const ring = []; let head = 0, count = 0, lastRec = -9, list = null, listK = null, listN = -1, listT = -9;
  const save = { list: null, n: 0, buf: null, cam: new Float32Array(12) };
  function buildList(K) { const L = []; K.scene.traverse((o) => { if (o !== K.scene && L.length < CAP && o.matrixAutoUpdate !== false) L.push(o); }); return L; }
  function grab(slot, K, L) {
    const n = L.length; if (!slot.buf || slot.buf.length < n * F) slot.buf = new Float32Array(Math.max(n, 64) * F);
    const b = slot.buf; for (let i = 0, j = 0; i < n; i++, j += F) { const o = L[i], p = o.position, q = o.quaternion, s = o.scale;
      b[j] = p.x; b[j + 1] = p.y; b[j + 2] = p.z; b[j + 3] = q.x; b[j + 4] = q.y; b[j + 5] = q.z; b[j + 6] = q.w; b[j + 7] = s.x; b[j + 8] = s.y; b[j + 9] = s.z; b[j + 10] = o.visible ? 1 : 0; }
    slot.list = L; slot.n = n; const c = slot.cam, cp = K.cam.position, cq = K.cam.quaternion;
    c[0] = cp.x; c[1] = cp.y; c[2] = cp.z; c[3] = cq.x; c[4] = cq.y; c[5] = cq.z; c[6] = cq.w; c[7] = K.cam.fov || 60;
    if (K.camL && K.camL.isVector3) { c[8] = K.camL.x; c[9] = K.camL.y; c[10] = K.camL.z; c[11] = 1; } else c[11] = 0;
  }
  function record(K, t) {
    if (t - lastRec < RATE * 0.999 && t >= lastRec) return; lastRec = t;
    if (K !== listK || !list || K.scene.children.length !== listN || t - listT > 1.5 || t < listT) { list = buildList(K); listK = K; listN = K.scene.children.length; listT = t; }
    let slot = ring[head]; if (!slot) slot = ring[head] = { t: 0, list: null, n: 0, buf: null, cam: new Float32Array(12) };
    grab(slot, K, list); slot.t = t; head = (head + 1) % NS; count = Math.min(NS, count + 1);
  }
  function reset() { head = 0; count = 0; lastRec = -9; list = null; listK = null; for (const s of ring) { s.list = null; } koAt = -1; koFocus = null; done = false; }
  const at = (k) => ring[(head - count + k + NS * 2) % NS]; // k = 0 oldest .. count-1 newest

  // apply footage (interpolated between slots a and b by u) onto the live objects
  function apply(a, b, u) {
    const same = b && a.list === b.list && a.n === b.n; if (!same) u = 0; const A = a.buf, B = same ? b.buf : A, L = a.list, v = 1 - u;
    for (let i = 0, j = 0; i < a.n; i++, j += F) { const o = L[i];
      o.position.set(A[j] * v + B[j] * u, A[j + 1] * v + B[j + 1] * u, A[j + 2] * v + B[j + 2] * u);
      let bx = B[j + 3], by = B[j + 4], bz = B[j + 5], bw = B[j + 6]; if (A[j + 3] * bx + A[j + 4] * by + A[j + 5] * bz + A[j + 6] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      o.quaternion.set(A[j + 3] * v + bx * u, A[j + 4] * v + by * u, A[j + 5] * v + bz * u, A[j + 6] * v + bw * u).normalize();
      o.scale.set(A[j + 7] * v + B[j + 7] * u, A[j + 8] * v + B[j + 8] * u, A[j + 9] * v + B[j + 9] * u); o.visible = (u < 0.5 ? A[j + 10] : B[j + 10]) > 0.5; }
  }
  function camOf(slot, out, look) { const c = slot.cam; out.set(c[0], c[1], c[2]);
    if (c[11]) look.set(c[8], c[9], c[10]); else { Q0.set(c[3], c[4], c[5], c[6]); look.set(0, 0, -8).applyQuaternion(Q0).add(out); } }
  function restoreSave(K) { if (!save.list) return; apply(save, null, 0); const c = save.cam; K.cam.position.set(c[0], c[1], c[2]); K.cam.quaternion.set(c[3], c[4], c[5], c[6]); if (K.cam.fov !== c[7]) { K.cam.fov = c[7]; K.cam.updateProjectionMatrix(); } }

  // ---------------- KO + replay ----------------
  const Q0 = new THREE.Quaternion(), V0 = new THREE.Vector3(), V1 = new THREE.Vector3(), FOC = new THREE.Vector3(), FOC0 = new THREE.Vector3(), CP = new THREE.Vector3();
  let koAt = -1, koFocus = null, done = false, rp = null, held = null, tapped = false, padPrev = null;
  const TAIL = 0.5;
  J.ko = (focus) => { if (!DUELS.cur || done || koAt >= 0) return; koAt = DUELS.t; koFocus = focus && focus.isVector3 ? focus.clone() : focus && focus.x !== undefined ? new THREE.Vector3(focus.x, focus.y || 1.5, focus.z) : null; J.log.push('ko@' + koAt.toFixed(2)); };
  J.replayed = () => done;
  J.finalBlowReplay = (o = {}) => {
    const K = DUELS.cur; if (!K || !K.scene || !K.cam || rp || count < 8) return false;
    const tEnd = at(count - 1).t, tKo = o.koAt != null ? o.koAt : koAt >= 0 ? koAt : tEnd - 0.3;
    const t0 = Math.max(at(0).t, tKo - 1.9), t1 = tEnd;
    if (t1 - t0 < 0.4) return false;
    ui(); save.list = buildList(K); grab(save, K, save.list); // the state to put back afterwards
    // focus: what the camera was looking at on the blow (the fights' camL), or the point handed to JUICE.ko
    let ki = count - 1; for (let k = 0; k < count; k++) if (at(k).t >= tKo) { ki = k; break; }
    camOf(at(ki), CP, FOC0); if (koFocus) FOC0.copy(koFocus);
    const d0 = clamp(CP.distanceTo(FOC0), 3, 14); V0.set(CP.x - FOC0.x, 0, CP.z - FOC0.z); if (V0.lengthSq() < 1e-4) V0.set(0, 0, 1); V0.normalize();
    rp = { K, t0, t1, tKo, ft: t0, rt: 0, d0, dir: V0.clone(), side: (J.replays % 2 ? -1 : 1), fov0: K.cam.fov, max: 3.0 };
    done = true; J.on = true; J.replays++; J.last = { at: +DUELS.t.toFixed(2), span: +(t1 - t0).toFixed(2), frames: count, objs: save.n, skipped: false };
    J.log.push('replay:' + (K.id || '?'));
    hud.classList.add('jrp'); ov.classList.remove('in'); void ov.offsetWidth; ov.classList.add('in'); ovFl.classList.add('on'); setTimeout(() => ovFl.classList.remove('on'), 60);
    tapped = false; padPrev = padSnap(); PRESS.clear(); try { DUELS.log.push('juice:replay'); } catch (e) {}
    return true;
  };
  function padSnap() { const s = []; const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const gp of pads) if (gp) for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i] && gp.buttons[i].pressed) s.push(gp.index + ':' + i); return s.join(','); }
  const tb0 = {};
  function wantSkip() {
    let fresh = tapped || PRESS.size > 0; tapped = false;
    for (const n in TOUCHS.btn) { const v = !!TOUCHS.btn[n]; if (v && !tb0[n]) fresh = true; tb0[n] = v; }
    const p = padSnap(); if (p && p !== padPrev && p.length > (padPrev || '').length) fresh = true; padPrev = p;
    PRESS.clear(); return fresh;
  }
  function endReplay(skipped) {
    const r = rp; if (!r) return; rp = null; J.on = false; if (skipped) { J.skips++; if (J.last) J.last.skipped = true; }
    restoreSave(r.K); if (r.K.cam.fov !== r.fov0) { r.K.cam.fov = r.fov0; r.K.cam.updateProjectionMatrix(); }
    hud.classList.remove('jrp'); ov.classList.remove('in'); KEYS.clear(); PRESS.clear(); last = performance.now();
    if (held && DUELS.cur === r.K) { const h = held; held = null; ovr.apply(DUELS, h); } else held = null;
  }
  const ease = (x) => x * x * (3 - 2 * x);
  function replayFrame(rdt) {
    const r = rp, K = r.K, dt = SIM ? SIM / 30 : Math.min(0.1, rdt); // (?sim= test runs play it at 2x frame-rate so headless CI is not held up)
    if (r.rt > 0.35 && wantSkip()) { endReplay(true); return; } else if (r.rt <= 0.35) wantSkip();
    r.rt += dt;
    // slow-mo ramps in around the blow: 0.85x lead-in, 0.2x at the hit, 0.5x after
    const dk = r.ft - r.tKo, sp = dk < -0.35 ? 0.85 : dk < 0.3 ? 0.2 + 0.65 * Math.min(1, Math.abs(dk) / 0.35) * (dk < 0 ? 1 : 0.45) : 0.5;
    r.ft = Math.min(r.t1, r.ft + dt * sp);
    if (r.ft >= r.t1 - 1e-4 || r.rt > r.max) { endReplay(false); return; }
    let k = 0; while (k < count - 2 && at(k + 1).t < r.ft) k++;
    const a = at(k), b = at(Math.min(count - 1, k + 1)), u = b.t > a.t ? clamp((r.ft - a.t) / (b.t - a.t), 0, 1) : 0;
    apply(a, b, u);
    // dramatic camera: a low, close orbit round the blow, drifting with the action
    camOf(a, CP, FOC); camOf(b, V1, V0); FOC.lerp(V0, u); FOC.lerp(FOC0, 0.6);
    const w = clamp((r.ft - r.t0) / Math.max(0.1, r.t1 - r.t0), 0, 1), e = ease(w), ang = r.side * (1.05 - 1.5 * e), dist = r.d0 * (0.78 - 0.18 * e);
    V0.copy(r.dir).applyAxisAngle(UP, ang).multiplyScalar(dist); K.cam.position.set(FOC.x + V0.x, FOC.y + r.d0 * (0.04 + 0.14 * e), FOC.z + V0.z);
    K.cam.lookAt(FOC.x, FOC.y + 0.25, FOC.z); K.cam.rotateZ(r.side * 0.07 * (1 - e));
    const fov = r.fov0 * (dk > -0.1 && dk < 0.35 ? 0.82 : 0.9); if (Math.abs(K.cam.fov - fov) > 0.01) { K.cam.fov += (fov - K.cam.fov) * Math.min(1, dt * 10); K.cam.updateProjectionMatrix(); }
    if (dk > -0.02 && dk < 0.06 && !r.flash) { r.flash = true; ovFl.classList.add('on'); setTimeout(() => ovFl && ovFl.classList.remove('on'), 70); }
    draw(K.scene, K.cam);
  }
  const UP = new THREE.Vector3(0, 1, 0);

  // ---------------- hooks into the duel core (property wraps; 09a_duel_core.js itself is untouched) ----------------
  const ovr = DUELS.over, ofr = DUELS.frame, oex = DUELS.exit, ost = DUELS.start;
  DUELS.over = function (mode) {
    if (rp) { held = arguments; return; }
    if (mode === 'win' && !done && DUELS.cur && J.finalBlowReplay()) { held = arguments; return; } // fallback replay for duels that never called JUICE.ko
    if (mode !== 'win') { count = 0; koAt = -1; koFocus = null; done = false; } // a loss: next attempt records fresh
    return ovr.apply(DUELS, arguments);
  };
  DUELS.start = function () { reset(); hsT = shT = 0; held = null; const r = ost.apply(DUELS, arguments); return r; };
  DUELS.exit = function () { if (rp) endReplay(true); held = null; hsT = shT = 0; if (comboEl) J.combo(0); for (const P of POPS) { P.t = 9; P.e.style.opacity = '0'; } const r = oex.apply(DUELS, arguments); reset(); return r; };
  DUELS.frame = function (rdt) {
    const K = DUELS.cur; if (!K) return ofr.call(DUELS, rdt);
    if (rp) { if (rp.K !== K) { rp = null; J.on = false; } else { replayFrame(rdt); return; } }
    if (koAt >= 0 && !done && DUELS.t - koAt >= TAIL) { if (!J.finalBlowReplay()) done = true; if (rp) { replayFrame(0); return; } }
    if (hsT > 0) { hsT -= SIM ? SIM / 60 : Math.min(0.1, rdt); draw(K.scene, K.cam); return; } // global hitstop: hold the frame, input stays buffered
    if (!K.__jw && K.render) { const orr = K.render; K.__jw = true; K.render = function (d) { orr.call(K, d); shakeOn(K, d); }; }
    ofr.call(DUELS, rdt);
    if (shCam) { shCam.position.sub(shOff); shCam = null; } // the fights lerp their cameras from their own camP, so the offset is taken back right after the draw
    if (DUELS.cur === K && K.scene && K.cam && !rp) record(K, DUELS.t);
    if (DUELS.cur === K) hudTick(SIM ? SIM / 60 : Math.min(0.1, rdt), K.cam);
  };
  function shakeOn(K, d) { if (shT <= 0 || !K.cam) return; shT -= SIM ? SIM / 60 : Math.min(0.1, d); const a = shA * Math.max(0, shT / shD) * 0.35;
    shOff.set(rnd(-1, 1) * a, rnd(-1, 1) * a, rnd(-1, 1) * a * 0.5); K.cam.position.add(shOff); shCam = K.cam; }
  window.__juice = J;
  return J;
})();

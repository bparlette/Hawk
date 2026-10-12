// ---------------- Voltage Vic, Power Plant: RHYTHM BATTLE (DESIGN.md "Game-style boss fights") ----------------
// Vic (electric-eel DJ) spins three B-MORE 410 radio records, one per phase, through the radio's own hidden YouTube player (Brad's picks,
// 2026-10-11): phase 1 "Dance My Pain Away" (Rod Lee), phase 2 "How U Wanna Carry It" (Miss Tony), phase 3 "Doo Doo Brown" (2 Hyped
// Brothers & A Dog). Each phase is a ~45-55 s section from the track's peak, with a quick DJ scratch between records. Notes come from a
// beatmap built from each record's tempo + first-beat offset (VIC_SONGS below; one small entry per track so more radio songs can get
// beatmaps later). When YouTube can't play (headless tests, offline, blocked, an ad that won't clear) the fight falls back to an original
// procedural Baltimore club beat in Web Audio (130 BPM, break-style kick/snare/hat, bass stab, HEY/HO chants; no samples).
// CLOCK: notes are judged in media time, never frame time. Procedural: AudioContext time (getOutputTimestamp maps input event
// timestamps onto what is being heard). YouTube: player.getCurrentTime() changes are slewed onto a performance.now() line between polls.
// Lanes: 4 on desktop / gamepad (D F J K, arrows, pad X A Y B); 3 big tap zones on phones. Hit = dodge + counter (Vic takes damage, combo
// multiplier up to x1.5); miss = Harold is zapped. Vic's "drops" are telegraphed one bar ahead and land on the beat as an attack bar of red
// notes in one lane (two on desktop): clear them all for a COUNTER, each miss zaps harder. Vic's HP has a floor per phase (he can't fall
// before phase 3). Win: BOSS_CLEAR.clear('powerplant') (the shared boss-clear / crime-meter hook) or this file's identical stand-in; lose = retry.
// Entry: ACT "FIGHT VIC" at the Power Plant boss anchor, or ?vic=1. Tests: ?vic=perfect / ?vic=miss (scripted runs), ?vicbars=N (short
// phases), ?vicyt=stub (a fake YouTube player with 250 ms stale time reports, to measure the smoothing). Calibration: ?vicsync=1 turns a run
// into tap-along: taps on the beat give each record's beat0 (stored in localStorage and used from then on). ?viclat=ms = output latency trim.
// Vic's rig: Opus O6 delivers buildVoltageVic() later (boss_voltage_vic); if it exists it replaces the stand-in eel automatically.
const VIC_SONGS = {
  // bpm: tempo from public sources; beat0: seconds (in this YouTube upload) of a downbeat, null = not measured yet (YouTube refused the build
  // box, so the grid starts where the section starts; ?vicsync=1 measures it on a real device); at: section start in s, null = the radio
  // REMIX rule (35% in, >= 30 s, <= length - section - 5 s) until a heatmap peak is baked; bars: section length in bars.
  c1: { id: 'quUSjngSmN0', title: 'Dance My Pain Away', artist: 'Rod Lee', bpm: 128, beat0: null, at: null, bars: 24, src: 'songbpm.com (Spotify audio features): 128 BPM' },
  c2: { id: 'qEnptXwZSfo', title: 'How U Wanna Carry It', artist: 'Miss Tony', bpm: 124, beat0: null, at: null, bars: 24, src: 'songbpm.com (Spotify audio features): 124 BPM' },
  c3: { id: '1zRb_WNEeaw', title: 'Doo Doo Brown', artist: '2 Hyped Brothers & A Dog', bpm: 126, beat0: null, at: null, bars: 28, src: 'songbpm.com + Beatsource + Chartify: 126 BPM' },
  proc: { id: null, title: 'Voltage Vic Live (B-More club beat)', artist: 'original, Web Audio', bpm: 130, beat0: 0, at: 0, bars: 24 },
};
const VIC_SET = ['c1', 'c2', 'c3']; // the record for phase 1, 2, 3

const VIC = (function () {
  const LMID = 'powerplant', LEAD_BARS = 2, TAIL_BARS = 1;
  const QV = Q.get('vic') || '', BOT = QV === 'perfect' ? 'perfect' : QV === 'miss' ? 'miss' : null;
  const SHORT = Math.max(0, +Q.get('vicbars') || 0), SYNC = Q.get('vicsync') === '1', YTSTUB = /^stub/.test(Q.get('vicyt') || ''), STUBAC = Q.get('vicyt') === 'stubac', NOYT = Q.get('vicyt') === '0';
  const LAT = (+Q.get('viclat') || 0) / 1000;
  const WIN_P = 0.05, WIN_G = 0.11, WIN_MISS = 0.14; // judgment windows (s)
  const V = { on: false, state: 'off', mode: 'proc', phase: 0, ph: null, notes: [], hp: 100, vhp: 300, combo: 0, maxCombo: 0, mult: 1,
    counts: { perfect: 0, good: 0, miss: 0 }, drops: { n: 0, countered: 0 }, log: [], errs: [], judgeErr: [], drift: { n: 0, max: 0, sum: 0, frameMax: 0 }, wins: 0, losses: 0, runs: 0,
    lanes: 4, pops: [], sync: { taps: [] }, ytFails: 0, bot: BOT, frames: 0, fx: { zap: 0, counter: 0, shake: 0, flash: 0, beat: 0 } };
  const L = () => LANDMARKS.find((l) => l.id === LMID);
  const pickLine = (kind) => { const B = L() && L().boss, a = B && B.lines && B.lines[kind]; return a && a.length ? a[Math.floor(Math.random() * a.length)] : (kind === 'intro' ? 'Drop the beat!' : 'Power down...'); };

  // ---------- boss clear: the shared BOSS_CLEAR hook when the build has it, else this identical stand-in (same storage key + event) ----------
  function bossClear(info) {
    try { if (typeof BOSS_CLEAR !== 'undefined' && BOSS_CLEAR && BOSS_CLEAR.clear) return BOSS_CLEAR.clear(LMID, info); } catch (e) {}
    const K = 'tcb_boss_clear'; let s = []; try { s = JSON.parse(localStorage.getItem(K) || '[]') || []; } catch (e) {}
    const first = !s.includes(LMID); if (first) s.push(LMID); try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {}
    const lm = L(); if (lm && lm.boss) lm.boss.cleared = true;
    const d = Object.assign({ lm: LMID, boss: 'Voltage Vic', first, at: +S.time.toFixed(1) }, info);
    try { dispatchEvent(new CustomEvent('tcb:bossclear', { detail: d })); } catch (e) {} return true;
  }
  { let s = []; try { s = JSON.parse(localStorage.getItem('tcb_boss_clear') || '[]') || []; } catch (e) {} const lm = L(); if (lm && lm.boss && s.includes(LMID)) lm.boss.cleared = true; }

  // ---------- DOM: one overlay canvas (lanes, notes, HUD) + a card for intro / win / lose ----------
  const css = document.createElement('style');
  css.textContent = `
  #vic { display: none; position: fixed; inset: 0; z-index: 60; touch-action: none; -webkit-user-select: none; user-select: none; }
  body.vicfight #vic { display: block; }
  #vic canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  #viccard { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 28px)); box-sizing: border-box; padding: 14px 16px 16px; text-align: center;
    background: linear-gradient(#1d1040, #0c0720); border: 3px solid #000; box-shadow: 5px 5px 0 #000, inset 0 0 0 2px #39e6ff; color: #fff; font: 700 14px/1.4 system-ui, -apple-system, sans-serif; }
  #viccard.hide { display: none; }
  #viccard h2 { margin: 0 0 6px; font: 15px/1.35 'PX', monospace; color: #ffe14a; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  #viccard .ln { font: italic 900 17px/1.3 system-ui, sans-serif; color: #8ff3ff; margin: 6px 0 8px; text-shadow: 2px 2px 0 #000; }
  #viccard p { margin: 4px 0; color: #e8dcff; } #viccard .sm { font-size: 12px; color: #b7a8e0; }
  #viccard button { all: unset; cursor: pointer; display: inline-block; margin: 10px 5px 0; padding: 9px 14px; background: #ff3d6e; color: #fff; border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    font: 11px/1 'PX', monospace; letter-spacing: 1px; touch-action: manipulation; }
  #viccard button.alt { background: #2a1650; color: #ffd23c; }
  body.vicfight #hpbox, body.vicfight #p2, body.vicfight #ko, body.vicfight #combo, body.vicfight #lmk, body.vicfight #lmkb, body.vicfight #mmap, body.vicfight #hint, body.vicfight #prompt,
  body.vicfight #face, body.vicfight #clock, body.vicfight #banner, body.vicfight #bark, body.vicfight #qbtn, body.vicfight #title, body.vicfight #proto, body.vicfight #apanel, body.vicfight #stick, body.vicfight .tb { display: none !important; }`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.id = 'vic'; root.innerHTML = '<canvas></canvas><div id="viccard" class="hide"></div>'; document.body.appendChild(root);
  const cv = root.querySelector('canvas'), g = cv.getContext('2d'), cardEl = root.querySelector('#viccard');
  let W = 0, H = 0, DPR = 1;
  function layout() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); const rb = document.getElementById('rid'); V.top0 = rb && rb.getBoundingClientRect().height > 0 ? rb.getBoundingClientRect().bottom : 0; }
  function card(title, html, btns) {
    cardEl.innerHTML = `<h2>${title}</h2>${html}<div>${btns.map((b, i) => `<button type="button" data-i="${i}" class="${i ? 'alt' : ''}">${b[0]}</button>`).join('')}</div>`; cardEl.classList.remove('hide');
    cardEl.querySelectorAll('button').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); btns[+el.dataset.i][1](); }));
    for (const ev of ['pointerdown', 'touchstart']) cardEl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
  const hideCard = () => cardEl.classList.add('hide');

  // ---------- the stage (own scene; the city isn't drawn during the fight) ----------
  const stage = new THREE.Scene(); stage.background = new THREE.Color('#070414'); stage.fog = new THREE.Fog('#070414', 18, 46);
  const scam = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  stage.add(new THREE.HemisphereLight('#6a5cff', '#120a22', 0.9));
  const key = new THREE.PointLight('#39e6ff', 30, 30, 1.6); key.position.set(0, 6, 4); stage.add(key);
  const rim = new THREE.PointLight('#ff3d6e', 20, 30, 1.6); rim.position.set(-5, 4, -3); stage.add(rim);
  const lam = (c, e = '#000', ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  { // floor, back wall with the three Power Plant smokestacks, DJ booth with two decks + a mixer, speaker stacks
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), lam('#120c24')); fl.rotation.x = -Math.PI / 2; stage.add(fl);
    for (let i = -6; i <= 6; i++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 30), glow(i % 2 ? '#2a1660' : '#3a1f7a')); ln.rotation.x = -Math.PI / 2; ln.position.set(i * 1.6, 0.01, 0); stage.add(ln); }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), lam('#1a0f30')); wall.position.set(0, 8, -9); stage.add(wall);
    for (const [x, h] of [[-6, 11], [-3.6, 13], [6.2, 12]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, h, 12), lam('#3a2440')); s.position.set(x, h / 2, -8.4); stage.add(s);
      for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 4, 16), glow('#ff3d6e')); r.rotation.x = Math.PI / 2; r.position.set(x, h * (0.45 + k * 0.2), -8.4); stage.add(r); }
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), glow('#ff2222')); tip.position.set(x, h + 0.1, -8.4); stage.add(tip); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.1), new THREE.MeshBasicMaterial({ map: canvasTex(512, 76, (c, w, h) => { c.fillStyle = '#0a0618'; c.fillRect(0, 0, w, h); c.font = '900 50px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#39e6ff'; c.shadowBlur = 14; c.fillStyle = '#bff8ff'; c.fillText('POWER PLANT LIVE', w / 2, h / 2 + 2); }, 512), fog: false }));
    sign.position.set(0, 6.6, -8.9); stage.add(sign);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.25, 1.5), lam('#1b1430')); booth.position.set(0, 0.62, 0.4); stage.add(booth);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.0), new THREE.MeshBasicMaterial({ map: canvasTex(256, 52, (c, w, h) => { c.fillStyle = '#100a20'; c.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { c.fillStyle = i % 3 ? '#39e6ff' : '#ffe14a'; c.fillRect(6 + i * 15.5, 8, 9, 36); } }, 256), fog: false }));
    front.position.set(0, 0.62, 1.16); stage.add(front); V.front = front;
    V.decks = [];
    for (const x of [-1.6, 1.6]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20), lam('#0b0b0b', '#39e6ff', 0.15)); d.position.set(x, 1.3, 0.35); stage.add(d);
      const lab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.08), glow('#ff3d6e')); lab.position.set(0, 0.04, 0.2); d.add(lab); V.decks.push(d); }
    const mixer = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), lam('#2b2440', '#ffe14a', 0.25)); mixer.position.set(0, 1.3, 0.35); stage.add(mixer);
    for (const x of [-4.2, 4.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.6, 1.1), lam('#16112a')); sp.position.set(x, 1.3, -0.2); stage.add(sp);
      for (const y of [0.75, 1.9]) { const cone = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), lam('#222', '#39e6ff', 0.4)); cone.position.set(x, y, 0.36); stage.add(cone); (V.cones = V.cones || []).push(cone); } }
  }
  // Vic: Opus's rig when boss_voltage_vic ships buildVoltageVic(), else a stand-in electric eel (segmented body rising behind the booth)
  const vicRoot = new THREE.Group(); vicRoot.position.set(0, 0, -0.7); stage.add(vicRoot); V.rig = 'stand-in';
  const segs = [];
  (function buildVic() {
    let ext = null;
    try { const f = (typeof buildVoltageVic === 'function' && buildVoltageVic) || (typeof window.buildVoltageVic === 'function' && window.buildVoltageVic); if (f) ext = f({ THREE, stage: true }); } catch (e) { console.warn('buildVoltageVic failed, using the stand-in', e); ext = null; }
    if (ext) { const obj = ext.root || ext.group || ext; if (obj && obj.isObject3D) { vicRoot.add(obj); V.ext = ext; V.rig = 'buildVoltageVic'; return; } }
    const body = lam('#1d6b5e', '#0b3a33', 0.6), belly = lam('#e8d44a', '#ffe14a', 0.5), spot = glow('#9dfcff');
    for (let i = 0; i < 9; i++) { const r = 0.42 - i * 0.025; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), i % 2 ? body : lam('#217a6b', '#0b3a33', 0.6)); m.scale.set(1, 1.25, 0.9); vicRoot.add(m); segs.push(m);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), spot); s.position.set(r * 0.7, 0.05, r * 0.55); m.add(s); const s2 = s.clone(); s2.position.x *= -1; m.add(s2); }
    const head = new THREE.Group(); vicRoot.add(head); V.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), body); skull.scale.set(1.15, 0.95, 1.25); head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), belly); jaw.position.set(0, -0.08, 0.12); jaw.scale.set(1.05, 0.7, 1.2); head.add(jaw); V.jaw = jaw;
    for (const x of [-0.26, 0.26]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), glow('#ffffff')); e.position.set(x, 0.18, 0.5); head.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#101018')); p.position.set(0, 0, 0.11); e.add(p); }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 20, Math.PI), lam('#222', '#ff3d6e', 0.5)); band.position.set(0, 0.12, -0.02); head.add(band); // headphones
    for (const x of [-0.62, 0.62]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), lam('#111', '#ff3d6e', 0.6)); cup.rotation.z = Math.PI / 2; cup.position.set(x, 0.1, 0); head.add(cup); }
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.13, 0.05), glow('#39e6ff')); glasses.position.set(0, 0.2, 0.62); glasses.visible = false; head.add(glasses); V.shades = glasses;
    for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), lam('#2a8f7e', '#1a5a4f', 0.5)); fin.rotation.z = s * 1.2; fin.position.set(s * 0.55, -0.2, -0.1); head.add(fin); }
  })();
  // sparks: additive points that pulse on the beat, burst on hits, rain on drops
  const NSP = 220, spPos = new Float32Array(NSP * 3), spVel = new Float32Array(NSP * 3), spLife = new Float32Array(NSP);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparkTex = canvasTex(32, 32, (c) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(160,250,255,.9)'); gr.addColorStop(1, 'rgba(60,120,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); });
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.42, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#bff8ff', fog: false }));
  sparks.frustumCulled = false; stage.add(sparks); let spI = 0;
  for (let i = 0; i < NSP; i++) spPos[i * 3 + 1] = -50;
  function burst(x, y, z, n, sp) { for (let k = 0; k < n; k++) { const i = spI++ % NSP; spPos[i * 3] = x; spPos[i * 3 + 1] = y; spPos[i * 3 + 2] = z; const a = Math.random() * TAU, u = Math.random() * 2 - 1, v = sp * (0.4 + Math.random());
    spVel[i * 3] = Math.cos(a) * Math.sqrt(1 - u * u) * v; spVel[i * 3 + 1] = u * v + sp * 0.4; spVel[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - u * u) * v; spLife[i] = 0.5 + Math.random() * 0.6; } }
  function sparkStep(dt) { for (let i = 0; i < NSP; i++) { if (spLife[i] <= 0) { spPos[i * 3 + 1] = -50; continue; } spLife[i] -= dt; spVel[i * 3 + 1] -= 6 * dt; for (let k = 0; k < 3; k++) spPos[i * 3 + k] += spVel[i * 3 + k] * dt; } spGeo.attributes.position.needsUpdate = true; }
  // bolts (zap: Vic -> front of stage; counter: stage front -> Vic)
  const boltMat = new THREE.LineBasicMaterial({ color: '#bff8ff', transparent: true, opacity: 1, fog: false, blending: THREE.AdditiveBlending });
  const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
  const bolt = new THREE.Line(boltGeo, boltMat); bolt.frustumCulled = false; bolt.visible = false; stage.add(bolt); let boltT = 0;
  function zapBolt(from, to, col) { const p = boltGeo.attributes.position.array; for (let i = 0; i < 14; i++) { const t = i / 13, j = i && i < 13 ? 0.35 : 0;
    p[i * 3] = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * j; p[i * 3 + 1] = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * j; p[i * 3 + 2] = from.z + (to.z - from.z) * t + (Math.random() - 0.5) * j; }
    boltGeo.attributes.position.needsUpdate = true; boltMat.color.set(col); bolt.visible = true; boltT = 0.18; }
  const VHEAD = new THREE.Vector3(), FRONT = new THREE.Vector3(0, 1.0, 3.2);

  // ---------- audio: procedural club beat (fallback) + scratch + hit / zap sfx, all Web Audio ----------
  let mbus = null;
  function abus() { audioInit(); if (!AC) return null; if (AC.state === 'suspended') AC.resume().catch(() => {}); if (!mbus) { mbus = AC.createGain(); mbus.gain.value = 0.8; const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; mbus.connect(comp); comp.connect(AC.destination); } return mbus; }
  function env(gn, t, a, peak, d) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noiseSrc(t, dur) { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05); return s; }
  const I = {
    kick(t, v = 1) { const o = AC.createOscillator(), gn = AC.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); env(gn, t, 0.003, 0.95 * v, 0.32); o.connect(gn); gn.connect(mbus); o.start(t); o.stop(t + 0.4);
      const c = noiseSrc(t, 0.02), cg = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; env(cg, t, 0.001, 0.25 * v, 0.015); c.connect(f); f.connect(cg); cg.connect(mbus); },
    snare(t, v = 1) { const n = noiseSrc(t, 0.22), f = AC.createBiquadFilter(), gn = AC.createGain(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; env(gn, t, 0.002, 0.6 * v, 0.17); n.connect(f); f.connect(gn); gn.connect(mbus);
      const o = AC.createOscillator(), og = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); env(og, t, 0.002, 0.45 * v, 0.09); o.connect(og); og.connect(mbus); o.start(t); o.stop(t + 0.15); },
    hat(t, v = 1, open = false) { const n = noiseSrc(t, open ? 0.2 : 0.05), f = AC.createBiquadFilter(), gn = AC.createGain(); f.type = 'highpass'; f.frequency.value = 7200; env(gn, t, 0.001, 0.22 * v, open ? 0.16 : 0.035); n.connect(f); f.connect(gn); gn.connect(mbus); },
    stab(t, hz, v = 1) { const gn = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.18); env(gn, t, 0.004, 0.32 * v, 0.2); f.connect(gn); gn.connect(mbus);
      for (const [type, m] of [['sawtooth', 1], ['square', 1.006], ['sawtooth', 0.5]]) { const o = AC.createOscillator(); o.type = type; o.frequency.value = hz * m; o.connect(f); o.start(t); o.stop(t + 0.26); } },
    chant(t, word, v = 1) { // HEY / HO: a sawtooth "voice" through two formant band-passes, pitch falling like a crowd shout
      const o = AC.createOscillator(), o2 = AC.createOscillator(), gn = AC.createGain(), f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(); o.type = o2.type = 'sawtooth';
      const p0 = word === 'HEY' ? 235 : 190; o.frequency.setValueAtTime(p0, t); o.frequency.exponentialRampToValueAtTime(p0 * 0.78, t + 0.2); o2.frequency.setValueAtTime(p0 * 1.5, t); o2.frequency.exponentialRampToValueAtTime(p0 * 1.17, t + 0.2);
      f1.type = f2.type = 'bandpass'; f1.Q.value = f2.Q.value = 7;
      if (word === 'HEY') { f1.frequency.setValueAtTime(560, t); f1.frequency.linearRampToValueAtTime(420, t + 0.18); f2.frequency.setValueAtTime(1800, t); f2.frequency.linearRampToValueAtTime(2300, t + 0.18); }
      else { f1.frequency.setValueAtTime(520, t); f2.frequency.setValueAtTime(880, t); }
      env(gn, t, 0.012, 0.5 * v, 0.2); o.connect(f1); o.connect(f2); o2.connect(f1); f1.connect(gn); f2.connect(gn); gn.connect(mbus); o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
      const n = noiseSrc(t, 0.05), ng = AC.createGain(), nf = AC.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3000; env(ng, t, 0.002, 0.12 * v, 0.04); n.connect(nf); nf.connect(ng); ng.connect(mbus); },
    scratch(t, dur = 0.9) { // DJ scratch: band-passed noise + a buzzy saw whose pitch saws back and forth, chopped by the "crossfader"
      const n = noiseSrc(t, dur), f = AC.createBiquadFilter(), gn = AC.createGain(), o = AC.createOscillator(), og = AC.createGain(); f.type = 'bandpass'; f.Q.value = 3; o.type = 'sawtooth';
      const strokes = 6, sl = dur / strokes; gn.gain.setValueAtTime(0.0001, t); og.gain.setValueAtTime(0.0001, t);
      for (let k = 0; k < strokes; k++) { const a = t + k * sl, up = k % 2 === 0; f.frequency.setValueAtTime(up ? 500 : 2600, a); f.frequency.exponentialRampToValueAtTime(up ? 2600 : 500, a + sl * 0.9);
        o.frequency.setValueAtTime(up ? 90 : 340, a); o.frequency.exponentialRampToValueAtTime(up ? 340 : 90, a + sl * 0.9);
        gn.gain.setValueAtTime(0.0001, a); gn.gain.exponentialRampToValueAtTime(0.7, a + 0.01); gn.gain.setValueAtTime(0.7, a + sl * 0.7); gn.gain.exponentialRampToValueAtTime(0.0001, a + sl * 0.95);
        og.gain.setValueAtTime(0.0001, a); og.gain.exponentialRampToValueAtTime(0.12, a + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, a + sl * 0.9); }
      n.connect(f); f.connect(gn); gn.connect(mbus); o.connect(og); og.connect(mbus); o.start(t); o.stop(t + dur + 0.05); },
    blip(t, hz, v = 0.25, type = 'square', d = 0.08) { const o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(hz * 1.5, t + d); env(gn, t, 0.002, v, d); o.connect(gn); gn.connect(mbus); o.start(t); o.stop(t + d + 0.05); },
    zap(t) { const n = noiseSrc(t, 0.3), f = AC.createBiquadFilter(), gn = AC.createGain(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.28); env(gn, t, 0.002, 0.55, 0.26); n.connect(f); f.connect(gn); gn.connect(mbus);
      const o = AC.createOscillator(), og = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(60, t); env(og, t, 0.002, 0.18, 0.25); const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 38; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency); o.connect(og); og.connect(mbus); o.start(t); lfo.start(t); o.stop(t + 0.3); lfo.stop(t + 0.3); },
  };
  // the procedural record: 16 steps per bar, the pattern grows per phase (P1 drums, P2 + bass stabs, P3 + chants + busier hats)
  const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0], SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], HAT = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  const BASS = [[0, 110], [3, 110], [6, 130.8], [10, 98], [14, 116.5]]; // A2, A2, C3, G2, A#2: a minor stab riff on the off-steps
  function procStep(ph, bar, s, t) {
    const pi = ph.idx, lead = bar < LEAD_BARS, tail = bar >= ph.bars - TAIL_BARS, drop = ph.dropBars.has(bar);
    if (lead) { if (s % 4 === 0) I.blip(t, s === 0 ? 1320 : 880, 0.18, 'sine', 0.05); if (bar === LEAD_BARS - 1 && s % 4 === 0 && pi === 2) I.chant(t, 'HEY', 0.6); return; } // count-in
    if (tail) { if (s === 0) { I.kick(t); I.stab(t, 110, 1); I.chant(t, 'HO', 0.8); } return; }
    if (KICK[s] || (pi >= 1 && (s === 3 || s === 11) && bar % 2) || (pi === 2 && s === 14 && bar % 4 === 3)) I.kick(t, KICK[s] ? 1 : 0.6);
    if (SNARE[s] && (s !== 15 || bar % 2)) I.snare(t, s === 15 ? 0.5 : 1);
    if (HAT[s]) I.hat(t, 0.9, s === 14 && bar % 2 === 1); else if (pi === 2 && s % 2 === 1) I.hat(t, 0.35);
    if (pi >= 1) for (const [st, hz] of BASS) if (st === s) I.stab(t, hz * (bar % 4 === 3 && s >= 10 ? 1.122 : 1), 0.9);
    if (pi === 2 && (s === 4 || s === 12) && bar % 2 === 0) I.chant(t, s === 4 ? 'HEY' : 'HO', 0.9);
    if (drop && s % 4 === 0) I.stab(t, 55, 1.1); // Vic's drop: sub stabs on the beat
  }
  const sched = { ph: null, step: 0 };
  function schedTick() { // lookahead scheduler (runs every frame + a 25 ms interval so a slow frame can't starve the music)
    const ph = sched.ph; if (!ph || !AC || !mbus || V.mode !== 'proc' || V.state !== 'play') return;
    const sp = ph.P / 4, horizon = AC.currentTime + 0.25, total = ph.bars * 16;
    while (sched.step < total && ph.t0 + sched.step * sp < horizon) { const k = sched.step++; const t = ph.t0 + k * sp; if (t >= AC.currentTime - 0.01) procStep(ph, Math.floor(k / 16), k % 16, t); }
  }
  setInterval(schedTick, 25);

  // ---------- clocks: media time of the current phase, judged from input event timestamps ----------
  const ots = () => { try { const o = AC.getOutputTimestamp && AC.getOutputTimestamp(); if (o && o.contextTime > 0 && o.performanceTime > 0) return o; } catch (e) {} return null; };
  function acAt(perfMs) { // AudioContext time that is being HEARD at performance time perfMs
    const o = ots(); if (o) return o.contextTime + (perfMs - o.performanceTime) / 1000;
    return AC.currentTime - (AC.outputLatency || AC.baseLatency || 0) + (perfMs - performance.now()) / 1000;
  }
  const yt = { a: 0, c: 0, r: 1, ok: false, raw: NaN, frozen: true, polls: 0, changes: 0, resyncs: 0, lastCh: 0 };
  function ytPoll(nowMs) {
    const P = V.player; if (!P) return; let raw = NaN, st = -1; try { raw = +P.getCurrentTime(); st = P.getPlayerState ? P.getPlayerState() : 1; } catch (e) {}
    yt.polls++; const now = nowMs / 1000;
    if (st !== 1 || !isFinite(raw)) { if (!yt.frozen && yt.ok) { yt.a = yt.a + (now - yt.c) * yt.r; yt.c = now; } yt.frozen = true; return; }
    if (yt.frozen) { yt.frozen = false; yt.ok = false; } // (re)started: snap on the next change
    if (raw === yt.raw) return; yt.raw = raw; yt.changes++;
    const pred = yt.a + (now - yt.c) * yt.r, err = raw - pred; // a small PLL: phase slews 15% per report, rate follows the media clock (YouTube's audio clock vs performance.now)
    if (!yt.ok || Math.abs(err) > 0.3) { yt.a = raw; yt.c = now; yt.ok = true; yt.resyncs++; if (Math.abs(err) > 1) yt.r = 1; }
    else { yt.a = pred + err * 0.25; yt.c = now; yt.r = Math.max(0.95, Math.min(1.05, yt.r + 0.1 * err / Math.max(0.1, now - yt.lastCh))); }
    yt.lastCh = now;
  }
  function mediaAt(perfMs) { // media time (s) of the current phase at performance time perfMs
    const ph = V.ph; if (!ph) return 0;
    if (ph.src === 'yt') return (yt.frozen ? yt.a : yt.a + (perfMs / 1000 - yt.c) * yt.r) - LAT;
    return acAt(perfMs) - ph.t0 - LAT;
  }
  const mediaNow = () => mediaAt(performance.now());
  function perfAtMedia(m) { return performance.now() + (m - mediaNow()) * 1000; } // inverse (rate ~1)
  function perfAtTruth(m) { // scripted perfect run: press when the AUDIO (not our smoothed clock) reaches the note, so the judged error measures the clock
    const ph = V.ph, now = performance.now();
    if (ph.src === 'proc' && AC) return now + (m - (AC.currentTime - (AC.outputLatency || AC.baseLatency || 0) - ph.t0 - LAT)) * 1000;
    if (V.player && V.player.truth) return now + (m - (V.player.truth() - LAT)) * 1000; return perfAtMedia(m); }

  // ---------- fake YouTube player for ?vicyt=stub: time advances on the AudioContext clock but is only REPORTED every ~250 ms (+-40 ms), like the IFrame API ----------
  function stubPlayer() { // media clock: performance.now at rate 1.0015 (a realistic clock mismatch), or ?vicyt=stubac: the AudioContext clock
    const clk = () => (STUBAC ? AC.currentTime : performance.now() / 1000 * 1.0015);
    const P = { vid: null, pos: 0, t0: 0, on: false, rep: 0, repAt: 0, dur: 200, setVolume() {}, unMute() {}, mute() {}, setPlaybackRate() {}, getDuration() { return this.vid ? this.dur : 0; },
      truth() { return this.on ? this.pos + (clk() - this.t0) : this.pos; },
      getCurrentTime() { const n = performance.now(); if (n >= this.repAt) { this.rep = this.truth(); this.repAt = n + 210 + Math.random() * 80; } return this.rep; },
      getPlayerState() { return this.on ? 1 : this.vid ? 2 : -1; }, getVideoData() { return { video_id: this.vid }; },
      loadVideoById(o) { this.vid = o.videoId; this.pos = o.startSeconds || 0; this.on = false; this.repAt = 0; setTimeout(() => { this.t0 = clk(); this.on = true; this.repAt = 0; }, 300); },
      seekTo(s) { this.pos = s; this.t0 = clk(); this.repAt = 0; }, playVideo() { if (!this.on) { this.t0 = clk(); this.on = true; } }, pauseVideo() { this.pos = this.truth(); this.on = false; } };
    return P;
  }

  // ---------- beatmap: a phase's notes from its record's tempo + grid start; seeded so a retry plays the same chart ----------
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const PAT = [ // 16th positions per bar, by phase (Baltimore club accents: the 1, the "and-a" pickups, the snare on 2 and 4)
    [[0, 4, 8, 12], [0, 4, 8, 12], [0, 6, 8, 12], [0, 4, 8, 10, 12]],
    [[0, 4, 6, 8, 12, 14], [0, 3, 6, 8, 12], [0, 4, 6, 8, 10, 12, 14], [0, 2, 4, 8, 11, 12]],
    [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 4, 6, 8, 11, 12, 14, 15], [0, 2, 4, 6, 7, 8, 10, 12, 13, 14], [0, 4, 6, 8, 10, 11, 12, 14]],
  ];
  function buildChart(ph) {
    const r = rng(7919 * (ph.idx + 1) + 13), nl = V.lanes, notes = [], bar16 = ph.P / 4; let lane = Math.floor(nl / 2), lastS = -9;
    for (let bar = LEAD_BARS; bar < ph.bars - TAIL_BARS; bar++) {
      const drop = ph.dropBars.get(bar);
      if (drop) { // the attack bar: every 8th (P3: + 16th pickups) in Vic's target lane(s)
        const steps = ph.idx === 2 ? [0, 2, 4, 6, 7, 8, 10, 12, 14, 15] : ph.idx === 1 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 4, 6, 8, 12, 14];
        steps.forEach((s, i) => notes.push({ t: ph.grid0 + (bar * 16 + s) * bar16, lane: drop.lanes[i % drop.lanes.length], atk: drop.id, bar }));
        continue;
      }
      const pat = PAT[ph.idx][Math.floor(r() * 4)];
      for (const s of pat) {
        if (ph.idx === 0 && s % 4 && r() < 0.35) continue; // phase 1 keeps it sparse
        const gap = bar * 16 + s - lastS; let step = gap <= 1 ? (r() < 0.5 ? 1 : -1) : Math.floor(r() * 3) - 1; if (gap > 2 && r() < 0.3) step = Math.floor(r() * nl) - lane;
        lane = Math.max(0, Math.min(nl - 1, lane + step)); lastS = bar * 16 + s;
        notes.push({ t: ph.grid0 + (bar * 16 + s) * bar16, lane, bar });
        if (ph.idx === 2 && nl === 4 && s % 8 === 0 && r() < 0.35) notes.push({ t: ph.grid0 + (bar * 16 + s) * bar16, lane: (lane + 2) % 4, bar }); // phase 3 chords (desktop)
      }
    }
    notes.sort((a, b) => a.t - b.t); return notes;
  }
  function makePhase(idx, src, song) {
    const bars = SHORT ? Math.max(LEAD_BARS + TAIL_BARS + 2, SHORT) : LEAD_BARS + song.bars + TAIL_BARS, P = 60 / (src === 'proc' ? VIC_SONGS.proc.bpm : song.bpm);
    const every = idx === 2 ? 2 : 4, dropBars = new Map(); let id = 0;
    for (let b = LEAD_BARS + (idx === 1 ? 3 : 2) + 1; b < bars - TAIL_BARS; b += every) { if (b < LEAD_BARS + 2) continue; const nl = V.lanes, a = (id * 2 + idx) % nl;
      dropBars.set(b, { id: ++id + idx * 100, lanes: nl === 4 ? [a, (a + 2) % 4] : [a], bar: b }); }
    return { idx, src, song, bars, P, dropBars, t0: 0, grid0: 0, end: 0, S: 0 };
  }

  // ---------- flow: intro -> (phase -> scratch) x3 -> win / lose ----------
  function start(why) {
    if (V.on) return false; V.on = true; V.why = why || ''; V.runs++; layout();
    V.lanes = (document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches || innerWidth < 600) ? 3 : 4;
    document.body.classList.add('vicfight'); KEYS.clear(); PRESS.clear(); abus();
    V.lend = null; V.player = null; V.mode = 'proc';
    if (!NOYT) { try { if (window.__radio && __radio.lend) V.lend = __radio.lend({ name: 'Voltage Vic', onState: ytState, onError: ytError }); } catch (e) { V.lend = null; } }
    if (YTSTUB) { V.player = stubPlayer(); V.mode = 'yt'; }
    else if (V.lend && V.lend.player && V.ytFails < 2) { V.player = V.lend.player; V.mode = 'yt'; }
    reset(); setState('intro'); credit();
    const line = pickLine('intro'); V.introLine = line;
    card('VOLTAGE VIC', `<div class="ln">"${line}"</div><p>Hit the notes on the beat to dodge and fry him back. Miss and Harold gets zapped.</p><p class="sm">${V.lanes === 4 ? 'D F J K · arrow keys · pad X A Y B' : 'tap the three lanes'} · his DROPS land on the beat: clear the red bars!</p>`,
      [['DROP THE NEEDLE', () => begin()], ['NOT NOW', () => exit('back')]]);
    if (BOT) setTimeout(() => { if (V.state === 'intro') begin(); }, 400);
    V.log.push({ ev: 'start', why, mode: V.mode, lanes: V.lanes, rig: V.rig }); return true;
  }
  function reset() { V.hp = 100; V.vhp = 300; V.combo = 0; V.maxCombo = 0; V.mult = 1; V.counts = { perfect: 0, good: 0, miss: 0 }; V.drops = { n: 0, countered: 0 }; V.phase = 0; V.ph = null; V.notes = []; V.pops = []; V.judgeErr = []; V.sync.taps = []; V.dropState = new Map(); V.koPending = false; }
  function setState(s) { V.state = s; V.stateT = performance.now(); V.log.push({ ev: 'state', s, phase: V.phase, t: +S.time.toFixed(2) }); }
  function begin() { hideCard(); abus(); reset(); startPhase(0); }
  function startPhase(i) {
    V.phase = i; const song = VIC_SONGS[VIC_SET[i]];
    if (V.mode === 'yt') { V.ph = makePhase(i, 'yt', song); setState('cue'); cueYT(V.ph); }
    else { V.ph = makePhase(i, 'proc', VIC_SONGS.proc); beginProc(V.ph); }
    credit();
  }
  function beginProc(ph) {
    ph.src = 'proc'; ph.P = 60 / VIC_SONGS.proc.bpm; ph.t0 = AC ? AC.currentTime + 0.15 : 0; ph.grid0 = 0; ph.end = ph.bars * 4 * ph.P;
    V.notes = buildChart(ph); sched.ph = ph; sched.step = 0; ph.dropBars = ph.dropBars; setState('play'); V.log.push({ ev: 'phase', i: ph.idx, src: 'proc', bpm: 60 / ph.P, notes: V.notes.length, bars: ph.bars });
  }
  // YouTube: load the record at its section start, wait until it really plays (ads / buffering), then lay the grid on the real start
  function sectionStart(song, dur, P) {
    const len = (song.bars + LEAD_BARS + TAIL_BARS) * 4 * P; let s = song.at != null ? song.at : Math.max(30, dur * 0.35); if (dur > 0) s = Math.max(0, Math.min(s, dur - len - 5));
    const b0 = beat0(song); if (b0 != null) { const bar = 4 * P; s = b0 + Math.round((s - b0) / bar) * bar; if (s < 0) s += bar; } return s;
  }
  function beat0(song) { let v = song.beat0; try { const k = localStorage.getItem('tcb_vic_b0_' + song.id); if (k != null && isFinite(+k)) v = +k; } catch (e) {} return v; }
  function cueYT(ph) {
    const P = V.player, song = ph.song; ph.cueAt = performance.now(); ph.S = sectionStart(song, 0, ph.P); ph.adj = song.at != null;
    try { P.setVolume(85); P.unMute && P.unMute(); P.setPlaybackRate && P.setPlaybackRate(1); P.loadVideoById({ videoId: song.id, startSeconds: ph.S }); } catch (e) { return ytFallback('load threw'); }
    yt.ok = false; yt.frozen = true; yt.raw = NaN;
  }
  function cueTick() { // state 'cue': wait for the record to play the right video near the section start
    const ph = V.ph, P = V.player; ytPoll(performance.now());
    let st = -1, vid = null, cur = NaN; try { st = P.getPlayerState(); vid = P.getVideoData ? P.getVideoData().video_id : ph.song.id; cur = P.getCurrentTime(); } catch (e) {}
    if (performance.now() - ph.cueAt > 9000) return ytFallback('cue timeout (state ' + st + ')');
    if (st !== 1 || (vid && vid !== ph.song.id)) return; // buffering / an ad
    if (!ph.adj) { const d = (() => { try { return +P.getDuration() || 0; } catch (e) { return 0; } })(); if (d > 0) { ph.adj = true; const s2 = sectionStart(ph.song, d, ph.P); if (Math.abs(s2 - ph.S) > 1) { ph.S = s2; try { P.seekTo(s2, true); } catch (e) {} yt.ok = false; return; } } else return; }
    if (!yt.ok || Math.abs(cur - ph.S) > 3) return; // wait for the clock to lock near the start
    const b0 = beat0(ph.song), bar = 4 * ph.P; let g = ph.S; if (b0 != null) g = b0 + Math.ceil((ph.S - b0) / bar - 0.01) * bar;
    ph.grid0 = g + 0.0; ph.end = g + ph.bars * bar; ph.t0 = 0; V.notes = buildChart(ph); setState('play');
    V.log.push({ ev: 'phase', i: ph.idx, src: 'yt', id: ph.song.id, bpm: ph.song.bpm, S: +ph.S.toFixed(2), grid0: +g.toFixed(3), b0, notes: V.notes.length, waitMs: Math.round(performance.now() - ph.cueAt) });
  }
  function ytState(e) { V.log.push({ ev: 'yt-state', s: e && e.data }); }
  function ytError(e) { V.log.push({ ev: 'yt-error', code: e && e.data }); if (V.on && V.mode === 'yt') ytFallback('error ' + (e && e.data)); }
  function ytFallback(why) { // YouTube can't play this record: the rest of the fight runs on the procedural beat
    V.ytFails++; V.log.push({ ev: 'yt-fallback', why, phase: V.phase }); try { V.player && V.player.pauseVideo(); } catch (e) {} V.mode = 'proc'; V.player = null;
    if (V.state === 'cue' || V.state === 'play') { const i = V.phase; V.ph = makePhase(i, 'proc', VIC_SONGS.proc); beginProc(V.ph); credit(); }
  }
  function credit() {
    if (!V.lend || !V.lend.credit) return; const ph = V.ph;
    if (!ph) V.lend.credit(`⚡ <b>VOLTAGE VIC</b> · POWER PLANT LIVE · his set is about to drop`, 'Voltage Vic Power Plant live');
    else if (V.mode === 'yt') V.lend.credit(`⚡ <b>VOLTAGE VIC'S SET</b> · PHASE ${ph.idx + 1}/3 · <i>NOW PLAYING:</i> "${ph.song.title}" · ${ph.song.artist}`, `Voltage Vic's set phase ${ph.idx + 1} now playing ${ph.song.title} ${ph.song.artist}`);
    else V.lend.credit(`⚡ <b>VOLTAGE VIC LIVE</b> · PHASE ${(ph ? ph.idx : 0) + 1}/3 · original B-More club beat (Web Audio)`, 'Voltage Vic live original club beat');
  }
  function endPhase() {
    const ph = V.ph; if (SYNC) syncReport(ph);
    sched.ph = null; V.log.push({ ev: 'phase-end', i: ph.idx, hp: V.hp, vhp: Math.round(V.vhp) });
    if (V.phase >= 2) return finish(V.vhp <= 0.5 ? 'win' : 'lose', V.vhp <= 0.5 ? 'ko' : 'outlasted');
    setState('scratch'); V.scratchEnd = performance.now() + 1300; try { if (V.player && V.mode === 'yt') { V.player.setPlaybackRate && V.player.setPlaybackRate(0.5); setTimeout(() => { try { V.player && V.player.pauseVideo(); } catch (e) {} }, 250); } } catch (e) {}
    if (AC && mbus) I.scratch(AC.currentTime + 0.02, 1.0); V.fx.flash = 1;
  }
  function finish(res, why) {
    if (V.state === 'win' || V.state === 'lose') return; sched.ph = null; try { V.player && V.player.pauseVideo(); } catch (e) {}
    const stats = { perfect: V.counts.perfect, good: V.counts.good, miss: V.counts.miss, maxCombo: V.maxCombo, drops: V.drops.n, countered: V.drops.countered, hp: Math.round(V.hp), vhp: Math.round(V.vhp), phase: V.phase + 1, mode: V.mode };
    V.result = Object.assign({ res, why }, stats); V.log.push({ ev: res, why, ...stats });
    if (res === 'win') {
      V.wins++; setState('win'); bossClear({ how: 'rhythm battle', ...stats }); const line = pickLine('defeat'); V.defeatLine = line; V.fx.counter = 1.2; burst(0, 2.4, -0.6, 90, 6);
      if (AC && mbus) { const t = AC.currentTime + 0.05; I.scratch(t, 0.6); I.chant(t + 0.7, 'HEY', 1); I.chant(t + 1.0, 'HO', 1); }
      card('POWER PLANT CLEARED!', `<div class="ln">"${line}"</div><p>${stats.perfect} perfect · ${stats.good} good · ${stats.miss} miss · best combo ${stats.maxCombo}</p><p>Drops countered: ${stats.countered}/${stats.drops}. Pier 4's lights are back on the grid.</p>`, [['BACK TO THE CITY', () => exit('win')]]);
    } else {
      V.losses++; setState('lose'); if (AC && mbus) I.zap(AC.currentTime + 0.02);
      card(why === 'outlasted' ? 'VIC KEPT THE PARTY GOING' : 'ZAPPED!', `<p>${why === 'outlasted' ? 'The set ran out before Vic did.' : 'Harold took one volt too many.'}</p><p class="sm">${stats.perfect} perfect · ${stats.good} good · ${stats.miss} miss · Vic at ${Math.round(V.vhp / 3)}%</p>`, [['RETRY', () => retry()], ['LEAVE', () => exit('lose')]]);
    }
  }
  function retry() { hideCard(); V.log.push({ ev: 'retry' }); if (V.lend && V.lend.player && !YTSTUB && V.ytFails < 2) { V.player = V.lend.player; V.mode = 'yt'; } else if (YTSTUB) { V.player = stubPlayer(); V.mode = 'yt'; } begin(); }
  function exit(why) {
    if (!V.on) return; V.on = false; sched.ph = null; hideCard(); try { V.player && V.player.pauseVideo(); } catch (e) {}
    try { if (V.lend && window.__radio && __radio.unlend) __radio.unlend(); } catch (e) {} V.lend = null; V.player = null;
    document.body.classList.remove('vicfight'); KEYS.clear(); PRESS.clear(); setState('off'); V.log.push({ ev: 'exit', why });
    resize(); // the city camera aspect / render target back to the game's viewport
  }

  // ---------- judging ----------
  function laneHit(lane, perfMs) {
    if (!V.on) return;
    if (V.state === 'intro') { begin(); return; }
    if (V.state !== 'play') return;
    const m = mediaAt(perfMs);
    if (SYNC) { V.sync.taps.push(m); pop({ txt: 'TAP', lane, t: 0.4, c: '#8ff3ff' }); return; }
    let best = null, bd = 1e9; for (const n of V.notes) { if (n.done || n.lane !== lane) continue; const d = Math.abs(n.t - m); if (d < bd) { bd = d; best = n; } if (n.t - m > WIN_MISS) break; }
    V.laneFlash[lane] = 0.12;
    if (!best || bd > WIN_MISS) return; // a stray tap costs nothing
    const err = m - best.t; best.done = true; best.err = err; V.judgeErr.push(err);
    if (bd <= WIN_P) judge(best, 'perfect'); else if (bd <= WIN_G) judge(best, 'good'); else judge(best, 'miss');
  }
  function judge(n, j) {
    const ph = V.ph; V.counts[j]++; n.j = j;
    const base = ph.idx === 2 ? 1 : 1, segBase = ph.base || (ph.base = Math.max(1, V.notes.length)), unit = 100 / (0.62 * segBase);
    if (j === 'miss') {
      V.combo = 0; V.mult = 1; const dmg = n.atk ? 9 : 4; V.hp = Math.max(0, V.hp - dmg); V.fx.zap = 1; V.fx.shake = n.atk ? 1 : 0.5; zapBolt(VHEAD, FRONT, '#bff8ff');
      if (AC && mbus) I.zap(AC.currentTime); pop({ txt: n.atk ? 'ZAPPED!' : 'MISS', lane: n.lane, t: 0.6, c: '#ff4d6d' });
      if (n.atk) { const d = V.dropState.get(n.atk) || { hit: 0, miss: 0 }; d.miss++; V.dropState.set(n.atk, d); }
      if (V.hp <= 0) finish('lose', 'zapped');
      return;
    }
    V.combo++; V.maxCombo = Math.max(V.maxCombo, V.combo); V.mult = V.combo >= 30 ? 1.5 : V.combo >= 20 ? 1.35 : V.combo >= 10 ? 1.2 : 1;
    const dmg = unit * base * (j === 'perfect' ? 1 : 0.6) * V.mult * (n.atk ? 1.5 : 1), floor = floorNow();
    V.vhp = Math.max(floor, V.vhp - dmg); V.fx.beat = 1; burst(-1.6 + n.lane * (3.2 / (V.lanes - 1)), 1.4, 0.6, j === 'perfect' ? 8 : 4, 2.2);
    if (AC && mbus && V.mode === 'yt') I.blip(AC.currentTime, j === 'perfect' ? 1760 : 1320, 0.06, 'square', 0.04);
    pop({ txt: j === 'perfect' ? 'PERFECT' : 'GOOD', lane: n.lane, t: 0.45, c: j === 'perfect' ? '#ffe14a' : '#8ff3ff' });
    if (n.atk) { const d = V.dropState.get(n.atk) || { hit: 0, miss: 0 }; d.hit++; V.dropState.set(n.atk, d); }
    if (ph.idx === 2 && V.vhp <= 0.5 && !V.koPending) { V.koPending = true; V.fx.counter = 1; setTimeout(() => { V.koPending = false; if (V.on && V.state === 'play') finish('win', 'ko'); }, 600); }
  }
  function pop(o) { if (o.lane >= 0) V.pops = V.pops.filter((p) => p.lane !== o.lane); V.pops.push(o); } // one judgment per lane on screen
  function floorNow() { const ph = V.ph; if (!ph) return 0; if (ph.idx < 2) return 300 - 100 * (ph.idx + 1); // phases 1-2: a fixed floor
    const prog = Math.max(0, Math.min(1, (mediaNow() - ph.grid0) / Math.max(1, ph.end - ph.grid0))); return Math.max(0, 100 * (1 - prog / 0.86)); } // phase 3: the floor sinks so the KO lands in the closing bars
  function dropDone(id) { // all notes of a drop judged: a COUNTER if none were missed
    const d = V.dropState.get(id); if (!d || d.closed) return; d.closed = true; V.drops.n++;
    if (!d.miss) { V.drops.countered++; V.fx.counter = 1; zapBolt(FRONT, VHEAD, '#ffe14a'); burst(VHEAD.x, VHEAD.y, VHEAD.z, 40, 4); V.vhp = Math.max(floorNow(), V.vhp - 6); pop({ txt: 'COUNTER!', lane: -1, t: 0.9, c: '#ffe14a' }); }
  }
  function syncReport(ph) { // ?vicsync=1: circular mean of the taps modulo the beat = where the beat really is in this upload
    const P = ph.P, T = V.sync.taps.filter((m) => m > ph.grid0 + LEAD_BARS * 4 * P); if (T.length < 8) return;
    let x = 0, y = 0; for (const m of T) { const a = TAU * (m % P) / P; x += Math.cos(a); y += Math.sin(a); } const ph0 = ((Math.atan2(y, x) / TAU) * P + P) % P, R = Math.hypot(x, y) / T.length;
    const b0 = +ph0.toFixed(3); V.log.push({ ev: 'sync', id: ph.song.id, b0, R: +R.toFixed(2), taps: T.length }); console.log('[vic sync]', ph.song.title, 'beat0 =', b0, 'consistency', R.toFixed(2));
    if (R > 0.8 && ph.song.id) try { localStorage.setItem('tcb_vic_b0_' + ph.song.id, String(b0)); } catch (e) {}
  }

  // ---------- input: keys, pointer zones, gamepad (all on event timestamps) ----------
  V.laneFlash = [0, 0, 0, 0];
  const KEYMAP4 = { d: 0, f: 1, j: 2, k: 3, arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 }, KEYMAP3 = { d: 0, f: 1, j: 1, k: 2, arrowleft: 0, arrowdown: 1, arrowup: 1, arrowright: 2, s: 0, l: 2 };
  addEventListener('keydown', (e) => {
    if (!V.on) return; const k = e.key.toLowerCase();
    if (k === 'escape' && (V.state === 'intro' || V.state === 'win' || V.state === 'lose')) { exit('esc'); e.stopImmediatePropagation(); return; }
    if (k === 'tab') { e.preventDefault(); e.stopImmediatePropagation(); return; } // no full map mid-set
    const lane = (V.lanes === 4 ? KEYMAP4 : KEYMAP3)[k]; if (lane === undefined) { if ((k === ' ' || k === 'enter') && V.state === 'intro') begin(); return; }
    e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return; laneHit(lane, e.timeStamp);
  }, { capture: true });
  root.addEventListener('pointerdown', (e) => { if (!V.on) return; e.preventDefault(); e.stopPropagation(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
    if (V.state !== 'play' && V.state !== 'intro') return; const r = hw(); const lane = Math.max(0, Math.min(V.lanes - 1, Math.floor((e.clientX - (V.lanes === 3 ? 0 : r.x0)) / ((V.lanes === 3 ? W : r.x1 - r.x0) / V.lanes))));
    if (V.lanes === 4 && (e.clientX < r.x0 || e.clientX > r.x1)) return; laneHit(lane, e.timeStamp); });
  const PADMAP = { 2: 0, 0: 1, 3: 2, 1: 3, 14: 0, 13: 1, 12: 2, 15: 3 }; let padPrev = [];
  function padPoll() { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const gp of pads) { if (!gp) continue; const prev = padPrev[gp.index] || [];
    for (const [b, l] of Object.entries(PADMAP)) { const on = gp.buttons[b] && gp.buttons[b].pressed; if (on && !prev[b]) laneHit(V.lanes === 4 ? l : [0, 1, 1, 2][l], performance.now()); }
    if (gp.buttons[9] && gp.buttons[9].pressed && !prev[9] && V.state === 'intro') begin(); padPrev[gp.index] = gp.buttons.map((x) => x.pressed); } }

  // ---------- per frame (called by frame() instead of the city step while the fight is on) ----------
  function hw() { const nl = V.lanes; if (nl === 3) return { x0: W * 0.04, x1: W * 0.96, top: H * 0.36, hit: H * 0.76 }; const w = Math.min(W * 0.62, 460); return { x0: W / 2 - w / 2, x1: W / 2 + w / 2, top: H * 0.38, hit: H * 0.84 }; }
  function frame(rdt) {
    V.frames++; const now = performance.now(); PRESS.clear(); padPoll();
    if (Math.round(innerWidth) !== W || Math.round(innerHeight) !== H) layout();
    if (V.state === 'cue') cueTick();
    if (V.ph && V.ph.src === 'yt' && V.mode === 'yt') ytPoll(now);
    schedTick();
    const m = V.ph ? mediaNow() : 0;
    if (V.state === 'play') {
      const ph = V.ph;
      // drift monitor: our clock vs the AudioContext (procedural) / the stub's true position (YouTube stub); the frame-time clock for contrast
      if (ph.src === 'proc' && AC) { const ref = AC.currentTime - (AC.outputLatency || AC.baseLatency || 0) - ph.t0 - LAT; recDrift(m - ref, rdt, ph); }
      else if (YTSTUB && V.player && V.player.truth) { const ref = V.player.truth() - LAT; recDrift(m - ref, rdt, ph); }
      if (BOT === 'perfect') for (const n of V.notes) { if (n.t > m) break; if (!n.done) laneHit(n.lane, perfAtTruth(n.t)); }
      for (const n of V.notes) { if (n.t > m - WIN_MISS) break; if (!n.done) { n.done = true; judge(n, 'miss'); if (V.state !== 'play') break; } }
      if (V.state === 'play') for (const [, d] of ph.dropBars) { const ns = V.notes.filter((n) => n.atk === d.id); if (ns.length && ns.every((n) => n.done) && !(V.dropState.get(d.id) || {}).closed) { if (!V.dropState.has(d.id)) V.dropState.set(d.id, { hit: 0, miss: 0 }); dropDone(d.id); } }
      if (V.state === 'play' && m >= ph.end) endPhase();
    } else if (V.state === 'scratch') { if (performance.now() >= V.scratchEnd) startPhase(V.phase + 1); } // wall clock (a slow frame can't stretch it)
    animate(rdt, m); render3d(); draw2d(m);
  }
  function recDrift(d, rdt, ph) { const a = Math.abs(d) * 1000, beat = (mediaNow() - ph.grid0) / ph.P; if (beat < LEAD_BARS * 4 - 2) { V.drift.leadMax = Math.max(V.drift.leadMax || 0, a); return; } if (a > V.drift.max) V.drift.maxAt = [ph.idx, +beat.toFixed(1)]; V.drift.n++; V.drift.sum += a; V.drift.max = Math.max(V.drift.max, a); ph.frameClock = (ph.frameClock == null ? mediaNow() : ph.frameClock + rdt); V.drift.frameMax = Math.max(V.drift.frameMax, Math.abs(ph.frameClock - mediaNow()) * 1000); }
  function animate(dt, m) {
    const ph = V.ph, P = ph ? ph.P : 0.46, beatPh = ph && V.state === 'play' ? ((m - ph.grid0) / P) : performance.now() / 460, bf = beatPh - Math.floor(beatPh), pulse = Math.exp(-bf * 6);
    const T = performance.now() / 1000, zap = V.fx.zap, cnt = V.fx.counter;
    for (const k of ['zap', 'counter', 'shake', 'flash', 'beat']) V.fx[k] = Math.max(0, V.fx[k] - dt * (k === 'counter' ? 1.2 : 2.5));
    for (let i = 0; i < 4; i++) V.laneFlash[i] = Math.max(0, V.laneFlash[i] - dt);
    if (segs.length) { // stand-in eel: an S-curve swaying to the beat, rising out of the booth; head bobs on every beat
      const sway = V.state === 'win' ? 0.2 : 1, sink = V.state === 'win' ? Math.min(1.6, (performance.now() - V.stateT) / 900) : 0;
      for (let i = 0; i < segs.length; i++) { const u = i / (segs.length - 1); segs[i].position.set(Math.sin(T * 2.2 + u * 3.4) * 0.45 * u * sway, 0.6 + u * 2.0 - sink * u, -0.25 + Math.cos(T * 1.7 + u * 2) * 0.15); }
      const top = segs[segs.length - 1].position; V.head.position.set(top.x, top.y + 0.55 + pulse * 0.08, top.z + 0.15);
      V.head.rotation.set(-0.15 + pulse * 0.12 + (cnt > 0 ? -0.5 * cnt : 0), Math.sin(T * 1.1) * 0.3, Math.sin(T * 2.2) * 0.1 + (zap > 0 ? Math.sin(T * 40) * 0.1 : 0));
      V.jaw.rotation.x = 0.15 + pulse * 0.25 + (V.dropAhead ? 0.35 : 0); V.shades.visible = V.state === 'play' && V.ph && V.ph.idx === 2;
      const em = 0.4 + pulse * 0.6 + (V.dropAhead ? 1.2 * (0.5 + 0.5 * Math.sin(T * 30)) : 0) + cnt * 2; for (const s of segs) s.material.emissiveIntensity = em;
      vicRoot.getWorldPosition(VHEAD); VHEAD.add(V.head.position);
    } else if (V.ext) { const e = V.ext; try { e.update && e.update(dt, { beat: pulse, hurt: cnt, drop: !!V.dropAhead, state: V.state }); } catch (er) {} vicRoot.getWorldPosition(VHEAD); VHEAD.y += 2.6; }
    for (const d of V.decks) d.rotation.y -= dt * (V.state === 'play' ? 3.5 : V.state === 'scratch' ? -9 : 0.5);
    if (V.cones) for (const c of V.cones) { c.scale.setScalar(1 + pulse * 0.12); c.material.emissiveIntensity = 0.3 + pulse * 0.9; }
    key.intensity = 22 + pulse * 30 + cnt * 40; rim.intensity = 14 + (V.dropAhead ? 30 * (0.5 + 0.5 * Math.sin(T * 24)) : pulse * 10); rim.color.set(V.dropAhead ? '#ff2a2a' : '#ff3d6e');
    if (V.state !== 'off' && Math.random() < dt * 14) burst((Math.random() - 0.5) * 11, 3 + Math.random() * 6, -5 - Math.random() * 3, 3, 1.0); // ambient night sparks
    if (V.state === 'play' && pulse > 0.95 && !V._beatSpark) { V._beatSpark = true; burst(VHEAD.x, VHEAD.y, VHEAD.z, 6, 2.5); } if (pulse < 0.5) V._beatSpark = false;
    sparkStep(dt); if (boltT > 0) { boltT -= dt; boltMat.opacity = Math.max(0, boltT / 0.18); if (boltT <= 0) bolt.visible = false; }
    // telegraph: the bar before a drop
    V.dropAhead = null; if (ph && V.state === 'play') { const bar = Math.floor((m - ph.grid0) / (4 * P)); const d = ph.dropBars.get(bar + 1) || ph.dropBars.get(bar); if (d) V.dropAhead = { d, now: ph.dropBars.get(bar) === d }; }
  }
  function render3d() {
    const port = VW() / VH(), sh = V.fx.shake; scam.aspect = port; scam.fov = port < 1 ? 62 : 46;
    scam.position.set(Math.sin(performance.now() / 2400) * 0.4 + (Math.random() - 0.5) * sh * 0.15, (port < 1 ? 2.2 : 2.4) + (Math.random() - 0.5) * sh * 0.15, port < 1 ? 9.4 : 8.2);
    scam.lookAt(0, port < 1 ? 1.15 : 1.5, 0); scam.updateProjectionMatrix();
    // put Vic in the upper part of the screen (the note highway takes the lower part)
    scam.setViewOffset(1000 * port, 1000, 0, port < 1 ? 120 : 80, 1000 * port, 1000); // (setViewOffset sets aspect = fullW / fullH)
    draw(stage, scam);
  }
  // ---------- 2D overlay: highway, notes, judgments, HP, combo ----------
  const LANECOL = ['#39e6ff', '#ff6ad5', '#9dff6b', '#ffe14a'], LANECOL3 = ['#39e6ff', '#ff6ad5', '#ffe14a'];
  function draw2d(m) {
    const c = g; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
    const top0 = V.top0 || 0;
    if (V.fx.zap > 0) { c.fillStyle = `rgba(120,220,255,${V.fx.zap * 0.28})`; c.fillRect(0, 0, W, H); }
    if (V.fx.flash > 0) { c.fillStyle = `rgba(255,255,255,${V.fx.flash * 0.25})`; c.fillRect(0, 0, W, H); }
    const ph = V.ph, nl = V.lanes, r = hw(), lw = (r.x1 - r.x0) / nl, cols = nl === 3 ? LANECOL3 : LANECOL;
    const lead = ph ? [1.7, 1.45, 1.25][ph.idx] : 1.6;
    const yOf = (dt) => r.hit - (dt / lead) * (r.hit - r.top), sc = (y) => 0.55 + 0.45 * Math.max(0, Math.min(1.2, (y - r.top) / (r.hit - r.top)));
    const xOf = (lane, y) => { const s = sc(y), cx = (r.x0 + r.x1) / 2; return cx + ((lane + 0.5) * lw - (r.x1 - r.x0) / 2) * s; };
    if (V.state !== 'off') {
      // highway (a trapezoid: narrow at the top)
      const sT = sc(r.top), cx = (r.x0 + r.x1) / 2, hwT = (r.x1 - r.x0) / 2 * sT, hwB = (r.x1 - r.x0) / 2, yB = nl === 3 ? H : r.hit + 40;
      c.fillStyle = 'rgba(8,4,20,.72)'; c.beginPath(); c.moveTo(cx - hwT, r.top); c.lineTo(cx + hwT, r.top); c.lineTo(cx + hwB * 1.04, yB); c.lineTo(cx - hwB * 1.04, yB); c.closePath(); c.fill();
      for (let i = 0; i < nl; i++) { // lane tints (+ drop telegraph)
        const xa = cx + (i * lw - (r.x1 - r.x0) / 2) * sT, xb = cx + ((i + 1) * lw - (r.x1 - r.x0) / 2) * sT, xc = cx + ((i + 1) * lw - (r.x1 - r.x0) / 2), xd = cx + (i * lw - (r.x1 - r.x0) / 2);
        let a = 0.06 + V.laneFlash[i] * 2; const dropL = V.dropAhead && V.dropAhead.d.lanes.includes(i);
        if (dropL) a += V.dropAhead.now ? 0.22 : 0.12 + 0.12 * Math.sin(performance.now() / 60);
        c.fillStyle = dropL ? `rgba(255,60,60,${a})` : hexA(cols[i], a); c.beginPath(); c.moveTo(xa, r.top); c.lineTo(xb, r.top); c.lineTo(xc, yB); c.lineTo(xd, yB); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(xb, r.top); c.lineTo(xc, yB); c.stroke();
        if (dropL && !V.dropAhead.now) { c.font = `900 ${Math.round(lw * 0.36)}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#ffe14a'; c.fillText('⚡', (xa + xb) / 2, r.top + 30); }
      }
      // beat lines
      if (ph && V.state === 'play') { const P = ph.P; const b0 = Math.ceil((m - ph.grid0) / P); for (let b = b0; b < b0 + 8; b++) { const t = ph.grid0 + b * P, y = yOf(t - m); if (y < r.top) break; const s = sc(y), half = (r.x1 - r.x0) / 2 * s;
        c.strokeStyle = b % 4 === 0 ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.1)'; c.lineWidth = b % 4 === 0 ? 2 : 1; c.beginPath(); c.moveTo(cx - half, y); c.lineTo(cx + half, y); c.stroke(); } }
      // hit line + lane buttons
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.shadowColor = '#39e6ff'; c.shadowBlur = 12 + V.fx.beat * 16; c.beginPath(); c.moveTo(r.x0, r.hit); c.lineTo(r.x1, r.hit); c.stroke(); c.shadowBlur = 0;
      const lab = nl === 4 ? ['D', 'F', 'J', 'K'] : ['', '', ''];
      for (let i = 0; i < nl; i++) { const x = r.x0 + (i + 0.5) * lw, rr = Math.min(lw * 0.36, 34); c.fillStyle = V.laneFlash[i] > 0 ? cols[i] : 'rgba(20,12,40,.9)'; c.strokeStyle = cols[i]; c.lineWidth = 3; c.beginPath(); c.arc(x, r.hit, rr, 0, TAU); c.fill(); c.stroke();
        if (lab[i]) { c.fillStyle = V.laneFlash[i] > 0 ? '#000' : '#fff'; c.font = `900 ${Math.round(rr * 0.8)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lab[i], x, r.hit + 1); } }
      if (nl === 3) { c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '800 12px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let i = 0; i < 3; i++) c.fillText('TAP', r.x0 + (i + 0.5) * lw, r.hit + 56); }
      // notes
      if (ph && (V.state === 'play' || V.state === 'win' || V.state === 'lose')) for (const n of V.notes) {
        const dt = n.t - m; if (dt > lead) break; if (n.done && (n.j !== 'miss' || dt < -0.25)) continue; const y = yOf(dt); if (y > H + 20) continue;
        const s = sc(y), x = xOf(n.lane, y), w = lw * 0.78 * s, h = 16 * s + 4;
        c.globalAlpha = n.done ? 0.35 : 1;
        if (n.atk) { c.fillStyle = '#ff2a2a'; c.shadowColor = '#ff6a00'; c.shadowBlur = 14; zig(c, x, y, w, h); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#ffe14a'; c.lineWidth = 2; c.stroke(); }
        else { c.fillStyle = cols[n.lane]; c.shadowColor = cols[n.lane]; c.shadowBlur = 10; rrect(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.7)'; rrect(c, x - w / 2 + 4, y - h / 2 + 2, w - 8, h * 0.3, h * 0.15); c.fill(); }
        c.globalAlpha = 1;
      }
      // judgments
      for (const p of V.pops) { p.t -= 1 / 60; const x = p.lane < 0 ? W / 2 : r.x0 + (p.lane + 0.5) * lw, y = (p.lane < 0 ? r.top + 60 : r.hit - 46) - (0.6 - p.t) * 40;
        c.globalAlpha = Math.max(0, Math.min(1, p.t * 3)); c.font = `900 ${p.lane < 0 ? 30 : Math.min(18, lw * 0.22)}px system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(p.txt, x, y); c.fillStyle = p.c; c.fillText(p.txt, x, y); c.globalAlpha = 1; }
      V.pops = V.pops.filter((p) => p.t > 0); if (V.pops.length > 24) V.pops.splice(0, V.pops.length - 24);
      // HUD: Vic HP (top, 3 segments), phase + record, Harold HP (bottom), combo
      const bw = Math.min(W - 24, 520), bx = (W - bw) / 2, by = top0 + 8;
      c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(bx - 3, by - 3, bw + 6, 20); for (let k = 0; k < 3; k++) { const f = Math.max(0, Math.min(1, (V.vhp - k * 100) / 100)); c.fillStyle = '#2a1650'; c.fillRect(bx + k * bw / 3 + 1, by, bw / 3 - 2, 14); c.fillStyle = k === 2 ? '#ff3d6e' : k === 1 ? '#ff9a3d' : '#ffe14a'; c.fillRect(bx + k * bw / 3 + 1, by, (bw / 3 - 2) * f, 14); }
      c.font = "10px 'PX', monospace"; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; const nm = 'VOLTAGE VIC'; c.strokeText(nm, bx, by + 20); c.fillText(nm, bx, by + 20);
      const rec = ph ? `PHASE ${ph.idx + 1}/3 · ${V.mode === 'yt' ? ph.song.title.toUpperCase() : 'LIVE BEAT'}${SYNC ? ' · SYNC' : ''}` : ''; c.textAlign = 'right'; c.font = "800 11px system-ui, sans-serif"; c.strokeText(rec, bx + bw, by + 20); c.fillStyle = '#8ff3ff'; c.fillText(rec, bx + bw, by + 20);
      const hy = H - (nl === 3 ? 20 : 28), hbw = Math.min(220, W * 0.5); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(10, hy - 3, hbw + 6, 16); c.fillStyle = '#3a1020'; c.fillRect(13, hy, hbw, 10); c.fillStyle = V.hp > 35 ? '#9dff6b' : '#ff4d6d'; c.fillRect(13, hy, hbw * V.hp / 100, 10);
      c.textAlign = 'left'; c.textBaseline = 'bottom'; c.font = "9px 'PX', monospace"; c.fillStyle = '#fff'; c.strokeText('HAROLD', 12, hy - 5); c.fillText('HAROLD', 12, hy - 5);
      if (V.combo >= 2) { const x = nl === 3 ? W - 14 : r.x1 + 16, y = nl === 3 ? r.top - 10 : r.hit - 80; c.textAlign = nl === 3 ? 'right' : 'left'; c.textBaseline = 'alphabetic'; c.font = `900 ${28 + V.fx.beat * 6}px system-ui, sans-serif`; c.lineWidth = 5; c.strokeText(V.combo, x, y); c.fillStyle = '#ffe14a'; c.fillText(V.combo, x, y);
        c.font = "9px 'PX', monospace"; c.lineWidth = 3; const t = 'COMBO' + (V.mult > 1 ? ' x' + V.mult : ''); c.strokeText(t, x, y + 16); c.fillStyle = '#fff'; c.fillText(t, x, y + 16); }
      if (V.dropAhead && V.state === 'play') { const t = V.dropAhead.now ? 'DROP!' : "VIC'S DROP INCOMING"; c.font = `900 ${V.dropAhead.now ? 30 : 16}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = '#000'; c.strokeText(t, W / 2, r.top - 18); c.fillStyle = V.dropAhead.now ? '#ff4d4d' : '#ffe14a'; c.fillText(t, W / 2, r.top - 18); }
      if (V.state === 'cue' || V.state === 'scratch') { const t = V.state === 'cue' ? 'VIC IS CUEING THE RECORD…' : 'SCRATCH!'; c.font = `900 ${V.state === 'scratch' ? 34 : 16}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = '#000'; c.strokeText(t, W / 2, (r.top + r.hit) / 2); c.fillStyle = '#ffe14a'; c.fillText(t, W / 2, (r.top + r.hit) / 2); }
      if (ph && V.state === 'play') { const b = Math.floor((m - ph.grid0) / ph.P); if (b < LEAD_BARS * 4 && b >= 0) { const k = 4 - (b % 4); const big = b >= 4; c.font = `900 ${big ? 54 : 30}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#000'; const t = big ? (k === 4 ? 'READY' : String(k)) : (ph.idx ? 'NEXT RECORD' : 'GET READY'); c.strokeText(t, W / 2, (r.top + r.hit) / 2); c.fillStyle = '#fff'; c.fillText(t, W / 2, (r.top + r.hit) / 2); } }
    }
  }
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); }
  function zig(c, x, y, w, h) { c.beginPath(); const n = 6; c.moveTo(x - w / 2, y); for (let i = 0; i <= n; i++) c.lineTo(x - w / 2 + (w * i) / n, y + (i % 2 ? -h / 2 : h / 2) * 0.9); c.lineTo(x + w / 2, y); for (let i = n; i >= 0; i--) c.lineTo(x - w / 2 + (w * i) / n, y + (i % 2 ? h / 2 : -h / 2) * 0.55 + h * 0.15); c.closePath(); }

  // ---------- entry: ACT at the boss anchor; ?vic=... from the URL ----------
  { const lm = L(); if (lm && lm.boss) { const B = lm.boss;
    ACTIONS.push({ kind: 'boss', get label() { return B.cleared ? 'REMATCH VIC' : 'FIGHT VIC'; }, x: B.x, z: B.z, r: 2.6, y: 2.4, ok: () => !V.on && !hero.roof, go: () => start('act') }); } }
  if (QV) addEventListener('load', () => setTimeout(() => start('url'), 600));
  const api = { V, start, exit, begin, retry, frame, laneHit, mediaNow, yt, VIC_SONGS, VIC_SET, get on() { return V.on; }, get notes() { return V.notes; },
    stats: () => ({ state: V.state, phase: V.phase, mode: V.mode, hp: Math.round(V.hp), vhp: Math.round(V.vhp), counts: V.counts, combo: V.combo, maxCombo: V.maxCombo, drops: V.drops, result: V.result || null, rig: V.rig, lanes: V.lanes,
      wins: V.wins, losses: V.losses, runs: V.runs, ytFails: V.ytFails,
      judgeErrMs: V.judgeErr.length ? { n: V.judgeErr.length, max: +(Math.max(...V.judgeErr.map(Math.abs)) * 1000).toFixed(2), mean: +(V.judgeErr.reduce((a, b) => a + b, 0) / V.judgeErr.length * 1000).toFixed(2) } : null,
      drift: { n: V.drift.n, maxMs: +V.drift.max.toFixed(2), maxAt: V.drift.maxAt, leadInMaxMs: +(V.drift.leadMax || 0).toFixed(1), meanMs: V.drift.n ? +(V.drift.sum / V.drift.n).toFixed(2) : 0, frameClockMaxMs: +V.drift.frameMax.toFixed(1) }, ytClock: { polls: yt.polls, changes: yt.changes, resyncs: yt.resyncs },
      cleared: !!(L() && L().boss && L().boss.cleared), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
  window.__vic = api;
  return api;
})();

'use strict';
/* GULF THUNDER - core: screen, input, audio, font, fx, loop */
const GT = window.GT = {};
const VW = 270, VH = 480;
GT.VW = VW; GT.VH = VH;
const Q = new URLSearchParams(location.search);
GT.god = Q.has('god');
GT.bot = Q.has('bot');
GT.speed = Math.max(1, Math.min(16, +(Q.get('speed') || 1)));
GT.startStage = +(Q.get('stage') || 0);
GT.mute = Q.has('mute');
GT.capture = Q.has('capture');
if (GT.capture) { let _s = (+(Q.get('seed')||12345))>>>0; Math.random = function(){ _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return (_s % 1000000) / 1000000; }; GT.__rsGet = () => _s; GT.__rsSet = v => { _s = v; }; }
GT.log = window.__gtLog = [];
// capture hook: game setTimeouts run on game time (not wall clock) so frame-stepped capture plays like real-time play
GT.__tq = [];
if (GT.capture) { window.setTimeout = function (fn, ms) { GT.__tq.push({ at: (GT.t || 0) + (+ms || 0) / 1000, fn }); return GT.__tq.length; }; }
GT.t = 0; // global frame time
function glog(m) { GT.log.push(m); }
GT.glog = glog;

/* ---------------- math helpers ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
GT.clamp = clamp; GT.rnd = rnd; GT.rndi = rndi; GT.lerp = lerp; GT.sgn = sgn;
// seeded rng for art
GT.srand = function (seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; };

/* ---------------- screen ---------------- */
const disp = document.getElementById('game');
const dctx = disp.getContext('2d');
const scr = document.createElement('canvas');
const ctx = scr.getContext('2d');
GT.ctx = ctx;
GT.LW = VW; GT.LH = VH; GT.OX = 0; GT.OY = 0;
let K = 1, DW = VW, DH = VH;
GT.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || Q.has('touch');
function resize() {
  const dpr = Math.min(4, window.devicePixelRatio || 1);
  const cw = window.innerWidth, ch = window.innerHeight;
  let w = cw, h = ch;
  if (w > h * 0.8) w = Math.round(h * VW / VH); // landscape / desktop: 9:16 at full height
  DW = Math.max(1, Math.round(w * dpr)); DH = Math.max(1, Math.round(h * dpr));
  let k = Math.min(DW / VW, DH / VH);
  if (k >= 3) k = Math.floor(k);
  K = k;
  GT.LW = Math.max(VW, Math.ceil(DW / k));
  GT.LH = Math.max(VH, Math.ceil(DH / k));
  GT.OX = Math.floor((GT.LW - VW) / 2);
  // keep more spare room below the play area, where the thumbs and touch buttons are
  GT.OY = Math.floor((GT.LH - VH) * (GT.isTouch ? 0.35 : 0.5));
  scr.width = GT.LW; scr.height = GT.LH;
  disp.width = DW; disp.height = DH;
  disp.style.width = w + 'px'; disp.style.height = h + 'px';
  ctx.imageSmoothingEnabled = false;
  layoutTouch(w, h, cw, ch);
}
GT.resize = resize;

/* ---------------- input ---------------- */
const BTN = ['fire', 'jump', 'spec', 'start'];
const inp = GT.inp = { x: 0, y: 0, fire: false, jump: false, spec: false, start: false, fireP: false, jumpP: false, specP: false, startP: false, anyP: false };
const keys = {};
const latch = { fire: 0, jump: 0, spec: 0, start: 0 };
const touchHeld = { fire: false, jump: false, spec: false };
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
GT.botInp = { x: 0, y: 0, fire: false, jump: false, spec: false, fireP: false, jumpP: false, specP: false };
const KEYMAP = {
  ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
  KeyJ: 'fire', KeyZ: 'fire', KeyK: 'jump', KeyX: 'jump', Space: 'jump', KeyL: 'spec', KeyC: 'spec', Enter: 'start', Escape: 'start'
};
window.addEventListener('keydown', e => {
  const m = KEYMAP[e.code];
  if (!m) return;
  e.preventDefault();
  GT.audioInit();
  if (!keys[m]) { if (latch[m] !== undefined) latch[m]++; latch.start += (m === 'fire' || m === 'start') ? 1 : 0; }
  keys[m] = true;
});
window.addEventListener('keyup', e => { const m = KEYMAP[e.code]; if (m) { keys[m] = false; e.preventDefault(); } });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let padPrev = {};
function pollPad() {
  const r = { x: 0, y: 0, fire: false, jump: false, spec: false, start: false };
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.abs(ax) > 0.25) r.x = ax;
    if (Math.abs(ay) > 0.25) r.y = ay;
    const b = i => p.buttons[i] && p.buttons[i].pressed;
    if (b(14)) r.x = -1; if (b(15)) r.x = 1; if (b(12)) r.y = -1; if (b(13)) r.y = 1;
    if (b(2) || b(7)) r.fire = true;
    if (b(0)) r.jump = true;
    if (b(1) || b(3) || b(6)) r.spec = true;
    if (b(9)) r.start = true;
  }
  for (const k of ['fire', 'jump', 'spec', 'start']) {
    if (r[k] && !padPrev[k]) { latch[k]++; if (k === 'fire') latch.start++; GT.audioInit(); }
  }
  padPrev = r;
  return r;
}
function sampleInput() {
  const pad = pollPad();
  let x = 0, y = 0;
  if (keys.L) x -= 1; if (keys.R) x += 1; if (keys.U) y -= 1; if (keys.D) y += 1;
  if (pad.x) x = pad.x; if (pad.y) y = pad.y;
  if (stick.id !== null) { x = stick.x; y = stick.y; }
  inp.x = clamp(x, -1, 1); inp.y = clamp(y, -1, 1);
  inp.fire = !!(keys.fire || pad.fire || touchHeld.fire);
  inp.jump = !!(keys.jump || pad.jump || touchHeld.jump);
  inp.spec = !!(keys.spec || pad.spec || touchHeld.spec);
  inp.start = !!(keys.start || pad.start);
  inp.fireP = latch.fire > 0; inp.jumpP = latch.jump > 0; inp.specP = latch.spec > 0; inp.startP = latch.start > 0;
  latch.fire = latch.jump = latch.spec = latch.start = 0;
  if (GT.bot && GT.botActive) {
    const b = GT.botInp;
    inp.x = b.x; inp.y = b.y; inp.fire = b.fire; inp.jump = b.jump; inp.spec = b.spec;
    inp.fireP = b.fireP; inp.jumpP = b.jumpP; inp.specP = b.specP;
    b.fireP = b.jumpP = b.specP = false;
  }
  if (GT.bot) { if (GT.botStart) { inp.startP = true; GT.botStart = false; } }
}

/* touch overlay */
const tEl = document.getElementById('touch');
const tb = { fire: document.getElementById('bFire'), jump: document.getElementById('bJump'), spec: document.getElementById('bSpec') };
const sBase = document.getElementById('stickBase'), sKnob = document.getElementById('stickKnob'), sHint = document.getElementById('stickHint');
function layoutTouch(w, h, cw, ch) {
  if (!tEl) return;
  const s = Math.min(1.15, Math.max(0.8, cw / 390));
  const st = (el, r, b) => { el.style.right = r + 'px'; el.style.bottom = b + 'px'; el.style.transform = 'scale(' + s + ')'; el.style.transformOrigin = 'right bottom'; };
  const base = Math.max(14, ch * 0.03);
  st(tb.fire, 14, base + 8);
  st(tb.jump, 14 + 94 * s, base);
  st(tb.spec, 22, base + 100 * s);
  sHint.style.bottom = (base + 6) + 'px';
}
if (GT.isTouch) tEl.classList.add('on');
GT.touchVisible = v => { if (GT.isTouch) tEl.classList.toggle('on', v); };
for (const k in tb) {
  const el = tb[k];
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); GT.audioInit();
    try { el.setPointerCapture(e.pointerId); } catch (_) { }
    touchHeld[k] = true; latch[k]++; if (k === 'fire') latch.start++;
    el.classList.add('down');
  });
  const up = e => { touchHeld[k] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
tEl.addEventListener('pointerdown', e => {
  e.preventDefault(); GT.audioInit();
  latch.start++;
  if (stick.id === null && e.clientX < window.innerWidth * 0.62) {
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    try { tEl.setPointerCapture(e.pointerId); } catch (_) { }
    sBase.style.display = sKnob.style.display = 'block'; sHint.style.display = 'none';
    sBase.style.left = sKnob.style.left = e.clientX + 'px'; sBase.style.top = sKnob.style.top = e.clientY + 'px';
  }
});
tEl.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
  const d = Math.hypot(dx, dy), R = 42;
  if (d > R) { // floating: drag the base along
    stick.ox += dx * (1 - R / d); stick.oy += dy * (1 - R / d);
    dx = e.clientX - stick.ox; dy = e.clientY - stick.oy;
    sBase.style.left = stick.ox + 'px'; sBase.style.top = stick.oy + 'px';
  }
  const dz = 6;
  stick.x = Math.abs(dx) < dz ? 0 : clamp(dx / 30, -1, 1);
  stick.y = Math.abs(dy) < dz ? 0 : clamp(dy / 30, -1, 1);
  sKnob.style.left = (stick.ox + dx) + 'px'; sKnob.style.top = (stick.oy + dy) + 'px';
});
const stickUp = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; sBase.style.display = sKnob.style.display = 'none'; sHint.style.display = 'block'; };
tEl.addEventListener('pointerup', stickUp); tEl.addEventListener('pointercancel', stickUp);
document.addEventListener('contextmenu', e => e.preventDefault());
// tapping canvas on desktop also counts as start
disp.addEventListener('pointerdown', () => { GT.audioInit(); latch.start++; });

/* ---------------- audio ---------------- */
const AU = GT.AU = { ac: null, master: null, sfx: null, mus: null, noise: null, song: null, step: 0, nextT: 0, timer: null };
GT.audioInit = function () {
  if (GT.mute) return;
  if (AU.ac) { if (AU.ac.state === 'suspended') AU.ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    AU.ac = new AC();
    AU.master = AU.ac.createGain(); AU.master.gain.value = 0.5; AU.master.connect(AU.ac.destination);
    AU.sfx = AU.ac.createGain(); AU.sfx.gain.value = 0.55; AU.sfx.connect(AU.master);
    AU.mus = AU.ac.createGain(); AU.mus.gain.value = 0.32; AU.mus.connect(AU.master);
    const n = AU.ac.createBuffer(1, AU.ac.sampleRate, AU.ac.sampleRate);
    const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = n;
    if (AU.pending) { const p = AU.pending; AU.pending = null; GT.music(p); }
  } catch (e) { AU.ac = null; }
};
function tone(f, dur, type, vol, f2, dest, t0) {
  const ac = AU.ac; if (!ac) return;
  const t = t0 || GT.__now();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, dest, t0, q) {
  const ac = AU.ac; if (!ac || !AU.noise) return;
  const t = t0 || GT.__now();
  const s = ac.createBufferSource(); s.buffer = AU.noise;
  s.playbackRate.value = 0.5 + Math.random();
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq || 2000, t);
  if (q) f.frequency.exponentialRampToValueAtTime(q, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const sfxLast = {}; window.__sfxLast = sfxLast;
GT.__now = () => (GT.__T !== undefined ? GT.__T : AU.ac.currentTime);
GT.sfx = function (name) {
  if (!AU.ac || GT.speed > 2) return;
  const now = GT.__now();
  if (sfxLast[name] && now - sfxLast[name] < 0.045) return;
  sfxLast[name] = now;
  switch (name) {
    case 'shot': tone(880, 0.07, 'square', 0.06, 220); break;
    case 'pistol': noise(0.08, 0.25, 3000, null, null, 400); tone(300, 0.06, 'square', 0.08, 80); break;
    case 'eshot': tone(500, 0.1, 'sawtooth', 0.05, 160); break;
    case 'missile': noise(0.35, 0.18, 1200, null, null, 300); tone(200, 0.3, 'sawtooth', 0.05, 600); break;
    case 'boom': noise(0.6, 0.5, 900, null, null, 60); tone(90, 0.4, 'triangle', 0.35, 30); break;
    case 'bigboom': noise(1.4, 0.7, 1400, null, null, 40); tone(70, 1.0, 'triangle', 0.5, 20); break;
    case 'small': noise(0.18, 0.3, 1800, null, null, 200); break;
    case 'punch': noise(0.07, 0.35, 1500, null, null, 300); tone(160, 0.06, 'square', 0.12, 60); break;
    case 'whiff': noise(0.06, 0.08, 4000, null, null, 1500); break;
    case 'hit': tone(220, 0.12, 'square', 0.15, 70); noise(0.1, 0.2, 1200); break;
    case 'hurt': tone(300, 0.2, 'sawtooth', 0.15, 90); break;
    case 'jump': tone(300, 0.15, 'square', 0.08, 700); break;
    case 'land': noise(0.08, 0.15, 600); break;
    case 'slam': noise(0.5, 0.6, 700, null, null, 50); tone(60, 0.4, 'triangle', 0.4, 25); break;
    case 'pickup': tone(660, 0.07, 'square', 0.1); tone(990, 0.12, 'square', 0.1, null, null, GT.__now() + 0.07); break;
    case 'boost': noise(0.4, 0.2, 3000, null, null, 500); tone(150, 0.4, 'sawtooth', 0.06, 450); break;
    case 'cloak': tone(1200, 0.4, 'sine', 0.08, 300); break;
    case 'alarm': tone(880, 0.15, 'square', 0.1); tone(660, 0.15, 'square', 0.1, null, null, GT.__now() + 0.15); break;
    case 'select': tone(520, 0.06, 'square', 0.1); tone(780, 0.1, 'square', 0.1, null, null, GT.__now() + 0.06); break;
    case 'type': tone(1400, 0.02, 'square', 0.03); break;
    case 'break': noise(0.25, 0.35, 2500, null, null, 300); break;
    case 'clear': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'square', 0.1, null, null, GT.__now() + i * 0.12)); break;
    case 'die': [400, 300, 200, 120].forEach((f, i) => tone(f, 0.22, 'square', 0.12, null, null, GT.__now() + i * 0.15)); break;
  }
};
/* music: songs are {bpm, bass, lead, drum} strings of 8th-note steps */
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nfreq(n) { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; let s = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (s - 69) / 12); }
GT.SONGS = {};
function parseSong(s) {
  const tok = str => str.replace(/\|/g, ' ').trim().split(/\s+/);
  return { bpm: s.bpm, bass: tok(s.bass), lead: tok(s.lead), drum: tok(s.drum), arp: s.arp ? tok(s.arp) : null, leadType: s.leadType || 'square' };
}
GT.music = function (name) {
  if (GT.mute) return;
  if (!AU.ac) { AU.pending = name; return; }
  if (AU.songName === name) return;
  AU.songName = name;
  AU.song = name && GT.SONGS[name] ? parseSong(GT.SONGS[name]) : null;
  AU.step = 0; AU.nextT = GT.__now() + 0.08;
  if (!AU.timer) AU.timer = setInterval(schedMusic, 40);
};
window.__sched = () => schedMusic();
function schedMusic() {
  const ac = AU.ac, s = AU.song; if (!ac || !s || GT.speed > 2) return;
  const st = 60 / s.bpm / 2;
  while (AU.nextT < GT.__now() + 0.15) {
    const t = AU.nextT, i = AU.step;
    const b = s.bass[i % s.bass.length]; if (b && b !== '.') tone(nfreq(b), st * 0.9, 'triangle', 0.5, null, AU.mus, t);
    const l = s.lead[i % s.lead.length]; if (l && l !== '.' && l !== '-') tone(nfreq(l), st * 1.6, s.leadType, 0.13, null, AU.mus, t);
    if (s.arp) { const a = s.arp[i % s.arp.length]; if (a && a !== '.') tone(nfreq(a), st * 0.45, 'square', 0.05, null, AU.mus, t + st / 2); }
    const d = s.drum[i % s.drum.length];
    if (d === 'k' || d === 'x') tone(130, 0.12, 'sine', 0.7, 40, AU.mus, t);
    if (d === 's' || d === 'x') noise(0.12, 0.35, 3500, AU.mus, t, 800);
    if (d === 'h') noise(0.03, 0.12, 9000, AU.mus, t);
    AU.nextT += st; AU.step++;
  }
}

/* ---------------- pixel font ---------------- */
const GLYPH = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0],
  '-': [0, 0, 0, 14, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], '/': [1, 1, 2, 4, 8, 16, 16], '"': [10, 10, 0, 0, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8], '+': [0, 4, 4, 31, 4, 4, 0], '>': [8, 4, 2, 1, 2, 4, 8], '<': [2, 4, 8, 16, 8, 4, 2], '=': [0, 0, 31, 0, 31, 0, 0],
  '&': [12, 18, 20, 8, 21, 18, 13], '#': [10, 31, 10, 10, 10, 31, 10], '*': [0, 21, 14, 31, 14, 21, 0], '%': [24, 25, 2, 4, 8, 19, 3], ' ': [0, 0, 0, 0, 0, 0, 0]
};
const fontCache = {};
function fontAtlas(col) {
  if (fontCache[col]) return fontCache[col];
  const chars = Object.keys(GLYPH);
  const c = document.createElement('canvas'); c.width = chars.length * 6; c.height = 7;
  const g = c.getContext('2d'); g.fillStyle = col;
  const idx = {};
  chars.forEach((ch, i) => { idx[ch] = i; const gl = GLYPH[ch]; for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (gl[y] & (16 >> x)) g.fillRect(i * 6 + x, y, 1, 1); });
  return (fontCache[col] = { c, idx });
}
GT.textW = (s, sc) => s.length * 6 * (sc || 1) - (sc || 1);
// draw text; align: 0 left, 1 center, 2 right; shadow color optional
GT.text = function (g, s, x, y, col, sc, align, shadow) {
  s = String(s).toUpperCase(); sc = sc || 1;
  if (align === 1) x = Math.round(x - GT.textW(s, sc) / 2); else if (align === 2) x = Math.round(x - GT.textW(s, sc));
  if (shadow) { GT.text(g, s, x + sc, y + sc, shadow, sc, 0); GT.text(g, s, x - (shadow === '#000' ? 0 : 0), y + sc, shadow, sc, 0); }
  const a = fontAtlas(col || '#fff');
  for (let i = 0; i < s.length; i++) {
    const k = a.idx[s[i]]; if (k === undefined) continue;
    g.drawImage(a.c, k * 6, 0, 5, 7, x + i * 6 * sc, y, 5 * sc, 7 * sc);
  }
};
// outlined text (for logos / banners)
GT.textO = function (g, s, x, y, col, sc, align, ocol) {
  ocol = ocol || '#000'; sc = sc || 1;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) GT.text(g, s, x + dx, y + dy, ocol, sc, align);
  GT.text(g, s, x, y, col, sc, align);
};
GT.wrap = function (s, maxChars) {
  const out = []; let line = '';
  for (const w of s.split(' ')) {
    if (w === '\n') { out.push(line); line = ''; continue; }
    if ((line + ' ' + w).trim().length > maxChars) { out.push(line); line = w; } else line = (line ? line + ' ' : '') + w;
  }
  if (line) out.push(line);
  return out;
};

/* ---------------- gfx helpers ---------------- */
GT.mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return c; };
GT.R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
GT.circ = function (g, cx, cy, r, c) { // crisp pixel circle
  g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
};
// outline a sprite canvas (adds 1px dark border around non-transparent pixels)
GT.outline = function (c, col) {
  const w = c.width, h = c.height;
  const s = GT.mk(w, h), sg = s.getContext('2d');
  sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col || '#0c0a14'; sg.fillRect(0, 0, w, h);
  const o = GT.mk(w, h), og = o.getContext('2d');
  og.drawImage(s, 1, 0); og.drawImage(s, -1, 0); og.drawImage(s, 0, 1); og.drawImage(s, 0, -1);
  og.drawImage(c, 0, 0);
  return o;
};
GT.spr = function (w, h, fn, ol) { const c = GT.mk(w, h); fn(c.getContext('2d'), c); return ol === false ? c : GT.outline(c, ol); };
const flipCache = new WeakMap();
GT.flip = function (c) {
  let f = flipCache.get(c); if (f) return f;
  f = GT.mk(c.width, c.height); const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  flipCache.set(c, f); return f;
};
const whiteCache = new WeakMap();
GT.white = function (c) {
  let f = whiteCache.get(c); if (f) return f;
  f = GT.mk(c.width, c.height); const g = f.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  whiteCache.set(c, f); return f;
};
// draw sprite anchored at (x,y) = bottom-center by default
GT.draw = function (g, c, x, y, flip, ax, ay, flash) {
  if (!c) return;
  const im = flip ? GT.flip(c) : c;
  const axx = ax === undefined ? c.width / 2 : ax, ayy = ay === undefined ? c.height : ay;
  const dx = Math.round(x - (flip ? c.width - axx : axx)), dy = Math.round(y - ayy);
  g.drawImage(im, dx, dy);
  if (flash) { const a = g.globalAlpha; g.globalAlpha = a * 0.65; g.drawImage(GT.white(im), dx, dy); g.globalAlpha = a; }
};
// dithered vertical gradient band
GT.grad = function (g, x, y, w, h, cols) {
  const n = cols.length; const bh = h / n;
  for (let i = 0; i < n; i++) {
    GT.R(g, x, y + Math.floor(i * bh), w, Math.ceil(bh) + 1, cols[i]);
    if (i < n - 1) { // dither seam
      g.fillStyle = cols[i + 1];
      const yy = y + Math.floor((i + 1) * bh) - 2;
      for (let xx = 0; xx < w; xx += 2) { g.fillRect(x + xx + ((yy) & 1), yy, 1, 1); }
      g.fillStyle = cols[i];
      for (let xx = 0; xx < w; xx += 2) { g.fillRect(x + xx + ((yy + 1) & 1), yy + 3, 1, 1); }
    }
  }
};

/* ---------------- FX ---------------- */
class FX {
  constructor() { this.p = []; }
  boom(x, y, size, opts) {
    size = size || 1;
    const n = Math.round(4 + size * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = rnd(5, 28) * size;
      this.p.push({ k: 'ball', x: x + rnd(-6, 6) * size, y: y + rnd(-6, 6) * size, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * size, r: rnd(4, 9) * size, t: 0, life: rnd(0.45, 0.8) + size * 0.12, d: rnd(0, 0.12 * size) });
    }
    for (let i = 0; i < n * 2; i++) {
      const a = Math.random() * 6.283, sp = rnd(40, 140) * Math.sqrt(size);
      this.p.push({ k: 'deb', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 220, t: 0, life: rnd(0.4, 0.9), c: ['#ffe070', '#ff9a30', '#fff', '#5a4a3a', '#333'][rndi(0, 4)] });
    }
    this.p.push({ k: 'ring', x, y, t: 0, life: 0.3, r: 10 * size });
    if (!opts || !opts.quiet) GT.sfx(size > 2.2 ? 'bigboom' : size > 0.9 ? 'boom' : 'small');
    GT.shake(Math.min(10, 2 + size * 2.5));
  }
  splash(x, y, n) {
    for (let i = 0; i < (n || 8); i++) this.p.push({ k: 'deb', x, y, vx: rnd(-50, 50), vy: rnd(-90, -30), g: 260, t: 0, life: rnd(0.3, 0.6), c: ['#e8f8ff', '#9fd8f0', '#fff'][rndi(0, 2)] });
  }
  spark(x, y, n, col) {
    for (let i = 0; i < (n || 5); i++) this.p.push({ k: 'deb', x, y, vx: rnd(-80, 80), vy: rnd(-80, 40), g: 120, t: 0, life: rnd(0.12, 0.3), c: col || ['#fff', '#ffe070'][rndi(0, 1)] });
  }
  hit(x, y) { this.p.push({ k: 'star', x, y, t: 0, life: 0.14 }); this.spark(x, y, 4); }
  smoke(x, y, r, vy) { this.p.push({ k: 'smoke', x, y, vx: rnd(-6, 6), vy: vy === undefined ? -18 : vy, r: r || 3, t: 0, life: rnd(0.5, 0.9) }); }
  wake(x, y, vy) { this.p.push({ k: 'wake', x: x + rnd(-1, 1), y, vx: rnd(-14, 14), vy: vy || 60, t: 0, life: rnd(0.35, 0.6), r: rnd(1, 2.6) }); }
  pop(x, y, txt, col) { this.p.push({ k: 'txt', x, y, vy: -30, t: 0, life: 0.8, s: txt, c: col || '#fff' }); }
  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      if (q.d > 0) { q.d -= dt; continue; }
      q.t += dt;
      if (q.t >= q.life) { p.splice(i, 1); continue; }
      if (q.vx) q.x += q.vx * dt; if (q.vy) q.y += q.vy * dt;
      if (q.g) q.vy += q.g * dt;
      if (q.k === 'ball') { q.vx *= 0.9; q.vy *= 0.9; q.vy -= 10 * dt; }
    }
    if (p.length > 700) p.splice(0, p.length - 700);
  }
  draw(g, cx, cy) {
    cx = cx || 0; cy = cy || 0;
    for (const q of this.p) {
      if (q.d > 0) continue;
      const x = Math.round(q.x - cx), y = Math.round(q.y - cy), f = q.t / q.life;
      switch (q.k) {
        case 'ball': {
          const col = f < 0.12 ? '#ffffff' : f < 0.3 ? '#ffe86a' : f < 0.5 ? '#ff9a2a' : f < 0.68 ? '#d8401c' : f < 0.85 ? '#5a4848' : '#3a3434';
          const r = q.r * (f < 0.3 ? 0.6 + f * 1.6 : 1.08 - f * 0.3);
          GT.circ(g, x, y, r, col);
          if (f < 0.5) GT.circ(g, x - r * 0.25, y - r * 0.25, r * 0.45, f < 0.25 ? '#fff' : '#ffe86a');
          break;
        }
        case 'deb': GT.R(g, x, y, 2, 2, q.c); break;
        case 'ring': { const r = q.r + f * q.r * 2.5; g.strokeStyle = f < 0.5 ? '#fff' : '#ffd060'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke(); break; }
        case 'star': GT.R(g, x - 5, y, 11, 1, '#fff'); GT.R(g, x, y - 5, 1, 11, '#fff'); GT.R(g, x - 2, y - 2, 5, 5, '#ffe070'); GT.R(g, x - 1, y - 1, 3, 3, '#fff'); break;
        case 'smoke': GT.circ(g, x, y, q.r * (1 + f), f < 0.4 ? '#9a9a9a' : '#6a6a70'); break;
        case 'wake': GT.circ(g, x, y, q.r * (1 - f * 0.5), f < 0.5 ? '#f0fbff' : '#a8dcf0'); break;
        case 'txt': GT.text(g, q.s, x, y, q.c, 1, 1, '#000'); break;
      }
    }
  }
}
GT.FX = FX;
let shakeA = 0;
GT.shake = a => { shakeA = Math.max(shakeA, a); };
GT.flashT = 0;
GT.flash = t => { GT.flashT = Math.max(GT.flashT, t || 0.08); };

/* ---------------- HUD ---------------- */
GT.hud = function (g, o) {
  // o: {hp, maxhp, lives, score, label, val, val2label, val2, boss, bossMax, bossName, meter}
  const y = 4;
  GT.R(g, 4, y, 84, 9, '#000');
  GT.R(g, 5, y + 1, 82, 7, '#3a0c0c');
  const f = clamp(o.hp / o.maxhp, 0, 1);
  GT.R(g, 5, y + 1, Math.round(82 * f), 7, f > 0.35 ? '#38d860' : '#f04030');
  GT.R(g, 5, y + 1, Math.round(82 * f), 2, f > 0.35 ? '#a8ffb8' : '#ffa090');
  GT.text(g, 'STORM', 6, y + 11, '#ffd848', 1, 0, '#000');
  GT.text(g, 'x' + Math.max(0, o.lives), 40, y + 11, '#fff', 1, 0, '#000');
  GT.text(g, String(o.score).padStart(7, '0'), 266, y + 1, '#fff', 1, 2, '#000');
  if (o.label) GT.text(g, o.label + ' ' + o.val, 266, y + 11, '#8fe0ff', 1, 2, '#000');
  if (o.meter !== undefined) {
    GT.R(g, 4, y + 21, 52, 5, '#000'); GT.R(g, 5, y + 22, Math.round(50 * clamp(o.meter, 0, 1)), 3, o.meterCol || '#5ac8ff');
    if (o.meterLabel) GT.text(g, o.meterLabel, 59, y + 20, '#5ac8ff', 1, 0, '#000');
  }
  if (o.boss) {
    const by = 42;
    GT.R(g, 34, by, 202, 9, '#000'); GT.R(g, 35, by + 1, 200, 7, '#2a0a0a');
    GT.R(g, 35, by + 1, Math.round(200 * clamp(o.boss / o.bossMax, 0, 1)), 7, '#ff3c3c');
    GT.R(g, 35, by + 1, Math.round(200 * clamp(o.boss / o.bossMax, 0, 1)), 2, '#ffa0a0');
    GT.text(g, o.bossName || 'BOSS', 135, by - 9, '#ff7070', 1, 1, '#000');
  }
};
GT.banner = function (g, s, y, col, t) {
  const w = GT.textW(s, 2) + 16;
  GT.R(g, 135 - w / 2, y - 5, w, 24, 'rgba(0,0,0,0.6)');
  GT.textO(g, s, 135, y, col || '#ffd848', 2, 1);
};

/* ---------------- game state & loop ---------------- */
GT.state = { lives: 3, score: 0, stage: 0, continues: 0, hp: 100 };
GT.newGame = function () { GT.state = { lives: 3, score: 0, stage: 0, continues: 0, hp: 100 }; };
GT.addScore = n => { GT.state.score += n; };
GT.scene = null;
GT.sceneName = '';
GT.go = function (s, name) { GT.scene = s; GT.sceneName = name || s.name || '?'; GT.sceneT = 0; GT.botActive = false; if (s.enter) s.enter(); glog('scene:' + GT.sceneName); };
GT.err = [];
window.addEventListener('error', e => GT.err.push(String(e.message)));
let lastT = 0, acc = 0;
const DT = 1 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  if (GT.capture) return;
  const el = lastT ? Math.min(0.1, (ts - lastT) / 1000) : DT;
  lastT = ts;
  acc += el * GT.speed;
  let n = 0;
  while (acc >= DT && n < GT.speed * 5) {
    acc -= DT; n++;
    step();
  }
  if (n >= GT.speed * 5) acc = 0;
  render();
}
function step() {
  GT.t += DT; GT.sceneT += DT;
  if (GT.bot && GT.scene && GT.scene.bot) { GT.botActive = true; GT.scene.bot(GT.botInp, DT); }
  sampleInput();
  if (GT.scene) GT.scene.update(DT);
  if (GT.__tq.length) { const due = GT.__tq.filter(q => q.at <= GT.t + 1e-9); GT.__tq = GT.__tq.filter(q => q.at > GT.t + 1e-9); due.forEach(q => q.fn()); }
  shakeA = Math.max(0, shakeA - DT * 30);
  GT.flashT = Math.max(0, GT.flashT - DT);
  window.__gt = { scene: GT.sceneName, stage: GT.state.stage, score: GT.state.score, lives: GT.state.lives, t: GT.t, prog: GT.scene && GT.scene.prog ? GT.scene.prog() : 0, errors: GT.err.length };
}
function render() {
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, GT.LW, GT.LH);
  const sx = shakeA > 0.5 ? Math.round(rnd(-shakeA, shakeA) * 0.5) : 0, sy = shakeA > 0.5 ? Math.round(rnd(-shakeA, shakeA) * 0.5) : 0;
  g.setTransform(1, 0, 0, 1, GT.OX + sx, GT.OY + sy);
  if (GT.scene) GT.scene.draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (GT.flashT > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, GT.flashT * 8) + ')'; g.fillRect(0, 0, GT.LW, GT.LH); }
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(scr, 0, 0, GT.LW * K, GT.LH * K);
}
// deterministic frame-step capture hook (trailer only)
window.__cap = {
  step(n) { for (let i = 0; i < n; i++) { step(); window.__steps++; } },
  shots(count, every) { const out = []; for (let i = 0; i < count; i++) { for (let k = 0; k < every; k++) { step(); window.__steps++; } const _rs = GT.__rsGet(); render(); GT.__rsSet(_rs); out.push(scr.toDataURL('image/png')); } return out; },
  sfx() { const l = window.__sfxlog; window.__sfxlog = []; return l; },
  info() { return window.__gt; }
};
window.__steps = 0; window.__sfxlog = [];
(function () { const o = GT.sfx; GT.sfx = function (n) { window.__sfxlog.push([window.__steps, n]); return o(n); }; })();
// extents of visible area in play-coordinates
GT.view = () => ({ x0: -GT.OX, y0: -GT.OY, x1: GT.LW - GT.OX, y1: GT.LH - GT.OY });

GT.boot = function () {
  resize();
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  GT.initArt();
  if (Q.get('scene') === 'ending') GT.go(GT.Ending(), 'ending');
  else if (GT.startStage) { GT.newGame(); GT.state.stage = GT.startStage - 1; GT.startStageScene(GT.startStage - 1); }
  else GT.go(GT.Title(), 'title');
  requestAnimationFrame(frame);
};

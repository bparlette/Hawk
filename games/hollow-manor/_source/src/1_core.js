'use strict';
// Lights Out at Hollow Manor — original 8-bit horror game. Plain canvas + WebAudio, no deps.
const VW = 256, VH = 224, HUD = 16, TS = 16, COLS = 16, ROWS = 14;
const QS = new URLSearchParams(location.search);
const BOT = QS.has('bot');
const TSCALE = Math.max(1, Math.min(10, +(QS.get('speed') || 1)));
let SEED = (+QS.get('seed')) || ((Math.random() * 1e9) | 0);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = mulberry(SEED);
const R = (a, b) => a + (b - a) * rnd();
const RI = (a, b) => Math.floor(a + (b - a + 1) * rnd());
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- NES-like palette ----------
const C = {
  K: '#000000', g1: '#1c1c1c', g2: '#383838', g3: '#7c7c7c', g4: '#bcbcbc', g5: '#f8f8f8',
  nd: '#301800', n0: '#503000', n1: '#881400', n2: '#ac7c00', n3: '#e45c10', n4: '#fca044', n5: '#f0d0b0', n6: '#fce0a8',
  rd: '#500018', r0: '#a80020', r1: '#e40058', r2: '#f83800',
  vd: '#002800', v0: '#005800', v1: '#007800', v2: '#00a800', v3: '#58d854',
  bd: '#000040', b0: '#0000bc', b1: '#0058f8', b2: '#3cbcfc', b3: '#a4e4fc', b4: '#4428bc', b5: '#6888fc',
  pd: '#400038', p0: '#940084', p1: '#f878f8', p2: '#f8b8f8',
  y0: '#f8b800', y1: '#f8d878', t0: '#004058', t1: '#008888',
};
const PALRGB = Object.values(C).map((h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; });
function nearest(r, g, b) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < PALRGB.length; i++) { const p = PALRGB[i]; const d = (p[0] - r) ** 2 * 0.8 + (p[1] - g) ** 2 * 1.0 + (p[2] - b) ** 2 * 0.7; if (d < bd) { bd = d; best = i; } }
  return PALRGB[best];
}
const DK1 = new Map(), DK2 = new Map();
function darkPair(u) {
  const r = u & 255, g = (u >>> 8) & 255, b = (u >>> 16) & 255;
  const a = nearest(r * 0.48, g * 0.48, b * 0.56);
  const c = nearest(a[0] * 0.42, a[1] * 0.42, a[2] * 0.5);
  const pk = (p) => (0xff000000 | (p[2] << 16) | (p[1] << 8) | p[0]) >>> 0;
  DK1.set(u, pk(a)); DK2.set(u, pk(c));
}
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---------- canvas helpers ----------
function mk(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, ww | 0, hh | 0); };
  if (fn) fn(r, g, w, h);
  return c;
}
function outline(c, col) {
  const g = c.getContext('2d'), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), a = d.data;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[(y * w + x) * 4 + 3]) continue;
    const o = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && a[(yy * w + xx) * 4 + 3] > 0;
    if (o(x - 1, y) || o(x + 1, y) || o(x, y - 1) || o(x, y + 1)) m[y * w + x] = 1;
  }
  g.fillStyle = col;
  for (let i = 0; i < w * h; i++) if (m[i]) g.fillRect(i % w, (i / w) | 0, 1, 1);
  return c;
}
function pm(rows, map, w) {
  w = w || Math.max(...rows.map((r) => r.length));
  return mk(w, rows.length, (r) => {
    rows.forEach((row, y) => { for (let x = 0; x < w; x++) { const ch = row[x]; if (ch && ch !== '.' && map[ch]) r(x, y, 1, 1, map[ch]); } });
  });
}
function mirror(c) { return mk(c.width, c.height, (r, g) => { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); }); }

// ---------- 5x7 bitmap font ----------
const FONT = {};
(() => {
  const F = {
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
    D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
    J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
    P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
    V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
    3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
    9: '01110 10001 10001 01111 00001 00010 01100',
    '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000', '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100', "'": '00100 00100 01000 00000 00000 00000 00000', '-': '00000 00000 00000 01110 00000 00000 00000',
    ':': '00000 01100 01100 00000 01100 01100 00000', '/': '00001 00010 00010 00100 01000 01000 10000', '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000', '"': '01010 01010 00000 00000 00000 00000 00000', '>': '01000 00100 00010 00001 00010 00100 01000',
    '<': '00010 00100 01000 10000 01000 00100 00010', '+': '00000 00100 00100 11111 00100 00100 00000', '%': '11001 11010 00010 00100 01000 01011 10011',
    '^': '00100 01110 10101 00100 00100 00100 00100', '_': '00100 00100 00100 00100 10101 01110 00100', '=': '00000 11111 00000 00000 11111 00000 00000',
    '*': '00000 10101 01110 11111 01110 10101 00000', '#': '01010 11111 01010 01010 11111 01010 00000',
  };
  for (const k in F) FONT[k] = F[k].split(' ').map((s) => parseInt(s, 2));
})();
function txt(g, s, x, y, col, sc = 1) {
  s = String(s).toUpperCase(); g.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const gl = FONT[s[i]]; if (!gl) continue;
    for (let ry = 0; ry < 7; ry++) { const row = gl[ry]; if (!row) continue; for (let rx = 0; rx < 5; rx++) if (row & (16 >> rx)) g.fillRect(x + (i * 6 + rx) * sc, y + ry * sc, sc, sc); }
  }
}
function txtS(g, s, x, y, col, sh, sc = 1) { txt(g, s, x + sc, y + sc, sh, sc); txt(g, s, x, y, col, sc); }
function txtC(g, s, cx, y, col, sc = 1, sh) { const w = String(s).length * 6 * sc - sc; const x = Math.round(cx - w / 2); if (sh) txt(g, s, x + sc, y + sc, sh, sc); txt(g, s, x, y, col, sc); }
function wrap(s, n) { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; }

// ---------- audio (WebAudio chiptune) ----------
const AU = {
  ctx: null, m: null, fx: null, muted: QS.has('mute'), nb: null, drone: null, hum: null, mbox: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const x = this.ctx;
    this.m = x.createGain(); this.m.gain.value = this.muted ? 0 : 0.7; this.m.connect(x.destination);
    // echo bus
    this.fx = x.createGain(); this.fx.gain.value = 1; this.fx.connect(this.m);
    const dl = x.createDelay(1); dl.delayTime.value = 0.31; const fb = x.createGain(); fb.gain.value = 0.38; const lp = x.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    this.fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.m);
    const n = x.createBuffer(1, x.sampleRate * 2, x.sampleRate); const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = n;
    this.startDrone();
  },
  toggle() { this.muted = !this.muted; if (this.m) this.m.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05); },
  out(pan, echo) {
    let node = echo ? this.fx : this.m;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(node); node = p; }
    return node;
  },
  tone(f, dur, type = 'square', vol = 0.08, delay = 0, f2 = 0, pan = 0, echo = false, att = 0.005) {
    if (!this.ctx) return; const x = this.ctx, t = x.currentTime + delay;
    const o = x.createOscillator(), g = x.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    o.connect(g); g.connect(this.out(pan, echo)); o.start(t); o.stop(t + att + dur + 0.05);
  },
  noise(dur, vol = 0.1, freq = 1000, ft = 'lowpass', delay = 0, q = 1, pan = 0, f2 = 0, echo = false, att = 0.003) {
    if (!this.ctx) return; const x = this.ctx, t = x.currentTime + delay;
    const s = x.createBufferSource(); s.buffer = this.nb; s.loop = true;
    const fl = x.createBiquadFilter(); fl.type = ft; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = x.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out(pan, echo)); s.start(t, Math.random()); s.stop(t + att + dur + 0.05);
  },
  startDrone() {
    const x = this.ctx; const g = x.createGain(); g.gain.value = 0.0; g.connect(this.m);
    const lp = x.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3; lp.connect(g);
    const o1 = x.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 55;
    const o2 = x.createOscillator(); o2.type = 'square'; o2.frequency.value = 55 * 1.06;
    const o3 = x.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = 27.5;
    const g2 = x.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); o1.connect(lp);
    const g3 = x.createGain(); g3.gain.value = 0.35; o3.connect(g3); g3.connect(lp);
    const lfo = x.createOscillator(); lfo.frequency.value = 0.07; const lg = x.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency);
    [o1, o2, o3, lfo].forEach((o) => o.start());
    g.gain.setTargetAtTime(0.09, x.currentTime, 2);
    this.drone = { g, o1, o2, o3, lp };
  },
  droneFloor(f) {
    if (!this.drone) return; const base = [41.2, 55, 65.4][f] || 55; const t = this.ctx.currentTime;
    this.drone.o1.frequency.setTargetAtTime(base, t, 1); this.drone.o2.frequency.setTargetAtTime(base * 1.06, t, 1); this.drone.o3.frequency.setTargetAtTime(base / 2, t, 1);
  },
  droneVol(v) { if (this.drone) this.drone.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); },
  step(surf, alt) { const f = { stone: 900, dirt: 380, carpet: 260, tile: 1500, marble: 1300 }[surf] || 520; this.noise(0.045, surf === 'carpet' ? 0.05 : 0.08, f * (alt ? 0.85 : 1), 'lowpass', 0, 2); this.tone(alt ? 70 : 80, 0.04, 'triangle', 0.05); },
  creak(pan = 0) { let f = R(150, 260); for (let i = 0; i < 6; i++) { this.tone(f, 0.07, 'sawtooth', 0.025, i * 0.07, f * 0.94, pan, true); f *= R(0.9, 1.08); } },
  sting(big) {
    const v = big ? 0.1 : 0.06; [466, 494, 698, 740].forEach((f, i) => this.tone(f, big ? 1.6 : 1.0, 'square', v * (i < 2 ? 1 : 0.6), 0, f * 0.97, 0, true));
    this.noise(big ? 0.5 : 0.25, big ? 0.22 : 0.1, 3000, 'highpass'); this.tone(55, 1.4, 'sawtooth', 0.12, 0, 41);
  },
  thump(v = 0.5) { this.tone(62, 0.13, 'sine', v, 0, 38); this.tone(58, 0.12, 'sine', v * 0.65, 0.17, 36); },
  slam(pan = 0) { this.noise(0.55, 0.45, 380, 'lowpass', 0, 1, pan, 0, true); this.tone(75, 0.35, 'sine', 0.55, 0, 38, pan); this.noise(0.08, 0.2, 2200, 'bandpass', 0, 2, pan); },
  screech() { this.tone(1900, 0.32, 'square', 0.08, 0, 820); this.tone(2400, 0.25, 'square', 0.05, 0.12, 1300); this.noise(0.3, 0.06, 4000, 'highpass'); },
  bark(pan = 0, far = false) { const v = far ? 0.06 : 0.16; for (let i = 0; i < 2; i++) { this.noise(0.1, v, far ? 400 : 650, 'bandpass', i * 0.28, 3, pan, 0, true); this.tone(far ? 240 : 320, 0.09, 'square', v * 0.4, i * 0.28, 170, pan, true); } },
  growl(pan = 0) { for (let i = 0; i < 8; i++) this.tone(R(68, 82), 0.14, 'sawtooth', 0.045, i * 0.13, 60, pan); this.noise(1.1, 0.05, 260, 'lowpass', 0, 4, pan); },
  whisper(pan = 0) { for (let i = 0; i < 9; i++) this.noise(R(0.08, 0.2), 0.045, R(2200, 4200), 'bandpass', i * R(0.13, 0.2), 9, pan + R(-0.3, 0.3), 0, true, 0.04); },
  footsAbove() { const p0 = R(-1, 1), p1 = -p0; for (let i = 0; i < 7; i++) { const pan = p0 + (p1 - p0) * i / 6; this.tone(90, 0.12, 'sine', 0.22, i * 0.62, 45, pan); this.noise(0.06, 0.05, 220, 'lowpass', i * 0.62, 1, pan); } setTimeout(() => this.creak(p1), 4300); },
  thunder(d = 0.5) { this.noise(0.08, 0.15, 3000, 'highpass', 0); this.noise(2.6, 0.32, 220, 'lowpass', d, 1, R(-0.4, 0.4), 90, false, 0.2); this.noise(1.2, 0.2, 120, 'lowpass', d + 0.5, 1); },
  click() { this.tone(1500, 0.015, 'square', 0.05); this.tone(700, 0.02, 'square', 0.04, 0.03); },
  pickup() { [660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.08, 'square', 0.06, i * 0.07, 0, 0, true)); },
  battery() { [520, 780, 1040].forEach((f, i) => this.tone(f, 0.06, 'triangle', 0.08, i * 0.05)); },
  clunk() { this.noise(0.35, 0.5, 240, 'lowpass', 0, 2, 0, 0, true); this.tone(95, 0.3, 'sine', 0.6, 0, 45); this.tone(1200, 0.03, 'square', 0.08); },
  scrape(pan = 0) { this.noise(0.5, 0.07, 320, 'bandpass', 0, 3, pan, 210, true, 0.08); },
  whoosh(pan = 0) { this.noise(0.32, 0.1, 400, 'bandpass', 0, 2, pan, 1800, false, 0.06); },
  hiss() { this.noise(0.7, 0.12, 3200, 'highpass', 0, 1, 0, 0, true, 0.02); this.tone(150, 0.6, 'square', 0.05, 0, 60, 0, true); },
  appear() { this.tone(41, 1.8, 'sawtooth', 0.14, 0, 37, 0, false, 0.4); this.noise(1.5, 0.08, 90, 'lowpass', 0, 3, 0, 0, false, 0.5); },
  locked() { this.tone(180, 0.06, 'square', 0.07); this.tone(150, 0.08, 'square', 0.07, 0.08); this.noise(0.06, 0.08, 1200, 'bandpass', 0, 4); },
  doorOpen() { this.creak(0); },
  stairs() { for (let i = 0; i < 5; i++) { this.noise(0.05, 0.07, 500, 'lowpass', i * 0.13, 2); this.tone(70 + i * 4, 0.05, 'triangle', 0.05, i * 0.13); } },
  pop() { this.noise(0.05, 0.3, 4000, 'highpass'); for (let i = 0; i < 5; i++) this.tone(R(3000, 5000), 0.04, 'square', 0.03, 0.05 + i * 0.05); },
  chime() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.08, i * 0.16, 0, 0, true)); },
  humOn() { if (!this.ctx || this.hum) return; const x = this.ctx; const g = x.createGain(); g.gain.value = 0; g.connect(this.m); const o = x.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60; const f = x.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; o.connect(f); f.connect(g); o.start(); g.gain.setTargetAtTime(0.03, x.currentTime, 0.3); this.hum = { g, o }; },
  humOff() { if (this.hum) { this.hum.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); const h = this.hum; setTimeout(() => { try { h.o.stop(); } catch (e) {} }, 1200); this.hum = null; } },
  boxNote(i) { const seq = [1319, 1047, 880, 988, 784, 880, 659, 698, 659, 0, 0, 0]; const f = seq[i % seq.length]; if (f) { this.tone(f * R(0.985, 1.0), 0.5, 'triangle', 0.05, 0, 0, -0.4, true); this.tone(f * 2, 0.08, 'square', 0.01, 0, 0, -0.4); } },
  motif(i) { const seq = [220, 0, 207.6, 0, 174.6, 164.8, 0, 0, 155.6, 0, 146.8, 0, 0, 0]; const f = seq[i % seq.length]; if (f) this.tone(f, 1.2, 'triangle', 0.035, 0, f * 0.995, R(-0.3, 0.3), true, 0.08); },
  tick(alt) { this.tone(alt ? 2100 : 1800, 0.012, 'square', 0.025, 0, 0, 0.5); },
  drip(pan = 0) { this.tone(R(900, 1400), 0.06, 'sine', 0.05, 0, 400, pan, true); },
};

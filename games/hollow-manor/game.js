(() => {
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

// ---------- world data ----------
// Interior tiles x 1..14, y 2..12. Door gaps: N cols 7-8 rows 0-1, S cols 7-8 row 13, W col 0 rows 6-7, E col 15 rows 6-7.
const FLOORNAME = ['B1', '1F', '2F'];
const NOTE_FOYER = 'A NOTE: "IF THE POWER FAILS, THE BREAKER IS IN THE BASEMENT. THE CELLAR KEY IS IN MY STUDY - UPSTAIRS, WEST WING. -H."';
const NOTE_KITCHEN = 'COOK\'S NOTE: "THE GARDENER BORROWED THE BREAKER HANDLE FOR THE CONSERVATORY VALVE. AGAIN."';
const NOTE_WORK = 'GROUNDSKEEPER: "SPARE FUSES ARE IN THE CRAWLSPACE, PAST THE WINE. DON\'T FEED THE DOG."';
const RD = {
  // ===== ground floor =====
  foyer: { f: 1, gx: 2, gy: 1, n: 'FOYER', sn: 'FOYER', fl: 'marble', wl: 'paper', o: [
    ['window', 2], ['portrait', 5], ['portrait', 10], ['window', 12], ['rug', 5, 5, { w: 6, h: 4, c: 'red' }], ['statue', 3, 5],
    ['clock', 13, 3], ['plant', 2, 10], ['plant', 13, 10], ['frontdoor', 7], ['note', 9, 10, { text: NOTE_FOYER }], ['candle', 4, 2], ['candle', 11, 2]] },
  grand: { f: 1, gx: 2, gy: 0, n: 'GRAND STAIRCASE', sn: 'STAIRS', fl: 'carpet', wl: 'panel', o: [
    ['stairs', 6, 2, { w: 4, h: 3, to: 'landing', dir: 'up' }], ['pillar', 4, 3], ['pillar', 11, 3], ['portrait', 2], ['portrait', 13],
    ['statue', 3, 9], ['statue', 12, 9], ['candle', 2, 11], ['candle', 13, 11]] },
  library: { f: 1, gx: 1, gy: 0, n: 'LIBRARY', sn: 'LIBRRY', fl: 'wood', wl: 'panel', o: [
    ['shelf', 1, 2], ['shelf', 3, 2], ['shelf', 5, 2], ['fireplace', 7], ['shelf', 10, 2], ['shelf', 12, 2], ['rug', 5, 5, { w: 4, h: 4, c: 'green' }],
    ['shelf', 3, 9], ['shelf', 10, 9], ['table', 6, 6], ['chair', 5, 6, { arm: 1 }], ['chair', 8, 7, { arm: 1 }], ['statue', 4, 5], ['statue', 11, 5],
    ['item', 13, 11, { it: 'battery' }], ['candle', 14, 3]] },
  conserv: { f: 1, gx: 0, gy: 0, n: 'CONSERVATORY', sn: 'CONSRV', fl: 'terra', wl: 'green', o: [
    ['window', 2], ['window', 5], ['window', 10], ['window', 12], ['plant', 2, 4, { big: 1 }], ['plant', 5, 4, { big: 1 }], ['plant', 10, 4, { big: 1 }], ['plant', 13, 4, { big: 1 }],
    ['fountain', 7, 6], ['statue', 4, 9], ['sofa', 10, 10, { bench: 1 }], ['table', 2, 8, { pot: 1 }], ['plant', 2, 11, { big: 1 }], ['plant', 13, 11, { big: 1 }],
    ['item', 12, 8, { it: 'handle' }]] },
  music: { f: 1, gx: 0, gy: 1, n: 'MUSIC ROOM', sn: 'MUSIC', fl: 'wood', wl: 'paper2', o: [
    ['rug', 6, 6, { w: 4, h: 3, c: 'red' }], ['piano', 3, 3], ['chair', 4, 5, { bench: 1 }], ['gramo', 11, 3], ['plant', 13, 3], ['sofa', 9, 10], ['chair', 3, 10, { arm: 1 }],
    ['chair', 12, 8, { arm: 1 }], ['item', 2, 7, { it: 'battery' }], ['portrait', 10]] },
  dining: { f: 1, gx: 1, gy: 1, n: 'DINING ROOM', sn: 'DINING', fl: 'carpet', wl: 'paper', o: [
    ['window', 3], ['portrait', 7], ['window', 10], ['longtable', 5, 6], ['chair', 5, 5], ['chair', 7, 5], ['chair', 6, 8, { up: 1 }], ['chair', 8, 8, { up: 1 }],
    ['chair', 4, 6], ['chair', 9, 7], ['dresser', 13, 2], ['candle', 2, 2], ['clock', 13, 11]] },
  kitchen: { f: 1, gx: 1, gy: 2, n: 'KITCHEN', sn: 'KITCHN', fl: 'tile', wl: 'tile', o: [
    ['stove', 2, 2], ['counter', 4, 2], ['counter', 10, 2], ['sink', 12, 2], ['counter', 13, 2, { w1: 1 }], ['table', 5, 8], ['chair', 4, 8], ['chair', 7, 9],
    ['stairs', 11, 9, { w: 2, h: 2, to: 'cstairs', dir: 'down', locked: 'key' }], ['note', 9, 11, { text: NOTE_KITCHEN }], ['barrel', 13, 11], ['crate', 2, 11]] },
  pantry: { f: 1, gx: 0, gy: 2, n: 'PANTRY', sn: 'PANTRY', fl: 'wood', wl: 'plain', o: [
    ['pshelf', 1, 2], ['pshelf', 3, 2], ['pshelf', 5, 2], ['pshelf', 9, 2], ['pshelf', 11, 2], ['pshelf', 13, 2], ['crate', 2, 10], ['crate', 3, 10], ['crate', 2, 11],
    ['barrel', 12, 10], ['barrel', 13, 10], ['sack', 6, 11], ['sack', 5, 11], ['item', 10, 8, { it: 'battery' }]] },
  shall: { f: 1, gx: 2, gy: 2, n: "SERVANTS' HALL", sn: 'SERVNT', fl: 'wood', wl: 'plain', o: [
    ['stairs', 2, 2, { w: 2, h: 2, to: 'squart', dir: 'up' }], ['longtable', 6, 5, { plain: 1 }], ['chair', 6, 4], ['chair', 8, 4], ['chair', 7, 7, { up: 1 }], ['chair', 9, 7, { up: 1 }],
    ['wardrobe', 12, 2], ['item', 11, 11, { it: 'battery' }], ['candle', 13, 11]] },
  mud: { f: 1, gx: 3, gy: 2, n: 'MUDROOM', sn: 'MUDRM', fl: 'stone', wl: 'plank', o: [
    ['window', 3], ['sofa', 2, 3, { bench: 1 }], ['wardrobe', 11, 2], ['crate', 12, 10], ['crate', 13, 10], ['crate', 13, 11], ['barrel', 2, 11]] },
  smoke: { f: 1, gx: 3, gy: 1, n: 'SMOKING ROOM', sn: 'SMOKE', fl: 'carpetG', wl: 'panel', o: [
    ['billiard', 6, 6], ['chair', 3, 10, { arm: 1 }], ['chair', 12, 4, { arm: 1 }], ['sofa', 10, 10], ['shelf', 11, 2], ['plant', 2, 2], ['portrait', 4], ['candle', 14, 11]] },
  parlor: { f: 1, gx: 3, gy: 0, n: 'PARLOR', sn: 'PARLOR', fl: 'wood', wl: 'paper2', o: [
    ['rug', 4, 4, { w: 7, h: 6, c: 'purple' }], ['fireplace', 6], ['portrait', 3], ['portrait', 11], ['sofa', 5, 8], ['chair', 3, 5, { arm: 1 }], ['chair', 10, 5, { arm: 1 }],
    ['table', 8, 5, { small: 1 }], ['clock', 13, 3], ['wardrobe', 12, 10]] },
  // ===== second floor =====
  landing: { f: 2, gx: 2, gy: 1, n: 'UPPER LANDING', sn: 'LANDNG', fl: 'carpet', wl: 'paper', o: [
    ['stairs', 6, 2, { w: 4, h: 2, to: 'grand', dir: 'down' }], ['plant', 2, 3], ['plant', 13, 3], ['statue', 3, 10], ['candle', 12, 11], ['portrait', 3], ['portrait', 12]] },
  gallery: { f: 2, gx: 1, gy: 1, n: 'PORTRAIT GALLERY', sn: 'GALLRY', fl: 'wood', wl: 'green', o: [
    ['portrait', 2], ['portrait', 4], ['portrait', 11], ['portrait', 13], ['rug', 4, 5, { w: 8, h: 2, c: 'red' }], ['statue', 2, 6], ['statue', 12, 9], ['sofa', 6, 9, { bench: 1 }]] },
  master: { f: 2, gx: 1, gy: 0, n: 'MASTER BEDROOM', sn: 'MASTER', fl: 'carpet', wl: 'paper', o: [
    ['window', 4], ['window', 10], ['rug', 6, 5, { w: 4, h: 2, c: 'purple' }], ['bed', 7, 2, { c: 'red' }], ['nightstand', 6, 2], ['nightstand', 9, 2], ['wardrobe', 2, 2],
    ['dresser', 12, 2], ['chair', 11, 9, { arm: 1 }], ['item', 3, 11, { it: 'battery' }]] },
  mbath: { f: 2, gx: 2, gy: 0, n: 'MASTER BATH', sn: 'BATH', fl: 'bath', wl: 'bathtile', o: [
    ['window', 7], ['tub', 10, 2], ['toilet', 3, 2], ['sink', 5, 2], ['dresser', 13, 9, { w1: 1 }], ['rug', 6, 6, { w: 3, h: 2, c: 'blue' }], ['item', 12, 11, { it: 'battery' }]] },
  attic: { f: 2, gx: 3, gy: 0, n: 'ATTIC STAIRS', sn: 'ATTIC', fl: 'wood', wl: 'plank', o: [
    ['atticdoor', 7], ['astairs', 7, 2], ['crate', 2, 3], ['crate', 3, 3], ['crate', 2, 4], ['crate', 12, 3], ['crate', 13, 4], ['chair', 11, 9], ['sheet', 4, 9]] },
  guest: { f: 2, gx: 3, gy: 1, n: 'GUEST BEDROOM', sn: 'GUEST', fl: 'carpet', wl: 'paper2', o: [
    ['window', 4], ['bed', 11, 8, { c: 'blue' }], ['nightstand', 13, 8], ['wardrobe', 2, 2], ['dresser', 11, 2], ['chair', 4, 10, { arm: 1 }]] },
  linen: { f: 2, gx: 2, gy: 2, n: 'LINEN HALL', sn: 'LINEN', fl: 'wood', wl: 'plain', o: [
    ['lshelf', 2, 2], ['lshelf', 4, 2], ['lshelf', 10, 2], ['lshelf', 12, 2], ['wardrobe', 2, 10], ['basket', 10, 10], ['item', 12, 11, { it: 'battery' }]] },
  squart: { f: 2, gx: 3, gy: 2, n: "SERVANTS' QUARTERS", sn: 'QUARTR', fl: 'wood', wl: 'plank', o: [
    ['stairs', 12, 2, { w: 2, h: 2, to: 'shall', dir: 'down' }], ['window', 4], ['bed', 2, 9, { c: 'grey' }], ['bed', 5, 9, { c: 'grey' }], ['crate', 9, 11], ['chair', 9, 4], ['dresser', 2, 2]] },
  nursery: { f: 2, gx: 0, gy: 0, n: 'NURSERY', sn: 'NURSRY', fl: 'wood', wl: 'nursery', o: [
    ['window', 10], ['rug', 4, 6, { w: 5, h: 4, c: 'pink' }], ['crib', 2, 2], ['rocker', 10, 5], ['musicbox', 5, 4], ['toybox', 12, 10], ['horse', 3, 10]] },
  play: { f: 2, gx: 0, gy: 1, n: 'PLAYROOM', sn: 'PLAY', fl: 'carpetB', wl: 'nursery', o: [
    ['toybox', 2, 3], ['horse', 12, 4], ['table', 5, 6, { small: 1 }], ['chair', 4, 6], ['chair', 7, 7], ['dollhouse', 11, 9], ['item', 3, 11, { it: 'battery' }]] },
  sewing: { f: 2, gx: 0, gy: 2, n: 'SEWING ROOM', sn: 'SEWING', fl: 'wood', wl: 'paper', o: [
    ['dummy', 3, 5], ['dummy', 10, 4], ['dummy', 5, 10], ['desk', 11, 9, { sew: 1 }], ['chair', 12, 10], ['dresser', 2, 2], ['wardrobe', 12, 2]] },
  study: { f: 2, gx: 1, gy: 2, n: 'STUDY', sn: 'STUDY', fl: 'wood', wl: 'panel', o: [
    ['rug', 5, 5, { w: 6, h: 4, c: 'red' }], ['shelf', 2, 2], ['shelf', 4, 2], ['shelf', 10, 2], ['shelf', 12, 2], ['portrait', 7, { master: 1 }], ['desk', 7, 6, { item: 'key' }],
    ['chair', 8, 5, { arm: 1 }], ['globe', 12, 9], ['chair', 3, 10, { arm: 1 }], ['candle', 13, 11]] },
  // ===== basement =====
  cstairs: { f: 0, gx: 2, gy: 0, n: 'CELLAR STAIRS', sn: 'CELLAR', fl: 'stone', wl: 'stone', o: [
    ['stairs', 7, 2, { w: 2, h: 2, to: 'kitchen', dir: 'up' }], ['barrel', 2, 3], ['barrel', 13, 3], ['crate', 3, 10], ['crate', 12, 11]] },
  wine: { f: 0, gx: 1, gy: 0, n: 'WINE CELLAR', sn: 'WINE', fl: 'stone', wl: 'brick', o: [
    ['rack', 2, 2], ['rack', 4, 2], ['rack', 10, 2], ['rack', 12, 2], ['rack', 4, 9], ['rack', 10, 9], ['barrel', 6, 11], ['barrel', 9, 11], ['statue', 8, 4]] },
  crawl: { f: 0, gx: 0, gy: 0, n: 'CRAWLSPACE', sn: 'CRAWL', fl: 'dirt', wl: 'dirtwall', o: [
    ['post', 4, 4], ['post', 4, 9], ['post', 10, 4], ['post', 10, 9], ['crate', 12, 3], ['crate', 13, 3], ['crate', 2, 3], ['item', 2, 11, { it: 'fuse' }]] },
  storage: { f: 0, gx: 0, gy: 1, n: 'STORAGE', sn: 'STORE', fl: 'stone', wl: 'stone', o: [
    ['crate', 2, 2], ['crate', 3, 2], ['crate', 2, 3], ['crate', 11, 2], ['crate', 12, 2], ['crate', 13, 3], ['sheet', 5, 8], ['sheet', 10, 9], ['wardrobe', 12, 10], ['item', 3, 11, { it: 'battery' }]] },
  boiler: { f: 0, gx: 1, gy: 1, n: 'BOILER ROOM', sn: 'BOILER', fl: 'stone', wl: 'brick', o: [
    ['boiler', 6, 2], ['barrel', 2, 10], ['barrel', 13, 10], ['crate', 3, 10], ['item', 12, 4, { it: 'battery' }]] },
  laundry: { f: 0, gx: 2, gy: 1, n: 'LAUNDRY', sn: 'LAUNDR', fl: 'tile', wl: 'stone', o: [
    ['washtub', 2, 2], ['washer', 4, 2], ['desk', 11, 2, { iron: 1 }], ['hang', 4, 5], ['hang', 10, 5], ['basket', 12, 10]] },
  workshop: { f: 0, gx: 3, gy: 1, n: 'WORKSHOP', sn: 'WORKSH', fl: 'plank', wl: 'plank', o: [
    ['tools', 4], ['bench', 2, 2], ['bench', 10, 2], ['crate', 2, 10], ['crate', 13, 10], ['note', 11, 3, { text: NOTE_WORK }]] },
  coal: { f: 0, gx: 3, gy: 0, n: 'COAL ROOM', sn: 'COAL', fl: 'dirt', wl: 'brick', o: [
    ['coal', 10, 3], ['crate', 3, 3], ['barrel', 2, 10], ['item', 12, 10, { it: 'battery' }]] },
  cistern: { f: 0, gx: 0, gy: 2, n: 'CISTERN', sn: 'CISTRN', fl: 'stone', wl: 'stone', o: [
    ['pool', 4, 5], ['post', 3, 3], ['post', 10, 3], ['post', 3, 10], ['post', 10, 10]] },
  rootc: { f: 0, gx: 1, gy: 2, n: 'ROOT CELLAR', sn: 'ROOTS', fl: 'dirt', wl: 'dirtwall', o: [
    ['pshelf', 2, 2], ['pshelf', 4, 2], ['pshelf', 10, 2], ['sack', 3, 10], ['sack', 4, 10], ['barrel', 11, 10], ['crate', 12, 10]] },
  breaker: { f: 0, gx: 2, gy: 2, n: 'BREAKER ROOM', sn: 'BREAKR', fl: 'stone', wl: 'stone', o: [
    ['breaker', 7], ['crate', 2, 3], ['crate', 13, 3], ['chair', 7, 8, { up: 1 }], ['barrel', 2, 11], ['barrel', 13, 11]] },
  kennel: { f: 0, gx: 3, gy: 2, n: 'OLD KENNEL', sn: 'KENNEL', fl: 'dirt', wl: 'plank', o: [
    ['doghouse', 11, 3], ['crate', 2, 10], ['sack', 3, 10]] },
};
const EDGES = [
  'foyer-grand', 'foyer-dining', 'foyer-smoke', 'grand-library', 'grand-parlor', 'library-conserv', 'conserv-music', 'music-dining', 'dining-kitchen',
  'kitchen-pantry', 'kitchen-shall', 'shall-mud', 'mud-smoke', 'smoke-parlor',
  'landing-gallery', 'landing-guest', 'landing-linen', 'gallery-master', 'master-mbath', 'master-nursery', 'nursery-play', 'play-sewing', 'sewing-study',
  'guest-attic', 'linen-squart',
  'cstairs-wine', 'cstairs-coal', 'cstairs-laundry', 'wine-crawl', 'crawl-storage', 'storage-boiler', 'storage-cistern', 'cistern-rootc', 'rootc-breaker',
  'boiler-laundry', 'laundry-workshop', 'coal-workshop', 'workshop-kennel', 'kennel-breaker',
];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const ROOMS = {};
for (const id in RD) { const d = RD[id]; ROOMS[id] = { id, ...d, doors: {}, visited: false, objs: [], built: false, enters: 0 }; }
for (const e of EDGES) {
  const [a, b] = e.split('-'); const A = ROOMS[a], B = ROOMS[b];
  if (!A || !B || A.f !== B.f) throw new Error('bad edge ' + e);
  const dx = B.gx - A.gx, dy = B.gy - A.gy; const d = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
  if (Math.abs(dx) + Math.abs(dy) !== 1) throw new Error('non-adjacent ' + e);
  A.doors[d] = b; B.doors[OPP[d]] = a;
}
// object type table: w,h footprint (tiles), solid, wall (on top wall face), flavour text
const OT = {
  shelf: { w: 2, h: 2, s: 1, t: 'ROWS OF CRUMBLING BOOKS. ONE IS TITLED WITH YOUR NAME.' },
  pshelf: { w: 2, h: 2, s: 1, t: 'JARS OF SOMETHING DARK. BETTER NOT.' },
  lshelf: { w: 2, h: 2, s: 1, t: 'FOLDED SHEETS. ONE STILL HOLDS THE SHAPE OF A BODY.' },
  rack: { w: 2, h: 2, s: 1, t: 'DUSTY BOTTLES. VINTAGE 1898.' },
  table: { w: 2, h: 2, s: 1, t: 'A TABLE. A FINGER HAS WRITTEN "WHO?" IN THE DUST.' },
  longtable: { w: 4, h: 2, s: 1, t: 'SET FOR SEVEN. ONE PLATE HAS BEEN EATEN FROM.' },
  billiard: { w: 4, h: 2, s: 1, t: 'A BILLIARD TABLE. ONE BALL ROLLS SLOWLY, THEN STOPS.' },
  chair: { w: 1, h: 1, s: 1, move: 1, t: 'A CHAIR. THE SEAT IS WARM.' },
  bed: { w: 2, h: 3, s: 1, t: 'THE SHEETS ARE TURNED DOWN. SOMEONE WAS EXPECTED.' },
  wardrobe: { w: 2, h: 2, s: 1, hide: 1, t: 'A WARDROBE. ROOM ENOUGH TO HIDE.' },
  statue: { w: 1, h: 1, s: 1, creep: 1, t: 'COLD MARBLE. WASN\'T IT FACING THE WALL?' },
  dummy: { w: 1, h: 1, s: 1, creep: 1, t: 'A DRESS FORM, BRISTLING WITH PINS.' },
  sheet: { w: 1, h: 1, s: 1, creep: 1, t: 'SOMETHING UNDER A DUST SHEET. IT IS BREATHING. NO - IT ISN\'T.' },
  rocker: { w: 1, h: 1, s: 1, t: 'A ROCKING CHAIR. STILL WARM.' },
  piano: { w: 3, h: 2, s: 1, t: 'YOU PRESS A KEY. THE NOTE COMES A SECOND LATE.' },
  crib: { w: 2, h: 2, s: 1, t: 'AN EMPTY CRIB. THE BLANKET IS DAMP.' },
  tub: { w: 3, h: 2, s: 1, t: 'A CLAWFOOT TUB. A RING OF RUST - OR SOMETHING.' },
  toilet: { w: 1, h: 1, s: 1, t: 'NOTHING HERE. THANK GOODNESS.' },
  sink: { w: 1, h: 1, s: 1, t: 'THE TAP DRIPS. THE WATER IS WARM.' },
  stove: { w: 2, h: 2, s: 1, t: 'AN IRON STOVE, COLD AS A GRAVE.' },
  counter: { w: 2, h: 1, s: 1, t: 'KNIVES, ALL POINTING THE SAME WAY.' },
  crate: { w: 1, h: 1, s: 1, t: 'A NAILED CRATE.' },
  barrel: { w: 1, h: 1, s: 1, t: 'A BARREL. SOMETHING SLOSHES.' },
  sack: { w: 1, h: 1, s: 1, t: 'A SACK OF POTATOES. IT MOVED. RATS, SURELY.' },
  boiler: { w: 3, h: 3, s: 1, t: 'THE BOILER TICKS AS IT COOLS.' },
  plant: { w: 1, h: 1, s: 1, t: 'A WITHERED PLANT.' },
  clock: { w: 1, h: 1, s: 1, t: 'A GRANDFATHER CLOCK. IT TICKS, THOUGH THE PENDULUM HANGS STILL.' },
  sofa: { w: 3, h: 1, s: 1, t: 'A SOFA. THE CUSHIONS ARE DENTED AS IF SOMEONE JUST STOOD.' },
  desk: { w: 2, h: 1, s: 1, t: 'A DESK. PAPERS, CANDLE STUBS.' },
  bench: { w: 3, h: 1, s: 1, t: 'A WORKBENCH, TOOLS LAID OUT NEATLY.' },
  candle: { w: 1, h: 1, s: 1, t: 'A CANDELABRA. NO MATCHES. OF COURSE.' },
  pillar: { w: 1, h: 1, s: 1, t: 'A MARBLE PILLAR.' },
  gramo: { w: 1, h: 1, s: 1, t: 'A GRAMOPHONE. THE NEEDLE IS STILL ON THE RECORD.' },
  musicbox: { w: 1, h: 1, s: 1, t: 'A MUSIC BOX. THE DANCER FACES YOU.' },
  toybox: { w: 1, h: 1, s: 1, t: 'A TOY CHEST. SOMETHING INSIDE SCRATCHES.' },
  horse: { w: 1, h: 1, s: 1, t: 'A ROCKING HORSE WITH CHIPPED EYES.' },
  dollhouse: { w: 2, h: 2, s: 1, t: 'A DOLLHOUSE OF THIS MANOR. A TINY FIGURE STANDS IN YOUR ROOM.' },
  globe: { w: 1, h: 1, s: 1, t: 'A GLOBE. SOMEONE CIRCLED THIS HOUSE.' },
  fountain: { w: 2, h: 2, s: 1, t: 'A DRY FOUNTAIN. A CHERUB WITH NO FACE.' },
  post: { w: 1, h: 1, s: 1, t: 'A ROTTING SUPPORT POST.' },
  pool: { w: 5, h: 4, s: 1, t: 'BLACK WATER. YOUR REFLECTION BLINKS FIRST.' },
  coal: { w: 2, h: 2, s: 1, t: 'A HEAP OF COAL.' },
  doghouse: { w: 2, h: 2, s: 1, t: 'A KENNEL. A CHAIN LEADS INSIDE. IT IS TAUT.' },
  washtub: { w: 2, h: 1, s: 1, t: 'A WASHTUB OF GREY WATER.' },
  washer: { w: 1, h: 1, s: 1, t: 'A MANGLE.' },
  hang: { w: 2, h: 1, s: 0, t: 'HANGING SHEETS.' },
  basket: { w: 1, h: 1, s: 1, t: 'A LAUNDRY BASKET.' },
  nightstand: { w: 1, h: 1, s: 1, t: 'A NIGHTSTAND. A GLASS OF WATER, STILL RIPPLING.' },
  dresser: { w: 2, h: 1, s: 1, t: 'A DRESSER. THE MIRROR HAS BEEN TURNED TO THE WALL.' },
  astairs: { w: 2, h: 2, s: 1, t: 'NARROW STEPS UP TO THE ATTIC DOOR. CHAINED SHUT. SOMETHING SHUFFLES ABOVE.' },
  stairs: { w: 2, h: 2, s: 0 },
  rug: { w: 1, h: 1, s: 0, floor: 1 },
  note: { w: 1, h: 1, s: 0 },
  item: { w: 1, h: 1, s: 0 },
  // wall objects (x only; occupy rows 0-1)
  window: { w: 2, h: 2, wall: 1, t: 'RAIN STREAKS THE GLASS. SOMETHING OUT THERE IS WATCHING THE HOUSE.' },
  portrait: { w: 1, h: 2, wall: 1, t: 'A PORTRAIT. ITS EYES ARE WET.' },
  fireplace: { w: 3, h: 3, wall: 1, s: 1, t: 'A COLD FIREPLACE. FRESH ASH.' },
  breaker: { w: 2, h: 2, wall: 1 },
  atticdoor: { w: 2, h: 2, wall: 1, t: 'THE ATTIC DOOR IS CHAINED. NOT TONIGHT.' },
  tools: { w: 2, h: 2, wall: 1, t: 'A PEGBOARD OF TOOLS. ONE HOOK IS EMPTY.' },
  frontdoor: { w: 2, h: 1, wall: 2, t: 'THE FRONT DOOR. THE STORM HAS SWOLLEN IT SHUT. LIGHTS FIRST.' },
};
const ITEMS = {
  key: { n: 'CELLAR KEY', msg: 'YOU FOUND THE CELLAR KEY. THE BASEMENT DOOR IS IN THE KITCHEN.' },
  handle: { n: 'BREAKER HANDLE', msg: 'YOU FOUND THE BREAKER HANDLE. HEAVY, COLD IRON.' },
  fuse: { n: 'MAIN FUSE', msg: 'YOU FOUND A MAIN FUSE. THE GLASS IS UNCRACKED.' },
  battery: { n: 'BATTERY', msg: 'BATTERIES. THE BEAM STEADIES.' },
};

// ---------- art: all drawn in code ----------
const ART = {};
const rr = (n) => { let s = n * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

// floor tiles (16x16)
const FLOORS = {
  wood: (r, q) => { r(0, 0, 16, 16, C.n0); for (let y = 0; y < 16; y += 4) { r(0, y + 3, 16, 1, C.nd); const sx = [5, 12, 2, 9][y / 4]; r(sx, y, 1, 3, C.nd); } for (let i = 0; i < 5; i++) r(q() * 14 | 0, (q() * 4 | 0) * 4 + 1, 2 + (q() * 2 | 0), 1, C.n1); },
  plank: (r, q) => { r(0, 0, 16, 16, C.n1); for (let x = 0; x < 16; x += 4) { r(x + 3, 0, 1, 16, C.n0); r(x, (x * 3) % 16, 3, 1, C.n0); } for (let i = 0; i < 4; i++) r((q() * 4 | 0) * 4 + 1, q() * 15 | 0, 1, 2, C.n2); },
  marble: (r, q, tx, ty) => { const a = ((tx + ty) & 1) ? C.g4 : C.g2; const b = ((tx + ty) & 1) ? C.g2 : C.g4; r(0, 0, 16, 16, a); r(0, 0, 8, 8, b); r(8, 8, 8, 8, b); r(0, 0, 16, 1, C.g3); r(0, 0, 1, 16, C.g3); r(8, 0, 1, 16, C.g3); r(0, 8, 16, 1, C.g3); if (q() < 0.5) { r(2 + (q() * 4 | 0), 2 + (q() * 4 | 0), 3, 1, C.g3); } },
  carpet: (r, q, tx, ty) => { r(0, 0, 16, 16, C.r0); r(0, 0, 16, 1, C.rd); r(0, 0, 1, 16, C.rd); const d = [[7, 4], [6, 5], [8, 5], [5, 6], [9, 6], [4, 7], [10, 7], [5, 8], [9, 8], [6, 9], [8, 9], [7, 10]]; d.forEach(([x, y]) => r(x, y, 1, 1, C.n2)); r(7, 7, 1, 1, C.y0); r(2, 2, 1, 1, C.rd); r(13, 13, 1, 1, C.rd); },
  carpetG: (r) => { r(0, 0, 16, 16, C.v0); r(0, 0, 16, 1, C.vd); r(0, 0, 1, 16, C.vd); [[7, 3], [3, 7], [11, 7], [7, 11]].forEach(([x, y]) => { r(x, y, 2, 2, C.v1); }); r(7, 7, 2, 2, C.n2); },
  carpetB: (r) => { r(0, 0, 16, 16, C.b4); r(0, 0, 16, 1, C.bd); r(0, 0, 1, 16, C.bd); r(4, 4, 2, 2, C.b5); r(11, 10, 2, 2, C.p1); r(12, 3, 1, 1, C.y1); r(3, 12, 1, 1, C.y1); },
  tile: (r, q) => { r(0, 0, 16, 16, C.g4); r(0, 0, 16, 1, C.g3); r(0, 8, 16, 1, C.g3); r(0, 0, 1, 16, C.g3); r(8, 0, 1, 16, C.g3); r(1, 1, 2, 1, C.g5); r(9, 9, 2, 1, C.g5); if (q() < 0.3) r(3 + (q() * 8 | 0), 3 + (q() * 8 | 0), 2, 1, C.g3); },
  bath: (r) => { r(0, 0, 16, 16, C.b3); for (let i = 0; i < 16; i += 4) { r(0, i, 16, 1, C.b2); r(i, 0, 1, 16, C.b2); } r(5, 5, 2, 2, C.g5); },
  terra: (r, q) => { r(0, 0, 16, 16, C.n3); r(0, 0, 16, 1, C.n1); r(0, 8, 16, 1, C.n1); r(0, 0, 1, 8, C.n1); r(8, 8, 1, 8, C.n1); r(2, 2, 3, 1, C.n4); r(10, 10, 3, 1, C.n4); if (q() < 0.4) r(q() * 12 | 0, q() * 12 | 0, 2, 2, C.v1); },
  stone: (r, q) => { r(0, 0, 16, 16, C.g2); const st = [[1, 1, 7, 6], [9, 1, 6, 4], [9, 6, 6, 5], [1, 8, 7, 7], [9, 12, 6, 3]]; st.forEach(([x, y, w, h]) => { r(x, y, w, h, C.g3); r(x, y, w, 1, C.g4); }); for (let i = 0; i < 4; i++) r(q() * 15 | 0, q() * 15 | 0, 1, 1, C.g2); },
  dirt: (r, q) => { r(0, 0, 16, 16, C.n0); for (let i = 0; i < 18; i++) r(q() * 16 | 0, q() * 16 | 0, 1, 1, q() < 0.5 ? C.nd : C.n1); if (q() < 0.5) { const x = q() * 12 | 0, y = q() * 12 | 0; r(x, y, 3, 2, C.g2); r(x, y, 2, 1, C.g3); } },
};
const WALLTOP = { paper: C.n0, paper2: C.n0, green: C.n0, panel: C.nd, nursery: C.n0, tile: C.g3, bathtile: C.b2, plain: C.n1, plank: C.nd, stone: C.g2, brick: C.nd, dirtwall: C.nd };
// top wall face (16x32 column)
const WALLS = {
  paper: (r, q, x) => { r(0, 0, 16, 32, C.r0); for (let y = 4; y < 22; y += 6) for (let xx = (y / 6 & 1) * 4; xx < 16; xx += 8) { r(xx + 1, y, 2, 1, C.rd); r(xx, y + 1, 4, 1, C.rd); r(xx + 1, y + 2, 2, 1, C.rd); } r(0, 22, 16, 1, C.n2); r(0, 23, 16, 9, C.n0); r(2, 25, 12, 5, C.n1); r(2, 25, 12, 1, C.nd); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.n0); r(0, 2, 16, 1, C.n2); },
  paper2: (r, q, x) => { r(0, 0, 16, 32, C.p0); for (let xx = 0; xx < 16; xx += 4) r(xx, 3, 1, 19, C.pd); r(6, 9, 4, 4, C.pd); r(7, 10, 2, 2, C.p1); r(0, 22, 16, 1, C.n2); r(0, 23, 16, 9, C.n0); r(2, 25, 12, 5, C.n1); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.n0); r(0, 2, 16, 1, C.n2); },
  green: (r, q, x) => { r(0, 0, 16, 32, C.v0); for (let xx = 2; xx < 16; xx += 8) { r(xx, 3, 2, 19, C.vd); r(xx + 4, 6, 1, 1, C.v1); r(xx + 4, 14, 1, 1, C.v1); } r(0, 22, 16, 1, C.n2); r(0, 23, 16, 9, C.n0); r(2, 25, 12, 5, C.n1); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.n0); r(0, 2, 16, 1, C.n2); },
  panel: (r) => { r(0, 0, 16, 32, C.n0); r(2, 4, 12, 15, C.n1); r(2, 4, 12, 1, C.nd); r(2, 4, 1, 15, C.nd); r(3, 18, 11, 1, C.n2); r(0, 21, 16, 1, C.n2); r(2, 24, 12, 6, C.n1); r(2, 24, 12, 1, C.nd); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.nd); },
  nursery: (r, q, x) => { r(0, 0, 16, 32, C.b4); r(0, 6, 16, 1, C.b5); r(0, 14, 16, 1, C.b5); if (x & 1) { r(4, 9, 1, 3, C.y1); r(3, 10, 3, 1, C.y1); } else { r(11, 16, 1, 1, C.p2); r(10, 2, 1, 1, C.y1); } r(0, 21, 16, 2, C.g4); r(0, 23, 16, 9, C.g3); for (let xx = 1; xx < 16; xx += 3) r(xx, 23, 1, 8, C.g2); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.b0); },
  tile: (r) => { r(0, 0, 16, 32, C.g4); for (let y = 2; y < 31; y += 5) r(0, y, 16, 1, C.g3); for (let y = 2; y < 31; y += 10) { r(4, y, 1, 5, C.g3); r(12, y + 5, 1, 5, C.g3); } r(0, 20, 16, 2, C.b1); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.g3); },
  bathtile: (r) => { r(0, 0, 16, 32, C.b3); for (let y = 2; y < 31; y += 4) r(0, y, 16, 1, C.b2); for (let x = 0; x < 16; x += 4) r(x, 18, 1, 13, C.b2); r(0, 16, 16, 2, C.g5); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.b2); },
  plain: (r, q) => { r(0, 0, 16, 32, C.n5); if (q() < 0.5) { r(3, 8, 3, 7, C.n4); r(4, 15, 1, 3, C.n4); } r(0, 21, 16, 1, C.n1); r(0, 22, 16, 10, C.n2); for (let xx = 3; xx < 16; xx += 5) r(xx, 22, 1, 9, C.n1); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.n1); },
  plank: (r, q) => { r(0, 0, 16, 32, C.n1); for (let xx = 0; xx < 16; xx += 5) r(xx + 4, 0, 1, 31, C.n0); r(2, (q() * 20 | 0) + 4, 1, 1, C.g3); r(0, 10, 16, 2, C.n0); r(0, 31, 16, 1, C.K); r(0, 0, 16, 2, C.nd); },
  stone: (r, q, x) => { r(0, 0, 16, 32, C.g2); for (let y = 0; y < 32; y += 8) { const off = ((y / 8 + x) & 1) * 6; for (let xx = -off; xx < 16; xx += 12) { r(xx + 1, y + 1, 10, 6, C.g3); r(xx + 1, y + 1, 10, 1, C.g4); } } r(0, 31, 16, 1, C.K); },
  brick: (r, q, x) => { r(0, 0, 16, 32, C.n0); for (let y = 0; y < 32; y += 4) { const off = ((y / 4) & 1) * 4; for (let xx = -off; xx < 16; xx += 8) { r(xx, y, 7, 3, C.n1); r(xx, y, 7, 1, C.n3); } } r(0, 31, 16, 1, C.K); if (q() < 0.3) r(q() * 12 | 0, 10 + (q() * 10 | 0), 4, 2, C.g2); },
  dirtwall: (r, q) => { r(0, 0, 16, 32, C.nd); for (let i = 0; i < 6; i++) { const x = q() * 13 | 0, y = 4 + (q() * 24 | 0); r(x, y, 4, 3, C.g2); r(x, y, 3, 1, C.g3); } r(0, 0, 16, 4, C.n0); r(0, 3, 16, 1, C.n1); r(0, 31, 16, 1, C.K); },
};

// ---------- characters ----------
const PLMAP = { k: C.K, h: C.n1, s: C.n5, e: C.K, c: C.b1, d: C.b0, p: C.g2, b: C.n0, y: C.y1 };
const PL_DOWN = [
  '................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhsssshhk...', '...khsesseshk...', '....kssssssk....', '.....kssssk.....',
  '....kddccddk....', '...kdccccccdk...', '..ksdccccccdsk..', '..kkdccccccdyk..', '...kddddddddk...'];
const PL_UP = [
  '................', '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '....khhhhhhk....', '.....kssssk.....',
  '....kddddddk....', '...kdccdcccdk...', '..ksdccdcccdsk..', '..kkdccdcccdkk..', '...kddddddddk...'];
const PL_RIGHT = [
  '................', '.....kkkkk......', '....khhhhhk.....', '...khhhhhhhk....', '...khhhhhssk....', '...khhhhsesk....', '....khhssssk....', '.....kkssk......',
  '.....kdcck......', '....kdccccsyyk..', '....kdccccckk...', '....kddccck.....', '....kdddddk.....'];
const LEGS_FB = [['....kppkkppk....', '....kbbkkbbk....', '.....kk..kk.....'], ['....kppkkpk.....', '....kbbk.kk.....', '.....kk.........'], ['....kppkkppk....', '....kbbkkbbk....', '.....kk..kk.....'], ['.....kpkkppk....', '.....kk.kbbk....', '..........kk....']];
const LEGS_S = [['.....kppkpk.....', '.....kbbkbbk....', '......kk.kk.....'], ['.....kpppk......', '....kbbkbbk.....', '....kk....kk....'], ['.....kppkpk.....', '.....kbbkbbk....', '......kk.kk.....'], ['......kppk......', '......kbbk......', '......kkk.......']];
ART.player = {};
for (let f = 0; f < 4; f++) {
  ART.player['down' + f] = pm([...PL_DOWN, ...LEGS_FB[f]], PLMAP, 16);
  ART.player['up' + f] = pm([...PL_UP, ...LEGS_FB[f]], PLMAP, 16);
  ART.player['right' + f] = pm([...PL_RIGHT, ...LEGS_S[f]], PLMAP, 16);
  ART.player['left' + f] = mirror(ART.player['right' + f]);
}

// statue 16x32: v = away | face | reach
function statueArt(v) {
  const c = mk(16, 32, (r) => {
    // pedestal
    r(2, 26, 12, 6, C.g3); r(1, 25, 14, 2, C.g4); r(2, 26, 12, 1, C.g5); r(3, 29, 10, 1, C.g2);
    // robe
    for (let y = 11; y < 25; y++) { const hw = 3 + Math.floor((y - 11) * 0.3); r(8 - hw, y, hw * 2, 1, C.g4); r(8 - hw, y, 1, 1, C.g3); r(8 + hw - 1, y, 1, 1, C.g3); }
    [6, 9].forEach((x) => r(x, 16, 1, 9, C.g3)); r(8, 18, 1, 7, C.g5);
    // shoulders
    r(4, 9, 8, 3, C.g4); r(4, 9, 8, 1, C.g5);
    // head
    r(6, 2, 4, 7, C.g4); r(5, 3, 6, 5, C.g4); r(6, 2, 3, 1, C.g5); r(7, 8, 2, 1, C.g3);
    if (v === 'away') { r(5, 2, 6, 4, C.g3); r(6, 1, 4, 2, C.g3); r(7, 0, 2, 2, C.g3); r(4, 11, 2, 9, C.g3); r(10, 11, 2, 9, C.g3); r(8, 12, 1, 10, C.g3); }
    else {
      // hollow eyes + mouth
      r(6, 4, 1, 2, C.K); r(9, 4, 1, 2, C.K); r(7, 7, 2, 1, C.g2);
      if (v === 'face') { r(3, 11, 2, 8, C.g4); r(11, 11, 2, 8, C.g4); r(3, 18, 2, 2, C.g5); r(11, 18, 2, 2, C.g5); }
      else { // reaching forward
        r(2, 10, 2, 3, C.g4); r(12, 10, 2, 3, C.g4); r(1, 12, 2, 3, C.g4); r(13, 12, 2, 3, C.g4); r(1, 14, 1, 2, C.g5); r(14, 14, 1, 2, C.g5); r(7, 7, 2, 2, C.K); }
    }
  });
  return outline(c, C.g1);
}
ART.statue = { away: statueArt('away'), face: statueArt('face'), reach: statueArt('reach') };
function dummyArt(v) {
  return outline(mk(16, 32, (r) => {
    r(7, 20, 2, 9, C.n0); r(4, 29, 8, 1, C.n0); r(3, 30, 2, 2, C.n0); r(11, 30, 2, 2, C.n0); r(7, 30, 2, 2, C.n0);
    r(4, 7, 8, 13, C.n5); r(5, 6, 6, 1, C.n5); r(4, 15, 8, 1, C.n4); r(4, 7, 1, 13, C.n4); r(11, 7, 1, 13, C.n6);
    r(7, 3, 2, 4, C.n0); r(6, 2, 4, 2, C.n1);
    [[5, 9], [9, 11], [6, 13], [10, 8], [8, 17]].forEach(([x, y]) => r(x, y, 1, 1, C.r2));
    if (v !== 'away') { r(4, 9, 1, 3, C.n1); r(11, 9, 1, 3, C.n1); r(5, 4, 6, 3, C.n4); r(6, 5, 1, 1, C.K); r(9, 5, 1, 1, C.K); }
    if (v === 'reach') { r(1, 8, 3, 2, C.n5); r(12, 8, 3, 2, C.n5); }
  }), C.g1);
}
ART.dummy = { away: dummyArt('away'), face: dummyArt('face'), reach: dummyArt('reach') };
function sheetArt(v) {
  return outline(mk(16, 32, (r) => {
    for (let y = 8; y < 30; y++) { const hw = y < 12 ? 3 + (y - 8) : 6 + (y > 24 ? 1 : 0); r(8 - hw, y, hw * 2, 1, C.g4); }
    r(5, 5, 6, 4, C.g4); r(6, 4, 4, 1, C.g4); r(6, 5, 3, 1, C.g5);
    for (let y = 14; y < 30; y += 1) { if (y % 5 === 0) r(4, y, 1, 3, C.g3); } r(8, 12, 1, 18, C.g3); r(11, 16, 1, 14, C.g3); r(2, 29, 12, 1, C.g3);
    if (v !== 'away') { r(6, 6, 1, 2, C.K); r(9, 6, 1, 2, C.K); }
    if (v === 'reach') { r(7, 9, 2, 1, C.K); r(0, 14, 3, 3, C.g4); r(13, 14, 3, 3, C.g4); }
  }), C.g1);
}
ART.sheet = { away: sheetArt('away'), face: sheetArt('face'), reach: sheetArt('reach') };
// the tall one 16x40
ART.tall = [0, 1].map((f) => mk(16, 40, (r) => {
  r(6, 26, 2, 13, C.K); r(9, 26, 2, 13, C.K); r(5, 38 - f, 3, 2, C.K); r(9, 38, 3, 2, C.K);
  r(5, 11, 7, 16, C.K); r(4, 12, 9, 4, C.K); r(6, 27, 5, 2, C.K);
  r(3, 12, 2, 18 + f, C.K); r(12, 12, 2, 18 - f, C.K); r(2, 30 + f, 1, 4, C.K); r(4, 30 + f, 1, 5, C.K); r(13, 30 - f, 1, 5, C.K); r(14, 30 - f, 1, 4, C.K);
  r(6, 1, 5, 10, C.g1); r(5, 3, 7, 6, C.g1); r(7, 0, 3, 1, C.g1); r(7, 9, 3, 3, C.K);
  r(6, 5, 2, 2, C.K); r(9, 5, 2, 2, C.K); r(7, 8, 3, 1, C.K);
  r(4, 13, 1, 10, C.g1); r(6, 12, 1, 14, C.g1);
})).map((c) => outline(c, C.g2));
ART.tallFace = mk(32, 36, (r) => { // close-up for the catch: long, faceless-but-for-the-eyes
  for (let y = 0; y < 36; y++) for (let x = 0; x < 32; x++) {
    const nx = (x - 15.5) / 12.5, ny = (y - 15) / 19; const e = nx * nx + ny * ny; if (e > 1) continue;
    const t = BAY[(y & 3) * 4 + (x & 3)]; let c = e > 0.82 ? (t < 0.5 ? C.g1 : C.K) : e > 0.55 ? (t < 0.75 ? C.g1 : C.g2) : C.g2;
    if (x > 6 && x < 25 && y > 2 && y < 7 && t < 0.3) c = C.g3; // brow sheen
    const ex = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (ex(9.5, 13, 4.2, 3.4) < 1 || ex(21.5, 13, 4.2, 3.4) < 1) c = C.K;
    if (ex(9.5, 16.5, 4.5, 2.4) < 1 && t < 0.5 && c !== C.K) c = C.g1; if (ex(21.5, 16.5, 4.5, 2.4) < 1 && t < 0.5 && c !== C.K) c = C.g1;
    const m = ex(15.5, 27, 7.5, 4.2); if (m < 1) { c = m < 0.5 ? C.rd : C.K; if ((y === 24 || y === 25) && x % 2 === 0 && m > 0.3) c = C.g4; if ((y === 29 || y === 30) && x % 2 === 1 && m > 0.3) c = C.g4; }
    if ((x === 6 && y > 18 && y < 25) || (x === 25 && y > 18 && y < 25)) if (t < 0.6) c = C.g1;
    r(x, y, 1, 1, c);
  }
  r(9, 12, 2, 2, C.g5); r(22, 12, 2, 2, C.g5); r(10, 12, 1, 1, C.r1); r(22, 13, 1, 1, C.r1);
  r(14, 0, 1, 6, C.K); r(15, 6, 1, 3, C.K); r(26, 4, 1, 4, C.K);
});
ART.shadow = [0, 1].map((f) => mk(16, 28, (r) => {
  r(5, 3, 6, 6, C.K); r(4, 9, 9, 10, C.K); r(3, 10, 2, 8, C.K); r(12, 11, 3, 2, C.K); r(14, 12, 2, 6, C.K);
  r(5, 19, 2, 8 - f * 2, C.K); r(9, 19, 2, 6 + f * 2, C.K); r(6, 2, 4, 1, C.g2); r(5, 9, 1, 8, C.g1); r(10, 4, 1, 4, C.g1); r(12, 10, 1, 8, C.g1);
})).map((c) => outline(c, C.g1));
ART.cat = [0, 1].map((f) => outline(pm(f ? [
  '..k.k...........', '..kkk.........k.', '.kykyk.......k..', '.kkkkkkkkkkkk...', '..kkkkkkkkkkk...', '.k..k.....k..k..', 'k...........k...'] : [
  '..k.k...........', '..kkk..........k', '.kykyk........k.', '.kkkkkkkkkkkkk..', '..kkkkkkkkkkk...', '...k.k...k.k....', '...k.k...k.k....'], { k: C.K, y: C.y0 }, 16), C.g2));
ART.catSit = outline(pm(['...k...k..', '...kk.kk..', '...kykyk..', '...kkkkk..', '....kkk...', '...kkkkk..', '..kkkkkkk.', '..kkkkkkk.k', '..kk.k.kkk'], { k: C.K, y: C.y0 }, 12), C.g2);
ART.dart = mk(24, 16, (r) => { const q = rr(7); for (let i = 0; i < 40; i++) { const x = 4 + q() * 16, y = 3 + q() * 10; r(x, y, 2 + q() * 4, 1 + q() * 2, C.K); } r(6, 5, 12, 7, C.K); r(2, 7, 4, 3, C.K); r(18, 6, 4, 2, C.K); });

// ---------- items ----------
ART.item = {
  key: outline(mk(16, 16, (r) => { r(3, 6, 4, 4, C.y0); r(4, 7, 2, 2, C.K); r(7, 7, 7, 2, C.y0); r(11, 9, 1, 2, C.y0); r(13, 9, 1, 3, C.y0); r(3, 6, 4, 1, C.y1); }), C.n0),
  handle: outline(mk(16, 16, (r) => { r(3, 4, 3, 9, C.r0); r(3, 4, 1, 9, C.r1); r(6, 7, 7, 3, C.g4); r(6, 7, 7, 1, C.g5); r(12, 6, 2, 5, C.g3); }), C.K),
  fuse: outline(mk(16, 16, (r) => { r(4, 5, 8, 6, C.b3); r(5, 6, 6, 1, C.g5); r(6, 8, 4, 1, C.y0); r(2, 5, 2, 6, C.g4); r(12, 5, 2, 6, C.g4); r(2, 5, 2, 1, C.g5); }), C.K),
  battery: outline(mk(16, 16, (r) => { r(4, 4, 8, 9, C.v2); r(4, 4, 2, 9, C.v3); r(6, 2, 4, 2, C.g4); r(4, 9, 8, 1, C.y0); r(7, 6, 2, 2, C.g5); }), C.K),
};
ART.icon = {}; // HUD 10x10
for (const k in ART.item) ART.icon[k] = ART.item[k];
ART.note = outline(mk(16, 16, (r) => { r(3, 5, 10, 8, C.n6); r(4, 7, 7, 1, C.g3); r(4, 9, 6, 1, C.g3); r(4, 11, 5, 1, C.g3); r(12, 5, 1, 2, C.n5); }), C.n0);

// ---------- furniture sprites ----------
// each returns {c, ox, oy} draw at (tileX*16+ox, tileY*16+oy)
const books = [C.r0, C.b1, C.v1, C.y0, C.p0, C.n2, C.t1, C.n3];
const SPR = {
  shelf: (o) => ({ oy: -10, c: mk(32, 42, (r) => { const q = rr(o.x * 7 + o.y); r(0, 0, 32, 42, C.n0); r(0, 0, 32, 3, C.n1); r(0, 0, 32, 1, C.n2); for (let s = 0; s < 4; s++) { const y = 4 + s * 9; r(2, y, 28, 7, C.nd); for (let x = 2; x < 30;) { const w = 2 + (q() * 2 | 0); const h = 4 + (q() * 3 | 0); if (q() < 0.12) { x += 3; continue; } r(x, y + 7 - h, w, h, books[q() * books.length | 0]); r(x, y + 7 - h, 1, 1, C.g4); x += w; } r(1, y + 7, 30, 1, C.n2); } r(0, 40, 32, 2, C.nd); }) }),
  pshelf: (o) => ({ oy: -10, c: mk(32, 42, (r) => { const q = rr(o.x * 3 + o.y * 5); r(0, 0, 32, 42, C.n1); r(0, 0, 32, 2, C.n2); for (let s = 0; s < 4; s++) { const y = 4 + s * 9; r(2, y, 28, 7, C.n0); for (let x = 3; x < 28; x += 6) { if (q() < 0.2) continue; const k = q(); if (k < 0.5) { r(x, y + 2, 4, 5, C.b3); r(x, y + 1, 4, 1, C.g3); r(x + 1, y + 4, 2, 3, k < 0.25 ? C.r0 : C.y0); } else { r(x, y + 3, 5, 4, C.n5); r(x + 1, y + 2, 3, 1, C.n4); } } r(1, y + 7, 30, 1, C.n2); } }) }),
  lshelf: (o) => ({ oy: -10, c: mk(32, 42, (r) => { r(0, 0, 32, 42, C.n5); r(0, 0, 32, 2, C.n4); for (let s = 0; s < 4; s++) { const y = 4 + s * 9; r(2, y, 28, 7, C.n1); for (let x = 3; x < 28; x += 8) { const cc = [C.g5, C.g4, C.b3, C.p2][(x + s) % 4]; r(x, y + 2, 7, 5, cc); r(x, y + 4, 7, 1, C.g3); } } }) }),
  rack: (o) => ({ oy: -8, c: mk(32, 40, (r) => { r(0, 0, 32, 40, C.n0); for (let y = 2; y < 38; y += 6) for (let x = 2; x < 30; x += 6) { r(x, y, 5, 5, C.nd); r(x + 1, y + 1, 3, 3, (x + y) % 4 ? C.v0 : C.K); r(x + 1, y + 1, 1, 1, C.v1); } r(0, 0, 32, 1, C.n2); }) }),
  table: (o) => o.pot ? { oy: -4, c: mk(32, 36, (r) => { r(1, 4, 30, 22, C.n1); r(1, 4, 30, 2, C.n2); r(1, 26, 30, 4, C.n0); r(2, 30, 3, 6, C.n0); r(27, 30, 3, 6, C.n0); [[4, 8], [14, 12], [22, 6]].forEach(([x, y]) => { r(x, y, 6, 6, C.n3); r(x, y, 6, 1, C.n4); r(x + 1, y - 3, 1, 3, C.n2); r(x + 3, y - 4, 2, 3, C.n2); }); }) }
    : o.small ? { oy: 0, c: mk(32, 32, (r) => { r(4, 4, 24, 20, C.n1); r(4, 4, 24, 2, C.n2); r(4, 24, 24, 3, C.n0); r(6, 27, 3, 5, C.n0); r(23, 27, 3, 5, C.n0); r(12, 10, 8, 6, C.n6); r(13, 11, 6, 1, C.g3); }) }
    : { oy: -2, c: mk(32, 34, (r) => { r(0, 2, 32, 24, C.n1); r(0, 2, 32, 2, C.n2); for (let y = 7; y < 26; y += 5) r(2, y, 28, 1, C.n0); r(0, 26, 32, 4, C.n0); r(1, 30, 3, 4, C.nd); r(28, 30, 3, 4, C.nd); r(12, 10, 9, 7, C.n6); r(13, 12, 6, 1, C.g3); r(13, 14, 5, 1, C.g3); r(24, 8, 2, 4, C.g5); r(24, 7, 2, 1, C.y0); }) },
  longtable: (o) => ({ oy: -4, c: mk(64, 36, (r) => { if (o.plain) { r(0, 4, 64, 22, C.n1); r(0, 4, 64, 2, C.n2); for (let y = 9; y < 26; y += 5) r(1, y, 62, 1, C.n0); r(0, 26, 64, 4, C.n0); [6, 22, 40, 56].forEach((x) => { r(x, 10, 6, 5, C.g4); r(x + 1, 11, 4, 3, C.g3); }); } else { r(0, 4, 64, 24, C.g4); r(0, 4, 64, 2, C.g5); r(0, 24, 64, 6, C.g5); for (let x = 2; x < 64; x += 4) r(x, 27, 1, 3, C.g4); [6, 22, 40, 54].forEach((x) => { r(x, 9, 7, 6, C.g5); r(x + 1, 10, 5, 4, C.g3); r(x + 2, 11, 3, 2, C.g4); }); r(30, 4, 4, 14, C.g3); r(27, 2, 10, 2, C.g3); r(27, -1, 2, 4, C.g5); r(31, -2, 2, 4, C.g5); r(35, -1, 2, 4, C.g5); r(20, 18, 4, 3, C.r0); } r(2, 30, 3, 6, C.nd); r(59, 30, 3, 6, C.nd); }) }),
  billiard: () => ({ oy: -2, c: mk(64, 34, (r) => { r(0, 2, 64, 28, C.n0); r(3, 5, 58, 22, C.v1); r(3, 5, 58, 1, C.v2); [[3, 5], [30, 4], [58, 5], [3, 25], [30, 26], [58, 25]].forEach(([x, y]) => r(x, y, 3, 2, C.K)); r(40, 14, 2, 2, C.g5); r(16, 11, 2, 2, C.r0); r(18, 15, 2, 2, C.y0); r(14, 16, 2, 2, C.b1); r(8, 20, 30, 1, C.n4); r(2, 30, 4, 4, C.nd); r(58, 30, 4, 4, C.nd); }) }),
  chair: (o) => { const up = o.up, arm = o.arm, bench = o.bench; if (bench) return { oy: -2, c: mk(16, 18, (r) => { r(1, 4, 14, 8, C.n1); r(1, 4, 14, 1, C.n2); r(1, 12, 14, 3, C.n0); r(2, 15, 2, 3, C.nd); r(12, 15, 2, 3, C.nd); }) };
    const seat = arm ? C.r0 : C.n1, hi = arm ? C.r1 : C.n2; return { oy: up ? 0 : -8, c: outline(mk(16, 24, (r) => { if (!up) { r(3, 0, 10, 10, arm ? C.r0 : C.n0); r(3, 0, 10, 1, hi); if (!arm) { r(5, 2, 1, 7, C.nd); r(8, 2, 1, 7, C.nd); r(11, 2, 1, 7, C.nd); } } r(2, up ? 4 : 10, 12, 8, seat); r(2, up ? 4 : 10, 12, 1, hi); if (arm) { r(1, up ? 3 : 8, 2, 10, C.rd); r(13, up ? 3 : 8, 2, 10, C.rd); } r(3, up ? 12 : 18, 2, 4, C.nd); r(11, up ? 12 : 18, 2, 4, C.nd); if (up) { r(3, 12, 10, 4, arm ? C.r0 : C.n0); r(3, 12, 10, 1, hi); } }), C.K) }; },
  bed: (o) => { const b = { red: [C.r0, C.r1], blue: [C.b0, C.b1], grey: [C.g3, C.g4] }[o.c || 'red']; return { oy: -6, c: outline(mk(32, 54, (r) => { r(0, 0, 32, 10, C.n0); r(0, 0, 3, 14, C.n0); r(29, 0, 3, 14, C.n0); r(0, 0, 32, 1, C.n2); r(1, -1, 2, 2, C.n2); r(3, 8, 26, 40, C.g5); r(5, 10, 10, 6, C.g4); r(17, 10, 10, 6, C.g4); r(5, 10, 10, 1, C.g5); r(3, 18, 26, 30, b[0]); r(3, 18, 26, 3, b[1]); for (let y = 25; y < 46; y += 7) r(4, y, 24, 1, b[0] === C.g3 ? C.g2 : C.rd); r(0, 46, 32, 8, C.n0); r(0, 46, 32, 1, C.n2); }), C.K) }; },
  wardrobe: () => ({ oy: -18, c: mk(32, 50, (r) => { r(0, 0, 32, 50, C.n1); r(0, 0, 32, 4, C.n0); r(0, 0, 32, 1, C.n2); r(2, 6, 13, 38, C.n0); r(17, 6, 13, 38, C.n0); r(4, 8, 9, 15, C.n1); r(19, 8, 9, 15, C.n1); r(4, 26, 9, 15, C.n1); r(19, 26, 9, 15, C.n1); r(15, 6, 2, 38, C.K); r(13, 24, 1, 3, C.y0); r(18, 24, 1, 3, C.y0); r(0, 44, 32, 6, C.n0); r(2, 47, 4, 3, C.nd); r(26, 47, 4, 3, C.nd); }) }),
  rocker: (o) => ({ oy: -10, c: outline(mk(16, 26, (r) => { r(3, 0, 10, 12, C.n0); r(3, 0, 10, 1, C.n2); r(5, 2, 1, 9, C.nd); r(8, 2, 1, 9, C.nd); r(10, 2, 1, 9, C.nd); r(2, 12, 12, 7, C.n1); r(2, 12, 12, 1, C.n2); r(1, 9, 2, 10, C.n0); r(13, 9, 2, 10, C.n0); r(0, 21, 16, 2, C.n2); r(0, 20, 2, 1, C.n2); r(14, 20, 2, 1, C.n2); r(3, 19, 2, 2, C.n0); r(11, 19, 2, 2, C.n0); }), C.K) }),
  piano: () => ({ oy: -6, c: mk(48, 38, (r) => { r(0, 0, 48, 28, C.K); r(2, 2, 44, 24, C.g1); r(4, 3, 30, 1, C.g2); r(30, 8, 14, 16, C.g2); r(31, 9, 12, 1, C.g3); r(0, 28, 48, 6, C.g5); for (let x = 1; x < 48; x += 3) r(x, 28, 1, 6, C.g3); for (let x = 2; x < 46; x += 6) { r(x, 28, 2, 3, C.K); } r(2, 34, 3, 4, C.K); r(43, 34, 3, 4, C.K); }) }),
  crib: () => ({ oy: -8, c: outline(mk(32, 40, (r) => { r(0, 0, 32, 4, C.n5); r(0, 36, 32, 4, C.n5); for (let x = 0; x < 32; x += 4) r(x, 0, 2, 40, C.n5); r(3, 8, 26, 26, C.b3); r(3, 8, 26, 2, C.g5); r(6, 12, 8, 6, C.g5); r(18, 18, 8, 8, C.p2); r(20, 20, 3, 3, C.n5); r(21, 21, 1, 1, C.K); for (let x = 0; x < 32; x += 4) r(x, 4, 2, 32, C.n4); }), C.n0) }),
  tub: () => ({ oy: -6, c: outline(mk(48, 38, (r) => { r(2, 2, 44, 28, C.g5); r(0, 4, 48, 24, C.g5); r(5, 6, 38, 18, C.g4); r(7, 8, 34, 14, C.b3); r(8, 10, 32, 1, C.g5); r(10, 20, 20, 2, C.n2); r(40, 6, 3, 4, C.y0); r(2, 30, 4, 6, C.y0); r(42, 30, 4, 6, C.y0); r(2, 28, 44, 3, C.g4); }), C.g3) }),
  toilet: () => ({ oy: -8, c: outline(mk(16, 24, (r) => { r(3, 0, 10, 8, C.g5); r(3, 0, 10, 1, C.g4); r(2, 9, 12, 12, C.g5); r(4, 11, 8, 8, C.g4); r(5, 12, 6, 6, C.b3); r(5, 21, 6, 3, C.g4); }), C.g3) }),
  sink: () => ({ oy: -8, c: outline(mk(16, 24, (r) => { r(7, 0, 2, 4, C.g4); r(6, 3, 4, 2, C.g4); r(1, 5, 14, 9, C.g5); r(3, 7, 10, 5, C.b3); r(7, 9, 2, 1, C.b2); r(6, 14, 4, 10, C.g4); r(6, 14, 1, 10, C.g5); }), C.g3) }),
  stove: () => ({ oy: -8, c: mk(32, 40, (r) => { r(0, 0, 32, 40, C.g1); r(0, 0, 32, 2, C.g3); r(2, 4, 28, 14, C.g2); [[5, 6], [18, 6]].forEach(([x, y]) => { r(x, y, 9, 9, C.K); r(x + 2, y + 2, 5, 5, C.g2); r(x + 3, y + 3, 3, 3, C.K); }); r(2, 20, 28, 16, C.g2); r(4, 22, 24, 10, C.K); r(6, 24, 20, 1, C.g3); r(14, 33, 4, 2, C.g4); r(0, 36, 32, 4, C.K); r(26, -6, 4, 8, C.g2); }) }),
  counter: (o) => { const w = o.w1 ? 16 : 32; return { oy: -8, c: mk(w, 24, (r) => { r(0, 0, w, 8, C.g4); r(0, 0, w, 1, C.g5); r(0, 8, w, 16, C.n1); for (let x = 0; x < w; x += 16) { r(x + 2, 10, 12, 11, C.n0); r(x + 12, 15, 1, 2, C.y0); } r(0, 22, w, 2, C.nd); if (!o.w1) { r(6, 2, 8, 1, C.g3); r(18, 3, 3, 3, C.r0); } }) }; },
  crate: (o) => ({ oy: -4, c: outline(mk(16, 20, (r) => { r(1, 1, 14, 18, C.n2); r(1, 1, 14, 2, C.n4); r(1, 6, 14, 1, C.n1); r(1, 12, 14, 1, C.n1); r(1, 1, 1, 18, C.n1); r(14, 1, 1, 18, C.n1); r(3, 4, 1, 1, C.g3); r(12, 15, 1, 1, C.g3); r(1, 17, 14, 2, C.n1); }), C.K) }),
  basket: () => ({ oy: -2, c: outline(mk(16, 18, (r) => { r(1, 4, 14, 13, C.n2); for (let y = 6; y < 17; y += 3) r(1, y, 14, 1, C.n1); r(3, 1, 10, 5, C.g5); r(4, 2, 6, 1, C.g4); r(9, 3, 4, 3, C.b3); }), C.K) }),
  barrel: () => ({ oy: -6, c: outline(mk(16, 22, (r) => { r(2, 2, 12, 18, C.n1); r(1, 5, 14, 12, C.n1); r(3, 2, 10, 4, C.n0); r(4, 3, 8, 2, C.nd); r(1, 8, 14, 2, C.g3); r(1, 15, 14, 2, C.g3); r(4, 6, 1, 13, C.n2); }), C.K) }),
  sack: () => ({ oy: -4, c: outline(mk(16, 20, (r) => { r(3, 6, 10, 13, C.n5); r(2, 9, 12, 9, C.n5); r(5, 3, 6, 4, C.n4); r(6, 2, 4, 2, C.n1); r(4, 10, 1, 7, C.n4); r(10, 12, 2, 1, C.n4); }), C.K) }),
  boiler: () => ({ oy: -12, c: mk(48, 60, (r) => { r(4, 4, 40, 52, C.g1); r(2, 10, 44, 40, C.g2); r(4, 10, 4, 40, C.g3); for (let y = 14; y < 50; y += 8) for (let x = 6; x < 44; x += 8) r(x, y, 1, 1, C.g4); r(18, 30, 14, 12, C.K); r(20, 32, 10, 8, C.rd); r(21, 34, 8, 1, C.r0); r(30, 14, 10, 10, C.g5); r(31, 15, 8, 8, C.g4); r(34, 18, 4, 1, C.r0); r(10, 0, 4, 10, C.n3); r(10, 0, 30, 3, C.n3); r(36, 0, 4, 6, C.n3); r(10, 1, 30, 1, C.n4); r(0, 52, 48, 8, C.K); }) }),
  plant: (o) => ({ oy: -12, c: outline(mk(16, 28, (r) => { const q = rr(o.x * 13 + o.y); r(4, 18, 8, 9, C.n3); r(3, 17, 10, 2, C.n4); r(5, 20, 1, 6, C.n1); const lc = o.big ? [C.v0, C.v1, C.v2] : [C.n2, C.n0, C.n1]; for (let i = 0; i < 14; i++) { const a = q() * Math.PI, d = 3 + q() * 7; const x = 8 + Math.cos(a) * d * (q() < 0.5 ? -1 : 1), y = 16 - Math.sin(a) * d * 1.2; r(x, y, 2 + (q() * 2 | 0), 2, lc[q() * 3 | 0]); } r(7, 8, 2, 10, lc[0]); }), C.K) }),
  clock: () => ({ oy: -22, c: outline(mk(16, 38, (r) => { r(2, 2, 12, 36, C.n0); r(1, 0, 14, 4, C.n1); r(3, 4, 10, 10, C.n2); r(4, 5, 8, 8, C.n6); r(8, 6, 1, 3, C.K); r(8, 9, 2, 1, C.K); r(5, 17, 6, 14, C.nd); r(7, 20, 2, 8, C.n2); r(6, 27, 4, 3, C.y0); r(2, 34, 12, 4, C.n1); }), C.K) }),
  sofa: (o) => o.bench ? { oy: -4, c: outline(mk(48, 20, (r) => { r(0, 2, 48, 10, C.n1); r(0, 2, 48, 1, C.n2); for (let x = 0; x < 48; x += 6) r(x, 3, 1, 9, C.n0); r(0, 12, 48, 3, C.n0); r(2, 15, 3, 5, C.nd); r(43, 15, 3, 5, C.nd); }), C.K) }
    : { oy: -10, c: outline(mk(48, 26, (r) => { r(2, 0, 44, 12, C.rd); r(2, 0, 44, 2, C.r0); r(0, 6, 5, 16, C.r0); r(43, 6, 5, 16, C.r0); r(5, 10, 38, 10, C.r0); r(5, 10, 38, 1, C.r1); r(24, 10, 1, 10, C.rd); r(5, 20, 38, 2, C.rd); r(2, 22, 3, 4, C.n0); r(43, 22, 3, 4, C.n0); [10, 20, 30, 38].forEach((x) => r(x, 4, 1, 1, C.n2)); }), C.K) },
  desk: (o) => ({ oy: -8, c: outline(mk(32, 24, (r) => { r(0, 2, 32, 10, C.n1); r(0, 2, 32, 1, C.n2); r(0, 12, 32, 10, C.n0); r(2, 14, 10, 6, C.n1); r(20, 14, 10, 6, C.n1); r(6, 16, 2, 1, C.y0); r(24, 16, 2, 1, C.y0); r(0, 22, 4, 2, C.nd); r(28, 22, 4, 2, C.nd);
    if (o.sew) { r(8, -2, 14, 6, C.K); r(9, -1, 10, 1, C.y0); r(19, 2, 2, 6, C.g4); r(4, 6, 6, 4, C.p0); }
    else if (o.iron) { r(4, 3, 24, 6, C.g5); r(14, 1, 8, 4, C.g3); r(15, 0, 6, 1, C.K); }
    else { r(4, 4, 9, 6, C.n6); r(5, 6, 6, 1, C.g3); r(16, 4, 4, 5, C.g5); r(17, 3, 2, 1, C.y0); r(24, 3, 4, 7, C.g2); } }), C.K) }),
  bench: () => ({ oy: -8, c: outline(mk(48, 24, (r) => { r(0, 2, 48, 9, C.n2); r(0, 2, 48, 1, C.n4); r(0, 11, 48, 3, C.n1); r(2, 14, 3, 10, C.n1); r(43, 14, 3, 10, C.n1); r(2, 19, 44, 2, C.n1); r(6, 4, 10, 2, C.g3); r(14, 3, 3, 4, C.n0); r(24, 5, 6, 3, C.g4); r(36, 4, 6, 4, C.r0); }), C.K) }),
  candle: () => ({ oy: -14, c: outline(mk(16, 30, (r) => { r(7, 8, 2, 18, C.g3); r(4, 26, 8, 3, C.g3); r(3, 29, 10, 1, C.g2); r(2, 8, 12, 2, C.g3); r(2, 4, 2, 4, C.g5); r(7, 2, 2, 6, C.g5); r(12, 4, 2, 4, C.g5); r(2, 3, 2, 1, C.K); r(7, 1, 2, 1, C.K); r(12, 3, 2, 1, C.K); r(8, 10, 1, 16, C.g4); }), C.K) }),
  pillar: () => ({ oy: -22, c: mk(16, 38, (r) => { r(1, 0, 14, 4, C.g4); r(1, 0, 14, 1, C.g5); r(3, 4, 10, 28, C.g4); r(3, 4, 2, 28, C.g5); r(10, 4, 3, 28, C.g3); r(7, 4, 1, 28, C.g3); r(1, 32, 14, 6, C.g3); r(1, 32, 14, 1, C.g4); }) }),
  gramo: () => ({ oy: -12, c: outline(mk(16, 28, (r) => { r(2, 16, 12, 10, C.n1); r(2, 16, 12, 1, C.n2); r(3, 26, 2, 2, C.n0); r(11, 26, 2, 2, C.n0); r(3, 13, 10, 3, C.K); r(7, 6, 2, 8, C.n2); r(4, 0, 10, 8, C.y0); r(5, 1, 8, 6, C.n2); r(7, 3, 4, 2, C.K); }), C.K) }),
  musicbox: () => ({ oy: -10, c: outline(mk(16, 26, (r) => { r(2, 12, 12, 2, C.n1); r(6, 14, 4, 10, C.n0); r(3, 24, 10, 2, C.n0); r(3, 6, 10, 6, C.p0); r(3, 6, 10, 1, C.p1); r(3, 9, 10, 1, C.y0); r(7, 0, 2, 6, C.g5); r(6, 2, 4, 1, C.p2); r(5, 4, 6, 2, C.p2); }), C.K) }),
  toybox: () => ({ oy: -4, c: outline(mk(16, 20, (r) => { r(1, 4, 14, 15, C.r0); r(1, 2, 14, 4, C.r1); r(1, 6, 14, 1, C.y0); r(6, 9, 4, 4, C.b1); r(7, 10, 2, 2, C.y1); r(3, 0, 3, 3, C.n5); r(4, 1, 1, 1, C.K); }), C.K) }),
  horse: () => ({ oy: -10, c: outline(mk(16, 26, (r) => { r(0, 23, 16, 2, C.n1); r(0, 22, 2, 1, C.n1); r(14, 22, 2, 1, C.n1); r(3, 18, 2, 5, C.n5); r(11, 18, 2, 5, C.n5); r(3, 10, 10, 8, C.g5); r(5, 10, 4, 3, C.r0); r(11, 3, 4, 9, C.g5); r(12, 1, 3, 3, C.g5); r(13, 4, 1, 1, C.K); r(10, 3, 2, 8, C.n1); r(1, 11, 3, 4, C.n1); }), C.K) }),
  dollhouse: () => ({ oy: -12, c: outline(mk(32, 44, (r) => { for (let y = 0; y < 12; y++) r(16 - y - 4, y, (y + 4) * 2, 1, C.n1); r(2, 12, 28, 30, C.n5); r(2, 26, 28, 1, C.n4); [[5, 15], [21, 15], [5, 29], [21, 29]].forEach(([x, y]) => { r(x, y, 6, 7, C.K); r(x, y + 3, 6, 1, C.n2); }); r(13, 32, 6, 10, C.n0); r(24, 30, 1, 3, C.g5); }), C.K) }),
  globe: () => ({ oy: -10, c: outline(mk(16, 26, (r) => { r(3, 2, 10, 12, C.b1); r(2, 4, 12, 8, C.b1); r(4, 4, 4, 4, C.v1); r(9, 8, 3, 3, C.v1); r(4, 3, 2, 1, C.b2); r(1, 6, 1, 6, C.n2); r(7, 14, 2, 8, C.n2); r(4, 22, 8, 3, C.n0); r(9, 5, 1, 1, C.r0); }), C.K) }),
  fountain: () => ({ oy: -16, c: mk(32, 48, (r) => { r(0, 20, 32, 26, C.g3); r(0, 20, 32, 2, C.g4); r(3, 23, 26, 18, C.g2); r(4, 24, 24, 16, C.bd); r(6, 28, 6, 1, C.b0); r(18, 34, 6, 1, C.b0); r(13, 4, 6, 26, C.g4); r(12, 2, 8, 6, C.g4); r(13, 3, 6, 1, C.g5); r(10, 10, 3, 4, C.g4); r(19, 10, 3, 4, C.g4); r(14, 30, 4, 4, C.g3); r(0, 44, 32, 4, C.g2); }) }),
  post: () => ({ oy: -20, c: mk(16, 36, (r) => { r(4, 0, 8, 34, C.n0); r(4, 0, 2, 34, C.n1); r(10, 0, 2, 34, C.nd); r(5, 8, 5, 1, C.nd); r(6, 20, 4, 1, C.nd); r(2, 32, 12, 4, C.g2); }) }),
  pool: () => ({ oy: 0, c: mk(80, 64, (r) => { r(0, 0, 80, 64, C.g3); r(0, 0, 80, 2, C.g4); r(3, 3, 74, 58, C.K); r(4, 4, 72, 56, C.bd); [[10, 12, 12], [40, 20, 16], [22, 38, 10], [54, 46, 12]].forEach(([x, y, w]) => { r(x, y, w, 1, C.b0); r(x + 3, y + 2, w - 6, 1, C.b0); }); r(36, 30, 2, 1, C.g4); r(41, 30, 2, 1, C.g4); }) }),
  coal: () => ({ oy: -6, c: mk(32, 38, (r) => { const q = rr(5); for (let y = 6; y < 38; y++) { const hw = Math.min(16, (y - 4) * 0.8); r(16 - hw, y, hw * 2, 1, C.g1); } for (let i = 0; i < 40; i++) { const x = 4 + q() * 24, y = 12 + q() * 24; r(x, y, 3, 2, q() < 0.5 ? C.K : C.g2); r(x, y, 1, 1, C.g3); } }) }),
  doghouse: () => ({ oy: -12, c: outline(mk(32, 44, (r) => { for (let y = 0; y < 14; y++) r(16 - y - 2, y, (y + 2) * 2, 1, C.n0); r(0, 12, 32, 2, C.nd); r(2, 14, 28, 28, C.n1); for (let y = 18; y < 42; y += 5) r(2, y, 28, 1, C.n0); r(9, 22, 14, 20, C.K); r(9, 21, 14, 1, C.n0); r(12, 38, 8, 1, C.g3); r(14, 15, 4, 3, C.n6); }), C.K) }),
  washtub: () => ({ oy: -6, c: outline(mk(32, 22, (r) => { r(1, 2, 30, 16, C.g3); r(0, 4, 32, 12, C.g3); r(3, 4, 26, 9, C.g2); r(4, 5, 24, 7, C.t0); r(6, 7, 8, 1, C.t1); r(1, 16, 30, 2, C.g2); r(3, 18, 3, 4, C.g2); r(26, 18, 3, 4, C.g2); r(2, 9, 30, 1, C.g4); }), C.K) }),
  washer: () => ({ oy: -10, c: outline(mk(16, 26, (r) => { r(2, 8, 12, 14, C.n1); r(1, 2, 14, 3, C.g3); r(1, 6, 14, 3, C.g3); r(1, 2, 14, 1, C.g4); r(14, 1, 2, 9, C.g2); r(14, 0, 2, 2, C.n2); r(3, 22, 2, 4, C.n0); r(11, 22, 2, 4, C.n0); }), C.K) }),
  hang: (o, f = 0) => ({ oy: -20, c: mk(32, 36, (r) => { r(0, 0, 32, 1, C.g3); [[1, 30, C.g5], [17, 26, C.b3]].forEach(([x, h, c], i) => { const sw = (f + i) & 1; r(x, 1, 13, h, c); r(x + sw, h - 2, 13, 3, c); r(x + 2, 1, 1, h, C.g4); r(x + 8 + sw, 4, 1, h - 4, C.g4); r(x + 3, 0, 1, 2, C.n2); r(x + 10, 0, 1, 2, C.n2); }); }) }),
  nightstand: () => ({ oy: -6, c: outline(mk(16, 22, (r) => { r(1, 2, 14, 16, C.n1); r(1, 2, 14, 2, C.n2); r(3, 8, 10, 6, C.n0); r(7, 10, 2, 1, C.y0); r(2, 18, 2, 4, C.nd); r(12, 18, 2, 4, C.nd); r(9, -2, 4, 5, C.b3); r(9, -2, 4, 1, C.g5); }), C.K) }),
  dresser: (o) => { const w = o.w1 ? 16 : 32; return { oy: -14, c: outline(mk(w, 30, (r) => { r(0, 6, w, 22, C.n1); r(0, 6, w, 2, C.n2); for (let y = 10; y < 26; y += 6) { r(2, y, w - 4, 5, C.n0); r((w >> 1) - 1, y + 2, 2, 1, C.y0); } if (!o.w1) { r(8, 0, 16, 7, C.n0); r(10, 1, 12, 5, C.nd); } r(1, 28, 3, 2, C.nd); r(w - 4, 28, 3, 2, C.nd); }), C.K) }; },
  astairs: () => ({ oy: 0, c: mk(32, 32, (r) => { for (let i = 0; i < 4; i++) { const y = i * 8; r(2, y, 28, 8, [C.nd, C.n0, C.n1, C.n2][i]); r(2, y, 28, 1, C.n4); } r(0, 0, 2, 32, C.n0); r(30, 0, 2, 32, C.n0); }) }),
  stairs: (o) => { const w = (o.w || 2) * 16, h = (o.h || 2) * 16; return { oy: 0, c: mk(w, h, (r) => {
    if (o.locked && !o.open) { r(0, 0, w, h, C.n0); for (let x = 1; x < w; x += 6) r(x, 1, 5, h - 2, C.n1); r(0, 4, w, 2, C.g2); r(0, h - 6, w, 2, C.g2); r(w / 2 - 4, h / 2 - 3, 8, 7, C.y0); r(w / 2 - 3, h / 2 - 6, 6, 4, C.g3); r(w / 2 - 2, h / 2 - 5, 4, 3, C.n0); r(w / 2 - 1, h / 2, 2, 2, C.K); return; }
    const n = Math.round(h / 6); const dn = o.dir === 'down';
    for (let i = 0; i < n; i++) { const y = i * h / n; const t = dn ? i / (n - 1) : 1 - i / (n - 1); const cols = [C.g5, C.g4, C.g3, C.g2, C.g1, C.K]; const base = cols[Math.min(5, Math.floor(t * 5.5))];
      const wood = [C.n4, C.n2, C.n1, C.n0, C.nd, C.K][Math.min(5, Math.floor(t * 5.5))]; const carpet = [C.r1, C.r0, C.r0, C.rd, C.rd, C.K][Math.min(5, Math.floor(t * 5.5))];
      r(0, y, w, h / n + 1, o.stone ? base : wood); if (w > 32) r(8, y, w - 16, h / n + 1, carpet); r(0, y, w, 1, o.stone ? C.g5 : C.n6); }
    r(0, 0, 2, h, C.n0); r(w - 2, 0, 2, h, C.n0); if (w > 32) { r(2, 0, 1, h, C.n2); r(w - 3, 0, 1, h, C.n2); } }) }; },
  // wall objects
  window: (o, f = 0) => ({ oy: 0, c: mk(32, 32, (r) => { r(2, 3, 28, 22, C.n0); r(4, 5, 24, 18, f ? C.b3 : C.bd); if (!f) { r(4, 15, 24, 8, C.b0); r(20, 7, 4, 4, C.g4); r(21, 7, 3, 3, C.g5); r(6, 18, 22, 5, C.K); r(8, 16, 4, 2, C.K); r(16, 14, 2, 4, C.K); } r(15, 5, 2, 18, C.n0); r(4, 13, 24, 2, C.n0); r(0, 2, 5, 25, C.rd); r(27, 2, 5, 25, C.rd); r(1, 2, 2, 25, C.r0); r(29, 2, 2, 25, C.r0); r(0, 0, 32, 3, C.n2); r(2, 25, 28, 3, C.n2); for (let i = 0; i < 6; i++) r(6 + i * 4, 6 + (i * 7) % 12, 1, 3, f ? C.g5 : C.b4); }) }),
  portrait: (o) => ({ oy: 2, c: mk(16, 26, (r) => { r(0, 0, 16, 26, C.n2); r(0, 0, 16, 1, C.y1); r(1, 1, 14, 24, C.n0); r(2, 2, 12, 22, o.master ? C.vd : C.pd); r(4, 15, 8, 9, o.master ? C.K : C.rd); r(5, 5, 6, 8, C.n5); r(4, 4, 8, 3, o.master ? C.g3 : C.n0); r(4, 6, 1, 5, o.master ? C.g3 : C.n0); r(11, 6, 1, 5, o.master ? C.g3 : C.n0); r(6, 7, 2, 2, C.g5); r(9, 7, 2, 2, C.g5); r(7, 11, 2, 1, C.n1); r(7, 15, 2, 3, C.g5); }) }),
  fireplace: () => ({ oy: 4, c: mk(48, 44, (r) => { r(0, 0, 48, 44, C.g3); r(0, 0, 48, 4, C.g4); r(0, 0, 48, 1, C.g5); r(2, 8, 44, 2, C.g2); r(8, 12, 32, 28, C.K); r(8, 12, 32, 2, C.g2); r(12, 32, 24, 3, C.g2); r(14, 30, 2, 5, C.g2); r(22, 30, 2, 5, C.g2); r(30, 30, 2, 5, C.g2); r(12, 36, 24, 3, C.g1); r(16, 37, 3, 1, C.g3); r(0, 40, 48, 4, C.g2); r(18, 2, 4, 5, C.g5); r(26, 3, 3, 4, C.y0); }) }),
  breaker: (o) => ({ oy: 2, c: mk(32, 30, (r) => { r(0, 0, 32, 30, C.g2); r(1, 1, 30, 28, C.g3); r(1, 1, 30, 1, C.g4); for (let i = 0; i < 4; i++) { r(2 + i * 3, 2, 2, 2, i & 1 ? C.y0 : C.K); r(18 + i * 3, 2, 2, 2, i & 1 ? C.K : C.y0); }
    for (let y = 7; y < 26; y += 5) { r(3, y, 8, 3, C.g2); r(4, y + 1, 3, 1, o.on ? C.v3 : C.g4); r(21, y, 8, 3, C.g2); r(22, y + 1, 3, 1, o.on ? C.v3 : C.g4); }
    r(12, 6, 8, 20, C.K); r(13, 7, 6, 4, o.fuse ? C.b3 : C.g1); if (o.fuse) r(14, 8, 4, 1, C.y0);
    r(14, 13, 4, 11, C.g1); if (o.handle) { const y = o.on ? 13 : 20; r(13, y, 6, 3, C.g4); r(12, y - (o.on ? 4 : -1), 3, 5, C.r0); r(12, y - (o.on ? 4 : -1), 1, 5, C.r1); } }) }),
  atticdoor: () => ({ oy: 0, c: mk(32, 32, (r) => { r(4, 2, 24, 30, C.n0); r(6, 4, 20, 28, C.n1); for (let x = 9; x < 26; x += 5) r(x, 4, 1, 28, C.n0); for (let i = 0; i < 24; i += 2) { r(4 + i, 12 + (i % 4 ? 1 : 0), 2, 2, C.g4); r(4 + i, 22 - (i % 4 ? 1 : 0), 2, 2, C.g4); } r(13, 14, 6, 6, C.y0); r(14, 11, 4, 4, C.g3); r(15, 12, 2, 2, C.n1); r(15, 16, 2, 2, C.K); }) }),
  tools: () => ({ oy: 2, c: mk(32, 24, (r) => { r(0, 0, 32, 24, C.n2); for (let y = 2; y < 24; y += 4) for (let x = 2; x < 32; x += 4) r(x, y, 1, 1, C.n1); r(4, 4, 2, 14, C.n0); r(2, 3, 6, 3, C.g3); r(12, 4, 1, 12, C.g4); r(11, 15, 3, 4, C.n1); r(20, 4, 6, 2, C.g3); r(24, 6, 2, 10, C.n0); }) }),
  frontdoor: () => ({ oy: -6, c: mk(32, 22, (r) => { r(0, 0, 32, 22, C.n1); r(0, 0, 32, 2, C.n2); r(15, 0, 2, 22, C.n0); r(3, 4, 10, 14, C.n0); r(19, 4, 10, 14, C.n0); r(12, 10, 2, 2, C.y0); r(18, 10, 2, 2, C.y0); r(-2, 18, 36, 4, C.n0); }) }),
};
const SCACHE = new Map();
function sprOf(o, frame = 0) {
  const fn = SPR[o.t]; if (!fn) return null;
  const k = o.t + '|' + (o.vkey || '') + '|' + frame + '|' + JSON.stringify(o.ex || {}) + '|' + (o.t === 'shelf' || o.t === 'pshelf' || o.t === 'plant' ? o.x0 + ',' + o.y0 : '');
  let s = SCACHE.get(k); if (s) return s;
  const src = { ...o.ex, x: o.x0, y: o.y0, open: o.open, on: o.on, handle: o.handle, fuse: o.fuse };
  s = fn(src, frame); s.ox = s.ox || 0; SCACHE.set(k, s); return s;
}

// ---------- game state ----------
const cv = document.getElementById('c'); const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
const scene = document.createElement('canvas'); scene.width = VW; scene.height = VH; const sc = scene.getContext('2d', { willReadFrequently: true });
const LW = 128, LH = 112; const LM = new Float32Array(LW * LH);
const G = {
  state: 'title', t: 0, playT: 0, room: null, inv: { key: 0, handle: 0, fuse: 0 }, installed: { handle: 0, fuse: 0 }, battery: 1, lightUser: true,
  blk: 0, stut: 0, flickOff: false, flickInt: 1, tension: 0, quiet: 0, nextAmbient: R(22, 34), nextLightning: R(10, 22), flash: 0, flashQ: [],
  msg: null, map: false, check: null, threat: null, threatNext: 95, threatFirst: false, scares: 0, hidden: null, shake: 0, ents: [],
  roomT: 0, deadMsg: false, lightOffT: 0, noFlicker: QS.has('noflicker'), noThreat: QS.has('nothreat'), et: 0, catches: 0, motifT: 4, motifI: 0, beatT: 0,
  titleT: 0, lit: false, montage: null, overT: 0, endTime: 0, botInfo: '', boxT: 0, boxI: 0, boxOn: false, boxLit: 0, rockLit: 0, rockT: 0, stepT: 0, stepAlt: false,
};
const P = { x: 128, y: 186, ang: -Math.PI / 2, dir: 'up', walk: 0, moving: false, vx: 0, vy: 0 };
window.__frameErrors = 0;

function lightEff() { return G.lightUser && G.battery > 0 && !G.flickOff && !G.hidden && G.state === 'play'; }
function showMsg(s, dur) { const lines = wrap(s, 40); G.msg = { lines, t: dur || clamp(2.5 + s.length * 0.045, 3, 8) }; }
function scare(amt = 0.5) { G.tension = clamp(G.tension + amt, 0, 1.5); G.quiet = 0; G.scares++; }

// ---------- rooms ----------
function buildRoom(rm) {
  if (rm.built) return; rm.built = true;
  for (const d of rm.o) {
    const [t, x, y, ex0] = d; const ot = OT[t]; let ex = {}; let yy = y;
    if (ot.wall) { ex = typeof y === 'object' ? y : {}; yy = ot.wall === 2 ? 13 : 0; }
    else ex = ex0 || {};
    const w = ex.w || (ex.w1 ? 1 : ot.w), h = ex.h || ot.h;
    const o = { t, x, y: yy, x0: x, y0: yy, w, h, ex, s: !!ot.s, wall: !!ot.wall, room: rm.id };
    if (ot.creep) { o.creep = 1; o.v = 'away'; o.unseen = 0; o.th = R(2.5, 5); o.moves = 0; }
    if (t === 'stairs') { o.to = ex.to; o.dir = ex.dir; o.locked = ex.locked; o.open = !ex.locked; o.s = !!ex.locked; o.ex = { ...ex, stone: rm.fl === 'stone' }; }
    if (t === 'item') { o.it = ex.it; }
    if (t === 'desk' && ex.item) { o.it = ex.item; }
    if (t === 'fireplace') { o.s = true; }
    rm.objs.push(o);
  }
  rm.amb = new Float32Array(LW * LH);
  rm.windows = rm.objs.filter((o) => o.t === 'window');
  for (const wo of rm.windows) {
    const wx = wo.x * 16;
    for (let cy = 0; cy < LH; cy++) for (let cx = 0; cx < LW; cx++) {
      const x = cx * 2 + 1, y = cy * 2 + 1; let L = 0;
      if (y < 30 && x >= wx + 3 && x < wx + 29 && y > 4) L = 0.62;
      else if (y >= 30) { const s = (y - 30) * 0.45; const x0 = wx + 4 + s, x1 = wx + 28 + s; if (x >= x0 && x < x1 && y < 30 + 96) L = 0.5 * (1 - (y - 30) / 110); }
      if (L > rm.amb[cy * LW + cx]) rm.amb[cy * LW + cx] = L;
    }
  }
  rm.static = null;
}
function doorGaps(rm) { return { N: !!rm.doors.N, S: !!rm.doors.S, W: !!rm.doors.W, E: !!rm.doors.E }; }
function computeGrid(rm) {
  const g = new Uint8Array(COLS * ROWS); const d = doorGaps(rm);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    let s = 0; if (y <= 1 || y === 13 || x === 0 || x === 15) s = 1;
    if (d.N && y <= 1 && (x === 7 || x === 8)) s = 0; if (d.S && y === 13 && (x === 7 || x === 8)) s = 0;
    if (d.W && x === 0 && (y === 6 || y === 7)) s = 0; if (d.E && x === 15 && (y === 6 || y === 7)) s = 0;
    g[y * COLS + x] = s;
  }
  for (const o of rm.objs) {
    if (!o.s || o.taken || o.dragging) continue;
    if (o.t === 'fireplace') { for (let x = o.x; x < o.x + 3; x++) g[2 * COLS + x] = 1; continue; }
    if (o.wall) continue;
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y * COLS + x] = 1;
  }
  rm.grid = g;
}
function tileSolid(tx, ty) { if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false; return G.room.grid[ty * COLS + tx] === 1; }
function boxFree(x, y) {
  const pts = [[x - 5, y - 3], [x + 4, y - 3], [x - 5, y + 2], [x + 4, y + 2]];
  for (const [px, py] of pts) if (tileSolid(Math.floor(px / 16), Math.floor(py / 16))) return false;
  return true;
}
function renderStatic(rm) {
  const c = mk(VW, VH); const g = c.getContext('2d'); const q = rr(rm.gx * 31 + rm.gy * 7 + rm.f * 101);
  const ff = FLOORS[rm.fl];
  for (let ty = 2; ty < 13; ty++) for (let tx = 1; tx < 15; tx++) { const t = mk(16, 16, (r) => ff(r, q, tx, ty)); g.drawImage(t, tx * 16, ty * 16); }
  const d = doorGaps(rm); const wt = WALLTOP[rm.wl];
  // top wall face
  for (let tx = 0; tx < 16; tx++) { const t = mk(16, 32, (r) => WALLS[rm.wl](r, q, tx)); g.drawImage(t, tx * 16, 0); }
  // rugs
  for (const o of rm.objs) if (o.t === 'rug') {
    const cc = { red: [C.r0, C.rd, C.n2], green: [C.v0, C.vd, C.n2], purple: [C.p0, C.pd, C.n2], pink: [C.p1, C.p0, C.g5], blue: [C.b1, C.b0, C.g5] }[o.ex.c || 'red'];
    const x = o.x * 16 + 2, y = o.y * 16 + 2, w = o.w * 16 - 4, h = o.h * 16 - 4;
    g.fillStyle = cc[1]; g.fillRect(x, y, w, h); g.fillStyle = cc[0]; g.fillRect(x + 2, y + 2, w - 4, h - 4); g.fillStyle = cc[2]; g.fillRect(x + 4, y + 4, w - 8, 1); g.fillRect(x + 4, y + h - 5, w - 8, 1); g.fillRect(x + 4, y + 4, 1, h - 8); g.fillRect(x + w - 5, y + 4, 1, h - 8);
    g.fillStyle = cc[1]; for (let i = x + 8; i < x + w - 8; i += 8) g.fillRect(i, y + h / 2 - 1, 3, 3);
    g.fillStyle = cc[2]; for (let i = x; i < x + w; i += 3) { g.fillRect(i, y - 2, 1, 2); g.fillRect(i, y + h, 1, 2); }
  }
  // side + bottom walls
  const side = (x, y, w, h) => { g.fillStyle = wt; g.fillRect(x, y, w, h); };
  side(0, 32, 16, 192); side(240, 32, 16, 192); side(0, 208, 256, 16);
  g.fillStyle = C.K; g.fillRect(15, 32, 1, 176); g.fillRect(240, 32, 1, 176); g.fillRect(16, 208, 224, 1);
  g.fillStyle = C.g2; for (let y = 36; y < 208; y += 8) { g.fillRect(4, y, 6, 1); g.fillRect(246, y + 4, 6, 1); } for (let x = 4; x < 252; x += 10) g.fillRect(x, 214, 5, 1);
  // door gaps
  const fl = (tx, ty) => g.drawImage(mk(16, 16, (r) => ff(r, q, tx, ty)), tx * 16, ty * 16);
  if (d.N) { g.fillStyle = C.K; g.fillRect(112, 0, 32, 32); g.fillStyle = C.n2; g.fillRect(108, 2, 4, 30); g.fillRect(144, 2, 4, 30); g.fillRect(108, 0, 40, 3); g.fillStyle = C.n0; g.fillRect(110, 4, 2, 28); g.fillRect(144, 4, 2, 28); fl(7, 1); fl(8, 1); g.fillStyle = C.K; g.fillRect(112, 16, 32, 6); g.fillStyle = C.g1; g.fillRect(112, 22, 32, 4); }
  if (d.S) { fl(7, 13); fl(8, 13); g.fillStyle = C.K; g.fillRect(112, 216, 32, 8); g.fillStyle = C.n2; g.fillRect(110, 208, 2, 16); g.fillRect(144, 208, 2, 16); }
  if (d.W) { fl(0, 6); fl(0, 7); g.fillStyle = C.K; g.fillRect(0, 96, 6, 32); g.fillStyle = C.n2; g.fillRect(0, 94, 16, 2); g.fillRect(0, 128, 16, 2); }
  if (d.E) { fl(15, 6); fl(15, 7); g.fillStyle = C.K; g.fillRect(250, 96, 6, 32); g.fillStyle = C.n2; g.fillRect(240, 94, 16, 2); g.fillRect(240, 128, 16, 2); }
  // cobwebs in corners for basement/attic
  if (rm.f === 0 || rm.id === 'attic') { g.fillStyle = C.g3; for (let i = 0; i < 10; i++) { g.fillRect(16 + i, 32 + 9 - i, 1, 1); g.fillRect(16, 32 + i, 1, 1); g.fillRect(16 + i, 32, 1, 1); g.fillRect(239 - i, 32 + 9 - i, 1, 1); } g.fillRect(20, 36, 3, 1); g.fillRect(232, 37, 4, 1); }
  // moonlight tint on floor (separate layer, hidden once the power is back)
  rm.moon = mk(VW, VH, (r, mg) => { for (const wo of rm.windows) { const wx = wo.x * 16; mg.fillStyle = C.b5; for (let y = 32; y < 126; y += 2) { const s = (y - 30) * 0.45; for (let x = Math.ceil(wx + 4 + s); x < wx + 28 + s; x++) if (((x + y) & 3) === 0 && rm.grid[Math.floor(y / 16) * 16 + Math.floor(x / 16)] === 0) mg.fillRect(x, y, 1, 1); } } });
  rm.static = c;
}

// ---------- entering rooms ----------
const SAFE = new Set(['foyer', 'grand', 'landing', 'kitchen', 'cstairs', 'shall', 'squart']);
function enterRoom(id, how, info = {}) {
  const prev = G.room; const rm = ROOMS[id]; buildRoom(rm); computeGrid(rm); if (!rm.static) renderStatic(rm);
  G.room = rm; G.roomT = 0; rm.enters++; const first = !rm.visited; rm.visited = true;
  G.ents = G.ents.filter((e) => e.persist);
  if (G.threat && G.threat.room !== id) { G.threat = null; G.threatNext = Math.max(G.threatNext, G.playT + R(20, 35)); }
  if (how === 'door') {
    const d = info.dir; // direction moved
    if (d === 'N') { P.x = 128; P.y = VH - 22; } if (d === 'S') { P.x = 128; P.y = 38; }
    if (d === 'W') { P.x = VW - 20; P.y = 116; } if (d === 'E') { P.x = 20; P.y = 116; }
  } else if (how === 'stairs') {
    const st = rm.objs.find((o) => o.t === 'stairs' && o.to === info.from);
    P.x = (st.x + st.w / 2) * 16; P.y = (st.y + st.h) * 16 + 10; P.ang = Math.PI / 2; P.dir = 'down';
  } else if (how === 'pos') { P.x = info.x; P.y = info.y; }
  if (SAFE.has(id) && how !== 'pos') G.check = { room: id, x: P.x, y: P.y };
  AU.droneFloor(rm.f);
  if (!first && rm.enters > 1) shuffleRoom(rm, info.dir);
  roomEvents(rm, first);
}
function freeTiles(rm, avoidPlayer = 3) {
  const out = []; const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
  for (let y = 3; y <= 11; y++) for (let x = 2; x <= 13; x++) {
    if (rm.grid[y * COLS + x]) continue;
    if ((x === 7 || x === 8) && (y <= 3 || y >= 11)) continue; if ((y === 6 || y === 7) && (x <= 2 || x >= 13)) continue;
    if (Math.abs(x - ptx) + Math.abs(y - pty) < avoidPlayer) continue;
    if (rm.objs.some((o) => !o.s && !o.wall && o.t !== 'rug' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) continue;
    out.push([x, y]);
  }
  return out;
}
function shuffleRoom(rm) {
  // furniture that has moved between visits
  const chairs = rm.objs.filter((o) => o.t === 'chair' && !o.ex.bench);
  if (chairs.length && rnd() < 0.4) { const ch = pick(chairs); const ft = freeTiles(rm, 4); if (ft.length) { const [x, y] = pick(ft); ch.x = x; ch.y = y; ch.ex = { ...ch.ex, up: rnd() < 0.5 ? 1 : 0 }; computeGrid(rm); } }
  for (const o of rm.objs) if (o.creep && o.moves < 6 && rnd() < 0.45) { creepStep(o, true); }
}
function roomEvents(rm, first) {
  const id = rm.id;
  if (id === 'nursery') { G.boxOn = first || rnd() < 0.5; G.boxI = 0; G.boxT = 0.5; G.boxLit = 0; }
  else G.boxOn = false;
  if (first) {
    if (id === 'foyer') {}
    if (id === 'pantry') spawnCat(7, 8);
    if (id === 'attic') { setTimeout(() => { if (G.room === rm && G.state === 'play') { AU.footsAbove(); scare(0.5); } }, 1200); }
    if (id === 'master') addTimer(2.2, () => { AU.slam(0.6); G.shake = 0.3; scare(0.6); });
    if (id === 'wine') addTimer(3, () => { AU.footsAbove(); scare(0.4); });
    if (id === 'kennel') G.ents.push({ type: 'eyes', x: 188, y: 70, x2: 196, life: 9, t: 0, dog: 1, col: C.v3, growl: 1 });
    if (id === 'coal') G.ents.push({ type: 'eyes', x: 222, y: 186, x2: 229, life: 7, t: 0, dog: 1, col: C.v3, growl: 1 });
    if (id === 'breaker') showMsg('THE MAIN BREAKER IS ON THE FAR WALL.', 3);
    if (id === 'cstairs') showMsg('THE BASEMENT. THE AIR IS WET AND COLD.', 3);
  }
  if (id === 'dining' && !G.dragDone && (rm.enters >= 2 || G.playT > 50)) addTimer(1.6, () => startDrag() );
  if (id === 'gallery' && first) addTimer(4, () => { AU.whisper(-0.5); scare(0.3); });
  if (id === 'sewing' && first) addTimer(3, () => { AU.creak(0.3); });
}

// ---------- lighting ----------
const RANGE = 124, COS_IN = Math.cos(0.33), COS_OUT = Math.cos(0.5);
function computeLight() {
  const rm = G.room; const amb = rm.amb; const ox = P.x, oy = P.y - 7; const on = lightEff(); const inten = on ? G.flickInt : 0;
  const ca = Math.cos(P.ang), sa = Math.sin(P.ang); const fl = G.flash; const faint = G.hidden ? 0 : 1;
  for (let cy = 0; cy < LH; cy++) {
    const y = cy * 2 + 1, dy = y - oy;
    for (let cx = 0; cx < LW; cx++) {
      const i = cy * LW + cx; const x = cx * 2 + 1, dx = x - ox; const d2 = dx * dx + dy * dy;
      let L = amb[i];
      if (faint && d2 < 900) L += 0.62 * (1 - Math.sqrt(d2) / 30);
      if (inten > 0 && d2 < RANGE * RANGE) {
        const d = Math.sqrt(d2) + 0.001; const dot = (dx * ca + dy * sa) / d;
        if (dot > COS_OUT) { let e = (dot - COS_OUT) / (COS_IN - COS_OUT); if (e > 1) e = 1; L += inten * e * (0.35 + 1.1 * (1 - d / RANGE)); }
        if (d < 16) L += inten * 0.35;
      }
      if (fl > L) L = fl;
      LM[i] = L;
    }
  }
}
function lightAt(x, y) { const cx = clamp(x >> 1, 0, LW - 1), cy = clamp(y >> 1, 0, LH - 1); return LM[cy * LW + cx]; }
function beamAt(x, y) {
  if (!lightEff()) return 0; const dx = x - P.x, dy = y - (P.y - 7); const d = Math.hypot(dx, dy) + 0.001; if (d > RANGE) return 0;
  const dot = (dx * Math.cos(P.ang) + dy * Math.sin(P.ang)) / d; if (dot < COS_OUT + 0.02) return d < 18 ? 0.6 : 0; return 1 - d / RANGE * 0.5;
}

// ---------- pathing ----------
function bfs(sx, sy, goalFn, block) {
  const prev = new Int16Array(COLS * ROWS).fill(-1); const q = [sy * COLS + sx]; prev[q[0]] = q[0];
  while (q.length) {
    const c = q.shift(); const x = c % COLS, y = (c / COLS) | 0;
    if (goalFn(x, y)) { const path = []; let k = c; while (k !== sy * COLS + sx) { path.unshift(k); k = prev[k]; } return path; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue; const n = ny * COLS + nx;
      if (prev[n] !== -1 || G.room.grid[n] || (block && block(nx, ny))) continue; prev[n] = c; q.push(n);
    }
  }
  return null;
}

// ---------- creepers (statues, dress forms, dust sheets) ----------
function creepStep(o, offscreen) {
  const rm = G.room; const ptx = Math.floor(P.x / 16), pty = Math.floor(P.y / 16);
  if (Math.abs(o.x - ptx) + Math.abs(o.y - pty) <= 2) return false;
  rm.grid[o.y * COLS + o.x] = 0;
  const path = bfs(o.x, o.y, (x, y) => Math.abs(x - ptx) + Math.abs(y - pty) <= 1, (x, y) => (x === 7 || x === 8) && (y <= 2 || y >= 12) || (y === 6 || y === 7) && (x <= 1 || x >= 14) || (!offscreen && lightAt(x * 16 + 8, y * 16 - 4) > 0.4) || y < 2 || x < 1 || x > 14 || y > 12);
  let moved = false;
  if (path && path.length > 1) {
    const n = path[0]; const nx = n % COLS, ny = (n / COLS) | 0;
    if (!(nx === ptx && ny === pty) && Math.abs(nx - ptx) + Math.abs(ny - pty) >= 2 && !rm.objs.some((b) => b !== o && !b.wall && b.t !== 'rug' && nx >= b.x && nx < b.x + b.w && ny >= b.y && ny < b.y + b.h)) { o.x = nx; o.y = ny; moved = true; }
  }
  if (moved || offscreen) { o.moves++; o.v = o.moves >= 3 ? 'reach' : 'face'; }
  computeGrid(rm);
  return moved;
}
function updateCreepers(dt) {
  if (G.roomT < 2.5) return;
  for (const o of G.room.objs) {
    if (!o.creep) continue;
    const seen = lightAt(o.x * 16 + 8, o.y * 16 - 2) > 0.42 || lightAt(o.x * 16 + 8, o.y * 16 + 8) > 0.42;
    const d = Math.hypot(o.x * 16 + 8 - P.x, o.y * 16 + 8 - P.y);
    if (seen) { o.unseen = Math.max(0, o.unseen - dt * 2); continue; }
    if (d < 40 || o.moves >= 7) continue;
    o.unseen += dt * (G.flickOff ? 2.5 : 1);
    if (o.unseen > o.th) { o.unseen = 0; o.th = R(2.5, 6); if (creepStep(o, false)) { AU.scrape((o.x * 16 - P.x) / 128); G.tension = clamp(G.tension + 0.15, 0, 1.5); } }
  }
}

// ---------- ambient scares ----------
function spawnCat(tx, ty) { G.ents.push({ type: 'cat', x: tx * 16 + 8, y: ty * 16 + 12, st: 'sit', t: 0, lit: 0 }); }
function startDrag() {
  if (G.room.id !== 'dining' || G.dragDone || G.state !== 'play') return; G.dragDone = true;
  const ch = G.room.objs.find((o) => o.t === 'chair'); const row = Math.abs(P.y - 170) < 40 ? 4 : 10;
  ch.dragging = true; computeGrid(G.room);
  G.ents.push({ type: 'drag', x: 18, y: row * 16 + 12, ch, t: 0, row });
  if (G.room.windows.length) lightning(true); AU.scrape(-0.6); scare(0.8); AU.sting(false);
}
function spawnDart() {
  const side = rnd() < 0.5 ? -1 : 1; const d = R(55, 90); const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
  const cx = P.x + ca * d, cy = P.y - 7 + sa * d; const px = -sa * side, py = ca * side;
  G.ents.push({ type: 'dart', x: cx + px * 70, y: cy + py * 70, vx: -px * 330, vy: -py * 330, life: 0.45 }); AU.whoosh(side * 0.6); scare(0.5);
}
function lightning(force) {
  if (G.room.windows.length || force) { G.flashQ = [[0, 0.07], [0.16, 0.05], [0.34, 0.09]]; G.flashT = 0; AU.thunder(R(0.3, 0.9)); }
  else { AU.thunder(R(0.6, 1.4)); G.shake = 0.15; }
}
function ambientScare() {
  const rm = G.room; const pool = [['dart', 3], ['slam', 1.2], ['whisper', 1.2], ['creak', 1.4], ['bark', rm.f <= 1 ? 1 : 0.3], ['foot', rm.f < 2 || rm.id === 'attic' ? 1.4 : 0.6], ['cat', 0.6], ['eyes', 0.7]];
  let tot = pool.reduce((a, b) => a + b[1], 0), r = rnd() * tot, kind = 'dart'; for (const [k, w] of pool) { r -= w; if (r <= 0) { kind = k; break; } }
  if (kind === 'dart' && lightEff()) spawnDart();
  else if (kind === 'slam') { AU.slam(R(-1, 1)); G.shake = 0.3; scare(0.6); if (rnd() < 0.5) triggerFlicker(true); }
  else if (kind === 'whisper') { AU.whisper(R(-0.8, 0.8)); scare(0.4); }
  else if (kind === 'creak') { AU.creak(R(-1, 1)); scare(0.2); }
  else if (kind === 'bark') { AU.bark(R(-1, 1), true); scare(0.3); }
  else if (kind === 'foot') { AU.footsAbove(); scare(0.4); }
  else if (kind === 'cat') { const ft = freeTiles(rm, 5); if (ft.length) { const [x, y] = pick(ft); spawnCat(x, y); } }
  else if (kind === 'eyes') { const ft = freeTiles(rm, 6).filter(([x, y]) => lightAt(x * 16 + 8, y * 16 + 8) < 0.2); if (ft.length) { const [x, y] = pick(ft); G.ents.push({ type: 'eyes', x: x * 16 + 5, y: y * 16 + 4, x2: x * 16 + 11, life: R(3, 6), t: 0, col: C.y1 }); AU.whisper(0); scare(0.3); } }
  else if (lightEff()) spawnDart();
}
function triggerFlicker(black) {
  if (G.noFlicker) return;
  if (black) { G.blk = R(0.5, 2); onBlackout(); } else G.stut = R(0.2, 0.6);
}
function onBlackout() {
  if (G.noThreat || G.threat || G.hidden || SAFE.has(G.room.id) || G.state !== 'play') return;
  if (G.playT < G.threatNext) return;
  if (G.threatFirst && rnd() > 0.65) { G.threatNext = G.playT + R(10, 25); return; }
  spawnThreat();
}
function spawnThreat() {
  const rm = G.room; const ft = freeTiles(rm, 6); if (!ft.length) return;
  ft.sort((a, b) => Math.hypot(b[0] * 16 - P.x, b[1] * 16 - P.y) - Math.hypot(a[0] * 16 - P.x, a[1] * 16 - P.y));
  const [x, y] = ft[Math.floor(rnd() * Math.min(5, ft.length))];
  G.threat = { room: rm.id, x: x * 16 + 8, y: y * 16 + 12, burn: 0, life: 0, f: 0, fade: 0, hid: 0 };
  G.blk = Math.max(G.blk, 1.3); AU.appear(); scare(1);
  if (!G.threatFirst) { G.threatFirst = true; addTimer(1.4, () => showMsg('SOMETHING TALL IS IN THE ROOM. KEEP YOUR LIGHT ON IT - OR HIDE IN A WARDROBE.', 5) ); }
}
function updateThreat(dt) {
  const T = G.threat; if (!T) return;
  T.life += dt; T.f += dt;
  if (T.fade > 0) { T.fade += dt; if (T.fade > 0.6) { G.threat = null; } return; }
  const dx = P.x - T.x, dy = P.y - T.y; const d = Math.hypot(dx, dy);
  if (G.hidden) { T.hid += dt; T.x += Math.sin(T.life * 0.9) * 10 * dt; if (T.hid > 4.5) { T.fade = 0.01; G.threatNext = G.playT + R(50, 80); setTimeout(() => G.state === 'play' && showMsg('IT IS GONE. FOR NOW.', 2.5), 600); } return; }
  const lit = beamAt(T.x, T.y - 18) > 0.3 || beamAt(T.x, T.y - 6) > 0.3 || G.flash > 0.5;
  if (lit) { T.burn += dt; if (T.burn > 1.1) { T.fade = 0.01; AU.hiss(); scare(0.3); G.threatNext = G.playT + R(45, 80); if (!G.repelMsg) { G.repelMsg = 1; showMsg('IT SHRANK FROM THE LIGHT.', 2.5); } } return; }
  T.burn = Math.max(0, T.burn - dt * 0.5);
  const sp = lightEff() ? 10 : 30;
  if (d > 1) { T.x = clamp(T.x + dx / d * sp * dt, 20, VW - 20); T.y = clamp(T.y + dy / d * sp * dt, 40, VH - 20); } // it glides through furniture
  if (d < 10) caught();
  if (T.life > 45) { T.fade = 0.01; G.threatNext = G.playT + R(40, 70); }
}
function caught() { G.state = 'caught'; G.et = 0; G.threat = null; G.catches++; AU.sting(true); AU.noise(1.2, 0.3, 2000, 'bandpass', 0, 0.5); G.blk = 0; }
function respawn() {
  const c = G.check; G.state = 'play'; G.hidden = null; G.threat = null; G.ents = []; G.blk = 0; G.stut = 0; G.lightUser = true; G.battery = Math.max(G.battery, 0.5); G.threatNext = G.playT + R(35, 55); G.msg = null;
  enterRoom(c.room, 'pos', { x: c.x, y: c.y }); showMsg('YOU WAKE ON THE STAIRS, HEART POUNDING.', 3);
}

// ---------- entities ----------
function updateEnts(dt) {
  for (const e of G.ents) e.t = (e.t || 0) + dt;
  G.ents = G.ents.filter((e) => {
    if (e.type === 'timer') return entTimer(e);
    if (e.type === 'dart') { e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt; return e.life > 0; }
    if (e.type === 'cat') return entCat(e, dt);
    if (e.type === 'eyes') { const lit = lightAt(e.x + 3, e.y) > 0.38; if (e.growl && e.t > 0.3 && !e.g) { e.g = 1; AU.growl((e.x - P.x) / 128); scare(0.5); } if (lit && e.t > 0.15) { if (e.dog) { AU.bark(R(-1, 1), true); } return false; } return e.t < e.life; }
    if (e.type === 'drag') return entDrag(e, dt);
    return true;
  });
}
function entTimer(e) { if (e.t >= e.tFire) { e.fn(); return false; } return true; }
function entCat(e, dt) {
  const d = Math.hypot(P.x - e.x, P.y - e.y);
  if (e.st === 'sit') { if (lightAt(e.x, e.y - 4) > 0.5) e.lit += dt; if (d < 52 || e.lit > 0.35 || e.t > 12) { e.st = 'run'; AU.screech(); scare(0.8); G.tension += 0.2; const ex = e.x < P.x ? -1 : 1; e.vx = ex * 190; e.vy = R(-40, 40); e.t = 0; } return true; }
  e.x += e.vx * dt; e.y += e.vy * dt; if (e.y < 40 || e.y > 200) e.vy *= -1; return e.t < 1.3 && e.x > -16 && e.x < VW + 16;
}
function entDrag(e, dt) {
  e.x += 46 * dt; e.ch.px = e.x - 18; e.ch.py = e.y - 12;
  if ((e.st = (e.st || 0) + dt) > 0.45) { e.st = 0; AU.scrape(clamp((e.x - P.x) / 128, -1, 1)); }
  if (e.x > 13 * 16 + 8 || e.t > 6) {
    const tx = clamp(Math.round((e.x - 26) / 16), 2, 12); e.ch.x = tx; e.ch.y = e.row; e.ch.dragging = false; e.ch.px = undefined; e.ch.py = undefined; e.ch.ex = { ...e.ch.ex, up: 0 };
    if (Math.abs(tx - Math.floor(P.x / 16)) + Math.abs(e.row - Math.floor(P.y / 16)) < 1) e.ch.x = clamp(tx - 1, 2, 12);
    computeGrid(G.room); G.blk = Math.max(G.blk, 0.6); return false;
  }
  return true;
}
function addTimer(t, fn) { G.ents.push({ type: 'timer', t: 0, tFire: t, fn }); }

// ---------- interaction ----------
function objRect(o) {
  if (o.t === 'frontdoor') return [o.x * 16, 196, 32, 28];
  if (o.wall) return [o.x * 16, 0, o.w * 16, 44];
  return [o.x * 16 - 3, o.y * 16 - 3, o.w * 16 + 6, o.h * 16 + 6];
}
function findTarget() {
  const fx = P.x + Math.cos(P.ang) * 11, fy = P.y - 2 + Math.sin(P.ang) * 11; let best = null, bd = 1e9;
  for (const o of G.room.objs) {
    if (o.taken || o.t === 'rug') continue; if (!o.wall && !OT[o.t].t && !o.it && o.t !== 'note' && o.t !== 'stairs') continue;
    if (o.t === 'stairs' && !o.locked) continue;
    const [x, y, w, h] = objRect(o);
    const inF = fx >= x && fx < x + w && fy >= y && fy < y + h; const inP = P.x >= x && P.x < x + w && P.y >= y && P.y < y + h;
    if (!inF && !inP) continue;
    const d = Math.hypot(x + w / 2 - fx, y + h / 2 - fy) - (inF ? 100 : 0); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function give(it) {
  if (it === 'battery') { G.battery = Math.min(1, G.battery + 0.5); AU.battery(); G.deadMsg = false; showMsg(ITEMS.battery.msg, 2.2); return; }
  G.inv[it] = 1; AU.pickup(); showMsg(ITEMS[it].msg, 4);
  if (it === 'key') { G.threatNext = Math.min(G.threatNext, G.playT + 12); }
}
function interact() {
  if (G.hidden) { unhide(); return; }
  const o = findTarget();
  if (!o) { if (G.msg) G.msg = null; return; }
  if (o.t === 'item') { o.taken = 1; give(o.it); return; }
  if (o.t === 'note') { showMsg(o.ex.text, 7); AU.click(); return; }
  if (o.t === 'desk' && o.it && !o.taken) { o.taken = 1; o.it2 = o.it; give(o.it); o.it = null; return; }
  if (o.t === 'wardrobe') { hide(o); return; }
  if (o.t === 'stairs' && o.locked && !o.open) { tryUnlock(o); return; }
  if (o.t === 'breaker') { useBreaker(o); return; }
  if (o.t === 'portrait') { showMsg(o.ex.master ? 'THE MASTER OF THE HOUSE. HIS EYES ARE PAINTED SHUT. THEY WERE OPEN A MOMENT AGO.' : OT.portrait.t, 4); return; }
  const t = OT[o.t].t; if (t) { showMsg(t, 3.5); if (o.creep && o.v !== 'away') { AU.tone(70, 0.5, 'triangle', 0.08); } }
}
function tryUnlock(o) {
  if (G.inv.key) { o.open = true; o.locked = false; o.s = false; o.vkey = 'open'; computeGrid(G.room); AU.creak(0); AU.clunk(); showMsg('THE KEY TURNS. THE CELLAR DOOR GROANS OPEN. STAIRS LEAD DOWN.', 3.5); }
  else { AU.locked(); if (!G.msg || G.lockMsgT < G.t) { showMsg('A TRAPDOOR TO THE CELLAR, PADLOCKED. THE KEY MUST BE SOMEWHERE.', 3.5); G.lockMsgT = G.t + 4; } }
}
function useBreaker(o) {
  const inst = []; if (G.inv.handle && !G.installed.handle) { G.installed.handle = 1; inst.push('HANDLE'); } if (G.inv.fuse && !G.installed.fuse) { G.installed.fuse = 1; inst.push('FUSE'); }
  o.handle = G.installed.handle; o.fuse = G.installed.fuse; o.vkey = '' + o.handle + o.fuse;
  if (inst.length) AU.clunk();
  if (G.installed.handle && G.installed.fuse) { startEnding(o); return; }
  const miss = []; if (!G.installed.handle) miss.push('ITS HANDLE IS MISSING'); if (!G.installed.fuse) miss.push('THE MAIN FUSE SOCKET IS EMPTY');
  showMsg((inst.length ? 'YOU FIT THE ' + inst.join(' AND ') + '. ' : 'THE MAIN BREAKER. ') + miss.join(' AND ') + '.', 4.5);
  G.breakerSeen = 1;
}
function hide(o) { G.hidden = o; G.hideSave = { x: P.x, y: P.y }; AU.creak(0); AU.tone(110, 0.15, 'triangle', 0.1); showMsg('YOU SQUEEZE INTO THE WARDROBE. (E TO LEAVE)', 3); }
function unhide() { G.hidden = null; AU.creak(0); }

// ---------- player update ----------
const keys = new Set(); const pressed = new Set();
function inputVec() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) x -= 1; if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) x += 1;
  if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) y -= 1; if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) y += 1;
  if (BOT && G.bot) { x = G.bot.x; y = G.bot.y; }
  return [x, y];
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function updatePlayer(dt) {
  if (G.hidden) return;
  const [ix, iy] = inputVec(); P.moving = !!(ix || iy);
  if (P.moving) {
    const ta = Math.atan2(iy, ix); P.ang += angDiff(P.ang, ta) * Math.min(1, dt * 16);
    P.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'right' : 'left') : (iy > 0 ? 'down' : 'up');
    if (Math.abs(ix) && Math.abs(iy)) P.dir = iy > 0 ? 'down' : 'up';
    const n = Math.hypot(ix, iy); const sp = 54; const mx = ix / n * sp * dt, my = iy / n * sp * dt;
    if (boxFree(P.x + mx, P.y)) P.x += mx; else if (!iy) { for (const o of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) if (boxFree(P.x + mx, P.y + o)) { P.y += Math.sign(o) * Math.min(1, sp * dt); break; } }
    if (boxFree(P.x, P.y + my)) P.y += my; else if (!ix) { for (const o of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) if (boxFree(P.x + o, P.y + my)) { P.x += Math.sign(o) * Math.min(1, sp * dt); break; } }
    P.walk += dt * 7; G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.29; G.stepAlt = !G.stepAlt; AU.step(G.room.fl.startsWith('carpet') ? 'carpet' : G.room.fl, G.stepAlt); }
  } else P.walk = 0;
  // locked stairs bump
  for (const o of G.room.objs) if (o.t === 'stairs' && o.locked && !o.open) { const [x, y, w, h] = objRect(o); if (P.x > x && P.x < x + w && P.y > y && P.y < y + h + 4) { if (G.inv.key) tryUnlock(o); } }
  // exits
  const rm = G.room;
  if (P.x < 3 && rm.doors.W) return enterRoom(rm.doors.W, 'door', { dir: 'W' });
  if (P.x > VW - 3 && rm.doors.E) return enterRoom(rm.doors.E, 'door', { dir: 'E' });
  if (P.y < 8 && rm.doors.N) return enterRoom(rm.doors.N, 'door', { dir: 'N' });
  if (P.y > VH - 3 && rm.doors.S) return enterRoom(rm.doors.S, 'door', { dir: 'S' });
  // stairs
  for (const o of rm.objs) if (o.t === 'stairs' && o.open) { const x = o.x * 16 + 3, y = o.y * 16 + 2, w = o.w * 16 - 6, h = o.h * 16 - 6; if (P.x > x && P.x < x + w && P.y > y && P.y < y + h) { AU.stairs(); const from = rm.id; enterRoom(o.to, 'stairs', { from }); showMsg(FLOORNAME[G.room.f] + ' - ' + G.room.n, 2); return; } }
  // floor items
  for (const o of rm.objs) if (o.t === 'item' && !o.taken && Math.hypot(o.x * 16 + 8 - P.x, o.y * 16 + 10 - P.y) < 11) { o.taken = 1; give(o.it); }
}
function updateFlicker(dt) {
  G.flickInt = 0.93 + Math.sin(G.t * 31) * 0.03 + rnd() * 0.04;
  if (G.noFlicker) { G.flickOff = false; return; }
  if (G.blk > 0) { G.blk -= dt; G.flickOff = true; if (G.blk <= 0) { G.flickOff = false; AU.click(); } return; }
  if (G.stut > 0) { G.stut -= dt; if ((G.sflip = (G.sflip || 0) - dt) <= 0) { G.sflip = R(0.03, 0.09); G.flickOff = !G.flickOff; } if (G.stut <= 0) G.flickOff = false; return; }
  G.flickOff = false;
  if (!G.lightUser || G.battery <= 0) return;
  const p = 0.035 + G.tension * 0.12 + (G.battery < 0.25 ? 0.12 : 0) + (G.battery < 0.1 ? 0.25 : 0) + (G.threat ? 0.15 : 0);
  if (rnd() < p * dt) { if (rnd() < 0.3 + (G.playT > G.threatNext ? 0.25 : 0)) { G.blk = R(0.5, 2); AU.click(); onBlackout(); } else G.stut = R(0.2, 0.55); }
}
function updatePlay(dt) {
  G.playT += dt; G.roomT += dt; G.tension = Math.max(0, G.tension - dt * 0.04);
  if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
  if (pressed.has('light')) { if (G.battery <= 0) { AU.click(); showMsg('THE BATTERY IS DEAD.', 2); } else { G.lightUser = !G.lightUser; AU.click(); } }
  if (pressed.has('use')) interact();
  if (pressed.has('map')) G.map = !G.map;
  updatePlayer(dt); if (G.state !== 'play') return;
  if (lightEff()) { G.battery = Math.max(0, G.battery - dt / 190); if (G.battery <= 0 && !G.deadMsg) { G.deadMsg = true; showMsg('THE FLASHLIGHT DIES. FIND BATTERIES.', 3); AU.tone(300, 0.3, 'square', 0.05, 0, 80); } }
  if (!lightEff() && !G.hidden) { G.lightOffT += dt; if (G.lightOffT > 2 && G.playT > G.threatNext && !G.threat) { G.lightOffT = 0; if (rnd() < 0.5) onBlackout(); } } else G.lightOffT = 0;
  updateFlicker(dt);
  // flashes
  if (G.flashQ.length) { G.flashT += dt; G.flash = 0; for (const [s, d] of G.flashQ) if (G.flashT >= s && G.flashT < s + d) G.flash = 1.3; if (G.flashT > 0.6) { G.flashQ = []; G.flash = 0; } } else G.flash = 0;
  G.nextLightning -= dt; if (G.nextLightning <= 0) { G.nextLightning = R(18, 45); lightning(false); }
  computeLight();
  updateCreepers(dt); updateThreat(dt); updateEnts(dt);
  if (G.state !== 'play') return;
  G.quiet += dt; if (G.quiet > G.nextAmbient && G.roomT > 3 && !G.threat) { G.quiet = 0; G.nextAmbient = R(16, 36); ambientScare(); }
  // threat overdue -> force a blackout
  if (!G.threat && !G.noThreat && G.playT > G.threatNext + 40 && !SAFE.has(G.room.id) && G.roomT > 4 && lightEff()) { G.blk = R(1, 1.8); onBlackout(); }
  // nursery music box + rocker
  if (G.room.id === 'nursery') {
    const mb = G.room.objs.find((o) => o.t === 'musicbox'); const rk = G.room.objs.find((o) => o.t === 'rocker');
    if (G.boxOn) { G.boxT -= dt; if (G.boxT <= 0) { G.boxT = 0.38; AU.boxNote(G.boxI++); } if (lightAt(mb.x * 16 + 8, mb.y * 16 - 2) > 0.5) { G.boxLit += dt; if (G.boxLit > 1.2) { G.boxOn = false; AU.whisper(-0.4); scare(0.5); } } }
    const rlit = lightAt(rk.x * 16 + 8, rk.y * 16) > 0.5; G.rockLit = rlit ? G.rockLit + dt : Math.max(0, G.rockLit - dt * 0.5);
    const amp = clamp(1 - G.rockLit, 0, 1); G.rockPh = (G.rockPh || 0) + dt * 4.2 * (0.3 + amp * 0.7); G.rockAmp = amp;
    if (amp > 0.3 && Math.floor(G.rockPh / Math.PI) !== G.rockLast) { G.rockLast = Math.floor(G.rockPh / Math.PI); if (G.rockLast % 2 === 0) AU.creak((rk.x * 16 - P.x) / 128); }
  }
  // heartbeat + motif
  if (G.threat && !G.threat.fade) { const d = Math.hypot(P.x - G.threat.x, P.y - G.threat.y); G.beatT -= dt; if (G.beatT <= 0) { G.beatT = clamp(d / 160, 0.33, 1.05); AU.thump(clamp(0.7 - d / 400, 0.2, 0.7)); } }
  else if (G.tension > 0.8) { G.beatT -= dt; if (G.beatT <= 0) { G.beatT = 0.8; AU.thump(0.2); } }
  G.motifT -= dt; if (G.motifT <= 0) { G.motifT = R(1.2, 2.4); AU.motif(G.motifI++); }
  if (G.room.id === 'cistern' && rnd() < dt * 0.7) AU.drip(R(-0.6, 0.6));
  if (G.room.id === 'foyer' || G.room.id === 'dining' || G.room.id === 'parlor') { if ((G.tickT = (G.tickT || 0) - dt) <= 0) { G.tickT = 1; AU.tick(G.tickA = !G.tickA); } }
  if (G.shake > 0) G.shake -= dt;
}

// ---------- rendering ----------
function drawSpr(g, o, frame) { const s = sprOf(o, frame); if (!s) return; const x = (o.px !== undefined ? o.px : o.x * 16) + s.ox; const y = (o.py !== undefined ? o.py : o.y * 16) + s.oy; g.drawImage(s.c, Math.round(x), Math.round(y)); }
function drawRoom(rm, opt = {}) {
  const g = sc; g.drawImage(rm.static, 0, 0); if (!opt.lit && rm.moon) g.drawImage(rm.moon, 0, 0);
  // wall objects + floor-level
  for (const o of rm.objs) {
    if (o.t === 'rug' || o.taken && o.t !== 'desk') continue;
    if (o.t === 'window') { drawSpr(g, o, G.flash > 0.5 ? 1 : 0); continue; }
    if (o.wall && o.t !== 'frontdoor') {
      drawSpr(g, o, 0);
      if (o.t === 'portrait') { const ex = clamp(Math.round((P.x - (o.x * 16 + 8)) / 60), -1, 1), ey = P.y > 60 ? 1 : 0; const bx = o.x * 16 + 2; g.fillStyle = o.ex.master && !opt.lit ? C.n5 : C.K; if (!(o.ex.master && !opt.lit && rnd() < 0.0)) { g.fillRect(bx + 6 + (ex > 0 ? 1 : 0), 9 + ey, 1, 1); g.fillRect(bx + 9 + (ex >= 0 ? 1 : 0), 9 + ey, 1, 1); } }
      continue;
    }
    if (o.t === 'stairs') { drawSpr(g, o, 0); continue; }
    if (o.t === 'note') { g.drawImage(ART.note, o.x * 16, o.y * 16 + 2); continue; }
    if (o.t === 'item') { g.drawImage(ART.item[o.it], o.x * 16, o.y * 16 + 2 + (Math.sin(G.t * 3) > 0.6 ? -1 : 0)); continue; }
  }
  // sorted objects and actors
  const L = [];
  for (const o of rm.objs) {
    if (o.t === 'rug' || o.t === 'stairs' || o.t === 'note' || o.t === 'item' || o.wall) continue;
    const by = (o.py !== undefined ? o.py + 16 : (o.y + o.h) * 16);
    L.push([by, () => {
      if (o.creep) { const a = ART[o.t][o.v]; g.drawImage(a, o.x * 16, o.y * 16 - 16 + 1); return; }
      if (o.t === 'rocker' && rm.id === 'nursery') { const ph = Math.sin(G.rockPh || 0) * (G.rockAmp === undefined ? 1 : G.rockAmp); const s = sprOf(o, 0); g.drawImage(s.c, o.x * 16 + Math.round(ph * 1.5), o.y * 16 + s.oy + (Math.abs(ph) > 0.6 ? 1 : 0)); return; }
      if (o.t === 'hang') { drawSpr(g, o, (G.t * 0.8 | 0) & 1); return; }
      if (o.t === 'desk' && o.it && !opt.lit) { drawSpr(g, o, 0); g.drawImage(ART.item[o.it], o.x * 16 + 14, o.y * 16 - 10); return; }
      drawSpr(g, o, 0);
    }]);
  }
  if (!opt.noPlayer && !G.hidden) L.push([P.y + 2, () => { const f = P.moving ? Math.floor(P.walk) % 4 : 0; g.drawImage(ART.player[P.dir + f], Math.round(P.x - 8), Math.round(P.y - 14)); }]);
  const T = G.threat; if (T && !opt.noPlayer && T.room === rm.id && !(T.fade && (G.t * 30 | 0) % 2)) L.push([T.y, () => { const tf = ART.tall[(T.f * 2 | 0) % 2]; g.drawImage(tf, Math.round(T.x - 8 + (T.burn > 0 ? (rnd() * 3 | 0) - 1 : 0)), Math.round(T.y - 38)); }]);
  for (const e of G.ents) {
    if (e.type === 'cat') L.push([e.y, () => { if (e.st === 'sit') g.drawImage(ART.catSit, Math.round(e.x - 6), Math.round(e.y - 9)); else { const c = ART.cat[(e.t * 12 | 0) % 2]; if (e.vx < 0) g.drawImage(c, Math.round(e.x - 8), Math.round(e.y - 7)); else g.drawImage(mirror(c), Math.round(e.x - 8), Math.round(e.y - 7)); } }]);
    if (e.type === 'drag') L.push([e.y + 1, () => { g.drawImage(ART.shadow[(e.t * 4 | 0) % 2], Math.round(e.x - 8), Math.round(e.y - 27)); }]);
  }
  L.sort((a, b) => a[0] - b[0]); for (const [, f] of L) f();
  for (const e of G.ents) if (e.type === 'dart') g.drawImage(ART.dart, Math.round(e.x - 12), Math.round(e.y - 8));
  for (const o of rm.objs) if (o.t === 'frontdoor') drawSpr(g, o, 0);
}
function applyDarkness() {
  const id = sc.getImageData(0, 0, VW, VH); const u = new Uint32Array(id.data.buffer);
  for (let y = 0; y < VH; y++) {
    const ly = (y >> 1) * LW, by = (y & 3) << 2;
    for (let x = 0; x < VW; x++) {
      const L = LM[ly + (x >> 1)]; if (L >= 0.98) continue; const i = y * VW + x; const t = BAY[by + (x & 3)];
      if (L > 0.62 + 0.36 * t) continue;
      const p = u[i];
      if (L > 0.24 + 0.34 * t) { let d = DK1.get(p); if (d === undefined) { darkPair(p); d = DK1.get(p); } u[i] = d; }
      else if (L > 0.05 + 0.17 * t) { let d = DK2.get(p); if (d === undefined) { darkPair(p); d = DK2.get(p); } u[i] = d; }
      else u[i] = 0xff000000;
    }
  }
  sc.putImageData(id, 0, 0);
}
function postGlow() {
  const g = sc;
  // item glints so pickups are findable in the dark
  for (const o of G.room.objs) {
    const isIt = (o.t === 'item' && !o.taken) || (o.t === 'desk' && o.it) || o.t === 'note';
    if (!isIt) continue; const ph = (G.t * 0.9 + o.x * 0.37 + o.y * 0.11) % 1.6;
    if (ph < 0.22) { const cx = o.x * 16 + 8 + (o.t === 'desk' ? 14 : 0), cy = o.y * 16 + 8 + (o.t === 'desk' ? -6 : 0); const s = ph < 0.11 ? 1 : 2; g.fillStyle = o.t === 'note' ? C.g3 : C.g5; g.fillRect(cx, cy - s, 1, s * 2 + 1); g.fillRect(cx - s, cy, s * 2 + 1, 1); }
  }
  // eyes in the dark
  for (const e of G.ents) {
    if (e.type === 'eyes') { if ((e.t % 3.1) > 2.95) continue; g.fillStyle = e.col; g.fillRect(e.x, e.y, 2, 1); g.fillRect(e.x2, e.y, 2, 1); }
    if (e.type === 'cat' && e.st === 'sit' && lightAt(e.x, e.y - 5) < 0.5) { g.fillStyle = C.y0; g.fillRect(Math.round(e.x - 4), Math.round(e.y - 7), 1, 1); g.fillRect(Math.round(e.x - 2), Math.round(e.y - 7), 1, 1); }
  }
  const T = G.threat; if (T && !T.fade && T.room === G.room.id && (G.t % 4) < 3.8) { g.fillStyle = C.g5; g.fillRect(Math.round(T.x - 2), Math.round(T.y - 33), 1, 1); g.fillRect(Math.round(T.x + 1), Math.round(T.y - 33), 1, 1); }
  // the master's portrait eyes glint now and then
  for (const o of G.room.objs) if (o.t === 'portrait' && ((G.t + o.x) % 7) < 0.15) { g.fillStyle = C.r0; g.fillRect(o.x * 16 + 8, 11, 1, 1); g.fillRect(o.x * 16 + 11, 11, 1, 1); }
}
const preDark = mk(VW, VH);
function drawHidden() {
  const g = sc; const w = G.hidden; const cx = (w.x + 1) * 16; const wb = Math.min(VH - 40, (w.y + w.h) * 16);
  const crack = mk(4, VH - wb); crack.getContext('2d').drawImage(preDark, cx - 2, wb, 4, VH - wb, 0, 0, 4, VH - wb);
  g.fillStyle = C.K; g.fillRect(0, 0, VW, VH);
  // door panels, faintly lit from the crack
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) { const d = Math.abs(x - 128); const L = 0.55 - d / 190 + (Math.sin(y * 0.05) * 0.03); if (L > BAY[(y & 3) * 4 + (x & 3)]) { g.fillStyle = (x % 40 === 0 || (y % 60) === 0) ? C.K : (d < 40 ? C.n0 : C.nd); g.fillRect(x, y, 1, 1); } }
  // coats on hangers
  [[34, 1], [80, 0], [168, 0], [206, 1]].forEach(([x, k]) => { g.fillStyle = C.g2; g.fillRect(x + 18, 8, 2, 6); g.fillRect(x + 10, 13, 18, 1); g.fillStyle = C.K; g.fillRect(x + 6, 14, 26, 6); g.fillRect(x + 2, 20, 34, 110 + k * 20); g.fillRect(x + 6, 130 + k * 20, 26, 14); g.fillStyle = C.g1; const side = x < 128 ? x + 35 : x + 2; g.fillRect(side, 22, 1, 100 + k * 20); });
  g.fillStyle = C.g1; g.fillRect(0, 12, VW, 1);
  // the crack: a thin sliver of the room
  g.fillStyle = C.K; g.fillRect(120, 0, 16, VH); g.drawImage(crack, 0, 0, 4, VH - wb, 125, 0, 6, VH);
  g.fillStyle = C.K; for (let y = 0; y < VH; y += 2) g.fillRect(125 + ((y >> 1) & 1) * 5, y, 1, 1);
  g.fillStyle = C.n1; g.fillRect(123, 0, 2, VH); g.fillRect(131, 0, 2, VH);
  const T = G.threat; if (T && !T.fade) { const near = Math.abs(T.x - cx) < 16; if (near) { g.fillStyle = C.K; g.fillRect(125, 0, 6, VH); g.fillStyle = C.g5; g.fillRect(126, 92, 1, 1); g.fillRect(129, 92, 1, 1); } }
  txtC(g, 'HIDING. E TO LEAVE', 128, 206, C.g3);
}
function drawHUD(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 16); g.fillStyle = C.g2; g.fillRect(0, 15, 256, 1);
  // battery
  g.fillStyle = C.g4; g.fillRect(3, 4, 22, 8); g.fillStyle = C.K; g.fillRect(4, 5, 20, 6); g.fillStyle = C.g4; g.fillRect(25, 6, 2, 4);
  const b = G.battery; g.fillStyle = b > 0.5 ? C.v2 : b > 0.25 ? C.y0 : C.r0; if (!(b < 0.15 && (G.t * 4 | 0) % 2)) g.fillRect(5, 6, Math.ceil(18 * b), 4);
  // flashlight state
  const on = G.lightUser && b > 0; g.fillStyle = on ? C.y1 : C.g2; g.fillRect(30, 6, 6, 4); g.fillRect(36, 5, 2, 6); if (on && !G.flickOff) { g.fillStyle = C.y0; g.fillRect(39, 4, 1, 1); g.fillRect(39, 11, 1, 1); g.fillRect(40, 7, 2, 2); }
  // items
  ['key', 'handle', 'fuse'].forEach((k, i) => { const x = 44 + i * 15; g.fillStyle = C.g1; g.fillRect(x, 1, 14, 14); if (G.inv[k]) g.drawImage(ART.icon[k], x - 1, 0); else { g.fillStyle = C.g2; g.fillRect(x + 6, 6, 2, 4); } });
  txt(g, G.room ? G.room.n : '', 92, 5, C.g4);
  if (G.room) { txt(g, FLOORNAME[G.room.f], 206, 5, C.y1); drawMini(g, 224, 2, G.room.f, 5, 3); }
  if (AU.muted) { g.fillStyle = C.r0; g.fillRect(250, 2, 4, 4); }
}
function drawMini(g, x0, y0, f, cw, ch) {
  for (const id in ROOMS) { const r = ROOMS[id]; if (r.f !== f) continue; const x = x0 + r.gx * (cw + 1), y = y0 + r.gy * (ch + 1);
    if (r === G.room) { g.fillStyle = (G.t * 3 | 0) % 2 ? C.y0 : C.g5; g.fillRect(x, y, cw, ch); } else if (r.visited) { g.fillStyle = C.g3; g.fillRect(x, y, cw, ch); } else { g.fillStyle = C.g1; g.fillRect(x, y, cw, ch); } }
}
function drawMap(g, f, litN) {
  g.fillStyle = C.K; g.fillRect(16, 26, 224, 196); g.fillStyle = C.g3; g.fillRect(16, 26, 224, 1); g.fillRect(16, 221, 224, 1); g.fillRect(16, 26, 1, 196); g.fillRect(239, 26, 1, 196);
  const titles = ['BASEMENT', 'GROUND FLOOR', 'SECOND FLOOR'];
  txtC(g, (litN === undefined ? 'MAP - ' : '') + FLOORNAME[f] + ' ' + titles[f], 128, 32, C.y1);
  const cw = 46, ch = 46, gap = 6, x0 = 128 - (4 * cw + 3 * gap) / 2, y0 = 48;
  let k = 0;
  for (const id in ROOMS) { const r = ROOMS[id]; if (r.f !== f) continue;
    const x = x0 + r.gx * (cw + gap), y = y0 + r.gy * (ch + gap); const lit = litN !== undefined && k++ < litN;
    const known = r.visited || lit || Object.values(r.doors).some((d) => ROOMS[d].visited);
    if (!known) continue;
    for (const d in r.doors) { if (!r.visited && !ROOMS[r.doors[d]].visited && !lit) continue; g.fillStyle = C.g3; if (d === 'E') g.fillRect(x + cw, y + ch / 2 - 3, gap, 6); if (d === 'S') g.fillRect(x + cw / 2 - 3, y + ch, 6, gap); }
    if (lit) { g.fillStyle = C.y1; g.fillRect(x, y, cw, ch); g.fillStyle = C.y0; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); txtC(g, r.sn, x + cw / 2, y + 20, C.n1); continue; }
    if (r.visited) { g.fillStyle = C.g2; g.fillRect(x, y, cw, ch); g.fillStyle = C.g1; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); txtC(g, r.sn, x + cw / 2, y + 20, C.g4); }
    else { g.fillStyle = C.g2; for (let i = 0; i < cw; i += 4) { g.fillRect(x + i, y, 2, 1); g.fillRect(x + i, y + ch - 1, 2, 1); } for (let i = 0; i < ch; i += 4) { g.fillRect(x, y + i, 1, 2); g.fillRect(x + cw - 1, y + i, 1, 2); } txtC(g, '?', x + cw / 2, y + 20, C.g2); }
    const st = r.objs.length ? r.objs.find((o) => o.t === 'stairs') : (r.o.find((o) => o[0] === 'stairs') && { dir: r.o.find((o) => o[0] === 'stairs')[3].dir });
    if (r.visited && st) txt(g, st.dir === 'up' ? '^' : '_', x + 3, y + 3, C.b2);
    if (r.visited && id === 'breaker') txt(g, '*', x + cw - 8, y + 3, C.r1);
    if (r === G.room && litN === undefined && (G.t * 3 | 0) % 2) { g.fillStyle = C.y0; g.fillRect(x, y, cw, 2); g.fillRect(x, y + ch - 2, cw, 2); g.fillRect(x, y, 2, ch); g.fillRect(x + cw - 2, y, 2, ch); }
  }
  if (litN === undefined) txtC(g, 'M - CLOSE', 128, 208, C.g3);
}
function drawMsg(g) {
  if (!G.msg) return; const n = G.msg.lines.length; const h = n * 9 + 8; const y = 240 - h - 4;
  g.fillStyle = C.K; g.fillRect(4, y, 248, h); g.fillStyle = C.g4; g.fillRect(4, y, 248, 1); g.fillRect(4, y + h - 1, 248, 1); g.fillRect(4, y, 1, h); g.fillRect(251, y, 1, h);
  G.msg.lines.forEach((l, i) => txt(g, l, 9, y + 5 + i * 9, C.g5));
}
function drawTitle(g) {
  const t = G.titleT; const fl = (t % 9) > 8.6 && ((t * 20 | 0) % 3 !== 0);
  g.fillStyle = fl ? C.b5 : C.K; g.fillRect(0, 0, 256, 240);
  if (!fl) { g.fillStyle = C.bd; for (let y = 0; y < 150; y++) for (let x = (y & 1); x < 256; x += 2) if (BAY[(y & 3) * 4 + (x & 3)] < 0.6 - y / 260) g.fillRect(x, y, 1, 1); }
  g.fillStyle = fl ? C.g5 : C.g4; g.fillRect(206, 62, 18, 18); g.fillRect(204, 65, 22, 12); g.fillRect(209, 60, 12, 22); g.fillStyle = fl ? C.b5 : C.g3; g.fillRect(210, 66, 5, 5); g.fillRect(218, 72, 3, 3); g.fillRect(212, 75, 2, 2);
  // manor silhouette
  g.fillStyle = C.K; const base = 196;
  g.fillRect(40, 120, 176, base - 120); g.fillRect(28, 140, 200, base - 140); g.fillRect(96, 92, 64, 40); g.fillRect(118, 66, 20, 30);
  for (let i = 0; i < 32; i++) g.fillRect(96 + i, 92 - Math.floor(i * 0.5), 64 - i * 2, 1);
  for (let i = 0; i < 22; i++) { g.fillRect(40 + i, 120 - i, 50 - i * 2 > 0 ? 50 - i * 2 : 1, 1); g.fillRect(166 + i, 120 - i, 50 - i * 2 > 0 ? 50 - i * 2 : 1, 1); }
  g.fillRect(60, 96, 6, 14); g.fillRect(186, 96, 6, 14); g.fillRect(126, 58, 4, 10);
  // windows (all dark... nearly)
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { const x = 48 + i * 22, y = 146 + r * 22; if (x > 116 && x < 136) continue; g.fillStyle = fl ? C.b3 : C.g1; g.fillRect(x, y, 8, 12); g.fillStyle = C.K; g.fillRect(x + 3, y, 2, 12); g.fillRect(x, y + 5, 8, 1); }
  g.fillStyle = fl ? C.b3 : C.g1; g.fillRect(122, 76, 12, 14); if (fl) { g.fillStyle = C.K; g.fillRect(126, 78, 4, 12); g.fillRect(127, 77, 2, 2); }
  g.fillStyle = C.n0; g.fillRect(118, 170, 20, 26); g.fillStyle = C.K; g.fillRect(127, 170, 2, 26);
  // ground + rain
  g.fillStyle = C.K; g.fillRect(0, base, 256, 44); g.fillStyle = C.vd; for (let x = 0; x < 256; x += 3) g.fillRect(x, base + (x * 7 % 3), 2, 2);
  g.fillStyle = fl ? C.g5 : C.b4; for (let i = 0; i < 70; i++) { const x = (i * 53 + t * 140) % 270 - 10, y = (i * 37 + t * 300) % 240; g.fillRect(x | 0, y | 0, 1, 4); }
  txtC(g, 'LIGHTS OUT', 128, 14, C.g5, 3, C.r0);
  txtC(g, 'AT HOLLOW MANOR', 128, 42, C.y1, 1, C.rd);
  if ((t * 2 | 0) % 2) txtC(g, (TOUCH ? 'TAP TO BEGIN' : 'PRESS ENTER TO BEGIN'), 128, 206, C.g5);
  txtC(g, TOUCH ? 'PAD MOVE  LIGHT  USE  MAP' : 'ARROWS/WASD  F/SPACE LIGHT  E USE  M MAP', 128, 220, C.g3);
  txtC(g, 'N SOUND ON/OFF   (C) HOLLOW MANOR 2026', 128, 230, C.g2);
}
function drawIntro(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  const L = ['3:07 AM. THE STORM TOOK THE POWER.', '', 'THE BREAKER IS DOWN IN THE BASEMENT.', 'YOU HAVE A FLASHLIGHT AND NOT', 'MUCH BATTERY.', '', 'THE HOUSE IS EMPTY.', '', 'IT IS SUPPOSED TO BE EMPTY.'];
  const n = Math.floor(G.et * 2.2);
  L.forEach((l, i) => { if (i < n) txtC(g, l, 128, 60 + i * 11, i === 8 ? C.r1 : C.g4); });
  if (G.et > 3 && (G.t * 2 | 0) % 2) txtC(g, TOUCH ? 'TAP USE' : 'PRESS E', 128, 200, C.g5);
}
function drawCaught(g) {
  const t = G.et; g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  if (G.state === 'caught') {
    const s = 5 + Math.floor(t * 3); const f = ART.tallFace; g.drawImage(f, 0, 0, 32, 36, 128 - 16 * s, 120 - 18 * s, 32 * s, 36 * s);
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? C.g1 : C.g2; g.fillRect(rnd() * 256 | 0, rnd() * 240 | 0, 2, 1); }
    if (t > 0.9) { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); }
  } else {
    txtC(g, 'IT FOUND YOU.', 128, 90, C.r0, 2);
    txtC(g, 'THE DARK GOES QUIET...', 128, 124, C.g3);
    if (G.et > 1) txtC(g, TOUCH ? 'TAP USE TO WAKE AT THE LAST STAIRS' : 'PRESS E TO WAKE AT THE LAST STAIRS', 128, 170, (G.t * 2 | 0) % 2 ? C.g5 : C.g3);
  }
}
function drawEnd(g) {
  g.fillStyle = C.K; g.fillRect(0, 0, 256, 240);
  for (let i = 0; i < 9; i++) { const x = 21 + i * 25; g.fillStyle = C.n1; g.fillRect(x - 2, 14, 16, 22); g.fillStyle = (i === 6 && (G.t % 5) > 4.6) ? C.K : C.y0; g.fillRect(x, 16, 12, 18); g.fillStyle = C.y1; g.fillRect(x, 16, 5, 8); g.fillStyle = C.n1; g.fillRect(x + 5, 16, 2, 18); g.fillRect(x, 24, 12, 2); }
  txtC(g, 'THE LIGHTS ARE ON.', 128, 52, C.y1, 2, C.n1);
  txtC(g, 'HOLLOW MANOR IS QUIET AGAIN.', 128, 84, C.g4);
  txtC(g, 'THE STATUES WERE NEVER MOVED.', 128, 96, C.g4);
  txtC(g, 'NOBODY HAS LIVED HERE SINCE 1907.', 128, 108, C.g4);
  const s = Math.floor(G.endTime); txtC(g, 'TIME ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '   SCARES ' + G.scares + '   CAUGHT ' + G.catches, 128, 140, C.g5);
  txtC(g, 'THANK YOU FOR PLAYING', 128, 176, C.r1);
  if ((G.t * 2 | 0) % 2) txtC(g, TOUCH ? 'TAP USE TO PLAY AGAIN' : 'PRESS E TO PLAY AGAIN', 128, 200, C.g5);
}

// ---------- ending sequence ----------
function startEnding(o) {
  G.state = 'ending'; G.et = 0; G.endTime = G.playT; G.breakerObj = o; G.threat = null; G.ents = []; G.hidden = null; G.msg = null; G.map = false;
  P.ang = -Math.PI / 2; P.dir = 'up'; P.moving = false; AU.clunk(); G.endStage = 0;
}
function updateEnding(dt) {
  G.et += dt; const t = G.et; const o = G.breakerObj;
  if (G.endStage === 0 && t > 0.5) { G.endStage = 1; o.on = 1; o.vkey = '11on'; AU.clunk(); }
  if (t > 0.6 && t < 1.7) { G.lit = rnd() < 0.45; if (rnd() < 0.3) AU.tone(R(110, 130), 0.05, 'sawtooth', 0.05); }
  if (G.endStage === 1 && t >= 1.7) { G.endStage = 2; G.lit = true; AU.humOn(); AU.chime(); AU.droneVol(0.02); }
  if (G.endStage === 2 && t >= 2.6) { G.endStage = 3; G.montage = 'map'; }
  if (G.endStage === 3 && t >= 6.2) { G.endStage = 4; G.montage = 'rooms'; for (const id of ['foyer', 'nursery', 'grand']) { const r = ROOMS[id]; buildRoom(r); for (const ob of r.objs) if (ob.creep) { ob.x = ob.x0; ob.y = ob.y0; ob.v = 'away'; } computeGrid(r); if (!r.static) renderStatic(r); } }
  if (G.endStage === 4 && t >= 9.8) { G.endStage = 5; G.montage = null; showMsg('THE LIGHTS ARE ON. FINALLY.', 2.4); }
  if (G.endStage === 5 && t >= 12.0) { G.endStage = 6; G.lit = false; G.msg = null; AU.pop(); AU.humOff(); }
  if (G.endStage === 6 && t >= 12.5) {
    G.endStage = 7; G.lit = true; AU.humOn(); AU.sting(true); G.shake = 0.5;
    const tx = Math.floor(P.x / 16), ty = Math.floor(P.y / 16); const rm = G.room;
    [[tx - 1, ty], [tx + 1, ty], [tx, ty + 2]].forEach(([x, y], i) => rm.objs.push({ t: 'statue', x, y, x0: x, y0: y, w: 1, h: 1, ex: {}, creep: 1, v: i === 2 ? 'reach' : 'face', moves: 99, unseen: 0, th: 999, s: 0 }));
    P.dir = 'down'; P.ang = Math.PI / 2;
  }
  if (G.endStage === 7 && t >= 15.2) { G.endStage = 8; G.lit = false; AU.humOff(); }
  if (G.endStage === 8 && t >= 16.2) { G.state = 'end'; G.et = 0; AU.chime(); }
  if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
}
function renderEnding(g) {
  const t = G.et;
  if (G.montage === 'map') { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); const p = (t - 2.6) / 3.6; const f = p < 0.33 ? 0 : p < 0.66 ? 1 : 2; const n = Math.floor(((p * 3) % 1) * 14); drawMap(g, f, n); txtC(g, 'POWER RESTORED', 128, 228, C.y1); return; }
  if (G.montage === 'rooms') { const k = Math.min(2, Math.floor((t - 6.2) / 1.2)); const rm = ROOMS[['foyer', 'nursery', 'grand'][k]]; const saveRoom = G.room; G.room = rm; G.rockAmp = 0; drawRoom(rm, { noPlayer: true, lit: true }); G.room = saveRoom; g.drawImage(scene, 0, HUD); g.fillStyle = C.K; g.fillRect(0, 0, 256, 16); txtC(g, FLOORNAME[rm.f] + ' - ' + rm.n, 128, 5, C.y1); return; }
  drawRoom(G.room, { lit: G.lit });
  if (!G.lit) { sc.fillStyle = C.K; sc.fillRect(0, 0, VW, VH); if (G.endStage < 2) { computeLight(); drawRoom(G.room, {}); applyDarkness(); } }
  const sh = G.shake > 0 ? (rnd() * 4 | 0) - 2 : 0; g.fillStyle = C.K; g.fillRect(0, 16, 256, 224); g.drawImage(scene, sh, HUD); drawHUD(g); drawMsg(g);
  if (G.endStage >= 8) { g.fillStyle = C.K; g.fillRect(0, 0, 256, 240); }
}

function render() {
  const g = ctx; g.imageSmoothingEnabled = false;
  if (G.state === 'title') return drawTitle(g);
  if (G.state === 'intro') return drawIntro(g);
  if (G.state === 'caught' || G.state === 'gameover') return drawCaught(g);
  if (G.state === 'end') return drawEnd(g);
  if (G.state === 'ending') return renderEnding(g);
  drawRoom(G.room, {});
  if (G.hidden) { const pg = preDark.getContext('2d'); pg.drawImage(scene, 0, 0); drawHidden(); } else { applyDarkness(); postGlow(); }
  const sh = G.shake > 0 ? (rnd() * 4 | 0) - 2 : 0;
  g.fillStyle = C.K; g.fillRect(0, 16, 256, 224); g.drawImage(scene, sh, HUD + (G.shake > 0 ? (rnd() * 2 | 0) : 0));
  drawHUD(g);
  if (G.map) drawMap(g, G.room.f);
  drawMsg(g);
}

// ---------- flow ----------
function startGame(skipIntro) {
  G.state = skipIntro ? 'play' : 'intro'; G.et = 0;
  if (skipIntro) beginPlay();
}
function beginPlay() {
  G.state = 'play'; G.playT = 0; enterRoom('foyer', 'pos', { x: 128, y: 186 }); P.ang = -Math.PI / 2; P.dir = 'up'; G.check = { room: 'foyer', x: 128, y: 186 };
  showMsg('THE FLASHLIGHT IS YOUR ONLY LIGHT. ' + (TOUCH ? 'LIGHT' : 'F') + ' TOGGLES IT. A NOTE LIES ON THE FLOOR.', 5);
}
function update(dt) {
  G.t += dt;
  if (G.state === 'title') { G.titleT += dt; if (pressed.has('start') || pressed.has('use') || pressed.has('any')) startGame(BOT); return; }
  if (G.state === 'intro') { G.et += dt; if ((pressed.has('use') || pressed.has('start')) && G.et > 0.6) beginPlay(); return; }
  if (G.state === 'caught') { G.et += dt; if (G.et > 1.3) { G.state = 'gameover'; G.et = 0; } return; }
  if (G.state === 'gameover') { G.et += dt; if (G.et > 1 && (pressed.has('use') || pressed.has('start'))) respawn(); return; }
  if (G.state === 'ending') return updateEnding(dt);
  if (G.state === 'end') { G.et += dt; if (G.et > 2 && (pressed.has('use') || pressed.has('start'))) location.reload(); return; }
  if (BOT) botThink(dt);
  updatePlay(dt);
}

// ---------- input ----------
const TOUCH = QS.has('touch') || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const KEYACT = { f: 'light', F: 'light', ' ': 'light', e: 'use', E: 'use', Enter: 'start', m: 'map', M: 'map', n: 'mute', N: 'mute' };
addEventListener('keydown', (e) => {
  AU.init(); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  if (e.repeat) { keys.add(e.key); return; }
  keys.add(e.key); const a = KEYACT[e.key]; if (a === 'mute') AU.toggle(); else if (a) pressed.add(a); if (G.state === 'title') pressed.add('any');
});
addEventListener('keyup', (e) => { keys.delete(e.key); });
addEventListener('blur', () => keys.clear());
cv.addEventListener('pointerdown', () => { AU.init(); if (G.state === 'title' || G.state === 'intro' || G.state === 'gameover' || G.state === 'end') pressed.add('start'); });
function setupTouch() {
  const el = document.getElementById('touch'); if (!TOUCH) { el.style.display = 'none'; return; } el.style.display = 'flex';
  const pad = document.getElementById('pad'); const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const setDir = (e) => { const r = pad.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; dirs.forEach((d) => keys.delete(d)); if (Math.hypot(x, y) < 10) return; const a = Math.atan2(y, x); const s = Math.PI / 8;
    if (a > -3 * s && a < 3 * s) keys.add('ArrowRight'); if (a > 5 * s || a < -5 * s) keys.add('ArrowLeft'); if (a > s && a < 7 * s) keys.add('ArrowDown'); if (a < -s && a > -7 * s) keys.add('ArrowUp');
    pad.dataset.d = [...keys].join(' '); };
  pad.addEventListener('pointerdown', (e) => { AU.init(); pad.setPointerCapture(e.pointerId); setDir(e); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) setDir(e); });
  const up = () => { dirs.forEach((d) => keys.delete(d)); pad.dataset.d = ''; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('pointerdown', (e) => { AU.init(); e.preventDefault(); const a = b.dataset.act; if (a === 'mute') { AU.toggle(); b.textContent = AU.muted ? 'SOUND OFF' : 'SOUND'; } else { pressed.add(a); if (G.state !== 'play') pressed.add('start'); } b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); }));
}
function resize() {
  const tEl = document.getElementById('touch'); const th = TOUCH ? tEl.offsetHeight + 8 : 0;
  const aw = innerWidth, ah = innerHeight - th; let s = Math.min(aw / 256, ah / 240); s = s >= 2 ? Math.floor(s) : Math.max(1, Math.floor(s * 4) / 4); if (aw < 256) s = aw / 256;
  cv.style.width = Math.floor(256 * s) + 'px'; cv.style.height = Math.floor(240 * s) + 'px';
}

// ---------- bot (automated playthrough for tests: ?bot) ----------
function roomPath(from, to) {
  const prev = { [from]: null }; const q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; const r = ROOMS[c]; buildRoom(r);
    const nb = Object.entries(r.doors).map(([d, id]) => [id, { door: d }]);
    for (const o of r.objs) if (o.t === 'stairs' && (!o.locked || o.open || G.inv.key)) nb.push([o.to, { stairs: o }]);
    for (const [id, how] of nb) if (!(id in prev)) { prev[id] = [c, how]; q.push(id); } }
  if (!(to in prev)) return null; const path = []; let k = to; while (prev[k]) { path.unshift([k, prev[k][1]]); k = prev[k][0]; } return path;
}
function botThink(dt) {
  const B = G.botS || (G.botS = { stuck: 0, lx: 0, ly: 0, jig: 0, useT: 0 }); G.bot = { x: 0, y: 0 };
  if (G.hidden) { pressed.add('use'); return; }
  if (!G.lightUser && G.battery > 0) pressed.add('light');
  const T = G.threat; if (T && !T.fade) { P.ang = Math.atan2(T.y - 18 - (P.y - 7), T.x - P.x); G.botInfo = 'repel'; return; }
  let goal; if (!G.inv.key) goal = { room: 'study', m: (o) => o.t === 'desk' && o.it, use: 1 };
  else if (!G.inv.handle) goal = { room: 'conserv', m: (o) => o.it === 'handle' && !o.taken };
  else if (!G.inv.fuse) goal = { room: 'crawl', m: (o) => o.it === 'fuse' && !o.taken };
  else goal = { room: 'breaker', m: (o) => o.t === 'breaker', use: 1 };
  const rm = G.room; let tgt = null, push = null, useObj = null;
  if (rm.id === goal.room) { const o = rm.objs.find(goal.m); if (o) { if (goal.use) useObj = o; else tgt = (x, y) => x === o.x && y === o.y; } }
  else { const p = roomPath(rm.id, goal.room); if (!p) { G.botInfo = 'nopath'; return; } const how = p[0][1];
    if (how.door) { const d = how.door; push = d; tgt = (x, y) => (d === 'W' && x === 0 && (y === 6 || y === 7)) || (d === 'E' && x === 15 && (y === 6 || y === 7)) || (d === 'N' && y <= 1 && (x === 7 || x === 8)) || (d === 'S' && y === 13 && (x === 7 || x === 8)); }
    else { const o = how.stairs; if (o.locked && !o.open) useObj = o; else tgt = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h; } }
  if (useObj) { const o = useObj; const [rx, ry, rw, rh] = objRect(o); tgt = (x, y) => { const cx = x * 16 + 8, cy = y * 16 + 10; if (rm.grid[y * COLS + x]) return false; return (cx > rx && cx < rx + rw && cy > ry - 14 && cy < ry + rh + 14) || (cy > ry && cy < ry + rh && cx > rx - 14 && cx < rx + rw + 14); }; }
  const tx = Math.floor(P.x / 16), ty = Math.floor(P.y / 16);
  if (push && tgt(tx, ty)) { const vx = push === 'W' ? -1 : push === 'E' ? 1 : 0, vy = push === 'N' ? -1 : push === 'S' ? 1 : 0; G.bot = { x: vx || (Math.abs(128 - P.x) > 2 ? Math.sign(128 - P.x) : 0), y: vy || (Math.abs(116 - P.y) > 2 ? Math.sign(116 - P.y) : 0) }; G.botInfo = 'exit ' + push; return; }
  if (tgt(tx, ty) && Math.abs(P.x - (tx * 16 + 8)) < 4 && Math.abs(P.y - (ty * 16 + 10)) < 4) {
    if (useObj) { const [rx, ry, rw, rh] = objRect(useObj); P.ang = Math.atan2(clamp(P.y, ry + 4, ry + rh - 4) - P.y, clamp(P.x, rx + 4, rx + rw - 4) - P.x); const a = P.ang; P.dir = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up'); B.useT -= dt; if (B.useT <= 0) { B.useT = 0.6; pressed.add('use'); } G.botInfo = 'use ' + useObj.t; return; }
    if (push) { G.bot = { x: push === 'W' ? -1 : push === 'E' ? 1 : 0, y: push === 'N' ? -1 : push === 'S' ? 1 : 0 }; G.botInfo = 'exit ' + push; return; }
  }
  const path = tgt(tx, ty) ? [ty * COLS + tx] : bfs(tx, ty, tgt);
  if (!path || !path.length) { G.botInfo = 'stuck-nopath ' + rm.id; B.jig = 0.3; }
  let nx = tx, ny = ty; if (path && path.length) { nx = path[0] % COLS; ny = (path[0] / COLS) | 0; }
  const cx = nx * 16 + 8, cy = ny * 16 + 10; const dx = cx - P.x, dy = cy - P.y;
  G.bot = { x: Math.abs(dx) > 1.2 ? Math.sign(dx) : 0, y: Math.abs(dy) > 1.2 ? Math.sign(dy) : 0 };
  if (Math.hypot(P.x - B.lx, P.y - B.ly) < 0.2 && (G.bot.x || G.bot.y)) B.stuck += dt; else B.stuck = 0; B.lx = P.x; B.ly = P.y;
  if (B.stuck > 1.5) { B.jig = 0.35; B.stuck = 0; B.jx = pick([-1, 1, 0]); B.jy = pick([-1, 1, 0]); }
  if (B.jig > 0) { B.jig -= dt; G.bot = { x: B.jx || 0, y: B.jy || 0 }; }
  G.botInfo = rm.id + '>' + goal.room;
}

// ---------- debug / test API ----------
window.__hm = {
  G, P, ROOMS, AU,
  state: () => ({ state: G.state, room: G.room && G.room.id, inv: { ...G.inv }, battery: +G.battery.toFixed(3), playT: +G.playT.toFixed(1), threat: !!G.threat, bot: G.botInfo, x: Math.round(P.x), y: Math.round(P.y), scares: G.scares, catches: G.catches, et: +G.et.toFixed(2) }),
  start: () => { if (G.state === 'title') { startGame(true); } },
  goto: (id, x, y) => { if (G.state !== 'play') { G.state = 'play'; } enterRoom(id, 'pos', { x: x === undefined ? 128 : x, y: y === undefined ? 120 : y }); },
  give: (it) => { G.inv[it] = 1; }, aim: (a) => { P.ang = a; }, face: (d) => { P.dir = d; P.ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[d]; },
  spawnThreat: (x, y) => { spawnThreat(); if (x !== undefined) { G.threat.x = x; G.threat.y = y; } G.blk = 0; },
  dart: () => spawnDart(), drag: () => { G.dragDone = false; startDrag(); }, cat: (x, y) => spawnCat(x, y), lightning: () => lightning(true),
  validate: () => { const bad = []; for (const id in ROOMS) { const r = ROOMS[id]; buildRoom(r); computeGrid(r); const save = G.room; G.room = r; const pts = []; for (const d in r.doors) pts.push({ N: [7, 1], S: [7, 13], W: [0, 6], E: [15, 6] }[d]); for (const o of r.objs) { if (o.t === 'stairs') pts.push([o.x, o.y + o.h]); if (o.t === 'item' || o.t === 'note') pts.push([o.x, o.y]); if (o.t === 'breaker' || o.t === 'desk' && o.it) pts.push(o.t === 'breaker' ? [o.x, 2] : [o.x, o.y + 1]); }
      const [sx, sy] = pts[0]; for (const [x, y] of pts.slice(1)) { if (r.grid[y * COLS + x]) { bad.push(id + ' blocked ' + x + ',' + y); continue; } const p = bfs(sx, sy, (a, b) => a === x && b === y); if (!p && !(sx === x && sy === y)) bad.push(id + ' unreachable ' + x + ',' + y); } G.room = save; } return bad; },
  noFlicker: (v) => { G.noFlicker = v; }, use: () => interact(), map: (v) => { G.map = v; }, msg: (m) => showMsg(m), hide: () => hide(G.room.objs.find((o) => o.t === 'wardrobe')), noThreat: (v) => { G.noThreat = v; },
};

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  try {
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    for (let i = 0; i < TSCALE; i++) { update(dt); pressed.clear(); }
    render();
  } catch (e) { window.__frameErrors++; console.error(e); }
  requestAnimationFrame(frame);
}
setupTouch(); resize(); addEventListener('resize', resize);
if (QS.get('debug') === 'breaker') { startGame(true); G.inv = { key: 1, handle: 1, fuse: 1 }; enterRoom('breaker', 'pos', { x: 128, y: 46 }); P.ang = -Math.PI / 2; P.dir = 'up'; }
else if (QS.get('room')) { startGame(true); enterRoom(QS.get('room'), 'pos', { x: +(QS.get('x') || 128), y: +(QS.get('y') || 120) }); }
else if (BOT) { startGame(true); }
requestAnimationFrame(frame);

})();
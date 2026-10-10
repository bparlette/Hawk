/* KNOCKOUT! Round One - an original over-the-shoulder boxing game.
   All art is drawn in code onto a 256x224 canvas, then integer-scaled with nearest filtering. */
(() => {
'use strict';
const W = 256, H = 224, DT = 1 / 60;
const $ = (s) => document.querySelector(s);
const screenC = $('#screen'), sctx = screenC.getContext('2d');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cx2 = (c) => c.getContext('2d', { willReadFrequently: true });
const buf = mk(W, H), g = buf.getContext('2d');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

/* ---------------------------------------------------------------- pixel font 5x7 */
const GLYPHS = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000', '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100', ':': '00000 01100 01100 00000 01100 01100 00000', "'": '00100 00100 01000 00000 00000 00000 00000',
  '"': '01010 01010 00000 00000 00000 00000 00000', '-': '00000 00000 00000 11111 00000 00000 00000', '/': '00001 00010 00010 00100 01000 01000 10000',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000', '+': '00000 00100 00100 11111 00100 00100 00000',
  '&': '01100 10010 10100 01000 10101 10010 01101', '#': '01010 11111 01010 01010 11111 01010 00000', '*': '00100 00100 11111 01110 01010 10001 00000',
  '%': '11001 11010 00010 00100 01000 01011 10011', '=': '00000 00000 11111 00000 11111 00000 00000', '<': '00010 00100 01000 10000 01000 00100 00010',
  '>': '01000 00100 00010 00001 00010 00100 01000', '~': '00000 00000 01000 10101 00010 00000 00000', ' ': '00000 00000 00000 00000 00000 00000 00000',
};
const FONT = {};
for (const k in GLYPHS) { const rows = GLYPHS[k].split(' '); const px = []; rows.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] === '1') px.push(x, y); }); FONT[k] = px; }
function textW(t, s = 1) { return t.length * 6 * s - s; }
function text(c, t, x, y, o = {}) {
  t = String(t).toUpperCase(); const s = o.s || 1; let w = textW(t, s);
  if (o.al === 'c') x = Math.round(x - w / 2); else if (o.al === 'r') x = Math.round(x - w);
  const draw = (ox, oy, col) => { c.fillStyle = col; for (let i = 0; i < t.length; i++) { const p = FONT[t[i]] || FONT['?']; for (let j = 0; j < p.length; j += 2) c.fillRect(x + ox + i * 6 * s + p[j] * s, y + oy + p[j + 1] * s, s, s); } };
  if (o.ol) { const k = o.olw || s; for (let dy = -k; dy <= k; dy += k) for (let dx = -k; dx <= k; dx += k) if (dx || dy) draw(dx, dy, o.ol); }
  if (o.sh) draw(o.shd || s, o.shd || s, o.sh);
  if (o.c2) { // two-tone: top half c, bottom half c2
    draw(0, 0, o.c2); c.save(); c.beginPath(); c.rect(x - 2, y - 2, w + 4, Math.ceil(3.5 * s) + 2); c.clip(); draw(0, 0, o.c || '#fff'); c.restore();
  } else draw(0, 0, o.c || '#fff');
  return w;
}

/* ---------------------------------------------------------------- palettes */
const C = {
  OUT: '#1a0d12',
  SK: ['#93453a', '#dc9276', '#f7bd9f', '#ffe6d2'], SKD: '#6a2c2a',
  GLV: ['#6c0c16', '#c9202e', '#ff5c4c', '#ffd6c8'], GLF: ['#c89a2a', '#fff07a', '#ffffff', '#ffffff'], GLR: ['#9a0000', '#ff2424', '#ff9a8a', '#ffffff'],
  TRK: ['#163a76', '#2a6ec2', '#5ca4f2', '#c4e6ff'], WHT: ['#8e94ae', '#e6eaf2', '#ffffff'],
  HAIR: ['#3a1e0c', '#6a3c18', '#9c6634'], EYE: '#ffffff', PUP: '#1a0d12', NOSE: ['#a63a30', '#e2604e', '#ff9e86'], BLUSH: '#ee8486',
  MOUTH: '#4a1018', TEETH: '#fff8e8', TONGUE: '#e2586a', BAND: ['#b48a3e', '#e8c26e', '#fff0b4'], SHOE: ['#0e0e16', '#2a2a3a', '#5a5a72'],
  HSK: ['#4a2414', '#8c5432', '#be7c50', '#e4ac7c'], HHAIR: ['#08070c', '#1e1a28', '#3e3852'], TOP: ['#0c0c1c', '#1e2048', '#373c7c'],
  TRIM: ['#a07010', '#f2c224', '#fff294'], HGLV: ['#0a4a18', '#19a23a', '#5eea6c', '#dcffdc'], TAPE: ['#a8aab8', '#eef0f6'],
  REF: ['#b46c4c', '#e0a07a'], RSH: ['#9aa0b8', '#eef0f6', '#ffffff'], RPANT: ['#14141e', '#2a2a3a', '#44445a'], RHAIR: ['#7a7a8c', '#b8b8c8', '#e8e8f2'],
  STAR: ['#c06a00', '#ffd23a', '#fff6b0'],
};
function palOf(...arrs) { const out = []; const add = (v) => { if (Array.isArray(v)) v.forEach(add); else if (typeof v === 'string' && v[0] === '#') { const n = parseInt(v.slice(1), 16); out.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]); } }; arrs.forEach(add); return out; }
const PAL_ALL = palOf(Object.values(C));
const OUTRGB = [0x1a, 0x0d, 0x12];
const qCache = new Map();
function crisp(cnv, pal = PAL_ALL, outline = OUTRGB) {
  const c = cx2(cnv), w = cnv.width, h = cnv.height, id = c.getImageData(0, 0, w, h), d = id.data, n = w * h, a = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] > 110) {
      a[i] = 1;
      const key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
      let q = qCache.get(key);
      if (!q) { let best = 1e9; for (const p of pal) { const dr = p[0] - d[o], dg = p[1] - d[o + 1], db = p[2] - d[o + 2]; const e = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (e < best) { best = e; q = p; } } qCache.set(key, q); }
      d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = 255;
    } else d[o + 3] = 0;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (a[i]) continue;
    if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) { const o = i * 4; d[o] = outline[0]; d[o + 1] = outline[1]; d[o + 2] = outline[2]; d[o + 3] = 255; }
  }
  c.putImageData(id, 0, 0);
}
function tint(cnv, col) { const c = cnv.getContext('2d'); c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = col; c.fillRect(0, 0, cnv.width, cnv.height); c.restore(); }

/* ---------------------------------------------------------------- drawing primitives */
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); }
function sEll(c, x, y, rx, ry, cols, rot = 0, lx = -0.4, ly = -0.45) {
  ell(c, x, y, rx, ry, rot); c.fillStyle = cols[0]; c.fill();
  c.save(); ell(c, x, y, rx, ry, rot); c.clip();
  ell(c, x + lx * rx * 0.28, y + ly * ry * 0.28, rx * 0.9, ry * 0.88, rot); c.fillStyle = cols[1]; c.fill();
  if (cols[2]) { ell(c, x + lx * rx * 0.48, y + ly * ry * 0.5, rx * 0.46, ry * 0.42, rot); c.fillStyle = cols[2]; c.fill(); }
  if (cols[3]) { ell(c, x + lx * rx * 0.62, y + ly * ry * 0.64, Math.max(1, rx * 0.14), Math.max(1, ry * 0.12), rot); c.fillStyle = cols[3]; c.fill(); }
  c.restore();
}
function seg(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function limb(c, x1, y1, x2, y2, w, cols) {
  c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = cols[0]; seg(c, x1, y1, x2, y2);
  const o = w * 0.14; c.lineWidth = w * 0.64; c.strokeStyle = cols[1]; seg(c, x1 - o, y1 - o, x2 - o, y2 - o);
  if (cols[2]) { const o2 = w * 0.26; c.lineWidth = Math.max(1, w * 0.2); c.strokeStyle = cols[2]; seg(c, x1 - o2, y1 - o2, x2 - o2, y2 - o2); }
}
function ik(sx, sy, gx, gy, L, outDir, down = 0.5) { // returns elbow point
  const dx = gx - sx, dy = gy - sy, d = Math.hypot(dx, dy) || 1, mx = (sx + gx) / 2, my = (sy + gy) / 2;
  const hh = d < 2 * L ? Math.sqrt(L * L - (d / 2) * (d / 2)) : 0;
  let px = -dy / d, py = dx / d; // perpendicular
  const want = [outDir, down]; if (px * want[0] + py * want[1] < 0) { px = -px; py = -py; }
  return [mx + px * hh, my + py * hh];
}
function star(c, x, y, r, col, col2) { // 4/5 point pixel star
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill(); if (col2) { c.fillStyle = col2; c.fillRect(Math.round(x - r * 0.2), Math.round(y - r * 0.25), Math.max(1, Math.round(r * 0.35)), Math.max(1, Math.round(r * 0.35))); }
}
function twinkle(c, x, y, r, col = '#fff') { x = Math.round(x); y = Math.round(y); c.fillStyle = col; c.fillRect(x - r, y, r * 2 + 1, 1); c.fillRect(x, y - r, 1, r * 2 + 1); if (r > 2) { c.fillRect(x - 1, y - 1, 3, 3); } }
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
const STARI = ['0001000', '0001000', '1111111', '0111110', '0011100', '0110110', '0100010'];
function icon(c, map, x, y, col, ol) {
  if (ol) { c.fillStyle = ol; map.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') c.fillRect(x + i - 1, y + j - 1, 3, 3); }); }
  c.fillStyle = col; map.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '1') c.fillRect(x + i, y + j, 1, 1); });
}

/* ---------------------------------------------------------------- glove */
function glove(c, x, y, s, cols, side, back = false) {
  const rx = 12.5 * s, ry = 13.5 * s;
  // cuff (laced)
  const cy = back ? y + ry * 0.86 : y + ry * 0.8;
  c.fillStyle = C.WHT[0]; c.fillRect(x - rx * 0.62, cy - 2 * s, rx * 1.24, 6 * s);
  c.fillStyle = C.WHT[1]; c.fillRect(x - rx * 0.62, cy - 2 * s, rx * 1.1, 4 * s);
  sEll(c, x, y, rx, ry, cols);
  if (!back) { // thumb on the inner side
    sEll(c, x - side * rx * 0.72, y + ry * 0.25, rx * 0.36, ry * 0.5, cols, side * 0.3);
    c.strokeStyle = cols[0]; c.lineWidth = Math.max(1, s); c.beginPath(); c.arc(x + side * rx * 0.05, y - ry * 0.05, rx * 0.62, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  } else {
    c.strokeStyle = cols[0]; c.lineWidth = Math.max(1, s * 0.9); c.beginPath(); c.arc(x, y + ry * 0.2, rx * 0.7, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
}

/* ---------------------------------------------------------------- opponent sprite: Gus "The Glass" Gruber */
const OW = 172, OH = 186, OX0 = 42, OY0 = 16; // buffer & screen origin
const oppC = mk(OW, OH), oppX = cx2(oppC), oppF = mk(OW, OH), oppFX = cx2(oppF);
function drawHead(c, p) {
  const hx = 86 + p.hx, hy = 46 + p.hy;
  c.save(); c.translate(hx, hy); c.rotate(p.ht);
  // ears
  sEll(c, -22, 3, 5, 7, C.SK); sEll(c, 22, 3, 5, 7, C.SK); c.fillStyle = C.SKD; c.fillRect(-23, 1, 2, 5); c.fillRect(21, 1, 2, 5);
  // jowly head
  sEll(c, 0, 0, 22, 25, C.SK);
  sEll(c, 0, 14, 19, 12, C.SK); // jaw/chin mass
  // combover strands
  c.strokeStyle = C.HAIR[1]; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-17, -10 - i * 4); c.quadraticCurveTo(0, -27 - i * 2 + (p.hairUp || 0), 16, -14 - i * 3); c.stroke(); }
  c.strokeStyle = C.HAIR[2]; c.lineWidth = 1; c.beginPath(); c.moveTo(-12, -20); c.quadraticCurveTo(0, -27 + (p.hairUp || 0), 10, -21); c.stroke();
  c.fillStyle = C.HAIR[0]; c.fillRect(-21, -6, 3, 8); c.fillRect(18, -6, 3, 8); // side tufts
  // brows
  const by = -10 - p.brow * 5;
  c.fillStyle = C.HAIR[0];
  for (const sd of [-1, 1]) {
    c.save(); c.translate(sd * 9, by); c.rotate(sd * (p.brow < 0 ? 0.35 : p.brow > 0 ? -0.15 : 0.05)); c.fillRect(-6, -2, 12, 4); c.fillStyle = C.HAIR[1]; c.fillRect(-5, -2, 9, 1); c.fillStyle = C.HAIR[0]; c.restore();
  }
  // eyes
  for (const sd of [-1, 1]) {
    const ex = sd * 8, ey = -2;
    const e = p.eyes;
    if (e === 'open' || e === 'wide' || e === 'look') {
      const r = e === 'wide' ? 5 : 4;
      c.fillStyle = C.OUT; ell(c, ex, ey, r + 1, r); c.fill(); c.fillStyle = C.EYE; ell(c, ex, ey, r, r - 1); c.fill();
      c.fillStyle = C.PUP; c.fillRect(Math.round(ex - 1 + (p.look || 0)), Math.round(ey - 1 + (e === 'wide' ? 0 : 1)), 2, e === 'wide' ? 2 : 3);
      if (p.lid) { c.fillStyle = C.SK[1]; c.fillRect(ex - r, ey - r, r * 2 + 1, Math.round(r * p.lid)); }
    } else if (e === 'blink' || e === 'shut' || e === 'squint') {
      c.fillStyle = C.OUT; c.fillRect(ex - 4, ey, 9, 2); if (e === 'shut') { c.fillRect(ex - 4 + (sd > 0 ? 0 : 6), ey - 2, 3, 2); }
    } else if (e === 'happy') {
      c.strokeStyle = C.OUT; c.lineWidth = 2; c.beginPath(); c.arc(ex, ey + 2, 3.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (e === 'x') {
      c.strokeStyle = C.OUT; c.lineWidth = 2; seg(c, ex - 3, ey - 3, ex + 3, ey + 3); seg(c, ex - 3, ey + 3, ex + 3, ey - 3);
    } else if (e === 'swirl') {
      c.fillStyle = C.EYE; ell(c, ex, ey, 5, 4); c.fill(); c.strokeStyle = C.OUT; c.lineWidth = 1; c.beginPath();
      for (let a = 0; a < 12; a += 0.4) { const rr = a * 0.38; c.lineTo(ex + Math.cos(a + (p.spin || 0)) * rr, ey + Math.sin(a + (p.spin || 0)) * rr * 0.8); } c.stroke();
    }
  }
  // cheeks
  if (p.blush > 0) { c.fillStyle = C.BLUSH; ell(c, -14, 8, 4 + p.blush * 2, 3); c.fill(); ell(c, 14, 8, 4 + p.blush * 2, 3); c.fill(); }
  // nose
  sEll(c, p.nose || 0, 6, 6, 5.5, C.NOSE);
  // mouth
  const my = 18;
  c.fillStyle = C.MOUTH;
  switch (p.mouth) {
    case 'smile': c.beginPath(); c.ellipse(0, my - 1, 8, 4, 0, 0, Math.PI); c.fill(); c.fillStyle = C.TEETH; c.fillRect(-6, my - 1, 12, 2); break;
    case 'smug': c.beginPath(); c.ellipse(2, my - 1, 7, 3, -0.15, 0, Math.PI); c.fill(); break;
    case 'grit': c.fillRect(-8, my - 3, 16, 7); c.fillStyle = C.TEETH; c.fillRect(-7, my - 2, 14, 5); c.fillStyle = C.MOUTH; for (let i = -4; i <= 4; i += 4) c.fillRect(i, my - 2, 1, 5); c.fillRect(-7, my, 14, 1); break;
    case 'o': ell(c, 0, my + 1, 4, 5); c.fill(); c.fillStyle = C.TONGUE; c.fillRect(-2, my + 3, 4, 2); break;
    case 'ow': ell(c, 0, my + 1, 7, 5); c.fill(); c.fillStyle = C.TEETH; c.fillRect(-5, my - 3, 10, 2); break;
    case 'tongue': ell(c, 0, my, 7, 4); c.fill(); c.fillStyle = C.TONGUE; ell(c, 3, my + 5, 3, 4); c.fill(); break;
    case 'kiss': ell(c, 1, my, 3, 3); c.fill(); c.fillStyle = C.NOSE[1]; ell(c, 1, my, 2, 2); c.fill(); break;
  }
  // walrus mustache
  for (const sd of [-1, 1]) { sEll(c, sd * 6, 12, 8, 4.5, C.HAIR, sd * 0.25); c.fillStyle = C.HAIR[0]; c.fillRect(sd * 12 - (sd < 0 ? 2 : 0), 13, 2, 4); }
  // the famous bandaged glass chin
  c.save(); c.translate(7, 25); c.rotate(-0.4); c.fillStyle = C.BAND[0]; c.fillRect(-6, -2, 12, 5); c.fillStyle = C.BAND[1]; c.fillRect(-6, -2, 12, 3); c.fillStyle = C.BAND[2]; c.fillRect(-2, -1, 4, 2); c.restore();
  if (p.crack) { c.strokeStyle = '#ffffff'; c.lineWidth = 1; seg(c, -6, 22, -2, 26); seg(c, -2, 26, -5, 29); }
  // sweat
  if (p.sweat) { c.fillStyle = '#bfe4ff'; ell(c, 20, -14, 2, 3); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(19, -15, 1, 1); }
  c.restore();
}
function oppArm(c, p, side) {
  const gl = side < 0 ? p.gl : p.gr, sh = side < 0 ? p.shl : p.shr;
  const sx = 86 + side * 34, sy = 80 + sh;
  const [ex, ey] = ik(sx, sy, gl.x, gl.y, 27, side, 0.6);
  const ws = Math.min(1.5, Math.sqrt(gl.s));
  limb(c, sx, sy, ex, ey, 15, C.SK);
  limb(c, ex, ey, gl.x, gl.y + 4 * gl.s, 12 * ws, C.SK);
  glove(c, gl.x, gl.y, gl.s, gl.f === 1 ? C.GLF : gl.f === 2 ? C.GLR : C.GLV, side);
}
function drawOpp(c, p, mode) {
  c.clearRect(0, 0, OW, OH);
  if (p.flat) { drawOppFlat(c, p); return; }
  c.save(); c.translate(p.x, p.y + 52 * p.sit);
  c.translate(86, 150); c.rotate(p.lean); c.translate(-86, -150);
  const body = mode !== 'front';
  if (body) {
    if (p.sit < 0.35) { // legs
      limb(c, 72, 156, 66, 190, 22, C.SK); limb(c, 100, 156, 106, 190, 22, C.SK);
    }
    // trunks
    c.fillStyle = C.TRK[0]; c.beginPath(); c.moveTo(50, 124); c.lineTo(122, 124); c.lineTo(127, 164); c.lineTo(92, 168); c.lineTo(86, 154); c.lineTo(80, 168); c.lineTo(45, 164); c.closePath(); c.fill();
    c.fillStyle = C.TRK[1]; c.beginPath(); c.moveTo(53, 127); c.lineTo(118, 127); c.lineTo(121, 158); c.lineTo(94, 161); c.lineTo(86, 150); c.lineTo(78, 161); c.lineTo(50, 158); c.closePath(); c.fill();
    c.fillStyle = C.TRK[2]; c.fillRect(56, 131, 10, 20); c.fillRect(92, 131, 6, 18);
    c.fillStyle = C.WHT[1]; c.fillRect(48, 132, 3, 30); c.fillRect(121, 132, 3, 30);
    text(c, 'GG', 99, 144, { c: C.WHT[1] });
    // waistband
    c.fillStyle = C.WHT[0]; c.fillRect(49, 119, 74, 9); c.fillStyle = C.WHT[1]; c.fillRect(49, 119, 74, 6); c.fillStyle = C.WHT[2]; c.fillRect(52, 120, 40, 2);
    // neck, chest, belly
    sEll(c, 86, 68, 15, 10, C.SK);
    sEll(c, 86, 90, 39, 21, C.SK);
    sEll(c, 86, 108, 32 * p.belly, 22 / p.belly, C.SK);
    // pecs + details
    c.strokeStyle = C.SK[0]; c.lineWidth = 1;
    c.beginPath(); c.arc(72, 86, 13, Math.PI * 0.2, Math.PI * 0.85); c.stroke(); c.beginPath(); c.arc(100, 86, 13, Math.PI * 0.15, Math.PI * 0.8); c.stroke();
    c.fillStyle = '#c4706a'; c.fillRect(70, 95, 3, 2); c.fillRect(100, 95, 3, 2);
    c.fillStyle = C.HAIR[0]; [[84, 84], [87, 86], [83, 89], [88, 90], [85, 93], [86, 97], [81, 86], [90, 83]].forEach(([x, y]) => c.fillRect(x, y, 1, 2));
    c.fillStyle = C.SK[0]; c.fillRect(85, 114, 2, 3);
    // shoulders
    sEll(c, 52, 80 + p.shl, 13, 11, C.SK); sEll(c, 120, 80 + p.shr, 13, 11, C.SK);
    drawHead(c, p);
    if (p.sit > 0.35) { // legs sprawled toward us + shoe soles
      const k = p.sit;
      limb(c, 72, 160, 58, 178, 22, C.SK); limb(c, 100, 160, 114, 178, 22, C.SK);
      for (const sd of [-1, 1]) {
        const x = 86 + sd * 34, y = 178;
        c.fillStyle = C.WHT[1]; c.fillRect(x - 9, y - 10, 18, 8);
        sEll(c, x, y + 2, 11 * k + 2, 12, C.SHOE); c.fillStyle = C.SHOE[2]; c.fillRect(x - 5, y - 2, 10, 2); c.fillRect(x - 5, y + 3, 10, 2);
      }
    }
  }
  for (const side of [-1, 1]) {
    const isFront = p.front === (side < 0 ? 'L' : 'R');
    if (mode === 'all' || (mode === 'body' && !isFront) || (mode === 'front' && isFront)) oppArm(c, p, side);
  }
  c.restore();
}
function drawOppFlat(c, p) { // flat on his back, seen from his feet
  c.save(); c.translate(p.x, 0);
  // head far away
  sEll(c, 86, 120, 18, 11, C.SK); c.fillStyle = C.HAIR[1]; c.fillRect(74, 113, 24, 2);
  for (const sd of [-1, 1]) { c.strokeStyle = C.OUT; c.lineWidth = 2; seg(c, 86 + sd * 7 - 2, 116, 86 + sd * 7 + 2, 120); seg(c, 86 + sd * 7 - 2, 120, 86 + sd * 7 + 2, 116); }
  sEll(c, 86, 125, 4, 3, C.NOSE);
  // arms flung out
  limb(c, 60, 140, 28, 130, 12, C.SK); limb(c, 112, 140, 144, 130, 12, C.SK);
  glove(c, 24, 128, 0.85, C.GLV, 1); glove(c, 148, 128, 0.85, C.GLV, -1);
  // belly mound
  sEll(c, 86, 142, 36, 16, C.SK); sEll(c, 86, 146, 30, 12, C.SK);
  c.fillStyle = C.WHT[1]; c.fillRect(54, 154, 64, 5);
  c.fillStyle = C.TRK[1]; c.fillRect(54, 158, 64, 10); c.fillStyle = C.TRK[0]; c.fillRect(84, 162, 4, 6);
  limb(c, 70, 168, 62, 176, 20, C.SK); limb(c, 102, 168, 110, 176, 20, C.SK);
  for (const sd of [-1, 1]) { const x = 86 + sd * 30; sEll(c, x, 178, 12, 11, C.SHOE); c.fillStyle = C.SHOE[2]; c.fillRect(x - 5, 174, 10, 2); c.fillRect(x - 5, 179, 10, 2); }
  c.restore();
}

/* ---------------------------------------------------------------- hero sprite (seen from behind) */
const HW = 140, HH = 180, HX0 = 58, HY0 = 44;
const heroC = mk(HW, HH), heroX = cx2(heroC);
function drawHero(c, p) {
  c.clearRect(0, 0, HW, HH);
  c.save(); c.translate(p.x, p.y); c.translate(70, 178); c.rotate(p.lean); c.translate(-70, -178);
  const SK = C.HSK;
  // back + lats
  sEll(c, 70, 170, 38, 28, SK, 0, -0.2, -0.6);
  sEll(c, 40, 146, 12, 11, SK); sEll(c, 100, 146, 12, 11, SK);
  // tank top
  c.fillStyle = C.TOP[0]; c.beginPath(); c.moveTo(48, 140); c.quadraticCurveTo(70, 156, 92, 140); c.lineTo(100, 182); c.lineTo(40, 182); c.closePath(); c.fill();
  c.fillStyle = C.TOP[1]; c.beginPath(); c.moveTo(50, 143); c.quadraticCurveTo(70, 158, 90, 143); c.lineTo(94, 182); c.lineTo(46, 182); c.closePath(); c.fill();
  c.fillStyle = C.TOP[2]; c.fillRect(53, 150, 6, 30);
  c.strokeStyle = C.TRIM[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 140); c.quadraticCurveTo(70, 156, 92, 140); c.stroke();
  c.strokeStyle = C.TOP[1]; c.lineWidth = 6; seg(c, 52, 138, 58, 128); seg(c, 88, 138, 82, 128);
  c.strokeStyle = C.TRIM[1]; c.lineWidth = 1; seg(c, 49, 138, 55, 128); seg(c, 91, 138, 85, 128);
  text(c, 'PIP', 61, 163, { c: C.TRIM[1] });
  c.fillStyle = C.TOP[0]; c.fillRect(69, 160, 2, 1);
  // neck + traps
  sEll(c, 70 + p.hx * 0.5, 132, 11, 8, SK);
  // arms
  for (const side of [-1, 1]) {
    const gl = side < 0 ? p.gl : p.gr, sx = 70 + side * 30, sy = 146;
    const [ex, ey] = ik(sx, sy, gl.x, gl.y + 8 * gl.s, 20, side * 0.5, 1.6);
    limb(c, sx, sy, ex, ey, 13, SK); limb(c, ex, ey, gl.x, gl.y + 8 * gl.s, 11, SK);
    c.fillStyle = C.TAPE[1]; c.save(); c.translate(gl.x, gl.y + 11 * gl.s); c.fillRect(-5 * gl.s, -2, 10 * gl.s, 4); c.restore();
  }
  // head (back of)
  const hx = 70 + p.hx, hy = 118 + p.hy;
  sEll(c, hx - 14, hy + 3, 3.5, 5.5, SK); sEll(c, hx + 14, hy + 3, 3.5, 5.5, SK);
  sEll(c, hx, hy + 9, 9, 5, SK);
  sEll(c, hx, hy, 14, 15, C.HHAIR, 0, -0.3, -0.7);
  c.fillStyle = C.HHAIR[0]; c.fillRect(hx - 1, hy - 17, 3, 3); c.fillRect(hx + 1, hy - 19, 2, 2);
  c.fillStyle = C.HHAIR[2]; c.fillRect(hx - 6, hy - 9, 5, 1);
  c.fillStyle = C.HHAIR[1]; c.fillRect(hx - 8, hy + 8, 16, 2);
  // gloves (backs)
  for (const side of [-1, 1]) { const gl = side < 0 ? p.gl : p.gr; glove(c, gl.x, gl.y, gl.s, C.HGLV, side, true); }
  c.restore();
}

/* ---------------------------------------------------------------- referee */
const RW = 64, RH = 104, refC = mk(RW, RH), refX = cx2(refC);
function drawRef(c, armDown) {
  c.clearRect(0, 0, RW, RH);
  limb(c, 26, 66, 25, 98, 10, C.RPANT); limb(c, 38, 66, 40, 98, 10, C.RPANT);
  sEll(c, 24, 99, 7, 4, C.SHOE); sEll(c, 41, 99, 7, 4, C.SHOE);
  c.fillStyle = C.RPANT[1]; c.fillRect(20, 60, 25, 10);
  sEll(c, 32, 46, 14, 18, C.RSH);
  c.fillStyle = '#3b6ad0'; c.fillRect(18, 44, 4, 2); c.fillRect(42, 44, 4, 2);
  // bow tie
  c.fillStyle = C.OUT; c.beginPath(); c.moveTo(27, 29); c.lineTo(32, 32); c.lineTo(37, 29); c.lineTo(37, 35); c.lineTo(32, 32); c.lineTo(27, 35); c.fill();
  // arms
  limb(c, 20, 36, 16, 56, 8, C.RSH); sEll(c, 15, 58, 3, 3, C.REF);
  const a = armDown;
  const hx = lerp(52, 50, a), hy = lerp(10, 50, a);
  limb(c, 44, 36, lerp(52, 50, a * 0.6), lerp(22, 42, a), 8, C.RSH); limb(c, lerp(52, 50, a * 0.6), lerp(22, 42, a), hx, hy, 7, C.RSH);
  sEll(c, hx, hy, 3.5, 3.5, C.REF); c.fillStyle = C.REF[1]; c.fillRect(hx - 1, hy - (a < 0.5 ? 6 : -3), 2, 3);
  // head: grey pompadour, specs, chinstrap beard
  sEll(c, 32, 18, 10, 11, C.REF);
  sEll(c, 32, 9, 11, 6, C.RHAIR); c.fillStyle = C.RHAIR[2]; c.fillRect(27, 4, 6, 2);
  c.fillStyle = C.RHAIR[1]; c.fillRect(22, 18, 2, 8); c.fillRect(40, 18, 2, 8); c.fillRect(24, 26, 16, 2);
  c.fillStyle = C.OUT; c.fillRect(25, 16, 6, 4); c.fillRect(33, 16, 6, 4); c.fillRect(31, 17, 2, 1);
  c.fillStyle = '#bfe4ff'; c.fillRect(26, 17, 4, 2); c.fillRect(34, 17, 4, 2);
  c.fillStyle = C.MOUTH; c.fillRect(29, 23, 6, a > 0.5 ? 3 : 1);
}

/* ---------------------------------------------------------------- trainer portrait (Pops) */
const popsC = mk(72, 72);
function drawPops(t) {
  const c = cx2(popsC); c.clearRect(0, 0, 72, 72);
  sEll(c, 36, 74, 30, 18, ['#5a1e10', '#a8381e', '#dc5a34']); // jacket
  c.fillStyle = C.WHT[1]; c.fillRect(14, 58, 44, 8); c.fillStyle = C.WHT[0]; c.fillRect(14, 64, 44, 2); // towel
  sEll(c, 36, 36, 17, 20, ['#7a4a30', '#c08664', '#e2aa86']);
  sEll(c, 36, 20, 19, 8, ['#1a3a2a', '#2e6a46', '#4a9a68']); c.fillStyle = '#1a3a2a'; c.fillRect(17, 22, 38, 3); // flat cap
  c.fillStyle = '#e8e8f0'; c.fillRect(19, 26, 4, 10); c.fillRect(49, 26, 4, 10);
  c.fillStyle = '#e8e8f0'; c.fillRect(26, 30, 8, 3); c.fillRect(38, 30, 8, 3);
  c.fillStyle = C.OUT; c.fillRect(28, 34, 3, 3); c.fillRect(41, 34, 3, 3);
  sEll(c, 36, 42, 4, 4, ['#7a4a30', '#c08664', '#e2aa86']);
  c.fillStyle = '#e8e8f0'; c.fillRect(27, 47, 18, 4); c.fillRect(25, 49, 4, 6); c.fillRect(43, 49, 4, 6);
  c.fillStyle = C.MOUTH; c.fillRect(31, 51, 10, (t * 8 | 0) % 2 ? 3 : 1);
  c.fillStyle = '#c8c8d0'; c.fillRect(46, 52, 2, 8); c.fillStyle = '#ffd84a'; c.fillRect(44, 60, 6, 3); // whistle
  crisp(popsC);
}

/* ---------------------------------------------------------------- arena background */
const bgC = mk(W + 16, H), ringC = mk(W + 16, H);
const crowd = [];
function buildArena() {
  const c = bgC.getContext('2d'); const bw = W + 16;
  const bands = ['#07060f', '#0b0918', '#100d22', '#15112c', '#1a1536', '#1f1940', '#241d4a', '#2a2154'];
  for (let i = 0; i < 14; i++) { c.fillStyle = bands[Math.min(bands.length - 1, i >> 1)]; c.fillRect(0, 24 + i * 6, bw, 6); }
  c.fillStyle = '#07060f'; c.fillRect(0, 0, bw, 26);
  for (let x = 4; x < bw; x += 10) { c.fillStyle = '#5a4a20'; c.fillRect(x, 27, 3, 2); c.fillStyle = '#ffe9a0'; c.fillRect(x + 1, 27, 1, 1); }
  // balcony rail
  c.fillStyle = '#3a2f6a'; c.fillRect(0, 56, bw, 2); c.fillStyle = '#120f26'; c.fillRect(0, 58, bw, 2);
  // banners
  const ban = (x, s, col) => { c.fillStyle = '#1a0d12'; c.fillRect(x - 1, 31, textW(s) + 8, 13); c.fillStyle = col; c.fillRect(x, 32, textW(s) + 6, 11); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, 39, textW(s) + 6, 4); text(c, s, x + 3, 34, { c: '#ffd84a', sh: '#5a0c10' }); };
  ban(4, 'KNUCKLE', '#b0202c'); ban(bw - textW('CIRCUIT') - 11, 'CIRCUIT', '#1f4ab0');
  // crowd members
  crowd.length = 0;
  const skins = ['#f2c6a0', '#d89a70', '#b07048', '#7a4a2e', '#e8b090', '#5a3420'], hairs = ['#1a1010', '#3a2010', '#7a4a20', '#c08a40', '#d8d8e0', '#8a2a1a', '#101018'], shirts = ['#c0302c', '#2a6cc0', '#e8c23a', '#3a9a4a', '#8a3ac0', '#e8e8f0', '#e06a20', '#2aa0a0', '#d04a8a'];
  for (let r = 0; r < 7; r++) {
    const y = 46 + r * 8 + (r > 1 ? 6 : 0), sc = r < 2 ? 0.55 : 0.6 + r * 0.07, step = r < 2 ? 6 : 7 + (r >> 1);
    for (let x = -2 + (r % 2) * 3; x < bw; x += step + ((Math.random() * 2) | 0)) {
      const dim = r < 2 ? 0.35 : 0.5 + r * 0.08;
      crowd.push({ x, y, r, dim: Math.min(1, dim), sk: skins[(Math.random() * skins.length) | 0], hr: hairs[(Math.random() * hairs.length) | 0], sh: shirts[(Math.random() * shirts.length) | 0], ph: Math.random() * 6.28, big: r >= 2, sign: 0 });
    }
  }
  crowd.filter((m) => m.r === 6 && (m.x < 34 || m.x > bw - 40)).slice(0, 4).forEach((m, i) => (m.sign = m.x < 100 ? 1 : 2));
  // ring layer
  const r = ringC.getContext('2d');
  r.fillStyle = '#121a40'; r.fillRect(0, 98, bw, 14); r.fillStyle = '#2a3a86'; r.fillRect(0, 98, bw, 2); r.fillStyle = '#0a0f28'; r.fillRect(0, 110, bw, 2);
  text(r, 'KNUCKLE CIRCUIT', 18, 102, { c: '#ffd84a', sh: '#000' }); text(r, 'KNUCKLE CIRCUIT', bw - 18 - textW('KNUCKLE CIRCUIT'), 102, { c: '#ffd84a', sh: '#000' });
  const fl = ['#6d80aa', '#7487b0', '#7b8eb6', '#8295bc', '#899cc2', '#90a3c8', '#97aacd', '#9eb1d2', '#a5b7d6', '#acbdda'];
  let y = 112; for (let i = 0; i < fl.length; i++) { const hgt = 4 + i * 2; r.fillStyle = fl[i]; r.fillRect(0, y, bw, hgt); y += hgt; }
  r.fillStyle = fl[fl.length - 1]; r.fillRect(0, y, bw, H - y);
  // canvas logo (mostly behind hero)
  r.fillStyle = '#b8c8e4'; r.beginPath(); r.ellipse(bw / 2, 196, 70, 18, 0, 0, Math.PI * 2); r.fill(); r.fillStyle = fl[fl.length - 1]; r.beginPath(); r.ellipse(bw / 2, 196, 64, 15, 0, 0, Math.PI * 2); r.fill();
  // dither the canvas a touch
  for (let yy = 112; yy < H; yy += 2) for (let xx = (yy >> 1) % 2; xx < bw; xx += 6) { r.fillStyle = 'rgba(40,50,90,.12)'; r.fillRect(xx, yy, 1, 1); }
  // posts
  for (const px of [12, bw - 17]) {
    r.fillStyle = '#1a0d12'; r.fillRect(px - 1, 50, 7, 64); r.fillStyle = '#6a7290'; r.fillRect(px, 51, 5, 62); r.fillStyle = '#b8c0d8'; r.fillRect(px + 1, 51, 1, 62);
    [60, 74, 88].forEach((yy, i) => { const col = px < 100 ? ['#c02030', '#ff6a5a'] : ['#2040b0', '#6a90ff']; r.fillStyle = '#1a0d12'; r.fillRect(px - 3, yy - 3, 11, 9); r.fillStyle = col[0]; r.fillRect(px - 2, yy - 2, 9, 7); r.fillStyle = col[1]; r.fillRect(px - 1, yy - 2, 4, 2); });
  }
  // ropes (back + sides)
  const ropeCols = [['#ff5a5a', '#9a1a24'], ['#ffffff', '#8e94ae'], ['#6a90ff', '#1a2a8a']];
  [62, 76, 90].forEach((yy, i) => {
    for (let x = 17; x < bw - 17; x++) { const sag = Math.round(Math.sin(((x - 17) / (bw - 34)) * Math.PI) * 2); r.fillStyle = '#1a0d12'; r.fillRect(x, yy + sag - 1, 1, 4); r.fillStyle = ropeCols[i][0]; r.fillRect(x, yy + sag, 1, 1); r.fillStyle = ropeCols[i][1]; r.fillRect(x, yy + sag + 1, 1, 1); }
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? 12 : bw - 12, y0 = yy + 1, x1 = sd < 0 ? -70 : bw + 70, y1 = 250 + i * 34;
      r.lineCap = 'butt'; r.strokeStyle = '#1a0d12'; r.lineWidth = 5; seg(r, x0, y0, x1, y1); r.strokeStyle = ropeCols[i][1]; r.lineWidth = 3; seg(r, x0, y0, x1, y1); r.strokeStyle = ropeCols[i][0]; r.lineWidth = 1; seg(r, x0, y0 - 1, x1, y1 - 1);
    }
  });
}
function drawCrowd(c, t, excite) {
  for (const m of crowd) {
    const bob = Math.round(Math.max(0, Math.sin(t * (5 + m.r) + m.ph)) * (excite > 0.3 ? 3 : 1) * (m.big ? 1 : 0.6));
    const x = Math.round(m.x), y = m.y - bob;
    const shade = m.dim < 0.5;
    if (!m.big) { c.fillStyle = shade ? '#2a2448' : m.sh; c.fillRect(x, y + 3, 5, 4); c.fillStyle = shade ? '#3a3058' : m.sk; c.fillRect(x + 1, y, 3, 3); continue; }
    c.fillStyle = '#0a0812'; c.fillRect(x - 1, y + 4, 9, 6); c.fillRect(x, y - 1, 7, 6);
    c.fillStyle = m.sh; c.fillRect(x, y + 5, 7, 5); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 5, y + 5, 2, 5);
    c.fillStyle = m.sk; c.fillRect(x + 1, y, 5, 5); c.fillStyle = m.hr; c.fillRect(x + 1, y, 5, 2); c.fillRect(x + 1, y + 2, 1, 1);
    if (excite > 0.3 && Math.sin(t * 7 + m.ph) > 0.4) { c.fillStyle = m.sk; c.fillRect(x - 1, y - 4 - bob, 2, 4); c.fillRect(x + 6, y - 4 - bob, 2, 4); }
    if (m.sign) { const s = m.sign === 1 ? 'PIP!' : 'GUS!'; const sx = x - 6, sy = y - 13 - bob; c.fillStyle = '#1a0d12'; c.fillRect(sx - 1, sy - 1, 28, 11); c.fillStyle = '#f4f0e0'; c.fillRect(sx, sy, 26, 9); text(c, s, sx + 2, sy + 1, { c: m.sign === 1 ? '#19a23a' : '#c9202e' }); }
    if (m.dim < 0.95) { c.fillStyle = `rgba(10,8,30,${(1 - m.dim) * 0.8})`; c.fillRect(x - 1, y - 1, 9, 11); }
  }
}

/* ---------------------------------------------------------------- audio */
const AU = { ctx: null, muted: false, master: null, sfx: null, mus: null, noise: null, crowd: null, crowdG: null, music: null, step: 0, next: 0, timer: 0 };
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {}); return; }
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    AU.ctx = new A(); const a = AU.ctx;
    AU.master = a.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.6; AU.master.connect(a.destination);
    AU.sfx = a.createGain(); AU.sfx.gain.value = 0.9; AU.sfx.connect(AU.master);
    AU.mus = a.createGain(); AU.mus.gain.value = 0.22; AU.mus.connect(AU.master);
    const nb = a.createBuffer(1, a.sampleRate, a.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
    // crowd bed
    const src = a.createBufferSource(); src.buffer = nb; src.loop = true;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    AU.crowdG = a.createGain(); AU.crowdG.gain.value = 0.0; src.connect(bp); bp.connect(AU.crowdG); AU.crowdG.connect(AU.master); src.start();
    AU.timer = setInterval(musicTick, 40);
  } catch (e) { AU.ctx = null; }
}
function setMute(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : 0.6; $('#mute').textContent = 'SOUND: ' + (m ? 'OFF' : 'ON'); try { localStorage.setItem('ko_mute', m ? '1' : '0'); } catch (e) {} }
function tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0, dest) {
  const a = AU.ctx; if (!a) return; const t = a.currentTime + delay;
  const o = a.createOscillator(), gn = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(gn); gn.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq = 1000, type = 'lowpass', delay = 0, f2 = null, dest) {
  const a = AU.ctx; if (!a) return; const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = AU.noise; const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const gn = a.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(gn); gn.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX = {
  punch: (big) => { noise(big ? 0.22 : 0.12, big ? 0.9 : 0.6, big ? 700 : 1100); tone(big ? 140 : 190, big ? 0.22 : 0.12, 'sine', big ? 0.9 : 0.6, 40); if (big) tone(70, 0.3, 'triangle', 0.5, 30); },
  block: () => { tone(320, 0.05, 'square', 0.12, 220); noise(0.05, 0.3, 2500, 'highpass'); },
  whoosh: () => noise(0.16, 0.25, 500, 'bandpass', 0, 2500),
  bell: (n = 1) => { for (let i = 0; i < n; i++) { [1, 2.76, 5.4].forEach((m, j) => tone(830 * m, 1.4 - j * 0.3, 'sine', 0.22 / (j + 1), null, i * 0.32)); } },
  hook: () => { tone(1320, 0.07, 'square', 0.14); tone(1760, 0.1, 'square', 0.14, null, 0.08); },
  upper: () => { tone(110, 0.45, 'sawtooth', 0.16, 70); tone(116, 0.45, 'sawtooth', 0.1, 74); },
  jab: () => tone(2400, 0.03, 'square', 0.1),
  hay: () => tone(200, 1.2, 'square', 0.08, 900),
  taunt: () => { tone(900, 0.18, 'sine', 0.2, 1900); tone(1900, 0.3, 'sine', 0.2, 700, 0.2); },
  star: () => { [988, 1319, 1976].forEach((f, i) => tone(f, 0.12, 'square', 0.12, null, i * 0.06)); },
  starPunch: () => { tone(220, 0.5, 'square', 0.2, 1400); noise(0.5, 0.6, 400, 'lowpass', 0.25); tone(90, 0.5, 'sine', 1, 30, 0.25); },
  count: (n) => { tone(n === 10 ? 330 : 520, 0.18, 'square', 0.18); tone(n === 10 ? 165 : 260, 0.18, 'triangle', 0.2); },
  hurt: () => { tone(300, 0.25, 'square', 0.15, 80); noise(0.2, 0.5, 600); },
  tired: () => { tone(400, 0.12, 'triangle', 0.15, 300); tone(300, 0.2, 'triangle', 0.15, 200, 0.13); },
  flail: () => noise(0.08, 0.15, 800, 'bandpass'),
  select: () => { tone(660, 0.06, 'square', 0.12); tone(990, 0.08, 'square', 0.12, null, 0.06); },
  fall: () => { tone(400, 0.6, 'square', 0.15, 60); noise(0.4, 0.8, 300, 'lowpass', 0.5); },
};
function crowdRoar(v = 1, dur = 1.6) { const a = AU.ctx; if (!a) return; const t = a.currentTime; const gn = AU.crowdG.gain; gn.cancelScheduledValues(t); gn.setValueAtTime(gn.value, t); gn.linearRampToValueAtTime(0.06 + 0.32 * v, t + 0.12); gn.linearRampToValueAtTime(0.06, t + dur); }
function crowdBed(on) { const a = AU.ctx; if (!a) return; const gn = AU.crowdG.gain; gn.cancelScheduledValues(a.currentTime); gn.setTargetAtTime(on ? 0.06 : 0, a.currentTime, 0.4); }
// original chiptune: 32 eighth-notes per loop, A minor
const MEL = {
  fight: { bpm: 152, lead: [69, 0, 72, 69, 76, 0, 74, 72, 69, 0, 72, 69, 67, 0, 64, 0, 69, 0, 72, 69, 76, 0, 79, 76, 74, 72, 74, 76, 69, 0, 0, 0], bass: [45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 43, 43, 55, 43, 45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 40, 40, 52, 40] },
  title: { bpm: 132, lead: [64, 0, 69, 0, 72, 71, 69, 0, 67, 0, 69, 0, 64, 0, 0, 0, 65, 0, 69, 0, 72, 74, 76, 0, 74, 72, 71, 69, 71, 0, 0, 0], bass: [45, 0, 52, 0, 45, 0, 52, 0, 43, 0, 50, 0, 43, 0, 50, 0, 41, 0, 48, 0, 41, 0, 48, 0, 40, 0, 47, 0, 40, 0, 44, 0] },
  win: { bpm: 160, lead: [72, 76, 79, 84, 0, 79, 84, 0, 81, 0, 79, 0, 76, 77, 79, 0, 72, 76, 79, 84, 0, 88, 86, 84, 83, 0, 84, 0, 0, 0, 0, 0], bass: [48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 60, 0, 55, 0, 59, 0, 48, 0, 55, 0, 53, 0, 57, 0, 55, 0, 48, 0, 48, 0, 0, 0] },
};
function playMusic(name) { AU.music = name ? MEL[name] : null; AU.step = 0; if (AU.ctx) AU.next = AU.ctx.currentTime + 0.05; }
function musicTick() {
  const a = AU.ctx; if (!a || !AU.music || S.paused) return; const m = AU.music, sp = 60 / m.bpm / 2;
  if (AU.next < a.currentTime) AU.next = a.currentTime + 0.02;
  while (AU.next < a.currentTime + 0.2) {
    const i = AU.step % 32, t = AU.next - a.currentTime, l = m.lead[i], b = m.bass[i];
    if (l) tone(440 * Math.pow(2, (l - 69) / 12), sp * 0.9, 'square', 0.11, null, t, AU.mus);
    if (b) tone(440 * Math.pow(2, (b - 69) / 12), sp * 0.95, 'triangle', 0.28, null, t, AU.mus);
    if (m === MEL.fight || m === MEL.win) { noise(0.03, i % 2 ? 0.05 : 0.09, 7000, 'highpass', t, null, AU.mus); if (i % 4 === 0) tone(120, 0.1, 'sine', 0.5, 40, t, AU.mus); }
    AU.next += sp; AU.step++;
  }
}

/* ---------------------------------------------------------------- game state */
const ATK = {
  hook: { wind: 0.8, flash: 0.26, strike: 0.11, dmg: 13, dodge: 1, duck: 1, block: 2, win: 1.05, arm: 'R', sfx: 'hook', name: 'WINDOWPANE HOOK' },
  jab: { wind: 0.44, flash: 0, strike: 0.09, dmg: 7, dodge: 1, duck: 1, block: 0, win: 0.65, arm: 'L', sfx: 'jab', name: 'PANE JAB' },
  upper: { wind: 1.0, flash: 0.5, strike: 0.12, dmg: 19, dodge: 1, duck: 0, block: 8, win: 1.2, arm: 'L', sfx: 'upper', name: 'SHATTER UPPERCUT' },
  hay: { wind: 1.55, flash: 1.55, strike: 0.13, dmg: 26, dodge: 1, duck: 1, block: 16, win: 1.4, arm: 'R', sfx: 'hay', name: 'GLASS CANNON' },
};
const PATTERNS = [
  ['hook', 'jab', 'hook', 'taunt', 'upper', 'jab', 'hay', 'hook'],
  ['hook', 'upper', 'jab', 'jab', 'hay', 'hook', 'taunt', 'upper'],
  ['upper', 'hook', 'hay', 'jab', 'hook', 'upper', 'jab', 'hay'],
];
const QUOTES_TAUNT = ['LOVE YA, MA!', 'IS MY HAIR OK?', 'STEEL CHIN! ...ISH', 'SIGN MY GLOVE!'];
const S = { scene: 'title', time: 0, st: 0, paused: false, hold: false };
window.__ko = { S, ATK };
function newFight() {
  Object.assign(S, {
    scene: 'fight', st: 0, phase: 'pre', clock: 180, clockRate: 1.5, round: 1, points: 0, shake: 0, flash: 0, flashCol: '#fff', slow: 0, excite: 0,
    parts: [], texts: [], banner: null, count: null, ref: { x: -70, vis: false, arm: 0 }, result: null, endT: 0, flashes: [], dispPts: 0,
    hero: { state: 'idle', t: 0, dur: 0, hp: 100, hearts: 20, stars: 0, tired: false, side: 0, head: false, hand: 'L', hitDone: false, lastDown: -9, kd: 0, flash: 0, mash: 0, buf: null, starN: 0 },
    opp: { state: 'idle', t: 0, dur: 2.2, atk: null, hp: 100, guard: 'high', gb: 0, guardT: 0, pat: 0, kd: 0, react: null, flash: 0, spam: [], missT0: 0, starGiven: false, wHits: 0, bubble: { text: 'GO EASY, KID!', t: 2.4 }, counter: false, lastHitHero: false, byStar: false, forceTaunt: false, speed: 1 },
  });
  S.stats = { landed: 0, thrown: 0, dodges: 0, stars: 0, kds: 0 };
}
newFight(); S.scene = 'title';

/* ---------------------------------------------------------------- input */
const keys = {};
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyZ: 'punchL', KeyJ: 'punchL', KeyX: 'punchR', KeyK: 'punchR', Enter: 'star', Space: 'star', NumpadEnter: 'star', KeyC: 'guard', KeyL: 'guard', ShiftLeft: 'guard', ShiftRight: 'guard', KeyM: 'mute', KeyP: 'pause', Escape: 'pause', KeyR: 'replay' };
function press(a) {
  auInit();
  if (a === 'mute') { setMute(!AU.muted); return; }
  if (a === 'pause') { if (S.scene === 'fight') { S.paused = !S.paused; $('#pause').textContent = S.paused ? 'RESUME' : 'PAUSE'; } return; }
  if (keys[a]) return; keys[a] = true;
  if (S.paused) return;
  if (S.scene !== 'fight') { if (['star', 'punchL', 'punchR', 'replay', 'tap'].includes(a)) advance(); return; }
  heroAction(a);
}
function release(a) { keys[a] = false; }
addEventListener('keydown', (e) => { const a = KEYMAP[e.code] || (e.key === ' ' ? 'star' : null); if (!a) return; e.preventDefault(); if (e.repeat) return; press(a); });
addEventListener('keyup', (e) => { const a = KEYMAP[e.code] || (e.key === ' ' ? 'star' : null); if (a) { e.preventDefault(); release(a); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('[data-a]').forEach((b) => {
  const a = b.dataset.a;
  const down = (e) => { e.preventDefault(); document.body.classList.add('touch'); b.classList.add('on'); if (b.setPointerCapture && e.pointerId != null) { try { b.setPointerCapture(e.pointerId); } catch (er) {} } press(a); };
  const up = (e) => { e.preventDefault(); b.classList.remove('on'); release(a); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
screenC.addEventListener('pointerdown', (e) => { e.preventDefault(); auInit(); if (S.scene !== 'fight') { press('tap'); release('tap'); } });
$('#mute').addEventListener('click', () => { auInit(); setMute(!AU.muted); });
$('#pause').addEventListener('click', () => press('pause'));
$('#replay').addEventListener('click', () => { auInit(); startBout(true); });
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
try { if (localStorage.getItem('ko_mute') === '1') setMute(true); } catch (e) {}

function advance() {
  SFX.select();
  if (S.scene === 'title') { S.scene = 'intro'; S.st = 0; playMusic('title'); }
  else if (S.scene === 'intro' && S.st > 0.5) { S.scene = 'tip'; S.st = 0; }
  else if (S.scene === 'tip' && S.st > 0.5) startBout(false);
  else if (S.scene === 'end' && S.st > 1.2) startBout(true);
}
function startBout(replay) {
  newFight(); $('#replay').style.display = 'none';
  S.scene = 'fight'; S.phase = 'pre'; S.st = 0; S.banner = { text: 'ROUND 1', t: 0, dur: 1.4, s: 3 }; playMusic(null); crowdBed(true); crowdRoar(0.6, 2);
}

/* ---------------------------------------------------------------- hero logic */
function heroAction(a) {
  const h = S.hero;
  if (S.phase !== 'fight') return;
  if (h.state === 'down') { if (a === 'punchL' || a === 'punchR' || a === 'star') { h.mash++; S.parts.push({ type: 'txt', x: 128 + rnd(-20, 20), y: 150, vy: -30, life: 0.5, t: 0, text: 'UP!', col: '#5eea6c' }); } return; }
  const free = h.state === 'idle' || h.state === 'block' || (h.state === 'punch' && h.t > 0.15) || (h.state === 'dodge' && h.t > 0.38) || (h.state === 'duck' && h.t > 0.3);
  if (!free) { if (a !== 'up' && a !== 'guard') h.buf = { a, t: S.time }; return; }
  doHero(a);
}
function setHero(st, dur) { const h = S.hero; h.state = st; h.t = 0; h.dur = dur; h.hitDone = false; }
function doHero(a) {
  const h = S.hero;
  switch (a) {
    case 'left': case 'right': setHero('dodge', 0.5); h.side = a === 'left' ? -1 : 1; SFX.whoosh(); break;
    case 'down':
      if (S.time - h.lastDown < 0.32) setHero('block', 99); else setHero('duck', 0.45);
      h.lastDown = S.time; break;
    case 'guard': setHero('block', 99); break;
    case 'punchL': case 'punchR':
      if (h.tired) { setHero('flail', 0.35); SFX.flail(); return; }
      setHero('punch', 0.25); h.hand = a === 'punchL' ? 'L' : 'R'; h.head = !!keys.up; S.stats.thrown++; SFX.whoosh(); break;
    case 'star':
      if (h.stars <= 0 || h.tired) { if (h.tired) { setHero('flail', 0.35); SFX.flail(); } return; }
      setHero('star', 0.66); h.starN = h.stars; h.stars = 0; SFX.starPunch(); break;
  }
}
function heroUpdate() {
  const h = S.hero; h.t += DT; if (h.flash > 0) h.flash--;
  switch (h.state) {
    case 'punch': if (!h.hitDone && h.t >= 0.075) { h.hitDone = true; heroPunchHit(false); } if (h.t >= h.dur) setHero('idle', 0); break;
    case 'star': if (!h.hitDone && h.t >= 0.3) { h.hitDone = true; heroPunchHit(true); } if (h.t >= h.dur) setHero('idle', 0); break;
    case 'dodge': if (h.t >= h.dur && !(keys[h.side < 0 ? 'left' : 'right'] && h.t < 0.85)) setHero('idle', 0); break;
    case 'duck': if (h.t >= h.dur && !(keys.down && h.t < 0.85)) setHero('idle', 0); break;
    case 'block': if (!keys.guard && !keys.down) setHero('idle', 0); break;
    case 'hit': case 'flail': if (h.t >= h.dur) setHero('idle', 0); break;
    case 'down': break;
    case 'getup': if (h.t >= 0.8) setHero('idle', 0); break;
  }
  if (h.state === 'idle' && h.buf) { const b = h.buf; h.buf = null; if (S.time - b.t < 0.2) doHero(b.a); }
}
function heroPunchHit(isStar) {
  const h = S.hero, o = S.opp, zone = isStar ? 'head' : h.head ? 'head' : 'body', side = isStar ? 1 : h.hand === 'L' ? -1 : 1;
  const st = o.state;
  if (['falling', 'down', 'getup', 'ko'].includes(st)) return;
  if (isStar) {
    if (st === 'block') { blocked(zone, side); floatText('BLOCKED!', 128, 70, '#ff8a8a'); return; }
    const dmg = 8 + 10 * h.starN;
    landHit(zone, side, dmg, true);
    return;
  }
  if (st === 'idle') {
    trackSpam();
    if (o.state !== 'idle') { blocked(zone, side); return; }
    if ((o.guard === 'high' && zone === 'head') || (o.guard === 'low' && zone === 'body')) { blocked(zone, side); return; }
    landHit(zone, side, 2, false); o.guard = zone === 'head' ? 'high' : 'low'; o.guardT = 0;
    return;
  }
  if (st === 'windup') {
    const a = ATK[o.atk];
    if (zone === 'head' && ((o.atk === 'hook' && o.t >= o.dur - a.flash) || o.atk === 'hay')) { // interrupt at the tell
      landHit(zone, side, 5, false, true); giveStar('INTERRUPT!'); setOpp('stun', 1.0); bubble(pick(['OOF!', 'MY TIMING!', 'HEY!'])); return;
    }
    blocked(zone, side); return;
  }
  if (st === 'miss' || st === 'dizzy' || st === 'stun' || st === 'taunt') {
    let dmg = zone === 'head' ? 4 : 3;
    if (st === 'dizzy') dmg += 1;
    if (st === 'miss' && !o.starGiven && S.time - o.missT0 < 0.55) { o.starGiven = true; dmg = Math.round(dmg * 1.5); giveStar('COUNTER!'); }
    if (st === 'taunt') { giveStar('CHEEKY!'); landHit(zone, side, dmg, false); if (o.hp > 0) setOpp('stun', 0.9); return; }
    landHit(zone, side, dmg, false);
    if (st === 'miss' && o.hp > 0 && ++o.wHits >= 5) { setOpp('dizzy', 2.1); bubble('BIRDIES...'); }
    return;
  }
  blocked(zone, side);
}
function trackSpam() { const o = S.opp; o.spam = o.spam.filter((t) => S.time - t < 1.3); o.spam.push(S.time); if (o.spam.length >= 3) { o.spam = []; setOpp('block', 0.8); o.counter = true; bubble(pick(['NUH-UH!', 'NOT THE FACE!', 'I SAW THAT!'])); } }
function blocked(zone, side) {
  const h = S.hero; SFX.block(); h.hearts = Math.max(0, h.hearts - 1); if (h.hearts === 0) goTired();
  spark(128 + side * 8 + S.opp.x * 0, zone === 'head' ? 70 : 118, false);
  if (h.state === 'punch') h.t = Math.max(h.t, 0.15);
}
function goTired() { const h = S.hero; if (h.tired) return; h.tired = true; SFX.tired(); floatText('PIP IS GASSED!', 128, 140, '#ff9ad0'); }
function giveStar(label) { const h = S.hero; if (h.stars < 3) { h.stars++; S.stats.stars++; } SFX.star(); floatText(label, 128, 44, '#ffd23a'); S.parts.push({ type: 'starfly', x: 128, y: 60, tx: 30 + (h.stars - 1) * 9, ty: 17, t: 0, life: 0.6 }); S.points += 100; }
function landHit(zone, side, dmg, big, interrupt) {
  const o = S.opp;
  o.hp -= dmg; S.points += dmg * 10 + (big ? 400 * S.hero.starN : 0); S.stats.landed++;
  o.react = { zone, side, t: 0 }; o.flash = big ? 8 : 4;
  const sx = 128 + o.x + side * 6, sy = zone === 'head' ? 64 : 116;
  spark(sx, sy, true, big);
  SFX.punch(big || dmg >= 7); S.shake = Math.max(S.shake, big ? 10 : dmg >= 6 ? 4 : 2); S.excite = Math.min(1, S.excite + (big ? 1 : 0.25));
  if (big) { S.flash = 6; S.flashCol = '#fff'; crowdRoar(1, 2); }
  else if (dmg >= 5) crowdRoar(0.4, 0.8);
  if (o.hp <= 0) { o.hp = 0; knockdown(!!big); return; }
  if (big) { setOpp('dizzy', 2.3); bubble('WHO TURNED OFF THE LIGHTS?'); }
}
function spark(x, y, hit, big) {
  S.parts.push({ type: 'burst', x, y, t: 0, life: big ? 0.35 : 0.18, big: !!big, hit });
  const n = big ? 14 : hit ? 6 : 3;
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(40, big ? 160 : 90); S.parts.push({ type: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life: rnd(0.2, 0.45), col: hit ? pick(['#fff', '#fff6b0', '#ffd23a']) : '#c8d0e8' }); }
}
function floatText(text, x, y, col) { S.texts.push({ text, x, y, t: 0, life: 1.1, col }); }
function bubble(text) { S.opp.bubble = { text, t: 1.7 }; }

/* ---------------------------------------------------------------- opponent logic */
function setOpp(st, dur) { const o = S.opp; o.state = st; o.t = 0; o.dur = dur; }
function toIdle() { const o = S.opp; setOpp('idle', rnd(0.75, 1.35) / o.speed); }
function startAttack(atk, windOverride) {
  const o = S.opp, a = ATK[atk]; o.atk = atk; setOpp('windup', windOverride || a.wind / o.speed); SFX[a.sfx]();
  if (atk === 'hay') bubble('HUP! HUP! HUP!');
}
function oppUpdate() {
  const o = S.opp; o.t += DT; if (o.flash > 0) o.flash--;
  if (o.react) { o.react.t += DT; if (o.react.t > 0.24) o.react = null; }
  if (o.bubble) { o.bubble.t -= DT; if (o.bubble.t <= 0) o.bubble = null; }
  o.gb += ((o.guard === 'low' ? 1 : 0) - o.gb) * 0.25;
  switch (o.state) {
    case 'idle':
      o.guardT += DT; if (o.guardT > rnd(1.2, 2.4)) { o.guardT = 0; o.guard = o.guard === 'high' ? 'low' : 'high'; }
      if (o.t >= o.dur && S.phase === 'fight') {
        let nx = o.forceTaunt ? 'taunt' : PATTERNS[Math.min(o.kd, 2)][o.pat++ % 8]; o.forceTaunt = false;
        if (nx === 'taunt') { setOpp('taunt', 1.7); bubble(pick(QUOTES_TAUNT)); SFX.taunt(); o.starGiven = false; } else startAttack(nx);
      }
      break;
    case 'windup': if (o.t >= o.dur) { setOpp('strike', ATK[o.atk].strike); SFX.whoosh(); } break;
    case 'strike': if (o.t >= o.dur) resolveOpp(); break;
    case 'miss': if (o.t >= o.dur) setOpp('recover', 0.3); break;
    case 'recover': if (o.t >= o.dur) toIdle(); break;
    case 'block': if (o.t >= o.dur) { if (o.counter) { o.counter = false; startAttack('jab', 0.3); } else toIdle(); } break;
    case 'taunt': case 'stun': case 'dizzy': if (o.t >= o.dur) toIdle(); break;
    case 'falling': if (o.t >= 0.85) afterFall(); break;
    case 'getup': if (o.t >= 1.1) { toIdle(); o.dur = 0.9; bubble(o.kd === 1 ? 'THAT ONE TICKLED!' : 'I CAN DO THIS ALL DAY... RIGHT?'); } break;
  }
}
function resolveOpp() {
  const o = S.opp, h = S.hero, a = ATK[o.atk];
  const hs = h.state;
  const evaded = (hs === 'dodge' && a.dodge) || (hs === 'duck' && a.duck);
  if (evaded) {
    setOpp('miss', a.win); o.missT0 = S.time; o.starGiven = false; o.wHits = 0; S.stats.dodges++;
    S.points += 20; if (h.tired) { h.tired = false; h.hearts = 6; floatText('SECOND WIND!', 128, 140, '#5eea6c'); }
    if (o.atk !== 'jab') floatText(pick(['WHIFF!', 'MISS!', 'SWISH!']), 128 + (h.side || 0) * -40, 100, '#bfe4ff');
    return;
  }
  if (hs === 'block' && !(o.atk === 'hay')) {
    SFX.block(); spark(128, 150, false); h.hp -= a.block; h.flash = 3; S.shake = 2; setOpp('recover', 0.45);
    if (h.hp <= 0) heroDown(); return;
  }
  // hit!
  const dmg = (hs === 'block' ? a.block : a.dmg);
  h.hp -= dmg; h.hearts = Math.max(0, h.hearts - 3); if (h.hearts === 0) goTired();
  setHero('hit', 0.45); h.flash = 6; SFX.hurt(); SFX.punch(true); S.shake = 7; S.flash = 3; S.flashCol = '#ff3040';
  spark(128, 150, true, false); S.excite = Math.min(1, S.excite + 0.4); crowdRoar(0.5, 1);
  setOpp('recover', 0.55); o.lastHitHero = true;
  if (Math.random() < 0.35) { o.forceTaunt = true; }
  if (h.hp <= 0) heroDown();
}
function knockdown(byStar) {
  const o = S.opp; o.kd++; S.stats.kds++; o.byStar = byStar; setOpp('falling', 0.85); o.react = null; S.slow = 0.45;
  S.points += 1000; SFX.fall(); crowdRoar(1, 3); S.excite = 1; S.flash = 8; S.flashCol = '#fff'; S.shake = 12;
  S.banner = { text: 'DOWN!', t: 0, dur: 1.2, s: 4, col: '#ffd23a' }; o.bubble = null;
}
function afterFall() {
  const o = S.opp;
  if (o.kd >= 3) { setOpp('ko', 99); finish('TKO'); return; }
  setOpp('down', 99);
  const getUp = o.kd === 1 || !o.byStar;
  S.count = { who: 'opp', n: 0, t: -0.6, target: o.kd === 1 ? 4 + ((Math.random() * 2) | 0) : 8, getUp };
  S.ref.vis = true;
}
function heroDown() {
  const h = S.hero; h.hp = 0; h.kd++; setHero('down', 99); h.mash = 0; S.banner = { text: 'PIP IS DOWN!', t: 0, dur: 1.2, s: 2, col: '#ff8a8a' }; SFX.fall();
  if (h.kd >= 3) { finish('LOSS_TKO'); return; }
  S.count = { who: 'hero', n: 0, t: -0.8, need: 9 + h.kd * 5 }; S.ref.vis = true;
}
function countUpdate() {
  const c = S.count; if (!c) return; c.t += DT;
  S.ref.arm = Math.max(0, S.ref.arm - DT * 3);
  if (c.t >= 1) {
    c.t = 0; c.n++; SFX.count(c.n); S.ref.arm = 1; S.banner = { text: String(c.n), t: 0, dur: 0.85, s: 5, col: '#fff' };
    if (c.who === 'opp') {
      if (c.getUp && c.n >= c.target) { S.count = null; S.ref.vis = false; setOpp('getup', 1.1); S.opp.hp = S.opp.kd === 1 ? 75 : 50; S.opp.speed = 1 + 0.14 * S.opp.kd; S.opp.pat = 0; crowdRoar(0.6, 1.5); return; }
      if (c.n >= 10) { S.count = null; setOpp('ko', 99); finish('KO'); return; }
    } else {
      const h = S.hero;
      if (h.mash >= c.need && c.n >= 3) { S.count = null; S.ref.vis = false; h.hp = 45; setHero('getup', 0.8); h.hearts = Math.max(h.hearts, 10); h.tired = false; crowdRoar(0.6, 1.5); return; }
      if (c.n >= 10) { S.count = null; finish('LOSS_KO'); return; }
    }
  }
}
function finish(type) {
  if (S.result) return;
  const elapsed = 180 - S.clock;
  S.result = { type, elapsed, points: S.points };
  const win = type === 'KO' || type === 'TKO' || type === 'DEC_W';
  if (win) { S.result.bonus = Math.round(S.clock) * 10; S.points += S.result.bonus; S.result.points = S.points; }
  S.phase = 'over'; S.endT = 0; SFX.bell(type === 'DEC_W' || type === 'DEC_L' ? 1 : 4); crowdRoar(1, 4);
  S.banner = { text: type === 'KO' ? 'K.O.!' : type === 'TKO' ? 'T.K.O.!' : type.startsWith('DEC') ? 'TIME!' : 'K.O.', t: 0, dur: 3, s: 6, col: win ? '#ffd23a' : '#ff6a6a', big: true };
  S.flash = 10; S.flashCol = '#fff'; S.slow = 0.9;
  if (win) { try { const best = +localStorage.getItem('ko_best') || 0; if (!best || elapsed < best) { localStorage.setItem('ko_best', String(elapsed)); S.result.best = true; } S.result.bestT = Math.min(best || 999, elapsed); } catch (e) {} }
  window.__koDone = S.result;
}

/* ---------------------------------------------------------------- main update */
function update() {
  S.time += DT; S.st += DT;
  if (S.scene !== 'fight') return;
  if (S.slow > 0) { S.slow -= DT; if (Math.floor(S.slow * 60) % 3) { tickFx(); return; } }
  const h = S.hero, o = S.opp;
  if (S.phase === 'pre') {
    if (S.st > 1.6 && !S.belled) { S.belled = true; SFX.bell(1); S.banner = { text: 'FIGHT!', t: 0, dur: 0.9, s: 4, col: '#ffd23a' }; }
    if (S.st > 2.3) { S.phase = 'fight'; playMusic('fight'); S.belled = false; }
  }
  if (S.phase === 'fight' && !S.count && !['falling', 'down', 'getup'].includes(o.state) && h.state !== 'down') {
    S.clock -= DT * S.clockRate;
    if (S.clock <= 0) { S.clock = 0; finish(S.opp.kd > h.kd || (S.opp.kd === h.kd && S.points >= 1500) ? 'DEC_W' : 'DEC_L'); }
  }
  if (S.phase !== 'over') { heroUpdate(); oppUpdate(); countUpdate(); }
  else {
    S.endT += DT; heroUpdate(); if (o.state !== 'ko') oppUpdate();
    if (S.endT > 3.2 && S.scene === 'fight') { S.scene = 'end'; S.st = 0; playMusic(S.result.type.startsWith('LOSS') || S.result.type === 'DEC_L' ? 'title' : 'win'); $('#replay').style.display = 'block'; crowdBed(false); }
  }
  // ref walk
  const rx = S.ref.vis ? 14 : -70; S.ref.x += (rx - S.ref.x) * 0.08;
  tickFx();
}
function tickFx() {
  S.shake *= 0.85; if (S.shake < 0.3) S.shake = 0; if (S.flash > 0) S.flash--; S.excite = Math.max(0, S.excite - DT * 0.25);
  if (S.banner) { S.banner.t += DT; if (S.banner.t > S.banner.dur) S.banner = null; }
  for (const p of S.parts) { p.t += DT; if (p.type === 'p') { p.x += p.vx * DT; p.y += p.vy * DT; p.vy += 260 * DT; } if (p.type === 'txt') p.y += p.vy * DT; }
  S.parts = S.parts.filter((p) => p.t < p.life);
  for (const t of S.texts) t.t += DT; S.texts = S.texts.filter((t) => t.t < t.life);
  if (Math.random() < 0.03 + S.excite * 0.25) S.flashes.push({ x: rnd(4, W + 12), y: rnd(44, 98), t: 0 });
  S.flashes = S.flashes.filter((f) => (f.t += DT) < 0.12);
  S.dispPts += Math.ceil((S.points - S.dispPts) / 6);
}

/* ---------------------------------------------------------------- poses */
const Q = (t) => Math.floor(t * 15) / 15;
function oppPose() {
  const o = S.opp, T = Q(S.time), t = Q(o.t), r = clamp(t / (o.dur || 1), 0, 1);
  const bob = Math.round(Math.sin(T * 6) * 1.5);
  const gb = o.gb;
  const p = { x: 0, y: bob, lean: 0, hx: 0, hy: 0, ht: 0, brow: 0, eyes: 'open', mouth: 'smile', blush: 0.3, sweat: 0, front: null, shl: 0, shr: 0, belly: 1, sit: 0, flat: 0, look: 0, lid: 0, crack: o.hp < 40 || o.kd > 0, spin: T * 6,
    gl: { x: lerp(68, 62, gb), y: lerp(68, 108, gb) + bob, s: 1, f: 0 }, gr: { x: lerp(104, 110, gb), y: lerp(68, 108, gb) + bob, s: 1, f: 0 } };
  const flash = Math.floor(S.time * 15) % 2 === 0;
  const a = o.atk && ATK[o.atk];
  switch (o.state) {
    case 'idle':
      if ((T % 3.3) < 0.13) p.eyes = 'blink';
      if (o.lastHitHero && o.t < 0.8) p.mouth = 'smug';
      break;
    case 'windup': {
      if (o.atk === 'hook') {
        const e = ease(Math.min(1, r * 2.2));
        p.gr = { x: lerp(104, 140, e), y: lerp(68, 54, e), s: 0.95, f: (o.t >= o.dur - a.flash && flash) ? 1 : 0 };
        p.shr = -5 * e; p.lean = -0.07 * e; p.brow = r > 0.06 ? 1 : 0; p.hairUp = -2; p.mouth = o.t >= o.dur - a.flash ? 'grit' : 'smile'; p.hx = 2 * e; p.look = 1;
      } else if (o.atk === 'jab') {
        p.hx = (Math.floor(S.time * 30) % 2) ? 1 : -1; p.nose = (Math.floor(S.time * 20) % 2) ? 1 : -1;
        if (r > 0.25 && r < 0.6) p.eyes = 'blink';
        p.gl = { x: 58, y: 80, s: 1, f: 0 }; p.mouth = 'o';
      } else if (o.atk === 'upper') {
        const e = ease(Math.min(1, r * 1.8));
        p.y += Math.round(8 * e); p.gl = { x: lerp(68, 64, e), y: lerp(68, 136, e), s: 1.05, f: (r > 0.5 && flash) ? 2 : 0 };
        p.brow = -1; p.mouth = 'grit'; p.sweat = 1; p.lean = 0.04 * e; p.shl = 4 * e; p.lid = 0.35;
      } else if (o.atk === 'hay') {
        const ang = -Math.PI / 2 + r * Math.PI * 5;
        p.gr = { x: 120 + Math.cos(ang) * 28, y: 62 + Math.sin(ang) * 28, s: 1.05, f: r > 0.78 && flash ? 1 : 0 };
        p.brow = 1; p.eyes = 'wide'; p.mouth = 'o'; p.lean = -0.04 + Math.sin(ang) * 0.03; p.shr = -4; p.gl = { x: 60, y: 104 + bob, s: 1, f: 0 };
      }
      break;
    }
    case 'strike': {
      const e = easeOut(r); p.front = a.arm; p.mouth = 'grit'; p.brow = -1;
      const g0 = a.arm === 'R' ? p.gr : p.gl;
      const from = o.atk === 'hook' ? [140, 54] : o.atk === 'jab' ? [58, 80] : o.atk === 'upper' ? [64, 136] : [148, 62];
      const to = o.atk === 'upper' ? [86, 104] : o.atk === 'hay' ? [92, 116] : [a.arm === 'R' ? 96 : 76, 118];
      const sc = o.atk === 'hay' ? 2.5 : o.atk === 'upper' ? 2.3 : o.atk === 'hook' ? 2.1 : 1.9;
      const gg = { x: lerp(from[0], to[0], e), y: lerp(from[1], to[1], e), s: lerp(1, sc, e), f: 0 };
      if (a.arm === 'R') p.gr = gg; else p.gl = gg;
      p.lean = (a.arm === 'R' ? 0.08 : -0.06) * e; p.y += o.atk === 'upper' ? -4 : 2; void g0;
      break;
    }
    case 'miss': {
      const e = ease(clamp(o.t / (o.dur * 0.9), 0, 1));
      const gg = { x: lerp(a.arm === 'R' ? 60 : 112, a.arm === 'R' ? 100 : 72, e), y: lerp(124, 96, e), s: lerp(1.7, 1.1, e), f: 0 };
      if (a.arm === 'R') { p.gr = gg; p.gl = { x: 46, y: 98, s: 1, f: 0 }; } else { p.gl = gg; p.gr = { x: 126, y: 98, s: 1, f: 0 }; }
      p.lean = (a.arm === 'R' ? -0.14 : 0.14) * (1 - e); p.x = (a.arm === 'R' ? -8 : 8) * (1 - e); p.y += 5;
      p.eyes = 'wide'; p.mouth = 'o'; p.brow = 1; p.sweat = 1; p.blush = 0.8; p.look = 0;
      break;
    }
    case 'recover': p.mouth = o.lastHitHero ? 'smug' : 'grit'; break;
    case 'block': p.gl = { x: 76, y: 66, s: 1.15, f: 0 }; p.gr = { x: 96, y: 72, s: 1.15, f: 0 }; p.hy = 3; p.eyes = 'squint'; p.mouth = 'grit'; p.brow = -1; break;
    case 'taunt': p.gr = { x: 132 + Math.round(Math.sin(T * 14) * 5), y: 26, s: 1, f: 0 }; p.gl = { x: 90, y: 70, s: 0.95, f: 0 }; p.shr = -6; p.eyes = 'happy'; p.blush = 1; p.mouth = 'kiss'; p.hx = 5; p.ht = 0.12; break;
    case 'stun': p.eyes = 'swirl'; p.mouth = 'ow'; p.gl = { x: 62, y: 114, s: 1, f: 0 }; p.gr = { x: 108, y: 114, s: 1, f: 0 }; p.x = Math.round(Math.sin(T * 9) * 3); p.ht = Math.sin(T * 9) * 0.08; break;
    case 'dizzy': p.eyes = 'swirl'; p.mouth = 'tongue'; p.gl = { x: 58, y: 124, s: 1, f: 0 }; p.gr = { x: 112, y: 124, s: 1, f: 0 }; p.x = Math.round(Math.sin(T * 4) * 6); p.ht = Math.sin(T * 4) * 0.16; p.lean = Math.sin(T * 4) * 0.04; p.blush = 0.8; break;
    case 'falling': {
      const e = ease(o.t / 0.85);
      if (o.t < 0.25) { p.hx = 6; p.ht = 0.3; p.eyes = 'x'; p.mouth = 'ow'; p.gl = { x: 40, y: 50, s: 1, f: 0 }; p.gr = { x: 132, y: 50, s: 1, f: 0 }; p.y -= 4; }
      else { p.sit = e; p.eyes = 'x'; p.mouth = 'tongue'; p.gl = { x: lerp(40, 38, e), y: lerp(50, 120, e), s: 1, f: 0 }; p.gr = { x: lerp(132, 134, e), y: lerp(50, 120, e), s: 1, f: 0 }; p.ht = 0.25; }
      break;
    }
    case 'down': {
      p.sit = 1; p.y = 0; p.eyes = S.count && S.count.n >= (S.count.target || 99) - 2 && S.count.getUp ? 'swirl' : 'x'; p.mouth = 'tongue'; p.ht = Math.sin(T * 2) * 0.15;
      p.gl = { x: 38, y: 120, s: 1, f: 0 }; p.gr = { x: 134, y: 120, s: 1, f: 0 };
      if (S.count && S.count.getUp && S.count.n >= S.count.target - 1) { p.eyes = 'squint'; p.mouth = 'grit'; p.ht = Math.sin(T * 20) * 0.08; }
      break;
    }
    case 'getup': { const e = ease(o.t / 1.0); p.sit = 1 - e; p.x = Math.round(Math.sin(T * 25) * 2 * (1 - e)); p.eyes = 'squint'; p.mouth = 'grit'; p.sweat = 1; p.gl = { x: lerp(38, 68, e), y: lerp(120, 68, e), s: 1, f: 0 }; p.gr = { x: lerp(134, 104, e), y: lerp(120, 68, e), s: 1, f: 0 }; break; }
    case 'ko': p.flat = 1; break;
  }
  if (o.react) {
    const k = 1 - o.react.t / 0.24;
    if (o.react.zone === 'head') { p.hx += o.react.side * 6 * k; p.ht += o.react.side * 0.28 * k; p.eyes = 'shut'; p.mouth = 'ow'; p.x += o.react.side * 2 * k; p.blush = 1; }
    else { p.y += 4 * k; p.hy += 5 * k; p.belly = 1 + 0.1 * k; p.eyes = 'wide'; p.mouth = 'o'; p.lean += -o.react.side * 0.05 * k; }
  }
  if (o.hp < 30 && o.state === 'idle') p.sweat = 1;
  return p;
}
function heroPose() {
  const h = S.hero, T = Q(S.time), t = Q(h.t), r = clamp(t / (h.dur || 1), 0, 1);
  const bob = h.tired ? Math.round(Math.sin(T * 4) * 2.5) : Math.round(Math.sin(T * 7) * 1.5);
  const p = { x: 0, y: bob, lean: 0, hx: 0, hy: 0, gl: { x: 44, y: 114 + bob, s: 1 }, gr: { x: 96, y: 114 + bob, s: 1 } };
  if (h.tired) { p.gl.y += 8; p.gr.y += 8; p.hy = 2; }
  const env = (r, a = 0.18, b = 0.82) => (r < a ? ease(r / a) : r > b ? 1 - ease((r - b) / (1 - b)) : 1);
  switch (h.state) {
    case 'dodge': { const e = h.t > h.dur ? 1 : env(r, 0.16, 0.8); p.x = h.side * 32 * e; p.lean = h.side * 0.24 * e; p.hx = h.side * 3 * e; p.y += 5 * e; break; }
    case 'duck': { const e = h.t > h.dur ? 1 : env(r, 0.2, 0.8); p.y += 24 * e; p.gl = { x: 52, y: 132, s: 1 }; p.gr = { x: 88, y: 132, s: 1 }; p.hy = 4 * e; break; }
    case 'block': p.y += 3; p.gl = { x: 58, y: 110, s: 1.05 }; p.gr = { x: 82, y: 110, s: 1.05 }; p.hy = 2; break;
    case 'punch': {
      const ext = r < 0.32 ? ease(r / 0.32) : 1 - ease((r - 0.32) / 0.68);
      const L = h.hand === 'L', tgt = h.head ? [L ? 62 : 78, 30] : [L ? 58 : 82, 80];
      const g0 = L ? p.gl : p.gr; const gg = { x: lerp(g0.x, tgt[0], ext), y: lerp(g0.y, tgt[1], ext), s: lerp(1, 0.72, ext) };
      if (L) p.gl = gg; else p.gr = gg;
      p.y += -6 * ext; p.lean = (L ? 0.07 : -0.07) * ext; p.x = (L ? 3 : -3) * ext;
      break;
    }
    case 'star': {
      if (h.t < 0.28) { const e = ease(h.t / 0.28); p.y += 12 * e; p.gr = { x: lerp(98, 94, e), y: lerp(120, 156, e), s: 1 }; p.lean = 0.1 * e; p.gl.y += 6 * e; }
      else { const e = ease(clamp((h.t - 0.28) / 0.12, 0, 1)) * (1 - ease(clamp((h.t - 0.5) / 0.16, 0, 1))); p.y += -14 * e; p.gr = { x: lerp(94, 78, e), y: lerp(156, 14, e), s: lerp(1, 0.82, e) }; p.lean = -0.12 * e; }
      break;
    }
    case 'hit': { const k = 1 - r; p.x = Math.round(Math.sin(h.t * 60) * 3 * k); p.y += 10 * k; p.hy = 5 * k; p.gl.y += 10 * k; p.gr.y += 10 * k; break; }
    case 'flail': { const k = Math.sin(r * Math.PI); p.gl.x += 6 * k; p.gr.x -= 6 * k; p.gl.y += 6; p.gr.y += 6; p.hy = 3; break; }
    case 'down': { const e = ease(Math.min(1, h.t / 0.6)); p.y += 70 * e; p.lean = 0.25 * e; p.gl.y += 30 * e; p.gr.y += 30 * e; break; }
    case 'getup': { const e = 1 - ease(h.t / 0.8); p.y += 70 * e; break; }
  }
  const oppOut = ['falling', 'down', 'ko'].includes(S.opp.state) || (S.count && S.count.who === 'opp');
  if (oppOut && h.state !== 'down') { const e = ease(Math.min(1, (S.opp.state === 'falling' ? S.opp.t : 1) / 0.8)); p.x += 46 * e; p.lean += 0.06 * e; }
  if (S.scene === 'end' || (S.phase === 'over' && S.endT > 1 && S.result && !S.result.type.startsWith('LOSS') && S.result.type !== 'DEC_L')) { const b = Math.round(Math.abs(Math.sin(T * 6)) * 4); p.gl = { x: 36, y: 98 - b, s: 1 }; p.gr = { x: 104, y: 98 - b, s: 1 }; p.y = -b; p.lean = 0; p.x = S.scene === 'end' ? 0 : 46; }
  return p;
}

/* ---------------------------------------------------------------- render */
function renderWorld(dim) {
  const sx = S.shake ? Math.round(rnd(-S.shake, S.shake)) : 0, sy = S.shake ? Math.round(rnd(-S.shake, S.shake) * 0.6) : 0;
  g.save(); g.translate(sx - 8, sy);
  g.drawImage(bgC, 0, 0);
  drawCrowd(g, S.time, S.excite);
  for (const f of S.flashes) { const k = f.t < 0.05 ? 3 : 1; twinkle(g, f.x, f.y, k, '#fff'); }
  // spot beams
  g.globalAlpha = 0.06; g.fillStyle = '#fff6d0';
  g.beginPath(); g.moveTo(40, 24); g.lineTo(58, 24); g.lineTo(150, 224); g.lineTo(90, 224); g.fill();
  g.beginPath(); g.moveTo(214, 24); g.lineTo(232, 24); g.lineTo(186, 224); g.lineTo(126, 224); g.fill();
  g.globalAlpha = 1;
  g.drawImage(ringC, 0, 0);
  g.restore();
  g.save(); g.translate(sx, sy);
  const o = S.opp, op = oppPose();
  // floor shadow
  g.fillStyle = 'rgba(30,36,72,.45)'; g.beginPath(); g.ellipse(128 + op.x, op.flat ? 196 : 200, op.flat ? 66 : 46, 9, 0, 0, Math.PI * 2); g.fill();
  // ref
  if (S.ref.x > -64) { drawRef(refX, S.ref.arm > 0.5 ? 1 : 0); crisp(refC); g.drawImage(refC, Math.round(S.ref.x), 84); }
  drawOpp(oppX, op, op.front ? 'body' : 'all'); crisp(oppC); if (o.flash > 0 && (o.flash % 2 === 0 || o.flash > 5)) tint(oppC, 'rgba(255,255,255,.65)');
  g.drawImage(oppC, OX0, OY0);
  // tell glints
  if (o.state === 'windup' && o.atk === 'hook' && o.t >= o.dur - ATK.hook.flash) twinkle(g, OX0 + op.gr.x + 8, OY0 + op.gr.y - 10, 3 + (Math.floor(S.time * 20) % 2), '#fff');
  if (o.state === 'windup' && o.atk === 'upper' && o.t / o.dur > 0.5) twinkle(g, OX0 + op.gl.x - 9, OY0 + op.gl.y - 8, 2 + (Math.floor(S.time * 20) % 2), '#ff8a8a');
  if (o.state === 'windup' && o.atk === 'hook') { // eyebrow "!" pop
    const bx = OX0 + 86 + op.hx, by = OY0 + 10; if (o.t < 0.35) text(g, '!', bx + 26, by - 2, { c: '#ffd23a', ol: C.OUT });
  }
  if (o.state === 'dizzy' || o.state === 'stun' || (o.state === 'down' && S.count)) { // orbiting stars
    for (let i = 0; i < 3; i++) { const a = S.time * 5 + (i * Math.PI * 2) / 3; const x = OX0 + 86 + op.x + op.hx + Math.cos(a) * 24, y = OY0 + 18 + op.y + 52 * op.sit + Math.sin(a) * 6; star(g, Math.round(x), Math.round(y), 4, C.STAR[1], C.STAR[2]); }
  }
  // hero
  const h = S.hero;
  if (S.scene === 'fight' || S.scene === 'end' || S.scene === 'title') {
    const hp = heroPose(); drawHero(heroX, hp); crisp(heroC);
    if (h.tired) tint(heroC, 'rgba(255,110,190,.45)');
    if (h.flash > 0 && h.flash % 2 === 0) tint(heroC, 'rgba(255,60,80,.55)');
    g.globalAlpha = 0.86; g.drawImage(heroC, HX0, HY0); g.globalAlpha = 1;
  }
  if (op.front) { drawOpp(oppFX, op, 'front'); crisp(oppF); g.drawImage(oppF, OX0, OY0); }
  // particles
  for (const p of S.parts) {
    const k = p.t / p.life;
    if (p.type === 'burst') {
      const R = (p.big ? 26 : p.hit ? 14 : 8) * (0.4 + k);
      g.strokeStyle = p.hit ? (k < 0.5 ? '#ffffff' : '#ffd23a') : '#c8d0e8'; g.lineWidth = p.big ? 3 : 2;
      for (let i = 0; i < (p.big ? 12 : 8); i++) { const a = (i / (p.big ? 12 : 8)) * Math.PI * 2 + 0.2; const r0 = R * 0.45; seg(g, Math.round(p.x + Math.cos(a) * r0), Math.round(p.y + Math.sin(a) * r0), Math.round(p.x + Math.cos(a) * R), Math.round(p.y + Math.sin(a) * R)); }
      if (k < 0.4 && p.hit) star(g, p.x, p.y, p.big ? 14 : 7, '#ffffff', '#fff6b0');
    } else if (p.type === 'p') { g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    else if (p.type === 'starfly') { const e = ease(k); star(g, Math.round(lerp(p.x, p.tx, e)), Math.round(lerp(p.y, p.ty - 30 * Math.sin(k * Math.PI), e)), 5, C.STAR[1], C.STAR[2]); }
    else if (p.type === 'txt') text(g, p.text, p.x, p.y, { c: p.col, ol: C.OUT, al: 'c' });
  }
  g.restore();
  // speech bubble
  if (o.bubble && S.scene === 'fight' && !op.flat) drawBubble(o.bubble.text, OX0 + 86 + op.x + 30, 30 + op.y + (op.sit ? 46 : 0));
  // float texts
  for (const t of S.texts) { const y = Math.round(t.y - t.t * 20); if (t.t < t.life - 0.15 || Math.floor(t.t * 20) % 2) text(g, t.text, t.x, y, { c: t.col, ol: C.OUT, al: 'c' }); }
  if (dim) { g.fillStyle = `rgba(6,4,14,${dim})`; g.fillRect(0, 0, W, H); }
}
function drawBubble(s, x, y) {
  const lines = wrap(s, 14), w = Math.max(...lines.map((l) => textW(l))) + 8, hh = lines.length * 9 + 5;
  x = clamp(x, 4, W - w - 4); y = Math.max(28, y);
  g.fillStyle = C.OUT; g.fillRect(x - 1, y - 1, w + 2, hh + 2); g.fillStyle = '#fff'; g.fillRect(x, y, w, hh);
  g.fillStyle = C.OUT; g.fillRect(x + 3, y + hh, 6, 3); g.fillRect(x + 1, y + hh + 3, 4, 2); g.fillStyle = '#fff'; g.fillRect(x + 4, y + hh - 1, 4, 3); g.fillRect(x + 2, y + hh + 2, 2, 1);
  lines.forEach((l, i) => text(g, l, x + 4, y + 3 + i * 9, { c: '#2a0c10' }));
}
function wrap(s, n) { const out = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; }
function bar(x, y, w, v, cols, right) {
  g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, 8); g.fillStyle = '#3a1830'; g.fillRect(x, y, w, 6);
  const f = Math.round(w * clamp(v / 100, 0, 1)), col = v > 45 ? cols[0] : v > 22 ? '#ffd23a' : '#ff4040';
  const fx = right ? x + w - f : x;
  g.fillStyle = col; g.fillRect(fx, y, f, 6); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(fx, y, f, 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(fx, y + 5, f, 1);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = x + 8; i < x + w; i += 8) g.fillRect(i, y, 1, 6);
}
function renderHUD() {
  const h = S.hero, o = S.opp;
  g.fillStyle = '#0a0814'; g.fillRect(0, 0, W, 26); g.fillStyle = '#c89a2a'; g.fillRect(0, 25, W, 1); g.fillStyle = '#2a2050'; g.fillRect(0, 26, W, 1);
  text(g, 'PIP', 3, 3, { c: '#5eea6c', sh: '#000' }); bar(23, 3, 80, h.hp, ['#3ad65a']);
  text(g, 'GUS', 253, 3, { c: '#ff6a5a', sh: '#000', al: 'r' }); bar(153, 3, 80, o.hp, ['#ff5a4a'], true);
  // clock
  const cl = Math.ceil(S.clock), m = Math.floor(cl / 60), sec = String(cl % 60).padStart(2, '0');
  g.fillStyle = '#000'; g.fillRect(108, 1, 40, 14); g.fillStyle = '#1e1838'; g.fillRect(109, 2, 38, 12);
  text(g, m + ':' + sec, 128, 5, { c: S.clock < 30 ? '#ff6a6a' : '#fff6b0', al: 'c' });
  text(g, 'ROUND ' + S.round, 128, 17, { c: '#9a96c8', al: 'c' });
  // hearts
  icon(g, HEART, 4, 15, h.tired ? '#ff9ad0' : '#ff4a6a', '#000'); text(g, String(h.hearts).padStart(2, '0'), 14, 15, { c: h.tired ? '#ff9ad0' : '#fff' });
  for (let i = 0; i < 3; i++) icon(g, STARI, 30 + i * 9, 15, i < h.stars ? (Math.floor(S.time * 6) % 2 && i === h.stars - 1 ? '#fff6b0' : '#ffd23a') : '#3a3458', '#000');
  text(g, String(S.dispPts).padStart(6, '0'), 253, 15, { c: '#fff', al: 'r' });
  text(g, 'PTS', 253 - 40, 15, { c: '#9a96c8', al: 'r' });
  if (o.kd) for (let i = 0; i < o.kd; i++) { g.fillStyle = '#ffd23a'; g.fillRect(153 + i * 5, 16, 3, 5); }
}
function renderBanner() {
  const b = S.banner; if (!b) return;
  const k = b.t / b.dur, s = b.s || 3;
  const sc = k < 0.12 ? Math.max(1, Math.round(s * (0.5 + k * 4))) : s;
  const y = b.big ? 34 : 62 - sc * 3;
  if (b.big) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y - 12, W, sc * 7 + 24); }
  text(g, b.text, 128, y, { al: 'c', s: sc, c: b.col || '#fff', c2: b.big ? '#ff8a20' : null, ol: C.OUT, olw: Math.max(1, sc >> 1), sh: '#000', shd: sc });
}
function renderTitle() {
  newFightPreviewPose();
  renderWorld(0.35);
  g.fillStyle = 'rgba(6,4,14,.55)'; g.fillRect(0, 0, W, H);
  // logo
  const bob = Math.round(Math.sin(S.time * 3) * 2);
  text(g, 'KNOCKOUT!', 128, 30 + bob, { s: 4, c: '#ffe24a', c2: '#ff7a1a', ol: '#5a0c10', olw: 2, sh: '#000', shd: 4, al: 'c' });
  g.fillStyle = '#c9202e'; g.fillRect(58, 66, 140, 13); g.fillStyle = C.OUT; g.fillRect(58, 79, 140, 1);
  text(g, 'ROUND ONE', 128, 69, { c: '#fff', al: 'c' });
  text(g, 'AN UNDERDOG BOXING TALE', 128, 88, { c: '#bfe4ff', al: 'c', sh: '#000' });
  if (Math.floor(S.time * 2) % 2) text(g, document.body.classList.contains('touch') ? 'TAP TO START' : 'PRESS ENTER', 128, 190, { s: 2, c: '#fff', ol: C.OUT, al: 'c' });
  text(g, 'AN ORIGINAL GAME  2026', 128, 212, { c: '#6a66a0', al: 'c' });
}
function newFightPreviewPose() { /* title uses the idle bout state already built by newFight() */ }
function renderIntro() {
  const T = S.st;
  g.fillStyle = '#120a24'; g.fillRect(0, 0, W, H);
  // starburst
  g.save(); g.translate(128, 92); g.rotate(T * 0.2);
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2a1a52' : '#3c2470'; g.beginPath(); g.moveTo(0, 0); const a = (i / 16) * Math.PI * 2, b = ((i + 1) / 16) * Math.PI * 2; g.lineTo(Math.cos(a) * 240, Math.sin(a) * 240); g.lineTo(Math.cos(b) * 240, Math.sin(b) * 240); g.fill(); }
  g.restore();
  // portrait
  const o = S.opp; const saved = { state: o.state, t: o.t, bubble: o.bubble, react: o.react, hp: o.hp, kd: o.kd };
  o.state = 'idle'; o.t = 0.5; o.react = null; o.hp = 100; o.kd = 0;
  const p = oppPose(); p.mouth = T % 2.4 < 1.2 ? 'smile' : 'smug'; p.brow = Math.floor(T * 1.5) % 4 === 0 ? 1 : 0; p.crack = false;
  drawOpp(oppX, p, 'all'); crisp(oppC);
  Object.assign(o, saved);
  const slide = Math.round((1 - easeOut(Math.min(1, T * 2.5))) * 160);
  g.save(); g.beginPath(); g.rect(0, 22, W, 130); g.clip(); g.drawImage(oppC, OX0 + slide, 22); g.restore();
  g.fillStyle = '#c9202e'; g.fillRect(0, 22, W, 2); g.fillRect(0, 150, W, 2);
  // name plates
  text(g, 'ROUND 1  VS', 6, 4, { c: '#9a96c8' });
  text(g, '"THE GLASS"', 250, 4, { c: '#bfe4ff', al: 'r', sh: '#000' });
  text(g, 'GUS GRUBER', 128 - slide, 30, { s: 2, c: '#ffe24a', c2: '#ff7a1a', ol: C.OUT, sh: '#000', shd: 2, al: 'c' });
  g.fillStyle = '#0a0814'; g.fillRect(0, 152, W, 72);
  const L = [['FROM', 'SHATTERVILLE, PA'], ['AGE', '41   WEIGHT 211 LB'], ['RECORD', '2-37  (0 KO WINS)'], ['RANK', '#12 KNUCKLE CIRCUIT']];
  L.forEach(([k, v], i) => { text(g, k, 8, 156 + i * 9, { c: '#9a96c8' }); text(g, v, 56, 156 + i * 9, { c: '#fff' }); });
  text(g, '"I BRUISE LIKE A PEACH,', 128, 196, { c: '#ffd23a', al: 'c' });
  text(g, 'BUT I BOUNCE LIKE ONE TOO!"', 128, 205, { c: '#ffd23a', al: 'c' });
  if (T > 0.6 && Math.floor(T * 2) % 2) text(g, '>', 246, 214, { c: '#fff' });
}
function renderTip() {
  const T = S.st;
  g.fillStyle = '#0c1a14'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 4) { g.fillStyle = y % 8 ? '#0f2018' : '#0c1a14'; g.fillRect(0, y, W, 4); }
  text(g, 'CORNER ADVICE', 128, 8, { s: 2, c: '#5eea6c', ol: C.OUT, sh: '#000', shd: 2, al: 'c' });
  drawPops(T); g.drawImage(popsC, 8, 30); text(g, 'POPS', 44, 104, { c: '#ffd23a', al: 'c' });
  text(g, 'YOUR TRAINER', 44, 113, { c: '#6a9a7a', al: 'c' });
  g.fillStyle = C.OUT; g.fillRect(85, 29, 166, 92); g.fillStyle = '#f4f0e0'; g.fillRect(86, 30, 164, 90); g.fillRect(80, 52, 6, 6);
  const lines = ['GUS TELEGRAPHS', 'EVERYTHING, KID.', '', 'BROWS JUMP? HOOK.', 'DODGE OR DUCK IT!', '', 'GLOVE FLASHES RED?', 'UPPERCUT. DODGE ONLY.'];
  const n = Math.floor(T * 40); let used = 0;
  lines.forEach((l, i) => { const vis = l.slice(0, Math.max(0, n - used)); used += l.length; text(g, vis, 92, 34 + i * 10, { c: '#2a0c10' }); });
  g.fillStyle = '#0a0814'; g.fillRect(6, 128, 244, 80); g.fillStyle = '#2a5a3a'; g.fillRect(6, 128, 244, 1);
  const tips = [['WINDMILL ARM', 'DUCK (DOWN)'], ['NOSE TWITCH', 'QUICK JAB - DODGE'], ['AFTER HE MISSES', 'PUNCH! FAST = STAR'], ['HIT HIS TAUNT', 'FREE STAR'], ['STARS', 'ENTER/SPACE/STAR BTN']];
  tips.forEach(([a, b], i) => { text(g, a, 12, 133 + i * 14, { c: '#ffd23a' }); text(g, b, 244, 133 + i * 14, { c: '#fff', al: 'r' }); });
  if (Math.floor(T * 2) % 2) text(g, document.body.classList.contains('touch') ? 'TAP TO FIGHT' : 'PRESS ENTER TO FIGHT', 128, 213, { c: '#5eea6c', al: 'c' });
}
function renderEnd() {
  renderWorld(0.55);
  const r = S.result, win = !(r.type.startsWith('LOSS') || r.type === 'DEC_L');
  g.fillStyle = C.OUT; g.fillRect(27, 37, 202, 132); g.fillStyle = '#120a24'; g.fillRect(28, 38, 200, 130); g.fillStyle = win ? '#c89a2a' : '#7a2030'; g.fillRect(28, 38, 200, 2); g.fillRect(28, 166, 200, 2);
  text(g, win ? 'YOU WIN!' : 'YOU LOSE', 128, 46, { s: 3, c: win ? '#ffe24a' : '#ff6a6a', c2: win ? '#ff7a1a' : '#a01a2a', ol: C.OUT, sh: '#000', shd: 2, al: 'c' });
  const how = { KO: 'BY KNOCKOUT', TKO: 'BY TECHNICAL KO', DEC_W: 'BY DECISION', DEC_L: 'BY DECISION', LOSS_KO: 'KNOCKED OUT', LOSS_TKO: 'TKO - 3 KNOCKDOWNS' }[r.type];
  text(g, how, 128, 74, { c: '#fff', al: 'c' });
  const t = Math.round(r.elapsed), tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  const rows = [['ROUND', '1'], ['TIME', tm], ['KNOCKDOWNS', String(S.opp.kd)], ['STARS EARNED', String(S.stats.stars)], ['DODGES', String(S.stats.dodges)], ['SCORE', String(r.points)]];
  if (win && r.bestT) { const bt = Math.round(r.bestT); rows.push(['BEST TIME', Math.floor(bt / 60) + ':' + String(bt % 60).padStart(2, '0') + (r.best ? ' NEW!' : '')]); }
  rows.forEach(([k, v], i) => { text(g, k, 44, 88 + i * 10, { c: '#9a96c8' }); text(g, v, 212, 88 + i * 10, { c: '#fff', al: 'r' }); });
  if (win) text(g, '"GUS: GOOD FIGHT, KID. ICE, PLEASE."', 128, 174, { c: '#bfe4ff', al: 'c', sh: '#000' });
  if (S.st > 1.2 && Math.floor(S.time * 2) % 2) text(g, 'ENTER / TAP REPLAY', 128, 208, { c: '#ffd23a', ol: C.OUT, al: 'c' });
}
function render() {
  if (S.scene === 'title') renderTitle();
  else if (S.scene === 'intro') renderIntro();
  else if (S.scene === 'tip') renderTip();
  else if (S.scene === 'fight') { renderWorld(0); renderHUD(); renderBanner(); if (S.flash > 0) { g.globalAlpha = Math.min(0.7, S.flash / 10); g.fillStyle = S.flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } if (S.paused) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H); text(g, 'PAUSED', 128, 100, { s: 3, c: '#fff', ol: C.OUT, al: 'c' }); } }
  else if (S.scene === 'end') { renderEnd(); renderHUD(); }
  // blit
  sctx.imageSmoothingEnabled = false; sctx.drawImage(buf, 0, 0, screenC.width, screenC.height);
}

/* ---------------------------------------------------------------- layout & loop */
function layout() {
  const dpr = window.devicePixelRatio || 1, stage = $('#stage');
  const aw = Math.min(stage.clientWidth, innerWidth) - 8, ah = stage.clientHeight - 4;
  let s = Math.floor(Math.min((aw * dpr) / W, (ah * dpr) / H));
  let cssW, cssH;
  if (s >= 1 && (W * s) / dpr >= aw * 0.72) { cssW = (W * s) / dpr; cssH = (H * s) / dpr; }
  else { s = Math.max(1, Math.ceil(Math.min((aw * dpr) / W, (ah * dpr) / H))); const f = Math.min(aw / W, ah / H); cssW = W * f; cssH = H * f; }
  screenC.width = W * s; screenC.height = H * s; screenC.style.width = cssW + 'px'; screenC.style.height = cssH + 'px';
  S.scale = s;
}
addEventListener('resize', layout);
buildArena(); layout();
let acc = 0, last = performance.now();
window.__frameErrors = { n: 0, last: '' };
function frame(now) {
  try {
    let d = (now - last) / 1000; last = now; if (d > 0.1) d = 0.1;
    if (!S.paused && !S.hold) { acc += d * (window.__koTurbo || 1); let n = 0; while (acc >= DT && n < 12) { update(); acc -= DT; n++; } if (n >= 12) acc = 0; }
    render();
  } catch (e) { window.__frameErrors.n++; window.__frameErrors.last = String(e && e.stack || e); if (window.__frameErrors.n < 4) console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();

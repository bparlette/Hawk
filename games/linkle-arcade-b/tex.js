// tex.js — every surface in Linkle Arcade is a canvas covered in short oil dabs.
// Seeded so the paint is identical on every load. No image assets anywhere.
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function texOf(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Cover a canvas with wandering short strokes in a palette around a base colour.
function dabs(ctx, W, H, R, { base, colors, n = 900, len = [10, 26], wid = [3, 6], dir = 0, alpha = [0.25, 0.6], curve = 0.35 }) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H;
    const L = len[0] + R() * (len[1] - len[0]);
    const a = dir + (R() - 0.5) * 0.9;
    const bend = (R() - 0.5) * curve;
    ctx.strokeStyle = colors[(R() * colors.length) | 0];
    ctx.globalAlpha = alpha[0] + R() * (alpha[1] - alpha[0]);
    ctx.lineWidth = wid[0] + R() * (wid[1] - wid[0]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 + bend * L * 0.3,
      x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function grassTex(seed = 11, base = '#57a047', pal = ['#67b354', '#4c9440', '#74c05e', '#3f8434', '#8fd864']) {
  const c = cnv(512, 512), R = rng(seed);
  dabs(c.getContext('2d'), 512, 512, R, { base, colors: pal, n: 1500, len: [8, 20], wid: [2.5, 5], dir: -Math.PI / 2.4 });
  return texOf(c);
}

export function dirtTex(seed = 21) {
  const c = cnv(512, 512), R = rng(seed);
  dabs(c.getContext('2d'), 512, 512, R, { base: '#a8834f', colors: ['#b8935a', '#96733f', '#c2a068', '#8a683a'], n: 1100, len: [10, 24], wid: [3, 6], dir: 0.3 });
  return texOf(c);
}

export function waterTex(seed = 31) {
  const c = cnv(512, 512), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 512, 512, R, { base: '#2f9db4', colors: ['#3cb2c6', '#268da6', '#4cc0d2', '#1f7f9c', '#5ccadd'], n: 1200, len: [14, 34], wid: [3, 6], dir: 0 });
  // sparkle streaks
  x.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = '#dffaff'; x.globalAlpha = 0.25 + R() * 0.5; x.lineWidth = 1.5 + R() * 2;
    const px = R() * 512, py = R() * 512, L = 8 + R() * 22;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + L, py); x.stroke();
  }
  x.globalAlpha = 1;
  return texOf(c);
}

// Road: dark blue-grey dabs with painted cream edge lines + dashed centre, drawn
// INTO the texture so the ribbon needs no extra geometry. V runs along the road.
export function roadTex(seed = 41) {
  const c = cnv(256, 512), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 256, 512, R, { base: '#5d616b', colors: ['#6b6f79', '#4e5158', '#787c86', '#43464d'], n: 1100, len: [8, 20], wid: [2.5, 5], dir: Math.PI / 2 });
  x.globalAlpha = 0.85; x.fillStyle = '#e8dfc2';
  x.fillRect(10, 0, 7, 512); x.fillRect(239, 0, 7, 512);
  x.globalAlpha = 0.8; x.fillStyle = '#f2e7bd';
  for (let y = 0; y < 512; y += 86) x.fillRect(124, y, 8, 44);
  x.globalAlpha = 1;
  const t = texOf(c); t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

export function woodTex(seed = 51, base = '#8a6844', pal = ['#9a764e', '#7a5836', '#a8855c', '#6d4e2e']) {
  const c = cnv(256, 256), R = rng(seed);
  dabs(c.getContext('2d'), 256, 256, R, { base, colors: pal, n: 500, len: [16, 40], wid: [2.5, 5], dir: 0 });
  return texOf(c);
}

export function leafTex(seed = 61) {
  const c = cnv(256, 256), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 256, 256, R, { base: '#4da33c', colors: ['#5cb54a', '#3f9131', '#6cc456', '#35802a'], n: 800, len: [10, 24], wid: [3, 5.5], dir: Math.PI / 4 });
  x.strokeStyle = '#2f7023'; x.globalAlpha = 0.7; x.lineWidth = 5;
  x.beginPath(); x.moveTo(10, 246); x.quadraticCurveTo(128, 128, 246, 10); x.stroke();
  x.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) { const t = i / 7; x.beginPath(); x.moveTo(10 + t * 236, 246 - t * 236); x.lineTo(60 + t * 150, 190 - t * 150); x.stroke(); }
  x.globalAlpha = 1;
  return texOf(c);
}

export function rockTex(seed = 71) {
  const c = cnv(256, 256), R = rng(seed);
  dabs(c.getContext('2d'), 256, 256, R, { base: '#8d8d90', colors: ['#9c9ca0', '#7c7c80', '#ababaf', '#6e6e72'], n: 700, len: [8, 20], wid: [3, 6], dir: 0.5 });
  return texOf(c);
}

export function foliageTex(seed = 81) {
  const c = cnv(256, 256), R = rng(seed);
  dabs(c.getContext('2d'), 256, 256, R, { base: '#3e7d2e', colors: ['#4c9440', '#356f27', '#5da34c', '#2c6121', '#6cb45c'], n: 1000, len: [6, 14], wid: [3, 6], dir: -1 });
  return texOf(c);
}

function solidTex(hex, seed, pal, n = 260) {
  const c = cnv(128, 128), R = rng(seed);
  dabs(c.getContext('2d'), 128, 128, R, { base: hex, colors: pal, n, len: [6, 14], wid: [2, 4], dir: 0.7, alpha: [0.2, 0.45] });
  return texOf(c);
}
export const clothGreen = (s = 91) => solidTex('#3f7a34', s, ['#4c8c40', '#356b2c', '#579c4a']);
export const clothCream = (s = 92) => solidTex('#e9dfc4', s, ['#f4ecd2', '#ded0ac', '#fff8e2']);
export const skinTex = (s = 93) => solidTex('#f0bd93', s, ['#f6c9a1', '#e8ae82', '#ffd2ab']);
export const hairTex = (s = 94) => solidTex('#e8bc4e', s, ['#f4cc60', '#dcab3c', '#f8d878'], 420);
export const brownTex = (s = 95) => solidTex('#7a5230', s, ['#8a5f38', '#6a4526', '#96683e']);
export const goldTex = (s = 96) => solidTex('#d9a92c', s, ['#eabb3a', '#c2941f', '#f2cc52']);
export const redTex = (s = 97) => solidTex('#b03a30', s, ['#c04840', '#9c2f28', '#cd584e']);
export const darkMetalTex = (s = 98) => solidTex('#3c4148', s, ['#4a5058', '#2f3339', '#585f68']);

// Shield face: painted wood + brass rim + our gold triangle emblem.
export function shieldTex(seed = 101) {
  const c = cnv(256, 256), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 256, 256, R, { base: '#7a5230', colors: ['#8a5f38', '#6a4526', '#96683e'], n: 420, len: [10, 22], wid: [3, 5], dir: Math.PI / 2 });
  x.strokeStyle = '#d9a92c'; x.globalAlpha = 0.95; x.lineWidth = 13;
  x.beginPath(); x.arc(128, 128, 112, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#e8bc4e'; x.globalAlpha = 1;
  x.beginPath(); x.moveTo(128, 74); x.lineTo(178, 168); x.lineTo(78, 168); x.closePath(); x.fill();
  x.fillStyle = '#7a5230';
  x.beginPath(); x.moveTo(128, 116); x.lineTo(152, 162); x.lineTo(104, 162); x.closePath(); x.fill();
  return texOf(c);
}

// Paraglider canopy: green panels with gold ribs (ours — green-and-gold).
export function canopyTex(seed = 111) {
  const c = cnv(512, 128), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 512, 128, R, { base: '#3e7d33', colors: ['#4c9440', '#356f2a', '#5da34c'], n: 700, len: [8, 18], wid: [2.5, 5], dir: Math.PI / 2 });
  x.fillStyle = '#d9a92c'; x.globalAlpha = 0.9;
  for (let px = 0; px <= 512; px += 64) x.fillRect(px - 3, 0, 6, 128);
  x.fillRect(0, 0, 512, 7); x.fillRect(0, 121, 512, 7);
  x.globalAlpha = 1;
  const t = texOf(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Landing target: painted bullseye.
export function targetTex(seed = 121) {
  const c = cnv(512, 512), x = c.getContext('2d'), R = rng(seed);
  dabs(x, 512, 512, R, { base: '#ddd2ae', colors: ['#e8dfc2', '#cfc096', '#f0e8cc'], n: 500, len: [8, 18], wid: [3, 5] });
  const ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.fill(); };
  ring(238, '#4c8c40'); ring(178, '#f0e8cc'); ring(116, '#4c8c40'); ring(56, '#c23b31');
  x.strokeStyle = 'rgba(60,50,20,.5)'; x.lineWidth = 5;
  x.beginPath(); x.arc(256, 256, 238, 0, Math.PI * 2); x.stroke();
  const t = texOf(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Day sky dome: gradient + dab clouds + sun glow. Canvas f: top = zenith.
export function skyTex(seed = 131) {
  const W = 1024, H = 512, c = cnv(W, H), x = c.getContext('2d'), R = rng(seed);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2f62a8'); g.addColorStop(0.42, '#5f97d2'); g.addColorStop(0.72, '#9cc4e6');
  g.addColorStop(0.92, '#cfe4da'); g.addColorStop(1, '#e6f0cd');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // impasto base
  dabs(x, W, H, R, { base: 'rgba(0,0,0,0)', colors: ['#5b8cc9', '#7fb0e0', '#9cc4e8', '#c4dcf2'], n: 1000, len: [16, 40], wid: [4, 9], dir: 0, alpha: [0.10, 0.24] });
  // sun glow dead ahead-ish (u .25 = -z ahead in our dome mapping is handled by rotation; keep glow wide)
  const sg = x.createRadialGradient(W * 0.30, H * 0.30, 8, W * 0.30, H * 0.30, 130);
  sg.addColorStop(0, 'rgba(255,246,200,.95)'); sg.addColorStop(0.25, 'rgba(255,240,180,.5)'); sg.addColorStop(1, 'rgba(255,240,180,0)');
  x.fillStyle = sg; x.fillRect(0, 0, W, H);
  // dab clouds
  for (let cl = 0; cl < 26; cl++) {
    const cx = R() * W, cy = H * (0.16 + R() * 0.5), s = 26 + R() * 70;
    for (let i = 0; i < 42; i++) {
      const px = cx + (R() - 0.5) * s * 2.2, py = cy + (R() - 0.5) * s * 0.55;
      x.strokeStyle = R() > 0.3 ? '#ffffff' : '#dfeaf6';
      x.globalAlpha = 0.16 + R() * 0.3; x.lineWidth = 3 + R() * 6; x.lineCap = 'round';
      const L = 10 + R() * 22;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + L, py + (R() - 0.5) * 3); x.stroke();
    }
  }
  x.globalAlpha = 1;
  const t = texOf(c); t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Soft radial blob (shadows, dust puffs, thermal shimmer).
export function blobTex(inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)') {
  const c = cnv(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Swirl sprite for thermals.
export function swirlTex() {
  const c = cnv(128, 128), x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,240,0.9)'; x.lineCap = 'round';
  for (let a = 0; a < 3; a++) {
    x.lineWidth = 5 - a;
    x.beginPath();
    x.arc(64, 64, 18 + a * 15, a * 1.4, a * 1.4 + 3.6);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Attempt B: every surface is lit by a stepped gradient map, so sunlight falls
// in soft painted bands (hoshi/Ghibli ramped lighting) instead of a realistic
// smooth gradient. One shared 5-step ramp for the whole game.
let _ramp = null;
export function rampTex() {
  if (_ramp) return _ramp;
  const steps = new Uint8Array([80, 130, 180, 225, 255]);
  const t = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  _ramp = t;
  return t;
}

export function mat(tex, opts = {}) {
  const { roughness, metalness, ...rest } = opts; // toon material has no PBR terms
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: rampTex(), ...rest });
}

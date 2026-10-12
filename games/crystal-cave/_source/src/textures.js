import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// value-noise heightfield -> tangent-space normal map (bumpy chunky rock)
export function rockNormalMap(size = 256) {
  const r = rng(7), H = new Float32Array(size * size);
  const oct = (cell, amp) => {
    const n = size / cell, g = []; for (let i = 0; i < (n + 1) * (n + 1); i++) g.push(r());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => g[((j % n) * (n + 1)) + (i % n)];
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      H[y * size + x] += v * amp;
    }
  };
  oct(64, 1.0); oct(32, 0.6); oct(16, 0.35); oct(8, 0.2); oct(4, 0.1);
  // a few chiselled cracks
  for (let k = 0; k < 14; k++) {
    let x = r() * size, y = r() * size, a = r() * 6.28;
    for (let i = 0; i < 60; i++) { a += (r() - 0.5) * 0.7; x = (x + Math.cos(a) + size) % size; y = (y + Math.sin(a) + size) % size; H[(y | 0) * size + (x | 0)] -= 0.5; }
  }
  const [c, ctx] = canvas(size, size), img = ctx.createImageData(size, size), s = 3.2;
  const h = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let nx = (h(x - 1, y) - h(x + 1, y)) * s, ny = (h(x, y + 1) - h(x, y - 1)) * s, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    img.data.set([(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

// subtle albedo variation for the rock (speckles + strata)
export function rockColorMap(size = 256) {
  const r = rng(11), [c, x] = canvas(size, size);
  x.fillStyle = '#b8c4d8'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { const v = 150 + r() * 105 | 0; x.fillStyle = `rgba(${v * 0.8 | 0},${v * 0.9 | 0},${v},${0.25 + r() * 0.3})`; const s = 2 + r() * 10; x.fillRect(r() * size, r() * size, s, s * (0.4 + r())); }
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(70,90,140,0.18)'; x.fillRect(0, r() * size, size, 2 + r() * 5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// brick block face: carved blue-grey cave bricks
export function brickTexture() {
  const [c, x] = canvas(64, 64);
  x.fillStyle = '#1b2244'; x.fillRect(0, 0, 64, 64);
  const rows = [[0, 0, 32], [0, 32, 32], [16, 16, 32], [-16, 16, 32], [48, 16, 32], [0, 32, 32]];
  const br = (bx, by, w, h) => { const g = x.createLinearGradient(0, by, 0, by + h); g.addColorStop(0, '#7f8fc8'); g.addColorStop(1, '#4a568e'); x.fillStyle = g; x.fillRect(bx + 2, by + 2, w - 4, h - 4); x.fillStyle = '#a9b8ee'; x.fillRect(bx + 2, by + 2, w - 4, 2); x.fillStyle = '#2b3466'; x.fillRect(bx + 2, by + h - 4, w - 4, 2); };
  br(0, 0, 32, 16); br(32, 0, 32, 16); br(-16, 16, 32, 16); br(16, 16, 32, 16); br(48, 16, 32, 16);
  br(0, 32, 32, 16); br(32, 32, 32, 16); br(-16, 48, 32, 16); br(16, 48, 32, 16); br(48, 48, 32, 16);
  void rows;
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// rune block: dark violet stone with a glowing golden eye-rune (emissive map) ; used=true -> dull
export function runeTextures() {
  const mk = (used) => {
    const [c, x] = canvas(64, 64);
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, used ? '#4a4660' : '#5b2fa8'); g.addColorStop(1, used ? '#2c2a3c' : '#2e1660');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = used ? '#6a6680' : '#b48cff'; x.lineWidth = 3; x.strokeRect(3, 3, 58, 58);
    x.fillStyle = used ? '#6a6680' : '#d9c2ff'; for (const [a, b] of [[7, 7], [53, 7], [7, 53], [53, 53]]) x.fillRect(a, b, 4, 4);
    return [c, x];
  };
  const [c1] = mk(false), [c2] = mk(true);
  // emissive rune glyph
  const [e, x] = canvas(64, 64); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#ffd25a'; x.fillStyle = '#ffd25a'; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(32, 12); x.lineTo(50, 32); x.lineTo(32, 52); x.lineTo(14, 32); x.closePath(); x.stroke();
  x.beginPath(); x.arc(32, 32, 6, 0, 7); x.fill();
  x.beginPath(); x.moveTo(32, 18); x.lineTo(32, 22); x.moveTo(32, 42); x.lineTo(32, 46); x.moveTo(20, 32); x.lineTo(24, 32); x.moveTo(40, 32); x.lineTo(44, 32); x.stroke();
  x.strokeStyle = '#ff9a2a'; x.lineWidth = 2; x.strokeRect(5, 5, 54, 54);
  const T = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; };
  return { map: T(c1), used: T(c2), emissive: T(e) };
}

// coin face: star glyph
export function coinTexture() {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(26, 24, 4, 32, 32, 32); g.addColorStop(0, '#ffe066'); g.addColorStop(0.6, '#f0a818'); g.addColorStop(1, '#a35a05');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 31, 0, 7); x.fill();
  x.strokeStyle = '#9a5a08'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 24, 0, 7); x.stroke();
  x.fillStyle = '#b06a0c'; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// far backdrop: deep blue cave wall with faint crystal veins and glows
export function backdropTexture() {
  const W = 2048, H = 1024, r = rng(5), [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#040a1e'); g.addColorStop(0.45, '#0b2a5c'); g.addColorStop(0.75, '#0a1f48'); g.addColorStop(1, '#030816');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // soft glows
  for (let i = 0; i < 16; i++) {
    const px = r() * W, py = H * (0.25 + r() * 0.55), rad = 120 + r() * 260, mag = r() < 0.35;
    const rg = x.createRadialGradient(px, py, 0, px, py, rad);
    rg.addColorStop(0, mag ? 'rgba(190,70,255,0.35)' : 'rgba(60,190,255,0.32)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  // rock silhouettes: layered jagged ridges
  const ridge = (base, amp, col, step) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); let y = base; for (let px = 0; px <= W; px += step) { y = base + Math.sin(px * 0.004 + base) * amp * 0.5 + (r() - 0.5) * amp; x.lineTo(px, y); } x.lineTo(W, H); x.fill(); };
  const ceil = (base, amp, col, step) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); for (let px = 0; px <= W; px += step) { const sp = r() < 0.15 ? amp * 2.5 : 0; x.lineTo(px, base + (r() - 0.3) * amp + sp); } x.lineTo(W, 0); x.fill(); };
  ceil(150, 60, 'rgba(6,16,40,0.9)', 26); ceil(90, 50, 'rgba(3,8,22,1)', 18);
  ridge(H * 0.72, 90, 'rgba(8,26,60,0.85)', 30); ridge(H * 0.82, 70, 'rgba(4,14,34,1)', 22);
  // tiny distant crystals
  for (let i = 0; i < 160; i++) {
    const px = r() * W, py = r() < 0.5 ? H * (0.68 + r() * 0.2) : 60 + r() * 120, s = 2 + r() * 7, mag = r() < 0.4;
    x.fillStyle = mag ? `rgba(255,110,230,${0.4 + r() * 0.5})` : `rgba(120,230,255,${0.4 + r() * 0.5})`;
    x.beginPath(); x.moveTo(px, py - s * 2); x.lineTo(px + s * 0.6, py); x.lineTo(px, py + s * 0.5); x.lineTo(px - s * 0.6, py); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; return t;
}

// soft round particle sprite
export function dotTexture() {
  const [c, x] = canvas(64, 64), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// blob shadow
export function shadowTexture() {
  const [c, x] = canvas(64, 32), g = x.createRadialGradient(32, 16, 0, 32, 16, 30);
  g.addColorStop(0, 'rgba(0,0,10,0.7)'); g.addColorStop(1, 'rgba(0,0,10,0)');
  x.save(); x.scale(1, 0.5); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.restore();
  x.fillStyle = g; x.fillRect(0, 0, 64, 32);
  return new THREE.CanvasTexture(c);
}

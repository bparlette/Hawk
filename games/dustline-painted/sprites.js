// DUSTLINE — truck sprite factories for the three bake-off looks.
// All sprites are generated in code at boot. No image files.
// Every sprite faces UP (-y) in its base form; rotations are pre-rendered.
'use strict';

const TRUCK_COLORS = {
  red:    { A: { L: '#e8604c', B: '#c93325', b: '#8e1f16' }, B: { L: '#f0815f', B: '#d84f38', b: '#9c3220' }, C: { body: '#c93325', bodyDark: '#8e1f16' } },
  blue:   { A: { L: '#5b8de8', B: '#2b5fc7', b: '#1d418c' }, B: { L: '#79a8d8', B: '#4a7fb5', b: '#33567e' }, C: { body: '#2b5fc7', bodyDark: '#1d418c' } },
  green:  { A: { L: '#6fce5e', B: '#3da332', b: '#276b20' }, B: { L: '#8cc47c', B: '#5da24e', b: '#3c7031' }, C: { body: '#3da332', bodyDark: '#276b20' } },
  yellow: { A: { L: '#f2cd54', B: '#dfa91f', b: '#a1740f' }, B: { L: '#f6cf6b', B: '#e8b23e', b: '#b57f1e' }, C: { body: '#dfa91f', bodyDark: '#a1740f' } }
};
const TRUCK_ORDER = ['red', 'blue', 'green', 'yellow'];

function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

// ---------- LOOK A: flat Amiga-style pixel truck, 12 x 23 grid, 16 rotations ----------
function pixelTruckBase(col) {
  const c = mkCanvas(12, 23), g = c.getContext('2d');
  const K = '#16110d', T = '#17181c', H = '#8f8f96', GL = '#bfe3ea', GD = '#5f8a96',
        W = '#e8e9e4', D = '#2a2320', DI = '#1f1a17', RD = '#7a1610', HL = '#ffe9a8', BP = '#3a3a40';
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  r(1, 1, 10, 21, col.B);                    // body
  r(1, 1, 1, 21, col.b); r(10, 1, 1, 21, col.b); // side shade
  r(2, 2, 8, 3, col.L);                      // hood highlight
  r(5, 2, 2, 3, col.B);
  r(1, 0, 10, 1, BP); r(1, 22, 10, 1, BP);   // bumpers
  r(2, 1, 1, 1, HL); r(9, 1, 1, 1, HL);      // headlights
  r(2, 21, 1, 1, RD); r(9, 21, 1, 1, RD);    // tail lights
  r(2, 6, 8, 3, GL); r(2, 8, 8, 1, GD);      // windshield
  r(2, 9, 8, 2, col.b);                      // cab rear
  r(1, 11, 10, 1, W);                        // roll-cage bar + lights
  r(2, 12, 8, 8, D); r(3, 13, 6, 6, DI);     // bed
  r(5, 15, 2, 2, T);                         // spare tyre
  // wheels
  for (const [x, y] of [[0, 3], [10, 3], [0, 16], [10, 16]]) { r(x, y, 2, 4, T); r(x, y + 1, 2, 1, H); }
  r(0, 0, 1, 1, 'rgba(0,0,0,0)'); // keep corners transparent-ish (canvas already clear)
  g.clearRect(0, 0, 1, 1); g.clearRect(11, 0, 1, 1); g.clearRect(0, 22, 1, 1); g.clearRect(11, 22, 1, 1);
  return c;
}
function buildSpritesA() {
  const out = {};
  for (const name of TRUCK_ORDER) {
    const base = pixelTruckBase(TRUCK_COLORS[name].A);
    const dirs = [];
    for (let i = 0; i < 16; i++) {
      const c = mkCanvas(34, 34), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.translate(17, 17); g.rotate((i / 16) * Math.PI * 2);
      g.drawImage(base, -6, -11.5);
      dirs.push(c);
    }
    out[name] = dirs;
  }
  return out;
}

// ---------- LOOK C: voxel box-model truck, oblique projection, 16 directions ----------
const VOX_BOXES = [
  // [cx, cy, cz, sx, sy, sz, colorKey]  cy+ = nose, z up, metres
  [-0.98, 1.45, 0.30, 0.50, 0.95, 0.60, 'tire'], [0.98, 1.45, 0.30, 0.50, 0.95, 0.60, 'tire'],
  [-0.98, -1.45, 0.30, 0.50, 0.95, 0.60, 'tire'], [0.98, -1.45, 0.30, 0.50, 0.95, 0.60, 'tire'],
  [0, 0, 0.52, 2.0, 4.5, 0.42, 'bodyDark'],
  [0, 1.50, 0.86, 1.86, 1.50, 0.34, 'body'],
  [0, 0.28, 1.02, 1.80, 1.35, 0.68, 'body'],
  [0, 0.88, 1.28, 1.62, 0.46, 0.24, 'glass'],
  [0, 0.02, 1.44, 1.66, 1.05, 0.14, 'bodyTop'],
  [0, -1.45, 0.78, 1.86, 1.60, 0.12, 'dark'],
  [-0.86, -1.45, 0.98, 0.14, 1.60, 0.40, 'body'], [0.86, -1.45, 0.98, 0.14, 1.60, 0.40, 'body'],
  [0, -2.22, 0.98, 1.86, 0.14, 0.40, 'body'],
  [0, -1.45, 0.97, 0.92, 0.92, 0.18, 'tire'],
  [-0.80, -0.62, 1.20, 0.12, 0.12, 0.52, 'chrome'], [0.80, -0.62, 1.20, 0.12, 0.12, 0.52, 'chrome'],
  [0, -0.62, 1.50, 1.72, 0.12, 0.12, 'chrome'],
  [-0.52, -0.62, 1.50, 0.20, 0.10, 0.14, 'light'], [0, -0.62, 1.50, 0.20, 0.10, 0.14, 'light'], [0.52, -0.62, 1.50, 0.20, 0.10, 0.14, 'light'],
  [0, 2.32, 0.50, 2.05, 0.22, 0.34, 'chromeDark']
];
function voxPalette(col) {
  return {
    body: col.body, bodyDark: col.bodyDark, bodyTop: shade(col.body, 1.22),
    glass: '#a8c8d4', tire: '#1d1d21', dark: '#26221e', chrome: '#cfd2d6',
    chromeDark: '#5a5e63', light: '#ffe9a8'
  };
}
function buildSpritesC() {
  const out = {};
  const SCALE = 22, SIZE = 132, CTR = SIZE / 2;
  for (const name of TRUCK_ORDER) {
    const pal = voxPalette(TRUCK_COLORS[name].C);
    const dirs = [];
    for (let d = 0; d < 16; d++) {
      const th = (d / 16) * Math.PI * 2;         // rotation of truck in world plane
      const cos = Math.cos(th), sin = Math.sin(th);
      // sprite faces "up" at th=0 mapping: local +y (nose) must point along world heading.
      // We render the truck rotated by th in its own plane, oblique-projected.
      const faces = [];
      for (const b of VOX_BOXES) {
        const [cx, cy, cz, sx, sy, sz, key] = b;
        const base = pal[key];
        const corners = [];
        for (const [ox, oy, oz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
          const lx = cx + ox * sx / 2, ly = cy + oy * sy / 2, lz = cz + oz * sz / 2;
          // rotate in plane: local forward (+y) maps to sprite-up at th=0 -> use (x, -y) frame
          const px = lx, py = -ly;
          const rx = px * cos - py * sin, ry = px * sin + py * cos;
          corners.push({ x: rx, y: ry, z: lz, sx: CTR + rx * SCALE, sy: CTR + ry * 0.84 * SCALE - lz * 0.60 * SCALE, depth: ry });
        }
        const FACEDEF = [
          { idx: [4, 5, 6, 7], n: [0, 0, 1] },        // top
          { idx: [3, 2, 6, 7], n: [0, 1, 0] },        // +y local side
          { idx: [1, 0, 4, 5], n: [0, -1, 0] },       // -y local side
          { idx: [2, 1, 5, 6], n: [1, 0, 0] },        // +x side
          { idx: [0, 3, 7, 4], n: [-1, 0, 0] }        // -x side
        ];
        for (const f of FACEDEF) {
          // rotate normal the same way (in (x,-y) frame)
          const nx = f.n[0], ny = -f.n[1];
          const rnx = nx * cos - ny * sin, rny = nx * sin + ny * cos;
          const isTop = f.n[2] === 1;
          // camera sits at +ry (south) and above: visible if top or normal faces +ry
          if (!isTop && rny < 0.18) continue;
          const pts = f.idx.map(i => corners[i]);
          const depth = pts.reduce((a, p) => a + p.depth, 0) / 4 + (isTop ? 0.02 : 0);
          const lightF = isTop ? 1.18 : (0.52 + 0.38 * Math.max(0, rny));
          faces.push({ pts, depth, col: shade(base.startsWith('#') ? base : '#888888', lightF) });
        }
      }
      faces.sort((a, b) => a.depth - b.depth);
      const c = mkCanvas(SIZE, SIZE), g = c.getContext('2d');
      for (const f of faces) {
        g.fillStyle = f.col; g.beginPath();
        g.moveTo(f.pts[0].sx, f.pts[0].sy);
        for (let i = 1; i < 4; i++) g.lineTo(f.pts[i].sx, f.pts[i].sy);
        g.closePath(); g.fill();
      }
      dirs.push(c);
    }
    out[name] = dirs;
  }
  return out;
}

// ---------- LOOK B: painted truck, brush strokes + warm grade, 32 rotations ----------
function paintedTruckBase(col, rng) {
  const S = 240, c = mkCanvas(S, S), g = c.getContext('2d');
  const cx = S / 2, L = 158, Wd = 82, x0 = cx - Wd / 2, y0 = S / 2 - L / 2;
  const OUT = '#3a2318';
  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // wheels (behind body)
  g.fillStyle = '#241c16';
  for (const [wx, wy] of [[x0 - 7, y0 + 26], [x0 + Wd - 5, y0 + 26], [x0 - 7, y0 + L - 46], [x0 + Wd - 5, y0 + L - 46]]) {
    rr(wx, wy, 13, 22, 5); g.fill();
    g.fillStyle = '#6e5a44'; g.beginPath(); g.arc(wx + 6.5, wy + 11, 3.4, 0, 7); g.fill(); g.fillStyle = '#241c16';
  }
  // body with warm vertical gradient
  const grad = g.createLinearGradient(x0, y0, x0 + Wd, y0);
  grad.addColorStop(0, col.b); grad.addColorStop(0.28, col.B); grad.addColorStop(0.75, col.B); grad.addColorStop(1, col.L);
  rr(x0, y0, Wd, L, 13); g.fillStyle = grad; g.fill();
  g.lineWidth = 8; g.strokeStyle = OUT; g.globalAlpha = 0.95; g.stroke(); g.globalAlpha = 1;
  // hood highlight strokes
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = col.L; g.globalAlpha = 0.16 + rng() * 0.12; g.lineWidth = 3 + rng() * 4;
    const sx = x0 + 10 + rng() * (Wd - 20), sy = y0 + 8 + rng() * 26;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 4 - rng() * 8, sy + 9 + rng() * 8); g.stroke();
  }
  g.globalAlpha = 1;
  // windshield
  rr(x0 + 9, y0 + 44, Wd - 18, 24, 6); g.fillStyle = '#cfe8ec'; g.fill();
  g.lineWidth = 3.4; g.strokeStyle = OUT; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0 + 16, y0 + 62); g.lineTo(x0 + 34, y0 + 48); g.stroke();
  // cab roof
  rr(x0 + 9, y0 + 70, Wd - 18, 20, 5); g.fillStyle = col.L; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
  // roll cage (cream strokes) at bed front
  g.strokeStyle = '#f3e6c8'; g.lineWidth = 4.4;
  g.beginPath(); g.moveTo(x0 + 8, y0 + 96); g.lineTo(x0 + Wd - 8, y0 + 96); g.stroke();
  g.fillStyle = '#ffe9a8';
  for (const lx of [x0 + 16, x0 + Wd / 2, x0 + Wd - 16]) { g.beginPath(); g.arc(lx, y0 + 96, 3.2, 0, 7); g.fill(); }
  // bed: darker warm planks
  rr(x0 + 7, y0 + 100, Wd - 14, L - 112, 6); g.fillStyle = 'rgba(46,32,22,0.88)'; g.fill();
  g.strokeStyle = 'rgba(214,178,128,0.5)'; g.lineWidth = 2.2;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x0 + 10, y0 + 100 + i * 11); g.lineTo(x0 + Wd - 10, y0 + 100 + i * 11); g.stroke(); }
  // spare tyre in bed
  g.fillStyle = '#241c16'; g.beginPath(); g.arc(cx, y0 + 122, 10, 0, 7); g.fill();
  g.fillStyle = '#6e5a44'; g.beginPath(); g.arc(cx, y0 + 122, 4, 0, 7); g.fill();
  // headlights + tail lights
  g.fillStyle = '#ffedb5';
  g.beginPath(); g.arc(x0 + 12, y0 + 6, 4, 0, 7); g.arc(x0 + Wd - 12, y0 + 6, 4, 0, 7); g.fill();
  g.fillStyle = '#a1261a';
  g.beginPath(); g.arc(x0 + 12, y0 + L - 5, 3.6, 0, 7); g.arc(x0 + Wd - 12, y0 + L - 5, 3.6, 0, 7); g.fill();
  // mud splatter near rear
  g.fillStyle = 'rgba(74,50,28,0.5)';
  for (let i = 0; i < 16; i++) {
    g.beginPath(); g.arc(x0 + 6 + rng() * (Wd - 12), y0 + L - 26 + rng() * 22, 1 + rng() * 2.4, 0, 7); g.fill();
  }
  return c;
}
function buildSpritesB() {
  const out = {};
  const rng = mulberry32(4242);
  for (const name of TRUCK_ORDER) {
    const base = paintedTruckBase(TRUCK_COLORS[name].B, rng);
    const dirs = [];
    for (let i = 0; i < 32; i++) {
      const c = mkCanvas(190, 190), g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.translate(95, 95); g.rotate((i / 32) * Math.PI * 2);
      g.drawImage(base, -95, -95, 190, 190);
      dirs.push(c);
    }
    out[name] = dirs;
  }
  return out;
}

// Direction index helper: heading angle (world, y-down atan2) -> sprite dir.
// Sprites face UP at rotation 0; rotating the base by a makes it face angle (a - 90deg).
function dirIndex(heading, count) {
  let a = (heading + Math.PI / 2) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return Math.round(a / (Math.PI * 2) * count) % count;
}

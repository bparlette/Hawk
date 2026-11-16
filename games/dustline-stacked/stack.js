// DUSTLINE-STACKED — sprite-stack truck renderer (candidate; render-layer only).
//
// Method (Kimo sprite stacking, proven in ~/workspace/dustline-stack-proto/):
// ONE hand-authored SIDE profile (64 long x 22 tall) + a width profile are
// extruded to a voxel volume; the surface faces are painter-sorted and drawn
// at the game's own oblique tilt (y-squash 0.84, z-lift 0.60). Any heading is
// rendered live — there are NO pre-rendered direction sprites. Headings are
// quantised to 2 degrees and cached per (look, truck); see StackTrucks.
//
// The red hero truck is the prototype's art verbatim (palette + profile).
// The other three trucks share the body shape with their own game palettes
// (TRUCK_COLORS in sprites.js) and small honest variations:
//   blue   — lamp bar, two wooden crates in the bed, pale side stripe
//   green  — no lamp bar (dark bar), tarp-covered bed
//   yellow — lamp bar, empty bed, dark side stripe
'use strict';

// Per-look render settings: ss = supersample factor for the cached canvas
// (the world buffers run at 4/6/12 px per metre, far below 1 px per voxel,
// so the stack renders near 1 px/voxel and is downsampled nearest-neighbour),
// voxSpan = how many voxels of world the square sprite span covers. A/B keep
// the old sprites' length fraction (~0.67 of span); C's voxel sprites filled
// more of their span (~0.81), so C gets a smaller voxSpan.
const STACK_CONF = {
  A: { ss: 3, voxSpan: 96 },
  B: { ss: 1, voxSpan: 96 },
  C: { ss: 2, voxSpan: 80 }
};
const STACK_GY = 0.62;        // ground point, as a fraction of the canvas height
const STACK_QDEG = 2;         // heading cache quantisation, degrees
const STACK_CACHE_CAP = 220;  // canvases per (look, truck); oldest evicted

const STACK_SHARED = {
  G: '#bfe3ea', // glass light
  g: '#5f8a96', // glass dark
  T: '#17181c', // tyre
  h: '#4a4a50', // tyre mid ring
  H: '#8f8f96', // hub
  K: '#26221e', // chassis / dark
  E: '#2a2320', // bed floor planks
  W: '#e8e9e4', // roll bar (cream white, as in game)
  Y: '#ffe9a8', // lamps
  R: '#7a1610', // tail light
  P: '#3a3a40'  // bumper
};
const TRUCK_VARIANTS = {
  red:    { lamps: true,  cargo: 'spare',  stripe: null },
  blue:   { lamps: true,  cargo: 'crates', stripe: '#bcd6f5' },
  green:  { lamps: false, cargo: 'tarp',   stripe: null },
  yellow: { lamps: true,  cargo: 'none',   stripe: '#4a3410' }
};
function stackPalette(colorName) {
  const c = TRUCK_COLORS[colorName].A; // {L, B, b} — the flat game palette
  const pal = Object.assign({}, STACK_SHARED, { B: c.B, L: c.L, D: c.b });
  const v = TRUCK_VARIANTS[colorName];
  if (v.stripe) pal.S = v.stripe;
  if (!v.lamps) pal.W = c.b; // dark roll bar when there is no lamp bar
  return pal;
}

// Side profile as [x0, x1, char] segments per height row z (0 = ground).
// x: 0 = tail … 63 = nose. Identical geometry to the proven prototype.
const STACK_PROFILE_ROWS = {
  21: [[34, 44, 'L']],
  20: [[33, 45, 'L']],
  19: [[27, 27, 'Y'], [29, 29, 'Y'], [31, 31, 'Y'], [33, 33, 'B'], [34, 42, 'G'], [43, 44, 'B'], [45, 45, 'G']],
  18: [[27, 31, 'W'], [33, 33, 'B'], [34, 42, 'G'], [43, 44, 'B'], [45, 46, 'G']],
  17: [[29, 30, 'W'], [33, 33, 'B'], [34, 42, 'G'], [43, 44, 'B'], [46, 47, 'G']],
  16: [[29, 30, 'W'], [33, 33, 'B'], [34, 42, 'G'], [43, 44, 'B'], [47, 48, 'G']],
  15: [[3, 28, 'L'], [29, 30, 'W'], [32, 47, 'B'], [48, 49, 'G']],
  14: [[3, 28, 'B'], [29, 30, 'W'], [32, 48, 'B'], [49, 50, 'G'], [51, 58, 'L']],
  13: [[0, 1, 'R'], [3, 28, 'B'], [29, 30, 'W'], [32, 50, 'B'], [51, 61, 'B'], [62, 63, 'B']],
  12: [[0, 1, 'R'], [3, 28, 'B'], [29, 30, 'W'], [32, 48, 'B'], [51, 61, 'B'], [62, 63, 'Y']],
  11: [[0, 1, 'R'], [3, 28, 'B'], [29, 30, 'W'], [32, 48, 'B'], [51, 61, 'B'], [62, 63, 'Y']],
  10: [[2, 62, 'B']],
  9:  [[2, 62, 'B']],
  8:  [[2, 62, 'D']],
  7:  [[0, 2, 'P'], [3, 60, 'D'], [61, 63, 'P']],
  6:  [[0, 2, 'P'], [3, 60, 'D'], [61, 63, 'P']],
  5:  [[4, 59, 'K']],
  4:  [[6, 57, 'K']],
  3:  [[6, 57, 'K']],
  2: [[8, 55, 'K']],
  1:  [[8, 55, 'K']],
  0:  [[10, 53, 'K']]
};
const STACK_L = 64, STACK_H = 22;
const STACK_WHEELS = [{ x: 13, z: 5 }, { x: 50, z: 5 }]; // centres, radius 5

function stackProfileRows(variant) {
  // deep copy, then apply the variant's tweaks
  const rows = {};
  for (const [z, segs] of Object.entries(STACK_PROFILE_ROWS)) rows[z] = segs.map(s => s.slice());
  if (!variant.lamps) {
    // lamp dots on the bar become plain bar
    rows[19] = rows[19].map(s => s[2] === 'Y' && s[0] < 32 ? [s[0], s[1], 'W'] : s);
  }
  if (variant.stripe) {
    for (const z of [10, 11]) rows[z] = rows[z].map(s => s[2] === 'B' ? [s[0], s[1], 'S'] : s);
  }
  return rows;
}
function buildStackProfileGrid(variant) {
  const rows = stackProfileRows(variant);
  const grid = [];
  for (let x = 0; x < STACK_L; x++) grid.push(new Array(STACK_H).fill(null));
  for (const [z, segs] of Object.entries(rows)) {
    for (const [x0, x1, ch] of segs) for (let x = x0; x <= x1; x++) grid[x][+z] = ch;
  }
  for (const w of STACK_WHEELS) {
    for (let x = 0; x < STACK_L; x++) for (let z = 0; z < STACK_H; z++) {
      const d2 = (x - w.x) ** 2 + (z - w.z) ** 2;
      if (d2 < 6.6 ** 2 && z <= 11) grid[x][z] = null;
    }
    for (let x = 0; x < STACK_L; x++) for (let z = 0; z < STACK_H; z++) {
      const d2 = (x - w.x) ** 2 + (z - w.z) ** 2;
      if (d2 <= 25) grid[x][z] = d2 <= 4.8 ? 'H' : (d2 <= 11 ? 'h' : 'T');
    }
  }
  return grid;
}

// Width profile: half-width per height band (total body width = 24 voxels).
const STACK_HALF_W = { 0: 8, 1: 8, 2: 9, 3: 9, 4: 10, 5: 10, 6: 12, 7: 12, 8: 12, 9: 12, 10: 12, 11: 12, 12: 12, 13: 12, 14: 12, 15: 12, 16: 11, 17: 11, 18: 11, 19: 11, 20: 11, 21: 10 };
function stackHalfWidthAt(x, z) {
  let hw = STACK_HALF_W[z] ?? 10;
  for (const w of STACK_WHEELS) if (Math.abs(x - w.x) <= 5 && z <= 10) hw = Math.max(hw, 13); // tyres bulge 1 out
  if (x <= 1 || x >= 62) hw = Math.min(hw, 10);   // tail / nose taper
  if (x === 0 || x === 63) hw = Math.min(hw, 9);
  if (x >= 60 && z >= 13) hw = Math.min(hw, 11);  // hood corners
  return hw;
}
function stackShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Plan-view colour for the top face of the highest voxel in column (x,y).
function stackTopColor(pal, x, y, zTop, chTop) {
  const hw = stackHalfWidthAt(x, Math.min(zTop, 15));
  if (x >= 4 && x <= 28 && zTop <= 15) {           // bed zone
    if (Math.abs(y) >= hw - 1) return stackShade(pal.B, 1.1);       // wall rim
    if (chTop === 'T') return pal.T;                                 // spare tyre
    if (chTop === 'H') return pal.H;                                 // spare hub
    return (x % 4 === 3) ? '#241c16' : pal.E;                        // planks
  }
  switch (chTop) {
    case 'G': case 'g': return pal.G;
    case 'Y': return pal.Y;
    case 'W': return pal.W;
    case 'R': return '#a1261a';
    case 'T': return pal.T; case 'H': return pal.H; case 'h': return pal.h;
    case 'K': return pal.K; case 'P': return pal.P;
    case 'L': return pal.L;
    case 'D': return stackShade(pal.D, 1.18);
    case 'S': return stackShade(pal.B, 1.18);       // stripe reads as body from above
    case 'B':
      if (x >= 50 && Math.abs(y) <= 5) return pal.L;  // hood centre highlight
      return stackShade(pal.B, 1.18);
    default: return stackShade(pal.B, 1.15);
  }
}
// End-cap detail for the outermost nose / tail columns' ±x faces.
function stackEndCapColor(pal, x, y, z, baseHex) {
  if (x === 63) { // nose
    if (z >= 5 && z <= 7) return pal.P;                              // bumper
    if (z >= 11 && z <= 12 && Math.abs(y) >= 7 && Math.abs(y) <= 11) return pal.Y; // headlights
    if (z >= 8 && z <= 12 && Math.abs(y) <= 6) return '#1f1a17';     // grille
    return baseHex;
  }
  if (x === 0) { // tail
    if (z >= 6 && z <= 8) return pal.P;                              // bumper
    if (z >= 11 && z <= 13 && Math.abs(y) >= 8) return '#a1261a';    // tail lights
    return baseHex;
  }
  return baseHex;
}

function buildStackVoxels(pal, variant) {
  const grid = buildStackProfileGrid(variant);
  const vox = new Map();
  const key = (x, y, z) => x + ',' + y + ',' + z;
  for (let x = 0; x < STACK_L; x++) for (let z = 0; z < STACK_H; z++) {
    const ch = grid[x][z];
    if (!ch) continue;
    const hw = stackHalfWidthAt(x, z);
    for (let y = -hw; y <= hw; y++) {
      // open bed: above the floor (z 12..15) only the side walls are solid
      if (x >= 4 && x <= 28 && z >= 12 && z <= 15 && Math.abs(y) < hw - 1) continue;
      let col = pal[ch];
      if (z === 11 && x >= 4 && x <= 28 && Math.abs(y) < hw - 1) col = pal.E; // bed floor
      vox.set(key(x, y, z), col);
    }
  }
  if (variant.cargo === 'spare') {
    // spare tyre lying in the bed (hidden from the side, reads from above)
    for (let x = 12; x <= 20; x++) for (let y = -4; y <= 4; y++) for (let z = 11; z <= 13; z++) {
      const d2 = (x - 16) ** 2 + y * y;
      if (d2 <= 17) vox.set(key(x, y, z), (z === 13 && d2 <= 3) ? pal.H : pal.T);
    }
  } else if (variant.cargo === 'crates') {
    // two wooden crates loaded in the bed, sitting proud of the rim
    for (const [cx0, cx1] of [[8, 15], [18, 25]]) {
      for (let x = cx0; x <= cx1; x++) for (let y = -6; y <= 6; y++) for (let z = 11; z <= 16; z++) {
        const edge = (x === cx0 || x === cx1 || Math.abs(y) === 6 || z === 16);
        vox.set(key(x, y, z), edge ? '#6e4a26' : '#8a6136');
      }
    }
  } else if (variant.cargo === 'tarp') {
    // canvas tarp over the bed, slight dome on top
    for (let x = 4; x <= 28; x++) for (let y = -10; y <= 10; y++) {
      for (let z = 12; z <= 14; z++) vox.set(key(x, y, z), '#4a5238');
      if (Math.abs(y) <= 7) vox.set(key(x, y, 15), '#57603f');
    }
  }
  return vox;
}

// voxel map -> surface face list (no bottom faces), GREEDY-MESHED: coplanar
// same-colour faces merge into rectangles. The raw surface is ~8.5k faces per
// truck (the flat body panels are huge single-colour grids); meshing cuts it
// to a few hundred quads, which is what makes a fresh angle render cheap
// enough for 4 trucks turning at once. Colours are resolved per voxel face
// BEFORE merging, so authored detail (grille, lamps, bed planks) survives.
// Per direction: axis = normal axis, (u, v) = the other two axes in the
// winding order of the prototype's corner templates, point(P,u,v) rebuilds
// a corner on plane P.
const STACK_FACE_DIRS = [
  { n: [1, 0, 0],  axis: 0, uOf: (x, y, z) => y, vOf: (x, y, z) => z, point: (P, u, v) => [P, u, v] },
  { n: [-1, 0, 0], axis: 0, uOf: (x, y, z) => z, vOf: (x, y, z) => y, point: (P, u, v) => [P, v, u] },
  { n: [0, 1, 0],  axis: 1, uOf: (x, y, z) => z, vOf: (x, y, z) => x, point: (P, u, v) => [v, P, u] },
  { n: [0, -1, 0], axis: 1, uOf: (x, y, z) => x, vOf: (x, y, z) => z, point: (P, u, v) => [u, P, v] },
  { n: [0, 0, 1],  axis: 2, uOf: (x, y, z) => y, vOf: (x, y, z) => x, point: (P, u, v) => [v, u, P] }
];
function buildStackFaces(vox, pal) {
  const has = (x, y, z) => vox.has(x + ',' + y + ',' + z);
  const charOf = {}; for (const [ch, hex] of Object.entries(pal)) charOf[hex] = ch;
  const faces = [];
  for (let di = 0; di < STACK_FACE_DIRS.length; di++) {
    const d = STACK_FACE_DIRS[di];
    const [nx, ny, nz] = d.n;
    // collect this direction's faces into planes: plane -> Map "u,v" -> colour
    const planes = new Map();
    for (const [k, col] of vox) {
      const [x, y, z] = k.split(',').map(Number);
      if (has(x + nx, y + ny, z + nz)) continue;
      let c = col;
      if (nz === 1) c = charOf[col] ? stackTopColor(pal, x, y, z, charOf[col]) : stackShade(col, 1.12); // cargo colours keep their own top
      else if (nx !== 0) c = stackEndCapColor(pal, x, y, z, col);
      const P = [x, y, z][d.axis] + (d.n[d.axis] > 0 ? 1 : 0);
      let grid = planes.get(P);
      if (!grid) planes.set(P, grid = new Map());
      grid.set(d.uOf(x, y, z) + ',' + d.vOf(x, y, z), c);
    }
    // greedy rectangle merge per plane
    for (const [P, grid] of planes) {
      const claimed = new Set();
      const cells = [...grid.keys()].map(k2 => k2.split(',').map(Number)).sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
      for (const [u0, v0] of cells) {
        const k0 = u0 + ',' + v0;
        if (claimed.has(k0)) continue;
        const col = grid.get(k0);
        let w = 1;
        while (grid.get((u0 + w) + ',' + v0) === col && !claimed.has((u0 + w) + ',' + v0)) w++;
        let h = 1, grow = true;
        while (grow) {
          for (let du = 0; du < w; du++) {
            const kk = (u0 + du) + ',' + (v0 + h);
            if (grid.get(kk) !== col || claimed.has(kk)) { grow = false; break; }
          }
          if (grow) h++;
        }
        for (let dv = 0; dv < h; dv++) for (let du = 0; du < w; du++) claimed.add((u0 + du) + ',' + (v0 + dv));
        const u1 = u0 + w, v1 = v0 + h;
        const pts = [d.point(P, u0, v0), d.point(P, u1, v0), d.point(P, u1, v1), d.point(P, u0, v1)];
        faces.push({
          nx, ny, nz, col,
          pts,
          ctr: [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2, (pts[0][2] + pts[2][2]) / 2]
        });
      }
    }
  }
  return faces;
}
function buildStackModel(colorName) {
  const pal = stackPalette(colorName);
  const variant = TRUCK_VARIANTS[colorName];
  const vox = buildStackVoxels(pal, variant);
  const faces = buildStackFaces(vox, pal);
  return { faces, pal, variant };
}

// ---------- the renderer: painter-sorted faces into a cached canvas ----------
const STACK_SQUASH = 0.84, STACK_LIFT = 0.60;   // the game's oblique tilt (Look C)
const STACK_CX0 = (STACK_L - 1) / 2;

class StackTrucks {
  constructor() {
    this.models = {};   // color -> {faces,...}
    this.caches = {};   // look+color -> Map<qdeg, canvas>
    this.stats = { renders: 0, hits: 0, renderMs: 0, modelMs: 0 };
  }
  model(color) {
    if (!this.models[color]) {
      const t0 = performance.now();
      this.models[color] = buildStackModel(color);
      this.stats.modelMs += performance.now() - t0;
    }
    return this.models[color];
  }
  // Canvas of `color` truck at world heading angRad, sized for `look` and the
  // look's sprite span (spanPx, in world-buffer pixels). Draw it with
  // drawImage(c, x - spanPx/2, y - spanPx*STACK_GY, spanPx, spanPx).
  canvasFor(color, look, angRad, spanPx) {
    const conf = STACK_CONF[look];
    const size = Math.max(24, Math.round(spanPx * conf.ss));
    let deg = (angRad * 180 / Math.PI) % 360; if (deg < 0) deg += 360;
    const q = Math.round(deg / STACK_QDEG) % (360 / STACK_QDEG);
    const ck = look + ':' + color;
    let cache = this.caches[ck];
    if (!cache) cache = this.caches[ck] = new Map();
    const hit = cache.get(q);
    if (hit && hit.width === size) { this.stats.hits++; return hit; }
    const t0 = performance.now();
    const c = mkCanvas(size, size), g = c.getContext('2d');
    this.drawFaces(g, this.model(color).faces, q * STACK_QDEG * Math.PI / 180, size / 2, size * STACK_GY, size / conf.voxSpan);
    this.stats.renders++;
    this.stats.renderMs += performance.now() - t0;
    if (cache.size >= STACK_CACHE_CAP) {
      // evict the oldest quarter
      let n = Math.floor(STACK_CACHE_CAP / 4);
      for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; }
    }
    cache.set(q, c);
    return c;
  }
  drawFaces(ctx, faces, angRad, cx, cy, scale) {
    const cos = Math.cos(angRad), sin = Math.sin(angRad);
    const vis = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const nry = f.nx * sin + f.ny * cos;
      if (f.nz !== 1 && nry <= 0.02) continue;
      const dx = f.ctr[0] - STACK_CX0, dy = f.ctr[1];
      vis.push({ f, depth: dx * sin + dy * cos, nry });
    }
    vis.sort((a, b) => (a.depth - b.depth) || (a.f.ctr[2] - b.f.ctr[2]));
    for (let i = 0; i < vis.length; i++) {
      const { f, nry } = vis[i];
      ctx.fillStyle = f.nz === 1 ? f.col : stackShade(f.col.startsWith('#') ? f.col : '#888888', 0.55 + 0.45 * Math.max(0, nry));
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const cn = f.pts[j];
        const dx = cn[0] - STACK_CX0, dy = cn[1];
        const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
        const px = cx + rx * scale, py = cy + ry * scale * STACK_SQUASH - cn[2] * scale * STACK_LIFT;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
}

window.__stackTrucks = new StackTrucks();

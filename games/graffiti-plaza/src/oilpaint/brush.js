// The brush sheet, graffiti edition: eight marks of a spray can, made here rather than drawn by anyone. Each cell
// holds one mark laid along +v: r is how thick the paint stands (spray paint is thin, so lower than the oil sheet,
// with a bump for every droplet), g is where there is paint at all, b is a slow streak along the spray (where a
// second colour was picked up and not mixed in).
//
// Spray is not a bristle brush: a stroke has a soft misted core, an edge that breaks up into separate droplets,
// satellite splatter thrown off around the mark, and no load taper. One cell (6) is not a stroke at all but a
// patch of halftone dots, the printed-comic accent: dots on a square grid, each domed a little.
import * as THREE from 'three';

export const BRUSH_COLS = 4;
export const BRUSH_ROWS = 2;
const CW = 128, CH = 256;

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
const n1 = (x, seed) => {
  const i = Math.floor(x), f = smooth(x - i);
  return hash(i + seed * 57.3) * (1 - f) + hash(i + 1 + seed * 57.3) * f;
};
const n2 = (x, y, seed) => {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const h = (a, b) => hash(a * 1.31 + b * 91.7 + seed * 13.9);
  return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fy) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fy;
};
const sstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

// satellite splatter: a handful of droplets thrown off round the mark, fixed for a given seed. Centres sit
// just outside the body (cu beyond the half-width, or past the ends), each a small hard disc of paint.
function satellites(u, v, seed, wide) {
  let a = 0;
  for (let k = 0; k < 8; k++) {
    const side = hash(seed * 5.3 + k * 3.77) > 0.5 ? 1 : -1;
    const cu = side * (wide + 0.05 + 0.3 * hash(seed * 7.1 + k * 1.31));
    const cv = 0.04 + 0.92 * hash(seed * 9.7 + k * 2.17);
    const rv = 0.008 + 0.026 * hash(seed * 3.9 + k * 4.53);
    const d = Math.hypot((u - cu) / (rv * 1.6), (v - cv) / rv);
    a = Math.max(a, 1 - sstep(0.65, 1.0, d));
  }
  return a;
}

// break a soft alpha into spray: solid in the core, and in the mist zone only where the speckle noise
// is dense enough — the thinner the mist, the sparser the droplets. A few pinholes in the core too.
function sprayed(alpha, u, v, seed) {
  if (alpha <= 0.0) return 0;
  const sp = n2(u * 24, v * 48, seed + 77);
  let a = alpha;
  if (a < 0.93) a = sp > 0.62 - a * 0.45 ? Math.min(1, a + 0.35) : 0.0;
  if (a > 0.0 && n2(u * 55, v * 110, seed + 78) > 0.93) a *= 0.2; // pinholes: the can stuttered
  return a;
}

// one mark: kind 0 a long spray stroke, 1 a fat splat, 2 a spray stroke with a curve to it, 3 halftone dots
function mark(u, v, seed, kind) {
  if (kind === 3) {
    // halftone: dots on a 32px grid over the cell, each dot's radius set by its own hash
    const px = (u * 0.5 + 0.5) * CW, py = v * CH;
    const gx = Math.floor(px / 32), gy = Math.floor(py / 32);
    const fx = px - (gx + 0.5) * 32, fy = py - (gy + 0.5) * 32;
    const dist = Math.hypot(fx, fy);
    const rad = 6.5 + 6.0 * hash(seed * 3.3 + gx * 12.9 + gy * 78.2);
    const alpha = 1 - sstep(rad - 1.5, rad + 1.5, dist);
    const height = alpha * (0.12 + 0.3 * Math.max(0, 1 - (dist / rad) * (dist / rad)));
    return [height, alpha, 0.3];
  }
  const bend = kind === 2 ? (seed % 2 ? 0.34 : -0.34) : (hash(seed * 3.1) - 0.5) * 0.12;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.08;
  const a = Math.abs(ub + wob);
  if (kind === 1) {
    // a splat: a soft round body, a rim that breaks into droplets, splatter thrown off round it
    const r = Math.hypot(ub / 0.7, (v - 0.5) / 0.47);
    let alpha = sprayed(1 - sstep(0.5, 1.0, r), ub, v, seed);
    alpha = Math.max(alpha, satellites(ub, v, seed + 40, 0.72));
    const dome = Math.max(0, 1 - r * r);
    const height = alpha * (0.16 + 0.2 * dome + 0.18 * n2(ub * 18, v * 30, seed + 31));
    return [Math.min(1, height), alpha, n2(ub * 3.2, v * 1.3, seed + 20)];
  }
  // a spray stroke: wide misted core, soft head and tail, speckled edges, splatter at the sides
  const half = 0.62 * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * (1 + (n1(v * 7, seed + 1) - 0.5) * 0.08);
  const core = 1 - sstep(half - 0.3, half + 0.06, a);
  const head = sstep(0.0, 0.1, v);
  const tail = 1 - sstep(0.8, 1.0, v);
  let alpha = sprayed(core * head * tail, ub, v, seed);
  alpha = Math.max(alpha, satellites(ub, v, seed, half) * head * tail);
  const height = alpha * (0.14 + 0.16 * n2(ub * 16, v * 26, seed + 33) + 0.1 * n1(ub * 9, seed + 5));
  return [Math.min(1, height), alpha, n2(ub * 3.4, v * 1.1, seed + 20)];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 0, 2, 1, 1, 0, 3, 2]; // cell 6 is the halftone patch — only the [0,8) dab fields reach it
  for (let cell = 0; cell < 8; cell++) {
    const cx = cell % BRUSH_COLS, cy = Math.floor(cell / BRUSH_COLS);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        // a margin of nothing round each mark, so the small copies of the sheet don't bleed into each other
        const u = ((x + 0.5) / CW) * 2 - 1, v = (y + 0.5) / CH;
        const m = 0.9;
        const [h, a, s] = Math.abs(u) > m || v < 0.04 || v > 0.96 ? [0, 0, 0.5] : mark(u / m, (v - 0.04) / 0.92, cell * 7 + 1, kinds[cell]);
        const i = ((cx * CW + x) + (cy * CH + y) * W) * 4;
        data[i] = Math.round(h * 255);
        data[i + 1] = Math.round(a * 255);
        data[i + 2] = Math.round(s * 255);
        data[i + 3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

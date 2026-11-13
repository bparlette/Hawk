// The brush sheet: eight marks of a loaded bristle brush, made here rather than drawn by anyone. Each cell holds
// one mark laid along +v: r is how thick the paint stands (for the light that rakes across it), g is where there
// is paint at all, b is a slow streak along the bristles (where a second colour was picked up and not mixed in).
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

// Van Gogh's marks: thick directional dashes and commas of paint, mounded along a ridge that
// wanders off the stroke's centre, so every touch has a lit ridge side and a trough side for
// the light to rake across. kind 0 a straight dash, 1 a short fat dash, 2 a comma with a real
// curve to it — the swirl stroke. The b channel is the second colour dragged through the paint:
// it bands across the stroke (fast in u) and drifts only slowly along it (slow in v), so a dab
// reads as two paints laid in one pass, never blended.
function mark(u, v, seed, kind) {
  const bend = kind === 2 ? (seed % 2 ? 0.46 : -0.46) : (hash(seed * 3.1) - 0.5) * 0.14;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.08;
  const a = Math.abs(ub + wob);
  const fat = kind === 1 ? 1.3 : 1.0;
  const half = 0.58 * fat * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, v * 1.12))) * (1 + (n1(v * 7, seed + 1) - 0.5) * 0.12);
  const start = 0.04 + 0.04 * n1(ub * 5, seed + 2);
  const end = (kind === 1 ? 0.8 : 0.96) - 0.22 * n1(ub * 4.5 + 2, seed + 4) - 0.05 * n1(ub * 19, seed + 6);
  const side = 1 - sstep(half - 0.06, half, a);
  const head = sstep(start, start + 0.03, v);
  const tail = 1 - sstep(end - 0.02, end + 0.015, v);
  // the brush runs dry toward the end: single bristles give out and leave gaps
  const dryness = sstep(end - 0.22, end, v);
  const bristle = n1(ub * 13, seed + 8) * 0.7 + n1(ub * 31, seed + 9) * 0.3;
  const gap = 1 - sstep(dryness * 0.55 - 0.08, dryness * 0.55, bristle) < 0.5 ? 1.0 : 0.0;
  const alpha = side * head * tail * gap;
  // impasto relief: a base mound across the stroke, a bright ridge wandering off-centre,
  // furrows running along the bristles, and paint squeezed out toward the sides
  const ridgeOff = (hash(seed * 7.7) - 0.5) * 0.36;
  const ridge = Math.exp(-Math.pow((ub - ridgeOff) / 0.3, 2));
  const furrow = n1(ub * 12 + n1(v * 2.5, seed + 12) * 1.2, seed + 33) * 0.65 + n1(ub * 29, seed + 34) * 0.35;
  const load = 1 - 0.4 * sstep(0.1, 0.9, v); // thick where the brush touched down, thinner where it left
  const squeezed = sstep(half - 0.3, half - 0.05, a);
  const height = alpha * (0.14 + 0.52 * ridge + 0.18 * furrow + 0.22 * squeezed * (0.4 + 0.6 * furrow) + 0.18 * load * (1 - sstep(start, start + 0.25, v)));
  const streak = n2(ub * 4.5, v * 0.9, seed + 20);
  return [Math.min(1, height), alpha, streak];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 2, 1, 2, 0, 1, 2, 0]; // dashes and commas, no flat patches: every mark a directional stroke
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

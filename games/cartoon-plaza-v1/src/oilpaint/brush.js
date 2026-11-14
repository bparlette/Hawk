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

// CEL REBUILD: a mark is no longer a brush stroke at all. It is a cut-paper shape — a clean
// rounded patch with a hard edge, perfectly level (r is a constant 0.5, so no light can rake
// across it) and with NO streak channel (b is 0, below the dab shader's two-tone mix step, so
// a patch can only ever show one flat colour). The only irregularity left is a whisper of
// hand-cut wobble on the rim, so patches read as drawn shapes, not as geometry.
function mark(u, v, seed, kind) {
  const ang = Math.atan2(v - 0.5, u);
  const wob = (n1(ang * 2.0 + 9, seed) - 0.5) * 0.05;
  const r = Math.hypot(u / 0.68, (v - 0.5) / 0.46) + wob;
  const alpha = 1 - sstep(0.965, 1.0, r);
  return [0.5 * alpha, alpha, 0.0];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [1, 1, 1, 1, 1, 1, 1, 1]; // every mark a flat pressed patch: no bristle strokes, no dry edges
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

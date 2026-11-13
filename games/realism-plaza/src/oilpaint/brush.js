// The brush sheet: eight marks, made here rather than drawn by anyone. Each cell holds one mark laid along +v:
// r is how thick the paint stands (for the light that rakes across it), g is where there is paint at all, b is a
// slow variation across the mark (where the colour shifts a little inside one touch).
//
// REALISM REBUILD (style-rebuild copy): the v1 sheet was a loaded bristle brush — dry-bristle gaps, broken
// edges, deep furrows — and those marks read as paint no matter how small they were laid. This sheet is the
// opposite instrument: a soft, fully loaded micro-mark. Coverage is 1 across the whole interior and feathers
// out over the outer half of the mark, so overlapping touches cross-blend into a continuous film instead of
// sitting side by side as flakes. The height channel is nearly flat (a whisper of fine grain, nothing for
// light to rake across), and the b channel is a smooth, slow gradient, so the c1/c2 mix inside one mark is a
// gentle shift, never a streak. What painterly texture survives lives at this grain scale only — on close
// inspection, not at reading distance.
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

// one mark: kind 0 a soft stroke, 1 a soft round dab, 2 a soft stroke with the least bend in it.
// All three are the same instrument at heart: full coverage inside, a wide feather at the rim,
// near-flat height, and a slow gradient across — a touch of an airbrush-soft mop, not a bristle brush.
function mark(u, v, seed, kind) {
  const bend = kind === 2 ? (seed % 2 ? 0.1 : -0.1) : (hash(seed * 3.1) - 0.5) * 0.05;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  // a whisper of edge wobble so the feather is not a perfect ellipse (perfect ellipses read as CGI)
  const wob = 1 + (n1(v * 3.0, seed + 3) - 0.5) * 0.06;
  let r;
  if (kind === 1) {
    r = Math.hypot((ub / 0.98) * wob, (v - 0.5) / 0.6); // the round dab fills its cell
  } else {
    r = Math.hypot((ub / 0.92) * wob, (v - 0.5) / 1.02); // the stroke runs the length of its cell
  }
  const cover = 1 - sstep(0.42, 1.0, r); // whole paint until past the middle, then a long soft fall
  const grain = n2(ub * 7, v * 7, seed + 31) * 0.55 + n2(ub * 15, v * 15, seed + 9) * 0.45;
  const height = 0.5 + (grain - 0.5) * 0.07; // nearly flat: micro-grain only, no furrows for the light
  const grad = 0.5 + ub * 0.22 + (n2(ub * 2.5, v * 1.2, seed + 20) - 0.5) * 0.3; // a slow shift across the touch
  return [height, cover, Math.min(1, Math.max(0, grad))];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 0, 0, 2, 1, 1, 0, 2];
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

// The wash sheet: eight watercolour puddles, made here rather than drawn by anyone. Each cell holds one
// wash laid along +v, and its channels say what a wash does: r is granulation (where the pigment settled
// into the paper's tooth, as fine noise), g is coverage (how far the water reached — it bleeds out softly,
// never a hard edge), b is pooling (where the pigment migrated as the wash dried: a ring near the rim,
// so the fragment shader can lay the classic dark dried edge over a paler centre).
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

// one wash: an irregular rounded puddle, wider across than along, its centre wandering a little from
// puddle to puddle. Returns [granulation, coverage, pooling], each 0..1.
function mark(u, v, seed) {
  const cx = (n1(seed * 3.7, seed + 11) - 0.5) * 0.16;
  const cy = 0.5 + (n1(seed * 5.3, seed + 13) - 0.5) * 0.14;
  const dx = (u - cx) / 0.8, dy = (v - cy) / 0.54; // a wash spreads wider across the card than along it
  const ang = Math.atan2(dy, dx);
  // the rim wobbles: water follows the paper, not a compass
  const wob = 1 + (n1(ang * 1.9 + 9, seed + 21) - 0.5) * 0.36 + (n1(ang * 4.3 + 2, seed + 23) - 0.5) * 0.16;
  const r = Math.hypot(dx, dy) / wob; // 0 at the heart of the wash, ~1 at its rim
  // coverage reaches nearly to the rim, then bleeds away over a broad soft band
  const cover = 1 - sstep(0.8, 1.04, r);
  if (cover <= 0) return [0, 0, 0];
  // pooling: pigment drifts outward as the wash dries and gathers in a ring just inside the rim
  const pool = sstep(0.42, 0.88, r) * (1 - sstep(0.96, 1.06, r));
  // granulation: two octaves of settle noise, alive through the body of the wash, quieter at the rim
  const gran = (n2(u * 7 + seed, v * 11, seed + 31) * 0.62 + n2(u * 17 + 3, v * 23, seed + 37) * 0.38) * cover;
  return [gran, cover, pool];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  for (let cell = 0; cell < 8; cell++) {
    const cx = cell % BRUSH_COLS, cy = Math.floor(cell / BRUSH_COLS);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        // a margin of nothing round each wash, so the small copies of the sheet don't bleed into each other
        const u = ((x + 0.5) / CW) * 2 - 1, v = (y + 0.5) / CH;
        const m = 0.9;
        const [h, a, s] = Math.abs(u) > m || v < 0.04 || v > 0.96 ? [0, 0, 0] : mark(u / m, (v - 0.04) / 0.92, cell * 7 + 1);
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

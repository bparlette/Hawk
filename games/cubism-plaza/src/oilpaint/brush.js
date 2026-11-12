// The shard sheet (CUBISM re-skin): where the oil painter's sheet held eight bristle marks, this one holds
// eight cut planes — triangles, diamonds, kites and split quads with straight edges. A dab is no longer a
// touch of a brush but one facet of the fractured picture: flat inside, split into two (sometimes three)
// flat tones across a hard diagonal (the b channel, which the dab shader mixes its two colours by), and
// stepping in height (r) from one facet to the next so the raking light catches the cut edge between them.
// g is where there is paint at all: a hard polygon mask, only a hair of hand-cut raggedness on the edge.
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
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// One shard. u runs across the dab (-1..1), v along it (0..1). Returns [height, mask, facetTone].
// `slack` is the signed distance-ish margin inside the shape: >0 inside, and its size near the edge
// drives both the chisel bevel and the hair of raggedness.
function mark(u, v, seed, kind) {
  let slack, facet;
  const diag = (u * 0.8 + (v - 0.5) * 1.6); // a shared diagonal cut, used by several kinds
  switch (kind) {
    case 0: { // tall triangle, apex at the top
      const w = 0.06 + (1 - v) * 0.9;
      slack = Math.min(w - Math.abs(u), v - 0.015, 0.995 - v + 0.2);
      facet = diag > 0.1 ? 1 : 0;
      break;
    }
    case 1: { // diamond
      slack = 1 - (Math.abs(u) / 0.8 + Math.abs(v - 0.5) / 0.52);
      facet = u > 0 ? 1 : 0;
      break;
    }
    case 2: { // parallelogram slab, cut in three bands along its length
      const uc = u - (v - 0.5) * 0.5;
      slack = Math.min(0.72 - Math.abs(uc), (v - 0.02) / 0.4, (0.98 - v) / 0.4);
      facet = v < 0.36 ? 0 : v < 0.68 ? 1 : 2;
      break;
    }
    case 3: { // kite: broad below the middle, narrow above
      const w = v < 0.5 ? 0.18 + v * 1.3 : 0.83 - (v - 0.5) * 1.06;
      slack = Math.min(w - Math.abs(u), v - 0.015, 1.0 - v);
      facet = (v < 0.5) !== (u > 0) ? 1 : 0;
      break;
    }
    case 4: { // tall triangle, apex at the bottom
      const w = 0.06 + v * 0.9;
      slack = Math.min(w - Math.abs(u), 0.985 - v, v + 0.2);
      facet = diag < -0.1 ? 1 : 0;
      break;
    }
    case 5: { // split quad: a near-full plane with one hard diagonal facet
      slack = Math.min(0.8 - Math.abs(u), (v - 0.02) / 0.4, (0.98 - v) / 0.4);
      facet = diag > 0 ? 1 : 0;
      break;
    }
    case 6: { // long sliver, leaning as it rises
      const uc = u - (v - 0.5) * 0.34;
      const w = 0.52 - v * 0.38;
      slack = Math.min(w - Math.abs(uc), v - 0.015, 1.0 - v);
      facet = uc > 0 ? 1 : 0;
      break;
    }
    default: { // elongated diamond, three facets: ends one tone, middle split
      slack = 1 - (Math.abs(u) / 0.62 + Math.abs(v - 0.5) / 0.55);
      facet = v < 0.3 || v > 0.72 ? 2 : (u > 0 ? 1 : 0);
      break;
    }
  }
  // a hair of hand-cut raggedness so no edge is laser straight
  const rag = (n1(v * 34 + u * 21, seed + 4) - 0.5) * 0.035;
  const inside = slack + rag > 0 ? 1 : 0;
  if (!inside) return [0, 0, 0.5];
  // flat facets: the tone channel sits well below / above the dab shader's mix step, so each facet
  // reads as one flat colour; the height steps with the facet so the cut between facets catches light
  const tone = [0.22, 0.82, 0.55][facet];
  const bevel = 0.6 + 0.4 * clamp01(slack / 0.09); // chiselled down near the edge
  const height = ([0.62, 0.44, 0.53][facet]) * bevel;
  return [height, 1, tone];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 5, 1, 2, 4, 7, 3, 6];
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

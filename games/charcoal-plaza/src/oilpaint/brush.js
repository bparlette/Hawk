// The brush sheet: eight marks of a charcoal stick dragged and smudged, made here rather than drawn by anyone.
// Each cell holds one mark laid along +v: r is a low, uneven deposit height (charcoal sits IN the paper, it
// does not stand up off it), g is where charcoal is at all — a soft smudged falloff with an irregular, eaten
// edge, never a hard outline — and b is the tone field the fragment shader blends across: broad tonal
// variation at one scale, powdery grain at a finer one.
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

// one mark: kind 0 a long stroke that runs dry, 1 a short fat dab, 2 a stroke with a curve to it
function mark(u, v, seed, kind) {
  const bend = kind === 2 ? (seed % 2 ? 0.34 : -0.34) : (hash(seed * 3.1) - 0.5) * 0.12;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.1;
  const a = Math.abs(ub + wob);
  let half, start, end;
  if (kind === 1) {
    // a smudged charcoal mass: a broad soft-edged patch of tone. The edge is eaten and irregular
    // (the stick crumbles, the finger smears), the falloff is wide — charcoal has no hard edges —
    // and the deposit inside is uneven: dense patches where the stick pressed, thin dusty ones
    // where it only grazed.
    const r = Math.hypot(ub / 0.68, (v - 0.5) / 0.46);
    const ang = Math.atan2(v - 0.5, ub);
    const edge = 1 + (n1(ang * 1.8 + 9, seed) - 0.5) * 0.55 + (n1(ang * 6.5 + 4, seed + 5) - 0.5) * 0.22;
    half = 0.68; start = 0; end = 1;
    const alpha = 1 - sstep(edge - 0.5, edge + 0.22, r);
    // b channel: broad tonal drift + fine powder grain, the two scales charcoal varies at
    const tone = n2(ub * 2.6, v * 1.6, seed + 20) * 0.5 + n2(ub * 9, v * 6, seed + 21) * 0.28 + n2(ub * 26, v * 18, seed + 22) * 0.22;
    const height = alpha * (0.42 + 0.1 * n1(ub * 11 + n1(v * 3, seed) * 1.5, seed + 31));
    return [height, alpha, tone];
  }
  half = 0.6 * (0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, v * 1.15))) * (1 + (n1(v * 7, seed + 1) - 0.5) * 0.1);
  start = 0.05 + 0.05 * n1(ub * 5, seed + 2);
  end = 0.95 - 0.3 * n1(ub * 4.5 + 2, seed + 4) - 0.06 * n1(ub * 19, seed + 6);
  const side = 1 - sstep(half - 0.07, half, a);
  const head = sstep(start, start + 0.035, v);
  const tail = 1 - sstep(end - 0.02, end + 0.015, v);
  // the brush runs dry toward the end: single bristles give out and leave gaps
  const dryness = sstep(end - 0.2, end, v);
  const bristle = n1(ub * 13, seed + 8) * 0.7 + n1(ub * 31, seed + 9) * 0.3;
  const gap = 1 - sstep(dryness * 0.55 - 0.08, dryness * 0.55, bristle) < 0.5 ? 1.0 : 0.0;
  const alpha = side * head * tail * gap;
  const furrow = n1(ub * 12 + n1(v * 2.5, seed + 12) * 1.2, seed + 33) * 0.7 + n1(ub * 29, seed + 34) * 0.3;
  const load = 1 - 0.55 * sstep(0.1, 0.9, v); // thick where the brush touched down, thin where it left
  const squeezed = sstep(half - 0.3, half - 0.06, a); // paint pushed out to the sides of the stroke
  const height = alpha * (0.3 + 0.22 * furrow * (0.5 + 0.5 * n1(ub * 11, seed + 13)) + 0.3 * squeezed + 0.25 * load * (1 - sstep(start, start + 0.25, v)) + 0.1 * n2(ub * 3, v * 7, seed + 14));
  return [Math.min(1, height), alpha, n2(ub * 3.4, v * 1.1, seed + 20)];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [1, 1, 1, 1, 1, 1, 1, 1]; // every mark a smudged charcoal mass: no strokes, no lines, no hard edges
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

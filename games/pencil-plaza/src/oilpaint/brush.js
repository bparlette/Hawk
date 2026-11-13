// The pencil sheet: eight graphite marks, made here rather than drawn by anyone. Each cell holds one mark
// laid along +v: r is how high the graphite stands (for the light that rakes across it), g is how much
// graphite is deposited (the finish and the dab shader read it as coverage), b is a slow grain along the
// stroke. A pencil mark is never a flat fill: it is lines — a bundle of parallel hatch lines, or a
// scribble patch of one or two crossing line families over a light smudge — with bare paper in the gaps.
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

// one mark in pencil. kind 0: a bundle of hatch lines running along the stroke (v), side by side across
// u, each line with its own pressure and its own start and end — the way a hand lays a patch of hatching
// in one pass, paper showing between the lines. kind 1: a cross-hatch patch — two crossing line families
// inside a soft blob, over a light smudge. kind 2: the same patch with a single line family (mid-tones).
function mark(u, v, seed, kind) {
  if (kind === 1 || kind === 2) {
    // a blob with an irregular, worried edge — a scribbled patch, not a cut shape
    const ang = Math.atan2(v - 0.5, u);
    const edge = 1 + (n1(ang * 2.2 + 9, seed) - 0.5) * 0.35;
    const r = Math.hypot(u / 0.72, (v - 0.5) / 0.46) / edge;
    const mask = 1 - sstep(0.8, 1.0, r);
    if (mask <= 0) return [0, 0, 0.5];
    // the smudge a stump drags under the lines: a light, uneven deposit everywhere in the patch
    let g = 0.42 + 0.12 * n2(u * 3.1, v * 2.2, seed + 20);
    // line families: a coordinate across the family; a line wherever it passes a whole number.
    // the coordinate wobbles a little, because the hand is not a ruler.
    const fam = (su, sv, freq) => {
      const s = (u * su + (v - 0.5) * sv) * freq + (n1(v * 4 + u * 2, seed + 5) - 0.5) * 0.7;
      const f = Math.abs(s - Math.round(s));
      return 1 - sstep(0.07, 0.24, f);
    };
    const a = fam(1.0, 0.55, 5.2);
    let line = a;
    if (kind === 1) line = Math.max(a, fam(1.0, -0.55, 5.2) * 0.9); // the second family crosses the first
    g = Math.max(g, line * (0.88 + 0.12 * n1(u * 9, seed + 31)));
    g *= mask;
    const height = g * (0.35 + 0.25 * line);
    return [height, g, n2(u * 3.4, v * 1.1, seed + 20)];
  }
  // kind 0: the line bundle. Lines run along v; across u there are six of them.
  const NL = 6;
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.08;
  let g = 0;
  for (let i = 0; i < NL; i++) {
    const t = i / (NL - 1);
    const cu = -0.78 + 1.56 * t + (hash(seed * 7.7 + i * 3.3) - 0.5) * 0.1;
    const d = Math.abs(u + wob - cu);
    const press = 0.75 + 0.25 * hash(seed * 3.9 + i * 11.1); // no two lines pressed alike
    // each line starts and stops at its own place along the stroke, tapered at both ends
    const v0 = 0.02 + 0.16 * hash(seed * 5.1 + i * 7.7);
    const v1 = 0.98 - 0.22 * hash(seed * 9.3 + i * 5.5);
    const along = sstep(v0, v0 + 0.1, v) * (1 - sstep(v1 - 0.1, v1, v));
    const prof = (1 - sstep(0.045, 0.11, d)) * press * along;
    if (prof > g) g = prof;
  }
  return [g * 0.6, g, n2(u * 3.4, v * 1.1, seed + 20)];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 0, 1, 2, 0, 1, 2, 1]; // hatch-line bundles and scribble patches, mixed like a real sketch
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

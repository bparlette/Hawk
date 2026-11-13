// The crayon sheet: eight marks of a wax crayon drawn along textured paper, made here rather than drawn by
// anyone. Each cell holds one scribble laid along +v: r is how far the wax stands (low — crayon sits IN the
// paper), g is where wax actually landed (streaks with breaks and paper pits in them — never a solid fill),
// b is a second, offset set of streaks (where the dab's second colour shows as parallel lines), and a is the
// fine paper grain itself, so every dab can thin out where the grain's pits caught no wax.
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

// one mark: kind 0 a long scribble stroke, 1 a short fat scribble patch, 2 a scribble with a curve to it.
// A crayon mark is a BUNDLE OF PARALLEL STREAKS, not a fill: the wax catches on the paper's high grain in
// lines along the stroke, breaks where the hand's pressure eased, and misses the pits altogether. So the
// deposit (returned as the second value) is envelope × streaks × breaks × pits, and it is honestly less
// than 1 almost everywhere — the paper is part of every colour.
function mark(u, v, seed, kind) {
  const grain = 0.5 + 0.5 * n2(u * 17 + 3, v * 34, seed + 77); // the paper's own tooth, stored in alpha
  const bend = kind === 2 ? (seed % 2 ? 0.3 : -0.3) : (hash(seed * 3.1) - 0.5) * 0.1;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  // the envelope: a wobbly crayon outline, soft at both ends where the stroke touched down and lifted
  let env;
  if (kind === 1) {
    const ang = Math.atan2(v - 0.5, ub);
    const rr = Math.hypot(ub / 0.82, (v - 0.5) / 0.47) * (1 + (n1(ang * 2.4 + 9, seed) - 0.5) * 0.34);
    env = 1 - sstep(0.78, 1.02, rr);
  } else {
    const half = 0.68 * (1 + (n1(v * 6, seed + 3) - 0.5) * 0.24);
    const side = 1 - sstep(half - 0.18, half + 0.12, Math.abs(ub));
    env = side * sstep(0.0, 0.1, v) * (1 - sstep(0.88, 1.0, v));
  }
  if (env <= 0.003) return [0, 0, 0.5, grain];
  // the streaks: seven wax lines across the stroke, each with its own width, strength and broken rhythm
  let prof = 0, prof2 = 0;
  for (let i = 0; i < 7; i++) {
    const ci = -0.78 + 1.56 * hash(seed * 7.7 + i * 3.3);
    const wi = 0.09 + 0.13 * hash(seed * 5.1 + i * 7.9);
    const si = 0.55 + 0.45 * hash(seed * 9.3 + i * 1.7);
    const brk = 0.4 + 0.6 * n1(v * (5 + hash(seed + i * 3) * 4) + i * 13.7, seed + 40 + i);
    const dd = (ub - ci) / wi;
    prof = Math.max(prof, si * Math.exp(-dd * dd) * brk);
    const dj = (ub - ci - 0.09) / wi; // the second colour's lines, offset half a streak over
    prof2 = Math.max(prof2, si * Math.exp(-dj * dj) * brk);
  }
  // pressure: fullest mid-stroke, easing where the hand landed and lifted (fat patches keep their pressure)
  const press = kind === 1 ? 1 : 0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
  let dep = env * Math.min(1, prof * 1.3) * press;
  // paper pits: fine speckle holes where no wax reached at all
  if (n2(ub * 26 + 7, v * 52, seed + 91) < 0.17) dep *= 0.25;
  dep *= 0.75 + 0.25 * grain; // and the deposit everywhere follows the tooth, heavier on the highs
  const height = dep * (0.28 + 0.34 * prof); // wax stands in low ridges along its own streaks
  return [Math.min(1, height), Math.min(1, dep), Math.min(1, prof2), grain];
}

export function createBrushSheet() {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  const kinds = [0, 1, 2, 1, 0, 2, 1, 0]; // scribbles long, fat and curved — no solid fills anywhere
  for (let cell = 0; cell < 8; cell++) {
    const cx = cell % BRUSH_COLS, cy = Math.floor(cell / BRUSH_COLS);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        // a margin of nothing round each mark, so the small copies of the sheet don't bleed into each other
        const u = ((x + 0.5) / CW) * 2 - 1, v = (y + 0.5) / CH;
        const m = 0.9;
        const [h, a, s, g] = Math.abs(u) > m || v < 0.04 || v > 0.96 ? [0, 0, 0.5, 0.75] : mark(u / m, (v - 0.04) / 0.92, cell * 7 + 1, kinds[cell]);
        const i = ((cx * CW + x) + (cy * CH + y) * W) * 4;
        data[i] = Math.round(h * 255);
        data[i + 1] = Math.round(a * 255);
        data[i + 2] = Math.round(s * 255);
        data[i + 3] = Math.round(g * 255); // alpha carries the paper grain for the dab shader
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

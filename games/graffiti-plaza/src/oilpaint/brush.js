// The brush sheet, aerosol edition — PIECE marks: eight marks of a spray can laying down a fill the
// way a writer lays one: a HARD-EDGED body of full-strength paint (a fat cap at close range does not
// feather its fill; the edge is a line, not a gradient), a THIN overspray halo just outside that edge
// (the only soft part, and it belongs to the halo, never to the fill), and satellite splatter thrown
// off as accents. What the sheet stores is how much paint landed at each point of the mark, and the
// dab shader (dabs.js) turns that into colour and cover.
//
// Channels: r is deposit density (~1 right through the body, falling only at the edge), g is cover —
// the deposit field itself: ~1 inside the hard edge, a step down across two or three pixels, then the
// faint halo skirt, then nothing; b is a slow streak along the spray (where a second colour was
// picked up and not mixed in), compressed toward the middle so the fill stays flat with only a
// gentle fade across it. There is no height channel: spray lies flat, and nothing rakes light
// across it.
//
// A second sheet (createDripSheet) holds one thing only: drips — thin vertical runs with a head, a shaft
// and a bead at the bottom — for the dab field in main.js that lays them down the house walls.
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

// satellite splatter: droplets thrown off round the mark, fixed for a given seed. Each is a small SOFT
// deposit (spray droplets are fuzzy, not hard discs), sitting just outside the body of the mark, with a
// cover well below the body's — they are overspray, not paint laid on purpose.
function satellites(u, v, seed, wide) {
  let a = 0;
  for (let k = 0; k < 12; k++) {
    const side = hash(seed * 5.3 + k * 3.77) > 0.5 ? 1 : -1;
    const cu = side * (wide + 0.04 + 0.34 * hash(seed * 7.1 + k * 1.31));
    const cv = 0.03 + 0.94 * hash(seed * 9.7 + k * 2.17);
    const rv = 0.010 + 0.034 * hash(seed * 3.9 + k * 4.53);
    const d = Math.hypot((u - cu) / (rv * 1.7), (v - cv) / rv);
    const strength = 0.30 + 0.35 * hash(seed * 11.3 + k * 6.71);
    a = Math.max(a, strength * (1 - sstep(0.35, 1.0, d)));
  }
  return a;
}

// one mark: kind 0 a long spray pass, 1 a round splat from a fat cap, 2 a pass with a curve to it.
// Returns [density, cover, streak]. The body is a HARD fill: cover holds ~1 until the shape's edge,
// then steps down across a few pixels — the droplet breakup in the dab shader nibbles that step into
// a spray edge (stippled, never airbrushed). Outside the edge rides a faint halo skirt (cover ~0.13)
// that the shader's mist-eating dissolves into sparse overspray dots: the halo is an accent around
// the fill, not the fill's own softness. The streak channel is compressed toward 0.5 so a fill reads
// flat, with only a broad gentle fade where the second colour was picked up.
function mark(u, v, seed, kind) {
  const bend = kind === 2 ? (seed % 2 ? 0.40 : -0.40) : (hash(seed * 3.1) - 0.5) * 0.12;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.07;
  const a = Math.abs(ub + wob);
  const mottle = 0.93 + 0.11 * n2(u * 22, v * 44, seed + 77); // the can's unevenness, kept shallow: a fill is flat first
  const streak = 0.5 + (n2(ub * 3.4, v * 1.1, seed + 20) - 0.5) * 0.65;
  if (kind === 1) {
    // a splat: a hard round body, a whisper of halo round it, splatter thrown off
    const r = Math.hypot(ub / 0.74, (v - 0.5) / 0.46);
    let cover = (1 - sstep(0.60, 0.68, r)) * mottle;
    cover = Math.max(cover, 0.13 * (1 - sstep(0.68, 1.02, r)));
    cover = Math.max(cover, satellites(ub, v, seed + 40, 0.74));
    const density = 1 - sstep(0.30, 0.72, r);
    return [density, Math.min(1, cover), streak];
  }
  // a spray pass laid as a fill: hard sides, near-square ends (the can starts and stops on the
  // shape, it does not drift through it), the halo skirt outside the sides only
  const half = 0.58 * (0.86 + 0.14 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * (1 + (n1(v * 7, seed + 1) - 0.5) * 0.08);
  const head = sstep(0.0, 0.05, v);
  const tail = 1 - sstep(0.95, 1.0, v);
  let cover = (1 - sstep(half - 0.045, half + 0.045, a)) * head * tail * mottle;
  cover = Math.max(cover, 0.13 * (1 - sstep(half + 0.03, half + 0.40, a)) * head * tail);
  cover = Math.max(cover, satellites(ub, v, seed, half) * head * tail);
  const density = (1 - sstep(half - 0.10, half + 0.02, a)) * head * tail;
  return [density, Math.min(1, cover), streak];
}

function sheet(kinds, markFn) {
  const W = CW * BRUSH_COLS, H = CH * BRUSH_ROWS;
  const data = new Uint8Array(W * H * 4);
  for (let cell = 0; cell < 8; cell++) {
    const cx = cell % BRUSH_COLS, cy = Math.floor(cell / BRUSH_COLS);
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        // almost no margin: a spray mark's mist is supposed to reach the edge of its card, so the
        // overspray of one dab runs into the next. The feather is ~0 by the edge itself, which is
        // what keeps the small copies of the sheet from bleeding colour between cells.
        const u = ((x + 0.5) / CW) * 2 - 1, v = (y + 0.5) / CH;
        const m = 0.97;
        const [r, g, b] = Math.abs(u) > m || v < 0.015 || v > 0.985 ? [0, 0, 0.5] : markFn(u / m, (v - 0.015) / 0.97, cell * 7 + 1, kinds[cell]);
        const i = ((cx * CW + x) + (cy * CH + y) * W) * 4;
        data[i] = Math.round(r * 255);
        data[i + 1] = Math.round(g * 255);
        data[i + 2] = Math.round(b * 255);
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

export function createBrushSheet() {
  return sheet([0, 0, 2, 1, 1, 0, 1, 2], mark);
}

// a drip: v = 1 is the bottom of the card (see the dab vertex shader: +v runs along the dab's dir,
// and main.js points its drips' dir down the wall). A slightly wider, denser head where the run
// started, a thin shaft, and a bead — the heaviest deposit — gathering at the bottom before it stops.
function dripMark(u, v, seed) {
  const uc = u - (n1(v * 6, seed + 3) - 0.5) * 0.07;
  const a = Math.abs(uc);
  const gauss = (c, w) => Math.exp(-((v - c) / w) * ((v - c) / w));
  const hw = 0.085 + 0.085 * gauss(0.07, 0.075) + 0.13 * gauss(0.90, 0.06);
  // a run is liquid paint, not mist: the shaft's cover is a hard column (a step at its edge, like
  // the piece fills), so a drip reads at a glance across the plaza instead of dissolving
  let cover = (1 - sstep(hw - 0.018, hw + 0.030, a)) * sstep(0.004, 0.045, v) * (1 - sstep(0.955, 1.0, v));
  cover *= 0.92 + 0.14 * n2(u * 20, v * 60, seed + 77);
  const density = (1 - sstep(hw * 0.6 - 0.02, hw * 0.6 + 0.05, a)) * (0.7 + 0.3 * gauss(0.90, 0.09));
  // a speck or two flicked off near the head
  cover = Math.max(cover, satellites(u * 0.55, v, seed + 9, 0.30) * (1 - sstep(0.25, 0.5, v)) * 0.7);
  return [Math.min(1, density), Math.min(1, cover), 0.5];
}

export function createDripSheet() {
  return sheet([0, 0, 0, 0, 0, 0, 0, 0], dripMark);
}

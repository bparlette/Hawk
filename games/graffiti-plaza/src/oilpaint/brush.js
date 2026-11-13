// The brush sheet, aerosol edition: eight marks of a spray can, made here rather than drawn by anyone.
// A mark is not a bristle stroke any more — it is a DEPOSIT of spray: what the sheet stores is how much
// paint landed at each point of the mark, and the dab shader (dabs.js) turns that into colour and cover.
//
// Channels: r is deposit density (thick in the middle of a pass, thin at the feather), g is cover — the
// deposit field itself, with a long soft tail: a solid core, then a mist that thins out over most of the
// cell, then nothing; b is a slow streak along the spray (where a second colour was picked up and not
// mixed in). There is no height channel any more: spray lies flat, and nothing in the painter rakes light
// across it. Every mark also throws satellite splatter — small soft droplets sitting apart from the body —
// and the mist of one dab is meant to reach the edge of its card, so neighbouring dabs' overspray overlaps
// on the surface and the marks stop reading as separate objects.
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
// Returns [density, cover, streak]. Cover is a smooth field on purpose: the droplet breakup of the
// mist is done per-pixel in the dab shader, so what is baked here is the shape of the deposit —
// dense in the middle of the form, feathering out at the edges, the layered build of real spray.
function mark(u, v, seed, kind) {
  const bend = kind === 2 ? (seed % 2 ? 0.40 : -0.40) : (hash(seed * 3.1) - 0.5) * 0.12;
  const ub = u - bend * (4 * (v - 0.5) * (v - 0.5) - 0.5);
  const wob = (n1(v * 5, seed + 3) - 0.5) * 0.07;
  const a = Math.abs(ub + wob);
  const mottle = 0.84 + 0.32 * n2(u * 22, v * 44, seed + 77); // the can's unevenness, baked in gently
  if (kind === 1) {
    // a splat: a soft round body with a very long mist tail, splatter thrown off round it
    const r = Math.hypot(ub / 0.74, (v - 0.5) / 0.46);
    let cover = (1 - sstep(0.42, 1.18, r)) * mottle;
    cover = Math.max(cover, satellites(ub, v, seed + 40, 0.74));
    const density = 1 - sstep(0.05, 0.85, r);
    return [density, Math.min(1, cover), n2(ub * 3.2, v * 1.3, seed + 20)];
  }
  // a spray pass: wide misted core, soft start and end (the can is moving before and after the mark),
  // cover feathering over most of the cell width so the halo reaches the card's edge
  const half = 0.58 * (0.86 + 0.14 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * (1 + (n1(v * 7, seed + 1) - 0.5) * 0.08);
  const head = sstep(0.0, 0.17, v);
  const tail = 1 - sstep(0.70, 1.0, v);
  let cover = (1 - sstep(half - 0.44, half + 0.52, a)) * head * tail * mottle;
  cover = Math.max(cover, satellites(ub, v, seed, half) * head * tail);
  const density = (1 - sstep(0.0, half + 0.06, a)) * head * tail;
  // a few pinholes where the can stuttered — only in the body, the mist is broken up in the shader
  if (cover > 0.55 && n2(u * 58, v * 116, seed + 78) > 0.955) cover *= 0.45;
  return [density, Math.min(1, cover), n2(ub * 3.4, v * 1.1, seed + 20)];
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
  let cover = (1 - sstep(hw - 0.055, hw + 0.10, a)) * sstep(0.004, 0.045, v) * (1 - sstep(0.955, 1.0, v));
  cover *= 0.85 + 0.3 * n2(u * 20, v * 60, seed + 77);
  const density = (1 - sstep(hw * 0.5 - 0.03, hw * 0.5 + 0.06, a)) * (0.55 + 0.45 * gauss(0.90, 0.09));
  // a speck or two flicked off near the head
  cover = Math.max(cover, satellites(u * 0.55, v, seed + 9, 0.30) * (1 - sstep(0.25, 0.5, v)) * 0.7);
  return [Math.min(1, density), Math.min(1, cover), 0.5];
}

export function createDripSheet() {
  return sheet([0, 0, 0, 0, 0, 0, 0, 0], dripMark);
}

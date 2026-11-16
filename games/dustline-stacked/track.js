// DUSTLINE — track data: "Greybox Loop" replica layout.
// World: 106 x 74 metres, surface grid 2 cells/metre (212 x 148), 8 checkpoints.
// Surfaces: 0 dirt, 1 sand, 2 mud, 3 gravel, 4 rock, 5 water, 6 ribs.
'use strict';

// Deterministic RNG (mulberry32) so every look + every test sees the same world.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD = { w: 106, h: 74 };

// Centreline of the loop, in travel order (bottom straight heads WEST first).
// [x, y, corridorWidth]
const CENTERLINE_RAW = [
  [52, 65, 13], [34, 65, 13], [20, 64, 12], [12, 58, 11], [9.5, 47, 11],
  [10, 36, 11], [12, 27, 11], [17, 20, 11], [26, 17, 11], [40, 16.5, 11],
  [56, 16.5, 11], [70, 17, 11], [82, 17, 12], [91, 22, 12], [95.5, 30, 11],
  [96, 39, 11], [92, 46, 11], [84, 49.5, 11], [72, 50.5, 11], [58, 50.5, 11],
  [45, 49, 11], [37, 46, 10], [33.5, 40, 10], [36, 34.5, 10], [44, 37.5, 11],
  [56, 37.5, 11], [70, 37.5, 11], [82, 39, 11], [90, 44, 11], [93.5, 52, 11],
  [88, 59, 12], [76, 62.5, 12], [62, 64, 13]
];

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Resample the closed centreline at ~0.5 m spacing with cumulative length + curvature.
function buildCenterline() {
  const pts = CENTERLINE_RAW;
  const n = pts.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(4, Math.round(segLen / 0.55));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      dense.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        y: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        w: p1[2] + (p2[2] - p1[2]) * t
      });
    }
  }
  // cumulative length
  let L = 0;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length];
    a.len = Math.hypot(b.x - a.x, b.y - a.y);
    a.s = L; L += a.len;
  }
  // heading + curvature (smoothed)
  for (let i = 0; i < dense.length; i++) {
    const a = dense[(i - 2 + dense.length) % dense.length], b = dense[(i + 2) % dense.length];
    dense[i].ang = Math.atan2(b.y - a.y, b.x - a.x);
  }
  for (let i = 0; i < dense.length; i++) {
    let da = dense[(i + 3) % dense.length].ang - dense[(i - 3 + dense.length) % dense.length].ang;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    dense[i].curv = Math.abs(da) / Math.max(1, dense[i].len * 6);
  }
  return { samples: dense, length: L };
}

const SURF = { DIRT: 0, SAND: 1, MUD: 2, GRAVEL: 3, ROCK: 4, WATER: 5, RIBS: 6 };

// Per-surface driving behaviour.
const SURF_PROPS = [
  { name: 'dirt',   top: 26,   gripLat: 8.0, drag: 0.25, dust: 0.55 },
  { name: 'sand',   top: 12.5, gripLat: 5.0, drag: 1.45, dust: 1.0 },
  { name: 'mud',    top: 17,   gripLat: 2.1, drag: 0.70, dust: 0.35 },
  { name: 'gravel', top: 21,   gripLat: 6.5, drag: 0.50, dust: 0.8 },
  { name: 'rock',   top: 15,   gripLat: 6.0, drag: 0.60, dust: 0.25 },
  { name: 'water',  top: 8.5,  gripLat: 4.0, drag: 2.30, dust: 0.0 },
  { name: 'ribs',   top: 24,   gripLat: 8.0, drag: 0.55, dust: 0.6 }
];

function riverCenterY(x) {
  return 17 + 3.2 * Math.sin(x * 0.05) + 1.6 * Math.sin(x * 0.117 + 1.3);
}

function buildSurfaceGrid() {
  const gw = 212, gh = 148, cell = 0.5;
  const grid = new Uint8Array(gw * gh);
  const rng = mulberry32(1337);
  const blobs = [];
  // random gravel speckle patches (seeded)
  for (let i = 0; i < 7; i++) blobs.push({ x: 8 + rng() * 90, y: 8 + rng() * 58, r: 1.6 + rng() * 2.4 });
  const inEllipse = (x, y, cx, cy, rx, ry) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy < 1;
  };
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = (gx + 0.5) * cell, y = (gy + 0.5) * cell;
      let s = SURF.DIRT;
      // river: wavy band across the whole map, sand banks
      const dyRiver = Math.abs(y - riverCenterY(x));
      if (dyRiver < 5.0) s = SURF.WATER;
      else if (dyRiver < 7.4) s = SURF.SAND;
      // sand island inside the hairpin + aprons
      if (inEllipse(x, y, 28, 47, 8.5, 7.5)) s = SURF.SAND;
      if (inEllipse(x, y, 36, 52, 6, 3.6)) s = SURF.SAND;
      // SE sweep sand patch
      if (inEllipse(x, y, 84, 56, 6, 3.2)) s = SURF.SAND;
      // mud bowl (NE) + east-descent patch
      if (inEllipse(x, y, 85, 23, 11, 8)) s = SURF.MUD;
      if (inEllipse(x, y, 95, 38, 4, 5)) s = SURF.MUD;
      // gravel beds
      if (inEllipse(x, y, 60, 51, 7, 3.4)) s = SURF.GRAVEL;
      if (inEllipse(x, y, 14, 50, 4, 3)) s = SURF.GRAVEL;
      for (const b of blobs) if (inEllipse(x, y, b.x, b.y, b.r, b.r * 0.7)) s = SURF.GRAVEL;
      // rock outcrops
      if (inEllipse(x, y, 100.5, 30, 3.4, 4.2)) s = SURF.ROCK;
      if (inEllipse(x, y, 3.6, 67, 3.2, 3)) s = SURF.ROCK;
      if (inEllipse(x, y, 102, 68, 3.4, 3)) s = SURF.ROCK;
      // ribbed jump section (middle straight)
      if (x > 56 && x < 70 && y > 35.4 && y < 41) s = SURF.RIBS;
      // the river wins over ribs where they would overlap (they don't, but keep order safe)
      if (dyRiver < 5.0) s = SURF.WATER;
      grid[gy * gw + gx] = s;
    }
  }
  return { grid, gw, gh, cell };
}

const PICKUPS = [
  { x: 76, y: 15.5, type: 'nitro' },
  { x: 60, y: 50.5, type: 'repair' },
  { x: 50, y: 37.5, type: 'nitro' },
  { x: 10.5, y: 40, type: 'repair' }
];

// Breakable tire stacks (on corridor edges).
const STACKS = [
  { x: 90.5, y: 44.5 }, { x: 14.5, y: 29.5 }, { x: 66, y: 18.6 },
  { x: 30, y: 60.8 }, { x: 41, y: 41.5 }, { x: 93, y: 55.5 }
];

const TRACK = (() => {
  const cl = buildCenterline();
  const surf = buildSurfaceGrid();
  // 8 checkpoints evenly spaced along the line
  const checkpoints = [];
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor((i / 8) * cl.samples.length);
    checkpoints.push({ x: cl.samples[idx].x, y: cl.samples[idx].y, s: cl.samples[idx].s });
  }
  function surfaceAt(x, y) {
    const gx = Math.floor(x / surf.cell), gy = Math.floor(y / surf.cell);
    if (gx < 0 || gy < 0 || gx >= surf.gw || gy >= surf.gh) return SURF.DIRT;
    return surf.grid[gy * surf.gw + gx];
  }
  return { samples: cl.samples, length: cl.length, surf, surfaceAt, checkpoints, pickups: PICKUPS, stacks: STACKS };
})();

// DUSTLINE — renderers for the three looks. One simulation, three paint jobs.
// v2 BASE REBUILD: the ground is a baked SCENE, not a field. A distance field
// over the centreline makes the ROAD a real surface — pale worn dirt with twin
// wheel bands and corner wear, soft shoulders blending into textured scrub —
// with a banked river, sand traps, a corrugated rib section, rocks, bushes,
// scenery tire stacks and a start gantry. Each look re-renders that same rich
// base in its own medium:
// A "REPLICA": 4 px/m chunky buffer, Amiga palette, Bayer-dithered terrain, flat pixel trucks.
// B "PAINTED": 12 px/m, big brush strokes + broken colour, warm storybook grade, painted trucks.
// C "SPRITE PIXEL": 6 px/m crunched world, cooler darker grade, voxel-shaded 16-dir truck sprites.
// v3 ROUND 3: the terrain gets a real HEIGHTFIELD — procedural dunes + authored
// masses (NE dune, banked sand bowl, corrugated mound, carved river channel),
// hillshaded from a fixed NW sun. The road is graded to a smoothed height
// profile along the centreline, so the course reads CARVED through the dunes
// with cut banks, instead of lying flat on top of them.
// v4 ROUND 4: the procedural field alone read as SOFT SCULPTED MASSES, so the
// big features are now HAND-AUTHORED to echo the reference's composition — a
// dominant dune ridge chained along the top with a long shadow face, the NE
// mud bowl raised into a dark earthwork, the hairpin bowl and the rib mound
// scaled up into true earthworks — with harder hillshade, elevation-tied
// colour (dark red-brown lows, pale crests) and a sparkling river.
'use strict';

const LOOK_CONF = {
  A: { ppm: 4,  smooth: false, spriteSpan: 7.7, name: 'REPLICA' },
  C: { ppm: 6,  smooth: false, spriteSpan: 7.3, name: 'SPRITE PIXEL' },
  B: { ppm: 12, smooth: true,  spriteSpan: 7.9, name: 'PAINTED' }
};

const PALETTES = {
  A: {
    dirt: ['#a05c26', '#8f4f1e', '#b26a30', '#7e451a'], sand: ['#e0bd76', '#d9b96e'], mud: ['#5e3c1e', '#533417', '#6d4a26'],
    gravel: ['#8a7d6a', '#7f7260'], rock: ['#6e685f', '#625c53'], water: ['#2456d8', '#173a9e'],
    road: ['#bb9050', '#ae8445', '#c69e5c'], roadDark: '#6e4c22', shoulder: '#a87c40',
    shore: '#69b7e8', tapeRed: '#d42a1e', tapeWhite: '#ece7da', dark: '#2a1a0e'
  },
  C: {
    dirt: ['#8a5a2e', '#7c4f27', '#96652f', '#6e4522'], sand: ['#d8ba7c', '#cdb071'], mud: ['#5f3f20', '#54371b', '#71502c'],
    gravel: ['#847768', '#796c5c'], rock: ['#6b6257', '#5f574c'], water: ['#1e46b8', '#122c78'],
    road: ['#ac854a', '#a17a40', '#b89152'], roadDark: '#63451f', shoulder: '#98753d',
    shore: '#5aa2d8', tapeRed: '#c22e20', tapeWhite: '#e6e1d2', dark: '#241a10'
  },
  B: {
    dirt: ['#bb8a54', '#b3814b', '#c2915c', '#a3743f'], sand: ['#ecd096', '#e6c78a'], mud: ['#6e4a28', '#654324', '#7d5730'],
    gravel: ['#9a8a72', '#91805f'], rock: ['#7d7468', '#726a5e'], water: ['#2f6fd0', '#2a66c2'],
    road: ['#dcbc7d', '#c9a55f', '#e6c98b'], roadDark: '#8a6132', shoulder: '#bd9c5e',
    shore: '#8ec9ec', tapeRed: '#c8402a', tapeWhite: '#f3e6c8', dark: '#3a2318'
  }
};
const SURF_KEYS = ['dirt', 'sand', 'mud', 'gravel', 'rock', 'water', 'dirt']; // index by SURF (ribs -> dirt base)

function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function sstep(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
// smooth value noise (bilinear lattice, smootherstep) — the dunes' raw material
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function gauss2(x, y, cx, cy, r) { const dx = (x - cx) / r, dy = (y - cy) / r; return Math.exp(-(dx * dx + dy * dy)); }
// Terrain elevation (arbitrary metres) BEFORE the road is graded through it:
// broad dune octaves + authored masses + the bowl dome + the rib mound +
// the river channel carved down. Authored features sit where the reference
// puts them: dark NE dune, pale banked bowl in the hairpin, mound mid-east.
function terrainHeight(x, y) {
  // v4: the noise is demoted to TEXTURE — the landforms below are authored.
  // On the far-bank strip (y < ~12) the fine octave is damped hard: his top
  // dune is ONE smooth face, and speckle there reads as noise, not landform.
  const stripW = 1 - sstep(8, 14, y);
  let h = 1.55 * vnoise(x * 0.028 + 13.7, y * 0.028 + 7.1)
        + 0.6 * vnoise(x * 0.075 + 3.1, y * 0.075 + 9.4)
        + 0.18 * vnoise(x * 0.22 + 8.8, y * 0.22 + 2.2) * (1 - 0.7 * stripW);
  h -= 1.17; // recenter (mean of the three octaves)
  // the dune FACE: one clean planar fall from the top edge down to the
  // river, so the hillshade lights it as a single sculpted slope with a
  // bright crest roll at the top instead of a chain of bumps
  h += 1.15 * (1 - sstep(1.5, 12.5, y)) * sstep(14, 30, x);
  // THE TOP RIDGE: a chain of masses along the far bank — one dominant dune
  // wall across the top of the scene, its long south face falling to the
  // river in shadow (sun is NW, so the track-facing slope is the dark one).
  h += 1.30 * gauss2(x, y, 36, 3, 14);
  h += 1.60 * gauss2(x, y, 56, 2, 16);
  h += 1.85 * gauss2(x, y, 76, 3, 17);
  h += 1.80 * gauss2(x, y, 90, 6, 17);   // NE dune mass (ridge's east anchor)
  h += 1.35 * gauss2(x, y, 102, 12, 12);
  // NE EARTHWORK: the mud bowl inside the east hairpin raised into a dark
  // churned mass — the reference's dominant top-right landform.
  h += 1.55 * gauss2(x, y, 87, 25, 10.5);
  h += 1.00 * gauss2(x, y, 4, 12, 13);   // NW rise
  h += 0.85 * gauss2(x, y, 58, 71, 15);  // S rise
  h += 0.95 * gauss2(x, y, 97, 65, 12);  // SE rise
  h += 1.05 * gauss2(x, y, 14, 67, 12);  // SW rise (his dark bottom-left)
  h += 0.80 * gauss2(x, y, 48, 58, 12);  // mid-south infield rise
  h += 0.65 * gauss2(x, y, 3, 44, 10);   // W rise
  // banked sand bowl: a MAJOR earthwork now — tall rim, deep dish, inside
  // the hairpin island; its SE inner face pools shadow (see drawBowlShade)
  const bq = Math.hypot((x - 28) / 9.5, (y - 47) / 8.3);
  h += 1.95 * Math.exp(-bq * bq * 1.1) - 0.80 * Math.exp(-bq * bq * 4.2);
  // corrugated mound under the rib section (x 56..70, axis y 38.2): scaled
  // up into a true earthwork the road climbs over, ribs cut deeper
  const mProfile = Math.exp(-Math.pow((y - 38.2) / 3.5, 2));
  const mTaper = sstep(55.2, 58.6, x) * (1 - sstep(67.8, 71.2, x));
  h += 2.15 * mProfile * mTaper;
  h += 0.27 * Math.sin((x - 56) / 0.85 * Math.PI) * mProfile * mTaper;
  // river channel carved down (banks slope into it)
  const dRiv = Math.abs(y - riverCenterY(x));
  h -= 1.2 * (1 - sstep(4.2, 7.6, dRiv));
  return h;
}
function toRGB(col) {
  if (col[0] === '#') { const n = parseInt(col.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = col.match(/\d+/g); return [+m[0], +m[1], +m[2]];
}
function mixHex(a, b, t) {
  const pa = toRGB(a), pb = toRGB(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function shadeCol(col, f) {
  const [r, g, b] = toRGB(col);
  const cl = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}

// ---------- shared scene fields (built once, used by every look) ----------
// Per surface-grid cell: distance to the centreline, corridor half width,
// signed lateral offset, corner wear (from centreline curvature), heading.
const FIELD = (() => {
  const { gw, gh, cell } = TRACK.surf;
  const n = gw * gh;
  const dist = new Float32Array(n).fill(1e9);
  const halfW = new Float32Array(n).fill(5.5);
  const lat = new Float32Array(n);
  const wear = new Float32Array(n);
  const ang = new Float32Array(n);
  const sIdx = new Int32Array(n);
  const S = TRACK.samples;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    const R = s.w / 2 + 3.4;
    const gx0 = Math.max(0, Math.floor((s.x - R) / cell)), gx1 = Math.min(gw - 1, Math.ceil((s.x + R) / cell));
    const gy0 = Math.max(0, Math.floor((s.y - R) / cell)), gy1 = Math.min(gh - 1, Math.ceil((s.y + R) / cell));
    const nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const cx = (gx + 0.5) * cell, cy = (gy + 0.5) * cell;
        const dx = cx - s.x, dy = cy - s.y;
        const d = Math.hypot(dx, dy);
        const idx = gy * gw + gx;
        if (d < dist[idx]) {
          dist[idx] = d; halfW[idx] = s.w / 2;
          lat[idx] = dx * nx + dy * ny;
          wear[idx] = s.curv; ang[idx] = s.ang; sIdx[idx] = i;
        }
      }
    }
  }
  // smooth the wear field so corner darkening pools naturally (2 box passes)
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(wear);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let sum = 0, cnt = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const x = gx + ox, y = gy + oy;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          sum += src[y * gw + x]; cnt++;
        }
        wear[gy * gw + gx] = sum / cnt;
      }
    }
  }
  // water distance (in cells): two-pass chamfer — drives shallows + sandy banks
  const grid = TRACK.surf.grid;
  const wd = new Float32Array(n).fill(99);
  for (let i = 0; i < n; i++) if (grid[i] === SURF.WATER) wd[i] = 0;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx; if (!wd[i]) continue;
    let m = wd[i];
    if (gx > 0) m = Math.min(m, wd[i - 1] + 1);
    if (gy > 0) m = Math.min(m, wd[i - gw] + 1);
    wd[i] = m;
  }
  for (let gy = gh - 1; gy >= 0; gy--) for (let gx = gw - 1; gx >= 0; gx--) {
    const i = gy * gw + gx; if (!wd[i]) continue;
    let m = wd[i];
    if (gx < gw - 1) m = Math.min(m, wd[i + 1] + 1);
    if (gy < gh - 1) m = Math.min(m, wd[i + gw] + 1);
    wd[i] = m;
  }
  // water depth (cells to nearest non-water), for shallows/deep split
  const wdepth = new Float32Array(n).fill(99);
  for (let i = 0; i < n; i++) if (grid[i] !== SURF.WATER) wdepth[i] = 0;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx; if (!wdepth[i]) continue;
    let m = wdepth[i];
    if (gx > 0) m = Math.min(m, wdepth[i - 1] + 1);
    if (gy > 0) m = Math.min(m, wdepth[i - gw] + 1);
    wdepth[i] = m;
  }
  for (let gy = gh - 1; gy >= 0; gy--) for (let gx = gw - 1; gx >= 0; gx--) {
    const i = gy * gw + gx; if (!wdepth[i]) continue;
    let m = wdepth[i];
    if (gx < gw - 1) m = Math.min(m, wdepth[i + 1] + 1);
    if (gy < gh - 1) m = Math.min(m, wdepth[i + gw] + 1);
    wdepth[i] = m;
  }
  return { dist, halfW, lat, wear, ang, wd, wdepth, sIdx, gw, gh, cell };
})();

// ---------- relief: heightfield graded by the road, hillshaded ----------
// The road's own elevation is the terrain height along the centreline,
// box-smoothed so the course rises gently (it climbs the rib mound, dips to
// the river). Each cell blends from that profile inside the corridor to the
// raw terrain outside it — the difference is the cut/fill bank you see.
// HS is a per-cell brightness factor from a fixed NW sun, relief exaggerated
// the way map hillshading always is (real dune slopes are too gentle to read).
const RELIEF = (() => {
  const { gw, gh, cell } = FIELD;
  const n = gw * gh;
  const S = TRACK.samples;
  const hS = new Float32Array(S.length);
  for (let i = 0; i < S.length; i++) hS[i] = terrainHeight(S[i].x, S[i].y);
  for (let pass = 0; pass < 3; pass++) {
    const src = Float32Array.from(hS);
    for (let i = 0; i < S.length; i++) {
      let sum = 0;
      for (let o = -5; o <= 5; o++) sum += src[(i + o + S.length) % S.length];
      hS[i] = sum / 11;
    }
  }
  const H = new Float32Array(n);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;
      const ht = terrainHeight((gx + 0.5) * cell, (gy + 0.5) * cell);
      const w = sstep(FIELD.halfW[i] - 0.6, FIELD.halfW[i] + 3.6, FIELD.dist[i]);
      H[i] = hS[FIELD.sIdx[i]] * (1 - w) + ht * w;
    }
  }
  // v4: shade HARDER — the reference's swings are carved, not gentle, so the
  // relief gain and the clamp range both open up; shadow faces go genuinely
  // dark, crest faces genuinely bright.
  const SUNX = -0.60, SUNY = -0.46, SUNZ = 0.80, K = 4.3;
  const HS = new Float32Array(n).fill(1);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;
      const xl = H[gy * gw + Math.max(0, gx - 1)], xr = H[gy * gw + Math.min(gw - 1, gx + 1)];
      const yu = H[Math.max(0, gy - 1) * gw + gx], yd = H[Math.min(gh - 1, gy + 1) * gw + gx];
      const ddx = (xr - xl) / (2 * cell), ddy = (yd - yu) / (2 * cell);
      const dot = (-ddx * SUNX - ddy * SUNY) * K + SUNZ;
      HS[i] = Math.max(0.50, Math.min(1.55, 1 + (dot - SUNZ)));
    }
  }
  // normalized height 0..1 over the whole field — drives elevation colour
  let hMin = 1e9, hMax = -1e9;
  for (let i = 0; i < n; i++) { if (H[i] < hMin) hMin = H[i]; if (H[i] > hMax) hMax = H[i]; }
  const HN = new Float32Array(n);
  for (let i = 0; i < n; i++) HN[i] = (H[i] - hMin) / Math.max(0.001, hMax - hMin);
  return { H, HS, HN };
})();

function fieldIdx(x, y) {
  const gx = Math.max(0, Math.min(FIELD.gw - 1, Math.floor(x / FIELD.cell)));
  const gy = Math.max(0, Math.min(FIELD.gh - 1, Math.floor(y / FIELD.cell)));
  return gy * FIELD.gw + gx;
}
// What is the ground at (x,y)? zone 'road' inside the corridor, else 'scrub'.
function groundAt(x, y) {
  const i = fieldIdx(x, y);
  const surf = TRACK.surf.grid[i];
  const d = FIELD.dist[i], hw = FIELD.halfW[i];
  return {
    surf, d, hw, lat: FIELD.lat[i], wear: FIELD.wear[i], ang: FIELD.ang[i],
    zone: surf === SURF.WATER ? 'water' : (d < hw + 0.9 ? 'road' : 'scrub')
  };
}

// Scenery spots shared by all looks: bushes/rocks/tufts + extra tire stacks
// placed just outside the corridor at corners (same world in every look).
const SCENERY = (() => {
  const rng = mulberry32(777);
  const nearWater = (x, y) => TRACK.surfaceAt(x + 1.4, y) === SURF.WATER || TRACK.surfaceAt(x - 1.4, y) === SURF.WATER ||
                               TRACK.surfaceAt(x, y + 1.4) === SURF.WATER || TRACK.surfaceAt(x, y - 1.4) === SURF.WATER;
  const bushes = [], rocks = [], tufts = [];
  let guard = 0;
  while (bushes.length < 26 && guard++ < 900) {
    const x = 2 + rng() * 102, y = 2 + rng() * 70;
    const gr = groundAt(x, y);
    if (gr.zone !== 'scrub' || gr.d < gr.hw + 2.0 || nearWater(x, y)) continue;
    if (gr.surf !== SURF.DIRT && gr.surf !== SURF.GRAVEL) continue;
    bushes.push({ x, y, r: 0.55 + rng() * 0.6, seed: rng() * 100 });
  }
  guard = 0;
  while (rocks.length < 15 && guard++ < 900) {
    const x = 2 + rng() * 102, y = 2 + rng() * 70;
    const gr = groundAt(x, y);
    if (gr.zone !== 'scrub' || gr.d < gr.hw + 1.7 || nearWater(x, y)) continue;
    rocks.push({ x, y, r: 0.6 + rng() * 0.8, seed: rng() * 100 });
  }
  guard = 0;
  while (tufts.length < 110 && guard++ < 3000) {
    const x = 1 + rng() * 104, y = 1 + rng() * 72;
    const gr = groundAt(x, y);
    if (gr.zone !== 'scrub' || nearWater(x, y)) continue;
    tufts.push({ x, y, seed: rng() * 100 });
  }
  // scenery stacks: outside of four corners, pushed out along the normal
  const S = TRACK.samples;
  const stacks = [];
  for (const target of [[91, 22], [12, 27], [37, 46], [93, 52]]) {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < S.length; i++) { const d = Math.hypot(S[i].x - target[0], S[i].y - target[1]); if (d < bd) { bd = d; bi = i; } }
    const s = S[bi], nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
    let best = null;
    for (const sgn of [1, -1]) {
      const px = s.x + nx * sgn * (s.w / 2 + 1.8), py = s.y + ny * sgn * (s.w / 2 + 1.8);
      let md = 1e9;
      for (let i = 0; i < S.length; i++) {
        if (Math.abs(i - bi) < 24 || Math.abs(i - bi) > S.length - 24) continue;
        md = Math.min(md, Math.hypot(S[i].x - px, S[i].y - py));
      }
      if (!best || md > best.md) best = { x: px, y: py, md };
    }
    if (best && best.x > 2 && best.x < 104 && best.y > 2 && best.y < 72) stacks.push({ x: best.x, y: best.y });
  }
  return { bushes, rocks, tufts, stacks };
})();

// ---------- low-res surface layer (A/C base, B's smoothed underlay) ----------
// 1 px per grid cell. This is where the ROAD lives: pale worn dirt with twin
// wheel bands + corner wear inside the corridor; textured scrub outside it;
// banked river with shallows; patch edges broken up with dirt speckle.
const BAYER = [0, 2, 3, 1];
function surfaceLayer(look) {
  const pal = PALETTES[look];
  const { grid, gw, gh } = TRACK.surf;
  const c = mkCanvas(gw, gh), g = c.getContext('2d');
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;
      const s = grid[i];
      const h = hash2(gx, gy);
      const h2 = hash2(gx * 3 + 7, gy * 3 + 1);
      const ln = 0.5 + 0.30 * Math.sin(gx * 0.052 + 1.3) * Math.sin(gy * 0.068 + 4.1)
                   + 0.20 * Math.sin(gx * 0.13 + 5.2) * Math.sin(gy * 0.11 + 0.6); // 0..1 terrain tone
      const d = FIELD.dist[i], hw = FIELD.halfW[i];
      const wearN = clamp01(FIELD.wear[i] * 2.4);
      let col;
      if (s === SURF.WATER) {
        const dep = FIELD.wdepth[i] + (h2 - 0.5) * 1.1; // jittered depth breaks the bank line
        const shoreT = look === 'B' ? 0.6 : 1.1, deepT = look === 'B' ? 2.8 : 4.2; // B's blur spreads pale shore — keep its river blue
        if (dep < shoreT) col = pal.shore;
        else if (dep > deepT) col = pal.water[1];
        else if (look === 'A') col = pal.water[(BAYER[(gx & 1) + (gy & 1) * 2] + (h < 0.5 ? 0 : 1)) % 2 === 0 ? 0 : 1];
        else col = pal.water[h < 0.6 ? 0 : 1];
        if (dep >= shoreT) {
          // deep channel: the middle of the river runs darker than the edges
          const depF = clamp01((dep - 0.6) / 4.6);
          col = mixHex(col, shadeCol(pal.water[1], 0.64), depF * 0.65);
          // current streaks: noise stretched along the flow (x) direction
          const streak = vnoise(gx * 0.10 + 4.4, gy * 0.62 + 1.9);
          col = shadeCol(col, 1 + (streak - 0.5) * 0.17);
          // v4 SPARKLE: his water glitters — fine light flecks scattered
          // across the whole surface plus brighter flow-stretched glints,
          // so the river has internal life, not just edge foam
          const glint = vnoise(gx * 0.33 + 9.1, gy * 1.35 + 3.3);
          if (glint > 0.76) col = mixHex(col, pal.shore, Math.min(0.55, (glint - 0.76) * 1.6));
          const sp = hash2(gx * 5 + 91, gy * 5 + 47);
          if (sp > (look === 'B' ? 0.935 : 0.905)) col = mixHex(col, '#e8f6ff', look === 'B' ? 0.45 : 0.60);
        } else {
          // v4: the waterline itself goes near-white — a bright shallow lip
          col = mixHex(col, '#eaf7ff', (1 - dep / shoreT) * 0.45);
        }
      } else if (d < hw + 1.3) {
        // ----- ROAD corridor (surface flavour still shows through) -----
        const edgeJitter = (h2 - 0.5) * 0.8;
        const t = clamp01((d + edgeJitter) / hw); // 0 centre -> 1 edge
        let base = pal.road[ln > 0.66 ? 2 : ln > 0.36 ? 0 : 1];
        if (s === SURF.SAND) base = pal.sand[0];
        else if (s === SURF.MUD) base = mixHex(pal.road[1], pal.mud[0], 0.45);
        else if (s === SURF.GRAVEL) base = mixHex(pal.road[1], pal.gravel[0], 0.4);
        // worn centre + twin wheel bands: a brightness multiplier, so dark
        // flavour surfaces (mud, gravel) keep their hue instead of crushing
        const centre = Math.pow(1 - t, 1.6) * (0.26 + 0.48 * wearN);
        const band = Math.exp(-Math.pow((Math.abs(FIELD.lat[i]) - 0.95) / 0.42, 2)) * (0.13 + 0.30 * wearN);
        let dk = Math.min(0.72, centre + band);
        if (h < 0.10) dk += 0.08; // grit speckle
        col = dk > 0.02 ? shadeCol(base, 1 - dk * 0.40) : base;
        // dusty shoulder blend into scrub at the very edge
        if (d > hw) {
          const f = clamp01((d - hw) / 1.3);
          const scrub = pal.dirt[ln > 0.62 ? 2 : ln > 0.38 ? 0 : 1];
          col = mixHex(f < 0.5 ? pal.shoulder : col, scrub, f * f);
          if (h < f * 0.5) col = scrub;
        }
      } else {
        // ----- off-track scrub / features -----
        // sandy bank rim hugging the river
        const bank = FIELD.wd[i] + (h2 - 0.5) * 1.3;
        if (s === SURF.DIRT && bank < 2.6) {
          col = mixHex(pal.sand[1], pal.dirt[0], clamp01((bank - 0.4) / 2.2));
        } else if (s === SURF.DIRT || s === SURF.RIBS) {
          if (look === 'A') {
            const v = ln * 2.6 + (h - 0.5) * 0.35 + BAYER[(gx & 1) + (gy & 1) * 2] * 0.28;
            col = pal.dirt[Math.max(0, Math.min(3, Math.floor(v)))];
          } else {
            col = pal.dirt[ln > 0.68 ? 2 : ln > 0.42 ? 0 : ln > 0.2 ? 1 : 3];
            if (h < 0.16) col = pal.dirt[1];
          }
          if (h < 0.045) col = pal.dirt[3]; // scrub shadow speckle
        } else if (s === SURF.GRAVEL) {
          col = h < 0.42 ? pal.dirt[1] : pal.gravel[Math.floor(h * pal.gravel.length) % pal.gravel.length];
        } else if (s === SURF.MUD) {
          col = h < 0.2 ? pal.mud[2] : pal.mud[Math.floor(h * 2) % 2];
          if (h > 0.93) col = pal.mud[1]; // wet sheen flecks
        } else {
          const arr = pal[SURF_KEYS[s]];
          col = arr[Math.floor(h * arr.length)];
        }
        // break hard patch outlines with dirt speckle at borders
        if (s === SURF.SAND || s === SURF.MUD || s === SURF.ROCK) {
          const nb = [grid[i - 1], grid[i + 1], grid[i - gw], grid[i + gw]];
          if (nb.some(v => v !== s) && h < 0.30) col = pal.dirt[1];
        }
      }
      if (s !== SURF.WATER) {
        // v4 ELEVATION COLOUR: height reads in colour as well as shading —
        // lows fall toward dark red-brown, crests toward pale straw. Open
        // ground takes it full; the graded road takes only a whisper, so
        // the course still reads as one surface climbing the landforms.
        const hn = RELIEF.HN[i];
        const tintW = d < hw + 1.3 ? 0.30 : 1;
        if (hn < 0.34) col = mixHex(col, '#47220e', (0.34 - hn) * 1.15 * tintW);
        else if (hn > 0.70 && s !== SURF.MUD) col = mixHex(col, '#ecd49e', (hn - 0.70) * 1.30 * tintW);
        // his high ground in the NE is churned MUD — dark at every height.
        // Exempt from the pale-crest tint (above) and shaded down as scrub.
        if (s === SURF.MUD && d >= hw + 1.3) col = shadeCol(col, 0.86);
        // hillshade: graded roads take it weakly, open terrain takes it full;
        // sand keeps it almost anywhere (the bowl's banking IS its shading)
        let wgt = d < hw ? 0.30 : d < hw + 1.3 ? 0.30 + 0.70 * ((d - hw) / 1.3) : 1;
        if (s === SURF.SAND) wgt = Math.max(wgt, 0.85);
        if (s === SURF.RIBS) wgt = Math.max(wgt, 0.55);
        // B's smoothed upscale blurs the relief back out — push its shade
        // swing wider so the landforms survive the painted medium
        let f = 1 + (RELIEF.HS[i] - 1) * wgt * (look === 'B' ? 1.35 : 1);
        // scrub sits a touch darker than v2 so the road pops against it
        if (d >= hw + 1.3 && (s === SURF.DIRT || s === SURF.RIBS)) f *= 0.93;
        if (f !== 1) col = shadeCol(col, f);
      }
      g.fillStyle = col; g.fillRect(gx, gy, 1, 1);
    }
  }
  return c;
}

// ---------- baked ground detail (shared scene, per-look medium) ----------
function duneShade(g, W, H) {
  // v3: real hillshading does the heavy lifting now — these are just a whisper
  // of warm/cool variety over the top, at roughly half their v2 strength.
  const blobs = [
    [0.28, 0.25, 0.62, 'rgba(255,230,180,0.045)'], [0.68, 0.10, 0.5, 'rgba(255,230,180,0.03)'],
    [0.86, 0.82, 0.6, 'rgba(40,18,4,0.055)'], [0.08, 0.92, 0.5, 'rgba(40,18,4,0.045)'],
    [0.55, 0.55, 0.75, 'rgba(60,28,6,0.03)']
  ];
  for (const [fx, fy, fr, col] of blobs) {
    const gr = g.createRadialGradient(W * fx, H * fy, 4, W * fx, H * fy, H * fr);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
}

// Banked-bowl shading washes over the hairpin sand island: a shadow pool on
// the SE inner side and a light wash on the NW rim. The heightfield's own
// hillshade does the per-cell work; these broad washes sell the banking at
// whole-track scale in every look.
function drawBowlShade(g, ppm) {
  // v4: the bowl is a major earthwork now — the washes deepen with it
  let gr = g.createRadialGradient(31.5 * ppm, 50 * ppm, 1, 31.5 * ppm, 50 * ppm, 9.6 * ppm);
  gr.addColorStop(0, 'rgba(46,24,8,0.27)'); gr.addColorStop(1, 'rgba(46,24,8,0)');
  g.fillStyle = gr; g.fillRect(19 * ppm, 38 * ppm, 21 * ppm, 19 * ppm);
  gr = g.createRadialGradient(24.5 * ppm, 43.5 * ppm, 1, 24.5 * ppm, 43.5 * ppm, 8.4 * ppm);
  gr.addColorStop(0, 'rgba(255,238,196,0.21)'); gr.addColorStop(1, 'rgba(255,238,196,0)');
  g.fillStyle = gr; g.fillRect(15 * ppm, 35 * ppm, 21 * ppm, 19 * ppm);
  // deep dish: the dished centre sits in its own soft shadow
  gr = g.createRadialGradient(28 * ppm, 47.5 * ppm, 0.5, 28 * ppm, 47.5 * ppm, 4.6 * ppm);
  gr.addColorStop(0, 'rgba(46,24,8,0.13)'); gr.addColorStop(1, 'rgba(46,24,8,0)');
  g.fillStyle = gr; g.fillRect(22 * ppm, 41 * ppm, 13 * ppm, 13 * ppm);
}

// Static wear: twin wheel lines that darken where the corner bites (curvature),
// plus sand-bowl arcs in the hairpin. The dynamic track layer adds live marks.
function drawWearArcs(g, ppm, look) {
  const S = TRACK.samples;
  const dark = look === 'B' ? '74,44,20' : '43,26,12';
  for (const pass of [{ alpha: 0.045, wMul: 1, thresh: 0 }, { alpha: 0.15, wMul: 1, thresh: 0.05 }]) {
    for (const off of [-0.95, 0.95]) {
      g.lineCap = 'round';
      for (let i = 0; i < S.length; i += 2) {
        const a = S[i], b = S[(i + 2) % S.length];
        if (TRACK.surfaceAt((a.x + b.x) / 2, (a.y + b.y) / 2) === SURF.WATER) continue; // no baked lines on water
        const wN = clamp01(a.curv * 2.4);
        if (wN < pass.thresh) continue;
        const alpha = pass.alpha * (pass.thresh ? wN : 0.8);
        if (alpha < 0.01) continue;
        const anx = -Math.sin(a.ang), anyy = Math.cos(a.ang);
        const bnx = -Math.sin(b.ang), bny = Math.cos(b.ang);
        g.strokeStyle = `rgba(${dark},${alpha.toFixed(3)})`;
        g.lineWidth = 0.55 * ppm * pass.wMul;
        g.beginPath();
        g.moveTo((a.x + anx * off) * ppm, (a.y + anyy * off) * ppm);
        g.lineTo((b.x + bnx * off) * ppm, (b.y + bny * off) * ppm);
        g.stroke();
      }
    }
  }
  // carved arcs across the hairpin sand bowl
  g.strokeStyle = look === 'B' ? 'rgba(120,84,40,0.20)' : 'rgba(90,58,24,0.20)';
  for (const [cx, cy, r, a0, a1] of [[30, 45.5, 3.2, 2.6, 5.6], [30, 45.5, 4.6, 2.7, 5.5], [30, 45.5, 6.0, 2.8, 5.4], [29, 46, 7.4, 2.9, 5.2]]) {
    g.lineWidth = 0.4 * ppm;
    g.beginPath(); g.arc(cx * ppm, cy * ppm, r * ppm, a0, a1); g.stroke();
  }
}

// Corrugated rib section: a raised MOUND the road climbs — it throws a soft
// cast shadow to the SE, its north face catches the sun, its south face sits
// in shade, and the ridge stripes fade in/out at the ramps instead of
// starting abruptly. The heightfield gives the broad profile; this pass
// adds the crisp corrugation on top.
function drawRibs(g, ppm, look) {
  const { grid, gw, gh, cell } = TRACK.surf;
  // cast shadow (sun from NW -> shadow falls SE of the mound); v4: the
  // mound is taller, so the shadow it throws is longer and deeper
  g.fillStyle = 'rgba(24,12,4,0.17)';
  g.beginPath(); g.ellipse(65.2 * ppm, 41.3 * ppm, 10.4 * ppm, 5.0 * ppm, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(24,12,4,0.30)';
  g.beginPath(); g.ellipse(64.8 * ppm, 40.5 * ppm, 8.6 * ppm, 3.7 * ppm, 0, 0, 7); g.fill();
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (grid[gy * gw + gx] !== SURF.RIBS) continue;
      const x = gx * cell, y = gy * cell;
      const xc = x + cell / 2, yc = y + cell / 2;
      const env = sstep(56, 58.6, xc) * (1 - sstep(67.6, 70.2, xc)); // ramp envelope
      const ph = Math.floor(x / 0.85) % 2;
      g.fillStyle = ph ? `rgba(255,240,200,${(0.07 + 0.24 * env).toFixed(3)})` : `rgba(30,16,6,${(0.09 + 0.30 * env).toFixed(3)})`;
      g.fillRect(x * ppm, y * ppm, cell * ppm + 0.6, cell * ppm + 0.6);
      // mound cross-shading: lit north face, shaded south face
      if (yc < 37.3) { g.fillStyle = 'rgba(255,240,200,0.10)'; g.fillRect(x * ppm, y * ppm, cell * ppm + 0.6, cell * ppm + 0.6); }
      if (yc > 39.7) { g.fillStyle = 'rgba(30,16,6,0.13)'; g.fillRect(x * ppm, y * ppm, cell * ppm + 0.6, cell * ppm + 0.6); }
      if (x < 57.6 || x > 68.4) { g.fillStyle = 'rgba(20,10,4,0.10)'; g.fillRect(x * ppm, y * ppm, cell * ppm + 0.6, cell * ppm + 0.6); }
    }
  }
  if (look === 'B') { // painted ridge highlights
    g.strokeStyle = 'rgba(255,244,214,0.20)'; g.lineWidth = Math.max(1.4, ppm * 0.09);
    for (let x = 56.4; x < 70; x += 0.85) {
      g.beginPath(); g.moveTo(x * ppm, 35.6 * ppm); g.lineTo(x * ppm, 40.8 * ppm); g.stroke();
    }
  }
}

// Scenery: rocks, bushes, scrub tufts, extra tire stacks, start gantry + grid.
function drawScenery(g, ppm, look, pal) {
  const rng = mulberry32(look === 'A' ? 41 : look === 'C' ? 42 : 43);
  // tufts: tiny dark scrub marks
  for (const t of SCENERY.tufts) {
    const x = t.x * ppm, y = t.y * ppm;
    if (look === 'B') {
      g.strokeStyle = 'rgba(84,58,26,0.55)'; g.lineWidth = Math.max(1.2, ppm * 0.09); g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a = -0.5 + k * 0.5 + (hash2(t.seed, k) - 0.5) * 0.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 0.5 * ppm, y - Math.cos(a) * 0.5 * ppm); g.stroke();
      }
    } else {
      g.fillStyle = 'rgba(52,36,16,0.65)';
      const sz = Math.max(1.6, ppm * 0.16);
      g.fillRect(x, y, sz, sz); g.fillRect(x + sz * 1.4, y - sz * 0.6, sz, sz); g.fillRect(x - sz * 1.2, y - sz * 0.3, sz, sz);
    }
  }
  // bushes: dark scrub mounds with a lit top
  for (const b of SCENERY.bushes) {
    const x = b.x * ppm, y = b.y * ppm, r = b.r * ppm;
    g.fillStyle = 'rgba(20,12,4,0.30)';
    g.beginPath(); g.ellipse(x, y + r * 0.42, r * 1.05, r * 0.5, 0, 0, 7); g.fill();
    if (look === 'B') {
      g.fillStyle = '#5d4520';
      g.beginPath(); g.ellipse(x, y, r, r * 0.78, 0, 0, 7); g.fill();
      g.fillStyle = '#77592a';
      g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.28, r * 0.55, r * 0.36, -0.4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(58,35,24,0.5)'; g.lineWidth = Math.max(1.2, ppm * 0.1);
      g.beginPath(); g.ellipse(x, y, r, r * 0.78, 0, 0, 7); g.stroke();
    } else {
      g.fillStyle = look === 'A' ? '#54401c' : '#4c3c20';
      g.beginPath(); g.ellipse(x, y, r, r * 0.76, 0, 0, 7); g.fill();
      g.fillStyle = look === 'A' ? '#6e5626' : '#635026';
      g.beginPath(); g.ellipse(x - r * 0.22, y - r * 0.26, r * 0.52, r * 0.34, -0.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(30,20,8,0.8)';
      const sz = Math.max(1.4, ppm * 0.13);
      for (let k = 0; k < 4; k++) g.fillRect(x + (hash2(b.seed, k) - 0.5) * r * 1.4, y + (hash2(k, b.seed) - 0.5) * r, sz, sz);
    }
  }
  // rocks: grey forms, lit top-left, shadowed base
  for (const rk of SCENERY.rocks) {
    const x = rk.x * ppm, y = rk.y * ppm, r = rk.r * ppm;
    g.fillStyle = 'rgba(20,12,4,0.28)';
    g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.4, r * 1.05, r * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = pal.rock[1];
    g.beginPath();
    const pts = 6;
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2 + rk.seed;
      const rr = r * (0.75 + hash2(rk.seed, k) * 0.4);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.72;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
    g.fillStyle = pal.rock[0];
    g.beginPath(); g.ellipse(x - r * 0.24, y - r * 0.24, r * 0.5, r * 0.3, -0.5, 0, 7); g.fill();
    if (look === 'B') {
      g.strokeStyle = 'rgba(58,35,24,0.45)'; g.lineWidth = Math.max(1.2, ppm * 0.1);
      g.beginPath(); g.ellipse(x - r * 0.24, y - r * 0.24, r * 0.5, r * 0.3, -0.5, 0, 7); g.stroke();
    }
  }
  // scenery tire stacks at corners (the breakable ones are dynamic props)
  for (const s of SCENERY.stacks) drawStack(g, s, ppm, look);
  drawGantry(g, ppm, look, pal);
}

function drawGantry(g, ppm, look, pal) {
  const p = TRACK.samples[0];
  const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
  const fx = Math.cos(p.ang), fy = Math.sin(p.ang);
  const off = p.w / 2 + 0.4;
  const P = (latOff, sOff) => [(p.x + nx * latOff + fx * sOff) * ppm, (p.y + ny * latOff + fy * sOff) * ppm];
  // banner shadow, then the banner band across the road
  const [ax, ay] = P(-off, 0.35), [bx, by] = P(off, 0.35);
  g.strokeStyle = 'rgba(20,10,4,0.35)'; g.lineWidth = 1.0 * ppm; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  const [cx, cy] = P(-off, 0), [dx, dy] = P(off, 0);
  g.strokeStyle = pal.tapeWhite; g.lineWidth = 1.0 * ppm;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(dx, dy); g.stroke();
  g.strokeStyle = pal.tapeRed; g.lineWidth = 1.0 * ppm;
  const segs = 9;
  for (let i = 0; i < segs; i += 2) {
    g.beginPath();
    g.moveTo(cx + (dx - cx) * (i / segs), cy + (dy - cy) * (i / segs));
    g.lineTo(cx + (dx - cx) * ((i + 1) / segs), cy + (dy - cy) * ((i + 1) / segs));
    g.stroke();
  }
  // posts
  for (const sgn of [-1, 1]) {
    const [px, py] = P(sgn * off, 0);
    g.fillStyle = 'rgba(20,10,4,0.35)';
    g.fillRect(px - 0.32 * ppm + 2, py - 0.32 * ppm + 3, 0.64 * ppm, 0.64 * ppm);
    g.fillStyle = look === 'B' ? '#4a3826' : '#2c2622';
    g.fillRect(px - 0.32 * ppm, py - 0.32 * ppm, 0.64 * ppm, 0.64 * ppm);
    g.fillStyle = pal.tapeRed;
    g.fillRect(px - 0.32 * ppm, py - 0.32 * ppm, 0.64 * ppm, 0.2 * ppm);
  }
  // start grid slots behind the line (travel heads -x, so slots sit at +s)
  g.strokeStyle = look === 'B' ? 'rgba(243,230,200,0.35)' : 'rgba(240,234,216,0.30)';
  g.lineWidth = Math.max(1.2, ppm * 0.14);
  for (const [latOff, s0] of [[-2.9, 1.6], [2.9, 4.4], [-2.9, 7.2], [2.9, 10.0]]) {
    const c1 = P(latOff - 1.9, s0), c2 = P(latOff + 1.9, s0), c3 = P(latOff + 1.9, s0 + 4.6), c4 = P(latOff - 1.9, s0 + 4.6);
    g.beginPath(); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c3[0], c3[1]); g.lineTo(c4[0], c4[1]); g.closePath(); g.stroke();
  }
}

// Offset polylines for the tape barriers.
function tapeLines() {
  const S = TRACK.samples, left = [], right = [];
  for (let i = 0; i < S.length; i += 3) {
    const p = S[i], nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    const off = p.w / 2 + 0.4;
    left.push([p.x + nx * off, p.y + ny * off]);
    right.push([p.x - nx * off, p.y - ny * off]);
  }
  return { left, right };
}
function drawTape(g, ppm, pal, painted, crispShadow) {
  const { left, right } = tapeLines();
  for (const line of [left, right]) {
    const n = line.length;
    for (let i = 0; i < n; i++) {
      const a = line[i], b = line[(i + 1) % n];
      if (painted) {
        g.strokeStyle = 'rgba(58,35,24,0.45)'; g.lineWidth = 0.62 * ppm; g.lineCap = 'round';
        g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm + 0.22 * ppm); g.lineTo(b[0] * ppm, b[1] * ppm + 0.22 * ppm); g.stroke();
      } else if (crispShadow) {
        g.strokeStyle = 'rgba(16,10,5,0.42)'; g.lineWidth = 0.62 * ppm; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm + 0.15 * ppm); g.lineTo(b[0] * ppm, b[1] * ppm + 0.15 * ppm); g.stroke();
      }
      g.strokeStyle = i % 2 ? pal.tapeWhite : pal.tapeRed;
      g.lineWidth = (painted ? 0.5 : 0.58) * ppm; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm); g.lineTo(b[0] * ppm, b[1] * ppm); g.stroke();
    }
  }
}
function drawStartLine(g, ppm, pal) {
  const p = TRACK.samples[0];
  const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
  const cols = 8, rows = 2, w = p.w;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const t0 = -w / 2 + (i / cols) * w, t1 = -w / 2 + ((i + 1) / cols) * w;
      const s0 = (j / rows) * 1.6 - 0.8, s1 = ((j + 1) / rows) * 1.6 - 0.8;
      const f = Math.cos(p.ang), s = Math.sin(p.ang);
      g.fillStyle = (i + j) % 2 ? '#181410' : '#f0ead8';
      g.beginPath();
      const corners = [[t0, s0], [t1, s0], [t1, s1], [t0, s1]];
      corners.forEach(([tt, ss], k) => {
        const X = (p.x + nx * tt + f * ss) * ppm, Y = (p.y + ny * tt + s * ss) * ppm;
        k ? g.lineTo(X, Y) : g.moveTo(X, Y);
      });
      g.closePath(); g.fill();
    }
  }
}

// Look B only: paint the road as layered strokes along the centreline so the
// painted world has a road body, not just an underlay tint.
function paintRoadB(g, ppm, pal) {
  const S = TRACK.samples;
  g.lineCap = 'round';
  const passes = [
    { extra: 1.7, col: pal.shoulder, alpha: 0.36, wMul: 1 },
    { extra: 0, col: pal.road[1], alpha: 0.80, wMul: 1 },
    { extra: 0, col: pal.roadDark, alpha: 0.16, wMul: 0.55 }
  ];
  for (const ps of passes) {
    g.globalAlpha = ps.alpha; g.strokeStyle = ps.col;
    for (let i = 0; i < S.length; i += 2) {
      const a = S[i], b = S[(i + 2) % S.length];
      if (TRACK.surfaceAt((a.x + b.x) / 2, (a.y + b.y) / 2) === SURF.WATER) continue; // the river stays water — no road paint over the crossing
      g.lineWidth = (a.w * ps.wMul + ps.extra) * ppm;
      g.beginPath(); g.moveTo(a.x * ppm, a.y * ppm); g.lineTo(b.x * ppm, b.y * ppm); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

function buildBackground(look) {
  const conf = LOOK_CONF[look], ppm = conf.ppm;
  const W = Math.round(WORLD.w * ppm), H = Math.round(WORLD.h * ppm);
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const pal = PALETTES[look];
  const layer = surfaceLayer(look);
  g.imageSmoothingEnabled = look === 'B';
  g.drawImage(layer, 0, 0, W, H);
  duneShade(g, W, H);
  drawBowlShade(g, ppm);
  const rng = mulberry32(look === 'A' ? 11 : look === 'C' ? 22 : 33);
  if (look === 'B') {
    paintRoadB(g, ppm, pal);
    // ---- painterly pass: blotches + strokes, coloured by the ground class ----
    for (let i = 0; i < 300; i++) { // large soft patches of warm/cool variation
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      const gr = groundAt(x, y);
      if (gr.zone === 'water') continue;
      const base = gr.zone === 'road' ? pal.road[0] : PALETTES.B[SURF_KEYS[gr.surf]][0];
      g.fillStyle = shade(base, rng() < 0.5 ? 0.88 + rng() * 0.06 : 1.08 + rng() * 0.1);
      g.globalAlpha = 0.05 + rng() * 0.06;
      g.beginPath();
      g.ellipse(x * ppm, y * ppm, (10 + rng() * 30) * (ppm / 12), (7 + rng() * 20) * (ppm / 12), rng() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 6200; i++) {
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      const gr = groundAt(x, y);
      const isWater = gr.zone === 'water';
      const base = gr.zone === 'road' ? pal.road[0] : PALETTES.B[SURF_KEYS[gr.surf]][0];
      const ang = isWater ? (rng() - 0.5) * 0.3 : gr.zone === 'road' ? gr.ang + (rng() - 0.5) * 0.5 : rng() * Math.PI;
      const len = (isWater ? 16 : 10) + rng() * 20;
      g.strokeStyle = isWater && rng() < 0.3 ? '#bcd9f5' : shade(base, 0.88 + rng() * 0.3);
      g.globalAlpha = (isWater ? 0.10 : 0.06) + rng() * 0.10;
      g.lineWidth = 2.4 + rng() * 3.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x * ppm, y * ppm);
      g.lineTo(x * ppm + Math.cos(ang) * len, y * ppm + Math.sin(ang) * len); g.stroke();
    }
    g.globalAlpha = 1;
    // shore foam strokes
    g.strokeStyle = '#eaf6ff';
    for (let i = 0; i < 260; i++) {
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      if (TRACK.surfaceAt(x, y) !== SURF.WATER) continue;
      if (TRACK.surfaceAt(x + 1.2, y) === SURF.WATER && TRACK.surfaceAt(x - 1.2, y) === SURF.WATER &&
          TRACK.surfaceAt(x, y + 1.2) === SURF.WATER && TRACK.surfaceAt(x, y - 1.2) === SURF.WATER) continue;
      g.globalAlpha = 0.25 + rng() * 0.3; g.lineWidth = 1.6 + rng() * 1.6;
      g.beginPath(); g.moveTo(x * ppm, y * ppm); g.lineTo(x * ppm + 5 + rng() * 8, y * ppm + (rng() - 0.5) * 3); g.stroke();
    }
    // foam churn where the road fords the river (the crossing)
    for (let i = 0; i < 150; i++) {
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      if (TRACK.surfaceAt(x, y) !== SURF.WATER) continue;
      const gr = groundAt(x, y);
      if (gr.d > gr.hw + 2.2) continue;
      g.globalAlpha = 0.22 + rng() * 0.3; g.lineWidth = 1.5 + rng() * 1.8;
      g.beginPath(); g.moveTo(x * ppm, y * ppm); g.lineTo(x * ppm + 4 + rng() * 9, y * ppm + (rng() - 0.5) * 3); g.stroke();
    }
    g.globalAlpha = 1;
    drawWearArcs(g, ppm, look);
    drawRibs(g, ppm, look);
    drawScenery(g, ppm, look, pal);
    drawTape(g, ppm, pal, true);
    drawStartLine(g, ppm, pal);
    // warm sun wash + vignette
    const wash = g.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, 'rgba(255,196,96,0.10)'); wash.addColorStop(1, 'rgba(120,52,16,0.10)');
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(46,22,8,0.28)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  } else {
    // ---- pixel pass: wear, ribs, scenery, speckle, water sparkle ----
    drawWearArcs(g, ppm, look);
    drawRibs(g, ppm, look);
    drawScenery(g, ppm, look, pal);
    const dots = look === 'A' ? 1500 : 2400;
    for (let i = 0; i < dots; i++) {
      const x = rng() * W, y = rng() * H;
      const s = TRACK.surfaceAt(x / ppm, y / ppm);
      if (s === SURF.WATER) {
        // foam flecks gather where the road fords the river
        const fi = fieldIdx(x / ppm, y / ppm);
        const nearRoad = FIELD.dist[fi] < FIELD.halfW[fi] + 2.5;
        if (rng() < (nearRoad ? 0.8 : 0.4)) { g.fillStyle = 'rgba(220,240,255,0.5)'; g.fillRect(x, y, ppm * (nearRoad ? 0.45 : 0.32), 1.4); }
      } else {
        g.fillStyle = rng() < 0.5 ? 'rgba(30,18,8,0.20)' : 'rgba(255,240,210,0.13)';
        const sz = look === 'A' ? 2 : 2.6;
        g.fillRect(x, y, sz, sz);
      }
    }
    drawTape(g, ppm, pal, false, true);
    drawStartLine(g, ppm, pal);
    if (look === 'C') { // cool grade + grain + vignette: reads as its own world, not A's twin
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        g.fillRect(rng() * W, rng() * H, 1.6, 1.6);
      }
      g.fillStyle = 'rgba(28,44,104,0.07)'; g.fillRect(0, 0, W, H);
    }
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.98);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, look === 'A' ? 'rgba(10,6,2,0.20)' : 'rgba(8,10,26,0.16)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  return c;
}

// ---------- dynamic props ----------
function drawPickup(g, p, active, t, ppm, look) {
  const x = p.x * ppm, y = p.y * ppm;
  const bob = Math.sin(t * 3 + p.x) * 0.14 * ppm;
  g.save(); g.translate(x, y + bob);
  if (!active) {
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = Math.max(1.4, ppm * 0.14);
    g.beginPath(); g.arc(0, 0, 0.85 * ppm, 0, 7); g.stroke();
    g.restore(); return;
  }
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.beginPath(); g.ellipse(0, 0.5 * ppm - bob, 0.8 * ppm, 0.3 * ppm, 0, 0, 7); g.fill();
  if (p.type === 'nitro') {
    g.fillStyle = look === 'B' ? '#e06426' : '#d8481c';
    const w = 0.62 * ppm, h = 1.05 * ppm;
    g.beginPath();
    if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, ppm * 0.16); else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.fillStyle = '#f5f0e2'; g.fillRect(-w * 0.18, -h * 0.30, w * 0.36, h * 0.6);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.moveTo(0.06 * ppm, -0.28 * ppm); g.lineTo(-0.14 * ppm, 0.06 * ppm); g.lineTo(-0.01 * ppm, 0.06 * ppm); g.lineTo(-0.06 * ppm, 0.30 * ppm); g.lineTo(0.14 * ppm, -0.04 * ppm); g.lineTo(0.01 * ppm, -0.04 * ppm); g.closePath(); g.fill();
  } else {
    g.fillStyle = look === 'B' ? '#f2ead8' : '#e8e4da';
    const w = 0.95 * ppm, h = 0.8 * ppm;
    g.beginPath();
    if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, ppm * 0.12); else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.fillStyle = '#c22e20';
    g.fillRect(-0.11 * ppm, -0.26 * ppm, 0.22 * ppm, 0.52 * ppm);
    g.fillRect(-0.26 * ppm, -0.11 * ppm, 0.52 * ppm, 0.22 * ppm);
  }
  g.restore();
}
function drawStack(g, s, ppm, look) {
  const x = s.x * ppm, y = s.y * ppm;
  for (let i = 0; i < 3; i++) {
    const ox = (i % 2) * 0.22 * ppm - 0.1 * ppm, oy = -i * 0.30 * ppm;
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(x + ox, y + oy + 0.34 * ppm, 0.78 * ppm, 0.30 * ppm, 0, 0, 7); g.fill();
    g.fillStyle = look === 'B' ? '#33281f' : '#1d1d21';
    g.beginPath(); g.ellipse(x + ox, y + oy, 0.78 * ppm, 0.42 * ppm, 0, 0, 7); g.fill();
    g.fillStyle = look === 'B' ? '#57493a' : '#3c3f45';
    g.beginPath(); g.ellipse(x + ox, y + oy - 0.07 * ppm, 0.44 * ppm, 0.22 * ppm, 0, 0, 7); g.fill();
  }
}
function drawTireDebris(g, d, ppm, look) {
  const x = d.x * ppm, y = d.y * ppm;
  g.save(); g.translate(x, y); g.rotate(d.rot);
  g.globalAlpha = Math.min(1, d.life / 1.5);
  g.fillStyle = look === 'B' ? '#33281f' : '#1d1d21';
  g.beginPath(); g.ellipse(0, 0, 0.62 * ppm, 0.36 * ppm, 0, 0, 7); g.fill();
  g.fillStyle = look === 'B' ? '#57493a' : '#3c3f45';
  g.beginPath(); g.ellipse(0, 0, 0.32 * ppm, 0.17 * ppm, 0, 0, 7); g.fill();
  g.restore(); g.globalAlpha = 1;
}

// ---------- scene composition ----------
class Renderer {
  constructor() {
    this.backgrounds = {};
    this.buffers = {};
    this.sprites = {};
    this.trackLayer = mkCanvas(848, 592); // 8 px/m persistent tire-track layer
    this.trackCtx = this.trackLayer.getContext('2d');
  }
  ensure(look) {
    if (!this.backgrounds[look]) {
      this.backgrounds[look] = buildBackground(look);
      const conf = LOOK_CONF[look];
      this.buffers[look] = mkCanvas(Math.round(WORLD.w * conf.ppm), Math.round(WORLD.h * conf.ppm));
      this.sprites[look] = look === 'A' ? buildSpritesA() : look === 'C' ? buildSpritesC() : buildSpritesB();
    }
  }
  stampTracks(x, y, ang, strength, dark) {
    const g = this.trackCtx, ppm = 8;
    g.save(); g.translate(x * ppm, y * ppm); g.rotate(ang);
    g.fillStyle = `rgba(38,24,14,${strength})`;
    if (dark) g.fillStyle = `rgba(24,16,10,${strength})`;
    g.beginPath(); g.ellipse(0, 0, 0.30 * ppm, 0.17 * ppm, 0, 0, 7); g.fill();
    g.restore();
  }
  render(state, look, view, dctx) {
    this.ensure(look);
    const conf = LOOK_CONF[look], ppm = conf.ppm;
    const buf = this.buffers[look], g = buf.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(this.backgrounds[look], 0, 0);
    // persistent tire tracks
    g.globalAlpha = look === 'B' ? 0.85 : 0.95;
    g.drawImage(this.trackLayer, 0, 0, buf.width, buf.height);
    g.globalAlpha = 1;
    const t = state.time;
    for (const p of state.pickups) drawPickup(g, p, p.active, t, ppm, look);
    for (const s of state.stacks) if (!s.broken) drawStack(g, s, ppm, look);
    for (const d of state.debris) drawTireDebris(g, d, ppm, look);
    // particles under trucks (dust, splashes, wakes)
    drawParticles(g, state.particles, ppm, false);
    // trucks
    const sprites = this.sprites[look];
    const count = look === 'B' ? 32 : 16;
    for (const tr of state.trucks) {
      const x = tr.x * ppm, y = tr.y * ppm;
      // sun shadow
      g.fillStyle = 'rgba(20,10,4,0.34)';
      g.beginPath(); g.ellipse(x + 0.38 * ppm, y + 0.55 * ppm, 1.72 * ppm, 1.02 * ppm, tr.ang, 0, 7); g.fill();
      const spr = sprites[tr.color][dirIndex(tr.ang, count)];
      const span = conf.spriteSpan * ppm;
      if (look === 'C') g.imageSmoothingEnabled = true;
      g.drawImage(spr, x - span / 2, y - span / 2, span, span);
      if (look === 'C') g.imageSmoothingEnabled = false;
      if (tr.nitroT > 0) { /* flame drawn as particles in sim */ }
      if (tr.wreckT > 0) {
        g.fillStyle = 'rgba(30,30,30,0.5)';
        g.beginPath(); g.arc(x, y - 1.3 * ppm, (0.5 + 0.2 * Math.sin(t * 9)) * ppm, 0, 7); g.fill();
      }
    }
    // particles over trucks (splash crowns, flames)
    drawParticles(g, state.particles, ppm, true);
    // blit to display
    dctx.imageSmoothingEnabled = conf.smooth;
    dctx.fillStyle = '#0b0906';
    dctx.fillRect(0, 0, dctx.canvas.width, dctx.canvas.height);
    dctx.drawImage(buf, view.x, view.y, view.w, view.h);
  }
}
function drawParticles(g, parts, ppm, over) {
  for (const p of parts) {
    if (p.over !== over) continue;
    const x = p.x * ppm, y = p.y * ppm;
    const lifeF = p.life / p.maxLife;
    if (p.type === 'dust' || p.type === 'spray') {
      g.globalAlpha = 0.34 * lifeF;
      g.fillStyle = p.col;
      g.beginPath(); g.arc(x, y, p.size * ppm * (1.6 - lifeF * 0.6), 0, 7); g.fill();
    } else if (p.type === 'drop') {
      g.globalAlpha = 0.75 * lifeF;
      g.fillStyle = p.col;
      g.fillRect(x - ppm * 0.06, y - ppm * 0.06, ppm * 0.13, ppm * 0.13);
    } else if (p.type === 'ring') {
      g.globalAlpha = 0.4 * lifeF;
      g.strokeStyle = p.col; g.lineWidth = Math.max(1, ppm * 0.09);
      g.beginPath(); g.ellipse(x, y, p.size * ppm * (2 - lifeF), p.size * ppm * (2 - lifeF) * 0.55, 0, 0, 7); g.stroke();
    } else if (p.type === 'flame') {
      g.globalAlpha = 0.8 * lifeF;
      g.fillStyle = p.col;
      g.beginPath(); g.arc(x, y, p.size * ppm * lifeF + 0.5, 0, 7); g.fill();
    }
  }
  g.globalAlpha = 1;
}

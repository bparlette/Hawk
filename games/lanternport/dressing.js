// Lanternport set dressing: bold silhouette and colour transformation layered on top of the city view.
// VIEW ONLY. Nothing here is read by the simulation, adds a collider or moves an anchor; it is all decided by
// hashing positions (no Math.random, no clock), so the town dresses identically on every load.
//
// Two halves so the next builder can reuse either:
//   planDressing(city, opts) -> { lists, counts }   pure data, no three.js: testable headless
//   buildDressing(THREE, city, kit, root, opts)     turns the plan into a handful of instanced meshes
// and a prop kit (PROPS.bench, PROPS.planter, ...) whose functions push rows for one prop at a spot, facing a
// direction: call them from any set that wants the same street furniture.
//
// Rows are [x, y, z, sx, sy, sz, color, rotY, rotZ, rotX] in metres; each list name maps to one geometry + material
// (see LISTS). Rules the planner keeps:
//   * ground props (y <= 2.6) hug a wall (within GROUND_REACH of it) or stand in a park corner, so walks and roads stay clear;
//   * nothing at ground level is placed inside opts.keepOut discs ([x, z, r] in metres: the staged scene sets);
//   * the stage roof interior (the rooftop pool) and the lamp-mission terraces get no rooftop dressing.
import { EDGE, WALK, roadAt } from './sim.js';

export const U = 0.01;
export const GROUND_REACH = 1.25;            // metres a ground prop may stand out from the wall it hugs
const TAU = Math.PI * 2;
const PLASTER = [0xf6e7c8, 0xf2c9a4, 0xcfe0ee, 0xd3e6c4, 0xefc9d6], ROOFS = [0xc8553a, 0x3c8f8a, 0x77529c, 0xd9922e], SHUTTER = [0x3f6b5c, 0x8a3b32, 0x2f4f7a, 0x6b4a2e];
const BLOOMS = [0xff5ea8, 0xffd23c, 0xffffff, 0xff5436, 0xa882ff], LEAVES = [0x2f6b2a, 0x3f8a34, 0x5aa83e, 0x86c44a];
const CLOTH = [0xe84234, 0xf7b825, 0x1ca89c, 0xfff3d6, 0x7848c8, 0x2e78e6, 0xff5a8a];
const STRIPE_PAIRS = [
  [0xe84234, 0xfff3d6], // crimson & cream
  [0x1ca89c, 0xf7b825], // turquoise & saffron gold
  [0x2e78e6, 0xfff3d6], // cobalt & cream
  [0x7848c8, 0xf7b825], // royal purple & gold
  [0xff5436, 0xfff3d6], // coral & cream
];
const TIMBER = 0x5a3b2a, PLANK = 0xc89a62, IRON = 0x2e2a38, STONE = 0xc9c0b4, TERRA = 0xc8744a, ROPE = 0xcdb27a, SAIL = 0xfaf0d8;
const LIT = [3.6, 2.4, 0.9], WARM_LANTERN = [4.0, 2.6, 0.85], FEST_GLOW = [3.4, 1.9, 2.8], DARK = [0.2, 0.34, 0.6];

/** Deterministic 0..1 from two numbers (position / index + salt). */
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const pick = (arr, h) => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

/** Which geometry + material each list is drawn with (buildDressing reads this; add a list = add a line). */
export const LISTS = {
  timber: { geo: 'box', mat: 'timber' },       // dark structural wood: posts, brackets, frames
  plank: { geo: 'box', mat: 'plank' },         // tinted boards: crates, benches, signs, carts
  iron: { geo: 'box', mat: 'iron' },           // railings, pipes, anchors
  stone: { geo: 'box', mat: 'stone' },         // planters, kerbs, bases
  cloth: { geo: 'box', mat: 'cloth' },         // tinted flat cloth: awnings, sails, banners, pennants, murals
  tile: { geo: 'box', mat: 'tile' },           // tinted roof tile: dormer caps, canopies
  cream: { geo: 'box', mat: 'cream' },         // window frames, trims, painted mural backings
  glass: { geo: 'box', mat: 'glow' },          // lit / dark panes & festival string lanterns (HDR colour rows)
  barrel: { geo: 'cyl', mat: 'barrel' },       // barrels, tubs, kegs
  pole: { geo: 'cyl', mat: 'timberCyl' },      // masts, spars, round posts
  pot: { geo: 'cyl', mat: 'terra' },           // terracotta pots, chimney pots, bollards (tinted)
  rope: { geo: 'cyl', mat: 'rope' },           // rope coils, furled sails, bunting cables
  leaf: { geo: 'ball', mat: 'leaf' },          // shrubs, ivy, topiary, balloon envelopes (tinted)
  bloom: { geo: 'bud', mat: 'bloom' },         // flowers, fruit, floats, sun-crests (tinted)
  spire: { geo: 'cone', mat: 'leaf' },         // cone trees, spire roofs, pennant cones
};

// ------------------------------------------------------------------------------------------------ prop kit
/** A frame at (x, z) facing along the unit normal (nx, nz), standing on height y0: P(t, y, out) is t metres along the wall, out from it. */
export function frame(x, z, nx, nz, y0 = 0) {
  const tx = nz, tz = -nx, rot = Math.atan2(nx, nz);
  return { x, z, nx, nz, rot, y0, P: (t, y, out) => [x + tx * t + nx * out, y0 + y, z + tz * t + nz * out] };
}
const row = (L, list, F, t, y, out, sx, sy, sz, color, rz = 0, rx = 0) => { const p = F.P(t, y, out); L[list].push([p[0], p[1], p[2], sx, sy, sz, color, F.rot, rz, rx]); };

/** Street furniture. Each fn(L, F, h) pushes one prop at frame F (out = 0 is the wall face); h = 0..1 picks a variant. */
export const PROPS = {
  bench(L, F, h) {
    const c = pick([0xd94838, 0x1ca89c, 0x2e68c8, 0xe69c24], h);
    row(L, 'plank', F, 0, 0.47, 0.5, 1.8, 0.09, 0.48, c); row(L, 'plank', F, 0, 0.88, 0.3, 1.8, 0.44, 0.08, c);
    for (const s of [-1, 1]) { row(L, 'iron', F, s * 0.74, 0.23, 0.5, 0.08, 0.46, 0.44, IRON); row(L, 'iron', F, s * 0.74, 0.72, 0.3, 0.08, 0.72, 0.08, IRON); }
  },
  planter(L, F, h) {
    row(L, 'stone', F, 0, 0.3, 0.48, 1.6, 0.6, 0.58, h < 0.5 ? 0xe8dfd1 : 0xd49a6a); row(L, 'timber', F, 0, 0.62, 0.48, 1.68, 0.07, 0.64, TIMBER);
    for (let q = -1; q <= 1; q++) {
      row(L, 'leaf', F, q * 0.46, 0.88, 0.48, 0.42, 0.36 + hash(h, q) * 0.14, 0.36, pick(LEAVES, hash(h, q + 5)));
      row(L, 'bloom', F, q * 0.46, 1.14, 0.52, 0.18, 0.16, 0.18, pick(BLOOMS, hash(h, q + 9)));
    }
  },
  barrels(L, F, h) {
    row(L, 'barrel', F, -0.42, 0.48, 0.48, 0.8, 0.96, 0.8, 0xb8763e); row(L, 'barrel', F, 0.42, 0.48, 0.52, 0.76, 0.96, 0.76, 0x2e68c8);
    if (h > 0.35) row(L, 'barrel', F, 0, 1.24, 0.48, 0.64, 0.54, 0.64, 0xe84234);
  },
  crates(L, F, h) {
    const c1 = pick([0xe84234, 0x1ca89c, 0xf7b825, 0x2e78e6], h), c2 = pick([0xf7b825, 0xe84234, 0x7848c8, 0x1ca89c], hash(h, 4));
    row(L, 'plank', F, 0, 0.46, 0.52, 0.92, 0.92, 0.92, c1); row(L, 'plank', F, 0.1, 1.24, 0.5, 0.68, 0.68, 0.68, c2);
    row(L, 'bloom', F, 0.82, 0.32, 0.5, 0.44, 0.32, 0.4, 0xf4ead8);
  },
  pottedTree(L, F, h) {
    row(L, 'pot', F, 0, 0.34, 0.52, 0.78, 0.68, 0.78, TERRA); row(L, 'pole', F, 0, 1.05, 0.52, 0.12, 1.0, 0.12, 0x6b4a33);
    if (h < 0.5) { row(L, 'spire', F, 0, 2.25, 0.52, 1.1, 2.1, 1.1, pick(LEAVES, h * 2)); }
    else { row(L, 'leaf', F, 0, 1.9, 0.52, 0.65, 0.65, 0.65, pick(LEAVES, h)); row(L, 'bloom', F, 0, 2.55, 0.52, 0.32, 0.32, 0.32, pick(BLOOMS, hash(h, 3))); }
  },
  cart(L, F, h) {
    const [c1, c2] = pick(STRIPE_PAIRS, h);
    row(L, 'plank', F, 0, 0.78, 0.68, 1.75, 0.12, 0.92, c1);
    for (const s of [-1, 1]) {
      row(L, 'plank', F, 0, 0.98, 0.68 + s * 0.43, 1.75, 0.32, 0.07, c1);
      row(L, 'bloom', F, 0.35, 0.5, 0.68 + s * 0.5, 0.52, 0.52, 0.07, TIMBER);
      row(L, 'pole', F, s * 0.78, 1.55, 0.68, 0.06, 1.15, 0.06, TIMBER);
    }
    // Bold striped market cart canopy
    for (let st = -2; st <= 2; st++) {
      row(L, 'cloth', F, st * 0.36, 2.18, 0.68, 0.37, 0.1, 1.12, st % 2 === 0 ? c1 : c2);
    }
    for (let q = 0; q < 4; q++) row(L, 'bloom', F, -0.52 + q * 0.34, 1.04, 0.58 + (q % 2) * 0.2, 0.2, 0.18, 0.2, pick([0xff5436, 0xffd23c, 0x5aa83e, 0xff5ea8], hash(h, q + 2)));
  },
  noticeBoard(L, F, h) {
    const c = pick(CLOTH, h);
    for (const s of [-1, 1]) row(L, 'timber', F, s * 0.8, 1.2, 0.32, 0.12, 2.4, 0.12, TIMBER);
    row(L, 'plank', F, 0, 1.55, 0.32, 1.65, 1.2, 0.08, c); row(L, 'tile', F, 0, 2.26, 0.32, 1.95, 0.14, 0.42, 0xf7b825);
    row(L, 'cream', F, 0, 1.55, 0.37, 1.35, 0.9, 0.03, 0xfff6e0);
    row(L, 'bloom', F, 0, 1.55, 0.4, 0.35, 0.35, 0.04, pick([0xe84234, 0x2e78e6, 0x1ca89c], h));
  },
  lobsterPots(L, F, h) {
    for (let q = 0; q < 3; q++) { row(L, 'plank', F, -0.6 + q * 0.6, 0.24, 0.48, 0.54, 0.48, 0.62, q === 1 ? 0x1ca89c : 0xd9a25e); }
    row(L, 'plank', F, 0, 0.72, 0.48, 0.58, 0.48, 0.62, 0xe84234);
    row(L, 'rope', F, 0.95, 0.12, 0.55, 0.64, 0.22, 0.64, ROPE); row(L, 'bloom', F, 1.0, 0.4, 0.5, 0.24, 0.24, 0.24, 0xf7b825);
  },
  netRack(L, F, h) {
    for (const s of [-1, 1]) row(L, 'pole', F, s * 1.3, 1.25, 0.4, 0.1, 2.5, 0.1, TIMBER);
    row(L, 'pole', F, 0, 2.45, 0.4, 0.08, 2.8, 0.08, TIMBER, Math.PI / 2); row(L, 'cloth', F, 0, 1.55, 0.4, 2.5, 1.7, 0.04, h < 0.5 ? 0x1ca89c : 0xe84234);
    for (let q = 0; q < 4; q++) row(L, 'bloom', F, -0.9 + q * 0.6, 0.78, 0.44, 0.14, 0.14, 0.14, 0xf7b825);
  },
  anchor(L, F) {
    row(L, 'iron', F, 0, 0.75, 0.24, 0.14, 1.5, 0.14, IRON, 0.12); row(L, 'iron', F, 0, 1.3, 0.24, 0.75, 0.12, 0.12, IRON, 0.12); row(L, 'iron', F, 0.05, 0.2, 0.24, 0.95, 0.14, 0.14, IRON, 0.12);
    for (const s of [-1, 1]) row(L, 'iron', F, 0.05 + s * 0.45, 0.36, 0.24, 0.14, 0.36, 0.14, IRON, -s * 0.5);
  },
  cargo(L, F, h) {
    const c1 = pick([0xe84234, 0x1ca89c, 0x2e78e6, 0xf7b825], h);
    const c2 = pick([0xf7b825, 0xe84234, 0xfff3d6, 0x7848c8], hash(h, 3));
    const c3 = pick([0x1ca89c, 0x2e78e6, 0xe84234, 0xf7b825], hash(h, 7));
    row(L, 'plank', F, -0.7, 0.68, 0.75, 1.35, 1.35, 1.35, c1);
    row(L, 'plank', F, 0.75, 0.58, 0.65, 1.15, 1.15, 1.15, c2);
    row(L, 'plank', F, -0.5, 1.82, 0.7, 0.96, 0.96, 0.96, c3);
    row(L, 'cloth', F, 0.75, 1.18, 0.65, 1.24, 0.08, 1.24, 0xfff3d6);
    row(L, 'barrel', F, 1.75, 0.52, 0.52, 0.84, 1.04, 0.84, 0xe84234);
  },
  wallBanner(L, F, h) {
    const c = pick(CLOTH, h), c2 = pick([0xf7b825, 0xfff3d6, 0x1ca89c], hash(h, 5));
    row(L, 'timber', F, 0, 12.2, 0.18, 3.2, 0.18, 0.18, TIMBER);
    row(L, 'cloth', F, 0, 8.2, 0.15, 2.7, 7.8, 0.06, c);
    row(L, 'cloth', F, 0, 4.35, 0.17, 2.7, 0.45, 0.07, 0xf7b825);
    row(L, 'cloth', F, 0, 9.2, 0.2, 1.45, 1.45, 0.05, c2, Math.PI / 4);
    row(L, 'bloom', F, 0, 9.2, 0.24, 0.48, 0.48, 0.08, 0xe84234);
  },
  bollard(L, F) {
    row(L, 'pot', F, 0, 0.38, 0.6, 0.4, 0.76, 0.4, 0x2e2a38); row(L, 'pot', F, 0, 0.8, 0.6, 0.54, 0.14, 0.54, 0xf7b825); row(L, 'rope', F, 0, 0.34, 0.6, 0.56, 0.22, 0.56, ROPE);
  },
};
const STREET = ['bench', 'planter', 'barrels', 'crates', 'pottedTree', 'cart', 'noticeBoard', 'cart', 'pottedTree'];
const ALLEY = ['barrels', 'crates'];
const QUAY = ['cargo', 'netRack', 'lobsterPots', 'cargo', 'barrels', 'anchor', 'bollard', 'cargo', 'crates'];

// ------------------------------------------------------------------------------------------------ high-impact silhouette helpers
/** Bold striped shopfront / facade awning projecting out at y >= 3.0m (above ground check). */
function addStripedAwning(L, F, tCenter, y, width, depth, pairIdx) {
  const [c1, c2] = STRIPE_PAIRS[pairIdx % STRIPE_PAIRS.length];
  const nStripes = Math.max(5, Math.round(width / 0.65));
  const sw = width / nStripes;
  for (let i = 0; i < nStripes; i++) {
    const t = tCenter - width / 2 + (i + 0.5) * sw;
    const col = i % 2 === 0 ? c1 : c2;
    row(L, 'cloth', F, t, y, depth * 0.52, sw * 1.02, 0.09, depth, col, 0, 0.32);
    row(L, 'cloth', F, t, y - depth * 0.18 - 0.14, depth * 0.98, sw * 0.96, 0.26, 0.06, col);
  }
  for (const s of [-1, 1]) {
    row(L, 'iron', F, tCenter + s * (width / 2 - 0.12), y - 0.35, depth * 0.45, 0.06, 0.06, depth * 0.95, IRON, 0, -0.35);
  }
}

/** Big painted wall mural (sunburst / wave / festival diamond crest) on a facade or town wall (y >= 3.4m). */
function addWallMural(L, F, tCenter, yCenter, w, h, seed) {
  const bg = pick([0x1ca89c, 0x2e68c8, 0x7848c8, 0xe84234, 0xf7b825], seed);
  const accent = bg === 0xf7b825 ? 0xe84234 : 0xf7b825;
  const trim = 0xfff3d6;
  // Outer frame + backing canvas
  row(L, 'timber', F, tCenter, yCenter, 0.08, w + 0.35, h + 0.35, 0.08, TIMBER);
  row(L, 'cream', F, tCenter, yCenter, 0.11, w, h, 0.06, bg);
  // Bold geometric stripes & sun/diamond motif
  row(L, 'cloth', F, tCenter, yCenter - h * 0.28, 0.14, w * 0.92, h * 0.22, 0.05, trim);
  row(L, 'cloth', F, tCenter, yCenter + h * 0.06, 0.15, h * 0.52, h * 0.52, 0.05, accent, Math.PI / 4);
  row(L, 'bloom', F, tCenter, yCenter + h * 0.06, 0.18, h * 0.26, h * 0.26, 0.07, trim);
  for (const s of [-1, 1]) {
    row(L, 'cloth', F, tCenter + s * (w * 0.32), yCenter + h * 0.08, 0.15, h * 0.3, h * 0.3, 0.05, trim, Math.PI / 4);
  }
}

/** Street-spanning festival bunting + glowing lantern garland between (x0, z0) and (x1, z1) at height y0 (y > 2.6). */
function addOverheadSpan(L, x0, z0, x1, z1, y0, sag, seed, withLanterns = true, bannerBridge = false) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
  const nFlags = Math.max(7, Math.floor(len / 1.35));
  for (let i = 0; i <= nFlags; i++) {
    const u = i / nFlags;
    const x = x0 + dx * u, z = z0 + dz * u;
    const drop = 4 * u * (1 - u) * sag;
    const y = y0 - drop;
    if (i < nFlags) {
      const col = CLOTH[(i + Math.floor(seed * 7)) % CLOTH.length];
      L.cloth.push([x, y - 0.38, z, 0.12, 0.72, 0.58, col, ry, 0, Math.PI / 4]);
    }
    if (withLanterns && i > 0 && i < nFlags && i % 2 === 1) {
      L.glass.push([x, y - 0.78, z, 0.32, 0.38, 0.32, i % 4 === 1 ? WARM_LANTERN : FEST_GLOW, 0, 0, 0]);
    }
  }
  if (bannerBridge) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = y0 - sag * 0.45 + 0.85;
    const c1 = pick([0xe84234, 0x1ca89c, 0x7848c8, 0x2e78e6], seed);
    L.cloth.push([mx, my, mz, 0.14, 1.35, Math.min(7.5, len * 0.58), c1, ry, 0, 0]);
    L.cloth.push([mx, my, mz, 0.18, 0.85, Math.min(6.6, len * 0.5), 0xfff3d6, ry, 0, 0]);
    L.bloom.push([mx, my, mz, 0.32, 0.45, 0.45, 0xf7b825, ry, 0, 0]);
  }
}

/** Overhead festival archway (all elements centered at y > 2.6 so ground paths stay 100% clear). */
function addFestivalArch(L, cx, cz, span, ry, seed) {
  const tx = Math.cos(ry), tz = -Math.sin(ry);
  const [c1, c2] = pick(STRIPE_PAIRS, seed);
  // Upper side pillars (y = 2.7..7.8 -> center y = 5.25 > 2.6)
  for (const s of [-1, 1]) {
    const px = cx + tx * s * (span / 2), pz = cz + tz * s * (span / 2);
    L.pole.push([px, 5.25, pz, 0.34, 5.1, 0.34, c1, 0, 0, 0]);
    L.bloom.push([px, 8.0, pz, 0.42, 0.42, 0.42, 0xf7b825, 0, 0, 0]);
    L.cloth.push([px, 5.1, pz, 0.95, 3.8, 0.08, c2, ry, 0, 0]);
    L.cloth.push([px, 5.1, pz, 0.55, 3.2, 0.1, c1, ry, 0, 0]);
  }
  // Crossbeam & striped arch crown at y = 7.4..8.6
  L.timber.push([cx, 7.45, cz, span + 1.2, 0.28, 0.32, TIMBER, ry, 0, 0]);
  const nSt = 7, sw = (span + 0.8) / nSt;
  for (let i = 0; i < nSt; i++) {
    const off = (i - (nSt - 1) / 2) * sw;
    const archY = 8.05 + (1 - Math.pow((i - 3) / 3.5, 2)) * 0.75;
    L.cloth.push([cx + tx * off, archY, cz + tz * off, sw * 1.04, 0.85, 0.45, i % 2 === 0 ? c1 : c2, ry, 0, 0]);
  }
  L.bloom.push([cx, 9.0, cz, 0.55, 0.55, 0.25, 0xf7b825, ry, 0, 0]);
  for (let q = -2; q <= 2; q++) {
    L.glass.push([cx + tx * q * (span * 0.18), 6.95, cz + tz * q * (span * 0.18), 0.34, 0.4, 0.34, WARM_LANTERN, 0, 0, 0]);
  }
}

/** Rooftop skyline structure: Bell/Clock Cupola, Striped Sky-Pavilion, or Festival Beacon Spire. */
function addSkylineTower(L, cx, y, cz, w, d, seed, roofC) {
  const kind = Math.floor(seed * 3);
  const [c1, c2] = pick(STRIPE_PAIRS, seed);
  if (kind === 0) {
    // Tall Clock / Bell Cupola Tower (+7.8m tall)
    L.cream.push([cx, y + 1.8, cz, 2.5, 3.6, 2.5, 0xfff3d6, 0, 0, 0]);
    L.tile.push([cx, y + 3.75, cz, 2.9, 0.28, 2.9, roofC, 0, 0, 0]);
    L.cream.push([cx, y + 4.9, cz, 1.85, 2.1, 1.85, 0xf6e7c8, 0, 0, 0]);
    // Glowing clock/lantern faces on all 4 sides
    L.glass.push([cx, y + 4.9, cz, 1.92, 0.95, 0.95, WARM_LANTERN, 0, 0, 0]);
    L.glass.push([cx, y + 4.9, cz, 0.95, 0.95, 1.92, WARM_LANTERN, 0, 0, 0]);
    L.spire.push([cx, y + 6.95, cz, 2.4, 2.1, 2.4, c1, 0, 0, 0]);
    L.pole.push([cx, y + 8.5, cz, 0.1, 1.6, 0.1, 0xf7b825, 0, 0, 0]);
    L.cloth.push([cx + 0.7, y + 9.0, cz, 1.35, 0.55, 0.06, 0xf7b825, 0, 0, 0]);
  } else if (kind === 1) {
    // Bold Striped Rooftop Festival Pavilion (+5.4m tall)
    const pw = Math.min(5.4, w - 1.8), pd = Math.min(4.2, d - 1.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      L.pole.push([cx + sx * (pw * 0.44), y + 1.6, cz + sz * (pd * 0.44), 0.16, 3.2, 0.16, TIMBER, 0, 0, 0]);
    }
    for (let i = -2; i <= 2; i++) {
      L.cloth.push([cx + i * (pw / 5), y + 3.35, cz, pw / 5 + 0.05, 0.28, pd + 0.4, i % 2 === 0 ? c1 : c2, 0, 0, 0]);
    }
    L.spire.push([cx, y + 4.35, cz, Math.min(pw, pd) * 0.85, 1.8, Math.min(pw, pd) * 0.85, c1, 0, 0, 0]);
    L.bloom.push([cx, y + 5.35, cz, 0.36, 0.36, 0.36, 0xf7b825, 0, 0, 0]);
    L.glass.push([cx, y + 2.75, cz, 0.45, 0.45, 0.45, WARM_LANTERN, 0, 0, 0]);
  } else {
    // Painted Rooftop Festival Billboard + Twin Pennant Spires (+6.8m tall)
    L.timber.push([cx - 1.4, y + 1.8, cz, 0.18, 3.6, 0.18, TIMBER, 0, 0, 0]);
    L.timber.push([cx + 1.4, y + 1.8, cz, 0.18, 3.6, 0.18, TIMBER, 0, 0, 0]);
    L.cloth.push([cx, y + 2.5, cz, 3.6, 2.2, 0.16, c1, 0, 0, 0]);
    L.cream.push([cx, y + 2.5, cz, 3.1, 1.7, 0.2, c2, 0, 0, 0]);
    L.bloom.push([cx, y + 2.5, cz, 0.75, 0.75, 0.24, 0xf7b825, 0, 0, 0]);
    for (const s of [-1, 1]) {
      L.pole.push([cx + s * 1.8, y + 3.2, cz, 0.12, 6.4, 0.12, 0xfff3d6, 0, 0, 0]);
      L.cloth.push([cx + s * 1.8 + 0.75, y + 5.6, cz, 1.4, 0.7, 0.06, s < 0 ? 0xe84234 : 0x1ca89c, 0, 0, 0]);
    }
  }
}

/** Colourful tethered festival hot-air balloon floating at (x, y, z) (y = 28..38m). */
function addFestivalBalloon(L, x, y, z, cMain, cStripe, cBasket = 0xc89a62) {
  L.leaf.push([x, y, z, 3.4, 4.1, 3.4, cMain, 0, 0, 0]);
  L.bloom.push([x, y + 0.1, z, 3.55, 1.4, 3.55, cStripe, 0, 0, 0]);
  L.bloom.push([x, y + 1.6, z, 2.4, 0.9, 2.4, 0xf7b825, 0, 0, 0]);
  L.pot.push([x, y - 3.6, z, 1.35, 1.2, 1.35, cMain, 0, 0, 0]);
  L.glass.push([x, y - 4.3, z, 0.7, 0.8, 0.7, WARM_LANTERN, 0, 0, 0]);
  L.plank.push([x, y - 5.4, z, 1.2, 0.95, 1.2, cBasket, 0, 0, 0]);
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) {
    L.rope.push([x + sx, y - 4.4, z + sz, 0.05, 1.9, 0.05, ROPE, 0, 0, 0]);
  }
}

// ------------------------------------------------------------------------------------------------ the plan
/** The stage roof (tallest roomy building nearest the middle): the same choice the rooftop scenes make. */
export function stageRoof(city) {
  const hs = city.boxes.filter((b) => b.kind === 'house' && b.y1 >= 1500 && b.x1 - b.x0 >= 1000 && b.z1 - b.z0 >= 900);
  hs.sort((a, b) => b.y1 - a.y1 || Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
  return hs[0] || null;
}

export function planDressing(city, opts = {}) {
  const keepOut = opts.keepOut || [];
  const L = {}; for (const k of Object.keys(LISTS)) L[k] = [];
  const blocked = (x, z, pad = 0) => keepOut.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r + pad);
  const crates = city.boxes.filter((b) => b.kind === 'crate' || b.kind === 'barrel');
  const nearCrate = (x, z) => crates.some((b) => x > b.x0 * U - 1.6 && x < b.x1 * U + 1.6 && z > b.z0 * U - 1.6 && z < b.z1 * U + 1.6);
  const roof = stageRoof(city), blockOf = (cx, cz) => city.blocks.find((b) => cx >= b.x0 && cx <= b.x1 && cz >= b.z0 && cz <= b.z1);
  const quayside = (x, z) => x > 60 && z > 60;
  let k = 0;

  // ---- 1. Buildings: bold striped awnings, painted wall murals, vertical banners, ground furniture & skyline rooftops
  for (const b of city.boxes) {
    if (b.kind !== 'house') continue;
    const w = (b.x1 - b.x0) * U, h = (b.y1 - b.y0) * U, d = (b.z1 - b.z0) * U, cx = ((b.x0 + b.x1) / 2) * U, cz = ((b.z0 + b.z1) / 2) * U;
    const blk = blockOf((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), tall = h >= 7.5, top = tall ? h - 2.2 : h, roofC = ROOFS[b.roof];
    const seed = hash(cx, cz), terraces = blk && blk.kind === 'steps', isStage = b === roof;
    const faces = [[0, 1, w, d], [0, -1, w, d], [1, 0, d, w], [-1, 0, d, w]];

    faces.forEach(([nx, nz, span, depth], f) => {
      if (terraces) return;
      const F = frame(cx + nx * depth / 2, cz + nz * depth / 2, nx, nz), fh = hash(seed, f + 1);
      const outer = blk && (nx > 0 ? Math.abs(b.x1 - (blk.x1 - WALK)) < 2 : nx < 0 ? Math.abs(b.x0 - (blk.x0 + WALK)) < 2 : nz > 0 ? Math.abs(b.z1 - (blk.z1 - WALK)) < 2 : Math.abs(b.z0 - (blk.z0 + WALK)) < 2);
      const doorFace = f === k % 4 && h > 3, shop = doorFace && k % 2 === 0 && span > 9.5;
      const nWin = Math.max(1, Math.floor((span - 1.6) / 2.7)), rows = Math.max(0, Math.floor((top - 1.0 - 2.0) / 2.9) + 1);

      // Bold striped ground-story awnings on outer faces (y = 3.15 > 2.6)
      if (outer && h > 3.6 && span >= 6.5) {
        const awWidth = Math.min(span - 1.4, 7.8);
        addStripedAwning(L, F, 0, 3.15, awWidth, 1.55, k + f);
      }

      // Big painted wall murals & vertical festival banners on upper facades
      if (outer && h >= 5.2 && span >= 7.5) {
        if (fh < 0.55 || (cz > 65 && nz > 0)) {
          const my = Math.min(top - 1.5, Math.max(4.3, h * 0.58));
          addWallMural(L, F, 0, my, Math.min(4.8, span * 0.48), 2.5, fh);
        }
        if (h >= 8.5) {
          for (const s of [-1, 1]) {
            const bt = s * (span / 2 - 1.35), by = Math.min(top - 2.4, h * 0.62);
            const bc = pick(CLOTH, hash(fh, s + 9));
            row(L, 'timber', F, bt, by + 2.3, 0.2, 1.25, 0.12, 0.12, TIMBER);
            row(L, 'cloth', F, bt, by, 0.18, 1.05, 4.4, 0.06, bc);
            row(L, 'cloth', F, bt, by - 2.2, 0.19, 1.05, 0.25, 0.07, 0xf7b825);
          }
        }
      }

      // Second-story balconies with bright flower boxes
      if (outer && rows >= 2 && fh > 0.35) {
        const col = Math.floor(hash(fh, 7) * nWin), t = (col - (nWin - 1) / 2) * 2.7, y = 2.0 + 2.9 * (rows >= 3 && fh > 0.72 ? 2 : 1);
        row(L, 'stone', F, t, y - 0.98, 0.45, 2.2, 0.14, 0.88, 0xe8dfd1);
        row(L, 'iron', F, t, y - 0.5, 0.84, 2.15, 0.86, 0.06, IRON);
        for (const s of [-1, 1]) {
          row(L, 'pot', F, t + s * 0.6, y - 0.78, 0.66, 0.34, 0.28, 0.34, TERRA);
          row(L, 'bloom', F, t + s * 0.6, y - 0.48, 0.68, 0.22, 0.2, 0.22, pick(BLOOMS, hash(s, fh)));
        }
      }

      // Ground furniture hugging the wall (y <= 2.6, strictly within GROUND_REACH)
      if (h > 3) {
        const kit = !outer ? ALLEY : quayside(cx, cz) ? [...QUAY, ...STREET] : STREET, clearDoor = doorFace ? (shop ? 5.3 : 2.5) : 0;
        const slots = outer ? Math.max(1, Math.floor(span / 5.2)) : 1;
        for (let s = 0; s < slots; s++) {
          const ph = hash(fh, s + 11); if (ph < (outer ? 0.25 : 0.65)) continue;
          const t = slots === 1 ? (hash(fh, 3) - 0.5) * (span - 4) : -span / 2 + 1.8 + (s + 0.5) * ((span - 3.6) / slots);
          if (Math.abs(t) < clearDoor || Math.abs(t) > span / 2 - 1.4) continue;
          const p = F.P(t, 0, 0.6); if (blocked(p[0], p[2], 1.2) || nearCrate(p[0], p[2])) continue;
          const G = frame(F.P(t, 0, 0)[0], F.P(t, 0, 0)[2], nx, nz);
          PROPS[pick(kit, hash(ph, 5))](L, G, hash(ph, 9));
        }
      }
    });

    // ---- Rooftops: bold skyline silhouettes (cupolas, striped rooftop pavilions, beacon spires)
    if (!isStage && !terraces && h > 3) {
      if (tall) {
        faces.forEach(([nx, nz, span, depth], f) => {
          const F = frame(cx + nx * depth / 2, cz + nz * depth / 2, nx, nz), n = Math.floor((span - 2) / 4.8); if (n < 1) return;
          for (let i = 0; i < n; i++) {
            const t = (i - (n - 1) / 2) * 4.8, y = top + 1.0;
            row(L, 'cream', F, t, y, -0.5, 1.25, 1.35, 1.0, PLASTER[b.hue]);
            row(L, 'glass', F, t, y + 0.05, 0.02, 0.85, 0.95, 0.04, hash(seed, f * 9 + i) < 0.45 ? LIT : DARK);
            row(L, 'tile', F, t, y + 0.76, -0.42, 1.55, 0.18, 1.35, roofC);
          }
        });
      }
      const x0 = cx - w / 2 + (tall ? 1.5 : 0.7), x1 = cx + w / 2 - (tall ? 1.5 : 0.7), z0 = cz - d / 2 + (tall ? 1.5 : 0.7), z1 = cz + d / 2 - (tall ? 1.5 : 0.7), y = h;
      if (x1 - x0 > 2.5 && z1 - z0 > 2.5) {
        const flat = !tall;
        if (flat) {
          for (const sz of [-1, 1]) L.stone.push([cx, y + 0.12, cz + sz * (d / 2 + 0.12), w + 0.5, 0.24, 0.28, 0xe8dfd1, 0, 0, 0]);
          for (const sx of [-1, 1]) L.stone.push([cx + sx * (w / 2 + 0.12), y + 0.12, cz, 0.28, 0.24, d + 0.5, 0xe8dfd1, 0, 0, 0]);
        }
        // Chimney stack + prominent skyline tower/pavilion on almost every roof
        const qx = hash(seed, 21) < 0.5 ? x0 + 0.35 : x1 - 0.35, qz = hash(seed, 22) < 0.5 ? z0 + 0.4 : z1 - 0.4;
        L.stone.push([qx, y + 0.8, qz, 1.15, 1.6, 0.75, 0xb85a3e, 0, 0, 0]);
        L.pot.push([qx, y + 1.85, qz, 0.36, 0.52, 0.36, TERRA, 0, 0, 0]);
        addSkylineTower(L, cx, y, cz, x1 - x0, z1 - z0, seed, roofC);
      }
    }
    k++;
  }

  // ---- 2. Stage-Roof outer parapet pergola & banners (strictly on the outer rim outside [r.x0+0.2..r.x1-0.2, r.z0+0.2..r.z1-0.2])
  if (roof) {
    const rx0 = roof.x0 * U, rx1 = roof.x1 * U, rz0 = roof.z0 * U, rz1 = roof.z1 * U, ry = roof.y1 * U;
    // North edge (z = rz0 + 0.08) and West edge (x = rx0 + 0.08) — right in the sightline of pool & rooftop cameras!
    const nPosts = 5;
    for (let i = 0; i < nPosts; i++) {
      const u = i / (nPosts - 1);
      const px = rx0 + 0.08 + u * (rx1 - rx0 - 0.16), pz = rz0 + 0.08;
      L.pole.push([px, ry + 1.9, pz, 0.18, 3.8, 0.18, TIMBER, 0, 0, 0]);
      L.bloom.push([px, ry + 3.9, pz, 0.3, 0.3, 0.3, 0xf7b825, 0, 0, 0]);
      if (i < nPosts - 1) {
        const nx = rx0 + 0.08 + ((i + 0.5) / (nPosts - 1)) * (rx1 - rx0 - 0.16);
        L.timber.push([nx, ry + 3.65, pz, (rx1 - rx0) / (nPosts - 1), 0.14, 0.16, TIMBER, 0, 0, 0]);
        L.cloth.push([nx, ry + 3.25, pz, (rx1 - rx0) / (nPosts - 1) * 0.88, 0.55, 0.08, i % 2 === 0 ? 0xe84234 : 0x1ca89c, 0, 0, 0]);
        L.glass.push([nx, ry + 2.85, pz, 0.28, 0.34, 0.28, WARM_LANTERN, 0, 0, 0]);
      }
    }
    for (let i = 1; i < nPosts; i++) {
      const u = i / (nPosts - 1);
      const px = rx0 + 0.08, pz = rz0 + 0.08 + u * (rz1 - rz0 - 0.16);
      L.pole.push([px, ry + 1.9, pz, 0.18, 3.8, 0.18, TIMBER, 0, 0, 0]);
      L.bloom.push([px, ry + 3.9, pz, 0.3, 0.3, 0.3, 0xf7b825, 0, 0, 0]);
      const nz = rz0 + 0.08 + ((i - 0.5) / (nPosts - 1)) * (rz1 - rz0 - 0.16);
      L.timber.push([px, ry + 3.65, nz, 0.16, 0.14, (rz1 - rz0) / (nPosts - 1), TIMBER, 0, 0, 0]);
      L.cloth.push([px, ry + 3.25, nz, 0.08, 0.55, (rz1 - rz0) / (nPosts - 1) * 0.88, i % 2 === 0 ? 0xf7b825 : 0x7848c8, 0, 0, 0]);
      L.glass.push([px, ry + 2.85, nz, 0.28, 0.34, 0.28, WARM_LANTERN, 0, 0, 0]);
    }
  }

  // ---- 3. Street-spanning festival bunting, glowing string lights & banner bridges across the road grid
  const roads = [0, 1, 2, 3, 4, 5].map((i) => roadAt(i) * U);
  for (const rx of roads) {
    if (Math.abs(rx) > 100) continue;
    for (let z = -112; z <= 112; z += 16) {
      if (Math.abs(z) < 4) continue;
      const h = hash(rx, z);
      addOverheadSpan(L, rx - 6.2, z, rx + 6.2, z, 6.8 + (h > 0.5 ? 0.6 : 0), 0.75, h, true, Math.abs(z) % 32 === 0);
    }
  }
  for (const rz of roads) {
    if (Math.abs(rz) > 100) continue;
    for (let x = -112; x <= 112; x += 16) {
      if (Math.abs(x) < 4) continue;
      const h = hash(zToSeed(rz), x);
      addOverheadSpan(L, x, rz - 6.2, x, rz + 6.2, 6.9 + (h > 0.5 ? 0.5 : 0), 0.75, h, true, Math.abs(x) % 32 === 0);
    }
  }
  // Extradock-corridor spans right in front of the dock-fishing camera (looking -Z along x = 84..96, z = 60..86)
  addOverheadSpan(L, 78.2, 83, 95.5, 83, 5.6, 0.65, 0.3, true, true);
  addOverheadSpan(L, 78.2, 73, 89.8, 73, 6.2, 0.6, 0.7, true, false);

  // ---- 4. Hanging flower baskets & festival pennants on every street lamp
  for (const b of city.blocks) for (const [fx, fz] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) {
    const x = (b.x0 + 45 + fx * (b.x1 - b.x0 - 90)) * U, z = (b.z0 + 45 + fz * (b.z1 - b.z0 - 90)) * U, ox = fx === 0 ? -1 : fx === 1 ? 1 : 0, oz = ox ? 0 : fz === 0 ? -1 : 1, hh = hash(x, z);
    L.iron.push([x - ox * 0.35, 3.3, z - oz * 0.35, ox ? 0.7 : 0.06, 0.06, oz ? 0.7 : 0.06, IRON, 0, 0, 0]);
    L.pot.push([x - ox * 0.55, 2.95, z - oz * 0.55, 0.42, 0.28, 0.42, TERRA, 0, 0, 0]);
    L.leaf.push([x - ox * 0.55, 3.12, z - oz * 0.55, 0.38, 0.26, 0.38, pick(LEAVES, hh), 0, 0, 0]);
    L.bloom.push([x - ox * 0.55, 3.28, z - oz * 0.55, 0.26, 0.2, 0.26, pick(BLOOMS, hh), 0, 0, 0]);
    // Bright vertical lamp pennant (y = 2.85 > 2.6)
    L.cloth.push([x + ox * 0.32, 2.85, z + oz * 0.32, ox ? 0.52 : 0.06, 1.15, oz ? 0.52 : 0.06, pick(CLOTH, hh), 0, 0, 0]);
  }

  // ---- 5. Central Plaza Focal Point (Sun-Spire Crown, Radial Bunting Web, Triumphal Arches & Market Pavilions)
  if (city.fountain) {
    const fx = city.fountain.x * U, fz = city.fountain.z * U;
    // Grand Central Sun-Spire rising above the fountain (all elements y >= 3.8 > 2.6 so ground keep-out is 100% untouched)
    L.pole.push([fx, 11.5, fz, 0.48, 13.0, 0.48, 0xf7b825, 0, 0, 0]);
    L.spire.push([fx, 18.8, fz, 2.6, 3.2, 2.6, 0xe84234, 0, 0, 0]);
    L.bloom.push([fx, 21.2, fz, 1.35, 1.35, 1.35, 0xf7b825, 0, 0, 0]);
    L.glass.push([fx, 21.2, fz, 1.65, 0.55, 1.65, WARM_LANTERN, 0, 0, 0]);
    // Radial festival canopy & bunting ribbons radiating from the Sun-Spire to 8 perimeter festival masts
    for (let q = 0; q < 8; q++) {
      const a = q * (TAU / 8) + 0.39;
      const mx = fx + Math.sin(a) * 13.8, mz = fz + Math.cos(a) * 13.8;
      // Perimeter mast centered at y = 5.4 > 2.6
      L.pole.push([mx, 5.4, mz, 0.24, 5.6, 0.24, 0xfff3d6, 0, 0, 0]);
      L.bloom.push([mx, 8.35, mz, 0.38, 0.38, 0.38, 0xf7b825, 0, 0, 0]);
      addOverheadSpan(L, fx, fz, mx, mz, 14.5, 2.4, q / 8, true, false);
    }
    // Triumphal Festival Arches framing the Plaza & the photo-call camera view (looking -Z along x = 31)
    addFestivalArch(L, 31.0, -15.5, 7.6, 0, 0.15);
    addFestivalArch(L, 31.0, -34.5, 8.2, 0, 0.55);
    addFestivalArch(L, 21.0, -35.2, 8.4, 0, 0.35);
    addFestivalArch(L, 21.0, -6.8, 8.4, 0, 0.75);
  }

  // ---- 6. Parks, Plazas & Docks: tall festival banner poles, striped market stalls (outside keep-out)
  for (const b of city.blocks) {
    if (b.kind !== 'plaza' && b.kind !== 'hideout' && b.kind !== 'docks') continue;
    for (const [fx, fz] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) {
      const x = (b.x0 + 260 + fx * (b.x1 - b.x0 - 520)) * U, z = (b.z0 + 260 + fz * (b.z1 - b.z0 - 520)) * U, hh = hash(x, z);
      const c = pick(CLOTH, hh), ry = Math.atan2(fx - 0.5, fz - 0.5);
      // Tall banner pole centered at y = 4.6 > 2.6 (always visible, even near sets)
      L.pole.push([x, 4.6, z, 0.18, 4.0, 0.18, 0xfff3d6, 0, 0, 0]);
      L.bloom.push([x, 6.75, z, 0.32, 0.32, 0.32, 0xf7b825, 0, 0, 0]);
      L.cloth.push([x + Math.cos(ry) * 0.65, 5.1, z - Math.sin(ry) * 0.65, 1.15, 2.8, 0.06, c, ry, 0, 0]);
      if (!blocked(x, z, 1.2)) {
        L.stone.push([x, 0.25, z, 1.1, 0.5, 1.1, STONE, ry, 0, 0]);
        L.pole.push([x, 1.5, z, 0.18, 2.4, 0.18, 0xfff3d6, 0, 0, 0]);
        for (let q = 0; q < 6; q++) {
          const a = q * 1.04 + hh * 6, r = 0.8 + hash(q, hh) * 0.4;
          L.bloom.push([x + Math.cos(a) * r, 0.34, z + Math.sin(a) * r, 0.22, 0.18, 0.22, pick(BLOOMS, hash(q, x)), 0, 0, 0]);
        }
      }
    }
  }

  // ---- 7. Harbour Colour Blocking: billowing colourful sails, giant crane, dock murals & overhead dock bunting
  const E = EDGE * U, seaWalls = [[1, 0], [0, 1]];
  const SAIL_COLORS = [0xe84234, 0xf7b825, 0x1ca89c, 0x2e78e6, 0xfff3d6, 0xff5a8a];
  for (const [wx, wz] of seaWalls) for (let i = 0; i < 6; i++) {
    const along = 38 + i * 16 + hash(i, wx * 3 + wz) * 4, hh = hash(i + 1, wx * 7 + wz * 13);
    const x = wx ? E + 9 + hh * 4 : along, z = wz ? E + 9 + hh * 4 : along, ry = wx ? 0 : Math.PI / 2;
    const masts = 2;
    for (let m = 0; m < masts; m++) {
      const off = (m - 0.5) * 8.0, mx = x + (wz ? off : 0), mz = z + (wx ? off : 0), H = 29 + hash(hh, m) * 6 - m * 2.5;
      const sCol1 = SAIL_COLORS[(i * 2 + m) % SAIL_COLORS.length];
      const sCol2 = SAIL_COLORS[(i * 2 + m + 3) % SAIL_COLORS.length];
      L.pole.push([mx, H / 2, mz, 0.55, H, 0.55, 0x6b4a33, 0, 0, 0]);
      L.pole.push([mx, H - 4.5, mz, 1.6, 0.9, 1.6, 0xf7b825, 0, 0, 0]);
      // Full billowing colourful square sails above the sea walls (y = 17..27m)
      for (const [yy, len, sh, col] of [[H - 10.5, 9.8, 5.2, sCol1], [H - 4.2, 7.2, 4.0, sCol2]]) {
        L.pole.push([mx, yy + sh / 2, mz, 0.24, len, 0.24, 0x6b4a33, ry, 0, Math.PI / 2]);
        L.cloth.push([mx + (wx ? -0.6 : 0), yy, mz + (wz ? -0.6 : 0), wx ? 0.45 : len * 0.92, sh, wz ? 0.45 : len * 0.92, col, 0, 0, 0]);
        L.cloth.push([mx + (wx ? -0.75 : 0), yy, mz + (wz ? -0.75 : 0), wx ? 0.5 : len * 0.88, sh * 0.28, wz ? 0.5 : len * 0.88, 0xfff3d6, 0, 0, 0]);
      }
      // Large masthead pennant
      L.cloth.push([mx + (wz ? 1.8 : 0), H + 0.5, mz + (wx ? 1.8 : 0), wx ? 0.08 : 3.6, 1.15, wx ? 3.6 : 0.08, 0xf7b825, 0, 0, 0]);
    }
  }

  // Harbour dock overhead festival spans & quay crane + colour-blocked cargo
  addOverheadSpan(L, 90, 96, 131, 96, 7.5, 1.1, 0.2, true, true);
  addOverheadSpan(L, 96, 90, 96, 131, 7.5, 1.1, 0.6, true, true);
  addOverheadSpan(L, 92, 112, 131, 112, 8.2, 1.2, 0.8, true, false);
  addOverheadSpan(L, 112, 92, 112, 131, 8.2, 1.2, 0.4, true, false);

  for (const [wx, wz] of seaWalls) for (let i = 0; i < 18; i++) {
    const along = 62 + i * 3.6, hh = hash(i + 3, wx * 5 + wz * 11);
    if (along > E - 9) continue;
    const x = wx ? E : along, z = wz ? E : along;
    const G = frame(x, z, -wx, -wz);
    if (i === 8) {
      // Towering Saffron-Yellow & Crimson Harbour Gantry Crane (y > 2.6)
      row(L, 'stone', G, 0, 0.4, 0.8, 1.8, 0.8, 1.8, 0xe84234);
      row(L, 'pole', G, 0, 7.5, 0.8, 0.75, 14.2, 0.75, 0xf7b825);
      row(L, 'plank', G, 0, 12.8, 0.8, 2.2, 1.8, 2.2, 0xe84234);
      row(L, 'pole', G, 0, 15.2, 4.2, 0.45, 9.6, 0.45, 0xf7b825, 0, 1.1);
      row(L, 'rope', G, 0, 12.2, 7.8, 0.1, 7.8, 0.1, ROPE);
      row(L, 'plank', G, 0, 7.6, 7.8, 2.2, 2.0, 2.2, 0x1ca89c);
      row(L, 'cloth', G, 0, 7.6, 7.8, 2.3, 0.5, 2.3, 0xf7b825);
      continue;
    }
    if (!blocked(x - wx, z - wz, 1.5)) {
      PROPS[pick(QUAY, hash(hh, 2))](L, G, hash(hh, 6));
    }
    if (i % 3 === 0) {
      addWallMural(L, G, 0, 7.8, 5.2, 3.8, hh);
    }
  }

  // ---- 8. Town Walls: giant festival hangings & painted murals all the way round (inside faces)
  for (const [wx, wz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 0; i < 13; i++) {
    const along = -114 + i * 19, x = wx ? wx * E : along, z = wz ? wz * E : along, hh = hash(i + 1, wx * 3 + wz * 7 + 2), G = frame(x, z, -wx, -wz);
    if (!((wx > 0 || wz > 0) && along > 58)) {
      PROPS.wallBanner(L, G, hh);
      if (i % 2 === 0) addWallMural(L, G, 9.5, 8.2, 5.6, 4.0, hash(hh, 9));
    }
  }

  // ---- 9. Tethered Festival Hot-Air Balloons in the skyline (visible from rooftop, pool, plaza & street views)
  addFestivalBalloon(L, 16, 30.5, -24, 0xe84234, 0xf7b825);
  addFestivalBalloon(L, -22, 32.0, -18, 0x1ca89c, 0xfff3d6);
  addFestivalBalloon(L, 28, 29.5, -68, 0x7848c8, 0xf7b825);
  addFestivalBalloon(L, -48, 33.5, -52, 0x2e78e6, 0xe84234);
  addFestivalBalloon(L, 108, 31.0, 104, 0xff5436, 0xf7b825);

  const counts = {}; let total = 0; for (const [n, l] of Object.entries(L)) { counts[n] = l.length; total += l.length; }
  counts.total = total;
  return { lists: L, counts };
}

function zToSeed(z) { return z * 1.37 + 19.1; }

// ------------------------------------------------------------------------------------------------ the build
/** Instanced meshes for the plan, added to `root`. Returns { group, counts, drawCalls }. */
export function buildDressing(THREE, city, kit, root, opts = {}) {
  const { toon, glowMat, T } = kit, plan = planDressing(city, opts), group = new THREE.Group(); group.name = 'dressing';
  const geos = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), ball: new THREE.SphereGeometry(1, 8, 6), bud: new THREE.SphereGeometry(1, 6, 4), cone: new THREE.ConeGeometry(0.5, 1, 10) };
  const mats = {
    timber: toon(0xffffff, { map: T.wood, uv: 0.6, rim: 0.3 }), plank: toon(0xffffff, { map: T.wood, uv: 0.9 }), iron: toon(0xffffff, { rim: 0.8 }), stone: toon(0xffffff, { map: T.stone, uv: 0.9 }),
    cloth: toon(0xffffff, { rim: 0.2, side: THREE.DoubleSide }), tile: toon(0xffffff, { map: T.tiles, uv: 1.1 }), cream: toon(0xffffff), glow: glowMat(0xffffff),
    barrel: toon(0xffffff, { map: T.wood }), timberCyl: toon(0xffffff, { map: T.wood, rim: 0.3 }), terra: toon(0xffffff, { rim: 0.5 }), rope: toon(0xffffff, { rim: 0.3 }),
    leaf: toon(0xffffff, { rim: 0.9 }), bloom: toon(0xffffff),
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color(), EU = new THREE.Euler(0, 0, 0, 'YXZ');
  let drawCalls = 0;
  for (const [name, list] of Object.entries(plan.lists)) {
    if (!list.length) continue;
    const def = LISTS[name], im = new THREE.InstancedMesh(geos[def.geo], mats[def.mat], list.length);
    list.forEach((e, i) => {
      Q.setFromEuler(EU.set(e[9] || 0, e[7] || 0, e[8] || 0)); M.compose(P.set(e[0], e[1], e[2]), Q, S.set(e[3], e[4], e[5])); im.setMatrixAt(i, M);
      im.setColorAt(i, Array.isArray(e[6]) ? C.setRGB(...e[6]) : C.setHex(e[6]));
    });
    const small = name === 'bloom' || name === 'glass' || name === 'rope' || name === 'iron';
    im.castShadow = !small; im.receiveShadow = name !== 'glass'; im.frustumCulled = false; im.name = 'dress:' + name; group.add(im); drawCalls++;
  }
  root.add(group);
  return { group, counts: plan.counts, drawCalls };
}

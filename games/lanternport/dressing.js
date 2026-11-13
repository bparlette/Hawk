// Lanternport set dressing: everything that makes the town look lived-in, layered on top of the city view.
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
//   * ground props hug a wall (within GROUND_REACH of it) or stand in a park corner, so walks and roads stay clear;
//   * nothing is placed inside opts.keepOut discs ([x, z, r] in metres: the staged scene sets);
//   * the stage roof (the rooftop pool) and the lamp-mission terraces get no rooftop dressing.
import { EDGE, WALK } from './sim.js';

export const U = 0.01;
export const GROUND_REACH = 1.25;            // metres a ground prop may stand out from the wall it hugs
const TAU = Math.PI * 2;
const PLASTER = [0xf6e7c8, 0xf2c9a4, 0xcfe0ee, 0xd3e6c4, 0xefc9d6], ROOFS = [0xc8553a, 0x3c8f8a, 0x77529c, 0xd9922e], SHUTTER = [0x3f6b5c, 0x8a3b32, 0x2f4f7a, 0x6b4a2e];
const BLOOMS = [0xff7aa8, 0xffd04a, 0xffffff, 0xf26b4a, 0xb69cff], LEAVES = [0x2f6b2a, 0x3f8a34, 0x5aa83e, 0x86c44a], CLOTH = [0xe2573f, 0xf2b23a, 0x3fa7a0, 0xf4ead8, 0x7d5bb5, 0x5aa9e6];
const TIMBER = 0x5a3b2a, PLANK = 0xc89a62, IRON = 0x2e2a38, STONE = 0xc9c0b4, TERRA = 0xc8744a, ROPE = 0xcdb27a, SAIL = 0xf1e7d0;
const LIT = [3.4, 2.2, 0.85], DARK = [0.2, 0.34, 0.6];

/** Deterministic 0..1 from two numbers (position / index + salt). */
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const pick = (arr, h) => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

/** Which geometry + material each list is drawn with (buildDressing reads this; add a list = add a line). */
export const LISTS = {
  timber: { geo: 'box', mat: 'timber' },       // dark structural wood: posts, brackets, frames
  plank: { geo: 'box', mat: 'plank' },         // tinted boards: crates, benches, signs, carts
  iron: { geo: 'box', mat: 'iron' },           // railings, pipes, anchors
  stone: { geo: 'box', mat: 'stone' },         // planters, kerbs, bases
  cloth: { geo: 'box', mat: 'cloth' },         // tinted flat cloth: laundry, banners, pennants, nets
  tile: { geo: 'box', mat: 'tile' },           // tinted roof tile: dormer caps, canopies
  cream: { geo: 'box', mat: 'cream' },         // window frames, trims
  glass: { geo: 'box', mat: 'glow' },          // lit / dark panes (HDR colour rows)
  barrel: { geo: 'cyl', mat: 'barrel' },       // barrels, tubs, kegs
  pole: { geo: 'cyl', mat: 'timberCyl' },      // masts, spars, round posts
  pot: { geo: 'cyl', mat: 'terra' },           // terracotta pots, chimney pots, bollards (tinted)
  rope: { geo: 'cyl', mat: 'rope' },           // rope coils, furled sails (tinted)
  leaf: { geo: 'ball', mat: 'leaf' },          // shrubs, ivy, topiary (tinted)
  bloom: { geo: 'bud', mat: 'bloom' },         // flowers, fruit, sacks, floats (tinted)
  spire: { geo: 'cone', mat: 'leaf' },         // cone trees
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
    const c = pick([0x7a4a30, 0x3f6b5c, 0x2f4f7a, 0x8a3b32], h);
    row(L, 'plank', F, 0, 0.47, 0.5, 1.7, 0.08, 0.46, c); row(L, 'plank', F, 0, 0.86, 0.3, 1.7, 0.42, 0.07, c);
    for (const s of [-1, 1]) { row(L, 'iron', F, s * 0.72, 0.23, 0.5, 0.07, 0.46, 0.42, IRON); row(L, 'iron', F, s * 0.72, 0.72, 0.3, 0.07, 0.72, 0.07, IRON); }
  },
  planter(L, F, h) {
    row(L, 'stone', F, 0, 0.28, 0.45, 1.5, 0.56, 0.55, h < 0.5 ? STONE : 0xa98a6a); row(L, 'timber', F, 0, 0.57, 0.45, 1.56, 0.06, 0.61, TIMBER);
    for (let q = -1; q <= 1; q++) {
      row(L, 'leaf', F, q * 0.45, 0.82, 0.45, 0.36, 0.3 + hash(h, q) * 0.14, 0.3, pick(LEAVES, hash(h, q + 5)));
      row(L, 'bloom', F, q * 0.45 + 0.12, 1.02 + hash(q, h) * 0.08, 0.52, 0.11, 0.1, 0.11, pick(BLOOMS, hash(h, q + 9)));
      row(L, 'bloom', F, q * 0.45 - 0.14, 0.95, 0.62, 0.09, 0.08, 0.09, pick(BLOOMS, hash(h, q + 13)));
    }
  },
  barrels(L, F, h) {
    row(L, 'barrel', F, -0.42, 0.48, 0.45, 0.78, 0.96, 0.78, 0xb07a45); row(L, 'barrel', F, 0.42, 0.48, 0.5, 0.74, 0.96, 0.74, 0x9a6a3f);
    if (h > 0.4) row(L, 'barrel', F, 0, 1.22, 0.47, 0.6, 0.5, 0.6, 0xb98a55);
    if (h > 0.7) { row(L, 'bloom', F, 0.42, 1.0, 0.5, 0.26, 0.12, 0.26, 0x7fb5d6); }                                   // a lid full of water
  },
  crates(L, F, h) {
    row(L, 'plank', F, 0, 0.42, 0.52, 0.84, 0.84, 0.84, 0xd9a25e); row(L, 'plank', F, 0.08, 1.14, 0.5, 0.6, 0.6, 0.6, 0xc48d4c);
    for (const s of [-1, 1]) row(L, 'timber', F, s * 0.36, 0.42, 0.95, 0.1, 0.86, 0.04, TIMBER);
    row(L, 'bloom', F, 0.82, 0.3, 0.5, 0.42, 0.3, 0.38, 0xd8c7a0); if (h > 0.5) row(L, 'bloom', F, 0.95, 0.72, 0.45, 0.36, 0.26, 0.34, 0xcbb890); // grain sacks
  },
  pottedTree(L, F, h) {
    row(L, 'pot', F, 0, 0.3, 0.5, 0.72, 0.6, 0.72, TERRA); row(L, 'pole', F, 0, 0.95, 0.5, 0.1, 0.9, 0.1, 0x6b4a33);
    if (h < 0.5) { row(L, 'spire', F, 0, 2.05, 0.5, 0.95, 1.9, 0.95, pick(LEAVES, h * 2)); }
    else { row(L, 'leaf', F, 0, 1.75, 0.5, 0.55, 0.55, 0.55, pick(LEAVES, h)); row(L, 'leaf', F, 0, 2.45, 0.5, 0.38, 0.38, 0.38, pick(LEAVES, hash(h, 3))); }
  },
  cart(L, F, h) {
    const c = pick([0x3f6b5c, 0x8a3b32, 0x2f4f7a, 0xd9922e], h);
    row(L, 'plank', F, 0, 0.78, 0.68, 1.7, 0.12, 0.9, 0xc89a62); for (const s of [-1, 1]) row(L, 'plank', F, 0, 0.98, 0.68 + s * 0.42, 1.7, 0.3, 0.06, c);
    for (const s of [-1, 1]) { row(L, 'plank', F, s * 0.84, 0.98, 0.68, 0.06, 0.3, 0.9, c); row(L, 'bloom', F, 0.35, 0.5, 0.68 + s * 0.5, 0.5, 0.5, 0.06, TIMBER); row(L, 'bloom', F, 0.35, 0.5, 0.68 + s * 0.53, 0.1, 0.1, 0.05, 0xd9a25e); }
    row(L, 'timber', F, -1.25, 0.86, 0.3, 1.0, 0.06, 0.06, TIMBER); row(L, 'timber', F, -1.25, 0.86, 1.06, 1.0, 0.06, 0.06, TIMBER); row(L, 'timber', F, -0.75, 0.4, 0.68, 0.08, 0.8, 0.08, TIMBER);
    for (let q = 0; q < 5; q++) row(L, 'bloom', F, -0.6 + q * 0.3, 1.0 + hash(h, q) * 0.1, 0.5 + hash(q, h) * 0.36, 0.17, 0.15, 0.17, pick([0xf2893a, 0xd9453a, 0x6fbf5a, 0xf2c94c], hash(h, q + 2))); // produce
  },
  noticeBoard(L, F, h) {
    for (const s of [-1, 1]) row(L, 'timber', F, s * 0.75, 1.1, 0.3, 0.1, 2.2, 0.1, TIMBER);
    row(L, 'plank', F, 0, 1.45, 0.3, 1.5, 1.0, 0.06, 0xb58a5a); row(L, 'tile', F, 0, 2.08, 0.3, 1.8, 0.1, 0.34, pick(ROOFS, h));
    for (let q = 0; q < 4; q++) row(L, 'cream', F, -0.48 + q * 0.32, 1.3 + hash(h, q) * 0.3, 0.345, 0.24, 0.3, 0.02, pick([0xf4ead8, 0xf2e2a8, 0xdfe9f2], hash(q, h)));
  },
  lobsterPots(L, F, h) {
    for (let q = 0; q < 3; q++) { row(L, 'plank', F, -0.6 + q * 0.6, 0.22, 0.45, 0.52, 0.44, 0.6, 0xb58a5a); row(L, 'cloth', F, -0.6 + q * 0.6, 0.22, 0.76, 0.46, 0.36, 0.02, ROPE); }
    row(L, 'plank', F, -0.3, 0.66, 0.45, 0.52, 0.44, 0.6, 0xc49a66); if (h > 0.4) row(L, 'plank', F, 0.3, 0.66, 0.45, 0.52, 0.44, 0.6, 0xa87f52);
    row(L, 'rope', F, 0.95, 0.09, 0.55, 0.6, 0.18, 0.6, ROPE); row(L, 'bloom', F, 1.0, 0.36, 0.5, 0.2, 0.2, 0.2, pick([0xe2573f, 0xf2b23a, 0x5aa9e6], h)); // coil + float
  },
  netRack(L, F, h) {
    for (const s of [-1, 1]) row(L, 'pole', F, s * 1.3, 1.25, 0.4, 0.1, 2.5, 0.1, TIMBER);
    row(L, 'pole', F, 0, 2.45, 0.4, 0.07, 2.8, 0.07, TIMBER, Math.PI / 2); row(L, 'cloth', F, 0, 1.55, 0.4, 2.5, 1.7, 0.03, h < 0.5 ? 0xb9a57a : 0x9fb0a0);
    for (let q = 0; q < 4; q++) row(L, 'bloom', F, -0.9 + q * 0.6, 0.78, 0.43, 0.11, 0.11, 0.11, pick([0xe2573f, 0xf2b23a, 0xf4ead8], hash(h, q)));
  },
  anchor(L, F) {
    row(L, 'iron', F, 0, 0.75, 0.22, 0.12, 1.5, 0.12, IRON, 0.12); row(L, 'iron', F, 0, 1.3, 0.22, 0.7, 0.1, 0.1, IRON, 0.12); row(L, 'iron', F, 0.05, 0.2, 0.22, 0.9, 0.12, 0.12, IRON, 0.12);
    for (const s of [-1, 1]) row(L, 'iron', F, 0.05 + s * 0.45, 0.36, 0.22, 0.12, 0.34, 0.12, IRON, -s * 0.5);
  },
  bollard(L, F) {
    row(L, 'pot', F, 0, 0.35, 0.6, 0.36, 0.7, 0.36, 0x3a3644); row(L, 'pot', F, 0, 0.74, 0.6, 0.5, 0.12, 0.5, 0x3a3644); row(L, 'rope', F, 0, 0.3, 0.6, 0.52, 0.2, 0.52, ROPE);
  },
};
const STREET = ['bench', 'planter', 'barrels', 'crates', 'pottedTree', 'cart', 'noticeBoard', 'planter', 'pottedTree'];
const ALLEY = ['barrels', 'crates'];
const QUAY = ['lobsterPots', 'netRack', 'barrels', 'crates', 'anchor', 'bollard', 'lobsterPots', 'bollard'];

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
  const quayside = (x, z) => x > 60 && z > 60;                         // the harbour quarter of town
  let k = 0;
  for (const b of city.boxes) {
    if (b.kind !== 'house') continue;
    const w = (b.x1 - b.x0) * U, h = (b.y1 - b.y0) * U, d = (b.z1 - b.z0) * U, cx = ((b.x0 + b.x1) / 2) * U, cz = ((b.z0 + b.z1) / 2) * U;
    const blk = blockOf((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), tall = h >= 7.5, top = tall ? h - 2.2 : h, roofC = ROOFS[b.roof], shutC = SHUTTER[(b.roof + b.hue) % 4];
    const seed = hash(cx, cz), terraces = blk && blk.kind === 'steps', isStage = b === roof;
    const faces = [[0, 1, w, d], [0, -1, w, d], [1, 0, d, w], [-1, 0, d, w]];
    faces.forEach(([nx, nz, span, depth], f) => {
      if (terraces) return;                                             // the lamp-mission staircase stays bare: it is a climbing route
      const F = frame(cx + nx * depth / 2, cz + nz * depth / 2, nx, nz), fh = hash(seed, f + 1);
      const outer = blk && (nx > 0 ? Math.abs(b.x1 - (blk.x1 - WALK)) < 2 : nx < 0 ? Math.abs(b.x0 - (blk.x0 + WALK)) < 2 : nz > 0 ? Math.abs(b.z1 - (blk.z1 - WALK)) < 2 : Math.abs(b.z0 - (blk.z0 + WALK)) < 2);
      const doorFace = f === k % 4 && h > 3, shop = doorFace && k % 2 === 0 && span > 9.5;        // mirrors view.js so nothing lands on a door
      const nWin = Math.max(1, Math.floor((span - 1.6) / 2.7)), rows = Math.max(0, Math.floor((top - 1.0 - 2.0) / 2.9) + 1);
      // ---- wall-mounted: drainpipe, ivy, balcony, hanging sign, door canopy
      if (f % 2 === 0 && h > 3) { row(L, 'iron', F, -span / 2 + 0.42, top / 2, 0.09, 0.12, top, 0.12, IRON); row(L, 'iron', F, -span / 2 + 0.42, top - 0.2, 0.12, 0.26, 0.3, 0.2, IRON); }
      if (fh < 0.34 && h > 3 && !terraces) {
        const side = fh < 0.17 ? 1 : -1, n = 8 + Math.floor(top * 1.1), reach = Math.min(top * 0.82, 3 + fh * 30);
        for (let q = 0; q < n; q++) {
          const u = q / n, t = side * (span / 2 - 0.5 - hash(q, fh) * (1.1 + u * 1.6)), y = 0.3 + u * reach + hash(fh, q) * 0.4, s = 0.42 + hash(q, f) * 0.34;
          row(L, 'leaf', F, t, y, 0.1, s, s * 0.9, 0.2, pick(LEAVES, hash(q, seed)));
        }
      }
      if (outer && rows >= 2 && fh > 0.45 && !terraces) {
        const col = Math.floor(hash(fh, 7) * nWin), t = (col - (nWin - 1) / 2) * 2.7, y = 2.0 + 2.9 * (rows >= 3 && fh > 0.75 ? 2 : 1);
        row(L, 'stone', F, t, y - 0.98, 0.42, 2.1, 0.12, 0.84, 0xd8cdbc);
        for (const s of [-1, 1]) { row(L, 'timber', F, t + s * 0.8, y - 1.2, 0.3, 0.12, 0.34, 0.5, TIMBER); row(L, 'iron', F, t + s * 1.0, y - 0.5, 0.42, 0.05, 0.86, 0.8, IRON); }
        row(L, 'iron', F, t, y - 0.06, 0.8, 2.05, 0.06, 0.06, IRON); for (let q = -3; q <= 3; q++) row(L, 'iron', F, t + q * 0.31, y - 0.5, 0.8, 0.04, 0.86, 0.04, IRON);
        for (const s of [-1, 1]) { row(L, 'pot', F, t + s * 0.6, y - 0.8, 0.62, 0.26, 0.24, 0.26, TERRA); row(L, 'leaf', F, t + s * 0.6, y - 0.58, 0.62, 0.2, 0.2, 0.2, pick(LEAVES, hash(fh, s))); row(L, 'bloom', F, t + s * 0.6, y - 0.42, 0.66, 0.1, 0.1, 0.1, pick(BLOOMS, hash(s, fh))); }
      }
      if (doorFace && !shop) {
        row(L, 'iron', F, -1.9, 3.5, 0.5, 0.06, 0.06, 1.0, IRON); row(L, 'iron', F, -1.9, 3.28, 0.2, 0.05, 0.5, 0.05, IRON, 0, 0.5);
        const sc = pick([0x8a3b32, 0x2f4f7a, 0x3f6b5c, 0xd9922e, 0x77529c], fh);
        row(L, 'plank', F, -1.9, 3.02, 0.62, 0.08, 0.72, 0.66, sc); row(L, 'cream', F, -1.9, 3.02, 0.62, 0.1, 0.56, 0.5, 0xf1e6d2);
        for (const s of [-1, 1]) row(L, 'bloom', F, -1.9 + s * 0.06, 3.02, 0.62, 0.03, 0.2, 0.2, sc);                       // painted roundel, both sides
        if (fh > 0.4) { row(L, 'tile', F, 0, 2.86, 0.5, 2.1, 0.1, 1.0, roofC); for (const s of [-1, 1]) row(L, 'timber', F, s * 0.95, 2.6, 0.45, 0.07, 0.07, 0.95, TIMBER, 0, 0.5); }
        for (const s of [-1, 1]) { row(L, 'pot', F, s * 1.0, 0.24, 0.42, 0.42, 0.48, 0.42, TERRA); row(L, 'leaf', F, s * 1.0, 0.62, 0.42, 0.3, 0.3, 0.3, pick(LEAVES, hash(fh, s + 2))); row(L, 'bloom', F, s * 1.0 + 0.08, 0.86, 0.46, 0.1, 0.1, 0.1, pick(BLOOMS, hash(s + 3, fh))); }
      }
      // ---- on the ground, hugging this wall
      if (h > 3 && !terraces) {
        const kit = !outer ? ALLEY : quayside(cx, cz) ? [...QUAY, ...STREET] : STREET, clearDoor = doorFace ? (shop ? 5.3 : 2.5) : 0;
        const slots = outer ? Math.max(1, Math.floor(span / 4.6)) : 1;
        for (let s = 0; s < slots; s++) {
          const ph = hash(fh, s + 11); if (ph < (outer ? 0.22 : 0.6)) continue;
          const t = slots === 1 ? (hash(fh, 3) - 0.5) * (span - 4) : -span / 2 + 1.7 + (s + 0.5) * ((span - 3.4) / slots) + (hash(s, fh) - 0.5) * 0.8;
          if (Math.abs(t) < clearDoor || Math.abs(t) > span / 2 - 1.3) continue;
          const p = F.P(t, 0, 0.6); if (blocked(p[0], p[2], 1.2) || nearCrate(p[0], p[2])) continue;
          const G = frame(F.P(t, 0, 0)[0], F.P(t, 0, 0)[2], nx, nz);
          PROPS[pick(kit, hash(ph, 5))](L, G, hash(ph, 9));
        }
      }
    });
    // ---- rooftops
    if (!isStage && !terraces && h > 3) {
      if (tall) {
        faces.forEach(([nx, nz, span, depth], f) => {                                                       // dormers on the mansard
          const F = frame(cx + nx * depth / 2, cz + nz * depth / 2, nx, nz), n = Math.floor((span - 2) / 4.4); if (n < 1) return;
          for (let i = 0; i < n; i++) {
            const t = (i - (n - 1) / 2) * 4.4, y = top + 1.0;
            row(L, 'cream', F, t, y, -0.5, 1.2, 1.3, 1.0, PLASTER[b.hue]); row(L, 'glass', F, t, y + 0.05, 0.015, 0.8, 0.9, 0.04, hash(seed, f * 9 + i) < 0.35 ? LIT : DARK);
            row(L, 'cream', F, t, y + 0.05, 0.0, 0.98, 1.08, 0.05, 0xf1e6d2); row(L, 'tile', F, t, y + 0.74, -0.42, 1.5, 0.16, 1.3, roofC); row(L, 'timber', F, t, y - 0.6, 0.02, 1.3, 0.1, 0.16, TIMBER);
          }
        });
      }
      const x0 = cx - w / 2 + (tall ? 1.5 : 0.7), x1 = cx + w / 2 - (tall ? 1.5 : 0.7), z0 = cz - d / 2 + (tall ? 1.5 : 0.7), z1 = cz + d / 2 - (tall ? 1.5 : 0.7), y = h;
      if (x1 - x0 > 2.5 && z1 - z0 > 2.5) {
        const kit = Math.floor(seed * 4), flat = !tall;
        // a second chimney stack with pots, on every roof
        const qx = hash(seed, 21) < 0.5 ? x0 + 0.3 : x1 - 0.3, qz = hash(seed, 22) < 0.5 ? z0 + 0.4 : z1 - 0.4;
        L.stone.push([qx, y + 0.7, qz, 1.1, 1.4, 0.7, 0xa85a42, 0, 0, 0]); L.timber.push([qx, y + 1.44, qz, 1.26, 0.1, 0.86, TIMBER, 0, 0, 0]);
        for (const s of [-1, 1]) L.pot.push([qx + s * 0.28, y + 1.7, qz, 0.3, 0.44, 0.3, TERRA, 0, 0, 0]);
        if (kit === 0) {                                                                                       // roof garden
          const n = Math.max(1, Math.floor((x1 - x0) / 2.2));
          for (let i = 0; i < n; i++) PROPS.planter(L, frame(x0 + (i + 0.5) * ((x1 - x0) / n), z0 - 0.2, 0, 1, y), hash(seed, i + 30));
          if (!flat) for (const [fx, fz] of [[x0 + 0.5, z1 - 0.6], [x1 - 0.5, z1 - 0.6]]) { L.pot.push([fx, y + 0.3, fz, 0.7, 0.6, 0.7, TERRA, 0, 0, 0]); L.spire.push([fx, y + 1.5, fz, 0.9, 1.8, 0.9, pick(LEAVES, hash(fx, fz)), 0, 0, 0]); }
        } else if (kit === 1) {                                                                                // washing line
          const zz = flat ? z1 - 0.3 : (z0 + z1) / 2 + 0.6, len = x1 - x0 - 0.6, n = Math.max(3, Math.floor(len / 0.75));
          for (const s of [-1, 1]) L.pole.push([cx + s * len / 2, y + 1.05, zz, 0.09, 2.1, 0.09, TIMBER, 0, 0, 0]);
          L.rope.push([cx, y + 2.02, zz, 0.035, len, 0.035, ROPE, 0, Math.PI / 2, 0]);
          for (let i = 0; i < n; i++) { const ch = hash(seed, i + 40), hh = 0.55 + ch * 0.5; L.cloth.push([cx - len / 2 + (i + 0.5) * (len / n), y + 2.0 - hh / 2, zz, 0.5 + hash(i, seed) * 0.2, hh, 0.03, pick([0xf4ead8, 0xe2573f, 0x5aa9e6, 0xf2b23a, 0xdfe9f2, 0x7d5bb5], ch), 0, 0, 0]); }
        } else if (kit === 2) {                                                                                // water tank on a stand
          const tx = flat ? x1 - 0.5 : cx + (hash(seed, 50) - 0.5) * (x1 - x0 - 2.4), tz = flat ? z0 + 0.5 : cz + (hash(seed, 51) - 0.5) * (z1 - z0 - 2.4);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.timber.push([tx + sx * 0.5, y + 0.6, tz + sz * 0.5, 0.12, 1.2, 0.12, TIMBER, 0, 0, 0]);
          L.plank.push([tx, y + 1.24, tz, 1.4, 0.1, 1.4, PLANK, 0, 0, 0]); L.barrel.push([tx, y + 2.0, tz, 1.35, 1.45, 1.35, 0xa8763e, 0, 0, 0]); L.spire.push([tx, y + 3.0, tz, 1.6, 0.6, 1.6, 0x6b4a33, 0, 0, 0]);
        } else {                                                                                               // dovecote + weathervane
          const tx = flat ? x0 + 0.6 : cx + (hash(seed, 60) - 0.5) * (x1 - x0 - 2), tz = flat ? z1 - 0.5 : cz + (hash(seed, 61) - 0.5) * (z1 - z0 - 2);
          L.pole.push([tx, y + 0.9, tz, 0.12, 1.8, 0.12, TIMBER, 0, 0, 0]); L.cream.push([tx, y + 2.1, tz, 0.8, 0.7, 0.8, 0xf4ead8, 0, 0, 0]); L.tile.push([tx, y + 2.52, tz, 1.05, 0.14, 1.05, roofC, 0, 0, 0]);
          for (const s of [-1, 1]) L.glass.push([tx + s * 0.2, y + 2.12, tz + 0.41, 0.16, 0.22, 0.02, DARK, 0, 0, 0]);
          const vx = flat ? x1 - 0.4 : tx + 1.4, vz = flat ? z0 + 0.4 : tz;
          L.iron.push([vx, y + 1.1, vz, 0.05, 2.2, 0.05, IRON, 0, 0, 0]); L.iron.push([vx, y + 1.9, vz, 0.8, 0.04, 0.04, IRON, seed * TAU, 0, 0]); L.iron.push([vx, y + 1.9, vz, 0.04, 0.04, 0.8, IRON, seed * TAU, 0, 0]);
          L.cloth.push([vx, y + 2.25, vz, 0.55, 0.3, 0.03, 0xf2b23a, seed * TAU + 0.6, 0, 0]);
        }
      }
    }
    k++;
  }

  // ---- hanging flower baskets on the street lamps (same positions the city view computes)
  for (const b of city.blocks) for (const [fx, fz] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) {
    const x = (b.x0 + 45 + fx * (b.x1 - b.x0 - 90)) * U, z = (b.z0 + 45 + fz * (b.z1 - b.z0 - 90)) * U, ox = fx === 0 ? -1 : fx === 1 ? 1 : 0, oz = ox ? 0 : fz === 0 ? -1 : 1, hh = hash(x, z);
    L.iron.push([x - ox * 0.25, 3.25, z - oz * 0.25, ox ? 0.5 : 0.05, 0.05, oz ? 0.5 : 0.05, IRON, 0, 0, 0]);
    L.pot.push([x - ox * 0.45, 2.92, z - oz * 0.45, 0.36, 0.22, 0.36, 0x6b4a33, 0, 0, 0]); L.leaf.push([x - ox * 0.45, 3.05, z - oz * 0.45, 0.3, 0.2, 0.3, pick(LEAVES, hh), 0, 0, 0]);
    for (let q = 0; q < 4; q++) { const a = q * 1.57 + hh * 6; L.bloom.push([x - ox * 0.45 + Math.cos(a) * 0.2, 3.1 + hash(q, hh) * 0.1, z - oz * 0.45 + Math.sin(a) * 0.2, 0.1, 0.1, 0.1, pick(BLOOMS, hash(hh, q)), 0, 0, 0]); }
    L.leaf.push([x - ox * 0.45, 2.72, z - oz * 0.45, 0.13, 0.26, 0.13, LEAVES[2], 0, 0, 0]);
  }

  // ---- parks and plazas: festival banner poles and flower beds at the lawn corners, benches round the fountain
  for (const b of city.blocks) {
    if (b.kind !== 'plaza' && b.kind !== 'hideout' && b.kind !== 'docks') continue;
    const quay = b.kind === 'docks';
    for (const [fx, fz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const x = (b.x0 + 330 + fx * (b.x1 - b.x0 - 660)) * U, z = (b.z0 + 330 + fz * (b.z1 - b.z0 - 660)) * U, hh = hash(x, z);
      if (blocked(x, z, 1.5)) continue;
      const c = pick(CLOTH, hh), ry = Math.atan2(fx - 0.5, fz - 0.5);
      L.stone.push([x, 0.2, z, 0.9, 0.4, 0.9, STONE, ry, 0, 0]); L.pole.push([x, 3.4, z, 0.14, 6.8, 0.14, quay ? TIMBER : 0xf4ead8, 0, 0, 0]); L.bloom.push([x, 6.9, z, 0.2, 0.2, 0.2, 0xf2b23a, 0, 0, 0]);
      L.timber.push([x + Math.cos(ry) * 0.45, 6.3, z - Math.sin(ry) * 0.45, 1.0, 0.07, 0.07, TIMBER, ry, 0, 0]);
      L.cloth.push([x + Math.cos(ry) * 0.5, 4.75, z - Math.sin(ry) * 0.5, 0.8, 3.0, 0.04, c, ry, 0, 0]); L.cloth.push([x + Math.cos(ry) * 0.5, 3.4, z - Math.sin(ry) * 0.5, 0.8, 0.22, 0.05, 0xf2b23a, ry, 0, 0]);
      for (let q = 0; q < 9; q++) { const a = q * 0.7 + hh * 6, r = 0.75 + hash(q, hh) * 0.5; L.bloom.push([x + Math.cos(a) * r, 0.28 + hash(hh, q) * 0.14, z + Math.sin(a) * r, 0.13, 0.12, 0.13, pick(BLOOMS, hash(q, x)), 0, 0, 0]); L.leaf.push([x + Math.cos(a + 0.3) * r, 0.16, z + Math.sin(a + 0.3) * r, 0.24, 0.16, 0.24, pick(LEAVES, hash(z, q)), 0, 0, 0]); }
    }
  }
  if (city.fountain) {
    const fx = city.fountain.x * U, fz = city.fountain.z * U;
    for (let q = 0; q < 8; q++) {
      const a = q * (TAU / 8) + 0.39, x = fx + Math.sin(a) * 6.3, z = fz + Math.cos(a) * 6.3;
      if (blocked(x, z, 1.4)) continue;
      const G = frame(x + Math.sin(a) * 0.5, z + Math.cos(a) * 0.5, -Math.sin(a), -Math.cos(a));
      if (q % 2) PROPS.bench(L, G, hash(q, 3)); else PROPS.pottedTree(L, G, hash(q, 5));
    }
  }

  // ---- the harbour: moored ships show their masts over the sea walls, and the quay corner is stacked with gear
  const E = EDGE * U, seaWalls = [[1, 0], [0, 1]];
  for (const [wx, wz] of seaWalls) for (let i = 0; i < 5; i++) {
    const along = 44 + i * 19 + hash(i, wx * 3 + wz) * 6, hh = hash(i + 1, wx * 7 + wz * 13), x = wx ? E + 10 + hh * 5 : along, z = wz ? E + 10 + hh * 5 : along, ry = wx ? 0 : Math.PI / 2;
    const masts = hh > 0.35 ? 2 : 1;
    for (let m = 0; m < masts; m++) {
      const off = (m - (masts - 1) / 2) * 7.5, mx = x + (wz ? off : 0), mz = z + (wx ? off : 0), H = 27 + hash(hh, m) * 7 - m * 3;
      L.pole.push([mx, H / 2, mz, 0.5, H, 0.5, 0x6b4a33, 0, 0, 0]); L.pole.push([mx, H - 5.2, mz, 1.5, 0.9, 1.5, 0x5a3b2a, 0, 0, 0]);                       // mast + crow's nest
      for (const [yy, len] of [[H - 9.5, 9.5], [H - 4.0, 6.5]]) {
        L.pole.push([mx, yy, mz, 0.22, len, 0.22, 0x6b4a33, ry, 0, Math.PI / 2]);                                                                        // yard (lying along the wall)
        L.rope.push([mx, yy - 0.45, mz, 0.62, len * 0.9, 0.62, SAIL, ry, 0, Math.PI / 2]);                                                               // furled sail under it
      }
      L.cloth.push([mx + (wz ? 1.1 : 0), H + 0.2, mz + (wx ? 1.1 : 0), wx ? 0.05 : 2.2, 0.8, wx ? 2.2 : 0.05, pick(CLOTH, hash(hh, m + 4)), 0, 0, 0]); // pennant
      for (const s of [-1, 1]) L.rope.push([mx + (wz ? s * 2.6 : 0), H / 2 + 2.5, mz + (wx ? s * 2.6 : 0), 0.05, H - 4.2, 0.05, 0x8a7a5a, ry, 0, -s * Math.atan2(5.2, H - 5)]);  // shrouds
    }
    L.bloom.push([x - wx * 4.2, 15.9, z - wz * 4.2, 0.24, 0.16, 0.34, 0xf4f4f0, hh * 6, 0, 0]);                                                        // a gull on the battlement
  }
  // quay gear along the inside foot of the two sea walls, at the harbour corner only
  for (const [wx, wz] of seaWalls) for (let i = 0; i < 16; i++) {
    const along = 62 + i * 4.3, hh = hash(i + 3, wx * 5 + wz * 11);
    if (hh < 0.18) continue;
    const x = wx ? E : along, z = wz ? E : along; if (blocked(x - wx, z - wz, 1.5)) continue;
    const G = frame(x, z, -wx, -wz);
    PROPS[pick(QUAY, hash(hh, 2))](L, G, hash(hh, 6));
    if (i % 3 === 0) { row(L, 'cloth', G, 0.3, 4.6 + hh, 0.06, 3.4, 3.0, 0.03, i % 2 ? 0xb9a57a : 0x9fb0a0); row(L, 'bloom', G, -2.2, 3.2, 0.14, 0.42, 0.42, 0.1, 0xe2573f); row(L, 'bloom', G, -2.2, 3.2, 0.16, 0.24, 0.24, 0.1, 0xf4ead8); } // drying net + life ring on the wall
  }
  { // the cargo crane in the harbour corner: a timber post, a jib and a crate on a rope
    const x = E - 1.3, z = E - 1.3; L.stone.push([x, 0.3, z, 1.6, 0.6, 1.6, STONE, 0.78, 0, 0]); L.pole.push([x, 5.3, z, 0.5, 10, 0.5, TIMBER, 0, 0, 0]);
    L.pole.push([x - 2.3, 10.3, z - 2.3, 0.3, 8.6, 0.3, TIMBER, Math.PI / 4, 0, -1.05]); L.pole.push([x - 0.9, 8.0, z - 0.9, 0.2, 4.2, 0.2, TIMBER, Math.PI / 4, 0, 0.7]);
    L.rope.push([x - 4.9, 8.6, z - 4.9, 0.06, 6.6, 0.06, ROPE, 0, 0, 0]); L.plank.push([x - 4.9, 4.9, z - 4.9, 1.2, 1.2, 1.2, 0xd9a25e, 0.5, 0, 0]); L.rope.push([x - 4.9, 5.6, z - 4.9, 0.9, 0.12, 0.9, ROPE, 0, 0, 0]);
  }

  const counts = {}; let total = 0; for (const [n, l] of Object.entries(L)) { counts[n] = l.length; total += l.length; }
  counts.total = total;
  return { lists: L, counts };
}

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

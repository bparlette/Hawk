// props_crab_shack.js — Task B: the harbour crab shack / steamed-crab stand (merged static prop, ~4 x 3 m, front faces +Z).
// Weathered wood stand with a counter, chalkboard menu on an easel, a tin roof, a painted STEAMED CRABS board (canvas decal) and a neon CRABS
// sign built from stroke geometry that glows at night (dull tube colour by day), crab pots, barrels, buoys, harbour bunting and string
// lights. Real Baltimore flavour: steamed blue crabs, Old Bay, cold beer. Lettering is drawn from text on canvas or built from geometry.
// All geometry goes through `out` (no draw calls of its own); one lamp point is registered for the sign light. No imports; no Math.random.
export const META_CRAB_SHACK = { id: 'crab_shack', kind: 'prop', footprint: [4, 3], height: 4.1 };

const CS = {
  CURB: 0.16, WOOD: '#9a6a44', GREY: '#6f6a62', IRON: '#2c322e', CREAM: '#eae6dc',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'crab_shack'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  FONT: {
    A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
    C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
    S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]],
  },
};

export function buildCrabShack(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, C = K.CURB ?? CS.CURB, A = CS.atlas(K, opts), wood = opts.wood || CS.WOOD, teal = opts.paint || '#4f7a6a';
  const fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, C, z, ang); };
  const box = (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(CS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol);
  const cyl = (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz), col, !!o.ol);
  const sph = (r, ws, hs, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs), lx, ly, lz), col, !!o.ol);
  const toWorld = (lx, lz) => [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)];

  // deck, posts, walls
  box(4.0, 0.12, 3.0, 0, 0.06, 0, '#7a5a3a', { skip: 'ny', ol: true });
  // the tin roof is a 3.8 m slab tilted 0.1 rad down to the front; roofUnder(z) = its underside, so posts and the back wall meet it (fix m3)
  const roofUnder = (lz) => 2.82 - (lz - 0.2) * Math.tan(0.1) - 0.035 / Math.cos(0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const top = roofUnder(sz * 1.4), hh = top - 0.12; box(0.14, hh, 0.14, sx * 1.9, 0.12 + hh / 2, sz * 1.4, wood, { skip: 'ny', ol: true }); }
  { const top = roofUnder(-1.42) + 0.02, hh = top - 0.12; box(3.8, hh, 0.08, 0, 0.12 + hh / 2, -1.42, teal, { skip: 'ny nz' }); }
  for (const y of [0.5, 1.2, 1.9, 2.5]) box(3.8, 0.07, 0.04, 0, y, -1.36, csTone(teal, 0.7), { skip: 'ny nz' });
  for (const sx of [-1, 1]) box(0.08, 1.1, 2.8, sx * 1.9, 0.67, 0, teal, { skip: 'ny' });
  // counter with painted front, top slab and a steamer pot on it
  box(3.6, 0.95, 0.6, 0, 0.6, 1.1, CS.CREAM, { skip: 'ny', ol: true }); box(3.6, 0.2, 0.01, 0, 0.35, 1.405, '#2a3f6a', { skip: 'ny nz' });
  box(3.9, 0.07, 0.95, 0, 1.12, 1.15, wood, { skip: 'ny', ol: true });
  cyl(0.3, 0.28, 0.42, 8, -1.1, 1.36, 1.15, '#8a9094', { ol: true }); cyl(0.32, 0.32, 0.05, 8, -1.1, 1.6, 1.15, '#6f6a62'); cyl(0.2, 0.2, 0.3, 8, -0.4, 1.31, 1.15, '#8a9094');
  box(0.6, 0.3, 0.4, 0.9, 1.31, 1.15, '#c8302a', { skip: 'ny' });                                        // a crate of Old Bay tins
  // roof (tin, sloping toward the front) with a red fascia and a vent
  box(4.7, 0.07, 3.8, 0, 2.82, 0.2, CS.GREY, { skip: 'ny', rot: [0.1, 0, 0], ol: true }); box(4.7, 0.14, 0.07, 0, 2.62, 2.1, '#b8302a', { skip: 'ny' });
  cyl(0.07, 0.07, 0.5, 6, 1.4, 3.1, -0.6, CS.IRON, { open: true });
  // painted board + neon CRABS above it
  box(2.9, 1.08, 0.08, 0, 3.55, 1.45, '#2f5a3a', { skip: 'ny nz', ol: true });
  out.decal(fin(new THREE.PlaneGeometry(2.7, 2.7 * 96 / 256), 0, 3.55, 1.5), A, 'crab_sign');
  box(0.06, 0.8, 0.06, -1.2, 3.1, 1.4, wood, { skip: 'ny' }); box(0.06, 0.8, 0.06, 1.2, 3.1, 1.4, wood, { skip: 'ny' });
  const sc = 0.6 / 4, adv = 2 * sc + 0.14, word = 'CRABS', total = word.length * adv - 0.14; let px = -total / 2;
  const seg = (u0, y0, u1, y1, th, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    out.solid(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.52), dim, false); out.glow(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.54), bright);
  };
  // the neon's raceway: a dark backing rail standing on the board's top edge, so the tubes no longer float (fix m3)
  box(total + 0.3, 0.64, 0.05, 0, 4.42, 1.47, '#1a1626', { ol: true });
  for (const ch of word) { for (const pl of CS.FONT[ch]) for (let i = 0; i + 1 < pl.length; i++) seg(px + pl[i][0] * sc, 4.35 + pl[i][1] * sc - 0.3 + 0.0, px + pl[i + 1][0] * sc, 4.35 + pl[i + 1][1] * sc - 0.3, 0.08, '#8a3a30', '#ff3a1c'); px += adv; }
  // easel + chalkboard menu
  box(0.9, 1.08, 0.05, 2.25, 0.7, 1.3, '#22302a', { skip: 'ny nz', ol: true, rot: [-0.12, 0, 0] }); out.decal(fin(new THREE.PlaneGeometry(0.8, 1.0), 2.25, 0.72, 1.335, [-0.12, 0, 0]), A, 'crab_menu');
  for (const s of [-1, 1]) box(0.05, 1.2, 0.05, 2.25 + s * 0.38, 0.62, 1.0, wood, { skip: 'ny', rot: [0.25, 0, 0] });
  // crab pots (wire cages), barrels, buoys
  for (let i = 0; i < 3; i++) { cyl(0.34, 0.34, 0.5, 8, -2.65 + (i % 2) * 0.2, 0.37 + (i === 2 ? 0.5 : 0), i === 2 ? 0.0 : 0.4 - i * 0.2, '#3a3a40', { ol: true, open: false }); }
  for (const [bx, bz, bc] of [[2.3, -0.7, '#2a3f6a'], [2.45, -0.15, '#8a4a3a']]) { cyl(0.28, 0.28, 0.7, 8, bx, 0.47, bz, bc, { ol: true }); cyl(0.29, 0.29, 0.05, 8, bx, 0.62, bz, csTone(bc, 0.6)); }
  sph(0.14, 6, 4, -2.2, 0.28, 1.2, '#b8302a'); sph(0.14, 6, 4, -2.05, 0.28, 1.35, '#ffd23c'); sph(0.14, 6, 4, 2.15, 1.25, -0.4, '#2f5bd3');
  // harbour bunting along the eave and string lights under the roof
  const flag = ['#b8302a', '#ffd23c', '#2f5bd3', '#eae6dc', '#2f5a3a'];
  for (let i = 0; i < 12; i++) { const fx = -2.1 + i * 0.382; out.solid(fin(new THREE.CircleGeometry(0.11, 3).rotateZ(-Math.PI / 2), fx, 2.46 - Math.abs(Math.sin(i * 0.52)) * 0.05, 2.08), flag[i % 5], false); }
  for (let i = 0; i < 8; i++) out.glow(fin(new THREE.OctahedronGeometry(0.06, 0), -1.75 + i * 0.5, 2.5, 0.6 + (i % 2) * 0.1), '#ffd890');
  const [lx, lz] = toWorld(0, 1.7); out.lamp(lx, C + 3.2, lz);
  out.coll(csAabb(toWorld, -3.05, 2.8, -1.6, 1.75)); out.bld(Object.assign(csAabb(toWorld, -2.1, 2.1, -1.6, 1.75), { h: C + 4.1 })); // collider now covers the pots, barrels and easel (fix m3)
  return META_CRAB_SHACK;
}
function csAabb(toWorld, lx0, lx1, lz0, lz1) { const p = [toWorld(lx0, lz0), toWorld(lx1, lz0), toWorld(lx1, lz1), toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; }
function csTone(h, f) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''); }

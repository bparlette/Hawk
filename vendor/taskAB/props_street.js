// props_street.js — Task B: merged static street props (everything writes through `out`, so props add NO draw calls).
//   lamp_acorn · lamp_cobra · bench_park · bench_bus · trash_can (+ recycling variant) · manhole · ladder_wall · ladder_drop
// Signature of every piece: buildXxx(K, out, x, z, ang = 0, opts = {}) -> its entry of META_PROPS_STREET.pieces. The base sits on the pavement top
// (K.CURB) except the manhole, which is flush with the road (y 0.005). Facing is +Z rotated by ang. opts.atlas = the shared
// K.makeAtlas(PROP_TILES) (if omitted, the PROP_TILES global of the concatenated game build is used).
// Ink hulls only on major masses (<~4 cm parts have outline:false). Triangles below count the ink hulls too.
// No imports; no Math.random; materials only through out / K.
export const META_PROPS_STREET = {
  id: 'props_street', kind: 'prop',
  pieces: {
    lamp_acorn: { id: 'lamp_acorn', kind: 'prop', footprint: [0.5, 0.5], height: 4.9 }, lamp_cobra: { id: 'lamp_cobra', kind: 'prop', footprint: [0.4, 0.4], height: 7.4 },
    bench_park: { id: 'bench_park', kind: 'prop', footprint: [1.8, 0.6], height: 0.9 }, bench_bus: { id: 'bench_bus', kind: 'prop', footprint: [1.9, 0.6], height: 2.2 },
    trash_can: { id: 'trash_can', kind: 'prop', footprint: [0.7, 0.7], height: 0.95 }, manhole: { id: 'manhole', kind: 'prop', footprint: [0.9, 0.9], height: 0.01 },
    ladder_wall: { id: 'ladder_wall', kind: 'prop', footprint: [0.6, 0.3], height: 6 }, ladder_drop: { id: 'ladder_drop', kind: 'prop', footprint: [0.6, 0.3], height: 3.9 },
  },
};

// ---- local helpers (one namespace object so concatenated modules cannot collide) ----
// the prop atlas comes from tbPropAtlas (props_tiles.js): opts.atlas, then the game-owned K.propAtlas; no cache keyed on K (Grok QA), PROP_TILES guarded (fix m5)
const PS = {
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  CURB: 0.16, GREEN: '#2f4a3a', IRON: '#2c322e', WOOD: '#9a6a44',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'props_street'); },
  box(THREE, w, h, d, skip = '') { // BoxGeometry minus hidden faces (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  },
  kit(K, out, x, z, ang, y0) {
    const THREE = K.THREE, fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, y0, z, ang); };
    const S = {
      THREE, fin,
      box: (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(PS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol),
      cyl: (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz, o.rot), col, !!o.ol),
      sph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz, o.rot), col, !!o.ol),
      glowSph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col) => out.glow(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz), col),
      glowQuad: (w, h, lx, ly, lz, col, rot) => out.glow(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), col),
      decal: (atlas, tile, w, h, lx, ly, lz, rot) => out.decal(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), atlas, tile),
      world(lx, lz) { return [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)]; },
      aabb(lx0, lx1, lz0, lz1) { const p = [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]].map(([a, b]) => S.world(a, b)); return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    };
    return S;
  },
};

// ---------------------------------------------------------------- historic acorn street lamp
export function buildLampAcorn(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || PS.GREEN, GL = '#e8e0c8';
  S.box(0.46, 0.22, 0.46, 0, 0.11, 0, G, { skip: 'ny', ol: true });                          // plinth
  S.cyl(0.1, 0.2, 0.6, 8, 0, 0.52, 0, G, { open: true, ol: true });                         // fluted flare
  S.cyl(0.15, 0.15, 0.07, 8, 0, 0.86, 0, PS.tone(G, 1.3), { open: true });                      // collar
  S.cyl(0.07, 0.095, 3.1, 8, 0, 2.45, 0, G, { open: true, ol: true });                       // shaft
  S.cyl(0.13, 0.13, 0.08, 8, 0, 4.0, 0, PS.tone(G, 1.3), { open: true });                       // upper collar
  S.cyl(0.2, 0.09, 0.14, 8, 0, 4.11, 0, G);                                                  // lantern cup
  S.sph(0.25, 7, 5, 1, 1.15, 1, 0, 4.5, 0, GL);                                              // acorn globe, milky by day...
  S.glowSph(0.255, 7, 5, 1, 1.15, 1, 0, 4.5, 0, '#ffa050');                                   // ...warm lamp-light at night
  S.cyl(0.04, 0.27, 0.22, 8, 0, 4.9, 0, G);                                                  // acorn cap
  S.cyl(0, 0.045, 0.14, 6, 0, 5.07, 0, PS.tone(G, 1.3));                                        // finial
  const [wx, wz] = S.world(0, 0); out.lamp(wx, C + 4.5, wz); out.coll({ x: wx, z: wz, r: 0.25 });
  return META_PROPS_STREET.pieces.lamp_acorn;
}

// ---------------------------------------------------------------- modern cobra-head avenue lamp (the arm reaches toward +Z)
export function buildLampCobra(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || '#5a5f62', THREE = K.THREE;
  S.cyl(0.2, 0.24, 0.5, 8, 0, 0.25, 0, '#6f6a62', { ol: true });                            // base cover
  S.cyl(0.08, 0.13, 6.3, 8, 0, 3.65, 0, G, { open: true, ol: true });                        // tapered pole
  S.box(0.09, 0.09, 1.0, 0, 7.0, 0.36, G, { rot: [-0.28, 0, 0] });                            // arm rising out of the pole...
  S.box(0.09, 0.09, 0.7, 0, 7.18, 1.1, G, { rot: [0.0, 0, 0] });                              // ...and levelling off
  S.sph(0.5, 8, 5, 1, 0.3, 0.55, 0, 7.14, 1.55, '#8a9094');                                   // the cobra head (oversized for a phone screen)
  const lens = new THREE.CircleGeometry(0.3, 8).rotateX(Math.PI / 2).scale(1, 1, 1.4); lens.translate(0, 7.04, 1.55); K.place(lens, x, C, z, ang);
  const lens2 = lens.clone(); out.solid(lens, '#d8d0b0', false); out.glow(lens2.translate(0, -0.012, 0), '#ffa050');
  const [wx, wz] = S.world(0, 1.55); const [px, pz] = S.world(0, 0); out.lamp(wx, C + 7.0, wz); out.coll({ x: px, z: pz, r: 0.28 });
  return META_PROPS_STREET.pieces.lamp_cobra;
}

// ---------------------------------------------------------------- park bench: wood slats on cast-iron ends
export function buildBenchPark(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), wood = opts.wood || PS.WOOD, iron = opts.iron || PS.IRON;
  for (const lz of [0.14, 0, -0.14]) S.box(1.8, 0.05, 0.11, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const ly of [0.62, 0.8]) S.box(1.8, 0.11, 0.05, 0, ly, -0.22, wood, { skip: 'ny', rot: [-0.14, 0, 0] });
  for (const s of [-1, 1]) {
    S.box(0.06, 0.42, 0.06, s * 0.82, 0.21, 0.17, iron, { skip: 'ny', ol: true });                              // front leg
    S.box(0.06, 0.9, 0.06, s * 0.82, 0.45, -0.22, iron, { skip: 'ny', ol: true, rot: [-0.14, 0, 0] });         // raked back leg
    S.box(0.05, 0.05, 0.5, s * 0.82, 0.68, -0.02, iron, { skip: 'ny' });                                      // armrest
  }
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.45, z: wz, ang }); out.coll(S.aabb(-0.9, 0.9, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_park;
}

// ---------------------------------------------------------------- bus-stop bench with an Old Bay ad back and a bus-stop sign
export function buildBenchBus(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = PS.atlas(K, opts), wood = opts.wood || PS.WOOD, conc = '#8a8478';
  for (const lz of [0.1, -0.1]) S.box(1.7, 0.07, 0.19, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const s of [-1, 1]) S.box(0.12, 0.43, 0.5, s * 0.8, 0.215, 0, conc, { skip: 'ny', ol: true });
  S.box(1.7, 0.46, 0.05, 0, 0.9, -0.22, '#2a3f6a', { skip: 'ny nz', ol: true });                               // ad board
  S.decal(A, 'ad_oldbay', 1.54, 0.37, 0, 0.9, -0.19);                                                          // the Old Bay-style ad, drawn on canvas
  S.cyl(0.035, 0.035, 2.2, 6, 1.05, 1.1, -0.1, PS.IRON, { open: true, ol: true });                              // pole
  S.box(0.62, 0.22, 0.03, 1.05, 2.0, -0.1, '#2a3f6a', { skip: 'ny', ol: true });
  S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.082); S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.118, [0, Math.PI, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.46, z: wz, ang }); out.coll(S.aabb(-0.95, 1.2, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_bus;
}

// ---------------------------------------------------------------- public trash can; opts.recycling attaches a blue recycling bin
export function buildTrashCan(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = opts.recycling ? PS.atlas(K, opts) : null;
  const can = (lx, col, rec) => {
    S.cyl(0.3, 0.25, 0.85, 8, lx, 0.425, 0, col, { open: true, ol: true });
    S.cyl(0.325, 0.325, 0.08, 8, lx, 0.89, 0, PS.tone(col, 1.25));
    S.cyl(0.305, 0.275, 0.05, 8, lx, 0.5, 0, PS.tone(col, 0.7), { open: true });
    out.solid(S.fin(new S.THREE.CircleGeometry(0.19, 8).rotateX(-Math.PI / 2), lx, 0.933, 0), PS.IRON, false);                                   // the dark opening
    if (rec) S.decal(A, 'recycle', 0.3, 0.3, lx, 0.5, 0.272);
  };
  can(0, opts.paint || '#2f4a3a', false);
  if (opts.recycling) { can(0.68, '#2f5bd3', true); S.box(0.5, 0.06, 0.1, 0.34, 0.62, 0, PS.IRON, { skip: 'ny' }); }
  const [wx, wz] = S.world(opts.recycling ? 0.34 : 0, 0); out.coll({ x: wx, z: wz, r: opts.recycling ? 0.6 : 0.34 });
  return META_PROPS_STREET.pieces.trash_can;
}

// ---------------------------------------------------------------- manhole cover, flush with the road (top at y = 0.005, nit fixed: it was 0.017)
export function buildManhole(K, out, x, z, ang = 0, opts = {}) {
  const S = PS.kit(K, out, x, z, ang, 0), A = PS.atlas(K, opts);
  S.cyl(0.46, 0.46, 0.005, 12, 0, 0.0025, 0, '#4a4a50');
  S.decal(A, 'manhole', 0.92, 0.92, 0, 0.009, 0, [-Math.PI / 2, 0, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('manhole', { x: wx, z: wz });
  return META_PROPS_STREET.pieces.manhole;
}

// ---------------------------------------------------------------- fixed steel wall ladder up to a roof (opts.top = roof height in m)
function ladderRungs(S, from, to, iron) {
  for (let y = from + 0.12; y < to - 0.1; y += 0.32) S.box(0.44, 0.035, 0.04, 0, y, 0.15, iron, { skip: 'nx px nz' });
  for (const s of [-1, 1]) { S.box(0.05, to - from, 0.05, s * 0.23, (from + to) / 2, 0.15, iron, { skip: 'ny nz', ol: true }); }
}
export function buildLadderWall(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), top = opts.top ?? 6.0, iron = opts.iron || '#4f5a52';
  ladderRungs(S, 0, top, iron);
  for (const y of [0.4, top / 2, top - 0.3]) for (const s of [-1, 1]) S.box(0.04, 0.04, 0.13, s * 0.23, y, 0.075, iron, { skip: 'ny' });
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_wall;
}

// ---------------------------------------------------------------- fire-escape drop ladder: only the bottom section, hanging at 1.6 m
export function buildLadderDrop(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), iron = opts.iron || PS.IRON, top = opts.top ?? 4.4;
  ladderRungs(S, 1.6, 3.8, iron);
  S.box(0.62, 0.05, 0.5, 0, 3.86, 0.1, iron, { skip: 'ny', ol: true });                         // the fire-escape landing the ladder hangs from
  for (const s of [-1, 1]) { S.box(0.04, 0.4, 0.04, s * 0.3, 3.62, 0.34, iron, { skip: 'ny' }); }
  S.box(0.07, 0.07, 0.3, 0, 1.52, 0.15, '#6f6a62', { skip: 'ny' });                             // counterweight bar
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_drop;
}

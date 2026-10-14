// veh_cars.js — Task B (rebuilt 2026-10-11): street cars with real 3D volume, in the game's chunky cel-shaded style.
// Kinds (seeded silhouettes from 70s-2000s Baltimore streets): 'sedan' (boxy full-size), 'hatch' (compact hatchback), 'wagon' (estate with roof
// rails), 'minivan' (one-box people carrier), 'pickup' (cab + open bed), 'cab' (yellow city taxi with a roof sign and checker band), plus the box truck.
// Each car: a lofted, bevelled lower body (chamfered shoulders, a side crease, tapered nose and tail, a dark grimy rocker), a separate tapered greenhouse
// (raked windshield, tumblehome to a bevelled roof, pillars, black belt / drip trims), REAL transparent glass (out.glass, tinted, with a glossy
// highlight streak) over a visible interior (dash, steering wheel, seat backs, headrests), dark wheel wells with fender lips, tyres with hubcaps
// (white walls on the old sedans), bumpers, grille, head / tail lights with night glow (out.glow), mirrors, door seams + handles, rub strip and licence plates.
// out.glass(geom, rgba) is optional: a kit without it gets an opaque tinted pane through out.solid (the original starter kit still works).
// Vehicle contract: buildXxx(K, opts) -> { root, kind:'car', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
//   steer > 0 turns left (toward +X); speed in m/s. Seat anchors 'sit' = the rider's hips. The driver sits on +X (left, US).
//   Meshes: toon body + ink hull + glass + glow (+ livery decal on the box truck) + 3 wheel meshes (front left, front right, rear pair) <= 8.
// Static contract: buildParkedCarXxx(K, out, x, z, ang, opts) writes into `out` at y = 0 (on the road) and returns its META entry; opts.kind picks any kind.
// No imports; no Math.random (seeded LCG from opts.seed); no per-frame allocation in animate().
export const META_VEH_CARS = {
  id: 'veh_cars', kind: 'vehicle',
  pieces: {
    car_sedan: { id: 'car_sedan', kind: 'car', length: 4.9, width: 1.84, height: 1.48 }, car_hatch: { id: 'car_hatch', kind: 'car', length: 3.96, width: 1.7, height: 1.47 },
    car_wagon: { id: 'car_wagon', kind: 'car', length: 4.8, width: 1.8, height: 1.56 }, car_minivan: { id: 'car_minivan', kind: 'car', length: 4.6, width: 1.86, height: 1.8 },
    car_pickup: { id: 'car_pickup', kind: 'car', length: 5.3, width: 1.94, height: 1.87 }, car_cab: { id: 'car_cab', kind: 'car', length: 4.9, width: 1.84, height: 1.7 },
    box_truck: { id: 'box_truck', kind: 'car', length: 6.6, width: 2.3, height: 3.25 },
    parked_car_sedan: { id: 'parked_car_sedan', kind: 'prop', footprint: [1.84, 4.9], height: 1.48 }, parked_car_hatchback: { id: 'parked_car_hatchback', kind: 'prop', footprint: [1.7, 3.96], height: 1.47 },
    parked_car_pickup: { id: 'parked_car_pickup', kind: 'prop', footprint: [1.94, 5.3], height: 1.87 }, parked_car_wagon: { id: 'parked_car_wagon', kind: 'prop', footprint: [1.8, 4.8], height: 1.56 },
    parked_car_minivan: { id: 'parked_car_minivan', kind: 'prop', footprint: [1.86, 4.6], height: 1.8 }, parked_car_cab: { id: 'parked_car_cab', kind: 'prop', footprint: [1.84, 4.9], height: 1.7 },
  },
};
const VC_ATLAS = new WeakMap();
const VC = {
  // period paints: maroon, navy, champagne, forest, gunmetal, white, black, red, powder blue, brown, gold, plum, teal, silver
  PAINT: ['#8a2a2e', '#2e4a72', '#cbbf9e', '#3d5c3a', '#62686e', '#e6e2d8', '#25252b', '#b0342a', '#6f8fb0', '#7a5434', '#b89a5e', '#56406a', '#2f6a6a', '#a9adb2'],
  TRIM: ['#b89a72', '#6a6a70', '#6a2a2a', '#3a4a6a', '#4a4038'], // interior: tan, grey, oxblood, blue, brown
  TYRE: '#1d1d22', CHROME: '#b9c0c7', BLACK: '#1e1c22', DARK: '#141218', UNDER: '#2a2826', CARPET: '#2c2826',
  rng(seed) { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; },
  hex: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  tone: (h, f) => '#' + VC.hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join(''),
  mix: (a, b, t) => { const A = VC.hex(a), B = VC.hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); },
  atlas(K, opts) { return opts.atlas || VC_ATLAS.get(K) || (typeof PROP_TILES === 'object' ? (VC_ATLAS.set(K, K.makeAtlas(PROP_TILES)), VC_ATLAS.get(K)) : null); }, // null: liveries skipped
  // ---- the silhouettes. st = lower-body loft stations [z, half-width factor, top y]; g = greenhouse (A0 windshield foot, A1 windshield top,
  //      C1 rear-glass top, C0 rear-glass foot, yr roof, rw roof half-width, B pillar z list, we = z where the last side window ends (null: follows the rear line))
  SPEC: {
    sedan: { L: 4.9, hw: 0.92, r: 0.34, zf: 1.45, zr: -1.42, yb: 0.3, bump: 'chrome', lamps: 'quad', ww: true,
      st: [[-2.45, 0.9, 0.84], [-2.39, 0.98, 0.9], [-2.15, 1, 0.93], [-1.55, 1, 0.95], [1.05, 1, 0.94], [1.35, 1, 0.92], [2.25, 1, 0.86], [2.4, 0.98, 0.81], [2.45, 0.9, 0.74]],
      g: { A0: 1.05, A1: 0.25, C1: -1.0, C0: -1.55, yr: 1.43, rw: 0.74, B: [-0.36], we: -1.1 }, rows: [-0.12, -0.98] },
    wagon: { L: 4.8, hw: 0.9, r: 0.33, zf: 1.42, zr: -1.4, yb: 0.3, bump: 'chrome', lamps: 'wide', rails: true,
      st: [[-2.4, 0.92, 0.9], [-2.35, 0.99, 0.95], [-2.2, 1, 0.96], [1.0, 1, 0.94], [1.3, 1, 0.92], [2.2, 1, 0.86], [2.35, 0.98, 0.8], [2.4, 0.9, 0.74]],
      g: { A0: 1.0, A1: 0.22, C1: -2.16, C0: -2.3, yr: 1.47, rw: 0.75, B: [-0.42, -1.32], we: null }, rows: [-0.16, -1.0] },
    hatch: { L: 3.96, hw: 0.85, r: 0.31, zf: 1.22, zr: -1.2, yb: 0.28, bump: 'black', lamps: 'wide',
      st: [[-1.98, 0.92, 0.92], [-1.93, 0.99, 0.95], [-1.85, 1, 0.96], [0.9, 1, 0.93], [1.15, 1, 0.9], [1.85, 1, 0.83], [1.95, 0.97, 0.77], [1.98, 0.9, 0.7]],
      g: { A0: 0.9, A1: 0.1, C1: -1.5, C0: -1.86, yr: 1.42, rw: 0.7, B: [-0.48], we: -1.18 }, rows: [-0.22, -1.08] },
    minivan: { L: 4.6, hw: 0.93, r: 0.33, zf: 1.45, zr: -1.36, yb: 0.3, bump: 'body', lamps: 'aero',
      st: [[-2.3, 0.93, 0.98], [-2.25, 0.99, 1.0], [-2.2, 1, 1.0], [1.4, 1, 1.0], [1.7, 1, 0.92], [2.2, 1, 0.82], [2.28, 0.97, 0.76], [2.3, 0.9, 0.68]],
      g: { A0: 1.4, A1: 0.5, C1: -2.12, C0: -2.22, yr: 1.76, rw: 0.8, B: [-0.12, -1.26], we: null }, rows: [0.15, -0.75, -1.65] },
    pickup: { L: 5.3, hw: 0.97, r: 0.38, zf: 1.65, zr: -1.65, yb: 0.4, bump: 'chrome', lamps: 'quad', bed: [-0.56, -2.65],
      st: [[-0.5, 1, 1.05], [1.25, 1, 1.05], [1.45, 1, 1.02], [2.5, 1, 0.98], [2.62, 0.98, 0.92], [2.65, 0.9, 0.84]],
      g: { A0: 1.25, A1: 0.66, C1: -0.38, C0: -0.45, yr: 1.83, rw: 0.82, B: [], we: -0.12 }, rows: [-0.12] },
    truck: { L: 6.6, hw: 1.1, r: 0.46, zf: 2.25, zr: -2.2, yb: 0.52, bump: 'black', lamps: 'quad', box: [-3.3, 1.02],
      st: [[1.08, 1, 1.32], [2.3, 1, 1.32], [2.5, 1, 1.27], [3.15, 1, 1.18], [3.27, 0.97, 1.08], [3.3, 0.9, 0.98]],
      g: { A0: 2.3, A1: 1.82, C1: 1.2, C0: 1.14, yr: 2.58, rw: 0.98, B: [], we: 1.5 }, rows: [1.6] },
  },
};
VC.SPEC.cab = Object.assign({}, VC.SPEC.sedan, { taxi: true, ww: false, bump: 'body' });

// ---------------------------------------------------------------- the model builder: triangles sorted into layers, all in car-local space
class VCB {
  constructor(THREE) { this.T = THREE; this.S = new Map(); this.G = { P: [], N: [], C: [] }; this.L = new Map(); this.D = []; }
  // a triangle, wound so its face normal points along `hint` (flat shading: one normal per face)
  tri(B, a, b, c, hint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    B.P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) B.N.push(nx / l, ny / l, nz / l); return B;
  }
  bucket(col, ol) { const k = col + (ol ? '|1' : '|0'); let B = this.S.get(k); if (!B) this.S.set(k, (B = { P: [], N: [], col, ol: !!ol })); return B; }
  quad(col, a, b, c, d, hint, ol = false) { const B = this.bucket(col, ol); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  poly(col, pts, hint, ol = false) { const B = this.bucket(col, ol); for (let i = 1; i + 1 < pts.length; i++) this.tri(B, pts[0], pts[i], pts[i + 1], hint); }
  glow(col, a, b, c, d, hint) { let B = this.L.get(col); if (!B) this.L.set(col, (B = { P: [], N: [] })); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  glass(rgba, a, b, c, d, hint) { const G = this.G, n0 = G.P.length; this.tri(G, a, b, c, hint); this.tri(G, a, c, d, hint); for (let i = n0 / 3; i < G.P.length / 3; i++) G.C.push(...rgba); }
  geo(g, col, ol = false) { // any THREE geometry already in car space
    if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
    const B = this.bucket(col, ol), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { B.P.push(p[i]); B.N.push(n[i]); }
  }
  box(col, w, h, d, x, y, z, o = {}) { const g = new this.T.BoxGeometry(w, h, d); if (o.rx) g.rotateX(o.rx); if (o.ry) g.rotateY(o.ry); if (o.rz) g.rotateZ(o.rz); g.translate(x, y, z); this.geo(g, col, o.ol); }
  beam(col, p0, p1, t, ol = false, t2 = t) { // a box of section t x t2 from p0 to p1
    const T = this.T, d = new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), L = d.length(), g = new T.BoxGeometry(t, t2, L);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize())); g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); this.geo(g, col, ol);
  }
  disc(col, r, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) { // a disc in the side plane (normal +-X)
    const pts = []; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pts.push([x, y + Math.sin(a) * r, z + Math.cos(a) * r]); }
    const B = this.bucket(col, false), c = [x, y, z]; for (let i = 0; i < seg; i++) this.tri(B, c, pts[i], pts[i + 1], [sx, 0, 0]);
  }
  ring(col, r0, r1, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) {
    for (let i = 0; i < seg; i++) { const a = a0 + (a1 - a0) * i / seg, b = a0 + (a1 - a0) * (i + 1) / seg, P = (r, t) => [x, y + Math.sin(t) * r, z + Math.cos(t) * r]; this.quad(col, P(r0, a), P(r1, a), P(r1, b), P(r0, b), [sx, 0, 0]); }
  }
  geom(P, N, C) { const T = this.T, g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); if (C) g.setAttribute('color', new T.BufferAttribute(new Float32Array(C), 4)); return g; }
}

// lower body: loft through the stations; section = chamfered bottom, a side crease that bulges 1.5 cm, a chamfered shoulder, a flat top
function vcLoft(M, s, paint, R, cabin) {
  const prof = (hw, yb, yt) => { const ym = yb + (yt - yb) * 0.52; return [[-hw + 0.09, yb], [-hw, yb + 0.11], [-hw - 0.015, ym], [-hw + 0.004, yt - 0.12], [-hw + 0.07, yt], [hw - 0.07, yt], [hw - 0.004, yt - 0.12], [hw + 0.015, ym], [hw, yb + 0.11], [hw - 0.09, yb]]; };
  const st = s.st.map(([z, f, yt], i) => ({ z, hw: s.hw * f, yt, yb: s.yb + (i === 0 || i === s.st.length - 1 ? 0.06 : 0) }));
  const grime = VC.tone(paint, 0.62), shoulder = VC.tone(paint, 1.04);
  const colOf = (e, zc) => { // e = edge index around the section
    if (e === 9) return VC.UNDER; if (e === 0 || e === 8) return grime; if (e === 4) return zc > cabin[0] && zc < cabin[1] ? VC.CARPET : paint; if (e === 3 || e === 5) return shoulder; return paint;
  };
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1], pa = prof(a.hw, a.yb, a.yt), pb = prof(b.hw, b.yb, b.yt), zc = (a.z + b.z) / 2, cy = (a.yb + a.yt) / 2;
    for (let e = 0; e < pa.length; e++) {
      const f = (e + 1) % pa.length, A = [pa[e][0], pa[e][1], a.z], Bv = [pa[f][0], pa[f][1], a.z], C = [pb[f][0], pb[f][1], b.z], D = [pb[e][0], pb[e][1], b.z];
      const mx = (A[0] + Bv[0] + C[0] + D[0]) / 4, my = (A[1] + Bv[1] + C[1] + D[1]) / 4;
      M.quad(colOf(e, zc), A, Bv, C, D, [mx, my - cy, 0], e !== 9);
    }
  }
  for (const [k, dir] of [[0, -1], [st.length - 1, 1]]) { const q = st[k], p = prof(q.hw, q.yb, q.yt).map(([x, y]) => [x, y, q.z]); M.poly(paint, p, [0, 0, dir], true); }
  return { st, top: (z) => { for (let i = 0; i + 1 < st.length; i++) if (z >= st[i].z && z <= st[i + 1].z) { const t = (z - st[i].z) / (st[i + 1].z - st[i].z); return st[i].yt + (st[i + 1].yt - st[i].yt) * t; } return st[z < 0 ? 0 : st.length - 1].yt; } };
}

// greenhouse: windshield, roof (bevelled), rear glass, side windows between pillars, C-pillar panels, belt + drip trims, highlight streaks
function vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC) {
  const g = s.g, hb = s.hw - 0.07, hr = g.rw, yA = body.top(g.A0), yC = body.top(g.C0), yr = g.yr;
  const belt = (z) => yA + (yC - yA) * (z - g.A0) / (g.C0 - g.A0);
  const zF = (t) => g.A0 + (g.A1 - g.A0) * t, zR = (t) => g.C0 + (g.C1 - g.C0) * t;
  const P = (sx, z, t) => [sx * (hb + (hr - hb) * t), belt(z) + (yr - belt(z)) * t, z]; // a point on a side plane, t = 0 belt .. 1 roof line
  const W = (sx) => [sx * (yr - (yA + yC) / 2), hb - hr, 0]; // outward normal hint of a side plane
  const pc = VC.tone(paint, 0.96);
  // windshield + rear glass
  M.glass(glassC, [-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.6, 1]);
  M.glass(glassC, [-hb, yC, g.C0], [hb, yC, g.C0], [hr, yr, g.C1], [-hr, yr, g.C1], [0, 0.6, -1]);
  // glossy streaks: one diagonal band on the windshield, one on each side window (glass layer, nearly opaque)
  const streak = (p0, p1, p2, p3, n, k0, k1) => { const L = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), o = (p) => p.map((v, i) => v + n[i] * 0.006);
    M.glass(hiC, o(L(p0, p1, k0)), o(L(p0, p1, k1)), o(L(p3, p2, k1 - 0.18)), o(L(p3, p2, k0 - 0.18)), n); };
  streak([-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.7, 0.7], 0.42, 0.56);
  // bevelled roof: edge ring at yr, top inset 7 cm and raised 4.5 cm
  const e = [[-hr, yr, g.A1], [hr, yr, g.A1], [hr, yr, g.C1], [-hr, yr, g.C1]], t = [[-hr + 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.C1 + 0.06], [-hr + 0.07, yr + 0.045, g.C1 + 0.06]];
  M.quad(roofCol, t[0], t[1], t[2], t[3], [0, 1, 0], true);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, m = [(e[i][0] + e[j][0]) / 2, 0.5, (e[i][2] + e[j][2]) / 2 - (g.A1 + g.C1) / 2]; M.quad(roofCol, e[i], e[j], t[j], t[i], m, true); }
  // side windows between the pillars (+ the C-pillar panel when the last window ends early)
  const cuts = [g.A0 - 1].concat(g.B).concat([g.we === null ? g.C0 + 1 : g.we]);
  for (const sx of [-1, 1]) {
    const n = W(sx), nl = Math.hypot(n[0], n[1]); const nn = [n[0] / nl, n[1] / nl, 0];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const za = cuts[k] + (k ? 0.045 : 0), zb = cuts[k + 1] - (k + 1 < cuts.length - 1 ? 0.045 : 0), t0 = 0.03, t1 = 0.95;
      const q = [P(sx, Math.max(za, zF(t0)), t0), P(sx, Math.min(zb, zR(t0)), t0), P(sx, Math.min(zb, zR(t1)), t1), P(sx, Math.max(za, zF(t1)), t1)];
      M.glass(glassC, q[0], q[1], q[2], q[3], nn);
      if (k === 0) streak(q[0], q[1], q[2], q[3], nn, 0.3, 0.5);
    }
    if (g.we !== null) M.quad(pc, P(sx, zR(0), 0), P(sx, g.we, 0), P(sx, g.we, 1), P(sx, zR(1), 1), nn, true);
    // pillars: A along the windshield edge, B uprights, the rear (C / D) along the rear-glass edge; black belt + drip trims
    M.beam(pc, P(sx, g.A0, 0), P(sx, g.A1, 1), 0.075, true);
    M.beam(pc, P(sx, g.C0, 0), P(sx, g.C1, 1), 0.075, true);
    for (const zb of g.B) M.beam(VC.BLACK, P(sx, zb, 0), P(sx, zb, 1), 0.085, false, 0.05);
    M.beam(VC.BLACK, P(sx, g.A0, 0.01), P(sx, g.C0, 0.01), 0.035);
    M.beam(VC.BLACK, P(sx, g.A1, 0.99), P(sx, g.C1, 0.99), 0.035);
  }
  return { hb, hr, yA, yC, belt };
}

// one wheel's geometry list, centred on its axle; sx = which side faces out. Only what can be seen: an open tread band, the outer sidewall ring,
// a white-wall ring (old sedans), a dished hubcap + centre cap; drivable wheels add five dimples so the spin reads. Cheap (parked) wheels use fewer segments.
function vcWheelParts(THREE, s, sx, cheap) {
  const r = s.r, w = s.kind === 'truck' ? 0.3 : 0.23, L = [], seg = cheap ? 10 : 14, ox = sx * w / 2;
  const side = (g) => g.rotateY(sx * Math.PI / 2); // a flat XY shape turned to face +-X
  L.push([new THREE.CylinderGeometry(r, r, w, seg, 1, true).rotateZ(Math.PI / 2), VC.TYRE]);
  L.push([side(new THREE.RingGeometry(r * 0.6, r, seg)).translate(ox, 0, 0), VC.tone(VC.TYRE, 1.3)]);
  if (s.ww) L.push([side(new THREE.RingGeometry(r * 0.6, r * 0.76, seg)).translate(ox + sx * 0.004, 0, 0), '#e8e6de']);
  L.push([new THREE.CylinderGeometry(r * (s.ww ? 0.5 : 0.58), r * (s.ww ? 0.56 : 0.62), 0.03, cheap ? 8 : 10, 1, true).rotateZ(Math.PI / 2).translate(ox + sx * 0.015, 0, 0), VC.tone(s.hub, 0.8)]);
  L.push([side(new THREE.CircleGeometry(r * (s.ww ? 0.5 : 0.58), cheap ? 8 : 10)).translate(ox + sx * 0.03, 0, 0), s.hub]);
  L.push([side(new THREE.CircleGeometry(r * 0.2, 6)).translate(ox + sx * 0.036, 0, 0), VC.tone(s.hub, 0.7)]);
  if (!cheap) for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; L.push([side(new THREE.CircleGeometry(r * 0.07, 5)).translate(ox + sx * 0.034, Math.sin(a) * r * 0.38, Math.cos(a) * r * 0.38), VC.tone(s.hub, 0.5)]); }
  return L;
}

// ---------------------------------------------------------------- the whole car (everything except the moving wheels)
function vcModel(K, kind, opts) {
  const THREE = K.THREE, s0 = VC.SPEC[kind] || VC.SPEC.sedan, R = VC.rng((opts.seed ?? 1) * 7 + kind.length), M = new VCB(THREE);
  const s = Object.assign({ kind }, s0), hw = s.hw;
  let paint = opts.paint || (s.taxi ? '#e8b830' : kind === 'truck' ? (R() < 0.5 ? '#e6e2d8' : '#2e4a72') : VC.PAINT[Math.floor(R() * VC.PAINT.length)]);
  paint = VC.mix(paint, '#6a6458', R() * 0.12); // a little street grime on every car
  const trimC = VC.TRIM[Math.floor(R() * VC.TRIM.length)], vinyl = kind === 'sedan' && R() < 0.35, roofCol = vinyl ? VC.tone(paint, 0.55) : paint;
  s.hub = s.bump === 'chrome' || R() < 0.4 ? VC.CHROME : VC.tone(paint, 0.85);
  const bumpC = s.bump === 'chrome' ? VC.CHROME : s.bump === 'black' ? '#2a2a2e' : VC.tone(paint, 0.9);
  const glassC = [0.42, 0.56, 0.62, 0.42], hiC = [0.92, 0.97, 1.0, 0.55];
  const g = s.g, cabin = [g.C0 - 0.05, g.A0 + 0.05];
  // ---- lower body ----
  const body = vcLoft(M, s, paint, R, cabin), open = !!(s.bed || s.box); // pickup / truck: the loft is the cab + hood, the tail is the bed / box end
  const zN = s.st[s.st.length - 1][0], zT = s.bed ? s.bed[1] : s.box ? s.box[0] : s.st[0][0], hwN = hw * s.st[s.st.length - 1][1], hwT = open ? hw : hw * s.st[0][1];
  const yN = body.top(zN), yT = open ? 1.05 : body.top(zT);
  // ---- greenhouse ----
  const GH = vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC);
  // ---- interior seen through the glass: dash, steering wheel, seat backs + headrests ----
  const yb = GH.yA, dz = g.A0 - 0.22;
  M.box(VC.tone(trimC, 0.45), 2 * GH.hb - 0.12, 0.16, 0.36, 0, yb + 0.02, dz);
  const sw = new THREE.TorusGeometry(0.17, 0.025, 4, 10); sw.rotateX(-0.9); sw.translate(0.37 * hw / 0.9, yb + 0.12, g.A0 - 0.48); M.geo(sw, VC.BLACK);
  M.beam(VC.BLACK, [0.37 * hw / 0.9, yb + 0.02, g.A0 - 0.32], [0.37 * hw / 0.9, yb + 0.1, g.A0 - 0.45], 0.04);
  s.rows.forEach((z, ri) => {
    const bench = ri > 0 || kind === 'pickup' || kind === 'truck', wid = 2 * GH.hb - 0.2;
    const backs = bench ? [[0, wid]] : [[0.36 * hw / 0.9, 0.52], [-0.36 * hw / 0.9, 0.52]];
    for (const [x, w] of backs) { M.box(trimC, w, 0.62, 0.13, x, yb + 0.06, z, { rx: -0.18 }); for (const hx of bench && w > 1 ? [-0.4, 0.4] : [0]) M.box(VC.tone(trimC, 0.85), 0.24, 0.16, 0.1, x + hx, yb + 0.44, z - 0.06); }
  });
  // ---- wheel wells (dark) + fender lips; tyres sit 3.5 cm proud of the body ----
  const wheels = [[1, s.zf, true], [-1, s.zf, true], [1, s.zr, false], [-1, s.zr, false]].map(([sx, z, front]) => ({ sx, x: sx * (hw + 0.035 - (s.kind === 'truck' ? 0.15 : 0.115)), y: s.r, z, r: s.r, front }));
  for (const w of wheels) { if (s.box && !w.front) continue; const x = w.sx * (hw + 0.022); M.disc(VC.DARK, s.r + 0.075, 10, x, s.r, w.z, w.sx, -0.15, Math.PI + 0.15); M.ring(VC.tone(paint, 0.72), s.r + 0.075, s.r + 0.11, 8, w.sx * (hw + 0.028), s.r, w.z, w.sx, -0.1, Math.PI + 0.1); }
  // ---- side details: door seams, handles, rub strip, mirrors ----
  const prof = (y) => { const ybb = s.yb, yt = body.top(0), ym = ybb + (yt - ybb) * 0.52; return y < ym ? hw + 0.015 * (y - ybb - 0.11) / (ym - ybb - 0.11) : hw + 0.015 - 0.019 * (y - ym) / (yt - 0.12 - ym); };
  const seamZ = [g.A0 - 0.06].concat(g.B).concat(g.we !== null && !s.bed && !s.box ? [g.we + 0.02] : []);
  for (const sx of [-1, 1]) {
    for (const z of seamZ) { if (Math.abs(z - s.zf) < s.r + 0.14 || Math.abs(z - s.zr) < s.r + 0.14) continue; const y0 = s.yb + 0.12, y2 = body.top(z) - 0.06, y1 = (y0 + y2) / 2;
      for (const [ya, yc] of [[y0, y1], [y1, y2]]) M.quad(VC.tone(paint, 0.45), [sx * (prof(ya) + 0.004), ya, z - 0.009], [sx * (prof(ya) + 0.004), ya, z + 0.009], [sx * (prof(yc) + 0.004), yc, z + 0.009], [sx * (prof(yc) + 0.004), yc, z - 0.009], [sx, 0, 0]); }
    const doors = [[g.A0 - 0.06, g.B.length ? g.B[0] : (g.we ?? g.C0)]].concat(g.B.length ? [[g.B[0], g.B[1] ?? g.we ?? g.C0]] : []);
    for (const [za, zb] of doors) { const yh = body.top(za) - 0.17; M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.6), 0.03, 0.035, 0.15, sx * (prof(yh) + 0.012), yh, Math.min(za, zb) + 0.18); }
    const yrub = body.top(0) - 0.2; M.beam(s.bump === 'chrome' ? VC.CHROME : '#2a2a2e', [sx * (prof(yrub) + 0.012), yrub, zT + 0.25], [sx * (prof(yrub) + 0.012), yrub, zN - 0.3], 0.03, false, 0.04);
    // mirror on a stalk at the A-pillar foot
    const my = GH.yA + 0.1, mz = g.A0 - 0.12; M.beam(VC.BLACK, [sx * (GH.hb + 0.02), my - 0.04, mz], [sx * (hw + 0.1), my, mz - 0.02], 0.035);
    M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.85), 0.07, 0.11, 0.15, sx * (hw + 0.13), my + 0.02, mz - 0.04, { ol: true });
  }
  // ---- nose: grille, lamps, bumper, plate ----
  const quadL = s.lamps === 'quad', lampW = { quad: 0.17, wide: 0.34, aero: 0.38 }[s.lamps] || 0.3, lx = hwN - 0.1 - lampW * (quadL ? 1.05 : 0.5), ly = yN - 0.17, gw = (quadL ? lx - lampW * 1.05 : lx - lampW / 2) - 0.03;
  M.box('#2a2a30', 2 * gw, 0.2, 0.04, 0, ly, zN + 0.01);
  for (let i = 0; i < 3; i++) M.box(s.bump === 'chrome' ? VC.CHROME : '#4a4a52', 2 * gw - 0.02, 0.02, 0.05, 0, ly - 0.07 + i * 0.07, zN + 0.015);
  if (s.bump === 'chrome') M.box(VC.CHROME, 2 * gw + 0.04, 0.24, 0.03, 0, ly, zN + 0.004);
  for (const sx of [-1, 1]) {
    const units = s.lamps === 'quad' ? [sx * (lx - lampW * 0.55), sx * (lx + lampW * 0.55)] : [sx * lx];
    for (const ux of units) { M.box(VC.CHROME, (s.lamps === 'quad' ? lampW : lampW) + 0.03, 0.15, 0.03, ux, ly, zN + 0.008); M.box('#f2eedc', (s.lamps === 'quad' ? lampW : lampW) - 0.02, 0.11, 0.04, ux, ly, zN + 0.014);
      const hx = ((s.lamps === 'quad' ? lampW : lampW) - 0.02) / 2; M.glow('#ffe6a0', [ux - hx, ly - 0.055, zN + 0.036], [ux + hx, ly - 0.055, zN + 0.036], [ux + hx, ly + 0.055, zN + 0.036], [ux - hx, ly + 0.055, zN + 0.036], [0, 0, 1]); }
    M.box('#e89a3a', 0.12, 0.06, 0.04, sx * (hwN - 0.1), ly - 0.13, zN + 0.01); // amber parking light
  }
  const bY = s.yb + 0.16, bumpD = s.bump === 'chrome' ? 0.14 : 0.16;
  M.box(bumpC, 2 * hwN + 0.04, 0.15, bumpD, 0, bY, zN + 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.42, sx * (hwN + 0.02), bY, zN - 0.12, { ry: sx * 0.25, ol: true });
  const plate = (z, dir) => { const y = bY + (dir > 0 ? 0.01 : 0.2), zz = z + dir * 0.004; M.quad('#e8e6dc', [-0.17, y - 0.085, zz], [0.17, y - 0.085, zz], [0.17, y + 0.085, zz], [-0.17, y + 0.085, zz], [0, 0, dir]);
    M.quad('#2f5bd3', [-0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.075, zz + dir * 0.002], [-0.16, y + 0.075, zz + dir * 0.002], [0, 0, dir]);
    for (let i = 0; i < 6; i++) { const cx = -0.125 + i * 0.05 + (i > 2 ? 0.01 : 0); M.quad(VC.BLACK, [cx - 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y + 0.02, zz + dir * 0.003], [cx - 0.016, y + 0.02, zz + dir * 0.003], [0, 0, dir]); } };
  plate(zN + 0.03 + bumpD / 2, 1);
  // ---- tail: lamps, bumper, plate, trunk / hatch seam ----
  const tY = yT - 0.15, tW = kind === 'hatch' || kind === 'minivan' ? 0.22 : 0.4;
  if (!open) for (const sx of [-1, 1]) { const tx = sx * (hwT - 0.06 - tW / 2); M.box('#7a1a1a', tW + 0.02, 0.17, 0.04, tx, tY, zT - 0.012); M.box('#d8303a', tW - 0.02, 0.13, 0.04, tx, tY, zT - 0.02);
    M.glow('#ff2a1a', [tx - tW / 2 + 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY + 0.06, zT - 0.042], [tx - tW / 2 + 0.01, tY + 0.06, zT - 0.042], [0, 0, -1]);
    M.box('#eeeeee', 0.07, 0.07, 0.04, sx * (hwT - 0.1 - tW), tY, zT - 0.012); }
  M.box(bumpC, 2 * hwT + 0.04, 0.15, bumpD, 0, bY, zT - 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.4, sx * (hwT + 0.02), bY, zT + 0.12, { ry: -sx * 0.25, ol: true });
  plate(zT - 0.004, -1);
  if (!s.bed && !s.box && g.C0 - zT > 0.3) M.quad(VC.tone(paint, 0.45), [-hwT + 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.02, zT - 0.003], [-hwT + 0.12, yT - 0.02, zT - 0.003], [0, 0, -1]);
  // ---- kind extras ----
  if (s.rails) for (const sx of [-1, 1]) { M.beam(VC.BLACK, [sx * (g.rw - 0.1), g.yr + 0.1, g.A1 - 0.25], [sx * (g.rw - 0.1), g.yr + 0.1, g.C1 + 0.2], 0.04); for (const z of [g.A1 - 0.3, g.C1 + 0.25]) M.box(VC.BLACK, 0.05, 0.08, 0.06, sx * (g.rw - 0.1), g.yr + 0.06, z); }
  if (s.taxi) { // roof sign (lit at night) + checker band
    const zs = (g.A1 + g.C1) / 2 + 0.1, ys = g.yr + 0.045; M.box('#f2efe6', 0.62, 0.22, 0.24, 0, ys + 0.13, zs, { ol: true }); M.box(VC.BLACK, 0.66, 0.04, 0.28, 0, ys + 0.02, zs);
    for (const dir of [1, -1]) { const z = zs + dir * 0.122; M.glow('#fff2c0', [-0.28, ys + 0.04, z], [0.28, ys + 0.04, z], [0.28, ys + 0.22, z], [-0.28, ys + 0.22, z], [0, 0, dir]);
      const L = [[-0.22, 0.04, 0.06], [-0.19, 0.04, 0.012], [-0.09, 0.04, 0.06], [-0.04, 0.012, 0.06], [-0.065, 0.04, 0.012], [0.02, 0.012, 0.06], [0.06, 0.012, 0.06], [0.17, 0.012, 0.06]];
      for (const [x, w, h] of L) M.quad('#2a2420', [dir * x - w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [dir * x - w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [0, 0, dir]); }
    const yc = body.top(0) - 0.32; for (const sx of [-1, 1]) for (let i = 0; i < 16; i++) { const z0 = g.A0 - 0.1 - i * 0.12; if (z0 - 0.12 < g.C0 + 0.05) break; for (const row of [0, 1]) if ((i + row) % 2 === 0) { const y0 = yc + row * 0.06, x = sx * (prof(y0 + 0.03) + 0.005);
      M.quad(VC.BLACK, [x, y0, z0 - 0.12], [x, y0, z0], [x, y0 + 0.06, z0], [x, y0 + 0.06, z0 - 0.12], [sx, 0, 0]); } }
  }
  if (s.bed) { // pickup bed: open box behind the cab
    const [z1, z0] = [s.bed[0], s.bed[1]], yt = 1.05, fl = 0.78;
    M.box(VC.tone(paint, 0.9), 2 * hw - 0.16, 0.04, z1 - z0, 0, fl, (z0 + z1) / 2);
    for (const sx of [-1, 1]) { M.box(paint, 0.09, yt - s.yb, z1 - z0, sx * (hw - 0.045), (yt + s.yb) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(paint, 1.08), 0.13, 0.04, z1 - z0, sx * (hw - 0.05), yt + 0.02, (z0 + z1) / 2); }
    M.box(paint, 2 * hw, yt - s.yb, 0.09, 0, (yt + s.yb) / 2, z0 + 0.045, { ol: true }); M.box(VC.tone(paint, 0.85), 2 * hw - 0.2, 0.15, 0.1, 0, fl + 0.08, z1 + 0.04);
    M.box(VC.UNDER, 2 * hw - 0.2, 0.06, z1 - z0, 0, s.yb + 0.03, (z0 + z1) / 2);
    const tz = z0, ty = yt - 0.14; for (const sx of [-1, 1]) { const tx = sx * (hw - 0.12); M.box('#d8303a', 0.14, 0.28, 0.04, tx, ty - 0.08, tz - 0.012); M.glow('#ff2a1a', [tx - 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty + 0.05, tz - 0.035], [tx - 0.06, ty + 0.05, tz - 0.035], [0, 0, -1]); }
  }
  if (s.box) { // box truck: cargo box with liveries, roll-up door, marker lights
    const [z0, z1] = s.box, y0 = 1.02, y1 = 3.25, bw = 1.15, boxC = opts.boxColor || (paint === '#2e4a72' ? '#3a5a8a' : '#eae6dc');
    M.box(boxC, 2 * bw, y1 - y0, z1 - z0, 0, (y0 + y1) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(boxC, 0.8), 2 * bw + 0.04, 0.08, z1 - z0 + 0.04, 0, y1 - 0.02, (z0 + z1) / 2);
    M.box('#2a2a2e', 2 * hw - 0.5, 0.3, z1 - z0, 0, 0.86, (z0 + z1) / 2); for (const sx of [-1, 1]) M.box('#1e1e22', 0.4, 0.5, 0.04, sx * (bw - 0.25), 0.55, s.zr - s.r - 0.12); // chassis rail + mud flaps for (const x of [-0.6, 0, 0.6]) M.box(VC.tone('#8a8a90', 0.8), 0.04, 2.1, 0.03, x, 1.95, z0 - 0.012);
    for (let i = 0; i < 9; i++) M.box(VC.tone(boxC, 0.85), 2 * bw - 0.16, 0.025, 0.02, 0, 1.15 + i * 0.22, z0 - 0.02);
    for (const sx of [-1, 1]) { for (const z of [z0 + 0.3, z1 - 0.3]) { M.box('#e89a3a', 0.04, 0.06, 0.08, sx * (bw + 0.01), y1 - 0.2, z); M.glow('#ffa040', [sx * (bw + 0.032), y1 - 0.23, z - 0.04], [sx * (bw + 0.032), y1 - 0.23, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z - 0.04], [sx, 0, 0]); } const tx = sx * (bw - 0.14); M.box('#d8303a', 0.18, 0.3, 0.04, tx, 1.18, z0 - 0.02);
      M.glow('#ff2a1a', [tx - 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.32, z0 - 0.045], [tx - 0.08, 1.32, z0 - 0.045], [0, 0, -1]); }
    s.livery = opts.livery || (R() < 0.5 ? 'utz' : 'move'); if (s.livery === 'utz' && !opts.boxColor) { /* white box carries the Utz-style livery */ }
    for (const sx of [-1, 1]) M.D.push({ g: new THREE.PlaneGeometry(4.0, 4.0 * 112 / 320).rotateY(sx * Math.PI / 2).translate(sx * (bw + 0.012), 2.15, (z0 + z1) / 2), tile: s.livery === 'utz' ? 'truck_utz' : 'truck_move' });
  }
  const seats = s.rows.slice(0, kind === 'pickup' || kind === 'truck' ? 1 : 2).flatMap((z, ri) => (ri === 0 ? [[0.36 * hw / 0.9, z + 0.3, 'left'], [-0.36 * hw / 0.9, z + 0.3, 'right']] : [[0.4 * hw / 0.9, z + 0.3, 'rear-left'], [-0.4 * hw / 0.9, z + 0.3, 'rear-right']]).map(([x, sz, side]) => ({ x, y: GH.yA - 0.38, z: sz, ang: 0, pose: 'sit', side })));
  const height = s.box ? 3.25 : (s.taxi ? g.yr + 0.3 : g.yr + 0.05), len = Math.max(zN + 0.1, -zT + 0.1) * 2;
  return { M, s, wheels, seats, collider: { w: +(2 * hw + 0.1).toFixed(2), l: +len.toFixed(2), h: +height.toFixed(2) } };
}

// write a model's layers into an `out` collector; fin(g) places a car-space geometry (identity for a drivable car, the street pose for a parked one)
function vcEmit(K, out, Mo, fin, A) {
  const M = Mo.M;
  for (const B of M.S.values()) out.solid(fin(M.geom(B.P, B.N)), B.col, B.ol);
  for (const [col, B] of M.L) out.glow(fin(M.geom(B.P, B.N)), col);
  if (M.G.P.length) { const g = fin(M.geom(M.G.P, M.G.N, M.G.C)); if (out.glass) out.glass(g); else { g.deleteAttribute('color'); out.solid(g, '#5f7e8c', false); } }
  if (A) for (const d of M.D) { const g = fin(d.g); out.decal(g, A, d.tile); }
}

// ---------------------------------------------------------------- drivable vehicles: one static body + three wheel meshes
function vcVehicle(K, opts, kind) {
  const THREE = K.THREE, A = VC.atlas(K, opts), out = K.makeOut(), Mo = vcModel(K, kind, opts), s = Mo.s;
  let glassMesh = null; if (K.glassMat) out.glass = (g) => { glassMesh = new THREE.Mesh(g, K.glassMat); glassMesh.renderOrder = 3; };
  vcEmit(K, out, Mo, (g) => g, A);
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); if (glassMesh) bob.add(glassMesh);
  const mat = K.toonMat(), merge = (list) => { const P = [], N = [], C = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c.r, c.g, c.b); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3)); return m; };
  const wheels = [];
  for (const w of Mo.wheels.filter((q) => q.front)) { const steer = new THREE.Group(); steer.position.set(w.x, w.y, w.z); const mesh = new THREE.Mesh(merge(vcWheelParts(THREE, s, w.sx, false)), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: w.r, front: true }); }
  { const rr = Mo.wheels.filter((q) => !q.front), list = []; for (const w of rr) for (const [g, c] of vcWheelParts(THREE, s, w.sx, false)) list.push([g.translate(w.x, 0, 0), c]);
    const steer = new THREE.Group(); steer.position.set(0, rr[0].y, rr[0].z); const mesh = new THREE.Mesh(merge(list), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: rr[0].r, front: false }); }
  const roll = kind === 'truck' ? 0.003 : 0.004, bounce = kind === 'truck' ? 0.008 : 0.006, bf = kind === 'truck' ? 7 : 9;
  return {
    root, kind: 'car', seats: Mo.seats, collider: Mo.collider, waterline: 0, parts: { bob, wheels }, model: kind,
    animate(v, dt, speed = 0, steerIn = 0, t = 0) {
      for (let i = 0; i < wheels.length; i++) { const w = wheels[i]; w.mesh.rotation.x += (speed * dt) / w.r; if (w.front) w.steer.rotation.y = Math.max(-1, Math.min(1, steerIn)) * 0.5; }
      bob.rotation.z = steerIn * Math.min(Math.abs(speed), 8) * roll; // the body rolls OUT of the turn (nit fixed: it used to lean in)
      bob.position.y = Math.abs(speed) > 0.1 ? Math.sin(t * bf) * bounce : 0;
    },
  };
}
export function buildCarSedan(K, opts = {}) { return vcVehicle(K, opts, 'sedan'); }
export function buildCarHatch(K, opts = {}) { return vcVehicle(K, opts, 'hatch'); }
export function buildCarWagon(K, opts = {}) { return vcVehicle(K, opts, 'wagon'); }
export function buildCarMinivan(K, opts = {}) { return vcVehicle(K, opts, 'minivan'); }
export function buildCarPickup(K, opts = {}) { return vcVehicle(K, opts, 'pickup'); }
export function buildCarCab(K, opts = {}) { return vcVehicle(K, opts, 'cab'); }
export function buildBoxTruck(K, opts = {}) { return vcVehicle(K, opts, 'truck'); }

// ---------------------------------------------------------------- static parked cars (merged into the chunk through `out`, base on the road y = 0)
const VC_PARKED = { sedan: 'parked_car_sedan', hatch: 'parked_car_hatchback', pickup: 'parked_car_pickup', wagon: 'parked_car_wagon', minivan: 'parked_car_minivan', cab: 'parked_car_cab' };
export function buildParkedCar(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, kind = VC_PARKED[opts.kind] ? opts.kind : 'sedan', Mo = vcModel(K, kind, opts), s = Mo.s, fin = (g) => K.place(g, x, 0, z, ang);
  vcEmit(K, out, Mo, fin, null);
  // static wheels (cheap: no spin dimples), merged per colour
  const byCol = new Map(); for (const w of Mo.wheels) for (const [g, c] of vcWheelParts(THREE, s, w.sx, true)) { g.translate(w.x, w.y, w.z); (byCol.get(c) || byCol.set(c, []).get(c)).push(g); }
  for (const [c, list] of byCol) for (const g of list) out.solid(fin(g), c, false);
  const hw = Mo.collider.w / 2, hl = Mo.collider.l / 2, p = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)]);
  const bb = { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) };
  out.coll(bb); if (out.bld) out.bld(Object.assign({ h: Mo.collider.h }, bb));
  return Object.assign({ collider: Mo.collider }, META_VEH_CARS.pieces[VC_PARKED[kind]]);
}
export function buildParkedCarSedan(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'sedan' })); }
export function buildParkedCarHatchback(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'hatch' })); }
export function buildParkedCarPickup(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'pickup' })); }
export const VC_KINDS = ['sedan', 'hatch', 'wagon', 'minivan', 'pickup', 'cab'];

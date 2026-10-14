// veh_cars.js — Task B: drivable cars (car_sedan, car_hatch), the box truck, and the static PARKED cars (parked_car_sedan / _hatchback / _pickup).
// One shared model: the side silhouette (with real wheel arches) is extruded across the car, glass is separate dark quads, lights glow at night
// through out.glow (the vehicle never adds lights), and the wheels are the only moving parts (one merged mesh each: tyre + hub + five spokes,
// shared K.toonMat): front wheels steer, all wheels spin. The static parked cars use the same model written into the chunk `out`.
// Vehicle contract: buildXxx(K, opts) -> { root, kind:'car', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
// steer > 0 turns left (toward +X); speed in m/s. Seat anchors: 'lean_out' / 'sit' = the rider's hips, 'stand' = the feet. The driver sits on +X (left).
// Static contract: buildParkedCarXxx(K, out, x, z, ang, opts) writes into `out` at y = 0 (on the road) and returns its META entry.
// No imports; no Math.random (seeded LCG from opts.seed); materials only through K.makeOut / K.toonMat.
export const META = {
  id: 'veh_cars', kind: 'vehicle',
  pieces: {
    car_sedan: { id: 'car_sedan', kind: 'car', length: 4.5, width: 1.8, height: 1.5 }, car_hatch: { id: 'car_hatch', kind: 'car', length: 3.95, width: 1.75, height: 1.5 },
    box_truck: { id: 'box_truck', kind: 'car', length: 6.4, width: 2.3, height: 3.1 },
    parked_car_sedan: { id: 'parked_car_sedan', kind: 'prop', footprint: [1.8, 4.5], height: 1.46 }, parked_car_hatchback: { id: 'parked_car_hatchback', kind: 'prop', footprint: [1.75, 3.95], height: 1.5 },
    parked_car_pickup: { id: 'parked_car_pickup', kind: 'prop', footprint: [2.0, 5.4], height: 1.7 },
  },
};

const VC = {
  PAINT: ['#8a4a3a', '#3a5a8a', '#2f5a3a', '#c9b48a', '#6f6a62', '#b8302a', '#e8b830', '#5a4f5c', '#9ab0b8', '#c49a9a'],
  GLASS: '#6a8a9a', DARK: '#1a1626', IRON: '#2c322e', TYRE: '#22222a', RIM: '#a8a49a',
  rng(seed) { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; },
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return opts.atlas || K.makeAtlas._props || (typeof PROP_TILES === 'object' ? (K.makeAtlas._props = K.makeAtlas(PROP_TILES)) : null); }, // null = no atlas available: plates / liveries are skipped
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  // extrude a side silhouette [[z, y], ...] across the car width (centred on x = 0)
  extrude(THREE, pts, width) {
    const shp = new THREE.Shape(); pts.forEach(([a, b], i) => (i ? shp.lineTo(a, b) : shp.moveTo(a, b)));
    const g = new THREE.ExtrudeGeometry(shp, { depth: width, bevelEnabled: false }); g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g;
  },
  // a flat quad from 4 points, wound to face the hint vector
  quad(THREE, a, b, c, d, hint) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const P = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3)); g.computeVertexNormals(); return g;
  },
  arch(zc, rr, y0 = 0.34, hh = 0.48) { return [[zc + rr, y0], [zc + rr * 0.95, y0 + hh * 0.54], [zc + rr * 0.72, y0 + hh * 0.875], [zc, y0 + hh], [zc - rr * 0.72, y0 + hh * 0.875], [zc - rr * 0.95, y0 + hh * 0.54], [zc - rr, y0]]; },
  // per-model description: silhouette (top path rear->front, then arches), glass polygons, lights, wheels, seats
  spec(kind) {
    if (kind === 'hatch') return {
      L: 3.95, W: 1.75, H: 1.5, zf: 1.2, zr: -1.2, wr: 0.32, top: [[-1.97, 0.34], [-2.0, 0.64], [-1.97, 1.1], [-1.6, 1.48], [0.45, 1.5], [0.98, 1.0], [1.75, 0.92], [1.93, 0.82], [1.99, 0.56], [1.96, 0.34]],
      sideWin: [[[0.9, 1.04], [0.5, 1.42], [-0.08, 1.42], [-0.08, 1.04]], [[-0.22, 1.04], [-0.22, 1.42], [-1.5, 1.42], [-1.78, 1.04]]], front: [[0.9, 1.03], [0.5, 1.45]], back: [[-1.85, 1.08], [-1.58, 1.45]], noseZ: 1.995, tailZ: -2.005,
      seats: [[0.4, 0.62, 0.15], [-0.4, 0.62, 0.15]],
    };
    return {
      L: 4.5, W: 1.8, H: 1.5, zf: 1.35, zr: -1.4, wr: 0.33, top: [[-2.25, 0.34], [-2.28, 0.62], [-2.22, 0.9], [-1.55, 0.98], [-1.0, 1.44], [0.55, 1.46], [1.05, 0.98], [2.0, 0.9], [2.2, 0.8], [2.27, 0.55], [2.25, 0.34]],
      sideWin: [[[0.95, 1.03], [0.55, 1.4], [-0.05, 1.4], [-0.05, 1.03]], [[-0.2, 1.03], [-0.2, 1.4], [-0.95, 1.4], [-1.4, 1.03]]], front: [[1.03, 1.0], [0.62, 1.43]], back: [[-1.5, 1.0], [-1.05, 1.42]], noseZ: 2.275, tailZ: -2.285,
      seats: [[0.4, 0.62, 0.2], [-0.4, 0.62, 0.2]],
    };
  },
  // merged coloured geometry: [[geom, colour], ...] -> one non-indexed geometry with a colour attribute
  merge(THREE, list) {
    const P = [], N = [], Cc = [];
    for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m;
  },
  wheelGeo(K, r, w, rim) {
    const THREE = K.THREE, list = [[new THREE.CylinderGeometry(r, r, w, 12).rotateZ(Math.PI / 2), VC.TYRE], [new THREE.CylinderGeometry(r * 0.58, r * 0.58, w * 1.02, 10).rotateZ(Math.PI / 2), VC.tone(rim, 0.8)]];
    for (let i = 0; i < 5; i++) list.push([VC.box(THREE, w * 1.07, r * 0.13, r * 0.95).rotateX((i * Math.PI * 2) / 5).translate(0, 0, 0), rim]);
    return VC.merge(THREE, list);
  },
  // the car model as a list of ops {t:'s'|'g'|'d', g, col, ol, tile}; coordinates are car-local (origin between the axles' ground line, +Z forward)
  model(K, kind, opts, A) {
    const THREE = K.THREE, S = VC.spec(kind), ops = [], R = VC.rng(opts.seed ?? 1), body = opts.paint || VC.PAINT[Math.floor(R() * VC.PAINT.length)];
    const s = (g, col, ol = false) => ops.push({ t: 's', g, col, ol }), gl = (g, col) => ops.push({ t: 'g', g, col }), W2 = S.W / 2;
    const pts = S.top.slice(); pts.push(...VC.arch(S.zf, 0.43), ...VC.arch(S.zr, 0.43));
    s(VC.extrude(THREE, pts, S.W), body, true);
    // glass: front side windows are left open (dark) so the heroes can lean out, rear ones are glass
    S.sideWin.forEach((poly, wi) => { for (const sx of [-1, 1]) { const shp = new THREE.Shape(); poly.forEach(([a, b], i) => (i ? shp.lineTo(a, b) : shp.moveTo(a, b))); const g = new THREE.ExtrudeGeometry(shp, { depth: 0.014, bevelEnabled: false }); g.translate(0, 0, -0.007); g.rotateY(-Math.PI / 2); g.translate(sx * (W2 + 0.004), 0, 0); s(g, wi === 0 ? VC.DARK : VC.GLASS); } });
    const [fz0, fy0] = S.front[0], [fz1, fy1] = S.front[1];
    s(VC.quad(THREE, [-W2 + 0.1, fy0 + 0.01, fz0 + 0.005], [W2 - 0.1, fy0 + 0.01, fz0 + 0.005], [W2 - 0.14, fy1, fz1 + 0.005], [-W2 + 0.14, fy1, fz1 + 0.005], [0, 0.6, 1]), VC.GLASS);
    s(VC.quad(THREE, [-W2 + 0.1, S.back[0][1] + 0.01, S.back[0][0] - 0.005], [W2 - 0.1, S.back[0][1] + 0.01, S.back[0][0] - 0.005], [W2 - 0.14, S.back[1][1], S.back[1][0] - 0.005], [-W2 + 0.14, S.back[1][1], S.back[1][0] - 0.005], [0, 0.6, -1]), VC.GLASS);
    // bumpers, grille, seams, mirrors, plates, lights
    s(VC.box(THREE, S.W - 0.05, 0.16, 0.12).translate(0, 0.44, S.noseZ - 0.02), VC.IRON); s(VC.box(THREE, S.W - 0.05, 0.16, 0.12).translate(0, 0.44, S.tailZ + 0.02), VC.IRON);
    s(VC.box(THREE, 0.7, 0.16, 0.05, 'nz').translate(0, 0.66, S.noseZ - 0.005), VC.DARK);
    for (const sx of [-1, 1]) { for (const sz of [0.5, -0.12]) s(VC.quad(THREE, [sx * (W2 + 0.006), 1.0, sz], [sx * (W2 + 0.006), 1.0, sz - 0.02], [sx * (W2 + 0.006), 0.4, sz - 0.02], [sx * (W2 + 0.006), 0.4, sz], [sx, 0, 0]), VC.tone(body, 0.55));
      s(VC.box(THREE, 0.16, 0.1, 0.07).translate(sx * (W2 + 0.07), 1.02, 0.62), body); }
    const head = (sx) => new THREE.PlaneGeometry(0.3, 0.13).translate(sx * 0.62, 0.7, S.noseZ + 0.008), tail = (sx) => new THREE.PlaneGeometry(0.3, 0.12).rotateY(Math.PI).translate(sx * 0.62, 0.74, S.tailZ - 0.008);
    for (const sx of [-1, 1]) { s(head(sx), '#e8e0c8'); gl(head(sx).translate(0, 0, 0.004), '#ffe08a'); s(tail(sx), '#8a2a22'); gl(tail(sx).translate(0, 0, -0.004), '#ff3a1c'); }
    if (A) { ops.push({ t: 'd', g: new THREE.PlaneGeometry(0.34, 0.17).rotateY(Math.PI).translate(0, 0.62, S.tailZ - 0.012), tile: 'plate' }); ops.push({ t: 'd', g: new THREE.PlaneGeometry(0.34, 0.17).translate(0, 0.42, S.noseZ + 0.07), tile: 'plate' }); }
    return { ops, S, body };
  },
  wheels(S) { return [[1, 1], [-1, 1], [1, 0], [-1, 0]].map(([sx, fr]) => ({ x: sx * (S.W / 2 - 0.12), y: S.wr, z: fr ? S.zf : S.zr, r: S.wr, w: 0.24, front: !!fr })); },
};


// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vcFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

function vcVehicle(K, opts, kind) {
  const THREE = K.THREE, A = VC.atlas(K, opts), out = K.makeOut(), M = VC.model(K, kind, opts, !!A), S = M.S;
  for (const o of M.ops) { if (o.t === 's') out.solid(o.g, o.col, o.ol); else if (o.t === 'g') out.glow(o.g, o.col); else out.decal(o.g, A, o.tile); }
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build());
  const mat = K.toonMat(), wheels = [], rim = VC.RIM;
  for (const w of VC.wheels(S)) {
    const steer = new THREE.Group(); steer.position.set(w.x, w.y, w.z); const mesh = new THREE.Mesh(VC.wheelGeo(K, w.r, w.w, rim), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: w.r, front: w.front });
    if (w.x < 0) mesh.rotation.y = 0;
  }
  const seats = S.seats.map(([x, y, z], i) => ({ x, y, z, ang: 0, pose: 'lean_out', side: i ? 'right' : 'left' })), collider = vcFit(THREE, bob, seats, { w: S.W + 0.1, h: S.H });
  return {
    root, kind: 'car', seats, collider, waterline: 0, parts: { bob, wheels },
    animate(v, dt, speed = 0, steerIn = 0, t = 0) {
      for (const w of wheels) { w.mesh.rotation.x += (speed * dt) / w.r; if (w.front) w.steer.rotation.y = Math.max(-1, Math.min(1, steerIn)) * 0.5; }
      bob.rotation.z = -steerIn * Math.min(Math.abs(speed), 8) * 0.004; bob.position.y = Math.abs(speed) > 0.1 ? Math.sin(t * 9) * 0.006 : 0;
    },
  };
}
export function buildCarSedan(K, opts = {}) { return vcVehicle(K, opts, 'sedan'); }
export function buildCarHatch(K, opts = {}) { return vcVehicle(K, opts, 'hatch'); }

// ---------------------------------------------------------------- box truck (cab + cargo box with a Utz-style or MOVING & STORAGE livery)
export function buildBoxTruck(K, opts = {}) {
  const THREE = K.THREE, A = VC.atlas(K, opts), out = K.makeOut(), R = VC.rng(opts.seed ?? 1), r0 = R();
  const livery = opts.livery || (r0 < 0.5 ? 'utz' : 'move'), cab = opts.paint || (livery === 'utz' ? '#d8a828' : '#2a3f6a'), W = 2.3, L = 6.4;
  const s = (g, col, ol = false) => out.solid(g, col, ol), B = (w, h, d, x, y, z, col, o = {}) => out.solid(VC.box(THREE, w, h, d, o.skip).translate(x, y, z), col, !!o.ol);
  // cab: extruded side silhouette; cargo box on the chassis behind it
  const cabPts = [[0.6, 0.55], [0.6, 2.5], [1.9, 2.55], [2.55, 1.7], [3.1, 1.5], [3.17, 1.2], [3.17, 0.65], [3.1, 0.55]].concat(VC.arch(2.15, 0.58, 0.55, 0.62));
  s(VC.extrude(THREE, cabPts, W - 0.2), cab, true);
  B(W, 0.3, L - 0.6, 0, 0.62, -0.1, VC.IRON, { skip: 'ny' });                                           // chassis rail
  B(W, 2.3, 4.2, 0, 1.92, -1.55, livery === 'utz' ? '#eae6dc' : '#3a5a8a', { skip: 'ny', ol: true });     // the cargo box
  if (A) for (const sx of [-1, 1]) out.decal(new THREE.PlaneGeometry(4.0, 4.0 * 112 / 320).rotateY(sx * Math.PI / 2).translate(sx * (W / 2 + 0.012), 1.95, -1.55), A, livery === 'utz' ? 'truck_utz' : 'truck_move');
  for (const x of [-0.55, 0, 0.55]) B(0.05, 2.0, 0.04, x, 1.95, -3.66, VC.tone('#6f6a62', 0.8), { skip: 'ny' });
  B(W - 0.2, 0.1, 0.1, 0, 0.78, -3.7, VC.IRON, { skip: 'ny' });                                         // rear bumper
  s(VC.quad(THREE, [-0.82, 1.78, 2.54], [0.82, 1.78, 2.54], [0.82, 2.44, 1.95], [-0.82, 2.44, 1.95], [0, 0.7, 1]), VC.GLASS);
  for (const sx of [-1, 1]) { const poly = [[2.35, 1.78], [1.85, 2.4], [0.85, 2.4], [0.85, 1.78]], shp = new THREE.Shape(); poly.forEach(([a, b], i) => (i ? shp.lineTo(a, b) : shp.moveTo(a, b))); const g = new THREE.ExtrudeGeometry(shp, { depth: 0.014, bevelEnabled: false }); g.translate(0, 0, -0.007); g.rotateY(-Math.PI / 2); g.translate(sx * (W / 2 - 0.1 + 0.005), 0, 0); s(g, VC.DARK); }
  B(1.5, 0.35, 0.08, 0, 0.95, 3.17, VC.IRON, { skip: 'nz' }); B(W - 0.1, 0.2, 0.15, 0, 0.5, 3.15, VC.IRON, { skip: 'ny' });
  for (const sx of [-1, 1]) { const hl = new THREE.PlaneGeometry(0.34, 0.16).translate(sx * 0.82, 1.1, 3.18); s(hl, '#e8e0c8'); out.glow(hl.clone().translate(0, 0, 0.004), '#ffe08a'); const tl = new THREE.PlaneGeometry(0.2, 0.34).rotateY(Math.PI).translate(sx * 0.98, 0.95, -3.704); s(tl, '#8a2a22'); out.glow(tl.clone().translate(0, 0, -0.004), '#ff3a1c'); }
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build());
  const mat = K.toonMat(), wheels = [];
  for (const [sx, z, fr] of [[1, 2.15, 1], [-1, 2.15, 1], [1, -2.2, 0], [-1, -2.2, 0]]) { const steer = new THREE.Group(); steer.position.set(sx * (W / 2 - 0.12), 0.46, z); const mesh = new THREE.Mesh(VC.wheelGeo(K, 0.46, fr ? 0.3 : 0.5, '#8a9094'), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: 0.46, front: !!fr }); }
  const seats = [{ x: 0.5, y: 1.35, z: 1.55, ang: 0, pose: 'sit' }, { x: -0.5, y: 1.35, z: 1.55, ang: 0, pose: 'sit' }], collider = vcFit(THREE, bob, seats);
  return {
    root, kind: 'car', seats, collider, waterline: 0, parts: { bob, wheels },
    animate(v, dt, speed = 0, steerIn = 0, t = 0) { for (const w of wheels) { w.mesh.rotation.x += (speed * dt) / w.r; if (w.front) w.steer.rotation.y = Math.max(-1, Math.min(1, steerIn)) * 0.45; } bob.rotation.z = -steerIn * Math.min(Math.abs(speed), 8) * 0.003; bob.position.y = Math.abs(speed) > 0.1 ? Math.sin(t * 7) * 0.008 : 0; },
  };
}

// ---------------------------------------------------------------- static parked cars (merged into the chunk through `out`, base on the road y = 0)
function vcParked(K, out, x, z, ang, opts, kind, id) {
  const THREE = K.THREE, A = VC.atlas(K, opts);
  const fin = (g) => K.place(g, x, 0, z, ang);
  if (kind === 'pickup') return vcPickup(K, out, x, z, ang, opts, A);
  const M = VC.model(K, kind, opts, !!A);
  for (const o of M.ops) { if (o.t === 's') out.solid(fin(o.g), o.col, o.ol); else if (o.t === 'g') out.glow(fin(o.g), o.col); else out.decal(fin(o.g), A, o.tile); }
  for (const w of VC.wheels(M.S)) { out.solid(fin(new THREE.CylinderGeometry(w.r, w.r, w.w, 10).rotateZ(Math.PI / 2).translate(w.x, w.y, w.z)), VC.TYRE, false); out.solid(fin(new THREE.CylinderGeometry(w.r * 0.58, w.r * 0.58, w.w * 1.03, 8).rotateZ(Math.PI / 2).translate(w.x, w.y, w.z)), VC.RIM, false); }
  const hw = M.S.W / 2 + 0.05, hl = M.S.L / 2 + 0.05, p = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)]);
  const bb = { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) };
  out.coll(bb); return META.pieces[id];
}
function vcPickup(K, out, x, z, ang, opts, A) {
  const THREE = K.THREE, R = VC.rng(opts.seed ?? 1), body = opts.paint || VC.PAINT[Math.floor(R() * VC.PAINT.length)], W = 2.0, fin = (g) => K.place(g, x, 0, z, ang);
  const top = [[-2.7, 0.34], [-2.72, 0.7], [-2.7, 0.9], [-0.25, 0.9], [-0.25, 1.0], [-0.1, 1.62], [0.9, 1.68], [1.35, 1.0], [2.3, 0.98], [2.62, 0.86], [2.7, 0.6], [2.68, 0.34]];
  const pts = top.concat(VC.arch(1.6, 0.46), VC.arch(-1.7, 0.46));
  out.solid(fin(VC.extrude(THREE, pts, W)), body, true);
  const P = (g, col, ol = false) => out.solid(fin(g), col, ol);
  P(VC.box(THREE, 0.1, 0.3, 2.45, 'ny').translate(W / 2 - 0.05, 1.05, -1.5), body, true); P(VC.box(THREE, 0.1, 0.3, 2.45, 'ny').translate(-W / 2 + 0.05, 1.05, -1.5), body, true);
  P(VC.box(THREE, W - 0.1, 0.3, 0.1, 'ny').translate(0, 1.05, -2.62), body, true); P(VC.box(THREE, W - 0.1, 0.5, 0.1, 'ny').translate(0, 1.1, -0.4), body); P(VC.box(THREE, W - 0.2, 0.04, 2.3, 'ny').translate(0, 0.92, -1.5), '#3a3a40');
  for (const sx of [-1, 1]) { const poly = [[0.8, 1.04], [0.55, 1.58], [-0.05, 1.58], [-0.05, 1.04]], shp = new THREE.Shape(); poly.forEach(([a, b], i) => (i ? shp.lineTo(a, b) : shp.moveTo(a, b))); const g = new THREE.ExtrudeGeometry(shp, { depth: 0.014, bevelEnabled: false }); g.translate(0, 0, -0.007); g.rotateY(-Math.PI / 2); g.translate(sx * (W / 2 + 0.004), 0, 0); P(g, VC.GLASS); }
  P(VC.quad(THREE, [-0.82, 1.06, 1.0], [0.82, 1.06, 1.0], [0.8, 1.62, 0.62], [-0.8, 1.62, 0.62], [0, 0.6, 1]), VC.GLASS);
  P(VC.box(THREE, W - 0.05, 0.18, 0.12).translate(0, 0.46, 2.66), VC.IRON); P(VC.box(THREE, W - 0.05, 0.18, 0.12).translate(0, 0.46, -2.72), VC.IRON);
  for (const sx of [-1, 1]) { const hl = new THREE.PlaneGeometry(0.34, 0.15).translate(sx * 0.7, 0.78, 2.705); P(hl, '#e8e0c8'); out.glow(fin(hl.clone().translate(0, 0, 0.004)), '#ffe08a'); const tl = new THREE.PlaneGeometry(0.16, 0.3).rotateY(Math.PI).translate(sx * 0.9, 0.85, -2.726); P(tl, '#8a2a22'); out.glow(fin(tl.clone().translate(0, 0, -0.004)), '#ff3a1c'); }
  for (const [wx, wz] of [[1, 1.6], [-1, 1.6], [1, -1.7], [-1, -1.7]]) { out.solid(fin(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 10).rotateZ(Math.PI / 2).translate(wx * (W / 2 - 0.12), 0.38, wz)), VC.TYRE, false); out.solid(fin(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 8).rotateZ(Math.PI / 2).translate(wx * (W / 2 - 0.12), 0.38, wz)), VC.RIM, false); }
  const hw = W / 2 + 0.05, hl = 2.75, p = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)]);
  out.coll({ x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }); void A;
  return META.pieces.parked_car_pickup;
}
export function buildParkedCarSedan(K, out, x, z, ang = 0, opts = {}) { return vcParked(K, out, x, z, ang, opts, 'sedan', 'parked_car_sedan'); }
export function buildParkedCarHatchback(K, out, x, z, ang = 0, opts = {}) { return vcParked(K, out, x, z, ang, opts, 'hatch', 'parked_car_hatchback'); }
export function buildParkedCarPickup(K, out, x, z, ang = 0, opts = {}) { return vcParked(K, out, x, z, ang, opts, 'pickup', 'parked_car_pickup'); }

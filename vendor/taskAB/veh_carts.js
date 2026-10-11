// veh_carts.js — Task B: arabber_cart (painted produce cart pulled by a walking pony) and skateboard.
// Arabber cart: red / yellow / green painted wooden cart (scrollwork side panels drawn on canvas), striped canopy, bells, lantern, fruit crates,
//   two big spoked rear wheels + two small front wheels (one mesh per pair), a pony with four walking legs and a swishing tail
//   (each leg = one mesh pivoting at its shoulder / hip). Meshes: body, glow, decal, 2 wheel pairs, 4 legs, tail = 10 (+ ink hulls on the body).
// Skateboard: rounded deck with kick-tails, trucks, two wheel-pair meshes (3 meshes); the rider stands on seats[0], side-on.
// Contract: buildXxx(K, opts) -> { root, kind:'cart' | 'board', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
// steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet. No imports; no Math.random; materials only through K.makeOut / K.toonMat.
export const META_VEH_CARTS = {
  id: 'veh_carts', kind: 'vehicle',
  pieces: { arabber_cart: { id: 'arabber_cart', kind: 'cart', length: 5.9, width: 1.9 }, skateboard: { id: 'skateboard', kind: 'board', length: 0.9, width: 0.24 } },
};

const VT_ATLAS = new WeakMap(); // fix m6
const VT = {
  RED: '#b8302a', YEL: '#e8b830', GREEN: '#2f5a3a', WOOD: '#9a6a44', IRON: '#2c322e', CREAM: '#eae6dc',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return opts.atlas || VT_ATLAS.get(K) || (typeof PROP_TILES === 'object' ? (VT_ATLAS.set(K, K.makeAtlas(PROP_TILES)), VT_ATLAS.get(K)) : (() => { throw new Error('veh_carts: pass opts.atlas = K.makeAtlas(PROP_TILES) (PROP_TILES is not in scope)'); })()); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  tube(THREE, p0, p1, r0, r1, seg = 6) { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  spokedWheel(THREE, r, x, spokes = 10) { const L = [[new THREE.TorusGeometry(r, 0.045, 5, 14).rotateY(Math.PI / 2), VT.YEL], [new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateZ(Math.PI / 2), VT.RED]]; for (let i = 0; i < spokes; i++) L.push([VT.box(THREE, 0.04, r * 1.9, 0.045).rotateX((i * Math.PI) / spokes), VT.WOOD]); return L.map(([g, c]) => [g.translate(x, 0, 0), c]); },
  shape(K, out) { const THREE = K.THREE; return { THREE,
    s: (g, col, ol = false) => out.solid(g, col, ol),
    B: (w, h, d, x, y, z, col, o = {}) => { const g = VT.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    Sp: (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    T: (p0, p1, r0, r1, seg, col, o = {}) => out.solid(VT.tube(THREE, p0, p1, r0, r1, seg), col, !!o.ol) }; },
};


// the inside of a one-sided shell (canopy underside): same triangles, reversed winding + normals
function vtFlip(g0) { const g = g0.clone(), ix = g.index.array.slice(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(Array.from(ix)); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return g; }

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vtFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

// ---------------------------------------------------------------- arabber cart + pony
export function buildArabberCart(K, opts = {}) {
  const A = VT.atlas(K, opts), out = K.makeOut(), { THREE, s, B, Sp, T } = VT.shape(K, out), mat = K.toonMat(), RED = VT.RED, YEL = VT.YEL, GRN = VT.GREEN;
  // chassis, floor, painted side panels, end boards, driver bench, shafts
  B(1.5, 0.1, 2.7, 0, 0.78, -0.9, VT.WOOD, { skip: 'ny', ol: true }); B(1.62, 0.1, 2.8, 0, 0.87, -0.9, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) {
    B(0.07, 0.85, 2.7, sx * 0.78, 1.3, -0.9, RED, { skip: 'ny', ol: true });
    out.decal(new THREE.PlaneGeometry(2.6, 2.6 * 112 / 256).rotateY(sx * Math.PI / 2).translate(sx * 0.82, 1.3, -0.9), A, 'arabber_side');
    T([sx * 0.45, 0.82, 0.4], [sx * 0.5, 0.92, 2.15], 0.04, 0.035, 6, VT.WOOD);                                                                 // shafts to the pony
  }
  B(1.5, 0.85, 0.07, 0, 1.3, 0.45, GRN, { skip: 'ny', ol: true }); B(1.5, 0.85, 0.07, 0, 1.3, -2.25, GRN, { skip: 'ny', ol: true });
  B(1.4, 0.07, 0.5, 0, 1.2, 0.1, VT.WOOD, { skip: 'ny' });                                                                                         // driver's bench
  // canopy over the rear: striped half-barrel on four posts, scalloped valance, bells
  for (const [px, pz] of [[0.76, -0.1], [-0.76, -0.1], [0.76, -2.15], [-0.76, -2.15]]) B(0.05, 1.0, 0.05, px, 2.1, pz, GRN, { skip: 'ny' });
  for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 3, 1, true, Math.PI / 2 + (i * Math.PI) / 6, Math.PI / 6); g.rotateX(Math.PI / 2); g.translate(0, 2.62, -1.15); s(g, i % 2 ? YEL : RED); s(vtFlip(g), VT.tone(i % 2 ? YEL : RED, 0.8), false); } // theta pi/2..3pi/2 = the arc OVER the cart after rotateX (fix M2)
  for (let i = 0; i < 9; i++) { const x = -0.8 + i * 0.2; s(new THREE.CircleGeometry(0.1, 3).rotateZ(Math.PI / 2).translate(x, 2.58 - Math.abs(x) * 0.0, 0.07), i % 2 ? YEL : RED); }
  for (const x of [-0.5, 0, 0.5]) { Sp(0.05, 6, 4, 1, 1, 1, x, 2.32, 0.08, '#c8a040'); }
  B(0.1, 0.14, 0.1, 0.7, 2.45, 0.1, VT.IRON, { skip: 'ny' }); out.glow(new THREE.OctahedronGeometry(0.1, 0).translate(0.7, 2.28, 0.1), '#ffbf3c');   // hanging lantern (night glow)
  // produce: crates with fruit
  for (const [cx, cz, c] of [[-0.35, -1.2, VT.WOOD], [0.35, -1.2, VT.WOOD], [0, -1.85, VT.tone(VT.WOOD, 0.85)]]) { B(0.62, 0.3, 0.55, cx, 1.02, cz, c, { skip: 'ny', ol: true }); }
  [['#ff9f1c', -0.35, -1.2], ['#c8302a', 0.35, -1.2], ['#7fb04a', 0, -1.85]].forEach(([c, fx, fz]) => { for (let i = 0; i < 3; i++) Sp(0.11, 6, 4, 1, 1, 1, fx + (i - 1) * 0.17, 1.24, fz + (i % 2) * 0.12 - 0.05, c); });
  // the pony: ellipsoid body, tube neck, head, ears, mane, harness (legs and tail are moving meshes below)
  const body = '#8a4a3a', dark = '#3a2a22', zc = 2.1;
  Sp(0.4, 9, 6, 1, 1, 2.05, 0, 1.28, zc, body, { ol: true }); Sp(0.33, 7, 5, 1, 1, 1, 0, 1.33, zc + 0.75, body); Sp(0.36, 7, 5, 1, 1, 1, 0, 1.3, zc - 0.7, body);
  T([0, 1.48, zc + 0.85], [0, 1.95, zc + 1.2], 0.19, 0.13, 7, body, { ol: true }); Sp(0.17, 7, 5, 1, 0.95, 1.7, 0, 1.97, zc + 1.45, body, { ol: true, rot: [0.5, 0, 0] }); Sp(0.12, 6, 4, 1, 1, 1.2, 0, 1.82, zc + 1.7, VT.tone(body, 0.8));
  for (const sx of [-1, 1]) { s(new THREE.ConeGeometry(0.05, 0.16, 5).translate(sx * 0.09, 2.2, zc + 1.28), body); Sp(0.025, 5, 4, 1, 1, 1, sx * 0.13, 2.02, zc + 1.5, dark); }
  for (let i = 0; i < 5; i++) B(0.05, 0.14, 0.08, 0, 1.78 + i * 0.07 + (i > 2 ? 0.04 : 0), zc + 0.78 + i * 0.1, dark, { rot: [0.6, 0, 0], skip: 'ny' });
  B(0.84, 0.05, 0.06, 0, 1.63, zc + 0.3, RED, { skip: 'ny' }); B(0.84, 0.05, 0.06, 0, 1.6, zc - 0.35, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) B(0.04, 0.5, 0.05, sx * 0.4, 1.38, zc + 0.3, RED, { skip: 'ny' });
  // the arabber's rear running board: the 'stand' seat's feet rest on it (fix m4)
  B(1.1, 0.06, 0.32, 0, 0.47, -2.43, VT.WOOD, { skip: 'ny', ol: true }); for (const sx of [-0.45, 0.45]) B(0.05, 0.36, 0.05, sx, 0.66, -2.31, VT.IRON, { skip: 'ny' });
  const { root, bob } = (() => { const r = new THREE.Group(), b = new THREE.Group(); r.add(b); b.add(out.build()); return { root: r, bob: b }; })();
  // wheels: two big rear wheels (one mesh, they turn together) and two small front ones
  const rear = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.62, 0.84), ...VT.spokedWheel(THREE, 0.62, -0.84)]), mat), front = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.42, 0.78, 8), ...VT.spokedWheel(THREE, 0.42, -0.78, 8)]), mat);
  rear.position.set(0, 0.62, -1.2); front.position.set(0, 0.42, -0.15); rear.castShadow = front.castShadow = true; bob.add(rear, front);
  // legs: pivot at the shoulder / hip, two segments + hoof each; tail: tube pivoting at the croup
  const legs = []; for (const [lx, lz, ph] of [[0.2, zc + 0.78, 0], [-0.2, zc + 0.78, Math.PI], [0.2, zc - 0.72, Math.PI], [-0.2, zc - 0.72, 0]]) {
    const g = VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.5, 0.02], 0.11, 0.075, 6), body], [VT.tube(THREE, [0, -0.5, 0.02], [0, -0.9, 0], 0.06, 0.05, 6), VT.tone(body, 0.85)], [VT.box(THREE, 0.11, 0.1, 0.16).translate(0, -0.95, 0.02), dark]]);
    const m = new THREE.Mesh(g, mat); m.position.set(lx, 1.0, lz); m.castShadow = true; bob.add(m); legs.push({ m, ph }); // shoulder / hip pivot at 1.0 so the 1.0 m legs put the hooves on y = 0 (fix M3)
  }
  const tail = new THREE.Mesh(VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.35, -0.2], 0.05, 0.08, 6), dark], [VT.tube(THREE, [0, -0.35, -0.2], [0, -0.75, -0.25], 0.08, 0.02, 6), dark]]), mat); tail.position.set(0, 1.45, zc - 1.0); tail.castShadow = true; bob.add(tail);
  const seats = [{ x: 0, y: 1.24, z: 0.12, ang: 0, pose: 'sit' }, { x: 0, y: 0.5, z: -2.43, ang: 0, pose: 'stand' }], collider = vtFit(THREE, bob, seats); // 'stand' = on the new rear step (fix m4)
  return {
    root, kind: 'cart', waterline: 0, collider, parts: { bob, rear, front, legs, tail }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) {
      rear.rotation.x += (speed * dt) / 0.62; front.rotation.x += (speed * dt) / 0.42;
      const k = Math.min(1, Math.abs(speed) / 2), ph = t * (2.2 + Math.abs(speed) * 1.1);
      for (const l of legs) l.m.rotation.x = Math.sin(ph + l.ph) * 0.55 * k;
      tail.rotation.z = Math.sin(t * 2.4) * 0.35; tail.rotation.x = 0.25 + Math.sin(t * 1.7) * 0.12;
      bob.position.y = Math.abs(Math.sin(ph)) * 0.03 * k; bob.rotation.z = -steer * 0.03 * k;
    },
  };
}

// ---------------------------------------------------------------- skateboard
export function buildSkateboard(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, T } = VT.shape(K, out), mat = K.toonMat(), paint = opts.paint || '#ff3d6e';
  const plan = [[-0.1, -0.34], [0.1, -0.34], [0.12, -0.3], [0.12, 0.3], [0.1, 0.34], [-0.1, 0.34], [-0.12, 0.3], [-0.12, -0.3]];
  const shp = new THREE.Shape(); plan.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z)));
  const deck = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: false }); deck.rotateX(-Math.PI / 2); s(deck.translate(0, 0.095, 0), paint, true);
  const grip = new THREE.ExtrudeGeometry(shp, { depth: 0.006, bevelEnabled: false }); grip.rotateX(-Math.PI / 2); grip.scale(0.9, 1, 0.94); s(grip.translate(0, 0.125, 0), '#2c322e', false);
  for (const sz of [-1, 1]) { B(0.22, 0.03, 0.12, 0, 0.115, sz * 0.4, paint, { rot: [sz * -0.35, 0, 0], skip: 'ny', ol: true }); B(0.2, 0.012, 0.1, 0, 0.14, sz * 0.4, '#2c322e', { rot: [sz * -0.35, 0, 0] }); }
  for (const sz of [-1, 1]) { B(0.14, 0.03, 0.1, 0, 0.075, sz * 0.22, '#a8a49a', { skip: 'ny' }); T([-0.13, 0.05, sz * 0.22], [0.13, 0.05, sz * 0.22], 0.015, 0.015, 6, '#6f6a62'); }
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build());
  const wheels = [0.22, -0.22].map((z) => { const m = new THREE.Mesh(VT.merge(THREE, [-0.15, 0.15].map((x) => [new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10).rotateZ(Math.PI / 2).translate(x, 0, 0), '#eae6dc'])), mat); m.position.set(0, 0.05, z); m.castShadow = true; bob.add(m); return m; });
  const seats = [{ x: 0, y: 0.13, z: 0, ang: Math.PI / 2, pose: 'stand' }], collider = vtFit(THREE, bob, seats);
  return {
    root, kind: 'board', waterline: 0, collider, parts: { bob, wheels }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { for (const w of wheels) w.rotation.x += (speed * dt) / 0.04; bob.rotation.z = -steer * 0.22; bob.rotation.x = Math.min(Math.abs(speed), 6) * 0.004; },
  };
}

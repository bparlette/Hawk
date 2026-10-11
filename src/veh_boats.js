// veh_boats.js — Task B: rideable boats: water_taxi (~9 m covered harbour launch), paddle_boat (two-seat swan pedal boat), dragon_boat (~12 m racing boat).
// Hulls are lofted from a few stations into flat-shaded shells (outer skin, inner skin and gunwale rim, so open boats look right from above).
// Each vehicle is root > bob > [ merged static body (out.build(): toon + ink hull + glow + decal), moving parts ]. The game owns `root`
// (position / yaw); animate() only moves `bob` (bobbing on the water) and the moving parts. The dragon boat's 20 paddles are ONE mesh whose
// vertices are rotated about each paddle's own shoulder every frame (a few hundred vertices: cheap), so the whole boat is 4 meshes.
// Contract: buildXxx(K, opts) -> { root, kind:'boat', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z; `waterline` is the local
// y that sits on the water surface (K.WY), so root.position.y = WY - waterline. steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet.
// Real flavour: harbour water-taxi lettering and colours (white hull, navy stripe, gold band, blue block letters) redrawn on canvas, no logo files.
// No imports; no Math.random; materials only through K.makeOut / K.toonMat. opts.atlas = K.makeAtlas(PROP_TILES) (else the PROP_TILES global).
export const META = {
  id: 'veh_boats', kind: 'vehicle',
  pieces: { water_taxi: { id: 'water_taxi', kind: 'boat', length: 9.2, beam: 2.9 }, paddle_boat: { id: 'paddle_boat', kind: 'boat', length: 3.4, beam: 1.7 }, dragon_boat: { id: 'dragon_boat', kind: 'boat', length: 13.6, beam: 1.2 } },
};

const VB = {
  IRON: '#2c322e', GLASS: '#6a8a9a', DARK: '#1a1626', CREAM: '#eae6dc', NAVY: '#2a3f6a', GOLD: '#e8b830', RED: '#b8302a', WOOD: '#9a6a44',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return opts.atlas || (K.makeAtlas._props || (K.makeAtlas._props = K.makeAtlas(PROP_TILES))); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  // lofted hull shell. st = [{ z, hw, y0, y1, c, w }] stern -> bow. Returns flat-shaded pieces: { low, high, inner, rim, stern } (BufferGeometry each)
  shell(THREE, st, th = 0.07) {
    const mk = () => ({ P: [] }), low = mk(), high = mk(), inner = mk(), rim = mk(), stern = mk();
    const sec = (s, k, side) => { const hw = Math.max(0.0, s.hw - k), y0 = s.y0 + (k ? k * 0.8 : 0), y1 = s.y1; return [[0, y0, s.z], [side * hw * (s.w ?? 0.7), y0 + (y1 - y0) * (s.c ?? 0.32), s.z], [side * hw, y1, s.z]]; };
    const tri = (G, a, b, c, hint) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) G.P.push(...a, ...c, ...b); else G.P.push(...a, ...b, ...c); };
    const quad = (G, a, b, c, d, hint) => { tri(G, a, b, c, hint); tri(G, a, c, d, hint); };
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
      const A = sec(st[i], 0, side), B = sec(st[i + 1], 0, side), hint = j === 0 ? [side * 0.6, -0.8, 0] : [side, 0.15, 0];
      quad(j === 0 ? low : high, A[j], A[j + 1], B[j + 1], B[j], hint);
      const Ai = sec(st[i], th, side), Bi = sec(st[i + 1], th, side); quad(inner, Ai[j], Ai[j + 1], Bi[j + 1], Bi[j], [-side * 0.6, 0.8, 0]);
    }
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) { const A = sec(st[i], 0, side)[2], B = sec(st[i + 1], 0, side)[2], Ai = sec(st[i], th, side)[2], Bi = sec(st[i + 1], th, side)[2]; quad(rim, A, B, Bi, Ai, [0, 1, 0]); }
    const s0 = st[0]; const o = [sec(s0, 0, -1)[2], sec(s0, 0, -1)[1], sec(s0, 0, 1)[1], sec(s0, 0, 1)[2]], ii = [sec(s0, th, -1)[2], sec(s0, th, -1)[1], sec(s0, th, 1)[1], sec(s0, th, 1)[2]];
    quad(stern, o[0], o[3], o[2], o[1], [0, 0, -1]); quad(stern, ii[0], ii[3], ii[2], ii[1], [0, 0, 1]); quad(stern, o[3], o[0], ii[0], ii[3], [0, 1, 0]);
    const out = {}; for (const [k, G] of Object.entries({ low, high, inner, rim, stern })) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G.P), 3)); g.computeVertexNormals(); out[k] = g; }
    return out;
  },
  // a flat top-view polygon [[x, z], ...] raised to height h, bottom at y0
  skin(st, z) { let i = 0; while (i + 2 < st.length && z > st[i + 1].z) i++; const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), L = (p, q) => p + (q - p) * t; return { hw: L(a.hw, b.hw), y0: L(a.y0, b.y0), y1: L(a.y1, b.y1), c: L(a.c ?? 0.32, b.c ?? 0.32), w: L(a.w ?? 0.7, b.w ?? 0.7) }; },
  slab(THREE, pts, y0, h) { const shp = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z))); const g = new THREE.ExtrudeGeometry(shp, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; },
  quad(THREE, a, b, c, d, hint) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const P = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3)); g.computeVertexNormals(); return g; },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  shape(K, out) { const THREE = K.THREE, s = (g, col, ol = false) => out.solid(g, col, ol), B = (w, h, d, x, y, z, col, o = {}) => { const g = VB.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const C = (rt, rb, h, seg, x, y, z, col, o = {}) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const Sp = (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const T = (p0, p1, r0, r1, seg, col, o = {}) => { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); out.solid(g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), col, !!o.ol); };
    const GL = (g, col) => out.glow(g, col); return { THREE, s, B, C, Sp, T, GL }; },
  assemble(K, out) { const THREE = K.THREE, root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); return { root, bob }; },
};

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vbFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

const vbBob = (bob, t, speed, steer, k = 1) => { bob.position.y = Math.sin(t * 1.7) * 0.035 * k; bob.rotation.z = Math.sin(t * 1.15) * 0.018 * k - steer * Math.min(Math.abs(speed), 8) * 0.004; bob.rotation.x = Math.sin(t * 1.35 + 1) * 0.012 * k - Math.min(Math.abs(speed), 8) * 0.004; };

// ---------------------------------------------------------------- water taxi
export function buildWaterTaxi(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, GL } = VB.shape(K, out), WHITE = VB.CREAM, YEL = VB.GOLD;
  const st = [{ z: -4.5, hw: 1.05, y0: 0.14, y1: 1.0 }, { z: -3.8, hw: 1.3, y0: 0.06, y1: 1.0 }, { z: -2.0, hw: 1.4, y0: 0.0, y1: 1.0 }, { z: 0, hw: 1.42, y0: 0.0, y1: 1.0 }, { z: 2.0, hw: 1.35, y0: 0.02, y1: 1.02 }, { z: 3.3, hw: 1.05, y0: 0.08, y1: 1.08 }, { z: 4.1, hw: 0.6, y0: 0.2, y1: 1.16 }, { z: 4.6, hw: 0.05, y0: 0.5, y1: 1.24 }];
  const sh = VB.shell(THREE, st, 0.08); s(sh.low, VB.NAVY, true); s(sh.high, WHITE, true); s(sh.inner, VB.tone(WHITE, 0.8)); s(sh.rim, YEL); s(sh.stern, WHITE);
  s(VB.slab(THREE, [[-1.2, -4.2], [1.2, -4.2], [1.28, 2.6], [1.0, 3.2], [0.55, 4.0], [0, 4.45], [-0.55, 4.0], [-1.0, 3.2], [-1.28, 2.6]], 0.86, 0.06), '#9a8a74');            // deck
  for (const sx of [-1, 1]) {
    B(0.1, 0.95, 5.7, sx * 1.22, 1.45, -0.9, WHITE, { skip: 'ny', ol: true });                                                                                                   // lower cabin wall
    out.decal(new THREE.PlaneGeometry(3.8, 0.95).rotateY(sx * Math.PI / 2).translate(sx * 1.28, 1.45, -0.9), A, 'taxi_side');
    for (let i = 0; i < 6; i++) { const z = -3.45 + i * 1.0; B(0.12, 0.68, 0.12, sx * 1.22, 2.26, z, WHITE, { skip: 'ny' }); }
    for (let i = 0; i < 5; i++) { const z = -2.95 + i * 1.0, g = VB.quad(THREE, [sx * 1.255, 1.95, z - 0.4], [sx * 1.255, 1.95, z + 0.4], [sx * 1.255, 2.58, z + 0.4], [sx * 1.255, 2.58, z - 0.4], [sx, 0, 0]); s(g, VB.GLASS); GL(g.clone().translate(sx * 0.012, 0, 0), '#ffe08a'); }
    B(0.45, 0.45, 4.4, sx * 0.95, 1.1, -1.2, VB.tone(VB.NAVY, 1.2), { skip: 'ny' }); B(0.07, 0.55, 4.4, sx * 1.12, 1.62, -1.2, VB.tone(VB.NAVY, 1.4), { skip: 'ny' });  // benches
    C(0.1, 0.1, 7.4, 6, sx * 1.46, 0.9, 0.1, '#22222a', { open: true, rot: [Math.PI / 2, 0, 0] });                                                                            // rubber fender
  }
  B(2.7, 0.1, 6.1, 0, 2.66, -0.95, YEL, { skip: 'ny', ol: true }); B(2.5, 0.06, 0.1, 0, 2.55, 2.0, WHITE, { skip: 'ny' });
  B(2.45, 0.95, 0.1, 0, 1.45, 2.0, WHITE, { skip: 'ny', ol: true }); out.decal(new THREE.PlaneGeometry(2.0, 1.0).translate(0, 1.45, 2.056), A, 'taxi_bow');
  B(2.45, 0.95, 0.1, 0, 1.45, -3.85, WHITE, { skip: 'ny' });
  const wsh = VB.quad(THREE, [-1.2, 1.95, 2.0], [1.2, 1.95, 2.0], [1.2, 2.6, 1.9], [-1.2, 2.6, 1.9], [0, 0.3, 1]); s(wsh, VB.GLASS); GL(wsh.clone().translate(0, 0, 0.012), '#ffe08a');
  B(1.2, 0.75, 0.55, -0.45, 1.3, 1.5, VB.tone(VB.NAVY, 0.9), { skip: 'ny', ol: true }); B(0.7, 0.04, 0.3, -0.45, 1.71, 1.45, '#3a5a8a');                                   // console
  for (const [px, pz] of [[-1.0, 1.75], [0.0, 1.75]]) GL(new THREE.PlaneGeometry(0.12, 0.08).rotateX(-Math.PI / 2).translate(px, 1.74, pz), '#ffbf3c');
  s(new THREE.TorusGeometry(0.17, 0.022, 5, 10).rotateX(Math.PI * 0.3).translate(-0.5, 1.9, 1.25), VB.IRON);                                                              // steering wheel is a moving part (below); this ring is the binnacle
  C(0.04, 0.05, 1.3, 6, 0.0, 3.3, -2.0, VB.IRON, { open: true }); GL(new THREE.OctahedronGeometry(0.09, 0).translate(0, 3.98, -2.0), '#ffe08a');                          // mast + masthead light
  s(new THREE.TorusGeometry(0.2, 0.06, 5, 10).translate(0, 1.8, -3.93), VB.RED);                                                                                           // life ring
  for (const sx of [-1, 1]) { const rp = [[0.98, 2.8], [0.88, 3.25], [0.64, 3.7]]; rp.forEach(([x, z]) => B(0.05, 0.62, 0.05, sx * x, 1.2, z, VB.IRON, { skip: 'ny' })); B(0.04, 0.04, 1.0, sx * 0.93, 1.52, 3.05, VB.IRON, { rot: [0, sx * 0.4, 0] }); B(0.04, 0.04, 0.7, sx * 0.76, 1.52, 3.5, VB.IRON, { rot: [0, sx * 0.62, 0] }); }
  GL(new THREE.OctahedronGeometry(0.09, 0).translate(1.05, 1.25, 3.2), '#ff3a1c'); GL(new THREE.OctahedronGeometry(0.09, 0).translate(-1.05, 1.25, 3.2), '#23c26b');  // port red / starboard green
  GL(new THREE.PlaneGeometry(0.5, 0.18).translate(0, 2.35, 2.03), '#ffe08a');                                                                                               // headlamp
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat(), wheel = new THREE.Mesh(VB.merge(THREE, [[new THREE.TorusGeometry(0.2, 0.025, 5, 12), VB.WOOD], ...[0, 1, 2, 3].map((i) => [VB.box(THREE, 0.03, 0.4, 0.03).rotateZ((i * Math.PI) / 4), VB.WOOD])]), mat);
  wheel.position.set(-0.5, 1.88, 1.2); wheel.rotation.x = -0.9; wheel.castShadow = true; bob.add(wheel);
  const seats = [{ x: -0.5, y: 0.9, z: 0.8, ang: 0, pose: 'stand' }, { x: 0.95, y: 1.38, z: -0.4, ang: -Math.PI / 2, pose: 'sit' }, { x: 0.95, y: 1.38, z: -1.7, ang: -Math.PI / 2, pose: 'sit' }, { x: -0.95, y: 1.38, z: -1.0, ang: Math.PI / 2, pose: 'sit' }], collider = vbFit(THREE, bob, seats, { w: 3.0, h: 2.75 });
  return {
    root, kind: 'boat', waterline: 0.35, collider, parts: { bob, wheel }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer); wheel.rotation.z = -steer * 1.4; },
  };
}

// ---------------------------------------------------------------- swan pedal boat (two seats)
export function buildPaddleBoat(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), WHITE = VB.CREAM, paint = opts.paint || '#eae6dc';
  const st = [{ z: -1.7, hw: 0.7, y0: 0.18, y1: 0.78, c: 0.4, w: 0.8 }, { z: -1.0, hw: 0.88, y0: 0.05, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0, hw: 0.9, y0: 0.0, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0.9, hw: 0.8, y0: 0.04, y1: 0.8, c: 0.4, w: 0.8 }, { z: 1.5, hw: 0.45, y0: 0.18, y1: 0.86, c: 0.4, w: 0.8 }, { z: 1.78, hw: 0.08, y0: 0.4, y1: 0.92 }];
  const sh = VB.shell(THREE, st, 0.07); s(sh.low, '#9ab0b8', true); s(sh.high, paint, true); s(sh.inner, VB.tone(paint, 0.8)); s(sh.rim, VB.GOLD); s(sh.stern, paint);
  for (const sx of [-1, 1]) Sp(0.5, 8, 5, 0.22, 0.55, 1.15, sx * 0.84, 1.0, -0.3, paint, { rot: [0.0, 0, sx * 0.45], ol: true });                                                        // wings
  const nk = [[0, 0.8, 1.2, 0.22], [0, 1.25, 1.62, 0.18], [0, 1.68, 1.72, 0.15], [0, 2.0, 1.55, 0.13]];
  for (let i = 0; i + 1 < nk.length; i++) { T(nk[i].slice(0, 3), nk[i + 1].slice(0, 3), nk[i][3], nk[i + 1][3], 7, paint, { ol: true }); Sp(nk[i + 1][3] * 1.02, 7, 5, 1, 1, 1, nk[i + 1][0], nk[i + 1][1], nk[i + 1][2], paint); }
  Sp(0.19, 8, 6, 1, 0.9, 1.15, 0, 2.15, 1.58, paint, { ol: true }); C(0.01, 0.08, 0.3, 6, 0, 2.1, 1.84, '#ff9f1c', { rot: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) Sp(0.04, 5, 4, 1, 1, 1, sx * 0.13, 2.22, 1.68, VB.DARK);
  C(0.02, 0.13, 0.7, 6, 0, 1.15, -1.9, paint, { rot: [-1.0, 0, 0] });                                                                                                       // upturned tail
  B(1.5, 0.08, 0.4, 0, 0.6, -0.3, VB.tone(paint, 0.85), { skip: 'ny' }); B(1.5, 0.45, 0.07, 0, 0.88, -0.55, VB.tone(paint, 0.85), { skip: 'ny' });                              // bench + backrest
  B(0.6, 0.18, 0.5, 0, 0.5, 0.7, VB.tone(paint, 0.7), { skip: 'ny' });
  GL(new THREE.OctahedronGeometry(0.08, 0).translate(0, 2.4, 1.6), '#ffe08a');
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  const wheelG = VB.merge(THREE, [[new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6).rotateZ(Math.PI / 2), VB.IRON], ...[0, 1, 2, 3, 4, 5].map((i) => [VB.box(THREE, 0.7, 0.34, 0.05).rotateX((i * Math.PI) / 3 + 0.2).translate(0, 0, 0), VB.RED])]);
  const wheel = new THREE.Mesh(wheelG, mat); wheel.position.set(0, 0.5, -1.65); wheel.castShadow = true; bob.add(wheel);
  const crank = new THREE.Mesh(VB.merge(THREE, [[new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).rotateZ(Math.PI / 2), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(-0.3, 0.15, 0), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(0.3, -0.15, 0), VB.IRON], [VB.box(THREE, 0.2, 0.05, 0.12).translate(-0.3, 0.3, 0), '#3a3a40'], [VB.box(THREE, 0.2, 0.05, 0.12).translate(0.3, -0.3, 0), '#3a3a40']]), mat);
  crank.position.set(0, 0.55, 0.4); crank.castShadow = true; bob.add(crank);
  const seats = [{ x: 0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }, { x: -0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.28, collider, parts: { bob, wheel, crank }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 1.2); const w = Math.min(Math.abs(speed), 6) * 1.4 + 0.3; wheel.rotation.x -= w * dt; crank.rotation.x += w * dt * 1.2; },
  };
}

// ---------------------------------------------------------------- dragon boat (12 m, dragon head and tail, 10 paddler benches, drum, 20 paddles in one animated mesh)
export function buildDragonBoat(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), RED = VB.RED, GOLD = VB.GOLD;
  const st = [{ z: -6.0, hw: 0.2, y0: 0.38, y1: 0.78, c: 0.5, w: 0.8 }, { z: -5.2, hw: 0.4, y0: 0.14, y1: 0.62, c: 0.45, w: 0.8 }, { z: -3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 0, hw: 0.6, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 5.2, hw: 0.4, y0: 0.14, y1: 0.66, c: 0.45, w: 0.8 }, { z: 6.1, hw: 0.14, y0: 0.4, y1: 0.86, c: 0.5, w: 0.8 }];
  const sh = VB.shell(THREE, st, 0.06); s(sh.low, VB.tone(RED, 0.8), true); s(sh.high, RED, true); s(sh.inner, '#e8d4a8'); s(sh.rim, GOLD); s(sh.stern, RED);
  for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) { const z = -4.75 + i * 0.95, k = VB.skin(st, z), a = Math.atan2(k.hw * (1 - k.w), (k.y1 - k.y0) * (1 - k.c)), xm = k.hw * (k.w + (1 - k.w) / 2), ym = k.y0 + (k.y1 - k.y0) * (k.c + (1 - k.c) / 2), n = [sx * Math.cos(a), Math.sin(a)];
    out.decal(new THREE.PlaneGeometry(0.9, 0.45).rotateY(sx * Math.PI / 2).rotateZ(sx * a).translate(sx * xm + n[0] * 0.012, ym + n[1] * 0.012, z), A, 'dragon_scales'); }
  for (let i = 0; i < 10; i++) B(1.0, 0.07, 0.24, 0, 0.5, -4.1 + i * 0.86, VB.WOOD, { skip: 'ny' });                                                             // paddler benches
  // dragon head on the bow: skull, snout, jaws, horns, eyes, teeth, tongue, mane
  const hx = 0, hy = 1.28, hz = 6.45;
  T([0, 0.62, 5.7], [0, 1.0, 6.2], 0.2, 0.17, 7, RED, { ol: true }); T([0, 1.0, 6.2], [0, 1.28, 6.5], 0.17, 0.15, 7, RED);
  Sp(0.3, 9, 6, 0.9, 0.85, 1.15, hx, hy + 0.15, hz + 0.1, RED, { ol: true });                                                                                    // skull
  B(0.42, 0.2, 0.55, hx, hy + 0.05, hz + 0.62, RED, { skip: 'nz', ol: true }); B(0.38, 0.1, 0.45, hx, hy - 0.2, hz + 0.55, VB.tone(RED, 0.8), { skip: 'nz', rot: [0.2, 0, 0] });  // snout + lower jaw
  for (const sx of [-1, 1]) { C(0.0, 0.07, 0.5, 6, sx * 0.17, hy + 0.58, hz - 0.1, GOLD, { rot: [-0.7, 0, sx * 0.25] }); Sp(0.075, 6, 4, 1, 1, 1, sx * 0.23, hy + 0.24, hz + 0.38, VB.CREAM); Sp(0.035, 5, 4, 1, 1, 1, sx * 0.26, hy + 0.24, hz + 0.43, VB.DARK);
    for (const z of [0.0, 0.14, 0.28]) B(0.03, 0.09, 0.05, sx * 0.14, hy - 0.14, hz + 0.72 + z * 0.0 - 0.1 + z, VB.CREAM, { skip: 'py' }); C(0.0, 0.05, 0.3, 5, sx * 0.1, hy + 0.35, hz + 0.88, GOLD, { rot: [-1.3, 0, 0] }); }
  B(0.1, 0.01, 0.4, hx, hy - 0.16, hz + 0.95, '#ff3d6e', { rot: [0.2, 0, 0] }); for (let i = 0; i < 5; i++) C(0, 0.07, 0.3, 5, 0, 1.15 + i * 0.09, 6.0 - i * 0.0 - 0.05 + i * 0.0, GOLD, { rot: [-0.3, 0, 0] });
  GL(new THREE.OctahedronGeometry(0.05, 0).translate(0.26, hy + 0.24, hz + 0.44), '#ffe08a'); GL(new THREE.OctahedronGeometry(0.05, 0).translate(-0.26, hy + 0.24, hz + 0.44), '#ffe08a');
  // tail on the stern: a tapering upswept curl with fins
  const tl = [[0, 0.5, -5.6, 0.2], [0, 0.85, -6.15, 0.17], [0, 1.4, -6.45, 0.13], [0, 1.95, -6.3, 0.09], [0, 2.3, -5.9, 0.04]];
  for (let i = 0; i + 1 < tl.length; i++) { T(tl[i].slice(0, 3), tl[i + 1].slice(0, 3), tl[i][3], tl[i + 1][3], 6, i % 2 ? GOLD : RED, { ol: i < 2 }); Sp(tl[i + 1][3] * 1.02, 6, 4, 1, 1, 1, tl[i + 1][0], tl[i + 1][1], tl[i + 1][2], i % 2 ? RED : GOLD); }
  B(0.05, 0.4, 0.3, 0, 1.75, -6.55, GOLD, { rot: [0.5, 0, 0] });
  // drum + drummer's seat at the bow, steering oar + stand at the stern
  C(0.38, 0.38, 0.5, 12, 0, 0.96, 4.6, RED, { rot: [0, 0, Math.PI / 2], ol: true }); C(0.4, 0.4, 0.04, 12, 0.26, 0.96, 4.6, '#eae6dc', { rot: [0, 0, Math.PI / 2] }); B(0.1, 0.5, 0.1, 0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' }); B(0.1, 0.5, 0.1, -0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' });
  B(0.7, 0.06, 0.3, 0, 0.55, 5.05, VB.WOOD, { skip: 'ny' });
  B(0.9, 0.08, 0.6, 0, 0.58, -5.2, VB.WOOD, { skip: 'ny' }); B(0.06, 0.06, 2.2, 0.3, 0.9, -5.6, VB.WOOD, { rot: [0.15, 0, 0] }); B(0.1, 0.4, 0.6, 0.3, 0.55, -6.55, GOLD, { skip: 'ny' });
  // lanterns for the night regatta
  for (const z of [-5.4, 5.5]) { GL(new THREE.OctahedronGeometry(0.09, 0).translate(0.0, 0.95, z), '#ffbf3c'); }
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  // 20 paddles in ONE mesh: per-paddle vertex ranges + shoulder pivots; animate() rotates each paddle about its own shoulder (synchronised stroke)
  const list = [], pivots = []; for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) { const px = sx * 0.62, py = 0.85, pz = -4.1 + i * 0.86; const g1 = VB.box(THREE, 0.045, 1.5, 0.045).translate(0, -0.35, 0), g2 = VB.box(THREE, 0.04, 0.5, 0.2).translate(0, -1.3, 0.0); list.push([g1.translate(px, py, pz), VB.WOOD], [g2.translate(px, py, pz), VB.RED]); pivots.push([px, py, pz]); }
  const pg = VB.merge(THREE, list), base = Float32Array.from(pg.attributes.position.array), baseN = Float32Array.from(pg.attributes.normal.array), perP = base.length / 3 / pivots.length;
  const paddles = new THREE.Mesh(pg, mat); paddles.castShadow = true; paddles.frustumCulled = false; bob.add(paddles);
  const stroke = (a) => { const P = pg.attributes.position.array, N = pg.attributes.normal.array, c = Math.cos(a), sn = Math.sin(a); for (let p = 0; p < pivots.length; p++) { const [px, py, pz] = pivots[p]; for (let k = 0; k < perP; k++) { const i = (p * perP + k) * 3, y = base[i + 1] - py, z = base[i + 2] - pz; P[i] = base[i]; P[i + 1] = py + y * c - z * sn; P[i + 2] = pz + y * sn + z * c; N[i] = baseN[i]; N[i + 1] = baseN[i + 1] * c - baseN[i + 2] * sn; N[i + 2] = baseN[i + 1] * sn + baseN[i + 2] * c; } } pg.attributes.position.needsUpdate = true; pg.attributes.normal.needsUpdate = true; };
  stroke(0);
  const seats = [{ x: 0, y: 1.0, z: 4.3, ang: Math.PI, pose: 'sit' }, { x: 0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: -0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: 0.1, y: 0.62, z: -5.2, ang: 0, pose: 'stand' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.22, collider, parts: { bob, paddles }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 0.9); const rate = 0.9 + Math.min(Math.abs(speed), 6) * 0.35; const ph = t * rate * 3.2; stroke(Math.sin(ph) * 0.5 - (speed > 0.1 ? 0.0 : 0.0)); },
  };
}

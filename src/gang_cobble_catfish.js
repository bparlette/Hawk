// gang_cobble_catfish.js — Toad City Baltimore, Task C: the Cobblestone Catfish (Fells Point, Pendry).
// Anthropomorphic channel catfish in a slate + teal uniform: every member wears a slate (#5f6688) fisherman's sweater with
// teal (#1fd3c6) suspenders and teal knee-high rubber boots. Wide flat heads, long barbels, a dorsal fin out of the collar.
// No imports. Everything comes in through K (toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
// Loads as its own ES module; nothing here depends on other delivery files.
export const GANG = {
  id: 'cobble_catfish', name: 'Cobblestone Catfish', animal: 'catfish', district: ['fells_point', 'pendry'],
  accent: '#5f6688', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'],
};
export const META = {
  grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  grunt_b: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  armed: { hp: 8, scale: 1, radius: 0.42, weapon: 'cobble_sling' },
  bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true },
};

// catfish proportions: same keys as K.THUG_D (hip 0.9); the wide flat head sits straight on the sweater
const CF_D = { hip: 0.9, torsoY: 0.06, neckY: 0.62, legX: 0.13, thigh: 0.4, shin: 0.41, shX: 0.31, shY: 0.5, upper: 0.29, fore: 0.27 };
const CF_C = {
  slate: '#5f6688', teal: '#1fd3c6', belly: '#d8d4c6', eye: '#e8e2c4', fin: '#56626e', rope: '#c9b48a', stone: '#6f6a62', gold: '#c8a040',
};
const CF_LOOK = {
  grunt_a: { skin: '#86907c', pants: '#6b5a44', hat: 'newsboy' },
  grunt_b: { skin: '#6e7868', pants: '#4f5a52', hat: 'beanie' },
  armed: { skin: '#8a9484', pants: '#5a5248', hat: 'headband' },
  bruiser: { skin: '#a08a5c', pants: '#3e4656', hat: 'captain', big: true, vest: true },   // a flathead: yellow-brown, wider head
};

// one spotted-skin map shared by every catfish (256², light neutral, tinted by the vertex colour). Keyed on the game's
// quality object (then THREE, then K); a failed draw is never cached.
const CF_TEX = new WeakMap();
function cfSkinTex(K) {
  const key = K.QUAL || K.THREE || K;
  if (CF_TEX.has(key)) return CF_TEX.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  if (!x) return null;
  let s = 9127; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) {                      // soft mottling
    x.fillStyle = rnd() < 0.5 ? 'rgba(206,206,206,0.35)' : 'rgba(242,242,242,0.4)';
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 8 + rnd() * 18, 0, Math.PI * 2); x.fill();
  }
  for (let i = 0; i < 150; i++) {                     // the channel catfish's scattered dark spots
    x.fillStyle = rnd() < 0.7 ? 'rgba(96,96,96,0.55)' : 'rgba(130,130,130,0.5)';
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 1.5 + rnd() * 2.5, 0, Math.PI * 2); x.fill();
  }
  const tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 1);
  CF_TEX.set(key, tex); return tex;
}

// K.part wrapper: names the mesh (for QA reports) and enforces the shadow/outline rules: outline:false => shadow:false,
// and anything under 4 cm in two dimensions gets neither an ink hull nor a shadow.
function cfPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  if ([dx, dy, dz].filter((v) => v < 0.04).length >= 2) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}
// recolour faces of a NON-INDEXED part after K.part baked its single colour: colour(x, y, z) gets the midpoint of each face's
// bounding box in the part's own geometry space and returns a palette colour or null (keep). The two triangles of a sphere
// quad share that box, so painted bands follow the rings cleanly. Paints suspenders, bellies, cuffs without extra parts.
function cfPaint(K, m, colour) {
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, col = new K.THREE.Color();
  const mid = (f, i) => (Math.min(f(i), f(i + 1), f(i + 2)) + Math.max(f(i), f(i + 1), f(i + 2))) / 2;
  const gx = (i) => p.getX(i), gy = (i) => p.getY(i), gz = (i) => p.getZ(i);
  for (let i = 0; i + 2 < p.count; i += 3) {
    const v = colour(mid(gx, i), mid(gy, i), mid(gz, i));
    if (!v) continue; col.set(v); for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b);
  }
  c.needsUpdate = true; return m;
}
// a fin: a box whose top edge is pulled back and narrowed (swept dorsal / tail fin)
function cfFin(K, w, h, d, sweep) {
  const g = K.G.box(w, h, d), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) * 0.45 - sweep); p.setX(i, p.getX(i) * 0.7); }
  p.needsUpdate = true; g.computeVertexNormals(); return g;
}

export function buildCatfish(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const { G, grp, skeleton, toonMat, INK } = K;
  if (!CF_LOOK[member]) member = 'grunt_a';
  const L = CF_LOOK[member], big = !!L.big, lod = opts.lod === 1;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const C = Object.assign({}, CF_C, { skin: L.skin, pants: L.pants }, opts.colors);
  const mat = toonMat();                         // ONE toon material per rig (the game flashes it white on hits)
  const d = CF_D, J = skeleton(d, mat);          // same joint names as K.THUG_D => the game's thug poses drive it unchanged
  const sx = big ? 1.28 : 1, sz = big ? 1.2 : 1, hw = big ? 1.12 : 1;   // body width / depth; bruiser head width
  const P = (parent, name, geom, col, x, y, z, o) => cfPart(K, parent, name, geom, col, x, y, z, o);
  const paint = (m, f) => cfPaint(K, m, f);
  // suspenders: two teal straps front and back, painted onto the sweater as whole longitude columns of the sphere (18
  // columns of 20°; columns 3 and 5 flank the front centre, 12 and 14 the back), so the straps run clean and vertical
  const straps = (x, y, z) => { const col = Math.floor(((Math.atan2(z / (0.23 * sz), -x / (0.28 * sx)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 9)); return [3, 5, 12, 14].includes(col) && y > -0.2 ? C.teal : null; };
  if (lod) return cfLod(K, J, C, L, member, sx, sz, hw, P, paint, straps);

  let sm = mat; const tex = cfSkinTex(K);       // spotted-skin sub-material sharing the rig's hit-flash uniforms
  if (tex) { sm = toonMat({ map: tex }); sm.userData.flash = mat.userData.flash; sm.userData.flashC = mat.userData.flashC; }
  const S = (o) => Object.assign({ mat: sm }, o);

  // ---- hips + torso: slate sweater with painted teal suspenders, roll-neck collar, dorsal fin out of the collar ----
  P(J.hips, 'trousers', G.sph(0.22 * sx, 0.15, 0.17 * sz), C.pants, 0, 0.02, 0);
  paint(P(J.torso, 'sweater', G.sph(0.28 * sx, 0.33, 0.23 * sz).toNonIndexed(), C.slate, 0, 0.3, 0), straps);
  // dorsal fin standing up between the shoulder blades, leaning forward so it never reaches the ground in down
  P(J.torso, 'dorsal', cfFin(K, 0.05, 0.2, 0.18, 0.03), C.fin, 0, 0.58, -0.16 * sz, { rot: [0.3, 0, 0] });

  // ---- head: wide flat catfish head (pale belly painted underneath), wide frowning mouth, small eyes, four barbels ----
  const head = J.head = grp(J.neck, 0, 0, 0.05); head.userData.mat = mat;
  const hm = P(head, 'head', G.sph(0.25 * hw, 0.175, 0.24).toNonIndexed(), C.skin, 0, 0.15, 0.02, S());
  paint(hm, (x, y, z) => (y < -0.06 && z > -0.05 ? C.belly : L.hat === 'headband' && y > 0.07 && y < 0.12 ? C.teal : null));
  P(head, 'mouth', G.box(0.3 * hw, 0.03, 0.03), INK, 0, 0.1, 0.245, { rot: [0.15, 0, 0], outline: false });
  for (const sd of [1, -1]) {
    P(head, 'eye', G.sph(0.042, 0.042, 0.03), C.eye, sd * 0.14 * hw, 0.215, 0.17, { rot: [0, sd * 0.6, 0], outline: false });
    P(head, 'pupil', G.box(0.026, 0.032, 0.02), INK, sd * 0.133 * hw, 0.213, 0.196, { outline: false });
    P(head, 'brow', G.box(big ? 0.12 : 0.1, big ? 0.04 : 0.03, 0.03), INK, sd * 0.125 * hw, 0.258, 0.172, { rot: [0, sd * 0.5, sd * 0.35], outline: false });
    // long maxillary barbels from the mouth corners, splayed out sideways and drooping (clear of the chest)
    const az = 0.95, ax = -0.3, dir = [sd * Math.sin(az), -Math.cos(az) * Math.cos(ax), -Math.cos(az) * Math.sin(ax)], bl = big ? 0.28 : 0.24, off = bl / 2 + 0.022;
    P(head, 'barbel', G.cap(0.022, bl), C.fin, sd * 0.17 * hw + dir[0] * off, 0.1 + dir[1] * off, 0.2 + dir[2] * off, { rot: [ax, 0, sd * az] });
    P(head, 'chinbarbel', G.cap(0.021, 0.08), C.fin, sd * 0.055, 0.0, 0.2, { rot: [-0.15, 0, sd * 0.12] });
  }
  if (L.hat === 'newsboy') {         // slate newsboy cap, peak pulled low
    P(head, 'cap', G.sph(0.235, 0.085, 0.23), C.slate, 0, 0.3, 0.0, { rot: [0.08, 0, 0] });
    P(head, 'peak', G.box(0.2, 0.04, 0.12), C.slate, 0, 0.28, 0.24, { rot: [0.22, 0, 0] });
  } else if (L.hat === 'beanie') {   // teal watch cap with a slate cuff painted on
    paint(P(head, 'beanie', G.sph(0.24, 0.15, 0.24).toNonIndexed(), C.teal, 0, 0.3, -0.01, { rot: [-0.15, 0, 0] }), (x, y) => (y > -0.07 && y < 0.0 ? C.slate : null));
  } else if (L.hat === 'captain') {  // slate harbour captain's cap with a teal band painted round the crown
    paint(P(head, 'cap', G.cyl(0.22, 0.2, 0.12, 7).toNonIndexed(), C.slate, 0, 0.33, -0.01, { rot: [-0.08, 0, 0] }), (x, y) => (y < -0.015 && Math.abs(y) < 0.06 ? C.teal : null));
    P(head, 'peak', G.box(0.22, 0.04, 0.13), INK, 0, 0.29, 0.24, { rot: [0.2, 0, 0] });
  }

  // ---- arms: sweater sleeves (bare spotted skin on the bruiser's vest), pectoral-fin mitts ----
  const ua = big ? 0.105 : 0.085, fa = big ? 0.09 : 0.075;
  for (const k of ['L', 'R']) {
    const sleeve = L.vest ? C.skin : C.slate, so = L.vest ? S() : {};
    P(J['sh' + k], 'shoulder', G.sph(big ? 0.125 : 0.115, big ? 0.12 : 0.11, big ? 0.125 : 0.115), sleeve, 0, -0.01, 0, so);
    P(J['sh' + k], 'upper', G.cap(ua, d.upper - (big ? 0.03 : 0.06)), sleeve, 0, -d.upper / 2, 0, so);
    P(J['el' + k], 'fore', G.cap(fa, d.fore - (big ? 0.12 : 0.06)), sleeve, 0, -d.fore / 2 - (big ? 0.055 : 0), 0, so);
    P(J['ha' + k], 'mitt', G.sph(big ? 0.1 : 0.082, big ? 0.105 : 0.088, big ? 0.095 : 0.078), C.skin, 0, -0.05, 0.01, S());
  }
  // ---- legs: work trousers, teal knee-high rubber boots ----
  for (const k of ['L', 'R']) {
    P(J['lg' + k], 'thigh', G.cap(big ? 0.11 : 0.092, d.thigh - 0.1), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'bootleg', G.cap(big ? 0.085 : 0.072, d.shin - 0.12), C.teal, 0, -d.shin / 2 + 0.015, 0);
    P(J['ft' + k], 'boot', G.sph(big ? 0.105 : 0.09, 0.05, big ? 0.17 : 0.155), C.teal, 0, 0.03, 0.05);
  }
  // ---- tail: a short tail fin on its own group under the hips, tipped UP so it clears the ground in down ----
  const T = J.tail = grp(J.hips, 0, 0.0, -0.13 * sz); T.userData.mat = mat;   // low on the hips: clear of the sweater hem
  J.tailBase = 0.78 + rnd() * 0.05; T.rotation.x = J.tailBase;
  // a smooth flattened ellipsoid, not a box: box corners get mitred ink spikes that would land on the sweater
  P(T, 'tailfin', G.sph(0.1 * sx, 0.024, 0.085), C.fin, 0, 0, -0.07);

  // ---- armed: a cobblestone in a teal net bag, swung on a rope (built along +Y inside J.swR) ----
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = mat;
    P(W, 'rope', G.cap(0.022, 0.3), C.rope, 0, 0.16, 0);
    paint(P(W, 'cobble', G.sph(0.13, 0.11, 0.13).toNonIndexed(), C.stone, 0, 0.44, 0), (x, y, z) => (Math.abs(x) < 0.018 || Math.abs(z) < 0.018 ? C.teal : null));
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;                                      // the rig: J.root, J.mat, the 18 joints, J.head, J.d (+ J.tail, J.swR)
}

// far LOD (opts.lod === 1): 12 parts, no map. Each LOD part uses its HD counterpart's colours and width/depth scales.
// Painted in: suspenders (sweater), belly, headband, newsboy cap and beanie (head), skin mitts (forearm ends). One wide
// bar keeps the barbels' read at distance. The 12th part is the member's hook: the cobble (armed), the captain's cap
// (bruiser) or the tail fin (grunts). Dropped: hips sphere, feet, face details, dorsal fin.
// The game has no LOD swap today (beyond 24 m it only hides hulls and shadows); this is TASK_C's far variant.
function cfLod(K, J, C, L, member, sx, sz, hw, P, paint, straps) {
  const { G, grp } = K, d = J.d, big = sx > 1;
  paint(P(J.torso, 'sweater', G.sph(0.28 * sx, 0.33, 0.23 * sz).toNonIndexed(), C.slate, 0, 0.3, 0), straps);
  const head = J.head = grp(J.neck, 0, 0, 0.05); head.userData.mat = J.mat;
  const hatPaint = { newsboy: (y) => (y > 0.07 ? C.slate : null), beanie: (y) => (y > 0.13 ? C.teal : y > 0.06 ? C.slate : null), headband: (y) => (y > 0.07 && y < 0.12 ? C.teal : null) }[L.hat] || (() => null);
  paint(P(head, 'head', G.sph(0.25 * hw, 0.175, 0.24).toNonIndexed(), C.skin, 0, 0.15, 0.02), (x, y, z) => (y < -0.06 && z > -0.05 ? C.belly : hatPaint(y)));
  P(head, 'barbels', G.box(0.62 * hw, 0.045, 0.045), C.fin, 0, 0.05, 0.25, { rot: [0, 0, 0] });
  const ua = big ? 0.105 : 0.085, fa = big ? 0.09 : 0.075;
  for (const k of ['L', 'R']) {
    P(J['sh' + k], 'upper', G.cyl(ua + 0.02, ua, d.upper + 0.06), L.vest ? C.skin : C.slate, 0, -d.upper / 2 + 0.02, 0);
    const fy = -d.fore / 2 - 0.06;
    paint(P(J['el' + k], 'fore', G.cap(fa, d.fore + 0.04).toNonIndexed(), L.vest ? C.skin : C.slate, 0, fy, 0), (x, y) => (y + fy < -d.fore + 0.04 ? C.skin : null));
    P(J['lg' + k], 'thigh', G.cyl(big ? 0.13 : 0.11, big ? 0.11 : 0.092, d.thigh), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'boot', G.box(big ? 0.17 : 0.15, d.shin + 0.04, big ? 0.17 : 0.15), C.teal, 0, -d.shin / 2 + 0.02, 0);
  }
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = J.mat;
    P(W, 'cobble', G.cyl(0.12, 0.12, 0.2), C.stone, 0, 0.44, 0);
  } else if (L.hat === 'captain') P(head, 'cap', G.cyl(0.22, 0.2, 0.12, 7), C.slate, 0, 0.33, -0.01, { rot: [-0.08, 0, 0] });
  else {
    const T = J.tail = grp(J.hips, 0, 0.0, -0.13 * sz); T.userData.mat = J.mat; J.tailBase = 0.78; T.rotation.x = J.tailBase;
    P(T, 'tailfin', cfFin(K, 0.2 * sx, 0.045, 0.15, 0.0), C.fin, 0, 0, -0.07);
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;
}

// optional: a lazy tail sweep. state: idle | run | attack | hurt | down. Rotates only J.tail (a plain group directly under
// the hips joint) about its own pivot, never below its rest pitch, and holds still in 'down'. Safe to skip entirely.
export function animateGang(J, t, state) {
  if (!J.tail || J.tailBase === undefined) return;
  const f = state === 'run' ? 8 : state === 'attack' ? 6 : 1.8, a = state === 'down' ? 0 : state === 'run' ? 0.35 : 0.2;
  J.tail.rotation.x = J.tailBase + (state === 'hurt' ? 0.2 : 0);
  J.tail.rotation.y = Math.sin(t * f) * a;
}

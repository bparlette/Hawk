// gang_masked_bandits.js — Toad City Baltimore, Task C: the Masked Bandits (west side: Oriole Park, M&T Bank Stadium,
// Science Center). Anthropomorphic raccoons in an orange + grey uniform: every member wears a grey hoodie with an orange
// kangaroo pocket and orange cuffs, and orange sneakers. The raccoon's own black mask and ringed tail do the rest.
// No team colours or marks: orange sits on grey, never on black, and there are no birds, letters or numbers anywhere.
// No imports. Everything comes in through K (toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
// Loads as its own ES module; nothing here depends on other delivery files.
export const GANG = {
  id: 'masked_bandits', name: 'Masked Bandits', animal: 'raccoon', district: ['oriole_park', 'mt_bank_stadium', 'science_center'],
  accent: '#ff9f1c', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'],
};
export const META = {
  grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  grunt_b: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  armed: { hp: 8, scale: 1, radius: 0.42, weapon: 'traffic_cone' },
  bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true },
};

// raccoon proportions: same keys as K.THUG_D (hip 0.9)
const MB_D = { hip: 0.9, torsoY: 0.06, neckY: 0.6, legX: 0.13, thigh: 0.4, shin: 0.41, shX: 0.3, shY: 0.5, upper: 0.29, fore: 0.27 };
const MB_C = {
  hoodie: '#6f6a72', orange: '#ff9f1c', fur: '#8a8580', dark: '#3a3640', white: '#e6e2da', eye: '#ece6d2', sole: '#e6e2da',
};
const MB_LOOK = {
  grunt_a: { pants: '#4a5670', hat: 'beanie' },
  grunt_b: { pants: '#5a5248', hat: 'headphones', fur: '#7a756f' },
  armed: { pants: '#3e4656', hat: 'none' },
  bruiser: { pants: '#4f5a52', hat: 'dorag', fur: '#948e86', big: true, vest: true },
};

// one fur map shared by every raccoon (256², light neutral, tinted by the vertex colour). Keyed on the game's quality
// object (then THREE, then K); a failed draw is never cached.
const MB_TEX = new WeakMap();
function mbFurTex(K) {
  const key = K.QUAL || K.THREE || K;
  if (MB_TEX.has(key)) return MB_TEX.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  if (!x) return null;
  let s = 5501; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) {                      // soft mottling
    x.fillStyle = rnd() < 0.5 ? 'rgba(200,200,200,0.35)' : 'rgba(242,242,242,0.4)';
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 8 + rnd() * 16, 0, Math.PI * 2); x.fill();
  }
  x.lineCap = 'round';
  for (let i = 0; i < 1000; i++) {                    // coarse guard hairs running down the meridians
    const px = rnd() * 256, py = rnd() * 256, len = 4 + rnd() * 8, a = (rnd() - 0.5) * 0.6, v = rnd();
    x.strokeStyle = v < 0.55 ? 'rgba(140,140,140,0.55)' : v < 0.88 ? 'rgba(175,175,175,0.6)' : 'rgba(242,242,242,0.85)';
    x.lineWidth = 1 + rnd() * 1.2;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * len, py + Math.cos(a) * len); x.stroke();
  }
  const tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 1);
  MB_TEX.set(key, tex); return tex;
}

// K.part wrapper: names the mesh (for QA reports) and enforces the shadow/outline rules: outline:false => shadow:false,
// and anything under 4 cm in two dimensions gets neither an ink hull nor a shadow.
function mbPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  if ([dx, dy, dz].filter((v) => v < 0.04).length >= 2) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}
// recolour faces of a NON-INDEXED part after K.part baked its single colour: colour(x, y, z) gets the midpoint of each face's
// bounding box in the part's own geometry space and returns a palette colour or null (keep). The two triangles of a sphere
// quad share that box, so painted bands follow the rings cleanly.
function mbPaint(K, m, colour) {
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, col = new K.THREE.Color();
  const mid = (f, i) => (Math.min(f(i), f(i + 1), f(i + 2)) + Math.max(f(i), f(i + 1), f(i + 2))) / 2;
  const gx = (i) => p.getX(i), gy = (i) => p.getY(i), gz = (i) => p.getZ(i);
  for (let i = 0; i + 2 < p.count; i += 3) {
    const v = colour(mid(gx, i), mid(gy, i), mid(gz, i));
    if (!v) continue; col.set(v); for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b);
  }
  c.needsUpdate = true; return m;
}
// concatenate already-placed K.G primitives into ONE non-indexed geometry (one part, one draw call); paint it afterwards.
// Used by the far LOD so a 12-part rig can still carry the HD colours (sleeve + paw, jeans + sneaker, ringed tail).
function mbConcat(K, ...geoms) {
  const gs = geoms.map((g) => (g.index ? g.toNonIndexed() : g)), out = new K.THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const total = gs.reduce((a, g) => a + g.attributes[name].count * n, 0), arr = new Float32Array(total); let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].count * n; }
    out.setAttribute(name, new K.THREE.BufferAttribute(arr, n));
  }
  return out;
}
// taper a sphere toward +Z (the raccoon's snout): x/y shrink by up to `k` at the tip
function mbTaper(g, rz, k) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 1 - k * Math.pow(Math.min(1, Math.max(0, (p.getZ(i) / rz + 1) / 2)), 1.6); p.setX(i, p.getX(i) * f); p.setY(i, p.getY(i) * f); }
  p.needsUpdate = true; return g;
}

export function buildRaccoon(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const { G, grp, skeleton, toonMat, INK } = K;
  if (!MB_LOOK[member]) member = 'grunt_a';
  const L = MB_LOOK[member], big = !!L.big, lod = opts.lod === 1;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const C = Object.assign({}, MB_C, { fur: L.fur || MB_C.fur, pants: L.pants }, opts.colors);
  const mat = toonMat();                         // ONE toon material per rig (the game flashes it white on hits)
  const d = MB_D, J = skeleton(d, mat);          // same joint names as K.THUG_D => the game's thug poses drive it unchanged
  const sx = big ? 1.28 : 1, sz = big ? 1.2 : 1;
  const P = (parent, name, geom, col, x, y, z, o) => mbPart(K, parent, name, geom, col, x, y, z, o);
  const paint = (m, f) => mbPaint(K, m, f);
  // hoodie paint (torso sphere space): orange kangaroo pocket low on the front
  const pocket = (x, y, z) => (z > 0.1 * sz && y > -0.24 && y < -0.08 && Math.abs(x) < 0.16 * sx ? C.orange : null);
  // raccoon face paint (head sphere space, radius ~0.19): black mask across the eyes, white brows, white cheeks and chin
  const face = (x, y, z) => (z > 0.02 && y > 0.025 && y < 0.1 ? C.dark : z > 0.07 && y >= 0.1 && y < 0.135 && Math.abs(x) > 0.03 ? C.white : z > 0.06 && y < -0.02 ? C.white : null);
  // the hat painted on the head where it is a paint job, not a shape (used on HD and LOD)
  const hatPaint = { dorag: (y) => (y > 0.1 ? C.orange : null) }[L.hat] || (() => null);
  if (lod) return mbLod(K, J, C, L, member, sx, sz, P, paint, pocket, face, hatPaint);

  let fm = mat; const tex = mbFurTex(K);        // fur sub-material sharing the rig's hit-flash uniforms
  if (tex) { fm = toonMat({ map: tex }); fm.userData.flash = mat.userData.flash; fm.userData.flashC = mat.userData.flashC; }
  const F = (o) => Object.assign({ mat: fm }, o);

  // ---- hips + torso: jeans, grey hoodie with orange pocket, rolled hood ----
  P(J.hips, 'jeans', G.sph(0.21 * sx, 0.15, 0.17 * sz), C.pants, 0, 0.02, 0);
  paint(P(J.torso, 'hoodie', G.sph(0.27 * sx, 0.33, 0.22 * sz).toNonIndexed(), C.hoodie, 0, 0.3, 0), pocket);
  P(J.torso, 'hood', G.cap(0.08, 0.22 * sx), C.hoodie, 0, 0.57, -0.14 * sz, { rot: [-0.3, 0, Math.PI / 2] });

  // ---- head: grey fur, painted mask/brows/cheeks, tapered white snout, dark nose, round ears with white rims ----
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = mat;
  const hm = P(head, 'head', G.sph(0.19, 0.175, 0.18).toNonIndexed(), C.fur, 0, 0.17, 0, F());
  paint(hm, (x, y, z) => face(x, y, z) || hatPaint(y));
  P(head, 'snout', mbTaper(G.sph(0.085, 0.07, 0.14), 0.14, 0.55), C.white, 0, 0.115, 0.17, { rot: [0.08, 0, 0] });
  P(head, 'nose', G.box(0.05, 0.035, 0.035), C.dark, 0, 0.12, 0.305, { outline: false });
  for (const sd of [1, -1]) {
    P(head, 'eye', G.sph(0.034, 0.038, 0.024), C.eye, sd * 0.072, 0.235, 0.15, { rot: [0, sd * 0.4, 0], outline: false });
    P(head, 'pupil', G.box(0.024, 0.03, 0.02), INK, sd * 0.068, 0.232, 0.17, { outline: false });
    P(head, 'brow', G.box(big ? 0.1 : 0.09, big ? 0.035 : 0.028, 0.03), INK, sd * 0.075, 0.286, 0.148, { rot: [0, sd * 0.35, sd * 0.32], outline: false });
    const ey = L.hat === 'beanie' ? 0.375 : 0.33, ex = L.hat === 'beanie' ? 0.15 : 0.13;   // beanie: ears poke out higher and wider
    const em = P(head, 'ear', G.sph(0.07, 0.08, 0.032).toNonIndexed(), C.fur, sd * ex, ey, -0.02, F({ rot: [0, sd * 0.3, -sd * 0.35] }));
    paint(em, (x, y, z) => ((x / 0.07) ** 2 + (y / 0.08) ** 2 > 0.55 && z > 0 ? C.white : z > 0 ? C.dark : null));
  }
  if (L.hat === 'beanie') {          // orange watch cap, grey cuff painted on
    paint(P(head, 'beanie', G.sph(0.205, 0.14, 0.205).toNonIndexed(), C.orange, 0, 0.3, -0.01, { rot: [-0.15, 0, 0] }), (x, y) => (y > -0.07 && y < -0.005 ? C.hoodie : null));
  } else if (L.hat === 'headphones') {   // big orange headphones on a grey band
    P(head, 'band', G.tor(0.205, 0.024, Math.PI), C.hoodie, 0, 0.17, -0.01, { rot: [0, 0, 0] });
    for (const sd of [1, -1]) P(head, 'cup', G.cyl(0.065, 0.065, 0.05), C.orange, sd * 0.205, 0.17, -0.01, { rot: [0, 0, Math.PI / 2] });
  }

  // ---- arms: hoodie sleeves with orange cuffs (bare fur on the bruiser's sleeveless hoodie), dark paws ----
  const ua = big ? 0.105 : 0.085, fa = big ? 0.088 : 0.075;
  for (const k of ['L', 'R']) {
    const sleeve = L.vest ? C.fur : C.hoodie, so = L.vest ? F() : {};
    P(J['sh' + k], 'shoulder', G.sph(big ? 0.12 : 0.112, big ? 0.115 : 0.108, big ? 0.12 : 0.112), C.hoodie, 0, -0.01, 0);
    P(J['sh' + k], 'upper', G.cap(ua, d.upper - (big ? 0.08 : 0.06)), sleeve, 0, -d.upper / 2 - (big ? 0.02 : 0), 0, so);   // bruiser: capsule end 4 cm inside the shoulder ball so its hull can't poke through
    const fl = d.fore - (big ? 0.12 : 0.06), fy = -d.fore / 2 - (big ? 0.055 : 0);
    const fm2 = P(J['el' + k], 'fore', G.cap(fa, fl).toNonIndexed(), sleeve, 0, fy, 0, so);
    if (!L.vest) paint(fm2, (x, y) => (y < -fl / 2 + 0.01 && y > -fl / 2 - 0.05 ? C.orange : null));   // orange cuff
    P(J['ha' + k], 'paw', G.sph(big ? 0.095 : 0.075, big ? 0.1 : 0.08, big ? 0.095 : 0.075), C.dark, 0, -0.05, 0.01);
  }
  // ---- legs: jeans, orange sneakers with white soles ----
  for (const k of ['L', 'R']) {
    P(J['lg' + k], 'thigh', G.cap(big ? 0.11 : 0.092, d.thigh - 0.1), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'shin', G.cap(big ? 0.085 : 0.072, d.shin - 0.1), C.pants, 0, -d.shin / 2 + 0.02, 0);
    paint(P(J['ft' + k], 'sneaker', G.sph(big ? 0.1 : 0.09, 0.055, big ? 0.17 : 0.16).toNonIndexed(), C.orange, 0, 0.035, 0.05), (x, y) => (y < -0.025 ? C.sole : null));
  }
  // ---- ringed tail: hangs down close behind the hips (anything > ~0.23 m behind the body goes through the ground in down) ----
  const T = J.tail = grp(J.hips, 0, -0.02, -0.12 * sz); T.userData.mat = mat;
  J.tailBase = [(big ? 0.03 : 0.1) + rnd() * 0.03, 0.22];   // pitch (slightly back; flatter on the ×1.2 bruiser), roll (out to the left)
  T.rotation.x = J.tailBase[0]; T.rotation.z = J.tailBase[1];
  const tl = 0.3;
  paint(P(T, 'tail', G.cap(0.068, tl).toNonIndexed(), C.fur, 0, -(tl / 2 + 0.03), 0, F()), (x, y) => ((Math.floor((y + 0.4) / 0.07) % 2) === 0 ? C.dark : null));

  // ---- armed: a traffic cone swung by its tip (built along +Y inside J.swR), reflective band painted on ----
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = mat;
    paint(P(W, 'cone', G.cyl(0.14, 0.035, 0.52).toNonIndexed(), C.orange, 0, 0.26, 0), (x, y) => (y > -0.02 && y < 0.07 ? C.white : null));   // reflective band
    P(W, 'conebase', G.box(0.3, 0.045, 0.3), C.orange, 0, 0.54, 0);
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;                                      // the rig: J.root, J.mat, the 18 joints, J.head, J.d (+ J.tail, J.swR)
}

// far LOD (opts.lod === 1): ≤ 12 parts, no map. Each LOD part uses its HD counterpart's colours and width/depth scales.
// Multi-colour parts are built with mbConcat + mbPaint: head + snout + ears in one part (mask, cheeks, hats painted),
// sleeve + paw, jeans + sneaker, and a ringed tail made of three short cylinders. The armed member's cone is the 12th part.
// Dropped: hips sphere, hood, face details. The game has no LOD swap today (beyond 24 m it only hides hulls and shadows).
function mbLod(K, J, C, L, member, sx, sz, P, paint, pocket, face, hatPaint) {
  const { G, grp } = K, d = J.d, big = sx > 1;
  paint(P(J.torso, 'hoodie', G.sph(0.27 * sx, 0.33, 0.22 * sz).toNonIndexed(), C.hoodie, 0, 0.3, 0), pocket);
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = J.mat;
  const ey = L.hat === 'beanie' ? 0.205 : 0.16, ex = L.hat === 'beanie' ? 0.15 : 0.13;
  const hg = mbConcat(K, G.sph(0.19, 0.175, 0.18), G.cyl(0.03, 0.075, 0.2, 7).rotateX(Math.PI / 2).translate(0, -0.06, 0.2),
    G.cyl(0.07, 0.07, 0.035).rotateX(Math.PI / 2).translate(ex, ey, -0.02), G.cyl(0.07, 0.07, 0.035).rotateX(Math.PI / 2).translate(-ex, ey, -0.02));
  paint(P(head, 'head', hg, C.fur, 0, 0.17, 0), (x, y, z) => {
    if (z > 0.1 && y < -0.02) return C.white;                                           // snout
    if (Math.abs(x) > 0.09 && y > ey - 0.1) return C.dark;                               // ears
    if (L.hat === 'beanie' && y > 0.06) return C.orange;
    if (L.hat === 'headphones' && Math.abs(x) > 0.15 && Math.abs(y) < 0.06) return C.orange;
    return face(x, y, z) || hatPaint(y);
  });
  const ua = big ? 0.105 : 0.085, fa = big ? 0.088 : 0.075, pw = big ? 0.19 : 0.15;
  for (const k of ['L', 'R']) {
    P(J['sh' + k], 'upper', G.cyl(ua + 0.02, ua, d.upper + 0.06), L.vest ? C.fur : C.hoodie, 0, -d.upper / 2 + 0.02, 0);
    const fg = mbConcat(K, G.cyl(fa, fa, d.fore), G.box(pw, pw * 1.05, pw).translate(0, -d.fore / 2 - 0.05, 0.01));
    paint(P(J['el' + k], 'fore', fg, L.vest ? C.fur : C.hoodie, 0, -d.fore / 2, 0), (x, y) => (y < -d.fore / 2 + 0.005 ? C.dark : !L.vest && y < -d.fore / 2 + 0.05 ? C.orange : null));
    P(J['lg' + k], 'thigh', G.cyl(big ? 0.13 : 0.11, big ? 0.11 : 0.092, d.thigh), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    // sneaker = a cylinder lying across the foot (elliptical side profile): it pitches with the shin in getup without digging its toe in
    const sg = mbConcat(K, G.cyl(big ? 0.085 : 0.072, big ? 0.085 : 0.072, d.shin), G.cyl(0.06, 0.06, big ? 0.2 : 0.18).rotateZ(Math.PI / 2).scale(1, 1, 1.5).translate(0, -d.shin / 2 + 0.04, 0.04));   // sole 1 cm above the HD sneaker's
    paint(P(J['kn' + k], 'shin', sg, C.pants, 0, -d.shin / 2 + 0.01, 0), (x, y) => (y < -d.shin / 2 + 0.1 ? C.orange : null));
  }
  const T = J.tail = grp(J.hips, 0, -0.02, -0.12 * sz); T.userData.mat = J.mat; J.tailBase = [big ? 0.03 : 0.1, 0.22]; T.rotation.x = J.tailBase[0]; T.rotation.z = J.tailBase[1];
  const tg = mbConcat(K, G.cyl(0.068, 0.068, 0.11).translate(0, -0.09, 0), G.cyl(0.068, 0.068, 0.11).translate(0, -0.2, 0), G.cyl(0.06, 0.068, 0.11).translate(0, -0.31, 0));
  paint(P(T, 'tail', tg, C.fur, 0, 0, 0), (x, y) => (y > -0.145 && y < -0.035 ? C.dark : y < -0.255 ? C.dark : null));
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = J.mat;
    P(W, 'cone', mbConcat(K, G.cyl(0.14, 0.035, 0.52).translate(0, 0.26, 0), G.box(0.3, 0.045, 0.3).translate(0, 0.54, 0)), C.orange, 0, 0, 0);
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;
}

// optional: a lazy tail sway. state: idle | run | attack | hurt | down. Rotates only J.tail (a plain group directly under
// the hips joint) about its own pivot, never further back than its rest pitch, and holds still in 'down'. Safe to skip.
export function animateGang(J, t, state) {
  if (!J.tail || !J.tailBase) return;
  const f = state === 'run' ? 8 : state === 'attack' ? 6 : 2, a = state === 'down' ? 0 : state === 'run' ? 0.25 : 0.12;
  J.tail.rotation.x = J.tailBase[0];
  J.tail.rotation.z = J.tailBase[1] + Math.sin(t * f) * a;
}

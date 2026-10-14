// gang_key_hwy_otters.js — Toad City Baltimore, Task C gang 5: the Key Highway Otters.
// tcr2 o4 refinery-bell
// South shore: Federal Hill, the sugar refinery, Tide Point, Fort McHenry. Anthropomorphic river otters in a green + brown
// uniform: every member wears a green (#23c26b) track jacket with a brown collar, brown waistband and a brown stripe down
// each sleeve (the bruiser: a brown vest with a green drum-major sash). No text, logos, brand colours or patterns anywhere;
// no real people.
// No imports. Everything comes in through K (kit/toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
// Loads as its own ES module; nothing here depends on other delivery files.
export const GANG = {
  id: 'key_hwy_otters', name: 'Key Highway Otters', animal: 'otter', district: ['fedhill', 'domino', 'underarmour', 'fort'],
  accent: '#23c26b', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'],
};
export const META = {
  grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  grunt_b: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  armed: { hp: 8, scale: 1, radius: 0.42, weapon: 'sugar_sack' },
  bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true },
};

// otter proportions: same keys as K.THUG_D (hip 0.9), a longer neck for the sleek otter line
const KO_D = { hip: 0.9, torsoY: 0.06, neckY: 0.64, legX: 0.13, thigh: 0.4, shin: 0.41, shX: 0.29, shY: 0.5, upper: 0.29, fore: 0.27 };
const KO_C = {
  green: '#23c26b', stripe: '#5e3e28', fur: '#7a5236', dark: '#3e2c22', cream: '#d8c4a0', eye: '#ece6d2',
  hat: '#e6e2da', rope: '#c9b48a', sack: '#e2d6ba', vest: '#6a4a32',
};
const KO_LOOK = {
  grunt_a: { pants: '#6e6a64', hat: 'hardhat' },
  grunt_b: { pants: '#4f5a52', hat: 'headband', towel: true, fur: '#6c4a32' },
  armed: { pants: '#5a5248', hat: 'none', fur: '#83593a' },
  bruiser: { pants: '#3e3a36', hat: 'shako', big: true, vest: true, fur: '#70503a' },
};

// one fur map shared by every otter (256², light neutral, tinted by the vertex colour). Keyed on the game's quality object
// (then THREE, then K) so a fresh K wrapper per spawn still shares it; a failed draw is never cached.
const KO_TEX = new WeakMap();
function koFurTex(K) {
  const key = K.QUAL || K.THREE || K;
  if (KO_TEX.has(key)) return KO_TEX.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c && c.getContext ? c.getContext('2d') : null;
  if (!x) return null;
  let s = 4104; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {                      // soft mottling
    x.fillStyle = rnd() < 0.5 ? 'rgba(206,206,206,0.35)' : 'rgba(242,242,242,0.4)';
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 8 + rnd() * 16, 0, Math.PI * 2); x.fill();
  }
  x.lineCap = 'round';
  for (let i = 0; i < 900; i++) {                     // sleek short fur: fine strokes running down the meridians
    const px = rnd() * 256, py = rnd() * 256, len = 3 + rnd() * 5, a = (rnd() - 0.5) * 0.4, v = rnd();
    x.strokeStyle = v < 0.6 ? 'rgba(160,160,160,0.5)' : v < 0.9 ? 'rgba(190,190,190,0.55)' : 'rgba(242,242,242,0.8)';
    x.lineWidth = 1 + rnd() * 0.8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * len, py + Math.cos(a) * len); x.stroke();
  }
  const tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 1);
  if (tex) KO_TEX.set(key, tex);
  return tex;
}

// K.part wrapper: names the mesh (for QA reports) and enforces the shadow/outline rules: outline:false => shadow:false,
// and anything under 4 cm in two dimensions gets neither an ink hull nor a shadow.
function koPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  if ([dx, dy, dz].filter((v) => v < 0.04).length >= 2) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}
// recolour faces of a NON-INDEXED part after K.part baked its single colour: colour(x, y, z) gets the midpoint of each face's
// bounding box in the part's own geometry space and returns a palette colour or null (keep). The two triangles of a quad
// share that box, so painted bands and stripes follow the rings and columns cleanly.
function koPaint(K, m, colour) {
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, col = new K.THREE.Color();
  const mid = (f, i) => (Math.min(f(i), f(i + 1), f(i + 2)) + Math.max(f(i), f(i + 1), f(i + 2))) / 2;
  const gx = (i) => p.getX(i), gy = (i) => p.getY(i), gz = (i) => p.getZ(i);
  for (let i = 0; i + 2 < p.count; i += 3) {
    const v = colour(mid(gx, i), mid(gy, i), mid(gz, i));
    if (!v) continue; col.set(v); for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b);
  }
  c.needsUpdate = true; return m;
}
// concatenate already-placed K.G primitives into ONE non-indexed geometry (one part); paint it afterwards. Used by the far
// LOD so a 12-part rig keeps the HD colours (sleeve + paw, jogger + foot, head + muzzle + ears).
function koConcat(K, ...geoms) {
  const gs = geoms.map((g) => (g.index ? g.toNonIndexed() : g)), out = new K.THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const total = gs.reduce((a, g) => a + g.attributes[name].count * n, 0), arr = new Float32Array(total); let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].count * n; }
    out.setAttribute(name, new K.THREE.BufferAttribute(arr, n));
  }
  return out;
}

export function buildKeyHwyOtter(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const { G, grp, skeleton, toonMat, INK } = K;
  if (!KO_LOOK[member]) member = 'grunt_a';
  const L = KO_LOOK[member], big = !!L.big, lod = opts.lod === 1;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const C = Object.assign({}, KO_C, { fur: L.fur || KO_C.fur, pants: L.pants }, opts.colors);
  const mat = toonMat();                         // ONE toon material per rig (the game flashes it white on hits)
  const d = KO_D, J = skeleton(d, mat);          // same joint names as K.THUG_D => the game's thug poses drive it unchanged
  const sx = big ? 1.28 : 1, sz = big ? 1.2 : 1;
  const P = (parent, name, geom, col, x, y, z, o) => koPart(K, parent, name, geom, col, x, y, z, o);
  const paint = (m, f) => koPaint(K, m, f);
  // jacket paint (torso sphere space): brown collar and waistband; the bruiser's brown vest carries a green sash instead,
  // shoulder (+x, top) to hip (-x, bottom), front and back
  const top = L.vest ? C.vest : C.green;
  const jacket = (x, y, z) => {
    if (L.vest) return Math.abs(y + 0.1 + (x / sx) * Math.tan(0.45)) < 0.05 ? C.green : null;   // LOD: the HD sash torus (centre 0.2 in the torso, tilt 0.45) as painted faces
    return y > 0.29 ? C.stripe : y < -0.29 ? C.stripe : null;
  };
  // the otter's pale throat, chin and cheeks (head sphere space, radius ~0.17), plus a painted headband for grunt_b
  const face = (x, y, z) => (z > 0.03 && y < -0.02 ? C.cream : L.hat === 'headband' && y > 0.06 && y < 0.105 ? C.green : null);
  if (lod) return koLod(K, J, C, L, member, sx, sz, P, paint, jacket, face, top);

  let fm = mat; const tex = koFurTex(K);        // fur sub-material sharing the rig's hit-flash uniforms
  if (tex) { fm = toonMat({ map: tex }); fm.userData.flash = mat.userData.flash; fm.userData.flashC = mat.userData.flashC; }
  const F = (o) => Object.assign({ mat: fm }, o);

  // ---- hips + torso: joggers, green track jacket (brown vest + green sash on the bruiser), towel for grunt_b ----
  P(J.hips, 'joggers', G.sph(0.21 * sx, 0.15, 0.17 * sz), C.pants, 0, 0.02, 0);
  paint(P(J.torso, 'jacket', G.sph(0.25 * sx, 0.36, 0.21 * sz).toNonIndexed(), top, 0, 0.3, 0), L.vest ? () => null : jacket);
  if (L.vest) {   // the drum-major sash: its own thin torus ringed round the vest on a diagonal (shoulder +x, hip -x), not painted faces
    const th = 0.45, a = 0.25 * sx, b = 0.36, c = 0.21 * sz;   // torso ellipsoid semi-axes; th = tilt of the ring plane about z
    const ru = 1 / Math.sqrt((Math.cos(th) / a) ** 2 + (Math.sin(th) / b) ** 2) + 0.006, rz = c + 0.006;
    P(J.torso, 'sash', G.tor(1, 0.036 / ((ru + rz) / 2)).rotateX(Math.PI / 2).scale(ru, 1, rz).rotateZ(-th).toNonIndexed(), C.green, 0, 0.2, 0);
  }
  if (L.towel) P(J.torso, 'towel', G.tor(0.17, 0.045), C.hat, 0, 0.58, 0.01, { rot: [Math.PI / 2 + 0.2, 0, 0] });

  // ---- head: sleek brown head, pale throat, broad flat cream muzzle, dark nose, whiskers, small round ears ----
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = mat;
  paint(P(head, 'head', G.sph(0.17, 0.155, 0.17).toNonIndexed(), C.fur, 0, 0.16, 0, F()), face);
  P(head, 'muzzle', G.sph(0.12, 0.07, 0.1), C.cream, 0, 0.1, 0.14);
  P(head, 'nose', G.box(0.07, 0.04, 0.035), C.dark, 0, 0.135, 0.235, { outline: false });
  const wa = 0.08 + rnd() * 0.04;
  for (const r of [wa, -wa]) P(head, 'whiskers', G.box(0.44, 0.009, 0.009), C.dark, 0, 0.1, 0.22, { rot: [0, 0, r], outline: false });
  for (const sd of [1, -1]) {
    P(head, 'eye', G.sph(0.034, 0.036, 0.022), C.eye, sd * 0.07, 0.205, 0.145, { rot: [0, sd * 0.4, 0], outline: false });
    P(head, 'pupil', G.box(0.024, 0.03, 0.02), INK, sd * 0.066, 0.203, 0.163, { outline: false });
    P(head, 'brow', G.box(big ? 0.095 : 0.085, big ? 0.035 : 0.028, 0.03), INK, sd * 0.072, 0.25, 0.14, { rot: [0, sd * 0.35, sd * 0.32], outline: false });
    const lowEar = L.hat === 'hardhat' || L.hat === 'shako';   // under a brim the ears sit lower and wider, clear of the hat
    P(head, 'ear', G.sph(0.048, 0.045, 0.028), C.fur, sd * (lowEar ? 0.174 : 0.15), lowEar ? 0.19 : 0.25, -0.03, F({ rot: [0, sd * 0.5, 0] }));
  }
  if (L.hat === 'hardhat') {         // refinery hard hat: cream dome with a painted green band, cream brim
    paint(P(head, 'hat', G.sph(0.19, 0.12, 0.19).toNonIndexed(), C.hat, 0, 0.27, -0.01, { rot: [-0.08, 0, 0] }), (x, y) => (y > -0.04 && y < 0.01 ? C.green : null));
    P(head, 'brim', G.cyl(0.24, 0.24, 0.04), C.hat, 0, 0.255, 0.0, { rot: [-0.08, 0, 0] });
  } else if (L.hat === 'shako') {    // drum-major shako: brown drum with a painted green band, green plume
    paint(P(head, 'shako', G.cyl(0.17, 0.14, 0.24).toNonIndexed(), C.vest, 0, 0.36, -0.01, { rot: [-0.06, 0, 0] }),   // flares upward; the narrow base sits inside the head so its rim draws no ink on the face
      (x, y) => (y > -0.07 && y < -0.02 ? C.green : null));
    P(head, 'plume', G.sph(0.06, 0.08, 0.06), C.green, 0, 0.5, 0.08);
  }

  // ---- arms: green sleeves with a brown outer stripe and cuff (bare fur on the bruiser), dark webbed paws ----
  const ua = big ? 0.105 : 0.085, fa = big ? 0.088 : 0.075;
  for (const k of ['L', 'R']) {
    const sd = k === 'L' ? 1 : -1, sleeve = L.vest ? C.fur : C.green, so = L.vest ? F() : {};
    const stripe = (x, y, z) => { const a = Math.atan2(x * sd, z) * 180 / Math.PI; return a >= 90 && a < 120 ? C.stripe : null; };   // the outward column
    P(J['sh' + k], 'shoulder', G.sph(big ? 0.12 : 0.11, big ? 0.115 : 0.105, big ? 0.12 : 0.11), L.vest ? C.vest : C.green, 0, -0.01, 0);
    const ul = d.upper - (big ? 0.08 : 0.06), uy = -d.upper / 2 - (big ? 0.02 : 0);   // bruiser capsule end deep inside the ball
    const um = P(J['sh' + k], 'upper', G.cap(ua, ul).toNonIndexed(), sleeve, 0, uy, 0, so);
    if (!L.vest) paint(um, stripe);
    const fl = d.fore - (big ? 0.12 : 0.06), fy = -d.fore / 2 - (big ? 0.055 : 0);
    const fm2 = P(J['el' + k], 'fore', G.cap(fa, fl).toNonIndexed(), sleeve, 0, fy, 0, so);
    if (!L.vest) paint(fm2, (x, y, z) => (y < -fl / 2 + 0.01 && y > -fl / 2 - 0.05 ? C.stripe : stripe(x, y, z)));   // cuff + stripe
    P(J['ha' + k], 'paw', G.sph(big ? 0.095 : 0.075, big ? 0.1 : 0.08, big ? 0.095 : 0.075), C.dark, 0, -0.05, 0.01);
  }
  // ---- legs: joggers, bare webbed otter feet ----
  for (const k of ['L', 'R']) {
    P(J['lg' + k], 'thigh', G.cap(big ? 0.11 : 0.092, d.thigh - 0.1), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'shin', G.cap(big ? 0.085 : 0.072, d.shin - 0.1), C.pants, 0, -d.shin / 2 + 0.02, 0);
    P(J['ft' + k], 'foot', G.sph(big ? 0.105 : 0.095, 0.042, big ? 0.18 : 0.17), C.dark, 0, 0.022, 0.06);
  }
  // ---- thick tapering tail: hangs close behind the hips, a little back and out to the left. Anything more than ~0.23 m
  // behind the body goes through the ground in the real down pose, so the tail never sweeps far back ----
  const T = J.tail = grp(J.hips, 0, 0.0, -0.12 * sz); T.userData.mat = mat;
  J.tailBase = [(big ? 0.08 : 0.15) + rnd() * 0.03, 0.2];   // pitch (back), roll (out to the left)
  T.rotation.x = J.tailBase[0]; T.rotation.z = J.tailBase[1];
  P(T, 'tail', G.cyl(0.068, 0.03, 0.4), C.fur, 0, -0.19, 0, F());

  // ---- armed: a sugar sack swung like a flail on a short rope (built along +Y inside J.swR); plain sack, no print ----
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = mat;
    P(W, 'rope', G.cap(0.022, 0.26), C.rope, 0, 0.15, 0);
    paint(P(W, 'sack', G.sph(0.15, 0.2, 0.13).toNonIndexed(), C.sack, 0, 0.47, 0), (x, y) => (y < -0.12 && y > -0.17 ? C.stripe : null));   // tie band
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;                                      // the rig: J.root, J.mat, the 18 joints, J.head, J.d (+ J.tail, J.swR)
}

// far LOD (opts.lod === 1): ≤ 12 parts, no map. Each LOD part uses its HD counterpart's colours and width/depth scales; the
// green jacket (the gang accent) stays on every member. Multi-colour parts are built with koConcat + koPaint: head + muzzle +
// ears (throat, headband painted), sleeve + paw, jogger + foot (a cylinder laid across, so it pitches with the shin in getup
// without digging in). The 12th part is the member's hook: hard hat, sack or shako; grunt_b's is the towel-less 11-part rig.
// Dropped: hips sphere, face details, whiskers. The game has no LOD swap (beyond 24 m it only hides hulls and shadows).
function koLod(K, J, C, L, member, sx, sz, P, paint, jacket, face, top) {
  const { G, grp } = K, d = J.d, big = sx > 1;
  paint(P(J.torso, 'jacket', G.sph(0.25 * sx, 0.36, 0.21 * sz).toNonIndexed(), top, 0, 0.3, 0), jacket);
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = J.mat;
  const lowEar = L.hat === 'hardhat' || L.hat === 'shako', ex = lowEar ? 0.174 : 0.15, ey = lowEar ? 0.03 : 0.09;   // HD ear centres, head-sphere space
  const hg = koConcat(K, G.sph(0.17, 0.155, 0.17), G.box(0.22, 0.12, 0.18).translate(0, -0.06, 0.14),
    G.cyl(0.045, 0.045, 0.03).rotateX(Math.PI / 2).translate(ex, ey, -0.03), G.cyl(0.045, 0.045, 0.03).rotateX(Math.PI / 2).translate(-ex, ey, -0.03),
    G.box(0.07, 0.04, 0.035).translate(0, -0.025, 0.235), G.box(0.03, 0.034, 0.03).translate(0.066, 0.043, 0.16), G.box(0.03, 0.034, 0.03).translate(-0.066, 0.043, 0.16));
  // nose (front of the box past the muzzle) and eye dots (box fronts, which stand proud of the sphere) are dark
  paint(P(head, 'head', hg, C.fur, 0, 0.16, 0), (x, y, z) => (z > 0.245 || (z > 0.168 && y > 0.02) ? C.dark : z > 0.08 && y < 0.0 ? C.cream : face(x, y, z)));
  const ua = big ? 0.105 : 0.085, fa = big ? 0.088 : 0.075, pw = big ? 0.19 : 0.15;
  for (const k of ['L', 'R']) {
    P(J['sh' + k], 'upper', G.cyl(ua + 0.02, ua, d.upper + 0.06), L.vest ? C.fur : C.green, 0, -d.upper / 2 + 0.02, 0);
    const fg = koConcat(K, G.cyl(fa, fa, d.fore), G.box(pw, pw * 1.05, pw).translate(0, -d.fore / 2 - 0.05, 0.01));
    paint(P(J['el' + k], 'fore', fg, L.vest ? C.fur : C.green, 0, -d.fore / 2, 0), (x, y) => (y < -d.fore / 2 + 0.005 ? C.dark : null));
    P(J['lg' + k], 'thigh', G.cyl(big ? 0.13 : 0.11, big ? 0.11 : 0.092, d.thigh), C.pants, 0, -d.thigh / 2 + 0.03, 0);
    const sg = koConcat(K, G.cyl(big ? 0.085 : 0.072, big ? 0.085 : 0.072, d.shin), G.cyl(0.05, 0.05, big ? 0.2 : 0.18).rotateZ(Math.PI / 2).scale(1, 1, 1.5).translate(0, -d.shin / 2 + 0.035, 0.04));
    paint(P(J['kn' + k], 'shin', sg, C.pants, 0, -d.shin / 2 + 0.01, 0), (x, y) => (y < -d.shin / 2 + 0.09 ? C.dark : null));
  }
  const T = J.tail = grp(J.hips, 0, 0.0, -0.12 * sz); T.userData.mat = J.mat; J.tailBase = [big ? 0.08 : 0.15, 0.2]; T.rotation.x = J.tailBase[0]; T.rotation.z = J.tailBase[1];
  P(T, 'tail', G.cyl(0.068, 0.03, 0.4), C.fur, 0, -0.19, 0);
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = J.mat;
    P(W, 'sack', koConcat(K, G.cyl(0.03, 0.03, 0.3).translate(0, 0.15, 0), G.cyl(0.13, 0.15, 0.36).translate(0, 0.47, 0)), C.sack, 0, 0, 0);
  } else if (L.hat === 'hardhat') P(head, 'hat', G.cyl(0.18, 0.24, 0.14), C.hat, 0, 0.29, -0.01, { rot: [-0.08, 0, 0] });
  else if (L.hat === 'shako') P(head, 'shako', G.cyl(0.17, 0.14, 0.24), C.vest, 0, 0.36, -0.01, { rot: [-0.06, 0, 0] });
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

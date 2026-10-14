// gang_pier_gulls.js — Toad City Baltimore, Task C: the Pier Gulls (the piers: National Aquarium, Power Plant, Four Seasons).
// Anthropomorphic herring gulls in a blue + white uniform: every member wears a blue (#2f5bd3) top with a white chest band.
// No imports. Everything comes in through K (toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
// Loads as its own ES module; nothing here depends on other delivery files.
export const GANG = {
  id: 'pier_gulls', name: 'Pier Gulls', animal: 'gull', district: ['aquarium', 'power_plant', 'four_seasons'],
  accent: '#2f5bd3', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'],
};
export const META = {
  grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  grunt_b: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  armed: { hp: 8, scale: 1, radius: 0.42, weapon: 'frozen_rockfish' },
  bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true },
};

// gull proportions: same keys as K.THUG_D (hip 0.9), a little shorter in the neck so the head sits down on the shoulders
const PG_D = { hip: 0.9, torsoY: 0.06, neckY: 0.6, legX: 0.12, thigh: 0.4, shin: 0.41, shX: 0.3, shY: 0.5, upper: 0.29, fore: 0.27 };
const PG_C = {
  white: '#e9ecef', mantle: '#9aa4b0', tip: '#2e2b36', blue: '#2f5bd3', band: '#eae6dc', beak: '#f2b33d', spot: '#d43a2a',
  eye: '#f3e7a0', leg: '#e3a0a0', gold: '#c8a040', fish: '#9aa38a', fishDk: '#4f5a52', fishBelly: '#d6d2c0',
};
const PG_LOOK = {
  grunt_a: { shorts: '#a08c64', hat: 'bucket' },
  grunt_b: { shorts: '#5a6a8a', hat: 'backcap', body: '#a8927a', wing: '#8a7660', beak: '#4a4046', eye: '#7a5a44' },   // first-winter juvenile: brown mottled, dark beak
  armed: { shorts: '#6f6a62', hat: 'sweatband' },
  bruiser: { shorts: '#4f5a52', hat: 'beanie', wing: '#565d69', big: true, vest: true },                               // great black-backed: dark mantle
};

// one feather map shared by every gull (256², light neutral so the vertex colour tints it). Keyed on the game's quality
// object (falls back to THREE, then K) so a fresh K wrapper per call still shares it; a failed draw is never cached.
const PG_TEX = new WeakMap();
function pgFeatherTex(K) {
  const key = K.QUAL || K.THREE || K;
  if (PG_TEX.has(key)) return PG_TEX.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  if (!x) return null;
  let s = 7331; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#ececec'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {                      // soft mottling
    x.fillStyle = rnd() < 0.5 ? 'rgba(205,205,205,0.35)' : 'rgba(242,242,242,0.4)';
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 8 + rnd() * 16, 0, Math.PI * 2); x.fill();
  }
  x.lineCap = 'round';
  for (let i = 0; i < 520; i++) {                     // feather scallops: short arcs opening downward
    const px = rnd() * 256, py = rnd() * 256, r = 3 + rnd() * 5, v = rnd();
    x.strokeStyle = v < 0.55 ? 'rgba(160,160,160,0.55)' : v < 0.9 ? 'rgba(186,186,186,0.6)' : 'rgba(242,242,242,0.85)';
    x.lineWidth = 1 + rnd();
    x.beginPath(); x.arc(px, py, r, Math.PI * 0.15, Math.PI * 0.85); x.stroke();
  }
  for (let i = 0; i < 260; i++) {                     // fine streaks (winter head streaking)
    const px = rnd() * 256, py = rnd() * 256, len = 3 + rnd() * 5;
    x.strokeStyle = 'rgba(150,150,150,0.45)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 2, py + len); x.stroke();
  }
  const tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 1);
  PG_TEX.set(key, tex); return tex;
}

// taper a sphere toward +Z (beaks): x/y shrink by up to `k` at the tip, and the tip droops by `hook` (a hooked bill)
function pgTaper(g, rz, k, hook = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getZ(i) / rz + 1) / 2)), f = 1 - k * Math.pow(t, 1.6);
    p.setX(i, p.getX(i) * f); p.setY(i, p.getY(i) * f - hook * Math.pow(t, 4));
  }
  p.needsUpdate = true; return g;
}

// K.part wrapper: names the mesh (for QA reports) and enforces the shadow/outline rules: outline:false => shadow:false,
// and anything under 4 cm in two dimensions gets neither an ink hull nor a shadow.
function pgPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  const thin = [dx, dy, dz].filter((v) => v < 0.04).length >= 2;
  if (thin) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}

export function buildPierGull(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const { G, grp, skeleton, toonMat, INK } = K;
  if (!PG_LOOK[member]) member = 'grunt_a';
  const L = PG_LOOK[member], big = !!L.big, lod = opts.lod === 1;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const C = Object.assign({}, PG_C, { body: L.body || PG_C.white, wing: L.wing || PG_C.mantle, shorts: L.shorts }, L.beak ? { beak: L.beak } : {}, L.eye ? { eye: L.eye } : {}, opts.colors);
  const mat = toonMat();                         // ONE toon material per rig (the game flashes it white on hits)
  const d = PG_D, J = skeleton(d, mat);          // same joint names as K.THUG_D => the game's thug poses drive it unchanged
  const sx = big ? 1.28 : 1, sz = big ? 1.2 : 1;   // bruiser width / depth scale (HD and LOD use the same)
  const P = (parent, name, geom, col, x, y, z, o) => pgPart(K, parent, name, geom, col, x, y, z, o);
  if (lod) return pgLod(K, J, C, L, member, sx, sz, P);

  // feather sub-material (canvas-mapped toonMat sharing the rig's hit-flash uniforms); plain toon if canvas is unavailable
  let fm = mat; const tex = pgFeatherTex(K);
  if (tex) { fm = toonMat({ map: tex }); fm.userData.flash = mat.userData.flash; fm.userData.flashC = mat.userData.flashC; }
  const F = (o) => Object.assign({ mat: fm }, o);

  // ---- hips + torso: blue top with the white gang band, popped collar ----
  P(J.hips, 'shorts', G.sph(0.21 * sx, 0.15, 0.17 * sz), C.shorts, 0, 0.02, 0);
  P(J.torso, 'jacket', G.sph(0.27 * sx, 0.33, 0.22 * sz), C.blue, 0, 0.3, 0);
  P(J.torso, 'band', G.cyl(0.273 * sx, 0.259 * sx, 0.09, 7, true).scale(1, 1, 0.815 * sz / sx), C.band, 0, 0.21, 0);   // open tube: no caps buried in the jacket
  if (L.vest) P(J.torso, 'chain', G.tor(0.16, 0.022), C.gold, 0, 0.6, 0.03, { rot: [Math.PI / 2 + 0.35, 0, 0] });
  else P(J.torso, 'collar', G.tor(0.15, 0.05), C.blue, 0, 0.6, -0.01, { rot: [Math.PI / 2 + 0.2, 0, 0] });

  // ---- head: round feathered head, hooked yellow bill with the red gonys spot, pale glaring eyes ----
  const head = J.head = grp(J.neck, 0, -0.02, 0.03); head.userData.mat = mat;
  P(head, 'head', G.sph(0.2, 0.2, 0.2), C.body, 0, 0.2, 0, F());
  P(head, 'bill', pgTaper(G.sph(0.07, 0.05, 0.19), 0.19, 0.55, 0.045), C.beak, 0, 0.16, 0.27, { rot: [0.12, 0, 0] });
  P(head, 'jaw', pgTaper(G.sph(0.052, 0.03, 0.14), 0.14, 0.55), C.beak, 0, 0.105, 0.24, { rot: [0.22, 0, 0] });
  P(head, 'gonys', G.sph(0.02, 0.024, 0.02), C.spot, 0, 0.083, 0.335, { outline: false });
  for (const sd of [1, -1]) {
    P(head, 'eye', G.sph(0.052, 0.052, 0.035), C.eye, sd * 0.1, 0.25, 0.15, { rot: [0, sd * 0.5, 0], outline: false });
    P(head, 'pupil', G.sph(0.019, 0.025, 0.016), INK, sd * 0.093, 0.247, 0.185, { outline: false });
    P(head, 'brow', G.box(big ? 0.115 : 0.12, big ? 0.04 : 0.03, 0.035), INK, sd * 0.095, big ? 0.285 : 0.295, big ? 0.15 : 0.158, { rot: [0, sd * 0.45, sd * 0.38], outline: false });
  }
  if (L.hat === 'bucket') {          // blue bucket hat
    P(head, 'hat', G.cyl(0.17, 0.195, 0.13), C.blue, 0, 0.37, -0.02, { rot: [-0.12, 0, 0] });
    P(head, 'brim', G.cyl(0.27, 0.27, 0.04), C.blue, 0, 0.31, -0.01, { rot: [-0.12, 0, 0] });
  } else if (L.hat === 'backcap') {  // blue cap worn backwards
    P(head, 'cap', G.sph(0.228, 0.11, 0.228), C.blue, 0, 0.315, -0.01, { rot: [-0.1, 0, 0] });
    P(head, 'peak', G.box(0.17, 0.04, 0.13), C.blue, 0, 0.3, -0.26, { rot: [-0.25, 0, 0] });
  } else if (L.hat === 'sweatband') {
    P(head, 'sweatband', G.tor(0.19, 0.032), C.blue, 0, 0.3, 0, { rot: [Math.PI / 2 - 0.12, 0, 0] });
  } else if (L.hat === 'beanie') {
    P(head, 'beanie', G.sph(0.225, 0.17, 0.225), C.blue, 0, 0.335, -0.025, { rot: [-0.2, 0, 0] });
    P(head, 'cuff', G.cyl(0.236, 0.24, 0.08, 7, true), C.band, 0, 0.3, -0.025, { rot: [-0.2, 0, 0] });
  }

  // ---- wings as arms: jacket shoulder + sleeve (or bare mantle on the vest), feathered forearm, dark wingtip fist with a white mirror ----
  const ua = big ? 0.105 : 0.085, fa = big ? 0.09 : 0.075;
  for (const k of ['L', 'R']) {
    const sd = k === 'L' ? 1 : -1, sleeve = L.vest ? C.wing : C.blue;
    P(J['sh' + k], 'shoulder', G.sph(big ? 0.128 : 0.112, big ? 0.12 : 0.108, big ? 0.128 : 0.112), sleeve, 0, -0.01, 0, L.vest ? F() : {});
    P(J['sh' + k], 'upper', G.cap(ua, d.upper - (big ? 0.06 : 0.06)), sleeve, 0, -d.upper / 2, 0, L.vest ? F() : {});
    P(J['el' + k], 'fore', G.cap(fa, d.fore - (big ? 0.1 : 0.06)), C.wing, 0, -d.fore / 2 - (big ? 0.03 : 0), 0, F());
    P(J['ha' + k], 'wingtip', G.sph(big ? 0.085 : 0.07, big ? 0.14 : 0.125, big ? 0.1 : 0.09), C.tip, 0, -0.06, 0.01);
    P(J['ha' + k], 'mirror', G.sph(0.03, 0.04, 0.012), C.white, sd * (big ? 0.088 : 0.073), -0.08, 0.0, { rot: [0, Math.PI / 2, 0], outline: false });
  }
  // ---- legs: shorts, thin pink legs, webbed feet ----
  for (const k of ['L', 'R']) {
    P(J['lg' + k], 'thigh', G.cap(big ? 0.11 : 0.092, d.thigh - 0.1), C.shorts, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'shin', G.cap(big ? 0.055 : 0.046, d.shin - 0.06), C.leg, 0, -d.shin / 2, 0);
    P(J['ft' + k], 'foot', G.sph(big ? 0.11 : 0.095, 0.035, big ? 0.17 : 0.155), C.leg, 0, 0.012, 0.08);
  }
  // ---- tail: a short white wedge on its own group under the hips, tipped UP so it clears the ground in down ----
  const T = J.tail = grp(J.hips, 0, 0.08, -0.12); T.userData.mat = mat;
  J.tailBase = 0.62 + rnd() * 0.06; T.rotation.x = J.tailBase;
  P(T, 'tail', G.box(0.22 * sx, 0.045, 0.18), C.body, 0, 0, -0.08, F());

  // ---- armed: a frozen rockfish swung by the tail (built along +Y inside J.swR) ----
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = mat;
    P(W, 'fishtail', G.box(0.2, 0.12, 0.045), C.fish, 0, 0.06, 0, { rot: [0, 0, 0] });
    P(W, 'fish', pgTaper(G.sph(0.1, 0.07, 0.34), 0.34, 0.25).rotateX(Math.PI / 2), C.fish, 0, 0.42, 0);
    P(W, 'stripe', G.box(0.205, 0.5, 0.012), C.fishDk, 0, 0.42, 0, { outline: false });
    P(W, 'fisheye', G.sph(0.025, 0.025, 0.025), C.fishBelly, 0.065, 0.66, 0.02, { outline: false });
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;                                      // the rig: J.root, J.mat, the 18 joints, J.head, J.d (+ J.tail, J.swR)
}

// far LOD (opts.lod === 1): ≤ 14 parts, no map. Each LOD part uses its HD counterpart's colour and the same width/depth
// scales; the blue jacket and white band (the gang accent) stay on every member, the armed one included. Dropped: the hips
// sphere (hidden by jacket and thighs), wingtip fists, feet (the shin runs down to the HD sole level), face details, collar.
// Note: the game has no LOD swap today (beyond 24 m it only hides hulls and shadows); this is the TASK_C far variant.
function pgLod(K, J, C, L, member, sx, sz, P) {
  const { G, grp } = K, d = J.d, big = sx > 1;
  P(J.torso, 'jacket', G.sph(0.27 * sx, 0.33, 0.22 * sz), C.blue, 0, 0.3, 0);
  P(J.torso, 'band', G.cyl(0.273 * sx, 0.259 * sx, 0.09, 7, true).scale(1, 1, 0.815 * sz / sx), C.band, 0, 0.21, 0);
  const head = J.head = grp(J.neck, 0, -0.02, 0.03); head.userData.mat = J.mat;
  P(head, 'head', G.sph(0.2, 0.2, 0.2), C.body, 0, 0.2, 0);
  P(head, 'bill', G.cyl(0.02, 0.06, 0.32, 7), C.beak, 0, 0.14, 0.3, { rot: [Math.PI / 2 + 0.12, 0, 0] });
  if (L.hat === 'bucket') P(head, 'hat', G.cyl(0.2, 0.25, 0.13), C.blue, 0, 0.35, -0.02, { rot: [-0.12, 0, 0] });
  else if (L.hat === 'backcap') P(head, 'cap', G.sph(0.228, 0.11, 0.228), C.blue, 0, 0.315, -0.01, { rot: [-0.1, 0, 0] });
  else if (L.hat === 'beanie') P(head, 'beanie', G.sph(0.225, 0.17, 0.225), C.blue, 0, 0.335, -0.025, { rot: [-0.2, 0, 0] });
  const ua = big ? 0.11 : 0.085, fa = big ? 0.095 : 0.075;
  for (const k of ['L', 'R']) {
    P(J['sh' + k], 'upper', G.cyl(ua + 0.02, ua, d.upper + 0.06), L.vest ? C.wing : C.blue, 0, -d.upper / 2 + 0.02, 0);
    P(J['el' + k], 'fore', G.cyl(fa, fa * 0.9, d.fore + 0.16), C.wing, 0, -d.fore / 2 - 0.06, 0);
    P(J['lg' + k], 'thigh', G.cyl(big ? 0.13 : 0.11, big ? 0.11 : 0.092, d.thigh), C.shorts, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'shin', G.cyl(big ? 0.055 : 0.046, big ? 0.07 : 0.06, d.shin + 0.035), C.leg, 0, -d.shin / 2 - 0.0055, 0);   // sole level = HD foot's
  }
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = J.mat;
    P(W, 'fish', G.cyl(0.1, 0.04, 0.72), C.fish, 0, 0.38, 0);
  }
  const T = J.tail = grp(J.hips, 0, 0.08, -0.12); T.userData.mat = J.mat; J.tailBase = 0.62; T.rotation.x = J.tailBase;
  P(T, 'tail', G.box(0.22 * sx, 0.045, 0.18), C.body, 0, 0, -0.08);
  J.kind = 'thug'; J.meta = META[member];
  return J;
}

// optional: a small tail flick. state: idle | run | attack | hurt | down. Rotates only J.tail (a plain group directly under
// the hips joint) about its own pivot, never below its rest pitch, and holds still in 'down'. Safe to skip entirely.
export function animateGang(J, t, state) {
  if (!J.tail || J.tailBase === undefined) return;
  const f = state === 'run' ? 10 : state === 'attack' ? 7 : 2.4, a = state === 'down' ? 0 : state === 'run' ? 0.3 : 0.16;
  J.tail.rotation.x = J.tailBase + (state === 'hurt' ? 0.25 : 0) + Math.abs(Math.sin(t * f * 0.5)) * a * 0.5;
  J.tail.rotation.y = Math.sin(t * f) * a;
}

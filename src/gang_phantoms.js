// gang_phantoms.js — Toad City Baltimore, O8 gang: the Fells Point Phantoms (night-only pirate ghosts).
// tcr2 o8 phantoms
// Built by Grok Bot standing in for Opus (branch grok/opus-standin), to the O8 brief + J-005 answers (Q-c, Q-g, Q-h, Q-i).
// Original ghost-privateer crew: Deckhand Dread (grunt), Bosun Bones (bruiser) and Powder Monkey (small, throws spectral
// bombs). No real pirates, mascots, flags, logos or lettering. Palette = PHANTOM_C, the shared constant O7's Captain
// Cobblestone will match.
// No imports. Everything comes in through K. Forward +Z, up +Y, 1 unit = 1 m. The rig hovers: feet sit 0.15 m above the
// root (Q-i), so the game puts the root on the pier or on the water surface and they "walk on water".
// ONE toon material per rig (Q-h) with ghost / solid modes: J.setSolid(bool) or opts.solid at build. Ghost = transparent,
// opacity 0.5, FrontSide, depthWrite on (only the nearest surface shows: no internal layering, no z-fight), ink hulls hidden.
// Solid = opaque, hulls shown (the ghost lantern flash). No rebuild, same draw calls.
export const PHANTOM_C = { glow: '#7fe8d0', coat: '#2b3a5c', bone: '#e8e4d6', gold: '#b8963e', rope: '#6a5a44' };
export const GANG = {
  id: 'phantoms', name: 'Fells Point Phantoms', animal: 'ghost', district: ['fells'], night: true,
  accent: PHANTOM_C.glow, members: ['deckhand_dread', 'bosun_bones', 'powder_monkey'],
};
export const META = {
  deckhand_dread: { hp: 8, scale: 1, radius: 0.42, weapon: null, hover: 0.15 },
  bosun_bones: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true, hover: 0.15 },
  powder_monkey: { hp: 6, scale: 0.8, radius: 0.36, weapon: 'spectral_bomb', hover: 0.15 },
};
const HOVER = 0.15;
// THUG_D proportions with the hip raised by the hover, so every THUG pose (J.d.hip + p.y) floats the whole body
const PH_D = { hip: 0.9 + HOVER, torsoY: 0.06, neckY: 0.62, legX: 0.13, thigh: 0.4, shin: 0.41, shX: 0.29, shY: 0.5, upper: 0.29, fore: 0.27 };
const PH_LOOK = {
  deckhand_dread: { hat: 'bandana', coat: PHANTOM_C.coat, sash: PHANTOM_C.rope },
  bosun_bones: { hat: 'tricorn', coat: '#24304d', sash: PHANTOM_C.gold, big: true },
  powder_monkey: { hat: 'cap', coat: '#33456b', sash: PHANTOM_C.rope },
};

function phPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  if ([dx, dy, dz].filter((v) => v < 0.04).length >= 2) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}
function phPaint(K, m, colour) {
  const p = m.geometry.attributes.position, c = m.geometry.attributes.color, col = new K.THREE.Color();
  for (let i = 0; i + 2 < p.count; i += 3) {
    const mx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, my = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, mz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const v = colour(mx, my, mz); if (!v) continue; col.set(v); for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b);
  }
  c.needsUpdate = true; return m;
}

export function buildPhantom(K, member = 'deckhand_dread', opts = {}) {   // opts: { lod: 0 | 1, seed, solid }
  const { G, grp, skeleton, toonMat, INK } = K;
  if (!PH_LOOK[member]) member = 'deckhand_dread';
  const L = PH_LOOK[member], big = !!L.big, lod = opts.lod === 1, C = PHANTOM_C;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mat = toonMat({ transparent: true, opacity: 0.5, depthWrite: true });   // the ONE material: every part + the merged mesh
  if (mat.emissive) mat.emissive.set(C.glow).multiplyScalar(0.18);            // faint spectral glow (reads at night)
  const d = PH_D, J = skeleton(d, mat);
  const sx = big ? 1.28 : 1, sz = big ? 1.2 : 1;
  const P = (parent, name, geom, col, x, y, z, o) => phPart(K, parent, name, geom, col, x, y, z, o);

  // ---- torso: long ragged privateer coat with a sash; hips = coat skirt ----
  P(J.hips, 'skirt', G.cyl(0.2 * sx, (big ? 0.21 : 0.25) * sx, big ? 0.26 : 0.32), L.coat, 0, big ? -0.04 : -0.07, 0, { rot: [0, rnd() * 0.6, 0] });
  const coat = P(J.torso, 'coat', G.sph(0.25 * sx, 0.36, 0.21 * sz).toNonIndexed(), L.coat, 0, 0.3, 0);
  phPaint(K, coat, (x, y, z) => (Math.abs(y + x * 0.45 / sx) < 0.045 ? L.sash : z > 0.12 && Math.abs(x) < 0.03 ? C.gold : null));
  // ---- head: rounded skull with glowing sockets, no jaw-face copy of anything real ----
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = mat;
  const skull = P(head, 'skull', G.sph(0.17, 0.18, 0.17).toNonIndexed(), C.bone, 0, 0.17, 0);
  phPaint(K, skull, (x, y, z) => (z > 0.1 && y > 0.0 && y < 0.07 && Math.abs(x) > 0.025 && Math.abs(x) < 0.11 ? C.glow : z > 0.1 && y < -0.08 ? '#9a978c' : null));
  if (!lod) P(head, 'jaw', G.box(0.18, 0.06, 0.12), C.bone, 0, 0.03, 0.07);
  if (L.hat === 'tricorn') {
    P(head, 'tricorn', G.cyl(0.3, 0.26, 0.09, 3), L.coat, 0, 0.33, -0.01, { rot: [0, Math.PI / 6, 0] });
    if (!lod) P(head, 'hatband', G.cyl(0.18, 0.18, 0.06), C.gold, 0, 0.36, -0.01);
  } else if (L.hat === 'bandana') {
    P(head, 'bandana', G.sph(0.18, 0.11, 0.18), '#5a2e3a', 0, 0.27, -0.01);
    if (!lod) P(head, 'knot', G.sph(0.06, 0.05, 0.08), '#5a2e3a', 0.0, 0.25, -0.19);
  } else P(head, 'cap', G.cyl(0.16, 0.18, 0.12), C.rope, 0, 0.3, -0.01);
  if (!lod && member === 'deckhand_dread') P(head, 'earring', G.tor(0.035, 0.01), C.gold, 0.17, 0.1, 0.0, { rot: [0, Math.PI / 2, 0] });

  // ---- arms: coat sleeves, gold cuffs, bony hands ----
  const ua = big ? 0.105 : 0.085, fa = big ? 0.088 : 0.075;
  for (const k of ['L', 'R']) {
    P(J['sh' + k], 'shoulder', G.sph(big ? 0.12 : 0.11, 0.1, big ? 0.12 : 0.11), L.coat, 0, -0.01, 0);
    P(J['sh' + k], 'upper', G.cap(ua, d.upper - 0.06), L.coat, 0, -d.upper / 2, 0);
    const f = P(J['el' + k], 'fore', G.cap(fa, d.fore - 0.06).toNonIndexed(), L.coat, 0, -d.fore / 2, 0);
    if (!lod) phPaint(K, f, (x, y) => (y < -(d.fore - 0.06) / 2 + 0.02 ? C.gold : null));
    P(J['ha' + k], 'hand', G.sph(big ? 0.09 : 0.07, big ? 0.095 : 0.075, big ? 0.09 : 0.07), C.bone, 0, -0.05, 0.01);
  }
  // ---- legs: ragged breeches fading into spectral wisps (no feet: tapered glowing curls at the ankles) ----
  for (const k of ['L', 'R']) {
    P(J['lg' + k], 'thigh', G.cap(big ? 0.11 : 0.092, d.thigh - 0.1), C.rope, 0, -d.thigh / 2 + 0.03, 0);
    P(J['kn' + k], 'wisp', G.cyl(big ? 0.085 : 0.075, 0.025, d.shin - 0.02), C.glow, 0, -d.shin / 2 + 0.02, 0);
    if (!lod) P(J['ft' + k], 'curl', G.sph(0.05, 0.04, 0.09), C.glow, 0, 0.02, 0.04, { outline: false });
  }
  // ---- extras ----
  if (!lod && big) {   // bosun: barnacled gold epaulettes + a coil of ghost rope on the shoulder
    for (const k of ['L', 'R']) P(J['sh' + k], 'epaulette', G.cyl(0.1, 0.12, 0.04), C.gold, 0, 0.08, 0);
    P(J.torso, 'rope_coil', G.tor(0.16, 0.035), C.rope, -0.12, 0.42, 0.0, { rot: [Math.PI / 2, 0.5, 0.6] });
  }
  if (member === 'powder_monkey') {   // spectral bomb on swR: the gang `attack` is the throw
    const W = J.swR = grp(J.haR, 0, -0.06, 0.04); W.userData.mat = mat;
    P(W, 'bomb', G.sph(0.11, 0.11, 0.11), '#1d2a30', 0, -0.06, 0.02);
    if (!lod) P(W, 'fuse', G.cyl(0.015, 0.015, 0.08), C.glow, 0, 0.06, 0.02, { outline: false });
  }
  // ---- solid / ghost toggle (Q-h). Hulls: only this rig's own hull meshes are toggled ----
  J.solid = null;
  J.setSolid = (on) => {
    on = !!on; if (J.solid === on) return J; J.solid = on;
    mat.transparent = !on; mat.opacity = on ? 1 : 0.5; mat.depthWrite = true; mat.needsUpdate = true;
    J.root.traverse((o) => {   // re-scanned every call, so it also covers the ink mesh mergeRig adds
      if (!o.isMesh || o.material === mat) return;
      if (on) { if (o.userData.phHid) { o.visible = true; o.userData.phHid = false; } } else if (o.visible) { o.visible = false; o.userData.phHid = true; }
    });
    return J;
  };
  J.setSolid(!!opts.solid);
  J.kind = 'thug'; J.meta = META[member]; J.ghost = true;
  void INK;
  return J;
}

// optional: a slow spectral bob of the whole hips on top of the thug pose (never below the hover line), held in 'down'.
export function animateGang(J, t, state) {
  if (!J.ghost || state === 'down') return;
  J.hips.position.y += Math.sin(t * 2.2) * 0.02 + 0.02;
}

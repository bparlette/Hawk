// gang_harbor_rats.js — Toad City Baltimore, Task C: the Harbor Rats (north shore: Harborplace, USS Constellation,
// World Trade Center, Washington Monument). Anthropomorphic Norway rats in a navy + mustard uniform:
// every member wears a navy top, a mustard neckerchief and a mustard life ring on the back.
// No imports. Everything comes in through K (toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
export const GANG = {
  id: 'harbor_rats', name: 'Harbor Rats', animal: 'rat', district: ['harborplace', 'constellation', 'wtc', 'monument'],
  accent: '#ffd23c', members: ['grunt_a', 'grunt_b', 'armed', 'bruiser'],
};
export const META = {
  grunt_a: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  grunt_b: { hp: 8, scale: 1, radius: 0.42, weapon: null },
  armed: { hp: 8, scale: 1, radius: 0.42, weapon: 'broken_oar' },
  bruiser: { hp: 16, scale: 1.2, radius: 0.55, weapon: null, big: true },
};

// rat proportions: same keys as K.THUG_D, slightly shorter legs and a lower neck (hunched, head pushed forward)
// shX 0.27 (was 0.3) keeps the upper arm touching the torso when the real `down` / `windup` poses raise the arms overhead
const HR_D = { hip: 0.88, torsoY: 0.06, neckY: 0.6, legX: 0.13, thigh: 0.4, shin: 0.39, shX: 0.27, shY: 0.5, upper: 0.29, fore: 0.27 };
const HR_D_BIG = Object.assign({}, HR_D, { shX: 0.3 });   // bruiser: wider torso + fur shoulder balls, no gap at 0.3
const HR_C = {
  belly: '#cbbba6', skin: '#d98c96', nose: '#c45a74', tail: '#c99099', navy: '#34407c', mustard: '#ffd23c',
  eye: '#ece6d2', tooth: '#efe3b0', wood: '#9a6a44', blade: '#c9b48a', gold: '#c8a040',
};
const HR_LOOK = {
  grunt_a: { fur: '#8c7b6b', pants: '#5a6478', sleeves: 'navy', hat: 'beanie' },
  grunt_b: { fur: '#6e6358', pants: '#6f6a62', sleeves: 'fur', hat: 'flatcap', hood: true, droopEar: true },
  armed: { fur: '#9b9184', pants: '#5a5248', sleeves: 'fur', hat: 'patch' },
  bruiser: { fur: '#7c6450', pants: '#4f5a52', sleeves: 'none', hat: 'dorag', big: true },
};

// one fur-fleck map shared by every rat (256², drawn once per kit, light neutral so the vertex colour tints it).
// Keyed on a stable shared kit object (QUAL / THREE), not on K itself, so a per-spawn wrapper like {...K} reuses it.
// "No texture" (no `document` yet) is never cached: the next build with a DOM draws it.
const HR_FUR = new WeakMap();
function hrFurTex(K) {
  const key = K.QUAL || K.THREE || K;
  if (HR_FUR.has(key)) return HR_FUR.get(key);
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    let s = 4242; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, 256, 256);
    // soft mottling, then short fur strokes running down the meridians (sphere v = pole to pole)
    for (let i = 0; i < 90; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(200,200,200,0.35)' : 'rgba(242,242,242,0.35)';
      x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 6 + rnd() * 14, 0, Math.PI * 2); x.fill();
    }
    x.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const px = rnd() * 256, py = rnd() * 256, len = 4 + rnd() * 7, a = (rnd() - 0.5) * 0.7, v = rnd();
      x.strokeStyle = v < 0.62 ? 'rgba(150,150,150,0.55)' : v < 0.9 ? 'rgba(178,178,178,0.6)' : 'rgba(242,242,242,0.8)';
      x.lineWidth = 1 + rnd() * 1.2;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * len, py + Math.cos(a) * len); x.stroke();
    }
    tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 1);
    HR_FUR.set(key, tex);
  }
  return tex;
}

// taper a sphere toward +Z (a rat snout): x/y shrink by up to `k` at the front tip. Normals are left as the sphere's.
function hrTaper(g, rz, k) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 1 - k * Math.pow(Math.min(1, Math.max(0, (p.getZ(i) / rz + 1) / 2)), 1.6);
    p.setX(i, p.getX(i) * f); p.setY(i, p.getY(i) * f);
  }
  p.needsUpdate = true; return g;
}

export function buildHarborRat(K, member = 'grunt_a', opts = {}) {   // opts: { lod: 0 | 1, seed, colors }
  const { G, part, grp, skeleton, toonMat, INK } = K;
  if (!HR_LOOK[member]) member = 'grunt_a';
  const L = HR_LOOK[member], big = !!L.big, lod = opts.lod === 1;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const C = Object.assign({}, HR_C, { fur: L.fur, pants: L.pants }, opts.colors);
  const mat = toonMat();                         // ONE toon material per rig (the game flashes it white on hits)
  const d = big ? HR_D_BIG : HR_D, J = skeleton(d, mat);         // same joint names as K.THUG_D => the game's thug poses drive it unchanged
  // fur sub-material (HD only): canvas-mapped toonMat that shares the rig's hit-flash uniforms
  let furMat = mat;
  const tex = lod ? null : hrFurTex(K);
  if (tex) { furMat = toonMat({ map: tex }); furMat.userData.flash = mat.userData.flash; furMat.userData.flashC = mat.userData.flashC; }
  const FO = (o) => Object.assign({ mat: furMat }, o);   // options for a fur-mapped part
  const sx = big ? 1.28 : 1, sz = big ? 1.22 : 1;

  if (lod) return hrLod(K, J, C, L, member, big, sz);

  // ---- hips + torso: hunched, open navy top showing the belly fur, mustard neckerchief, back patch ----
  part(J.hips, G.sph(0.21 * sx, 0.15, 0.17 * sz), C.pants, 0, 0.02, 0);
  part(J.torso, G.sph(0.26 * sx, 0.32, 0.21 * sz), C.navy, 0, 0.3, -0.01, { rot: [0.12, 0, 0] });
  part(J.torso, G.sph(0.18 * sx, 0.24, 0.12 * sz), C.belly, 0, 0.27, 0.12 * sz, FO({ rot: [0.12, 0, 0] }));
  part(J.torso, G.tor(0.135 * (big ? 1.2 : 1), 0.045), C.mustard, 0, 0.56, 0.02, { rot: [Math.PI / 2 + 0.25, 0, 0] });
  // diamond knot sits proud of the belly (z +2 cm, tilted to its slope): sunk in, its ink hull drew a stray line across the belly
  part(J.torso, G.box(0.17, 0.17, 0.045), C.mustard, 0, 0.47, 0.17 * sz + 0.04, { rot: [-0.45, 0, Math.PI / 4] });
  // gang patch: a mustard life ring strapped across the back
  part(J.torso, G.tor(0.1, 0.034), C.mustard, 0, 0.38, -0.2 * sz - 0.01, { rot: [0.12, 0, 0] });
  if (L.hood) part(J.torso, G.cap(0.085, 0.2), C.navy, 0, 0.56, -0.15, { rot: [-0.3, 0, Math.PI / 2] });   // rolled hood

  // ---- head: long snout, pink nose, buck tooth, big round ears, whiskers, mean brow ----
  const head = J.head = grp(J.neck, 0, -0.02, 0.06); head.userData.mat = mat;
  part(head, G.sph(0.19, 0.18, 0.19), C.fur, 0, 0.17, 0, FO());
  part(head, hrTaper(G.sph(0.13, 0.115, 0.24), 0.24, 0.55), C.fur, 0, 0.12, 0.17, FO({ rot: [0.12, 0, 0] }));
  part(head, G.sph(0.05, 0.042, 0.04), C.nose, 0, 0.095, 0.405);
  if (big) {
    part(head, G.box(0.034, 0.06, 0.02), C.tooth, -0.019, 0.04, 0.37, { rot: [0.35, 0, 0], outline: false, shadow: false });
    part(head, G.box(0.034, 0.06, 0.02), C.gold, 0.019, 0.04, 0.37, { rot: [0.35, 0, 0], outline: false, shadow: false });
  } else part(head, G.box(0.066, 0.06, 0.02), C.tooth, 0, 0.04, 0.37, { rot: [0.35, 0, 0], outline: false, shadow: false });
  const wa = 0.1 + rnd() * 0.05;
  for (const r of [wa, -wa]) part(head, G.box(0.5, 0.009, 0.009), INK, 0, 0.11, 0.33, { rot: [0, 0, r], outline: false, shadow: false });
  for (const [sd, k] of [[1, 'L'], [-1, 'R']]) {
    // eyes: big whites + pupils (the bruiser squints: ink slits); the armed rat wears an eyepatch over his left eye
    if (L.hat === 'patch' && k === 'L') {
      part(head, G.sph(0.062, 0.066, 0.032), INK, sd * 0.088, 0.21, 0.16, { rot: [0, sd * 0.45, 0], outline: false, shadow: false });
    } else if (big) {
      part(head, G.box(0.075, 0.02, 0.02), INK, sd * 0.088, 0.205, 0.172, { rot: [0, sd * 0.45, sd * 0.12], outline: false, shadow: false });
    } else {
      part(head, G.sph(0.06, 0.066, 0.04), C.eye, sd * 0.09, 0.212, 0.158, { rot: [0, sd * 0.45, 0], outline: false, shadow: false });
      part(head, G.sph(0.027, 0.034, 0.022), INK, sd * 0.08, 0.205, 0.193, { outline: false, shadow: false });
    }
    part(head, G.box(big ? 0.13 : 0.11, big ? 0.04 : 0.028, 0.03), INK, sd * 0.088, big ? 0.245 : 0.262, 0.165, { rot: [0, sd * 0.4, sd * 0.35], outline: false, shadow: false });
    // ears on their own groups (animateGang twitches them); the grunt_b has one droopy, chewed ear
    const droop = L.droopEar && k === 'R';
    const ear = J['ear' + k] = grp(head, sd * 0.17, 0.35, -0.03);   // up/out: clears the beanie cuff and do-rag ear.userData.mat = mat;
    ear.rotation.set(-0.15, sd * 0.45, droop ? -sd * 0.9 : sd * 0.08);
    const es = droop ? 0.8 : 1;
    part(ear, G.cyl(0.12 * es, 0.12 * es, 0.04).scale(1, 1, 1.12), C.fur, 0, 0.02, 0, FO({ rot: [Math.PI / 2, 0, 0] }));
    part(ear, G.cyl(0.075 * es, 0.075 * es, 0.02).scale(1, 1, 1.12), C.skin, 0, 0.015, 0.018, { rot: [Math.PI / 2, 0, 0], outline: false, shadow: false });
  }
  if (L.hat === 'beanie') {          // navy watch cap with a mustard cuff, pushed back
    part(head, G.sph(0.19, 0.15, 0.19), C.navy, 0, 0.28, -0.03, { rot: [-0.2, 0, 0] });
    part(head, G.cyl(0.212, 0.218, 0.08), C.mustard, 0, 0.255, -0.025, { rot: [-0.2, 0, 0] });
    part(head, G.cyl(0.005, 0.006, 0.12), C.tooth, 0.05, 0.02, 0.33, { rot: [Math.PI / 2 - 0.3, 0.6, 0], outline: false, shadow: false });   // toothpick
  } else if (L.hat === 'flatcap') {  // navy flat cap, peak pulled low
    part(head, G.sph(0.205, 0.085, 0.215), C.navy, 0, 0.31, 0.0, { rot: [0.12, 0, 0] });
    part(head, G.cyl(0.16, 0.16, 0.026).scale(1, 1, 0.7), C.navy, 0, 0.285, 0.14, { rot: [0.3, 0, 0] });
  } else if (L.hat === 'patch') {    // eyepatch strap around the head
    part(head, G.tor(0.192, 0.012), INK, 0, 0.23, 0.0, { rot: [Math.PI / 2 - 0.35, -0.25, 0], outline: false, shadow: false });
  } else if (L.hat === 'dorag') {    // mustard do-rag + gold earring
    part(head, G.sph(0.196, 0.13, 0.198), C.mustard, 0, 0.275, -0.03, { rot: [-0.3, 0, 0] });
    part(head, G.tor(0.035, 0.009), C.gold, 0.2, 0.24, -0.05, { rot: [0, Math.PI / 2, 0], outline: false, shadow: false });
  }

  // ---- arms: rat paws; sleeves by member (navy jacket / rolled hoodie / fur) ----
  const ua = big ? 0.115 : 0.082, fa = big ? 0.1 : 0.07;
  for (const k of ['L', 'R']) {
    const upFur = L.sleeves === 'none', foFur = L.sleeves !== 'navy';   // branch on the look, not on colour values
    if (big) part(J['sh' + k], G.sph(0.15, 0.14, 0.15), C.fur, 0, -0.02, 0, FO());
    part(J['sh' + k], G.cap(ua, d.upper - 0.06), upFur ? C.fur : C.navy, 0, -d.upper / 2, 0, upFur ? FO() : {});
    part(J['el' + k], G.cap(fa, d.fore - 0.06), foFur ? C.fur : C.navy, 0, -d.fore / 2, 0, foFur ? FO() : {});
    part(J['ha' + k], G.sph(big ? 0.1 : 0.075, big ? 0.1 : 0.08, big ? 0.1 : 0.075), C.skin, 0, -0.05, 0.01);
  }
  // ---- legs: rolled trousers, long pink feet ----
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(big ? 0.11 : 0.09, d.thigh - 0.08), C.pants, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(big ? 0.085 : 0.072, d.shin - 0.1), C.pants, 0, -d.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.075, 0.045, 0.165), C.skin, 0, 0.008, 0.075);
  }
  // ---- tail: three tapering segments on their own groups (J.tail > J.tail1 > J.tail2) ----
  const T = J.tail = grp(J.hips, 0, -0.02, -0.15); T.userData.mat = mat;
  const T1 = J.tail1 = grp(T, 0, -0.3, 0), T2 = J.tail2 = grp(T1, 0, -0.3, 0);
  T1.userData.mat = T2.userData.mat = mat;
  J.tailBase = [0.75 + rnd() * 0.1, 0.65, 0.55 + rnd() * 0.15];
  T.rotation.x = J.tailBase[0]; T1.rotation.x = J.tailBase[1]; T2.rotation.x = J.tailBase[2];
  part(T, G.cap(0.045, 0.24), C.tail, 0, -0.15, 0);
  part(T1, G.cap(0.035, 0.25), C.tail, 0, -0.15, 0);
  part(T2, G.cap(0.026, 0.24), C.tail, 0, -0.14, 0);

  // ---- armed: a broken rowboat oar, mustard gang paint on the blade (built along +Y inside J.swR) ----
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = mat;
    part(W, G.cyl(0.028, 0.03, 0.82), C.wood, 0, 0.2, 0);
    part(W, G.box(0.16, 0.36, 0.042), C.blade, 0, 0.76, 0, { rot: [0, 0, 0.04] });
    part(W, G.box(0.165, 0.09, 0.046), C.mustard, 0, 0.88, 0, { rot: [0, 0, 0.04], outline: false, shadow: false });
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;                                      // the rig: J.root, J.mat, the 18 joints, J.head, J.d (+ J.tail*, J.ear*, J.swR)
}

// far LOD (opts.lod === 1): ≤ 14 parts, no map, no fine detail. Head and snout are one tapered egg; no hands, feet or tail.
// The mustard neckerchief always stays (it is the gang colour at distance); the armed rat drops the hips sphere instead
// to free a slot for his oar (torso and legs cover it beyond 24 m). Proportions follow HD, including the bruiser's depth.
function hrLod(K, J, C, L, member, big, sz) {
  const { G, part, grp } = K, d = J.d, sx = big ? 1.28 : 1;
  if (member !== 'armed') part(J.hips, G.sph(0.21 * sx, 0.15, 0.17 * sz), C.pants, 0, 0.02, 0);
  part(J.torso, G.sph(0.26 * sx, 0.32, 0.21 * sz), C.navy, 0, 0.3, 0, { rot: [0.12, 0, 0] });
  part(J.torso, G.box(0.2, 0.2, 0.05), C.mustard, 0, 0.47, 0.17 * sz + 0.02, { rot: [-0.25, 0, Math.PI / 4] });
  const head = J.head = grp(J.neck, 0, -0.02, 0.06); head.userData.mat = J.mat;
  part(head, hrTaper(G.sph(0.18, 0.17, 0.32), 0.32, 0.6), C.fur, 0, 0.15, 0.1, { rot: [0.12, 0, 0] });
  for (const sd of [1, -1]) part(head, G.cyl(0.115, 0.115, 0.04), C.fur, sd * 0.155, 0.33, -0.03, { rot: [Math.PI / 2, 0, -sd * 0.45], shadow: false });
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.cyl(0.08 * sx, 0.07 * sx, d.upper), L.sleeves === 'none' ? C.fur : C.navy, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cyl(0.07 * sx, 0.075 * sx, d.fore + 0.08), L.sleeves === 'navy' ? C.navy : C.fur, 0, -d.fore / 2 - 0.04, 0);
    part(J['lg' + k], G.cyl(0.09 * sx, 0.08 * sx, d.thigh), C.pants, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cyl(0.07, 0.08, d.shin + 0.05), C.pants, 0, -d.shin / 2 - 0.025, 0);
  }
  if (member === 'armed') {
    const W = J.swR = grp(J.haR, 0, -0.04, 0); W.userData.mat = J.mat;
    part(W, G.box(0.12, 1.1, 0.045), C.blade, 0, 0.45, 0);
  }
  J.kind = 'thug'; J.meta = META[member];
  return J;
}

// per-frame tail swish and ear twitches. state: idle | run | attack | hurt | down (map the game's others: see README).
// REQUIRED every frame whenever the rig uses the `down` pose: the rest tail curls up behind the hips, so on its back the
// rig would push it ~0.7 m through the floor. 'down' lays the whole tail flat toward the feet with a small side swish
// (lowest point stays above y=0). In every other state the tail flattens in step with how far J.tilt has the rig on its
// back, so the damped fall -> getup blend never pushes it through the floor either. Safe on LOD rigs (no tail or ears).
export function animateGang(J, t, state) {
  if (J.tail && J.tailBase) {
    const B = J.tailBase;
    const f = state === 'run' ? 9 : state === 'attack' ? 6 : 2.2, a = state === 'run' ? 0.45 : 0.22;
    const lift = state === 'hurt' ? -0.45 : state === 'run' ? -0.25 : 0;
    // standing tail: [x, y, z] per segment
    const up = [[B[0] + lift, Math.sin(t * f) * a, 0], [B[1], 0, Math.sin(t * f - 0.9) * a * 0.9], [B[2] + (state === 'hurt' ? -0.4 : 0), 0, Math.sin(t * f - 1.8) * a]];
    // flat tail (on its back)
    const flat = [[-0.15, 0, Math.sin(t * 2.2) * 0.08], [0.1, 0, Math.sin(t * 2.2 - 0.9) * 0.07], [0.15, 0, Math.sin(t * 2.2 - 1.8) * 0.08]];
    // k: 1 = flat. Forced in 'down'; otherwise it follows the back-tilt (smoothstep 0.5..1.2 rad) and the tail swings out
    // sideways mid-blend, so a half-curled tail never points straight down while the rig is getting up.
    const th = J.tilt ? -J.tilt.rotation.x : 0, u = Math.min(1, Math.max(0, (th - 0.5) / 0.7));
    const k = state === 'down' ? 1 : u * u * (3 - 2 * u), side = 1.2 * Math.sin(Math.PI * k);
    [J.tail, J.tail1, J.tail2].forEach((g, i) => g.rotation.set(up[i][0] + (flat[i][0] - up[i][0]) * k,
      up[i][1] + (flat[i][1] - up[i][1]) * k, up[i][2] + (flat[i][2] - up[i][2]) * k + (i === 0 ? side : 0)));
  }
  for (const [k, sd] of [['L', 1], ['R', -1]]) {
    const e = J['ear' + k]; if (!e) continue;
    if (e.userData.z0 === undefined) e.userData.z0 = e.rotation.z;
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + (sd > 0 ? 0 : 2.1))), 24) * 0.35;
    e.rotation.z = e.userData.z0 + sd * (tw + (state === 'hurt' ? -0.4 : 0));
  }
}

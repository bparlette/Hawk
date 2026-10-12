
// ---------------- characters: procedural stylised rigs (groups of toon parts with outline hulls) ----------------
const G = {
  sph: (rx, ry, rz, ws = 14, hs = 10) => new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz),
  cap: (r, len, rs = 10) => new THREE.CapsuleGeometry(r, len, 4, rs),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
};
function part(parent, geom, col, x = 0, y = 0, z = 0, o = {}) {
  bakeColor(geom, col); if (o.outline !== false) addOdir(geom);
  const m = new THREE.Mesh(geom, o.mat || parent.userData.mat || parent.parent?.userData.mat);
  m.position.set(x, y, z); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  geom.computeBoundingSphere(); m.castShadow = o.shadow !== false && geom.boundingSphere.radius > 0.1; parent.add(m);
  if (o.outline !== false) { const ol = new THREE.Mesh(geom, o.olMat || OUT_CHAR); ol.castShadow = false; m.add(ol); }
  return m;
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// skeleton: root (world pos + facing) > tilt (falls / flips / spins) > hips > torso > neck; legs on hips, arms on torso
function skeleton(d, mat) {
  const J = {}; J.root = new THREE.Group(); J.mat = mat;
  const P = (g) => { g.userData.mat = mat; return g; };
  J.tilt = P(grp(J.root)); J.hips = P(grp(J.tilt, 0, d.hip, 0)); J.torso = P(grp(J.hips, 0, d.torsoY, 0)); J.neck = P(grp(J.torso, 0, d.neckY, 0));
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    J['lg' + k] = P(grp(J.hips, s * d.legX, 0, 0)); J['kn' + k] = P(grp(J['lg' + k], 0, -d.thigh, 0)); J['ft' + k] = P(grp(J['kn' + k], 0, -d.shin, 0));
    J['sh' + k] = P(grp(J.torso, s * d.shX, d.shY, 0)); J['el' + k] = P(grp(J['sh' + k], 0, -d.upper, 0)); J['ha' + k] = P(grp(J['el' + k], 0, -d.fore, 0));
  }
  J.d = d; return J;
}
const HERO_D = { hip: 0.8, torsoY: 0.06, neckY: 0.66, legX: 0.15, thigh: 0.36, shin: 0.36, shX: 0.37, shY: 0.5, upper: 0.27, fore: 0.25 };
function buildHero(o = {}) { // o.staff: the partner turtle (bo staff instead of twin blades, own colours)
  const mat = toonMat(); const J = skeleton(HERO_D, mat), d = HERO_D;
  const SK = o.sk || '#5ccf3a', SK2 = o.sk2 || '#49b52c', PL = o.pl || '#ffd75e', SH = o.sh || '#b8672b', RIM = o.rim || '#ffb43c', BAND = o.band || '#1f7bff', WRAP = '#fff0d6', BELT = o.belt || '#8a4b22';
  // hips + belt
  part(J.hips, G.sph(0.25, 0.17, 0.21), SK, 0, 0.02, 0);
  part(J.hips, G.cyl(0.27, 0.27, 0.12, 16), BELT, 0, 0.12, 0);
  part(J.hips, G.box(0.14, 0.12, 0.06), '#ffd23c', 0, 0.12, 0.25);
  // torso: chest, plastron, shell + rim, X straps
  part(J.torso, G.sph(0.31, 0.36, 0.25), SK, 0, 0.3, 0);
  part(J.torso, G.sph(0.25, 0.31, 0.12), PL, 0, 0.28, 0.15);
  part(J.torso, G.box(0.36, 0.035, 0.04), '#d9a83a', 0, 0.36, 0.265, { outline: false, rot: [0.15, 0, 0] });
  part(J.torso, G.box(0.34, 0.035, 0.04), '#d9a83a', 0, 0.2, 0.262, { outline: false, rot: [-0.1, 0, 0] });
  part(J.torso, G.sph(0.4, 0.45, 0.13), RIM, 0, 0.32, -0.12);
  part(J.torso, G.sph(0.35, 0.41, 0.22), SH, 0, 0.33, -0.17);
  part(J.torso, G.sph(0.14, 0.14, 0.06), '#8f4c1e', 0, 0.38, -0.37, { outline: false });
  part(J.torso, G.sph(0.1, 0.1, 0.05), '#8f4c1e', 0.17, 0.2, -0.33, { outline: false });
  part(J.torso, G.sph(0.1, 0.1, 0.05), '#8f4c1e', -0.17, 0.2, -0.33, { outline: false });
  for (const s of [-1, 1]) part(J.torso, G.box(0.07, 0.62, 0.05), BELT, s * 0.06, 0.32, 0.25, { rot: [0.1, 0, s * 0.55], outline: false });
  // sword hilts on the back (scabbards); the staff turtle wears a knee-pad style shoulder guard instead
  if (!o.staff) for (const s of [-1, 1]) part(J.torso, G.cyl(0.05, 0.05, 0.7, 8), '#3a2a7a', s * 0.18, 0.42, -0.36, { rot: [0.2, 0, s * 0.5] });
  else { part(J.torso, G.sph(0.16, 0.1, 0.16), '#3a2a7a', 0.3, 0.55, 0.0); part(J.torso, G.box(0.06, 0.06, 0.06), '#ffd23c', 0.3, 0.63, 0.1, { outline: false }); }
  // head: big round head, snout, bandana band + knot + tails, eyes
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.27, 0.25, 0.26), SK, 0, 0.2, 0.0);
  part(head, G.sph(0.19, 0.13, 0.15), SK2, 0, 0.12, 0.14);
  part(head, G.box(0.16, 0.025, 0.02), '#14101f', 0, 0.08, 0.285, { outline: false, rot: [0, 0, 0.0] });
  part(head, G.cyl(0.281, 0.281, 0.12, 22), BAND, 0, 0.24, 0.0);
  part(head, G.sph(0.075, 0.06, 0.03), '#fff', 0.1, 0.245, 0.275, { outline: false });
  part(head, G.sph(0.075, 0.06, 0.03), '#fff', -0.1, 0.245, 0.275, { outline: false });
  part(head, G.sph(0.03, 0.04, 0.02), '#14101f', 0.09, 0.245, 0.3, { outline: false });
  part(head, G.sph(0.03, 0.04, 0.02), '#14101f', -0.09, 0.245, 0.3, { outline: false });
  part(head, G.box(0.13, 0.03, 0.03), '#14101f', 0.1, 0.305, 0.27, { outline: false, rot: [0, 0, -0.25] });
  part(head, G.box(0.13, 0.03, 0.03), '#14101f', -0.1, 0.305, 0.27, { outline: false, rot: [0, 0, 0.25] });
  part(head, G.sph(0.07, 0.07, 0.06), BAND, 0, 0.24, -0.29);
  J.tails = [];
  for (const s of [-1, 1]) { const t = grp(head, s * 0.04, 0.24, -0.3); t.userData.mat = mat; part(t, G.box(0.07, 0.4, 0.025), BAND, 0, -0.18, 0); t.rotation.set(0.5, 0, s * 0.2); J.tails.push(t); }
  // arms
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.11, 0.11, 0.11), SK, 0, 0, 0);
    part(J['sh' + k], G.cap(0.085, d.upper - 0.08), SK, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(0.08, d.fore - 0.08), SK, 0, -d.fore / 2, 0);
    part(J['el' + k], G.cyl(0.095, 0.095, 0.1, 10), WRAP, 0, -d.fore + 0.06, 0);
    part(J['sh' + k], G.cyl(0.1, 0.1, 0.08, 10), WRAP, 0, -d.upper + 0.06, 0, { outline: false });
    part(J['ha' + k], G.sph(0.105, 0.1, 0.1), SK, 0, -0.04, 0);
    // sword: grip / guard / blade (blade along +y of the sword group)
    const sw = J['sw' + k] = grp(J['ha' + k], 0, -0.05, 0); sw.userData.mat = mat;
    if (o.staff) { // bo staff: one long pole held at its middle in the right hand (left hand: empty)
      if (k === 'R') { part(sw, G.cyl(0.042, 0.042, 2.0, 10), '#b9783f', 0, 0.12, 0); for (const y of [-0.82, 0.12, 1.06]) part(sw, G.cyl(0.052, 0.052, 0.16, 10), y === 0.12 ? '#3a2a7a' : '#14101f', 0, y, 0, { outline: false }); }
      continue;
    }
    part(sw, G.cyl(0.03, 0.03, 0.24, 8), '#3a2a7a', 0, 0.0, 0);
    part(sw, G.cyl(0.075, 0.075, 0.03, 12), '#ffd23c', 0, 0.13, 0);
    part(sw, G.box(0.055, 0.78, 0.016), '#eafcff', 0, 0.54, 0);
    part(sw, G.box(0.02, 0.76, 0.02), '#7fd6ff', 0.026, 0.54, 0, { outline: false });
    part(sw, G.cyl(0.0, 0.028, 0.08, 4), '#eafcff', 0, 0.97, 0, { outline: false });
  }
  // legs
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.105, d.thigh - 0.1), SK, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.sph(0.1, 0.09, 0.08), WRAP, 0, 0, 0.06);
    part(J['kn' + k], G.cap(0.095, d.shin - 0.12), SK, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.115, 0.075, 0.17), SK2, 0, -0.03, 0.06);
    part(J['kn' + k], G.cyl(0.105, 0.105, 0.08, 10), WRAP, 0, -d.shin + 0.1, 0, { outline: false });
  }
  J.kind = 'hero'; return J;
}
const THUG_D = { hip: 0.92, torsoY: 0.06, neckY: 0.64, legX: 0.13, thigh: 0.42, shin: 0.41, shX: 0.31, shY: 0.52, upper: 0.3, fore: 0.27 };
const THUG_LOOKS = [
  { jacket: '#ff3d6e', pants: '#2f5bd3', skin: '#c98a5a', hair: 'mohawk', hairC: '#ffe14d', shoe: '#fff', weapon: null, sleeve: true },
  { jacket: '#7b4dff', pants: '#2c2c3c', skin: '#f0b989', hair: 'beanie', hairC: '#ff8a2a', shoe: '#ff3d6e', weapon: 'pipe', sleeve: true },
  { jacket: '#ff9f1c', pants: '#3d6bff', skin: '#8d5a3b', hair: 'cap', hairC: '#1fd3c6', shoe: '#fff', weapon: null, sleeve: false },
  { jacket: '#23c26b', pants: '#3a2f5a', skin: '#e8a878', hair: 'spikes', hairC: '#ff4fd8', shoe: '#ffd23c', weapon: 'bat', sleeve: false },
  { jacket: '#f2f2f2', pants: '#c42b48', skin: '#b9784b', hair: 'bald', hairC: '#3a2416', shoe: '#14101f', weapon: null, sleeve: false, big: true },
];
function buildThug(look) {
  const mat = toonMat(); const d = THUG_D, J = skeleton(d, mat);
  const { jacket, pants, skin } = look;
  part(J.hips, G.sph(0.22, 0.15, 0.17), pants, 0, 0.02, 0);
  part(J.hips, G.cyl(0.235, 0.235, 0.07, 14), '#14101f', 0, 0.1, 0, { outline: false });
  part(J.torso, G.sph(look.big ? 0.33 : 0.27, 0.33, look.big ? 0.24 : 0.2), jacket, 0, 0.3, 0);
  if (!look.big) { part(J.torso, G.box(0.09, 0.5, 0.03), '#14101f', 0.0, 0.3, 0.195, { outline: false }); part(J.torso, G.cyl(0.16, 0.2, 0.12, 12), jacket, 0, 0.6, 0); }
  else { part(J.torso, G.cyl(0.03, 0.03, 0.5, 6), '#ffd23c', 0, 0.48, 0.2, { rot: [Math.PI / 2 - 0.3, 0, Math.PI / 2], outline: false }); }
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.cyl(0.08, 0.09, 0.12, 10), skin, 0, 0.03, 0);
  part(head, G.sph(0.17, 0.2, 0.18), skin, 0, 0.2, 0.01);
  part(head, G.sph(0.045, 0.05, 0.05), skin, 0, 0.18, 0.18, { outline: false });
  part(head, G.box(0.28, 0.065, 0.05), '#14101f', 0, 0.245, 0.15, { outline: false });
  part(head, G.box(0.1, 0.02, 0.02), '#7a2a2a', 0, 0.1, 0.17, { outline: false });
  if (look.hair === 'mohawk') part(head, G.box(0.07, 0.16, 0.34), look.hairC, 0, 0.4, -0.01);
  if (look.hair === 'beanie') { part(head, G.sph(0.185, 0.14, 0.19), look.hairC, 0, 0.3, 0.0); part(head, G.cyl(0.19, 0.19, 0.06, 14), '#fff0d6', 0, 0.27, 0); }
  if (look.hair === 'cap') { part(head, G.sph(0.18, 0.12, 0.19, 16, 8), look.hairC, 0, 0.31, 0.0); part(head, G.box(0.22, 0.03, 0.18), look.hairC, 0, 0.3, -0.24); }
  if (look.hair === 'spikes') for (let i = 0; i < 5; i++) part(head, G.cyl(0, 0.06, 0.2, 5), look.hairC, (i - 2) * 0.07, 0.42, -0.02 - Math.abs(i - 2) * 0.02, { rot: [-0.3, 0, (i - 2) * -0.25] });
  if (look.hair === 'bald') part(head, G.sph(0.13, 0.08, 0.06), look.hairC, 0, 0.1, 0.13);
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(look.big ? 0.14 : 0.1, 0.1, 0.1), look.big ? skin : jacket, 0, 0, 0);
    part(J['sh' + k], G.cap(look.big ? 0.11 : 0.08, d.upper - 0.08), look.big ? skin : jacket, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(look.big ? 0.1 : 0.07, d.fore - 0.08), look.sleeve ? jacket : skin, 0, -d.fore / 2, 0);
    part(J['ha' + k], G.sph(look.big ? 0.12 : 0.095, 0.09, 0.09), skin, 0, -0.03, 0);
    part(J['lg' + k], G.cap(0.1, d.thigh - 0.1), pants, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.09, d.shin - 0.1), pants, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.11, 0.08, 0.18), look.shoe, 0, -0.03, 0.06);
    part(J['ft' + k], G.box(0.2, 0.03, 0.34), '#14101f', 0, -0.09, 0.06, { outline: false });
  }
  if (look.weapon) {
    const w = J.swR = grp(J.haR, 0, -0.04, 0); w.userData.mat = mat;
    if (look.weapon === 'pipe') { part(w, G.cyl(0.04, 0.04, 0.95, 8), '#9aa3c5', 0, 0.35, 0); part(w, G.cyl(0.06, 0.06, 0.1, 8), '#5f6688', 0, 0.8, 0); }
    else { part(w, G.cyl(0.075, 0.03, 0.95, 10), '#d9944f', 0, 0.38, 0); part(w, G.cyl(0.035, 0.035, 0.08, 8), '#14101f', 0, -0.06, 0); }
  }
  J.kind = 'thug'; return J;
}

// ---------------- poses (code-driven animation) ----------------
const JOINTS = ['tilt', 'hips', 'torso', 'neck', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'lgL', 'lgR', 'knL', 'knR', 'ftL', 'ftR', 'swL', 'swR'];
function blank() { const p = { y: 0, ty: 0 }; for (const j of JOINTS) p[j] = [0, 0, 0]; return p; }
function legsStance(p, wide = 0.13, bend = 0.3) {
  p.lgL = [-bend * 0.5, 0, wide]; p.lgR = [-bend * 0.3, 0, -wide]; p.knL = [bend, 0, 0]; p.knR = [bend * 0.9, 0, 0];
  p.ftL = [-bend * 0.5, 0, -wide]; p.ftR = [-bend * 0.5, 0, wide]; p.y = -0.04 - bend * 0.08;
}
function runLegs(p, ph, amp = 1) {
  for (const [k, o] of [['L', 0], ['R', Math.PI]]) {
    const s = Math.sin(ph + o), c = Math.cos(ph + o);
    p['lg' + k] = [-0.85 * s * amp - 0.15, 0, 0]; p['kn' + k] = [0.25 + 1.25 * Math.max(0, c) * amp, 0, 0]; p['ft' + k] = [0.3 * s * amp, 0, 0];
  }
  p.y = -0.05 + 0.07 * Math.abs(Math.sin(ph)) * amp;
}
// hero sword grip: sword group rotation relative to the hand (blade points along the fist's forward)
const SWF = [Math.PI / 2, 0, 0];
const HERO_POSES = {
  idle(t) {
    const p = blank(); legsStance(p, 0.16, 0.42); const b = Math.sin(t * 3.2) * 0.025; p.y += b;
    p.torso = [0.14, 0.32, 0]; p.neck = [-0.1, -0.3, 0]; p.hips = [0, -0.25, 0];
    p.shL = [-0.55, 0.0, 0.42]; p.elL = [-1.1, 0, 0]; p.haL = [0.15, 0, 0]; p.swL = [Math.PI / 2 + 0.55, 0, 0.35];
    p.shR = [-0.2, 0.0, -0.32]; p.elR = [-0.6, 0, 0]; p.haR = [0, 0, 0]; p.swR = [Math.PI / 2 - 0.35, 0, -0.9];
    return p;
  },
  run(t, sp) {
    const p = blank(), ph = t * (7 + sp * 0.9); runLegs(p, ph, clamp(sp / 6, 0.4, 1));
    p.torso = [0.42, Math.sin(ph) * 0.15, 0]; p.neck = [-0.32, -Math.sin(ph) * 0.12, 0];
    p.shL = [1.0, 0, 0.35]; p.elL = [-0.35, 0, 0]; p.swL = [Math.PI / 2 + 1.1, 0, 0.2];
    p.shR = [1.0, 0, -0.35]; p.elR = [-0.35, 0, 0]; p.swR = [Math.PI / 2 + 1.1, 0, -0.2];
    return p;
  },
  atk1(u) { // right blade, wide horizontal slash right -> left
    const p = blank(); legsStance(p, 0.2, 0.55); const a = ease(clamp((u - 0.12) / 0.33, 0, 1));
    p.torso = [0.2, lerp(-0.85, 0.95, a), 0]; p.hips = [0, lerp(-0.4, 0.45, a), 0]; p.neck = [-0.1, lerp(0.6, -0.6, a), 0];
    p.shR = [lerp(-1.1, -1.45, a), 0, lerp(-1.25, 0.55, a)]; p.elR = [lerp(-0.7, -0.1, a), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(-0.6, 0.3, a)];
    p.shL = [-0.4, 0, 0.5]; p.elL = [-1.2, 0, 0]; p.swL = [Math.PI / 2 + 0.6, 0, 0.3];
    p.lgL = [-0.7, 0, 0.18]; p.knL = [0.75, 0, 0]; p.lgR = [0.35, 0, -0.18]; p.knR = [0.3, 0, 0];
    return p;
  },
  atk2(u) { // left blade backhand left -> right
    const p = blank(); legsStance(p, 0.2, 0.55); const a = ease(clamp((u - 0.12) / 0.33, 0, 1));
    p.torso = [0.2, lerp(0.85, -0.95, a), 0]; p.hips = [0, lerp(0.4, -0.45, a), 0]; p.neck = [-0.1, lerp(-0.6, 0.6, a), 0];
    p.shL = [lerp(-1.1, -1.45, a), 0, lerp(1.25, -0.55, a)]; p.elL = [lerp(-0.7, -0.1, a), 0, 0]; p.swL = [Math.PI / 2, 0, lerp(0.6, -0.3, a)];
    p.shR = [-0.4, 0, -0.5]; p.elR = [-1.2, 0, 0]; p.swR = [Math.PI / 2 + 0.6, 0, -0.3];
    p.lgR = [-0.7, 0, -0.18]; p.knR = [0.75, 0, 0]; p.lgL = [0.35, 0, 0.18]; p.knL = [0.3, 0, 0];
    return p;
  },
  atk3(u) { // spinning double slash with a hop
    const p = blank(); const a = ease(clamp((u - 0.15) / 0.5, 0, 1));
    legsStance(p, 0.24, 0.35); p.y = Math.sin(clamp((u - 0.1) / 0.6, 0, 1) * Math.PI) * 0.45;
    p.tilt = [0, -a * TAU, 0];
    p.lgL = [-0.9, 0, 0.1]; p.knL = [1.4, 0, 0]; p.lgR = [-0.2, 0, -0.15]; p.knR = [0.6, 0, 0];
    p.shL = [-0.15, 0, 1.45]; p.shR = [-0.15, 0, -1.45]; p.elL = [-0.1, 0, 0]; p.elR = [-0.1, 0, 0];
    p.swL = [Math.PI / 2, 0, -0.2]; p.swR = [Math.PI / 2, 0, 0.2]; p.torso = [0.1, 0, 0];
    if (u < 0.15) { p.shL = [-0.8, 0, 0.3]; p.shR = [-0.8, 0, -0.3]; p.elL = p.elR = [-1.3, 0, 0]; p.torso = [0.35, 0.6, 0]; p.y = -0.15; }
    return p;
  },
  jump(vy) {
    const p = blank(); const up = vy > 0;
    p.lgL = [-1.0, 0, 0.15]; p.knL = [1.7, 0, 0]; p.lgR = [up ? -0.3 : -0.8, 0, -0.15]; p.knR = [up ? 0.7 : 1.5, 0, 0];
    p.shL = [-0.3, 0, 1.0]; p.shR = [-0.3, 0, -1.0]; p.elL = [-0.6, 0, 0]; p.elR = [-0.6, 0, 0];
    p.swL = [Math.PI / 2 + 0.9, 0, 0]; p.swR = [Math.PI / 2 + 0.9, 0, 0]; p.torso = [0.2, 0, 0]; p.neck = [-0.1, 0, 0];
    return p;
  },
  airatk(u) { // forward flip into a downward X-cut
    const p = HERO_POSES.jump(-1); const a = clamp(u / 0.7, 0, 1);
    p.tilt = [ease(a) * TAU, 0, 0]; p.lgL = p.lgR = [-1.3, 0, 0]; p.knL = p.knR = [2.0, 0, 0];
    p.shL = [lerp(-2.8, -0.9, a), 0, 0.3]; p.shR = [lerp(-2.8, -0.9, a), 0, -0.3]; p.elL = p.elR = [-0.2, 0, 0];
    p.swL = [Math.PI / 2, 0, 0.5]; p.swR = [Math.PI / 2, 0, -0.5];
    return p;
  },
  hurt(u) {
    const p = blank(); legsStance(p, 0.16, 0.5); const k = 1 - u;
    p.torso = [-0.45 * k, 0.2, 0]; p.neck = [-0.5 * k, 0, 0]; p.shL = [-0.8, 0, 0.9]; p.shR = [-0.8, 0, -0.9]; p.elL = p.elR = [-0.7, 0, 0];
    p.swL = [Math.PI / 2 + 0.8, 0, 0]; p.swR = [Math.PI / 2 + 0.8, 0, 0];
    return p;
  },
  down(u, ground) {
    const p = blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.3 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.6, 0, 0.6]; p.shR = [-2.4, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0];
    p.swL = [Math.PI / 2, 0, 0]; p.swR = [Math.PI / 2, 0, 0];
    if (!ground) { p.tilt = [-Math.PI / 2 * clamp(u * 2.2, 0, 1), 0, 0]; }
    return p;
  },
  getup(u) { const p = HERO_POSES.idle(0); legsStance(p, 0.2, 1.2 * (1 - u)); p.torso = [0.8 * (1 - u), 0, 0]; return p; },
};
const THUG_POSES = {
  idle(t, J) {
    const p = blank(); legsStance(p, 0.12, 0.25); const b = Math.sin(t * 4) * 0.03; p.y += b;
    p.torso = [0.08, 0.35, 0]; p.neck = [0, -0.35, 0]; p.hips = [0, -0.2, 0];
    p.shL = [-0.9, 0, 0.25]; p.elL = [-1.7, 0, 0]; p.shR = [-0.55, 0, -0.35]; p.elR = [-1.9, 0, 0];
    if (J.swR) { p.shR = [-0.3, 0, -0.2]; p.elR = [-0.8, 0, 0]; p.swR = [Math.PI / 2 - 0.5, 0, 0]; }
    return p;
  },
  run(t, sp, J) {
    const p = blank(), ph = t * (6 + sp); runLegs(p, ph, clamp(sp / 4.5, 0.4, 1));
    p.torso = [0.22, Math.sin(ph) * 0.2, 0];
    p.shL = [0.8 * Math.sin(ph), 0, 0.15]; p.shR = [-0.8 * Math.sin(ph), 0, -0.15]; p.elL = p.elR = [-1.1, 0, 0];
    if (J.swR) p.swR = [Math.PI / 2 - 0.4, 0, 0];
    return p;
  },
  windup(u, J) {
    const p = THUG_POSES.idle(0, J);
    if (J.swR) { p.shR = [-2.9, 0, -0.3]; p.elR = [-0.7, 0, 0]; p.torso = [-0.2, -0.4, 0]; p.swR = [Math.PI / 2 - 0.2, 0, 0]; }
    else { p.torso = [0.05, -0.75, 0]; p.shR = [-0.2, 0, -0.3]; p.elR = [-2.2, 0, 0]; p.hips = [0, -0.4, 0]; }
    p.lgL = [-0.5, 0, 0.12]; p.knL = [0.5, 0, 0]; return p;
  },
  attack(u, J) {
    const p = THUG_POSES.idle(0, J); const a = ease(clamp(u / 0.35, 0, 1));
    if (J.swR) { p.shR = [lerp(-2.9, -0.5, a), 0, -0.1]; p.elR = [lerp(-0.7, 0, a), 0, 0]; p.torso = [lerp(-0.2, 0.5, a), 0.2, 0]; p.swR = [Math.PI / 2 - 0.2, 0, 0]; }
    else { p.torso = [0.15, lerp(-0.75, 0.6, a), 0]; p.shR = [lerp(-0.2, -1.6, a), 0, 0.1]; p.elR = [lerp(-2.2, -0.05, a), 0, 0]; p.hips = [0, 0.3, 0]; }
    p.lgL = [-0.75, 0, 0.12]; p.knL = [0.6, 0, 0]; p.lgR = [0.4, 0, -0.1]; return p;
  },
  hurt(u, J) {
    const p = blank(); legsStance(p, 0.14, 0.45); const k = 1 - u;
    p.torso = [-0.55 * k, 0.3 * k, 0]; p.neck = [-0.6 * k, 0, 0]; p.shL = [-0.6, 0, 0.8]; p.shR = [-0.6, 0, -0.8]; p.elL = p.elR = [-0.9, 0, 0]; return p;
  },
  down(u, ground) {
    const p = HERO_POSES.down(u, ground); p.ty = ground ? 0.2 : 0.5; return p;
  },
  getup(u, J) { const p = THUG_POSES.idle(0, J); legsStance(p, 0.2, 1.2 * (1 - u)); p.torso = [0.9 * (1 - u), 0, 0]; return p; },
};
// apply a pose to a rig, damped (rate r); tilt angles are applied raw when `snapTilt`
function applyPose(J, p, r, dt, snapTilt) {
  for (const j of JOINTS) {
    const g = J[j]; if (!g) continue; const t = p[j];
    if (j === 'tilt' && snapTilt) { g.rotation.set(t[0], t[1], t[2]); continue; }
    if (j === 'tilt') { g.rotation.x = wrapA(g.rotation.x); g.rotation.y = wrapA(g.rotation.y); }
    g.rotation.x = damp(g.rotation.x, t[0], r, dt); g.rotation.y = damp(g.rotation.y, t[1], r, dt); g.rotation.z = damp(g.rotation.z, t[2], r, dt);
  }
  J.hips.position.y = damp(J.hips.position.y, J.d.hip + p.y, r, dt);
  J.tilt.position.y = damp(J.tilt.position.y, p.ty, r, dt);
}

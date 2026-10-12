// boss_admiral_redclaw.js — Toad City Baltimore, Task D boss 7 of 17 (batch 2, O6): Admiral Redclaw, Fort McHenry.
// tcr2 o6 redclaw-rocket
// A cooked-orange crab admiral of 1812 in a crimson tailcoat: big black bicorne (reads from the far deck), one giant pincer,
// one brass rocket-cannon for an arm. Original character; no real person, flag, regiment or insignia.
// Contract: TASK_D_bosses.md (META, ATTACKS, buildAdmiralRedclaw, POSES, animateBoss) + O6 brief + J-003 answers:
//   J.setAngry(0..1)  tints the shell toward steamed red (deeper red for Redclaw); attack windups add the same tint in animateBoss.
//   Fort McHenry set piece: window.boss_admiral_redclaw.buildAdmiralRedclaw / globalThis.buildAdmiralRedclaw, callable with the game's
//   partial deps { THREE, toonMat, outlineMat, scale } (see kitFrom below). The game rescales him to 2.6 m there.

export const META = { id: 'admiral_redclaw', name: 'Admiral Redclaw', district: 'fort', hp: 130, scale: 1.25, radius: 1.0, height: 3.1 };
// times are fractions of dur; `strike` names the joint that lands the hit (measured: its speed peaks inside `active`)
export const ATTACKS = [
  { id: 'rocket_barrage', pose: 'atk1', dur: 1.4, windup: 0.4, active: [0.42, 0.74], reach: 14, arc: 30, dmg: 12, fx: 'rocket_volley', strike: 'haR' },
  { id: 'claw_sweep', pose: 'atk2', dur: 0.9, windup: 0.32, active: [0.36, 0.58], reach: 2.6, arc: 170, dmg: 11, fx: 'sweep', strike: 'haL' },
  { id: 'broadside_slam', pose: 'atk3', dur: 1.3, windup: 0.5, active: [0.55, 0.7], reach: 3.2, arc: 360, dmg: 16, move: 2.5, fx: 'ground_slam', strike: 'haR' },
];

// ---------------- kit access ----------------
// Normal path: the game / viewer passes the kit object K (everything comes through it, hard rule 2).
// Hook path: the Fort McHenry set piece passes partial deps ({ THREE, toonMat, outlineMat, ... }). kitFrom() completes them with
// helpers copied line for line from kit/toadcity_kit.js (G, part, grp, skeleton, addOdir, bakeColor, blank, legsStance, runLegs,
// applyPose) so the same build runs there. Materials still come only from the supplied toonMat / outlineMat (basicMat falls back to
// THREE.MeshBasicMaterial, which is exactly what the kit's basicMat returns).
function kitFrom(o) {
  if (o && o.part && o.skeleton && o.G && o.blank && o.applyPose && o.basicMat) return o;
  if (o && o.part && o.skeleton && o.G && o.blank && o.applyPose) return Object.assign({}, o, { basicMat: (x) => new o.THREE.MeshBasicMaterial(x) });
  const THREE = o.THREE, TAU = Math.PI * 2, QUAL = o.QUAL || { hd: true, outlines: [], texs: [] };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, ease = (t) => t * t * (3 - 2 * t);
  const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const addOdir = o.addOdir || ((g) => {
    const p = g.attributes.position, n = g.attributes.normal, map = new Map(), keys = [];
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3);
      keys.push(k); let e = map.get(k); if (!e) map.set(k, (e = []));
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      if (!e.some((q) => q[0] * nx + q[1] * ny + q[2] * nz > 0.985)) e.push([nx, ny, nz]);
    }
    const res = new Map();
    for (const [k, e] of map) {
      let x = 0, y = 0, z = 0; for (const q of e) { x += q[0]; y += q[1]; z += q[2]; }
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      let mn = 1; for (const q of e) mn = Math.min(mn, q[0] * x + q[1] * y + q[2] * z);
      const s = 1 / Math.max(mn, 0.35); res.set(k, [x * s, y * s, z * s]);
    }
    const od = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const d = res.get(keys[i]); od[i * 3] = d[0]; od[i * 3 + 1] = d[1]; od[i * 3 + 2] = d[2]; }
    g.setAttribute('odir', new THREE.BufferAttribute(od, 3)); return g;
  });
  const bakeColor = o.bakeColor || ((g, col) => {
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  });
  const OUT_CHAR = o.OUT_CHAR || o.outlineMat(0.0042);
  const G = o.G || {
    sph: (rx, ry, rz, ws = 8, hs = 6) => new THREE.SphereGeometry(1, QUAL.hd ? Math.max(ws * 2, 18) : Math.min(ws, 9), QUAL.hd ? Math.max(hs * 2, 12) : Math.min(hs, 7)).scale(rx, ry, rz),
    cap: (r, len, rs = 6) => new THREE.CapsuleGeometry(r, len, QUAL.hd ? 4 : 2, QUAL.hd ? 12 : Math.min(rs, 6)),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (rt, rb, h, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, QUAL.hd ? Math.max(s * 2, 14) : Math.min(s, 8), 1, open),
    tor: (R, r, arc = TAU) => new THREE.TorusGeometry(R, r, QUAL.hd ? 6 : 3, QUAL.hd ? 16 : 7, arc),
  };
  const part = (parent, geom, col, x = 0, y = 0, z = 0, q = {}) => {
    bakeColor(geom, col); const ol = q.outline !== false && geom.attributes.normal;
    if (ol) addOdir(geom);
    const m = new THREE.Mesh(geom, q.mat || parent.userData.mat || parent.parent?.userData.mat);
    m.position.set(x, y, z); if (q.rot) m.rotation.set(q.rot[0], q.rot[1], q.rot[2]);
    if (ol) { const h = new THREE.Mesh(geom, q.olMat || OUT_CHAR); h.castShadow = false; h.visible = QUAL.hd; m.add(h); QUAL.outlines.push(h); }
    geom.computeBoundingSphere(); m.castShadow = q.shadow !== false && geom.boundingSphere.radius > 0.1; parent.add(m);
    return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const skeleton = (d, mat) => {
    const J = {}; J.root = new THREE.Group(); J.mat = mat;
    const P = (g) => { g.userData.mat = mat; return g; };
    J.tilt = P(grp(J.root)); J.hips = P(grp(J.tilt, 0, d.hip, 0)); J.torso = P(grp(J.hips, 0, d.torsoY, 0)); J.neck = P(grp(J.torso, 0, d.neckY, 0));
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      J['lg' + k] = P(grp(J.hips, s * d.legX, 0, 0)); J['kn' + k] = P(grp(J['lg' + k], 0, -d.thigh, 0)); J['ft' + k] = P(grp(J['kn' + k], 0, -d.shin, 0));
      J['sh' + k] = P(grp(J.torso, s * d.shX, d.shY, 0)); J['el' + k] = P(grp(J['sh' + k], 0, -d.upper, 0)); J['ha' + k] = P(grp(J['el' + k], 0, -d.fore, 0));
    }
    J.d = d; return J;
  };
  const JOINTS = ['tilt', 'hips', 'torso', 'neck', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'lgL', 'lgR', 'knL', 'knR', 'ftL', 'ftR', 'swL', 'swR'];
  const blank = () => { const p = { y: 0, ty: 0 }; for (const j of JOINTS) p[j] = [0, 0, 0]; return p; };
  const legsStance = (p, wide = 0.13, bend = 0.3) => {
    p.lgL = [-bend * 0.5, 0, wide]; p.lgR = [-bend * 0.3, 0, -wide]; p.knL = [bend, 0, 0]; p.knR = [bend * 0.9, 0, 0];
    p.ftL = [-bend * 0.5, 0, -wide]; p.ftR = [-bend * 0.5, 0, wide]; p.y = -0.04 - bend * 0.08;
  };
  const runLegs = (p, ph, amp = 1) => {
    for (const [k, off] of [['L', 0], ['R', Math.PI]]) {
      const s = Math.sin(ph + off), c = Math.cos(ph + off);
      p['lg' + k] = [-0.85 * s * amp - 0.15, 0, 0]; p['kn' + k] = [0.25 + 1.25 * Math.max(0, c) * amp, 0, 0]; p['ft' + k] = [0.3 * s * amp, 0, 0];
    }
    p.y = -0.05 + 0.07 * Math.abs(Math.sin(ph)) * amp;
  };
  const applyPose = (J, p, r, dt, snapTilt) => {
    for (const j of JOINTS) {
      const g = J[j]; if (!g) continue; const t = p[j];
      if (j === 'tilt' && snapTilt) { g.rotation.set(t[0], t[1], t[2]); continue; }
      if (j === 'tilt') { g.rotation.x = wrapA(g.rotation.x); g.rotation.y = wrapA(g.rotation.y); }
      g.rotation.x = damp(g.rotation.x, t[0], r, dt); g.rotation.y = damp(g.rotation.y, t[1], r, dt); g.rotation.z = damp(g.rotation.z, t[2], r, dt);
    }
    J.hips.position.y = damp(J.hips.position.y, J.d.hip + p.y, r, dt);
    J.tilt.position.y = damp(J.tilt.position.y, p.ty, r, dt);
  };
  return { THREE, TAU, clamp, lerp, ease, damp, wrapA, QUAL, NIGHT: o.NIGHT || { value: 0 }, toonMat: o.toonMat, basicMat: o.basicMat || ((x) => new THREE.MeshBasicMaterial(x)),
    outlineMat: o.outlineMat, OUT_CHAR, addOdir, bakeColor, G, part, grp, skeleton, JOINTS, blank, legsStance, runLegs, applyPose };
}

// ---------------- the rig ----------------
const D = { hip: 0.9, torsoY: 0.06, neckY: 0.62, legX: 0.16, thigh: 0.4, shin: 0.41, shX: 0.47, shY: 0.42, upper: 0.3, fore: 0.3 };
const C = {
  shell: '#e0582a', shellAngry: '#b8100a', coat: '#9c1630', coatDk: '#6e0f22', white: '#f2eee2', gold: '#e8b830', hat: '#1c1a24',
  boot: '#191418', brass: '#c8902c', iron: '#2b2a32', ink: '#14101f', claw: '#f0d8b0',
};
const RX = (sd) => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);   // seeded LCG (hard rule 3)

export function buildAdmiralRedclaw(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  // shell sub-material: parts are baked white and the material colour IS the shell colour, so J.setAngry() can lerp it
  const shellM = K.toonMat(); shellM.userData.flash = mat.userData.flash; shellM.userData.flashC = mat.userData.flashC; shellM.color.set(C.shell);
  const SH = { mat: shellM }, W = '#ffffff';
  const r = RX(((opts.seed ?? 1) | 0) % 2147483647 || 1); r(); r();
  const lod = opts.lod === 1;

  // hips: white breeches, crimson coat skirt
  part(J.hips, G.sph(0.25, 0.17, 0.2), C.white, 0, 0.02, 0);
  part(J.hips, G.cyl(0.3, 0.33, 0.2, 9), C.coat, 0, 0.1, -0.01);
  // torso: crimson coat body, white lapels, white cross-belts with a gold plate, the crab carapace as broad shoulders
  part(J.torso, G.sph(0.33, 0.36, 0.25), C.coat, 0, 0.3, 0);
  for (const s of [-1, 1]) {
    part(J.torso, G.box(0.11, 0.42, 0.05), C.white, s * 0.1, 0.33, 0.215, { rot: [-0.1, 0, s * 0.12], outline: false, shadow: false });         // lapel
    part(J.torso, G.box(0.07, 0.62, 0.04), C.white, 0, 0.28, 0.24, { rot: [-0.12, 0, s * 0.62], outline: false, shadow: false });            // cross-belt
  }
  part(J.torso, G.box(0.1, 0.1, 0.04), C.gold, 0, 0.27, 0.27, { rot: [-0.12, 0, PI / 4], outline: false, shadow: false });                    // belt plate
  // carapace: a wide, flat shell over the back and shoulders, two side spikes (the crab read from every angle)
  part(J.torso, G.sph(0.62, 0.2, 0.36), W, 0, 0.5, -0.07, Object.assign({ rot: [0.12, 0, 0] }, SH));
  for (const s of [-1, 1]) part(J.torso, G.cyl(0.0, 0.075, 0.26, 6), W, s * 0.68, 0.5, -0.06, Object.assign({ rot: [0, 0, s * -PI / 2] }, SH));
  for (const s of [-1, 1]) {                                                                                     // gold epaulettes
    part(J.torso, G.cyl(0.13, 0.15, 0.06, 8), C.gold, s * 0.43, 0.62, -0.01);
    if (!lod) part(J.torso, G.cyl(0.155, 0.17, 0.07, 8, true), C.gold, s * 0.43, 0.56, -0.01, { outline: false, shadow: false });   // fringe
  }
  // head: small shell head with stalk eyes, a grand white mustache, and the bicorne
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.24, 0.17, 0.21), W, 0, 0.1, 0.03, SH);
  part(head, G.box(0.2, 0.05, 0.06), C.ink, 0, 0.02, 0.21, { rot: [0.2, 0, 0] });                              // mandible line
  for (const s of [-1, 1]) {
    part(head, G.sph(0.13, 0.065, 0.075), C.white, s * 0.11, 0.08, 0.2, { rot: [0, s * 0.35, s * -0.35] });   // mustache wing
    part(head, G.cap(0.035, 0.14), W, s * 0.1, 0.3, 0.12, Object.assign({ rot: [0.25, 0, s * -0.22] }, SH));   // eye stalk
    part(head, G.sph(0.065, 0.065, 0.065), C.ink, s * 0.13, 0.42, 0.15);                                         // eye
  }
  // bicorne worn athwart: wide, tall, black with gold edge and a gold cockade (oversized so it reads from the far deck)
  part(head, G.sph(0.5, 0.22, 0.11, 10, 6), C.hat, 0, 0.47, -0.04, { rot: [-0.08, 0, 0] });
  part(head, G.tor(0.47, 0.022, PI), C.gold, 0, 0.42, -0.04, { rot: [0, 0, 0] });
  part(head, G.cyl(0.08, 0.08, 0.03, 8), C.gold, 0.2, 0.52, 0.06, { rot: [PI / 2 - 0.08, 0, 0] });

  // left arm: crimson sleeve, white cuff, shell forearm, the giant pincer (lower finger on swL so poses open and close it)
  part(J.shL, G.sph(0.14, 0.14, 0.14), C.coat, 0, 0, 0);
  part(J.shL, G.cap(0.11, D.upper - 0.1), C.coat, 0, -D.upper / 2, 0);
  part(J.elL, G.cyl(0.13, 0.13, 0.08, 8), C.white, 0, -0.01, 0);
  part(J.elL, G.cap(0.1, D.fore - 0.1), W, 0, -D.fore / 2, 0, SH);
  part(J.haL, G.sph(0.2, 0.16, 0.22), W, 0, -0.1, 0, SH);                                                        // palm
  part(J.haL, G.sph(0.08, 0.27, 0.09), W, 0, -0.33, 0.07, Object.assign({ rot: [0.25, 0, 0] }, SH));           // fixed finger
  const swL = J.swL = grp(J.haL, 0, -0.16, -0.05); swL.userData.mat = mat;
  part(swL, G.sph(0.07, 0.24, 0.08), C.claw, 0, -0.17, -0.02, { rot: [-0.25, 0, 0] });                          // moving finger
  // right arm: crimson sleeve, white cuff, then the brass rocket-cannon is the forearm
  part(J.shR, G.sph(0.14, 0.14, 0.14), C.coat, 0, 0, 0);
  part(J.shR, G.cap(0.11, D.upper - 0.1), C.coat, 0, -D.upper / 2, 0);
  part(J.elR, G.cyl(0.13, 0.13, 0.08, 8), C.white, 0, -0.01, 0);
  part(J.elR, G.cyl(0.12, 0.1, D.fore + 0.06, 9), C.brass, 0, -D.fore / 2 - 0.02, 0);
  part(J.haR, G.cyl(0.13, 0.13, 0.08, 9), C.iron, 0, -0.03, 0);                                                  // muzzle ring
  part(J.haR, G.cyl(0.07, 0.07, 0.02, 8), C.ink, 0, -0.075, 0, { outline: false, shadow: false });             // bore
  part(J.haR, G.tor(0.11, 0.025), C.brass, 0, 0.06, 0, { rot: [PI / 2, 0, 0] });                                 // reinforce band

  // legs: white breeches, black riding boots; the split coat tails ride on the thighs (no animateBoss needed in `down`)
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['lg' + k], G.cap(0.12, D.thigh - 0.12), C.white, 0, -D.thigh / 2, 0);
    part(J['lg' + k], G.box(0.17, 0.5, 0.05), C.coat, s * 0.03, -0.2, -0.15, { rot: [0.08, 0, 0] });             // coat tail
    part(J['kn' + k], G.cap(0.1, D.shin - 0.14), C.boot, 0, -D.shin / 2 + 0.02, 0);
    part(J['kn' + k], G.cyl(0.13, 0.12, 0.1, 8), C.boot, 0, -0.02, 0.02);                                          // boot top
    part(J['ft' + k], G.sph(0.12, 0.085, 0.2), C.boot, 0, -0.03, 0.06);
  }
  // four walking legs out of the shell's sides (a crab, after all); extra groups under the torso, twitched in animateBoss
  J.crab = [];
  if (!lod) for (const [s, z, a] of [[1, 0.06, 0.25], [1, -0.16, -0.25], [-1, 0.06, -0.25], [-1, -0.16, 0.25]]) {
    const g = grp(J.torso, s * 0.5, 0.38, z); g.userData.mat = mat; g.rotation.set(0, a, s * -0.9);
    part(g, G.cap(0.04, 0.2), W, 0, -0.13, 0, SH);
    const t = grp(g, 0, -0.25, 0); t.userData.mat = mat; t.rotation.set(0, 0, s * 1.1);
    part(t, G.cap(0.032, 0.2), W, 0, -0.12, 0, SH);
    g.userData.base = g.rotation.z; J.crab.push(g);
  }
  // ---- angry tint (J-003 Q-e): 0 = cooked orange, 1 = steamed red. animateBoss adds the windup flush on top ----
  const base = new THREE.Color(C.shell), hot = new THREE.Color(C.shellAngry);
  J.angry = 0; J.shellMat = shellM;
  J.setAngry = (k) => { J.angry = Math.max(0, Math.min(1, +k || 0)); shellM.color.copy(base).lerp(hot, J.angry); };
  J._tint = (k) => shellM.color.copy(base).lerp(hot, Math.max(J.angry, k));
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  if (opts.scale) J.root.scale.setScalar(opts.scale);
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
const pulse = (u, c, w) => Math.max(0, 1 - Math.abs(u - c) / w);
function base(J, bend = 0.32) { const K = J.K, p = K.blank(); K.legsStance(p, 0.17, bend); return p; }
export const POSES = {
  idle(t, J) {
    const p = base(J); p.y += Math.sin(t * 2.6) * 0.025;
    p.torso = [0.06, 0.22, 0]; p.neck = [-0.04, -0.22, 0]; p.hips = [0, -0.16, 0];
    p.shL = [-0.2, 0, 0.2]; p.elL = [-0.9, 0, 0]; p.haL = [0.25, 0, 0]; p.swL = [0.3 + 0.18 * Math.sin(t * 3.1), 0, 0];
    p.shR = [-0.45, 0, -0.28]; p.elR = [-0.9, 0, 0];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (6 + sp * 0.8); K.runLegs(p, ph, cl(sp / 5, 0.4, 1));
    p.torso = [0.3, Math.sin(ph) * 0.18, 0]; p.neck = [-0.25, -Math.sin(ph) * 0.12, 0];
    p.shL = [-0.6 + 0.4 * Math.sin(ph), 0, 0.35]; p.elL = [-1.1, 0, 0]; p.swL = [0.4, 0, 0];
    p.shR = [-0.5 - 0.4 * Math.sin(ph), 0, -0.3]; p.elR = [-0.8, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = base(J, 0.45), k = 1 - u;
    p.torso = [-0.5 * k, 0.25 * k, 0]; p.neck = [-0.45 * k, 0, 0]; p.shL = [-0.7, 0, 0.95]; p.shR = [-0.6, 0, -0.95];
    p.elL = [-0.8, 0, 0]; p.elR = [-0.6, 0, 0]; p.swL = [0.6, 0, 0];
    return p;
  },
  down(u, ground, J) {   // flat on the shell, claw and cannon flung overhead, legs bicycling up; ty keeps the carapace on the deck
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.06, 0, 0]; p.ty = ground ? 0.5 : 0.75;
    p.lgL = [-0.7, 0, 0.3]; p.knL = [1.0, 0, 0]; p.lgR = [-0.3, 0, -0.2]; p.knR = [0.5, 0, 0];
    p.shL = [-2.2, 0, 0.75]; p.shR = [-2.2, 0, -0.85]; p.elL = [-0.3, 0, 0]; p.elR = [-0.2, 0, 0]; p.neck = [0.35, 0, 0]; p.swL = [0.7, 0, 0];
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.06) * cl(u * 2.2), 0, 0];
    return p;
  },
  // atk1 rocket barrage: plant, swing the cannon up to a 30 degree firing line, three recoil kicks (u 0.46 / 0.56 / 0.66)
  atk1(u, J) {
    const p = base(J, 0.5), a = ez(cl(u / 0.38)), out = ez(cl((u - 0.8) / 0.2));
    const kick = pulse(u, 0.46, 0.05) + 0.8 * pulse(u, 0.56, 0.05) + 0.7 * pulse(u, 0.66, 0.05);
    p.lgL = [-0.75, 0, 0.2]; p.knL = [0.85, 0, 0]; p.lgR = [0.4, 0, -0.2]; p.knR = [0.35, 0, 0];
    p.torso = [lp(0.06, -0.12, a) - kick * 0.12, lp(0.2, -0.45, a), 0]; p.hips = [0, lp(-0.1, -0.35, a), 0]; p.neck = [0.05, lp(-0.2, 0.4, a), 0];
    p.shR = [lp(-0.45, -1.95, a) - kick * 0.55 + out * 1.0, 0, lp(-0.28, 0.12, a)]; p.elR = [lp(-0.9, -0.1, a) - kick * 0.35, 0, 0];
    p.shL = [-0.55, 0, 0.6]; p.elL = [-1.2, 0, 0]; p.swL = [0.5, 0, 0];
    return p;
  },
  // atk2 claw sweep: coil the pincer back over the left shoulder, then a flat 170 degree sweep across the front, claw snapping shut
  atk2(u, J) {
    const p = base(J, 0.5), a = ez(cl((u - 0.3) / 0.26)), w = ez(cl(u / 0.3));
    p.lgR = [-0.7, 0, -0.2]; p.knR = [0.8, 0, 0]; p.lgL = [0.35, 0, 0.2]; p.knL = [0.3, 0, 0];
    p.torso = [0.18, lp(lp(0.2, 0.95, w), -1.05, a), 0]; p.hips = [0, lp(lp(-0.1, 0.45, w), -0.5, a), 0]; p.neck = [-0.1, lp(lp(-0.2, -0.6, w), 0.7, a), 0];
    p.shL = [lp(lp(-0.7, -1.2, w), -1.45, a), 0, lp(lp(0.32, 1.35, w), -0.35, a)]; p.elL = [lp(lp(-1.05, -0.5, w), -0.12, a), 0, 0];
    p.swL = [lp(lp(0.3, 0.9, w), 0.0, a), 0, 0];
    p.shR = [-0.4, 0, -0.55]; p.elR = [-1.1, 0, 0];
    return p;
  },
  // atk3 broadside slam: crouch, hop with the cannon raised two-handed, drive it muzzle-first into the deck (shock ring)
  atk3(u, J) {
    const p = base(J, 0.4), c = ez(cl(u / 0.3)), up = ez(cl((u - 0.3) / 0.22)), sl = ez(cl((u - 0.52) / 0.12)), rec = ez(cl((u - 0.8) / 0.2));
    p.y = lp(lp(-0.072, -0.12, c), 0, up) + Math.sin(cl((u - 0.3) / 0.3) * Math.PI) * 0.35 - sl * 0.1 * (1 - rec);
    p.torso = [lp(lp(0.1, 0.3, c), -0.3, up) + sl * 0.95 - rec * 0.6, 0, 0]; p.neck = [lp(0, 0.2, up) - sl * 0.5, 0, 0];
    p.shR = [lp(lp(-0.45, -0.9, c), -2.9, up) + sl * 2.25 + rec * 0.4, 0, -0.15]; p.elR = [lp(-0.9, -0.15, up) - sl * 0.05, 0, 0];
    p.shL = [lp(lp(-0.7, -0.9, c), -2.6, up) + sl * 1.7 + rec * 0.4, 0, 0.35]; p.elL = [lp(-1.05, -0.3, up), 0, 0]; p.swL = [0.5, 0, 0];
    p.lgL = [lp(-0.5, -0.9, sl), 0, 0.22]; p.knL = [lp(0.6, 1.0, sl), 0, 0]; p.lgR = [lp(-0.3, -0.7, sl), 0, -0.22]; p.knR = [lp(0.5, 0.9, sl), 0, 0];
    return p;
  },
};

// optional: crab-leg twitch, angry windup flush (safe to skip; setAngry alone already tints)
export function animateBoss(J, t, state, u = 0) {
  for (let i = 0; i < (J.crab || []).length; i++) { const g = J.crab[i]; g.rotation.z = g.userData.base + Math.sin(t * 7 + i * 1.7) * (state === 'run' ? 0.25 : 0.08); }
  let flush = 0;
  for (const a of ATTACKS) if (state === a.pose) flush = u < a.active[0] ? cl(u / Math.max(a.active[0], 1e-3)) : cl(1 - (u - a.active[1]) / 0.2);
  if (J._tint) J._tint(flush * 0.6);
}

// Fort McHenry cannon set piece hook (J-003 Q-f): the game looks for window.boss_admiral_redclaw.buildAdmiralRedclaw or a global.
if (typeof globalThis !== 'undefined') {
  globalThis.boss_admiral_redclaw = Object.assign(globalThis.boss_admiral_redclaw || {}, { META, ATTACKS, POSES, animateBoss, buildAdmiralRedclaw });
  if (!globalThis.buildAdmiralRedclaw) globalThis.buildAdmiralRedclaw = buildAdmiralRedclaw;
}

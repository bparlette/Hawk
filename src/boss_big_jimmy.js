// boss_big_jimmy.js — Toad City Baltimore, Task D boss 8 of 17 (batch 2, O6): Big Jimmy, the National Aquarium tank.
// tcr2 o6 redclaw-rocket
// A giant Maryland blue crab, a male "jimmy": dusky blue-olive carapace with long lateral spines, azure claws with cream tips,
// a white belly with the male's narrow T-shaped apron. Fought underwater, so he hovers a hand's width off the tank floor.
// Contract: TASK_D_bosses.md + O6 brief + J-003: the 18 skeleton joints carry the body and the claws; all eight legs hang in two leg sets
// on J.lgL / J.lgR (poses fold them; animateBoss ripples them, safe to skip). J.setAngry(0..1) steams him red.
// Swim-fight hook (J-003 Q-c): buildBigJimmy({ THREE, toonMat, outlineMat, addOdir, QUAL }) returns
//   { root, body, soft, mouth, claws: [{ arm, top, bot, tip }] x2, legs: [left, right], flash: [materials], J }.

export const META = { id: 'big_jimmy', name: 'Big Jimmy', district: 'aquarium', hp: 140, scale: 1.45, radius: 1.7, height: 2.3 };
export const ATTACKS = [
  { id: 'pincer_crush', pose: 'atk1', dur: 1.1, windup: 0.4, active: [0.42, 0.6], reach: 3.0, arc: 70, dmg: 15, fx: 'claw_clamp', strike: 'haR' },
  { id: 'sideways_rush', pose: 'atk2', dur: 1.0, windup: 0.3, active: [0.34, 0.66], reach: 3.4, arc: 120, dmg: 12, move: 6, fx: 'dash', strike: 'haL' },
  { id: 'belly_slam', pose: 'atk3', dur: 1.4, windup: 0.55, active: [0.6, 0.74], reach: 3.4, arc: 360, dmg: 17, fx: 'bubble_ring', strike: 'haR' },
];

// ---------------- kit access ----------------
// Normal path: the game / viewer passes the kit object K (everything comes through it, hard rule 2).
// Hook path: the game's live modes pass partial deps ({ THREE, toonMat, outlineMat, ... }). kitFrom() completes them with
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
// legs carry nothing on the skeleton's knee/foot joints: lgL / lgR each hold one side's four legs (fold / scuttle by pose)
const D = { hip: 0.71, torsoY: 0.02, neckY: 0.24, legX: 0.4, thigh: 0.3, shin: 0.3, shX: 0.62, shY: 0.04, upper: 0.42, fore: 0.4 };
const C = { shell: '#4d7488', limb: '#2e7fd0', belly: '#f1ece0', apron: '#e2dccb', tip: '#f4efe4', ink: '#14101f', mouth: '#7a3a3a', angry: '#d0401c' };
const RX = (sd) => () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
const LEGS = [[0.2, 0.45, 0.42], [0.0, 0.15, 0.4], [-0.2, -0.15, 0.38], [-0.38, -0.5, 0]];   // [z, yaw, seg2 length (0 = swimmer paddle)]

export function buildBigJimmy(K0, opts = {}) {
  const hook = !(K0 && K0.part && K0.skeleton);
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const sub = (col) => { const m = K.toonMat(); m.userData.flash = mat.userData.flash; m.userData.flashC = mat.userData.flashC; m.color.set(col); return m; };
  const shellM = sub(C.shell), limbM = sub(C.limb), SH = { mat: shellM }, LB = { mat: limbM }, W = '#ffffff';
  const r = RX(((opts.seed ?? 1) | 0) % 2147483647 || 1); r(); r();
  const lod = opts.lod === 1;
  // body: the carapace (wide, flat, with the long lateral spines), the white belly and the male's T apron
  J.body = part(J.torso, G.sph(0.95, 0.28, 0.6, 12, 6), W, 0, 0.12, 0, SH);
  for (const s of [-1, 1]) part(J.torso, G.cyl(0.0, 0.09, 0.42, 6), W, s * 1.05, 0.12, 0.08, Object.assign({ rot: [0, 0, s * -PI / 2] }, SH));   // lateral spine
  if (!lod) for (const [x, z] of [[0.28, 0.5], [0.55, 0.36], [-0.28, 0.5], [-0.55, 0.36]]) part(J.torso, G.cyl(0.0, 0.05, 0.14, 5), W, x, 0.12, z, Object.assign({ rot: [PI / 2, 0, -x * 0.6] }, SH));   // front teeth
  J.soft = part(J.torso, G.sph(0.82, 0.16, 0.52, 12, 6), C.belly, 0, -0.03, 0);
  part(J.torso, G.box(0.16, 0.03, 0.55), C.apron, 0, -0.17, -0.02, { outline: false, shadow: false });             // apron stem
  part(J.torso, G.box(0.42, 0.03, 0.12), C.apron, 0, -0.165, -0.28, { outline: false, shadow: false });            // apron bar (the T)
  // face: stalk eyes, mouthparts under the front rim
  const head = J.head = grp(J.neck, 0, -0.1, 0.5); head.userData.mat = mat;
  for (const s of [-1, 1]) {
    part(head, G.cap(0.035, 0.14), W, s * 0.13, 0.1, 0.02, Object.assign({ rot: [0.2, 0, s * -0.25] }, LB));
    part(head, G.sph(0.07, 0.07, 0.07), C.ink, s * 0.16, 0.22, 0.05);
  }
  J.mouth = part(head, G.box(0.26, 0.1, 0.06), C.mouth, 0, -0.06, 0.02, { rot: [0.3, 0, 0] });
  // claws: azure arms, the big pincer palm, a fixed top finger and a moving lower finger (on sw, opened/closed by the poses)
  J.shL.position.z = J.shR.position.z = 0.36;
  J.tips = [];
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['sh' + k], G.cap(0.1, D.upper - 0.1), W, 0, -D.upper / 2, 0, LB);
    part(J['el' + k], G.cap(0.12, D.fore - 0.12), W, 0, -D.fore / 2, 0, LB);
    if (!lod) part(J['el' + k], G.cyl(0.0, 0.05, 0.16, 5), W, s * 0.11, -0.12, 0, Object.assign({ rot: [0, 0, s * -1.3] }, LB));   // forearm spine
    const palm = part(J['ha' + k], G.sph(0.2, 0.3, 0.17), W, 0, -0.22, 0, LB);
    const top = part(J['ha' + k], G.sph(0.075, 0.3, 0.085), C.tip, s * 0.07, -0.6, 0, { rot: [0, 0, s * 0.12] });
    const sw = J['sw' + k] = grp(J['ha' + k], -s * 0.07, -0.42, 0); sw.userData.mat = mat;
    part(sw, G.sph(0.065, 0.26, 0.075), C.tip, 0, -0.2, 0, { rot: [0, 0, -s * 0.1] });
    const tip = grp(J['ha' + k], 0, -0.86, 0); J.tips.push({ arm: J['sh' + k], top, bot: sw, tip, palm });
  }
  // legs: four per side on the hip joints; three walking legs and the flat swimmer paddle at the back
  J.legSet = { L: [], R: [] };
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    for (const [z, yaw, l2] of LEGS) {
      const g = grp(J['lg' + k], s * 0.1, 0, z); g.userData.mat = mat; g.rotation.set(0, s * yaw, s * 0.95);
      part(g, G.cap(0.05, 0.3), W, 0, -0.2, 0, LB);
      const kn = grp(g, 0, -0.4, 0); kn.userData.mat = mat; kn.rotation.z = s * -1.35;
      if (l2) part(kn, G.cap(0.042, l2 - 0.08), W, 0, -l2 / 2 + 0.02, 0, LB);
      else { part(kn, G.cap(0.04, 0.12), W, 0, -0.1, 0, LB); part(kn, G.sph(0.13, 0.16, 0.03), C.tip, 0, -0.3, 0, { rot: [0, s * 0.4, 0] }); }   // swimmer paddle
      g.userData.base = [g.rotation.x, g.rotation.y, g.rotation.z]; kn.userData.base = kn.rotation.z;
      J.legSet[k].push({ g, kn, s });
    }
  }
  // ---- angry: steamed red (shell and limbs) ----
  const b1 = new THREE.Color(C.shell), b2 = new THREE.Color(C.limb), hot = new THREE.Color(C.angry);
  J.angry = 0;
  const grey = new THREE.Color();   // blue -> red would pass through purple: dull the middle of the blend toward its own grey (a cooking brown)
  const steam = (m, b, a) => { m.color.copy(b).lerp(hot, a); const l = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11; grey.setRGB(l * 1.05, l * 0.92, l * 0.78); m.color.lerp(grey, Math.sin(Math.PI * a) * 0.4); };
  J._tint = (k) => { const a = Math.max(J.angry, k); steam(shellM, b1, a); steam(limbM, b2, a); };
  J.setAngry = (k) => { J.angry = Math.max(0, Math.min(1, +k || 0)); J._tint(0); };
  J.flashMats = [mat, shellM, limbM];
  J.gapPairs = [['shL', 'elL'], ['shR', 'elR']];
  J.kind = 'boss'; J.meta = META;
  if (hook) K.applyPose(J, POSES.idle(0, J), 1e4, 1, true);   // the swim mode gets him in his idle stance (claws up), not the T-pose
  if (hook) return { root: J.root, body: J.body, soft: J.soft, mouth: J.mouth, claws: J.tips.map(({ arm, top, bot, tip }) => ({ arm, top, bot, tip })), legs: [J.lgL, J.lgR], flash: J.flashMats, J };
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
// claw states [shoulder raise, outward swing, elbow fold inward, wrist pitch]; mixed with lp and applied mirrored per side
const CS = { idle: [-1.6, 0.85, 1.85, -0.9], tuck: [-1.25, 0.8, 2.05, -1.1], wide: [-1.9, 1.55, 0.7, -0.5], reach: [-1.8, 0.85, 1.4, 0.2],
  high: [-2.45, 1.0, 1.3, -0.8], slam: [-1.35, 1.15, 1.0, 0.35], across: [-1.7, 0.25, 1.35, 0.0], wave: [-1.4, 0.85, 1.75, -0.8] };
const mix = (a, b, t) => a.map((v, i) => lp(v, b[i], t));
function claws(p, s, st, o) {   // o: pincer opening 0 shut .. 1 wide
  const k = s > 0 ? 'L' : 'R';
  p['sh' + k] = [st[0], 0, s * st[1]]; p['el' + k] = [0, 0, -s * st[2]]; p['ha' + k] = [st[3], 0, 0]; p['sw' + k] = [0, 0, -s * (0.05 + 0.55 * o)];
}
export const POSES = {
  idle(t, J) {
    const p = J.K.blank(); p.y = Math.sin(t * 1.8) * 0.02;
    p.torso = [0, Math.sin(t * 0.9) * 0.1, Math.sin(t * 1.8) * 0.03]; p.neck = [0, -Math.sin(t * 0.9) * 0.1, 0];
    claws(p, 1, CS.idle, 0.4 + 0.3 * Math.sin(t * 2.3)); claws(p, -1, CS.idle, 0.4 + 0.3 * Math.sin(t * 2.3 + 1));
    return p;
  },
  run(t, sp, J) {   // a crab scuttles crabwise: the whole body yaws side-on, leg sets rock, claws tucked
    const p = J.K.blank(), ph = t * (8 + sp); p.y = 0.03 + 0.025 * Math.abs(Math.sin(ph));
    p.tilt = [0, 0.75, 0]; p.torso = [0, 0, Math.sin(ph) * 0.05];
    claws(p, 1, CS.tuck, 0.15); claws(p, -1, CS.tuck, 0.15);
    p.lgL = [0.18 * Math.sin(ph), 0, 0.1 * Math.cos(ph)]; p.lgR = [-0.18 * Math.sin(ph), 0, -0.1 * Math.cos(ph)];
    return p;
  },
  hurt(u, J) {
    const p = J.K.blank(), k = 1 - u; p.tilt = [-0.3 * k, 0, 0]; p.ty = 0.3 * k; p.y = 0.02;
    claws(p, 1, mix(CS.idle, CS.wide, k), 1); claws(p, -1, mix(CS.idle, CS.wide, k), 1); p.neck = [-0.3 * k, 0, 0];
    p.lgL = [0, 0, -0.35 * k]; p.lgR = [0, 0, 0.35 * k];
    return p;
  },
  down(u, ground, J) {   // flipped onto his back (rolled over the tail), legs folded up and pedalling, claws waving
    const p = J.K.blank(); const fl = -2.62;
    p.tilt = [ground ? fl : fl * cl(u * 2.4), 0, 0]; p.ty = ground ? 1.35 : 1.4;
    claws(p, 1, CS.wave, 0.8); claws(p, -1, CS.wave, 0.8);
    p.lgL = [0, 0, -0.75]; p.lgR = [0, 0, 0.75]; p.neck = [0.3, 0, 0];
    return p;
  },
  // atk1 pincer crush: both claws swing wide and open, then clamp together in front at full reach
  atk1(u, J) {
    const p = J.K.blank(), w = ez(cl(u / 0.4)), c = ez(cl((u - 0.42) / 0.1)), back = ez(cl((u - 0.75) / 0.25));
    p.tilt = [lp(0, -0.12, w) + c * 0.2 - back * 0.2, 0, 0]; p.ty = lp(0, 0.08, w) - c * 0.06 + back * 0.06; p.y = 0.03;
    const st = mix(mix(mix(CS.idle, CS.wide, w), CS.reach, c), CS.idle, back);
    claws(p, 1, st, lp(lp(0.4, 1, w), 0.05, c)); claws(p, -1, st, lp(lp(0.4, 1, w), 0.05, c));
    p.lgL = [0, 0, -0.12 * w]; p.lgR = [0, 0, 0.12 * w];
    return p;
  },
  // atk2 sideways rush: turns half side-on and charges crabwise, the leading (left) claw sweeping wide across the front
  atk2(u, J) {
    const p = J.K.blank(), turn = ez(cl(u / 0.3)), sw = ez(cl((u - 0.36) / 0.16)), back = ez(cl((u - 0.78) / 0.22));
    p.tilt = [0, lp(0, 0.7, turn) - back * 0.7, 0]; p.y = 0.03 + Math.abs(Math.sin(u * 30)) * 0.03 * (1 - back);
    claws(p, 1, mix(mix(mix(CS.idle, CS.wide, turn), CS.across, sw), CS.idle, back), lp(lp(0.4, 1, turn), 0.1, sw));
    claws(p, -1, mix(CS.idle, CS.tuck, turn * (1 - back)), 0.2);
    p.lgL = [0.2 * Math.sin(u * 28), 0, 0]; p.lgR = [-0.2 * Math.sin(u * 28), 0, 0];
    return p;
  },
  // atk3 belly slam: rears up on the back legs showing the soft belly, claws high, then drops his whole body flat (shock ring)
  atk3(u, J) {
    const p = J.K.blank(), rear = ez(cl(u / 0.45)), drop = ez(cl((u - 0.58) / 0.1)), rec = ez(cl((u - 0.82) / 0.18));
    p.tilt = [lp(0, -0.95, rear) * (1 - drop) + drop * 0.05 * (1 - rec), 0, 0]; p.ty = lp(0, 0.42, rear) * (1 - drop); p.y = lp(0.02, 0.06, rear) * (1 - drop) - drop * 0.02 * (1 - rec);
    const st = mix(mix(mix(CS.idle, CS.high, rear), CS.slam, drop), CS.idle, rec);
    claws(p, 1, st, lp(0.5, 1, rear) - drop * 0.6); claws(p, -1, st, lp(0.5, 1, rear) - drop * 0.6);
    p.lgL = [0, 0, lp(0, -0.25, rear) * (1 - drop) + drop * 0.28 * (1 - rec)]; p.lgR = [0, 0, lp(0, 0.25, rear) * (1 - drop) - drop * 0.28 * (1 - rec)];
    return p;
  },
};

// optional: per-leg ripple (walk / pedal), angry windup flush. Safe to skip: the leg sets still fold with the poses.
export function animateBoss(J, t, state, u = 0) {
  const sp = state === 'run' || state === 'atk2' ? 14 : state === 'down' ? 9 : 2.2, amp = state === 'run' || state === 'atk2' ? 0.22 : state === 'down' ? 0.35 : 0.05;
  for (const k of ['L', 'R']) (J.legSet?.[k] || []).forEach(({ g, kn, s }, i) => {
    const ph = t * sp + i * 1.6 + (k === 'R' ? Math.PI : 0), b = g.userData.base;
    g.rotation.set(b[0] + Math.sin(ph) * amp * 0.6, b[1], b[2] + Math.max(0, Math.sin(ph)) * amp * s);
    kn.rotation.z = kn.userData.base - Math.max(0, Math.sin(ph)) * amp * s * 0.5;
  });
  let flush = 0;
  for (const a of ATTACKS) if (state === a.pose) flush = u < a.active[0] ? cl(u / Math.max(a.active[0], 1e-3)) : cl(1 - (u - a.active[1]) / 0.2);
  if (J._tint) J._tint(flush * 0.35);
}

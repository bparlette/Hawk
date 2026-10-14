// boss_pit_beef_pete.js — Toad City Baltimore, O8 new content: Pit Beef Pete, Lexington Market (`lexington`).
// tcr2 o8 pit_beef_pete
// A huge pink hog, the market's pit-beef champion: white butcher's coat, a long apron with sauce spots, a folded paper cap, a fork in
// his fist and a curly tail, sitting on a sturdy stool for the eating contest. Original character: no real person, stand or brand.
// Contract: the O6 boss contract (META, 3 ATTACKS, POSES idle/run/hurt/down/atk1-3, animateBoss) plus the eating-contest states in
// POSES and J.pose(name, u): eat, full (puffed), hiccup, cheat_slide. He is seated in every pose (his stool is part of the rig, under
// J.tilt). The contest table and plate: opts.table = true builds them into his rig, or buildPitBeefTable(K, opts) returns them as a
// separate group for the game to place (J-005 Q-e). J.setFull(0..1) puffs him; J.pose('full', u) does it for you.

export const META = { id: 'pit_beef_pete', name: 'Pit Beef Pete', district: 'lexington', hp: 140, scale: 1.35, radius: 0.95, height: 2.75 };
export const ATTACKS = [
  { id: 'cheat_slide', pose: 'atk1', dur: 0.9, windup: 0.36, active: [0.4, 0.62], reach: 2.6, arc: 120, dmg: 10, fx: 'food_slide', strike: 'haR' },
  { id: 'belly_bump', pose: 'atk2', dur: 1.0, windup: 0.42, active: [0.46, 0.6], reach: 2.0, arc: 80, dmg: 13, fx: 'table_shove', strike: 'torso' },
  { id: 'hiccup_blast', pose: 'atk3', dur: 1.2, windup: 0.5, active: [0.54, 0.68], reach: 3.0, arc: 360, dmg: 12, fx: 'hiccup_shockwave', strike: 'head' },
];

// ---------------- kit access ----------------
// Normal path: the game / viewer passes the kit object K (everything comes through it, hard rule 2).
// Hook path: the game's live modes pass partial deps ({ THREE, toonMat, outlineMat, ... }, or only { THREE }). kitFrom() completes
// them with helpers copied line for line from kit/toadcity_kit.js (G, part, grp, skeleton, addOdir, bakeColor, blank, legsStance,
// runLegs, applyPose, and toonMat / outlineMat / basicMat when the caller passes none) so the same build runs there.
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
  const toonMat = o.toonMat || ((opts = {}) => {   // kit/toadcity_kit.js toonMat, verbatim (only used when the caller passes none)
    const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts));
    m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC;')
        .replace('#include <opaque_fragment>', `
          { float ld = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3), lo = dot(outgoingLight, vec3(0.299, 0.587, 0.114)), r = lo / ld;
            float b = mix(0.46, 0.78, smoothstep(0.38, 0.44, r)); b = mix(b, 1.06, smoothstep(0.86, 0.92, r)); b = mix(b, r, step(1.35, r));
            outgoingLight *= b / max(r, 1e-3);
            outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.88, 0.86, 1.1), (1.0 - smoothstep(0.38, 0.44, r)) * 0.5); }
          outgoingLight = mix(outgoingLight, uFlashC, uFlash);
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'psx' + (opts.map ? 'M' : '');
    return m;
  });
  const outlineMat = o.outlineMat || ((w) => new THREE.ShaderMaterial({   // kit outlineMat, verbatim, with its own fog uniforms
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color('#14101f') }, uFogC: { value: new THREE.Color('#000') }, uFogN: { value: 100 }, uFogF: { value: 200 } },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wd = mat3(modelMatrix) * odir;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  }));
  const OUT_CHAR = o.OUT_CHAR || outlineMat(0.0042);
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
  return { THREE, TAU, clamp, lerp, ease, damp, wrapA, QUAL, NIGHT: o.NIGHT || { value: 0 }, toonMat, basicMat: o.basicMat || ((x) => new THREE.MeshBasicMaterial(x)),
    outlineMat, OUT_CHAR, addOdir, bakeColor, G, part, grp, skeleton, JOINTS, blank, legsStance, runLegs, applyPose };
}

// ---------------- the rig ----------------
// seated: the hips sit on the stool top (y 0.6); legs forward, trotters on the stool's foot ring
const D = { hip: 0.66, torsoY: 0.08, neckY: 0.66, legX: 0.18, thigh: 0.34, shin: 0.32, shX: 0.46, shY: 0.5, upper: 0.3, fore: 0.28 };
const C = { skin: '#eba0a0', skin2: '#d98484', snout: '#f2b4b0', coat: '#f4f2ec', apron: '#ece6da', sauce: '#8a3a1e', cap: '#f8f6f0', capBand: '#d23a2a',
  pants: '#3a3a48', trotter: '#7a4a4a', ink: '#14101f', steel: '#c8ccd6', wood: '#8a5a32', iron: '#3a3a42',
  cloth: '#d23a2a', cloth2: '#f4efe4', plate: '#f2f2f2', bun: '#e6b46a', beef: '#7a3a2a', onion: '#f2ecd8', cup: '#2f6fd6' };

function buildTable(K, root, mat, lod) {   // the contest table: a red-checked top on trestles, a plate with a stacked pit-beef sandwich, a cup
  const { G, part, grp } = K;
  const T = grp(root, 0, 0, 0.92); T.userData.mat = mat;
  part(T, G.box(1.7, 0.08, 0.8), C.cloth, 0, 0.82, 0);
  part(T, G.box(1.72, 0.18, 0.02), C.cloth2, 0, 0.74, 0.41, { outline: false, shadow: false });                   // cloth drop (front)
  for (const s of [-1, 1]) part(T, G.box(0.1, 0.78, 0.6), C.wood, s * 0.7, 0.39, 0);                             // trestles
  part(T, G.cyl(0.24, 0.2, 0.04, 14), C.plate, 0, 0.88, -0.05);
  part(T, G.cyl(0.14, 0.15, 0.06, 12), C.bun, 0, 0.93, -0.05);
  part(T, G.sph(0.15, 0.07, 0.14), C.beef, 0, 0.99, -0.05);
  if (!lod) part(T, G.cyl(0.13, 0.13, 0.02, 12), C.onion, 0, 1.04, -0.05, { outline: false, shadow: false });
  part(T, G.sph(0.14, 0.07, 0.14), C.bun, 0, 1.08, -0.05);
  part(T, G.cyl(0.07, 0.06, 0.18, 10), C.cup, 0.5, 0.95, 0.05);
  return T;
}
// separate contest table (J-005 Q-e): its own group, sized for Pete at META.scale unless opts.scale says otherwise
export function buildPitBeefTable(K0, opts = {}) {
  const K = kitFrom(K0), mat = K.toonMat(), root = new K.THREE.Group(); root.userData.mat = mat;
  const T = buildTable(K, root, mat, opts.lod === 1); T.position.z = 0; root.scale.setScalar(opts.scale ?? META.scale);
  return { root, table: T, mat };
}

export function buildPitBeefPete(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const lod = opts.lod === 1;
  // the stool (under J.tilt so knock-down hops and bounces carry it)
  const st = J.stool = grp(J.tilt, 0, 0, -0.04); st.userData.mat = mat;
  part(st, G.cyl(0.36, 0.34, 0.08, 14), C.wood, 0, 0.56, 0);
  part(st, G.cyl(0.07, 0.09, 0.5, 8), C.iron, 0, 0.28, 0);
  part(st, G.cyl(0.32, 0.36, 0.06, 14), C.iron, 0, 0.03, 0);
  part(st, G.tor(0.26, 0.025), C.iron, 0, 0.24, 0, { rot: [PI / 2, 0, 0], shadow: false });                        // foot ring
  // hips + legs: dark trousers, stubby trotters
  part(J.hips, G.sph(0.36, 0.2, 0.32), C.pants, 0, 0.02, 0);
  part(J.hips, G.tor(0.09, 0.025), C.skin2, 0, 0.12, -0.33, { rot: [0, PI / 2, 0], shadow: false });               // curly tail
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.14, D.thigh - 0.14), C.pants, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.12, D.shin - 0.14), C.pants, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.12, 0.1, 0.16), C.trotter, 0, -0.03, 0.05);
  }
  // torso: the big round body in a white butcher's coat; the belly (puffable) under the long apron with sauce spots
  part(J.torso, G.sph(0.5, 0.48, 0.42), C.coat, 0, 0.32, -0.02);
  const bel = J.belly = grp(J.torso, 0, 0.2, 0.16); bel.userData.mat = mat;
  part(bel, G.sph(0.42, 0.36, 0.32), C.apron, 0, 0, 0);
  if (!lod) for (const [x, y] of [[0.14, 0.08], [-0.12, -0.12]]) part(bel, G.sph(0.06, 0.05, 0.02), C.sauce, x, y, 0.31, { outline: false, shadow: false });
  part(J.torso, G.box(0.06, 0.4, 0.04), C.apron, 0, 0.62, 0.3, { rot: [0.35, 0, 0], shadow: false });           // apron neck strap
  // head: big hog head, flat snout with nostrils, floppy ears, small eyes under heavy brows, the folded paper cap
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.32, 0.3, 0.3), C.skin, 0, 0.24, 0.04);
  part(head, G.cyl(0.14, 0.15, 0.12, 14), C.snout, 0, 0.18, 0.35, { rot: [PI / 2, 0, 0] });
  for (const s of [-1, 1]) {
    part(head, G.box(0.035, 0.06, 0.02), C.ink, s * 0.05, 0.18, 0.415, { outline: false, shadow: false });       // nostril
    part(head, G.sph(0.14, 0.05, 0.12), C.skin2, s * 0.28, 0.42, 0.04, { rot: [0.3, 0, s * -0.7] });           // floppy ear
    part(head, G.sph(0.045, 0.045, 0.03), C.ink, s * 0.13, 0.34, 0.3);                                         // eye
  }
  part(head, G.box(0.36, 0.04, 0.05), C.skin2, 0, 0.4, 0.28, { rot: [0.25, 0, 0], shadow: false });              // brow
  part(head, G.box(0.42, 0.16, 0.2), C.cap, 0, 0.56, -0.02, { rot: [0, 0, 0] });                                  // paper cap
  part(head, G.box(0.43, 0.04, 0.21), C.capBand, 0, 0.5, -0.02, { outline: false, shadow: false });
  // arms: rolled white sleeves, pink forearms, trotter fists; a big fork in the right
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.16, 0.16, 0.16), C.coat, 0, 0, 0);
    part(J['sh' + k], G.cap(0.13, D.upper - 0.12), C.coat, 0, -D.upper / 2, 0);
    part(J['el' + k], G.cap(0.11, D.fore - 0.1), C.skin, 0, -D.fore / 2, 0);
    part(J['ha' + k], G.sph(0.12, 0.11, 0.12), C.trotter, 0, -0.04, 0);
  }
  const sw = J.swR = grp(J.haR, 0, -0.05, 0); sw.userData.mat = mat;
  part(sw, G.cyl(0.02, 0.025, 0.42, 6), C.steel, 0, 0.18, 0, { shadow: false });
  part(sw, G.box(0.09, 0.12, 0.02), C.steel, 0, 0.44, 0, { shadow: false });
  if (opts.table) J.table = buildTable(K, J.tilt, mat, lod);
  // ---- full (puffed): scale the belly and the cheeks ----
  J.full = 0;
  J.setFull = (k) => { J.full = Math.max(0, Math.min(1, +k || 0)); const f = J.full; bel.scale.set(1 + 0.35 * f, 1 + 0.25 * f, 1 + 0.45 * f); head.scale.setScalar(1 + 0.08 * f); };
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  J.pose = (name, u = 0, t) => {
    const P = POSES, tt = t ?? u, p = name === 'idle' ? P.idle(tt, J) : name === 'run' ? P.run(tt, 5, J) : name === 'down' ? P.down(u, true, J) : (P[name] || P.idle)(u, J);
    K.applyPose(J, p, 1e4, 1, true); animateBoss(J, tt, name, u); return J;
  };
  return J;
}

// ---------------- poses (always seated) ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
const FORK = Math.PI / 2 + 0.3;   // fork tines up out of the fist
function seat(J) {
  const p = J.K.blank();
  p.lgL = [-1.4, 0, 0.18]; p.knL = [1.25, 0, 0]; p.lgR = [-1.4, 0, -0.18]; p.knR = [1.25, 0, 0]; p.ftL = [0.15, 0, 0]; p.ftR = [0.15, 0, 0];
  p.swR = [FORK, 0, 0]; return p;
}
function arms(p, l, r) { p.shL = l[0]; p.elL = l[1]; p.shR = r[0]; p.elR = r[1]; }
export const POSES = {
  idle(t, J) {   // drumming the table, fork up, licking his chops
    const p = seat(J), b = Math.sin(t * 3);
    p.torso = [0.08, 0.1 * Math.sin(t * 0.8), 0]; p.neck = [-0.05 + 0.04 * b, 0, 0];
    arms(p, [[-0.75 - 0.15 * Math.max(0, b), 0, 0.3], [-0.9, 0, 0]], [[-0.85, 0, -0.3], [-1.3, 0, 0]]);
    return p;
  },
  run(t, sp, J) {   // he never gets up: a furious stool-scoot, bouncing, arms pumping
    const p = seat(J), ph = t * (7 + sp); p.ty = 0.05 * Math.abs(Math.sin(ph));
    p.torso = [0.2, 0.12 * Math.sin(ph), 0];
    arms(p, [[-0.6 + 0.5 * Math.sin(ph), 0, 0.3], [-1.2, 0, 0]], [[-0.6 - 0.5 * Math.sin(ph), 0, -0.3], [-1.2, 0, 0]]);
    return p;
  },
  hurt(u, J) {
    const p = seat(J), k = 1 - u;
    p.torso = [-0.45 * k, 0.2 * k, 0]; p.neck = [-0.4 * k, 0, 0];
    arms(p, [[-0.8, 0, 0.9], [-0.6, 0, 0]], [[-0.8, 0, -0.9], [-0.6, 0, 0]]);
    return p;
  },
  down(u, ground, J) {   // slumped back on the stool, out cold: head lolled back, arms dangling, fork drooping
    const p = seat(J), k = ground ? 1 : cl(u * 2.2);
    p.torso = [-0.55 * k, 0.15 * k, 0]; p.neck = [-0.6 * k, 0.3 * k, 0];
    arms(p, [[0.1, 0, 0.45 * k], [-0.2, 0, 0]], [[0.15, 0, -0.45 * k], [-0.2, 0, 0]]); p.swR = [FORK + 1.2 * k, 0, 0];
    return p;
  },
  // eat: fork down to the plate, scoop, up to the snout, chomp (u 0..1 is one bite)
  eat(u, J) {
    const p = seat(J), dn = ez(cl(u / 0.3)), up = ez(cl((u - 0.35) / 0.25)), ch = Math.sin(cl((u - 0.6) / 0.4) * Math.PI * 3) * (u > 0.6 ? 1 : 0);
    p.torso = [lp(0.1, 0.35, dn) - up * 0.2, 0, 0]; p.neck = [lp(0, 0.3, dn) - up * 0.4 + ch * 0.08, 0, 0];
    arms(p, [[-0.7, 0, 0.35], [-1.0, 0, 0]], [[lp(lp(-0.85, -0.7, dn), -1.5, up), 0, lp(-0.3, -0.05, up)], [lp(lp(-1.3, -0.6, dn), -1.9, up), 0, 0]]);
    return p;
  },
  // full: leans back, arms out, belly puffed (animateBoss / J.pose puff the belly with u)
  full(u, J) {
    const p = seat(J), k = ez(cl(u / 0.6));
    p.torso = [lp(0.08, -0.3, k), 0, 0]; p.neck = [lp(0, -0.2, k), 0, 0];
    arms(p, [[lp(-0.75, -0.3, k), 0, lp(0.3, 0.9, k)], [-0.5, 0, 0]], [[lp(-0.85, -0.3, k), 0, lp(-0.3, -0.9, k)], [-0.5, 0, 0]]);
    return p;
  },
  // hiccup: a sharp jolt up (u 0.3), cheeks puff, a trotter to the snout
  hiccup(u, J) {
    const p = seat(J), j = Math.max(0, 1 - Math.abs(u - 0.3) / 0.12);
    p.ty = 0.12 * j; p.torso = [0.05 - 0.25 * j, 0, 0]; p.neck = [-0.35 * j, 0, 0];
    arms(p, [[-1.6, 0, 0.25], [-1.9, 0, 0]], [[-0.7 + 0.3 * j, 0, -0.5], [-0.8, 0, 0]]);
    return p;
  },
  // cheat_slide (= atk1): reaches across with the left, then a fast sideways sweep that slides the food over the table
  cheat_slide(u, J) {
    const p = seat(J), r = ez(cl(u / 0.36)), sw = ez(cl((u - 0.4) / 0.14)), rec = ez(cl((u - 0.8) / 0.2));
    p.torso = [lp(0.08, 0.35, r) * (1 - rec), lp(lp(0.1, -0.6, r), 0.7, sw) * (1 - rec), 0]; p.neck = [0, lp(0.4 * r, -0.5, sw) * (1 - rec), 0];
    arms(p, [[-0.6, 0, 0.5], [-1.2, 0, 0]], [[lp(-0.85, -1.4, r), 0, lp(lp(-0.3, -1.1, r), 0.5, sw) * (1 - rec * 0.8)], [lp(-1.3, -0.2, r), 0, 0]]);
    return p;
  },
};
POSES.atk1 = (u, J) => POSES.cheat_slide(u, J);
// atk2 belly bump: rocks back on the stool, then throws the whole belly forward into the table (the shove)
POSES.atk2 = (u, J) => {
  const p = seat(J), b = ez(cl(u / 0.4)), f = ez(cl((u - 0.44) / 0.1)), rec = ez(cl((u - 0.78) / 0.22));
  p.torso = [lp(lp(0.08, -0.35, b), 0.55, f) - rec * 0.4, 0, 0]; p.neck = [lp(-0.2 * b, 0.3, f) * (1 - rec), 0, 0]; p.ty = 0.06 * f * (1 - rec);
  arms(p, [[lp(-0.7, -0.2, b), 0, lp(0.3, 1.0, b)], [-0.5, 0, 0]], [[lp(-0.85, -0.2, b), 0, lp(-0.3, -1.0, b)], [-0.5, 0, 0]]);
  return p;
};
// atk3 hiccup blast: swells up for three beats of breath, then one enormous hiccup that jolts him off the stool (shockwave)
POSES.atk3 = (u, J) => {
  const p = seat(J), s = ez(cl(u / 0.5)), h = Math.max(0, 1 - Math.abs(u - 0.6) / 0.08), rec = ez(cl((u - 0.75) / 0.25));
  p.ty = 0.22 * h; p.torso = [lp(0.08, -0.25, s) * (1 - rec) + 0.35 * h, 0, 0]; p.neck = [lp(0, -0.3, s) * (1 - rec) - 0.5 * h, 0, 0];
  arms(p, [[lp(-0.75, -0.4, s), 0, lp(0.3, 0.8, s)], [-0.6, 0, 0]], [[lp(-0.85, -0.4, s), 0, lp(-0.3, -0.8, s)], [-0.6, 0, 0]]);
  return p;
};

// puffs the belly in `full` and while he swells for the hiccup blast; safe to skip (J.setFull still works on its own)
export function animateBoss(J, t, state, u = 0) {
  if (!J.setFull) return;
  if (state === 'full') J.setFull(ez(cl(u / 0.6)));
  else if (state === 'atk3') J.setFull(ez(cl(u / 0.5)) * (1 - ez(cl((u - 0.62) / 0.2))) * 0.7);
  else if (state === 'hiccup') J.setFull(Math.max(0, 1 - Math.abs(u - 0.3) / 0.2) * 0.3);
  else if (J.full && state !== 'down') J.setFull(J.full * 0.9);
}

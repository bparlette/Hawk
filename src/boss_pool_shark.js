// boss_pool_shark.js — Toad City Baltimore, Task D boss 12 of 17 (batch 2, O6): The Pool Shark, the Pendry pier pool deck.
// tcr2 o6 redclaw-rocket
// A big grey-blue shark hustler: shades, a straw porkpie, an open palm-print cabana shirt over a white belly, coral swim trunks,
// flip-flops, a gold chain and a long pool cue. Dorsal fin up his back, tail fin at the small of it. Original character: no real
// person, brand or logo (the shirt print is drawn on canvas).
// Contract: TASK_D_bosses.md + O6 brief. The cue rides on J.swR (the weapon group). The shirt print is the one mapped sub-material;
// its canvas is cached per kit (key K.QUAL || K.THREE || K) and only after a successful draw (lesson A4).

export const META = { id: 'pool_shark', name: 'The Pool Shark', district: 'pendry', hp: 125, scale: 1.2, radius: 0.85, height: 2.7 };
export const ATTACKS = [
  { id: 'break_shot', pose: 'atk1', dur: 0.9, windup: 0.42, active: [0.44, 0.6], reach: 2.8, arc: 20, dmg: 13, move: 1.5, fx: 'cue_jab', strike: 'haR' },
  { id: 'cue_sweep', pose: 'atk2', dur: 0.95, windup: 0.36, active: [0.4, 0.62], reach: 2.6, arc: 180, dmg: 12, fx: 'sweep', strike: 'haR' },
  { id: 'belly_flop', pose: 'atk3', dur: 1.5, windup: 0.5, active: [0.56, 0.72], reach: 3.6, arc: 360, dmg: 18, move: 3, fx: 'splash_ring', strike: 'torso' },
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

// ---------------- the cabana-shirt print (canvas, cached per kit, never cached on a failed draw) ----------------
const PRINT = new Map();
function shirtTexture(K) {
  const key = K.QUAL || K.THREE || K; if (PRINT.has(key)) return PRINT.get(key);
  if (typeof document === 'undefined' || !document.createElement) return null;
  let tex = null;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); if (!g) return null;
    g.fillStyle = '#1fa89a'; g.fillRect(0, 0, 128, 128);
    let sd = 23; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {   // palm fronds
      const x = r() * 128, y = r() * 128, a = r() * Math.PI * 2; g.strokeStyle = '#f4f0dc'; g.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const b = a + (k - 2) * 0.45; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * 10, y + Math.sin(b) * 10 - 4, x + Math.cos(b) * 18, y + Math.sin(b) * 18); g.stroke(); }
    }
    for (let i = 0; i < 7; i++) { const x = r() * 128, y = r() * 128; g.fillStyle = '#ff7a5a'; for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(b) * 4, y + Math.sin(b) * 4, 3.4, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
    tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
    if (!K.lowTex) tex.colorSpace = K.THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = K.THREE.RepeatWrapping; tex.repeat.set(2, 2);
  } catch (e) { return null; }
  if (tex) PRINT.set(key, tex);
  return tex;
}

// ---------------- the rig ----------------
const D = { hip: 0.92, torsoY: 0.06, neckY: 0.62, legX: 0.14, thigh: 0.42, shin: 0.41, shX: 0.36, shY: 0.48, upper: 0.3, fore: 0.28 };
const C = { skin: '#6f8ea6', belly: '#f2f0ea', trunks: '#ff6a5a', shades: '#141218', straw: '#e8cf8a', band: '#1f3a6a', gold: '#e8c040',
  cue: '#e6c48a', cueButt: '#3a2214', chalk: '#3f7fd6', sole: '#2a9ad0', ink: '#14101f', teeth: '#ffffff', shirt: '#1fa89a' };

export function buildPoolShark(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const tex = shirtTexture(K);
  const shirtM = tex ? (() => { const m = K.toonMat({ map: tex }); m.userData.flash = mat.userData.flash; m.userData.flashC = mat.userData.flashC; m.customProgramCacheKey = () => 'psxShirt'; return m; })() : null;
  const SHIRT = (o = {}) => (shirtM ? Object.assign({ mat: shirtM }, o) : o), SC = shirtM ? '#ffffff' : C.shirt;
  const lod = opts.lod === 1;
  // hips / legs: coral trunks, grey shark legs, flip-flops
  part(J.hips, G.sph(0.25, 0.17, 0.2), C.trunks, 0, 0.0, 0);
  part(J.hips, G.cyl(0.02, 0.16, 0.34, 6), C.skin, 0, 0.1, -0.2, { rot: [-0.55, 0, 0] });                       // tail fin, flat at the small of the back
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.11, D.thigh - 0.12), C.trunks, 0, -D.thigh / 2 + 0.04, 0);
    part(J['kn' + k], G.cap(0.09, D.shin - 0.14), C.skin, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.1, 0.07, 0.17), C.skin, 0, -0.03, 0.06);
    part(J['ft' + k], G.box(0.2, 0.03, 0.34), C.sole, 0, -0.085, 0.06, { outline: false, shadow: false });
  }
  // torso: open cabana shirt over the white belly, collar points, a gold chain, the dorsal fin
  part(J.torso, G.sph(0.35, 0.36, 0.27), SC, 0, 0.29, -0.02, SHIRT());
  part(J.torso, G.sph(0.22, 0.31, 0.12), C.belly, 0, 0.27, 0.17);
  for (const s of [-1, 1]) part(J.torso, G.box(0.14, 0.04, 0.12), SC, s * 0.13, 0.6, 0.15, SHIRT({ rot: [0.4, 0, s * -0.5] }));
  part(J.torso, G.tor(0.15, 0.016), C.gold, 0, 0.55, 0.08, { rot: [PI / 2 - 0.6, 0, 0], shadow: false });
  part(J.torso, G.cyl(0.0, 0.2, 0.38, 6), C.skin, 0, 0.62, -0.26, { rot: [-0.45, 0, 0] });                       // dorsal fin
  // head: big shark head, long snout, white underjaw, toothy grin, gills, shades, straw porkpie
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.25, 0.24, 0.3), C.skin, 0, 0.2, 0.03);
  part(head, G.sph(0.19, 0.15, 0.22), C.skin, 0, 0.21, 0.24);                                                    // snout
  part(head, G.sph(0.2, 0.1, 0.28), C.belly, 0, 0.07, 0.13);                                                     // underjaw
  part(head, G.box(0.3, 0.06, 0.05), C.ink, 0, 0.12, 0.33, { rot: [0.3, 0, 0], outline: false, shadow: false });  // grin
  part(head, G.box(0.27, 0.035, 0.03), C.teeth, 0, 0.135, 0.345, { rot: [0.3, 0, 0], outline: false, shadow: false });   // teeth
  for (const s of [-1, 1]) {
    part(head, G.box(0.11, 0.07, 0.04), C.shades, s * 0.11, 0.29, 0.34, { rot: [0.15, s * 0.25, 0] });          // shade lens
    if (!lod) part(head, G.box(0.02, 0.09, 0.04), C.ink, s * 0.24, 0.13, 0.08, { rot: [0, s * 0.3, 0], outline: false, shadow: false });   // gills
  }
  part(head, G.box(0.1, 0.03, 0.03), C.shades, 0, 0.3, 0.37, { outline: false, shadow: false });                 // bridge
  part(head, G.cyl(0.36, 0.36, 0.03, 14), C.straw, 0, 0.42, -0.02);                                              // porkpie brim
  part(head, G.cyl(0.2, 0.22, 0.14, 12), C.straw, 0, 0.5, -0.02);                                                // crown
  part(head, G.cyl(0.225, 0.225, 0.05, 12), C.band, 0, 0.46, -0.02, { shadow: false });                         // band
  // arms: short print sleeves, grey shark forearms and hands
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.13, 0.13, 0.13), SC, 0, 0, 0, SHIRT());
    part(J['sh' + k], G.cap(0.11, D.upper - 0.12), SC, 0, -D.upper / 2 + 0.03, 0, SHIRT());
    part(J['el' + k], G.cap(0.085, D.fore - 0.08), C.skin, 0, -D.fore / 2, 0);
    part(J['ha' + k], G.sph(0.1, 0.09, 0.1), C.skin, 0, -0.03, 0);
  }
  // the pool cue: blade axis +y out of the right fist (like the hero's cane); thin, so no shadow (hard rule 9)
  const sw = J.swR = grp(J.haR, 0, -0.04, 0); sw.userData.mat = mat;
  part(sw, G.cyl(0.017, 0.028, 1.45, 8), C.cue, 0, 0.42, 0, { shadow: false });
  part(sw, G.cyl(0.03, 0.03, 0.34, 8), C.cueButt, 0, -0.14, 0, { shadow: false });
  part(sw, G.cyl(0.018, 0.018, 0.03, 8), C.chalk, 0, 1.16, 0, { outline: false, shadow: false });
  J.kind = 'boss'; J.meta = META; J.gapPairs = [['torso', 'neck']];
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
export const POSES = {
  idle(t, J) {   // leaning on the cue, hip cocked, chalking it with the free hand
    const p = J.K.blank(); J.K.legsStance(p, 0.15, 0.25); const b = Math.sin(t * 2.2); p.y += 0.015 * b;
    p.hips = [0, -0.15, 0.06]; p.torso = [0.04, 0.25, -0.05]; p.neck = [-0.05, -0.3, 0.05 * b];
    p.shR = [-0.25, 0, -0.42]; p.elR = [-0.6, 0, 0]; p.swR = [Math.PI - 0.15, 0, 0.2];
    p.shL = [-0.9, 0, 0.1]; p.elL = [-1.9 + 0.1 * b, 0, 0];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (6 + sp); K.runLegs(p, ph, cl(sp / 4.5, 0.4, 1));
    p.torso = [0.25, Math.sin(ph) * 0.2, 0]; p.neck = [-0.15, -Math.sin(ph) * 0.15, 0];
    p.shL = [0.7 * Math.sin(ph), 0, 0.2]; p.elL = [-1.1, 0, 0]; p.shR = [-0.4, 0, -0.2]; p.elR = [-1.0, 0, 0]; p.swR = [Math.PI / 2 - 0.5, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.15, 0.45); const k = 1 - u;
    p.torso = [-0.5 * k, 0.3 * k, 0]; p.neck = [-0.55 * k, 0, 0]; p.shL = [-0.6, 0, 0.9]; p.shR = [-0.6, 0, -0.9]; p.elL = p.elR = [-0.8, 0, 0]; p.swR = [Math.PI / 2 + 0.6, 0, 0];
    return p;
  },
  down(u, ground, J) {
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.42 : 0.62;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.3, 0, 0.7]; p.shR = [-2.1, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0]; p.swR = [0.2, 0, 0];   // cue laid back along the arm (keeps him inside the culling sphere)
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.08) * cl(u * 2.2), 0, 0];
    return p;
  },
  // atk1 break shot: bends over a bridge hand with the cue level, draws back, then one hard jab (cue tip forward at u 0.48)
  atk1(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.22, 0.5); const bend = ez(cl(u / 0.28)), draw = ez(cl((u - 0.24) / 0.18)), jab = ez(cl((u - 0.44) / 0.06)), rec = ez(cl((u - 0.8) / 0.2));
    p.torso = [lp(0.04, 0.75, bend) * (1 - rec * 0.7), lp(0.25, 0.1, bend), 0]; p.neck = [lp(0, -0.6, bend) * (1 - rec), 0, 0];
    p.shL = [lp(-0.9, -1.55, bend), 0, 0.12]; p.elL = [lp(-1.9, -0.15, bend), 0, 0];
    p.shR = [lp(-0.25, -0.7, bend) + draw * 0.55 - jab * 1.05 + rec * 0.4, 0, -0.2]; p.elR = [lp(-0.6, -1.5, bend) - draw * 0.4 + jab * 1.35, 0, 0];
    p.swR = [Math.PI - 0.1 + draw * 0.1 - jab * 0.15, 0, 0];   // cue runs forward out of the fist, over the bridge hand
    p.lgL = [-0.7, 0, 0.18]; p.knL = [0.7, 0, 0]; p.lgR = [0.3, 0, -0.18]; p.knR = [0.3, 0, 0];
    return p;
  },
  // atk2 cue sweep: cocks the cue over the right shoulder like a bat, then a flat 180 degree swing across the front
  atk2(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.22, 0.45); const c = ez(cl(u / 0.36)), s = ez(cl((u - 0.38) / 0.16)), rec = ez(cl((u - 0.82) / 0.18));
    p.torso = [0.12, lp(lp(0.25, 1.0, c), -1.0, s) * (1 - rec * 0.8), 0]; p.hips = [0, lp(lp(-0.15, 0.45, c), -0.5, s) * (1 - rec), 0]; p.neck = [0, lp(-0.6 * c, 0.7, s) * (1 - rec), 0];
    p.shR = [lp(lp(-0.25, -1.2, c), -1.45, s), 0, lp(lp(-0.42, 0.9, c), -1.1, s) * (1 - rec * 0.6)]; p.elR = [lp(lp(-0.6, -1.6, c), -0.15, s), 0, 0];
    p.swR = [lp(Math.PI - 0.15, Math.PI / 2 + 0.1, c), 0, lp(0, -0.4, s)];
    p.shL = [lp(-0.9, -1.2, c), 0, lp(0.1, -0.5, s)]; p.elL = [lp(-1.9, -1.3, c), 0, 0];
    p.lgL = [-0.6, 0, 0.2]; p.knL = [0.6, 0, 0]; p.lgR = [0.35, 0, -0.2];
    return p;
  },
  // atk3 belly flop: crouch, leap with arms spread, and slam flat on the belly (face down, head turned) for the splash ring
  atk3(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.2, 0.4); const cr = ez(cl(u / 0.28)), air = cl((u - 0.3) / 0.32), fl = ez(cl((u - 0.5) / 0.14)), rec = ez(cl((u - 0.84) / 0.16));
    p.y = -0.06 * cr * (1 - ez(cl((u - 0.28) / 0.05)));
    p.tilt = [lp(0, Math.PI / 2 - 0.12, fl) * (1 - rec), 0, 0]; p.ty = Math.sin(Math.min(air, 1) * Math.PI) * 0.75 * (1 - fl) + fl * 0.4 * (1 - rec);
    p.neck = [-0.6 * fl * (1 - rec), 0.9 * fl * (1 - rec), 0];
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) { p['sh' + k] = [lp(lp(-0.4, 0.3, cr), -1.2, ez(air)) * (1 - rec), 0, s * lp(0.3, 1.4, ez(air)) * (1 - rec * 0.7)]; p['el' + k] = [-0.3, 0, 0]; }
    p.lgL = [lp(-0.2, 0.3, fl), 0, 0.2]; p.lgR = [lp(-0.2, 0.3, fl), 0, -0.2]; p.knL = p.knR = [lp(0.4, 0.2, fl), 0, 0];
    p.swR = [lp(Math.PI / 2 + 0.3, 0.25, ez(air)), 0, 0];   // cue tucked along the arm in the air
    return p;
  },
};

// optional: the Pool Shark has no extra groups, so there is nothing to animate (the poses carry everything)
export function animateBoss() {}

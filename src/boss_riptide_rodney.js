// boss_riptide_rodney.js — Toad City Baltimore, O8 new content: Riptide Rodney, Rash Field (`rash_field`).
// tcr2 o8 riptide_rodney
// The Key Highway Otters' captain: a sleek brown otter in the gang's green jersey with brown trim (KO_C palette from
// src/gang_key_hwy_otters.js, claude/o4-key-hwy-otters), a green sweatband, eye-black, a captain's armband and an original
// lacrosse-style stick (a short shaft, an open U head with a cream mesh pocket and a ball). Original: no team, league, number or logo.
// Contract: the O6 boss contract plus the game states in POSES and J.pose(name, u): cradle, pass, shoot (= atk1), check (= atk2),
// stunned. opts.variant = 'otter_wingman' builds the lighter wingman from the same module (scale 1.0; no armband, eye-black or stick;
// VARIANTS.otter_wingman is its META). The ball hides after the shot (u > 0.5) and the pass (u > 0.45).

export const META = { id: 'riptide_rodney', name: 'Riptide Rodney', district: 'rash_field', hp: 125, scale: 1.2, radius: 0.75, height: 2.35, gang: 'key_hwy_otters' };
export const VARIANTS = { otter_wingman: { id: 'otter_wingman', name: 'Otter Wingman', district: 'rash_field', hp: 40, scale: 1.0, radius: 0.5, height: 1.85, gang: 'key_hwy_otters' } };
export const ATTACKS = [
  { id: 'riptide_shot', pose: 'atk1', dur: 1.0, windup: 0.42, active: [0.46, 0.6], reach: 16, arc: 15, dmg: 13, fx: 'lacrosse_ball', strike: 'haR' },
  { id: 'cross_check', pose: 'atk2', dur: 0.9, windup: 0.34, active: [0.38, 0.6], reach: 2.2, arc: 70, dmg: 12, move: 3, fx: 'shove', strike: 'haL' },
  { id: 'stick_sweep', pose: 'atk3', dur: 1.0, windup: 0.36, active: [0.4, 0.62], reach: 2.8, arc: 200, dmg: 12, fx: 'sweep', strike: 'haR' },
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

// ---------------- the rig (otter proportions: KO_D) ----------------
const D = { hip: 0.9, torsoY: 0.06, neckY: 0.64, legX: 0.13, thigh: 0.4, shin: 0.41, shX: 0.29, shY: 0.5, upper: 0.29, fore: 0.27 };
const C = {   // KO_C (the Otters) + captain's kit
  green: '#23c26b', stripe: '#5e3e28', fur: '#7a5236', dark: '#3e2c22', cream: '#d8c4a0', eye: '#ece6d2', pants: '#3e3a36', ink: '#14101f',
  shaft: '#c8ccd6', head: '#e6e2da', mesh: '#d8c4a0', ball: '#f2ecd8',
};

export function buildRiptideRodney(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const wing = opts.variant === 'otter_wingman', lod = opts.lod === 1;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  // hips / legs: dark joggers, bare webbed otter feet
  part(J.hips, G.sph(0.21, 0.15, 0.17), C.pants, 0, 0.02, 0);
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.092, D.thigh - 0.1), C.pants, 0, -D.thigh / 2 + 0.03, 0);
    part(J['kn' + k], G.cap(0.072, D.shin - 0.1), C.pants, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.095, 0.042, 0.17), C.dark, 0, 0.022, 0.06);
  }
  // torso: green jersey, brown collar and hem, brown side stripes
  part(J.torso, G.sph(0.26, 0.36, 0.22), C.green, 0, 0.3, 0);
  part(J.torso, G.cyl(0.14, 0.17, 0.08, 12), C.stripe, 0, 0.62, 0);
  part(J.torso, G.cyl(0.235, 0.235, 0.06, 14), C.stripe, 0, 0.02, 0, { shadow: false });
  if (!lod) for (const s of [-1, 1]) part(J.torso, G.box(0.03, 0.46, 0.12), C.stripe, s * 0.245, 0.3, 0, { rot: [0, 0, s * 0.1], outline: false, shadow: false });
  // head: the Otters' head (sleek brown, cream muzzle, dark nose, whiskers, small round ears), a green sweatband, eye-black
  const head = J.head = grp(J.neck, 0, -0.01, 0.04); head.userData.mat = mat;
  part(head, G.sph(0.17, 0.155, 0.17), C.fur, 0, 0.16, 0);
  part(head, G.sph(0.12, 0.07, 0.1), C.cream, 0, 0.1, 0.14);
  part(head, G.box(0.07, 0.04, 0.035), C.dark, 0, 0.135, 0.235, { outline: false, shadow: false });
  for (const r of [0.1, -0.1]) part(head, G.box(0.44, 0.009, 0.009), C.dark, 0, 0.1, 0.22, { rot: [0, 0, r], outline: false, shadow: false });
  for (const sd of [1, -1]) {
    part(head, G.sph(0.034, 0.036, 0.022), C.eye, sd * 0.07, 0.205, 0.145, { rot: [0, sd * 0.4, 0], outline: false, shadow: false });
    part(head, G.box(0.024, 0.03, 0.02), C.ink, sd * 0.066, 0.203, 0.163, { outline: false, shadow: false });
    part(head, G.box(0.09, 0.03, 0.03), C.ink, sd * 0.072, 0.25, 0.14, { rot: [0, sd * 0.35, sd * 0.25], outline: false, shadow: false });
    part(head, G.sph(0.048, 0.045, 0.028), C.fur, sd * 0.15, 0.25, -0.03, { rot: [0, sd * 0.5, 0] });
    if (!wing) part(head, G.box(0.06, 0.018, 0.02), C.ink, sd * 0.075, 0.17, 0.155, { rot: [0, sd * 0.4, 0], outline: false, shadow: false });   // eye-black
  }
  part(head, G.tor(0.165, 0.025), C.green, 0, 0.22, -0.01, { rot: [PI / 2 - 0.15, 0, 0], shadow: false });          // sweatband
  // arms: green sleeves, brown cuffs (painted as a ring), dark paws; the captain's armband on the left
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.11, 0.105, 0.11), C.green, 0, -0.01, 0);
    part(J['sh' + k], G.cap(0.085, D.upper - 0.06), C.green, 0, -D.upper / 2, 0);
    part(J['el' + k], G.cap(0.075, D.fore - 0.06), C.fur, 0, -D.fore / 2, 0);
    part(J['ha' + k], G.sph(0.075, 0.08, 0.075), C.dark, 0, -0.05, 0.01);
  }
  if (!wing) part(J.shL, G.cyl(0.095, 0.095, 0.06, 12), C.cream, 0, -0.14, 0, { shadow: false });                // armband
  // tail: the Otters' thick tapering tail, close behind the hips (their QA: never more than ~0.23 m behind the body)
  const T = J.tail = grp(J.hips, 0, 0.0, -0.12); T.userData.mat = mat; T.rotation.set(0.16, 0, 0.2);
  part(T, G.cyl(0.068, 0.03, 0.4), C.fur, 0, -0.19, 0);
  // the stick (captain only): shaft along +y out of the right paw, open U head, cream mesh pocket, the ball
  if (!wing) {
    const sw = J.swR = grp(J.haR, 0, -0.04, 0); sw.userData.mat = mat;
    part(sw, G.cyl(0.018, 0.02, 1.0, 7), C.shaft, 0, 0.32, 0, { shadow: false });
    part(sw, G.tor(0.11, 0.016, PI), C.head, 0, 0.86, 0, { rot: [0, 0, 0], shadow: false });
    part(sw, G.sph(0.1, 0.11, 0.03), C.mesh, 0, 0.9, -0.02, { outline: false, shadow: false });
    J.ball = part(sw, G.sph(0.045, 0.045, 0.045), C.ball, 0, 0.9, 0.0, { shadow: false });
  }
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = wing ? VARIANTS.otter_wingman : META; J.variant = wing ? 'otter_wingman' : 'captain';
  J.pose = (name, u = 0, t) => {
    const P = POSES, tt = t ?? u, p = name === 'idle' ? P.idle(tt, J) : name === 'run' ? P.run(tt, 5, J) : name === 'down' ? P.down(u, true, J) : (P[name] || P.idle)(u, J);
    K.applyPose(J, p, 1e4, 1, true); animateBoss(J, tt, name, u); return J;
  };
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
const STICK = Math.PI / 2 - 0.25;   // stick head up and forward out of the right paw
function stance(J, w = 0.16, b = 0.4) { const p = J.K.blank(); J.K.legsStance(p, w, b); p.swR = [STICK, 0, 0]; return p; }
// both paws on the shaft: right low, left high across the body
function grip(p, rx, rz, lx, lz) { p.shR = [rx, 0, rz]; p.elR = [-1.1, 0, 0]; p.shL = [lx, 0, lz]; p.elL = [-1.3, 0, 0]; }
export const POSES = {
  idle(t, J) {   // light on his feet, stick held across, head bobbing
    const p = stance(J), b = Math.sin(t * 3.2); p.y += 0.02 * b;
    p.torso = [0.15, 0.25, 0]; p.neck = [-0.05, -0.25, 0]; p.hips = [0, -0.15, 0];
    grip(p, -0.7, -0.3, -1.0, -0.35); p.swR = [STICK - 0.3, 0, 0.6 + 0.05 * b];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (7 + sp); K.runLegs(p, ph, cl(sp / 4.5, 0.4, 1)); p.swR = [STICK, 0, 0.3];
    p.torso = [0.3, Math.sin(ph) * 0.2, 0]; p.neck = [-0.2, -Math.sin(ph) * 0.15, 0];
    p.shL = [0.8 * Math.sin(ph), 0, 0.2]; p.elL = [-1.1, 0, 0]; p.shR = [-0.9, 0, -0.25]; p.elR = [-1.2, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = stance(J, 0.15, 0.45), k = 1 - u;
    p.torso = [-0.5 * k, 0.3 * k, 0]; p.neck = [-0.55 * k, 0, 0]; p.shL = [-0.6, 0, 0.9]; p.shR = [-0.6, 0, -0.9]; p.elL = p.elR = [-0.8, 0, 0]; p.swR = [STICK + 0.6, 0, 0];
    return p;
  },
  down(u, ground, J) {
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.3 : 0.55;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.3, 0, 0.7]; p.shR = [-2.1, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0]; p.swR = [0.2, 0, 0];   // stick along the arm
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.08) * cl(u * 2.2), 0, 0];
    return p;
  },
  // cradle: jogging in place, the stick head rocking beside his ear to keep the ball in the pocket (u is one rock cycle)
  cradle(u, J) {
    const p = stance(J, 0.14, 0.35), r = Math.sin(u * Math.PI * 2);
    p.torso = [0.2, 0.15 * r, 0]; p.neck = [-0.1, -0.1 * r, 0];
    grip(p, -1.2, -0.2, -1.6, -0.6 + 0.2 * r); p.elR = [-1.6, 0, 0]; p.swR = [STICK + 0.35, 0.5 * r, 0.25 * r];
    p.lgL = [-0.3 - 0.3 * Math.max(0, r), 0, 0.14]; p.knL = [0.35 + 0.4 * Math.max(0, r), 0, 0];
    return p;
  },
  // pass: a quick sidearm flick to the left (the ball leaves at u 0.45)
  pass(u, J) {
    const p = stance(J, 0.18, 0.4), c = ez(cl(u / 0.36)), f = ez(cl((u - 0.38) / 0.1)), rec = ez(cl((u - 0.75) / 0.25));
    p.torso = [0.15, lp(lp(0.2, -0.6, c), 0.7, f) * (1 - rec), 0];
    grip(p, lp(-0.7, -1.2, c), lp(-0.3, -0.9, c) + f * 1.3 * (1 - rec), -1.0, -0.4); p.swR = [STICK, 0, lp(0.3, -0.4, c) + f * 0.9 * (1 - rec)];
    return p;
  },
  // shoot (= atk1): stick cocked high over the right shoulder, a step in, then an overhand whip (the ball leaves at u 0.5)
  shoot(u, J) {
    const p = stance(J, 0.2, 0.45), c = ez(cl(u / 0.4)), w = ez(cl((u - 0.44) / 0.08)), rec = ez(cl((u - 0.8) / 0.2));
    p.torso = [lp(lp(0.15, -0.2, c), 0.55, w) * (1 - rec * 0.6), lp(lp(0.2, 0.7, c), -0.3, w), 0]; p.neck = [0, lp(-0.5 * c, 0.2, w), 0];
    p.shR = [lp(lp(-0.7, -2.6, c), -0.9, w) + rec * 0.3, 0, -0.3]; p.elR = [lp(-1.1, -0.8, c) + w * 0.6, 0, 0]; p.swR = [lp(STICK, STICK + 0.9, c) - w * 1.0, 0, 0];
    p.shL = [lp(-1.0, -1.4, c) + w * 0.6, 0, 0.3]; p.elL = [-1.0, 0, 0];
    p.lgL = [-0.7, 0, 0.18]; p.knL = [0.7, 0, 0]; p.lgR = [0.3, 0, -0.18];
    return p;
  },
  // check (= atk2): both paws wide on the shaft, a hard two-handed shove straight out
  check(u, J) {
    const p = stance(J, 0.2, 0.5), c = ez(cl(u / 0.34)), s = ez(cl((u - 0.38) / 0.08)), rec = ez(cl((u - 0.75) / 0.25));
    p.torso = [lp(0.15, -0.1, c) + s * 0.5 - rec * 0.3, 0, 0]; p.neck = [-0.2 * s, 0, 0];
    p.shR = [lp(-0.7, -0.9, c) - s * 0.6 + rec * 0.4, 0, -0.35]; p.elR = [lp(-1.1, -1.8, c) + s * 1.6 * (1 - rec), 0, 0];
    p.shL = [lp(-1.0, -0.9, c) - s * 0.6 + rec * 0.4, 0, 0.35]; p.elL = [lp(-1.3, -1.8, c) + s * 1.6 * (1 - rec), 0, 0]; p.swR = [Math.PI / 2 + 0.1, 0, Math.PI / 2 - 0.2];
    p.lgL = [-0.8, 0, 0.18]; p.knL = [0.8, 0, 0]; p.lgR = [0.35, 0, -0.18];
    return p;
  },
  // stunned: wobbling on the spot, stick drooping, head lolling in circles
  stunned(u, J) {
    const p = stance(J, 0.15, 0.35), a = u * Math.PI * 4;
    p.torso = [0.1 + 0.12 * Math.sin(a), 0.15 * Math.cos(a), 0.1 * Math.sin(a)]; p.neck = [0.2 * Math.cos(a), 0.3 * Math.sin(a), 0];
    p.shL = [-0.3, 0, 0.35]; p.elL = [-0.4, 0, 0]; p.shR = [-0.4, 0, -0.35]; p.elR = [-0.5, 0, 0]; p.swR = [STICK + 1.2, 0, 0];
    return p;
  },
};
POSES.atk1 = (u, J) => POSES.shoot(u, J);
POSES.atk2 = (u, J) => POSES.check(u, J);
// atk3 stick sweep: a low, wide 200 degree sweep of the stick at ankle height, crouching into it
POSES.atk3 = (u, J) => {
  const p = stance(J, 0.24, 0.55), c = ez(cl(u / 0.36)), s = ez(cl((u - 0.4) / 0.16)), rec = ez(cl((u - 0.78) / 0.22));
  p.torso = [lp(0.15, 0.7, c) * (1 - rec * 0.7), lp(lp(0.2, 1.1, c), -1.1, s) * (1 - rec), 0]; p.hips = [0, lp(0.4 * c, -0.5, s) * (1 - rec), 0];
  p.shR = [lp(-0.7, -0.15, c), 0, lp(lp(-0.3, 0.5, c), -1.2, s) * (1 - rec * 0.7)]; p.elR = [-0.15, 0, 0]; p.swR = [Math.PI / 2 + 1.1, 0, 0]; p.y = -0.1 - 0.02 * c * (1 - rec);
  p.shL = [-0.9, 0, 0.6]; p.elL = [-1.2, 0, 0];
  return p;
};

// the ball leaves the pocket on the shot / pass; safe to skip
export function animateBoss(J, t, state, u = 0) {
  if (J.ball) J.ball.visible = !(((state === 'atk1' || state === 'shoot') && u > 0.5) || (state === 'pass' && u > 0.45));
}

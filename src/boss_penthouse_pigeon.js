// boss_penthouse_pigeon.js — Toad City Baltimore, O7 (H-003/H-004): The Penthouse Pigeon, rooftop deck (`wtc`).
// tcr2 o7 penthouse_pigeon
// Built by Grok Bot standing in for Opus (branch grok/opus-standin). A rich, round city pigeon in a plum velvet smoking jacket with
// gold quilted lapels, a cream ascot, a gold monocle on a chain and a tiny tasselled smoking cap. Grey-blue feathers, iridescent
// green/violet neck ring, coral feet, orange eye. Original character: no real person, mascot, brand, logo or lettering (HOMAGE.md).
// Wings are big flat feather fans on the arm joints (shL/R > elL/R > haL/R) so they read in silhouette at 30–60 m against the tower.
// Contract: META, exactly 3 ATTACKS, POSES idle/run/hurt/down/atk1-3 + H-004 states via J.pose(name, u):
//   walk_edge (rooftop strut), poop_drop (= atk3, tail-up drop), fly (flap loop), swoop (= atk1, low dive: the vulnerable window),
//   peck (= atk2, head-bob pecks), dazed (after the tongue-grab slam).
// Hook: buildPenthousePigeon({ THREE, toonMat, outlineMat, QUAL } or K, opts) -> the rig J: { root, wings: [L, R], head, update(dt, st), pose }, st = { state, u?, t? }.
// One toon material per rig. No imports: everything comes through K (or the hook deps, completed by kitFrom as in the O6/O8 bosses).

export const META = { id: 'penthouse_pigeon', name: 'The Penthouse Pigeon', district: 'wtc', hp: 120, scale: 1.3, radius: 0.9, height: 2.3 };
export const ATTACKS = [
  { id: 'rooftop_swoop', pose: 'atk1', dur: 1.4, windup: 0.4, active: [0.45, 0.65], reach: 6, arc: 40, dmg: 12, move: 6, fx: 'dash', strike: 'head', vulnerable: [0.45, 0.8] },
  { id: 'peck_flurry', pose: 'atk2', dur: 1.1, windup: 0.25, active: [0.3, 0.75], reach: 1.6, arc: 50, dmg: 10, fx: 'peck', strike: 'head' },
  { id: 'poop_drop', pose: 'atk3', dur: 1.3, windup: 0.45, active: [0.5, 0.62], reach: 9, arc: 30, dmg: 14, fx: 'drop_splat', strike: 'hips' },
];

// ---------------- kit access (copied from boss_kingpin_carl.js, itself line for line from kit/toadcity_kit.js) ----------------
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
const D = { hip: 0.62, torsoY: 0.04, neckY: 0.66, legX: 0.14, thigh: 0.27, shin: 0.3, shX: 0.36, shY: 0.5, upper: 0.32, fore: 0.32 };
const C = { feather: '#8e97a8', dark: '#5c6474', wingbar: '#3c4352', neck: '#3fa37a', violet: '#7d5aa6', foot: '#e8806a', beak: '#3a3236',
  cere: '#e8e2d8', eye: '#f08c2a', ink: '#14101f', jacket: '#6b2a4a', lapel: '#c9a23e', ascot: '#efe6cf', gold: '#e8c040', cap: '#2a1e3a', tassel: '#e8c040' };

function buildPenthousePigeonRig(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp } = K, PI = Math.PI;
  let s = ((opts.seed | 0) % 2147483646 + 2147483646) % 2147483646 + 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const lod = opts.lod === 1, g = (p, x, y, z) => { const r = grp(p, x, y, z); r.userData.mat = mat; return r; };
  // hips: grey belly-bottom + tail fan (kept short and tucked so the down/poop poses stay above ground)
  part(J.hips, G.sph(0.34, 0.24, 0.32), C.feather, 0, 0.06, -0.02);
  const tail = J.tail = g(J.hips, 0, 0.06, -0.28); J.tailBase = 0.35 + rnd() * 0.05; tail.rotation.x = J.tailBase;
  part(tail, G.box(0.36, 0.05, 0.36), C.dark, 0, 0, -0.16);
  part(tail, G.box(0.37, 0.055, 0.06), C.wingbar, 0, 0.002, -0.32, { outline: false, shadow: false });
  // torso: round pigeon chest in the smoking jacket, quilted gold lapels, cream ascot, pocket square
  part(J.torso, G.sph(0.42, 0.46, 0.4), C.jacket, 0, 0.3, 0);
  part(J.torso, G.sph(0.3, 0.34, 0.12), C.feather, 0, 0.36, 0.3);                                               // feathered chest front
  for (const sd of [1, -1]) part(J.torso, G.box(0.1, 0.5, 0.05), C.lapel, sd * 0.2, 0.36, 0.33, { rot: [0.15, sd * -0.4, sd * 0.22] });
  part(J.torso, G.box(0.36, 0.08, 0.36), C.lapel, 0, 0.12, 0.05, { rot: [0, 0, 0] });                           // sash belt
  part(J.torso, G.sph(0.11, 0.13, 0.08), C.ascot, 0, 0.6, 0.3);
  if (!lod) part(J.torso, G.box(0.09, 0.06, 0.03), C.ascot, -0.22, 0.42, 0.34, { rot: [0, 0.4, 0.2] });
  // neck + head: iridescent ring, small round head, dark beak with white cere, orange eye, monocle, smoking cap with tassel
  part(J.neck, G.cyl(0.2, 0.26, 0.2), C.neck, 0, 0.02, 0.04);
  part(J.neck, G.tor(0.22, 0.04), C.violet, 0, 0.1, 0.04, { rot: [PI / 2, 0, 0] });
  const head = J.head = g(J.neck, 0, 0.12, 0.08);
  part(head, G.sph(0.21, 0.2, 0.22), C.feather, 0, 0.16, 0);
  part(head, G.cyl(0.02, 0.06, 0.2), C.beak, 0, 0.12, 0.27, { rot: [PI / 2 + 0.15, 0, 0] });
  part(head, G.sph(0.05, 0.035, 0.05), C.cere, 0, 0.16, 0.2);
  for (const sd of [1, -1]) {
    part(head, G.sph(0.055, 0.055, 0.03), C.eye, sd * 0.13, 0.2, 0.13, { rot: [0, sd * 0.6, 0] });
    part(head, G.sph(0.025, 0.025, 0.02), C.ink, sd * 0.145, 0.2, 0.145, { rot: [0, sd * 0.6, 0], outline: false });
  }
  part(head, G.tor(0.07, 0.012), C.gold, 0.14, 0.2, 0.155, { rot: [0, 0.6, 0], outline: false });               // monocle (right eye)
  part(head, G.cyl(0.13, 0.15, 0.1), C.cap, 0, 0.36, -0.02, { rot: [-0.15, 0, 0.1] });
  if (!lod) part(head, G.sph(0.04, 0.06, 0.04), C.tassel, 0.12, 0.33, -0.08, { outline: false, shadow: false });
  // wings on the arm joints: shoulder covert + two big flat feather fans, dark wing bars
  for (const k of ['L', 'R']) {
    const sd = k === 'L' ? 1 : -1;
    part(J['sh' + k], G.sph(0.16, 0.16, 0.14), C.jacket, 0, -0.02, 0);
    part(J['sh' + k], G.box(0.06, D.upper + 0.04, 0.42), C.feather, sd * 0.03, -D.upper / 2, -0.04);
    part(J['el' + k], G.box(0.05, D.fore + 0.02, 0.5), C.feather, sd * 0.02, -D.fore / 2, -0.06);
    part(J['el' + k], G.box(0.055, 0.07, 0.5), C.wingbar, sd * 0.02, -D.fore / 2, -0.06, { outline: false, shadow: false });
    part(J['ha' + k], G.box(0.04, 0.42, 0.34), C.dark, sd * 0.01, -0.19, -0.1, { rot: [0.25, 0, 0] });         // primaries
  }
  // legs: short coral legs, three-toed feet
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.07, D.thigh - 0.1), C.feather, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.04, D.shin - 0.06), C.foot, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.box(0.2, 0.04, 0.22), C.foot, 0, 0.0, 0.06);
  }
  if (!lod) part(J.torso, G.cyl(0.006, 0.006, 0.3, 4), C.gold, 0.18, 0.62, 0.36, { rot: [0.3, 0, 0.9], outline: false, shadow: false });   // monocle chain
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  J.pose = (name, u = 0, t) => {
    const P = POSES, tt = t ?? u, p = name === 'idle' ? P.idle(tt, J) : name === 'run' ? P.run(tt, 5, J) : name === 'down' ? P.down(u, true, J) : (P[name] || P.idle)(u, J);
    K.applyPose(J, p, 1e4, 1, true); animateBoss(J, tt, name, u); return J;
  };
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t), TAU = Math.PI * 2;
function stand(J, w = 0.14, b = 0.25) { const p = J.K.blank(); J.K.legsStance(p, w, b); return p; }
const fold = (p) => { p.shL = [0.1, 0, 0.12]; p.shR = [0.1, 0, -0.12]; p.elL = [0, 0, -0.1]; p.elR = [0, 0, 0.1]; };
const spread = (p, a, f = 0) => {   // a: 0 folded .. 1 fully out sideways; f: flap offset (+ up)
  const z = lp(0.12, 1.45, a) + f; p.shL = [0.1 * (1 - a), 0, z]; p.shR = [0.1 * (1 - a), 0, -z];
  p.elL = [0, 0, lp(-0.1, 0.1, a) + f * 0.5]; p.elR = [0, 0, -(lp(-0.1, 0.1, a) + f * 0.5)]; p.haL = [0, 0, f * 0.4]; p.haR = [0, 0, -f * 0.4];
};
export const POSES = {
  idle(t, J) {   // chest puffed, head bob, the odd wing adjust
    const p = stand(J), b = Math.sin(t * 2.2); fold(p);
    p.torso = [-0.1, 0.1 * b, 0]; p.neck = [0.12 * Math.max(0, Math.sin(t * 4.4)), 0, 0]; p.y += 0.015 * b;
    return p;
  },
  run(t, sp, J) {   // waddling strut, head thrusting
    const K = J.K, p = K.blank(), ph = t * (6 + sp); K.runLegs(p, ph, 0.8); fold(p);
    p.torso = [0.15, 0, Math.sin(ph) * 0.12]; p.neck = [0.3 * Math.max(0, Math.sin(ph * 2)) - 0.1, 0, 0];
    return p;
  },
  hurt(u, J) { const p = stand(J, 0.16, 0.35), k = 1 - u; spread(p, 0.55 * k, 0.3 * k); p.torso = [-0.45 * k, 0.25 * k, 0]; p.neck = [-0.5 * k, 0, 0]; return p; },
  down(u, ground, J) {   // belly flop forward, wings splayed, tail up (nothing behind the hips goes under ground)
    const p = J.K.blank(), k = ground ? 1 : cl(u * 2.2); p.tilt = [1.25 * k, 0, 0]; p.ty = lp(0, 0.3, k);
    spread(p, 0.9 * k, -0.2 * k); p.neck = [-0.9 * k, 0.3 * k, 0];
    p.lgL = p.lgR = [0.8 * k, 0, 0]; p.knL = p.knR = [0.6 * k, 0, 0];
    return p;
  },
  walk_edge(u, J) {   // rooftop strut: tight steps, head bob every step, wings held a touch out for balance
    const K = J.K, p = K.blank(), ph = u * TAU * 2; K.runLegs(p, ph, 0.45); spread(p, 0.18, 0.05 * Math.sin(ph));
    p.torso = [-0.05, 0, Math.sin(ph) * 0.08]; p.neck = [0.35 * Math.max(0, Math.sin(ph * 2)) - 0.12, 0, 0];
    return p;
  },
  fly(u, J) {   // flap loop: body pitched forward, legs tucked back, big wing beats (one beat per u cycle)
    const p = J.K.blank(), f = Math.sin(u * TAU); spread(p, 1, 0.7 * f);
    p.torso = [0.55, 0, 0]; p.neck = [-0.45, 0, 0]; p.ty = 0.5 + 0.1 * Math.sin(u * TAU + 1.2);
    p.lgL = p.lgR = [1.0, 0, 0]; p.knL = p.knR = [0.9, 0, 0]; p.ftL = p.ftR = [0.6, 0, 0];
    return p;
  },
  swoop(u, J) {   // low dive pass: rises, folds half, dives level at shoulder height (vulnerable 0.45–0.8), pulls up
    const p = J.K.blank(), up = ez(cl(u / 0.4)), dv = ez(cl((u - 0.4) / 0.1)), rec = ez(cl((u - 0.8) / 0.2));
    spread(p, lp(1, 0.75, dv) + 0.25 * rec, 0.5 * Math.sin(u * TAU * 2) * (1 - dv + rec));
    p.torso = [lp(0.4, 1.1, dv) * (1 - rec) + 0.4 * rec, 0, 0]; p.neck = [lp(-0.3, -0.9, dv), 0, 0];
    p.ty = lp(0.2, 0.9, up) * (1 - dv) + 0.35 * dv * (1 - rec) + 0.6 * rec;
    p.lgL = p.lgR = [1.1, 0, 0]; p.knL = p.knR = [1.0, 0, 0];
    return p;
  },
  peck(u, J) {   // head-bob pecks: three fast jabs (u ≈ 0.35, 0.5, 0.65)
    const p = stand(J, 0.18, 0.4), w = ez(cl(u / 0.25)), j = Math.max(0, Math.sin(cl((u - 0.28) / 0.45) * Math.PI * 3)), rec = ez(cl((u - 0.78) / 0.22));
    fold(p); spread(p, 0.3 * w * (1 - rec));
    p.torso = [lp(-0.2, 0.55, j) * (1 - rec) - 0.2 * w * (1 - j), 0, 0]; p.neck = [lp(-0.3, 0.7, j) * (1 - rec), 0, 0]; 
    return p;
  },
  poop_drop(u, J) {   // tail-up drop from the edge: leans forward, tail high, wings flared, the drop at u ≈ 0.55
    const p = stand(J, 0.18, 0.35), lean = ez(cl(u / 0.45)), d = ez(cl((u - 0.5) / 0.08)), rec = ez(cl((u - 0.75) / 0.25));
    spread(p, 0.55 * lean * (1 - rec), 0.15 * d);
    p.hips = [0.55 * lean * (1 - rec), 0, 0]; p.torso = [0.2 * lean * (1 - rec), 0, 0]; p.neck = [-0.5 * lean * (1 - rec), 0, 0];
    p.y += 0.04 * d * (1 - rec);
    return p;
  },
  dazed(u, J) {   // after the tongue-grab slam: wobbling circles, wings drooping, head lolling
    const p = stand(J, 0.2, 0.3), a = u * TAU; spread(p, 0.45, 0);
    p.tilt = [0.08 * Math.sin(a), 0, 0.1 * Math.cos(a)]; p.torso = [0.1, 0.15 * Math.sin(a), 0.08 * Math.cos(a)];
    p.neck = [0.3 + 0.15 * Math.sin(a * 2), 0.35 * Math.sin(a), 0.25 * Math.cos(a)];
    return p;
  },
};
POSES.atk1 = (u, J) => POSES.swoop(u, J);
POSES.atk2 = (u, J) => POSES.peck(u, J);
POSES.atk3 = (u, J) => POSES.poop_drop(u, J);

// tail lifts in poop_drop / atk3 and flicks in fly; safe to skip
export function animateBoss(J, t, state, u = 0) {
  if (!J.tail) return; const b = J.tailBase;
  J.tail.rotation.x = (state === 'atk3' || state === 'poop_drop') ? b - 0.9 * ez(cl(u / 0.45)) * (1 - ez(cl((u - 0.75) / 0.25)))
    : (state === 'fly' || state === 'swoop' || state === 'atk1') ? b - 0.2 + 0.1 * Math.sin(u * TAU) : b;
}

// H-004 hook for the climb set piece and the stand-in: deps { THREE, toonMat, outlineMat, QUAL } (any K works too).
export function buildPenthousePigeon(deps = {}, opts = {}) {
  const J = buildPenthousePigeonRig(deps, opts); let t = 0, u = 0, last = null;
  const DUR = { idle: 1, run: 1, fly: 0.45, walk_edge: 1.0, swoop: 1.4, peck: 1.1, poop_drop: 1.3, dazed: 1.6, hurt: 0.5, down: 1, atk1: 1.4, atk2: 1.1, atk3: 1.3 };
  // the rig itself is the hook result (so the boss viewer / measure tools and the climb set piece share one build):
  J.wings = [J.shL, J.shR]; J.ATTACKS = ATTACKS;
  J.update = (dt = 1 / 60, st = {}) => {
    const name = st.state || 'fly'; t += dt; if (name !== last) { u = 0; last = name; }
    u = st.u != null ? st.u : (u + dt / (DUR[name] || 1)) % 1;
    J.pose(name, u, st.t != null ? st.t : t);
  };
  J.pose('idle', 0);
  return J;   // { root, wings: [L, R], head, update(dt, st), pose(name, u), ... }
}

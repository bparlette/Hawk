// boss_kingpin_carl.js — Toad City Baltimore, O8 new content: Kingpin Carl, the rowhouse duckpin alley (`basement_lanes`).
// tcr2 o8 kingpin_carl
// A hefty possum, boss of the Masked Bandits: white face, black ears, pink nose, a grey retro bowling shirt with the gang's orange side
// panels and collar, dark slacks, orange-and-cream bowling shoes, his lucky towel over the left shoulder, and his long pink tail coiled
// round his waist like a belt (so it never touches the lane in any pose). Original character: no real person, team or brand.
// Contract: the O6 boss contract plus the alley states in POSES and J.pose(name, u): bowl (windup + release of a small duckpin ball;
// = atk1), heckle, celebrate, sulk. The ball rides on J.swR and hides after the release (u > 0.5 in bowl / atk1).

export const META = { id: 'kingpin_carl', name: 'Kingpin Carl', district: 'basement_lanes', hp: 130, scale: 1.25, radius: 0.85, height: 2.55, gang: 'masked_bandits' };
export const ATTACKS = [
  { id: 'duckpin_bowl', pose: 'atk1', dur: 1.2, windup: 0.42, active: [0.46, 0.62], reach: 14, arc: 20, dmg: 12, fx: 'duckpin_roll', strike: 'haR' },
  { id: 'shoulder_barge', pose: 'atk2', dur: 1.0, windup: 0.36, active: [0.4, 0.62], reach: 2.2, arc: 70, dmg: 13, move: 4, fx: 'dash', strike: 'shL' },
  { id: 'gutter_stomp', pose: 'atk3', dur: 1.2, windup: 0.5, active: [0.54, 0.66], reach: 2.8, arc: 360, dmg: 15, fx: 'ground_slam', strike: 'ftR' },
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
const D = { hip: 0.9, torsoY: 0.06, neckY: 0.62, legX: 0.15, thigh: 0.4, shin: 0.41, shX: 0.36, shY: 0.48, upper: 0.29, fore: 0.27 };
const C = { fur: '#c9c4c4', face: '#f4f0ec', ear: '#2a2428', nose: '#e88aa0', tail: '#e8a8b0', shirt: '#6f6a72', orange: '#ff9f1c',
  pants: '#3a3640', shoe: '#ff9f1c', shoe2: '#f0e8d8', towel: '#f2ecdc', ink: '#14101f', ball: '#2a2a34', gold: '#e8c040', pick: '#e0c890' };

export function buildKingpinCarl(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const lod = opts.lod === 1;
  // hips: slacks, the tail coiled round the waist as a belt with the tip hanging at the right hip
  part(J.hips, G.sph(0.3, 0.19, 0.25), C.pants, 0, 0.02, 0);
  part(J.hips, G.tor(0.3, 0.045), C.tail, 0, 0.12, 0, { rot: [PI / 2, 0, 0], shadow: false });
  part(J.hips, G.cap(0.035, 0.16), C.tail, -0.3, -0.02, 0.06, { rot: [0, 0, 0.3], shadow: false });
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.12, D.thigh - 0.12), C.pants, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.1, D.shin - 0.14), C.pants, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.12, 0.085, 0.2), C.shoe2, 0, -0.03, 0.06);
    part(J['ft' + k], G.sph(0.125, 0.06, 0.12), C.shoe, 0, -0.02, 0.14);                                       // two-tone toe cap
  }
  // torso: hefty bowling shirt, orange side panels and collar, a gold pinky-chain, the lucky towel over the left shoulder
  part(J.torso, G.sph(0.4, 0.4, 0.32), C.shirt, 0, 0.3, 0);
  for (const s of [-1, 1]) part(J.torso, G.box(0.06, 0.52, 0.3), C.orange, s * 0.36, 0.3, 0.02, { rot: [0, 0, s * 0.14], outline: false, shadow: false });
  for (const s of [-1, 1]) part(J.torso, G.box(0.16, 0.05, 0.14), C.orange, s * 0.11, 0.66, 0.17, { rot: [0.35, 0, s * -0.45] });
  part(J.torso, G.box(0.03, 0.42, 0.03), C.ink, 0, 0.36, 0.31, { rot: [-0.1, 0, 0], outline: false, shadow: false });   // button line
  const tw = J.towel = grp(J.torso, 0.24, 0.62, 0); tw.userData.mat = mat;
  part(tw, G.box(0.24, 0.05, 0.62), C.towel, 0, 0.02, 0, { rot: [0, 0, -0.25] });                                // over the shoulder
  part(tw, G.box(0.2, 0.44, 0.03), C.towel, 0.03, -0.2, 0.3, { rot: [0.12, 0, -0.1] });                         // hanging front
  part(tw, G.box(0.21, 0.05, 0.035), C.orange, 0.03, -0.34, 0.32, { rot: [0.05, 0, -0.1], outline: false, shadow: false });   // stripe
  // head: possum face (white), black round ears, long pink snout tip, small black eyes, a toothpick
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.2, 0.19, 0.23), C.face, 0, 0.22, 0.0);
  part(head, G.cyl(0.035, 0.13, 0.3, 12), C.face, 0, 0.17, 0.27, { rot: [PI / 2 + 0.12, 0, 0] });              // long tapered possum snout
  part(head, G.sph(0.045, 0.04, 0.045), C.nose, 0, 0.15, 0.43);
  part(head, G.sph(0.17, 0.08, 0.16), C.fur, 0, 0.36, -0.04);                                                   // grey crown
  for (const s of [-1, 1]) {
    part(head, G.sph(0.07, 0.085, 0.025), C.ear, s * 0.15, 0.38, -0.04, { rot: [-0.2, s * 0.4, s * 0.3] });   // small thin ears
    part(head, G.sph(0.06, 0.05, 0.03), C.ear, s * 0.08, 0.27, 0.17, { rot: [0, s * 0.35, 0] });               // dark eye ring
    part(head, G.sph(0.03, 0.035, 0.02), C.ink, s * 0.085, 0.27, 0.19, { rot: [0, s * 0.35, 0] });
  }
  part(head, G.cyl(0.008, 0.008, 0.16, 5), C.pick, 0.08, 0.1, 0.36, { rot: [0, 0, 1.3], outline: false, shadow: false });   // toothpick
  // arms: short shirt sleeves, grey fur forearms, pink possum hands; the duckpin ball in the right hand
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.15, 0.15, 0.15), C.shirt, 0, 0, 0);
    part(J['sh' + k], G.cap(0.12, D.upper - 0.12), C.shirt, 0, -D.upper / 2 + 0.02, 0);
    part(J['el' + k], G.cap(0.1, D.fore - 0.1), C.fur, 0, -D.fore / 2, 0);
    part(J['ha' + k], G.sph(0.1, 0.09, 0.1), C.tail, 0, -0.04, 0);
  }
  if (!lod) part(J.haL, G.tor(0.03, 0.01), C.gold, 0.05, -0.06, 0.04, { rot: [0, PI / 2, 0], outline: false, shadow: false });   // pinky ring
  const sw = J.swR = grp(J.haR, 0, -0.1, 0.03); sw.userData.mat = mat;
  J.ball = part(sw, G.sph(0.09, 0.09, 0.09), C.ball, 0, -0.04, 0);
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  J.pose = (name, u = 0, t) => {
    const P = POSES, tt = t ?? u, p = name === 'idle' ? P.idle(tt, J) : name === 'run' ? P.run(tt, 5, J) : name === 'down' ? P.down(u, true, J) : (P[name] || P.idle)(u, J);
    K.applyPose(J, p, 1e4, 1, true); animateBoss(J, tt, name, u); return J;
  };
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
function stand(J, w = 0.17, b = 0.3) { const p = J.K.blank(); J.K.legsStance(p, w, b); return p; }
export const POSES = {
  idle(t, J) {   // weighing the ball in his right hand, chewing the toothpick, rocking on his heels
    const p = stand(J), b = Math.sin(t * 2.4); p.y += 0.02 * b;
    p.torso = [0.05 - 0.05 * b, 0.2, 0]; p.neck = [0, -0.2, 0.05 * b]; p.hips = [0, -0.15, 0];
    p.shL = [-0.2, 0, 0.35]; p.elL = [-0.4, 0, 0];
    p.shR = [-0.55, 0, -0.3]; p.elR = [-1.3 + 0.15 * b, 0, 0];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (6 + sp); K.runLegs(p, ph, cl(sp / 4.5, 0.4, 1));
    p.torso = [0.25, Math.sin(ph) * 0.2, 0]; p.neck = [-0.15, -Math.sin(ph) * 0.12, 0];
    p.shL = [0.7 * Math.sin(ph), 0, 0.25]; p.shR = [-0.7 * Math.sin(ph), 0, -0.25]; p.elL = p.elR = [-1.2, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = stand(J, 0.16, 0.45), k = 1 - u;
    p.torso = [-0.5 * k, 0.3 * k, 0]; p.neck = [-0.5 * k, 0, 0]; p.shL = [-0.6, 0, 0.9]; p.shR = [-0.6, 0, -0.9]; p.elL = p.elR = [-0.8, 0, 0];
    return p;
  },
  down(u, ground, J) {   // playing possum: flat on his back, arms out, tongue out (the classic)
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.4 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.2, 0, 0.8]; p.shR = [-2.0, 0, -0.95]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.5, 0.4, 0];
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.08) * cl(u * 2.2), 0, 0];
    return p;
  },
  // bowl (= atk1): a three-step approach in place, ball swung back high, then a low underhand release at u 0.5 (the ball leaves)
  bowl(u, J) {
    const p = stand(J, 0.2, 0.45), back = ez(cl((u - 0.1) / 0.32)), fwd = ez(cl((u - 0.44) / 0.08)), fol = ez(cl((u - 0.52) / 0.2)), rec = ez(cl((u - 0.85) / 0.15));
    p.torso = [lp(0.1, 0.55, back) * (1 - rec * 0.8), lp(0.2, -0.35, back) * (1 - fwd), 0]; p.neck = [lp(0, -0.4, back) * (1 - rec), 0, 0];
    p.shR = [lp(lp(-0.55, 1.1, back), -0.6, fwd) - fol * 0.9 + rec * 0.8, 0, -0.15]; p.elR = [lp(-1.3, -0.1, back) - fol * 0.3, 0, 0];
    p.shL = [lp(-0.2, -0.7, back), 0, lp(0.35, 1.2, back)]; p.elL = [-0.3, 0, 0];
    p.lgL = [lp(-0.2, -0.95, back), 0, 0.15]; p.knL = [lp(0.3, 1.1, back), 0, 0]; p.lgR = [lp(-0.1, 0.55, back), 0, -0.3]; p.knR = [lp(0.27, 0.2, back), 0, 0];
    p.y = -0.064 - 0.12 * back * (1 - rec);
    return p;
  },
  // heckle: leans in, left hand cupped to the snout, right hand pointing and wagging
  heckle(u, J) {
    const p = stand(J), w = Math.sin(u * Math.PI * 6) * 0.25;
    p.torso = [0.3, 0.15, 0]; p.neck = [-0.1, -0.15, 0.1 * w];
    p.shL = [-1.7, 0, 0.5]; p.elL = [-2.2, 0, 0];
    p.shR = [-1.5, 0, -0.2 + w]; p.elR = [-0.15, 0, 0];
    return p;
  },
  // celebrate: a hop and a double fist pump (u 0.35 and 0.7)
  celebrate(u, J) {
    const p = stand(J, 0.2, 0.35), h = Math.sin(cl(u / 0.5) * Math.PI), pump = Math.abs(Math.sin(u * Math.PI * 2));
    p.ty = 0.18 * h; p.torso = [-0.1, 0, 0]; p.neck = [-0.25, 0, 0];
    p.shL = [-2.6 + 0.4 * pump, 0, 0.35]; p.elL = [-0.6 * pump, 0, 0]; p.shR = [-2.6 + 0.4 * pump, 0, -0.35]; p.elR = [-0.6 * pump, 0, 0];
    return p;
  },
  // sulk: shoulders down, arms crossed, head hung, one foot scuffing
  sulk(u, J) {
    const p = stand(J, 0.12, 0.25), s = Math.sin(u * Math.PI * 2) * 0.15;
    p.torso = [0.35, 0.1, 0]; p.neck = [0.45, -0.2, 0];
    p.shL = [-1.0, 0, -0.35]; p.elL = [-1.9, 0, 0]; p.haL = [0, 0.4, 0];
    p.shR = [-1.0, 0, 0.35]; p.elR = [-1.9, 0, 0]; p.haR = [0, -0.4, 0];
    p.lgR = [-0.3 + s, 0, -0.1]; p.knR = [0.4, 0, 0];
    return p;
  },
};
POSES.atk1 = (u, J) => POSES.bowl(u, J);
// atk2 shoulder barge: drops the left shoulder (towel side) and charges through with it
POSES.atk2 = (u, J) => {
  const p = stand(J, 0.2, 0.5), d = ez(cl(u / 0.36)), b = ez(cl((u - 0.42) / 0.07)), rec = ez(cl((u - 0.66) / 0.34));
  p.torso = [lp(0.1, 0.5, d) * (1 - rec), lp(0.2, -0.9, d) + b * 0.9 * (1 - rec) + rec * 0.2, 0]; p.hips = [0, lp(0, -0.5, d) * (1 - rec), 0]; p.neck = [-0.2 * d, 0.6 * d * (1 - rec), 0];
  p.shL = [lp(-0.2, -0.4, d) - 1.0 * b * (1 - rec), 0, lp(0.35, 0.15, d)]; p.elL = [lp(-0.4, -1.8, d), 0, 0];
  p.shR = [lp(-0.55, 0.4, d), 0, -0.4]; p.elR = [-0.8, 0, 0];
  p.lgL = [lp(-0.2, -0.8, d) - b * 0.2, 0, 0.18]; p.knL = [lp(0.3, 0.9, d), 0, 0]; p.lgR = [lp(-0.1, 0.5, d), 0, -0.2];
  return p;
};
// atk3 gutter stomp: lifts the right knee high, arms up, and stamps it down (u 0.6): a shock ring down the lane
POSES.atk3 = (u, J) => {
  const p = stand(J, 0.22, 0.4), up = ez(cl(u / 0.48)), st = ez(cl((u - 0.52) / 0.08)), rec = ez(cl((u - 0.8) / 0.2));
  p.lgR = [lp(-0.12, -1.6, up) * (1 - st) - st * 0.2, 0, -0.22]; p.knR = [lp(0.36, 1.6, up) * (1 - st) + st * 0.45, 0, 0];
  p.lgL = [-0.2 - 0.25 * st, 0, 0.22]; p.knL = [0.3 + 0.35 * st * (1 - rec), 0, 0];
  p.torso = [lp(0.05, -0.2, up) + st * 0.45 - rec * 0.3, 0, 0]; p.neck = [-0.2 * up + 0.3 * st, 0, 0]; p.y = -0.064 - 0.03 * st * (1 - rec);
  p.shL = [lp(-0.2, -2.4, up) + st * 1.6, 0, 0.5]; p.shR = [lp(-0.55, -2.4, up) + st * 1.6, 0, -0.5]; p.elL = p.elR = [-0.5, 0, 0];
  return p;
};

// the ball leaves his hand at the release (and is back for the next frame of anything else); safe to skip
export function animateBoss(J, t, state, u = 0) { if (J.ball) J.ball.visible = !((state === 'atk1' || state === 'bowl') && u > 0.5); }

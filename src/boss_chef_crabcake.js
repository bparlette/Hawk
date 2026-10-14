// boss_chef_crabcake.js — Toad City Baltimore, Task D boss 10 of 17 (batch 2, O6): Chef Crabcake, the Four Seasons kitchen.
// tcr2 o6 redclaw-rocket
// A classic Maryland blue crab in chef's whites: the bright blue carapace is his face (lateral spines, stalk eyes) under a tall toque,
// a double-breasted coat, red neckerchief and apron, a wooden crab mallet in each claw, and one little walking leg that holds his
// seasoning tin (an original tin, "CHEF'S CRAB DUST", drawn on canvas; no real brand's design). Steamed red when angry.
// Contract: TASK_D_bosses.md + O6 brief + HOMAGE.md + J-003 Q-e (J.setAngry). The tin label is the one mapped sub-material; its canvas
// is cached per kit (key K.QUAL || K.THREE || K) and only after a successful draw (lesson A4).

export const META = { id: 'chef_crabcake', name: 'Chef Crabcake', district: 'fourseasons', hp: 125, scale: 1.18, radius: 0.85, height: 2.95 };
export const ATTACKS = [
  { id: 'seasoning_blind', pose: 'atk1', dur: 1.0, windup: 0.38, active: [0.42, 0.66], reach: 4.5, arc: 70, dmg: 8, fx: 'seasoning_cloud_blind', strike: 'haL' },
  { id: 'mallet_drumroll', pose: 'atk2', dur: 1.1, windup: 0.36, active: [0.4, 0.76], reach: 2.3, arc: 60, dmg: 14, fx: 'double_smash', strike: 'haR' },
  { id: 'sidestep_sweep', pose: 'atk3', dur: 1.0, windup: 0.34, active: [0.4, 0.62], reach: 2.8, arc: 190, dmg: 12, move: 2.5, fx: 'sweep', strike: 'haR' },
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

// ---------------- the seasoning-tin label (canvas, cached per kit, never cached on a failed draw) ----------------
const TIN_TEX = new Map();
function tinTexture(K) {
  const key = K.QUAL || K.THREE || K; if (TIN_TEX.has(key)) return TIN_TEX.get(key);
  if (typeof document === 'undefined' || !document.createElement) return null;
  let tex = null;
  try {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); if (!g) return null;
    g.fillStyle = '#2f7a4a'; g.fillRect(0, 0, 256, 128);                                     // forest-green tin
    g.fillStyle = '#f4ead0'; g.fillRect(0, 22, 256, 84);                                      // cream band
    g.fillStyle = '#d23a2a'; g.fillRect(0, 26, 256, 6); g.fillRect(0, 96, 256, 6);
    g.fillStyle = '#d23a2a'; g.font = 'bold 30px Impact, "Arial Black", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText("CHEF'S", 64, 52); g.fillText("CHEF'S", 192, 52);
    g.fillStyle = '#2f7a4a'; g.font = 'bold 26px Impact, "Arial Black", Georgia, serif';
    g.fillText('CRAB DUST', 64, 80); g.fillText('CRAB DUST', 192, 80);
    tex = K.lowTex ? K.lowTex(c) : new K.THREE.CanvasTexture(c);
    if (!K.lowTex) tex.colorSpace = K.THREE.SRGBColorSpace;
  } catch (e) { return null; }
  if (tex) TIN_TEX.set(key, tex);
  return tex;
}

// ---------------- the rig ----------------
const D = { hip: 0.9, torsoY: 0.06, neckY: 0.62, legX: 0.14, thigh: 0.4, shin: 0.41, shX: 0.33, shY: 0.48, upper: 0.29, fore: 0.28 };
const C = { shell: '#3a8ad6', angry: '#d0401c', white: '#f6f4ee', cream: '#ece4d2', red: '#d23a2a', pants: '#3a3a44', clog: '#2a2a30',
  ink: '#14101f', wood: '#c8965a', woodHead: '#e6c890', lid: '#c9cdd6', tip: '#f4efe4' };

export function buildChefCrabcake(K0, opts = {}) {
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  const shellM = K.toonMat(); shellM.userData.flash = mat.userData.flash; shellM.userData.flashC = mat.userData.flashC; shellM.color.set(C.shell);
  const SH = { mat: shellM }, W = '#ffffff';
  const lod = opts.lod === 1;
  // hips / legs: dark kitchen trousers, apron skirt, black clogs
  part(J.hips, G.sph(0.24, 0.16, 0.2), C.pants, 0, 0.02, 0);
  part(J.hips, G.cyl(0.28, 0.33, 0.36, 10), C.cream, 0, -0.08, 0.02);
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.1, D.thigh - 0.1), C.pants, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.09, D.shin - 0.14), C.pants, 0, -D.shin / 2 + 0.02, 0);
    part(J['ft' + k], G.sph(0.12, 0.09, 0.2), C.clog, 0, -0.03, 0.06);
  }
  // torso: a round double-breasted chef coat, two button rows, red neckerchief, apron bib
  part(J.torso, G.sph(0.32, 0.36, 0.27), C.white, 0, 0.29, 0.01);
  for (const s of [-1, 1]) part(J.torso, G.box(0.035, 0.36, 0.03), C.ink, s * 0.09, 0.32, 0.27, { rot: [-0.18, 0, 0], outline: false, shadow: false });
  part(J.torso, G.cyl(0.17, 0.2, 0.1, 10), C.red, 0, 0.6, 0.01);
  part(J.torso, G.box(0.34, 0.3, 0.05), C.cream, 0, 0.12, 0.26, { rot: [0.1, 0, 0] });
  // head: the blue carapace as the face, lateral spines, mandibles, stalk eyes, and the tall toque
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.44, 0.26, 0.3), W, 0, 0.19, 0.04, SH);
  for (const s of [-1, 1]) part(head, G.cyl(0.0, 0.07, 0.24, 6), W, s * 0.52, 0.19, 0.05, Object.assign({ rot: [0, 0, s * -PI / 2] }, SH));
  part(head, G.box(0.26, 0.06, 0.06), C.ink, 0, 0.1, 0.32, { rot: [0.25, 0, 0], outline: false, shadow: false });   // mandible grin
  for (const s of [-1, 1]) {
    part(head, G.cap(0.035, 0.12), W, s * 0.16, 0.42, 0.18, Object.assign({ rot: [0.2, 0, s * -0.3] }, SH));
    part(head, G.sph(0.075, 0.075, 0.075), C.ink, s * 0.2, 0.54, 0.21);
  }
  part(head, G.cyl(0.17, 0.16, 0.12, 12), C.white, 0, 0.44, -0.08);                                                // toque band
  part(head, G.sph(0.22, 0.24, 0.2, 10, 7), C.white, 0, 0.66, -0.1);                                            // toque puff
  // arms: white sleeves, blue forearms, claws gripping wooden crab mallets (the mallets ride on sw groups)
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['sh' + k], G.sph(0.12, 0.12, 0.12), C.white, 0, 0, 0);
    part(J['sh' + k], G.cap(0.09, D.upper - 0.08), C.white, 0, -D.upper / 2, 0);
    part(J['el' + k], G.cap(0.085, D.fore - 0.08), W, 0, -D.fore / 2, 0, SH);
    part(J['ha' + k], G.sph(0.13, 0.14, 0.12), W, 0, -0.08, 0, SH);                                                // claw palm
    part(J['ha' + k], G.sph(0.05, 0.13, 0.06), C.tip, s * 0.08, -0.2, 0.04, { rot: [0, 0, s * 0.3] });            // pincer tip
    const sw = J['sw' + k] = grp(J['ha' + k], 0, -0.12, 0.02); sw.userData.mat = mat;
    part(sw, G.cyl(0.03, 0.035, 0.55, 7), C.wood, 0, 0.12, 0);                                                    // handle (blade axis +y, like the cane)
    part(sw, G.cyl(0.085, 0.085, 0.26, 10), C.woodHead, 0, 0.42, 0, { rot: [0, 0, PI / 2] });                     // mallet head
  }
  // the tin leg: a little blue walking leg out of his left side holding the seasoning tin (animateBoss shakes it; safe to skip)
  const tl = J.tinLeg = grp(J.torso, 0.3, 0.25, 0.14); tl.userData.mat = mat; tl.rotation.set(-0.9, 0, 0.6);
  part(tl, G.cap(0.035, 0.18), W, 0, -0.11, 0, SH);
  const tk = J.tinKnee = grp(tl, 0, -0.24, 0); tk.userData.mat = mat; tk.rotation.set(-1.2, 0, 0);
  part(tk, G.cap(0.03, 0.12), W, 0, -0.08, 0, SH);
  const tex = tinTexture(K);
  const labelM = tex ? (() => { const m = K.toonMat({ map: tex }); m.userData.flash = mat.userData.flash; m.userData.flashC = mat.userData.flashC; m.customProgramCacheKey = () => 'psxTin'; return m; })() : null;
  J.tin = part(tk, G.cyl(0.075, 0.075, 0.2, 12), labelM ? '#ffffff' : '#2f7a4a', 0, -0.26, 0.02, labelM ? { mat: labelM } : {});
  part(tk, G.cyl(0.078, 0.078, 0.04, 12), C.lid, 0, -0.14, 0.02);
  // ---- angry: steamed red (shell, claws, tin leg); blue goes through a cooking brown, never purple ----
  const b1 = new THREE.Color(C.shell), hot = new THREE.Color(C.angry), mid = new THREE.Color('#8a5a3a');
  J.angry = 0;
  J._tint = (k) => { const a = Math.max(J.angry, k); if (a < 0.5) shellM.color.copy(b1).lerp(mid, a * 2); else shellM.color.copy(mid).lerp(hot, a * 2 - 1); };   // blue -> cooking brown -> steamed red
  J.setAngry = (k) => { J.angry = Math.max(0, Math.min(1, +k || 0)); J._tint(0); };
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
const MALLET = Math.PI / 2 - 0.3;   // sw: mallet handle pointing forward-up out of the claw
export const POSES = {
  idle(t, J) {   // tapping the mallets together like drumsticks, bouncing on his clogs
    const p = J.K.blank(); J.K.legsStance(p, 0.15, 0.3); const b = Math.sin(t * 3.4); p.y += 0.02 * b;
    p.torso = [0.05, 0.15, 0]; p.neck = [0, -0.15, 0]; p.hips = [0, -0.12, 0];
    p.shL = [-0.35, 0, 0.5]; p.elL = [-1.0 - 0.15 * b, 0, 0]; p.swL = [MALLET - 0.2, 0, 0.55];
    p.shR = [-0.35, 0, -0.5]; p.elR = [-1.0 + 0.15 * b, 0, 0]; p.swR = [MALLET - 0.2, 0, -0.55];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (6 + sp); K.runLegs(p, ph, cl(sp / 4.5, 0.4, 1));
    p.torso = [0.25, Math.sin(ph) * 0.18, 0]; p.neck = [-0.15, -Math.sin(ph) * 0.12, 0];
    p.shL = [0.7 * Math.sin(ph) - 0.3, 0, 0.25]; p.shR = [-0.7 * Math.sin(ph) - 0.3, 0, -0.25]; p.elL = p.elR = [-1.2, 0, 0];
    p.swL = [MALLET, 0, 0]; p.swR = [MALLET, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.15, 0.45); const k = 1 - u;
    p.torso = [-0.5 * k, 0.25 * k, 0]; p.neck = [-0.5 * k, 0, 0]; p.shL = [-0.7, 0, 0.9]; p.shR = [-0.7, 0, -0.9]; p.elL = p.elR = [-0.7, 0, 0];
    p.swL = [MALLET + 0.4, 0, 0]; p.swR = [MALLET + 0.4, 0, 0];
    return p;
  },
  down(u, ground, J) {
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.36 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.3, 0, 0.7]; p.shR = [-2.1, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.55, 0, 0];
    p.swL = [Math.PI / 2, 0, 0]; p.swR = [Math.PI / 2, 0, 0];
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.08) * cl(u * 2.2), 0, 0];
    return p;
  },
  // atk1 seasoning blind: winds the tin leg back and twists away, then lunges in and fans the cloud at Harold's face with the left mallet
  atk1(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.18, 0.45); const w = ez(cl(u / 0.38)), f = ez(cl((u - 0.4) / 0.14)), rec = ez(cl((u - 0.78) / 0.22));
    p.torso = [lp(lp(0.05, -0.15, w), 0.45, f) - rec * 0.3, lp(lp(0.15, 0.7, w), -0.4, f) * (1 - rec), 0]; p.neck = [lp(0, -0.25, f), lp(-0.3, 0.3, f), 0];
    p.shL = [lp(lp(-0.55, -0.3, w), -1.5, f), 0, lp(lp(0.35, 1.3, w), 0.15, f)]; p.elL = [lp(-1.25, -0.25, f), 0, 0]; p.swL = [MALLET, 0, 0.3];
    p.shR = [-0.4, 0, -0.45]; p.elR = [-1.6, 0, 0]; p.swR = [MALLET, 0, 0];
    p.lgL = [-0.7, 0, 0.18]; p.knL = [0.75, 0, 0]; p.lgR = [0.35, 0, -0.18];
    return p;
  },
  // atk2 mallet drumroll: both mallets high, then alternating overhead smashes, right (u 0.44) then left (u 0.6)
  atk2(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.2, 0.5); const up = ez(cl(u / 0.36)), r1 = ez(cl((u - 0.38) / 0.08)), l1 = ez(cl((u - 0.54) / 0.08)), rec = ez(cl((u - 0.82) / 0.18));
    p.torso = [lp(0.05, -0.2, up) + r1 * 0.35 + l1 * 0.1 - rec * 0.25, (r1 - l1) * 0.25, 0]; p.neck = [-0.2 * up + 0.2 * r1, 0, 0];
    p.shR = [lp(-0.55, -2.8, up) + r1 * 2.0 - l1 * 0.6 + rec * 0.6, 0, -0.25]; p.elR = [lp(-1.25, -0.6, up) + r1 * 0.45, 0, 0]; p.swR = [MALLET, 0, 0];
    p.shL = [lp(-0.55, -2.6, up) - r1 * 0.3 + l1 * 2.2 + rec * 0.3, 0, 0.25]; p.elL = [lp(-1.25, -0.6, up) + l1 * 0.45, 0, 0]; p.swL = [MALLET, 0, 0];
    return p;
  },
  // atk3 sidestep sweep: a crabwise sidestep to the left, then a flat backhand sweep of the right mallet across 190 degrees
  atk3(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.26, 0.5); const w = ez(cl(u / 0.34)), s = ez(cl((u - 0.38) / 0.18)), rec = ez(cl((u - 0.8) / 0.2));
    p.hips = [0, lp(0.5 * w, -0.6, s) * (1 - rec), 0]; p.torso = [0.15, lp(lp(0.1, 0.9, w), -1.0, s) * (1 - rec), 0]; p.neck = [0, lp(-0.5 * w, 0.6, s) * (1 - rec), 0];
    p.shR = [lp(-0.55, -1.45, w), 0, lp(lp(-0.35, 0.6, w), -1.3, s) * (1 - rec * 0.7)]; p.elR = [lp(lp(-1.25, -1.0, w), -0.15, s), 0, 0]; p.swR = [MALLET, 0, lp(0, -0.6, s)];
    p.shL = [-0.5, 0, 0.6]; p.elL = [-1.4, 0, 0]; p.swL = [MALLET, 0, 0.3];
    p.lgL = [-0.4, 0, 0.35 + 0.15 * w]; p.knL = [0.6, 0, 0]; p.lgR = [-0.3, 0, -0.3]; p.knR = [0.55, 0, 0];
    return p;
  },
};

// optional (safe to skip): the tin leg shakes the seasoning (fast in atk1), the windup flush steams the shell
export function animateBoss(J, t, state, u = 0) {
  if (J.tinLeg) {
    const a = state === 'atk1' ? ez(cl((u - 0.36) / 0.12)) * (1 - ez(cl((u - 0.8) / 0.2))) : 0;
    J.tinLeg.rotation.set(-0.9 - 0.9 * a, 0, 0.6 - 0.3 * a); J.tinKnee.rotation.x = -1.2 + 0.9 * a + Math.sin(t * (a ? 40 : 3)) * (a ? 0.25 : 0.05);
  }
  let flush = 0;
  for (const A of ATTACKS) if (state === A.pose) flush = u < A.active[0] ? cl(u / Math.max(A.active[0], 1e-3)) : cl(1 - (u - A.active[1]) / 0.2);
  if (J._tint) J._tint(flush * 0.35);
}

// boss_voltage_vic.js — Toad City Baltimore, Task D boss 9 of 17 (batch 2, O6): Voltage Vic, the Power Plant.
// tcr2 o6 redclaw-rocket
// An electric-eel DJ: long olive eel head with a pale jaw and a fin crest, magenta headphones, a cyan LED visor, a black track suit
// with electric-yellow stripes and a lightning-bolt pendant, white high-tops. Sparks crackle round his hands (night glow).
// Original character: no real DJ, label, brand or logo.
// Contract: TASK_D_bosses.md + O6 brief + J-003 Q-d: ATTACKS sit on whole beats at 130 BPM (0.4615 s a beat) for the brawl version;
//   buildVoltageVic({ THREE, stage: true }) is the rhythm-mode hook (adds his DJ booth), and J.pose(name, u) lets that mode drive
//   idle / atk1..3 at any tempo (u = 0..1 through the move; for idle u is the time in seconds).

const BEAT = 60 / 130;
export const META = { id: 'voltage_vic', name: 'Voltage Vic', district: 'powerplant', hp: 120, scale: 1.12, radius: 0.75, height: 2.5, bpm: 130 };
export const ATTACKS = [   // dur = whole beats; windup / active start on a beat
  { id: 'bass_drop', pose: 'atk1', dur: 2 * BEAT, windup: 0.5, active: [0.5, 0.66], reach: 3.2, arc: 360, dmg: 14, fx: 'shock_ring', strike: 'haR', beats: 2 },
  { id: 'zap_scratch', pose: 'atk2', dur: 2 * BEAT, windup: 0.5, active: [0.5, 0.75], reach: 7, arc: 25, dmg: 11, fx: 'lightning_bolt', strike: 'haR', beats: 2 },
  { id: 'club_spin', pose: 'atk3', dur: 3 * BEAT, windup: 1 / 3, active: [1 / 3, 2 / 3], reach: 2.4, arc: 360, dmg: 12, fx: 'spark_spin', strike: 'haL', beats: 3 },
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
const D = { hip: 0.92, torsoY: 0.06, neckY: 0.6, legX: 0.13, thigh: 0.42, shin: 0.41, shX: 0.29, shY: 0.5, upper: 0.3, fore: 0.28 };
const C = { skin: '#4f8f74', jaw: '#e6e08a', jacket: '#4a2f8a', yellow: '#ffe14d', pants: '#2c2050', shoe: '#f2f2f2', sole: '#7dff6a',
  phones: '#ff3fa4', band: '#2a2833', visor: '#5ff3ff', spark: '#c8fbff', ink: '#14101f', chain: '#e8c040', booth: '#2a2a36', deck: '#3a3a48', vinyl: '#141218' };

export function buildVoltageVic(K0, opts = {}) {
  const hook = !(K0 && K0.part && K0.skeleton);
  if (hook) opts = Object.assign({}, K0, opts);
  const K = kitFrom(K0), { G, part, grp, THREE } = K, PI = Math.PI;
  const mat = K.toonMat(); const J = K.skeleton(D, mat); J.K = K;
  // one glow material for every spark / LED: opacity follows K.NIGHT (animateBoss), shares the flash uniforms like every sub-material
  const glowM = K.basicMat({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  glowM.userData.flash = mat.userData.flash; glowM.userData.flashC = mat.userData.flashC;
  const GL = { mat: glowM, outline: false, shadow: false };
  const lod = opts.lod === 1;
  // hips + legs: track pants with a yellow side stripe, white high-tops with neon soles
  part(J.hips, G.sph(0.22, 0.15, 0.17), C.pants, 0, 0.02, 0);
  part(J.hips, G.cyl(0.235, 0.235, 0.06, 12), C.yellow, 0, 0.1, 0, { outline: false, shadow: false });
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['lg' + k], G.cap(0.1, D.thigh - 0.1), C.pants, 0, -D.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.09, D.shin - 0.14), C.pants, 0, -D.shin / 2 + 0.02, 0);
    if (!lod) part(J['lg' + k], G.box(0.03, D.thigh, 0.03), C.yellow, s * 0.1, -D.thigh / 2, 0, { outline: false, shadow: false });
    part(J['ft' + k], G.sph(0.12, 0.1, 0.2), C.shoe, 0, -0.02, 0.06);
    part(J['ft' + k], G.box(0.22, 0.04, 0.38), C.sole, 0, -0.09, 0.06, { outline: false, shadow: false });
  }
  // torso: zipped track jacket, yellow stripes, gold chain with an original bolt pendant, the eel's dorsal fin up the back
  part(J.torso, G.sph(0.27, 0.34, 0.21), C.jacket, 0, 0.3, 0);
  part(J.torso, G.box(0.03, 0.5, 0.03), C.yellow, 0, 0.3, 0.205, { outline: false, shadow: false });
  for (const s of [-1, 1]) part(J.torso, G.box(0.035, 0.52, 0.05), C.yellow, s * 0.22, 0.3, 0.1, { rot: [0, 0, s * 0.12], outline: false, shadow: false });
  part(J.torso, G.cyl(0.15, 0.19, 0.12, 12), C.jacket, 0, 0.6, 0);
  part(J.torso, G.tor(0.13, 0.016), C.chain, 0, 0.52, 0.1, { rot: [PI / 2 - 0.5, 0, 0], shadow: false });
  part(J.torso, G.box(0.07, 0.12, 0.03), C.chain, 0, 0.4, 0.215, { rot: [0, 0, 0.35] });
  part(J.torso, G.sph(0.025, 0.26, 0.11), C.skin, 0, 0.5, -0.24, { rot: [-0.35, 0, 0] });                    // dorsal fin
  // head: a long eel head on a long neck, pale underjaw, a wide grin, fin crest, headphones and the LED visor
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.cap(0.1, 0.16), C.skin, 0, 0.08, 0);
  part(head, G.sph(0.16, 0.16, 0.33), C.skin, 0, 0.28, 0.1);
  part(head, G.sph(0.13, 0.075, 0.3), C.jaw, 0, 0.19, 0.15);
  part(head, G.box(0.2, 0.022, 0.04), C.ink, 0, 0.215, 0.4, { rot: [0.15, 0, 0], outline: false, shadow: false });
  part(head, G.sph(0.022, 0.13, 0.17), C.skin, 0, 0.45, -0.06, { rot: [0.5, 0, 0] });                         // fin crest
  part(head, G.tor(0.19, 0.025, PI), C.band, 0, 0.3, -0.02, { rot: [0, PI / 2, 0] });
  for (const s of [-1, 1]) part(head, G.cyl(0.085, 0.085, 0.07, 10), C.phones, s * 0.19, 0.28, -0.02, { rot: [0, 0, PI / 2] });
  part(head, G.box(0.3, 0.06, 0.05), C.ink, 0, 0.34, 0.3, { rot: [0.15, 0, 0] });                               // visor frame
  part(head, G.box(0.26, 0.035, 0.02), C.visor, 0, 0.34, 0.328, Object.assign({ rot: [0.1, 0, 0] }, GL));     // visor LEDs (glow)
  // arms: track sleeves with yellow cuffs, eel-skin hands with a fin on each forearm
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    part(J['sh' + k], G.sph(0.1, 0.1, 0.1), C.jacket, 0, 0, 0);
    part(J['sh' + k], G.cap(0.08, D.upper - 0.08), C.jacket, 0, -D.upper / 2, 0);
    part(J['el' + k], G.cap(0.07, D.fore - 0.08), C.jacket, 0, -D.fore / 2, 0);
    part(J['el' + k], G.cyl(0.075, 0.075, 0.04, 10), C.yellow, 0, -D.fore + 0.05, 0, { shadow: false });
    if (!lod) part(J['el' + k], G.box(0.12, 0.14, 0.02), C.skin, s * 0.07, -0.16, -0.04, { rot: [0, 0.3 * s, s * 0.5], shadow: false });
    part(J['ha' + k], G.sph(0.095, 0.09, 0.1), C.skin, 0, -0.03, 0);
    // sparks: two bolts per hand (zig-zag pairs of thin boxes), glow parts on a sub-group so animateBoss can flicker them
    const sw = J['sw' + k] = grp(J['ha' + k], 0, -0.05, 0); sw.userData.mat = mat;
    for (const [a, l] of [[0.6, 0.2], [-0.9, 0.17]]) {
      part(sw, G.box(0.025, l, 0.025), C.spark, s * Math.sin(a) * 0.12, -Math.cos(a) * 0.12, 0.03, Object.assign({ rot: [0.4, 0, a + s * 0.5] }, GL));
      part(sw, G.box(0.025, l * 0.8, 0.025), C.spark, s * Math.sin(a) * 0.22, -Math.cos(a) * 0.22, 0.05, Object.assign({ rot: [0.4, 0, a - s * 0.5] }, GL));
    }
  }
  // the DJ booth (rhythm-mode stage only): a deck table with two turntables and a mixer, in front of him, under J.tilt
  if (opts.stage) {
    const b = J.booth = grp(J.tilt, 0, 0, 0.62); b.userData.mat = mat;
    part(b, G.box(1.5, 0.9, 0.5), C.booth, 0, 0.45, 0);
    part(b, G.box(1.56, 0.06, 0.56), C.deck, 0, 0.92, 0);
    for (const s of [-1, 1]) { part(b, G.cyl(0.24, 0.24, 0.04, 14), C.vinyl, s * 0.45, 0.97, 0); part(b, G.cyl(0.05, 0.05, 0.05, 8), C.yellow, s * 0.45, 0.99, 0, { shadow: false }); }
    part(b, G.box(0.3, 0.06, 0.34), C.band, 0, 0.97, 0);
    part(b, G.box(1.3, 0.05, 0.02), C.visor, 0, 0.62, 0.26, GL);                                               // front LED strip (glow)
  }
  J.glowMat = glowM;
  J.gapPairs = [['torso', 'neck']];
  J.kind = 'boss'; J.meta = META;
  // rhythm-mode driver (J-003 Q-d): snap a named pose; u is 0..1 through the move (idle: u is time in seconds)
  J.pose = (name, u = 0, t) => {
    const P = POSES, tt = t ?? u, p = name === 'idle' ? P.idle(tt, J) : name === 'run' ? P.run(tt, 5, J) : name === 'down' ? P.down(u, true, J) : (P[name] || P.idle)(u, J);
    K.applyPose(J, p, 1e4, 1, true); animateBoss(J, tt, name, u); return J;
  };
  if (hook) J.pose('idle', 0);
  return J;
}

// ---------------- poses ----------------
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lp = (a, b, t) => a + (b - a) * t, ez = (t) => t * t * (3 - 2 * t);
const W = Math.PI * 2 * 130 / 60 / 2;   // half-time bounce: one nod every two beats
export const POSES = {
  idle(t, J) {   // nodding to the half-time beat, left hand cupping the headphone, right hand riding a fader
    const p = J.K.blank(); J.K.legsStance(p, 0.14, 0.32); const b = Math.abs(Math.sin(t * W)); p.y += -0.03 * b;
    p.torso = [0.08 + 0.06 * b, 0.25, 0]; p.neck = [-0.05 + 0.18 * b, -0.25, 0]; p.hips = [0, -0.2, 0];
    p.shL = [-1.0, 0, 1.05]; p.elL = [-2.1, 0, 0]; p.haL = [0, 0, 0.4];
    p.shR = [-0.7, 0, -0.25]; p.elR = [-1.2 + 0.2 * Math.sin(t * W * 2), 0, 0]; p.haR = [0.4, 0, 0];
    return p;
  },
  run(t, sp, J) {
    const K = J.K, p = K.blank(), ph = t * (6 + sp); K.runLegs(p, ph, cl(sp / 4.5, 0.4, 1));
    p.torso = [0.25, Math.sin(ph) * 0.2, 0]; p.neck = [-0.15, -Math.sin(ph) * 0.15, 0];
    p.shL = [0.8 * Math.sin(ph), 0, 0.2]; p.shR = [-0.8 * Math.sin(ph), 0, -0.2]; p.elL = p.elR = [-1.2, 0, 0];
    return p;
  },
  hurt(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.14, 0.45); const k = 1 - u;
    p.torso = [-0.55 * k, 0.3 * k, 0]; p.neck = [-0.6 * k, 0, 0]; p.shL = [-0.6, 0, 0.9]; p.shR = [-0.6, 0, -0.9]; p.elL = p.elR = [-0.8, 0, 0];
    return p;
  },
  down(u, ground, J) {
    const p = J.K.blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.34 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.4, 0, 0.7]; p.shR = [-2.2, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0];
    if (!ground) p.tilt = [(-Math.PI / 2 + 0.08) * cl(u * 2.2), 0, 0];
    return p;
  },
  // atk1 bass drop: beat 1 raise both fists high and rise on the toes; beat 2 (u 0.5) slam both fists down in a squat
  atk1(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.2, 0.3); const up = ez(cl(u / 0.44)), dn = ez(cl((u - 0.48) / 0.1)), rec = ez(cl((u - 0.8) / 0.2));
    p.y = lp(lp(-0.064, 0.02, up), -0.12, dn) + rec * 0.07;
    p.lgL = [lp(-0.15, -0.6, dn), 0, 0.25]; p.knL = [lp(0.3, 1.0, dn), 0, 0]; p.lgR = [lp(-0.1, -0.6, dn), 0, -0.25]; p.knR = [lp(0.27, 1.0, dn), 0, 0];
    p.torso = [lp(lp(0.05, -0.25, up), 0.55, dn) - rec * 0.3, 0, 0]; p.neck = [lp(0.2, -0.3, dn), 0, 0];
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) { p['sh' + k] = [lp(lp(-0.6, -2.9, up), -0.7, dn) + rec * 0.2, 0, s * lp(0.25, 0.3, up)]; p['el' + k] = [lp(lp(-1.0, -0.3, up), -0.2, dn), 0, 0]; }
    return p;
  },
  // atk2 zap scratch: beat 1 the left hand scratches at chest height while the right arm cocks back; beat 2 the right arm fires
  // straight at the target (the bolt) and holds while the left keeps scratching
  atk2(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.18, 0.4); const cock = ez(cl(u / 0.4)), fire = ez(cl((u - 0.47) / 0.08)), rec = ez(cl((u - 0.85) / 0.15));
    p.torso = [0.1, lp(lp(0.2, 0.7, cock), -0.35, fire) + rec * 0.4, 0]; p.hips = [0, lp(0.2, -0.3, fire), 0]; p.neck = [0, lp(lp(-0.2, -0.6, cock), 0.3, fire), 0];
    p.shR = [lp(lp(-0.6, -1.2, cock), -1.55, fire) + rec * 0.6, 0, lp(lp(-0.3, -1.2, cock), -0.05, fire)]; p.elR = [lp(lp(-1.0, -2.0, cock), -0.05, fire) - rec * 0.6, 0, 0];
    p.shL = [-0.9, 0, 0.55]; p.elL = [-1.8, 0, 0]; p.haL = [0, Math.sin(u * 40) * 0.5, 0];
    p.lgL = [-0.6, 0, 0.18]; p.knL = [0.6, 0, 0]; p.lgR = [0.3, 0, -0.18];
    return p;
  },
  // atk3 club spin: beat 1 crouch with arms wrapped; beats 2-3 a full electrified spin (hips carry the turn), arms flung wide
  atk3(u, J) {
    const p = J.K.blank(); J.K.legsStance(p, 0.2, 0.45); const wr = ez(cl(u / 0.3)), sp = ez(cl((u - 1 / 3) / (1 / 3))), out = ez(cl((u - 0.3) / 0.08)), rec = ez(cl((u - 0.75) / 0.25));
    p.hips = [0, lp(0.6 * wr, -Math.PI * 2, sp), 0]; p.torso = [lp(0.3 * wr, 0.05, out), 0, 0]; p.y = -0.05 * wr * (1 - out) - 0.04;
    for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
      p['sh' + k] = [lp(-0.9, -0.15, out) + rec * -0.4, 0, s * lp(lp(0.3, -0.1, wr), 1.45, out) * (1 - rec * 0.5)];
      p['el' + k] = [lp(lp(-1.0, -2.0, wr), -0.1, out), 0, 0];
    }
    return p;
  },
};

// glow: visor / sparks / booth strip fade in with K.NIGHT and flare on the active beats of every attack; sparks flicker
export function animateBoss(J, t, state, u = 0) {
  if (!J.glowMat) return;
  const night = (J.K.NIGHT && J.K.NIGHT.value) || 0;
  let flare = 0; for (const a of ATTACKS) if (state === a.pose) flare = u >= a.active[0] - 0.05 && u <= a.active[1] + 0.1 ? 1 : 0;
  J.glowMat.opacity = cl(Math.max(night * 0.9, flare)) * (0.75 + 0.25 * Math.abs(Math.sin(t * 23)));
  for (const k of ['swL', 'swR']) if (J[k]) J[k].rotation.y = Math.sin(t * 17 + (k === 'swL' ? 0 : 2)) * 0.6;
}

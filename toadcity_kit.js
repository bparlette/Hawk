// toadcity_kit.js — Toad City Baltimore: the shared character / prop kit (HD cel-shaded path only).
// This is a faithful standalone copy of the game's own materials, outline method and rig code (three.js r160),
// so modules built against it drop straight into the game. Deliveries NEVER import anything: they receive this object as `K`.
//
// REBUILD NOTE: toadcity_starter_kit.zip was not supplied with the brief, so this file was rebuilt from the brief's
// appendix ("Kit core (characters)"). Everything printed in the appendix is copied verbatim. Sections the appendix
// marks as omitted ("…") are replaced by small stand-ins tagged [reconstructed]; they exist only so the viewer runs.
// Swap in the zip copy of this file when you have it — the delivered modules only use the verbatim parts.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const ease = (t) => t * t * (3 - 2 * t);
const QUAL = { hd: true, outlines: [], texs: [] };   // the game runs HD by default; the kit is HD-only
const INK = '#14101f';                              // the one ink colour: outlines, shadows on signs, dark trims
const NIGHT = { value: 0 };                         // 0 day .. 1 night (the game drives it; viewers set it)

// ---- toon (cel) material: MeshLambert + vertex colours + 3 hard bands + a hit-flash uniform ----
function toonMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC;')
      .replace('#include <opaque_fragment>', `
        { // HD cel bands: shadow 0.46 / mid 0.78 / lit 1.06 of the base colour, hard edges; shadows tinted cool
          float ld = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3), lo = dot(outgoingLight, vec3(0.299, 0.587, 0.114)), r = lo / ld;
          float b = mix(0.46, 0.78, smoothstep(0.38, 0.44, r)); b = mix(b, 1.06, smoothstep(0.86, 0.92, r)); b = mix(b, r, step(1.35, r));
          outgoingLight *= b / max(r, 1e-3);
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.88, 0.86, 1.1), (1.0 - smoothstep(0.38, 0.44, r)) * 0.5); }
        outgoingLight = mix(outgoingLight, uFlashC, uFlash);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'psx' + (opts.map ? 'M' : '');
  return m;
}
// unlit material for neon, glows and lamp heads (night-only things fade with opacity)
function basicMat(opts) { return new THREE.MeshBasicMaterial(opts); }
// ---- ink outlines: inverted hulls. Back faces pushed out along a mitred direction (attribute `odir`), width ~constant on screen ----
const OUT_U = { fogC: { value: new THREE.Color('#000') }, fogN: { value: 100 }, fogF: { value: 200 } };
function outlineMat(w) {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color(INK) }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wd = mat3(modelMatrix) * odir;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}
// the three shared outline widths: city 0.0034, characters 0.0042, props 0.0030 (fraction of camera distance, clamped 2.5..36 m)
const OUT_CITY = outlineMat(0.0034), OUT_CHAR = outlineMat(0.0042), OUT_PROP = outlineMat(0.0030);
function addOdir(g) {
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
  const o = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const d = res.get(keys[i]); o[i * 3] = d[0]; o[i * 3 + 1] = d[1]; o[i * 3 + 2] = d[2]; }
  g.setAttribute('odir', new THREE.BufferAttribute(o, 3));
  return g;
}
function bakeColor(g, col) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// canvas -> texture (the game draws every texture on a canvas at load: no image files). HD = full-size source, trilinear mipmaps.
function lowTex(src) {
  const t = new THREE.CanvasTexture(src); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.userData.src = src; QUAL.texs.push(t); return t;
}

// ---- [reconstructed] shared city materials, light presets and the prop collector (omitted from the appendix) ----
// Values follow the brief's "Night lighting rules" table. The real game versions live in the zip copy of this file.
const CITY_MAT = toonMat();
const GLOW_MAT = basicMat({ vertexColors: true, transparent: true, opacity: 0 });
const LIGHT = {
  day: { sky: '#9cc4dc', fog: '#b4c0c6', hemi: ['#dfe6ff', '#8a7f74', 1.45], sun: ['#fff3dc', 2.1, [-0.5, 1.7, 0.42]], night: 0 },
  dusk: { sky: '#b0706a', fog: '#8a6060', hemi: ['#ffb08a', '#5a4040', 0.85], sun: ['#ff9a58', 1.25, [-1, 0.32, -0.25]], night: 0.5 },
  night: { sky: '#0a0f1a', fog: '#0b0f17', hemi: ['#4a5a88', '#14141c', 0.32], sun: ['#8aa0e8', 0.45, [0.45, 1.2, -0.9]], night: 1 },
};
// rig = { scene, hemi: HemisphereLight, sun: DirectionalLight }; sets sky, fog (also the outline fog), lights and NIGHT
function applyLight(rig, name) {
  const L = LIGHT[name] || LIGHT.day;
  rig.scene.background = new THREE.Color(L.sky);
  if (rig.scene.fog) rig.scene.fog.color.set(L.fog);
  OUT_U.fogC.value.set(L.fog);
  rig.hemi.color.set(L.hemi[0]); rig.hemi.groundColor.set(L.hemi[1]); rig.hemi.intensity = L.hemi[2];
  rig.sun.color.set(L.sun[0]); rig.sun.intensity = L.sun[1];
  rig.sun.position.set(L.sun[2][0], L.sun[2][1], L.sun[2][2]).normalize().multiplyScalar(30);
  NIGHT.value = L.night;
}

// ---------------- characters: procedural stylised rigs (groups of toon parts with outline hulls) ----------------
const G = { // low-poly on purpose (32-bit era budgets)
  sph: (rx, ry, rz, ws = 8, hs = 6) => new THREE.SphereGeometry(1, QUAL.hd ? Math.max(ws * 2, 18) : Math.min(ws, 9), QUAL.hd ? Math.max(hs * 2, 12) : Math.min(hs, 7)).scale(rx, ry, rz),
  cap: (r, len, rs = 6) => new THREE.CapsuleGeometry(r, len, QUAL.hd ? 4 : 2, QUAL.hd ? 12 : Math.min(rs, 6)),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, QUAL.hd ? Math.max(s * 2, 14) : Math.min(s, 8), 1, open),
  tor: (R, r, arc = TAU) => new THREE.TorusGeometry(R, r, QUAL.hd ? 6 : 3, QUAL.hd ? 16 : 7, arc),
};
function part(parent, geom, col, x = 0, y = 0, z = 0, o = {}) {
  bakeColor(geom, col); const ol = o.outline !== false && geom.attributes.normal;
  if (ol) addOdir(geom);
  const m = new THREE.Mesh(geom, o.mat || parent.userData.mat || parent.parent?.userData.mat);
  m.position.set(x, y, z); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (ol) { const h = new THREE.Mesh(geom, o.olMat || OUT_CHAR); h.castShadow = false; h.visible = QUAL.hd; m.add(h); QUAL.outlines.push(h); }
  geom.computeBoundingSphere(); m.castShadow = o.shadow !== false && geom.boundingSphere.radius > 0.1; parent.add(m);
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
const HERO_D = { hip: 0.64, torsoY: 0.05, neckY: 0.58, legX: 0.17, thigh: 0.3, shin: 0.29, shX: 0.37, shY: 0.42, upper: 0.25, fore: 0.23 };
// [reconstructed] buildHero (Harold / Mavis) is omitted from the appendix and not rebuilt here.
const THUG_D = { hip: 0.92, torsoY: 0.06, neckY: 0.64, legX: 0.13, thigh: 0.42, shin: 0.41, shX: 0.31, shY: 0.52, upper: 0.3, fore: 0.27 };
// [reconstructed] buildThug: the opening is the real excerpt from the brief (src/04_actors.js); limbs and face are a
// stand-in so the viewer can show the current plain thug next to new work for scale.
function buildThug(look = {}) {
  look = Object.assign({ jacket: '#6a3fb0', pants: '#2f4f8f', skin: '#c08a60', big: false }, look);
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
  for (const s of [-1, 1]) {
    part(head, G.box(0.05, 0.035, 0.02), INK, s * 0.07, 0.24, 0.17, { outline: false });
    part(head, G.box(0.08, 0.02, 0.02), INK, s * 0.07, 0.29, 0.165, { rot: [0, 0, s * 0.3], outline: false });
  }
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.cap(0.08, d.upper - 0.06), jacket, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(0.065, d.fore - 0.06), jacket, 0, -d.fore / 2, 0);
    part(J['ha' + k], G.sph(0.08, 0.08, 0.08), skin, 0, -0.04, 0);
    part(J['lg' + k], G.cap(0.09, d.thigh - 0.08), pants, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.075, d.shin - 0.08), pants, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.box(0.14, 0.09, 0.26), '#3a3040', 0, -0.03, 0.05);
  }
  J.kind = 'thug'; return J;
}
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
// HERO_POSES: the appendix omits this table. `down` below is the REAL one from the game's src/04_actors.js (supplied after
// gang 1's review); idle and run are [reconstructed] stand-ins so the table is not empty.
const HERO_POSES = {
  idle(t) { const p = blank(); legsStance(p, 0.1, 0.15); p.y += Math.sin(t * 2) * 0.01; p.shL = [0.1, 0, 0.15]; p.shR = [0.1, 0, -0.15]; return p; },
  run(t, sp) { const p = blank(), ph = t * (6 + sp); runLegs(p, ph, clamp(sp / 4.5, 0.4, 1)); p.torso = [0.15, 0, 0]; p.shL = [0.7 * Math.sin(ph), 0, 0.1]; p.shR = [-0.7 * Math.sin(ph), 0, -0.1]; return p; },
  down(u, ground) {
    const p = blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.3 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.6, 0, 0.6]; p.shR = [-2.4, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0];
    p.swL = [Math.PI / 2, 0, 0]; p.swR = [Math.PI / 2, 0, 0];
    if (!ground) { p.tilt = [-Math.PI / 2 * clamp(u * 2.2, 0, 1), 0, 0]; }
    return p;
  },
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
  // dizzy: the game's own code (added in-house after gang 3; the game called it before it existed), copied exactly
  dizzy(t, J) { // t = seconds in state, played at rate 10
    const p = blank(); legsStance(p, 0.16, 0.35); const w = Math.sin(t * 5.5), w2 = Math.sin(t * 3.1 + 1);
    p.hips = [0, 0, 0.08 * w]; p.torso = [0.25 + 0.06 * w2, 0.15 * w2, -0.18 * w]; p.neck = [0.35, 0.2 * w2, 0.3 * w];
    p.shL = [0.1, 0, 0.35 + 0.15 * w]; p.shR = [0.1, 0, -0.35 + 0.15 * w]; p.elL = [-0.35, 0, 0]; p.elR = [-0.35, 0, 0];
    if (J && J.swR) p.swR = [Math.PI / 2 - 0.2, 0, 0];
    return p;
  },
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

// ---- [reconstructed] static-geometry collector (omitted from the appendix). Minimal stand-in: place() records the
// geometry in the right bucket; build() merges nothing and just adds meshes. Not used by character modules.
function place(geom, x = 0, y = 0, z = 0, ry = 0) { geom.rotateY(ry); geom.translate(x, y, z); return geom; }
function makeOut() {
  const out = { solid: [], glow: [], decal: [], coll: [], bld: [], lamp: [], hook: [] };
  out.lamp = (x, y, z) => out.hook.push({ lamp: [x, y, z] });
  out.build = (parent) => { for (const [k, mat] of [['solid', CITY_MAT], ['glow', GLOW_MAT]]) for (const g of out[k]) part(parent, g, '#ffffff', 0, 0, 0, { mat, olMat: OUT_PROP }); return parent; };
  return out;
}
function makeAtlas(tiles) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  (tiles || []).forEach((f, i) => { x.save(); x.translate((i % 4) * 256, Math.floor(i / 4) * 256); f(x, 256); x.restore(); });
  return lowTex(c);
}

export const K = {
  THREE, TAU, clamp, lerp, damp, wrapA, ease, QUAL, INK, NIGHT,
  toonMat, basicMat, OUT_U, outlineMat, OUT_CITY, OUT_CHAR, OUT_PROP, addOdir, bakeColor, lowTex,
  CITY_MAT, GLOW_MAT, LIGHT, applyLight,
  G, part, grp, skeleton, HERO_D, THUG_D, buildThug, JOINTS, blank, legsStance, runLegs, SWF, HERO_POSES, THUG_POSES, applyPose,
  place, makeOut, makeAtlas,
};

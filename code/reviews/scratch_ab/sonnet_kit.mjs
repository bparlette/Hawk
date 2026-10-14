// toadcity_kit.js — Toad City Baltimore: the shared character / prop kit (HD cel-shaded path only).
// This is a faithful standalone copy of the game's own materials, outline method and rig code (three.js r160),
// so modules built against it drop straight into the game. Deliveries NEVER import anything: they receive this object as `K`.
//
// RECONSTRUCTION NOTE: the starter zip was missing, so this file was rebuilt from Appendix A of the brief.
// The prop / city core (toonMat, outlines, part, place, makeOut, makeAtlas, ...) is the appendix text verbatim.
// The sections the appendix marks with "…" (rig + poses, lighting presets) are re-created here so the viewer runs;
// they follow the numbers printed in the brief (palette table, night-lighting table, rig joint names) but are NOT
// the game's own tables. Drop the real toadcity_kit.js over this file when you have it: the modules in src/ only
// use members that are in the appendix (see README "Kit members used").
import * as THREE from '/workspace/work/toad-city/game/site/three.module.min.js';

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

// ---- world constants (brief section 1) ----
const CURB = 0.16, GF = 4.4, FH = 3.4, PAR = 1.3, WY = -0.85;

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

// ---- RECONSTRUCTED (appendix marks this "…"): rig proportions, skeleton, poses -----------------------------------
// d = { hip, torsoY, neckY, shY, shX, legX, thigh, shin, up, lo }  (metres)
const HERO_D = { hip: 0.62, torsoY: 0.06, neckY: 0.5, shY: 0.4, shX: 0.22, legX: 0.1, thigh: 0.3, shin: 0.3, up: 0.26, lo: 0.24 };
const THUG_D = { hip: 0.92, torsoY: 0.08, neckY: 0.66, shY: 0.54, shX: 0.31, legX: 0.14, thigh: 0.45, shin: 0.45, up: 0.36, lo: 0.34 };
const JOINTS = ['tilt', 'hips', 'torso', 'neck', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'lgL', 'lgR', 'knL', 'knR', 'ftL', 'ftR', 'swL', 'swR'];
function skeleton(d, mat) {
  const J = new THREE.Group(); J.userData.mat = mat; J.mat = mat; J.tilt = J; J.d = d;
  const mk = (parent, x, y, z) => { const g = grp(parent, x, y, z); g.userData.mat = mat; return g; };
  J.hips = mk(J, 0, d.hip, 0); J.torso = mk(J.hips, 0, d.torsoY, 0); J.neck = mk(J.torso, 0, d.neckY, 0);
  for (const [s, k] of [[-1, 'L'], [1, 'R']]) {
    J['sh' + k] = mk(J.torso, s * d.shX, d.shY, 0); J['el' + k] = mk(J['sh' + k], 0, -d.up, 0); J['ha' + k] = mk(J['el' + k], 0, -d.lo, 0); J['sw' + k] = mk(J['ha' + k], 0, 0, 0);
    J['lg' + k] = mk(J.hips, s * d.legX, 0, 0); J['kn' + k] = mk(J['lg' + k], 0, -d.thigh, 0); J['ft' + k] = mk(J['kn' + k], 0, -d.shin, 0);
  }
  return J;
}
const blank = () => { const p = { hipsY: 0 }; for (const j of JOINTS) p[j] = [0, 0, 0]; return p; };
function legsStance(p, w = 0.1) { p.lgL = [0, 0, -w]; p.lgR = [0, 0, w]; return p; }
function runLegs(p, ph, amp = 0.9) {
  const s = Math.sin(ph); p.lgL = [s * amp, 0, 0]; p.lgR = [-s * amp, 0, 0];
  p.knL = [Math.max(0, -s) * amp * 1.2, 0, 0]; p.knR = [Math.max(0, s) * amp * 1.2, 0, 0];
  p.shL = [-s * amp * 0.8, 0, 0]; p.shR = [s * amp * 0.8, 0, 0]; return p;
}
function applyPose(J, p) {
  J.hips.position.y = J.d.hip + (p.hipsY || 0);
  for (const j of JOINTS) { if (j === 'tilt') { J.rotation.set(p.tilt[0], p.tilt[1], p.tilt[2]); continue; } const r = p[j]; J[j].rotation.set(r[0], r[1], r[2]); }
  return J;
}
const THUG_POSES = { idle: legsStance(blank(), 0.08), run: runLegs(blank(), 0.8) };
const HERO_POSES = { idle: legsStance(blank(), 0.06), run: runLegs(blank(), 0.8, 0.7) };

// …
// ================= static props / building kit: merged geometry =================
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
// place(): bake a world transform into a geometry (the city is built in world space, then merged)
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
// makeOut(): the collector a static kit piece writes into. In the game the same five calls feed the chunked city meshes
// (one merged toon mesh + one merged outline hull per 64 m chunk), the night-glow layer and the collision grid.
//    out.solid(geom, colour, outline = true)   opaque cel-shaded geometry (already placed in world space)
//    out.glow(geom, colour)                    unlit geometry that lights up at night (window panes, sign faces, lamp heads); dark by day
//    out.coll({x, z, r} | {x0, x1, z0, z1})    character collider (circle or axis-aligned box), metres
//    out.bld({x0, x1, z0, z1, h})              camera-blocking box + roof height
//    out.lamp(x, y, z)                         a street-lamp light point (the game adds the glow pool, halo and pooled point light)
//    out.hook(type, data)                      a gameplay hook the ACT button uses: 'manhole' {x, z} (drops to the sewer), 'climb' {x, z, ang, top}
//                                              (ladder / climbable wall, top = roof height), 'seat' {x, y, z, ang} (bench sit spot)
//    out.decal(geom, atlas, name)              textured geometry (painted window screens, signs, Formstone pattern): geom's 0..1 uv is remapped
//                                              into the named tile of a kit atlas made with makeAtlas(); alpha < 0.5 is cut out
function mergeGeoms(list, withUv = false) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = withUv ? new Float32Array(n * 2) : null; let o = 0;
  for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (U) U.set(g.attributes.uv.array, o * 2); o += c; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (U) m.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  m.computeBoundingSphere(); return m;
}
const CITY_MAT = toonMat();                                    // ONE shared material for every static kit piece
const GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
// makeAtlas(): every texture a kit needs is DRAWN on canvas at load (no image files) and packed into ONE 1024x1024 atlas
//    tiles = { name: { w, h, draw(ctx, w, h) } }   (w, h in px; keep the total under 1024x1024)
function makeAtlas(tiles, size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), R = {}; let ax = 0, ay = 0, row = 0;
  for (const [name, t] of Object.entries(tiles)) {
    if (ax + t.w > size) { ax = 0; ay += row; row = 0; } if (ay + t.h > size) throw new Error('atlas full at ' + name);
    x.save(); x.translate(ax, ay); x.beginPath(); x.rect(0, 0, t.w, t.h); x.clip(); t.draw(x, t.w, t.h); x.restore();
    R[name] = [(ax + 1) / size, 1 - (ay + t.h - 1) / size, (t.w - 2) / size, (t.h - 2) / size]; ax += t.w; row = Math.max(row, t.h);
  }
  const tex = lowTex(c); const mat = toonMat({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  return { canvas: c, tex, mat, rect: (n) => R[n] };
}
function makeOut() {
  const S = [], OL = [], GL = [], DC = new Map(), out = { COLL: [], BLD: [], LAMPS: [], HOOKS: {} };
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  out.solid = (g, col, outline = true) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); S.push(g); if (outline) OL.push(g); };
  out.glow = (g, col) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); GL.push(g); };
  out.decal = (g, atlas, name) => { g = flat(g); const r = atlas.rect(name), uv = g.attributes.uv; if (!r) throw new Error('no tile ' + name);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * r[2], r[1] + uv.getY(i) * r[3]);
    bakeColor(g, '#ffffff'); (DC.get(atlas) || DC.set(atlas, []).get(atlas)).push(g); };
  out.coll = (c) => out.COLL.push(c); out.bld = (b) => out.BLD.push(b); out.lamp = (x, y, z) => out.LAMPS.push({ x, y, z });
  out.hook = (type, data) => (out.HOOKS[type] || (out.HOOKS[type] = [])).push(data);
  // build(): 1 toon mesh + 1 outline hull + 1 glow mesh = 3 draw calls for everything written so far
  out.build = () => {
    const grp = new THREE.Group();
    if (S.length) { const m = new THREE.Mesh(mergeGeoms(S), CITY_MAT); m.castShadow = m.receiveShadow = true; grp.add(m); }
    if (OL.length) { const g = addOdir(mergeGeoms(OL)); const h = new THREE.Mesh(g, OUT_CITY); grp.add(h); QUAL.outlines.push(h); }
    if (GL.length) { const m = new THREE.Mesh(mergeGeoms(GL), GLOW_MAT); m.renderOrder = 2; grp.add(m); }
    for (const [atlas, list] of DC) { const m = new THREE.Mesh(mergeGeoms(list, true), atlas.mat); m.castShadow = m.receiveShadow = true; grp.add(m); } // +1 call per atlas
    return grp;
  };
  return out;
}

// ---- RECONSTRUCTED (appendix marks this "…"): lighting presets (numbers from brief section 2 "Night lighting rules") ----
const LIGHT = {
  day:   { night: 0,   sky: '#9cc4dc', fog: '#b4c0c6', hemiSky: '#dfe6ff', hemiGround: '#8a7f74', hemiI: 1.45, sunCol: '#fff3dc', sunI: 2.1,  sunDir: [-0.5, 1.7, 0.42], fillI: 0 },
  dusk:  { night: 0.5, sky: '#b0706a', fog: '#8a6060', hemiSky: '#ffb08a', hemiGround: '#5a4040', hemiI: 0.85, sunCol: '#ff9a58', sunI: 1.25, sunDir: [-1, 0.32, -0.25],  fillI: 1.6 },
  night: { night: 1,   sky: '#0a0f1a', fog: '#0b0f17', hemiSky: '#4a5a88', hemiGround: '#14141c', hemiI: 0.32, sunCol: '#8aa0e8', sunI: 0.45, sunDir: [0.45, 1.2, -0.9],  fillI: 3.2 },
};
// applyLight(rig, name): rig = { scene, hemi, sun, fill } (three.js lights the viewer / game owns). Drives NIGHT, the glow layer and the outline fog.
function applyLight(rig, name = 'day') {
  const L = typeof name === 'string' ? LIGHT[name] : name; NIGHT.value = L.night; GLOW_MAT.opacity = L.night;
  rig.scene.background = new THREE.Color(L.sky); rig.scene.fog = new THREE.Fog(L.fog, 100, 200); OUT_U.fogC.value.set(L.fog);
  rig.hemi.color.set(L.hemiSky); rig.hemi.groundColor.set(L.hemiGround); rig.hemi.intensity = L.hemiI;
  rig.sun.color.set(L.sunCol); rig.sun.intensity = L.sunI; rig.sun.userData.dir = L.sunDir;
  if (rig.fill) { rig.fill.color.set('#c8d0ff'); rig.fill.intensity = L.fillI; }
  return L;
}

export const K = {
  THREE, TAU, clamp, lerp, damp, wrapA, ease, QUAL, INK, NIGHT, CURB, GF, FH, PAR, WY,
  toonMat, basicMat, outlineMat, OUT_CHAR, OUT_PROP, OUT_CITY, OUT_U, addOdir, bakeColor, lowTex,
  G, part, grp, skeleton, HERO_D, THUG_D, JOINTS, blank, legsStance, runLegs, applyPose, THUG_POSES, HERO_POSES,
  place, mergeGeoms, CITY_MAT, GLOW_MAT, makeAtlas, makeOut, LIGHT, applyLight,
};

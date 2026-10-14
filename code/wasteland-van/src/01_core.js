// ROADKILL RIG — Hark Original. Stunt-racer x horde survival. three.js r160 (local pinned copy), procedural everything.
import * as THREE from './three.module.min.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);
const BOT = Q.has('bot');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);
let SEED = 11; const srnd = () => ((SEED = (SEED * 16807) % 2147483647) / 2147483647);
window.__wvErr = { n: 0, last: '' };
addEventListener('error', (e) => { __wvErr.n++; __wvErr.last = String(e.message); });

// ---------------- renderer ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 1.25);
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const FOGC = new THREE.Color('#f6c99a');
scene.fog = new THREE.Fog(FOGC, 90, 330);
scene.background = FOGC.clone();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 900);

// ---------------- lights ----------------
const hemi = new THREE.HemisphereLight('#ffe9cf', '#c9876a', 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.1);
const SUN_DIR = new THREE.Vector3(-0.55, 1.35, 0.5).normalize();
sun.castShadow = true;
const SHM = TOUCH ? 1024 : 2048;
sun.shadow.mapSize.set(SHM, SHM);
const SHR = 34;
Object.assign(sun.shadow.camera, { left: -SHR, right: SHR, top: SHR, bottom: -SHR, near: 1, far: 220 });
sun.shadow.bias = -0.0007; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

// ---------------- toon materials (Cel City technique: 3-band ramp, halftone dots in the shadow band) ----------------
const GRAD = (() => {
  const v = [0, 0, 0, 0, 120, 120, 255, 255], d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const DOTSIZE = { value: 5.0 * DPR };
const HALFTONE = /* glsl */`
  { float lumD = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lumO = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
    float rr = lumO / max(lumD, 1e-4);
    vec2 hp = gl_FragCoord.xy / uDot;
    hp = vec2(hp.x + hp.y, hp.y - hp.x) * 0.7071;
    float dd = length(fract(hp) - 0.5);
    float shade = smoothstep(0.66, 0.5, rr);
    float rad = 0.36 * shade;
    float dm = 1.0 - smoothstep(rad - 0.05, rad + 0.05, dd);
    outgoingLight *= 1.0 - 0.32 * dm;
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.84, 0.78, 1.08), shade * 0.55);
    HT_EXTRA
  }
  #include <opaque_fragment>`;
function toonMat(opts = {}, key = 'toon') {
  const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD, vertexColors: true }, opts));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) }; m.userData.char = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC; sh.uniforms.uDot = DOTSIZE; sh.uniforms.uChar = m.userData.char;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC; uniform float uDot; uniform float uChar;')
      .replace('#include <opaque_fragment>', HALFTONE.replace('HT_EXTRA',
        'outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.32,0.27,0.25), uChar * (0.5 + 0.5 * dm)); outgoingLight = mix(outgoingLight, uFlashC, uFlash);'));
  };
  m.customProgramCacheKey = () => key;
  return m;
}
// inverted-hull outline: back faces pushed out along a mitred direction, ~constant width in screen space
const OUT_U = { fogC: { value: FOGC }, fogN: { value: 90 }, fogF: { value: 330 } };
function outlineMat(w, col = '#1a0f12') {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color(col) }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wd = mat3(modelMatrix) * odir;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 3.0, 60.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}
const OUT_WORLD = outlineMat(0.0030), OUT_VAN = outlineMat(0.0036), OUT_PROP = outlineMat(0.0032);

// odir: per-vertex mitred outline direction (avg of distinct face normals at a position, scaled for a gap-free hull)
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
function bakeColor(g, col, jitter = 0) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (srnd() - 0.5) * jitter : 1;
    a[i * 3] = c.r * j; a[i * 3 + 1] = c.g * j; a[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function setAttr1(g, name, v) { const a = new Float32Array(g.attributes.position.count).fill(v); g.setAttribute(name, new THREE.BufferAttribute(a, 1)); return g; }
// geometry builder: P(geom, color, [x,y,z], [rx,ry,rz], [sx,sy,sz]) -> non-indexed, baked colour, transformed
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function P(geom, col, pos, rot, scl, extra) {
  let g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  bakeColor(g, col, extra && extra.jitter);
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e);
  _m4.compose(_v1.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q, _v2.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
  g.applyMatrix4(_m4);
  if (extra) for (const k in extra) if (k !== 'jitter') setAttr1(g, k, extra[k]);
  return g;
}
// merge non-indexed geometries that share an attribute set (position, normal, color, + optional floats)
function merge(list, withOdir = true) {
  if (withOdir) list.forEach((g) => { if (!g.attributes.odir) addOdir(g); });
  const names = Object.keys(list[0].attributes);
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const nm of names) {
    const is = list[0].attributes[nm].itemSize, arr = new Float32Array(n * is);
    let o = 0; for (const g of list) { const a = g.attributes[nm]; if (!a) { o += g.attributes.position.count * is; continue; } arr.set(a.array, o); o += a.array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, is));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
const GEO = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sph: (rx, ry, rz, ws = 10, hs = 8) => new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz),
  cyl: (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s, 1),
  cone: (r, h, s = 6) => new THREE.ConeGeometry(r, h, s),
  cap: (r, len, rs = 8) => new THREE.CapsuleGeometry(r, len, 3, rs),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dod: (r) => new THREE.DodecahedronGeometry(r, 0),
  tor: (r, t, rs = 6, ts = 14) => new THREE.TorusGeometry(r, t, rs, ts),
};
// a mesh + its outline hull, sharing geometry
function withOutline(geom, mat, olMat, parent) {
  const m = new THREE.Mesh(geom, mat);
  const o = new THREE.Mesh(geom, olMat); m.add(o); o.castShadow = false;
  if (parent) parent.add(m); return m;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

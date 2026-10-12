// Live at Eleven - partial-level prototype: the camera is a character (a WKRK news crew filming the hero). Built on the Cel City bake-off engine.
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
const angTo = (a, b) => wrapA(b - a);
const ease = (t) => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);
let SEED = 7; const srnd = () => ((SEED = (SEED * 16807) % 2147483647) / 2147483647);
window.__celErr = { n: 0, last: '' };
addEventListener('error', (e) => { __celErr.n++; __celErr.last = String(e.message); });

// ---------------- renderer ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2);
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const FOGC = new THREE.Color('#2b1f52');
scene.fog = new THREE.Fog(FOGC, 60, 190);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

// ---------------- lights ----------------
const hemi = new THREE.HemisphereLight('#a9b4ff', '#7a5a9a', 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#d4dcff', 1.35);
const SUN_DIR = new THREE.Vector3(-0.5, 1.7, 0.42).normalize();
sun.castShadow = true;
const SHM = TOUCH ? 1024 : 2048;
sun.shadow.mapSize.set(SHM, SHM);
const SHR = 30;
Object.assign(sun.shadow.camera, { left: -SHR, right: SHR, top: SHR, bottom: -SHR, near: 1, far: 160 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.045;
scene.add(sun, sun.target);

// ---------------- toon materials ----------------
// 3 bands: unlit (ambient only), mid, lit. Shadow band gets comic halftone dots in screen space.
const GRAD = (() => {
  const v = [0, 0, 0, 0, 120, 120, 255, 255], d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
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
    outgoingLight *= 1.0 - 0.3 * dm;
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.86, 0.84, 1.12), shade * 0.6);
    outgoingLight = mix(outgoingLight, uFlashC, uFlash);
  }
  #include <opaque_fragment>`;
const DOTSIZE = { value: 5.0 * DPR };
function toonMat(opts = {}, tiled = false) {
  const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD, vertexColors: true }, opts));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC; sh.uniforms.uDot = DOTSIZE;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC; uniform float uDot;\n#ifdef TILED\nvarying vec4 vTr;\n#endif')
      .replace('#include <opaque_fragment>', HALFTONE);
    if (tiled) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 tr; varying vec4 vTr;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTr = tr;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec2 tuv = vTr.xy + fract(vMapUv) * vTr.zw;
          vec4 sampledDiffuseColor = textureGrad(map, tuv, dFdx(vMapUv) * vTr.zw, dFdy(vMapUv) * vTr.zw);
          diffuseColor *= sampledDiffuseColor;
        #endif`);
    }
  };
  if (tiled) { m.defines = { TILED: '' }; }
  m.customProgramCacheKey = () => (tiled ? 'toonT' : 'toon');
  return m;
}
// inverted-hull outline: back faces pushed out along a mitred direction, width ~constant in screen space
const OUT_U = { fogC: { value: FOGC }, fogN: { value: 60 }, fogF: { value: 190 } };
function outlineMat(w) {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color('#14101f') }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
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
const OUT_CITY = outlineMat(0.0034), OUT_CHAR = outlineMat(0.0042), OUT_PROP = outlineMat(0.0030);

// odir: per-vertex mitred outline direction (average of the distinct face normals that meet at a position,
// scaled so every adjacent face is pushed out by the same amount -> boxes get clean, gap-free hulls)
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

// ---------------- one 2048 atlas for the whole city: facade tiles, storefronts, roofs, signs, billboards, graffiti ----------------
const AS = 2048;
const atlasC = document.createElement('canvas'); atlasC.width = atlasC.height = AS;
const AX = atlasC.getContext('2d');
let _ax = 0, _ay = 0, _arow = 0;
const FONT = 'Impact, "Avenir Next Condensed", "Arial Black", "Helvetica Neue", "DejaVu Sans", sans-serif';
const INK = '#14101f';
function tile(w, h, draw, pad = 2) {
  if (_ax + w > AS) { _ax = 0; _ay += _arow; _arow = 0; }
  const r = { x: _ax, y: _ay, w, h }; _ax += w; _arow = Math.max(_arow, h);
  AX.save(); AX.translate(r.x, r.y); AX.beginPath(); AX.rect(0, 0, w, h); AX.clip(); draw(AX, w, h); AX.restore();
  return [(r.x + pad) / AS, 1 - (r.y + h - pad) / AS, (w - 2 * pad) / AS, (h - 2 * pad) / AS];
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function halftone(c, x0, y0, w, h, col, step = 10, maxR = 3.2, dir = 1) {
  c.fillStyle = col;
  for (let y = y0; y < y0 + h; y += step) for (let x = x0 + ((y / step) & 1) * step / 2; x < x0 + w; x += step) {
    const t = dir > 0 ? (y - y0) / h : 1 - (y - y0) / h, r = maxR * t; if (r < 0.4) continue;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
}
function comicText(c, txt, x, y, size, fill, stroke2, opts = {}) {
  c.save(); c.font = `${opts.italic === false ? '' : 'italic '}900 ${size}px ${FONT}`; c.textAlign = opts.align || 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.miterLimit = 2;
  if (opts.sx) { c.translate(x, y); c.scale(opts.sx, 1); x = 0; y = 0; }
  if (opts.shadow !== false) { c.lineWidth = size * 0.34; c.strokeStyle = INK; c.strokeText(txt, x + size * 0.07, y + size * 0.07); c.fillStyle = INK; c.fillText(txt, x + size * 0.07, y + size * 0.07); }
  c.lineWidth = size * 0.26; c.strokeStyle = INK; c.strokeText(txt, x, y);
  if (stroke2) { c.lineWidth = size * 0.12; c.strokeStyle = stroke2; c.strokeText(txt, x, y); }
  c.fillStyle = fill; c.fillText(txt, x, y);
  c.restore();
}
const T = {};
T.white = tile(32, 32, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); });

// building palettes: wall, trim, glass, glass light, window frame
const PAL = [
  { wall: '#ff5fa2', trim: '#ffd23c', glass: '#1d7fe0', gl2: '#7fe8ff', shade: '#ffb0d2' },
  { wall: '#22c4b4', trim: '#ff7a2f', glass: '#24418f', gl2: '#69d1ff', shade: '#bff7ee' },
  { wall: '#ff8a3d', trim: '#6b4cff', glass: '#2a3a9a', gl2: '#9fe3ff', shade: '#ffd0a8' },
  { wall: '#ffd84a', trim: '#ff3d6e', glass: '#1f62c9', gl2: '#a8f0ff', shade: '#fff0b0' },
  { wall: '#8e6bff', trim: '#7dff6b', glass: '#20257a', gl2: '#6fe0ff', shade: '#cdbfff' },
  { wall: '#fff0d6', trim: '#e8384f', glass: '#2b56b8', gl2: '#95e6ff', shade: '#ffffff' },
];
function facadeTile(p, variant) {
  return tile(256, 256, (c, w, h) => {
    c.fillStyle = p.wall; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(20,16,31,.13)'; c.fillRect(0, h - 12, w, 12); // floor line
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, h - 16, w, 4);
    const x0 = 56, x1 = 200, y0 = 34, y1 = 196;
    // lintel
    c.fillStyle = INK; c.fillRect(x0 - 14, y0 - 22, x1 - x0 + 28, 18); c.fillStyle = p.trim; c.fillRect(x0 - 10, y0 - 18, x1 - x0 + 20, 10);
    c.fillStyle = INK; c.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16);
    const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, p.gl2); g.addColorStop(0.45, p.glass); g.addColorStop(1, p.glass);
    c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (variant === 1) { c.fillStyle = '#ffe08a'; c.fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.42); c.fillStyle = '#ffbf3c'; for (let x = x0; x < x1; x += 18) c.fillRect(x, y0, 6, (y1 - y0) * 0.42); }
    if (variant === 2) { c.fillStyle = p.shade; c.fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.6); c.fillStyle = 'rgba(20,16,31,.25)'; for (let y = y0 + 8; y < y0 + (y1 - y0) * 0.6; y += 12) c.fillRect(x0, y, x1 - x0, 3); }
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(x0 + 20, y1); c.lineTo(x0 + 70, y0); c.lineTo(x0 + 92, y0); c.lineTo(x0 + 42, y1); c.fill();
    c.beginPath(); c.moveTo(x0 + 58, y1); c.lineTo(x0 + 108, y0); c.lineTo(x0 + 116, y0); c.lineTo(x0 + 66, y1); c.fill();
    c.fillStyle = INK; c.fillRect((x0 + x1) / 2 - 4, y0, 8, y1 - y0); c.fillRect(x0, y0 + (y1 - y0) * 0.42 - 3, x1 - x0, 7);
    // sill
    c.fillStyle = INK; c.fillRect(x0 - 16, y1 + 4, x1 - x0 + 32, 18); c.fillStyle = p.trim; c.fillRect(x0 - 12, y1 + 7, x1 - x0 + 24, 10);
  });
}
function storeTile(p) {
  return tile(256, 320, (c, w, h) => {
    c.fillStyle = p.wall; c.fillRect(0, 0, w, h);
    c.fillStyle = INK; c.fillRect(0, 0, w, 84); c.fillStyle = p.trim; c.fillRect(0, 6, w, 72); // sign band
    c.fillStyle = 'rgba(20,16,31,.18)'; for (let x = 8; x < w; x += 24) c.fillRect(x, 6, 3, 72);
    c.fillStyle = INK; c.fillRect(14, 96, w - 28, h - 96);
    const g = c.createLinearGradient(0, 104, 0, h - 40); g.addColorStop(0, '#9fefff'); g.addColorStop(0.5, '#3aa6ea'); g.addColorStop(1, '#2a4fb0');
    c.fillStyle = g; c.fillRect(24, 104, w - 48, h - 160);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(40, h - 56); c.lineTo(110, 104); c.lineTo(140, 104); c.lineTo(70, h - 56); c.fill();
    c.fillStyle = INK; c.fillRect(w / 2 - 4, 104, 8, h - 160);
    c.fillStyle = '#3a2f5a'; c.fillRect(24, h - 48, w - 48, 40); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(24, h - 48, w - 48, 6);
  });
}
T.fac = PAL.map((p, i) => [facadeTile(p, 0), facadeTile(p, i % 2 ? 1 : 2)]);
T.store = PAL.map(storeTile);
T.roof = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#6d6386'; c.fillRect(0, 0, w, h); c.fillStyle = '#5c5275';
  for (let i = 0; i < 90; i++) c.fillRect(srnd() * w, srnd() * h, 3, 3);
  c.fillStyle = '#7f76a0'; for (let i = 0; i < 60; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
  c.fillStyle = 'rgba(20,16,31,.35)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h);
});
T.walk = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#e4dcf2'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#c4b8dc'; c.fillRect(0, 0, w, 5); c.fillRect(0, 0, 5, h); c.fillRect(0, h / 2 - 1, w, 2); c.fillRect(w / 2 - 1, 0, 2, h);
  c.fillStyle = 'rgba(160,140,200,.35)'; for (let i = 0; i < 30; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
});
T.road = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#3d4170'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#353862'; for (let i = 0; i < 120; i++) c.fillRect(srnd() * w, srnd() * h, 3, 3);
  c.fillStyle = '#4a4f85'; for (let i = 0; i < 70; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
});
T.stripes = tile(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, w / 2, h); }); // awnings (tinted)
T.rail = tile(128, 64, (c, w, h) => { // fire-escape railing, alpha cut
  c.clearRect(0, 0, w, h); c.fillStyle = '#2b2340';
  c.fillRect(0, 2, w, 9); c.fillRect(0, h - 12, w, 8); for (let x = 2; x < w; x += 16) c.fillRect(x, 2, 5, h - 6);
});
T.stair = tile(128, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.fillStyle = '#2b2340'; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h); for (let y = 4; y < h; y += 11) c.fillRect(0, y, w, 5);
});
const SIGNS = [['PIZZA', '#ff3d6e', '#ffd23c'], ['ARCADE', '#6b4cff', '#7dff6b'], ['RECORDS', '#14101f', '#ff5fa2'], ['BODEGA 24H', '#ffd23c', '#ff3d6e'],
  ['KICKS', '#22c4b4', '#fff'], ['NOODLES', '#e8384f', '#fff0d6'], ['TATTOO', '#14101f', '#7fe8ff'], ['LAUNDRO', '#2fd3ff', '#fff']];
T.signs = SIGNS.map(([t, bg, fg]) => tile(512, 128, (c, w, h) => {
  c.fillStyle = INK; rrect(c, 2, 2, w - 4, h - 4, 18); c.fill(); c.fillStyle = bg; rrect(c, 10, 10, w - 20, h - 20, 12); c.fill();
  halftone(c, 14, 14, w - 28, h - 28, 'rgba(255,255,255,.18)', 12, 3.5, -1);
  comicText(c, t, w / 2, h / 2 + 4, 74, fg, null, { shadow: true });
}));
function billboard(draw) { return tile(512, 256, (c, w, h) => { draw(c, w, h); c.strokeStyle = INK; c.lineWidth = 14; c.strokeRect(0, 0, w, h); }); }
T.bill = [
  billboard((c, w, h) => { // pizza
    c.fillStyle = '#ffd23c'; c.fillRect(0, 0, w, h); halftone(c, 0, 0, w, h, '#ff9d2e', 14, 5.5, 1);
    c.save(); c.translate(390, 128); c.rotate(-0.25);
    c.fillStyle = INK; c.beginPath(); c.moveTo(-82, -96); c.lineTo(86, -96); c.lineTo(0, 110); c.closePath(); c.fill();
    c.fillStyle = '#ffcf6a'; c.beginPath(); c.moveTo(-70, -84); c.lineTo(74, -84); c.lineTo(0, 92); c.closePath(); c.fill();
    c.fillStyle = '#c9772d'; c.fillRect(-74, -94, 150, 22);
    c.fillStyle = '#e8384f'; [[-30, -40], [22, -50], [0, 8], [-8, -64], [30, -10]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); });
    c.restore();
    comicText(c, 'SLICE', 170, 80, 92, '#ff3d6e', '#fff'); comicText(c, 'CITY!', 170, 170, 92, '#fff', '#ff3d6e');
  }),
  billboard((c, w, h) => { // radio
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#6b4cff'); g.addColorStop(1, '#ff5fa2'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 10; for (let r = 30; r < 300; r += 36) { c.beginPath(); c.arc(420, 128, r, -1.1, 1.1); c.stroke(); }
    comicText(c, 'WKRK 8', 200, 88, 92, '#7fe8ff', null); comicText(c, 'ACTION NEWS', 200, 182, 52, '#ffd23c', null);
  }),
  billboard((c, w, h) => { // kicks
    c.fillStyle = '#22c4b4'; c.fillRect(0, 0, w, h); halftone(c, 0, 0, w, h, '#0e8f86', 14, 5, -1);
    c.save(); c.translate(360, 150); c.rotate(-0.2); c.fillStyle = INK; rrect(c, -120, -50, 240, 100, 40); c.fill();
    c.fillStyle = '#fff'; rrect(c, -110, -40, 220, 80, 34); c.fill(); c.fillStyle = '#ff3d6e'; rrect(c, -110, -40, 120, 50, 24); c.fill();
    c.fillStyle = INK; c.fillRect(-110, 22, 220, 10); c.restore();
    comicText(c, 'KICKS', 140, 92, 90, '#fff', '#ff3d6e'); comicText(c, 'GO FAST', 140, 186, 52, '#ffd23c', null);
  }),
  billboard((c, w, h) => { // soda
    c.fillStyle = '#ff5fa2'; c.fillRect(0, 0, w, h); halftone(c, 0, 0, w, h, '#ff96c5', 12, 5, 1);
    c.save(); c.translate(400, 128); c.rotate(0.18); c.fillStyle = INK; rrect(c, -50, -100, 100, 200, 18); c.fill();
    c.fillStyle = '#7dff6b'; rrect(c, -42, -92, 84, 184, 14); c.fill(); c.fillStyle = '#fff'; c.fillRect(-42, -30, 84, 40);
    comicText(c, 'GO', 0, -8, 40, '#ff3d6e', null, { shadow: false }); c.restore();
    comicText(c, 'GO-GO', 170, 90, 86, '#7dff6b', null); comicText(c, 'SODA', 170, 180, 86, '#fff', null);
  }),
];
// graffiti pieces (alpha): bubble letters with ink outline, drips, sparkles
const GRAF = [['LIVE', '#7dff6b', '#1f7bff'], ['BOOM!', '#ffd23c', '#ff3d6e'], ['SHELL', '#ff5fa2', '#6b4cff'], ['ZAP', '#2fd3ff', '#ffd23c'],
  ['RUSH', '#ff8a3d', '#14101f'], ['WILD', '#c9a6ff', '#ff3d6e'], ['GG!', '#fff', '#22c4b4'], ['YO', '#ffd23c', '#6b4cff']];
T.graf = GRAF.map(([t, fill, rim], i) => tile(512, 256, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const size = t.length > 3 ? 112 : 132, cx = w / 2, cy = h / 2 - 8;
  c.save(); c.translate(cx, cy); c.rotate(i % 2 ? -0.08 : 0.06); c.font = `italic 900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const tw = Math.min(c.measureText(t).width, w - 120); const sx = tw / c.measureText(t).width; c.scale(sx * 1.02, 1);
  // backing cloud
  c.lineWidth = 64; c.strokeStyle = rim; c.strokeText(t, 6, 8); c.lineWidth = 40; c.strokeStyle = INK; c.strokeText(t, 6, 8);
  c.lineWidth = 30; c.strokeStyle = INK; c.strokeText(t, 0, 0); c.lineWidth = 16; c.strokeStyle = '#fff'; c.strokeText(t, 0, 0);
  const g = c.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff'); g.addColorStop(0.25, fill); g.addColorStop(1, fill);
  c.fillStyle = g; c.fillText(t, 0, 0);
  c.restore();
  // drips
  c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = 5;
  for (let k = 0; k < 4; k++) { const x = 110 + srnd() * 290, len = 22 + srnd() * 34, y = cy + size * 0.32; c.beginPath(); c.rect(x - 5, y, 10, len); c.fill(); c.stroke(); c.beginPath(); c.arc(x, y + len, 8, 0, TAU); c.fill(); c.stroke(); }
  // sparkles
  c.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { const x = 30 + srnd() * 450, y = 20 + srnd() * 40; c.save(); c.translate(x, y); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath();
    for (let a = 0; a < 8; a++) { const r = a % 2 ? 6 : 18; c.lineTo(Math.cos(a * Math.PI / 4) * r, Math.sin(a * Math.PI / 4) * r); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
}));
const atlasTex = new THREE.CanvasTexture(atlasC);
atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4; atlasTex.generateMipmaps = true;
atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
const CITY_MAT = toonMat({ map: atlasTex }, true);
const DECAL_MAT = toonMat({ map: atlasTex, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, true);

// ---------------- merged city builder: one tiled-atlas mesh (+ decals) and one outline hull mesh ----------------
class MB {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.R = []; }
  vert(p, n, uv, c, tr) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(uv[0], uv[1]); this.C.push(c.r, c.g, c.b); this.R.push(tr[0], tr[1], tr[2], tr[3]); }
  // a b c d counter-clockwise seen from the front; uv = [u0, v0, u1, v1] in tile repeats
  quad(a, b, c, d, uv, col, tr) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; const n = [nx / l, ny / l, nz / l];
    const C = col instanceof THREE.Color ? col : new THREE.Color(col || '#fff'), t = tr || T.white;
    const [u0, v0, u1, v1] = uv || [0.02, 0.02, 0.98, 0.98];
    const A = [u0, v0], B = [u1, v0], Cc = [u1, v1], D = [u0, v1];
    this.vert(a, n, A, C, t); this.vert(b, n, B, C, t); this.vert(c, n, Cc, C, t);
    this.vert(a, n, A, C, t); this.vert(c, n, Cc, C, t); this.vert(d, n, D, C, t);
  }
  // wall from (xa,za) to (xb,zb), seen from the front with xa on the left
  wall(xa, za, xb, zb, y0, y1, tr, col, uv) { this.quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], uv, col, tr); }
  floor(x0, z0, x1, z1, y, tr, col, tileM = 4) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tileM, -z1 / tileM, x1 / tileM, -z0 / tileM], col, tr); }
  box(x0, y0, z0, x1, y1, z1, col, tr, opt = {}) {
    const t = tr || T.white, uv = opt.uv;
    this.wall(x0, z1, x1, z1, y0, y1, t, col, uv); this.wall(x1, z0, x0, z0, y0, y1, t, col, uv);
    this.wall(x1, z1, x1, z0, y0, y1, t, col, uv); this.wall(x0, z0, x0, z1, y0, y1, t, col, uv);
    if (opt.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], null, opt.topCol || col, opt.topTr || t);
    if (opt.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], null, col, t);
  }
  geom(g, col, tr, uvScale = 1) { // any BufferGeometry (already transformed), uv from the geometry
    g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; const C = new THREE.Color(col), t = tr || T.white;
    for (let i = 0; i < p.count; i++) {
      const u = uv ? [uv.getX(i) * uvScale * 0.96 + 0.02, uv.getY(i) * 0.96 + 0.02] : [0.5, 0.5];
      this.vert([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], u, C, t);
    }
  }
  build(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('tr', new THREE.Float32BufferAttribute(this.R, 4)); g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
class OB { // outline hulls
  constructor() { this.P = []; this.D = []; }
  geom(g) {
    g = g.index ? g.toNonIndexed() : g.clone(); addOdir(g); const p = g.attributes.position, d = g.attributes.odir;
    for (let i = 0; i < p.count; i++) { this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.D.push(d.getX(i), d.getY(i), d.getZ(i)); }
  }
  box(x0, y0, z0, x1, y1, z1) { // exact box hull: corners pushed along (+-1,+-1,+-1)
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).toNonIndexed();
    const p = g.attributes.position, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); this.P.push(x, y, z); this.D.push(Math.sign(x - cx), Math.sign(y - cy), Math.sign(z - cz)); }
  }
  build(mat) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('odir', new THREE.Float32BufferAttribute(this.D, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
  }
}
const CB = new MB(), DB = new MB(), OL = new OB(), GB = new MB(); // city, decals, outlines, ground (no shadow cast)
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- layout ----------------
// Origin = middle of the crossing. X east, Z south. Roads |x|<7 (N-S) and |z|<7 (E-W), sidewalks to 11, buildings from 11 out to 46.
const RW = 7, SW = 11, ARM = 46, LIM = 42.5, CURB = 0.16;
const GF = 4.4, FH = 3.4, PAR = 1.3;
function isRoad(x, z) { return Math.abs(x) < RW || Math.abs(z) < RW; }
function groundY(x, z) { return isRoad(x, z) ? 0 : CURB; }

// ground: road + sidewalks
(function ground() {
  const roadC = '#ffffff';
  GB.floor(-RW, -ARM - 14, RW, ARM + 14, 0, T.road, roadC, 6); // N-S road
  GB.floor(-ARM - 14, -RW, -RW, RW, 0, T.road, roadC, 6); GB.floor(RW, -RW, ARM + 14, RW, 0, T.road, roadC, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // L-shaped corner sidewalks
    const xa = sx > 0 ? RW : -SW, xb = sx > 0 ? SW : -RW, za = sz > 0 ? RW : -ARM - 14, zb = sz > 0 ? ARM + 14 : -RW;
    GB.floor(xa, za, xb, zb, CURB, T.walk, '#fff', 2);
    const xc = sx > 0 ? SW : -ARM - 14, xd = sx > 0 ? ARM + 14 : -SW, zc = sz > 0 ? RW : -SW, zd = sz > 0 ? SW : -RW;
    GB.floor(xc, zc, xd, zd, CURB, T.walk, '#fff', 2);
    // curbs (yellow at the corner, grey along the street)
    const cx = sx * RW, cz = sz * RW;
    const curbCol = (d) => (d < 6 ? '#ffd23c' : '#b9add6');
    for (let d = 0; d < ARM + 14 - RW; d += 6) {
      const a = RW + d, b = Math.min(a + 6, ARM + 14), col = curbCol(d);
      if (sx > 0) GB.wall(cx, sz > 0 ? a : -b, cx, sz > 0 ? b : -a, 0, CURB, T.white, col); else GB.wall(cx, sz > 0 ? b : -a, cx, sz > 0 ? a : -b, 0, CURB, T.white, col);
      if (sz > 0) GB.wall(sx > 0 ? b : -a, cz, sx > 0 ? a : -b, cz, 0, CURB, T.white, col); else GB.wall(sx > 0 ? a : -b, cz, sx > 0 ? b : -a, cz, 0, CURB, T.white, col);
    }
  }
  // road paint (decal mesh: no shadow cast)
  const W = new THREE.Color('#fbf7ff'), Y = new THREE.Color('#ffd23c'), y = 0.012;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const at = (along, across) => (ax ? [ax * along, across] : [across, az * along]);
    const strip = (a0, a1, c0, c1, col) => { const p = at(a0, c0), q = at(a1, c1); DB.floor(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), y, T.white, col); };
    for (let c = -RW + 0.6; c < RW - 0.6; c += 1.25) strip(7.6, 10.4, c, c + 0.65, W); // zebra
    strip(11.0, 11.4, ax || az ? 0.2 : 0, RW - 0.3, W); // stop line (one side)
    for (let a = 13; a < ARM + 10; a += 4.5) { strip(a, a + 2.4, -0.28, -0.1, Y); strip(a, a + 2.4, 0.1, 0.28, Y); }
    strip(11.4, ARM + 12, RW - 0.55, RW - 0.4, W); strip(11.4, ARM + 12, -RW + 0.4, -RW + 0.55, W);
  }
  // manholes
  for (const [x, z] of [[3, 18], [-3.5, -24], [22, -2.5], [-27, 3]]) { const g = new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20); place(g, x, 0.0, z); CB.geom(g, '#2d2f55'); }
})();

// ---------------- buildings ----------------
function building(x0, z0, x1, z1, floors, pi, o = {}) {
  const h = GF + floors * FH + PAR, p = PAL[pi], trim = new THREE.Color(p.trim), wall = new THREE.Color(p.wall);
  const fac = T.fac[pi][o.v || 0], store = T.store[pi];
  const faces = { s: [x0, z1, x1, z1], n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], w: [x0, z0, x0, z1] };
  for (const k in faces) {
    const [xa, za, xb, zb] = faces[k], L = Math.hypot(xb - xa, zb - za), nb = Math.max(1, Math.round(L / 3.6));
    const shop = o.shops && o.shops.includes(k);
    if (shop) CB.wall(xa, za, xb, zb, 0, GF, store, '#fff', [0, 0, nb, 0.995]);
    else CB.wall(xa, za, xb, zb, 0, GF, T.white, wall.clone().multiplyScalar(0.92));
    CB.wall(xa, za, xb, zb, GF, GF + floors * FH, fac, '#fff', [0, 0, nb, floors]);
    CB.wall(xa, za, xb, zb, GF + floors * FH, h, T.white, wall);
  }
  CB.floor(x0, z0, x1, z1, h - 0.6, T.roof, '#fff', 4);
  OL.box(x0, 0, z0, x1, h, z1);
  BLD.push({ x0, x1, z0, z1, h });
  // parapet lip + cornice + belt course (trim colour, outlined)
  const c = 0.28; sbox(x0 - c, h - 0.45, z0 - c, x1 + c, h, z1 + c, trim);
  sbox(x0 - 0.14, GF - 0.05, z0 - 0.14, x1 + 0.14, GF + 0.3, z1 + 0.14, trim);
  sbox(x0 - 0.1, GF + floors * FH - 0.05, z0 - 0.1, x1 + 0.1, GF + floors * FH + 0.22, z1 + 0.1, trim, false);
  // roof: inner parapet walls so the sunk roof reads, a few rooftop units
  CB.wall(x0 + 0.01, z1 - 0.01, x1 - 0.01, z1 - 0.01, h - 0.6, h, T.white, wall); // (only seen from above: cheap)
  if (o.ac !== false) {
    const ax = lerp(x0, x1, 0.3), az = lerp(z0, z1, 0.65);
    sbox(ax - 1, h - 0.6, az - 0.7, ax + 1, h + 0.7, az + 0.7, '#cfd3e6'); sbox(ax - 0.7, h + 0.7, az - 0.45, ax + 0.7, h + 0.85, az + 0.45, '#9da3c2');
  }
  // storefront awnings + shop signs on the street faces
  if (o.shops) for (const k of o.shops) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux; // outward normal
    const nb = Math.max(1, Math.round(L / 3.6)), bw = L / nb;
    const sg = T.signs[(o.sign + (k.charCodeAt(0) % 3)) % T.signs.length];
    // sign centred on the face, in the sign band
    const sw = Math.min(6.2, L - 1), sc = L / 2, off = 0.05;
    DB.wall(xa + ux * (sc - sw / 2) + nx * off, za + uz * (sc - sw / 2) + nz * off, xa + ux * (sc + sw / 2) + nx * off, za + uz * (sc + sw / 2) + nz * off, GF - 0.98, GF - 0.18, sg, '#fff', [0.002, 0.002, 0.998, 0.998]);
    // awnings over every other bay (skip the sign bay)
    for (let b = 0; b < nb; b++) {
      const m = (b + 0.5) * bw; if (Math.abs(m - sc) < sw / 2 + 0.2) continue; if ((b + (o.sign || 0)) % 2) continue;
      const len = bw - 0.5, depth = 1.25, g = new THREE.BoxGeometry(len, 0.12, depth);
      g.translate(0, 0, depth / 2); g.rotateX(0.38);
      const ang = Math.atan2(nx, nz);
      place(g, xa + ux * m + nx * 0.02, GF - 0.95, za + uz * m + nz * 0.02, ang);
      CB.geom(g, p.trim, T.stripes, 4); OL.geom(g);
    }
  }
  if (o.fire) fireEscape(faces[o.fire], floors, o.fireAt || 0.7);
  if (o.tower) waterTower(lerp(x0, x1, o.tower[0]), h - 0.6, lerp(z0, z1, o.tower[1]));
  if (o.bill) billboardOn(faces[o.bill[0]], h - 0.6, o.bill[1]);
  if (o.graf) for (const [k, at, gi, y = 0.4, s = 1] of o.graf) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux, w = 4.2 * s, m = at * L, off = 0.06;
    DB.wall(xa + ux * (m - w / 2) + nx * off, za + uz * (m - w / 2) + nz * off, xa + ux * (m + w / 2) + nx * off, za + uz * (m + w / 2) + nz * off, y, y + w / 2, T.graf[gi], '#fff', [0.002, 0.002, 0.998, 0.998]);
  }
  return h;
}
function fireEscape(face, floors, at) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = 3.6, d = 1.15, m = at * L, col = '#2b2340';
  const P = (s, t, y) => [xa + ux * s + nx * t, y, za + uz * s + nz * t];
  for (let f = 1; f <= floors; f++) {
    const y = GF + (f - 1) * FH + 0.02;
    // platform as an oriented box
    const g = new THREE.BoxGeometry(w, 0.1, d); place(g, P(m, d / 2, y)[0], y, P(m, d / 2, y)[2], Math.atan2(nx, nz)); CB.geom(g, col); OL.geom(g);
    // railings (front + sides), alpha-cut tile, double-sided decal
    const a = P(m - w / 2, d, y), b = P(m + w / 2, d, y), a0 = P(m - w / 2, 0.05, y), b0 = P(m + w / 2, 0.05, y);
    DB.quad(a, b, [b[0], y + 1.0, b[2]], [a[0], y + 1.0, a[2]], [0, 0, 3, 1], '#fff', T.rail);
    DB.quad(a0, a, [a[0], y + 1.0, a[2]], [a0[0], y + 1.0, a0[2]], [0, 0, 1, 1], '#fff', T.rail);
    DB.quad(b, b0, [b0[0], y + 1.0, b0[2]], [b[0], y + 1.0, b[2]], [0, 0, 1, 1], '#fff', T.rail);
    // stair to the next platform (diagonal)
    if (f < floors) { const s0 = f % 2 ? m - w / 2 + 0.2 : m + w / 2 - 0.2, s1 = f % 2 ? m + w / 2 - 1.0 : m - w / 2 + 1.0, t = 0.62;
      const q0 = P(s0, t - 0.35, y + 0.1), q1 = P(s1, t - 0.35, y + FH), q2 = P(s1, t + 0.35, y + FH), q3 = P(s0, t + 0.35, y + 0.1);
      DB.quad(q0, q3, q2, q1, [0, 0, 1, 4], '#fff', T.stair); }
    // drop ladder at the bottom
    if (f === 1) { const l0 = P(m + w / 2 - 0.6, d - 0.1, 1.6), l1 = P(m + w / 2 - 1.1, d - 0.1, 1.6);
      DB.quad(l0, l1, [l1[0], y, l1[2]], [l0[0], y, l0[2]], [0, 0, 1, 3], '#fff', T.stair); }
  }
}
function waterTower(x, y, z) {
  const legH = 2.6, r = 1.7, tankH = 2.9;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.1, 0.12, legH, 6); place(g, x + a * r * 0.62, y + legH / 2, z + b * r * 0.62); solid(g, '#2b2340'); }
  const cross = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross, x, y + legH * 0.55, z - r * 0.62); solid(cross, '#2b2340', false);
  const cross2 = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross2, x, y + legH * 0.55, z + r * 0.62); solid(cross2, '#2b2340', false);
  const tank = new THREE.CylinderGeometry(r, r * 1.04, tankH, 18, 1); place(tank, x, y + legH + tankH / 2, z); solid(tank, '#c46a3a');
  for (const k of [0.25, 0.7]) { const band = new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.14, 18, 1, true); place(band, x, y + legH + tankH * k, z); CB.geom(band, '#2b2340'); }
  const roof = new THREE.ConeGeometry(r * 1.12, 1.25, 18); place(roof, x, y + legH + tankH + 0.62, z); solid(roof, '#5a3a8a');
  const knob = new THREE.SphereGeometry(0.16, 8, 6); place(knob, x, y + legH + tankH + 1.3, z); solid(knob, '#ffd23c');
  BLD.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: y + legH + tankH + 1.3, y0: y });
}
function billboardOn(face, y, bi) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = Math.min(9, L - 1.5), hh = w / 2, m = L / 2, inset = 1.6, base = y + 1.6;
  const P = (s, t, yy) => [xa + ux * s - nx * t, yy, za + uz * s - nz * t];
  const ang = Math.atan2(nx, nz);
  for (const s of [m - w * 0.35, m + w * 0.35]) { const g = new THREE.BoxGeometry(0.22, base - y + 0.2, 0.22); const p = P(s, inset + 0.3, (y + base) / 2); place(g, p[0], p[1], p[2], ang); solid(g, '#2b2340'); }
  const back = new THREE.BoxGeometry(w + 0.5, hh + 0.5, 0.3); const pc = P(m, inset + 0.15, base + hh / 2); place(back, pc[0], pc[1], pc[2], ang); solid(back, '#2b2340');
  const a = P(m - w / 2, inset - 0.02, base), b = P(m + w / 2, inset - 0.02, base);
  CB.quad(a, b, [b[0], base + hh, b[2]], [a[0], base + hh, a[2]], [0.003, 0.003, 0.997, 0.997], '#fff', T.bill[bi]);
  // catwalk + lamps
  const cw = new THREE.BoxGeometry(w * 0.9, 0.08, 0.7); const pw = P(m, inset - 0.4, base - 0.1); place(cw, pw[0], pw[1], pw[2], ang); solid(cw, '#2b2340');
  for (const s of [m - w * 0.3, m + w * 0.3]) { const g = new THREE.BoxGeometry(0.5, 0.18, 0.3); const p = P(s, inset - 0.7, base + hh + 0.35); place(g, p[0], p[1], p[2], ang, 0.5); solid(g, '#ffd23c'); }
}

// four corner blocks: [sx, sz]; each has a tall corner tower + a building down each street + an end-of-street cap
const CORNERS = [
  { s: [1, -1], pal: [0, 3, 1], tower: true, bill: 0, sign: 0 },  // NE
  { s: [-1, -1], pal: [1, 5, 4], tower: false, bill: 1, sign: 2 }, // NW
  { s: [1, 1], pal: [4, 2, 0], tower: false, bill: 2, sign: 4 },  // SE
  { s: [-1, 1], pal: [2, 0, 3], tower: true, bill: 3, sign: 6 },  // SW
];
// faces seen from the streets per quadrant: ew street side = (sz>0 ? 'n' : 's'), ns street side = (sx>0 ? 'w' : 'e')
CORNERS.forEach((C, ci) => {
  const [sx, sz] = C.s, ew = sz > 0 ? 'n' : 's', ns = sx > 0 ? 'w' : 'e';
  const box = (a0, a1, b0, b1) => { const xs = [sx * a0, sx * a1], zs = [sz * b0, sz * b1]; return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; };
  const fl = [6 + (ci % 2) * 2, 3 + (ci % 3), 4 + ((ci + 1) % 3)];
  // corner tower
  let [x0, z0, x1, z1] = box(SW, SW + 13, SW, SW + 13);
  building(x0, z0, x1, z1, fl[0], C.pal[0], { shops: [ew, ns], sign: C.sign, v: 1, fire: ci % 2 ? ns : ew, fireAt: 0.62,
    tower: C.tower ? [sx > 0 ? 0.68 : 0.32, sz > 0 ? 0.68 : 0.32] : null, bill: C.tower ? null : [ci % 2 ? ew : ns, C.bill],
    graf: [[ci % 2 ? ew : ns, sx * sz > 0 ? 0.3 : 0.7, ci * 2 % 8, 0.35, 0.9]] });
  // down the E-W street
  [x0, z0, x1, z1] = box(SW + 13, SW + 23, SW, SW + 10);
  building(x0, z0, x1, z1, fl[1], C.pal[1], { shops: [ew], sign: C.sign + 1, fire: (ci % 2) ? null : ew, fireAt: 0.5, tower: C.tower ? null : [0.5, 0.5],
    graf: [[ew, 0.5, (ci * 2 + 1) % 8, 4.6, 1.3]] });
  [x0, z0, x1, z1] = box(SW + 23, ARM, SW, SW + 12);
  building(x0, z0, x1, z1, fl[0] - 1, C.pal[2], { shops: [ew], sign: C.sign + 3, v: 1, bill: C.tower ? [ew, (C.bill + 1) % 4] : null,
    graf: [[ew, 0.35, (ci + 5) % 8, 0.3, 1]] });
  // down the N-S street
  [x0, z0, x1, z1] = box(SW, SW + 10, SW + 13, SW + 24);
  building(x0, z0, x1, z1, fl[2], C.pal[2], { shops: [ns], sign: C.sign + 5, fire: (ci % 2) ? ns : null, fireAt: 0.45, graf: [[ns, 0.55, (ci + 3) % 8, 0.35, 1.1]] });
  [x0, z0, x1, z1] = box(SW, SW + 12, SW + 24, ARM);
  building(x0, z0, x1, z1, fl[1] + 2, C.pal[1], { shops: [ns], sign: C.sign + 2, v: 1, tower: C.tower ? null : [sx > 0 ? 0.6 : 0.4, 0.5], graf: [[ns, 0.4, (ci + 6) % 8, 0.35, 1]] });
  // back fill (keeps the skyline solid from high camera angles)
  [x0, z0, x1, z1] = box(SW + 13, ARM, SW + 12, ARM);
  building(x0, z0, x1, z1, 3, C.pal[0], { ac: false });
});
// street-end caps (close each arm) + barriers
[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, az], i) => {
  const a0 = ARM + 1, a1 = ARM + 12, w = SW + 2;
  const [x0, z0, x1, z1] = ax ? [Math.min(ax * a0, ax * a1), -w, Math.max(ax * a0, ax * a1), w] : [-w, Math.min(az * a0, az * a1), w, Math.max(az * a0, az * a1)];
  const face = ax > 0 ? 'w' : ax < 0 ? 'e' : az > 0 ? 'n' : 's';
  building(x0, z0, x1, z1, 5 + (i % 2) * 2, (i + 2) % 6, { shops: [face], sign: i * 2 + 1, v: i % 2, bill: [face, (i + 2) % 4], graf: [[face, 0.2, (i * 3) % 8, 0.3, 1], [face, 0.82, (i * 3 + 4) % 8, 0.3, 1]] });
  // jersey barriers (orange/white)
  for (let c = -RW + 0.4; c < RW - 0.4; c += 2.2) {
    const g = new THREE.BoxGeometry(2.0, 0.85, 0.6); g.translate(0, 0.42, 0);
    const p = ax ? [ax * LIM + ax * 0.9, c + 1] : [c + 1, az * LIM + az * 0.9];
    place(g, p[0], 0, p[1], ax ? Math.PI / 2 : 0); solid(g, ((c / 2.2) | 0) % 2 ? '#ff7a2f' : '#fff0d6');
  }
});
// distant skyline silhouettes (unlit-ish, no outlines)
(function skyline() {
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * TAU + srnd() * 0.05, r = 95 + srnd() * 50, w = 8 + srnd() * 12, h = 22 + srnd() * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = new THREE.BoxGeometry(w, h, w); place(g, x, h / 2, z, -a);
    CB.geom(g, ['#3a2c6e', '#47367d', '#33285f', '#4f3a80'][i % 4]);
  }
})();

// ---------------- street props ----------------
function lamp(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.11, 0.15, 5.2, 8); place(g, x, CURB + 2.6, z); solid(g, '#2b6f7a');
  const arm = new THREE.BoxGeometry(0.12, 0.12, 1.6); arm.translate(0, 0, 0.8); place(arm, x, CURB + 5.1, z, ang); solid(arm, '#2b6f7a');
  const head = new THREE.CylinderGeometry(0.18, 0.42, 0.32, 10); place(head, x + Math.sin(ang) * 1.6, CURB + 4.95, z + Math.cos(ang) * 1.6); solid(head, '#ffd23c');
  COLL.push({ x, z, r: 0.3 });
}
function trafficLight(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 8); place(g, x, CURB + 2.8, z); solid(g, '#ffd23c');
  const arm = new THREE.BoxGeometry(0.14, 0.14, 4.2); arm.translate(0, 0, 2.1); place(arm, x, CURB + 5.4, z, ang); solid(arm, '#ffd23c');
  const hx = x + Math.sin(ang) * 3.6, hz = z + Math.cos(ang) * 3.6;
  const box = new THREE.BoxGeometry(0.5, 1.4, 0.45); place(box, hx, CURB + 4.6, hz, ang); solid(box, '#2b2340');
  const px = Math.cos(ang), pz = -Math.sin(ang);
  ['#ff3d6e', '#ffd23c', '#7dff6b'].forEach((c, i) => { for (const sd of [-1, 1]) { const l = new THREE.SphereGeometry(0.14, 10, 8); place(l, hx + px * 0.24 * sd, CURB + 5.05 - i * 0.43, hz + pz * 0.24 * sd); CB.geom(l, c); } });
  COLL.push({ x, z, r: 0.3 });
}
function hydrant(x, z) {
  const b = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10); place(b, x, CURB + 0.35, z); solid(b, '#ff3d6e');
  const t = new THREE.SphereGeometry(0.22, 10, 6, 0, TAU, 0, Math.PI / 2); place(t, x, CURB + 0.7, z); solid(t, '#ff3d6e');
  const n = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8); place(n, x, CURB + 0.45, z, 0, 0, Math.PI / 2); solid(n, '#ffd23c');
  COLL.push({ x, z, r: 0.35 });
}
function bin(x, z, col = '#22c4b4') {
  const b = new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12); place(b, x, CURB + 0.48, z); solid(b, col);
  const l = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12); place(l, x, CURB + 1.0, z); solid(l, '#2b2340');
  COLL.push({ x, z, r: 0.45 });
}
function dumpster(x, z, ang) {
  const g = new THREE.BoxGeometry(2.4, 1.3, 1.3); g.translate(0, 0.65, 0); place(g, x, CURB, z, ang); solid(g, '#2f9e5a');
  const l = new THREE.BoxGeometry(2.5, 0.12, 1.4); l.rotateX(-0.12); l.translate(0, 1.36, 0); place(l, x, CURB, z, ang); solid(l, '#1f6e3f');
  const s = Math.abs(Math.sin(ang)) > 0.5; COLL.push(s ? { x0: x - 0.7, x1: x + 0.7, z0: z - 1.25, z1: z + 1.25 } : { x0: x - 1.25, x1: x + 1.25, z0: z - 0.7, z1: z + 0.7 });
}
function car(x, z, ang, body, roofC) {
  const grp = []; const along = Math.abs(Math.sin(ang)) > 0.5; // along x
  const add = (g, col, ol = true) => { place(g, x, 0, z, ang); solid(g, col, ol); };
  const b = new THREE.BoxGeometry(1.9, 0.75, 4.3); b.translate(0, 0.72, 0); add(b, body);
  const c = new THREE.BoxGeometry(1.7, 0.7, 2.2); c.translate(0, 1.45, -0.2); add(c, roofC || body);
  const wF = new THREE.BoxGeometry(1.5, 0.48, 0.05); wF.translate(0, 1.47, 0.9); add(wF, '#7fe8ff', false);
  const wB = new THREE.BoxGeometry(1.5, 0.48, 0.05); wB.translate(0, 1.47, -1.31); add(wB, '#7fe8ff', false);
  for (const s of [-1, 1]) { const ws = new THREE.BoxGeometry(0.05, 0.46, 1.8); ws.translate(s * 0.86, 1.47, -0.2); add(ws, '#7fe8ff', false); }
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2b2340'); }
  const hl = new THREE.BoxGeometry(1.5, 0.18, 0.06); hl.translate(0, 0.86, 2.16); add(hl, '#fff6b0', false);
  const tl = new THREE.BoxGeometry(1.5, 0.16, 0.06); tl.translate(0, 0.86, -2.16); add(tl, '#ff3d6e', false);
  COLL.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1.0, z1: z + 1.0 } : { x0: x - 1.0, x1: x + 1.0, z0: z - 2.2, z1: z + 2.2 });
  BLD.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1, z1: z + 1, h: 1.8 } : { x0: x - 1, x1: x + 1, z0: z - 2.2, z1: z + 2.2, h: 1.8 });
}
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  lamp(sx * 10.2, sz * 16, sx > 0 ? -Math.PI / 2 : Math.PI / 2); lamp(sx * 16, sz * 10.2, sz > 0 ? Math.PI : 0);
  lamp(sx * 10.2, sz * 34, sx > 0 ? -Math.PI / 2 : Math.PI / 2); lamp(sx * 34, sz * 10.2, sz > 0 ? Math.PI : 0);
  trafficLight(sx * 7.7, sz * 7.7, sx * sz > 0 ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : (sz > 0 ? Math.PI : 0));
  hydrant(sx * 8.1, sz * 21); bin(sx * 24, sz * 8.0, sx * sz > 0 ? '#22c4b4' : '#6b4cff');
}
dumpster(28, -9.6, 0); dumpster(-9.6, 28, Math.PI / 2); dumpster(-30, 9.6, 0);
car(20.5, -5.8, Math.PI / 2, '#ffd23c', '#ffd23c'); // taxi on the east arm, north curb
car(-28, 5.8, -Math.PI / 2, '#ff5fa2', '#fff0d6'); // pink coupe, west arm
car(5.8, -30, Math.PI, '#2fd3ff', '#1f7bff'); // blue hatch, north arm
// a taxi sign on the yellow car
{ const g = new THREE.BoxGeometry(0.7, 0.28, 0.3); place(g, 20.5, 1.95, -5.8, Math.PI / 2); solid(g, '#fff0d6'); }
// bunting across the north and east arms
function bunting(ax0, az0, ax1, az1, y) {
  const n = 16, cols = ['#ff3d6e', '#ffd23c', '#22c4b4', '#6b4cff', '#7dff6b'];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.8) / n, sag = (t) => -Math.sin(t * Math.PI) * 1.2;
    const a = [lerp(ax0, ax1, t0), y + sag(t0), lerp(az0, az1, t0)], b = [lerp(ax0, ax1, t1), y + sag(t1), lerp(az0, az1, t1)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.75, (a[2] + b[2]) / 2];
    DB.quad(a, b, m, m, [0, 0, 1, 1], cols[i % 5], T.white);
  }
}
bunting(-SW, -24, SW, -24, 9.5); bunting(26, -SW, 26, SW, 9.0); bunting(-SW, 30, SW, 30, 8.6);

const cityMesh = CB.build(CITY_MAT); cityMesh.castShadow = true; cityMesh.receiveShadow = true; cityMesh.frustumCulled = false; scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); groundMesh.receiveShadow = true; groundMesh.frustumCulled = false; scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); decalMesh.receiveShadow = true; decalMesh.frustumCulled = false; scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);

// sky dome: gradient + cartoon sun + outlined clouds
(function sky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#070620') }, mid: { value: new THREE.Color('#1d1650') }, hor: { value: new THREE.Color('#5b2f78') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
      void main(){ float y = vP.y; vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
        c = mix(c, c * 0.93, step(0.5, fract((y) * 26.0)) * smoothstep(0.1, 0.6, y) * 0.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m); s.renderOrder = -10; scene.add(s); window.__sky = s;
  const cc = document.createElement('canvas'); cc.width = 512; cc.height = 256; const c = cc.getContext('2d');
  const blobs = [[120, 170, 70], [210, 130, 90], [320, 140, 80], [400, 175, 60], [260, 185, 70]];
  c.fillStyle = INK; blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.fill(); }); c.fillRect(60, 175, 400, 70);
  c.fillStyle = '#fff'; blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(66, 175, 388, 61);
  c.fillStyle = '#d9e6ff'; c.fillRect(66, 205, 388, 31);
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, color: '#5d5590' })); const a = i / 9 * TAU + 0.3, r = 300;
    sp.position.set(Math.cos(a) * r, 70 + (i % 3) * 30, Math.sin(a) * r); sp.scale.set(110 + (i % 2) * 40, 55 + (i % 2) * 20, 1); sp.renderOrder = -9; s.add(sp);
  }
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const g = sc.getContext('2d');
  g.fillStyle = INK; g.beginPath(); for (let k = 0; k < 24; k++) { const r = k % 2 ? 100 : 124, a = k / 24 * TAU; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill();
  g.clearRect(0, 0, 256, 256); g.fillStyle = INK; g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.fill(); g.fillStyle = '#f4f1ff'; g.beginPath(); g.arc(128, 128, 86, 0, TAU); g.fill();
  g.fillStyle = '#cfc8ee'; [[100, 105, 18], [160, 150, 24], [120, 170, 10], [165, 95, 9]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, fog: false, depthWrite: false })); sunS.position.copy(SUN_DIR).multiplyScalar(330); sunS.scale.set(46, 46, 1); sunS.renderOrder = -9; s.add(sunS);
})();

// ---------------- characters: procedural stylised rigs (groups of toon parts with outline hulls) ----------------
const G = {
  sph: (rx, ry, rz, ws = 14, hs = 10) => new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz),
  cap: (r, len, rs = 10) => new THREE.CapsuleGeometry(r, len, 4, rs),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
};
function part(parent, geom, col, x = 0, y = 0, z = 0, o = {}) {
  bakeColor(geom, col); if (o.outline !== false) addOdir(geom);
  const m = new THREE.Mesh(geom, o.mat || parent.userData.mat || parent.parent?.userData.mat);
  m.position.set(x, y, z); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  geom.computeBoundingSphere(); m.castShadow = o.shadow !== false && geom.boundingSphere.radius > 0.1; parent.add(m);
  if (o.outline !== false) { const ol = new THREE.Mesh(geom, o.olMat || OUT_CHAR); ol.castShadow = false; m.add(ol); }
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
const HERO_D = { hip: 0.8, torsoY: 0.06, neckY: 0.66, legX: 0.15, thigh: 0.36, shin: 0.36, shX: 0.37, shY: 0.5, upper: 0.27, fore: 0.25 };
function buildHero() {
  const mat = toonMat(); const J = skeleton(HERO_D, mat), d = HERO_D;
  const SK = '#5ccf3a', SK2 = '#49b52c', PL = '#ffd75e', SH = '#b8672b', RIM = '#ffb43c', BAND = '#1f7bff', WRAP = '#fff0d6', BELT = '#8a4b22';
  // hips + belt
  part(J.hips, G.sph(0.25, 0.17, 0.21), SK, 0, 0.02, 0);
  part(J.hips, G.cyl(0.27, 0.27, 0.12, 16), BELT, 0, 0.12, 0);
  part(J.hips, G.box(0.14, 0.12, 0.06), '#ffd23c', 0, 0.12, 0.25);
  // torso: chest, plastron, shell + rim, X straps
  part(J.torso, G.sph(0.31, 0.36, 0.25), SK, 0, 0.3, 0);
  part(J.torso, G.sph(0.25, 0.31, 0.12), PL, 0, 0.28, 0.15);
  part(J.torso, G.box(0.36, 0.035, 0.04), '#d9a83a', 0, 0.36, 0.265, { outline: false, rot: [0.15, 0, 0] });
  part(J.torso, G.box(0.34, 0.035, 0.04), '#d9a83a', 0, 0.2, 0.262, { outline: false, rot: [-0.1, 0, 0] });
  part(J.torso, G.sph(0.4, 0.45, 0.13), RIM, 0, 0.32, -0.12);
  part(J.torso, G.sph(0.35, 0.41, 0.22), SH, 0, 0.33, -0.17);
  part(J.torso, G.sph(0.14, 0.14, 0.06), '#8f4c1e', 0, 0.38, -0.37, { outline: false });
  part(J.torso, G.sph(0.1, 0.1, 0.05), '#8f4c1e', 0.17, 0.2, -0.33, { outline: false });
  part(J.torso, G.sph(0.1, 0.1, 0.05), '#8f4c1e', -0.17, 0.2, -0.33, { outline: false });
  for (const s of [-1, 1]) part(J.torso, G.box(0.07, 0.62, 0.05), BELT, s * 0.06, 0.32, 0.25, { rot: [0.1, 0, s * 0.55], outline: false });
  // sword hilts on the back (scabbards)
  for (const s of [-1, 1]) part(J.torso, G.cyl(0.05, 0.05, 0.7, 8), '#3a2a7a', s * 0.18, 0.42, -0.36, { rot: [0.2, 0, s * 0.5] });
  // head: big round head, snout, bandana band + knot + tails, eyes
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.27, 0.25, 0.26), SK, 0, 0.2, 0.0);
  part(head, G.sph(0.19, 0.13, 0.15), SK2, 0, 0.12, 0.14);
  part(head, G.box(0.16, 0.025, 0.02), '#14101f', 0, 0.08, 0.285, { outline: false, rot: [0, 0, 0.0] });
  part(head, G.cyl(0.281, 0.281, 0.12, 22), BAND, 0, 0.24, 0.0);
  part(head, G.sph(0.075, 0.06, 0.03), '#fff', 0.1, 0.245, 0.275, { outline: false });
  part(head, G.sph(0.075, 0.06, 0.03), '#fff', -0.1, 0.245, 0.275, { outline: false });
  part(head, G.sph(0.03, 0.04, 0.02), '#14101f', 0.09, 0.245, 0.3, { outline: false });
  part(head, G.sph(0.03, 0.04, 0.02), '#14101f', -0.09, 0.245, 0.3, { outline: false });
  part(head, G.box(0.13, 0.03, 0.03), '#14101f', 0.1, 0.305, 0.27, { outline: false, rot: [0, 0, -0.25] });
  part(head, G.box(0.13, 0.03, 0.03), '#14101f', -0.1, 0.305, 0.27, { outline: false, rot: [0, 0, 0.25] });
  part(head, G.sph(0.07, 0.07, 0.06), BAND, 0, 0.24, -0.29);
  J.tails = [];
  for (const s of [-1, 1]) { const t = grp(head, s * 0.04, 0.24, -0.3); t.userData.mat = mat; part(t, G.box(0.07, 0.4, 0.025), BAND, 0, -0.18, 0); t.rotation.set(0.5, 0, s * 0.2); J.tails.push(t); }
  // arms
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.11, 0.11, 0.11), SK, 0, 0, 0);
    part(J['sh' + k], G.cap(0.085, d.upper - 0.08), SK, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(0.08, d.fore - 0.08), SK, 0, -d.fore / 2, 0);
    part(J['el' + k], G.cyl(0.095, 0.095, 0.1, 10), WRAP, 0, -d.fore + 0.06, 0);
    part(J['sh' + k], G.cyl(0.1, 0.1, 0.08, 10), WRAP, 0, -d.upper + 0.06, 0, { outline: false });
    part(J['ha' + k], G.sph(0.105, 0.1, 0.1), SK, 0, -0.04, 0);
    // sword: grip / guard / blade (blade along +y of the sword group)
    const sw = J['sw' + k] = grp(J['ha' + k], 0, -0.05, 0); sw.userData.mat = mat;
    part(sw, G.cyl(0.03, 0.03, 0.24, 8), '#3a2a7a', 0, 0.0, 0);
    part(sw, G.cyl(0.075, 0.075, 0.03, 12), '#ffd23c', 0, 0.13, 0);
    part(sw, G.box(0.055, 0.78, 0.016), '#eafcff', 0, 0.54, 0);
    part(sw, G.box(0.02, 0.76, 0.02), '#7fd6ff', 0.026, 0.54, 0, { outline: false });
    part(sw, G.cyl(0.0, 0.028, 0.08, 4), '#eafcff', 0, 0.97, 0, { outline: false });
  }
  // legs
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.105, d.thigh - 0.1), SK, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.sph(0.1, 0.09, 0.08), WRAP, 0, 0, 0.06);
    part(J['kn' + k], G.cap(0.095, d.shin - 0.12), SK, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.115, 0.075, 0.17), SK2, 0, -0.03, 0.06);
    part(J['kn' + k], G.cyl(0.105, 0.105, 0.08, 10), WRAP, 0, -d.shin + 0.1, 0, { outline: false });
  }
  J.kind = 'hero'; return J;
}
const THUG_D = { hip: 0.92, torsoY: 0.06, neckY: 0.64, legX: 0.13, thigh: 0.42, shin: 0.41, shX: 0.31, shY: 0.52, upper: 0.3, fore: 0.27 };
const THUG_LOOKS = [
  { jacket: '#ff3d6e', pants: '#2f5bd3', skin: '#c98a5a', hair: 'mohawk', hairC: '#ffe14d', shoe: '#fff', weapon: null, sleeve: true },
  { jacket: '#7b4dff', pants: '#2c2c3c', skin: '#f0b989', hair: 'beanie', hairC: '#ff8a2a', shoe: '#ff3d6e', weapon: 'pipe', sleeve: true },
  { jacket: '#ff9f1c', pants: '#3d6bff', skin: '#8d5a3b', hair: 'cap', hairC: '#1fd3c6', shoe: '#fff', weapon: null, sleeve: false },
  { jacket: '#23c26b', pants: '#3a2f5a', skin: '#e8a878', hair: 'spikes', hairC: '#ff4fd8', shoe: '#ffd23c', weapon: 'bat', sleeve: false },
  { jacket: '#f2f2f2', pants: '#c42b48', skin: '#b9784b', hair: 'bald', hairC: '#3a2416', shoe: '#14101f', weapon: null, sleeve: false, big: true },
];
function buildThug(look) {
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
  part(head, G.sph(0.045, 0.05, 0.05), skin, 0, 0.18, 0.18, { outline: false });
  part(head, G.box(0.28, 0.065, 0.05), '#14101f', 0, 0.245, 0.15, { outline: false });
  part(head, G.box(0.1, 0.02, 0.02), '#7a2a2a', 0, 0.1, 0.17, { outline: false });
  if (look.hair === 'mohawk') part(head, G.box(0.07, 0.16, 0.34), look.hairC, 0, 0.4, -0.01);
  if (look.hair === 'beanie') { part(head, G.sph(0.185, 0.14, 0.19), look.hairC, 0, 0.3, 0.0); part(head, G.cyl(0.19, 0.19, 0.06, 14), '#fff0d6', 0, 0.27, 0); }
  if (look.hair === 'cap') { part(head, G.sph(0.18, 0.12, 0.19, 16, 8), look.hairC, 0, 0.31, 0.0); part(head, G.box(0.22, 0.03, 0.18), look.hairC, 0, 0.3, -0.24); }
  if (look.hair === 'spikes') for (let i = 0; i < 5; i++) part(head, G.cyl(0, 0.06, 0.2, 5), look.hairC, (i - 2) * 0.07, 0.42, -0.02 - Math.abs(i - 2) * 0.02, { rot: [-0.3, 0, (i - 2) * -0.25] });
  if (look.hair === 'bald') part(head, G.sph(0.13, 0.08, 0.06), look.hairC, 0, 0.1, 0.13);
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(look.big ? 0.14 : 0.1, 0.1, 0.1), look.big ? skin : jacket, 0, 0, 0);
    part(J['sh' + k], G.cap(look.big ? 0.11 : 0.08, d.upper - 0.08), look.big ? skin : jacket, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(look.big ? 0.1 : 0.07, d.fore - 0.08), look.sleeve ? jacket : skin, 0, -d.fore / 2, 0);
    part(J['ha' + k], G.sph(look.big ? 0.12 : 0.095, 0.09, 0.09), skin, 0, -0.03, 0);
    part(J['lg' + k], G.cap(0.1, d.thigh - 0.1), pants, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.09, d.shin - 0.1), pants, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.11, 0.08, 0.18), look.shoe, 0, -0.03, 0.06);
    part(J['ft' + k], G.box(0.2, 0.03, 0.34), '#14101f', 0, -0.09, 0.06, { outline: false });
  }
  if (look.weapon) {
    const w = J.swR = grp(J.haR, 0, -0.04, 0); w.userData.mat = mat;
    if (look.weapon === 'pipe') { part(w, G.cyl(0.04, 0.04, 0.95, 8), '#9aa3c5', 0, 0.35, 0); part(w, G.cyl(0.06, 0.06, 0.1, 8), '#5f6688', 0, 0.8, 0); }
    else { part(w, G.cyl(0.075, 0.03, 0.95, 10), '#d9944f', 0, 0.38, 0); part(w, G.cyl(0.035, 0.035, 0.08, 8), '#14101f', 0, -0.06, 0); }
  }
  J.kind = 'thug'; return J;
}

// ---------------- poses (code-driven animation) ----------------
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
const HERO_POSES = {
  idle(t) {
    const p = blank(); legsStance(p, 0.16, 0.42); const b = Math.sin(t * 3.2) * 0.025; p.y += b;
    p.torso = [0.14, 0.32, 0]; p.neck = [-0.1, -0.3, 0]; p.hips = [0, -0.25, 0];
    p.shL = [-0.55, 0.0, 0.42]; p.elL = [-1.1, 0, 0]; p.haL = [0.15, 0, 0]; p.swL = [Math.PI / 2 + 0.55, 0, 0.35];
    p.shR = [-0.2, 0.0, -0.32]; p.elR = [-0.6, 0, 0]; p.haR = [0, 0, 0]; p.swR = [Math.PI / 2 - 0.35, 0, -0.9];
    return p;
  },
  run(t, sp) {
    const p = blank(), ph = t * (7 + sp * 0.9); runLegs(p, ph, clamp(sp / 6, 0.4, 1));
    p.torso = [0.42, Math.sin(ph) * 0.15, 0]; p.neck = [-0.32, -Math.sin(ph) * 0.12, 0];
    p.shL = [1.0, 0, 0.35]; p.elL = [-0.35, 0, 0]; p.swL = [Math.PI / 2 + 1.1, 0, 0.2];
    p.shR = [1.0, 0, -0.35]; p.elR = [-0.35, 0, 0]; p.swR = [Math.PI / 2 + 1.1, 0, -0.2];
    return p;
  },
  atk1(u) { // right blade, wide horizontal slash right -> left
    const p = blank(); legsStance(p, 0.2, 0.55); const a = ease(clamp((u - 0.12) / 0.33, 0, 1));
    p.torso = [0.2, lerp(-0.85, 0.95, a), 0]; p.hips = [0, lerp(-0.4, 0.45, a), 0]; p.neck = [-0.1, lerp(0.6, -0.6, a), 0];
    p.shR = [lerp(-1.1, -1.45, a), 0, lerp(-1.25, 0.55, a)]; p.elR = [lerp(-0.7, -0.1, a), 0, 0]; p.swR = [Math.PI / 2, 0, lerp(-0.6, 0.3, a)];
    p.shL = [-0.4, 0, 0.5]; p.elL = [-1.2, 0, 0]; p.swL = [Math.PI / 2 + 0.6, 0, 0.3];
    p.lgL = [-0.7, 0, 0.18]; p.knL = [0.75, 0, 0]; p.lgR = [0.35, 0, -0.18]; p.knR = [0.3, 0, 0];
    return p;
  },
  atk2(u) { // left blade backhand left -> right
    const p = blank(); legsStance(p, 0.2, 0.55); const a = ease(clamp((u - 0.12) / 0.33, 0, 1));
    p.torso = [0.2, lerp(0.85, -0.95, a), 0]; p.hips = [0, lerp(0.4, -0.45, a), 0]; p.neck = [-0.1, lerp(-0.6, 0.6, a), 0];
    p.shL = [lerp(-1.1, -1.45, a), 0, lerp(1.25, -0.55, a)]; p.elL = [lerp(-0.7, -0.1, a), 0, 0]; p.swL = [Math.PI / 2, 0, lerp(0.6, -0.3, a)];
    p.shR = [-0.4, 0, -0.5]; p.elR = [-1.2, 0, 0]; p.swR = [Math.PI / 2 + 0.6, 0, -0.3];
    p.lgR = [-0.7, 0, -0.18]; p.knR = [0.75, 0, 0]; p.lgL = [0.35, 0, 0.18]; p.knL = [0.3, 0, 0];
    return p;
  },
  atk3(u) { // spinning double slash with a hop
    const p = blank(); const a = ease(clamp((u - 0.15) / 0.5, 0, 1));
    legsStance(p, 0.24, 0.35); p.y = Math.sin(clamp((u - 0.1) / 0.6, 0, 1) * Math.PI) * 0.45;
    p.tilt = [0, -a * TAU, 0];
    p.lgL = [-0.9, 0, 0.1]; p.knL = [1.4, 0, 0]; p.lgR = [-0.2, 0, -0.15]; p.knR = [0.6, 0, 0];
    p.shL = [-0.15, 0, 1.45]; p.shR = [-0.15, 0, -1.45]; p.elL = [-0.1, 0, 0]; p.elR = [-0.1, 0, 0];
    p.swL = [Math.PI / 2, 0, -0.2]; p.swR = [Math.PI / 2, 0, 0.2]; p.torso = [0.1, 0, 0];
    if (u < 0.15) { p.shL = [-0.8, 0, 0.3]; p.shR = [-0.8, 0, -0.3]; p.elL = p.elR = [-1.3, 0, 0]; p.torso = [0.35, 0.6, 0]; p.y = -0.15; }
    return p;
  },
  jump(vy) {
    const p = blank(); const up = vy > 0;
    p.lgL = [-1.0, 0, 0.15]; p.knL = [1.7, 0, 0]; p.lgR = [up ? -0.3 : -0.8, 0, -0.15]; p.knR = [up ? 0.7 : 1.5, 0, 0];
    p.shL = [-0.3, 0, 1.0]; p.shR = [-0.3, 0, -1.0]; p.elL = [-0.6, 0, 0]; p.elR = [-0.6, 0, 0];
    p.swL = [Math.PI / 2 + 0.9, 0, 0]; p.swR = [Math.PI / 2 + 0.9, 0, 0]; p.torso = [0.2, 0, 0]; p.neck = [-0.1, 0, 0];
    return p;
  },
  airatk(u) { // forward flip into a downward X-cut
    const p = HERO_POSES.jump(-1); const a = clamp(u / 0.7, 0, 1);
    p.tilt = [ease(a) * TAU, 0, 0]; p.lgL = p.lgR = [-1.3, 0, 0]; p.knL = p.knR = [2.0, 0, 0];
    p.shL = [lerp(-2.8, -0.9, a), 0, 0.3]; p.shR = [lerp(-2.8, -0.9, a), 0, -0.3]; p.elL = p.elR = [-0.2, 0, 0];
    p.swL = [Math.PI / 2, 0, 0.5]; p.swR = [Math.PI / 2, 0, -0.5];
    return p;
  },
  hurt(u) {
    const p = blank(); legsStance(p, 0.16, 0.5); const k = 1 - u;
    p.torso = [-0.45 * k, 0.2, 0]; p.neck = [-0.5 * k, 0, 0]; p.shL = [-0.8, 0, 0.9]; p.shR = [-0.8, 0, -0.9]; p.elL = p.elR = [-0.7, 0, 0];
    p.swL = [Math.PI / 2 + 0.8, 0, 0]; p.swR = [Math.PI / 2 + 0.8, 0, 0];
    return p;
  },
  down(u, ground) {
    const p = blank(); p.tilt = [-Math.PI / 2 + 0.08, 0, 0]; p.ty = ground ? 0.3 : 0.6;
    p.lgL = [-0.6, 0, 0.3]; p.knL = [0.9, 0, 0]; p.lgR = [-0.2, 0, -0.2]; p.knR = [0.4, 0, 0];
    p.shL = [-2.6, 0, 0.6]; p.shR = [-2.4, 0, -0.9]; p.elL = p.elR = [-0.4, 0, 0]; p.neck = [0.4, 0, 0];
    p.swL = [Math.PI / 2, 0, 0]; p.swR = [Math.PI / 2, 0, 0];
    if (!ground) { p.tilt = [-Math.PI / 2 * clamp(u * 2.2, 0, 1), 0, 0]; }
    return p;
  },
  getup(u) { const p = HERO_POSES.idle(0); legsStance(p, 0.2, 1.2 * (1 - u)); p.torso = [0.8 * (1 - u), 0, 0]; return p; },
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

// ---------------- comic FX: hit stars, onomatopoeia, dust puffs, slash crescents, lock ring ----------------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const FXT = {
  star: canvasTex(256, 256, (c) => {
    const pts = (R, r, n) => { c.beginPath(); for (let k = 0; k < n * 2; k++) { const rr = k % 2 ? r : R * (0.85 + 0.15 * ((k * 7) % 3) / 2), a = k / (n * 2) * TAU; c.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } c.closePath(); };
    c.fillStyle = INK; pts(126, 58, 11); c.fill(); c.fillStyle = '#ffd23c'; pts(112, 50, 11); c.fill(); c.fillStyle = '#fff'; pts(70, 34, 11); c.fill();
  }),
  puff: canvasTex(128, 128, (c) => {
    const b = [[64, 70, 34], [40, 76, 24], [88, 76, 24], [64, 48, 24]];
    c.fillStyle = INK; b.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r + 6, 0, TAU); c.fill(); });
    c.fillStyle = '#fff'; b.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    c.fillStyle = '#e4dcf2'; c.beginPath(); c.arc(70, 84, 22, 0, TAU); c.fill();
  }),
  bang: canvasTex(64, 128, (c) => { comicText(c, '!', 32, 66, 104, '#ffd23c', '#ff3d6e', { shadow: false }); }),
  words: ['POW!', 'WHAM!', 'SLASH!', 'KRAK!', 'BAM!', 'THWACK!', 'SHING!'].map((w, i) => canvasTex(512, 192, (c) => {
    const fills = ['#ffd23c', '#ff5fa2', '#7fe8ff', '#7dff6b', '#ff8a3d', '#ffd23c', '#c9a6ff'];
    // burst behind
    c.fillStyle = INK; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 62 : 92, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 54 : 82, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    halftone(c, 60, 20, 392, 152, 'rgba(255,95,162,.35)', 12, 4, 1);
    comicText(c, w, 256, 100, w.length > 5 ? 84 : 100, fills[i], null, { sx: 1 });
  })),
};
const fxLayer = new THREE.Group(); scene.add(fxLayer);
const SPR = [];
for (let i = 0; i < 28; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, fog: false })); s.visible = false; s.renderOrder = 20; fxLayer.add(s); SPR.push({ s, t: 0, life: 0 }); }
function spawnSprite(tex, pos, size, life, o = {}) {
  let f = SPR.find((q) => !q.s.visible) || SPR.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
  f.s.material.map = tex; f.s.material.needsUpdate = true; f.s.material.opacity = 1; f.s.material.rotation = o.rot || 0;
  f.s.material.depthTest = !!o.depth; f.s.renderOrder = o.depth ? 5 : 20;
  f.s.position.copy(pos); f.s.visible = true; f.t = 0; f.life = life; f.size = size; f.aspect = o.aspect || 1; f.vel = o.vel ? o.vel.clone() : null; f.kind = o.kind || 'pop'; f.spin = o.spin || 0;
  return f;
}
function updateSprites(dt) {
  for (const f of SPR) {
    if (!f.s.visible) continue; f.t += dt; const u = f.t / f.life; if (u >= 1) { f.s.visible = false; continue; }
    let sc;
    if (f.kind === 'pop') sc = u < 0.18 ? lerp(0.3, 1.2, u / 0.18) : u < 0.3 ? lerp(1.2, 1, (u - 0.18) / 0.12) : 1;
    else if (f.kind === 'word') { sc = u < 0.12 ? lerp(0.4, 1.15, u / 0.12) : 1.0; f.s.position.y += dt * 0.8; }
    else { sc = lerp(0.5, 1.3, u); }
    if (f.vel) { f.s.position.addScaledVector(f.vel, dt); f.vel.multiplyScalar(Math.exp(-dt * 4)); }
    f.s.material.rotation += f.spin * dt;
    f.s.scale.set(f.size * sc * f.aspect, f.size * sc, 1);
    f.s.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
  }
}
// slash crescents
function crescentGeo(arc, r0, w) {
  const N = 28, P = [], C = [], I = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = -arc / 2 + arc * t, ww = w * Math.pow(Math.sin(t * Math.PI), 0.7) * (0.35 + 0.65 * t);
    P.push(Math.sin(a) * r0, 0, Math.cos(a) * r0, Math.sin(a) * (r0 + ww), 0, Math.cos(a) * (r0 + ww));
    C.push(0.5, 0.95, 1, 1, 1, 1);
    if (i < N) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); return g;
}
const SLASH_G = { side: crescentGeo(2.4, 0.9, 0.85), spin: crescentGeo(TAU * 0.98, 1.0, 0.9), down: crescentGeo(2.0, 0.9, 0.9) };
const SLASHES = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(SLASH_G.side, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const ol = new THREE.Mesh(SLASH_G.side, new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ol.scale.set(1.06, 1, 1.06); ol.position.y = -0.01; ol.renderOrder = 6; m.renderOrder = 7; m.add(ol);
  m.visible = false; scene.add(m); SLASHES.push({ m, ol, t: 0, life: 0.2 });
}
function spawnSlash(pos, yaw, kind, roll, dir = 1) {
  const f = SLASHES.find((q) => !q.m.visible) || SLASHES[0];
  f.m.geometry = f.ol.geometry = SLASH_G[kind]; f.m.visible = true; f.t = 0; f.life = kind === 'spin' ? 0.28 : 0.2;
  f.m.position.copy(pos); f.m.rotation.set(0, 0, 0); f.m.rotation.order = 'YXZ'; f.m.rotation.y = yaw; f.m.rotation.z = roll || 0;
  if (kind === 'down') { f.m.rotation.x = 0; f.m.rotation.z = Math.PI / 2; }
  f.m.scale.set(dir, 1, 1);
}
function updateSlashes(dt) {
  for (const f of SLASHES) { if (!f.m.visible) continue; f.t += dt; const u = f.t / f.life; if (u >= 1) { f.m.visible = false; continue; }
    const o = 1 - u * u; f.m.material.opacity = o * 0.95; f.ol.material.opacity = o; const s = 0.85 + 0.25 * u; f.m.scale.y = 1; f.m.scale.z = s; f.m.scale.x = Math.sign(f.m.scale.x) * s; }
}
// soft lock ring under the target
const lockRing = new THREE.Group();
{ const a = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 40, 1), new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, opacity: 0.9 }));
  const b = new THREE.Mesh(new THREE.RingGeometry(0.67, 0.8, 40, 1, 0, TAU * 0.8), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, depthWrite: false }));
  for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; lockRing.add(m); } b.position.y = 0.005; lockRing.userData.b = b; }
lockRing.visible = false; scene.add(lockRing);

// ---------------- tiny WebAudio sfx (created on first gesture) ----------------
let AC = null, NOISE = null;
function audioInit() {
  if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); const n = AC.sampleRate * 0.4, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; NOISE = b; } catch (e) { AC = null; }
}
function sfx(kind) {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  try {
    const g = AC.createGain(); g.connect(AC.destination);
    if (kind === 'swing') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.12); f.Q.value = 1.4; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.start(t); s.stop(t + 0.18); }
    else if (kind === 'hit' || kind === 'heavy') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(kind === 'heavy' ? 180 : 260, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12); o.connect(g);
      const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; s.connect(f); f.connect(g);
      g.gain.setValueAtTime(kind === 'heavy' ? 0.26 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.start(t); o.stop(t + 0.16); s.start(t); s.stop(t + 0.12); }
    else if (kind === 'hurt') { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); o.connect(g); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.start(t); o.stop(t + 0.24); }
    else if (kind === 'jump') { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12); o.connect(g); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.start(t); o.stop(t + 0.15); }
    else if (kind === 'ko') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(520, t); o.frequency.setValueAtTime(780, t + 0.08); o.frequency.setValueAtTime(1040, t + 0.16); o.connect(g); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.32); }
  } catch (e) { /* audio is optional */ }
}

// ---------------- fighters ----------------
const S = { time: 0, kills: 0, hits: 0, combo: 0, comboT: 0, hitstop: 0, shake: 0, playerDowns: 0, maxCombo: 0 };
class Fighter {
  constructor(J, o) {
    this.J = J; this.root = J.root; scene.add(this.root);
    this.pos = new THREE.Vector3(o.x, 0, o.z); this.vel = new THREE.Vector2(); this.kb = new THREE.Vector2();
    this.y = 0; this.vy = 0; this.yaw = o.yaw || 0; this.hp = this.maxHp = o.hp; this.r = o.r || 0.42;
    this.state = 'idle'; this.st = 0; this.at = Math.random() * 10; this.flash = 0; this.inv = 0; this.scale = o.scale || 1;
    this.root.scale.setScalar(this.scale); this.speed = 0;
  }
  set(st) { this.state = st; this.st = 0; }
  get alive() { return this.state !== 'dead'; }
  sync(dt) {
    this.root.position.set(this.pos.x, this.pos.y + this.y, this.pos.z); this.root.rotation.y = this.yaw;
    this.flash = Math.max(0, this.flash - dt * 6); this.J.mat.userData.flash.value = this.flash > 0 ? Math.min(1, this.flash) * 0.85 : 0;
  }
}
const hero = new Fighter(buildHero(), { x: 0, z: 31, yaw: Math.PI, hp: 100, r: 0.45 });
hero.J.mat.userData.flashC.value.set('#fff');
const POSTS = [
  { x: -2.8, z: 17, look: 0, yaw: Math.PI },        // south arm pair (first fight)
  { x: 2.6, z: 18.5, look: 1, yaw: Math.PI },
  { x: 19, z: 2, look: 2, yaw: -Math.PI / 2 },     // east arm
  { x: 2, z: -19, look: 3, yaw: 0 },              // north arm
  { x: -18, z: 1, look: 4, yaw: Math.PI / 2 },     // west arm: the bruiser
];
const enemies = POSTS.map((p, i) => {
  const look = THUG_LOOKS[p.look], big = !!look.big;
  const e = new Fighter(buildThug(look), { x: p.x, z: p.z, yaw: p.yaw, hp: big ? 24 : 12, scale: big ? 1.2 : 1, r: big ? 0.55 : 0.42 });
  e.J.mat.userData.flashC.value.set('#fff'); e.post = p; e.big = big; e.armed = !!look.weapon; e.cool = 0; e.slot = (i / POSTS.length) * TAU; e.respawn = 0; e.id = i;
  // hp pip above the head
  const c = document.createElement('canvas'); c.width = 128; c.height = 20; e.hpC = c; e.hpT = new THREE.CanvasTexture(c); e.hpT.colorSpace = THREE.SRGBColorSpace;
  e.hpS = new THREE.Sprite(new THREE.SpriteMaterial({ map: e.hpT, depthTest: false, transparent: true, fog: false })); e.hpS.scale.set(1.1, 0.17, 1); e.hpS.renderOrder = 15; e.hpS.visible = false; scene.add(e.hpS); e.hpShow = 0;
  e.bang = null; return e;
});
function drawHp(e) {
  const c = e.hpC.getContext('2d'); c.clearRect(0, 0, 128, 20); c.fillStyle = INK; c.fillRect(0, 0, 128, 20);
  c.fillStyle = '#ff3d6e'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 12); c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 4); e.hpT.needsUpdate = true;
}
const ALL = [hero, ...enemies];

// ---------------- world collision ----------------
const WALK = SW - 0.45;
function collide(f) {
  const p = f.pos; p.x = clamp(p.x, -LIM, LIM); p.z = clamp(p.z, -LIM, LIM);
  if (Math.abs(p.x) > WALK && Math.abs(p.z) > WALK) { // inside a corner block: push to the nearer street
    if (Math.abs(p.x) - WALK < Math.abs(p.z) - WALK) p.x = Math.sign(p.x) * WALK; else p.z = Math.sign(p.z) * WALK;
  }
  for (const c of COLL) {
    if (c.r !== undefined) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + f.r * 0.8; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    else { const m = f.r * 0.8; if (p.x > c.x0 - m && p.x < c.x1 + m && p.z > c.z0 - m && p.z < c.z1 + m) {
      const o = [p.x - (c.x0 - m), c.x1 + m - p.x, p.z - (c.z0 - m), c.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = c.x0 - m; else if (k === 1) p.x = c.x1 + m; else if (k === 2) p.z = c.z0 - m; else p.z = c.z1 + m; } }
  }
  p.y = damp(p.y, groundY(p.x, p.z), 18, 1 / 60);
}
function separate() {
  for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) {
    const a = ALL[i], b = ALL[j]; if (!a.alive || !b.alive || a.state === 'down' || b.state === 'down') continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d < m && d > 1e-4) { const k = (m - d) / 2, ka = a.crew ? 2 * k : b.crew ? 0 : k, kb = b.crew ? 2 * k : a.crew ? 0 : k; a.pos.x -= dx / d * ka; a.pos.z -= dz / d * ka; b.pos.x += dx / d * kb; b.pos.z += dz / d * kb; }
  }
}

// ---------------- input ----------------
const KEYS = new Set(); const PRESS = new Set();
const IN = { mx: 0, my: 0, look: 0, lookY: 0, dragX: 0, dragY: 0, lastLook: -9, bot: null };
addEventListener('keydown', (e) => {
  audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  const k = e.key.toLowerCase(); if (!KEYS.has(k)) PRESS.add(k); KEYS.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => KEYS.delete(e.key.toLowerCase()));
addEventListener('blur', () => KEYS.clear());
const pressed = (...ks) => ks.some((k) => PRESS.has(k));
// mouse / touch drag on the canvas orbits the camera; touch stick + buttons
const TOUCHS = { stick: null, sx: 0, sy: 0, x: 0, y: 0, drag: new Map(), btn: { a: false, b: false, l: false, r: false } };
if (TOUCH) document.body.classList.add('touch');
canvas.addEventListener('pointerdown', (e) => {
  audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  canvas.setPointerCapture?.(e.pointerId);
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.3 && TOUCHS.stick === null) {
    TOUCHS.stick = e.pointerId; TOUCHS.sx = e.clientX; TOUCHS.sy = e.clientY; TOUCHS.x = TOUCHS.y = 0; const st = $('stick'); st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px'; st.classList.add('act'); return;
  }
  TOUCHS.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === TOUCHS.stick) { const dx = e.clientX - TOUCHS.sx, dy = e.clientY - TOUCHS.sy, d = Math.hypot(dx, dy), m = 52, s = d > m ? m / d : 1;
    TOUCHS.x = dx * s / m; TOUCHS.y = dy * s / m; $('knob').style.transform = `translate(${dx * s}px, ${dy * s}px)`; return; }
  const d = TOUCHS.drag.get(e.pointerId); if (!d) return;
  IN.dragX += e.clientX - d.x; IN.dragY += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; IN.lastLook = S.time;
});
const endPtr = (e) => {
  if (e.pointerId === TOUCHS.stick) { TOUCHS.stick = null; TOUCHS.x = TOUCHS.y = 0; $('knob').style.transform = ''; const st = $('stick'); st.classList.remove('act'); st.style.left = ''; st.style.top = ''; }
  TOUCHS.drag.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
for (const [id, k] of [['bA', 'a'], ['bB', 'b'], ['cL', 'l'], ['cR', 'r'], ['bH', 'h']]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); TOUCHS.btn[k] = true; el.classList.add('down'); if (k === 'a') PRESS.add('j'); if (k === 'b') PRESS.add('k'); if (k === 'h') PRESS.add('f'); });
  const up = () => { TOUCHS.btn[k] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
let PAD_PREV = [];
function readInput() {
  let mx = 0, my = 0, look = 0, lookY = 0;
  if (KEYS.has('a') || KEYS.has('arrowleft')) mx -= 1; if (KEYS.has('d') || KEYS.has('arrowright')) mx += 1;
  if (KEYS.has('w') || KEYS.has('arrowup')) my += 1; if (KEYS.has('s') || KEYS.has('arrowdown')) my -= 1;
  if (KEYS.has('q')) look -= 1; if (KEYS.has('e')) look += 1;
  if (TOUCHS.stick !== null) { mx += TOUCHS.x; my -= TOUCHS.y; }
  if (TOUCHS.btn.l) look -= 1; if (TOUCHS.btn.r) look += 1;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue; const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    mx += dz(gp.axes[0] || 0); my -= dz(gp.axes[1] || 0); look += dz(gp.axes[2] || 0); lookY += dz(gp.axes[3] || 0);
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(4)) look -= 1; if (b(5)) look += 1;
    const prev = PAD_PREV[gp.index] || [];
    if ((b(2) && !prev[2]) || (b(1) && !prev[1])) PRESS.add('j'); if (b(0) && !prev[0]) PRESS.add('k');
    PAD_PREV[gp.index] = gp.buttons.map((x) => x.pressed);
  }
  if (IN.bot) { mx = IN.bot.mx; my = IN.bot.my; look += IN.bot.look || 0; if (IN.bot.atk) { PRESS.add('j'); IN.bot.atk = false; } if (IN.bot.jump) { PRESS.add('k'); IN.bot.jump = false; } if (IN.bot.help) { PRESS.add('f'); IN.bot.help = false; } }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  IN.mx = mx; IN.my = my; IN.look = clamp(look, -1, 1); IN.lookY = lookY; if (look || lookY) IN.lastLook = S.time;
}

// ---------------- camera: chase cam, a bit higher and wider than C; drag / right stick / Q-E orbit; boxed against walls ----------------
const CAM = { yaw: 0, pitch: 0.36, dist: 6.6, cur: 6.6, pivot: new THREE.Vector3(0, 1.5, 31), look: new THREE.Vector3(), fov: 62, lockYawT: 0 };
function camFwd(yaw) { return [-Math.sin(yaw), -Math.cos(yaw)]; } // xz forward of the camera
function segBox(ax, ay, az, bx, by, bz, b, pad) { // param t of the first hit of segment a->b with an AABB, or 1
  let t0 = 0, t1 = 1; const P = [[ax, bx, b.x0 - pad, b.x1 + pad], [ay, by, (b.y0 || -1), b.h + pad], [az, bz, b.z0 - pad, b.z1 + pad]];
  for (const [a, c, lo, hi] of P) { const d = c - a; if (Math.abs(d) < 1e-6) { if (a < lo || a > hi) return 1; continue; }
    let u0 = (lo - a) / d, u1 = (hi - a) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return 1; }
  return t0;
}
let lockT = null;
// (camera now lives in 07_news.js: the WKRK crew IS the camera)

// ---------------- combat ----------------
const WORDS_L = [0, 1, 4, 6], WORDS_H = [1, 3, 5];
function pickTarget(dirx, dirz, maxD = 7) {
  let best = null, bs = 1e9;
  for (const e of enemies) {
    if (!e.alive || e.state === 'dying') continue; const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz); if (d > maxD) continue;
    const ang = Math.acos(clamp((dx * dirx + dz * dirz) / (d || 1), -1, 1));
    const s = d + ang * 2.2 + (e.state === 'down' ? 4 : 0); if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function hitEnemy(e, dmg, heavy, fromYaw) {
  if (!e.alive || e.state === 'dying' || (e.state === 'down' && !heavy)) return false;
  e.hp -= dmg; e.flash = 1; e.J.mat.userData.flashC.value.set('#fff'); e.hpShow = 2.5; drawHp(e); S.hits++;
  S.combo++; S.comboT = 1.3; S.maxCombo = Math.max(S.maxCombo, S.combo);
  const kx = Math.sin(fromYaw), kz = Math.cos(fromYaw);
  const at = _v.set(e.pos.x, e.pos.y + 1.1 * e.scale, e.pos.z);
  spawnSprite(FXT.star, at, heavy ? 1.6 : 1.15, 0.22, { rot: Math.random() * TAU });
  if (heavy || S.combo % 2 === 1) { const w = (heavy ? WORDS_H : WORDS_L)[(Math.random() * 3) | 0]; spawnSprite(FXT.words[w], at.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0.8, 0)), heavy ? 1.15 : 0.85, 0.65, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.18, 0.18) }); }
  if (e.hp <= 0 || heavy) {
    e.set('down'); e.kb.set(kx * (heavy ? 7.5 : 5), kz * (heavy ? 7.5 : 5)); e.vy = 4.2; e.y = 0.01; e.dead = e.hp <= 0; e.yaw = fromYaw + Math.PI;
    S.hitstop = 0.09; S.shake = Math.max(S.shake, 0.75); sfx('heavy');
  } else if (e.state === 'windup' || e.state === 'attack' || (e.big && e.state === 'chase' && Math.random() < 0.6)) { // committed swings (and the bruiser) shrug off light hits
    e.kb.set(kx * 1.2, kz * 1.2); S.hitstop = 0.05; S.shake = Math.max(S.shake, 0.3); sfx('hit');
  } else { e.set('hurt'); e.kb.set(kx * 3.2, kz * 3.2); e.yaw = fromYaw + Math.PI; S.hitstop = 0.055; S.shake = Math.max(S.shake, 0.4); sfx('hit'); }
  if (e.bang) e.bang.life = 0.0001;
  NEWS.onHit(e, dmg, heavy, e.hp <= 0);
  return true;
}
function hurtHero(dmg, fromX, fromZ, heavy) {
  if (hero.inv > 0 || hero.state === 'down' || hero.state === 'getup' || hero.state === 'cuffed' || NEWS.over) return;
  hero.hp = Math.max(0, hero.hp - dmg); hero.flash = 1; hero.J.mat.userData.flashC.value.set('#ff3d6e');
  const dx = hero.pos.x - fromX, dz = hero.pos.z - fromZ, d = Math.hypot(dx, dz) || 1; hero.yaw = Math.atan2(-dx, -dz);
  S.combo = 0; S.shake = Math.max(S.shake, 0.5); sfx('hurt'); spawnSprite(FXT.star, _v.set(hero.pos.x, hero.pos.y + 1.2, hero.pos.z), 0.9, 0.2);
  if (hero.hp <= 0 || heavy) { hero.set('down'); hero.kb.set(dx / d * 6, dz / d * 6); hero.vy = 4; hero.y = 0.01; S.playerDowns++; NEWS.onHeroDown(hero.hp <= 0); }
  else { hero.set('hurt'); hero.kb.set(dx / d * 3, dz / d * 3); }
  hero.inv = 0.5;
}
const ATK = { // dur, hit time, range, half-cone (rad), dmg, heavy, lunge
  1: { dur: 0.36, hit: 0.3, range: 2.4, cone: 1.15, dmg: 2, heavy: false, pose: 'atk1', slash: 'side', roll: 0.18 },
  2: { dur: 0.36, hit: 0.3, range: 2.4, cone: 1.15, dmg: 2, heavy: false, pose: 'atk2', slash: 'side', roll: -0.18 },
  3: { dur: 0.6, hit: 0.42, range: 2.75, cone: Math.PI, dmg: 3, heavy: true, pose: 'atk3', slash: 'spin', roll: 0 },
};
function startAttack(n) {
  hero.set('atk'); hero.atkN = n; hero.queued = false; hero.hitDone = false; hero.hit2 = false;
  // soft lock: aim at the best target near the stick direction (or where we face)
  let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
  if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
  const t = pickTarget(dx, dz, 5.2); hero.atkT = t;
  hero.yaw = t ? Math.atan2(t.pos.x - hero.pos.x, t.pos.z - hero.pos.z) : Math.atan2(dx, dz);
  sfx('swing');
}
function resolveSwing(A, heavy360) {
  let any = false;
  for (const e of enemies) {
    if (!e.alive) continue; const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz);
    if (d > A.range + e.r * 0.5) continue; if (Math.abs(e.y - hero.y) > 1.6) continue;
    const ang = Math.abs(angTo(hero.yaw, Math.atan2(dx, dz))); if (!heavy360 && ang > A.cone) continue;
    if (hitEnemy(e, A.dmg, A.heavy, Math.atan2(dx, dz))) any = true;
  }
  return any;
}
function dust(x, y, z, n = 2) { for (let i = 0; i < n; i++) spawnSprite(FXT.puff, _v.set(x + rnd(-0.3, 0.3), y + 0.25, z + rnd(-0.3, 0.3)), rnd(0.5, 0.75), 0.4, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-1, 1), 0.8, rnd(-1, 1)) }); }

function updateHero(dt) {
  const h = hero; h.st += dt; h.at += dt; h.inv = Math.max(0, h.inv - dt);
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]];
  const wx = r[0] * IN.mx + f[0] * IN.my, wz = r[1] * IN.mx + f[1] * IN.my, wl = Math.hypot(wx, wz);
  const atk = pressed('j', 'x', 'enter'), jump = pressed('k', ' ');
  const grounded = h.y <= 0.0001 && h.vy <= 0;
  let pose, rate = 16, snapTilt = false;
  const move = (spd, acc) => { h.vel.x = damp(h.vel.x, wx * spd, acc, dt); h.vel.y = damp(h.vel.y, wz * spd, acc, dt); };
  switch (h.state) {
    case 'idle': case 'move': {
      h.state = 'move'; move(6.6, 12);
      if (wl > 0.1) h.yaw += angTo(h.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 14));
      h.speed = Math.hypot(h.vel.x, h.vel.y);
      pose = h.speed > 0.6 ? HERO_POSES.run(h.at, h.speed) : HERO_POSES.idle(h.at);
      if (h.speed > 4 && Math.random() < dt * 5) dust(h.pos.x, h.pos.y, h.pos.z, 1);
      if (NEWS.interact() && NEWS.canHelp()) { h.set('help'); h.vel.set(0, 0); NEWS.startHelp(); }
      else if (atk) startAttack(1); else if (jump) { h.set('air'); h.vy = 8.2; sfx('jump'); dust(h.pos.x, h.pos.y, h.pos.z, 3); }
      break;
    }
    case 'atk': {
      const A = ATK[h.atkN], u = h.st / A.dur; h.speed = 0;
      // lunge: close the gap to the soft-locked target, else step forward
      const T = h.atkT; let lx = Math.sin(h.yaw), lz = Math.cos(h.yaw), lsp = u < 0.45 ? 2.2 : 0;
      if (T && T.alive) { const dx = T.pos.x - h.pos.x, dz = T.pos.z - h.pos.z, d = Math.hypot(dx, dz); h.yaw += angTo(h.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 20)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 9) : 0; }
      h.vel.set(lx * lsp, lz * lsp);
      if (!h.hitDone && h.st >= A.hit * A.dur) {
        h.hitDone = true; const sp = _v.set(h.pos.x, h.pos.y + 0.95 + (h.atkN === 3 ? 0.25 : 0), h.pos.z);
        spawnSlash(sp, h.yaw + (h.atkN === 1 ? 0.25 : h.atkN === 2 ? -0.25 : 0), A.slash, A.roll, h.atkN === 2 ? -1 : 1);
        resolveSwing(A, h.atkN === 3);
      }
      if (h.atkN === 3 && !h.hit2 && h.st >= 0.62 * A.dur) { h.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true); }
      if (atk && u > 0.25) h.queued = true;
      if (u >= (h.atkN === 3 ? 1 : 0.78) && h.queued && h.atkN < 3) startAttack(h.atkN + 1);
      else if (u >= 1) { h.set('move'); h.at = 0; }
      pose = HERO_POSES[A.pose](Math.min(u, 1)); rate = 30; snapTilt = h.atkN === 3;
      if (jump && u > 0.6) { h.set('air'); h.vy = 8.2; sfx('jump'); }
      break;
    }
    case 'air': case 'airatk': {
      move(6.0, 4); h.vy -= 24 * dt; h.y += h.vy * dt;
      if (wl > 0.1 && h.state === 'air') h.yaw += angTo(h.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 8));
      if (h.state === 'air' && atk) { h.set('airatk'); h.vy = Math.max(h.vy, 3.5); const t = pickTarget(Math.sin(h.yaw), Math.cos(h.yaw), 5); if (t) h.yaw = Math.atan2(t.pos.x - h.pos.x, t.pos.z - h.pos.z); sfx('swing'); }
      if (h.state === 'airatk') { pose = HERO_POSES.airatk(h.st / 0.42); snapTilt = true; rate = 30; if (h.st > 0.25) h.vy = Math.min(h.vy, -10); }
      else pose = HERO_POSES.jump(h.vy);
      if (h.y <= 0) {
        h.y = 0; dust(h.pos.x, h.pos.y, h.pos.z, 3);
        if (h.state === 'airatk') { spawnSlash(_v.set(h.pos.x, h.pos.y + 0.4, h.pos.z), h.yaw, 'spin', 0); resolveSwing({ range: 2.6, cone: Math.PI, dmg: 3, heavy: true }, true); S.shake = Math.max(S.shake, 0.6); }
        h.vy = 0; h.set('move'); h.J.tilt.rotation.x = 0;
      }
      break;
    }
    case 'hurt': { h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 7)); pose = HERO_POSES.hurt(clamp(h.st / 0.35, 0, 1)); rate = 22; if (h.st > 0.35) h.set('move'); break; }
    case 'down': {
      h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 3.5)); h.vy -= 22 * dt; h.y = Math.max(0, h.y + h.vy * dt);
      pose = HERO_POSES.down(h.st, h.y <= 0 && h.st > 0.2); rate = 14;
      if (h.hp <= 0 && h.st > 1.4) { h.hp = h.maxHp; banner(); h.inv = 2.5; h.set('getup'); }
      else if (h.hp > 0 && h.st > 1.0) { h.set('getup'); h.inv = 1.0; }
      break;
    }
    case 'getup': { h.vel.set(0, 0); pose = HERO_POSES.getup(clamp(h.st / 0.45, 0, 1)); rate = 14; if (h.st > 0.45) h.set('move'); break; }
    case 'help': { // offer a hand to the downed camera operator
      h.vel.set(0, 0); const o = CREW.op; h.yaw += angTo(h.yaw, Math.atan2(o.pos.x - h.pos.x, o.pos.z - h.pos.z)) * (1 - Math.exp(-dt * 12));
      pose = HERO_POSES.getup(clamp(0.35 + Math.sin(h.st * 5) * 0.1, 0, 1)); pose.shR = [-1.4, 0, -0.2]; pose.elR = [-0.2, 0, 0]; rate = 12;
      if (h.st > 0.7) { h.set('move'); NEWS.finishHelp(); } break;
    }
    case 'cuffed': { // detained by the officer: no fighting cops, just wait it out
      h.vel.set(0, 0); h.inv = 0.5; pose = HERO_POSES.hurt(0.7); pose.shL = [0.5, 0, 0.3]; pose.shR = [0.5, 0, -0.3]; pose.elL = pose.elR = [-0.4, 0, 0]; rate = 10;
      if (h.st > 3.2) { h.set('move'); NEWS.onReleased(); } break;
    }
  }
  h.pos.x += h.vel.x * dt; h.pos.z += h.vel.y * dt; collide(h);
  applyPose(h.J, pose, rate, dt, snapTilt);
  // bandana tails trail behind
  for (const [i, t] of h.J.tails.entries()) { t.rotation.x = damp(t.rotation.x, 0.5 + clamp(h.speed / 6, 0, 1) * 0.9 + Math.sin(S.time * 12 + i) * 0.12, 10, dt); }
  h.sync(dt);
}
let ATTACKERS = 0;
function updateEnemy(e, dt) {
  e.st += dt; e.at += dt; e.cool = Math.max(0, e.cool - dt);
  const dx = hero.pos.x - e.pos.x, dz = hero.pos.z - e.pos.z, dP = Math.hypot(dx, dz);
  const toHeroYaw = Math.atan2(dx, dz), heroFromPost = Math.hypot(hero.pos.x - e.post.x, hero.pos.z - e.post.z), fromPost = Math.hypot(e.pos.x - e.post.x, e.pos.z - e.post.z);
  const heroOk = hero.state !== 'down' && hero.hp > 0;
  let pose, rate = 14, v = [0, 0];
  const SP = e.big ? 3.0 : 3.7, J = e.J;
  const face = (yaw, k = 10) => { e.yaw += angTo(e.yaw, yaw) * (1 - Math.exp(-dt * k)); };
  const walkTo = (x, z, sp) => { const ddx = x - e.pos.x, ddz = z - e.pos.z, d = Math.hypot(ddx, ddz); if (d < 0.15) return 0; const s = Math.min(sp, d * 4); v = [ddx / d * s, ddz / d * s]; face(Math.atan2(ddx, ddz)); return d; };
  switch (e.state) {
    case 'idle': {
      pose = THUG_POSES.idle(e.at, J); if (dP < 14) face(toHeroYaw, 3); else face(e.post.yaw, 2);
      if (heroOk && heroFromPost < 8) { e.set('chase'); if (!e.bang) e.bang = spawnSprite(FXT.bang, _v.set(e.pos.x, e.pos.y + 2.35 * e.scale, e.pos.z), 0.7, 0.8, { aspect: 0.5 }); }
      break;
    }
    case 'chase': {
      if (!heroOk || heroFromPost > 11.5 || fromPost > 9.5) { e.set('return'); break; }
      if (NEWS.wantCrewAttack(e)) { e.set('crewrun'); e.tgtCrew = true; break; }
      const canAtk = e.cool <= 0 && ATTACKERS < 2;
      if (canAtk && dP < (e.armed ? 1.9 : 1.65)) { e.set('windup'); ATTACKERS++; sfx('swing'); break; }
      // approach to striking range if we may attack, else hold a ring around the hero and circle
      if (canAtk) walkTo(hero.pos.x - dx / dP * 1.3, hero.pos.z - dz / dP * 1.3, SP);
      else { e.slot += dt * 0.35; const ring = 2.9, a = Math.atan2(-dx, -dz) * 0.6 + e.slot * 0.4; walkTo(hero.pos.x + Math.sin(a) * ring, hero.pos.z + Math.cos(a) * ring, SP * 0.6); face(toHeroYaw, 8); }
      const sp = Math.hypot(v[0], v[1]); pose = sp > 0.5 ? THUG_POSES.run(e.at, sp, J) : THUG_POSES.idle(e.at, J);
      break;
    }
    case 'crewrun': { // "no cameras!": break off and go for the news crew
      const o = CREW.op; if (CREW.state !== 'film' || fromPost > 17 || !heroOk || e.st > 7) { e.tgtCrew = false; e.set('chase'); break; }
      const cdx = o.pos.x - e.pos.x, cdz = o.pos.z - e.pos.z, cd = Math.hypot(cdx, cdz) || 1;
      if (cd < 1.55) { e.set('windup'); sfx('swing'); break; }
      walkTo(o.pos.x - cdx / cd * 1.2, o.pos.z - cdz / cd * 1.2, SP * 1.15); pose = THUG_POSES.run(e.at, SP, J);
      break;
    }
    case 'windup': {
      face(e.tgtCrew ? Math.atan2(CREW.op.pos.x - e.pos.x, CREW.op.pos.z - e.pos.z) : toHeroYaw, 6); pose = THUG_POSES.windup(e.st, J); rate = 12;
      e.J.mat.userData.flashC.value.set('#ffd23c'); e.flash = Math.max(e.flash, 0.25 + 0.25 * Math.sin(e.st * 40));
      if (e.st > (e.big ? 0.7 : 0.5)) { e.set('attack'); e.J.mat.userData.flashC.value.set('#fff'); }
      break;
    }
    case 'attack': {
      pose = THUG_POSES.attack(e.st / 0.3, J); rate = 26; if (e.tgtCrew) e.yaw += angTo(e.yaw, Math.atan2(CREW.op.pos.x - e.pos.x, CREW.op.pos.z - e.pos.z)) * 0.5; const lunge = e.st < 0.12 ? (e.tgtCrew ? 6 : 4) : 0; v = [Math.sin(e.yaw) * lunge, Math.cos(e.yaw) * lunge];
      if (!e.hitDone && e.st > 0.1) { e.hitDone = true; const ang = Math.abs(angTo(e.yaw, toHeroYaw)); const reach = (e.armed ? 2.0 : 1.7) * e.scale;
        if (e.tgtCrew) { const o = CREW.op; if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2.3 * e.scale) { NEWS.hitCrew(e); e.crewTries = 0; } else e.crewTries = (e.crewTries || 0) + 1; }
        else if (dP < reach && ang < 1.0 && hero.y < 0.9) hurtHero(e.big ? 16 : e.armed ? 11 : 8, e.pos.x, e.pos.z, e.big); }
      if (e.st > 0.55) { e.hitDone = false; const retry = e.tgtCrew && e.crewTries > 0 && e.crewTries < 3 && CREW.state === 'film'; e.tgtCrew = retry; if (retry) { e.set('crewrun'); e.cool = 0; ATTACKERS = Math.max(0, ATTACKERS - 1); break; } e.set('chase'); e.cool = rnd(1.1, 2.0) + (e.big ? 0.6 : 0); ATTACKERS = Math.max(0, ATTACKERS - 1); }
      break;
    }
    case 'hurt': { e.tgtCrew = false; v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 7)); pose = THUG_POSES.hurt(clamp(e.st / 0.32, 0, 1), J); rate = 24; if (e.st > 0.34) { e.set('chase'); e.cool = Math.min(e.cool, 0.25); } break; }
    case 'down': {
      v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 3.2)); e.vy -= 22 * dt; e.y = Math.max(0, e.y + e.vy * dt);
      const grounded = e.y <= 0 && e.st > 0.15; pose = THUG_POSES.down(e.st, grounded); rate = 13;
      if (grounded && !e.landed) { e.landed = true; dust(e.pos.x, e.pos.y, e.pos.z, 3); S.shake = Math.max(S.shake, 0.3); }
      if (e.dead && e.st > 1.0) { e.set('dying'); }
      else if (!e.dead && e.st > 1.25) { e.set('getup'); e.landed = false; }
      break;
    }
    case 'getup': { pose = THUG_POSES.getup(clamp(e.st / 0.5, 0, 1), J); if (e.st > 0.5) { if (dP < 2 && ATTACKERS < 2 && heroOk) { e.set('windup'); ATTACKERS++; } else { e.set('chase'); e.cool = 0.3; } } break; }
    case 'dying': {
      pose = THUG_POSES.down(1, true); e.flash = e.st % 0.16 < 0.08 ? 1 : 0;
      if (e.st > 0.7) {
        for (let k = 0; k < 6; k++) spawnSprite(FXT.puff, _v.set(e.pos.x + rnd(-0.6, 0.6), e.pos.y + 0.3, e.pos.z + rnd(-0.6, 0.6)), rnd(0.8, 1.3), 0.5, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-2, 2), 1.5, rnd(-2, 2)) });
        spawnSprite(FXT.star, _v.set(e.pos.x, e.pos.y + 0.6, e.pos.z), 1.4, 0.3);
        e.set('dead'); e.root.visible = false; e.hpS.visible = false; S.kills++; sfx('ko'); e.respawn = 1e9; e.landed = false; NEWS.onKO(e);
      }
      break;
    }
    case 'dead': {
      e.respawn -= dt; const far = false; // the gang stays beaten in this slice
      if (e.respawn <= 0 && far) { e.hp = e.maxHp; e.dead = false; e.pos.set(e.post.x, 0, e.post.z); e.yaw = e.post.yaw; e.root.visible = true; e.set('idle'); e.y = 0; e.J.tilt.rotation.set(0, 0, 0); e.bang = null;
        for (let k = 0; k < 4; k++) spawnSprite(FXT.puff, _v.set(e.pos.x + rnd(-0.5, 0.5), 0.4, e.pos.z + rnd(-0.5, 0.5)), 1, 0.45, { kind: 'grow', depth: true }); }
      return;
    }
    case 'return': {
      const d = walkTo(e.post.x, e.post.z, SP * 0.8); pose = d > 0.2 ? THUG_POSES.run(e.at, SP * 0.8, J) : THUG_POSES.idle(e.at, J);
      if (d < 0.3) e.set('idle'); if (heroOk && heroFromPost < 7) e.set('chase');
      break;
    }
  }
  if (!pose) pose = THUG_POSES.idle(e.at, J); // a state changed this frame: hold the stance for one frame
  e.pos.x += v[0] * dt; e.pos.z += v[1] * dt; collide(e);
  applyPose(J, pose, rate, dt, false);
  e.sync(dt);
  // hp pip
  e.hpShow -= dt; e.hpS.visible = e.hpShow > 0 && e.alive && e.hp > 0 && e.state !== 'dying' && e.state !== 'down';
  if (e.hpS.visible) e.hpS.position.set(e.pos.x, e.pos.y + 2.25 * e.scale + 0.1, e.pos.z);
  if (e.bang && e.bang.s.visible) e.bang.s.position.set(e.pos.x, e.pos.y + 2.35 * e.scale + Math.sin(e.st * 20) * 0.03, e.pos.z); else e.bang = e.bang && e.bang.s.visible ? e.bang : (e.state === 'idle' ? null : e.bang);
}
// windup/attack tokens are counted fresh every frame (robust against interrupted attacks)
function countAttackers() { ATTACKERS = enemies.filter((e) => e.state === 'windup' || e.state === 'attack').length; }

// ---------------- HUD ----------------
let hpShown = 100;
function hud(dt) {
  const pct = hero.hp / hero.maxHp * 100;
  if (Math.abs(pct - hpShown) > 0.1) { hpShown = pct; $('hpfill').style.width = pct + '%'; $('hplag').style.width = pct + '%'; }
  S.comboT -= dt; if (S.comboT <= 0 && S.combo) S.combo = 0;
  const cb = $('combo'); if (S.combo >= 2) { cb.classList.add('on'); $('comboN').textContent = S.combo; } else cb.classList.remove('on');
}
let bannerT = 0;
function banner() { $('banner').classList.add('on'); bannerT = 1.6; }
setTimeout(() => { const h = $('hint'); if (h) h.style.opacity = '0'; }, 9000);

// =====================================================================================================
// LIVE AT ELEVEN: the camera is a character. A WKRK Action News crew (camera operator + reporter Dana Vex)
// follows the hero on foot; the game view is their camera feed. Ratings = score, earned only on camera.
// =====================================================================================================
const PORTRAIT = () => innerHeight > innerWidth * 1.15;
const GAME_LEN = 165;                 // game seconds for the 10:57:00 -> 11:00:00 PM broadcast clock (sped up)
const TARGET = 70;                    // ratings goal (0-100)
const EV = { crewDown: 0, crewUp: 0, replays: 0, offCam: 0, offWhy: {}, cops: 0, copEvaded: 0, busted: 0, pizzaThrown: 0, pizzaEaten: 0, heads: [], hostile: 0, cheer: 0 };
const NEWS = { over: false, won: false, endT: -1, endWhy: '', seen: { ok: false, good: false, why: 'NO FEED', x: 0, y: 0 }, lastCrewAtk: -99, shyDone: false, replayPend: null, wrapT: -1 };
const RT = { v: 26, peak: 26, lastGain: 0, mult: 1, viewers: 12400, vShown: 12400, vPeak: 12400, style: 0, lowT: 0, cheerOn: false };
const _p = new THREE.Vector3(), _w = new THREE.Vector3(), _w2 = new THREE.Vector3();

// ---------------- rigs ----------------
function buildOperator() {
  const J = buildThug({ jacket: '#3b4f6b', pants: '#262636', skin: '#d29a70', hair: 'beanie', hairC: '#2fd3ff', shoe: '#14101f', weapon: null, sleeve: true });
  const cam = J.cam = grp(J.torso, -0.25, 0.8, 0.04); cam.userData.mat = J.mat;
  part(cam, G.box(0.24, 0.28, 0.62), '#2b2d3a', 0, 0, 0.02);
  part(cam, G.cyl(0.1, 0.125, 0.26, 12), '#14101f', 0, 0, 0.44, { rot: [Math.PI / 2, 0, 0] });
  part(cam, G.box(0.06, 0.07, 0.34), '#2b2d3a', 0, 0.2, 0.04);
  part(cam, G.box(0.02, 0.1, 0.4), '#ffd23c', 0.125, 0, 0.02, { outline: false });
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2040', fog: false })); tl.position.set(0, 0.17, 0.3); cam.add(tl); J.tally = tl;
  part(J.torso, G.box(0.46, 0.2, 0.05), '#ffd23c', 0, 0.36, -0.2, { outline: false }); // "PRESS" vest band
  return J;
}
function buildReporter() {
  const J = buildThug({ jacket: '#e8384f', pants: '#14101f', skin: '#a8714a', hair: 'none', hairC: '#2a1a12', shoe: '#14101f', weapon: null, sleeve: true });
  part(J.head, G.sph(0.205, 0.18, 0.205), '#2a1a12', 0, 0.29, -0.03);
  part(J.head, G.box(0.42, 0.26, 0.2), '#2a1a12', 0, 0.17, -0.11);
  const m = grp(J.haL, 0, -0.04, 0); m.userData.mat = J.mat;
  part(m, G.cyl(0.025, 0.02, 0.26, 8), '#14101f', 0, 0.1, 0); part(m, G.sph(0.065, 0.065, 0.065), '#9aa3c5', 0, 0.25, 0); part(m, G.box(0.11, 0.09, 0.11), '#ffd23c', 0, 0.15, 0);
  return J;
}
function buildOfficer() {
  const J = buildThug({ jacket: '#1f3f8f', pants: '#14204a', skin: '#c98a5a', hair: 'cap', hairC: '#14204a', shoe: '#14101f', weapon: null, sleeve: true });
  part(J.head, G.box(0.26, 0.03, 0.17), '#14101f', 0, 0.3, 0.2); part(J.head, G.box(0.08, 0.06, 0.02), '#ffd23c', 0, 0.36, 0.17, { outline: false });
  part(J.torso, G.box(0.08, 0.09, 0.03), '#ffd23c', 0.12, 0.42, 0.2, { outline: false });
  return J;
}
const BYS_LOOKS = [
  { jacket: '#ffd23c', pants: '#2f5bd3', skin: '#8d5a3b', hair: 'beanie', hairC: '#ff3d6e', shoe: '#fff' },
  { jacket: '#22c4b4', pants: '#3a2f5a', skin: '#f0b989', hair: 'cap', hairC: '#ff8a3d', shoe: '#14101f' },
  { jacket: '#c9a6ff', pants: '#2c2c3c', skin: '#c98a5a', hair: 'spikes', hairC: '#7dff6b', shoe: '#ffd23c' },
  { jacket: '#ff8a3d', pants: '#14204a', skin: '#e8a878', hair: 'mohawk', hairC: '#2fd3ff', shoe: '#fff' },
];

// ---------------- the crew ----------------
const CREW = { op: new Fighter(buildOperator(), { x: 0, z: 37.5, yaw: Math.PI, hp: 1, r: 0.42 }), rep: new Fighter(buildReporter(), { x: 1.6, z: 37, yaw: Math.PI, hp: 1, r: 0.4 }),
  bear: 0, side: 1, stuckT: 0, dropYaw: 0, run: 0, get state() { return this.op.state; } };
CREW.op.set('film'); CREW.rep.set('film'); CREW.op.crew = true; ALL.push(CREW.op);
// the camera operator NPC tries to keep the hero framed from `bear` (camera yaw convention), can lag, get blocked, get hit
function streetClamp(x, z) {
  x = clamp(x, -LIM + 1, LIM - 1); z = clamp(z, -LIM + 1, LIM - 1);
  const W = SW - 0.6; if (Math.abs(x) > W && Math.abs(z) > W) { if (Math.abs(x) - W < Math.abs(z) - W) x = Math.sign(x) * W; else z = Math.sign(z) * W; }
  return [x, z];
}
function blockedAt(x, z, r) {
  if (Math.abs(x) > SW - 0.5 && Math.abs(z) > SW - 0.5) return true;
  if (Math.abs(x) > LIM - 0.5 || Math.abs(z) > LIM - 0.5) return true;
  for (const c of COLL) {
    if (c.r !== undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; }
    else if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
function updateCrew(dt) {
  const o = CREW.op, rp = CREW.rep; o.st += dt; o.at += dt; rp.st += dt; rp.at += dt;
  let pose, rate = 14;
  o.J.tally.visible = o.state === 'film' && (S.time % 1 < 0.7);
  if (o.state === 'down' || o.state === 'help') {
    o.vel.set(o.kb.x, o.kb.y); o.kb.multiplyScalar(Math.exp(-dt * 3.5)); o.vy -= 22 * dt; o.y = Math.max(0, o.y + o.vy * dt);
    pose = THUG_POSES.down(o.st, o.y <= 0 && o.st > 0.15); rate = 13;
    if (o.state === 'help') { pose.torso = [0.6, 0, 0]; }
  } else if (o.state === 'getup') {
    o.vel.set(0, 0); pose = filmPose(THUG_POSES.getup(clamp(o.st / 0.6, 0, 1), o.J)); if (o.st > 0.6) o.set('film');
  } else {
    // where the shot wants us: behind the hero along the crew bearing, a little further back in portrait
    const D = (PORTRAIT() ? 7.6 : 6.3) + (lockT ? 0.5 : 0);
    const f = camFwd(CREW.bear); let [tx, tz] = streetClamp(hero.pos.x - f[0] * D, hero.pos.z - f[1] * D);
    const dx = tx - o.pos.x, dz = tz - o.pos.z, d = Math.hypot(dx, dz);
    const hd = Math.hypot(hero.pos.x - o.pos.x, hero.pos.z - o.pos.z);
    const top = hd > 11 ? 6.1 : 5.2; // always a touch slower than the hero (6.6): the crew lags when you sprint
    const charged = enemies.some((e) => e.tgtCrew && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 3.2);
    let sp = d < 0.4 || charged ? 0 : Math.min(top, d * 2.2), ux = d > 1e-3 ? dx / d : 0, uz = d > 1e-3 ? dz / d : 0;
    if (sp > 0.3) { // steer around cars, props and buildings
      const ang0 = Math.atan2(ux, uz); let ok = !blockedAt(o.pos.x + ux * 0.9, o.pos.z + uz * 0.9, o.r * 0.8);
      if (!ok) { for (const k of [0.6, 1.2, 1.8, 2.4]) { for (const sd of [CREW.side, -CREW.side]) { const a = ang0 + k * sd; const qx = Math.sin(a), qz = Math.cos(a);
        if (!blockedAt(o.pos.x + qx * 0.9, o.pos.z + qz * 0.9, o.r * 0.8)) { ux = qx; uz = qz; ok = true; CREW.side = sd; break; } } if (ok) break; } }
    }
    o.vel.x = damp(o.vel.x, ux * sp, 6, dt); o.vel.y = damp(o.vel.y, uz * sp, 6, dt);
    o.speed = Math.hypot(o.vel.x, o.vel.y); CREW.run = damp(CREW.run, clamp(o.speed / 5, 0, 1), 5, dt);
    o.yaw += angTo(o.yaw, Math.atan2(hero.pos.x - o.pos.x, hero.pos.z - o.pos.z)) * (1 - Math.exp(-dt * 7));
    pose = filmPose(o.speed > 0.6 ? THUG_POSES.run(o.at, o.speed, o.J) : THUG_POSES.idle(o.at, o.J));
  }
  const ox = o.pos.x, oz = o.pos.z; o.pos.x += o.vel.x * dt; o.pos.z += o.vel.y * dt; collide(o);
  CREW.stuckT = (o.state === 'film' && Math.hypot(o.vel.x, o.vel.y) > 2 && Math.hypot(o.pos.x - ox, o.pos.z - oz) < dt * 0.8) ? CREW.stuckT + dt : Math.max(0, CREW.stuckT - dt);
  applyPose(o.J, pose, rate, dt, false); o.sync(dt);
  // Dana Vex keeps beside the camera (off its right shoulder), mic up; rushes to the operator when he goes down
  let rx, rz, rpose;
  if (o.state === 'down' || o.state === 'help') { rx = o.pos.x + 1.0; rz = o.pos.z + 0.6; }
  else { const f = camFwd(CREW.bear), r = [-f[1], f[0]]; rx = o.pos.x + r[0] * 1.5 + f[0] * 0.4; rz = o.pos.z + r[1] * 1.5 + f[1] * 0.4; [rx, rz] = streetClamp(rx, rz); }
  const ddx = rx - rp.pos.x, ddz = rz - rp.pos.z, dd = Math.hypot(ddx, ddz), rsp = dd < 0.3 ? 0 : Math.min(5.6, dd * 2.5);
  rp.vel.set(dd > 1e-3 ? ddx / dd * rsp : 0, dd > 1e-3 ? ddz / dd * rsp : 0); rp.pos.x += rp.vel.x * dt; rp.pos.z += rp.vel.y * dt; collide(rp);
  const lookAt = (o.state === 'down' || o.state === 'help') ? o.pos : hero.pos;
  rp.yaw += angTo(rp.yaw, Math.atan2(lookAt.x - rp.pos.x, lookAt.z - rp.pos.z)) * (1 - Math.exp(-dt * 6));
  if (rsp > 0.6) rpose = THUG_POSES.run(rp.at, rsp, rp.J); else { rpose = THUG_POSES.idle(rp.at, rp.J); }
  rpose.shL = [-1.5, 0.2, 0.25]; rpose.elL = [-1.2, 0, 0]; rpose.shR = [0.05, 0, -0.12]; rpose.elR = [-0.3, 0, 0]; rpose.torso = [0.02, 0.1, 0]; rpose.neck = [0, 0, 0]; rpose.hips = [0, 0, 0];
  if (o.state === 'down') { rpose.shR = [-1.6, 0, -0.4]; rpose.elR = [-1.4, 0, 0]; }
  applyPose(rp.J, rpose, 12, dt, false); rp.sync(dt);
}
function filmPose(p) { // camera up on the right shoulder, left hand on the lens
  p.shR = [-2.55, 0, -0.25]; p.elR = [-1.75, 0, 0]; p.haR = [0, 0, 0]; p.shL = [-1.45, 0.35, 0.35]; p.elL = [-1.15, 0, 0];
  p.torso = [p.torso[0] * 0.4, 0, 0]; p.neck = [0, 0, 0]; p.hips = [0, 0, 0]; return p;
}
NEWS.wantCrewAttack = (e) => {
  if (CREW.state !== 'film' || NEWS.over || REPLAY.on) return false;
  const d = Math.hypot(CREW.op.pos.x - e.pos.x, CREW.op.pos.z - e.pos.z);
  let go = false;
  if (!NEWS.shyDone && S.kills >= 1 && d < 10 && S.time > 25) { go = true; NEWS.shyDone = true; }            // one camera-shy thug per broadcast, guaranteed
  else if (NEWS.shyDone && d < 3.2 && S.time - NEWS.lastCrewAtk > 28 && Math.random() < 0.003) go = true;  // after that, only crews that crowd the fight
  if (go) { NEWS.lastCrewAtk = S.time; spawnSprite(WTX.nocam, _w.set(e.pos.x, e.pos.y + 2.6 * e.scale, e.pos.z), 0.95, 1.4, { kind: 'word', aspect: 512 / 160 }); dana('nocam'); }
  return go;
};
NEWS.hitCrew = (e) => {
  const o = CREW.op; if (o.state !== 'film') return;
  const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  o.set('down'); o.kb.set(dx / d * 5, dz / d * 5); o.vy = 4; o.y = 0.01; o.flash = 1;
  CREW.dropYaw = CAM.yaw + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.7); // the camera lands looking roughly where it was pointing
  S.shake = 1; EV.crewDown++; sfx('heavy'); sfx2('crash');
  headline('WKRK CREW ATTACKED ON LIVE TV', 'alert'); dana('crewdown');
  spawnSprite(FXT.star, _w.set(o.pos.x, o.pos.y + 1.5, o.pos.z), 1.2, 0.3);
};
NEWS.interact = () => pressed('e', 'f');
NEWS.canHelp = () => CREW.state === 'down' && CREW.op.st > 0.5 && Math.hypot(hero.pos.x - CREW.op.pos.x, hero.pos.z - CREW.op.pos.z) < 2.4;
NEWS.startHelp = () => { CREW.op.set('help'); };
NEWS.finishHelp = () => {
  const o = CREW.op; o.set('getup'); o.y = 0; EV.crewUp++;
  CREW.bear = Math.atan2(-(hero.pos.x - o.pos.x), -(hero.pos.z - o.pos.z)); // pick the shot back up from where he stands
  headline('HERO HELPS WKRK CREW BACK ON ITS FEET', 'hype'); dana('crewup'); flashBack();
  gain(6, 'CREW SAVED', true);
};

// ---------------- the camera: the operator's shoulder cam (or the fallen one) ----------------
const CAMV = { look: new THREE.Vector3(0, 1.2, 28), fov: 58, t: 0, roll: 0, eye: new THREE.Vector3() };
function updateCamera(dt, rdt) {
  CAMV.t += rdt;
  // orbit input = direct the crew: Q/E, drag or the right stick changes where the operator stands
  CREW.bear -= IN.look * rdt * 2.0; CREW.bear -= IN.dragX * 0.0062; IN.dragX = IN.dragY = 0;
  const p = hero.pos, fighting = lockT && lockT.alive;
  const idleLook = S.time - IN.lastLook > 1.4;
  if (idleLook && hero.speed > 1 && hero.state === 'move') { // swing round behind a running hero (slowly: the crew has to physically get there)
    const heading = Math.atan2(-hero.vel.x, -hero.vel.y), d = angTo(CREW.bear, heading);
    if (Math.abs(d) < 2.2) CREW.bear += d * (1 - Math.exp(-rdt * 0.6 * clamp(hero.speed / 6, 0, 1)));
  }
  if (fighting && idleLook) { const tx = lockT.pos.x - p.x, tz = lockT.pos.z - p.z, ty = Math.atan2(-tx, -tz), d = angTo(CREW.bear, ty); if (Math.abs(d) > 0.6) CREW.bear += (d - Math.sign(d) * 0.6) * (1 - Math.exp(-rdt * 1.6)); }
  CREW.bear = wrapA(CREW.bear);
  const o = CREW.op, down = o.state === 'down' || o.state === 'help';
  let eye = CAMV.eye, sway = 0.005 + CREW.run * 0.014;
  if (down) { // the camera lies on the asphalt next to him, tilted, still rolling
    const a = CREW.dropYaw, f = camFwd(a), r = [-f[1], f[0]];
    eye.set(o.pos.x + r[0] * 0.55, 0.34 + o.pos.y, o.pos.z + r[1] * 0.55);
    CAMV.look.set(eye.x + f[0] * 6, 0.95, eye.z + f[1] * 6); CAMV.roll = damp(CAMV.roll, 0.48, 8, rdt); sway = 0.02;
  } else {
    o.J.cam.localToWorld(eye.set(0, 0.04, 0.72)); // just in front of the lens
    const tx = p.x + (fighting ? (lockT.pos.x - p.x) * 0.25 : 0), tz = p.z + (fighting ? (lockT.pos.z - p.z) * 0.25 : 0), ty = p.y + 1.1 + hero.y * 0.6;
    const pan = o.state === 'getup' ? 2 : 4.5 - CREW.run * 1.2; // pan lag: the operator can't whip the camera instantly
    CAMV.look.x = damp(CAMV.look.x, tx, pan, rdt); CAMV.look.z = damp(CAMV.look.z, tz, pan, rdt); CAMV.look.y = damp(CAMV.look.y, ty, pan, rdt);
    CAMV.roll = damp(CAMV.roll, 0, 3, rdt);
  }
  camera.position.copy(eye);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.12; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.up.set(0, 1, 0); camera.lookAt(CAMV.look);
  const t = CAMV.t; // handheld sway
  camera.rotateY((Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.9 + 1)) * sway); camera.rotateX((Math.sin(t * 1.7 + 2) + 0.4 * Math.sin(t * 3.7)) * sway * 0.8);
  camera.rotateZ(CAMV.roll + Math.sin(t * 0.9) * sway * 0.7 + (down ? Math.sin(t * 23) * 0.012 : 0));
  // zoom: the operator rides the zoom to keep the hero a readable size (wider in portrait)
  const dist = Math.max(1, Math.hypot(p.x - eye.x, p.z - eye.z)), aspect = innerWidth / innerHeight;
  const tanH = Math.max(3.7 / dist, (aspect < 1 ? 3.1 : 6.2) / dist / aspect);
  const fovW = down ? 74 : clamp(2 * Math.atan(tanH) * 180 / Math.PI, 30, 84);
  CAMV.fov = damp(CAMV.fov, fovW, 2.5, rdt); if (Math.abs(camera.fov - CAMV.fov) > 0.05) { camera.fov = CAMV.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  // control frame = what the viewer sees
  const fx = CAMV.look.x - eye.x, fz = CAMV.look.z - eye.z; if (Math.hypot(fx, fz) > 0.2) CAM.yaw = Math.atan2(-fx, -fz);
  computeSeen();
}
function computeSeen() {
  const r = NEWS.seen; r.ok = false; r.good = false;
  if (CREW.state === 'down' || CREW.state === 'help') { r.why = 'NO FEED'; return; }
  _p.set(hero.pos.x, hero.pos.y + 1.0 + hero.y, hero.pos.z).project(camera); r.x = _p.x; r.y = _p.y;
  if (_p.z > 1 || Math.abs(_p.x) > 0.94 || Math.abs(_p.y) > 0.94) { r.why = 'OUT OF FRAME'; return; }
  const e = camera.position, hx = hero.pos.x, hy = hero.pos.y + 1.0 + hero.y, hz = hero.pos.z;
  for (const b of BLD) if (segBox(e.x, e.y, e.z, hx, hy, hz, b, 0) < 0.97) { r.why = 'VIEW BLOCKED'; return; }
  r.ok = true; r.why = ''; r.dist = Math.hypot(hx - e.x, hz - e.z); r.good = frameGood(lockT && lockT.alive ? lockT : null);
}
function frameGood(foe) {
  const r = NEWS.seen; if (!r.ok || Math.abs(r.x) > 0.4 || Math.abs(r.y) > 0.55 || r.dist > 10.5) return false;
  if (foe) { _w2.set(foe.pos.x, foe.pos.y + 1.0 + foe.y, foe.pos.z).project(camera); if (_w2.z > 1 || Math.abs(_w2.x) > 0.88 || Math.abs(_w2.y) > 0.92) return false; }
  return true;
}

// ---------------- ratings ----------------
function gain(amt, label, force, foe) {
  const s = NEWS.seen;
  if (!force && !s.ok) { offCamera(s.why); return 0; }
  const m = force ? 1 : (frameGood(foe) ? 2 : 1); const g = amt * m;
  RT.v = clamp(RT.v + g, 0, 100); RT.peak = Math.max(RT.peak, RT.v); RT.lastGain = S.time; RT.mult = m;
  popGain('+' + g.toFixed(g < 10 ? 1 : 0) + (m > 1 ? ' ×2' : '') + (label ? ' ' + label : ''), m > 1);
  return g;
}
let offT = 0;
function offCamera(why) {
  EV.offCam++; EV.offWhy[why] = (EV.offWhy[why] || 0) + 1; offT = 1.4;
  $('offWhy').textContent = why === 'NO FEED' ? 'NO FEED · NO RATINGS' : why === 'VIEW BLOCKED' ? 'VIEW BLOCKED · NO RATINGS' : 'OUT OF FRAME · NO RATINGS';
  $('offcam').classList.add('on');
}
NEWS.onHit = (e, dmg, heavy, kill) => {
  if (e.tgtCrew && e.state !== 'windup' && e.state !== 'attack') { e.tgtCrew = false; if (CREW.state === 'film') { headline('HERO SHIELDS NEWS CREW FROM ATTACK', 'hype'); } }
  const air = hero.state === 'airatk' || hero.y > 0.3;
  const g = gain((heavy ? 1.0 : 0.5) * (1 + Math.min(S.combo, 12) * 0.05) * (air ? 1.3 : 1), S.combo >= 3 ? S.combo + ' HITS' : '', false, e);
  if (g > 0) {
    RT.style += (S.combo >= 3 ? S.combo * 35 : 10) + (air ? 260 : 0);
    if (!NEWS.firstHit) { NEWS.firstHit = true; headline('MASKED VIGILANTE BRAWLS ON 5TH & GRAND', 'news'); }
    else if (S.combo === 5 || S.combo === 8) headline(S.combo + '-HIT COMBO STUNS WITNESSES ON GRAND AVE', 'hype');
  }
  if (kill) {
    const seen = NEWS.seen.ok;
    if (seen && (heavy || S.combo >= 4 || e.big) && !NEWS.replayPend && !REPLAY.on && S.time - REPLAY.lastT > 7) {
      NEWS.replayPend = { t: 0.75, e, combo: S.combo, big: e.big, air, kind: air ? 'AIR SLASH' : (hero.atkN === 3 ? 'SPIN SLASH' : 'COMBO'), gain: 0 };
    }
  }
};
NEWS.onKO = (e) => {
  const left = enemies.filter((q) => q.alive && q.state !== 'dead').length;
  const g = gain(5 + (e.big ? 3 : 0), 'TAKEDOWN', false, e);
  if (g > 0) { RT.style += 600; if (NEWS.replayPend && NEWS.replayPend.e === e) NEWS.replayPend.gain = g; }
  if (left === 0) headline('STREET GANG BROKEN UP AT 5TH & GRAND', 'hype');
  else if (e.big) headline('BIGGEST GANG MEMBER TOPPLED ON GRAND AVE', 'hype');
  else if (g > 0) headline(['GANG MEMBER DOWN — ' + left + ' LEFT', 'ANOTHER THUG HITS THE PAVEMENT — ' + left + ' TO GO', 'STREET GANG ON THE ROPES — ' + left + ' LEFT'][S.kills % 3], 'news');
  else headline('REPORTS OF A TAKEDOWN JUST OFF CAMERA', 'news');
  dana(g > 0 ? 'ko' : 'missed');
};
NEWS.onHeroDown = (ko) => { if (ko) { RT.v = Math.max(0, RT.v - 8); headline('VIGILANTE TAKES A BEATING AT 5TH & GRAND', 'hostile'); } };
function updateRatings(dt) {
  const idle = S.time - RT.lastGain;
  if (idle > 2.5) RT.v = Math.max(0, RT.v - (NEWS.seen.why === 'NO FEED' ? 2.0 : 1.1) * dt);
  RT.viewers = 9000 + RT.v * 820 + RT.style;
  RT.vShown = damp(RT.vShown, RT.viewers, 1.5, dt); RT.vPeak = Math.max(RT.vPeak, RT.vShown);
  // low ratings: hostile chyron, then the police get called
  if (RT.v < 22 && S.time > 4 && !NEWS.hostile) { NEWS.hostile = true; EV.hostile++; headline(['IS THIS MASKED "HERO" A MENACE?', 'VIGILANTE OR VANDAL? VIEWERS UNIMPRESSED'][EV.hostile % 2], 'hostile'); dana('low'); }
  if (RT.v > 32) NEWS.hostile = false;
  RT.lowT = RT.v < 15 ? RT.lowT + dt : 0;
  if (RT.lowT > 2 && !COP.on && S.time - COP.lastEnd > 20 && !NEWS.over) callCops();
  // high ratings: the corners cheer and toss a slice
  const hype = RT.v >= 65;
  if (hype && !RT.cheerOn) { RT.cheerOn = true; EV.cheer++; headline('CROWD CHEERS MASKED HERO AT 5TH & GRAND', 'hype'); BYS.tossT = 0.8; }
  if (RT.v < 58) RT.cheerOn = false;
}

// ---------------- bystanders on the corners ----------------
const BYS = { list: [], tossT: 99 };
[[9.7, 9.7], [-9.7, 9.7], [9.7, -9.7], [-9.7, -9.7]].forEach(([x, z], i) => {
  const look = Object.assign({ weapon: null, sleeve: i % 2 === 0 }, BYS_LOOKS[i]); const J = buildThug(look); scene.add(J.root);
  J.root.position.set(x, CURB, z); const yaw = Math.atan2(-x, -z); J.root.rotation.y = yaw;
  BYS.list.push({ J, x, z, yaw, t: Math.random() * 5, woo: rnd(1, 3) });
});
function updateBystanders(dt) {
  for (const b of BYS.list) {
    b.t += dt; const p = blank(); legsStance(p, 0.1, 0.12);
    const ty = Math.atan2(hero.pos.x - b.x, hero.pos.z - b.z); b.yaw += angTo(b.yaw, ty) * (1 - Math.exp(-dt * 2)); b.J.root.rotation.y = b.yaw;
    if (RT.cheerOn) { const j = Math.abs(Math.sin(b.t * 7)); p.y = j * 0.12; p.shL = [-2.8 + j * 0.3, 0, 0.35]; p.shR = [-2.8 + j * 0.3, 0, -0.35]; p.elL = p.elR = [-0.3, 0, 0];
      b.woo -= dt; if (b.woo <= 0) { b.woo = rnd(1.8, 3.5); spawnSprite(WTX.woo, _w.set(b.x, 2.6, b.z), 0.7, 1.0, { kind: 'word', aspect: 512 / 160, depth: true }); } }
    else if (NEWS.hostile) { p.shL = [-1.2, 0.9, 0.3]; p.shR = [-1.2, -0.9, -0.3]; p.elL = [-1.6, 0, 0]; p.elR = [-1.6, 0, 0]; p.neck = [0.15, Math.sin(b.t * 2) * 0.3, 0];
      b.woo -= dt; if (b.woo <= 0) { b.woo = rnd(2.5, 5); spawnSprite(WTX.boo, _w.set(b.x, 2.6, b.z), 0.6, 1.0, { kind: 'word', aspect: 512 / 160, depth: true }); } }
    else { p.shL = [0.08, 0, 0.12]; p.shR = [0.08, 0, -0.12]; p.elL = p.elR = [-0.25, 0, 0]; p.y = Math.sin(b.t * 2) * 0.01; }
    applyPose(b.J, p, 10, dt, false);
  }
  if (RT.cheerOn) { BYS.tossT -= dt; if (BYS.tossT <= 0) { BYS.tossT = 12; tossPizza(); } }
  updatePizza(dt);
}
// pizza slice: a thrown health pickup
const PIZ = [];
function buildSlice() {
  const g = new THREE.Group(), mat = toonMat();
  const add = (geo, col, ol = true) => { bakeColor(geo, col); if (ol) addOdir(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); if (ol) m.add(new THREE.Mesh(geo, OUT_PROP)); return m; };
  const w = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 3); w.scale(1, 1, 0.75); add(w, '#ffcf6a');
  const c = new THREE.BoxGeometry(0.66, 0.11, 0.13); c.translate(0, 0.01, -0.33); add(c, '#c9772d');
  for (const [x, z] of [[0.05, 0.05], [-0.1, -0.12], [0.14, -0.15]]) { const s = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10); s.translate(x, 0.045, z); add(s, '#e8384f', false); }
  g.visible = false; scene.add(g); return g;
}
function tossPizza() {
  if (NEWS.over) return; let best = null, bd = 1e9;
  for (const b of BYS.list) { const d = Math.hypot(b.x - hero.pos.x, b.z - hero.pos.z); if (d < bd) { bd = d; best = b; } }
  let s = PIZ.find((q) => !q.g.visible); if (!s) { if (PIZ.length > 3) return; s = { g: buildSlice() }; PIZ.push(s); }
  const [tx, tz] = streetClamp(hero.pos.x + rnd(-1.5, 1.5), hero.pos.z + rnd(-1.5, 1.5));
  Object.assign(s, { state: 'fly', t: 0, dur: 1.1, ax: best.x, az: best.z, tx, tz, life: 16 }); s.g.visible = true; EV.pizzaThrown++;
  spawnSprite(WTX.slice, _w.set(best.x, 2.7, best.z), 0.8, 1.2, { kind: 'word', aspect: 512 / 160 }); sfx2('cheer');
  headline('FANS TOSS A SLICE TO THE MASKED HERO', 'hype');
}
function updatePizza(dt) {
  for (const s of PIZ) {
    if (!s.g.visible) continue; s.t += dt;
    if (s.state === 'fly') { const u = Math.min(1, s.t / s.dur); s.g.position.set(lerp(s.ax, s.tx, u), CURB + 1.4 + Math.sin(u * Math.PI) * 3.2 - u * 1.0, lerp(s.az, s.tz, u)); s.g.rotation.set(s.t * 9, s.t * 5, 0); if (u >= 1) { s.state = 'land'; s.t = 0; } }
    else { s.g.position.y = groundY(s.tx, s.tz) + 0.45 + Math.sin(s.t * 4) * 0.08; s.g.rotation.set(0.35, s.t * 2.5, 0); s.life -= dt;
      if (Math.hypot(hero.pos.x - s.tx, hero.pos.z - s.tz) < 1.2) { s.g.visible = false; hero.hp = Math.min(hero.maxHp, hero.hp + 30); EV.pizzaEaten++; sfx2('pickup'); spawnSprite(WTX.yum, _w.set(hero.pos.x, 2.4, hero.pos.z), 0.8, 1.0, { kind: 'word', aspect: 512 / 160 }); gain(2, 'CROWD PLEASER'); }
      if (s.life <= 0) s.g.visible = false; }
  }
}

// ---------------- police: low ratings send one cruiser; no fighting cops, avoid or outrun ----------------
function buildCruiser() {
  const g = new THREE.Group(), mat = toonMat();
  const add = (geo, col, ol = true) => { bakeColor(geo, col); if (ol) addOdir(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); if (ol) m.add(new THREE.Mesh(geo, OUT_PROP)); return m; };
  const B = (w, h, d, x, y, z) => { const q = new THREE.BoxGeometry(w, h, d); q.translate(x, y, z); return q; };
  add(B(1.9, 0.75, 4.3, 0, 0.72, 0), '#f2f2f2'); add(B(1.94, 0.42, 1.9, 0, 0.66, 0.05), '#1b2a5a', false);
  add(B(1.7, 0.7, 2.2, 0, 1.45, -0.2), '#f2f2f2');
  add(B(1.5, 0.48, 0.05, 0, 1.47, 0.9), '#5d8ab8', false); add(B(1.5, 0.48, 0.05, 0, 1.47, -1.31), '#5d8ab8', false);
  for (const s of [-1, 1]) add(B(0.05, 0.46, 1.8, s * 0.86, 1.47, -0.2), '#5d8ab8', false);
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2b2340'); }
  add(B(1.5, 0.18, 0.06, 0, 0.86, 2.16), '#fff6b0', false); add(B(1.5, 0.16, 0.06, 0, 0.86, -2.16), '#ff3d6e', false);
  add(B(1.3, 0.14, 0.36, 0, 1.87, -0.2), '#14101f');
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#ff2040', fog: false })); red.position.set(-0.36, 1.99, -0.2); g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#2f6bff', fog: false })); blue.position.set(0.36, 1.99, -0.2); g.add(blue);
  // door decal: an original "CITY PATROL" lettering
  const dt = canvasTex(256, 64, (c) => { c.fillStyle = '#1b2a5a'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = '900 34px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CITY PATROL', 128, 34); });
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.4), new THREE.MeshBasicMaterial({ map: dt })); pl.position.set(s * 0.985, 0.66, 0.05); pl.rotation.y = s * Math.PI / 2; g.add(pl); }
  g.userData = { red, blue }; g.visible = false; scene.add(g); return g;
}
const COP = { on: false, car: buildCruiser(), f: new Fighter(buildOfficer(), { x: 0, z: -60, yaw: 0, hp: 1, r: 0.42 }), state: 'off', t: 0, lastEnd: -99, path: [], pi: 0, chaseT: 0, farT: 0, coll: null, bld: null };
COP.f.root.visible = false;
function armOf(x, z) { if (Math.abs(x) < RW + 3 && Math.abs(z) < RW + 3) return null; return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)]; }
function callCops() {
  COP.on = true; COP.state = 'drive'; COP.t = 0; EV.cops++;
  // enter from the end of a street arm the hero isn't on, swing through the intersection, pull up near the hero
  const ha = armOf(hero.pos.x, hero.pos.z), arms = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((a) => !ha || a[0] !== ha[0] || a[1] !== ha[1]);
  const A = arms[(Math.random() * arms.length) | 0], lane = 2.6;
  const start = [A[0] * 41 + (A[1] ? -A[1] * lane : 0), A[1] * 41 + (A[0] ? A[0] * lane : 0)];
  const mid = [A[0] * 9 + (A[1] ? -A[1] * lane : 0), A[1] * 9 + (A[0] ? A[0] * lane : 0)];
  let stop;
  if (ha) { const along = ha[0] ? hero.pos.x : hero.pos.z, s = Math.sign(along), at = clamp(Math.abs(along) - 10, 8, 36) * s; stop = ha[0] ? [at, -s * lane] : [s * lane, at]; }
  else { stop = [A[0] * 12 + (A[1] ? -A[1] * lane : 0), A[1] * 12 + (A[0] ? A[0] * lane : 0)]; }
  COP.path = [start, mid, stop]; COP.pi = 1; COP.car.position.set(start[0], 0, start[1]); COP.car.visible = true;
  COP.car.rotation.y = Math.atan2(mid[0] - start[0], mid[1] - start[1]);
  headline('POLICE CALLED TO 5TH & GRAND', 'hostile'); dana('cops'); sfx2('siren');
}
function carCollider(on) {
  const i = COLL.indexOf(COP.coll); if (i >= 0) COLL.splice(i, 1); const j = BLD.indexOf(COP.bld); if (j >= 0) BLD.splice(j, 1); COP.coll = COP.bld = null;
  if (!on) return; const c = COP.car.position, along = Math.abs(Math.sin(COP.car.rotation.y)) > 0.5;
  const bx = along ? 2.2 : 1.0, bz = along ? 1.0 : 2.2;
  COP.coll = { x0: c.x - bx, x1: c.x + bx, z0: c.z - bz, z1: c.z + bz }; COP.bld = { x0: c.x - bx, x1: c.x + bx, z0: c.z - bz, z1: c.z + bz, h: 1.9 };
  COLL.push(COP.coll); BLD.push(COP.bld);
}
function updateCop(dt) {
  const car = COP.car, f = COP.f;
  if (car.visible) { const k = (S.time * 6) % 2 < 1; car.userData.red.material.color.set(k ? '#ff2040' : '#4a0a14'); car.userData.blue.material.color.set(k ? '#1a2440' : '#2f8bff'); }
  if (!COP.on) return; COP.t += dt;
  const drive = (sp) => { // follow waypoints; shove anyone in the way
    const w = COP.path[COP.pi]; const dx = w[0] - car.position.x, dz = w[1] - car.position.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { COP.pi++; return COP.pi >= COP.path.length; }
    const ty = Math.atan2(dx, dz); car.rotation.y += angTo(car.rotation.y, ty) * (1 - Math.exp(-dt * 5));
    const s = Math.min(sp, d * 2 + 2); car.position.x += Math.sin(car.rotation.y) * s * dt; car.position.z += Math.cos(car.rotation.y) * s * dt;
    for (const a of [...ALL, CREW.rep]) { const ddx = a.pos.x - car.position.x, ddz = a.pos.z - car.position.z, dd = Math.hypot(ddx, ddz); if (dd < 2.4 && dd > 1e-3) { a.pos.x = car.position.x + ddx / dd * 2.4; a.pos.z = car.position.z + ddz / dd * 2.4; } }
    return false;
  };
  if (COP.state === 'drive') {
    if (drive(14)) { COP.state = 'exit'; COP.t = 0; carCollider(true);
      const r = car.rotation.y; f.pos.set(car.position.x + Math.cos(r) * 1.5, 0, car.position.z - Math.sin(r) * 1.5); f.yaw = r; f.root.visible = true; f.set('run'); COP.chaseT = 0; COP.farT = 0; COP.winded = false;
      spawnSprite(WTX.freeze, _w.set(f.pos.x, 2.7, f.pos.z), 1.0, 1.4, { kind: 'word', aspect: 512 / 160 }); }
  } else if (COP.state === 'exit' || COP.state === 'chase') {
    COP.state = 'chase'; COP.chaseT += dt; f.st += dt; f.at += dt;
    const dx = hero.pos.x - f.pos.x, dz = hero.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    COP.farT = d > 11 ? COP.farT + dt : 0;
    if (hero.state !== 'cuffed' && d < 1.0 && hero.y < 0.5 && hero.state !== 'down') { // gotcha: detained (a penalty, not a fight)
      hero.set('cuffed'); hero.vel.set(0, 0); EV.busted++; RT.v = Math.max(0, RT.v - 10); S.combo = 0;
      headline('VIGILANTE DETAINED BY POLICE AT 5TH & GRAND', 'hostile'); dana('busted'); COP.state = 'cuff'; COP.t = 0;
    } else if (COP.farT > 1.5 || COP.chaseT > 12 || RT.v > 48) { // gave up / stood down
      if (RT.v <= 48) { EV.copEvaded++; headline('VIGILANTE GIVES POLICE THE SLIP', 'news'); dana('evade'); } else headline('POLICE STAND DOWN AS CROWD BACKS HERO', 'hype');
      COP.state = 'back';
    } else {
      const sp = COP.chaseT < 4 ? 5.2 : 3.9; if (COP.chaseT >= 4 && !COP.winded) { COP.winded = true; spawnSprite(WTX.huff, _w.set(f.pos.x, 2.5, f.pos.z), 0.7, 1.2, { kind: 'word', aspect: 512 / 160 }); }
      f.vel.set(dx / (d || 1) * sp, dz / (d || 1) * sp); f.yaw += angTo(f.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 10));
      f.pos.x += f.vel.x * dt; f.pos.z += f.vel.y * dt; collide(f);
      const p = THUG_POSES.run(f.at, sp, f.J); p.shR = [-1.6, 0, -0.2]; p.elR = [-0.2, 0, 0]; applyPose(f.J, p, 14, dt, false);
    }
  } else if (COP.state === 'cuff') {
    f.st += dt; const p = THUG_POSES.idle(f.at, f.J); p.shL = p.shR = [-0.9, 0, 0]; p.elL = p.elR = [-0.6, 0, 0]; applyPose(f.J, p, 10, dt, false);
    f.yaw += angTo(f.yaw, Math.atan2(hero.pos.x - f.pos.x, hero.pos.z - f.pos.z)) * (1 - Math.exp(-dt * 8));
    if (hero.state !== 'cuffed') COP.state = 'back';
  } else if (COP.state === 'back') { // walk back to the cruiser, then drive off
    f.at += dt; const r = car.rotation.y, dx = car.position.x + Math.cos(r) * 1.5 - f.pos.x, dz = car.position.z - Math.sin(r) * 1.5 - f.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.8) { f.root.visible = false; f.pos.set(0, 0, -80); carCollider(false); COP.state = 'leave'; COP.path = [COP.path[2], COP.path[1], COP.path[0]]; COP.pi = 1; }
    else { f.vel.set(dx / d * 4.5, dz / d * 4.5); f.pos.x += f.vel.x * dt; f.pos.z += f.vel.y * dt; collide(f); f.yaw += angTo(f.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 10)); applyPose(f.J, THUG_POSES.run(f.at, 4.5, f.J), 14, dt, false); }
  } else if (COP.state === 'leave') {
    if (drive(14)) { car.visible = false; COP.on = false; COP.state = 'off'; COP.lastEnd = S.time; }
  }
  f.sync(dt);
}
NEWS.onReleased = () => { headline('VIGILANTE RELEASED WITH A WARNING', 'news'); };

// ---------------- word sprites (original) ----------------
const wordTex = (w, fill) => canvasTex(512, 160, (c) => { comicText(c, w, 256, 86, w.length > 8 ? 62 : 84, fill, null, { sx: 1 }); });
const WTX = { woo: wordTex('WOO!', '#ffd23c'), boo: wordTex('BOO!', '#c9a6ff'), nocam: wordTex('NO CAMERAS!', '#ff5fa2'), freeze: wordTex('FREEZE!', '#7fe8ff'), slice: wordTex('HEADS UP!', '#ffd23c'), yum: wordTex('+HP', '#7dff6b'), huff: wordTex('HUFF.. PUFF..', '#c9a6ff'), help: wordTex('HELP!', '#ffd23c') };

// ---------------- instant replay: ring buffer of rig snapshots, played back slow from a new angle ----------------
const REPLAY = { on: false, buf: [], acc: 0, u: 0, dur: 2.7, t0: 0, t1: 0, lastT: -99, focus: new THREE.Vector3(), ang: 0, now: null, info: null, best: null, thumbDone: false };
const ACTJ = () => [hero.J, ...enemies.map((e) => e.J), CREW.op.J, CREW.rep.J, COP.f.J];
const NJ = JOINTS.length * 3 + 7;
function snap(time) {
  const js = ACTJ(), a = new Float32Array(js.length * NJ);
  js.forEach((J, i) => { let k = i * NJ; const r = J.root; a[k++] = r.position.x; a[k++] = r.position.y; a[k++] = r.position.z; a[k++] = r.rotation.y; a[k++] = r.visible ? 1 : 0; a[k++] = J.tilt.position.y; a[k++] = J.hips.position.y;
    for (const j of JOINTS) { const g = J[j]; if (g) { a[k] = g.rotation.x; a[k + 1] = g.rotation.y; a[k + 2] = g.rotation.z; } k += 3; } });
  return { time, a, car: [COP.car.position.x, COP.car.position.z, COP.car.rotation.y, COP.car.visible ? 1 : 0] };
}
function applySnap(A, B, u) {
  const js = ACTJ(), a = A.a, b = B.a;
  js.forEach((J, i) => { let k = i * NJ; const r = J.root, L = (q) => a[q] + (b[q] - a[q]) * u, LA = (q) => a[q] + angTo(a[q], b[q]) * u;
    r.position.set(L(k), L(k + 1), L(k + 2)); r.rotation.y = LA(k + 3); r.visible = a[k + 4] > 0.5; J.tilt.position.y = L(k + 5); J.hips.position.y = L(k + 6); k += 7;
    for (const j of JOINTS) { const g = J[j]; if (g) g.rotation.set(LA(k), LA(k + 1), LA(k + 2)); k += 3; } });
  COP.car.position.x = A.car[0]; COP.car.position.z = A.car[1]; COP.car.rotation.y = A.car[2]; COP.car.visible = A.car[3] > 0.5;
}
function recordReplay(dt) {
  REPLAY.acc += dt; if (REPLAY.acc < 1 / 30) return; REPLAY.acc = 0;
  REPLAY.buf.push(snap(S.time)); if (REPLAY.buf.length > 90) REPLAY.buf.shift();
}
function startReplay(info) {
  if (REPLAY.buf.length < 20) return;
  REPLAY.on = true; REPLAY.u = 0; REPLAY.info = info; REPLAY.thumbDone = false; REPLAY.lastT = S.time; EV.replays++;
  REPLAY.t1 = S.time - 0.15; REPLAY.t0 = REPLAY.t1 - 1.35; REPLAY.now = snap(S.time);
  const e = info.e; REPLAY.focus.set((hero.pos.x + e.pos.x) / 2, 0.9, (hero.pos.z + e.pos.z) / 2);
  const live = Math.atan2(camera.position.x - REPLAY.focus.x, camera.position.z - REPLAY.focus.z), F = REPLAY.focus, others = [CREW.op, CREW.rep, COP.f, ...enemies.filter((q) => q !== e && q.alive && q.state !== 'dead')];
  let best = live + 1.7, bs = -1e9; // a different angle from the live shot, with a clear line to the action
  for (let k = 0; k < 16; k++) { const a = live + 1.1 + k / 16 * (TAU - 2.2), cx = F.x + Math.sin(a) * 4.4, cz = F.z + Math.cos(a) * 4.4; let clear = 9;
    for (const q of others) { if (!q.root.visible) continue; const vx = F.x - cx, vz = F.z - cz, L = Math.hypot(vx, vz), u = clamp(((q.pos.x - cx) * vx + (q.pos.z - cz) * vz) / (L * L), 0, 1); clear = Math.min(clear, Math.hypot(q.pos.x - (cx + vx * u), q.pos.z - (cz + vz * u))); }
    const axis = Math.atan2(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z), side = Math.abs(Math.sin(a - axis)); // side-on to the hero/thug line so both read
    if (blockedAt(cx, cz, 0.3)) clear -= 5; const sc = Math.min(clear, 2.5) + side * 2.2 - Math.abs(angTo(live + Math.PI, a)) * 0.1; if (sc > bs) { bs = sc; best = a; } }
  REPLAY.ang = best;
  fxLayer.visible = false; lockRing.visible = false; for (const s of SLASHES) s.m.visible = false; for (const q of enemies) q.hpS.visible = false;
  document.body.classList.add('replay'); $('liveT').textContent = 'REPLAY'; $('wipe').classList.remove('go'); void $('wipe').offsetWidth; $('wipe').classList.add('go'); sfx2('whoosh');
  $('rpCap').textContent = info.kind + (info.big ? ' ON THE BRUISER' : '') + (info.combo >= 3 ? ' · ' + info.combo + '-HIT COMBO' : '');
}
function updateReplay(rdt) {
  REPLAY.u += rdt; const u = clamp(REPLAY.u / REPLAY.dur, 0, 1);
  const tau = REPLAY.t0 + (REPLAY.t1 - REPLAY.t0) * ease(u) ;
  const B = REPLAY.buf; let i = B.findIndex((s) => s.time >= tau); if (i <= 0) i = 1; if (i < 0 || i >= B.length) i = B.length - 1;
  const A = B[i - 1], C = B[i]; applySnap(A, C, clamp((tau - A.time) / Math.max(1e-4, C.time - A.time), 0, 1));
  // low, slowly orbiting "angle 2" camera
  const por = PORTRAIT(), a = REPLAY.ang + u * 0.4, R = (por ? 6.2 : 4.4) - u * 0.7, F = REPLAY.focus;
  camera.position.set(F.x + Math.sin(a) * R, 1.0 + u * 0.3, F.z + Math.cos(a) * R); camera.up.set(0, 1, 0); camera.lookAt(F.x, 1.0, F.z); camera.rotateZ(0.08);
  const fov = por ? 72 : 50; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (u >= 1) {
    REPLAY.on = false; applySnap(REPLAY.now, REPLAY.now, 0); fxLayer.visible = true; document.body.classList.remove('replay'); $('liveT').textContent = 'LIVE';
    $('wipe').classList.remove('go'); void $('wipe').offsetWidth; $('wipe').classList.add('go'); CAMV.fov = 58;
  }
}
function replayThumb() { // grab a frame of this replay for the sign-off card (same task as the render, so no preserveDrawingBuffer needed)
  if (REPLAY.thumbDone || REPLAY.u / REPLAY.dur < 0.55) return; REPLAY.thumbDone = true;
  const info = REPLAY.info, score = (info.gain || 8) + info.combo * 2 + (info.big ? 10 : 0) + (info.kind === 'AIR SLASH' ? 6 : 0);
  if (REPLAY.best && REPLAY.best.score >= score) return;
  try { const W = canvas.width, H = canvas.height, k = Math.min(320 / W, 320 / H), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d');
    g.drawImage(canvas, 0, 0, W, H, 0, 0, c.width, c.height);
    REPLAY.best = { score, cap: $('rpCap').textContent, img: c.toDataURL('image/jpeg', 0.8), at: clockText(S.time) };
  } catch (err) { REPLAY.best = { score, cap: $('rpCap').textContent, img: null, at: clockText(S.time) }; }
}

// ---------------- broadcast HUD ----------------
function clockText(t) { const s = 82620 + Math.min(GAME_LEN, t) * 180 / GAME_LEN; const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s % 60); return (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ' PM'; }
const CHY = { cur: '', t: 99, queue: [], subT: 0 };
function headline(text, kind = 'news') {
  if (CHY.cur === text) return; EV.heads.push(text);
  CHY.queue = CHY.queue.filter((q) => q.kind === 'alert'); CHY.queue.push({ text, kind });
}
function updateChyron(dt) {
  CHY.t += dt; CHY.subT -= dt;
  if (CHY.queue.length && (CHY.t > 2.6 || CHY.queue[0].kind === 'alert')) {
    const q = CHY.queue.shift(); CHY.cur = q.text; CHY.t = 0;
    const L = $('lower'); L.className = 'ui k-' + q.kind; $('chyTag').textContent = { news: 'BREAKING', hype: 'LIVE', hostile: 'DEVELOPING', alert: 'ALERT' }[q.kind] || 'BREAKING';
    const h = $('chyHead'); h.textContent = q.text; h.classList.remove('in'); void h.offsetWidth; h.classList.add('in');
  }
  if (CHY.subT <= 0 && CHY.subT > -1) { $('chySub').textContent = 'DANA VEX · REPORTING LIVE · 5TH & GRAND'; CHY.subT = -2; }
}
const QUOTES = {
  open: '"We\'re live at 5th & Grand, where a masked figure has squared off with a street gang."',
  nocam: '"He\'s coming right at us — keep rolling, keep rolling!"', crewdown: '"Our camera is down! Are you okay?!"', crewup: '"He... helped us up. We\'re back, folks!"',
  ko: ['"Did you see that? Another one down!"', '"Incredible scenes here on Grand Avenue."', '"The crowd is going wild, folks."'], missed: '"We missed that one — get the shot!"',
  low: '"Viewers are asking: hero, or public nuisance?"', cops: '"We\'re hearing sirens. Police are on the way."', busted: '"Officers have detained the masked man."', evade: '"And he\'s lost them!"',
};
function dana(k) { let q = QUOTES[k]; if (!q) return; if (Array.isArray(q)) q = q[(Math.random() * q.length) | 0]; $('chySub').textContent = 'DANA VEX: ' + q; CHY.subT = 4.5; }
let popT = 0;
function popGain(txt, good) { const p = $('pop'); p.textContent = txt; p.classList.toggle('good', !!good); p.classList.remove('on'); void p.offsetWidth; p.classList.add('on'); popT = 1; }
function flashBack() { const b = $('backOn'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
const TICK = ['WKRK ACTION NEWS · LIVE AT ELEVEN', 'WEATHER: CLEAR AND COOL TONIGHT, LOW OF 52', 'CITY COUNCIL DELAYS VOTE ON GRAND AVE BIKE LANES', 'SPORTS: HARBOR HOUNDS EDGE RIVER KINGS 3-2 IN EXTRAS',
  'TRAFFIC: BRIDGE LANE CLOSURES OVERNIGHT', 'GRAND AVE SLICE FEST RETURNS THIS WEEKEND', 'MAYOR TO ADDRESS LATE-NIGHT NOISE COMPLAINTS', 'COMING UP: WHO IS THE MASKED VIGILANTE OF 5TH & GRAND?'];
function buildTicker() { const live = 'VIEWERS TUNED IN: ' + Math.round(RT.vShown).toLocaleString('en-US') + ' AND CLIMBING'; const s = [TICK[0], live, ...TICK.slice(1)].join('   ◆   ') + '   ◆   ';
  $('tickIn').innerHTML = '<span>' + s + '</span><span>' + s + '</span>'; }
buildTicker(); $('tickIn').addEventListener('animationiteration', buildTicker);
const STAT = { c: $('static'), g: null, img: null, a: 0 };
STAT.c.width = 160; STAT.c.height = 90; STAT.g = STAT.c.getContext('2d'); STAT.img = STAT.g.createImageData(160, 90);
function drawStatic(a) {
  STAT.a = damp(STAT.a, a, 6, 1 / 30); STAT.c.style.opacity = STAT.a.toFixed(3); if (STAT.a < 0.01) return;
  const d = STAT.img.data, roll = (CAMV.t * 40) % 90;
  for (let y = 0; y < 90; y++) { const band = Math.abs(y - roll) < 6 ? 60 : 0; for (let x = 0; x < 160; x++) { const v = (Math.random() * 255) | 0, i = (y * 160 + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.min(255, v + band); d[i + 3] = 255; } }
  STAT.g.putImageData(STAT.img, 0, 0);
}
let tickBuilt = 0, lastRat = -1;
function newsHud(dt, rdt) {
  const t = S.time;
  $('clock').textContent = clockText(t); $('clock').classList.toggle('late', GAME_LEN - t < 20);
  const f = Math.floor(CAMV.t * 30) % 30, sec = Math.floor(CAMV.t); $('rec').textContent = 'REC ' + [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60, f].map((v) => String(v).padStart(2, '0')).join(':');
  const rv = Math.round(RT.v); if (rv !== lastRat) { lastRat = rv; $('ratFill').style.width = RT.v + '%'; $('ratN').textContent = rv; }
  $('ratPeak').style.left = RT.peak + '%'; $('rat').classList.toggle('hit', RT.peak >= TARGET);
  const s = NEWS.seen, chip = $('mult');
  if (!s.ok) { chip.textContent = s.why === 'NO FEED' ? 'NO FEED' : 'OFF CAMERA'; chip.className = 'off'; }
  else if (s.good) { chip.textContent = '×2 GOOD FRAME'; chip.className = 'good'; } else { chip.textContent = '×1 ON CAMERA'; chip.className = ''; }
  $('frame').classList.toggle('good', s.ok && s.good);
  $('view').textContent = Math.round(RT.vShown).toLocaleString('en-US');
  $('gangN').textContent = S.kills + '/5';
  $('objR').classList.toggle('ok', RT.peak >= TARGET); $('objG').classList.toggle('ok', S.kills >= 5);
  offT -= rdt; if (offT <= 0) $('offcam').classList.remove('on');
  // crew down: technical difficulties
  const down = CREW.state === 'down' || CREW.state === 'help';
  document.body.classList.toggle('crewdown', down);
  if (down) { const d = Math.hypot(hero.pos.x - CREW.op.pos.x, hero.pos.z - CREW.op.pos.z); $('helpD').textContent = d < 2.4 ? (TOUCH ? 'TAP HELP TO GET THE CREW UP' : 'PRESS E TO HELP THE CREW UP') : 'GET TO THE CREW (THE CAMERA ON THE GROUND) · ' + Math.round(d) + 'M'; $('tech').classList.toggle('near', d < 2.4); }
  drawStatic(down ? 0.42 : COP.state === 'drive' ? 0.04 : S.shake > 0.6 ? 0.08 : 0);
  if (REPLAY.on) drawStatic(0);
  document.body.classList.toggle('hostile', !!NEWS.hostile); document.body.classList.toggle('hype', RT.cheerOn);
}

// ---------------- win / lose: make the 11 o'clock news ----------------
function checkEnd(dt) {
  if (NEWS.over || NEWS.wrapT >= 0) return;
  if (S.kills >= 5 && !REPLAY.on && !NEWS.replayPend) { NEWS.won = RT.peak >= TARGET; NEWS.endWhy = NEWS.won ? 'made' : 'short'; NEWS.wrapT = 2.2; banner2(NEWS.won ? "THAT'S A WRAP!" : 'NOT ENOUGH FOR THE TOP STORY'); if (NEWS.won) headline('MASKED HERO LEADS AT ELEVEN', 'hype'); }
  else if (S.time >= GAME_LEN) { NEWS.won = false; NEWS.endWhy = 'time'; NEWS.wrapT = 1.6; banner2("WE'RE OUT OF TIME"); }
}
function banner2(t) { const b = $('banner'); b.textContent = t; b.classList.add('on'); bannerT = 2.2; }
function grade() {
  const pts = RT.peak + S.kills * 4 + (REPLAY.best ? 5 : 0) - EV.busted * 8;
  if (NEWS.won) { if (pts >= 112 && !EV.busted) return ['A+', 'LEAD STORY: MASKED HERO CLEANS UP 5TH & GRAND']; if (pts >= 100) return ['A', 'TOP OF THE HOUR: VIGILANTE BREAKS UP STREET GANG']; if (pts >= 92) return ['B+', 'MASKED HERO MAKES THE ELEVEN']; return ['B', 'MASKED HERO SQUEAKS INTO THE ELEVEN']; }
  if (S.kills >= 5) return ['C', 'STREET FIGHT RUNS AFTER SPORTS'];
  if (S.kills >= 2) return ['D', 'BRIEF MENTION, AFTER THE WEATHER'];
  return ['F', 'STORY SPIKED: NOTHING TO SEE AT 5TH & GRAND'];
}
function showEnd() {
  NEWS.over = true; NEWS.endT = S.time; const [g, h] = grade(); NEWS.grade = g;
  $('endGrade').textContent = g; $('endHead').textContent = h; $('end').classList.toggle('won', NEWS.won);
  $('endWhy').textContent = NEWS.endWhy === 'made' ? 'Made the 11 o\'clock news' : NEWS.endWhy === 'short' ? 'Gang beaten, but the ratings fell short of the top story' : 'Out of time at 11:00 PM';
  const rows = [['Peak ratings', Math.round(RT.peak) + ' / goal ' + TARGET], ['Final ratings', Math.round(RT.v)], ['Peak viewers', Math.round(RT.vPeak).toLocaleString('en-US')], ['Gang taken down', S.kills + ' / 5'],
    ['Best combo', S.maxCombo + ' hits'], ['Instant replays', EV.replays], ['Crew knockdowns', EV.crewDown + (EV.crewDown ? ' (helped up ' + EV.crewUp + ')' : '')], ['Police', EV.cops ? (EV.busted ? 'detained ' + EV.busted + '×' : '') + (EV.copEvaded ? (EV.busted ? ', ' : '') + 'evaded ' + EV.copEvaded + '×' : '') || 'called' : 'never called']];
  $('endStats').innerHTML = rows.map(([k, v]) => '<div><span>' + k + '</span><b>' + v + '</b></div>').join('');
  const b = REPLAY.best; $('endRp').innerHTML = b ? (b.img ? '<img alt="best replay" src="' + b.img + '">' : '') + '<p><b>BEST REPLAY</b> ' + b.cap + ' · ' + b.at + '</p>' : '<p><b>BEST REPLAY</b> none: big finishers on camera trigger a replay</p>';
  document.body.classList.add('ended'); document.body.classList.remove('crewdown', 'replay');
}
$('again').addEventListener('click', () => location.reload());
addEventListener('keydown', (e) => { if (NEWS.over && (e.key === 'r' || e.key === 'R' || e.key === 'Enter')) location.reload(); });

// one news-layer step (inside the fixed-step loop)
function newsStep(dt) {
  updateCrew(dt); updateCop(dt); updateBystanders(dt); updateRatings(dt); recordReplay(dt);
  if (NEWS.replayPend) { NEWS.replayPend.t -= dt; if (NEWS.replayPend.t <= 0) { const info = NEWS.replayPend; NEWS.replayPend = null; startReplay(info); } }
  if (NEWS.wrapT >= 0) { NEWS.wrapT -= dt; if (NEWS.wrapT < 0) showEnd(); }
  checkEnd(dt);
}
headline('LIVE: MASKED VIGILANTE SPOTTED AT 5TH & GRAND', 'news'); dana('open');
function sfx2(kind) {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  try {
    const g = AC.createGain(); g.connect(AC.destination);
    if (kind === 'crash') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); s.start(t); s.stop(t + 0.4); }
    else if (kind === 'siren') { const o = AC.createOscillator(); o.type = 'triangle'; for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 620 : 860, t + i * 0.28); o.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.1); g.gain.setValueAtTime(0.07, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7); o.start(t); o.stop(t + 1.72); }
    else if (kind === 'cheer') { const s = AC.createBufferSource(); s.buffer = NOISE; s.loop = true; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3); s.start(t); s.stop(t + 1.32); }
    else if (kind === 'pickup') { const o = AC.createOscillator(); o.type = 'square'; [660, 880, 1320].forEach((fq, i) => o.frequency.setValueAtTime(fq, t + i * 0.07)); o.connect(g); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.31); }
    else if (kind === 'whoosh') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.35); s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); s.start(t); s.stop(t + 0.4); }
  } catch (e) { /* audio is optional */ }
}
NEWS.callCops = () => callCops(); // test hook

// ---------------- autopilot for tests (?bot=1): sag the ratings until the police come, outrun them, then fight the gang on camera.
// It deliberately lets the camera-shy thug reach the crew, throws a few punches while the feed is down (off-camera), then helps the crew up.
const BOTR = { phase: 'wait', t: 0, atkT: 0, airPend: undefined, log: [], done: false, fleeT: 0, wp: null, offT: 0, fightT: 0, stuck: 0, lastPos: [0, 0] };
const FLEE_WP = [[0, 36], [0, 18], [0, 0], [0, -18], [0, -36], [36, 0], [18, 0], [-18, 0], [-36, 0]];
function botLog(s) { BOTR.log.push(s + '@' + S.time.toFixed(1)); }
function botThink(dt) {
  const b = (IN.bot = IN.bot || { mx: 0, my: 0, look: 0 }); b.look = 0; b.mx = b.my = 0; BOTR.t += dt;
  if (NEWS.over) { BOTR.done = true; return; }
  if (REPLAY.on || hero.state === 'cuffed') return;
  let tx = null, tz = null, stopAt = 0.8;
  const cop = COP.on && (COP.state === 'chase' || COP.state === 'exit') ? COP.f : null;
  if (BOTR.phase === 'wait') { // walk to the middle of the intersection and loiter (ratings sag -> hostile chyron -> police)
    if (cop) { BOTR.phase = 'flee'; botLog('cop'); }
    else if (S.time > 45) { BOTR.phase = 'fight'; botLog('nocop'); }
    else { tx = 0; tz = 34; stopAt = 0.6; }
  }
  if (cop) {
    const dC = Math.hypot(cop.pos.x - hero.pos.x, cop.pos.z - hero.pos.z);
    if (BOTR.phase === 'flee' || dC < 6) {
      if (BOTR.phase === 'flee') { // kite the officer round a loop in the south street: the hero is faster, the officer can't close
        if (!BOTR.dir) { const a0 = Math.atan2(hero.pos.x - cop.pos.x, hero.pos.z - cop.pos.z); BOTR.dir = Math.sin(a0) >= 0 ? 1 : -1; }
        const a = Math.atan2(hero.pos.x, hero.pos.z - 34) + 0.7 * BOTR.dir; BOTR.wp = [Math.sin(a) * 7, 34 + Math.cos(a) * 7]; BOTR.fleeT = 1;
      }
      BOTR.fleeT -= dt;
      if (!BOTR.wp || BOTR.fleeT <= 0 || Math.hypot(BOTR.wp[0] - hero.pos.x, BOTR.wp[1] - hero.pos.z) < 2) {
        BOTR.fleeT = 0.5; let best = null, bs = -1e9;
        for (const w of FLEE_WP) { const dc = Math.hypot(w[0] - cop.pos.x, w[1] - cop.pos.z), dh = Math.hypot(w[0] - hero.pos.x, w[1] - hero.pos.z); if (dh < 2) continue; const sc = dc - dh * 0.5 - (dc < dh + 2 ? 60 : 0); if (sc > bs) { bs = sc; best = w; } }
        BOTR.wp = best || [0, 0];
      }
      tx = BOTR.wp[0]; tz = BOTR.wp[1]; stopAt = 0.4;
    }
  } else if (BOTR.phase === 'flee') { BOTR.phase = 'fight'; botLog('copGone'); }
  if (tx === null && BOTR.phase !== 'wait') {
    const crewDown = CREW.state === 'down';
    const near = enemies.filter((e) => e.alive && e.state !== 'dying' && e.state !== 'dead' && !e.tgtCrew && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < (crewDown ? 3.5 : 9) && (e.state !== 'idle' || Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 4));
    if (crewDown && (EV.offCam > 0 || !near.length || BOTR.offT > 3)) { // go help the crew up
      const o = CREW.op; tx = o.pos.x; tz = o.pos.z; stopAt = 1.6;
      if (Math.hypot(o.pos.x - hero.pos.x, o.pos.z - hero.pos.z) < 2.2 && hero.state === 'move' && o.st > 0.6) { b.help = true; if (!BOTR.helped) { BOTR.helped = 1; botLog('help'); } }
    } else if (near.length) {
      if (crewDown) BOTR.offT += dt;
      near.sort((p, q) => Math.hypot(p.pos.x - hero.pos.x, p.pos.z - hero.pos.z) - Math.hypot(q.pos.x - hero.pos.x, q.pos.z - hero.pos.z));
      const e = near[0]; tx = e.pos.x; tz = e.pos.z; stopAt = 1.6; BOTR.fightT += dt;
      const d = Math.hypot(tx - hero.pos.x, tz - hero.pos.z);
      const hold = enemies.some((q) => q.tgtCrew) && !crewDown; // let the camera-shy thug reach the crew (tests the knockdown)
      if (d < 2.4 && !hold) { BOTR.atkT -= dt; if (BOTR.atkT <= 0) { if (Math.random() < 0.1 && hero.state === 'move') { b.jump = true; BOTR.airPend = 0.2; } else b.atk = true; BOTR.atkT = 0.11; } }
      if (BOTR.airPend !== undefined) { BOTR.airPend -= dt; if (BOTR.airPend <= 0) { b.atk = true; BOTR.airPend = undefined; } }
    } else {
      const nxt = enemies.find((e) => e.alive && e.state !== 'dead' && e.state !== 'dying');
      if (nxt && !nxt.tgtCrew) { tx = nxt.pos.x; tz = nxt.pos.z; stopAt = 1.5; } // (a thug going for the crew is left alone on purpose)
    }
  }
  if (tx === null) return;
  { // route through the intersection when a corner block is in the way
    let cut = false; for (let i = 1; i < 12; i++) { const u = i / 12, x = lerp(hero.pos.x, tx, u), z = lerp(hero.pos.z, tz, u); if (Math.abs(x) > SW - 0.6 && Math.abs(z) > SW - 0.6) { cut = true; break; } }
    if (cut) { tx = clamp(hero.pos.x, -4, 4) * 0.3; tz = clamp(hero.pos.z, -4, 4) * 0.3; stopAt = 0.3; }
  }
  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);
  if (d < stopAt) return;
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]];
  b.mx = (dx * r[0] + dz * r[1]) / d; b.my = (dx * f[0] + dz * f[1]) / d;
}

// ---------------- pose sheet (?pose=1): every animation frozen side by side, for checking the rigs ----------------
const SIM = +(Q.get('sim') || 0), POSE = Q.has('pose');
let poseRigs = null;
function poseView(dt) {
  if (!poseRigs) {
    hero.root.visible = false; enemies.forEach((e) => (e.root.visible = false));
    const H = [['idle', 0.3], ['run', 0.2], ['atk1', 0.1], ['atk1', 0.6], ['atk2', 0.6], ['atk3', 0.45], ['jump', 0], ['airatk', 0.35], ['hurt', 0.2], ['down', 1]];
    const Tq = [['idle', 0], ['run', 0.3], ['windup', 0], ['attack', 0.5], ['hurt', 0.2], ['down', 1]];
    poseRigs = [];
    H.forEach(([n, u], i) => { const J = buildHero(); scene.add(J.root); J.root.position.set(-9 + i * 2, 0, 0); J.root.rotation.y = Q.get('pose') === 'b' ? Math.PI : 0.5; poseRigs.push([J, () => (n === 'idle' ? HERO_POSES.idle(0.3) : n === 'run' ? HERO_POSES.run(u, 6) : n === 'jump' ? HERO_POSES.jump(1) : n === 'down' ? HERO_POSES.down(1, true) : HERO_POSES[n](u))]); });
    Tq.forEach(([n, u], i) => { const look = THUG_LOOKS[i % 5]; const J = buildThug(look); scene.add(J.root); J.root.position.set(-6 + i * 2.4, 0, -4); J.root.rotation.y = 0.5; if (look.big) J.root.scale.setScalar(1.2);
      poseRigs.push([J, () => (n === 'idle' ? THUG_POSES.idle(0, J) : n === 'run' ? THUG_POSES.run(u, 4, J) : n === 'down' ? THUG_POSES.down(1, true) : THUG_POSES[n](u, J))]); });
  }
  for (const [J, f] of poseRigs) applyPose(J, f(), 60, 1, true);
  const pv = Q.get('pv') || 'h'; if (pv === 'h') { camera.position.set(-3.5, 1.6, 4.2); camera.lookAt(-3.5, 0.9, 0); } else if (pv === 'h2') { camera.position.set(4.5, 1.6, 4.2); camera.lookAt(4.5, 0.9, 0); } else { camera.position.set(0, 1.8, 2.6); camera.lookAt(0, 1.0, -4); }
}

// ---------------- main loop ----------------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const FPS = { v: 60, n: 0, t: 0 };
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    FPS.n++; FPS.t += rdt; if (FPS.t > 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.n = 0; FPS.t = 0; }
    if (window.__cel && __cel.pause) { renderer.render(scene, camera); return; }
    if (BOT) botThink(rdt);
    readInput();
    if (POSE) { poseView(rdt); renderer.render(scene, camera); return; }
    if (REPLAY.on) { // instant replay: the live action is frozen while the slow-mo plays from angle 2
      const vt = SIM ? Math.max(rdt, SIM / 120) : rdt; // ?sim=N: replay + chyron run on (scaled) game time so slow headless frames don't stretch them
      updateReplay(vt); newsHud(0, vt); updateChyron(vt); PRESS.clear(); renderer.render(scene, camera); replayThumb(); return;
    }
    if (NEWS.over) { updateCamera(0, rdt); PRESS.clear(); renderer.render(scene, camera); return; }
    // ?sim=N runs N fixed 1/60 s steps per rendered frame (headless tests on a slow software GPU)
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) {
      if (SIM) rdt = 1 / 60;
      if (BOT && k > 0) botThink(rdt);
      if (k > 0) readInput();
      let dt = rdt; if (S.hitstop > 0) { S.hitstop -= rdt; dt = rdt * 0.06; }
      S.time += dt;
      countAttackers();
      updateHero(dt);
      for (const e of enemies) updateEnemy(e, dt);
      separate();
      newsStep(dt);
      if (REPLAY.on || NEWS.over) break;
      if (k < steps - 1) { updateSprites(rdt); updateSlashes(rdt); PRESS.clear(); updateCamera(dt, rdt); }
    }
    const dt = rdt;
    // soft lock target (for the ring + camera framing)
    let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
    if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const cand = pickTarget(dx, dz, 6.5);
    lockT = cand && cand.state !== 'idle' && cand.state !== 'return' ? cand : (lockT && lockT.alive && lockT.state !== 'dying' && Math.hypot(lockT.pos.x - hero.pos.x, lockT.pos.z - hero.pos.z) < 8 && lockT.state !== 'return' ? lockT : null);
    lockRing.visible = !!lockT && !REPLAY.on;
    if (lockT) { lockRing.position.set(lockT.pos.x, lockT.pos.y + 0.03, lockT.pos.z); lockRing.scale.setScalar(lockT.scale); lockRing.userData.b.rotation.z += rdt * 3; }
    if (!REPLAY.on) updateCamera(dt, rdt);
    // moon + shadow camera follow the hero (snapped to shadow texels to stop shimmering)
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    updateSprites(rdt); updateSlashes(rdt); hud(rdt); newsHud(dt, SIM ? steps / 60 : rdt); updateChyron(SIM ? steps / 60 : rdt);
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    PRESS.clear();
    renderer.render(scene, camera);
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, enemies, CAM, BOTR, FPS, IN, renderer, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene, NEWS, RT, EV, CREW, COP, REPLAY, CHY, TARGET, GAME_LEN };

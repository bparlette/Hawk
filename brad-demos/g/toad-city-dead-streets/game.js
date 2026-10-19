// ===== copied from Toad City Baltimore src/01_core.js @ hark/integration 00058aa (renderer, PS1/HD toon material, ink-outline hulls; halftone patch) =====
// Bake-off K: "Toad Street 32" - one block of one street, an elderly toad couple vs. five thugs, rendered like a 32-bit (PS1-era) game:
// low-res target + nearest upscale, vertex snapping, affine-ish texture wobble, ordered dither + 15-bit colour, short fogged draw distance,
// and a 2-minute day/night cycle. Fork of J (Cinema City), standalone three.js r160, procedural everything.
import * as THREE from './three.module.min.js';

const $ = (id) => document.getElementById(id);
// the game view: on phones in portrait the canvas stops above the control deck, so screen maths uses the canvas size, not the window
const VW = () => (document.getElementById('gl') || {}).clientWidth || innerWidth, VH = () => (document.getElementById('gl') || {}).clientHeight || innerHeight;
const Q = new URLSearchParams(location.search);
let FPS_MODE = Q.get('fps') === '1' || Q.has('fps') || Q.get('tenderloin') === '1' || Q.has('tenderloin');
let CAM_YAW = 0, CAM_PITCH = 0;
const CAM_RECOIL = { pitch: 0, yaw: 0, roll: 0, kickZ: 0 };
const _camTarget = new THREE.Vector3();
let CH_SPREAD = 5, hitmarkerT = 0;
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

// ---------------- renderer: the scene renders into a ~240-line target, a post pass dithers it to 15-bit colour into a same-size canvas,
// and CSS upscales the canvas with nearest-neighbour (image-rendering: pixelated) ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, blocky shadow edges
renderer.outputColorSpace = THREE.SRGBColorSpace;
const LINES = clamp(+(Q.get('res') || 240), 120, 720); // the short side of the low-res target
const LOW = { w: 320, h: 240 };
const SNAP = { value: new THREE.Vector2(160, 120) }; // vertex snap grid (half the low-res size: clip space is -1..1)
// quality toggle: 32-bit (default) or HD (?hd=1, key H, HUD button): full-res, no snap / affine / dither / 15-bit, mipmapped full-size textures
const QUAL = { hd: !(Q.has('retro') && Q.get('retro') !== '0') && Q.get('hd') !== '0', snapOn: { value: 1 }, aff: { value: 0.45 }, post: { value: 1 }, toon: { value: 0 }, texs: [], outlines: [] }; // HD is the default; ?retro=1 = 32-bit
const HQ = QUAL.hd; // geometry detail is chosen at load (characters are smoother when the page opens in HD)
const RT_TYPE = (() => { try { const gl = renderer.getContext(); return gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType; } catch (e) { return THREE.UnsignedByteType; } })();
const RT = new THREE.WebGLRenderTarget(320, 240, { type: RT_TYPE, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
const POST = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: RT.texture }, uRes: { value: new THREE.Vector2(320, 240) }, uDither: { value: Q.get('dither') === '0' ? 0 : 1 }, uPost: QUAL.post, uHT: { value: 5.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; uniform float uHT; varying vec2 vUv;
    float bayer4(vec2 p) { // 4x4 ordered-dither threshold in [0,1)
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0; }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 px = floor(vUv * uRes);
      vec3 c = toSRGB(texture2D(tSrc, (px + 0.5) / uRes).rgb);
      if (uPost < 0.5) { // HD: straight copy + (Dead Streets) comic halftone dots in the shadows
        float lum = dot(c, vec3(0.299, 0.587, 0.114)); vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uHT;
        float k = clamp((0.3 - lum) * 2.6, 0.0, 0.8), dd = length(fract(hp) - 0.5), rr = sqrt(k) * 0.5;
        c = mix(c, c * vec3(0.55, 0.5, 0.68), (1.0 - smoothstep(rr - 0.07, rr + 0.03, dd)) * step(0.02, k) * 0.7);
        gl_FragColor = vec4(c, 1.0); return; }
      c += (bayer4(px) - 0.5) * (1.0 / 31.0) * uDither * 1.6; // dither across one 5-bit step (a touch more, PS1-style)
      c = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5) / 31.0;     // 15-bit colour: 5 bits per channel
      gl_FragColor = vec4(c, 1.0); }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
{ const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST); q.frustumCulled = false; postScene.add(q); }
function draw(sc = scene, cam = camera) {
  renderer.setRenderTarget(RT); renderer.render(sc, cam);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}

const scene = new THREE.Scene();
const FOGC = new THREE.Color('#b9c6cf');
scene.fog = new THREE.Fog(FOGC, 40, 150);
const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 260);

// ---------------- lights (driven by the day/night cycle in 07_main.js) ----------------
const hemi = new THREE.HemisphereLight('#dfe6ff', '#8a7f74', 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3dc', 2.0);
const SUN_DIR = new THREE.Vector3(-0.5, 1.7, 0.42).normalize();
sun.castShadow = true;
const SHM = 512;
sun.shadow.mapSize.set(SHM, SHM);
const SHR = 24;
Object.assign(sun.shadow.camera, { left: -SHR, right: SHR, top: SHR, bottom: -SHR, near: 1, far: 160 });
sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const muzzleLight = new THREE.PointLight('#ffbb55', 0, 24, 1.8);
scene.add(muzzleLight);

// ---------------- PS1-style materials ----------------
// Lambert (per-vertex-ish flat lighting look on low-poly geometry) + vertex colours, with:
//  - vertex snapping: clip-space xy snapped to the low-res pixel grid (the classic PS1 "wobble")
//  - affine-ish texture mapping on the tiled city atlas (uv interpolated partly in screen space)
//  - a hit-flash colour, and for the city a night emissive layer (lit windows / signs) from a second atlas
const NIGHT = { value: 0 }; // 0 day .. 1 night (set by the cycle)
const SNAP_V = `
  #include <project_vertex>
  if (uSnapOn > 0.5) { vec2 sp = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap; gl_Position.xy = sp * gl_Position.w; }`;
function toonMat(opts = {}, tiled = false) {
  const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC; sh.uniforms.uSnap = SNAP; sh.uniforms.uNight = NIGHT; sh.uniforms.uSnapOn = QUAL.snapOn; sh.uniforms.uAff = QUAL.aff; sh.uniforms.uToon = QUAL.toon;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSnap; uniform float uSnapOn;').replace('#include <project_vertex>', SNAP_V);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC; uniform float uToon;')
      .replace('#include <opaque_fragment>', `
        if (uToon > 0.5) { // HD cel bands: shadow / mid / lit, hard edges (like J's toon ramp)
          float ld = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3), lo = dot(outgoingLight, vec3(0.299, 0.587, 0.114)), r = lo / ld;
          float b = mix(0.46, 0.78, smoothstep(0.38, 0.44, r)); b = mix(b, 1.06, smoothstep(0.86, 0.92, r)); b = mix(b, r, step(1.35, r));
          outgoingLight *= b / max(r, 1e-3);
          outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.88, 0.86, 1.1), (1.0 - smoothstep(0.38, 0.44, r)) * 0.5); }
        outgoingLight = mix(outgoingLight, uFlashC, uFlash);
        #include <opaque_fragment>`);
    if (tiled) {
      sh.uniforms.tEmit = { value: EMIT_TEX };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 tr; varying vec4 vTr; varying vec3 vAff; varying vec3 vWP;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvTr = tr; vAff = vec3(vMapUv * gl_Position.w, gl_Position.w); vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec4 vTr; varying vec3 vAff; varying vec3 vWP; uniform sampler2D tEmit; uniform float uNight; uniform float uAff;\nfloat hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
        .replace('#include <map_fragment>', `
        vec2 aUv = mix(vMapUv, vAff.xy / vAff.z, uAff); // affine-ish wobble
        vec2 tuv = vTr.xy + fract(aUv) * vTr.zw;
        #ifdef USE_MAP
          diffuseColor *= texture2D(map, tuv);
        #endif`)
        .replace('#include <opaque_fragment>', `
        { vec4 em = texture2D(tEmit, tuv);
          // windows: each window cell (one atlas repeat) is lit or dark at night by a hash of its world cell; signs/shop glass always glow
          vec3 cell = vec3(floor(vMapUv), floor(vTr.x * 64.0) + floor(vWP.x * 0.13) * 3.0 + floor(vWP.z * 0.02) * 5.0);
          float lit = em.a > 0.75 ? 0.8 : step(0.55, hsh(cell * 0.731)) * (0.55 + 0.45 * hsh(cell * 1.37 + 7.0));
          outgoingLight += em.rgb * lit * uNight * 0.8; }
        #include <opaque_fragment>`);
    }
  };
  if (tiled) { m.defines = { TILED: '' }; }
  m.customProgramCacheKey = () => (tiled ? 'psxT' : 'psx');
  return m;
}
// unlit snapped material (neon, glow quads, lamp heads)
function basicSnap(opts) {
  const m = new THREE.MeshBasicMaterial(opts);
  m.onBeforeCompile = (sh) => { sh.uniforms.uSnap = SNAP; sh.uniforms.uSnapOn = QUAL.snapOn; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSnap; uniform float uSnapOn;').replace('#include <project_vertex>', SNAP_V); };
  m.customProgramCacheKey = () => 'psxB' + (opts.transparent ? 't' : '');
  return m;
}
// HD ink outlines (J's inverted hulls: back faces pushed out along a mitred direction, ~constant width on screen); hidden in 32-bit
const OUT_U = { fogC: { value: new THREE.Color() }, fogN: { value: 16 }, fogF: { value: 66 } };
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
// the quality switch shared by the game and the viewer (the caller re-sizes the render target)
function applyQuality(on) {
  QUAL.hd = !!on; QUAL.snapOn.value = on ? 0 : 1; QUAL.aff.value = on ? 0 : 0.45; QUAL.post.value = on ? 0 : 1; QUAL.toon.value = on ? 1 : 0;
  RT.texture.minFilter = RT.texture.magFilter = on ? THREE.LinearFilter : THREE.NearestFilter; RT.texture.needsUpdate = true;
  for (const t of QUAL.texs) texHD(t, on);
  for (const o of QUAL.outlines) o.visible = !!on;
  document.body.classList.toggle('hd', !!on);
}
function bakeColor(g, col) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// shrink + nearest-filter a canvas texture (PS1-scale textures: 64-128 px)
function lowTex(src, maxSide = 128) {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.userData.low = c; t.userData.src = src; QUAL.texs.push(t); if (QUAL.hd) texHD(t, true); return t;
}
function texHD(t, hd) { // HD: the full-size source canvas, trilinear mipmaps; 32-bit: the shrunk copy, nearest
  t.image = hd ? t.userData.src : t.userData.low; t.minFilter = hd ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter; t.magFilter = hd ? THREE.LinearFilter : THREE.NearestFilter;
  t.generateMipmaps = hd; t.anisotropy = hd ? 4 : 1; t.needsUpdate = true;
}
// ===== copied from Toad City Baltimore src/02_atlas.js @ hark/integration 00058aa (city atlas: facades, storefronts, real-name signs, ground tiles) =====

// ---------------- one 2048 atlas for the whole city: facade tiles, storefronts, roofs, signs, billboards, graffiti ----------------
const AS = 2048;
const atlasC = document.createElement('canvas'); atlasC.width = atlasC.height = AS;
const AX = atlasC.getContext('2d');
// night emissive atlas, same layout: rgb = glow colour, alpha 1 = always lit (signs, shop glass), alpha ~.5 = a window (lit by a per-window hash)
const emitC = document.createElement('canvas'); emitC.width = emitC.height = AS;
const EX = emitC.getContext('2d');
let _ax = 0, _ay = 0, _arow = 0;
const FONT = 'Impact, "Avenir Next Condensed", "Arial Black", "Helvetica Neue", "DejaVu Sans", sans-serif';
const INK = '#14101f';
function tile(w, h, draw, pad = 2, emit = null) {
  if (_ax + w > AS) { _ax = 0; _ay += _arow; _arow = 0; }
  const r = { x: _ax, y: _ay, w, h }; _ax += w; _arow = Math.max(_arow, h);
  AX.save(); AX.translate(r.x, r.y); AX.beginPath(); AX.rect(0, 0, w, h); AX.clip(); draw(AX, w, h); AX.restore();
  if (emit) { EX.save(); EX.translate(r.x, r.y); EX.beginPath(); EX.rect(0, 0, w, h); EX.clip(); emit(EX, w, h); EX.restore(); }
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
  { wall: '#8a4a3a', trim: '#c9b48a', glass: '#1f2a3a', gl2: '#5d7a8c', shade: '#d8c8a0' }, // red brick
  { wall: '#6f6a62', trim: '#a39a88', glass: '#1c2632', gl2: '#56707f', shade: '#c4bca8' }, // grey stone
  { wall: '#9a6a44', trim: '#4f3a2c', glass: '#202a36', gl2: '#64808c', shade: '#e0cfa8' }, // tan brick
  { wall: '#5a4f5c', trim: '#b8a27a', glass: '#1a2230', gl2: '#4f6878', shade: '#cfc2b0' }, // plum tenement
  { wall: '#4f5a52', trim: '#c4b490', glass: '#1b2530', gl2: '#58747c', shade: '#d4c8b4' }, // green-grey
  { wall: '#a4907a', trim: '#6a4a3a', glass: '#222c38', gl2: '#6a8592', shade: '#efe4cc' }, // sandstone
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
  }, 2, (c, w, h) => { // window glow: warm tungsten, a blind or curtain on some variants, mullions stay dark
    const x0 = 56, x1 = 200, y0 = 34, y1 = 196; const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(255,214,140,.5)'); g.addColorStop(1, 'rgba(255,170,80,.5)');
    c.fillStyle = g; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (variant === 2) { c.fillStyle = 'rgba(120,70,40,.5)'; c.fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.6); }
    c.clearRect((x0 + x1) / 2 - 4, y0, 8, y1 - y0); c.clearRect(x0, y0 + (y1 - y0) * 0.42 - 3, x1 - x0, 7);
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
  }, 2, (c, w, h) => { // shop glass glows at night; the sign band a little
    c.fillStyle = 'rgba(240,180,110,1)'; c.fillRect(24, 104, w - 48, h - 160); c.clearRect(w / 2 - 4, 104, 8, h - 160);
    c.fillStyle = 'rgba(120,90,60,1)'; c.fillRect(0, 6, w, 72);
  });
}
T.fac = PAL.map((p, i) => [facadeTile(p, 0), facadeTile(p, i % 2 ? 1 : 2)]);
T.store = PAL.map(storeTile);
T.roof = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#5a5650'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4640';
  for (let i = 0; i < 90; i++) c.fillRect(srnd() * w, srnd() * h, 3, 3);
  c.fillStyle = '#6e6a62'; for (let i = 0; i < 60; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
  c.fillStyle = 'rgba(20,16,31,.35)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h);
});
T.walk = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#a9a49a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#86817a'; c.fillRect(0, 0, w, 5); c.fillRect(0, 0, 5, h); c.fillRect(0, h / 2 - 1, w, 2); c.fillRect(w / 2 - 1, 0, 2, h);
  c.fillStyle = 'rgba(90,84,76,.45)'; for (let i = 0; i < 30; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
});
T.road = tile(128, 128, (c, w, h) => {
  c.fillStyle = '#45474c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#3a3c40'; for (let i = 0; i < 120; i++) c.fillRect(srnd() * w, srnd() * h, 3, 3);
  c.fillStyle = '#55575c'; for (let i = 0; i < 70; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2);
});
T.stripes = tile(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, w / 2, h); }); // awnings (tinted)
T.rail = tile(128, 64, (c, w, h) => { // fire-escape railing, alpha cut
  c.clearRect(0, 0, w, h); c.fillStyle = '#2b2340';
  c.fillRect(0, 2, w, 9); c.fillRect(0, h - 12, w, 8); for (let x = 2; x < w; x += 16) c.fillRect(x, 2, 5, h - 6);
});
T.stair = tile(128, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.fillStyle = '#2b2340'; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h); for (let y = 4; y < h; y += 11) c.fillRect(0, y, w, 5);
});
const SIGNS = [['PIZZA', '#7a1f24', '#ffd27a'], ['PAWN', '#1f2a3a', '#ffcf4a'], ['DINER', '#2a4a3a', '#ff8a6a'], ['DELI 24H', '#4a2a1a', '#ffe0a0'],
  ['PHARMACY', '#1f3a4a', '#9fe0c8'], ['BAKERY', '#5a3a2a', '#ffd8b0'], ['BINGO', '#3a1f3a', '#ff9ad0'], ['LAUNDRO', '#24324a', '#bfe4ff']];
T.signs = SIGNS.map(([t, bg, fg]) => tile(512, 128, (c, w, h) => {
  c.fillStyle = INK; c.fillRect(2, 2, w - 4, h - 4); c.fillStyle = bg; c.fillRect(12, 12, w - 24, h - 24);
  c.save(); c.font = `900 ${t.length > 6 ? 70 : 84}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(t, w / 2 + 5, h / 2 + 9, w - 50); c.fillStyle = fg; c.fillText(t, w / 2, h / 2 + 4, w - 50); c.restore();
}, 2, (c, w, h) => { c.save(); c.font = `900 ${t.length > 6 ? 70 : 84}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(t, w / 2, h / 2 + 4, w - 50); c.restore(); }));
function billboard(draw) { return tile(512, 256, (c, w, h) => { draw(c, w, h); c.strokeStyle = INK; c.lineWidth = 14; c.strokeRect(0, 0, w, h); }, 2,
  (c, w, h) => { draw(c, w, h); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.strokeStyle = '#000'; c.lineWidth = 14; c.strokeRect(0, 0, w, h); }); }
T.bill = []; // (Toad City: no billboards in phase 1; frees atlas space)
// graffiti pieces (alpha): bubble letters with ink outline, drips, sparkles
const GRAF = [['TOAD', '#9dbb4a', '#2a4a7a'], ['32', '#d8b04a', '#7a2a2a'], ['HOP', '#c86a8a', '#3a2a5a'], ['ZAP', '#6ab0c8', '#8a7a2a'],
  ['RUSH', '#c87a4a', '#14101f'], ['WILD', '#a48ac8', '#7a2a3a'], ['GG!', '#d8d0c0', '#2a6a6a'], ['YO', '#d8b04a', '#4a3a7a']];
T.graf = []; // (Toad City: no graffiti in phase 1; frees atlas space)

// ---------------- Toad City: harbour ground + landmark signs (real names, Brad's real-signage rule 2026-10-11; HD canvas signs in 03b) ----------------
T.grass = tile(128, 128, (c, w, h) => { c.fillStyle = '#5d8a3e'; c.fillRect(0, 0, w, h); c.fillStyle = '#4f7a34'; for (let i = 0; i < 140; i++) c.fillRect(srnd() * w, srnd() * h, 3, 2); c.fillStyle = '#76a24c'; for (let i = 0; i < 80; i++) c.fillRect(srnd() * w, srnd() * h, 2, 2); });
T.plank = tile(128, 128, (c, w, h) => { c.fillStyle = '#8a6a48'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(20,16,31,.35)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, y + 2, w, 3); } c.fillStyle = 'rgba(20,16,31,.25)'; for (let y = 0; y < h; y += 16) c.fillRect(((y * 7) % w), y, 2, 16); });
T.pave = tile(128, 128, (c, w, h) => { c.fillStyle = '#a8705a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(20,16,31,.28)'; for (let y = 0; y < h; y += 16) { c.fillRect(0, y, w, 2); for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) c.fillRect(x, y, 2, 16); } c.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 40; i++) c.fillRect(srnd() * w, srnd() * h, 3, 2); });
T.cobble = tile(128, 128, (c, w, h) => { c.fillStyle = '#5a5650'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? 0 : 7; x < w; x += 14) { c.fillStyle = srnd() < 0.5 ? '#7a746a' : '#6a655d'; rrect(c, x + 1, y + 1, 12, 10, 4); c.fill(); } });
T.glass = tile(256, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#7fa8c4'); g.addColorStop(1, '#2f4f6a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(30, h); c.lineTo(120, 0); c.lineTo(150, 0); c.lineTo(60, h); c.fill(); c.fillStyle = '#1a2230'; c.fillRect(0, 0, w, 10); c.fillRect(0, 0, 8, h); c.fillRect(w / 2 - 3, 0, 6, h); },
  2, (c, w, h) => { c.fillStyle = 'rgba(255,226,170,.55)'; c.fillRect(10, 14, w / 2 - 16, h - 18); c.fillRect(w / 2 + 6, 14, w / 2 - 12, h - 18); });
const LSIGN = { market: ['HARBORPLACE', '#1f3a4a', '#ffe08a'], trade: ['WORLD TRADE CENTER', '#1a2230', '#cfe8ff'], aqua: ['NATIONAL AQUARIUM', '#0f3a5a', '#7fe8ff'], power: ['POWER PLANT', '#3a1a14', '#ffb060'],
  hotel: ['FOUR SEASONS', '#2a2420', '#f0d8a0'], pier: ['PENDRY', '#24324a', '#ffe0a0'], ball: ['ORIOLE PARK AT CAMDEN YARDS', '#2a3a20', '#ffd27a'], stad: ['M&T BANK STADIUM', '#2a1f3a', '#d8c0ff'], sci: ['MARYLAND SCIENCE CENTER', '#1f2a3a', '#9fe0c8'],
  ath: ['UNDER ARMOUR', '#1a1a1a', '#f0f0f0'], fells: ['BROADWAY MARKET', '#4a2a1a', '#ffd8b0'], sugar: ['SUGAR', '#14080a', '#ff3a3a'] };
for (const k in LSIGN) { const [t, bg, fg] = LSIGN[k]; LSIGN[k] = tile(512, 128, (c, w, h) => { c.fillStyle = INK; c.fillRect(2, 2, w - 4, h - 4); c.fillStyle = bg; c.fillRect(12, 12, w - 24, h - 24);
    c.save(); c.font = `900 ${t.length > 8 ? 64 : 84}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(t, w / 2 + 5, h / 2 + 9, w - 50); c.fillStyle = fg; c.fillText(t, w / 2, h / 2 + 4, w - 50); c.restore(); },
  2, (c, w, h) => { c.save(); c.font = `900 ${t.length > 8 ? 64 : 84}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(t, w / 2, h / 2 + 4, w - 50); c.restore(); }); }
const atlasTex = lowTex(atlasC, 512);
const EMIT_TEX = lowTex(emitC, 512);
const CITY_MAT = toonMat({ map: atlasTex }, true);
const DECAL_MAT = toonMat({ map: atlasTex, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, true);
// ===== copied from Toad City Baltimore src/03_city.js @ hark/integration 00058aa (merged city builders, building(), street props, cars, lamps, trees, sky dome; world layout not copied) =====

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
  floorSub(x0, z0, x1, z1, y, tr, col, tileM = 4, cell = 4) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.floor(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), lerp(x0, x1, (i + 1) / nx), lerp(z0, z1, (j + 1) / nz), y, tr, col, tileM);
  }
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
class OB { // outlines are not used in the 32-bit look: kept as a no-op so the shared builders still run
  geom() {} box() {}
  build(mat) { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; return m; }
}
// Toad City: the city is big, so the merged builders are split into ~64 m chunks (each its own frustum-culled mesh).
// quad() / geom() route the whole primitive to the chunk under its first vertex.
const CHUNK = 64;
class CMB {
  constructor() { this.ch = new Map(); }
  at(x, z) { if (this.cap) return this.cap; const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); let m = this.ch.get(k); if (!m) this.ch.set(k, (m = new MB())); return m; }
  quad(a, b, c, d, uv, col, tr) { this.at(a[0], a[2]).quad(a, b, c, d, uv, col, tr); }
  wall(xa, za, xb, zb, y0, y1, tr, col, uv) { this.at((xa + xb) / 2, (za + zb) / 2).wall(xa, za, xb, zb, y0, y1, tr, col, uv); }
  floor(x0, z0, x1, z1, y, tr, col, tileM = 4) { this.at((x0 + x1) / 2, (z0 + z1) / 2).floor(x0, z0, x1, z1, y, tr, col, tileM); }
  floorSub(x0, z0, x1, z1, y, tr, col, tileM = 4, cell = 4) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.floor(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), lerp(x0, x1, (i + 1) / nx), lerp(z0, z1, (j + 1) / nz), y, tr, col, tileM);
  }
  box(x0, y0, z0, x1, y1, z1, col, tr, opt) { this.at((x0 + x1) / 2, (z0 + z1) / 2).box(x0, y0, z0, x1, y1, z1, col, tr, opt); }
  geom(g, col, tr, uvScale) { g.computeBoundingBox(); const b = g.boundingBox; this.at((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2).geom(g, col, tr, uvScale); }
  build(mat, o = {}) {
    const grp = new THREE.Group(); grp.userData.meshes = [];
    for (const m of this.ch.values()) { if (!m.P.length) continue; const mesh = m.build(mat); mesh.castShadow = !!o.cast; mesh.receiveShadow = true; grp.add(mesh); grp.userData.meshes.push(mesh); }
    return grp;
  }
}
let CB = new CMB(), DB = new CMB(), OL = new OB(), GB = new CMB(); // city, decals, outlines (no-op), ground (no shadow cast)
// LMCAP(id): route the city + decal builders into a per-landmark capture (that landmark's far LOD; 03b_landmarks_hd.js adds the HD near model); LMCAP(null) ends it
const LM_CAPS = {}; function LMCAP(id) { if (!id) { CB.cap = DB.cap = null; return; } LM_CAPS[id] = { cb: (CB.cap = new MB()), db: (DB.cap = new MB()) }; }
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }
const CURB = 0.16, GF = 4.4, FH = 3.4, PAR = 1.3, WY = -0.85; // curb height, ground floor, floor height, parapet, water level
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
  const w = 3.6, d = 1.15, m = at * L, col = '#2a2622';
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
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.1, 0.12, legH, 6); place(g, x + a * r * 0.62, y + legH / 2, z + b * r * 0.62); solid(g, '#2a2622'); }
  const cross = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross, x, y + legH * 0.55, z - r * 0.62); solid(cross, '#2a2622', false);
  const cross2 = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross2, x, y + legH * 0.55, z + r * 0.62); solid(cross2, '#2a2622', false);
  const tank = new THREE.CylinderGeometry(r, r * 1.04, tankH, 18, 1); place(tank, x, y + legH + tankH / 2, z); solid(tank, '#7a5a3a');
  for (const k of [0.25, 0.7]) { const band = new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.14, 18, 1, true); place(band, x, y + legH + tankH * k, z); CB.geom(band, '#2a2622'); }
  const roof = new THREE.ConeGeometry(r * 1.12, 1.25, 18); place(roof, x, y + legH + tankH + 0.62, z); solid(roof, '#4a3a2a');
  const knob = new THREE.SphereGeometry(0.16, 8, 6); place(knob, x, y + legH + tankH + 1.3, z); solid(knob, '#ffd23c');
  BLD.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: y + legH + tankH + 1.3, y0: y });
}
function billboardOn(face, y, bi) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = Math.min(9, L - 1.5), hh = w / 2, m = L / 2, inset = 1.6, base = y + 1.6;
  const P = (s, t, yy) => [xa + ux * s - nx * t, yy, za + uz * s - nz * t];
  const ang = Math.atan2(nx, nz);
  for (const s of [m - w * 0.35, m + w * 0.35]) { const g = new THREE.BoxGeometry(0.22, base - y + 0.2, 0.22); const p = P(s, inset + 0.3, (y + base) / 2); place(g, p[0], p[1], p[2], ang); solid(g, '#2a2622'); }
  const back = new THREE.BoxGeometry(w + 0.5, hh + 0.5, 0.3); const pc = P(m, inset + 0.15, base + hh / 2); place(back, pc[0], pc[1], pc[2], ang); solid(back, '#2a2622');
  const a = P(m - w / 2, inset - 0.02, base), b = P(m + w / 2, inset - 0.02, base);
  CB.quad(a, b, [b[0], base + hh, b[2]], [a[0], base + hh, a[2]], [0.003, 0.003, 0.997, 0.997], '#fff', T.bill[bi]);
  // catwalk + lamps
  const cw = new THREE.BoxGeometry(w * 0.9, 0.08, 0.7); const pw = P(m, inset - 0.4, base - 0.1); place(cw, pw[0], pw[1], pw[2], ang); solid(cw, '#2a2622');
  for (const s of [m - w * 0.3, m + w * 0.3]) { const g = new THREE.BoxGeometry(0.5, 0.18, 0.3); const p = P(s, inset - 0.7, base + hh + 0.35); place(g, p[0], p[1], p[2], ang, 0.5); solid(g, '#ffd23c'); }
}

// ---------------- street props ----------------
function lamp(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.11, 0.15, 5.2, 6); place(g, x, CURB + 2.6, z); solid(g, '#2c322e');
  const arm = new THREE.BoxGeometry(0.12, 0.12, 1.6); arm.translate(0, 0, 0.8); place(arm, x, CURB + 5.1, z, ang); solid(arm, '#2c322e');
  const head = new THREE.CylinderGeometry(0.18, 0.42, 0.32, 6); place(head, x + Math.sin(ang) * 1.6, CURB + 4.95, z + Math.cos(ang) * 1.6); solid(head, '#5a5a4a');
  COLL.push({ x, z, r: 0.3 });
}
function trafficLight(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 8); place(g, x, CURB + 2.8, z); solid(g, '#ffd23c');
  const arm = new THREE.BoxGeometry(0.14, 0.14, 4.2); arm.translate(0, 0, 2.1); place(arm, x, CURB + 5.4, z, ang); solid(arm, '#ffd23c');
  const hx = x + Math.sin(ang) * 3.6, hz = z + Math.cos(ang) * 3.6;
  const box = new THREE.BoxGeometry(0.5, 1.4, 0.45); place(box, hx, CURB + 4.6, hz, ang); solid(box, '#2a2622');
  const px = Math.cos(ang), pz = -Math.sin(ang);
  ['#ff3d6e', '#ffd23c', '#7dff6b'].forEach((c, i) => { for (const sd of [-1, 1]) { const l = new THREE.SphereGeometry(0.14, 10, 8); place(l, hx + px * 0.24 * sd, CURB + 5.05 - i * 0.43, hz + pz * 0.24 * sd); CB.geom(l, c); } });
  COLL.push({ x, z, r: 0.3 });
}
function hydrant(x, z) {
  const b = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10); place(b, x, CURB + 0.35, z); solid(b, '#a8302a');
  const t = new THREE.SphereGeometry(0.22, 8, 4, 0, TAU, 0, Math.PI / 2); place(t, x, CURB + 0.7, z); solid(t, '#a8302a');
  const n = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8); place(n, x, CURB + 0.45, z, 0, 0, Math.PI / 2); solid(n, '#ffd23c');
  COLL.push({ x, z, r: 0.35 });
}
function bin(x, z, col = '#22c4b4') {
  const b = new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12); place(b, x, CURB + 0.48, z); solid(b, col);
  const l = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12); place(l, x, CURB + 1.0, z); solid(l, '#2a2622');
  COLL.push({ x, z, r: 0.45 });
}
function dumpster(x, z, ang) {
  const g = new THREE.BoxGeometry(2.4, 1.3, 1.3); g.translate(0, 0.65, 0); place(g, x, CURB, z, ang); solid(g, '#2f5a3a');
  const l = new THREE.BoxGeometry(2.5, 0.12, 1.4); l.rotateX(-0.12); l.translate(0, 1.36, 0); place(l, x, CURB, z, ang); solid(l, '#1f3a2a');
  const s = Math.abs(Math.sin(ang)) > 0.5; COLL.push(s ? { x0: x - 0.7, x1: x + 0.7, z0: z - 1.25, z1: z + 1.25 } : { x0: x - 1.25, x1: x + 1.25, z0: z - 0.7, z1: z + 0.7 });
}
function car(x, z, ang, body, roofC) {
  const grp = []; const along = Math.abs(Math.sin(ang)) > 0.5; // along x
  const add = (g, col, ol = true) => { place(g, x, 0, z, ang); solid(g, col, ol); };
  const b = new THREE.BoxGeometry(1.9, 0.75, 4.3); b.translate(0, 0.72, 0); add(b, body);
  const c = new THREE.BoxGeometry(1.7, 0.7, 2.2); c.translate(0, 1.45, -0.2); add(c, roofC || body);
  const wF = new THREE.BoxGeometry(1.5, 0.48, 0.05); wF.translate(0, 1.47, 0.9); add(wF, '#6a8a9a', false);
  const wB = new THREE.BoxGeometry(1.5, 0.48, 0.05); wB.translate(0, 1.47, -1.31); add(wB, '#6a8a9a', false);
  for (const s of [-1, 1]) { const ws = new THREE.BoxGeometry(0.05, 0.46, 1.8); ws.translate(s * 0.86, 1.47, -0.2); add(ws, '#6a8a9a', false); }
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2a2622'); }
  const hl = new THREE.BoxGeometry(1.5, 0.18, 0.06); hl.translate(0, 0.86, 2.16); add(hl, '#efe4b0', false);
  const tl = new THREE.BoxGeometry(1.5, 0.16, 0.06); tl.translate(0, 0.86, -2.16); add(tl, '#ff3d6e', false);
  COLL.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1.0, z1: z + 1.0 } : { x0: x - 1.0, x1: x + 1.0, z0: z - 2.2, z1: z + 2.2 });
  BLD.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1, z1: z + 1, h: 1.8 } : { x0: x - 1, x1: x + 1, z0: z - 2.2, z1: z + 2.2, h: 1.8 });
}
const LAMPS = [];
function lampAt(x, z, ang) { lamp(x, z, ang); LAMPS.push({ x: x + Math.sin(ang) * 1.6, z: z + Math.cos(ang) * 1.6, y: CURB + 4.8, px: x, pz: z }); }
function tree(x, z) {
  const t = new THREE.CylinderGeometry(0.14, 0.2, 3.0, 6); place(t, x, CURB + 1.5, z); solid(t, '#5a4030');
  const c = new THREE.IcosahedronGeometry(1.25, 0); place(c, x, CURB + 3.9, z, x * 0.37); solid(c, '#4f7f3a');
  COLL.push({ x, z, r: 0.35 });
}
const SKY = (function sky() {
  const U = { top: { value: new THREE.Color('#4a86c8') }, mid: { value: new THREE.Color('#9cc4dc') }, hor: { value: new THREE.Color('#d8dccf') }, uStars: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform float uStars; varying vec3 vP;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
        vec3 q = floor(vP * 160.0); float s = step(0.996, h3(q)) * smoothstep(0.12, 0.4, y);
        c += vec3(0.9, 0.92, 1.0) * s * uStars;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(190, 16, 10), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s); window.__sky = s;
  const disc = (inner, outer, glow) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(0.55, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); };
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#fffbe8', '#ffe9a0', 'rgba(255,220,140,.35)'), fog: false, depthWrite: false, transparent: true }));
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#f4f6ff', '#d8e0f0', 'rgba(180,200,255,.25)'), fog: false, depthWrite: false, transparent: true }));
  sunS.scale.set(34, 34, 1); moonS.scale.set(19, 19, 1); sunS.renderOrder = moonS.renderOrder = -9; s.add(sunS, moonS);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 32; const c = cc.getContext('2d'); c.fillStyle = '#fff';
  [[16, 22, 10], [28, 16, 12], [42, 18, 10], [52, 23, 7]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(8, 22, 50, 8);
  const ct = lowTex(cc, 64), clouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true })); const a = i / 7 * TAU + 0.3, r = 165;
    sp.position.set(Math.cos(a) * r, 48 + (i % 3) * 18, Math.sin(a) * r); sp.scale.set(60 + (i % 2) * 22, 28 + (i % 2) * 8, 1); sp.renderOrder = -9; s.add(sp); clouds.push(sp);
  }
  return { U, sunS, moonS, clouds };
})();
// ===== copied from Toad City Baltimore src/03b_landmarks_hd.js @ hark/integration 00058aa (HD builder HB, sign atlas SA, sText, World Trade Center builder) =====

// ---------------- HD landmarks (phase 3): procedural, ref-matched landmark models in the cel/ink style, with LOD ----------------
// Each HD landmark = one merged vertex-coloured toon mesh (one shared material, night window glow from an `emi` attribute) + one merged
// ink-outline hull (major forms only; windows and fine trim skip the hull so the lines stay clean). Near the camera the HD model shows;
// farther out the Phase-1 massing (captured per landmark by LMCAP in the city builder) shows instead. The swap is done per frame in
// scene.onBeforeRender from the camera position. Collision boxes stay the massing's.
const LM_MAT = (() => {
  const m = toonMat(); const pc = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    pc(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emi; varying vec3 vEmi;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvEmi = emi;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; uniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vEmi * uNight;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'psxLM'; return m;
})();
const LMR = (() => { let s = 1234567; return (seed) => { if (seed !== undefined) s = seed; s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
class HB { // HD builder: non-indexed triangles with position / normal / colour / emissive; `ol` parts also go to the outline hull
  constructor() { this.P = []; this.N = []; this.C = []; this.E = []; this.oP = []; this.oN = []; }
  add(g, col, o = {}) {
    if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, c = new THREE.Color(col), e = o.emi ? new THREE.Color(o.emi) : null, ol = o.ol !== false;
    for (let i = 0; i < p.count; i++) {
      this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.N.push(n.getX(i), n.getY(i), n.getZ(i)); this.C.push(c.r, c.g, c.b);
      if (e) this.E.push(e.r, e.g, e.b); else this.E.push(0, 0, 0);
      if (ol) { this.oP.push(p.getX(i), p.getY(i), p.getZ(i)); this.oN.push(n.getX(i), n.getY(i), n.getZ(i)); }
    }
    return this;
  }
  box(x0, y0, z0, x1, y1, z1, col, o) { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return this.add(g, col, o); }
  cyl(x, y0, z, rt, rb, h, seg, col, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.ry) g.rotateY(o.ry); g.translate(x, y0 + h / 2, z); return this.add(g, col, o); }
  geo(g, col, o) { return this.add(g, col, o); }
  // a wall frame: from (xa,za) to (xb,zb) with the outward normal on the right-hand side seen from outside (the faceOf convention)
  frame(xa, za, xb, zb) { const L = Math.hypot(xb - xa, zb - za), ux = (xb - xa) / L, uz = (zb - za) / L; return { xa, za, ux, uz, nx: -uz, nz: ux, L, ang: Math.atan2(-uz, ux) }; }
  // a box in wall space: u along the wall, y up, d outward from the wall plane
  fbox(F, u0, u1, y0, y1, d0, d1, col, o) {
    const g = new THREE.BoxGeometry(Math.max(0.01, u1 - u0), Math.max(0.01, y1 - y0), Math.max(0.01, d1 - d0)); g.translate((u0 + u1) / 2, (y0 + y1) / 2, (d0 + d1) / 2);
    return this.fgeo(F, g, col, o);
  }
  fgeo(F, g, col, o) { g.rotateY(F.ang); g.translate(F.xa, 0, F.za); return this.add(g, col, o); }
  // an arch head (half disc) in wall space centred at u, springing at y, radius r, from d0 to d1
  farch(F, u, y, r, d0, d1, col, o, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, d1 - d0, seg, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.translate(u, y, (d0 + d1) / 2);
    return this.fgeo(F, g, col, o);
  }
  // a window grid on a wall: bays of width bw from u0..u1, floors of height fh from y0..y1; each window = sill + dark pane (lit at night by chance)
  windows(F, u0, u1, y0, y1, o) {
    const bw = o.bw || 1.6, fh = o.fh || 3, ww = o.ww || bw * 0.55, wh = o.wh || fh * 0.55, nb = Math.max(1, Math.round((u1 - u0) / bw)), nf = Math.max(1, Math.round((y1 - y0) / fh));
    const bwr = (u1 - u0) / nb, fhr = (y1 - y0) / nf, lit = o.lit === undefined ? 0.5 : o.lit;
    for (let f = 0; f < nf; f++) for (let b = 0; b < nb; b++) {
      if (o.skip && o.skip(b, f, nb, nf)) continue;
      const uc = u0 + (b + 0.5) * bwr, yb = y0 + f * fhr + (fhr - wh) * (o.wy === undefined ? 0.45 : o.wy);
      const on = LMR() < lit, warm = LMR() < 0.8;
      const pc = o.pane ? (typeof o.pane === 'function' ? o.pane(b, f) : o.pane) : '#2b333d';
      this.fbox(F, uc - ww / 2, uc + ww / 2, yb, yb + wh, -0.05, o.pd || 0.02, pc, { ol: false, emi: on ? (warm ? '#ffcf7a' : '#bfd8ff') : null });
      if (o.arch) this.farch(F, uc, yb + wh, ww / 2, -0.05, o.pd || 0.02, pc, { ol: false, emi: on ? (warm ? '#ffcf7a' : '#bfd8ff') : null }, 6);
      if (o.sill) this.fbox(F, uc - ww / 2 - 0.08, uc + ww / 2 + 0.08, yb - 0.12, yb, 0, 0.14, o.sill, { ol: false });
      if (o.head) this.fbox(F, uc - ww / 2 - 0.06, uc + ww / 2 + 0.06, yb + wh + (o.arch ? ww / 2 : 0), yb + wh + (o.arch ? ww / 2 : 0) + 0.14, 0, 0.1, o.head, { ol: false });
      if (o.mull) this.fbox(F, uc - 0.035, uc + 0.035, yb, yb + wh, 0, 0.05, o.mull, { ol: false });
      if (o.awn && LMR() < o.awn) this.fbox(F, uc - ww / 2, uc + ww / 2, yb + wh * 0.62, yb + wh, 0.02, 0.07, o.awnC || '#4f74a8', { ol: false });
    }
  }
  // vertical pilasters (proud brick piers) every `every` m along a wall
  pilasters(F, u0, u1, y0, y1, every, w, d, col, o = {}) { const n = Math.max(1, Math.round((u1 - u0) / every)); for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n; this.fbox(F, u - w / 2, u + w / 2, y0, y1, 0, d, col, o); } }
  band(F, u0, u1, y0, y1, d, col, o) { return this.fbox(F, u0, u1, y0, y1, 0, d, col, o); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('emi', new THREE.Float32BufferAttribute(this.E, 3)); g.computeBoundingSphere();
    const grp = new THREE.Group(), mesh = new THREE.Mesh(g, LM_MAT); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
    if (this.oP.length) {
      const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(this.oP, 3)); h.setAttribute('normal', new THREE.Float32BufferAttribute(this.oN, 3));
      addOdir(h); h.deleteAttribute('normal'); h.computeBoundingSphere();
      const hull = new THREE.Mesh(h, OUT_CITY); hull.visible = QUAL.hd; QUAL.outlines.push(hull); grp.add(hull); grp.userData.hull = hull;
    }
    grp.userData.tris = this.P.length / 9; return grp;
  }
}
// generic signs for the HD models reuse the city's decal atlas (one small decal mesh per landmark)
function hdSign(F, u, y, w, tr, hh = w / 4, d = 0.12) { const mb = new MB(), x0 = F.xa + F.ux * (u - w / 2) + F.nx * d, z0 = F.za + F.uz * (u - w / 2) + F.nz * d, x1 = F.xa + F.ux * (u + w / 2) + F.nx * d, z1 = F.za + F.uz * (u + w / 2) + F.nz * d; mb.wall(x0, z0, x1, z1, y, y + hh, tr, '#fff', [0.002, 0.002, 0.998, 0.998]); return mb; }

// extra colliders for HD parts that stand proud of the massing (the city's collider grid is already built, so add to it directly)
function lmColl(c) { COLL.push(c); const x0 = (c.r ? c.x - c.r : c.x0) - 1.5, x1 = (c.r ? c.x + c.r : c.x1) + 1.5, z0 = (c.r ? c.z - c.r : c.z0) - 1.5, z1 = (c.r ? c.z + c.r : c.z1) + 1.5;
  for (let i = Math.floor(x0 / 16); i <= Math.floor(x1 / 16); i++) for (let j = Math.floor(z0 / 16); j <= Math.floor(z1 / 16); j++) { const k = i + ',' + j; (COLLG.get(k) || COLLG.set(k, []).get(k)).push(c); } }

// ---------------- real signage (Brad's real-signage rule, 2026-10-11): every sign is drawn on canvas in code from the refs (no logo files).
// One canvas atlas per landmark (shelf-packed) -> one double-sided unlit mesh, so a landmark's signs cost one draw call; unlit = they read as lit at night.
class SA {
  constructor() { this.items = []; }
  // on a wall frame: centred at u, bottom at y, w x h metres, d out from the wall
  add(F, u, y, w, h, d, draw) { const x = F.xa + F.ux * u + F.nx * d, z = F.za + F.uz * u + F.nz * d; return this.at(x, y, z, F.ang, w, h, draw); }
  at(x, y, z, ry, w, h, draw) { this.items.push({ x, y, z, ry, w, h, draw }); return this; }
  // a free quad from four world points (bottom-left, bottom-right, top-right, top-left); w x h metres sets the texture density only
  quad(A, B, C, D, w, h, draw) { this.items.push({ q: [A, B, C, D], w, h, draw }); return this; }
  build() {
    const W = 1024, pm = (it) => Math.min(W / it.w, 300 / it.h, 160); let cx = 0, cy = 0, rowH = 0;
    for (const it of this.items) { const k = pm(it); it.pw = Math.ceil(it.w * k); it.ph = Math.ceil(it.h * k); if (cx + it.pw > W) { cx = 0; cy += rowH + 4; rowH = 0; } it.px = cx; it.py = cy; cx += it.pw + 4; rowH = Math.max(rowH, it.ph); }
    const Hc = Math.min(2048, 1 << Math.ceil(Math.log2(Math.max(64, cy + rowH)))), c = document.createElement('canvas'); c.width = W; c.height = Hc; const g = c.getContext('2d');
    for (const it of this.items) { g.save(); g.beginPath(); g.rect(it.px, it.py, it.pw, it.ph); g.clip(); g.translate(it.px, it.py); it.draw(g, it.pw, it.ph); g.restore(); }
    const P = [], U = [];
    for (const it of this.items) {
      const u0q = it.px / W, u1q = (it.px + it.pw) / W, v1q = 1 - it.py / Hc, v0q = 1 - (it.py + it.ph) / Hc;
      if (it.q) { const [A, B, C, D] = it.q; P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(u0q, v0q, u1q, v0q, u1q, v1q, u0q, v0q, u1q, v1q, u0q, v1q); continue; } // free quad (bl, br, tr, tl)
      const cs = Math.cos(it.ry), sn = Math.sin(it.ry), hw = it.w / 2, pt = (a, b) => [it.x + a * cs, it.y + b, it.z - a * sn];
      const u0 = it.px / W, u1 = (it.px + it.pw) / W, v1 = 1 - it.py / Hc, v0 = 1 - (it.py + it.ph) / Hc;
      const A = pt(-hw, 0), B = pt(hw, 0), C = pt(hw, it.h), D = pt(-hw, it.h);
      P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: lowTex(c, 512), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true }));
    m.renderOrder = 2; return m;
  }
}
const SCRIPT = '"Brush Script MT", "Segoe Script", "Snell Roundhand", "Apple Chancery", "URW Chancery L", "Z003", cursive';
const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif', SANS = '"Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif';
// text that fills a box: centred, shrunk to fit width, optional outline + glow
function sText(g, txt, x, y, maxW, px, font, fill, o = {}) {
  g.save(); g.font = `${o.weight || 'bold'} ${px}px ${font}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  if (o.slant) g.transform(1, 0, -o.slant, 1, o.slant * y, 0);
  const w = g.measureText(txt).width; if (w > maxW) { const k = maxW / w; g.translate(x, y); g.scale(k, 1); g.translate(-x, -y); }
  if (o.track) g.letterSpacing = o.track + 'px';
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = px * 0.25; }
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.sw || px * 0.12; g.strokeStyle = o.stroke; g.strokeText(txt, x, y); }
  g.fillStyle = fill; g.fillText(txt, x, y); g.restore();
}

// ======================= WORLD TRADE CENTER (refs/world-trade-center): regular pentagon, tan precast; solid corner piers, horizontal ribbon windows
// between tan spandrels on every floor, a narrow pier mid-face, a solid tan crown band, recessed glass lobby on a granite base ==============
lmHD('wtc', -12, -22.5, 14, (H, signs, SG) => {
  const cx = -12, cz = -22.5, r = 6.6, h = 62, rot = 0.3, TAN = '#cfba92', TAN2 = '#b8a27c', GL = '#3b5f66', Y0 = CURB;
  const V = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + rot; V.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  const pent = (rad, y0, hh, col, o) => H.cyl(cx, y0, cz, rad, rad, hh, 5, col, Object.assign({ ry: rot }, o));
  pent(r + 0.5, Y0, 0.6, '#8a8278'); // granite plinth
  pent(r - 0.7, Y0 + 0.6, 4.4, '#28323c'); // recessed glass lobby
  pent(r - 0.32, Y0 + 5, h - 9, GL, { ol: false }); // the glass core behind the ribbons
  const FL = 2.15, n = Math.floor((h - 10) / FL);
  for (let f = 0; f <= n; f++) pent(r, Y0 + 5 + f * FL, 0.95, f % 4 === 0 ? TAN2 : TAN, { ol: f === 0 }); // tan spandrel per floor
  pent(r, Y0 + h - 4.4, 4.4, TAN); // solid crown band (mechanical floors)
  pent(r - 0.6, Y0 + h, 1.6, TAN2); pent(r - 0.35, Y0 + h + 1.6, 0.35, '#e0d2b4');
  for (let i = 0; i < 5; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let F = H.frame(ax, az, bx, bz); if ((mx - cx) * F.nx + (mz - cz) * F.nz < 0) F = H.frame(bx, bz, ax, az); // outward normal
    // corner piers (solid tan, full height) and a narrow mid-face pier
    H.fbox(F, -0.2, 1.2, Y0 + 0.6, Y0 + h, -0.4, 0.18, TAN); H.fbox(F, F.L - 1.2, F.L + 0.2, Y0 + 0.6, Y0 + h, -0.4, 0.18, TAN);
    H.fbox(F, F.L / 2 - 0.22, F.L / 2 + 0.22, Y0 + 5, Y0 + h - 4.4, -0.3, 0.06, TAN2, { ol: false });
    // lobby columns
    for (let u = 1.8; u < F.L - 1.4; u += 1.5) H.fbox(F, u - 0.14, u + 0.14, Y0 + 0.6, Y0 + 5, -0.3, 0.3, '#9a9288', { ol: false });
    // ribbon glass: random lit segments at night + a few sky-reflection panes by day
    for (let f = 0; f < n; f++) { const y = Y0 + 5 + f * FL + 0.95; let u = 1.3;
      while (u < F.L - 1.3) { const w = 0.7 + LMR() * 1.6, u1 = Math.min(F.L - 1.3, u + w), on = LMR() < 0.42, sky = LMR() < 0.18;
        if (on || sky) H.fbox(F, u, u1, y + 0.02, y + FL - 0.97, -0.25, -0.2, sky ? '#7fa8bf' : GL, { ol: false, emi: on ? (LMR() < 0.75 ? '#ffd690' : '#c8dcff') : null }); u = u1 + 0.05; } }
  }
  // roof: mechanical box + antenna masts
  H.box(cx - 2, Y0 + h + 1.9, cz - 2, cx + 2, Y0 + h + 4.2, cz + 2, '#9a8e78'); H.cyl(cx + 1.2, Y0 + h + 4.2, cz, 0.08, 0.1, 6, 6, '#c8c8c0', { ol: false }); H.cyl(cx - 1.4, Y0 + h + 4.2, cz + 0.8, 0.06, 0.08, 3.5, 6, '#c8c8c0', { ol: false });
  // granite entrance wall with the (generic) name sign, facing the promenade
  { const F = H.frame(cx - 5, cz + r + 1.2, cx + 5, cz + r + 1.2); H.fbox(F, 0, 10, Y0, Y0 + 2.2, -0.6, 0, '#958b80'); // granite base wall (tower_3 ref)
    for (let u = 0.9; u < 10; u += 0.9) H.fbox(F, u - 0.012, u + 0.012, Y0, Y0 + 2.2, 0, 0.01, '#c8c0b4', { ol: false });
    SG.add(F, 5, Y0 + 1.15, 9.2, 0.62, 0.02, (g, w, h) => sText(g, 'THE WORLD TRADE CENTER \u00b7 BALTIMORE', w / 2, h / 2, w * 0.98, h * 0.82, SERIF, '#d6b25a', { weight: '500', stroke: '#6a5420', sw: h * 0.05 })); }
  // the flags of the world hanging in the glass lobby (tower_3 ref)
  for (let i = 0; i < 5; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5];
    for (let t = 0.2; t < 0.85; t += 0.13) { const x = lerp(ax, bx, t) * 0.82 + cx * 0.18, z = lerp(az, bz, t) * 0.82 + cz * 0.18, cl = ['#c8202a', '#1f3f9a', '#f2f2ee', '#1f8a3a', '#f0c020'][(i * 7 + Math.round(t * 20)) % 5];
      H.box(x - 0.25, Y0 + 2.2, z - 0.25, x + 0.25, Y0 + 4.4, z + 0.25, cl, { ol: false }); } }
});

// ===== copied from Toad City Baltimore src/03f_landmarks_hd_b3.js @ hark/integration 00058aa (B3 helpers + Fells Point Thames St rowhouse block with its real signs) =====

// ======================= HD landmarks batch 3 (landmarks pass, 2026-10-13): Fort McHenry, Federal Hill, Sagamore Pendry (Recreation Pier),
// Fells Point (Thames St rowhouses), Under Armour (Tide Point). Same approach as 03b / 03c: one merged toon mesh + one ink hull + one canvas-sign
// atlas per landmark (lmHD), the far LOD = the massing captured by LMCAP in 03_city.js. Ids, positions, footprints, colliders and boss rings are the
// massing's and are not touched here: nothing in this file adds a collider. All lettering is drawn on canvas in code (real wording, no logo files).
const B3 = {
  // a muzzle-loading cannon: barrel from the breech toward angle `a` (0 = +z, PI/2 = +x) on a wooden carriage with two wheels; y = deck height
  cannon(H, x, y, z, a, s = 1, col = '#1d1d20') {
    const dx = Math.sin(a), dz = Math.cos(a), px = Math.cos(a), pz = -Math.sin(a), L = 2.3 * s, yb = y + 0.62 * s;
    H.seg([x - dx * L * 0.42, yb, z - dz * L * 0.42], [x + dx * L * 0.58, yb + 0.12 * s, z + dz * L * 0.58], 0.2 * s, col, { r1: 0.13 * s, seg: 8, ol: true });
    H.add(new THREE.SphereGeometry(0.2 * s, 8, 4).translate(x - dx * L * 0.42, yb, z - dz * L * 0.42), col, { ol: false });
    H.seg([x - dx * 0.95 * s, y + 0.3 * s, z - dz * 0.95 * s], [x + dx * 0.55 * s, y + 0.42 * s, z + dz * 0.55 * s], 0.2 * s, '#5a3a22', { seg: 4 });
    for (const k of [-1, 1]) { const wx = x + px * 0.34 * s * k + dx * 0.25 * s, wz = z + pz * 0.34 * s * k + dz * 0.25 * s;
      H.seg([wx - px * 0.06 * s, y + 0.34 * s, wz - pz * 0.06 * s], [wx + px * 0.06 * s, y + 0.34 * s, wz + pz * 0.06 * s], 0.34 * s, '#3a2a1a', { seg: 10 }); }
  },
  tree(H, x, y, z, s = 1) {
    H.cyl(x, y, z, 0.13 * s, 0.2 * s, 2.6 * s, 6, '#5a4030', { ol: false });
    const g = new THREE.IcosahedronGeometry(1.5 * s, 0); g.translate(x, y + 3.5 * s, z); H.add(g, LMR() < 0.5 ? '#4f7f3a' : '#5d8a40');
    const g2 = new THREE.IcosahedronGeometry(1.05 * s, 0); g2.rotateY(0.7); g2.translate(x + 0.5 * s, y + 4.5 * s, z - 0.3 * s); H.add(g2, '#6a9a48', { ol: false });
  },
  // a black lantern lamppost (Fells Point / park style)
  lantern(H, x, y, z, h = 3.6) {
    H.cyl(x, y, z, 0.07, 0.11, h, 6, '#1a1c1e', { ol: false }); H.cyl(x, y, z, 0.16, 0.18, 0.5, 6, '#1a1c1e', { ol: false });
    H.cyl(x, y + h, z, 0.22, 0.13, 0.5, 6, '#2a2c2e', { ol: false, emi: '#ffd890' }); H.cyl(x, y + h + 0.5, z, 0.02, 0.26, 0.22, 6, '#1a1c1e', { ol: false });
  },
  // a waving flag from canvas strips hung off a pole top (px, ytop, pz) flying toward angle `a`; draw(g, W, H) paints the whole flag
  flag(SG, px, ytop, pz, a, W, Hf, draw, n = 5, amp = 0.35) {
    const dx = Math.sin(a), dz = Math.cos(a), nx = Math.cos(a), nz = -Math.sin(a);
    const P = (u) => { const w = Math.sin(u / W * 5.2) * amp * (u / W + 0.15); return [px + dx * u + nx * w, pz + dz * u + nz * w]; };
    for (let k = 0; k < n; k++) { const u0 = k * W / n, u1 = (k + 1) * W / n, [ax, az] = P(u0), [bx, bz] = P(u1), sag0 = u0 / W * 0.25, sag1 = u1 / W * 0.25;
      SG.quad([ax, ytop - Hf - sag0, az], [bx, ytop - Hf - sag1, bz], [bx, ytop - sag1, bz], [ax, ytop - sag0, az], W / n, Hf, (g, w, h) => { g.save(); g.translate(-k * w, 0); draw(g, w * n, h); g.restore(); }); }
  },
  star(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); },
  // the 1795 Star-Spangled Banner: 15 stripes, 15 stars (5 staggered rows of 3) on a canton over 8 stripes
  banner15(g, W, Hh) {
    for (let i = 0; i < 15; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#b8202c'; g.fillRect(0, i * Hh / 15, W, Hh / 15 + 1); }
    const cw = W * 0.38, ch = Hh * 8 / 15; g.fillStyle = '#23336e'; g.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) B3.star(g, cw * ((c + (r % 2 ? 0.75 : 0.35)) / 3.1) + cw * 0.04, ch * (r + 0.6) / 5.2, Math.min(cw, ch) * 0.075, '#f4f1ea');
  },
  // the modern 50-star US flag
  usFlag(g, W, Hh) {
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : '#b8202c'; g.fillRect(0, i * Hh / 13, W, Hh / 13 + 1); }
    const cw = W * 0.4, ch = Hh * 7 / 13; g.fillStyle = '#23336e'; g.fillRect(0, 0, cw, ch);
    for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) B3.star(g, cw * ((c + (r % 2 ? 1 : 0.5)) / 6), ch * (r + 0.5) / 9, ch * 0.045, '#f4f1ea');
  },
  // the Maryland flag (Calvert gold/black paly + Crossland red/white bottony cross quarters), simplified
  mdFlag(g, W, Hh) {
    const q = (x0, y0, w, h, calvert) => { g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      if (calvert) { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#111' : '#e8b020'; g.fillRect(x0 + i * w / 6, y0, w / 6 + 1, h); }
        g.beginPath(); g.moveTo(x0, y0 + h); g.lineTo(x0 + w, y0); g.lineTo(x0 + w, y0 + h); g.closePath(); g.save(); g.clip(); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e8b020' : '#111'; g.fillRect(x0 + i * w / 6, y0, w / 6 + 1, h); } g.restore(); }
      else { g.fillStyle = '#f4f1ea'; g.fillRect(x0, y0, w, h); g.fillStyle = '#c0202c'; g.fillRect(x0 + w / 2, y0, w / 2, h / 2); g.fillRect(x0, y0 + h / 2, w / 2, h / 2);
        g.fillStyle = '#c0202c'; g.fillRect(x0 + w * 0.44, y0 + h * 0.1, w * 0.12, h * 0.8); g.fillRect(x0 + w * 0.1, y0 + h * 0.44, w * 0.8, h * 0.12); }
      g.restore(); };
    q(0, 0, W / 2, Hh / 2, true); q(W / 2, 0, W / 2, Hh / 2, false); q(0, Hh / 2, W / 2, Hh / 2, false); q(W / 2, Hh / 2, W / 2, Hh / 2, true);
  },
  // a flat ribbon of quads over the ground following groundY (paths / ditches), polyline pts [[x,z],...], width w, lift above ground
  ribbon(H, pts, w, col, lift = 0.04, closed = false) {
    const P = [], N = closed ? pts.length : pts.length - 1, gy = (x, z) => CURB + hillH(x, z) + lift;
    for (let i = 0; i < N; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
      const a0 = [ax - nx, gy(ax - nx, az - nz), az - nz], a1 = [ax + nx, gy(ax + nx, az + nz), az + nz], b0 = [bx - nx, gy(bx - nx, bz - nz), bz - nz], b1 = [bx + nx, gy(bx + nx, bz + nz), bz + nz];
      P.push(...a0, ...b1, ...b0, ...a0, ...a1, ...b1); }
    return H.tris(P, col, { ol: false });
  },
};
// ======================= FELLS POINT - Thames St / Broadway (refs/fells-point: cobble_1, thames_1/2, broadway_1). The market block becomes a row of
// 18th-19th c. rowhouses on every face: red/orange brick and painted fronts (yellow, cream, green, slate), white trim and cornices, dormers and
// chimneys, shopfronts with green awnings on Thames St (south, the harbour side), wall-mounted lanterns; THE HORSE YOU CAME IN ON SALOON and the cream
// ADMIRAL FELL INN at the Broadway corner, BROADWAY MARKET on the west face. All facades sit on the massing box; nothing stands proud of the collider.
lmHD('fells', 150, -58, 18, (H, signs, SG) => {
  const Y0 = CURB, x0 = 141, x1 = 159, z0 = -64, z1 = -52;
  const COLS = ['#a8503a', '#b8603e', '#9a4632', '#e2c464', '#ece2c8', '#5f7f5a', '#c06848', '#8a8c94', '#b85a40', '#d8b878'];
  H.box(x0 + 0.4, Y0, z0 + 0.4, x1 - 0.4, Y0 + 6.2, z1 - 0.4, '#7a4a3a', { ol: false }); // the core (hidden by the fronts)
  const faces = [['s', H.frame(x0, z1, x1, z1)], ['e', H.frame(x1, z1, x1, z0)], ['n', H.frame(x1, z0, x0, z0)], ['w', H.frame(x0, z0, x0, z1)]];
  LMR(9191); let ci = 0;
  for (const [k, F] of faces) {
    let u = 0; const L = F.L;
    while (u < L - 0.5) {
      let w = 3.4 + LMR() * 1.6; if (L - u - w < 2.6) w = L - u; const u1 = Math.min(L, u + w);
      const corner = k === 's' && u === 0, inn = k === 'w' && u1 >= L - 0.01; // the Admiral Fell Inn wraps the south-west corner
      const floors = inn ? 4 : 3 + (LMR() < 0.35 ? 1 : 0) - (LMR() < 0.15 ? 1 : 0), h = floors * 2.6 + 0.9, col = inn || corner ? '#ece2c8' : COLS[ci++ % COLS.length];
      H.fbox(F, u, u1, Y0, Y0 + h, -0.5, 0.0, col); // front
      H.fbox(F, u - 0.05, u1 + 0.05, Y0 + h - 0.55, Y0 + h, 0, 0.32, '#f2efe6'); // cornice
      for (let b = u + 0.4; b < u1 - 0.2; b += 0.55) H.fbox(F, b, b + 0.14, Y0 + h - 0.8, Y0 + h - 0.55, 0, 0.22, '#f2efe6', { ol: false }); // brackets
      // a pitched slate roof behind the cornice + a chimney and a dormer
      { const g = new THREE.BufferGeometry(), A = [u, Y0 + h, 0], B = [u1, Y0 + h, 0], C = [u1, Y0 + h + 1.6, -3.2], D = [u, Y0 + h + 1.6, -3.2];
        g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...D], 3)); g.computeVertexNormals(); H.fgeo(F, g, '#4a4a52', { ol: false }); }
      if (LMR() < 0.55) H.fbox(F, u + (u1 - u) * 0.3, u + (u1 - u) * 0.7, Y0 + h + 0.2, Y0 + h + 1.5, -1.6, -0.6, '#f2efe6', { ol: false });
      H.fbox(F, u1 - 0.9, u1 - 0.3, Y0 + h, Y0 + h + 2.4, -2.8, -2.2, '#8a3e2e');
      // windows (white frames, dark panes, shutters on the painted fronts)
      const shut = LMR() < 0.5 ? (LMR() < 0.5 ? '#1f3a2a' : '#1c2430') : null;
      H.windows(F, u + 0.2, u1 - 0.2, Y0 + 3.0, Y0 + h - 0.8, { bw: 1.3, fh: 2.6, ww: 0.7, wh: 1.5, pane: '#22262c', head: '#f2efe6', sill: '#f2efe6', mull: '#f2efe6', lit: 0.4 });
      if (shut) { const nb = Math.max(1, Math.round((u1 - u - 0.4) / 1.3)), bwr = (u1 - u - 0.4) / nb; for (let f = 0; f < floors - 1; f++) for (let b = 0; b < nb; b++) { const uc = u + 0.2 + (b + 0.5) * bwr, yb = Y0 + 3.0 + f * 2.6 + 0.45;
        for (const s of [-1, 1]) H.fbox(F, uc + s * 0.35 - (s < 0 ? 0.3 : 0), uc + s * 0.35 + (s > 0 ? 0.3 : 0), yb, yb + 1.5, 0, 0.05, shut, { ol: false }); } }
      // ground floor: shopfront (south) or door + window (other faces)
      if (k === 's') { H.fbox(F, u + 0.3, u1 - 0.3, Y0 + 0.2, Y0 + 2.5, -0.05, 0.02, '#1e2226', { ol: false, emi: LMR() < 0.7 ? '#ffcf7a' : null });
        H.fbox(F, u + 0.15, u1 - 0.15, Y0 + 2.5, Y0 + 2.75, 0, 0.12, '#2a3a2a', { ol: false });
        if (LMR() < 0.75) { const g = new THREE.BoxGeometry(u1 - u - 0.3, 0.06, 1.1); g.rotateX(0.38); g.translate((u + u1) / 2, Y0 + 2.6, 0.5); H.fgeo(F, g, '#2f5a36', { ol: false }); } }
      else { H.fbox(F, u + 0.4, u + 1.3, Y0 + 0.15, Y0 + 2.4, -0.05, 0.02, '#3a2a22', { ol: false }); H.farch(F, u + 0.85, Y0 + 2.4, 0.45, -0.05, 0.02, '#f2efe6', { ol: false }, 6);
        H.fbox(F, u + 0.3, u + 1.4, Y0, Y0 + 0.3, 0, 0.5, '#e8e4dc', { ol: false }); // marble stoop
        H.windows(F, u + 1.6, u1 - 0.2, Y0 + 0.5, Y0 + 2.6, { bw: 1.3, fh: 2.1, ww: 0.7, wh: 1.4, pane: '#22262c', head: '#f2efe6', lit: 0.3 }); }
      // wall lanterns between fronts on Thames St
      if (k === 's' || k === 'w') { const x = F.xa + F.ux * u1 + F.nx * 0.25, z = F.za + F.uz * u1 + F.nz * 0.25; H.box(x - 0.12, Y0 + 2.9, z - 0.12, x + 0.12, Y0 + 3.4, z + 0.12, '#2a2c2e', { ol: false, emi: '#ffd890' }); }
      u = u1;
    }
  }
  // signs (real Fells Point wording, drawn): the saloon, the inn, Broadway Market
  const S = faces[0][1], W = faces[3][1];
  SG.add(S, 8.2, Y0 + 2.8, 6.4, 0.7, 0.2, (g, w, h) => { g.fillStyle = '#1e2a1e'; g.fillRect(0, 0, w, h); sText(g, 'THE HORSE YOU CAME IN ON SALOON', w / 2, h / 2, w * 0.94, h * 0.62, SERIF, '#e8c870', { weight: 'bold' }); });
  SG.add(S, 13.4, Y0 + 3.2, 2.2, 1.4, 0.2, (g, w, h) => { g.fillStyle = '#1e2a1e'; g.fillRect(0, 0, w, h); sText(g, 'EST.', w / 2, h * 0.3, w * 0.8, h * 0.24, SERIF, '#e8c870'); sText(g, '1775', w / 2, h * 0.66, w * 0.8, h * 0.4, SERIF, '#e8c870'); });
  SG.add(S, 2.3, Y0 + 7.0, 4.0, 0.75, 0.15, (g, w, h) => sText(g, 'ADMIRAL FELL INN', w / 2, h / 2, w * 0.96, h * 0.8, SERIF, '#2a3a5a', { weight: 'bold' }));
  SG.add(W, W.L - 2.4, Y0 + 7.0, 4.0, 0.75, 0.15, (g, w, h) => sText(g, 'ADMIRAL FELL INN', w / 2, h / 2, w * 0.96, h * 0.8, SERIF, '#2a3a5a', { weight: 'bold' }));
  SG.add(W, 4.6, Y0 + 2.75, 6.8, 0.9, 0.2, (g, w, h) => { g.fillStyle = '#6a2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    sText(g, 'BROADWAY MARKET', w / 2, h / 2, w * 0.9, h * 0.6, SERIF, '#f2e8cc', { weight: 'bold' }); });
  SG.add(S, S.L - 3.0, Y0 + 2.8, 4.4, 0.7, 0.2, (g, w, h) => { g.fillStyle = '#2f5a36'; g.fillRect(0, 0, w, h); sText(g, 'FELLS POINT', w / 2, h / 2, w * 0.9, h * 0.62, SERIF, '#f2efe6', { weight: 'bold', track: h * 0.06 }); });
});

// ===== copied from Toad City Baltimore src/04_actors.js @ hark/integration 00058aa (Harold + Mavis + thug rigs, poses) =====

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
// floral print for MAVIS's dress (64 px, nearest)
const FLORAL = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#5f73b0'; g.fillRect(0, 0, 64, 64);
  const fl = (x, y, col, r) => { g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, TAU); g.fill(); } g.fillStyle = '#f0d050'; g.beginPath(); g.arc(x, y, r * 0.6, 0, TAU); g.fill(); };
  g.fillStyle = '#4f8a4a'; for (const [x, y] of [[20, 10], [50, 40], [8, 44], [40, 6], [30, 56]]) g.fillRect(x, y, 6, 3);
  fl(12, 14, '#f08ab0', 5); fl(44, 22, '#fff0f4', 4); fl(26, 40, '#f0a0c8', 5); fl(54, 54, '#ffffff', 4); fl(6, 56, '#e86a8a', 4); fl(36, 60, '#f08ab0', 3);
  const t = lowTex(c, 64); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
})();
// warty toad skin (multiplied by the skin colour) and MAVIS's curly grey afro
const WARTS = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#f4f4ea'; g.fillRect(0, 0, 256, 256);
  let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) { const x = r() * 256, y = r() * 256, s = 1.5 + r() * r() * 9; g.fillStyle = 'rgba(70,80,20,.32)'; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); if (s > 4) { g.fillStyle = 'rgba(255,255,230,.35)'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.3, s * 0.4, 0, TAU); g.fill(); } }
  const t = lowTex(c, 64); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
})();
const CURLS = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#c8c6c2'; g.fillRect(0, 0, 256, 256);
  let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) { const x = r() * 256, y = r() * 256, s = 3 + r() * 6; g.strokeStyle = r() < 0.5 ? 'rgba(90,88,84,.55)' : 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, s, r() * TAU, r() * TAU + 4); g.stroke(); }
  const t = lowTex(c, 64); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
})();
// the heroes: an elderly (perfectly ordinary) toad couple. o.wife: MAVIS (grey afro, floral dress, pearls, handbag); else HAROLD (bald, glasses, cardigan, slacks, cane)
function buildHero(o = {}) {
  const mat = toonMat(); const J = skeleton(HERO_D, mat), d = HERO_D, W = !!o.wife;
  const SK = W ? '#7f8f3e' : '#6f7f34', SK2 = W ? '#c4c08a' : '#b8b47a', WART = W ? '#66752c' : '#58682a';
  const TOP = W ? null : '#7a5232', LEGC = W ? SK : '#5a5248', SHOE = W ? '#6a2a3a' : '#3a2a1e';
  const dress = W ? (() => { const m = toonMat({ map: FLORAL }); m.userData.flash = mat.userData.flash; m.userData.flashC = mat.userData.flashC; m.customProgramCacheKey = () => 'psxF'; return m; })() : null;
  const DR = (o2 = {}) => (W ? Object.assign({ mat: dress }, o2) : o2);
  const sub = (map, key) => { const m = toonMat({ map }); m.userData.flash = mat.userData.flash; m.userData.flashC = mat.userData.flashC; m.customProgramCacheKey = () => key; return m; };
  const skinM = sub(WARTS, 'psxS'), S_ = { mat: skinM };
  const TC = W ? '#ffffff' : TOP; // torso colour (white under the floral map)
  // hips / skirt
  if (W) { part(J.hips, G.cyl(0.25, 0.42, 0.56, 8), TC, 0, -0.2, 0, DR()); part(J.hips, G.sph(0.26, 0.16, 0.22), TC, 0, 0.04, 0, DR()); }
  else { part(J.hips, G.sph(0.27, 0.18, 0.23), LEGC, 0, 0.02, 0); part(J.hips, G.cyl(0.285, 0.285, 0.06, 8), '#2a2018', 0, 0.12, 0); }
  // torso: round, a little hunched forward
  part(J.torso, G.sph(0.34, 0.36, 0.3), TC, 0, 0.28, -0.02, DR());
  if (!W) { // open cardigan over a cream shirt, buttons, pockets
    part(J.torso, G.sph(0.17, 0.27, 0.1), '#d8cfb4', 0, 0.28, 0.22);
    for (const s of [-1, 1]) { part(J.torso, G.box(0.06, 0.5, 0.05), '#5e3e24', s * 0.13, 0.27, 0.27, { rot: [0.12, 0, 0] }); part(J.torso, G.box(0.11, 0.09, 0.04), '#5e3e24', s * 0.2, 0.1, 0.27); }
    for (const y of [0.42, 0.3, 0.18]) part(J.torso, G.box(0.03, 0.03, 0.03), '#e8d8a8', -0.13, y, 0.3);
    part(J.torso, G.box(0.12, 0.05, 0.05), '#5e3e24', 0, 0.58, 0.16); // collar
  } else { // pearls round the neck, a lace collar
    part(J.torso, G.cyl(0.17, 0.2, 0.06, 8), '#efe8dc', 0, 0.58, 0.02);
    for (let k = -5; k <= 5; k++) { const a = k * 0.27; part(J.torso, G.sph(0.034, 0.034, 0.034, 5, 4), '#f6f2ea', Math.sin(a) * 0.21, 0.56 - (1 - Math.cos(a)) * 0.05 - Math.abs(k) * 0.004 - 0.03 * Math.cos(a), 0.0 + Math.cos(a) * 0.21); }
  }
  // warts on the back
  for (const [x, y, z] of [[0.14, 0.4, -0.27], [-0.1, 0.26, -0.29], [0.04, 0.14, -0.28]]) if (!W) part(J.torso, G.sph(0.035, 0.03, 0.03, 5, 4), '#5e3e24', x, y, z);
  // head: wide flat toad head, pale throat, wide mouth, bulging eyes on top
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.33, 0.21, 0.3, 9, 6), SK, 0, 0.16, 0.03, S_);
  part(head, G.sph(0.29, 0.12, 0.25), SK2, 0, 0.07, 0.07);
  part(head, G.box(0.44, 0.024, 0.04), W ? '#9a3050' : '#2a1a14', 0, 0.115, 0.31); // the wide mouth
  for (const s of [-1, 1]) part(head, G.box(0.06, 0.024, 0.04), W ? '#9a3050' : '#2a1a14', s * 0.235, 0.1, 0.27, { rot: [0, s * 0.5, s * -0.35] });
  for (const s of [-1, 1]) {
    part(head, G.sph(0.105, 0.1, 0.1), SK, s * 0.14, 0.3, 0.13, S_); // eye bulge
    part(head, G.sph(0.075, 0.07, 0.05), '#e8d888', s * 0.14, 0.32, 0.205); // gold toad eye
    part(head, G.box(0.075, 0.026, 0.02), '#121010', s * 0.14, 0.32, 0.252); // horizontal pupil
    part(head, G.box(0.11, 0.025, 0.03), SK, s * 0.14, 0.375, 0.2, { rot: [0.5, 0, 0] }); // heavy lid
    if (!W) { part(head, G.tor(0.085, 0.013), '#1a1410', s * 0.14, 0.32, 0.27); part(head, G.box(0.015, 0.015, 0.26), '#1a1410', s * 0.235, 0.33, 0.14); }
    else part(head, G.box(0.1, 0.02, 0.02), '#121010', s * 0.15, 0.395, 0.23, { rot: [0, 0, s * -0.3] }); // lashes
    part(head, G.sph(0.03, 0.02, 0.02, 5, 4), WART, s * 0.24, 0.2, 0.16); part(head, G.sph(0.025, 0.02, 0.02, 5, 4), WART, s * 0.07, 0.27, 0.24);
  }
  if (!W) { part(head, G.box(0.1, 0.015, 0.015), '#1a1410', 0, 0.33, 0.28); part(head, G.sph(0.03, 0.02, 0.02, 5, 4), WART, 0.05, 0.36, 0.0); part(head, G.sph(0.025, 0.02, 0.02, 5, 4), WART, -0.12, 0.33, -0.12); }
  else { // the wide grey afro (sits back so the eyes peek out in front)
    part(head, G.sph(0.46, 0.4, 0.4, 10, 8), '#ffffff', 0, 0.5, -0.2, { mat: sub(CURLS, 'psxC') }); // one big round curly cloud
  }
  J.tails = [];
  // arms: cardigan sleeves (HAROLD) / short floral sleeves (MAVIS); webbed toad hands
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.12, 0.12, 0.12), TC, 0, 0, 0, DR());
    part(J['sh' + k], G.cap(0.09, d.upper - 0.08), W ? TC : TOP, 0, -d.upper / 2, 0, DR());
    part(J['el' + k], G.cap(0.08, d.fore - 0.08), W ? SK : TOP, 0, -d.fore / 2, 0, W ? S_ : {});
    if (!W) part(J['el' + k], G.cyl(0.09, 0.09, 0.06, 7), '#5e3e24', 0, -d.fore + 0.05, 0);
    else if (k === 'L') part(J['el' + k], G.cyl(0.085, 0.085, 0.04, 7), '#c8a040', 0, -d.fore + 0.06, 0); // a gold bangle
    part(J['ha' + k], G.sph(0.1, 0.055, 0.12), SK, 0, -0.04, 0.02, S_);
    const sw = J['sw' + k] = grp(J['ha' + k], 0, -0.05, 0); sw.userData.mat = mat;
    if (k !== 'R') continue;
    if (!W) { // the wooden walking cane: crook in the fist, shaft along the "blade" axis
      part(sw, G.cyl(0.024, 0.026, 0.66, 6), '#7a4a22', 0, 0.3, 0);
      part(sw, G.tor(0.07, 0.022, Math.PI), '#6a3e1c', 0.07, -0.04, 0, { rot: [0, 0, Math.PI] });
      part(sw, G.cyl(0.032, 0.032, 0.06, 6), '#1a1a1a', 0, 0.63, 0);
    } else { // the handbag: short strap, a stiff boxy bag with a gold clasp
      part(sw, G.box(0.03, 0.3, 0.02), '#3a1a1a', 0, 0.14, 0);
      part(sw, G.box(0.32, 0.25, 0.13), '#6a1f3a', 0, 0.4, 0);
      part(sw, G.box(0.33, 0.04, 0.14), '#4a1428', 0, 0.52, 0);
      part(sw, G.box(0.06, 0.05, 0.03), '#c8a040', 0, 0.5, 0.08);
    }
  }
  // legs: slacks + brown shoes (HAROLD) / bare toad legs under the skirt + burgundy shoes (MAVIS); big flat feet
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.11, d.thigh - 0.1), LEGC, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.1, d.shin - 0.1), LEGC, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.13, 0.07, 0.19), SHOE, 0, -0.03, 0.07);
    if (!W) part(J['kn' + k], G.cyl(0.105, 0.105, 0.05, 7), '#4a4238', 0, -d.shin + 0.06, 0);
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
    p.shR = [-0.25, 0.0, -0.3]; p.elR = [-0.5, 0, 0]; p.haR = [0, 0, 0]; p.swR = [Math.PI - 0.25, 0, 0];
    return p;
  },
  run(t, sp) {
    const p = blank(), ph = t * (7 + sp * 0.9); runLegs(p, ph, clamp(sp / 6, 0.4, 1));
    p.torso = [0.42, Math.sin(ph) * 0.15, 0]; p.neck = [-0.32, -Math.sin(ph) * 0.12, 0];
    p.shL = [1.0, 0, 0.35]; p.elL = [-0.35, 0, 0]; p.swL = [Math.PI / 2 + 1.1, 0, 0.2];
    p.shR = [0.6, 0, -0.35]; p.elR = [-0.5, 0, 0]; p.swR = [Math.PI - 0.6, 0, 0];
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
  // dizzy (QTE window): seeing stars; t = seconds in state. Loose wobbling stagger, arms dangling, head lolling.
  dizzy(t, J) {
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
// ===== copied from Toad City Baltimore src/04b_rig_merge.js @ hark/integration 00058aa (rig merge: each rig -> a few skinned meshes) =====

// ---------------- rig merge (performance): every character part becomes one vertex range of a rigidly-skinned mesh ----------------
// A rig was ~40-90 little meshes, each with its own ink-outline hull (2 draw calls + a shadow call per part). After the rig is built,
// mergeRig() bakes each part into its joint's space, tags its vertices with that joint (skinIndex, weight 1) and merges everything
// per material into one SkinnedMesh whose "bones" are the rig's existing joint groups (poses keep animating the groups as before).
// The hulls merge the same way into one skinned outline mesh. Result: ~2-4 draw calls per character, same look.
const OUT_SKIN = new Map(); // skinned twin of each outline material (same uniforms)
function skinnedOutline(src) {
  let m = OUT_SKIN.get(src); if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: src.uniforms, // shared: width, colour and fog follow the original
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec3 p = position; vec3 od = odir;
        #ifdef USE_SKINNING
          mat4 bm = getBoneMatrix(skinIndex.x);
          p = (bindMatrixInverse * (bm * (bindMatrix * vec4(position, 1.0)))).xyz;
          od = mat3(bindMatrixInverse) * (mat3(bm) * (mat3(bindMatrix) * odir));
        #endif
        vec4 wp = modelMatrix * vec4(p, 1.0); vec3 wd = mat3(modelMatrix) * od;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: src.fragmentShader,
    side: THREE.BackSide,
  });
  OUT_SKIN.set(src, m); return m;
}
const _I4 = new THREE.Matrix4(), _N3 = new THREE.Matrix3(), _O3 = new THREE.Matrix3(), _v3 = new THREE.Vector3();
function mergeRig(J) {
  const root = J.root, bones = [], bIdx = new Map(), byMat = new Map(), byOl = new Map(), kill = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || (o.parent && o.parent.isMesh)) return; // part meshes only (hulls are children of parts)
    const b = o.parent; if (!bIdx.has(b)) { bIdx.set(b, bones.length); bones.push(b); }
    const hull = o.children.find((c) => c.isMesh && c.material && c.material.isShaderMaterial);
    const e = { g: o.geometry, M: o.matrix.clone(), bi: bIdx.get(b) };
    if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(e);
    if (hull) { if (!byOl.has(hull.material)) byOl.set(hull.material, []); byOl.get(hull.material).push(e); }
    kill.push(o, ...(hull ? [hull] : []));
  });
  if (!bones.length) return J;
  for (const o of kill) { if (o.parent) o.parent.remove(o); const k = QUAL.outlines.indexOf(o); if (k >= 0) QUAL.outlines.splice(k, 1); }
  const skel = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const build = (list, ol) => {
    let nv = 0, ni = 0; for (const e of list) { nv += e.g.attributes.position.count; ni += e.g.index ? e.g.index.count : e.g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = ol ? null : new Float32Array(nv * 3), UV = ol ? null : new Float32Array(nv * 2), C = ol ? null : new Float32Array(nv * 3),
      OD = ol ? new Float32Array(nv * 3) : null, SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), IX = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v0 = 0, i0 = 0;
    for (const e of list) {
      const g = e.g, A = g.attributes, n = A.position.count; _N3.getNormalMatrix(e.M); _O3.setFromMatrix4(e.M);
      for (let i = 0; i < n; i++) {
        const k = v0 + i;
        _v3.fromBufferAttribute(A.position, i).applyMatrix4(e.M); P[k * 3] = _v3.x; P[k * 3 + 1] = _v3.y; P[k * 3 + 2] = _v3.z;
        if (ol) { _v3.fromBufferAttribute(A.odir, i).applyMatrix3(_O3); OD[k * 3] = _v3.x; OD[k * 3 + 1] = _v3.y; OD[k * 3 + 2] = _v3.z; }
        else {
          _v3.fromBufferAttribute(A.normal, i).applyMatrix3(_N3).normalize(); N[k * 3] = _v3.x; N[k * 3 + 1] = _v3.y; N[k * 3 + 2] = _v3.z;
          if (A.uv) { UV[k * 2] = A.uv.getX(i); UV[k * 2 + 1] = A.uv.getY(i); }
          if (A.color) { C[k * 3] = A.color.getX(i); C[k * 3 + 1] = A.color.getY(i); C[k * 3 + 2] = A.color.getZ(i); } else C[k * 3] = C[k * 3 + 1] = C[k * 3 + 2] = 1;
        }
        SI[k * 4] = e.bi; SW[k * 4] = 1;
      }
      if (g.index) for (let j = 0; j < g.index.count; j++) IX[i0 + j] = g.index.getX(j) + v0; else for (let j = 0; j < n; j++) IX[i0 + j] = j + v0;
      v0 += n; i0 += g.index ? g.index.count : n;
    }
    const G2 = new THREE.BufferGeometry();
    G2.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (ol) G2.setAttribute('odir', new THREE.BufferAttribute(OD, 3));
    else { G2.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G2.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); G2.setAttribute('color', new THREE.BufferAttribute(C, 3)); }
    G2.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); G2.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    G2.setIndex(new THREE.BufferAttribute(IX, 1));
    return G2;
  };
  const add = (geo, mat, ol) => {
    const m = new THREE.SkinnedMesh(geo, mat); m.bind(skel, _I4);
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.6); // 2.6 covers a ~2 m rig lying flat in 'down' (reaches ~2.48 m from centre) // rig-space bounds (culling without per-frame CPU skinning)
    m.castShadow = !ol; m.receiveShadow = false;
    if (ol) { m.visible = QUAL.hd; QUAL.outlines.push(m); }
    root.add(m); return m;
  };
  J.merged = [];
  for (const [mat, list] of byMat) J.merged.push(add(build(list, false), mat, false));
  for (const [om, list] of byOl) J.merged.push(add(build(list, true), skinnedOutline(om), true));
  const seen = new Set(); for (const o of kill) if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
  return J;
}
if (!Q.has('nomerge')) {
  const _bh = buildHero, _bt = buildThug;
  buildHero = (o) => mergeRig(_bh(o));
  buildThug = (l) => mergeRig(_bt(l));
}
// ===== copied from Toad City Baltimore src/05_fx.js @ hark/integration 00058aa (comic FX sprites + WebAudio sfx) =====

// ---------------- comic FX: hit stars, onomatopoeia, dust puffs, slash crescents, lock ring ----------------
function canvasTex(w, h, draw, max = 128) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return lowTex(c, max); } // drawn big, shrunk to 32-bit-era sizes
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
  words: ['POW!', 'WHAM!', 'WHACK!', 'KRAK!', 'BAM!', 'THWACK!', 'BONK!'].map((w, i) => canvasTex(512, 192, (c) => {
    const fills = ['#ffd23c', '#ff5fa2', '#7fe8ff', '#7dff6b', '#ff8a3d', '#ffd23c', '#c9a6ff'];
    // burst behind
    c.fillStyle = INK; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 62 : 92, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let k = 0; k < 28; k++) { const r = k % 2 ? 54 : 82, a = k / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    halftone(c, 60, 20, 392, 152, 'rgba(255,95,162,.35)', 12, 4, 1);
    comicText(c, w, 256, 100, w.length > 5 ? 84 : 100, fills[i], null, { sx: 1 });
  })),
};
// dizzy halo: a ring of little stars (QTE thugs)
FXT.dizzy = canvasTex(256, 128, (c) => {
  c.strokeStyle = 'rgba(20,16,31,.8)'; c.lineWidth = 6; c.beginPath(); c.ellipse(128, 64, 104, 34, 0, 0, TAU); c.stroke();
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + 0.3, x = 128 + Math.cos(a) * 104, y = 64 + Math.sin(a) * 34, R = 22, r = 9;
    c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r : R, b = i / 10 * TAU - Math.PI / 2; c.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); } c.closePath();
    c.fillStyle = '#ffd23c'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); }
});
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
  const N = 10, P = [], C = [], I = [];
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
{ const a = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 12, 1), new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, opacity: 0.9 }));
  const b = new THREE.Mesh(new THREE.RingGeometry(0.67, 0.8, 10, 1, 0, TAU * 0.8), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, depthWrite: false }));
  for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; lockRing.add(m); } b.position.y = 0.005; lockRing.userData.b = b; }
lockRing.visible = false; scene.add(lockRing);

// ---------------- tiny WebAudio sfx (created on first gesture) ----------------
let AC = null, NOISE = null, SFXBUS = null; // SFXBUS: master sfx gain (the radio ducks it while music plays)
function audioInit() {
  if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); const n = AC.sampleRate * 0.4, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; NOISE = b; SFXBUS = AC.createGain(); SFXBUS.connect(AC.destination); } catch (e) { AC = null; }
}
function sfx(kind) {
  if (!AC || AC.state !== 'running') return; const t = AC.currentTime;
  try {
    const g = AC.createGain(); g.connect(SFXBUS || AC.destination);
    if (kind === 'swing') { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.12); f.Q.value = 1.4; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.start(t); s.stop(t + 0.18); }
    else if (kind === 'hit' || kind === 'heavy') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(kind === 'heavy' ? 180 : 260, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12); o.connect(g);
      const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; s.connect(f); f.connect(g);
      g.gain.setValueAtTime(kind === 'heavy' ? 0.26 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.start(t); o.stop(t + 0.16); s.start(t); s.stop(t + 0.12); }
    else if (kind === 'hurt') { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); o.connect(g); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.start(t); o.stop(t + 0.24); }
    else if (kind === 'jump') { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12); o.connect(g); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.start(t); o.stop(t + 0.15); }
    else if (kind === 'ko') { const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(520, t); o.frequency.setValueAtTime(780, t + 0.08); o.frequency.setValueAtTime(1040, t + 0.16); o.connect(g); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.start(t); o.stop(t + 0.32); }
  } catch (e) { /* audio is optional */ }
}

// ======================= TOAD CITY: DEAD STREETS (Brad via Hark, 2026-10-13: same exact Baltimore assets + code as Toad City Baltimore) =======================
// An on-foot twin-stick zombie horde run through Toad City's Inner Harbor: Harold (cane swapped for a pistol) and Mavis (purse) fight from
// W Pratt St past Light St and the World Trade Center to the water taxi at Broadway Pier, Fells Point.
// Everything above this file is copied verbatim from Toad City Baltimore (renderer, toon/cel material, ink hulls, city atlas + real-name signs,
// building()/lamp()/car()/hydrant()/bin()/tree() kit, HD builder HB + sign atlas, World Trade Center + Fells Point landmark builders,
// Harold / Mavis / thug rigs + poses, comic FX + sfx). These three files add the game: map + grid, the instanced horde, weapons, barricades,
// specials, the boss, HUD, input, procedural audio, and a test bot.
// Test params: ?bot=1 (autopilot) ?bot=lose (stands still) ?god=1 (no damage, test only) ?stage=N (start at checkpoint N) ?horde=N (perf: N zombies)

// lmHD(): Toad City's landmark registry, redefined to only store the builders (the copied WTC / Fells Point code calls it)
function lmHD(id, cx, cz, r, build) { (lmHD.defs || (lmHD.defs = {}))[id] = { id, cx, cz, r, build }; }
function lmMake(id) { // build a registered landmark (one toon mesh + ink hull + its canvas sign atlas), as 03b's lmHD did for the near LOD
  const D = lmHD.defs[id]; LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); D.build(hb, signs, sa); const g = hb.build();
  for (const s of signs) g.add(s.build(DECAL_MAT)); if (sa.items.length) g.add(sa.build()); return g;
}
function placeLM(g, cx, cz, zMax) { // move a landmark so its footprint centre sits at cx (and cz, or its south edge at zMax)
  g.updateMatrixWorld(true); let b = new THREE.Box3().setFromObject(g);
  g.position.x += cx - (b.min.x + b.max.x) / 2; g.position.z += zMax !== undefined ? zMax - b.max.z : cz - (b.min.z + b.max.z) / 2;
  g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); return b;
}

const DZ = window.__dz = { fps: 0, frames: 0, log: [], ready: false };
const GOD = Q.has('god'), FAST = Q.has('fast'); let BOTQ = Q.get('bot'); DZ.setBot = (m) => { BOTQ = m; };

// ---------------- the map: x runs east along Pratt St, z runs south toward the harbor (the camera looks north) ----------------
const GX0 = -24, GZ0 = -44, GWD = 330, GHT = 116; // grid: 1 m cells, x -24..306, z -44..72
const GN = GWD * GHT;
const GRID = new Uint8Array(GN); // 0 free, 1 wall, 2 water, 3 gate, 4 barricade
const BAR_AT = new Int16Array(GN).fill(-1);
const gi = (x, z) => { const i = Math.floor(x - GX0), j = Math.floor(z - GZ0); return i < 0 || j < 0 || i >= GWD || j >= GHT ? -1 : j * GWD + i; };
const cellX = (k) => (k % GWD) + GX0 + 0.5, cellZ = (k) => Math.floor(k / GWD) + GZ0 + 0.5;
function setRect(x0, z0, x1, z1, v) { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) { const k = gi(x + 0.5, z + 0.5); if (k >= 0) GRID[k] = v; } }
const solidAt = (x, z) => { const k = gi(x, z); return k < 0 || GRID[k] !== 0; };
const wallAt = (x, z) => { const k = gi(x, z); return k < 0 || GRID[k] === 1; };

const MAPX1 = 300, QUAY = 26, PLAZA_S = 40;
const XS = { eutaw: [26, 36], light: [90, 102], pres: [200, 210] };
const ALLEYS = [[60, 64], [140, 144], [236, 240]];
const PIER = { x0: 262, x1: 280, z0: QUAY, z1: 44 };
const TAXI_DOCK = { x: 271, z: 47.6 };
const GATES = [{ x: 114, z0: -12, z1: QUAY }, { x: 224, z0: -12, z1: QUAY }];
// barricade slots per stage (axis-aligned, one cell thick)
const SLOTS = [
  // hold 1: Pratt & Light (Light St north + Pratt west)
  { st: 1, x0: 90, x1: 96, z0: -14, z1: -13 }, { st: 1, x0: 96, x1: 102, z0: -14, z1: -13 },
  { st: 1, x0: 80, x1: 81, z0: -12, z1: -4 }, { st: 1, x0: 80, x1: 81, z0: -4, z1: 4 }, { st: 1, x0: 80, x1: 81, z0: 4, z1: 12 },
  // hold 2: President St (north) + Pratt / promenade west
  { st: 3, x0: 200, x1: 205, z0: -14, z1: -13 }, { st: 3, x0: 205, x1: 210, z0: -14, z1: -13 },
  { st: 3, x0: 186, x1: 187, z0: -12, z1: -4 }, { st: 3, x0: 186, x1: 187, z0: -4, z1: 4 }, { st: 3, x0: 186, x1: 187, z0: 4, z1: 12 },
  { st: 3, x0: 186, x1: 187, z0: 12, z1: 19 }, { st: 3, x0: 186, x1: 187, z0: 19, z1: 26 },
  // finale: the head of Broadway Pier
  { st: 5, x0: 262, x1: 268, z0: 26, z1: 27 }, { st: 5, x0: 268, x1: 274, z0: 26, z1: 27 }, { st: 5, x0: 274, x1: 280, z0: 26, z1: 27 },
];

function carveGrid() {
  GRID.fill(1);
  setRect(-22, -12, MAPX1, 12, 0); // Pratt St: road + both sidewalks
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres, ...ALLEYS]) setRect(a, -42, b, -12, 0); // cross streets + alleys north
  setRect(-22, 12, 90, PLAZA_S, 0); // the plaza south of W Pratt
  setRect(XS.light[0], 12, XS.light[1], QUAY, 0); // Light St down to the water
  setRect(102, 12, MAPX1, QUAY - 0.5, 0); // the promenade along the harbor
  setRect(90, QUAY, MAPX1 + 6, GZ0 + GHT, 2); // the harbor
  setRect(PIER.x0, PIER.z0 - 1, PIER.x1, PIER.z1, 0); // Broadway Pier
  // construction fences: keep the plaza out of the Pratt & Light hold
  setRect(70, 12, 90, 13, 1); setRect(89, 13, 90, PLAZA_S, 1);
}
carveGrid();

// ---------------- scene look: Toad City lights / fog / sky in a sick green dusk, getting darker stage by stage ----------------
applyQuality(true);
renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 }); sun.shadow.camera.updateProjectionMatrix();
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALZ = { // dusk -> night (Toad City's dusk palette pushed toward a sickly green)
  top: _ck(['#3a3d6e', '#141a34']), mid: _ck(['#a0687a', '#2e3a4e']), hor: _ck(['#e48a58', '#5a6a52']),
  fog: _ck(['#7d6a72', '#28323a']), hs: _ck(['#d8c8ff', '#8aa0d8']), hg: _ck(['#5a4a48', '#262a2e']), sun: _ck(['#ff9a58', '#9ab8ff']) };
const DIRZ = [new THREE.Vector3(-1, 0.42, -0.25).normalize(), new THREE.Vector3(0.6, 1.3, -0.5).normalize()];
function setLight(n) { // n: 0 dusk .. 1 night (moonlight)
  const c = (k, o) => o.copy(PALZ[k][0]).lerp(PALZ[k][1], n);
  c('top', SKY.U.top.value); c('mid', SKY.U.mid.value); c('hor', SKY.U.hor.value); SKY.U.uStars.value = n * 0.9;
  c('fog', scene.fog.color); FOGC.copy(scene.fog.color); renderer.setClearColor(scene.fog.color); scene.fog.near = 46; scene.fog.far = 150;
  OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = 46; OUT_U.fogF.value = 150;
  c('hs', hemi.color); c('hg', hemi.groundColor); hemi.intensity = lerp(1.55, 1.2, n); c('sun', sun.color); sun.intensity = lerp(1.9, 1.3, n);
  SUN_DIR.copy(DIRZ[0]).lerp(DIRZ[1], n).normalize(); SKY.sunS.position.copy(SUN_DIR).multiplyScalar(70); SKY.sunS.visible = n < 0.5; SKY.moonS.visible = n >= 0.5;
  if (n >= 0.5) SKY.moonS.position.copy(SUN_DIR).multiplyScalar(70);
  NIGHT.value = 0.45 + n * 0.5; // lit windows + glowing signs (the city atlas night layer)
}

// ---------------- helpers ----------------
function hullFromMB(mb) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mb.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.N, 3));
  addOdir(g); g.deleteAttribute('normal'); const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); return h; }
function kitMesh(fn) { // run a city-kit prop builder (car(), bin()...) into its own mesh at the origin
  const keep = CB.cap, mb = new MB(); CB.cap = mb; const nC = COLL.length, nB = BLD.length; fn(); CB.cap = keep; COLL.length = nC; BLD.length = nB;
  const g = new THREE.Group(), m = mb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; g.add(m, hullFromMB(mb)); return g; }
// merge a list of primitive parts into one geometry (baked colours, odir for the ink hull): the instanced zombies + small props use these
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3();
function mergeGeo(parts) {
  const P = [], N = [], C = []; const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const p of parts) { let g = p.g.index ? p.g.toNonIndexed() : p.g; g.computeVertexNormals && !g.attributes.normal && g.computeVertexNormals();
    const r = p.r || [0, 0, 0], s = p.s || [1, 1, 1]; _pm.compose(_pv.set(p.x || 0, p.y || 0, p.z || 0), _pq.setFromEuler(_pe.set(r[0], r[1], r[2])), _ps.set(s[0], s[1], s[2])); nm.getNormalMatrix(_pm);
    const col = new THREE.Color(p.c), A = g.attributes;
    for (let i = 0; i < A.position.count; i++) { v.fromBufferAttribute(A.position, i).applyMatrix4(_pm); P.push(v.x, v.y, v.z); v.fromBufferAttribute(A.normal, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); C.push(col.r, col.g, col.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  addOdir(g); g.computeBoundingSphere(); return g;
}
function geoMesh(parts, mat) { // a merged prop: toon mesh + ink hull
  const g = mergeGeo(parts), m = new THREE.Mesh(g, mat || PROP_MAT); m.castShadow = true; const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); m.add(h); return m; }
const PROP_MAT = toonMat();
const SIGN_TEX = (txt, bg, fg, w = 512, h = 128) => canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = H * 0.07; g.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16); sText(g, txt, W / 2, H / 2, W * 0.86, H * 0.62, SANS, fg); }, 512);

// ---------------- the city (built once): Toad City kit buildings with their real-name signs, streets, harbor, landmarks ----------------
const CITY = new THREE.Group(); scene.add(CITY);
const WATER_TEX = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2a6670'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(190,240,232,.6)'; c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const x = (i * 73) % w, y = (i * 47 + 13) % h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 16, y - 9, x + 32, y); c.stroke(); } }, 256);
WATER_TEX.wrapS = WATER_TEX.wrapT = THREE.RepeatWrapping; WATER_TEX.repeat.set(48, 18);
let WATER = null, FELLS_BB = null, WTC_BB = null;
const SPAWNS = []; // {x, z, k: 'edge' | 'water'}
const STREET_NAMES = [];
function buildCity() {
  CB = new CMB(); DB = new CMB(); GB = new CMB(); COLL.length = 0; BLD.length = 0; LAMPS.length = 0; SEED = 4242;
  const X0 = -24, X1 = MAPX1 + 30;
  // ground: Pratt St road, sidewalks + curbs, cross streets, plaza, promenade brick, the pier deck
  GB.floorSub(X0, -8, X1, 8, 0, T.road, '#fff', 4, 8);
  GB.floorSub(X0, -12, X1, -8, CURB, T.walk, '#fff', 3, 8); CB.wall(X1, -8, X0, -8, 0, CURB, T.white, '#8a8478');
  GB.floorSub(X0, 8, X1, 12, CURB, T.walk, '#fff', 3, 8); CB.wall(X0, 8, X1, 8, 0, CURB, T.white, '#8a8478');
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres]) { GB.floorSub(a + 1.5, -60, b - 1.5, -12, 0.005, T.road, '#fff', 4, 8); GB.floorSub(a, -60, a + 1.5, -12, CURB, T.walk, '#fff', 3, 8); GB.floorSub(b - 1.5, -60, b, -12, CURB, T.walk, '#fff', 3, 8);
    for (let x = a + 2; x < b - 2; x += 1.1) { CB.box(x, 0, -7.6, x + 0.55, 0.02, -5.4, '#ece8dc', T.white, {}); CB.box(x, 0, 5.4, x + 0.55, 0.02, 7.6, '#ece8dc', T.white, {}); } }
  for (const [a, b] of ALLEYS) GB.floorSub(a, -60, b, -12, 0.01, T.walk, '#9a948a', 3, 8);
  for (let x = X0; x < X1; x += 6) if (!(x > XS.light[0] - 3 && x < XS.light[1]) && !(x > XS.pres[0] - 3 && x < XS.pres[1]) && !(x > XS.eutaw[0] - 3 && x < XS.eutaw[1])) CB.box(x, 0, -0.08, x + 3, 0.02, 0.08, '#f0c840', T.white, {});
  GB.floorSub(X0, 12, 90, PLAZA_S, CURB, T.pave, '#d8d0c4', 4, 8); GB.floorSub(X0, PLAZA_S, 90, 90, CURB, T.grass, '#fff', 4, 10);
  GB.floorSub(XS.light[0] + 1.5, 12, XS.light[1] - 1.5, QUAY, 0.005, T.road, '#fff', 4, 8);
  GB.floorSub(102, 12, X1, QUAY, CURB, T.pave, '#fff', 4, 8);
  GB.floorSub(PIER.x0, PIER.z0, PIER.x1, PIER.z1, CURB + 0.02, T.pave, '#b08a62', 3, 6);
  // the quay wall + harbor railings (gap at Light St, the pier head)
  CB.wall(90, QUAY, X1, QUAY, WY - 0.3, CURB, T.white, '#8a8478');
  for (let x = 103; x < MAPX1 + 4; x += 2.5) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; CB.box(x - 0.06, CURB, QUAY - 0.42, x + 0.06, CURB + 1.0, QUAY - 0.3, '#2a2e36', T.white); }
  for (const [a, b] of [[102.5, PIER.x0 - 0.5], [PIER.x1 + 0.5, MAPX1 + 4]]) CB.box(a, CURB + 0.9, QUAY - 0.42, b, CURB + 1.0, QUAY - 0.3, '#2a2e36', T.white);
  // pier: pilings, side rails, the landing float
  for (let z = PIER.z0 + 1; z < PIER.z1; z += 3) for (const x of [PIER.x0 + 0.3, PIER.x1 - 0.3]) { CB.box(x - 0.25, WY - 0.4, z - 0.25, x + 0.25, CURB + 0.6, z + 0.25, '#5a4636', T.white); }
  for (const x of [PIER.x0 + 0.1, PIER.x1 - 0.1]) CB.box(x - 0.06, CURB + 0.85, PIER.z0 + 1, x + 0.06, CURB + 0.95, PIER.z1 - 0.5, '#5a4636', T.white);
  for (const x of [PIER.x0 + 0.1, PIER.x1 - 0.1]) for (let z = PIER.z0 + 1; z < PIER.z1; z += 2) CB.box(x - 0.06, CURB, z - 0.06, x + 0.06, CURB + 0.95, z + 0.06, '#5a4636', T.white);
  // north side of Pratt: blocks of Toad City buildings (storefronts + real-name shop signs on the street face), taller towers behind
  const blocks = [[-24, 26], [36, 60], [64, 90], [102, 140], [144, 200], [210, 236], [240, 306]];
  // Fells Point's Thames St block (real signs) closes the run at the east end, behind Broadway Pier
  const fells = lmMake('fells'); FELLS_BB = placeLM(fells, 271, 0, -12.4); CITY.add(fells);
  setRect(FELLS_BB.min.x, Math.max(FELLS_BB.min.z, -44), FELLS_BB.max.x, -12, 1);
  SEED = 77; let si = 0;
  for (const [a, b] of blocks) { let x = a;
    while (x < b - 0.5) { let w = Math.min(b - x, 9 + Math.floor(srnd() * 8)); if (b - (x + w) < 7) w = b - x;
      const x1 = x + w; const inFells = x1 > FELLS_BB.min.x - 0.5 && x < FELLS_BB.max.x + 0.5;
      if (!inFells) { const floors = 2 + Math.floor(srnd() * 4), shops = ['s']; if (x === a && a > -24) shops.push('w'); if (x1 === b && b < 306) shops.push('e');
        building(x, -12.4 - 10 - Math.floor(srnd() * 6), x1, -12.4, floors, Math.floor(srnd() * 6), { shops, sign: si++ % 8, v: srnd() < 0.5 ? 1 : 0, fire: srnd() < 0.3 ? 's' : undefined, fireAt: 0.75 }); }
      else if (x1 <= FELLS_BB.min.x - 0.5 || x >= FELLS_BB.max.x + 0.5) {}
      x = x1; } }
  SEED = 99; for (let x = -24; x < 300; x += 26) { if ([XS.eutaw, XS.light, XS.pres].some(([a, b]) => x < b && x + 22 > a)) continue; if (x + 22 > FELLS_BB.min.x && x < FELLS_BB.max.x) continue;
    building(x, -60, x + 22, -36, 5 + Math.floor(srnd() * 8), Math.floor(srnd() * 6), { ac: true, tower: srnd() < 0.3 ? [0.5, 0.5] : null }); }
  // the plaza south of W Pratt: trees, planters, benches, bus shelter, construction fence
  SEED = 5; for (let x = -16; x < 86; x += 9) for (const z of [17, 30]) { if (x > 66 && z === 17) continue; tree(x + srnd() * 2, z + srnd() * 2); setRect(x, z, x + 1, z + 1, 1); }
  for (let x = -12; x < 68; x += 18) { CB.box(x, CURB, 22.5, x + 4, CURB + 0.7, 24, '#8a7f74', T.white); GB.floorSub(x + 0.2, 22.7, x + 3.8, 23.8, CURB + 0.71, T.grass, '#fff', 2, 4); setRect(x, 22.5, x + 4, 24, 1); }
  CB.box(-24, CURB, PLAZA_S, 90, CURB + 0.9, PLAZA_S + 0.6, '#7a7068', T.white);
  // construction fence (chain-link panels drawn as dark posts + rails) around the Pratt & Light hold
  for (let x = 70; x <= 90; x += 2) CB.box(x - 0.06, CURB, 12.4, x + 0.06, CURB + 1.8, 12.6, '#3a3a40', T.white);
  CB.box(70, CURB + 1.6, 12.42, 90, CURB + 1.7, 12.58, '#3a3a40', T.white); CB.box(70, CURB + 0.2, 12.42, 90, CURB + 0.3, 12.58, '#3a3a40', T.white);
  for (let z = 13; z <= PLAZA_S; z += 2) CB.box(89.4, CURB, z - 0.06, 89.6, CURB + 1.8, z + 0.06, '#3a3a40', T.white);
  CB.box(89.42, CURB + 1.6, 12.5, 89.58, CURB + 1.7, PLAZA_S, '#3a3a40', T.white);
  // street furniture: lamps both sidewalks, traffic lights at the corners, bins + hydrants (all collide)
  for (let x = 4; x < MAPX1; x += 16) { if ([XS.eutaw, XS.light, XS.pres, ...ALLEYS].some(([a, b]) => x > a - 1.5 && x < b + 1.5)) continue; lampAt(x, -11.3, 0); setRect(x, -11.8, x + 1, -10.8, 1); }
  for (let x = 12; x < MAPX1; x += 16) { if (x > XS.light[0] - 1.5 && x < XS.light[1] + 1.5) continue; lampAt(x, 11.4, Math.PI); setRect(x, 10.9, x + 1, 11.9, 1); }
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres]) { trafficLight(a - 0.6, -11.4, 0); trafficLight(b + 0.6, 11.4, Math.PI); setRect(a - 1.1, -11.9, a - 0.1, -10.9, 1); setRect(b + 0.1, 10.9, b + 1.1, 11.9, 1); }
  SEED = 12; for (let x = 8; x < MAPX1 - 8; x += 13 + Math.floor(srnd() * 9)) { if ([XS.eutaw, XS.light, XS.pres, ...ALLEYS].some(([a, b]) => x > a - 2 && x < b + 2)) continue;
    const z = srnd() < 0.5 ? -9.4 : 9.4; if (srnd() < 0.5) bin(x, z, ['#22c4b4', '#3a5a3a', '#2a3a6a'][Math.floor(srnd() * 3)]); else hydrant(x, z); setRect(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 1); }
  // the promenade: trees in planters + benches + bollards
  SEED = 21; for (let x = 108; x < MAPX1; x += 14) { if (x > PIER.x0 - 3 && x < PIER.x1 + 3) continue; if (Math.abs(x - 205) < 7) continue;
    tree(x, 19.5); setRect(x - 0.5, 19, x + 0.5, 20, 1); CB.box(x + 3, CURB, 23.2, x + 5.4, CURB + 0.45, 23.8, '#6a4a34', T.white); setRect(x + 3, 23, x + 5.4, 24, 1); }
  // wrecked cars: the abandoned evacuation (city kit car(); block the cells under them)
  const WRECK = [['#a83a4a', '#d8d0c0'], ['#3a5a8a', '#2a3a5a'], ['#2a2a2e', '#1e1e22'], ['#5a7a4a', '#d8d0c0'], ['#d8a830', '#d8a830'], ['#e8e4dc', '#3a3a40'], ['#7a3a7a', '#d8d0c0']];
  const wrecks = [[18, -4.5, 1], [44, 3, 1], [55, -2.5, 0], [74, 5, 1], [122, -3.5, 1], [131, 4.5, 1], [158, -1, 0], [176, 3.5, 1], [192, -4.5, 1], [232, 2, 1], [248, -3.5, 1], [258, 4.5, 1], [10, 30, 1], [52, 34, 1]];
  wrecks.forEach(([x, z, along], i) => { const c = WRECK[i % WRECK.length]; car(x, z, along ? Math.PI / 2 : 0, c[0], c[1]); if (along) setRect(x - 2.2, z - 1, x + 2.2, z + 1, 1); else setRect(x - 1, z - 2.2, x + 1, z + 2.2, 1); });
  CITY.add(CB.build(CITY_MAT, { cast: true }), GB.build(CITY_MAT), DB.build(DECAL_MAT));
  // street-name blades at the corners (Toad City's sign atlas + sText) + the water taxi landing board
  const SN = new SA(); const blade = (x, z, ry, txt) => SN.at(x, CURB + 3.4, z, ry, 2.2, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, txt, w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); });
  for (const [k, nm] of [['eutaw', 'S EUTAW ST'], ['light', 'LIGHT ST'], ['pres', 'PRESIDENT ST']]) { const [a] = XS[k]; blade(a - 0.62, -11.3, 0, k === 'pres' ? 'E PRATT ST' : 'W PRATT ST'); blade(a - 0.52, -11.4, -Math.PI / 2, nm); }
  SN.at(PIER.x0 + 1.2, CURB + 2.6, PIER.z0 + 0.2, 0, 4.2, 0.9, (g, w, hh) => { g.fillStyle = '#1a3a6a'; g.fillRect(0, 0, w, hh); g.fillStyle = '#ffd23c'; g.fillRect(0, hh * 0.78, w, hh * 0.22); sText(g, 'BROADWAY PIER', w / 2, hh * 0.4, w * 0.9, hh * 0.56, SANS, '#f2efe6'); sText(g, 'WATER TAXI', w / 2, hh * 0.89, w * 0.5, hh * 0.2, SANS, '#14101f'); });
  CITY.add(SN.build());
  { const post = geoMesh([{ g: G.box(0.14, 2.6, 0.14), c: '#2a2a30', x: 0, y: 1.3 }, { g: G.box(0.14, 2.6, 0.14), c: '#2a2a30', x: 4, y: 1.3 }]); post.position.set(PIER.x0 + 1.2 - 2 + 2, CURB, PIER.z0 + 0.1); post.position.x = PIER.x0 + 1.2 - 2.1 + 0.05; CITY.add(post); }
  // the World Trade Center out on its pier (real wording + shape, Toad City's builder)
  const wtc = lmMake('wtc'); WTC_BB = placeLM(wtc, 154, 60); CITY.add(wtc);
  // harbor water
  WATER = new THREE.Mesh(new THREE.PlaneGeometry(420, 150), new THREE.MeshLambertMaterial({ map: WATER_TEX, color: '#b8e0dc' })); WATER.rotation.x = -Math.PI / 2; WATER.position.set(150, WY, QUAY + 75); WATER.receiveShadow = true; CITY.add(WATER);
  CITY.traverse((o) => { if (o.isMesh && o.material === CITY_MAT) o.receiveShadow = true; });
  // spawn points: road ends, cross-street + alley ends, the plaza edge; water climbers along the quay + the pier
  for (let z = -10; z <= 10; z += 2.5) SPAWNS.push({ x: -21, z, k: 'edge' });
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres, ...ALLEYS]) for (let x = a + 1; x < b; x += 2.5) SPAWNS.push({ x, z: -40, k: 'edge' });
  for (let x = -18; x < 66; x += 7) SPAWNS.push({ x, z: PLAZA_S - 1.5, k: 'edge' });
  for (let z = 14; z < 38; z += 4) SPAWNS.push({ x: -21, z, k: 'edge' });
  for (let z = -10; z <= 24; z += 3) SPAWNS.push({ x: MAPX1 - 1, z, k: 'edge' });
  for (let x = 104; x < MAPX1; x += 2.6) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; SPAWNS.push({ x, z: QUAY - 0.9, k: 'water' }); }
  for (let z = PIER.z0 + 2; z < PIER.z1 - 1; z += 2.5) { SPAWNS.push({ x: PIER.x0 + 0.7, z, k: 'water' }); SPAWNS.push({ x: PIER.x1 - 0.7, z, k: 'water' }); }
}

// ---------------- flow fields: Dial's algorithm on the grid (barricades cost 8: the horde piles up on them instead of detouring) ----------------
const FIELD = new Uint16Array(GN), BOTF = new Uint16Array(GN);
const BK = []; for (let i = 0; i < 9; i++) BK.push([]);
function computeField(F, sx, sz, barCost) {
  F.fill(65535); const s = gi(sx, sz); if (s < 0) return; for (const q of BK) q.length = 0;
  F[s] = 0; BK[0].push(s); let cur = 0, pending = 1, guard = 0;
  while (pending > 0 && guard++ < 2e6) { const q = BK[cur % 9]; if (!q.length) { cur++; continue; }
    const c = q.pop(); pending--; const d = F[c]; if (d !== cur) continue; const col = c % GWD;
    for (let n4 = 0; n4 < 4; n4++) { const n = n4 === 0 ? (col > 0 ? c - 1 : -1) : n4 === 1 ? (col < GWD - 1 ? c + 1 : -1) : n4 === 2 ? c - GWD : c + GWD;
      if (n < 0 || n >= GN) continue; const v = GRID[n]; if (v === 1 || v === 2 || v === 3) continue; if (v === 4 && !barCost) continue;
      const nd = d + (v === 4 ? barCost : 1); if (nd < F[n]) { F[n] = nd; BK[nd % 9].push(n); pending++; } } }
}

// ======================= DEAD STREETS: the horde (pooled, instanced: one InstancedMesh per body type + shared instanced legs + instanced ink hulls) =======================
// The ink hull is Toad City's outline material (same uniforms / fragment), with a vertex shader that also applies the instance matrix.
function instOutline(src) {
  return new THREE.ShaderMaterial({ uniforms: src.uniforms, fragmentShader: src.fragmentShader, side: THREE.BackSide,
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { mat4 mm = modelMatrix;
        #ifdef USE_INSTANCING
          mm = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = mm * vec4(position, 1.0); vec3 wd = normalize(mat3(mm) * odir) * length(odir);
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0); vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }` });
}
const OUT_INST = instOutline(OUT_CHAR);
const ZMAT = toonMat(); ZMAT.customProgramCacheKey = () => 'psxZ';
const SKN = ['#7f9a5c', '#8aa070', '#6f8a58', '#9aa47a', '#7a8e6a']; // sick toad skins
// zombie toad bodies (origin at the feet, facing +z; legs are separate instances pivoting at the hips)
function toadHead(L, y, z, skin, o = {}) {
  L.push({ g: G.sph(0.31, 0.19, 0.28, 9, 6), c: skin, y, z, r: [o.tilt || 0.25, 0, o.roll || 0.18] }, { g: G.sph(0.27, 0.1, 0.22), c: '#c8c49a', y: y - 0.08, z: z + 0.05, r: [0.25, 0, 0.18] });
  L.push({ g: G.box(0.38, 0.09, 0.06), c: '#3a1418', y: y - 0.06, z: z + 0.25, r: [0.35, 0, 0.18] }); // open mouth
  for (const s of [-1, 1]) { L.push({ g: G.sph(0.1, 0.1, 0.1), c: skin, x: s * 0.14, y: y + 0.13, z: z + 0.08 });
    L.push({ g: G.sph(0.07, s > 0 ? 0.07 : 0.04, 0.05), c: o.eye || '#e8f0c0', x: s * 0.14, y: y + 0.15, z: z + 0.16 });
    L.push({ g: G.box(0.03, 0.03, 0.02), c: o.pupil || '#c02020', x: s * 0.14 + 0.02, y: y + 0.15, z: z + 0.205 }); }
}
function armsOut(L, sx, y, skin, sleeve, len = 0.5, lift = 0) {
  for (const s of [-1, 1]) { L.push({ g: G.cap(0.075, len), c: sleeve, x: s * sx, y: y + lift * s * 0.05, z: len / 2 + 0.05, r: [Math.PI / 2 - 0.1 - lift * 0.1, 0, 0] });
    L.push({ g: G.sph(0.09, 0.05, 0.11), c: skin, x: s * sx, y: y - 0.02, z: len + 0.18 }); }
}
const ZT = {}; // type table
function defType(id, o) { ZT[id] = Object.assign({ id, cap: 60, hp: 30, sp: [1.2, 1.9], dmg: 8, r: 0.38, scale: 1, legC: '#3a3442', score: 10, barDps: 12 }, o); }
defType('wA', { cap: 300, parts: () => { const L = [], sk = SKN[0]; L.push({ g: G.sph(0.3, 0.34, 0.25), c: '#c03a3a', y: 0.92, z: 0.04, r: [0.35, 0, 0] }, { g: G.box(0.34, 0.4, 0.06), c: '#f0ece0', y: 0.92, z: 0.25, r: [0.35, 0, 0] }); // crab-house bib
  L.push({ g: G.sph(0.22, 0.14, 0.18), c: '#3a3442', y: 0.66 }); toadHead(L, 1.3, 0.2, sk); armsOut(L, 0.32, 1.08, sk, '#c03a3a'); return L; } });
defType('wB', { cap: 300, hp: 28, parts: () => { const L = [], sk = SKN[3]; L.push({ g: G.cyl(0.24, 0.4, 0.5, 8), c: '#4a6ab8', y: 0.68 }, { g: G.sph(0.28, 0.3, 0.24), c: '#4a6ab8', y: 0.98, z: 0.03, r: [0.3, 0, 0] }); // hon: blue dress
  toadHead(L, 1.32, 0.18, sk); L.push({ g: G.sph(0.3, 0.42, 0.3), c: '#c8b04a', y: 1.66, z: 0.04 }); // the beehive
  for (const s of [-1, 1]) L.push({ g: G.box(0.13, 0.04, 0.03), c: '#d23a8a', x: s * 0.14, y: 1.5, z: 0.36, r: [0, 0, -s * 0.3] }); // cat-eye frames
  armsOut(L, 0.3, 1.08, sk, sk, 0.46); return L; }, legC: SKN[3] });
defType('wC', { cap: 300, parts: () => { const L = [], sk = SKN[2]; L.push({ g: G.sph(0.3, 0.35, 0.26), c: '#5a3a8a', y: 0.92, z: 0.04, r: [0.4, 0, 0] }, { g: G.sph(0.22, 0.12, 0.2), c: '#5a3a8a', y: 1.18, z: -0.1 }); // purple hoodie
  L.push({ g: G.sph(0.22, 0.14, 0.18), c: '#2a3a5a', y: 0.66 }); toadHead(L, 1.3, 0.2, sk, { roll: -0.2 }); armsOut(L, 0.32, 1.06, sk, '#5a3a8a', 0.5, 1); return L; }, legC: '#2a3a5a' });
defType('runner', { cap: 140, hp: 22, sp: [4.0, 4.8], dmg: 6, score: 20, parts: () => { const L = [], sk = '#a08a5a'; L.push({ g: G.sph(0.24, 0.32, 0.2), c: '#e8e4d8', y: 0.9, z: 0.12, r: [0.75, 0, 0] }); // tank top, leaning hard
  L.push({ g: G.sph(0.2, 0.12, 0.17), c: '#5a7aa8', y: 0.66 }); toadHead(L, 1.18, 0.44, sk, { tilt: 0.6, eye: '#ffe060', pupil: '#ff2020' }); armsOut(L, 0.28, 0.98, sk, sk, 0.42); return L; }, legC: '#5a7aa8' });
defType('brute', { cap: 30, hp: 420, sp: [1.0, 1.25], dmg: 24, r: 0.8, scale: 1.75, score: 150, barDps: 70, parts: () => { const L = [], sk = '#6a7a54';
  L.push({ g: G.sph(0.42, 0.42, 0.34), c: '#ff7a1c', y: 0.98, z: 0.04, r: [0.3, 0, 0] }, { g: G.box(0.5, 0.08, 0.36), c: '#e8e070', y: 0.98, z: 0.06, r: [0.3, 0, 0] }); // dock-worker vest
  L.push({ g: G.sph(0.3, 0.16, 0.24), c: '#3a3a40', y: 0.66 }); toadHead(L, 1.38, 0.22, sk); L.push({ g: G.sph(0.24, 0.13, 0.24), c: '#ffd23c', y: 1.56, z: 0.18 }, { g: G.cyl(0.3, 0.3, 0.03, 10), c: '#ffd23c', y: 1.5, z: 0.18 }); // hard hat
  for (const s of [-1, 1]) { L.push({ g: G.sph(0.18, 0.18, 0.18), c: sk, x: s * 0.44, y: 1.18 }); L.push({ g: G.cap(0.13, 0.5), c: sk, x: s * 0.46, y: 0.92, z: 0.18, r: [0.6, 0, 0] }); L.push({ g: G.sph(0.16, 0.12, 0.16), c: sk, x: s * 0.46, y: 0.7, z: 0.42 }); }
  return L; }, legC: '#3a3a40' });
defType('bloater', { cap: 70, hp: 45, sp: [0.9, 1.15], dmg: 10, r: 0.6, score: 30, parts: () => { const L = [], sk = '#8a9a5a'; L.push({ g: G.sph(0.5, 0.48, 0.48), c: '#9a7aa0', y: 0.95, z: 0.05 }); // swollen belly
  for (let k = 0; k < 9; k++) { const a = k * 2.4, y = 0.75 + (k % 3) * 0.18; L.push({ g: G.sph(0.08, 0.08, 0.08), c: '#c8e050', x: Math.cos(a) * 0.46, y, z: Math.sin(a) * 0.46 + 0.05 }); }
  toadHead(L, 1.46, 0.16, sk, { eye: '#e0ff80' }); armsOut(L, 0.42, 1.0, sk, sk, 0.28); return L; }, legC: '#6a5a6a' });
defType('spitter', { cap: 50, hp: 55, sp: [1.4, 1.7], dmg: 6, score: 40, parts: () => { const L = [], sk = '#b0b050'; L.push({ g: G.sph(0.26, 0.34, 0.22), c: '#3a6a5a', y: 0.92, z: 0.02, r: [0.2, 0, 0] });
  L.push({ g: G.cap(0.1, 0.3), c: sk, y: 1.3, z: 0.05 }); toadHead(L, 1.62, 0.12, sk, { eye: '#ffffff', pupil: '#20a020' }); L.push({ g: G.sph(0.24, 0.2, 0.2), c: '#e8f070', y: 1.42, z: 0.24 }); // the swollen throat sac
  armsOut(L, 0.3, 1.04, sk, '#3a6a5a', 0.4); return L; }, legC: '#2a3a3a' });
const ZLIST = Object.values(ZT);
// horde budget: build the zombie bodies from lower-poly primitives than the HD hero rigs (hundreds are on screen at once)
const _G0 = { sph: G.sph, cap: G.cap, cyl: G.cyl };
G.sph = (rx, ry, rz) => new THREE.SphereGeometry(1, 9, 6).scale(rx, ry, rz); G.cap = (r, len) => new THREE.CapsuleGeometry(r, len, 1, 6); G.cyl = (rt, rb, h, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, Math.min(Math.max(s, 6), 10), 1, open);
const LEG_GEO = mergeGeo([{ g: G.cap(0.1, 0.36), c: '#ffffff', y: -0.3 }, { g: G.sph(0.12, 0.07, 0.18), c: '#ffffff', y: -0.6, z: 0.07 }]);
let ZCAP = 0; for (const t of ZLIST) { t.geo = mergeGeo(t.parts()); t.im = new THREE.InstancedMesh(t.geo, ZMAT, t.cap); t.ol = new THREE.InstancedMesh(t.geo, OUT_INST, t.cap);
  for (const m of [t.im, t.ol]) { m.count = 0; m.frustumCulled = false; scene.add(m); } t.im.castShadow = false; t.im.receiveShadow = true; t.ol.visible = QUAL.hd; QUAL.outlines.push(t.ol);
  t.im.setColorAt(0, new THREE.Color(1, 1, 1)); ZCAP += t.cap; t.n = 0; }
Object.assign(G, _G0); // everything else keeps Toad City's HD primitives
DZ.zTris = Object.fromEntries(ZLIST.map((t) => [t.id, t.geo.attributes.position.count / 3]));
const LEGS = new THREE.InstancedMesh(LEG_GEO, ZMAT, ZCAP * 2), LEGS_OL = new THREE.InstancedMesh(LEG_GEO, OUT_INST, ZCAP * 2);
for (const m of [LEGS, LEGS_OL]) { m.count = 0; m.frustumCulled = false; scene.add(m); } LEGS.setColorAt(0, new THREE.Color(1, 1, 1)); LEGS_OL.visible = QUAL.hd; QUAL.outlines.push(LEGS_OL);
// blob shadows under every zombie (cheap: one instanced quad)
const BLOB = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false }), ZCAP);
BLOB.count = 0; BLOB.frustumCulled = false; BLOB.renderOrder = 1; scene.add(BLOB);
// goo decals on the ground (ring buffer)
const GOO_N = 160, GOO = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }), GOO_N);
GOO.count = 0; GOO.frustumCulled = false; GOO.renderOrder = 1; scene.add(GOO); GOO.setColorAt(0, new THREE.Color('#5a8a2a')); let gooI = 0;
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color();
function goo(x, z, s, col) { const y = (gi(x, z) >= 0 && z > -8 && z < 8) || (x > XS.light[0] + 1.5 && x < XS.light[1] - 1.5 && z > 12) ? 0.03 : CURB + 0.03;
  _gm.compose(_gp.set(x, y, z), _gq.setFromAxisAngle(_Y, Math.random() * TAU), _gs.set(s * (0.8 + Math.random() * 0.6), 1, s)); GOO.setMatrixAt(gooI, _gm); GOO.setColorAt(gooI, _gc.set(col || '#4f7a22'));
  gooI = (gooI + 1) % GOO_N; GOO.count = Math.max(GOO.count, gooI === 0 ? GOO_N : gooI); GOO.instanceMatrix.needsUpdate = true; GOO.instanceColor.needsUpdate = true; }
const _Y = new THREE.Vector3(0, 1, 0);

// ---------------- the pool ----------------
const Z = []; for (let i = 0; i < ZCAP; i++) Z.push({ on: false, i });
let ZALIVE = 0; const ZBY = {}; for (const t of ZLIST) ZBY[t.id] = 0;
function groundY(x, z) { if (x > XS.light[0] + 1.5 && x < XS.light[1] - 1.5 && z > -60 && z < QUAY) return 0; for (const [a, b] of [XS.eutaw, XS.pres]) if (x > a + 1.5 && x < b - 1.5 && z < -12) return 0; return z > -8 && z < 8 ? 0 : CURB; }
function spawnZ(type, x, z, o = {}) {
  const t = ZT[type]; if (!t || ZBY[type] >= t.cap) return null; const q = Z.find((e) => !e.on); if (!q) return null;
  Object.assign(q, { on: true, t, x, z, y: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: Math.random() * TAU, hp: t.hp * (o.hpMul || 1), maxhp: t.hp, sp: rnd(t.sp[0], t.sp[1]) * (o.spMul || 1), ph: Math.random() * TAU,
    die: 0, flash: 0, atk: Math.random() * 0.6, climb: o.climb ? 1 : 0, think: Math.random() * 0.2, dx: 0, dz: 0, spit: rnd(1.5, 3.5), lunge: 0, seen: false, fallDir: 1, tint: 0.82 + Math.random() * 0.3 });
  ZBY[type]++; ZALIVE++; return q;
}
function freeZ(q) { if (!q.on) return; q.on = false; ZBY[q.t.id]--; if (!q.die) ZALIVE--; }
function clearHorde() { for (const q of Z) if (q.on) { q.on = false; } ZALIVE = 0; for (const t of ZLIST) ZBY[t.id] = 0; for (const s of SPITS) { s.on = false; s.m.visible = false; } }

// spatial hash (2 m buckets) for separation, melee and explosions
const HB_C = 2, HB_W = Math.ceil(GWD / HB_C), HB_H = Math.ceil(GHT / HB_C), HHEAD = new Int32Array(HB_W * HB_H), HNEXT = new Int32Array(ZCAP);
HHEAD.fill(-1);
const hbk = (x, z) => { const i = clamp(Math.floor((x - GX0) / HB_C), 0, HB_W - 1), j = clamp(Math.floor((z - GZ0) / HB_C), 0, HB_H - 1); return j * HB_W + i; };
function rehash() { HHEAD.fill(-1); for (const q of Z) if (q.on && !q.die && !q.climb) { const b = hbk(q.x, q.z); HNEXT[q.i] = HHEAD[b]; HHEAD[b] = q.i; } }
function nearZ(x, z, r, fn) { const i0 = clamp(Math.floor((x - r - GX0) / HB_C), 0, HB_W - 1), i1 = clamp(Math.floor((x + r - GX0) / HB_C), 0, HB_W - 1), j0 = clamp(Math.floor((z - r - GZ0) / HB_C), 0, HB_H - 1), j1 = clamp(Math.floor((z + r - GZ0) / HB_C), 0, HB_H - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let k = HHEAD[j * HB_W + i]; k >= 0; k = HNEXT[k]) { const q = Z[k]; const dx = q.x - x, dz = q.z - z; if (dx * dx + dz * dz < (r + q.t.r) * (r + q.t.r)) fn(q, dx, dz); } }

// ---------------- spitter spit (arcing globs) ----------------
const SPIT_MAT = toonMat(); const SPITS = [];
for (let i = 0; i < 24; i++) { const m = geoMesh([{ g: G.sph(0.18, 0.18, 0.18), c: '#c8f040' }, { g: G.sph(0.1, 0.1, 0.1), c: '#f8ffb0', x: 0.06, y: 0.06, z: 0.1 }], SPIT_MAT); m.visible = false; scene.add(m); SPITS.push({ m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3() }); }
function throwSpit(q, tx, tz) { const s = SPITS.find((e) => !e.on); if (!s) return; s.on = true; s.m.visible = true; const sc = q.t.scale; s.p.set(q.x, 1.45 * sc, q.z);
  const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz) || 1, T_ = clamp(d / 9, 0.55, 1.2); s.v.set(dx / T_, (0.3 - s.p.y + 0.5 * 14 * T_ * T_) / T_, dz / T_); SND.spit(); }
function spitStep(dt) { for (const s of SPITS) { if (!s.on) continue; s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt); s.m.position.copy(s.p); s.m.rotation.y += dt * 8;
  if (s.p.y <= 0.25) { s.on = false; s.m.visible = false; goo(s.p.x, s.p.z, 1.3, '#a8d830'); spawnSprite(FXT.puff, new THREE.Vector3(s.p.x, 0.5, s.p.z), 1.1, 0.4); const dx = PL.x - s.p.x, dz = PL.z - s.p.z; if (dx * dx + dz * dz < 1.6) hurtPlayer(8, 'SPAT ON', s.p.x, s.p.z); SND.splat(); } } }

// ---------------- explosions (bloaters + spice bombs) ----------------
function explode(x, z, r, dmgZ, dmgP, src) {
  spawnSprite(FX2.boom, new THREE.Vector3(x, 1.6, z), r * 1.1, 0.6, { kind: 'word', aspect: 2.2 }); spawnSprite(FXT.puff, new THREE.Vector3(x, 0.6, z), r * 1.3, 0.55); spawnSprite(FXT.star, new THREE.Vector3(x, 1.0, z), r * 0.9, 0.3);
  for (let k = 0; k < 4; k++) goo(x + rnd(-r, r) * 0.5, z + rnd(-r, r) * 0.5, rnd(0.8, 1.6), src === 'bloat' ? '#7a5a8a' : '#3a2a20');
  S.shake = Math.max(S.shake, src === 'bomb' ? 0.7 : 0.45); SND.boom(src === 'bomb');
  const hits = []; nearZ(x, z, r, (q) => hits.push(q)); for (const q of hits) { const dx = q.x - x, dz = q.z - z, d = Math.hypot(dx, dz) || 1; hitZ(q, dmgZ * (1 - 0.5 * d / (r + 1)), dx / d * 7, dz / d * 7, src); }
  if (BOSS.on && !BOSS.dead && Math.hypot(BOSS.x - x, BOSS.z - z) < r + 1.2) bossHit(dmgZ * 0.8, src);
  if (dmgP > 0) { const d = Math.hypot(PL.x - x, PL.z - z), rr = src === 'bomb' ? 2.6 : r; if (d < rr) hurtPlayer(dmgP * (1 - 0.4 * d / rr), src === 'bloat' ? 'BLOATER' : 'YOUR OWN BOMB', x, z); }
  for (const b of BARS) if (b.hp > 0 && src === 'bloat' && Math.hypot(b.cx - x, b.cz - z) < r + 1) damageBar(b, 60);
}

// ---------------- damage ----------------
function hitZ(q, dmg, kx, kz, src, isHeadshot = false) {
  if (!q.on || q.die) return false; q.hp -= dmg; q.flash = 0.08; S.stats.dealt += dmg;
  if (src === 'bullet') {
    const flinchStr = (isHeadshot ? 1.6 : 1.0) * (q.t.id === 'brute' ? 0.35 : 1.0);
    q.flinch = Math.min(0.35, (q.flinch || 0) + 0.22 * flinchStr);
    const kickMult = (PL.w === 1 ? 2.6 : PL.w === 3 ? 3.8 : 1.8);
    q.kx += kx * kickMult * flinchStr; q.kz += kz * kickMult * flinchStr;
    q.vx *= 0.15; q.vz *= 0.15;
  } else { q.kx += kx; q.kz += kz; }
  if (q.hp <= 0) { killZ(q, src, isHeadshot); return true; } return false;
}
function killZ(q, src, isHeadshot = false) {
  q.die = 0.0001; ZALIVE--; q.fallDir = Math.random() < 0.5 ? 1 : -1; S.stats.kills++; S.combo++; S.comboT = 2.2; if (q.t.id !== 'wA' && q.t.id !== 'wB' && q.t.id !== 'wC') S.stats.specials++;
  let pts = q.t.score * (1 + Math.min(4, Math.floor(S.combo / 15)));
  if (isHeadshot) pts = Math.round(pts * 1.5);
  S.score += pts;
  goo(q.x, q.z, q.t.id === 'brute' ? 1.6 : 0.9);
  if (q.t.id === 'bloater') { explode(q.x, q.z, 3.4, 70, 22, 'bloat'); }
  else if (Math.random() < (q.t.id === 'brute' ? 1 : 0.18)) spawnSprite(FX2.splat, new THREE.Vector3(q.x, 1.4 * q.t.scale, q.z), 1.1 * q.t.scale, 0.45, { kind: 'word', aspect: 2.2 });
  const popTxt = isHeadshot ? '+' + pts + ' HEADSHOT' : '+' + pts;
  const popCls = isHeadshot ? 'gold headshot' : 'gold';
  pop(q.x, 2.0 * q.t.scale, q.z, popTxt, popCls);
  // drops: scrap for barricades, the odd ammo box / crab cake
  if (Math.random() < 0.28 || q.t.id === 'brute') dropPickup('scrap', q.x, q.z, q.t.id === 'brute' ? 4 : 1);
  if (Math.random() < (q.t.id === 'brute' ? 0.8 : q.t.score >= 30 ? 0.12 : 0.018)) dropPickup('ammo', q.x + 0.4, q.z);
  if (Math.random() < (q.t.id === 'brute' ? 0.5 : 0.01)) dropPickup('cake', q.x - 0.4, q.z);
  if (src === 'bullet' && Math.random() < 0.08) SND.groan(0.5);
}

// ---------------- the horde step: flow-field steering, separation, wall sliding, attacks on Harold / Mavis / barricades ----------------
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function steer(q) { // pick the downhill neighbour on the flow field
  const k = gi(q.x, q.z); if (k < 0) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; } const d0 = FIELD[k];
  if (d0 <= 2 || d0 === 65535) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; }
  let best = d0, bx = 0, bz = 0; const cx = (k % GWD), cz = Math.floor(k / GWD);
  for (const [ox, oz] of N8) { const nx = cx + ox, nz = cz + oz; if (nx < 0 || nz < 0 || nx >= GWD || nz >= GHT) continue; const n = nz * GWD + nx; const v = GRID[n]; if (v === 1 || v === 2 || v === 3) continue;
    if (ox && oz) { const a = GRID[cz * GWD + nx], b = GRID[nz * GWD + cx]; if (a !== 0 && a !== 4 || b !== 0 && b !== 4) continue; }
    const f = FIELD[n] + (ox && oz ? 0.4 : 0); if (f < best) { best = f; bx = ox; bz = oz; } }
  if (best === d0) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; }
  q.dx = cellX(cz * GWD + cx + bx + bz * GWD) - q.x + bx * 0.3; q.dz = cellZ(cz * GWD + cx + bx + bz * GWD) - q.z + bz * 0.3;
}
function hordeStep(dt) {
  rehash(); const ptx = PL.x, ptz = PL.z;
  for (const q of Z) { if (!q.on) continue; const t = q.t;
    if (q.die) { q.die += dt; if (q.die > 1.6) freeZ(q); continue; }
    q.flash = Math.max(0, q.flash - dt); if (q.flinch > 0) q.flinch = Math.max(0, q.flinch - dt); q.ph += dt * q.sp * 3.2;
    if (q.climb > 0) { q.climb -= dt * 0.8; q.y = -1.4 * q.climb; q.yaw = Math.atan2(ptx - q.x, ptz - q.z); if (q.climb <= 0) { q.climb = 0; q.y = 0; } continue; }
    const dxp = ptx - q.x, dzp = ptz - q.z, dp2 = dxp * dxp + dzp * dzp;
    if (dp2 > 110 * 110) { if (S.mode === 'play' && Math.random() < dt * 0.2) { freeZ(q); } continue; } // far stragglers fall away
    q.think -= dt; if (q.think <= 0) { q.think = 0.12 + Math.random() * 0.12; steer(q); }
    let mx = q.dx, mz = q.dz; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    let sp = q.sp; const dp = Math.sqrt(dp2);
    if (t.id === 'spitter') { if (dp < 7 && FIELD[gi(q.x, q.z)] < 12) { mx = -mx * 0.6; mz = -mz * 0.6; } q.spit -= dt; if (q.spit <= 0 && dp < 13) { q.spit = rnd(2.4, 3.6); throwSpit(q, ptx + PL.vx * 0.5, ptz + PL.vz * 0.5); q.lunge = 0.3; } }
    if (t.id === 'runner' && dp < 3) sp *= 1.15;
    // separation
    let sx = 0, sz = 0; nearZ(q.x, q.z, t.r + 0.1, (o, dx, dz) => { if (o === q) return; const d = Math.hypot(dx, dz) || 0.01, push = (t.r + o.t.r - d) / d; if (push > 0) { const w = o.t.r > t.r ? 1.4 : 0.8; sx -= dx * push * w; sz -= dz * push * w; } });
    const tx = mx * sp + sx * 3.5, tz = mz * sp + sz * 3.5;
    q.vx = damp(q.vx, tx, 6, dt); q.vz = damp(q.vz, tz, 6, dt);
    let nx = q.x + (q.vx + q.kx) * dt, nz = q.z + (q.vz + q.kz) * dt; q.kx = damp(q.kx, 0, 7, dt); q.kz = damp(q.kz, 0, 7, dt);
    // walls: slide; barricades: chew on them
    const kN = gi(nx, nz); const v = kN < 0 ? 1 : GRID[kN];
    if (v === 4) { const b = BARS[BAR_AT[kN]]; if (b && b.hp > 0) { q.atk -= dt; if (q.atk <= 0) { q.atk = 0.5; damageBar(b, t.barDps * 0.5); q.lunge = 0.25; } } nx = q.x; nz = q.z; }
    else if (v !== 0) { if (!solidAt(nx, q.z)) nz = q.z; else if (!solidAt(q.x, nz)) nx = q.x; else { nx = q.x; nz = q.z; } }
    q.x = nx; q.z = nz;
    if (Math.abs(q.vx) + Math.abs(q.vz) > 0.1) { const a = Math.atan2(q.vx, q.vz); q.yaw += angTo(q.yaw, a) * Math.min(1, dt * 7); }
    // bite Harold
    const reach = t.r + 0.55;
    if (dp < reach + 0.15 && S.mode === 'play') { q.atk -= dt; if (q.atk <= 0) { q.atk = t.id === 'brute' ? 1.2 : 0.85; q.lunge = 0.3; hurtPlayer(t.dmg, t.id === 'brute' ? 'BRUTE' : 'BITTEN', q.x, q.z); if (t.id === 'brute') { PL.kx += dxp / (dp || 1) * 9; PL.kz += dzp / (dp || 1) * 9; } if (t.id === 'bloater') { q.hp = 0; killZ(q, 'bloat'); } } }
    q.lunge = Math.max(0, q.lunge - dt);
    if (!q.seen && dp < 16) { q.seen = true; if (Math.random() < 0.15) SND.groan(t.id === 'brute' ? 1.4 : 1); }
  }
  spitStep(dt);
}

// ---------------- write the instances ----------------
const _zm = new THREE.Matrix4(), _zl = new THREE.Matrix4(), _zq = new THREE.Quaternion(), _ze = new THREE.Euler(0, 0, 0, 'YXZ'), _zp = new THREE.Vector3(), _zs = new THREE.Vector3(), _zc = new THREE.Color(), _zt = new THREE.Matrix4();
function hordeDraw() {
  for (const t of ZLIST) t.n = 0; let nl = 0, nb = 0;
  const cx = camera.position.x, cz = camera.position.z;
  for (const q of Z) { if (!q.on) continue; const t = q.t, sc = t.scale;
    if (FPS_MODE) { const dx = q.x - cx, dz = q.z - cz; if (dx * dx + dz * dz > 75 * 75) continue; }
    else if (Math.abs(q.x - cx) > 48 || q.z - cz > 10 || cz - q.z > 75) continue; // off-screen: skip
    const fall = q.die ? clamp(q.die / 0.45, 0, 1) : 0, walk = q.die ? 0 : Math.sin(q.ph);
    const flinchPitch = q.flinch > 0 ? -Math.sin((q.flinch / 0.22) * Math.PI) * 0.45 : 0;
    const pitch = fall * q.fallDir * Math.PI / 2 * 0.96 + (q.lunge > 0 ? 0.35 : 0) + flinchPitch, roll = q.die ? 0 : walk * 0.12, sink = q.die > 1.0 ? (q.die - 1.0) * 0.8 : 0;
    const by = q.y + (q.die ? 0.12 * fall * sc - sink : Math.abs(Math.cos(q.ph)) * 0.05);
    _ze.set(pitch, q.yaw, roll); _zq.setFromEuler(_ze); _zm.compose(_zp.set(q.x, by + groundY(q.x, q.z), q.z), _zq, _zs.set(sc, sc, sc));
    const ii = t.n++; t.im.setMatrixAt(ii, _zm); t.ol.setMatrixAt(ii, _zm);
    const f = q.flash > 0 ? 2.4 : q.tint; _zc.setRGB(f, f, f); t.im.setColorAt(ii, _zc);
    for (const s of [-1, 1]) { _zl.makeRotationX(q.die ? 0.3 : walk * 0.7 * s); _zl.setPosition(s * 0.15, 0.62, 0); _zt.multiplyMatrices(_zm, _zl); LEGS.setMatrixAt(nl, _zt); LEGS_OL.setMatrixAt(nl, _zt); _zc.copy(t.legCol || (t.legCol = new THREE.Color(t.legC))).multiplyScalar(q.flash > 0 ? 2.2 : 1); LEGS.setColorAt(nl, _zc); nl++; }
    if (!q.die && q.y > -0.5) { _zm.compose(_zp.set(q.x, groundY(q.x, q.z) + 0.02, q.z), _zq.identity(), _zs.set(t.r * 2.2, 1, t.r * 2.2)); BLOB.setMatrixAt(nb++, _zm); }
  }
  for (const t of ZLIST) { t.im.count = t.ol.count = t.n; t.im.instanceMatrix.needsUpdate = t.ol.instanceMatrix.needsUpdate = true; if (t.im.instanceColor) t.im.instanceColor.needsUpdate = true; }
  LEGS.count = LEGS_OL.count = nl; LEGS.instanceMatrix.needsUpdate = LEGS_OL.instanceMatrix.needsUpdate = true; if (LEGS.instanceColor) LEGS.instanceColor.needsUpdate = true;
  BLOB.count = nb; BLOB.instanceMatrix.needsUpdate = true; DZ.drawn = nl / 2;
}

// ---------------- extra comic words (Toad City's comicText + halftone, same style as its FXT.words) ----------------
const FX2 = {}; for (const [k, w, fill] of [['splat', 'SPLAT!', '#9ae04a'], ['boom', 'BOOM!', '#ff8a3d'], ['chomp', 'CHOMP!', '#ff5f7a'], ['shove', 'SHOVE!', '#7fe8ff'], ['blam', 'BLAM!', '#ffd23c']])
  FX2[k] = canvasTex(512, 192, (c) => { c.fillStyle = INK; c.beginPath(); for (let i = 0; i < 28; i++) { const r = i % 2 ? 62 : 92, a = i / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 28; i++) { const r = i % 2 ? 54 : 82, a = i / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    halftone(c, 60, 20, 392, 152, 'rgba(120,200,80,.35)', 12, 4, 1); comicText(c, w, 256, 100, w.length > 5 ? 84 : 100, fill, null, { sx: 1 }); });
FX2.flash = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,210,60,.95)'); g.addColorStop(1, 'rgba(255,120,20,0)'); c.fillStyle = g; c.beginPath();
  for (let k = 0; k < 16; k++) { const r = k % 2 ? 26 : 62, a = k / 16 * TAU; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.fill(); });

// ======================= DEAD STREETS: Harold, Mavis, weapons, barricades, gates, the boss, the water taxi, stages, HUD, input, audio, bot =======================
buildCity();
const HAROLD = buildHero(); scene.add(HAROLD.root); HAROLD.swR.scale.setScalar(0.001); // the cane is stowed tonight
const MAVIS = buildHero({ wife: true }); scene.add(MAVIS.root); MAVIS.swR.visible = true;
const GUN_MAT = toonMat();
const WEAP = [
  { id: 'pistol', name: 'PISTOL', dmg: 20, rate: 4.2, spread: 0.035, pellets: 1, mag: 12, maxRes: Infinity, reload: 0.9, range: 22, pierce: 1, kick: 1.2, shake: 0.05, col: '#ffe08a' },
  { id: 'shotgun', name: 'PUMP SHOTGUN', dmg: 15, rate: 1.35, spread: 0.24, pellets: 8, mag: 6, maxRes: 48, reload: 1.5, range: 12, pierce: 2, kick: 3.2, shake: 0.22, col: '#ffcf5a' },
  { id: 'smg', name: 'CHOPPER SMG', dmg: 12, rate: 11, spread: 0.085, pellets: 1, mag: 40, maxRes: 320, reload: 1.3, range: 20, pierce: 1, kick: 0.9, shake: 0.06, col: '#fff0a0' },
  { id: 'harpoon', name: 'HARPOON GUN', dmg: 95, rate: 1.1, spread: 0, pellets: 1, mag: 3, maxRes: 24, reload: 1.7, range: 26, pierce: 99, kick: 5, shake: 0.3, col: '#e8f8ff' },
];
// the guns: merged toon parts on Harold's facing group, barrel along +z (the arms are posed to hold them)
const GUNS = WEAP.map((w, i) => { const P = [];
  if (i === 0) P.push({ g: G.box(0.08, 0.12, 0.34), c: '#2a2a30', z: 0.12 }, { g: G.box(0.07, 0.18, 0.09), c: '#5a3a24', y: -0.12, z: -0.02, r: [-0.25, 0, 0] });
  if (i === 1) P.push({ g: G.cyl(0.045, 0.045, 0.9, 8), c: '#2a2a30', z: 0.32, r: [Math.PI / 2, 0, 0] }, { g: G.box(0.11, 0.12, 0.3), c: '#8a5a2a', z: 0.24, y: -0.08 }, { g: G.box(0.09, 0.15, 0.34), c: '#8a5a2a', z: -0.2, y: -0.06 });
  if (i === 2) P.push({ g: G.box(0.1, 0.14, 0.52), c: '#2a2a30', z: 0.14 }, { g: G.cyl(0.11, 0.11, 0.08, 12), c: '#3a3a42', y: -0.13, z: 0.1, r: [0, 0, Math.PI / 2] }, { g: G.cyl(0.03, 0.03, 0.26, 6), c: '#1a1a1e', z: 0.5, r: [Math.PI / 2, 0, 0] });
  if (i === 3) P.push({ g: G.cyl(0.07, 0.07, 0.7, 8), c: '#e8d040', z: 0.2, r: [Math.PI / 2, 0, 0] }, { g: G.box(0.12, 0.16, 0.3), c: '#3a3a42', y: -0.06, z: -0.12 }, { g: G.cyl(0.02, 0.02, 0.5, 5), c: '#c8d0d8', z: 0.75, r: [Math.PI / 2, 0, 0] }, { g: G.cyl(0.0, 0.06, 0.14, 6), c: '#c8d0d8', z: 1.02, r: [Math.PI / 2, 0, 0] });
  const m = geoMesh(P, GUN_MAT); m.position.set(0.02, 0.98, 0.42); m.visible = i === 0; HAROLD.root.add(m); return m; });
const MUZZLE = [0.5, 1.15, 0.7, 1.2];

// ---------------- state ----------------
const PL = { x: 0, z: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: 0, hp: 100, max: 100, inv: 0, w: 0, owned: [true, false, false, false], mag: [12, 6, 40, 3], res: [Infinity, 0, 0, 0], cool: 0, reload: 0, bombs: 2, scrap: 12, shoveT: 0, ph: 0, moving: false, firing: false, recoil: 0, deadT: 0 };
const MV = { x: 0, z: 0, t: 0, swing: 0, cd: 0, target: null };
const S = { mode: 'title', stage: 0, t: 0, st: 0, score: 0, best: +(localStorage.getItem('tcdz_best') || 0), shake: 0, hs: 0, paused: false, combo: 0, comboT: 0, spawnAcc: 0, holdT: 0, cp: null, stats: null, fieldT: 0, botFieldDirty: true, taxi: 0, docked: false, won: false };
function newStats() { return { kills: 0, specials: 0, shots: 0, hits: 0, dealt: 0, taken: 0, built: 0, time: 0, bombs: 0 }; }
S.stats = newStats();

// ---------------- stages: W Pratt St -> hold Pratt & Light -> past the WTC -> hold President St -> Fells Point -> Broadway Pier finale ----------------
const W3 = { wA: 1, wB: 1, wC: 1 };
const STAGES = [
  { k: 'travel', name: 'W PRATT ST', obj: 'Fight east to Pratt & Light', to: [94, 0], start: [2, 0], rate: 2.2, cap: 140, mix: { ...W3 }, light: 0.0 },
  { k: 'hold', name: 'PRATT & LIGHT', obj: 'Hold Pratt & Light', at: [96, 0], start: [94, 1], dur: 40, rate: 4.6, cap: 230, mix: { ...W3, runner: 0.7 }, gate: 0, light: 0.15, tip: 'Spend scrap on the yellow BUILD spots: the alleys and Pratt west.' },
  { k: 'travel', name: 'E PRATT ST', obj: 'Past the World Trade Center to President St', to: [203, 3], start: [118, 2], rate: 3.0, cap: 260, mix: { ...W3, runner: 0.5, bloater: 0.4, spitter: 0.3 }, light: 0.35 },
  { k: 'hold', name: 'PRESIDENT ST', obj: 'Hold President St', at: [205, 4], start: [203, 4], dur: 45, rate: 7, cap: 360, mix: { ...W3, runner: 0.6, bloater: 0.4, spitter: 0.35, brute: 0.12 }, gate: 1, water: 0.12, light: 0.5, tip: 'Brutes chew through barricades. Harpoon them.' },
  { k: 'travel', name: 'FELLS POINT', obj: 'Run for Broadway Pier', to: [271, 30], start: [228, 3], rate: 4.2, cap: 340, mix: { ...W3, runner: 0.6, bloater: 0.4, spitter: 0.4, brute: 0.12 }, water: 0.1, light: 0.75 },
  { k: 'finale', name: 'BROADWAY PIER', obj: 'Survive till the water taxi docks', at: [271, 34], start: [271, 32], dur: 90, rate: 9, rate1: 22, cap: 560, mix: { ...W3, runner: 0.8, bloater: 0.45, spitter: 0.4, brute: 0.16 }, water: 0.28, light: 1, tip: 'Barricade the pier head. The harbor climbs out too.' },
];
const CRATES = [{ w: 1, x: 31, z: -2.5, st: 0 }, { w: 2, x: 128, z: 15.5, st: 2 }, { w: 3, x: 230, z: 15.5, st: 4 }];

// ---------------- pickups (pooled meshes) ----------------
const PICKS = [];
const PICK_MAT = toonMat();
const PICK_GEO = {
  scrap: mergeGeo([{ g: G.box(0.3, 0.06, 0.12), c: '#a0a4ac', r: [0, 0.4, 0] }, { g: G.box(0.22, 0.05, 0.1), c: '#8a6a4a', y: 0.06, r: [0, -0.5, 0.2] }, { g: G.cyl(0.05, 0.05, 0.06, 6), c: '#c8c8d0', x: 0.1, y: 0.1 }]),
  ammo: mergeGeo([{ g: G.box(0.6, 0.36, 0.4), c: '#4a6a3a', y: 0.18 }, { g: G.box(0.62, 0.08, 0.42), c: '#ffd23c', y: 0.3 }, { g: G.box(0.2, 0.06, 0.06), c: '#2a2a2e', y: 0.39 }]),
  cake: mergeGeo([{ g: G.cyl(0.36, 0.36, 0.04, 14), c: '#f2efe6', y: 0.02 }, { g: G.sph(0.24, 0.12, 0.24), c: '#d89a3a', y: 0.12 }, { g: G.sph(0.1, 0.05, 0.1), c: '#e8c060', x: 0.06, y: 0.2, z: 0.04 }]),
  crate: mergeGeo([{ g: G.box(1.0, 0.6, 0.6), c: '#8a6a3a', y: 0.3 }, { g: G.box(1.04, 0.1, 0.64), c: '#5a4026', y: 0.62 }, { g: G.box(0.1, 0.62, 0.64), c: '#5a4026', x: -0.3, y: 0.3 }, { g: G.box(0.1, 0.62, 0.64), c: '#5a4026', x: 0.3, y: 0.3 }]),
};
function pickMesh(kind) { let p = PICKS.find((q) => !q.on && q.kind === kind); if (!p) { const m = new THREE.Mesh(PICK_GEO[kind], PICK_MAT); m.castShadow = true; const h = new THREE.Mesh(PICK_GEO[kind], OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); m.add(h); scene.add(m); p = { m, kind, on: false }; PICKS.push(p); } return p; }
function dropPickup(kind, x, z, n = 1, w) { if (kind !== 'crate' && PICKS.filter((q) => q.on && q.kind === kind).length > 24) return; const p = pickMesh(kind); Object.assign(p, { on: true, x, z, n, w, t: 0, y: 0.6, vy: kind === 'crate' ? 0 : 3 });
  p.m.visible = true; p.m.position.set(x, groundY(x, z), z); if (kind === 'crate') { p.icon && p.m.remove(p.icon); p.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: WICON[w], depthTest: false, transparent: true })); p.icon.scale.set(2.2, 0.75, 1); p.icon.position.y = 1.6; p.icon.renderOrder = 18; p.m.add(p.icon); } return p; }
const WICON = WEAP.map((w) => canvasTex(384, 128, (g, W, H) => { g.fillStyle = '#14101f'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, W - 8, H - 8, 24) : g.rect(4, 4, W - 8, H - 8); g.fill(); g.fillStyle = '#ffd23c'; g.beginPath(); g.roundRect ? g.roundRect(12, 12, W - 24, H - 24, 18) : g.rect(12, 12, W - 24, H - 24); g.fill(); sText(g, w.name, W / 2, H / 2, W * 0.84, H * 0.5, SANS, '#14101f'); }, 384));
function clearPicks() { for (const p of PICKS) { p.on = false; p.m.visible = false; } }
function pickStep(dt) {
  for (const p of PICKS) { if (!p.on) continue; p.t += dt; const gy = groundY(p.x, p.z);
    if (p.vy !== 0 || p.y > 0) { p.vy -= 14 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
    const dx = PL.x - p.x, dz = PL.z - p.z, d = Math.hypot(dx, dz);
    if (p.kind === 'scrap' && d < 4.5 && S.mode === 'play') { p.x += dx / (d || 1) * dt * 9; p.z += dz / (d || 1) * dt * 9; }
    if (d < (p.kind === 'crate' ? 2.4 : 0.9) && (S.mode === 'play' || (S.mode === 'title' && p.kind !== 'crate'))) collect(p);
    if (p.kind !== 'crate' && p.t > 40) { p.on = false; p.m.visible = false; continue; }
    p.m.position.set(p.x, gy + p.y + (p.kind === 'crate' ? 0 : 0.15 + Math.sin(p.t * 4) * 0.08), p.z); if (p.kind !== 'crate') p.m.rotation.y += dt * 2.4; }
}
function collect(p) {
  p.on = false; p.m.visible = false;
  if (p.kind === 'scrap') { PL.scrap = Math.min(60, PL.scrap + p.n); SND.pick(0.7); return; }
  if (p.kind === 'cake') { const h = Math.min(PL.max - PL.hp, 35); PL.hp += h; pop(p.x, 1.6, p.z, 'CRAB CAKE +' + Math.round(h), 'gold'); SND.pick(1.2); return; }
  if (p.kind === 'ammo') { let any = false; for (let i = 1; i < 4; i++) if (PL.owned[i]) { PL.res[i] = Math.min(WEAP[i].maxRes, PL.res[i] + Math.ceil(WEAP[i].maxRes * 0.35)); any = true; } PL.bombs = Math.min(5, PL.bombs + 1); pop(p.x, 1.6, p.z, any ? 'AMMO + BOMB' : '+1 BOMB', 'gold'); SND.pick(1); return; }
  if (p.kind === 'crate') { const w = p.w; PL.owned[w] = true; PL.res[w] = WEAP[w].maxRes; PL.mag[w] = WEAP[w].mag; setWeapon(w); banner(WEAP[w].name + '<small>' + ['', 'CLOSE-RANGE CROWD CLEARER', 'HOLD TO SHRED', 'PIERCES THE WHOLE LINE'][w] + '</small>', 1.6); SND.pick(1.5); DZ.log.push('weapon:' + WEAP[w].id); }
}

// ---------------- barricades (one per slot: planks + sandbags; the horde chews on them) ----------------
const BAR_MAT = toonMat();
const GHOST_TEX = canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,210,60,.28)'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd23c'; c.lineWidth = 6; c.setLineDash([16, 10]); c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = 'rgba(255,210,60,.85)'; for (let x = 18; x < w - 10; x += 34) { c.beginPath(); c.moveTo(x, h - 12); c.lineTo(x + 14, 12); c.lineTo(x + 22, 12); c.lineTo(x + 8, h - 12); c.fill(); } }, 256);
const BARS = SLOTS.map((s, i) => { const L = Math.max(s.x1 - s.x0, s.z1 - s.z0), alongX = s.x1 - s.x0 > s.z1 - s.z0, P = [];
  for (let u = 0.4; u < L - 0.2; u += 0.62) P.push({ g: G.sph(0.34, 0.2, 0.26), c: ['#c8b48a', '#b8a47a', '#d0bc92'][Math.floor(u * 3) % 3], x: u - L / 2, y: 0.2 });
  for (let u = 0.5; u < L - 0.2; u += 0.75) P.push({ g: G.sph(0.32, 0.19, 0.25), c: '#bca880', x: u - L / 2 + 0.2, y: 0.52 });
  for (let k = 0; k < 3; k++) P.push({ g: G.box(L * 0.98, 0.18, 0.06), c: ['#9a7a4a', '#8a6a3a', '#a8885a'][k], y: 0.75 + k * 0.32, z: -0.18, r: [0, 0, (k - 1) * 0.06] });
  for (let u = 0.3; u < L; u += Math.max(1.4, L / 3)) P.push({ g: G.box(0.12, 1.7, 0.12), c: '#6a4a2a', x: u - L / 2, y: 0.85, z: -0.22 });
  const m = geoMesh(P, BAR_MAT), cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2; m.position.set(cx, groundY(cx, cz), cz); m.rotation.y = alongX ? 0 : Math.PI / 2; m.visible = false; scene.add(m);
  const gh = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? L : 1.2, alongX ? 1.2 : L), new THREE.MeshBasicMaterial({ map: GHOST_TEX, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  gh.rotation.x = -Math.PI / 2; gh.position.set(cx, groundY(cx, cz) + 0.04, cz); gh.renderOrder = 2; gh.visible = false; scene.add(gh);
  const k0 = []; for (let z = Math.floor(s.z0); z < Math.ceil(s.z1); z++) for (let x = Math.floor(s.x0); x < Math.ceil(s.x1); x++) k0.push(gi(x + 0.5, z + 0.5));
  return { i, s, st: s.st, cx, cz, hp: 0, max: 320, m, gh, cells: k0, alongX, L };
});
function damageBar(b, d) { if (b.hp <= 0) return; b.hp -= d; b.m.scale.y = 0.45 + 0.55 * clamp(b.hp / b.max, 0, 1); b.shake = 0.15; if (Math.random() < 0.3) SND.wood(); if (b.hp <= 0) breakBar(b); }
function breakBar(b) { b.hp = 0; b.m.visible = false; for (const k of b.cells) { GRID[k] = 0; BAR_AT[k] = -1; } spawnSprite(FXT.puff, new THREE.Vector3(b.cx, 0.8, b.cz), 2.2, 0.5); spawnSprite(FXT.words[3], new THREE.Vector3(b.cx, 2, b.cz), 1.6, 0.6, { kind: 'word', aspect: 2.6 }); SND.boom(false); S.botFieldDirty = true; DZ.log.push('barbroke:' + b.i); }
function buildBar(b, free) {
  if (!free) { if (b.hp > 0) { if (b.hp >= b.max || PL.scrap < 2) return false; PL.scrap -= 2; b.hp = Math.min(b.max, b.hp + 140); b.m.scale.y = 0.45 + 0.55 * b.hp / b.max; SND.build(); pop(b.cx, 1.8, b.cz, 'REPAIRED'); return true; }
    if (PL.scrap < 4) { pop(PL.x, 2.2, PL.z, 'NEED 4 SCRAP', 'bad'); SND.empty(); return false; } const s = b.s; if (PL.x > s.x0 - 0.5 && PL.x < s.x1 + 0.5 && PL.z > s.z0 - 0.5 && PL.z < s.z1 + 0.5) return false; PL.scrap -= 4; S.stats.built++; }
  b.hp = b.max; b.m.visible = true; b.m.scale.y = 1; for (const k of b.cells) { GRID[k] = 4; BAR_AT[k] = b.i; }
  for (const q of Z) if (q.on && !q.die && BAR_AT[gi(q.x, q.z)] === b.i) { if (b.alongX) q.z += q.z < PL.z ? -1.4 : 1.4; else q.x += q.x < PL.x ? -1.4 : 1.4; }
  if (!free) { SND.build(); spawnSprite(FXT.puff, new THREE.Vector3(b.cx, 0.6, b.cz), 1.8, 0.4); pop(b.cx, 1.8, b.cz, 'BARRICADE!', 'gold'); DZ.log.push('built:' + b.i); }
  S.botFieldDirty = true; return true;
}
function slotDist(b, x, z) { const s = b.s, dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1); return Math.hypot(dx, dz); }
function buildable(b) { return b.st === S.stage || b.st === S.stage + 1; }
function nearestSlot(x, z, r = 2.6) { let best = null, bd = r; for (const b of BARS) { if (!buildable(b)) continue; const d = slotDist(b, x, z); if (d < bd && (b.hp <= 0 || b.hp < b.max - 20)) { bd = d; best = b; } } return best; }
function resetBars(hps) { for (const b of BARS) { for (const k of b.cells) { if (GRID[k] === 4) GRID[k] = 0; BAR_AT[k] = -1; } b.hp = 0; b.m.visible = false; } if (hps) hps.forEach((h, i) => { if (h > 0) { buildBar(BARS[i], true); BARS[i].hp = h; } }); }

// ---------------- gates: chain-link road closures with ROAD CLOSED boards; they drop when a hold is survived ----------------
const LINK_TEX = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(200,205,215,.95)'; c.lineWidth = 4; for (let k = -w; k < w * 2; k += 22) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke(); } }, 128);
LINK_TEX.wrapS = LINK_TEX.wrapT = THREE.RepeatWrapping;
const CLOSED_TEX = SIGN_TEX('ROAD CLOSED', '#f2efe6', '#d23a3a');
const GATEG = GATES.map((g) => { const grp = new THREE.Group(), L = g.z1 - g.z0, P = [];
  for (let z = 0; z <= L; z += 3) P.push({ g: G.cyl(0.07, 0.07, 2.6, 6), c: '#5a5e66', x: 0, y: 1.3, z: z - L / 2 });
  P.push({ g: G.box(0.08, 0.08, L), c: '#5a5e66', y: 2.55 }, { g: G.box(0.08, 0.08, L), c: '#5a5e66', y: 0.15 });
  for (let z = 2; z < L - 1; z += 7) P.push({ g: G.box(0.2, 0.9, 2.6), c: '#f2efe6', x: 0.5, y: 0.6, z: z - L / 2 }, { g: G.box(0.22, 0.2, 2.62), c: '#ff7a1c', x: 0.5, y: 0.9, z: z - L / 2 }, { g: G.box(0.22, 0.2, 2.62), c: '#ff7a1c', x: 0.5, y: 0.5, z: z - L / 2 });
  const m = geoMesh(P, PROP_MAT); grp.add(m);
  const link = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.4), new THREE.MeshLambertMaterial({ map: LINK_TEX, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })); LINK_TEX.repeat.set(L / 1.2, 2); link.rotation.y = Math.PI / 2; link.position.y = 1.35; grp.add(link);
  for (let z = 4; z < L - 2; z += 10) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshLambertMaterial({ map: CLOSED_TEX })); s.position.set(-0.08, 1.7, z - L / 2); s.rotation.y = -Math.PI / 2; grp.add(s); }
  grp.position.set(g.x + 0.5, CURB, (g.z0 + g.z1) / 2); scene.add(grp); return { g, grp, open: false, t: 0 }; });
function setGate(i, open, instant) { const G_ = GATEG[i]; G_.open = open; G_.t = instant ? 1.5 : 0; setRect(G_.g.x, G_.g.z0, G_.g.x + 1, G_.g.z1, open ? 0 : 3); if (instant) G_.grp.position.y = open ? -3 : CURB; S.botFieldDirty = true; }
function gateStep(dt) { for (const G_ of GATEG) { if (G_.open && G_.grp.position.y > -3) { G_.t += dt; G_.grp.position.y = Math.max(-3, CURB - G_.t * G_.t * 2.2); } } }

// ---------------- THE HARBOR HULK (boss): a bloated harbor toad in crab-trap armour, dragging a ship's anchor ----------------
const BOSS = { on: false, dead: false, x: 0, z: 0, yaw: 0, hp: 3000, max: 3000, st: 'walk', t: 0, cd: { slam: 2, charge: 5, roar: 9 }, dir: [0, 0], phase: 1, ph: 0, flash: 0, J: null, dx: 0, dz: 0, think: 0 };
{ const mat = toonMat(); const d = THUG_D, J = skeleton(d, mat); const SK = '#4f7a76', SK2 = '#a8b890';
  part(J.hips, G.sph(0.3, 0.2, 0.24), '#3a4a5a', 0, 0.02, 0); part(J.hips, G.cyl(0.32, 0.32, 0.08, 12), '#d8a830', 0, 0.12, 0); // rope belt
  part(J.torso, G.sph(0.46, 0.44, 0.38), SK, 0, 0.3, 0.02); part(J.torso, G.sph(0.34, 0.32, 0.2), SK2, 0, 0.24, 0.2);
  for (let k = 0; k < 12; k++) { const a = k * 2.1, y = 0.1 + (k % 4) * 0.13; part(J.torso, G.sph(0.05, 0.04, 0.05), '#e8e4d0', Math.cos(a) * 0.44, y + 0.1, Math.sin(a) * 0.36, { outline: false }); } // barnacles
  for (const s of [-1, 1]) { // crab-trap pauldrons: wire cubes (frame bars) with an orange buoy
    const sh = J['sh' + (s > 0 ? 'L' : 'R')]; for (const [x, y, z, w, h, dd] of [[0, 0.16, 0, 0.42, 0.04, 0.42], [0, -0.04, 0, 0.42, 0.04, 0.42], [0.2, 0.06, 0.2, 0.04, 0.24, 0.04], [-0.2, 0.06, 0.2, 0.04, 0.24, 0.04], [0.2, 0.06, -0.2, 0.04, 0.24, 0.04], [-0.2, 0.06, -0.2, 0.04, 0.24, 0.04]]) part(sh, G.box(w, h, dd), '#c8c040', x, y + 0.08, z);
    part(sh, G.sph(0.12, 0.12, 0.12), SK, 0, 0, 0); part(sh, G.cap(0.13, d.upper - 0.05), SK, 0, -d.upper / 2, 0); }
  part(J.torso, G.sph(0.12, 0.16, 0.12), '#ff7a1c', 0.3, 0.62, -0.25); part(J.torso, G.box(0.02, 0.2, 0.02), '#f2efe6', 0.3, 0.62, -0.13);
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.3, 0.18, 0.26), SK, 0, 0.12, 0.08); part(head, G.box(0.42, 0.08, 0.05), '#2a0e12', 0, 0.06, 0.32, { outline: false });
  for (let k = -3; k <= 3; k++) part(head, G.box(0.03, 0.06, 0.02), '#f0ead0', k * 0.055, 0.1, 0.34, { outline: false }); // teeth
  part(head, G.sph(0.14, 0.14, 0.12), SK, 0.06, 0.26, 0.14); part(head, G.sph(0.11, 0.11, 0.06), '#ffe060', 0.06, 0.28, 0.22); part(head, G.box(0.1, 0.03, 0.02), '#c02020', 0.06, 0.28, 0.28, { outline: false }); // one big eye
  part(head, G.box(0.16, 0.03, 0.04), '#14101f', -0.14, 0.26, 0.24, { rot: [0, 0, 0.3] }); // the other: an eyepatch strap
  for (const k of ['L', 'R']) { part(J['el' + k], G.cap(0.12, d.fore - 0.06), SK, 0, -d.fore / 2, 0); part(J['ha' + k], G.sph(0.15, 0.11, 0.15), SK, 0, -0.04, 0);
    part(J['lg' + k], G.cap(0.14, d.thigh - 0.1), '#3a4a5a', 0, -d.thigh / 2, 0); part(J['kn' + k], G.cap(0.12, d.shin - 0.1), SK, 0, -d.shin / 2, 0); part(J['ft' + k], G.sph(0.16, 0.08, 0.22), SK, 0, -0.03, 0.07); }
  const w = J.swR = grp(J.haR, 0, -0.04, 0); w.userData.mat = mat; // the anchor
  part(w, G.cyl(0.05, 0.05, 1.0, 8), '#4a4e58', 0, 0.42, 0); part(w, G.tor(0.12, 0.03), '#4a4e58', 0, 0.98, 0); part(w, G.box(0.5, 0.06, 0.06), '#4a4e58', 0, 0.82, 0);
  part(w, G.tor(0.32, 0.06, Math.PI), '#4a4e58', 0, -0.02, 0, { rot: [0, 0, Math.PI] });
  J.root.scale.setScalar(2.5); J.root.visible = false; scene.add(J.root); BOSS.J = J; }
const RING = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.7, depthWrite: false, fog: false })); RING.visible = false; RING.renderOrder = 3; scene.add(RING);
const LANE = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.45, depthWrite: false, fog: false })); LANE.visible = false; LANE.renderOrder = 3; scene.add(LANE);
function bossSpawn() { Object.assign(BOSS, { on: true, dead: false, x: MAPX1 - 6, z: 16, hp: BOSS.max, st: 'walk', t: 0, phase: 1, cd: { slam: 2, charge: 4, roar: 10 } }); BOSS.J.root.visible = true; BOSS.J.root.position.set(BOSS.x, CURB, BOSS.z);
  say('HAROLD', 'Mavis... what in the Sam Hill is THAT?', 2.6); banner('THE HARBOR HULK<small>BOSS</small>', 2.2); SND.roar(); DZ.log.push('boss'); document.body.classList.add('bossOn'); }
function bossHit(dmg, src) { if (!BOSS.on || BOSS.dead) return; BOSS.hp -= dmg; BOSS.flash = 0.08; S.stats.dealt += dmg;
  if (BOSS.phase === 1 && BOSS.hp < BOSS.max * 0.5) { BOSS.phase = 2; say('MAVIS', "He's mad now, hon! Keep shootin'!", 2.2); SND.roar(); }
  if (BOSS.hp <= 0) { BOSS.hp = 0; BOSS.dead = true; BOSS.st = 'down'; BOSS.t = 0; S.score += 5000; S.hs = 0.25; S.shake = 1; RING.visible = LANE.visible = false;
    spawnSprite(FXT.words[1], new THREE.Vector3(BOSS.x, 4, BOSS.z), 3.2, 1.2, { kind: 'word', aspect: 2.6 }); spawnSprite(FXT.star, new THREE.Vector3(BOSS.x, 2.5, BOSS.z), 3, 0.5); pop(BOSS.x, 5, BOSS.z, 'HULK DOWN! +5000', 'gold');
    SND.boom(true); DZ.log.push('bossdown'); say('MAVIS', 'That\'s for the Harbor, ya big jagoff.', 2.6); document.body.classList.remove('bossOn'); } }
function bossStep(dt) {
  const B = BOSS; if (!B.on) return; const J = B.J; B.flash = Math.max(0, B.flash - dt); B.ph += dt;
  J.mat.userData.flash.value = B.flash > 0 ? 0.7 : 0;
  if (B.dead) { B.t += dt; applyPose(J, THUG_POSES.down(Math.min(1, B.t * 1.5), B.t > 0.7), 6, dt, false); if (B.t > 6) { J.root.position.y = CURB - (B.t - 6) * 0.5; if (B.t > 9) { B.on = false; J.root.visible = false; } } return; }
  const dx = PL.x - B.x, dz = PL.z - B.z, d = Math.hypot(dx, dz) || 1, P2 = B.phase === 2, spd = P2 ? 3.2 : 2.4;
  for (const k in B.cd) B.cd[k] -= dt; B.t += dt; let pose;
  if (B.st === 'walk') { B.think -= dt; if (B.think <= 0) { B.think = 0.15; steer(B); } let mx = B.dx, mz = B.dz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    let nx = B.x + mx * spd * dt, nz = B.z + mz * spd * dt; const k = gi(nx, nz); if (k >= 0 && GRID[k] === 4) { damageBar(BARS[BAR_AT[k]], 260 * dt); nx = B.x; nz = B.z; } else if (solidAt(nx, nz)) { if (!solidAt(nx, B.z)) nz = B.z; else if (!solidAt(B.x, nz)) nx = B.x; else { nx = B.x; nz = B.z; } }
    B.x = nx; B.z = nz; B.yaw += angTo(B.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 5); pose = THUG_POSES.run(B.ph, spd * 1.2, J);
    if (d < 4.4 && B.cd.slam <= 0) { B.st = 'slamW'; B.t = 0; SND.groan(0.6); }
    else if (d > 7 && d < 22 && B.cd.charge <= 0) { B.st = 'chargeW'; B.t = 0; B.dir = [dx / d, dz / d]; SND.roar(); }
    else if (B.cd.roar <= 0) { B.st = 'roar'; B.t = 0; SND.roar(); } }
  else if (B.st === 'slamW') { const tw = P2 ? 0.7 : 0.9; pose = THUG_POSES.windup(B.t / tw, J); RING.visible = true; RING.position.set(B.x, groundY(B.x, B.z) + 0.05, B.z); RING.scale.setScalar(0.5 + 4.5 * clamp(B.t / tw, 0, 1)); RING.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(B.t * 18));
    B.yaw += angTo(B.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
    if (B.t >= tw) { B.st = 'slam'; B.t = 0; RING.visible = false; S.shake = 0.9; SND.boom(true); spawnSprite(FX2.boom, new THREE.Vector3(B.x, 1.5, B.z), 4.5, 0.6, { kind: 'word', aspect: 2.2 }); spawnSprite(FXT.puff, new THREE.Vector3(B.x, 0.5, B.z), 6, 0.6);
      if (d < 5) hurtPlayer(30, 'HULK SLAM', B.x, B.z, 12); nearZ(B.x, B.z, 5, (q, ox, oz) => { const l = Math.hypot(ox, oz) || 1; q.kx += ox / l * 9; q.kz += oz / l * 9; });
      for (const b of BARS) if (b.hp > 0 && Math.hypot(b.cx - B.x, b.cz - B.z) < 6) damageBar(b, 160); } }
  else if (B.st === 'slam') { pose = THUG_POSES.attack(clamp(B.t / 0.5, 0, 1), J); if (B.t > 0.7) { B.st = 'walk'; B.cd.slam = P2 ? 1.6 : 2.4; } }
  else if (B.st === 'chargeW') { const tw = P2 ? 0.65 : 0.85; pose = THUG_POSES.windup(B.t / tw, J); LANE.visible = true; LANE.position.set(B.x, groundY(B.x, B.z) + 0.06, B.z); LANE.rotation.y = Math.atan2(B.dir[0], B.dir[1]); LANE.scale.set(1, 1, 15); LANE.material.opacity = 0.25 + 0.3 * Math.abs(Math.sin(B.t * 16));
    B.yaw = Math.atan2(B.dir[0], B.dir[1]); if (B.t >= tw) { B.st = 'charge'; B.t = 0; LANE.visible = false; B.hitP = false; } }
  else if (B.st === 'charge') { pose = THUG_POSES.run(B.ph * 1.6, 9, J); const nx = B.x + B.dir[0] * 11.5 * dt, nz = B.z + B.dir[1] * 11.5 * dt; const k = gi(nx, nz);
    if (k >= 0 && GRID[k] === 4) damageBar(BARS[BAR_AT[k]], 999);
    if (k < 0 || GRID[k] === 1 || GRID[k] === 2 || GRID[k] === 3) { B.st = 'dizzy'; B.t = 0; S.shake = 0.6; SND.boom(false); spawnSprite(FXT.dizzy, new THREE.Vector3(B.x, 5.6, B.z), 2.6, 1.6, { depth: true }); }
    else { B.x = nx; B.z = nz; } nearZ(B.x, B.z, 1.6, (q) => hitZ(q, 80, B.dir[0] * 10, B.dir[1] * 10, 'boss'));
    if (!B.hitP && Math.hypot(PL.x - B.x, PL.z - B.z) < 1.9) { B.hitP = true; hurtPlayer(26, 'HULK CHARGE', B.x, B.z, 14); }
    if (B.t > 1.15) { B.st = 'walk'; B.cd.charge = P2 ? 4.5 : 6.5; } }
  else if (B.st === 'dizzy') { pose = THUG_POSES.dizzy(B.t, J); if (B.t > 1.6) { B.st = 'walk'; B.cd.charge = P2 ? 4 : 6; } }
  else if (B.st === 'roar') { pose = THUG_POSES.windup(0.5 + Math.sin(B.t * 20) * 0.1, J); pose.neck = [-0.5, 0, 0]; if (B.t > 0.4 && !B.roared) { B.roared = true; for (let k = 0; k < (P2 ? 10 : 7); k++) { const a = k / 7 * TAU, x = B.x + Math.cos(a) * 5, z = B.z + Math.sin(a) * 5; if (!solidAt(x, z)) spawnZ('runner', x, z); } pop(B.x, 6, B.z, 'RRROOAAR!', 'bad'); }
    if (B.t > 1.3) { B.st = 'walk'; B.roared = false; B.cd.roar = P2 ? 11 : 15; } }
  J.root.position.set(B.x, groundY(B.x, B.z), B.z); J.root.rotation.y = B.yaw; applyPose(J, pose, 10, dt, false);
}

// ---------------- the water taxi (procedural: hull, cabin, canopy, a WATER TAXI board) ----------------
const TAXI = new THREE.Group(); scene.add(TAXI);
{ const P = [{ g: G.box(2.6, 0.9, 7.2), c: '#f2efe6', y: 0.2 }, { g: G.box(2.66, 0.22, 7.26), c: '#1f4aa0', y: 0.55 }, { g: G.cyl(0.0, 1.3, 1.8, 3), c: '#f2efe6', y: 0.2, z: 4.2, r: [Math.PI / 2, 0, 0], s: [1, 1, 0.7] },
  { g: G.box(2.3, 0.1, 5.6), c: '#9a7a5a', y: 0.68 }, { g: G.box(2.2, 1.0, 2.2), c: '#e8e4dc', y: 1.2, z: -1.6 }, { g: G.box(2.2, 0.5, 2.0), c: '#2a3a50', y: 1.5, z: -1.6 },
  { g: G.box(2.8, 0.14, 5.0), c: '#1f4aa0', y: 2.45, z: -0.4 }];
  for (const [x, z] of [[-1.25, -2.8], [1.25, -2.8], [-1.25, 1.9], [1.25, 1.9]]) P.push({ g: G.cyl(0.05, 0.05, 1.7, 6), c: '#c8c8d0', x, y: 1.55, z });
  for (const s of [-1, 1]) P.push({ g: G.tor(0.3, 0.07), c: '#ff7a1c', x: s * 1.36, y: 0.9, z: 1, r: [0, Math.PI / 2, 0] });
  TAXI.add(geoMesh(P)); const sgn = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshLambertMaterial({ map: SIGN_TEX('WATER TAXI', '#1f4aa0', '#f2efe6') })); sgn.position.set(1.42, 2.1, -0.4); sgn.rotation.y = Math.PI / 2; TAXI.add(sgn);
  const s2 = sgn.clone(); s2.position.x = -1.42; s2.rotation.y = -Math.PI / 2; TAXI.add(s2); TAXI.visible = false; }
const TAXI_FROM = new THREE.Vector3(340, WY + 0.15, 66), TAXI_TO = new THREE.Vector3(TAXI_DOCK.x, WY + 0.15, PIER.z1 + 1.45);

// ---------------- HUD (DOM; system fonts only) ----------------
const UI = {}; ['hud', 'hpF', 'hpT', 'score', 'kills', 'horde', 'obj', 'objT', 'wName', 'wAmmo', 'bombs', 'scrap', 'boss', 'bossF', 'prog', 'progMe', 'hint', 'pops', 'card', 'cardT', 'cardB', 'cardBtn', 'cardBtn2', 'ban', 'say', 'vign', 'title', 'startB', 'best',
  'joyL', 'knobL', 'joyR', 'knobR', 'bSwap', 'bBuild', 'bBomb', 'bShove', 'pauseB', 'muteB', 'viewB', 'wpn', 'combo', 'cross', 'crosshair', 'hitmarker'].forEach((k) => (UI[k] = $(k)));
function setText(el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } }
const POPS = []; function pop(x, y, z, txt, cls = '') { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = txt; UI.pops.appendChild(el); POPS.push({ el, p: new THREE.Vector3(x, y, z), t: 0 }); if (POPS.length > 16) { const o = POPS.shift(); o.el.remove(); } }
let banT = 0; function banner(html, d = 1.4) { UI.ban.innerHTML = html; UI.ban.classList.add('on'); banT = d; }
let sayT = 0; function say(who, txt, d = 2.2) { UI.say.innerHTML = '<b>' + who + '</b>' + txt; UI.say.classList.add('on'); sayT = d; }
function vign(c) { UI.vign.style.boxShadow = 'inset 0 0 120px 40px ' + c; UI.vign.style.opacity = '1'; clearTimeout(vign.t); vign.t = setTimeout(() => (UI.vign.style.opacity = '0'), 160); }
{ const L = 302; for (const st of [1, 3, 5]) { const at = STAGES[st].at, e = document.createElement('i'); e.style.left = ((at[0] + 22) / L * 100).toFixed(1) + '%'; UI.prog.appendChild(e); } }

// ---------------- audio: Toad City sfx + gunfire, groans, splats, a procedural horror loop ----------------
let MUTE = localStorage.getItem('tcdz_mute') === '1', MUS = null;
function tone(type, f0, f1, dur, vol, t0 = 0) { if (!AC || MUTE || AC.state !== 'running') return; const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS); o.start(t); o.stop(t + dur + 0.02); }
function noise(dur, f, q, vol, type = 'bandpass', t0 = 0) { if (!AC || MUTE || AC.state !== 'running') return; const t = AC.currentTime + t0, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(SFXBUS); s.start(t); s.stop(t + dur + 0.02); }
let sndGate = {}; const gate = (k, s) => { const n = performance.now(); if (sndGate[k] && n - sndGate[k] < s * 1000) return false; sndGate[k] = n; return true; };
const SND = {
  shot(w) { if (w === 0) { noise(0.12, 1800, 0.7, 0.32); tone('square', 180, 60, 0.08, 0.12); } else if (w === 1) { noise(0.3, 900, 0.5, 0.5, 'lowpass'); tone('sawtooth', 110, 40, 0.2, 0.18); } else if (w === 2) { if (gate('smg', 0.05)) { noise(0.07, 2400, 0.8, 0.22); tone('square', 220, 90, 0.05, 0.07); } } else { noise(0.25, 600, 0.6, 0.3); tone('triangle', 320, 80, 0.3, 0.14); noise(0.4, 4000, 0.4, 0.08, 'highpass', 0.05); } },
  empty() { tone('square', 1400, 0, 0.03, 0.05); }, reload() { tone('square', 700, 0, 0.04, 0.06); tone('square', 520, 0, 0.05, 0.06, 0.12); },
  hurt() { if (!MUTE) sfx('hurt'); }, hit() { if (gate('hit', 0.04)) noise(0.06, 700, 1.2, 0.12); },
  hitmarker(headshot = false) {
    if (!AC || MUTE || AC.state !== 'running') return;
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(headshot ? 2800 : 2000, t);
    o.frequency.exponentialRampToValueAtTime(headshot ? 1500 : 900, t + 0.04);
    g.gain.setValueAtTime(headshot ? 0.22 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(SFXBUS);
    o.start(t); o.stop(t + 0.045);
  },
  groan(p = 1) { if (!gate('groan', 0.35)) return; const f = rnd(70, 110) * p; tone('sawtooth', f, f * 0.7, 0.7, 0.05); noise(0.6, 380 * p, 3, 0.06); },
  spit() { noise(0.2, 1200, 2, 0.1); tone('sine', 300, 120, 0.2, 0.05); }, splat() { noise(0.25, 500, 1, 0.16, 'lowpass'); },
  boom(big) { noise(big ? 0.9 : 0.5, 220, 0.6, big ? 0.7 : 0.45, 'lowpass'); tone('sine', big ? 90 : 120, 30, big ? 0.7 : 0.4, 0.3); },
  build() { for (let k = 0; k < 3; k++) { tone('square', 340, 160, 0.06, 0.1, k * 0.09); noise(0.05, 1500, 1, 0.12, 'bandpass', k * 0.09); } }, wood() { if (gate('wood', 0.12)) { noise(0.08, 900, 1.5, 0.14); tone('square', 160, 80, 0.06, 0.06); } },
  pick(p = 1) { tone('square', 660 * p, 0, 0.06, 0.06); tone('square', 990 * p, 0, 0.1, 0.06, 0.07); }, roar() { tone('sawtooth', 70, 45, 1.1, 0.16); noise(1.0, 300, 0.8, 0.2, 'lowpass'); tone('square', 52, 40, 1.0, 0.08); },
  horn() { tone('sawtooth', 196, 0, 0.9, 0.08); tone('sawtooth', 247, 0, 0.9, 0.06); }, swing() { if (!MUTE) sfx('swing'); }, thud() { if (!MUTE) sfx('heavy'); },
};
function crosshairKick(wIndex) {
  const kick = wIndex === 1 ? 16 : wIndex === 3 ? 12 : wIndex === 2 ? 6 : 9;
  CH_SPREAD = Math.min(28, CH_SPREAD + kick);
}
function updateCrosshair(dt) {
  if (!FPS_MODE) return;
  const baseSpread = PL.moving ? 9 : 5;
  CH_SPREAD = damp(CH_SPREAD, baseSpread, 12, dt);
  if (UI.crosshair) UI.crosshair.style.setProperty('--ch-spread', CH_SPREAD.toFixed(1) + 'px');
}
function triggerHitmarker(isHeadshot = false) {
  hitmarkerT = 0.12;
  if (UI.hitmarker) {
    UI.hitmarker.classList.add('on');
    UI.hitmarker.classList.toggle('headshot', isHeadshot);
  }
  SND.hitmarker(isHeadshot);
}
function hitmarkerStep(dt) {
  if (hitmarkerT > 0) {
    hitmarkerT -= dt;
    if (hitmarkerT <= 0 && UI.hitmarker) UI.hitmarker.classList.remove('on', 'headshot');
  }
}
function setViewMode(fps) {
  FPS_MODE = !!fps;
  document.body.classList.toggle('tenderloin', FPS_MODE);
  document.body.classList.toggle('fps', FPS_MODE);
  if (UI.viewB) setText(UI.viewB, FPS_MODE ? 'VIEW: STREET' : 'VIEW: TOP');
  if (FPS_MODE) {
    CAM.initFps = false;
    CAM_YAW = PL.yaw;
    CAM_PITCH = 0;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    if (S.mode === 'play' && !document.body.classList.contains('touch')) {
      try { cv.requestPointerLock(); } catch (e) {}
    }
  } else {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    const port = VH() > VW() * 1.05;
    camera.fov = port ? 66 : 50;
    camera.updateProjectionMatrix();
    CAM.init = false;
  }
}
function toggleViewMode() { setViewMode(!FPS_MODE); }
function music(on) {
  if (!AC) return; if (!on) { if (MUS) { clearInterval(MUS.iv); MUS.g.gain.setTargetAtTime(0, AC.currentTime, 0.2); MUS = null; } return; } if (MUS || MUTE) return;
  const g = AC.createGain(); g.gain.value = 0; g.connect(AC.destination); g.gain.setTargetAtTime(0.45, AC.currentTime, 0.6);
  const bpm = 104, st = 60 / bpm / 4; let next = AC.currentTime + 0.1, step = 0; const ARP = [57, 60, 64, 60, 57, 63, 60, 55], BASS = [33, 33, 36, 31];
  const sched = () => { while (next < AC.currentTime + 0.25) { const i = step % 16, bar = Math.floor(step / 16) % 4, heat = clamp(ZALIVE / 300, 0, 1); try {
      if (i === 0 || i === 8 || (heat > 0.4 && i === 11)) { const o = AC.createOscillator(), k = AC.createGain(); o.frequency.setValueAtTime(130, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.14); k.gain.setValueAtTime(0.5, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.2); o.connect(k); k.connect(g); o.start(next); o.stop(next + 0.22); }
      if (i === 4 || i === 12) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 1300; k.gain.setValueAtTime(0.18 + heat * 0.1, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.14); s.connect(f); f.connect(k); k.connect(g); s.start(next); s.stop(next + 0.16); }
      if (i % 2 === 1) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 7500; k.gain.setValueAtTime(0.04 + heat * 0.04, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.04); s.connect(f); f.connect(k); k.connect(g); s.start(next); s.stop(next + 0.05); }
      if (i === 0) { const o = AC.createOscillator(), k = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (BASS[bar] - 69) / 12); f.type = 'lowpass'; f.frequency.setValueAtTime(200, next); f.frequency.linearRampToValueAtTime(700, next + st * 8); f.frequency.linearRampToValueAtTime(200, next + st * 16); k.gain.setValueAtTime(0.0001, next); k.gain.linearRampToValueAtTime(0.13, next + st * 2); k.gain.linearRampToValueAtTime(0.0001, next + st * 16); o.connect(f); f.connect(k); k.connect(g); o.start(next); o.stop(next + st * 16.2); }
      if (i % 2 === 0) { const o = AC.createOscillator(), k = AC.createGain(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (ARP[(i / 2 + bar) % 8] - 69 + 12) / 12); k.gain.setValueAtTime(0.035, next); k.gain.exponentialRampToValueAtTime(0.001, next + st * 1.8); o.connect(k); k.connect(g); o.start(next); o.stop(next + st * 2); }
    } catch (e) {} next += st; step++; } };
  MUS = { g, iv: setInterval(sched, 60) }; sched();
}
function setMute(m) { MUTE = m; localStorage.setItem('tcdz_mute', m ? '1' : '0'); setText(UI.muteB, m ? 'SOUND OFF' : 'SOUND ON'); if (m) music(false); else if (S.mode === 'play') music(true); }

// ---------------- input: keys + mouse, touch twin sticks + buttons, gamepad; the bot ----------------
const KEY = {}; const MOUSE = { x: 0, y: 0, down: false, used: false }; let BUILD_Q = 0, BOMB_Q = 0, SHOVE_Q = 0, SWAP_Q = 0, RELOAD_Q = 0, PICK_W = -1;
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); KEY[k] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault(); if (e.repeat) return;
  if (UI.card.classList.contains('on')) { if (k === ' ' || k === 'enter') cardPick(1); if (k === 'escape' || k === 'backspace') cardPick(2); return; }
  if (S.mode === 'title' && (k === ' ' || k === 'enter')) { startGame(); return; }
  if (k === 'f' || k === ' ') BUILD_Q++; if (k === 'g') BOMB_Q++; if (k === 'v') toggleViewMode(); if (k === 'shift' || k === 'c' || k === 'x') SHOVE_Q++; if (k === 'q' || k === 'e' || k === 'tab') SWAP_Q += k === 'q' ? -1 : 1; if (k === 'r') RELOAD_Q++;
  if (k >= '1' && k <= '4') PICK_W = +k - 1; if (k === 'p' || k === 'escape') togglePause(); if (k === 'm') setMute(!MUTE); });
addEventListener('keyup', (e) => { KEY[e.key.toLowerCase()] = false; });
const cv = $('gl');
cv.addEventListener('click', () => {
  if (FPS_MODE && S.mode === 'play' && !S.paused && document.pointerLockElement !== cv) {
    try { cv.requestPointerLock(); } catch (e) {}
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = (document.pointerLockElement === cv);
  document.body.classList.toggle('locked', locked);
});
addEventListener('mousemove', (e) => {
  if (FPS_MODE && document.pointerLockElement === cv) {
    const sens = 0.0022;
    const mx = e.movementX !== undefined ? e.movementX : (e.mozMovementX || 0);
    const my = e.movementY !== undefined ? e.movementY : (e.mozMovementY || 0);
    CAM_YAW += mx * sens;
    CAM_PITCH = clamp(CAM_PITCH - my * sens, -0.65, 0.65);
  }
});
cv.addEventListener('mousemove', (e) => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.used = true; });
cv.addEventListener('mousedown', (e) => { audioInit(); if (e.button === 0) MOUSE.down = true; if (e.button === 2) BOMB_Q++; MOUSE.used = true; MOUSE.x = e.clientX; MOUSE.y = e.clientY; });
addEventListener('mouseup', (e) => { if (e.button === 0) MOUSE.down = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => { SWAP_Q += e.deltaY > 0 ? 1 : -1; }, { passive: true });
function clearInput() { for (const k in KEY) KEY[k] = false; MOUSE.down = false; for (const J of [JL, JR]) { J.id = null; J.x = J.y = 0; } UI.knobL.style.transform = UI.knobR.style.transform = 'translate(-50%,-50%)'; }
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (S.mode === 'play' && !S.paused) togglePause(); } });
const JL = { id: null, x: 0, y: 0, cx: 0, cy: 0, el: UI.joyL, knob: UI.knobL }, JR = { id: null, x: 0, y: 0, cx: 0, cy: 0, el: UI.joyR, knob: UI.knobR };
function showTouch() { document.body.classList.add('touch'); }
if (TOUCH) showTouch();
for (const J of [JL, JR]) {
  J.el.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); J.id = e.pointerId; const r = J.el.getBoundingClientRect(); J.cx = r.left + r.width / 2; J.cy = r.top + r.height / 2; joyMove(J, e); J.el.setPointerCapture(e.pointerId); });
  J.el.addEventListener('pointermove', (e) => { if (e.pointerId === J.id) joyMove(J, e); });
  const end = (e) => { if (e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; J.knob.style.transform = 'translate(-50%,-50%)'; }; J.el.addEventListener('pointerup', end); J.el.addEventListener('pointercancel', end);
}
function joyMove(J, e) { const R = J.el.clientWidth * 0.36; let dx = e.clientX - J.cx, dy = e.clientY - J.cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } J.x = dx / R; J.y = dy / R; J.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
const tbtn = (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); showTouch(); audioInit(); fn(); el.classList.add('dn'); }); el.addEventListener('pointerup', () => el.classList.remove('dn')); el.addEventListener('pointercancel', () => el.classList.remove('dn')); };
tbtn(UI.bSwap, () => SWAP_Q++); tbtn(UI.bBuild, () => BUILD_Q++); tbtn(UI.bBomb, () => BOMB_Q++); tbtn(UI.bShove, () => SHOVE_Q++); tbtn(UI.wpn, () => SWAP_Q++);
if (UI.viewB) UI.viewB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleViewMode(); });
UI.pauseB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); togglePause(); });
UI.muteB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); setMute(!MUTE); });
UI.startB.addEventListener('click', (e) => { e.preventDefault(); audioInit(); startGame(); });
let cardCb = null, cardCb2 = null, cardT = 0;
UI.cardBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(1); });
UI.cardBtn2.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(2); });
function card(title, body, btn, cb, btn2, cb2) { UI.cardT.innerHTML = title; UI.cardB.innerHTML = body; UI.cardBtn.textContent = btn; cardCb = cb; UI.cardBtn2.style.display = btn2 ? '' : 'none'; if (btn2) UI.cardBtn2.textContent = btn2; cardCb2 = cb2 || null; UI.card.classList.add('on'); cardT = 0; DZ.log.push('card:' + title.replace(/<[^>]+>/g, ' ').trim()); }
function cardPick(n) { if (!UI.card.classList.contains('on') || cardT < 0.4) return; const cb = n === 2 ? cardCb2 : cardCb; if (!cb) return; UI.card.classList.remove('on'); cardCb = cardCb2 = null; cb(); }
function togglePause() { if (S.mode !== 'play') return; S.paused = !S.paused; document.body.classList.toggle('paused', S.paused); setText(UI.pauseB, S.paused ? 'RESUME' : 'PAUSE'); if (S.paused) { music(false); clearInput(); if (document.pointerLockElement) { try { document.exitPointerLock(); } catch(e) {} } } else music(true); }
let PADB = [];
const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();
function readInput() {
  const I = { mx: 0, mz: 0, ax: 0, az: 0, aim: false, fire: false, build: BUILD_Q > 0, bomb: BOMB_Q > 0, shove: SHOVE_Q > 0, swap: SWAP_Q, reload: RELOAD_Q > 0, pick: PICK_W };
  BUILD_Q = BOMB_Q = SHOVE_Q = SWAP_Q = RELOAD_Q = 0; PICK_W = -1;
  if (FPS_MODE) {
    let fwd = 0, strafe = 0;
    if (KEY.w) fwd += 1; if (KEY.s) fwd -= 1;
    if (KEY.d) strafe += 1; if (KEY.a) strafe -= 1;
    if (KEY.arrowleft) CAM_YAW -= 0.045; if (KEY.arrowright) CAM_YAW += 0.045;
    if (KEY.arrowup) CAM_PITCH = clamp(CAM_PITCH + 0.035, -0.65, 0.65); if (KEY.arrowdown) CAM_PITCH = clamp(CAM_PITCH - 0.035, -0.65, 0.65);
    const fx = Math.sin(CAM_YAW), fz = Math.cos(CAM_YAW);
    const rx = -Math.cos(CAM_YAW), rz = Math.sin(CAM_YAW);
    I.mx = fx * fwd + rx * strafe;
    I.mz = fz * fwd + rz * strafe;
    I.ax = fx; I.az = fz;
    I.aim = true; I.aimD = 25;
    I.fire = MOUSE.down || KEY.j || (KEY.enter && S.mode === 'play');
    if (JR.id !== null && Math.hypot(JR.x, JR.y) > 0.15) {
      CAM_YAW += JR.x * 0.05;
      CAM_PITCH = clamp(CAM_PITCH - JR.y * 0.035, -0.65, 0.65);
      I.fire = true;
    }
  } else {
    if (KEY.a) I.mx -= 1; if (KEY.d) I.mx += 1; if (KEY.w) I.mz -= 1; if (KEY.s) I.mz += 1;
    let kx = 0, kz = 0; if (KEY.arrowleft) kx -= 1; if (KEY.arrowright) kx += 1; if (KEY.arrowup) kz -= 1; if (KEY.arrowdown) kz -= 1;
    if (kx || kz) { I.ax = kx; I.az = kz; I.aim = true; I.fire = true; }
    else if (KEY.j || KEY.enter && S.mode === 'play') { I.ax = Math.sin(PL.yaw); I.az = Math.cos(PL.yaw); I.aim = true; I.fire = true; I.assist = true; I.wide = true; }
    else if (MOUSE.used && !document.body.classList.contains('touch')) { _ndc.set(MOUSE.x / VW() * 2 - 1, -(MOUSE.y / VH()) * 2 + 1); _ray.setFromCamera(_ndc, camera); if (_ray.ray.intersectPlane(_pl, _hit)) { I.ax = _hit.x - PL.x; I.az = _hit.z - PL.z; I.aim = true; I.aimD = Math.hypot(I.ax, I.az); } I.fire = MOUSE.down; }
    if (JR.id !== null && Math.hypot(JR.x, JR.y) > 0.25) { I.ax = JR.x; I.az = JR.y; I.aim = true; I.fire = true; I.assist = true; }
  }
  if (JL.id !== null && Math.hypot(JL.x, JL.y) > 0.15) {
    if (FPS_MODE) {
      const fx = Math.sin(CAM_YAW), fz = Math.cos(CAM_YAW);
      const rx = -Math.cos(CAM_YAW), rz = Math.sin(CAM_YAW);
      I.mx += fx * (-JL.y) + rx * JL.x;
      I.mz += fz * (-JL.y) + rz * JL.x;
    } else {
      I.mx += JL.x; I.mz += JL.y;
    }
  }
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const gp of pads) { if (!gp || !gp.connected) continue; const ax = gp.axes, bt = gp.buttons.map((b) => b.pressed);
    if (FPS_MODE) {
      if (Math.hypot(ax[0], ax[1]) > 0.2) {
        const fx = Math.sin(CAM_YAW), fz = Math.cos(CAM_YAW);
        const rx = -Math.cos(CAM_YAW), rz = Math.sin(CAM_YAW);
        I.mx += fx * (-ax[1]) + rx * ax[0];
        I.mz += fz * (-ax[1]) + rz * ax[0];
      }
      if (Math.hypot(ax[2] || 0, ax[3] || 0) > 0.2) {
        CAM_YAW += (ax[2] || 0) * 0.05;
        CAM_PITCH = clamp(CAM_PITCH - (ax[3] || 0) * 0.035, -0.65, 0.65);
      }
    } else {
      if (Math.hypot(ax[0], ax[1]) > 0.2) { I.mx += ax[0]; I.mz += ax[1]; } if (Math.hypot(ax[2] || 0, ax[3] || 0) > 0.3) { I.ax = ax[2]; I.az = ax[3]; I.aim = true; I.fire = true; I.assist = true; }
    }
    if (bt[7]) I.fire = true; const edge = (i) => bt[i] && !PADB[i];
    if (edge(0)) { if (UI.card.classList.contains('on')) cardPick(1); else if (S.mode === 'title') startGame(); else I.build = true; } if (edge(1)) { if (UI.card.classList.contains('on')) cardPick(2); else I.bomb = true; }
    if (edge(2)) I.reload = true; if (edge(3) || edge(5)) I.swap = 1; if (edge(4)) I.swap = -1; if (edge(6)) I.shove = true; if (edge(9)) togglePause(); PADB = bt; break; }
  if (BOTQ) botThink(I);
  const ml = Math.hypot(I.mx, I.mz); if (ml > 1) { I.mx /= ml; I.mz /= ml; } return I;
}

// ---------------- Harold: move, aim, shoot, reload, bomb, shove, build ----------------
const TRC_N = 72, TRC = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, fog: false }), TRC_N);
TRC.count = 0; TRC.frustumCulled = false; TRC.renderOrder = 8; scene.add(TRC); TRC.setColorAt(0, new THREE.Color(1, 1, 1)); const TRCS = []; for (let i = 0; i < TRC_N; i++) TRCS.push({ on: false, a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0, w: 0.05, c: new THREE.Color() });
function tracer(ax, ay, az, bx, by, bz, w, col) { const t = TRCS.find((q) => !q.on) || TRCS[0]; t.on = true; t.a.set(ax, ay, az); t.b.set(bx, by, bz); t.t = 0.07; t.w = w; t.c.set(col); }
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tz = new THREE.Vector3(0, 0, 1);
function tracerDraw(dt) { let n = 0; for (const t of TRCS) { if (!t.on) continue; t.t -= dt; if (t.t <= 0) { t.on = false; continue; } const u = 1 - t.t / 0.07; _tv.subVectors(t.b, t.a); const L = _tv.length(); _tv.normalize(); _tq.setFromUnitVectors(_tz, _tv);
  const st = _ts.copy(t.a).addScaledVector(_tv, L * u * 0.6); _tm.compose(st, _tq, new THREE.Vector3(t.w, t.w, L * (1 - u * 0.6))); TRC.setMatrixAt(n, _tm); TRC.setColorAt(n, t.c); n++; }
  TRC.count = n; TRC.instanceMatrix.needsUpdate = true; if (TRC.instanceColor) TRC.instanceColor.needsUpdate = true; }
const BOMBS = []; const BOMB_MAT = toonMat(); for (let i = 0; i < 6; i++) { const m = geoMesh([{ g: G.cyl(0.13, 0.13, 0.32, 10), c: '#d23a3a' }, { g: G.cyl(0.135, 0.135, 0.08, 10), c: '#ffd23c', y: 0.16 }, { g: G.box(0.2, 0.12, 0.01), c: '#2a5aa8', z: 0.135 }], BOMB_MAT); m.visible = false; scene.add(m); BOMBS.push({ m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), fuse: 0 }); }
function setWeapon(i) { if (!PL.owned[i]) return; PL.w = i; PL.reload = 0; PL.cool = Math.max(PL.cool, 0.15); GUNS.forEach((g, k) => (g.visible = k === i)); SND.reload(); }
function reload() { const w = WEAP[PL.w]; if (PL.reload > 0 || PL.mag[PL.w] >= w.mag || PL.res[PL.w] <= 0) return; PL.reload = w.reload; SND.reload(); }
function fire(I) {
  const w = WEAP[PL.w]; if (PL.reload > 0 || PL.cool > 0) return;
  if (PL.mag[PL.w] <= 0) { if (PL.res[PL.w] > 0) reload(); else { SND.empty(); PL.cool = 0.25; const nb = [3, 2, 1, 0].find((k) => PL.owned[k] && (PL.mag[k] > 0 || PL.res[k] > 0)); if (nb !== undefined && nb !== PL.w) setWeapon(nb); } return; }
  PL.mag[PL.w]--; PL.cool = 1 / w.rate; S.stats.shots++; PL.recoil = 1; S.shake = Math.max(S.shake, w.shake); SND.shot(PL.w);
  if (FPS_MODE) {
    const recoilP = (PL.w === 1 ? 0.075 : PL.w === 3 ? 0.11 : PL.w === 2 ? 0.022 : 0.04);
    const recoilY = (PL.w === 1 ? 0.03 : PL.w === 3 ? 0.04 : 0.015);
    CAM_RECOIL.pitch += recoilP;
    CAM_RECOIL.yaw += (Math.random() - 0.5) * recoilY;
    CAM_RECOIL.roll += (Math.random() - 0.5) * 0.015;
    CAM_RECOIL.kickZ += (PL.w === 1 ? 0.12 : PL.w === 3 ? 0.18 : 0.06);
    crosshairKick(PL.w);
  }
  const yaw = PL.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), mz = MUZZLE[PL.w];
  const ox = PL.x + sy * mz + cy * 0.02, oz = PL.z + cy * mz - sy * 0.02, oy = 1.0 + groundY(PL.x, PL.z);
  spawnSprite(FX2.flash, new THREE.Vector3(ox, oy, oz), PL.w === 1 ? 1.3 : 0.8, 0.06, { rot: Math.random() * TAU });
  muzzleLight.position.set(ox, oy, oz);
  muzzleLight.color.set(PL.w === 3 ? '#9fe0ff' : '#ffb838');
  muzzleLight.intensity = (PL.w === 1 ? 9.0 : PL.w === 3 ? 14.0 : PL.w === 2 ? 4.5 : 6.5);
  let anyHit = false;
  for (let p = 0; p < w.pellets; p++) {
    const a = yaw + (Math.random() - 0.5) * 2 * w.spread, dx = Math.sin(a), dz = Math.cos(a);
    const dy = FPS_MODE ? Math.sin(CAM_PITCH) + (Math.random() - 0.5) * w.spread : 0;
    let R = w.range;
    for (let s = 0.5; s < R; s += 0.5) if (wallAt(ox + dx * s, oz + dz * s)) { R = s; break; }
    const hits = [];
    for (const q of Z) {
      if (!q.on || q.die || q.climb > 0.5) continue;
      const rx = q.x - ox, rz = q.z - oz, t = rx * dx + rz * dz;
      if (t < 0 || t > R) continue;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp < q.t.r * (q.t.scale > 1 ? 1 : 1.05) + 0.12) {
        const hitY = oy + dy * t;
        const qBaseY = groundY(q.x, q.z);
        const qH = 1.6 * q.t.scale;
        const isHeadshot = hitY >= (qBaseY + qH * 0.72);
        hits.push([t, q, isHeadshot]);
      }
    }
    hits.sort((u, v) => u[0] - v[0]); let end = R, n = 0, bossT = Infinity;
    if (BOSS.on && !BOSS.dead) { const rx = BOSS.x - ox, rz = BOSS.z - oz, t = rx * dx + rz * dz; if (t > 0 && t < R && Math.abs(rx * dz - rz * dx) < 1.5) bossT = t; }
    for (const [t, q, isHeadshot] of hits) {
      if (t > bossT) break;
      let dmg = w.dmg * (PL.w === 1 ? clamp(1.4 - t / w.range, 0.45, 1.3) : 1);
      if (isHeadshot) dmg *= 1.75;
      hitZ(q, dmg, dx * w.kick, dz * w.kick, 'bullet', isHeadshot);
      anyHit = true;
      triggerHitmarker(isHeadshot);
      SND.hit();
      if (Math.random() < 0.35) goo(q.x + dx * 0.6, q.z + dz * 0.6, 0.45);
      if (++n >= w.pierce) { end = t; break; }
    }
    if (n < w.pierce && bossT < Infinity) {
      bossHit(w.dmg * (PL.w === 3 ? 1.6 : 1), 'bullet');
      end = bossT;
      anyHit = true;
      triggerHitmarker(false);
      SND.hit();
    }
    tracer(ox, oy, oz, ox + dx * end, oy + dy * end, oz + dz * end, PL.w === 3 ? 0.07 : PL.w === 1 ? 0.035 : 0.045, w.col);
    if (end < R - 0.01 && n === 0 && bossT === Infinity) {}
    else if (end >= R - 0.01 && R < w.range) spawnSprite(FXT.puff, new THREE.Vector3(ox + dx * R, oy + dy * R, oz + dz * R), 0.5, 0.25);
  }
  if (anyHit) S.stats.hits++;
}
function throwBomb(tx, tz) { if (PL.bombs <= 0) { SND.empty(); pop(PL.x, 2.2, PL.z, 'NO BOMBS', 'bad'); return; } const b = BOMBS.find((q) => !q.on); if (!b) return; PL.bombs--; S.stats.bombs++;
  let dx = tx - PL.x, dz = tz - PL.z; let d = Math.hypot(dx, dz) || 1; const D = clamp(d, 3, 10); dx /= d; dz /= d; const T_ = 0.75;
  b.on = true; b.m.visible = true; b.p.set(PL.x, 1.4 + groundY(PL.x, PL.z), PL.z); b.v.set(dx * D / T_, (0.3 - 1.4 + 0.5 * 16 * T_ * T_) / T_, dz * D / T_); b.fuse = 0; SND.swing(); }
function bombStep(dt) { for (const b of BOMBS) { if (!b.on) continue; if (b.fuse > 0) { b.fuse -= dt; b.m.rotation.y += dt * 20; if (b.fuse <= 0) { b.on = false; b.m.visible = false; explode(b.p.x, b.p.z, 4.6, 160, GOD ? 0 : 10, 'bomb'); } continue; }
  b.v.y -= 16 * dt; b.p.addScaledVector(b.v, dt); if (wallAt(b.p.x, b.p.z)) { b.v.x *= -0.4; b.v.z *= -0.4; b.p.addScaledVector(b.v, dt * 2); } b.m.position.copy(b.p); b.m.rotation.x += dt * 9; const gy = groundY(b.p.x, b.p.z) + 0.15;
  if (b.p.y <= gy) { b.p.y = gy; b.fuse = 0.45; b.v.set(0, 0, 0); SND.thud(); } } }
function shove() { if (PL.shoveT > 0) return; PL.shoveT = 0.65; SND.swing(); const fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw); let n = 0;
  nearZ(PL.x, PL.z, 2.1, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 1; if ((dx * fx + dz * fz) / d < -0.2) return; hitZ(q, 14, dx / d * 11, dz / d * 11, 'shove'); q.atk = Math.max(q.atk, 0.9); n++; });
  if (n) spawnSprite(FX2.shove, new THREE.Vector3(PL.x + fx * 1.2, 1.6, PL.z + fz * 1.2), 1.2, 0.4, { kind: 'word', aspect: 2.2 }); }
function hurtPlayer(d, why, sx, sz, kb = 3) {
  if (GOD || PL.inv > 0 || S.mode !== 'play') return; PL.hp -= d; PL.inv = 0.4; S.stats.taken += d; S.shake = Math.max(S.shake, 0.35); vign('rgba(200,30,40,.8)'); SND.hurt();
  const dx = PL.x - sx, dz = PL.z - sz, l = Math.hypot(dx, dz) || 1; PL.kx += dx / l * kb; PL.kz += dz / l * kb;
  if (Math.random() < 0.25 || d >= 20) spawnSprite(FX2.chomp, new THREE.Vector3(PL.x, 2.2, PL.z), 1.1, 0.4, { kind: 'word', aspect: 2.2 });
  if (PL.hp <= 0) { PL.hp = 0; die(why); } else if (PL.hp < 30 && gate('lowhp', 6)) say('MAVIS', ['Harold! Eat a crab cake!', 'You\'re bleedin\', hon!', 'Don\'t you die on me, Harold!'][Math.floor(Math.random() * 3)], 2);
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
}
const blockedC = (x, z, r) => solidAt(x + r, z) || solidAt(x - r, z) || solidAt(x, z + r) || solidAt(x, z - r);
function playerStep(dt, I) {
  PL.inv = Math.max(0, PL.inv - dt); PL.cool = Math.max(0, PL.cool - dt); PL.shoveT = Math.max(0, PL.shoveT - dt); PL.recoil = Math.max(0, PL.recoil - dt * 6);
  if (PL.reload > 0) { PL.reload -= dt; if (PL.reload <= 0) { const w = WEAP[PL.w], need = w.mag - PL.mag[PL.w], take = Math.min(need, PL.res[PL.w]); PL.mag[PL.w] += take; if (PL.res[PL.w] !== Infinity) PL.res[PL.w] -= take; } }
  const spd = (PL.firing ? 4.4 : 5.2);
  PL.vx = damp(PL.vx, I.mx * spd, 12, dt); PL.vz = damp(PL.vz, I.mz * spd, 12, dt);
  // the crowd presses in
  let px = 0, pz = 0; nearZ(PL.x, PL.z, 0.42, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 0.01, push = (0.42 + q.t.r - d) / d; px -= dx * push; pz -= dz * push; q.x += dx * push * 0.3; q.z += dz * push * 0.3; });
  const mvx = PL.vx + PL.kx + px * 3, mvz = PL.vz + PL.kz + pz * 3; PL.kx = damp(PL.kx, 0, 8, dt); PL.kz = damp(PL.kz, 0, 8, dt);
  const nx = PL.x + mvx * dt, nz = PL.z + mvz * dt; if (!blockedC(nx, PL.z, 0.34)) PL.x = nx; if (!blockedC(PL.x, nz, 0.34)) PL.z = nz;
  PL.moving = Math.hypot(PL.vx, PL.vz) > 0.5; if (PL.moving) PL.ph += dt * Math.hypot(PL.vx, PL.vz) * 1.7;
  // aim: explicit aim > aim assist > move direction
  if (FPS_MODE) {
    PL.yaw = CAM_YAW;
  } else {
    let ay = null; if (I.aim && Math.hypot(I.ax, I.az) > 0.01) { ay = I.wide && PL.moving ? Math.atan2(PL.vx, PL.vz) : Math.atan2(I.ax, I.az);
      if (I.assist) { let best = null, bs = I.wide ? 0.9 : 0.22; for (const q of Z) { if (!q.on || q.die || q.climb > 0.5) continue; const dx = q.x - PL.x, dz = q.z - PL.z, d = Math.hypot(dx, dz); if (d > 14) continue; const da = Math.abs(angTo(ay, Math.atan2(dx, dz))); const s = da + d * 0.008; if (s < bs) { bs = s; best = Math.atan2(dx, dz); } } if (best !== null) ay = best; } }
    else if (PL.moving) ay = Math.atan2(PL.vx, PL.vz);
    if (ay !== null) PL.yaw += angTo(PL.yaw, ay) * Math.min(1, dt * (I.aim ? 22 : 10));
  }
  PL.firing = !!I.fire && I.aim; if (PL.firing) fire(I);
  if (I.swap) { const n = 4; let w = PL.w; for (let k = 0; k < n; k++) { w = (w + (I.swap > 0 ? 1 : -1) + n) % n; if (PL.owned[w]) break; } if (w !== PL.w) setWeapon(w); }
  if (I.pick >= 0 && PL.owned[I.pick] && I.pick !== PL.w) setWeapon(I.pick);
  if (I.reload) reload(); if (I.shove) shove();
  if (I.bomb) { const tx = I.aim && I.aimD ? PL.x + I.ax : PL.x + Math.sin(PL.yaw) * 7, tz = I.aim && I.aimD ? PL.z + I.az : PL.z + Math.cos(PL.yaw) * 7; throwBomb(tx, tz); }
  if (I.build) { const b = nearestSlot(PL.x, PL.z); if (b) buildBar(b); else if (gate('nobuild', 1.2)) pop(PL.x, 2.2, PL.z, 'NO BUILD SPOT HERE', 'bad'); }
  if (PL.res[PL.w] > 0 && PL.mag[PL.w] === 0 && PL.reload <= 0) reload();
}
function haroldPose(dt) {
  const J = HAROLD; J.root.position.set(PL.x, groundY(PL.x, PL.z), PL.z); J.root.rotation.y = PL.yaw;
  let p; if (S.mode === 'dead' || (S.mode === 'over' && PL.hp <= 0)) { p = HERO_POSES.down(Math.min(1, PL.deadT * 1.6), PL.deadT > 0.6); applyPose(J, p, 8, dt, false); GUNS[PL.w].visible = false; return; }
  GUNS.forEach((g, k) => (g.visible = k === PL.w));
  if (PL.moving) { p = HERO_POSES.run(PL.ph * 0.6, 5); } else { p = HERO_POSES.idle(S.t); }
  // both hands on the gun, pointing down the facing (recoil kicks it up)
  const rk = PL.recoil * (PL.w === 1 || PL.w === 3 ? 0.35 : 0.12);
  const pitchOff = FPS_MODE ? CAM_PITCH * 0.45 : 0;
  p.torso = [0.12 - pitchOff, 0, 0]; p.neck = [-0.1 - pitchOff * 0.5, 0, 0]; p.hips = [0, 0, 0];
  p.shR = [-1.45 - rk - pitchOff, 0, 0.12]; p.elR = [-0.15, 0, 0]; p.shL = [-1.3 - rk - pitchOff, 0, -0.4]; p.elL = [-0.55, 0, 0];
  if (PL.reload > 0) { p.shL = [-0.6, 0, -0.3]; p.elL = [-1.4, 0, 0]; p.shR = [-0.9, 0, 0.1]; }
  if (PL.shoveT > 0.4) { p.shL = [-1.6, 0, 0.1]; p.elL = [0, 0, 0]; p.torso = [0.3, -0.3, 0]; }
  applyPose(J, p, 20, dt, false); GUNS[PL.w].position.z = 0.42 - rk * 0.4; GUNS[PL.w].rotation.x = -rk * 0.6;
  J.root.visible = !(PL.inv > 0 && Math.floor(PL.inv * 20) % 2 === 0);
}
function mavisStep(dt) {
  const J = MAVIS, fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw); MV.cd -= dt; MV.swing = Math.max(0, MV.swing - dt);
  let tx = PL.x - fx * 1.6 + fz * 1.2, tz = PL.z - fz * 1.6 - fx * 1.2; // at Harold's back-left
  // pick the nearest zombie to Harold within her reach and go swing at it
  let tgt = null, bd = 9; nearZ(PL.x, PL.z, 3.2, (q) => { const d = Math.hypot(q.x - MV.x, q.z - MV.z); if (d < bd) { bd = d; tgt = q; } });
  if (tgt) { tx = tgt.x - (tgt.x - MV.x) / (bd || 1) * 0.9; tz = tgt.z - (tgt.z - MV.z) / (bd || 1) * 0.9; }
  const dx = tx - MV.x, dz = tz - MV.z, d = Math.hypot(dx, dz); const sp = d > 6 ? 7 : d > 0.4 ? 4.8 : 0;
  if (d > 14) { MV.x = tx; MV.z = tz; }
  else if (sp) { const nx = MV.x + dx / d * sp * dt, nz = MV.z + dz / d * sp * dt; if (!blockedC(nx, MV.z, 0.3)) MV.x = nx; if (!blockedC(MV.x, nz, 0.3)) MV.z = nz; }
  let face = sp ? Math.atan2(dx, dz) : PL.yaw; if (tgt) face = Math.atan2(tgt.x - MV.x, tgt.z - MV.z);
  J.root.rotation.y += angTo(J.root.rotation.y, face) * Math.min(1, dt * 10);
  if (tgt && bd < 1.7 && MV.cd <= 0 && (S.mode === 'play' || S.mode === 'title')) { MV.cd = 0.95; MV.swing = 0.45; SND.swing(); const fx2 = Math.sin(J.root.rotation.y), fz2 = Math.cos(J.root.rotation.y);
    nearZ(MV.x + fx2 * 0.9, MV.z + fz2 * 0.9, 1.1, (q, ox, oz) => hitZ(q, 22, fx2 * 8, fz2 * 8, 'purse')); spawnSprite(FXT.words[(Math.random() * 7) | 0], new THREE.Vector3(MV.x + fx2, 1.8, MV.z + fz2), 1.0, 0.4, { kind: 'word', aspect: 2.6 });
    if (gate('mvsay', 9) && Math.random() < 0.5) say('MAVIS', ['Get off my Harold!', 'Not in my Harbor, hon!', 'I got a purse full of quarters, sweetie!', 'Back in your grave, ya jagoff!'][Math.floor(Math.random() * 4)], 1.8); }
  MV.t += dt; let p = MV.swing > 0 ? HERO_POSES.atk1(1 - MV.swing / 0.45) : sp ? HERO_POSES.run(MV.t, sp) : HERO_POSES.idle(MV.t); applyPose(J, p, 14, dt, false);
  J.root.position.set(MV.x, groundY(MV.x, MV.z), MV.z);
}

// ---------------- camera: twin-stick high angle, the city to the north, the harbor at your back ----------------
const CAM = { x: 0, z: 0, init: false, cine: null, initFps: false, fpsX: 0, fpsY: 0, fpsZ: 0 };
function camStep(dt) {
  CAM_RECOIL.pitch = damp(CAM_RECOIL.pitch, 0, 18, dt);
  CAM_RECOIL.yaw = damp(CAM_RECOIL.yaw, 0, 16, dt);
  CAM_RECOIL.roll = damp(CAM_RECOIL.roll, 0, 16, dt);
  CAM_RECOIL.kickZ = damp(CAM_RECOIL.kickZ, 0, 20, dt);
  const port = VH() > VW() * 1.05; let fov = port ? 66 : 50;
  if (S.mode === 'title') { const tx = PL.x + 6, tz = PL.z - 4; CAM.x = damp(CAM.x, tx, 2, dt); CAM.z = damp(CAM.z, tz, 2, dt); camera.position.set(CAM.x - 13, 6.5, CAM.z + 21); camera.lookAt(CAM.x + 4, 3.2, CAM.z - 2); fov = port ? 70 : 52; }
  else if (CAM.cine) { const c = CAM.cine; c.t += dt; c.pos.set(TAXI.position.x + 7, 5.5, TAXI.position.z + 11); c.lookTo.set(TAXI.position.x - 7, 1.2, TAXI.position.z - 1); camera.position.lerp(c.pos, 1 - Math.exp(-dt * 2)); c.look.lerp(c.lookTo, 1 - Math.exp(-dt * 2)); camera.lookAt(c.look); fov = port ? 66 : 52; }
  else if (FPS_MODE) {
    fov = 75;
    const gy = groundY(PL.x, PL.z);
    const fx = Math.sin(CAM_YAW), fz = Math.cos(CAM_YAW);
    const rx = -Math.cos(CAM_YAW), rz = Math.sin(CAM_YAW);
    let targetX = PL.x + rx * 0.38 - fx * 0.72;
    let targetZ = PL.z + rz * 0.38 - fz * 0.72;
    let targetY = gy + 1.76;
    if (solidAt(targetX, targetZ)) {
      targetX = PL.x + rx * 0.12;
      targetZ = PL.z + rz * 0.12;
    }
    if (!CAM.initFps) {
      CAM.fpsX = targetX; CAM.fpsY = targetY; CAM.fpsZ = targetZ;
      CAM.initFps = true;
    }
    CAM.fpsX = damp(CAM.fpsX, targetX, 22, dt);
    CAM.fpsY = damp(CAM.fpsY, targetY, 16, dt);
    CAM.fpsZ = damp(CAM.fpsZ, targetZ, 22, dt);
    const kick = CAM_RECOIL.kickZ;
    const cx = CAM.fpsX - fx * kick;
    const cy = CAM.fpsY;
    const cz = CAM.fpsZ - fz * kick;
    camera.position.set(cx, cy, cz);
    const cp = Math.cos(CAM_PITCH + CAM_RECOIL.pitch);
    const sp = Math.sin(CAM_PITCH + CAM_RECOIL.pitch);
    const dirX = Math.sin(CAM_YAW + CAM_RECOIL.yaw) * cp;
    const dirY = sp;
    const dirZ = Math.cos(CAM_YAW + CAM_RECOIL.yaw) * cp;
    _camTarget.set(cx + dirX * 20, cy + dirY * 20, cz + dirZ * 20);
    camera.lookAt(_camTarget);
    if (CAM_RECOIL.roll !== 0) camera.rotateZ(CAM_RECOIL.roll);
  }
  else {
    const lead = PL.firing ? 2.6 : 1.4, tx = PL.x + Math.sin(PL.yaw) * lead, tz = PL.z + Math.cos(PL.yaw) * lead * 0.7;
    if (!CAM.init) { CAM.x = tx; CAM.z = tz; CAM.init = true; } CAM.x = damp(CAM.x, tx, 4.5, dt); CAM.z = damp(CAM.z, tz, 4.5, dt);
    const off = port ? [0, 27, 19] : [0, 13.5, 14.5], sk = S.shake * 0.4;
    camera.position.set(CAM.x + off[0] + (Math.random() - 0.5) * sk, off[1] + (Math.random() - 0.5) * sk, CAM.z + off[2] + (Math.random() - 0.5) * sk); camera.lookAt(CAM.x, 0.8, CAM.z - (port ? 3.2 : 1.6));
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  sun.target.position.set(PL.x, 0, PL.z - 4); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60); sun.target.updateMatrixWorld();
}
function resize() { const w = VW(), h = VH(), dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25), lw = Math.round(w * dpr), lh = Math.round(h * dpr);
  renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); POST.uniforms.uHT.value = 5.2 * dpr; camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------------- spawning director ----------------
let CAND_E = [], CAND_W = [];
function updateFields() { computeField(FIELD, PL.x, PL.z, 8); CAND_E = []; CAND_W = [];
  for (const s of SPAWNS) { const k = gi(s.x, s.z); if (k < 0) continue; const f = FIELD[k]; if (s.k === 'edge') { if (f >= 26 && f <= 130) CAND_E.push(s); } else if (f >= 8 && f <= 40 && Math.hypot(s.x - PL.x, s.z - PL.z) > 6) CAND_W.push(s); } }
function pickType(mix) { let tot = 0; for (const k in mix) tot += mix[k]; let r = Math.random() * tot; for (const k in mix) { r -= mix[k]; if (r <= 0) return k; } return 'wA'; }
function spawnTick(dt) {
  const st = STAGES[S.stage]; let rate = st.rate, cap = st.cap;
  if (S.mode === 'title') { rate = 2.4; cap = 80; }
  if (st.k === 'finale') rate = lerp(st.rate, st.rate1, clamp(S.st / st.dur, 0, 1));
  if (DZ.hordeCap) cap = Math.max(cap, DZ.hordeCap);
  S.spawnAcc += rate * dt; let guard = 0;
  while (S.spawnAcc >= 1 && guard++ < 40) { S.spawnAcc -= 1; if (ZALIVE >= cap) { S.spawnAcc = 0; break; }
    const water = S.mode === 'play' && st.water && Math.random() < st.water && CAND_W.length; const list = water ? CAND_W : CAND_E; if (!list.length) break;
    const sp = list[(Math.random() * list.length) | 0]; const type = pickType(S.mode === 'title' ? W3 : st.mix); const n = water ? 1 : type === 'brute' ? 1 : 1 + ((Math.random() * 4) | 0);
    for (let k = 0; k < n; k++) { const x = sp.x + rnd(-1.2, 1.2), z = sp.z + rnd(-1.2, 1.2); if (solidAt(x, z)) continue; spawnZ(k === 0 ? type : pickType(W3), x, z, { climb: water }); }
    S.spawnAcc -= n - 1; }
}
DZ.spawnHorde = (n) => { DZ.hordeCap = n; let k = 0, guard = 0; while (ZALIVE < n && guard++ < n * 20) { const a = Math.random() * TAU, r = rnd(9, 36), x = PL.x + Math.cos(a) * r, z = PL.z + Math.sin(a) * r * 0.8; if (solidAt(x, z)) continue; if (spawnZ(['wA', 'wB', 'wC', 'wA', 'wB', 'wC', 'runner', 'bloater', 'spitter'][k++ % 9], x, z)) {} } return ZALIVE; };

// ---------------- the run: title (attract) -> intro card -> stages -> results; death -> retry checkpoint / restart ----------------
function stageSetup(i, fromCp) {
  S.stage = i; S.st = 0; S.holdT = 0; const st = STAGES[i];
  for (let g = 0; g < GATES.length; g++) { const open = g < (i >= 4 ? 2 : i >= 2 ? 1 : 0); if (GATEG[g].open !== open || fromCp) setGate(g, open, true); }
  setLight(st.light); CAM.init = false; S.botFieldDirty = true; DZ.log.push('stage:' + i);
  for (const c of CRATES) { if (!PL.owned[c.w] && c.st <= i + 1 && !PICKS.some((p) => p.on && p.kind === 'crate' && p.w === c.w)) dropPickup('crate', c.x, c.z, 1, c.w); }
  if (st.k === 'hold' || st.k === 'finale') { const [cx, cz] = st.at; dropPickup('ammo', cx - 3, cz + 2); dropPickup('ammo', cx + 3, cz - 2); dropPickup('cake', cx, cz + 3); }
  if (st.k === 'finale') { TAXI.visible = true; TAXI.position.copy(TAXI_FROM); S.docked = false; BOSS.on = false; BOSS.J.root.visible = false; document.body.classList.remove('bossOn'); }
  else { TAXI.visible = false; }
  banner(st.name + '<small>' + st.obj.toUpperCase() + '</small>', 2.0); if (st.tip) say('MAVIS', st.tip, 3.2);
}
function snapshot() { S.cp = { stage: S.stage, owned: PL.owned.slice(), mag: PL.mag.slice(), res: PL.res.slice(), bombs: PL.bombs, scrap: PL.scrap, score: S.score, hp: PL.hp, stats: Object.assign({}, S.stats), bars: BARS.map((b) => b.hp) }; }
function placeTeam(x, z) { PL.x = x; PL.z = z; PL.vx = PL.vz = PL.kx = PL.kz = 0; PL.yaw = Math.PI / 2; MV.x = x - 1.5; MV.z = z + 1.2; CAM.init = false; }
function resetWorld() { S.won = false; S.docked = false; clearHorde(); clearPicks(); BOSS.on = false; BOSS.dead = false; BOSS.J.root.visible = false; RING.visible = LANE.visible = false; for (const b of BOMBS) { b.on = false; b.m.visible = false; } CAM.cine = null; document.body.classList.remove('bossOn'); }
function startGame() {
  if (S.mode !== 'title' && S.mode !== 'over') return; audioInit(); try { AC && AC.resume(); } catch (e) {}
  UI.title.classList.remove('on'); document.body.classList.add('playing'); DZ.log.push('start');
  const st0 = clamp(+(Q.get('stage') || 0), 0, 5);
  Object.assign(PL, { hp: 100, w: 0, owned: [true, st0 >= 2, st0 >= 4, st0 >= 5], mag: [12, 6, 40, 3], res: [Infinity, st0 >= 2 ? 30 : 0, st0 >= 4 ? 200 : 0, st0 >= 5 ? 12 : 0], bombs: 2, scrap: 12 + st0 * 2, inv: 0, reload: 0, cool: 0 });
  S.score = 0; S.stats = newStats(); S.combo = 0; resetWorld(); resetBars(); setWeapon(0); S.mode = 'card';
  const go = () => { stageSetup(st0, true); placeTeam(...STAGES[st0].start); snapshot(); S.mode = 'play'; music(true); S.fieldT = 0; updateFields(); if (DZ.hordeQ) DZ.spawnHorde(DZ.hordeQ); };
  if (FAST || st0 > 0) { go(); return; }
  stageSetup(0, true); placeTeam(...STAGES[0].start);
  card('DEAD STREETS<small>TOAD CITY BALTIMORE · INNER HARBOR</small>', `<p>The Harbor's gone rotten. Get Harold and Mavis from <b>W Pratt St</b> to the <b>water taxi at Broadway Pier</b>.</p>
    <p class="tip"><span class="kb"><b>WASD</b> move · <b>mouse</b> aim + click fire (or <b>arrows</b>) · <b>F</b>/<b>SPACE</b> build · <b>G</b>/right-click bomb · <b>V</b> shove · <b>Q E 1-4</b> guns · <b>R</b> reload</span><span class="tc">Left stick: move · Right stick: aim + fire · BUILD on the yellow spots</span></p>`, 'LET\'S GO, HON ▶', go);
}
function retryCheckpoint() { const c = S.cp; if (!c) return; resetWorld(); Object.assign(PL, { hp: 100, owned: c.owned.slice(), mag: c.mag.slice(), res: c.res.slice(), bombs: Math.max(c.bombs, 2), scrap: Math.max(c.scrap, 8), inv: 1.2, reload: 0, cool: 0 });
  S.score = c.score; S.stats = Object.assign({}, c.stats); S.combo = 0; resetBars(c.bars); setWeapon(PL.owned.lastIndexOf(true)); stageSetup(c.stage, true); placeTeam(...STAGES[c.stage].start); S.mode = 'play'; music(true); updateFields(); DZ.log.push('retry:cp' + c.stage); }
function retryRun() { S.mode = 'over'; UI.card.classList.remove('on'); startGame(); }
function stageDone() {
  const st = STAGES[S.stage]; DZ.log.push('stagedone:' + S.stage);
  if (st.k === 'hold') { S.score += 1000; pop(PL.x, 2.6, PL.z, 'HELD! +1000', 'gold'); setGate(st.gate, true); SND.horn(); banner('GATE\'S OPEN<small>KEEP MOVING</small>', 1.6); say('HAROLD', ['The National Guard left the gate open! Move, Mavis!', 'There goes the fence. Go go go!'][st.gate], 2.4); }
  const n = S.stage + 1; stageSetup(n, false); snapshot();
}
function die(why) { if (S.mode !== 'play') return; S.mode = 'dead'; PL.deadT = 0; music(false); SND.roar(); S.deadWhy = why; DZ.log.push('dead:' + why); S.hs = 0.3; banner('BITTEN!<small>' + why + '</small>', 2); }
function saveBest() { if (S.score > S.best) { S.best = S.score; localStorage.setItem('tcdz_best', String(S.best)); return true; } return false; }
function statsHtml() { const s = S.stats, acc = s.shots ? Math.round(Math.min(1, s.hits / s.shots) * 100) : 0, m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  return `<div class="res"><span>TIME <b>${m}:${String(sec).padStart(2, '0')}</b></span><span>KILLS <b>${s.kills}</b></span><span>SPECIALS <b>${s.specials}</b></span><span>ACCURACY <b>${acc}%</b></span><span>BARRICADES <b>${s.built}</b></span><span>DAMAGE TAKEN <b>${Math.round(s.taken)}</b></span></div>`; }
function showDeath() { S.mode = 'over'; const nb = saveBest();
  card('YOU GOT BIT<small>' + (S.deadWhy || '') + ' · ' + STAGES[S.stage].name + '</small>', statsHtml() + `<p>Score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'RETRY CHECKPOINT', retryCheckpoint, 'RESTART RUN', retryRun); }
function winGame() { if (S.won) return; S.won = true; S.mode = 'win'; const tb = Math.max(0, Math.round(900 - S.stats.time) * 10); S.score += 2500 + tb; DZ.log.push('win'); SND.horn(); music(false);
  CAM.cine = { t: 0, pos: new THREE.Vector3(TAXI.position.x + 22, 13, TAXI.position.z - 14), look: new THREE.Vector3(PL.x, 1, PL.z), lookTo: new THREE.Vector3(170, 8, 62) };
  scene.fog.far = OUT_U.fogF.value = 330; scene.fog.near = OUT_U.fogN.value = 70;
  banner('ESCAPED!<small>THE WATER TAXI PULLS OUT</small>', 2.6); say('MAVIS', 'Next stop: anywhere but here, hon.', 2.8);
  setTimeout(() => { const nb = saveBest(); card('YOU MADE IT OUT<small>HAROLD + MAVIS ESCAPE THE INNER HARBOR</small>', statsHtml() + `<p>Escape bonus <b>+2,500</b> · Time bonus <b>+${tb.toLocaleString()}</b></p><p>Final score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'PLAY AGAIN', retryRun); S.mode = 'over'; }, FAST || BOTQ ? 1200 : 4200); }
function stageStep(dt) {
  const st = STAGES[S.stage]; S.st += dt;
  if (st.k === 'travel') { if (Math.hypot(PL.x - st.to[0], PL.z - st.to[1]) < 7) stageDone(); }
  else if (st.k === 'hold') { const inZone = Math.hypot(PL.x - st.at[0], PL.z - st.at[1]) < 16; if (inZone) S.holdT += dt; else if (gate('zone', 4)) pop(PL.x, 2.4, PL.z, 'BACK TO THE ZONE!', 'bad'); if (S.holdT >= (FAST ? 8 : st.dur)) stageDone(); }
  else if (st.k === 'finale') { S.holdT += dt; const u = clamp(S.holdT / st.dur, 0, 1);
    if (!BOSS.on && !BOSS.dead && S.holdT > (FAST ? 3 : 12)) bossSpawn();
    if (!S.docked) { TAXI.position.lerpVectors(TAXI_FROM, TAXI_TO, ease(u)); TAXI.rotation.y = lerp(Math.atan2(TAXI_TO.x - TAXI_FROM.x, TAXI_TO.z - TAXI_FROM.z), -Math.PI / 2, ease(clamp(u * 1.4 - 0.4, 0, 1)));
      if (u >= 1 && BOSS.dead) { S.docked = true; SND.horn(); banner('WATER TAXI!<small>GET ON BOARD</small>', 2); say('CAPTAIN', 'All aboard! Last boat outta the Harbor!', 2.4); DZ.log.push('docked'); }
      else if (u >= 1 && gate('notdock', 6)) say('CAPTAIN', "Can't dock with that THING on the pier!", 2.2); }
    if (S.docked && Math.abs(PL.x - TAXI_DOCK.x) < 6 && PL.z > PIER.z1 - 3) winGame(); }
  TAXI.position.y = WY + 0.15 + Math.sin(S.t * 1.6) * 0.08;
}

// ---------------- HUD update ----------------
function objTarget() { const st = STAGES[S.stage]; if (st.k === 'travel') return st.to; if (st.k === 'hold') return st.at; return S.docked ? [TAXI_DOCK.x, PIER.z1 - 1] : st.at; }
function hud() {
  const st = STAGES[S.stage]; UI.hpF.style.width = clamp(PL.hp / PL.max * 100, 0, 100).toFixed(1) + '%'; UI.hpF.parentNode.classList.toggle('low', PL.hp < 30); setText(UI.hpT, String(Math.ceil(PL.hp)));
  setText(UI.score, S.score.toLocaleString()); setText(UI.kills, String(S.stats.kills)); setText(UI.horde, String(ZALIVE));
  let obj = st.obj, tt = ''; if (st.k === 'hold') tt = Math.max(0, Math.ceil((FAST ? 8 : st.dur) - S.holdT)) + 's'; if (st.k === 'finale') { tt = S.docked ? 'BOARD!' : Math.max(0, Math.ceil(st.dur - S.holdT)) + 's'; if (S.docked) obj = 'Get on the water taxi!'; else if (BOSS.on && !BOSS.dead && S.holdT >= st.dur) obj = 'Kill the Harbor Hulk!'; }
  setText(UI.obj, obj); setText(UI.objT, tt); UI.objT.style.display = tt ? '' : 'none';
  const w = WEAP[PL.w]; setText(UI.wName, w.name); setText(UI.wAmmo, PL.reload > 0 ? 'RELOADING' : PL.mag[PL.w] + ' / ' + (PL.res[PL.w] === Infinity ? '∞' : PL.res[PL.w])); UI.wpn.classList.toggle('low', PL.mag[PL.w] === 0 && PL.reload <= 0);
  setText(UI.bombs, String(PL.bombs)); setText(UI.scrap, String(PL.scrap));
  if (BOSS.on && !BOSS.dead) UI.bossF.style.width = (BOSS.hp / BOSS.max * 100).toFixed(1) + '%';
  UI.progMe.style.left = clamp((PL.x + 22) / 302 * 100, 0, 100).toFixed(1) + '%';
  const sl = S.mode === 'play' ? nearestSlot(PL.x, PL.z, 3) : null; let hint = '';
  if (sl) hint = sl.hp > 0 ? (TOUCH ? 'BUILD' : 'F') + ': REPAIR (2 SCRAP)' : (TOUCH ? 'BUILD' : 'F') + ': BARRICADE (4 SCRAP)'; setText(UI.hint, hint); UI.hint.style.display = hint ? '' : 'none';
  if (S.comboT > 0 && S.combo >= 10) { setText(UI.combo, S.combo + ' CHAIN' + (S.combo >= 15 ? ' x' + (1 + Math.min(4, Math.floor(S.combo / 15))) : '')); UI.combo.classList.add('on'); } else UI.combo.classList.remove('on');
  for (const b of BARS) b.gh.visible = S.mode === 'play' && buildable(b) && b.hp <= 0;
}
const _pv2 = new THREE.Vector3();
function popsStep(dt) { const w = VW(), h = VH(); for (let i = POPS.length - 1; i >= 0; i--) { const p = POPS[i]; p.t += dt; p.p.y += dt * 0.9; if (p.t > 1.3) { p.el.remove(); POPS.splice(i, 1); continue; }
  _pv2.copy(p.p).project(camera);
  if (_pv2.z > 1.0) { p.el.style.display = 'none'; continue; }
  p.el.style.display = '';
  p.el.style.transform = `translate(${((_pv2.x * 0.5 + 0.5) * w).toFixed(0)}px, ${((-_pv2.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%) scale(${p.t < 0.12 ? 0.6 + p.t * 4 : 1})`; p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1'; } }
// objective arrow + hold zone ring on the ground
const ARROW = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0.55); s.lineTo(0.38, 0); s.lineTo(0.14, 0); s.lineTo(0.14, -0.35); s.lineTo(-0.14, -0.35); s.lineTo(-0.14, 0); s.lineTo(-0.38, 0); s.closePath(); return s; })()).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide }));
ARROW.renderOrder = 3; scene.add(ARROW);
const ZONE = new THREE.Mesh(new THREE.RingGeometry(15.4, 16, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dff6b', transparent: true, opacity: 0.4, depthWrite: false, fog: false })); ZONE.renderOrder = 2; scene.add(ZONE);
function markersStep() { const st = STAGES[S.stage], [tx, tz] = objTarget(), dx = tx - PL.x, dz = tz - PL.z, d = Math.hypot(dx, dz);
  ARROW.visible = S.mode === 'play' && d > 6; if (ARROW.visible) { const a = Math.atan2(dx, dz); ARROW.position.set(PL.x + Math.sin(a) * 1.6, groundY(PL.x, PL.z) + 0.06, PL.z + Math.cos(a) * 1.6); ARROW.rotation.y = a + Math.PI; ARROW.scale.setScalar(1 + 0.12 * Math.sin(S.t * 6)); }
  ZONE.visible = S.mode === 'play' && st.k === 'hold'; if (ZONE.visible) { ZONE.position.set(st.at[0], CURB + 0.05, st.at[1]); ZONE.material.opacity = 0.25 + 0.2 * Math.abs(Math.sin(S.t * 2)); } }

// ---------------- test bot (QA + attract): follows the objective field, kites, shoots, builds, bombs; ?bot=lose stands still ----------------
const BOTS = { card: 0, pick: null };
function botThink(I) {
  if (UI.card.classList.contains('on')) { if (BOTQ === 'lose') return; BOTS.card += 1 / 60; if (BOTS.card > (FAST ? 0.5 : 1.2)) { BOTS.card = 0; cardPick(1); } return; }
  if (S.mode === 'title' && BOTQ !== 'attract') { startGame(); return; }
  if (S.mode !== 'play' && S.mode !== 'title') return;
  if (BOTQ === 'lose') { I.mx = I.mz = 0; I.fire = false; I.aim = false; return; }
  const st = STAGES[S.stage];
  // target: boss > close bloaters > nearest
  let tgt = null, ts = 1e9;
  for (const q of Z) { if (!q.on || q.die || q.climb > 0.5) continue; const dx = q.x - PL.x, dz = q.z - PL.z, d = Math.hypot(dx, dz); if (d > 17) continue; let s = d; if (q.t.id === 'bloater') s -= d < 7 ? 6 : 0; if (q.t.id === 'brute') s -= 2; if (q.t.id === 'spitter') s -= 1.5; if (s < ts) { ts = s; tgt = q; } }
  if (BOSS.on && !BOSS.dead) { const d = Math.hypot(BOSS.x - PL.x, BOSS.z - PL.z); if (d < 20 && (!tgt || ts > 3.5)) tgt = BOSS; }
  if (tgt) { I.ax = tgt.x - PL.x; I.az = tgt.z - PL.z; I.aim = true; I.fire = true; I.aimD = Math.hypot(I.ax, I.az); }
  // movement: objective field + kiting
  let gx = 0, gz = 0; const k = gi(PL.x, PL.z);
  if (k >= 0) { let best = BOTF[k], bx = 0, bz = 0; for (const [ox, oz] of N8) { const n = k + ox + oz * GWD; if (n < 0 || n >= GN) continue; if (GRID[n] !== 0) continue; if (ox && oz && (GRID[k + ox] !== 0 || GRID[k + oz * GWD] !== 0)) continue; const f = BOTF[n] + (ox && oz ? 0.4 : 0); if (f < best) { best = f; bx = ox; bz = oz; } } gx = bx; gz = bz; if (BOTF[k] < 3) gx = gz = 0; }
  let rx = 0, rz = 0, crowd = 0, cx = 0, cz = 0; nearZ(PL.x, PL.z, 5.5, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 0.1, w = (q.t.id === 'brute' ? 3 : q.t.id === 'bloater' ? 2.5 : 1) / (d * d); rx -= dx / d * w; rz -= dz / d * w; if (d < 4.5) { crowd++; cx += q.x; cz += q.z; } });
  let dodge = false;
  if (BOSS.on && !BOSS.dead) { const dx = BOSS.x - PL.x, dz = BOSS.z - PL.z, d = Math.hypot(dx, dz) || 1; if (d < 10) { rx -= dx / d * 14 / d; rz -= dz / d * 14 / d; }
    if (BOSS.st === 'chargeW' || BOSS.st === 'charge') { const side = Math.sign(BOSS.dir[0] * (PL.z - BOSS.z) - BOSS.dir[1] * (PL.x - BOSS.x)) || 1; let sx = -BOSS.dir[1] * side, sz = BOSS.dir[0] * side;
      if (solidAt(PL.x + sx * 1.5, PL.z + sz * 1.5)) { sx = -sx; sz = -sz; } const along = (PL.x - BOSS.x) * BOSS.dir[0] + (PL.z - BOSS.z) * BOSS.dir[1], perp = Math.abs((PL.x - BOSS.x) * BOSS.dir[1] - (PL.z - BOSS.z) * BOSS.dir[0]);
      if (along > -1 && perp < 2.6) { rx = sx * 6; rz = sz * 6; dodge = true; } }
    if (BOSS.st === 'slamW' && d < 6.5) { rx = -dx / d * 6; rz = -dz / d * 6; dodge = true; } }
  const hold = st.k !== 'travel', obj = st.k === 'finale' && S.docked ? 1.6 : hold ? 0.55 : 1.0;
  // pickups, crates, slots to build
  let goal = null; const need = PL.hp < 55;
  for (const p of PICKS) { if (!p.on) continue; const d = Math.hypot(p.x - PL.x, p.z - PL.z); if ((p.kind === 'crate' && d < 22 && S.mode === 'play') || (p.kind === 'cake' && need && d < 16) || (p.kind === 'ammo' && d < 9) || (p.kind === 'scrap' && d < 5)) { const crate = p.kind === 'crate'; if (!goal || (crate && !goal.crate) || (d < goal.d && !(goal.crate && !crate))) goal = { x: p.x, z: p.z, d, crate }; } }
  if (!goal && hold && PL.scrap >= 4 && !S.docked) { for (const b of BARS) { if (b.st !== S.stage || b.hp > 0) continue; const d = slotDist(b, PL.x, PL.z); if (d < 26 && (!goal || d < goal.d)) { const [ax, az] = st.at, l = Math.hypot(ax - b.cx, az - b.cz) || 1; goal = { x: b.cx + (ax - b.cx) / l * 1.6, z: b.cz + (az - b.cz) / l * 1.6, d, bar: b }; } } }
  if (goal && goal.bar && slotDist(goal.bar, PL.x, PL.z) < 2.2) I.build = true;
  let mx = gx * obj + rx * 1.6, mz = gz * obj + rz * 1.6;
  if (goal) { const dx = goal.x - PL.x, dz = goal.z - PL.z, d = Math.hypot(dx, dz) || 1, wgt = goal.crate ? 3 : 1.2; if (goal.crate) { mx = rx * 1.6; mz = rz * 1.6; } mx += dx / d * wgt; mz += dz / d * wgt; }
  if (hold && !goal && !S.docked) { const [ax, az] = st.k === 'finale' ? [271, 36] : st.at, dx = ax - PL.x, dz = az - PL.z, d = Math.hypot(dx, dz); if (d > 5) { mx += dx / d * 0.8; mz += dz / d * 0.8; } }
  if (dodge) { mx = rx; mz = rz; }
  I.mx = mx; I.mz = mz; const ml = Math.hypot(mx, mz); if (ml < 0.15) { I.mx = I.mz = 0; }
  // weapon choice, bombs, shove
  const want = tgt === BOSS || (tgt && tgt.t && tgt.t.id === 'brute') ? 3 : crowd >= 5 ? 1 : 2; const pref = [want, 2, 1, 3, 0].find((w) => PL.owned[w] && (PL.mag[w] > 0 || PL.res[w] > 0)); if (pref !== undefined && pref !== PL.w && PL.reload <= 0 && (S.t % 1) < 0.05) PICK_W = pref;
  if (crowd >= 9 && PL.bombs > 0 && gate('botbomb', 2.5)) { I.bomb = true; I.aim = true; I.ax = cx / crowd - PL.x; I.az = cz / crowd - PL.z; const d = Math.hypot(I.ax, I.az); if (d < 5.5) { I.ax *= 5.5 / (d || 1); I.az *= 5.5 / (d || 1); } I.aimD = 5.5; }
  let close = 0; nearZ(PL.x, PL.z, 1.3, () => close++); if (close >= 3) I.shove = true;
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
resize(); setLight(0); placeTeam(8, 0); setWeapon(0); stageSetup(0, true); UI.ban.classList.remove('on'); UI.say.classList.remove('on'); setViewMode(FPS_MODE);
if (Q.get('horde')) DZ.hordeQ = +Q.get('horde');
setText(UI.best, S.best ? 'BEST ' + S.best.toLocaleString() : ''); setText(UI.muteB, MUTE ? 'SOUND OFF' : 'SOUND ON');
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc >= 1) { DZ.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  DZ.frames++; sim(rdt); draw3d(rdt);
}
function draw3d(rdt) {
  if (muzzleLight.intensity > 0) {
    muzzleLight.intensity = damp(muzzleLight.intensity, 0, 36, rdt);
    if (muzzleLight.intensity < 0.05) muzzleLight.intensity = 0;
  }
  updateCrosshair(rdt);
  hitmarkerStep(rdt);
  haroldPose(rdt); camStep(rdt); hordeDraw(); tracerDraw(rdt); hud(); popsStep(rdt); markersStep();
  WATER_TEX.offset.x = (S.t * 0.01) % 1; WATER_TEX.offset.y = (S.t * 0.006) % 1;
  renderer.info.autoReset = false; renderer.info.reset(); renderer.setRenderTarget(RT); renderer.render(scene, camera); DZ.calls = renderer.info.render.calls; DZ.tris = renderer.info.render.triangles;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
function sim(rdt) {
  if (banT > 0 && (banT -= rdt) <= 0) UI.ban.classList.remove('on'); if (sayT > 0 && (sayT -= rdt) <= 0) UI.say.classList.remove('on');
  let dt = rdt; if (S.hs > 0) { S.hs -= rdt; dt = rdt * 0.15; } S.shake = Math.max(0, S.shake - rdt * 2.4);
  const I = readInput(); cardT += rdt;
  if (S.paused) return;
  S.t += dt;
  if (S.mode === 'play' || S.mode === 'title') {
    if (S.mode === 'play') { S.stats.time += dt; document.body.classList.toggle('kfade', S.stats.time > 25); }
    S.fieldT -= dt; if (S.fieldT <= 0) { S.fieldT = 0.22; updateFields(); }
    if (S.botFieldDirty) { S.botFieldDirty = false; const [tx, tz] = objTarget(); computeField(BOTF, tx, tz, 0); }
    if (S.mode === 'title') { const bq = BOTQ; BOTQ = 'attract'; I.mx = I.mz = 0; botThink(I); playerStep(dt, I); BOTQ = bq; PL.hp = PL.max; if (PL.x > 86) placeTeam(8, 0); }
    else playerStep(dt, I);
    spawnTick(dt); hordeStep(dt); bossStep(dt); mavisStep(dt); pickStep(dt); bombStep(dt); gateStep(dt);
    if (S.mode === 'play') stageStep(dt);
    S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  } else if (S.mode === 'dead') { PL.deadT += dt; hordeStep(dt); mavisStep(dt); if (PL.deadT > (FAST || BOTQ ? 1.0 : 2.0)) showDeath(); }
  else if (S.mode === 'win') { hordeStep(dt); TAXI.position.x -= dt * 7; TAXI.rotation.y = damp(TAXI.rotation.y, -Math.PI / 2, 1, dt); PL.x = TAXI.position.x; PL.z = TAXI.position.z - 0.5; MV.x = PL.x + 0.8; MV.z = PL.z + 1; HAROLD.root.position.y = TAXI.position.y + 0.7; MAVIS.root.position.set(MV.x, TAXI.position.y + 0.7, MV.z); }
  else if (S.mode === 'over' || S.mode === 'card') { hordeStep(dt * 0.3); }
  updateSprites(dt);
}
// QA: run the simulation forward without rendering (headless Chrome renders with SwiftShader, far below real-device speed)
DZ.advance = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { sim(1 / 60); haroldPose(1 / 60); } CAM.init = false; camStep(1 / 60); hud(); };
DZ.stats = () => ({ mode: S.mode, stage: S.stage, st: +S.st.toFixed(1), hold: +S.holdT.toFixed(1), x: +PL.x.toFixed(1), z: +PL.z.toFixed(1), hp: Math.round(PL.hp), score: S.score, alive: ZALIVE, drawn: DZ.drawn, w: PL.w, owned: PL.owned.map(Number).join(''), scrap: PL.scrap, bombs: PL.bombs,
  bars: BARS.filter((b) => b.hp > 0).length, boss: BOSS.on ? Math.round(BOSS.hp) : null, docked: S.docked, kills: S.stats.kills, card: UI.card.classList.contains('on') ? UI.cardT.textContent : null, fps: DZ.fps, err: window.__celErr.n, calls: DZ.calls, tris: DZ.tris });
DZ.S = S; DZ.PL = PL; DZ.start = startGame; DZ.card = cardPick; DZ.togglePause = togglePause;
requestAnimationFrame(frame);
UI.title.classList.add('on'); S.mode = 'title';
DZ.ready = true;

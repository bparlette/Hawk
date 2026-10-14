// ===== copied from Toad City Baltimore src/01_core.js @ hark/integration e1aaac3 (renderer, PS1/HD toon material, ink-outline hulls; halftone patch) =====
// Bake-off K: "Toad Street 32" - one block of one street, an elderly toad couple vs. five thugs, rendered like a 32-bit (PS1-era) game:
// low-res target + nearest upscale, vertex snapping, affine-ish texture wobble, ordered dither + 15-bit colour, short fogged draw distance,
// and a 2-minute day/night cycle. Fork of J (Cinema City), standalone three.js r160, procedural everything.
import * as THREE from './three.module.min.js';

const $ = (id) => document.getElementById(id);
// the game view: on phones in portrait the canvas stops above the control deck, so screen maths uses the canvas size, not the window
const VW = () => (document.getElementById('gl') || {}).clientWidth || innerWidth, VH = () => (document.getElementById('gl') || {}).clientHeight || innerHeight;
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
      if (uPost < 0.5) { // HD: straight copy + (Paperboy) comic halftone dots in the shadows
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
// ===== copied from Toad City Baltimore src/02_atlas.js @ hark/integration e1aaac3 (city atlas: facades, storefronts, real-name signs, ground tiles) =====

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
// ===== copied from Toad City Baltimore src/03_city.js @ hark/integration e1aaac3 (merged city builders, building(), street props, cars, lamps, trees, sky dome; world layout not copied) =====

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
// ===== copied from Toad City Baltimore src/03b_landmarks_hd.js @ hark/integration e1aaac3 (HD builder HB, sign atlas SA, sText, World Trade Center builder) =====

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

// ===== copied from Toad City Baltimore src/03f_landmarks_hd_b3.js @ hark/integration e1aaac3 (B3 helpers + Fells Point Thames St rowhouse block with its real signs) =====

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

// ===== copied from Toad City Baltimore src/04_actors.js @ hark/integration e1aaac3 (Harold + Mavis rigs, poses) =====

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
// ===== copied from Toad City Baltimore src/04b_rig_merge.js @ hark/integration e1aaac3 (rig merge: each rig -> a few skinned meshes) =====

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
// ===== copied from Toad City Baltimore src/05_fx.js @ hark/integration e1aaac3 (comic FX sprites + WebAudio sfx) =====

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

// ======================= TOAD CITY PAPERBOY (Brad, 2026-10-13: "Same exact Baltimore assets city and code.") =======================
// A Paperboy-style route on the Toad City Baltimore engine: Harold rides a BMX down E Fort Ave's rowhouse blocks (Locust Point) delivering the
// Toad City Sun. Everything above this file is copied verbatim from Toad City Baltimore (renderer, toon/cel material, ink hulls, city atlas +
// real-name signs, building()/lamp()/car()/hydrant()/bin()/tree() kit, HD builder HB + sign atlas, World Trade Center + Fells Point landmark
// builders, Harold + Mavis rigs and poses, comic FX + sfx). This file adds only the game: route, rowhouse fronts built with the HB kit,
// obstacles, papers, scoring, a week of days, the bonus BMX course, HUD, touch + keys, a procedural B-more club loop, and a test bot.
// Test params: ?bot=1 (autopilot) &bot=lose (rides into traffic) &god=1 (no crashes, test only) &day=N (start day 0-6) &fast=1 (short cards)

// lmHD(): Toad City's landmark registry, redefined here to only store the builders (the copied WTC / Fells Point code calls it)
function lmHD(id, cx, cz, r, build) { (lmHD.defs || (lmHD.defs = {}))[id] = { id, cx, cz, r, build }; }
function lmMake(id) { // build a registered landmark (one toon mesh + ink hull + its canvas sign atlas), as 03b's lmHD did for the near LOD
  const D = lmHD.defs[id]; LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); D.build(hb, signs, sa); const g = hb.build();
  for (const s of signs) g.add(s.build(DECAL_MAT)); if (sa.items.length) g.add(sa.build()); return g;
}

const PB = window.__pb = { fps: 0, frames: 0, errors: () => window.__celErr.n, log: [] };
const GOD = Q.has('god'), FAST = Q.has('fast'); let BOTQ = Q.get('bot'); PB.setBot = (m) => { BOTQ = m; };
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY3 = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ---------------- the route: E Fort Ave, four rowhouse blocks, three cross streets (real Locust Point names) ----------------
const FZ = -9, CURBZ = -4, ROADZ1 = 8, FARZ1 = 12; // house fronts, curb line, far curb, far sidewalk edge
const HW = 5, STOOP_D = 1.35, STOOP_H = 0.45;
const ZMIN = -7.2, ZMAX = 7.0;
const LOTS = [], HOUSES = [], XST = [];
const XNAMES = ['LAWRENCE ST', 'WOODALL ST', 'HULL ST', 'BEASON ST'];
{ let x = 0, hn = 1401;
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 7; i++) { const h = { i: HOUSES.length, x0: x, x1: x + HW, num: hn, sub: false, floors: 2 + ((HOUSES.length * 7) % 5 === 0 ? 1 : 0), ci: (HOUSES.length * 5) % 8, form: (HOUSES.length * 3) % 4 === 1 };
      h.door = x + 1.0; h.mb = [x + 1.75, x + 2.15]; h.win = [x + 2.45, x + 4.55]; h.stoop = [x + 0.35, x + 1.65]; HOUSES.push(h); LOTS.push({ k: 'house', h }); x += HW; hn += 2; }
    LOTS.push({ k: 'store', x0: x, x1: x + 7, sign: [0, 3, 5, 4][b] }); x += 7; hn += 2;
    if (b < 3) { XST.push({ x0: x, x1: x + 12, name: XNAMES[b] }); x += 12; }
  }
  XST.push({ x0: x, x1: x + 12, name: XNAMES[3] });
  PB.L = x; // the end of the route (the start of the last cross street)
}
const ROUTE_END = PB.L + 6;
const BX0 = PB.L + 22, BX1 = BX0 + 128; // bonus course

// ---------------- scene setup: Toad City lights / fog / sky, HD on, PCF shadows ----------------
applyQuality(true);
renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALK = { // Toad City's day / dusk palette (07_main.js)
  top: _ck(['#4a86c8', '#34386e']), mid: _ck(['#9cc4dc', '#b0706a']), hor: _ck(['#d8dccf', '#f08850']),
  fog: _ck(['#b4c0c6', '#8a6060']), hs: _ck(['#dfe6ff', '#ffb08a']), hg: _ck(['#8a7f74', '#5a4040']), sun: _ck(['#fff3dc', '#ff9a58']) };
const DIRK = [new THREE.Vector3(-0.5, 1.7, 0.42).normalize(), new THREE.Vector3(-1, 0.32, -0.25).normalize()];
function setLight(n) { // n: 0 bright morning .. 1 sunrise glow
  const c = (k, o) => o.copy(PALK[k][0]).lerp(PALK[k][1], n);
  c('top', SKY.U.top.value); c('mid', SKY.U.mid.value); c('hor', SKY.U.hor.value); SKY.U.uStars.value = 0;
  c('fog', scene.fog.color); FOGC.copy(scene.fog.color); renderer.setClearColor(scene.fog.color); scene.fog.near = 70; scene.fog.far = 190;
  OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = 70; OUT_U.fogF.value = 190;
  c('hs', hemi.color); c('hg', hemi.groundColor); hemi.intensity = lerp(1.45, 1.05, n); c('sun', sun.color); sun.intensity = lerp(2.1, 1.5, n);
  SUN_DIR.copy(DIRK[0]).lerp(DIRK[1], n * 0.55).normalize(); SKY.sunS.position.copy(SUN_DIR).multiplyScalar(70); SKY.moonS.visible = false;
  NIGHT.value = n * 0.35;
}
SKY.moonS.visible = false;

// ---------------- materials / tiny helpers ----------------
function hullFromMB(mb) { // an ink hull for a city-kit MB (cars): same triangles, odir, OUT_PROP
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mb.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.N, 3));
  addOdir(g); g.deleteAttribute('normal'); const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); return h;
}
function kitMesh(fn) { // run a city-kit prop builder (car(), bin(), hydrant()...) into its own mesh at the origin
  const keep = CB.cap, mb = new MB(); CB.cap = mb; const nC = COLL.length, nB = BLD.length; fn(); CB.cap = keep; COLL.length = nC; BLD.length = nB;
  const g = new THREE.Group(), m = mb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; g.add(m, hullFromMB(mb)); return g;
}
// merge a part-built prop's meshes per group (keeps animated sub-groups as they are): one toon mesh + one ink hull per group
function mergeParts(node) {
  const meshes = node.children.filter((c) => c.isMesh && !c.isSkinnedMesh && c.material && c.material.isMeshLambertMaterial && !c.userData.keep);
  if (meshes.length > 1) {
    const byMat = new Map(); for (const m of meshes) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
    for (const [mat, list] of byMat) {
      const P = [], N = [], C = [], OP = [], OD = []; const nm = new THREE.Matrix3(), om = new THREE.Matrix3(), v = new THREE.Vector3();
      for (const m of list) { m.updateMatrix(); let g = m.geometry; const hull = m.children.find((c) => c.isMesh && c.material && c.material.isShaderMaterial);
        nm.getNormalMatrix(m.matrix); om.setFromMatrix4(m.matrix); const idx = g.index, A = g.attributes, n = idx ? idx.count : A.position.count;
        for (let j = 0; j < n; j++) { const i = idx ? idx.getX(j) : j; v.fromBufferAttribute(A.position, i).applyMatrix4(m.matrix); P.push(v.x, v.y, v.z);
          v.fromBufferAttribute(A.normal, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); if (A.color) C.push(A.color.getX(i), A.color.getY(i), A.color.getZ(i)); else C.push(1, 1, 1);
          if (hull && A.odir) { v.fromBufferAttribute(A.position, i).applyMatrix4(m.matrix); OP.push(v.x, v.y, v.z); v.fromBufferAttribute(A.odir, i).applyMatrix3(om); OD.push(v.x, v.y, v.z); } }
        node.remove(m); if (hull) { const k = QUAL.outlines.indexOf(hull); if (k >= 0) QUAL.outlines.splice(k, 1); } }
      const G2 = new THREE.BufferGeometry(); G2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); G2.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); G2.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      const M = new THREE.Mesh(G2, mat); M.castShadow = true; node.add(M);
      if (OP.length) { const H2 = new THREE.BufferGeometry(); H2.setAttribute('position', new THREE.Float32BufferAttribute(OP, 3)); H2.setAttribute('odir', new THREE.Float32BufferAttribute(OD, 3)); const h = new THREE.Mesh(H2, OUT_CHAR); h.visible = QUAL.hd; QUAL.outlines.push(h); node.add(h); }
    }
  }
  for (const c of node.children) if (!c.isMesh) mergeParts(c);
  return node;
}
const GLASS = canvasTex(256, 200, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9cc8e0'); g.addColorStop(0.55, '#3c5c78'); g.addColorStop(1, '#26384c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(30, h); c.lineTo(110, 0); c.lineTo(140, 0); c.lineTo(60, h); c.fill(); c.fillStyle = '#f2efe6'; c.fillRect(w / 2 - 6, 0, 12, h); c.fillRect(0, h * 0.45, w, 10);
  c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }, 256);
const BROKEN = canvasTex(256, 200, (c, w, h) => { c.fillStyle = '#14141c'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9cc8e0'); g.addColorStop(1, '#3c5c78');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h); c.lineTo(0, h); c.lineTo(0, 0); c.moveTo(w * 0.5, h * 0.18); for (let i = 0; i < 14; i++) { const a = -i / 14 * TAU, r = (i % 2 ? 0.22 : 0.42) * h; c.lineTo(w * 0.5 + Math.cos(a) * r * 1.3, h * 0.5 + Math.sin(a) * r); } c.closePath(); c.fill('evenodd');
  c.strokeStyle = '#f4f6ff'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; c.beginPath(); c.moveTo(w * 0.5 + Math.cos(a) * 30, h * 0.5 + Math.sin(a) * 22); c.lineTo(w * 0.5 + Math.cos(a) * 140, h * 0.5 + Math.sin(a) * 110); c.stroke(); }
  c.fillStyle = '#f2efe6'; c.fillRect(w / 2 - 6, 0, 12, h * 0.2); c.fillRect(w / 2 - 6, h * 0.8, 12, h * 0.2); c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }, 256);
const GLASS_M = new THREE.MeshLambertMaterial({ map: GLASS, emissive: '#223040', emissiveIntensity: 0.4 }), BROKEN_M = new THREE.MeshLambertMaterial({ map: BROKEN });
const PAPER_TEX = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#efe9d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8478'; for (let y = 12; y < h; y += 7) c.fillRect(8, y, w - 16, 2); c.fillStyle = '#1a1820'; c.fillRect(8, 3, w - 16, 7); c.fillStyle = '#d23a3a'; c.fillRect(w / 2 - 7, 0, 14, h); }, 128);

// ---------------- the street (rebuilt each morning: subscriber fronts are painted, the rest are dark) ----------------
const SUB_COLS = ['#e2c464', '#5fa6b8', '#e07a62', '#86b860', '#dc8ec0', '#f0e4c4', '#7896e0', '#f0a050'];
const NON_COLS = ['#4f4a52', '#4a4e54', '#5a4f48', '#46464e'];
const DOOR_COLS = ['#2f5a36', '#8a1f28', '#1f3a7a', '#2a2a2a', '#6a3a8a'];
let STREET = null; const LAMPC = [];
function houseFront(H, SG, h) {
  const Y0 = CURB, x0 = h.x0, x1 = h.x1, W = x1 - x0, F = H.frame(x0, FZ, x1, FZ), sub = h.sub, ht = h.floors * 2.9 + 1.1;
  const col = sub ? SUB_COLS[h.ci] : h.form ? '#86817a' : NON_COLS[h.ci % NON_COLS.length], cc = sub ? '#f6f2ea' : '#8e8a84', marble = sub ? '#f4f2ec' : '#b8b4ac';
  H.box(x0, Y0, FZ - 9, x1, Y0 + ht, FZ, col);
  if (h.form && !sub) for (let k = 0; k < 9; k++) { const u = LMR() * (W - 1), y = 0.6 + LMR() * (ht - 2); H.fbox(F, u, u + 0.6 + LMR() * 0.8, Y0 + y, Y0 + y + 0.3 + LMR() * 0.5, 0, 0.03, LMR() < 0.5 ? '#9a948a' : '#77726b', { ol: false }); } // formstone
  H.fbox(F, 0, W, Y0, Y0 + 0.5, 0, 0.08, marble, { ol: false }); // marble water table
  H.fbox(F, W - 0.07, W, Y0, Y0 + ht, 0, 0.12, '#2a2430', { ol: false }); // party-wall line
  H.fbox(F, -0.02, W + 0.02, Y0 + ht - 0.55, Y0 + ht, 0, 0.42, cc); // cornice
  for (let b = 0.32; b < W - 0.2; b += 0.62) H.fbox(F, b, b + 0.16, Y0 + ht - 0.9, Y0 + ht - 0.55, 0, 0.3, cc, { ol: false });
  H.box(x0 + 0.1, Y0 + ht, FZ - 8.8, x1 - 0.1, Y0 + ht + 0.35, FZ - 0.3, '#3a3a40', { ol: false }); // tar roof lip
  const board = !sub && h.ci % 3 === 0; // a vacant: plywood over the upper windows
  H.windows(F, 0.3, W - 0.3, Y0 + 3.0, Y0 + ht - 0.75, { bw: 1.6, fh: 2.9, ww: 0.86, wh: 1.62, pane: board ? '#b08a5a' : sub ? '#2a3440' : '#18191e', head: cc, sill: cc, mull: board ? null : cc, lit: sub ? 0.25 : 0 });
  // ground floor: door + arched transom, marble stoop, mailbox, the big front window (breakable, its own mesh)
  const d0 = 0.55, d1 = 1.45, dm = (d0 + d1) / 2;
  H.fbox(F, d0 - 0.13, d1 + 0.13, Y0 + STOOP_H, Y0 + 2.62, 0, 0.06, cc, { ol: false });
  H.farch(F, dm, Y0 + 2.62, 0.58, 0, 0.06, cc, { ol: false }, 8);
  H.fbox(F, d0, d1, Y0 + STOOP_H, Y0 + 2.5, 0.03, 0.09, sub ? DOOR_COLS[h.ci % DOOR_COLS.length] : '#3a3430', { ol: false });
  H.farch(F, dm, Y0 + 2.5, 0.45, 0.03, 0.08, '#2a3440', { ol: false, emi: sub ? '#ffcf7a' : null }, 8);
  H.fbox(F, d1 - 0.2, d1 - 0.12, Y0 + 1.45, Y0 + 1.55, 0.09, 0.14, '#d8b040', { ol: false });
  for (let k = 0; k < 3; k++) H.fbox(F, h.stoop[0] - x0, h.stoop[1] - x0, Y0 + k * 0.15, Y0 + (k + 1) * 0.15, 0, STOOP_D * (3 - k) / 3, marble, { ol: k === 0 });
  H.fbox(F, h.mb[0] - x0, h.mb[1] - x0, Y0 + 1.15, Y0 + 1.55, 0, 0.24, sub ? '#1e2a3a' : '#2a2a2a');
  H.fbox(F, h.mb[0] - x0 - 0.02, h.mb[1] - x0 + 0.02, Y0 + 1.55, Y0 + 1.6, 0, 0.27, '#4a5a6a', { ol: false });
  if (sub) H.fbox(F, h.mb[1] - x0 - 0.03, h.mb[1] - x0 + 0.02, Y0 + 1.45, Y0 + 1.82, 0.16, 0.22, '#e03030', { ol: false }); // the red flag: a subscriber
  const w0 = h.win[0] - x0, w1 = h.win[1] - x0;
  H.fbox(F, w0 - 0.14, w1 + 0.14, Y0 + 0.85, Y0 + 2.72, 0, 0.05, cc); H.fbox(F, w0 - 0.2, w1 + 0.2, Y0 + 0.78, Y0 + 0.9, 0, 0.2, cc, { ol: false });
  if (board) H.fbox(F, w0 - 0.05, w1 + 0.05, Y0 + 0.92, Y0 + 2.62, 0.05, 0.09, '#b08a5a'); // plywood: nothing to break
  SG.add(F, dm, Y0 + 2.56, 0.62, 0.26, 0.1, (g, w, hh) => sText(g, String(h.num), w / 2, hh / 2, w * 0.9, hh * 0.8, SERIF, '#e8c870', { weight: 'bold' }));
  if (sub) SG.add(F, (h.mb[0] + h.mb[1]) / 2 - x0, Y0 + 1.22, 0.34, 0.15, 0.26, (g, w, hh) => { g.fillStyle = '#ffd23c'; g.fillRect(0, 0, w, hh); sText(g, 'SUN', w / 2, hh / 2, w * 0.86, hh * 0.84, SANS, '#14101f', { weight: '900' }); });
  // the row's end walls (first / last house of a block): common brick with a few windows, like a real Baltimore end-of-group
  for (const [end, Fs] of [[h.i % 7 === 0, H.frame(x0, FZ - 9, x0, FZ)], [h.i % 7 === 6, H.frame(x1, FZ, x1, FZ - 9)]]) { if (!end) continue;
    H.fbox(Fs, 0, 9, Y0, Y0 + ht, 0, 0.04, '#8a4a3a', { ol: false }); H.fbox(Fs, -0.02, 9.02, Y0 + ht - 0.4, Y0 + ht, 0, 0.2, cc, { ol: false });
    H.windows(Fs, 1.2, 8.2, Y0 + 3.0, Y0 + ht - 0.75, { bw: 2.4, fh: 2.9, ww: 0.7, wh: 1.4, pane: '#22262c', head: '#d8cfb8', sill: '#d8cfb8', lit: 0, pd: 0.07 }); }
  h.board = board; h.ht = ht;
}
function buildStreet() {
  if (STREET) { scene.remove(STREET); STREET.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  CB = new CMB(); DB = new CMB(); GB = new CMB(); COLL.length = 0; BLD.length = 0; LAMPS.length = 0;
  const root = new THREE.Group(); SEED = 4242;
  // ground: road, sidewalks + curbs, cross streets, crosswalks, the far side park strip, the bonus plaza
  const X0 = -40, X1 = BX1 + 60, Lx = PB.L;
  GB.floorSub(X0, CURBZ, X1, ROADZ1, 0, T.road, '#fff', 4, 8);
  const walkRuns = []; { let x = X0; for (const s of XST) { walkRuns.push([x, s.x0]); x = s.x1; } walkRuns.push([XST[3].x1, X1]); }
  for (const [a, b] of walkRuns) { if (b <= a) continue;
    const pave = a > PB.L ? T.pave : T.walk; // the bonus plaza is brick
    GB.floorSub(a, FZ - 0.01, b, CURBZ, CURB, pave, '#fff', 3, 8); CB.wall(a, CURBZ, b, CURBZ, 0, CURB, T.white, '#8a8478');
    GB.floorSub(a, ROADZ1, b, FARZ1, CURB, T.walk, '#fff', 3, 8); CB.wall(b, ROADZ1, a, ROADZ1, 0, CURB, T.white, '#8a8478');
    GB.floorSub(a, FARZ1, b, 40, CURB, T.grass, '#fff', 4, 10);
    GB.floorSub(a, -60, b, FZ, CURB, T.walk, '#cfcac0', 4, 16); } // the back alleys / yards (mostly hidden behind the rows)
  for (const s of XST) { GB.floorSub(s.x0, -60, s.x1, CURBZ, 0.005, T.road, '#fff', 4, 8); GB.floorSub(s.x0, ROADZ1, s.x1, 40, 0.005, T.road, '#fff', 4, 8);
    for (let z = CURBZ + 0.6; z < ROADZ1 - 0.4; z += 1.0) CB.box(s.x0 + 1.2, 0, z, s.x0 + 3.4, 0.02, z + 0.5, '#ece8dc', T.white, {}); // zebra crossing
    for (let z = CURBZ + 0.6; z < ROADZ1 - 0.4; z += 1.0) CB.box(s.x1 - 3.4, 0, z, s.x1 - 1.2, 0.02, z + 0.5, '#ece8dc', T.white, {}); }
  for (let x = X0; x < X1; x += 6) if (!XST.some((s) => x > s.x0 - 3 && x < s.x1)) CB.box(x, 0, 3.42, x + 3, 0.02, 3.58, '#f0c840', T.white, {}); // centre dashes
  // houses (HB kit: one toon mesh + one ink hull + one sign atlas) and the breakable windows
  LMR(777); const H = new HB(), SG = new SA();
  for (const h of HOUSES) houseFront(H, SG, h);
  const hg = H.build(); root.add(hg); if (SG.items.length) root.add(SG.build());
  for (const h of HOUSES) { h.glass = null; if (h.board) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h.win[1] - h.win[0], 1.68), h.broken ? BROKEN_M : GLASS_M); m.position.set((h.win[0] + h.win[1]) / 2, CURB + 1.76, FZ + 0.07); m.receiveShadow = true; root.add(m); h.glass = m; }
  // corner stores: the Toad City building() with storefronts + its real-name shop signs, and the rows behind (generic city blocks)
  for (const l of LOTS) if (l.k === 'store') building(l.x0, FZ - 9, l.x1, FZ, 2, [0, 2, 5, 1][l.sign % 4], { shops: ['s', 'e'], sign: l.sign, v: 1 });
  // before the route and along the bonus plaza: more Toad City blocks (storefronts on the street side), leaving room for Fells Point
  building(X0, FZ - 12, XST.length ? -14 : -2, FZ, 3, 3, { shops: ['s', 'e'], sign: 6, v: 1 }); building(-12, FZ - 10, -0.4, FZ - 1.5, 2, 4, { shops: ['s', 'e'], sign: 2, v: 0 });
  SEED = 31; for (let x = XST[3].x1 + 1; x < X1; x += 16) { if (x + 15 > BX0 + 58 && x < BX0 + 82) continue; building(x, FZ - 14, x + 15, FZ - 2.5, 2 + Math.floor(srnd() * 3), Math.floor(srnd() * 6), { shops: ['s'], sign: Math.floor(srnd() * 8), v: srnd() < 0.5 ? 1 : 0 }); }
  SEED = 99; for (let x = X0; x < X1; x += 27) { if (XST.some((s) => x < s.x1 && x + 24 > s.x0)) continue; if (x + 24 > BX0 + 50 && x < BX0 + 92) continue;
    building(x, -52, x + 24, -32, 3 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: true, tower: srnd() < 0.3 ? [0.5, 0.5] : null }); }
  // street furniture: lamps, traffic lights at every corner (colliders kept for the ride), Fort Ave street blades
  LAMPC.length = 0;
  for (let x = 2; x < X1; x += 14) if (!XST.some((s) => x > s.x0 - 1.5 && x < s.x1 + 1.5)) { lampAt(x, CURBZ - 0.55, 0); LAMPC.push([x, CURBZ - 0.55]); }
  for (let x = 8; x < X1; x += 18) if (!XST.some((s) => x > s.x0 - 1.5 && x < s.x1 + 1.5)) lampAt(x, ROADZ1 + 0.6, Math.PI);
  for (const s of XST) { trafficLight(s.x0 - 0.8, CURBZ - 0.6, 0); LAMPC.push([s.x0 - 0.8, CURBZ - 0.6]); trafficLight(s.x1 + 0.8, ROADZ1 + 0.6, Math.PI); }
  root.add(CB.build(CITY_MAT, { cast: true }), GB.build(CITY_MAT), DB.build(DECAL_MAT));
  // street-name blades (Fort Ave + the cross streets)
  const SN = new SA();
  for (const s of XST) { const x = s.x0 - 0.8, z = CURBZ - 0.6;
    SN.at(x - 0.02, CURB + 3.2, z + 0.08, 0, 2.1, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, 'E FORT AVE', w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); });
    SN.at(x + 0.1, CURB + 3.7, z, -Math.PI / 2, 2.1, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, s.name, w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); }); }
  root.add(SN.build());
  // landmarks: Fells Point's Thames St block closes the bonus course, the World Trade Center on the skyline (real signage, copied builders)
  if (!buildStreet.lm) { const fells = lmMake('fells'); fells.position.set(BX0 + 70 - 150, 0, -10.4 - (-52)); const wtc = lmMake('wtc'); wtc.position.set(Lx * 0.62 + 12, 0, -86 + 22.5);
    buildStreet.lm = [fells, wtc]; }
  for (const g of buildStreet.lm) scene.add(g);
  root.traverse((o) => { if (o.isMesh && o.material === CITY_MAT) o.receiveShadow = true; });
  scene.add(root); STREET = root;
}

// ---------------- the hero rider: Harold (Toad City's rig) on a BMX built from the same toon parts ----------------
const RIDER = new THREE.Group(); scene.add(RIDER);
const BIKE = new THREE.Group(); RIDER.add(BIKE);
const HAROLD = buildHero(); RIDER.add(HAROLD.root); HAROLD.swR.scale.setScalar(0.001); // no cane on the route (the merged rig skins it to swR)
{ const pm = toonMat(); BIKE.userData.mat = pm; const FR = '#ff3d6e', CH = '#c8c8d0', BK = '#1a1a20';
  const tube = (ax, ay, bx, by, r, col) => { const L = Math.hypot(bx - ax, by - ay), g = G.cyl(r, r, L, 6); g.rotateZ(Math.atan2(bx - ax, by - ay) * -1); part(BIKE, g, col, (ax + bx) / 2, (ay + by) / 2, 0); };
  tube(-0.5, 0.33, 0.08, 0.36, 0.035, FR); tube(0.08, 0.36, 0.46, 0.78, 0.035, FR); tube(-0.1, 0.72, 0.46, 0.76, 0.035, FR); tube(-0.1, 0.72, 0.08, 0.36, 0.035, FR); tube(-0.5, 0.33, -0.1, 0.72, 0.03, FR);
  tube(0.46, 0.78, 0.55, 0.33, 0.03, CH); tube(0.46, 0.76, 0.42, 1.02, 0.03, CH);
  { const g = G.cyl(0.025, 0.025, 0.62, 6); g.rotateX(Math.PI / 2); part(BIKE, g, BK, 0.42, 1.04, 0); }
  for (const s of [-1, 1]) { const g = G.cyl(0.035, 0.035, 0.12, 6); g.rotateX(Math.PI / 2); part(BIKE, g, '#ffd23c', 0.42, 1.04, s * 0.32); }
  part(BIKE, G.box(0.3, 0.07, 0.14), BK, -0.12, 0.79, 0);
  part(BIKE, G.box(0.36, 0.2, 0.4), '#8a5a2a', 0.66, 0.92, 0); // the front paper basket
  for (const k of [0, 1]) part(BIKE, G.cyl(0.06, 0.06, 0.36, 8), '#efe9d8', 0.66, 1.05 + k * 0.03, -0.09 + k * 0.17, { rot: [Math.PI / 2, 0, 0] });
  const wheel = (x) => { const w = new THREE.Group(); w.userData.mat = pm; w.position.set(x, 0.33, 0); BIKE.add(w);
    part(w, G.tor(0.3, 0.045), BK); part(w, G.tor(0.26, 0.012), CH, 0, 0, 0, { outline: false });
    for (let k = 0; k < 4; k++) part(w, G.box(0.02, 0.52, 0.015), CH, 0, 0, 0, { rot: [0, 0, k * Math.PI / 4], outline: false });
    { const g = G.cyl(0.05, 0.05, 0.1, 8); g.rotateX(Math.PI / 2); part(w, g, '#ffd23c'); } return w; };
  BIKE.userData.wF = wheel(0.55); BIKE.userData.wR = wheel(-0.5);
  // Harold's canvas paper bag over the shoulder
  part(HAROLD.torso, G.box(0.16, 0.36, 0.42), '#e8dcc0', -0.36, 0.12, 0.0); part(HAROLD.torso, G.box(0.04, 0.62, 0.05), '#8a6a3a', -0.12, 0.38, 0.12, { rot: [0, 0, 0.75] });
  part(HAROLD.torso, G.box(0.12, 0.1, 0.36), '#d23a3a', -0.38, 0.32, 0, { outline: false });
  // the paper in hand during a throw
  const pp = G.cyl(0.06, 0.06, 0.34, 8); HAROLD.handPaper = part(HAROLD.haL, pp, '#efe9d8', 0, -0.06, 0.06, { rot: [Math.PI / 2, 0, 0] }); HAROLD.handPaper.visible = false;
  mergeParts(BIKE);
}
HAROLD.root.position.set(-0.08, 0.42, 0); HAROLD.root.rotation.y = Math.PI / 2;

// ---------------- dynamic things: papers, cars, hon ladies, dogs, arabber cart, pigeons, potholes, bundles ----------------
const DYN = new THREE.Group(); scene.add(DYN);
const PAPERS = [];
const PAPER_MAT = toonMat();
for (let i = 0; i < 10; i++) { const g = new THREE.Group(); g.userData.mat = PAPER_MAT; part(g, G.cyl(0.075, 0.075, 0.42, 8), '#efe9d8', 0, 0, 0, { rot: [0, 0, Math.PI / 2] }); part(g, G.cyl(0.08, 0.08, 0.06, 8), '#d23a3a', 0, 0, 0, { outline: false, rot: [0, 0, Math.PI / 2] });
  mergeParts(g); g.visible = false; scene.add(g); PAPERS.push({ g, on: false, v: new THREE.Vector3(), spent: false, rest: 0 }); }
const CAR_COLS = [['#a83a4a', '#d8d0c0'], ['#3a5a8a', '#2a3a5a'], ['#d8a830', '#d8a830'], ['#5a7a4a', '#d8d0c0'], ['#7a3a7a', '#d8d0c0'], ['#e8e4dc', '#3a3a40'], ['#2a2a30', '#2a2a30']];
const CARPOOL = CAR_COLS.map(([b, r]) => kitMesh(() => car(0, 0, Math.PI / 2, b, r)));
const CARS = []; // {g, x, z, vx, vz, len, wid}
function takeCar() { const free = CARPOOL.find((g) => !g.parent || g.parent !== DYN) || kitMesh(() => car(0, 0, Math.PI / 2, '#a83a4a', '#d8d0c0')); if (!CARPOOL.includes(free)) CARPOOL.push(free); DYN.add(free); return free; }
function mkDog(col) {
  const r = new THREE.Group(), b = new THREE.Group(); r.add(b); b.userData.mat = toonMat();
  part(b, G.sph(0.22, 0.2, 0.42), col, 0, 0.5, 0); part(b, G.sph(0.17, 0.16, 0.2), col, 0, 0.68, 0.42); part(b, G.sph(0.09, 0.08, 0.12), '#2a2020', 0, 0.64, 0.6);
  for (const s of [-1, 1]) { part(b, G.box(0.08, 0.16, 0.05), '#3a2a20', s * 0.12, 0.84, 0.36, { rot: [0.3, 0, s * 0.3] }); part(b, G.sph(0.03, 0.03, 0.03), '#14101f', s * 0.08, 0.74, 0.56, { outline: false }); }
  part(b, G.box(0.36, 0.06, 0.07), '#d23a3a', 0, 0.6, 0.3, { outline: false }); // collar
  const legs = []; for (const [x, z] of [[-0.12, 0.26], [0.12, 0.26], [-0.12, -0.26], [0.12, -0.26]]) { const l = new THREE.Group(); l.position.set(x, 0.45, z); l.userData.mat = b.userData.mat; b.add(l); part(l, G.cyl(0.05, 0.04, 0.42, 6), col, 0, -0.2, 0); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(0, 0.6, -0.4); tail.userData.mat = b.userData.mat; b.add(tail); part(tail, G.cyl(0.03, 0.02, 0.3, 5), col, 0, 0.12, -0.06, { rot: [-0.6, 0, 0] });
  mergeParts(r); return { g: r, legs, tail };
}
function mkArabber() { // a horse-drawn produce cart (Baltimore's arabbers): painted cart, fruit crates, bells rack, a striped umbrella, the driver
  const g = new THREE.Group(), m = toonMat(); g.userData.mat = m;
  const H = new THREE.Group(); H.userData.mat = m; g.add(H); H.position.set(1.6, 0, 0);
  part(H, G.sph(0.32, 0.36, 0.8), '#8a5a3a', 0, 1.25, 0, { rot: [0, Math.PI / 2, 0] }); part(H, G.cap(0.15, 0.55), '#8a5a3a', 0.62, 1.62, 0, { rot: [0, 0, -0.7] }); part(H, G.sph(0.14, 0.15, 0.32), '#8a5a3a', 0.96, 1.85, 0, { rot: [0, Math.PI / 2, 0.4] });
  part(H, G.box(0.5, 0.06, 0.06), '#d23a3a', 0.62, 1.65, 0, { rot: [0, 0, -0.7], outline: false }); part(H, G.sph(0.05, 0.12, 0.2), '#2a1a12', 0.5, 1.95, 0, { outline: false }); // mane + plume
  part(H, G.cone ? G.cone(0.1, 0.3) : G.cyl(0.0, 0.12, 0.3, 6), '#ffd23c', 0.48, 2.12, 0, { outline: false });
  const hl = []; for (const [x, z] of [[0.42, 0.16], [0.42, -0.16], [-0.42, 0.16], [-0.42, -0.16]]) { const l = new THREE.Group(); l.position.set(x, 1.05, z); l.userData.mat = m; H.add(l); part(l, G.cyl(0.07, 0.06, 1.0, 6), '#7a4a2a', 0, -0.5, 0); part(l, G.cyl(0.08, 0.08, 0.08, 6), '#2a2020', 0, -1.0, 0); hl.push(l); }
  const C = new THREE.Group(); C.userData.mat = m; g.add(C); C.position.set(-0.6, 0, 0);
  part(C, G.box(2.0, 0.5, 1.3), '#e8c040', 0, 0.95, 0); part(C, G.box(2.05, 0.12, 1.35), '#2a5aa8', 0, 1.24, 0);
  for (const [x, col] of [[-0.6, '#d82a3a'], [0, '#f0a020'], [0.6, '#68b030']]) { part(C, G.box(0.55, 0.22, 1.1), '#a07040', x, 1.38, 0); for (let k = 0; k < 4; k++) part(C, G.sph(0.11, 0.11, 0.11, 6, 4), col, x + (k % 2 - 0.5) * 0.24, 1.55, (k < 2 ? -0.25 : 0.25), { outline: false }); }
  for (const s of [-1, 1]) { const w = G.tor(0.45, 0.05); part(C, w, '#d82a3a', 0, 0.48, s * 0.7); }
  part(C, G.cyl(0.03, 0.03, 1.6, 6), '#2a2020', -0.8, 2.0, 0); part(C, G.cyl(1.0, 0.0, 0.5, 8), '#e8e4dc', -0.8, 2.9, 0); part(C, G.cyl(1.02, 0.0, 0.5, 4), '#d82a3a', -0.8, 2.92, 0, { outline: false });
  part(C, G.box(0.06, 0.6, 1.0), '#c8a040', 0.85, 1.75, 0, { outline: false }); for (let k = -2; k <= 2; k++) part(C, G.sph(0.06, 0.06, 0.06, 6, 4), '#f0d060', 0.85, 2.05, k * 0.2, { outline: false }); // bells rack
  const D = new THREE.Group(); D.userData.mat = m; C.add(D); D.position.set(0.5, 1.3, 0); // the driver (a simple stand-in figure)
  part(D, G.cap(0.2, 0.35), '#3a6ab0', 0, 0.35, 0); part(D, G.sph(0.17, 0.18, 0.17), '#a07050', 0, 0.82, 0); part(D, G.cyl(0.3, 0.32, 0.05, 10), '#e8d8a0', 0, 0.97, 0); part(D, G.cyl(0.16, 0.18, 0.16, 10), '#e8d8a0', 0, 1.05, 0);
  mergeParts(g); return { g, hl, H };
}
function mkPigeons() { const g = new THREE.Group(), m = toonMat(); g.userData.mat = m; const birds = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Group(); b.userData.mat = m; g.add(b); b.position.set((i % 3 - 1) * 0.45 + (i > 2 ? 0.2 : 0), 0, (i > 2 ? 0.35 : -0.3));
    part(b, G.sph(0.11, 0.1, 0.16), '#8a8c9a', 0, 0.14, 0); part(b, G.sph(0.07, 0.07, 0.07), '#5a6a7a', 0, 0.25, 0.12); part(b, G.box(0.03, 0.03, 0.05), '#e0a040', 0, 0.24, 0.2, { outline: false });
    part(b, G.box(0.05, 0.05, 0.05), '#6ad0a0', 0, 0.2, 0.09, { outline: false }); for (const s of [-1, 1]) { const w = part(b, G.box(0.18, 0.02, 0.12), '#7a7c8c', s * 0.1, 0.16, -0.02, { outline: false }); w.userData.s = s; }
    b.userData.vy = 0; b.userData.vx = 0; b.userData.vz = 0; b.rotation.y = i * 1.3; birds.push(b); }
  for (const b of birds) { const keep = b.children.filter((c) => c.userData.s); keep.forEach((c) => (c.userData.keep = true)); mergeParts(b); }
  return { g, birds }; }
function mkBundle() { const g = new THREE.Group(); g.userData.mat = toonMat(); for (let k = 0; k < 4; k++) part(g, G.box(0.5, 0.1, 0.36), k % 2 ? '#efe9d8' : '#e2dccb', 0, 0.06 + k * 0.1, 0, { rot: [0, k * 0.12, 0] });
  part(g, G.box(0.06, 0.44, 0.38), '#c8a060', 0, 0.22, 0, { outline: false }); part(g, G.box(0.52, 0.44, 0.06), '#c8a060', 0, 0.22, 0, { outline: false }); return mergeParts(g); }
function mkPothole(r) { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 12), new THREE.MeshBasicMaterial({ color: INK })), b = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshLambertMaterial({ color: '#26262a' }));
  for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; g.add(m); } a.position.y = 0.012; b.position.y = 0.02; b.scale.set(1, 0.72, 1); a.scale.set(1, 0.72, 1); return g; }
const CONE_MAT = toonMat(), PROP_MAT = toonMat();
function mkCone() { const g = new THREE.Group(); g.userData.mat = CONE_MAT; part(g, G.cyl(0.04, 0.24, 0.7, 10), '#ff7a1c', 0, 0.35, 0); part(g, G.cyl(0.13, 0.17, 0.12, 10), '#f6f2ea', 0, 0.38, 0, { outline: false }); part(g, G.box(0.5, 0.05, 0.5), '#ff7a1c', 0, 0.03, 0); return mergeParts(g); }
function mkRamp() { // a plywood kicker: a tilted deck on a back wall, yellow grip stripes
  const g = new THREE.Group(); g.userData.mat = PROP_MAT; const L = 2.4, Hh = 0.75, W = 2.2, a = Math.atan2(Hh, L), sl = Math.hypot(L, Hh);
  part(g, G.box(sl, 0.1, W), '#c8a050', L / 2, Hh / 2, 0, { rot: [0, 0, a] }); part(g, G.box(0.12, Hh, W), '#8a6a3a', L - 0.06, Hh / 2, 0);
  for (const s of [-1, 1]) part(g, G.box(L, 0.08, 0.1), '#8a6a3a', L / 2, Hh / 2 - 0.1, s * (W / 2 - 0.05), { rot: [0, 0, a] });
  for (let k = 0.4; k < sl; k += 0.55) part(g, G.box(0.08, 0.02, W - 0.1), '#ffd23c', Math.cos(a) * k, Math.sin(a) * k + 0.07, 0, { rot: [0, 0, a], outline: false });
  return mergeParts(g); }
function mkTarget() { const g = new THREE.Group(); g.userData.mat = toonMat(); part(g, G.cyl(0.05, 0.05, 1.2, 6), '#2a2622', 0, 0.6, 0); const face = new THREE.Group(); face.userData.mat = g.userData.mat; face.position.y = 1.55; g.add(face);
  ['#f6f2ea', '#d82a3a', '#f6f2ea', '#d82a3a'].forEach((c, k) => { const d = G.cyl(0.5 - k * 0.12, 0.5 - k * 0.12, 0.06, 18); d.rotateX(Math.PI / 2); part(face, d, c, 0, 0, k * 0.012, { outline: k === 0 }); }); g.userData.face = face; return mergeParts(g); }

// ---------------- HUD (DOM over the canvas; system fonts only) ----------------
const UI = {}; ['hud', 'hDay', 'hScore', 'hPap', 'hLives', 'hSubs', 'hBar', 'hBarFill', 'hBarMe', 'pops', 'card', 'cardT', 'cardB', 'cardBtn', 'cardBtn2', 'ban', 'joy', 'knob', 'throwB', 'pauseB', 'muteB', 'keys', 'title', 'startB', 'best', 'vign', 'timer', 'say'].forEach((k) => (UI[k] = $(k)));
function setText(el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } }
const POPS = []; function pop(x, y, z, txt, cls = '') { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = txt; UI.pops.appendChild(el); POPS.push({ el, p: new THREE.Vector3(x, y, z), t: 0 }); if (POPS.length > 14) { const o = POPS.shift(); o.el.remove(); } }
let banT = 0; function banner(html, d = 1.4) { UI.ban.innerHTML = html; UI.ban.classList.add('on'); banT = d; }
let sayT = 0; function say(who, txt, d = 2.2) { UI.say.innerHTML = '<b>' + who + '</b>' + txt; UI.say.classList.add('on'); sayT = d; }
function vign(c) { UI.vign.style.boxShadow = 'inset 0 0 120px 40px ' + c; UI.vign.style.opacity = '1'; setTimeout(() => (UI.vign.style.opacity = '0'), 160); }

// ---------------- audio: Toad City sfx + paperboy extras + a procedural B-more club loop ----------------
let MUTE = localStorage.getItem('tcpb_mute') === '1', MUS = null;
function tone(type, f0, f1, dur, vol, t0 = 0) { if (!AC || MUTE) return; const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS); o.start(t); o.stop(t + dur + 0.02); }
function noise(dur, f, q, vol, type = 'bandpass', t0 = 0) { if (!AC || MUTE) return; const t = AC.currentTime + t0, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(SFXBUS); s.start(t); s.stop(t + dur + 0.02); }
const SND = {
  throw() { if (!MUTE) sfx('swing'); }, thud() { if (!MUTE) sfx('hit'); }, crash() { if (!MUTE) sfx('heavy'); tone('sawtooth', 160, 50, 0.35, 0.14); },
  perfect() { if (!MUTE) sfx('ko'); tone('triangle', 1320, 0, 0.18, 0.08, 0.12); },
  glass() { noise(0.4, 5200, 0.6, 0.3, 'highpass'); for (let k = 0; k < 6; k++) tone('sine', 2400 + Math.random() * 2600, 0, 0.08, 0.05, 0.03 + k * 0.045); },
  bark() { tone('square', 520, 260, 0.09, 0.09); tone('square', 480, 230, 0.1, 0.08, 0.14); }, horn() { tone('sawtooth', 392, 0, 0.32, 0.06); tone('sawtooth', 466, 0, 0.32, 0.05); },
  bell() { tone('sine', 2100, 0, 0.35, 0.08); tone('sine', 2100, 0, 0.35, 0.07, 0.16); }, coo() { noise(0.25, 900, 2, 0.08); tone('sine', 420, 360, 0.18, 0.05, 0.05); },
  pick() { tone('square', 660, 0, 0.06, 0.06); tone('square', 990, 0, 0.1, 0.06, 0.07); }, jump() { if (!MUTE) sfx('jump'); }, hurt() { if (!MUTE) sfx('hurt'); },
};
function music(on) {
  if (!AC) return; if (!on) { if (MUS) { clearInterval(MUS.iv); MUS.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); MUS = null; } return; } if (MUS || MUTE) return;
  const g = AC.createGain(); g.gain.value = 0.0; g.connect(AC.destination); g.gain.setTargetAtTime(0.55, AC.currentTime, 0.4);
  const bpm = 132, st = 60 / bpm / 4; let next = AC.currentTime + 0.1, step = 0;
  const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0], CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], BASS = [41, 41, 44, 39];
  const hit = (t, fn) => { try { fn(t); } catch (e) {} };
  const sched = () => { while (next < AC.currentTime + 0.25) { const i = step % 16, bar = Math.floor(step / 16) % 4;
      if (KICK[i]) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); k.gain.setValueAtTime(0.5, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(k); k.connect(g); o.start(t); o.stop(t + 0.2); });
      if (CLAP[i]) hit(next, (t) => { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; k.gain.setValueAtTime(0.28, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(f); f.connect(k); k.connect(g); s.start(t); s.stop(t + 0.14); });
      if (i % 2 === 1) hit(next, (t) => { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 7000; k.gain.setValueAtTime(0.07, t); k.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(f); f.connect(k); k.connect(g); s.start(t); s.stop(t + 0.05); });
      if (i === 0 || i === 6 || i === 10) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (BASS[bar] - 69 + 12) / 12); f.type = 'lowpass'; f.frequency.value = 600; k.gain.setValueAtTime(0.12, t); k.gain.exponentialRampToValueAtTime(0.001, t + st * 3); o.connect(f); f.connect(k); k.connect(g); o.start(t); o.stop(t + st * 3.2); });
      if (i === 14 && bar === 3) hit(next, (t) => { const o = AC.createOscillator(), k = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + st); k.gain.setValueAtTime(0.03, t); k.gain.exponentialRampToValueAtTime(0.001, t + st * 2); o.connect(k); k.connect(g); o.start(t); o.stop(t + st * 2.1); });
      next += st; step++; } };
  MUS = { g, iv: setInterval(sched, 60) }; sched();
}
function setMute(m) { MUTE = m; localStorage.setItem('tcpb_mute', m ? '1' : '0'); setText(UI.muteB, m ? 'SOUND OFF' : 'SOUND ON'); if (m) music(false); else if (S.mode === 'ride' || S.mode === 'bonus') music(true); }

// ---------------- game state ----------------
const S = { mode: 'title', day: clamp(+(Q.get('day') || 0), 0, 6), score: 0, lives: 3, papers: 10, t: 0, best: +(localStorage.getItem('tcpb_best') || 0),
  r: { x: -10, z: -2.8, y: 0, vy: 0, v: 0, air: false, crash: 0, inv: 0, lean: 0, ph: 0, throwT: 0, pitch: 0, spin: 0 }, stats: null, hs: 0, shake: 0, paused: false, bonus: null };
const OBS = []; // per-day obstacles: {k, g, x, z, r, ...}
function initSubs() { for (const h of HOUSES) { h.sub = false; h.broken = false; } const pick = [0, 1, 3, 4, 6, 8, 9, 11, 14, 15, 17, 19, 21, 22, 24, 26]; for (const i of pick) HOUSES[i].sub = true; }
function subsCount() { return HOUSES.filter((h) => h.sub).length; }
function clearObs() { for (const o of OBS) { if (o.g && o.g.parent) o.g.parent.remove(o.g); } OBS.length = 0; for (const c of CARS) if (c.g.parent) c.g.parent.remove(c.g); CARS.length = 0; for (const p of PAPERS) { p.on = false; p.g.visible = false; } }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function inXst(x, m = 0) { return XST.some((s) => x > s.x0 - m && x < s.x1 + m); }
function spawnDay(d) {
  clearObs(); const R = rng(1000 + d * 77);
  // static curbside props (city kit): bins + hydrants, as obstacles; lamp posts + traffic light poles collide too
  for (const [x, z] of LAMPC) OBS.push({ k: 'prop', g: null, x, z, r: 0.3 });
  for (let x = 6; x < PB.L - 4; x += 9 + R() * 8) { if (inXst(x, 2)) continue; const k = R() < 0.5 ? 'bin' : 'hydrant'; const g = kitMesh(() => (k === 'bin' ? bin(0, 0, ['#22c4b4', '#3a5a3a', '#2a3a6a'][Math.floor(R() * 3)]) : hydrant(0, 0)));
    g.position.set(x, 0, -4.5); DYN.add(g); OBS.push({ k: 'prop', g, x, z: -4.5, r: 0.42 }); }
  for (let x = 52; x < PB.L; x += 70 + R() * 20) { if (inXst(x, 3)) continue; const g = kitMesh(() => tree(0, 0)); g.position.set(x, 0, -4.9); DYN.add(g); OBS.push({ k: 'prop', g, x, z: -4.9, r: 0.4 }); }
  // hon ladies (Mavis's rig): walkers on the sidewalk + a few on their stoops
  const nh = 2 + d; for (let i = 0; i < nh; i++) { const J = buildHero({ wife: true }); J.swR.visible = true; const x = 25 + R() * (PB.L - 40); if (inXst(x, 2)) continue; const walk = R() < 0.65;
    const z = walk ? -6.6 + R() * 2 : FZ + STOOP_D + 0.2; DYN.add(J.root); J.root.position.set(x, CURB, z); J.root.rotation.y = walk ? (R() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : 0;
    OBS.push({ k: 'hon', g: J.root, J, x, z, r: 0.42, vx: walk ? (J.root.rotation.y > 0 ? 1 : -1) * (0.6 + R() * 0.5) : 0, said: false, t: R() * 5 }); }
  // dogs: wait by a stoop, chase when Harold rolls past
  const nd = 1 + Math.floor(d * 0.7); for (let i = 0; i < nd; i++) { const h = HOUSES[3 + Math.floor(R() * (HOUSES.length - 4))]; const D = mkDog(['#a07040', '#3a3030', '#e8dcc0', '#8a8a90'][i % 4]); const x = h.x0 + 3.2, z = -6.9;
    D.g.position.set(x, CURB, z); DYN.add(D.g); OBS.push({ k: 'dog', g: D.g, D, x, z, r: 0.45, st: 'wait', t: 0, hx: x }); }
  // the arabber cart (from Tuesday): slow, in the parking lane
  const na = d >= 1 ? 1 + (d >= 4 ? 1 : 0) : 0; for (let i = 0; i < na; i++) { const A = mkArabber(), x = 40 + i * 90 + R() * 20; A.g.position.set(x, 0, -2.2); DYN.add(A.g); OBS.push({ k: 'arab', g: A.g, A, x, z: -2.2, r: 0.9, len: 2.3, vx: 1.7 + d * 0.12, t: 0, said: 0 }); }
  // pigeons on the sidewalk
  const np = 1 + Math.floor(d / 2); for (let i = 0; i < np; i++) { const P = mkPigeons(), x = 30 + R() * (PB.L - 50); if (inXst(x, 2)) continue; P.g.position.set(x, CURB, -5.8 + R() * 1.2); DYN.add(P.g); OBS.push({ k: 'pig', g: P.g, P, x, z: P.g.position.z, r: 0.75, up: 0 }); }
  // potholes
  const npt = 2 + d; for (let i = 0; i < npt; i++) { const x = 20 + R() * (PB.L - 30); if (inXst(x, 1)) continue; const z = [-1.2, 0.4, 2.2, 5.0][Math.floor(R() * 4)], r = 0.5 + R() * 0.25, g = mkPothole(r); g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'hole', g, x, z, r: r * 0.75 }); }
  // paper bundles
  for (const x of [45, 115, 170].slice(0, d >= 5 ? 2 : 3)) { const g = mkBundle(); const z = -5.4; g.position.set(x, CURB, z); DYN.add(g); OBS.push({ k: 'bundle', g, x, z, r: 0.75 }); }
  S.traffic = { d, nextA: 0, nextB: 0.5, cross: XST.map(() => false), R };
}
function spawnCar(z, dir, x, sp) { const g = takeCar(); g.rotation.y = dir > 0 ? 0 : Math.PI; g.position.set(x, 0, z); const o = { k: 'car', g, x, z, vx: dir * sp, vz: 0, half: 2.2, wid: 1.0 }; CARS.push(o); return o; }
function spawnCross(s, dirZ, sp) { const g = takeCar(); g.rotation.y = dirZ > 0 ? -Math.PI / 2 : Math.PI / 2; const x = (s.x0 + s.x1) / 2 + (dirZ > 0 ? -2.2 : 2.2), z = dirZ > 0 ? -30 : 34; g.position.set(x, 0, z); const o = { k: 'car', g, x, z, vx: 0, vz: dirZ * sp, half: 1.0, wid: 2.2, cross: true }; CARS.push(o); }
function trafficStep(dt) {
  const T_ = S.traffic, r = S.r; if (!T_) return; const d = T_.d;
  T_.nextA -= dt; T_.nextB -= dt;
  const dens = 0.55 + d * 0.12;
  if (T_.nextA <= 0) { T_.nextA = (5.5 - d * 0.45) / dens + T_.R() * 2; spawnCar(1.8, 1, r.x + 55 + T_.R() * 20, 2.6 + d * 0.25 + T_.R()); }
  if (T_.nextB <= 0) { T_.nextB = (4.2 - d * 0.35) / dens + T_.R() * 2; spawnCar(5.2, -1, r.x + 75 + T_.R() * 20, 6 + d * 0.5 + T_.R() * 2); }
  XST.forEach((s, i) => { if (T_.cross[i] || S.mode !== 'ride') return; const ahead = s.x0 - r.x; if (ahead < 26 && ahead > 10) { T_.cross[i] = true; if (T_.R() < 0.45 + d * 0.08) spawnCross(s, T_.R() < 0.5 ? 1 : -1, 7 + d * 0.6); } });
  for (let i = CARS.length - 1; i >= 0; i--) { const c = CARS[i];
    if (!c.cross) { const lead = CARS.find((o) => o !== c && !o.cross && o.z === c.z && Math.sign(o.x - c.x) === Math.sign(c.vx) && Math.abs(o.x - c.x) < 7); if (!lead) c.x += c.vx * dt; }
    else c.z += c.vz * dt;
    c.g.position.set(c.x, 0, c.z);
    if (Math.abs(c.x - r.x) > 120 || Math.abs(c.z) > 45) { c.g.parent && c.g.parent.remove(c.g); CARS.splice(i, 1); continue; }
    if (!c.honk && !c.cross && c.vx < 0 && c.x - r.x < 14 && c.x > r.x && Math.abs(c.z - r.z) < 1.4) { c.honk = true; SND.horn(); }
  }
}

// ---------------- input: keys, touch joystick + throw button, the bot ----------------
const KEY = {}; let THROW_Q = 0;
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); KEY[k] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if ((k === ' ' || k === 'j' || k === 'enter') && !e.repeat) { if (UI.card.classList.contains('on')) { cardPick(1); } else if (S.mode === 'title') startGame(); else THROW_Q++; }
  if ((k === 'p' || k === 'escape') && !e.repeat) togglePause(); if (k === 'm' && !e.repeat) setMute(!MUTE); });
addEventListener('keyup', (e) => { KEY[e.key.toLowerCase()] = false; });
const JOY = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
function showTouch() { document.body.classList.add('touch'); }
if (TOUCH) showTouch();
UI.joy.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); JOY.id = e.pointerId; const r = UI.joy.getBoundingClientRect(); JOY.cx = r.left + r.width / 2; JOY.cy = r.top + r.height / 2; joyMove(e); UI.joy.setPointerCapture(e.pointerId); });
UI.joy.addEventListener('pointermove', (e) => { if (e.pointerId === JOY.id) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== JOY.id) return; JOY.id = null; JOY.x = JOY.y = 0; UI.knob.style.transform = 'translate(-50%,-50%)'; };
UI.joy.addEventListener('pointerup', joyEnd); UI.joy.addEventListener('pointercancel', joyEnd);
function joyMove(e) { const R = UI.joy.clientWidth * 0.36; let dx = e.clientX - JOY.cx, dy = e.clientY - JOY.cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } JOY.x = dx / R; JOY.y = dy / R; UI.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
UI.throwB.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); THROW_Q++; UI.throwB.classList.add('dn'); });
UI.throwB.addEventListener('pointerup', () => UI.throwB.classList.remove('dn')); UI.throwB.addEventListener('pointercancel', () => UI.throwB.classList.remove('dn'));
UI.pauseB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); togglePause(); });
UI.muteB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); setMute(!MUTE); });
UI.startB.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); startGame(); });
let cardCb = null, cardCb2 = null, cardT = 0;
UI.cardBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(1); });
UI.cardBtn2.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(2); });
function card(title, body, btn, cb, btn2, cb2) { UI.cardT.innerHTML = title; UI.cardB.innerHTML = body; UI.cardBtn.textContent = btn; cardCb = cb; UI.cardBtn2.style.display = btn2 ? '' : 'none'; if (btn2) UI.cardBtn2.textContent = btn2; cardCb2 = cb2 || null; UI.card.classList.add('on'); cardT = 0; PB.log.push('card:' + title.replace(/<[^>]+>/g, ' ').trim()); }
function cardPick(n) { if (!UI.card.classList.contains('on') || cardT < 0.45) return; const cb = n === 2 ? cardCb2 : cardCb; if (!cb) return; UI.card.classList.remove('on'); cardCb = cardCb2 = null; cb(); }
function togglePause() { if (S.mode !== 'ride' && S.mode !== 'bonus') return; S.paused = !S.paused; document.body.classList.toggle('paused', S.paused); setText(UI.pauseB, S.paused ? 'RESUME' : 'PAUSE'); if (S.paused) music(false); else music(true); }
function readInput() {
  const I = { steer: 0, speed: 0, throw: THROW_Q > 0 }; THROW_Q = 0;
  if (KEY.arrowleft || KEY.a) I.steer -= 1; if (KEY.arrowright || KEY.d) I.steer += 1; if (KEY.arrowup || KEY.w) I.speed += 1; if (KEY.arrowdown || KEY.s) I.speed -= 1;
  if (JOY.id !== null) { if (Math.abs(JOY.x) > 0.18) I.steer += clamp(JOY.x * 1.25, -1, 1); if (Math.abs(JOY.y) > 0.25) I.speed -= clamp(JOY.y * 1.25, -1, 1); }
  // screen mapping: the street runs up-right, houses top-left. LEFT = toward the houses (-z), RIGHT = toward the road (+z), UP = faster
  if (BOTQ) botThink(I);
  I.steer = clamp(I.steer, -1, 1); I.speed = clamp(I.speed, -1, 1); return I;
}

// ---------------- papers ----------------
const GRAV = 14;
function throwPaper() {
  const r = S.r; if (r.throwT > 0 || r.crash > 0) return; if (S.mode === 'ride' && S.papers <= 0) { banner('OUT OF PAPERS!<small>GRAB A BUNDLE</small>', 1.1); SND.hurt(); return; }
  const p = PAPERS.find((q) => !q.on) || PAPERS[0]; p.on = true; p.spent = false; p.rest = 0; p.hit = null; p.g.visible = true;
  p.g.position.set(r.x + 0.15, r.y + 1.3, r.z - 0.3); p.v.set(r.v + 0.6, 3.0, -8.0); p.g.rotation.set(0, 0, 0);
  if (S.mode === 'ride') S.papers--; r.throwT = 0.3; S.stats.thrown++; SND.throw(); PB.log.push('throw');
}
function deliver(h, how, p) { if (!h.sub || h.delivered || h.brokeToday) return false; h.delivered = true; const pts = how === 'mailbox' ? 250 : 100; addScore(pts, p.g.position, how === 'mailbox' ? 'PERFECT! +250' : (how === 'door' ? 'DOOR +100' : 'STOOP +100'), how === 'mailbox' ? 'gold' : '');
  if (how === 'mailbox') { SND.perfect(); spawnSprite(FXT.star, p.g.position.clone(), 1.1, 0.4); S.stats.perfect++; } else SND.thud(); S.stats.delivered++; PB.log.push('deliver:' + h.num + ':' + how); return true; }
function addScore(n, pos, txt, cls) { S.score += n; if (pos) pop(pos.x, pos.y + 0.4, pos.z, txt || '+' + n, cls); }
function smash(h, p) { if (!h.glass || h.broken) return false; h.broken = true; h.glass.material = BROKEN_M; SND.glass(); S.hs = 0.06; S.shake = 0.25;
  spawnSprite(FXT.words[(h.i * 3) % FXT.words.length], p.g.position.clone().add(new THREE.Vector3(0, 0.6, 0.6)), 1.6, 0.6, { kind: 'word', aspect: 2.6 }); shards(p.g.position);
  if (h.sub) { h.brokeToday = true; S.stats.subBroke++; pop(p.g.position.x, p.g.position.y + 0.6, p.g.position.z, 'SUBSCRIBER! CANCEL...', 'bad'); say('HON', 'My window! Cancel my Sun, ya jagoff!'); PB.log.push('subwindow:' + h.num); }
  else { S.stats.smashed++; addScore(100 + S.stats.smashed * 10, p.g.position, 'SMASH! +' + (100 + S.stats.smashed * 10), 'gold'); PB.log.push('smash:' + h.num); }
  return true; }
const SHARDS = []; { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.12, 0.02, 0, 0.03, 0.15, 0], 3)); geo.computeVertexNormals();
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 ? '#cfe8ff' : '#ffffff', side: THREE.DoubleSide })); m.visible = false; scene.add(m); SHARDS.push({ m, v: new THREE.Vector3(), t: 0 }); } }
function shards(pos) { for (const s of SHARDS) { s.m.visible = true; s.m.position.copy(pos); s.v.set(rnd(-2, 2), rnd(1, 4), rnd(0.5, 4)); s.t = 1.2; } }
function paperStep(p, dt) {
  const g = p.g, P = g.position;
  if (p.rest > 0) { p.rest -= dt; if (p.rest <= 0) { p.on = false; g.visible = false; } return; }
  p.v.y -= GRAV * dt; P.addScaledVector(p.v, dt); g.rotation.y += dt * 14; g.rotation.x += dt * 3;
  const groundY = P.z < CURBZ || P.z > ROADZ1 ? CURB : 0;
  // the house fronts: mailbox / door / window / wall
  if (P.z <= FZ + 0.12 && P.z > FZ - 1 && S.mode === 'ride') {
    const h = HOUSES.find((q) => P.x >= q.x0 && P.x < q.x1); const y = P.y - CURB;
    if (h && !p.spent) {
      if (P.x >= h.mb[0] - 0.12 && P.x <= h.mb[1] + 0.12 && y >= 1.0 && y <= 1.75) { if (!deliver(h, 'mailbox', p)) SND.thud(); }
      else if (P.x >= h.win[0] && P.x <= h.win[1] && y >= 0.85 && y <= 2.65 && h.glass && !h.broken) smash(h, p);
      else if (P.x >= h.door - 0.5 && P.x <= h.door + 0.5 && y >= STOOP_H && y <= 2.7) { if (!deliver(h, 'door', p)) SND.thud(); }
      else SND.thud();
    } else if (!p.spent) SND.thud();
    p.spent = true; P.z = FZ + 0.13; p.v.z = Math.abs(p.v.z) * 0.25; p.v.x *= 0.3; p.v.y = Math.min(p.v.y, 0.5);
  }
  // stoops (three marble steps, deep to shallow)
  if (S.mode === 'ride' && P.z < FZ + STOOP_D && P.z > FZ) { const h = HOUSES.find((q) => P.x >= q.stoop[0] && P.x <= q.stoop[1]);
    if (h) { const step = clamp(Math.ceil((FZ + STOOP_D - P.z) / (STOOP_D / 3)), 1, 3), top = CURB + step * 0.15; if (P.y <= top + 0.05) { P.y = top + 0.06; if (!p.spent) { deliver(h, 'stoop', p) || SND.thud(); p.spent = true; } p.v.set(0, 0, 0); p.rest = 1.4; g.rotation.set(0, 0, 0); return; } } }
  // things on the street
  for (const o of OBS) { if (p.spent) break; const dx = P.x - o.x, dz = P.z - o.z;
    if (o.k === 'dog' && dx * dx + dz * dz < 0.5 && P.y < CURB + 1.0 && o.st !== 'stun') { o.st = 'stun'; o.t = 2.5; addScore(50, P, 'BONK! +50'); SND.bark(); spawnSprite(FXT.dizzy, new THREE.Vector3(o.x, 1.2, o.z), 1.0, 2.0, { depth: true }); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'hon' && dx * dx + dz * dz < 0.35 && P.y < CURB + 1.9) { addScore(0, P, 'HEY HON!', 'bad'); say('HON', ['Watch it, hon!', 'Ya hit me wit da Sun, hon!', 'Hon, I already read it!'][Math.floor(Math.random() * 3)]); SND.thud(); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'pig' && !o.up && dx * dx + dz * dz < 1.2 && P.y < CURB + 0.8) { o.up = 1; addScore(25, P, 'COO! +25'); SND.coo(); p.spent = true; }
    else if (o.k === 'arab' && Math.abs(dx - 0.5) < 2.2 && Math.abs(dz) < 0.8 && P.y < 2.4) { addScore(25, P, 'STRAWBERRIES! +25'); SND.thud(); p.spent = true; p.v.multiplyScalar(-0.2); }
    else if (o.k === 'target' && !o.down && Math.abs(dx) < 0.55 && Math.abs(P.z - o.z) < 0.45 && Math.abs(P.y - 1.55) < 0.75) { o.down = true; S.bonus.targets++; addScore(200, P, 'BULLSEYE! +200', 'gold'); SND.perfect(); spawnSprite(FXT.star, P.clone(), 1.0, 0.35); p.spent = true; p.v.multiplyScalar(-0.15); }
  }
  for (const c of CARS) { if (p.spent) break; if (Math.abs(P.x - c.x) < (c.cross ? 1.0 : 2.2) && Math.abs(P.z - c.z) < (c.cross ? 2.2 : 1.0) && P.y < 1.9) { addScore(25, P, 'CLANG! +25'); SND.thud(); p.spent = true; p.v.set(c.vx * 0.5, 2, -p.v.z * 0.3); } }
  if (P.y <= groundY + 0.07) { P.y = groundY + 0.07; if (!p.spent) { p.spent = true; S.stats.missed++; } p.v.set(0, 0, 0); p.rest = 1.0; g.rotation.set(0, g.rotation.y, 0); }
}

// ---------------- the ride ----------------
function riderHits(r) { // anything Harold runs into: returns a reason or null
  const hitC = (x, z, rad) => { const dx = Math.max(Math.abs(r.x - x) - 0.45, 0), dz = r.z - z; return dx * dx + dz * dz < rad * rad; };
  for (const o of OBS) {
    if (o.k === 'bundle' || o.k === 'target' || o.k === 'ramp' || o.k === 'finish') continue;
    if (o.k === 'hole') { if (!r.air && hitC(o.x, o.z, o.r)) return 'POTHOLE!'; continue; }
    if (r.air && r.y > 0.6) continue;
    if (o.k === 'pig') { if (!o.up && hitC(o.x, o.z, o.r)) return 'PIGEONS!'; continue; }
    if (o.k === 'dog' && o.st === 'stun') continue;
    if (o.k === 'arab') { if (Math.abs(r.x - (o.x + 0.5)) < 2.6 && Math.abs(r.z - o.z) < 1.0) return 'ARABBER CART!'; continue; }
    if (hitC(o.x, o.z, o.r + 0.32)) return o.k === 'hon' ? 'HON!' : o.k === 'dog' ? 'DOG!' : o.k === 'cone' ? 'CONE!' : 'OOF!';
  }
  for (const c of CARS) if (Math.abs(r.x - c.x) < c.half + 0.6 && Math.abs(r.z - c.z) < c.wid + 0.25) return 'CAR!';
  // stoops jut onto the sidewalk
  if (S.mode === 'ride' && r.z - 0.3 < FZ + STOOP_D) for (const h of HOUSES) if (r.x + 0.7 > h.stoop[0] && r.x - 0.7 < h.stoop[1]) return 'STOOP!';
  return null;
}
function crash(why) {
  const r = S.r; if (r.crash > 0 || r.inv > 0 || GOD) return; r.crash = 1.7; S.stats.crashes++; SND.crash(); S.hs = 0.12; S.shake = 0.8; vign('rgba(255,40,60,.85)'); banner(why + '<small>' + (S.mode === 'bonus' ? 'BONUS OVER' : 'WIPEOUT') + '</small>', 1.4);
  spawnSprite(FXT.words[1], new THREE.Vector3(r.x, 1.8, r.z), 1.8, 0.7, { kind: 'word', aspect: 2.6 }); spawnSprite(FXT.puff, new THREE.Vector3(r.x, 0.5, r.z), 1.4, 0.5); PB.log.push('crash:' + why + ':' + r.x.toFixed(1) + ':' + r.z.toFixed(1));
  try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
}
function afterCrash() {
  const r = S.r;
  if (S.mode === 'bonus') { endBonus(false); return; }
  S.lives--; if (S.lives <= 0) { gameOver('OUT OF LIVES'); return; }
  r.inv = 2.2; r.v = 2; r.z = clamp(r.z, -6.2, ZMAX); if (r.z < -4.2) r.z = -5.6; // back on the bike
  for (let i = CARS.length - 1; i >= 0; i--) if (Math.abs(CARS[i].x - r.x) < 12) { CARS[i].g.parent && CARS[i].g.parent.remove(CARS[i].g); CARS.splice(i, 1); }
  for (const o of OBS) if (o.k === 'dog' && o.st === 'chase') { o.st = 'stun'; o.t = 3; }
  for (const o of OBS) if (o.k === 'arab' && o.x - r.x > -6 && o.x - r.x < 12) { o.x = r.x + 16; if (Math.abs(r.z - o.z) < 1.6) r.z = o.z - 1.6; }
  banner('LIVES ' + S.lives + '<small>KEEP ROLLING</small>', 1.0);
}
function rideStep(dt, I) {
  const r = S.r, d = S.day, bonus = S.mode === 'bonus';
  r.throwT = Math.max(0, r.throwT - dt); r.inv = Math.max(0, r.inv - dt);
  if (r.crash > 0) { r.crash -= dt; r.v = damp(r.v, 0, 3, dt); r.x += r.v * dt; if (r.crash <= 0) afterCrash(); return; }
  const base = bonus ? 7 : 5.6 + d * 0.22, vT = clamp(base + I.speed * (I.speed > 0 ? 3.2 : 3.6), 2.0, base + 3.2);
  r.v = damp(r.v, vT, I.speed !== 0 ? 2.6 : 1.6, dt);
  r.x += r.v * dt; r.lean = damp(r.lean, I.steer, 6, dt);
  r.z = clamp(r.z + I.steer * 5.2 * dt, bonus ? -6.8 : ZMIN, ZMAX);
  // curb hop + air (ramps in the bonus course)
  const gy = r.z < CURBZ || r.z > ROADZ1 ? CURB : 0; r.ph += dt * r.v * 1.6;
  if (r.air) { r.vy -= 18 * dt; r.y += r.vy * dt; r.spin += dt * 5.5; if (r.y <= gy) { r.y = gy; r.air = false; r.spin = 0; spawnSprite(FXT.puff, new THREE.Vector3(r.x, 0.3, r.z), 0.9, 0.35); SND.thud(); S.shake = 0.2; } }
  else { r.y = damp(r.y, gy, 18, dt); }
  if (I.throw) throwPaper();
  // bundles + ramps
  for (let i = OBS.length - 1; i >= 0; i--) { const o = OBS[i];
    if (o.k === 'bundle' && Math.abs(r.x - o.x) < 0.9 && Math.abs(r.z - o.z) < 0.9) { const n = 10; S.papers = Math.min(30, S.papers + n); pop(o.x, 1.4, o.z, 'PAPERS +' + n, 'gold'); SND.pick(); o.g.parent && o.g.parent.remove(o.g); OBS.splice(i, 1); PB.log.push('bundle'); }
    else if (o.k === 'ramp' && !r.air && r.x > o.x && r.x < o.x + 2.4 && Math.abs(r.z - o.z) < 1.15) { r.air = true; r.vy = 6.2 + r.v * 0.15; r.y = 0.8; SND.jump(); if (!o.used) { o.used = true; S.bonus.ramps++; addScore(100, new THREE.Vector3(r.x, 2, r.z), 'AIR! +100'); } }
  }
  const why = riderHits(r); if (why) crash(why);
}
function obsStep(dt) {
  const r = S.r, t = S.t;
  for (const o of OBS) {
    if (o.k === 'hon') { o.t += dt; if (o.vx) { o.x += o.vx * dt; if (o.x < 4 || o.x > PB.L - 4 || inXst(o.x, 1)) { o.vx *= -1; o.g.rotation.y = o.vx > 0 ? Math.PI / 2 : -Math.PI / 2; } }
      o.g.position.x = o.x; applyPose(o.J, o.vx ? HERO_POSES.run(o.t, 1.6) : HERO_POSES.idle(o.t), 10, dt, false); if (o.vx) { o.J.hips.position.y = o.J.d.hip - 0.02 + Math.abs(Math.sin(o.t * 6)) * 0.03; }
      if (!o.said && Math.abs(o.x - r.x) < 6 && o.x > r.x) { o.said = true; if (Math.random() < 0.6) say('HON', ['Mornin\', hon!', 'Where\'s my Sun, hon?', 'Slow down, hon!', 'Hon, ya paper\'s late!'][Math.floor(Math.random() * 4)], 1.8); } }
    else if (o.k === 'dog') { const D = o.D; o.t -= dt;
      if (o.st === 'wait') { D.tail.rotation.x = Math.sin(t * 12) * 0.5; if (r.x > o.x + 0.5 && r.x < o.x + 4 && Math.abs(r.z - o.z) < 9 && r.crash <= 0 && r.inv <= 0) { o.st = 'chase'; o.t = 3.4; SND.bark(); pop(o.x, 1.2, o.z, 'WOOF!', 'bad'); } }
      else if (o.st === 'chase') { const tx = r.x - 0.2, tz = r.z, dx = tx - o.x, dz = tz - o.z, l = Math.hypot(dx, dz) || 1, sp = 6.5 + S.day * 0.18; o.x += dx / l * sp * dt; o.z += dz / l * sp * dt; o.g.rotation.y = Math.atan2(dx, dz);
        D.legs.forEach((l2, i) => (l2.rotation.x = Math.sin(t * 18 + i * 1.6) * 0.8)); D.tail.rotation.x = Math.sin(t * 20) * 0.6; if (o.t <= 0) { o.st = 'sit'; } if (Math.random() < dt * 1.2) SND.bark(); }
      else if (o.st === 'stun') { D.legs.forEach((l2) => (l2.rotation.x = 0.0)); if (o.t <= 0) o.st = 'sit'; }
      else { D.legs.forEach((l2) => (l2.rotation.x = 0)); }
      o.g.position.set(o.x, o.z < CURBZ ? CURB : 0, o.z); }
    else if (o.k === 'arab') { o.x += o.vx * dt; o.t += dt; o.g.position.x = o.x; o.A.hl.forEach((l2, i) => (l2.rotation.z = Math.sin(o.t * 7 + i * Math.PI / 2) * 0.4)); o.A.H.position.y = Math.abs(Math.sin(o.t * 7)) * 0.05;
      if (o.x > r.x && o.x - r.x < 14 && o.said < 1) { o.said = 1; say('ARABBER', 'STRAWBERRIES! WATERMELLLLON!', 2.2); SND.bell(); } }
    else if (o.k === 'pig') { const P = o.P; if (!o.up && Math.abs(r.x - o.x) < 2.6 && Math.abs(r.z - o.z) < 2.0 && r.v < 5.0) { o.up = 1; SND.coo(); }
      if (o.up) { o.up += dt; P.birds.forEach((b, i) => { b.position.y += dt * (2.5 + i * 0.3); b.position.x += dt * Math.cos(i) * 2; b.position.z += dt * (Math.sin(i * 2) * 2 - 1); b.children.forEach((c) => { if (c.userData.s) c.rotation.z = c.userData.s * Math.sin(t * 40) * 0.9; }); }); if (o.up > 3) o.g.visible = false; }
      else P.birds.forEach((b, i) => { b.rotation.x = Math.max(0, Math.sin(t * 3 + i * 2)) * 0.5; }); }
    else if (o.k === 'target' && o.down) { const f = o.g.userData.face; f.rotation.x = damp(f.rotation.x, -Math.PI / 2, 10, dt); }
    else if (o.k === 'bundle') o.g.rotation.y += dt * 1.5;
  }
}
// ---------------- render the rider ----------------
function riderPose(dt) {
  const r = S.r, J = HAROLD; RIDER.position.set(r.x, r.y, r.z);
  const crashU = r.crash > 0 ? 1 - r.crash / 1.7 : 0;
  RIDER.rotation.set(r.crash > 0 ? 0 : -r.lean * 0.12, -r.lean * 0.22, r.air ? Math.sin(r.spin) * 0.25 : 0);
  BIKE.userData.wF.rotation.z -= r.v * dt / 0.33; BIKE.userData.wR.rotation.z -= r.v * dt / 0.33;
  let p;
  if (r.crash > 0) { p = HERO_POSES.down(crashU, crashU > 0.5); J.root.position.set(-0.08 - crashU * 1.6, 0.42 - crashU * 0.3, -crashU * 0.4); BIKE.rotation.set(Math.min(1.3, crashU * 3), 0, 0); }
  else { J.root.position.set(-0.08, 0.42, 0); BIKE.rotation.set(0, 0, 0);
    p = blank(); const ph = r.ph; p.torso = [0.55, 0, 0]; p.neck = [-0.45, 0, 0];
    p.lgL = [-1.25 - 0.45 * Math.sin(ph), 0, 0.1]; p.knL = [1.55 + 0.4 * Math.sin(ph + 1.3), 0, 0]; p.lgR = [-1.25 - 0.45 * Math.sin(ph + Math.PI), 0, -0.1]; p.knR = [1.55 + 0.4 * Math.sin(ph + Math.PI + 1.3), 0, 0];
    p.shR = [-1.15, 0, -0.15]; p.elR = [-0.35, 0, 0]; p.shL = [-1.15, 0, 0.15]; p.elL = [-0.35, 0, 0]; p.y = -0.36;
    if (r.throwT > 0) { const u = 1 - r.throwT / 0.3; p.shL = [lerp(-2.6, -0.6, ease(u)), 0, lerp(0.4, 1.4, u)]; p.elL = [lerp(-1.4, -0.1, u), 0, 0]; p.torso = [0.4, lerp(-0.5, 0.6, u), 0]; }
    if (r.air) { p.lgL = p.lgR = [-1.0, 0, 0]; p.knL = p.knR = [1.2, 0, 0]; p.shL = [-1.6, 0, 0.6]; } }
  J.handPaper.visible = r.throwT > 0.12;
  applyPose(J, p, r.crash > 0 ? 8 : 18, dt, false);
  // flicker while invulnerable
  RIDER.visible = !(r.inv > 0 && Math.floor(r.inv * 12) % 2 === 0);
}
// ---------------- camera: Paperboy's high angle, the street running up and to the right ----------------
const CAM = { x: 0, z: 0, y: 0, init: false };
function camStep(dt) {
  const r = S.r, port = VH() > VW() * 1.05, bonus = S.mode === 'bonus';
  const fx = r.x + (port ? 6.5 : 6), fz = port ? clamp(r.z * 0.45 - 3.4, -6.5, 0) : clamp(r.z * 0.55 - 4.4, -7, 1);
  if (!CAM.init) { CAM.x = fx; CAM.z = fz; CAM.init = true; }
  CAM.x = damp(CAM.x, fx, 6, dt); CAM.z = damp(CAM.z, fz, 3, dt);
  const off = port ? [-13.5, 17, 9.5] : [-11, 12.5, 15.5], sk = S.shake * 0.35; // portrait: the street runs up the screen, houses on the left
  camera.position.set(CAM.x + off[0] + (Math.random() - 0.5) * sk, off[1] + (Math.random() - 0.5) * sk, CAM.z + off[2]);
  camera.lookAt(CAM.x, 1.2, CAM.z);
  const fov = port ? 64 : 46; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  SKY.U && window.__sky && window.__sky.position.copy(camera.position);
  sun.target.position.set(r.x + 6, 0, r.z - 3); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60); sun.target.updateMatrixWorld();
}
function resize() {
  const w = VW(), h = VH(), dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25), lw = Math.round(w * dpr), lh = Math.round(h * dpr);
  renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); POST.uniforms.uHT.value = 5.2 * dpr; camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------------- the flow: title -> day card -> ride -> tally -> bonus -> next day ... -> week complete / game over ----------------
function startGame() {
  if (S.mode !== 'title' && S.mode !== 'over') return; audioInit(); try { AC && AC.resume(); } catch (e) {}
  UI.title.classList.remove('on'); document.body.classList.add('playing');
  S.score = 0; S.lives = 3; S.day = clamp(+(Q.get('day') || 0), 0, 6); initSubs(); PB.log.push('start'); startDay();
}
function startDay() {
  const d = S.day; S.mode = 'card'; for (const h of HOUSES) { h.delivered = false; h.brokeToday = false; h.broken = false; }
  buildStreet(); spawnDay(d); setLight(d === 6 ? 0.55 : d * 0.05);
  S.papers = 10; S.stats = { delivered: 0, perfect: 0, smashed: 0, subBroke: 0, thrown: 0, missed: 0, crashes: 0 };
  Object.assign(S.r, { x: -12, z: -2.6, y: 0, v: 0, crash: 0, inv: 0, air: false, throwT: 0 }); CAM.init = false;
  const subs = subsCount(); PB.log.push('day:' + d);
  card(DAYS[d] + '<small>E FORT AVE · LOCUST POINT</small>', `<p><b>${subs}</b> subscribers on the route · <b>${S.papers}</b> papers in the bag</p><p class="tip">${['Bright houses with the red mailbox flag take the Sun. Mailbox = PERFECT.', 'The arabber is out today. Give the cart room.', 'Dogs chase. A paper on the nose stops them.', 'Pigeons scatter if you slow down (or hit them with a paper).', 'Dark houses: smash a window for a bonus. Never a subscriber\'s!', 'Traffic\'s heavy on Saturdays. Watch the cross streets.', 'Sunday edition. Last day: keep your subscribers.'][d]}</p>`, 'RIDE ▶', () => { S.mode = 'ride'; music(true); banner(DAY3[d] + '<small>GO!</small>', 1.0); SND.bell(); });
}
function endDay() {
  if (S.mode !== 'ride') return; S.mode = 'card'; music(false); const st = S.stats;
  let kept = 0, lost = [], perfectDay = true; for (const h of HOUSES) { if (!h.sub) continue; if (h.delivered && !h.brokeToday) kept++; else { perfectDay = false; lost.push(h); } }
  for (const h of lost) h.sub = false;
  let gained = null; if (perfectDay && kept > 0) { const cand = HOUSES.filter((h) => !h.sub && !h.board); if (cand.length) { gained = cand[(S.day * 5) % cand.length]; gained.sub = true; } S.score += 1000; S.lives = Math.min(5, S.lives + 1); }
  S.score += kept * 50;
  const rows = HOUSES.map((h) => `<i class="${h === gained ? 'n' : lost.includes(h) ? 'x' : h.sub ? 's' : ''}" title="${h.num}"></i>`).join('');
  PB.log.push('tally:' + S.day + ':kept' + kept + ':lost' + lost.length);
  const subs = subsCount();
  if (subs <= 0) { gameOver('EVERY SUBSCRIBER CANCELLED'); return; }
  card(DAYS[S.day] + ' DONE<small>THE TOAD CITY SUN</small>', `<div class="route">${rows}</div>
    <p>Delivered <b>${st.delivered}</b> (${st.perfect} perfect) · Windows smashed <b>${st.smashed}</b></p>
    <p>${lost.length ? `<span class="bad">${lost.length} cancelled</span>` : '<span class="gold">PERFECT DELIVERY! +1000 · +1 LIFE</span>'}${gained ? ' · <span class="gold">NEW SUBSCRIBER: ' + gained.num + '</span>' : ''}</p>
    <p>Subscribers tomorrow: <b>${subs}</b> · Score <b>${S.score.toLocaleString()}</b></p>`, 'BONUS BMX COURSE ▶', startBonus);
}
function startBonus() {
  S.mode = 'card'; clearObs(); S.bonus = { t: 30 - S.day, targets: 0, ramps: 0, done: false };
  const R = rng(5000 + S.day); let x = BX0 + 10;
  while (x < BX1 - 10) { const k = R();
    if (k < 0.34) { const g = mkRamp(), z = [-5.2, -1.0, 3.0][Math.floor(R() * 3)]; g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'ramp', g, x, z }); x += 9; }
    else if (k < 0.62) { const g = mkTarget(), z = -8.6; g.position.set(x, 0, z); DYN.add(g); OBS.push({ k: 'target', g, x, z, down: false }); x += 5; }
    else { for (let i = 0; i < 2 + Math.floor(S.day / 3); i++) { const g = mkCone(), z = -6 + R() * 12; g.position.set(x + R() * 3, 0, z); DYN.add(g); OBS.push({ k: 'cone', g, x: g.position.x, z, r: 0.28 }); } x += 7; }
  }
  const fin = new THREE.Group(); fin.userData.mat = toonMat(); part(fin, G.box(0.3, 4.5, 0.3), '#2a2622', 0, 2.25, -7.5); part(fin, G.box(0.3, 4.5, 0.3), '#2a2622', 0, 2.25, 7.5); for (let k = 0; k < 10; k++) part(fin, G.box(0.25, 0.8, 1.5), k % 2 ? '#14101f' : '#f6f2ea', 0, 4.5, -6.75 + k * 1.5, { outline: false });
  fin.position.set(BX1, 0, 0); DYN.add(fin); OBS.push({ k: 'finish', g: fin, x: BX1, z: 0 });
  Object.assign(S.r, { x: BX0 - 6, z: 0, y: 0, v: 3, crash: 0, inv: 0, air: false }); CAM.init = false;
  card('BONUS BMX COURSE<small>THAMES ST · FELLS POINT</small>', `<p>Ramps <b>+100</b> · Targets <b>+200</b> · Finish <b>+1000</b> + time</p><p class="tip">Unlimited papers. One wipeout ends the bonus. ${S.bonus.t}s on the clock.</p>`, 'GO ▶', () => { S.mode = 'bonus'; music(true); SND.bell(); banner('BONUS!<small>' + S.bonus.t + ' SECONDS</small>', 1.0); });
}
function endBonus(finished) {
  if (S.mode !== 'bonus') return; S.mode = 'card'; music(false); const b = S.bonus; let add = 0;
  if (finished) { add = 1000 + Math.ceil(b.t) * 50; S.score += add; SND.perfect(); }
  PB.log.push('bonus:' + (finished ? 'finish' : 'out') + ':' + b.targets + ':' + b.ramps);
  const last = S.day >= 6;
  card(finished ? 'COURSE CLEAR!' : 'BONUS OVER', `<p>Targets <b>${b.targets}</b> · Air <b>${b.ramps}</b>${finished ? ` · Finish <b>+${add}</b>` : ''}</p><p>Score <b>${S.score.toLocaleString()}</b></p>`, last ? 'FINISH THE WEEK ▶' : 'NEXT DAY: ' + DAYS[S.day + 1] + ' ▶', () => { if (last) winWeek(); else { S.day++; startDay(); } });
}
function saveBest() { if (S.score > S.best) { S.best = S.score; localStorage.setItem('tcpb_best', String(S.best)); return true; } return false; }
function winWeek() { S.mode = 'over'; const nb = saveBest(); PB.log.push('win'); SND.perfect(); music(false);
  card('WEEK COMPLETE!<small>HAROLD KEPT THE ROUTE</small>', `<p><b>${subsCount()}</b> subscribers still taking the Sun</p><p>Final score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'PLAY AGAIN', () => { S.mode = 'over'; startGame(); }); }
function gameOver(why) { S.mode = 'over'; music(false); const nb = saveBest(); PB.log.push('gameover:' + why);
  card('GAME OVER<small>' + why + '</small>', `<p>Made it to <b>${DAYS[S.day]}</b> · Score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'RETRY FROM MONDAY', () => { S.mode = 'over'; startGame(); }); }

// ---------------- HUD update ----------------
function hud() {
  setText(UI.hDay, S.mode === 'bonus' ? 'BONUS' : DAY3[S.day]); setText(UI.hScore, S.score.toLocaleString());
  setText(UI.hPap, S.mode === 'bonus' ? '∞' : String(S.papers)); UI.hPap.parentNode.classList.toggle('low', S.mode === 'ride' && S.papers <= 2);
  setText(UI.hLives, '♥'.repeat(Math.max(0, S.lives))); setText(UI.hSubs, String(subsCount()));
  const u = S.mode === 'bonus' ? clamp((S.r.x - BX0) / (BX1 - BX0), 0, 1) : clamp(S.r.x / ROUTE_END, 0, 1); UI.hBarMe.style.left = (u * 100).toFixed(1) + '%';
  if (S.mode === 'bonus') setText(UI.timer, Math.max(0, Math.ceil(S.bonus.t)) + 's'); UI.timer.style.display = S.mode === 'bonus' ? '' : 'none';
  if (!hud.marks || hud.marksDay !== S.day + ':' + S.mode) { hud.marksDay = S.day + ':' + S.mode; UI.hBar.querySelectorAll('i').forEach((e) => e.remove());
    if (S.mode !== 'bonus') for (const h of HOUSES) if (h.sub) { const e = document.createElement('i'); e.style.left = ((h.x0 + 2.5) / ROUTE_END * 100).toFixed(1) + '%'; e.dataset.h = h.i; UI.hBar.appendChild(e); } hud.marks = true; }
  UI.hBar.querySelectorAll('i').forEach((e) => { const h = HOUSES[+e.dataset.h]; e.className = h.delivered ? 'ok' : h.brokeToday ? 'x' : ''; });
}
const _pv = new THREE.Vector3();
function popsStep(dt) { const w = VW(), h = VH(); for (let i = POPS.length - 1; i >= 0; i--) { const p = POPS[i]; p.t += dt; p.p.y += dt * 0.9; if (p.t > 1.3) { p.el.remove(); POPS.splice(i, 1); continue; }
  _pv.copy(p.p).project(camera); p.el.style.transform = `translate(${((_pv.x * 0.5 + 0.5) * w).toFixed(0)}px, ${((-_pv.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%) scale(${p.t < 0.12 ? 0.6 + p.t * 4 : 1})`; p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1'; } }

// ---------------- test bot (QA + capture): delivers to subscribers, dodges, takes bundles; ?bot=lose rides into traffic ----------------
const BOTS = { z: -3.4, card: 0 };
function predictLanding(r) { // simulate a throw from here: where does it end up? -> {house, kind}
  const P = new THREE.Vector3(r.x + 0.15, r.y + 1.3, r.z - 0.3), V = new THREE.Vector3(r.v + 0.6, 3.0, -8.0), dt = 1 / 120;
  for (let i = 0; i < 160; i++) { V.y -= GRAV * dt; P.addScaledVector(V, dt);
    if (P.z <= FZ + 0.12) { const h = HOUSES.find((q) => P.x >= q.x0 && P.x < q.x1), y = P.y - CURB; if (!h) return null;
      if (P.x >= h.mb[0] - 0.12 && P.x <= h.mb[1] + 0.12 && y >= 1.0 && y <= 1.75) return { h, k: 'mailbox' };
      if (P.x >= h.win[0] && P.x <= h.win[1] && y >= 0.85 && y <= 2.65) return { h, k: 'window' };
      if (P.x >= h.door - 0.5 && P.x <= h.door + 0.5 && y >= STOOP_H && y <= 2.7) return { h, k: 'door' }; return null; }
    if (P.z < FZ + STOOP_D) { const h = HOUSES.find((q) => P.x >= q.stoop[0] && P.x <= q.stoop[1]); if (h) { const step = clamp(Math.ceil((FZ + STOOP_D - P.z) / (STOOP_D / 3)), 1, 3); if (P.y <= CURB + step * 0.15 + 0.05) return { h, k: 'stoop' }; } }
    if (P.y <= (P.z < CURBZ ? CURB : 0)) return null; }
  return null;
}
function botThink(I) {
  const r = S.r;
  if (UI.card.classList.contains('on')) { BOTS.card += 1 / 60; if (BOTS.card > (FAST ? 0.6 : 1.4)) { BOTS.card = 0; cardPick(1); } return; }
  if (S.mode === 'title') { startGame(); return; }
  if (S.mode !== 'ride' && S.mode !== 'bonus') return;
  if (BOTQ === 'lose') { I.steer = clamp((5.2 - r.z) * 0.8, -1, 1); I.speed = 1; return; }
  // lane choice: candidate z values scored by clearance over the next ~1.6 s
  const cand = S.mode === 'bonus' ? [-5.2, -3, -1, 1, 3, 5] : [-6.6, -5.7, -4.8, -3.4, -2.4, -0.6, 0.8, 3.4];
  const want = S.mode === 'bonus' ? -5.4 : -5.7; // ride the sidewalk: close enough for mailbox PERFECTs
  let best = BOTS.z, bs = -1e9;
  for (const zc of cand) { let s = -Math.abs(zc - want) * 0.6 - Math.abs(zc - r.z) * 0.25;
    for (let k = 0; k <= 8; k++) { const tt = k * 0.2, x = r.x + r.v * tt, z = r.z + clamp(zc - r.z, -4.6 * tt, 4.6 * tt); // where Harold is on the way there
      for (const o of OBS) { if (o.k === 'bundle') { if (Math.abs(o.x - x) < 1 && Math.abs(o.z - z) < 1 && S.papers < 12) s += 4; continue; } if (o.k === 'target' || o.k === 'finish') continue;
        if (o.k === 'ramp') { continue; } if (o.k === 'pig' && o.up) continue; if (o.k === 'dog' && o.st === 'stun') continue;
        const ox = o.x + (o.vx || 0) * tt + (o.k === 'dog' && o.st === 'chase' ? r.v * tt : 0), half = o.k === 'arab' ? 3.0 : 1.2, wid = o.k === 'arab' ? 1.2 : (o.r || 0.5) + 0.9;
        if (Math.abs(ox - x) < half && Math.abs(o.z - z) < wid) s -= 50 / (1 + k); }
      for (const c of CARS) { const cx = c.x + c.vx * tt, cz = c.z + c.vz * tt; if (Math.abs(cx - x) < c.half + 1.4 && Math.abs(cz - z) < c.wid + 0.9) s -= 60 / (1 + k * 0.5); }
      if (S.mode === 'ride' && z - 0.3 < FZ + STOOP_D) s -= 100; }
    if (s > bs) { bs = s; best = zc; } }
  BOTS.z = best; I.steer = clamp((best - r.z) * 1.6, -1, 1);
  const blocked = bs < -20, dog = OBS.some((o) => o.k === 'dog' && o.st === 'chase');
  const pig = OBS.some((o) => o.k === 'pig' && !o.up && o.x > r.x && o.x - r.x < 7 && Math.abs(o.z - r.z) < 1.6);
  I.speed = pig ? -1 : dog ? 1 : blocked ? -1 : (S.mode === 'bonus' ? 0.6 : 0);
  // throw: a predicted hit on an undelivered subscriber, or a dark window when papers are spare
  if (S.mode === 'ride' && r.throwT <= 0 && S.papers > 0) { const L = predictLanding(r);
    if (L) { const spare = S.papers - HOUSES.filter((h) => h.sub && !h.delivered && h.x0 > r.x).length;
      let later = false; if (L.k !== 'mailbox' && L.h.sub) { const sx = r.x; for (const dx of [0.35, 0.7, 1.05]) { r.x = sx + dx; const L2 = predictLanding(r); if (L2 && L2.h === L.h && L2.k === 'mailbox') later = true; } r.x = sx; }
      if (L.h.sub && !L.h.delivered && L.k !== 'window' && !later) I.throw = true; else if (!L.h.sub && L.k === 'window' && !L.h.broken && spare > 2) I.throw = true; } }
  if (S.mode === 'bonus' && r.throwT <= 0) for (const o of OBS) if (o.k === 'target' && !o.down) { const tt = (r.z - 0.3 - o.z) / 8.0, px = r.x + 0.15 + (r.v + 0.6) * tt; if (Math.abs(px - o.x) < 0.35 && tt > 0) I.throw = true; }
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
resize(); initSubs(); buildStreet(); spawnDay(S.day); setLight(0.05); Object.assign(S.r, { x: 12, z: -3.0, v: 0 });
setText(UI.best, S.best ? 'BEST ' + S.best.toLocaleString() : ''); setText(UI.muteB, MUTE ? 'SOUND OFF' : 'SOUND ON');
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc >= 1) { PB.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  PB.frames++;
  if (PB.freeze) rdt = 0; // capture mode: the test advances the sim itself, frames only render
  else { sim(rdt); riderPose(rdt); camStep(rdt); }
  hud(); popsStep(rdt);
  renderer.info.autoReset = false; renderer.info.reset(); renderer.setRenderTarget(RT); renderer.render(scene, camera); PB.calls = renderer.info.render.calls; PB.tris = renderer.info.render.triangles;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
function sim(rdt) {
  if (banT > 0 && (banT -= rdt) <= 0) UI.ban.classList.remove('on'); if (sayT > 0 && (sayT -= rdt) <= 0) UI.say.classList.remove('on');
  let dt = rdt; if (S.hs > 0) { S.hs -= rdt; dt = rdt * 0.08; } S.shake = Math.max(0, S.shake - rdt * 2.2);
  const I = readInput();
  if (!S.paused) {
    S.t += dt;
    if (S.mode === 'ride' || S.mode === 'bonus') {
      rideStep(dt, I); obsStep(dt); if (S.mode === 'ride') trafficStep(dt);
      if (S.mode === 'ride' && S.r.x >= ROUTE_END && S.r.crash <= 0) endDay();
      if (S.mode === 'bonus') { S.bonus.t -= dt; if (S.r.x >= BX1 && S.r.crash <= 0) endBonus(true); else if (S.bonus.t <= 0) { banner('TIME!', 1); endBonus(false); } }
    } else if (S.mode === 'title') { const r = S.r; r.v = 4.2; r.x += r.v * dt; r.ph += dt * r.v * 1.6; if (r.x > 120) r.x = 12; obsStep(dt); }
    for (const p of PAPERS) if (p.on) paperStep(p, dt);
    for (const s of SHARDS) if (s.m.visible) { s.t -= dt; s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 9; s.m.rotation.y += dt * 7; if (s.t <= 0 || s.m.position.y < 0) s.m.visible = false; }
    updateSprites(dt);
  }
  cardT += rdt; PB.simT = (PB.simT || 0) + rdt;
}
// QA: run the simulation forward without rendering (headless Chrome renders with SwiftShader, far below real-device speed)
PB.advance = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { sim(1 / 60); riderPose(1 / 60); camStep(1 / 60); popsStep(1 / 60); } hud(); };
PB.stats = () => ({ mode: S.mode, day: S.day, x: +S.r.x.toFixed(1), z: +S.r.z.toFixed(1), score: S.score, lives: S.lives, papers: S.papers, subs: subsCount(), st: S.stats, card: UI.card.classList.contains('on') ? UI.cardT.textContent : null, fps: PB.fps, err: window.__celErr.n, calls: PB.calls, tris: PB.tris });
requestAnimationFrame(frame);
UI.title.classList.add('on');
PB.S = S; PB.HOUSES = HOUSES; PB.start = startGame; PB.card = cardPick; PB.ready = true;

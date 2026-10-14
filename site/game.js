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
  uniforms: { tSrc: { value: RT.texture }, uRes: { value: new THREE.Vector2(320, 240) }, uDither: { value: Q.get('dither') === '0' ? 0 : 1 }, uPost: QUAL.post },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; varying vec2 vUv;
    float bayer4(vec2 p) { // 4x4 ordered-dither threshold in [0,1)
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0; }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 px = floor(vUv * uRes);
      vec3 c = toSRGB(texture2D(tSrc, (px + 0.5) / uRes).rgb);
      if (uPost < 0.5) { gl_FragColor = vec4(c, 1.0); return; } // HD: straight copy
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
const CB = new CMB(), DB = new CMB(), OL = new OB(), GB = new CMB(); // city, decals, outlines (no-op), ground (no shadow cast)
// LMCAP(id): route the city + decal builders into a per-landmark capture (that landmark's far LOD; 03b_landmarks_hd.js adds the HD near model); LMCAP(null) ends it
const LM_CAPS = {}; function LMCAP(id) { if (!id) { CB.cap = DB.cap = null; return; } LM_CAPS[id] = { cb: (CB.cap = new MB()), db: (DB.cap = new MB()) }; }
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- Toad City Baltimore: the Inner Harbor, real map compressed ~3x ----------------
// X east, Z south (north = -Z). The harbour basin + the Northwest Branch run east to the world edge; land ~2 blocks deep rings it.
// Blocks are 24 m with 10 m streets (period 34). A 6 m brick promenade runs along every water edge; piers / plazas jut into the water.
const CURB = 0.16, GF = 4.4, FH = 3.4, PAR = 1.3, WY = -0.85; // curb height, ground floor, floor height, parapet, water level
const WB = { x0: -136, x1: 213, z0: -106, z1: 104 }; // walkable world bounds
const BASIN = { x0: -60, x1: 400, z0: -30, z1: 30 }; // the water (runs off the east edge into the fog)
const PROM = 6; // promenade width
// land that juts into the water: [x0, x1, z0, z1, floor tile, seawall sides]
const PIERS = [
  { id: 'hp1', x0: -60, x1: -44, z0: -30, z1: -20, t: 'pave', w: 'se' },   // Harborplace (light st pavilion plaza)
  { id: 'hp2', x0: -60, x1: -50, z0: -20, z1: 4, t: 'pave', w: 'es' },     // Harborplace (pratt st side) along the west wall
  { id: 'p1', x0: -40, x1: -35, z0: -30, z1: -8, t: 'plank', w: 'wes' },   // USS Constellation pier
  { id: 'wtc', x0: -20, x1: -4, z0: -30, z1: -14, t: 'pave', w: 'wes' },   // World Trade Center
  { id: 'p3', x0: 6, x1: 32, z0: -30, z1: -4, t: 'pave', w: 'wes' },       // Aquarium (pier 3)
  { id: 'p4', x0: 44, x1: 68, z0: -30, z1: -4, t: 'pave', w: 'wes' },      // Power Plant (pier 4)
  { id: 'rec', x0: 110, x1: 142, z0: -30, z1: -18, t: 'plank', w: 'wes' }, // Pendry (recreation pier)
  { id: 'rash', x0: -42, x1: -21, z0: 19, z1: 30, t: 'pave', w: 'we' },     // lexington: Rash Field on the south shore (its north seawall is drawn in 03d_lexington.js)
];
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
function onPier(x, z) { for (const p of PIERS) if (inR(p, x, z)) return p; return null; }
function isWater(x, z) { return inR(BASIN, x, z) && !onPier(x, z); }
// landmark reservations (generic blocks inside are dropped) + generic blocks
const RES = [
  { x0: -136, x1: -76, z0: -36, z1: 36 },  // Oriole Park
  { x0: -136, x1: -76, z0: 46, z1: 106 },  // M&T Bank Stadium
  { x0: -32, x1: -8, z0: -104, z1: -80 },  // Washington Monument
  { x0: 70, x1: 94, z0: -70, z1: -46 },    // Four Seasons
  { x0: 138, x1: 162, z0: -70, z1: -46 },  // Fells Point market hall
  { x0: -66, x1: -42, z0: 46, z1: 70 },    // Science Center
  { x0: -32, x1: 26, z0: 46, z1: 72 },     // Federal Hill
  { x0: 70, x1: 94, z0: 46, z1: 70 },      // Domino Sugar
  { x0: 104, x1: 128, z0: 46, z1: 70 },    // Under Armour (Tide Point)
  { x0: 138, x1: 213, z0: 46, z1: 106 },   // Fort McHenry grounds
  { x0: -134, x1: -110, z0: -70, z1: -46 }, // lexington: Westminster Burying Ground (downtown-west district)
  { x0: -100, x1: -76, z0: -70, z1: -46 },  // lexington: Lexington Market
];
const BLOCKS = [];
{ const cols = []; for (let k = 0; k < 10; k++) cols.push(-134 + k * 34);
  for (const zr of [[-70, -46], [-104, -80], [46, 70], [80, 104]]) for (const x of cols) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
  for (const zr of [[-36, -6], [4, 36]]) for (const x of [-134, -100]) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
}
const ovl = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const GEN = BLOCKS.filter((b) => !RES.some((r) => ovl(r, b)));
const PLOTS = GEN.concat(RES); // raised (curb height) ground
function isProm(x, z) { return !inR(BASIN, x, z) && x >= BASIN.x0 - PROM && z >= BASIN.z0 - PROM && z <= BASIN.z1 + PROM; }
// a coarse lookup grid for "is this a raised plot" (4 m cells)
const PG = new Map(); const pgk = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
for (const b of PLOTS) for (let x = Math.floor(b.x0 / 4); x * 4 < b.x1; x++) for (let z = Math.floor(b.z0 / 4); z * 4 < b.z1; z++) { const k = x + ',' + z; (PG.get(k) || PG.set(k, []).get(k)).push(b); }
function onPlot(x, z) { const a = PG.get(pgk(x, z)); if (a) for (const b of a) if (inR(b, x, z)) return b; return null; }
function isRoad(x, z) { return !inR(BASIN, x, z) && !isProm(x, z) && !onPlot(x, z); }
// Federal Hill: a real walkable mound (the ground height follows it)
const HILL = { x: -3, z: 59, rx: 28, rz: 13, h: 9 };
function hillH(x, z) { const d = Math.hypot((x - HILL.x) / HILL.rx, (z - HILL.z) / HILL.rz); if (d >= 1) return 0; const t = clamp((1 - d) / 0.8, 0, 1); return HILL.h * t * t * (3 - 2 * t); }
// raised walkable ground (Fort McHenry's north-bastion gun platform + its ramp): { x0, x1, z0, z1, h, rampZ? } rampZ = the z where a ramp side reaches 0
const RAMPS = [{ x0: 173.6, x1: 178.4, z0: 63.6, z1: 67.6, h: 3.3 }, { x0: 174.4, x1: 177.6, z0: 67.6, z1: 72.4, h: 3.3, ramp: [67.6, 72.4] }];
function rampH(x, z) { let h = 0; for (const r of RAMPS) { if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue; const v = r.ramp ? r.h * clamp(1 - (z - r.ramp[0]) / (r.ramp[1] - r.ramp[0]), 0, 1) : r.h; if (v > h) h = v; } return h; }
function groundY(x, z) { if (isWater(x, z)) return CURB; if (isRoad(x, z)) return 0; return CURB + hillH(x, z) + rampH(x, z); }

// ---------------- ground: streets, promenade, plots, piers, water, seawalls ----------------
(function ground() {
  // streets (y 0) over all land regions
  GB.floorSub(WB.x0 - 30, WB.z0 - 30, 240, BASIN.z0 - PROM, 0, T.road, '#fff', 6, 8);
  GB.floorSub(WB.x0 - 30, BASIN.z1 + PROM, 240, WB.z1 + 30, 0, T.road, '#fff', 6, 8);
  GB.floorSub(WB.x0 - 30, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z1 + PROM, 0, T.road, '#fff', 6, 8);
  // promenade (brick pavers) + its curb toward the street
  const prom = [[BASIN.x0 - PROM, BASIN.z0 - PROM, 240, BASIN.z0], [BASIN.x0 - PROM, BASIN.z1, 240, BASIN.z1 + PROM], [BASIN.x0 - PROM, BASIN.z0, BASIN.x0, BASIN.z1]];
  for (const [x0, z0, x1, z1] of prom) GB.floorSub(x0, z0, x1, z1, CURB, T.pave, '#fff', 3, 6);
  GB.wall(240, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z0 - PROM, 0, CURB, T.white, '#9a958c');
  GB.wall(BASIN.x0 - PROM, BASIN.z1 + PROM, 240, BASIN.z1 + PROM, 0, CURB, T.white, '#9a958c');
  GB.wall(BASIN.x0 - PROM, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z1 + PROM, 0, CURB, T.white, '#9a958c');
  // plots: sidewalk (or grass / cobbles for parks and the old waterfront) + curbs
  for (const b of PLOTS) {
    const fells = b.x0 >= 138 && b.x1 <= 200 && b.z1 < 0, park = RES.includes(b) && (b.x0 === -32 || b.x0 === 138 && b.z0 > 0);
    if (!(b.x0 === -32 && b.z0 === 46)) GB.floorSub(b.x0, b.z0, b.x1, b.z1, CURB, park ? T.grass : fells ? T.cobble : T.walk, '#fff', park ? 4 : 2, 6);
    GB.wall(b.x0, b.z1, b.x1, b.z1, 0, CURB, T.white, '#9a958c'); GB.wall(b.x1, b.z0, b.x0, b.z0, 0, CURB, T.white, '#9a958c');
    GB.wall(b.x1, b.z1, b.x1, b.z0, 0, CURB, T.white, '#9a958c'); GB.wall(b.x0, b.z0, b.x0, b.z1, 0, CURB, T.white, '#9a958c');
  }
  // piers + plazas
  for (const p of PIERS) GB.floorSub(p.x0, p.z0, p.x1, p.z1, CURB, T[p.t], '#fff', 3, 6);
  // seawalls (granite), facing the water
  const SWC = '#7a7468', yb = WY - 0.3;
  GB.wall(BASIN.x0, BASIN.z0, 240, BASIN.z0, yb, CURB, T.white, SWC); GB.wall(240, BASIN.z1, BASIN.x0, BASIN.z1, yb, CURB, T.white, SWC); GB.wall(BASIN.x0, BASIN.z1, BASIN.x0, BASIN.z0, yb, CURB, T.white, SWC);
  for (const p of PIERS) {
    if (p.w.includes('e')) GB.wall(p.x1, p.z1, p.x1, p.z0, yb, CURB, T.white, SWC);
    if (p.w.includes('w')) GB.wall(p.x0, p.z0, p.x0, p.z1, yb, CURB, T.white, SWC);
    if (p.w.includes('s')) GB.wall(p.x0, p.z1, p.x1, p.z1, yb, CURB, T.white, SWC);
  }
  // promenade edge: a low granite coping strip
  for (const [x0, z0, x1, z1] of [[BASIN.x0 - 0.1, BASIN.z0 - 0.35, 240, BASIN.z0], [BASIN.x0 - 0.1, BASIN.z1, 240, BASIN.z1 + 0.35], [BASIN.x0 - 0.35, BASIN.z0, BASIN.x0, BASIN.z1]]) DB.floor(x0, z0, x1, z1, CURB + 0.01, T.white, '#c8c2b4');
  // street paint: centre dashes on the two waterfront avenues (Pratt St / Key Hwy) and Light St
  const Y = new THREE.Color('#d8b040'), W = new THREE.Color('#d8d4c8');
  for (let x = -130; x < 212; x += 6) { DB.floor(x, -41.15, x + 3, -40.85, 0.012, T.white, Y); DB.floor(x, 40.85, x + 3, 41.15, 0.012, T.white, Y); }
  for (let z = -100; z < 102; z += 6) DB.floor(-71.15, z, -70.85, z + 3, 0.012, T.white, Y);
})();
// the water: one big plane (cel-lit, tinted by the day/night cycle)
const WATER = (function water() {
  const g = new THREE.PlaneGeometry(BASIN.x1 - BASIN.x0 + 20, BASIN.z1 - BASIN.z0 + 2, 1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, toonMat({ vertexColors: false, color: new THREE.Color('#2f6f86') }));
  m.position.set((BASIN.x0 + BASIN.x1) / 2, WY, 0); m.receiveShadow = true; scene.add(m);
  // sparkle stripes on the water (decal ribbons), drift handled in 07
  return m;
})();
// Federal Hill mound (faceted grass heightfield)
(function hill() {
  const x0 = -32, x1 = 26, z0 = 46, z1 = 72, c = 2, col = new THREE.Color('#fff');
  const Y = (x, z) => CURB + hillH(x, z) - 0.02;
  for (let x = x0; x < x1; x += c) for (let z = z0; z < z1; z += c) {
    const a = [x, Y(x, z + c), z + c], b = [x + c, Y(x + c, z + c), z + c], cc = [x + c, Y(x + c, z), z], d = [x, Y(x, z), z];
    GB.quad(a, b, cc, d, [x / 4, -(z + c) / 4, (x + c) / 4, -z / 4], col, T.grass);
  }
  // a path of steps up the north face and the flagpole on top
  LMCAP('fedhill'); // landmarks: the flag is the far LOD of the HD park in 03f_landmarks_hd_b3.js
  const fp = new THREE.CylinderGeometry(0.12, 0.15, 12, 6); place(fp, HILL.x, CURB + HILL.h + 6, HILL.z); solid(fp, '#d8d8d0');
  const fl = new THREE.BoxGeometry(3.2, 1.9, 0.06); place(fl, HILL.x + 1.7, CURB + HILL.h + 10.9, HILL.z); CB.geom(fl, '#b03a3a', T.stripes);
  LMCAP(null); // landmarks
  BLD.push({ x0: HILL.x - 8, x1: HILL.x + 8, z0: HILL.z - 4, z1: HILL.z + 4, h: CURB + HILL.h - 1 });
})();

// ---------------- generic blocks: 1-3 buildings per block, storefronts on every street face ----------------
const DOOR_AT = { x: -44.95, z: -58 }; // the kickable STAFF door (06b) sits on the east face of this block's building
function bld(x0, z0, x1, z1, fl, pal, o) { const h = building(x0, z0, x1, z1, fl, pal, o); COLL.push({ x0, x1, z0, z1 }); return h; }
SEED = 1234;
for (const b of GEN) {
  const ix0 = b.x0 + 3, ix1 = b.x1 - 3, iz0 = b.z0 + 3, iz1 = b.z1 - 3;
  const fells = b.x0 >= 138 && b.z1 < 0, hEast = b.x0 >= 36 && b.z1 < 0 && !fells, south = b.z0 > 0, nearWater = Math.abs(b.z0) < 50 && Math.abs(b.z1) < 75;
  const door = b.x0 === -66 && b.z0 === -70;
  const n = door ? 1 : 1 + Math.floor(srnd() * 3), alongZ = door || srnd() < 0.5;
  const cuts = [0]; for (let i = 1; i < n; i++) cuts.push(i / n + (srnd() - 0.5) * 0.12); cuts.push(1);
  for (let i = 0; i < n; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1];
    const x0 = alongZ ? ix0 : lerp(ix0, ix1, t0), x1 = alongZ ? ix1 : lerp(ix0, ix1, t1), z0 = alongZ ? lerp(iz0, iz1, t0) : iz0, z1 = alongZ ? lerp(iz0, iz1, t1) : iz1;
    const fl = fells ? 1 + Math.floor(srnd() * 2) : hEast ? 4 + Math.floor(srnd() * 5) : 2 + Math.floor(srnd() * (nearWater ? 5 : 4));
    const pal = fells ? [0, 2, 3][Math.floor(srnd() * 3)] : Math.floor(srnd() * PAL.length);
    const shops = alongZ ? ['e', 'w'].concat(i === 0 ? ['n'] : [], i === n - 1 ? ['s'] : []) : ['n', 's'].concat(i === 0 ? ['w'] : [], i === n - 1 ? ['e'] : []);
    const o = { shops: door ? ['n', 's', 'w'] : shops, sign: Math.floor(srnd() * 8), v: srnd() < 0.5 ? 1 : 0 };
    if (!fells && srnd() < 0.25) o.tower = [0.5, 0.5];
    if (!fells && fl >= 3 && srnd() < 0.18) o.fire = shops[0];
    bld(x0, z0, x1, z1, fl, pal, o);
  }
}
// skyline wall just beyond the walkable edge (cheap, no detail): keeps the fog from showing an empty world
SEED = 99;
for (let x = -170; x < 240; x += 34) { building(x, -132, x + 30, -110, 6 + Math.floor(srnd() * 8), Math.floor(srnd() * 6), { ac: false }); building(x, 108, x + 30, 130, 5 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (let z = -106; z < 106; z += 30) { if (z > -40 && z < 36) continue; building(-170, z, -140, z + 26, 6 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (const zr of [[-106, -38], [38, 106]]) for (let z = zr[0]; z < zr[1]; z += 22) building(216, z, 240, Math.min(z + 20, zr[1]), 4 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false });
building(-170, -40, -140, 36, 9, 1, { ac: false });
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
// street furniture along the one block

// ---------------- landmark massings (Phase 1 placeholders: boxes / simple solids, ORIGINAL generic signs only) ----------------
const faceOf = (x0, z0, x1, z1, k) => ({ s: [x0, z1, x1, z1], n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], w: [x0, z0, x0, z1] })[k];
function mass(x0, z0, x1, z1, h, o = {}) {
  const y0 = o.y0 || CURB, col = new THREE.Color(o.col || '#fff');
  for (const k of ['s', 'n', 'e', 'w']) {
    const [xa, za, xb, zb] = faceOf(x0, z0, x1, z1, k), L = Math.hypot(xb - xa, zb - za);
    if (o.tr) CB.wall(xa, za, xb, zb, y0, y0 + h, o.tr, col, [0, 0, Math.max(1, Math.round(L / (o.bay || 3.6))), Math.max(1, Math.round(h / (o.fh || FH)))]);
    else CB.wall(xa, za, xb, zb, y0, y0 + h, T.white, col);
  }
  CB.quad([x0, y0 + h, z1], [x1, y0 + h, z1], [x1, y0 + h, z0], [x0, y0 + h, z0], null, new THREE.Color(o.top || '#6a665e'), T.white);
  if (o.trim !== false) sbox(x0 - 0.25, y0 + h - 0.35, z0 - 0.25, x1 + 0.25, y0 + h + 0.05, z1 + 0.25, o.trimCol || '#c9c2b0');
  if (o.coll !== false) COLL.push({ x0, x1, z0, z1 });
  BLD.push({ x0, x1, z0, z1, h: y0 + h, y0: o.y0 || 0 });
}
function signOn(x0, z0, x1, z1, k, y, w, tr, hh = w / 4) {
  const [xa, za, xb, zb] = faceOf(x0, z0, x1, z1, k), dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux, m = L / 2, off = 0.09;
  DB.wall(xa + ux * (m - w / 2) + nx * off, za + uz * (m - w / 2) + nz * off, xa + ux * (m + w / 2) + nx * off, za + uz * (m + w / 2) + nz * off, y, y + hh, tr, '#fff', [0.002, 0.002, 0.998, 0.998]);
}
function obox(cx, cz, len, th, h, ang, col, y0 = CURB) { const g = new THREE.BoxGeometry(len, h, th); g.translate(0, h / 2, 0); place(g, cx, y0, cz, ang); solid(g, col); }
function pole(x, z, h, r = 0.15, col = '#d8d8d0', y0 = CURB) { const g = new THREE.CylinderGeometry(r * 0.8, r, h, 6); place(g, x, y0 + h / 2, z); solid(g, col); COLL.push({ x, z, r: r + 0.15 }); }
// stepped grandstand along one side of a field: rows rise away from the field
function stand(x0, z0, x1, z1, h, away, col) {
  const n = 4; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = 1;
    const r = away === 'w' ? [lerp(x1, x0, t1), z0, lerp(x1, x0, t0), z1] : away === 'e' ? [lerp(x0, x1, t0), z0, lerp(x0, x1, t1), z1] : away === 'n' ? [x0, lerp(z1, z0, t1), x1, lerp(z1, z0, t0)] : [x0, lerp(z0, z1, t0), x1, lerp(z0, z1, t1)];
    CB.box(r[0], CURB, r[1], r[2], CURB + h * (i + 1) / n, r[3], i % 2 ? col : new THREE.Color(col).multiplyScalar(0.85), T.white); }
  COLL.push({ x0, x1, z0, z1 }); BLD.push({ x0, x1, z0, z1, h: CURB + h });
}
function standColl(x0, z0, x1, z1, h) { COLL.push({ x0, x1, z0, z1 }); BLD.push({ x0, x1, z0, z1, h: CURB + h }); } // stadiums: stand() colliders only
const LANDMARKS = [];
function landmark(id, name, x, z, r, boss) { LANDMARKS.push({ id, name, x, z, r, boss }); }

LMCAP('harborplace');
// Harborplace: two glassy market pavilions with green hip roofs, on plazas at the harbour's north-west corner
// (far LOD of the HD pavilions in 03c: eave slab top 6.85 m, copper-green hip roofs ~2.7 m)
for (const [x0, z0, x1, z1] of [[-58, -29, -46, -22], [-59, -18, -52, 2]]) {
  mass(x0, z0, x1, z1, 6.85, { tr: T.store[4], fh: 3.4, bay: 2.5, top: '#93bfa2', trimCol: '#ddd5c4' });
  const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale((x1 - x0) * 0.75, 2.7, (z1 - z0) * 0.75); place(g, (x0 + x1) / 2, CURB + 6.85 + 1.35, (z0 + z1) / 2); solid(g, '#93bfa2');
}
signOn(-58, -29, -46, -22, 'n', 3.0, 8, LSIGN.market); signOn(-59, -18, -52, 2, 'e', 3.0, 8, LSIGN.market);
LMCAP(null);
landmark('harborplace', 'HARBORPLACE', -52, -24, 16, { name: 'The Chip Kid', x: -50, z: -31.2, duel: 'chipkid' }); // The Chip Kid (replaced Dragon Boat Duchess, now a roaming boat-ride boss): mech duel, 09_duels.js
LMCAP('constellation');
// USS Constellation: a three-masted sloop-of-war moored beside its pier
(function ship() {
  const x0 = -33.6, x1 = -28.4, z0 = -27, z1 = -9.5, cx = (x0 + x1) / 2;
  CB.box(x0, WY - 0.4, z0, x1, CURB + 1.6, z1, '#22201e', T.white);
  CB.box(x0 - 0.02, CURB + 0.4, z0 - 0.02, x1 + 0.02, CURB + 0.9, z1 + 0.02, '#e8e0c8', T.white, { top: false });
  CB.box(x0 + 0.25, CURB + 1.6, z0 + 0.3, x1 - 0.25, CURB + 1.75, z1 - 0.3, '#8a6a48', T.white);
  for (let z = z0 + 1.2; z < z1 - 0.8; z += 1.6) for (const x of [x0 - 0.04, x1 - 0.01]) CB.box(x, CURB + 0.5, z, x + 0.05, CURB + 0.8, z + 0.5, '#111', T.white); // gunports in the white band
  CB.box(x0 + 0.01, WY - 0.2, z0 + 0.01, x1 - 0.01, WY + 0.25, z1 - 0.01, '#5ec4a4', T.white, { top: false }); // copper bottom at the waterline
  const bow = new THREE.CylinderGeometry(0.01, (x1 - x0) / 2, 4, 3, 1); bow.rotateX(-Math.PI / 2); bow.rotateZ(Math.PI); place(bow, cx, CURB + 0.6, z0 - 1.9); solid(bow, '#22201e');
  const spr = new THREE.CylinderGeometry(0.08, 0.14, 7.4, 5); spr.rotateX(-1.25); place(spr, cx, CURB + 3.4, z0 - 4.6); solid(spr, '#3a2a1a');
  for (const [z, h] of [[-23.5, 20], [-18, 23], [-12.5, 17]]) {
    const m = new THREE.CylinderGeometry(0.16, 0.26, h, 6); place(m, cx, CURB + 1.7 + h / 2, z); solid(m, '#3a2a1a');
    for (const k of [0.45, 0.7, 0.9]) { const y = new THREE.CylinderGeometry(0.08, 0.08, 8 * (1.1 - k), 5); y.rotateZ(Math.PI / 2); place(y, cx, CURB + 1.7 + h * k, z); solid(y, '#3a2a1a'); }
  }
  BLD.push({ x0, x1, z0, z1, h: CURB + 1.75 });
})();
LMCAP(null);
landmark('constellation', 'USS CONSTELLATION', -31, -18, 17, { name: 'Captain Cobblestone', x: -31, z: -18, y: CURB + 1.75 });
LMCAP('wtc');
// World Trade Center: a tall pentagonal tower on its own pier
(function wtc() {
  const cx = -12, cz = -22.5, r = 6.6, h = 62;
  // refs: regular pentagon, alternating full-height bands of tan precast and dark window strips, slightly recessed top floor
  const g = new THREE.CylinderGeometry(r, r, h, 5, 1); place(g, cx, CURB + h / 2, cz, 0.3); solid(g, '#bba98a');
  const V = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; V.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  for (let i = 0; i < 5; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), nx = (az - bz) / L, nz = (bx - ax) / L;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, o = (mx - cx) * nx + (mz - cz) * nz > 0 ? 1 : -1;
    for (const t of [0.2, 0.4, 0.6, 0.8]) obox(lerp(ax, bx, t) + nx * o * 0.06, lerp(az, bz, t) + nz * o * 0.06, 0.9, 0.12, h - 4, ang, '#232a33', CURB + 2.5); }
  const top = new THREE.CylinderGeometry(r - 0.5, r - 0.5, 3, 5); place(top, cx, CURB + h + 1.5, cz, 0.3); solid(top, '#2f3a46');
  const cap = new THREE.CylinderGeometry(r - 0.2, r - 0.2, 0.6, 5); place(cap, cx, CURB + h + 3.3, cz, 0.3); solid(cap, '#c9c2b0');
  COLL.push({ x: cx, z: cz, r: r - 0.4 }); BLD.push({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, h: CURB + h });
  signOn(cx - 4.5, cz - r, cx + 4.5, cz + r * 0.8, 's', 4.2, 8, LSIGN.trade);
})();
LMCAP(null);
landmark('wtc', 'WORLD TRADE CENTER', -12, -22, 14, { name: 'The Penthouse Pigeon', x: -12, z: -22.5, y: CURB + 63 });
LMCAP('aquarium');
// National Aquarium on pier 3 (far LOD of the HD model in 03c, same AQ footprints): concrete block + navy box + glass pyramid, red Australia wing,
// south block, the concrete drum, the Pratt St glass entrance
mass(11, -26, 23, -13, 15, { col: '#b2ab9e', top: '#8e8a82', trimCol: '#9a9387' });
sbox(12, CURB + 15, -25, 22, CURB + 17.6, -14, '#26376c', false);
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(10 / Math.SQRT2, 7.2, 11 / Math.SQRT2); place(g, 17, CURB + 17.6 + 3.6, -19.5); solid(g, '#86bccb'); }
mass(7.5, -26, 11, -17, 8, { col: '#b5332b', top: '#3d6fa6', trimCol: '#8a2420' });
sbox(7.6, CURB + 8, -25.9, 11, CURB + 11.5, -17.1, '#3d6fa6', false);
mass(11, -13, 18, -7.5, 5.5, { tr: T.glass, fh: 5.5, top: '#8e8a82' });
{ const g = new THREE.CylinderGeometry(4.6, 4.6, 11, 16); place(g, 22, CURB + 5.5, -11); solid(g, '#b2ab9e'); COLL.push({ x: 22, z: -11, r: 4.6 }); BLD.push({ x0: 17.4, x1: 26.6, z0: -15.6, z1: -6.4, h: CURB + 11 }); }
mass(13, -28.2, 21, -26, 4.5, { tr: T.glass, fh: 4.5, top: '#d8d6d0' });
signOn(11, -26, 23, -13, 'n', CURB + 6.7, 8.4, LSIGN.aqua);
LMCAP(null);
landmark('aquarium', 'NATIONAL AQUARIUM', 19, -17, 19, { name: 'Big Jimmy', x: 19, z: -5, water: true, duel: 'jimmy' }); // underwater swim fight, 09_duels.js (entered at the aquarium door)
LMCAP('powerplant');
// Power Plant complex on pier 4 (far LOD): three joined buildings - Phillips (west), the Power Plant hall + tower + four black stacks (centre), Hard Rock Cafe (east);
// footprints / heights match the HD model's PP table in 03b (exterior_2 read at x 0.0188 m/px, y 0.038 m/px)
mass(44.8, -27, 52.13, -9.5, 11.6, { tr: T.fac[0][0], top: '#4a3a30' });
mass(52.13, -27, 59.0, -8.8, 15.4, { tr: T.fac[0][1], top: '#2e3036' });
mass(59.0, -25.5, 67.55, -9.3, 12.3, { tr: T.fac[0][1], top: '#4a3a30' });
sbox(53.3, CURB + 15.4, -12.6, 58.2, CURB + 17.9, -8.9, '#a9502f', false); sbox(54.5, CURB + 17.9, -12, 57, CURB + 19.6, -9.1, '#a9502f', false);
for (const [i, z] of [-13.2, -16.6, -20, -23.4].entries()) { const g = new THREE.CylinderGeometry(1.0, 1.08, 9, 10); place(g, 57.6 + i * 0.35, CURB + 22, z); solid(g, '#1f1d1c'); } // the four black stacks, a north-south row
sbox(55.2, CURB + 20.3, -10.3, 56.3, CURB + 23.5, -10.1, '#e4566a', false); sbox(55.6, CURB + 23.5, -10.3, 55.9, CURB + 29.4, -10.1, '#e2b23a', false); // the guitar
sbox(44.6, CURB + 8.9, -27.2, 67.7, CURB + 9.4, -8.6, '#e4d8bc');
signOn(52.13, -27, 59.0, -8.8, 's', 12.0, 5, LSIGN.power);
LMCAP(null);
landmark('powerplant', 'POWER PLANT', 56, -17, 19, { name: 'Voltage Vic', x: 56, z: -5.5 });
// Four Seasons (Harbor East): a podium and a glass hotel tower
mass(71, -69, 93, -47, 9, { tr: T.store[1], fh: 9, bay: 4, top: '#4a4640' });
mass(75, -66, 89, -52, 52, { tr: T.glass, y0: CURB + 9, fh: 3.6, top: '#2a3644', coll: false });
signOn(71, -69, 93, -47, 's', 9.6, 12, LSIGN.hotel);
landmark('fourseasons', 'FOUR SEASONS', 82, -58, 20, { name: 'Chef Crabcake', x: 82, z: -42 });
// Pendry: the long recreation-pier building with its taller head house and a rooftop pool deck
LMCAP('pendry'); // landmarks: far LOD of the HD Recreation Pier in 03f_landmarks_hd_b3.js (head house replaces the old clock tower; same collider)
mass(112, -29, 140, -21.5, 9, { tr: T.fac[5][1], top: '#6a6056' });
mass(119.5, -29.4, 132.5, -21.1, 4.4, { col: '#9a4636', y0: CURB + 9, coll: false, top: '#6a5a52' });
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 3); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2); g.scale(6.8, 2.9, 4.2); place(g, 126, CURB + 13.4 + 1.45, -25.25); solid(g, '#6a5a52'); }
CB.box(130, CURB + 9, -27.5, 138, CURB + 9.05, -23, '#4ac8e0', T.white); // rooftop pool
signOn(112, -29, 140, -21.5, 's', 4.6, 10, LSIGN.pier);
LMCAP(null); // landmarks
landmark('pendry', 'PENDRY', 126, -25, 17, { name: 'The Pool Shark', x: 126, z: -19.5 });
// Fells Point: low brick rowhouses (generic blocks) round a market hall on cobbles
LMCAP('fells'); // landmarks: far LOD of the HD Thames St rowhouse block in 03f_landmarks_hd_b3.js
mass(141, -64, 159, -52, 6, { tr: T.fac[2][0], top: '#5a4a3a' });
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(14, 2.2, 9.5); place(g, 150, CURB + 6 + 1.1, -58); solid(g, '#5a3a2a'); }
signOn(141, -64, 159, -52, 's', 3.2, 9, LSIGN.fells);
LMCAP(null); // landmarks
landmark('fells', 'FELLS POINT', 160, -56, 24, { name: 'Arabber Al', x: 167, z: -58 });
// Washington Monument: a marble column on a plinth in a green square (Mount Vernon, pulled in to the north edge)
(function monument() {
  const cx = -20, cz = -92;
  CB.floor(-32, -93.5, -8, -90.5, CURB + 0.01, T.pave, '#fff', 3); CB.floor(-21.5, -104, -18.5, -80, CURB + 0.012, T.pave, '#fff', 3);
  sbox(cx - 4, CURB, cz - 4, cx + 4, CURB + 1.2, cz + 4, '#d8d2c4'); sbox(cx - 3, CURB + 1.2, cz - 3, cx + 3, CURB + 5.5, cz + 3, '#e4ded0');
  const c = new THREE.CylinderGeometry(1.2, 1.5, 40, 12); place(c, cx, CURB + 5.5 + 20, cz); solid(c, '#ece6d8');
  sbox(cx - 1.8, CURB + 45.5, cz - 1.8, cx + 1.8, CURB + 46.3, cz + 1.8, '#d8d2c4');
  const s = new THREE.CylinderGeometry(0.5, 0.7, 3.2, 8); place(s, cx, CURB + 46.3 + 1.6, cz); solid(s, '#7a8a6a');
  COLL.push({ x0: cx - 4, x1: cx + 4, z0: cz - 4, z1: cz + 4 }); BLD.push({ x0: cx - 4, x1: cx + 4, z0: cz - 4, z1: cz + 4, h: CURB + 5.5 });
})();
landmark('monument', 'WASHINGTON MONUMENT', -20, -92, 16, { name: 'The Stoop Scrubber', x: -20, z: -84 });
// Oriole Park: the long brick warehouse on the east side, a horseshoe of stands round the field, light towers
(function ballpark() { // stadiums: the field, stands and light towers are drawn by src/03e_stadiums_hd.js; same colliders + BLD as the old massing
  standColl(-134, -34, -124, 34, 14); standColl(-124, -34, -96, -26, 11); standColl(-124, 26, -96, 34, 11);
  mass(-88, -34, -80, 34, 22, { tr: T.fac[0][1], top: '#4a3a30' });
  signOn(-88, -34, -80, 34, 'e', 15, 16, LSIGN.ball);
  for (const [x, z] of [[-128, -30], [-128, 30], [-98, -30], [-98, 30]]) COLL.push({ x, z, r: 0.5 });
})();
landmark('orioles', 'ORIOLE PARK', -100, 0, 34, { name: 'Bird Brain Bobby', x: -91.5, z: 0 });
// M&T Bank Stadium: a big closed bowl with an entrance gap on the east side
(function stadium() { // stadiums: bowl, field and boards are drawn by src/03e_stadiums_hd.js; same colliders + BLD as the old massing
  standColl(-134, 48, -124, 104, 22); standColl(-124, 48, -80, 56, 20); standColl(-124, 96, -80, 104, 20);
  standColl(-88, 56, -80, 70, 20); standColl(-88, 82, -80, 96, 20);
  signOn(-88, 56, -80, 70, 'e', 14, 10, LSIGN.stad); signOn(-88, 82, -80, 96, 'e', 14, 10, LSIGN.stad);
})();
landmark('ravens', 'M&T BANK STADIUM', -106, 76, 32, { name: 'The Raven King', x: -106, z: 76 });
LMCAP('science');
// Maryland Science Center (far LOD of the HD model in 03c, same MSC footprints): brick block + towers + observatory dome (east), glass box, brick sign panel,
// glass stair tower, the curved glass drum, the west glass box, the silver wing behind
mass(-51, 52, -42.5, 69, 12, { tr: T.fac[2][0], top: '#5a4a3a' });
mass(-56, 57, -51, 69, 12, { tr: T.fac[2][1], top: '#5a4a3a' });
mass(-50.5, 47, -43, 52, 10, { tr: T.glass, fh: 1.7, bay: 1.4, top: '#d4d8dc' });
mass(-53.2, 48, -50.5, 57, 13.2, { col: '#7a3b2b', top: '#5a4a3a' });
mass(-54.5, 47.8, -53.2, 49.4, 15.2, { tr: T.glass, fh: 1.9, top: '#f2f2ee' });
mass(-66, 47.6, -62, 57, 8.6, { tr: T.glass, fh: 2, bay: 1.3, top: '#ecece8' });
mass(-66, 57, -56, 69, 11, { col: '#b4bac0', top: '#c4c8cc' });
for (const [x, z, w, h] of [[-50.8, 52.2, 2.6, 16.2], [-45.2, 52.6, 2.4, 15.4], [-50.6, 62.5, 2.4, 15.8], [-44.6, 64.8, 2.6, 16.6]]) sbox(x, CURB + 12, z, x + w, CURB + h, z + w, '#86442f', false);
{ const g = new THREE.CylinderGeometry(5.6, 5.6, 9.6, 18); place(g, -57.6, CURB + 4.8, 55); solid(g, '#3f6f9a'); COLL.push({ x: -57.6, z: 55, r: 5.6 }); BLD.push({ x0: -63.2, x1: -52, z0: 49.4, z1: 60.6, h: CURB + 12.6 });
  const u = new THREE.CylinderGeometry(4.5, 4.5, 3, 16); place(u, -57.6, CURB + 11.1, 55); solid(u, '#5d7f9c');
  const d = new THREE.SphereGeometry(2.05, 12, 6, 0, TAU, 0, Math.PI / 2); place(d, -46.8, CURB + 13.2, 60.5); solid(d, '#f2f2f0'); }
signOn(-53.2, 48, -50.5, 57, 'n', CURB + 9.4, 2.6, LSIGN.sci, 1.1);
LMCAP(null);
landmark('science', 'SCIENCE CENTER', -54, 58, 16, { name: 'Dr. Shellacious', x: -54, z: 41 });
landmark('fedhill', 'FEDERAL HILL', -3, 59, 24, { name: 'The Hon Queen', x: HILL.x, z: HILL.z, y: CURB + HILL.h });
const DOM_H = 23; // refinery roof height (the sign stands on it; HD model in 03b uses the same)
LMCAP('domino');
// Domino Sugar: a tall refinery with a giant rooftop neon sign facing the harbour (original lettering)
mass(72, 48, 92, 66, DOM_H, { tr: T.fac[1][0], top: '#4a4640' });
{ const g = new THREE.CylinderGeometry(3.4, 3.4, 22, 12); place(g, 76, CURB + 11, 69); solid(g, '#c8c4b8'); COLL.push({ x: 76, z: 69, r: 3.6 }); }
// the rooftop sign's open steel lattice (the sign faces itself are drawn in i_nightfx): verticals, three chords, X-bracing, back struts
{ const C = '#3a3532', y0 = CURB + DOM_H, zf = 50.05;
  for (let k = 0; k <= 8; k++) obox(73 + k * 2.25, zf, 0.26, 0.26, 13.2, 0, C, y0);
  for (const y of [1.6, 7.1, 12.6]) obox(82, zf, 18.6, 0.26, 0.26, 0, C, y0 + y);
  for (let k = 0; k < 8; k++) for (const [ya, yb] of [[1.6, 7.1], [7.1, 12.6]]) for (const s of [1, -1]) {
    const xa = 73 + k * 2.25, xb = xa + 2.25, L = Math.hypot(2.25, yb - ya), g = new THREE.BoxGeometry(L, 0.1, 0.1); g.rotateZ(s * Math.atan2(yb - ya, 2.25)); place(g, (xa + xb) / 2, y0 + (ya + yb) / 2, zf + 0.05); solid(g, C, false); }
  for (const x of [73, 79.75, 84.25, 91]) { const g = new THREE.BoxGeometry(0.2, 0.2, 6.2); g.rotateX(-0.95); place(g, x, y0 + 2.6, zf + 2.2); solid(g, C, false); } }
LMCAP(null);
landmark('domino', 'DOMINO SUGARS', 82, 57, 16, { name: 'Sugar Rush', x: 82, z: 57, y: CURB + DOM_H });
// Under Armour (Tide Point): brick halls with a clock tower
LMCAP('underarmour'); // landmarks: far LOD of the HD Tide Point halls in 03f_landmarks_hd_b3.js
mass(106, 48, 126, 56, 11, { tr: T.fac[0][0], top: '#4a3a30' }); mass(106, 60, 126, 68, 11, { tr: T.fac[0][1], top: '#4a3a30' });
mass(113.5, 56.5, 118.5, 59.5, 22, { col: '#9a5a44', top: '#4a3a30' });
signOn(106, 48, 126, 56, 'n', 7.6, 10, LSIGN.ath);
LMCAP(null); // landmarks
landmark('underarmour', 'UNDER ARMOUR', 116, 52, 16, { name: 'The Compression King', x: 116, z: 43 });
// Fort McHenry: a five-point star fort on grass at the tip of Locust Point, with the flag
(function fort() {
  const cx = 176, cz = 78, R = 17, r = 10.5, V = [];
  LMCAP('fort'); // landmarks: walls, barracks block and flag = far LOD of the HD fort in 03f_landmarks_hd_b3.js (the gun platform / ramp / set-piece cannon stay city mesh)
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; V.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  for (let i = 0; i < 10; i++) {
    if (i === 5) continue; // the sally port (gap facing the city)
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    obox((ax + bx) / 2, (az + bz) / 2, L + 1.2, 2.4, 4.2, ang, '#9a4a36'); obox((ax + bx) / 2, (az + bz) / 2, L + 1.1, 2.3, 0.4, ang, '#5f9440', CURB + 4.2); // landmarks: brick + grass top
    for (let t = 0; t <= 1.001; t += 1.6 / L) COLL.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t), r: 1.3 });
    BLD.push({ x0: Math.min(ax, bx) - 1, x1: Math.max(ax, bx) + 1, z0: Math.min(az, bz) - 1, z1: Math.max(az, bz) + 1, h: CURB + 4.2 });
  }
  sbox(cx - 6, CURB, cz - 3, cx + 3, CURB + 3.2, cz + 1, '#9a4a36'); COLL.push({ x0: cx - 6, x1: cx + 3, z0: cz - 3, z1: cz + 1 });
  const fortCap = LM_CAPS.fort; CB.cap = DB.cap = null; // landmarks: pause the capture for the set piece's platform
  // the north bastion gun platform (walkable: RAMPS in f_layout) with a ramp up from the parade ground, and the cannon the set piece starts from
  sbox(173.6, CURB, 63.6, 178.4, CURB + 3.3, 67.6, '#b8a888');
  for (let k = 0; k < 6; k++) { const z0 = 67.6 + k * 0.8; sbox(174.4, CURB, z0, 177.6, CURB + 3.3 * (1 - k / 6), z0 + 0.8, k % 2 ? '#a89878' : '#b0a080', k === 0); }
  { const g = new THREE.CylinderGeometry(0.2, 0.3, 2.6, 8); g.rotateX(Math.PI / 2 - 0.12); place(g, 176, CURB + 4.05, 64.5); solid(g, '#26262a');
    sbox(175.45, CURB + 3.3, 64.6, 176.55, CURB + 3.85, 66.0, '#5a3a22');
    for (const sx of [175.3, 176.7]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10); w.rotateZ(Math.PI / 2); place(w, sx, CURB + 3.64, 65.6); solid(w, '#3a2a1a', false); }
    for (let k = 0; k < 4; k++) { const b = new THREE.SphereGeometry(0.17, 6, 4); place(b, 177.4 + (k % 2) * 0.32, CURB + 3.47 + (k > 1 ? 0.27 : 0), 66.4 + (k === 3 ? 0.16 : 0)); solid(b, '#1a1a1e', false); } }
  CB.cap = fortCap.cb; DB.cap = fortCap.db; // landmarks: resume the capture
  pole(cx + 5, cz + 4, 24, 0.2);
  const fl = new THREE.BoxGeometry(7, 4.2, 0.08); place(fl, cx + 8.6, CURB + 21.6, cz + 4); CB.geom(fl, '#b03a3a', T.stripes);
  const ca = new THREE.BoxGeometry(2.6, 2.2, 0.1); place(ca, cx + 6.4, CURB + 22.6, cz + 4.01); CB.geom(ca, '#2a3a7a');
  LMCAP(null); // landmarks
})();
landmark('fort', 'FORT MCHENRY', 176, 78, 26, { name: 'Admiral Redclaw', x: 176, z: 80 });
// a few parked cars (vaultable in 06b) along the avenues
const CARS = [[-74.2, -16, false, '#a83a4a', '#d8d0c0'], [-74.2, 20, false, '#3a5a8a', '#2a3a5a'], [-22, -44.2, true, '#d8a830', '#d8a830'], [42, -44.2, true, '#5a7a4a', '#d8d0c0'],
  [52, 44.2, true, '#a83a4a', '#d8d0c0'], [-30, 44.2, true, '#3a5a8a', '#2a3a5a'], [34.2, -60, false, '#d8a830', '#d8a830'], [170.2, -60, false, '#7a3a7a', '#d8d0c0']];
for (const [x, z, ax, b, r] of CARS) car(x, z, ax ? Math.PI / 2 : 0, b, r);

// ---------------- promenade furniture: lamps (water side) + trees (land side) ----------------
const LAMPS = [];
function lampAt(x, z, ang) { lamp(x, z, ang); LAMPS.push({ x: x + Math.sin(ang) * 1.6, z: z + Math.cos(ang) * 1.6, y: CURB + 4.8, px: x, pz: z }); }
function tree(x, z) {
  const t = new THREE.CylinderGeometry(0.14, 0.2, 3.0, 6); place(t, x, CURB + 1.5, z); solid(t, '#5a4030');
  const c = new THREE.IcosahedronGeometry(1.25, 0); place(c, x, CURB + 3.9, z, x * 0.37); solid(c, '#4f7f3a');
  COLL.push({ x, z, r: 0.35 });
}
const clearOfPier = (x) => !PIERS.some((p) => x > p.x0 - 2 && x < p.x1 + 2);
for (let x = -52; x < 212; x += 18) if (clearOfPier(x)) { lampAt(x, BASIN.z0 - 0.9, Math.PI); }
for (let x = -52; x < 212; x += 18) lampAt(x, BASIN.z1 + 0.9, 0);
for (let z = 10; z < 28; z += 16) lampAt(BASIN.x0 - 0.9, z, -Math.PI / 2);
for (let x = -34; x < 212; x += 18) { tree(x, BASIN.z0 - 4.8); tree(x, BASIN.z1 + 4.8); }
for (let z = -22; z < 28; z += 16) tree(BASIN.x0 - 4.6, z);
// street lamps on the avenue corners (Pratt St / Key Hwy / Light St)
for (let x = -110; x < 212; x += 34) { lampAt(x - 0.6, -46.6, Math.PI); lampAt(x - 0.6, 46.6, 0); }
for (const z of [-30, 0, 30]) lampAt(-76.6, z, -Math.PI / 2);
const LADDER = { x: 999, z: 999, top: 0, roofY: 0 }; // kept for shared code paths (no climbable fire escape yet)

// ---------------- build the chunked meshes ----------------
const cityMesh = CB.build(CITY_MAT, { cast: true }); scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);
// collider lookup: 16 m cells, every collider listed in each cell it touches (+1.5 m margin)
const COLLG = new Map(); const cgk = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
for (const c of COLL) {
  const x0 = (c.r !== undefined ? c.x - c.r : c.x0) - 1.5, x1 = (c.r !== undefined ? c.x + c.r : c.x1) + 1.5, z0 = (c.r !== undefined ? c.z - c.r : c.z0) - 1.5, z1 = (c.r !== undefined ? c.z + c.r : c.z1) + 1.5;
  for (let i = Math.floor(x0 / 16); i <= Math.floor(x1 / 16); i++) for (let j = Math.floor(z0 / 16); j <= Math.floor(z1 / 16); j++) { const k = i + ',' + j; (COLLG.get(k) || COLLG.set(k, []).get(k)).push(c); }
}
const NOCOLL = [];
function collAt(x, z) { return COLLG.get(cgk(x, z)) || NOCOLL; }
// sky dome (inside the short draw distance): gradient + stars at night, a sun / moon disc, a few low-res clouds; recoloured by the cycle
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


// ---------------- night lights: instanced lamp glow pools + lamp-head halos (2 draw calls for every lamp), 4 pooled point lights
// that hop to the lamps nearest the hero, and the Domino Sugar rooftop neon sign (original lettering) ----------------
const NIGHTFX = { pools: [], halos: [], lights: [], neon: null, near: null };
(function nightFx() {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(0.5, 'rgba(255,130,40,.55)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 32); })();
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,80,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); })();
  const pm = basicSnap({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pg = new THREE.PlaneGeometry(7.5, 7.5); pg.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(pg, pm, LAMPS.length); pools.renderOrder = 2;
  const hm = new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
  const hg = new THREE.PlaneGeometry(2.6, 2.6);
  const halos = new THREE.InstancedMesh(hg, hm, LAMPS.length); halos.renderOrder = 3;
  const m4 = new THREE.Matrix4();
  LAMPS.forEach((L, i) => { m4.makeTranslation(L.x, groundY(L.x, L.z) + 0.03, L.z); pools.setMatrixAt(i, m4); m4.makeTranslation(L.x, L.y - 0.1, L.z); halos.setMatrixAt(i, m4); });
  pools.frustumCulled = halos.frustumCulled = false; scene.add(pools, halos); NIGHTFX.pools.push(pools); NIGHTFX.halos.push(halos);
  // the halo quads turn to face the camera (cheap: one shared rotation for all instances via onBeforeRender)
  halos.onBeforeRender = () => { halos.quaternion.identity(); };
  hm.onBeforeCompile = (sh) => { // billboard each instance in the vertex shader
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
      vec4 ic = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 mvPosition = viewMatrix * ic; mvPosition.xy += position.xy;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  for (let i = 0; i < 4; i++) { const pl = new THREE.PointLight('#ffa050', 0, 15, 1.3); scene.add(pl); NIGHTFX.lights.push(pl); }
  NIGHTFX.near = (x, z) => { // move the 4 point lights to the 4 lamps nearest (x, z)
    const s = LAMPS.map((L) => [(L.x - x) ** 2 + (L.z - z) ** 2, L]).sort((a, b) => a[0] - b[0]);
    NIGHTFX.lights.forEach((pl, i) => { const L = s[i][1]; pl.position.set(L.x, L.y - 0.6, L.z); });
  };
  // Domino Sugars: the real two-line script sign ("Domino" over "Sugars", rounded box border) on its open steel lattice, facing the harbour
  // (Brad 2026-10-10, overriding the original-name rule for this sign only; matched to refs/domino-sugar sign_1 day, sign_2 + sign_night_web night).
  // Drawn on canvas (script/italic fonts + strokes), no photo or logo file. Day: gold letters on the open frame. Night: red-orange neon with a glowing
  // box outline, a red point light and a red reflection streak across the water. Two planes cross-fade (day / night).
  function dominoTex(night) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 640);
    const RED = '#ff3a1c', CORE = '#ffc2a6', GOLD = '#f0b440', GOLD2 = '#b87a22', INKG = '#4a2e0c';
    const glow = (b) => { g.shadowColor = night ? '#ff2a10' : 'rgba(0,0,0,0)'; g.shadowBlur = night ? b : 0; };
    // rounded box border (double line like the tubes)
    g.lineJoin = 'round'; rrect(g, 34, 34, 956, 572, 64);
    if (night) { glow(34); g.strokeStyle = RED; g.lineWidth = 20; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 5; g.stroke(); }
    else { g.strokeStyle = INKG; g.lineWidth = 24; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 15; g.stroke(); }
    const word = (txt, x, y, font, slant, fillW) => { g.save(); g.translate(x, y); g.transform(1, 0, -slant, 1, 0, 0); g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (night) { glow(30); g.fillStyle = RED; g.fillText(txt, 0, 0, fillW); g.lineWidth = 9; g.strokeStyle = RED; g.strokeText(txt, 0, 0, fillW); glow(0); g.lineWidth = 3.5; g.strokeStyle = CORE; g.strokeText(txt, 0, 0, fillW); }
      else { const gr = g.createLinearGradient(0, -200, 0, 20); gr.addColorStop(0, '#ffd877'); gr.addColorStop(0.55, GOLD); gr.addColorStop(1, GOLD2); g.lineWidth = 12; g.strokeStyle = INKG; g.strokeText(txt, 0, 0, fillW); g.fillStyle = gr; g.fillText(txt, 0, 0, fillW); }
      g.restore(); };
    word('Domino', 512, 330, 'italic 900 318px "Brush Script MT", "Snell Roundhand", "Apple Chancery", Georgia, "Times New Roman", "DejaVu Serif", serif', 0.16, 900);
    // the swash under "Domino" (a hand-drawn tail sweeping back from the o)
    g.save(); g.beginPath(); g.moveTo(170, 372); g.bezierCurveTo(360, 410, 650, 404, 880, 346); g.lineCap = 'round';
    if (night) { glow(26); g.strokeStyle = RED; g.lineWidth = 15; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 4; g.stroke(); } else { g.strokeStyle = INKG; g.lineWidth = 20; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 11; g.stroke(); }
    g.restore();
    word('Sugars', 520, 555, 'bold 172px Georgia, "Times New Roman", "DejaVu Serif", serif', 0.02, 600);
    return lowTex(c, 256);
  }
  const SW = 17, SH = 10.6, SX = 82, SY = CURB + DOM_H + 7.1, SZ = 49.7;
  const dayMat = basicSnap({ map: dominoTex(false), transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02 });
  const mat = basicSnap({ map: dominoTex(true), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
  const signD = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), dayMat); signD.position.set(SX, SY, SZ); signD.rotation.y = Math.PI; signD.renderOrder = 4; scene.add(signD);
  const signN = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat); signN.position.set(SX, SY, SZ - 0.04); signN.rotation.y = Math.PI; signN.renderOrder = 5; scene.add(signN);
  // red reflection streak across the water toward the north shore (rippled bands)
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 512; const sg = sc.getContext('2d'); sg.clearRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 6) { const a = Math.min(1, (1 - y / 512) ** 1.1 * (0.7 + 0.5 * srnd())), w = 64 * (0.5 + 0.5 * srnd()) * (1 - y / 900); sg.fillStyle = `rgba(255,${50 + (srnd() * 40) | 0},20,${a.toFixed(3)})`; sg.fillRect(32 - w / 2, y, w, 3 + srnd() * 3); }
  const stex = lowTex(sc, 64);
  const smat = basicSnap({ map: stex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, opacity: 0 });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(11, 52), smat); streak.rotation.x = -Math.PI / 2; streak.position.set(SX, WY + 0.04, 29.6 - 26); streak.renderOrder = 3; scene.add(streak);
  const nl = new THREE.PointLight('#ff3a2a', 0, 36, 1.2); nl.position.set(SX, CURB + DOM_H + 7, 43); scene.add(nl);
  NIGHTFX.neon = { mat, dayMat, light: nl, streak, tint: (on, fl) => { mat.opacity = Math.min(1, on * 1.15) * fl; dayMat.opacity = 1 - sstep(0.15, 0.85, on); smat.opacity = on * fl; streak.visible = on > 0.02; } };
})();

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

const LMHD = { list: [], near: 125, force: Q.get('lmhd') }; // ?lmhd=near|far pins the LOD (previews / A-B checks)
function lmHD(id, cx, cz, r, build) {
  const cap = LM_CAPS[id]; const far = new THREE.Group();
  if (cap) { if (cap.cb.P.length) { const m = cap.cb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; far.add(m); } if (cap.db.P.length) far.add(cap.db.build(DECAL_MAT)); }
  LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); build(hb, signs, sa); const near = hb.build();
  for (const s of signs) near.add(s.build(DECAL_MAT)); if (sa.items.length) near.add(sa.build());
  scene.add(far, near); near.visible = false;
  const L = { id, cx, cz, r, far, near, tris: near.userData.tris, isNear: false }; LMHD.list.push(L); return L;
}
scene.onBeforeRender = (r, s, cam) => {
  for (const L of LMHD.list) {
    const d = Math.hypot(cam.position.x - L.cx, cam.position.z - L.cz) - L.r, nd = L.nearD || LMHD.near; // L.nearD: per-landmark swap distance (batch 3)
    const n = LMHD.force === 'near' ? true : LMHD.force === 'far' ? false : (L.isNear ? d < nd + 8 : d < nd);
    if (n !== L.isNear) { L.isNear = n; L.near.visible = n; L.far.visible = !n; }
  }
};

// ======================= DOMINO SUGARS (refs/domino-sugar): brick refinery blocks with rows of windows and cream string courses,
// a taller rear block, two cream smokestacks, white silos, a cream warehouse base on the water side, the rooftop sign lattice ==============
lmHD('domino', 82, 57, 16, (H) => {
  const BR = '#7c4330', BR2 = '#6a3626', BR3 = '#8a4d36', CR = '#e2d3b4', CR2 = '#cdbb98', Y0 = CURB, TOP = CURB + DOM_H;
  const win = { bw: 1.55, fh: 3.1, ww: 0.86, wh: 1.7, sill: CR, lit: 0.45, awn: 0.35, awnC: '#5a80b8', pane: '#2a2f38' };
  // main block 72..92 x 48..60, rear block 72..92 x 60..66 (a bit lower, then the tall tower section on the west end)
  H.box(72, Y0, 48, 92, TOP, 60, BR);
  H.box(72, Y0, 60, 92, TOP - 3, 66, BR2);
  H.box(72, Y0, 57, 79, TOP + 5, 66, BR3); // the tall tower block behind the sign (the refinery's taller rear section with the big stack)
  // the cream warehouse base along the water side and the west end (ground floor, loading doors)
  H.box(70.6, Y0, 47.2, 93.4, Y0 + 4.6, 66.4, CR2);
  for (const [xa, za, xb, zb] of [[93.4, 47.2, 70.6, 47.2], [93.4, 66.4, 93.4, 47.2], [70.6, 66.4, 93.4, 66.4], [70.6, 47.2, 70.6, 66.4]]) { // N E S W, outward on the right
    const F = H.frame(xa, za, xb, zb);
    for (let u = 1.5; u < F.L - 1.5; u += 3.2) { H.fbox(F, u - 0.9, u + 0.9, 0.16, 3.0, -0.05, 0.03, LMR() < 0.25 ? '#a83a2a' : '#4a4640', { ol: false }); H.fbox(F, u - 1.1, u + 1.1, 3.0, 3.25, 0, 0.12, '#8a7a60', { ol: false }); }
    H.band(F, 0, F.L, Y0 + 4.4, Y0 + 4.9, 0.25, CR);
  }
  // facades: north (harbour, under the sign), east, south, west - window grid, brick pilasters every 2 bays, cream string courses
  const faces = [[72, 48, 92, 48, TOP], [92, 48, 92, 60, TOP], [92, 60, 92, 66, TOP - 3], [92, 66, 79, 66, TOP - 3], [79, 66, 72, 66, TOP + 5], [72, 66, 72, 57, TOP + 5], [72, 57, 72, 48, TOP]];
  // faces are listed from outside with the outward normal on the right: build each as wall frame (xb,zb)->(xa,za) reversed when needed
  for (const [xa, za, xb, zb, top] of faces) {
    const F = H.frame(xb, zb, xa, za); // reverse so the normal points out (the footprint is walked clockwise in x-east / z-south)
    H.windows(F, 0.4, F.L - 0.4, Y0 + 5.2, top - 1.6, win);
    H.pilasters(F, 0, F.L, Y0 + 4.9, top - 0.6, 3.1, 0.34, 0.16, BR2, { ol: false });
    for (const y of [Y0 + 11.4, Y0 + 17.6]) H.band(F, 0, F.L, y, y + 0.22, 0.12, CR, { ol: false });
    H.band(F, -0.2, F.L + 0.2, top - 0.9, top - 0.55, 0.22, CR); // cornice
    H.band(F, -0.1, F.L + 0.1, top - 0.55, top + 0.6, 0.06, BR2); // parapet
  }
  // tall west tower: its own north + east faces above the main roof, darker brick, rooftop penthouse
  for (const F2 of [H.frame(79, 57, 72, 57), H.frame(79, 66, 79, 57)]) { // the tower's north + east faces above the lower roofs
    H.windows(F2, 0.4, F2.L - 0.4, TOP - 2.6, TOP + 3.6, { bw: 1.55, fh: 3.1, ww: 0.86, wh: 1.7, sill: CR, lit: 0.4 }); H.band(F2, -0.2, F2.L + 0.2, TOP + 4.1, TOP + 4.45, 0.22, CR); }
  H.box(73.5, TOP + 5, 59, 77.5, TOP + 8, 63, BR2); H.box(73.3, TOP + 8, 58.8, 77.7, TOP + 8.4, 63.2, CR);
  // two tall cream smokestacks behind (left one taller, as in the refinery refs) + dark caps
  for (const [x, z, h, rb] of [[74.5, 63.5, 44, 1.25], [86, 64.2, 35, 1.05]]) {
    H.cyl(x, TOP - 3, z, rb * 0.82, rb, h - (TOP - 3 - Y0), 14, '#ece4d2');
    H.cyl(x, Y0 + h - 1.2, z, rb * 0.9, rb * 0.9, 1.2, 14, '#3a3532');
    for (const k of [0.35, 0.6]) H.cyl(x, TOP - 3 + (h - TOP + 3) * k, z, rb * 0.96, rb * 0.96, 0.4, 14, '#d4c8b0', { ol: false });
  }
  // white concrete silos (four, a head house on top) at the south-west corner
  for (const [x, z] of [[74.5, 67.6], [77.5, 67.6], [74.5, 70.4], [77.5, 70.4]]) { H.cyl(x, Y0, z, 1.45, 1.45, 22, 16, '#e8e6e0'); H.cyl(x, Y0 + 22, z, 1.45, 1.2, 0.6, 16, '#cfcbc2', { ol: false }); }
  H.box(73.6, Y0 + 22, 66.8, 78.4, Y0 + 25, 71.2, '#d8d4ca');
  for (let y = Y0 + 2; y < Y0 + 21; y += 2.6) H.box(76.0 - 0.12, y, 66.1, 76.0 + 0.12, y + 0.08, 66.2, '#9a968c', { ol: false });
  // rooftop clutter: a water tank on legs, vents, a small boiler house
  H.cyl(89, TOP + 2.2, 63, 1.2, 1.2, 2.2, 12, '#6a5a48'); H.cyl(89, TOP + 4.4, 63, 0.05, 1.3, 0.8, 12, '#4a3e32');
  for (const [lx, lz] of [[88.2, 62.2], [89.8, 62.2], [88.2, 63.8], [89.8, 63.8]]) H.box(lx - 0.08, TOP - 3, lz - 0.08, lx + 0.08, TOP + 2.2, lz + 0.08, '#3a3532', { ol: false });
  H.box(84, TOP - 3, 61, 88, TOP - 0.5, 65, BR3); for (const x of [81, 83.5]) H.cyl(x, TOP, 58, 0.35, 0.35, 1.4, 8, '#8a8a84', { ol: false });
  // flag on the tower
  H.box(75.4, TOP + 8.4, 61, 75.5, TOP + 15, 61.1, '#d8d8d0', { ol: false });
  for (let i = 0; i < 7; i++) H.box(75.5, TOP + 13.2 + i * 0.26, 61.04, 77.9, TOP + 13.46 + i * 0.26, 61.06, i % 2 ? '#f2f0ea' : '#b8323a', { ol: false });
  H.box(75.5, TOP + 14.0, 61.03, 76.6, TOP + 15.0, 61.07, '#2a3a7a', { ol: false });
  // the sign's open steel lattice (the sign faces are the canvas planes in the night-FX block): verticals, three chords, X-bracing, back struts
  { const C = '#3a3532', y0 = TOP, zf = 50.05;
    for (let k = 0; k <= 8; k++) H.box(73 + k * 2.25 - 0.13, y0, zf - 0.13, 73 + k * 2.25 + 0.13, y0 + 13.2, zf + 0.13, C);
    for (const y of [1.6, 7.1, 12.6]) H.box(72.7, y0 + y - 0.13, zf - 0.13, 91.3, y0 + y + 0.13, zf + 0.13, C);
    for (let k = 0; k < 8; k++) for (const [ya, yb] of [[1.6, 7.1], [7.1, 12.6]]) for (const s of [1, -1]) {
      const xa = 73 + k * 2.25, xb = xa + 2.25, L = Math.hypot(2.25, yb - ya), g = new THREE.BoxGeometry(L, 0.1, 0.1); g.rotateZ(s * Math.atan2(yb - ya, 2.25)); g.translate((xa + xb) / 2, y0 + (ya + yb) / 2, zf + 0.12); H.geo(g, C, { ol: false }); }
    for (const x of [73, 79.75, 84.25, 91]) { const g = new THREE.BoxGeometry(0.2, 0.2, 6.2); g.rotateX(-0.95); g.translate(x, y0 + 2.6, zf + 2.2); H.geo(g, C, { ol: false }); }
    H.box(72.6, y0 - 0.1, zf - 0.6, 91.4, y0 + 0.2, zf + 3.4, '#4a4440', { ol: false }); } // catwalk
});

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

// ======================= POWER PLANT COMPLEX, PIER 4 (refs/power-plant, Brad 2026-10-11 09:03): THREE joined buildings, not one.
// West: the PHILLIPS SEAFOOD building (flat roof, tall gridded windows, bracket frieze, attic, the red "Phillips" roof sign);
// centre: the POWER PLANT hall (taller, recessed balconied bay, BARNES & NOBLE / BOOKSELLERS, a stepped tower with the POWER PLANT plaque + 1900 / 2000,
// a slate pitched roof carrying the FOUR BLACK STACKS in a north-south row, the giant HARD ROCK guitar on the tower);
// east: the HARD ROCK CAFE building (lower eaves, stepped parapet + pediment, big round-arched windows, HRC roundels, the Hard Rock Cafe logo,
// SAVE THE PLANET marquee, red-roofed entrance pavilion). Widths / heights are read off exterior_2 (x 0.0188 m/px, y 0.038 m/px, the city's 3x map compression)
const PPX = (px) => 44.8 + (px - 50) * 0.0188, PPY = (py) => CURB + (770 - py) * 0.038;
const PP = { phX0: PPX(50), phX1: PPX(440), pcX1: PPX(805), hrX1: PPX(1260), zN: -27, hrZN: -25.5, phZS: -9.5, pcZS: -8.8, hrZS: -9.3,
  phTop: PPY(470), pcTop: PPY(365), twX0: PPX(500), twX1: PPX(760), twTop: PPY(300), gbX0: PPX(568), gbX1: PPX(700), gbTop: PPY(255),
  hrEave: PPY(480), hrPar: PPY(445), hrStep: PPY(410), hrPeak: PPY(362), stX: 58.1, stZ: [-13.2, -16.6, -20, -23.4], stTop: CURB + 26.5, ridge: PPY(365) + 2.6 };
const ppFaces = (x0, z0, x1, z1, H) => ({ s: H.frame(x0, z1, x1, z1), e: H.frame(x1, z1, x1, z0), n: H.frame(x1, z0, x0, z0), w: H.frame(x0, z0, x0, z1) });
const hrLogo = (g, w, h, o = {}) => { const R = Math.min(w, h) / 2 - 2; g.save(); g.translate(w / 2, h / 2);
  g.fillStyle = '#c99a32'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.fillStyle = '#f2dc9a'; g.beginPath(); g.arc(0, 0, R * 0.88, 0, TAU); g.fill();
  g.lineWidth = R * 0.05; g.strokeStyle = '#8a5a18'; g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.stroke();
  sText(g, 'Hard Rock', 0, -R * 0.12, R * 1.62, R * 0.62, SCRIPT, '#b81e1a', { slant: 0.12, stroke: '#3a0a06', sw: R * 0.06 });
  g.fillStyle = '#c8241c'; g.beginPath(); g.moveTo(-R * 0.5, R * 0.28); g.lineTo(R * 0.5, R * 0.28); g.lineTo(R * 0.42, R * 0.62); g.lineTo(-R * 0.42, R * 0.62); g.closePath(); g.fill();
  sText(g, 'CAFE', 0, R * 0.46, R * 0.74, R * 0.3, SANS, '#fff2c8'); g.restore(); };
lmHD('powerplant', 56, -17, 19, (H, signs, SG) => {
  const BR = '#a9502f', BR2 = '#8e3f25', BR3 = '#b45a38', CR = '#e2d3b2', Y0 = CURB, GLS = '#262c34', GRN = '#2f6a4a', SL = '#2e3036', P = PP;
  const pane = '#33404c', mull = '#e8e4da';
  // ---------- WEST: PHILLIPS building ----------
  { const x0 = P.phX0, x1 = P.phX1, z0 = P.zN, z1 = P.phZS, top = P.phTop, f = ppFaces(x0, z0, x1, z1, H);
    H.box(x0, Y0, z0, x1, top, z1, BR); H.box(x0 - 0.15, Y0, z0 - 0.15, x1 + 0.1, Y0 + 0.8, z1 + 0.15, '#6a5a50');
    H.box(x0, top - 0.02, z0, x1, top + 0.08, z1, '#4a4440', { ol: false });
    for (const k of ['s', 'w', 'n']) { const F = f[k];
      H.windows(F, 0.4, F.L - 0.4, Y0 + 0.9, PPY(675), { bw: 1.22, fh: PPY(675) - Y0 - 0.9, ww: 0.7, wh: 1.7, pane: GLS, lit: 0.7, head: CR, wy: 0.3 }); // ground floor
      H.windows(F, 0.4, F.L - 0.4, PPY(682), PPY(552), { bw: 1.22, fh: PPY(552) - PPY(682), ww: 0.9, wh: PPY(560) - PPY(675), pane, lit: 0.45, mull, sill: CR, wy: 0.3 }); // the tall gridded windows
      { const nb = Math.max(1, Math.round((F.L - 0.8) / 1.22)), bwr = (F.L - 0.8) / nb, y0 = PPY(682) + (PPY(552) - PPY(682) - (PPY(560) - PPY(675))) * 0.3, y1 = y0 + PPY(560) - PPY(675);
        for (let b = 0; b < nb; b++) { const uc = 0.4 + (b + 0.5) * bwr; for (const du of [-0.225, 0.225]) H.fbox(F, uc + du - 0.025, uc + du + 0.025, y0, y1, 0, 0.04, mull, { ol: false }); for (let y = y0 + 0.5; y < y1 - 0.1; y += 0.5) H.fbox(F, uc - 0.45, uc + 0.45, y, y + 0.05, 0, 0.04, mull, { ol: false }); } }
      H.pilasters(F, 0.4, F.L - 0.4, Y0 + 0.8, PPY(535), 1.22, 0.22, 0.14, BR2, { ol: false });
      H.band(F, -0.1, F.L + 0.1, PPY(682), PPY(676), 0.16, CR, { ol: false });
      for (let u = 0.4; u <= F.L - 0.3; u += 0.61) H.fbox(F, u - 0.09, u + 0.09, PPY(552), PPY(538), 0, 0.22, CR, { ol: false }); // frieze brackets
      H.band(F, -0.2, F.L + 0.2, PPY(538), PPY(518), 0.32, CR); // cornice
      H.windows(F, 0.4, F.L - 0.4, PPY(515), PPY(478), { bw: 1.22, fh: PPY(478) - PPY(515), ww: 0.5, wh: 0.7, pane: GLS, lit: 0.4, wy: 0.4 }); // attic
      H.band(F, -0.05, F.L + 0.05, top - 0.35, top + 0.25, 0.1, BR2); }
    for (const x of [x0 + 0.3, x1 - 0.5]) H.box(x - 0.3, top, z1 - 0.9, x + 0.5, PPY(455), z1, BR2); // end chimney piers on the harbour face
    H.box(x0 + 0.6, top, -21, x0 + 3.2, top + 1.6, -15, '#5a5a5e'); // rooftop plant room (refs: grey box behind the parapet)
    // the PHILLIPS roof sign: bold red script with a white edge on a red-painted frame standing on the roof (exterior_2)
    const sx = PPX(243), sz = z1 - 1.4; H.box(sx - 2.2, top, sz - 0.1, sx + 2.2, top + 0.25, sz + 0.1, '#8a1c18', { ol: false });
    for (const dx of [-1.8, -0.6, 0.6, 1.8]) H.box(sx + dx - 0.06, top, sz - 0.3, sx + dx + 0.06, top + 1.9, sz - 0.18, '#5a1410', { ol: false });
    SG.at(sx, top + 0.2, sz, 0, 4.4, 2.0, (g, w, h) => sText(g, 'Phillips', w / 2, h * 0.55, w * 0.97, h * 0.94, SCRIPT, '#e3221a', { weight: 'bold', slant: 0.1, stroke: '#fde8dc', sw: h * 0.06, glow: '#ff2a1a' }));
    // ground: Phillips Seafood entrance under a green half-dome canopy + red awnings along the promenade
    const F = f.s, cu = PPX(203) - x0; H.fbox(F, cu - 1.1, cu + 1.1, Y0 + 2.4, Y0 + 2.55, 0, 1.6, GRN, { ol: false });
    { const g = new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI); g.scale(1, 0.75, 1); g.translate(cu, Y0 + 2.55, 0.8); H.fgeo(F, g, GRN); }
    SG.add(F, cu, Y0 + 1.75, 2.1, 0.62, 1.62, (g, w, h) => { g.fillStyle = '#1c2630'; g.fillRect(0, 0, w, h); sText(g, 'Phillips', w / 2, h * 0.38, w * 0.8, h * 0.62, SCRIPT, '#e8261c', { slant: 0.1, stroke: '#fff', sw: h * 0.04 }); sText(g, 'SEAFOOD', w / 2, h * 0.82, w * 0.4, h * 0.22, SANS, '#fff', { track: 2 }); });
    H.fbox(F, 0.1, cu - 1.3, Y0 + 2.5, Y0 + 2.65, 0, 1.4, '#c0302a', { ol: false }); H.fbox(F, cu + 1.3, F.L - 0.2, Y0 + 2.5, Y0 + 2.65, 0, 1.0, '#c0302a', { ol: false });
    // the rope cargo net hung on the east end of the harbour face (exterior_2)
    for (let i = 0; i < 6; i++) H.fbox(F, F.L - 1.2 + i * 0.18, F.L - 1.16 + i * 0.18, PPY(670), PPY(545), 0, 0.08, '#6a5a44', { ol: false });
  }
  // ---------- CENTRE: the POWER PLANT hall ----------
  { const x0 = P.phX1, x1 = P.pcX1, z0 = P.zN, z1 = P.pcZS, top = P.pcTop, f = ppFaces(x0, z0, x1, z1, H);
    H.box(x0, Y0, z0, x1, top, z1 - 0.7, BR); H.box(x0 + 0.2, Y0, z1 - 0.8, x1 - 0.2, top, z1, BR); // the front projects a little
    // slate pitched roof with the white clerestory band, running north-south behind the tower (exterior_1)
    { const g = new THREE.BufferGeometry(), xm = (x0 + x1) / 2, yb = top + 0.9, yr = P.ridge, za = z0 + 0.3, zb = -12.4;
      const v = [[x0 + 0.2, yb, za], [x1 - 0.2, yb, za], [xm, yr, za], [x0 + 0.2, yb, zb], [x1 - 0.2, yb, zb], [xm, yr, zb]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 2, 1); t(3, 4, 5); t(0, 3, 5); t(0, 5, 2); t(1, 2, 5); t(1, 5, 4); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, SL);
      H.box(x0 + 0.2, top, za, x1 - 0.2, yb, zb, '#e8e6de'); for (let z = za + 0.6; z < zb - 0.3; z += 0.9) H.box(x0 + 0.15, top + 0.2, z, x1 - 0.15, yb - 0.15, z + 0.4, '#3a3f48', { ol: false, emi: LMR() < 0.5 ? '#ffd690' : null }); }
    for (const k of ['w', 'e', 'n']) { const F = f[k]; if (k === 'w' || k === 'e') { /* side walls mostly hidden by the wings: upper storeys only */ }
      const y0w = k === 'n' ? Y0 + 1 : Math.max(P.phTop, P.hrPar) + 0.4;
      H.windows(F, 0.4, F.L - 0.4, y0w, top - 1.2, { bw: 1.3, fh: 2.2, ww: 0.6, wh: 1.4, arch: true, pane: GLS, lit: 0.45, head: CR });
      H.band(F, -0.2, F.L + 0.2, top - 1.1, top - 0.8, 0.3, CR); }
    const F = H.frame(x0 + 0.2, z1, x1 - 0.2, z1), L = F.L, u = (px) => PPX(px) - x0 - 0.2;
    // brick piers framing the recessed balconied centre bay (exterior_2: two tall piers, the bay between with railed balconies)
    for (const [a, b] of [[430, 446], [480, 498], [718, 735], [788, 805]]) H.fbox(F, u(a), u(b), Y0 + 0.9, PPY(398), 0, 0.35, BR3);
    H.fbox(F, u(498), u(718), Y0 + 3.1, PPY(470), -1.0, -0.95, '#3e4a56', { ol: false });
    for (let y = Y0 + 3.1; y < PPY(472); y += 2.05) { H.fbox(F, u(498), u(718), y, y + 0.22, -0.9, 0.05, '#7a3522', { ol: false }); // floor slab
      for (const ry of [0.62, 1.0]) H.fbox(F, u(498), u(718), y + ry, y + ry + 0.06, 0.02, 0.06, '#2a2a28', { ol: false }); // balcony rails
      for (let k = 0; k <= 12; k++) { const uu = u(498) + (u(718) - u(498)) * k / 12; H.fbox(F, uu - 0.02, uu + 0.02, y + 0.22, y + 1.0, 0.02, 0.05, '#2a2a28', { ol: false }); }
      for (let k = 0; k < 6; k++) { const uu = u(498) + (u(718) - u(498)) * (k + 0.5) / 6; H.fbox(F, uu - 0.3, uu + 0.3, y + 0.3, y + 1.8, -0.94, -0.92, '#5a6a78', { ol: false, emi: LMR() < 0.6 ? '#ffd690' : null }); } }
    for (const [a, b] of [[446, 480], [735, 788]]) { // the side bays: small windows with green awnings
      H.windows(F, u(a), u(b), Y0 + 3.1, PPY(470), { bw: u(b) - u(a), fh: 2.05, ww: 0.42, wh: 1.2, pane: GLS, lit: 0.45, sill: CR, awn: 1, awnC: GRN }); }
    H.band(F, -0.1, L + 0.1, PPY(470), PPY(462), 0.25, CR, { ol: false }); H.band(F, -0.2, L + 0.2, PPY(398), PPY(390), 0.45, CR); // cornice under the arched row
    H.windows(F, u(498), u(720), PPY(390), PPY(366), { bw: 0.52, fh: PPY(366) - PPY(390), ww: 0.3, wh: 0.55, arch: true, pane: GLS, lit: 0.55 });
    // BARNES&NOBLE / BOOKSELLERS: white serif capitals standing off the bay (exterior_2)
    SG.add(F, u(600), PPY(468), 4.4, 1.7, 0.5, (g, w, h) => { sText(g, 'BARNES&NOBLE', w / 2, h * 0.34, w * 0.98, h * 0.6, SERIF, '#fbfaf4', { weight: 'bold', stroke: '#2a2420', sw: h * 0.035 });
      sText(g, 'BOOKSELLERS', w / 2, h * 0.82, w * 0.6, h * 0.26, SERIF, '#fbfaf4', { weight: '600', stroke: '#2a2420', sw: h * 0.02, track: 3 }); });
    // ground: the green Barnes & Noble store canopy with its sign + glazed store front
    H.fbox(F, u(446), u(788), Y0 + 0.9, Y0 + 2.9, -0.2, -0.15, '#2a3a36', { ol: false, emi: '#ffe4a8' });
    H.fbox(F, u(515), u(690), Y0 + 2.4, Y0 + 2.6, 0, 1.4, GRN); H.fbox(F, u(515), u(690), Y0 + 2.6, Y0 + 3.15, 1.25, 1.4, GRN, { ol: false });
    SG.add(F, u(602), Y0 + 2.62, 3.1, 0.5, 1.43, (g, w, h) => { g.fillStyle = '#1f4a36'; g.fillRect(0, 0, w, h); sText(g, 'BARNES&NOBLE', w / 2, h * 0.36, w * 0.9, h * 0.48, SERIF, '#fff'); sText(g, 'BOOKSELLERS', w / 2, h * 0.8, w * 0.5, h * 0.22, SERIF, '#fff', { track: 2 }); });
    // the tower above the hall: POWER PLANT plaque, a balcony, arched windows; 1900 / 2000 corner plaques on the shoulders
    const tz0 = -12.6, tz1 = z1 - 0.1;
    H.box(P.twX0, top, tz0, P.twX1, P.twTop, tz1, BR); H.box(P.twX0 - 0.15, P.twTop - 0.3, tz0 - 0.15, P.twX1 + 0.15, P.twTop + 0.05, tz1 + 0.15, CR);
    for (const [xa, xb] of [[x0 + 0.2, x0 + 1.2], [x1 - 1.2, x1 - 0.2]]) { H.box(xa, top, tz1 - 1, xb, PPY(320), tz1, BR3); H.box(xa - 0.08, PPY(322), tz1 - 1.08, xb + 0.08, PPY(316), tz1 + 0.08, CR); }
    H.band(F, -0.25, L + 0.25, top - 0.25, top + 0.15, 0.4, CR);
    const T = H.frame(P.twX0, tz1, P.twX1, tz1), tu = (px) => PPX(px) - P.twX0;
    H.windows(T, tu(510), tu(745), top + 0.15, PPY(345), { bw: 0.6, fh: PPY(345) - top - 0.15, ww: 0.34, wh: 0.7, arch: true, pane: GLS, lit: 0.6, wy: 0.35 });
    H.fbox(T, tu(555), tu(660), top + 0.0, top + 0.1, 0, 0.5, '#3a3a38', { ol: false }); for (const ry of [0.25, 0.45]) H.fbox(T, tu(555), tu(660), top + ry, top + ry + 0.05, 0.45, 0.5, '#2a2a28', { ol: false }); // balcony
    SG.add(T, tu(612), PPY(347), 3.5, 1.0, 0.6, (g, w, h) => { g.fillStyle = '#2e2216'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a050'; g.lineWidth = h * 0.07; g.strokeRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14);
      sText(g, 'POWER PLANT', w / 2, h * 0.55, w * 0.88, h * 0.62, SERIF, '#e8c060', { stroke: '#6a4a18', sw: h * 0.035 }); });
    for (const [px, t] of [[472, '1900'], [763, '2000']]) SG.add(F, u(px), top + 0.35, 1.05, 0.7, 0.3, (g, w, h) => { g.fillStyle = '#2e2216'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a050'; g.lineWidth = h * 0.08; g.strokeRect(2, 2, w - 4, h - 4); sText(g, t, w / 2, h * 0.54, w * 0.8, h * 0.56, SERIF, '#e8c060'); });
    { const T2 = H.frame(P.twX0, tz1, P.twX1, tz1); H.fbox(T2, tu(700), tu(740), PPY(368), PPY(338), 0, 0.02, GLS, { ol: false }); }
    // the stepped gable on top of the tower + the block the guitar stands on
    { const xa = P.gbX0, xb = P.gbX1, xm = (xa + xb) / 2, ya = P.twTop, yb = PPY(282), za = tz0 + 0.6, zb = tz1 - 0.2;
      H.box(xa, ya, za, xb, yb, zb, BR); const g = new THREE.BufferGeometry(), v = [[xa, yb, zb], [xb, yb, zb], [xm, P.gbTop, zb], [xa, yb, za], [xb, yb, za], [xm, P.gbTop, za]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 1, 2); t(3, 5, 4); t(0, 2, 5); t(0, 5, 3); t(1, 4, 5); t(1, 5, 2); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, '#5a5650');
      const G = H.frame(xa, zb, xb, zb); H.windows(G, 0.25, G.L - 0.25, ya + 0.15, yb - 0.1, { bw: 0.62, fh: yb - ya - 0.25, ww: 0.32, wh: 0.6, pane: GLS, lit: 0.6, sill: CR });
      H.box(xa - 0.12, yb, zb - 0.1, xb + 0.12, yb + 0.12, zb + 0.12, CR, { ol: false });
      H.box(xm - 0.6, P.gbTop - 0.6, za + 0.6, xm + 0.6, P.gbTop + 0.6, zb - 0.6, BR2); }
    // the FOUR BLACK STACKS, a north-south row on the roof ridge (exterior_1), each on a short base, banded, with a flared cap
    for (let si = 0; si < 4; si++) { const z = P.stZ[si], sx = P.stX - 0.5 + si * 0.35, b0 = P.ridge - 0.6, h = P.stTop - b0; // the row runs a touch north-east (exterior_1 / exterior_2 stagger)
      H.box(sx - 1.2, top + 0.9, z - 1.2, sx + 1.2, P.ridge + 0.2, z + 1.2, '#3a3532');
      H.cyl(sx, b0, z, 1.0, 1.08, h - 0.5, 16, '#1d1c1d'); H.cyl(sx, P.stTop - 0.6, z, 1.08, 1.02, 0.6, 16, '#2c2a2a'); H.box(sx - 0.12, P.stTop, z - 0.12, sx + 0.12, P.stTop + 0.22, z + 0.12, '#8a1a14', { ol: false, emi: '#ff2a1a' }); // aircraft warning light
      for (const k of [0.25, 0.55, 0.82]) H.cyl(sx, b0 + h * k, z, 1.08 - 0.06 * k, 1.08 - 0.06 * k, 0.18, 16, '#353233', { ol: false }); }
    lmColl({ x0: x0 + 0.2, x1: x1 - 0.2, z0: z1 - 0.8, z1 });
    // north (Pratt St) end: the real carved lettering of the original power company
    { const N = H.frame(x1, z0, x0, z0); SG.add(N, N.L / 2, top - 2.2, N.L * 0.9, 0.42, 0.06, (g, w, h) => sText(g, 'UNITED RAILWAYS & ELECTRIC COMPANY', w / 2, h / 2, w * 0.98, h * 0.8, SERIF, '#7a3a24', { weight: '600', stroke: '#c48a6a', sw: h * 0.03 })); }
  }
  // the giant HARD ROCK CAFE guitar on the tower (exterior_2: gold neck + headstock, coral-red body, the round logo across the body); double-sided cut-out
  SG.at((P.gbX0 + P.gbX1) / 2, P.gbTop + 0.55, -10.2, 0, 3.5, PPY(28) - P.gbTop - 0.55, (g, w, h) => {
    const k = w / 46, ky = h / 125; g.save(); g.scale(k, ky);
    g.fillStyle = '#e2b23a'; g.fillRect(19.5, 8, 7, 66); for (let y = 12; y < 72; y += 4.6) { g.fillStyle = '#9a7420'; g.fillRect(19.5, y, 7, 0.7); }
    g.fillStyle = '#f4ecd0'; g.fillRect(22.6, 8, 0.8, 66);
    g.fillStyle = '#e8b83a'; g.beginPath(); g.moveTo(17.5, 0); g.lineTo(29.5, 0); g.lineTo(28.5, 10); g.lineTo(18.5, 10); g.closePath(); g.fill(); g.strokeStyle = '#8a5a10'; g.lineWidth = 0.8; g.stroke();
    sText(g, 'HR', 23.5, 4.6, 9, 6, SERIF, '#c8241c');
    g.fillStyle = '#d8d0c0'; for (let i = 0; i < 3; i++) { g.fillRect(14.5, 1.2 + i * 3, 3, 1.4); g.fillRect(29.5, 1.2 + i * 3, 3, 1.4); }
    g.beginPath(); g.moveTo(23, 70); g.bezierCurveTo(8, 63, 3, 80, 7, 90); g.bezierCurveTo(10, 98, 1, 106, 6, 115); g.bezierCurveTo(12, 126, 34, 126, 40, 115);
    g.bezierCurveTo(45, 106, 36, 98, 39, 90); g.bezierCurveTo(43, 80, 38, 63, 29, 68); g.closePath(); g.fillStyle = '#e4566a'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#6a1424'; g.stroke();
    g.fillStyle = '#f4f0e6'; g.fillRect(14, 112, 18, 2.6); g.restore();
    g.save(); g.translate(w * 0.12, 80 * ky); hrLogo(g, w * 0.76, w * 0.76); g.restore(); });
  // ---------- EAST: the HARD ROCK CAFE building ----------
  { const x0 = P.pcX1, x1 = P.hrX1, z0 = P.hrZN, z1 = P.hrZS, f = ppFaces(x0, z0, x1, z1, H), u = (px) => PPX(px) - x0;
    H.box(x0, Y0, z0, x1, P.hrEave, z1, BR); H.box(x0, Y0, z0, x1 + 0.12, Y0 + 0.8, z1 + 0.12, '#6a5a50');
    H.box(PPX(870), P.hrEave, z1 - 3, x1, P.hrPar, z1, BR); H.box(PPX(870), P.hrEave, z0, x1, P.hrPar - 0.6, z1 - 3, BR2); // parapet wall + the roof behind
    H.box(PPX(950), P.hrPar, z1 - 1.2, PPX(1120), P.hrStep, z1, BR); H.box(PPX(950) - 0.1, P.hrStep - 0.05, z1 - 1.3, PPX(1120) + 0.1, P.hrStep + 0.12, z1 + 0.1, CR);
    H.box(PPX(870) - 0.1, P.hrPar - 0.05, z1 - 3.1, x1 + 0.1, P.hrPar + 0.12, z1 + 0.1, CR); H.box(x0, P.hrEave - 0.05, z1 - 3.1, PPX(870), P.hrEave + 0.12, z1 + 0.1, CR);
    { const xa = PPX(955), xb = PPX(1060), xm = (xa + xb) / 2, g = new THREE.BufferGeometry(), za = z1 - 1.0, zb = z1, ya = P.hrStep, v = [[xa, ya, zb], [xb, ya, zb], [xm, P.hrPeak, zb], [xa, ya, za], [xb, ya, za], [xm, P.hrPeak, za]], Pp = [], t = (a, b, c) => Pp.push(...v[a], ...v[b], ...v[c]);
      t(0, 1, 2); t(3, 5, 4); t(0, 2, 5); t(0, 5, 3); t(1, 4, 5); t(1, 5, 2); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, BR3);
      H.box(xm - 0.12, P.hrPeak - 0.2, za, xm + 0.12, P.hrPeak + 0.3, zb + 0.05, CR, { ol: false }); }
    const F = f.s;
    H.band(F, -0.1, F.L + 0.15, PPY(545), PPY(535), 0.2, CR, { ol: false }); H.band(F, -0.1, F.L + 0.15, PPY(690), PPY(684), 0.18, CR, { ol: false });
    for (const [a, b] of [[835, 878], [918, 955], [1085, 1127], [1175, 1222]]) { // the tall round-arched lower windows (white grids)
      const uc = (u(a) + u(b)) / 2, ww = u(b) - u(a), y0 = PPY(670), y1 = PPY(590);
      H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, pane, { ol: false, emi: LMR() < 0.7 ? '#ffd28a' : null }); H.farch(F, uc, y1, ww / 2, -0.05, 0.02, pane, { ol: false }, 8);
      for (let k = 1; k < 3; k++) H.fbox(F, u(a) + ww * k / 3 - 0.03, u(a) + ww * k / 3 + 0.03, y0, y1 + ww * 0.4, 0, 0.04, mull, { ol: false });
      for (let y = y0 + 0.45; y < y1 + ww * 0.4; y += 0.45) H.fbox(F, u(a), u(b), y, y + 0.05, 0, 0.04, mull, { ol: false });
      H.farch(F, uc, y1, ww / 2 + 0.12, 0, 0.06, CR, { ol: false }, 8); H.fbox(F, u(a) - 0.1, u(b) + 0.1, y0 - 0.12, y0, 0, 0.14, CR, { ol: false }); }
    { const a = 982, b = 1055, y0 = PPY(675), y1 = PPY(578); H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, '#2a2a30', { ol: false, emi: '#ffcf7a' }); // the big gridded entrance window
      for (let k = 1; k < 5; k++) H.fbox(F, u(a) + (u(b) - u(a)) * k / 5 - 0.03, u(a) + (u(b) - u(a)) * k / 5 + 0.03, y0, y1, 0, 0.04, '#5a3a2a', { ol: false });
      for (let y = y0 + 0.35; y < y1; y += 0.35) H.fbox(F, u(a), u(b), y, y + 0.05, 0, 0.04, '#5a3a2a', { ol: false }); }
    for (const [a, b, big] of [[915, 948, 0], [975, 1048, 1], [1075, 1113, 0]]) { const uc = (u(a) + u(b)) / 2, ww = u(b) - u(a), y0 = PPY(505), y1 = PPY(465) + (big ? 0.2 : 0); // upper arched windows in the gable
      H.fbox(F, u(a), u(b), y0, y1, -0.05, 0.02, pane, { ol: false, emi: LMR() < 0.6 ? '#ffd28a' : null }); H.farch(F, uc, y1, ww / 2, -0.05, 0.02, pane, { ol: false }, 8);
      H.farch(F, uc, y1, ww / 2 + 0.14, 0, 0.06, CR, { ol: false }, 8); for (let k = 1; k < (big ? 4 : 2) + 1; k++) H.fbox(F, u(a) + ww * k / ((big ? 4 : 2) + 1) - 0.03, u(a) + ww * k / ((big ? 4 : 2) + 1) + 0.03, y0, y1 + ww * 0.45, 0, 0.04, mull, { ol: false }); }
    H.pilasters(F, u(820), u(1250), Y0 + 0.8, P.hrEave - 0.3, 1.45, 0.26, 0.12, BR2, { ol: false });
    // HRC roundels, the Hard Rock Cafe logo + the SAVE THE PLANET marquee (exterior_2)
    const hrc = (g, w, h) => { const R = w / 2 - 1; g.fillStyle = '#c9a050'; g.beginPath(); g.arc(w / 2, h / 2, R, 0, TAU); g.fill(); g.fillStyle = '#efe0b4'; g.beginPath(); g.arc(w / 2, h / 2, R * 0.82, 0, TAU); g.fill();
      g.strokeStyle = '#a07a30'; g.lineWidth = R * 0.08; g.beginPath(); g.arc(w / 2, h / 2, R * 0.82, 0, TAU); g.stroke(); sText(g, 'HRC', w / 2, h * 0.53, R * 1.3, R * 0.8, SERIF, '#a07a30', { weight: '600' }); };
    SG.add(F, u(878), PPY(505), 1.0, 1.0, 0.12, hrc); SG.add(F, u(1148), PPY(478), 1.0, 1.0, 0.12, hrc);
    SG.add(F, u(1012), PPY(552), 2.3, 2.3, 0.16, (g, w, h) => hrLogo(g, w, h));
    SG.add(F, u(1015), PPY(580), 2.4, 0.6, 0.18, (g, w, h) => { g.fillStyle = '#fbf6ee'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.25); g.quadraticCurveTo(w / 2, -h * 0.25, w, h * 0.25); g.lineTo(w, h); g.fill();
      g.strokeStyle = '#c8241c'; g.lineWidth = h * 0.06; g.stroke(); sText(g, 'SAVE THE PLANET', w / 2, h * 0.6, w * 0.9, h * 0.5, SANS, '#d0241c', { weight: '900' }); });
    // red-roofed entrance pavilion + red awnings + green window awnings
    { const xa = PPX(940), xb = PPX(1062), zb = z1 + 1.6, ya = Y0 + 2.6; for (const x of [xa + 0.1, xb - 0.1]) H.box(x - 0.08, Y0, zb - 0.1, x + 0.08, ya, zb + 0.06, '#3a2a22', { ol: false });
      const g = new THREE.CylinderGeometry(0.01, 1.0, 0.9, 4); g.rotateY(Math.PI / 4); g.scale((xb - xa) * 0.72, 1, 1.25); g.translate((xa + xb) / 2, ya + 0.45, z1 + 0.85); H.geo(g, '#b8302a');
      H.box(xa, ya - 0.2, z1, xb, ya, zb, '#8a2a24', { ol: false }); lmColl({ x0: xa, x1: xb, z0: z1, z1: zb }); }
    H.fbox(F, u(812), u(935), Y0 + 2.2, Y0 + 2.35, 0, 1.6, '#c0302a', { ol: false }); H.fbox(F, u(1068), u(1255), Y0 + 2.2, Y0 + 2.35, 0, 1.6, '#c0302a', { ol: false });
    for (const [a, b] of [[840, 875], [918, 955], [1085, 1125], [1180, 1225]]) H.fbox(F, u(a), u(b), PPY(700), PPY(686), 0.02, 0.45, GRN, { ol: false });
    // side + back: arched windows, eaves cornice
    for (const k of ['e', 'n']) { const G = f[k]; H.windows(G, 0.5, G.L - 0.5, Y0 + 1, P.hrEave - 1, { bw: 1.6, fh: (P.hrEave - Y0 - 2) / 2, ww: 0.8, wh: 2.6, arch: true, head: CR, pane: GLS, lit: 0.55, mull });
      H.band(G, -0.1, G.L + 0.1, P.hrEave - 0.4, P.hrEave, 0.3, CR); }
    for (const x of [x0 + 2, x1 - 1.5]) H.cyl(x, P.hrPar - 0.6, -18, 0.35, 0.35, 1.2, 8, '#8a8a84', { ol: false });
  }
});

// ======================= HD landmarks batch 2: National Aquarium (Pier 3), Maryland Science Center, Harborplace pavilions, USS Constellation =======
// Same approach as batch 1 (03b_landmarks_hd.js): one merged toon mesh + one ink hull + one canvas-sign atlas per landmark, far LOD = the massing
// captured in parts/h_landmarks.js (footprints / heights there match these models), extra colliders via lmColl.
// Extra builder helpers (kept here so batch 1 stays untouched):
HB.prototype.seg = function (a, b, r, col, o = {}) { // a round bar from point a to point b (rigging, rods, mullions on slopes)
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if (L < 1e-4) return this;
  const g = new THREE.CylinderGeometry(o.r1 === undefined ? r : o.r1, r, L, o.seg || 4, 1, !!o.open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return this.add(g, col, Object.assign({ ol: false }, o));
};
{ const _box = HB.prototype.box; HB.prototype.box = function (x0, y0, z0, x1, y1, z1, col, o) { return _box.call(this, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), col, o); }; } // corner order free
HB.prototype.tris = function (pts, col, o) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return this.add(g, col, o); };
// a polygon prism: profile [[a, y], ...] extruded; 'x' = profile in (z, y) extruded x0..x1, 'z' = profile in (x, y) extruded z0..z1
HB.prototype.prism = function (axis, s0, s1, prof, col, o) {
  const sh = new THREE.Shape(prof.map(([a, y]) => new THREE.Vector2(axis === 'x' ? -a : a, y))), g = new THREE.ExtrudeGeometry(sh, { depth: s1 - s0, bevelEnabled: false });
  if (axis === 'x') { g.rotateY(Math.PI / 2); g.translate(s0, 0, 0); } else g.translate(0, 0, s0); return this.add(g, col, o);
};
// a hip roof over x0..x1 / z0..z1 from y up h, ridge along the long side
HB.prototype.hip = function (x0, z0, x1, z1, y, h, col, o) {
  const W = x1 - x0, D = z1 - z0, P = [], t = (a, b, c) => P.push(...a, ...b, ...c);
  const a = [x0, y, z1], b = [x1, y, z1], c = [x1, y, z0], d = [x0, y, z0];
  if (W >= D) { const r0 = [x0 + D / 2, y + h, (z0 + z1) / 2], r1 = [x1 - D / 2, y + h, (z0 + z1) / 2]; t(a, b, r1); t(a, r1, r0); t(b, c, r1); t(c, d, r0); t(c, r0, r1); t(d, a, r0); }
  else { const r0 = [(x0 + x1) / 2, y + h, z1 - W / 2], r1 = [(x0 + x1) / 2, y + h, z0 + W / 2]; t(a, b, r0); t(b, c, r1); t(b, r1, r0); t(c, d, r1); t(d, a, r0); t(d, r0, r1); }
  return this.tris(P, col, o);
};
// a square / rectangular pyramid (sides only)
HB.prototype.pyr = function (x0, z0, x1, z1, y, apex, col, o) {
  const A = [(x0 + x1) / 2, apex, (z0 + z1) / 2], c = [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], P = [];
  for (let i = 0; i < 4; i++) P.push(...c[i], ...c[(i + 1) % 4], ...A); return this.tris(P, col, o);
};
const LMHOOK = {}; // set-piece interior stubs (phase 5 builds them): LMHOOK.aquarium.tank, LMHOOK.science.imax; also on the LANDMARKS entry as .interior
function lmHook(id, h) { LMHOOK[id] = h; const L = LANDMARKS.find((l) => l.id === id); if (L) L.interior = h; }

// ======================= NATIONAL AQUARIUM, PIER 3 (refs/national-aquarium: exterior_3, night_1): the raw board-formed concrete block over a recessed
// navy base, a ribbon of dark windows, the navy box carrying the big GLASS PYRAMID (blue edge light at night), the red Australia wing with its sloped
// blue glass roof on the west, the colour-square mosaic at the south-west corner, the concrete drum with the blue neon WAVE at the pier's south end,
// the glass entrance on Pratt St, the "Amazing things happen." banner (drawn, not the photo). Pier 4's mammal pavilion + footbridge are not modelled.
const AQ = { mx0: 11, mx1: 23, mz0: -26, mz1: -13, top: CURB + 15, nav: CURB + 17.6, apex: CURB + 24.8, wx0: 7.5, wz0: -26, wz1: -17, wTop: CURB + 8, wPeak: CURB + 14.5,
  dx: 22, dz: -11, dr: 4.6, dTop: CURB + 11, sx1: 18, sz1: -7.5, sTop: CURB + 5.5, ex0: 13, ex1: 21, ez0: -28.2, eTop: CURB + 4.5 };
lmHD('aquarium', 19, -17, 19, (H, signs, SG) => {
  const Y0 = CURB, A = AQ, CON = '#b2ab9e', CON2 = '#9a9387', NAVY = '#26376c', GLS = '#25323e', RED = '#b5332b', BLU = '#3d6fa6';
  // ---- main block: recessed navy base (0..6 m), board-formed concrete above, overhang carried on corner piers
  H.box(A.mx0 + 0.9, Y0, A.mz0 + 0.9, A.mx1 - 0.9, Y0 + 6, A.mz1 - 0.9, NAVY);
  H.box(A.mx0, Y0 + 6, A.mz0, A.mx1, A.top, A.mz1, CON);
  for (const [x, z] of [[A.mx0, A.mz0], [A.mx1 - 0.9, A.mz0], [A.mx1 - 0.9, A.mz1 - 0.9]]) H.box(x, Y0, z, x + 0.9, Y0 + 6, z + 0.9, CON2);
  const f = ppFaces(A.mx0, A.mz0, A.mx1, A.mz1, H);
  for (const k of ['n', 'e', 's', 'w']) { const F = f[k];
    for (let y = Y0 + 6.6; y < A.top - 0.5; y += 1.15) H.band(F, 0, F.L, y, y + 0.05, 0.025, CON2, { ol: false }); // board-form lines
    H.band(F, -0.05, F.L + 0.05, Y0 + 6, Y0 + 6.35, 0.06, CON2, { ol: false });
    H.band(F, -0.12, F.L + 0.12, A.top - 0.45, A.top, 0.14, CON2); // coping
    if (k !== 'w') { // the ribbon of dark windows (exterior_3), mullions + random lit panes
      H.fbox(F, 1.2, F.L - 1.2, Y0 + 8.6, Y0 + 10.8, -0.06, 0.02, GLS, { ol: false });
      for (let u = 1.2; u < F.L - 1.2; u += 1.05) { H.fbox(F, u, u + 0.06, Y0 + 8.6, Y0 + 10.8, 0, 0.05, '#4a525a', { ol: false }); if (LMR() < 0.45) H.fbox(F, u + 0.06, u + 1.0, Y0 + 8.65, Y0 + 10.75, 0, 0.03, GLS, { ol: false, emi: '#cfe0ff' }); }
      H.band(F, 1.1, F.L - 1.1, Y0 + 8.45, Y0 + 8.6, 0.08, CON2, { ol: false }); }
    // base: glazed storefront in the navy recess (lit at night)
    const B = H.frame(...{ n: [A.mx1 - 0.9, A.mz0 + 0.9, A.mx0 + 0.9, A.mz0 + 0.9], e: [A.mx1 - 0.9, A.mz1 - 0.9, A.mx1 - 0.9, A.mz0 + 0.9], s: [A.mx0 + 0.9, A.mz1 - 0.9, A.mx1 - 0.9, A.mz1 - 0.9], w: [A.mx0 + 0.9, A.mz0 + 0.9, A.mx0 + 0.9, A.mz1 - 0.9] }[k]);
    H.windows(B, 0.6, B.L - 0.6, Y0 + 0.4, Y0 + 5.4, { bw: 1.5, fh: 2.5, ww: 1.3, wh: 2.0, pane: '#3b5266', lit: 0.65, mull: '#8a96a2' }); }
  H.fbox(f.n, 4.6, 7.6, Y0 + 11.6, Y0 + 13.1, 0, 0.05, '#6a645a', { ol: false }); for (let y = Y0 + 11.75; y < Y0 + 13; y += 0.22) H.fbox(f.n, 4.65, 7.55, y, y + 0.08, 0.05, 0.12, '#4a463e', { ol: false }); // louvre
  // ---- mosaic of colour squares, the south-west corner (exterior_3 / night_1)
  { const x0 = A.mx0, z0 = A.mz1 - 4.6, pal = ['#f2efe6', '#d8382e', '#3aa64a', '#f0a030', '#a8a296', '#2a3440', '#f2efe6', '#e86a2a'];
    H.box(x0, Y0, z0, x0 + 5.2, Y0 + 6, A.mz1, '#e8e4da');
    for (const F of [H.frame(x0, z0, x0, A.mz1), H.frame(x0, A.mz1, x0 + 5.2, A.mz1)]) for (let r = 0; r < 5; r++) for (let c = 0; c < Math.floor(F.L / 0.95); c++) {
      const col = pal[Math.floor(LMR() * pal.length)]; H.fbox(F, 0.05 + c * 0.95, 0.95 + c * 0.95, Y0 + 0.4 + r * 1.1, Y0 + 1.42 + r * 1.1, 0, 0.04, col, { ol: false, emi: col === '#2a3440' && LMR() < 0.7 ? '#ffe0a0' : (r > 0 && LMR() < 0.25 ? col : null) }); } }
  // ---- the navy box + the GLASS PYRAMID
  const px0 = 12, px1 = 22, pz0 = -25, pz1 = -14;
  H.box(px0, A.top, pz0, px1, A.nav, pz1, NAVY);
  for (const F of Object.values(ppFaces(px0, pz0, px1, pz1, H))) { for (let u = 0.8; u < F.L - 0.6; u += 1.4) H.fbox(F, u, u + 0.9, A.top + 0.9, A.top + 1.9, -0.04, 0.02, GLS, { ol: false, emi: LMR() < 0.5 ? '#bcd4ff' : null }); H.band(F, -0.05, F.L + 0.05, A.nav - 0.18, A.nav, 0.08, '#1a2550', { ol: false }); }
  H.pyr(px0, pz0, px1, pz1, A.nav, A.apex, '#86bccb', { emi: '#2c5a50' });
  { const cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2, h = A.apex - A.nav, ap = [cx, A.apex, cz], c = [[px0, pz1], [px1, pz1], [px1, pz0], [px0, pz0]], MU = '#d8e4e8';
    const on = (x, z, k) => [lerp(x, cx, k), A.nav + h * k, lerp(z, cz, k)];
    for (let k = 0.11; k < 0.95; k += 0.11) for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; H.seg(on(a[0], a[1], k), on(b[0], b[1], k), 0.045, MU); }
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; for (let t = 1 / 7; t < 0.99; t += 1 / 7) H.seg([lerp(a[0], b[0], t), A.nav, lerp(a[1], b[1], t)], ap, 0.04, MU); }
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; // the edge light: blue tube on the hips + base (blue neon at night, steel blue by day)
      H.seg([a[0], A.nav + 0.05, a[1]], ap, 0.13, '#4a5c9a', { emi: '#7a96ff' }); H.seg([a[0], A.nav + 0.06, a[1]], [b[0], A.nav + 0.06, b[1]], 0.13, '#4a5c9a', { emi: '#7a96ff' }); } }
  // ---- roof plant on the concrete block (outside the navy box)
  for (const [x, z, w, d] of [[A.mx0 + 0.3, A.mz0 + 0.4, 1.6, 0.9], [A.mx1 - 1.9, A.mz0 + 0.3, 1.5, 1.1], [A.mx1 - 0.8, -20, 0.6, 2.2], [A.mx0 + 0.25, -17, 0.6, 1.6]]) H.box(x, A.top, z, x + w, A.top + 1.1, z + d, '#8e8a82');
  // ---- the red AUSTRALIA wing with its sloped blue glass roof + the red steel frame (exterior_3)
  H.box(A.wx0, Y0, A.wz0, A.mx0 + 0.02, A.wTop, A.wz1, RED);
  H.prism('z', A.wz0, A.wz1, [[A.wx0, A.wTop], [A.mx0 + 0.02, A.wTop], [A.mx0 + 0.02, A.wPeak]], BLU, { emi: '#1e3a6a' });
  { const L = Math.hypot(A.mx0 - A.wx0, A.wPeak - A.wTop), sl = Math.atan2(A.wPeak - A.wTop, A.mx0 - A.wx0);
    for (let z = A.wz0 + 0.9; z < A.wz1 - 0.2; z += 0.9) H.seg([A.wx0 - 0.02, A.wTop + 0.02, z], [A.mx0, A.wPeak + 0.02, z], 0.035, '#d8e4ea');
    for (let k = 1; k < 5; k++) { const x = lerp(A.wx0, A.mx0, k / 5), y = lerp(A.wTop, A.wPeak, k / 5) + 0.04; H.seg([x - 0.03, y, A.wz0], [x - 0.03, y, A.wz1], 0.035, '#d8e4ea'); }
    for (const z of [A.wz0 - 0.15, A.wz1 + 0.15]) { H.seg([A.wx0 - 0.15, A.wTop, z], [A.mx0 + 0.1, A.wPeak + 0.35, z], 0.1, '#c0302a'); H.seg([A.mx0 + 0.1, A.wPeak + 0.35, z], [A.mx0 + 0.1, A.wTop, z], 0.1, '#c0302a'); } void L; void sl; }
  for (const F of [H.frame(A.wx0, A.wz0, A.wx0, A.wz1), H.frame(A.wx0, A.wz1, A.mx0, A.wz1), H.frame(A.mx0, A.wz0, A.wx0, A.wz0)]) {
    H.windows(F, 0.4, F.L - 0.4, Y0 + 0.5, Y0 + 3.6, { bw: 1.6, fh: 3.1, ww: 1.3, wh: 2.3, pane: '#3a4e5e', lit: 0.6, mull: '#d8d2c8' });
    H.band(F, -0.06, F.L + 0.06, A.wTop - 0.35, A.wTop, 0.1, '#8a2420'); H.band(F, -0.04, F.L + 0.04, Y0 + 3.8, Y0 + 4.0, 0.06, '#8a2420', { ol: false }); }
  // ---- the south block (glass, lit) and the concrete DRUM with the blue neon WAVE
  H.box(A.mx0, Y0, A.mz1, A.sx1, A.sTop, A.sz1, '#c8c4ba');
  for (const F of [H.frame(A.mx0, A.mz1, A.mx0, A.sz1), H.frame(A.mx0, A.sz1, A.sx1, A.sz1)]) { H.windows(F, 0.3, F.L - 0.3, Y0 + 0.4, A.sTop - 0.6, { bw: 1.2, fh: A.sTop - 1.0 - Y0, ww: 1.05, wh: 3.6, pane: '#33505a', lit: 0.7, mull: '#7aa08a' }); H.band(F, -0.05, F.L + 0.05, A.sTop - 0.4, A.sTop, 0.1, CON2); }
  H.cyl(A.dx, Y0, A.dz, A.dr, A.dr, A.dTop - Y0, 28, CON);
  for (let y = Y0 + 1.1; y < A.dTop - 0.6; y += 1.1) H.cyl(A.dx, y, A.dz, A.dr + 0.02, A.dr + 0.02, 0.05, 28, CON2, { ol: false });
  H.cyl(A.dx, A.dTop - 0.45, A.dz, A.dr + 0.12, A.dr + 0.12, 0.45, 28, CON2);
  H.cyl(A.dx, A.dTop, A.dz, A.dr - 0.7, A.dr - 0.7, 1.3, 24, '#3c6a9a', { emi: '#2a4a8a' }); H.cyl(A.dx, A.dTop + 1.3, A.dz, A.dr - 0.55, A.dr - 0.55, 0.2, 24, CON2);
  for (const th of [0.55, 1.1, 1.65]) { const x = A.dx + Math.sin(th) * (A.dr + 0.03), z = A.dz + Math.cos(th) * (A.dr + 0.03); H.box(x - 0.3, Y0 + 0.2, z - 0.3, x + 0.3, Y0 + 2.6, z + 0.3, '#2a3a4a', { ol: false, emi: '#ffd8a0' }); }
  { let prev = null; for (let i = 0; i <= 60; i++) { const th = lerp(-1.25, 0.55, i / 60), r = A.dr + 0.1, y = Y0 + 6.2 + Math.sin(i / 60 * TAU * 2.25) * 0.9 + (i > 54 ? (i - 54) * 0.12 : 0);
    const p = [A.dx + Math.sin(th) * r, y, A.dz + Math.cos(th) * r]; if (prev) H.seg(prev, p, 0.11, '#5a72d6', { emi: '#86a2ff', seg: 5 }); prev = p; } }
  // ---- Pratt St entrance pavilion (glass, steel) + the name on the concrete above
  H.box(A.ex0, Y0, A.ez0, A.ex1, A.eTop, A.mz0, '#2e3e4c', { emi: '#3a3020' });
  H.box(A.ex0 - 0.3, A.eTop, A.ez0 - 0.3, A.ex1 + 0.3, A.eTop + 0.3, A.mz0, '#d8d6d0');
  { const F = H.frame(A.ex1, A.ez0, A.ex0, A.ez0); for (let u = 0; u <= F.L + 0.01; u += 1.0) H.fbox(F, u - 0.05, u + 0.05, Y0, A.eTop, 0, 0.08, '#d8d6d0', { ol: false }); H.fbox(F, 0, F.L, Y0 + 2.6, Y0 + 2.7, 0, 0.08, '#d8d6d0', { ol: false });
    for (let u = 0.1; u < F.L; u += 1.0) H.fbox(F, u, u + 0.85, Y0 + 0.05, Y0 + 2.55, -0.05, 0.02, '#3a5060', { ol: false, emi: '#ffe2a8' }); }
  SG.add(f.n, f.n.L / 2, Y0 + 6.7, 8.4, 1.3, 0.08, (g, w, h) => { sText(g, 'NATIONAL AQUARIUM', w / 2, h * 0.42, w * 0.97, h * 0.62, SANS, '#1f3a78', { weight: '800', track: 2, stroke: '#e8eef8', sw: h * 0.04 });
    sText(g, 'BALTIMORE', w / 2, h * 0.85, w * 0.3, h * 0.2, SANS, '#1f3a78', { weight: '700', track: 6 }); });
  SG.add(H.frame(A.ex1, A.ez0 - 0.31, A.ex0, A.ez0 - 0.31), 4, A.eTop + 0.02, 6.2, 0.26, 0.02, (g, w, h) => { g.fillStyle = '#1f3a78'; g.fillRect(0, 0, w, h); sText(g, 'NATIONAL AQUARIUM \u00b7 ENTRANCE', w / 2, h / 2, w * 0.95, h * 0.72, SANS, '#ffffff', { weight: '700', track: 2 }); });
  // the west-face banner (exterior_3): "Amazing things happen." over a dolphin in blue water, NATIONAL AQUARIUM / aqua.org (drawn here, not the photo)
  SG.add(f.w, f.w.L - 1.9, Y0 + 7.4, 3.0, 5.6, 0.06, (g, w, h) => {
    const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#e8f2fa'); sk.addColorStop(0.2, '#e8f2fa'); sk.addColorStop(0.21, '#1f6fae'); sk.addColorStop(1, '#0b2f66'); g.fillStyle = sk; g.fillRect(0, 0, w, h);
    sText(g, 'Amazing', w * 0.06, h * 0.06, w * 0.9, h * 0.07, SANS, '#1f4f9a', { align: 'left', weight: '700' }); sText(g, 'things happen.', w * 0.06, h * 0.14, w * 0.9, h * 0.07, SANS, '#1f4f9a', { align: 'left', weight: '700' });
    g.save(); g.translate(w * 0.55, h * 0.45); g.rotate(-0.35); g.fillStyle = '#9ab4c8'; g.beginPath(); g.ellipse(0, 0, w * 0.26, h * 0.045, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-w * 0.02, -h * 0.03); g.lineTo(w * 0.06, -h * 0.085); g.lineTo(w * 0.08, -h * 0.03); g.fill(); g.beginPath(); g.moveTo(w * 0.24, 0); g.lineTo(w * 0.34, -h * 0.03); g.lineTo(w * 0.32, h * 0.03); g.fill();
    g.beginPath(); g.ellipse(-w * 0.27, h * 0.008, w * 0.05, h * 0.012, 0, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#20242a'; g.beginPath(); g.ellipse(w * 0.22, h * 0.6, w * 0.035, h * 0.06, 0.3, 0, TAU); g.fill(); g.fillRect(w * 0.2, h * 0.52, w * 0.04, h * 0.02);
    g.fillStyle = '#0a2654'; g.fillRect(0, h * 0.8, w, h * 0.2); g.strokeStyle = '#fff'; g.lineWidth = w * 0.015; g.beginPath(); g.arc(w / 2, h * 0.845, w * 0.05, 0, TAU); g.stroke();
    sText(g, 'NATIONAL', w / 2, h * 0.9, w * 0.6, h * 0.04, SANS, '#fff', { weight: '700', track: 2 }); sText(g, 'AQUARIUM', w / 2, h * 0.94, w * 0.6, h * 0.04, SANS, '#fff', { weight: '700', track: 2 });
    sText(g, 'aqua.org', w / 2, h * 0.975, w * 0.3, h * 0.025, SANS, '#cfe0ff', { weight: '500' }); });
  // stub hook: the underwater tank set piece (phase 5) sits under the pyramid; the Pratt St doors are its way in
  lmHook('aquarium', { stub: true, kind: 'underwater_tank', door: { x: (A.ex0 + A.ex1) / 2, z: A.ez0 - 0.6 }, tank: { x: 17, y: CURB + 1, z: -19.5, w: 10, d: 11, h: 12 } });
});

// ======================= MARYLAND SCIENCE CENTER (refs/maryland-science-center: exterior_1 aerial, msc_web_1 / msc_web_3 entrance). Seen from the
// harbour (looking south), left to right = east to west: the 1976 dark-brick block with its brick stair towers + the white observatory dome on the roof,
// the glass box with the yellow ELEMENTS CAFE pod, the brick panel with the oval MARYLAND SCiENCE CENTER sign + IMAX THEATER / DAVIS PLANETARIUM
// banners, the slim glass stair tower, the curved glass drum with the yellow "Let's science" canopy, the silver ribbed wing + the west glass box;
// the crossed-rod steel sculpture over the plaza. The IMAX theatre (later set piece) is a stub hook inside the brick block.
const MSC = { bx0: -51, bx1: -42.5, bz0: 52, bz1: 69, bTop: CURB + 12, gx0: -50.5, gx1: -43, gz0: 47, gz1: 52, gTop: CURB + 10, px0: -53.2, px1: -50.5, pz0: 48, pz1: 57, pTop: CURB + 13.2,
  tx0: -54.5, tx1: -53.2, tz0: 47.8, tz1: 49.4, tTop: CURB + 15.2, dx: -57.6, dz: 55, dr: 5.6, dTop: CURB + 9.6, d2Top: CURB + 12.6, wx0: -66, wx1: -62, wz0: 47.6, wz1: 57, wTop: CURB + 8.6,
  mx0: -66, mx1: -56, mz0: 57, mz1: 69, mTop: CURB + 11, cx0: -56, cx1: -51, cz0: 57, cz1: 69 };
lmHD('science', -54, 58, 16, (H, signs, SG) => {
  const Y0 = CURB, M = MSC, BR = '#7a3b2b', BR2 = '#683022', BR3 = '#86442f', GL = '#3f6f9a', GLD = '#2c4a66', ST = '#d4d8dc', YEL = '#e8b028', SIL = '#b4bac0';
  const glassFace = (F, y0, y1, o = {}) => { // curtain wall: tinted glass, light steel grid, random lit panels
    H.fbox(F, 0, F.L, y0, y1, -0.04, 0.02, o.col || GL, { ol: false });
    const nb = Math.max(1, Math.round(F.L / (o.bw || 1.5))), nf = Math.max(1, Math.round((y1 - y0) / (o.fh || 1.8)));
    for (let i = 0; i <= nb; i++) H.fbox(F, F.L * i / nb - 0.05, F.L * i / nb + 0.05, y0, y1, 0, 0.07, ST, { ol: false });
    for (let j = 0; j <= nf; j++) H.fbox(F, 0, F.L, y0 + (y1 - y0) * j / nf - 0.04, y0 + (y1 - y0) * j / nf + 0.04, 0, 0.06, ST, { ol: false });
    for (let i = 0; i < nb; i++) for (let j = 0; j < nf; j++) if (LMR() < (o.lit || 0.45)) H.fbox(F, F.L * i / nb + 0.06, F.L * (i + 1) / nb - 0.06, y0 + (y1 - y0) * j / nf + 0.05, y0 + (y1 - y0) * (j + 1) / nf - 0.05, 0.005, 0.03, GLD, { ol: false, emi: LMR() < 0.8 ? '#ffe0a8' : '#cfe0ff' });
  };
  // ---- the brick block (east) + the connecting brick mass behind the drum
  H.box(M.bx0, Y0, M.bz0, M.bx1, M.bTop, M.bz1, BR); H.box(M.cx0, Y0, M.cz0, M.cx1, M.bTop, M.cz1, BR2);
  for (const F of Object.values(ppFaces(M.bx0, M.bz0, M.bx1, M.bz1, H))) { H.band(F, -0.1, F.L + 0.1, M.bTop - 0.4, M.bTop, 0.12, BR2); for (let y = Y0 + 1; y < M.bTop - 0.6; y += 2.4) H.band(F, 0, F.L, y, y + 0.08, 0.04, BR3, { ol: false });
    H.windows(F, 1.0, F.L - 1.0, Y0 + 8.2, Y0 + 10.6, { bw: 3.2, fh: 2.4, ww: 0.5, wh: 1.6, pane: '#2a2f38', lit: 0.4 }); }
  for (const [x, z, w, top] of [[-50.8, 52.2, 2.6, CURB + 16.2], [-45.2, 52.6, 2.4, CURB + 15.4], [-50.6, 62.5, 2.4, CURB + 15.8], [-44.6, 64.8, 2.6, CURB + 16.6], [-55.6, 66, 2.4, CURB + 15.2]]) { // the brick stair towers
    H.box(x, Y0, z, x + w, top, z + w, BR3); H.box(x - 0.1, top - 0.35, z - 0.1, x + w + 0.1, top, z + w + 0.1, BR2);
    for (const F of Object.values(ppFaces(x, z, x + w, z + w, H))) H.fbox(F, F.L / 2 - 0.12, F.L / 2 + 0.12, Y0 + 2, top - 1.2, -0.05, 0.02, '#4a2418', { ol: false }); }
  // the observatory: a white dome on a short drum on the brick roof (exterior_1)
  H.cyl(-46.8, M.bTop, 60.5, 2.0, 2.0, 1.2, 16, '#c8c4bc'); { const g = new THREE.SphereGeometry(2.05, 16, 8, 0, TAU, 0, Math.PI / 2); g.translate(-46.8, M.bTop + 1.2, 60.5); H.geo(g, '#f2f2f0'); }
  H.box(-46.95, M.bTop + 1.2, 58.4, -46.65, M.bTop + 3.2, 58.6, '#9aa0a8', { ol: false }); // the dome slit
  // rooftop: white tent structure (exterior_1) on the connecting block
  H.box(M.cx0 + 0.4, M.bTop, M.cz0 + 1, M.cx1 - 0.4, M.bTop + 0.9, M.cz0 + 7, '#e8e8e4'); for (let z = M.cz0 + 1.6; z < M.cz0 + 7; z += 1.5) H.prism('x', M.cx0 + 0.4, M.cx1 - 0.4, [[z - 0.75, M.bTop + 0.9], [z + 0.75, M.bTop + 0.9], [z, M.bTop + 1.6]], '#f4f4f0');
  // ---- the east glass box + the yellow ELEMENTS CAFE pod
  H.box(M.gx0, Y0, M.gz0, M.gx1, M.gTop, M.gz1, GL);
  { const f = ppFaces(M.gx0, M.gz0, M.gx1, M.gz1, H); for (const k of ['n', 'e', 'w']) glassFace(f[k], Y0 + 0.05, M.gTop - 0.05, { bw: 1.4, fh: 1.65 });
    H.box(M.gx0 - 0.12, M.gTop - 0.1, M.gz0 - 0.12, M.gx1 + 0.12, M.gTop + 0.25, M.gz1 + 0.12, ST);
    H.box(-50.2, Y0, 46.4, -46.2, Y0 + 3.3, 48.6, YEL); H.box(-50.3, Y0 + 3.3, 46.3, -46.1, Y0 + 3.5, 48.7, '#c8901a');
    const N = H.frame(-46.2, 46.4, -50.2, 46.4); H.fbox(N, 0.6, 2.3, Y0 + 0.05, Y0 + 2.4, -0.04, 0.03, '#2a3440', { ol: false, emi: '#ffe0a8' }); H.fbox(N, 2.6, 3.6, Y0 + 0.05, Y0 + 2.4, -0.04, 0.03, '#2a3440', { ol: false, emi: '#ffe0a8' });
    SG.add(N, 2.0, Y0 + 2.55, 3.4, 0.5, 0.03, (g, w, h) => sText(g, 'ELEMENTS CAF\u00c9', w / 2, h / 2, w * 0.95, h * 0.8, SERIF, '#e8486a', { weight: '900', stroke: '#8a1a30', sw: h * 0.05 })); }
  // ---- the brick panel with the oval sign + the two banners
  H.box(M.px0, Y0, M.pz0, M.px1, M.pTop, M.pz1, BR); H.box(M.px0 - 0.08, M.pTop - 0.3, M.pz0 - 0.08, M.px1 + 0.08, M.pTop, M.pz1 + 0.08, BR2);
  H.box(M.px0 + 0.6, M.pTop, M.pz0 + 0.5, M.px0 + 1.4, M.pTop + 0.5, M.pz0 + 1.6, '#c8c8c4'); // the rooftop camera box (msc_web_1)
  { const N = H.frame(M.px1, M.pz0, M.px0, M.pz0);
    SG.add(N, N.L / 2, Y0 + 9.6, 2.5, 1.25, 0.1, (g, w, h) => { g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, TAU); g.fill(); g.fillStyle = '#111316'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - h * 0.07, h / 2 - h * 0.07, 0, 0, TAU); g.fill();
      sText(g, 'MARYLAND', w * 0.52, h * 0.27, w * 0.38, h * 0.13, SANS, '#7fb4e8', { weight: '700', track: 2 }); sText(g, 'SCiENCE', w * 0.47, h * 0.55, w * 0.68, h * 0.36, SERIF, '#f4f4f0', { weight: '700' });
      sText(g, 'CENTER', w * 0.66, h * 0.79, w * 0.3, h * 0.12, SANS, '#7fb4e8', { weight: '700', track: 2 }); });
    const banner = (x, title, sub, art) => SG.add(N, x, Y0 + 2.6, 1.15, 5.0, 0.06, (g, w, h) => { g.fillStyle = '#14181e'; g.fillRect(0, 0, w, h); art(g, w, h);
      sText(g, title, w / 2, h * 0.045, w * 0.9, h * 0.035, SANS, '#ffffff', { weight: '800' }); sText(g, sub, w / 2, h * 0.94, w * 0.9, h * 0.06, SANS, '#7fd0ff', { weight: '900' }); });
    banner(0.75, 'IMAX THEATER', 'IMAX', (g, w, h) => { const sk = g.createLinearGradient(0, h * 0.1, 0, h * 0.85); sk.addColorStop(0, '#3a6a9a'); sk.addColorStop(0.5, '#a8c8d8'); sk.addColorStop(1, '#2a3a2a'); g.fillStyle = sk; g.fillRect(0, h * 0.08, w, h * 0.8);
      g.fillStyle = '#e86a1a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * w * 0.18, h * 0.3, w * 0.2, h * 0.07, s * 0.5, 0, TAU); g.fill(); } g.fillStyle = '#1a1a1a'; g.fillRect(w * 0.48, h * 0.22, w * 0.04, h * 0.16);
      g.fillStyle = '#f2f0ea'; g.beginPath(); g.ellipse(w * 0.5, h * 0.66, w * 0.34, h * 0.09, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(w * 0.26, h * 0.6, w * 0.13, 0, TAU); g.fill(); });
    banner(1.95, 'DAVIS PLANETARIUM', 'Under the Dome', (g, w, h) => { g.fillStyle = '#0a1230'; g.fillRect(0, h * 0.08, w, h * 0.8); g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) g.fillRect(LMR() * w, h * 0.08 + LMR() * h * 0.6, 1.5, 1.5);
      g.fillStyle = '#1a2a1a'; g.beginPath(); g.moveTo(0, h * 0.88); g.lineTo(0, h * 0.72); g.quadraticCurveTo(w / 2, h * 0.62, w, h * 0.72); g.lineTo(w, h * 0.88); g.fill();
      sText(g, 'Day', w / 2, h * 0.3, w * 0.8, h * 0.07, SCRIPT, '#f4f0e0'); sText(g, 'Turns to', w / 2, h * 0.37, w * 0.8, h * 0.05, SCRIPT, '#f4f0e0'); sText(g, 'Night', w / 2, h * 0.45, w * 0.9, h * 0.08, SCRIPT, '#f4f0e0'); }); }
  // ---- the slim glass stair tower (white frame)
  H.box(M.tx0, Y0, M.tz0, M.tx1, M.tTop, M.tz1, GL); H.box(M.tx0 - 0.1, M.tTop - 0.5, M.tz0 - 0.1, M.tx1 + 0.1, M.tTop, M.tz1 + 0.1, '#f2f2ee');
  { const f = ppFaces(M.tx0, M.tz0, M.tx1, M.tz1, H); for (const k of ['n', 'e', 'w']) { const F = f[k]; for (const u of [0, F.L]) H.fbox(F, u - 0.1, u + 0.1, Y0, M.tTop - 0.5, 0, 0.1, '#f2f2ee', { ol: false }); for (let y = Y0 + 2.2; y < M.tTop - 0.6; y += 1.9) H.fbox(F, 0, F.L, y, y + 0.1, 0, 0.08, '#f2f2ee', { ol: false });
    for (let y = Y0 + 2.3; y < M.tTop - 1; y += 1.9) if (LMR() < 0.6) H.fbox(F, 0.12, F.L - 0.12, y + 0.15, y + 1.7, 0.005, 0.03, GLD, { ol: false, emi: '#e8f0ff' }); } }
  // ---- the curved glass DRUM (lower curtain wall, white band, recessed upper ring, flat roof) + the "Let's science" canopy
  H.cyl(M.dx, Y0, M.dz, M.dr, M.dr, M.dTop - Y0, 32, GL, { emi: '#3a3420' });
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, x = M.dx + Math.sin(a) * (M.dr + 0.04), z = M.dz + Math.cos(a) * (M.dr + 0.04); H.box(x - 0.06, Y0, z - 0.06, x + 0.06, M.dTop, z + 0.06, ST, { ol: false }); }
  for (let y = Y0 + 2.4; y < M.dTop - 0.5; y += 2.4) H.cyl(M.dx, y, M.dz, M.dr + 0.05, M.dr + 0.05, 0.1, 32, ST, { ol: false });
  H.cyl(M.dx, M.dTop, M.dz, M.dr + 0.25, M.dr + 0.25, 0.7, 32, '#e4e6e8');
  H.cyl(M.dx, M.dTop + 0.7, M.dz, M.dr - 1.1, M.dr - 1.1, M.d2Top - M.dTop - 1.1, 28, '#5d7f9c', { emi: '#2a3040' });
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, x = M.dx + Math.sin(a) * (M.dr - 1.06), z = M.dz + Math.cos(a) * (M.dr - 1.06); H.box(x - 0.05, M.dTop + 0.7, z - 0.05, x + 0.05, M.d2Top - 0.4, z + 0.05, ST, { ol: false }); }
  H.cyl(M.dx, M.d2Top - 0.4, M.dz, M.dr - 0.8, M.dr - 0.8, 0.4, 28, '#d8dade');
  for (const [x, z] of [[-58.6, 53.6], [-56.4, 56.2]]) H.box(x, M.d2Top, z, x + 1.2, M.d2Top + 0.7, z + 0.8, '#8a8e92'); // roof plant
  { const cxa = -58.9, cxb = -55.1, zb = M.dz - M.dr - 1.4, za = M.dz - M.dr + 0.6, y = Y0 + 2.9; // canopy (msc_web_1): yellow box frame on two posts
    H.box(cxa, y, zb, cxb, y + 0.75, za, YEL); H.box(cxa + 0.15, y - 0.05, zb + 0.15, cxb - 0.15, y + 0.02, za, '#a87a10', { ol: false });
    for (const x of [cxa + 0.12, cxb - 0.3]) H.box(x, Y0, zb + 0.1, x + 0.18, y, zb + 0.3, '#c8901a'); lmColl({ x0: cxa, x1: cxb, z0: zb, z1: zb + 0.4 });
    H.box(cxa + 0.3, Y0, za - 0.9, cxb - 0.3, Y0 + 2.5, za - 0.7, '#2a3440', { emi: '#ffe4b0' });
    SG.at((cxa + cxb) / 2, y - 0.45, zb - 0.02, 0, 3.4, 0.42, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); sText(g, "Let's", w * 0.3, h / 2, w * 0.3, h * 0.7, SANS, '#fff', { weight: '800' }); sText(g, 'science', w * 0.66, h / 2, w * 0.4, h * 0.7, SANS, '#fff', { weight: '800' }); }); }
  // ---- the silver ribbed wing (behind) + the west glass box with its white roof slab
  H.box(M.mx0, Y0, M.mz0, M.mx1, M.mTop, M.mz1, SIL);
  for (const F of Object.values(ppFaces(M.mx0, M.mz0, M.mx1, M.mz1, H))) { for (let u = 0.3; u < F.L; u += 0.6) H.fbox(F, u - 0.06, u + 0.06, Y0 + 0.5, M.mTop - 0.3, 0, 0.08, '#9aa0a8', { ol: false }); H.band(F, -0.15, F.L + 0.15, M.mTop - 0.3, M.mTop + 0.1, 0.2, '#dde0e2'); }
  H.box(M.mx0 + 0.6, M.mTop, M.mz0 + 0.8, M.mx1 - 0.6, M.mTop + 0.9, M.mz1 - 0.8, '#c4c8cc'); // the raised roof deck
  H.box(M.wx0, Y0, M.wz0, M.wx1, M.wTop, M.wz1, GL);
  { const f = ppFaces(M.wx0, M.wz0, M.wx1, M.wz1, H); for (const k of ['n', 'w', 'e']) glassFace(f[k], Y0 + 0.05, M.wTop - 0.6, { bw: 1.3, fh: 2.0, col: '#356a5a', lit: 0.55 });
    H.box(M.wx0 - 0.5, M.wTop - 0.6, M.wz0 - 0.6, M.wx1 + 0.5, M.wTop + 0.25, M.wz1 + 0.2, '#ecece8'); }
  // ---- the crossed-rod stainless sculpture over the plaza (msc_web_1 / 3): a tensegrity of floating struts tied by cables, on three leaning ground struts
  { const S = '#e4e8ec', K = '#8a9098', ends = [];
    for (const [x, z, tx, ty, tz] of [[-57.2, 46.4, -55.6, CURB + 7.4, 46.9], [-51.6, 46.6, -53.0, CURB + 7.0, 47.0], [-54.4, 47.6, -54.2, CURB + 6.6, 46.5]]) { H.seg([x, CURB, z], [tx, ty, tz], 0.08, S, { seg: 6 }); lmColl({ x, z, r: 0.3 }); ends.push([tx, ty, tz]); }
    for (let i = 0; i < 9; i++) { const c = [lerp(-58, -50.5, LMR()), CURB + 7.2 + LMR() * 6.2, lerp(45.8, 47.8, LMR())], a = LMR() * TAU, el = (LMR() - 0.5) * 1.3, L = 3.2 + LMR() * 2.2;
      const d = [Math.cos(a) * Math.cos(el) * L / 2, Math.sin(el) * L / 2, Math.sin(a) * Math.cos(el) * L / 2 * 0.35], A = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], B = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
      H.seg(A, B, 0.075, S, { seg: 6 }); ends.push(A, B); }
    for (let i = 0; i < ends.length; i++) { let best = -1, bd = 1e9; for (let k = 0; k < ends.length; k++) { if (k === i || (k >> 1) === (i >> 1) && i > 2 && k > 2) continue; const e = ends[k], dd = Math.hypot(e[0] - ends[i][0], e[1] - ends[i][1], e[2] - ends[i][2]); if (dd < bd && dd > 0.5) { bd = dd; best = k; } } if (best >= 0) H.seg(ends[i], ends[best], 0.014, K); } }
  lmHook('science', { stub: true, kind: 'imax_theatre', door: { x: -57, z: M.dz - M.dr - 1.8 }, screen: { x: -46.8, y: CURB + 1, z: 58, w: 8, h: 6, facing: 'west' }, hall: { x0: M.bx0, x1: M.bx1, z0: M.bz0, z1: M.bz1 } });
});

// ======================= HARBORPLACE (refs/harborplace: pratt_web_4 aerial, light_1 night, pavilion_2 panorama): the two 1980 market pavilions:
// two storeys of glass behind round cream concrete columns, a cream floor slab / balcony with a dark-green rail, navy awnings, a cream eave slab,
// pale copper-green hip roofs with a glazed roof monitor, cross gables with lit arched glass ends on the water side, rooftop vents; the Pratt Street
// Pavilion's octagonal west end with its own roof + glass skylight; flagpoles (US + Maryland) on the plaza; "Harborplace" fascia signs.
const HPV = [{ id: 'pratt', x0: -58, z0: -29, x1: -46, z1: -22, along: 'x', water: 's', street: 'n', name: 'PRATT STREET PAVILION', oct: { x: -54.6, z: -25.5, r: 3.75 } },
  { id: 'light', x0: -59, z0: -18, x1: -52, z1: 2, along: 'z', water: 'e', street: 'w', name: 'LIGHT STREET PAVILION' }];
lmHD('harborplace', -52, -12, 22, (H, signs, SG) => {
  const Y0 = CURB, E1 = Y0 + 3.3, E2 = Y0 + 6.4, COL = '#ddd5c4', CR2 = '#c8bfa9', GLS = '#2a3a42', FR = '#2f4a3c', ROOF = '#93bfa2', ROOF2 = '#7aa88a', AWN = '#25387a';
  for (const P of HPV) {
    const { x0, z0, x1, z1 } = P, ix0 = x0 + 0.9, ix1 = x1 - 0.9, iz0 = z0 + 0.9, iz1 = z1 - 0.9, f = ppFaces(ix0, iz0, ix1, iz1, H), fo = ppFaces(x0, z0, x1, z1, H);
    const octX1 = P.oct ? P.oct.x + P.oct.r * 0.6 : null; // the octagon replaces the west end of the Pratt pavilion
    const bx0 = P.oct ? octX1 : ix0;
    H.box(bx0, Y0, iz0, ix1, E2, iz1, GLS);
    H.box(P.oct ? octX1 - 0.3 : x0, E1, z0, x1, E1 + 0.35, z1, COL); // floor slab / balcony
    H.box((P.oct ? octX1 - 0.3 : x0) - 0.35, E2, z0 - 0.35, x1 + 0.35, E2 + 0.45, z1 + 0.35, COL); // eave slab
    // glazing: mullions + transoms (dark green), lit shops at night, navy awnings over the ground floor, balcony rail
    for (const k of ['n', 'e', 's', 'w']) { const F = f[k], Fo = fo[k]; if (P.oct && k === 'w') continue;
      const ua = P.oct && (k === 'n' || k === 's') ? (k === 'n' ? 0 : octX1 - ix0) : 0, ub = P.oct && (k === 'n' || k === 's') ? (k === 'n' ? F.L - (octX1 - ix0) : F.L) : F.L;
      for (const [y0, y1] of [[Y0 + 0.05, E1 - 0.05], [E1 + 0.4, E2 - 0.05]]) {
        for (let u = ua; u < ub - 0.3; u += 1.25) { const u1 = Math.min(ub, u + 1.25), lit = LMR() < 0.75;
          H.fbox(F, u + 0.06, u1 - 0.06, y0 + 0.1, y1 - 0.1, 0, 0.03, lit ? '#3a4a50' : GLS, { ol: false, emi: lit ? (LMR() < 0.85 ? '#ffd690' : '#ffb0d0') : null }); H.fbox(F, u - 0.05, u + 0.05, y0, y1, 0, 0.06, FR, { ol: false }); }
        H.fbox(F, ua, ub, y1 - 0.75, y1 - 0.68, 0, 0.06, FR, { ol: false }); }
      for (let u = ua + 0.2; u < ub - 1; u += 2.5) H.fbox(F, u, u + 2.1, Y0 + 2.45, Y0 + 2.62, 0.03, 0.85, AWN, { ol: false });
      const oa = ua + (Fo.L - F.L) / 2, ob = ub + (Fo.L - F.L) / 2;
      for (const ry of [0.55, 1.05]) H.fbox(Fo, oa, ob + (k === 'n' && P.oct ? 0.9 : 0), E1 + 0.35 + ry, E1 + 0.4 + ry, -0.05, 0.0, FR, { ol: false });
      for (let u = oa; u <= ob + 0.01; u += 0.6) H.fbox(Fo, u - 0.02, u + 0.02, E1 + 0.35, E1 + 1.45, -0.05, -0.01, FR, { ol: false });
      // round cream columns (full height) along the outer line
      for (let u = oa + 0.2; u <= ob - 0.1; u += 2.5) { const x = Fo.xa + Fo.ux * u - Fo.nx * 0.35, z = Fo.za + Fo.uz * u - Fo.nz * 0.35; H.cyl(x, Y0, z, 0.22, 0.24, E2 - Y0, 8, COL); } }
    // the hip roof, its glazed roof monitor, and the cross gables with arched lit glass ends on the water side
    const rh = (P.along === 'x' ? z1 - z0 : x1 - x0) * 0.3 + 0.6, ry = E2 + 0.45;
    const rx0 = (P.oct ? octX1 - 0.3 : x0) - 0.35;
    H.hip(rx0, z0 - 0.35, x1 + 0.35, z1 + 0.35, ry, rh, ROOF);
    { const mw = 1.2, cx = (rx0 + x1 + 0.35) / 2, cz = (z0 + z1) / 2, L = P.along === 'x' ? (x1 - rx0) * 0.45 : (z1 - z0) * 0.6, yb = ry + rh * 0.72;
      const [mx0, mz0, mx1, mz1] = P.along === 'x' ? [cx - L / 2, cz - mw, cx + L / 2, cz + mw] : [cx - mw, cz - L / 2, cx + mw, cz + L / 2];
      H.box(mx0, yb, mz0, mx1, ry + rh + 0.55, mz1, '#3a4e56', { emi: '#5a4a2a' }); H.hip(mx0 - 0.2, mz0 - 0.2, mx1 + 0.2, mz1 + 0.2, ry + rh + 0.55, 0.55, ROOF2);
      for (const F of Object.values(ppFaces(mx0, mz0, mx1, mz1, H))) for (let u = 0.5; u < F.L; u += 0.7) H.fbox(F, u - 0.03, u + 0.03, yb, ry + rh + 0.55, 0, 0.04, FR, { ol: false }); }
    const gables = P.along === 'x' ? [-49.6] : [-13.2, -6, 1.2 - 2.2];
    for (const g of gables) { const gw = 1.9, gh = rh * 0.95, yb = ry;
      if (P.along === 'x') { const zw = z1 + 0.5, zi = (z0 + z1) / 2; H.prism('z', zi, zw, [[g - gw, yb], [g + gw, yb], [g, yb + gh]], ROOF2);
        H.box(g - gw + 0.1, yb - 0.45, zw - 0.2, g + gw - 0.1, yb + 0.02, zw, COL, { ol: false });
        const F = H.frame(g - gw, zw, g + gw, zw); H.farch(F, gw, yb, gw - 0.35, 0.0, 0.03, '#3a4a50', { ol: false, emi: '#ffd690' }, 10); for (const du of [-0.6, 0, 0.6]) H.fbox(F, gw + du - 0.03, gw + du + 0.03, yb, yb + Math.sqrt(Math.max(0, (gw - 0.35) ** 2 - du * du)), 0.03, 0.06, FR, { ol: false });
        SG.add(F, gw, yb - 0.44, 3.4, 0.42, 0.03, (gg, w, h) => { gg.fillStyle = '#1f3a30'; gg.fillRect(0, 0, w, h); sText(gg, 'Harborplace', w / 2, h * 0.54, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '600' }); }); }
      else { const xw = x1 + 0.5, xi = (x0 + x1) / 2; H.prism('x', xi, xw, [[g - gw, yb], [g + gw, yb], [g, yb + gh]], ROOF2);
        H.box(xw - 0.2, yb - 0.45, g - gw + 0.1, xw, yb + 0.02, g + gw - 0.1, COL, { ol: false });
        const F = H.frame(xw, g + gw, xw, g - gw); H.farch(F, gw, yb, gw - 0.35, 0.0, 0.03, '#3a4a50', { ol: false, emi: '#ffd690' }, 10); for (const du of [-0.6, 0, 0.6]) H.fbox(F, gw + du - 0.03, gw + du + 0.03, yb, yb + Math.sqrt(Math.max(0, (gw - 0.35) ** 2 - du * du)), 0.03, 0.06, FR, { ol: false });
        SG.add(F, gw, yb - 0.44, 3.4, 0.42, 0.03, (gg, w, h) => { gg.fillStyle = '#1f3a30'; gg.fillRect(0, 0, w, h); sText(gg, 'Harborplace', w / 2, h * 0.54, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '600' }); }); } }
    // rooftop vents (pratt_web_4)
    for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, x = P.along === 'x' ? lerp(rx0 + 1.5, x1 - 1, t) : (x0 + x1) / 2 + (i % 2 ? 1.6 : -1.6), z = P.along === 'x' ? (z0 + z1) / 2 + (i % 2 ? 1.5 : -1.5) : lerp(z0 + 1.5, z1 - 1.5, t);
      H.cyl(x, ry + rh * 0.35, z, 0.22, 0.26, 0.9, 8, '#b8bcb0'); H.cyl(x, ry + rh * 0.35 + 0.9, z, 0.36, 0.3, 0.2, 8, '#8a9088'); }
    // street-side name board
    { const S = fo[P.street]; SG.add(S, S.L / 2 + (P.oct ? 2 : 0), E2 + 0.02, 6.2, 0.42, 0.37, (g, w, h) => { g.fillStyle = '#1f3a30'; g.fillRect(0, 0, w, h); sText(g, 'HARBORPLACE \u00b7 ' + P.name, w / 2, h * 0.55, w * 0.95, h * 0.68, SERIF, '#f2e6c4', { weight: '600', track: 1 }); }); }
    // the octagonal west end: two glazed storeys behind columns, its own eave + octagonal roof + a glass pyramid skylight
    if (P.oct) { const { x, z, r } = P.oct, rot = Math.PI / 8;
      H.cyl(x, Y0, z, r - 0.8, r - 0.8, E2 - Y0, 8, GLS, { ry: rot });
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU + rot, a1 = (i + 1) / 8 * TAU + rot, rr = (r - 0.8) / Math.cos(Math.PI / 8) * 1.0;
        const ax = x + Math.sin(a0) * rr, az = z + Math.cos(a0) * rr, bx = x + Math.sin(a1) * rr, bz = z + Math.cos(a1) * rr; const F = H.frame(bx, bz, ax, az);
        for (const [y0, y1] of [[Y0 + 0.05, E1 - 0.05], [E1 + 0.4, E2 - 0.05]]) { H.fbox(F, 0.1, F.L - 0.1, y0 + 0.1, y1 - 0.1, 0, 0.03, '#3a4a50', { ol: false, emi: LMR() < 0.8 ? '#ffd690' : null }); H.fbox(F, F.L / 2 - 0.04, F.L / 2 + 0.04, y0, y1, 0, 0.06, FR, { ol: false }); }
        H.fbox(F, 0.1, F.L - 0.1, Y0 + 2.45, Y0 + 2.62, 0.03, 0.85, AWN, { ol: false });
        const cxp = x + Math.sin(a0) * (r - 0.3) / Math.cos(Math.PI / 8) * 0.96, czp = z + Math.cos(a0) * (r - 0.3) / Math.cos(Math.PI / 8) * 0.96; H.cyl(cxp, Y0, czp, 0.22, 0.24, E2 - Y0, 8, COL); }
      H.cyl(x, E1, z, r, r, 0.35, 8, COL, { ry: rot }); H.cyl(x, E2, z, r + 0.4, r + 0.4, 0.45, 8, COL, { ry: rot });
      H.cyl(x, E2 + 0.45, z, 1.1, r + 0.4, 2.2, 8, ROOF, { ry: rot }); H.cyl(x, E2 + 2.65, z, 0.02, 1.15, 1.1, 8, '#a8d4e0', { ry: rot, emi: '#6a5a30' });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + rot, rr = 1.15 / Math.cos(Math.PI / 8); H.seg([x + Math.sin(a) * rr, E2 + 2.65, z + Math.cos(a) * rr], [x, E2 + 3.75, z], 0.035, '#e8ecee'); } }
  }
  // flagpoles on the plaza east of the Pratt pavilion: the US flag + the Maryland flag (drawn as stripes / quarters in the mesh, not textures)
  const flag = (x, z, kind) => { const top = CURB + 11; H.cyl(x, CURB, z, 0.06, 0.1, top - CURB, 6, '#e0e0dc', { ol: false }); H.cyl(x, top, z, 0.13, 0.13, 0.22, 6, '#c8a040', { ol: false }); lmColl({ x, z, r: 0.3 });
    const W = 2.4, Hh = 1.4, y1 = top - 0.2, y0 = y1 - Hh, zz = z + 0.02;
    if (kind === 'us') { for (let i = 0; i < 13; i++) H.box(x + 0.08, y1 - (i + 1) * Hh / 13, zz - 0.01, x + 0.08 + W, y1 - i * Hh / 13, zz + 0.01, i % 2 ? '#f4f2ec' : '#b8283a', { ol: false });
      H.box(x + 0.08, y1 - Hh * 7 / 13, zz - 0.015, x + 0.08 + W * 0.4, y1, zz + 0.015, '#243a7a', { ol: false });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const sx = x + 0.2 + c * W * 0.07, sy = y1 - 0.12 - r * Hh * 0.13; H.box(sx, sy - 0.03, zz - 0.02, sx + 0.05, sy + 0.03, zz + 0.02, '#ffffff', { ol: false }); } }
    else { const q = (qx, qy, cal) => { const ax = x + 0.08 + qx * W / 2, ay = y0 + qy * Hh / 2;
        if (cal) for (let i = 0; i < 6; i++) H.box(ax + i * W / 12, ay, zz - 0.01, ax + (i + 1) * W / 12, ay + Hh / 2, zz + 0.01, (i + (qx + qy) % 2) % 2 ? '#1c1c1c' : '#e8b020', { ol: false });
        else { H.box(ax, ay, zz - 0.01, ax + W / 2, ay + Hh / 2, zz + 0.01, '#f4f2ec', { ol: false }); H.box(ax + W / 4 - 0.07, ay + 0.06, zz - 0.015, ax + W / 4 + 0.07, ay + Hh / 2 - 0.06, zz + 0.015, '#c0283a', { ol: false }); H.box(ax + 0.08, ay + Hh / 4 - 0.07, zz - 0.015, ax + W / 2 - 0.08, ay + Hh / 4 + 0.07, zz + 0.015, '#c0283a', { ol: false }); } };
      q(0, 1, true); q(1, 0, true); q(1, 1, false); q(0, 0, false); } };
  flag(-58.2, -20.6, 'us'); flag(-55.4, -20.6, 'md'); // on the corner plaza between the two pavilions (pratt_web_4)
});

// ======================= USS CONSTELLATION (refs/uss-constellation: ship_1, con_2): the 1854 sloop-of-war moored bow-north beside her pier (Pier 1).
// Lofted hull: mint-green copper bottom, black topsides, the white gunport band with black ports, black bulwarks; gold scrollwork at the bow + a gold
// figurehead, the white stern with windows + CONSTELLATION in gold; three masts (pale lower masts, wooden topmasts, fighting tops, crosstrees),
// black yards, the mizzen gaff + spanker boom, bowsprit + jib-boom; shrouds with ratlines (canvas net quads), stays + backstays; the white deck awning;
// the stern ensign, masthead pennants and the jack; wooden pile dolphins with mooring lines; a gangway to the pier.
lmHD('constellation', -31, -18, 20, (H, signs, SG) => {
  const cx = -31, zs = -9.4, zb = -29.4, B = 2.6, KEEL = WY - 1.2, DECK = CURB + 1.6, RAIL = CURB + 1.98;
  const lenP = (t) => t < 0.1 ? 0.74 + 0.26 * Math.sin(t / 0.1 * Math.PI / 2) : t < 0.58 ? 1 : Math.pow(Math.max(0, Math.cos(Math.min(1, (t - 0.58) / 0.42) * Math.PI / 2)), 0.75);
  const secP = (yn) => (0.2 + 0.8 * Math.pow(Math.sin(Math.min(1, yn / 0.62) * Math.PI / 2), 0.55)) * (yn > 0.85 ? 1 - (yn - 0.85) * 0.25 : 1);
  const hw = (z, y) => { const t = (z - zs) / (zb - zs), yn = (y - KEEL) / (RAIL - KEEL); return B * lenP(Math.min(1, t / (0.9 + 0.1 * yn))) * secP(yn); };
  const NS = 30, Zs = []; for (let i = 0; i <= NS; i++) Zs.push(lerp(zs, zb, Math.pow(i / NS, 0.92)));
  const band = (ya, yb, col, o = {}) => { const P = [], ys = [ya, (ya + yb) / 2, yb];
    for (const sg of [1, -1]) for (let i = 0; i < NS; i++) for (let j = 0; j < 2; j++) {
      const za = Zs[i], zc = Zs[i + 1], y0 = ys[j], y1 = ys[j + 1], ins = o.inner ? -0.12 : 0;
      const a = [cx + sg * (hw(za, y0) + ins), y0, za], b = [cx + sg * (hw(zc, y0) + ins), y0, zc], c = [cx + sg * (hw(zc, y1) + ins), y1, zc], d = [cx + sg * (hw(za, y1) + ins), y1, za];
      if ((sg > 0) !== !!o.inner) P.push(...a, ...b, ...c, ...a, ...c, ...d); else P.push(...a, ...c, ...b, ...a, ...d, ...c); }
    H.tris(P, col, o); };
  const yC = WY + 0.55, yW0 = CURB + 0.42, yW1 = CURB + 0.95;
  band(KEEL, yC, '#5ec4a4'); band(yC, yW0, '#1b1a1d'); band(yW0, yW1, '#ece6d4'); band(yW1, RAIL, '#1b1a1d');
  band(DECK, RAIL, '#2a2628', { inner: true, ol: false });
  { const P = []; for (let i = 0; i < NS; i++) { const za = Zs[i], zc = Zs[i + 1], wa = hw(za, DECK) - 0.1, wc = hw(zc, DECK) - 0.1; P.push(cx - wa, DECK, za, cx + wa, DECK, za, cx + wc, DECK, zc, cx - wa, DECK, za, cx + wc, DECK, zc, cx - wc, DECK, zc); } H.tris(P, '#8a6c4a', { ol: false }); }
  for (let k = -4; k <= 4; k++) H.box(cx + k * 0.5 - 0.012, DECK + 0.005, zb + 1.2, cx + k * 0.5 + 0.012, DECK + 0.012, zs - 0.3, '#6a5034', { ol: false });
  { const P = [], ys = [KEEL + 0.4, yC, yW0, yW1, RAIL], cols = ['#5ec4a4', '#1b1a1d', '#ece6d4', '#f2eee2']; // the transom (stern face), white above the gunport band (light_1)
    for (let j = 0; j < 4; j++) { const a = hw(zs, ys[j]), b = hw(zs, ys[j + 1]); H.tris([cx - a, ys[j], zs, cx + a, ys[j], zs, cx + b, ys[j + 1], zs, cx - a, ys[j], zs, cx + b, ys[j + 1], zs, cx - b, ys[j + 1], zs], cols[j]); } void P; }
  H.box(cx - 2.1, RAIL - 0.02, zs - 0.06, cx + 2.1, RAIL + 0.55, zs + 0.06, '#f2eee2'); H.box(cx - 2.15, RAIL + 0.55, zs - 0.1, cx + 2.15, RAIL + 0.68, zs + 0.1, '#1b1a1d');
  for (let i = 0; i < 5; i++) H.box(cx - 1.6 + i * 0.8 - 0.18, yW1 + 0.2, zs + 0.02, cx - 1.6 + i * 0.8 + 0.18, yW1 + 0.6, zs + 0.07, '#20262c', { ol: false, emi: '#ffd690' });
  SG.at(cx, yW0 + 0.06, zs + 0.09, 0, 3.6, 0.42, (g, w, h) => sText(g, 'CONSTELLATION', w / 2, h * 0.55, w * 0.96, h * 0.8, SERIF, '#d8b04a', { weight: '700', stroke: '#3a2a0a', sw: h * 0.05, track: 2 }));
  // gunports: black squares in the white band along both sides (gun deck), + small ports in the black bulwark
  for (let z = -26.2; z < -11; z += 1.25) for (const sg of [1, -1]) { const y = (yW0 + yW1) / 2, w = hw(z, y);
    H.box(cx + sg * (w - 0.06), y - 0.2, z - 0.22, cx + sg * (w + 0.04), y + 0.2, z + 0.22, '#121214', { ol: false });
    if (Math.round(z * 4) % 2 === 0) { const y2 = RAIL - 0.36, w2 = hw(z, y2); H.box(cx + sg * (w2 - 0.05), y2 - 0.1, z - 0.13, cx + sg * (w2 + 0.04), y2 + 0.1, z + 0.13, '#e8e2d0', { ol: false }); } }
  // bow: gold scrollwork trail boards + figurehead, cutwater
  for (const sg of [1, -1]) { let prev = null; for (let i = 0; i <= 10; i++) { const z = lerp(zb + 3.2, zb + 0.15, i / 10), y = lerp(yW1 + 0.15, CURB + 1.35, i / 10), p = [cx + sg * (hw(z, y) + 0.04), y, z]; if (prev) H.seg(prev, p, 0.07, '#d4a840'); prev = p; }
    for (let i = 0; i < 4; i++) { const z = zb + 0.9 + i * 0.55, y = yW0 + 0.15 + i * 0.05; H.seg([cx + sg * (hw(z, y) + 0.04), y, z], [cx + sg * (hw(z + 0.4, y + 0.3) + 0.04), y + 0.3, z + 0.4], 0.05, '#d4a840'); } }
  H.seg([cx, KEEL + 0.6, zb + 1.2], [cx, CURB + 1.5, zb - 0.6], 0.12, '#1b1a1d', { ol: true }); H.seg([cx, CURB + 1.2, zb - 0.4], [cx, CURB + 1.75, zb - 1.0], 0.2, '#d4a840', { r1: 0.12, seg: 6 });
  // deck: the white awning amidships (ship_1), hatch, wheel, capstan
  H.prism('z', -24.2, -13.2, [[cx - 1.95, RAIL + 0.1], [cx + 1.95, RAIL + 0.1], [cx + 1.95, RAIL + 0.35], [cx, RAIL + 0.95], [cx - 1.95, RAIL + 0.35]], '#ecebe6');
  H.cyl(cx, DECK, -10.9, 0.3, 0.34, 0.7, 10, '#6a4a2a'); H.cyl(cx, DECK, -20.5, 0.35, 0.42, 0.6, 10, '#5a3a22');
  // masts: fore / main / mizzen (main tallest), lower masts pale, topmasts wood, fighting tops, crosstrees, black yards
  const MASTS = [[-23.4, 20.5], [-17.6, 23.5], [-12.4, 17.5]], tops = [];
  for (const [mz, mh] of MASTS) { const y = (k) => DECK + mh * k;
    H.cyl(cx, DECK, mz, 0.21, 0.27, mh * 0.43, 8, '#e2dccb'); H.cyl(cx, y(0.38), mz, 0.15, 0.17, mh * 0.36, 8, '#7a5634'); H.cyl(cx, y(0.7), mz, 0.07, 0.11, mh * 0.3, 6, '#7a5634');
    H.box(cx - 1.0, y(0.42), mz - 0.75, cx + 1.0, y(0.42) + 0.14, mz + 0.6, '#2a2220'); H.box(cx - 0.32, y(0.4), mz - 0.3, cx + 0.32, y(0.47), mz + 0.3, '#2a2220', { ol: false });
    H.box(cx - 0.6, y(0.72), mz - 0.1, cx + 0.6, y(0.72) + 0.08, mz + 0.1, '#2a2220', { ol: false }); H.box(cx - 0.08, y(0.72), mz - 0.35, cx + 0.08, y(0.72) + 0.08, mz + 0.35, '#2a2220', { ol: false });
    H.cyl(cx, DECK + mh, mz, 0.11, 0.08, 0.18, 8, '#2a2220', { ol: false });
    for (const [k, L, r] of [[0.33, 0.42, 0.13], [0.56, 0.33, 0.1], [0.79, 0.23, 0.075], [0.93, 0.15, 0.055]]) { const yy = y(k), hl = mh * L / 2;
      H.seg([cx - hl, yy, mz - 0.25], [cx, yy, mz - 0.25], r, '#191818', { r1: r * 0.55, seg: 6, ol: k < 0.5 }); H.seg([cx, yy, mz - 0.25], [cx + hl, yy, mz - 0.25], r * 0.55, '#191818', { r1: r, seg: 6, ol: k < 0.5 });
      H.seg([cx - hl * 0.92, yy - 0.12, mz - 0.18], [cx + hl * 0.92, yy - 0.12, mz - 0.18], r * 0.85, '#d6ccb2', { seg: 5 }); } // furled sail on the yard
    tops.push({ mz, mh, top: y(0.42), tm: y(0.72), head: DECK + mh }); }
  { const m = tops[2]; H.seg([cx, m.top - 1.2, m.mz + 0.3], [cx, m.top + 0.6, m.mz + 4.4], 0.1, '#191818'); H.seg([cx, DECK + 1.6, m.mz + 0.3], [cx, DECK + 1.75, zs + 2.4], 0.12, '#191818'); } // gaff + spanker boom
  // bowsprit + jib-boom (over the promenade, well above head height) + the dolphin striker
  const bsE = [cx, CURB + 4.0, zb - 4.0], jbE = [cx, CURB + 5.0, zb - 6.2];
  H.seg([cx, DECK + 0.2, zb + 2.2], bsE, 0.14, '#2a2220', { r1: 0.24, seg: 8, ol: true }); H.seg(bsE, jbE, 0.07, '#7a5634', { r1: 0.12, seg: 6 });
  H.seg([cx, CURB + 3.6, zb - 3.2], [cx, CURB + 2.2, zb - 3.0], 0.05, '#2a2220');
  // rigging: shrouds with ratlines (one canvas net, free quads), topmast shrouds, stays, backstays
  const net = (g, w, h) => { g.strokeStyle = '#141212'; g.lineWidth = Math.max(1.5, w * 0.03); const n = Math.max(4, Math.round(w / 9)); for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(w * (0.04 + 0.92 * i / n), h); g.lineTo(w * (0.04 + 0.92 * i / n), 0); g.stroke(); }
    g.lineWidth = Math.max(1, w * 0.015); for (let y = h - 5; y > 2; y -= Math.max(5, h / 46)) { g.beginPath(); g.moveTo(w * 0.04, y); g.lineTo(w * 0.96, y); g.stroke(); } };
  for (const m of tops) for (const sg of [1, -1]) {
    const wb = hw(m.mz, RAIL) + 0.32, A = [cx + sg * wb, RAIL - 0.3, m.mz - 1.5], Bq = [cx + sg * wb, RAIL - 0.3, m.mz + 1.4], C = [cx + sg * 0.85, m.top, m.mz + 0.4], D = [cx + sg * 0.85, m.top, m.mz - 0.55];
    SG.quad(A, Bq, C, D, 2.9, m.top - RAIL, net); H.box(cx + sg * (wb - 0.25), RAIL - 0.45, m.mz - 1.7, cx + sg * (wb + 0.05), RAIL - 0.3, m.mz + 1.6, '#1b1a1d', { ol: false }); // channel
    SG.quad([cx + sg * 0.95, m.top + 0.14, m.mz - 0.5], [cx + sg * 0.95, m.top + 0.14, m.mz + 0.45], [cx + sg * 0.25, m.tm, m.mz + 0.12], [cx + sg * 0.25, m.tm, m.mz - 0.12], 1.0, m.tm - m.top, net);
    H.seg([cx + sg * 0.5, m.tm + 0.08, m.mz], [cx + sg * 0.12, m.head - 0.4, m.mz], 0.025, '#141212');
    H.seg([cx + sg * 0.15, m.tm, m.mz], [cx + sg * (hw(m.mz + 3.5, RAIL) + 0.2), RAIL - 0.3, m.mz + 3.5], 0.03, '#141212'); H.seg([cx + sg * 0.1, m.head - 0.5, m.mz], [cx + sg * (hw(m.mz + 5, RAIL) + 0.2), RAIL - 0.3, m.mz + 5], 0.025, '#141212'); }
  const [fo, ma, mi] = tops, L = '#141212';
  H.seg([cx, fo.top, fo.mz], [cx, DECK + 0.4, zb + 1.2], 0.05, L); H.seg([cx, fo.tm, fo.mz], bsE, 0.04, L); H.seg([cx, fo.head - 0.5, fo.mz], jbE, 0.03, L); H.seg([cx, fo.tm - 1, fo.mz], jbE, 0.025, L);
  H.seg([cx, ma.top, ma.mz], [cx, DECK + 1.2, fo.mz + 0.6], 0.05, L); H.seg([cx, ma.tm, ma.mz], [cx, fo.top + 0.2, fo.mz], 0.04, L); H.seg([cx, ma.head - 0.5, ma.mz], [cx, fo.tm, fo.mz], 0.03, L);
  H.seg([cx, mi.top, mi.mz], [cx, DECK + 1.2, ma.mz + 0.6], 0.04, L); H.seg([cx, mi.tm, mi.mz], [cx, ma.top + 0.2, ma.mz], 0.035, L); H.seg([cx, mi.head - 0.4, mi.mz], [cx, ma.tm, ma.mz], 0.03, L);
  for (const sg of [1, -1]) H.seg(bsE, [cx + sg * 1.6, CURB + 1.4, zb + 0.6], 0.03, L); H.seg(jbE, [cx, CURB + 2.2, zb - 3.0], 0.025, L);
  // flags: the stern ensign on its staff, masthead pennants (green, Historic Ships), the jack at the bowsprit
  { const sx = cx, sz = zs - 0.15, top = RAIL + 3.0; H.seg([sx, RAIL, sz], [sx, top, sz + 0.25], 0.05, '#2a2220'); const W = 2.2, Hh = 1.25, z0 = sz + 0.3, y1 = top - 0.05;
    for (let i = 0; i < 13; i++) H.box(sx - 0.01, y1 - (i + 1) * Hh / 13, z0, sx + 0.01, y1 - i * Hh / 13, z0 + W, i % 2 ? '#f4f2ec' : '#b8283a', { ol: false });
    H.box(sx - 0.015, y1 - Hh * 7 / 13, z0, sx + 0.015, y1, z0 + W * 0.4, '#243a7a', { ol: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) H.box(sx - 0.02, y1 - 0.12 - r * Hh * 0.13 - 0.03, z0 + 0.1 + c * W * 0.07, sx + 0.02, y1 - 0.12 - r * Hh * 0.13 + 0.03, z0 + 0.15 + c * W * 0.07, '#ffffff', { ol: false }); }
  for (const m of [fo, ma, mi]) { const y = m.head - 0.3; H.prism('x', cx - 0.015, cx + 0.015, [[m.mz + 0.1, y], [m.mz + 0.1, y - 0.75], [m.mz + 1.5, y - 0.45]], '#2a7a4a', { ol: false }); }
  H.seg([cx, CURB + 3.1, zb - 2.4], [cx, CURB + 4.6, zb - 2.4], 0.03, '#2a2220'); H.box(cx - 0.015, CURB + 3.85, zb - 2.4, cx + 0.015, CURB + 4.55, zb - 1.3, '#243a7a', { ol: false });
  for (let i = 0; i < 6; i++) H.box(cx - 0.02, CURB + 4.0 + (i % 2) * 0.3, zb - 2.2 + Math.floor(i / 2) * 0.35, cx + 0.02, CURB + 4.06 + (i % 2) * 0.3, zb - 2.14 + Math.floor(i / 2) * 0.35, '#ffffff', { ol: false });
  // wooden pile dolphins in the water (con_2 / ship_1) with mooring lines to the hull, and the gangway to the pier
  for (const [x, z, toZ] of [[-26.4, -25.5, -24.5], [-26.4, -13.5, -14], [-31, -6.6, -9.6], [-26.8, -19.4, -19]]) {
    H.cyl(x, WY - 0.6, z, 0.32, 0.78, 2.9, 10, '#8a7a5c'); H.cyl(x, WY + 2.3, z, 0.2, 0.34, 0.25, 10, '#6a5a44'); for (const k of [0.3, 0.7]) H.cyl(x, WY - 0.6 + 2.9 * k, z, 0.74 - 0.42 * k + 0.02, 0.74 - 0.42 * k + 0.02, 0.1, 10, '#3a3430', { ol: false });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; H.seg([x + Math.sin(a) * 0.78, WY - 0.55, z + Math.cos(a) * 0.78], [x + Math.sin(a) * 0.33, WY + 2.28, z + Math.cos(a) * 0.33], 0.02, '#5a4a38'); }
    const sg = x > cx ? 1 : 0; H.seg([x, WY + 2.0, z], sg ? [cx + hw(toZ, CURB + 1.2) + 0.05, CURB + 1.2, toZ] : [cx, yW1, zs + 0.05], 0.035, '#d8ccb0', { seg: 4 }); }
  { const za = -18.6, zb2 = -17.2, xa = -35, xb = cx - hw(-18, DECK) + 0.05, ya = CURB + 0.05, yb = DECK + 0.1, g = new THREE.BoxGeometry(Math.hypot(xb - xa, yb - ya), 0.1, zb2 - za);
    g.rotateZ(Math.atan2(yb - ya, xb - xa)); g.translate((xa + xb) / 2, (ya + yb) / 2, (za + zb2) / 2); H.geo(g, '#6a5034');
    for (const z of [za, zb2]) { H.seg([xa, ya + 1.0, z], [xb, yb + 1.0, z], 0.035, '#d8ccb0'); for (let t = 0; t <= 1.001; t += 0.5) H.seg([lerp(xa, xb, t), lerp(ya, yb, t), z], [lerp(xa, xb, t), lerp(ya, yb, t) + 1.0, z], 0.03, '#2a2220'); } }
});

// ======================= DOWNTOWN-WEST DISTRICT + SOUTH SHORE + HOOTERS (feature `lexington`, Brad 2026-10-12; DESIGN.md "New landmark", "Fit tweaks",
// "Lexington Market model reference", "Storefront: Hooters at Harborplace") ===========================================================================
// 1) LEXINGTON MARKET (HD, refs/lexington lex_1-5, reference only): the 2022 market hall seen from the street. One long wide gable with lower shed wings,
//    pale-gray standing-seam metal, white "LEXINGTON" / "M A R K E T" across the gable, "WORLD FAMOUS" left wing, "SINCE 1782" right wing, a tall black-framed
//    window wall with the round red globe seal, red-brick piers between big black storefront windows, the flat black entry canopy reading
//    "WORLD FAMOUS · LEXINGTON MARKET", planters + young trees. Night: warm uplight on the metal (emi bands + additive washes), glowing windows.
//    Placed on the north-west edge a block past Oriole Park (RES x -100..-76, z -70..-46), facing south onto Pratt St.
//    window.LEX_ANCHOR: the entrance under the canopy (Pit Beef Pete's eating contest hooks in here; another branch builds it).
// 2) WESTMINSTER BURYING GROUND (blockout-plus set dressing): the walled graveyard + the brick Gothic church with its tower, west of the market across
//    the street (RES x -134..-110). window.POE_ANCHOR: Poe's memorial inside the corner gate (the Poe stealth night, later).
// 3) RASH FIELD: a green field with two lacrosse goals on a waterfront plaza on the south shore between the Science Center and Federal Hill (PIERS 'rash').
//    window.RASH_ANCHOR: centre spot + goals + field box (Riptide Rodney's lacrosse, later).
// 4) HOOTERS on the OCTAGON at the south (harbour) end of Harborplace's Light Street Pavilion (refs/hooters, reference only): glass curtain wall,
//    deep dark-bronze canopy with a warm wood-slat soffit + LED strips, "SUITE 1445" over the doors, wood-panel side wall, sidewalk menu board with the owl,
//    bistro table; big orange HOOTERS channel letters (white halo, silver returns, ®) on BOTH the Light St face and the harbour face, lit at night.
//    All lettering + the owl are drawn procedurally on canvas (no logo files).
// Landmarks: 'lexington' (boss stub Pit Beef Pete at LEX_ANCHOR) and 'rashfield' (boss stub Riptide Rodney) join LANDMARKS so each new boss clears a district;
// Westminster + Hooters get name popups of their own (09l_lexington.js) without becoming crime districts.
const LEXW = { night: [] }; // additive night-glow meshes (opacity driven by NIGHT in 09l_lexington.js)
const lexGlowTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,214,150,0.95)'); gr.addColorStop(0.35, 'rgba(255,190,120,0.45)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128); const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 128); return lowTex(c, 64); })();
const lexHaloTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 32, 4, 64, 32, 62); gr.addColorStop(0, 'rgba(255,150,80,0.9)'); gr.addColorStop(0.45, 'rgba(255,110,50,0.45)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 16); g.fillStyle = gr; g.fillRect(0, -32, 128, 128); return lowTex(c, 64); })();
// a night-glow mesh from quads [{ x, y, z, ry, w, h, tex }] (all quads in one mesh share one texture)
function lexGlow(quads, tex, parent) {
  const P = [], U = [];
  for (const q of quads) { const cs = Math.cos(q.ry), sn = Math.sin(q.ry), hw = q.w / 2, pt = (a, b) => [q.x + a * cs, q.y + b, q.z - a * sn];
    const A = pt(-hw, 0), B = pt(hw, 0), C = pt(hw, q.h), D = pt(-hw, q.h); P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 }));
  m.renderOrder = 3; m.visible = false; parent.add(m); LEXW.night.push(m); return m;
}
// far LOD for landmarks that have no Phase-1 massing capture: a plain (hull-less) HB mesh
function lexFar(L, build) { const hb = new HB(); build(hb); const g = hb.build(); g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); L.far.add(g); }
// simple young street tree (trunk + two low-poly crowns), into an HB
function lexTree(H, x, z, y0, s = 1) { H.cyl(x, y0, z, 0.07 * s, 0.1 * s, 2.2 * s, 5, '#5a4232', { ol: false });
  const c = new THREE.IcosahedronGeometry(0.95 * s, 0); c.translate(x, y0 + 2.7 * s, z); H.geo(c, '#5f8f3c'); const c2 = new THREE.IcosahedronGeometry(0.6 * s, 0); c2.translate(x + 0.35 * s, y0 + 3.3 * s, z - 0.2 * s); H.geo(c2, '#6f9f44', { ol: false }); }

// ======================= 1) LEXINGTON MARKET =======================
const LXM = { x0: -98.5, x1: -77.5, z0: -68, z1: -50, gx0: -93.5, gx1: -82.5, eave: CURB + 11, ridge: CURB + 14.6, weave: CURB + 9.0, wpeak: CURB + 10.2, base: CURB + 7.2 };
LXM.cx = (LXM.gx0 + LXM.gx1) / 2; // gable centre x (-88)
const LEX_DOOR = { x: -90.6, z: LXM.z1 }; // the main doors under the canopy (left of the window wall, like lex_1)
window.LEX_ANCHOR = { id: 'lexington', name: 'LEXINGTON MARKET', x: LEX_DOOR.x, z: LXM.z1 + 2.4, y: CURB, yaw: Math.PI, // stand here facing the doors (north)
  door: { x: LEX_DOOR.x, z: LXM.z1 }, canopy: { x0: LEX_DOOR.x - 3.6, x1: LEX_DOOR.x + 3.6, z0: LXM.z1, z1: LXM.z1 + 3.4 },
  hall: { x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1, floorY: CURB }, inside: { x: LXM.cx, z: (LXM.z0 + LXM.z1) / 2 },
  stalls: ['pit beef', 'lake trout', 'coddies', 'crab cakes', 'fudge-topped cookies'], note: 'hall is a closed shell (no interior yet): a set piece enters from the door' };
lmColl({ x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1 }); BLD.push({ x0: LXM.x0, x1: LXM.x1, z0: LXM.z0, z1: LXM.z1, h: LXM.eave });
for (const x of [LEX_DOOR.x - 3.4, LEX_DOOR.x + 3.4]) lmColl({ x, z: LXM.z1 + 3.2, r: 0.28 }); // canopy posts
LEXW.lexL = lmHD('lexington', -88, -58, 15, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, gx0, gx1, eave, ridge, weave, wpeak, base } = LXM, cx = LXM.cx;
  const MET = '#a9afb3', MET2 = '#959ca1', SEAM = '#c4c9cc', BR = '#8a4632', BR2 = '#74392a', BLK = '#1d1f22', GL = '#3b4e5c', CON = '#bdb6aa';
  const winE = () => (LMR() < 0.8 ? '#ffd28a' : '#ffe6b8');
  // ---- masses: brick base under everything, the main gable hall, the two shed wings
  H.box(x0, Y0, z0, x1, base, z1 - 0.05, BR);
  H.box(gx0, base, z0, gx1, eave, z1, MET);
  H.prism('z', z0 - 0.4, z1 + 0.35, [[gx0 - 0.45, eave - 0.25], [gx1 + 0.45, eave - 0.25], [cx, ridge]], '#8f969b'); // the gable roof (standing seam)
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { H.box(a, base, z0, b, weave, z1 - 0.05, MET2);
    const out = a === x0 ? a - 0.35 : b + 0.35, inn = a === x0 ? b : a; H.prism('z', z0 - 0.3, z1 + 0.3, [[out, weave], [inn, weave], [inn, wpeak]], '#8f969b'); }
  // roof seams (gable slopes + wings), ridge cap
  for (let i = 1; i < 14; i++) { const t = i / 14; for (const s of [-1, 1]) { const xa = cx + s * (gx1 - cx + 0.45) * (1 - t), ya = eave - 0.25 + (ridge - eave + 0.25) * t;
      H.seg([xa, ya + 0.04, z1 + 0.35], [xa, ya + 0.04, z0 - 0.4], 0.035, SEAM); } }
  H.box(cx - 0.18, ridge - 0.05, z0 - 0.4, cx + 0.18, ridge + 0.12, z1 + 0.35, '#7c8388');
  // ---- the south (street) facade
  const F = H.frame(x0, z1, x1, z1), u = (x) => x - x0; // u along the facade = x - x0
  // the gable front: metal panel (eave-high rectangle + triangle) proud of the wall, uplit in horizontal bands (warmest at the bottom)
  const bands = [[base, base + 1.3, '#6c5838'], [base + 1.3, base + 2.6, '#57472e'], [base + 2.6, eave, '#3e3322']];
  for (const [ya, yb, e] of bands) H.fbox(F, u(gx0) - 0.05, u(gx1) + 0.05, ya, yb, 0, 0.12, MET, { emi: e });
  H.tris([gx0 - 0.05, eave, z1 + 0.13, gx1 + 0.05, eave, z1 + 0.13, cx, ridge - 0.12, z1 + 0.13], MET, { emi: '#2a2318' });
  for (let x = gx0 + 0.45; x < gx1 - 0.2; x += 0.55) { const top = eave + (ridge - 0.15 - eave) * (1 - Math.abs(x - cx) / (cx - gx0 + 0.05)); H.fbox(F, u(x) - 0.03, u(x) + 0.03, base + 0.05, top, 0.12, 0.19, SEAM, { ol: false, emi: '#3a3022' }); }
  H.fbox(F, u(gx0) - 0.5, u(gx1) + 0.5, eave - 0.32, eave - 0.18, 0, 0.42, '#d8dcdf', { emi: '#5a4a32' }); // white eave line under the rake
  for (const s of [-1, 1]) { const a = [cx, ridge + 0.05, z1 + 0.36], b = [s < 0 ? gx0 - 0.5 : gx1 + 0.5, eave - 0.3, z1 + 0.36]; H.seg(a, b, 0.09, '#d8dcdf', { emi: '#4a3e2a' }); } // rake trim
  // the tall central window wall (black frames), from the doors' head up to the lettering band
  const wwx0 = gx0 + 1.0, wwx1 = gx1 - 1.2, wwy0 = Y0 + 0.1, wwy1 = base - 0.25;
  H.fbox(F, u(wwx0) - 0.25, u(wwx1) + 0.25, wwy0, wwy1 + 0.25, 0, 0.1, BLK);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const xa = lerp(wwx0, wwx1, c / 6) + 0.08, xb = lerp(wwx0, wwx1, (c + 1) / 6) - 0.08, ya = lerp(wwy0, wwy1, r / 4) + 0.1, yb = lerp(wwy0, wwy1, (r + 1) / 4) - 0.08;
    if (r === 0 && xb < LEX_DOOR.x + 1.6 && xa > LEX_DOOR.x - 1.6) continue; // the doors go here
    H.fbox(F, u(xa), u(xb), ya, yb, 0.1, 0.13, GL, { ol: false, emi: LMR() < 0.85 ? winE() : null }); }
  // doors (glass, bronze frames) + the dark recess behind them
  for (const [a, b] of [[-1.5, -0.05], [0.05, 1.5]]) { H.fbox(F, u(LEX_DOOR.x + a), u(LEX_DOOR.x + b), Y0 + 0.05, Y0 + 2.6, 0.08, 0.14, '#2c3a40', { ol: false, emi: '#ffcf8a' }); H.fbox(F, u(LEX_DOOR.x + (a + b) / 2) - 0.03, u(LEX_DOOR.x + (a + b) / 2) + 0.03, Y0 + 1.1, Y0 + 1.5, 0.14, 0.2, '#b08a50', { ol: false }); }
  // wings: brick piers between big black-framed storefront windows (two tiers), the metal band above
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { const n = 2, w = (b - a) / n;
    for (let i = 0; i < n; i++) { const xa = a + i * w + 0.45, xb = a + (i + 1) * w - 0.45;
      for (const [ya, yb] of [[Y0 + 0.15, Y0 + 3.1], [Y0 + 3.6, base - 0.4]]) { H.fbox(F, u(xa) - 0.12, u(xb) + 0.12, ya - 0.12, yb + 0.12, 0, 0.06, BLK, { ol: false });
        H.fbox(F, u(xa), u(xb), ya, yb, 0.06, 0.09, GL, { ol: false, emi: LMR() < 0.8 ? winE() : null }); H.fbox(F, u((xa + xb) / 2) - 0.04, u((xa + xb) / 2) + 0.04, ya, yb, 0.09, 0.12, BLK, { ol: false }); } }
    H.pilasters(F, u(a), u(b), Y0, base, w, 0.5, 0.22, BR2); }
  H.pilasters(F, u(gx0), u(gx1), Y0, base, (gx1 - gx0), 0.7, 0.26, BR2); // the brick piers framing the window wall
  H.fbox(F, 0, F.L, base - 0.12, base + 0.12, 0, 0.18, '#5e5a55'); // coping between brick + metal
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) { H.fbox(F, u(a), u(b), base + 0.12, weave, 0, 0.08, MET2, { emi: '#4a3d2a' });
    for (let x = a + 0.4; x < b - 0.2; x += 0.55) H.fbox(F, u(x) - 0.03, u(x) + 0.03, base + 0.12, weave - 0.05, 0.08, 0.14, SEAM, { ol: false, emi: '#2a2318' }); }
  // ---- the flat black entry canopy over the doors (posts, fascia, warm downlights)
  const cz1 = z1 + 3.4, cy = Y0 + 3.3;
  H.box(LEX_DOOR.x - 3.7, cy, z1, LEX_DOOR.x + 3.7, cy + 0.42, cz1, BLK);
  H.box(LEX_DOOR.x - 3.5, cy - 0.04, z1 + 0.2, LEX_DOOR.x + 3.5, cy, cz1 - 0.2, '#3a3026', { ol: false, emi: '#ffcf8a' });
  for (const x of [LEX_DOOR.x - 3.4, LEX_DOOR.x + 3.4]) H.box(x - 0.14, Y0, cz1 - 0.34, x + 0.14, cy, cz1 - 0.06, BLK);
  // ---- side + back walls: brick with window rows, metal band above (outward normal on the right)
  for (const [xa, za, xb, zb, top] of [[x1, z1, x1, z0, weave], [x1, z0, x0, z0, weave], [x0, z0, x0, z1, weave]]) {
    const S = H.frame(xa, za, xb, zb); H.windows(S, 0.6, S.L - 0.6, Y0 + 0.4, base - 0.3, { bw: 2.4, fh: 3.3, ww: 1.6, wh: 2.0, pane: GL, lit: 0.55, sill: '#5e5a55' });
    H.pilasters(S, 0, S.L, Y0, base, 4.8, 0.4, 0.14, BR2, { ol: false }); H.fbox(S, 0, S.L, base - 0.1, base + 0.1, 0, 0.14, '#5e5a55', { ol: false }); }
  { const S = H.frame(gx1, z0, gx0, z0); H.fbox(S, 0, S.L, weave, eave, 0, 0.05, MET2); }
  // ---- rooftop units on the wings
  for (const x of [x0 + 2.4, x1 - 2.4]) H.box(x - 1, wpeak - 0.6, z0 + 4, x + 1, wpeak + 0.5, z0 + 6.5, '#8a8e90');
  // ---- forecourt: concrete planters with young trees, benches; sidewalk pavers
  for (const [xa, xb] of [[x0 + 0.3, LEX_DOOR.x - 4.2], [LEX_DOOR.x + 4.2, gx1 - 0.5], [gx1 + 0.6, x1 - 1.6]]) {
    if (xb - xa < 1.5) continue; const zp0 = z1 + 1.0, zp1 = z1 + 2.2;
    H.box(xa, Y0, zp0, xb, Y0 + 0.62, zp1, CON); H.box(xa + 0.12, Y0 + 0.5, zp0 + 0.12, xb - 0.12, Y0 + 0.64, zp1 - 0.12, '#4a5a32', { ol: false });
    for (let x = xa + 0.9; x < xb - 0.5; x += 3.6) lexTree(H, x, (zp0 + zp1) / 2, Y0 + 0.62, 0.9);
    lmColl({ x0: xa, x1: xb, z0: zp0, z1: zp1 }); }
  // ---- signs (one canvas atlas): LEXINGTON / M A R K E T, WORLD FAMOUS, SINCE 1782, the red globe seal, the canopy fascia
  const W = '#f4f5f2';
  SG.add(F, u(cx), base + 1.85, gx1 - gx0 - 0.6, 1.45, 0.21, (g, w, h) => sText(g, 'LEXINGTON', w / 2, h * 0.53, w * 0.98, h * 0.92, SANS, W, { weight: '700', track: Math.round(h * 0.12) }));
  SG.add(F, u(cx), base + 1.0, 5.2, 0.62, 0.21, (g, w, h) => sText(g, 'M A R K E T', w / 2, h * 0.53, w * 0.98, h * 0.9, SANS, W, { weight: '700' }));
  SG.add(F, u((x0 + gx0) / 2), base + 0.3, 3.4, 1.2, 0.16, (g, w, h) => { sText(g, 'WORLD', w / 2, h * 0.27, w * 0.9, h * 0.42, SANS, W, { weight: '700' }); sText(g, 'FAMOUS', w / 2, h * 0.75, w * 0.95, h * 0.42, SANS, W, { weight: '700' }); });
  SG.add(F, u((gx1 + x1) / 2), base + 0.3, 3.0, 1.2, 0.16, (g, w, h) => { sText(g, 'SINCE', w / 2, h * 0.27, w * 0.8, h * 0.42, SANS, W, { weight: '700' }); sText(g, '1782', w / 2, h * 0.75, w * 0.85, h * 0.44, SANS, W, { weight: '700' }); });
  SG.add(F, u(wwx0 + 0.9), Y0 + 3.85, 1.55, 1.55, 0.2, (g, w, h) => { const r = Math.min(w, h) / 2 - 2; g.translate(w / 2, h / 2); // the round red globe seal (drawn, not the real mark)
    g.fillStyle = '#b8282c'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.strokeStyle = '#f2e6d8'; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, 0, r * 0.9, 0, TAU); g.stroke();
    g.lineWidth = r * 0.035; g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(0, 0, r * 0.3, r * 0.62, 0, 0, TAU); g.stroke();
    for (const k of [-0.35, 0, 0.35]) { g.beginPath(); g.moveTo(-Math.sqrt(1 - k * k) * r * 0.62, k * r * 0.62); g.lineTo(Math.sqrt(1 - k * k) * r * 0.62, k * r * 0.62); g.stroke(); }
    g.beginPath(); g.moveTo(0, -r * 0.62); g.lineTo(0, r * 0.62); g.stroke();
    g.save(); g.font = `bold ${Math.round(r * 0.17)}px ${SANS}`; g.fillStyle = '#f2e6d8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'LEXINGTON MARKET \u2022 1782 \u2022 '; for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + (i - txt.length / 2) / txt.length * TAU; g.save(); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, -r * 0.76); g.restore(); }
    g.restore(); });
  SG.at(LEX_DOOR.x, cy + 0.02, cz1 + 0.012, 0, 7.2, 0.38, (g, w, h) => { g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h); sText(g, 'WORLD FAMOUS  \u00b7  LEXINGTON MARKET', w / 2, h * 0.55, w * 0.9, h * 0.62, SANS, '#f4f2ea', { weight: '700', track: 2 }); });
  // stall boards in the window wall (original stall signs, no real stall names)
  const stalls = [['PIT BEEF', '#c0392b'], ['LAKE TROUT', '#2c6e8f'], ['CODDIES', '#c9892a'], ['CRAB CAKES', '#b5502a'], ['COOKIES', '#6a4a2a']];
  stalls.forEach(([t, c], i) => SG.add(F, u(lerp(wwx0 + 1.4, wwx1 - 0.4, i / 4)), Y0 + 2.75, 1.25, 0.34, 0.14, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); sText(g, t, w / 2, h * 0.55, w * 0.88, h * 0.62, SANS, '#fff6e0', { weight: '800' }); }));
}, null);
// night uplight washes on the gable + wings, and a warm pool under the canopy
lexGlow([{ x: LXM.cx, y: LXM.base - 0.4, z: LXM.z1 + 0.3, ry: 0, w: 11.8, h: 6.2 }, { x: (LXM.x0 + LXM.gx0) / 2, y: LXM.base - 1.2, z: LXM.z1 + 0.25, ry: 0, w: 5.6, h: 3.4 },
  { x: (LXM.gx1 + LXM.x1) / 2, y: LXM.base - 1.2, z: LXM.z1 + 0.25, ry: 0, w: 5.6, h: 3.4 }, { x: LEX_DOOR.x, y: CURB + 0.1, z: LXM.z1 + 3.5, ry: 0, w: 7.2, h: 3.0 }], lexGlowTex, LEXW.lexL.near);
lexFar(LEXW.lexL, (H) => { const { x0, x1, z0, z1, gx0, gx1, eave, ridge, weave, wpeak, base } = LXM, cx = LXM.cx;
  H.box(x0, CURB, z0, x1, base, z1, '#8a4632', { ol: false }); H.box(gx0, base, z0, gx1, eave, z1, '#a9afb3', { ol: false, emi: '#4a3d2a' }); H.prism('z', z0, z1, [[gx0, eave], [gx1, eave], [cx, ridge]], '#8f969b', { ol: false });
  for (const [a, b] of [[x0, gx0], [gx1, x1]]) H.box(a, base, z0, b, weave, z1, '#959ca1', { ol: false }); H.box(gx0 + 1, CURB, z1, gx1 - 1.2, base + 0.9, z1 + 0.05, '#1d1f22', { ol: false, emi: '#c09060' }); });
landmark('lexington', 'LEXINGTON MARKET', -88, -55, 15, { name: 'Pit Beef Pete', x: window.LEX_ANCHOR.x, z: window.LEX_ANCHOR.z, night: true });

// ======================= 2) WESTMINSTER BURYING GROUND =======================
const WMB = { x0: -133.4, x1: -110.6, z0: -69.4, z1: -46.6, cx0: -129, cx1: -119, cz0: -67.5, cz1: -55.5, tower: { x: -124, z: -54.3, s: 3.2, h: CURB + 13 } };
window.POE_ANCHOR = { id: 'westminster', name: 'WESTMINSTER BURYING GROUND', x: -113.6, z: -49.6, y: CURB, yaw: Math.PI * 0.75, // Poe's memorial inside the corner gate
  grave: { x: -113.6, z: -49.6 }, gate: { x: WMB.x1, z: -50.2, w: 2.2, side: 'east' }, gate2: { x: -118.5, z: WMB.z1, w: 2.2, side: 'south' },
  church: { x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1 }, catacombs: { x: -124, z: -61.5, note: 'church undercroft entrance (stub)' },
  yard: { x0: WMB.x0, x1: WMB.x1, z0: WMB.z0, z1: WMB.z1 }, stones: [], nightOnly: true };
LEXW.wmbL = lmHD('westminster', -122, -58, 13, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, cx0, cx1, cz0, cz1 } = WMB, BR = '#7e3e2c', BR2 = '#6a3224', STN = '#c9c3b6', GR = '#4f6f3a';
  H.box(x0, Y0 - 0.02, z0, x1, Y0 + 0.03, z1, GR, { ol: false }); // the grass yard
  for (let i = 0; i < 26; i++) H.box(-113 + (LMR() - 0.5) * 2, Y0 + 0.031, -51 - i * 0.62, -112.2 + (LMR() - 0.5) * 2, Y0 + 0.035, -50.7 - i * 0.62, '#8c8574', { ol: false }); // worn path
  // the perimeter brick wall with stone coping, gaps for the two gates (east toward the market, south on the street) + iron gates swung open
  const wallH = 1.7, walls = [[x0, z1, -119.6, z1], [-117.4, z1, x1, z1], [x1, z1, x1, -49.1], [x1, -51.3, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]];
  for (const [xa, za, xb, zb] of walls) { const L = Math.hypot(xb - xa, zb - za); if (L < 0.2) continue; const ax = za === zb;
    const [bx0, bx1, bz0, bz1] = ax ? [Math.min(xa, xb), Math.max(xa, xb), za - 0.22, za + 0.22] : [xa - 0.22, xa + 0.22, Math.min(za, zb), Math.max(za, zb)];
    H.box(bx0, Y0, bz0, bx1, Y0 + wallH, bz1, BR); H.box(bx0 - 0.08, Y0 + wallH, bz0 - 0.08, bx1 + 0.08, Y0 + wallH + 0.14, bz1 + 0.08, STN, { ol: false });
    for (let t = 0; t <= L; t += 4) { const px = ax ? Math.min(xa, xb) + t : xa, pz = ax ? za : Math.min(za, zb) + t; H.box(px - 0.32, Y0, pz - 0.32, px + 0.32, Y0 + wallH + 0.3, pz + 0.32, BR2, { ol: false }); }
    lmColl({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 }); }
  for (const [x, z] of [[-119.6, z1], [-117.4, z1], [x1, -51.3], [x1, -49.1]]) { H.box(x - 0.4, Y0, z - 0.4, x + 0.4, Y0 + 2.4, z + 0.4, BR2); H.cyl(x, Y0 + 2.4, z, 0.05, 0.36, 0.45, 4, STN, { ry: Math.PI / 4 }); lmColl({ x, z, r: 0.45 }); }
  for (const [x, z, a] of [[-119.5, z1 + 0.05, 1], [-117.5, z1 + 0.05, -1]]) for (let k = 0; k < 6; k++) H.box(x + a * 0.05, Y0, z + 0.05 + k * 0.17, x + a * 0.05 + 0.04, Y0 + 1.9, z + 0.09 + k * 0.17, '#1c1c1e', { ol: false }); // open south gate leaves
  for (const [z, a] of [[-51.2, 1], [-49.2, -1]]) for (let k = 0; k < 6; k++) H.box(x1 + 0.05 + k * 0.17, Y0, z + a * 0.05, x1 + 0.09 + k * 0.17, Y0 + 1.9, z + a * 0.05 + 0.04, '#1c1c1e', { ol: false }); // open east gate leaves
  // the church (Westminster Hall): brick nave with buttresses, lancet windows, steep slate roof, the square front tower with pinnacles + a spire
  const roofY = Y0 + 8, rh = 5.2, ccx = (cx0 + cx1) / 2;
  H.box(cx0, Y0, cz0, cx1, roofY, cz1, BR);
  H.prism('z', cz0 - 0.35, cz1 + 0.35, [[cx0 - 0.4, roofY], [cx1 + 0.4, roofY], [ccx, roofY + rh]], '#4a4a52');
  for (const [xa, za, xb, zb] of [[cx1, cz1, cx1, cz0], [cx0, cz0, cx0, cz1]]) { const S = H.frame(xa, za, xb, zb);
    H.windows(S, 0.8, S.L - 0.8, Y0 + 1.8, roofY - 0.6, { bw: 2.4, fh: 5.6, ww: 0.85, wh: 3.4, arch: true, pane: '#2e3a52', lit: 0.4, sill: STN });
    H.pilasters(S, 0, S.L, Y0, roofY - 0.4, 2.4, 0.45, 0.45, BR2); H.fbox(S, 0, S.L, roofY - 0.35, roofY - 0.1, 0, 0.3, STN, { ol: false }); }
  { const S = H.frame(cx1, cz0, cx0, cz0); H.farch(S, S.L / 2, Y0 + 4.5, 1.5, 0.0, 0.05, '#2e3a52', { ol: false, emi: '#7a5a8a' }, 10); H.fbox(S, S.L / 2 - 1.5, S.L / 2 + 1.5, Y0 + 2, Y0 + 4.5, 0, 0.05, '#2e3a52', { ol: false, emi: '#7a5a8a' }); }
  H.tris([cx0 - 0.02, roofY, cz1 + 0.36, cx1 + 0.02, roofY, cz1 + 0.36, ccx, roofY + rh - 0.1, cz1 + 0.36], BR); // brick gable end behind the tower
  const T0 = WMB.tower, ts = T0.s / 2;
  H.box(T0.x - ts, Y0, T0.z - ts, T0.x + ts, T0.h, T0.z + ts, BR2);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { H.box(T0.x + dx * ts - 0.25, Y0, T0.z + dz * ts - 0.25, T0.x + dx * ts + 0.25, T0.h + 0.4, T0.z + dz * ts + 0.25, BR); H.cyl(T0.x + dx * ts, T0.h + 0.4, T0.z + dz * ts, 0.02, 0.28, 1.6, 4, STN, { ry: Math.PI / 4 }); }
  H.cyl(T0.x, T0.h, T0.z, 0.03, ts * 1.05, 7.5, 8, '#4a4a52', { ry: Math.PI / 8 }); H.seg([T0.x, T0.h + 7.4, T0.z], [T0.x, T0.h + 8.4, T0.z], 0.05, '#2a2a2e');
  { const S = H.frame(T0.x - ts, T0.z + ts, T0.x + ts, T0.z + ts); H.farch(S, ts, Y0 + 2.4, 0.8, 0, 0.06, '#3a2418', { ol: false }); H.fbox(S, ts - 0.8, ts + 0.8, Y0, Y0 + 2.4, 0, 0.06, '#3a2418', { ol: false });
    H.farch(S, ts, T0.h - 2.6, 0.55, 0, 0.06, '#1c1c22', { ol: false }); H.fbox(S, ts - 0.55, ts + 0.55, T0.h - 4.4, T0.h - 2.6, 0, 0.06, '#1c1c22', { ol: false });
    for (const y of [Y0 + 4.4, T0.h - 5.2]) H.fbox(S, -0.1, S.L + 0.1, y, y + 0.22, 0, 0.12, STN, { ol: false }); }
  for (const [xa, za, xb, zb] of [[T0.x + ts, T0.z + ts, T0.x + ts, T0.z - ts], [T0.x - ts, T0.z - ts, T0.x - ts, T0.z + ts]]) { const S = H.frame(xa, za, xb, zb); H.farch(S, ts, T0.h - 2.6, 0.55, 0, 0.06, '#1c1c22', { ol: false }); H.fbox(S, ts - 0.55, ts + 0.55, T0.h - 4.4, T0.h - 2.6, 0, 0.06, '#1c1c22', { ol: false }); }
  // the catacomb hatch (stub entrance on the east side of the nave)
  H.box(cx1 + 0.1, Y0, -62.4, cx1 + 1.5, Y0 + 0.45, -60.6, STN); H.box(cx1 + 0.2, Y0 + 0.45, -62.3, cx1 + 1.4, Y0 + 0.5, -60.7, '#2a2420', { ol: false });
  // tombstones: rows of slabs, a few obelisks + box tombs (seeded), clear of the church, the paths and Poe's memorial
  const stones = window.POE_ANCHOR.stones;
  for (let z = z0 + 1.6; z < z1 - 1.2; z += 2.2) for (let x = x0 + 1.4; x < x1 - 1.2; x += 1.9) {
    const jx = x + (LMR() - 0.5) * 0.6, jz = z + (LMR() - 0.5) * 0.5;
    if (jx > cx0 - 1.2 && jx < cx1 + 1.8 && jz > cz0 - 1.2 && jz < T0.z + ts + 1.2) continue; // the church
    if (Math.abs(jx - -113) < 1.3 && jz > -66) continue; if (Math.abs(jz - -50.2) < 1.2 && jx > -116) continue; if (Math.abs(jx - -118.5) < 1.4 && jz > -50) continue; // paths
    if (Math.hypot(jx - -113.6, jz - -49.6) < 2.6) continue; if (LMR() < 0.18) continue;
    const r = LMR(), lean = (LMR() - 0.5) * 0.18, col = LMR() < 0.5 ? STN : LMR() < 0.5 ? '#a9a59b' : '#8e8b84';
    if (r < 0.08) { H.box(jx - 0.18, Y0, jz - 0.18, jx + 0.18, Y0 + 0.35, jz + 0.18, col); H.cyl(jx, Y0 + 0.35, jz, 0.04, 0.13, 1.6, 4, col, { ry: Math.PI / 4 }); stones.push([+jx.toFixed(2), +jz.toFixed(2), 'obelisk']); lmColl({ x: jx, z: jz, r: 0.3 }); }
    else if (r < 0.16) { H.box(jx - 0.45, Y0, jz - 0.8, jx + 0.45, Y0 + 0.6, jz + 0.8, col); H.box(jx - 0.52, Y0 + 0.6, jz - 0.88, jx + 0.52, Y0 + 0.7, jz + 0.88, '#d8d2c4', { ol: false }); stones.push([+jx.toFixed(2), +jz.toFixed(2), 'tomb']); lmColl({ x0: jx - 0.45, x1: jx + 0.45, z0: jz - 0.8, z1: jz + 0.8 }); }
    else { const g = new THREE.BoxGeometry(0.5 + LMR() * 0.2, 0.7 + LMR() * 0.4, 0.1); g.translate(0, g.parameters.height / 2, 0); g.rotateZ(lean); g.translate(jx, Y0, jz); H.geo(g, col);
      stones.push([+jx.toFixed(2), +jz.toFixed(2), 'slab']); }
  }
  // Poe's memorial: a pale marble pedestal on a granite base with a bronze medallion, a little iron rail
  { const px = -113.6, pz = -49.6; H.box(px - 0.9, Y0, pz - 0.7, px + 0.9, Y0 + 0.35, pz + 0.7, '#9a968e'); H.box(px - 0.6, Y0 + 0.35, pz - 0.45, px + 0.6, Y0 + 2.0, pz + 0.45, '#e8e4dc');
    H.box(px - 0.72, Y0 + 2.0, pz - 0.57, px + 0.72, Y0 + 2.25, pz + 0.57, '#d8d4cc'); H.cyl(px, Y0 + 1.3, pz + 0.47, 0.26, 0.26, 0.05, 12, '#6a5030', { ol: false });
    for (let a = 0; a < 16; a++) { const t = a / 16 * TAU; H.seg([px + Math.cos(t) * 1.4, Y0, pz + Math.sin(t) * 1.1], [px + Math.cos(t) * 1.4, Y0 + 0.75, pz + Math.sin(t) * 1.1], 0.025, '#1c1c1e'); }
    lmColl({ x: px, z: pz, r: 0.95 });
    SG.add(H.frame(px - 0.6, pz + 0.46, px + 0.6, pz + 0.46), 0.6, Y0 + 0.55, 1.1, 0.55, 0.01, (g, w, h) => { sText(g, 'EDGAR ALLAN POE', w / 2, h * 0.3, w * 0.9, h * 0.26, SERIF, '#3a3530', { weight: '700' }); sText(g, '1809 \u2013 1849', w / 2, h * 0.68, w * 0.6, h * 0.22, SERIF, '#3a3530', { weight: '600' }); }); }
  // a few bare old trees
  for (const [x, z] of [[-131.2, -48.6], [-131.4, -66.8], [-112.6, -67.6], [-116.4, -56.2]]) { H.cyl(x, Y0, z, 0.16, 0.26, 3.4, 6, '#3e3228');
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + LMR(), L = 1.6 + LMR(); H.seg([x, Y0 + 3.0, z], [x + Math.cos(a) * L, Y0 + 4.3 + LMR() * 0.8, z + Math.sin(a) * L], 0.07, '#3e3228', { r1: 0.02 }); } lmColl({ x, z, r: 0.35 }); }
  // the gate plaque
  SG.add(H.frame(-117.3, z1 + 0.45, -115.3, z1 + 0.45), 1.0, Y0 + 0.9, 1.9, 0.52, 0.01, (g, w, h) => { g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); sText(g, 'WESTMINSTER', w / 2, h * 0.32, w * 0.9, h * 0.32, SERIF, '#e8dcb8', { weight: '700' }); sText(g, 'BURYING GROUND', w / 2, h * 0.72, w * 0.9, h * 0.26, SERIF, '#e8dcb8', { weight: '600' }); });
});
lmColl({ x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1 }); lmColl({ x0: WMB.tower.x - 1.6, x1: WMB.tower.x + 1.6, z0: WMB.tower.z - 1.6, z1: WMB.tower.z + 1.6 });
BLD.push({ x0: WMB.cx0, x1: WMB.cx1, z0: WMB.cz0, z1: WMB.cz1, h: CURB + 8 }, { x0: WMB.tower.x - 1.6, x1: WMB.tower.x + 1.6, z0: WMB.tower.z - 1.6, z1: WMB.tower.z + 1.6, h: WMB.tower.h });
lexFar(LEXW.wmbL, (H) => { const { cx0, cx1, cz0, cz1, tower: T0 } = WMB; H.box(cx0, CURB, cz0, cx1, CURB + 8, cz1, '#7e3e2c', { ol: false }); H.prism('z', cz0, cz1, [[cx0, CURB + 8], [cx1, CURB + 8], [(cx0 + cx1) / 2, CURB + 13.2]], '#4a4a52', { ol: false });
  H.box(T0.x - 1.6, CURB, T0.z - 1.6, T0.x + 1.6, T0.h, T0.z + 1.6, '#6a3224', { ol: false }); H.cyl(T0.x, T0.h, T0.z, 0.03, 1.7, 7.5, 8, '#4a4a52', { ry: Math.PI / 8, ol: false });
  H.box(WMB.x0, CURB, WMB.z0, WMB.x1, CURB + 0.03, WMB.z1, '#4f6f3a', { ol: false }); });

// ======================= 3) RASH FIELD =======================
const RSF = { x0: -42, x1: -21, z0: 19, z1: 30, fx0: -40.6, fx1: -22.4, fz0: 20.2, fz1: 29.2 };
RSF.cx = (RSF.fx0 + RSF.fx1) / 2; RSF.cz = (RSF.fz0 + RSF.fz1) / 2;
window.RASH_ANCHOR = { id: 'rashfield', name: 'RASH FIELD', x: RSF.cx, z: RSF.cz, y: CURB + 0.03, yaw: 0, field: { x0: RSF.fx0, x1: RSF.fx1, z0: RSF.fz0, z1: RSF.fz1 },
  goals: [{ x: RSF.fx0 + 2.2, z: RSF.cz, faces: '+x', team: 'otters' }, { x: RSF.fx1 - 2.2, z: RSF.cz, faces: '-x', team: 'toads' }], entry: { x: RSF.cx, z: 31.8 },
  water: 'north edge (z ' + RSF.z0 + ') + west / east seawalls: a defender checked off the field lands in the harbour' };
LEXW.rashL = lmHD('rashfield', RSF.cx, RSF.cz, 11, (H, signs, SG) => {
  const Y0 = CURB, { x0, x1, z0, z1, fx0, fx1, fz0, fz1, cx, cz } = RSF, LN = '#f2f2ea', yl = Y0 + 0.035;
  H.box(x0, WY - 0.3, z0 - 0.02, x1, Y0, z0 + 0.3, '#7a7468'); H.box(x0, Y0, z0, x1, Y0 + 0.08, z0 + 0.35, '#c8c2b4', { ol: false }); // north seawall + coping
  for (let i = 0; i < 9; i++) H.box(lerp(fx0, fx1, i / 9), Y0 + 0.01, fz0, lerp(fx0, fx1, (i + 1) / 9), Y0 + 0.03, fz1, i % 2 ? '#4f8f3a' : '#5a9a42', { ol: false }); // mown stripes
  const line = (ax, az, bx, bz, w = 0.09) => H.box(Math.min(ax, bx) - (az === bz ? 0 : w / 2), yl - 0.004, Math.min(az, bz) - (az === bz ? w / 2 : 0), Math.max(ax, bx) + (az === bz ? 0 : w / 2), yl, Math.max(az, bz) + (az === bz ? w / 2 : 0), LN, { ol: false });
  line(fx0, fz0, fx1, fz0); line(fx0, fz1, fx1, fz1); line(fx0, fz0, fx0, fz1); line(fx1, fz0, fx1, fz1); line(cx, fz0, cx, fz1);
  for (const gx of [fx0 + 2.2, fx1 - 2.2]) { const c = new THREE.RingGeometry(1.0, 1.09, 20); c.rotateX(-Math.PI / 2); c.translate(gx, yl, cz); H.geo(c, LN, { ol: false }); }
  for (const rx of [fx0 + 5.2, fx1 - 5.2]) line(rx, fz0, rx, fz1, 0.07); // restraining lines
  { const c = new THREE.CircleGeometry(0.25, 10); c.rotateX(-Math.PI / 2); c.translate(cx, yl + 0.001, cz); H.geo(c, LN, { ol: false }); }
  // the two goals: orange pipe frames with white nets (open toward the centre)
  for (const [gx, s] of [[fx0 + 2.2, -1], [fx1 - 2.2, 1]]) { const w = 0.95, hgt = 1.35, back = gx + s * 1.1;
    for (const dz of [-w, w]) H.seg([gx, Y0, cz + dz], [gx, Y0 + hgt, cz + dz], 0.045, '#ff7a1a', { seg: 6 });
    H.seg([gx, Y0 + hgt, cz - w], [gx, Y0 + hgt, cz + w], 0.045, '#ff7a1a', { seg: 6 });
    for (const dz of [-w, w]) H.seg([gx, Y0 + 0.02, cz + dz], [back, Y0 + 0.02, cz], 0.03, '#ff7a1a', { seg: 5 });
    const net = [gx, Y0 + hgt, cz - w, gx, Y0 + hgt, cz + w, back, Y0, cz, gx, Y0, cz - w, gx, Y0 + hgt, cz - w, back, Y0, cz, gx, Y0, cz + w, back, Y0, cz, gx, Y0 + hgt, cz + w];
    H.tris(net, '#e8ece8', { ol: false }); H.tris([net[3], net[4], net[5], net[0], net[1], net[2], net[6], net[7], net[8]], '#e8ece8', { ol: false }); // two-sided
    lmColl({ x: (gx + back) / 2, z: cz, r: 0.75 }); }
  // team benches on the promenade side + a low rail along the water side
  for (const bx of [cx - 5, cx + 5]) { H.box(bx - 1.6, Y0, fz1 + 0.35, bx + 1.6, Y0 + 0.45, fz1 + 0.7, '#3a5a8a'); H.box(bx - 1.6, Y0 + 0.45, fz1 + 0.65, bx + 1.6, Y0 + 0.95, fz1 + 0.75, '#3a5a8a', { ol: false }); }
  for (let x = x0 + 0.4; x <= x1 - 0.3; x += 2.1) H.box(x - 0.05, Y0, z0 + 0.12, x + 0.05, Y0 + 1.0, z0 + 0.22, '#3a3a3e', { ol: false });
  H.box(x0 + 0.3, Y0 + 0.95, z0 + 0.12, x1 - 0.3, Y0 + 1.05, z0 + 0.22, '#3a3a3e', { ol: false });
  for (const x of [x0 + 0.2, x1 - 0.2]) for (let z = z0 + 0.4; z <= z1 - 0.3; z += 2.1) H.box(x - 0.05, Y0, z - 0.05, x + 0.05, Y0 + 1.0, z + 0.05, '#3a3a3e', { ol: false });
  for (const x of [x0 + 0.2, x1 - 0.2]) H.box(x - 0.05, Y0 + 0.95, z0 + 0.3, x + 0.05, Y0 + 1.05, z1 - 0.3, '#3a3a3e', { ol: false });
  // the park sign at the promenade entrance
  H.box(cx - 1.7, Y0, z1 - 0.15, cx - 1.55, Y0 + 1.5, z1, '#2a3a2a'); H.box(cx + 1.55, Y0, z1 - 0.15, cx + 1.7, Y0 + 1.5, z1, '#2a3a2a');
  SG.at(cx, Y0 + 0.75, z1 + 0.01, 0, 3.4, 0.8, (g, w, h) => { g.fillStyle = '#1f4a2c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcb8'; g.lineWidth = h * 0.05; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    sText(g, 'RASH FIELD', w / 2, h * 0.4, w * 0.85, h * 0.42, SANS, '#f4ecd0', { weight: '800', track: 2 }); sText(g, 'INNER HARBOR \u00b7 KEY HIGHWAY', w / 2, h * 0.76, w * 0.8, h * 0.2, SANS, '#e8dcb8', { weight: '600' }); });
}, null);
lmColl({ x0: RSF.x0 + 0.1, x1: RSF.x1 - 0.1, z0: RSF.z0 + 0.1, z1: RSF.z0 + 0.25 }); // the water-side rail (the side rails stay open: knock-ins happen there)
lexFar(LEXW.rashL, (H) => H.box(RSF.fx0, CURB + 0.01, RSF.fz0, RSF.fx1, CURB + 0.03, RSF.fz1, '#55953e', { ol: false }));
landmark('rashfield', 'RASH FIELD', RSF.cx, RSF.cz + 1, 12, { name: 'Riptide Rodney', x: RSF.cx, z: RSF.cz });

// ======================= 4) HOOTERS on the Light Street Pavilion's octagon =======================
const HOO = { x: -55.5, z: 0.9, a: 3.2, can: 1.45, Y1: CURB + 3.6, E2: CURB + 7.0, top: CURB + 10.4 }; // apothem a; canopy overhang can
HOO.R = HOO.a / Math.cos(Math.PI / 8);
window.HOOTERS_ANCHOR = { x: HOO.x - HOO.a - 1.8, z: HOO.z, door: { x: HOO.x - HOO.a, z: HOO.z }, yaw: Math.PI / 2, face: 'west (Light St)' };
// the channel-letter sign, drawn once (one canvas per face in the atlas): orange faces, deep silver returns, a white rounded halo behind every letter, a small ®
function hootersLetters(g, w, h) {
  const txt = 'HOOTERS', px = Math.round(h * 0.7), font = `900 ${px}px "Arial Black", "Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif`;
  g.font = font; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; const sp = px * 0.02; let tw = 0; const ws = [...txt].map((c) => { const m = g.measureText(c).width; tw += m + sp; return m; }); tw -= sp;
  const k = Math.min(1, (w * 0.86) / tw); g.save(); g.translate(w * 0.06, 0); g.scale(k, 1);
  const by = h * 0.8; let x = 0; const xs = ws.map((m) => { const v = x; x += m + sp; return v; });
  g.lineJoin = 'round'; g.lineCap = 'round';
  [...txt].forEach((c, i) => { g.strokeStyle = '#ffffff'; g.lineWidth = px * 0.3; g.strokeText(c, xs[i], by); g.fillStyle = '#ffffff'; g.fillText(c, xs[i], by); }); // white halo clouds
  const d = Math.max(2, Math.round(px * 0.07)); for (let s = d; s > 0; s--) { g.fillStyle = s > d * 0.5 ? '#8c9298' : '#b9bfc4'; [...txt].forEach((c, i) => g.fillText(c, xs[i] + s * 0.6, by + s)); } // silver returns
  [...txt].forEach((c, i) => { const gr = g.createLinearGradient(0, by - px * 0.75, 0, by); gr.addColorStop(0, '#e2632f'); gr.addColorStop(1, '#c24a22'); g.fillStyle = gr; g.fillText(c, xs[i], by);
    g.strokeStyle = '#8a2e12'; g.lineWidth = Math.max(1, px * 0.02); g.strokeText(c, xs[i], by); });
  g.restore(); g.font = `bold ${Math.round(px * 0.2)}px Arial, sans-serif`; g.fillStyle = '#c24a22'; g.fillText('\u00ae', w * 0.06 + tw * k + px * 0.04, by - px * 0.62);
}
// the owl (procedural, original drawing in the sidewalk-sign style: round brown body, cream face disc, big orange-ringed eyes)
function hootersOwl(g, cx, cy, s) {
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#7a4e2c'; g.beginPath(); g.ellipse(0, s * 0.18, s * 0.42, s * 0.55, 0, 0, TAU); g.fill();
  g.fillStyle = '#5c3a20'; g.beginPath(); g.moveTo(-s * 0.36, -s * 0.22); g.lineTo(-s * 0.3, -s * 0.5); g.lineTo(-s * 0.12, -s * 0.3); g.fill(); g.beginPath(); g.moveTo(s * 0.36, -s * 0.22); g.lineTo(s * 0.3, -s * 0.5); g.lineTo(s * 0.12, -s * 0.3); g.fill();
  g.fillStyle = '#e8d6b4'; g.beginPath(); g.ellipse(0, s * 0.42, s * 0.24, s * 0.26, 0, 0, TAU); g.fill();
  g.strokeStyle = '#a07040'; g.lineWidth = s * 0.03; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, s * (0.3 + i * 0.1), s * 0.12, 0.3, Math.PI - 0.3); g.stroke(); }
  for (const sx of [-1, 1]) { g.fillStyle = '#e2632f'; g.beginPath(); g.arc(sx * s * 0.17, -s * 0.06, s * 0.16, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sx * s * 0.17, -s * 0.06, s * 0.11, 0, TAU); g.fill();
    g.fillStyle = '#1a1210'; g.beginPath(); g.arc(sx * s * 0.17 + s * 0.02, -s * 0.05, s * 0.055, 0, TAU); g.fill(); }
  g.fillStyle = '#e8a030'; g.beginPath(); g.moveTo(-s * 0.05, s * 0.06); g.lineTo(s * 0.05, s * 0.06); g.lineTo(0, s * 0.16); g.fill(); g.restore();
}
LEXW.hooL = lmHD('hooters', HOO.x, HOO.z, 5, (H, signs, SG) => {
  const Y0 = CURB, { x, z, a, can, Y1, E2, top } = HOO, R = HOO.R, rot = Math.PI / 8, BRZ = '#3a2e26', BRZ2 = '#2a221c', WOOD = '#b07a48', AL = '#d4d8dc', GL = '#56707c', COL = '#ddd5c4', ROOF = '#93bfa2';
  const face = (k, rr) => { const p = k * Math.PI / 4, A = [x + Math.sin(p - rot) * rr, z + Math.cos(p - rot) * rr], B = [x + Math.sin(p + rot) * rr, z + Math.cos(p + rot) * rr]; return H.frame(A[0], A[1], B[0], B[1]); };
  // faces k: 0 south (harbour), 1 SE, 2 east (harbour), 3 NE, 4 north (into the pavilion), 5 NW, 6 west (Light St), 7 SW
  H.cyl(x, Y0, z, R + 0.35, R + 0.35, 0.1, 8, '#c8c2b4', { ry: rot, ol: false });
  H.cyl(x, Y0 + 0.1, z, R - 0.15, R - 0.15, E2 - Y0 - 0.1, 8, GL, { ry: rot });
  for (let k = 0; k < 8; k++) { if (k === 4) continue; const F = face(k, a), L = F.L;
    if (k === 7 || k === 3) { H.fbox(F, 0.05, L - 0.05, Y0 + 0.1, Y1, 0, 0.06, WOOD); for (let i = 1; i < 5; i++) H.fbox(F, 0.05, L - 0.05, Y0 + 0.1 + i * (Y1 - Y0) / 5 - 0.02, Y0 + 0.1 + i * (Y1 - Y0) / 5 + 0.02, 0.06, 0.08, '#8a5a30', { ol: false }); }
    else { H.fbox(F, 0.06, L - 0.06, Y0 + 0.12, Y1 - 0.05, 0, 0.03, '#7894a2', { ol: false, emi: '#ffd690' });
      for (const t of [0, 0.5, 1]) H.fbox(F, t * L - 0.04, t * L + 0.04, Y0 + 0.1, Y1, 0.03, 0.07, AL, { ol: false });
      H.fbox(F, 0, L, Y0 + 2.5, Y0 + 2.56, 0.03, 0.07, AL, { ol: false }); }
    // upper storey glass + mullions
    H.fbox(F, 0.06, L - 0.06, Y1 + 0.55, E2 - 0.1, 0, 0.03, '#7894a2', { ol: false, emi: LMR() < 0.7 ? '#ffd690' : null });
    for (const t of [0, 0.33, 0.67, 1]) H.fbox(F, t * L - 0.04, t * L + 0.04, Y1 + 0.5, E2, 0.03, 0.07, AL, { ol: false });
  }
  // doors on the Light St face (k 6)
  { const F = face(6, a), L = F.L; H.fbox(F, L / 2 - 0.85, L / 2 + 0.85, Y0 + 0.1, Y0 + 2.35, 0.03, 0.09, '#506068', { ol: false, emi: '#ffe0a8' }); H.fbox(F, L / 2 - 0.03, L / 2 + 0.03, Y0 + 0.1, Y0 + 2.35, 0.09, 0.12, AL, { ol: false });
    for (const s of [-1, 1]) H.fbox(F, L / 2 + s * 0.15 - 0.02, L / 2 + s * 0.15 + 0.02, Y0 + 0.9, Y0 + 1.6, 0.12, 0.17, AL, { ol: false }); }
  // the deep dark-bronze canopy: fascia slab, warm wood-slat soffit, LED strips + downlights (lit at night)
  H.cyl(x, Y1, z, (a + can) / Math.cos(rot), (a + can) / Math.cos(rot), 0.5, 8, BRZ, { ry: rot });
  H.cyl(x, Y1 - 0.04, z, (a + can - 0.12) / Math.cos(rot), (a + can - 0.12) / Math.cos(rot), 0.04, 8, '#b98656', { ry: rot, ol: false, emi: '#3a2a18' });
  for (let k = 0; k < 8; k++) { const p = k * Math.PI / 4; for (const f of [0.45, 0.85]) { const rr = a + can * f;
      H.seg([x + Math.sin(p - rot) * rr / Math.cos(rot) * 0.98, Y1 - 0.06, z + Math.cos(p - rot) * rr / Math.cos(rot) * 0.98], [x + Math.sin(p + rot) * rr / Math.cos(rot) * 0.98, Y1 - 0.06, z + Math.cos(p + rot) * rr / Math.cos(rot) * 0.98], 0.025, '#fff4d8', { emi: '#fff0c8' }); } }
  H.cyl(x, Y1 + 0.5, z, (a + can) / Math.cos(rot) - 0.05, (a + can) / Math.cos(rot) - 0.05, 0.05, 8, BRZ2, { ry: rot, ol: false });
  // eave slab + the octagonal hip roof (pale green standing seam) + a little lantern cap
  H.cyl(x, E2, z, R + 0.55, R + 0.55, 0.42, 8, COL, { ry: rot });
  H.cyl(x, E2 + 0.42, z, 0.55, R + 0.55, top - E2 - 0.42, 8, ROOF, { ry: rot });
  for (let k = 0; k < 8; k++) { const p = k * Math.PI / 4 + rot; H.seg([x + Math.sin(p) * (R + 0.55), E2 + 0.44, z + Math.cos(p) * (R + 0.55)], [x + Math.sin(p) * 0.55, top + 0.02, z + Math.cos(p) * 0.55], 0.05, '#7aa88a'); }
  H.cyl(x, top, z, 0.3, 0.6, 0.5, 8, COL, { ry: rot }); H.cyl(x, top + 0.5, z, 0.02, 0.32, 0.6, 8, ROOF, { ry: rot });
  // the big HOOTERS channel letters on short posts at the canopy edge: Light St face (west, k 6) and harbour face (east, k 2) - one drawing, placed twice
  const SW = 5.0, SH = 1.4;
  for (const k of [6, 2]) { const F = face(k, a + can - 0.25); const L = F.L, yb = Y1 + 0.78;
    for (const t of [0.12, 0.38, 0.62, 0.88]) H.fbox(F, L / 2 + (t - 0.5) * SW * 0.86 - 0.04, L / 2 + (t - 0.5) * SW * 0.86 + 0.04, Y1 + 0.5, yb + 0.15, -0.12, -0.04, AL, { ol: false });
    H.fbox(F, L / 2 - SW * 0.44, L / 2 + SW * 0.44, Y1 + 0.62, Y1 + 0.7, -0.14, -0.02, AL, { ol: false });
    SG.add(F, L / 2, yb, SW, SH, 0.02, hootersLetters); }
  // SUITE 1445 over the doors, the red-and-white decal on the SW... (south-west glass k 0 = harbour, decal on the right glass of the Light St side k 5)
  { const F = face(6, a); SG.add(F, F.L / 2, Y0 + 2.48, 1.5, 0.26, 0.1, (g, w, h) => { g.fillStyle = '#1c2226'; g.fillRect(0, 0, w, h); sText(g, 'SUITE 1445', w / 2, h * 0.55, w * 0.86, h * 0.66, SANS, '#ffffff', { weight: '700', track: 1 }); }); }
  { const F = face(5, a); SG.add(F, F.L / 2, Y0 + 2.0, 1.6, 0.36, 0.08, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, w, h); sText(g, 'HOOTERS', w / 2, h * 0.56, w * 0.94, h * 0.8, SANS, '#d8282c', { weight: '900', stroke: '#ffffff', sw: h * 0.12 }); }); }
  // the sidewalk menu board (owl + HOOTERS + Wings · Shrimp · Burgers) and a bistro table with two chairs on the Light St promenade
  { const mx = HOO.x - a - can - 1.0, mz = HOO.z + 2.6; H.box(mx - 0.05, Y0, mz - 0.45, mx + 0.05, Y0 + 1.25, mz + 0.45, '#b8bcc0'); H.box(mx - 0.25, Y0, mz - 0.35, mx + 0.25, Y0 + 0.05, mz + 0.35, '#3a3a3e', { ol: false });
    SG.at(mx - 0.06, Y0 + 0.22, mz, -Math.PI / 2, 0.84, 1.0, (g, w, h) => { g.fillStyle = '#121212'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8ccd0'; g.lineWidth = w * 0.03; g.strokeRect(w * 0.02, w * 0.02, w * 0.96, h - w * 0.04);
      sText(g, 'HOOTERS', w * 0.5, h * 0.14, w * 0.86, h * 0.13, SANS, '#e2632f', { weight: '900', stroke: '#ffffff', sw: h * 0.012 }); hootersOwl(g, w * 0.26, h * 0.42, h * 0.3);
      for (const [i, t] of ['Wings', 'Shrimp', 'Burgers'].entries()) sText(g, t, w * 0.68, h * (0.32 + i * 0.12), w * 0.5, h * 0.1, SANS, '#f2c12e', { weight: '800' });
      g.fillStyle = '#f2c12e'; g.strokeStyle = '#e2632f'; g.lineWidth = w * 0.015; g.beginPath(); g.moveTo(w * 0.22, h * 0.76); g.lineTo(w * 0.6, h * 0.76); g.lineTo(w * 0.6, h * 0.7); g.lineTo(w * 0.8, h * 0.82); g.lineTo(w * 0.6, h * 0.94); g.lineTo(w * 0.6, h * 0.88); g.lineTo(w * 0.22, h * 0.88); g.closePath(); g.fill(); g.stroke(); });
    lmColl({ x: mx, z: mz, r: 0.4 });
    const tx = HOO.x - a - can - 0.6, tz = HOO.z - 2.4; H.cyl(tx, Y0, tz, 0.05, 0.05, 0.72, 6, '#2a2a2e', { ol: false }); H.cyl(tx, Y0 + 0.72, tz, 0.38, 0.38, 0.04, 10, '#d8d8d0');
    for (const s of [-1, 1]) { H.box(tx - 0.2, Y0 + 0.44, tz + s * 0.62 - 0.2, tx + 0.2, Y0 + 0.48, tz + s * 0.62 + 0.2, '#2a2a2e', { ol: false }); H.box(tx - 0.2, Y0 + 0.48, tz + s * 0.82 - 0.02, tx + 0.2, Y0 + 0.9, tz + s * 0.82 + 0.02, '#2a2a2e', { ol: false });
      for (const dx of [-0.17, 0.17]) H.box(tx + dx - 0.02, Y0, tz + s * 0.62 - 0.02, tx + dx + 0.02, Y0 + 0.44, tz + s * 0.62 + 0.02, '#2a2a2e', { ol: false }); }
    lmColl({ x: tx, z: tz, r: 0.5 }); }
}, null);
lmColl({ x: HOO.x, z: HOO.z, r: HOO.a + 0.1 }); BLD.push({ x0: HOO.x - HOO.a, x1: HOO.x + HOO.a, z0: HOO.z - HOO.a, z1: HOO.z + HOO.a, h: HOO.E2 });
// night: an orange glow behind each sign (face glow + white halo backlight read), a warm wash on the canopy
{ const qs = []; for (const k of [6, 2]) { const p = k * Math.PI / 4, rr = HOO.a + HOO.can - 0.32, cx = HOO.x + Math.sin(p) * rr, cz = HOO.z + Math.cos(p) * rr; qs.push({ x: cx, y: HOO.Y1 + 0.35, z: cz, ry: p, w: 7.0, h: 2.6 }); }
  lexGlow(qs, lexHaloTex, LEXW.hooL.near); }
lexFar(LEXW.hooL, (H) => { const { x, z, Y1, E2, top } = HOO, R = HOO.R; H.cyl(x, CURB, z, R, R, E2 - CURB, 8, '#33424a', { ry: Math.PI / 8, ol: false });
  H.cyl(x, Y1, z, R + 1.5, R + 1.5, 0.5, 8, '#3a2e26', { ry: Math.PI / 8, ol: false }); H.cyl(x, E2, z, 0.5, R + 0.55, top - E2, 8, '#93bfa2', { ry: Math.PI / 8, ol: false }); });

// ======================= stadiums: ORIOLE PARK AT CAMDEN YARDS + M&T BANK STADIUM in HD (hark/stadiums, 2026-10-13) =======================
// Brad: "the stadiums need to look more like a baseball field and a football field." Both are read from the city, the drone and fly-overs.
// Same landmark ids / anchors / footprints / colliders as before (03_city.js keeps the collider + BLD pushes of the old massings via
// standColl(); the warehouse massing stays and is refined here). No logo files: every marking and sign is drawn on canvas in code.
// Cost: ONE merged toon mesh (LM_MAT, night glow via emi) + ONE ink hull for both stadiums, ONE canvas-textured field quad per stadium,
// ONE sign-atlas mesh for both (scoreboard, video boards, gate signs). Open-top: nothing roofs a field.
// Orientation: Oriole Park's home plate is at the west (behind it the west stand), the outfield faces east toward Eutaw St + the warehouse;
// right field is the south side (the scoreboard stands in right-centre). M&T's field runs north-south, midfield = the Raven King anchor (-106, 76).
const STADIUMS = (function () {
  const Y0 = CURB, H = new HB(), sa = new SA(), out = { fields: [] };
  LMR(4242421);
  const rbox = (cx, cz, w, d, y0, y1, ry, col, o) => { const g = new THREE.BoxGeometry(w, y1 - y0, d); g.rotateY(ry); g.translate(cx, (y0 + y1) / 2, cz); H.add(g, col, o); };
  const seg = (ax, az, bx, bz, y0, y1, th, col, o) => { const L = Math.hypot(bx - ax, bz - az); rbox((ax + bx) / 2, (az + bz) / 2, L + th * 0.5, th, y0, y1, Math.atan2(-(bz - az), bx - ax), col, o); };
  const faceTo = (nx, nz) => Math.atan2(nx, nz); // SA / rbox ry that faces the unit direction (nx, nz)
  // stand rect helper: u along the stand, d from the field edge outward ('away' = the side the rows rise toward)
  function SR(x0, z0, x1, z1, away) {
    const alongX = away === 'n' || away === 's', L = alongX ? x1 - x0 : z1 - z0, D = alongX ? z1 - z0 : x1 - x0;
    const r = (u0, u1, d0, d1) => away === 'w' ? [x1 - d1, z0 + u0, x1 - d0, z0 + u1] : away === 'e' ? [x0 + d0, z0 + u0, x0 + d1, z0 + u1]
      : away === 'n' ? [x0 + u0, z1 - d1, x0 + u1, z1 - d0] : [x0 + u0, z0 + d0, x0 + u1, z0 + d1];
    return { L, D, r, F: H.frame(...faceOf(x0, z0, x1, z1, away)) };
  }
  const bx = (R, y0, y1, col, o) => H.box(R[0], y0, R[1], R[2], y1, R[3], col, o);
  // a two-deck seating bowl side: lower deck rows, a club / concourse band (glass glows at night), upper deck rows, back wall, aisles
  function tiers(x0, z0, x1, z1, away, h, P) {
    const S = SR(x0, z0, x1, z1, away), { L, D } = S, u0 = P.t0 || 0, u1 = L - (P.t1 || 0);
    const dl = D * P.split, dc = D * (P.split + P.conc), back = P.back || 0.5, rows = [];
    for (let i = 0; i < P.nl; i++) rows.push([dl * i / P.nl, dl * (i + 1) / P.nl, h * (P.yl0 + (P.yl1 - P.yl0) * i / (P.nl - 1))]);
    for (let i = 0; i < P.nu; i++) rows.push([dc + (D - back - dc) * i / P.nu, dc + (D - back - dc) * (i + 1) / P.nu, h * (P.yu0 + (P.yu1 - P.yu0) * i / (P.nu - 1))]);
    rows.forEach(([a, b, y], i) => {
      bx(S.r(u0, u1, a, b), Y0, Y0 + y - 0.24, P.conc_c, { ol: false });
      bx(S.r(u0, u1, a + 0.05, b), Y0 + y - 0.24, Y0 + y, i % 2 ? P.seat : P.seat2, { ol: false });
      for (let u = u0 + P.aisle; u < u1 - 1; u += P.aisle) bx(S.r(u - 0.3, u + 0.3, a, b), Y0 + y - 0.2, Y0 + y + 0.03, P.conc_c, { ol: false });
    });
    const yc = h * P.yc;
    bx(S.r(u0, u1, dl, dc), Y0, Y0 + yc, P.fascia, { ol: true });                                                  // concourse / club level block
    bx(S.r(u0, u1, dl - 0.06, dl + 0.02), Y0 + yc - 1.5, Y0 + yc - 0.35, '#1d222c', { ol: false, emi: '#ffd890' }); // club glass
    bx(S.r(u0, u1, dc - 0.08, dc + 0.25), Y0 + h * P.yu0 - 1.1, Y0 + h * P.yu0 + 0.12, P.band, { ol: true });      // upper deck fascia
    bx(S.r(u0, u1, D - back, D), Y0, Y0 + h, P.ext, { ol: true });                                                  // back wall
    bx(S.r(u0, u1, 0, 0.25), Y0, Y0 + Math.max(1.0, h * P.yl0 - 0.15), P.wall, { ol: true });                     // field wall
    for (const u of [u0, u1]) bx(S.r(u - 0.2, u + 0.2, 0, D), Y0, Y0 + h * 0.5, P.ext, { ol: false });            // end walls (vomitory frames)
    return S;
  }

  // ============================== ORIOLE PARK AT CAMDEN YARDS ==============================
  const OP = { x0: -124, z0: -26, x1: -92, z1: 26, home: [-120.5, 0], base: 9.0 };
  const HX = OP.home[0], HZ = OP.home[1], RC = 27, RLF = 24.5, RRF = 23.2, Q4 = Math.PI / 4;
  const wallR = (phi) => RC + ((phi < 0 ? RLF : RRF) - RC) * Math.pow(Math.min(1, Math.abs(phi) / Q4), 1.6); // phi: 0 = centre field (+x), +45 deg = right field line (+z)
  const wp = (phi, r = wallR(phi)) => [HX + Math.cos(phi) * r, HZ + Math.sin(phi) * r];
  const B1 = [HX + OP.base * Math.SQRT1_2, HZ + OP.base * Math.SQRT1_2], B3 = [HX + OP.base * Math.SQRT1_2, HZ - OP.base * Math.SQRT1_2], B2 = [HX + OP.base * Math.SQRT2, HZ];
  const MOUND = [HX + OP.base * 60.5 / 90, HZ];
  out.orioles = { home: OP.home, B1, B2, B3, mound: MOUND, wallR };

  function ballparkTex() {
    const K = 20, W = OP.x1 - OP.x0, D = OP.z1 - OP.z0, c = document.createElement('canvas'); c.width = W * K; c.height = D * K; const g = c.getContext('2d');
    const px = (x) => (x - OP.x0) * K, pz = (z) => (z - OP.z0) * K, P = (p) => [px(p[0]), pz(p[1])];
    g.fillStyle = '#4e8e38'; g.fillRect(0, 0, c.width, c.height);
    // mowed crosshatch (diamonds square to the base lines)
    g.save(); g.translate(px(HX), pz(HZ)); for (const [rot, col] of [[Q4, 'rgba(32,84,26,0.28)'], [-Q4, 'rgba(150,210,110,0.16)']]) { g.save(); g.rotate(rot); g.fillStyle = col; for (let k = -60; k < 60; k += 2) if (k % 4 === 0) g.fillRect(k * K * 0.85, -80 * K, 0.85 * 2 * K * 0.5 * 2, 160 * K); g.restore(); } g.restore();
    // beyond the fence: darker grass, the batter's eye, the bullpens (left-centre)
    g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height); g.moveTo(...P([HX, HZ])); for (let i = 0; i <= 40; i++) g.lineTo(...P(wp(-Q4 + i / 40 * 2 * Q4))); g.closePath();
    g.clip('evenodd'); g.fillStyle = '#3b6d2c'; g.fillRect(0, 0, c.width, c.height); g.restore();
    g.fillStyle = '#23402a'; g.fillRect(px(-93.2), pz(-4), 1.2 * K, 8 * K); // batter's eye
    for (const z0 of [-21.5, -17.8]) { g.fillStyle = '#b07a4a'; g.fillRect(px(-99.5), pz(z0), 6 * K, 2.8 * K); g.fillStyle = '#4e8e38'; g.fillRect(px(-99.1), pz(z0 + 0.5), 5.2 * K, 1.8 * K);
      for (const x of [-98.2, -96.2]) { g.fillStyle = '#b07a4a'; g.beginPath(); g.arc(px(x), pz(z0 + 1.4), 0.7 * K, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(px(x) - 4, pz(z0 + 1.4) - 1, 8, 2); } }
    // warning track
    const DIRT = '#b98250', TRACK = '#a8744a';
    g.fillStyle = TRACK; g.beginPath(); for (let i = 0; i <= 48; i++) g.lineTo(...P(wp(-Q4 - 0.04 + i / 48 * (2 * Q4 + 0.08)))); for (let i = 48; i >= 0; i--) { const ph = -Q4 - 0.04 + i / 48 * (2 * Q4 + 0.08); g.lineTo(...P(wp(ph, wallR(ph) - 1.5))); } g.closePath(); g.fill();
    // infield dirt: the arc round the rubber, clipped to fair territory (+ a little foul) so it meets the lines
    g.save(); g.beginPath(); g.moveTo(...P([HX - 1, HZ])); g.lineTo(...P([HX + 30 * Math.cos(-Q4 - 0.1), HZ + 30 * Math.sin(-Q4 - 0.1)])); g.lineTo(...P([HX + 30, HZ])); g.lineTo(...P([HX + 30 * Math.cos(Q4 + 0.1), HZ + 30 * Math.sin(Q4 + 0.1)])); g.closePath(); g.clip();
    g.fillStyle = DIRT; g.beginPath(); g.arc(px(MOUND[0]), pz(MOUND[1]), 9.5 * K, 0, TAU); g.fill(); g.restore();
    // infield grass square (inset from the base paths), cut-outs round the bases, home circle, mound
    const ctr = [(HX + B2[0]) / 2, HZ], ins = (p, k) => [ctr[0] + (p[0] - ctr[0]) * k, ctr[1] + (p[1] - ctr[1]) * k];
    g.fillStyle = '#58993f'; g.beginPath(); for (const p of [[HX, HZ], B1, B2, B3]) g.lineTo(...P(ins(p, 0.8))); g.closePath(); g.fill();
    g.save(); g.beginPath(); for (const p of [[HX, HZ], B1, B2, B3]) g.lineTo(...P(ins(p, 0.8))); g.closePath(); g.clip(); g.translate(px(HX), pz(HZ)); g.rotate(Q4); g.fillStyle = 'rgba(32,84,26,0.22)'; for (let k = -20; k < 20; k += 2) g.fillRect(k * K * 0.9, -20 * K, 0.9 * K, 40 * K); g.restore();
    g.fillStyle = DIRT; for (const p of [B1, B2, B3]) { g.beginPath(); g.arc(...P(p), 1.15 * K, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(px(HX), pz(HZ), 1.9 * K, 0, TAU); g.fill(); g.beginPath(); g.arc(...P(MOUND), 1.2 * K, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(px(HX + 0.6), pz(HZ + s * 4.6), 0.55 * K, 0, TAU); g.fillStyle = '#b07a4a'; g.fill(); g.strokeStyle = '#f4f2ea'; g.lineWidth = 2; g.stroke(); } // on-deck circles
    // chalk: foul lines to the poles, batter's boxes, catcher's box, coach's boxes
    g.strokeStyle = '#f6f4ec'; g.lineCap = 'butt'; g.lineWidth = 0.16 * K;
    for (const s of [-1, 1]) { const e = wp(s * Q4); g.beginPath(); g.moveTo(px(HX + 0.5), pz(HZ + s * 0.5)); g.lineTo(...P(e)); g.stroke(); }
    g.lineWidth = 0.09 * K; for (const s of [-1, 1]) g.strokeRect(px(HX - 0.6), pz(HZ + (s < 0 ? -1.25 : 0.35)), 1.2 * K, 0.9 * K);
    g.strokeRect(px(HX - 1.7), pz(HZ - 0.45), 1.0 * K, 0.9 * K);
    for (const p of [[HX + 6.6, HZ + 9.4], [HX + 6.6, HZ - 10.6]]) g.strokeRect(px(p[0]), pz(p[1]), 2 * K, 1.2 * K);
    // bases + home plate + rubber
    g.fillStyle = '#ffffff'; for (const p of [B1, B2, B3]) { g.save(); g.translate(...P(p)); g.rotate(Q4); g.fillRect(-0.32 * K, -0.32 * K, 0.64 * K, 0.64 * K); g.restore(); }
    g.save(); g.translate(px(HX), pz(HZ)); const hp = 0.34 * K; g.beginPath(); g.moveTo(hp, -hp); g.lineTo(hp, hp); g.lineTo(-hp * 0.2, hp); g.lineTo(-hp, 0); g.lineTo(-hp * 0.2, -hp); g.closePath(); g.fill(); g.restore();
    g.fillRect(px(MOUND[0]) - 2, pz(MOUND[1]) - 0.3 * K, 4, 0.6 * K);
    return c;
  }
  function field(x0, z0, x1, z1, canvas, id) {
    const y = Y0 + 0.02, Pp = [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0], U = [0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); bakeColor(g, '#ffffff'); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, toonMat({ map: lowTex(canvas, 256) })); m.receiveShadow = true; m.name = 'field_' + id; scene.add(m); out.fields.push(m); return m;
  }
  field(OP.x0, OP.z0, OP.x1, OP.z1, ballparkTex(), 'orioles');
  // --- the diamond in 3D: mound, bases, outfield wall + padding, foul poles, dugouts, backstop
  H.cyl(MOUND[0], Y0, MOUND[1], 1.05, 1.3, 0.26, 16, '#b98250', { ol: false }); H.box(MOUND[0] - 0.08, Y0 + 0.26, MOUND[1] - 0.3, MOUND[0] + 0.08, Y0 + 0.3, MOUND[1] + 0.3, '#f4f2ea', { ol: false });
  for (const p of [B1, B2, B3]) rbox(p[0], p[1], 0.5, 0.5, Y0, Y0 + 0.12, Q4, '#f8f8f2', { ol: false });
  { const N = 26; let prev = wp(-Q4); for (let i = 1; i <= N; i++) { const ph = -Q4 + i / N * 2 * Q4, p = wp(ph), hh = ph > 0.3 ? 3.0 : 1.7; // right field: the tall scoreboard-side wall
      seg(prev[0], prev[1], p[0], p[1], Y0, Y0 + hh, 0.4, '#1d4a33', { ol: true }); seg(prev[0], prev[1], p[0], p[1], Y0 + hh, Y0 + hh + 0.12, 0.5, '#d8c27a', { ol: false }); prev = p; } }
  for (const s of [-1, 1]) { const p = wp(s * Q4); H.cyl(p[0], Y0, p[1], 0.11, 0.14, 10, 8, '#f2c41e'); rbox(p[0] - 0.25, p[1], 0.5, 0.06, Y0 + 3.5, Y0 + 9.6, 0, '#f2c41e', { ol: false }); }
  for (const s of [-1, 1]) { // dugouts along the base lines (1B = south, 3B = north), sunk into foul territory
    const dx = Math.SQRT1_2, dz = s * Math.SQRT1_2, nx = -Math.SQRT1_2, nz = s * Math.SQRT1_2, t = 5.4, off = 3.3, cx = HX + dx * t + nx * off, cz = HZ + dz * t + nz * off, ry = Math.atan2(-dz, dx);
    rbox(cx, cz, 5.2, 1.6, Y0, Y0 + 0.9, ry, '#1a1d22', { ol: true }); rbox(cx + nx * 0.15, cz + nz * 0.15, 5.6, 2.0, Y0 + 0.9, Y0 + 1.1, ry, '#2c5e3c', { ol: true });
    rbox(cx - nx * 0.82, cz - nz * 0.82, 5.2, 0.12, Y0 + 0.75, Y0 + 0.92, ry, '#e8e2d0', { ol: false }); }
  { let prev = null; for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.72 + 0.56 * i / 10), p = [HX + Math.cos(a) * 3.0, HZ + Math.sin(a) * 3.0]; if (prev) seg(prev[0], prev[1], p[0], p[1], Y0, Y0 + 1.1, 0.25, '#1d4a33', { ol: true }); prev = p; } }
  // --- the horseshoe: green seats, lower + upper deck (west behind home, north = 3B side, south = 1B side), brick arcade outside
  const OPS = { nl: 6, nu: 5, split: 0.46, conc: 0.1, yl0: 0.1, yl1: 0.42, yc: 0.55, yu0: 0.6, yu1: 0.95, aisle: 5.5, seat: '#2f7a46', seat2: '#27693c', conc_c: '#b9b2a4', fascia: '#24402e', band: '#1f3b2a', ext: '#8a4632', wall: '#1d4a33' };
  const sW = tiers(-134, -34, -124, 34, 'w', 14, OPS), sN = tiers(-124, -34, -96, -26, 'n', 11, Object.assign({}, OPS, { t0: 0 })), sS = tiers(-124, 26, -96, 34, 's', 11, OPS);
  for (const [S, h] of [[sW, 14], [sN, 11], [sS, 11]]) { const F = S.F, n = Math.max(2, Math.round(F.L / 3.4));
    for (let i = 0; i < n; i++) { const uc = (i + 0.5) * F.L / n, ww = F.L / n * 0.56; // two storeys of brick arches
      for (const [ya, yb] of [[0.3, h * 0.34], [h * 0.42, h * 0.7]]) { H.fbox(F, uc - ww / 2, uc + ww / 2, Y0 + ya, Y0 + yb - ww / 2, -0.04, 0.03, '#2a1f1a', { ol: false, emi: LMR() < 0.5 ? '#ffcf7a' : null }); H.farch(F, uc, Y0 + yb - ww / 2, ww / 2, -0.04, 0.03, '#2a1f1a', { ol: false }, 6); } }
    H.pilasters(F, 0, F.L, Y0, Y0 + h * 0.78, F.L / n, 0.45, 0.16, '#7a3c2a', { ol: false }); H.band(F, -0.1, F.L + 0.1, Y0 + h * 0.78, Y0 + h * 0.84, 0.22, '#d9cdb0', { ol: false });
    H.band(F, 0, F.L, Y0 + h * 0.84, Y0 + h, 0.06, '#2a4a36', { ol: false }); }
  H.box(-134.3, Y0 + 14, -34, -129, Y0 + 14.35, 34, '#1f3b2a', { ol: true }); // the green steel sunshade roof over the upper deck behind home
  for (let z = -32; z <= 32; z += 8) H.cyl(-129.4, Y0 + 12.2, z, 0.12, 0.12, 1.9, 6, '#1f3b2a', { ol: false });
  // --- light towers (same four spots + colliders as before): lattice-ish masts + lamp banks aimed at the infield
  for (const [x, z] of [[-128, -30], [-128, 30], [-98, -30], [-98, 30]]) {
    H.cyl(x, Y0, z, 0.28, 0.42, 26, 8, '#3c403c'); const dx = -108 - x, dz = 0 - z, l = Math.hypot(dx, dz), nx = dx / l, nz = dz / l, ry = faceTo(nx, nz), tx = Math.cos(ry), tz = -Math.sin(ry);
    rbox(x + nx * 0.5, z + nz * 0.5, 5.2, 0.5, Y0 + 25, Y0 + 28.4, ry, '#2c302c', { ol: true });
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { const u = -2.0 + i, cx = x + nx * 0.82 + tx * u, cz = z + nz * 0.82 + tz * u; rbox(cx, cz, 0.7, 0.18, Y0 + 25.3 + j * 1.0, Y0 + 26.0 + j * 1.0, ry, '#f4f0dc', { ol: false, emi: '#fff3cc' }); } }
  // --- Eutaw Street: brick walkway between the outfield and the warehouse, the warehouse refined (piers, cornice, banners), street blades
  H.box(-92, Y0, -34, -88.05, Y0 + 0.03, 34, '#9a5844', { ol: false });
  for (let z = -33; z < 34; z += 2.2) H.box(-92, Y0 + 0.03, z, -88.05, Y0 + 0.04, z + 0.08, '#b9846c', { ol: false });
  for (const k of ['w', 'e']) { const F = H.frame(...faceOf(-88, -34, -80, 34, k));
    H.pilasters(F, 0.3, F.L - 0.3, Y0, Y0 + 21.4, 4.25, 0.55, 0.2, '#6c3324', { ol: false });
    H.band(F, -0.35, F.L + 0.35, Y0 + 21.2, Y0 + 22.25, 0.36, '#5a2a1c', { ol: true }); H.band(F, -0.1, F.L + 0.1, Y0 + 4.6, Y0 + 4.85, 0.16, '#cdb894', { ol: false });
    if (k === 'w') for (let u = 4.25; u < F.L - 2; u += 8.5) { H.fbox(F, u - 0.42, u + 0.42, Y0 + 5.6, Y0 + 8.8, 0.28, 0.33, '#e86a24', { ol: false }); H.fbox(F, u - 0.42, u + 0.42, Y0 + 6.9, Y0 + 7.4, 0.33, 0.35, '#181818', { ol: false });
      H.fbox(F, u - 0.5, u + 0.5, Y0 + 8.8, Y0 + 8.9, 0.2, 0.4, '#202020', { ol: false }); } }
  H.box(-88.6, Y0 + 22.25, -34, -79.4, Y0 + 22.6, 34, '#3e342e', { ol: false });
  for (const s of [-1, 1]) { H.cyl(-88.7, Y0, s * 33, 0.06, 0.07, 3.6, 6, '#264a34', { ol: false });
    sa.at(-89.5, Y0 + 3.15, s * 33, faceTo(0, s), 1.6, 0.34, (g, w, h) => { g.fillStyle = '#1f6a3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = h * 0.08; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16); sText(g, 'EUTAW ST', w / 2, h * 0.54, w * 0.86, h * 0.62, SANS, '#ffffff', { weight: '800' }); }); }
  // --- the scoreboard in right-centre (on two legs, facing home plate) with the ORIOLE PARK header
  { const cx = -95.6, cz = 22.4, dx = HX - cx, dz = HZ - cz, l = Math.hypot(dx, dz), nx = dx / l, nz = dz / l, ry = faceTo(nx, nz), tx = Math.cos(ry), tz = -Math.sin(ry);
    for (const s of [-1, 1]) H.cyl(cx + tx * s * 3.2, Y0, cz + tz * s * 3.2, 0.3, 0.3, 6.2, 8, '#2a3a2e');
    rbox(cx, cz, 9.4, 0.6, Y0 + 6, Y0 + 11.6, ry, '#18301f', { ol: true }); rbox(cx, cz, 7.6, 0.5, Y0 + 11.6, Y0 + 13.3, ry, '#18301f', { ol: true });
    const fx = cx + nx * 0.34, fz = cz + nz * 0.34;
    sa.at(fx, Y0 + 6.2, fz, ry, 9.0, 5.2, (g, w, h) => { g.fillStyle = '#10261a'; g.fillRect(0, 0, w, h); const cw = w / 17, rh = h / 6;
      g.fillStyle = '#e8e0c8'; const hdr = ['', '', '', '', '1', '2', '3', '4', '5', '6', '7', '8', '9', '', 'R', 'H', 'E'];
      hdr.forEach((t, i) => t && sText(g, t, (i + 0.5) * cw, rh * 0.8, cw, rh * 0.55, SANS, '#e8e0c8'));
      [['VISITORS', [0, 0, 1, 0, 0, 0, 0, 0, 0], [1, 4, 0]], ['BALTIMORE', [2, 0, 0, 1, 0, 3, 0, 0, ''], [6, 9, 0]]].forEach(([nm, ln, rhe], r) => { const y = rh * (1.9 + r * 1.15);
        sText(g, nm, cw * 2, y, cw * 3.6, rh * 0.6, SANS, '#ffffff', { weight: '800' }); ln.forEach((v, i) => sText(g, String(v), (i + 4.5) * cw, y, cw, rh * 0.62, SANS, '#ffd27a'));
        rhe.forEach((v, i) => sText(g, String(v), (i + 14.5) * cw, y, cw, rh * 0.62, SANS, '#ffd27a')); });
      g.fillStyle = '#e86a24'; g.fillRect(0, rh * 4.15, w, rh * 0.12);
      sText(g, 'BALL 2   STRIKE 1   OUT 1', w * 0.5, rh * 5.0, w * 0.9, rh * 0.62, SANS, '#ffffff', { weight: '700' }); });
    sa.at(fx, Y0 + 11.75, fz, ry, 7.3, 1.45, (g, w, h) => { g.fillStyle = '#18301f'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK', w / 2, h * 0.55, w * 0.92, h * 0.78, SERIF, '#f2e6c4', { weight: '700', stroke: '#e86a24', sw: h * 0.05 }); }); }
  // gate signs on the brick (home plate gate behind the west stand, the north side facing downtown)
  sa.at(-134.6, Y0 + 9.4, 0, faceTo(-1, 0), 14, 1.3, (g, w, h) => { g.fillStyle = '#1f3b2a'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK AT CAMDEN YARDS', w / 2, h * 0.56, w * 0.94, h * 0.66, SERIF, '#f2e6c4', { weight: '700' }); });
  sa.at(-110, Y0 + 7.6, -34.6, faceTo(0, -1), 12, 1.2, (g, w, h) => { g.fillStyle = '#1f3b2a'; g.fillRect(0, 0, w, h); sText(g, 'ORIOLE PARK AT CAMDEN YARDS', w / 2, h * 0.56, w * 0.94, h * 0.66, SERIF, '#f2e6c4', { weight: '700' }); });

  // ============================== M&T BANK STADIUM ==============================
  const MT = { x0: -124, z0: 56, x1: -88, z1: 96, fx0: -114, fx1: -98, fz0: 58, fz1: 94, yd: 0.3 };
  const zy = (y) => MT.fz0 + 3 + y * MT.yd; // yards from the north goal line -> z (50 = midfield z 76)
  out.ravens = { field: MT, zy };
  function footballTex() {
    const K = 26, W = MT.x1 - MT.x0, D = MT.z1 - MT.z0, c = document.createElement('canvas'); c.width = W * K; c.height = D * K; const g = c.getContext('2d');
    const px = (x) => (x - MT.x0) * K, pz = (z) => (z - MT.z0) * K, cx = (MT.fx0 + MT.fx1) / 2;
    g.fillStyle = '#3f7a30'; g.fillRect(0, 0, c.width, c.height);
    for (let y = -10; y < 110; y += 5) { g.fillStyle = (y / 5) % 2 ? '#4f9038' : '#468532'; g.fillRect(px(MT.fx0 - 1.6), pz(zy(y)), (MT.fx1 - MT.fx0 + 3.2) * K, 5 * MT.yd * K + 1); }
    // white border round the field + team areas (between the 32s) on both sidelines
    g.strokeStyle = '#f6f6f0'; g.lineWidth = 0.32 * K; g.strokeRect(px(MT.fx0 - 0.3), pz(MT.fz0 - 0.3), (MT.fx1 - MT.fx0 + 0.6) * K, (MT.fz1 - MT.fz0 + 0.6) * K);
    g.lineWidth = 0.08 * K; for (const [x, w] of [[MT.fx0 - 3.6, 2.6], [MT.fx1 + 1.0, 2.6]]) g.strokeRect(px(x), pz(zy(32)), w * K, (zy(68) - zy(32)) * K);
    // end zones: purple, the wording drawn in code (no logo files)
    for (const [z0, txt, rot] of [[MT.fz0, 'RAVENS', 0], [zy(100), 'BALTIMORE', Math.PI]]) {
      g.fillStyle = '#3a1d6e'; g.fillRect(px(MT.fx0), pz(z0), (MT.fx1 - MT.fx0) * K, 3 * K);
      g.save(); g.translate(px(cx), pz(z0 + 1.5)); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = -8; i < 8; i++) g.fillRect(i * 1.0 * K, -1.5 * K, 0.08 * K, 3 * K);
      sText(g, txt, 0, 0.06 * K, (MT.fx1 - MT.fx0 - 1.4) * K, 2.05 * K, '"Arial Black", Impact, ' + SANS, '#ffffff', { weight: '900', stroke: '#0c0a10', sw: 0.26 * K });
      sText(g, txt, 0, 0.06 * K, (MT.fx1 - MT.fx0 - 1.4) * K, 2.05 * K, '"Arial Black", Impact, ' + SANS, '#ffffff', { weight: '900', stroke: '#c9a24a', sw: 0.08 * K }); g.restore(); }
    // lines: sidelines, end lines, goal lines, every 5 yards, hash ticks every yard (sidelines + the narrow NFL hashes)
    g.fillStyle = '#f8f8f2'; const lw = 0.11 * K;
    g.fillRect(px(MT.fx0) - lw / 2, pz(MT.fz0), lw, (MT.fz1 - MT.fz0) * K); g.fillRect(px(MT.fx1) - lw / 2, pz(MT.fz0), lw, (MT.fz1 - MT.fz0) * K);
    g.fillRect(px(MT.fx0), pz(MT.fz0) - lw / 2, (MT.fx1 - MT.fx0) * K, lw); g.fillRect(px(MT.fx0), pz(MT.fz1) - lw / 2, (MT.fx1 - MT.fx0) * K, lw);
    for (let y = 0; y <= 100; y++) { const z = pz(zy(y));
      if (y % 5 === 0) { const w = y === 0 || y === 100 ? lw * 1.8 : lw; g.fillRect(px(MT.fx0), z - w / 2, (MT.fx1 - MT.fx0) * K, w); continue; }
      const tl = 0.22 * K, tw = 0.05 * K;
      for (const x of [MT.fx0 + 0.12, MT.fx1 - 0.12 - 0.22, cx - 0.93 - 0.22, cx + 0.93]) g.fillRect(px(x), z - tw / 2, tl, tw); }
    for (const s of [-1, 1]) g.fillRect(px(cx - 0.12), pz(zy(s < 0 ? 2 : 98)) - lw / 2, 0.24 * K, lw); // PAT marks
    // numbers every 10 (bottoms toward each sideline) with the little arrows toward the nearer goal
    const NF = '"Arial Black", Impact, ' + SANS;
    for (let y = 10; y <= 90; y += 10) { const n = y <= 50 ? y : 100 - y, s = String(n), z = pz(zy(y));
      for (const [x, rot] of [[MT.fx0 + 3.0, Math.PI / 2], [MT.fx1 - 3.0, -Math.PI / 2]]) { g.save(); g.translate(px(x), z); g.rotate(rot);
        sText(g, s[0], -0.52 * K, 0, 0.8 * K, 1.15 * K, NF, '#f8f8f2', { weight: '900' }); sText(g, s[1], 0.52 * K, 0, 0.8 * K, 1.15 * K, NF, '#f8f8f2', { weight: '900' });
        if (n !== 50) { const dir = (y < 50 ? -1 : 1) * (rot > 0 ? 1 : -1), ax = dir * 1.12 * K; g.beginPath(); g.moveTo(ax + dir * 0.24 * K, -0.28 * K); g.lineTo(ax, -0.4 * K); g.lineTo(ax, -0.16 * K); g.closePath(); g.fill(); }
        g.restore(); } }
    return c;
  }
  field(MT.x0, MT.z0, MT.x1, MT.z1, footballTex(), 'ravens');
  // goal posts (yellow goosenecks behind each end line) + sideline benches between the 35s
  for (const [ze, s] of [[MT.fz0, -1], [MT.fz1, 1]]) { const Y = '#f2c81e', zb = ze + s * 0.9, cxx = (MT.fx0 + MT.fx1) / 2;
    H.cyl(cxx, Y0, zb, 0.14, 0.16, 2.0, 8, Y); H.cyl(cxx, Y0, zb, 0.28, 0.28, 1.1, 8, '#2a1a4a', { ol: false });
    rbox(cxx, (zb + ze) / 2, 0.16, Math.abs(ze - zb) + 0.16, Y0 + 1.92, Y0 + 2.08, 0, Y); rbox(cxx, ze, 2.6, 0.14, Y0 + 2.0, Y0 + 2.14, 0, Y);
    for (const k of [-1, 1]) H.cyl(cxx + k * 1.24, Y0 + 2.0, ze, 0.06, 0.07, 3.4, 6, Y); }
  for (const x of [MT.fx0 - 2.4, MT.fx1 + 2.4]) for (let z = zy(36); z < zy(64); z += 2.4) { H.box(x - 0.25, Y0, z, x + 0.25, Y0 + 0.45, z + 1.9, '#2a1a4a', { ol: true }); H.box(x + (x < -106 ? -0.4 : 0.25), Y0, z, x + (x < -106 ? -0.25 : 0.4), Y0 + 0.85, z + 1.9, '#3a2a6a', { ol: false }); }
  // --- the bowl: purple seats in two tiers with a glass club band, light-grey concrete outside with purple bands; east gap (z 70-82) stays open
  const MTS = { nl: 7, nu: 6, split: 0.44, conc: 0.12, yl0: 0.07, yl1: 0.42, yc: 0.55, yu0: 0.6, yu1: 0.96, aisle: 6, seat: '#5a3a9e', seat2: '#4a2e88', conc_c: '#b6b2ac', fascia: '#2b2140', band: '#3a1d6e', ext: '#c7c2b8', wall: '#241a3a' };
  const mW = tiers(-134, 48, -124, 104, 'w', 22, MTS), mN = tiers(-124, 48, -80, 56, 'n', 20, MTS), mS = tiers(-124, 96, -80, 104, 's', 20, MTS);
  const mE1 = tiers(-88, 56, -80, 70, 'e', 20, MTS), mE2 = tiers(-88, 82, -80, 96, 'e', 20, MTS);
  for (const [S, h] of [[mW, 22], [mN, 20], [mS, 20], [mE1, 20], [mE2, 20]]) { const F = S.F;
    H.pilasters(F, 0, F.L, Y0, Y0 + h, 4.6, 0.7, 0.22, '#aaa59c', { ol: false });
    H.band(F, -0.1, F.L + 0.1, Y0 + h * 0.36, Y0 + h * 0.42, 0.3, '#3a1d6e', { ol: false }); H.band(F, -0.1, F.L + 0.1, Y0 + h - 0.6, Y0 + h, 0.32, '#3a1d6e', { ol: true });
    H.windows(F, 0.8, F.L - 0.8, Y0 + h * 0.46, Y0 + h * 0.62, { bw: 2.3, fh: h * 0.16, ww: 1.6, wh: h * 0.1, pane: '#232a36', lit: 0.6 }); }
  // the arched, cantilevered canopies over the upper sideline decks (west: one long wing; east: one over each stand) + their light rims
  function canopy(xa, xb, z0, z1, ytop, rise, xFront) { const N = 18, Pp = [], th = 0.35, dropF = 1.1;
    const yAt = (t) => ytop + rise * Math.sin(Math.PI * t), pt = (x, t, k) => [x, yAt(t) - (x === xFront ? dropF : 0) - k, lerp(z0, z1, t)];
    const q = (a, b, c, d) => Pp.push(...a, ...b, ...c, ...a, ...c, ...d), xBack = xFront === xa ? xb : xa;
    for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N;
      q(pt(xBack, t0, 0), pt(xBack, t1, 0), pt(xFront, t1, 0), pt(xFront, t0, 0)); q(pt(xFront, t0, th), pt(xFront, t1, th), pt(xBack, t1, th), pt(xBack, t0, th));
      q(pt(xFront, t0, 0), pt(xFront, t1, 0), pt(xFront, t1, th), pt(xFront, t0, th)); q(pt(xBack, t0, th), pt(xBack, t1, th), pt(xBack, t1, 0), pt(xBack, t0, 0)); }
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.computeVertexNormals(); H.geo(g, '#e9e7e2');
    g = new THREE.BufferGeometry(); const Pf = []; for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N, a = pt(xFront, t0, th), b = pt(xFront, t1, th);
      Pf.push(a[0], a[1] - 0.02, a[2], b[0], b[1] - 0.02, b[2], b[0], b[1] - 0.3, b[2], a[0], a[1] - 0.02, a[2], b[0], b[1] - 0.3, b[2], a[0], a[1] - 0.3, a[2]); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(Pf, 3)); g.computeVertexNormals(); H.geo(g, '#3a1d6e', { ol: false });
    for (let i = 1; i < 8; i++) { const t = i / 8, z = lerp(z0, z1, t); H.cyl(xBack, Y0 + ytop - 1.6, z, 0.14, 0.14, yAt(t) - ytop + 1.6, 6, '#8e8a84', { ol: false }); }
    for (let i = 0; i <= 2 * N; i++) { const t = i / (2 * N), p = pt(xFront, t, th + 0.32); H.box(p[0] - 0.22, p[1] - 0.25, p[2] - 0.35, p[0] + 0.22, p[1], p[2] + 0.35, '#f4f0e0', { ol: false, emi: '#fff4d0' }); } }
  canopy(-134.6, -127.0, 46.5, 105.5, Y0 + 22.4, 3.4, -127.0);
  canopy(-84.4, -79.4, 54.8, 71.2, Y0 + 20.4, 1.4, -84.4); canopy(-84.4, -79.4, 80.8, 97.2, Y0 + 20.4, 1.4, -84.4);
  for (const [z, dz] of [[48.9, 1], [103.1, -1]]) for (let x = -122; x <= -82; x += 2.2) H.box(x - 0.3, Y0 + 20.0, z - 0.25, x + 0.3, Y0 + 20.5, z + 0.25, '#f4f0e0', { ol: false, emi: '#fff4d0' }); // end light rims
  // video boards above each end zone (north board: the RAVENS board; south: the scoreboard)
  for (const [z, s] of [[48.2, 1], [103.8, -1]]) { const z0 = z - s * 0.3, z1 = z + s * 0.2;
    H.box(-115, Y0 + 19.6, Math.min(z0, z1), -97, Y0 + 27.4, Math.max(z0, z1), '#151018', { ol: true }); for (const x of [-112, -100]) H.box(x - 0.4, Y0 + 18, z - 0.6, x + 0.4, Y0 + 19.6, z + 0.6, '#3a3640', { ol: false });
    sa.at(-106, Y0 + 20.0, z + s * 0.28, faceTo(0, s), 17.2, 7.0, s > 0
      ? (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c1260'); gr.addColorStop(1, '#120628'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
          sText(g, 'RAVENS', w / 2, h * 0.42, w * 0.86, h * 0.5, '"Arial Black", Impact, ' + SANS, '#f6f2ff', { weight: '900', stroke: '#c9a24a', sw: h * 0.03 });
          g.fillStyle = '#c9a24a'; g.fillRect(0, h * 0.74, w, h * 0.04); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.87, w * 0.7, h * 0.15, SANS, '#ffffff', { weight: '800' }); }
      : (g, w, h) => { g.fillStyle = '#0c0a12'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h * 0.22);
          sText(g, 'M&T BANK STADIUM', w / 2, h * 0.11, w * 0.6, h * 0.14, SANS, '#ffffff', { weight: '800' });
          sText(g, 'BALTIMORE', w * 0.27, h * 0.4, w * 0.4, h * 0.15, SANS, '#c9b8ff', { weight: '800' }); sText(g, 'VISITORS', w * 0.73, h * 0.4, w * 0.4, h * 0.15, SANS, '#d0d0d0', { weight: '800' });
          sText(g, '14', w * 0.27, h * 0.66, w * 0.3, h * 0.32, '"Arial Black", Impact, ' + SANS, '#ffd25a', { weight: '900' }); sText(g, '10', w * 0.73, h * 0.66, w * 0.3, h * 0.32, '"Arial Black", Impact, ' + SANS, '#ffd25a', { weight: '900' });
          sText(g, '4TH   2:00   1ST & 10', w / 2, h * 0.9, w * 0.8, h * 0.13, SANS, '#ffffff', { weight: '700' }); }); }
  sa.at(-134.6, Y0 + 15.4, 76, faceTo(-1, 0), 16, 1.6, (g, w, h) => { g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.56, w * 0.92, h * 0.68, SANS, '#ffffff', { weight: '900' }); });
  sa.at(-102, Y0 + 13.6, 47.4, faceTo(0, -1), 15, 1.5, (g, w, h) => { g.fillStyle = '#3a1d6e'; g.fillRect(0, 0, w, h); sText(g, 'M&T BANK STADIUM', w / 2, h * 0.56, w * 0.92, h * 0.68, SANS, '#ffffff', { weight: '900' }); });

  const grp = H.build(), signs = sa.build(); grp.name = 'stadiums_hd'; signs.name = 'stadiums_signs'; scene.add(grp, signs);
  out.mesh = grp; out.signs = signs; out.tris = grp.userData.tris; return out;
})();
window.__stadiums = STADIUMS;

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

// ======================= FORT McHENRY (refs/fort-mchenry: aerial_web_1/2 star plan, fort_1 parade ground, fort_2 sally port). The five-point star of
// red-brick scarp walls with stone coping and green grass ramparts on top, inside a mown ditch band + an outer star path (the covered way);
// cannons on the bastion points; the red-brick barracks with white two-tier porches on the parade ground with a gravel ring; the giant 15-star,
// 15-stripe Star-Spangled Banner on a tall white pole; brick sally-port gate piers and the brown park sign out front. The north bastion gun
// platform, its ramp and the set-piece cannon (09_fort.js) stay in the city mesh (not captured), so the HD model leaves them alone.
lmHD('fort', 176, 78, 26, (H, signs, SG) => {
  const cx = 176, cz = 78, R = 17, r = 10.5, Y0 = CURB, WH = 4.2, BR = '#9a4a36', BR2 = '#8a4030', COP = '#d9d1bd', GR = '#5f9440', GR2 = '#6fa64c';
  const star = (Ro, ri) => { const V = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : Ro; V.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } return V; };
  const V = star(R, r);
  // the ditch (a darker mown band hugging the walls) and the outer star path (covered way) - flat, over the lawn
  const D = star(R + 5.2, r + 3.2), Pth = star(R + 7.6, r + 4.6);
  { const P = []; for (let i = 0; i < 10; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], [cx2, cz2] = D[(i + 1) % 10], [dx2, dz2] = D[i];
      P.push(ax, Y0 + 0.03, az, dx2, Y0 + 0.03, dz2, cx2, Y0 + 0.03, cz2, ax, Y0 + 0.03, az, cx2, Y0 + 0.03, cz2, bx, Y0 + 0.03, bz); }
    H.tris(P, '#4d7d36', { ol: false }); }
  B3.ribbon(H, D, 0.5, '#8a7a5a', 0.045, true); // the counterscarp edge
  B3.ribbon(H, Pth, 1.4, '#d4cbb2', 0.04, true); // the gravel covered way
  for (let i = 0; i < 10; i++) {
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(-(bz - az), bx - ax);
    if (i === 5) continue; // the sally port gap (same as the massing)
    const wall = (len, th, y0, h, col, o, off = 0) => { const g = new THREE.BoxGeometry(len, h, th); g.translate(0, y0 + h / 2, off); g.rotateY(ang); g.translate(mx, 0, mz); H.add(g, col, o); };
    wall(L + 1.2, 2.4, Y0, WH - 0.55, BR); // brick scarp
    for (let y = 0.7; y < WH - 0.7; y += 0.7) wall(L + 1.22, 2.42, Y0 + y, 0.06, BR2, { ol: false }); // brick coursing lines
    wall(L + 1.3, 2.55, Y0 + WH - 0.55, 0.3, COP); // stone coping
    wall(L + 1.1, 2.3, Y0 + WH - 0.25, 0.45, GR); // grass rampart on top
    const g = new THREE.CylinderGeometry(0.01, 1.15, 0.7, 4, 1); g.scale(L / 1.6, 1, 1); g.rotateY(ang); g.translate(mx, Y0 + WH + 0.55, mz); H.add(g, GR2, { ol: false }); // the turf parapet ridge
  }
  // stone quoins on the bastion points
  for (let i = 0; i < 10; i += 2) { const [x, z] = V[i]; H.cyl(x, Y0, z, 1.0, 1.1, WH - 0.55, 6, '#b8ac96', { ol: false }); }
  // cannons on the ramparts at four bastion points (the north one is the set piece's own gun platform), pointing out
  for (const i of [2, 4, 6, 8]) { const [x, z] = V[i], a = Math.atan2(x - cx, z - cz), ix = cx + (x - cx) * 0.84, iz = cz + (z - cz) * 0.84;
    B3.cannon(H, ix, Y0 + WH + 0.2, iz, a, 1.0); B3.cannon(H, ix + Math.cos(a) * 1.8, Y0 + WH + 0.2, iz - Math.sin(a) * 1.8, a, 1.0); }
  // sally port: brick gate piers with stone caps at both ends of the gap, and a lintel arch sign over a brick screen just inside (fort_2)
  { const [ax, az] = V[5], [bx, bz] = V[6];
    for (const [x, z] of [[ax, az], [bx, bz]]) { H.box(x - 1.3, Y0, z - 1.3, x + 1.3, Y0 + WH + 1.2, z + 1.3, BR); H.box(x - 1.45, Y0 + WH + 1.2, z - 1.45, x + 1.45, Y0 + WH + 1.5, z + 1.45, COP); }
    const ang = Math.atan2(bz - az, bx - ax), nx = Math.sin(ang), nz = -Math.cos(ang), sx = (ax + bx) / 2 + nx * 9.5, sz = (az + bz) / 2 + nz * 9.5;
    // the brown park sign out on the lawn in front of the gap (posts + board)
    const out = Math.hypot(sx - cx, sz - cz) > Math.hypot((ax + bx) / 2 - cx, (az + bz) / 2 - cz) ? 1 : -1, ox = (ax + bx) / 2 + nx * 9.5 * out, oz = (az + bz) / 2 + nz * 9.5 * out;
    const ry = Math.atan2(ox - cx, oz - cz), F = H.frame(ox - Math.cos(ry) * 2.4, oz + Math.sin(ry) * 2.4, ox + Math.cos(ry) * 2.4, oz - Math.sin(ry) * 2.4);
    H.fbox(F, 0.2, 0.45, Y0, Y0 + 2.4, -0.15, 0.1, '#4a3424'); H.fbox(F, 4.35, 4.6, Y0, Y0 + 2.4, -0.15, 0.1, '#4a3424'); H.fbox(F, 0, 4.8, Y0 + 1.0, Y0 + 2.5, -0.1, 0.05, '#5b3c26');
    SG.add(F, 2.4, Y0 + 1.06, 4.6, 1.38, 0.07, (g, w, h) => { g.fillStyle = '#5b3c26'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.03; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
      sText(g, 'FORT McHENRY', w / 2, h * 0.36, w * 0.9, h * 0.34, SERIF, '#f2e8cc', { weight: 'bold' });
      sText(g, 'NATIONAL MONUMENT AND HISTORIC SHRINE', w / 2, h * 0.66, w * 0.88, h * 0.13, SANS, '#f2e8cc', { weight: 'bold' });
      sText(g, 'National Park Service', w / 2, h * 0.84, w * 0.6, h * 0.1, SANS, '#e8dcc0', { weight: '500' }); }); }
  // the barracks on the massing's interior block (170..179 x 75..79): red brick, two storeys, white two-tier porch on the south (parade) side, red roof
  { const x0 = 170, x1 = 179, z0 = 75, z1 = 78.1, h = 5.6;
    H.box(x0, Y0, z0, x1, Y0 + h, z1, BR); H.box(x0 - 0.15, Y0 + h, z0 - 0.15, x1 + 0.15, Y0 + h + 0.25, z1 + 1.05, '#e6e0d0');
    H.hip(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 1.2, Y0 + h + 0.25, 1.6, '#b4574a');
    const S = H.frame(x0, z1, x1, z1); H.windows(S, 0.6, 8.4, Y0 + 0.3, Y0 + h - 0.2, { bw: 1.5, fh: 2.7, ww: 0.7, wh: 1.5, pane: '#2a2622', head: '#e6e0d0', lit: 0.3 });
    const N = H.frame(x1, z0, x0, z0); H.windows(N, 0.6, 8.4, Y0 + 0.3, Y0 + h - 0.2, { bw: 1.5, fh: 2.7, ww: 0.7, wh: 1.5, pane: '#2a2622', head: '#e6e0d0', lit: 0.3 });
    for (let x = x0 + 0.3; x <= x1 - 0.2; x += 1.45) H.box(x - 0.09, Y0, z1 + 0.75, x + 0.09, Y0 + h, z1 + 0.93, '#f2efe6', { ol: false }); // porch posts
    H.box(x0, Y0 + 2.7, z1, x1, Y0 + 2.86, z1 + 0.95, '#e6e0d0', { ol: false }); // the upper porch floor
    for (const y of [Y0 + 3.6, Y0 + 0.9]) H.box(x0, y, z1 + 0.82, x1, y + 0.07, z1 + 0.9, '#f2efe6', { ol: false }); // the white railings
    for (let x = x0 + 0.15; x < x1; x += 0.3) H.box(x - 0.02, Y0 + 2.86, z1 + 0.84, x + 0.02, Y0 + 3.6, z1 + 0.88, '#f2efe6', { ol: false });
    for (const x of [x0 + 1.2, x1 - 1.2]) H.box(x - 0.3, Y0 + h + 0.8, (z0 + z1) / 2 - 0.3, x + 0.3, Y0 + h + 2.2, (z0 + z1) / 2 + 0.3, '#8a4030'); }
  // the parade ground: a gravel ring round the flagpole lawn
  { const fx = cx + 5, fz = cz + 4, pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; pts.push([fx + Math.cos(a) * 3.6, fz + Math.sin(a) * 2.6]); } B3.ribbon(H, pts, 1.1, '#d8d0bc', 0.035, true); }
  // the giant flagpole (on the massing pole's spot) with the 15-star Star-Spangled Banner flying east
  { const fx = cx + 5, fz = cz + 4, ph = 27;
    H.cyl(fx, Y0, fz, 0.42, 0.55, 0.6, 8, '#cfc8b8'); H.cyl(fx, Y0, fz, 0.13, 0.22, ph, 8, '#f2f0ea', { ol: false }); H.add(new THREE.SphereGeometry(0.3, 8, 6).translate(fx, Y0 + ph + 0.25, fz), '#d8b040', { ol: false });
    B3.flag(SG, fx + 0.15, Y0 + ph - 0.3, fz, Math.PI / 2, 11, 6.6, B3.banner15, 6, 0.55); }
});

// ======================= FEDERAL HILL PARK (refs/federal-hill: park_1 cannon + skyline, park_2 slope, park_3 aerial). The hill itself (heightfield,
// collision, the Hon Queen's ring) is the city's; this adds the park on it: the brick stair straight up the north face with black rails, the brick
// crest walk, black Civil War cannon on octagonal concrete plinths along the north crest aimed at downtown, a black iron rail on the crest,
// the stone obelisk, lantern posts, a ring of trees on the south/east/west brow, the tall US flag on the summit pole and the park sign at the foot.
lmHD('fedhill', -3, 59, 28, (H, signs, SG) => {
  const gy = (x, z) => CURB + hillH(x, z);
  const ell = (d, a) => [HILL.x + Math.cos(a) * HILL.rx * d, HILL.z + Math.sin(a) * HILL.rz * d]; // a = -PI/2 is due north (toward the harbour)
  // the crest walk (brick) round the brow, and the stair up the north face
  { const pts = []; for (let i = 0; i < 40; i++) pts.push(ell(0.34, i / 40 * TAU)); B3.ribbon(H, pts, 1.4, '#a85a44', 0.05, true); }
  { const x = HILL.x, zs = HILL.z - HILL.rz * 1.02, ze = HILL.z - HILL.rz * 0.3; let zPrev = zs, yPrev = gy(x, zs);
    B3.ribbon(H, [[x, zs - 1.2], [x, zs]], 2.6, '#b8b0a0', 0.04); // landing at the foot
    for (let z = zs; z < ze; z += 0.45) { const y = gy(x, z + 0.45); H.box(x - 1.2, Math.min(yPrev, y) - 0.25, z, x + 1.2, y + 0.04, z + 0.45, (Math.round(z / 0.45) % 2) ? '#bdb5a5' : '#c9c1b1', { ol: false }); yPrev = y; zPrev = z; }
    for (const sx of [-1.35, 1.35]) { const pts = []; for (let z = zs; z <= ze + 0.01; z += (ze - zs) / 8) pts.push([x + sx, gy(x + sx, z) + 1.0, z]);
      for (let k = 0; k < pts.length - 1; k++) H.seg(pts[k], pts[k + 1], 0.045, '#1a1c1e', { seg: 4 });
      for (const p of pts) H.seg([p[0], p[1] - 1.0, p[2]], p, 0.04, '#1a1c1e', { seg: 4 }); } }
  // black iron rail along the north crest, broken for the stair
  { const pts = []; for (let a = -Math.PI * 0.92; a <= -Math.PI * 0.08 + 1e-3; a += Math.PI / 30) { const [x, z] = ell(0.27, a); pts.push([x, gy(x, z) + 0.95, z]); }
    for (let k = 0; k < pts.length - 1; k++) { if (Math.abs((pts[k][0] + pts[k + 1][0]) / 2 - HILL.x) < 1.8) continue; H.seg(pts[k], pts[k + 1], 0.04, '#1a1c1e', { seg: 4 });
      const p = pts[k]; H.seg([p[0], p[1] - 0.95, p[2]], p, 0.035, '#1a1c1e', { seg: 4 }); } }
  // Civil War cannon on octagonal concrete plinths on the north brow, aimed at downtown (north-west / north)
  for (const a of [-Math.PI * 0.8, -Math.PI * 0.66, -Math.PI * 0.36, -Math.PI * 0.22]) { const [x, z] = ell(0.24, a), y = gy(x, z);
    H.cyl(x, y - 0.4, z, 0.8, 0.85, 1.45, 8, '#c8c2b4'); const ga = Math.atan2(x - HILL.x - 4, z - HILL.z) * 0.35 + Math.PI;
    H.seg([x - Math.sin(ga) * 1.1, y + 1.35, z - Math.cos(ga) * 1.1], [x + Math.sin(ga) * 1.6, y + 1.5, z + Math.cos(ga) * 1.6], 0.24, '#1b1b1e', { r1: 0.15, seg: 8, ol: true });
    H.add(new THREE.SphereGeometry(0.25, 8, 4).translate(x - Math.sin(ga) * 1.1, y + 1.35, z - Math.cos(ga) * 1.1), '#1b1b1e', { ol: false }); }
  // the stone obelisk monument on the east brow
  { const [x, z] = ell(0.33, -0.15), y = gy(x, z); H.box(x - 1, y - 0.3, z - 1, x + 1, y + 0.8, z + 1, '#bdb6a8'); H.cyl(x, y + 0.8, z, 0.35, 0.6, 5.2, 4, '#d4cebf', { ry: Math.PI / 4 }); H.cyl(x, y + 6.0, z, 0.0, 0.35, 0.7, 4, '#d4cebf', { ry: Math.PI / 4 }); }
  // lantern posts round the crest walk
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i + 0.5) / 8 * TAU, [x, z] = ell(0.42, a); B3.lantern(H, x, gy(x, z) - 0.1, z, 3.4); }
  // trees on the south / east / west brow (the north face stays open lawn like the real slope)
  LMR(4242);
  for (let i = 0; i < 26; i++) { const a = -Math.PI * 0.05 + (i / 26) * Math.PI * 1.1 + (LMR() - 0.5) * 0.08, d = 0.5 + LMR() * 0.38, [x, z] = ell(d, a); B3.tree(H, x, gy(x, z) - 0.1, z, 0.85 + LMR() * 0.4); }
  for (const a of [-Math.PI * 0.97, -Math.PI * 0.03]) { const [x, z] = ell(0.7, a); B3.tree(H, x, gy(x, z) - 0.1, z, 1.1); }
  // the summit flagpole (the massing pole's spot) with a big US flag flying east
  { const y = gy(HILL.x, HILL.z); H.cyl(HILL.x, y - 0.2, HILL.z, 0.4, 0.5, 0.6, 8, '#c8c2b4'); H.cyl(HILL.x, y, HILL.z, 0.1, 0.17, 17, 8, '#f2f0ea', { ol: false });
    H.add(new THREE.SphereGeometry(0.22, 8, 6).translate(HILL.x, y + 17.2, HILL.z), '#d8b040', { ol: false });
    B3.flag(SG, HILL.x + 0.1, y + 16.8, HILL.z, Math.PI / 2, 6.4, 3.4, B3.usFlag, 5, 0.35); }
  // the park sign at the foot of the stair (brown board, cream lettering)
  { const x = HILL.x + 3.6, z = HILL.z - HILL.rz * 1.06, F = H.frame(x - 1.7, z, x + 1.7, z); // facing... north: build on a south-to-north frame
    const Fn = H.frame(x + 1.7, z, x - 1.7, z); H.fbox(Fn, 0.15, 0.35, CURB, CURB + 2.0, -0.1, 0.1, '#3a2a1c'); H.fbox(Fn, 3.05, 3.25, CURB, CURB + 2.0, -0.1, 0.1, '#3a2a1c'); H.fbox(Fn, 0, 3.4, CURB + 0.9, CURB + 2.1, -0.08, 0.04, '#4a3424');
    SG.add(Fn, 1.7, CURB + 0.96, 3.2, 1.08, 0.06, (g, w, h) => { g.fillStyle = '#4a3424'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = h * 0.03; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
      sText(g, 'FEDERAL HILL PARK', w / 2, h * 0.42, w * 0.88, h * 0.34, SERIF, '#f2e8cc'); sText(g, 'BALTIMORE CITY RECREATION & PARKS', w / 2, h * 0.74, w * 0.8, h * 0.13, SANS, '#e8dcc0'); }); void F; }
});

// ======================= SAGAMORE PENDRY - the 1914 RECREATION PIER (refs/sagamore-pendry: pendry_1, pier_1/2). Red brick Beaux-Arts head house in
// the middle (taller), cream stone base band, the huge round carriage arch through the base (both faces), a giant order of white columns with arched
// windows between, the RECREATION PIER frieze, a brick attic and a cream pediment with the carved crest; the maroon PENDRY banners; brick wings with
// cream trim and balustrades either side; the pool deck (turquoise pool, navy loungers, cabana) on the east wing roof (kept from the massing).
lmHD('pendry', 126, -25, 17, (H, signs, SG) => {
  const Y0 = CURB, z0 = -29, z1 = -21.5, BR = '#9a4636', CR = '#e8e0cc', CR2 = '#d8cfb8', hx0 = 119.5, hx1 = 132.5, HH = 13.4, WH = 9;
  // wings
  for (const [x0, x1] of [[112, hx0], [hx1, 140]]) {
    H.box(x0, Y0, z0, x1, Y0 + WH, z1, BR); H.box(x0 - 0.1, Y0, z0 - 0.1, x1 + 0.1, Y0 + 1.2, z1 + 0.1, CR2); // cream water table
    H.box(x0 - 0.2, Y0 + WH - 0.6, z0 - 0.2, x1 + 0.2, Y0 + WH, z1 + 0.2, CR); // cornice
    for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.55) for (const z of [z0 + 0.05, z1 - 0.05]) H.box(x - 0.06, Y0 + WH, z - 0.06, x + 0.06, Y0 + WH + 0.8, z + 0.06, CR, { ol: false }); // balustrade
    for (const z of [z0 + 0.05, z1 - 0.05]) H.box(x0, Y0 + WH + 0.8, z - 0.1, x1, Y0 + WH + 0.95, z + 0.1, CR, { ol: false });
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0)]) { H.windows(F, 0.3, F.L - 0.3, Y0 + 1.4, Y0 + WH - 0.8, { bw: 1.75, fh: 3.4, ww: 0.95, wh: 2.1, pane: '#262a30', head: CR, sill: CR, arch: true, lit: 0.45 }); H.band(F, 0, F.L, Y0 + 4.7, Y0 + 4.9, 0.12, CR, { ol: false }); }
  }
  for (const F of [H.frame(112, z0, 112, z1), H.frame(140, z1, 140, z0)]) H.windows(F, 0.4, F.L - 0.4, Y0 + 1.4, Y0 + WH - 0.8, { bw: 1.8, fh: 3.4, ww: 0.95, wh: 2.1, pane: '#262a30', head: CR, arch: true, lit: 0.45 });
  // head house
  H.box(hx0, Y0, z0 - 0.4, hx1, Y0 + HH, z1 + 0.4, BR);
  H.box(hx0 - 0.15, Y0, z0 - 0.55, hx1 + 0.15, Y0 + 1.5, z1 + 0.55, CR2);
  H.box(hx0 - 0.25, Y0 + 11.0, z0 - 0.75, hx1 + 0.25, Y0 + 12.3, z1 + 0.75, CR); // entablature
  H.box(hx0 - 0.3, Y0 + HH, z0 - 0.6, hx1 + 0.3, Y0 + HH + 0.35, z1 + 0.6, CR); // top cornice
  H.prism('z', z0 - 0.6, z1 + 0.6, [[hx0 - 0.3, Y0 + HH + 0.35], [hx1 + 0.3, Y0 + HH + 0.35], [(hx0 + hx1) / 2, Y0 + HH + 3.2]], '#b04c3a'); // brick pediment / gable
  for (const z of [z0 - 0.62, z1 + 0.62]) { const s = z < -25 ? -1 : 1; // cream raking cornices on both gables
    H.seg([hx0 - 0.4, Y0 + HH + 0.4, z + s * 0.06], [(hx0 + hx1) / 2, Y0 + HH + 3.35, z + s * 0.06], 0.22, CR, { seg: 4 }); H.seg([(hx0 + hx1) / 2, Y0 + HH + 3.35, z + s * 0.06], [hx1 + 0.4, Y0 + HH + 0.4, z + s * 0.06], 0.22, CR, { seg: 4 }); }
  H.hip(hx0 - 0.1, z0 - 0.3, hx1 + 0.1, z1 + 0.3, Y0 + HH + 0.3, 2.9, '#6a5a52');
  for (const F of [H.frame(hx1, z0 - 0.4, hx0, z0 - 0.4), H.frame(hx0, z1 + 0.4, hx1, z1 + 0.4)]) { const L = F.L, m = L / 2;
    // the carriage arch: dark opening + cream voussoir ring + keystone
    H.fbox(F, m - 3.1, m + 3.1, Y0, Y0 + 2.9, -0.3, 0.02, '#1c1a18', { ol: false }); H.farch(F, m, Y0 + 2.9, 3.1, -0.3, 0.02, '#1c1a18', { ol: false }, 14);
    { const g = new THREE.RingGeometry(3.1, 3.6, 16, 1, 0, Math.PI); g.translate(m, Y0 + 2.9, 0.06); H.fgeo(F, g, CR, { ol: false }); }
    H.fbox(F, m - 0.35, m + 0.35, Y0 + 5.7, Y0 + 6.5, 0, 0.12, CR, { ol: false });
    H.band(F, 0, L, Y0 + 6.5, Y0 + 6.8, 0.2, CR); // the stone band over the base
    for (let u = 1.2; u < L; u += 1.6) if (Math.abs(u - m) > 3.8) H.fbox(F, u - 0.4, u + 0.4, Y0 + 2.0, Y0 + 3.3, -0.05, 0.02, '#262a30', { ol: false }); // small base windows
    // the giant order: 6 white columns, arched windows between, corner pavilions with quoins
    const cs = [2.3, 4.0, 5.7, 7.3, 9.0, 10.7];
    for (const u of cs) { H.fgeo(F, new THREE.CylinderGeometry(0.28, 0.32, 4.2, 10).translate(u, Y0 + 6.8 + 2.1, 0.45), '#f4f0e6'); H.fbox(F, u - 0.4, u + 0.4, Y0 + 6.8, Y0 + 7.05, 0.05, 0.85, CR, { ol: false }); H.fbox(F, u - 0.42, u + 0.42, Y0 + 10.75, Y0 + 11.0, 0.05, 0.87, CR, { ol: false }); }
    for (let k = 1; k < cs.length - 2; k++) { const u = (cs[k] + cs[k + 1]) / 2; H.fbox(F, u - 0.5, u + 0.5, Y0 + 7.3, Y0 + 9.6, -0.05, 0.02, '#20252c', { ol: false, emi: '#ffcf7a' }); H.farch(F, u, Y0 + 9.6, 0.5, -0.05, 0.02, '#20252c', { ol: false, emi: '#ffcf7a' }, 8); }
    H.band(F, 1.6, L - 1.6, Y0 + 7.0, Y0 + 7.4, 0.5, CR, { ol: false }); // balcony slab behind the columns
    for (let u = 1.7; u < L - 1.6; u += 0.3) H.fbox(F, u - 0.04, u + 0.04, Y0 + 7.4, Y0 + 8.1, 0.38, 0.46, CR, { ol: false });
    for (const u0 of [0, L - 1.2]) for (let y = 1.6; y < 10.8; y += 0.8) H.fbox(F, u0 + (y % 1.6 < 0.8 ? 0 : 0.25), u0 + 1.2 - (y % 1.6 < 0.8 ? 0 : 0.25), Y0 + y, Y0 + y + 0.4, 0, 0.08, CR, { ol: false }); // quoins
    // the crest in the pediment
    H.fgeo(F, new THREE.CylinderGeometry(0.75, 0.75, 0.2, 10).rotateX(Math.PI / 2).translate(m, Y0 + HH + 1.3, 0.25), CR, { ol: false });
    // frieze lettering + PENDRY banners
    SG.add(F, m, Y0 + 11.15, 8.6, 1.0, 0.8, (g, w, h) => sText(g, 'RECREATION PIER', w / 2, h / 2, w * 0.96, h * 0.72, SERIF, '#5a4a3a', { weight: '600', track: h * 0.08 }));
    SG.add(F, m, Y0 + HH + 0.55, 2.0, 0.6, 0.65, (g, w, h) => sText(g, '1914', w / 2, h / 2, w * 0.9, h * 0.8, SERIF, '#6a5a48', { weight: '600' }));
    for (const u of [cs[0] + 0.85, cs[5] - 0.85]) SG.add(F, u, Y0 + 7.4, 0.78, 3.1, 0.75, (g, w, h) => { g.fillStyle = '#8a2a3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c890'; g.lineWidth = w * 0.05; g.strokeRect(w * 0.1, w * 0.1, w * 0.8, h - w * 0.2);
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); sText(g, 'PENDRY', 0, 0, h * 0.8, w * 0.5, SERIF, '#f4ead4', { weight: '500', track: w * 0.08 }); g.restore(); });
    // Maryland + US flags on short staffs at the corner pavilions (pendry_1)
    for (const [u, fd] of [[0.6, B3.usFlag], [L - 0.6, B3.mdFlag]]) { const x = F.xa + F.ux * u + F.nx * 0.6, z = F.za + F.uz * u + F.nz * 0.6; H.seg([F.xa + F.ux * u, Y0 + 5.2, F.za + F.uz * u], [x + F.nx * 1.4, Y0 + 6.6, z + F.nz * 1.4], 0.04, '#2a2a2a', { seg: 4 });
      B3.flag(SG, x + F.nx * 1.3, Y0 + 6.55, z + F.nz * 1.3, Math.atan2(F.nx, F.nz), 1.3, 0.85, fd, 2, 0.06); }
  }
  // the pool deck on the east wing roof (the massing's rooftop pool, dressed): turquoise pool, deck, navy loungers, a small cabana bar
  H.box(133.2, Y0 + WH, -28.4, 139.5, Y0 + WH + 0.08, -22.1, '#dcd6ca', { ol: false });
  H.box(134.2, Y0 + WH + 0.08, -27.4, 138.6, Y0 + WH + 0.12, -23.6, '#3fc4dc', { ol: false, emi: '#1a5a66' });
  for (let k = 0; k < 6; k++) for (const z of [-28.0, -23.0]) H.box(134.4 + k * 0.72, Y0 + WH + 0.08, z - 0.3, 134.85 + k * 0.72, Y0 + WH + 0.36, z + 0.3, '#1f2f5a', { ol: false });
  H.box(133.4, Y0 + WH, -25.9, 134.0, Y0 + WH + 1.6, -24.4, '#3a2e26');
});

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

// ======================= UNDER ARMOUR - TIDE POINT (refs/under-armour: tidepoint_web_1 aerial, tidepoint_web_2 rooftop sign). The two old industrial
// brick halls (same footprints as the massing) with big multi-pane factory windows in white frames, brick pilasters, cream string courses and a
// cream cornice; the red accent stair box; the connector tower; the white steel frame on the north hall roof carrying UNDER ARMOUR in big block
// capitals facing the harbour; the red vertical CASCADE banner (Tide Point's buildings keep their old soap-brand names); US + Maryland flags on the roof.
lmHD('underarmour', 116, 58, 18, (H, signs, SG) => {
  const Y0 = CURB, BR = '#8e4a38', BR2 = '#7e3e2e', CR = '#e8e0cc', h = 11;
  const hall = (x0, z0, x1, z1) => {
    H.box(x0, Y0, z0, x1, Y0 + h, z1, BR); H.box(x0 - 0.2, Y0 + h - 0.5, z0 - 0.2, x1 + 0.2, Y0 + h + 0.15, z1 + 0.2, CR);
    H.box(x0 + 0.3, Y0 + h + 0.15, z0 + 0.3, x1 - 0.3, Y0 + h + 0.25, z1 - 0.3, '#5a5650', { ol: false });
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0), H.frame(x1, z1, x1, z0), H.frame(x0, z0, x0, z1)]) {
      H.pilasters(F, 0, F.L, Y0, Y0 + h - 0.5, 2.5, 0.45, 0.18, BR2, { ol: false });
      H.band(F, 0, F.L, Y0 + 3.9, Y0 + 4.15, 0.2, CR, { ol: false }); H.band(F, 0, F.L, Y0 + 0, Y0 + 0.6, 0.12, '#b8ae9a', { ol: false });
      H.windows(F, 0.2, F.L - 0.2, Y0 + 0.9, Y0 + h - 0.8, { bw: 2.5, fh: 3.35, ww: 1.75, wh: 2.55, pane: '#2a3038', mull: '#f2efe6', sill: CR, head: CR, lit: 0.5 });
      // factory sash grid (white muntins) over each window
      const nb = Math.max(1, Math.round((F.L - 0.4) / 2.5)), bwr = (F.L - 0.4) / nb, nf = Math.max(1, Math.round((h - 1.7) / 3.35)), fhr = (h - 1.7) / nf;
      for (let f = 0; f < nf; f++) for (let b = 0; b < nb; b++) { const uc = 0.2 + (b + 0.5) * bwr, yb = Y0 + 0.9 + f * fhr + (fhr - 2.55) * 0.45;
        for (const t of [0.33, 0.66]) H.fbox(F, uc - 0.875, uc + 0.875, yb + 2.55 * t - 0.03, yb + 2.55 * t + 0.03, 0, 0.05, '#f2efe6', { ol: false });
        for (const t of [0.25, 0.75]) H.fbox(F, uc - 0.875 + 1.75 * t - 0.03, uc - 0.875 + 1.75 * t + 0.03, yb, yb + 2.55, 0, 0.05, '#f2efe6', { ol: false }); }
    }
  };
  hall(106, 48, 126, 56); hall(106, 60, 126, 68);
  // the connector tower (the massing's 22 m tower): brick with cream bands, a red top panel and a flat cap
  { const x0 = 113.5, x1 = 118.5, z0 = 56.5, z1 = 59.5; H.box(x0, Y0, z0, x1, Y0 + 22, z1, BR); for (const y of [11, 16.5]) H.box(x0 - 0.15, Y0 + y, z0 - 0.15, x1 + 0.15, Y0 + y + 0.35, z1 + 0.15, CR, { ol: false });
    H.box(x0 - 0.1, Y0 + 18, z0 - 0.1, x1 + 0.1, Y0 + 21.6, z1 + 0.1, '#c8282c'); H.box(x0 - 0.3, Y0 + 21.6, z0 - 0.3, x1 + 0.3, Y0 + 22.3, z1 + 0.3, CR);
    for (const F of [H.frame(x0, z1, x1, z1), H.frame(x1, z0, x0, z0)]) H.windows(F, 0.4, F.L - 0.4, Y0 + 11.6, Y0 + 16.3, { bw: 1.6, fh: 2.4, ww: 0.9, wh: 1.7, pane: '#2a3038', mull: '#f2efe6', lit: 0.5 }); }
  // the red accent stair box on the north hall's west end (tidepoint_web_2)
  H.box(106.6, Y0 + 4.2, 47.5, 109.4, Y0 + h + 1.2, 48.2, '#c8282c'); H.box(106.4, Y0 + h + 1.2, 47.3, 109.6, Y0 + h + 1.5, 48.4, '#2a2a2a', { ol: false });
  // the rooftop sign frame (white steel) on the north hall, set back from the north edge, and its block capitals facing the harbour
  { const sx0 = 110.4, sx1 = 125.4, sz = 49.6, y0 = Y0 + h + 0.25, y1 = y0 + 3.3;
    for (let x = sx0; x <= sx1 + 0.01; x += 1.5) { H.box(x - 0.09, y0, sz - 0.09, x + 0.09, y1 + 0.2, sz + 0.09, '#eeeeea', { ol: false }); H.seg([x, y0, sz + 1.6], [x, y1 - 0.5, sz + 0.1], 0.06, '#eeeeea'); }
    for (const y of [y0 + 0.35, y1 - 0.25, y1 + 0.2]) H.box(sx0, y - 0.06, sz - 0.08, sx1, y + 0.06, sz + 0.08, '#eeeeea', { ol: false });
    SG.at((sx0 + sx1) / 2, y0 + 0.45, sz - 0.14, Math.PI, sx1 - sx0 - 0.4, 2.85, (g, w, hh) => sText(g, 'UNDER ARMOUR', w / 2, hh * 0.55, w * 0.99, hh * 0.98, '"Arial Black", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif', '#f6f6f2', { weight: '900', stroke: '#9a9a96', sw: hh * 0.04 })); }
  // CASCADE: the red vertical blade sign on the north hall's north face
  { const F = H.frame(126, 48, 106, 48); H.fbox(F, 4.2, 4.3, Y0 + 3.2, Y0 + 9.6, 0, 1.1, '#3a3a3a', { ol: false });
    SG.add(F, 4.25, Y0 + 3.4, 1.0, 6.0, 0.6, (g, w, hh) => { g.fillStyle = '#c8282c'; g.fillRect(0, 0, w, hh); g.save(); g.translate(w / 2, hh / 2); g.rotate(Math.PI / 2); sText(g, 'C A S C A D E', 0, 0, hh * 0.9, w * 0.5, SANS, '#f6f2ea', { weight: 'bold' }); g.restore(); });
    const F2 = H.frame(126, 48, 106, 48); void F2; }
  // US + Maryland flags on staffs at the north hall's north-west roof corner
  for (const [x, fd] of [[107.2, B3.usFlag], [108.6, B3.mdFlag]]) { H.cyl(x, Y0 + h + 0.25, 49.0, 0.04, 0.06, 5.2, 6, '#d8d8d0', { ol: false }); B3.flag(SG, x + 0.05, Y0 + h + 5.3, 49.0, Math.PI / 2, 1.6, 1.0, fd, 2, 0.08); }
});
// ---- draw-call budget (batch 3). Batch 3 swaps to HD closer in than batches 1-2 (nearD 70 m; the far LODs were dressed up in 03_city.js).
// The draw calls are pooled instead of 3-4 per landmark: a per-vertex landmark index (lmv) + a uniform mask drops a landmark's vertices
// out of the clip volume while it is in the other LOD state.
//  - FAR: all five far LODs (massing + their decal signs, decals pushed 6 cm off their walls) = ONE city-atlas mesh, no shadow (past ~70 m
//    it is outside the hero-following shadow camera).
//  - NEAR, east four (fort, pendry, fells, under armour): ONE toon mesh (casts shadow) + ONE ink hull + ONE sign mesh (their canvas sign
//    atlases stacked into one texture); the group is hidden when none of the four is near. Federal Hill keeps its own lmHD near group.
// The per-frame masks ride on scene.onBeforeRender after 03b's LOD swap. Colliders are untouched (nothing here adds or moves one).
(function b3pool() {
  const LB = (id) => LMHD.list.find((L) => L.id === id), all = ['fort', 'fedhill', 'pendry', 'fells', 'underarmour'].map(LB).filter(Boolean);
  const east = ['fort', 'pendry', 'fells', 'underarmour'].map(LB).filter(Boolean);
  for (const L of all) L.nearD = 70;
  const mask = (arr, name, show) => `for (int i = 0; i < ${arr.length}; i++) if (i == int(lmv + 0.5) && ${name}[i] ${show ? '<' : '>'} 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`;
  const decl = (arr, name) => `attribute float lmv; uniform float ${name}[${arr.length}];`;
  // merge non-indexed geometries [geo, li, xform?] over the named attributes, adding lmv
  const merge = (parts, names) => { let n = 0; for (const [g] of parts) n += g.attributes.position.count;
    const out = {}; for (const k of names) out[k] = new Float32Array(n * parts[0][0].attributes[k].itemSize); const lmv = new Float32Array(n); let o = 0;
    for (const [g, li, fx] of parts) { const c = g.attributes.position.count; for (const k of names) { const a = g.attributes[k], arr = (fx && fx[k]) ? fx[k](a) : a.array; out[k].set(arr, o * a.itemSize); } lmv.fill(li, o, o + c); o += c; }
    const g = new THREE.BufferGeometry(); for (const k of names) g.setAttribute(k, new THREE.BufferAttribute(out[k], parts[0][0].attributes[k].itemSize));
    g.setAttribute('lmv', new THREE.BufferAttribute(lmv, 1)); g.computeBoundingSphere(); return g; };
  // ---- FAR: one mesh
  const farHide = { value: all.map(() => 0) };
  const farMat = toonMat({ map: atlasTex, alphaTest: 0.5 }, true), fpc = farMat.onBeforeCompile;
  farMat.onBeforeCompile = (sh) => { fpc(sh); sh.uniforms.uLmHide = farHide;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + decl(all, 'uLmHide')).replace('#include <fog_vertex>', '#include <fog_vertex>\n' + mask(all, 'uLmHide', false)); };
  farMat.customProgramCacheKey = () => 'psxB3far';
  const push = (a) => { const p = a.array.slice(); return p; };
  const farParts = []; all.forEach((L, li) => { for (const m of [...L.far.children]) if (m.isMesh) {
    const dec = m.material === DECAL_MAT, g = m.geometry;
    farParts.push([g, li, dec ? { position: (a) => { const p = push(a), nn = g.attributes.normal.array; for (let i = 0; i < p.length; i++) p[i] += nn[i] * 0.06; return p; } } : null]); L.far.remove(m); } });
  let farMesh = null;
  if (farParts.length) { farMesh = new THREE.Mesh(merge(farParts, ['position', 'normal', 'uv', 'color', 'tr']), farMat); farMesh.castShadow = false; farMesh.receiveShadow = true; scene.add(farMesh); for (const [g] of farParts) g.dispose(); }
  // ---- NEAR (east four): one mesh + one hull + one sign mesh
  const nearOn = { value: east.map(() => 0) };
  const lmMat = toonMat(), lpc = lmMat.onBeforeCompile;
  lmMat.onBeforeCompile = (sh) => { lpc(sh); sh.uniforms.uLmNear = nearOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 emi; varying vec3 vEmi; ' + decl(east, 'uLmNear'))
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvEmi = emi;\n' + mask(east, 'uLmNear', true));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; uniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight += vEmi * uNight;\n#include <opaque_fragment>'); };
  lmMat.customProgramCacheKey = () => 'psxLMb3';
  const meshP = [], hullP = [], signs = [];
  east.forEach((L, li) => { for (const m of [...L.near.children]) {
    if (m.material === LM_MAT) meshP.push([m.geometry, li]);
    else if (m.material === OUT_CITY) { hullP.push([m.geometry, li]); const k = QUAL.outlines.indexOf(m); if (k >= 0) QUAL.outlines.splice(k, 1); }
    else if (m.material && m.material.map && m.material.map.userData.src) signs.push([m, li]);
    else continue;
    L.near.remove(m); } });
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
  if (meshP.length) { const m = new THREE.Mesh(merge(meshP, ['position', 'normal', 'color', 'emi']), lmMat); m.castShadow = true; m.receiveShadow = true; grp.add(m); for (const [g] of meshP) g.dispose(); }
  if (hullP.length) { const hm = outlineMat(0.0034); hm.uniforms.uLmNear = nearOn;
    hm.vertexShader = hm.vertexShader.replace('attribute vec3 odir;', 'attribute vec3 odir; ' + decl(east, 'uLmNear')).replace(/gl_Position = projectionMatrix \* viewMatrix \* wp; \}/, 'gl_Position = projectionMatrix * viewMatrix * wp; ' + mask(east, 'uLmNear', true) + ' }');
    const h = new THREE.Mesh(merge(hullP, ['position', 'odir']), hm); h.visible = QUAL.hd; QUAL.outlines.push(h); grp.add(h); for (const [g] of hullP) g.dispose(); }
  if (signs.length) { // stack the sign atlases (full-res canvases, 1024 wide) into one canvas and remap v
    const srcs = signs.map(([m]) => m.material.map.userData.src), X = [], Y = []; let cx = 0, cy = 0, W = 1024, Ht = 0; // columns of 1024 px, <= 4096 tall
    for (const s of srcs) { if (cy + s.height > 4096 && cy > 0) { cx += 1024; cy = 0; } X.push(cx); Y.push(cy); cy += s.height; Ht = Math.max(Ht, cy); W = cx + 1024; }
    const c = document.createElement('canvas'); c.width = W; c.height = Ht; const g2 = c.getContext('2d');
    srcs.forEach((s, i) => g2.drawImage(s, X[i], Y[i]));
    const kmax = Math.max(...srcs.map((s) => Math.min(1, 512 / Math.max(s.width, s.height))));
    const parts = signs.map(([m, li], i) => [m.geometry, li, { uv: (a) => { const u = a.array.slice(), Hc = srcs[i].height, Wc = srcs[i].width;
      for (let k = 0; k < u.length; k += 2) { u[k] = (X[i] + u[k] * Wc) / W; u[k + 1] = 1 - (Y[i] + (1 - u[k + 1]) * Hc) / Ht; } return u; } }]);
    const sm = new THREE.MeshBasicMaterial({ map: lowTex(c, Math.round(kmax * Math.max(W, Ht))), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: true });
    sm.onBeforeCompile = (sh) => { sh.uniforms.uLmNear = nearOn; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + decl(east, 'uLmNear')).replace('#include <fog_vertex>', '#include <fog_vertex>\n' + mask(east, 'uLmNear', true)); };
    sm.customProgramCacheKey = () => 'b3signs';
    const s = new THREE.Mesh(merge(parts, ['position', 'uv']), sm); s.renderOrder = 2; grp.add(s);
    for (const [m] of signs) { m.geometry.dispose(); const t = m.material.map, q = QUAL.texs.indexOf(t); if (q >= 0) QUAL.texs.splice(q, 1); t.dispose(); m.material.dispose(); } }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { prev.apply(this, a);
    let anyFar = false, anyNear = false;
    for (let i = 0; i < all.length; i++) { farHide.value[i] = all[i].isNear ? 1 : 0; if (!all[i].isNear) anyFar = true; }
    for (let i = 0; i < east.length; i++) { nearOn.value[i] = east[i].isNear ? 1 : 0; if (east[i].isNear) anyNear = true; }
    if (farMesh) farMesh.visible = anyFar; grp.visible = anyNear; };
})();

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

// ---------------- rigs: REAL procedural rigs for HAROLD, MAVIS and the ONE-EYED BREWMASTER (hark/rigs, 2026-10-13) ----------------
// Everything is built in code: no model files, no clips, no asset files.
//  * ONE shared humanoid skeleton (RIG_BONES, 28 bones): tilt > hips > torso (spine 1) > chest (spine 2) > neck > head > jaw / mustache / monocle,
//    shoulders > elbows > wrists > finger mitts + prop bones (swL / swR = cane, purse = Mavis's handbag swing), hips > knees > ankles > toes.
//    Each character only changes the bone offsets (proportions); the topology, the joint names and the clips are shared.
//  * The body is ONE organic surface: a signed-distance model of smooth-unioned ellipsoids / round cones / capped cones (each bound to a bone)
//    meshed with surface nets in the bind pose (an A-pose, arms out, so the sides never fuse to the arms), with SDF-gradient normals.
//    Skin weights come from the same model: each vertex is weighted to the bones of the solids it is near (exp falloff, top 4, normalised);
//    "rigid" solids (skirt, afro, shoes) keep their own bone. Small props / face parts (eyes, glasses, cane, purse, monocle, mustache) are
//    low-poly rigid pieces merged into the SAME geometry. Flat colours per face (vertex colours, split at colour borders) on the shared
//    toonMat (cel bands + flash) + one weighted-skinning ink hull (OUT_CHAR's uniforms). Result: 1 mesh + 1 outline (+1 shadow) per character.
//  * Clips (RIG_CLIPS) are keyframes authored in code and baked at 20 fps: idle, walk, run, atk1-3 (cane combo), roll (dodge), hurt (hit),
//    knockdown, getup, victory, purse (Mavis), canslam / spin / twirl (Brewmaster). They drive the SAME pose API (HERO_POSES.* / applyPose /
//    joint names), so every fight, the city, the partner AI and the cinematics keep working unchanged: HERO_POSES.idle / run / atk1-3 /
//    hurt / down / getup now sample the clips; HERO_POSES.walk / roll / victory / purse / clip(name, u) are new.
//  * Hooks: buildHero (Harold / Mavis, geometry built once and shared by every instance) and window.buildBrewmaster (09w's RIG HOOK; its geometry
//    is built only the first time the Brewmaster arena builds). ?oldrigs=1 = the previous part-stack rigs (nothing here runs).
//  * Test: ?rigstage=harold|mavis|brew[&rigyaw=rad][&rigclip=name&rigu=0..1] = a turntable stage (window.__rigs.stage(...)); __rigs.stats.
const RIGS = { on: !Q.has('oldrigs'), cache: {}, stats: {}, clips: {} };
const RIG_BONES = [ // [name, parent, offset in the parent's space (from the proportions d)]
  ['tilt', null, () => [0, 0, 0]], ['hips', 'tilt', (d) => [0, d.hip, 0]], ['torso', 'hips', (d) => [0, d.torsoY, 0]], ['chest', 'torso', (d) => [0, d.chestY, 0]],
  ['neck', 'chest', (d) => [0, d.neckY - d.chestY, 0]], ['head', 'neck', () => [0, 0, 0]], ['jaw', 'head', (d) => d.jaw], ['mustache', 'head', (d) => d.must], ['monocle', 'head', (d) => d.mono],
  ['shL', 'chest', (d) => [d.shX, d.shY - d.chestY, 0]], ['elL', 'shL', (d) => [0, -d.upper, 0]], ['haL', 'elL', (d) => [0, -d.fore, 0]], ['fgL', 'haL', (d) => d.fg], ['swL', 'haL', (d) => [0, -0.05 * d.s, 0]],
  ['shR', 'chest', (d) => [-d.shX, d.shY - d.chestY, 0]], ['elR', 'shR', (d) => [0, -d.upper, 0]], ['haR', 'elR', (d) => [0, -d.fore, 0]], ['fgR', 'haR', (d) => d.fg], ['swR', 'haR', (d) => [0, -0.05 * d.s, 0]],
  ['purse', 'swR', () => [0, 0, 0]],
  ['lgL', 'hips', (d) => [d.legX, 0, 0]], ['knL', 'lgL', (d) => [0, -d.thigh, 0]], ['ftL', 'knL', (d) => [0, -d.shin, 0]], ['toeL', 'ftL', (d) => d.toe],
  ['lgR', 'hips', (d) => [-d.legX, 0, 0]], ['knR', 'lgR', (d) => [0, -d.thigh, 0]], ['ftR', 'knR', (d) => [0, -d.shin, 0]], ['toeR', 'ftR', (d) => d.toe],
];
const RIG_BIND = { shL: [0, 0, 0.62], shR: [0, 0, -0.62], lgL: [0, 0, 0.06], lgR: [0, 0, -0.06], elL: [-0.15, 0, 0], elR: [-0.15, 0, 0] }; // A-pose the surface is meshed + bound in
const RIG_HERO_D = Object.assign({}, HERO_D, { chestY: 0.28, jaw: [0, 0.1, -0.06], must: [0, 0.12, 0.3], mono: [0.14, 0.32, 0.26], fg: [0, -0.06, 0.04], toe: [0, -0.03, 0.1], s: 1 });
const RIG_BREW_D = { hip: 0.98, torsoY: 0.06, chestY: 0.5, neckY: 1.2, legX: 0.26, thigh: 0.45, shin: 0.42, shX: 0.72, shY: 0.76, upper: 0.46, fore: 0.42,
  jaw: [0, -0.18, -0.05], must: [0, -0.16, 0.62], mono: [-0.22, 0.17, 0.62], fg: [0, -0.13, 0.05], toe: [0, -0.07, 0.17], s: 1.6 };
if (RIGS.on) for (const j of ['chest', 'jaw', 'fgL', 'fgR', 'toeL', 'toeR', 'purse', 'mustache', 'monocle']) if (!JOINTS.includes(j)) JOINTS.push(j); // rigs: the extra bones join the pose API

// ---------- bones ----------
function rigSkeleton(d) {
  const J = { root: new THREE.Group(), d, bones: [] };
  for (const [n, par, off] of RIG_BONES) { const b = new THREE.Bone(); b.name = n; b.position.fromArray(off(d)); (par ? J[par] : J.root).add(b); J[n] = b; J.bones.push(b); }
  return J;
}
// ---------- the SDF model ----------
const _rq = new THREE.Vector3(), _rm = new THREE.Matrix4(), _rM3 = new THREE.Matrix3();
function rigModel(d, spec) {
  // bind-pose bone matrices (root space)
  const S = rigSkeleton(d); for (const [k, r] of Object.entries(RIG_BIND)) S[k].rotation.fromArray(r); S.root.updateMatrixWorld(true);
  const W = {}; for (const b of S.bones) W[b.name] = b.matrixWorld.clone();
  const solids = [], paints = [], acc = [];
  const toRoot = (bone, c) => new THREE.Vector3().fromArray(c).applyMatrix4(W[bone]);
  const invRot = (bone, rot) => { const m = new THREE.Matrix4().extractRotation(W[bone]); if (rot) m.multiply(_rm.makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))); return new THREE.Matrix3().setFromMatrix4(m).transpose().elements; };
  const api = {
    E: (bone, c, r, col, o = {}) => solids.push({ t: 0, b: o.b || bone, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, k: o.k ?? 0.035 * d.s, rigid: !!o.rigid }),
    C: (bone, a, b2, ra, rb, col, o = {}) => solids.push({ t: 1, b: o.b || bone, a: toRoot(bone, a), e: toRoot(bone, b2), ra, rb, col, k: o.k ?? 0.035 * d.s, rigid: !!o.rigid }),
    K: (bone, c, h, r1, r2, col, o = {}) => solids.push({ t: 2, b: o.b || bone, c: toRoot(bone, c), R: invRot(bone, o.rot), h, r1, r2, col, k: o.k ?? 0.02 * d.s, rigid: !!o.rigid }),
    PE: (bone, c, r, col, o = {}) => paints.push({ t: 0, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, on: o.on }),
    PB: (bone, c, r, col, o = {}) => paints.push({ t: 1, c: toRoot(bone, c), R: invRot(bone, o.rot), r, col, on: o.on }),
    A: (bone, geo, col, pos, o = {}) => acc.push({ bone, geo, col, pos, rot: o.rot, ol: o.outline !== false, surf: o.surf }),
  };
  spec(api, d);
  for (const s of solids) { // culling radius per solid
    if (s.t === 0) s.br = Math.max(...s.r); else if (s.t === 1) { s.c = s.a.clone().add(s.e).multiplyScalar(0.5); s.br = s.a.distanceTo(s.e) / 2 + Math.max(s.ra, s.rb); }
    else s.br = Math.hypot(Math.max(s.r1, s.r2), s.h);
  }
  return { S, W, solids, paints, acc, d };
}
function rigSolidD(s, x, y, z) {
  if (s.t === 1) { // IQ round cone
    const ax = s.a.x, ay = s.a.y, az = s.a.z, bx = s.e.x - ax, by = s.e.y - ay, bz = s.e.z - az, l2 = bx * bx + by * by + bz * bz, rr = s.ra - s.rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const px = x - ax, py = y - ay, pz = z - az, yy = px * bx + py * by + pz * bz, zz = yy - l2;
    const qx = px * l2 - bx * yy, qy = py * l2 - by * yy, qz = pz * l2 - bz * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - s.rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - s.ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - s.ra;
  }
  const R = s.R, dx = x - s.c.x, dy = y - s.c.y, dz = z - s.c.z;
  const lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz;
  if (s.t === 0) { const r = s.r, k0 = Math.hypot(lx / r[0], ly / r[1], lz / r[2]), k1 = Math.hypot(lx / (r[0] * r[0]), ly / (r[1] * r[1]), lz / (r[2] * r[2])); return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1; }
  // capped cone (axis = local y, half height h, r1 at the bottom, r2 at the top)
  const qx = Math.hypot(lx, lz), qy = ly, h = s.h, r1 = s.r1, r2 = s.r2;
  const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
  const k2x = r2 - r1, k2y = 2 * h, t = clamp(((r2 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y), 0, 1);
  const cbx = qx - r2 + k2x * t, cby = qy - h + k2y * t, sg = cbx < 0 && cay < 0 ? -1 : 1;
  return sg * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
}
function rigSdf(M, x, y, z) {
  let d = 1e9;
  for (const s of M.solids) {
    const cx = x - s.c.x, cy = y - s.c.y, cz = z - s.c.z, lb = Math.sqrt(cx * cx + cy * cy + cz * cz) - s.br;
    if (lb > d + s.k) continue; // cannot change the (smooth) min
    const di = rigSolidD(s, x, y, z), k = s.k, h = Math.max(k - Math.abs(d - di), 0) / k; d = Math.min(d, di) - h * h * k * 0.25;
  }
  return d;
}
function rigPaintIn(p, x, y, z) {
  const R = p.R, dx = x - p.c.x, dy = y - p.c.y, dz = z - p.c.z;
  const lx = R[0] * dx + R[3] * dy + R[6] * dz, ly = R[1] * dx + R[4] * dy + R[7] * dz, lz = R[2] * dx + R[5] * dy + R[8] * dz, r = p.r;
  return p.t === 0 ? (lx / r[0]) ** 2 + (ly / r[1]) ** 2 + (lz / r[2]) ** 2 < 1 : Math.abs(lx) < r[0] && Math.abs(ly) < r[1] && Math.abs(lz) < r[2];
}
// surface nets over the model's bounds -> { pos[], tri[] }
function rigMesh(M, h) {
  const mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const s of M.solids) { mn.min(_rq.copy(s.c).subScalar(s.br)); mx.max(_rq.copy(s.c).addScalar(s.br)); }
  mn.subScalar(h * 2); mx.addScalar(h * 2);
  const nx = Math.ceil((mx.x - mn.x) / h) + 1, ny = Math.ceil((mx.y - mn.y) / h) + 1, nz = Math.ceil((mx.z - mn.z) / h) + 1;
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = rigSdf(M, mn.x + i * h, mn.y + j * h, mn.z + k * h);
  const cx = nx - 1, cy = ny - 1, cid = (i, j, k) => i + cx * (j + cy * k), CV = new Int32Array(cx * cy * (nz - 1)).fill(-1), P = [];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) { v[c] = F[id(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of ED) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t; sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t; sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t; n++; }
    CV[cid(i, j, k)] = P.length / 3; P.push(mn.x + (i + sx / n) * h, mn.y + (j + sy / n) * h, mn.z + (k + sz / n) * h);
  }
  // project each vertex onto the surface (2 Newton steps on the SDF)
  const e = h * 0.25;
  for (let q = 0; q < P.length; q += 3) for (let it = 0; it < 2; it++) {
    const x = P[q], y = P[q + 1], z = P[q + 2], f = rigSdf(M, x, y, z);
    const gx = (rigSdf(M, x + e, y, z) - rigSdf(M, x - e, y, z)) / (2 * e), gy = (rigSdf(M, x, y + e, z) - rigSdf(M, x, y - e, z)) / (2 * e), gz = (rigSdf(M, x, y, z + e) - rigSdf(M, x, y, z - e)) / (2 * e);
    const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-8) break; const s = clamp(f / g2, -h, h); P[q] -= gx * s; P[q + 1] -= gy * s; P[q + 2] -= gz * s;
  }
  const T = [];
  const quad = (a, b, c, d2) => { if (a < 0 || b < 0 || c < 0 || d2 < 0) return; const L = (u, w) => (P[u * 3] - P[w * 3]) ** 2 + (P[u * 3 + 1] - P[w * 3 + 1]) ** 2 + (P[u * 3 + 2] - P[w * 3 + 2]) ** 2;
    if (L(a, c) < L(b, d2)) T.push(a, b, c, a, c, d2); else T.push(a, b, d2, b, c, d2); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[id(i, j, k)] < 0;
    if (s0 !== (F[id(i + 1, j, k)] < 0)) quad(CV[cid(i, j - 1, k - 1)], CV[cid(i, j, k - 1)], CV[cid(i, j, k)], CV[cid(i, j - 1, k)]);
    if (s0 !== (F[id(i, j + 1, k)] < 0)) quad(CV[cid(i - 1, j, k - 1)], CV[cid(i, j, k - 1)], CV[cid(i, j, k)], CV[cid(i - 1, j, k)]);
    if (s0 !== (F[id(i, j, k + 1)] < 0)) quad(CV[cid(i - 1, j - 1, k)], CV[cid(i, j - 1, k)], CV[cid(i, j, k)], CV[cid(i - 1, j, k)]);
  }
  return { P, T };
}

// quadric edge-collapse decimation (fine surface-nets mesh -> the triangle budget); collapsed vertices are projected back onto the SDF
function rigDecimate(M, P, T, target, h, lab) {
  const nv = P.length / 3, nf = T.length / 3, Fa = new Int32Array(T), alive = new Uint8Array(nf).fill(1), va = new Uint8Array(nv).fill(1), stamp = new Uint32Array(nv), Qd = new Float64Array(nv * 10);
  const vf = Array.from({ length: nv }, () => new Set());
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[Fa[f * 3 + k]].add(f);
  const fn = (f, out) => { const a = Fa[f * 3] * 3, b = Fa[f * 3 + 1] * 3, c = Fa[f * 3 + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    let x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx; const l = Math.hypot(x, y, z); if (l < 1e-14) return 0; out[0] = x / l; out[1] = y / l; out[2] = z / l; out[3] = -(out[0] * P[a] + out[1] * P[a + 1] + out[2] * P[a + 2]); return l; };
  const pl = [0, 0, 0, 0];
  for (let f = 0; f < nf; f++) { const ar = fn(f, pl); if (!ar) continue; const [a, b, c, d] = pl, q = [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
    for (let k = 0; k < 3; k++) { const o = Fa[f * 3 + k] * 10; for (let i = 0; i < 10; i++) Qd[o + i] += q[i] * ar; } }
  const qerr = (o1, o2, x, y, z) => { const q = (i) => Qd[o1 + i] + Qd[o2 + i];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9); };
  const H = []; // binary heap [cost, a, b, sa, sb, x, y, z]
  const push = (e) => { H.push(e); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
  const edge = (a, b) => { const A = a * 3, B = b * 3, cand = [[P[A], P[A + 1], P[A + 2]], [P[B], P[B + 1], P[B + 2]], [(P[A] + P[B]) / 2, (P[A + 1] + P[B + 1]) / 2, (P[A + 2] + P[B + 2]) / 2]];
    let best = null, bc = 1e18; for (const c of cand) { const e = qerr(a * 10, b * 10, c[0], c[1], c[2]); if (e < bc) { bc = e; best = c; } }
    const len2 = (P[A] - P[B]) ** 2 + (P[A + 1] - P[B + 1]) ** 2 + (P[A + 2] - P[B + 2]) ** 2; push([bc + len2 * 1e-4, a, b, stamp[a], stamp[b], best[0], best[1], best[2]]); };
  const nbr = (v) => { const s = new Set(); for (const f of vf[v]) for (let k = 0; k < 3; k++) s.add(Fa[f * 3 + k]); s.delete(v); return s; };
  for (let v = 0; v < nv; v++) for (const n of nbr(v)) if (n > v) edge(v, n);
  let live = nf; const n0 = [0, 0, 0, 0], n1 = [0, 0, 0, 0];
  while (live > target && H.length) {
    const [, a, b, sa, sb, x, y, z] = pop(); if (!va[a] || !va[b] || stamp[a] !== sa || stamp[b] !== sb) continue;
    if (lab[a] !== lab[b]) continue; // colour borders keep their fine edges
    const Na = nbr(a), Nb = nbr(b); if (!Na.has(b)) continue; let common = 0; for (const n of Na) if (Nb.has(n)) common++; if (common !== 2) continue;
    // reject collapses that flip a face
    const ox = P[a * 3], oy = P[a * 3 + 1], oz = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2]; let ok = true;
    for (const v of [a, b]) for (const f of vf[v]) { const has = (Fa[f * 3] === a || Fa[f * 3 + 1] === a || Fa[f * 3 + 2] === a) && (Fa[f * 3] === b || Fa[f * 3 + 1] === b || Fa[f * 3 + 2] === b); if (has) continue;
      if (!fn(f, n0)) continue; P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; const l = fn(f, n1); P[a * 3] = ox; P[a * 3 + 1] = oy; P[a * 3 + 2] = oz; P[b * 3] = bx; P[b * 3 + 1] = by; P[b * 3 + 2] = bz;
      if (!l || n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < 0.3) { ok = false; break; } if (!ok) break; }
    if (!ok) continue;
    P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z;
    for (const f of [...vf[b]]) { const has = Fa[f * 3] === a || Fa[f * 3 + 1] === a || Fa[f * 3 + 2] === a;
      if (has) { alive[f] = 0; live--; for (let k = 0; k < 3; k++) vf[Fa[f * 3 + k]].delete(f); }
      else { for (let k = 0; k < 3; k++) if (Fa[f * 3 + k] === b) Fa[f * 3 + k] = a; vf[a].add(f); } }
    vf[b].clear(); va[b] = 0; for (let i = 0; i < 10; i++) Qd[a * 10 + i] += Qd[b * 10 + i]; stamp[a]++;
    for (const n of nbr(a)) edge(a, n);
  }
  // compact + re-project onto the surface
  const map = new Int32Array(nv).fill(-1), P2 = [], T2 = [], L2 = [];
  for (let f = 0; f < nf; f++) if (alive[f]) for (let k = 0; k < 3; k++) { const v = Fa[f * 3 + k]; if (map[v] < 0) { map[v] = P2.length / 3; P2.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); L2.push(lab[v]); } T2.push(map[v]); }
  const e = h * 0.25;
  for (let q = 0; q < P2.length; q += 3) { const x = P2[q], y = P2[q + 1], z = P2[q + 2], f = rigSdf(M, x, y, z), g = rigGrad(M, x, y, z, e); const s = clamp(f, -h, h); P2[q] -= g[0] * s; P2[q + 1] -= g[1] * s; P2[q + 2] -= g[2] * s; }
  return { P: P2, T: T2, L: L2 };
}
function rigGrad(M, x, y, z, e) {
  const gx = rigSdf(M, x + e, y, z) - rigSdf(M, x - e, y, z), gy = rigSdf(M, x, y + e, z) - rigSdf(M, x, y - e, z), gz = rigSdf(M, x, y, z + e) - rigSdf(M, x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
// the solids nearest a point (raw distances) -> colour + weights
function rigNear(M, x, y, z) { let best = null, bd = 1e9; const ds = []; for (const s of M.solids) { const di = rigSolidD(s, x, y, z); ds.push(di); if (di < bd) { bd = di; best = s; } } return { best, bd, ds }; }
function rigColour(M, x, y, z) {
  const { best } = rigNear(M, x, y, z); let col = best.col;
  for (const p of M.paints) if ((!p.on || p.on.includes(best.b)) && rigPaintIn(p, x, y, z)) col = p.col;
  return col;
}
// ray from outside along -dir onto the surface (props that sit on the body)
function rigOnSurf(M, p, dir, off) {
  const D = new THREE.Vector3().fromArray(dir).normalize(), q = p.clone().addScaledVector(D, 1.2 * M.d.s); let t = 0, prev = rigSdf(M, q.x, q.y, q.z);
  for (let i = 0; i < 200 && t < 2.4 * M.d.s; i++) { const step = Math.max(0.004, Math.abs(prev) * 0.8); t += step; const x = q.x - D.x * t, y = q.y - D.y * t, z = q.z - D.z * t, f = rigSdf(M, x, y, z); if (f < 0) { t -= step * 0.5; break; } prev = f; }
  return q.addScaledVector(D, -t).addScaledVector(D, off);
}
// ---------- build the merged, weighted geometry ----------
function rigGeometry(d, spec, h, blend, target) {
  const t0 = performance.now(), M = rigModel(d, spec), fine = rigMesh(M, h);
  fine.L = []; for (let v = 0; v < fine.P.length; v += 3) fine.L.push(rigColour(M, fine.P[v], fine.P[v + 1], fine.P[v + 2]));
  const { P, T, L } = target && fine.T.length / 3 > target ? rigDecimate(M, fine.P, fine.T, target, h, fine.L) : fine;
  { // smooth the colour borders: border vertices relax toward their border neighbours (3 passes), then back onto the surface
    const nvb = P.length / 3, nb = Array.from({ length: nvb }, () => new Set());
    for (let f = 0; f < T.length; f += 3) for (let k = 0; k < 3; k++) { nb[T[f + k]].add(T[f + (k + 1) % 3]); nb[T[f + k]].add(T[f + (k + 2) % 3]); }
    const border = (v) => { for (const n of nb[v]) if (L[n] !== L[v]) return true; return false; }, B = []; for (let v = 0; v < nvb; v++) if (border(v)) B.push(v);
    const isB = new Uint8Array(nvb); for (const v of B) isB[v] = 1;
    for (let it = 0; it < 3; it++) { const np = [];
      for (const v of B) { let x = 0, y = 0, z = 0, n = 0; for (const u of nb[v]) if (isB[u]) { x += P[u * 3]; y += P[u * 3 + 1]; z += P[u * 3 + 2]; n++; } np.push(n ? [P[v * 3] * 0.5 + x / n * 0.5, P[v * 3 + 1] * 0.5 + y / n * 0.5, P[v * 3 + 2] * 0.5 + z / n * 0.5] : null); }
      B.forEach((v, i) => { const q = np[i]; if (!q) return; const f = rigSdf(M, q[0], q[1], q[2]), g = rigGrad(M, q[0], q[1], q[2], h * 0.25); P[v * 3] = q[0] - g[0] * f; P[v * 3 + 1] = q[1] - g[1] * f; P[v * 3 + 2] = q[2] - g[2] * f; }); }
  }
  const bi = new Map(M.S.bones.map((b, i) => [b.name, i]));
  const nv0 = P.length / 3, nrm = new Float32Array(nv0 * 3), SI = new Uint16Array(nv0 * 4), SW = new Float32Array(nv0 * 4);
  for (let v = 0; v < nv0; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], g = rigGrad(M, x, y, z, h * 0.35); nrm.set(g, v * 3);
    const { best, bd, ds } = rigNear(M, x, y, z), acc = new Map();
    if (best.rigid) acc.set(best.b, 1);
    else M.solids.forEach((s, i) => { if (s.rigid && s !== best && ds[i] > bd + blend * 0.5) return; const w = Math.exp(-(ds[i] - bd) / blend); if (w > 0.01) acc.set(s.b, (acc.get(s.b) || 0) + w); });
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, b) => a + b[1], 0);
    top.forEach(([b, w], k) => { SI[v * 4 + k] = bi.get(b); SW[v * 4 + k] = w / sum; });
  }
  // orientation + flat colour per face; vertices split where colours meet
  const pal = [], palI = new Map(), colOf = (c) => { if (!palI.has(c)) { palI.set(c, pal.length); pal.push(new THREE.Color(c)); } return palI.get(c); };
  const OUT = { p: [], n: [], o: [], c: [], si: [], sw: [] }, IDX = [], remap = new Map();
  const vtx = (v, ci) => { const key = v * 256 + ci; let r = remap.get(key); if (r !== undefined) return r; r = OUT.p.length / 3; remap.set(key, r);
    OUT.p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); OUT.n.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); OUT.o.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
    const c = pal[ci]; OUT.c.push(c.r, c.g, c.b); for (let k = 0; k < 4; k++) { OUT.si.push(SI[v * 4 + k]); OUT.sw.push(SW[v * 4 + k]); } return r; };
  for (let f = 0; f < T.length; f += 3) {
    let a = T[f], b = T[f + 1], c = T[f + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, wx = P[c * 3] - ax, wy = P[c * 3 + 1] - ay, wz = P[c * 3 + 2] - az;
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx; if (fx * fx + fy * fy + fz * fz < 1e-14) continue;
    const gx = nrm[a * 3] + nrm[b * 3] + nrm[c * 3], gy = nrm[a * 3 + 1] + nrm[b * 3 + 1] + nrm[c * 3 + 1], gz = nrm[a * 3 + 2] + nrm[b * 3 + 2] + nrm[c * 3 + 2];
    if (fx * gx + fy * gy + fz * gz < 0) { const t = b; b = c; c = t; }
    const la = L[a], lb = L[b], lc = L[c], ci = colOf(la === lb || la === lc ? la : lb === lc ? lb : rigColour(M, (ax + P[b * 3] + P[c * 3]) / 3, (ay + P[b * 3 + 1] + P[c * 3 + 1]) / 3, (az + P[b * 3 + 2] + P[c * 3 + 2]) / 3));
    IDX.push(vtx(a, ci), vtx(b, ci), vtx(c, ci));
  }
  const bodyTris = IDX.length / 3;
  // rigid props (low poly), outlined ones first so the hull can draw a prefix of the index
  const IDX2 = [], olAcc = M.acc.filter((a) => a.ol), noAcc = M.acc.filter((a) => !a.ol);
  for (const [list, into] of [[olAcc, IDX], [noAcc, IDX2]]) for (const a of list) {
    const g = a.geo.index ? a.geo : a.geo; bakeColor(g, a.col); addOdir(g);
    const L = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(a.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(a.rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
    const Wm = M.W[a.bone].clone().multiply(L);
    if (a.surf) { const p0 = new THREE.Vector3().setFromMatrixPosition(Wm), dirR = new THREE.Vector3().fromArray(a.surf).transformDirection(M.W[a.bone]); const ps = rigOnSurf(M, p0, dirR.toArray(), a.surf[3] || 0); Wm.setPosition(ps); }
    const N3 = new THREE.Matrix3().getNormalMatrix(Wm), O3 = new THREE.Matrix3().setFromMatrix4(Wm), A = g.attributes, base = OUT.p.length / 3, b = bi.get(a.bone);
    for (let i = 0; i < A.position.count; i++) {
      _rq.fromBufferAttribute(A.position, i).applyMatrix4(Wm); OUT.p.push(_rq.x, _rq.y, _rq.z);
      _rq.fromBufferAttribute(A.normal, i).applyMatrix3(N3).normalize(); OUT.n.push(_rq.x, _rq.y, _rq.z);
      _rq.fromBufferAttribute(A.odir, i).applyMatrix3(O3); OUT.o.push(_rq.x, _rq.y, _rq.z);
      OUT.c.push(A.color.getX(i), A.color.getY(i), A.color.getZ(i)); OUT.si.push(b, 0, 0, 0); OUT.sw.push(1, 0, 0, 0);
    }
    if (g.index) for (let j = 0; j < g.index.count; j++) into.push(g.index.getX(j) + base); else for (let j = 0; j < A.position.count; j++) into.push(j + base);
    g.dispose();
  }
  const nOl = IDX.length; IDX.push(...IDX2);
  const G = new THREE.BufferGeometry(), nv = OUT.p.length / 3;
  G.setAttribute('position', new THREE.Float32BufferAttribute(OUT.p, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(OUT.n, 3));
  G.setAttribute('color', new THREE.Float32BufferAttribute(OUT.c, 3)); G.setAttribute('odir', new THREE.Float32BufferAttribute(OUT.o, 3));
  G.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(OUT.si, 4)); G.setAttribute('skinWeight', new THREE.Float32BufferAttribute(OUT.sw, 4));
  G.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(IDX, 1) : new THREE.Uint16BufferAttribute(IDX, 1));
  const GO = new THREE.BufferGeometry(); for (const k of ['position', 'odir', 'skinIndex', 'skinWeight']) GO.setAttribute(k, G.attributes[k]); GO.setIndex(new THREE.BufferAttribute(G.index.array.slice(0, nOl), 1));
  return { G, GO, stats: { tris: IDX.length / 3, fineTris: fine.T.length / 3, bodyTris, propTris: IDX.length / 3 - bodyTris, verts: nv, ms: Math.round(performance.now() - t0), h } };
}
// weighted-skinning ink hull (same uniforms / fragment as OUT_CHAR)
let RIG_OL = null;
function rigOutlineMat() {
  if (RIG_OL) return RIG_OL;
  RIG_OL = new THREE.ShaderMaterial({ uniforms: OUT_CHAR.uniforms, fragmentShader: OUT_CHAR.fragmentShader, side: THREE.BackSide,
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec3 p = position; vec3 od = odir;
        #ifdef USE_SKINNING
          mat4 sm = skinWeight.x * getBoneMatrix(skinIndex.x) + skinWeight.y * getBoneMatrix(skinIndex.y) + skinWeight.z * getBoneMatrix(skinIndex.z) + skinWeight.w * getBoneMatrix(skinIndex.w);
          sm = bindMatrixInverse * sm * bindMatrix; p = (sm * vec4(position, 1.0)).xyz; od = mat3(sm) * odir;
        #endif
        vec4 wp = modelMatrix * vec4(p, 1.0); vec3 wd = mat3(modelMatrix) * od;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }` });
  return RIG_OL;
}
// one instance: fresh bones + a SkinnedMesh / hull sharing the cached geometry
function rigInstance(kind, d, spec, h, blend, sphere, target) {
  let C = RIGS.cache[kind]; if (!C) { C = RIGS.cache[kind] = rigGeometry(d, spec, h, blend, target); RIGS.stats[kind] = C.stats; }
  const J = rigSkeleton(d); J.kind = 'hero'; J.rig = kind; J.tails = []; J.mat = toonMat();
  for (const [k, r] of Object.entries(RIG_BIND)) J[k].rotation.fromArray(r);
  const mesh = new THREE.SkinnedMesh(C.G, J.mat), ol = new THREE.SkinnedMesh(C.GO, rigOutlineMat());
  J.root.add(mesh); J.root.add(ol); J.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(J.bones); mesh.bind(skel, mesh.matrixWorld); ol.bind(skel, ol.matrixWorld);
  for (const k of Object.keys(RIG_BIND)) J[k].rotation.set(0, 0, 0);
  for (const m of [mesh, ol]) { m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, sphere[0], 0), sphere[1]); }
  mesh.castShadow = true; mesh.receiveShadow = false; ol.castShadow = false; ol.visible = QUAL.hd; QUAL.outlines.push(ol);
  J.merged = [mesh, ol]; J.mesh = mesh; J.hull = ol;
  return J;
}

// ---------- the characters ----------
const RG = { // low-poly prop geometry
  sph: (rx, ry, rz, w = 8, hh = 6) => new THREE.SphereGeometry(1, w, hh).scale(rx, ry, rz),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s, 1),
  tor: (R, r, arc = TAU, rs = 5, ts = 12) => new THREE.TorusGeometry(R, r, rs, ts, arc),
};
function rigToadSpec(W) { // HAROLD (W = false) / MAVIS (W = true): same dimensions as the part-stack rigs they replace
  return ({ E, C, K, PE, PB, A }, d) => {
    const SK = W ? '#7f8f3e' : '#6f7f34', SK2 = W ? '#c4c08a' : '#b8b47a', WART = W ? '#66752c' : '#58682a', TOP = W ? '#5f73b0' : '#7a5232', LEGC = W ? SK : '#5a5248', SHOE = W ? '#6a2a3a' : '#3a2a1e';
    // trunk
    if (W) { E('hips', [0, 0.04, 0], [0.26, 0.16, 0.22], TOP); K('hips', [0, -0.2, 0], 0.28, 0.42, 0.25, TOP, { rigid: true }); }
    else E('hips', [0, 0.02, 0], [0.27, 0.18, 0.23], LEGC);
    E('torso', [0, 0.13, -0.01], [0.31, 0.25, 0.27], TOP); E('chest', [0, 0.0, -0.02], [0.34, 0.33, 0.3], TOP);
    // head: wide flat toad head, pale throat on the jaw, eye bulges
    E('head', [0, 0.16, 0.03], [0.33, 0.21, 0.3], SK); E('head', [0, -0.03, 0.13], [0.29, 0.12, 0.25], SK2, { b: 'jaw', k: 0.05 });
    for (const s of [-1, 1]) E('head', [s * 0.14, 0.3, 0.13], [0.105, 0.1, 0.1], SK, { k: 0.04 });
    if (W) { E('head', [0, 0.5, -0.2], [0.44, 0.38, 0.38], '#c8c6c2', { rigid: true, k: 0.06 }); // the grey afro: one cloud + curls
      let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 16; i++) { const a = r() * TAU, e = r() * 1.4 - 0.25, R = 0.36; E('head', [Math.cos(a) * Math.cos(e) * R * 1.05, 0.5 + Math.sin(e) * R, -0.2 + Math.sin(a) * Math.cos(e) * R], [0.13, 0.12, 0.13], '#c8c6c2', { rigid: true, k: 0.07 }); }
      for (let i = 0; i < 9; i++) { const a = r() * TAU, e = r() * 1.2; PE('head', [Math.cos(a) * Math.cos(e) * 0.45, 0.5 + Math.sin(e) * 0.42, -0.2 + Math.sin(a) * Math.cos(e) * 0.42], [0.07, 0.07, 0.07], '#a6a39d'); }
    }
    // arms (sleeve / skin by solid), webbed mitt hands on the wrist + finger bones
    for (const k of ['L', 'R']) {
      E('sh' + k, [0, 0, 0], [0.12, 0.12, 0.12], TOP); C('sh' + k, [0, 0, 0], [0, -d.upper, 0], 0.095, 0.085, TOP, { b: 'sh' + k });
      C('el' + k, [0, 0, 0], [0, -d.fore + 0.03, 0], 0.08, 0.072, W ? SK : TOP);
      E('ha' + k, [0, -0.035, 0.01], [0.09, 0.05, 0.09], SK, { k: 0.03 }); E('fg' + k, [0, -0.01, 0.03], [0.085, 0.045, 0.08], SK, { k: 0.03 });
      if (!W) PB('el' + k, [0, -d.fore + 0.045, 0], [0.12, 0.03, 0.12], '#5e3e24', { on: ['el' + k] });
      // legs: slacks / bare toad legs, shoes (rigid heel + toe)
      C('lg' + k, [0, 0.02, 0], [0, -d.thigh, 0], 0.12, 0.105, LEGC); C('kn' + k, [0, 0, 0], [0, -d.shin + 0.04, 0], 0.102, 0.09, LEGC);
      E('ft' + k, [0, -0.03, 0.0], [0.12, 0.07, 0.12], SHOE, { k: 0.02, rigid: true }); E('toe' + k, [0, 0, 0.05], [0.13, 0.066, 0.11], SHOE, { k: 0.02, rigid: true });
      if (!W) PB('kn' + k, [0, -d.shin + 0.06, 0], [0.2, 0.025, 0.2], '#4a4238', { on: ['kn' + k] });
    }
    // paint: shirt front, belt / dress print
    if (!W) { PE('chest', [0, 0.0, 0.24], [0.15, 0.28, 0.14], '#d8cfb4'); PB('hips', [0, 0.12, 0], [0.4, 0.03, 0.4], '#2a2018', { on: ['hips', 'torso'] }); }
    else { let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const FL = ['#f08ab0', '#fff0f4', '#f0a0c8', '#ffffff'];
      for (let i = 0; i < 22; i++) { const a = r() * TAU, y = -0.44 + r() * 0.46, rr = lerp(0.42, 0.25, (y + 0.48) / 0.56); PE('hips', [Math.cos(a) * rr, y, Math.sin(a) * rr], [0.065, 0.065, 0.065], FL[i % 4], { on: ['hips'] }); }
      for (let i = 0; i < 14; i++) { const a = r() * TAU, y = -0.25 + r() * 0.5; PE('chest', [Math.cos(a) * 0.33, y, Math.sin(a) * 0.29], [0.06, 0.06, 0.06], FL[i % 4], { on: ['chest', 'torso'] }); } }
    // face props
    const MO = W ? '#9a3050' : '#2a1a14';
    A('head', RG.box(0.42, 0.024, 0.04), MO, [0, 0.115, 0.3], { outline: false, surf: [0, 0, 1, -0.005] });
    for (const s of [-1, 1]) {
      A('head', RG.box(0.06, 0.024, 0.04), MO, [s * 0.225, 0.1, 0.26], { rot: [0, s * 0.5, s * -0.35], outline: false });
      A('head', RG.sph(0.075, 0.07, 0.05), '#e8d888', [s * 0.14, 0.32, 0.205]); A('head', RG.box(0.075, 0.026, 0.02), '#121010', [s * 0.14, 0.32, 0.252], { outline: false });
      A('head', RG.box(0.11, 0.028, 0.035), SK, [s * 0.14, 0.375, 0.2], { rot: [0.5, 0, 0] });
      if (!W) { A('head', RG.tor(0.085, 0.013, TAU, 4, 12), '#1a1410', [s * 0.14, 0.32, 0.27], { outline: false }); A('head', RG.box(0.015, 0.015, 0.26), '#1a1410', [s * 0.235, 0.33, 0.14], { outline: false }); }
      else A('head', RG.box(0.1, 0.02, 0.02), '#121010', [s * 0.15, 0.395, 0.23], { rot: [0, 0, s * -0.3], outline: false });
      A('head', RG.sph(0.03, 0.02, 0.02, 5, 4), WART, [s * 0.24, 0.2, 0.16], { outline: false, surf: [s * 0.6, 0.3, 0.7, -0.008] });
    }
    if (!W) { A('head', RG.box(0.1, 0.015, 0.015), '#1a1410', [0, 0.33, 0.28], { outline: false }); A('head', RG.sph(0.03, 0.02, 0.025, 5, 4), WART, [0.05, 0.36, 0.0], { outline: false, surf: [0, 1, 0, -0.008] });
      // cardigan edges, pockets, buttons, collar (sit on the chest surface)
      for (const s of [-1, 1]) { A('chest', RG.box(0.06, 0.46, 0.04), '#5e3e24', [s * 0.13, 0.0, 0.2], { rot: [0.12, 0, 0], surf: [0, 0, 1, 0.0] }); A('torso', RG.box(0.11, 0.09, 0.04), '#5e3e24', [s * 0.2, 0.1, 0.2], { surf: [0, 0, 1, 0.0] }); }
      for (const y of [0.13, 0.02, -0.1]) A('chest', RG.box(0.03, 0.03, 0.03), '#e8d8a8', [-0.13, y, 0.25], { outline: false, surf: [0, 0, 1, 0.012] });
      A('chest', RG.box(0.16, 0.05, 0.06), '#5e3e24', [0, 0.3, 0.14], { surf: [0, 0.4, 1, -0.01] });
      for (const [x, y, z] of [[0.14, 0.12, -0.27], [-0.1, -0.02, -0.29], [0.04, 0.14, -0.28]]) A('chest', RG.sph(0.035, 0.03, 0.03, 5, 4), '#5e3e24', [x, y, z], { outline: false, surf: [0, 0, -1, -0.01] });
    } else { // lace collar + pearls, gold bangle
      A('chest', RG.cyl(0.17, 0.2, 0.06, 12), '#efe8dc', [0, 0.3, 0.02]);
      for (let k = -5; k <= 5; k++) { const a = k * 0.27; A('chest', RG.sph(0.034, 0.034, 0.034, 6, 4), '#f6f2ea', [Math.sin(a) * 0.21, 0.27 - Math.abs(k) * 0.012, Math.cos(a) * 0.21], { outline: false, surf: [Math.sin(a), 0.25, Math.cos(a), 0.02] }); }
      A('elL', RG.cyl(0.088, 0.088, 0.04, 10), '#c8a040', [0, -d.fore + 0.06, 0], { outline: false });
    }
    // props on the prop bones
    if (!W) { // the wooden walking cane (identical placement to the old rig: tip at swR (0, 0.63, 0))
      A('swR', RG.cyl(0.024, 0.026, 0.66, 6), '#7a4a22', [0, 0.3, 0]); A('swR', RG.tor(0.07, 0.022, Math.PI, 4, 8), '#6a3e1c', [0.07, -0.04, 0], { rot: [0, 0, Math.PI] });
      A('swR', RG.cyl(0.032, 0.032, 0.06, 6), '#1a1a1a', [0, 0.63, 0], { outline: false });
    } else { // the handbag on its own swing bone
      A('purse', RG.box(0.03, 0.3, 0.02), '#3a1a1a', [0, 0.14, 0], { outline: false }); A('purse', RG.box(0.32, 0.25, 0.13), '#6a1f3a', [0, 0.4, 0]);
      A('purse', RG.box(0.33, 0.04, 0.14), '#4a1428', [0, 0.52, 0]); A('purse', RG.box(0.06, 0.05, 0.03), '#c8a040', [0, 0.5, 0.08], { outline: false });
    }
  };
}
function rigBrewSpec() { // the ONE-EYED BREWMASTER: round head, one big monocled eye + one squint, handlebar mustache, a single curl, vest + apron + bow tie
  return ({ E, C, PE, PB, A }, d) => {
    const NAVY = '#2a2e48', VEST = '#b0562a', WHITE = '#f4f0e6', SKIN = '#f2c49a', SHOE = '#141018', HAIR = '#3a2210';
    E('hips', [0, 0.06, 0], [0.5, 0.3, 0.42], NAVY);
    E('torso', [0, 0.38, 0.02], [0.66, 0.62, 0.56], VEST, { k: 0.08 }); E('chest', [0, 0.2, -0.04], [0.6, 0.46, 0.5], VEST, { k: 0.08 });
    E('head', [0, 0.04, 0.04], [0.6, 0.6, 0.6], SKIN, { k: 0.08 });
    for (const s of [-1, 1]) E('head', [s * 0.6, 0.04, 0.04], [0.1, 0.14, 0.1], '#e8b088', { k: 0.05 });
    E('head', [0, -0.04, 0.64], [0.15, 0.15, 0.15], '#e89a7a', { k: 0.05 }); // bulb nose
    for (const k of ['L', 'R']) {
      E('sh' + k, [0, 0, 0], [0.22, 0.22, 0.22], WHITE); C('sh' + k, [0, 0, 0], [0, -d.upper, 0], 0.17, 0.15, WHITE);
      C('el' + k, [0, 0, 0], [0, -d.fore + 0.04, 0], 0.15, 0.13, SKIN); E('ha' + k, [0, -0.06, 0.02], [0.15, 0.1, 0.15], SKIN, { k: 0.04 }); E('fg' + k, [0, -0.02, 0.04], [0.14, 0.09, 0.13], SKIN, { k: 0.04 });
      PB('el' + k, [0, -0.03, 0], [0.22, 0.06, 0.22], '#e4ded2', { on: ['el' + k, 'sh' + k] }); // rolled sleeve
      C('lg' + k, [0, 0.03, 0], [0, -d.thigh, 0], 0.21, 0.19, NAVY); C('kn' + k, [0, 0, 0], [0, -d.shin + 0.06, 0], 0.19, 0.17, NAVY);
      E('ft' + k, [0, -0.03, 0.0], [0.17, 0.1, 0.17], SHOE, { rigid: true, k: 0.03 }); E('toe' + k, [0, 0, 0.06], [0.17, 0.09, 0.15], SHOE, { rigid: true, k: 0.03 });
    }
    // paint: shirt front between the vest panels, leather apron + pocket + top band, belt (trunk only)
    const TR = ['torso', 'chest', 'hips'];
    PB('torso', [0, -0.06, 0], [0.9, 0.05, 0.9], '#3a2a1a', { on: TR });
    PE('chest', [0, 0.12, 0.5], [0.22, 0.6, 0.35], WHITE, { on: TR }); PE('torso', [0, 0.5, 0.55], [0.2, 0.4, 0.3], WHITE, { on: TR });
    PB('torso', [0, 0.0, 0.62], [0.36, 0.5, 0.42], '#6a4428', { on: TR }); PB('torso', [0, 0.5, 0.62], [0.33, 0.035, 0.42], '#4a2e1a', { on: TR }); PB('torso', [0, -0.06, 0.7], [0.15, 0.11, 0.3], '#5a3a22', { on: TR });
    // face
    A('head', RG.sph(0.17, 0.17, 0.12, 10, 8), '#ffffff', [-0.22, 0.17, 0.5], { surf: [0, 0, 1, -0.02] }); A('head', RG.sph(0.085, 0.085, 0.05, 8, 6), '#14101f', [-0.21, 0.17, 0.62], { outline: false, surf: [0, 0, 1, 0.06] });
    A('head', RG.sph(0.03, 0.03, 0.02, 5, 4), '#ffffff', [-0.18, 0.21, 0.64], { outline: false, surf: [0, 0, 1, 0.08] });
    A('monocle', RG.tor(0.19, 0.035, TAU, 5, 14), '#e8c070', [0, 0, 0.0]); A('monocle', RG.cyl(0.008, 0.008, 0.5, 4), '#e8c070', [-0.14, -0.23, -0.04], { rot: [0, 0, 0.5], outline: false });
    A('head', RG.box(0.22, 0.035, 0.05), '#5a3018', [0.22, 0.17, 0.5], { rot: [0, 0, -0.18], outline: false, surf: [0, 0, 1, 0.0] }); A('head', RG.box(0.24, 0.05, 0.05), '#4a2a16', [0.22, 0.3, 0.5], { rot: [0, 0, 0.12], surf: [0, 0, 1, 0.0] });
    A('head', RG.box(0.3, 0.07, 0.06), '#4a2a16', [-0.22, 0.42, 0.48], { rot: [0, 0, -0.1], surf: [0, 0.3, 1, 0.0] });
    A('head', RG.tor(0.12, 0.04, Math.PI * 1.6, 5, 10), HAIR, [0, 0.72, 0.05], { rot: [0, Math.PI / 2, 0.4] });
    A('head', RG.box(0.18, 0.04, 0.04), '#8a3a3a', [0, -0.3, 0.5], { outline: false, surf: [0, 0, 1, 0.0] });
    for (const s of [-1, 1]) { A('mustache', RG.cyl(0.07, 0.1, 0.42, 6), HAIR, [s * 0.2, 0, 0], { rot: [0, 0, s * 1.35] }); A('mustache', RG.tor(0.08, 0.035, Math.PI * 1.5, 4, 8), HAIR, [s * 0.42, 0.06, 0], { rot: [0, 0, s > 0 ? 0 : Math.PI] }); }
    A('chest', RG.box(0.34, 0.12, 0.08), '#2ab0a0', [0, 0.42, 0.4], { surf: [0, 0.25, 1, 0.02] }); A('chest', RG.sph(0.07, 0.07, 0.05, 6, 5), '#1a8a7a', [0, 0.42, 0.44], { surf: [0, 0.25, 1, 0.06] });
    for (const y of [0.24, 0.08]) A('chest', RG.sph(0.04, 0.04, 0.03, 6, 5), '#e8c070', [0.2, y, 0.4], { outline: false, surf: [0, 0, 1, 0.0] });
    // the mash paddle in his right hand (prop bone)
    A('swR', RG.cyl(0.05, 0.05, 1.45, 6), '#a07040', [0, 0.5, 0]); A('swR', RG.box(0.34, 0.55, 0.08), '#b8844a', [0, 1.42, 0]); A('swR', RG.box(0.36, 0.06, 0.1), '#7a5030', [0, 1.13, 0]);
  };
}
// grid steps tuned for the budgets (Harold / Mavis ~3-5k tris, Brewmaster ~2-3k)
const RIG_KINDS = {
  harold: () => [RIG_HERO_D, rigToadSpec(false), 0.034, 0.03, [0.95, 2.6], 3400],
  mavis: () => [RIG_HERO_D, rigToadSpec(true), 0.038, 0.03, [0.95, 2.6], 3500],
  brew: () => [RIG_BREW_D, rigBrewSpec(), 0.06, 0.07, [1.5, 3.6], 1900],
};
function rigBuild(kind) { const [d, spec, h, blend, sph, tgt] = RIG_KINDS[kind](); return rigInstance(kind, d, spec, h, blend, sph, tgt); }

// ---------- clips: keyframes authored in code, baked at 20 fps ----------
const RIG_FPS = 20;
const KP = (base, mods = {}) => { const p = blank(); if (base) for (const k in base) p[k] = Array.isArray(base[k]) ? base[k].slice() : base[k]; for (const k in mods) p[k] = Array.isArray(mods[k]) ? mods[k].slice() : mods[k]; return p; };
const rigStance = (wide, bend, mods) => { const p = blank(); legsStance(p, wide, bend); return KP(p, mods); };
const R_IDLE = rigStance(0.16, 0.42, { torso: [0.14, 0.32, 0], neck: [-0.1, -0.3, 0], hips: [0, -0.25, 0], shL: [-0.55, 0, 0.42], elL: [-1.1, 0, 0], haL: [0.15, 0, 0], swL: [Math.PI / 2 + 0.55, 0, 0.35],
  shR: [-0.25, 0, -0.3], elR: [-0.5, 0, 0], swR: [Math.PI - 0.25, 0, 0], fgL: [-0.35, 0, 0], fgR: [-0.8, 0, 0] });
function rigCycleKeys(n, fn) { const K = []; for (let i = 0; i <= n; i++) K.push([i / n, fn(i / n * TAU)]); return K; }
const RIG_CLIP_SRC = {
  idle: { dur: TAU / 3.2, loop: true, interp: 'cr', keys: [
    [0, KP(R_IDLE)], [0.25, KP(R_IDLE, { y: R_IDLE.y + 0.025, chest: [-0.035, 0, 0], neck: [-0.13, -0.3, 0], fgL: [-0.5, 0, 0] })],
    [0.5, KP(R_IDLE, { chest: [0, 0.02, 0] })], [0.75, KP(R_IDLE, { y: R_IDLE.y - 0.025, chest: [0.035, 0, 0], neck: [-0.07, -0.32, 0], jaw: [0.04, 0, 0], swR: [Math.PI - 0.2, 0, 0.04] })], [1, KP(R_IDLE)]] },
  walk: { dur: TAU / 7.5, loop: true, interp: 'cr', keys: rigCycleKeys(8, (ph) => { const p = blank(); runLegs(p, ph, 0.45); const s = Math.sin(ph);
    return KP(p, { torso: [0.2, s * 0.08, 0], chest: [0.03, -s * 0.08, 0], neck: [-0.15, -s * 0.06, 0], shL: [0.5 * s, 0, 0.25], elL: [-0.45, 0, 0], swL: [Math.PI / 2 + 0.6, 0, 0.3],
      shR: [-0.35 - 0.3 * s, 0, -0.28], elR: [-0.45, 0, 0], swR: [Math.PI - 0.45 + 0.25 * s, 0, 0], fgR: [-0.8, 0, 0], fgL: [-0.3, 0, 0], toeL: [Math.max(0, -Math.cos(ph)) * 0.45, 0, 0], toeR: [Math.max(0, Math.cos(ph)) * 0.45, 0, 0] }); }) },
  run: { dur: TAU / 12, loop: true, interp: 'cr', keys: rigCycleKeys(8, (ph) => { const p = blank(); runLegs(p, ph, 1); const s = Math.sin(ph);
    return KP(p, { torso: [0.42, s * 0.15, 0], chest: [0.05, -s * 0.1, 0], neck: [-0.32, -s * 0.12, 0], shL: [1.0, 0, 0.35], elL: [-0.35, 0, 0], swL: [Math.PI / 2 + 1.1, 0, 0.2],
      shR: [0.6, 0, -0.35], elR: [-0.5, 0, 0], swR: [Math.PI - 0.6, 0, 0], fgR: [-0.8, 0, 0], fgL: [-0.5, 0, 0], toeL: [Math.max(0, -Math.cos(ph)) * 0.6, 0, 0], toeR: [Math.max(0, Math.cos(ph)) * 0.6, 0, 0] }); }) },
};
{ // the cane combo (same timing as the old atk1-3: wind-up hold to u .12, sweep to u .45, follow-through)
  const L = { lgL: [-0.7, 0, 0.18], knL: [0.75, 0, 0], lgR: [0.35, 0, -0.18], knR: [0.3, 0, 0] }, Lm = { lgR: [-0.7, 0, -0.18], knR: [0.75, 0, 0], lgL: [0.35, 0, 0.18], knL: [0.3, 0, 0] };
  const a10 = rigStance(0.2, 0.55, Object.assign({ torso: [0.2, -0.85, 0], hips: [0, -0.4, 0], neck: [-0.1, 0.6, 0], chest: [0, -0.22, 0], shR: [-1.1, 0, -1.25], elR: [-0.7, 0, 0], swR: [Math.PI / 2, 0, -0.6], fgR: [-0.9, 0, 0],
    shL: [-0.4, 0, 0.5], elL: [-1.2, 0, 0], swL: [Math.PI / 2 + 0.6, 0, 0.3] }, L));
  const a11 = KP(a10, { torso: [0.2, 0.95, 0], hips: [0, 0.45, 0], neck: [-0.1, -0.6, 0], chest: [0, 0.28, 0], shR: [-1.45, 0, 0.55], elR: [-0.1, 0, 0], swR: [Math.PI / 2, 0, 0.3], jaw: [0.12, 0, 0] });
  RIG_CLIP_SRC.atk1 = { dur: 0.36, keys: [[0, a10], [0.12, KP(a10, { chest: [0, -0.3, 0] })], [0.45, a11], [0.62, KP(a11, { chest: [0, 0.34, 0], torso: [0.22, 1.0, 0] })], [1, KP(a11, { chest: [0, 0.12, 0], jaw: [0, 0, 0] })]] };
  const a20 = rigStance(0.2, 0.55, Object.assign({ torso: [0.2, 0.85, 0], hips: [0, 0.4, 0], neck: [-0.1, -0.6, 0], chest: [0, 0.22, 0], shL: [-1.1, 0, 1.25], elL: [-0.7, 0, 0], swL: [Math.PI / 2, 0, 0.6],
    shR: [-0.4, 0, -0.5], elR: [-1.2, 0, 0], swR: [Math.PI / 2 + 0.6, 0, -0.3], fgR: [-0.9, 0, 0] }, Lm));
  const a21 = KP(a20, { torso: [0.2, -0.95, 0], hips: [0, -0.45, 0], neck: [-0.1, 0.6, 0], chest: [0, -0.28, 0], shL: [-1.45, 0, -0.55], elL: [-0.1, 0, 0], swL: [Math.PI / 2, 0, -0.3], jaw: [0.12, 0, 0] });
  RIG_CLIP_SRC.atk2 = { dur: 0.36, keys: [[0, a20], [0.12, KP(a20, { chest: [0, 0.3, 0] })], [0.45, a21], [0.62, KP(a21, { chest: [0, -0.34, 0], torso: [0.22, -1.0, 0] })], [1, KP(a21, { chest: [0, -0.12, 0], jaw: [0, 0, 0] })]] };
  const w3 = rigStance(0.24, 0.35, { shL: [-0.8, 0, 0.3], shR: [-0.8, 0, -0.3], elL: [-1.3, 0, 0], elR: [-1.3, 0, 0], torso: [0.35, 0.6, 0], chest: [0.1, 0.25, 0], y: -0.15, fgR: [-0.9, 0, 0] });
  const s3 = (a, y) => rigStance(0.24, 0.35, { tilt: [0, -a * TAU, 0], y, lgL: [-0.9, 0, 0.1], knL: [1.4, 0, 0], lgR: [-0.2, 0, -0.15], knR: [0.6, 0, 0], shL: [-0.15, 0, 1.45], shR: [-0.15, 0, -1.45],
    elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], swL: [Math.PI / 2, 0, -0.2], swR: [Math.PI / 2, 0, 0.2], torso: [0.1, 0, 0], chest: [0, -0.15, 0], fgR: [-0.9, 0, 0], jaw: [0.15, 0, 0], toeL: [0.4, 0, 0], toeR: [0.3, 0, 0] });
  RIG_CLIP_SRC.atk3 = { dur: 0.6, keys: [[0, w3], [0.14, w3], [0.2, s3(0.03, 0.22)], [0.4, s3(0.5, 0.45)], [0.65, s3(1, 0.12)], [0.72, KP(s3(1, 0), { chest: [0.1, 0.1, 0] })], [1, KP(s3(1, 0), { chest: [0, 0, 0], jaw: [0, 0, 0], lgL: [-0.5, 0, 0.1], knL: [0.7, 0, 0] })]] };
}
{ // hit, knockdown, get-up, dodge roll, victory
  const h0 = rigStance(0.16, 0.5, { torso: [-0.45, 0.2, 0], neck: [-0.5, 0, 0], chest: [-0.22, 0, 0], jaw: [0.28, 0, 0], shL: [-0.8, 0, 0.9], shR: [-0.8, 0, -0.9], elL: [-0.7, 0, 0], elR: [-0.7, 0, 0],
    swL: [Math.PI / 2 + 0.8, 0, 0], swR: [Math.PI / 2 + 0.8, 0, 0], fgL: [0.4, 0, 0], fgR: [-0.6, 0, 0] });
  RIG_CLIP_SRC.hurt = { dur: 0.35, interp: 'lin', keys: [[0, h0], [0.3, KP(h0, { torso: [-0.3, 0.16, 0], neck: [-0.35, 0, 0], chest: [-0.1, 0, 0], jaw: [0.15, 0, 0] })], [1, KP(h0, { torso: [0, 0.2, 0], neck: [0, 0, 0], chest: [0, 0, 0], jaw: [0, 0, 0] })]] };
  const lie = KP(null, { tilt: [-Math.PI / 2 + 0.08, 0, 0], lgL: [-0.6, 0, 0.3], knL: [0.9, 0, 0], lgR: [-0.2, 0, -0.2], knR: [0.4, 0, 0], shL: [-2.6, 0, 0.6], shR: [-2.4, 0, -0.9], elL: [-0.4, 0, 0], elR: [-0.4, 0, 0],
    neck: [0.4, 0, 0], swL: [Math.PI / 2, 0, 0], swR: [Math.PI / 2, 0, 0], fgR: [-0.6, 0, 0], toeL: [0.3, 0, 0], toeR: [0.2, 0, 0], jaw: [0.2, 0, 0] });
  RIG_CLIP_SRC.knockdown = { dur: 0.45, keys: [[0, KP(h0, { y: 0 })], [0.45, KP(lie, { tilt: [-Math.PI / 2 * 0.62, 0, 0], shL: [-2.0, 0, 1.1], shR: [-2.0, 0, -1.2], lgL: [-0.9, 0, 0.3], knL: [1.1, 0, 0], chest: [-0.2, 0, 0] })],
    [0.8, KP(lie, { tilt: [-Math.PI / 2 - 0.05, 0, 0], chest: [0.1, 0, 0] })], [1, lie]] };
  const g = (k) => rigStance(0.2, 1.2 * (1 - k), { torso: [0.8 * (1 - k), 0, 0], neck: [-0.1 - 0.3 * (1 - k), -0.3 * k, 0], shL: [lerp(0.4, -0.55, k), 0, 0.42], elL: [lerp(-0.2, -1.1, k), 0, 0], shR: [lerp(0.3, -0.25, k), 0, -0.3], elR: [lerp(-0.2, -0.5, k), 0, 0],
    swL: [Math.PI / 2 + 0.55, 0, 0.35], swR: [Math.PI - 0.25, 0, 0], fgR: [-0.8, 0, 0], chest: [0.2 * (1 - k), 0, 0] });
  RIG_CLIP_SRC.getup = { dur: 0.45, keys: [[0, g(0)], [0.55, KP(g(0.5), { chest: [0.25, 0, 0] })], [1, g(1)]] };
  const tuck = (a, ty, y) => KP(null, { tilt: [a, 0, 0], ty, y, lgL: [-1.6, 0, 0.12], lgR: [-1.6, 0, -0.12], knL: [2.2, 0, 0], knR: [2.2, 0, 0], ftL: [0.4, 0, 0], ftR: [0.4, 0, 0], torso: [0.9, 0, 0], chest: [0.4, 0, 0], neck: [0.3, 0, 0],
    shL: [-1.2, 0, 0.3], shR: [-1.2, 0, -0.3], elL: [-1.6, 0, 0], elR: [-1.6, 0, 0], swL: [Math.PI / 2 + 1.2, 0, 0], swR: [Math.PI / 2 + 1.2, 0, 0], fgR: [-0.9, 0, 0] });
  RIG_CLIP_SRC.roll = { dur: 0.5, keys: [[0, rigStance(0.2, 1.0, { torso: [0.6, 0, 0], chest: [0.2, 0, 0], shL: [-0.8, 0, 0.4], shR: [-0.8, 0, -0.4], elL: [-1.0, 0, 0], elR: [-1.0, 0, 0], swR: [Math.PI / 2 + 0.6, 0, 0] })],
    [0.2, tuck(Math.PI * 0.45, 0.25, -0.2)], [0.5, tuck(Math.PI, 0.55, -0.25)], [0.78, tuck(Math.PI * 1.6, 0.3, -0.2)], [1, rigStance(0.2, 0.9, { tilt: [TAU, 0, 0], torso: [0.5, 0, 0], shL: [-0.6, 0, 0.5], shR: [-0.6, 0, -0.5], swR: [Math.PI / 2 + 0.6, 0, 0] })]] };
  const v = (y, wv, j) => KP(R_IDLE, { y: R_IDLE.y + y, shR: [-3.0, 0, -0.3], elR: [-0.2, 0, 0], swR: [Math.PI / 2 - 0.2, 0, 0], shL: [-2.6, 0, 0.5 + wv], elL: [-0.3, 0, 0], torso: [-0.05, 0.1, 0], chest: [-0.15, 0, 0], neck: [-0.25, 0, 0], jaw: [j, 0, 0], fgL: [0, 0, 0] });
  RIG_CLIP_SRC.victory = { dur: 1.0, loop: true, interp: 'cr', keys: [[0, v(0, 0, 0.1)], [0.25, v(0.17, 0.35, 0.3)], [0.5, v(0, 0, 0.1)], [0.75, v(0.17, -0.2, 0.3)], [1, v(0, 0, 0.1)]] };
  // MAVIS: the handbag swing (wind back, big flat swing, the bag lags on its own bone and whips through)
  const p0 = rigStance(0.2, 0.55, { torso: [0.15, -0.9, 0], hips: [0, -0.4, 0], chest: [0, -0.25, 0], neck: [-0.1, 0.65, 0], shR: [-1.0, 0, -1.35], elR: [-0.35, 0, 0], swR: [Math.PI / 2 + 0.3, 0, 0], purse: [0, 0, -0.35],
    shL: [-0.5, 0, 0.6], elL: [-1.1, 0, 0], lgL: [-0.7, 0, 0.18], knL: [0.75, 0, 0], lgR: [0.35, 0, -0.18], knR: [0.3, 0, 0] });
  const p1 = KP(p0, { torso: [0.22, 0.95, 0], hips: [0, 0.45, 0], chest: [0, 0.3, 0], neck: [-0.1, -0.6, 0], shR: [-1.5, 0, 0.6], elR: [-0.05, 0, 0], purse: [0, 0, 0.9], jaw: [0.2, 0, 0] });
  RIG_CLIP_SRC.purse = { dur: 0.5, keys: [[0, p0], [0.15, KP(p0, { purse: [0, 0, -0.6], chest: [0, -0.32, 0] })], [0.45, p1], [0.62, KP(p1, { purse: [0, 0, 1.5], chest: [0, 0.36, 0] })], [1, KP(p1, { purse: [0, 0, 0.3], chest: [0, 0.1, 0], jaw: [0, 0, 0] })]] };
  // BREWMASTER: can-tower slam, the spin, the mustache twirl
  const up = (k) => rigStance(0.2, 0.35, { shL: [-2.9 - k * 0.1, 0, 0.3], shR: [-2.9 - k * 0.1, 0, -0.3], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0], chest: [-0.25 - k * 0.08, 0, 0], torso: [-0.15, 0, 0], neck: [-0.3, 0, 0], jaw: [0.15 + k * 0.1, 0, 0], y: 0.02 + k * 0.03, fgL: [-0.6, 0, 0], fgR: [-0.6, 0, 0], swR: [Math.PI - 0.3, 0, 0] });
  const slam = rigStance(0.24, 0.95, { shL: [0.25, 0, 0.25], shR: [0.25, 0, -0.25], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0], torso: [0.55, 0, 0], chest: [0.3, 0, 0], neck: [-0.4, 0, 0], jaw: [0.35, 0, 0], fgL: [-1.0, 0, 0], fgR: [-1.0, 0, 0], swR: [Math.PI - 0.2, 0, 0] });
  RIG_CLIP_SRC.canslam = { dur: 1.2, keys: [[0, KP(R_IDLE)], [0.35, up(0)], [0.6, up(1)], [0.72, slam], [0.8, KP(slam, { y: slam.y - 0.04, chest: [0.36, 0, 0] })], [1, slam]] };
  const sp = (s) => rigStance(0.2, 0.3, { shL: [-0.2, 0, 1.45], shR: [-0.2, 0, -1.45], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], torso: [0.1, s * 0.15, 0], chest: [0, s * 0.12, 0], neck: [-0.1, -s * 0.2, 0], mustache: [0, 0, s * 0.35], jaw: [0.1, 0, 0],
    lgL: [-0.3 - 0.3 * s, 0, 0.15], lgR: [-0.3 + 0.3 * s, 0, -0.15], knL: [0.5 + 0.3 * s, 0, 0], knR: [0.5 - 0.3 * s, 0, 0], fgL: [0.2, 0, 0], fgR: [-0.6, 0, 0], swR: [Math.PI, 0, 0] });
  RIG_CLIP_SRC.spin = { dur: 0.5, loop: true, interp: 'cr', keys: [[0, sp(0)], [0.25, sp(1)], [0.5, sp(0)], [0.75, sp(-1)], [1, sp(0)]] };
  const tw = (s) => KP(R_IDLE, { shR: [-2.0, 0.35, -0.15], elR: [-2.0, 0, 0], haR: [0.2, 0, 0.3 * s], fgR: [-0.3 - 0.5 * (1 + s), 0, 0], shL: [0.15, 0, 0.75], elL: [-1.4, 0.6, 0], haL: [0.4, 0, 0], mustache: [0, 0, 0.12 + 0.45 * s], neck: [-0.15, 0.15, 0.12 * s], chest: [0, -0.06, 0.04 * s], swR: [Math.PI / 2, 0, 0] });
  RIG_CLIP_SRC.twirl = { dur: 0.8, loop: true, interp: 'cr', keys: [[0, tw(0)], [0.25, tw(1)], [0.5, tw(0)], [0.75, tw(-1)], [1, tw(0)]] };
}
// bake: every joint channel + y / ty at 20 fps
const RIG_CH = () => JOINTS.length * 3 + 2;
function rigBake(src) {
  const n = Math.max(2, Math.round(src.dur * RIG_FPS) + 1), C = RIG_CH(), out = new Float32Array(n * C), K = src.keys, flat = (p) => { const a = new Float32Array(C); JOINTS.forEach((j, i) => { const v = p[j] || [0, 0, 0]; a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; }); a[C - 2] = p.y || 0; a[C - 1] = p.ty || 0; return a; };
  const V = K.map(([, p]) => flat(p)), T = K.map(([t]) => t), cr = src.interp === 'cr', lin = src.interp === 'lin';
  for (let f = 0; f < n; f++) {
    const u = f / (n - 1); let s = 0; while (s < T.length - 2 && u > T[s + 1]) s++;
    const t = clamp((u - T[s]) / Math.max(1e-6, T[s + 1] - T[s]), 0, 1), w = lin ? t : ease(t);
    const a = V[s], b = V[s + 1], a0 = V[s > 0 ? s - 1 : src.loop ? T.length - 2 : s], b1 = V[s + 2 < T.length ? s + 2 : src.loop ? 1 : s + 1];
    for (let c = 0; c < C; c++) {
      if (cr) { const t2 = t * t, t3 = t2 * t; out[f * C + c] = 0.5 * (2 * a[c] + (-a0[c] + b[c]) * t + (2 * a0[c] - 5 * a[c] + 4 * b[c] - b1[c]) * t2 + (-a0[c] + 3 * a[c] - 3 * b[c] + b1[c]) * t3); }
      else out[f * C + c] = a[c] + (b[c] - a[c]) * w;
    }
  }
  return { n, C, F: out, loop: !!src.loop, dur: src.dur };
}
function rigClip(name) { let c = RIGS.clips[name]; if (!c) { const s = RIG_CLIP_SRC[name]; if (!s) return null; c = RIGS.clips[name] = rigBake(s); } return c; }
// sample a clip at u (0..1 through it; loops wrap) into a fresh pose (linear between the 20 fps frames)
function rigSample(name, u, into) {
  const c = rigClip(name), p = into || blank(); if (!c) return p;
  if (c.loop) u = u - Math.floor(u); else u = clamp(u, 0, 1);
  const x = u * (c.n - 1), f0 = Math.min(c.n - 1, Math.floor(x)), f1 = Math.min(c.n - 1, f0 + 1), t = x - f0, F = c.F, C = c.C, A = f0 * C, B = f1 * C;
  JOINTS.forEach((j, i) => { const k = i * 3; p[j] = [F[A + k] + (F[B + k] - F[A + k]) * t, F[A + k + 1] + (F[B + k + 1] - F[A + k + 1]) * t, F[A + k + 2] + (F[B + k + 2] - F[A + k + 2]) * t]; });
  p.y = F[A + C - 2] + (F[B + C - 2] - F[A + C - 2]) * t; p.ty = F[A + C - 1] + (F[B + C - 1] - F[A + C - 1]) * t; p.clip = name; p.u = u;
  return p;
}
function rigBlend(a, b, w) { for (const j of JOINTS) { const x = a[j], y = b[j]; a[j] = [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w]; } a.y += (b.y - a.y) * w; a.ty += (b.ty - a.ty) * w; return a; }

// ---------- swap in ----------
if (RIGS.on) {
  RIGS.legacy = Object.assign({}, HERO_POSES);
  HERO_POSES.idle = (t) => rigSample('idle', t / (TAU / 3.2));
  HERO_POSES.walk = (t) => rigSample('walk', t / (TAU / 7.5));
  HERO_POSES.run = (t, sp) => { const u = t * (7 + sp * 0.9) / TAU, w = clamp((sp - 2.2) / 3, 0, 1); const p = rigSample('walk', u); return w > 0 ? rigBlend(p, rigSample('run', u), w) : p; };
  for (const k of ['atk1', 'atk2', 'atk3', 'hurt', 'getup', 'roll', 'purse']) HERO_POSES[k] = (u) => rigSample(k, u);
  HERO_POSES.down = (u, ground) => { const p = rigSample('knockdown', ground ? 1 : clamp(u * 2.2, 0, 1)); p.ty = ground ? 0.3 : 0.6; return p; };
  HERO_POSES.victory = (t) => rigSample('victory', t);
  HERO_POSES.clip = (name, u) => rigSample(name, u);
  const _bh = buildHero;
  buildHero = (o = {}) => { try { return rigBuild(o.wife ? 'mavis' : 'harold'); } catch (e) { console.warn('rigs: fallback to the part-stack rig', e); RIGS.failed = String(e); return _bh(o); } };
  // the Brewmaster (09w RIG HOOK): built the first time his arena builds; animated by the clips through update()
  window.buildBrewmaster = function () {
    const J = rigBuild('brew'); J.kind = 'brew'; const R = { root: J.root, body: J.torso, head: J.head, armL: J.shL, armR: J.shR, mustache: J.mustache, paddle: J.swR, flash: [J.mat], J };
    J.mat.userData.flashC.value.set('#fff');
    const SY = 1.5; let ry = Math.PI;
    R.update = (dt, st, info) => {
      const t = info.t, u = clamp(info.u, 0, 1); let p, rate = 14, rootRY = Math.PI, glow = null; const mt = u * 1;
      switch (st) {
        case 'towerTell': p = rigSample('canslam', u * 0.62); glow = { c: '#ffd23c', v: 0.25 + 0.25 * (Math.sin(t * 22) * 0.5 + 0.5) }; break;
        case 'tower': p = rigSample('canslam', 0.62 + u * 0.38); rate = 26; break;
        case 'geyTell': p = rigSample('walk', t * 2.6); p.torso = [0.35, 0, 0]; p.shL = [-0.4, 0, 0.8]; p.shR = [-0.4, 0, -0.8]; p.y -= 0.1; R.root.position.y = Math.abs(Math.sin(t * 18)) * 0.08; glow = { c: '#fff6d8', v: 0.2 + 0.3 * (Math.sin(t * 18) * 0.5 + 0.5) }; break;
        case 'gey': p = rigSample('victory', t); break;
        case 'spinTell': p = rigSample('twirl', t / 0.8); rootRY = Math.PI + Math.sin(t * 14) * 0.25 * u; glow = { c: '#ff5fa2', v: 0.2 + 0.3 * u }; break;
        case 'spin': p = rigSample('spin', t / 0.5); rate = 22; break;
        case 'open': p = rigSample('hurt', 0.35); p.torso = [0.45 + Math.sin(t * 9) * 0.05, 0, 0]; p.shL = [0.4, 0, 0.3]; p.shR = [0.4, 0, -0.3]; rootRY = Math.PI + Math.sin(t * 5) * 0.25; break;
        case 'quaked': p = rigSample('hurt', 0); p.shL = [-2.4, 0, 0.4]; p.shR = [-2.4, 0, -0.4]; break;
        case 'haymaker': { const k = info.u * 3.0; p = rigSample('hurt', 0.2); // 09w: setM(st, 'haymaker', 3.0)
          if (k >= 0.9 && k < 1.9) { R.root.position.y = Math.sin(clamp((k - 0.9) / 1.0, 0, 1) * Math.PI * 0.5) * 2.6; p.shL = [-2.8, 0, 0.3]; p.shR = [-2.8, 0, -0.3]; p.torso = [-0.6, 0, 0]; }
          else if (k >= 1.9) { R.root.position.y = damp(R.root.position.y, 0, 6, dt); p.torso = [0.6, 0, 0]; } break; }
        default: p = rigSample('idle', t / (TAU / 3.2)); p.shR = [-0.5 + Math.sin(t * 4) * 0.2, 0, -0.2]; p.elR = [-0.6, 0, 0]; p.shL = [-0.9 + Math.sin(t * 4 + 1) * 0.25, 0, 0.3]; p.neck = [-0.1, 0, Math.sin(t * 5) * 0.08];
      }
      p.y *= SY; p.ty *= SY; applyPose(J, p, rate, dt, false);
      if (st !== 'spin') { const tgt = rootRY + Math.round((R.root.rotation.y - rootRY) / TAU) * TAU; R.root.rotation.y = damp(R.root.rotation.y, tgt, 10, dt); }
      if (glow && J.mat.userData.flash) { J.mat.userData.flashC.value.set(glow.c); J.mat.userData.flash.value = Math.max(J.mat.userData.flash.value, glow.v); }
      void mt; void ry;
    };
    return R;
  };
}

// ---------- test stage (?rigstage=harold|mavis|brew): a lit turntable, the city loop keeps running underneath ----------
RIGS.stage = function (kind, yaw = 0, clip = 'idle', u = 0.3) {
  const T = RIGS.st || (RIGS.st = (() => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#9cc8e8');
    sc.add(new THREE.HemisphereLight('#dfe6ff', '#8a7f74', 1.5)); const sun = new THREE.DirectionalLight('#fff3dc', 2.2); sun.position.set(-2.5, 6, 3.5); sc.add(sun);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(6, 40), toonMat()); bakeColor(fl.geometry, '#8a8496'); fl.rotation.x = -Math.PI / 2; sc.add(fl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60); return { sc, cam, J: null };
  })());
  if (T.J) T.sc.remove(T.J.root);
  T.J = kind === 'brew' ? window.buildBrewmaster().J : rigBuild(kind); T.sc.add(T.J.root); T.J.root.rotation.y = yaw;
  const p = rigSample(clip, u); if (kind === 'brew') { p.y *= 1.5; p.ty *= 1.5; } applyPose(T.J, p, 60, 1, true);
  const H = kind === 'brew' ? 3.0 : 1.75, a = VW() / VH(); T.cam.aspect = a; T.cam.fov = a < 1 ? 2 * Math.atan(Math.tan(15 * Math.PI / 180) / a) * 180 / Math.PI : 30; T.cam.updateProjectionMatrix();
  const vf = Math.tan(T.cam.fov * Math.PI / 360), hf = vf * a, dist = Math.max(H * 0.62 / vf, H * 0.5 / hf); T.cam.position.set(0, H * 0.55, dist); T.cam.lookAt(0, H * 0.47, 0);
  for (const h of QUAL.outlines) if (h === T.J.hull) h.visible = QUAL.hd;
  RIGS.stageOn = true; return RIGS.stats[kind];
};
if (Q.has('rigstage')) { const _dr = draw; draw = (sc, cam) => (RIGS.stageOn && RIGS.st ? _dr(RIGS.st.sc, RIGS.st.cam) : _dr(sc, cam)); }
window.__rigs = RIGS;

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
const HERO_START = { x: -45, z: -32.6, yaw: Math.PI / 2, camYaw: -Math.PI / 2 }; // Harborplace, on the promenade, looking east along the harbour
const hero = new Fighter(buildHero(), { x: HERO_START.x, z: HERO_START.z, yaw: HERO_START.yaw, hp: 100, r: 0.45 });
hero.J.mat.userData.flashC.value.set('#fff'); hero.roof = false; hero.name = 'HAROLD';
// the AI partner: MAVIS, Harold's wife (grey afro, floral dress, pearls, handbag), always computer-controlled (see 06c_partner.js)
const partner = new Fighter(buildHero({ wife: true }), { x: -46, z: -34.6, yaw: HERO_START.yaw, hp: 100, r: 0.45 });
partner.J.mat.userData.flashC.value.set('#fff'); partner.roof = false; partner.name = 'MAVIS'; partner.isPartner = true;
const POSTS = [ // thugs spread over the districts: a pair (or trio) near every landmark; look 4 is the bruiser
  { x: -24, z: -33.5, look: 0 }, { x: -20, z: -32, look: 1 },                         // Constellation / WTC promenade (first fight)
  { x: 17, z: -33.5, look: 2 }, { x: 21, z: -32.2, look: 3 },                          // Aquarium
  { x: 54, z: -33.6, look: 1 }, { x: 58, z: -32, look: 4 },                            // Power Plant
  { x: 80, z: -41, look: 0 }, { x: 85, z: -40, look: 2 },                              // Four Seasons (Pratt St)
  { x: 123, z: -33, look: 3 }, { x: 129, z: -33.5, look: 1 },                          // Pendry
  { x: 166, z: -56, look: 0 }, { x: 167, z: -50, look: 2 }, { x: 165, z: -63, look: 4 }, // Fells Point square
  { x: -24, z: -85, look: 3 }, { x: -16, z: -85, look: 1 },                            // Washington Monument
  { x: -71, z: -6, look: 0 }, { x: -70, z: 2, look: 2 },                               // Oriole Park (Light St)
  { x: -92, z: -4, look: 3 },                                                          // Oriole Park (warehouse alley)
  { x: -71, z: 52, look: 1 }, { x: -84, z: 76, look: 4 },                              // M&T Bank Stadium
  { x: -54, z: 33.5, look: 2 }, { x: -48, z: 33.2, look: 0 },                          // Science Center promenade
  { x: -6, z: 50, look: 3 }, { x: -1, z: 57, look: 1 },                                // Federal Hill
  { x: 80, z: 40, look: 0 }, { x: 85, z: 41, look: 2 },                                // Domino Sugar (Key Hwy)
  { x: 114, z: 41, look: 3 }, { x: 119, z: 40.5, look: 1 },                            // Under Armour
  { x: 172, z: 52, look: 0 }, { x: 178, z: 77, look: 4 },                              // Fort McHenry
].map((p) => Object.assign({ yaw: 0 }, p));
const enemies = POSTS.map((p, i) => {
  const look = THUG_LOOKS[p.look], big = !!look.big;
  const e = new Fighter(buildThug(look), { x: p.x, z: p.z, yaw: p.yaw, hp: big ? 16 : 8, scale: big ? 1.2 : 1, r: big ? 0.55 : 0.42 });
  e.J.mat.userData.flashC.value.set('#fff'); e.post = p; e.big = big; e.armed = !!look.weapon; e.cool = 0; e.slot = (i / POSTS.length) * TAU; e.respawn = 0; e.id = i;
  // hp pip above the head
  const c = document.createElement('canvas'); c.width = 128; c.height = 20; e.hpC = c; e.hpT = new THREE.CanvasTexture(c); e.hpT.colorSpace = THREE.SRGBColorSpace;
  e.hpS = new THREE.Sprite(new THREE.SpriteMaterial({ map: e.hpT, depthTest: false, transparent: true, fog: false })); e.hpS.scale.set(1.1, 0.17, 1); e.hpS.renderOrder = 15; e.hpS.visible = false; scene.add(e.hpS); e.hpShow = 0;
  e.dz = new THREE.Sprite(new THREE.SpriteMaterial({ map: FXT.dizzy, depthTest: false, transparent: true, fog: false })); e.dz.renderOrder = 16; e.dz.visible = false; e.dz.scale.set(1.0, 0.5, 1); scene.add(e.dz);
  e.bang = null; return e;
});
function drawHp(e) {
  const c = e.hpC.getContext('2d'); c.clearRect(0, 0, 128, 20); c.fillStyle = INK; c.fillRect(0, 0, 128, 20);
  c.fillStyle = '#ff3d6e'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 12); c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(4, 4, 120 * Math.max(0, e.hp) / e.maxHp, 4); e.hpT.needsUpdate = true;
}
const ALL = [hero, partner, ...enemies];
// distance LOD for the thugs (phones: every rig part is a draw call, x2 with its ink hull, x3 with its shadow):
// beyond 24 m a thug drops its ink outlines and stops casting shadows
for (const f of ALL) { f.J.ol = []; f.J.sh = []; f.root.traverse((o) => { if (o.isMesh && o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide) f.J.ol.push(o); else if (o.isMesh && o.castShadow) f.J.sh.push(o); }); f.lodNear = true; }
function rigLod() {
  for (const e of enemies) { const near = (e.pos.x - hero.pos.x) ** 2 + (e.pos.z - hero.pos.z) ** 2 < 24 * 24 || (COOP.on && (e.pos.x - partner.pos.x) ** 2 + (e.pos.z - partner.pos.z) ** 2 < 24 * 24);
    if (near === e.lodNear && e.lodHd === QUAL.hd) continue; e.lodNear = near; e.lodHd = QUAL.hd;
    for (const o of e.J.ol) o.visible = near && QUAL.hd; for (const o of e.J.sh) o.castShadow = near; }
}

// ---------------- world collision ----------------
const DROWN_ST = new Set(['down', 'hurt', 'dizzy']); // knocked / thrown thugs that cross the seawall go in the harbour
function collide(f) {
  const p = f.pos; if (f.state === 'drown') return;
  if (f.roof) { // rooftop shortcut: walk inside the parapet, around the AC unit
    p.x = clamp(p.x, ROOF.x0, ROOF.x1); p.z = clamp(p.z, ROOF.z0, ROOF.z1);
    const a = ROOF.ac, m = f.r * 0.8; if (p.x > a.x0 - m && p.x < a.x1 + m && p.z > a.z0 - m && p.z < a.z1 + m) {
      const o = [p.x - (a.x0 - m), a.x1 + m - p.x, p.z - (a.z0 - m), a.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = a.x0 - m; else if (k === 1) p.x = a.x1 + m; else if (k === 2) p.z = a.z0 - m; else p.z = a.z1 + m; }
    p.y = ROOF.y; return;
  } p.x = clamp(p.x, WB.x0, WB.x1); p.z = clamp(p.z, WB.z0, WB.z1); // the city edge
  for (const c of collAt(p.x, p.z)) {
    if (c.r !== undefined) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + f.r * 0.8; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    else { const m = f.r * 0.8; if (p.x > c.x0 - m && p.x < c.x1 + m && p.z > c.z0 - m && p.z < c.z1 + m) {
      const o = [p.x - (c.x0 - m), c.x1 + m - p.x, p.z - (c.z0 - m), c.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = c.x0 - m; else if (k === 1) p.x = c.x1 + m; else if (k === 2) p.z = c.z0 - m; else p.z = c.z1 + m; } }
  }
  // the harbour: never step into the water (slide along the seawall, else back to the last dry spot)
  if (isWater(p.x, p.z) && f.post && DROWN_ST.has(f.state)) { if (f.y < 0.45) startDrown(f); return; } // thugs: in the drink (airborne ones fly on)
  if (isWater(p.x, p.z) && !f.post && (f.state === 'down' || f.state === 'hurt')) { heroSplash(f); return; } // Harold / Mavis: splash, back on the dock
  if (isWater(p.x, p.z)) { const s = f.dry || { x: HERO_START.x, z: HERO_START.z };
    if (!isWater(p.x, s.z)) p.z = s.z; else if (!isWater(s.x, p.z)) p.x = s.x; else { p.x = s.x; p.z = s.z; } f.wet = (f.wet || 0) + 1; }
  if (!isWater(p.x, p.z)) { f.dry = f.dry || { x: 0, z: 0 }; f.dry.x = p.x; f.dry.z = p.z; }
  const gy = groundY(p.x, p.z); p.y = Math.abs(gy - p.y) > 1.2 ? damp(p.y, gy, 9, 1 / 60) : damp(p.y, gy, 18, 1 / 60);
}
function separate() {
  for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) {
    const a = ALL[i], b = ALL[j]; if (!a.alive || !b.alive || a.state === 'down' || b.state === 'down' || a.roof || b.roof || CINE_ST.has(a.state) || a.fin || b.fin || a.ghost || b.ghost) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d < m && d > 1e-4) { const k = (m - d) / 2; a.pos.x -= dx / d * k; a.pos.z -= dz / d * k; b.pos.x += dx / d * k; b.pos.z += dz / d * k; }
  }
}

// ---------------- input ----------------
const KEYS = new Set(); const PRESS = new Set();
const IN = { mx: 0, my: 0, look: 0, lookY: 0, dragX: 0, dragY: 0, lastLook: -9, bot: null };
let DEV = TOUCH ? 'touch' : 'kb';
addEventListener('keydown', (e) => {
  DEV = 'kb'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
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
  canvas.setPointerCapture?.(e.pointerId); if (e.pointerType === 'touch') DEV = 'touch'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
  // (no floating virtual pad: on touch screens the stick + buttons live on the arcade panel below the game; a drag on the game orbits the camera)

  TOUCHS.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
const ptrMove = (e) => {
  if (e.pointerId === TOUCHS.stick) { const dx = e.clientX - TOUCHS.sx, dy = e.clientY - TOUCHS.sy, d = Math.hypot(dx, dy), m = 52, s = d > m ? m / d : 1;
    TOUCHS.x = dx * s / m; TOUCHS.y = dy * s / m; $('knob').style.transform = `translate(${dx * s}px, ${dy * s}px)`; return; }
  const d = TOUCHS.drag.get(e.pointerId); if (!d) return;
  IN.dragX += e.clientX - d.x; IN.dragY += e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; IN.lastLook = S.time;
};
canvas.addEventListener('pointermove', ptrMove);
const endPtr = (e) => {
  if (e.pointerId === TOUCHS.stick) { TOUCHS.stick = null; TOUCHS.x = TOUCHS.y = 0; $('knob').style.transform = ''; const st = $('stick'); st.classList.remove('act'); st.style.left = ''; st.style.top = ''; }
  TOUCHS.drag.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
for (const [id, k] of [['bA', 'a'], ['bB', 'b'], ['bC', 'c'], ['cL', 'l'], ['cR', 'r']]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); TOUCHS.btn[k] = true; el.classList.add('down'); DEV = 'touch'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true; if (k === 'a') PRESS.add('j'); if (k === 'b') PRESS.add('k'); if (k === 'c') PRESS.add('e'); });
  const up = () => { TOUCHS.btn[k] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
let PAD_PREV = [];
function readInput() {
  let mx = 0, my = 0, look = 0, lookY = 0;
  if (KEYS.has('a') || KEYS.has('arrowleft')) mx -= 1; if (KEYS.has('d') || KEYS.has('arrowright')) mx += 1;
  if (KEYS.has('w') || KEYS.has('arrowup')) my += 1; if (KEYS.has('s') || KEYS.has('arrowdown')) my -= 1;
  if (KEYS.has('q')) look -= 1; if (KEYS.has('r')) look += 1;
  if (TOUCHS.stick !== null) { mx += TOUCHS.x; my -= TOUCHS.y; }
  if (TOUCHS.btn.l) look -= 1; if (TOUCHS.btn.r) look += 1;
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; IN.padAct = false;
  for (const gp of pads) {
    if (!gp) continue; if (COOP.padRole(gp) !== 'p1') continue; // co-op (06cc): a joined Player 2 pad drives Mavis, not Harold
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    mx += dz(gp.axes[0] || 0); my -= dz(gp.axes[1] || 0); look += dz(gp.axes[2] || 0); lookY += dz(gp.axes[3] || 0);
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(4)) look -= 1; if (b(5)) look += 1;
    const prev = PAD_PREV[gp.index] || []; if (b(3)) IN.padAct = true;
    if ((b(2) && !prev[2]) || (b(1) && !prev[1])) PRESS.add('j'); if (b(0) && !prev[0]) PRESS.add('k'); if (b(3) && !prev[3]) PRESS.add('e'); if (b(8) && !prev[8]) FMAP.open('pad');
    if (gp.buttons.some((x) => x.pressed) || Math.abs(gp.axes[0] || 0) > 0.5) { DEV = 'pad'; if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true; }
    PAD_PREV[gp.index] = gp.buttons.map((x) => x.pressed);
  }
  if (IN.bot) { mx = IN.bot.mx; my = IN.bot.my; look += IN.bot.look || 0; if (IN.bot.atk) { PRESS.add('j'); IN.bot.atk = false; } if (IN.bot.jump) { PRESS.add('k'); IN.bot.jump = false; } if (IN.bot.act) { PRESS.add('e'); IN.bot.act = false; } }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  IN.mx = mx; IN.my = my; IN.look = clamp(look, -1, 1); IN.lookY = lookY; if (look || lookY) IN.lastLook = S.time;
}

// ---------------- camera: cinematic over-the-shoulder (low, close, right-shoulder offset, handheld sway); widens in fights; boxed against walls ----------------
const CAM = { yaw: HERO_START.camYaw, pitch: 0.17, dist: 4.4, cur: 4.4, sh: 0.72, pivot: new THREE.Vector3(HERO_START.x, 1.55, HERO_START.z), look: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 58, lockYawT: 0, fightK: 0 };
function camFwd(yaw) { return [-Math.sin(yaw), -Math.cos(yaw)]; } // xz forward of the camera
function segBox(ax, ay, az, bx, by, bz, b, pad) { // param t of the first hit of segment a->b with an AABB, or 1
  let t0 = 0, t1 = 1; const P = [[ax, bx, b.x0 - pad, b.x1 + pad], [ay, by, (b.y0 || -1), b.h + pad], [az, bz, b.z0 - pad, b.z1 + pad]];
  for (const [a, c, lo, hi] of P) { const d = c - a; if (Math.abs(d) < 1e-6) { if (a < lo || a > hi) return 1; continue; }
    let u0 = (lo - a) / d, u1 = (hi - a) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return 1; }
  return t0;
}
let lockT = null;
function updateCamera(dt, rdt) { updateCameraFor(CAM, camera, hero, IN, lockT, dt, rdt); }
// the follow camera, for any toad + camera (single player: CAM / camera / Harold; split-screen co-op also runs it for Mavis on a 2nd camera)
function updateCameraFor(CAM, camera, hero, IN, lockT, dt, rdt) {
  // orbit input
  CAM.yaw -= IN.look * rdt * 2.3; CAM.yaw -= IN.dragX * 0.0062; CAM.pitch = clamp(CAM.pitch + IN.dragY * 0.0035 + IN.lookY * rdt * 1.4, 0.02, 0.9); IN.dragX = IN.dragY = 0;
  const p = hero.pos; const fighting = lockT && lockT.alive && lockT.state !== 'dying';
  CAM.fightK = damp(CAM.fightK, fighting ? 1 : 0, 2.2, rdt); const fk = CAM.fightK;
  // auto-follow: when running and the player isn't steering the camera, swing in behind the hero
  const idleLook = S.time - IN.lastLook > 1.4;
  if (idleLook && hero.speed > 1 && (hero.state === 'move')) {
    const heading = Math.atan2(-hero.vel.x, -hero.vel.y), d = angTo(CAM.yaw, heading);
    if (Math.abs(d) < 2.2) CAM.yaw += d * (1 - Math.exp(-rdt * 1.1 * clamp(hero.speed / 6, 0, 1)));
  }
  // lock-on framing: keep the target inside the (narrower, off-centre) frame
  if (fighting && idleLook) {
    const tx = lockT.pos.x - p.x, tz = lockT.pos.z - p.z, ty = Math.atan2(-tx, -tz), d = angTo(CAM.yaw, ty);
    if (Math.abs(d) > 0.45) CAM.yaw += (d - Math.sign(d) * 0.45) * (1 - Math.exp(-rdt * 2.4));
  }
  CAM.yaw = wrapA(CAM.yaw);
  // pivot follows the hero's shoulders (vertical lag on jumps)
  const tgt = _v.set(p.x, p.y + 1.55 + hero.y * 0.45, p.z);
  if (fighting) { tgt.x += (lockT.pos.x - p.x) * 0.25; tgt.z += (lockT.pos.z - p.z) * 0.25; }
  CAM.pivot.x = damp(CAM.pivot.x, tgt.x, 9, rdt); CAM.pivot.z = damp(CAM.pivot.z, tgt.z, 9, rdt); CAM.pivot.y = damp(CAM.pivot.y, tgt.y, 6, rdt);
  const aspect = CAM.aspect || VW() / VH(), portrait = aspect < 1 / 1.15;
  const want = lerp(4.4, 5.9, fk) + (portrait ? 1.4 : 0);
  CAM.dist = damp(CAM.dist, want, 2.5, rdt);
  const pitch = CAM.pitch + fk * 0.12;
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]], cp = Math.cos(pitch), sp = Math.sin(pitch);
  // right-shoulder offset (smaller in fights and on narrow portrait screens so the hero stays readable)
  const sh = lerp(0.95, 0.45, fk) * (portrait ? 0.55 : 1);
  const px = CAM.pivot.x + r[0] * sh, py = CAM.pivot.y, pz = CAM.pivot.z + r[1] * sh;
  const wx = px - f[0] * CAM.dist * cp, wy = py + CAM.dist * sp, wz = pz - f[1] * CAM.dist * cp;
  let t = 1; for (const b of BLD) { if (b.x1 < Math.min(px, wx) - 1 || b.x0 > Math.max(px, wx) + 1 || b.z1 < Math.min(pz, wz) - 1 || b.z0 > Math.max(pz, wz) + 1) continue; const h = segBox(px, py, pz, wx, wy, wz, b, 0.3); if (h < t) t = h; }
  const dd = Math.max(0.9, CAM.dist * t - 0.15);
  CAM.cur = dd < CAM.cur ? dd : damp(CAM.cur, dd, 4, rdt);
  const d = CAM.cur;
  CAM.pos.set(px - f[0] * d * cp, Math.max(py + d * sp, p.y + 0.5), pz - f[1] * d * cp);
  CAM.look.set(px + f[0] * 4.0, py + 0.2 - fk * 0.3, pz + f[1] * 4.0);
  // handheld sway: layered slow sines, a bit stronger in fights
  const T = S.time, amp = 1 + fk * 0.8;
  CAM.pos.x += (Math.sin(T * 0.73) * 0.03 + Math.sin(T * 1.91 + 1) * 0.012) * amp; CAM.pos.y += (Math.sin(T * 1.13 + 2) * 0.025 + Math.sin(T * 2.7) * 0.008) * amp;
  CAM.look.x += Math.sin(T * 0.51 + 4) * 0.05 * amp; CAM.look.y += Math.sin(T * 0.87 + 3) * 0.035 * amp;
  camera.position.copy(CAM.pos);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.25; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.up.set(0, 1, 0); camera.lookAt(CAM.look);
  setFov(lerp(58, 62, fk), camera, aspect);
}
function setFov(base, cam = camera, aspect = CAM.aspect || VW() / VH()) { // wider in portrait so the street still fits
  const camera = cam; let fov = base; if (aspect < 1) fov = clamp(2 * Math.atan(Math.tan((base * 0.82 / 2) * Math.PI / 180) / aspect) * 180 / Math.PI, base, 84);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------------- combat ----------------
const WORDS_L = [0, 1, 4, 6], WORDS_H = [1, 3, 5];
function pickTarget(dirx, dirz, maxD = 7) {
  let best = null, bs = 1e9;
  for (const e of enemies) {
    if (!e.alive || e.state === 'dying' || e.state === 'drown') continue; const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz); if (d > maxD) continue;
    const ang = Math.acos(clamp((dx * dirx + dz * dirz) / (d || 1), -1, 1));
    const s = d + ang * 2.2 + (e.state === 'down' ? 4 : 0); if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function hitEnemy(e, dmg, heavy, fromYaw, by = hero) {
  if (!e.alive || e.state === 'dying' || e.state === 'drown' || (e.state === 'down' && !heavy)) return false;
  e.hp -= dmg; e.lastBy = by; e.flash = 1; e.J.mat.userData.flashC.value.set('#fff'); e.hpShow = 2.5; drawHp(e); S.hits++;
  S.combo++; S.comboT = 1.3; S.maxCombo = Math.max(S.maxCombo, S.combo);
  const kx = Math.sin(fromYaw), kz = Math.cos(fromYaw);
  const at = _v.set(e.pos.x, e.pos.y + 1.1 * e.scale, e.pos.z);
  spawnSprite(FXT.star, at, heavy ? 1.6 : 1.15, 0.22, { rot: Math.random() * TAU });
  if (heavy || S.combo % 2 === 1) { const w = (heavy ? WORDS_H : WORDS_L)[(Math.random() * 3) | 0]; spawnSprite(FXT.words[w], at.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0.8, 0)), heavy ? 1.15 : 0.85, 0.65, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.18, 0.18) }); }
  // dizzy: the first time a thug drops to half health it staggers, seeing stars -> QTE finisher window
  if (e.state === 'dizzy' && e.hp < 1) e.hp = 1; // a dizzy thug can't be KO'd by ordinary hits: the QTE finisher (or its recovery) ends it
  if (e.hp > 0 && (e.state === 'dizzy' || (!e.dizzied && e.hp <= e.maxHp * 0.5))) {
    if (e.state !== 'dizzy') { e.dizzied = true; e.set('dizzy'); qteOpen(e); sfx('ko'); }
    e.kb.set(kx * 1.5, kz * 1.5); e.yaw = fromYaw + Math.PI; S.hitstop = 0.06; S.shake = Math.max(S.shake, 0.4); sfx('hit');
    if (e.bang) e.bang.life = 0.0001; return true;
  }
  if (e.hp <= 0 || heavy) {
    e.set('down'); e.kb.set(kx * (heavy ? 7.5 : 5), kz * (heavy ? 7.5 : 5)); e.vy = 4.2; e.y = 0.01; e.dead = e.hp <= 0; e.yaw = fromYaw + Math.PI;
    S.hitstop = 0.09; S.shake = Math.max(S.shake, 0.75); sfx('heavy');
  } else if (e.state === 'windup' || e.state === 'attack' || (e.big && e.state === 'chase' && Math.random() < 0.6)) { // committed swings (and the bruiser) shrug off light hits
    e.kb.set(kx * 1.2, kz * 1.2); S.hitstop = 0.05; S.shake = Math.max(S.shake, 0.3); sfx('hit');
  } else { e.set('hurt'); e.kb.set(kx * 3.2, kz * 3.2); e.yaw = fromYaw + Math.PI; S.hitstop = 0.055; S.shake = Math.max(S.shake, 0.4); sfx('hit'); }
  if (e.bang) e.bang.life = 0.0001;
  return true;
}
function hurtHero(dmg, fromX, fromZ, heavy) { hurtTurtle(hero, dmg, fromX, fromZ, heavy); }
// either turtle takes a hit; at 0 HP it goes down for good ('ko') until the other one revives it
const NOHURT = new Set(['down', 'getup', 'ko', 'tp', 'hop', 'pclimb', 'boost', 'tag', 'intro', 'power']);
function hurtTurtle(f, dmg, fromX, fromZ, heavy) {
  if (f.inv > 0 || NOHURT.has(f.state) || CINE_ST.has(f.state) || CINE.intro || f.hp <= 0) return;
  if (f.isPartner && f.state === 'revive') return; // covering the revive
  if (f.isPartner) dmg = Math.round(dmg * 0.8);
  f.hp = Math.max(0, f.hp - dmg); f.flash = 1; f.J.mat.userData.flashC.value.set('#ff3d6e');
  const dx = f.pos.x - fromX, dz = f.pos.z - fromZ, d = Math.hypot(dx, dz) || 1; f.yaw = Math.atan2(-dx, -dz);
  if (f === hero) S.combo = 0; S.shake = Math.max(S.shake, f === hero ? 0.5 : 0.25); sfx('hurt'); spawnSprite(FXT.star, _v.set(f.pos.x, f.pos.y + 1.2, f.pos.z), 0.9, 0.2);
  if (f.hp <= 0 || heavy) { f.set('down'); f.kb.set(dx / d * 6, dz / d * 6); f.vy = 4; f.y = 0.01; if (f === hero) S.playerDowns++; else PART.downs++; }
  else { f.set('hurt'); f.kb.set(dx / d * 3, dz / d * 3); }
  f.inv = 0.5;
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
function resolveSwing(A, heavy360, f = hero, skip = null) {
  let any = false;
  for (const e of enemies) {
    if (!e.alive || (skip && skip(e))) continue; const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z, d = Math.hypot(dx, dz);
    if (d > A.range + e.r * 0.5) continue; if (Math.abs(e.y - f.y) > 1.6) continue;
    const ang = Math.abs(angTo(f.yaw, Math.atan2(dx, dz))); if (!heavy360 && ang > A.cone) continue;
    if (hitEnemy(e, A.dmg, A.heavy, Math.atan2(dx, dz), f)) any = true;
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
      if (actHeld() && reviveTarget()) { h.set('revive'); h.rv = 0; h.vel.set(0, 0); break; }
      if (pressed('e', 'f') && tryAction()) break;
      if (atk) startAttack(1); else if (jump) { h.set('air'); h.vy = 8.2; sfx('jump'); dust(h.pos.x, h.pos.y, h.pos.z, 3); }
      break;
    }
    case 'atk': {
      const A = ATK[h.atkN], u = h.st / A.dur; h.speed = 0;
      if (pressed('e', 'f') && qteInRange()) { startFinisher(qteTarget()); pose = HERO_POSES.idle(0); break; }
      if (pressed('e', 'f') && POWER.cd <= 0 && inFight()) { startPower(); pose = HERO_POSES.idle(0); break; } // ACT cancels a cane combo into the POWER move
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
    case 'power': { // the ACT POWER move (06b): hop + flip, cane slam into the ground at 45%, recover
      h.vel.set(0, 0); const u = h.st / 0.9; h.speed = 0;
      if (u < 0.45) h.y = Math.sin(u / 0.45 * Math.PI) * 1.5 * (u < 0.3 ? 1 : 0.4 + 0.6 * (0.45 - u) / 0.15); else h.y = 0;
      if (!h.pw.hit && u >= 0.45) { h.pw.hit = true; h.y = 0; powerImpact(); }
      pose = HERO_POSES.airatk(clamp(u * 0.95, 0, 1)); snapTilt = true; rate = 30;
      if (u >= 1) { h.y = 0; h.set('move'); h.J.tilt.rotation.x = 0; }
      break;
    }
    case 'revive': { // hold ACT next to the downed partner
      h.vel.set(0, 0); const P = reviveTarget(); pose = HERO_POSES.revive(h.st); rate = 14;
      if (P) h.yaw += angTo(h.yaw, Math.atan2(P.pos.x - h.pos.x, P.pos.z - h.pos.z)) * (1 - Math.exp(-dt * 12));
      if (!P || !actHeld()) { h.rv = 0; h.set('move'); break; }
      h.rv += dt; if (h.rv >= REVIVE_T) { reviveTurtle(P, hero); h.set('move'); }
      break;
    }
    case 'ko': { // 0 HP: stays down until the partner revives (game over only if both turtles are down)
      h.vel.set(0, 0); pose = HERO_POSES.down(1, true); rate = 14; break;
    }
    case 'climb': case 'leap': case 'vault': case 'kick': case 'fin': case 'boost': {
      pose = cineHero(h, dt); rate = h.state === 'fin' ? 30 : 18; snapTilt = h.state === 'leap' || h.state === 'fin' || h.state === 'boost';
      applyPose(h.J, pose, rate, dt, snapTilt); h.sync(dt); return;
    }
    case 'hurt': { h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 7)); pose = HERO_POSES.hurt(clamp(h.st / 0.35, 0, 1)); rate = 22; if (h.st > 0.35) h.set('move'); break; }
    case 'down': {
      h.vel.set(h.kb.x, h.kb.y); h.kb.multiplyScalar(Math.exp(-dt * 3.5)); h.vy -= 22 * dt; h.y = Math.max(0, h.y + h.vy * dt);
      pose = HERO_POSES.down(h.st, h.y <= 0 && h.st > 0.2); rate = 14;
      if (h.hp <= 0 && h.st > 0.9 && h.y <= 0) { h.set('ko'); h.kb.set(0, 0); }
      else if (h.hp > 0 && h.st > 1.0) { h.set('getup'); h.inv = 1.0; }
      break;
    }
    case 'getup': { h.vel.set(0, 0); pose = HERO_POSES.getup(clamp(h.st / 0.45, 0, 1)); rate = 14; if (h.st > 0.45) h.set('move'); break; }
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
  // target: whichever turtle is nearer (sticky), as long as it is on the street and standing
  const T0 = enemyTarget(e), tg = T0 || hero; e.tgt = T0;
  const dx = tg.pos.x - e.pos.x, dz = tg.pos.z - e.pos.z, dP = Math.hypot(dx, dz);
  const toHeroYaw = Math.atan2(dx, dz), heroFromPost = Math.hypot(tg.pos.x - e.post.x, tg.pos.z - e.post.z), fromPost = Math.hypot(e.pos.x - e.post.x, e.pos.z - e.post.z);
  if (e.fin) { e.sync(dt); return; }
  const heroOk = !!T0;
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
      const canAtk = e.cool <= 0 && ATTACKERS < 2;
      if (canAtk && dP < (e.armed ? 1.9 : 1.65)) { e.set('windup'); ATTACKERS++; sfx('swing'); break; }
      // approach to striking range if we may attack, else hold a ring around the hero and circle
      if (canAtk) walkTo(tg.pos.x - dx / dP * 1.3, tg.pos.z - dz / dP * 1.3, SP);
      else { e.slot += dt * 0.35; const ring = 2.9, a = Math.atan2(-dx, -dz) * 0.6 + e.slot * 0.4; walkTo(tg.pos.x + Math.sin(a) * ring, tg.pos.z + Math.cos(a) * ring, SP * 0.6); face(toHeroYaw, 8); }
      const sp = Math.hypot(v[0], v[1]); pose = sp > 0.5 ? THUG_POSES.run(e.at, sp, J) : THUG_POSES.idle(e.at, J);
      break;
    }
    case 'windup': {
      face(toHeroYaw, 6); pose = THUG_POSES.windup(e.st, J); rate = 12;
      e.J.mat.userData.flashC.value.set('#ffd23c'); e.flash = Math.max(e.flash, 0.25 + 0.25 * Math.sin(e.st * 40));
      if (e.st > (e.big ? 0.7 : 0.5)) { e.set('attack'); e.J.mat.userData.flashC.value.set('#fff'); }
      break;
    }
    case 'attack': {
      pose = THUG_POSES.attack(e.st / 0.3, J); rate = 26; const lunge = e.st < 0.12 ? 4 : 0; v = [Math.sin(e.yaw) * lunge, Math.cos(e.yaw) * lunge];
      if (!e.hitDone && e.st > 0.1) { e.hitDone = true; const ang = Math.abs(angTo(e.yaw, toHeroYaw)); const reach = (e.armed ? 2.0 : 1.7) * e.scale;
        if (dP < reach && ang < 1.0 && tg.y < 0.9 && T0) hurtTurtle(tg, e.big ? 16 : e.armed ? 11 : 8, e.pos.x, e.pos.z, e.big); }
      if (e.st > 0.55) { e.hitDone = false; e.set('chase'); e.cool = rnd(1.1, 2.0) + (e.big ? 0.6 : 0); ATTACKERS = Math.max(0, ATTACKERS - 1); }
      break;
    }
    case 'drown': { // in the harbour: flail, sink, KO (06b startDrown)
      v = [0, 0]; const u = clamp(e.st / 1.2, 0, 1); e.pos.y = lerp(CURB, WY - 2.8, u * u); e.y = 0; pose = THUG_POSES.hurt(0.6 + Math.sin(e.st * 18) * 0.3, J); rate = 20;
      e.J.tilt.rotation.z = Math.sin(e.st * 9) * 0.4 * (1 - u);
      if (e.st > 0.35 && Math.random() < dt * 10) spawnSprite(SPLASH_T, _v.set(e.pos.x + rnd(-0.5, 0.5), WY + 0.2, e.pos.z + rnd(-0.5, 0.5)), rnd(0.35, 0.6), 0.5, { kind: 'grow', depth: true, vel: new THREE.Vector3(0, 1.2, 0) });
      if (e.st > 1.2) drownKO(e);
      e.sync(dt); e.hpS.visible = false; e.dz.visible = false; return;
    }
    case 'dizzy': { // staggering, stars over the head; recovers if the QTE window passes
      v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 6)); pose = THUG_POSES.dizzy(e.st, J); rate = 10;
      if (e.st > DIZZY_T) { e.set('chase'); e.cool = 0.6; }
      break;
    }
    case 'hurt': { v = [e.kb.x, e.kb.y]; e.kb.multiplyScalar(Math.exp(-dt * 7)); pose = THUG_POSES.hurt(clamp(e.st / 0.32, 0, 1), J); rate = 24; if (e.st > 0.34) { e.set('chase'); e.cool = Math.min(e.cool, 0.25); } break; }
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
        e.set('dead'); e.root.visible = false; e.hpS.visible = false; S.kills++; sfx('ko'); if (e.lastBy === partner) PART.kos++; else PART.heroKos++; e.respawn = 14; e.landed = false; $('kon').textContent = S.kills;
      }
      break;
    }
    case 'dead': {
      e.respawn -= dt; const far = Math.hypot(hero.pos.x - e.post.x, hero.pos.z - e.post.z) > 12;
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
  e.hpShow -= dt; e.hpS.visible = e.hpShow > 0 && e.alive && e.hp > 0 && e.state !== 'dying' && e.state !== 'down' && e.state !== 'dizzy' && !e.fin;
  if (e.hpS.visible) e.hpS.position.set(e.pos.x, e.pos.y + 2.25 * e.scale + 0.1, e.pos.z);
  e.dz.visible = e.state === 'dizzy'; if (e.dz.visible) { e.dz.position.set(e.pos.x, e.pos.y + 2.2 * e.scale + 0.15, e.pos.z); e.dz.material.rotation = Math.sin(e.st * 6) * 0.25; }
  if (e.bang && e.bang.s.visible) e.bang.s.position.set(e.pos.x, e.pos.y + 2.35 * e.scale + Math.sin(e.st * 20) * 0.03, e.pos.z); else e.bang = e.bang && e.bang.s.visible ? e.bang : (e.state === 'idle' ? null : e.bang);
}
// windup/attack tokens are counted fresh every frame (robust against interrupted attacks)
function countAttackers() { ATTACKERS = enemies.filter((e) => e.state === 'windup' || e.state === 'attack').length; }
function turtleOk(f) { return f.hp > 0 && !f.roof && !CINE.intro && (f === hero ? f.state !== 'down' && f.state !== 'ko' && f.state !== 'climb' && f.state !== 'leap' && f.state !== 'boost' : PART_FIGHT.has(f.state)); }
function enemyTarget(e) {
  const a = turtleOk(hero) ? hero : null, b = turtleOk(partner) ? partner : null; if (!a || !b) return a || b;
  const da = Math.hypot(hero.pos.x - e.pos.x, hero.pos.z - e.pos.z), db = Math.hypot(partner.pos.x - e.pos.x, partner.pos.z - e.pos.z);
  if (e.tgt === partner) return db < da + 1.5 ? partner : hero; return da < db + 1.5 ? hero : partner;
}

// ---------------- HUD ----------------
let hpShown = 100, p2Shown = 100, p2Down = false;
function hud(dt) {
  const pct = hero.hp / hero.maxHp * 100;
  if (Math.abs(pct - hpShown) > 0.1) { hpShown = pct; $('hpfill').style.width = pct + '%'; $('hplag').style.width = pct + '%'; }
  const pp = Math.round(partner.hp / partner.maxHp * 100); if (pp !== p2Shown) { p2Shown = pp; $('p2fill').style.width = pp + '%'; }
  const pd = partner.state === 'ko' || partner.hp <= 0; if (pd !== p2Down) { p2Down = pd; $('p2').classList.toggle('dn', pd); }
  S.comboT -= dt; if (S.comboT <= 0 && S.combo) S.combo = 0;
  const cb = $('combo'); if (S.combo >= 2) { cb.classList.add('on'); $('comboN').textContent = S.combo; } else cb.classList.remove('on');
}
let bannerT = 0;
function banner(txt = 'BACK ON YOUR FEET!', t = 1.6) { $('banner').textContent = txt; $('banner').classList.add('on'); bannerT = t; }
if (Q.has('nointro')) setTimeout(() => { const h = $('hint'); if (h) h.style.opacity = '0'; }, 9000);
// prototype nav: open on wide screens, collapsed on phones
{ const p = $('proto'); $('protoT').addEventListener('click', () => p.classList.toggle('open')); }

// ---------------- Cinema City: letterbox, contextual one-button prompts (ladder / rooftop leap / car vault / door kick),
// dizzy-thug QTE finisher with camera cuts + slow-mo, and the intro camera sweep ----------------
const CINE_ST = new Set(['climb', 'leap', 'vault', 'kick', 'fin', 'boost']);
const DIZZY_T = 2.8;
const ROOF = { x0: 11.75, x1: 23.25, z0: 11.75, z1: 23.25, y: LADDER.roofY, ac: { x0: 13.85, x1: 15.95, z0: 18.7, z1: 20.2 } };
const CINE = { lb: 0, intro: null, fin: null, cutT: 0, stats: { climbs: 0, leaps: 0, vaults: 0, kicks: 0, finishers: 0, qteOpened: 0, qteMissed: 0, pizza: 0, introDone: false, introSkipped: false, introSec: 0, boosts: 0, tags: 0, revivesByPlayer: 0, revivesByPartner: 0, gameOvers: 0 } };
let QTE = null;

// ---- extra poses ----
HERO_POSES.climb = (ph) => {
  const p = blank(), s = Math.sin(ph);
  p.shL = [-2.7 - 0.4 * s, 0, 0.2]; p.shR = [-2.7 + 0.4 * s, 0, -0.2]; p.elL = [-0.45 + 0.45 * s, 0, 0]; p.elR = [-0.45 - 0.45 * s, 0, 0];
  p.swL = [Math.PI / 2 + 2.2, 0, 0.4]; p.swR = [Math.PI / 2 + 2.2, 0, -0.4];
  p.lgL = [-0.95 + 0.55 * s, 0, 0.12]; p.knL = [1.3 - 0.55 * s, 0, 0]; p.lgR = [-0.95 - 0.55 * s, 0, -0.12]; p.knR = [1.3 + 0.55 * s, 0, 0];
  p.torso = [-0.05, 0, 0]; p.neck = [-0.45, 0, 0]; p.y = 0.02; return p;
};
HERO_POSES.kick = (u) => {
  const p = HERO_POSES.idle(0), a = ease(clamp((u - 0.15) / 0.28, 0, 1)), b = ease(clamp((u - 0.65) / 0.35, 0, 1)), k = a * (1 - b);
  p.lgR = [lerp(0.25, -1.65, k), 0, -0.1]; p.knR = [lerp(1.1, 0.05, k), 0, 0]; p.ftR = [lerp(0, 0.6, k), 0, 0];
  p.lgL = [-0.2, 0, 0.12]; p.knL = [0.35, 0, 0]; p.torso = [lerp(0.25, -0.4, k), 0.1, 0]; p.hips = [0, 0.2, 0];
  p.shL = [-0.6, 0, 1.0]; p.shR = [-0.3, 0, -1.1]; return p;
};
HERO_POSES.vault = (u, side) => {
  const p = HERO_POSES.jump(1), s = Math.sin(u * Math.PI);
  p.tilt = [0, 0, s * 0.9 * side]; p.shL = [-1.2 * s, 0, 0.6]; p.shR = [-1.2 * s, 0, -0.6]; p.lgL = p.lgR = [-1.1 * s, 0, 0]; p.knL = p.knR = [1.2 * s + 0.3, 0, 0];
  return p;
};
THUG_POSES.dizzy = (t, J) => {
  const p = THUG_POSES.hurt(0.35, J); legsStance(p, 0.2, 0.55 + Math.sin(t * 2.3) * 0.15);
  p.tilt = [Math.sin(t * 2.6) * 0.08, 0, Math.sin(t * 3.1) * 0.2]; p.neck = [0.3, Math.sin(t * 2.0) * 0.5, 0];
  p.shL = [0.15, 0, 0.35 + Math.sin(t * 4) * 0.2]; p.shR = [0.15, 0, -0.35 - Math.sin(t * 4) * 0.2]; p.elL = p.elR = [-0.35, 0, 0]; p.torso = [0.25, Math.sin(t * 1.7) * 0.3, 0];
  return p;
};

// ---- the alley door (kick open: hides a pizza box) ----
const DOOR = { x: DOOR_AT.x, z: DOOR_AT.z, open: false, ang: 0 };
const PROPM = toonMat();
const doorG = new THREE.Group(); doorG.userData.mat = PROPM; scene.add(doorG);
part(doorG, G.box(0.05, 2.75, 1.7), '#14101f', DOOR.x - 0.03, CURB + 1.37, DOOR.z, { outline: false, shadow: false });
part(doorG, G.box(0.22, 0.24, 1.95), '#8a7a5a', DOOR.x + 0.02, CURB + 2.86, DOOR.z);
part(doorG, G.box(0.16, 0.5, 0.9), '#a02a2a', DOOR.x + 0.04, CURB + 3.35, DOOR.z);
const hinge = new THREE.Group(); hinge.userData.mat = PROPM; hinge.position.set(DOOR.x + 0.1, CURB, DOOR.z - 0.72); doorG.add(hinge);
part(hinge, G.box(0.1, 2.6, 1.44), '#3a5a58', 0, 1.3, 0.72);
part(hinge, G.box(0.04, 0.5, 1.1), '#2a403e', 0.06, 0.4, 0.72, { outline: false });
part(hinge, G.box(0.08, 0.1, 0.2), '#ffd23c', 0.08, 1.25, 1.25, { outline: false });
// "NO ENTRY" style stencil, drawn on the sign
{ const t = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#a02a2a'; c.fillRect(0, 0, w, h); comicText(c, 'STAFF', w / 2, h / 2 + 4, 70, '#fff', null, { shadow: false }); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.44), basicSnap({ map: t })); m.position.set(DOOR.x + 0.13, CURB + 3.35, DOOR.z); m.rotation.y = Math.PI / 2; scene.add(m); }
const pizza = new THREE.Group(); pizza.userData.mat = PROPM; pizza.visible = false; scene.add(pizza);
part(pizza, G.box(0.62, 0.14, 0.62), '#fff0d6'); part(pizza, G.box(0.42, 0.02, 0.2), '#ff3d6e', 0, 0.08, 0, { outline: false });
const PIZZA = { on: false, t: 0, x: 0, z: 0 };
const PIZZA_W = canvasTex(512, 192, (c) => { comicText(c, 'PIZZA! +50', 256, 100, 84, '#ffd23c', null, { sx: 1 }); });

// ---- the action list: one button, contextual ----
const ACTIONS = [];
// with the partner close and free, the ladder spot offers a two-turtle BOOST instead of the solo CLIMB
// (K: no fire-escape CLIMB / BOOST / rooftop LEAP on this one street: the door kick, car vaults and the QTE finisher remain)
ACTIONS.push({ kind: 'door', label: 'KICK OPEN', x: DOOR.x + 0.85, z: DOOR.z, r: 1.5, y: 2.1, ok: () => !DOOR.open && !hero.roof, go: startKick });
for (const [cx, cz, alongX] of CARS) {
  for (const s of [-1, 1]) {
    const ax = alongX ? cx : cx + s * 1.78, az = alongX ? cz + s * 1.78 : cz, bx = alongX ? cx : cx - s * 1.85, bz = alongX ? cz - s * 1.85 : cz;
    ACTIONS.push({ kind: 'vault', label: 'VAULT', x: ax, z: az, r: 1.35, y: 1.9, bx, bz, cx, cz, ok: () => !hero.roof, go: (A) => startVault(A) });
  }
}
function actionInRange() {
  const h = hero; if (h.state !== 'move' || h.y > 0.05 || CINE.intro) return null;
  let best = null, bd = 1e9;
  for (const A of ACTIONS) { if (!A.ok()) continue; const d = Math.hypot(A.x - h.pos.x, A.z - h.pos.z); if (d < A.r && d < bd) { bd = d; best = A; } }
  return best;
}
function qteTarget() { // nearest dizzy thug within reach
  if (!(hero.state === 'move' || hero.state === 'atk') || hero.roof) return null; let best = null, bd = 4.6;
  for (const e of enemies) { if (e.state !== 'dizzy' || e.fin) continue; const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z); if (d < bd) { bd = d; best = e; } }
  return best;
}
function qteInRange() { return !!qteTarget(); }
// ---- ACT: ONE context-sensitive button (Brad 2026-10-10). Priority:
//   timed QTE finisher > (1) manhole: SEWER > (2) ladder / climbable wall: CLIMB or LEAP > (3) skateboard / car / boat: RIDE / DRIVE / BOARD (ACT again: off/out)
//   > the street actions (door KICK OPEN, car VAULT) > (4) in a fight: POWER move (cooldown).
// Phase 1 ships the POWER move + this context system. The hook lists below are empty until their phases fill them:
const MANHOLES = []; // phase 4: { x, z, r, go(m) } -> drop into the sewer
const CLIMBS = [];   // phase 4: { x, z, r, label: 'CLIMB' | 'LEAP', go(c) } -> ladders, fire escapes, climbable walls, rooftop leaps
const VEHICLES = []; // phase 2+: { kind: 'boat' | 'car' | 'skate', label: 'BOARD' | 'DRIVE' | 'RIDE', x, z, r, enter(v), exit(v) }
const RIDE = { v: null }; // the vehicle Harold is in / on right now
const POWER = { cd: 0, CD: 7, uses: 0, joins: 0, hits: 0 };
function nearestIn(list, r0 = 1.6) { const h = hero; let best = null, bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - h.pos.x, o.z - h.pos.z); if (d < (o.r || r0) && d < bd) { bd = d; best = o; } } return best; }
function inFight() { for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.state === 'idle' || e.state === 'return' || e.state === 'dead') continue; if (Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 7.5) return true; } return false; }
function actContext() {
  const h = hero; if (CINE.intro || PART.over) return null;
  const qt = qteTarget(); if (qt) return { kind: 'fin', label: 'FINISH', go: () => startFinisher(qt) };
  if (RIDE.v) { const v = RIDE.v; return { kind: v.kind, label: 'GET OFF', go: () => { RIDE.v = null; v.exit(v); } }; }
  if (h.state !== 'move' || h.y > 0.05) return null;
  let m = nearestIn(MANHOLES, 1.4); if (m) return { kind: 'sewer', label: 'SEWER', go: () => m.go(m) };
  m = nearestIn(CLIMBS); if (m) return { kind: 'climb', label: m.label || 'CLIMB', go: () => m.go(m) };
  m = nearestIn(VEHICLES, 2.2); if (m) return { kind: m.kind, label: m.label, go: () => { RIDE.v = m; m.enter(m); } };
  const A = actionInRange(); if (A) return { kind: A.kind, label: A.label, go: () => A.go(A) };
  if (inFight()) return { kind: 'power', label: 'POWER', ready: POWER.cd <= 0, go: () => startPower() };
  return null;
}
function tryAction() { const c = actContext(); if (!c || c.ready === false) return false; COOP.noteAct(c); c.go(); return true; } // COOP.noteAct (06cc): a boss / minigame ring can be replayed for Player 2's turn
// ---- the POWER move: Harold's big cane slam. Hops, flips and drives the cane into the pavement: a shockwave knocks back / downs every thug
// within ~5 m, a long hit-pause + heavy shake, and Mavis (if she is close and free) spins her handbag into the crowd at the same moment.
const POWER_W = canvasTex(512, 192, (c) => { comicText(c, 'CANE QUAKE!', 256, 100, 80, '#7dffc0', null, { sx: 1 }); });
// ---- WATER KILLS: a thug knocked / thrown off the promenade into the harbour splashes, sinks and counts as a KO (combo + score);
// Harold and Mavis never drown: knocked in, they splash and climb straight back out at the dock edge they went in from.
const SPLASH_T = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8f8ff'; c.strokeStyle = '#2a6a8a'; c.lineWidth = 5;
  for (const [x, y, r] of [[64, 74, 30], [34, 54, 16], [96, 50, 18], [64, 30, 14], [22, 92, 11], [108, 92, 12]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); } });
const SPLASH_W = canvasTex(512, 192, (c) => { comicText(c, 'SPLASH!', 256, 100, 96, '#6fd8ff', null, { sx: 1 }); });
const WATERK = { drowned: 0, heroSplash: 0 };
function splashFx(x, z, big = 1) {
  for (let k = 0; k < 10 * big; k++) { const a = rnd(0, TAU), s = rnd(1, 4); spawnSprite(SPLASH_T, _v.set(x + Math.sin(a) * 0.4, WY + 0.3, z + Math.cos(a) * 0.4), rnd(0.6, 1.2) * big, rnd(0.45, 0.8), { kind: 'grow', depth: true, vel: new THREE.Vector3(Math.sin(a) * s, rnd(4, 7), Math.cos(a) * s) }); }
  spawnSprite(SPLASH_W, _v.set(x, CURB + 2.6, z), 1.25, 0.9, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.15, 0.15) });
  sfx('heavy'); S.shake = Math.max(S.shake, 0.45);
}
function startDrown(e) {
  if (e.state === 'drown') return; e.set('drown'); e.kb.set(0, 0); e.vy = 0; e.y = 0; e.fin = false; e.dz.visible = false; e.hpS.visible = false; if (e.bang) e.bang.life = 0.0001;
  if (QTE && QTE.e === e) QTE = null; splashFx(e.pos.x, e.pos.z, e.big ? 1.4 : 1);
  S.combo++; S.comboT = 1.6; S.maxCombo = Math.max(S.maxCombo, S.combo); S.hits++;
}
function drownKO(e) {
  e.set('dead'); e.root.visible = false; e.hpS.visible = false; e.dead = true; e.hp = 0; S.kills++; sfx('ko'); WATERK.drowned++;
  if (e.lastBy === partner) PART.kos++; else PART.heroKos++; e.respawn = 14; e.landed = false; e.J.tilt.rotation.set(0, 0, 0); $('kon').textContent = S.kills;
}
function heroSplash(f) {
  const d = f.dry || { x: HERO_START.x, z: HERO_START.z }; splashFx(f.pos.x, f.pos.z); WATERK.heroSplash++;
  f.pos.x = d.x; f.pos.z = d.z; f.pos.y = groundY(d.x, d.z); f.y = 0; f.vy = 0; f.kb.set(0, 0); f.vel.set(0, 0); f.inv = 1.5;
  if (f.hp <= 0) f.set('ko'); else f.set('getup');
}
function startPower() { const h = hero; if (POWER.cd > 0) return; h.set('power'); h.pw = { hit: false }; h.vel.set(0, 0); POWER.cd = POWER.CD; POWER.uses++; sfx('jump');
  const t = pickTarget(Math.sin(h.yaw), Math.cos(h.yaw), 6); if (t) h.yaw = Math.atan2(t.pos.x - h.pos.x, t.pos.z - h.pos.z); }
function powerImpact() {
  const h = hero; S.hitstop = 0.24; S.shake = Math.max(S.shake, 1.5); sfx('heavy'); sfx('ko'); cut();
  spawnSlash(_v.set(h.pos.x, h.pos.y + 0.25, h.pos.z), h.yaw, 'spin', 0); spawnSlash(_v.set(h.pos.x, h.pos.y + 0.6, h.pos.z), h.yaw + 1.5, 'spin', 0);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; spawnSprite(FXT.puff, _v.set(h.pos.x + Math.sin(a) * 1.6, h.pos.y + 0.2, h.pos.z + Math.cos(a) * 1.6), rnd(0.9, 1.3), 0.55, { kind: 'grow', depth: true, vel: new THREE.Vector3(Math.sin(a) * 6, 1.2, Math.cos(a) * 6) }); }
  spawnSprite(POWER_W, _v.set(h.pos.x, h.pos.y + 2.6, h.pos.z), 1.4, 0.95, { kind: 'word', aspect: 512 / 192, rot: -0.08 });
  for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.fin) continue; const dx = e.pos.x - h.pos.x, dz = e.pos.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d < 5.2 && Math.abs(e.y - h.y) < 2) { const a = Math.atan2(dx, dz); if (hitEnemy(e, d < 3 ? 4 : 2, true, a)) { POWER.hits++; if (e.state === 'down') { e.kb.set(Math.sin(a) * 13, Math.cos(a) * 13); e.vy = 6.5; } } } } // big launch: thugs near the edge fly into the harbour
  const P = partner; // Mavis joins in: her spinning handbag finisher, aimed at the nearest thug
  if (P.state === 'move' && P.hp > 0 && Math.hypot(P.pos.x - h.pos.x, P.pos.z - h.pos.z) < 8) { let T = null, bd = 6; for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.fin) continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < bd) { bd = d; T = e; } }
    if (T) { POWER.joins++; P.set('atk'); P.atkN = 3; P.atkT = T; P.hitDone = false; P.hit2 = false; PART.combo = 0; PART.comboLen = 1; P.yaw = Math.atan2(T.pos.x - P.pos.x, T.pos.z - P.pos.z); spawnSprite(TAG_W, _v.set(P.pos.x, P.pos.y + 2.3, P.pos.z), 1.0, 0.8, { kind: 'word', aspect: 512 / 192, rot: 0.1 }); } }
}
function qteOpen(e) { QTE = { e, t0: S.time }; CINE.stats.qteOpened++; }

// ---- action starters ----
function startClimb() { const h = hero; h.set('climb'); h.cl = { phase: 0, x0: h.pos.x, z0: h.pos.z }; h.vel.set(0, 0); h.yaw = 0; sfx('jump'); cut(); }
function startLeap() { const h = hero; h.set('leap'); h.lp = { x0: h.pos.x, z0: h.pos.z, x1: 9.3, z1: 23.6, y0: ROOF.y }; h.vel.set(0, 0); h.yaw = -Math.PI / 2; sfx('jump'); cut(); }
function startVault(A) { const h = hero; h.set('vault'); h.vt = { x0: h.pos.x, z0: h.pos.z, x1: A.bx, z1: A.bz, side: Math.random() < 0.5 ? 1 : -1 }; h.yaw = Math.atan2(A.bx - h.pos.x, A.bz - h.pos.z); h.vel.set(0, 0); sfx('jump'); }
function startBoost() { // the partner cups its hands at the ladder and launches the hero up the wall
  const h = hero; h.set('boost'); h.vel.set(0, 0); h.bs = { x0: h.pos.x, z0: h.pos.z, launched: false, yTop: 0 };
  CINE.boost = { t: 0, shot: -1, px0: partner.pos.x, pz0: partner.pos.z }; partner.set('boost'); partner.vel.set(0, 0);
  if (Math.hypot(partner.pos.x - BOOST_P.x, partner.pos.z - BOOST_P.z) > 7) { CINE.boost.px0 = BOOST_P.x - 1.2; CINE.boost.pz0 = BOOST_P.z - 1.2; }
  CINE.stats.boosts++; sfx('jump'); cut();
}
function startKick() { const h = hero; h.set('kick'); h.kk = { done: false }; h.vel.set(0, 0); sfx('swing'); }
function startFinisher(e) {
  const h = hero, dx = h.pos.x - e.pos.x, dz = h.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
  CINE.lastFin = e.id; CINE.fin = { e, t: 0, ux: dx / d, uz: dz / d, sx: h.pos.x, sz: h.pos.z, ex: e.pos.x, ez: e.pos.z, hit: 0, side: Math.random() < 0.5 ? 1 : -1, shot: -1 };
  // tag team: the partner (free and within ~8 m) cuts in with a staff hit just before the flip strike
  if (partnerFree() && !partner.roof && Math.hypot(partner.pos.x - e.pos.x, partner.pos.z - e.pos.z) < 8.5) startTag(CINE.fin);
  e.fin = true; e.dz.visible = false; e.hpS.visible = false; e.yaw = Math.atan2(dx, dz); h.set('fin'); h.vel.set(0, 0); h.y = 0; h.vy = 0; QTE = null; lockT = null; sfx('swing');
}
function cut() { CINE.cutT = 1; }
function word(tex, x, y, z, big = 1) { spawnSprite(tex, _v.set(x + rnd(-0.3, 0.3), y, z), 1.05 * big, 0.7, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.18, 0.18) }); }

// ---- per-state hero choreography (runs in sim time from updateHero) ----
function cineHero(h, dt) {
  if (h.state === 'climb') {
    const C = h.cl; let pose;
    if (C.phase === 0) { // jump up to grab the ladder
      const u = clamp(h.st / 0.3, 0, 1); h.pos.x = lerp(C.x0, LADDER.x, ease(u)); h.pos.z = lerp(C.z0, LADDER.z, ease(u)); h.y = Math.sin(u * Math.PI / 2) * 0.9;
      pose = HERO_POSES.jump(1); if (u >= 1) { C.phase = 1; h.st = 0; }
    } else if (C.phase === 1) { // climb
      h.y += 10.5 * dt; pose = HERO_POSES.climb(h.y * 3.3);
      if (h.pos.y + h.y >= ROOF.y + 0.75) { C.phase = 2; h.st = 0; C.yTop = h.pos.y + h.y; }
    } else { // vault over the parapet onto the roof
      const u = clamp(h.st / 0.45, 0, 1); h.pos.z = lerp(LADDER.z, 12.7, ease(u)); const wy = lerp(C.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.7; h.y = wy - h.pos.y;
      pose = HERO_POSES.vault(u, 1);
      if (u >= 1) { h.roof = true; h.pos.y = ROOF.y; h.y = 0; h.set('move'); CAM.yaw = Math.PI; snapCam(); cut(); CINE.stats.climbs++; dust(h.pos.x, h.pos.y, h.pos.z, 3); }
    }
    return pose;
  }
  if (h.state === 'leap') {
    const L = h.lp, u = clamp(h.st / 1.3, 0, 1);
    h.pos.x = lerp(L.x0, L.x1, ease(u)); h.pos.z = lerp(L.z0, L.z1, u);
    const gy = groundY(L.x1, L.z1), wy = lerp(L.y0, gy, u * u) + 3.2 * u * (1 - u); h.pos.y = gy; h.y = Math.max(0, wy - gy);
    let pose;
    if (u < 0.12) pose = HERO_POSES.jump(1);
    else if (u < 0.85) { pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.12) / 0.6, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.4, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; }
    else { pose = HERO_POSES.jump(-1); }
    if (u >= 1) { h.roof = false; h.y = 0; h.set('getup'); h.st = 0.1; dust(h.pos.x, h.pos.y, h.pos.z, 6); S.shake = 1; sfx('heavy'); CAM.yaw = Math.PI / 2; snapCam(); cut(); CINE.stats.leaps++; }
    return pose;
  }
  if (h.state === 'vault') {
    const V = h.vt, u = clamp(h.st / 0.6, 0, 1);
    h.pos.x = lerp(V.x0, V.x1, ease(u)); h.pos.z = lerp(V.z0, V.z1, ease(u)); h.y = Math.sin(u * Math.PI) * 1.75;
    if (u >= 1) { h.y = 0; h.set('move'); collide(h); dust(h.pos.x, h.pos.y, h.pos.z, 2); CINE.stats.vaults++; }
    return HERO_POSES.vault(u, V.side);
  }
  if (h.state === 'boost') { // 0-0.45 run in, 0.45-0.7 step into the cupped hands, 0.7 LAUNCH, 0.7-1.45 flip up the wall, 1.45-1.9 vault the parapet
    const B = CINE.boost, Bh = h.bs; B.t += dt; const t = B.t; let pose;
    const ax = BOOST_P.x, az = BOOST_P.z - 1.35;
    if (t < 0.45) { const u = ease(t / 0.45); h.pos.x = lerp(Bh.x0, ax, u); h.pos.z = lerp(Bh.z0, az, u); h.yaw = Math.atan2(BOOST_P.x - h.pos.x, BOOST_P.z - h.pos.z + 0.01); pose = HERO_POSES.run(S.time, 7); }
    else if (t < 0.7) { const u = (t - 0.45) / 0.25; h.pos.z = lerp(az, BOOST_P.z - 0.35, ease(u)); h.pos.x = ax; h.y = Math.sin(u * Math.PI / 2) * 0.55; h.yaw = 0; pose = HERO_POSES.jump(1); pose.knL = pose.knR = [1.6, 0, 0]; }
    else if (t < 1.45) {
      if (!Bh.launched) { Bh.launched = true; sfx('heavy'); S.shake = Math.max(S.shake, 0.6); dust(BOOST_P.x, h.pos.y, BOOST_P.z, 4); word(BOOST_W, BOOST_P.x, h.pos.y + 2.2, BOOST_P.z - 0.4, 1.1); }
      const u = (t - 0.7) / 0.75, k = 1 - (1 - u) * (1 - u); h.pos.z = lerp(BOOST_P.z - 0.35, LADDER.z, k); h.pos.x = ax;
      const wy = lerp(h.pos.y + 0.55, ROOF.y + 1.05, k); h.y = wy - h.pos.y; Bh.yTop = wy; h.yaw = 0;
      pose = HERO_POSES.jump(1); pose.tilt = [ease(clamp(u / 0.85, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [1.9, 0, 0];
    } else {
      const u = clamp((t - 1.45) / 0.45, 0, 1); h.pos.z = lerp(LADDER.z, 12.7, ease(u)); const wy = lerp(Bh.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.45; h.y = wy - h.pos.y;
      pose = HERO_POSES.vault(u, 1); pose.tilt = [0, 0, Math.sin(u * Math.PI) * 0.6];
      if (u >= 1) { h.roof = true; h.pos.y = ROOF.y; h.y = 0; h.set('move'); CAM.yaw = Math.PI; snapCam(); cut(); CINE.stats.climbs++; CINE.boost = null; dust(h.pos.x, h.pos.y, h.pos.z, 3); boostDone(); }
    }
    return pose;
  }
  if (h.state === 'kick') {
    const u = clamp(h.st / 0.6, 0, 1); h.yaw += angTo(h.yaw, -Math.PI / 2) * (1 - Math.exp(-dt * 16));
    if (!h.kk.done && u > 0.38) {
      h.kk.done = true; DOOR.open = true; sfx('heavy'); S.shake = Math.max(S.shake, 0.7); S.hitstop = 0.08;
      spawnSprite(FXT.star, _v.set(DOOR.x + 0.2, 1.1, DOOR.z), 1.4, 0.25); word(FXT.words[4], DOOR.x + 0.6, 2.4, DOOR.z, 1.1);
      for (let k = 0; k < 4; k++) dust(DOOR.x + 0.4, 0.4, DOOR.z + rnd(-0.6, 0.6), 1);
      PIZZA.on = true; PIZZA.t = 0; PIZZA.x = DOOR.x + 0.3; PIZZA.z = DOOR.z; pizza.visible = true; CINE.stats.kicks++;
    }
    if (u >= 1) h.set('move');
    return HERO_POSES.kick(u);
  }
  // 'fin': the QTE finisher. Timeline (finisher seconds; 1.02-1.62 plays at 0.35x = slow-mo):
  //  0-0.22 dash in, 0.22-0.62 slash, 0.62-1.02 backhand, 1.02-1.62 flip cut (slow-mo), 1.62 launch, 2.1 back to play
  const F = CINE.fin, e = F.e; F.t += dt * (F.t > 1.02 && F.t < 1.62 ? 0.35 : 1);
  const t = F.t, tx = F.ex + F.ux * 1.25, tz = F.ez + F.uz * 1.25; let pose;
  h.yaw = Math.atan2(F.ex - h.pos.x, F.ez - h.pos.z);
  if (t < 0.22) { const u = ease(t / 0.22); h.pos.x = lerp(F.sx, tx, u); h.pos.z = lerp(F.sz, tz, u); pose = HERO_POSES.run(S.time, 8); }
  else if (t < 0.62) { h.pos.x = tx; h.pos.z = tz; pose = HERO_POSES.atk1((t - 0.22) / 0.4); }
  else if (t < 1.02) pose = HERO_POSES.atk2((t - 0.62) / 0.4);
  else if (t < 1.62) { const u = (t - 1.02) / 0.6; pose = HERO_POSES.airatk(u); h.y = Math.sin(u * Math.PI) * 1.9; }
  else { h.y = 0; pose = HERO_POSES.idle(S.time); }
  const at = (y) => _v.set(F.ex, y, F.ez);
  if (F.hit === 0 && t >= 0.4) { F.hit = 1; e.flash = 1; sfx('hit'); spawnSprite(FXT.star, at(e.pos.y + 1.2), 1.3, 0.22, { rot: rnd(0, TAU) }); spawnSlash(_v.set(h.pos.x, h.pos.y + 0.95, h.pos.z), h.yaw + 0.25, 'side', 0.18, 1); word(FXT.words[1], F.ex, e.pos.y + 2.2, F.ez); S.shake = 0.4; }
  if (F.hit === 1 && t >= 0.8) { F.hit = 2; e.flash = 1; sfx('hit'); spawnSprite(FXT.star, at(e.pos.y + 1.3), 1.3, 0.22, { rot: rnd(0, TAU) }); spawnSlash(_v.set(h.pos.x, h.pos.y + 0.95, h.pos.z), h.yaw - 0.25, 'side', -0.18, -1); S.shake = 0.4; }
  if (F.hit === 2 && t >= 1.62) {
    F.hit = 3; e.fin = false; e.hp = 0; e.dead = true; e.lastBy = hero; e.set('down'); e.kb.set(-F.ux * 12, -F.uz * 12); e.vy = 7.5; e.y = 0.01; e.yaw = Math.atan2(F.ux, F.uz);
    e.flash = 1; S.hits += 3; S.combo += 3; S.comboT = 1.5; S.maxCombo = Math.max(S.maxCombo, S.combo); S.shake = 1.1; sfx('heavy');
    spawnSlash(_v.set(F.ex, e.pos.y + 0.6, F.ez), h.yaw, 'spin', 0); word(FXT.words[3], F.ex, e.pos.y + 2.4, F.ez, 1.3); spawnSprite(FXT.star, at(e.pos.y + 1.0), 1.8, 0.3);
    CINE.stats.finishers++;
  }
  if (e.fin && t > 0.22) { // the dizzy thug reels under the hits
    const k = t < 0.62 ? (t - 0.4) : t < 1.02 ? (F.tagHit ? t - F.tagHit : t - 0.8) : (t - 1.02) * 0.4; applyPose(e.J, THUG_POSES.hurt(clamp(k > 0 ? k / 0.3 : 0.8, 0, 1), e.J), 22, dt, false);
    if (t > 1.02) { e.J.tilt.rotation.x = damp(e.J.tilt.rotation.x, F.tagHit ? -0.8 : -0.5, F.tagHit ? 10 : 6, dt); }
  }
  if (t >= 2.1) { h.set('move'); h.y = 0; CINE.fin = null; snapCam(); cut(); }
  return pose;
}
function snapCam() { CAM.pivot.set(hero.pos.x, hero.pos.y + 1.55, hero.pos.z); CAM.cur = CAM.dist = 4.4; IN.lastLook = -9; }

// ---- cinematic cameras (finisher cuts, climb, leap, intro) ----
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
function cineCamActive() { return !!CINE.fin || hero.state === 'climb' || hero.state === 'leap' || hero.state === 'boost'; }
function cineCamera(rdt) {
  const h = hero; let fov = 50; camera.up.set(0, 1, 0);
  if (CINE.fin) {
    const F = CINE.fin, t = F.t, px = -F.uz * F.side, pz = F.ux * F.side, mx = (h.pos.x + F.ex) / 2, mz = (h.pos.z + F.ez) / 2, gy = h.pos.y;
    const pk = VW() < VH() ? 1.55 : 1; // portrait: pull the cut cameras back so both fighters fit
    const shot = t < 0.62 ? 0 : t < 1.62 ? 1 : 2; if (shot !== F.shot) { F.shot = shot; cut(); }
    if (shot === 0) { // low, long-lens side angle with a slow dolly in
      const d = (4.6 - t * 1.2) * pk; _c1.set(mx + px * d, gy + 0.55, mz + pz * d); _c2.set(mx, gy + 1.15, mz); fov = 42;
    } else if (shot === 1) { // reverse angle over the thug's shoulder, looking up at the flip (slow-mo), dutch tilt
      const u = clamp((t - 0.62) / 1.0, 0, 1); _c1.set(mx - px * (4.8 - u * 0.7) * pk - F.ux * 1.4, gy + 1.2 + u * 0.8, mz - pz * (4.8 - u * 0.7) * pk - F.uz * 1.4); _c2.set(mx + F.ux * 0.2, gy + 1.2 + h.y * 0.5, mz + F.uz * 0.2); fov = 52;
      camera.up.set(px * 0.18, 1, pz * 0.18).normalize();
    } else { // wide follow of the launched thug
      _c1.set(F.ex - px * 6.5 * pk + F.ux * 1.5, gy + 2.6, F.ez - pz * 6.5 * pk + F.uz * 1.5); _c2.set(F.e.pos.x, F.e.pos.y + 0.8 + F.e.y * 0.5, F.e.pos.z); fov = 52;
    }
    // keep the cut cameras out of walls
    let tt = 1; for (const b of BLD) { const k = segBox(_c2.x, _c2.y, _c2.z, _c1.x, _c1.y, _c1.z, b, 0.3); if (k < tt) tt = k; }
    if (tt < 1) _c1.lerpVectors(_c2, _c1, Math.max(0.25, tt - 0.05));
  } else if (h.state === 'boost' && CINE.boost) {
    const B = CINE.boost, shot = B.t < 0.7 ? 0 : 1; if (shot !== B.shot) { if (B.shot >= 0) cut(); B.shot = shot; }
    const pk = VW() < VH() ? 1.45 : 1;
    if (shot === 0) { // low street-side two-shot: the partner braced at the wall, the hero running in
      _c1.set(BOOST_P.x - 5.6 * pk, 0.95, BOOST_P.z - 1.3); _c2.set(BOOST_P.x, 1.2, BOOST_P.z - 0.75); fov = 50; // side-on, so the run-in and the cupped hands read
    } else { // cut: high over the street, looking along the wall as the hero is flung up to the parapet
      const wy = h.pos.y + h.y; _c1.set(BOOST_P.x - 3.6 * pk, ROOF.y + 2.2, BOOST_P.z - 6.0 * pk); _c2.set(h.pos.x, lerp(wy + 0.6, ROOF.y + 0.6, 0.35), h.pos.z); fov = 56;
    }
  } else if (h.state === 'climb') { // street-level camera tilting up the fire escape
    const wy = h.pos.y + h.y; _c1.set(LADDER.x - 3.4, 1.1 + wy * 0.42, LADDER.z - 9.5); _c2.set(h.pos.x, wy + 1.0, h.pos.z); fov = 54;
  } else { // leap: low camera at the landing spot looking up at the fall
    const wy = h.pos.y + h.y; _c1.set(6.6, 0.9, 30.5); _c2.set(h.pos.x, wy + 0.9, h.pos.z); fov = 55;
  }
  camera.position.copy(_c1);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const k = S.shake * S.shake * 0.2; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); }
  camera.lookAt(_c2); setFov(fov);
}
function introCamera(rdt) {
  const I = CINE.intro; I.t += rdt; if (I.skip) I.t = Math.max(I.t, I.dur);
  const u = clamp(I.t / I.dur, 0, 1), e = ease(u);
  // crane: high over the north barricade looking down the block, travelling south and down to settle behind Harold
  _c1.set(lerp(40, hero.pos.x - 6, e), lerp(58, 5, e), lerp(32, hero.pos.z + 2, e)); _c2.set(lerp(-10, hero.pos.x + 6, e), lerp(0, 1.5, e), lerp(-30, hero.pos.z, e)); // crane: high over the harbour, sweeping in to settle behind Harold at Harborplace
  const k = ease(clamp((I.t - I.dur * 0.55) / (I.dur * 0.45), 0, 1));
  camera.position.lerpVectors(_c1, CAM.pos, k); camera.up.set(0, 1, 0); camera.lookAt(_c2.lerp(CAM.look, k)); setFov(lerp(64, 58, k));
  if (I.t >= I.dur) { CINE.intro = null; CINE.stats.introDone = true; CINE.stats.introSkipped = !!I.skip; CINE.stats.introSec = +I.t.toFixed(2); $('title').classList.remove('on'); $('hint').style.opacity = '1'; setTimeout(() => { $('hint').style.opacity = '0'; }, 8000); }
}

// ---- per rendered frame: letterbox, cut flash, prompts, door, pizza, QTE bookkeeping ----
const PRM = { el: $('prompt'), key: $('pkey'), lab: $('plab'), ico: $('pico'), ring: $('pring'), cur: null };
const ICONS = {
  power: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  sewer: '<circle cx="12" cy="12" r="8"/><path d="M6 10h12M6 14h12M10 4v16M14 4v16"/>',
  boat: '<path d="M3 15h18l-3 5H6zM12 3v10M12 4l6 7h-6"/>', car: '<path d="M4 16v-4l2-5h12l2 5v4zM4 16v2M20 16v2M7 13h1M16 13h1"/>', skate: '<path d="M3 13h18M6 13l1 4M17 13l-1 4M5 17a1 1 0 1 0 2 0M15 17a1 1 0 1 0 2 0"/>',
  act: '<circle cx="12" cy="12" r="3"/>', none: '<circle cx="12" cy="12" r="3"/>',
  climb: '<path d="M7 2v20M17 2v20M7 6h10M7 11h10M7 16h10"/>',
  drop: '<path d="M12 3v14M6 11l6 6 6-6M4 21h16"/>',
  door: '<path d="M5 21V3h11v18M16 5l4 2v14M12 12h1"/>',
  vault: '<path d="M3 18h18M6 18v-4h12v4M4 9c4-6 12-6 16 0M17 6l3 3-4 1"/>',
  fin: '<path d="M12 2l2.6 6.2L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.8z"/>',
  boost: '<path d="M12 3v11M7 8l5-5 5 5M4 17c3 3 13 3 16 0M7 21h10"/>',
  revive: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9v6M9 12h6"/>',
};
function cineUpdate(rdt) {
  const h = hero;
  // QTE bookkeeping
  if (QTE && QTE.e.state !== 'dizzy' && !QTE.e.fin) { if (QTE.e.state === 'chase' || QTE.e.state === 'return') CINE.stats.qteMissed++; QTE = null; }
  // letterbox: full in cinematics, half in fights, off when exploring
  const fighting = lockT && lockT.alive && h.state !== 'down';
  const tgt = CINE.intro || CINE.fin || h.state === 'climb' || h.state === 'leap' || h.state === 'boost' || PART.over ? 1 : h.state === 'vault' || h.state === 'kick' || QTE ? 0.75 : fighting ? 0.5 : 0;
  CINE.lb = damp(CINE.lb, tgt, CINE.intro ? 20 : 3.5, rdt);
  const portrait = VH() > VW() * 1.15, H = Math.round(CINE.lb * Math.min(VH() * (portrait ? 0.075 : 0.11), 88));
  if (H !== CINE.lbH) { CINE.lbH = H; $('lbT').style.height = H + 'px'; $('lbB').style.height = H + 'px'; }
  if (CINE.cutT > 0) { CINE.cutT = Math.max(0, CINE.cutT - rdt * 7); $('cut').style.opacity = (CINE.cutT * 0.5).toFixed(2); }
  // door swing + pizza
  if (DOOR.open) { DOOR.ang = damp(DOOR.ang, -1.55, 9, rdt); hinge.rotation.y = DOOR.ang; }
  if (PIZZA.on) {
    PIZZA.t += rdt; const u = clamp(PIZZA.t / 0.5, 0, 1); pizza.position.set(lerp(DOOR.x + 0.3, DOOR.x + 1.7, ease(u)), CURB + 0.35 + Math.sin(PIZZA.t * 3) * 0.08 + (1 - u) * Math.sin(u * Math.PI) * 0.8, DOOR.z + 0.3); pizza.rotation.y += rdt * 1.6;
    PIZZA.x = pizza.position.x; PIZZA.z = pizza.position.z;
    if (u >= 1 && !h.roof && Math.hypot(h.pos.x - PIZZA.x, h.pos.z - PIZZA.z) < 1.1) {
      PIZZA.on = false; pizza.visible = false; h.hp = Math.min(h.maxHp, h.hp + 50); CINE.stats.pizza++; sfx('ko');
      spawnSprite(PIZZA_W, _v.set(PIZZA.x, 2.2, PIZZA.z), 1.0, 0.9, { kind: 'word', aspect: 512 / 192 });
    }
  }
  // prompt: QTE first, then the nearest contextual action
  let P = null;
  const qe = qteTarget() || (QTE && QTE.e.state === 'dizzy' ? QTE.e : null);
  if (qe && !CINE.fin && h.state !== 'down' && h.state !== 'ko' && !h.roof && Math.hypot(qe.pos.x - h.pos.x, qe.pos.z - h.pos.z) < 10) {
    const e = qe, near = Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z) < 4.6; P = { kind: 'fin', label: near ? 'FINISH!' : 'GET CLOSE', x: e.pos.x, y: e.pos.y + 2.75 * e.scale, z: e.pos.z, qte: clamp(1 - e.st / DIZZY_T, 0, 1), near };
  } else if (!CINE.fin && (P = revivePrompt())) { /* REVIVE: over whichever turtle is down */ }
  else if (!CINE.fin) { const A = actionInRange(); if (A) P = { kind: A.kind, label: A.label, x: A.x, y: (h.roof ? ROOF.y : 0) + A.y, z: A.z, near: true }; }
  if (!P && !CINE.fin && DEV !== 'touch' && h.state === 'move' && POWER.cd <= 0 && inFight()) P = { kind: 'power', label: 'POWER', x: h.pos.x, y: h.pos.y + 2.5, z: h.pos.z, near: true }; // (touch: the panel's ACT button shows it)
  const el = PRM.el;
  if (P) {
    _v.set(P.x, P.y, P.z).project(camera);
    const vis = _v.z < 1 && _v.z > -1;
    let sx = (_v.x * 0.5 + 0.5) * VW(), sy = (-_v.y * 0.5 + 0.5) * VH();
    const hw = Math.min(VW() / 2 - 4, (el.offsetWidth || 140) / 2 + 6); sx = clamp(sx, hw, VW() - hw); sy = clamp(sy, 70 + (CINE.lbH || 0), VH() - 90 - (CINE.lbH || 0));
    el.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`;
    if (PRM.cur !== P.kind + P.label + DEV) { PRM.cur = P.kind + P.label + DEV; PRM.lab.textContent = P.label; PRM.ico.innerHTML = ICONS[P.kind]; PRM.key.textContent = P.nokey ? '' : DEV === 'touch' ? 'ACT' : DEV === 'pad' ? 'Y' : 'E'; el.className = 'on ' + P.kind + (DEV === 'touch' ? ' tch' : '') + (P.nokey ? ' nokey' : ''); }
    el.classList.toggle('far', !P.near); el.style.visibility = vis ? 'visible' : 'hidden';
    PRM.ring.style.strokeDashoffset = P.qte !== undefined ? (113 * (1 - P.qte)).toFixed(1) : '0';
    $('bC').classList.toggle('hot', !!P.near);
  } else if (PRM.cur) { PRM.cur = null; el.className = ''; $('bC').classList.remove('hot'); }
  const cin = !!(CINE.intro || CINE.fin || h.state === 'climb' || h.state === 'leap' || h.state === 'boost'); if (cin !== CINE.cinCls) { CINE.cinCls = cin; document.body.classList.toggle('cine', cin); }
  CINE.prompt = P ? P.kind + ':' + P.label : null;
}

// ---------------- the AI partner MAVIS (Harold's wife: grey afro, floral dress, pearls, handbag swings): always computer-controlled ----------------
// Follows at ~2-4 m on the hero's left (away from the right-shoulder camera), fights thugs engaging either turtle,
// teleports to catch up when stuck / far behind / on the wrong level, revives the hero, boosts it up the fire escape,
// and cuts into the QTE finisher (tag team). One cinematic camera: the partner never drives the camera.
const PART = { kos: 0, heroKos: 0, downs: 0, teleports: 0, hops: 0, climbs: 0, over: false, overT: 0, stuckT: 0, chkT: 0, chkD: 0, tgt: null, combo: 0, rest: 0, mismatchT: 0, fightT: 0, followSamples: 0, followIn: 0, tpLog: [] };
const PART_FIGHT = new Set(['move', 'atk', 'hurt', 'revive']); // states in which thugs may target the partner
const REVIVE_T = 1.2, PARTNER_REVIVE_T = 1.5, REVIVE_R = 2.2;
const BOOST_P = { x: LADDER.x - 1.0, z: LADDER.z - 0.6 }; // where the partner braces for the boost (beside the ladder, clear of the fire escape)
const INTRO_LAND = { x: -46, z: -34.6 }, INTRO_LAND_P = { x: -45.2, z: -34.2 }; // portrait: closer + ahead so it stays in the narrow frame
const PORTRAIT = () => VH() > VW() * 1.15;
const BOOST_W = canvasTex(512, 192, (c) => { comicText(c, 'HUP!', 256, 100, 96, '#2fd3ff', null, { sx: 1 }); });
const TAG_W = canvasTex(512, 192, (c) => { comicText(c, 'TEAMWORK!', 256, 100, 78, '#ff5fd0', null, { sx: 1 }); });
const UP_W = canvasTex(512, 192, (c) => { comicText(c, 'UP, DEAR!', 256, 100, 84, '#9dff6b', null, { sx: 1 }); });

HERO_POSES.revive = (t) => { // kneeling, both hands on the downed turtle's shell, shaking it
  const p = blank(); legsStance(p, 0.22, 0.85); p.y = -0.2; p.lgL = [-1.3, 0, 0.18]; p.knL = [2.1, 0, 0]; p.lgR = [0.1, 0, -0.2]; p.knR = [1.5, 0, 0];
  p.torso = [0.75, 0, 0]; p.neck = [-0.5, 0, 0]; const s = Math.sin(t * 10) * 0.18;
  p.shL = [-1.05 + s, 0, 0.3]; p.shR = [-1.05 - s, 0, -0.3]; p.elL = p.elR = [-0.35, 0, 0]; p.swL = [Math.PI / 2 + 1.3, 0, 0.4]; p.swR = [Math.PI / 2 + 1.3, 0, -0.4];
  return p;
};
HERO_POSES.cup = (k) => { // braced at the wall, hands cupped low (k=0) -> arms thrown overhead (k=1)
  const p = blank(); legsStance(p, 0.28, lerp(1.25, 0.15, k)); p.torso = [lerp(0.55, -0.2, k), 0, 0]; p.neck = [lerp(-0.45, -0.7, k), 0, 0];
  p.shL = [lerp(-0.7, -3.0, k), 0, 0.12]; p.shR = [lerp(-0.7, -3.0, k), 0, -0.12]; p.elL = p.elR = [lerp(-0.7, -0.1, k), 0, 0]; p.haL = p.haR = [0.5, 0, 0];
  p.swR = [Math.PI / 2 + 1.4, 0, -0.2]; return p;
};

function partnerFree() { return !PART.over && partner.hp > 0 && (partner.state === 'move' || partner.state === 'atk') && !CINE.intro; }
function boostReady() { return partnerFree() && !partner.roof && !hero.roof && Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z) < 7.5; }
function boostDone() { partner.set('pclimb'); partner.pc = { phase: 0, t: 0 }; }
function startTag(F) { partner.set('tag'); F.tag = { x0: partner.pos.x, z0: partner.pos.z }; F.tagHit = 0; partner.vel.set(0, 0); }
function actHeld() { return KEYS.has('e') || KEYS.has('f') || TOUCHS.btn.c || IN.padAct || !!(IN.bot && IN.bot.actHold); }
function reviveTarget() {
  const P = partner; if (P.state !== 'ko' || PART.over || !!P.roof !== !!hero.roof) return null;
  return Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z) < REVIVE_R ? P : null;
}
function reviveTurtle(f, by) {
  f.hp = Math.round(f.maxHp * 0.5); f.y = 0; f.vy = 0; f.kb.set(0, 0); f.set('getup'); f.inv = 2.2; f.flash = 1; f.J.mat.userData.flashC.value.set('#9dff6b');
  if (by === hero) CINE.stats.revivesByPlayer++; else CINE.stats.revivesByPartner++;
  sfx('ko'); if (f === hero) banner('BACK ON YOUR FEET!'); else spawnSprite(UP_W, _v.set(f.pos.x, f.pos.y + 2.3, f.pos.z), 1.0, 0.9, { kind: 'word', aspect: 512 / 192 });
}
function revivePrompt() {
  if (PART.over) return null;
  if (hero.state === 'ko') return { kind: 'revive', label: 'REVIVE', x: hero.pos.x, y: hero.pos.y + 1.7, z: hero.pos.z, near: false, nokey: true, qte: partner.state === 'revive' ? clamp(partner.rv / PARTNER_REVIVE_T, 0, 1) : 0 };
  if (partner.state === 'ko' && hero.hp > 0) {
    const d = Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z); if (d > 30) return null;
    const near = d < REVIVE_R && !!partner.roof === !!hero.roof;
    return { kind: 'revive', label: near ? 'HOLD · REVIVE' : 'REVIVE', x: partner.pos.x, y: partner.pos.y + 1.5, z: partner.pos.z, near, qte: hero.state === 'revive' ? clamp(hero.rv / REVIVE_T, 0, 1) : near ? 0 : undefined };
  }
  return null;
}
function partnerSlot() { // ~2.5 m off the hero's LEFT (the camera rides the right shoulder), a touch ahead
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]], side = PORTRAIT() ? 1.55 : 2.5, ahead = PORTRAIT() ? 1.3 : 0.35;
  return { x: hero.pos.x - r[0] * side + f[0] * ahead, z: hero.pos.z - r[1] * side + f[1] * ahead };
}
const _tmpF = { pos: new THREE.Vector3(), r: 0.45, roof: false };
function settle(x, z, roof) { _tmpF.pos.set(x, roof ? ROOF.y : 0, z); _tmpF.roof = roof; for (let i = 0; i < 3; i++) collide(_tmpF); return { x: _tmpF.pos.x, z: _tmpF.pos.z, y: roof ? ROOF.y : groundY(_tmpF.pos.x, _tmpF.pos.z) }; }
function puffAt(x, y, z, n = 5) { for (let k = 0; k < n; k++) spawnSprite(FXT.puff, _v.set(x + rnd(-0.5, 0.5), y + 0.3 + rnd(0, 0.9), z + rnd(-0.5, 0.5)), rnd(0.8, 1.2), 0.45, { kind: 'grow', depth: true, vel: new THREE.Vector3(rnd(-1.5, 1.5), 1.2, rnd(-1.5, 1.5)) }); }
function partnerTeleport(x, z, roof, why) { // a smoke-puff catch-up
  const P = partner; puffAt(P.pos.x, P.pos.y + P.y, P.pos.z);
  const s = settle(x, z, roof); P.roof = roof; P.pos.set(s.x, s.y, s.z); P.y = 0; P.vy = 0; P.vel.set(0, 0); P.kb.set(0, 0);
  P.yaw = Math.atan2(hero.pos.x - s.x, hero.pos.z - s.z); puffAt(s.x, s.y, s.z, 6); P.flash = 1; P.J.mat.userData.flashC.value.set('#fff');
  P.set('tp'); PART.teleports++; PART.stuckT = 0; PART.chkT = 0; PART.lastTp = why; PART.tpLog.push(why + '@' + S.time.toFixed(1)); if (PART.tpLog.length > 20) PART.tpLog.shift(); sfx('jump');
}
function partnerHop(x, z) { // a flip down off the roof to the hero's side
  const P = partner, s = settle(x, z, false);
  P.hop = { x0: P.pos.x, z0: P.pos.z, wy0: P.pos.y + P.y, x1: s.x, z1: s.z, gy: s.y }; P.set('hop'); P.vel.set(0, 0); PART.hops++; sfx('jump');
}
function engagedThugs() {
  const out = [];
  for (const e of enemies) {
    if (!e.alive || e.fin || e.state === 'dying' || e.state === 'idle' || e.state === 'return' || e.state === 'dizzy') continue;
    const dH = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z), dP = Math.hypot(e.pos.x - partner.pos.x, e.pos.z - partner.pos.z);
    if ((e.tgt === hero || e.tgt === partner || dH < 3) && dH < 10 && dP < 13) out.push(e);
  }
  return out;
}

function updatePartner(dt) {
  const P = partner; P.st += dt; P.at += dt; P.inv = Math.max(0, P.inv - dt); P.ghost = !(P.state === 'move' || P.state === 'atk' || P.state === 'hurt');
  let pose = null, rate = 16, snapTilt = false;
  const dH = Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z);
  const steer = (x, z, sp, acc = 10) => { // run toward (x,z)
    const dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) { P.vel.x = damp(P.vel.x, 0, acc, dt); P.vel.y = damp(P.vel.y, 0, acc, dt); return d; }
    const s = Math.min(sp, d * 3.2); P.vel.x = damp(P.vel.x, dx / d * s, acc, dt); P.vel.y = damp(P.vel.y, dz / d * s, acc, dt); return d;
  };
  const faceTo = (x, z, k = 12) => { P.yaw += angTo(P.yaw, Math.atan2(x - P.pos.x, z - P.pos.z)) * (1 - Math.exp(-dt * k)); };
  // ---- intro: drops in off the awning line and settles beside the hero ----
  if (CINE.intro && P.state !== 'intro' && !P.introDone) { P.set('intro'); P.root.visible = false; }
  if (P.state === 'intro') {
    const I = CINE.intro, t = I ? I.t : 99, t0 = 2.2, t1 = 3.3;
    const L = PORTRAIT() ? INTRO_LAND_P : INTRO_LAND, gy = groundY(L.x, L.z);
    if (t < t0) { P.root.visible = false; P.pos.set(L.x, gy, L.z); }
    else if (t < t1) {
      P.root.visible = true; const u = (t - t0) / (t1 - t0); P.pos.x = lerp(L.x - 6, L.x, ease(u)); P.pos.z = lerp(L.z - 4.5, L.z, u); P.pos.y = gy;
      const wy = lerp(gy + 6.2, gy, u * u) + 2.0 * u * (1 - u); P.y = Math.max(0, wy - gy); P.yaw = Math.atan2(6, 4.5);
      pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.1) / 0.75, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; snapTilt = true;
    } else {
      if (!P.landed) { P.landed = true; P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 5); S.shake = Math.max(S.shake, 0.35); sfx('heavy'); }
      P.root.visible = true; P.pos.set(L.x, gy, L.z); P.y = 0; P.yaw += angTo(P.yaw, HERO_START.yaw) * (1 - Math.exp(-dt * 5));
      pose = t - t1 < 0.45 ? HERO_POSES.getup(clamp((t - t1) / 0.45, 0, 1)) : HERO_POSES.idle(P.at);
    }
    if (!I) { P.introDone = true; P.root.visible = true; P.pos.set(L.x, gy, L.z); P.y = 0; P.set('move'); }
    finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, false); return;
  }
  P.introDone = true;
  switch (P.state) {
    case 'tp': { P.vel.set(0, 0); pose = HERO_POSES.getup(clamp(P.st / 0.3, 0, 1)); if (P.st > 0.3) P.set('move'); break; }
    case 'hop': {
      const H = P.hop, u = clamp(P.st / 1.0, 0, 1); P.pos.x = lerp(H.x0, H.x1, ease(u)); P.pos.z = lerp(H.z0, H.z1, ease(u)); P.pos.y = H.gy;
      const wy = lerp(H.wy0, H.gy, u * u) + 2.4 * u * (1 - u); P.y = Math.max(0, wy - H.gy); P.yaw = Math.atan2(H.x1 - H.x0, H.z1 - H.z0);
      pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.15) / 0.65, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; snapTilt = true;
      if (u >= 1) { P.roof = false; P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 4); P.set('getup'); P.st = 0.1; }
      finishPartner(P, pose, 18, dt, true, false); return;
    }
    case 'boost': { // braced at the wall beside the ladder; hands cupped, then the launch
      const B = CINE.boost; if (!B) { boostDone(); break; } const t = B.t;
      const u = clamp(t / 0.4, 0, 1); P.pos.x = lerp(B.px0, BOOST_P.x, ease(u)); P.pos.z = lerp(B.pz0, BOOST_P.z, ease(u)); P.pos.y = groundY(P.pos.x, P.pos.z); P.y = 0;
      P.yaw = u < 1 ? Math.atan2(BOOST_P.x - B.px0, BOOST_P.z - B.pz0 + 1e-3) : P.yaw + angTo(P.yaw, Math.PI) * (1 - Math.exp(-dt * 20));
      pose = u < 1 ? HERO_POSES.run(S.time, 7) : HERO_POSES.cup(clamp((t - 0.62) / 0.16, 0, 1)); rate = t > 0.6 ? 26 : 16;
      finishPartner(P, pose, rate, dt, false, false); return;
    }
    case 'pclimb': { // follows the hero up the ladder after a boost (or a solo climb)
      const C = P.pc; C.t += dt;
      if (C.phase === 0) {
        const d = steer(LADDER.x, LADDER.z - 0.45, 6.5); faceTo(LADDER.x, LADDER.z, 10); pose = HERO_POSES.run(P.at, Math.hypot(P.vel.x, P.vel.y));
        P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; collide(P);
        if (d < 0.35) { C.phase = 1; P.st = 0; P.pos.x = LADDER.x; P.pos.z = LADDER.z; P.yaw = 0; P.vel.set(0, 0); }
        else if (C.t > 6) { partnerTeleport(hero.pos.x, hero.pos.z + 1.5, true, 'climb-stuck'); }
      } else if (C.phase === 1) { P.y += 8.5 * dt; P.yaw = 0; pose = HERO_POSES.climb(P.y * 3.3); if (P.pos.y + P.y >= ROOF.y + 0.75) { C.phase = 2; P.st = 0; C.yTop = P.pos.y + P.y; } }
      else {
        const u = clamp(P.st / 0.45, 0, 1); P.pos.z = lerp(LADDER.z, 12.7, ease(u)); P.y = lerp(C.yTop, ROOF.y, u) + Math.sin(u * Math.PI) * 0.6 - P.pos.y; pose = HERO_POSES.vault(u, -1);
        if (u >= 1) { P.roof = true; P.pos.y = ROOF.y; P.y = 0; P.set('move'); PART.climbs++; dust(P.pos.x, P.pos.y, P.pos.z, 3); }
      }
      if (P.state === 'pclimb' || P.state === 'move') { finishPartner(P, pose || HERO_POSES.idle(P.at), 18, dt, false, false); return; }
      break;
    }
    case 'tag': { // the tag-team hit inside the finisher's slow-mo cut
      const F = CINE.fin; if (!F || !F.tag) { P.set('move'); break; }
      const t = F.t, px = -F.uz * F.side, pz = F.ux * F.side;
      const sx = F.ex - F.ux * 1.45 + px * 0.6, sz = F.ez - F.uz * 1.45 + pz * 0.6; // far side of the thug from the reverse-angle camera, so both turtles read in the slow-mo shot
      if (t < 0.62) { pose = HERO_POSES.idle(P.at); faceTo(F.ex, F.ez, 8); }
      else if (t < 1.0) { const u = ease((t - 0.62) / 0.38); P.pos.x = lerp(F.tag.x0, sx, u); P.pos.z = lerp(F.tag.z0, sz, u); P.pos.y = groundY(P.pos.x, P.pos.z); faceTo(F.ex, F.ez, 20); pose = HERO_POSES.run(S.time, 8); }
      else { P.pos.x = sx; P.pos.z = sz; P.yaw = Math.atan2(F.ex - sx, F.ez - sz); pose = (HERO_POSES.purse || HERO_POSES.atk1)(clamp((t - 1.0) / 0.32, 0, 1)); rate = 30; } // rigs: Mavis's handbag swing clip when the new rigs are on
      if (!F.tagHit && t >= 1.1) {
        F.tagHit = t; const e = F.e; e.flash = 1; sfx('hit'); S.hits++; S.combo++; S.comboT = 1.5; S.maxCombo = Math.max(S.maxCombo, S.combo); S.shake = Math.max(S.shake, 0.5);
        spawnSprite(FXT.star, _v.set(F.ex, e.pos.y + 1.15, F.ez), 1.4, 0.25, { rot: rnd(0, TAU) }); spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95, P.pos.z), P.yaw + 0.25, 'side', 0.18, 1);
        spawnSprite(TAG_W, _v.set(F.ex - F.ux * 0.4, e.pos.y + 2.3, F.ez - F.uz * 0.4), 0.9, 0.9, { kind: 'word', aspect: 512 / 192, rot: -0.1 }); CINE.stats.tags++;
      }
      if (t >= 1.62) { P.set('move'); P.at = 0; }
      finishPartner(P, pose, rate, dt, false, false); return;
    }
    case 'revive': { // the AI kneels over the downed hero
      P.vel.set(0, 0); P.inv = Math.max(P.inv, 0.2); faceTo(hero.pos.x, hero.pos.z); pose = HERO_POSES.revive(P.st); rate = 14;
      if (hero.state !== 'ko') { P.set('move'); break; }
      P.rv += dt; if (P.rv >= PARTNER_REVIVE_T) { reviveTurtle(hero, P); P.set('move'); }
      break;
    }
    case 'hurt': { P.vel.set(P.kb.x, P.kb.y); P.kb.multiplyScalar(Math.exp(-dt * 7)); pose = HERO_POSES.hurt(clamp(P.st / 0.35, 0, 1)); rate = 22; if (P.st > 0.35) P.set('move'); break; }
    case 'down': {
      P.vel.set(P.kb.x, P.kb.y); P.kb.multiplyScalar(Math.exp(-dt * 3.5)); P.vy -= 22 * dt; P.y = Math.max(0, P.y + P.vy * dt);
      pose = HERO_POSES.down(P.st, P.y <= 0 && P.st > 0.2); rate = 14;
      if (P.hp <= 0 && P.st > 0.9 && P.y <= 0) { P.set('ko'); P.kb.set(0, 0); }
      else if (P.hp > 0 && P.st > 1.0) { P.set('getup'); P.inv = 1.0; }
      break;
    }
    case 'ko': { P.vel.set(0, 0); pose = HERO_POSES.down(1, true); rate = 14; break; }
    case 'getup': { P.vel.set(0, 0); pose = HERO_POSES.getup(clamp(P.st / 0.45, 0, 1)); rate = 14; if (P.st > 0.45) P.set('move'); break; }
    case 'atk': {
      const A = ATK[P.atkN], dur = A.dur * 1.08, u = P.st / dur, T = P.atkT; rate = 30;
      let lsp = 0; if (T && T.alive && T.state !== 'dying') { const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, d = Math.hypot(dx, dz); P.yaw += angTo(P.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 18)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 8) : 0; }
      P.vel.set(Math.sin(P.yaw) * lsp, Math.cos(P.yaw) * lsp);
      const skip = (e) => e.state === 'dizzy' || e.fin; // dizzy thugs are left for the hero's QTE
      if (!P.hitDone && P.st >= A.hit * dur) { P.hitDone = true; spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95 + (P.atkN === 3 ? 0.25 : 0), P.pos.z), P.yaw + (P.atkN === 1 ? 0.25 : P.atkN === 2 ? -0.25 : 0), A.slash, A.roll, P.atkN === 2 ? -1 : 1); resolveSwing(A, P.atkN === 3, P, skip); }
      if (P.atkN === 3 && !P.hit2 && P.st >= 0.62 * dur) { P.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true, P, skip); }
      pose = HERO_POSES[A.pose](Math.min(u, 1)); snapTilt = P.atkN === 3;
      if (u >= 1) { PART.combo++; const n = PART.combo; P.set('move'); P.at = 0; if (n >= PART.comboLen || !(T && T.alive)) { PART.combo = 0; PART.rest = rnd(0.35, 0.7); } else PART.next = n + 1; }
      break;
    }
    case 'idle': case 'move': default: {
      P.state = 'move'; PART.rest = Math.max(0, PART.rest - dt);
      if (PART.over) { P.vel.set(0, 0); pose = HERO_POSES.idle(P.at); break; }
      const busyHero = hero.state === 'climb' || hero.state === 'leap' || hero.state === 'boost';
      // 1. the hero is down: get there (teleport if far / other level) and revive
      if (hero.state === 'ko') {
        if (!!P.roof !== !!hero.roof || dH > 12) { partnerTeleport(hero.pos.x - 1.1, hero.pos.z + 0.4, !!hero.roof, 'revive'); break; }
        const d = steer(hero.pos.x, hero.pos.z, 8.6, 14); faceTo(hero.pos.x, hero.pos.z);
        pose = HERO_POSES.run(P.at, Math.hypot(P.vel.x, P.vel.y));
        if (d < 1.15) { P.set('revive'); P.rv = 0; P.vel.set(0, 0); }
        else { PART.chkT += dt; if (PART.chkT > 1.2) { if (PART.chkD - d < 0.5) partnerTeleport(hero.pos.x - 1.1, hero.pos.z + 0.4, !!hero.roof, 'revive-stuck'); PART.chkT = 0; PART.chkD = d; } }
        break;
      }
      // 2. on a different level from the hero: climb after / hop down / teleport
      if (!!P.roof !== !!hero.roof && !busyHero) {
        PART.mismatchT += dt;
        if (hero.roof) { if (Math.hypot(P.pos.x - LADDER.x, P.pos.z - LADDER.z) < 14) { P.set('pclimb'); P.pc = { phase: 0, t: 0 }; } else partnerTeleport(hero.pos.x - 1.5, hero.pos.z + 1.5, true, 'roof'); }
        else if (PART.mismatchT > 0.35) { const sl = partnerSlot(); if (Math.hypot(sl.x - P.pos.x, sl.z - P.pos.z) < 16) partnerHop(sl.x, sl.z); else partnerTeleport(sl.x, sl.z, false, 'street'); }
        if (P.state !== 'move') break;
      } else PART.mismatchT = 0;
      if (busyHero && !!P.roof !== !!hero.roof) { P.vel.set(0, 0); pose = HERO_POSES.idle(P.at); break; }
      // 3. far behind (or lost): smoke-puff catch-up
      if (dH > 16) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'far'); break; }
      // 4. fight: thugs engaging either turtle (the ones winding up on the hero first)
      let T = PART.tgt; const eng = engagedThugs();
      if (!T || !eng.includes(T)) { T = null; let bs = 1e9; for (const e of eng) { const s = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) - ((e.state === 'windup' || e.state === 'attack') && e.tgt === hero ? 2.5 : 0) + (e.state === 'down' ? 3 : 0); if (s < bs) { bs = s; T = e; } } PART.tgt = T; }
      let gx, gz, sp, d;
      if (T && !P.roof) {
        PART.fightT += dt; const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, dT = Math.hypot(dx, dz);
        if (dT < 1.75 && PART.rest <= 0 && T.state !== 'down') { // swing
          const n = PART.combo > 0 ? PART.next || 1 : 1; if (PART.combo === 0) PART.comboLen = Math.random() < 0.55 ? 3 : 2;
          P.set('atk'); P.atkN = Math.min(3, n); P.atkT = T; P.hitDone = false; P.hit2 = false; P.yaw = Math.atan2(dx, dz); sfx('swing');
          pose = HERO_POSES.idle(P.at); break;
        }
        gx = T.pos.x - dx / (dT || 1) * 1.35; gz = T.pos.z - dz / (dT || 1) * 1.35; sp = 7.4;
        d = steer(gx, gz, sp, 12); faceTo(T.pos.x, T.pos.z, 10);
      } else { // follow: hold the slot on the hero's left, 2-4 m away
        PART.combo = 0; const sl = partnerSlot(); gx = sl.x; gz = sl.z;
        const dS = Math.hypot(gx - P.pos.x, gz - P.pos.z);
        if (dS < 0.9 && dH > 1.6 && dH < 4.3) { P.vel.x = damp(P.vel.x, 0, 10, dt); P.vel.y = damp(P.vel.y, 0, 10, dt); d = dS; const ff = camFwd(CAM.yaw); if (hero.speed < 0.5) faceTo(P.pos.x + ff[0], P.pos.z + ff[1], 3); }
        else { sp = dS > 4 ? 8.6 : clamp(dS * 2.6, 2.2, 7.0); d = steer(gx, gz, sp, 9); if (Math.hypot(P.vel.x, P.vel.y) > 0.5) faceTo(P.pos.x + P.vel.x, P.pos.z + P.vel.y, 12); }
        // stay out of the camera's line to the hero (it rides the right shoulder; never stand between it and the hero)
        const cx = CAM.pos.x, cz = CAM.pos.z, hx = hero.pos.x - cx, hz = hero.pos.z - cz, L2 = hx * hx + hz * hz;
        if (L2 > 0.5) { const u = ((P.pos.x - cx) * hx + (P.pos.z - cz) * hz) / L2; if (u > 0 && u < 1.05) { const qx = cx + hx * u, qz = cz + hz * u, ox = P.pos.x - qx, oz = P.pos.z - qz, od = Math.hypot(ox, oz);
          if (od < 1.1) { const nx = od > 1e-3 ? ox / od : -hz / Math.sqrt(L2), nz = od > 1e-3 ? oz / od : hx / Math.sqrt(L2); P.vel.x += nx * 5 * (1.1 - od); P.vel.y += nz * 5 * (1.1 - od); PART.camDodge = (PART.camDodge || 0) + dt; } } }
        if (dH < 1.5 && dH > 1e-3) { const k = (1.5 - dH) * 6; P.vel.x += (P.pos.x - hero.pos.x) / dH * k; P.vel.y += (P.pos.z - hero.pos.z) / dH * k; } // give the hero room
        PART.followSamples++; if (dH >= 1.6 && dH <= 4.6) PART.followIn++;
      }
      // stuck check against the current goal
      // (stuck = wants to cover >3 m but has barely moved for a second: blocked by a car / wall / crowd)
      PART.chkT += dt; if (PART.chkT > 1.0) { const dg = Math.hypot(gx - P.pos.x, gz - P.pos.z), mv = Math.hypot(P.pos.x - (PART.chkX ?? P.pos.x), P.pos.z - (PART.chkZ ?? P.pos.z)); if (dg > 3 && mv < 0.9) PART.stuckT += PART.chkT; else PART.stuckT = 0; PART.chkT = 0; PART.chkX = P.pos.x; PART.chkZ = P.pos.z; }
      if (PART.stuckT >= 2.0) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'stuck'); break; }
      const spd = Math.hypot(P.vel.x, P.vel.y); P.speed = spd; pose = spd > 0.6 ? HERO_POSES.run(P.at, spd) : HERO_POSES.idle(P.at);
      if (spd > 4 && Math.random() < dt * 4) dust(P.pos.x, P.pos.y, P.pos.z, 1);
      break;
    }
  }
  if (P.state !== 'tp' || P.st > 0) { P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; }
  if (P.state !== 'pclimb') collide(P);
  finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, true);
}
function finishPartner(P, pose, rate, dt, snapTilt, tails) {
  applyPose(P.J, pose, rate, dt, snapTilt);
  for (const [i, t] of P.J.tails.entries()) t.rotation.x = damp(t.rotation.x, 0.5 + clamp(Math.hypot(P.vel.x, P.vel.y) / 6, 0, 1) * 0.9 + Math.sin(S.time * 11 + i + 2) * 0.12, 10, dt);
  P.sync(dt);
  // both turtles down = game over: a beat, then both back on their feet at the south end of the street
  if (!PART.over && hero.state === 'ko' && P.state === 'ko') { PART.over = true; PART.overT = 0; banner('GAME OVER', 3.4); CINE.stats.gameOvers++; }
  if (PART.over) { PART.overT += dt; if (PART.overT > 3.2) resetTurtles(); }
}
function resetTurtles() {
  PART.over = false; QTE = null;
  for (const [f, x, z] of [[hero, HERO_START.x, HERO_START.z], [partner, INTRO_LAND.x, INTRO_LAND.z]]) { f.roof = false; f.pos.set(x, groundY(x, z), z); f.y = 0; f.vy = 0; f.vel.set(0, 0); f.kb.set(0, 0); f.hp = f.maxHp; f.yaw = HERO_START.yaw; f.set('getup'); f.inv = 3; f.root.visible = true; }
  for (const e of enemies) if (e.alive && e.state !== 'dying') { e.hp = e.maxHp; e.dizzied = false; e.fin = false; e.y = 0; e.set('return'); }
  CAM.yaw = HERO_START.camYaw; snapCam(); cut(); banner('TRY AGAIN!', 1.4);
}

// ======================= COUCH CO-OP: Player 2 drives MAVIS (COOP_PLAN.md) =======================
// Drop-in: P1 = keyboard + touch + the first pad that sends input (sticky); any OTHER pad pressing Start or A joins as P2 (Mavis's AI
// switches off, the pad drives her). Keyboard / touch P1 + one pad: Start on the pad joins it as P2. P2 leaves: pad unplugged, or hold Start 3 s.
// Camera: one SHARED view framing both while together (pulls back + tilts as they spread, max MAXSEP apart); a toad walking away at the edge is
// HELD there. Only an INTENTIONAL leave splits: in 'move', at the edge, stick held away from the partner for SPLIT_T (2 s) continuously
// (0.15 s jitter grace; hits, jumps, swings, cinematics, letting go all reset it). Split = two views (side by side in landscape, stacked in
// portrait), same world. Back within MERGE_D on the same level for 0.4 s = smooth merge. Bosses / minigames (own-scene modes) = TURN ROTATION:
// P1's pad only while P1 plays; on exit a P2'S TURN card (P2: A play / B skip) replays the same ring with P2's pad.
// With no second pad COOP.on stays false and every call site in 06_game / 07_main takes its original path.
const COOP = (function () {
  const C = { on: false, p1: null, p2: null, kbUsed: false, prevR: {}, prev2: [], split: false, k: 0, edgeT: 0, edgeWho: null, graceT: 0, mergeT: 0, levelT: 0, farT: 0, koT: 0,
    leaveT: 0, turn: 0, mode: null, modeAct: null, lastAct: null, lastActT: -1e9, card: null, cardT: 0, log: [], splits: 0, merges: 0, holds: 0, joins: 0, turns: 0, draws2: 0 };
  const SPLIT_T = 2.0, GRACE = 0.15;
  const portraitNow = () => VW() / VH() < 1 / 1.15;
  const MAXSEP = () => (portraitNow() ? 10 : 13), MERGE_D = () => (portraitNow() ? 7.5 : 9);
  const IN2 = { mx: 0, my: 0, look: 0, lookY: 0, dragX: 0, dragY: 0, lastLook: -9, atk: false, jump: false, act: false, actHeld: false, aE: false, bE: false };
  const SH = { yaw: 0, pitch: 0.17, dist: 6, pivot: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const CAM2 = { yaw: 0, pitch: 0.17, dist: 4.4, cur: 4.4, sh: 0.72, pivot: new THREE.Vector3(), look: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 58, lockYawT: 0, fightK: 0, aspect: 1 };
  const camera2 = new THREE.PerspectiveCamera(62, 1, 0.12, 260);
  const rawGP = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  const log = (s) => { C.log.push(s + '@' + (typeof S !== 'undefined' ? S.time.toFixed(1) : 0)); if (C.log.length > 60) C.log.shift(); };
  // ---- turn rotation: while a mode runs, the mode only sees the active player's pad ----
  if (navigator.getGamepads) { try { Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: function () { const a = rawGP(); return C.on && C.mode ? filterPads(a) : a; } }); } catch (e) {} }
  function filterPads(a) { const act = C.turn === 1 ? C.p2 : C.p1; const out = []; for (let i = 0; i < a.length; i++) { const g = a[i]; out.push(g && (g.index === act || (C.turn === 0 && C.p1 === null && g.index !== C.p2)) ? g : null); } return out; }
  addEventListener('keydown', () => { C.kbUsed = true; });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') C.kbUsed = true; }, true);
  addEventListener('gamepaddisconnected', (e) => { const i = e.gamepad && e.gamepad.index; if (i === C.p2) leave('unplugged'); else if (i === C.p1) C.p1 = null; });
  const pressedB = (gp, k) => !!(gp.buttons[k] && gp.buttons[k].pressed);
  function anyIn(gp) { if (gp.buttons.some((b) => b && b.pressed)) return true; for (let i = 0; i < Math.min(4, gp.axes.length); i++) if (Math.abs(gp.axes[i] || 0) > 0.5) return true; return false; }
  // called by readInput (06_game) for every pad: 'p1' = feeds Harold as before; anything else is skipped there
  function padRole(gp) {
    const i = gp.index; if (C.p2 === i) return 'p2';
    const pv = C.prevR[i] || [], startE = pressedB(gp, 9) && !pv[9], aE = pressedB(gp, 0) && !pv[0]; let role;
    if (C.p1 === null) {
      if (startE && C.kbUsed && C.p2 === null && !C.mode) { join(i); role = 'join'; } // keyboard / touch is P1: Start on the pad joins it as P2
      else { if (anyIn(gp)) C.p1 = i; role = 'p1'; }
    } else if (C.p1 === i) role = 'p1';
    else if ((startE || aE) && C.p2 === null && !C.mode) { join(i); role = 'join'; }
    else role = 'skip';
    C.prevR[i] = gp.buttons.map((x) => !!(x && x.pressed));
    return role;
  }
  // ---- HUD bits (injected; no index.html edit) ----
  const st = document.createElement('style');
  st.textContent = `
  #coopdiv { position: fixed; z-index: 4; background: #14101f; pointer-events: none; display: none; box-shadow: 0 0 0 1px #ff9ad0; }
  .cooptag { position: fixed; z-index: 5; font: 9px/1 'PX', monospace; color: #fff; background: #14101f; border: 2px solid #000; padding: 3px 5px; pointer-events: none; display: none; }
  #cooptag2 { color: #ff9ad0; } #cooptag1 { color: #9dff6b; }
  #coopedge { position: fixed; z-index: 6; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; pointer-events: none; display: none;
    background: conic-gradient(#ff9ad0 calc(var(--p) * 1turn), rgba(20,16,31,.55) 0); -webkit-mask: radial-gradient(circle, transparent 13px, #000 14px); mask: radial-gradient(circle, transparent 13px, #000 14px); }
  #coopedgeL { position: fixed; z-index: 6; font: 7px/1 'PX', monospace; color: #fff; text-shadow: 1px 1px 0 #000; pointer-events: none; display: none; transform: translate(-50%, 0); white-space: nowrap; }
  #coopturn { position: fixed; z-index: 30; left: 50%; top: 34%; transform: translate(-50%, -50%); background: #1a1220; border: 3px solid #000; box-shadow: 4px 4px 0 #000; padding: 12px 16px; text-align: center; font: 12px/1.6 'PX', monospace; color: #ff9ad0; display: none; pointer-events: none; max-width: 90vw; }
  #coopturn b { display: block; font-size: 18px; color: #fff; margin-bottom: 4px; } #coopturn i { display: block; font-style: normal; color: #ffe08a; font-size: 10px; }
  @media (max-width: 480px) { #coopturn { font-size: 9px; } #coopturn b { font-size: 13px; } }`;
  document.head.appendChild(st);
  const mk = (id, cls) => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); return e; };
  const elDiv = mk('coopdiv'), elT1 = mk('cooptag1', 'cooptag'), elT2 = mk('cooptag2', 'cooptag'), elEdge = mk('coopedge'), elEdgeL = mk('coopedgeL'), elTurn = mk('coopturn');
  elT1.textContent = 'P1 HAROLD'; elT2.textContent = 'P2 MAVIS'; elEdgeL.textContent = 'KEEP GOING TO SPLIT';
  let tagSpr = null;
  function tags() { if (tagSpr) return tagSpr; const mkS = (txt, col) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 128, (c) => comicText(c, txt, 128, 66, 84, col, null, { sx: 1 })), depthTest: false, transparent: true })); s.scale.set(0.9, 0.45, 1); s.renderOrder = 20; s.visible = false; scene.add(s); return s; };
    tagSpr = [mkS('P1', '#9dff6b'), mkS('P2', '#ff9ad0')]; return tagSpr; }
  const hideHud = () => { for (const e of [elDiv, elT1, elT2, elEdge, elEdgeL]) e.style.display = 'none'; if (tagSpr) tagSpr.forEach((s) => (s.visible = false)); };
  // ---- join / leave ----
  function join(i) {
    C.p2 = i; C.on = true; C.joins++; C.split = false; C.k = 0; C.edgeT = 0; C.turn = 0; C.prev2 = []; log('join:pad' + i);
    initShared(true);
    const P = partner; if (Math.hypot(P.pos.x - hero.pos.x, P.pos.z - hero.pos.z) > MAXSEP() * 0.8 || !!P.roof !== !!hero.roof) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'coop-join'); }
    if (P.state === 'revive') P.set('move');
    const n = $('p2n'); if (n) n.textContent = 'P2 MAVIS'; tags();
    if (typeof banner === 'function') banner('PLAYER 2 JOINED!', 1.8); sfx('ko');
  }
  function leave(why) {
    if (!C.on) return; log('leave:' + why); if (C.split || C.k > 0) merge(true);
    C.on = false; C.p2 = null; C.card = null; elTurn.style.display = 'none'; C.turn = 0;
    delete CAM.aspect; camera.aspect = VW() / VH(); camera.far = 260; camera.updateProjectionMatrix(); CAM.yaw = SH.yaw;
    if (partner.state === 'air' || partner.state === 'airatk') { partner.y = 0; partner.vy = 0; partner.set('move'); } else if (partner.state === 'revive') partner.set('move');
    const n = $('p2n'); if (n) n.textContent = 'MAVIS'; hideHud();
    resize(); if (typeof banner === 'function') banner('PLAYER 2 LEFT', 1.4);
  }
  // ---- P2 input (raw pad) ----
  function readP2(dt) {
    const gp = rawGP()[C.p2]; IN2.atk = IN2.jump = IN2.act = false;
    if (!gp || gp.connected === false) { leave('gone'); return false; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v), b = (k) => pressedB(gp, k), pv = C.prev2;
    let mx = dz(gp.axes[0] || 0), my = -dz(gp.axes[1] || 0); if (b(14)) mx -= 1; if (b(15)) mx += 1; if (b(12)) my += 1; if (b(13)) my -= 1;
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    let look = dz(gp.axes[2] || 0); if (b(4)) look -= 1; if (b(5)) look += 1;
    IN2.mx = mx; IN2.my = my; IN2.look = clamp(look, -1, 1); IN2.lookY = dz(gp.axes[3] || 0); if (IN2.look || IN2.lookY) IN2.lastLook = S.time;
    const e = (k) => b(k) && !pv[k];
    IN2.aE = IN2.aE || e(0); IN2.bE = IN2.bE || e(1); IN2.jump = e(0); IN2.atk = e(2) || e(1); IN2.act = e(3); IN2.actHeld = b(3);
    if (e(8) && !C.card) FMAP.open('pad');
    C.leaveT = b(9) ? C.leaveT + dt : 0; // hold Start ~3 s to drop out
    C.prev2 = gp.buttons.map((x) => !!(x && x.pressed));
    if (C.card) { IN2.mx = IN2.my = 0; IN2.atk = IN2.jump = IN2.act = false; IN2.actHeld = false; }
    if (C.leaveT > 3) { leave('start-held'); return false; }
    return true;
  }
  // ---- P2 drives Mavis (scripted states: intro / tp / hop / boost / pclimb / tag / hurt / down / getup / ko stay in 06c updatePartner) ----
  const OWN = new Set(['move', 'idle', 'atk', 'air', 'airatk', 'revive']);
  function p2Target(dx, dz, maxD) { const P = partner; let best = null, bs = 1e9;
    for (const e of enemies) { if (!e.alive || e.state === 'dying' || e.state === 'drown' || e.fin) continue; const ex = e.pos.x - P.pos.x, ez = e.pos.z - P.pos.z, d = Math.hypot(ex, ez); if (d > maxD) continue;
      const ang = Math.acos(clamp((ex * dx + ez * dz) / (d || 1), -1, 1)), s = d + ang * 2.2 + (e.state === 'down' ? 4 : 0); if (s < bs) { bs = s; best = e; } }
    return best; }
  function p2Attack(n, wx, wz) { const P = partner; P.set('atk'); P.atkN = n; P.queued = false; P.hitDone = false; P.hit2 = false;
    let dx = Math.sin(P.yaw), dz = Math.cos(P.yaw); const wl = Math.hypot(wx, wz); if (wl > 0.1) { dx = wx / wl; dz = wz / wl; }
    const t = p2Target(dx, dz, 5.2); P.atkT = t; P.yaw = t ? Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z) : Math.atan2(dx, dz); sfx('swing'); }
  function p2Revivable() { const H = hero; return H.state === 'ko' && !PART.over && !!H.roof === !!partner.roof && Math.hypot(H.pos.x - partner.pos.x, H.pos.z - partner.pos.z) < REVIVE_R ? H : null; }
  function updateP2(dt) {
    const P = partner; if (!OWN.has(P.state) || CINE.intro || PART.over) { updatePartner(dt); return; }
    P.st += dt; P.at += dt; P.inv = Math.max(0, P.inv - dt); P.ghost = !(P.state === 'move' || P.state === 'atk');
    const f = camFwd(C.split ? CAM2.yaw : CAM.yaw), r = [-f[1], f[0]];
    const wx = r[0] * IN2.mx + f[0] * IN2.my, wz = r[1] * IN2.mx + f[1] * IN2.my, wl = Math.hypot(wx, wz);
    let pose, rate = 16, snapTilt = false;
    const move = (spd, acc) => { P.vel.x = damp(P.vel.x, wx * spd, acc, dt); P.vel.y = damp(P.vel.y, wz * spd, acc, dt); };
    switch (P.state) {
      case 'idle': case 'move': {
        P.state = 'move'; move(6.6, 12); if (wl > 0.1) P.yaw += angTo(P.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 14));
        P.speed = Math.hypot(P.vel.x, P.vel.y); pose = P.speed > 0.6 ? HERO_POSES.run(P.at, P.speed) : HERO_POSES.idle(P.at);
        if (P.speed > 4 && Math.random() < dt * 4) dust(P.pos.x, P.pos.y, P.pos.z, 1);
        if (IN2.actHeld && p2Revivable()) { P.set('revive'); P.rv = 0; P.vel.set(0, 0); break; }
        if (IN2.atk) p2Attack(1, wx, wz); else if (IN2.jump) { P.set('air'); P.vy = 8.2; sfx('jump'); dust(P.pos.x, P.pos.y, P.pos.z, 3); }
        break;
      }
      case 'atk': {
        const A = ATK[P.atkN] || ATK[1], u = P.st / A.dur, T = P.atkT; P.speed = 0;
        let lsp = u < 0.45 ? 2.2 : 0;
        if (T && T.alive && T.state !== 'dying') { const dx = T.pos.x - P.pos.x, dz = T.pos.z - P.pos.z, d = Math.hypot(dx, dz); P.yaw += angTo(P.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 20)); lsp = u < 0.45 ? clamp((d - 1.3) * 6, 0, 9) : 0; }
        P.vel.set(Math.sin(P.yaw) * lsp, Math.cos(P.yaw) * lsp);
        const skip = (e) => e.fin;
        if (!P.hitDone && P.st >= A.hit * A.dur) { P.hitDone = true; spawnSlash(_v.set(P.pos.x, P.pos.y + 0.95 + (P.atkN === 3 ? 0.25 : 0), P.pos.z), P.yaw + (P.atkN === 1 ? 0.25 : P.atkN === 2 ? -0.25 : 0), A.slash, A.roll, P.atkN === 2 ? -1 : 1); resolveSwing(A, P.atkN === 3, P, skip); }
        if (P.atkN === 3 && !P.hit2 && P.st >= 0.62 * A.dur) { P.hit2 = true; resolveSwing(Object.assign({}, A, { dmg: 1, heavy: true }), true, P, skip); }
        if (IN2.atk && u > 0.25) P.queued = true;
        if (u >= (P.atkN === 3 ? 1 : 0.78) && P.queued && P.atkN < 3) p2Attack(P.atkN + 1, wx, wz);
        else if (u >= 1) { P.set('move'); P.at = 0; }
        pose = (P.atkN === 3 && HERO_POSES.purse ? HERO_POSES.purse : HERO_POSES[A.pose])(Math.min(u, 1)); rate = 30; snapTilt = P.atkN === 3;
        if (IN2.jump && u > 0.6) { P.set('air'); P.vy = 8.2; sfx('jump'); }
        break;
      }
      case 'air': case 'airatk': {
        move(6.0, 4); P.vy -= 24 * dt; P.y += P.vy * dt;
        if (wl > 0.1 && P.state === 'air') P.yaw += angTo(P.yaw, Math.atan2(wx, wz)) * (1 - Math.exp(-dt * 8));
        if (P.state === 'air' && IN2.atk) { P.set('airatk'); P.vy = Math.max(P.vy, 3.5); const t = p2Target(Math.sin(P.yaw), Math.cos(P.yaw), 5); if (t) P.yaw = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z); sfx('swing'); }
        if (P.state === 'airatk') { pose = HERO_POSES.airatk(P.st / 0.42); snapTilt = true; rate = 30; if (P.st > 0.25) P.vy = Math.min(P.vy, -10); } else pose = HERO_POSES.jump(P.vy);
        if (P.y <= 0) { P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 3);
          if (P.state === 'airatk') { spawnSlash(_v.set(P.pos.x, P.pos.y + 0.4, P.pos.z), P.yaw, 'spin', 0); resolveSwing({ range: 2.6, cone: Math.PI, dmg: 3, heavy: true }, true, P, (e) => e.fin); S.shake = Math.max(S.shake, 0.5); }
          P.vy = 0; P.set('move'); P.J.tilt.rotation.x = 0; }
        break;
      }
      case 'revive': {
        P.vel.set(0, 0); P.inv = Math.max(P.inv, 0.2); const H = p2Revivable(); pose = HERO_POSES.revive(P.st); rate = 14;
        if (H) P.yaw += angTo(P.yaw, Math.atan2(H.pos.x - P.pos.x, H.pos.z - P.pos.z)) * (1 - Math.exp(-dt * 12));
        if (!H || !IN2.actHeld) { P.rv = 0; P.set('move'); break; }
        P.rv = (P.rv || 0) + dt; if (P.rv >= REVIVE_T) { reviveTurtle(hero, P); P.set('move'); log('p2revive'); }
        break;
      }
    }
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.y * dt; collide(P);
    finishPartner(P, pose || HERO_POSES.idle(P.at), rate, dt, snapTilt, true);
  }
  // ---- per step: remember positions, read P2 ----
  const P0 = { hx: 0, hz: 0, px: 0, pz: 0 };
  function preStep(dt) { P0.hx = hero.pos.x; P0.hz = hero.pos.z; P0.px = partner.pos.x; P0.pz = partner.pos.z; readP2(dt); }
  const P2FREE = new Set(['move', 'idle', 'atk', 'air', 'airatk', 'revive', 'hurt', 'down', 'getup', 'ko']);
  function worldIn(I, yaw) { const f = camFwd(yaw), r = [-f[1], f[0]]; return [r[0] * I.mx + f[0] * I.my, r[1] * I.mx + f[1] * I.my]; }
  function step(dt) {
    if (!C.on) return;
    const H = hero, P = partner; let dx = P.pos.x - H.pos.x, dz = P.pos.z - H.pos.z, sep = Math.hypot(dx, dz);
    const scripted = CINE.intro || PART.over || CINE_ST.has(H.state) || !P2FREE.has(P.state), levels = !!H.roof !== !!P.roof, MS = MAXSEP();
    C.dbg = { intro: !!CINE.intro, over: PART.over, hs: H.state, ps: P.state, levels, sep: +sep.toFixed(2) };
    if (!C.split) {
      // 1. held at the edge: remove the away-from-partner part of this step's motion (walking, knockback, jumps alike)
      if (!scripted && !levels && sep > MS) {
        const prevSep = Math.hypot(P0.px - P0.hx, P0.pz - P0.hz), lim = Math.max(MS, prevSep);
        if (sep > lim + 1e-4) { const ux = dx / sep, uz = dz / sep;
          const a1 = Math.max(0, -((H.pos.x - P0.hx) * ux + (H.pos.z - P0.hz) * uz)), a2 = Math.max(0, (P.pos.x - P0.px) * ux + (P.pos.z - P0.pz) * uz), ex = sep - lim, tot = a1 + a2;
          const s1 = tot > 1e-6 ? ex * a1 / tot : ex / 2, s2 = ex - s1;
          H.pos.x += ux * s1; H.pos.z += uz * s1; P.pos.x -= ux * s2; P.pos.z -= uz * s2; collide(H); collide(P); C.holds++;
          dx = P.pos.x - H.pos.x; dz = P.pos.z - H.pos.z; sep = Math.hypot(dx, dz); }
      }
      // 2. the intentional-split timer: someone in 'move', at the edge, stick held away from the partner, 2 s without a break
      let who = null;
      if (!scripted && !levels && sep >= MS - 0.3 && !C.card) { const ux = dx / sep, uz = dz / sep;
        const yw = CAM.yaw, w1 = worldIn(IN, yw), w2 = worldIn(IN2, yw), m1 = Math.hypot(w1[0], w1[1]), m2 = Math.hypot(w2[0], w2[1]);
        if (H.state === 'move' && m1 > 0.5 && -(w1[0] * ux + w1[1] * uz) / m1 > 0.45) who = 'p1';
        else if (P.state === 'move' && m2 > 0.5 && (w2[0] * ux + w2[1] * uz) / m2 > 0.45) who = 'p2'; }
      if (who && (C.edgeWho === who || C.edgeT === 0)) { C.edgeT += dt; C.edgeWho = who; C.graceT = 0; }
      else { C.graceT += dt; if (C.graceT > GRACE) { C.edgeT = 0; C.edgeWho = null; } }
      if (C.edgeT >= SPLIT_T) doSplit();
      // 3. different levels in one view (Harold climbed / dropped): puff Mavis over
      if (levels && !scripted && P.state === 'move') { C.levelT += dt; if (C.levelT > 0.5) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-level'); C.levelT = 0; } } else C.levelT = 0;
      // 4. carried far apart by a cinematic: puff Mavis back beside Harold
      if (!scripted && sep > MS * 1.5 && P.state === 'move') { C.farT += dt; if (C.farT > 1) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-far'); C.farT = 0; } } else C.farT = 0;
    } else {
      C.edgeT = 0;
      if (sep < MERGE_D() && !levels && !scripted) { C.mergeT += dt; if (C.mergeT > 0.4) merge(false); } else C.mergeT = 0;
      if (sep < MERGE_D() && levels && !scripted && P.state === 'move') { C.levelT += dt; if (C.levelT > 1.0) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!H.roof, 'coop-level'); C.levelT = 0; } } else if (!levels) C.levelT = 0;
    }
    // a toad KO'd far from its partner (split) gets back up beside the partner after 8 s
    const down = H.state === 'ko' ? H : P.state === 'ko' ? P : null, other = down === H ? P : H;
    if (down && other.hp > 0 && other.state !== 'ko' && sep > 20 && !PART.over) { C.koT += dt; if (C.koT > 8) { const s = settle(other.pos.x - 1.2, other.pos.z + 0.6, !!other.roof); down.roof = !!other.roof; down.pos.set(s.x, s.y, s.z); reviveTurtle(down, other); C.koT = 0; log('farRevive'); } } else C.koT = 0;
    if (PART.over && (C.split || C.k > 0)) merge(true);
  }
  function doSplit() { C.split = true; C.splits++; C.edgeT = 0; C.mergeT = 0; log('split:' + C.edgeWho);
    CAM.yaw = SH.yaw; CAM.pivot.copy(SH.pivot); CAM.cur = CAM.dist = Math.max(4.4, SH.dist * 0.6); IN.lastLook = S.time;
    CAM2.yaw = SH.yaw; CAM2.pitch = CAM.pitch; CAM2.pivot.copy(SH.pivot); CAM2.cur = CAM2.dist = CAM.cur; CAM2.fightK = 0; IN2.lastLook = S.time; resize(); }
  function merge(instant) { if (C.split) { C.merges++; log('merge' + (instant ? ':instant' : '')); } C.split = false; C.mergeT = 0; initShared(instant); if (instant) { C.k = 0; delete CAM.aspect; } resize(); }
  function initShared(instant) {
    SH.yaw = CAM.yaw; SH.pitch = CAM.pitch; SH.dist = CAM.cur || 4.4;
    if (instant) SH.pivot.set((hero.pos.x + partner.pos.x) / 2, (hero.pos.y + partner.pos.y) / 2 + 1.4, (hero.pos.z + partner.pos.z) / 2); else SH.pivot.copy(CAM.pivot);
  }
  // ---- cameras ----
  function views() { // viewport rects as fractions of the screen (x, y from the bottom-left, w, h) for k: 0 = one view, 1 = split
    const k = C.k, land = VW() >= VH();
    if (land) return [[0, 0, 1 - k / 2, 1], [1 - k / 2, 0, 0.5, 1], land];
    return [[0, k / 2, 1, 1 - k / 2], [0, -0.5 + k / 2, 1, 0.5], land]; // portrait: P1 on top, P2 slides up from the bottom
  }
  function sharedCam(dt, rdt, aspect) {
    const H = hero, P = partner;
    SH.yaw -= (IN.look + IN2.look) * rdt * 2.3; SH.yaw -= IN.dragX * 0.0062; SH.pitch = clamp(SH.pitch + IN.dragY * 0.0035 + (IN.lookY + IN2.lookY) * rdt * 1.4, 0.02, 0.9); IN.dragX = IN.dragY = 0;
    const idle = S.time - Math.max(IN.lastLook, IN2.lastLook) > 1.4, vx = (H.vel.x + P.vel.x) / 2, vz = (H.vel.y + P.vel.y) / 2, sp = Math.hypot(vx, vz);
    if (idle && sp > 1) { const d = angTo(SH.yaw, Math.atan2(-vx, -vz)); if (Math.abs(d) < 2.2) SH.yaw += d * (1 - Math.exp(-rdt * 0.9 * clamp(sp / 6, 0, 1))); }
    SH.yaw = wrapA(SH.yaw); CAM.yaw = SH.yaw; // P1's stick is relative to the shared camera
    const sep = Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z), sk = clamp((sep - 2) / 10, 0, 1), portrait = aspect < 1 / 1.15;
    const mx = (H.pos.x + P.pos.x) / 2, mz = (H.pos.z + P.pos.z) / 2, my = (H.pos.y + P.pos.y) / 2 + 1.4 + (H.y + P.y) * 0.22;
    SH.pivot.x = damp(SH.pivot.x, mx, 6, rdt); SH.pivot.z = damp(SH.pivot.z, mz, 6, rdt); SH.pivot.y = damp(SH.pivot.y, my, 5, rdt);
    setFov(58, camera, aspect); const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const half = sep / 2 + 1.8, want = Math.max(4.6 + (portrait ? 1.4 : 0), half / Math.tan(Math.min(vf, hf) / 2) * 1.05);
    SH.dist = damp(SH.dist, want, 2.4, rdt);
    const pitch = clamp(SH.pitch + sk * 0.55, 0.05, 1.1), f = camFwd(SH.yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
    const px = SH.pivot.x, py = SH.pivot.y, pz = SH.pivot.z, wx = px - f[0] * SH.dist * cp, wy = py + SH.dist * spp, wz = pz - f[1] * SH.dist * cp;
    let t = 1; for (const b of BLD) { if (b.x1 < Math.min(px, wx) - 1 || b.x0 > Math.max(px, wx) + 1 || b.z1 < Math.min(pz, wz) - 1 || b.z0 > Math.max(pz, wz) + 1) continue; const hh = segBox(px, py, pz, wx, wy, wz, b, 0.3); if (hh < t) t = hh; }
    const d = Math.max(sep > 3 ? SH.dist * 0.72 : 0.9, SH.dist * t - 0.15);
    SH.pos.set(px - f[0] * d * cp, Math.max(py + d * spp, H.pos.y + 0.5), pz - f[1] * d * cp); SH.look.set(px + f[0] * 0.8, py - 0.2 - sk * 0.4, pz + f[1] * 0.8);
    const T = S.time; SH.pos.x += Math.sin(T * 0.73) * 0.03; SH.pos.y += Math.sin(T * 1.13 + 2) * 0.025;
    camera.position.copy(SH.pos); if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 3); const kk = S.shake * S.shake * 0.25; camera.position.x += rnd(-kk, kk); camera.position.y += rnd(-kk, kk); }
    camera.up.set(0, 1, 0); camera.lookAt(SH.look); CAM.pos.copy(SH.pos); CAM.look.copy(SH.look); CAM.pivot.copy(SH.pivot); CAM.cur = d;
  }
  function setAspect(cam, a) { if (Math.abs(cam.aspect - a) > 1e-4) { cam.aspect = a; cam.updateProjectionMatrix(); } }
  function cam(dt, rdt) {
    C.k = damp(C.k, C.split ? 1 : 0, 7, rdt); if (!C.split && C.k < 0.004) C.k = 0; if (C.split && C.k > 0.996) C.k = 1;
    const two = C.split || C.k > 0, [v1, v2] = views(), sw = VW(), sh = VH();
    const a1 = (sw * v1[2]) / (sh * v1[3]), a2 = (sw * v2[2]) / (sh * v2[3]);
    if (two) CAM.aspect = a1; else delete CAM.aspect;
    setAspect(camera, a1);
    if (CINE.intro) camStep(dt, rdt);
    else if (C.split) camStep(dt, rdt); // P1's own follow camera (cinematics included)
    else if (cineCamActive()) cineCamera(rdt);
    else sharedCam(dt, rdt, a1);
    if (two) { CAM2.aspect = a2; setAspect(camera2, a2); updateCameraFor(CAM2, camera2, partner, IN2, null, dt, rdt); }
  }
  // ---- draw: two viewports into the low-res target, then the post pass once ----
  const _sky = new THREE.Vector3();
  function draw2() {
    const W = RT.width, Hh = RT.height, [v1, v2] = views(); C.draws2++;
    const rect = (v) => [Math.round(v[0] * W), Math.round(v[1] * Hh), Math.round(v[2] * W), Math.round(v[3] * Hh)];
    const r1 = rect(v1), r2 = rect(v2);
    RT.scissorTest = true;
    RT.viewport.set(r1[0], r1[1], r1[2], r1[3]); RT.scissor.set(r1[0], r1[1], r1[2], r1[3]);
    renderer.setRenderTarget(RT); renderer.render(scene, camera);
    const x0 = Math.max(0, r2[0]), y0 = Math.max(0, r2[1]), x1 = Math.min(W, r2[0] + r2[2]), y1 = Math.min(Hh, r2[1] + r2[3]);
    if (x1 - x0 > 1 && y1 - y0 > 1) {
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; _sky.copy(window.__sky.position); window.__sky.position.copy(camera2.position);
      RT.viewport.set(r2[0], r2[1], r2[2], r2[3]); RT.scissor.set(x0, y0, x1 - x0, y1 - y0);
      renderer.setRenderTarget(RT); renderer.render(scene, camera2);
      renderer.shadowMap.autoUpdate = au; window.__sky.position.copy(_sky);
    }
    RT.scissorTest = false; RT.viewport.set(0, 0, W, Hh); RT.scissor.set(0, 0, W, Hh);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  // ---- after the city frame: perf trims in split, HUD, edge ring, tags, the P2'S TURN card ----
  const _p = new THREE.Vector3();
  function post(rdt) {
    const two = C.split || C.k > 0, [v1, v2, land] = views(), sw = VW(), sh = VH();
    const far = two ? 200 : 260; if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); } if (camera2.far !== 200) { camera2.far = 200; camera2.updateProjectionMatrix(); }
    if (two) { const ff = Math.min(scene.fog.far, 110), fn = Math.min(scene.fog.near, 30); scene.fog.far = ff; scene.fog.near = fn; OUT_U.fogF.value = ff; OUT_U.fogN.value = fn; }
    if (two) { elDiv.style.display = 'block';
      if (land) { const x = sw * (1 - C.k / 2); Object.assign(elDiv.style, { left: (x - 2) + 'px', top: '0px', width: '4px', height: sh + 'px' }); Object.assign(elT1.style, { left: '8px', bottom: '8px' }); Object.assign(elT2.style, { left: (x + 8) + 'px', bottom: '8px' }); }
      else { const y = sh * (C.k / 2); Object.assign(elDiv.style, { left: '0px', top: (sh - y - 2) + 'px', width: sw + 'px', height: '4px' }); Object.assign(elT1.style, { left: '8px', bottom: (y + 8) + 'px' }); Object.assign(elT2.style, { left: '8px', bottom: '8px' }); }
      elT1.style.display = elT2.style.display = C.k > 0.6 ? 'block' : 'none';
    } else { elDiv.style.display = elT1.style.display = elT2.style.display = 'none'; }
    // edge ring over the toad pushing away (fills over the 2 s)
    if (!C.split && C.edgeT > 0.15) { const f = C.edgeWho === 'p2' ? partner : hero; _p.set(f.pos.x, f.pos.y + f.y + 2.3, f.pos.z).project(camera);
      const x = (_p.x + 1) / 2 * sw, y = (1 - _p.y) / 2 * sh; elEdge.style.display = elEdgeL.style.display = 'block'; elEdge.style.left = x + 'px'; elEdge.style.top = y + 'px'; elEdge.style.setProperty('--p', clamp(C.edgeT / SPLIT_T, 0, 1).toFixed(3));
      elEdgeL.style.left = x + 'px'; elEdgeL.style.top = (y + 26) + 'px'; }
    else elEdge.style.display = elEdgeL.style.display = 'none';
    if (tagSpr) { const [t1, t2] = tagSpr; t1.visible = hero.root.visible; t2.visible = partner.root.visible; t1.position.set(hero.pos.x, hero.pos.y + hero.y + 2.45, hero.pos.z); t2.position.set(partner.pos.x, partner.pos.y + partner.y + 2.45, partner.pos.z); }
    if (C.card) { C.cardT += rdt;
      if (IN2.aE) { const A = C.card.act; C.card = null; elTurn.style.display = 'none'; C.turn = 1; C.turns++; log('turn:p2:' + A.label); try { A.go(); } catch (e) { C.turn = 0; } }
      else if (IN2.bE || C.cardT > 15) { log('turn:skip'); C.card = null; elTurn.style.display = 'none'; } }
    IN2.aE = IN2.bE = false;
  }
  // ---- mode tracking (runs every frame, before any mode's own frame) ----
  function modeNow() {
    if (DERBY.on) return 'derby'; if (VIC.on) return 'vic'; if (FORT.on) return 'fort';
    if (MODE.duel) { const d = MODE.duel; return 'duel:' + ((d.cur && d.cur.id) || d.id || 'x'); } if (RB.mode) return 'rb:' + RB.mode; return null;
  }
  function pre(rdt) {
    const m = modeNow();
    if (m && !C.mode) { C.mode = m; if (C.split || C.k > 0) merge(true); C.card = null; elTurn.style.display = 'none';
      C.modeAct = C.turn === 0 && C.lastAct && performance.now() - C.lastActT < 2000 && C.lastAct.kind !== 'boat' && !/^rb:ride/.test(m) ? C.lastAct : null; C.lastAct = null; log('mode:' + m + ':turn' + C.turn); hideHud(); }
    else if (m && C.mode && m !== C.mode) { log('mode:' + C.mode + '->' + m); C.mode = m; C.modeAct = null; } // chained (e.g. Brewmaster -> finale): no P2 replay
    else if (!m && C.mode) { log('exit:' + C.mode + ':turn' + C.turn); C.mode = null; merge(true);
      if (Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z) > 4 || !!partner.roof !== !!hero.roof) { const sl = partnerSlot(); partnerTeleport(sl.x, sl.z, !!hero.roof, 'coop-mode'); }
      if (C.turn === 1) { C.turn = 0; if (typeof banner === 'function') banner('P1 BACK IN CONTROL', 1.4); }
      else if (C.modeAct && C.p2 !== null) { const A = C.modeAct; C.card = { act: A }; C.cardT = 0;
        const nm = (CITY.lmk && CITY.lmk.name) || ''; elTurn.innerHTML = '<b>P2\u2019S TURN!</b>' + (nm ? nm.replace(/[<>&]/g, '') + '<br>' : '') + 'P2: A = PLAY \u00b7 B = SKIP<i>' + String(A.label || 'PLAY').replace(/[<>&]/g, '') + ' \u00b7 PLAYER 2 PLAYS AS HAROLD</i>'; elTurn.style.display = 'block'; log('card'); }
      C.modeAct = null; }
    return false;
  }
  function noteAct(c) { if (!C.on || C.mode) return; C.lastAct = c; C.lastActT = performance.now(); }
  function resK() { return C.on && C.split && TOUCH ? 0.8 : 1; }
  const api = { get on() { return C.on; }, padRole, noteAct, pre, preStep, updateP2, step, cam, post, draw: draw2, split: () => C.split || C.k > 0, resK, C, IN2, SH, CAM2, camera2, join, leave, MAXSEP, MERGE_D, SPLIT_T };
  window.__coop = api;
  return api;
})();

// ---------------- arcade control panel (touch screens): the Shell Shock cabinet panel from Brad's demos shell, docked under the game.
// Ball-top stick (analog, relative: the touch-down point is the centre, the thumb past the radius drags it along) + round arcade buttons:
// SWING (red), JUMP (yellow), the two white buttons orbit the camera, and ACT, the big glowing context button on the SPECIAL spot.
// Stick and buttons are ~18% larger than the demos shell (hit areas to match). ----------------
const APANEL = (function () {
  const panel = $('apanel'), deck = $('adeck'); if (!panel || !deck) return null;
  const PW = 470, PH = 135, K = 1.18, TOP = 22;
  const BTN = { a: { x: 266, y: 73, el: $('acap-a') }, b: { x: 343, y: 69, el: $('acap-b') }, c: { x: 419, y: 70, el: $('aact'), big: true }, l: { x: 163, y: 33, el: $('acap-l'), small: true }, r: { x: 243, y: 33, el: $('acap-r'), small: true } };
  let S = 1;
  function layout() {
    if (!document.body.classList.contains('touch')) { document.documentElement.style.setProperty('--panel', '0px'); return; }
    S = Math.min(innerWidth / PW, (innerHeight * 0.3) / (PH + TOP), 2.0);
    deck.style.setProperty('--S', S + 'px');
    document.documentElement.style.setProperty('--panel', Math.round((PH + TOP) * S) + 'px');
  }
  layout(); addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(() => { layout(); dispatchEvent(new Event('resize')); }, 250));
  const toDeck = (e) => { const r = deck.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; };
  function btnAt(p, sliding) {
    let best = null, bd = 1e9;
    for (const n of ['l', 'r']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.3); if (d < 30 * K && d < bd) { bd = d; best = n; } }
    if (best) return best;
    if (p.x < 205 && !sliding) return null; // left side = joystick
    for (const n of ['a', 'b', 'c']) { const b = BTN[n], d = Math.hypot(p.x - b.x, (p.y - b.y) * 1.2) - (b.big ? 8 : 0); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  const JR = 44 * K; // CSS px radius
  const JOY = { id: null, cx: 0, cy: 0 };
  function joyMove(x, y) {
    let dx = x - JOY.cx, dy = y - JOY.cy, d = Math.hypot(dx, dy);
    if (d > JR) { const over = (d - JR) / d; JOY.cx += dx * over; JOY.cy += dy * over; dx *= 1 - over; dy *= 1 - over; d = JR; }
    const k = d > JR * 0.18 ? 1 : 0; TOUCHS.x = (dx / JR) * k; TOUCHS.y = (dy / JR) * k;
    $('astick').style.transform = `rotate(${(TOUCHS.x * 22).toFixed(1)}deg) translateY(${(TOUCHS.y * 2).toFixed(1)}%) scaleY(${(1 - 0.12 * TOUCHS.y).toFixed(3)})`;
    const ring = $('aring'), r = deck.getBoundingClientRect(); ring.style.left = (JOY.cx - r.left) + 'px'; ring.style.top = (JOY.cy - r.top) + 'px'; ring.style.width = ring.style.height = JR * 2 + 'px';
  }
  const PTR = new Map();
  const anyOn = (n) => { for (const v of PTR.values()) if (v === n) return true; return false; };
  function down(n) { BTN[n].el.classList.add('on'); TOUCHS.btn[n] = true; DEV = 'touch'; if (n === 'a') PRESS.add('j'); if (n === 'b') PRESS.add('k'); if (n === 'c') PRESS.add('e'); try { navigator.vibrate && navigator.vibrate(n === 'c' ? 14 : 8); } catch (_) {} }
  function up(n) { BTN[n].el.classList.remove('on'); TOUCHS.btn[n] = false; }
  function setBtn(id, n) { const prev = PTR.get(id); if (prev === n) return; PTR.set(id, n); if (prev && !anyOn(prev)) up(prev); if (n) down(n); }
  panel.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audioInit(); if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); if (CINE.intro && CINE.intro.t > 0.4) CINE.intro.skip = true;
    try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    const b = btnAt(toDeck(e), false); if (b) { setBtn(e.pointerId, b); return; }
    if (JOY.id === null) { JOY.id = e.pointerId; JOY.cx = e.clientX; JOY.cy = e.clientY; TOUCHS.stick = 'panel'; $('aring').classList.add('on'); joyMove(e.clientX, e.clientY); DEV = 'touch'; }
  });
  panel.addEventListener('pointermove', (e) => {
    if (e.pointerId === JOY.id) { e.preventDefault(); joyMove(e.clientX, e.clientY); return; }
    if (PTR.has(e.pointerId)) { const b = btnAt(toDeck(e), true); if (b) setBtn(e.pointerId, b); }
  });
  const release = (e) => {
    if (e.pointerId === JOY.id) { JOY.id = null; TOUCHS.stick = null; TOUCHS.x = TOUCHS.y = 0; $('astick').style.transform = ''; $('aring').classList.remove('on'); }
    if (PTR.has(e.pointerId)) { const prev = PTR.get(e.pointerId); PTR.delete(e.pointerId); if (prev && !anyOn(prev)) up(prev); }
  };
  panel.addEventListener('pointerup', release); panel.addEventListener('pointercancel', release);
  // ACT label / icon / glow / cooldown ring (called from the HUD tick)
  let cur = '';
  function setAct(ctx, cdFrac) {
    const lab = ctx ? ctx.label : 'ACT', kind = ctx ? ctx.kind : 'none', key = lab + kind + (ctx && ctx.ready === false ? 'c' : '');
    const el = BTN.c.el; el.style.setProperty('--cd', cdFrac.toFixed(3));
    if (key === cur) return; cur = key;
    $('albl-c').textContent = lab; $('aico').innerHTML = ICONS[kind] || ICONS.act;
    el.classList.toggle('hot', !!ctx && ctx.ready !== false); el.classList.toggle('cool', !!ctx && ctx.ready === false);
  }
  return { layout, setAct, BTN, get S() { return S; } };
})();
// ---------------- GR1 writing pack (Grok): thug barks, boss lines, radio bumpers, landmark blurbs ----------------
// generated by writing/gen_gr1.py from writing/gr1_writing.json; edit the JSON and re-run, not this file
const GR1 = {"gangs":{"harbor_rats":{"idle":["Nice night for a harbor stroll, huh?","Smells like crab shells and money.","Guard the pavilion. Guard it hard.","Who left fries on the bricks? Mine.","Tails up, boys. Keep it tight.","Quiet tonight. Too quiet, hon.","Mustard jacket, navy heart. Rat life.","I heard a cane tapping. You hear that?"],"taunt":["Hey grandpa, you lost your lily pad?","Hop on home, old timer!","That cane ain't scaring nobody, yo.","North shore's ours. Beat it!","You move slower than harbor traffic.","Ribbit all you want, you're done.","Mavis, hon, your man is in trouble.","We got cheese and numbers. You got a stick."],"hit":["Ow! Not the whiskers!","My tail! Watch the tail!","Hey, that cane is a weapon!","Oof, right in the snack pouch.","Ack! Who taught you that?","Easy, easy, I bruise quick!","That's assault with a walking aid!","Ow! I felt that in my ancestors!"],"ko":["Tell my cheese I loved it...","Down the ocean... forever...","I'm just gonna lie here a while.","Beat by a senior citizen. Great.","Somebody call the sewer, I'm out.","Squeak... squeak... done.","Rats! Literally. Rats.","Okay. Okay. You win this block."]},"pier_gulls":{"idle":["Mine. Mine. Also mine.","Got my eye on that soft pretzel.","Pier's breezy tonight. Perfect.","Who's got fries? Anybody? Fries?","Circle the pier, then circle again.","White and blue, flock on through.","Aquarium crowd drops the best snacks.","Keep your beaks sharp, flock."],"taunt":["Squawk off, swamp boy!","Old toad, new tricks? Nah.","We fly. You hop. Do the math.","I'll steal your cane AND your lunch.","This pier is gull country, hon!","Flock up! Grandpa wants a fight!","You'd make a great snack, bud.","Watch the sky, slowpoke!"],"hit":["SQUAWK! Rude!","My feathers! I just preened!","Ow! Right in the wingspan!","Hey! Unhand the beak!","Gah! That's a foul, ref!","Feathers everywhere, man!","Not the tail feathers, yo!","Ow, ow, ow, flap away!"],"ko":["Grounded... permanently...","I see... a big... french fry...","Tell the flock... I flew good.","Squawk... wheeze... squawk.","Down for the count. Down for good.","I just wanted the pretzel...","Gull down! Gull down!","Wake me at high tide."]},"cobble_catfish":{"idle":["Cobblestones keep my fins cool.","Slow water, slow talk, slow night.","Whiskers twitching. Somebody's near.","Fells Point fog is my blanket.","Teal and slate, we never wait.","Mmm. Mud. Like home.","Bottom feeder? I prefer \"curator.\"","Just vibing by the old pier, hon."],"taunt":["You smell like pond scum, pal.","These stones are ours, old toad.","I'll whisker-slap you to Pigtown.","Come on down the cobbles, frog.","We're slippery. You're slow.","Bet you can't even swim, gramps.","Catfish don't bite. We wallop.","Hey Harold! Your cane's crooked!"],"hit":["Blub! My barbels!","Ow! I'm slippery, not soft!","Whoa, right in the gills!","That stings worse than salt!","Hey, fins off the face!","Glug! Cheap shot, hon!","My scales! I just shined 'em!","Oof, you hit like a crab trap!"],"ko":["Back to the mud I go...","Blub... blub... bye.","Floating belly up. Classic.","Tell the river I tried.","I'm just gonna sink now.","Cobblestones... so comfy...","Washed up. Like, literally.","Glub. I yield. Glub."]},"masked_bandits":{"idle":["Mask on. Always mask on.","Trash cans by the stadium? Jackpot.","Orange and grey, we rule the west.","Shh. Footsteps on the concourse.","Nice night for a little light theft.","Got a hot dog. Found it. Mostly.","Lookout duty is so boring, B.","Anybody seen my other glove?"],"taunt":["Nice handbag, Mavis. Mine now.","I'll lift your wallet AND your cane.","West side bandits, baby!","You can't stop what you can't see.","Little froggy wants to play?","We got the masks, you got the wrinkles.","Grab him! He's slow!","Ooh, a toad. Haven't robbed one yet."],"hit":["Hey! Watch the mask!","Ow! My little hands!","That's a crime, old man!","Yeeowch! Right in the stripes!","Busted! Busted bad!","Ooh! Cane to the noggin!","Ow! I just stole this jacket!","Okay, that one was fair."],"ko":["Caught... red-pawed...","Lights out. Mask still on.","I'll be in the dumpster. Resting.","Tell Ma I almost got away.","You got me. Don't tell the crew.","Down like a trash can lid.","Sleepy bandit time now.","This heist... is over."]},"key_hwy_otters":{"idle":["Floatin' on my back. Living right.","South shore breeze hits different.","Anybody got a clam? I got a rock.","Fort's quiet. Fed Hill's quieter.","Green and brown, we hold this town.","Holding paws so we don't drift.","Just juggling pebbles, hon.","Smell that sugar? Love this shore."],"taunt":["Splish splash, you're trash, gramps!","Otters roll deep. Toads roll home.","Key Highway's ours. Turn around!","Come swim with us. Oh wait.","We play rough. Real rough.","Your cane's my new back scratcher.","Little toad, big mistake.","Down the ocean? Down the drain!"],"hit":["Hey! I'm adorable! Stop!","Ow! My fluffy face!","That's no way to treat a cutie!","Oof! Belly shot!","Yowch! Right in the whiskers!","Rude! Very rude!","Not the fur! It took hours!","Ow, my rock! You made me drop it!"],"ko":["Floating off... to dreamland...","Tell the raft... I'm sorry.","I just wanted to be cute...","Otter down. Otter way down.","My rock... keep it safe...","Drifting... drifting... gone.","Belly up and out of luck.","Okay, nap time. Forever-ish."]}},"bosses":{"bird_brain_bobby":{"intro":["Batter up, Harold! Heads up too!","Welcome to my hallway. It's a long way to first.","Nobody hits my heater, old timer!"],"defeat":["Strike three... on me...","My arm! I'm going on the injured list!","Fine. You can have the brick hallway."]},"raven_king":{"intro":["Nevermore will you cross my field!","Hut! Hut! Hike up those pants, toad!","Shoulder pads on. Mercy off."],"defeat":["Nevermore... means me now...","I got sacked by a senior...","Flag on the play. Me. I'm the flag."]},"dr_shellacious":{"intro":["Welcome to my lab! The screen is HUGE!","My experiments need a test toad!","Goggles down! Science is about to hurt!"],"defeat":["My hypothesis... was wrong...","Back in my shell... for science...","Note to self: never fight a toad."]},"hon_queen":{"intro":["Hey hon! Come up the hill, hon!","This beehive's got a sting, sweetie.","Hairspray! Extra hold! Down you go!"],"defeat":["My hair... it's flat, hon...","Okay hon, you win. Go get a crab cake.","Not the capris! Not the capris!"]},"sugar_rush":{"intro":["I'm sweet, but I hit like a truck!","Glitter and grit, toad! Taste it!","Neon on, sugar high, you're done!"],"defeat":["I'm... dissolving...","Too sweet... to keep fighting...","Somebody sweep me up. I'm crumbs."]},"compression_king":{"intro":["Feel the squeeze, old man!","No logo, no mercy!","My gear is tight. My grip is tighter."],"defeat":["My seams... they're splitting...","Back to the mannequin rack...","Loosen up... I give..."]},"admiral_redclaw":{"intro":["Fire the rockets! For the crown!","1812 called. I'm still mad about it.","This fort will fall, little toad!"],"defeat":["Retreat! Retreat to the bay!","Defeated... again... at this fort!","My cannon arm... is cramping..."]},"big_jimmy":{"intro":["Welcome to my tank, shrimp.","Big Jimmy don't do steamed, hon.","Claws out, toad. Down in the deep."],"defeat":["Ack... I'm in hot water now...","Don't put me on newspaper...","Fine. The tank's yours. Ugh."]},"voltage_vic":{"intro":["Drop the beat! Drop the toad!","Charm City club, high voltage!","Hands up! Gonna shock 'em all!"],"defeat":["My bass... it's flatlined...","Power down... party over...","No more juice. No more jams."]},"chef_crabcake":{"intro":["Order up! One toad, well done!","Taste my seasoning! In your eyes!","Two mallets, one Harold. Let's cook!"],"defeat":["My kitchen... it's closed...","Too much seasoning... even for me...","Fine. You get the chef's special."]},"arabber_al":{"intro":["Get outta my lane, toad!","Fresh produce, fast horse, no brakes!","Yo! Arabber coming through!"],"defeat":["My cart! My beautiful cart!","Aw, watermelons everywhere...","You win. Have a peach, old timer."]},"pool_shark":{"intro":["Wanna play? Winner takes the cabana.","Rack 'em up, grandpa!","Eight ball, side pocket: you."],"defeat":["Scratched... on the last shot...","Belly flop... with no splash...","You hustled the hustler. Respect."]},"dragon_boat_duchess":{"intro":["Kneel before the Duchess of the harbor!","My paddle-sceptre says you're done!","Row, row, row your toad... under!"],"defeat":["My tiara! It's in the harbor!","Abandon boat... abandon dignity...","The royal paddle... is broken..."]},"captain_cobblestone":{"intro":["Yarr! This ship be haunted, toad!","My lantern lights the way to your doom!","Ghosts don't feel canes, matey!"],"defeat":["Back to the fog... I go...","Ye bested a ghost... impressive...","My lantern... it's flickering out..."]},"penthouse_pigeon":{"intro":["Welcome to the top, peasant toad.","Drink? No? Then fight.","Up here, I rule the skyline."],"defeat":["My smoking jacket! Ruined!","I'm... coming down in the world...","Pigeon down. On the penthouse deck."]},"stoop_scrubber":{"intro":["Get off my clean steps, hon!","These marble steps shine. You won't!","Suds up! Slip and slide, toad!"],"defeat":["My steps... all scuffed...","I'll scrub this loss away tomorrow.","Okay hon, you can sit on the stoop."]},"mister_formstone":{"intro":["Welcome to my city, Harold.","Nothing cracks Formstone, old toad.","Every block in B-more answers to me."],"defeat":["My plates... they're all cracking...","You see me now... the real me...","The city's yours... for now, toad."]}},"radio":{"bumpers":[{"id":"bump_01","station":"auto","text":"AUTO mode, hon. We follow the sun and the moon for you."},{"id":"bump_02","station":"day","text":"B-MORE 410 DAY, sun's up over the harbor. Stay hydrated, hon."},{"id":"bump_03","station":"night","text":"B-MORE 410 NIGHT, lights low, harbor glowing. Watch your back."},{"id":"bump_04","station":"ducky","text":"DUCKY DYNAMO FM! Quack it loud, Charm City!"},{"id":"bump_05","station":"lor","text":"LOR BITEWHO on your dial. Smooth bites, all night long."},{"id":"bump_06","station":"club","text":"B-MORE CLUB, feet moving, harbor shaking. Don't stop now!"},{"id":"bump_07","station":"rap","text":"B-MORE RAP, straight from the 410. Turn it up, yo."},{"id":"bump_08","station":"night","text":"Late night in B-more, rats out and gulls up. Keep it tuned here."},{"id":"bump_09","station":"day","text":"Traffic on Pratt? Grab a crab cake and ride it out with us."}]},"landmarks":{"harborplace":{"name":"HARBORPLACE","blurb":["Waterfront shopping pavilions on the Inner Harbor, opened in 1980.","The Dragon Boat Duchess paddles here like she owns the place."]},"constellation":{"name":"USS CONSTELLATION","blurb":["A Navy sail warship built in 1854, now a museum at the harbor.","Captain Cobblestone haunts the deck with a lantern at night."]},"wtc":{"name":"WORLD TRADE CENTER","blurb":["A five-sided office tower on the harbor with a view up top.","The Penthouse Pigeon sips tea on the roof and looks down on all."]},"aquarium":{"name":"NATIONAL AQUARIUM","blurb":["A big aquarium on the Inner Harbor piers, opened in 1981.","Big Jimmy runs the tanks and refuses to be steamed."]},"powerplant":{"name":"POWER PLANT","blurb":["An old brick power plant on Pier 4, now shops and restaurants.","Voltage Vic still keeps the place charged with club beats."]},"fourseasons":{"name":"FOUR SEASONS","blurb":["A tall hotel in Harbor East, right by the water.","Chef Crabcake runs the kitchen and seasons guests on sight."]},"pendry":{"name":"PENDRY","blurb":["A hotel in the old Recreation Pier building at Fells Point.","The Pool Shark hustles poolside in a loud cabana shirt."]},"fells":{"name":"FELLS POINT","blurb":["A historic waterfront neighborhood with cobblestone streets.","Arabber Al races his horse-cart over the bricks, no brakes."]},"monument":{"name":"WASHINGTON MONUMENT","blurb":["A tall marble column in Mount Vernon, begun in 1815.","The Stoop Scrubber keeps every nearby marble step spotless."]},"orioles":{"name":"ORIOLE PARK","blurb":["A downtown ballpark opened in 1992 beside a long brick warehouse.","Bird Brain Bobby throws fastballs down the warehouse hallway."]},"ravens":{"name":"M&T BANK STADIUM","blurb":["A pro football stadium beside the ballpark, opened in 1998.","The Raven King blitzes anyone who steps onto his field."]},"science":{"name":"SCIENCE CENTER","blurb":["A hands-on science museum on the harbor with an IMAX theater.","Mad turtle Shellacious runs wild experiments on the big screen."]},"fedhill":{"name":"FEDERAL HILL","blurb":["A hilltop park with a great view over the Inner Harbor.","The Hon Queen guards the top and shoves you down the hill."]},"domino":{"name":"DOMINO SUGARS","blurb":["A sugar refinery on the harbor with a giant neon roof sign.","Sugar Rush glitters under the sign, sweet but mean."]},"underarmour":{"name":"UNDER ARMOUR","blurb":["A company campus at Tide Point on the south shore.","The Compression King lurks here in blank, unbranded gear."]},"fort":{"name":"FORT MCHENRY","blurb":["A star-shaped fort whose 1814 defense inspired the anthem.","Admiral Redclaw still wants a rematch, rockets and all."]}}};
// ---------------- GR2 writing pack (Grok, Hawk content/gr2_boss_writing.json): The Chip Kid lines + the new Harborplace blurb; generated by writing/gen_gr2.py ----------------
const GR2 = {"bosses":{"chip_kid":{"intro":["Ew, old people! Mech, crunch 'em into crumbs!","This is MY pavilion! Mom said I could have it!","Taste the seasoning cloud, grandpa! Sneeze, sneeze!"],"defeat":["My mech! You popped my bag! I'm telling!","This is SO unfair! You didn't even let me win!","Fine! I didn't want this dumb harbor anyway! Hmph!"]}},"landmarks":{"harborplace":{"name":"HARBORPLACE","blurb":["Harborplace opened in 1980 as two shopping pavilions on the Inner Harbor.","Now a bratty kid in a chip-bag mech calls dibs on the whole waterfront."]}}};
Object.assign(GR1.bosses, GR2.bosses); Object.assign(GR1.landmarks, GR2.landmarks);
// ---------------- GR2 writing (Grok, Hawk content/gr2_boss_writing.json): Dragon Boat Duchess boat_ambush lines; generated by writing/gen_gr2_duchess.py ----------------
GR1.bosses.dragon_boat_duchess = Object.assign(GR1.bosses.dragon_boat_duchess || {}, { boat_ambush: ["This boat ride is hijacked! The Duchess steers now!", "Lovely day for a paddle. Shame I'm commandeering it!", "All aboard? Wrong! This ride's mine, peasants!"] });
// ---------------- GR1 writing wired in: thug bark bubbles, boss intro/defeat lines, landmark blurbs (radio bumpers live in 08_radio.js) ----------------
// One speech bubble on screen at a time (a DOM card that follows the speaker's head), lines picked by a cycling index per gang + kind
// (no repeats until a list wraps), per-thug cooldown, KO > HIT > TAUNT > IDLE priority. Polls thug states once per rendered frame,
// so the fight code in 06_game.js is untouched.
const BARK = (function () {
  const css = document.createElement('style');
  css.textContent = `
  #bark { position: fixed; z-index: 12; left: 0; top: 0; pointer-events: none; max-width: min(190px, 52vw); box-sizing: border-box; padding: 5px 9px 6px;
    background: #fffdf2; color: #14101f; border: 2.5px solid #000; border-radius: 11px; box-shadow: 3px 3px 0 #000;
    font: 800 13px/1.22 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .1px; text-align: center; white-space: normal; overflow-wrap: break-word;
    opacity: 0; transform: translate(-50%, -100%) scale(.7); transform-origin: 50% 100%; transition: opacity .14s, transform .16s cubic-bezier(.2,1.5,.4,1); will-change: left, top; }
  #bark.on { opacity: 1; transform: translate(-50%, -100%) scale(1); }
  #bark::after { content: ""; position: absolute; left: var(--tx, 50%); bottom: -10px; width: 12px; height: 10px; margin-left: -6px; background: #fffdf2;
    clip-path: polygon(0 0, 100% 0, 30% 100%); filter: drop-shadow(0 2.5px 0 #000); }
  #bark::before { content: ""; position: absolute; left: var(--tx, 50%); bottom: -13.5px; width: 17px; height: 13px; margin-left: -8px; background: #000; clip-path: polygon(0 0, 100% 0, 30% 100%); }
  #bark.hit { background: #fff1c2; } #bark.hit::after { background: #fff1c2; }
  #bark.ko { background: #e9e4ff; color: #2a1650; font-style: italic; } #bark.ko::after { background: #e9e4ff; }
  #bark.boss { max-width: min(250px, 70vw); background: #2a1650; color: #fff; border-color: #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #ff3d6e; font-size: 14px; }
  #bark.boss::after { background: #2a1650; }
  #bark b { display: block; font: 8px/1.5 'PX', monospace; color: #ff3d6e; letter-spacing: .5px; margin-bottom: 1px; }
  #bark.boss b { color: #ffd23c; }
  #lmkb { left: 50%; top: calc(21% + 16px); transform: translate(-50%, 0); width: min(360px, calc(100vw - 28px)); box-sizing: border-box; padding: 6px 10px 7px;
    background: rgba(20,16,31,.84); border: 2px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 1px #ff9ad0; color: #fff; text-align: center;
    font: 700 12.5px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; opacity: 0; transition: opacity .35s; }
  #lmkb.on { opacity: 1; }
  #lmkb i { display: block; font-style: normal; color: #ffe08a; margin-top: 2px; }
  @media (max-width: 480px) { #bark { font-size: 12px; padding: 4px 8px 5px; } #bark.boss { font-size: 13px; } #lmkb { top: calc(21% + 12px); font-size: 12px; } }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'bark'; el.className = 'ui'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el);
  const lb = document.createElement('div'); lb.id = 'lmkb'; lb.className = 'ui'; document.body.appendChild(lb);

  // ---- gangs: the game's thugs have no gang of their own, so each post takes the gang whose turf the GR1 lines describe (nearest landmark);
  // anything unmapped (or a gang missing from the pack) falls back to harbor_rats
  const TURF = { harborplace: 'harbor_rats', constellation: 'harbor_rats', wtc: 'harbor_rats', monument: 'harbor_rats', // north shore
    aquarium: 'pier_gulls', powerplant: 'pier_gulls',                                                                  // the piers
    fourseasons: 'cobble_catfish', pendry: 'cobble_catfish', fells: 'cobble_catfish',                                   // Harbor East / Fells Point
    orioles: 'masked_bandits', ravens: 'masked_bandits', science: 'masked_bandits',                                     // the west side, stadiums
    fedhill: 'key_hwy_otters', domino: 'key_hwy_otters', underarmour: 'key_hwy_otters', fort: 'key_hwy_otters' };       // south shore, Key Hwy
  const gangOf = (e) => { let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - e.post.x, L.z - e.post.z); if (d < bd) { bd = d; best = L; } }
    const g = best && TURF[best.id]; return g && GR1.gangs[g] ? g : 'harbor_rats'; };
  for (const e of enemies) { e.gang = gangOf(e); e.bkSt = e.state; e.bkHp = e.hp; e.bkCd = 0; }

  // ---- bosses: match GR1 boss ids to the boss named on each landmark ("The Raven King" -> raven_king, "Dr. Shellacious" -> dr_shellacious)
  const norm = (s) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const BOSSM = { matched: [], noLandmark: [] };
  for (const id of Object.keys(GR1.bosses)) { const L = LANDMARKS.find((l) => l.boss && norm(l.boss.name) === id);
    if (L) { L.boss.id = id; L.boss.lines = GR1.bosses[id]; BOSSM.matched.push(id + '@' + L.id); } else BOSSM.noLandmark.push(id); }
  const LMM = { matched: LANDMARKS.filter((l) => GR1.landmarks[l.id]).map((l) => l.id), noBlurb: LANDMARKS.filter((l) => !GR1.landmarks[l.id]).map((l) => l.id),
    noLandmark: Object.keys(GR1.landmarks).filter((k) => !LANDMARKS.some((l) => l.id === k)) };

  // ---- line picking: a cycling index per list, each list starting at its own fixed offset
  const IDX = {}; const pick = (key, arr) => { if (!arr || !arr.length) return null; if (IDX[key] === undefined) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; IDX[key] = h % arr.length; } else IDX[key] = (IDX[key] + 1) % arr.length; return arr[IDX[key]]; };

  const PRI = { idle: 0, taunt: 1, hit: 2, ko: 3, boss: 4 }, LIFE = { idle: 2.6, taunt: 2.2, hit: 1.5, ko: 2.4, boss: 3.6 };
  const CD = 3.5, GAP = 0.7, IDLE_GAP = 5.5; // per-thug cooldown (s), quiet gap after any bubble, extra gap between idle chatter
  const B = { cur: null, t: 0, quietT: 0, idleT: 2, shown: 0, log: [], counts: { idle: 0, taunt: 0, hit: 0, ko: 0, boss: 0 }, on: true };
  const _p = new THREE.Vector3();

  function show(kind, text, who, at, label) { // at: { e } (follows a thug) or { x, y, z } (a fixed spot)
    B.cur = { kind, text, who, at, life: LIFE[kind], t0: S.time }; B.t = 0; B.shown++; B.counts[kind]++;
    B.log.push({ at: +S.time.toFixed(2), kind, who: who && who.id !== undefined ? 'thug' + who.id + ':' + who.gang : String(who), text }); if (B.log.length > 60) B.log.shift(); // plain strings only (never the Fighter)
    el.className = 'ui ' + kind; el.innerHTML = (label ? '<b>' + label + '</b>' : '') + text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    place(); void el.offsetWidth; el.classList.add('on');
  }
  function hide() { if (!B.cur) return; B.cur = null; el.classList.remove('on'); B.quietT = GAP; }
  function want(kind, e) { // a thug wants to speak: honour the one-bubble rule, priorities and cooldowns
    if (!B.on || CINE.intro) return false;
    if (e && e.bkCd > 0 && kind !== 'ko') return false;
    if (B.cur) { if (B.cur.who === e && e) return PRI[kind] > PRI[B.cur.kind]; return PRI[kind] > PRI[B.cur.kind] && B.t > 0.45 && kind !== 'idle'; }
    return B.quietT <= 0 || kind === 'ko';
  }
  function bark(e, kind) {
    if (!want(kind, e)) return false;
    const g = GR1.gangs[e.gang] || GR1.gangs.harbor_rats, line = pick(e.gang + '.' + kind, g[kind]); if (!line) return false;
    show(kind, line, e, { e }); e.bkCd = CD; if (kind === 'idle') B.idleT = IDLE_GAP; return true;
  }
  function bossSay(lmId, kind) { // kind 'intro' | 'defeat'; phase-5 boss fights call BARK.bossIntro / bossDefeat
    const L = LANDMARKS.find((l) => l.id === lmId || (l.boss && l.boss.id === lmId)); if (!L || !L.boss || !L.boss.lines) return null;
    const line = pick(L.boss.id + '.' + kind, L.boss.lines[kind]); if (!line) return null;
    const bp = L.boss.at || L.boss; show('boss', line, L.boss.id, bp.pos ? { e: bp } : { x: L.boss.x, y: (L.boss.y || CURB) + 2.4, z: L.boss.z }, L.boss.name.toUpperCase()); return line;
  }

  let rect = null, rectT = 0, lbBot = 0;
  function place() {
    const c = B.cur; if (!c) return;
    let x, y, z; if (c.at.e) { const e = c.at.e; x = e.pos.x; z = e.pos.z; y = e.pos.y + (e.y || 0) + (c.kind === 'ko' || e.state === 'down' || e.state === 'dying' ? 1.1 : 2.25 * (e.scale || 1)); } else ({ x, y, z } = c.at);
    _p.set(x, y, z).project(camera);
    if (!rect || rectT <= 0) { rect = renderer.domElement.getBoundingClientRect(); rectT = 0.5; lbBot = lb.classList.contains('on') ? lb.getBoundingClientRect().bottom : 0; }
    const behind = _p.z > 1; el.style.visibility = behind ? 'hidden' : 'visible'; if (behind) return;
    const w = el.offsetWidth || 150, h = el.offsetHeight || 40, m = 6;
    let sx = rect.left + (_p.x * 0.5 + 0.5) * rect.width, sy = rect.top + (-_p.y * 0.5 + 0.5) * rect.height - 8;
    const top0 = Math.max(rect.top + (document.body.classList.contains('radio') ? 40 : 6), lbBot ? lbBot + 14 : 0) + h; // keep clear of the radio bar + the landmark blurb card
    const cx = Math.min(Math.max(sx, rect.left + w / 2 + m), rect.right - w / 2 - m); let cy = Math.min(Math.max(sy, top0), rect.bottom - m - 10);
    if (PRM.cur) { const r = PRM.el.getBoundingClientRect(); // never cover the ACT / FINISH prompt (it usually floats over the same dizzy thug): hop above it, else below it
      if (r.width && cx - w / 2 < r.right && cx + w / 2 > r.left && cy > r.top - 4 && cy - h < r.bottom + 4) cy = r.top - 8 >= top0 ? r.top - 8 : Math.min(r.bottom + h + 14, rect.bottom - m - 10); }
    el.style.left = cx.toFixed(1) + 'px'; el.style.top = cy.toFixed(1) + 'px';
    el.style.setProperty('--tx', Math.min(Math.max(50 + (sx - cx) / w * 100, 14), 86).toFixed(1) + '%'); // tail points at the speaker
  }

  function tick(rdt) {
    const dt = SIM ? rdt * SIM : rdt; rectT -= rdt;
    B.quietT -= dt; B.idleT -= dt;
    for (const e of enemies) {
      e.bkCd -= dt; const was = e.bkSt, st = e.state, hpDrop = e.hp < e.bkHp; e.bkSt = st; e.bkHp = e.hp;
      if (st === was && !hpDrop) { // steady: idle chatter only, from a visible thug standing near the hero
        if (st === 'idle' && B.idleT <= 0 && e.root.visible) { const d = Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z); if (d < 13 && d > 3) bark(e, 'idle'); }
        continue; }
      if (st === 'idle' && was === 'dead') e.bkKo = false; // respawned
      const koNow = !e.bkKo && ((e.dead && (st === 'down' || st === 'dying')) || st === 'drown' || st === 'dead');
      if (koNow) { e.bkKo = true; if (st !== 'dead' || was !== 'dying') bark(e, 'ko'); }
      else if (e.bkKo || st === 'dead') continue;
      else if (st === 'hurt' || (st === 'dizzy' && was !== 'dizzy') || hpDrop) bark(e, 'hit');
      else if ((st === 'chase' && (was === 'idle' || was === 'return')) || (st === 'windup' && was === 'chase')) bark(e, 'taunt');
    }
    if (B.cur) { B.t += dt; if (B.t > B.cur.life) hide(); else place(); }
  }

  // ---- landmark blurbs: shown under the name popup; returns how long the popup should stay up
  function lmBlurb(L) {
    const w = L && GR1.landmarks[L.id];
    if (!w) { lb.classList.remove('on'); rectT = 0; lbBot = 0; return 0; }
    lb.innerHTML = w.blurb.map((s, i) => (i ? '<i>' : '<span>') + s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + (i ? '</i>' : '</span>')).join('');
    lb.classList.add('on'); rectT = 0; B.lmk = L.id; B.lmkN = (B.lmkN || 0) + 1; return 6.5;
  }
  const api = { B, tick, bark, show, hide, bossSay, bossIntro: (id) => bossSay(id, 'intro'), bossDefeat: (id) => bossSay(id, 'defeat'), lmBlurb, BOSSM, LMM, TURF,
    gangs: () => enemies.map((e) => e.gang), el, lb };
  window.__barks = api;
  return api;
})();

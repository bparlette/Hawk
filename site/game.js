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
        if (aUv.x > 900.0) { // tiled facade run (Task A/B kit, 02c out.tiled): u = 1000 n + offset + cell; each cell picks one of n same-size
          // variant tiles packed side by side in the atlas and is mirrored at random, like the kit's individual 1.2 m cells
          float nv = floor(aUv.x / 1000.0); vec2 cu = floor(aUv); vec2 fu = fract(aUv); float hv = hsh(vec3(cu, 3.7));
          fu.x = mix(fu.x, 1.0 - fu.x, step(0.5, fract(hv * 13.7)));
          tuv = vTr.xy + vec2(min(floor(hv * nv), nv - 1.0) * (vTr.z + 2.0 / 2048.0), 0.0) + fu * vTr.zw; }
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
// ---------------- GENERATED from vendor/taskAB/*.js by vendor/taskAB/gen.sh: do not edit here ----------------
// ---- vendor/taskAB/rowkit_tiles.js ----
// rowkit_tiles.js — Task A: the ONE 1024² atlas for the Baltimore rowhouse kit (K.makeAtlas(KIT_TILES)).
// Everything is drawn on canvas at load: Formstone / permastone / brick / painted-brick facade tiles (tileable, drawn to be
// repeated in ~1.2 m cells), window sashes, panel doors, door numbers, painted window screens (original folk-art scenes),
// corner-bar and corner-shop signs, window product signs, awnings, glass block, roll-up shutter and a basement grille.
// Real Baltimore sign wording / styles (Natty Boh-style beer sign, Utz, Old Bay) are RE-DRAWN here from text and flat shapes;
// no logo file, photo or traced artwork is used or embedded. No imports; no Math.random (seeded LCG only).
const META_ROWKIT_TILES = { id: 'rowkit_tiles', kind: 'kit', atlas: 1024, note: 'KIT_TILES for K.makeAtlas()' };

const KIT_TILES = (() => { // all helpers live inside this closure, so concatenated modules cannot collide
// ---------- tiny local helpers (a module may not import: duplicated per file on purpose) ----------
const rnd = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => (a >= 1 ? `rgb(${cl(r)},${cl(g)},${cl(b)})` : `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`);
const shade = (h, f, a = 1) => { const [r, g, b] = hexRgb(h); return rgb(r * f, g * f, b * f, a); };
const mixRgb = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
const wrap = (c, w, h, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { c.save(); c.translate(dx, dy); fn(); c.restore(); } };
const INK = '#14101f', CREAM = '#c9b48a', MARBLE = '#eae6dc', GOLD = '#c8a040';
const SANS = 'Impact, "Arial Black", sans-serif', SERIF = 'Georgia, serif';
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const fitText = (c, txt, x, y, maxW, px, font = SANS, weight = '') => { let s = px; c.font = `${weight} ${s}px ${font}`; while (c.measureText(txt).width > maxW && s > 6) { s -= 1; c.font = `${weight} ${s}px ${font}`; } c.fillText(txt, x, y); return s; };

// ---------- facade tiles (128×128, drawn so they wrap: random mirroring per 1.2 m cell never shows a seam) ----------
function normalised(R, n, total, lo = 0.65, hi = 1.35) { const a = []; let s = 0; for (let i = 0; i < n; i++) { const v = lo + R() * (hi - lo); a.push(v); s += v; } return a.map((v) => (v / s) * total); }
function drawFormstone(base, seed, pinkish = 0) {
  // Formstone (fix m11): irregular faux stone, not coursed blocks. Rows of uneven height that wander, stones of very different widths,
  // some spanning two rows, 6-8 sided outlines with rounded, lumpy edges, deep tooled mortar and a sparkly aggregate speckle.
  return (c, w, h) => {
    const R = rnd(seed); c.fillStyle = shade(base, 0.5); c.fillRect(0, 0, w, h);
    const stones = [];
    const rows = normalised(R, 4 + (R() < 0.5 ? 1 : 0), h, 0.55, 1.5); let y = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const rh = rows[ri], ws = normalised(R, 3 + Math.floor(R() * 3), w, 0.35, 1.9); let x = R() * w;
      for (const bw of ws) {
        const tall = ri < rows.length - 1 && R() < 0.18; // now and then a big stone that runs through two rows
        const sh = tall ? rh + rows[ri + 1] : rh, dy = (R() - 0.5) * rh * 0.25;
        stones.push({ x, y: y + dy, w: bw, h: sh, tall }); x += bw;
      }
      y += rh;
    }
    for (const st of stones) {
      const n = 6 + Math.floor(R() * 3), cx = st.x + st.w / 2, cy = st.y + st.h / 2, poly = [];
      for (let k = 0; k < n; k++) { // a lumpy rounded-rectangle outline
        const a = (k / n) * Math.PI * 2 + R() * 0.4, ex = Math.cos(a), ey = Math.sin(a), sq = Math.pow(Math.abs(ex) ** 3 + Math.abs(ey) ** 3, -1 / 3);
        const jr = 0.82 + R() * 0.2; poly.push([cx + ex * sq * (st.w / 2 - 2.6) * jr, cy + ey * sq * (st.h / 2 - 2.6) * jr]);
      }
      const f = 0.84 + R() * 0.3, tint = mixRgb(base, pinkish ? '#b8a09c' : '#b4ac98', R() * 0.6);
      wrap(c, w, h, () => {
        c.beginPath(); poly.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
        c.fillStyle = rgb(tint[0] * f, tint[1] * f, tint[2] * f); c.fill();
        c.strokeStyle = shade(base, 0.4); c.lineWidth = 3.2; c.lineJoin = 'round'; c.stroke();
        // lit top-left lip and a shadowed lower-right lip: the stone face stands proud of the mortar
        c.strokeStyle = shade(base, 1.3, 0.65); c.lineWidth = 1.6; c.beginPath(); const q = Math.floor(n * 0.5);
        for (let k = q; k <= n; k++) { const [px, py] = poly[k % n]; k === q ? c.moveTo(px + 1.2, py + 1.2) : c.lineTo(px + 1.2, py + 1.2); } c.stroke();
        c.strokeStyle = shade(base, 0.62, 0.55); c.beginPath(); for (let k = 0; k <= q; k++) { const [px, py] = poly[k]; k ? c.lineTo(px - 1.2, py - 1.2) : c.moveTo(px - 1.2, py - 1.2); } c.stroke();
      });
    }
    for (let i = 0; i < 120; i++) { const px = R() * w, py = R() * h, lt = R() < 0.5; wrap(c, w, h, () => { c.fillStyle = lt ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'; c.fillRect(px, py, 1.6, 1.6); }); }
  };
}
function drawPermastone(base, seed) {
  return (c, w, h) => {
    const R = rnd(seed); c.fillStyle = shade(base, 0.8); c.fillRect(0, 0, w, h);
    const nr = 6, rh = h / nr;
    for (let r = 0; r < nr; r++) {
      const ws = normalised(R, 3, w, 0.7, 1.3); let x = R() * w;
      for (const bw of ws) { wrap(c, w, h, () => { c.fillStyle = shade(base, 0.96 + R() * 0.08); c.fillRect(x + 1.2, r * rh + 1.2, bw - 2.4, rh - 2.4); c.fillStyle = shade(base, 1.14, 0.55); c.fillRect(x + 1.2, r * rh + 1.2, bw - 2.4, 2); c.fillStyle = shade(base, 0.7, 0.4); c.fillRect(x + 1.2, r * rh + rh - 3.4, bw - 2.4, 2); }); x += bw; }
    }
  };
}
function drawBrick(base, seed, painted = false) {
  return (c, w, h) => {
    const R = rnd(seed), rows = 16, bh = h / rows, per = 6, bw = w / per;
    c.fillStyle = painted ? shade(base, 0.8) : '#a89c8e'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let i = -1; i < per; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0), y = r * bh, f = painted ? 0.97 + R() * 0.06 : 0.84 + R() * 0.3;
      wrap(c, w, h, () => {
        c.fillStyle = shade(base, f); const dx = painted ? 0.7 : 1; c.fillRect(x + dx, y + 1, bw - dx * 2, bh - 1.6);
        c.fillStyle = shade(base, painted ? 1.08 : 1.22, 0.5); c.fillRect(x + dx, y + 1, bw - dx * 2, 1.1);
        if (!painted && R() < 0.12) { c.fillStyle = 'rgba(20,16,31,0.18)'; c.fillRect(x + dx, y + 1, bw * 0.4, bh - 1.6); }
      });
    }
  };
}

// ---------- windows 80×144: cream frame, 1/1 sash with a meeting rail; glass is dark blue-grey by day ----------
// (pixel layout is shared with rowkit_rowhouse.js: frame 8px, upper glass y 8..68, rail 68..76, lower glass y 76..136)
function drawWindow(style) {
  return (c, w, h) => {
    c.fillStyle = CREAM; c.fillRect(0, 0, w, h);
    c.fillStyle = shade(CREAM, 0.72); c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h); c.fillRect(w - 2, 0, 2, h); c.fillRect(0, h - 2, w, 2);
    const glass = (x, y, gw, gh, up) => {
      const g = c.createLinearGradient(x, y, x + gw, y + gh); g.addColorStop(0, '#6a8a9a'); g.addColorStop(1, '#4f6676'); c.fillStyle = g; c.fillRect(x, y, gw, gh);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.moveTo(x + gw * 0.15, y + gh); c.lineTo(x + gw * 0.5, y + gh); c.lineTo(x + gw * 0.85, y); c.lineTo(x + gw * 0.5, y); c.closePath(); c.fill();
      if (style === 0) { c.fillStyle = 'rgba(234,230,220,0.85)'; if (up) { c.fillRect(x, y, gw, 7); for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + 5 + i * 10.4, y + 7, 5.2, 0, Math.PI); c.fill(); } } }
      if (style === 1) { c.fillStyle = 'rgba(201,180,138,0.9)'; const n = up ? 10 : 3; for (let i = 0; i < n; i++) c.fillRect(x, y + i * 5.8, gw, 3.6); }
      if (style === 2 && !up) { c.fillStyle = '#3a5a3a'; c.beginPath(); c.ellipse(x + 14, y + gh - 8, 11, 8, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#8a4a3a'; c.fillRect(x + 8, y + gh - 6, 12, 6); }
    };
    glass(8, 8, w - 16, 60, true); glass(8, 76, w - 16, 60, false);
    c.fillStyle = shade(CREAM, 0.88); c.fillRect(8, 68, w - 16, 8); c.fillStyle = shade(CREAM, 0.6); c.fillRect(8, 74, w - 16, 2);
    c.strokeStyle = shade(CREAM, 0.6); c.lineWidth = 1.5; c.strokeRect(8, 8, w - 16, 60); c.strokeRect(8, 76, w - 16, 60);
  };
}

// ---------- panelled doors 96×192 ----------
function drawDoor(col, seed) {
  return (c, w, h) => {
    c.fillStyle = shade(col, 0.7); c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(5, 4, w - 10, h - 4);
    const panel = (x, y, pw, ph) => { c.fillStyle = shade(col, 0.82); c.fillRect(x, y, pw, ph); c.fillStyle = shade(col, 1.25, 0.8); c.fillRect(x, y, pw, 2.5); c.fillRect(x, y, 2.5, ph); c.fillStyle = shade(col, 0.55, 0.9); c.fillRect(x, y + ph - 2.5, pw, 2.5); c.fillRect(x + pw - 2.5, y, 2.5, ph); c.fillStyle = shade(col, 1.05); c.fillRect(x + 4, y + 4, pw - 8, ph - 8); };
    panel(12, 10, 32, 60); panel(52, 10, 32, 60); panel(12, 80, 32, 58); panel(52, 80, 32, 58); panel(12, 146, 72, 28);
    c.fillStyle = GOLD; c.beginPath(); c.arc(w - 14, 106, 4.4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e8d888'; c.beginPath(); c.arc(w - 15, 105, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = GOLD; c.fillRect(w / 2 - 12, 76, 24, 3);
    c.fillStyle = shade(GOLD, 0.8); c.fillRect(8, h - 14, w - 16, 8);
  };
}
function drawDigit(d) { return (c, w, h) => { c.clearRect(0, 0, w, h); c.font = `bold 42px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(String(d), w / 2, h / 2 + 2); c.fillStyle = '#e8c860'; c.fillText(String(d), w / 2, h / 2 + 2); }; }

// ---------- painted window screens 112×128: original folk-art scenes (no copies of real artworks) ----------
function screenFrame(c, w, h, paint) {
  c.fillStyle = INK; rr(c, 0, 0, w, h, 14); c.fill();
  c.save(); rr(c, 5, 5, w - 10, h - 10, 11); c.clip(); paint(c, 5, 5, w - 10, h - 10); c.restore();
  c.strokeStyle = '#ffa050'; c.lineWidth = 2; rr(c, 7.5, 7.5, w - 15, h - 15, 10); c.stroke();
  c.strokeStyle = '#eae6dc'; c.lineWidth = 3.4; rr(c, 4, 4, w - 8, h - 8, 12); c.stroke();
  c.fillStyle = 'rgba(20,16,31,0.17)'; for (let y = 8; y < h - 8; y += 3) c.fillRect(6, y, w - 12, 1); // wire-mesh feel
}
const tri = (c, a, b, d, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill(); };
const SCREENS = {
  scr_cottage: (c, x, y, w, h) => { // red-roof cottage by a lake
    const g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, '#6aa8dc'); g.addColorStop(1, '#d8ecf0'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + w * 0.8, y + 18, 9, 0, 7); c.fill();
    c.fillStyle = '#4f7a3a'; c.beginPath(); c.moveTo(x, y + h * 0.58); c.quadraticCurveTo(x + w * 0.4, y + h * 0.36, x + w, y + h * 0.56); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill();
    c.fillStyle = '#3a8ab8'; c.beginPath(); c.ellipse(x + w * 0.45, y + h * 0.82, w * 0.55, h * 0.13, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + w * 0.25, y + h * 0.8, 22, 2); c.fillRect(x + w * 0.5, y + h * 0.86, 18, 2);
    c.fillStyle = '#eae6dc'; c.fillRect(x + w * 0.3, y + h * 0.5, 38, 26); tri(c, [x + w * 0.3 - 5, y + h * 0.5], [x + w * 0.3 + 43, y + h * 0.5], [x + w * 0.3 + 19, y + h * 0.5 - 20], '#b8302a');
    c.fillStyle = '#8a4a3a'; c.fillRect(x + w * 0.3 + 28, y + h * 0.5 - 18, 6, 12); c.fillStyle = '#5a3a2a'; c.fillRect(x + w * 0.3 + 15, y + h * 0.5 + 8, 8, 18); c.fillStyle = '#ffe08a'; c.fillRect(x + w * 0.3 + 4, y + h * 0.5 + 6, 7, 7); c.fillRect(x + w * 0.3 + 27, y + h * 0.5 + 6, 7, 7);
    for (const tx of [x + 10, x + 22]) { tri(c, [tx - 7, y + h * 0.6], [tx + 7, y + h * 0.6], [tx, y + h * 0.4], '#2a5a32'); }
  },
  scr_swan: (c, x, y, w, h) => { // a swan on an evening pond
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f08a50'); g.addColorStop(0.5, '#f0c070'); g.addColorStop(0.55, '#2f5a8a'); g.addColorStop(1, '#1f3a5a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + w * 0.25, y + h * 0.5, 11, Math.PI, 0); c.fill();
    c.fillStyle = '#eae6dc'; c.beginPath(); c.ellipse(x + w * 0.5, y + h * 0.72, 30, 14, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x + w * 0.72, y + h * 0.7); c.quadraticCurveTo(x + w * 0.78, y + h * 0.4, x + w * 0.66, y + h * 0.38); c.quadraticCurveTo(x + w * 0.58, y + h * 0.4, x + w * 0.6, y + h * 0.5); c.lineWidth = 7; c.strokeStyle = '#eae6dc'; c.stroke();
    c.fillStyle = '#ffa050'; tri(c, [x + w * 0.62, y + h * 0.375], [x + w * 0.56, y + h * 0.4], [x + w * 0.62, y + h * 0.415], '#ffa050'); c.fillStyle = INK; c.fillRect(x + w * 0.635, y + h * 0.375, 2, 2);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x + w * 0.2, y + h * 0.85, 40, 2); c.fillStyle = '#2a5a32'; for (const rx of [x + 6, x + 12, x + w - 12]) c.fillRect(rx, y + h * 0.6, 2.4, h * 0.3);
  },
  scr_lighthouse: (c, x, y, w, h) => { // red-banded lighthouse at dusk
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a3a7a'); g.addColorStop(0.55, '#e08a6a'); g.addColorStop(0.62, '#2a6a9a'); g.addColorStop(1, '#1f4a6a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#6f6a62'; c.beginPath(); c.moveTo(x + 8, y + h * 0.66); c.lineTo(x + w * 0.4, y + h * 0.56); c.lineTo(x + w * 0.76, y + h * 0.56); c.lineTo(x + w - 6, y + h * 0.7); c.lineTo(x + w - 6, y + h); c.lineTo(x + 8, y + h); c.fill();
    const lx = x + w * 0.5; for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#eae6dc' : '#b8302a'; const t = y + h * 0.2 + i * 17, hw0 = 9 + i * 1.4, hw1 = 9 + (i + 1) * 1.4; c.beginPath(); c.moveTo(lx - hw0, t); c.lineTo(lx + hw0, t); c.lineTo(lx + hw1, t + 17); c.lineTo(lx - hw1, t + 17); c.fill(); }
    c.fillStyle = INK; c.fillRect(lx - 11, y + h * 0.2 - 8, 22, 8); c.fillStyle = '#ffe08a'; c.fillRect(lx - 7, y + h * 0.2 - 16, 14, 9); tri(c, [lx - 11, y + h * 0.2 - 16], [lx + 11, y + h * 0.2 - 16], [lx, y + h * 0.2 - 26], '#b8302a');
    c.fillStyle = 'rgba(255,224,138,0.35)'; tri(c, [lx + 7, y + h * 0.2 - 12], [x + w, y + h * 0.1], [x + w, y + h * 0.3], 'rgba(255,224,138,0.35)'); c.strokeStyle = '#eae6dc'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 14, y + 26); c.lineTo(x + 20, y + 22); c.lineTo(x + 26, y + 26); c.stroke();
  },
  scr_sail: (c, x, y, w, h) => { // sailboat under a high sun
    const g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, '#4a98d8'); g.addColorStop(1, '#bfe2f0'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x + 18, y + 20, 10, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(x + w * 0.7, y + 22, 18, 7, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + w * 0.62, y + 26, 12, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#2f6aa8'; c.fillRect(x, y + h * 0.6, w, h * 0.4); c.fillStyle = '#4a8ac8'; for (let i = 0; i < 5; i++) c.fillRect(x + 6 + i * 20, y + h * 0.7 + (i % 2) * 8, 14, 2);
    tri(c, [x + w * 0.5, y + h * 0.16], [x + w * 0.5, y + h * 0.54], [x + w * 0.2, y + h * 0.54], '#eae6dc'); tri(c, [x + w * 0.54, y + h * 0.24], [x + w * 0.54, y + h * 0.54], [x + w * 0.8, y + h * 0.54], '#f08a50'); c.fillStyle = '#5a3a2a'; c.fillRect(x + w * 0.5 - 1.5, y + h * 0.14, 3, h * 0.42);
    c.fillStyle = '#8a4a3a'; c.beginPath(); c.moveTo(x + w * 0.16, y + h * 0.56); c.lineTo(x + w * 0.84, y + h * 0.56); c.lineTo(x + w * 0.72, y + h * 0.66); c.lineTo(x + w * 0.28, y + h * 0.66); c.fill();
  },
  scr_crab: (c, x, y, w, h) => { // a blue crab on the marsh
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f0d890'); g.addColorStop(0.45, '#9ac8a0'); g.addColorStop(1, '#5a8a4a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#3a8ab8'; c.fillRect(x, y + h * 0.62, w, h * 0.38); c.fillStyle = '#2f6a98'; for (let i = 0; i < 4; i++) c.fillRect(x + 6 + i * 26, y + h * 0.7 + (i % 2) * 7, 18, 2);
    c.fillStyle = '#2a5a32'; for (const rx of [x + 8, x + 16, x + 24, x + w - 10, x + w - 18]) c.fillRect(rx, y + h * 0.3, 2.4, h * 0.34);
    const cx = x + w / 2, cy = y + h * 0.58; c.fillStyle = '#2f6aa8'; c.beginPath(); c.ellipse(cx, cy, 24, 14, 0, 0, 7); c.fill(); c.strokeStyle = '#2f6aa8'; c.lineWidth = 3.4;
    for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx + s * 16, cy + 2 + i * 3); c.lineTo(cx + s * 34, cy + 6 + i * 6); c.stroke(); } c.beginPath(); c.moveTo(cx + s * 20, cy - 8); c.lineTo(cx + s * 32, cy - 22); c.stroke(); c.fillStyle = '#b8302a'; c.beginPath(); c.arc(cx + s * 33, cy - 24, 6, 0, 7); c.fill(); }
    c.fillStyle = '#eae6dc'; c.fillRect(cx - 9, cy - 20, 4, 8); c.fillRect(cx + 5, cy - 20, 4, 8);
  },
  scr_heron: (c, x, y, w, h) => { // a heron in the reeds
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#c8a0d0'); g.addColorStop(0.5, '#f0c0a0'); g.addColorStop(0.58, '#4a7a9a'); g.addColorStop(1, '#2a5a6a'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = '#6f6a62'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + w * 0.52, y + h * 0.5); c.lineTo(x + w * 0.5, y + h * 0.82); c.moveTo(x + w * 0.56, y + h * 0.5); c.lineTo(x + w * 0.58, y + h * 0.82); c.stroke();
    c.fillStyle = '#9aa8b8'; c.beginPath(); c.ellipse(x + w * 0.55, y + h * 0.46, 15, 9, -0.5, 0, 7); c.fill(); c.strokeStyle = '#9aa8b8'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x + w * 0.46, y + h * 0.4); c.quadraticCurveTo(x + w * 0.3, y + h * 0.36, x + w * 0.36, y + h * 0.24); c.stroke();
    c.fillStyle = '#ffd23c'; tri(c, [x + w * 0.35, y + h * 0.22], [x + w * 0.22, y + h * 0.25], [x + w * 0.35, y + h * 0.27], '#ffd23c'); c.fillStyle = '#2a5a32'; for (const rx of [x + 8, x + 14, x + 20, x + w - 12, x + w - 20]) c.fillRect(rx, y + h * 0.5, 2.4, h * 0.45);
  },
};

// ---------- signs ----------
const board = (fill, edge, text, tc, px, font = SANS, extra) => (c, w, h) => {
  c.fillStyle = fill; c.fillRect(0, 0, w, h); c.strokeStyle = edge; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = tc; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (extra) extra(c, w, h); fitText(c, text, w / 2 + (extra && extra.dx || 0), h / 2 + 2, w - 28 - (extra && extra.pad || 0), px, font);
};
function drawNatty(c, w, h) { // a Natty Boh-style beer sign: bold wordmark on red / cream / blue, drawn from text + flat shapes only
  c.fillStyle = '#c8302a'; rr(c, 0, 0, w, h, 14); c.fill(); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; rr(c, 6, 6, w - 12, h - 12, 10); c.stroke();
  c.fillStyle = '#2f5bd3'; c.fillRect(14, h * 0.62, w - 28, h * 0.2); c.fillStyle = '#eae6dc'; c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, 'NATTY', w / 2, h * 0.23, w - 40, 30, SANS); fitText(c, 'BOH', w / 2, h * 0.43, w - 90, 30, SANS);
  c.fillStyle = '#eae6dc'; fitText(c, 'ICE COLD · BALTIMORE', w / 2, h * 0.72, w - 36, 14, SERIF, 'bold');
  c.strokeStyle = '#ffd23c'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, h * 0.9); c.lineTo(w - 24, h * 0.9); c.stroke();
}
function drawUtz(c, w, h) { // Utz-style: red script on gold, drawn from text
  c.fillStyle = '#d8a828'; rr(c, 0, 0, w, h, 10); c.fill(); c.strokeStyle = '#2f5bd3'; c.lineWidth = 5; rr(c, 4, 4, w - 8, h - 8, 8); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#eae6dc'; c.lineJoin = 'round'; c.font = `italic bold 58px ${SERIF}`; c.strokeText('Utz', w / 2, h * 0.4); c.fillStyle = '#c8302a'; c.fillText('Utz', w / 2, h * 0.4);
  c.fillStyle = '#2f5bd3'; fitText(c, 'POTATO CHIPS', w / 2, h * 0.7, w - 22, 13, SANS); c.fillStyle = INK; fitText(c, 'HANOVER, PA', w / 2, h * 0.86, w - 30, 10, SERIF, 'bold');
}
function drawOldBay(c, w, h) { // Old Bay-style seasoning tin: yellow tin, blue band, red lettering
  c.fillStyle = '#e8b830'; rr(c, 6, 4, w - 12, h - 8, 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#2f5bd3'; c.fillRect(6, h * 0.12, w - 12, h * 0.2); c.fillStyle = '#eae6dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'OLD BAY', w / 2, h * 0.22, w - 24, 20, SANS);
  c.fillStyle = '#c8302a'; fitText(c, 'SEASONING', w / 2, h * 0.5, w - 20, 15, SANS); c.fillStyle = INK; fitText(c, 'FOR SEAFOOD', w / 2, h * 0.64, w - 26, 10, SERIF, 'bold'); c.fillStyle = '#c8302a'; c.beginPath(); c.arc(w / 2, h * 0.82, 9, 0, 7); c.fill(); c.fillStyle = '#eae6dc'; c.fillRect(w / 2 - 6, h * 0.82 - 1.5, 12, 3);
}
function crabSign(text, sub) { return (c, w, h) => { c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#f08a50'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, text, w / 2, h * 0.42, w - 40, 36, SANS); c.fillStyle = '#eae6dc'; fitText(c, sub, w / 2, h * 0.8, w - 60, 12, SERIF, 'bold'); c.fillStyle = '#c8302a'; for (const sx of [18, w - 18]) { c.beginPath(); c.ellipse(sx, h / 2, 9, 6, 0, 0, 7); c.fill(); } }; }
function barberSign(c, w, h) { c.fillStyle = '#eae6dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f5bd3'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#c8302a' : '#2f5bd3'; c.save(); c.beginPath(); c.rect(10, 8, 26, h - 16); c.clip(); c.fillRect(0, 8 + i * 12 - 10, 60, 6); c.restore(); } c.fillStyle = '#c8302a'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'BARBER', w / 2 + 14, h / 2 + 2, w - 90, 36, SANS); }

// ---------- awning / glass block / shutter / grille ----------
const awning = (a, b) => (c, w, h) => { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(i * (w / 4), 0, w / 4, h); } c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h - 6, w, 6); };
function drawGlassBlock(c, w, h) { c.fillStyle = '#5f7a82'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const g = c.createLinearGradient(i * 16, j * 16, i * 16 + 16, j * 16 + 16); g.addColorStop(0, '#b8d4d8'); g.addColorStop(1, '#7a9aa2'); c.fillStyle = g; c.fillRect(i * 16 + 1.5, j * 16 + 1.5, 13, 13); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(i * 16 + 3, j * 16 + 3, 4, 2); } }
function drawShutter(c, w, h) { for (let y = 0; y < h; y += 8) { c.fillStyle = '#6f6a62'; c.fillRect(0, y, w, 8); c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(0, y + 6, w, 2); } c.fillStyle = 'rgba(20,16,31,0.25)'; for (let x = 18; x < w; x += 46) c.fillRect(x, 0, 2, h); }
function drawGrille(c, w, h) { c.clearRect(0, 0, w, h); c.fillStyle = INK; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6); for (let x = 8; x < w; x += 12) c.fillRect(x, 0, 4, h); c.fillRect(0, h / 2 - 2, w, 4); }
function drawOpenSign(c, w, h) { c.fillStyle = INK; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff3a1c'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#ff3a1c'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, 'OPEN', w / 2, h / 2 + 2, w - 24, 30, SANS); }

const T = (w, h, draw) => ({ w, h, draw });
const KIT = {};
const add = (o) => Object.assign(KIT, o);
// order matters for shelf packing: tall tiles first
add({ door_0: T(96, 192, drawDoor('#2f5a3a', 1)), door_1: T(96, 192, drawDoor('#6a1f3a', 2)), door_2: T(96, 192, drawDoor('#2c322e', 3)), door_3: T(96, 192, drawDoor('#3a5a8a', 4)) });
add({ win_0: T(80, 144, drawWindow(0)), win_1: T(80, 144, drawWindow(1)), win_2: T(80, 144, drawWindow(2)) });
for (let i = 0; i < 3; i++) KIT['fs_' + i] = T(128, 128, drawFormstone(['#a39a8a', '#a8978f', '#9a9a94'][i], 11 + i * 7, i === 1 ? 1 : 0));
KIT.fs_3 = T(128, 128, drawFormstone('#b0a48c', 40, 0));
for (let i = 0; i < 3; i++) KIT['ps_' + i] = T(128, 128, drawPermastone(['#b9b0a0', '#a8a49a', '#b4a69c'][i], 21 + i * 5));
for (const [n, col] of [['br_red', '#8a4a3a'], ['br_tan', '#9a6a44'], ['br_plum', '#5a4f5c'], ['br_grey', '#6f6a62'], ['br_green', '#4f5a52'], ['br_sand', '#a4907a']]) KIT[n] = T(128, 128, drawBrick(col, n.length * 31 + col.charCodeAt(2)));
['#c9b48a', '#b8a27a', '#9ab0b8', '#c49a9a'].forEach((col, i) => (KIT['pt_' + i] = T(128, 128, drawBrick(col, 70 + i, true))));
for (const [n, f] of Object.entries(SCREENS)) KIT[n] = T(112, 128, (c, w, h) => screenFrame(c, w, h, f));
add({
  sign_natty: T(192, 128, drawNatty), sign_tavern: T(256, 64, board('#2c322e', '#ffa050', 'TAVERN', '#ffa050', 44)), sign_crab: T(256, 64, crabSign('CRAB HOUSE', 'STEAMED · BY THE DOZEN')),
  sign_bar_grill: T(256, 64, board('#5a2438', '#eae6dc', 'BAR & GRILL', '#eae6dc', 40)),
  shop_market: T(256, 64, board('#2f5a3a', '#eae6dc', 'CORNER MARKET', '#ffe08a', 38)), shop_carryout: T(256, 64, board('#b8302a', '#ffe08a', 'CARRYOUT', '#ffe08a', 44)),
  shop_barber: T(256, 64, barberSign), shop_hardware: T(256, 64, board('#3a5a8a', '#eae6dc', 'HARDWARE', '#eae6dc', 42)), shop_laundromat: T(256, 64, board('#4a8a9a', '#eae6dc', 'LAUNDROMAT', '#eae6dc', 38)),
  shop_deli: T(256, 64, board('#8a4a3a', '#ffe08a', 'DELI', '#ffe08a', 46)),
  prod_utz: T(96, 128, drawUtz), prod_oldbay: T(96, 128, drawOldBay), prod_open: T(96, 48, drawOpenSign),
});
KIT.prod_natty = T(96, 96, (c, w, h) => { c.save(); c.scale(w / 192, h / 128); drawNatty(c, 192, 128); c.restore(); });
add({ awn_red: T(64, 64, awning('#b8302a', '#eae6dc')), awn_green: T(64, 64, awning('#2f5a3a', '#eae6dc')), awn_blue: T(64, 64, awning('#2f5bd3', '#eae6dc')), glassblock: T(64, 64, drawGlassBlock), shutter: T(128, 128, drawShutter), grille: T(64, 48, drawGrille) });
for (let d = 0; d < 10; d++) KIT['d' + d] = T(32, 48, drawDigit(d));
return KIT;
})();

// ---- vendor/taskAB/rowkit_rowhouse.js ----
// rowkit_rowhouse.js — Task A, piece 1: the Baltimore rowhouse (3 or 4 storeys; Formstone / brick / painted brick / permastone).
// Everything is written through `out` (solid / glow / decal / coll / bld / lamp / hook), so a whole block merges into one chunk:
// 1 toon mesh + 1 ink hull + 1 glow mesh + 1 decal mesh (the kit atlas) = 4 draw calls. Facades are decals in 1.2 m cells of the
// atlas tiles (tileable, randomly mirrored), windows are one decal each + seeded night glow, relief is real geometry:
// marble stoop with rails, bracketed cornice with dentils, lintels, sills, string course, hood, downspout, roof hatch / deck.
// No imports; no Math.random (seeded LCG from opts.seed); materials only through K / out.
const META_ROWHOUSE = { id: 'rowhouse', kind: 'kit', footprint: [4.8, 13], floors: [3, 4] };

const rhRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const rhHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rhTone = (h, f) => '#' + rhHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function rhKit(K, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16, SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const bx = (w, h, d, skip = '') => { // BoxGeometry minus the faces nobody can see (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d);
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  };
  const wedge = (w, h, d) => { // bracket: triangular prism; wall at z = 0, foot (y 0, z 0), top at y = h, nose (y h, z d). 4 triangles
    const P = [], N = [], x0 = -w / 2, x1 = w / 2, A = [0, 0], B = [h, 0], C = [h, d], v = (x, q) => [x, q[0], q[1]];
    const tri = (a, b, c, n) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; } P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); };
    tri(v(x1, A), v(x1, B), v(x1, C), [1, 0, 0]); tri(v(x0, A), v(x0, B), v(x0, C), [-1, 0, 0]);
    const l = Math.hypot(h, d), n = [0, -d / l, h / l]; tri(v(x0, A), v(x1, A), v(x1, C), n); tri(v(x0, A), v(x1, C), v(x0, C), n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); return g;
  };
  const wall = (cx, cz, ry, len) => { const s = Math.sin(ry), c = Math.cos(ry); return { cx, cz, ry, len, pt: (u, off) => [cx + u * c + off * s, cz - u * s + off * c] }; };
  const fin = (g, Wl, u, y, off) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); return K.place(g, X, CURB, Z, ANG); };
  const S = {
    bx, wedge, wall, CURB,
    box(Wl, w, h, d, u, y, off, col, o = {}) { out.solid(fin(o.geom || bx(w, h, d, o.skip), Wl, u, y, off), col, !!o.ol); },     // solid box, centre at (u along wall, y, off out of wall)
    quad(Wl, w, h, u, y, off, col) { out.solid(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col, false); },                    // flat solid quad (glass backs, panels)
    glow(Wl, w, h, u, y, off, col) { out.glow(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col); },                            // flat glowing quad
    decal(Wl, w, h, u, y, off, tile, flip = false) { const g = new THREE.PlaneGeometry(w, h); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } out.decal(fin(g, Wl, u, y, off), atlas, tile); },
    // a tiled facade: cells of ~1.2 m, one atlas tile each, mirrored at random (the tiles wrap, so mirroring never shows a seam)
    cells(Wl, tiles, u0, u1, y0, y1, off, R) {
      const nx = Math.max(1, Math.ceil((u1 - u0) / 1.2)), ny = Math.max(1, Math.ceil((y1 - y0) / 1.2)), cw = (u1 - u0) / nx, ch = (y1 - y0) / ny;
      // LOD (Hark perf pass): a collector with out.tiled takes the whole run as ONE quad (tile variants + random mirroring are picked per cell in
      // the game's shader) instead of nx * ny cell decals. The R() draws still run, so a seed builds the same house either way.
      if (out.tiled) out.tiled(fin(new THREE.PlaneGeometry(u1 - u0, y1 - y0), Wl, (u0 + u1) / 2, (y0 + y1) / 2, off), atlas, tiles, nx, ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const t = tiles[Math.floor(R() * tiles.length)], fl = R() < 0.5; if (!out.tiled) S.decal(Wl, cw, ch, u0 + cw * (i + 0.5), y0 + ch * (j + 0.5), off, t, fl); }
    },
    toWorld(lx, lz) { return [X + lx * Math.cos(ANG) + lz * Math.sin(ANG), Z - lx * Math.sin(ANG) + lz * Math.cos(ANG)]; },
    aabb(lx0, lx1, lz0, lz1) { const p = [S.toWorld(lx0, lz0), S.toWorld(lx1, lz0), S.toWorld(lx1, lz1), S.toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    coll(lx0, lx1, lz0, lz1) { out.coll(S.aabb(lx0, lx1, lz0, lz1)); },
    bld(lx0, lx1, lz0, lz1, h) { out.bld(Object.assign(S.aabb(lx0, lx1, lz0, lz1), { h })); },
  };
  return S;
}

// window tile layout (rowkit_tiles.js drawWindow): 80x144 px, frame 8 px, upper glass y 8..68, rail 68..76, lower glass y 76..136
const RH_WW = 1.12, RH_WH = 2.04, RH_PX = RH_WW / 80, RH_PY = RH_WH / 144;
const RH_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];
const RH_STONE = '#6f6a62', RH_MARBLE = '#eae6dc', RH_IRON = '#2c322e', RH_ROOF = '#4a4a50', RH_SAND = '#a4907a';

// one 1/1 sash window (decal) with night glow and stone lintel + sill. y0 = bottom of the frame.
function rowhouseWindow(S, Wl, u, y0, o) {
  const cy = y0 + RH_WH / 2; if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, RH_WW, RH_WH, u, cy, 0.02, 'win_' + o.style);
  if (o.lit) { // two glow panes (upper and lower sash); a painted screen hides the lower one
    S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (8 + 30) * RH_PY, 0.032, o.lit);
    if (!o.screen) S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (76 + 30) * RH_PY, 0.032, o.lit);
  }
  if (o.screen) S.decal(Wl, 0.9, 0.98, u, y0 + RH_WH - 106 * RH_PY, 0.045, o.screen);
  if (o.trim !== false) {
    S.box(Wl, RH_WW + 0.34, 0.2, 0.1, u, y0 + RH_WH + 0.1, 0.05, o.lintel || RH_SAND, { skip: 'nz' });
    S.box(Wl, RH_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, RH_MARBLE, { skip: 'nz' });
  }
}

function buildRowhouse(K, out, atlas, x, z, ang = 0, opts = {}) {
  const R = rhRng(opts.seed ?? 1), RC = rhRng((opts.seed ?? 1) * 7 + 3), RL = rhRng((opts.seed ?? 1) * 13 + 5);
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4;
  // ---- every decision is drawn once, in a fixed order, so a seed always gives the same house (opts override) ----
  const r = Array.from({ length: 24 }, () => R());
  const W = opts.width ?? 4.2 + r[0] * 1.8, D = opts.depth ?? 12 + r[1] * 2;
  const front = opts.front ?? (r[2] < 0.45 ? 'formstone' : r[2] < 0.85 ? 'brick' : 'permastone');
  const floors = opts.floors ?? (r[3] < 0.55 ? 3 : 4), vari = opts.variant ?? Math.floor(r[4] * 4);
  const paint = opts.paint ?? (front === 'brick' && r[5] < 0.35);
  const bays = opts.bays ?? (W < 4.9 ? 2 : 3), doorBay = (opts.doorSide ?? (r[6] < 0.5 ? -1 : 1)) < 0 ? 0 : bays - 1;
  const nSteps = opts.steps ?? 3 + Math.floor(r[7] * 3), stoopW = opts.stoopWidth ?? 1.3 + r[8] * 0.2, stoopP = opts.stoopProj ?? 1.4 + r[9] * 0.4;
  const corP = opts.corniceProj ?? 0.5 + r[10] * 0.3, nBr = opts.brackets ?? 4 + Math.floor(r[11] * 5), corCol = opts.corniceColor ?? RH_CORNICE[Math.floor(r[12] * RH_CORNICE.length)];
  const screens = opts.screens ?? r[13] < 0.7, deck = opts.deck ?? r[14] < 0.25, doorTile = 'door_' + (opts.doorColor ?? Math.floor(r[15] * 4)), winStyle0 = Math.floor(r[16] * 3);
  const num = opts.number ?? 100 + Math.floor(r[17] * 899), chimney = r[18] < 0.4, hood = r[19] < 0.55, sideTile = r[20] < 0.5 ? 'br_red' : 'br_tan', roofCol = r[21] < 0.5 ? RH_ROOF : '#5a5058';
  const left = !!opts.left, right = !!opts.right; // neighbours on the local -x / +x side
  const Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const S = rhKit(K, out, atlas, x, z, ang), F = S.wall(0, 0, 0, W);

  // ---- facade tiles ----
  let tiles;
  if (front === 'formstone') tiles = ['fs_' + vari];
  else if (front === 'permastone') tiles = ['ps_' + (vari % 3)];
  else if (paint) tiles = ['pt_' + (vari % 4)];
  else tiles = [['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][opts.brick ?? [0, 1, 0, 2, 3, 4, 5][vari % 7]]];
  const wallCol = { formstone: '#8f867a', permastone: '#a8a49a', brick: '#8a4a3a' }[front];

  // ---- body, facade, sides ----
  S.box(F, W, roofY, D, 0, roofY / 2, -D / 2, wallCol, { skip: 'ny', ol: true });
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });                                  // parapet block behind the front decals
  S.cells(F, tiles, -W / 2, W / 2, 0, parTop, 0.012, RC);
  const sideWalls = [];
  if (!right) sideWalls.push([1, Math.PI / 2]); if (!left) sideWalls.push([-1, -Math.PI / 2]);
  for (const [sgn, ry] of sideWalls) { // exposed end of the row: brick wall, a few small windows, parapet
    const Sw = S.wall(sgn * W / 2, -D / 2, ry, D);
    S.cells(Sw, [sideTile], -D / 2, D / 2, 0, parTop, 0.012, RC);
    S.box(Sw, D, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });
    for (let f = 0; f < floors; f++) for (const uu of [-D * 0.18, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Sw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + Math.round(uu)) % 3 + 3) % 3); if (RL() < 0.45) S.glow(Sw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }
  // shared party walls: only the part standing above a lower neighbour shows, so it gets brick cells too
  for (const [has, sgn, ry, top] of [[left, -1, -Math.PI / 2, opts.leftTop ?? parTop], [right, 1, Math.PI / 2, opts.rightTop ?? parTop]]) if (has && top < parTop - 0.2) S.cells(S.wall(sgn * W / 2, -D / 2, ry, D), [sideTile], -D / 2, D / 2, top, parTop, 0.012, RC);
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' });                             // back parapet
  S.box(F, 0.2, 0.5, D, -W / 2 + 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'nx ny', ol: false });
  S.box(F, 0.2, 0.5, D, W / 2 - 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'px ny', ol: false });
  S.box(F, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, roofCol, { skip: 'ny nx px pz nz' });         // roof membrane (darker than the parapet cap)
  // ---- bays: door, windows, basement windows ----
  const bw = W / bays, bc = (k) => -W / 2 + bw * (k + 0.5), doorU = bc(doorBay);
  // stone water table + its cap: gapped at the door bay (fix M1: it used to run across the bottom of the door), so the stoop meets the door
  const gap0 = doorU - 0.65, gap1 = doorU + 0.65;
  for (const [a, b] of [[-W / 2, gap0], [gap1, W / 2]]) if (b - a > 0.05) {
    S.box(F, b - a, 1.25, 0.1, (a + b) / 2, 0.625, 0.05, RH_STONE, { skip: 'nz ny', ol: true });
    S.box(F, b - a, 0.1, 0.16, (a + b) / 2, 1.28, 0.08, rhTone(RH_STONE, 1.25), { skip: 'nz ny' });
  }
  S.box(F, W, 0.12, 0.08, 0, GF, 0.04, '#c9b48a', { skip: 'nz ny' });
  S.box(F, W, 0.1, 0.07, 0, Htot - 0.42, 0.035, rhTone('#c9b48a', 0.85), { skip: 'nz ny' });
  const litCol = () => (RL() < 0.5 ? '#ffe08a' : '#ffbf3c');
  for (let k = 0; k < bays; k++) {
    const u = bc(k);
    if (k !== doorBay) {
      rowhouseWindow(S, F, u, 1.55, { stats: opts.stats, style: (winStyle0 + k) % 3, lit: RL() < 0.45 ? litCol() : null, screen: screens ? ['scr_cottage', 'scr_swan', 'scr_lighthouse', 'scr_sail', 'scr_crab', 'scr_heron'][Math.floor(RL() * 6)] : null });
      S.quad(F, 0.8, 0.42, u, 0.7, 0.108, RH_IRON); S.decal(F, 0.84, 0.46, u, 0.7, 0.118, 'grille'); S.box(F, 1.0, 0.07, 0.16, u, 0.4, 0.08, RH_MARBLE, { skip: 'nz' });
    }
    for (let f = 1; f < floors; f++) rowhouseWindow(S, F, u, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (winStyle0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }
  // ---- door + marble stoop ----
  const rise = 0.2, sill = nSteps * rise, dH = 2.05;
  S.box(F, 0.14, dH + 0.7, 0.16, doorU - 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 0.14, dH + 0.7, 0.16, doorU + 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 1.5, 0.24, 0.18, doorU, sill + dH + 0.7 + 0.12, 0.09, RH_SAND, { skip: 'nz ny' });
  S.decal(F, 1.0, dH, doorU, sill + dH / 2, 0.04, doorTile);
  S.box(F, 1.24, 0.07, 0.2, doorU, sill + 0.035, 0.1, RH_MARBLE, { skip: 'nz ny', ol: true });                                   // marble threshold (fix M1)
  S.quad(F, 1.0, 0.5, doorU, sill + dH + 0.3, 0.05, '#4f6676');
  if (RL() < 0.5) S.glow(F, 0.9, 0.4, doorU, sill + dH + 0.3, 0.06, litCol());
  S.box(F, 1.0, 0.06, 0.1, doorU, sill + dH + 0.03, 0.06, '#c9b48a', { skip: 'nz' });
  const dg = String(num).slice(0, 3).split(''); dg.forEach((d, i) => S.decal(F, 0.15, 0.22, doorU + (i - 1) * 0.16, sill + dH + 0.32, 0.07, 'd' + d));
  if (hood) { S.box(F, 1.7, 0.1, 0.38, doorU, sill + dH + 1.05, 0.19, corCol, { skip: 'nz ny', ol: true }); for (const s of [-0.62, 0.62]) S.box(F, 0, 0, 0, doorU + s, sill + dH + 0.75, 0.1, rhTone(corCol, 0.8), { geom: S.wedge(0.1, 0.3, 0.28), ol: false }); }
  for (let i = 0; i < nSteps; i++) { // each step a solid block (front, top, both sides), marble with a cool shadow band at the foot of every riser
    const sd = stoopP - i * (stoopP / nSteps), top = (i + 1) * rise;
    S.box(F, stoopW, top, sd, doorU, top / 2, sd / 2, RH_MARBLE, { skip: 'nz ny', ol: true });
    S.quad(F, stoopW, rise * 0.3, doorU, i * rise + rise * 0.15, sd + 0.006, '#aeb4c6');
    S.box(F, stoopW + 0.06, 0.04, 0.05, doorU, top + 0.02, sd + 0.01, '#f2f2f2', { skip: 'nz ny' });
  }
  for (const s of [-1, 1]) { // iron handrails: two posts and a sloping rail each side
    const rx = doorU + s * (stoopW / 2 - 0.03), ph = 0.8;
    for (const [pz, py] of [[stoopP - 0.12, rise + ph / 2], [0.12, sill + ph / 2]]) S.box(F, 0.05, ph, 0.05, rx, py, pz, RH_IRON, { skip: 'ny' });
    const len = Math.hypot(stoopP - 0.24, sill - rise), g = S.bx(0.04, 0.04, len, 'nz pz'); g.rotateX(Math.atan2(sill - rise, stoopP - 0.24)); // slope rises toward the door
    S.box(F, 0, 0, 0, rx, (rise + sill) / 2 + ph, (stoopP) / 2, RH_IRON, { geom: g });
  }
  S.coll(doorU - stoopW / 2, doorU + stoopW / 2, 0, stoopP);

  // ---- bracketed cornice with dentils ----
  S.box(F, W, 0.42, 0.1, 0, Htot - 0.21, 0.05, rhTone(corCol, 0.82), { skip: 'nz ny' });                                   // frieze
  S.box(F, W, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true });
  S.box(F, W, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, rhTone(corCol, 1.12), { skip: 'nz', ol: true });
  const brU = []; for (let i = 0; i < nBr; i++) { const u = -W / 2 + (i + 0.5) * W / nBr; brU.push(u); S.box(F, 0, 0, 0, u, Htot - 0.42, 0.1, rhTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14), ol: false }); }
  for (let u = -W / 2 + 0.1; u < W / 2 - 0.05; u += 0.15) { if (brU.some((b) => Math.abs(b - u) < 0.16)) continue; S.box(F, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' }); }

  // ---- downspout, roof details ----
  const dsU = doorBay === 0 ? W / 2 - 0.12 : -W / 2 + 0.12;
  S.box(F, 0, 0, 0, dsU, (Htot + 0.3) / 2, 0.07, '#4f5a52', { geom: new K.THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(F, 0.14, 0.16, 0.14, dsU, 0.1, 0.1, '#4f5a52', { skip: 'ny' });
  S.box(F, 0.9, 0.5, 0.9, -W / 4, roofY + 0.31, -D + 2.2, '#6f6a62', { skip: 'ny', ol: true });                           // roof hatch + lid
  S.box(F, 1.0, 0.08, 1.0, -W / 4, roofY + 0.6, -D + 2.2, '#4f5a52', { skip: 'ny' });
  if (chimney) S.box(F, 0.6, 1.6, 0.9, W / 4, roofY + 0.8, -D + 1.4, '#8a4a3a', { skip: 'ny', ol: true });
  if (deck) { // rooftop deck: planks, posts and two rails
    const dz = -D + 6, dw = W - 1.0, dd = 3.2; S.box(F, dw, 0.14, dd, 0, roofY + 0.07, dz, '#9a6a44', { skip: 'ny' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box(F, 0.06, 0.9, 0.06, sx * (dw / 2 - 0.05), roofY + 0.55, dz + sz * (dd / 2 - 0.05), RH_IRON, { skip: 'ny' });
    for (const ry of [0.55, 0.95]) { S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz - dd / 2 + 0.05, RH_IRON, { skip: 'ny' }); S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz + dd / 2 - 0.05, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, -dw / 2 + 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, dw / 2 - 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); }
  }

  // ---- gameplay data: footprint collider, camera box, climb hook ----
  S.coll(-W / 2, W / 2, 0, -D); S.bld(-W / 2, W / 2, 0, -D, S.CURB + parTop);                   // heights in world y (fix m1)
  if (opts.climb) { const [hx, hz] = S.toWorld(dsU, 0.12); out.hook('climb', { x: hx, z: hz, ang: ang, top: S.CURB + parTop }); }
  return { width: W, depth: D, height: parTop };
}

// ---- vendor/taskAB/rowkit_corner.js ----
// rowkit_corner.js — Task A, pieces 2 and 3: the end-of-row corner BAR and corner SHOP (chamfered corner door, 3 or 4 storeys).
// Same rules as the rowhouse: everything goes through `out` (4 draw calls per block, 1 atlas), facades are atlas decal cells,
// windows glow at night from a seeded RNG (~45 % lit), shop glass / glass block / neon always glow at night.
//  * Bar: glass-block windows, striped awning, chamfered corner door with neon over it (TAVERN / CRABS / GRILL, built from
//    stroke geometry: glows at night, dull tube colour by day), a Natty Boh-style blade sign, painted wall board (TAVERN, CRAB HOUSE, BAR & GRILL).
//  * Shop: big shop window with real local product signs (Utz, Old Bay, Natty Boh-style, OPEN), roll-up shutter (closed / half / none),
//    awning, wall sign (CORNER MARKET, CARRYOUT, BARBER, HARDWARE, LAUNDROMAT, DELI).
// All lettering is drawn on canvas in rowkit_tiles.js or built from stroke geometry here; no logo files. No imports; no Math.random.
const META_CORNER = { id: 'corner', kind: 'kit', footprint: [7.2, 7.5], floors: [3, 4], pieces: ['corner_bar', 'corner_shop'] };

const cnRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const cnHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cnTone = (h, f) => '#' + cnHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function cnKit(K, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16, SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const bx = (w, h, d, skip = '') => { // BoxGeometry minus the faces nobody can see (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d);
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  };
  const wedge = (w, h, d) => { // bracket: triangular prism; wall at z = 0, foot (y 0, z 0), top at y = h, nose (y h, z d). 4 triangles
    const P = [], N = [], x0 = -w / 2, x1 = w / 2, A = [0, 0], B = [h, 0], C = [h, d], v = (x, q) => [x, q[0], q[1]];
    const tri = (a, b, c, n) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; } P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); };
    tri(v(x1, A), v(x1, B), v(x1, C), [1, 0, 0]); tri(v(x0, A), v(x0, B), v(x0, C), [-1, 0, 0]);
    const l = Math.hypot(h, d), n = [0, -d / l, h / l]; tri(v(x0, A), v(x1, A), v(x1, C), n); tri(v(x0, A), v(x1, C), v(x0, C), n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); return g;
  };
  const wall = (cx, cz, ry, len) => { const s = Math.sin(ry), c = Math.cos(ry); return { cx, cz, ry, len, pt: (u, off) => [cx + u * c + off * s, cz - u * s + off * c] }; };
  const fin = (g, Wl, u, y, off) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); return K.place(g, X, CURB, Z, ANG); };
  const S = {
    bx, wedge, wall, CURB,
    box(Wl, w, h, d, u, y, off, col, o = {}) { out.solid(fin(o.geom || bx(w, h, d, o.skip), Wl, u, y, off), col, !!o.ol); },     // solid box, centre at (u along wall, y, off out of wall)
    quad(Wl, w, h, u, y, off, col) { out.solid(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col, false); },                    // flat solid quad (glass backs, panels)
    glow(Wl, w, h, u, y, off, col) { out.glow(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col); },                            // flat glowing quad
    decal(Wl, w, h, u, y, off, tile, flip = false) { const g = new THREE.PlaneGeometry(w, h); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } out.decal(fin(g, Wl, u, y, off), atlas, tile); },
    // a tiled facade: cells of ~1.2 m, one atlas tile each, mirrored at random (the tiles wrap, so mirroring never shows a seam)
    cells(Wl, tiles, u0, u1, y0, y1, off, R) {
      const nx = Math.max(1, Math.ceil((u1 - u0) / 1.2)), ny = Math.max(1, Math.ceil((y1 - y0) / 1.2)), cw = (u1 - u0) / nx, ch = (y1 - y0) / ny;
      // LOD (Hark perf pass): a collector with out.tiled takes the whole run as ONE quad (tile variants + random mirroring are picked per cell in
      // the game's shader) instead of nx * ny cell decals. The R() draws still run, so a seed builds the same house either way.
      if (out.tiled) out.tiled(fin(new THREE.PlaneGeometry(u1 - u0, y1 - y0), Wl, (u0 + u1) / 2, (y0 + y1) / 2, off), atlas, tiles, nx, ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const t = tiles[Math.floor(R() * tiles.length)], fl = R() < 0.5; if (!out.tiled) S.decal(Wl, cw, ch, u0 + cw * (i + 0.5), y0 + ch * (j + 0.5), off, t, fl); }
    },
    toWorld(lx, lz) { return [X + lx * Math.cos(ANG) + lz * Math.sin(ANG), Z - lx * Math.sin(ANG) + lz * Math.cos(ANG)]; },
    aabb(lx0, lx1, lz0, lz1) { const p = [S.toWorld(lx0, lz0), S.toWorld(lx1, lz0), S.toWorld(lx1, lz1), S.toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    coll(lx0, lx1, lz0, lz1) { out.coll(S.aabb(lx0, lx1, lz0, lz1)); },
    bld(lx0, lx1, lz0, lz1, h) { out.bld(Object.assign(S.aabb(lx0, lx1, lz0, lz1), { h })); },
  };
  return S;
}
// extra emitters used only by the corner pieces
function cnExtend(K, S, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16;
  // a thin quad between two points of a wall plane (neon tube strokes): solid dull tube + glowing tube
  S.seg = (Wl, u0, y0, u1, y1, th, off, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mk = () => { const g = new THREE.PlaneGeometry(len + th * 0.7, th); g.rotateZ(a); return g; };
    const mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    for (const [g, d] of [[mk(), dim], [mk(), null]]) { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(mx, off + (d ? 0 : 0.012)); g.translate(px, my, pz); K.place(g, X, CURB, Z, ANG); if (d) out.solid(g, d, false); else out.glow(g, bright); }
  };
  // a flat quad sloping out of the wall like an awning: top edge at (y, off0), outer edge lower and `proj` further out
  S.awning = (Wl, w, u, yTop, off0, proj, drop, tile) => {
    const l = Math.hypot(proj, drop), g = new THREE.PlaneGeometry(w, l); g.rotateX(-(Math.PI / 2 - Math.atan2(drop, proj)));
    S.decalGeom(Wl, g, u, yTop - drop / 2, off0 + proj / 2, tile);
  };
  S.decalGeom = (Wl, g, u, y, off, tile) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); K.place(g, X, CURB, Z, ANG); out.decal(g, atlas, tile); };
  // a vertical blade sign: plane whose normal is `ny` (a local direction angle), double sided
  S.blade = (Wl, w, h, u, y, off, ryExtra, tile) => { const g = new THREE.PlaneGeometry(w, h); g.rotateY(ryExtra); S.decalGeom(Wl, g, u, y, off, tile); };
}

// ---------- neon stroke font (A-Z & -): polylines on a 2 x 4 grid ----------
const CN_FONT = {
  A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
  C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], D: [[[0, 0], [0, 4], [1.3, 4], [2, 3.2], [2, 0.8], [1.3, 0], [0, 0]]],
  E: [[[2, 4], [0, 4], [0, 0], [2, 0]], [[0, 2], [1.5, 2]]], F: [[[2, 4], [0, 4], [0, 0]], [[0, 2], [1.5, 2]]],
  G: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 1.8], [1, 1.8]]], H: [[[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]],
  I: [[[0.5, 4], [1.5, 4]], [[1, 4], [1, 0]], [[0.5, 0], [1.5, 0]]], J: [[[2, 4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], K: [[[0, 0], [0, 4]], [[2, 4], [0, 1.8]], [[0.6, 2.4], [2, 0]]],
  L: [[[0, 4], [0, 0], [2, 0]]], M: [[[0, 0], [0, 4], [1, 2], [2, 4], [2, 0]]], N: [[[0, 0], [0, 4], [2, 0], [2, 4]]],
  O: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]]], P: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]]],
  Q: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]], [[1.2, 1], [2, 0]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
  S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], T: [[[0, 4], [2, 4]], [[1, 4], [1, 0]]],
  U: [[[0, 4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 4]]], V: [[[0, 4], [1, 0], [2, 4]]], W: [[[0, 4], [0.5, 0], [1, 2], [1.5, 0], [2, 4]]], X: [[[0, 4], [2, 0]], [[0, 0], [2, 4]]],
  Y: [[[0, 4], [1, 2], [2, 4]], [[1, 2], [1, 0]]], Z: [[[0, 4], [2, 4], [0, 0], [2, 0]]], '&': [[[2, 0], [0.4, 2.4], [0.5, 3.6], [1.1, 4], [1.7, 3.6], [1.6, 2.8], [0, 0.9], [0.5, 0], [1.4, 0], [2, 1.2]]], '-': [[[0.3, 2], [1.7, 2]]],
};
// neon word centred at u; letter height h. returns the width used. `dim` is the unlit tube colour, `bright` the glow colour.
function cnNeon(S, Wl, text, u, y, off, h, dim, bright) {
  const sc = h / 4, adv = 2 * sc + 0.28 * h, total = text.length * adv - 0.28 * h; let x = u - total / 2;
  for (const ch of text) { for (const pl of CN_FONT[ch] || []) for (let i = 0; i + 1 < pl.length; i++) S.seg(Wl, x + pl[i][0] * sc, y - h / 2 + pl[i][1] * sc, x + pl[i + 1][0] * sc, y - h / 2 + pl[i + 1][1] * sc, h * 0.13, off, dim, bright); x += adv; }
  return total;
}

const CN_WW = 1.12, CN_WH = 2.04, CN_PX = CN_WW / 80, CN_PY = CN_WH / 144;
const CN_STONE = '#6f6a62', CN_MARBLE = '#eae6dc', CN_IRON = '#2c322e', CN_SAND = '#a4907a', CN_ROOF = '#4a4a50', CN_TRIM = '#c9b48a', CN_PLUM = '#5a4f5c';
const CN_WARM = ['#ffe08a', '#ffbf3c'];

function cnWindow(S, Wl, u, y0, o) { // 1/1 sash decal + seeded night glow + lintel/sill
  if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, CN_WW, CN_WH, u, y0 + CN_WH / 2, 0.02, 'win_' + o.style);
  if (o.lit) { S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 38 * CN_PY, 0.032, o.lit); S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 106 * CN_PY, 0.032, o.lit); }
  S.box(Wl, CN_WW + 0.34, 0.2, 0.1, u, y0 + CN_WH + 0.1, 0.05, CN_SAND, { skip: 'nz' }); S.box(Wl, CN_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, CN_MARBLE, { skip: 'nz' });
}

function cnBuild(K, out, atlas, x, z, ang, opts, kind) {
  const seed = opts.seed ?? 1, R = cnRng(seed), RL = cnRng(seed * 11 + 1), RC = cnRng(seed * 5 + 9), THREE = K.THREE;
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, r = Array.from({ length: 16 }, () => R());
  const cs = opts.corner ?? (r[0] < 0.5 ? 1 : -1), W = opts.width ?? 6.5 + r[1] * 1.5, D = opts.depth ?? 7.5, c = opts.chamfer ?? 1.8;
  const floors = opts.floors ?? (r[2] < 0.5 ? 3 : 4), Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const brick = opts.brick ?? Math.floor(r[3] * 6), tile = ['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][brick], paintTile = r[4] < 0.3 ? 'pt_' + Math.floor(r[5] * 4) : null;
  const wallTiles = [paintTile || tile], wallCol = '#8a4a3a', corCol = opts.corniceColor ?? ['#c9b48a', '#4f5a52', '#5a4f5c', '#a4907a'][Math.floor(r[6] * 4)];
  const left = !!opts.left;
  const S = cnKit(K, out, atlas, x, z, ang); cnExtend(K, S, out, atlas, x, z, ang);
  const O = S.wall(0, 0, 0, 1), F = S.wall(-cs * c / 2, 0, 0, W - c), Ch = S.wall(cs * (W / 2 - c / 2), -c / 2, cs * Math.PI / 4, c * Math.SQRT2), Sd = S.wall(cs * W / 2, -(c + D) / 2, cs * Math.PI / 2, D - c);
  const litCol = () => CN_WARM[RL() < 0.5 ? 0 : 1];

  // ---- body: chamfered footprint, extruded ----
  const pts = [[-W / 2, 0], [W / 2 - c, 0], [W / 2, -c], [W / 2, -D], [-W / 2, -D]].map(([px, pz]) => [cs * px, pz]);
  const shp = new THREE.Shape(); pts.forEach(([px, pz], i) => (i ? shp.lineTo(px, -pz) : shp.moveTo(px, -pz)));
  const body = new THREE.ExtrudeGeometry(shp, { depth: roofY, bevelEnabled: false }); body.rotateX(-Math.PI / 2);
  S.box(O, 0, 0, 0, 0, 0, 0, wallCol, { geom: body, ol: true });
  S.box(O, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, CN_ROOF, { skip: 'ny nx px pz nz' });
  for (const Wl of [F, Ch, Sd]) { S.cells(Wl, wallTiles, -Wl.len / 2, Wl.len / 2, 0, parTop, 0.012, RC); S.box(Wl, Wl.len, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' }); }
  S.box(O, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' }); S.box(O, 0.2, 0.5, D, -cs * (W / 2 - 0.1), Htot + 0.7, -D / 2, wallCol, { skip: 'ny' });
  // left-hand exposed end (side opposite the corner) when there is no neighbour: brick cells on the end wall
  const lTop = left ? (opts.leftTop ?? parTop) : 0;
  if (lTop < parTop - 0.2) {
    const Lw = S.wall(-cs * W / 2, -D / 2, -cs * Math.PI / 2, D); S.cells(Lw, wallTiles, -D / 2, D / 2, lTop, parTop, 0.012, RC);
    if (!left) for (let f = 0; f < floors; f++) for (const uu of [-D * 0.2, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Lw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + (uu > 0 ? 1 : 0)) % 3)); if (RL() < 0.45) S.glow(Lw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }

  // ---- cornice around the three street walls ----
  const corP = 0.62, nBrAll = [];
  for (const Wl of [F, Ch, Sd]) {
    const L = Wl.len; S.box(Wl, L, 0.42, 0.1, 0, Htot - 0.21, 0.05, cnTone(corCol, 0.82), { skip: 'nz ny' });
    S.box(Wl, L, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true }); S.box(Wl, L, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, cnTone(corCol, 1.12), { skip: 'nz', ol: true });
    const n = Math.max(2, Math.round(L / 1.1)); for (let i = 0; i < n; i++) S.box(Wl, 0, 0, 0, -L / 2 + (i + 0.5) * L / n, Htot - 0.42, 0.1, cnTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14) });
    for (let u = -L / 2 + 0.1; u < L / 2 - 0.05; u += 0.17) S.box(Wl, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' });
  }
  S.box(F, W - c, 0.1, 0.07, 0, Htot - 0.42, 0.035, cnTone(CN_TRIM, 0.85), { skip: 'nz ny' });

  // ---- upper floors: windows on all three walls ----
  const style0 = Math.floor(r[7] * 3);
  for (const Wl of [F, Sd, Ch]) {
    const L = Wl.len, n = Wl === Ch ? 1 : Math.max(1, Math.round((L - 1.0) / 2.1));
    for (let f = 1; f < floors; f++) for (let k = 0; k < n; k++) cnWindow(S, Wl, -L / 2 + L * (k + 0.5) / n, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (style0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }

  // ---- ground floor ----
  const pilasters = (Wl) => { for (const s of [-1, 1]) S.box(Wl, 0.5, 3.9, 0.2, s * (Wl.len / 2 - 0.25), 1.95, 0.1, cnTone(CN_TRIM, 0.9), { skip: 'nz ny', ol: true }); };
  const band = (Wl, w, col, tileName) => { // painted sign board: panel + decal
    const sw = Math.min(Wl.len - 1.0, w), hh = sw / 4; S.box(Wl, sw + 0.2, hh + 0.2, 0.1, 0, 3.58, 0.05, col, { skip: 'nz ny', ol: true }); S.decal(Wl, sw, hh, 0, 3.58, 0.108, tileName); };
  const mullions = (Wl, gw, y0, gh, n) => { for (let i = 0; i <= n; i++) S.box(Wl, 0.08, gh, 0.08, -gw / 2 + gw * i / n, y0 + gh / 2, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0 + gh, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0, 0.09, CN_IRON, { skip: 'nz' }); };
  const shopWindow = (Wl, prods, shutter) => {
    const gw = Wl.len - 1.2, gy = 0.78, gh = 2.2; pilasters(Wl);
    S.box(Wl, Wl.len - 1.0, 0.7, 0.14, 0, 0.35, 0.07, CN_PLUM, { skip: 'nz ny', ol: true });
    S.quad(Wl, gw, gh, 0, gy + gh / 2, 0.06, '#4f6676'); S.glow(Wl, gw - 0.1, gh - 0.1, 0, gy + gh / 2, 0.075, '#ffd890');
    mullions(Wl, gw, gy, gh, Math.max(2, Math.round(gw / 1.5)));
    for (const p of prods) S.decal(Wl, p.w, p.h, p.u * gw / 2, gy + p.y, 0.1, p.tile);
    if (shutter) { const sh = shutter === 'closed' ? gh : gh * 0.5; S.box(Wl, gw + 0.1, 0.22, 0.2, 0, gy + gh + 0.1, 0.1, '#6f6a62', { skip: 'nz ny' }); S.decal(Wl, gw, sh, 0, gy + gh - sh / 2, 0.13, 'shutter'); }
  };
  const glassBlocks = (Wl, n) => { pilasters(Wl); S.box(Wl, Wl.len - 1.0, 0.9, 0.14, 0, 0.45, 0.07, CN_PLUM, { skip: 'nz ny', ol: true }); for (let i = 0; i < n; i++) { const u = -Wl.len / 2 + Wl.len * (i + 0.5) / n; S.decal(Wl, 1.35, 1.35, u, 2.0, 0.08, 'glassblock'); S.glow(Wl, 1.2, 1.2, u, 2.0, 0.095, RL() < 0.5 ? '#ffbf3c' : '#ffe08a'); S.box(Wl, 1.55, 0.12, 0.16, u, 1.26, 0.08, CN_MARBLE, { skip: 'nz' }); S.box(Wl, 1.5, 0.14, 0.12, u, 2.76, 0.06, CN_SAND, { skip: 'nz' }); } };

  const awnTile = kind === 'bar' ? 'awn_red' : ['awn_green', 'awn_blue', 'awn_red'][Math.floor(r[8] * 3)];
  let sign, signCol, prods = [];
  if (kind === 'bar') {
    const bs = opts.sign ?? ['tavern', 'crab', 'bar_grill'][Math.floor(r[9] * 3)];
    sign = { tavern: 'sign_tavern', crab: 'sign_crab', bar_grill: 'sign_bar_grill' }[bs]; signCol = bs === 'crab' ? '#2f5a3a' : bs === 'tavern' ? '#2c322e' : '#5a2438';
    glassBlocks(F, 2); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.2, 0, 3.0, 0.1, 1.0, 0.45, awnTile);
    glassBlocks(Sd, Math.max(1, Math.round(Sd.len / 2.6)));
    // neon over the corner door, plus a small OPEN tube beside the glass block
    const word = { tavern: 'TAVERN', crab: 'CRABS', bar_grill: 'GRILL' }[bs];
    S.box(Ch, Ch.len - 0.2, 0.7, 0.08, 0, 3.55, 0.06, '#1a1626', { skip: 'nz ny' });
    cnNeon(S, Ch, word, 0, 3.55, 0.12, 0.46, '#8a3a30', '#ff3a1c'); cnNeon(S, F, 'OPEN', F.len / 4, 1.62, 0.12, 0.26, '#6a2a38', '#ff3d6e');                              // in the glass-block window, below the awning (fix m9)
    // blade sign at the corner edge: the Natty Boh-style beer sign, with a lit rim
    const bu = 0, bo = 1.05; S.box(Ch, 0.08, 0.08, bo, bu, 4.62, bo / 2, CN_IRON, { skip: 'nz' });
    S.blade(Ch, 0.86, 0.573, bu, 4.62, bo, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'sign_natty');
  } else {
    const ks = opts.sign ?? ['market', 'carryout', 'barber', 'hardware', 'laundromat', 'deli'][Math.floor(r[9] * 6)];
    sign = 'shop_' + ks; signCol = { market: '#2f5a3a', carryout: '#b8302a', barber: '#3a5a8a', hardware: '#3a5a8a', laundromat: '#4a8a9a', deli: '#8a4a3a' }[ks];
    prods = [{ tile: 'prod_utz', w: 0.5, h: 0.67, u: -0.55, y: 0.65 }, { tile: 'prod_oldbay', w: 0.5, h: 0.67, u: 0.05, y: 0.65 }, { tile: 'prod_natty', w: 0.55, h: 0.55, u: 0.62, y: 0.6 }, { tile: 'prod_open', w: 0.6, h: 0.3, u: -0.1, y: 1.7 }];
    const sh = opts.shutter ?? ['none', 'half', 'closed'][Math.floor(r[10] * 3)];
    shopWindow(F, prods, sh === 'none' ? null : sh); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.4, 0, 3.05, 0.12, 1.0, 0.4, awnTile);
    shopWindow(Sd, [{ tile: 'prod_oldbay', w: 0.5, h: 0.67, u: -0.3, y: 0.65 }, { tile: 'prod_utz', w: 0.5, h: 0.67, u: 0.3, y: 0.65 }], null); band(Sd, 3.6, signCol, sign);
    S.box(Ch, 0.08, 0.08, 0.9, 0, 4.62, 0.45, CN_IRON, { skip: 'nz' }); S.blade(Ch, 0.6, 0.8, 0, 4.62, 0.95, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'prod_utz');
  }
  // corner door in the chamfer: panel door, transom with glow, jambs, one marble step
  const doorTile = 'door_' + (kind === 'bar' ? 2 : Math.floor(r[11] * 4)), sill = 0.2, dH = 2.05;
  S.box(Ch, 0.12, dH + 0.6, 0.14, -0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' }); S.box(Ch, 0.12, dH + 0.6, 0.14, 0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' });
  S.decal(Ch, 1.04, dH, 0, sill + dH / 2, 0.04, doorTile); S.quad(Ch, 1.04, 0.44, 0, sill + dH + 0.28, 0.05, '#4f6676'); S.glow(Ch, 0.94, 0.34, 0, sill + dH + 0.28, 0.06, litCol());
  S.box(Ch, 1.9, 0.18, 0.7, 0, 0.09, 0.35, CN_MARBLE, { skip: 'nz ny', ol: true }); S.box(Ch, 1.4, 0.14, 0.4, 0, 0.27 - 0.04, 0.2, cnTone(CN_MARBLE, 0.95), { skip: 'nz ny' });
  S.box(F, W - c, 0.12, 0.06, 0, GF, 0.03, CN_TRIM, { skip: 'nz ny' });
  // downspout on the open end, OUTSIDE the front wall (fix M5: it sat at off -0.07, buried in the wall). The ground-floor pilaster stands 0.2 m
  // proud there, so the pipe runs 0.27 m out (clear of the pilaster, under the 0.62 m cornice) on four wall straps, with a shoe at the foot
  const pu = -cs * (W / 2 - 0.12), po = 0.27;
  S.box(O, 0, 0, 0, pu, (Htot + 0.3) / 2, po, '#4f5a52', { geom: new THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(O, 0.14, 0.16, 0.14, pu, 0.1, po + 0.03, '#4f5a52', { skip: 'ny' });
  for (const y of [1.2, GF + 0.4, GF + FH * 0.6, Htot - 0.6]) S.box(O, 0.04, 0.04, po, pu, y, po / 2, '#3a4440', { skip: 'nz' });
  S.box(F, 0.9, 0.5, 0.9, -cs * W / 4, roofY + 0.31, -D + 2.0, '#6f6a62', { skip: 'ny', ol: true });

  // ---- gameplay data ----
  S.coll(-W / 2 * cs, (W / 2 - c) * cs, 0, -D); S.coll(cs * (W / 2 - c), cs * W / 2, -c, -D); S.coll(cs * (W / 2 - c * 0.7), cs * W / 2, 0, -c * 0.7);
  S.bld(-W / 2 * cs, (W / 2 - c) * cs, 0, -D, S.CURB + parTop); S.bld(cs * (W / 2 - c), cs * W / 2, -c, -D, S.CURB + parTop);
  const [hx, hz] = S.toWorld(-cs * (W / 2 - 0.12), 0.39); if (opts.climb) out.hook('climb', { x: hx, z: hz, ang, top: S.CURB + parTop }); // in front of the wall, beside the pipe (fix M5), world y (m1)
  return { width: W, depth: D, height: parTop, corner: cs };
}

function buildCornerBar(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'bar'); }
function buildCornerShop(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'shop'); }

// ---- vendor/taskAB/rowkit_block.js ----
// rowkit_block.js — Task A, piece 4: buildRowBlock fills ONE 24 x 24 m city block with Baltimore rowhouses.
// Layout (block drawn from the north-west, x east, z south; every front faces its street, shoulder to shoulder):
//   north row  z0 .. z0+7.5     full block width      \  houses of 4.2-6.0 m, a corner BAR or SHOP on 1-2 corners
//   south row  z1-7.5 .. z1     full block width      /  (the other corners are ordinary end-of-row houses)
//   west row   x0 .. x0+10.5    the 9 m between them   - 2 houses facing the west street
//   east row   x1-10.5 .. x1    the 9 m between them   - 2 houses facing the east street
//   a 3 x 9 m yard / rear-alley strip is left in the middle (bins and crates, closed by out.coll).
// A house in the 24 m block is therefore 7.5-10.5 m deep (the stand-alone default of 12-14 m would overlap the row behind it).
// All geometry goes through the single `out` the caller owns, so the block is one chunk write: 4 draw calls in total.
// The builders are taken from opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }; in the game build, where these
// files are concatenated, the globals of the same names are used. No imports; no Math.random (seeded LCG from opts.seed).
const META_ROWBLOCK = { id: 'rowblock', kind: 'kit', footprint: [24, 24], houses: '12-14 per block', corners: '1-2 bar / shop' };

const bkRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const BK_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];

function bkPickStyle(R, last) { // formstone 35 % · brick 35 % · painted brick 15 % · permastone 15 %; never the same as the neighbour
  for (let t = 0; t < 12; t++) {
    const q = R(), v = R(); let s;
    if (q < 0.35) s = { key: 'f' + Math.floor(v * 4), front: 'formstone', variant: Math.floor(v * 4) };
    else if (q < 0.7) { const b = Math.floor(v * 6); s = { key: 'b' + b, front: 'brick', paint: false, brick: b, variant: b }; }
    else if (q < 0.85) { const p = Math.floor(v * 4); s = { key: 'p' + p, front: 'brick', paint: true, variant: p }; }
    else { const p = Math.floor(v * 3); s = { key: 's' + p, front: 'permastone', variant: p }; }
    if (s.key !== last) return s;
  }
  return { key: 'f0', front: 'formstone', variant: 0 };
}
function bkWidths(R, rem) { // n houses of 4.2..6.0 m filling `rem` exactly
  let n = Math.max(1, Math.round(rem / 5.1)); while (rem / n > 6.0) n++; while (n > 1 && rem / n < 4.2) n--;
  const wt = Array.from({ length: n }, () => 0.85 + R() * 0.3), sum = wt.reduce((a, b) => a + b, 0); let w = wt.map((q) => (rem * q) / sum);
  if (w.some((q) => q < 4.2 || q > 6.0)) w = Array.from({ length: n }, () => rem / n);
  return w;
}

function buildRowBlock(K, out, atlas, x0, z0, x1, z1, opts = {}) {
  const B = opts.builders || {};
  const house = B.buildRowhouse || (typeof buildRowhouse === 'function' ? buildRowhouse : null);
  const bar = B.buildCornerBar || (typeof buildCornerBar === 'function' ? buildCornerBar : null);
  const shop = B.buildCornerShop || (typeof buildCornerShop === 'function' ? buildCornerShop : null);
  if (!house || !bar || !shop) throw new Error('buildRowBlock: pass opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }');
  // opts.inset (fix M6): the fronts are built on the edges of the box, and stoops (<= 1.8 m) and cornices (<= 0.9 m) stand OUT of it.
  // Pass the street plot and inset = 2 so the houses keep a 2 m pavement in front and nothing overhangs the road (default 0 = the old behaviour).
  const ins = opts.inset ?? 0; x0 += ins; z0 += ins; x1 -= ins; z1 -= ins;
  const seed = opts.seed ?? 1, R = bkRng(seed), THREE = K.THREE, CURB = K.CURB ?? 0.16;
  const XL = x1 - x0, ZL = z1 - z0, DR = opts.rowDepth ?? 7.5, ALLEY = opts.alley ?? 3, SD = (XL - ALLEY) / 2, BAND = ZL - 2 * DR;

  // ---- which corners get a bar / shop (1 or 2) ----
  const corners = { NE: null, NW: null, SW: null, SE: null }, names = ['NE', 'NW', 'SW', 'SE'];
  const c1 = names[Math.floor(R() * 4)], two = R() < 0.55, c2 = two ? names[(names.indexOf(c1) + (R() < 0.5 ? 2 : 1 + 2 * Math.floor(R() * 2))) % 4] : null;
  corners[c1] = R() < 0.5 ? 'bar' : 'shop'; if (c2 && c2 !== c1) corners[c2] = corners[c1] === 'bar' ? 'shop' : 'bar';

  // ---- plan every piece first (so exactly one gets the CLIMB hook and the styles never repeat) ----
  const rows = [
    { id: 'N', ang: Math.PI, len: XL, depth: DR, origin: (a) => [x1 - a, z0], c0: 'NE', c1: 'NW' },
    { id: 'S', ang: 0, len: XL, depth: DR, origin: (a) => [x0 + a, z1], c0: 'SW', c1: 'SE' },
    { id: 'W', ang: -Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x0, z0 + DR + a], c0: null, c1: null },
    { id: 'E', ang: Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x1, z1 - DR - a], c0: null, c1: null },
  ];
  const plan = []; let lastStyle = '', lastCor = -1;
  for (const row of rows) {
    const cw = [row.c0 && corners[row.c0] ? 6.5 + R() * 1.5 : 0, row.c1 && corners[row.c1] ? 6.5 + R() * 1.5 : 0], pieces = [];
    const widths = bkWidths(R, row.len - cw[0] - cw[1]);
    if (cw[0]) pieces.push({ w: cw[0], corner: corners[row.c0], cs: -1 }); widths.forEach((w) => pieces.push({ w, corner: null })); if (cw[1]) pieces.push({ w: cw[1], corner: corners[row.c1], cs: 1 });
    let a = 0; pieces.forEach((p, i) => { p.row = row; p.a = a + p.w / 2; p.i = i; p.n = pieces.length; a += p.w; plan.push(p); });
  }
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, topOf = (fl) => GF + (fl - 1) * FH + 0.95;
  const p3 = opts.p3 ?? 0.55; plan.forEach((p) => { p.floors = R() < p3 ? 3 : 4; p.top = topOf(p.floors); }); // opts.p3: share of 3-storey houses
  const climbAt = Math.floor(R() * plan.length);
  plan.forEach((p, idx) => {
    p.seed = seed * 131 + idx * 17 + 5; p.climb = idx === climbAt;
    if (!p.corner) { const st = bkPickStyle(R, lastStyle); lastStyle = st.key; p.style = st; let ci; do { ci = Math.floor(R() * BK_CORNICE.length); } while (ci === lastCor); lastCor = ci; p.cornice = BK_CORNICE[ci]; }
    else lastStyle = 'c';
  });

  // neighbour parapet heights: a house only needs wall cells where it stands taller than what is next to it
  const rowOf = (id) => plan.filter((q) => q.row.id === id), spanMin = (id, lo, hi) => { const r = rowOf(id); let a = 0, m = 1e9; for (const q of r) { const wlo = id === 'N' ? x1 - (a + q.w) : x0 + a, whi = wlo + q.w; if (whi > lo && wlo < hi) m = Math.min(m, q.top); a += q.w; } return m; };
  for (const row of rows) {
    const ps = rowOf(row.id); ps.forEach((p, i) => {
      p.leftTop = i > 0 ? ps[i - 1].top : undefined; p.rightTop = i < ps.length - 1 ? ps[i + 1].top : undefined;
      if (row.id === 'W') { if (i === 0) p.leftTop = spanMin('N', x0, x0 + SD); if (i === ps.length - 1) p.rightTop = spanMin('S', x0, x0 + SD); }
      if (row.id === 'E') { if (i === 0) p.leftTop = spanMin('S', x1 - SD, x1); if (i === ps.length - 1) p.rightTop = spanMin('N', x1 - SD, x1); }
    });
  }

  // ---- build ----
  const info = { houses: 0, corners: [], height: 0, pieces: [] };
  for (const p of plan) {
    const [px, pz] = p.row.origin(p.a), side = p.row.id === 'W' || p.row.id === 'E';
    let res;
    if (p.corner) {
      const f = p.corner === 'bar' ? bar : shop;
      res = f(K, out, atlas, px, pz, p.row.ang, { seed: p.seed, width: p.w, depth: p.row.depth, corner: p.cs, floors: p.floors, left: p.n > 1, leftTop: p.cs < 0 ? p.rightTop : p.leftTop, climb: p.climb, stats: opts.stats });
      info.corners.push(p.corner);
    } else {
      res = house(K, out, atlas, px, pz, p.row.ang, Object.assign({ seed: p.seed, width: p.w, depth: p.row.depth, floors: p.floors, corniceColor: p.cornice, left: side ? true : p.i > 0, right: side ? true : p.i < p.n - 1, leftTop: p.leftTop, rightTop: p.rightTop, climb: p.climb, stats: opts.stats }, p.style));
      info.houses++;
    }
    info.height = Math.max(info.height, res.height); info.pieces.push({ row: p.row.id, w: +p.w.toFixed(2), corner: p.corner || null });
  }

  // ---- the yard strip: bins and crates, closed to the characters ----
  const yx0 = x0 + SD, yx1 = x1 - SD, yz0 = z0 + DR, yz1 = z1 - DR;
  const place = (g, gx, gy, gz) => K.place(g, gx, gy, gz, 0);
  const yr = bkRng(seed * 7 + 2), cxy = (yx0 + yx1) / 2;
  for (let i = 0; i < 3; i++) { const bz = yz0 + 1.2 + yr() * (yz1 - yz0 - 2.4), bx = cxy + (yr() - 0.5) * 1.2; out.solid(place(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 8), bx, CURB + 0.35, bz), i % 2 ? '#4f5a52' : '#5a5248'); out.solid(place(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), bx, CURB + 0.73, bz), '#2c322e', false); } // lid on its own bin (fix m2)
  out.solid(place(new THREE.BoxGeometry(0.9, 0.6, 0.7), cxy + 0.2, CURB + 0.3, (yz0 + yz1) / 2 + 1.2), '#9a6a44');
  out.coll({ x0: yx0, x1: yx1, z0: yz0, z1: yz1 });
  info.box = [x0, z0, x1, z1]; return info;
}

// ---- vendor/taskAB/props_tiles.js ----
// props_tiles.js — Task B: the ONE 1024² atlas for the street props and vehicles (K.makeAtlas(PROP_TILES)).
// Bench plates and ads, the crab-shack sign + chalkboard menu, the manhole cover ring, the recycling sticker, number plates and the
// vehicle liveries (harbour water-taxi lettering, a Utz-style snack truck, a MOVING & STORAGE truck, the arabber cart's painted side).
// Real Baltimore wording and colour schemes (Old Bay, Utz, water-taxi branding, arabber red / yellow / green) are RE-DRAWN here from
// text and flat shapes. No logo image, photo or traced artwork is used or embedded. No imports; no Math.random.
const META_PROPS_TILES = { id: 'props_tiles', kind: 'kit', atlas: 1024, note: 'PROP_TILES for K.makeAtlas()' };

const PROP_TILES = (() => { // helpers live inside this closure, so concatenated modules cannot collide
const INK = '#14101f', SANS = 'Impact, "Arial Black", sans-serif', SERIF = 'Georgia, serif';
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (h, f, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${cl(r * f)},${cl(g * f)},${cl(b * f)},${a})`; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const fit = (c, txt, x, y, maxW, px, font = SANS, weight = '') => { let s = px; c.font = `${weight} ${s}px ${font}`; while (c.measureText(txt).width > maxW && s > 6) { s -= 1; c.font = `${weight} ${s}px ${font}`; } c.fillText(txt, x, y); return s; };
const centre = (c) => { c.textAlign = 'center'; c.textBaseline = 'middle'; };

function busPlate(c, w, h) {
  c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); centre(c); c.fillStyle = '#eae6dc';
  fit(c, 'BUS STOP', w * 0.5, h * 0.4, w * 0.5, 30); fit(c, 'INNER HARBOR · ALL ROUTES', w * 0.5, h * 0.78, w * 0.7, 11, SERIF, 'bold');
  c.fillStyle = '#ffd23c'; rr(c, 14, 14, 44, 30, 6); c.fill(); c.fillStyle = INK; c.fillRect(20, 20, 32, 12); c.beginPath(); c.arc(26, 42, 4, 0, 7); c.arc(46, 42, 4, 0, 7); c.fill();
  c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(w - 56, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 16); c.lineTo(w - 14, h * 0.4); c.lineTo(w - 30, h * 0.4 + 16); c.lineTo(w - 30, h * 0.4 + 8); c.lineTo(w - 56, h * 0.4 + 8); c.fill();
}
function adOldBay(c, w, h) {
  c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h * 0.62, w, h * 0.38); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); centre(c);
  c.fillStyle = '#c8302a'; fit(c, 'OLD BAY', w * 0.5, h * 0.32, w - 30, 34); c.fillStyle = '#eae6dc'; fit(c, 'SEAFOOD SEASONING', w * 0.5, h * 0.8, w - 24, 15, SERIF, 'bold');
}
function crabSign(c, w, h) {
  c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.strokeRect(5, 5, w - 10, h - 10); centre(c);
  c.fillStyle = '#f08a50'; fit(c, 'STEAMED', w * 0.5, h * 0.3, w - 60, 40); fit(c, 'CRABS', w * 0.5, h * 0.64, w - 90, 44);
  c.fillStyle = '#eae6dc'; fit(c, 'BY THE DOZEN · OLD BAY', w * 0.5, h * 0.88, w - 50, 12, SERIF, 'bold');
  c.fillStyle = '#c8302a'; for (const sx of [22, w - 22]) { c.beginPath(); c.ellipse(sx, h * 0.5, 10, 7, 0, 0, 7); c.fill(); c.fillRect(sx - 12, h * 0.5 - 12, 4, 6); c.fillRect(sx + 8, h * 0.5 - 12, 4, 6); }
}
function crabMenu(c, w, h) {
  c.fillStyle = '#22302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a6a44'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) c.fillRect(10 + i * 18, 12, 8, h - 24);
  centre(c); c.fillStyle = '#f2e6c8'; fit(c, 'CRAB MENU', w / 2, 24, w - 28, 22, SANS);
  c.strokeStyle = '#f2e6c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 40); c.lineTo(w - 14, 40); c.stroke();
  const rows = [['MEDIUM DOZEN', 'MKT'], ['LARGE DOZEN', 'MKT'], ['CRAB CAKE', '$14'], ['CORN ON COB', '$3'], ['COLD BEER', '$5']];
  rows.forEach(([a, b], i) => { c.textAlign = 'left'; c.fillStyle = '#f2e6c8'; fit(c, a, 14, 56 + i * 17, 70, 12, SERIF, 'bold'); c.textAlign = 'right'; c.fillStyle = '#ffd23c'; c.fillText(b, w - 14, 56 + i * 17); });
  centre(c); c.fillStyle = '#f08a50'; fit(c, 'ASK FOR OLD BAY!', w / 2, h - 12, w - 20, 11, SERIF, 'bold');
}
function manhole(c, w, h) {
  c.clearRect(0, 0, w, h); c.fillStyle = '#4a4a50'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill(); c.strokeStyle = '#2c322e'; c.lineWidth = 5; c.stroke();
  c.strokeStyle = '#2c322e'; c.lineWidth = 2.5; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, 7); c.stroke(); c.save(); c.beginPath(); c.arc(w / 2, h / 2, w * 0.34, 0, 7); c.clip();
  c.strokeStyle = '#6f6a62'; c.lineWidth = 3; for (let i = -w; i < w * 2; i += 14) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } c.restore();
  c.fillStyle = '#4a4a50'; c.fillRect(w * 0.18, h * 0.43, w * 0.64, h * 0.14); c.fillStyle = '#c9b48a'; centre(c); fit(c, 'BALTIMORE CITY', w / 2, h / 2 + 1, w * 0.58, 11, SANS);
}
function recycle(c, w, h) {
  c.fillStyle = '#2f5bd3'; rr(c, 2, 2, w - 4, h - 4, 8); c.fill(); c.strokeStyle = '#eae6dc'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57, b = a + 1.6; c.beginPath(); c.arc(w / 2, h * 0.42, 15, a, b); c.stroke(); const ex = w / 2 + Math.cos(b) * 15, ey = h * 0.42 + Math.sin(b) * 15; c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(ex + Math.cos(b + 1.57) * 7, ey + Math.sin(b + 1.57) * 7); c.lineTo(ex - Math.cos(b + 1.57) * 7, ey - Math.sin(b + 1.57) * 7); c.lineTo(ex + Math.cos(b) * 9, ey + Math.sin(b) * 9); c.fill(); }
  c.fillStyle = '#eae6dc'; centre(c); fit(c, 'RECYCLE', w / 2, h * 0.85, w - 12, 11, SANS);
}
function platePlate(c, w, h) { c.fillStyle = '#eae6dc'; rr(c, 1, 1, w - 2, h - 2, 4); c.fill(); c.strokeStyle = '#2f5bd3'; c.lineWidth = 2; c.stroke(); centre(c); c.fillStyle = '#2f5bd3'; fit(c, 'MARYLAND', w / 2, h * 0.24, w - 12, 8, SERIF, 'bold'); c.fillStyle = INK; fit(c, '5CX 4821', w / 2, h * 0.64, w - 8, 15, SANS); }
function taxiSide(c, w, h) { // harbour water-taxi lettering: white hull panel, navy stripe, blue block letters, a yellow band and a little crab
  c.fillStyle = '#eae6dc'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 10); c.fillStyle = '#2a3f6a'; c.fillRect(0, h - 18, w, 18); centre(c);
  c.fillStyle = '#2a3f6a'; fit(c, 'BALTIMORE WATER TAXI', w * 0.54, h * 0.46, w * 0.78, 36); c.fillStyle = '#c8302a'; c.beginPath(); c.ellipse(32, h * 0.46, 18, 12, 0, 0, 7); c.fill();
  c.fillRect(14, h * 0.46 - 18, 5, 9); c.fillRect(45, h * 0.46 - 18, 5, 9); c.fillStyle = '#eae6dc'; c.fillRect(24, h * 0.46 - 6, 4, 4); c.fillRect(36, h * 0.46 - 6, 4, 4);
  c.fillStyle = '#eae6dc'; fit(c, 'INNER HARBOR · FELLS POINT · CANTON', w * 0.5, h - 9, w * 0.7, 11, SERIF, 'bold');
}
function taxiBow(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); centre(c); c.fillStyle = '#e8b830'; fit(c, 'WATER', w / 2, h * 0.32, w - 20, 22); c.fillStyle = '#eae6dc'; fit(c, 'TAXI', w / 2, h * 0.72, w - 40, 24); }
function truckUtz(c, w, h) { // Utz-style delivery truck livery drawn from text
  c.fillStyle = '#d8a828'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#c8302a'; c.fillRect(0, h - 28, w, 6); centre(c);
  c.lineWidth = 8; c.strokeStyle = '#eae6dc'; c.lineJoin = 'round'; c.font = `italic bold 70px ${SERIF}`; c.strokeText('Utz', w * 0.3, h * 0.42); c.fillStyle = '#c8302a'; c.fillText('Utz', w * 0.3, h * 0.42);
  c.fillStyle = '#2f5bd3'; fit(c, 'POTATO CHIPS', w * 0.72, h * 0.3, w * 0.4, 20); c.fillStyle = INK; fit(c, 'PRETZELS · POPCORN · CHEESE CURLS', w * 0.72, h * 0.55, w * 0.46, 11, SERIF, 'bold');
  c.fillStyle = '#eae6dc'; fit(c, 'HANOVER, PA · FRESH SINCE 1921', w / 2, h - 11, w - 20, 11, SERIF, 'bold');
}
function truckMove(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23c'; c.fillRect(0, h * 0.76, w, 6); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'MOVING & STORAGE', w / 2, h * 0.38, w - 30, 38); c.fillStyle = '#eae6dc'; fit(c, 'CHARM CITY MOVERS · BALTIMORE · SINCE 1952', w / 2, h * 0.64, w - 30, 13, SERIF, 'bold'); c.fillStyle = '#eae6dc'; fit(c, 'LOCAL · LONG DISTANCE · PIANOS', w / 2, h * 0.9, w - 40, 11, SERIF); }
function arabberSide(c, w, h) { // painted wooden cart side: red field, yellow scrollwork, green border, a lettered banner
  c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f5a3a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.strokeStyle = '#e8b830'; c.lineWidth = 3; c.strokeRect(12, 12, w - 24, h - 24);
  c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = 30 + i * 62; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, h / 2); c.bezierCurveTo(x + 14, h / 2 + s * 30, x + 40, h / 2 + s * 8, x + 28, h / 2 + s * 20); c.stroke(); c.beginPath(); c.arc(x + 28, h / 2 + s * 20, 4, 0, 7); c.stroke(); } }
  c.fillStyle = '#2f5a3a'; rr(c, 34, h * 0.36, w - 68, h * 0.28, 8); c.fill(); c.strokeStyle = '#e8b830'; c.lineWidth = 2.5; c.stroke(); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'FRESH FRUIT & VEGGIES', w / 2, h * 0.5, w - 90, 20, SANS);
}
function dragonScales(c, w, h) { c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h + 8; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < w + 8; x += 16) { c.fillStyle = '#d84a30'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI); c.fill(); c.strokeStyle = '#7a1f1a'; c.lineWidth = 1.5; c.stroke(); } c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 6); }

const T = (w, h, draw) => ({ w, h, draw });
const PT = {
  taxi_side: T(384, 96, taxiSide), truck_utz: T(320, 112, truckUtz), truck_move: T(320, 112, truckMove), arabber_side: T(256, 112, arabberSide), crab_sign: T(256, 96, crabSign),
  crab_menu: T(128, 160, crabMenu), bus_plate: T(256, 64, busPlate), ad_oldbay: T(192, 64, adOldBay), taxi_bow: T(128, 64, taxiBow), dragon_scales: T(128, 64, dragonScales),
  manhole: T(128, 128, manhole), recycle: T(64, 64, recycle), plate: T(64, 32, platePlate),
};
return PT;
})();

// The prop atlas belongs to the game, not to a cache keyed on the kit object K (Grok QA: five WeakMaps keyed on K made a new atlas for every
// K a caller built). Order: opts.atlas, then the game's own packed atlas K.propAtlas, then K.makeAtlas(PROP_TILES), which the game caches
// on the tile set itself (02c AB_ATLASES). soft = return null instead of throwing (cars just skip their liveries).
function tbPropAtlas(K, opts, who, soft = false) {
  if (opts && opts.atlas) return opts.atlas;
  if (K.propAtlas) return K.propAtlas;
  if (typeof PROP_TILES === 'object' && K.makeAtlas) return K.makeAtlas(PROP_TILES);
  if (soft) return null;
  throw new Error(who + ': pass opts.atlas or K.propAtlas (= K.makeAtlas(PROP_TILES))');
}

// ---- vendor/taskAB/props_street.js ----
// props_street.js — Task B: merged static street props (everything writes through `out`, so props add NO draw calls).
//   lamp_acorn · lamp_cobra · bench_park · bench_bus · trash_can (+ recycling variant) · manhole · ladder_wall · ladder_drop
// Signature of every piece: buildXxx(K, out, x, z, ang = 0, opts = {}) -> its entry of META_PROPS_STREET.pieces. The base sits on the pavement top
// (K.CURB) except the manhole, which is flush with the road (y 0.005). Facing is +Z rotated by ang. opts.atlas = the shared
// K.makeAtlas(PROP_TILES) (if omitted, the PROP_TILES global of the concatenated game build is used).
// Ink hulls only on major masses (<~4 cm parts have outline:false). Triangles below count the ink hulls too.
// No imports; no Math.random; materials only through out / K.
const META_PROPS_STREET = {
  id: 'props_street', kind: 'prop',
  pieces: {
    lamp_acorn: { id: 'lamp_acorn', kind: 'prop', footprint: [0.5, 0.5], height: 4.9 }, lamp_cobra: { id: 'lamp_cobra', kind: 'prop', footprint: [0.4, 0.4], height: 7.4 },
    bench_park: { id: 'bench_park', kind: 'prop', footprint: [1.8, 0.6], height: 0.9 }, bench_bus: { id: 'bench_bus', kind: 'prop', footprint: [1.9, 0.6], height: 2.2 },
    trash_can: { id: 'trash_can', kind: 'prop', footprint: [0.7, 0.7], height: 0.95 }, manhole: { id: 'manhole', kind: 'prop', footprint: [0.9, 0.9], height: 0.01 },
    ladder_wall: { id: 'ladder_wall', kind: 'prop', footprint: [0.6, 0.3], height: 6 }, ladder_drop: { id: 'ladder_drop', kind: 'prop', footprint: [0.6, 0.3], height: 3.9 },
  },
};

// ---- local helpers (one namespace object so concatenated modules cannot collide) ----
// the prop atlas comes from tbPropAtlas (props_tiles.js): opts.atlas, then the game-owned K.propAtlas; no cache keyed on K (Grok QA), PROP_TILES guarded (fix m5)
const PS = {
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  CURB: 0.16, GREEN: '#2f4a3a', IRON: '#2c322e', WOOD: '#9a6a44',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'props_street'); },
  box(THREE, w, h, d, skip = '') { // BoxGeometry minus hidden faces (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  },
  kit(K, out, x, z, ang, y0) {
    const THREE = K.THREE, fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, y0, z, ang); };
    const S = {
      THREE, fin,
      box: (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(PS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol),
      cyl: (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz, o.rot), col, !!o.ol),
      sph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz, o.rot), col, !!o.ol),
      glowSph: (r, ws, hs, sx, sy, sz, lx, ly, lz, col) => out.glow(fin(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz), lx, ly, lz), col),
      glowQuad: (w, h, lx, ly, lz, col, rot) => out.glow(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), col),
      decal: (atlas, tile, w, h, lx, ly, lz, rot) => out.decal(fin(new THREE.PlaneGeometry(w, h), lx, ly, lz, rot), atlas, tile),
      world(lx, lz) { return [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)]; },
      aabb(lx0, lx1, lz0, lz1) { const p = [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]].map(([a, b]) => S.world(a, b)); return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    };
    return S;
  },
};

// ---------------------------------------------------------------- historic acorn street lamp
function buildLampAcorn(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || PS.GREEN, GL = '#e8e0c8';
  S.box(0.46, 0.22, 0.46, 0, 0.11, 0, G, { skip: 'ny', ol: true });                          // plinth
  S.cyl(0.1, 0.2, 0.6, 8, 0, 0.52, 0, G, { open: true, ol: true });                         // fluted flare
  S.cyl(0.15, 0.15, 0.07, 8, 0, 0.86, 0, PS.tone(G, 1.3), { open: true });                      // collar
  S.cyl(0.07, 0.095, 3.1, 8, 0, 2.45, 0, G, { open: true, ol: true });                       // shaft
  S.cyl(0.13, 0.13, 0.08, 8, 0, 4.0, 0, PS.tone(G, 1.3), { open: true });                       // upper collar
  S.cyl(0.2, 0.09, 0.14, 8, 0, 4.11, 0, G);                                                  // lantern cup
  S.sph(0.25, 7, 5, 1, 1.15, 1, 0, 4.5, 0, GL);                                              // acorn globe, milky by day...
  S.glowSph(0.255, 7, 5, 1, 1.15, 1, 0, 4.5, 0, '#ffa050');                                   // ...warm lamp-light at night
  S.cyl(0.04, 0.27, 0.22, 8, 0, 4.9, 0, G);                                                  // acorn cap
  S.cyl(0, 0.045, 0.14, 6, 0, 5.07, 0, PS.tone(G, 1.3));                                        // finial
  const [wx, wz] = S.world(0, 0); out.lamp(wx, C + 4.5, wz); out.coll({ x: wx, z: wz, r: 0.25 });
  return META_PROPS_STREET.pieces.lamp_acorn;
}

// ---------------------------------------------------------------- modern cobra-head avenue lamp (the arm reaches toward +Z)
function buildLampCobra(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), G = opts.paint || '#5a5f62', THREE = K.THREE;
  S.cyl(0.2, 0.24, 0.5, 8, 0, 0.25, 0, '#6f6a62', { ol: true });                            // base cover
  S.cyl(0.08, 0.13, 6.3, 8, 0, 3.65, 0, G, { open: true, ol: true });                        // tapered pole
  S.box(0.09, 0.09, 1.0, 0, 7.0, 0.36, G, { rot: [-0.28, 0, 0] });                            // arm rising out of the pole...
  S.box(0.09, 0.09, 0.7, 0, 7.18, 1.1, G, { rot: [0.0, 0, 0] });                              // ...and levelling off
  S.sph(0.5, 8, 5, 1, 0.3, 0.55, 0, 7.14, 1.55, '#8a9094');                                   // the cobra head (oversized for a phone screen)
  const lens = new THREE.CircleGeometry(0.3, 8).rotateX(Math.PI / 2).scale(1, 1, 1.4); lens.translate(0, 7.04, 1.55); K.place(lens, x, C, z, ang);
  const lens2 = lens.clone(); out.solid(lens, '#d8d0b0', false); out.glow(lens2.translate(0, -0.012, 0), '#ffa050');
  const [wx, wz] = S.world(0, 1.55); const [px, pz] = S.world(0, 0); out.lamp(wx, C + 7.0, wz); out.coll({ x: px, z: pz, r: 0.28 });
  return META_PROPS_STREET.pieces.lamp_cobra;
}

// ---------------------------------------------------------------- park bench: wood slats on cast-iron ends
function buildBenchPark(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), wood = opts.wood || PS.WOOD, iron = opts.iron || PS.IRON;
  for (const lz of [0.14, 0, -0.14]) S.box(1.8, 0.05, 0.11, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const ly of [0.62, 0.8]) S.box(1.8, 0.11, 0.05, 0, ly, -0.22, wood, { skip: 'ny', rot: [-0.14, 0, 0] });
  for (const s of [-1, 1]) {
    S.box(0.06, 0.42, 0.06, s * 0.82, 0.21, 0.17, iron, { skip: 'ny', ol: true });                              // front leg
    S.box(0.06, 0.9, 0.06, s * 0.82, 0.45, -0.22, iron, { skip: 'ny', ol: true, rot: [-0.14, 0, 0] });         // raked back leg
    S.box(0.05, 0.05, 0.5, s * 0.82, 0.68, -0.02, iron, { skip: 'ny' });                                      // armrest
  }
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.45, z: wz, ang }); out.coll(S.aabb(-0.9, 0.9, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_park;
}

// ---------------------------------------------------------------- bus-stop bench with an Old Bay ad back and a bus-stop sign
function buildBenchBus(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = PS.atlas(K, opts), wood = opts.wood || PS.WOOD, conc = '#8a8478';
  for (const lz of [0.1, -0.1]) S.box(1.7, 0.07, 0.19, 0, 0.45, lz, wood, { skip: 'ny' });
  for (const s of [-1, 1]) S.box(0.12, 0.43, 0.5, s * 0.8, 0.215, 0, conc, { skip: 'ny', ol: true });
  S.box(1.7, 0.46, 0.05, 0, 0.9, -0.22, '#2a3f6a', { skip: 'ny nz', ol: true });                               // ad board
  S.decal(A, 'ad_oldbay', 1.54, 0.37, 0, 0.9, -0.19);                                                          // the Old Bay-style ad, drawn on canvas
  S.cyl(0.035, 0.035, 2.2, 6, 1.05, 1.1, -0.1, PS.IRON, { open: true, ol: true });                              // pole
  S.box(0.62, 0.22, 0.03, 1.05, 2.0, -0.1, '#2a3f6a', { skip: 'ny', ol: true });
  S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.082); S.decal(A, 'bus_plate', 0.58, 0.145, 1.05, 2.0, -0.118, [0, Math.PI, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('seat', { x: wx, y: C + 0.46, z: wz, ang }); out.coll(S.aabb(-0.95, 1.2, -0.3, 0.3));
  return META_PROPS_STREET.pieces.bench_bus;
}

// ---------------------------------------------------------------- public trash can; opts.recycling attaches a blue recycling bin
function buildTrashCan(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), A = opts.recycling ? PS.atlas(K, opts) : null;
  const can = (lx, col, rec) => {
    S.cyl(0.3, 0.25, 0.85, 8, lx, 0.425, 0, col, { open: true, ol: true });
    S.cyl(0.325, 0.325, 0.08, 8, lx, 0.89, 0, PS.tone(col, 1.25));
    S.cyl(0.305, 0.275, 0.05, 8, lx, 0.5, 0, PS.tone(col, 0.7), { open: true });
    out.solid(S.fin(new S.THREE.CircleGeometry(0.19, 8).rotateX(-Math.PI / 2), lx, 0.933, 0), PS.IRON, false);                                   // the dark opening
    if (rec) S.decal(A, 'recycle', 0.3, 0.3, lx, 0.5, 0.272);
  };
  can(0, opts.paint || '#2f4a3a', false);
  if (opts.recycling) { can(0.68, '#2f5bd3', true); S.box(0.5, 0.06, 0.1, 0.34, 0.62, 0, PS.IRON, { skip: 'ny' }); }
  const [wx, wz] = S.world(opts.recycling ? 0.34 : 0, 0); out.coll({ x: wx, z: wz, r: opts.recycling ? 0.6 : 0.34 });
  return META_PROPS_STREET.pieces.trash_can;
}

// ---------------------------------------------------------------- manhole cover, flush with the road (top at y = 0.005, nit fixed: it was 0.017)
function buildManhole(K, out, x, z, ang = 0, opts = {}) {
  const S = PS.kit(K, out, x, z, ang, 0), A = PS.atlas(K, opts);
  S.cyl(0.46, 0.46, 0.005, 12, 0, 0.0025, 0, '#4a4a50');
  S.decal(A, 'manhole', 0.92, 0.92, 0, 0.009, 0, [-Math.PI / 2, 0, 0]);
  const [wx, wz] = S.world(0, 0); out.hook('manhole', { x: wx, z: wz });
  return META_PROPS_STREET.pieces.manhole;
}

// ---------------------------------------------------------------- fixed steel wall ladder up to a roof (opts.top = roof height in m)
function ladderRungs(S, from, to, iron) {
  for (let y = from + 0.12; y < to - 0.1; y += 0.32) S.box(0.44, 0.035, 0.04, 0, y, 0.15, iron, { skip: 'nx px nz' });
  for (const s of [-1, 1]) { S.box(0.05, to - from, 0.05, s * 0.23, (from + to) / 2, 0.15, iron, { skip: 'ny nz', ol: true }); }
}
function buildLadderWall(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), top = opts.top ?? 6.0, iron = opts.iron || '#4f5a52';
  ladderRungs(S, 0, top, iron);
  for (const y of [0.4, top / 2, top - 0.3]) for (const s of [-1, 1]) S.box(0.04, 0.04, 0.13, s * 0.23, y, 0.075, iron, { skip: 'ny' });
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_wall;
}

// ---------------------------------------------------------------- fire-escape drop ladder: only the bottom section, hanging at 1.6 m
function buildLadderDrop(K, out, x, z, ang = 0, opts = {}) {
  const C = K.CURB ?? PS.CURB, S = PS.kit(K, out, x, z, ang, C), iron = opts.iron || PS.IRON, top = opts.top ?? 4.4;
  ladderRungs(S, 1.6, 3.8, iron);
  S.box(0.62, 0.05, 0.5, 0, 3.86, 0.1, iron, { skip: 'ny', ol: true });                         // the fire-escape landing the ladder hangs from
  for (const s of [-1, 1]) { S.box(0.04, 0.4, 0.04, s * 0.3, 3.62, 0.34, iron, { skip: 'ny' }); }
  S.box(0.07, 0.07, 0.3, 0, 1.52, 0.15, '#6f6a62', { skip: 'ny' });                             // counterweight bar
  const [wx, wz] = S.world(0, 0.15); out.hook('climb', { x: wx, z: wz, ang, top: C + top });
  return META_PROPS_STREET.pieces.ladder_drop;
}

// ---- vendor/taskAB/props_crab_shack.js ----
// props_crab_shack.js — Task B: the harbour crab shack / steamed-crab stand (merged static prop, ~4 x 3 m, front faces +Z).
// Weathered wood stand with a counter, chalkboard menu on an easel, a tin roof, a painted STEAMED CRABS board (canvas decal) and a neon CRABS
// sign built from stroke geometry that glows at night (dull tube colour by day), crab pots, barrels, buoys, harbour bunting and string
// lights. Real Baltimore flavour: steamed blue crabs, Old Bay, cold beer. Lettering is drawn from text on canvas or built from geometry.
// All geometry goes through `out` (no draw calls of its own); one lamp point is registered for the sign light. No imports; no Math.random.
const META_CRAB_SHACK = { id: 'crab_shack', kind: 'prop', footprint: [4, 3], height: 4.1 };

const CS = {
  CURB: 0.16, WOOD: '#9a6a44', GREY: '#6f6a62', IRON: '#2c322e', CREAM: '#eae6dc',
  atlas(K, opts) { return tbPropAtlas(K, opts, 'crab_shack'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  FONT: {
    A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
    C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
    S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]],
  },
};

function buildCrabShack(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, C = K.CURB ?? CS.CURB, A = CS.atlas(K, opts), wood = opts.wood || CS.WOOD, teal = opts.paint || '#4f7a6a';
  const fin = (g, lx, ly, lz, rot) => { if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); } g.translate(lx, ly, lz); return K.place(g, x, C, z, ang); };
  const box = (w, h, d, lx, ly, lz, col, o = {}) => out.solid(fin(CS.box(THREE, w, h, d, o.skip), lx, ly, lz, o.rot), col, !!o.ol);
  const cyl = (rt, rb, h, seg, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), lx, ly, lz), col, !!o.ol);
  const sph = (r, ws, hs, lx, ly, lz, col, o = {}) => out.solid(fin(new THREE.SphereGeometry(r, ws, hs), lx, ly, lz), col, !!o.ol);
  const toWorld = (lx, lz) => [x + lx * Math.cos(ang) + lz * Math.sin(ang), z - lx * Math.sin(ang) + lz * Math.cos(ang)];

  // deck, posts, walls
  box(4.0, 0.12, 3.0, 0, 0.06, 0, '#7a5a3a', { skip: 'ny', ol: true });
  // the tin roof is a 3.8 m slab tilted 0.1 rad down to the front; roofUnder(z) = its underside, so posts and the back wall meet it (fix m3)
  const roofUnder = (lz) => 2.82 - (lz - 0.2) * Math.tan(0.1) - 0.035 / Math.cos(0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const top = roofUnder(sz * 1.4), hh = top - 0.12; box(0.14, hh, 0.14, sx * 1.9, 0.12 + hh / 2, sz * 1.4, wood, { skip: 'ny', ol: true }); }
  { const top = roofUnder(-1.42) + 0.02, hh = top - 0.12; box(3.8, hh, 0.08, 0, 0.12 + hh / 2, -1.42, teal, { skip: 'ny nz' }); }
  for (const y of [0.5, 1.2, 1.9, 2.5]) box(3.8, 0.07, 0.04, 0, y, -1.36, csTone(teal, 0.7), { skip: 'ny nz' });
  for (const sx of [-1, 1]) box(0.08, 1.1, 2.8, sx * 1.9, 0.67, 0, teal, { skip: 'ny' });
  // counter with painted front, top slab and a steamer pot on it
  box(3.6, 0.95, 0.6, 0, 0.6, 1.1, CS.CREAM, { skip: 'ny', ol: true }); box(3.6, 0.2, 0.01, 0, 0.35, 1.405, '#2a3f6a', { skip: 'ny nz' });
  box(3.9, 0.07, 0.95, 0, 1.12, 1.15, wood, { skip: 'ny', ol: true });
  cyl(0.3, 0.28, 0.42, 8, -1.1, 1.36, 1.15, '#8a9094', { ol: true }); cyl(0.32, 0.32, 0.05, 8, -1.1, 1.6, 1.15, '#6f6a62'); cyl(0.2, 0.2, 0.3, 8, -0.4, 1.31, 1.15, '#8a9094');
  box(0.6, 0.3, 0.4, 0.9, 1.31, 1.15, '#c8302a', { skip: 'ny' });                                        // a crate of Old Bay tins
  // roof (tin, sloping toward the front) with a red fascia and a vent
  box(4.7, 0.07, 3.8, 0, 2.82, 0.2, CS.GREY, { skip: 'ny', rot: [0.1, 0, 0], ol: true }); box(4.7, 0.14, 0.07, 0, 2.62, 2.1, '#b8302a', { skip: 'ny' });
  cyl(0.07, 0.07, 0.5, 6, 1.4, 3.1, -0.6, CS.IRON, { open: true });
  // painted board + neon CRABS above it
  box(2.9, 1.08, 0.08, 0, 3.55, 1.45, '#2f5a3a', { skip: 'ny nz', ol: true });
  out.decal(fin(new THREE.PlaneGeometry(2.7, 2.7 * 96 / 256), 0, 3.55, 1.5), A, 'crab_sign');
  box(0.06, 0.8, 0.06, -1.2, 3.1, 1.4, wood, { skip: 'ny' }); box(0.06, 0.8, 0.06, 1.2, 3.1, 1.4, wood, { skip: 'ny' });
  const sc = 0.6 / 4, adv = 2 * sc + 0.14, word = 'CRABS', total = word.length * adv - 0.14; let px = -total / 2;
  const seg = (u0, y0, u1, y1, th, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    out.solid(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.52), dim, false); out.glow(fin(new THREE.PlaneGeometry(len + th * 0.7, th).rotateZ(a), mx, my, 1.54), bright);
  };
  // the neon's raceway: a dark backing rail standing on the board's top edge, so the tubes no longer float (fix m3)
  box(total + 0.3, 0.64, 0.05, 0, 4.42, 1.47, '#1a1626', { ol: true });
  for (const ch of word) { for (const pl of CS.FONT[ch]) for (let i = 0; i + 1 < pl.length; i++) seg(px + pl[i][0] * sc, 4.35 + pl[i][1] * sc - 0.3 + 0.0, px + pl[i + 1][0] * sc, 4.35 + pl[i + 1][1] * sc - 0.3, 0.08, '#8a3a30', '#ff3a1c'); px += adv; }
  // easel + chalkboard menu
  box(0.9, 1.08, 0.05, 2.25, 0.7, 1.3, '#22302a', { skip: 'ny nz', ol: true, rot: [-0.12, 0, 0] }); out.decal(fin(new THREE.PlaneGeometry(0.8, 1.0), 2.25, 0.72, 1.335, [-0.12, 0, 0]), A, 'crab_menu');
  for (const s of [-1, 1]) box(0.05, 1.2, 0.05, 2.25 + s * 0.38, 0.62, 1.0, wood, { skip: 'ny', rot: [0.25, 0, 0] });
  // crab pots (wire cages), barrels, buoys
  for (let i = 0; i < 3; i++) { cyl(0.34, 0.34, 0.5, 8, -2.65 + (i % 2) * 0.2, 0.37 + (i === 2 ? 0.5 : 0), i === 2 ? 0.0 : 0.4 - i * 0.2, '#3a3a40', { ol: true, open: false }); }
  for (const [bx, bz, bc] of [[2.3, -0.7, '#2a3f6a'], [2.45, -0.15, '#8a4a3a']]) { cyl(0.28, 0.28, 0.7, 8, bx, 0.47, bz, bc, { ol: true }); cyl(0.29, 0.29, 0.05, 8, bx, 0.62, bz, csTone(bc, 0.6)); }
  sph(0.14, 6, 4, -2.2, 0.28, 1.2, '#b8302a'); sph(0.14, 6, 4, -2.05, 0.28, 1.35, '#ffd23c'); sph(0.14, 6, 4, 2.15, 1.25, -0.4, '#2f5bd3');
  // harbour bunting along the eave and string lights under the roof
  const flag = ['#b8302a', '#ffd23c', '#2f5bd3', '#eae6dc', '#2f5a3a'];
  for (let i = 0; i < 12; i++) { const fx = -2.1 + i * 0.382; out.solid(fin(new THREE.CircleGeometry(0.11, 3).rotateZ(-Math.PI / 2), fx, 2.46 - Math.abs(Math.sin(i * 0.52)) * 0.05, 2.08), flag[i % 5], false); }
  for (let i = 0; i < 8; i++) out.glow(fin(new THREE.OctahedronGeometry(0.06, 0), -1.75 + i * 0.5, 2.5, 0.6 + (i % 2) * 0.1), '#ffd890');
  const [lx, lz] = toWorld(0, 1.7); out.lamp(lx, C + 3.2, lz);
  out.coll(csAabb(toWorld, -3.05, 2.8, -1.6, 1.75)); out.bld(Object.assign(csAabb(toWorld, -2.1, 2.1, -1.6, 1.75), { h: C + 4.1 })); // collider now covers the pots, barrels and easel (fix m3)
  return META_CRAB_SHACK;
}
function csAabb(toWorld, lx0, lx1, lz0, lz1) { const p = [toWorld(lx0, lz0), toWorld(lx1, lz0), toWorld(lx1, lz1), toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; }
function csTone(h, f) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''); }

// ---- vendor/taskAB/veh_cars.js ----
// veh_cars.js — Task B (rebuilt 2026-10-11): street cars with real 3D volume, in the game's chunky cel-shaded style.
// Kinds (seeded silhouettes from 70s-2000s Baltimore streets): 'sedan' (boxy full-size), 'hatch' (compact hatchback), 'wagon' (estate with roof
// rails), 'minivan' (one-box people carrier), 'pickup' (cab + open bed), 'cab' (yellow city taxi with a roof sign and checker band), plus the box truck.
// Each car: a lofted, bevelled lower body (chamfered shoulders, a side crease, tapered nose and tail, a dark grimy rocker), a separate tapered greenhouse
// (raked windshield, tumblehome to a bevelled roof, pillars, black belt / drip trims), REAL transparent glass (out.glass, tinted, with a glossy
// highlight streak) over a visible interior (dash, steering wheel, seat backs, headrests), dark wheel wells with fender lips, tyres with hubcaps
// (white walls on the old sedans), bumpers, grille, head / tail lights with night glow (out.glow), mirrors, door seams + handles, rub strip and licence plates.
// out.glass(geom, rgba) is optional: a kit without it gets an opaque tinted pane through out.solid (the original starter kit still works).
// Vehicle contract: buildXxx(K, opts) -> { root, kind:'car', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
//   steer > 0 turns left (toward +X); speed in m/s. Seat anchors 'sit' = the rider's hips. The driver sits on +X (left, US).
//   Meshes: toon body + ink hull + glass + glow (+ livery decal on the box truck) + 3 wheel meshes (front left, front right, rear pair) <= 8.
// Static contract: buildParkedCarXxx(K, out, x, z, ang, opts) writes into `out` at y = 0 (on the road) and returns its META entry; opts.kind picks any kind.
// No imports; no Math.random (seeded LCG from opts.seed); no per-frame allocation in animate().
const META_VEH_CARS = {
  id: 'veh_cars', kind: 'vehicle',
  pieces: {
    car_sedan: { id: 'car_sedan', kind: 'car', length: 4.9, width: 1.84, height: 1.48 }, car_hatch: { id: 'car_hatch', kind: 'car', length: 3.96, width: 1.7, height: 1.47 },
    car_wagon: { id: 'car_wagon', kind: 'car', length: 4.8, width: 1.8, height: 1.56 }, car_minivan: { id: 'car_minivan', kind: 'car', length: 4.6, width: 1.86, height: 1.8 },
    car_pickup: { id: 'car_pickup', kind: 'car', length: 5.3, width: 1.94, height: 1.87 }, car_cab: { id: 'car_cab', kind: 'car', length: 4.9, width: 1.84, height: 1.7 },
    box_truck: { id: 'box_truck', kind: 'car', length: 6.6, width: 2.3, height: 3.25 },
    parked_car_sedan: { id: 'parked_car_sedan', kind: 'prop', footprint: [1.84, 4.9], height: 1.48 }, parked_car_hatchback: { id: 'parked_car_hatchback', kind: 'prop', footprint: [1.7, 3.96], height: 1.47 },
    parked_car_pickup: { id: 'parked_car_pickup', kind: 'prop', footprint: [1.94, 5.3], height: 1.87 }, parked_car_wagon: { id: 'parked_car_wagon', kind: 'prop', footprint: [1.8, 4.8], height: 1.56 },
    parked_car_minivan: { id: 'parked_car_minivan', kind: 'prop', footprint: [1.86, 4.6], height: 1.8 }, parked_car_cab: { id: 'parked_car_cab', kind: 'prop', footprint: [1.84, 4.9], height: 1.7 },
  },
};
const VC = {
  // period paints: maroon, navy, champagne, forest, gunmetal, white, black, red, powder blue, brown, gold, plum, teal, silver
  PAINT: ['#8a2a2e', '#2e4a72', '#cbbf9e', '#3d5c3a', '#62686e', '#e6e2d8', '#25252b', '#b0342a', '#6f8fb0', '#7a5434', '#b89a5e', '#56406a', '#2f6a6a', '#a9adb2'],
  TRIM: ['#b89a72', '#6a6a70', '#6a2a2a', '#3a4a6a', '#4a4038'], // interior: tan, grey, oxblood, blue, brown
  TYRE: '#1d1d22', CHROME: '#b9c0c7', BLACK: '#1e1c22', DARK: '#141218', UNDER: '#2a2826', CARPET: '#2c2826',
  rng(seed) { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; },
  hex: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  tone: (h, f) => '#' + VC.hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join(''),
  mix: (a, b, t) => { const A = VC.hex(a), B = VC.hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); },
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_cars', true); }, // null: liveries skipped
  // ---- the silhouettes. st = lower-body loft stations [z, half-width factor, top y]; g = greenhouse (A0 windshield foot, A1 windshield top,
  //      C1 rear-glass top, C0 rear-glass foot, yr roof, rw roof half-width, B pillar z list, we = z where the last side window ends (null: follows the rear line))
  SPEC: {
    sedan: { L: 4.9, hw: 0.92, r: 0.34, zf: 1.45, zr: -1.42, yb: 0.3, bump: 'chrome', lamps: 'quad', ww: true,
      st: [[-2.45, 0.9, 0.84], [-2.39, 0.98, 0.9], [-2.15, 1, 0.93], [-1.55, 1, 0.95], [1.05, 1, 0.94], [1.35, 1, 0.92], [2.25, 1, 0.86], [2.4, 0.98, 0.81], [2.45, 0.9, 0.74]],
      g: { A0: 1.05, A1: 0.25, C1: -1.0, C0: -1.55, yr: 1.43, rw: 0.74, B: [-0.36], we: -1.1 }, rows: [-0.12, -0.98] },
    wagon: { L: 4.8, hw: 0.9, r: 0.33, zf: 1.42, zr: -1.4, yb: 0.3, bump: 'chrome', lamps: 'wide', rails: true,
      st: [[-2.4, 0.92, 0.9], [-2.35, 0.99, 0.95], [-2.2, 1, 0.96], [1.0, 1, 0.94], [1.3, 1, 0.92], [2.2, 1, 0.86], [2.35, 0.98, 0.8], [2.4, 0.9, 0.74]],
      g: { A0: 1.0, A1: 0.22, C1: -2.16, C0: -2.3, yr: 1.47, rw: 0.75, B: [-0.42, -1.32], we: null }, rows: [-0.16, -1.0] },
    hatch: { L: 3.96, hw: 0.85, r: 0.31, zf: 1.22, zr: -1.2, yb: 0.28, bump: 'black', lamps: 'wide',
      st: [[-1.98, 0.92, 0.92], [-1.93, 0.99, 0.95], [-1.85, 1, 0.96], [0.9, 1, 0.93], [1.15, 1, 0.9], [1.85, 1, 0.83], [1.95, 0.97, 0.77], [1.98, 0.9, 0.7]],
      g: { A0: 0.9, A1: 0.1, C1: -1.5, C0: -1.86, yr: 1.42, rw: 0.7, B: [-0.48], we: -1.18 }, rows: [-0.22, -1.08] },
    minivan: { L: 4.6, hw: 0.93, r: 0.33, zf: 1.45, zr: -1.36, yb: 0.3, bump: 'body', lamps: 'aero',
      st: [[-2.3, 0.93, 0.98], [-2.25, 0.99, 1.0], [-2.2, 1, 1.0], [1.4, 1, 1.0], [1.7, 1, 0.92], [2.2, 1, 0.82], [2.28, 0.97, 0.76], [2.3, 0.9, 0.68]],
      g: { A0: 1.4, A1: 0.5, C1: -2.12, C0: -2.22, yr: 1.76, rw: 0.8, B: [-0.12, -1.26], we: null }, rows: [0.15, -0.75, -1.65] },
    pickup: { L: 5.3, hw: 0.97, r: 0.38, zf: 1.65, zr: -1.65, yb: 0.4, bump: 'chrome', lamps: 'quad', bed: [-0.56, -2.65],
      st: [[-0.5, 1, 1.05], [1.25, 1, 1.05], [1.45, 1, 1.02], [2.5, 1, 0.98], [2.62, 0.98, 0.92], [2.65, 0.9, 0.84]],
      g: { A0: 1.25, A1: 0.66, C1: -0.38, C0: -0.45, yr: 1.83, rw: 0.82, B: [], we: -0.12 }, rows: [-0.12] },
    truck: { L: 6.6, hw: 1.1, r: 0.46, zf: 2.25, zr: -2.2, yb: 0.52, bump: 'black', lamps: 'quad', box: [-3.3, 1.02],
      st: [[1.08, 1, 1.32], [2.3, 1, 1.32], [2.5, 1, 1.27], [3.15, 1, 1.18], [3.27, 0.97, 1.08], [3.3, 0.9, 0.98]],
      g: { A0: 2.3, A1: 1.82, C1: 1.2, C0: 1.14, yr: 2.58, rw: 0.98, B: [], we: 1.5 }, rows: [1.6] },
  },
};
VC.SPEC.cab = Object.assign({}, VC.SPEC.sedan, { taxi: true, ww: false, bump: 'body' });

// ---------------------------------------------------------------- the model builder: triangles sorted into layers, all in car-local space
class VCB {
  constructor(THREE) { this.T = THREE; this.S = new Map(); this.G = { P: [], N: [], C: [] }; this.L = new Map(); this.D = []; }
  // a triangle, wound so its face normal points along `hint` (flat shading: one normal per face)
  tri(B, a, b, c, hint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    B.P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) B.N.push(nx / l, ny / l, nz / l); return B;
  }
  bucket(col, ol) { const k = col + (ol ? '|1' : '|0'); let B = this.S.get(k); if (!B) this.S.set(k, (B = { P: [], N: [], col, ol: !!ol })); return B; }
  quad(col, a, b, c, d, hint, ol = false) { const B = this.bucket(col, ol); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  poly(col, pts, hint, ol = false) { const B = this.bucket(col, ol); for (let i = 1; i + 1 < pts.length; i++) this.tri(B, pts[0], pts[i], pts[i + 1], hint); }
  glow(col, a, b, c, d, hint) { let B = this.L.get(col); if (!B) this.L.set(col, (B = { P: [], N: [] })); this.tri(B, a, b, c, hint); this.tri(B, a, c, d, hint); }
  glass(rgba, a, b, c, d, hint) { const G = this.G, n0 = G.P.length; this.tri(G, a, b, c, hint); this.tri(G, a, c, d, hint); for (let i = n0 / 3; i < G.P.length / 3; i++) G.C.push(...rgba); }
  geo(g, col, ol = false) { // any THREE geometry already in car space
    if (g.index) g = g.toNonIndexed(); if (!g.attributes.normal) g.computeVertexNormals();
    const B = this.bucket(col, ol), p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { B.P.push(p[i]); B.N.push(n[i]); }
  }
  box(col, w, h, d, x, y, z, o = {}) { const g = new this.T.BoxGeometry(w, h, d); if (o.rx) g.rotateX(o.rx); if (o.ry) g.rotateY(o.ry); if (o.rz) g.rotateZ(o.rz); g.translate(x, y, z); this.geo(g, col, o.ol); }
  beam(col, p0, p1, t, ol = false, t2 = t) { // a box of section t x t2 from p0 to p1
    const T = this.T, d = new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), L = d.length(), g = new T.BoxGeometry(t, t2, L);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize())); g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); this.geo(g, col, ol);
  }
  disc(col, r, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) { // a disc in the side plane (normal +-X)
    const pts = []; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pts.push([x, y + Math.sin(a) * r, z + Math.cos(a) * r]); }
    const B = this.bucket(col, false), c = [x, y, z]; for (let i = 0; i < seg; i++) this.tri(B, c, pts[i], pts[i + 1], [sx, 0, 0]);
  }
  ring(col, r0, r1, seg, x, y, z, sx, a0 = 0, a1 = Math.PI * 2) {
    for (let i = 0; i < seg; i++) { const a = a0 + (a1 - a0) * i / seg, b = a0 + (a1 - a0) * (i + 1) / seg, P = (r, t) => [x, y + Math.sin(t) * r, z + Math.cos(t) * r]; this.quad(col, P(r0, a), P(r1, a), P(r1, b), P(r0, b), [sx, 0, 0]); }
  }
  geom(P, N, C) { const T = this.T, g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); if (C) g.setAttribute('color', new T.BufferAttribute(new Float32Array(C), 4)); return g; }
}

// lower body: loft through the stations; section = chamfered bottom, a side crease that bulges 1.5 cm, a chamfered shoulder, a flat top
function vcLoft(M, s, paint, R, cabin) {
  const prof = (hw, yb, yt) => { const ym = yb + (yt - yb) * 0.52; return [[-hw + 0.09, yb], [-hw, yb + 0.11], [-hw - 0.015, ym], [-hw + 0.004, yt - 0.12], [-hw + 0.07, yt], [hw - 0.07, yt], [hw - 0.004, yt - 0.12], [hw + 0.015, ym], [hw, yb + 0.11], [hw - 0.09, yb]]; };
  const st = s.st.map(([z, f, yt], i) => ({ z, hw: s.hw * f, yt, yb: s.yb + (i === 0 || i === s.st.length - 1 ? 0.06 : 0) }));
  const grime = VC.tone(paint, 0.62), shoulder = VC.tone(paint, 1.04);
  const colOf = (e, zc) => { // e = edge index around the section
    if (e === 9) return VC.UNDER; if (e === 0 || e === 8) return grime; if (e === 4) return zc > cabin[0] && zc < cabin[1] ? VC.CARPET : paint; if (e === 3 || e === 5) return shoulder; return paint;
  };
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1], pa = prof(a.hw, a.yb, a.yt), pb = prof(b.hw, b.yb, b.yt), zc = (a.z + b.z) / 2, cy = (a.yb + a.yt) / 2;
    for (let e = 0; e < pa.length; e++) {
      const f = (e + 1) % pa.length, A = [pa[e][0], pa[e][1], a.z], Bv = [pa[f][0], pa[f][1], a.z], C = [pb[f][0], pb[f][1], b.z], D = [pb[e][0], pb[e][1], b.z];
      const mx = (A[0] + Bv[0] + C[0] + D[0]) / 4, my = (A[1] + Bv[1] + C[1] + D[1]) / 4;
      M.quad(colOf(e, zc), A, Bv, C, D, [mx, my - cy, 0], e !== 9);
    }
  }
  for (const [k, dir] of [[0, -1], [st.length - 1, 1]]) { const q = st[k], p = prof(q.hw, q.yb, q.yt).map(([x, y]) => [x, y, q.z]); M.poly(paint, p, [0, 0, dir], true); }
  return { st, top: (z) => { for (let i = 0; i + 1 < st.length; i++) if (z >= st[i].z && z <= st[i + 1].z) { const t = (z - st[i].z) / (st[i + 1].z - st[i].z); return st[i].yt + (st[i + 1].yt - st[i].yt) * t; } return st[z < 0 ? 0 : st.length - 1].yt; } };
}

// greenhouse: windshield, roof (bevelled), rear glass, side windows between pillars, C-pillar panels, belt + drip trims, highlight streaks
function vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC) {
  const g = s.g, hb = s.hw - 0.07, hr = g.rw, yA = body.top(g.A0), yC = body.top(g.C0), yr = g.yr;
  const belt = (z) => yA + (yC - yA) * (z - g.A0) / (g.C0 - g.A0);
  const zF = (t) => g.A0 + (g.A1 - g.A0) * t, zR = (t) => g.C0 + (g.C1 - g.C0) * t;
  const P = (sx, z, t) => [sx * (hb + (hr - hb) * t), belt(z) + (yr - belt(z)) * t, z]; // a point on a side plane, t = 0 belt .. 1 roof line
  const W = (sx) => [sx * (yr - (yA + yC) / 2), hb - hr, 0]; // outward normal hint of a side plane
  const pc = VC.tone(paint, 0.96);
  // windshield + rear glass
  M.glass(glassC, [-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.6, 1]);
  M.glass(glassC, [-hb, yC, g.C0], [hb, yC, g.C0], [hr, yr, g.C1], [-hr, yr, g.C1], [0, 0.6, -1]);
  // glossy streaks: one diagonal band on the windshield, one on each side window (glass layer, nearly opaque)
  const streak = (p0, p1, p2, p3, n, k0, k1) => { const L = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), o = (p) => p.map((v, i) => v + n[i] * 0.006);
    M.glass(hiC, o(L(p0, p1, k0)), o(L(p0, p1, k1)), o(L(p3, p2, k1 - 0.18)), o(L(p3, p2, k0 - 0.18)), n); };
  streak([-hb, yA, g.A0], [hb, yA, g.A0], [hr, yr, g.A1], [-hr, yr, g.A1], [0, 0.7, 0.7], 0.42, 0.56);
  // bevelled roof: edge ring at yr, top inset 7 cm and raised 4.5 cm
  const e = [[-hr, yr, g.A1], [hr, yr, g.A1], [hr, yr, g.C1], [-hr, yr, g.C1]], t = [[-hr + 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.A1 - 0.06], [hr - 0.07, yr + 0.045, g.C1 + 0.06], [-hr + 0.07, yr + 0.045, g.C1 + 0.06]];
  M.quad(roofCol, t[0], t[1], t[2], t[3], [0, 1, 0], true);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, m = [(e[i][0] + e[j][0]) / 2, 0.5, (e[i][2] + e[j][2]) / 2 - (g.A1 + g.C1) / 2]; M.quad(roofCol, e[i], e[j], t[j], t[i], m, true); }
  // side windows between the pillars (+ the C-pillar panel when the last window ends early)
  const cuts = [g.A0 - 1].concat(g.B).concat([g.we === null ? g.C0 + 1 : g.we]);
  for (const sx of [-1, 1]) {
    const n = W(sx), nl = Math.hypot(n[0], n[1]); const nn = [n[0] / nl, n[1] / nl, 0];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const za = cuts[k] + (k ? 0.045 : 0), zb = cuts[k + 1] - (k + 1 < cuts.length - 1 ? 0.045 : 0), t0 = 0.03, t1 = 0.95;
      const q = [P(sx, Math.max(za, zF(t0)), t0), P(sx, Math.min(zb, zR(t0)), t0), P(sx, Math.min(zb, zR(t1)), t1), P(sx, Math.max(za, zF(t1)), t1)];
      M.glass(glassC, q[0], q[1], q[2], q[3], nn);
      if (k === 0) streak(q[0], q[1], q[2], q[3], nn, 0.3, 0.5);
    }
    if (g.we !== null) M.quad(pc, P(sx, zR(0), 0), P(sx, g.we, 0), P(sx, g.we, 1), P(sx, zR(1), 1), nn, true);
    // pillars: A along the windshield edge, B uprights, the rear (C / D) along the rear-glass edge; black belt + drip trims
    M.beam(pc, P(sx, g.A0, 0), P(sx, g.A1, 1), 0.075, true);
    M.beam(pc, P(sx, g.C0, 0), P(sx, g.C1, 1), 0.075, true);
    for (const zb of g.B) M.beam(VC.BLACK, P(sx, zb, 0), P(sx, zb, 1), 0.085, false, 0.05);
    M.beam(VC.BLACK, P(sx, g.A0, 0.01), P(sx, g.C0, 0.01), 0.035);
    M.beam(VC.BLACK, P(sx, g.A1, 0.99), P(sx, g.C1, 0.99), 0.035);
  }
  return { hb, hr, yA, yC, belt };
}

// one wheel's geometry list, centred on its axle; sx = which side faces out. Only what can be seen: an open tread band, the outer sidewall ring,
// a white-wall ring (old sedans), a dished hubcap + centre cap; drivable wheels add five dimples so the spin reads. Cheap (parked) wheels use fewer segments.
function vcWheelParts(THREE, s, sx, cheap) {
  const r = s.r, w = s.kind === 'truck' ? 0.3 : 0.23, L = [], seg = cheap ? 10 : 14, ox = sx * w / 2;
  const side = (g) => g.rotateY(sx * Math.PI / 2); // a flat XY shape turned to face +-X
  L.push([new THREE.CylinderGeometry(r, r, w, seg, 1, true).rotateZ(Math.PI / 2), VC.TYRE]);
  L.push([side(new THREE.RingGeometry(r * 0.6, r, seg)).translate(ox, 0, 0), VC.tone(VC.TYRE, 1.3)]);
  if (s.ww) L.push([side(new THREE.RingGeometry(r * 0.6, r * 0.76, seg)).translate(ox + sx * 0.004, 0, 0), '#e8e6de']);
  L.push([new THREE.CylinderGeometry(r * (s.ww ? 0.5 : 0.58), r * (s.ww ? 0.56 : 0.62), 0.03, cheap ? 8 : 10, 1, true).rotateZ(Math.PI / 2).translate(ox + sx * 0.015, 0, 0), VC.tone(s.hub, 0.8)]);
  L.push([side(new THREE.CircleGeometry(r * (s.ww ? 0.5 : 0.58), cheap ? 8 : 10)).translate(ox + sx * 0.03, 0, 0), s.hub]);
  L.push([side(new THREE.CircleGeometry(r * 0.2, 6)).translate(ox + sx * 0.036, 0, 0), VC.tone(s.hub, 0.7)]);
  if (!cheap) for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; L.push([side(new THREE.CircleGeometry(r * 0.07, 5)).translate(ox + sx * 0.034, Math.sin(a) * r * 0.38, Math.cos(a) * r * 0.38), VC.tone(s.hub, 0.5)]); }
  return L;
}

// ---------------------------------------------------------------- the whole car (everything except the moving wheels)
function vcModel(K, kind, opts) {
  const THREE = K.THREE, s0 = VC.SPEC[kind] || VC.SPEC.sedan, R = VC.rng((opts.seed ?? 1) * 7 + kind.length), M = new VCB(THREE);
  const s = Object.assign({ kind }, s0), hw = s.hw;
  let paint = opts.paint || (s.taxi ? '#e8b830' : kind === 'truck' ? (R() < 0.5 ? '#e6e2d8' : '#2e4a72') : VC.PAINT[Math.floor(R() * VC.PAINT.length)]);
  paint = VC.mix(paint, '#6a6458', R() * 0.12); // a little street grime on every car
  const trimC = VC.TRIM[Math.floor(R() * VC.TRIM.length)], vinyl = kind === 'sedan' && R() < 0.35, roofCol = vinyl ? VC.tone(paint, 0.55) : paint;
  s.hub = s.bump === 'chrome' || R() < 0.4 ? VC.CHROME : VC.tone(paint, 0.85);
  const bumpC = s.bump === 'chrome' ? VC.CHROME : s.bump === 'black' ? '#2a2a2e' : VC.tone(paint, 0.9);
  const glassC = [0.42, 0.56, 0.62, 0.42], hiC = [0.92, 0.97, 1.0, 0.55];
  const g = s.g, cabin = [g.C0 - 0.05, g.A0 + 0.05];
  // ---- lower body ----
  const body = vcLoft(M, s, paint, R, cabin), open = !!(s.bed || s.box); // pickup / truck: the loft is the cab + hood, the tail is the bed / box end
  const zN = s.st[s.st.length - 1][0], zT = s.bed ? s.bed[1] : s.box ? s.box[0] : s.st[0][0], hwN = hw * s.st[s.st.length - 1][1], hwT = open ? hw : hw * s.st[0][1];
  const yN = body.top(zN), yT = open ? 1.05 : body.top(zT);
  // ---- greenhouse ----
  const GH = vcGreenhouse(M, s, paint, body, roofCol, glassC, hiC);
  // ---- interior seen through the glass: dash, steering wheel, seat backs + headrests ----
  const yb = GH.yA, dz = g.A0 - 0.22;
  M.box(VC.tone(trimC, 0.45), 2 * GH.hb - 0.12, 0.16, 0.36, 0, yb + 0.02, dz);
  const sw = new THREE.TorusGeometry(0.17, 0.025, 4, 10); sw.rotateX(-0.9); sw.translate(0.37 * hw / 0.9, yb + 0.12, g.A0 - 0.48); M.geo(sw, VC.BLACK);
  M.beam(VC.BLACK, [0.37 * hw / 0.9, yb + 0.02, g.A0 - 0.32], [0.37 * hw / 0.9, yb + 0.1, g.A0 - 0.45], 0.04);
  s.rows.forEach((z, ri) => {
    const bench = ri > 0 || kind === 'pickup' || kind === 'truck', wid = 2 * GH.hb - 0.2;
    const backs = bench ? [[0, wid]] : [[0.36 * hw / 0.9, 0.52], [-0.36 * hw / 0.9, 0.52]];
    for (const [x, w] of backs) { M.box(trimC, w, 0.62, 0.13, x, yb + 0.06, z, { rx: -0.18 }); for (const hx of bench && w > 1 ? [-0.4, 0.4] : [0]) M.box(VC.tone(trimC, 0.85), 0.24, 0.16, 0.1, x + hx, yb + 0.44, z - 0.06); }
  });
  // ---- wheel wells (dark) + fender lips; tyres sit 3.5 cm proud of the body ----
  const wheels = [[1, s.zf, true], [-1, s.zf, true], [1, s.zr, false], [-1, s.zr, false]].map(([sx, z, front]) => ({ sx, x: sx * (hw + 0.035 - (s.kind === 'truck' ? 0.15 : 0.115)), y: s.r, z, r: s.r, front }));
  for (const w of wheels) { if (s.box && !w.front) continue; const x = w.sx * (hw + 0.022); M.disc(VC.DARK, s.r + 0.075, 10, x, s.r, w.z, w.sx, -0.15, Math.PI + 0.15); M.ring(VC.tone(paint, 0.72), s.r + 0.075, s.r + 0.11, 8, w.sx * (hw + 0.028), s.r, w.z, w.sx, -0.1, Math.PI + 0.1); }
  // ---- side details: door seams, handles, rub strip, mirrors ----
  const prof = (y) => { const ybb = s.yb, yt = body.top(0), ym = ybb + (yt - ybb) * 0.52; return y < ym ? hw + 0.015 * (y - ybb - 0.11) / (ym - ybb - 0.11) : hw + 0.015 - 0.019 * (y - ym) / (yt - 0.12 - ym); };
  const seamZ = [g.A0 - 0.06].concat(g.B).concat(g.we !== null && !s.bed && !s.box ? [g.we + 0.02] : []);
  for (const sx of [-1, 1]) {
    for (const z of seamZ) { if (Math.abs(z - s.zf) < s.r + 0.14 || Math.abs(z - s.zr) < s.r + 0.14) continue; const y0 = s.yb + 0.12, y2 = body.top(z) - 0.06, y1 = (y0 + y2) / 2;
      for (const [ya, yc] of [[y0, y1], [y1, y2]]) M.quad(VC.tone(paint, 0.45), [sx * (prof(ya) + 0.004), ya, z - 0.009], [sx * (prof(ya) + 0.004), ya, z + 0.009], [sx * (prof(yc) + 0.004), yc, z + 0.009], [sx * (prof(yc) + 0.004), yc, z - 0.009], [sx, 0, 0]); }
    const doors = [[g.A0 - 0.06, g.B.length ? g.B[0] : (g.we ?? g.C0)]].concat(g.B.length ? [[g.B[0], g.B[1] ?? g.we ?? g.C0]] : []);
    for (const [za, zb] of doors) { const yh = body.top(za) - 0.17; M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.6), 0.03, 0.035, 0.15, sx * (prof(yh) + 0.012), yh, Math.min(za, zb) + 0.18); }
    const yrub = body.top(0) - 0.2; M.beam(s.bump === 'chrome' ? VC.CHROME : '#2a2a2e', [sx * (prof(yrub) + 0.012), yrub, zT + 0.25], [sx * (prof(yrub) + 0.012), yrub, zN - 0.3], 0.03, false, 0.04);
    // mirror on a stalk at the A-pillar foot
    const my = GH.yA + 0.1, mz = g.A0 - 0.12; M.beam(VC.BLACK, [sx * (GH.hb + 0.02), my - 0.04, mz], [sx * (hw + 0.1), my, mz - 0.02], 0.035);
    M.box(s.bump === 'chrome' ? VC.CHROME : VC.tone(paint, 0.85), 0.07, 0.11, 0.15, sx * (hw + 0.13), my + 0.02, mz - 0.04, { ol: true });
  }
  // ---- nose: grille, lamps, bumper, plate ----
  const quadL = s.lamps === 'quad', lampW = { quad: 0.17, wide: 0.34, aero: 0.38 }[s.lamps] || 0.3, lx = hwN - 0.1 - lampW * (quadL ? 1.05 : 0.5), ly = yN - 0.17, gw = (quadL ? lx - lampW * 1.05 : lx - lampW / 2) - 0.03;
  M.box('#2a2a30', 2 * gw, 0.2, 0.04, 0, ly, zN + 0.01);
  for (let i = 0; i < 3; i++) M.box(s.bump === 'chrome' ? VC.CHROME : '#4a4a52', 2 * gw - 0.02, 0.02, 0.05, 0, ly - 0.07 + i * 0.07, zN + 0.015);
  if (s.bump === 'chrome') M.box(VC.CHROME, 2 * gw + 0.04, 0.24, 0.03, 0, ly, zN + 0.004);
  for (const sx of [-1, 1]) {
    const units = s.lamps === 'quad' ? [sx * (lx - lampW * 0.55), sx * (lx + lampW * 0.55)] : [sx * lx];
    for (const ux of units) { M.box(VC.CHROME, (s.lamps === 'quad' ? lampW : lampW) + 0.03, 0.15, 0.03, ux, ly, zN + 0.008); M.box('#f2eedc', (s.lamps === 'quad' ? lampW : lampW) - 0.02, 0.11, 0.04, ux, ly, zN + 0.014);
      const hx = ((s.lamps === 'quad' ? lampW : lampW) - 0.02) / 2; M.glow('#ffe6a0', [ux - hx, ly - 0.055, zN + 0.036], [ux + hx, ly - 0.055, zN + 0.036], [ux + hx, ly + 0.055, zN + 0.036], [ux - hx, ly + 0.055, zN + 0.036], [0, 0, 1]); }
    M.box('#e89a3a', 0.12, 0.06, 0.04, sx * (hwN - 0.1), ly - 0.13, zN + 0.01); // amber parking light
  }
  const bY = s.yb + 0.16, bumpD = s.bump === 'chrome' ? 0.14 : 0.16;
  M.box(bumpC, 2 * hwN + 0.04, 0.15, bumpD, 0, bY, zN + 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.42, sx * (hwN + 0.02), bY, zN - 0.12, { ry: sx * 0.25, ol: true });
  const plate = (z, dir) => { const y = bY + (dir > 0 ? 0.01 : 0.2), zz = z + dir * 0.004; M.quad('#e8e6dc', [-0.17, y - 0.085, zz], [0.17, y - 0.085, zz], [0.17, y + 0.085, zz], [-0.17, y + 0.085, zz], [0, 0, dir]);
    M.quad('#2f5bd3', [-0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.045, zz + dir * 0.002], [0.16, y + 0.075, zz + dir * 0.002], [-0.16, y + 0.075, zz + dir * 0.002], [0, 0, dir]);
    for (let i = 0; i < 6; i++) { const cx = -0.125 + i * 0.05 + (i > 2 ? 0.01 : 0); M.quad(VC.BLACK, [cx - 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y - 0.055, zz + dir * 0.003], [cx + 0.016, y + 0.02, zz + dir * 0.003], [cx - 0.016, y + 0.02, zz + dir * 0.003], [0, 0, dir]); } };
  plate(zN + 0.03 + bumpD / 2, 1);
  // ---- tail: lamps, bumper, plate, trunk / hatch seam ----
  const tY = yT - 0.15, tW = kind === 'hatch' || kind === 'minivan' ? 0.22 : 0.4;
  if (!open) for (const sx of [-1, 1]) { const tx = sx * (hwT - 0.06 - tW / 2); M.box('#7a1a1a', tW + 0.02, 0.17, 0.04, tx, tY, zT - 0.012); M.box('#d8303a', tW - 0.02, 0.13, 0.04, tx, tY, zT - 0.02);
    M.glow('#ff2a1a', [tx - tW / 2 + 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY - 0.06, zT - 0.042], [tx + tW / 2 - 0.01, tY + 0.06, zT - 0.042], [tx - tW / 2 + 0.01, tY + 0.06, zT - 0.042], [0, 0, -1]);
    M.box('#eeeeee', 0.07, 0.07, 0.04, sx * (hwT - 0.1 - tW), tY, zT - 0.012); }
  M.box(bumpC, 2 * hwT + 0.04, 0.15, bumpD, 0, bY, zT - 0.03, { ol: true }); for (const sx of [-1, 1]) M.box(bumpC, 0.14, 0.15, 0.4, sx * (hwT + 0.02), bY, zT + 0.12, { ry: -sx * 0.25, ol: true });
  plate(zT - 0.004, -1);
  if (!s.bed && !s.box && g.C0 - zT > 0.3) M.quad(VC.tone(paint, 0.45), [-hwT + 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.035, zT - 0.003], [hwT - 0.12, yT - 0.02, zT - 0.003], [-hwT + 0.12, yT - 0.02, zT - 0.003], [0, 0, -1]);
  // ---- kind extras ----
  if (s.rails) for (const sx of [-1, 1]) { M.beam(VC.BLACK, [sx * (g.rw - 0.1), g.yr + 0.1, g.A1 - 0.25], [sx * (g.rw - 0.1), g.yr + 0.1, g.C1 + 0.2], 0.04); for (const z of [g.A1 - 0.3, g.C1 + 0.25]) M.box(VC.BLACK, 0.05, 0.08, 0.06, sx * (g.rw - 0.1), g.yr + 0.06, z); }
  if (s.taxi) { // roof sign (lit at night) + checker band
    const zs = (g.A1 + g.C1) / 2 + 0.1, ys = g.yr + 0.045; M.box('#f2efe6', 0.62, 0.22, 0.24, 0, ys + 0.13, zs, { ol: true }); M.box(VC.BLACK, 0.66, 0.04, 0.28, 0, ys + 0.02, zs);
    for (const dir of [1, -1]) { const z = zs + dir * 0.122; M.glow('#fff2c0', [-0.28, ys + 0.04, z], [0.28, ys + 0.04, z], [0.28, ys + 0.22, z], [-0.28, ys + 0.22, z], [0, 0, dir]);
      const L = [[-0.22, 0.04, 0.06], [-0.19, 0.04, 0.012], [-0.09, 0.04, 0.06], [-0.04, 0.012, 0.06], [-0.065, 0.04, 0.012], [0.02, 0.012, 0.06], [0.06, 0.012, 0.06], [0.17, 0.012, 0.06]];
      for (const [x, w, h] of L) M.quad('#2a2420', [dir * x - w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 - h / 2, z + dir * 0.002], [dir * x + w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [dir * x - w / 2, ys + 0.13 + h / 2, z + dir * 0.002], [0, 0, dir]); }
    const yc = body.top(0) - 0.32; for (const sx of [-1, 1]) for (let i = 0; i < 16; i++) { const z0 = g.A0 - 0.1 - i * 0.12; if (z0 - 0.12 < g.C0 + 0.05) break; for (const row of [0, 1]) if ((i + row) % 2 === 0) { const y0 = yc + row * 0.06, x = sx * (prof(y0 + 0.03) + 0.005);
      M.quad(VC.BLACK, [x, y0, z0 - 0.12], [x, y0, z0], [x, y0 + 0.06, z0], [x, y0 + 0.06, z0 - 0.12], [sx, 0, 0]); } }
  }
  if (s.bed) { // pickup bed: open box behind the cab
    const [z1, z0] = [s.bed[0], s.bed[1]], yt = 1.05, fl = 0.78;
    M.box(VC.tone(paint, 0.9), 2 * hw - 0.16, 0.04, z1 - z0, 0, fl, (z0 + z1) / 2);
    for (const sx of [-1, 1]) { M.box(paint, 0.09, yt - s.yb, z1 - z0, sx * (hw - 0.045), (yt + s.yb) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(paint, 1.08), 0.13, 0.04, z1 - z0, sx * (hw - 0.05), yt + 0.02, (z0 + z1) / 2); }
    M.box(paint, 2 * hw, yt - s.yb, 0.09, 0, (yt + s.yb) / 2, z0 + 0.045, { ol: true }); M.box(VC.tone(paint, 0.85), 2 * hw - 0.2, 0.15, 0.1, 0, fl + 0.08, z1 + 0.04);
    M.box(VC.UNDER, 2 * hw - 0.2, 0.06, z1 - z0, 0, s.yb + 0.03, (z0 + z1) / 2);
    const tz = z0, ty = yt - 0.14; for (const sx of [-1, 1]) { const tx = sx * (hw - 0.12); M.box('#d8303a', 0.14, 0.28, 0.04, tx, ty - 0.08, tz - 0.012); M.glow('#ff2a1a', [tx - 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty - 0.21, tz - 0.035], [tx + 0.06, ty + 0.05, tz - 0.035], [tx - 0.06, ty + 0.05, tz - 0.035], [0, 0, -1]); }
  }
  if (s.box) { // box truck: cargo box with liveries, roll-up door, marker lights
    const [z0, z1] = s.box, y0 = 1.02, y1 = 3.25, bw = 1.15, boxC = opts.boxColor || (paint === '#2e4a72' ? '#3a5a8a' : '#eae6dc');
    M.box(boxC, 2 * bw, y1 - y0, z1 - z0, 0, (y0 + y1) / 2, (z0 + z1) / 2, { ol: true }); M.box(VC.tone(boxC, 0.8), 2 * bw + 0.04, 0.08, z1 - z0 + 0.04, 0, y1 - 0.02, (z0 + z1) / 2);
    M.box('#2a2a2e', 2 * hw - 0.5, 0.3, z1 - z0, 0, 0.86, (z0 + z1) / 2); for (const sx of [-1, 1]) M.box('#1e1e22', 0.4, 0.5, 0.04, sx * (bw - 0.25), 0.55, s.zr - s.r - 0.12); // chassis rail + mud flaps for (const x of [-0.6, 0, 0.6]) M.box(VC.tone('#8a8a90', 0.8), 0.04, 2.1, 0.03, x, 1.95, z0 - 0.012);
    for (let i = 0; i < 9; i++) M.box(VC.tone(boxC, 0.85), 2 * bw - 0.16, 0.025, 0.02, 0, 1.15 + i * 0.22, z0 - 0.02);
    for (const sx of [-1, 1]) { for (const z of [z0 + 0.3, z1 - 0.3]) { M.box('#e89a3a', 0.04, 0.06, 0.08, sx * (bw + 0.01), y1 - 0.2, z); M.glow('#ffa040', [sx * (bw + 0.032), y1 - 0.23, z - 0.04], [sx * (bw + 0.032), y1 - 0.23, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z + 0.04], [sx * (bw + 0.032), y1 - 0.17, z - 0.04], [sx, 0, 0]); } const tx = sx * (bw - 0.14); M.box('#d8303a', 0.18, 0.3, 0.04, tx, 1.18, z0 - 0.02);
      M.glow('#ff2a1a', [tx - 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.04, z0 - 0.045], [tx + 0.08, 1.32, z0 - 0.045], [tx - 0.08, 1.32, z0 - 0.045], [0, 0, -1]); }
    s.livery = opts.livery || (R() < 0.5 ? 'utz' : 'move'); if (s.livery === 'utz' && !opts.boxColor) { /* white box carries the Utz-style livery */ }
    for (const sx of [-1, 1]) M.D.push({ g: new THREE.PlaneGeometry(4.0, 4.0 * 112 / 320).rotateY(sx * Math.PI / 2).translate(sx * (bw + 0.012), 2.15, (z0 + z1) / 2), tile: s.livery === 'utz' ? 'truck_utz' : 'truck_move' });
  }
  const seats = s.rows.slice(0, kind === 'pickup' || kind === 'truck' ? 1 : 2).flatMap((z, ri) => (ri === 0 ? [[0.36 * hw / 0.9, z + 0.3, 'left'], [-0.36 * hw / 0.9, z + 0.3, 'right']] : [[0.4 * hw / 0.9, z + 0.3, 'rear-left'], [-0.4 * hw / 0.9, z + 0.3, 'rear-right']]).map(([x, sz, side]) => ({ x, y: GH.yA - 0.38, z: sz, ang: 0, pose: 'sit', side })));
  const height = s.box ? 3.25 : (s.taxi ? g.yr + 0.3 : g.yr + 0.05), len = Math.max(zN + 0.1, -zT + 0.1) * 2;
  return { M, s, wheels, seats, collider: { w: +(2 * hw + 0.1).toFixed(2), l: +len.toFixed(2), h: +height.toFixed(2) } };
}

// write a model's layers into an `out` collector; fin(g) places a car-space geometry (identity for a drivable car, the street pose for a parked one)
function vcEmit(K, out, Mo, fin, A) {
  const M = Mo.M;
  for (const B of M.S.values()) out.solid(fin(M.geom(B.P, B.N)), B.col, B.ol);
  for (const [col, B] of M.L) out.glow(fin(M.geom(B.P, B.N)), col);
  if (M.G.P.length) { const g = fin(M.geom(M.G.P, M.G.N, M.G.C)); if (out.glass) out.glass(g); else { g.deleteAttribute('color'); out.solid(g, '#5f7e8c', false); } }
  if (A) for (const d of M.D) { const g = fin(d.g); out.decal(g, A, d.tile); }
}

// ---------------------------------------------------------------- drivable vehicles: one static body + three wheel meshes
function vcVehicle(K, opts, kind) {
  const THREE = K.THREE, A = VC.atlas(K, opts), out = K.makeOut(), Mo = vcModel(K, kind, opts), s = Mo.s;
  let glassMesh = null; if (K.glassMat) out.glass = (g) => { glassMesh = new THREE.Mesh(g, K.glassMat); glassMesh.renderOrder = 3; };
  vcEmit(K, out, Mo, (g) => g, A);
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); if (glassMesh) bob.add(glassMesh);
  const mat = K.toonMat(), merge = (list) => { const P = [], N = [], C = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c.r, c.g, c.b); } }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3)); return m; };
  const wheels = [];
  for (const w of Mo.wheels.filter((q) => q.front)) { const steer = new THREE.Group(); steer.position.set(w.x, w.y, w.z); const mesh = new THREE.Mesh(merge(vcWheelParts(THREE, s, w.sx, false)), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: w.r, front: true }); }
  { const rr = Mo.wheels.filter((q) => !q.front), list = []; for (const w of rr) for (const [g, c] of vcWheelParts(THREE, s, w.sx, false)) list.push([g.translate(w.x, 0, 0), c]);
    const steer = new THREE.Group(); steer.position.set(0, rr[0].y, rr[0].z); const mesh = new THREE.Mesh(merge(list), mat); mesh.castShadow = true; steer.add(mesh); bob.add(steer); wheels.push({ steer, mesh, r: rr[0].r, front: false }); }
  const roll = kind === 'truck' ? 0.003 : 0.004, bounce = kind === 'truck' ? 0.008 : 0.006, bf = kind === 'truck' ? 7 : 9;
  return {
    root, kind: 'car', seats: Mo.seats, collider: Mo.collider, waterline: 0, parts: { bob, wheels }, model: kind,
    animate(v, dt, speed = 0, steerIn = 0, t = 0) {
      for (let i = 0; i < wheels.length; i++) { const w = wheels[i]; w.mesh.rotation.x += (speed * dt) / w.r; if (w.front) w.steer.rotation.y = Math.max(-1, Math.min(1, steerIn)) * 0.5; }
      bob.rotation.z = steerIn * Math.min(Math.abs(speed), 8) * roll; // the body rolls OUT of the turn (nit fixed: it used to lean in)
      bob.position.y = Math.abs(speed) > 0.1 ? Math.sin(t * bf) * bounce : 0;
    },
  };
}
function buildCarSedan(K, opts = {}) { return vcVehicle(K, opts, 'sedan'); }
function buildCarHatch(K, opts = {}) { return vcVehicle(K, opts, 'hatch'); }
function buildCarWagon(K, opts = {}) { return vcVehicle(K, opts, 'wagon'); }
function buildCarMinivan(K, opts = {}) { return vcVehicle(K, opts, 'minivan'); }
function buildCarPickup(K, opts = {}) { return vcVehicle(K, opts, 'pickup'); }
function buildCarCab(K, opts = {}) { return vcVehicle(K, opts, 'cab'); }
function buildBoxTruck(K, opts = {}) { return vcVehicle(K, opts, 'truck'); }

// ---------------------------------------------------------------- static parked cars (merged into the chunk through `out`, base on the road y = 0)
const VC_PARKED = { sedan: 'parked_car_sedan', hatch: 'parked_car_hatchback', pickup: 'parked_car_pickup', wagon: 'parked_car_wagon', minivan: 'parked_car_minivan', cab: 'parked_car_cab' };
function buildParkedCar(K, out, x, z, ang = 0, opts = {}) {
  const THREE = K.THREE, kind = VC_PARKED[opts.kind] ? opts.kind : 'sedan', Mo = vcModel(K, kind, opts), s = Mo.s, fin = (g) => K.place(g, x, 0, z, ang);
  vcEmit(K, out, Mo, fin, null);
  // static wheels (cheap: no spin dimples), merged per colour
  const byCol = new Map(); for (const w of Mo.wheels) for (const [g, c] of vcWheelParts(THREE, s, w.sx, true)) { g.translate(w.x, w.y, w.z); (byCol.get(c) || byCol.set(c, []).get(c)).push(g); }
  for (const [c, list] of byCol) for (const g of list) out.solid(fin(g), c, false);
  const hw = Mo.collider.w / 2, hl = Mo.collider.l / 2, p = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => [x + a * Math.cos(ang) + b * Math.sin(ang), z - a * Math.sin(ang) + b * Math.cos(ang)]);
  const bb = { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) };
  out.coll(bb); if (out.bld) out.bld(Object.assign({ h: Mo.collider.h }, bb));
  return Object.assign({ collider: Mo.collider }, META_VEH_CARS.pieces[VC_PARKED[kind]]);
}
function buildParkedCarSedan(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'sedan' })); }
function buildParkedCarHatchback(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'hatch' })); }
function buildParkedCarPickup(K, out, x, z, ang = 0, opts = {}) { return buildParkedCar(K, out, x, z, ang, Object.assign({}, opts, { kind: 'pickup' })); }
const VC_KINDS = ['sedan', 'hatch', 'wagon', 'minivan', 'pickup', 'cab'];

// ---- vendor/taskAB/veh_boats.js ----
// veh_boats.js — Task B: rideable boats: water_taxi (~9 m covered harbour launch), paddle_boat (two-seat swan pedal boat), dragon_boat (~12 m racing boat).
// Hulls are lofted from a few stations into flat-shaded shells (outer skin, inner skin and gunwale rim, so open boats look right from above).
// Each vehicle is root > bob > [ merged static body (out.build(): toon + ink hull + glow + decal), moving parts ]. The game owns `root`
// (position / yaw); animate() only moves `bob` (bobbing on the water) and the moving parts. The dragon boat's 20 paddles are ONE mesh whose
// vertices are rotated about each paddle's own shoulder every frame (a few hundred vertices: cheap), so the whole boat is 4 meshes.
// Contract: buildXxx(K, opts) -> { root, kind:'boat', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z; `waterline` is the local
// y that sits on the water surface (K.WY), so root.position.y = WY - waterline. steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet.
// Real flavour: harbour water-taxi lettering and colours (white hull, navy stripe, gold band, blue block letters) redrawn on canvas, no logo files.
// No imports; no Math.random; materials only through K.makeOut / K.toonMat. opts.atlas = K.makeAtlas(PROP_TILES) (else the PROP_TILES global).
const META_VEH_BOATS = {
  id: 'veh_boats', kind: 'vehicle',
  pieces: { water_taxi: { id: 'water_taxi', kind: 'boat', length: 9.2, beam: 2.9 }, paddle_boat: { id: 'paddle_boat', kind: 'boat', length: 3.4, beam: 1.7 }, dragon_boat: { id: 'dragon_boat', kind: 'boat', length: 13.6, beam: 1.2 } },
};

const VB = {
  IRON: '#2c322e', GLASS: '#6a8a9a', DARK: '#1a1626', CREAM: '#eae6dc', NAVY: '#2a3f6a', GOLD: '#e8b830', RED: '#b8302a', WOOD: '#9a6a44',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_boats'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  // lofted hull shell. st = [{ z, hw, y0, y1, c, w }] stern -> bow. Returns flat-shaded pieces: { low, high, inner, rim, stern } (BufferGeometry each)
  shell(THREE, st, th = 0.07) {
    const mk = () => ({ P: [] }), low = mk(), high = mk(), inner = mk(), rim = mk(), stern = mk();
    const sec = (s, k, side) => { const hw = Math.max(0.0, s.hw - k), y0 = s.y0 + (k ? k * 0.8 : 0), y1 = s.y1; return [[0, y0, s.z], [side * hw * (s.w ?? 0.7), y0 + (y1 - y0) * (s.c ?? 0.32), s.z], [side * hw, y1, s.z]]; };
    const tri = (G, a, b, c, hint) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) G.P.push(...a, ...c, ...b); else G.P.push(...a, ...b, ...c); };
    const quad = (G, a, b, c, d, hint) => { tri(G, a, b, c, hint); tri(G, a, c, d, hint); };
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
      const A = sec(st[i], 0, side), B = sec(st[i + 1], 0, side), hint = j === 0 ? [side * 0.6, -0.8, 0] : [side, 0.15, 0];
      quad(j === 0 ? low : high, A[j], A[j + 1], B[j + 1], B[j], hint);
      const Ai = sec(st[i], th, side), Bi = sec(st[i + 1], th, side); quad(inner, Ai[j], Ai[j + 1], Bi[j + 1], Bi[j], [-side * 0.6, 0.8, 0]);
    }
    for (let i = 0; i + 1 < st.length; i++) for (const side of [-1, 1]) { const A = sec(st[i], 0, side)[2], B = sec(st[i + 1], 0, side)[2], Ai = sec(st[i], th, side)[2], Bi = sec(st[i + 1], th, side)[2]; quad(rim, A, B, Bi, Ai, [0, 1, 0]); }
    const s0 = st[0]; const o = [sec(s0, 0, -1)[2], sec(s0, 0, -1)[1], sec(s0, 0, 1)[1], sec(s0, 0, 1)[2]], ii = [sec(s0, th, -1)[2], sec(s0, th, -1)[1], sec(s0, th, 1)[1], sec(s0, th, 1)[2]];
    quad(stern, o[0], o[3], o[2], o[1], [0, 0, -1]); quad(stern, ii[0], ii[3], ii[2], ii[1], [0, 0, 1]); quad(stern, o[3], o[0], ii[0], ii[3], [0, 1, 0]);
    const out = {}; for (const [k, G] of Object.entries({ low, high, inner, rim, stern })) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(G.P), 3)); g.computeVertexNormals(); out[k] = g; }
    return out;
  },
  // a flat top-view polygon [[x, z], ...] raised to height h, bottom at y0
  skin(st, z) { let i = 0; while (i + 2 < st.length && z > st[i + 1].z) i++; const a = st[i], b = st[i + 1], t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), L = (p, q) => p + (q - p) * t; return { hw: L(a.hw, b.hw), y0: L(a.y0, b.y0), y1: L(a.y1, b.y1), c: L(a.c ?? 0.32, b.c ?? 0.32), w: L(a.w ?? 0.7, b.w ?? 0.7) }; },
  slab(THREE, pts, y0, h) { const shp = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z))); const g = new THREE.ExtrudeGeometry(shp, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; },
  quad(THREE, a, b, c, d, hint) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const P = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3)); g.computeVertexNormals(); return g; },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  shape(K, out) { const THREE = K.THREE, s = (g, col, ol = false) => out.solid(g, col, ol), B = (w, h, d, x, y, z, col, o = {}) => { const g = VB.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const C = (rt, rb, h, seg, x, y, z, col, o = {}) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const Sp = (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); };
    const T = (p0, p1, r0, r1, seg, col, o = {}) => { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); out.solid(g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), col, !!o.ol); };
    const GL = (g, col) => out.glow(g, col); return { THREE, s, B, C, Sp, T, GL }; },
  assemble(K, out) { const THREE = K.THREE, root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build()); return { root, bob }; },
};

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vbFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

const vbBob = (bob, t, speed, steer, k = 1) => { bob.position.y = Math.sin(t * 1.7) * 0.035 * k; bob.rotation.z = Math.sin(t * 1.15) * 0.018 * k - steer * Math.min(Math.abs(speed), 8) * 0.004; bob.rotation.x = Math.sin(t * 1.35 + 1) * 0.012 * k - Math.min(Math.abs(speed), 8) * 0.004; };

// ---------------------------------------------------------------- water taxi
function buildWaterTaxi(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, GL } = VB.shape(K, out), WHITE = VB.CREAM, YEL = VB.GOLD;
  const st = [{ z: -4.5, hw: 1.05, y0: 0.14, y1: 1.0 }, { z: -3.8, hw: 1.3, y0: 0.06, y1: 1.0 }, { z: -2.0, hw: 1.4, y0: 0.0, y1: 1.0 }, { z: 0, hw: 1.42, y0: 0.0, y1: 1.0 }, { z: 2.0, hw: 1.35, y0: 0.02, y1: 1.02 }, { z: 3.3, hw: 1.05, y0: 0.08, y1: 1.08 }, { z: 4.1, hw: 0.6, y0: 0.2, y1: 1.16 }, { z: 4.6, hw: 0.05, y0: 0.5, y1: 1.24 }];
  const sh = VB.shell(THREE, st, 0.08); s(sh.low, VB.NAVY, true); s(sh.high, WHITE, true); s(sh.inner, VB.tone(WHITE, 0.8)); s(sh.rim, YEL); s(sh.stern, WHITE);
  s(VB.slab(THREE, [[-1.2, -4.2], [1.2, -4.2], [1.28, 2.6], [1.0, 3.2], [0.55, 4.0], [0, 4.45], [-0.55, 4.0], [-1.0, 3.2], [-1.28, 2.6]], 0.86, 0.06), '#9a8a74');            // deck
  for (const sx of [-1, 1]) {
    B(0.1, 0.95, 5.7, sx * 1.22, 1.45, -0.9, WHITE, { skip: 'ny', ol: true });                                                                                                   // lower cabin wall
    out.decal(new THREE.PlaneGeometry(3.8, 0.95).rotateY(sx * Math.PI / 2).translate(sx * 1.28, 1.45, -0.9), A, 'taxi_side');
    for (let i = 0; i < 6; i++) { const z = -3.45 + i * 1.0; B(0.12, 0.68, 0.12, sx * 1.22, 2.26, z, WHITE, { skip: 'ny' }); }
    for (let i = 0; i < 5; i++) { const z = -2.95 + i * 1.0, g = VB.quad(THREE, [sx * 1.255, 1.95, z - 0.4], [sx * 1.255, 1.95, z + 0.4], [sx * 1.255, 2.58, z + 0.4], [sx * 1.255, 2.58, z - 0.4], [sx, 0, 0]); s(g, VB.GLASS); GL(g.clone().translate(sx * 0.012, 0, 0), '#ffe08a'); }
    B(0.45, 0.45, 4.4, sx * 0.95, 1.1, -1.2, VB.tone(VB.NAVY, 1.2), { skip: 'ny' }); B(0.07, 0.55, 4.4, sx * 1.12, 1.62, -1.2, VB.tone(VB.NAVY, 1.4), { skip: 'ny' });  // benches
    C(0.1, 0.1, 7.4, 6, sx * 1.46, 0.9, 0.1, '#22222a', { open: true, rot: [Math.PI / 2, 0, 0] });                                                                            // rubber fender
  }
  B(2.7, 0.1, 6.1, 0, 2.66, -0.95, YEL, { skip: 'ny', ol: true }); B(2.5, 0.06, 0.1, 0, 2.55, 2.0, WHITE, { skip: 'ny' });
  B(2.45, 0.95, 0.1, 0, 1.45, 2.0, WHITE, { skip: 'ny', ol: true }); out.decal(new THREE.PlaneGeometry(2.0, 1.0).translate(0, 1.45, 2.056), A, 'taxi_bow');
  B(2.45, 0.95, 0.1, 0, 1.45, -3.85, WHITE, { skip: 'ny' });
  const wsh = VB.quad(THREE, [-1.2, 1.95, 2.0], [1.2, 1.95, 2.0], [1.2, 2.6, 1.9], [-1.2, 2.6, 1.9], [0, 0.3, 1]); s(wsh, VB.GLASS); GL(wsh.clone().translate(0, 0, 0.012), '#ffe08a');
  B(1.2, 0.75, 0.55, -0.45, 1.3, 1.5, VB.tone(VB.NAVY, 0.9), { skip: 'ny', ol: true }); B(0.7, 0.04, 0.3, -0.45, 1.71, 1.45, '#3a5a8a');                                   // console
  for (const [px, pz] of [[-1.0, 1.75], [0.0, 1.75]]) GL(new THREE.PlaneGeometry(0.12, 0.08).rotateX(-Math.PI / 2).translate(px, 1.74, pz), '#ffbf3c');
  s(new THREE.TorusGeometry(0.17, 0.022, 5, 10).rotateX(Math.PI * 0.3).translate(-0.5, 1.9, 1.25), VB.IRON);                                                              // steering wheel is a moving part (below); this ring is the binnacle
  C(0.04, 0.05, 1.3, 6, 0.0, 3.3, -2.0, VB.IRON, { open: true }); GL(new THREE.OctahedronGeometry(0.09, 0).translate(0, 3.98, -2.0), '#ffe08a');                          // mast + masthead light
  s(new THREE.TorusGeometry(0.2, 0.06, 5, 10).translate(0, 1.8, -3.93), VB.RED);                                                                                           // life ring
  for (const sx of [-1, 1]) { const rp = [[0.98, 2.8], [0.88, 3.25], [0.64, 3.7]]; rp.forEach(([x, z]) => B(0.05, 0.62, 0.05, sx * x, 1.2, z, VB.IRON, { skip: 'ny' })); B(0.04, 0.04, 1.0, sx * 0.93, 1.52, 3.05, VB.IRON, { rot: [0, sx * 0.4, 0] }); B(0.04, 0.04, 0.7, sx * 0.76, 1.52, 3.5, VB.IRON, { rot: [0, sx * 0.62, 0] }); }
  GL(new THREE.OctahedronGeometry(0.09, 0).translate(1.05, 1.25, 3.2), '#ff3a1c'); GL(new THREE.OctahedronGeometry(0.09, 0).translate(-1.05, 1.25, 3.2), '#23c26b');  // port red / starboard green
  GL(new THREE.PlaneGeometry(0.5, 0.18).translate(0, 2.35, 2.03), '#ffe08a');                                                                                               // headlamp
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat(), wheel = new THREE.Mesh(VB.merge(THREE, [[new THREE.TorusGeometry(0.2, 0.025, 5, 12), VB.WOOD], ...[0, 1, 2, 3].map((i) => [VB.box(THREE, 0.03, 0.4, 0.03).rotateZ((i * Math.PI) / 4), VB.WOOD])]), mat);
  wheel.position.set(-0.5, 1.88, 1.2); wheel.rotation.x = -0.9; wheel.castShadow = true; bob.add(wheel);
  const seats = [{ x: -0.5, y: 0.9, z: 0.8, ang: 0, pose: 'stand' }, { x: 0.95, y: 1.38, z: -0.4, ang: -Math.PI / 2, pose: 'sit' }, { x: 0.95, y: 1.38, z: -1.7, ang: -Math.PI / 2, pose: 'sit' }, { x: -0.95, y: 1.38, z: -1.0, ang: Math.PI / 2, pose: 'sit' }], collider = vbFit(THREE, bob, seats, { w: 3.0, h: 2.75 });
  return {
    root, kind: 'boat', waterline: 0.35, collider, parts: { bob, wheel }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer); wheel.rotation.z = -steer * 1.4; },
  };
}

// ---------------------------------------------------------------- swan pedal boat (two seats)
function buildPaddleBoat(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), WHITE = VB.CREAM, paint = opts.paint || '#eae6dc';
  const st = [{ z: -1.7, hw: 0.7, y0: 0.18, y1: 0.78, c: 0.4, w: 0.8 }, { z: -1.0, hw: 0.88, y0: 0.05, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0, hw: 0.9, y0: 0.0, y1: 0.78, c: 0.4, w: 0.8 }, { z: 0.9, hw: 0.8, y0: 0.04, y1: 0.8, c: 0.4, w: 0.8 }, { z: 1.5, hw: 0.45, y0: 0.18, y1: 0.86, c: 0.4, w: 0.8 }, { z: 1.78, hw: 0.08, y0: 0.4, y1: 0.92 }];
  const sh = VB.shell(THREE, st, 0.07); s(sh.low, '#9ab0b8', true); s(sh.high, paint, true); s(sh.inner, VB.tone(paint, 0.8)); s(sh.rim, VB.GOLD); s(sh.stern, paint);
  for (const sx of [-1, 1]) Sp(0.5, 8, 5, 0.22, 0.55, 1.15, sx * 0.84, 1.0, -0.3, paint, { rot: [0.0, 0, sx * 0.45], ol: true });                                                        // wings
  const nk = [[0, 0.8, 1.2, 0.22], [0, 1.25, 1.62, 0.18], [0, 1.68, 1.72, 0.15], [0, 2.0, 1.55, 0.13]];
  for (let i = 0; i + 1 < nk.length; i++) { T(nk[i].slice(0, 3), nk[i + 1].slice(0, 3), nk[i][3], nk[i + 1][3], 7, paint, { ol: true }); Sp(nk[i + 1][3] * 1.02, 7, 5, 1, 1, 1, nk[i + 1][0], nk[i + 1][1], nk[i + 1][2], paint); }
  Sp(0.19, 8, 6, 1, 0.9, 1.15, 0, 2.15, 1.58, paint, { ol: true }); C(0.01, 0.08, 0.3, 6, 0, 2.1, 1.84, '#ff9f1c', { rot: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) Sp(0.04, 5, 4, 1, 1, 1, sx * 0.13, 2.22, 1.68, VB.DARK);
  C(0.02, 0.13, 0.7, 6, 0, 1.15, -1.9, paint, { rot: [-1.0, 0, 0] });                                                                                                       // upturned tail
  B(1.5, 0.08, 0.4, 0, 0.6, -0.3, VB.tone(paint, 0.85), { skip: 'ny' }); B(1.5, 0.45, 0.07, 0, 0.88, -0.55, VB.tone(paint, 0.85), { skip: 'ny' });                              // bench + backrest
  B(0.6, 0.18, 0.5, 0, 0.5, 0.7, VB.tone(paint, 0.7), { skip: 'ny' });
  GL(new THREE.OctahedronGeometry(0.08, 0).translate(0, 2.4, 1.6), '#ffe08a');
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  const wheelG = VB.merge(THREE, [[new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6).rotateZ(Math.PI / 2), VB.IRON], ...[0, 1, 2, 3, 4, 5].map((i) => [VB.box(THREE, 0.7, 0.34, 0.05).rotateX((i * Math.PI) / 3 + 0.2).translate(0, 0, 0), VB.RED])]);
  const wheel = new THREE.Mesh(wheelG, mat); wheel.position.set(0, 0.5, -1.65); wheel.castShadow = true; bob.add(wheel);
  const crank = new THREE.Mesh(VB.merge(THREE, [[new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).rotateZ(Math.PI / 2), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(-0.3, 0.15, 0), VB.IRON], [VB.box(THREE, 0.08, 0.3, 0.04).translate(0.3, -0.15, 0), VB.IRON], [VB.box(THREE, 0.2, 0.05, 0.12).translate(-0.3, 0.3, 0), '#3a3a40'], [VB.box(THREE, 0.2, 0.05, 0.12).translate(0.3, -0.3, 0), '#3a3a40']]), mat);
  crank.position.set(0, 0.55, 0.4); crank.castShadow = true; bob.add(crank);
  const seats = [{ x: 0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }, { x: -0.35, y: 0.66, z: -0.2, ang: 0, pose: 'sit' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.28, collider, parts: { bob, wheel, crank }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 1.2); const w = Math.min(Math.abs(speed), 6) * 1.4 + 0.3; wheel.rotation.x -= w * dt; crank.rotation.x += w * dt * 1.2; },
  };
}

// ---------------------------------------------------------------- dragon boat (12 m, dragon head and tail, 10 paddler benches, drum, 20 paddles in one animated mesh)
function buildDragonBoat(K, opts = {}) {
  const A = VB.atlas(K, opts), out = K.makeOut(), { THREE, s, B, C, Sp, T, GL } = VB.shape(K, out), RED = VB.RED, GOLD = VB.GOLD;
  const st = [{ z: -6.0, hw: 0.2, y0: 0.38, y1: 0.78, c: 0.5, w: 0.8 }, { z: -5.2, hw: 0.4, y0: 0.14, y1: 0.62, c: 0.45, w: 0.8 }, { z: -3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 0, hw: 0.6, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 3.0, hw: 0.55, y0: 0.0, y1: 0.55, c: 0.45, w: 0.8 }, { z: 5.2, hw: 0.4, y0: 0.14, y1: 0.66, c: 0.45, w: 0.8 }, { z: 6.1, hw: 0.14, y0: 0.4, y1: 0.86, c: 0.5, w: 0.8 }];
  const sh = VB.shell(THREE, st, 0.06); s(sh.low, VB.tone(RED, 0.8), true); s(sh.high, RED, true); s(sh.inner, '#e8d4a8'); s(sh.rim, GOLD); s(sh.stern, RED);
  for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) { const z = -4.75 + i * 0.95, k = VB.skin(st, z), a = Math.atan2(k.hw * (1 - k.w), (k.y1 - k.y0) * (1 - k.c)), xm = k.hw * (k.w + (1 - k.w) / 2), ym = k.y0 + (k.y1 - k.y0) * (k.c + (1 - k.c) / 2), n = [sx * Math.cos(a), Math.sin(a)];
    out.decal(new THREE.PlaneGeometry(0.9, 0.45).rotateY(sx * Math.PI / 2).rotateZ(sx * a).translate(sx * xm + n[0] * 0.012, ym + n[1] * 0.012, z), A, 'dragon_scales'); }
  for (let i = 0; i < 10; i++) B(1.0, 0.07, 0.24, 0, 0.5, -4.1 + i * 0.86, VB.WOOD, { skip: 'ny' });                                                             // paddler benches
  // dragon head on the bow: skull, snout, jaws, horns, eyes, teeth, tongue, mane
  const hx = 0, hy = 1.28, hz = 6.45;
  T([0, 0.62, 5.7], [0, 1.0, 6.2], 0.2, 0.17, 7, RED, { ol: true }); T([0, 1.0, 6.2], [0, 1.28, 6.5], 0.17, 0.15, 7, RED);
  Sp(0.3, 9, 6, 0.9, 0.85, 1.15, hx, hy + 0.15, hz + 0.1, RED, { ol: true });                                                                                    // skull
  B(0.42, 0.2, 0.55, hx, hy + 0.05, hz + 0.62, RED, { skip: 'nz', ol: true }); B(0.38, 0.1, 0.45, hx, hy - 0.2, hz + 0.55, VB.tone(RED, 0.8), { skip: 'nz', rot: [0.2, 0, 0] });  // snout + lower jaw
  for (const sx of [-1, 1]) { C(0.0, 0.07, 0.5, 6, sx * 0.17, hy + 0.58, hz - 0.1, GOLD, { rot: [-0.7, 0, sx * 0.25] }); Sp(0.075, 6, 4, 1, 1, 1, sx * 0.23, hy + 0.24, hz + 0.38, VB.CREAM); Sp(0.035, 5, 4, 1, 1, 1, sx * 0.26, hy + 0.24, hz + 0.43, VB.DARK);
    for (const z of [0.0, 0.14, 0.28]) B(0.03, 0.09, 0.05, sx * 0.14, hy - 0.14, hz + 0.62 + z, VB.CREAM, { skip: 'py' }); C(0.0, 0.05, 0.3, 5, sx * 0.1, hy + 0.35, hz + 0.88, GOLD, { rot: [-1.3, 0, 0] }); }
  B(0.1, 0.01, 0.4, hx, hy - 0.16, hz + 0.95, '#ff3d6e', { rot: [0.2, 0, 0] }); for (let i = 0; i < 5; i++) C(0, 0.07, 0.3, 5, 0, 1.15 + i * 0.09, 5.95, GOLD, { rot: [-0.3, 0, 0] });
  GL(new THREE.OctahedronGeometry(0.05, 0).translate(0.26, hy + 0.24, hz + 0.44), '#ffe08a'); GL(new THREE.OctahedronGeometry(0.05, 0).translate(-0.26, hy + 0.24, hz + 0.44), '#ffe08a');
  // tail on the stern: a tapering upswept curl with fins
  const tl = [[0, 0.5, -5.6, 0.2], [0, 0.85, -6.15, 0.17], [0, 1.4, -6.45, 0.13], [0, 1.95, -6.3, 0.09], [0, 2.3, -5.9, 0.04]];
  for (let i = 0; i + 1 < tl.length; i++) { T(tl[i].slice(0, 3), tl[i + 1].slice(0, 3), tl[i][3], tl[i + 1][3], 6, i % 2 ? GOLD : RED, { ol: i < 2 }); Sp(tl[i + 1][3] * 1.02, 6, 4, 1, 1, 1, tl[i + 1][0], tl[i + 1][1], tl[i + 1][2], i % 2 ? RED : GOLD); }
  B(0.05, 0.4, 0.3, 0, 1.75, -6.55, GOLD, { rot: [0.5, 0, 0] });
  // drum + drummer's seat at the bow, steering oar + stand at the stern
  C(0.38, 0.38, 0.5, 12, 0, 0.96, 4.6, RED, { rot: [0, 0, Math.PI / 2], ol: true }); C(0.4, 0.4, 0.04, 12, 0.26, 0.96, 4.6, '#eae6dc', { rot: [0, 0, Math.PI / 2] }); B(0.1, 0.5, 0.1, 0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' }); B(0.1, 0.5, 0.1, -0.3, 0.55, 4.6, VB.WOOD, { skip: 'ny' });
  B(0.7, 0.06, 0.3, 0, 0.55, 5.05, VB.WOOD, { skip: 'ny' });
  B(0.9, 0.08, 0.6, 0, 0.58, -5.2, VB.WOOD, { skip: 'ny' }); B(0.06, 0.06, 2.2, 0.3, 0.9, -5.6, VB.WOOD, { rot: [0.15, 0, 0] }); B(0.1, 0.4, 0.6, 0.3, 0.55, -6.55, GOLD, { skip: 'ny' });
  // lanterns for the night regatta
  for (const z of [-5.4, 5.5]) { GL(new THREE.OctahedronGeometry(0.09, 0).translate(0.0, 0.95, z), '#ffbf3c'); }
  const { root, bob } = VB.assemble(K, out), mat = K.toonMat();
  // 20 paddles in ONE mesh: per-paddle vertex ranges + shoulder pivots; animate() rotates each paddle about its own shoulder (synchronised stroke)
  const list = [], pivots = []; for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) { const px = sx * 0.62, py = 0.85, pz = -4.1 + i * 0.86; const g1 = VB.box(THREE, 0.045, 1.5, 0.045).translate(0, -0.35, 0), g2 = VB.box(THREE, 0.04, 0.5, 0.2).translate(0, -1.3, 0.0); list.push([g1.translate(px, py, pz), VB.WOOD], [g2.translate(px, py, pz), VB.RED]); pivots.push([px, py, pz]); }
  const pg = VB.merge(THREE, list), base = Float32Array.from(pg.attributes.position.array), baseN = Float32Array.from(pg.attributes.normal.array), perP = base.length / 3 / pivots.length;
  const paddles = new THREE.Mesh(pg, mat); paddles.castShadow = true; bob.add(paddles); // culled normally against a fixed sphere that holds every stroke angle (fix m8)
  const stroke = (a) => { const P = pg.attributes.position.array, N = pg.attributes.normal.array, c = Math.cos(a), sn = Math.sin(a); for (let p = 0; p < pivots.length; p++) { const [px, py, pz] = pivots[p]; for (let k = 0; k < perP; k++) { const i = (p * perP + k) * 3, y = base[i + 1] - py, z = base[i + 2] - pz; P[i] = base[i]; P[i + 1] = py + y * c - z * sn; P[i + 2] = pz + y * sn + z * c; N[i] = baseN[i]; N[i + 1] = baseN[i + 1] * c - baseN[i + 2] * sn; N[i + 2] = baseN[i + 1] * sn + baseN[i + 2] * c; } } pg.attributes.position.needsUpdate = true; pg.attributes.normal.needsUpdate = true; };
  stroke(0); pg.computeBoundingSphere(); pg.boundingSphere.radius += 1.6; const _bs = pg.boundingSphere; pg.computeBoundingSphere = () => { pg.boundingSphere = _bs; };
  const seats = [{ x: 0, y: 1.0, z: 4.3, ang: Math.PI, pose: 'sit' }, { x: 0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: -0.28, y: 0.58, z: -0.15, ang: 0, pose: 'sit' }, { x: 0.1, y: 0.62, z: -5.2, ang: 0, pose: 'stand' }], collider = vbFit(THREE, bob, seats);
  return {
    root, kind: 'boat', waterline: 0.22, collider, parts: { bob, paddles }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { vbBob(bob, t, speed, steer, 0.9); const rate = 0.9 + Math.min(Math.abs(speed), 6) * 0.35; const ph = t * rate * 3.2; stroke(Math.sin(ph) * 0.5); },
  };
}

// ---- vendor/taskAB/veh_carts.js ----
// veh_carts.js — Task B: arabber_cart (painted produce cart pulled by a walking pony) and skateboard.
// Arabber cart: red / yellow / green painted wooden cart (scrollwork side panels drawn on canvas), striped canopy, bells, lantern, fruit crates,
//   two big spoked rear wheels + two small front wheels (one mesh per pair), a pony with four walking legs and a swishing tail
//   (each leg = one mesh pivoting at its shoulder / hip). Meshes: body, glow, decal, 2 wheel pairs, 4 legs, tail = 10 (+ ink hulls on the body).
// Skateboard: rounded deck with kick-tails, trucks, two wheel-pair meshes (3 meshes); the rider stands on seats[0], side-on.
// Contract: buildXxx(K, opts) -> { root, kind:'cart' | 'board', seats, collider, waterline, animate(v, dt, speed, steer, t) }. Facing +Z, wheels on y = 0.
// steer > 0 turns left (+X). Seat anchors: 'sit' = hips, 'stand' = feet. No imports; no Math.random; materials only through K.makeOut / K.toonMat.
const META_VEH_CARTS = {
  id: 'veh_carts', kind: 'vehicle',
  pieces: { arabber_cart: { id: 'arabber_cart', kind: 'cart', length: 5.9, width: 1.9 }, skateboard: { id: 'skateboard', kind: 'board', length: 0.9, width: 0.24 } },
};

const VT = {
  RED: '#b8302a', YEL: '#e8b830', GREEN: '#2f5a3a', WOOD: '#9a6a44', IRON: '#2c322e', CREAM: '#eae6dc',
  tone: (h, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join(''),
  atlas(K, opts) { return tbPropAtlas(K, opts, 'veh_carts'); },
  box(THREE, w, h, d, skip = '') { const g = new THREE.BoxGeometry(w, h, d), SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }; if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); } return g; },
  tube(THREE, p0, p1, r0, r1, seg = 6) { const d = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2); },
  merge(THREE, list) { const P = [], N = [], Cc = []; for (const [g0, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0, c = new THREE.Color(col), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); } } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); m.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Cc), 3)); return m; },
  spokedWheel(THREE, r, x, spokes = 10) { const L = [[new THREE.TorusGeometry(r, 0.045, 5, 14).rotateY(Math.PI / 2), VT.YEL], [new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateZ(Math.PI / 2), VT.RED]]; for (let i = 0; i < spokes; i++) L.push([VT.box(THREE, 0.04, r * 1.9, 0.045).rotateX((i * Math.PI) / spokes), VT.WOOD]); return L.map(([g, c]) => [g.translate(x, 0, 0), c]); },
  shape(K, out) { const THREE = K.THREE; return { THREE,
    s: (g, col, ol = false) => out.solid(g, col, ol),
    B: (w, h, d, x, y, z, col, o = {}) => { const g = VT.box(THREE, w, h, d, o.skip); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    Sp: (r, ws, hs, sx, sy, sz, x, y, z, col, o = {}) => { const g = new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz); if (o.rot) { g.rotateX(o.rot[0]); g.rotateY(o.rot[1]); g.rotateZ(o.rot[2]); } out.solid(g.translate(x, y, z), col, !!o.ol); },
    T: (p0, p1, r0, r1, seg, col, o = {}) => out.solid(VT.tube(THREE, p0, p1, r0, r1, seg), col, !!o.ol) }; },
};


// the inside of a one-sided shell (canopy underside): same triangles, reversed winding + normals
function vtFlip(g0) { const g = g0.clone(), ix = g.index.array.slice(); for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(Array.from(ix)); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return g; }

// centre the whole vehicle on its bounding box along Z (so `collider` is a centred box that matches the visible hull) and report that box
function vtFit(THREE, bob, seats, ov = {}) {
  const b = new THREE.Box3().setFromObject(bob), cz = (b.min.z + b.max.z) / 2, body = new THREE.Group();
  [...bob.children].forEach((c) => body.add(c)); body.position.z = -cz; bob.add(body); seats.forEach((s) => { s.z -= cz; });
  const r = (v) => Math.round(v * 100) / 100; return { w: ov.w ?? r(b.max.x - b.min.x), l: r(b.max.z - b.min.z), h: ov.h ?? r(b.max.y) };
}

// ---------------------------------------------------------------- arabber cart + pony
function buildArabberCart(K, opts = {}) {
  const A = VT.atlas(K, opts), out = K.makeOut(), { THREE, s, B, Sp, T } = VT.shape(K, out), mat = K.toonMat(), RED = VT.RED, YEL = VT.YEL, GRN = VT.GREEN;
  // chassis, floor, painted side panels, end boards, driver bench, shafts
  B(1.5, 0.1, 2.7, 0, 0.78, -0.9, VT.WOOD, { skip: 'ny', ol: true }); B(1.62, 0.1, 2.8, 0, 0.87, -0.9, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) {
    B(0.07, 0.85, 2.7, sx * 0.78, 1.3, -0.9, RED, { skip: 'ny', ol: true });
    out.decal(new THREE.PlaneGeometry(2.6, 2.6 * 112 / 256).rotateY(sx * Math.PI / 2).translate(sx * 0.82, 1.3, -0.9), A, 'arabber_side');
    T([sx * 0.45, 0.82, 0.4], [sx * 0.5, 0.92, 2.15], 0.04, 0.035, 6, VT.WOOD);                                                                 // shafts to the pony
  }
  B(1.5, 0.85, 0.07, 0, 1.3, 0.45, GRN, { skip: 'ny', ol: true }); B(1.5, 0.85, 0.07, 0, 1.3, -2.25, GRN, { skip: 'ny', ol: true });
  B(1.4, 0.07, 0.5, 0, 1.2, 0.1, VT.WOOD, { skip: 'ny' });                                                                                         // driver's bench
  // canopy over the rear: striped half-barrel on four posts, scalloped valance, bells
  for (const [px, pz] of [[0.76, -0.1], [-0.76, -0.1], [0.76, -2.15], [-0.76, -2.15]]) B(0.05, 1.0, 0.05, px, 2.1, pz, GRN, { skip: 'ny' });
  for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 3, 1, true, Math.PI / 2 + (i * Math.PI) / 6, Math.PI / 6); g.rotateX(Math.PI / 2); g.translate(0, 2.62, -1.15); s(g, i % 2 ? YEL : RED); s(vtFlip(g), VT.tone(i % 2 ? YEL : RED, 0.8), false); } // theta pi/2..3pi/2 = the arc OVER the cart after rotateX (fix M2)
  for (let i = 0; i < 9; i++) { const x = -0.8 + i * 0.2; s(new THREE.CircleGeometry(0.1, 3).rotateZ(Math.PI / 2).translate(x, 2.58 - Math.abs(x) * 0.0, 0.07), i % 2 ? YEL : RED); }
  for (const x of [-0.5, 0, 0.5]) { Sp(0.05, 6, 4, 1, 1, 1, x, 2.32, 0.08, '#c8a040'); }
  B(0.1, 0.14, 0.1, 0.7, 2.45, 0.1, VT.IRON, { skip: 'ny' }); out.glow(new THREE.OctahedronGeometry(0.1, 0).translate(0.7, 2.28, 0.1), '#ffbf3c');   // hanging lantern (night glow)
  // produce: crates with fruit
  for (const [cx, cz, c] of [[-0.35, -1.2, VT.WOOD], [0.35, -1.2, VT.WOOD], [0, -1.85, VT.tone(VT.WOOD, 0.85)]]) { B(0.62, 0.3, 0.55, cx, 1.02, cz, c, { skip: 'ny', ol: true }); }
  [['#ff9f1c', -0.35, -1.2], ['#c8302a', 0.35, -1.2], ['#7fb04a', 0, -1.85]].forEach(([c, fx, fz]) => { for (let i = 0; i < 3; i++) Sp(0.11, 6, 4, 1, 1, 1, fx + (i - 1) * 0.17, 1.24, fz + (i % 2) * 0.12 - 0.05, c); });
  // the pony: ellipsoid body, tube neck, head, ears, mane, harness (legs and tail are moving meshes below)
  const body = '#8a4a3a', dark = '#3a2a22', zc = 2.1;
  Sp(0.4, 9, 6, 1, 1, 2.05, 0, 1.28, zc, body, { ol: true }); Sp(0.33, 7, 5, 1, 1, 1, 0, 1.33, zc + 0.75, body); Sp(0.36, 7, 5, 1, 1, 1, 0, 1.3, zc - 0.7, body);
  T([0, 1.48, zc + 0.85], [0, 1.95, zc + 1.2], 0.19, 0.13, 7, body, { ol: true }); Sp(0.17, 7, 5, 1, 0.95, 1.7, 0, 1.97, zc + 1.45, body, { ol: true, rot: [0.5, 0, 0] }); Sp(0.12, 6, 4, 1, 1, 1.2, 0, 1.82, zc + 1.7, VT.tone(body, 0.8));
  for (const sx of [-1, 1]) { s(new THREE.ConeGeometry(0.05, 0.16, 5).translate(sx * 0.09, 2.2, zc + 1.28), body); Sp(0.025, 5, 4, 1, 1, 1, sx * 0.13, 2.02, zc + 1.5, dark); }
  for (let i = 0; i < 5; i++) B(0.05, 0.14, 0.08, 0, 1.78 + i * 0.07 + (i > 2 ? 0.04 : 0), zc + 0.78 + i * 0.1, dark, { rot: [0.6, 0, 0], skip: 'ny' });
  B(0.84, 0.05, 0.06, 0, 1.63, zc + 0.3, RED, { skip: 'ny' }); B(0.84, 0.05, 0.06, 0, 1.6, zc - 0.35, RED, { skip: 'ny' });
  for (const sx of [-1, 1]) B(0.04, 0.5, 0.05, sx * 0.4, 1.38, zc + 0.3, RED, { skip: 'ny' });
  // the arabber's rear running board: the 'stand' seat's feet rest on it (fix m4)
  B(1.1, 0.06, 0.32, 0, 0.47, -2.43, VT.WOOD, { skip: 'ny', ol: true }); for (const sx of [-0.45, 0.45]) B(0.05, 0.36, 0.05, sx, 0.66, -2.31, VT.IRON, { skip: 'ny' });
  const { root, bob } = (() => { const r = new THREE.Group(), b = new THREE.Group(); r.add(b); b.add(out.build()); return { root: r, bob: b }; })();
  // wheels: two big rear wheels (one mesh, they turn together) and two small front ones
  const rear = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.62, 0.84), ...VT.spokedWheel(THREE, 0.62, -0.84)]), mat), front = new THREE.Mesh(VT.merge(THREE, [...VT.spokedWheel(THREE, 0.42, 0.78, 8), ...VT.spokedWheel(THREE, 0.42, -0.78, 8)]), mat);
  rear.position.set(0, 0.62, -1.2); front.position.set(0, 0.42, -0.15); rear.castShadow = front.castShadow = true; bob.add(rear, front);
  // legs: pivot at the shoulder / hip, two segments + hoof each; tail: tube pivoting at the croup
  const legs = []; for (const [lx, lz, ph] of [[0.2, zc + 0.78, 0], [-0.2, zc + 0.78, Math.PI], [0.2, zc - 0.72, Math.PI], [-0.2, zc - 0.72, 0]]) {
    const g = VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.5, 0.02], 0.11, 0.075, 6), body], [VT.tube(THREE, [0, -0.5, 0.02], [0, -0.9, 0], 0.06, 0.05, 6), VT.tone(body, 0.85)], [VT.box(THREE, 0.11, 0.1, 0.16).translate(0, -0.95, 0.02), dark]]);
    const m = new THREE.Mesh(g, mat); m.position.set(lx, 1.0, lz); m.castShadow = true; bob.add(m); legs.push({ m, ph }); // shoulder / hip pivot at 1.0 so the 1.0 m legs put the hooves on y = 0 (fix M3)
  }
  const tail = new THREE.Mesh(VT.merge(THREE, [[VT.tube(THREE, [0, 0, 0], [0, -0.35, -0.2], 0.05, 0.08, 6), dark], [VT.tube(THREE, [0, -0.35, -0.2], [0, -0.75, -0.25], 0.08, 0.02, 6), dark]]), mat); tail.position.set(0, 1.45, zc - 1.0); tail.castShadow = true; bob.add(tail);
  const seats = [{ x: 0, y: 1.24, z: 0.12, ang: 0, pose: 'sit' }, { x: 0, y: 0.5, z: -2.43, ang: 0, pose: 'stand' }], collider = vtFit(THREE, bob, seats); // 'stand' = on the new rear step (fix m4)
  return {
    root, kind: 'cart', waterline: 0, collider, parts: { bob, rear, front, legs, tail }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) {
      rear.rotation.x += (speed * dt) / 0.62; front.rotation.x += (speed * dt) / 0.42;
      const k = Math.min(1, Math.abs(speed) / 2), ph = t * (2.2 + Math.abs(speed) * 1.1);
      for (const l of legs) l.m.rotation.x = Math.sin(ph + l.ph) * 0.55 * k;
      tail.rotation.z = Math.sin(t * 2.4) * 0.35; tail.rotation.x = 0.25 + Math.sin(t * 1.7) * 0.12;
      bob.position.y = Math.abs(Math.sin(ph)) * 0.03 * k; bob.rotation.z = -steer * 0.03 * k;
    },
  };
}

// ---------------------------------------------------------------- skateboard
function buildSkateboard(K, opts = {}) {
  const out = K.makeOut(), { THREE, s, B, T } = VT.shape(K, out), mat = K.toonMat(), paint = opts.paint || '#ff3d6e';
  const plan = [[-0.1, -0.34], [0.1, -0.34], [0.12, -0.3], [0.12, 0.3], [0.1, 0.34], [-0.1, 0.34], [-0.12, 0.3], [-0.12, -0.3]];
  const shp = new THREE.Shape(); plan.forEach(([x, z], i) => (i ? shp.lineTo(x, -z) : shp.moveTo(x, -z)));
  const deck = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: false }); deck.rotateX(-Math.PI / 2); s(deck.translate(0, 0.095, 0), paint, true);
  const grip = new THREE.ExtrudeGeometry(shp, { depth: 0.006, bevelEnabled: false }); grip.rotateX(-Math.PI / 2); grip.scale(0.9, 1, 0.94); s(grip.translate(0, 0.125, 0), '#2c322e', false);
  for (const sz of [-1, 1]) { B(0.22, 0.03, 0.12, 0, 0.115, sz * 0.4, paint, { rot: [sz * -0.35, 0, 0], skip: 'ny', ol: true }); B(0.2, 0.012, 0.1, 0, 0.14, sz * 0.4, '#2c322e', { rot: [sz * -0.35, 0, 0] }); }
  for (const sz of [-1, 1]) { B(0.14, 0.03, 0.1, 0, 0.075, sz * 0.22, '#a8a49a', { skip: 'ny' }); T([-0.13, 0.05, sz * 0.22], [0.13, 0.05, sz * 0.22], 0.015, 0.015, 6, '#6f6a62'); }
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob); bob.add(out.build());
  const wheels = [0.22, -0.22].map((z) => { const m = new THREE.Mesh(VT.merge(THREE, [-0.15, 0.15].map((x) => [new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10).rotateZ(Math.PI / 2).translate(x, 0, 0), '#eae6dc'])), mat); m.position.set(0, 0.05, z); m.castShadow = true; bob.add(m); return m; });
  const seats = [{ x: 0, y: 0.13, z: 0, ang: Math.PI / 2, pose: 'stand' }], collider = vtFit(THREE, bob, seats);
  return {
    root, kind: 'board', waterline: 0, collider, parts: { bob, wheels }, seats,
    animate(v, dt, speed = 0, steer = 0, t = 0) { for (const w of wheels) w.rotation.x += (speed * dt) / 0.04; bob.rotation.z = -steer * 0.22; bob.rotation.x = Math.min(Math.abs(speed), 6) * 0.004; },
  };
}


// ---------------- Task A/B adapter: Sonnet's rowhouse kit + street props + vehicles (vendor/taskAB, fixed) -> the game's own city builders ----------------
// The vendor modules write through a kit `out` collector and read a kit object `K`. The game has neither, so this file builds both from the game's globals:
//   K: THREE, place, toonMat, CURB / GF / FH / PAR / WY, makeOut (stand-alone vehicles), makeAtlas, mergeGeoms, OUT_CITY / addOdir, QUAL, NIGHT, glassMat.
//   makeAtlas(tiles): the kit tiles are drawn INTO the game's one 2048 city atlas (rows below the city tiles), so kit decals ride the existing decal
//     chunk meshes (DB, DECAL_MAT) at zero extra draw calls; rect(name) is the same [u, v, w, h] convention as the game's tile().
//   abCityOut(): solid -> CB (the 64 m city chunks, cel toon), decal -> DB, glow -> per-chunk glow layer (shown at night only, hidden by day),
//     glass -> per-chunk transparent glass layer (cars), ol -> per-chunk ink hull layer (HD only), coll -> COLL, bld -> BLD, lamp -> LAMPS
//     (instanced glow pools + halos + pooled point lights), hook -> ABHOOKS (climb / seat / manhole tables for phase 4).
// abBuildCity() (called from the city builder before the chunk meshes are built) puts a fixed rowhouse block on every generic residential
// plot, street props on the pavements and parked cars along the side streets; it yields to the browser every ~14 ms so phones keep painting.
const AB = { CURB: 0.16, GF: 4.4, FH: 3.4, PAR: 1.3, WY: -0.85, HULL: true, HULL_MIN: 2.0, CAR_P: 0.67, stats: { blocks: 0, houses: 0, cars: 0, lamps: 0, props: 0, ms: 0, yields: 0 } };
const ABHOOKS = { climb: [], seat: [], manhole: [] };
const AB_GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
AB_GLOW_MAT.visible = false; // night only (abNight), so the glow layer costs no draw calls by day
const AB_GLASS_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
function abNight(n) { AB_GLOW_MAT.opacity = Math.min(1, n * 1.1); AB_GLOW_MAT.visible = n > 0.01; }
// ---- atlas: kit tiles drawn into the game atlas ----
// The city atlas has 256 free rows below its own tiles (it uses 1792 of 2048), so both kit tile sets (Task A 60 tiles, Task B 13) are packed
// there together at 0.6 scale, tallest first (232 rows). At gameplay range a 1.2 m Formstone cell is ~77 px of texture, about screen density.
const AB_ATLASES = new Map(), AB_TSCALE = 0.6;
function abPackAtlases(sets) {
  const R = sets.map(() => ({})), all = [];
  sets.forEach((tiles, si) => { for (const [name, t] of Object.entries(tiles)) all.push({ si, name, t }); });
  all.sort((a, b) => b.t.h - a.t.h || b.t.w - a.t.w);
  if (_ax > 0) _ax = AS; // start on a fresh shelf
  for (const { si, name, t } of all) {
    const w = Math.ceil(t.w * AB_TSCALE), h = Math.ceil(t.h * AB_TSCALE);
    R[si][name] = tile(w, h, (c) => { c.scale(w / t.w, h / t.h); t.draw(c, t.w, t.h); }, 1);
  }
  if (_ay + _arow > AS) throw new Error('city atlas overflow (' + (_ay + _arow) + ' rows)');
  const mat = toonMat({ map: atlasTex, alphaTest: 0.5, side: THREE.DoubleSide }); mat.customProgramCacheKey = () => 'psxAB'; // stand-alone vehicles: plain uv, remapped into the tile
  return sets.map((tiles, si) => { const A = { canvas: atlasC, tex: atlasTex, mat, rect: (n) => R[si][n] }; AB_ATLASES.set(tiles, A); return A; });
}
function abMakeAtlas(tiles) { const A = AB_ATLASES.get(tiles); if (A) return A; throw new Error('taskAB: tile set not packed into the city atlas'); }
function abRefreshAtlas() { // the 32-bit copy of the atlas was shrunk before the kit tiles existed: redraw it
  const lo = atlasTex.userData.low, x = lo.getContext('2d'); x.clearRect(0, 0, lo.width, lo.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(atlasC, 0, 0, lo.width, lo.height); atlasTex.needsUpdate = true;
}
function abMerge(list, withUv = false) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = withUv ? new Float32Array(n * 2) : null; let o = 0;
  for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (U) U.set(g.attributes.uv.array, o * 2); o += c; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (U) m.setAttribute('uv', new THREE.BufferAttribute(U, 2)); m.computeBoundingSphere(); return m;
}
// ---- stand-alone collector (a drivable vehicle's static body): toon mesh + ink hull + glow + one mesh per atlas ----
function abMakeOut() {
  const S = [], OLs = [], GL = [], DC = new Map(), out = { COLL: [], BLD: [], LAMPS: [], HOOKS: {} };
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  out.solid = (g, col, outline = true) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); S.push(g); if (outline) OLs.push(g); };
  out.glow = (g, col) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); GL.push(g); };
  out.decal = (g, atlas, name) => { g = flat(g); const r = atlas.rect(name), uv = g.attributes.uv; if (!r) throw new Error('no tile ' + name);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * r[2], r[1] + uv.getY(i) * r[3]); bakeColor(g, '#ffffff'); (DC.get(atlas) || DC.set(atlas, []).get(atlas)).push(g); };
  out.coll = (c) => out.COLL.push(c); out.bld = (b) => out.BLD.push(b); out.lamp = (x, y, z) => out.LAMPS.push({ x, y, z });
  out.hook = (type, data) => (out.HOOKS[type] || (out.HOOKS[type] = [])).push(data);
  out.build = () => {
    const grp = new THREE.Group();
    if (S.length) { const m = new THREE.Mesh(abMerge(S), toonMat()); m.castShadow = m.receiveShadow = true; grp.add(m); }
    if (OLs.length) { const h = new THREE.Mesh(addOdir(abMerge(OLs)), OUT_CITY); h.visible = QUAL.hd; grp.add(h); QUAL.outlines.push(h); }
    if (GL.length) { const m = new THREE.Mesh(abMerge(GL), AB_GLOW_MAT); m.renderOrder = 2; grp.add(m); }
    for (const [atlas, list] of DC) { const m = new THREE.Mesh(abMerge(list, true), atlas.mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
    return grp;
  };
  return out;
}
const K_AB = {
  THREE, TAU, clamp, lerp, QUAL, NIGHT, CURB: AB.CURB, GF: AB.GF, FH: AB.FH, PAR: AB.PAR, WY: AB.WY,
  toonMat: (o, t) => toonMat(o, t), basicMat: (o) => new THREE.MeshBasicMaterial(o), OUT_CITY, addOdir, bakeColor, lowTex,
  place: (g, x, y, z, ry, rx, rz) => place(g, x, y, z, ry, rx, rz), makeOut: abMakeOut, makeAtlas: abMakeAtlas, mergeGeoms: abMerge, GLOW_MAT: AB_GLOW_MAT, glassMat: AB_GLASS_MAT,
};
const [AB_A, AB_B] = abPackAtlases([KIT_TILES, PROP_TILES]); abRefreshAtlas(); K_AB.propAtlas = AB_B; // the game owns the prop atlas (no vendor cache keyed on K)
const AB_BUILDERS = { buildRowhouse, buildCornerBar, buildCornerShop };

// ---- the city collector (chunked like the city meshes) ----
class ABChunks { // P, N and colour (3 or 4 components) per cell of `cell` metres (0 = one mesh for the whole city)
  constructor(c4, cell = 0) { this.ch = new Map(); this.c4 = c4; this.cell = cell; }
  at(x, z) { const k = this.cell ? Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell) : 'all'; let m = this.ch.get(k); if (!m) this.ch.set(k, (m = { P: [], N: [], C: [] })); return m; }
  add(g, col) { // g already in world space; col = colour string, or null when g carries its own rgba colour attribute
    if (g.index) g = g.toNonIndexed(); g.computeBoundingBox(); const b = g.boundingBox, m = this.at((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2);
    const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null, ca = g.attributes.color, c = col ? new THREE.Color(col) : null;
    for (let i = 0; i < p.length; i += 3) { m.P.push(p[i], p[i + 1], p[i + 2]); if (n) m.N.push(n[i], n[i + 1], n[i + 2]); else m.N.push(0, 1, 0);
      if (c) { m.C.push(c.r, c.g, c.b); if (this.c4) m.C.push(1); } else { const j = i / 3; m.C.push(ca.getX(j), ca.getY(j), ca.getZ(j)); if (this.c4) m.C.push(ca.itemSize > 3 ? ca.getW(j) : 1); } }
  }
  build(mat, o = {}) {
    const grp = new THREE.Group(); grp.userData.meshes = [];
    for (const [key, m] of this.ch) { if (!m.P.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(m.N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(m.C, this.c4 ? 4 : 3)); if (o.odir) addOdir(g); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.userData.key = key; mesh.renderOrder = o.order || 0; if (!this.cell) mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !!o.recv; grp.add(mesh); grp.userData.meshes.push(mesh); m.P = m.N = m.C = null; }
    return grp;
  }
}
// ---- LOD (perf pass): mass / near-detail split ----
// MASS (always drawn, inside the game's own city chunks CB / DB, so no extra draw calls): kit boxes >= AB.MASS_MIN m whose 2nd dimension is
//   >= AB.MASS_D2 m (walls, roofs, cornice slabs, parapets; not pipes, rails or thin trim), decals >= AB.DECAL_MIN m2 (windows, doors, shop fronts,
//   signs), every tiled facade run as ONE quad (out.tiled; the shader picks a variant tile + mirror per 1.2 m cell, so no per-cell decals), and a thin post + head stand-in for each acorn lamp.
// NEAR (32 m cells, shown only while the camera is within AB.NEAR m of the cell, +AB.HYST to leave): everything else - trim, dentils, brackets,
//   sills, lintels, stoop steps and rails, house numbers, grilles, full parked cars, lamps, bins, benches, manholes. Two meshes per cell: solids >= 0.9 m (cast shadows) and decals + small
//   solids (receive only). The ink hulls (HD) are 64 m near cells; car glass is one city-wide mesh shown only while some car cell is near.
// FAR CARS: one InstancedMesh of 3-box stand-ins (body in the car's paint, dark cabin, tyres), refilled with only the far, in-frustum, in-fog cars.
// Glow (night only) stays ONE city-wide mesh.
Object.assign(AB, { DBG: Q.get('abdbg') || '', CELL: 32, NEAR: 20, HYST: 6, MASS_MIN: 2.0, MASS_D2: 0.4, MASS_TRI: 12, DECAL_MIN: 0.5 });
const AB_GLW = new ABChunks(false), AB_GLS = new ABChunks(true), AB_OLK = new ABChunks(false, 64); // glow + car glass: one city-wide mesh each; hulls: 64 m cells (near only)
AB.stats.t = { mass: 0, massD: 0, tiled: 0, nearS: 0, nearD: 0 };
const AB_CELLS = new Map(); // key -> { key, x0, z0, S: MB (near solids), D: MB (near decals), meshes: [], prox: [], near }
function abCellAt(x, z) { const ix = Math.floor(x / AB.CELL), iz = Math.floor(z / AB.CELL), key = ix + ',' + iz; let c = AB_CELLS.get(key);
  if (!c) AB_CELLS.set(key, (c = { key, x0: ix * AB.CELL, z0: iz * AB.CELL, S: new MB(), D: new MB(), meshes: [], prox: [], near: false })); return c; }
// how many of a facade's variant tiles sit side by side in the atlas (same size, same row, 1 px pad): the shader can pick among those
const AB_VAR = new Map();
function abVariants(atlas, tiles) { const k = tiles.join('|'); if (AB_VAR.has(k)) return AB_VAR.get(k); const r0 = atlas.rect(tiles[0]); let n = 1;
  for (let i = 1; i < tiles.length; i++) { const r = atlas.rect(tiles[i]); if (!r || Math.abs(r[1] - r0[1]) > 1e-6 || Math.abs(r[2] - r0[2]) > 1e-6 || Math.abs(r[3] - r0[3]) > 1e-6 || Math.abs(r[0] - (r0[0] + i * (r0[2] + 2 / 2048))) > 1e-6) break; n++; }
  if (n < tiles.length) AB.stats.varMiss = (AB.stats.varMiss || 0) + 1; AB_VAR.set(k, n); return n; }
const abCtr = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]; };
const AB_PROX = { car: [] }; let abTrack = null; // stand-in tracker while one car / lamp is being built
function abCityOut() {
  const triN = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const o = {
    solid(g, col, ol = true) {
      g.computeBoundingBox(); const b = g.boundingBox, ds = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((p, q) => q - p), s = ds[0];
      if (abTrack) { abTrack.box.union(b); const n = triN(g); if (n > abTrack.n && s >= 0.9) { abTrack.n = n; abTrack.col = col; } }
      const mass = !AB.ctx && s >= AB.MASS_MIN && ds[1] >= AB.MASS_D2 && triN(g) <= AB.MASS_TRI; // slabs + walls, not sticks (pipes, rails, thin trim)
      if (ol && AB.HULL && s >= AB.HULL_MIN) AB_OLK.add(g, '#000');
      const st = AB.stats.t; if (mass) { if (AB.DBG !== 'nomass') CB.geom(g, col); st.mass += triN(g); } else { const [cx, cz] = abCtr(g), c = abCellAt(cx, cz); (s >= 0.9 ? c.S : c.D).geom(g, col); st.nearS += triN(g); } // >= 0.9 m casts (as before: big -> CB, small -> GB); small parts ride the near decal mesh (same toon + atlas shading, white tile) to save a draw call
    },
    decal(g, atlas, name) { const r = atlas.rect(name); if (!r) throw new Error('no tile ' + name);
      g.computeBoundingBox(); const b = g.boundingBox, e = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((p, q) => q - p);
      if (!AB.ctx && e[0] * e[1] >= AB.DECAL_MIN) { if (AB.DBG !== 'nomass') DB.geom(g, '#fff', r); AB.stats.t.massD += 2; return; }
      const [cx, cz] = abCtr(g); abCellAt(cx, cz).D.geom(g, '#fff', r); AB.stats.t.nearD += triN(g);
    },
    tiled(g, atlas, tiles, nx, ny) { // a whole facade run as one quad (mass); the shader picks a variant + mirror per cell (01_core, u > 900)
      const r = atlas.rect(tiles[0]); if (!r) throw new Error('no tile ' + tiles[0]); const n = abVariants(atlas, tiles); g = g.index ? g.toNonIndexed() : g;
      const p = g.attributes.position, nm = g.attributes.normal, uv = g.attributes.uv, c = new THREE.Color('#fff'), m = DB.at((p.getX(0) + p.getX(5)) / 2, (p.getZ(0) + p.getZ(5)) / 2);
      const u0 = 1000 * n + 100 + Math.floor(Math.abs(p.getX(0) * 7.31 + p.getZ(0) * 3.17 + p.getY(0) * 1.9)) % 300, v0 = Math.floor(Math.abs(p.getX(0) * 1.3 + p.getZ(0) * 5.7)) % 50;
      AB.stats.t.tiled += p.count / 3; if (AB.DBG === 'nomass') return;
      for (let i = 0; i < p.count; i++) m.vert([p.getX(i), p.getY(i), p.getZ(i)], [nm.getX(i), nm.getY(i), nm.getZ(i)], [u0 + uv.getX(i) * nx, v0 + uv.getY(i) * ny], c, r);
    },
    glow(g, col) { AB_GLW.add(g, col); },
    glass(g) { AB_GLS.add(g, null); },
    coll(c) { COLL.push(c); }, bld(b) { BLD.push(b); },
    lamp(x, y, z) { LAMPS.push({ x, z, y, px: x, pz: z }); AB.stats.lamps++; },
    hook(type, d) { (ABHOOKS[type] || (ABHOOKS[type] = [])).push(d); },
  };
  return o;
}
// build one car / lamp in near-only context and remember a stand-in (its world box + body colour) for the far instanced mesh
// acorn lamp: the full lamp is near detail; its far stand-in is a static 0.09 m post (inside the 8-sided shaft, r 0.07-0.095) and a 0.26 m head
// (inside the 0.25 x 1.15 globe) in the casting city chunks, so it costs no draw call and casts the lamp's shadow at every range
function abLamp(K, out, x, z, ang) { AB.ctx = 'prop'; buildLampAcorn(K, out, x, z, ang); AB.ctx = null; const C = AB.CURB, G = '#2f4a3a';
  CB.box(x - 0.045, C + 0.2, z - 0.045, x + 0.045, C + 4.02, z + 0.045, G, null, { top: false }); CB.box(x - 0.13, C + 4.38, z - 0.13, x + 0.13, C + 4.62, z + 0.13, '#e8e0c8', null, { bottom: true }); }
function abNearOnly(fn) { AB.ctx = 'prop'; fn(); AB.ctx = null; }
function abWithProxy(kind, fn) { AB.ctx = kind; abTrack = { box: new THREE.Box3(), n: 0, col: '#888' }; fn(); const t = abTrack; abTrack = null; AB.ctx = null;
  if (t.box.isEmpty()) return; const cx = (t.box.min.x + t.box.max.x) / 2, cz = (t.box.min.z + t.box.max.z) / 2;
  const c = abCellAt(cx, cz), P = { box: t.box, col: t.col, cell: c, i: AB_PROX[kind].length }; AB_PROX[kind].push(P); c.prox.push([kind, P.i]); }
// ---- deterministic helpers ----
const abRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); return f; };
const abSeed = (b) => Math.abs((b.x0 * 73856093) ^ (b.z0 * 19349663)) % 99991 + 7;
const abYield = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); // not throttled in background tabs
// which generic plots get a rowhouse block: every residential plot except Harbor East's towers and the block with the kickable STAFF door (06b)
function abTakes(b) { const fells = b.x0 >= 138 && b.z1 < 0, hEast = b.x0 >= 36 && b.z1 < 0 && !fells; return !hEast && !(b.x0 === -66 && b.z0 === -70); }
const AB_BLOCKS = [];
// is a circle (x, z, r) clear of every collider in a list and of every climb hook (1.3 m)?
function abFree(list, x, z, r) {
  for (const c of list) { if (c.r !== undefined) { if (Math.hypot(c.x - x, c.z - z) < c.r + r + 0.1) return false; } else if (x > c.x0 - r - 0.1 && x < c.x1 + r + 0.1 && z > c.z0 - r - 0.1 && z < c.z1 + r + 0.1) return false; }
  for (const h of ABHOOKS.climb) if (Math.hypot(h.x - x, h.z - z) < 1.3 + r) return false;
  return true;
}
const AB_AVENUE = (x, z) => (z > -46 && z < -36) || (z > 36 && z < 46) || (x > -76 && x < -66); // Pratt St, Key Hwy, Light St stay clear of new parked cars
async function abBuildCity() {
  const t0 = performance.now(); let tS = t0; const out = abCityOut(), K = K_AB;
  const tick = async () => { if (performance.now() - tS > 14) { AB.stats.yields++; await abYield(); tS = performance.now(); } };
  const carKinds = ['sedan', 'sedan', 'hatch', 'wagon', 'minivan', 'pickup', 'hatch', 'cab'];
  const parked = (x, z, alongX, seed, kind) => { const ang = alongX ? (seed % 2 ? Math.PI / 2 : -Math.PI / 2) : (seed % 2 ? 0 : Math.PI);
    abWithProxy('car', () => buildParkedCar(K, out, x, z, ang, { kind, seed })); AB.stats.cars++; };
  // 1) the old avenue cars (vaultable in 06b) are now real cars
  CARS.forEach(([x, z, ax], i) => parked(x, z, ax, 11 + i * 7, ['sedan', 'wagon', 'cab', 'pickup', 'hatch', 'sedan', 'minivan', 'wagon'][i % 8]));
  // 2) rowhouse blocks
  for (const b of AB_BLOCKS) {
    const seed = abSeed(b), fells = b.x0 >= 138 && b.z1 < 0, c0 = COLL.length;
    const info = buildRowBlock(K, out, AB_A, b.x0, b.z0, b.x1, b.z1, { seed, inset: 2, builders: AB_BUILDERS, p3: fells ? 0.9 : 0.55 });
    AB.stats.blocks++; AB.stats.houses += info.houses + info.corners.length; await tick();
    // 3) pavement props: acorn lamps, a trash can or two, sometimes a bench; never in front of a stoop / door or on a climb spot
    const R = abRng(seed * 3 + 1), local = COLL.slice(c0), faces = [['n', b.z0 + 0.55, Math.PI], ['s', b.z1 - 0.55, 0], ['w', b.x0 + 0.55, -Math.PI / 2], ['e', b.x1 - 0.55, Math.PI / 2]];
    for (const [k, line, ang] of faces) {
      const alongX = k === 'n' || k === 's', lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, P = (t) => (alongX ? [lo + t, line] : [line, lo + t]);
      const put = (ts, r, fn) => { for (const t of ts) { const [x, z] = P(t); if (abFree(local, x, z, r)) { const c1 = COLL.length; fn(x, z); for (let i = c1; i < COLL.length; i++) local.push(COLL[i]); return true; } } return false; };
      put([6, 5, 7, 4.5, 8], 0.3, (x, z) => abLamp(K, out, x, z, ang)); put([18, 19, 17, 19.5, 16], 0.3, (x, z) => abLamp(K, out, x, z, ang));
      if (R() < 0.6) { AB.stats.props++; put([3, 21, 2.6, 21.4, 11], 0.4, (x, z) => abNearOnly(() => buildTrashCan(K, out, x, z, ang, { recycling: R() < 0.35 }))); }
      if (R() < 0.3) { AB.stats.props++; put([12, 13.5, 10.5], 1.0, (x, z) => abNearOnly(() => buildBenchPark(K, out, alongX ? x : x + (k === 'w' ? 0.15 : -0.15), alongX ? z + (k === 'n' ? 0.15 : -0.15) : z, ang))); }
      // 4) parked cars in the lane along this face (1.15 m off the kerb), 1-3 per face
      const cl = k === 'n' ? b.z0 - 1.15 : k === 's' ? b.z1 + 1.15 : k === 'w' ? b.x0 - 1.15 : b.x1 + 1.15;
      let t = 3.6 + R() * 2.5;
      while (t < 21) { const kind = carKinds[Math.floor(R() * carKinds.length)], L = kind === 'pickup' ? 5.4 : kind === 'hatch' ? 4.0 : 4.9, tc = t + L / 2; if (tc + L / 2 > 21.5) break;
        const x = alongX ? lo + tc : cl, z = alongX ? cl : lo + tc, cs = Math.floor(R() * 9973) + 1;
        if (R() < AB.CAR_P && !AB_AVENUE(x, z) && !isWater(x, z)) { parked(x, z, alongX, cs, kind); CARS.push([x, z, alongX]); }
        t += L + 0.7 + R() * 2.2; }
      await tick();
    }
    // 5) a manhole in the street east of the block
    { const x = b.x1 + 3.4, z = (b.z0 + b.z1) / 2 + (R() - 0.5) * 8; if (!AB_AVENUE(x, z) && x < 212) { { const a = R() * TAU; abNearOnly(() => buildManhole(K, out, x, z, a)); } AB.stats.props++; } }
  }
  // 6) the harbour crab shack on the Key Hwy promenade below Federal Hill, facing the water
  buildCrabShack(K, out, -25, 33, Math.PI); AB.stats.props++;
  AB.stats.ms = Math.round(performance.now() - t0);
}
function abBuildLayers() { // after the city chunks: near cells (solids, decals, glass, HD ink hulls), far stand-ins, glow (night)
  const t0 = performance.now();
  const g = AB_GLW.build(AB_GLOW_MAT, { order: 2 }); scene.add(g);
  AB_GLASS_MAT.forceSinglePass = true; const s = AB_GLS.build(AB_GLASS_MAT, { order: 3 }); scene.add(s); // one pass (a double-sided transparent is otherwise drawn twice)
  const h = AB_OLK.build(OUT_CITY, { odir: true }); for (const m of h.userData.meshes) { m.visible = false; m.userData.abHull = true; } scene.add(h); // not in QUAL.outlines: abLodTick shows them (near cells, HD only)
  const grp = new THREE.Group(); scene.add(grp); let nearTris = 0;
  for (const c of AB_CELLS.values()) { // near solids >= 0.9 m cast (stoop steps, car bodies, lamp shafts), smaller ones only receive; only near cells in the 48 m sun box reach the shadow pass
    if (c.S.P.length) { const m = c.S.build(CITY_MAT); m.castShadow = m.receiveShadow = true; c.meshes.push(m); }
    if (c.D.P.length) { const m = c.D.build(DECAL_MAT); m.receiveShadow = true; c.meshes.push(m); }
    c.S = c.D = null;
    for (const m of c.meshes) { grp.add(m); m.visible = false; nearTris += m.geometry.attributes.position.count / 3; }
  }
  AB.hullCells = h.userData.meshes.map((m) => { const [ix, iz] = m.userData.key.split(',').map(Number); return { m, x0: ix * 64, z0: iz * 64, near: false }; });
  // far stand-ins: unit shapes (car: length along z, 1 m tall; lamp: real metres, height scaled), coloured per instance; hidden faces dropped
  const SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const unit = (parts) => abMerge(parts.map(([x0, y0, z0, x1, y1, z1, c, skip]) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    if (skip) { const drop = skip.split(' ').map((k) => SK[k]), src = b.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.includes(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); b.setIndex(keep); }
    b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); bakeColor(b, c); return b.toNonIndexed(); }));
  const carG = unit([[-0.5, 0.16, -0.5, 0.5, 0.56, 0.5, '#ffffff', 'ny'], [-0.42, 0.56, -0.26, 0.42, 1.0, 0.2, '#3a3f46', 'ny'], [-0.46, 0.0, -0.36, 0.46, 0.16, 0.36, '#151515', 'py ny']]);
  // the stand-in InstancedMesh is refilled by abLodTick only when its contents change: the instances in far cells inside the view frustum + fog
  const mkInst = (geo, list, setM) => { if (!list.length) return null; const mat = toonMat(), M = new THREE.Matrix4();
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.receiveShadow = true; im.frustumCulled = false; im.count = 0; im.setColorAt(0, new THREE.Color()); scene.add(im);
    const sh = new THREE.InstancedMesh(geo, mat, list.length); sh.castShadow = true; sh.frustumCulled = false; sh.layers.set(1); sh.count = 0; scene.add(sh);
    for (const P of list) { setM(P, M); P.M = M.clone(); P.c = new THREE.Vector3(P.box.min.x + P.box.max.x, P.box.min.y + P.box.max.y, P.box.min.z + P.box.max.z).multiplyScalar(0.5); P.r = P.box.max.distanceTo(P.box.min) / 2; P.C = new THREE.Color(P.col); }
    return { im, list, vis: '' }; };
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const cars = mkInst(carG, AB_PROX.car, (P, M) => { const b = P.box, sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, alongX = sx > sz;
    q.setFromAxisAngle(up, alongX ? Math.PI / 2 : 0); M.compose(v.set((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2), q, sc.set(alongX ? sz : sx, b.max.y - b.min.y, alongX ? sx : sz)); });
  AB.layers = { glow: g, glass: s, hull: h, near: grp, cars };
  AB.stats.cells = AB_CELLS.size; AB.stats.nearTris = Math.round(nearTris); AB.stats.layersMs = Math.round(performance.now() - t0);
}
// per frame (scene.onBeforeRender, before the shadow pass): a cell is near while the camera is within AB.NEAR m (+AB.HYST to leave) of its square
const AB_FR = new THREE.Frustum(), AB_M4 = new THREE.Matrix4(), AB_SPH = new THREE.Sphere();
function abFillInst(S, cam) { // refill the visible stand-in instances (only re-uploaded when the set changed)
  if (!S) return; const px = cam.position.x, pz = cam.position.z, fogF = (scene.fog ? scene.fog.far : 150) + 6, vis = [];
  S.list.forEach((P, i) => { if (P.cell.near || Math.hypot(P.c.x - px, P.c.z - pz) > fogF) return; AB_SPH.set(P.c, P.r); if (AB_FR.intersectsSphere(AB_SPH)) vis.push(i); });
  const kv = vis.join(','); if (kv === S.vis) return; S.vis = kv;
  vis.forEach((i, k) => { S.im.setMatrixAt(k, S.list[i].M); S.im.setColorAt(k, S.list[i].C); }); S.im.count = vis.length; S.im.visible = vis.length > 0; S.im.instanceMatrix.needsUpdate = true; S.im.instanceColor.needsUpdate = true;
}
function abLodTick(cam) {
  if (!AB.layers) return; const L = AB.layers, px = cam.position.x, pz = cam.position.z, force = Q.get('abnear'); 
  for (const c of AB_CELLS.values()) {
    const dx = Math.max(c.x0 - px, 0, px - c.x0 - AB.CELL), dz = Math.max(c.z0 - pz, 0, pz - c.z0 - AB.CELL), d = Math.hypot(dx, dz);
    const n = force === '1' ? true : force === '0' ? false : (c.near ? d < AB.NEAR + AB.HYST : d < AB.NEAR);
    if (n === c.near) continue; c.near = n;
    for (const m of c.meshes) m.visible = n;
  }
  for (const c of AB.hullCells) { const dx = Math.max(c.x0 - px, 0, px - c.x0 - 64), dz = Math.max(c.z0 - pz, 0, pz - c.z0 - 64), d = Math.hypot(dx, dz);
    const n = force === '1' ? true : force === '0' ? false : (c.near ? d < AB.NEAR + AB.HYST : d < AB.NEAR); c.near = n; c.m.visible = n && QUAL.hd; }
  let anyCar = false; for (const c of AB_CELLS.values()) if (c.near && c.prox.length) { anyCar = true; break; } L.glass.visible = anyCar; // car glass only matters while some car is near (far cars are stand-ins)
  AB_FR.setFromProjectionMatrix(AB_M4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); abFillInst(L.cars, cam);
}

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
function groundY(x, z) { if (isWater(x, z)) return CURB; if (isRoad(x, z)) return 0; return CURB + hillH(x, z); }

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
  const fp = new THREE.CylinderGeometry(0.12, 0.15, 12, 6); place(fp, HILL.x, CURB + HILL.h + 6, HILL.z); solid(fp, '#d8d8d0');
  const fl = new THREE.BoxGeometry(3.2, 1.9, 0.06); place(fl, HILL.x + 1.7, CURB + HILL.h + 10.9, HILL.z); CB.geom(fl, '#b03a3a', T.stripes);
  BLD.push({ x0: HILL.x - 8, x1: HILL.x + 8, z0: HILL.z - 4, z1: HILL.z + 4, h: CURB + HILL.h - 1 });
})();

// ---------------- generic blocks: 1-3 buildings per block, storefronts on every street face ----------------
const DOOR_AT = { x: -44.95, z: -58 }; // the kickable STAFF door (06b) sits on the east face of this block's building
function bld(x0, z0, x1, z1, fl, pal, o) { const h = building(x0, z0, x1, z1, fl, pal, o); COLL.push({ x0, x1, z0, z1 }); return h; }
SEED = 1234;
for (const b of GEN) {
  const abTake = abTakes(b); if (abTake) AB_BLOCKS.push(b); // Task A rowhouse blocks replace the generic fill here (02c_taskab.js); the random draws below still run so the kept blocks are unchanged
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
    if (!abTake) bld(x0, z0, x1, z1, fl, pal, o);
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
landmark('harborplace', 'HARBORPLACE', -52, -24, 16, { name: 'Dragon Boat Duchess', x: -44, z: -12, water: true });
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
landmark('aquarium', 'NATIONAL AQUARIUM', 19, -17, 19, { name: 'Big Jimmy', x: 19, z: -5, water: true });
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
// Pendry: the long recreation-pier building with a clock tower and a rooftop pool deck
mass(112, -29, 140, -21.5, 9, { tr: T.fac[5][1], top: '#6a6056' });
mass(124, -28, 128, -23, 10, { col: '#c4b090', y0: CURB + 9, coll: false });
{ const g = new THREE.CylinderGeometry(0.01, 2.9, 3, 4); g.rotateY(Math.PI / 4); place(g, 126, CURB + 19 + 1.5, -25.5); solid(g, '#4f6a5a'); }
CB.box(130, CURB + 9, -27.5, 138, CURB + 9.05, -23, '#4ac8e0', T.white); // rooftop pool
signOn(112, -29, 140, -21.5, 's', 4.6, 10, LSIGN.pier);
landmark('pendry', 'PENDRY', 126, -25, 17, { name: 'The Pool Shark', x: 126, z: -19.5 });
// Fells Point: low brick rowhouses (generic blocks) round a market hall on cobbles
mass(141, -64, 159, -52, 6, { tr: T.fac[2][0], top: '#5a4a3a' });
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(14, 2.2, 9.5); place(g, 150, CURB + 6 + 1.1, -58); solid(g, '#5a3a2a'); }
signOn(141, -64, 159, -52, 's', 3.2, 9, LSIGN.fells);
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
(function ballpark() {
  CB.floor(-124, -26, -92, 26, CURB + 0.012, T.grass, '#fff', 4);
  { const d = new THREE.CylinderGeometry(7, 7, 0.02, 16); place(d, -100, CURB + 0.02, 0); CB.geom(d, '#b0784a'); }
  stand(-134, -34, -124, 34, 14, 'w', '#3a5a3a'); stand(-124, -34, -96, -26, 11, 'n', '#3a5a3a'); stand(-124, 26, -96, 34, 11, 's', '#3a5a3a');
  mass(-88, -34, -80, 34, 22, { tr: T.fac[0][1], top: '#4a3a30' });
  signOn(-88, -34, -80, 34, 'e', 15, 16, LSIGN.ball);
  for (const [x, z] of [[-128, -30], [-128, 30], [-98, -30], [-98, 30]]) { pole(x, z, 26, 0.35, '#3a3a3a'); sbox(x - 2, CURB + 26, z - 0.5, x + 2, CURB + 28.5, z + 0.5, '#e8e4d0'); }
})();
landmark('orioles', 'ORIOLE PARK', -100, 0, 34, { name: 'Bird Brain Bobby', x: -91.5, z: 0 });
// M&T Bank Stadium: a big closed bowl with an entrance gap on the east side
(function stadium() {
  CB.floor(-124, 56, -88, 96, CURB + 0.012, T.grass, '#fff', 4);
  for (let z = 60; z < 94; z += 6) CB.floor(-122, z, -90, z + 0.35, CURB + 0.02, T.white, '#f0f0e8');
  const C = '#4a3f6a';
  stand(-134, 48, -124, 104, 22, 'w', C); stand(-124, 48, -80, 56, 20, 'n', C); stand(-124, 96, -80, 104, 20, 's', C);
  stand(-88, 56, -80, 70, 20, 'e', C); stand(-88, 82, -80, 96, 20, 'e', C);
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
mass(106, 48, 126, 56, 11, { tr: T.fac[0][0], top: '#4a3a30' }); mass(106, 60, 126, 68, 11, { tr: T.fac[0][1], top: '#4a3a30' });
mass(113.5, 56.5, 118.5, 59.5, 22, { col: '#9a5a44', top: '#4a3a30' });
signOn(106, 48, 126, 56, 'n', 7.6, 10, LSIGN.ath);
landmark('underarmour', 'UNDER ARMOUR', 116, 52, 16, { name: 'The Compression King', x: 116, z: 43 });
// Fort McHenry: a five-point star fort on grass at the tip of Locust Point, with the flag
(function fort() {
  const cx = 176, cz = 78, R = 17, r = 10.5, V = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; V.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  for (let i = 0; i < 10; i++) {
    if (i === 5) continue; // the sally port (gap facing the city)
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    obox((ax + bx) / 2, (az + bz) / 2, L + 1.2, 2.4, 4.2, ang, '#a89878');
    for (let t = 0; t <= 1.001; t += 1.6 / L) COLL.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t), r: 1.3 });
    BLD.push({ x0: Math.min(ax, bx) - 1, x1: Math.max(ax, bx) + 1, z0: Math.min(az, bz) - 1, z1: Math.max(az, bz) + 1, h: CURB + 4.2 });
  }
  sbox(cx - 6, CURB, cz - 3, cx + 3, CURB + 3.2, cz + 1, '#b8a888'); COLL.push({ x0: cx - 6, x1: cx + 3, z0: cz - 3, z1: cz + 1 });
  pole(cx + 5, cz + 4, 24, 0.2);
  const fl = new THREE.BoxGeometry(7, 4.2, 0.08); place(fl, cx + 8.6, CURB + 21.6, cz + 4); CB.geom(fl, '#b03a3a', T.stripes);
  const ca = new THREE.BoxGeometry(2.6, 2.2, 0.1); place(ca, cx + 6.4, CURB + 22.6, cz + 4.01); CB.geom(ca, '#2a3a7a');
})();
landmark('fort', 'FORT MCHENRY', 176, 78, 26, { name: 'Admiral Redclaw', x: 176, z: 80 });
// a few parked cars (vaultable in 06b) along the avenues
const CARS = [[-74.2, -16, false, '#a83a4a', '#d8d0c0'], [-74.2, 20, false, '#3a5a8a', '#2a3a5a'], [-22, -44.2, true, '#d8a830', '#d8a830'], [42, -44.2, true, '#5a7a4a', '#d8d0c0'],
  [52, 44.2, true, '#a83a4a', '#d8d0c0'], [-30, 44.2, true, '#3a5a8a', '#2a3a5a'], [34.2, -60, false, '#d8a830', '#d8a830'], [170.2, -60, false, '#7a3a7a', '#d8d0c0']];
// (built as real parked cars by abBuildCity in 02c_taskab.js, which also appends the side-street cars to CARS)

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

// ---------------- Task A/B: rowhouse blocks, street props, parked cars (02c_taskab.js), spread over frames while loading ----------------
if (AB.CURB !== CURB || AB.GF !== GF || AB.FH !== FH) throw new Error('taskAB K constants out of sync');
await abBuildCity();
// ---------------- build the chunked meshes ----------------
const cityMesh = CB.build(CITY_MAT, { cast: true }); scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);
abBuildLayers();
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
  abLodTick(cam); // Task A/B near-detail cells + far stand-ins (02c)
  for (const L of LMHD.list) {
    const d = Math.hypot(cam.position.x - L.cx, cam.position.z - L.cz) - L.r;
    const n = LMHD.force === 'near' ? true : LMHD.force === 'far' ? false : (L.isNear ? d < LMHD.near + 8 : d < LMHD.near);
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
  for (const e of enemies) { const near = (e.pos.x - hero.pos.x) ** 2 + (e.pos.z - hero.pos.z) ** 2 < 24 * 24;
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
    if (!gp) continue; const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    mx += dz(gp.axes[0] || 0); my -= dz(gp.axes[1] || 0); look += dz(gp.axes[2] || 0); lookY += dz(gp.axes[3] || 0);
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(4)) look -= 1; if (b(5)) look += 1;
    const prev = PAD_PREV[gp.index] || []; if (b(3)) IN.padAct = true;
    if ((b(2) && !prev[2]) || (b(1) && !prev[1])) PRESS.add('j'); if (b(0) && !prev[0]) PRESS.add('k'); if (b(3) && !prev[3]) PRESS.add('e');
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
function updateCamera(dt, rdt) {
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
  const portrait = VH() > VW() * 1.15;
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
  setFov(lerp(58, 62, fk));
}
function setFov(base) { // wider in portrait so the street still fits
  const aspect = VW() / VH(); let fov = base; if (aspect < 1) fov = clamp(2 * Math.atan(Math.tan((base * 0.82 / 2) * Math.PI / 180) / aspect) * 180 / Math.PI, base, 84);
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
function tryAction() { const c = actContext(); if (!c || c.ready === false) return false; c.go(); return true; }
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
      else { P.pos.x = sx; P.pos.z = sz; P.yaw = Math.atan2(F.ex - sx, F.ez - sz); pose = HERO_POSES.atk1(clamp((t - 1.0) / 0.32, 0, 1)); rate = 30; }
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

// ---------------- autopilot for tests (?bot=1): walk up the street and back, fight every thug met, orbit the camera mid-fight ----------------
const CORNER_PTS = [['HARBORPLACE', -40, -33], ['CONSTELLATION', -31, -33], ['WTC', -12, -33], ['AQUARIUM', 19, -33], ['POWERPLANT', 56, -33], ['PRATT', 70, -38.5], ['FOURSEASONS', 82, -41.5]]; // east along the promenade past 6 landmarks
function near0() { let n = 0; for (const e of enemies) if (e.alive && e.state !== 'dying' && e.state !== 'idle' && e.state !== 'return' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 4) n++; return n; }
const BOTR = { i: 0, log: [], corners: [], t: 0, orbitT: 0, atkT: 0, done: false, fightT: 0, fights: 0, yaws: [] };
function botThink(dt) {
  BOTR.t += dt; const b = (IN.bot = IN.bot || { mx: 0, my: 0, look: 0 });
  b.look = 0; if (CINE.intro || CINE_ST.has(hero.state) || hero.state === 'ko' || PART.over) { b.mx = b.my = 0; b.actHold = false; return; }
  // the partner is down: run over and hold ACT on it
  if (partner.state === 'ko') { const d = Math.hypot(partner.pos.x - hero.pos.x, partner.pos.z - hero.pos.z);
    if (d < 1.5 || hero.state === 'revive') { b.mx = b.my = 0; b.actHold = true; return; }
    b.actHold = false; const f = camFwd(CAM.yaw), r = [-f[1], f[0]], dx = partner.pos.x - hero.pos.x, dz = partner.pos.z - hero.pos.z; b.mx = (dx * r[0] + dz * r[1]) / d; b.my = (dx * f[0] + dz * f[1]) / d; BOTR.revRuns = (BOTR.revRuns || 0) + 1; return; }
  b.actHold = false;
  // QTE: a dizzy thug in reach -> press the action button (after a human-ish reaction delay) instead of swinging
  if (near0() >= 2 && POWER.cd <= 0 && hero.state === 'move' && !qteInRange()) { b.act = true; BOTR.power = (BOTR.power || 0) + 1; }
  if (QTE && qteInRange()) { b.mx = b.my = 0; BOTR.qteT = (BOTR.qteT || 0) + dt; if (BOTR.qteT > 0.2) { b.act = true; BOTR.qteT = 0; BOTR.qtePressed = (BOTR.qtePressed || 0) + 1; } return; } else BOTR.qteT = 0;
  const near = enemies.filter((e) => e.alive && e.state !== 'dying' && e.state !== 'return' && e.state !== 'idle' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 9);
  let tx, tz, stopAt = 0.8;
  if (near.length) {
    near.sort((a, c) => Math.hypot(a.pos.x - hero.pos.x, a.pos.z - hero.pos.z) - Math.hypot(c.pos.x - hero.pos.x, c.pos.z - hero.pos.z));
    const e = near[0]; tx = e.pos.x; tz = e.pos.z; stopAt = 1.6; BOTR.fightT += dt;
    // orbit the camera during fights so we fight from several angles
    BOTR.orbitT += dt; if (BOTR.orbitT % 4 < 0.6) b.look = 1;
    const d = Math.hypot(tx - hero.pos.x, tz - hero.pos.z);
    if (d < 2.4) { BOTR.atkT -= dt; if (BOTR.atkT <= 0) { if (Math.random() < 0.12 && hero.state === 'move') b.jump = true, BOTR.airPend = 0.2; else b.atk = true; BOTR.atkT = 0.11; } }
    if (BOTR.airPend !== undefined) { BOTR.airPend -= dt; if (BOTR.airPend <= 0) { b.atk = true; BOTR.airPend = undefined; } }
    BOTR.yaws.push(+CAM.yaw.toFixed(2));
  } else {
    if (BOTR.i >= CORNER_PTS.length) { BOTR.done = true; b.mx = b.my = 0; return; }
    const [name, x, z] = CORNER_PTS[BOTR.i]; tx = x; tz = z;
    if (Math.hypot(x - hero.pos.x, z - hero.pos.z) < 1.0) { BOTR.corners.push(name); BOTR.log.push(name + '@' + S.time.toFixed(1)); BOTR.i++; }
  }
  const dx = tx - hero.pos.x, dz = tz - hero.pos.z, d = Math.hypot(dx, dz);
  if (d < stopAt) { b.mx = b.my = 0; return; }
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
function gateInput() { if (CINE.intro) { IN.mx = IN.my = 0; PRESS.clear(); } }
function camStep(dt, rdt) {
  if (CINE.intro) { updateCamera(dt, rdt); introCamera(rdt); }
  else if (cineCamActive()) cineCamera(rdt);
  else updateCamera(dt, rdt);
}
if (!Q.has('nointro') && !POSE) { CINE.intro = { t: 0, dur: 5.2 }; $('title').classList.add('on'); $('hint').style.opacity = '0'; }
function resize() { // low-res target: LINES (240) on the short side, the long side follows the screen's aspect (portrait keeps its aspect too)
  const w = VW(), h = VH(), a = w / h; let lw, lh;
  if (QUAL.hd) { const dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25); lw = Math.round(w * dpr); lh = Math.round(h * dpr); }
  else if (a >= 1) { lh = LINES; lw = Math.round(LINES * a); } else { lw = LINES; lh = Math.round(LINES / a); }
  LOW.w = lw; LOW.h = lh; renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); SNAP.value.set(lw / 2, lh / 2);
  camera.aspect = a; camera.updateProjectionMatrix();
}
function setHD(on) { // the quality toggle: everything but the day/night cycle and the game
  applyQuality(on);
  sun.shadow.mapSize.set(on ? 2048 : SHM, on ? 2048 : SHM); renderer.shadowMap.type = on ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; });
  const b = $('qbtn'); if (b) b.textContent = on ? 'HD' : '32-BIT'; resize();
}
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'h' && !e.repeat) setHD(!QUAL.hd); });
{ const b = $('qbtn'); if (b) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setHD(!QUAL.hd); }); }
addEventListener('resize', resize); setHD(QUAL.hd);

// ---------------- day / night: a continuous loop (default 600 s): 5 min day -> night, 5 min night -> day. ?tod=0..1 pins it (0 day, .25 dusk, .5 night), ?cycle=N sets the loop length ----------------
const CYC = { len: clamp(+(Q.get('cycle') || 600), 4, 7200), pin: Q.has('tod') ? clamp(+Q.get('tod'), 0, 1) : null, t: 0, tod: 0, n: 0, lamps: 0 };
const FILL = new THREE.PointLight('#c8d0ff', 0, 12, 1.2); scene.add(FILL);
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALK = { // day, dusk, night
  top: _ck(['#4a86c8', '#34386e', '#03050b']), mid: _ck(['#9cc4dc', '#b0706a', '#0a0f1a']), hor: _ck(['#d8dccf', '#f08850', '#141a26']),
  fog: _ck(['#b4c0c6', '#8a6060', '#0b0f17']), hs: _ck(['#dfe6ff', '#ffb08a', '#4a5a88']), hg: _ck(['#8a7f74', '#5a4040', '#14141c']),
  sun: _ck(['#fff3dc', '#ff9a58', '#8aa0e8']), cloud: _ck(['#ffffff', '#ffb0a0', '#20242e']),
};
const DIRK = [new THREE.Vector3(-0.5, 1.7, 0.42).normalize(), new THREE.Vector3(-1, 0.32, -0.25).normalize(), new THREE.Vector3(0.45, 1.2, -0.9).normalize()];
const _cc = new THREE.Color(), _dir = new THREE.Vector3();
const k3 = (n) => (n < 0.5 ? [0, n * 2] : [1, n * 2 - 1]);
function col3(arr, n, out) { const [i, t] = k3(n); return out.copy(arr[i]).lerp(arr[i + 1], t); }
const num3 = (a, b, c, n) => { const [i, t] = k3(n); return i ? lerp(b, c, t) : lerp(a, b, t); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function updateCycle(dt) {
  CYC.t += dt; CYC.tod = CYC.pin !== null ? CYC.pin : (CYC.t / CYC.len) % 1;
  const n = CYC.n = 0.5 - 0.5 * Math.cos(CYC.tod * TAU); // 0 day .. 1 night
  col3(PALK.top, n, SKY.U.top.value); col3(PALK.mid, n, SKY.U.mid.value); col3(PALK.hor, n, SKY.U.hor.value); SKY.U.uStars.value = sstep(0.62, 0.92, n);
  col3(PALK.fog, n, scene.fog.color); FOGC.copy(scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far; renderer.setClearColor(scene.fog.color); scene.fog.near = num3(40, 30, 16, n); scene.fog.far = num3(150, 125, 85, n);
  col3(PALK.hs, n, hemi.color); col3(PALK.hg, n, hemi.groundColor); hemi.intensity = num3(1.45, 0.85, 0.32, n);
  col3(PALK.sun, n, sun.color); sun.intensity = num3(2.1, 1.25, 0.45, n);
  const [i, t] = k3(n); _dir.copy(DIRK[i]).lerp(DIRK[i + 1], t).normalize(); SUN_DIR.copy(_dir);
  SKY.sunS.position.copy(i ? DIRK[1] : _dir).multiplyScalar(70); SKY.sunS.material.opacity = 1 - sstep(0.45, 0.65, n);
  SKY.moonS.position.copy(DIRK[2]).multiplyScalar(70); SKY.moonS.material.opacity = sstep(0.5, 0.8, n);
  col3(PALK.cloud, n, _cc); for (const c of SKY.clouds) c.material.color.copy(_cc);
  // night: windows light up, street lamps switch on (orange glow pools + halos + point lights), the BINGO neon buzzes on
  NIGHT.value = sstep(0.32, 0.62, n); abNight(NIGHT.value);
  const on = CYC.lamps = sstep(0.38, 0.56, n);
  NIGHTFX.pools.forEach((q, k) => { q.material.opacity = on * 0.8; q.visible = on > 0.01; });
  NIGHTFX.halos.forEach((h) => { h.material.opacity = on; h.visible = on > 0.01; });
  NIGHTFX.lights.forEach((l) => { l.intensity = on * 16; });
  FILL.intensity = on * 3.2; FILL.position.copy(camera.position); FILL.position.y += 1.2; // a soft camera-side fill so the old folks read at night
  const fl = on > 0.5 && Math.sin(CYC.t * 23) > 0.93 ? 0.55 : 1; // the odd neon flicker
  const mins = Math.floor(((12 + CYC.tod * 24) % 24) * 60 / 10) * 10; if (mins !== CYC.mins) { CYC.mins = mins; const h = Math.floor(mins / 60), m = mins % 60;
    $('clock').textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  NIGHTFX.neon.tint(on, on > 0.01 ? fl : 1); NIGHTFX.neon.light.intensity = on * 14 * fl;
}
// ---------------- city HUD: landmark name popup + minimap (the harbour, landmark dots, the heroes, thugs nearby) ----------------
const CITY = { lmk: null, lmkT: 0, nearT: 0, mapT: 0, visited: new Set(), log: [] };
const MAP = (function () {
  const c = $('mmap'); if (!c) return null; const W = 150, H = 92, k = W / (WB.x1 - WB.x0 + 20);
  c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); const bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height; const b = bg.getContext('2d');
  const X = (x) => (x - WB.x0 + 10) * k * 2, Z = (z) => (z - WB.z0 + 6) * k * 2;
  b.fillStyle = '#3a3a40'; b.fillRect(0, 0, bg.width, bg.height);
  b.fillStyle = '#6a665e'; for (const p of PLOTS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#2f6f96'; b.fillRect(X(BASIN.x0), Z(BASIN.z0), (BASIN.x1 - BASIN.x0) * k * 2, (BASIN.z1 - BASIN.z0) * k * 2);
  b.fillStyle = '#a8705a'; for (const p of PIERS) b.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k * 2, (p.z1 - p.z0) * k * 2);
  b.fillStyle = '#ffe08a'; for (const L of LANDMARKS) { b.beginPath(); b.arc(X(L.x), Z(L.z), 3.2, 0, TAU); b.fill(); }
  return { c, g, bg, X, Z };
})();
function cityHud(rdt) {
  CITY.nearT -= rdt; if (CITY.nearT <= 0) { CITY.nearT = 0.25; NIGHTFX.near(hero.pos.x, hero.pos.z); rigLod();
    let best = null, bd = 1e9; for (const L of LANDMARKS) { const d = Math.hypot(L.x - hero.pos.x, L.z - hero.pos.z); if (d < L.r && d < bd) { bd = d; best = L; } }
    if (best !== CITY.lmk) { CITY.lmk = best; if (best) { $('lmk').textContent = best.name; $('lmk').classList.add('on'); CITY.lmkT = 3.2; if (!CITY.visited.has(best.id)) { CITY.visited.add(best.id); CITY.log.push(best.id + '@' + S.time.toFixed(1)); } } } }
  if (APANEL) { const c = actContext(); APANEL.setAct(c, c && c.kind === 'power' ? 1 - POWER.cd / POWER.CD : 1); }
  if (CITY.lmkT > 0) { CITY.lmkT -= rdt; if (CITY.lmkT <= 0) $('lmk').classList.remove('on'); }
  if (MAP) { CITY.mapT -= rdt; if (CITY.mapT <= 0) { CITY.mapT = 0.1; const { g, bg, X, Z } = MAP; g.drawImage(bg, 0, 0);
    g.fillStyle = '#ff3d6e'; for (const e of enemies) if (e.alive && e.state !== 'dying' && Math.hypot(e.pos.x - hero.pos.x, e.pos.z - hero.pos.z) < 60) g.fillRect(X(e.pos.x) - 2, Z(e.pos.z) - 2, 4, 4);
    g.fillStyle = '#ff9ad0'; g.beginPath(); g.arc(X(partner.pos.x), Z(partner.pos.z), 3, 0, TAU); g.fill();
    const hx = X(hero.pos.x), hz = Z(hero.pos.z), a = hero.yaw; g.fillStyle = '#9dff6b'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath();
    g.moveTo(hx + Math.sin(a) * 9, hz + Math.cos(a) * 9); g.lineTo(hx + Math.sin(a + 2.5) * 6, hz + Math.cos(a + 2.5) * 6); g.lineTo(hx + Math.sin(a - 2.5) * 6, hz + Math.cos(a - 2.5) * 6); g.closePath(); g.fill(); g.stroke(); } }
}
const FPS = { v: 60, n: 0, t: 0 };
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
    FPS.n++; FPS.t += rdt; if (FPS.t > 1) { FPS.v = Math.round(FPS.n / FPS.t); FPS.n = 0; FPS.t = 0; }
    if (window.__cel && __cel.pause) { draw(); return; }
    if (BOT) botThink(rdt);
    readInput(); gateInput();
    if (POSE) { poseView(rdt); updateCycle(rdt); draw(); return; }
    // ?sim=N runs N fixed 1/60 s steps per rendered frame (headless tests on a slow software GPU)
    const steps = SIM ? SIM : 1;
    for (let k = 0; k < steps; k++) {
      if (SIM) rdt = 1 / 60;
      if (BOT && k > 0) botThink(rdt);
      if (k > 0) { readInput(); gateInput(); }
      let dt = rdt; if (S.hitstop > 0) { S.hitstop -= rdt; dt = rdt * 0.06; }
      S.time += dt;
      countAttackers();
      POWER.cd = Math.max(0, POWER.cd - dt);
      updateHero(dt);
      updatePartner(dt);
      for (const e of enemies) { // thugs far from the heroes sleep (hidden, not simulated) to keep draw calls + CPU down on phones
        const d2 = (e.pos.x - hero.pos.x) ** 2 + (e.pos.z - hero.pos.z) ** 2;
        if (d2 > 48 * 48 && (e.state === 'idle' || e.state === 'return')) { e.root.visible = false; e.hpS.visible = false; continue; }
        if (!e.root.visible && e.state !== 'dead') e.root.visible = true;
        updateEnemy(e, dt); }
      separate();
      if (k < steps - 1) { updateSprites(rdt); updateSlashes(rdt); PRESS.clear(); camStep(dt, rdt); }
    }
    const dt = rdt;
    // soft lock target (for the ring + camera framing)
    let dx = Math.sin(hero.yaw), dz = Math.cos(hero.yaw);
    if (IN.mx || IN.my) { const f = camFwd(CAM.yaw), r = [-f[1], f[0]]; dx = r[0] * IN.mx + f[0] * IN.my; dz = r[1] * IN.mx + f[1] * IN.my; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const cand = pickTarget(dx, dz, 6.5);
    lockT = CINE_ST.has(hero.state) || hero.roof ? null : cand && cand.state !== 'idle' && cand.state !== 'return' ? cand : (lockT && lockT.alive && lockT.state !== 'dying' && Math.hypot(lockT.pos.x - hero.pos.x, lockT.pos.z - hero.pos.z) < 8 && lockT.state !== 'return' ? lockT : null);
    lockRing.visible = !!lockT;
    if (lockT) { lockRing.position.set(lockT.pos.x, lockT.pos.y + 0.03, lockT.pos.z); lockRing.scale.setScalar(lockT.scale); lockRing.userData.b.rotation.z += rdt * 3; }
    camStep(dt, rdt);
    // sun + shadow camera follow the hero (snapped to shadow texels to stop shimmering)
    const tx = SHR * 2 / SHM, sx = Math.round(hero.pos.x / tx) * tx, sz = Math.round(hero.pos.z / tx) * tx;
    sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 70, SUN_DIR.y * 70, sz + SUN_DIR.z * 70);
    window.__sky.position.copy(camera.position);
    updateSprites(rdt); updateSlashes(rdt); hud(rdt);
    if (bannerT > 0) { bannerT -= rdt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    cineUpdate(rdt);
    updateCycle(SIM ? rdt * SIM : rdt);
    cityHud(rdt);
    PRESS.clear();
    draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, partner, PART, BOOST_P, hurtTurtle, reviveTurtle, partnerSlot, get KEYS() { return KEYS; }, enemies, CAM, BOTR, FPS, IN, renderer, CINE, ACTIONS, DOOR, PIZZA, LADDER, ROOF, get QTE() { return QTE; }, get lockT() { return lockT; }, press: (k) => PRESS.add(k), tryAction, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene, CYC, LOW, NIGHTFX, draw, QUAL, setHD, LANDMARKS, CITY, POWER, WATERK, startDrown, actContext, APANEL, MANHOLES, CLIMBS, VEHICLES, RIDE, isWater, groundY, WB, COLL, BLD, PIERS, POSTS, CARS, WATER, AB, ABHOOKS, K_AB, AB_A, AB_B, ABV: { buildCarSedan, buildCarHatch, buildCarWagon, buildCarMinivan, buildCarPickup, buildCarCab, buildBoxTruck, buildParkedCar, buildArabberCart, buildCrabShack, buildRowBlock, buildRowhouse, buildCornerBar, buildCornerShop, buildLampAcorn, buildTrashCan, buildBenchPark, buildManhole, abCityOut, abMakeOut } };
// ---------------- B-MORE 410 RADIO: music like a radio station, full credit up top like a station ID (Brad, DESIGN.md "Night radio" / "Day radio" / "Radio stations").
// Plays through the official YouTube IFrame Player API (no audio is downloaded or shipped). Creative Commons Baltimore club tracks (Ducky Dynamo, DJ AyyMello)
// play from the artists' official YouTube uploads; if YouTube refuses one (embed error / no signal) that same track plays through Bandcamp's official
// embedded player instead ("bandcamp" source: no JS API, so the box says TAP ▶ TO PLAY and a timer set to the track length moves on). Audio is never edited.
// Stations (GTA-style dial, any time): AUTO (default: DAY by day, NIGHT by night, switched at dusk / dawn with a crossfade), B-MORE 410 DAY, B-MORE 410 NIGHT,
// DUCKY DYNAMO FM (all the CC tracks), LOR BITEWHO ([FREE] beats), B-MORE CLUB + B-MORE RAP (Brad's 30 Baltimore classics), OFF. The choice is kept in localStorage. Every switch shows the station-ID card with the full credit.
// Controls (all in the slim top bar): ⏮ / station / ⏭ / CR (credits list); tap the station = next station, long-press = off/on;
// keys N = next track, B = previous track, T = next station, M or a short tap of R = off/on (holding R still turns the camera).
// No visible video (Brad 2026-10-11 09:06): the YouTube iframe is 2x2 px, opacity .01, pointer-events:none, behind everything; controls=0, fs=0, disablekb=1,
// allow="autoplay" only. Starts on the first tap / keypress with the title track. The station-ID card drops from the bar on every switch.
// ?radio=0 disables it, ?radiotest=1 swaps the YouTube player for a stub (headless logic checks), ?radiobc=1 forces the Bandcamp player for the CC tracks.
// B-MORE 410 REMIX (Brad 2026-10-11: "make a remix channel the default channel ... each song plays the most played 20 seconds ... then remixes into the next"):
// first on the dial and the default. Shuffles Brad's 30 Baltimore classics (no repeats until all 30 have played), plays a 20 s clip of each from its peak start
// (REMIX_PEAK, baked offline by radio/remix_heatmap.py from YouTube's Most Replayed heatmap; never scraped at runtime), then crossfades into the next clip.
// Two hidden audio-only players: the next clip is preloaded muted at its peak, and the last 3 s run an equal-power crossfade with a short tape-drag
// (playbackRate 0.5) on the outgoing clip. iOS Safari ignores setVolume and lets one page play one audible stream, so on iOS one player hard-cuts
// clip to clip with a fast seek ("play to play"). ?remix1=1 forces the one-player mode, ?remix2=1 the two-player mode, ?remixclip=N shortens clips (tests), ?radiolog=1 logs clips to the console.
// Test hook: window.__radio ----------------
const RADIO = (function () {
  if (Q.get('radio') === '0') return null;
  const BYND = ['CC BY-ND 4.0', 'https://creativecommons.org/licenses/by-nd/4.0/'], BYNCND = ['CC BY-NC-ND 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/'];
  const cc = (id, title, tag, artist, lic, src, bc, len) => ({ id, title, tag, artist, prod: '', lic: lic[0], licUrl: lic[1], src, yt: 'https://youtu.be/' + id, bc, len });
  const lb = (id, title) => ({ id, title, tag: '', artist: '', prod: 'Lor Bitewho (@OneBiteBeats)', yt: 'https://youtu.be/' + id });
  const yt = (id, title, artist) => ({ id, title, tag: '', artist, prod: '', yt: 'https://youtu.be/' + id });
  const T = {
    syc: cc('g9-ZkYiEUdo', 'Select Your Character', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/select-your-character-baltimore-club', 429017724, 159),
    bullet: cc('l3mVHdpItYg', 'Baltimore Bullet', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/baltimore-bullet-baltimore-club-2', 2173550732, 155),
    crash: cc('FtE6FiaJB5I', 'Completely Valid Crash Out', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/completely-valid-crash-out-baltimore-club', 813921011, 163),
    cock: cc('0T4x4sAf0eE', 'Cockback', 'Baltimore Club', 'Ducky Dynamo', BYND, 'https://duckydynamo.bandcamp.com/track/cockback-baltimore-club', 511392191, 153),
    para: cc('atMQ7h_1J9g', '3AM in The Paradox', 'Baltimore Club Music', 'DJ AyyMello feat. Ducky Dynamo', BYNCND, 'https://ayymello.bandcamp.com/track/3am-in-the-paradox-feat-ducky-dynamo-baltimore-club-music', 2891386594, 208),
    // Lor Bitewho (@OneBiteBeats) [FREE] Baltimore type beats, official uploads on his channel; credit: "TITLE" · prod. Lor Bitewho (@OneBiteBeats)
    icant: lb('BJlNLNNzNZo', "I Can't"), hood: lb('Tu_WQLMzdu8', 'Hood Raised'), back: lb('bOkdSXQuYPM', 'Back Street'), war: lb('nyxnsGp4ilI', 'WAR READY'),
    took: lb('ckZEi0DIeyk', 'TOOK CONTROL'), run: lb('ggNVhuKhYuQ', 'On The Run'), every: lb('IjuK4VVuTHI', 'Everything I Wanted'), anthem: lb('mUCm7MZGRKY', 'Block Anthem'),
    playa: { id: 'nEUiAHAm60o', title: 'playa shh', tag: '', artist: 'NASG CHAZ', prod: 'DC 1-30', yt: 'https://youtu.be/nEUiAHAm60o' },
    // Brad's Baltimore classics (2026-10-11 09:16, radio/baltimore_classics_brad.md): exactly his 30, his titles / artists, credited "TITLE" · ARTIST, ranked
    c1: yt('quUSjngSmN0', 'Dance My Pain Away', 'Rod Lee'), c2: yt('qEnptXwZSfo', 'How U Wanna Carry It', 'Miss Tony'), c3: yt('1zRb_WNEeaw', 'Doo Doo Brown', '2 Hyped Brothers & A Dog'),
    c4: yt('rvZWAEDI6bY', 'Whores in This House', 'Frank Ski'), c5: yt('1kbwFhD597Q', "I'm the Ish", 'DJ Class'), c6: yt('gXVaIiexbRk', 'Bank Roll', 'Tim Trees'),
    c7: yt('u2hse3dRJZ8', 'Bring in the Katz', 'KW Griff ft. Pork Chop'), c8: yt('gVCCuHMRpco', 'Oh (B-More Anthem)', 'Bossman'), c9: yt('l_xzOk0w3qU', 'Watch Out for the Big Girl', 'DJ Booman & Jimmy Jones'),
    c10: yt('BbXklS6t4AM', 'Bird Flu', 'Lor Scoota'), c11: yt('RT0GKX-Pfkg', 'Bank Rolls (Remix)', 'Tate Kobang'), c12: yt('9WyLkGp9eM0', 'Bitchuary', 'Shordie Shordie'),
    c13: yt('fHAigWTZioI', 'Shake It to the Ground', 'Blaqstarr & Rye Rye'), c14: yt('BWpbV-DrI_0', 'Slide To The Left', 'K-Swift'), c15: yt('GI7wtAZaXXs', 'Posted', 'Young Moose'),
    c16: yt('mze0GuD2k6c', 'Money Man', 'Peso Da Mafia'), c17: yt('Av5jyGX2yE8', 'Hands Up Thumbs Down', 'Blaqstarr'), c18: yt('SrYcZfalGjI', "Samir's Theme", 'Debonair Samir'),
    c19: yt('kUlr1WLU6ys', 'Girlfriend', 'DJ Technics'), c20: yt('f32eCeneIbY', 'One Wish', 'Shordie Shordie'), c21: yt('7Z3ExxAPSF8', 'Shining', 'YBS Skola'),
    c22: yt('_Dru5adhPjU', 'Dumb Dumb', 'Young Moose'), c23: yt('KKIunI_nlKg', 'BBB', 'Bandhunta Izzy ft. BB Sleepy'), c24: yt('jovjP6StSWU', 'Might Not Miss', 'YG Teck'),
    c25: yt('Svmcd4uvkiY', 'Whole Lotta Money', 'YBS Skola'), c26: yt('8pWftkom4_I', 'War', 'YGG Tay'), c27: yt('RknlZpl-VpM', 'War', 'King Los ft. Marsha Ambrosius'),
    c28: yt('V16BdeeA4YY', 'North North', 'Tate Kobang'), c29: yt('uwl1zto209M', 'Bmore Is The Livest Town', 'Mighty Mark'), c30: yt('XIs3B_CL0l8', 'Bad Sista', 'Mighty Mark ft. TT the Artist'),
  };
  const TITLE = T.syc; // the title / tune-in track
  const TRACKS = { day: [T.syc, T.icant, T.bullet, T.back, T.anthem], night: [T.playa, T.hood, T.crash, T.cock, T.para, T.war, T.run],
    ducky: [T.syc, T.bullet, T.crash, T.cock, T.para], lor: [T.icant, T.hood, T.back, T.war, T.took, T.run, T.every, T.anthem],
    club: [T.c1, T.c2, T.c3, T.c4, T.c5, T.c7, T.c9, T.c13, T.c14, T.c17, T.c18, T.c19, T.c29, T.c30],
    rap: [T.c6, T.c8, T.c10, T.c11, T.c12, T.c15, T.c16, T.c20, T.c21, T.c22, T.c23, T.c24, T.c25, T.c26, T.c27, T.c28] };
  // ---- REMIX: peak start per track (seconds). A number = heatmap peak (best 20 s window by summed intensityScoreNormalized). null = FALLBACK: no heatmap could be
  // fetched at build time (2026-10-11: youtube.com answered the build box with HTTP 429 / google.com/sorry for every watch page, see radio/remix_heatmap.log), so the
  // clip starts 35% into the track (at least 30 s in, past the intro; at most length - 25 s), worked out from player.getDuration() once the track loads (45 s until then).
  // Re-run radio/remix_heatmap.py from an unblocked machine and paste radio/remix_peaks.json here to replace the fallbacks.
  const REMIX_PEAK = {
    quUSjngSmN0: null, qEnptXwZSfo: null, '1zRb_WNEeaw': null, rvZWAEDI6bY: null, '1kbwFhD597Q': null, gXVaIiexbRk: null, u2hse3dRJZ8: null, gVCCuHMRpco: null, // fallback (no heatmap)
    l_xzOk0w3qU: null, BbXklS6t4AM: null, 'RT0GKX-Pfkg': null, '9WyLkGp9eM0': null, fHAigWTZioI: null, 'BWpbV-DrI_0': null, GI7wtAZaXXs: null, mze0GuD2k6c: null, // fallback
    Av5jyGX2yE8: null, SrYcZfalGjI: null, kUlr1WLU6ys: null, f32eCeneIbY: null, '7Z3ExxAPSF8': null, _Dru5adhPjU: null, KKIunI_nlKg: null, jovjP6StSWU: null, // fallback
    Svmcd4uvkiY: null, '8pWftkom4_I': null, 'RknlZpl-VpM': null, V16BdeeA4YY: null, uwl1zto209M: null, XIs3B_CL0l8: null, // fallback
  };
  // Pool: Brad's 30 Baltimore classics only (Baltimore artists, already in the radio). The CC BY-ND / BY-NC-ND tracks stay off REMIX (ND = no adaptations, and a
  // crossfaded excerpt mix could count as one); Lor Bitewho / NASG CHAZ are left out because their Baltimore origin isn't confirmed.
  const POOL = [T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.c7, T.c8, T.c9, T.c10, T.c11, T.c12, T.c13, T.c14, T.c15, T.c16, T.c17, T.c18, T.c19, T.c20, T.c21, T.c22, T.c23, T.c24, T.c25, T.c26, T.c27, T.c28, T.c29, T.c30];
  const shuffle = (a, avoid) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (avoid && a[0] === avoid && a.length > 1) [a[0], a[a.length - 1]] = [a[a.length - 1], a[0]]; return a; };
  TRACKS.remix = shuffle(POOL.slice());
  const STATIONS = ['remix', 'auto', 'day', 'night', 'ducky', 'lor', 'club', 'rap', 'off'];
  const SNAME = { remix: 'B-MORE 410 REMIX', auto: 'AUTO', day: 'B-MORE 410 DAY', night: 'B-MORE 410 NIGHT', ducky: 'DUCKY DYNAMO FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const SSHORT = { remix: 'REMIX', auto: 'AUTO', day: 'DAY', night: 'NIGHT', ducky: 'DUCKY FM', lor: 'LOR BITEWHO', club: 'B-MORE CLUB', rap: 'B-MORE RAP', off: 'OFF' };
  const ICON = '<svg class="ric" viewBox="0 0 24 18" aria-label="radio"><path d="M6 4 L17 0.8" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="1" y="4" width="22" height="13" rx="2.5" fill="currentColor"/><circle cx="7" cy="11" r="3.6" fill="#120a22"/><circle cx="7" cy="11" r="1.3" fill="currentColor"/><rect x="13" y="7" width="7.5" height="3" rx="1" fill="#120a22"/><circle cx="15" cy="13.6" r="1.2" fill="#120a22"/><circle cx="18.6" cy="13.6" r="1.2" fill="#120a22"/></svg>';
  // ⏮ / ⏭ as inline SVG (the emoji / symbol glyphs are missing on some devices)
  const PREV = '<svg class="rsv" viewBox="0 0 20 14" aria-hidden="true"><rect x="1" y="1" width="2.6" height="12" fill="currentColor"/><path d="M11 1 L3.6 7 L11 13Z M19 1 L11.6 7 L19 13Z" fill="currentColor"/></svg>';
  const NEXT = '<svg class="rsv" viewBox="0 0 20 14" aria-hidden="true"><path d="M1 1 L8.4 7 L1 13Z M9 1 L16.4 7 L9 13Z" fill="currentColor"/><rect x="16.4" y="1" width="2.6" height="12" fill="currentColor"/></svg>';
  const STATION = 'B-MORE 410 RADIO', VOL = 70, FADE = 1.6, BIG_S = 5, LONG_MS = 550, LS = 'tcb_radio_station2'; // new key with REMIX: everyone starts on the new default once, then the dial is remembered
  const TEST = Q.has('radiotest'), FORCE_BC = Q.get('radiobc') === '1';
  let saved = null; try { saved = localStorage.getItem(LS); } catch (e) {}
  const st0 = STATIONS.includes(saved) ? saved : 'remix';
  const R = { station: st0, lastSt: st0 === 'off' ? 'remix' : st0, on: st0 !== 'off', started: false, ready: false, playing: false, list: null, idx: { remix: -1, day: -1, night: -1, ducky: -1, lor: -1, club: -1, rap: -1 }, cur: null,
    vol: 0, goal: 0, after: null, bad: new Set(), ytFail: new Set(), log: [], offAir: false, player: null, bigT: 0, ids: 0, test: TEST, bc: null, bcLeft: 0, bcTapped: false, noSignal: false };

  // ---- DOM + CSS (self-contained). No visible video: the YouTube iframe sits in a 2x2 px, opacity .01, pointer-events:none box behind
  // everything (audio only); the only radio UI is the top bar (credit ticker + ⏮ / station / ⏭ / CR) and the station-ID card that drops from it ----
  const css = document.createElement('style');
  css.textContent = `
  #rid { position: fixed; z-index: 59; left: 0; right: 0; top: 0; height: calc(env(safe-area-inset-top, 0px) + 28px); padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
    box-sizing: border-box; display: flex; align-items: center; gap: 4px; pointer-events: none;
    background: linear-gradient(#1b1030, #120a22); border-bottom: 2px solid #000; box-shadow: 0 2px 0 rgba(255,61,110,.55); }
  #ridt { flex: 1; min-width: 0; height: 26px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;
    font: 800 11px/26px system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .3px; color: #fff; }
  #ridt span { display: inline-block; padding-left: 8px; }
  #ridt b { color: #ffd23c; font-weight: 900; } #ridt i { color: #ff9ad0; font-style: normal; } #ridt u { color: #8fe8ff; text-decoration: none; } #ridt em { color: #7dffb0; font-style: normal; font-weight: 900; }
  #ridt.scroll span { animation: ridm var(--dur, 18s) linear 1.5s infinite; }
  @keyframes ridm { 0%, 6% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .ric { width: 1.35em; height: 1em; vertical-align: -0.12em; color: #ffd23c; display: inline-block; }
  .rsv { width: 1.25em; height: .9em; vertical-align: -0.08em; display: inline-block; }
  #rctl { flex: none; display: flex; gap: 3px; padding-right: 4px; pointer-events: auto; }
  #rctl button { all: unset; cursor: pointer; box-sizing: border-box; height: 22px; min-width: 28px; padding: 0 5px; border-radius: 5px; border: 1px solid #000; box-shadow: inset 0 0 0 1px #5a4a80;
    background: #2a1650; color: #ffd23c; text-align: center; font: 900 12px/20px system-ui, sans-serif; white-space: nowrap; touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #rctl #rst { background: #ff9ad0; color: #14101f; font: 7px/20px 'PX', monospace; max-width: 34vw; overflow: hidden; text-overflow: ellipsis; }
  #rctl #rst .ric { color: #14101f; } #rid.off #rctl #rst:not(.hold) { background: #777; color: #eee; } #rid.off .rsk { opacity: .4; }
  #rctl #rst.hold { background: #ff3d6e; color: #fff; }
  #rctl #rcrb { font-size: 9px; color: #8fe8ff; }
  #rctl button:active { background: #ff3d6e; color: #fff; }
  body.touch #rid { height: calc(env(safe-area-inset-top, 0px) + 30px); } body.touch #rctl button { height: 26px; min-width: 32px; line-height: 24px; }
  body.radio #proto { top: calc(env(safe-area-inset-top, 0px) + 36px); } body.radio #hpbox { top: calc(env(safe-area-inset-top, 0px) + 38px); }
  body.radio #mmap { top: calc(env(safe-area-inset-top, 0px) + 64px); } body.radio #clock { top: calc(env(safe-area-inset-top, 0px) + 126px); }
  body.radio #qbtn { top: calc(env(safe-area-inset-top, 0px) + 142px); }
  #ridc { position: fixed; z-index: 61; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 34px); width: min(560px, calc(100vw - 16px)); box-sizing: border-box; pointer-events: none;
    transform: translate(-50%, -150%); opacity: 0; transition: transform .45s cubic-bezier(.2,1.4,.4,1), opacity .3s; padding: 9px 12px 10px; text-align: center;
    background: linear-gradient(#2a1650, #160c2c); border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; color: #fff; }
  #ridc.on { transform: translate(-50%, 0); opacity: 1; }
  #ridc .st { font: 10px/1.4 'PX', monospace; color: #ffd23c; text-shadow: 2px 2px 0 #000; letter-spacing: 1px; }
  #ridc .sh { font: 800 10px/1.6 system-ui, sans-serif; letter-spacing: 3px; color: #8fe8ff; }
  #ridc .np { font: 900 16px/1.25 system-ui, -apple-system, sans-serif; margin-top: 3px; text-shadow: 2px 2px 0 #000; }
  #ridc .cr { font: 800 13px/1.35 system-ui, sans-serif; color: #ffb3dc; margin-top: 2px; text-shadow: 1px 1px 0 #000; }
  #ridc .lc { font: 700 11px/1.35 system-ui, sans-serif; color: #c9f3ff; margin-top: 2px; word-break: break-all; }
  #ridc .lc:empty { display: none; }
  #rplay { position: fixed; left: 0; bottom: 0; width: 2px; height: 2px; overflow: hidden; opacity: .01; pointer-events: none; z-index: -1; }
  #rplay iframe, #rplay > div { width: 2px !important; height: 2px !important; border: 0; pointer-events: none; }
  #rbcw { display: none; position: fixed; z-index: 58; right: 6px; bottom: calc(var(--panel, 0px) + 8px); /* only for a Bandcamp fallback item: above the arcade panel, clear of the top HUD */ width: min(360px, calc(100vw - 12px)); box-sizing: border-box; padding: 4px;
    background: #120a22; border: 2px solid #000; box-shadow: 3px 3px 0 #000; pointer-events: auto; }
  #rbcw.on { display: block; }
  #rbcw b { display: block; font: 9px/1.5 'PX', monospace; color: #ffd23c; text-align: center; animation: rblink 1s steps(2) infinite; }
  #rbcw.tapped b { animation: none; color: #8fe8ff; }
  @keyframes rblink { 50% { opacity: .35; } }
  #rbcw iframe, #rbcw .rbcstub { width: 100%; height: 42px; border: 0; display: block; }
  #rbcw .rbcstub { display: flex; align-items: center; justify-content: center; font: 800 11px/1.3 system-ui, sans-serif; color: #ccc; background: repeating-linear-gradient(45deg,#181818 0 8px,#202020 8px 16px); }
  #rcred { position: fixed; z-index: 72; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, calc(100vw - 20px)); max-height: min(560px, calc(100vh - 60px)); overflow: auto;
    box-sizing: border-box; padding: 10px 12px 12px; background: #160c2c; color: #fff; border: 3px solid #000; box-shadow: 4px 4px 0 #000, inset 0 0 0 2px #ff3d6e; font: 600 12px/1.4 system-ui, sans-serif; }
  #rcred.hide { display: none; }
  #rcred h3 { margin: 0 0 6px; font: 11px/1.4 'PX', monospace; color: #ffd23c; display: flex; justify-content: space-between; align-items: center; }
  #rcred h3 button { all: unset; cursor: pointer; padding: 3px 8px; background: #ff3d6e; color: #fff; border: 2px solid #000; font: 900 12px/1 system-ui, sans-serif; }
  #rcred li { margin: 0 0 7px; } #rcred ul { margin: 0; padding-left: 16px; } #rcred a { color: #8fe8ff; word-break: break-all; } #rcred .t { font-weight: 900; } #rcred .m { color: #ffb3dc; }
  #rcred p { margin: 6px 0 0; color: #bbb; font-size: 11px; }
  @media (max-width: 480px) { #ridc .np { font-size: 14px; } #ridc .cr { font-size: 12px; } #ridt { font-size: 10px; } }`;
  document.head.appendChild(css);
  const el = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const bar = el('div', 'rid', '<div id="ridt"><span></span></div><div id="rctl"><button class="rsk" id="rprev" type="button" title="previous track (B)" aria-label="previous track">' + PREV + '</button>'
    + '<button id="rst" type="button" title="tap: next station (T) · hold: radio off/on (M)"></button><button class="rsk" id="rnext" type="button" title="next track (N)" aria-label="next track">' + NEXT + '</button>'
    + '<button id="rcrb" type="button" title="radio credits" aria-label="radio credits">CR</button></div>');
  const card = el('div', 'ridc', '<div class="st"></div><div class="sh"></div><div class="np"></div><div class="cr"></div><div class="lc"></div>');
  const rplay = el('div', 'rplay'); rplay.setAttribute('aria-hidden', 'true');
  const bcw = el('div', 'rbcw', '<b>TAP ▶ TO PLAY</b>');
  const cred = el('div', 'rcred'); cred.classList.add('hide');
  document.body.classList.add('radio');
  const tickerS = bar.querySelector('#ridt'), tickerSpan = tickerS.querySelector('span');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const who = (t) => (t.artist ? t.artist : '') + (t.prod ? (t.artist ? ' · ' : '') + 'prod. ' + t.prod : '');
  const credit = (t) => `"${t.title}"${t.tag ? ` (${t.tag})` : ''} · ${who(t)}${t.lic ? ` · ${t.lic}` : ''}`;
  const isBC = (t) => !!(t && t.bc && (FORCE_BC || R.ytFail.has(t.id) || R.noSignal));
  const stName = () => (R.station === 'auto' ? (R.list === 'night' ? SNAME.night : SNAME.day) + ' (AUTO)' : SNAME[R.station]);
  const idText = (t) => `📻 ${STATION} · ${stName()} · NOW PLAYING: ${credit(t)}`;
  const srcLine = (t) => (t.lic ? `${t.lic} · ${(isBC(t) ? t.src : t.yt).replace('https://', '')}` : `YouTube · ${t.yt.replace('https://', '')}`);

  // ---- credits list (title, artist, licence + link, source) ----
  cred.innerHTML = `<h3><span>RADIO CREDITS</span><button type="button" id="rcrx">CLOSE</button></h3><ul>${[...new Set(Object.values(TRACKS).flat())].map((t) =>
    `<li><span class="t">"${esc(t.title)}"${t.tag ? ` (${esc(t.tag)})` : ''}</span> · <span class="m">${esc(who(t))}</span><br>${t.lic
      ? `Licence: <a href="${t.licUrl}" target="_blank" rel="noopener">${t.lic}</a> · Source: <a href="${t.src}" target="_blank" rel="noopener">${esc(t.src.replace('https://', ''))}</a> · YouTube: <a href="${t.yt}" target="_blank" rel="noopener">${t.yt.replace('https://', '')}</a>`
      : `YouTube upload, played through the YouTube embed (not shipped with the game): <a href="${t.yt}" target="_blank" rel="noopener">${t.yt.replace('https://', '')}</a>`}</li>`).join('')}</ul>
    <p>Creative Commons tracks are played unedited from the artists' own YouTube / Bandcamp pages. No audio is shipped with the game. B-MORE 410 REMIX plays 20-second clips of Brad's Baltimore classics through the same YouTube embeds, crossfaded live in the player (nothing is cut or downloaded). Stations: B-MORE 410 REMIX, AUTO, B-MORE 410 DAY, B-MORE 410 NIGHT, DUCKY DYNAMO FM, LOR BITEWHO, B-MORE CLUB, B-MORE RAP.</p>`;
  const showCred = (on) => { cred.classList.toggle('hide', !on); R.credOpen = on; };

  let lastHtml = '';
  function setTicker(html, plain) {
    if (html === lastHtml) return; lastHtml = html; tickerSpan.innerHTML = html; R.tickerText = tickerSpan.textContent; tickerS.classList.remove('scroll');
    requestAnimationFrame(() => { if (tickerSpan.scrollWidth > tickerS.clientWidth - 8) { // too long for the strip: a seamless marquee (text, gap, text) that starts left-aligned
      tickerSpan.innerHTML = html + '<span style="display:inline-block;width:60px"></span>' + html; tickerS.style.setProperty('--dur', Math.max(12, plain.length * 0.26) + 's'); tickerS.classList.add('scroll'); } });
  }
  function render() {
    const t = R.cur; const lab = R.station === 'auto' ? 'AUTO·' + (R.list === 'night' ? 'NIGHT' : 'DAY') : SSHORT[R.station];
    $('rst').innerHTML = ICON + ' ' + (R.on ? lab : 'OFF'); bar.classList.toggle('off', !R.on);
    if (!t) return;
    if (R.offAir) { setTicker(`${ICON} <b>${STATION}</b> · <i>OFF AIR</i> · no track can be played right now`, 'off air'); return; }
    const cr = `"${esc(t.title)}"${t.tag ? ` (${esc(t.tag)})` : ''} · ${esc(who(t))}${t.lic ? ` · <u>${t.lic}</u>` : ''}`;
    let tip = '';
    if (R.on && !R.started) tip = 'TAP TO TUNE IN · ';
    else if (R.on && isBC(t) && !R.bcTapped) tip = 'TAP ▶ ON THE BANDCAMP PLAYER · ';
    if (!R.on) setTicker(`${ICON} <b>${STATION}</b> · <i>RADIO OFF</i> · tap the station button, press T / M or tap R to tune in`, 'radio off press to tune in');
    else setTicker(`${tip ? `<em>${tip}</em>` : ''}${ICON} <b>${STATION}</b> · <b>${esc(stName())}</b> · <i>NOW PLAYING:</i> ${cr}${isBC(t) ? ' · via Bandcamp' : ''}`, tip + idText(t));
  }
  function stationId(reason) { // the big card slides in, then it shrinks back to the slim ticker
    const t = R.cur; R.ids++;
    card.querySelector('.st').innerHTML = `${ICON} ${STATION}`;
    if (!R.on || !t) {
      card.querySelector('.sh').textContent = 'STATION DIAL'; card.querySelector('.np').textContent = 'RADIO OFF';
      card.querySelector('.cr').textContent = 'tap the station button or press T / M to tune back in'; card.querySelector('.lc').textContent = '';
    } else {
      card.querySelector('.sh').textContent = stName() + (reason === 'dusk' ? ' · DUSK' : reason === 'dawn' ? ' · DAWN' : '');
      card.querySelector('.np').textContent = `NOW PLAYING: "${t.title}"${t.tag ? ` (${t.tag})` : ''}`;
      card.querySelector('.cr').textContent = who(t);
      card.querySelector('.lc').textContent = srcLine(t);
    }
    card.classList.remove('on'); void card.offsetWidth; card.classList.add('on'); R.bigT = BIG_S;
    R.log.push({ at: +(S.time || 0).toFixed(2), reason, st: R.station, list: R.on ? R.list : 'off', id: t ? t.id : '', src: t && R.on ? (isBC(t) ? 'bc' : 'yt') : '', text: R.on && t ? idText(t) : 'RADIO OFF' });
    render();
  }

  // ---- playlist logic ----
  const nightNow = () => 0.5 - 0.5 * Math.cos((CYC.pin !== null ? CYC.pin : CYC.tod) * TAU) > 0.5; // dusk = tod .25, dawn = tod .75 on the game's loop
  const listFor = (st) => (TRACKS[st] ? st : nightNow() ? 'night' : 'day');
  const playable = (t) => !R.bad.has(t.id) && (t.bc || !(R.ytFail.has(t.id) || R.noSignal));
  function step(list, dir) { // next / previous playable track in a playlist; null if none can play
    const L = TRACKS[list]; for (let k = 1; k <= L.length; k++) { const raw = R.idx[list] + dir * k;
      if (list === 'remix' && dir > 0 && raw >= L.length) { const lastT = L[R.idx.remix] || null; shuffle(L, lastT); R.idx.remix = -1; R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'reshuffle', list: 'remix', id: '' }); return step(list, dir); } // all 30 played: new shuffle, never the same track twice in a row
      const i = ((raw % L.length) + L.length) % L.length; if (playable(L[i])) { R.idx[list] = i; return L[i]; } } return null;
  }
  // ---- Bandcamp embed (official player; no JS API) ----
  function clearBC() { R.bc = null; R.bcLeft = 0; R.bcTapped = false; bcw.classList.remove('on', 'tapped'); const f = bcw.querySelector('iframe, .rbcstub'); if (f) f.remove(); }
  function showBC(t) {
    clearBC(); R.bc = t; R.bcLeft = t.len + 4;
    if (!R.on || !R.started) return; bcw.classList.add('on'); // the frame is added once the radio is on and tuned in
    let f;
    if (TEST) { f = document.createElement('div'); f.className = 'rbcstub'; f.textContent = 'Bandcamp player (test stub) ' + t.bc; }
    else { f = document.createElement('iframe'); f.title = `${t.title} by ${t.artist} (Bandcamp)`; f.setAttribute('seamless', ''); f.allow = 'autoplay';
      f.src = `https://bandcamp.com/EmbeddedPlayer/size=small/bgcol=333333/linkcol=ffd23c/transparent=true/track=${t.bc}/`; }
    bcw.appendChild(f);
  }
  addEventListener('blur', () => { setTimeout(() => { const f = bcw.querySelector('iframe'); if (f && document.activeElement === f && R.bc && !R.bcTapped) { R.bcTapped = true; R.bcLeft = R.bc.len + 2; bcw.classList.add('tapped'); bcw.querySelector('b').textContent = 'ON AIR · ' + R.bc.title; duck(true); render(); } }, 0); });
  function stopYT() { rxCancel(); try { if (R.player && R.ready) R.player.pauseVideo(); } catch (e) {} R.playing = false; }
  function play(t, reason) { // put a track on the air (YouTube, or the Bandcamp embed for a CC track YouTube refused)
    R.cur = t; clearBC(); bcw.querySelector('b').textContent = 'TAP ▶ TO PLAY';
    if (R.list === 'remix') rxClip(t); else rxCancel();
    if (isBC(t)) { stopYT(); duck(false); showBC(t); }
    else if (R.player && R.ready) {
      try { if (R.started && R.on) { R.vol = 0; R.player.setVolume(0); R.goal = VOL; R.player.loadVideoById(vid(t)); } else R.player.cueVideoById(vid(t)); } catch (e) {}
    }
    if (R.list === 'remix' && /^(remix|next|prev|skip)$/.test(reason)) clipCredit(t, reason); else stationId(reason);
    if (R.list === 'remix' && R.started && R.on) rxPreload();
  }
  function offAir() { R.offAir = true; R.cur = R.cur || TITLE; R.playing = false; duck(false); clearBC(); stopYT(); render(); }
  function tune(list, dir, reason) { // move along a playlist; if that whole list can't play, borrow another one
    let t = step(list, dir);
    if (!t) for (const o of Object.keys(TRACKS)) { if (o !== list && (t = step(o, 1))) { list = o; break; } }
    if (!t) return offAir();
    R.list = list; play(t, reason);
  }
  function fadeThen(fn, fast) { R.goal = 0; R.after = fn; R.fast = !!fast; } // crossfade: volume down, swap, back up (a player's own switch uses a quick dip)
  function swap(fn, fast) { if (R.started && R.on && R.vol > 1 && !isBC(R.cur) && !R.after) fadeThen(fn, fast); else { R.after = null; fn(); } }
  function advance(reason) { if (R.list === 'remix' && R.station === 'remix') return rxAdvance(reason); tune(R.list || listFor(R.station), 1, reason); }
  function skip(dir) { // N / B / ⏭ / ⏮
    if (!R.started) start();
    if (!R.on) { setStation(R.lastSt); return; }
    if (R.list === 'remix' && dir > 0 && RX.dual && RX.pre && RX.pre.ready && !RX.fade && R.playing) { rxCross(XF_FAST, 'next'); return; } // ⏭ on REMIX: a quick crossfade into the preloaded clip
    if (R.list === 'remix') rxCancel();
    swap(() => tune(R.list, dir, dir > 0 ? 'next' : 'prev'), true);
  }
  function setStation(st, why) { // the dial: auto / day / night / ducky / off
    if (!STATIONS.includes(st)) return;
    const wasOn = R.on; R.station = st; try { localStorage.setItem(LS, st); } catch (e) {}
    if (RX.fade || (R.list === 'remix' && st !== 'remix')) rxCancel();
    if (st === 'off') { R.on = false; R.after = null; R.goal = 0; stopYT(); duck(false); if (R.bc) clearBC(); R.wasBC = isBC(R.cur); stationId('off'); return; }
    R.lastSt = st; R.on = true; R.offAir = false;
    const list = listFor(st);
    if (!R.started) { if (R.list !== list) tune(list, 1, why || 'station'); else stationId(why || 'station'); return; }
    if (!wasOn && R.list === list && R.cur) { resume(); stationId(why || 'on'); return; } // back on: pick up where it was
    if (R.list === list) { stationId(why || 'station'); return; } // same playlist (e.g. AUTO -> DAY by day): just the station ID
    swap(() => tune(list, 1, why || 'station'), true);
  }
  function resume() {
    const t = R.cur; if (!t) return;
    if (isBC(t)) { showBC(t); return; }
    try { if (R.player && R.ready) { R.vol = 0; R.player.setVolume(0); R.goal = VOL; R.player.playVideo(); } } catch (e) {}
    if (R.list === 'remix') { rxClip(t, true); rxPreload(); }
  }
  const cycle = () => { if (!R.started) start(); setStation(STATIONS[(STATIONS.indexOf(R.station) + 1) % STATIONS.length]); };
  const toggle = () => { if (!R.started) start(); setStation(R.on ? 'off' : R.lastSt || 'remix'); };
  function duck(on) { try { if (SFXBUS) SFXBUS.gain.setTargetAtTime(on ? 0.62 : 1, AC.currentTime, 0.3); } catch (e) {} }


  // ---- B-MORE 410 REMIX engine: 20 s peak clips, next clip preloaded muted on the idle player, equal-power crossfade (or a fast-seek cut on iOS) ----
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const CLIP = Math.max(4, +Q.get('remixclip') || 20), XF = Math.min(3, CLIP / 4), XF_FAST = 0.8, RXLOG = Q.has('radiolog');
  const RX = { dual: Q.get('remix2') === '1' ? true : Q.get('remix1') === '1' ? false : !IOS, A: null, B: null, bReady: false, idle: null, pre: null, fade: null, start: 0, t: 0, adj: false, clips: 0, fades: 0 };
  const rlog = (o) => { const e = { at: +(S.time || 0).toFixed(2), ...o }; R.log.push(e); if (RXLOG) console.log('[remix]', JSON.stringify(e)); };
  const peakOf = (t) => (REMIX_PEAK[t.id] != null ? REMIX_PEAK[t.id] : 45); // 45 s = the fallback guess until the length is known
  const fbStart = (dur) => Math.max(0, Math.min(Math.max(30, dur * 0.35), dur - CLIP - 5));
  const vid = (t) => (R.list === 'remix' ? { videoId: t.id, startSeconds: R.cur === t ? RX.start : peakOf(t) } : t.id);
  const ptime = (p) => { try { const v = p.getCurrentTime(); return isFinite(v) ? v : NaN; } catch (e) { return NaN; } };
  const pdur = (p) => { try { return +p.getDuration() || 0; } catch (e) { return 0; } };
  function clipCredit(t, reason) { // each clip: the credit changes in the slim top bar (the big card only drops on a station switch)
    lastHtml = ''; render(); rlog({ reason: 'clip', st: R.station, list: 'remix', id: t.id, title: t.title, start: RX.start, peak: REMIX_PEAK[t.id] != null ? 'heatmap' : 'fallback', mode: RX.dual ? 'crossfade' : 'cut', why: reason, text: idText(t) });
  }
  function rxClip(t, keep) { if (!keep) { RX.start = peakOf(t); RX.adj = REMIX_PEAK[t.id] != null; } RX.t = 0; RX.clips++; }
  function rxCancel() { // drop the preload / any crossfade in flight (station switch, off, ⏮); the preloaded track goes back in the shuffle
    if (RX.fade) { const f = RX.fade; RX.fade = null; try { f.from.setPlaybackRate(1); f.from.setVolume(Math.round(R.vol)); } catch (e) {} }
    if (RX.pre) { const p = RX.idle; try { p.pauseVideo(); p.mute(); p.setVolume(0); } catch (e) {} const L = TRACKS.remix; R.idx.remix = (R.idx.remix - 1 + L.length) % L.length; RX.pre = null; }
  }
  function rxPreload() { // next clip on the idle player: muted, playing just long enough to buffer at its peak, then paused there
    if (!RX.dual || !RX.bReady || !RX.idle || RX.pre || RX.fade || !R.started || !R.on || R.list !== 'remix') return;
    const t = step('remix', 1); if (!t) return;
    RX.pre = { t, start: peakOf(t), ready: false, adj: REMIX_PEAK[t.id] != null, at: performance.now() };
    try { const p = RX.idle; p.mute(); p.setVolume(0); p.loadVideoById({ videoId: t.id, startSeconds: RX.pre.start }); } catch (e) {}
    rlog({ reason: 'preload', id: t.id, start: RX.pre.start });
  }
  function rxIdleState(s) { // state events from the idle (preloading) player
    const P = RX.pre; if (!P || RX.fade) return;
    if (s === 1 && P.ready) { try { RX.idle.pauseVideo(); } catch (e) {} return; } // keep the preloaded clip parked at its peak
    if (s === 1 && !P.ready) {
      const p = RX.idle; let vd = null; try { vd = p.getVideoData ? p.getVideoData().video_id : p.vid; } catch (e) {} if (vd && vd !== P.t.id) return; // (a stale event from the previous video)
      if (!P.adj) { const d = pdur(p); if (d > 0) { P.start = fbStart(d); P.adj = true; try { p.seekTo(P.start, true); } catch (e) {} } }
      try { p.pauseVideo(); } catch (e) {} P.ready = true; rlog({ reason: 'preloaded', id: P.t.id, start: +P.start.toFixed(1), ms: Math.round(performance.now() - P.at) });
    }
  }
  function rxIdleError(code) { const P = RX.pre; if (!P) return; R.bad.add(P.t.id); rlog({ reason: 'error ' + code + ' (preload)', id: P.t.id }); RX.pre = null; rxPreload(); }
  function rxCross(dur, why) { // equal-power crossfade: out = cos, in = sin; a tape-drag on the outgoing clip near the end
    const P = RX.pre, from = R.player, to = RX.idle;
    RX.fade = { from, to, t: 0, t0: performance.now(), dur, why, tape: false, P, v0: Math.max(R.vol, 1) };
    try { to.setVolume(0); to.unMute(); to.playVideo(); } catch (e) {}
    RX.fades++; rlog({ reason: 'xfade-start', from: R.cur && R.cur.id, to: P.t.id, dur, clipT: +RX.t.toFixed(2), why });
  }
  function rxFadeTick(dt) {
    const F = RX.fade; F.t = (performance.now() - F.t0) / 1000; const x = Math.min(1, F.t / F.dur);
    try { F.from.setVolume(Math.round(F.v0 * Math.cos(x * Math.PI / 2))); F.to.setVolume(Math.round(VOL * Math.sin(x * Math.PI / 2))); } catch (e) {}
    if (!F.tape && x > 0.72) { F.tape = true; try { F.from.setPlaybackRate(0.5); } catch (e) {} } // tape-drag on the way out
    if (x < 1) return;
    try { F.from.pauseVideo(); F.from.mute(); F.from.setPlaybackRate(1); F.from.setVolume(0); } catch (e) {}
    RX.fade = null; R.player = F.to; RX.idle = F.from; RX.pre = null;
    R.cur = F.P.t; R.vol = R.goal = VOL; R.playing = true; RX.start = F.P.start; RX.adj = true; RX.t = Math.max(0, (ptime(F.to) || F.P.start + F.t) - F.P.start); RX.clips++;
    rlog({ reason: 'xfade-end', id: R.cur.id, ms: Math.round(F.t * 1000) }); clipCredit(R.cur, F.why); rxPreload();
  }
  function rxAdvance(reason) { // the clip is over (or the track ended / errored): crossfade if the next one is ready, else a quick cut
    if (RX.fade) return;
    if (RX.dual && RX.pre && RX.pre.ready && reason !== 'skip') return rxCross(reason === 'remix' ? XF : XF_FAST, reason);
    if (RX.pre) rxCancel();
    const go = () => tune('remix', 1, reason === 'skip' ? 'skip' : 'remix');
    if (reason === 'skip') { R.after = null; go(); } else swap(go, true);
  }
  function rxTick(dt) {
    if (R.station !== 'remix' || R.list !== 'remix' || !R.started || !R.on || R.offAir || !R.cur) return;
    if (RX.fade) { rxFadeTick(dt); return; }
    if (!R.playing || R.after) return;
    const ct = ptime(R.player);
    if (!RX.adj) { const d = pdur(R.player); if (d > 0) { RX.adj = true; const s0 = fbStart(d); if (Math.abs(s0 - RX.start) > 2) { RX.start = s0; try { R.player.seekTo(s0, true); } catch (e) {} RX.t = 0; rlog({ reason: 'fallback-start', id: R.cur.id, start: +s0.toFixed(1), len: Math.round(d) }); return; } } }
    RX.t = isFinite(ct) && ct >= RX.start - 1 ? Math.max(0, ct - RX.start) : RX.t + dt;
    if (!RX.pre && RX.dual) rxPreload();
    const lead = RX.dual && RX.pre && RX.pre.ready ? XF : 0.4; // dual: the fade fills the last 3 s; one player: a 0.35 s dip then the cut
    if (RX.t >= CLIP - lead) { rlog({ reason: 'clip-end', id: R.cur.id, clipT: +RX.t.toFixed(2) }); rxAdvance('remix'); }
  }
  // ---- YouTube IFrame Player API (or the test stub) ----
  function onReady(e) {
    if (e && e.target && RX.B && e.target === RX.B && RX.A !== RX.B) { RX.bReady = true; try { RX.B.mute(); RX.B.setVolume(0); } catch (er) {} rxPreload(); return; } // the second (remix) player
    R.ready = true; try { R.player.setVolume(0); } catch (e) {} const t = R.cur; if (t && !isBC(t)) { try { if (R.started && R.on) { R.player.loadVideoById(vid(t)); R.goal = VOL; } else R.player.cueVideoById(vid(t)); } catch (e) {} } render(); }
  function onState(e) {
    if (e && e.target && R.player && e.target !== R.player) { if (RX.fade && e.target === RX.fade.to) return; rxIdleState(e.data); return; } // events from the idle remix player
    if (RX.fade && e && e.data !== 1) return; // the outgoing clip is being faded out / paused by the crossfade
    const s = e.data; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (s === 1) { R.playing = true; if (!R.on || isBC(R.cur)) { try { R.player.pauseVideo(); } catch (er) {} } else { duck(true); if (R.goal === 0 && !R.after) R.goal = VOL; } }
    else if (s === 0) { R.playing = false; if (R.on && !isBC(R.cur)) advance('next'); }
    else if (s === 2) { R.playing = false; if (!isBC(R.cur)) duck(false); }
    render();
  }
  function onError(e) { // 2 bad id, 5 html5, 100 gone, 101/150 embedding not allowed: a CC track falls back to Bandcamp, anything else is skipped
    if (e && e.target && R.player && e.target !== R.player) { if (RX.fade && e.target === RX.fade.to) { const P = RX.fade.P; rxCancel(); R.bad.add(P.t.id); rxPreload(); } else rxIdleError(e.data); return; }
    const t = R.cur; if (!t || isBC(t)) return; R.log.push({ at: +(S.time || 0).toFixed(2), reason: 'error ' + (e && e.data), id: t.id }); R.playing = false;
    if (t.bc) { R.ytFail.add(t.id); play(t, 'bandcamp'); } else { R.bad.add(t.id); advance('skip'); }
  }
  function makeStub() { // ?radiotest=1: same calls, no network; the box shows a placeholder of the same size. Each stub keeps a clock (getCurrentTime) and a 200 s length.
    const sd = document.createElement('div'); sd.id = 'rstub'; rplay.appendChild(sd);
    const mk = (name) => { const P = { name, v: 0, muted: false, rate: 1, vid: null, pos: 0, t0: 0, on: false, calls: [], setVolume(v) { this.v = v; }, getVolume() { return this.v; },
      mute() { this.muted = true; }, unMute() { this.muted = false; }, isMuted() { return this.muted; }, setPlaybackRate(r) { this.sync(); this.rate = r; }, getDuration() { return this.vid ? 200 : 0; },
      sync() { if (this.on) { const n = performance.now(); this.pos += (n - this.t0) / 1000 * this.rate; this.t0 = n; } }, getCurrentTime() { this.sync(); return this.pos; },
      seekTo(s) { this.sync(); this.pos = s; this.calls.push('seek ' + s); },
      loadVideoById(a) { const id = typeof a === 'object' ? a.videoId : a; this.vid = id; this.pos = (typeof a === 'object' && a.startSeconds) || 0; this.on = false; this.calls.push('load ' + id + '@' + this.pos);
        setTimeout(() => { if (this.vid !== id) return; this.on = true; this.t0 = performance.now(); onState({ data: 1, target: P }); }, 30); },
      cueVideoById(a) { const id = typeof a === 'object' ? a.videoId : a; this.vid = id; this.pos = (typeof a === 'object' && a.startSeconds) || 0; this.calls.push('cue ' + id); },
      playVideo() { this.calls.push('play'); setTimeout(() => { this.sync(); this.on = true; this.t0 = performance.now(); onState({ data: 1, target: P }); }, 30); },
      pauseVideo() { this.sync(); this.on = false; this.calls.push('pause'); setTimeout(() => onState({ data: 2, target: P }), 10); }, stopVideo() { this.calls.push('stop'); } }; return P; };
    const A = mk('A'); R.player = RX.A = A; setTimeout(() => onReady({ target: A }), 50);
    if (RX.dual) { const B = mk('B'); RX.B = RX.idle = B; setTimeout(() => onReady({ target: B }), 80); }
  }
  function noSignal() { // YouTube unreachable (offline, blocked network): the CC tracks still play through Bandcamp; the rest wait
    if (R.ready) return; R.noSignal = true;
    if (R.cur && !R.cur.bc) advance('skip'); else if (R.cur) play(R.cur, 'bandcamp'); render();
  }
  function makeYT() { // our own audio-only iframe (allow="autoplay" only, no controls / fullscreen / keyboard), then the IFrame API binds to it
    const f = document.createElement('iframe'); f.id = 'rplayer'; f.title = 'B-MORE 410 RADIO audio'; f.setAttribute('allow', 'autoplay'); f.setAttribute('tabindex', '-1'); f.setAttribute('aria-hidden', 'true');
    f.width = 2; f.height = 2; f.frameBorder = '0';
    f.src = 'https://www.youtube.com/embed/' + TITLE.id + '?enablejsapi=1&playsinline=1&controls=0&fs=0&disablekb=1&rel=0&iv_load_policy=3&modestbranding=1&origin=' + encodeURIComponent(location.origin);
    rplay.appendChild(f);
    let f2 = null; if (RX.dual) { // the second hidden audio-only player for REMIX crossfades (same 2x2 px, opacity .01, pointer-events:none box)
      f2 = document.createElement('iframe'); f2.id = 'rplayer2'; f2.title = 'B-MORE 410 REMIX audio'; f2.setAttribute('allow', 'autoplay'); f2.setAttribute('tabindex', '-1'); f2.setAttribute('aria-hidden', 'true');
      f2.width = 2; f2.height = 2; f2.frameBorder = '0'; f2.src = f.src.replace(TITLE.id, POOL[0].id); rplay.appendChild(f2); }
    const mk = () => { R.player = RX.A = new YT.Player('rplayer', { events: { onReady, onStateChange: onState, onError } });
      if (f2) RX.B = RX.idle = new YT.Player('rplayer2', { events: { onReady, onStateChange: onState, onError } }); };
    if (window.YT && YT.Player) mk(); else { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); mk(); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = noSignal; setTimeout(() => { if (!R.ready) noSignal(); }, 15000); document.head.appendChild(s); }
  }
  if (TEST) makeStub(); else makeYT();

  // ---- start on the first gesture ----
  function start() {
    if (R.started) return; R.started = true; R.startT = performance.now();
    if (R.on && R.cur) { if (isBC(R.cur)) showBC(R.cur); else if (R.player && R.ready) { try { R.player.setVolume(0); R.vol = 0; R.player.loadVideoById(vid(R.cur)); } catch (e) {} R.goal = VOL; } }
    // Browsers only let a page start audible media from a gesture: the first tap starts the active player (above) and, in REMIX's two-player mode, rxPreload()
    // below starts the second one (muted load + play) inside the same gesture, so its later unmute + play for the crossfade is allowed
    if (R.list === 'remix' && R.on) { RX.t = 0; rlog({ reason: 'clip', st: R.station, list: 'remix', id: R.cur.id, title: R.cur.title, start: RX.start, peak: REMIX_PEAK[R.cur.id] != null ? 'heatmap' : 'fallback', mode: RX.dual ? 'crossfade' : 'cut', why: 'tune-in' }); rxPreload(); }
    if (R.on) stationId('tune-in'); else render();
  }
  const gesture = () => { audioInit(); start(); };
  addEventListener('pointerdown', gesture, { capture: true }); addEventListener('touchstart', gesture, { capture: true, passive: true });
  let rDown = -1, rFrame = 0, rFirst = false; const fr = () => (window.__cel ? __cel.frames : 0);
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase(); if (e.repeat) return; rFirst = !R.started; gesture();
    if (k === 'm') toggle(); else if (k === 'n') skip(1); else if (k === 'b') skip(-1); else if (k === 't') cycle(); else if (k === 'escape' && R.credOpen) showCred(false);
    if (k === 'r') { rDown = e.timeStamp; rFrame = fr(); }
  }, { capture: true });
  addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'r' && rDown >= 0) { const dur = e.timeStamp - rDown, tap = dur < 300 || (dur < 450 && fr() - rFrame <= 2); R.rTap = [Math.round(dur), fr() - rFrame, tap, rFirst]; rDown = -1; /* a tap toggles (a hold keeps turning the camera); the frame count covers slow devices */ if (tap && !rFirst) toggle(); rFirst = false; } });
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  // HUD station button: tap = next station, long-press = off / on
  let lpT = 0, lpFired = false; const stb = $('rst');
  stb.addEventListener('pointerdown', (e) => { lpFired = false; clearTimeout(lpT); stb.classList.add('hold'); lpT = setTimeout(() => { lpFired = true; stb.classList.remove('hold'); toggle(); try { navigator.vibrate && navigator.vibrate(20); } catch (_) {} }, LONG_MS); });
  let lpAt = 0; stb.addEventListener('pointerdown', () => { lpAt = performance.now(); });
  const lpEnd = (e) => { clearTimeout(lpT); stb.classList.remove('hold'); if (e && e.type === 'pointerup' && !lpFired && lpAt && performance.now() - lpAt >= LONG_MS) { lpFired = true; toggle(); } lpAt = 0; }; // a slow main thread can delay the timer: pointerup decides too
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) stb.addEventListener(ev, lpEnd);
  stb.addEventListener('contextmenu', (e) => e.preventDefault());
  on('rst', () => { if (lpFired) { lpFired = false; return; } cycle(); });
  on('rprev', () => skip(-1)); on('rnext', () => skip(1)); on('rcrb', () => showCred(!R.credOpen)); on('rcrx', () => showCred(false));
  for (const n of [bar, bcw, cred]) for (const ev of ['pointerdown', 'touchstart']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // taps on the radio never drive the camera
  cred.addEventListener('click', (e) => e.stopPropagation());

  // ---- tick: AUTO day/night switch, volume fades, Bandcamp timer, card timer ----
  { const list = listFor(R.station); R.list = list;
    if (list === 'remix') { R.idx.remix = 0; R.cur = TRACKS.remix[0]; rxClip(R.cur); RX.clips = 0; stationId('start'); } // REMIX (default) tunes in on the first clip of its shuffle
    else { R.idx[list] = TRACKS[list].indexOf(TITLE); R.cur = TITLE; if (isBC(TITLE)) showBC(TITLE); stationId('start'); } } // other stations: the title track tunes in first
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
    rxTick(dt);
    if (R.station === 'auto' && R.on && !R.offAir && !R.after) { const want = nightNow() ? 'night' : 'day'; if (R.list !== want) swap(() => tune(want, 1, want === 'night' ? 'dusk' : 'dawn')); }
    if (R.bigT > 0) { R.bigT -= dt; if (R.bigT <= 0) card.classList.remove('on'); }
    if (R.bc && R.on && R.started && R.bcLeft > 0) { R.bcLeft -= dt; if (R.bcLeft <= 0) advance('next'); }
    const stp = VOL / (R.fast && R.goal === 0 ? 0.35 : FADE) * dt;
    if (R.vol !== R.goal && !RX.fade) { R.vol = R.vol < R.goal ? Math.min(R.goal, R.vol + stp) : Math.max(R.goal, R.vol - stp); try { R.player && R.ready && R.player.setVolume(Math.round(R.vol)); } catch (e) {} }
    if (R.after && R.vol <= 0.01) { const f = R.after; R.after = null; f(); }
    if (R.started && R.on && !R.playing) render();
  }, 100);
  render();

  window.__radio = { R, T, TRACKS, STATIONS, toggle, setStation, cycle, skip, start, advance, idText, isBC, get station() { return R.station; }, get text() { return R.tickerText; },
    get card() { return card.classList.contains('on') ? card.textContent : ''; }, get stored() { try { return localStorage.getItem(LS); } catch (e) { return null; } },
    simEnd: () => onState({ data: 0 }), simError: (c = 150) => onError({ data: c }), simBCEnd: () => { if (R.bc) R.bcLeft = 0.01; }, showCred,
    RX, REMIX_PEAK, POOL, CLIP, get vol() { return R.vol; }, get sfx() { return SFXBUS ? SFXBUS.gain.value : null; } };
  return R;
})();

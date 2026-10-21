// Bake-off K: "Toad Street 32" - one block of one street, an elderly toad couple vs. five thugs, rendered like a 32-bit (PS1-era) game:
// low-res target + nearest upscale, vertex snapping, affine-ish texture wobble, ordered dither + 15-bit colour, short fogged draw distance,
// and a 2-minute day/night cycle. Fork of J (Cinema City), standalone three.js r160, procedural everything.
import * as THREE from './three.module.min.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);
const BOT = Q.has('bot') || Q.has('auto');
const ALLEY = true; // ALLEY FIGHT variant: night alley brawl, all 5 thugs at once
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
scene.fog = new THREE.Fog(FOGC, 16, 66);
const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 95);

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
    comicText(c, 'RADIO', 200, 88, 96, '#7fe8ff', null); comicText(c, '99.9 FM', 200, 182, 70, '#ffd23c', null);
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
const GRAF = [['TOAD', '#9dbb4a', '#2a4a7a'], ['32', '#d8b04a', '#7a2a2a'], ['HOP', '#c86a8a', '#3a2a5a'], ['ZAP', '#6ab0c8', '#8a7a2a'],
  ['RUSH', '#c87a4a', '#14101f'], ['WILD', '#a48ac8', '#7a2a3a'], ['GG!', '#d8d0c0', '#2a6a6a'], ['YO', '#d8b04a', '#4a3a7a']];
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
const CB = new MB(), DB = new MB(), OL = new OB(), GB = new MB(); // city, decals, outlines, ground (no shadow cast)
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- layout: ONE street (the old south arm), a single block long, running north-south ----------------
// X east, Z south. Road |x|<7, sidewalks to |x|<11, storefronts from |x|=11 out. Walkable z from ZMIN to ZMAX; both ends barricaded,
// capped by a building and swallowed by fog.
const RW = 7, SW = 11, ARM = 46, LIM = 42.5, CURB = 0.16;
const ZMIN = 3.6, ZMAX = 46.4, ZN = -2, ZS = 50; // walk limits; street ends (cap buildings start there)
const GF = 4.4, FH = 3.4, PAR = 1.3;
function isRoad(x, z) { return Math.abs(x) < RW; }
function groundY(x, z) { return isRoad(x, z) ? 0 : CURB; }

// ground: road + both sidewalks (subdivided), curbs, paint, one manhole
(function ground() {
  GB.floorSub(-RW, ZN - 2, RW, ZS + 2, 0, T.road, '#ffffff', 6, 4);
  for (const sx of [-1, 1]) {
    const xa = sx > 0 ? RW : -SW, xb = sx > 0 ? SW : -RW; GB.floorSub(xa, ZN - 2, xb, ZS + 2, CURB, T.walk, '#fff', 2, 4);
    for (let z = ZN - 2; z < ZS + 2; z += 6) { const z1 = Math.min(z + 6, ZS + 2), cx = sx * RW; if (sx > 0) GB.wall(cx, z, cx, z1, 0, CURB, T.white, '#9a958c'); else GB.wall(cx, z1, cx, z, 0, CURB, T.white, '#9a958c'); }
  }
  const W = new THREE.Color('#d8d4c8'), Y = new THREE.Color('#d8b040'), y = 0.012;
  for (let z = ZN; z < ZS; z += 4.5) { DB.floor(-0.28, z, -0.1, z + 2.4, y, T.white, Y); DB.floor(0.1, z, 0.28, z + 2.4, y, T.white, Y); }
  DB.floor(RW - 0.55, ZN, RW - 0.4, ZS, y, T.white, W); DB.floor(-RW + 0.4, ZN, -RW + 0.55, ZS, y, T.white, W);
  for (let x = -RW + 0.6; x < RW - 0.6; x += 1.25) DB.floor(x, 4.6, x + 0.65, 7.2, y, T.white, W); // zebra at the north end
  DB.floor(-RW + 0.4, 7.6, RW - 0.4, 7.95, y, T.white, W);
  // the manhole (with a little ring of rust)
  { const g = new THREE.CylinderGeometry(0.8, 0.8, 0.03, 10); place(g, 2.6, 0.0, 25); CB.geom(g, '#3a352f'); const g2 = new THREE.CylinderGeometry(0.62, 0.62, 0.04, 10); place(g2, 2.6, 0.0, 25); CB.geom(g2, '#2a2622'); }
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

// the street's two sides: storefronts at street level, tenement floors above, one alley building with the STAFF door
const WEST = [ // x from -24 to -11, faces east ('e')
  { z: [ZN, 9], fl: 4, pal: 0, sign: 0, o: { v: 1, fire: 'e', fireAt: 0.5 } },
  { z: [9, 20], fl: 3, pal: 2, sign: 2, o: { tower: [0.4, 0.5] } },
  { z: [20, 28.6], fl: 5, pal: 1, sign: 4, o: { v: 1 } },
  { z: [28.6, 38], fl: 3, pal: 3, sign: -1, o: { graf: [['e', 0.78, 0, 0.35, 0.9]] } }, // the alley building: the STAFF door is on this face
  { z: [38, ZS], fl: 4, pal: 5, sign: 6, o: { bill: ['e', 1] } },
];
const EAST = [ // x from 11 to 24, faces west ('w')
  { z: [ZN, 7], fl: 5, pal: 4, sign: 1, o: {} },
  { z: [7, 17], fl: 3, pal: 0, sign: 3, o: { v: 1, graf: [['w', 0.5, 2, 4.8, 1.1]] } },
  { z: [17, 29], fl: 4, pal: 5, sign: 5, o: { fire: 'w', fireAt: 0.4 } },
  { z: [29, 40], fl: 6, pal: 2, sign: 7, o: { v: 1 } },
  { z: [40, ZS], fl: 3, pal: 1, sign: 0, o: { tower: [0.6, 0.5], graf: [['w', 0.3, 5, 0.35, 1]] } },
];
for (const B of WEST) building(-24, B.z[0], -SW, B.z[1], B.fl, B.pal, Object.assign({ shops: B.sign >= 0 ? ['e'] : null, sign: B.sign }, B.o));
for (const B of EAST) building(SW, B.z[0], 24, B.z[1], B.fl, B.pal, Object.assign({ shops: ['w'], sign: B.sign }, B.o));
// back fill behind both rows (keeps the skyline solid from the intro crane)
building(-34, ZN, -24, ZS, 7, 1, { ac: false }); building(24, ZN, 34, ZS, 8, 3, { ac: false });
// the street ends: a building across each end + jersey barriers (orange/white) + a ROAD CLOSED board
building(-24, ZN - 12, 24, ZN, 6, 2, { shops: ['s'], sign: 6, v: 1, bill: ['s', 2] });
building(-24, ZS, 24, ZS + 12, 5, 4, { shops: ['n'], sign: 3, graf: [['n', 0.2, 6, 0.3, 1], ['n', 0.82, 7, 0.3, 1]] });
for (const zb of [ZMIN - 1.6, ZMAX + 1.4]) {
  for (let c = -SW + 0.4; c < SW - 0.4; c += 2.2) {
    const g = new THREE.BoxGeometry(2.0, 0.85, 0.6); g.translate(0, 0.42, 0); place(g, c + 1, Math.abs(c + 1) < RW ? 0 : CURB, zb); solid(g, ((c / 2.2) | 0) % 2 ? '#c8642a' : '#d8d0c0');
  }
  const post = (x) => { const g = new THREE.BoxGeometry(0.12, 1.9, 0.12); place(g, x, 0.95, zb); solid(g, '#2a2622'); };
  post(-1.6); post(1.6); const bd = new THREE.BoxGeometry(3.6, 0.7, 0.08); place(bd, 0, 1.75, zb); CB.geom(bd, '#d8d0c0', T.stripes);
  const bd2 = new THREE.BoxGeometry(3.4, 0.22, 0.1); place(bd2, 0, 1.75, zb); solid(bd2, '#b02a2a');
  BLD.push({ x0: -SW, x1: SW, z0: zb - 0.3, z1: zb + 0.3, h: 0.9 });
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
const LAMPS = [];
function lampAt(x, z) { const ang = x < 0 ? Math.PI / 2 : -Math.PI / 2; lamp(x, z, ang); LAMPS.push({ x: x + Math.sin(ang) * 1.6, z: z + Math.cos(ang) * 1.6, y: CURB + 4.8, px: x, pz: z }); }
lampAt(-10.2, 12); lampAt(10.2, 21); lampAt(-10.2, 33.5); lampAt(10.2, 44);
hydrant(8.1, 28.5); hydrant(-8.1, 14.5);
bin(9.8, 15.5, '#3a5a4a'); bin(-9.8, 24.5, '#4a4a5a'); bin(9.8, 34.2, '#3a5a4a');
dumpster(-9.6, 35.6, Math.PI / 2); // in the alley mouth beside the STAFF door
car(-5.8, 18.5, 0, '#a83a4a', '#d8d0c0'); // maroon coupe, west curb
car(5.8, 10.5, Math.PI, '#d8a830', '#d8a830'); // taxi, east curb
car(5.8, 37.5, Math.PI, '#3a5a8a', '#2a3a5a'); // blue hatch, east curb
{ const g = new THREE.BoxGeometry(0.3, 0.28, 0.7); place(g, 5.8, 1.95, 10.7, Math.PI); solid(g, '#efe4cc'); } // taxi roof sign
// bunting across the street
function bunting(ax0, az0, ax1, az1, y) {
  const n = 14, cols = ['#a83a3a', '#c8a040', '#3a7a6a', '#4a4a8a', '#7a9a4a'];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.8) / n, sag = (t) => -Math.sin(t * Math.PI) * 1.2;
    const a = [lerp(ax0, ax1, t0), y + sag(t0), lerp(az0, az1, t0)], b = [lerp(ax0, ax1, t1), y + sag(t1), lerp(az0, az1, t1)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.75, (a[2] + b[2]) / 2];
    DB.quad(a, b, m, m, [0, 0, 1, 1], cols[i % 5], T.white);
  }
}
bunting(-SW, 26.5, SW, 26.5, 8.8);
// kept for shared code paths (06b/06c): there is no climbable fire escape or rooftop on this street any more
const LADDER = { x: 999, z: 999, top: 0, roofY: 0 };

const cityMesh = CB.build(CITY_MAT); cityMesh.castShadow = true; cityMesh.receiveShadow = true; cityMesh.frustumCulled = false; scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); groundMesh.receiveShadow = true; groundMesh.frustumCulled = false; scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); decalMesh.receiveShadow = true; decalMesh.frustumCulled = false; scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);

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
  const s = new THREE.Mesh(new THREE.SphereGeometry(85, 16, 10), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s); window.__sky = s;
  const disc = (inner, outer, glow) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(0.55, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); };
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#fffbe8', '#ffe9a0', 'rgba(255,220,140,.35)'), fog: false, depthWrite: false, transparent: true }));
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#f4f6ff', '#d8e0f0', 'rgba(180,200,255,.25)'), fog: false, depthWrite: false, transparent: true }));
  sunS.scale.set(16, 16, 1); moonS.scale.set(9, 9, 1); sunS.renderOrder = moonS.renderOrder = -9; s.add(sunS, moonS);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 32; const c = cc.getContext('2d'); c.fillStyle = '#fff';
  [[16, 22, 10], [28, 16, 12], [42, 18, 10], [52, 23, 7]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(8, 22, 50, 8);
  const ct = lowTex(cc, 64), clouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true })); const a = i / 7 * TAU + 0.3, r = 75;
    sp.position.set(Math.cos(a) * r, 22 + (i % 3) * 9, Math.sin(a) * r); sp.scale.set(28 + (i % 2) * 10, 13 + (i % 2) * 4, 1); sp.renderOrder = -9; s.add(sp); clouds.push(sp);
  }
  return { U, sunS, moonS, clouds };
})();


// ---------------- ALLEY FIGHT dressing: brick walls narrow the street into an alley ----------------
const ALLEY_X = 5; // fighters stay inside |x| < 5
(function alleyDress() {
  const BRICK = '#6e3a2e', BRICK_D = '#5a2e24';
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? 5.5 : -6.2, x1 = sx > 0 ? 6.2 : -5.5;
    sbox(x0, 0, ZN - 2, x1, 9, ZS + 2, BRICK); // the brick wall
    // brick courses: darker horizontal stripes
    for (let y = 1.2; y < 9; y += 1.2) sbox(x0, y, ZN - 2, x1, y + 0.12, ZS + 2, BRICK_D, false);
    // grime at the base
    sbox(x0, 0, ZN - 2, x1, 0.7, ZS + 2, '#2a1a14', false);
    BLD.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: ZN - 2, z1: ZS + 2, h: 9 }); // camera + finisher cams stay out
  }
  // dumpsters against the walls
  dumpster(-4.3, 27, Math.PI / 2); dumpster(4.3, 35, Math.PI / 2); dumpster(-4.3, 40, Math.PI / 2);
  // trash bags
  for (const [bx, bz] of [[-4.6, 30], [4.6, 31.5], [-4.4, 37], [4.5, 25.5]]) {
    const b = new THREE.SphereGeometry(0.42, 8, 6); place(b, bx, CURB + 0.32, bz); solid(b, '#1c1c22');
    COLL.push({ x: bx, z: bz, r: 0.45 });
  }
  // string lights across the alley
  for (let z = 24; z <= 42; z += 3) {
    for (let i = 0; i <= 8; i++) {
      const x = -5 + i * 1.25, y = 6.4 - Math.sin((i / 8) * Math.PI) * 0.9;
      const b = new THREE.SphereGeometry(0.09, 6, 5); b.translate(x, y, z); solid(b, '#ffca7a', false);
    }
    const wire = new THREE.BoxGeometry(10.4, 0.03, 0.03); place(wire, 0, 6.5, z); solid(wire, '#111114', false);
  }
  const pl = new THREE.PointLight('#ffb050', 12, 22, 1.4); pl.position.set(0, 5.6, 33); scene.add(pl);
  // FIGHT neon blade sign on the west wall
  const fc = document.createElement('canvas'); fc.width = 64; fc.height = 256; const fg = fc.getContext('2d');
  fg.fillStyle = '#101018'; fg.fillRect(0, 0, 64, 256); fg.strokeStyle = '#ff3d2e'; fg.lineWidth = 5; fg.strokeRect(5, 5, 54, 246);
  fg.font = '900 40px ' + FONT; fg.textAlign = 'center'; fg.textBaseline = 'middle'; fg.fillStyle = '#ff6a55';
  'FIGHT'.split('').forEach((ch, i) => fg.fillText(ch, 32, 30 + i * 49));
  const ft = lowTex(fc, 64);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5.2, 0.3), basicSnap({ map: ft, color: new THREE.Color(0.4, 0.4, 0.4) }));
  blade.position.set(-5.3, GF + 3.4, 33); scene.add(blade);
  const nl = new THREE.PointLight('#ff3d2e', 10, 12, 1.3); nl.position.set(-4.2, GF + 3.0, 33); scene.add(nl);
})();

// ---------------- night lights: lamp glow pools + halos, point lights, and the BINGO neon blade sign ----------------
const NIGHTFX = { pools: [], halos: [], lights: [], neon: null };
(function nightFx() {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(0.5, 'rgba(255,130,40,.55)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 32); })();
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,80,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); })();
  for (const L of LAMPS) {
    const m = basicSnap({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), m); q.rotation.x = -Math.PI / 2; q.position.set(L.x, groundY(L.x, L.z) + 0.03, L.z); q.renderOrder = 2; scene.add(q); NIGHTFX.pools.push(q);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })); h.position.set(L.x, L.y - 0.1, L.z); h.scale.set(2.6, 2.6, 1); scene.add(h); NIGHTFX.halos.push(h);
    const pl = new THREE.PointLight('#ffa050', 0, 14, 1.3); pl.position.set(L.x, L.y - 0.6, L.z); scene.add(pl); NIGHTFX.lights.push(pl);
  }
  // BINGO: a vertical neon blade sign sticking out of the east building over the sidewalk (z ~ 33)
  const nc = document.createElement('canvas'); nc.width = 64; nc.height = 256; const g = nc.getContext('2d');
  g.fillStyle = '#1a1018'; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#ff4fa0'; g.lineWidth = 5; g.strokeRect(5, 5, 54, 246);
  g.font = '900 44px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff6ab8'; 'BINGO'.split('').forEach((ch, i) => g.fillText(ch, 32, 30 + i * 49));
  const nt = lowTex(nc, 64);
  const mat = basicSnap({ map: nt, color: new THREE.Color(0.35, 0.35, 0.35) });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 1.3), mat); blade.position.set(SW - 1.0, GF + 3.6, 33); scene.add(blade);
  for (const y of [GF + 1.2, GF + 6.0]) { const br = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), basicSnap({ color: '#2a2622' })); br.position.set(SW - 0.6, y, 33); scene.add(br); }
  const nl = new THREE.PointLight('#ff4fa0', 0, 13, 1.2); nl.position.set(SW - 2.2, GF + 3.0, 33); scene.add(nl);
  NIGHTFX.neon = { mat, light: nl };
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
const HERO_START = { x: 0, z: 41.5 };
const hero = new Fighter(buildHero(), { x: HERO_START.x, z: HERO_START.z, yaw: Math.PI, hp: 100, r: 0.45 });
hero.J.mat.userData.flashC.value.set('#fff'); hero.roof = false; hero.name = 'HAROLD';
// the AI partner: MAVIS, Harold's wife (grey afro, floral dress, pearls, handbag), always computer-controlled (see 06c_partner.js)
const partner = new Fighter(buildHero({ wife: true }), { x: -2.3, z: 41.1, yaw: Math.PI, hp: 100, r: 0.45 });
partner.J.mat.userData.flashC.value.set('#fff'); partner.roof = false; partner.name = 'MAVIS'; partner.isPartner = true;
const POSTS = [
  { x: -2.5, z: 30, look: 0, yaw: 0 },           // ALLEY FIGHT: all five thugs in the alley at once
  { x: 2.5, z: 29, look: 1, yaw: 0 },
  { x: 0, z: 26.5, look: 2, yaw: 0 },
  { x: -3, z: 33.5, look: 3, yaw: 0 },
  { x: 3, z: 34, look: 4, yaw: 0 },              // the bruiser
];
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

// ---------------- world collision ----------------
const WALK = SW - 0.45;
function collide(f) {
  const p = f.pos;
  if (f.roof) { // rooftop shortcut: walk inside the parapet, around the AC unit
    p.x = clamp(p.x, ROOF.x0, ROOF.x1); p.z = clamp(p.z, ROOF.z0, ROOF.z1);
    const a = ROOF.ac, m = f.r * 0.8; if (p.x > a.x0 - m && p.x < a.x1 + m && p.z > a.z0 - m && p.z < a.z1 + m) {
      const o = [p.x - (a.x0 - m), a.x1 + m - p.x, p.z - (a.z0 - m), a.z1 + m - p.z], k = o.indexOf(Math.min(...o));
      if (k === 0) p.x = a.x0 - m; else if (k === 1) p.x = a.x1 + m; else if (k === 2) p.z = a.z0 - m; else p.z = a.z1 + m; }
    p.y = ROOF.y; return;
  } p.x = clamp(p.x, -WALK, WALK); p.z = clamp(p.z, ZMIN, ZMAX); // one street: storefront to storefront, barricade to barricade
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
const CAM = { yaw: 0, pitch: 0.17, dist: 4.4, cur: 4.4, sh: 0.72, pivot: new THREE.Vector3(0, 1.55, 41.5), look: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 58, lockYawT: 0, fightK: 0 };
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
  const portrait = innerHeight > innerWidth * 1.15;
  const want = lerp(4.4, 5.9, fk) + (portrait ? 1.4 : 0);
  CAM.dist = damp(CAM.dist, want, 2.5, rdt);
  const pitch = CAM.pitch + fk * 0.12;
  const f = camFwd(CAM.yaw), r = [-f[1], f[0]], cp = Math.cos(pitch), sp = Math.sin(pitch);
  // right-shoulder offset (smaller in fights and on narrow portrait screens so the hero stays readable)
  const sh = lerp(0.95, 0.45, fk) * (portrait ? 0.55 : 1);
  const px = CAM.pivot.x + r[0] * sh, py = CAM.pivot.y, pz = CAM.pivot.z + r[1] * sh;
  const wx = px - f[0] * CAM.dist * cp, wy = py + CAM.dist * sp, wz = pz - f[1] * CAM.dist * cp;
  let t = 1; for (const b of BLD) { const h = segBox(px, py, pz, wx, wy, wz, b, 0.3); if (h < t) t = h; }
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
  const aspect = innerWidth / innerHeight; let fov = base; if (aspect < 1) fov = clamp(2 * Math.atan(Math.tan((base * 0.82 / 2) * Math.PI / 180) / aspect) * 180 / Math.PI, base, 84);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

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
function hitEnemy(e, dmg, heavy, fromYaw, by = hero) {
  if (!e.alive || e.state === 'dying' || (e.state === 'down' && !heavy)) return false;
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
const NOHURT = new Set(['down', 'getup', 'ko', 'tp', 'hop', 'pclimb', 'boost', 'tag', 'intro']);
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
{ const p = $('proto'); if (innerWidth >= 700 && !TOUCH) p.classList.add('open'); $('protoT').addEventListener('click', () => p.classList.toggle('open')); }

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
const DOOR = { x: -10.95, z: 31.4, open: false, ang: 0 };
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
for (const [cx, cz, alongX] of [[-5.8, 18.5, false], [5.8, 10.5, false], [5.8, 37.5, false]]) {
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
function tryAction() {
  if (CINE.intro) return false;
  const qt = qteTarget(); if (qt) { startFinisher(qt); return true; }
  const A = actionInRange(); if (A) { A.go(A); return true; }
  return false;
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
    F.hit = 3; e.fin = false; e.hp = 0; e.dead = true; e.lastBy = hero; e.set('down'); e.kb.set(-F.ux * 9, -F.uz * 9); e.vy = 7.5; e.y = 0.01; e.yaw = Math.atan2(F.ux, F.uz);
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
    const pk = innerWidth < innerHeight ? 1.55 : 1; // portrait: pull the cut cameras back so both fighters fit
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
    const pk = innerWidth < innerHeight ? 1.45 : 1;
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
  _c1.set(lerp(-3, 1.5, e), lerp(22, 7, e), lerp(2, hero.pos.z - 2, e)); _c2.set(lerp(0, hero.pos.x, e), lerp(0, 1.5, e), lerp(26, hero.pos.z - 6, e));
  const k = ease(clamp((I.t - I.dur * 0.55) / (I.dur * 0.45), 0, 1));
  camera.position.lerpVectors(_c1, CAM.pos, k); camera.up.set(0, 1, 0); camera.lookAt(_c2.lerp(CAM.look, k)); setFov(lerp(64, 58, k));
  if (I.t >= I.dur) { CINE.intro = null; CINE.stats.introDone = true; CINE.stats.introSkipped = !!I.skip; CINE.stats.introSec = +I.t.toFixed(2); $('title').classList.remove('on'); $('hint').style.opacity = '1'; setTimeout(() => { $('hint').style.opacity = '0'; }, 8000);
    if (ALLEY) { banner('ROUND 1', 1.5); setTimeout(() => banner('FIGHT!', 1.2), 1600); } }
}

// ---- per rendered frame: letterbox, cut flash, prompts, door, pizza, QTE bookkeeping ----
const PRM = { el: $('prompt'), key: $('pkey'), lab: $('plab'), ico: $('pico'), ring: $('pring'), cur: null };
const ICONS = {
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
  const portrait = innerHeight > innerWidth * 1.15, H = Math.round(CINE.lb * Math.min(innerHeight * (portrait ? 0.075 : 0.11), 88));
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
  const el = PRM.el;
  if (P) {
    _v.set(P.x, P.y, P.z).project(camera);
    const vis = _v.z < 1 && _v.z > -1;
    let sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight;
    const hw = Math.min(innerWidth / 2 - 4, (el.offsetWidth || 140) / 2 + 6); sx = clamp(sx, hw, innerWidth - hw); sy = clamp(sy, 70 + (CINE.lbH || 0), innerHeight - 90 - (CINE.lbH || 0));
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
const INTRO_LAND = { x: -2.3, z: 40.9 }, INTRO_LAND_P = { x: -1.7, z: 40.1 }; // portrait: closer + ahead so it stays in the narrow frame
const PORTRAIT = () => innerHeight > innerWidth * 1.15;
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
      P.root.visible = true; const u = (t - t0) / (t1 - t0); P.pos.x = lerp(-9.4, L.x, ease(u)); P.pos.z = lerp(35.5, L.z, u); P.pos.y = gy;
      const wy = lerp(gy + 6.2, gy, u * u) + 2.0 * u * (1 - u); P.y = Math.max(0, wy - gy); P.yaw = Math.atan2(L.x + 9.4, L.z - 35.5);
      pose = HERO_POSES.jump(-1); pose.tilt = [ease(clamp((u - 0.1) / 0.75, 0, 1)) * TAU, 0, 0]; pose.lgL = pose.lgR = [-1.3, 0, 0]; pose.knL = pose.knR = [2.0, 0, 0]; snapTilt = true;
    } else {
      if (!P.landed) { P.landed = true; P.y = 0; dust(P.pos.x, P.pos.y, P.pos.z, 5); S.shake = Math.max(S.shake, 0.35); sfx('heavy'); }
      P.root.visible = true; P.pos.set(L.x, gy, L.z); P.y = 0; P.yaw += angTo(P.yaw, Math.PI) * (1 - Math.exp(-dt * 5));
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
  for (const [f, x, z] of [[hero, HERO_START.x, HERO_START.z], [partner, INTRO_LAND.x, INTRO_LAND.z]]) { f.roof = false; f.pos.set(x, groundY(x, z), z); f.y = 0; f.vy = 0; f.vel.set(0, 0); f.kb.set(0, 0); f.hp = f.maxHp; f.yaw = Math.PI; f.set('getup'); f.inv = 3; f.root.visible = true; }
  for (const e of enemies) if (e.alive && e.state !== 'dying') { e.hp = e.maxHp; e.dizzied = false; e.fin = false; e.y = 0; e.set('return'); }
  CAM.yaw = 0; snapCam(); cut(); banner('TRY AGAIN!', 1.4);
}

// ---------------- autopilot for tests (?bot=1): walk up the street and back, fight every thug met, orbit the camera mid-fight ----------------
const CORNER_PTS = [['S1', 0, 36], ['W1', -4.5, 28], ['E1', 3.6, 21], ['W2', -3.5, 13], ['N', 0, 5.5], ['E2', 3.8, 30], ['S2', 0, 42]]; // a walk up the one block and back
if (ALLEY) { CORNER_PTS.length = 0; CORNER_PTS.push(['A1', 0, 38], ['A2', -2.5, 33], ['A3', 2.5, 31], ['A4', 0, 28], ['A5', -1, 35]); } // alley brawl circuit
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
  const w = innerWidth, h = innerHeight, a = w / h; let lw, lh;
  if (QUAL.hd) { const dpr = Math.min(devicePixelRatio || 1, TOUCH ? 2 : 1.5); lw = Math.round(w * dpr); lh = Math.round(h * dpr); }
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

// ---------------- day / night: a continuous loop (default 120 s): 60 s day -> night, 60 s night -> day. ?tod=0..1 pins it (0 day, .25 dusk, .5 night), ?cycle=N sets the loop length ----------------
const CYC = { len: clamp(+(Q.get('cycle') || 120), 4, 3600), pin: ALLEY ? 0.5 : (Q.has('tod') ? clamp(+Q.get('tod'), 0, 1) : null), t: 0, tod: 0, n: 0, lamps: 0 };
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
  col3(PALK.fog, n, scene.fog.color); FOGC.copy(scene.fog.color); OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = scene.fog.near; OUT_U.fogF.value = scene.fog.far; renderer.setClearColor(scene.fog.color); scene.fog.near = num3(16, 13, 8, n); scene.fog.far = num3(66, 56, 44, n);
  col3(PALK.hs, n, hemi.color); col3(PALK.hg, n, hemi.groundColor); hemi.intensity = num3(1.45, 0.85, 0.32, n);
  col3(PALK.sun, n, sun.color); sun.intensity = num3(2.1, 1.25, 0.45, n);
  const [i, t] = k3(n); _dir.copy(DIRK[i]).lerp(DIRK[i + 1], t).normalize(); SUN_DIR.copy(_dir);
  SKY.sunS.position.copy(i ? DIRK[1] : _dir).multiplyScalar(70); SKY.sunS.material.opacity = 1 - sstep(0.45, 0.65, n);
  SKY.moonS.position.copy(DIRK[2]).multiplyScalar(70); SKY.moonS.material.opacity = sstep(0.5, 0.8, n);
  col3(PALK.cloud, n, _cc); for (const c of SKY.clouds) c.material.color.copy(_cc);
  // night: windows light up, street lamps switch on (orange glow pools + halos + point lights), the BINGO neon buzzes on
  NIGHT.value = sstep(0.32, 0.62, n);
  const on = CYC.lamps = sstep(0.38, 0.56, n);
  NIGHTFX.pools.forEach((q, k) => { q.material.opacity = on * 0.8; q.visible = on > 0.01; });
  NIGHTFX.halos.forEach((h) => { h.material.opacity = on; h.visible = on > 0.01; });
  NIGHTFX.lights.forEach((l) => { l.intensity = on * 16; });
  FILL.intensity = on * 3.2; FILL.position.copy(camera.position); FILL.position.y += 1.2; // a soft camera-side fill so the old folks read at night
  const fl = on > 0.5 && Math.sin(CYC.t * 23) > 0.93 ? 0.55 : 1; // the odd neon flicker
  const mins = Math.floor(((12 + CYC.tod * 24) % 24) * 60 / 10) * 10; if (mins !== CYC.mins) { CYC.mins = mins; const h = Math.floor(mins / 60), m = mins % 60;
    $('clock').textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  const nb = lerp(0.3, 1.0, on) * (on > 0.01 ? fl : 1); NIGHTFX.neon.mat.color.setRGB(nb, nb, nb); NIGHTFX.neon.light.intensity = on * 11 * fl;
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
      updateHero(dt);
      updatePartner(dt);
      for (const e of enemies) updateEnemy(e, dt);
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
    PRESS.clear();
    draw();
  } catch (err) { __celErr.n++; __celErr.last = String(err && err.stack || err); if (__celErr.n < 4) console.error(err); }
}
requestAnimationFrame(frame);
window.__cel = { S, hero, partner, PART, BOOST_P, hurtTurtle, reviveTurtle, partnerSlot, get KEYS() { return KEYS; }, enemies, CAM, BOTR, FPS, IN, renderer, CINE, ACTIONS, DOOR, PIZZA, LADDER, ROOF, get QTE() { return QTE; }, get lockT() { return lockT; }, press: (k) => PRESS.add(k), tryAction, get frames() { return frames; }, atlasRows: _ay + _arow, THREE, camera, scene, CYC, LOW, NIGHTFX, draw, QUAL, setHD };

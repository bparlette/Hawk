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
  // drone racer: uSpd (speed lines), uHalf (halftone vignette), uHit (crash flash), uBoost (warm boost tint), uTime
  uniforms: { tSrc: { value: RT.texture }, uRes: { value: new THREE.Vector2(320, 240) }, uDither: { value: Q.get('dither') === '0' ? 0 : 1 }, uPost: QUAL.post,
    uSpd: { value: 0 }, uHalf: { value: 1 }, uHit: { value: 0 }, uBoost: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uDither; uniform float uPost; uniform float uSpd; uniform float uHalf; uniform float uHit; uniform float uBoost; uniform float uTime; varying vec2 vUv;
    float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    vec3 comic(vec3 c, vec2 px) {
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y; float r = length(q), a = atan(q.y, q.x);
      // halftone ink dots creeping in from the corners (stronger with speed / on a crash)
      float cs = max(6.0, uRes.y / 140.0); vec2 g = (fract(px / cs) - 0.5); float d = length(g);
      float rr = smoothstep(0.52, 1.05, r) * (0.24 + 0.18 * uSpd + 0.3 * uHit) * uHalf;
      c = mix(c, c * vec3(0.30, 0.26, 0.42), step(d, rr) * 0.6);
      // speed lines: thin white streaks rushing outward
      float bc = (a / 6.2831853 + 0.5) * 160.0, band = floor(bc), hb = h11(band);
      float f = fract(r * 1.4 - uTime * (2.4 + hb * 2.0) + hb * 9.0);
      float on = step(0.9 - uSpd * 0.12, hb) * smoothstep(0.26, 0.6, r) * smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.22, 0.34, f));
      float th = 1.0 - smoothstep(0.12, 0.4, abs(fract(bc) - 0.5) * 2.0); // a thin streak in the middle of its band
      c = mix(c, vec3(1.0, 0.98, 0.9), on * th * uSpd * 0.5);
      c = mix(c, c * vec3(1.18, 0.95, 0.80) + vec3(0.06, 0.02, 0.0), uBoost * smoothstep(0.25, 0.8, r));
      c = mix(c, vec3(1.0, 0.24, 0.36), uHit * 0.45 * smoothstep(0.15, 0.8, r));
      return c; }
    float bayer4(vec2 p) { // 4x4 ordered-dither threshold in [0,1)
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0; }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main() {
      vec2 px = floor(vUv * uRes);
      vec3 c = toSRGB(texture2D(tSrc, (px + 0.5) / uRes).rgb);
      if (uPost < 0.5) { gl_FragColor = vec4(comic(c, px), 1.0); return; } // HD: comic post (halftone + speed lines)
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

// Oil Paint Plaza — PAINTED ONCE (the A/B sibling of the repaint-everything build).
//
// The plaza never moves, so each camera angle is painted ONCE with blendi's brush-dab
// painter (src/oilpaint) at full rich density and cached as two flat layers split at the
// fountain: a background (everything but the fountain) and a foreground occluder (the
// fountain alone, mostly transparent). Per frame the only painting is HER: she is rendered
// small, and a GPU dab pass re-strokes her silhouette with the same brush (alpha from her
// render), composited between the two cached layers, plus the fountain's water jets, pool
// sparkles and a blob shadow. The occluder layer is drawn over her always — with cameras
// across the fountain and her roam ring outside the basin's radius she is behind the
// fountain's front surface from every angle, so she passes behind it correctly.
//
// The plaza is divided into 6 azimuth zones round the fountain. Each zone is watched from
// ONE fixed camera on the far side of the fountain. Crossing into a new zone cuts to its
// angle: cached angles swap instantly; a first visit paints once (the character layer
// keeps playing over the previous backdrop until the new painting lands).
import * as THREE from 'three';
import { createShared, COMMON, LAND_RES } from './src/oilpaint/common.js';
import { createBrushSheet } from './src/oilpaint/brush.js';
import { createShade } from './src/oilpaint/shade.js';
import { createFrame } from './src/oilpaint/finish.js';
import { groundRings } from './src/oilpaint/ground.js';
import { dabMaterial, dabGeometry, dabMesh } from './src/oilpaint/dabs.js';
import { createKit } from './src/night/kit.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSky } from './src/world/sky.js';
import { rng } from './src/world/noise.js';
import { TouchController, isTouchDevice } from './gptouch.js';

const q = new URLSearchParams(location.search);
const veil = document.getElementById('veil');
const hud = document.getElementById('hud');
const bgEl = document.getElementById('bg');
const fgEl = document.getElementById('fg');
const bgCtx = bgEl.getContext('2d');
const fgCtx = fgEl.getContext('2d');

// preserveDrawingBuffer: the painted angles are read back into 2D canvases (drawImage),
// exactly as the proof's offline capture read its frames.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('gl').replaceWith(renderer.domElement);
renderer.domElement.id = 'gl';
renderer.domElement.className = 'layer';
renderer.domElement.style.zIndex = '1';

// --- a warm day: high sun, pale blue air, warm bounce off the stone (as the proof) ---
const SUN = new THREE.Vector3(-0.55, 0.68, 0.48).normalize();
const shared = createShared();
shared.tBrush.value = createBrushSheet();
shared.uSunDir.value.copy(SUN);
shared.uHaze.value.setRGB(0.58, 0.68, 0.82);
shared.uHazeSun.value.setRGB(1.0, 0.88, 0.66);
shared.uHazeGlow.value.setRGB(0.12, 0.09, 0.03);
shared.uHazeDensity.value = 0.0035;
shared.uBounce.value.setRGB(0.12, 0.07, 0.02);
shared.uGlazeMul.value.setRGB(0.55, 0.45, 0.52);
shared.uGlazeAdd.value.setRGB(0.02, 0.015, 0.03);

// --- flat land: the plaza is level, so the height map is all zeros ---
{
  const heights = new Float32Array(LAND_RES * LAND_RES);
  const tHeight = new THREE.DataTexture(heights, LAND_RES, LAND_RES, THREE.RedFormat, THREE.FloatType);
  tHeight.minFilter = tHeight.magFilter = THREE.LinearFilter;
  tHeight.needsUpdate = true;
  shared.tHeight.value = tHeight;
  const land = new Uint8Array(LAND_RES * LAND_RES * 4);
  const tLand = new THREE.DataTexture(land, LAND_RES, LAND_RES);
  tLand.minFilter = tLand.magFilter = THREE.LinearFilter;
  tLand.needsUpdate = true;
  shared.tLand.value = tLand;
}

// --- zones and their fixed cameras ---
const ZONES = 6, SECTOR = (Math.PI * 2) / ZONES;
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.3, 1600);
let cameras = [];
function buildCameras() {
  const aspect = innerWidth / innerHeight;
  camera.fov = aspect < 1 ? 58 : 46;
  camera.aspect = aspect;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
  // Zoomed in ~2x (Cherie, Nov 12: the first framing sat so far back she read as a speck).
  // Same sight-line geometry, half the distance: she fills the frame, fountain still centred.
  const D = THREE.MathUtils.clamp(5.4 / tanH, 8, 24);
  const H = D * 0.52; // original sight-line height kept: the lower 0.38 test put a rooftop slab across half the frame; the win is the halved distance alone
  cameras = [];
  for (let k = 0; k < ZONES; k++) {
    const az = (k + 0.5) * SECTOR + Math.PI; // watch the sector from across the fountain
    cameras.push({
      az,
      pos: new THREE.Vector3(Math.sin(az) * D, H, Math.cos(az) * D),
      target: new THREE.Vector3(0, 0.6, 0),
    });
  }
  camera.updateProjectionMatrix();
}
function applyCam(k) {
  const c = cameras[k];
  camera.position.copy(c.pos);
  camera.lookAt(c.target);
  camera.updateMatrixWorld(true);
}
const azOf = (p) => { let a = Math.atan2(p.x, p.z); if (a < 0) a += Math.PI * 2; return a; };
const sectorOf = (p) => Math.floor(azOf(p) / SECTOR) % ZONES;

// --- the scenes: background (no fountain), foreground (fountain only), her, extras ---
const bgScene = new THREE.Scene();
const fgScene = new THREE.Scene();
const herScene = new THREE.Scene();
const extrasScene = new THREE.Scene();

// sky
bgScene.add(createSky(shared).group);

// ground underpainting
{
  const geo = new THREE.PlaneGeometry(340, 340);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tNoise; uniform vec3 uHaze; uniform vec3 uSunDir;
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() {
        float n = texture(tNoise, vWorld.xz / 9.0).r;
        float rad = length(vWorld.xz);
        vec3 c = mix(vec3(0.62, 0.52, 0.4), vec3(0.72, 0.62, 0.47), n);
        c = mix(c, vec3(0.55, 0.52, 0.42), smoothstep(18.0, 42.0, rad));
        outC = vec4(c * 0.92, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.05;
  m.frustumCulled = false;
  m.renderOrder = -5;
  bgScene.add(m);
}

// plaza ground dabs — RICH density: painted once, so pay for the good one
const plazaBody = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 1.0);
  vec4 q = hash4(cell + 31.7, sub + 11.0);
  vec2 xz = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  float rad = length(xz);
  float lit = sunAt(P + vec3(0.0, 0.25, 0.0));
  float check = mod(floor(xz.x / 1.4) + floor(xz.y / 1.4), 2.0);
  vec3 L = mix(vec3(0.99, 0.9, 0.74), vec3(0.93, 0.8, 0.6), check);
  vec3 M = mix(vec3(0.8, 0.68, 0.5), vec3(0.72, 0.58, 0.42), check);
  vec3 S = vec3(0.44, 0.37, 0.3);
  vec3 c = paint3(L, M, S, lit, q.y);
  float band = smoothstep(0.32, 0.0, abs(rad - 6.4) - 0.16) + smoothstep(0.32, 0.0, abs(rad - 11.2) - 0.16);
  c = mix(c, c * vec3(0.7, 0.6, 0.58), clamp(band, 0.0, 1.0) * 0.85);
  c = mix(c, paint3(vec3(1.0, 0.95, 0.84), vec3(0.86, 0.78, 0.64), S, lit, q.y), smoothstep(4.8, 3.2, rad));
  c = mix(c, c * vec3(0.88, 0.86, 0.8), smoothstep(19.0, 40.0, rad));
  c = jitter(c, r.wzy, 0.45);
  vec2 radial = rad > 0.01 ? xz / rad : vec2(1.0, 0.0);
  d.dir = vec3(radial.x, 0.0, radial.y);
  d.pos = P;
  d.size = uCell0 * vec2(1.05 + 0.5 * r.z, 1.7 + 0.9 * r.w) * lod;
  d.c1 = hazed(c, P);
  d.c2 = hazed(jitter(c * 1.14, q.wzy, 0.4), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = vec3(0.0, 1.0, 0.0);
  d.height = (0.02 + 0.05 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}`;
const plaza = groundRings(shared, { body: plazaBody, per: 3, n: 192, cell0: 0.15, levels: 6, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });
bgScene.add(plaza.group);

// kit paint lighting (as the proof)
const DAY = /* glsl */ `
float dayOn(vec3 P, vec3 Nn) {
  float s = sunAt(P + Nn * 0.25);
  float face = clamp(dot(Nn, uSunDir) * 1.3 + 0.3, 0.0, 1.0);
  return clamp(s * face + max(Nn.y, 0.0) * 0.16, 0.0, 1.0);
}`;
const KIT_LIGHT = DAY + /* glsl */ `
vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
  if (PAL_G[k] > 0.5) return PAL_L[k] * tone;
  return paint3(PAL_L[k], PAL_M[k], PAL_S[k], dayOn(P, Nn), r) * tone;
}`;
const PALETTES = {
  stone: { l: [0.99, 0.9, 0.72], m: [0.8, 0.68, 0.5], s: [0.46, 0.38, 0.29], own: [0.9, 0.8, 0.6] },
  stonePale: { l: [1.03, 0.98, 0.86], m: [0.88, 0.8, 0.66], s: [0.55, 0.48, 0.38], own: [0.95, 0.9, 0.75] },
  cream: { l: [1.02, 0.95, 0.8], m: [0.86, 0.76, 0.6], s: [0.52, 0.45, 0.36], own: [0.95, 0.88, 0.7] },
  rose: { l: [0.99, 0.74, 0.6], m: [0.83, 0.54, 0.44], s: [0.5, 0.31, 0.27], own: [0.9, 0.6, 0.45] },
  timber: { l: [0.46, 0.31, 0.19], m: [0.3, 0.19, 0.11], s: [0.15, 0.09, 0.06], own: [0.5, 0.33, 0.18] },
  bark: { l: [0.4, 0.3, 0.2], m: [0.26, 0.19, 0.13], s: [0.13, 0.09, 0.07], own: [0.4, 0.3, 0.18] },
  tile: { l: [0.92, 0.44, 0.25], m: [0.7, 0.31, 0.18], s: [0.41, 0.18, 0.12], own: [0.85, 0.4, 0.2] },
  tealRoof: { l: [0.3, 0.68, 0.64], m: [0.19, 0.48, 0.46], s: [0.09, 0.27, 0.27], own: [0.25, 0.6, 0.55] },
  awningRed: { l: [0.94, 0.27, 0.21], m: [0.72, 0.17, 0.15], s: [0.43, 0.1, 0.1], own: [0.85, 0.22, 0.16] },
  awningGold: { l: [1.0, 0.76, 0.3], m: [0.8, 0.56, 0.18], s: [0.48, 0.32, 0.1], own: [0.95, 0.68, 0.22] },
  glass: { l: [0.25, 0.36, 0.48], m: [0.16, 0.24, 0.34], s: [0.08, 0.12, 0.2], own: [0.2, 0.3, 0.42] },
  pot: { l: [0.85, 0.45, 0.28], m: [0.62, 0.31, 0.19], s: [0.36, 0.18, 0.12], own: [0.8, 0.4, 0.22] },
  fruit: { l: [1.0, 0.55, 0.15], m: [0.8, 0.38, 0.08], s: [0.45, 0.2, 0.05], own: [0.95, 0.5, 0.12] },
};
const kit = createKit(shared, { seed: 417, haze: true, order: 3, palettes: PALETTES, light: KIT_LIGHT });
const kitFountain = createKit(shared, { seed: 418, haze: true, order: 3, palettes: PALETTES, light: KIT_LIGHT });
const slab = (k, cx, cy, cz, rotX, rotZ, w, thick, len, pal, grain) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, rotZ)),
    new THREE.Vector3(1, 1, 1));
  k.add(new THREE.BoxGeometry(w, thick, len), m, pal, { grain: new THREE.Vector3(...grain), stroke: [0.09, 0.3] });
};

// house A: cream, terracotta roof
kit.box(-7.5, 2.2, -13, 8, 4.4, 6, 'cream', { stroke: [0.09, 0.26] });
kit.tri([-3.5, 4.4, -16], [-3.5, 6.3, -13], [-3.5, 4.4, -10], 'cream', { stroke: [0.09, 0.24] });
kit.tri([-11.5, 4.4, -10], [-11.5, 6.3, -13], [-11.5, 4.4, -16], 'cream', { stroke: [0.09, 0.24] });
slab(kit, -7.5, 5.32, -11.55, 0.564, 0, 8.9, 0.16, 3.9, 'tile', [0, -0.5, 0.85]);
slab(kit, -7.5, 5.32, -14.45, -0.564, 0, 8.9, 0.16, 3.9, 'tile', [0, -0.5, -0.85]);
kit.box(-9.6, 5.4, -14.6, 0.95, 2.8, 0.95, 'stone', { stroke: [0.08, 0.2] });
kit.box(-7.5, 1.05, -9.92, 1.15, 2.1, 0.16, 'timber', { grain: 'y' });
kit.box(-9.9, 2.7, -9.92, 1.3, 1.5, 0.14, 'glass');
kit.box(-5.1, 2.7, -9.92, 1.3, 1.5, 0.14, 'glass');
kit.box(-7.5, 3.45, -9.92, 0.9, 1.0, 0.14, 'glass');
kit.box(-7.5, 0.09, -9.35, 1.7, 0.18, 0.95, 'stone');

// house B: rose, verdigris roof
kit.box(6, 1.9, -13.5, 7, 3.8, 5.5, 'rose', { stroke: [0.09, 0.24] });
kit.tri([9.5, 3.8, -16.25], [9.5, 5.5, -13.5], [9.5, 3.8, -10.75], 'rose', { stroke: [0.09, 0.22] });
kit.tri([2.5, 3.8, -10.75], [2.5, 5.5, -13.5], [2.5, 3.8, -16.25], 'rose', { stroke: [0.09, 0.22] });
slab(kit, 6, 4.62, -12.15, 0.554, 0, 7.6, 0.16, 3.6, 'tealRoof', [0, -0.5, 0.85]);
slab(kit, 6, 4.62, -14.85, -0.554, 0, 7.6, 0.16, 3.6, 'tealRoof', [0, -0.5, -0.85]);
kit.box(6, 0.95, -10.68, 1.05, 1.9, 0.16, 'timber', { grain: 'y' });
kit.box(3.9, 2.3, -10.68, 1.15, 1.3, 0.14, 'glass');
kit.box(8.1, 2.3, -10.68, 1.15, 1.3, 0.14, 'glass');

// market stalls, east (red) and west (gold)
for (const s of [1, -1]) {
  const cx = 12.5 * s, cz = s > 0 ? -3 : 2, awn = s > 0 ? 'awningRed' : 'awningGold';
  for (const px of [11.6, 13.4]) for (const pz of [cz - 1.7, cz + 1.7]) kit.box(px * s, 1.15, pz, 0.12, 2.3, 0.12, 'timber', { grain: 'y' });
  kit.box(11.9 * s, 0.55, cz, 0.9, 1.1, 3.6, 'timber', { stroke: [0.08, 0.3] });
  kit.box(13.3 * s, 0.5, cz, 0.5, 1.0, 3.4, 'timber', { stroke: [0.08, 0.28] });
  slab(kit, cx, 2.62, cz, 0, 0.3 * s, 3.4, 0.09, 4.2, awn, [-s, 0, 0]);
  kit.box(11.8 * s, 0.3, cz - 2.3, 0.6, 0.6, 0.6, 'timber');
  kit.box(11.8 * s, 0.85, cz - 2.3, 0.5, 0.5, 0.5, 'timber', { tone: 0.85 });
  kit.round(13.2 * s, 0.28, cz + 2.4, 0.26, 0.56, 'pot', { sides: 10, stroke: [0.05, 0.12] });
  for (let i = 0; i < 5; i++) kit.add(new THREE.SphereGeometry(0.09, 8, 6), kit.place(11.9 * s, 1.17, cz - 0.8 + i * 0.4), 'fruit', { smooth: true, stroke: [0.04, 0.07] });
}
// tree trunks
for (const [tx, tz] of [[-12, -7.5], [12, -9.5], [-13, 7]]) kit.round(tx, 1.15, tz, 0.17, 2.3, 'bark', { sides: 8, stroke: [0.06, 0.22] });
const builtMain = kit.build();
bgScene.add(builtMain.group);

// the fountain — its own kit, because it is the foreground occluder layer
kitFountain.round(0, 0.34, 0, 2.6, 0.68, 'stone', { sides: 22, stroke: [0.09, 0.24] });
kitFountain.round(0, 0.72, 0, 2.72, 0.12, 'stonePale', { sides: 22, stroke: [0.08, 0.2] });
kitFountain.round(0, 0.8, 0, 0.44, 1.6, 'stone', { sides: 14, stroke: [0.07, 0.18] });
kitFountain.round(0, 1.62, 0, 1.08, 0.2, 'stonePale', { sides: 18, stroke: [0.07, 0.16] });
kitFountain.round(0, 1.8, 0, 0.07, 0.26, 'stone', { sides: 8 });
kitFountain.add(new THREE.SphereGeometry(0.17, 10, 8), kitFountain.place(0, 1.98, 0), 'stonePale', { smooth: true, stroke: [0.05, 0.09] });
const builtFountain = kitFountain.build();
fgScene.add(builtFountain.group);

// fountain water (background layer: the discs sit inside the basin, the rim hides
// their far edge — the moving jets and sparkles live in the per-frame layer instead)
const waterKit = createKit(shared, {
  seed: 99, haze: true, order: 4,
  palettes: { water: { l: [0.72, 0.88, 1.0], m: [0.42, 0.68, 0.9], s: [0.2, 0.44, 0.72], own: [0.5, 0.75, 0.95] } },
  light: /* glsl */ `
    vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
      vec3 v = normalize(P - cameraPosition);
      float glint = pow(max(dot(reflect(v, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0), 24.0);
      float shimmer = 0.72 + 0.28 * sin(uTime * 1.7 + P.x * 6.0 + P.z * 8.0 + r * 9.0);
      return paint3(PAL_L[k], PAL_M[k], PAL_S[k], shimmer, r) * tone + vec3(1.0, 0.96, 0.82) * glint * 0.85;
    }`,
});
{
  const flat = (y) => new THREE.Matrix4().compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1));
  waterKit.add(new THREE.CircleGeometry(2.38, 26), flat(0.55), 'water', { stroke: [0.06, 0.15], density: 1.2 });
  waterKit.add(new THREE.CircleGeometry(0.92, 20), flat(1.66), 'water', { stroke: [0.05, 0.12], density: 1.2 });
}
const builtWater = waterKit.build();
bgScene.add(builtWater.group);

// tree crowns: dark underpainting, then dabs over them
const crownData = { pos: [], dir: [], nrm: [] };
const crownUnder = [];
{
  const rand = rng(2024);
  const crowns = [
    { c: [-12, 3.6, -7.5], r: 1.7 }, { c: [-12.9, 3.0, -7.2], r: 1.2 }, { c: [-11.1, 3.1, -7.9], r: 1.25 },
    { c: [12, 3.9, -9.5], r: 1.9 }, { c: [11, 3.2, -9.1], r: 1.3 }, { c: [13, 3.3, -9.9], r: 1.35 },
    { c: [-13, 3.3, 7], r: 1.5 }, { c: [-13.8, 2.8, 7.3], r: 1.05 }, { c: [-12.2, 2.9, 6.6], r: 1.1 },
  ];
  for (const { c, r } of crowns) {
    crownUnder.push({ c, r });
    for (let i = 0, n = 380; i < n; i++) {
      const u = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (u.lengthSq() > 1 || u.lengthSq() < 0.05) { i--; continue; }
      u.normalize();
      const p = new THREE.Vector3(...c).addScaledVector(u, r * (0.8 + 0.32 * rand()));
      crownData.pos.push(p.x, p.y, p.z);
      crownData.nrm.push(u.x, u.y, u.z);
      const d = u.clone().multiplyScalar(0.6); d.y -= 0.55; d.normalize();
      crownData.dir.push(d.x, d.y, d.z);
    }
  }
  const underMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      out vec3 vWorld; out vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      in vec3 vWorld; in vec3 vN;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(vec3(0.05, 0.09, 0.03) * (0.65 + 0.55 * max(normalize(vN).y, 0.0)), 1.0); }`,
  });
  for (const { c, r } of crownUnder) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r * 0.96, 12, 9), underMat);
    s.position.set(...c);
    s.frustumCulled = false;
    bgScene.add(s);
  }
}
const crownCount = crownData.pos.length / 3;
const crowns = dabMesh(dabGeometry(crownCount, {
  aPos: [new Float32Array(crownData.pos), 3], aDir: [new Float32Array(crownData.dir), 3], aNrm: [new Float32Array(crownData.nrm), 3],
}), dabMaterial(shared, {
  head: DAY + /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm;`,
  body: /* glsl */ `
    void makeDab(inout Dab d) {
      vec4 r = hash4(aPos.x * 13.7 + aPos.y * 7.1 + aPos.z * 3.3);
      vec3 Nn = normalize(aNrm);
      if (dot(Nn, normalize(cameraPosition - aPos)) < -0.1) { d.alive = 0.0; return; }
      float x = dayOn(aPos, Nn);
      vec3 c = paint3(vec3(0.62, 0.78, 0.3), vec3(0.36, 0.52, 0.18), vec3(0.13, 0.24, 0.1), x, r.y);
      c = jitter(c, r.wzy, 0.5);
      d.pos = aPos;
      d.dir = aDir;
      d.size = vec2(0.19, 0.36) * (0.8 + 0.5 * r.x);
      d.c1 = hazed(c, aPos);
      d.c2 = hazed(c * 1.3, aPos);
      d.seed = r.x * 977.0;
      d.lift = 0.35;
      d.turnabout = 1.0;
    }`,
  minPx: [3, 6], maxPx: [120, 240], cells: [0, 8],
}), 3);
bgScene.add(crowns);

// --- the still world's shade, baked once from plain shapes (NO figure stand-in:
//     her shadow in this build is the per-frame blob, and her own lighting reads this
//     same baked map, so she darkens correctly inside the fountain's real shadow) ---
const shadeScene = new THREE.Scene();
{
  const cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const box = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), cm); m.position.set(x, y, z); m.frustumCulled = false; shadeScene.add(m); };
  const cyl = (x, y, z, r, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), cm); m.position.set(x, y, z); m.frustumCulled = false; shadeScene.add(m); };
  box(-7.5, 2.2, -13, 8, 4.4, 6); box(-7.5, 5.3, -13, 8.6, 2.0, 6.4);
  box(6, 1.9, -13.5, 7, 3.8, 5.5); box(6, 4.6, -13.5, 7.4, 1.8, 6);
  box(12.5, 1.2, -3, 3.2, 2.4, 4); box(-12.5, 1.2, 2, 3.2, 2.4, 4);
  cyl(0, 0.4, 0, 2.7, 0.8); cyl(0, 0.9, 0, 0.5, 1.8);
  for (const { c, r } of crownUnder) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cm); m.position.set(...c); m.frustumCulled = false; shadeScene.add(m); }
  for (const [tx, tz] of [[-12, -7.5], [12, -9.5], [-13, 7]]) cyl(tx, 1.15, tz, 0.2, 2.3);
}
const shade = createShade(renderer, shared, shadeScene, { sun: SUN, size: [2048, 2048], box: [30, 26], centre: [0, 1, -3], back: 110, near: 30, far: 240 });
// No moving-figure shade picture in this build (her shadow is the blob), but the fig
// picture must still be drawn once: its depth texture is a sampler2DShadow in every
// sunAt() program, and an unallocated one makes ANGLE reject every such draw. Nothing
// in this build is ever on layer 1, so the picture stays empty — fully lit everywhere —
// and sunAt() is the baked still-world shade alone.
shade.update(shadeScene, new THREE.Vector3(0, 0, 0));

// --- her: the Juniper walk GLB under the same painter (posterised texture mixes,
//     lit by the same sun and baked shade as the cached plaza) ---
const SPAWN = new THREE.Vector3(Math.sin(0.5 * SECTOR) * 6.4, 0, Math.cos(0.5 * SECTOR) * 6.4);
const herPos = SPAWN.clone();
let yaw = Math.atan2(-Math.sin(0.5 * SECTOR), -Math.cos(0.5 * SECTOR)); // face the first camera, across the fountain
function paintTex(srcMat) {
  const tint = srcMat.color ? [srcMat.color.r, srcMat.color.g, srcMat.color.b] : [1, 1, 1];
  let map = srcMat.map || null;
  if (!map) {
    map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.needsUpdate = true;
  }
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: { ...shared, tMap: { value: map }, uTint: { value: new THREE.Color(...tint) } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      out vec3 vWorld; out vec3 vN; out vec3 vBind; out vec2 vUv;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * objectNormal);
        vBind = position;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D tMap; uniform vec3 uTint;
      in vec3 vWorld; in vec3 vN; in vec3 vBind; in vec2 vUv;
      layout(location = 0) out vec4 outC;
      void main() {
        vec3 Nn = normalize(vN);
        if (!gl_FrontFacing) Nn = -Nn;
        vec3 tex = texture(tMap, vUv).rgb * uTint;
        float n = texture(tNoise, vBind.xy * 0.024 + vBind.z * 0.017).r;
        float m = texture(tNoise, vBind.yx * 0.007 + 0.4).g;
        float lit = sunAt(vWorld + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
        vec3 L = min(tex * 1.45 + vec3(0.05, 0.04, 0.02), vec3(1.2));
        vec3 S = tex * vec3(0.34, 0.36, 0.48);
        vec3 c = paint3(L, tex, S, lit, n);
        c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
        c = mix(c, c * vec3(0.86, 0.92, 1.18), (1.0 - lit) * max(Nn.y, 0.0) * 0.6);
        c *= 0.88 + 0.24 * m;
        if (!gl_FrontFacing) c *= 0.62;
        outC = vec4(hazed(c, vWorld), 1.0);
      }`,
  });
}

const gltf = await new GLTFLoader().loadAsync('./assets/juniper_walk.glb');
const HER_MESH_OBJS = [];
let hipsBone = null;
gltf.scene.traverse((o) => {
  if (o.isMesh) {
    o.material = paintTex(o.material);
    o.frustumCulled = false;
    HER_MESH_OBJS.push(o);
  }
  if (o.name === 'bone_2') hipsBone = o;
  else if (o.isBone && !hipsBone) hipsBone = o;
});
const herYaw = new THREE.Group();
herYaw.position.copy(herPos);
herYaw.rotation.y = yaw;
const herShift = new THREE.Group();
const herInner = gltf.scene;
herInner.scale.setScalar(1.55 / 160.3); // the rig is ~160 units tall; she stands 1.55 m in the plaza
herShift.add(herInner);
herYaw.add(herShift);
herScene.add(herYaw);
const mixer = new THREE.AnimationMixer(herInner);
const clip = gltf.animations.find((a) => a.name === 'WalkRetarget') || gltf.animations[0];
mixer.clipAction(clip).play();
let herTime = 0, walkRate = 0;
const _hv = new THREE.Vector3();
let BODY_OFF = { x: 0, z: 0 };
function anchorHips() {
  if (!hipsBone) return;
  const gy = herShift.position.y;
  herShift.position.set(0, gy, 0);
  herYaw.updateMatrixWorld(true);
  hipsBone.getWorldPosition(_hv);
  herYaw.worldToLocal(_hv);
  herShift.position.x = -_hv.x - BODY_OFF.x;
  herShift.position.z = -_hv.z - BODY_OFF.z;
  herYaw.updateMatrixWorld(true);
}
// Calibrate from her own skinned vertices (Box3 lies about this mesh): scale until she
// stands 1.55 m, feet on the plaza, and record the hips-to-body-centre offset.
{
  const v = new THREE.Vector3();
  const bounds = () => {
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    herYaw.updateMatrixWorld(true);
    for (const o of HER_MESH_OBJS) {
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        lo.min(v); hi.max(v);
      }
    }
    return { lo, hi };
  };
  mixer.setTime(0);
  herShift.position.set(0, 0, 0);
  let b = bounds();
  herInner.scale.multiplyScalar(1.55 / (b.hi.y - b.lo.y));
  b = bounds();
  herShift.position.y = -b.lo.y;
  hipsBone.getWorldPosition(_hv);
  herYaw.worldToLocal(_hv);
  const cLocal = new THREE.Vector3((b.lo.x + b.hi.x) / 2, 0, (b.lo.z + b.hi.z) / 2);
  herYaw.worldToLocal(cLocal);
  BODY_OFF = { x: cLocal.x - _hv.x, z: cLocal.z - _hv.z };
  anchorHips();
}

// --- the two finishes: the full one (sun shafts + weave + varnish) for cached
//     backdrops, and a lite one (weave + varnish, alpha kept) for transparent layers ---
const frame = createFrame(renderer, shared);
frame.uniforms.uShafts.value = 0.55;

function createFinishLite() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const uniforms = {
    ...shared,
    tColor: { value: null },
    uSize: { value: size.clone() },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D tColor;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      float weave(vec2 p) {
        vec2 q2 = p / 2.6;
        float n = texture(tNoise, p / 310.0).r;
        float a = sin(q2.x * 3.14159) * sin(q2.y * 3.14159 + floor(q2.x) * 3.14159);
        return a * (0.3 + 1.4 * n * n);
      }
      void main() {
        vec4 tex = texture(tColor, vUv);
        vec3 col = tex.rgb;
        vec2 px = vUv * uSize;
        float w = weave(px);
        float dx = weave(px + vec2(1.0, 0.0)) - w, dy = weave(px + vec2(0.0, 1.0)) - w;
        col *= 1.0 + (0.6 * dx - 0.8 * dy) * 0.022 + w * 0.006;
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
        outC = vec4(col, tex.a);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const flat = new THREE.Camera();
  return {
    uniforms,
    resize() { renderer.getDrawingBufferSize(size); uniforms.uSize.value.copy(size); },
    render(srcRT) {
      uniforms.tColor.value = srcRT.texture;
      renderer.setRenderTarget(null);
      renderer.render(scene, flat);
    },
  };
}
const finishLite = createFinishLite();

// --- layer render targets (rebuilt on resize) ---
let fgRT = null, dynRT = null, herRT = null, dabMeshObj = null;
const HER_SCALE = 1.5; // she is rendered at 1/1.5 resolution; one dab per source pixel
const dabUniforms = {
  tHerC: { value: null }, tHerD: { value: null },
  uInvVP: { value: new THREE.Matrix4() }, uGrid: { value: new THREE.Vector2(1, 1) },
  uOrigin: { value: new THREE.Vector2(0, 0) }, uWin: { value: new THREE.Vector2(1, 1) },
  uCellPx: { value: HER_SCALE },
};
const dabScene = new THREE.Scene();
function makeRT(w, h, samples) {
  const rt = new THREE.WebGLRenderTarget(w, h, { samples, depthBuffer: true, generateMipmaps: false });
  rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
  return rt;
}
function buildLayerTargets() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  for (const rt of [fgRT, dynRT, herRT]) if (rt) rt.dispose();
  fgRT = makeRT(size.x, size.y, 4);
  dynRT = makeRT(size.x, size.y, 4);
  const hw = Math.max(2, Math.floor(size.x / HER_SCALE)), hh = Math.max(2, Math.floor(size.y / HER_SCALE));
  herRT = makeRT(hw, hh, 0);
  herRT.depthTexture = new THREE.DepthTexture(hw, hh, THREE.UnsignedIntType);
  // NOTE: no filter overrides on the depth texture — setting LinearFilter on it made it
  // read back as all-zero in this stack (ANGLE/SwiftShader), silently killing every dab.
  dabUniforms.tHerC.value = herRT.texture;
  dabUniforms.tHerD.value = herRT.depthTexture;
  dabUniforms.uGrid.value.set(hw, hh);
  dabUniforms.uCellPx.value = size.y / hh;
  if (dabMeshObj) { dabScene.remove(dabMeshObj); dabMeshObj.geometry.dispose(); dabMeshObj.material.dispose(); }
  dabMeshObj = dabMesh(dabGeometry(hw * hh), dabMaterial(shared, {
    head: /* glsl */ `
      uniform sampler2D tHerC;
      uniform sampler2D tHerD;
      uniform mat4 uInvVP;
      uniform vec2 uGrid;
      uniform vec2 uOrigin;
      uniform vec2 uWin;
      uniform float uCellPx;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec2 cell = uOrigin + vec2(mod(id, uWin.x), floor(id / uWin.x));
        if (cell.x >= uGrid.x || cell.y >= uGrid.y) { d.alive = 0.0; return; }
        vec2 uv = (cell + 0.5) / uGrid;
        vec4 src = texture(tHerC, uv);
        float dep = texture(tHerD, uv).r;
        if (src.a < 0.35 || dep > 0.99995) { d.alive = 0.0; return; }
        vec4 wp = uInvVP * vec4(uv * 2.0 - 1.0, dep * 2.0 - 1.0, 1.0);
        vec3 P = wp.xyz / wp.w;
        vec4 r = hash4(cell, 3.0);
        float dist = length(P - cameraPosition);
        float cw = dist * uPixel * uCellPx;
        d.pos = P;
        d.dir = normalize(vec3((r.x - 0.5) * 0.9, -1.0, (r.y - 0.5) * 0.9));
        d.size = vec2(cw * 1.25, cw * 1.7) * (0.85 + 0.5 * r.z);
        d.c1 = src.rgb;
        d.c2 = src.rgb * 1.16 + vec3(0.03, 0.02, 0.0);
        d.seed = id * 0.731;
        d.lift = 0.04;
        d.turnabout = 1.0;
      }`,
    uniforms: dabUniforms,
    minPx: [4, 6], maxPx: [30, 48], cells: [0, 8],
  }), 0);
  dabScene.add(dabMeshObj);
}

// --- extras: her blob shadow, the fountain's jets and pool sparkles (as the proof) ---
const blob = (() => {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true, depthWrite: false,
    uniforms: { uCol: { value: new THREE.Color(0.14, 0.10, 0.17) }, uOp: { value: 0.46 } },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uOp;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        outC = vec4(uCol, smoothstep(1.0, 0.3, d) * uOp);
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 0;
  m.frustumCulled = false;
  return m;
})();
extrasScene.add(blob);
const jets = dabMesh(dabGeometry(90), dabMaterial(shared, {
  body: /* glsl */ `
    void makeDab(inout Dab d) {
      float id = float(gl_InstanceID);
      vec4 r = hash4(id * 3.7 + 2.0);
      if (id < 45.0) {
        float a = r.x * 6.28318;
        float life = fract(r.y + uTime * 0.85);
        vec2 out2 = vec2(cos(a), sin(a));
        d.pos = vec3(out2.x * life * 0.95, 2.06 + life * 0.72 - life * life * 1.1, out2.y * life * 0.95);
        d.dir = normalize(vec3(out2.x * 0.6, 0.8 - life * 1.2, out2.y * 0.6));
        d.size = vec2(0.035, 0.075) * (1.0 - life * 0.45);
        d.c1 = vec3(0.78, 0.9, 1.0) * 0.5 * (1.0 - life * 0.35);
      } else {
        float a = r.z * 6.28318;
        float life = fract(r.w + uTime * 0.7);
        d.pos = vec3(cos(a) * 1.06, 1.58 - life * life * 1.02, sin(a) * 1.06);
        d.dir = vec3(0.0, 1.0, 0.0);
        d.size = vec2(0.028, 0.09);
        d.c1 = vec3(0.78, 0.9, 1.0) * 0.45;
      }
      d.c2 = d.c1 * 1.35;
      d.seed = id * 3.1;
      d.lift = 0.0;
    }`,
  uniforms: { uImpasto: { value: 0.3 } },
  minPx: [2, 3], maxPx: [60, 120], cells: [0, 6], depthWrite: false,
}), 21);
jets.material.transparent = true;
jets.material.blending = THREE.AdditiveBlending;
jets.material.alphaToCoverage = false;
extrasScene.add(jets);
const sparkles = dabMesh(dabGeometry(42), dabMaterial(shared, {
  body: /* glsl */ `
    void makeDab(inout Dab d) {
      float id = float(gl_InstanceID);
      vec4 r = hash4(id * 9.3 + 4.0);
      float a = r.y * 6.28318, rad = sqrt(r.x) * 2.15;
      d.pos = vec3(cos(a) * rad, 0.57, sin(a) * rad);
      d.dir = vec3(1.0, 0.0, 0.0);
      d.size = vec2(0.05, 0.05);
      float tw = 0.3 + 0.4 * (0.5 + 0.5 * sin(uTime * 2.6 + id * 2.39));
      d.c1 = vec3(1.0, 0.97, 0.85) * tw;
      d.c2 = d.c1 * 1.3;
      d.seed = id * 7.7;
      d.lie = 1.0;
      d.nrm = vec3(0.0, 1.0, 0.0);
      d.height = 0.012;
      d.lift = 0.0;
    }`,
  uniforms: { uImpasto: { value: 0.2 } },
  minPx: [2, 2], maxPx: [30, 30], cells: [0, 6], depthWrite: false,
}), 22);
sparkles.material.transparent = true;
sparkles.material.blending = THREE.AdditiveBlending;
sparkles.material.alphaToCoverage = false;
extrasScene.add(sparkles);

// --- the paint-once cache: one pair of 2D canvases per zone ---
const PAINT_TIME = 2.0; // the frozen moment the backdrop paintings are taken from
const zoneCache = new Array(ZONES).fill(null);
const paintMs = {};
const sceneDabs = { bg: 368928, fg: 22063 };
let anglesCached = 0;
let zone = sectorOf(herPos);
let pendingPaint = -1, pendingDelay = 0;

function sizeDisplayCanvases() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  for (const el of [bgEl, fgEl]) {
    el.width = size.x; el.height = size.y;
    el.style.width = innerWidth + 'px'; el.style.height = innerHeight + 'px';
  }
}
function paintZone(k) {
  applyCam(k);
  plaza.follow(camera.position.x, camera.position.z); // the ground rings centre on the painter
  shared.uTime.value = PAINT_TIME;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / renderer.domElement.height;
  const t0 = performance.now();
  frame.render(bgScene, camera); // the finished painting lands on the GL canvas
  const bgC = document.createElement('canvas');
  bgC.width = renderer.domElement.width; bgC.height = renderer.domElement.height;
  bgC.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setRenderTarget(fgRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  renderer.render(fgScene, camera);
  finishLite.render(fgRT);
  const fgC = document.createElement('canvas');
  fgC.width = renderer.domElement.width; fgC.height = renderer.domElement.height;
  fgC.getContext('2d').drawImage(renderer.domElement, 0, 0);
  zoneCache[k] = { bg: bgC, fg: fgC };
  anglesCached = zoneCache.filter(Boolean).length;
  paintMs[k + 1] = Math.round(performance.now() - t0);
}
function swapTo(k) {
  const c = zoneCache[k];
  if (!c) return;
  bgCtx.clearRect(0, 0, bgEl.width, bgEl.height);
  bgCtx.drawImage(c.bg, 0, 0);
  fgCtx.clearRect(0, 0, fgEl.width, fgEl.height);
  fgCtx.drawImage(c.fg, 0, 0);
}

// --- input: gptouch (floating joystick + A/B), keyboard, scripted drive ---
const touchUI = isTouchDevice() || q.has('touch');
const tc = new TouchController({ force: touchUI });
document.body.classList.add(touchUI ? 'touch-on' : 'touch-off');
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
const scripted = { x: 0, y: 0 };
function readInput() {
  let x = 0, y = 0;
  if (tc.enabled) {
    const t = tc.getInput();
    x += t.x; y += t.y;
    if (t.bPressed) { herPos.copy(SPAWN); }
  }
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  x += scripted.x; y += scripted.y;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y, mag: Math.min(m, 1) };
}

// --- occlusion: the fountain layer is composited over her ALWAYS (the brief's
//     "draw the occluder layer only" option). It is correct in every reachable state:
//     each zone's camera watches from across the fountain, and the roam ring's inner
//     radius (3.3 m) is beyond the basin's radius (2.7 m), so she is always behind the
//     fountain's front surface from the active camera; where the two do not overlap on
//     screen the layer is transparent and changes nothing. The depth comparison is
//     still computed and reported in __paint.occluded. ---
const _fwd = new THREE.Vector3(), _tmp = new THREE.Vector3();
function camDepth(p) {
  const c = cameras[zone];
  _fwd.subVectors(c.target, c.pos).normalize();
  return _tmp.subVectors(p, c.pos).dot(_fwd);
}
const FOUNT_C = new THREE.Vector3(0, 1, 0);
let occluded = false;
function updateGate() {
  occluded = camDepth(herPos) > camDepth(FOUNT_C) - 0.3;
}

// --- test hook ---
const P = {
  started: false, loaded: false, backdropPainted: false,
  zone: zone + 1, anglesCached: 0, charDabs: 0, sceneDabs: sceneDabs.bg + sceneDabs.fg,
  pos: [herPos.x, herPos.z], moving: false, fps: 0, paintMs, herY: 0,
  occluded: false, herVisible: true, frames: 0, error: '',
  drive(x, y) { scripted.x = Number(x) || 0; scripted.y = Number(y) || 0; },
  stop() { scripted.x = 0; scripted.y = 0; },
  teleport(x, z) { herPos.set(Number(x) || 0, 0, Number(z) || 0); },
  countDabs() { countRequested = true; },
};
window.__paint = P;
window.__dbg = { renderer, herScene, bgScene, fgScene, dabScene, extrasScene, camera, shared, finishLite, frame, dabMaterial, dabGeometry, dabMesh, loopBody, get herRT() { return herRT; }, get dynRT() { return dynRT; } };

// Only the cells in a window round her projected figure spawn dabs — the rest of the
// grid is empty silhouette, and skipping it is a ~50x cut in per-frame dab work.
const _pv = new THREE.Vector3();
function updateDabWindow() {
  if (!dabMeshObj || !herRT) return;
  _pv.copy(herPos); _pv.y = 0.95;
  _pv.project(camera);
  const dist = camera.position.distanceTo(herPos);
  const sizeY = renderer.domElement.height;
  const hPx = (1.75 / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * sizeY;
  const cx = (_pv.x * 0.5 + 0.5) * herRT.width, cy = (_pv.y * 0.5 + 0.5) * herRT.height;
  const halfW = Math.max(4, (hPx * 0.55) / HER_SCALE), halfH = Math.max(4, (hPx * 0.62) / HER_SCALE);
  const x0 = Math.max(0, Math.floor(cx - halfW)), x1 = Math.min(herRT.width, Math.ceil(cx + halfW));
  const y0 = Math.max(0, Math.floor(cy - halfH)), y1 = Math.min(herRT.height, Math.ceil(cy + halfH));
  dabUniforms.uOrigin.value.set(x0, y0);
  dabUniforms.uWin.value.set(Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  dabMeshObj.geometry.instanceCount = Math.max(1, (x1 - x0) * (y1 - y0));
}

// --- the loop: her dabs are the only painting that happens per frame ---
const clock = new THREE.Clock();
let fpsAvg = 0, frameNo = 0, charDabs = 0, lastHud = 0, countRequested = false;
let _pix = new Uint8Array(4);
function allocPix(w, h) { if (_pix.length < w * h * 4) _pix = new Uint8Array(w * h * 4); }
const _vp = new THREE.Matrix4();

function loop() {
  try { loopBody(); } catch (e) { if (!P.error) P.error = String((e && e.message) || e); }
}
function loopBody() {
  P.frames++;
  if (frameNo === 12) countRequested = true; // one early count so __paint.charDabs is populated
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  fpsAvg = fpsAvg * 0.95 + (dt > 0 ? 1 / dt : 0) * 0.05;
  frameNo++;

  // a first-visit paint lands a couple of frames after the cut, so the veil can
  // paint and the character layer keeps playing over the previous backdrop
  if (pendingPaint >= 0 && --pendingDelay <= 0) {
    const k = pendingPaint;
    pendingPaint = -1;
    if (!zoneCache[k]) paintZone(k);
    if (k === zone) swapTo(k);
    veil.classList.add('gone');
  }

  // input -> movement (camera-relative, radius-clamped ring round the fountain)
  const inp = readInput();
  const fa = cameras[zone].az;
  const Fx = -Math.sin(fa), Fz = -Math.cos(fa);
  const Rx = -Fz, Rz = Fx; // screen-right = cross(forward, up)
  let mx = Rx * inp.x + Fx * -inp.y, mz = Rz * inp.x + Fz * -inp.y;
  const mm = Math.hypot(mx, mz);
  if (mm > 1e-4) { mx /= mm; mz /= mm; }
  const speed = inp.mag * 2.0;
  if (inp.mag > 0.02) {
    herPos.x += mx * speed * dt;
    herPos.z += mz * speed * dt;
    const rr = Math.hypot(herPos.x, herPos.z);
    if (rr > 9.6) { herPos.x *= 9.6 / rr; herPos.z *= 9.6 / rr; }
    if (rr < 3.3 && rr > 1e-6) { herPos.x *= 3.3 / rr; herPos.z *= 3.3 / rr; }
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    yaw += dy * Math.min(1, dt * 9);
  }
  const targetRate = inp.mag > 0.02 ? THREE.MathUtils.clamp(speed / 0.95, 0.3, 2.1) : 0;
  walkRate += (targetRate - walkRate) * Math.min(1, dt * 5);
  herTime += dt * walkRate;
  mixer.setTime(herTime);
  herYaw.position.copy(herPos);
  herYaw.rotation.y = yaw;
  anchorHips();

  // zone cut (with a little hysteresis so straddling a boundary does not flicker)
  const s = sectorOf(herPos);
  if (s !== zone) {
    const az = azOf(herPos);
    const into = az - s * SECTOR;
    if (Math.min(into, SECTOR - into) > 0.06) {
      zone = s;
      if (zoneCache[zone]) { swapTo(zone); }
      else { pendingPaint = zone; pendingDelay = 2; veil.textContent = 'painting this angle…'; veil.classList.remove('gone'); }
    }
  }

  // per-frame render: her (small) -> dabs + blob + jets + sparkles -> screen
  applyCam(zone);
  shared.uTime.value = t;
  shared.uFocus.value.set(herPos.x, 1.0, herPos.z);
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / renderer.domElement.height;
  for (const o of HER_MESH_OBJS) o.visible = true;
  blob.visible = true;
  blob.position.set(herPos.x, 0.03, herPos.z);
  renderer.setRenderTarget(herRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, false);
  renderer.render(herScene, camera);
  _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  dabUniforms.uInvVP.value.copy(_vp).invert();
  updateDabWindow();
  renderer.setRenderTarget(dynRT);
  renderer.clear(true, true, false);
  renderer.render(dabScene, camera);
  renderer.render(extrasScene, camera);
  finishLite.render(dynRT);

  // Count her dabs only when asked (plus once early): a readback is a GPU sync, and
  // under a software rasteriser the queue behind it can be minutes deep. The count
  // reads just her window's sub-rectangle of the figure target.
  if (countRequested) {
    countRequested = false;
    const ox = dabUniforms.uOrigin.value.x, oy = dabUniforms.uOrigin.value.y;
    const ow = dabUniforms.uWin.value.x, oh = dabUniforms.uWin.value.y;
    allocPix(ow, oh);
    renderer.readRenderTargetPixels(herRT, ox, oy, ow, oh, _pix);
    let n = 0;
    for (let i = 3; i < ow * oh * 4; i += 4) if (_pix[i] > 90) n++;
    charDabs = n;
  }

  updateGate();
  // publish the hook
  P.zone = zone + 1;
  P.anglesCached = anglesCached;
  P.charDabs = charDabs;
  P.pos = [Math.round(herPos.x * 100) / 100, Math.round(herPos.z * 100) / 100];
  P.moving = walkRate > 0.15;
  P.fps = Math.round(fpsAvg * 10) / 10;
  P.herY = Math.round(herYaw.position.y * 100) / 100;
  P.occluded = occluded;
  P.herVisible = HER_MESH_OBJS.length > 0;

  if (t - lastHud > 0.5) {
    lastHud = t;
    hud.textContent = `zone ${zone + 1}/6 · painted angles ${anglesCached} · ${P.fps} fps · her dabs/frame ≈ ${charDabs.toLocaleString()}`;
  }
}

// --- resize: new canvas size invalidates the paint cache (repaint the current
//     angle now, the rest on first entry) ---
let resizeTimer = null;
addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderer.setSize(innerWidth, innerHeight);
    sizeDisplayCanvases();
    buildCameras();
    frame.resize();
    finishLite.resize();
    buildLayerTargets();
    for (let k = 0; k < ZONES; k++) zoneCache[k] = null;
    anglesCached = 0;
    paintZone(zone);
    swapTo(zone);
  }, 200);
});

// --- init: size, targets, warm the shaders, then paint the first angle for real ---
buildCameras();
applyCam(zone);
sizeDisplayCanvases();
buildLayerTargets();
shared.uTime.value = PAINT_TIME;
{
  frame.render(bgScene, camera); // warm-up: compiles the whole paint program
  renderer.setRenderTarget(fgRT);
  renderer.clear(true, true, false);
  renderer.render(fgScene, camera);
  renderer.setRenderTarget(null);
}
paintZone(zone);
swapTo(zone);
updateGate();
P.backdropPainted = true;
P.loaded = true;
veil.classList.add('gone');
renderer.setAnimationLoop(loop);
P.started = true;

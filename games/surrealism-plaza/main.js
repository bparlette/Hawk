// Surrealism Plaza — the Painted Live fountain plaza as a dream: the same set, the same
// Juniper walk figure, the same controls and painter — but the plaza is lit like day under an
// evening sky (Magritte's Empire of Light), the finish pass bends space itself in a slow melt
// that eases to nothing where she stands, and the shadows obey a different, lower sun than the
// light does, so they stretch far past what the highlights allow (the dream's impossible
// shadows). Drifting orbs of light hang in the air. She roams under a floating joystick
// (gamepress gptouch standard) or WASD/arrows, with a smooth follow camera.
//   ?paint=rich    full part-1 dab density (default: smooth = the proof's reduced video density)
//   ?paint=smooth  reduced density + smaller drawing buffer — the real-time default
// Performance note: the painter repaints every dab every frame; on a real phone GPU that is
// the intended load, on this VM's SwiftShader it crawls — judge speed on a phone, not here.
import * as THREE from 'three';
import { createShared, COMMON, EXTENT, LAND_RES } from './src/oilpaint/common.js';
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
const CAPTURE = q.has('capture'); // no live loop: the headless test steps the sim and renders on demand
const RICH = q.get('paint') === 'rich' || q.has('dense');
const DENSE = RICH;

// preserveDrawingBuffer in capture mode only: like the proof pages, so a headless
// compositor screenshot can read the on-demand frame back; the live loop presents
// continuously and does not need it.
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(RICH ? 1 : 0.8);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('view').appendChild(renderer.domElement);

// --- the light says one thing, the shadows say another ---
const SUN = new THREE.Vector3(-0.55, 0.68, 0.48).normalize(); // the light's sun: high, warm, honest — this is what highlights obey
// The shadows' sun: twisted half a radian round and dropped to a ~20° elevation the light never
// admits to. The shade system bakes and draws from THIS sun only (see createShade below and
// shade.js), so every shadow in the plaza stretches ~2.5× too long and falls a little sideways
// of where it should — the oldest cue in painted dreams.
const SHADOW_SUN = SUN.clone();
SHADOW_SUN.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5);
{
  const horiz = Math.hypot(SHADOW_SUN.x, SHADOW_SUN.z);
  const targetH = Math.cos(0.35); // ~20° elevation
  SHADOW_SUN.x *= targetH / horiz;
  SHADOW_SUN.z *= targetH / horiz;
  SHADOW_SUN.y = Math.sin(0.35);
  SHADOW_SUN.normalize();
}
const shared = createShared();
shared.tBrush.value = createBrushSheet();
shared.uSunDir.value.copy(SUN);
shared.uImpasto.value = 0.1; // cartoon paint lies flat: almost no relief for the light to rake across
shared.uHaze.value.setRGB(0.30, 0.36, 0.62); // the air itself is evening blue now…
shared.uHazeSun.value.setRGB(1.0, 0.82, 0.55); // …but it warms where it looks toward the afterglow
shared.uHazeGlow.value.setRGB(0.1, 0.08, 0.03);
shared.uHazeDensity.value = 0.0038; // more air than the day plaza: distance dissolves a little, dreamlike
shared.uBounce.value.setRGB(0.14, 0.1, 0.05);
shared.uGlazeMul.value.setRGB(0.42, 0.40, 0.78); // her long shadow on the ground: a deeper plum, so the stretch reads
shared.uGlazeAdd.value.setRGB(0.02, 0.02, 0.05);
shared.uShadeBias.value = 0.0012; // the shadow sun grazes: a touch more bias keeps the long shade clean of acne

// --- flat land: the plaza is level, so the height map is all zeros and the land map unused ---
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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.3, 1600);
// Her spawn: on the fountain ring, south-east of the fountain, the plaza opening up in front.
const herPos = new THREE.Vector3(3.01, 0, 3.74);
const CAM_AZ = Math.atan2(12.5, 15.5); // the proof camera's azimuth — the follow cam keeps it
const CAM_R = 7.5, CAM_H = 3.0;
camera.position.set(herPos.x + Math.sin(CAM_AZ) * CAM_R, CAM_H, herPos.z + Math.cos(CAM_AZ) * CAM_R);
camera.lookAt(herPos.x, 1.0, herPos.z);

// --- the sky, unchanged from the wood (a wash, then broad strokes of it) ---
const sky = createSky(shared);
scene.add(sky.group);

// --- the ground underpainting: broad warm stone that shows between the dabs ---
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
        vec3 c = mix(vec3(0.78, 0.68, 0.52), vec3(0.86, 0.77, 0.61), n);
        c = mix(c, vec3(0.68, 0.66, 0.58), smoothstep(18.0, 42.0, rad)); // the town goes on, duller, past the plaza
        outC = vec4(c * 0.92, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.05;
  m.frustumCulled = false;
  m.renderOrder = -5;
  scene.add(m);
}

// --- the plaza ground: stone dabs in rings, lying flat, in concentric paving bands ---
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
  // two bright stones in a coarse checker, and darker inlay rings round the fountain;
  // the shade tone is cool — cartoon shadow runs blue, not brown
  float check = mod(floor(xz.x / 1.4) + floor(xz.y / 1.4), 2.0);
  vec3 L = mix(vec3(1.02, 0.94, 0.77), vec3(0.97, 0.86, 0.65), check);
  vec3 M = mix(vec3(0.87, 0.75, 0.56), vec3(0.79, 0.66, 0.49), check);
  vec3 S = vec3(0.33, 0.35, 0.60); // shade sinks a little deeper toward indigo: the long shadows must read at a glance
  vec3 c = paint3(L, M, S, lit, q.y);
  float band = smoothstep(0.32, 0.0, abs(rad - 6.4) - 0.16) + smoothstep(0.32, 0.0, abs(rad - 11.2) - 0.16);
  c = mix(c, c * vec3(0.7, 0.6, 0.58), clamp(band, 0.0, 1.0) * 0.85);
  c = mix(c, paint3(vec3(1.0, 0.95, 0.84), vec3(0.86, 0.78, 0.64), S, lit, q.y), smoothstep(4.8, 3.2, rad)); // paler apron at the fountain
  c = mix(c, c * vec3(0.88, 0.86, 0.8), smoothstep(19.0, 40.0, rad)); // duller past the plaza's edge
  c = jitter(c, r.wzy, 0.45);
  vec2 radial = rad > 0.01 ? xz / rad : vec2(1.0, 0.0);
  d.dir = vec3(radial.x, 0.0, radial.y); // strokes run outward from the fountain, like spokes of the paving
  d.pos = P;
  d.size = uCell0 * vec2(1.05 + 0.5 * r.z, 1.7 + 0.9 * r.w) * lod;
  d.c1 = hazed(c, P);
  d.c2 = d.c1; // one flat colour per ground patch: no second tone streaked through it
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = vec3(0.0, 1.0, 0.0);
  d.height = (0.02 + 0.05 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}`;
const plaza = groundRings(shared, { body: plazaBody, per: DENSE ? 3 : 2, n: 192, cell0: 0.24, levels: 6, minPx: [8, 14], maxPx: [4000, 4000], cells: [0, 8] });
scene.add(plaza.group);

// --- how the kit's paint is lit on a day like this ---
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

const kit = createKit(shared, {
  seed: 417, haze: true, order: 3,
  palettes: {
    // bright, clean storybook colours; every shade tone tipped cool (blue-violet), the cel way
    stone: { l: [1.0, 0.93, 0.76], m: [0.88, 0.78, 0.6], s: [0.42, 0.44, 0.62], own: [0.92, 0.82, 0.62] },
    stonePale: { l: [1.05, 1.0, 0.88], m: [0.93, 0.87, 0.73], s: [0.5, 0.52, 0.68], own: [0.97, 0.92, 0.77] },
    cream: { l: [1.04, 0.97, 0.82], m: [0.91, 0.81, 0.65], s: [0.48, 0.47, 0.65], own: [0.96, 0.89, 0.72] },
    rose: { l: [1.02, 0.77, 0.67], m: [0.89, 0.59, 0.53], s: [0.47, 0.35, 0.52], own: [0.92, 0.62, 0.47] },
    timber: { l: [0.56, 0.39, 0.23], m: [0.41, 0.27, 0.16], s: [0.2, 0.16, 0.26], own: [0.52, 0.35, 0.2] },
    bark: { l: [0.49, 0.36, 0.23], m: [0.35, 0.25, 0.16], s: [0.17, 0.15, 0.22], own: [0.42, 0.32, 0.2] },
    tile: { l: [0.98, 0.49, 0.29], m: [0.79, 0.36, 0.21], s: [0.45, 0.23, 0.32], own: [0.87, 0.42, 0.22] },
    tealRoof: { l: [0.35, 0.75, 0.71], m: [0.23, 0.56, 0.55], s: [0.12, 0.33, 0.44], own: [0.27, 0.62, 0.57] },
    awningRed: { l: [0.98, 0.31, 0.25], m: [0.81, 0.21, 0.19], s: [0.47, 0.15, 0.28], own: [0.87, 0.24, 0.18] },
    awningGold: { l: [1.03, 0.81, 0.33], m: [0.87, 0.63, 0.21], s: [0.49, 0.37, 0.22], own: [0.96, 0.7, 0.24] },
    glass: { l: [0.46, 0.66, 0.86], m: [0.31, 0.49, 0.73], s: [0.16, 0.27, 0.51], own: [0.24, 0.42, 0.66] },
    pot: { l: [0.9, 0.49, 0.31], m: [0.71, 0.36, 0.23], s: [0.41, 0.23, 0.3], own: [0.82, 0.42, 0.24] },
    fruit: { l: [1.02, 0.61, 0.17], m: [0.87, 0.45, 0.11], s: [0.51, 0.27, 0.15], own: [0.96, 0.52, 0.14] },
  },
  light: KIT_LIGHT,
});
const slab = (cx, cy, cz, rotX, rotZ, w, thick, len, pal, grain) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, rotZ)),
    new THREE.Vector3(1, 1, 1));
  kit.add(new THREE.BoxGeometry(w, thick, len), m, pal, { grain: new THREE.Vector3(...grain), stroke: [0.09, 0.3] });
};

// --- house A: cream, terracotta roof, ridge along x ---
kit.box(-7.5, 2.2, -13, 8, 4.4, 6, 'cream', { stroke: [0.09, 0.26] });
kit.tri([-3.5, 4.4, -16], [-3.5, 6.3, -13], [-3.5, 4.4, -10], 'cream', { stroke: [0.09, 0.24] });
kit.tri([-11.5, 4.4, -10], [-11.5, 6.3, -13], [-11.5, 4.4, -16], 'cream', { stroke: [0.09, 0.24] });
slab(-7.5, 5.32, -11.55, 0.564, 0, 8.9, 0.16, 3.9, 'tile', [0, -0.5, 0.85]);
slab(-7.5, 5.32, -14.45, -0.564, 0, 8.9, 0.16, 3.9, 'tile', [0, -0.5, -0.85]);
kit.box(-9.6, 5.4, -14.6, 0.95, 2.8, 0.95, 'stone', { stroke: [0.08, 0.2] });
kit.box(-7.5, 1.05, -9.92, 1.15, 2.1, 0.16, 'timber', { grain: 'y' });
kit.box(-9.9, 2.7, -9.92, 1.3, 1.5, 0.14, 'glass');
kit.box(-5.1, 2.7, -9.92, 1.3, 1.5, 0.14, 'glass');
kit.box(-7.5, 3.45, -9.92, 0.9, 1.0, 0.14, 'glass');
kit.box(-7.5, 0.09, -9.35, 1.7, 0.18, 0.95, 'stone');

// --- house B: rose, verdigris roof ---
kit.box(6, 1.9, -13.5, 7, 3.8, 5.5, 'rose', { stroke: [0.09, 0.24] });
kit.tri([9.5, 3.8, -16.25], [9.5, 5.5, -13.5], [9.5, 3.8, -10.75], 'rose', { stroke: [0.09, 0.22] });
kit.tri([2.5, 3.8, -10.75], [2.5, 5.5, -13.5], [2.5, 3.8, -16.25], 'rose', { stroke: [0.09, 0.22] });
slab(6, 4.62, -12.15, 0.554, 0, 7.6, 0.16, 3.6, 'tealRoof', [0, -0.5, 0.85]);
slab(6, 4.62, -14.85, -0.554, 0, 7.6, 0.16, 3.6, 'tealRoof', [0, -0.5, -0.85]);
kit.box(6, 0.95, -10.68, 1.05, 1.9, 0.16, 'timber', { grain: 'y' });
kit.box(3.9, 2.3, -10.68, 1.15, 1.3, 0.14, 'glass');
kit.box(8.1, 2.3, -10.68, 1.15, 1.3, 0.14, 'glass');

// --- market stalls, east (red awning) and west (gold) ---
for (const s of [1, -1]) {
  const cx = 12.5 * s, cz = s > 0 ? -3 : 2, awn = s > 0 ? 'awningRed' : 'awningGold';
  for (const px of [11.6, 13.4]) for (const pz of [cz - 1.7, cz + 1.7]) kit.box(px * s, 1.15, pz, 0.12, 2.3, 0.12, 'timber', { grain: 'y' });
  kit.box(11.9 * s, 0.55, cz, 0.9, 1.1, 3.6, 'timber', { stroke: [0.08, 0.3] });
  kit.box(13.3 * s, 0.5, cz, 0.5, 1.0, 3.4, 'timber', { stroke: [0.08, 0.28] });
  slab(cx, 2.62, cz, 0, 0.3 * s, 3.4, 0.09, 4.2, awn, [-s, 0, 0]);
  kit.box(11.8 * s, 0.3, cz - 2.3, 0.6, 0.6, 0.6, 'timber');
  kit.box(11.8 * s, 0.85, cz - 2.3, 0.5, 0.5, 0.5, 'timber', { tone: 0.85 });
  kit.round(13.2 * s, 0.28, cz + 2.4, 0.26, 0.56, 'pot', { sides: 10, stroke: [0.05, 0.12] });
  for (let i = 0; i < 5; i++) kit.add(new THREE.SphereGeometry(0.09, 8, 6), kit.place(11.9 * s, 1.17, cz - 0.8 + i * 0.4), 'fruit', { smooth: true, stroke: [0.04, 0.07] });
}

// --- the fountain ---
kit.round(0, 0.34, 0, 2.6, 0.68, 'stone', { sides: 22, stroke: [0.09, 0.24] });
kit.round(0, 0.72, 0, 2.72, 0.12, 'stonePale', { sides: 22, stroke: [0.08, 0.2] });
kit.round(0, 0.8, 0, 0.44, 1.6, 'stone', { sides: 14, stroke: [0.07, 0.18] });
kit.round(0, 1.62, 0, 1.08, 0.2, 'stonePale', { sides: 18, stroke: [0.07, 0.16] });
kit.round(0, 1.8, 0, 0.07, 0.26, 'stone', { sides: 8 });
kit.add(new THREE.SphereGeometry(0.17, 10, 8), kit.place(0, 1.98, 0), 'stonePale', { smooth: true, stroke: [0.05, 0.09] });
// trees' trunks ride in the same kit
for (const [tx, tz] of [[-12, -7.5], [12, -9.5], [-13, 7]]) kit.round(tx, 1.15, tz, 0.17, 2.3, 'bark', { sides: 8, stroke: [0.06, 0.22] });
const built = kit.build();
scene.add(built.group);

// --- the water: its own kit, lit by the sky it gives back and the sun's glint ---
const waterKit = createKit(shared, {
  seed: 99, haze: true, order: 4,
  palettes: { water: { l: [0.62, 0.9, 1.02], m: [0.31, 0.71, 0.96], s: [0.16, 0.46, 0.81], own: [0.4, 0.78, 0.97] } },
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
scene.add(waterKit.build().group);

// --- trees: dark crowns for underpainting, then dabs over them (the pines' way, in leaf) ---
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
    for (let i = 0, n = DENSE ? 380 : 220; i < n; i++) {
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
      void main() { outC = vec4(vec3(0.16, 0.32, 0.13) * (0.7 + 0.5 * max(normalize(vN).y, 0.0)), 1.0); }`,
  });
  for (const { c, r } of crownUnder) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r * 0.96, 12, 9), underMat);
    s.position.set(...c);
    s.frustumCulled = false;
    scene.add(s);
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
      vec3 c = paint3(vec3(0.58, 0.87, 0.35), vec3(0.36, 0.69, 0.26), vec3(0.15, 0.39, 0.24), x, r.y);
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
  minPx: [5, 9], maxPx: [120, 240], cells: [0, 8],
}), 3);
scene.add(crowns);

// --- the fountain's water in the air: crown jets, rim drips, and glints on the pool ---
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
scene.add(jets);
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
scene.add(sparkles);

// --- the dream's motes: slow orbs of light drifting through the air, going nowhere, in no hurry.
//     Points with a soft radial falloff, warm gold and cool blue mixed, each on its own slow
//     sine drift (done in the vertex shader off uTime, so they move even between sim steps and
//     cost nothing on the CPU). They are in the world, not on the screen: they parallax as she
//     walks and hide behind the fountain like anything else real.
{
  const MOTES = 30;
  const pos = new Float32Array(MOTES * 3), seed = new Float32Array(MOTES);
  const rand = rng(777);
  for (let i = 0; i < MOTES; i++) {
    const a = rand() * Math.PI * 2, rad = 2.5 + rand() * 12.0;
    pos.set([Math.cos(a) * rad, 0.4 + rand() * 3.0, Math.sin(a) * rad], i * 3);
    seed[i] = rand() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uTime: shared.uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      in float aSeed;
      out float vTw; out float vSeed;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.10 + aSeed * 1.7) * 0.9;
        p.y += sin(uTime * 0.07 + aSeed * 2.3) * 0.4;
        p.z += cos(uTime * 0.08 + aSeed * 1.1) * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.25 + fract(aSeed) * 0.3) + aSeed * 3.1));
        vSeed = aSeed;
        float diam = 0.07 + fract(aSeed * 0.37) * 0.08; // metres across: a coal of light, not a moon
        gl_PointSize = diam * 820.0 / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      in float vTw; in float vSeed;
      layout(location = 0) out vec4 outC;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        a *= a;
        vec3 c = mix(vec3(1.0, 0.78, 0.45), vec3(0.62, 0.78, 1.0), step(0.5, fract(vSeed * 0.61)));
        outC = vec4(c * a * vTw * 0.5, 1.0);
      }`,
  });
  const motes = new THREE.Points(geo, mat);
  motes.frustumCulled = false;
  motes.renderOrder = 23;
  scene.add(motes);
}

// --- the still world's shade, baked once from plain shapes. (No stand-in for her here — unlike
//     the on-the-spot proof, she roams, so her shadow comes from the shade system's second
//     picture, redrawn round her every frame; her meshes ride layer 1 so that camera sees her.)
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
const shade = createShade(renderer, shared, shadeScene, { sun: SHADOW_SUN, size: [2048, 2048], box: [30, 26], centre: [0, 1, -3], back: 110, near: 30, far: 240 });

// --- Her, walking: the Juniper walk GLB under this same painter. Her own texture colours are
//     posterised into the painter's three mixes (light = texel warmed up, mid = texel, shade =
//     texel cooled down) and lit by the same sun and shade pictures as everything else.
//     The clip plays on her bones; her hips are re-anchored over herPos every tick so her body —
//     not the bone — stays where the controls put her, and she travels at the speed her stride
//     was measured to cover (see REF_SPEED below), so feet and ground agree.
function paintTex(shared, srcMat) {
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
        vec3 L = min(tex * 1.55 + vec3(0.05, 0.04, 0.02), vec3(1.2));
        vec3 S = tex * vec3(0.36, 0.4, 0.64); // her shade tone runs cool blue, the cel way
        vec3 c = paint3(L, tex, S, lit, n);
        c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
        c = mix(c, c * vec3(0.86, 0.92, 1.18), (1.0 - lit) * max(Nn.y, 0.0) * 0.6);
        c *= 0.95 + 0.1 * m; // near-flat: the texture's own variation carries her, not a noise wash
        if (!gl_FrontFacing) c *= 0.62;
        // her outline: where her surface turns edge-on to the eye, lay the dark line a cartoonist inks
        vec3 V = normalize(cameraPosition - vWorld);
        float line = smoothstep(0.36, 0.17, clamp(dot(Nn, V), 0.0, 1.0));
        c = mix(c, vec3(0.09, 0.07, 0.11), line * 0.8);
        outC = vec4(hazed(c, vWorld), 1.0);
      }`,
  });
}
const gltf = await new GLTFLoader().loadAsync('./assets/juniper_walk.glb');
const HER_MESH_OBJS = [];
let hipsBone = null, footL = null, footR = null;
gltf.scene.traverse((o) => {
  if (o.isMesh) {
    o.material = paintTex(shared, o.material);
    o.frustumCulled = false;
    o.layers.enable(1); // the shade system's figure camera (layer 1) must see her for her shadow
    HER_MESH_OBJS.push(o);
  }
  if (o.name === 'bone_2') hipsBone = o;
  if (o.name === 'bone_7') footL = o;
  if (o.name === 'bone_8') footR = o;
});
let heading = CAM_AZ + Math.PI; // spawn facing the fountain, away from the camera
const herYaw = new THREE.Group();
herYaw.position.copy(herPos);
herYaw.rotation.y = heading;
const herShift = new THREE.Group();
const herInner = gltf.scene;
herInner.scale.setScalar(1.55 / 160.3); // first guess; calibration below measures her true height
herShift.add(herInner);
herYaw.add(herShift);
scene.add(herYaw);
const mixer = new THREE.AnimationMixer(herInner);
const clip = gltf.animations.find((a) => a.name === 'WalkRetarget') || gltf.animations[0];
const CLIP_NAME = clip.name, CLIP_DUR = clip.duration;
const walkAction = mixer.clipAction(clip);
walkAction.play();
let WIN_T0 = 0, WIN_LEN = CLIP_DUR; // the seamless gait window inside the clip, measured in calibration
const _hv = new THREE.Vector3();
let BODY_OFF = { x: 0, z: 0 }; // hips-bone to body-centre offset, measured in calibration
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

// --- Calibrate from her own skinned vertices. Box3.setFromObject reads bind-pose boxes and the
//     rig's helper empties and lies about this mesh, so: sample the skin at t = 0, scale until she
//     stands 1.55 m, rest her feet on the plaza, record how far her body centre sits from her hips
//     bone — and measure her stride: each foot's fore-aft travel relative to the anchored hips is
//     one stride length, two strides per cycle, so REF_SPEED = 2 * stride / cycle makes the clip's
//     feet agree with her travel at timeScale 1.
const CALIB = {};
let REF_SPEED = 1.25;
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
  CALIB.heightAtGuess = b.hi.y - b.lo.y;
  herInner.scale.multiplyScalar(1.55 / CALIB.heightAtGuess);
  b = bounds();
  CALIB.heightAfter = b.hi.y - b.lo.y;
  CALIB.feetY = b.lo.y;
  herShift.position.y = -b.lo.y;
  hipsBone.getWorldPosition(_hv);
  herYaw.worldToLocal(_hv);
  const cLocal = new THREE.Vector3((b.lo.x + b.hi.x) / 2, 0, (b.lo.z + b.hi.z) / 2);
  herYaw.worldToLocal(cLocal);
  BODY_OFF = { x: cLocal.x - _hv.x, z: cLocal.z - _hv.z };
  CALIB.bodyOff = { ...BODY_OFF };
  anchorHips();
  // stride + gait-cycle measurement: sample the whole clip once, tracking both feet's
  // fore-aft travel and the hips bob (two bobs per cycle — the loop window and REF_SPEED
  // both come from the measured cycle, not the raw clip length).
  if (footL && footR && hipsBone) {
    const N = 160, ranges = [Infinity, -Infinity, Infinity, -Infinity], hipYs = [];
    const fv = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      mixer.setTime((i / N) * CLIP_DUR);
      anchorHips();
      footL.getWorldPosition(fv); herYaw.worldToLocal(fv);
      ranges[0] = Math.min(ranges[0], fv.z); ranges[1] = Math.max(ranges[1], fv.z);
      footR.getWorldPosition(fv); herYaw.worldToLocal(fv);
      ranges[2] = Math.min(ranges[2], fv.z); ranges[3] = Math.max(ranges[3], fv.z);
      hipsBone.getWorldPosition(fv); hipYs.push(fv.y);
    }
    const stride = ((ranges[1] - ranges[0]) + (ranges[3] - ranges[2])) / 2;
    CALIB.stride = stride;
    const mn = Math.min(...hipYs), mx = Math.max(...hipYs), th = mn + 0.65 * (mx - mn);
    const sm = hipYs.map((_, i) => { // 5-sample moving average: the bob is smooth, sampling noise is not
      let s = 0, c = 0;
      for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < hipYs.length) { s += hipYs[j]; c++; } }
      return s / c;
    });
    const rawPeaks = [];
    for (let i = 1; i < N; i++) {
      if (sm[i] > th && sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1]) rawPeaks.push(i);
    }
    const peaks = []; // merge peaks closer than 0.35 s (a stride's double-bump), keeping the higher
    for (const i of rawPeaks) {
      const prev = peaks[peaks.length - 1];
      if (prev !== undefined && (i - prev) / N * CLIP_DUR < 0.35) { if (sm[i] > sm[prev]) peaks[peaks.length - 1] = i; }
      else peaks.push(i);
    }
    for (let i = 0; i < peaks.length; i++) peaks[i] = (peaks[i] / N) * CLIP_DUR;
    const spacings = [];
    for (let i = 1; i < peaks.length; i++) spacings.push(peaks[i] - peaks[i - 1]);
    spacings.sort((a, b) => a - b);
    const bob = spacings.length ? spacings[Math.floor(spacings.length / 2)] : 0;
    const cycle = bob * 2;
    if (peaks.length >= 3 && cycle > 0.8 && cycle < 2.2) { WIN_T0 = peaks[0]; WIN_LEN = cycle; }
    CALIB.bobPeriod = bob; CALIB.cycle = WIN_LEN; CALIB.winT0 = WIN_T0;
    if (stride > 0.1) REF_SPEED = THREE.MathUtils.clamp(2 * stride / WIN_LEN, 0.5, 2.0);
  }
  CALIB.refSpeed = REF_SPEED;
  mixer.setTime(0);
  anchorHips();
}

// --- input: gptouch floating stick (the gamepress standard) merged with keyboard, plus a
//     scripted drive vector the headless test steers with. getInput() is read once per frame.
const TC = (isTouchDevice() || q.has('forcetouch'))
  ? new TouchController({ buttons: [{ id: 'a', label: '🏃', size: 84 }] }) : null;
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
let frameInput = { x: 0, y: 0, a: false };
let scriptDrive = { x: 0, y: 0 };
function pollInput() {
  let x = 0, y = 0, a = false;
  if (TC) { const ti = TC.getInput(); x += ti.x; y += ti.y; a = !!ti.a; }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) a = true;
  if (scriptDrive.x !== 0 || scriptDrive.y !== 0) { x = scriptDrive.x; y = scriptDrive.y; }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  frameInput = { x, y, a };
}

// --- movement: camera-relative steering, she turns to face where she goes, the clip's rate
//     follows her speed, and soft colliders keep her in the plaza and out of the fountain.
let speed = 0, clipRate = 0, moving = false, clipT = WIN_T0;
const CIRCLES = [
  { x: 0, z: 0, r: 3.35 },              // the fountain
  { x: 12.5, z: -3, r: 2.1 }, { x: -12.5, z: 2, r: 2.1 }, // the stalls
  { x: -12, z: -7.5, r: 0.55 }, { x: 12, z: -9.5, r: 0.55 }, { x: -13, z: 7, r: 0.55 }, // trunks
];
const BOXES = [
  { x0: -11.9, x1: -3.1, z0: -16.4, z1: -9.55 },  // house A
  { x0: 2.1, x1: 9.9, z0: -16.65, z1: -10.4 },    // house B
];
function resolveCollisions() {
  const d = Math.hypot(herPos.x, herPos.z);
  if (d > 15.5) { herPos.x *= 15.5 / d; herPos.z *= 15.5 / d; }
  for (const c of CIRCLES) {
    const dx = herPos.x - c.x, dz = herPos.z - c.z, dd = Math.hypot(dx, dz);
    if (dd < c.r && dd > 1e-6) { herPos.x = c.x + (dx / dd) * c.r; herPos.z = c.z + (dz / dd) * c.r; }
  }
  for (const bx of BOXES) {
    if (herPos.x > bx.x0 && herPos.x < bx.x1 && herPos.z > bx.z0 && herPos.z < bx.z1) {
      const pl = herPos.x - bx.x0, pr = bx.x1 - herPos.x, pb = herPos.z - bx.z0, pf = bx.z1 - herPos.z;
      const m = Math.min(pl, pr, pb, pf);
      if (m === pl) herPos.x = bx.x0; else if (m === pr) herPos.x = bx.x1;
      else if (m === pb) herPos.z = bx.z0; else herPos.z = bx.z1;
    }
  }
}
const _fwd = new THREE.Vector3(), _wish = new THREE.Vector3();
function stepMove(dt) {
  _fwd.set(herPos.x - camera.position.x, 0, herPos.z - camera.position.z);
  if (_fwd.lengthSq() < 1e-6) _fwd.set(-Math.sin(CAM_AZ), 0, -Math.cos(CAM_AZ)); else _fwd.normalize();
  const rx = -_fwd.z, rz = _fwd.x; // camera right on the ground
  _wish.set(rx * frameInput.x + _fwd.x * -frameInput.y, 0, rz * frameInput.x + _fwd.z * -frameInput.y);
  const wishMag = Math.min(1, _wish.length());
  const baseMax = THREE.MathUtils.clamp(REF_SPEED * 1.7, 0.9, 1.6);
  const maxSpeed = baseMax * (frameInput.a ? 1.4 : 1);
  const target = wishMag * maxSpeed;
  const accel = target > speed ? 5 : 7.5;
  speed += THREE.MathUtils.clamp(target - speed, -accel * dt, accel * dt);
  if (wishMag > 0.02 && speed > 0.001) {
    _wish.normalize();
    herPos.addScaledVector(_wish, speed * dt);
    const want = Math.atan2(_wish.x, _wish.z);
    let diff = want - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    heading += THREE.MathUtils.clamp(diff, -10 * dt, 10 * dt);
  }
  resolveCollisions();
  herYaw.position.copy(herPos);
  herYaw.rotation.y = heading;
  moving = speed > 0.05;
  // the clip eases with her: rate 1 is the measured natural stride speed, and playback
  // loops inside the measured gait window so the cycle never hitches at the clip's ends
  const targetRate = REF_SPEED > 0 ? Math.min(speed / REF_SPEED, 2.6) : 0;
  clipRate += (targetRate - clipRate) * Math.min(1, dt * 7);
  if (clipRate < 0.001 && speed < 0.01) clipRate = 0;
  clipT += dt * clipRate;
  mixer.setTime(WIN_T0 + ((((clipT - WIN_T0) % WIN_LEN) + WIN_LEN) % WIN_LEN));
  anchorHips();
}

// --- the canvas finish: where the dream warp, bloom and grade live (see finish.js) ---
const frame = createFrame(renderer, shared);
frame.uniforms.uShafts.value = 0.55; // more air-glow than the day plaza: the light stands in the mist
frame.uniforms.uCanvas.value = 0; // no canvas weave: a cartoon is printed, not woven
frame.uniforms.uOutline.value = 0.45; // the ink line softens — dreams don't rule their edges
frame.uniforms.uOutlineCol.value.setRGB(0.05, 0.04, 0.13); // and what line remains is indigo, not black

// --- run: fixed-step simulation (the renderer's frame rate is not the game's clock),
//     one repaint per animation frame, camera trailing her at the proof's azimuth.
let time = 0, started = false, loaded = false;
const size = new THREE.Vector2();
function simTick(dt) {
  time += dt;
  stepMove(dt);
  shared.uTime.value = time;
}
const _camWant = new THREE.Vector3();
function render(rdt) {
  _camWant.set(herPos.x + Math.sin(CAM_AZ) * CAM_R, CAM_H, herPos.z + Math.cos(CAM_AZ) * CAM_R);
  const k = 1 - Math.exp(-Math.max(rdt, 0.001) * 3.5);
  camera.position.lerp(_camWant, k);
  camera.lookAt(herPos.x, 1.0, herPos.z);
  renderer.getDrawingBufferSize(size);
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
  shared.uFocus.value.set(herPos.x, 1.0, herPos.z);
  plaza.follow(camera.position.x, camera.position.z);
  shade.update(scene, herPos);
  frame.render(scene, camera);
}
const fpsDeltas = [];
let lastCaptureFrameMs = 0;
window.__paint = {
  started: false, loaded: false,
  get pos() { return { x: herPos.x, z: herPos.z }; },
  get moving() { return moving; },
  get fps() {
    if (fpsDeltas.length) {
      const avg = fpsDeltas.reduce((s, v) => s + v, 0) / fpsDeltas.length;
      return avg > 0 ? 1000 / avg : 0;
    }
    return lastCaptureFrameMs > 0 ? 1000 / lastCaptureFrameMs : 0;
  },
  frameMs() { return lastCaptureFrameMs; },
  drive(x, y) { scriptDrive = { x: x || 0, y: y || 0 }; },
  stick() { return { ...frameInput }; },
  info: { clip: CLIP_NAME, clipDuration: CLIP_DUR, refSpeed: REF_SPEED, calib: CALIB, dense: DENSE },
};
{
  // warm-up at the spawn pose (input is zero): shaders compiled, shade drawn, rings settled
  pollInput();
  for (let i = 0; i < 3; i++) { simTick(1 / 60); }
  render(1 / 60);
  loaded = true; started = true;
  window.__paint.loaded = true; window.__paint.started = true;
  const lo = document.getElementById('loading');
  if (lo) lo.style.display = 'none';
  const STEP = 1 / 60;
  if (CAPTURE) {
    // On-demand stepping for headless verification: advance the sim, repaint once, and
    // finish the GL work before returning, so a compositor screenshot sees a real frame
    // instead of an ever-growing queue of unpainted ones (SwiftShader falls behind live).
    window.__paint.step = (simSteps = 15) => {
      const t0 = performance.now();
      pollInput();
      for (let i = 0; i < simSteps; i++) simTick(STEP);
      render(1 / 60);
      renderer.getContext().finish();
      lastCaptureFrameMs = performance.now() - t0;
      return lastCaptureFrameMs;
    };
  } else {
    let last = performance.now(), acc = 0;
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const rdt = Math.min((now - last) / 1000, 0.25);
      if (last !== now) { fpsDeltas.push(now - last); if (fpsDeltas.length > 30) fpsDeltas.shift(); }
      last = now;
      pollInput();
      acc += rdt;
      let n = 0;
      while (acc >= STEP && n < 10) { simTick(STEP); acc -= STEP; n++; }
      if (n === 10) acc = 0;
      render(rdt);
    });
  }
}
// --- paint quality toggle: density is baked into the dab fields, so the button reloads
//     the page in the other mode (cheap, honest, and exactly one tap on a phone).
{
  const btn = document.getElementById('paintBtn');
  btn.textContent = RICH ? 'Paint: Rich' : 'Paint: Smooth';
  btn.addEventListener('click', () => {
    const u = new URL(location.href);
    u.searchParams.set('paint', RICH ? 'smooth' : 'rich');
    location.href = u.toString();
  });
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  frame.resize();
});

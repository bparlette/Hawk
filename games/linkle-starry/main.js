// Linkle in the Painted Starry Night — the Juniper walk figure from the oil-paint plaza,
// roaming a village street under Van Gogh's sky, painted live every frame with blendi's
// painter (src/oilpaint): Painted Live, exactly the plaza's proven character setup, with the
// plaza set swapped for a Starry Night set built from the painting itself (deep ultramarine
// shell of flow strokes, the two great swirls, eleven pulsing stars, the crescent moon, a
// dark cypress, and a row of lit-window houses).
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

// --- a moonlit night: high pale light, deep blue air, cool bounce off the street ---
const SUN = new THREE.Vector3(-0.5, 0.62, 0.42).normalize(); // the moon's place for lighting: high and on the camera's side, so she and the house fronts read
const shared = createShared();
shared.tBrush.value = createBrushSheet();
shared.uSunDir.value.copy(SUN);
shared.uHaze.value.setRGB(0.07, 0.10, 0.24);
shared.uHazeSun.value.setRGB(0.45, 0.52, 0.72);
shared.uHazeGlow.value.setRGB(0.03, 0.03, 0.06);
shared.uHazeDensity.value = 0.0028;
shared.uBounce.value.setRGB(0.02, 0.025, 0.05);
shared.uGlazeMul.value.setRGB(0.42, 0.44, 0.62);
shared.uGlazeAdd.value.setRGB(0.008, 0.008, 0.02);

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
// Her spawn: on the village street, the church and the great swirl ahead of her.
const herPos = new THREE.Vector3(3.01, 0, 3.74);
const CAM_AZ = Math.atan2(12.5, 15.5); // the proof camera's azimuth — the follow cam keeps it
const CAM_R = 7.5, CAM_H = 2.0; // lower than the plaza's: the street shot must hold the swirls
camera.position.set(herPos.x + Math.sin(CAM_AZ) * CAM_R, CAM_H, herPos.z + Math.cos(CAM_AZ) * CAM_R);
camera.lookAt(herPos.x, 1.2, herPos.z);

// --- the starry sky: a deep ultramarine dome wash, then the painting's own weather laid over
//     it as dab strokes pinned to a great shell behind the village — the two great swirls,
//     eleven stars and the crescent moon among them, all paint, all in the world, so they
//     parallax against the village as she walks. Painting layout: x runs left to right as the
//     camera sees it, y top to bottom; the shell stands at R ~ 95 m in the looking direction.
const AZV = CAM_AZ + Math.PI; // azimuth of the backdrop's centre
const shellPoint = (px, py, R = 95) => {
  const th = AZV + (0.5 - px) * 0.78;
  return { pos: new THREE.Vector3(Math.sin(th) * R, 4 + (0.76 - py) * 72, Math.cos(th) * R), th };
};
const discBasis = (th) => ({ u: new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), v: new THREE.Vector3(0, 1, 0) });
{ // the dome wash
  const dome = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tNoise;
      in vec3 vDir;
      layout(location = 0) out vec4 outC;
      void main() {
        vec3 v = normalize(vDir);
        float n = texture(tNoise, v.xz * 0.8 + v.y * 0.3).r;
        vec3 c = mix(vec3(0.05, 0.09, 0.26), vec3(0.03, 0.06, 0.22), smoothstep(-0.05, 0.65, v.y));
        c = mix(c, vec3(0.09, 0.14, 0.33), smoothstep(0.16, -0.06, v.y));
        c *= 0.9 + 0.2 * n;
        outC = vec4(c, 1.0);
      }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
}
{ // flow strokes across the shell: level sweeps that curl round the two swirls
  const rand = rng(777);
  const swirls = [
    { ...shellPoint(0.435, 0.375), rad: 34 },
    { ...shellPoint(0.635, 0.465), rad: 24 },
  ];
  const bandY = (th) => {
    const t = THREE.MathUtils.clamp((swirls[0].th - th) / (swirls[0].th - swirls[1].th), 0, 1);
    return THREE.MathUtils.lerp(swirls[0].pos.y, swirls[1].pos.y, t);
  };
  const N = DENSE ? 6000 : 3800;
  const pos = [], dir = [], col = [], seed = [];
  for (let i = 0; i < N; i++) {
    const th = AZV + (rand() * 2 - 1) * 1.02;
    const y = 1.5 + 82 * Math.pow(rand(), 1.2);
    const P = new THREE.Vector3(Math.sin(th) * 95, y, Math.cos(th) * 95);
    const d = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
    d.y += 0.22 * THREE.MathUtils.smoothstep(AZV - th, 0.0, 0.85) - 0.10 * THREE.MathUtils.smoothstep(th - AZV, 0.0, 0.85);
    for (const s of swirls) {
      const to = P.clone().sub(s.pos);
      const dist = to.length();
      const rot = new THREE.Vector3().crossVectors(new THREE.Vector3(Math.sin(s.th), 0, Math.cos(s.th)), to).normalize();
      d.addScaledVector(rot, 1.6 * Math.exp(-(dist * dist) / (s.rad * s.rad)));
    }
    d.normalize();
    const band = Math.exp(-Math.pow((y - bandY(th)) / 13, 2));
    const c = new THREE.Color(0.05 + 0.05 * rand(), 0.10 + 0.06 * rand(), 0.34 + 0.14 * rand());
    c.lerp(new THREE.Color(0.50, 0.60, 0.86), band * (0.35 + 0.45 * rand()));
    if (rand() < 0.05) c.lerp(new THREE.Color(0.75, 0.78, 0.88), 0.5);
    pos.push(P.x, P.y, P.z); dir.push(d.x, d.y, d.z); col.push(c.r, c.g, c.b); seed.push(rand() * 1000);
  }
  const m = dabMesh(dabGeometry(N, {
    aPos: [new Float32Array(pos), 3], aDir: [new Float32Array(dir), 3], aCol: [new Float32Array(col), 3], aSeed: [new Float32Array(seed), 1],
  }), dabMaterial(shared, {
    head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aCol; in float aSeed;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aSeed);
        d.pos = aPos;
        d.dir = aDir;
        d.size = vec2(3.2 + 2.0 * r.x, 6.0 + 5.0 * r.y);
        d.c1 = jitter(aCol, r.wzy, 0.3);
        d.c2 = jitter(aCol * 1.18, r.zyx, 0.3);
        d.seed = aSeed;
        d.lift = 0.0;
      }`,
    minPx: [6, 12], maxPx: [420, 760], cells: [0, 8], depthTest: false, depthWrite: false,
  }), -9);
  scene.add(m);
}
// one swirl of the painting: dabs laid along a tightening spiral, pale at the heart
function swirlMesh(px, py, radius, count, seedBase) {
  const { pos: C, th } = shellPoint(px, py, 93);
  const { u, v } = discBasis(th);
  const rand = rng(seedBase);
  const pos = [], dir = [], col = [], sd = [];
  for (let i = 0; i < count; i++) {
    const rho = radius * Math.pow(rand(), 0.62);
    const phi = rand() * Math.PI * 2 + 2.4 * (1 - rho / radius);
    const P = C.clone().addScaledVector(u, Math.cos(phi) * rho).addScaledVector(v, Math.sin(phi) * rho);
    const dl = new THREE.Vector2(Math.cos(phi), Math.sin(phi)).multiplyScalar(0.55)
      .add(new THREE.Vector2(-Math.sin(phi), Math.cos(phi))).normalize();
    const D = u.clone().multiplyScalar(dl.x).addScaledVector(v, dl.y);
    const f = rho / radius;
    const c = new THREE.Color().lerpColors(new THREE.Color(0.74, 0.78, 0.90), new THREE.Color(0.36, 0.49, 0.86), THREE.MathUtils.smoothstep(f, 0.1, 0.55));
    c.lerp(new THREE.Color(0.12, 0.21, 0.56), THREE.MathUtils.smoothstep(f, 0.55, 1.0));
    if (rand() < 0.13 && f < 0.45) c.lerp(new THREE.Color(0.88, 0.84, 0.60), 0.55);
    pos.push(P.x, P.y, P.z); dir.push(D.x, D.y, D.z); col.push(c.r, c.g, c.b); sd.push(rand() * 1000);
  }
  return dabMesh(dabGeometry(count, {
    aPos: [new Float32Array(pos), 3], aDir: [new Float32Array(dir), 3], aCol: [new Float32Array(col), 3], aSeed: [new Float32Array(sd), 1],
  }), dabMaterial(shared, {
    head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aCol; in float aSeed;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aSeed);
        d.pos = aPos; d.dir = aDir;
        d.size = vec2(1.1 + 0.8 * r.x, 2.8 + 1.8 * r.y);
        d.c1 = jitter(aCol, r.wzy, 0.3);
        d.c2 = jitter(aCol * 1.16, r.zyx, 0.3);
        d.seed = aSeed; d.lift = 0.0;
      }`,
    minPx: [5, 10], maxPx: [300, 520], cells: [0, 8], depthTest: false, depthWrite: false,
  }), -8);
}
scene.add(swirlMesh(0.435, 0.375, 15, DENSE ? 1100 : 750, 4242));
scene.add(swirlMesh(0.635, 0.465, 9.5, DENSE ? 700 : 480, 919));
// stars and the moon share one pulsing glow material
const glowMat = () => dabMaterial(shared, {
  head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aCol; in vec2 aSize; in float aSeed; in float aPhase;`,
  body: /* glsl */ `
    void makeDab(inout Dab d) {
      hash4(aSeed);
      float pu = 0.84 + 0.26 * sin(uTime * 1.35 + aPhase);
      d.pos = aPos; d.dir = aDir;
      d.size = aSize * (0.92 + 0.13 * sin(uTime * 1.35 + aPhase));
      d.c1 = aCol * pu;
      d.c2 = aCol * 1.18 * pu;
      d.seed = aSeed; d.lift = 0.0;
    }`,
  minPx: [4, 6], maxPx: [260, 380], cells: [0, 8], depthTest: false, depthWrite: false,
});
const glowMesh = (A, order) => dabMesh(dabGeometry(A.count, {
  aPos: [new Float32Array(A.pos), 3], aDir: [new Float32Array(A.dir), 3], aCol: [new Float32Array(A.col), 3],
  aSize: [new Float32Array(A.sz), 2], aSeed: [new Float32Array(A.sd), 1], aPhase: [new Float32Array(A.ph), 1],
}), glowMat(), order);
{ // the eleven stars: concentric painted rings round a gold heart, breathing slowly
  const STARS = [
    [0.085, 0.055, 3.0], [0.195, 0.025, 1.7], [0.315, 0.060, 2.2], [0.375, 0.085, 1.9],
    [0.170, 0.170, 2.4], [0.555, 0.100, 2.8], [0.635, 0.225, 2.0], [0.285, 0.335, 1.6],
    [0.035, 0.450, 1.4], [0.115, 0.475, 2.2], [0.315, 0.525, 3.3],
  ];
  const rand = rng(31337);
  const A = { pos: [], dir: [], col: [], sz: [], sd: [], ph: [], count: 0 };
  const put = (C, u, v, lx, ly, dx, dy, c, sx, sy, phase) => {
    const P = C.clone().addScaledVector(u, lx).addScaledVector(v, ly);
    const D = u.clone().multiplyScalar(dx).addScaledVector(v, dy).normalize();
    A.pos.push(P.x, P.y, P.z); A.dir.push(D.x, D.y, D.z); A.col.push(c.r, c.g, c.b);
    A.sz.push(sx, sy); A.sd.push(rand() * 1000); A.ph.push(phase); A.count++;
  };
  STARS.forEach(([px, py, Rs], si) => {
    const { pos: C, th } = shellPoint(px, py, 92);
    const { u, v } = discBasis(th);
    const phase = si * 1.37;
    put(C, u, v, 0, 0, 1, 0, new THREE.Color(1.06, 0.88, 0.44), 1.3 + Rs * 0.4, 1.3 + Rs * 0.4, phase);
    const rings = [
      [0.42, 8, new THREE.Color(0.94, 0.86, 0.55)],
      [0.78, 12, new THREE.Color(0.62, 0.70, 0.95)],
      [1.22, 14, new THREE.Color(0.30, 0.42, 0.80)],
    ];
    for (const [f, n, c] of rings) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.3;
        put(C, u, v, Math.cos(a) * Rs * f, Math.sin(a) * Rs * f, -Math.sin(a), Math.cos(a), c, 0.3 + 0.3 * Rs, 0.5 + 0.75 * Rs * f, phase);
      }
    }
  });
  scene.add(glowMesh(A, -7));
}
{ // the crescent moon, top right: a pale swirled disc, a gold crescent on its left, a faint halo
  const { pos: C, th } = shellPoint(0.875, 0.165, 92);
  const { u, v } = discBasis(th);
  const R = 6.2;
  const rand = rng(606);
  const A = { pos: [], dir: [], col: [], sz: [], sd: [], ph: [], count: 0 };
  // painting coords (x right, y up): the disc basis u points at decreasing painting x, so flip x
  const put = (pxx, pyy, c, sx, sy) => {
    const P = C.clone().addScaledVector(u, -pxx).addScaledVector(v, pyy);
    const rho = Math.hypot(pxx, pyy) || 1;
    const D = u.clone().multiplyScalar(pyy / rho).addScaledVector(v, pxx / rho).normalize();
    A.pos.push(P.x, P.y, P.z); A.dir.push(D.x, D.y, D.z); A.col.push(c.r, c.g, c.b);
    A.sz.push(sx, sy); A.sd.push(rand() * 1000); A.ph.push(2.2); A.count++;
  };
  for (let i = 0; i < 90; i++) { // the pale disc the crescent sits in
    const a = rand() * Math.PI * 2, rho = R * 1.02 * Math.sqrt(rand());
    put(Math.cos(a) * rho, Math.sin(a) * rho, new THREE.Color(0.50, 0.57, 0.78), 2.0, 3.2);
  }
  for (let i = 0; i < 26; i++) { // the halo
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2, rho = R * (1.14 + 0.3 * rand());
    put(Math.cos(a) * rho, Math.sin(a) * rho, new THREE.Color(0.30, 0.38, 0.66), 1.1, 2.4);
  }
  let kept = 0, guard = 0; // the crescent itself: the disc minus a disc pushed right
  while (kept < 130 && guard++ < 4000) {
    const pxx = (rand() * 2 - 1) * R, pyy = (rand() * 2 - 1) * R;
    if (Math.hypot(pxx, pyy) > R * 0.98) continue;
    if (Math.hypot(pxx - 0.42 * R, pyy) < 0.95 * R) continue;
    const gold = rand() < 0.5 ? new THREE.Color(1.05, 0.80, 0.30) : new THREE.Color(0.95, 0.72, 0.28);
    put(pxx, pyy, gold, 0.85, 1.75);
    kept++;
  }
  scene.add(glowMesh(A, -7));
}

// --- the ground underpainting: dark blue-green fields that show between the dabs ---
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
        vec3 c = mix(vec3(0.045, 0.07, 0.13), vec3(0.07, 0.10, 0.18), n);
        float street = smoothstep(-12.5, -10.8, vWorld.z) * (1.0 - smoothstep(-3.2, -1.2, vWorld.z));
        c = mix(c, vec3(0.09, 0.12, 0.20), street * 0.7); // the village street, a touch paler
        c = mix(c, vec3(0.03, 0.05, 0.11), smoothstep(25.0, 110.0, rad)); // out to the dark fields
        outC = vec4(c * 0.95, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.05;
  m.frustumCulled = false;
  m.renderOrder = -5;
  scene.add(m);
}

// --- the ground: dark blue-green dabs in rings — the village street in front of the houses,
//     rolling hill strokes beyond it, all running along the street like the painting's fields ---
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
  // the street band in front of the houses is paler slate; away from it, dark hill ground
  float street = smoothstep(-12.5, -10.8, xz.y) * (1.0 - smoothstep(-3.2, -1.2, xz.y));
  vec3 L = mix(vec3(0.16, 0.22, 0.30), vec3(0.30, 0.36, 0.44), street);
  vec3 M = mix(vec3(0.09, 0.14, 0.22), vec3(0.18, 0.23, 0.32), street);
  vec3 S = vec3(0.04, 0.06, 0.12);
  vec3 c = paint3(L, M, S, max(lit, 0.55), q.y); // a night floor: never sunk to the shade mix
  float g = texture(tNoise, xz / 17.0).g;
  c = mix(c, vec3(0.07, 0.14, 0.11), smoothstep(0.55, 0.8, g) * 0.5); // green-dark field patches
  c = mix(c, c * vec3(0.85, 0.88, 0.95), smoothstep(19.0, 40.0, rad)); // duller and bluer far out
  c = jitter(c, r.wzy, 0.42);
  vec2 dirv = normalize(vec2(1.0, (r.z - 0.5) * 0.55)); // strokes run along the street, wobbling
  d.dir = vec3(dirv.x, 0.0, dirv.y);
  d.pos = P;
  d.size = uCell0 * vec2(1.05 + 0.5 * r.z, 1.9 + 1.1 * r.w) * lod;
  d.c1 = hazed(c, P);
  d.c2 = hazed(jitter(c * 1.16, q.wzy, 0.4), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = vec3(0.0, 1.0, 0.0);
  d.height = (0.02 + 0.05 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}`;

const plaza = groundRings(shared, { body: plazaBody, per: DENSE ? 3 : 2, n: 192, cell0: 0.15, levels: 6, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });
scene.add(plaza.group);

// --- how the kit's paint is lit on a night like this: moonlight, never day-bright ---
const NIGHT = /* glsl */ `
float nightOn(vec3 P, vec3 Nn) {
  float s = sunAt(P + Nn * 0.25);
  float face = clamp(dot(Nn, uSunDir) * 1.15 + 0.38, 0.0, 1.0);
  return clamp(0.30 + s * face * 0.62, 0.0, 1.0);
}`;
const KIT_LIGHT = NIGHT + /* glsl */ `
vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
  if (PAL_G[k] > 1.5) return PAL_L[k] * tone;
  if (PAL_G[k] > 0.5) return PAL_L[k] * tone * (0.86 + 0.22 * sin(uTime * 6.0 + r * 43.0));
  return paint3(PAL_L[k], PAL_M[k], PAL_S[k], nightOn(P, Nn), r) * tone;
}`;

const kit = createKit(shared, {
  seed: 417, haze: true, order: 3,
  palettes: {
    wall: { l: [0.36, 0.42, 0.60], m: [0.22, 0.27, 0.45], s: [0.11, 0.14, 0.28], own: [0.3, 0.35, 0.5] },
    wallPale: { l: [0.62, 0.64, 0.70], m: [0.42, 0.44, 0.52], s: [0.20, 0.22, 0.32], own: [0.5, 0.52, 0.58] },
    roof: { l: [0.20, 0.24, 0.42], m: [0.12, 0.15, 0.30], s: [0.06, 0.08, 0.18], own: [0.16, 0.19, 0.34] },
    roofRust: { l: [0.52, 0.30, 0.18], m: [0.36, 0.20, 0.12], s: [0.18, 0.10, 0.06], own: [0.42, 0.24, 0.14] },
    timberDark: { l: [0.16, 0.13, 0.12], m: [0.10, 0.08, 0.08], s: [0.05, 0.04, 0.05], own: [0.13, 0.11, 0.1] },
    winGlow: { l: [1.05, 0.78, 0.32], m: [1.05, 0.78, 0.32], s: [1.05, 0.78, 0.32], own: [1.0, 0.72, 0.28], glow: 2 },
    winFlicker: { l: [1.0, 0.70, 0.30], m: [1.0, 0.70, 0.30], s: [1.0, 0.70, 0.30], own: [0.95, 0.66, 0.27], glow: 1 },
    winDim: { l: [0.50, 0.38, 0.19], m: [0.50, 0.38, 0.19], s: [0.50, 0.38, 0.19], own: [0.45, 0.34, 0.17], glow: 2 },
    hillBlue: { l: [0.22, 0.30, 0.55], m: [0.14, 0.20, 0.42], s: [0.07, 0.11, 0.26], own: [0.18, 0.25, 0.46] },
    hillDeep: { l: [0.13, 0.19, 0.38], m: [0.08, 0.13, 0.28], s: [0.04, 0.07, 0.17], own: [0.10, 0.15, 0.30] },
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

// --- the village: a row of dark houses with warm lit windows along the back of the street ---
function house(hx, w, h, d, wallPal, roofPal, wins) {
  const hz = -13.2;
  kit.box(hx, h / 2, hz, w, h, d, wallPal, { stroke: [0.09, 0.26] });
  const rise = d * 0.34;
  kit.tri([hx - w / 2, h, hz + d / 2], [hx - w / 2, h + rise, hz], [hx - w / 2, h, hz - d / 2], wallPal, { stroke: [0.09, 0.24] });
  kit.tri([hx + w / 2, h, hz - d / 2], [hx + w / 2, h + rise, hz], [hx + w / 2, h, hz + d / 2], wallPal, { stroke: [0.09, 0.24] });
  slab(hx, h + rise * 0.52, hz + d * 0.26, 0.60, 0, w + 0.7, 0.15, d * 0.62, roofPal, [0, -0.5, 0.85]);
  slab(hx, h + rise * 0.52, hz - d * 0.26, -0.60, 0, w + 0.7, 0.15, d * 0.62, roofPal, [0, -0.5, -0.85]);
  for (const [wx, wy, wp] of wins) kit.box(hx + wx, wy, hz + d / 2 + 0.06, 0.55, 0.8, 0.1, wp);
}
house(-15.2, 4.6, 2.9, 5.2, 'wall', 'roof', [[-1.0, 1.7, 'winGlow'], [1.0, 1.7, 'winDim']]);
house(-10.6, 4.2, 3.4, 5.2, 'wall', 'roofRust', [[-0.9, 1.9, 'winGlow'], [0.9, 1.9, 'winGlow']]);
house(-6.4, 3.8, 2.6, 5.0, 'wall', 'roof', [[0.2, 1.5, 'winFlicker']]);
kit.box(-6.4, 0.95, -10.62, 0.95, 1.9, 0.14, 'timberDark', { grain: 'y' });
// --- the church, pale as the painting's, with its tall spire ---
kit.box(0.6, 1.6, -13.4, 5.0, 3.2, 5.6, 'wallPale', { stroke: [0.09, 0.26] });
kit.tri([-1.9, 3.2, -10.6], [-1.9, 5.1, -13.4], [-1.9, 3.2, -16.2], 'wallPale', { stroke: [0.09, 0.24] });
kit.tri([3.1, 3.2, -16.2], [3.1, 5.1, -13.4], [3.1, 3.2, -10.6], 'wallPale', { stroke: [0.09, 0.24] });
slab(0.6, 4.2, -12.05, 0.60, 0, 5.7, 0.15, 3.4, 'roof', [0, -0.5, 0.85]);
slab(0.6, 4.2, -14.75, -0.60, 0, 5.7, 0.15, 3.4, 'roof', [0, -0.5, -0.85]);
kit.box(-1.3, 2.6, -11.4, 1.4, 5.2, 1.4, 'wallPale', { stroke: [0.08, 0.22] });
kit.add(new THREE.ConeGeometry(1.12, 3.4, 12), kit.place(-1.3, 6.9, -11.4), 'roof', { stroke: [0.08, 0.2] });
kit.box(-1.3, 3.7, -10.66, 0.42, 1.15, 0.1, 'winGlow');
kit.box(0.9, 1.9, -10.55, 0.7, 1.25, 0.1, 'winGlow');
kit.box(2.1, 1.0, -10.55, 0.95, 2.0, 0.12, 'timberDark', { grain: 'y' });
house(5.6, 4.0, 3.0, 5.2, 'wall', 'roof', [[-0.8, 1.8, 'winDim'], [0.9, 1.8, 'winGlow']]);
house(9.8, 4.4, 2.7, 5.0, 'wall', 'roofRust', [[-1.1, 1.6, 'winGlow'], [1.1, 1.6, 'winFlicker']]);
house(14.2, 4.8, 3.3, 5.2, 'wall', 'roof', [[-1.2, 1.9, 'winGlow'], [1.2, 1.9, 'winDim']]);
// --- the hills behind the village: two rolling ridges, strokes running down their slopes ---
function ridge(z, peaks, pal) {
  for (let i = 0; i < peaks.length - 1; i++) {
    const [x0, y0] = peaks[i], [x1, y1] = peaks[i + 1];
    kit.tri([x0, -1.5, z], [x1, -1.5, z], [x0, y0, z], pal, { grain: [0.25, -1, 0], stroke: [0.5, 1.6], density: 0.6 });
    kit.tri([x1, -1.5, z], [x1, y1, z], [x0, y0, z], pal, { grain: [0.25, -1, 0], stroke: [0.5, 1.6], density: 0.6 });
  }
}
ridge(-27, [[-50, 4], [-32, 7.5], [-14, 5], [2, 8.5], [18, 6], [34, 9.5], [50, 6.5]], 'hillDeep');
ridge(-21, [[-44, 2.5], [-26, 4.5], [-8, 3], [8, 5], [24, 3.6], [44, 5.5]], 'hillBlue');
const built = kit.build();
scene.add(built.group);

// --- the cypress: a dark flame of a tree at the street's left edge, its strokes sweeping
//     up and curling, with the painting's brown flecks in it. Dark cones for underpainting,
//     then dabs over them (the plaza pines' way, in a flame's shape instead of a crown's). ---
const CYP = { x: -7.2, z: -3.4, h: 11.5 };
const BUSHES = [[-11.5, 1.5, 1.15], [13.8, 0.5, 0.95], [11.5, 5.5, 0.8], [-13.5, 5.0, 0.9]];
{
  const underMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      out vec3 vWorld; out vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      in vec3 vWorld; in vec3 vN;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(vec3(0.012, 0.035, 0.018) * (0.6 + 0.6 * max(normalize(vN).y, 0.0)), 1.0); }`,
  });
  const cone1 = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 1.35, 7.2, 10), underMat);
  cone1.position.set(CYP.x, 3.6, CYP.z); cone1.frustumCulled = false; scene.add(cone1);
  const cone2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.55, 5.4, 8), underMat);
  cone2.position.set(CYP.x + 0.55, 8.6, CYP.z); cone2.frustumCulled = false; scene.add(cone2);
  for (const [bx, bz, br] of BUSHES) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(br * 0.96, 12, 9), underMat);
    s.position.set(bx, br * 0.75, bz); s.frustumCulled = false; scene.add(s);
  }
}
function flameDabs(list, seed, flecks) {
  // list: { c: [x,y,z], r } sampling volumes; returns a dab mesh of upward-sweeping strokes
  const pos = [], dir = [], nrm = [];
  const rand = rng(seed);
  void rand;
  for (const item of list) {
    const { pts, c } = item;
    for (let i = 0; i < pts.length; i++) {
      const p = c.clone().add(pts[i]);
      pos.push(p.x, p.y, p.z);
      const nn = (item.nrms ? item.nrms[i] : pts[i]).clone().normalize();
      nrm.push(nn.x, nn.y, nn.z);
      const dd = nn.clone().multiplyScalar(0.45); dd.y += 1.0; dd.normalize();
      dir.push(dd.x, dd.y, dd.z);
    }
  }
  const count = pos.length / 3;
  return dabMesh(dabGeometry(count, {
    aPos: [new Float32Array(pos), 3], aDir: [new Float32Array(dir), 3], aNrm: [new Float32Array(nrm), 3],
  }), dabMaterial(shared, {
    head: NIGHT + /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aPos.x * 13.7 + aPos.y * 7.1 + aPos.z * 3.3);
        vec3 Nn = normalize(aNrm);
        if (dot(Nn, normalize(cameraPosition - aPos)) < -0.15) { d.alive = 0.0; return; }
        float x = nightOn(aPos, Nn);
        vec3 c = paint3(vec3(0.15, 0.27, 0.13), vec3(0.07, 0.15, 0.09), vec3(0.02, 0.05, 0.035), x, r.y);
        ${flecks ? 'if (r.z < 0.12) c = mix(c, vec3(0.24, 0.18, 0.08), 0.55);' : ''}
        c = jitter(c, r.wzy, 0.45);
        d.pos = aPos;
        d.dir = aDir;
        d.size = vec2(0.24 + 0.14 * r.x, 0.60 + 0.60 * r.w);
        d.c1 = hazed(c, aPos);
        d.c2 = hazed(c * 1.3, aPos);
        d.seed = r.x * 977.0;
        d.lift = 0.35;
        d.turnabout = 1.0;
      }`,
    minPx: [3, 6], maxPx: [140, 300], cells: [0, 8],
  }), 3);
}
{ // the cypress's own dabs: packed along its flame profile, centreline bending as it rises
  const rand = rng(2027);
  const pts = [], nrms = [];
  const N = DENSE ? 1700 : 1150;
  for (let i = 0; i < N; i++) {
    const t = Math.pow(rand(), 0.82);
    const prof = (1.3 * Math.pow(1 - t, 0.62) + 0.05) * (1 + 0.16 * Math.sin(t * 9 + 1));
    const a = rand() * Math.PI * 2, rr = prof * Math.sqrt(rand());
    const bend = 0.85 * Math.pow(t, 2.2) + Math.sin(t * 4.5) * 0.38 * t;
    pts.push(new THREE.Vector3(Math.cos(a) * rr + bend, t * CYP.h, Math.sin(a) * rr * 0.82));
    nrms.push(new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)));
  }
  scene.add(flameDabs([{ pts, nrms, c: new THREE.Vector3(CYP.x, 0, CYP.z) }], 2027, true));
}
{ // the bushes: dark crowns of the same paint, lower and rounder
  const rand = rng(555);
  const list = BUSHES.map(([bx, bz, br]) => {
    const pts = [];
    const n = DENSE ? 260 : 170;
    for (let i = 0; i < n; i++) {
      const u = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (u.lengthSq() > 1 || u.lengthSq() < 0.05) { i--; continue; }
      pts.push(u.normalize().multiplyScalar(br * (0.8 + 0.32 * rand())));
    }
    return { pts, c: new THREE.Vector3(bx, br * 0.75, bz), r: br };
  });
  scene.add(flameDabs(list, 555, false));
}

// --- the still world's shade, baked once from plain shapes. (No stand-in for her here —
//     she roams, so her shadow comes from the shade system's second picture, redrawn round
//     her every frame; her meshes ride layer 1 so that camera sees her.)
const shadeScene = new THREE.Scene();
{
  const cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const box = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), cm); m.position.set(x, y, z); m.frustumCulled = false; shadeScene.add(m); };
  const cyl = (x, y, z, r, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), cm); m.position.set(x, y, z); m.frustumCulled = false; shadeScene.add(m); };
  box(-15.2, 1.45, -13.2, 4.6, 2.9, 5.2); box(-10.6, 1.7, -13.2, 4.2, 3.4, 5.2); box(-6.4, 1.3, -13.2, 3.8, 2.6, 5.0);
  box(0.6, 1.6, -13.4, 5.0, 3.2, 5.6); box(-1.3, 2.6, -11.4, 1.4, 5.2, 1.4); box(0.6, 4.2, -13.4, 5.6, 2.0, 6.0);
  box(5.6, 1.5, -13.2, 4.0, 3.0, 5.2); box(9.8, 1.35, -13.2, 4.4, 2.7, 5.0); box(14.2, 1.65, -13.2, 4.8, 3.3, 5.2);
  cyl(CYP.x, CYP.h / 2, CYP.z, 1.25, CYP.h);
  for (const [bx, bz, br] of BUSHES) { const m = new THREE.Mesh(new THREE.SphereGeometry(br, 10, 8), cm); m.position.set(bx, br * 0.75, bz); m.frustumCulled = false; shadeScene.add(m); }
}
const shade = createShade(renderer, shared, shadeScene, { sun: SUN, size: [2048, 2048], box: [30, 24], centre: [0, 1, -5], back: 110, near: 30, far: 240 });

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
let heading = CAM_AZ + Math.PI; // spawn facing the village, away from the camera
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
  { x: CYP.x, z: CYP.z, r: 1.55 },              // the cypress
  ...BUSHES.map(([x, z, r]) => ({ x, z, r: r + 0.25 })),
];
const BOXES = [
  { x0: -17.6, x1: 17.6, z0: -16.4, z1: -10.3 },  // the village row, church included
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

// --- the canvas finish ---
const frame = createFrame(renderer, shared);
frame.uniforms.uShafts.value = 0.3; // moon-glow in the air, kept faint

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
const SKYVIEW = q.get('view') === 'sky'; // a screenshot aid (?view=sky): stand behind her, look up into the painting
const _skyF = new THREE.Vector3(), _skyT = new THREE.Vector3();
function render(rdt) {
  if (SKYVIEW) {
    _skyF.set(-Math.sin(CAM_AZ), 0, -Math.cos(CAM_AZ)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.12);
    camera.position.set(
      herPos.x - _skyF.x * 2.4 + Math.cos(CAM_AZ) * 1.2, 1.35,
      herPos.z - _skyF.z * 2.4 - Math.sin(CAM_AZ) * 1.2);
    _skyT.set(herPos.x + _skyF.x * 40, 17.5, herPos.z + _skyF.z * 40);
    camera.lookAt(_skyT);
  } else {
    _camWant.set(herPos.x + Math.sin(CAM_AZ) * CAM_R, CAM_H, herPos.z + Math.cos(CAM_AZ) * CAM_R);
    const k = 1 - Math.exp(-Math.max(rdt, 0.001) * 3.5);
    camera.position.lerp(_camWant, k);
    camera.lookAt(herPos.x, 1.2, herPos.z);
  }
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

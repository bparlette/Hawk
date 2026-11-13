// hoshi.js — Attempt B's render layer: the Hoshi-no-Tani / Ghibli shader approach.
// No dab geometry anywhere. The painted feel lives in the LIGHT and the AIR:
//   * banded (ramped) lighting — tex.js mat() now builds MeshToonMaterial with a
//     stepped gradient map, so sun light falls in soft painted bands;
//   * a shader sky dome whose cumulus are a domain-warped fbm coverage field
//     (the same idea as hoshi-no-tani's §4: one coverage field, read as sculpted
//     cloud shapes with flat shaded bellies and bright tops);
//   * instanced grass tufts that sway in the wind (hoshi's §6 grass is a million
//     Bézier blades; here the same trick at arcade scale — cheap crossed quads
//     with a blade cutout, per-instance phase from world position);
//   * patchwork field tint on the terrain (vertex colours from a value-noise
//     field mosaic — hoshi bakes a splat map; vertex colours are the same idea
//     at this mesh density);
//   * blue-teal distance haze (scene.fog in main.js) + a warm anime grade
//     (gradepost.js).
// Techniques adapted from Hoshi-no-Tani (MIT, © 2026 Lentils / Rob Howard) —
// see REPORT.md for the provenance note. Code here is original, written for
// this game's analytic heightfields.
import * as THREE from 'three';
import { rng } from './tex.js';

/* ------------------------------ sky dome ------------------------------ */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    // painted gradient — authored deep, the grade pass lifts it (linear pipeline)
    vec3 zen = vec3(0.030, 0.135, 0.55);
    vec3 mid = vec3(0.085, 0.30, 0.78);
    vec3 hor = vec3(0.42, 0.64, 0.58);
    vec3 col = mix(hor, mid, smoothstep(0.0, 0.30, h));
    col = mix(col, zen, smoothstep(0.24, 0.85, h));
    float s = max(dot(d, uSunDir), 0.0);
    col += vec3(0.55, 0.38, 0.16) * pow(s, 10.0) * 0.35;   // broad warm glow
    col += vec3(0.90, 0.75, 0.45) * pow(s, 180.0) * 0.85;  // sun disc halo
    // cumulus: coverage field projected on a deck above the viewer
    if (d.y > 0.012) {
      vec2 cp = d.xz / (d.y + 0.22);
      vec2 q = cp * 1.05 + vec2(uTime * 0.0045, uTime * 0.0012);
      float warp = fbm(q * 2.3);
      float cov = fbm(q * 1.8 + warp * 0.75);
      float cl = smoothstep(0.56, 0.70, cov + d.y * 0.04);
      cl *= smoothstep(0.012, 0.09, d.y);                  // melt into the horizon
      float body = fbm(q * 4.2 + 7.3);
      float lit = smoothstep(0.15, 0.85, body * 0.65 + (cov - 0.56) * 1.1);
      lit = mix(lit, floor(lit * 4.0 + 0.5) / 4.0, 0.5);   // gentle sculpt bands
      vec3 cloudCol = mix(vec3(0.36, 0.47, 0.68), vec3(1.0, 0.99, 0.95), lit);
      cloudCol += vec3(0.10, 0.05, 0.0) * pow(s, 3.0);     // warm toward the sun
      col = mix(col, cloudCol, cl * 0.97);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

export function makeGhibliSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(80, 140, 60).normalize() },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

/* ------------------------------ grass tufts ------------------------------ */

// one shared clock for every tuft field, so levels only tick one number
export const GRASS_TIME = { value: 0 };
export function tickGrass(t) { GRASS_TIME.value = t; }

function bladeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const R = rng(2024);
  for (let i = 0; i < 11; i++) {
    const bx = 8 + i * 11 + (R() - 0.5) * 5;
    const tipX = bx + (R() - 0.5) * 22, tipY = 10 + R() * 30;
    const g = 205 + (R() * 50) | 0;
    x.fillStyle = `rgb(${g},${g},${g})`;
    x.beginPath();
    x.moveTo(bx - 5.2, 128);
    x.quadraticCurveTo(bx - 3.8, 70, tipX, tipY);
    x.quadraticCurveTo(bx + 3.8, 70, bx + 5.2, 128);
    x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const GRASS_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vShade;
  varying vec3 vWp;
  float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vUv = uv;
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    vec4 lp = instanceMatrix * vec4(position, 1.0);
    float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.43)
               + 0.5 * sin(uTime * 3.3 + ip.z * 0.9 + ip.x * 0.2);
    float bend = uv.y * uv.y * 0.13;
    lp.x += sway * bend;
    lp.z += sway * bend * 0.6;
    vec4 world = modelMatrix * lp;
    vWp = world.xyz;
    vShade = 0.78 + 0.34 * gh(floor(ip.xz * 2.7));
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const GRASS_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vShade;
  varying vec3 vWp;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.45) discard;
    vec3 root = vec3(0.040, 0.170, 0.030);
    vec3 tip = vec3(0.270, 0.620, 0.130);
    vec3 col = mix(root, tip, pow(vUv.y, 1.25)) * vShade * (0.85 + 0.3 * tex.r);
    float f = smoothstep(uFogNear, uFogFar, length(vWp - cameraPosition));
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, 1.0);
  }`;

function crossGeometry() {
  const pos = [], uv = [], idx = [];
  const quad = (a, b) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, a[0], 1, a[2], b[0], 1, b[2]);
    uv.push(0, 0, 1, 0, 0, 1, 1, 1);
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  quad([-0.5, 0, 0], [0.5, 0, 0]);   // facing +Z
  quad([0, 0, -0.5], [0, 0, 0.5]);   // facing +X
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

let sharedBladeTex = null;
export class GrassTufts {
  // spots: array of [x, y, z, scale]
  constructor(parent, spots) {
    if (!sharedBladeTex) sharedBladeTex = bladeTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      uniforms: {
        uTime: GRASS_TIME,
        uMap: { value: sharedBladeTex },
        uFogColor: { value: new THREE.Color(0x93bcd2) },
        uFogNear: { value: 130 },
        uFogFar: { value: 1900 },
      },
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(crossGeometry(), mat, spots.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < spots.length; i++) {
      const [x, y, z, s] = spots[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, (i * 2.399) % Math.PI, 0);
      dummy.scale.set(0.95 * s, 0.80 * s, 0.95 * s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
    this.mesh = mesh;
    this.count = spots.length;
  }
}

/* ------------------------------ patchwork fields ------------------------------ */

// CPU value noise, the same family hoshi bakes into its splat map — here it
// mosaics the terrain into fields of slightly different greens.
function vhash(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >> 13), 1274126177);
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = vhash(ix, iz), b = vhash(ix + 1, iz), c = vhash(ix, iz + 1), d = vhash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
// tint multipliers over the grass texture: vivid meadow, yellow-green sun
// fields, one deeper green, one dry-gold field, one near-neutral
const FIELD_PAL = [
  [1.10, 1.10, 0.74],
  [0.80, 1.02, 0.55],
  [1.22, 1.10, 0.60],
  [0.90, 0.94, 0.50],
  [1.04, 1.02, 0.85],
];
export function fieldTint(x, z, out) {
  const n = 0.65 * vnoise(x * 0.011 + 31.7, z * 0.011 + 11.2)
          + 0.35 * vnoise(x * 0.023 + 7.9, z * 0.023 + 47.3);
  const t = n * (FIELD_PAL.length - 1);
  const i0 = Math.min(FIELD_PAL.length - 2, Math.floor(t));
  let f = t - i0;
  f = f < 0.35 ? 0 : f > 0.65 ? 1 : (f - 0.35) / 0.3;   // crisp-ish field edges
  f = f * f * (3 - 2 * f);
  const A = FIELD_PAL[i0], B = FIELD_PAL[i0 + 1];
  const micro = 0.93 + 0.14 * vnoise(x * 0.09, z * 0.09);
  out[0] = (A[0] + (B[0] - A[0]) * f) * micro;
  out[1] = (A[1] + (B[1] - A[1]) * f) * micro;
  out[2] = (A[2] + (B[2] - A[2]) * f) * micro;
  return out;
}

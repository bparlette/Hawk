// The sky behind the trees: a plain wash first, then broad strokes of it laid over, paler and warmer toward the
// sun until, at the sun itself, it is nearly bare cream.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from './land.js';

const SKY = /* glsl */ `
vec3 skyColour(vec3 v) {
  float sunward = max(dot(v, uSunDir), 0.0);
  // SURREALISM — the Empire of Light sky: deep evening blue overhead and a pale luminous horizon,
  // standing over a plaza that is still lit like day. The contradiction is the style.
  vec3 hor = vec3(0.42, 0.52, 0.70);  // pale luminous band at the world's rim
  vec3 mid = vec3(0.12, 0.22, 0.52);  // evening blue
  vec3 zen = vec3(0.04, 0.07, 0.27);  // near-night at the top of the sky
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.30, v.y));
  c = mix(c, zen, smoothstep(0.22, 0.72, v.y));
  // the afterglow stands where the sun went down: a warm wound in the blue, kept low
  float lowBand = 1.0 - smoothstep(0.0, 0.42, v.y);
  c = mix(c, vec3(1.0, 0.70, 0.40), pow(sunward, 9.0) * 0.55 * lowBand);
  c = mix(c, vec3(0.99, 0.84, 0.58), pow(sunward, 55.0) * 0.65 * lowBand);
  return c;
}
`;

export function createSky(shared) {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${COMMON}
      out vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${SKY}
      in vec3 vDir;
      layout(location = 0) out vec4 outC;
      void main() {
        vec3 v = normalize(vDir);
        vec3 c = skyColour(v) * 0.97;
        // the first stars, out early over a lit town: a sparse hash sparkle that only lives high up
        vec3 cell = floor(v * 110.0);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.45, 45.164))) * 43758.5453);
        float star = step(0.9965, h) * smoothstep(0.18, 0.5, v.y);
        c += vec3(0.85, 0.9, 1.0) * star * (0.35 + 0.3 * sin(uTime * 0.7 + h * 40.0));
        outC = vec4(c, 1.0);
      }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  const count = 1300;
  const rand = rng(515);
  const dirs = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, y = -0.08 + Math.pow(rand(), 1.4) * 1.08, r = Math.sqrt(Math.max(0, 1 - y * y));
    dirs.set([Math.cos(a) * r, y, Math.sin(a) * r, rand() * 1000], i * 4);
  }
  const strokes = dabMesh(dabGeometry(count, { aDir: [dirs, 4] }), dabMaterial(shared, {
    head: SKY + /* glsl */ `in vec4 aDir;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aDir.w);
        vec3 v = normalize(aDir.xyz);
        d.pos = cameraPosition + v * 800.0;
        // strokes lie level, tipping a little, and swing round the sun
        vec3 level = normalize(cross(vec3(0.0, 1.0, 0.0), v));
        vec3 ring = normalize(cross(uSunDir, v) + 1e-4);
        d.dir = normalize(mix(level, ring, 0.45) + vec3(0.0, (r.x - 0.5) * 0.5, 0.0));
        d.size = vec2(62.0 + 54.0 * r.y, 200.0 + 175.0 * r.z); // fewer, broader bands: a printed sky, not a brushed one
        vec3 c = skyColour(v);
        d.c1 = jitter(c, r.yzw, 0.22);
        d.c2 = jitter(c * 1.05, r.wxy, 0.3);
        d.seed = aDir.w;
        d.lift = 0.0;
      }`,
    minPx: [10, 20], maxPx: [900, 1800], cells: [0, 8], depthTest: false, depthWrite: false,
  }), -9);
  group.add(strokes);
  return { group };
}

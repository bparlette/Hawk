// The sky behind the trees: a plain wash first, then broad strokes of it laid over, paler and warmer toward the
// sun until, at the sun itself, it is nearly bare cream.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from './land.js';

const SKY = /* glsl */ `
vec3 skyColour(vec3 v) {
  float sunward = max(dot(v, uSunDir), 0.0);
  vec3 low = airColour(v);
  // overhead a deep cobalt-ultramarine, warming through turquoise toward the sun's cream
  vec3 high = mix(vec3(0.1, 0.28, 0.86), vec3(0.36, 0.56, 0.94), sunward * sunward);
  vec3 c = mix(low, high, smoothstep(0.0, 0.75, v.y));
  c = mix(c, vec3(1.02, 0.95, 0.72), pow(sunward, 24.0) * 0.9);
  return c;
}
// The swirl: the sky's air turns round two great vortex centres over the town, one wheeling
// each way, over a broad level current. A stroke's direction is the flow at its own spot of
// the dome, so the spirals are drawn by the strokes themselves, not painted on behind them.
vec3 skyFlow(vec3 v, float seed) {
  vec3 c1 = normalize(vec3(-0.38, 0.52, -0.76));
  vec3 c2 = normalize(vec3(0.52, 0.3, -0.8));
  vec3 t1 = normalize(cross(c1, v) + 1e-4);
  vec3 t2 = normalize(cross(c2, v) + 1e-4);
  float a1 = acos(clamp(dot(v, c1), -1.0, 1.0));
  float a2 = acos(clamp(dot(v, c2), -1.0, 1.0));
  float w1 = exp(-a1 * a1 / 0.16);
  float w2 = exp(-a2 * a2 / 0.09);
  vec3 level = normalize(cross(vec3(0.0, 1.0, 0.0), v));
  vec3 f = level * 0.5 + t1 * (0.35 + 1.6 * w1) - t2 * (0.25 + 1.3 * w2);
  return normalize(f + vec3(0.0, (seed - 0.5) * 0.22, 0.0));
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
      void main() { outC = vec4(skyColour(normalize(vDir)) * 0.97, 1.0); }`,
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
        // strokes ride the swirling current of the sky, each tipped a little by its own seed
        d.dir = skyFlow(v, r.x);
        d.size = vec2(44.0 + 40.0 * r.y, 150.0 + 130.0 * r.z); // long commas of paint, broad enough to read as currents
        vec3 c = skyColour(v);
        d.c1 = jitter(c, r.yzw, 0.4);
        // the dragged-through paint vibrates: deep blue strokes carry gold, pale ones carry violet
        d.c2 = brokenPair(c * 1.04, 0.55 + 0.4 * r.w);
        d.seed = aDir.w;
        d.lift = 0.0;
      }`,
    minPx: [10, 20], maxPx: [900, 1800], cells: [0, 8], depthTest: false, depthWrite: false,
  }), -9);
  group.add(strokes);
  return { group };
}

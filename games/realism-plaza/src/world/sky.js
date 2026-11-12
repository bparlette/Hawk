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
  vec3 high = mix(vec3(0.5, 0.65, 0.86), vec3(0.74, 0.79, 0.81), sunward * sunward); // realism: the upper sky keeps its blue
  vec3 c = mix(low, high, smoothstep(0.0, 0.55, v.y));
  // golden hour: a warm band sits on the sun's side of the horizon, under the blue
  c = mix(c, vec3(0.99, 0.78, 0.52), pow(sunward, 3.0) * smoothstep(0.45, 0.0, v.y) * 0.55);
  c = mix(c, vec3(1.0, 0.95, 0.78), pow(sunward, 24.0) * 0.9);
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
      void main() { outC = vec4(skyColour(normalize(vDir)) * 0.97, 1.0); }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  const count = 3200; // realism variant: finer strokes than the base's 2600 broad ones, sized between
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
        d.dir = normalize(mix(level, ring, 0.45) + vec3(0.0, (r.x - 0.5) * 0.3, 0.0));
        d.size = vec2(30.0 + 26.0 * r.y, 100.0 + 80.0 * r.z); // realism: broad but not slab-like, so the sky grades instead of swirling
        vec3 c = skyColour(v);
        d.c1 = jitter(c, r.yzw, 0.09);
        d.c2 = jitter(c * 1.02, r.wxy, 0.12);
        d.seed = aDir.w;
        d.lift = 0.0;
      }`,
    minPx: [6, 12], maxPx: [700, 1400], cells: [0, 8], depthTest: false, depthWrite: false,
  }), -9);
  group.add(strokes);
  return { group };
}

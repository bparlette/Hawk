// The sky behind the trees: one graded watercolour wash on the paper — deep overhead where the
// pigment was laid thick, thinning down the sheet until at the horizon it is nearly bare paper,
// with a slightly deeper pooled band where the wash ended, and a warm thin wash round the sun.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from './land.js';

export const PAPER = /* glsl */ `const vec3 PAPER = vec3(0.955, 0.925, 0.85);`; // the warm white of the sheet, everywhere the lightest passage

const SKY = /* glsl */ `
${PAPER}
vec3 skyColour(vec3 v) {
  float sunward = max(dot(v, uSunDir), 0.0);
  vec3 pigment = mix(vec3(0.34, 0.56, 0.93), vec3(0.56, 0.72, 0.95), sunward * sunward);
  // how much pigment the sky wash carries here: full overhead, thinning to the horizon
  float dens = mix(0.2, 0.68, smoothstep(-0.02, 0.72, v.y));
  dens += 0.13 * exp(-abs(v.y - 0.015) * 26.0); // the pooled line where the sky wash dried, just over the rooftops
  dens *= 0.94 + 0.1 * texture(tNoise, v.xz / (0.25 + abs(v.y)) * 1.4).g; // granulation in the big wash
  vec3 c = mix(PAPER, pigment, clamp(dens, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.93, 0.76), pow(sunward, 10.0) * 0.28); // a warm thin wash toward the sun
  c = mix(c, vec3(1.0, 0.97, 0.86), pow(sunward, 40.0) * 0.5);  // and nearer the sun, almost bare paper again
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
    // the sky's own broad washes are the palest in the picture; they test depth (unlike the old
    // opaque strokes) so they never wash over the figure or the rooftops in front of them
    uniforms: { uWash: { value: new THREE.Vector2(0.34, 0.2) } },
    minPx: [10, 20], maxPx: [900, 1800], cells: [0, 8], depthTest: true, depthWrite: false,
  }), -9);
  group.add(strokes);
  return { group };
}

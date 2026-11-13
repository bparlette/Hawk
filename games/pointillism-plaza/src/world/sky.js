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
  vec3 high = mix(vec3(0.3, 0.58, 0.96), vec3(0.62, 0.76, 0.92), sunward * sunward); // clean storybook blue overhead
  vec3 c = mix(low, high, smoothstep(0.0, 0.75, v.y));
  c = mix(c, vec3(1.0, 0.96, 0.8), pow(sunward, 24.0) * 0.9);
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
        // the sky is dotted like everything else: the dome is divided into small angular
        // cells; each cell's colour is the sky at its centre, split into one pure pigment,
        // and laid as a round dot over pale canvas. No gradient survives anywhere.
        vec3 v = normalize(vDir);
        float az = atan(v.x, v.z);
        float el = asin(clamp(v.y, -1.0, 1.0));
        vec2 p = vec2(az * cos(el), el) / 0.0105; // ~10px cells at phone height
        vec2 cell = floor(p);
        vec2 cc = (cell + 0.5) * 0.0105;
        float elC = cc.y;
        float azC = cc.x / max(cos(elC), 0.2);
        vec3 vC = vec3(sin(azC) * cos(elC), sin(elC), cos(azC) * cos(elC));
        vec3 cBase = skyColour(vC);
        vec3 dot = dotSplit(cBase, hash4(cell, 3.0));
        float dist = length(fract(p) - 0.5);
        float inside = 1.0 - smoothstep(0.46, 0.54, dist);
        vec3 gap = mix(cBase, vec3(0.94, 0.91, 0.83), 0.45); // pale canvas between the dots
        outC = vec4(mix(gap, dot, inside) * 0.97, 1.0);
      }`,
  }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  // No dab strokes ride over the dome any more: broad bands of sky were the old picture's way;
  // here the dome's own dot field is the whole sky.
  return { group };
}

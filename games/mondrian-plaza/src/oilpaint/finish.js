// The canvas, re-cut as a De Stijl composition. The world is painted exactly as the cartoon plaza
// paints it — same dabs, same figure — into a picture with a depth beside it; this finish then throws
// the painter away and re-structures the whole picture as Mondrian: a black grid partitions the frame
// into rectangular cells, and every cell is filled with ONE flat colour from the De Stijl set (primary
// red, primary blue, primary yellow, white, black), chosen from the cell's own average colour by the
// rule in mondrian() below, so the abstraction stays faithful to the scene — the fountain, the ground,
// the sky and the walking figure all survive as arrangements of rectangles. Cells merge upward
// (fine -> mid -> coarse, each twice the last) wherever their contents are uniform enough, the way
// Mondrian's canvases mix a few big blocks with clusters of small ones; near the eye the figure is
// allowed the finest cells so she stays readable as a figure.
import * as THREE from 'three';
import { COMMON } from './common.js';

export function createFrame(renderer, shared, { samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples, depthBuffer: true, generateMipmaps: false });
  target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;

  const uniforms = {
    ...shared,
    tColor: { value: target.texture },
    tDepth: { value: target.depthTexture },
    uInvViewProj: { value: new THREE.Matrix4() },
    uEye: { value: new THREE.Vector3() },
    // kept for main.js, which still sets them; the grid pass ignores them (no shafts, no weave, no ink)
    uShafts: { value: 0 },
    uSteps: { value: 22 },
    uCanvas: { value: 0 },
    uOutline: { value: 0 },
    uOutlineCol: { value: new THREE.Color(0.09, 0.07, 0.11) },
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
      uniform sampler2D tDepth;
      uniform mat4 uInvViewProj;
      uniform vec3 uEye;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      // The whole palette. Nothing else is ever shown.
      const vec3 M_RED = vec3(0.80, 0.07, 0.09);
      const vec3 M_BLUE = vec3(0.06, 0.16, 0.72);
      const vec3 M_YELLOW = vec3(0.96, 0.76, 0.02);
      const vec3 M_WHITE = vec3(0.97, 0.96, 0.94);
      const vec3 M_BLACK = vec3(0.0, 0.0, 0.0);

      // The fill rule: a cell's average colour -> its one De Stijl colour.
      //   near-black averages            -> black
      //   low saturation                 -> white (stone in sun, pale sky, foam)
      //   warm, light, gently saturated  -> white (skin, cream walls: Mondrian leaves flesh unpainted)
      //   green-dominant                 -> yellow in the light, blue in the deep (foliage, verdigris)
      //   blue-dominant                  -> blue (sky, water, glass, the painter's blue shade tones)
      //   red-dominant, clearly red      -> red (tile, awnings, fruit, timber in sun)
      //   red-and-green together (gold)  -> yellow
      vec3 mondrian(vec3 c) {
        float mx = max(max(c.r, c.g), c.b);
        float mn = min(min(c.r, c.g), c.b);
        float L = dot(c, vec3(0.299, 0.587, 0.114));
        float S = mx > 0.001 ? (mx - mn) / mx : 0.0;
        if (L < 0.13) return M_BLACK;
        if (S < 0.20) return M_WHITE;
        if (c.r > c.g && c.g > c.b && L > 0.52 && S < 0.40) return M_WHITE;
        if (c.g >= c.r && c.g >= c.b) return L > 0.42 ? M_YELLOW : M_BLUE;
        if (c.b >= c.r && c.b >= c.g) return M_BLUE;
        if (c.r > c.g * 1.35) return M_RED;
        return L > 0.35 ? M_YELLOW : M_RED;
      }

      // A cell's average colour and how STRUCTURALLY mixed it is: the cell is split into
      // quadrants and the variance of the four quadrant means is returned. Dab-to-dab
      // paint texture averages away inside a quadrant, so a cell only counts as mixed
      // when a real form boundary crosses it — a silhouette, a roofline, the fountain's
      // rim — which is exactly where a composition needs smaller blocks.
      vec4 cellStats(vec2 cellId, float s) {
        vec2 base = cellId * s;
        vec3 quad[4];
        quad[0] = vec3(0.0); quad[1] = vec3(0.0); quad[2] = vec3(0.0); quad[3] = vec3(0.0);
        for (int i = 0; i < 4; i++) {
          for (int j = 0; j < 4; j++) {
            vec2 pp = base + (vec2(float(i), float(j)) + 0.5) * (s * 0.25);
            vec3 c = texture(tColor, pp / uSize).rgb;
            quad[(j >= 2 ? 2 : 0) + (i >= 2 ? 1 : 0)] += c;
          }
        }
        vec3 mean = (quad[0] + quad[1] + quad[2] + quad[3]) * 0.0625;
        float var = 0.0;
        for (int k = 0; k < 4; k++) {
          vec3 d = quad[k] * 0.25 - mean;
          var += dot(d, d);
        }
        return vec4(mean, var * 0.25);
      }

      void main() {
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        float far = length(h.xyz / h.w - uEye);

        vec2 px = vUv * uSize;
        float sFine = max(uSize.x / 26.0, 6.0);
        // close to the eye (the figure, the fountain) the finest cells are allowed;
        // farther off the smallest cell doubles, so distance stays in big calm blocks
        float sMin = far < 11.0 ? sFine : sFine * 2.0;

        // start coarse and subdivide while a form boundary crosses the cell
        float s = sFine * 4.0;
        vec2 id = floor(px / s);
        vec4 st = cellStats(id, s);
        if (st.w > 0.006 && s * 0.5 >= sMin) { s *= 0.5; id = floor(px / s); st = cellStats(id, s); }
        if (st.w > 0.006 && s * 0.5 >= sMin) { s *= 0.5; id = floor(px / s); st = cellStats(id, s); }

        vec3 col = mondrian(st.rgb);

        // the black grid: a line wherever this pixel stands within half the line's width
        // of its own cell's border (coarser borders fall on finer ones, so the lines agree
        // at every scale). Lines are a fixed screen width, as if ruled.
        vec2 f = fract(px / s) * s; // distance into the cell, in pixels
        float dEdge = min(min(f.x, s - f.x), min(f.y, s - f.y));
        float halfLine = max(uSize.x / 240.0, 1.6);
        col = mix(M_BLACK, col, smoothstep(halfLine - 0.75, halfLine + 0.75, dEdge));

        outC = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const flat = new THREE.Camera();
  const viewProj = new THREE.Matrix4();

  return {
    target,
    uniforms,
    resize() {
      renderer.getDrawingBufferSize(size);
      target.setSize(size.x, size.y);
      uniforms.uSize.value.copy(size);
    },
    render(world, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(world, camera);
      renderer.setRenderTarget(null);
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      uniforms.uInvViewProj.value.copy(viewProj).invert();
      uniforms.uEye.value.copy(camera.position);
      renderer.render(scene, flat);
    },
  };
}

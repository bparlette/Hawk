// The block. The world is painted into a picture with a depth beside it, as value: lit paint and
// dark paint. This pass is the knife work that turns that painting into a woodcut print — it reads
// nothing but the painting's value and carves it into the medium's only two marks: black ink and
// the paper it is printed on. Lit passages stay paper, with black gouge lines thickening as the
// value darkens; shadow passages go solid ink, opened up by white cuts the gouge lifts out of the
// black. No grey wash anywhere: every mid-tone is line density, the way a real block does it.
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
    uShafts: { value: 0 }, // a print has no sun-in-the-mist; kept in the uniform block for the page's sake
    uSteps: { value: 22 },
    uCanvas: { value: 0 }, // and no canvas weave: the surface here is cut wood and paper
    uOutline: { value: 1 },
    uOutlineCol: { value: new THREE.Color(0.06, 0.052, 0.045) },
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
      uniform float uOutline;
      uniform vec3 uOutlineCol;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      // the print's only two values: a warm near-black ink, and the warm off-white of the paper
      const vec3 INK = vec3(0.06, 0.052, 0.045);
      const vec3 PAPER = vec3(0.93, 0.885, 0.80);

      // One family of gouge marks: returns 1.0 where a cut of this family covers the pixel.
      // dir is the run of the lines, spacing the distance between them in buffer pixels, and
      // width the fraction of that spacing the mark takes. wob wanders the phase — a hand-guided
      // gouge does not run true — and rag breaks the mark's width up, so its edges are torn the
      // way torn wood is, never ruled. The edge itself is kept hard: a fraction of a pixel of
      // softening only, so the print stays two-valued.
      float gouge(vec2 px, vec2 dir, float spacing, float width, float wob, float rag) {
        float s = dot(px, dir) / spacing + wob;
        float f = fract(s);
        float w = clamp(width * (0.7 + 0.6 * rag), 0.0, 0.97);
        if (w <= 0.0) return 0.0; // no cut ordered here: the paper stays clean (the AA band below would otherwise print a phantom line at every period boundary)
        float aa = fwidth(s) * 1.1 + 0.015;
        return 1.0 - smoothstep(w - aa, w + aa, f);
      }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // Silhouettes first: where the depth steps hard between neighbouring pixels — her outline
        // against the sky, an eave, the fountain's rim — the paint is darkened toward ink before
        // its value is read, so the carved shapes keep the hard contour a block gives them. The
        // step is judged against the distance, so the ground running away at a slant (a smooth
        // depth ramp) never trips it, and the line thins out with distance.
        if (uOutline > 0.0) {
          vec2 tx = 2.0 / uSize;
          float e = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 off = (i == 0 ? vec2(tx.x, 0.0) : i == 1 ? vec2(-tx.x, 0.0) : i == 2 ? vec2(0.0, tx.y) : vec2(0.0, -tx.y));
            float dn = texture(tDepth, vUv + off).r;
            vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
            float farn = length(hn.xyz / hn.w - uEye);
            e = max(e, abs(far - farn) / (0.03 + 0.025 * far));
          }
          float line = smoothstep(0.7, 1.7, e) * (1.0 - smoothstep(35.0, 80.0, far));
          col = mix(col, uOutlineCol, clamp(line, 0.0, 1.0) * 0.9 * uOutline);
        }

        // The painting is read as pure value. A print's value scale is harsher than paint's, so
        // the darks are deepened and the lights cleaned before the knife touches them.
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        float L = clamp((lum - 0.05) / 0.92, 0.0, 1.0);
        L = mix(L, L * L * (3.0 - 2.0 * L), 0.4);

        // The knife work. Lines are sized in buffer pixels and scaled a little with the buffer,
        // so a cut keeps roughly the same weight from the smooth page to the rich one. Two runs
        // of the gouge: the main run and a cross run, each with its own wander off the noise sheet.
        vec2 px = gl_FragCoord.xy;
        float sp = 6.2 * clamp(uSize.y / 720.0, 0.8, 1.7);
        vec2 dirA = vec2(0.848, -0.530);
        vec2 dirB = vec2(0.788, 0.616);
        vec4 nzB = texture(tNoise, px / 190.0);
        vec4 nzF = texture(tNoise, px / 27.0);
        float wobA = (nzB.r - 0.5) * 0.55 + (nzF.g - 0.5) * 0.16;
        float wobB = (nzB.b - 0.5) * 0.55 + (nzF.a - 0.5) * 0.16;

        vec3 carved;
        if (L >= 0.40) {
          // The paper side: black gouge lines stand on the paper and thicken as the value
          // darkens toward the middle; below the middle the cross run joins them, so the ink
          // closes in from two directions at once.
          float wA = clamp((0.68 - L) * 1.9, 0.0, 0.85);
          float wB = clamp((0.50 - L) * 1.8, 0.0, 0.6);
          float ink = max(gouge(px, dirA, sp, wA, wobA, nzF.r),
                          gouge(px, dirB, sp * 1.13, wB, wobB, nzF.b));
          carved = mix(PAPER, INK, ink);
        } else {
          // The ink side: the form is a black mass, and the light in it is cut back out with
          // white gouge strokes. The brighter the passage, the wider and more frequent the cuts;
          // down in the deep shadow they thin to nothing and the black stands solid.
          float cA = clamp((L - 0.04) * 0.82, 0.0, 0.45);
          float cB = clamp((L - 0.22) * 0.9, 0.0, 0.3);
          float cut = max(gouge(px, dirA, sp, cA, wobA, nzF.r),
                          gouge(px, dirB, sp * 1.13, cB, wobB, nzF.b));
          carved = mix(INK, PAPER, cut);
        }
        outC = vec4(carved, 1.0);
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

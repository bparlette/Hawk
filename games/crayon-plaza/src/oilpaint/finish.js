// The paper. The world is drawn into a picture with a depth beside it; this then lays in the one thing dabs
// can't do, the sun standing in the mist between the trunks, and finishes the surface: for crayon that is
// the PAPER itself — a fine tooth that grains every colour laid on it, paper fibres showing in the pits
// where the wax lay thin, and a slight hand-drawn wobble in the whole picture, as if the page had been
// drawn freehand and the lines never quite sat still. No ink outlines: crayon forms are colour regions.
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
    uShafts: { value: 1 },
    uSteps: { value: 22 },
    uCanvas: { value: 1 },
    uOutline: { value: 1 },
    uOutlineCol: { value: new THREE.Color(0.09, 0.07, 0.11) },
    uPaper: { value: 1 },
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
      uniform float uShafts;
      uniform float uSteps;
      uniform float uCanvas;
      uniform float uOutline;
      uniform vec3 uOutlineCol;
      uniform float uPaper;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      float weave(vec2 p) {
        // warp and weft of a medium linen, each thread a little uneven
        vec2 q = p / 2.6;
        float n = texture(tNoise, p / 310.0).r;
        float a = sin(q.x * 3.14159) * sin(q.y * 3.14159 + floor(q.x) * 3.14159);
        return a * (0.3 + 1.4 * n * n);
      }

      void main() {
        // the hand-drawn wobble: the whole picture is resampled through a low, smooth offset, a couple of
        // pixels at most, so straight edges breathe like a freehand line instead of ruling true
        vec2 wob = vec2(0.0);
        if (uPaper > 0.0) {
          vec2 wn = texture(tNoise, vUv * vec2(5.0, 2.8)).rg;
          wob = (wn - 0.5) * (3.2 / uSize) * uPaper;
        }
        vec3 col = texture(tColor, vUv + wob).rgb;
        float depth = texture(tDepth, vUv + wob).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // Cartoon outlines: where the depth steps hard between neighbouring pixels — a silhouette, an
        // eave, the fountain's rim — lay a dark line. The step is judged against the distance, so the
        // ground running away at a slant (a smooth depth ramp) never trips it, and the line fades out
        // with distance the way a drawn one thins.
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
          col = mix(col, uOutlineCol, clamp(line, 0.0, 1.0) * 0.85 * uOutline);
        }

        // sun in the mist: walk the line of sight and count how much of the air along it stands in the light
        if (uShafts > 0.0) {
          float reach = min(far, 85.0);
          float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float lit = 0.0, weight = 0.0;
          for (float i = 0.0; i < uSteps; i++) {
            float t = (i + jit) / uSteps;
            float w = exp(-t * reach * 0.022);
            lit += sunAt(uEye + ray * (t * reach)) * w;
            weight += w;
          }
          lit /= max(weight, 1e-3);
          float sunward = max(dot(ray, uSunDir), 0.0);
          float thick = 1.0 - exp(-reach * 0.03);
          // lit air glows toward the sun; shaded air is a touch darker and cooler than the plain mist
          float streak = 0.75 + 0.5 * texture(tNoise, vec2(dot(world.xz, vec2(uSunDir.z, -uSunDir.x)) * 0.11, world.y * 0.02)).g;
          vec3 glow = vec3(1.0, 0.86, 0.56) * (0.16 + 0.95 * pow(sunward, 2.5));
          col += glow * (lit - 0.34) * thick * streak * uShafts * 0.8;
        }

        if (uCanvas > 0.0) {
          vec2 px = vUv * uSize;
          float w = weave(px);
          float dx = weave(px + vec2(1.0, 0.0)) - w, dy = weave(px + vec2(0.0, 1.0)) - w;
          col *= 1.0 + (0.6 * dx - 0.8 * dy) * 0.022 * uCanvas + w * 0.006 * uCanvas;
        }

        // THE PAPER TOOTH: a fine grain over the whole picture, fixed to the page like real paper. Every
        // colour is grained by it — brightness rides the tooth — and in the pits, where the noise dips,
        // the paper's own cream fibres mix into the colour, most where the wax above them lay light.
        if (uPaper > 0.0) {
          vec2 px = vUv * uSize;
          float tooth = texture(tNoise, px / 2.9).b;
          float tooth2 = texture(tNoise, px / 13.0).g;
          float lum = dot(col, vec3(0.3, 0.59, 0.11));
          float pit = smoothstep(0.66, 0.34, tooth);
          col *= 1.0 + ((tooth - 0.5) * 0.13 + (tooth2 - 0.5) * 0.05) * uPaper;
          col = mix(col, vec3(0.94, 0.90, 0.81), pit * (0.04 + 0.09 * lum) * uPaper);
        }
        // the brightest passages roll off toward the white of the paint and never past it
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        // varnish, barely: flat cartoon colour stays flat
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.08);
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

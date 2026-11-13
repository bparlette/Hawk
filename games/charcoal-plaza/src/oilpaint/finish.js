// The paper. The world is drawn into a picture with a depth beside it; this then lays in the one thing the
// masses can't do, the light standing in the air between the trunks, and finishes the surface: the grain of
// the paper under the charcoal, and the final grade that holds the whole sheet to warm grays on warm paper.
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
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // No outlines: charcoal has no ink line. Silhouettes are held by tonal contrast alone —
        // a dark mass against pale paper-smudge — the way a charcoal figure holds its edge.

        // light in the air: walk the line of sight and count how much of the air along it stands in the light
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
          // lit air is pale paper-light; shaded air is a touch darker gray than the plain mist
          float streak = 0.75 + 0.5 * texture(tNoise, vec2(dot(world.xz, vec2(uSunDir.z, -uSunDir.x)) * 0.11, world.y * 0.02)).g;
          vec3 glow = vec3(0.97, 0.94, 0.87) * (0.16 + 0.95 * pow(sunward, 2.5));
          col += glow * (lit - 0.34) * thick * streak * uShafts * 0.8;
        }

        // THE RUB: charcoal is finished by dragging a thumb or a stump across the sheet — every
        // hard little boundary the dabs left is smeared into its neighbours. The smear runs along
        // a direction taken from a broad paper-space field (nearby passages smear the same way,
        // like one pass of the hand), reaches a few pixels, and is depth-aware: it mixes freely
        // WITHIN a surface — that is where the dab-cell edges live — and only leans across a
        // silhouette, so forms soften without smearing across the scene.
        {
          vec2 texel = 1.0 / uSize;
          float ang = texture(tNoise, vUv * uSize / 130.0).r * 6.2831;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 perp = vec2(-dir.y, dir.x);
          const vec2 OFFS[8] = vec2[8](
            vec2(2.6, 0.0), vec2(-2.6, 0.0), vec2(1.3, 0.0), vec2(-1.3, 0.0),
            vec2(0.0, 1.7), vec2(0.0, -1.7), vec2(1.8, 1.2), vec2(-1.8, -1.2));
          const float WS[8] = float[8](0.85, 0.85, 1.0, 1.0, 0.8, 0.8, 0.6, 0.6);
          vec3 acc = col * 2.0;
          float wsum = 2.0;
          for (int i = 0; i < 8; i++) {
            vec2 off = (dir * OFFS[i].x + perp * OFFS[i].y) * texel * 3.6;
            vec2 uv2 = vUv + off;
            float dep2 = texture(tDepth, uv2).r;
            vec4 hh = uInvViewProj * vec4(uv2 * 2.0 - 1.0, dep2 * 2.0 - 1.0, 1.0);
            float far2 = length(hh.xyz / hh.w - uEye);
            float agree = 1.0 / (1.0 + abs(far2 - far) * 1.4);
            float wgt = WS[i] * (0.20 + 0.80 * agree);
            acc += texture(tColor, uv2).rgb * wgt;
            wsum += wgt;
          }
          col = mix(col, acc / wsum, 0.62);
          // THE WIPE: where the tone already rides high and a broad mask agrees, the kneaded
          // eraser has been — highlights gather into broad clean paper passages instead of
          // surviving as speckled dab tops.
          float bl = texture(tNoise, vUv * uSize / 170.0).g;
          float lumS = dot(col, vec3(0.3, 0.59, 0.11));
          float wipe = smoothstep(0.76, 0.97, lumS + (bl - 0.5) * 0.24);
          col = mix(col, vec3(0.93, 0.905, 0.85), wipe * 0.45);
        }

        if (uCanvas > 0.0) {
          // the paper's tooth: a broad unevenness in the sheet and a fine powder grain over it,
          // so even an empty passage of paper is visibly paper, not a flat fill
          vec2 px = vUv * uSize;
          float broad = texture(tNoise, px / 110.0).r;
          float fine = texture(tNoise, px / 6.0).b;
          col *= 1.0 + ((broad - 0.5) * 0.05 + (fine - 0.5) * 0.06) * uCanvas;
        }
        // the brightest passages roll off toward the white of the paper and never past it
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        // a breath of contrast curve: charcoal darks deepen a little and stay velvety
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.10);
        // THE GRADE: the whole sheet is held to the charcoal range — luminance remapped between
        // velvet ink-black and the warm paper white. Nothing coloured can survive this; every
        // surface is a warm gray, and the highlights are quite literally the paper showing through.
        float lum = clamp(dot(col, vec3(0.3, 0.59, 0.11)), 0.0, 1.0);
        vec3 ink = vec3(0.052, 0.047, 0.044);
        vec3 paper = vec3(0.935, 0.905, 0.845);
        col = ink + (paper - ink) * lum;
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

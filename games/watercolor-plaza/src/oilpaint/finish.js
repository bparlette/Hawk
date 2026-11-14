// The sheet of paper. The world is washed into a picture with a depth beside it; this then lays in the one thing
// washes can't do, the sun standing in the mist between the trunks, and finishes the surface: the paper's tooth
// and broad unevenness under the pigment, and the roll-off of the brightest passages toward bare paper.
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
    uBleed: { value: 0 },
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
      uniform float uBleed;
      uniform float uCanvas;
      uniform float uOutline;
      uniform vec3 uOutlineCol;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      // the paper: a fine tooth that pigment settles into, over a broad unevenness in the sheet
      float paperTooth(vec2 px) { return texture(tNoise, px / 850.0).g; }
      float paperMottle(vec2 uv) { return texture(tNoise, uv * 2.6 + 0.37).r; }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // The wet bleed: while a watercolour is wet, neighbouring pigment creeps into neighbouring
        // pigment — no mark keeps a private boundary. The picture is finished dry, but this pass
        // lends it a breath of that wetness: each pixel drinks a little of its neighbours, weighted
        // by how surely they stand on the same surface (a near-equal depth), so washes melt into
        // each other across a wall or a reach of ground while a silhouette — the fountain against
        // the sky, her figure against the plaza — stays exactly where it was drawn.
        if (uBleed > 0.0) {
          vec2 bx = vec2(1.7, 0.0) / uSize, by = vec2(0.0, 1.7) / uSize;
          vec3 acc = col;
          float wsum = 1.0;
          for (int i = 0; i < 4; i++) {
            vec2 off = (i == 0 ? bx : i == 1 ? -bx : i == 2 ? by : -by);
            float dn = texture(tDepth, vUv + off).r;
            vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
            float farn = length(hn.xyz / hn.w - uEye);
            float w = 1.0 / (1.0 + abs(far - farn) * 2.2);
            acc += texture(tColor, vUv + off).rgb * w;
            wsum += w;
          }
          col = mix(col, acc / wsum, uBleed);
        }

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
          // the whole picture sits in one sheet of paper: its tooth and its broad unevenness
          // modulate everything, and the tooth bites harder in the dark passages, where more
          // pigment settled into it — in the lights the sheet is nearly bare and stays smooth
          vec2 px = vUv * uSize;
          float lum = dot(col, vec3(0.35, 0.45, 0.2));
          float settle = mix(1.25, 0.75, clamp(lum, 0.0, 1.0));
          col *= 1.0 + ((paperTooth(px) - 0.5) * 0.06 + (paperMottle(vUv) - 0.5) * 0.05) * settle * uCanvas;
        }
        // the brightest passages roll off toward the white of the paper and never past it
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        // no varnish: watercolour dries matte — only the faintest richness is laid over it
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.04);
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

// The canvas. The world is painted into a picture with a depth beside it; this then lays in the two things
// dabs can't do — the sun standing in the mist between the trunks, and the OUTLINE: a bold ink line wherever
// the depth picture says the surface breaks (silhouette or corner) — and finishes the surface: a fine settled
// dust of overspray over everything (spray has no canvas weave), and a little varnish.
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
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      vec3 worldAt(vec2 uv) {
        float d = texture(tDepth, uv).r;
        vec4 h = uInvViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return h.xyz / h.w;
      }

      float grain(vec2 p) {
        // no canvas weave under spray paint: a fine settled dust of overspray over the whole
        // picture instead — one near-pixel speckle field and one coarser dusting
        float fine = texture(tNoise, p / 130.0).a;
        float dust = texture(tNoise, p / 29.0).b;
        return (fine - 0.5) * 0.6 + (dust - 0.5) * 0.4;
      }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

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

        // --- the outline: a piece is drawn before it is filled. Where the surface itself breaks —
        // a silhouette against what stands behind it, or a corner where the normal swings — lay a
        // bold line of deep ink. The normals come from the depth picture: one at this pixel, one a
        // few pixels over; flat walls, the ground and the drum's slow curve agree between the two
        // and stay clean, while rims, corners, window frames and silhouettes disagree and ink.
        {
          vec2 e1 = 1.6 / uSize;
          vec2 e2 = vec2(3.4 / uSize.x, 0.0);
          vec3 px1 = worldAt(vUv + vec2(e1.x, 0.0)), px0 = worldAt(vUv - vec2(e1.x, 0.0));
          vec3 py1 = worldAt(vUv + vec2(0.0, e1.y)), py0 = worldAt(vUv - vec2(0.0, e1.y));
          vec3 nA = cross(px1 - px0, py1 - py0);
          vec3 NA = nA / max(length(nA), 1e-6);
          if (dot(NA, ray) > 0.0) NA = -NA;
          vec2 c2 = vUv + e2;
          vec3 qx1 = worldAt(c2 + vec2(e1.x, 0.0)), qx0 = worldAt(c2 - vec2(e1.x, 0.0));
          vec3 qy1 = worldAt(c2 + vec2(0.0, e1.y)), qy0 = worldAt(c2 - vec2(0.0, e1.y));
          vec3 nB = cross(qx1 - qx0, qy1 - qy0);
          vec3 NB = nB / max(length(nB), 1e-6);
          if (dot(NB, ray) > 0.0) NB = -NB;
          float crease = 1.0 - clamp(dot(NA, NB), 0.0, 1.0);
          // silhouettes: the farthest and nearest samples a few pixels out, against this pixel
          float dC = far;
          float dFar = dC, dNear = dC;
          vec2 ring[4]; ring[0] = vec2(3.4, 0.0); ring[1] = vec2(-3.4, 0.0); ring[2] = vec2(0.0, 3.4); ring[3] = vec2(0.0, -3.4);
          for (int i = 0; i < 4; i++) {
            float dd = length(worldAt(vUv + ring[i] / uSize) - uEye);
            dFar = max(dFar, dd); dNear = min(dNear, dd);
          }
          float jump = max(dFar - dC, dC - dNear) / max(dC, 1.0);
          float edge = max(smoothstep(0.50, 0.92, crease), smoothstep(0.085, 0.20, jump));
          col = mix(col, vec3(0.045, 0.030, 0.095), edge * 0.94);
        }

        if (uCanvas > 0.0) {
          vec2 px = vUv * uSize;
          float g0 = grain(px);
          float gx = grain(px + vec2(1.0, 0.0)) - g0, gy = grain(px + vec2(0.0, 1.0)) - g0;
          col *= 1.0 + (g0 * 0.05 + (0.6 * gx - 0.8 * gy) * 0.014) * uCanvas;
        }
        // the brightest passages roll off toward the white of the paint and never past it
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        // varnish: a little more depth in the darks, the lights left alone
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
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

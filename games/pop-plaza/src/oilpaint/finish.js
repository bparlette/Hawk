// The canvas. The world is painted into a picture with a depth beside it; this then lays in the one thing dabs
// can't do, the sun standing in the mist between the trunks, and finishes the surface: the weave of the canvas
// under thin paint, and a little varnish.
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
    uOutlineCol: { value: new THREE.Color(0.0, 0.0, 0.0) },
    uDots: { value: 1 },
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
      uniform float uDots;
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
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // Ben-Day dots: a mechanical print screen, not hand-placed stipple. The grid is a regular
        // 45-degree screen in pure screen space, identical everywhere on the page; only the dot
        // radius changes, and it changes in five hard steps. Saturated ink in the light prints
        // flat, the way Lichtenstein's reds and yellows do; the screen falls on shade, on skin
        // shadow, on stone and on the ground's shadow — the neutrals and half-tones of the panel.
        if (uDots > 0.0) {
          float mx = max(col.r, max(col.g, col.b));
          float mn = min(col.r, min(col.g, col.b));
          float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          float shadeAmt = clamp(1.0 - lum / 0.95, 0.0, 1.0);
          float dotAmt = shadeAmt * mix(1.0, 0.35, sat);
          float tq = floor(dotAmt * 5.0 + 0.02) / 5.0; // stepped coverage: 0, .2, .4, .6, .8, 1
          if (tq > 0.0) {
            float cellPx = uSize.y / 105.0;
            vec2 rp = mat2(0.70711, -0.70711, 0.70711, 0.70711) * gl_FragCoord.xy;
            vec2 gv = mod(rp, cellPx) - cellPx * 0.5;
            float r = cellPx * 0.60 * sqrt(tq);
            float d = length(gv);
            float aa = max(fwidth(d), 0.6);
            float dotm = 1.0 - smoothstep(r - aa, r + aa, d);
            vec3 ink = col * 0.30 + vec3(0.0, 0.0, 0.02); // the dot prints as a deep shade of what it shades
            col = mix(col, ink, dotm * uDots);
          }
        }

        // Pop outlines: where the depth steps hard between neighbouring pixels — a silhouette, an
        // eave, the fountain's rim — lay a thick black comic line. The step is judged against the
        // distance, so the ground running away at a slant (a smooth depth ramp) never trips it, and
        // the line is sampled at two widths so it prints bold, not hairline.
        if (uOutline > 0.0) {
          vec2 tx = 2.0 / uSize;
          float e = 0.0;
          for (int i = 0; i < 8; i++) {
            vec2 dir = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : i == 3 ? vec2(0.0, -1.0)
              : i == 4 ? vec2(1.0, 0.0) : i == 5 ? vec2(-1.0, 0.0) : i == 6 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
            vec2 off = dir * tx * (i < 4 ? 0.5 : 1.0);
            float dn = texture(tDepth, vUv + off).r;
            vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
            float farn = length(hn.xyz / hn.w - uEye);
            e = max(e, abs(far - farn) / (0.03 + 0.025 * far));
          }
          float line = smoothstep(0.55, 1.25, e) * (1.0 - smoothstep(60.0, 140.0, far));
          col = mix(col, uOutlineCol, clamp(line, 0.0, 1.0) * uOutline);
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

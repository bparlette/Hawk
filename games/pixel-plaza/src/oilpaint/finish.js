// The television. Pixel Plaza's whole medium lives here, in three passes. First the world is
// painted into a picture with a depth beside it, but the picture is TINY — a grid of game
// pixels, 180 of them across the screen however big the screen is. Then the finish runs ON
// that grid, one fragment per game pixel: the sun shafts and depth outlines of the cartoon
// original, and at the end every colour is snapped to the DawnBringer 32 palette with a
// Bayer ordered dither, which is how the 8-bit era shaded — where a gradient would band, it
// checkerboards two palette colours instead. Last, a plain blit blows the grid up to the
// screen with nearest-neighbour sampling only, so every game pixel lands as one hard square
// block of one flat palette colour. Nothing anywhere interpolates.
import * as THREE from 'three';
import { COMMON } from './common.js';

// the grid: this many game pixels across the screen's width, whatever the screen is
export const PIXEL_W = 180;

function pixelSize(renderer) {
  const css = renderer.getSize(new THREE.Vector2());
  const w = PIXEL_W;
  const h = Math.max(96, Math.min(512, Math.round((PIXEL_W * css.y) / Math.max(css.x, 1))));
  return new THREE.Vector2(w, h);
}

export function createFrame(renderer, shared) {
  const pix = pixelSize(renderer);
  // pass 1: the painted world, colour + depth, at game resolution, no MSAA — a sprite's
  // edges are hard because nothing ever averaged them
  const target = new THREE.WebGLRenderTarget(pix.x, pix.y, { samples: 0, depthBuffer: true, generateMipmaps: false });
  target.depthTexture = new THREE.DepthTexture(pix.x, pix.y, THREE.UnsignedIntType);
  target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  // pass 2: the finished grid, still at game resolution — the blit magnifies it from here
  const outTarget = new THREE.WebGLRenderTarget(pix.x, pix.y, { depthBuffer: false, generateMipmaps: false });
  outTarget.texture.minFilter = THREE.NearestFilter;
  outTarget.texture.magFilter = THREE.NearestFilter;

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
    uSize: { value: pix.clone() }, // the GAME pixel grid: the finish thinks in game pixels throughout
    uDither: { value: 0.16 }, // how hard the Bayer dither pushes a colour toward its palette neighbour
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
      uniform float uDither;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      float weave(vec2 p) {
        // warp and weft of a medium linen, each thread a little uneven
        vec2 q = p / 2.6;
        float n = texture(tNoise, p / 310.0).r;
        float a = sin(q.x * 3.14159) * sin(q.y * 3.14159 + floor(q.x) * 3.14159);
        return a * (0.3 + 1.4 * n * n);
      }

      // ordered dither thresholds, the recursive Bayer matrices (2 -> 4 -> 8), in [0, 1)
      float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float bayer4(vec2 a) { return bayer2(a * 0.5) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(a * 0.5) * 0.25 + bayer2(a); }

      // DawnBringer's 32: a palette an artist picked, not a quantiser's grid — skin, stone,
      // foliage, sky and water all have somewhere true to land, so hues never snap garish.
      // A compile-time constant: the search below reads it, it never rebuilds it.
      const vec3 PALETTE[32] = vec3[32](
        vec3(0.0000, 0.0000, 0.0000), vec3(0.1333, 0.1255, 0.2039), vec3(0.2706, 0.1569, 0.2353), vec3(0.4000, 0.2235, 0.1922),
        vec3(0.5608, 0.3373, 0.2314), vec3(0.8745, 0.4431, 0.1490), vec3(0.8510, 0.6275, 0.4000), vec3(0.9333, 0.7647, 0.6039),
        vec3(0.9843, 0.9490, 0.2118), vec3(0.6000, 0.8980, 0.3137), vec3(0.4157, 0.7451, 0.1882), vec3(0.2157, 0.5804, 0.4314),
        vec3(0.2941, 0.4118, 0.1843), vec3(0.3216, 0.2941, 0.1412), vec3(0.1961, 0.2353, 0.2235), vec3(0.2471, 0.2471, 0.4549),
        vec3(0.1882, 0.3765, 0.5098), vec3(0.3569, 0.4314, 0.8824), vec3(0.3882, 0.6078, 1.0000), vec3(0.3725, 0.8039, 0.8941),
        vec3(0.7961, 0.8588, 0.9882), vec3(1.0000, 1.0000, 1.0000), vec3(0.6078, 0.6784, 0.7176), vec3(0.5176, 0.4941, 0.5294),
        vec3(0.4118, 0.4157, 0.4157), vec3(0.3490, 0.3373, 0.3216), vec3(0.4627, 0.2588, 0.5412), vec3(0.6745, 0.1961, 0.1961),
        vec3(0.8510, 0.3412, 0.3882), vec3(0.8431, 0.4824, 0.7294), vec3(0.5608, 0.5922, 0.2902), vec3(0.5412, 0.4353, 0.1882)
      );
      vec3 quantise(vec2 gp, vec3 c) {
        // push the colour by the Bayer threshold first: inside a would-be band, neighbouring
        // game pixels tip to opposite palette neighbours and the eye mixes the checkerboard
        vec3 want = c + (bayer8(gp) - 0.5) * uDither;
        vec3 best = PALETTE[0];
        float bd = 1e9;
        for (int i = 0; i < 32; i++) {
          vec3 d = want - PALETTE[i];
          float dist = dot(d * d, vec3(0.299, 0.587, 0.114)); // green counts most: the eye judges shade by it
          if (dist < bd) { bd = dist; best = PALETTE[i]; }
        }
        return best;
      }

      void main() {
        // this fragment IS one game pixel (the pass renders at grid size), so its own uv,
        // snapped to the texel centre, is the only address anything below ever reads
        vec2 gp = floor(vUv * uSize);
        vec2 guv = (gp + 0.5) / uSize;
        vec3 col = texture(tColor, guv).rgb;
        float depth = texture(tDepth, guv).r;
        vec4 h = uInvViewProj * vec4(guv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // outlines, one game pixel wide: where the depth steps hard between neighbouring
        // game pixels — a silhouette, an eave, the fountain's rim — lay the dark line. The
        // step is judged against the distance, so the ground running away at a slant (a
        // smooth depth ramp) never trips it. After quantising, the line lands on the
        // palette's near-blacks, the way ink sits in a sprite.
        if (uOutline > 0.0) {
          vec2 tx = 1.0 / uSize;
          float e = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 off = (i == 0 ? vec2(tx.x, 0.0) : i == 1 ? vec2(-tx.x, 0.0) : i == 2 ? vec2(0.0, tx.y) : vec2(0.0, -tx.y));
            float dn = texture(tDepth, guv + off).r;
            vec4 hn = uInvViewProj * vec4((guv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
            float farn = length(hn.xyz / hn.w - uEye);
            e = max(e, abs(far - farn) / (0.03 + 0.025 * far));
          }
          float line = smoothstep(0.7, 1.7, e) * (1.0 - smoothstep(35.0, 80.0, far));
          col = mix(col, uOutlineCol, clamp(line, 0.0, 1.0) * 0.85 * uOutline);
        }

        // sun in the mist: walk the line of sight and count how much of the air along it
        // stands in the light. The jitter is hashed from the game pixel, so the glow is as
        // blocky as everything else and dithers with the sky instead of shimmering smooth.
        if (uShafts > 0.0) {
          float reach = min(far, 85.0);
          float jit = fract(52.9829189 * fract(dot(gp, vec2(0.06711056, 0.00583715))));
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
          float streak = 0.75 + 0.5 * texture(tNoise, vec2(dot(world.xz, vec2(uSunDir.z, -uSunDir.x)) * 0.11, world.y * 0.02)).g;
          vec3 glow = vec3(1.0, 0.86, 0.56) * (0.16 + 0.95 * pow(sunward, 2.5));
          col += glow * (lit - 0.34) * thick * streak * uShafts * 0.8;
        }

        if (uCanvas > 0.0) {
          vec2 px = guv * uSize;
          float w = weave(px);
          float dx = weave(px + vec2(1.0, 0.0)) - w, dy = weave(px + vec2(0.0, 1.0)) - w;
          col *= 1.0 + (0.6 * dx - 0.8 * dy) * 0.022 * uCanvas + w * 0.006 * uCanvas;
        }
        // the brightest passages roll off toward white and never past it
        vec3 over = max(col - 0.8, 0.0);
        col = min(col, 0.8) + over / (1.0 + over * 5.0);
        // varnish, barely
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.08);
        // and then the medium itself: one of 32 colours, dithered
        outC = vec4(quantise(gp, col), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);

  // pass 3: the blit. A fullscreen quad whose only job is magnification — the texture's
  // NearestFilter does the whole of it, so the screen shows game pixels and nothing else.
  const blitMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tGrid: { value: outTarget.texture } },
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tGrid;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(texture(tGrid, vUv).rgb, 1.0); }`,
  });
  const blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial);
  blitQuad.frustumCulled = false;
  const blitScene = new THREE.Scene();
  blitScene.add(blitQuad);

  const flat = new THREE.Camera();
  const viewProj = new THREE.Matrix4();

  return {
    target,
    uniforms,
    pixSize: pix, // the game-pixel grid; main.js reads its height for uPixel so dabs size in game pixels
    resize() {
      const p = pixelSize(renderer);
      pix.copy(p);
      target.setSize(p.x, p.y);
      outTarget.setSize(p.x, p.y);
      uniforms.uSize.value.copy(p);
    },
    render(world, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(world, camera);
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      uniforms.uInvViewProj.value.copy(viewProj).invert();
      uniforms.uEye.value.copy(camera.position);
      renderer.setRenderTarget(outTarget);
      renderer.render(scene, flat);
      renderer.setRenderTarget(null);
      renderer.render(blitScene, flat);
    },
  };
}

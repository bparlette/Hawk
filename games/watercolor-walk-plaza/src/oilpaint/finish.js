// The sheet of paper, in two states. The world is washed into a picture with a depth
// beside it; every pixel's world position is looked up in the walk mask (walkmask.js) —
// where she has walked, the picture is finished as the watercolour the plain lane lays
// (paper tooth, sun in the mist, lights rolling off to bare paper); where she has not,
// the same picture is read as the pencil sketch it began as: tone smudged and held in
// broad bands on warm paper, shaded with three families of world-anchored hatch that
// switch on as the tone deepens, silhouettes drawn with a wavering graphite line. The
// mask's own edge is broken with noise, so the frontier between the two states wobbles
// and blooms the way a wet edge does instead of ending on a compass line.
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
      uniform sampler2D tWalkSettled;
      uniform sampler2D tWalkWet;
      uniform float uWalkHalf;
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

      const vec3 PAPER = vec3(0.955, 0.925, 0.85);     // this sheet's bare paper
      const vec3 GRAPHITE = vec3(0.145, 0.14, 0.135);  // the darkest a soft pencil lays down

      // the paper: a fine tooth that pigment settles into, over a broad unevenness in the sheet
      float paperTooth(vec2 px) { return texture(tNoise, px / 850.0).g; }
      float paperMottle(vec2 uv) { return texture(tNoise, uv * 2.6 + 0.37).r; }

      // How painted is this spot? The mask is a top-down picture of the plaza; the wet
      // layer may stand past the settled edge — that overshoot is the bloom. The edge is
      // then broken with a slow noise so the frontier wobbles like a real wet edge.
      float walkMaskAt(vec3 world, float depth) {
        if (depth > 0.9999) return 0.0; // the sky was never anything but paper
        vec2 muv = (world.xz + uWalkHalf) / (2.0 * uWalkHalf);
        if (any(lessThan(muv, vec2(0.0))) || any(greaterThan(muv, vec2(1.0)))) return 0.0;
        float m = max(texture(tWalkSettled, muv).r, texture(tWalkWet, muv).r * 0.9);
        float n = texture(tNoise, world.xz / 2.7).g;
        m += (n - 0.5) * 0.22 * (1.0 - abs(m * 2.0 - 1.0));
        return smoothstep(0.03, 0.97, clamp(m, 0.0, 1.0));
      }

      float lumS(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      // One family of hatch lines (the graphite lane's hand). p is a world-anchored
      // coordinate in "lines" units, already turned to the family's angle; act is how
      // fully the family is laid (0 none, 1 full).
      float hatchF(vec2 p, float act, float seed) {
        if (act <= 0.002) return 0.0;
        float s = p.y + (texture(tNoise, p * 0.011 + seed * 0.37).r - 0.5) * 1.6;
        float id = floor(s);
        float f = abs(fract(s) - 0.5) * 2.0;
        float press = 0.7 + 0.3 * hash4(id * 1.71 + seed * 39.7).x;
        float w = mix(0.3, 1.0, act);
        float line = 1.0 - smoothstep(w - 0.4, w + 0.1, f);
        float lift = texture(tNoise, vec2(p.x * 0.008, id * 0.23 + seed * 7.0)).g;
        line *= smoothstep(0.15, 0.48, lift + act * 0.38);
        return line * act * press;
      }

      // a depth step between neighbours, judged against the distance, so a smooth
      // ground ramp never trips it (the shared shape of both passes' outlines)
      float depthStep(float far) {
        vec2 tx = 2.0 / uSize;
        float e = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 off = (i == 0 ? vec2(tx.x, 0.0) : i == 1 ? vec2(-tx.x, 0.0) : i == 2 ? vec2(0.0, tx.y) : vec2(0.0, -tx.y));
          float dn = texture(tDepth, vUv + off).r;
          vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
          float farn = length(hn.xyz / hn.w - uEye);
          e = max(e, abs(far - farn) / (0.03 + 0.025 * far));
        }
        return e;
      }

      // The sketch state: the same picture, read as tone only and drawn in graphite.
      vec3 sketchOf(vec3 raw, vec3 world, float far) {
        // smudge: borrow a little of the neighbours' tone, then hold the tone in
        // broad, slightly stepped values — a sketch keeps a few flat tones
        vec2 tx = 1.6 / uSize;
        vec3 blur = texture(tColor, vUv + vec2(tx.x, tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, tx.y)).rgb
                  + texture(tColor, vUv + vec2(tx.x, -tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, -tx.y)).rgb;
        float lS = mix(lumS(raw), lumS(blur * 0.25), 0.45);
        float band = (floor(lS * 7.0) + smoothstep(0.35, 0.65, fract(lS * 7.0))) / 7.0;
        float dark = 1.0 - mix(lS, band, 0.38);

        // the wash: wherever there is tone at all, a light even smudge on the paper
        vec3 pic = PAPER * (1.0 - 0.30 * smoothstep(0.02, 0.75, dark));

        // the hatching, anchored to the world and laid on whichever plane the surface
        // mostly faces (read from the depth's own gradient); three families switch on
        // with the dark, exactly as the graphite lane lays them
        vec3 N = normalize(cross(dFdx(world), dFdy(world)) + vec3(1e-5, 0.0, 0.0));
        vec3 an = abs(N);
        vec2 base = an.y >= an.x && an.y >= an.z ? world.xz : (an.x >= an.z ? world.zy : world.xy);
        vec2 hp = base * 21.0;
        float cA = cos(0.62), sA = sin(0.62);
        float cB = cos(-0.53), sB = sin(-0.53);
        float cC = cos(1.18), sC = sin(1.18);
        float hA = hatchF(vec2(hp.x * cA - hp.y * sA, hp.x * sA + hp.y * cA), smoothstep(0.30, 0.58, dark), 0.13);
        float hB = hatchF(vec2(hp.x * cB - hp.y * sB, hp.x * sB + hp.y * cB), smoothstep(0.50, 0.74, dark), 0.41);
        float hC = hatchF(vec2(hp.x * cC - hp.y * sC, hp.x * sC + hp.y * cC), smoothstep(0.68, 0.88, dark), 0.79);
        float dep = 1.0 - (1.0 - 0.52 * hA) * (1.0 - 0.48 * hB) * (1.0 - 0.44 * hC);
        pic = mix(pic, GRAPHITE * 1.35, dep * 0.92);

        // sketch lines at the silhouettes, broken by noise the way a hand's line gaps
        float brk = 0.68 + 0.55 * texture(tNoise, vUv * vec2(24.0, 42.0)).b;
        float line = smoothstep(0.7, 1.7, depthStep(far)) * (1.0 - smoothstep(35.0, 80.0, far)) * brk;
        pic = mix(pic, GRAPHITE, clamp(line, 0.0, 1.0) * 0.88);

        // the tooth of the paper grains the drawing everywhere, lights included
        float tooth = texture(tNoise, gl_FragCoord.xy / 700.0).r;
        float fibre = texture(tNoise, gl_FragCoord.xy / 2300.0 + 0.31).g;
        pic *= 1.0 + (tooth - 0.5) * 0.06 + (fibre - 0.5) * 0.035;
        return min(pic, PAPER); // nothing in a pencil drawing is brighter than bare paper
      }

      void main() {
        vec3 raw = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        float mask = walkMaskAt(world, depth);

        // ---- the painted state: the watercolour finish, as the plain lane lays it ----
        vec3 painted = raw;
        if (uOutline > 0.0) {
          float line = smoothstep(0.7, 1.7, depthStep(far)) * (1.0 - smoothstep(35.0, 80.0, far));
          painted = mix(painted, uOutlineCol, clamp(line, 0.0, 1.0) * 0.85 * uOutline);
        }
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
          float streak = 0.75 + 0.5 * texture(tNoise, vec2(dot(world.xz, vec2(uSunDir.z, -uSunDir.x)) * 0.11, world.y * 0.02)).g;
          vec3 glow = vec3(1.0, 0.86, 0.56) * (0.16 + 0.95 * pow(sunward, 2.5));
          painted += glow * (lit - 0.34) * thick * streak * uShafts * 0.8;
        }
        if (uCanvas > 0.0) {
          vec2 px = vUv * uSize;
          float lum = dot(painted, vec3(0.35, 0.45, 0.2));
          float settle = mix(1.25, 0.75, clamp(lum, 0.0, 1.0));
          painted *= 1.0 + ((paperTooth(px) - 0.5) * 0.06 + (paperMottle(vUv) - 0.5) * 0.05) * settle * uCanvas;
        }

        // ---- the sketch state, and the frontier between them ----
        vec3 col = mix(sketchOf(raw, world, far), painted, mask);

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

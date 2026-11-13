// The sheet of paper. The world is drawn into a picture with a depth beside it; this pass turns that
// picture into a graphite drawing. The scene's colours are read as tone only: the tone is smudged a
// little (a stump dragging graphite), laid on warm off-white paper as a light wash, and then shaded
// the way a pencil shades — hatch lines whose families switch on as the tone deepens: one direction
// for the mid-tones, a crossing family for the shades, a third for the deepest darks, with bare paper
// left for the lights. Silhouettes get a sketch line that breaks the way a hand's does, and the tooth
// of the paper grains everything. Nothing in the picture is brighter than the paper itself.
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
    uShafts: { value: 0 }, // kept for the shared uniform shape; a sketch has no light shafts
    uSteps: { value: 22 },
    uCanvas: { value: 1 }, // here: the strength of the paper grain
    uOutline: { value: 1 },
    uOutlineCol: { value: new THREE.Color(0.145, 0.14, 0.135) }, // graphite, not ink
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

      const vec3 PAPER = vec3(0.935, 0.905, 0.845);    // warm off-white drawing paper
      const vec3 GRAPHITE = vec3(0.145, 0.14, 0.135); // the darkest a soft pencil lays down

      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      // One family of hatch lines. p is a world-anchored coordinate in "lines" units, already
      // turned to the family's angle; act is how fully the family is laid (0 none, 1 full).
      float hatch(vec2 p, float act, float seed) {
        if (act <= 0.002) return 0.0;
        // the hand is not a ruler: the spacing wanders with a slow noise
        float s = p.y + (texture(tNoise, p * 0.011 + seed * 0.37).r - 0.5) * 1.6;
        float id = floor(s);
        float f = abs(fract(s) - 0.5) * 2.0; // 0 at a line's heart, 1 midway between lines
        float press = 0.7 + 0.3 * hash4(id * 1.71 + seed * 39.7).x; // each line its own pressure
        float w = mix(0.3, 1.0, act); // lines fatten as the tone they build deepens
        float line = 1.0 - smoothstep(w - 0.4, w + 0.1, f);
        // and the pencil lifts: along a line, stretches fade out and come back
        float lift = texture(tNoise, vec2(p.x * 0.008, id * 0.23 + seed * 7.0)).g;
        line *= smoothstep(0.15, 0.48, lift + act * 0.38);
        return line * act * press;
      }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        float far = length(world - uEye);

        // Smudge: borrow a little of the neighbours' tone, the way a stump drags graphite
        // across the tooth; then hold the tone in broad, slightly stepped values — a sketch
        // keeps a few flat tones, not a photograph's endless ramp.
        vec2 tx = 1.6 / uSize;
        vec3 blur = texture(tColor, vUv + vec2(tx.x, tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, tx.y)).rgb
                  + texture(tColor, vUv + vec2(tx.x, -tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, -tx.y)).rgb;
        float lS = mix(lum(col), lum(blur * 0.25), 0.45);
        float band = (floor(lS * 7.0) + smoothstep(0.35, 0.65, fract(lS * 7.0))) / 7.0;
        float dark = 1.0 - mix(lS, band, 0.38);

        // The wash: wherever there is tone at all, a light even smudge of graphite on the paper.
        vec3 pic = PAPER * (1.0 - 0.30 * smoothstep(0.02, 0.75, dark));

        // The hatching. Coordinates are anchored to the world, so the drawing does not swim
        // when the eye moves, and laid on whichever plane the surface mostly faces — read from
        // the depth's own gradient. Three families, three angles, switching on with the dark.
        vec3 N = normalize(cross(dFdx(world), dFdy(world)) + vec3(1e-5, 0.0, 0.0));
        vec3 an = abs(N);
        vec2 base = an.y >= an.x && an.y >= an.z ? world.xz : (an.x >= an.z ? world.zy : world.xy);
        vec2 hp = base * 21.0; // hatch lines per metre
        float cA = cos(0.62), sA = sin(0.62);
        float cB = cos(-0.53), sB = sin(-0.53);
        float cC = cos(1.18), sC = sin(1.18);
        float hA = hatch(vec2(hp.x * cA - hp.y * sA, hp.x * sA + hp.y * cA), smoothstep(0.30, 0.58, dark), 0.13);
        float hB = hatch(vec2(hp.x * cB - hp.y * sB, hp.x * sB + hp.y * cB), smoothstep(0.50, 0.74, dark), 0.41);
        float hC = hatch(vec2(hp.x * cC - hp.y * sC, hp.x * sC + hp.y * cC), smoothstep(0.68, 0.88, dark), 0.79);
        float dep = 1.0 - (1.0 - 0.52 * hA) * (1.0 - 0.48 * hB) * (1.0 - 0.44 * hC);
        pic = mix(pic, GRAPHITE * 1.35, dep * 0.92);

        // Sketch lines: where the depth steps hard between neighbouring pixels — a silhouette,
        // an eave, the fountain's rim — lay a graphite line. The step is judged against the
        // distance, so the ground running away at a slant never trips it; the line's strength
        // is broken up by noise, the way a hand-drawn line wavers and gaps.
        if (uOutline > 0.0) {
          vec2 txo = 2.0 / uSize;
          float e = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 off = (i == 0 ? vec2(txo.x, 0.0) : i == 1 ? vec2(-txo.x, 0.0) : i == 2 ? vec2(0.0, txo.y) : vec2(0.0, -txo.y));
            float dn = texture(tDepth, vUv + off).r;
            vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
            float farn = length(hn.xyz / hn.w - uEye);
            e = max(e, abs(far - farn) / (0.03 + 0.025 * far));
          }
          float brk = 0.68 + 0.55 * texture(tNoise, vUv * vec2(24.0, 42.0)).b;
          float line = smoothstep(0.7, 1.7, e) * (1.0 - smoothstep(35.0, 80.0, far)) * brk;
          pic = mix(pic, uOutlineCol, clamp(line, 0.0, 1.0) * 0.88 * uOutline);
        }

        // The tooth of the paper: a fine grain and a slower fibre, everywhere, lights included.
        if (uCanvas > 0.0) {
          float tooth = texture(tNoise, gl_FragCoord.xy / 700.0).r;
          float fibre = texture(tNoise, gl_FragCoord.xy / 2300.0 + 0.31).g;
          pic *= 1.0 + ((tooth - 0.5) * 0.06 + (fibre - 0.5) * 0.035) * uCanvas;
        }
        pic = min(pic, PAPER); // nothing in a pencil drawing is brighter than bare paper
        outC = vec4(pic, 1.0);
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

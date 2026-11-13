// The sheet of paper. The world is drawn into a picture with a depth beside it; this pass lays that
// picture down in colored pencil. The scene's true colours are the pigments: each is mixed onto warm
// off-white paper with a COVERAGE that follows the tone — lights are mostly bare paper with a breath
// of pigment, darks are pressed full — and the coverage is broken everywhere by the tooth of the
// paper, so no surface is ever a flat CG fill. Over that laydown the shading is done the colored-
// pencil way: fine hatch lines IN THE LOCAL PIGMENT, darkened and saturated the way a harder-pressed
// pencil deepens — one family for the mid-tones, a crossing family for the shades, a third for the
// deepest darks — anchored to the world on each surface's own plane, so the strokes follow the form
// and never swim. Silhouettes get a soft drawn line in a darkened local colour, a touch wobbly, never
// a hard CG outline and never black. At the frame's edge the drawing fades out to the bare sheet —
// the white paper vignette every one of these drawings sits in. Nothing is brighter than the paper.
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
    uShafts: { value: 0 }, // kept for the shared uniform shape; a drawing has no light shafts
    uSteps: { value: 22 },
    uCanvas: { value: 1 }, // here: the strength of the paper grain in the coverage
    uOutline: { value: 1 },
    uOutlineCol: { value: new THREE.Color(0.30, 0.22, 0.165) }, // the deep anchor the edge lines lean toward: warm dark sepia, not ink
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

      const vec3 PAPER = vec3(0.945, 0.918, 0.862); // warm off-white drawing paper

      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

      // A pigment pressed harder: darker, and MORE saturated as it deepens — never grayer.
      // This is what separates a colored-pencil shade from a graphite one.
      vec3 pressed(vec3 c, float mul) {
        vec3 s = c * mul;
        return mix(vec3(lum(s)), s, 1.22);
      }

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

        // Soften the CG edge off the pigment: borrow a little of the neighbours' colour,
        // the way one pencil pass bleeds a whisper into the next. Then a touch of the
        // medium's pastel lean: every pigment pulled slightly toward its own lightness.
        vec2 tx = 1.4 / uSize;
        vec3 blur = texture(tColor, vUv + vec2(tx.x, tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, tx.y)).rgb
                  + texture(tColor, vUv + vec2(tx.x, -tx.y)).rgb + texture(tColor, vUv + vec2(-tx.x, -tx.y)).rgb;
        vec3 pig = mix(col, blur * 0.25, 0.35);
        float L = lum(pig);
        pig = mix(pig, vec3(L), 0.10);

        // The laydown: pigment mixed onto the paper with a coverage that follows the tone.
        // Highlights are the paper itself showing through a breath of pigment; the deepest
        // darks are pressed to full coverage. Nothing here is a flat fill, because the
        // paper's tooth breaks the coverage at two scales — a fine grain and a slower fibre.
        float cov = mix(0.58, 1.0, smoothstep(0.98, 0.30, L));
        float tooth = texture(tNoise, gl_FragCoord.xy / 640.0).r;
        float fibre = texture(tNoise, gl_FragCoord.xy / 2100.0 + 0.31).g;
        cov = clamp(cov * (1.0 + ((tooth - 0.5) * 0.36 + (fibre - 0.5) * 0.18) * uCanvas), 0.0, 1.0);
        vec3 pic = mix(PAPER, pig, cov);

        // The hatching. Coordinates are anchored to the world, so the drawing does not swim
        // when the eye moves, and laid on whichever plane the surface mostly faces — read from
        // the depth's own gradient, so the strokes follow the form. Three families, three
        // angles, switching on as the tone deepens; each is drawn in the local pigment pressed
        // harder, so a pink wall is shaded with deeper pink, never with gray. The lines are
        // FINER than the graphite sheet's: 30 to the metre against its 21.
        float band = (floor(L * 7.0) + smoothstep(0.35, 0.65, fract(L * 7.0))) / 7.0;
        float dark = 1.0 - mix(L, band, 0.30);
        vec3 N = normalize(cross(dFdx(world), dFdy(world)) + vec3(1e-5, 0.0, 0.0));
        vec3 an = abs(N);
        vec2 base = an.y >= an.x && an.y >= an.z ? world.xz : (an.x >= an.z ? world.zy : world.xy);
        vec2 hp = base * 30.0; // hatch lines per metre
        float cA = cos(0.62), sA = sin(0.62);
        float cB = cos(-0.53), sB = sin(-0.53);
        float cC = cos(1.18), sC = sin(1.18);
        float hA = hatch(vec2(hp.x * cA - hp.y * sA, hp.x * sA + hp.y * cA), smoothstep(0.05, 0.35, dark), 0.13);
        float hB = hatch(vec2(hp.x * cB - hp.y * sB, hp.x * sB + hp.y * cB), smoothstep(0.44, 0.70, dark), 0.41);
        float hC = hatch(vec2(hp.x * cC - hp.y * sC, hp.x * sC + hp.y * cC), smoothstep(0.64, 0.86, dark), 0.79);
        pic = mix(pic, pressed(pig, 0.60), hA * 0.50);
        pic = mix(pic, pressed(pig, 0.47), hB * 0.46);
        pic = mix(pic, pressed(pig, 0.38), hC * 0.38);

        // Drawn lines: where the depth steps hard between neighbouring pixels — a silhouette,
        // an eave, the fountain's rim — lay a soft pencil line in a darkened LOCAL colour,
        // leaned a little toward warm sepia. The step is judged against the distance, so the
        // ground running away at a slant never trips it; the line's strength is broken up by
        // noise, the way a hand-drawn line wavers and gaps. Softer than the graphite line:
        // colored pencil edges are the pigment's own dark, not a separate ink.
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
          vec3 lineCol = mix(pressed(pig, 0.42), uOutlineCol, 0.30);
          pic = mix(pic, lineCol, clamp(line, 0.0, 1.0) * 0.72 * uOutline);
        }

        // The paper vignette: toward the frame's edge the drawing is lifted away and the
        // bare sheet takes over — every one of these drawings floats in a soft white border.
        vec2 q = (vUv - 0.5) * vec2(uSize.x / uSize.y, 1.0);
        float vig = smoothstep(0.44, 1.0, length(q) * 1.42);
        pic = mix(pic, PAPER, vig * 0.65);

        pic = min(pic, PAPER); // nothing in a colored-pencil drawing is brighter than bare paper
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

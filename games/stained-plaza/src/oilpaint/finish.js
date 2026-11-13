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
    uOutlineCol: { value: new THREE.Color(0.09, 0.07, 0.11) },
    uGlass: { value: 0 }, // stained glass: 1 turns the whole finish into panes, lead cames and backlit glow
    uGlassCell: { value: 0.62 }, // pane size, metres (world-space voronoi)
    uGlassGlow: { value: 1 }, // strength of the backlit lift on bright panes
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
      uniform float uGlass;
      uniform float uGlassCell;
      uniform float uGlassGlow;
      uniform vec2 uSize;
      in vec2 vUv;
      layout(location = 0) out vec4 outC;

      vec3 hash33(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.xxy + p.yxx) * p.zyx);
      }

      // Jittered-grid voronoi: nearest and second-nearest feature distances, plus the winning
      // cell's randoms — the raw material of glass panes and the lead cames between them.
      vec3 voro(vec3 p, out float f1, out float f2) {
        vec3 ip = floor(p), fp = fract(p);
        f1 = 8.0; f2 = 8.0;
        vec3 rnd = vec3(0.0);
        for (int x = -1; x <= 1; x++)
        for (int y = -1; y <= 1; y++)
        for (int z = -1; z <= 1; z++) {
          vec3 g = vec3(float(x), float(y), float(z));
          vec3 o = hash33(ip + g);
          vec3 r = g + o - fp;
          float d = dot(r, r);
          if (d < f1) { f2 = f1; f1 = d; rnd = o; }
          else if (d < f2) { f2 = d; }
        }
        f1 = sqrt(f1); f2 = sqrt(f2);
        return rnd;
      }

      // Pull a colour's chroma toward the nearest jewel hue (ruby, cobalt, amber, emerald,
      // violet) at the same luminance — glass colours, not paint colours. Greys stay grey.
      vec3 jewelSnap(vec3 c, float amt) {
        vec3 jewels[5];
        jewels[0] = vec3(0.72, 0.04, 0.14);
        jewels[1] = vec3(0.08, 0.22, 0.85);
        jewels[2] = vec3(0.95, 0.58, 0.06);
        jewels[3] = vec3(0.04, 0.62, 0.28);
        jewels[4] = vec3(0.44, 0.14, 0.74);
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 chroma = c - lum;
        float sat = length(chroma);
        if (sat < 1e-4) return c;
        vec3 cn = chroma / sat;
        vec3 best = jewels[0]; float bd = -1.0;
        for (int i = 0; i < 5; i++) {
          float jl = dot(jewels[i], vec3(0.299, 0.587, 0.114));
          vec3 jc = jewels[i] - jl;
          float d = dot(cn, jc / max(length(jc), 1e-4));
          if (d > bd) { bd = d; best = jewels[i]; }
        }
        float bl = dot(best, vec3(0.299, 0.587, 0.114));
        vec3 target = best * (lum / max(bl, 1e-3));
        return mix(c, target, amt * smoothstep(0.02, 0.22, sat));
      }

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

        // --- stained glass: the whole picture is re-cut into panes of jewel glass joined by
        //     dark lead cames, and lit from behind. Panes are a voronoi laid through the world
        //     itself, so they ride over ground, walls and fountain and follow their forms; the
        //     sky is cut on the ray's direction instead — panes in a glass dome.
        if (uGlass > 0.0) {
          vec3 raw = col;
          bool isSky = depth > 0.99995;
          float paneFade = isSky ? 1.0 : 1.0 - smoothstep(30.0, 85.0, far);
          float f1, f2;
          vec3 cellRnd = isSky ? voro(normalize(ray) * 4.0, f1, f2) : voro(world / uGlassCell, f1, f2);
          float edgeDist = isSky ? (f2 - f1) : (f2 - f1) * uGlassCell;
          // glass colour: saturated hard, hue pulled toward the jewel set, then the value
          // stepped pane by pane — flat within a pane but for the handmade wobble of real glass
          float lum0 = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(lum0), col, 1.5);
          col = jewelSnap(col, 0.38);
          if (isSky) {
            col *= 0.90 + 0.20 * cellRnd.x; // each dome pane its own brightness
          } else {
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            float q = (floor(lum * 4.0 + cellRnd.y * 0.9) + 0.5) / 4.0;
            float target = mix(lum, q, 0.55 * paneFade + 0.15);
            target *= 0.87 + 0.26 * cellRnd.x;
            float uneven = texture(tNoise, world.xz * 0.11 + world.y * 0.07).g;
            float streak = texture(tNoise, world.zy * 0.045 + 0.37).r;
            target *= 0.93 + 0.09 * uneven + 0.05 * streak;
            col *= target / max(lum, 1e-3);
          }
          // lead cames from three sources, one dark line: the voronoi borders; a silhouette
          // where the depth jumps (sampled wide, so the came is thick); and any hard colour
          // border in the paint, so panes also follow the paving checker and the inlay rings
          float lwW = isSky ? 0.022 : max(0.030, 2.4 * far * uPixel);
          float came = 1.0 - smoothstep(lwW * 0.4, lwW, edgeDist);
          if (!isSky) {
            vec2 tx3 = 3.0 / uSize;
            float sil = 0.0;
            for (int i = 0; i < 4; i++) {
              vec2 off = (i == 0 ? vec2(tx3.x, 0.0) : i == 1 ? vec2(-tx3.x, 0.0) : i == 2 ? vec2(0.0, tx3.y) : vec2(0.0, -tx3.y));
              float dn = texture(tDepth, vUv + off).r;
              vec4 hn = uInvViewProj * vec4((vUv + off) * 2.0 - 1.0, dn * 2.0 - 1.0, 1.0);
              float farn = length(hn.xyz / hn.w - uEye);
              sil = max(sil, abs(far - farn) / (0.03 + 0.025 * far));
            }
            came = max(came, smoothstep(0.9, 2.2, sil) * (0.35 + 0.65 * paneFade));
            vec2 tx2 = 2.0 / uSize;
            float cEdge = 0.0;
            cEdge = max(cEdge, distance(texture(tColor, vUv + vec2(tx2.x, 0.0)).rgb, raw));
            cEdge = max(cEdge, distance(texture(tColor, vUv - vec2(tx2.x, 0.0)).rgb, raw));
            cEdge = max(cEdge, distance(texture(tColor, vUv + vec2(0.0, tx2.y)).rgb, raw));
            cEdge = max(cEdge, distance(texture(tColor, vUv - vec2(0.0, tx2.y)).rgb, raw));
            came = max(came, smoothstep(0.40, 0.72, cEdge) * paneFade);
          }
          col = mix(col, vec3(0.012, 0.012, 0.020), clamp(came, 0.0, 1.0) * 0.97);
          // backlit: bright saturated panes lift and glow against the dark lead
          float lum2 = dot(col, vec3(0.299, 0.587, 0.114));
          float sat2 = length(col - lum2);
          col *= 1.10;
          col += col * pow(clamp(lum2, 0.0, 1.0), 2.0) * sat2 * 1.6 * uGlassGlow;
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

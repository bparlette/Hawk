// The canvas. The world is painted into a picture with a depth beside it; this then lays the whole picture
// under tesserae: every surface — ground, walls, fountain, sky, and the wanderer herself — is re-laid as
// small squarish tiles on a grid anchored to the world, each tile one flat colour sampled from the middle
// of the tile, with a per-tile jitter of value (hand-set tiles are never quite equal) and a thin line of
// dark mortar in the gaps. The grid follows the surface through its depth: a pixel's tile is found by
// standing on the surface's own plane (the triplanar way), so tiles wrap round the fountain and round her
// body instead of sliding across the screen. After the tiling, the sun standing in the mist is laid over,
// and the picture is varnished.
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
    uViewProj: { value: new THREE.Matrix4() },
    uEye: { value: new THREE.Vector3() },
    uShafts: { value: 1 },
    uSteps: { value: 22 },
    uCanvas: { value: 1 },
    uMosaic: { value: 1 },
    uTile: { value: 0.105 },
    uGrout: { value: new THREE.Color(0.13, 0.115, 0.10) },
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
      uniform mat4 uViewProj;
      uniform vec3 uEye;
      uniform float uShafts;
      uniform float uSteps;
      uniform float uCanvas;
      uniform float uMosaic;
      uniform float uTile;
      uniform vec3 uGrout;
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

      vec3 worldFromDepth(vec2 uv, float d) {
        vec4 h = uInvViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return h.xyz / h.w;
      }
      vec2 uvFromWorld(vec3 w) {
        vec4 c = uViewProj * vec4(w, 1.0);
        return (c.xy / c.w) * 0.5 + 0.5;
      }

      // The colour of one tile: the picture sampled at the tile's own centre, on the surface the pixel
      // stands on. If that centre lands on some other surface (a silhouette's edge, a nearer thing), the
      // tile is refused, so tiles never bleed across outlines.
      vec3 tileSample(vec3 centreWorld, float dist, inout bool ok) {
        ok = false;
        vec2 uvC = uvFromWorld(centreWorld);
        if (uvC.x < 0.002 || uvC.x > 0.998 || uvC.y < 0.002 || uvC.y > 0.998) return vec3(0.0);
        float dC = texture(tDepth, uvC).r;
        if (dC > 0.99995) return vec3(0.0);
        vec3 PC = worldFromDepth(uvC, dC);
        if (abs(length(PC - uEye) - dist) > max(0.30, dist * 0.05)) return vec3(0.0);
        ok = true;
        return texture(tColor, uvC).rgb;
      }

      // Lay the picture under tesserae. baseCol is the painted colour at this very pixel, the fallback
      // wherever no tile can be sampled whole.
      vec3 mosaicPass(vec3 baseCol, vec2 uv, float depth) {
        vec3 Pw = worldFromDepth(uv, depth);
        vec3 toP = Pw - uEye;
        float dist = length(toP);
        vec3 dir = toP / max(dist, 1e-4);

        // --- the sky: no surface to stand on, so its tiles ride the ray itself, an angular grid that
        //     stays put on the dome as the eye turns ---
        if (depth > 0.99995 || dist > 320.0) {
          float ang = 0.030; // a tile's angular size: about a scene tile seen from a few metres
          vec2 ga = vec2(atan(dir.z, dir.x) + 2.2, asin(clamp(dir.y, -1.0, 1.0)));
          vec2 g = ga / ang;
          vec2 cell = floor(g);
          vec2 f = g - cell;
          vec2 mid = (cell + 0.5) * ang;
          float rawA = mid.x - 2.2;
          vec3 dirC = vec3(cos(mid.y) * cos(rawA), sin(mid.y), cos(mid.y) * sin(rawA));
          vec2 uvC = uvFromWorld(uEye + dirC * 600.0);
          vec3 col = texture(tColor, clamp(uvC, vec2(0.001), vec2(0.999))).rgb;
          col = floor(col * 24.0 + 0.5) / 24.0; // one flat colour a tile
          vec4 h = hash4(cell, 3.7);
          col *= 0.94 + 0.12 * h.x; // hand-set: no two tiles quite equal
          vec2 fw = clamp(vec2(fwidth(g.x), fwidth(g.y)), vec2(1e-4), vec2(0.35));
          vec2 bc = min(f, 1.0 - f);
          float gr = 1.0 - smoothstep(0.5, 1.5, min(bc.x / fw.x, bc.y / fw.y));
          gr = max(gr, 1.0 - smoothstep(0.015, 0.05, min(bc.x, bc.y)));
          vec3 gc = uGrout * (0.9 + 0.5 * clamp(dot(col, vec3(0.3333)), 0.0, 1.3));
          return mix(col, gc, gr * 0.85);
        }

        // --- the surface's way up, read off the depth beside the pixel ---
        vec2 e = 2.0 / uSize;
        float dR = texture(tDepth, uv + vec2(e.x, 0.0)).r;
        float dL = texture(tDepth, uv - vec2(e.x, 0.0)).r;
        float dU = texture(tDepth, uv + vec2(0.0, e.y)).r;
        float dD = texture(tDepth, uv - vec2(0.0, e.y)).r;
        vec3 PR = dR > 0.99995 ? Pw : worldFromDepth(uv + vec2(e.x, 0.0), dR);
        vec3 PL = dL > 0.99995 ? Pw : worldFromDepth(uv - vec2(e.x, 0.0), dL);
        vec3 PU = dU > 0.99995 ? Pw : worldFromDepth(uv + vec2(0.0, e.y), dU);
        vec3 PD = dD > 0.99995 ? Pw : worldFromDepth(uv - vec2(0.0, e.y), dD);
        vec3 N = cross(PR - PL, PU - PD);
        float nl = length(N);
        N = nl > 1e-9 ? N / nl : -dir;
        if (dot(N, dir) > 0.0) N = -N;

        // Tiles grow a little in the world as they recede, so on the canvas they shrink only mildly
        // with distance instead of vanishing, the way the dab fields coarsen with their LOD rings.
        float ts = uTile * (1.0 + dist * 0.030);
        vec3 wgt = pow(abs(N), vec3(3.0));
        wgt /= max(wgt.x + wgt.y + wgt.z, 1e-5);

        vec3 colSum = vec3(0.0);
        float wSum = 0.0;
        float domW = -1.0;
        vec2 domCell = vec2(0.0), domF = vec2(0.5), domG = vec2(0.0);
        float domSalt = 1.0;

        // the three standings a surface can have: flat (grid on XZ), facing the lane (XY), side-on (ZY)
        {
          vec2 g = Pw.xz / ts; vec2 cell = floor(g); vec2 f = g - cell;
          bool ok; vec3 c = tileSample(vec3((cell.x + 0.5) * ts, Pw.y, (cell.y + 0.5) * ts), dist, ok);
          if (ok) { colSum += c * wgt.y; wSum += wgt.y; }
          if (wgt.y > domW) { domW = wgt.y; domCell = cell; domF = f; domG = g; domSalt = 1.0; }
        }
        {
          vec2 g = Pw.xy / ts; vec2 cell = floor(g); vec2 f = g - cell;
          bool ok; vec3 c = tileSample(vec3((cell.x + 0.5) * ts, (cell.y + 0.5) * ts, Pw.z), dist, ok);
          if (ok) { colSum += c * wgt.z; wSum += wgt.z; }
          if (wgt.z > domW) { domW = wgt.z; domCell = cell; domF = f; domG = g; domSalt = 2.0; }
        }
        {
          vec2 g = Pw.zy / ts; vec2 cell = floor(g); vec2 f = g - cell;
          bool ok; vec3 c = tileSample(vec3(Pw.x, (cell.y + 0.5) * ts, (cell.x + 0.5) * ts), dist, ok);
          if (ok) { colSum += c * wgt.x; wSum += wgt.x; }
          if (wgt.x > domW) { domW = wgt.x; domCell = cell; domF = f; domG = g; domSalt = 3.0; }
        }

        vec3 col = wSum > 0.001 ? colSum / wSum : baseCol;
        col = floor(col * 24.0 + 0.5) / 24.0; // one flat colour a tile
        vec4 h = hash4(domCell, domSalt * 7.31);
        col *= 0.94 + 0.12 * h.x;                                  // hand-set value jitter
        if (h.y > 0.94) col *= 1.10;                               // the odd glassy tessera catching the light
        col = mix(col, col * vec3(1.03, 0.99, 0.94), (h.z - 0.5) * 0.35); // a whisper of warm/cool variation

        // a tile sits a touch proud in its middle and falls to the mortar at its rim
        vec2 bc = min(domF, 1.0 - domF);
        float bd = min(bc.x, bc.y);
        col *= 0.965 + 0.05 * smoothstep(0.0, 0.5, bd);
        vec2 fw = clamp(vec2(fwidth(domG.x), fwidth(domG.y)), vec2(1e-4), vec2(0.35));
        vec2 bp = bc / fw; // the rim's distance in pixels: the mortar line keeps its width on the canvas
        float bpMin = min(bp.x, bp.y);
        float gr = 1.0 - smoothstep(0.5, 1.5, bpMin);
        gr = max(gr, 1.0 - smoothstep(0.02, 0.055, bd)); // and never thinner than a set share of the tile
        float ao = (1.0 - smoothstep(1.2, 3.5, bpMin)) * 0.16;   // the mortar's shadow just inside the rim
        col *= 1.0 - ao * (1.0 - gr);
        vec3 gc = uGrout * (0.7 + 0.55 * clamp(dot(col, vec3(0.3333)), 0.0, 1.3));
        col = mix(col, gc, gr * 0.95);
        return col;
      }

      void main() {
        vec3 col = texture(tColor, vUv).rgb;
        float depth = texture(tDepth, vUv).r;
        vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec3 world = h.xyz / h.w;
        vec3 ray = world - uEye;
        float far = length(ray);
        ray /= far;

        // the whole picture, laid as tesserae
        if (uMosaic > 0.0) col = mosaicPass(col, vUv, depth);

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
        // varnish, barely: flat tile colour stays flat
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
      uniforms.uViewProj.value.copy(viewProj);
      uniforms.uInvViewProj.value.copy(viewProj).invert();
      uniforms.uEye.value.copy(camera.position);
      renderer.render(scene, flat);
    },
  };
}

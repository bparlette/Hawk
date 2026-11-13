// PaintPost — prototype: can Lanternport wear Painted Live's paint?
//
// A drop-in replacement for fx.js's Post (same constructor/setSize/render shape, same
// .final.uniforms.uDusk/uSun that setLight() pokes) used only when ?paint=1. The scene is
// rendered into the same kind of HDR target Lanternport already uses (HalfFloat, MSAA 4,
// depth texture) with the same bright/blur bloom chain; the final pass then swaps
// Lanternport's ink/haze/ACES grade for Painted Live's finish:
//
//   * painted()  — the depth-banded, alpha-exempt Kuwahara from src/oilpaint/finish.js
//                  (Painted Valley port, MIT, Copyright (c) 2026 Patch), radius <= 2, full
//                  strength only in the 4-55 m band, alpha < 0.6 exempt.
//   * weave()    — the canvas warp/weft overlay, also from finish.js.
//   * the varnish rolloff (bright passages roll toward paint white; darks deepen).
//
// Two honest differences from the plaza, both forced by the host:
//   1. The plaza authors display-ready colour ("colours are paint, never tone-mapped"), so
//      its finish reads the picture directly. Lanternport authors LINEAR HDR and grades at
//      the end (ACES + saturation + warm/cool split + gamma in fx.js FINAL_FRAG). So here
//      each Kuwahara sample is graded() first — Lanternport's own grade, minus its depth
//      effects — and the paint flattens the graded picture. Bloom is sampled once at the
//      centre pixel and added after the flatten (it is low-frequency; per-sample bloom
//      would triple the fetch count for no visible gain).
//   2. finish.js's sun shafts are NOT ported: they march toward sunAt(), which reads the
//      plaza world's tree/figure shadow-map textures (tTreeShade/tFigShade in common.js).
//      Lanternport has no such maps, so the shaft term has nothing true to read.
//
// What paint mode therefore drops from Lanternport's own final pass: contact shading,
// ink edges, aerial-perspective haze. The Kuwahara's edge preservation and the 4-55 m
// band are what replace them. HUD/minimap are DOM/canvas overlays and are untouched.

function noiseSheet(THREE, size = 256, seed = 7) {
  // The plaza's tiling noise sheet (src/oilpaint/common.js), needed by weave().
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const data = new Uint8Array(size * size * 4);
  for (let ch = 0; ch < 4; ch++) {
    const field = new Float32Array(size * size);
    for (const [cells, amp] of [[8, 1], [16, 0.5], [32, 0.25], [64, 0.125]]) {
      const lat = new Float32Array(cells * cells);
      for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * cells, fy = (y / size) * cells;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          let tx = fx - x0, ty = fy - y0;
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          const a = lat[(x0 % cells) + (y0 % cells) * cells], b = lat[((x0 + 1) % cells) + (y0 % cells) * cells];
          const c = lat[(x0 % cells) + ((y0 + 1) % cells) * cells], d = lat[((x0 + 1) % cells) + ((y0 + 1) % cells) * cells];
          field[x + y * size] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
        }
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of field) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < field.length; i++) data[i * 4 + ch] = Math.round(((field[i] - lo) / (hi - lo)) * 255);
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FRAG = `uniform sampler2D tColor; uniform vec2 uPx; varying vec2 vUv;
void main(){ vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i / 2) - 0.5, mod(float(i), 2.0) - 0.5) * 2.0 * uPx; c += min(texture2D(tColor, vUv + o).rgb, vec3(24.0)); } c *= 0.25;
  float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 1.9, l), 1.0); }`;
const BLUR_FRAG = `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tColor, vUv).rgb * 0.227; c += (texture2D(tColor, vUv + uDir * 1.385).rgb + texture2D(tColor, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(tColor, vUv + uDir * 3.231).rgb + texture2D(tColor, vUv - uDir * 3.231).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }`;

const PAINT_VERT = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PAINT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler2D tBloomA;
  uniform sampler2D tBloomB;
  uniform sampler2D tNoise;
  uniform mat4 uInvViewProj;
  uniform vec3 uEye;
  uniform vec2 uSize;
  uniform vec2 uPaintTexel;
  uniform float uPaint;   // Kuwahara radius level (2 = Painted Live's default; 0 = grade only)
  uniform float uCanvas;  // canvas weave strength
  uniform float uHeat;    // gameplay heat vignette (kept from Lanternport's own final)
  uniform float uDusk;    // setLight() pokes this, as it does Post.final
  uniform vec3 uSun;      // setLight() pokes this too; unused here beyond the interface
  in vec2 vUv;
  layout(location = 0) out vec4 outC;

  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

  // Lanternport's own grade (fx.js FINAL_FRAG minus its depth effects): filmic tonemap,
  // a little extra saturation, cool shadows / warm lights, gamma. The plaza never needs
  // this step because its shaders author display colour; Lanternport's author linear HDR.
  vec3 graded(vec2 uv) {
    vec3 col = aces(texture(tColor, uv).rgb * 1.12);
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, 1.16);
    col = mix(col * vec3(0.96, 0.98, 1.06), col * vec3(1.05, 1.0, 0.93), smoothstep(0.15, 0.75, lum));
    col = mix(col, col * vec3(1.06, 0.6, 0.78) + vec3(0.03, 0.0, 0.07), uDusk * 0.3); // dusk tint (the original spends uDusk on its haze, which paint mode drops)
    return pow(col, vec3(1.0 / 2.2));
  }

  // --- painted() and weave(): ported from Painted Live's src/oilpaint/finish.js -------
  vec3 painted(vec2 uv, float away) {
    int r = int(uPaint);
    bool done = textureLod(tColor, uv, 0.0).a < 0.6;
    r = min(r, 2);
    if (away < 4.0 || away > 55.0) r = 1;
    if (done) r = 0;
    vec3 m[4];
    vec3 s[4];
    for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
    for (int j = -r; j <= r; j++) {
      for (int i = -r; i <= r; i++) {
        vec3 c = graded(uv + vec2(float(i), float(j)) * uPaintTexel);
        c = c / (1.0 + c);
        vec3 cc = c * c;
        if (i <= 0 && j <= 0) { m[0] += c; s[0] += cc; }
        if (i >= 0 && j <= 0) { m[1] += c; s[1] += cc; }
        if (i <= 0 && j >= 0) { m[2] += c; s[2] += cc; }
        if (i >= 0 && j >= 0) { m[3] += c; s[3] += cc; }
      }
    }
    float n = float((r + 1) * (r + 1));
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int k = 0; k < 4; k++) {
      vec3 mean = m[k] / n;
      vec3 var = abs(s[k] / n - mean * mean);
      float v = var.r + var.g + var.b;
      float w = 1.0 / (1e-7 + v * v * v * v * 1e12);
      sum += mean * w;
      total += w;
    }
    vec3 o = sum / total;
    return o / (1.0 - min(o, vec3(0.985)));
  }

  float weave(vec2 p) {
    vec2 q = p / 2.6;
    float n = texture(tNoise, p / 310.0).r;
    float a = sin(q.x * 3.14159) * sin(q.y * 3.14159 + floor(q.x) * 3.14159);
    return a * (0.3 + 1.4 * n * n);
  }
  // -------------------------------------------------------------------------------------

  void main() {
    float depth = texture(tDepth, vUv).r;
    vec4 h = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec3 world = h.xyz / h.w;
    float far = length(world - uEye);

    vec3 col = uPaint > 0.5 ? painted(vUv, far) : graded(vUv);
    // bloom, graded the same way, added after the flatten (see header note 1)
    vec3 bloom = aces((texture(tBloomA, vUv).rgb * 0.5 + texture(tBloomB, vUv).rgb * 0.55) * 1.12);
    col += pow(bloom, vec3(1.0 / 2.2)) * 0.85;

    if (uCanvas > 0.0) {
      vec2 px = vUv * uSize;
      float w = weave(px);
      float dx = weave(px + vec2(1.0, 0.0)) - w, dy = weave(px + vec2(0.0, 1.0)) - w;
      col *= 1.0 + (0.6 * dx - 0.8 * dy) * 0.022 * uCanvas + w * 0.006 * uCanvas;
    }
    // the brightest passages roll off toward the white of the paint and never past it
    vec3 over = max(col - 0.8, 0.0);
    col = min(col, 0.8) + over / (1.0 + over * 5.0);
    // varnish: a little more depth in the darks, the lights left alone
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
    // Lanternport's gameplay vignette + heat glow survive the paint (fx.js FINAL_FRAG)
    vec2 q = vUv - 0.5;
    float vg = smoothstep(0.85, 0.3, length(q * vec2(1.0, 0.8)));
    col *= mix(0.72, 1.0, vg);
    col = mix(col, vec3(1.0, 0.45, 0.2), (1.0 - vg) * uHeat);
    outC = vec4(col, 1.0);
  }`;

export class PaintPost {
  constructor(THREE, renderer) {
    this.THREE = THREE; this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const sm = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.bright = sm(BRIGHT_FRAG, { tColor: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.blur = sm(BLUR_FRAG, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.paintMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PAINT_VERT,
      fragmentShader: PAINT_FRAG,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
        tNoise: { value: noiseSheet(THREE) },
        uInvViewProj: { value: new THREE.Matrix4() }, uEye: { value: new THREE.Vector3() },
        uSize: { value: new THREE.Vector2(2, 2) }, uPaintTexel: { value: new THREE.Vector2(1 / 2, 1 / 2) },
        uPaint: { value: 2 }, uCanvas: { value: 1 }, uHeat: { value: 0 }, uDusk: { value: 0 },
        uSun: { value: new THREE.Vector3(0.5, 0.64, -0.58).normalize() },
      },
      depthTest: false, depthWrite: false,
    });
    // setLight() pokes post.final.uniforms.{uDusk,uSun} — give it the real uniforms object.
    this.final = this.paintMat;
    this.rts = null;
  }
  setSize(w, h) {
    const T = this.THREE; if (this.rts) Object.values(this.rts).forEach((t) => t.dispose());
    const rt = (W, H, o = {}) => new T.WebGLRenderTarget(Math.max(2, W | 0), Math.max(2, H | 0), { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, ...o });
    const depth = new T.DepthTexture(w, h); depth.type = T.UnsignedIntType;
    this.rts = { scene: rt(w, h, { depthBuffer: true, depthTexture: depth, samples: 4 }), b1: rt(w / 2, h / 2), a2: rt(w / 4, h / 4), b2: rt(w / 4, h / 4), a3: rt(w / 8, h / 8), b3: rt(w / 8, h / 8) };
    this.w = w; this.h = h;
    this.paintMat.uniforms.uSize.value.set(w, h);
    this.paintMat.uniforms.uPaintTexel.value.set(1 / w, 1 / h);
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera, time, heat = 0) {
    const R = this.rts, r = this.r, u = this.paintMat.uniforms;
    r.setRenderTarget(R.scene); r.render(scene, camera);
    this.bright.uniforms.tColor.value = R.scene.texture; this.bright.uniforms.uPx.value.set(1 / this.w, 1 / this.h); this.pass(this.bright, R.b1);
    const blur = (src, tmp, dst) => { const bu = this.blur.uniforms; bu.tColor.value = src.texture; bu.uDir.value.set(1 / tmp.width, 0); this.pass(this.blur, tmp); bu.tColor.value = tmp.texture; bu.uDir.value.set(0, 1 / dst.height); this.pass(this.blur, dst); };
    blur(R.b1, R.a2, R.b2); blur(R.b2, R.a3, R.b3);
    u.tColor.value = R.scene.texture; u.tDepth.value = R.scene.depthTexture;
    u.tBloomA.value = R.b2.texture; u.tBloomB.value = R.b3.texture;
    u.uHeat.value = heat;
    u.uInvViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    u.uEye.value.copy(camera.position);
    this.pass(this.paintMat, null);
  }
}

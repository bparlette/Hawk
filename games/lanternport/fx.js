// Lanternport rendering toolkit: the look. Everything here is generated in code (no image or model files):
//   textures   - procedural plaster, stone, cobbles, pavers, roof tiles, wood, glass, awning stripes
//   toon()     - soft two-band cel shading with warm rim light, optional world-space texture tiling,
//                ground-contact darkening, and wind (grass, bunting)
//   makeSky()  - sky dome: gradient, sun disc and glow, drifting lit clouds; plus hazy mountain ridges
//   Post       - HDR pipeline: contact shading, ink edges, aerial-perspective haze with sun scatter,
//                two-level bloom, filmic tone map, grade, vignette, grain
export const SUN_DIR = [0.5, 0.64, -0.58];

// ------------------------------------------------------------------------------------------------ textures
export function makeTextures(THREE) {
  let seed = 1234; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const tex = (size, draw, sh = size) => {
    const c = document.createElement('canvas'); c.width = size; c.height = sh; draw(c.getContext('2d'), size, sh);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  };
  const speckle = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * a})`; g.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2); } };
  const blotch = (g, s, n, r0, r1, a) => { for (let i = 0; i < n; i++) { const x = R() * s, y = R() * s, r = r0 + R() * (r1 - r0), dark = R() < 0.55; for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${dark ? '70,55,40' : '255,255,255'},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } } };
  const T = {};
  T.plaster = tex(512, (g, s) => { g.fillStyle = '#f3eee4'; g.fillRect(0, 0, s, s); blotch(g, s, 260, 20, 90, 0.05); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,70,50,${R() * 0.035})`; g.fillRect(R() * s, 0, 2 + R() * 10, s); } speckle(g, s, 5000, 0.07); });
  T.stone = tex(512, (g, s) => {
    g.fillStyle = '#7f776c'; g.fillRect(0, 0, s, s);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * 128 + (row % 2) * 64 + 3, y = row * 64 + 3, w = 122, h = 58, v = 200 + R() * 45;
      g.fillStyle = `rgb(${v},${v - 6 - R() * 8},${v - 18 - R() * 14})`; g.beginPath(); g.roundRect(x, y, w, h, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x + 6, y + 3, w - 12, 3); g.fillStyle = 'rgba(40,30,30,0.22)'; g.fillRect(x + 6, y + h - 6, w - 12, 4);
    }
    blotch(g, s, 120, 10, 50, 0.06); speckle(g, s, 6000, 0.1);
  });
  T.cobble = tex(512, (g, s) => {
    g.fillStyle = '#9a9082'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const cx = (i + 0.5 + (j % 2) * 0.5) * (s / 9) + (R() - 0.5) * 7, cy = (j + 0.5) * (s / 9) + (R() - 0.5) * 7, rx = 25.5 + R() * 3, ry = 24.5 + R() * 3, v = 214 + R() * 34, rot = (R() - 0.5) * 0.6;
      for (const ox of [0, s, -s]) {
        g.fillStyle = `rgb(${v},${v - 8 - R() * 6},${v - 22 - R() * 10})`; g.beginPath(); g.ellipse(cx + ox, cy, rx, ry, rot, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx + ox, cy, rx - 4, ry - 4, rot, 3.4, 5.2); g.stroke();
        g.strokeStyle = 'rgba(30,20,25,0.25)'; g.beginPath(); g.ellipse(cx + ox, cy, rx - 3, ry - 3, rot, 0.3, 2.3); g.stroke();
      }
    }
    blotch(g, s, 60, 30, 110, 0.07); speckle(g, s, 5000, 0.09);
  });
  T.paver = tex(256, (g, s) => {
    g.fillStyle = '#8a8176'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { const v = 222 + R() * 26; g.fillStyle = `rgb(${v},${v - 6},${v - 20})`; g.beginPath(); g.roundRect(i * 128 + (j % 2) * 64 - 64 + 2, j * 64 + 2, 124, 60, 5); g.fill(); g.beginPath(); g.roundRect(i * 128 + (j % 2) * 64 + 64 + 2, j * 64 + 2, 124, 60, 5); g.fill(); }
    blotch(g, s, 40, 15, 60, 0.06); speckle(g, s, 2500, 0.08);
  });
  T.tiles = tex(256, (g, s) => {
    g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, s, s);
    for (let row = 9; row >= -1; row--) for (let col = -1; col < 9; col++) {
      const x = col * 32 + (row % 2 ? 16 : 0), y = row * 28, v = 205 + R() * 50;
      g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y); g.lineTo(x + 32, y + 22); g.quadraticCurveTo(x + 16, y + 40, x, y + 22); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 32, y + 22); g.quadraticCurveTo(x + 16, y + 40, x, y + 22); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, y + 3); g.lineTo(x + 3, y + 20); g.stroke();
    }
  }, 252);
  T.wood = tex(256, (g, s) => {
    for (let i = 0; i < 4; i++) { const v = 205 + R() * 40; g.fillStyle = `rgb(${v},${v - 10},${v - 24})`; g.fillRect(i * 64, 0, 64, s); g.fillStyle = 'rgba(40,25,15,0.45)'; g.fillRect(i * 64, 0, 2.5, s);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(70,45,25,${0.08 + R() * 0.14})`; g.lineWidth = 1 + R(); const x = i * 64 + 6 + R() * 52; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 5, s * 0.3, x - 5, s * 0.6, x, s); g.stroke(); } }
    speckle(g, s, 1500, 0.06);
  });
  T.glass = tex(128, (g, s, h) => { // one window: glass gradient, reflection streaks, muntin bars
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#a9a9a9'); g.fillStyle = gr; g.fillRect(0, 0, s, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(0, h * 0.55); g.lineTo(s * 0.55, 0); g.lineTo(s * 0.8, 0); g.lineTo(0, h * 0.8); g.fill();
    g.fillStyle = '#3a2f33'; g.fillRect(s / 2 - 4, 0, 8, h); g.fillRect(0, h * 0.36 - 4, s, 8); g.fillRect(0, h * 0.68 - 4, s, 8);
    g.strokeStyle = '#3a2f33'; g.lineWidth = 10; g.strokeRect(0, 0, s, h);
  }, 192);
  T.glass.wrapS = T.glass.wrapT = THREE.ClampToEdgeWrapping;
  T.stripes = tex(64, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.fillStyle = '#7d7d7d'; g.fillRect(0, 0, s / 2, s); }); T.stripes.repeat.set(5, 1);
  T.glow = tex(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  T.beam = tex(8, (g, s, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)'); g.fillStyle = gr; g.fillRect(0, 0, s, h); }, 128);
  return T;
}

// ------------------------------------------------------------------------------------------------ materials
export function makeMaterials(THREE, timeU) {
  // Cel ramp: a dark band and a lit band with a short soft edge between them, like hand-painted cel shading.
  const ramp = new THREE.DataTexture(new Uint8Array([34, 34, 36, 60, 214, 255, 255, 255].flatMap((v) => [v, v, v, 255])), 8, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter; ramp.needsUpdate = true;
  /** opts: map, uv (world-space tiling in repeats per metre), ao (darken toward the ground), rim, wind ('grass'|'flag'), plus any MeshToonMaterial option. */
  const toon = (color, o = {}) => {
    const { uv = 0, ao = false, rim = 0.5, wind = '', ...rest } = o;
    const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...rest });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU;
      let v = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy; uniform float uTime;');
      v = v.replace('#include <begin_vertex>', `#include <begin_vertex>
        ${wind === 'grass' ? `#ifdef USE_INSTANCING
          float wph = instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.38;
          float wv = sin(uTime * 1.7 + wph) * 0.16 + sin(uTime * 3.1 + wph * 1.7) * 0.06 + 0.1;
          transformed.x += wv * uv.y * uv.y; transformed.z += wv * 0.5 * uv.y * uv.y;
        #endif` : ''}
        ${wind === 'flag' ? `#ifdef USE_INSTANCING
          transformed.z += sin(uTime * 5.0 + instanceMatrix[3].x * 2.1 + instanceMatrix[3].z * 1.7) * 0.1 * -position.y * 2.0;
        #endif` : ''}`);
      v = v.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec4 wuvP = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          wuvP = instanceMatrix * wuvP;
        #endif
        wuvP = modelMatrix * wuvP; vWy = wuvP.y;
        ${uv ? `#ifdef USE_MAP
          vec3 wuvN = abs(normal);
          vMapUv = (wuvN.y > 0.5 ? wuvP.xz : wuvN.x > 0.5 ? wuvP.zy : wuvP.xy) * ${uv.toFixed(4)};
        #endif` : ''}`);
      sh.vertexShader = v;
      let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy;');
      if (ao) f = f.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 2.6, vWy));');
      f = f.replace('#include <opaque_fragment>', `float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
        outgoingLight += diffuseColor.rgb * rimF * vec3(1.0, 0.8, 0.58) * ${rim.toFixed(3)};
        #include <opaque_fragment>`);
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => `lp|${uv}|${ao}|${rim}|${wind}`;
    return m;
  };
  const glowMat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
  const ink = new THREE.MeshBasicMaterial({ color: 0x1a1424, side: THREE.BackSide });
  /** Add a mesh (with an optional inverted-hull ink line) to a parent. color: hex or material. */
  const part = (parent, geo, color, x = 0, y = 0, z = 0, line = 0.022) => {
    const m = new THREE.Mesh(geo, typeof color === 'number' ? toon(color) : color); m.position.set(x, y, z); m.castShadow = true; parent.add(m);
    if (line) { geo.computeBoundingSphere(); const o = new THREE.Mesh(geo, ink); o.scale.setScalar(1 + line / Math.max(0.12, geo.boundingSphere.radius)); m.add(o); }
    return m;
  };
  return { toon, glowMat, ink, part, ramp };
}

// ------------------------------------------------------------------------------------------------ sky
const SKY_FRAG = `
uniform vec3 uSun; uniform float uTime; varying vec3 vDir;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float h = max(d.y, 0.0);
  vec3 col = mix(vec3(1.0, 0.76, 0.52), vec3(0.42, 0.66, 0.96), smoothstep(0.0, 0.2, h));
  col = mix(col, vec3(0.13, 0.33, 0.78), smoothstep(0.12, 0.9, h));
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.55, 0.25) * pow(sd, 5.0) * 0.45 + vec3(1.0, 0.82, 0.55) * pow(sd, 48.0) * 1.0;
  col += vec3(1.0, 0.93, 0.78) * smoothstep(0.9990, 0.9996, sd) * 14.0;
  if (d.y > 0.01) {
    vec2 p = d.xz / (d.y + 0.14) * 1.5 + uTime * vec2(0.008, 0.003);
    float n = fbm(p) + 0.3 * fbm(p * 2.7 + 9.0);
    float c = smoothstep(0.62, 0.86, n);
    float lit = smoothstep(-0.05, 0.3, n - (fbm(p + uSun.xz * 0.16) + 0.3 * fbm((p + uSun.xz * 0.16) * 2.7 + 9.0)) + 0.1);
    vec3 cc = mix(vec3(0.56, 0.55, 0.76), vec3(1.0, 0.94, 0.84), lit) * (1.0 + 0.7 * pow(sd, 3.0));
    cc = mix(cc, vec3(1.0, 0.8, 0.6), (1.0 - smoothstep(0.0, 0.3, d.y)) * 0.6);
    col = mix(col, cc, c * smoothstep(0.01, 0.16, d.y) * 0.94);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
export function makeSky(THREE, timeU) {
  const g = new THREE.Group(), sun = new THREE.Vector3(...SUN_DIR).normalize();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sun }, uTime: timeU },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SKY_FRAG }));
  dome.renderOrder = -10; dome.frustumCulled = false; g.add(dome);
  // layered mountain ridges: each farther layer is taller, paler and bluer (aerial perspective)
  const layers = [[520, 46, 0x5f8a5a, 3], [800, 120, 0x6f93a8, 11], [1250, 250, 0x93aed0, 23], [1800, 420, 0xb6c6e2, 41]];
  for (const [R, H, color, sd] of layers) {
    const n = 220, pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, t = a * R / 90;
      const y = H * (0.42 + 0.26 * Math.sin(t * 0.53 + sd) + 0.17 * Math.sin(t * 1.31 + sd * 2.1) + 0.1 * Math.sin(t * 3.7 + sd * 0.7) + 0.05 * Math.sin(t * 9.1 + sd));
      pos.push(Math.cos(a) * R, -30, Math.sin(a) * R, Math.cos(a) * R, Math.max(6, y), Math.sin(a) * R); if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; g.add(m);
  }
  const land = new THREE.Mesh(new THREE.CircleGeometry(1900, 48), new THREE.MeshBasicMaterial({ color: 0x86b85a })); land.rotation.x = -Math.PI / 2; land.position.y = -0.3; g.add(land);
  return g;
}

/** Sun-lit dust motes drifting around the camera. */
export function makeMotes(THREE, timeU, tex) {
  const n = 500, p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: timeU, uCam: { value: new THREE.Vector3() }, uTex: { value: tex } },
    vertexShader: `uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){ vec3 box = vec3(46.0, 16.0, 46.0); vec3 q = position * box + vec3(uTime * 0.5, sin(uTime * 0.3 + position.x * 40.0) * 0.6, uTime * 0.22);
        vec3 w = mod(q - uCam + box * 0.5, box) - box * 0.5 + uCam; w.y = mod(q.y, box.y) + 0.2;
        vec4 mv = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv; float tw = 0.5 + 0.5 * sin(uTime * 2.0 + position.z * 90.0);
        vA = tw * smoothstep(46.0, 20.0, -mv.z) * smoothstep(0.5, 3.0, -mv.z); gl_PointSize = (0.05 + 0.06 * position.y) * 900.0 / -mv.z; }`,
    fragmentShader: 'uniform sampler2D uTex; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.6, 1.3, 0.85) * vA, 1.0) * texture2D(uTex, gl_PointCoord).a; }' }));
  m.frustumCulled = false; return m;
}

// ------------------------------------------------------------------------------------------------ post
const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT_FRAG = `uniform sampler2D tColor; uniform vec2 uPx; varying vec2 vUv;
void main(){ vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i / 2) - 0.5, mod(float(i), 2.0) - 0.5) * 2.0 * uPx; c += min(texture2D(tColor, vUv + o).rgb, vec3(24.0)); } c *= 0.25;
  float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 1.9, l), 1.0); }`;
const BLUR_FRAG = `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tColor, vUv).rgb * 0.227; c += (texture2D(tColor, vUv + uDir * 1.385).rgb + texture2D(tColor, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(tColor, vUv + uDir * 3.231).rgb + texture2D(tColor, vUv - uDir * 3.231).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }`;
const FINAL_FRAG = `
uniform sampler2D tColor, tDepth, tBloomA, tBloomB; uniform vec2 uPx; uniform float uNear, uFar, uTime, uHeat; uniform mat4 uInvVP; uniform vec3 uCam, uSun; varying vec2 vUv;
float lin(float z){ float zn = z * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - zn * (uFar - uNear)); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  float z = texture2D(tDepth, vUv).x; vec3 col = texture2D(tColor, vUv).rgb;
  if (z < 0.999995) {
    float d = lin(z);
    // contact shading: darken where nearby surfaces sit in front (corners, wall bases, under carts)
    // (opposite samples are paired so a flat floor seen at a shallow angle does not shade itself)
    float rad = clamp(90.0 / d, 2.0, 30.0), ao = 0.0;
    for (int i = 0; i < 4; i++) { float a = float(i) * 0.7854 + 0.4; float k = (mod(float(i), 2.0) < 0.5) ? 1.0 : 0.55; vec2 o = vec2(cos(a), sin(a)) * rad * k * uPx;
      float d1 = d - lin(texture2D(tDepth, vUv + o).x), d2 = d - lin(texture2D(tDepth, vUv - o).x);
      ao += smoothstep(0.03, 0.4, d1 + d2) * (1.0 - smoothstep(0.9, 2.2, max(abs(d1), abs(d2)))); }
    ao = ao / 4.0 * (1.0 - smoothstep(50.0, 140.0, d));
    col *= mix(vec3(1.0), vec3(0.34, 0.3, 0.5), min(1.0, ao * 1.25));
    // ink: thin dark line on depth breaks and creases
    float lap = abs(4.0 * z - texture2D(tDepth, vUv + vec2(uPx.x, 0.0)).x - texture2D(tDepth, vUv - vec2(uPx.x, 0.0)).x - texture2D(tDepth, vUv + vec2(0.0, uPx.y)).x - texture2D(tDepth, vUv - vec2(0.0, uPx.y)).x) * d / uNear;
    float e = smoothstep(0.012, 0.05, lap) * (1.0 - smoothstep(45.0, 150.0, d));
    col = mix(col, col * vec3(0.2, 0.15, 0.26), e * 0.55);
    // aerial perspective: distance haze that thickens near the ground and glows toward the sun
    vec4 wp = uInvVP * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); wp /= wp.w; vec3 ray = wp.xyz - uCam; float dist = length(ray); vec3 rd = ray / dist;
    float f = 1.0 - exp(-dist * 0.0021 * (0.35 + 0.65 * exp(-max(wp.y, 0.0) * 0.03))); f = min(f, 0.6);
    float sd = max(dot(rd, uSun), 0.0);
    vec3 fc = mix(vec3(0.62, 0.78, 1.05), vec3(1.1, 0.84, 0.6), 0.2 + 0.8 * pow(sd, 2.5)) * (1.0 + 0.5 * pow(sd, 8.0));
    col = mix(col, fc, f);
  }
  col += texture2D(tBloomA, vUv).rgb * 0.5 + texture2D(tBloomB, vUv).rgb * 0.55;
  col = aces(col * 1.12);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, 1.16);                                   // a little extra saturation
  col = mix(col * vec3(0.96, 0.98, 1.06), col * vec3(1.05, 1.0, 0.93), smoothstep(0.15, 0.75, lum)); // cool shadows, warm lights
  vec2 q = vUv - 0.5; float vg = smoothstep(0.85, 0.3, length(q * vec2(1.0, 0.8)));
  col *= mix(0.72, 1.0, vg); col = mix(col, vec3(1.0, 0.45, 0.2), (1.0 - vg) * uHeat);
  col += (fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;
export class Post {
  constructor(THREE, renderer) {
    this.THREE = THREE; this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const sm = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.bright = sm(BRIGHT_FRAG, { tColor: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.blur = sm(BLUR_FRAG, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.final = sm(FINAL_FRAG, { tColor: { value: null }, tDepth: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, uPx: { value: new THREE.Vector2() }, uNear: { value: 0.3 }, uFar: { value: 4000 }, uTime: { value: 0 }, uHeat: { value: 0 },
      uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(...SUN_DIR).normalize() } });
    this.rts = null;
  }
  setSize(w, h) {
    const T = this.THREE; if (this.rts) Object.values(this.rts).forEach((t) => t.dispose());
    const rt = (W, H, o = {}) => new T.WebGLRenderTarget(Math.max(2, W | 0), Math.max(2, H | 0), { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, ...o });
    const depth = new T.DepthTexture(w, h); depth.type = T.UnsignedIntType;
    this.rts = { scene: rt(w, h, { depthBuffer: true, depthTexture: depth, samples: 4 }), b1: rt(w / 2, h / 2), a2: rt(w / 4, h / 4), b2: rt(w / 4, h / 4), a3: rt(w / 8, h / 8), b3: rt(w / 8, h / 8) };
    this.w = w; this.h = h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera, time, heat = 0) {
    const R = this.rts, r = this.r, f = this.final.uniforms;
    r.setRenderTarget(R.scene); r.render(scene, camera);
    this.bright.uniforms.tColor.value = R.scene.texture; this.bright.uniforms.uPx.value.set(1 / this.w, 1 / this.h); this.pass(this.bright, R.b1);
    const blur = (src, tmp, dst) => { const u = this.blur.uniforms; u.tColor.value = src.texture; u.uDir.value.set(1 / tmp.width, 0); this.pass(this.blur, tmp); u.tColor.value = tmp.texture; u.uDir.value.set(0, 1 / dst.height); this.pass(this.blur, dst); };
    blur(R.b1, R.a2, R.b2); blur(R.b2, R.a3, R.b3);
    f.tColor.value = R.scene.texture; f.tDepth.value = R.scene.depthTexture; f.tBloomA.value = R.b2.texture; f.tBloomB.value = R.b3.texture; f.uPx.value.set(1 / this.w, 1 / this.h);
    f.uNear.value = camera.near; f.uFar.value = camera.far; f.uTime.value = time % 100; f.uHeat.value = heat;
    f.uInvVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(); f.uCam.value.copy(camera.position);
    this.pass(this.final, null);
  }
}

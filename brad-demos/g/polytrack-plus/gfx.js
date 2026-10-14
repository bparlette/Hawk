// gfx.js — cel look (3-band toon + screen-space halftone in the shadow band + inverted-hull ink), car model, scenery, particles.
import * as THREE from './three.module.min.js';
export const INK = '#14101f';
const TAU = Math.PI * 2;

export const GRAD = (() => {
  const v = [70, 70, 70, 150, 150, 255, 255, 255], d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
export const DOT = { value: 5.0 };
const HALFTONE = /* glsl */`
  { float lumD = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lumO = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
    float rr = lumO / max(lumD, 1e-4);
    vec2 hp = gl_FragCoord.xy / uDot; hp = vec2(hp.x + hp.y, hp.y - hp.x) * 0.7071;
    float dd = length(fract(hp) - 0.5);
    float shade = smoothstep(0.72, 0.42, rr);
    float rad = 0.38 * shade;
    float dm = 1.0 - smoothstep(rad - 0.05, rad + 0.05, dd);
    outgoingLight *= 1.0 - 0.32 * dm;
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.84, 0.82, 1.14), shade * 0.55);
    outgoingLight = mix(outgoingLight, uFlashC, uFlash);
  }
  #include <opaque_fragment>`;
export function toonMat(opts = {}) {
  const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD, vertexColors: true }, opts));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC; sh.uniforms.uDot = DOT;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC; uniform float uDot;')
      .replace('#include <opaque_fragment>', HALFTONE);
  };
  m.customProgramCacheKey = () => 'ptoon' + (opts.transparent ? 't' : '') + (opts.map ? 'm' : '');
  return m;
}
export const FOG = { c: new THREE.Color('#bfe9ff'), n: { value: 140 }, f: { value: 520 } };
export function outlineMat(w, col = INK, extra = {}) {
  return new THREE.ShaderMaterial(Object.assign({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color(col) }, uFogC: { value: FOG.c }, uFogN: FOG.n, uFogF: FOG.f, uA: { value: 1 } },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wd = normalize(mat3(modelMatrix) * odir) * length(odir);
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.0, 60.0);
        vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; uniform float uA; varying float vD;
      void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), uA);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  }, extra));
}
// per-vertex mitred outline direction (average of distinct face normals meeting at a position)
export function addOdir(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map(), keys = new Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 200) + ',' + Math.round(p.getY(i) * 200) + ',' + Math.round(p.getZ(i) * 200);
    keys[i] = k; let e = map.get(k); if (!e) map.set(k, (e = []));
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    if (!e.some((q) => q[0] * nx + q[1] * ny + q[2] * nz > 0.985)) e.push([nx, ny, nz]);
  }
  const res = new Map();
  for (const [k, e] of map) {
    let x = 0, y = 0, z = 0; for (const q of e) { x += q[0]; y += q[1]; z += q[2]; }
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    let mn = 1; for (const q of e) mn = Math.min(mn, q[0] * x + q[1] * y + q[2] * z);
    const s = 1 / Math.max(mn, 0.35); res.set(k, [x * s, y * s, z * s]);
  }
  const o = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const d = res.get(keys[i]); o[i * 3] = d[0]; o[i * 3 + 1] = d[1]; o[i * 3 + 2] = d[2]; }
  g.setAttribute('odir', new THREE.BufferAttribute(o, 3)); return g;
}
export function bakeColor(g, col) {
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// merge non-indexed geometries with colours (all must have position, normal, color)
export function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}
export function prep(g, col, m4) { // -> non-indexed, coloured, transformed
  let q = g.index ? g.toNonIndexed() : g; if (m4) q.applyMatrix4(m4); q.computeVertexNormals(); if (col) bakeColor(q, col); return q;
}
export function soupGeometry(soup) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(soup.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(soup.col, 3));
  g.computeVertexNormals(); return g;
}
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3();
export function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), SC.set(sx, sy, sz)); }

// ---------------- the hero car ----------------
// Low-poly wedge sports car: extruded side profile (tapered top), glass canopy, roof, splitter, wing, side pods, lights.
function profileBody(pts, width, taperTop, taperY) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y))); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // shape x -> world z (forward), extrude -> world x
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > taperY) { const k = 1 - taperTop * Math.min(1, (y - taperY) / 0.4); p.setX(i, p.getX(i) * k); } }
  return g;
}
export function buildCarGeo(colors = {}) {
  const C = Object.assign({ body: '#ff3b30', dark: '#1d1a2e', accent: '#ffd23c', glass: '#22305c', light: '#fff4b0', tail: '#ff2850', white: '#fff6ea' }, colors);
  const parts = [];
  // main shell: low wedge
  parts.push(prep(profileBody([[-2.0, 0.14], [-2.08, 0.46], [-1.92, 0.58], [-1.15, 0.62], [0.7, 0.56], [1.5, 0.42], [2.1, 0.25], [2.14, 0.11], [1.85, 0.0], [-1.75, 0.0]], 1.62, 0.14, 0.36), C.body));
  // canopy glass + roof slab
  parts.push(prep(profileBody([[-1.18, 0.58], [-0.62, 0.93], [0.22, 0.95], [0.98, 0.54]], 1.2, 0.2, 0.66), C.glass));
  parts.push(prep(new THREE.BoxGeometry(0.92, 0.06, 0.8), C.body, mat(0, 0.98, -0.2)));
  // racing stripes (hood + roof + deck)
  for (const sx of [-0.19, 0.19]) {
    parts.push(prep(new THREE.BoxGeometry(0.15, 0.03, 1.2), C.white, mat(sx, 0.6, 1.3, -0.2)));
    parts.push(prep(new THREE.BoxGeometry(0.15, 0.03, 0.82), C.white, mat(sx, 1.02, -0.2)));
    parts.push(prep(new THREE.BoxGeometry(0.15, 0.03, 0.8), C.white, mat(sx, 0.66, -1.5, 0.05)));
  }
  // fender flares over each wheel + side skirts
  for (const s of [-1, 1]) {
    for (const z of [1.32, -1.26]) parts.push(prep(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 8, 1, false, 0, Math.PI), C.body, mat(s * 0.83, 0.28, z, 0, 0, Math.PI / 2)));
    parts.push(prep(new THREE.BoxGeometry(0.14, 0.2, 1.7), C.dark, mat(s * 0.84, 0.12, 0.03)));
    parts.push(prep(new THREE.BoxGeometry(0.05, 0.11, 1.0), C.accent, mat(s * 0.84, 0.36, 0.03)));
    parts.push(prep(new THREE.BoxGeometry(0.2, 0.09, 0.15), C.body, mat(s * 0.72, 0.72, 0.6)));
  }
  // front splitter, rear diffuser, exhausts
  parts.push(prep(new THREE.BoxGeometry(1.8, 0.06, 0.42), C.dark, mat(0, 0.04, 2.0)));
  parts.push(prep(new THREE.BoxGeometry(1.5, 0.18, 0.26), C.dark, mat(0, 0.1, -2.02)));
  for (const s of [-1, 1]) parts.push(prep(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), '#9aa0b8', mat(s * 0.36, 0.16, -2.1, Math.PI / 2)));
  // wing
  parts.push(prep(new THREE.BoxGeometry(1.86, 0.07, 0.5), C.accent, mat(0, 0.92, -1.86, 0.1)));
  for (const s of [-1, 1]) { parts.push(prep(new THREE.BoxGeometry(0.07, 0.34, 0.2), C.dark, mat(s * 0.48, 0.72, -1.82))); parts.push(prep(new THREE.BoxGeometry(0.06, 0.24, 0.6), C.dark, mat(s * 0.94, 0.9, -1.86))); }
  // lights: headlights, full-width tail bar
  for (const s of [-1, 1]) parts.push(prep(new THREE.BoxGeometry(0.42, 0.1, 0.08), C.light, mat(s * 0.52, 0.3, 2.08, 0, s * -0.15)));
  parts.push(prep(new THREE.BoxGeometry(1.5, 0.1, 0.06), C.tail, mat(0, 0.44, -2.1)));
  // intake + number roundels
  parts.push(prep(new THREE.BoxGeometry(0.8, 0.1, 0.06), C.dark, mat(0, 0.18, 2.12)));
  for (const s of [-1, 1]) parts.push(prep(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), C.white, mat(s * 0.83, 0.34, -0.3, 0, 0, Math.PI / 2)));
  const body = merge(parts);
  // wheel: tyre + rim, axle along x
  const tyre = prep(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), C.dark, mat(0, 0, 0, 0, 0, Math.PI / 2));
  const rim = prep(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 6), '#d9dcea', mat(0, 0, 0, 0, 0, Math.PI / 2));
  const hub = prep(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 6), C.accent, mat(0, 0, 0, 0, 0, Math.PI / 2));
  const wheel = merge([tyre, rim, hub]);
  return { body: addOdir(body), wheel: addOdir(wheel) };
}
export class CarView {
  constructor(geo, opts = {}) {
    this.root = new THREE.Group(); this.shell = new THREE.Group(); this.root.add(this.shell);
    const mat = opts.mat || toonMat(); this.mat = mat;
    this.body = new THREE.Mesh(geo.body, mat); this.body.castShadow = !opts.ghost; this.shell.add(this.body);
    if (opts.outline) { this.ol = new THREE.Mesh(geo.body, opts.outline); this.shell.add(this.ol); }
    this.wheels = [];
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group(), w = new THREE.Mesh(geo.wheel, mat); w.castShadow = !opts.ghost; piv.add(w);
      if (opts.outline) piv.add(new THREE.Mesh(geo.wheel, opts.outline)), (piv.children[1].userData.spin = true);
      this.root.add(piv); this.wheels.push(piv);
    }
  }
}

// ---------------- sky ----------------
export function makeSky() {
  const g = new THREE.SphereGeometry(900, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(0.45, 0.55, -0.7).normalize() } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vP; uniform vec3 uSun;
      void main(){ float h = vP.y; vec3 top = vec3(0.27,0.55,0.98), mid = vec3(0.56,0.82,1.0), hor = vec3(0.86,0.95,1.0), low = vec3(0.55,0.86,0.9);
        vec3 c = h > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.25, 0.9, h)), smoothstep(0.0, 0.25, h)) : mix(hor, low, smoothstep(0.0, -0.2, h));
        float s = dot(vP, uSun); c = mix(c, vec3(1.0,0.97,0.82), smoothstep(0.985, 0.99, s)); c += vec3(1.0,0.85,0.55) * pow(max(s,0.0), 24.0) * 0.25;
        // comic sun ring
        c = mix(c, vec3(0.08,0.06,0.12), smoothstep(0.9838,0.9842,s) * (1.0 - smoothstep(0.9848,0.9852,s)));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const s = new THREE.Mesh(g, m); s.frustumCulled = false; s.renderOrder = -10; return s;
}

// ---------------- scenery (one toon mesh + one ink hull) ----------------
export function makeScenery(bounds, seaY, rnd) {
  const parts = [], olParts = [];
  const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2, R0 = Math.max(bounds.x1 - bounds.x0, bounds.z1 - bounds.z0) / 2 + 40;
  const add = (g, col, m4, ol = true) => { const q = prep(g, col, m4); parts.push(q); if (ol) olParts.push(q); };
  const pal = ['#7ad36b', '#5bbf6a', '#9fd36b', '#c08ce8', '#ff9fb8', '#ffcf6b'];
  // islands ring
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rnd() * 0.3, r = R0 + 90 + rnd() * 260, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = 18 + rnd() * 34;
    add(new THREE.CylinderGeometry(s, s * 1.15, 3, 7), '#ffe2a8', mat(x, seaY + 0.6, z, 0, rnd() * 3));
    const nm = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < nm; k++) { const h = s * (0.8 + rnd() * 1.3), rr = s * (0.45 + rnd() * 0.35); add(new THREE.ConeGeometry(rr, h, 6), pal[Math.floor(rnd() * pal.length)], mat(x + (rnd() - 0.5) * s * 0.8, seaY + 2 + h / 2, z + (rnd() - 0.5) * s * 0.8, 0, rnd() * 3)); }
    for (let k = 0; k < 4; k++) { const tx = x + (rnd() - 0.5) * s * 1.4, tz = z + (rnd() - 0.5) * s * 1.4; add(new THREE.ConeGeometry(2.2, 7, 5), '#3f9e5d', mat(tx, seaY + 6, tz)); add(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 5), '#9a5a3a', mat(tx, seaY + 2.6, tz), false); }
  }
  // far mountains
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + rnd() * 0.2, r = 640 + rnd() * 120, h = 60 + rnd() * 120;
    add(new THREE.ConeGeometry(50 + rnd() * 60, h, 5), i & 1 ? '#a58ee0' : '#8fb7f0', mat(cx + Math.cos(a) * r, seaY + h / 2 - 4, cz + Math.sin(a) * r, 0, rnd() * 3), false);
  }
  // rocks + buoys near the track
  for (let i = 0; i < 26; i++) {
    const x = bounds.x0 - 30 + rnd() * (bounds.x1 - bounds.x0 + 60), z = bounds.z0 - 30 + rnd() * (bounds.z1 - bounds.z0 + 60);
    if (rnd() < 0.5) add(new THREE.DodecahedronGeometry(2 + rnd() * 4, 0), '#b9a7c9', mat(x, seaY + 0.5, z, rnd() * 3, rnd() * 3, 0, 1, 0.6, 1));
    else { add(new THREE.CylinderGeometry(0.9, 1.2, 2.2, 8), i & 1 ? '#ff4d5e' : '#fff6ea', mat(x, seaY + 0.8, z)); add(new THREE.ConeGeometry(0.9, 1.4, 8), '#ffd23c', mat(x, seaY + 2.6, z)); }
  }
  const g = merge(parts), og = addOdir(merge(olParts));
  return { g, og };
}
export function makeClouds(bounds, rnd) {
  const parts = []; const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2;
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, r = 120 + rnd() * 520, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = 70 + rnd() * 70, s = 7 + rnd() * 9;
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) parts.push(prep(new THREE.IcosahedronGeometry(s * (0.7 + rnd() * 0.5), 0), '#ffffff', mat(x + (k - n / 2) * s * 0.9, y + rnd() * s * 0.4, z + (rnd() - 0.5) * s, rnd(), rnd(), 0, 1, 0.7, 1)));
  }
  return addOdir(merge(parts));
}

// ---------------- pooled particles (one Points draw per pool) ----------------
export class Particles {
  constructor(max, opts = {}) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3); this.life = new Float32Array(max); this.t = new Float32Array(max); this.size = new Float32Array(max); this.a = new Float32Array(max);
    this.drag = opts.drag ?? 1.5; this.grav = opts.grav ?? -14; this.grow = opts.grow ?? 0;
    const g = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage); this.ca = new THREE.BufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    this.sa = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage); this.aa = new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa); g.setAttribute('color', this.ca); g.setAttribute('size', this.sa); g.setAttribute('alpha', this.aa); g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uInk: { value: opts.ink ? 1 : 0 } }, transparent: true, depthWrite: false, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 color; attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; uniform float uInk;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
          vec3 c = vC; if (uInk > 0.5 && d > 0.38) c = vec3(0.08,0.06,0.12);
          gl_FragColor = vec4(c, vA * (uInk > 0.5 ? 1.0 : 0.55 * smoothstep(0.5, 0.2, d)));
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Points(g, m); this.mesh.frustumCulled = false; this.geo = g; this.mat = m;
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b) {
    if (this.n >= this.max) return; const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.t[i] = 0; this.size[i] = size; this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b; this.a[i] = 1;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  update(dt) {
    const k = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.n; i++) {
      this.t[i] += dt;
      if (this.t[i] >= this.life[i]) { // swap-remove
        const j = --this.n; if (i !== j) { for (let q = 0; q < 3; q++) { this.p[i * 3 + q] = this.p[j * 3 + q]; this.v[i * 3 + q] = this.v[j * 3 + q]; this.c[i * 3 + q] = this.c[j * 3 + q]; }
          this.life[i] = this.life[j]; this.t[i] = this.t[j]; this.size[i] = this.size[j]; this.a[i] = this.a[j]; }
        i--; continue;
      }
      this.v[i * 3] *= k; this.v[i * 3 + 1] = this.v[i * 3 + 1] * k + this.grav * dt; this.v[i * 3 + 2] *= k;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const u = this.t[i] / this.life[i]; this.a[i] = 1 - u * u; this.size[i] += this.grow * dt;
    }
    this.geo.setDrawRange(0, this.n); this.pa.needsUpdate = this.ca.needsUpdate = this.sa.needsUpdate = this.aa.needsUpdate = true;
  }
}

// canvas label texture (gate banners)
export function labelTex(text, bg, fg, w = 512, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(20,16,31,.16)'; for (let yy = 8; yy < h; yy += 14) for (let xx = (yy / 14 & 1) * 7; xx < w; xx += 14) { x.beginPath(); x.arc(xx, yy, 2.6, 0, TAU); x.fill(); }
  x.font = `${Math.round(h * 0.62)}px Impact, "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = INK; x.strokeText(text, w / 2, h / 2 + 3); x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 3);
  x.lineWidth = 8; x.strokeStyle = INK; x.strokeRect(4, 4, w - 8, h - 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

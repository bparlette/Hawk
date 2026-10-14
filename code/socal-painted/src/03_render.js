/* ---------------- 2.5D cel renderer (three.js r160) ----------------
   Toon materials (3 bands + screen-space halftone in the shadow band), inverted-hull ink outlines,
   merged static scenery per event, procedural rigs. Sim runs in 2D units (x right, y down);
   world meters: X = x*U, Y = -y*U, Z = depth. */
const U = 0.03;
const INK = '#14101f';
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const FOGC = new THREE.Color('#ffc2d4');
scene.fog = new THREE.Fog(FOGC, 60, 220);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight('#e6e0ff', '#ffd9c9', 1.75); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 1.9);
const SUN_DIR = new THREE.Vector3(-0.45, 1.6, 0.9).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(V.touch ? 1024 : 2048, V.touch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 120 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const GRAD = (() => { const v = [0, 0, 0, 0, 120, 120, 255, 255], d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = x; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const DOTSIZE = { value: 5 };
const HALFTONE = `
  { float lumD = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lumO = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
    float rr = lumO / max(lumD, 1e-4);
    vec2 hp = gl_FragCoord.xy / uDot; hp = vec2(hp.x + hp.y, hp.y - hp.x) * 0.7071;
    float dd = length(fract(hp) - 0.5);
    float shade = smoothstep(0.66, 0.5, rr);
    float rad = 0.36 * shade;
    float dm = 1.0 - smoothstep(rad - 0.05, rad + 0.05, dd);
    outgoingLight *= 1.0 - 0.28 * dm;
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.86, 0.82, 1.12), shade * 0.6);
    outgoingLight = mix(outgoingLight, uFlashC, uFlash);
  }
  #include <opaque_fragment>`;
function toonMat(opts) {
  const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD, vertexColors: true }, opts || {}));
  m.userData.flash = { value: 0 }; m.userData.flashC = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = sh => {
    sh.uniforms.uFlash = m.userData.flash; sh.uniforms.uFlashC = m.userData.flashC; sh.uniforms.uDot = DOTSIZE;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFlash; uniform vec3 uFlashC; uniform float uDot;').replace('#include <opaque_fragment>', HALFTONE);
  };
  m.customProgramCacheKey = () => 'toon' + (opts && opts.map ? 'M' : '');
  return m;
}
function outlineMat(w) {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: w }, uC: { value: new THREE.Color(INK) }, uFogC: { value: FOGC }, uFogN: { value: 60 }, uFogF: { value: 220 } },
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vec3 wd = mat3(modelMatrix) * odir;
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 40.0); vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
      void main(){ gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide });
}
const OUT_CHAR = outlineMat(0.0036), OUT_PROP = outlineMat(0.003);
const OUTS = [OUT_CHAR, OUT_PROP];
function addOdir(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map(), keys = [];
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3);
    keys.push(k); let e = map.get(k); if (!e) map.set(k, (e = []));
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    if (!e.some(q => q[0] * nx + q[1] * ny + q[2] * nz > 0.985)) e.push([nx, ny, nz]);
  }
  const res = new Map();
  for (const [k, e] of map) { let x = 0, y = 0, z = 0; for (const q of e) { x += q[0]; y += q[1]; z += q[2]; }
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; let mn = 1; for (const q of e) mn = Math.min(mn, q[0] * x + q[1] * y + q[2] * z);
    const s = 1 / Math.max(mn, 0.35); res.set(k, [x * s, y * s, z * s]); }
  const o = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const d = res.get(keys[i]); o[i * 3] = d[0]; o[i * 3 + 1] = d[1]; o[i * 3 + 2] = d[2]; }
  g.setAttribute('odir', new THREE.BufferAttribute(o, 3)); return g;
}
function bakeColor(g, col) { const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const GG = {
  sph: (rx, ry, rz, ws, hs) => new THREE.SphereGeometry(1, ws || 14, hs || 10).scale(rx, ry, rz),
  cap: (r, len, rs) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, rs || 10),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s, open) => new THREE.CylinderGeometry(rt, rb, h, s || 12, 1, !!open),
  cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 8),
  tor: (r, t, rs, ts) => new THREE.TorusGeometry(r, t, rs || 8, ts || 24),
};
function part(parent, geom, col, x, y, z, o) {
  o = o || {}; bakeColor(geom, col); if (o.outline !== false) addOdir(geom);
  const m = new THREE.Mesh(geom, o.mat || parent.userData.mat || (parent.parent && parent.parent.userData.mat));
  m.position.set(x || 0, y || 0, z || 0); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  m.castShadow = o.shadow !== false; parent.add(m);
  if (o.outline !== false) { const ol = new THREE.Mesh(geom, o.olMat || OUT_CHAR); m.add(ol); }
  return m;
}
function grp(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); if (parent) g.userData.mat = parent.userData.mat; return g; }
// merged static scenery: one toon mesh + one outline hull per builder
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry, rx, rz, sx, sy, sz) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)), _s.set(sx || 1, sy || sx || 1, sz || sx || 1))); }
class MB {
  constructor() { this.P = []; this.N = []; this.C = []; this.OP = []; this.OD = []; }
  add(g, col, outline) {
    g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = g.attributes.normal, c = new THREE.Color(col);
    for (let i = 0; i < p.count; i++) { this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.N.push(n.getX(i), n.getY(i), n.getZ(i)); this.C.push(c.r, c.g, c.b); }
    if (outline !== false) { addOdir(g); const d = g.attributes.odir; for (let i = 0; i < p.count; i++) { this.OP.push(p.getX(i), p.getY(i), p.getZ(i)); this.OD.push(d.getX(i), d.getY(i), d.getZ(i)); } }
    return this;
  }
  build(parent, opts) {
    opts = opts || {}; const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere(); const m = new THREE.Mesh(g, opts.mat || SCENE_MAT); m.receiveShadow = true; m.castShadow = !!opts.cast; m.frustumCulled = false; parent.add(m);
    if (this.OP.length) { const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(this.OP, 3)); og.setAttribute('odir', new THREE.Float32BufferAttribute(this.OD, 3));
      const om = new THREE.Mesh(og, opts.ol || OUT_PROP); om.frustumCulled = false; parent.add(om); }
    return m;
  }
}
const SCENE_MAT = toonMat();
// painted canvas textures for signs / banners (no real logos; parody sponsors only)
function texCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function signTex(txt, bg, fg, edge, sub) {
  return texCanvas(512, 160, (g, w, h) => {
    g.fillStyle = INK; g.fillRect(0, 0, w, h); g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
    g.strokeStyle = edge || fg; g.lineWidth = 6; g.strokeRect(20, 20, w - 40, h - 40);
    g.font = 'italic 900 ' + (sub ? 62 : 74) + 'px Impact,"Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = INK; g.strokeText(txt, w / 2, sub ? 66 : h / 2 + 4, w - 60); g.fillStyle = fg; g.fillText(txt, w / 2, sub ? 66 : h / 2 + 4, w - 60);
    if (sub) { g.font = '800 30px system-ui,sans-serif'; g.fillStyle = edge || fg; g.fillText(sub, w / 2, 122, w - 60); }
  });
}
function signMesh(parent, txt, bg, fg, edge, x, y, z, w, ry, sub) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), toonMat({ map: signTex(txt, bg, fg, edge, sub), vertexColors: false }));
  m.position.set(x, y, z); m.rotation.y = ry || 0; parent.add(m); return m;
}
// sky dome + cartoon sun + outlined clouds
const SKY_U = { top: { value: new THREE.Color('#2f8cff') }, mid: { value: new THREE.Color('#8fd8ff') }, hor: { value: new THREE.Color('#ffc2d4') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SKY_U,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
    void main(){ float y = vP.y; vec3 c = y > 0.16 ? mix(mid, top, smoothstep(0.16, 0.7, y)) : mix(hor, mid, smoothstep(-0.03, 0.16, y)); gl_FragColor = vec4(c,1.0);
    #include <colorspace_fragment>
    }` }));
sky.renderOrder = -10; scene.add(sky);
const cloudTex = texCanvas(512, 256, (c) => { const bl = [[120, 170, 70], [210, 130, 90], [320, 140, 80], [400, 175, 60], [260, 185, 70]];
  c.fillStyle = INK; bl.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.fill(); }); c.fillRect(60, 175, 400, 70);
  c.fillStyle = '#fff'; bl.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(66, 175, 388, 61); c.fillStyle = '#ffd9e6'; c.fillRect(66, 205, 388, 31); });
const sunTex = texCanvas(256, 256, (g) => {
  g.fillStyle = INK; g.beginPath(); for (let k = 0; k < 24; k++) { const r = k % 2 ? 100 : 124, a = k / 24 * TAU; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill();
  g.fillStyle = '#ffb347'; g.beginPath(); for (let k = 0; k < 24; k++) { const r = k % 2 ? 90 : 112, a = k / 24 * TAU; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill();
  const gr = g.createLinearGradient(0, 58, 0, 198); gr.addColorStop(0, '#fff275'); gr.addColorStop(0.6, '#ff8a3d'); gr.addColorStop(1, '#ff3f8e');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 70, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,63,142,0.85)'; for (let i = 0; i < 4; i++) g.fillRect(58, 140 + i * 14, 140, 3 + i * 2); });
const skyDeco = new THREE.Group(); sky.add(skyDeco);
for (let i = 0; i < 11; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false })); const a = -Math.PI * 0.95 + i / 11 * Math.PI * 0.9, r = 380;
  sp.position.set(Math.cos(a) * r, 60 + (i % 3) * 30, Math.sin(a) * r); sp.scale.set(44 + (i % 2) * 18, 22 + (i % 2) * 9, 1); sp.renderOrder = -9; skyDeco.add(sp); }
const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false })); sunSpr.scale.set(46, 46, 1); sunSpr.renderOrder = -9; skyDeco.add(sunSpr);
function setSky(top, mid, hor, fogNear, fogFar, sunPos) {
  SKY_U.top.value.set(top); SKY_U.mid.value.set(mid); SKY_U.hor.value.set(hor); FOGC.set(hor); scene.fog.near = fogNear; scene.fog.far = fogFar;
  for (const o of OUTS) { o.uniforms.uFogN.value = fogNear; o.uniforms.uFogF.value = fogFar; }
  sunSpr.position.set(sunPos[0], sunPos[1], sunPos[2]);
}
// particles: one pooled Points buffer (500), round cel dots with ink rim
const PG = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
PG.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); PG.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); PG.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const PU = { scale: { value: 400 } };
const pts = new THREE.Points(PG, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false,
  vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; vec3 c = r > 0.36 ? vec3(0.08,0.06,0.12) : vC; gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}' }));
pts.frustumCulled = false; scene.add(pts);
const _pc = new THREE.Color();
function syncParts() {
  for (let i = 0; i < PMAX; i++) { const p = parts[i];
    if (!p.on) { pSize[i] = 0; continue; }
    if (p.c !== p.col) { p.c = p.col; _pc.set(p.col); p.cr = _pc.r; p.cg = _pc.g; p.cb = _pc.b; }
    pPos[i * 3] = p.x * U; pPos[i * 3 + 1] = -p.y * U; pPos[i * 3 + 2] = p.z * U;
    pCol[i * 3] = p.cr; pCol[i * 3 + 1] = p.cg; pCol[i * 3 + 2] = p.cb;
    pSize[i] = p.r * U * 2.6 * clamp(p.life / p.max * 1.6, 0, 1); }
  PG.attributes.position.needsUpdate = true; PG.attributes.color.needsUpdate = true; PG.attributes.size.needsUpdate = true;
}
// per-event environments (built lazily, toggled)
const ENV = {};
function showEnv(key, builder) {
  for (const k in ENV) ENV[k].visible = false;
  if (!ENV[key]) { const g = new THREE.Group(); g.userData.mat = SCENE_MAT; scene.add(g); ENV[key] = g; builder(g); }
  ENV[key].visible = true; return ENV[key];
}

/* ---------------- character rig ---------------- */
const DUDE_D = { hip: 0.86, torsoY: 0.04, neckY: 0.56, legX: 0.12, thigh: 0.41, shin: 0.4, shX: 0.27, shY: 0.47, upper: 0.28, fore: 0.26 };
function skeleton(d, mat) {
  const J = {}; J.root = new THREE.Group(); J.root.userData.mat = mat; J.mat = mat;
  J.tilt = grp(J.root); J.hips = grp(J.tilt, 0, d.hip, 0); J.torso = grp(J.hips, 0, d.torsoY, 0); J.neck = grp(J.torso, 0, d.neckY, 0);
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    J['lg' + k] = grp(J.hips, s * d.legX, 0, 0); J['kn' + k] = grp(J['lg' + k], 0, -d.thigh, 0); J['ft' + k] = grp(J['kn' + k], 0, -d.shin, 0);
    J['sh' + k] = grp(J.torso, s * d.shX, d.shY, 0); J['el' + k] = grp(J['sh' + k], 0, -d.upper, 0); J['ha' + k] = grp(J['el' + k], 0, -d.fore, 0);
  }
  J.d = d; return J;
}
const rigCache = {};
function buildDude(look, skates) {
  const key = look.key + (skates ? 'S' : '');
  if (rigCache[key]) return rigCache[key];
  const mat = toonMat(); const d = DUDE_D, J = skeleton(d, mat);
  const SK = look.skin, SH = look.shirt, TR = look.trim, SO = look.shorts, HA = look.hair, BA = look.band;
  part(J.hips, GG.sph(0.2, 0.15, 0.16), SO, 0, 0.02, 0);
  part(J.hips, GG.cyl(0.205, 0.205, 0.05, 14), TR, 0, 0.1, 0, { outline: false });
  part(J.torso, GG.sph(0.235, 0.31, 0.18), SH, 0, 0.28, 0);
  part(J.torso, GG.box(0.44, 0.06, 0.02), TR, 0, 0.3, 0.172, { outline: false, rot: [0.1, 0, 0.42] });
  part(J.torso, GG.box(0.44, 0.035, 0.02), BA, 0, 0.2, 0.17, { outline: false, rot: [0.05, 0, 0.42] });
  part(J.torso, GG.sph(0.2, 0.24, 0.14), SH, 0, 0.3, -0.06, { outline: false });
  part(J.torso, GG.cyl(0.07, 0.08, 0.12, 10), SK, 0, 0.56, 0, { outline: false });
  const head = J.head = grp(J.neck, 0, 0, 0);
  part(head, GG.sph(0.2, 0.21, 0.2), SK, 0, 0.2, 0.01);
  part(head, GG.sph(0.05, 0.045, 0.06), SK, 0, 0.17, 0.2, { outline: false });
  for (const s of [-1, 1]) part(head, GG.sph(0.045, 0.06, 0.035), SK, s * 0.2, 0.19, 0, { outline: false });
  part(head, GG.box(0.1, 0.022, 0.02), '#7a2a2a', 0.0, 0.08, 0.185, { outline: false, rot: [0, 0, -0.12] });
  // spiky sun-bleached hair
  part(head, GG.sph(0.205, 0.13, 0.205, 14, 8), HA, 0, 0.31, -0.01);
  for (let i = 0; i < 7; i++) { const a = -1.4 + i * 0.47; part(head, GG.cone(0.06, 0.2, 5), HA, Math.sin(a) * 0.13, 0.43 - Math.abs(Math.sin(a)) * 0.05, -0.04 - Math.cos(a) * 0.08, { rot: [-0.5 - Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.8] }); }
  part(head, GG.cyl(0.212, 0.212, 0.06, 20), BA, 0, 0.27, 0.0);
  J.tails = [];
  for (const s of [-1, 1]) { const t = grp(head, s * 0.04, 0.27, -0.2); part(t, GG.box(0.06, 0.3, 0.02), BA, 0, -0.13, 0); t.rotation.set(0.6, 0, s * 0.25); J.tails.push(t); }
  // wayfarer shades
  part(head, GG.box(0.33, 0.075, 0.05), INK, 0, 0.21, 0.17, { outline: false });
  for (const s of [-1, 1]) part(head, GG.box(0.11, 0.045, 0.02), '#ff5e57', s * 0.08, 0.212, 0.198, { outline: false });
  part(head, GG.box(0.04, 0.012, 0.02), '#ffe6a0', 0.1, 0.225, 0.21, { outline: false });
  for (const k of ['L', 'R']) {
    part(J['sh' + k], GG.sph(0.085, 0.085, 0.085), SK, 0, 0, 0);
    part(J['sh' + k], GG.cap(0.068, d.upper - 0.08), SK, 0, -d.upper / 2, 0);
    part(J['el' + k], GG.cap(0.062, d.fore - 0.08), SK, 0, -d.fore / 2, 0);
    part(J['el' + k], GG.cyl(0.072, 0.072, 0.07, 10), BA, 0, -d.fore + 0.07, 0, { outline: false });
    part(J['ha' + k], GG.sph(0.075, 0.07, 0.07), SK, 0, -0.03, 0);
    part(J['lg' + k], GG.cap(0.098, d.thigh - 0.14), SO, 0, -d.thigh / 2 + 0.02, 0);
    part(J['kn' + k], GG.cap(0.072, d.shin - 0.1), SK, 0, -d.shin / 2, 0);
    part(J['kn' + k], GG.cyl(0.078, 0.074, 0.14, 10), '#ffffff', 0, -d.shin + 0.1, 0, { outline: false });
    part(J['kn' + k], GG.cyl(0.08, 0.08, 0.025, 10), look.trim, 0, -d.shin + 0.13, 0, { outline: false });
    if (skates) {
      part(J['ft' + k], GG.box(0.15, 0.14, 0.27), SH, 0, -0.03, 0.04);
      part(J['ft' + k], GG.box(0.13, 0.04, 0.3), INK, 0, -0.11, 0.04, { outline: false });
      for (const wz of [-0.08, 0.15]) for (const wx of [-0.06, 0.06]) part(J['ft' + k], GG.cyl(0.05, 0.05, 0.04, 10), '#ffd23c', wx, -0.15, wz, { rot: [0, 0, Math.PI / 2] });
    } else {
      part(J['ft' + k], GG.sph(0.095, 0.07, 0.16), '#ffffff', 0, -0.03, 0.05);
      part(J['ft' + k], GG.box(0.17, 0.03, 0.3), INK, 0, -0.085, 0.05, { outline: false });
      part(J['ft' + k], GG.box(0.12, 0.025, 0.12), look.trim, 0, 0.0, 0.08, { outline: false, rot: [0.3, 0, 0] });
    }
  }
  J.look = look; J.flash = mat.userData.flash;
  rigCache[key] = J; return J;
}
// pose library. Local forward is +Z; rotation.x > 0 swings a limb backward; knees bend with +x, elbows with -x.
function pz(J, k, x, y, z) { const o = J[k].rotation; o.x = x; o.y = y || 0; o.z = z || 0; }
function poseDude(J, name, t, k) {
  k = k || 0; const d = J.d;
  J.hips.position.set(0, d.hip, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(0, 0, 0); J.neck.rotation.set(0, 0, 0);
  pz(J, 'lgL', 0, 0, 0.04); pz(J, 'lgR', 0, 0, -0.04); pz(J, 'knL', 0.06); pz(J, 'knR', 0.06); pz(J, 'ftL', -0.06); pz(J, 'ftR', -0.06);
  pz(J, 'shL', 0.05, 0, 0.14); pz(J, 'shR', 0.05, 0, -0.14); pz(J, 'elL', -0.25); pz(J, 'elR', -0.25);
  let drop = 0;
  const b = Math.sin(t * 2.6);
  switch (name) {
    case 'stand': J.torso.rotation.x = 0.02 + b * 0.02; J.neck.rotation.x = -0.05; break;
    case 'board': { // side-on stance on a board, chest to camera; k = crouch 0..1
      const c = 0.25 + 0.75 * k; drop = 0.05 + 0.2 * c;
      pz(J, 'lgL', -0.45 * c, 0, 0.36); pz(J, 'lgR', -0.45 * c, 0, -0.36); pz(J, 'knL', 0.95 * c); pz(J, 'knR', 0.95 * c); pz(J, 'ftL', -0.5 * c, 0, -0.3); pz(J, 'ftR', -0.5 * c, 0, 0.3);
      J.torso.rotation.x = 0.28 * c; J.torso.rotation.z = Math.sin(t * 3) * 0.04;
      pz(J, 'shL', -0.2, 0, 1.05 + b * 0.08); pz(J, 'shR', -0.2, 0, -1.0 - b * 0.08); pz(J, 'elL', -0.35); pz(J, 'elR', -0.35); break; }
    case 'grab': { drop = 0.3; pz(J, 'lgL', -1.3, 0, 0.3); pz(J, 'lgR', -1.3, 0, -0.3); pz(J, 'knL', 2.0); pz(J, 'knR', 2.0); J.torso.rotation.x = 0.5;
      pz(J, 'shL', -0.9, 0, 0.35); pz(J, 'elL', -0.3); pz(J, 'shR', -0.2, 0, -1.7); pz(J, 'elR', -0.2); break; }
    case 'plant': { pz(J, 'shL', -Math.PI + 0.1, 0, 0.12); pz(J, 'shR', -Math.PI + 0.1, 0, -0.12); pz(J, 'elL', 0); pz(J, 'elR', 0); pz(J, 'lgL', -0.3, 0, 0.25); pz(J, 'lgR', -0.3, 0, -0.25); pz(J, 'knL', 0.6); pz(J, 'knR', 0.6); break; }
    case 'run': { const s = Math.sin(t * k); J.torso.rotation.x = 0.22; pz(J, 'lgL', -s * 0.85); pz(J, 'lgR', s * 0.85);
      pz(J, 'knL', 0.3 + Math.max(0, s) * 1.3); pz(J, 'knR', 0.3 + Math.max(0, -s) * 1.3); pz(J, 'shL', s * 0.9, 0, 0.1); pz(J, 'shR', -s * 0.9, 0, -0.1); pz(J, 'elL', -1.2); pz(J, 'elR', -1.2); drop = Math.abs(Math.cos(t * k)) * 0.04; break; }
    case 'stride': { // roller skating push-off; k = stride phase speed, t = clock
      const s = Math.sin(t * 6); drop = 0.12; J.torso.rotation.x = 0.45;
      pz(J, 'lgL', -0.5 + Math.max(0, s) * 0.9, 0, 0.1 + Math.max(0, s) * 0.35); pz(J, 'lgR', -0.5 + Math.max(0, -s) * 0.9, 0, -0.1 - Math.max(0, -s) * 0.35);
      pz(J, 'knL', 0.8); pz(J, 'knR', 0.8); pz(J, 'shL', s * 0.8, 0, 0.2); pz(J, 'shR', -s * 0.8, 0, -0.2); pz(J, 'elL', -0.5); pz(J, 'elR', -0.5); break; }
    case 'squat': { drop = 0.4; J.torso.rotation.x = 0.55; pz(J, 'lgL', -1.5, 0, 0.12); pz(J, 'lgR', -1.5, 0, -0.12); pz(J, 'knL', 2.25); pz(J, 'knR', 2.25); pz(J, 'ftL', -0.7); pz(J, 'ftR', -0.7);
      pz(J, 'shL', -1.3, 0, 0.1); pz(J, 'shR', -1.3, 0, -0.1); pz(J, 'elL', -0.2); pz(J, 'elR', -0.2); break; }
    case 'tuck': { drop = 0.25; J.torso.rotation.x = 0.35; pz(J, 'lgL', -1.4); pz(J, 'lgR', -1.2); pz(J, 'knL', 2.1); pz(J, 'knR', 1.9); pz(J, 'shL', -0.6, 0, 0.9); pz(J, 'shR', -0.6, 0, -0.9); break; }
    case 'pedal': { const s = Math.sin(t), c = Math.cos(t); J.hips.rotation.x = 0; drop = 0.16; J.torso.rotation.x = 0.75; J.neck.rotation.x = -0.55;
      pz(J, 'lgL', -0.95 + s * 0.45); pz(J, 'lgR', -0.95 - s * 0.45); pz(J, 'knL', 1.25 + c * 0.45); pz(J, 'knR', 1.25 - c * 0.45);
      pz(J, 'shL', -1.15, 0, 0.12); pz(J, 'shR', -1.15, 0, -0.12); pz(J, 'elL', -0.25); pz(J, 'elR', -0.25); break; }
    case 'kick': { // k: 0..1 progress, J.kickType set on rig
      const e = Math.sin(clamp(k, 0, 1) * Math.PI), ty = J.kickType || 0; J.torso.rotation.x = -0.05; pz(J, 'shL', -0.3, 0, 0.6); pz(J, 'shR', 0.2, 0, -0.6);
      if (ty === 0) { pz(J, 'lgR', -0.9 * e, 0, -0.45 * e); pz(J, 'knR', 1.5 * e); pz(J, 'ftR', 0.3, 0, 0.6 * e); }          // inside
      else if (ty === 1) { pz(J, 'lgR', -0.3 * e, 0, -0.95 * e); pz(J, 'knR', 1.3 * e); }                                      // outside
      else if (ty === 2) { pz(J, 'lgR', 0.8 * e); pz(J, 'knR', 1.9 * e); J.torso.rotation.x = 0.25 * e; J.neck.rotation.x = -0.5 * e; } // back
      else if (ty === 3) { pz(J, 'lgR', -1.6 * e); pz(J, 'knR', 2.0 * e); }                                                      // knee
      else if (ty === 4) { J.neck.rotation.x = -0.55 * e; J.torso.rotation.x = -0.25 * e; pz(J, 'shL', 0.2, 0, 0.9); pz(J, 'shR', 0.2, 0, -0.9); } // head
      else { pz(J, 'lgR', -1.2 * e, 0, -0.5 * e); pz(J, 'knR', 0.6); pz(J, 'lgL', -0.6, 0, 0.2); pz(J, 'knL', 1.6); pz(J, 'shL', -2.2, 0, 0.6); pz(J, 'shR', -2.0, 0, -0.6); } // jumping
      break; }
    case 'dive': { J.torso.rotation.x = 1.35; J.neck.rotation.x = -1.1; pz(J, 'shL', -2.85, 0, 0.15); pz(J, 'shR', -2.85, 0, -0.15); pz(J, 'elL', 0); pz(J, 'elR', 0);
      pz(J, 'lgL', 0.35); pz(J, 'lgR', 0.2); pz(J, 'knL', 0.3); pz(J, 'knR', 0.5); break; }
    case 'reach': { pz(J, 'shL', -3.0, 0, 0.2); pz(J, 'shR', -3.0, 0, -0.2); pz(J, 'elL', -0.1); pz(J, 'elR', -0.1); J.neck.rotation.x = -0.4; break; }
    case 'throw': { const w = k; J.torso.rotation.y = 0.6 - w * 1.4; J.torso.rotation.x = 0.1; pz(J, 'shR', -1.4, 0, -1.3 + w * 0.2); pz(J, 'elR', -0.2 - (1 - w) * 0.9); J.torso.rotation.z = 0;
      pz(J, 'shL', -0.5, 0, 0.9); pz(J, 'lgL', -0.4, 0, 0.2); pz(J, 'lgR', 0.35, 0, -0.15); pz(J, 'knL', 0.4); break; }
    case 'tumble': { J.torso.rotation.x = 0.4 + Math.sin(t * 9) * 0.5; pz(J, 'shL', Math.sin(t * 13) * 2, 0, 0.8); pz(J, 'shR', Math.cos(t * 11) * 2, 0, -0.8);
      pz(J, 'lgL', Math.sin(t * 10) * 1.1, 0, 0.3); pz(J, 'lgR', -Math.sin(t * 12) * 1.1, 0, -0.3); pz(J, 'knL', 0.9); pz(J, 'knR', 0.7); break; }
    case 'cheer': { const s = Math.sin(t * 8); pz(J, 'shL', -2.8 + s * 0.2, 0, 0.35); pz(J, 'shR', -2.8 - s * 0.2, 0, -0.35); pz(J, 'elL', -0.3); pz(J, 'elR', -0.3); drop = -Math.abs(Math.sin(t * 4)) * 0.08; break; }
    case 'wave': { J.torso.rotation.x = 0.02; pz(J, 'shR', -2.6, 0, -0.5 + Math.sin(t * 7) * 0.3); pz(J, 'elR', -0.4); break; }
    case 'sit': { drop = 0.42; pz(J, 'lgL', -1.5); pz(J, 'lgR', -1.5); pz(J, 'knL', 1.5); pz(J, 'knR', 1.5); break; }
  }
  J.hips.position.y = d.hip - drop;
  if (J.tails) { J.tails[0].rotation.x = 0.6 + Math.sin(t * 11) * 0.25; J.tails[1].rotation.x = 0.6 + Math.cos(t * 10) * 0.25; }
}
function lookFor(spIdx, hairIdx, skinIdx) {
  const sp = SPONSORS[spIdx % SPONSORS.length], hairs = ['#ffe14d', '#6b3a1e', '#2a1a14', '#ff8a2a', '#fff2c4'], skins = ['#f0b989', '#c98a5a', '#8d5a3b', '#e8a878'];
  const h = hairs[(hairIdx || 0) % hairs.length], s = skins[(skinIdx === undefined ? hairIdx || 0 : skinIdx) % skins.length];
  return { key: spIdx + '_' + h + '_' + s, shirt: sp.a, trim: sp.b, shorts: sp.c, band: sp.d, hair: h, skin: s, sp: spIdx };
}
const SPONSORS = [
  { n: 'RADICAL WAX CO.', a: '#ff5fa2', b: '#ffd23c', c: '#1f7bff', d: '#2fd3ff' }, { n: 'PIER PRESSURE SHADES', a: '#2fd3ff', b: '#14101f', c: '#7b4dff', d: '#ff5fa2' },
  { n: 'MALIBU NEON SODA', a: '#ff9f1c', b: '#fff6dc', c: '#23a6c2', d: '#ff3d6e' }, { n: 'PACIFIC SYNTH TAPES', a: '#7b4dff', b: '#ffd23c', c: '#2c2c3c', d: '#9dff6b' },
  { n: 'TUBULAR TACOS', a: '#ffd23c', b: '#ff3d6e', c: '#23c26b', d: '#ff3d6e' }, { n: 'SUNSET ROLLER CO.', a: '#ff5e57', b: '#9fe8ff', c: '#2f5bd3', d: '#ffd23c' },
  { n: 'GNARLY GEAR BIKES', a: '#23c26b', b: '#fff6dc', c: '#3a2f5a', d: '#ffd23c' }, { n: 'AERO-DISK 87', a: '#f2f2f2', b: '#ff5fa2', c: '#c42b48', d: '#2fd3ff' }
];
// small prop helpers (into a merge builder, meters)
function mbPalm(mb, x, y, z, s, lean, dark) {
  const tr = dark ? '#3a2448' : '#8a5a32', lf = dark ? '#2a1a3a' : '#2fa36b', lf2 = dark ? '#2a1a3a' : '#1f7a55';
  let px = x, py = y; const segs = 7;
  for (let i = 0; i < segs; i++) { const t = (i + 0.5) / segs, nx = x + lean * s * 1.6 * t * t, ny = y + 6.5 * s * t;
    mb.add(place(GG.cyl(0.16 * s * (1 - t * 0.35), 0.2 * s * (1 - t * 0.3), 6.5 * s / segs + 0.05, 7), (px + nx) / 2, (py + ny) / 2, z, 0, 0, -Math.atan2(nx - px, ny - py)), i & 1 ? tr : (dark ? tr : '#a06a3a')); px = nx; py = ny; }
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; mb.add(place(GG.box(2.4 * s, 0.06 * s, 0.5 * s), px + Math.cos(a) * 1.05 * s, py - 0.35 * s, z + Math.sin(a) * 1.05 * s, -a, 0, -0.45), i & 1 ? lf : lf2); }
  mb.add(place(GG.sph(0.35 * s, 0.3 * s, 0.35 * s, 8, 6), px, py, z), dark ? tr : '#6b4426');
}
function mbTree(mb, x, y, z, s, col) { mb.add(place(GG.cyl(0.18 * s, 0.25 * s, 2 * s, 7), x, y + s, z), '#6b4426'); mb.add(place(GG.sph(1.3 * s, 1.1 * s, 1.3 * s, 10, 8), x, y + 2.6 * s, z), col || '#2fa36b'); mb.add(place(GG.sph(0.9 * s, 0.8 * s, 0.9 * s, 9, 7), x + 0.7 * s, y + 3.2 * s, z + 0.2), col || '#3dbd78'); }
function mbPine(mb, x, y, z, s) { mb.add(place(GG.cyl(0.15 * s, 0.2 * s, 1.2 * s, 6), x, y + 0.6 * s, z), '#5a3a22'); for (let i = 0; i < 3; i++) mb.add(place(GG.cone((1.5 - i * 0.38) * s, 2.2 * s, 8), x, y + (1.8 + i * 1.3) * s, z), i & 1 ? '#1c7a5a' : '#16634a'); }
function mbBuilding(mb, x, y, z, w, h, d, col, trim, win) {
  mb.add(place(GG.box(w, h, d), x, y + h / 2, z), col); mb.add(place(GG.box(w + 0.3, 0.3, d + 0.3), x, y + h + 0.15, z), trim);
  const rows = Math.max(1, Math.floor((h - 1) / 1.6)), cols = Math.max(1, Math.floor(w / 1.5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mb.add(place(GG.box(0.7, 0.9, 0.08), x - w / 2 + (c + 0.5) * w / cols, y + 1.2 + r * 1.6, z + d / 2 + 0.03), win || '#3a6fd8', false);
}
function mbCrowd(mb, x0, x1, y, z, n, seed) { srand(seed); const cols = ['#ff5fa2', '#2fd3ff', '#ffd23c', '#9dff6b', '#ff9f1c', '#7b4dff', '#fff6dc'], sk = ['#f0b989', '#c98a5a', '#8d5a3b'];
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * rng(), zz = z + rng() * 1.2, hh = 0.75 + rng() * 0.25;
    mb.add(place(GG.cap(0.2, 0.35 * hh, 6), x, y + 0.4 * hh, zz), cols[i % cols.length]); mb.add(place(GG.sph(0.16, 0.17, 0.16, 8, 6), x, y + 0.85 * hh, zz), sk[i % 3]); } }

/* ---------------- camera, 16-bit pass, frame render ---------------- */
const CAMS = { tilt: 0.12, lookY: 0, extraZ: 0, cy: 0 };
function fov() { return V.portrait ? 40 : 32; }
function onResize() {
  renderer.setPixelRatio(V.dpr); renderer.setSize(V.W, V.H, false);
  camera.aspect = V.W / V.H; camera.fov = fov(); camera.updateProjectionMatrix();
  DOTSIZE.value = 5 * V.dpr; PU.scale.value = V.H * V.dpr / (2 * Math.tan(camera.fov * Math.PI / 360));
  low16Size();
  if (typeof Game !== 'undefined' && Game.state !== 'boot' && EVENTS[EVI]) Game.fitCamera(true);
}
const _cv = new THREE.Vector3();
function placeCamera() {
  // cam.z = screen pixels per sim unit; distance follows from the vertical FOV
  const ppm = cam.z / U, visH = V.H / ppm, dist = visH / (2 * Math.tan(camera.fov * Math.PI / 360));
  const tx = cam.x * U, ty = -cam.y * U;
  let sx = 0, sy = 0; if (T.shake > 0) { sx = Math.sin(T.real * 91) * T.shake * 0.004; sy = Math.cos(T.real * 77) * T.shake * 0.004; }
  camera.position.set(tx + sx, ty + Math.sin(CAMS.tilt) * dist + sy, Math.cos(CAMS.tilt) * dist + CAMS.extraZ);
  camera.lookAt(tx + sx, ty + sy, CAMS.extraZ);
  // shift the projection centre so the target sits in the middle of the play band (HUD on top, controls below)
  camera.setViewOffset(V.W, V.H, 0, V.H / 2 - (CAMS.cy || V.P.cy), V.W, V.H);
  sky.position.copy(camera.position);
  sun.position.set(tx + SUN_DIR.x * 40, ty + SUN_DIR.y * 40, SUN_DIR.z * 40); sun.target.position.set(tx, ty, 0);
}
function worldToScreen(x, y, z, out) { _cv.set(x * U, -y * U, (z || 0) * U).project(camera); out.x = (_cv.x + 1) / 2 * V.W; out.y = (1 - _cv.y) / 2 * V.H; return out; }
// 16-bit: render the scene into a low-res target, then snap to the 32-colour palette with ordered dither
const LOW = { on: false, rt: null, w: 384, h: 216 };
const PALQ = ['#14101f','#2c1642','#4a1f4f','#8c225d','#ff5fa2','#ff5e57','#ff9f1c','#ffbe55','#ffd23c','#fff6dc','#ffffff','#f7d794','#eab56f','#c98849','#9c5533','#5c3828',
              '#9fe8ff','#2fd3ff','#00a8a8','#0a6e7a','#073b4c','#8fd8ff','#2f5bd3','#2fa36b','#16634a','#9dff6b','#d1d8e0','#8a8fa3','#57606f','#2f3640','#f0b989','#b5653f'];
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, res: { value: new THREE.Vector2(384, 216) }, P: { value: PALQ.map(h => new THREE.Color(h)) } }, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 uv0; void main(){ uv0 = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D t; uniform vec2 res; uniform vec3 P[32]; varying vec2 uv0;
    float bay(vec2 f){ vec2 m = mod(floor(f), 4.0); int i = int(m.x + m.y * 4.0);
      float v[16]; v[0]=0.;v[1]=8.;v[2]=2.;v[3]=10.;v[4]=12.;v[5]=4.;v[6]=14.;v[7]=6.;v[8]=3.;v[9]=11.;v[10]=1.;v[11]=9.;v[12]=15.;v[13]=7.;v[14]=13.;v[15]=5.;
      for (int k = 0; k < 16; k++) if (k == i) return v[k]; return 0.; }
    void main(){ vec3 c = texture2D(t, uv0).rgb; c = pow(max(c, 0.0), vec3(1.0/2.2)); c += (bay(uv0 * res) / 16.0 - 0.47) * 0.1;
      float best = 99.0; vec3 o = P[0];
      for (int i = 0; i < 32; i++) { vec3 pc = pow(P[i], vec3(1.0/2.2)); vec3 d = c - pc; float e = dot(d * vec3(0.30, 0.59, 0.11), d) + dot(d, d) * 0.12; if (e < best) { best = e; o = P[i]; } }
      gl_FragColor = vec4(o, 1.0);
      #include <colorspace_fragment>
    }` });
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
function low16Size() {
  const s = 216 / Math.min(V.W, V.H); LOW.w = Math.max(64, Math.round(V.W * s)); LOW.h = Math.max(64, Math.round(V.H * s));
  if (!LOW.rt) { LOW.rt = new THREE.WebGLRenderTarget(LOW.w, LOW.h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); postMat.uniforms.t.value = LOW.rt.texture; }
  else LOW.rt.setSize(LOW.w, LOW.h);
  postMat.uniforms.res.value.set(LOW.w, LOW.h);
}
const b16 = document.getElementById('b16');
function toggle16() { LOW.on = !LOW.on; b16.classList.toggle('on', LOW.on); say(LOW.on ? '16-BIT MODE' : 'HD MODE', LOW.on ? 'the 1987 look' : 'remastered', '#2fd3ff', 1.1); }
b16.addEventListener('click', e => { e.stopPropagation(); anyUserInput('mouse'); toggle16(); b16.blur(); });
function renderFrame() {
  placeCamera(); syncParts();
  if (LOW.on) {
    renderer.setRenderTarget(LOW.rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  } else renderer.render(scene, camera);
}

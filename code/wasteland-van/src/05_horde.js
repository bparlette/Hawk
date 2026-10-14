
// ---------------- the horde: one InstancedMesh (+ outline) with vertex-shader limb animation ----------------
const ZN = 1800;
const ZGLSL = /* glsl */`
  attribute float limb; attribute float smask; attribute vec4 iData; attribute vec3 iTint;
  vec3 zRotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
  vec3 zRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
  float zAng(float lb, vec4 d) {
    float ph = d.x, m = d.y, s = sin(ph);
    if (m > 1.5 && m < 2.5) { if (lb < 0.5) return 0.0; return sin(ph * 1.3 + lb * 1.7) * 1.3; }
    float amp = (m > 0.5 && m < 1.5) ? 1.0 : 0.5;
    if (lb > 0.5 && lb < 1.5) return s * amp;
    if (lb > 1.5 && lb < 2.5) return -s * amp;
    if (lb > 2.5 && lb < 4.5) {
      float side = lb < 3.5 ? 1.0 : -1.0;
      if (m > 2.5) return -0.7 + sin(ph * 2.2 + side * 1.4) * 0.9;
      if (m > 0.5) return 0.9 - s * side * 0.8;
      return sin(ph * 0.5 + side) * 0.18;
    }
    if (lb > 4.5) return sin(ph * 0.5) * 0.18 + ((m > 0.5 && m < 1.5) ? -0.2 : 0.15);
    return 0.0;
  }
  vec3 zPiv(float lb) {
    if (lb < 0.5) return vec3(0.0);
    if (lb < 1.5) return vec3(0.15, 0.95, 0.0);
    if (lb < 2.5) return vec3(-0.15, 0.95, 0.0);
    if (lb < 3.5) return vec3(0.3, 1.5, 0.1);
    if (lb < 4.5) return vec3(-0.3, 1.5, 0.1);
    return vec3(0.0, 1.58, 0.16);
  }
  float zSplay(float lb, vec4 d) { // ragdoll: limbs splay sideways
    if (d.y < 1.5 || d.y > 2.5 || lb < 0.5 || lb > 4.5) return 0.0;
    float side = (lb < 1.5 || (lb > 2.5 && lb < 3.5)) ? 1.0 : -1.0;
    return side * (0.6 + 0.4 * sin(d.x + lb));
  }
  vec3 zPos(vec3 p, float lb, vec4 d) {
    vec3 pv = zPiv(lb);
    vec3 q = pv + zRotZ(zRotX(p - pv, zAng(lb, d)), zSplay(lb, d));
    float m = d.y;
    q.y += m < 0.5 ? abs(sin(d.x)) * 0.05 : (m < 1.5 ? abs(sin(d.x)) * 0.1 : 0.0);
    if (m > 0.5 && m < 1.5) q = zRotX(q, 0.3);
    if (m > 2.5) q = zRotX(q, 0.18 + 0.08 * sin(d.x * 2.2));
    return q;
  }
  vec3 zNrm(vec3 n, float lb, vec4 d) {
    vec3 q = zRotZ(zRotX(n, zAng(lb, d)), zSplay(lb, d));
    if (d.y > 0.5 && d.y < 1.5) q = zRotX(q, 0.3);
    return q;
  }
`;
const zMat = toonMat({}, 'zombie');
zMat.onBeforeCompile = ((orig) => (sh) => {
  orig(sh);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + ZGLSL + '\nvarying float vFlash; varying float vBurn;')
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = zNrm(normal, limb, iData);')
    .replace('#include <begin_vertex>', 'vec3 transformed = zPos(position, limb, iData);')
    .replace('#include <color_vertex>', '#include <color_vertex>\n vColor.rgb = mix(vColor.rgb, iTint, smask); vFlash = iData.z; vBurn = iData.w;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFlash; varying float vBurn;')
    .replace('outgoingLight = mix(outgoingLight, uFlashC, uFlash);', 'outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.28,0.2,0.16) + vec3(0.35,0.12,0.0) * dm, vBurn); outgoingLight = mix(outgoingLight, vec3(1.0, 0.97, 0.9), vFlash);');
})(zMat.onBeforeCompile);
const zOlMat = new THREE.ShaderMaterial({
  uniforms: { uW: { value: 0.0042 }, uC: { value: new THREE.Color('#14100f') }, uFogC: OUT_U.fogC, uFogN: OUT_U.fogN, uFogF: OUT_U.fogF },
  vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
    ${ZGLSL}
    void main() { vec3 p = zPos(position, limb, iData); vec3 od = zNrm(odir, limb, iData);
      mat4 im = modelMatrix * instanceMatrix; vec4 wp = im * vec4(p, 1.0); vec3 wd = mat3(im) * od;
      float L = length(wd); wd = L > 1e-5 ? wd / L * length(odir) : vec3(0.0);
      float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 3.0, 60.0);
      vD = d; gl_Position = d > 70.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform vec3 uC; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF; varying float vD;
    void main() { gl_FragColor = vec4(mix(uC, uFogC, smoothstep(uFogN, uFogF, vD)), 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide,
});
function zombieGeo() {
  // low-poly on purpose (~500 tris): 1,000+ of these are drawn twice (fill + outline hull)
  const SKIN = '#9bbf8a', SKIN2 = '#7fa173', PANTS = '#3f4a6b', SHOE = '#2a2222', WOUND = '#7a1a22', EYE = '#fff36a', HAIR = '#3a2a22';
  const L = (g, col, pos, rot, scl, limb, shirt = 0) => P(g, col, pos, rot, scl, { limb, smask: shirt });
  const cap = (r, l) => new THREE.CylinderGeometry(r * 0.85, r, l + r * 1.4, 5, 1);
  const p = [];
  p.push(L(GEO.box(0.42, 0.26, 0.3), PANTS, [0, 0.98, 0], null, null, 0));
  p.push(L(GEO.cyl(0.25, 0.2, 0.6, 6), '#ffffff', [0, 1.28, 0.05], [0.35, 0, 0], null, 0, 1));
  p.push(L(GEO.box(0.5, 0.12, 0.34), '#ffffff', [0, 1.05, 0.0], [0.1, 0.2, 0.08], null, 0, 1));
  p.push(L(GEO.box(0.16, 0.2, 0.06), WOUND, [0.09, 1.26, 0.24], [0.3, 0.2, 0], null, 0));
  p.push(L(GEO.box(0.26, 0.14, 0.2), SKIN2, [0, 1.52, 0.12], null, null, 0));
  p.push(L(GEO.sph(0.17, 0.19, 0.18, 6, 4), SKIN, [0, 1.74, 0.2], null, null, 5));
  p.push(L(GEO.box(0.3, 0.06, 0.1), SKIN2, [0, 1.8, 0.33], [0.2, 0, 0], null, 5));
  p.push(L(GEO.box(0.2, 0.08, 0.16), WOUND, [0, 1.6, 0.3], [0.4, 0, 0], null, 5));
  p.push(L(GEO.box(0.22, 0.05, 0.16), SKIN2, [0, 1.56, 0.29], [0.55, 0, 0], null, 5));
  p.push(L(GEO.box(0.06, 0.05, 0.03), EYE, [0.07, 1.75, 0.37], null, null, 5));
  p.push(L(GEO.box(0.06, 0.05, 0.03), EYE, [-0.07, 1.75, 0.37], null, null, 5));
  p.push(L(GEO.box(0.16, 0.12, 0.14), HAIR, [0.05, 1.92, 0.16], [0.3, 0.4, 0.2], null, 5));
  for (const [s, lb] of [[1, 1], [-1, 2]]) {
    p.push(L(cap(0.09, 0.32), PANTS, [s * 0.15, 0.74, 0], [0.05, 0, 0], null, lb));
    p.push(L(cap(0.075, 0.32), s > 0 ? PANTS : SKIN2, [s * 0.15, 0.36, -0.02], [-0.08, 0, 0], null, lb));
    p.push(L(GEO.box(0.14, 0.09, 0.26), SHOE, [s * 0.15, 0.05, 0.05], null, null, lb));
  }
  for (const [s, lb] of [[1, 3], [-1, 4]]) {
    p.push(L(GEO.box(0.2, 0.18, 0.2), '#ffffff', [s * 0.3, 1.5, 0.1], null, null, lb, 1));
    p.push(L(cap(0.075, 0.26), '#ffffff', [s * 0.32, 1.42, 0.3], [1.25, 0, 0], null, lb, 1));
    p.push(L(cap(0.06, 0.28), SKIN, [s * 0.32, 1.36, 0.62], [1.45, 0, 0], null, lb));
    p.push(L(GEO.box(0.12, 0.05, 0.16), SKIN2, [s * 0.32, 1.35, 0.84], [0.1, 0, 0], null, lb));
  }
  return merge(p);
}
const zGeo = zombieGeo();
const ZDATA = new Float32Array(ZN * 4), ZTINT = new Float32Array(ZN * 3);
zGeo.setAttribute('iData', new THREE.InstancedBufferAttribute(ZDATA, 4));
zGeo.setAttribute('iTint', new THREE.InstancedBufferAttribute(ZTINT, 3));
zGeo.attributes.iData.setUsage(THREE.DynamicDrawUsage); zGeo.attributes.iTint.setUsage(THREE.DynamicDrawUsage);
const zMesh = new THREE.InstancedMesh(zGeo, zMat, ZN);
const zOl = new THREE.InstancedMesh(zGeo, zOlMat, ZN);
zOl.instanceMatrix = zMesh.instanceMatrix; zMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
zMesh.frustumCulled = zOl.frustumCulled = false; zMesh.count = zOl.count = 0;
scene.add(zMesh, zOl);
// blob shadows
const blobTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(40,16,10,0.55)'); g.addColorStop(1, 'rgba(40,16,10,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const blobMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), ZN);
blobMesh.frustumCulled = false; blobMesh.count = 0; blobMesh.renderOrder = 1; scene.add(blobMesh);

// SoA horde state
const ZS = new Uint8Array(ZN), ZT = new Uint8Array(ZN);
const ZX = new Float32Array(ZN), ZY = new Float32Array(ZN), ZZ = new Float32Array(ZN), ZVX = new Float32Array(ZN), ZVY = new Float32Array(ZN), ZVZ = new Float32Array(ZN);
const ZYAW = new Float32Array(ZN), ZHP = new Float32Array(ZN), ZSPD = new Float32Array(ZN), ZPH = new Float32Array(ZN), ZFL = new Float32Array(ZN), ZBURN = new Float32Array(ZN);
const ZCD = new Float32Array(ZN), ZLIFE = new Float32Array(ZN), ZSC = new Float32Array(ZN), ZSTUN = new Float32Array(ZN), ZSAW = new Float32Array(ZN), ZMODE = new Uint8Array(ZN), ZBITE = new Uint8Array(ZN);
const ZQ = new Float32Array(ZN * 4), ZW = new Float32Array(ZN * 3);
const ZFREE = new Int32Array(ZN); let zFreeN = 0, zHigh = 0;
const ZTYPES = [
  { name: 'walker', hp: 12, spd: [2.3, 3.4], dmg: 3, xp: 1, sx: 1, sy: 1, scrap: 0.05 },
  { name: 'runner', hp: 9, spd: [6.4, 7.9], dmg: 3, xp: 2, sx: 0.92, sy: 0.98, scrap: 0.09 },
  { name: 'bloater', hp: 45, spd: [1.7, 2.1], dmg: 7, xp: 4, sx: 1.55, sy: 1.12, scrap: 0.45 },
];
const SHIRTS = ['#c9a37a', '#6f8fb3', '#b04a3a', '#d8d2c2', '#5e7a4a', '#8a6aa8', '#c47f2e', '#4c5a6a'];
const _sc = new THREE.Color();
function hordeReset() {
  zFreeN = 0; for (let i = ZN - 1; i >= 0; i--) { ZS[i] = 0; ZFREE[zFreeN++] = i; }
  zHigh = 0; zMesh.count = zOl.count = blobMesh.count = 0; ZDATA.fill(0);
}
let HORDE = { alive: 0, corpses: 0 };
function zSpawn(type, x, z, hpMul) {
  if (zFreeN === 0) return -1;
  const i = ZFREE[--zFreeN], T = ZTYPES[type];
  ZS[i] = 1; ZT[i] = type; ZX[i] = x; ZZ[i] = z; ZY[i] = hm(x, z); ZVX[i] = ZVY[i] = ZVZ[i] = 0;
  ZHP[i] = T.hp * hpMul; ZSPD[i] = rnd(T.spd[0], T.spd[1]); ZPH[i] = Math.random() * TAU; ZFL[i] = 0; ZBURN[i] = 0; ZCD[i] = Math.random(); ZSTUN[i] = 0; ZSAW[i] = 0; ZBITE[i] = 0;
  ZSC[i] = rnd(0.92, 1.1); ZYAW[i] = Math.atan2(VS.pos.x - x, VS.pos.z - z); ZMODE[i] = type === 1 ? 1 : 0;
  _sc.set(type === 2 ? '#b8c45a' : type === 1 ? (Math.random() < 0.5 ? '#c0392b' : '#d8742a') : SHIRTS[(Math.random() * SHIRTS.length) | 0]);
  ZTINT[i * 3] = _sc.r; ZTINT[i * 3 + 1] = _sc.g; ZTINT[i * 3 + 2] = _sc.b;
  if (i + 1 > zHigh) zHigh = i + 1;
  zGeo.attributes.iTint.needsUpdate = true;
  return i;
}
function zFree(i) { ZS[i] = 0; ZFREE[zFreeN++] = i; }
// ---------------- spatial hash (3 m cells, counting sort, rebuilt every step) ----------------
const HC = 3, HW = 136, HOFF = 204;
const HCOUNT = new Int32Array(HW * HW), HSTART = new Int32Array(HW * HW + 1), HCUR = new Int32Array(HW * HW), HITEMS = new Int32Array(ZN), ZCELL = new Int32Array(ZN);
function hCell(x, z) { let cx = ((x + HOFF) / HC) | 0, cz = ((z + HOFF) / HC) | 0; if (cx < 0) cx = 0; else if (cx >= HW) cx = HW - 1; if (cz < 0) cz = 0; else if (cz >= HW) cz = HW - 1; return cz * HW + cx; }
function hashBuild() {
  HCOUNT.fill(0); let alive = 0, corpses = 0;
  for (let i = 0; i < zHigh; i++) { if (ZS[i] !== 1) { if (ZS[i] === 2) corpses++; continue; } const c = hCell(ZX[i], ZZ[i]); ZCELL[i] = c; HCOUNT[c]++; alive++; }
  let s = 0; for (let c = 0; c < HW * HW; c++) { HSTART[c] = s; HCUR[c] = s; s += HCOUNT[c]; } HSTART[HW * HW] = s;
  for (let i = 0; i < zHigh; i++) if (ZS[i] === 1) HITEMS[HCUR[ZCELL[i]]++] = i;
  HORDE.alive = alive; HORDE.corpses = corpses;
}
const QBUF = new Int32Array(ZN);
function hQuery(x, z, r) {
  let n = 0; const r2 = r * r;
  const x0 = Math.max(0, ((x - r + HOFF) / HC) | 0), x1 = Math.min(HW - 1, ((x + r + HOFF) / HC) | 0);
  const z0 = Math.max(0, ((z - r + HOFF) / HC) | 0), z1 = Math.min(HW - 1, ((z + r + HOFF) / HC) | 0);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    const c = cz * HW + cx, e = HSTART[c] + HCOUNT[c];
    for (let k = HSTART[c]; k < e; k++) { const i = HITEMS[k]; const dx = ZX[i] - x, dz = ZZ[i] - z; if (dx * dx + dz * dz <= r2) QBUF[n++] = i; }
  }
  return n;
}
// static-collider grid for the horde (8 m cells)
const CG = 8, CGW = 52, CGOFF = 208, CGRID = [];
for (let i = 0; i < CGW * CGW; i++) CGRID.push([]);
function buildColGrid() {
  for (const g of CGRID) g.length = 0;
  COLS.forEach((o, k) => {
    const x0 = Math.max(0, ((o.x - o.r - 1 + CGOFF) / CG) | 0), x1 = Math.min(CGW - 1, ((o.x + o.r + 1 + CGOFF) / CG) | 0);
    const z0 = Math.max(0, ((o.z - o.r - 1 + CGOFF) / CG) | 0), z1 = Math.min(CGW - 1, ((o.z + o.r + 1 + CGOFF) / CG) | 0);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) CGRID[z * CGW + x].push(k);
  });
}
buildColGrid();
function colCell(x, z) { const cx = clamp(((x + CGOFF) / CG) | 0, 0, CGW - 1), cz = clamp(((z + CGOFF) / CG) | 0, 0, CGW - 1); return CGRID[cz * CGW + cx]; }

// ---------------- gibs (instanced chunks), splatter decals ----------------
const GIBN = 420;
const gibGeo = merge([P(GEO.dod(0.2), '#ffffff'), P(GEO.cyl(0.04, 0.05, 0.36, 5), '#f3ead8', [0.12, 0, 0], [0, 0, 1.2])]);
const gibMesh = new THREE.InstancedMesh(gibGeo, toonMat({}, 'gib'), GIBN);
const gibOl = new THREE.InstancedMesh(gibGeo, outlineMatInst(0.003), GIBN); gibOl.instanceMatrix = gibMesh.instanceMatrix;
gibMesh.frustumCulled = gibOl.frustumCulled = false; gibMesh.count = gibOl.count = GIBN; scene.add(gibMesh, gibOl);
const GB = { x: new Float32Array(GIBN), y: new Float32Array(GIBN), z: new Float32Array(GIBN), vx: new Float32Array(GIBN), vy: new Float32Array(GIBN), vz: new Float32Array(GIBN), life: new Float32Array(GIBN), s: new Float32Array(GIBN), q: new Float32Array(GIBN * 4), w: new Float32Array(GIBN * 3), n: 0 };
const GIBC = ['#a3202a', '#7d1620', '#9bbf8a', '#c9384a', '#5d0f16'].map((c) => new THREE.Color(c));
for (let i = 0; i < GIBN; i++) { gibMesh.setColorAt(i, GIBC[i % GIBC.length]); GB.life[i] = 0; GB.q[i * 4 + 3] = 1; }
const decalTex = canvasTex(128, 128, (c) => {
  c.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) { const a = srnd() * TAU, r = 10 + srnd() * 42, s = 5 + srnd() * 13; c.beginPath(); c.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, s * (1 - r / 70), 0, TAU); c.fill(); }
  c.beginPath(); c.arc(64, 64, 30, 0, TAU); c.fill();
  for (let i = 0; i < 7; i++) { const a = srnd() * TAU; c.save(); c.translate(64, 64); c.rotate(a); c.fillRect(0, -3, 50 + srnd() * 12, 6); c.restore(); }
});
const DECN = 520;
const decMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), DECN);
decMesh.frustumCulled = false; decMesh.count = DECN; decMesh.renderOrder = 2; scene.add(decMesh);
const DEC = { x: new Float32Array(DECN), z: new Float32Array(DECN), s: new Float32Array(DECN), life: new Float32Array(DECN), yaw: new Float32Array(DECN), n: 0, dirty: false };
const DECC = [new THREE.Color('#8a1420'), new THREE.Color('#6e0f18'), new THREE.Color('#9c2a1a'), new THREE.Color('#5f7d2c')];
for (let i = 0; i < DECN; i++) { _m4.makeScale(0, 0, 0); decMesh.setMatrixAt(i, _m4); decMesh.setColorAt(i, DECC[i % 3]); }
const _dn = new THREE.Vector3(), _dq = new THREE.Quaternion(), _dq2 = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);
function decalAt(x, z, s, acid) {
  const i = DEC.n; DEC.n = (DEC.n + 1) % DECN;
  DEC.x[i] = x; DEC.z[i] = z; DEC.s[i] = s; DEC.life[i] = 28; DEC.yaw[i] = Math.random() * TAU;
  decMesh.setColorAt(i, acid ? DECC[3] : DECC[i % 3]); decMesh.instanceColor.needsUpdate = true;
  writeDecal(i, s);
}
function writeDecal(i, s) {
  const x = DEC.x[i], z = DEC.z[i];
  _dn.set(hm(x - 0.6, z) - hm(x + 0.6, z), 1.2, hm(x, z - 0.6) - hm(x, z + 0.6)).normalize();
  _dq.setFromUnitVectors(_UP, _dn); _dq2.setFromAxisAngle(_UP, DEC.yaw[i]); _dq.multiply(_dq2);
  _m4.compose(_v1.set(x, hm(x, z) + 0.07, z), _dq, _v2.set(s, 1, s)); decMesh.setMatrixAt(i, _m4); DEC.dirty = true;
}
function gibBurst(x, y, z, vx, vy, vz, n, power) {
  for (let k = 0; k < n; k++) {
    const i = GB.n; GB.n = (GB.n + 1) % GIBN;
    GB.x[i] = x + rnd(-0.3, 0.3); GB.y[i] = y + rnd(0.4, 1.5); GB.z[i] = z + rnd(-0.3, 0.3);
    GB.vx[i] = vx * 0.5 + rnd(-1, 1) * power; GB.vy[i] = vy * 0.3 + rnd(3, 9) * (0.5 + power * 0.06); GB.vz[i] = vz * 0.5 + rnd(-1, 1) * power;
    GB.life[i] = rnd(2.5, 4.5); GB.s[i] = rnd(0.6, 1.5);
    GB.w[i * 3] = rnd(-12, 12); GB.w[i * 3 + 1] = rnd(-12, 12); GB.w[i * 3 + 2] = rnd(-12, 12);
  }
}
const _gq = new THREE.Quaternion(), _gw = new THREE.Vector3();
function gibStep(dt) {
  for (let i = 0; i < GIBN; i++) {
    if (GB.life[i] <= 0) continue;
    GB.life[i] -= dt; GB.vy[i] -= 22 * dt;
    GB.x[i] += GB.vx[i] * dt; GB.y[i] += GB.vy[i] * dt; GB.z[i] += GB.vz[i] * dt;
    const g = hm(GB.x[i], GB.z[i]) + 0.12;
    if (GB.y[i] < g) { GB.y[i] = g; if (GB.vy[i] < -3) { GB.vy[i] *= -0.3; } else GB.vy[i] = 0; GB.vx[i] *= 0.7; GB.vz[i] *= 0.7; GB.w[i * 3] *= 0.7; GB.w[i * 3 + 1] *= 0.7; GB.w[i * 3 + 2] *= 0.7; }
    const wx = GB.w[i * 3], wy = GB.w[i * 3 + 1], wz = GB.w[i * 3 + 2], wl = Math.hypot(wx, wy, wz);
    if (wl > 0.01) { _gq.setFromAxisAngle(_gw.set(wx / wl, wy / wl, wz / wl), wl * dt); _q.fromArray(GB.q, i * 4).premultiply(_gq).normalize().toArray(GB.q, i * 4); }
  }
}
function gibRender() {
  for (let i = 0; i < GIBN; i++) {
    if (GB.life[i] <= 0) { _m4.makeScale(0, 0, 0); gibMesh.setMatrixAt(i, _m4); continue; }
    const s = GB.s[i] * Math.min(1, GB.life[i] * 2);
    _q.fromArray(GB.q, i * 4); _m4.compose(_v1.set(GB.x[i], GB.y[i], GB.z[i]), _q, _v2.set(s, s, s)); gibMesh.setMatrixAt(i, _m4);
  }
  gibMesh.instanceMatrix.needsUpdate = true;
}

// ---------------- pickups: XP shards + scrap bolts ----------------
const GEMN = 900;
const gemGeo = merge([P(new THREE.OctahedronGeometry(0.34, 0), '#ffffff', null, null, [0.8, 1.3, 0.8])]);
const gemMesh = new THREE.InstancedMesh(gemGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), GEMN);
const gemOl = new THREE.InstancedMesh(gemGeo, outlineMatInst(0.004), GEMN); gemOl.instanceMatrix = gemMesh.instanceMatrix;
gemMesh.frustumCulled = gemOl.frustumCulled = false; gemMesh.count = gemOl.count = GEMN; scene.add(gemMesh, gemOl);
const GM = { x: new Float32Array(GEMN), y: new Float32Array(GEMN), z: new Float32Array(GEMN), v: new Float32Array(GEMN), st: new Uint8Array(GEMN), t: new Float32Array(GEMN), vx: new Float32Array(GEMN), vz: new Float32Array(GEMN), vy: new Float32Array(GEMN), n: 0 };
const GEMC = [new THREE.Color('#5dff7a'), new THREE.Color('#4fd2ff'), new THREE.Color('#ff4fd8')];
for (let i = 0; i < GEMN; i++) gemMesh.setColorAt(i, GEMC[0]);
const SCRN = 220;
const scrapGeo = (() => { const p = [P(GEO.cyl(0.3, 0.3, 0.14, 8), '#b9c2c9', null, [1.57, 0, 0]), P(GEO.cyl(0.12, 0.12, 0.18, 6), '#ff9a2e', null, [1.57, 0, 0])]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.push(P(GEO.box(0.14, 0.14, 0.15), '#b9c2c9', [Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0], [0, 0, a])); } return merge(p); })();
const scrapMesh = new THREE.InstancedMesh(scrapGeo, toonMat({}, 'scrap'), SCRN);
const scrapOl = new THREE.InstancedMesh(scrapGeo, outlineMatInst(0.004), SCRN); scrapOl.instanceMatrix = scrapMesh.instanceMatrix;
scrapMesh.frustumCulled = scrapOl.frustumCulled = false; scrapMesh.count = scrapOl.count = SCRN; scene.add(scrapMesh, scrapOl);
const SC = { x: new Float32Array(SCRN), y: new Float32Array(SCRN), z: new Float32Array(SCRN), st: new Uint8Array(SCRN), t: new Float32Array(SCRN), vy: new Float32Array(SCRN), n: 0 };
function pickupsReset() {
  GM.st.fill(0); SC.st.fill(0); GB.life.fill(0); DEC.life.fill(0);
  for (let i = 0; i < DECN; i++) { _m4.makeScale(0, 0, 0); decMesh.setMatrixAt(i, _m4); } decMesh.instanceMatrix.needsUpdate = true;
}
function gemDrop(x, z, v) {
  let i = -1;
  for (let k = 0; k < 24; k++) { const j = (GM.n + k) % GEMN; if (!GM.st[j]) { i = j; break; } }
  if (i < 0) { // pool full: fold the value into an idle shard
    const j = GM.n; GM.n = (GM.n + 1) % GEMN; if (GM.st[j]) { GM.v[j] += v; return; } i = j;
  }
  GM.n = (i + 1) % GEMN;
  GM.st[i] = 1; GM.x[i] = x; GM.z[i] = z; GM.y[i] = hm(x, z) + 0.6; GM.v[i] = v; GM.t[i] = 0; GM.vy[i] = rnd(4, 7); GM.vx[i] = rnd(-2, 2); GM.vz[i] = rnd(-2, 2);
  gemMesh.setColorAt(i, v >= 20 ? GEMC[2] : v >= 4 ? GEMC[1] : GEMC[0]); gemMesh.instanceColor.needsUpdate = true;
}
function scrapDrop(x, z) {
  const i = SC.n; SC.n = (SC.n + 1) % SCRN;
  SC.st[i] = 1; SC.x[i] = x; SC.z[i] = z; SC.y[i] = hm(x, z) + 0.6; SC.t[i] = 0; SC.vy[i] = rnd(5, 8);
}


// ---------------- world: wasteland basin, the Rift trench, mega jump, kickers, wrecks, mesas ----------------
const ARENA_R = 168;          // hard boundary radius (canyon walls beyond)
const TZ = 25, TW = 7, TD = 5.5; // trench centre z, half-width of floor, depth
const START = { x: 0, z: -112, yaw: 0 };
const EXTRACT = { x: 0, z: 122, r: 9 };
// ramps: lip faces +yaw direction. u in [0,L] runs from the ground end to the lip.
const RAMPS = [
  { x: 0, z: -22, yaw: 0, L: 33, W: 14, H: 7.2, pw: 1.25, big: true },       // MEGA JUMP over the Rift
  { x: 0, z: 70, yaw: Math.PI, L: 31, W: 15, H: 6.0, pw: 1.0, big: true },   // landing ramp
  { x: -72, z: -62, yaw: 0.65, L: 10, W: 7, H: 2.4, pw: 1.7 },
  { x: 78, z: -55, yaw: -0.8, L: 10, W: 7, H: 2.4, pw: 1.7 },
  { x: -95, z: 70, yaw: 2.3, L: 10, W: 7, H: 2.6, pw: 1.7 },
  { x: 98, z: 78, yaw: -2.4, L: 10, W: 7, H: 2.6, pw: 1.7 },
  { x: -118, z: -8, yaw: 1.57, L: 12, W: 8, H: 3.0, pw: 1.6 },
  { x: 120, z: -2, yaw: -1.57, L: 12, W: 8, H: 3.0, pw: 1.6 },
  { x: -36, z: -88, yaw: -0.3, L: 8, W: 6, H: 1.8, pw: 1.8 },
  { x: 42, z: 100, yaw: 3.0, L: 9, W: 7, H: 2.2, pw: 1.7 },
];
for (const r of RAMPS) { r.fx = Math.sin(r.yaw); r.fz = Math.cos(r.yaw); }
function noiseH(x, z) {
  return 1.5 * Math.sin(x * 0.031 + 0.7) * Math.cos(z * 0.027 - 0.4) + 0.8 * Math.sin(x * 0.071 + z * 0.053) + 0.35 * Math.sin(x * 0.19 - z * 0.13) + 0.25 * Math.cos(x * 0.11 + z * 0.23);
}
function baseH(x, z) {
  // calm pads at the start, the jump approach and the extraction point
  let pad = 1;
  pad *= smooth(10, 30, Math.hypot(x - START.x, z - START.z));
  pad *= 1 - (1 - smooth(10, 22, Math.abs(x))) * smooth(-62, -45, z) * (1 - smooth(85, 100, z));
  pad *= smooth(10, 26, Math.hypot(x - EXTRACT.x, z - EXTRACT.z));
  let h = noiseH(x, z) * (0.25 + 0.75 * pad);
  // the Rift: a dry canyon across the basin; ends slope up so you can drive in and out
  const ends = 1 - smooth(92, 128, Math.abs(x));
  const dz = Math.abs(z - TZ);
  h -= (1 - smooth(TW, TW + 9, dz)) * TD * ends;
  // canyon berm at the rim
  const r = Math.hypot(x, z);
  h += smooth(150, 182, r) * 24;
  return h;
}
function rampTop(rp, x, z) { // returns height of ramp surface at x,z or -1e9 if outside
  const dx = x - rp.x, dz = z - rp.z;
  const u = dx * rp.fx + dz * rp.fz, v = dx * rp.fz - dz * rp.fx;
  if (u < 0 || u > rp.L || v < -rp.W / 2 || v > rp.W / 2) return -1e9;
  return rp.y0 + rp.H * Math.pow(u / rp.L, rp.pw);
}
for (const r of RAMPS) r.y0 = baseH(r.x, r.z);
// exact ground height (van wheels use this; it has the sharp ramp lips)
function groundH(x, z) {
  let h = baseH(x, z);
  for (let i = 0; i < RAMPS.length; i++) { const t = rampTop(RAMPS[i], x, z); if (t > h) h = t; }
  return h;
}
// cached 1 m height grid for the horde, particles and pickups
const HM_N = 401, HM_O = 200, HM = new Float32Array(HM_N * HM_N);
for (let j = 0; j < HM_N; j++) for (let i = 0; i < HM_N; i++) HM[j * HM_N + i] = groundH(i - HM_O, j - HM_O);
function hm(x, z) {
  let fx = x + HM_O, fz = z + HM_O;
  if (fx < 0) fx = 0; else if (fx > HM_N - 1.001) fx = HM_N - 1.001;
  if (fz < 0) fz = 0; else if (fz > HM_N - 1.001) fz = HM_N - 1.001;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * HM_N + i;
  const a = HM[k] + (HM[k + 1] - HM[k]) * tx, b = HM[k + HM_N] + (HM[k + HM_N + 1] - HM[k + HM_N]) * tx;
  return a + (b - a) * tz;
}
const _gn = new THREE.Vector3();
function groundN(x, z, out) {
  const e = 0.35; const hx = groundH(x + e, z) - groundH(x - e, z), hz = groundH(x, z + e) - groundH(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

// ---------------- terrain mesh ----------------
const worldMat = toonMat({}, 'world');
const propMat = toonMat({}, 'prop');
(function buildTerrain() {
  const S = 520, N = 236, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const SAND = new THREE.Color('#ecb47c'), SAND2 = new THREE.Color('#dc9a66'), FLAT = new THREE.Color('#f4cf98'), RUST = new THREE.Color('#bd6644'), DEEP = new THREE.Color('#a4523b'), BERM = new THREE.Color('#d98557');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = baseH(x, z); p.setY(i, h);
    const n = noiseH(x * 1.7 + 13, z * 1.7 - 7);
    c.copy(SAND).lerp(SAND2, clamp(0.5 + n * 0.35, 0, 1));
    if (Math.sin(x * 0.05) * Math.cos(z * 0.043) > 0.55) c.lerp(FLAT, 0.7);           // cracked salt flats
    const dz = Math.abs(z - TZ), ends = 1 - smooth(92, 128, Math.abs(x));
    const tr = (1 - smooth(TW - 1, TW + 9.5, dz)) * ends; if (tr > 0.05) c.lerp(dz > TW ? RUST : DEEP, clamp(tr * 1.4, 0, 1));
    const r = Math.hypot(x, z); c.lerp(BERM, smooth(148, 175, r));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); g.computeVertexNormals();
  const m = new THREE.Mesh(g, worldMat); m.receiveShadow = true; scene.add(m);
  // painted road from the start to the mega ramp, and from the landing to extraction (dashed hazard paint)
  const road = [];
  for (let z = -128; z < -22; z += 6) road.push(P(GEO.box(0.5, 0.06, 3), '#fff2c8', [0, 0, z + 1.5]));
  for (let z = 72; z < 112; z += 6) road.push(P(GEO.box(0.5, 0.06, 3), '#fff2c8', [0, 0, z + 1.5]));
  for (const g2 of road) { const pp = g2.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) + baseH(pp.getX(i), pp.getZ(i)) + 0.04); }
  const rm = new THREE.Mesh(merge(road, false), propMat); rm.receiveShadow = true; scene.add(rm);
})();

// ---------------- sky dome ----------------
const SKY_U = { uTop: { value: new THREE.Color('#47a7e0') }, uHor: { value: new THREE.Color('#ffd9a6') }, uSun: { value: SUN_DIR }, uRed: { value: 0 } };
(function buildSky() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
    uniforms: SKY_U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform float uRed; varying vec3 vP;
      void main(){ float y = max(vP.y, 0.0);
        vec3 top = mix(uTop, vec3(0.42,0.12,0.16), uRed); vec3 hor = mix(uHor, vec3(1.0,0.45,0.28), uRed);
        vec3 c = mix(hor, top, pow(smoothstep(0.0, 0.55, y), 0.8));
        // banded cel clouds
        float cl = sin(vP.x * 9.0 + sin(vP.z * 7.0) * 1.6) * sin(vP.z * 6.0 + vP.x * 2.0);
        float band = smoothstep(0.08, 0.32, y) * (1.0 - smoothstep(0.32, 0.5, y));
        c = mix(c, mix(vec3(1.0,0.96,0.9), vec3(1.0,0.6,0.5), uRed), step(0.55, cl) * band * 0.85);
        // sun disc + rings
        float sd = dot(normalize(vP), normalize(uSun));
        c = mix(c, vec3(1.0,0.97,0.82), step(0.9965, sd));
        c = mix(c, vec3(1.0,0.86,0.6), step(0.985, sd) * (1.0 - step(0.9965, sd)) * 0.6);
        // far mesa silhouette band
        float hz = 0.035 + 0.02 * sin(atan(vP.z, vP.x) * 7.0) + 0.012 * sin(atan(vP.z, vP.x) * 23.0);
        c = mix(c, mix(vec3(0.85,0.55,0.45), vec3(0.6,0.25,0.25), uRed), step(vP.y, hz) * 0.8);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.frustumCulled = false; m.renderOrder = -10; scene.add(m); SKY_U.mesh = m;
})();

// ---------------- colliders ----------------
const COLS = []; // static circles {x,z,r}
function addCol(x, z, r) { COLS.push({ x, z, r }); }

// ---------------- mesas around the rim + rock pillars ----------------
(function buildMesas() {
  const parts = [];
  const STR = ['#c4623e', '#e08a52', '#a84a33', '#f0be86', '#cf7046'];
  SEED = 3;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + srnd() * 0.12, r = 186 + srnd() * 46;
    const x = Math.sin(a) * r, z = Math.cos(a) * r, base = baseH(x, z) - 3;
    let rad = 20 + srnd() * 16, y = base; const layers = 2 + ((srnd() * 3) | 0), rot = srnd() * 3;
    for (let l = 0; l < layers; l++) {
      const h = 12 + srnd() * 14, r2 = rad * (0.82 + srnd() * 0.1);
      parts.push(P(GEO.cyl(r2, rad, h, 7), STR[(i + l) % STR.length], [x, y + h / 2, z], [0, rot + l * 0.4, 0], null, { jitter: 0.06 }));
      parts.push(P(GEO.cyl(r2 * 1.01, r2 * 1.01, 1.2, 7), '#f6d3a0', [x, y + h - 2.6, z], [0, rot + l * 0.4, 0]));
      y += h; rad = r2 * (0.72 + srnd() * 0.12);
    }
  }
  // pillars inside the arena (also colliders)
  const PIL = [[-55, -20], [62, 52], [-48, 92], [30, -70], [-112, 34], [110, -78]];
  for (const [x, z] of PIL) {
    const b = baseH(x, z); let rad = 4.2 + srnd() * 1.5, y = b - 1;
    for (let l = 0; l < 3; l++) { const h = 4 + srnd() * 4; parts.push(P(GEO.cyl(rad * 0.85, rad, h, 6), STR[l + 1], [x, y + h / 2, z], [0, srnd() * 3, 0], null, { jitter: 0.05 })); y += h; rad *= 0.8 + (l === 1 ? 0.5 : 0); }
    parts.push(P(GEO.cyl(rad * 1.3, rad * 0.9, 2.2, 6), '#e08a52', [x, y + 1, z], [0, srnd() * 3, 0]));
    addCol(x, z, 4.6);
  }
  // boulders
  for (let i = 0; i < 40; i++) {
    const a = srnd() * TAU, r = 30 + srnd() * 125, x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) < 14 && z > -40 && z < 90) continue; if (Math.abs(z - TZ) < 16) continue;
    const s = 0.8 + srnd() * 1.6; parts.push(P(GEO.dod(s), STR[i % 5], [x, baseH(x, z) + s * 0.4, z], [srnd() * 3, srnd() * 3, 0], [1, 0.7, 1.1]));
    if (s > 1.4) addCol(x, z, s * 0.9);
  }
  const g = merge(parts); const m = withOutline(g, worldMat, OUT_WORLD, scene); m.castShadow = true; m.receiveShadow = true;
})();

// ---------------- ramps (planked tops, hazard lip, rust side plates, scaffolds under the big ones) ----------------
(function buildRamps() {
  const parts = [];
  for (const rp of RAMPS) {
    const seg = rp.big ? 16 : 8, pos = [], cols = [];
    const P0 = (u, v, h) => { const x = rp.x + rp.fx * u + rp.fz * v, z = rp.z + rp.fz * u - rp.fx * v; return [x, h, z]; };
    const top = (u) => rp.y0 + rp.H * Math.pow(u / rp.L, rp.pw);
    const C1 = new THREE.Color(rp.big ? '#d8a05c' : '#c98f52'), C2 = new THREE.Color(rp.big ? '#c38646' : '#b37a43'), HZ = new THREE.Color('#ffcf2e'), HK = new THREE.Color('#2a1d1a'), SIDE = new THREE.Color('#b8693f');
    const quad = (a, b, c, d, col) => { pos.push(...a, ...c, ...b, ...a, ...d, ...c); for (let k = 0; k < 6; k++) cols.push(col.r, col.g, col.b); };
    const w = rp.W / 2, low = rp.y0 - 3;
    for (let s = 0; s < seg; s++) {
      const u0 = (s / seg) * rp.L, u1 = ((s + 1) / seg) * rp.L, lip = s === seg - 1;
      const strip = 6;
      for (let k = 0; k < strip; k++) {
        const v0 = -w + (k / strip) * rp.W, v1 = -w + ((k + 1) / strip) * rp.W;
        const col = lip ? ((k & 1) ? HZ : HK) : ((s + k) & 1 ? C1 : C2);
        quad(P0(u0, v1, top(u0) + 0.02), P0(u1, v1, top(u1) + 0.02), P0(u1, v0, top(u1) + 0.02), P0(u0, v0, top(u0) + 0.02), col);
      }
      // side plates
      quad(P0(u0, -w, low), P0(u0, -w, top(u0)), P0(u1, -w, top(u1)), P0(u1, -w, low), SIDE);
      quad(P0(u1, w, low), P0(u1, w, top(u1)), P0(u0, w, top(u0)), P0(u0, w, low), SIDE);
    }
    quad(P0(rp.L, -w, low), P0(rp.L, -w, top(rp.L)), P0(rp.L, w, top(rp.L)), P0(rp.L, w, low), SIDE); // back wall under the lip
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    parts.push(g);
    // rivet rails + scaffold posts along the sides of the big ramps
    if (rp.big) for (let u = 3; u < rp.L; u += 5) for (const v of [-w - 0.3, w + 0.3]) {
      const [x, , z] = P0(u, v, 0); const ht = top(u) - low;
      parts.push(P(GEO.box(0.5, ht + 0.6, 0.5), '#5b3a2c', [x, low + ht / 2 + 0.3, z], [0, rp.yaw, 0]));
      parts.push(P(GEO.box(0.6, 0.6, 0.6), '#ffcf2e', [x, top(u) + 0.6, z], [0, rp.yaw, 0]));
    }
  }
  const m = withOutline(merge(parts), propMat, OUT_PROP, scene); m.receiveShadow = true; m.castShadow = true;
})();

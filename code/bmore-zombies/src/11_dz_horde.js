
// ======================= DEAD STREETS: the horde (pooled, instanced: one InstancedMesh per body type + shared instanced legs + instanced ink hulls) =======================
// The ink hull is Toad City's outline material (same uniforms / fragment), with a vertex shader that also applies the instance matrix.
function instOutline(src) {
  return new THREE.ShaderMaterial({ uniforms: src.uniforms, fragmentShader: src.fragmentShader, side: THREE.BackSide,
    vertexShader: `attribute vec3 odir; uniform float uW; varying float vD;
      void main() { mat4 mm = modelMatrix;
        #ifdef USE_INSTANCING
          mm = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = mm * vec4(position, 1.0); vec3 wd = normalize(mat3(mm) * odir) * length(odir);
        float d = distance(wp.xyz, cameraPosition); wp.xyz += wd * uW * clamp(d, 2.5, 36.0); vD = d; gl_Position = projectionMatrix * viewMatrix * wp; }` });
}
const OUT_INST = instOutline(OUT_CHAR);
const ZMAT = toonMat(); ZMAT.customProgramCacheKey = () => 'psxZ';
const SKN = ['#7f9a5c', '#8aa070', '#6f8a58', '#9aa47a', '#7a8e6a']; // sick toad skins
// zombie toad bodies (origin at the feet, facing +z; legs are separate instances pivoting at the hips)
function toadHead(L, y, z, skin, o = {}) {
  L.push({ g: G.sph(0.31, 0.19, 0.28, 9, 6), c: skin, y, z, r: [o.tilt || 0.25, 0, o.roll || 0.18] }, { g: G.sph(0.27, 0.1, 0.22), c: '#c8c49a', y: y - 0.08, z: z + 0.05, r: [0.25, 0, 0.18] });
  L.push({ g: G.box(0.38, 0.09, 0.06), c: '#3a1418', y: y - 0.06, z: z + 0.25, r: [0.35, 0, 0.18] }); // open mouth
  for (const s of [-1, 1]) { L.push({ g: G.sph(0.1, 0.1, 0.1), c: skin, x: s * 0.14, y: y + 0.13, z: z + 0.08 });
    L.push({ g: G.sph(0.07, s > 0 ? 0.07 : 0.04, 0.05), c: o.eye || '#e8f0c0', x: s * 0.14, y: y + 0.15, z: z + 0.16 });
    L.push({ g: G.box(0.03, 0.03, 0.02), c: o.pupil || '#c02020', x: s * 0.14 + 0.02, y: y + 0.15, z: z + 0.205 }); }
}
function armsOut(L, sx, y, skin, sleeve, len = 0.5, lift = 0) {
  for (const s of [-1, 1]) { L.push({ g: G.cap(0.075, len), c: sleeve, x: s * sx, y: y + lift * s * 0.05, z: len / 2 + 0.05, r: [Math.PI / 2 - 0.1 - lift * 0.1, 0, 0] });
    L.push({ g: G.sph(0.09, 0.05, 0.11), c: skin, x: s * sx, y: y - 0.02, z: len + 0.18 }); }
}
const ZT = {}; // type table
function defType(id, o) { ZT[id] = Object.assign({ id, cap: 60, hp: 30, sp: [1.2, 1.9], dmg: 8, r: 0.38, scale: 1, legC: '#3a3442', score: 10, barDps: 12 }, o); }
defType('wA', { cap: 300, parts: () => { const L = [], sk = SKN[0]; L.push({ g: G.sph(0.3, 0.34, 0.25), c: '#c03a3a', y: 0.92, z: 0.04, r: [0.35, 0, 0] }, { g: G.box(0.34, 0.4, 0.06), c: '#f0ece0', y: 0.92, z: 0.25, r: [0.35, 0, 0] }); // crab-house bib
  L.push({ g: G.sph(0.22, 0.14, 0.18), c: '#3a3442', y: 0.66 }); toadHead(L, 1.3, 0.2, sk); armsOut(L, 0.32, 1.08, sk, '#c03a3a'); return L; } });
defType('wB', { cap: 300, hp: 28, parts: () => { const L = [], sk = SKN[3]; L.push({ g: G.cyl(0.24, 0.4, 0.5, 8), c: '#4a6ab8', y: 0.68 }, { g: G.sph(0.28, 0.3, 0.24), c: '#4a6ab8', y: 0.98, z: 0.03, r: [0.3, 0, 0] }); // hon: blue dress
  toadHead(L, 1.32, 0.18, sk); L.push({ g: G.sph(0.3, 0.42, 0.3), c: '#c8b04a', y: 1.66, z: 0.04 }); // the beehive
  for (const s of [-1, 1]) L.push({ g: G.box(0.13, 0.04, 0.03), c: '#d23a8a', x: s * 0.14, y: 1.5, z: 0.36, r: [0, 0, -s * 0.3] }); // cat-eye frames
  armsOut(L, 0.3, 1.08, sk, sk, 0.46); return L; }, legC: SKN[3] });
defType('wC', { cap: 300, parts: () => { const L = [], sk = SKN[2]; L.push({ g: G.sph(0.3, 0.35, 0.26), c: '#5a3a8a', y: 0.92, z: 0.04, r: [0.4, 0, 0] }, { g: G.sph(0.22, 0.12, 0.2), c: '#5a3a8a', y: 1.18, z: -0.1 }); // purple hoodie
  L.push({ g: G.sph(0.22, 0.14, 0.18), c: '#2a3a5a', y: 0.66 }); toadHead(L, 1.3, 0.2, sk, { roll: -0.2 }); armsOut(L, 0.32, 1.06, sk, '#5a3a8a', 0.5, 1); return L; }, legC: '#2a3a5a' });
defType('runner', { cap: 140, hp: 22, sp: [4.0, 4.8], dmg: 6, score: 20, parts: () => { const L = [], sk = '#a08a5a'; L.push({ g: G.sph(0.24, 0.32, 0.2), c: '#e8e4d8', y: 0.9, z: 0.12, r: [0.75, 0, 0] }); // tank top, leaning hard
  L.push({ g: G.sph(0.2, 0.12, 0.17), c: '#5a7aa8', y: 0.66 }); toadHead(L, 1.18, 0.44, sk, { tilt: 0.6, eye: '#ffe060', pupil: '#ff2020' }); armsOut(L, 0.28, 0.98, sk, sk, 0.42); return L; }, legC: '#5a7aa8' });
defType('brute', { cap: 30, hp: 420, sp: [1.0, 1.25], dmg: 24, r: 0.8, scale: 1.75, score: 150, barDps: 70, parts: () => { const L = [], sk = '#6a7a54';
  L.push({ g: G.sph(0.42, 0.42, 0.34), c: '#ff7a1c', y: 0.98, z: 0.04, r: [0.3, 0, 0] }, { g: G.box(0.5, 0.08, 0.36), c: '#e8e070', y: 0.98, z: 0.06, r: [0.3, 0, 0] }); // dock-worker vest
  L.push({ g: G.sph(0.3, 0.16, 0.24), c: '#3a3a40', y: 0.66 }); toadHead(L, 1.38, 0.22, sk); L.push({ g: G.sph(0.24, 0.13, 0.24), c: '#ffd23c', y: 1.56, z: 0.18 }, { g: G.cyl(0.3, 0.3, 0.03, 10), c: '#ffd23c', y: 1.5, z: 0.18 }); // hard hat
  for (const s of [-1, 1]) { L.push({ g: G.sph(0.18, 0.18, 0.18), c: sk, x: s * 0.44, y: 1.18 }); L.push({ g: G.cap(0.13, 0.5), c: sk, x: s * 0.46, y: 0.92, z: 0.18, r: [0.6, 0, 0] }); L.push({ g: G.sph(0.16, 0.12, 0.16), c: sk, x: s * 0.46, y: 0.7, z: 0.42 }); }
  return L; }, legC: '#3a3a40' });
defType('bloater', { cap: 70, hp: 45, sp: [0.9, 1.15], dmg: 10, r: 0.6, score: 30, parts: () => { const L = [], sk = '#8a9a5a'; L.push({ g: G.sph(0.5, 0.48, 0.48), c: '#9a7aa0', y: 0.95, z: 0.05 }); // swollen belly
  for (let k = 0; k < 9; k++) { const a = k * 2.4, y = 0.75 + (k % 3) * 0.18; L.push({ g: G.sph(0.08, 0.08, 0.08), c: '#c8e050', x: Math.cos(a) * 0.46, y, z: Math.sin(a) * 0.46 + 0.05 }); }
  toadHead(L, 1.46, 0.16, sk, { eye: '#e0ff80' }); armsOut(L, 0.42, 1.0, sk, sk, 0.28); return L; }, legC: '#6a5a6a' });
defType('spitter', { cap: 50, hp: 55, sp: [1.4, 1.7], dmg: 6, score: 40, parts: () => { const L = [], sk = '#b0b050'; L.push({ g: G.sph(0.26, 0.34, 0.22), c: '#3a6a5a', y: 0.92, z: 0.02, r: [0.2, 0, 0] });
  L.push({ g: G.cap(0.1, 0.3), c: sk, y: 1.3, z: 0.05 }); toadHead(L, 1.62, 0.12, sk, { eye: '#ffffff', pupil: '#20a020' }); L.push({ g: G.sph(0.24, 0.2, 0.2), c: '#e8f070', y: 1.42, z: 0.24 }); // the swollen throat sac
  armsOut(L, 0.3, 1.04, sk, '#3a6a5a', 0.4); return L; }, legC: '#2a3a3a' });
const ZLIST = Object.values(ZT);
// horde budget: build the zombie bodies from lower-poly primitives than the HD hero rigs (hundreds are on screen at once)
const _G0 = { sph: G.sph, cap: G.cap, cyl: G.cyl };
G.sph = (rx, ry, rz) => new THREE.SphereGeometry(1, 9, 6).scale(rx, ry, rz); G.cap = (r, len) => new THREE.CapsuleGeometry(r, len, 1, 6); G.cyl = (rt, rb, h, s = 7, open = false) => new THREE.CylinderGeometry(rt, rb, h, Math.min(Math.max(s, 6), 10), 1, open);
const LEG_GEO = mergeGeo([{ g: G.cap(0.1, 0.36), c: '#ffffff', y: -0.3 }, { g: G.sph(0.12, 0.07, 0.18), c: '#ffffff', y: -0.6, z: 0.07 }]);
let ZCAP = 0; for (const t of ZLIST) { t.geo = mergeGeo(t.parts()); t.im = new THREE.InstancedMesh(t.geo, ZMAT, t.cap); t.ol = new THREE.InstancedMesh(t.geo, OUT_INST, t.cap);
  for (const m of [t.im, t.ol]) { m.count = 0; m.frustumCulled = false; scene.add(m); } t.im.castShadow = false; t.im.receiveShadow = true; t.ol.visible = QUAL.hd; QUAL.outlines.push(t.ol);
  t.im.setColorAt(0, new THREE.Color(1, 1, 1)); ZCAP += t.cap; t.n = 0; }
Object.assign(G, _G0); // everything else keeps Toad City's HD primitives
DZ.zTris = Object.fromEntries(ZLIST.map((t) => [t.id, t.geo.attributes.position.count / 3]));
const LEGS = new THREE.InstancedMesh(LEG_GEO, ZMAT, ZCAP * 2), LEGS_OL = new THREE.InstancedMesh(LEG_GEO, OUT_INST, ZCAP * 2);
for (const m of [LEGS, LEGS_OL]) { m.count = 0; m.frustumCulled = false; scene.add(m); } LEGS.setColorAt(0, new THREE.Color(1, 1, 1)); LEGS_OL.visible = QUAL.hd; QUAL.outlines.push(LEGS_OL);
// blob shadows under every zombie (cheap: one instanced quad)
const BLOB = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false }), ZCAP);
BLOB.count = 0; BLOB.frustumCulled = false; BLOB.renderOrder = 1; scene.add(BLOB);
// goo decals on the ground (ring buffer)
const GOO_N = 160, GOO = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }), GOO_N);
GOO.count = 0; GOO.frustumCulled = false; GOO.renderOrder = 1; scene.add(GOO); GOO.setColorAt(0, new THREE.Color('#5a8a2a')); let gooI = 0;
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color();
function goo(x, z, s, col) { const y = (gi(x, z) >= 0 && z > -8 && z < 8) || (x > XS.light[0] + 1.5 && x < XS.light[1] - 1.5 && z > 12) ? 0.03 : CURB + 0.03;
  _gm.compose(_gp.set(x, y, z), _gq.setFromAxisAngle(_Y, Math.random() * TAU), _gs.set(s * (0.8 + Math.random() * 0.6), 1, s)); GOO.setMatrixAt(gooI, _gm); GOO.setColorAt(gooI, _gc.set(col || '#4f7a22'));
  gooI = (gooI + 1) % GOO_N; GOO.count = Math.max(GOO.count, gooI === 0 ? GOO_N : gooI); GOO.instanceMatrix.needsUpdate = true; GOO.instanceColor.needsUpdate = true; }
const _Y = new THREE.Vector3(0, 1, 0);

// ---------------- the pool ----------------
const Z = []; for (let i = 0; i < ZCAP; i++) Z.push({ on: false, i });
let ZALIVE = 0; const ZBY = {}; for (const t of ZLIST) ZBY[t.id] = 0;
function groundY(x, z) { if (x > XS.light[0] + 1.5 && x < XS.light[1] - 1.5 && z > -60 && z < QUAY) return 0; for (const [a, b] of [XS.eutaw, XS.pres]) if (x > a + 1.5 && x < b - 1.5 && z < -12) return 0; return z > -8 && z < 8 ? 0 : CURB; }
function spawnZ(type, x, z, o = {}) {
  const t = ZT[type]; if (!t || ZBY[type] >= t.cap) return null; const q = Z.find((e) => !e.on); if (!q) return null;
  Object.assign(q, { on: true, t, x, z, y: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: Math.random() * TAU, hp: t.hp * (o.hpMul || 1), maxhp: t.hp, sp: rnd(t.sp[0], t.sp[1]) * (o.spMul || 1), ph: Math.random() * TAU,
    die: 0, flash: 0, atk: Math.random() * 0.6, climb: o.climb ? 1 : 0, think: Math.random() * 0.2, dx: 0, dz: 0, spit: rnd(1.5, 3.5), lunge: 0, seen: false, fallDir: 1, tint: 0.82 + Math.random() * 0.3 });
  ZBY[type]++; ZALIVE++; return q;
}
function freeZ(q) { if (!q.on) return; q.on = false; ZBY[q.t.id]--; if (!q.die) ZALIVE--; }
function clearHorde() { for (const q of Z) if (q.on) { q.on = false; } ZALIVE = 0; for (const t of ZLIST) ZBY[t.id] = 0; for (const s of SPITS) { s.on = false; s.m.visible = false; } }

// spatial hash (2 m buckets) for separation, melee and explosions
const HB_C = 2, HB_W = Math.ceil(GWD / HB_C), HB_H = Math.ceil(GHT / HB_C), HHEAD = new Int32Array(HB_W * HB_H), HNEXT = new Int32Array(ZCAP);
HHEAD.fill(-1);
const hbk = (x, z) => { const i = clamp(Math.floor((x - GX0) / HB_C), 0, HB_W - 1), j = clamp(Math.floor((z - GZ0) / HB_C), 0, HB_H - 1); return j * HB_W + i; };
function rehash() { HHEAD.fill(-1); for (const q of Z) if (q.on && !q.die && !q.climb) { const b = hbk(q.x, q.z); HNEXT[q.i] = HHEAD[b]; HHEAD[b] = q.i; } }
function nearZ(x, z, r, fn) { const i0 = clamp(Math.floor((x - r - GX0) / HB_C), 0, HB_W - 1), i1 = clamp(Math.floor((x + r - GX0) / HB_C), 0, HB_W - 1), j0 = clamp(Math.floor((z - r - GZ0) / HB_C), 0, HB_H - 1), j1 = clamp(Math.floor((z + r - GZ0) / HB_C), 0, HB_H - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let k = HHEAD[j * HB_W + i]; k >= 0; k = HNEXT[k]) { const q = Z[k]; const dx = q.x - x, dz = q.z - z; if (dx * dx + dz * dz < (r + q.t.r) * (r + q.t.r)) fn(q, dx, dz); } }

// ---------------- spitter spit (arcing globs) ----------------
const SPIT_MAT = toonMat(); const SPITS = [];
for (let i = 0; i < 24; i++) { const m = geoMesh([{ g: G.sph(0.18, 0.18, 0.18), c: '#c8f040' }, { g: G.sph(0.1, 0.1, 0.1), c: '#f8ffb0', x: 0.06, y: 0.06, z: 0.1 }], SPIT_MAT); m.visible = false; scene.add(m); SPITS.push({ m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3() }); }
function throwSpit(q, tx, tz) { const s = SPITS.find((e) => !e.on); if (!s) return; s.on = true; s.m.visible = true; const sc = q.t.scale; s.p.set(q.x, 1.45 * sc, q.z);
  const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz) || 1, T_ = clamp(d / 9, 0.55, 1.2); s.v.set(dx / T_, (0.3 - s.p.y + 0.5 * 14 * T_ * T_) / T_, dz / T_); SND.spit(); }
function spitStep(dt) { for (const s of SPITS) { if (!s.on) continue; s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt); s.m.position.copy(s.p); s.m.rotation.y += dt * 8;
  if (s.p.y <= 0.25) { s.on = false; s.m.visible = false; goo(s.p.x, s.p.z, 1.3, '#a8d830'); spawnSprite(FXT.puff, new THREE.Vector3(s.p.x, 0.5, s.p.z), 1.1, 0.4); const dx = PL.x - s.p.x, dz = PL.z - s.p.z; if (dx * dx + dz * dz < 1.6) hurtPlayer(8, 'SPAT ON', s.p.x, s.p.z); SND.splat(); } } }

// ---------------- explosions (bloaters + spice bombs) ----------------
function explode(x, z, r, dmgZ, dmgP, src) {
  spawnSprite(FX2.boom, new THREE.Vector3(x, 1.6, z), r * 1.1, 0.6, { kind: 'word', aspect: 2.2 }); spawnSprite(FXT.puff, new THREE.Vector3(x, 0.6, z), r * 1.3, 0.55); spawnSprite(FXT.star, new THREE.Vector3(x, 1.0, z), r * 0.9, 0.3);
  for (let k = 0; k < 4; k++) goo(x + rnd(-r, r) * 0.5, z + rnd(-r, r) * 0.5, rnd(0.8, 1.6), src === 'bloat' ? '#7a5a8a' : '#3a2a20');
  S.shake = Math.max(S.shake, src === 'bomb' ? 0.7 : 0.45); SND.boom(src === 'bomb');
  const hits = []; nearZ(x, z, r, (q) => hits.push(q)); for (const q of hits) { const dx = q.x - x, dz = q.z - z, d = Math.hypot(dx, dz) || 1; hitZ(q, dmgZ * (1 - 0.5 * d / (r + 1)), dx / d * 7, dz / d * 7, src); }
  if (BOSS.on && !BOSS.dead && Math.hypot(BOSS.x - x, BOSS.z - z) < r + 1.2) bossHit(dmgZ * 0.8, src);
  if (dmgP > 0) { const d = Math.hypot(PL.x - x, PL.z - z), rr = src === 'bomb' ? 2.6 : r; if (d < rr) hurtPlayer(dmgP * (1 - 0.4 * d / rr), src === 'bloat' ? 'BLOATER' : 'YOUR OWN BOMB', x, z); }
  for (const b of BARS) if (b.hp > 0 && src === 'bloat' && Math.hypot(b.cx - x, b.cz - z) < r + 1) damageBar(b, 60);
}

// ---------------- damage ----------------
function hitZ(q, dmg, kx, kz, src) {
  if (!q.on || q.die) return false; q.hp -= dmg; q.flash = 0.07; q.kx += kx; q.kz += kz; S.stats.dealt += dmg;
  if (q.hp <= 0) { killZ(q, src); return true; } return false;
}
function killZ(q, src) {
  q.die = 0.0001; ZALIVE--; q.fallDir = Math.random() < 0.5 ? 1 : -1; S.stats.kills++; S.combo++; S.comboT = 2.2; if (q.t.id !== 'wA' && q.t.id !== 'wB' && q.t.id !== 'wC') S.stats.specials++;
  const pts = q.t.score * (1 + Math.min(4, Math.floor(S.combo / 15))); S.score += pts;
  goo(q.x, q.z, q.t.id === 'brute' ? 1.6 : 0.9);
  if (q.t.id === 'bloater') { explode(q.x, q.z, 3.4, 70, 22, 'bloat'); }
  else if (Math.random() < (q.t.id === 'brute' ? 1 : 0.18)) spawnSprite(FX2.splat, new THREE.Vector3(q.x, 1.4 * q.t.scale, q.z), 1.1 * q.t.scale, 0.45, { kind: 'word', aspect: 2.2 });
  if (q.t.score >= 30) pop(q.x, 2.0 * q.t.scale, q.z, '+' + pts, 'gold');
  // drops: scrap for barricades, the odd ammo box / crab cake
  if (Math.random() < 0.28 || q.t.id === 'brute') dropPickup('scrap', q.x, q.z, q.t.id === 'brute' ? 4 : 1);
  if (Math.random() < (q.t.id === 'brute' ? 0.8 : q.t.score >= 30 ? 0.12 : 0.018)) dropPickup('ammo', q.x + 0.4, q.z);
  if (Math.random() < (q.t.id === 'brute' ? 0.5 : 0.01)) dropPickup('cake', q.x - 0.4, q.z);
  if (src === 'bullet' && Math.random() < 0.08) SND.groan(0.5);
}

// ---------------- the horde step: flow-field steering, separation, wall sliding, attacks on Harold / Mavis / barricades ----------------
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function steer(q) { // pick the downhill neighbour on the flow field
  const k = gi(q.x, q.z); if (k < 0) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; } const d0 = FIELD[k];
  if (d0 <= 2 || d0 === 65535) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; }
  let best = d0, bx = 0, bz = 0; const cx = (k % GWD), cz = Math.floor(k / GWD);
  for (const [ox, oz] of N8) { const nx = cx + ox, nz = cz + oz; if (nx < 0 || nz < 0 || nx >= GWD || nz >= GHT) continue; const n = nz * GWD + nx; const v = GRID[n]; if (v === 1 || v === 2 || v === 3) continue;
    if (ox && oz) { const a = GRID[cz * GWD + nx], b = GRID[nz * GWD + cx]; if (a !== 0 && a !== 4 || b !== 0 && b !== 4) continue; }
    const f = FIELD[n] + (ox && oz ? 0.4 : 0); if (f < best) { best = f; bx = ox; bz = oz; } }
  if (best === d0) { q.dx = PL.x - q.x; q.dz = PL.z - q.z; return; }
  q.dx = cellX(cz * GWD + cx + bx + bz * GWD) - q.x + bx * 0.3; q.dz = cellZ(cz * GWD + cx + bx + bz * GWD) - q.z + bz * 0.3;
}
function hordeStep(dt) {
  rehash(); const ptx = PL.x, ptz = PL.z;
  for (const q of Z) { if (!q.on) continue; const t = q.t;
    if (q.die) { q.die += dt; if (q.die > 1.6) freeZ(q); continue; }
    q.flash = Math.max(0, q.flash - dt); q.ph += dt * q.sp * 3.2;
    if (q.climb > 0) { q.climb -= dt * 0.8; q.y = -1.4 * q.climb; q.yaw = Math.atan2(ptx - q.x, ptz - q.z); if (q.climb <= 0) { q.climb = 0; q.y = 0; } continue; }
    const dxp = ptx - q.x, dzp = ptz - q.z, dp2 = dxp * dxp + dzp * dzp;
    if (dp2 > 110 * 110) { if (S.mode === 'play' && Math.random() < dt * 0.2) { freeZ(q); } continue; } // far stragglers fall away
    q.think -= dt; if (q.think <= 0) { q.think = 0.12 + Math.random() * 0.12; steer(q); }
    let mx = q.dx, mz = q.dz; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    let sp = q.sp; const dp = Math.sqrt(dp2);
    if (t.id === 'spitter') { if (dp < 7 && FIELD[gi(q.x, q.z)] < 12) { mx = -mx * 0.6; mz = -mz * 0.6; } q.spit -= dt; if (q.spit <= 0 && dp < 13) { q.spit = rnd(2.4, 3.6); throwSpit(q, ptx + PL.vx * 0.5, ptz + PL.vz * 0.5); q.lunge = 0.3; } }
    if (t.id === 'runner' && dp < 3) sp *= 1.15;
    // separation
    let sx = 0, sz = 0; nearZ(q.x, q.z, t.r + 0.1, (o, dx, dz) => { if (o === q) return; const d = Math.hypot(dx, dz) || 0.01, push = (t.r + o.t.r - d) / d; if (push > 0) { const w = o.t.r > t.r ? 1.4 : 0.8; sx -= dx * push * w; sz -= dz * push * w; } });
    const tx = mx * sp + sx * 3.5, tz = mz * sp + sz * 3.5;
    q.vx = damp(q.vx, tx, 6, dt); q.vz = damp(q.vz, tz, 6, dt);
    let nx = q.x + (q.vx + q.kx) * dt, nz = q.z + (q.vz + q.kz) * dt; q.kx = damp(q.kx, 0, 7, dt); q.kz = damp(q.kz, 0, 7, dt);
    // walls: slide; barricades: chew on them
    const kN = gi(nx, nz); const v = kN < 0 ? 1 : GRID[kN];
    if (v === 4) { const b = BARS[BAR_AT[kN]]; if (b && b.hp > 0) { q.atk -= dt; if (q.atk <= 0) { q.atk = 0.5; damageBar(b, t.barDps * 0.5); q.lunge = 0.25; } } nx = q.x; nz = q.z; }
    else if (v !== 0) { if (!solidAt(nx, q.z)) nz = q.z; else if (!solidAt(q.x, nz)) nx = q.x; else { nx = q.x; nz = q.z; } }
    q.x = nx; q.z = nz;
    if (Math.abs(q.vx) + Math.abs(q.vz) > 0.1) { const a = Math.atan2(q.vx, q.vz); q.yaw += angTo(q.yaw, a) * Math.min(1, dt * 7); }
    // bite Harold
    const reach = t.r + 0.55;
    if (dp < reach + 0.15 && S.mode === 'play') { q.atk -= dt; if (q.atk <= 0) { q.atk = t.id === 'brute' ? 1.2 : 0.85; q.lunge = 0.3; hurtPlayer(t.dmg, t.id === 'brute' ? 'BRUTE' : 'BITTEN', q.x, q.z); if (t.id === 'brute') { PL.kx += dxp / (dp || 1) * 9; PL.kz += dzp / (dp || 1) * 9; } if (t.id === 'bloater') { q.hp = 0; killZ(q, 'bloat'); } } }
    q.lunge = Math.max(0, q.lunge - dt);
    if (!q.seen && dp < 16) { q.seen = true; if (Math.random() < 0.15) SND.groan(t.id === 'brute' ? 1.4 : 1); }
  }
  spitStep(dt);
}

// ---------------- write the instances ----------------
const _zm = new THREE.Matrix4(), _zl = new THREE.Matrix4(), _zq = new THREE.Quaternion(), _ze = new THREE.Euler(0, 0, 0, 'YXZ'), _zp = new THREE.Vector3(), _zs = new THREE.Vector3(), _zc = new THREE.Color(), _zt = new THREE.Matrix4();
function hordeDraw() {
  for (const t of ZLIST) t.n = 0; let nl = 0, nb = 0;
  const cx = camera.position.x, cz = camera.position.z;
  for (const q of Z) { if (!q.on) continue; const t = q.t, sc = t.scale;
    if (Math.abs(q.x - cx) > 48 || q.z - cz > 10 || cz - q.z > 75) continue; // off-screen: skip
    const fall = q.die ? clamp(q.die / 0.45, 0, 1) : 0, walk = q.die ? 0 : Math.sin(q.ph);
    const pitch = fall * q.fallDir * Math.PI / 2 * 0.96 + (q.lunge > 0 ? 0.35 : 0), roll = q.die ? 0 : walk * 0.12, sink = q.die > 1.0 ? (q.die - 1.0) * 0.8 : 0;
    const by = q.y + (q.die ? 0.12 * fall * sc - sink : Math.abs(Math.cos(q.ph)) * 0.05);
    _ze.set(pitch, q.yaw, roll); _zq.setFromEuler(_ze); _zm.compose(_zp.set(q.x, by + groundY(q.x, q.z), q.z), _zq, _zs.set(sc, sc, sc));
    const ii = t.n++; t.im.setMatrixAt(ii, _zm); t.ol.setMatrixAt(ii, _zm);
    const f = q.flash > 0 ? 2.4 : q.tint; _zc.setRGB(f, f, f); t.im.setColorAt(ii, _zc);
    for (const s of [-1, 1]) { _zl.makeRotationX(q.die ? 0.3 : walk * 0.7 * s); _zl.setPosition(s * 0.15, 0.62, 0); _zt.multiplyMatrices(_zm, _zl); LEGS.setMatrixAt(nl, _zt); LEGS_OL.setMatrixAt(nl, _zt); _zc.copy(t.legCol || (t.legCol = new THREE.Color(t.legC))).multiplyScalar(q.flash > 0 ? 2.2 : 1); LEGS.setColorAt(nl, _zc); nl++; }
    if (!q.die && q.y > -0.5) { _zm.compose(_zp.set(q.x, groundY(q.x, q.z) + 0.02, q.z), _zq.identity(), _zs.set(t.r * 2.2, 1, t.r * 2.2)); BLOB.setMatrixAt(nb++, _zm); }
  }
  for (const t of ZLIST) { t.im.count = t.ol.count = t.n; t.im.instanceMatrix.needsUpdate = t.ol.instanceMatrix.needsUpdate = true; if (t.im.instanceColor) t.im.instanceColor.needsUpdate = true; }
  LEGS.count = LEGS_OL.count = nl; LEGS.instanceMatrix.needsUpdate = LEGS_OL.instanceMatrix.needsUpdate = true; if (LEGS.instanceColor) LEGS.instanceColor.needsUpdate = true;
  BLOB.count = nb; BLOB.instanceMatrix.needsUpdate = true; DZ.drawn = nl / 2;
}

// ---------------- extra comic words (Toad City's comicText + halftone, same style as its FXT.words) ----------------
const FX2 = {}; for (const [k, w, fill] of [['splat', 'SPLAT!', '#9ae04a'], ['boom', 'BOOM!', '#ff8a3d'], ['chomp', 'CHOMP!', '#ff5f7a'], ['shove', 'SHOVE!', '#7fe8ff'], ['blam', 'BLAM!', '#ffd23c']])
  FX2[k] = canvasTex(512, 192, (c) => { c.fillStyle = INK; c.beginPath(); for (let i = 0; i < 28; i++) { const r = i % 2 ? 62 : 92, a = i / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 28; i++) { const r = i % 2 ? 54 : 82, a = i / 28 * TAU; c.lineTo(256 + Math.cos(a) * r * 2.5, 96 + Math.sin(a) * r * 0.95); } c.fill();
    halftone(c, 60, 20, 392, 152, 'rgba(120,200,80,.35)', 12, 4, 1); comicText(c, w, 256, 100, w.length > 5 ? 84 : 100, fill, null, { sx: 1 }); });
FX2.flash = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,210,60,.95)'); g.addColorStop(1, 'rgba(255,120,20,0)'); c.fillStyle = g; c.beginPath();
  for (let k = 0; k < 16; k++) { const r = k % 2 ? 26 : 62, a = k / 16 * TAU; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.fill(); });

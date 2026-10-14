
// ======================= TOAD CITY: DEAD STREETS (Brad via Hark, 2026-10-13: same exact Baltimore assets + code as Toad City Baltimore) =======================
// An on-foot twin-stick zombie horde run through Toad City's Inner Harbor: Harold (cane swapped for a pistol) and Mavis (purse) fight from
// W Pratt St past Light St and the World Trade Center to the water taxi at Broadway Pier, Fells Point.
// Everything above this file is copied verbatim from Toad City Baltimore (renderer, toon/cel material, ink hulls, city atlas + real-name signs,
// building()/lamp()/car()/hydrant()/bin()/tree() kit, HD builder HB + sign atlas, World Trade Center + Fells Point landmark builders,
// Harold / Mavis / thug rigs + poses, comic FX + sfx). These three files add the game: map + grid, the instanced horde, weapons, barricades,
// specials, the boss, HUD, input, procedural audio, and a test bot.
// Test params: ?bot=1 (autopilot) ?bot=lose (stands still) ?god=1 (no damage, test only) ?stage=N (start at checkpoint N) ?horde=N (perf: N zombies)

// lmHD(): Toad City's landmark registry, redefined to only store the builders (the copied WTC / Fells Point code calls it)
function lmHD(id, cx, cz, r, build) { (lmHD.defs || (lmHD.defs = {}))[id] = { id, cx, cz, r, build }; }
function lmMake(id) { // build a registered landmark (one toon mesh + ink hull + its canvas sign atlas), as 03b's lmHD did for the near LOD
  const D = lmHD.defs[id]; LMR(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1);
  const hb = new HB(), signs = [], sa = new SA(); D.build(hb, signs, sa); const g = hb.build();
  for (const s of signs) g.add(s.build(DECAL_MAT)); if (sa.items.length) g.add(sa.build()); return g;
}
function placeLM(g, cx, cz, zMax) { // move a landmark so its footprint centre sits at cx (and cz, or its south edge at zMax)
  g.updateMatrixWorld(true); let b = new THREE.Box3().setFromObject(g);
  g.position.x += cx - (b.min.x + b.max.x) / 2; g.position.z += zMax !== undefined ? zMax - b.max.z : cz - (b.min.z + b.max.z) / 2;
  g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); return b;
}

const DZ = window.__dz = { fps: 0, frames: 0, log: [], ready: false };
const GOD = Q.has('god'), FAST = Q.has('fast'); let BOTQ = Q.get('bot'); DZ.setBot = (m) => { BOTQ = m; };

// ---------------- the map: x runs east along Pratt St, z runs south toward the harbor (the camera looks north) ----------------
const GX0 = -24, GZ0 = -44, GWD = 330, GHT = 116; // grid: 1 m cells, x -24..306, z -44..72
const GN = GWD * GHT;
const GRID = new Uint8Array(GN); // 0 free, 1 wall, 2 water, 3 gate, 4 barricade
const BAR_AT = new Int16Array(GN).fill(-1);
const gi = (x, z) => { const i = Math.floor(x - GX0), j = Math.floor(z - GZ0); return i < 0 || j < 0 || i >= GWD || j >= GHT ? -1 : j * GWD + i; };
const cellX = (k) => (k % GWD) + GX0 + 0.5, cellZ = (k) => Math.floor(k / GWD) + GZ0 + 0.5;
function setRect(x0, z0, x1, z1, v) { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) { const k = gi(x + 0.5, z + 0.5); if (k >= 0) GRID[k] = v; } }
const solidAt = (x, z) => { const k = gi(x, z); return k < 0 || GRID[k] !== 0; };
const wallAt = (x, z) => { const k = gi(x, z); return k < 0 || GRID[k] === 1; };

const MAPX1 = 300, QUAY = 26, PLAZA_S = 40;
const XS = { eutaw: [26, 36], light: [90, 102], pres: [200, 210] };
const ALLEYS = [[60, 64], [140, 144], [236, 240]];
const PIER = { x0: 262, x1: 280, z0: QUAY, z1: 44 };
const TAXI_DOCK = { x: 271, z: 47.6 };
const GATES = [{ x: 114, z0: -12, z1: QUAY }, { x: 224, z0: -12, z1: QUAY }];
// barricade slots per stage (axis-aligned, one cell thick)
const SLOTS = [
  // hold 1: Pratt & Light (Light St north + Pratt west)
  { st: 1, x0: 90, x1: 96, z0: -14, z1: -13 }, { st: 1, x0: 96, x1: 102, z0: -14, z1: -13 },
  { st: 1, x0: 80, x1: 81, z0: -12, z1: -4 }, { st: 1, x0: 80, x1: 81, z0: -4, z1: 4 }, { st: 1, x0: 80, x1: 81, z0: 4, z1: 12 },
  // hold 2: President St (north) + Pratt / promenade west
  { st: 3, x0: 200, x1: 205, z0: -14, z1: -13 }, { st: 3, x0: 205, x1: 210, z0: -14, z1: -13 },
  { st: 3, x0: 186, x1: 187, z0: -12, z1: -4 }, { st: 3, x0: 186, x1: 187, z0: -4, z1: 4 }, { st: 3, x0: 186, x1: 187, z0: 4, z1: 12 },
  { st: 3, x0: 186, x1: 187, z0: 12, z1: 19 }, { st: 3, x0: 186, x1: 187, z0: 19, z1: 26 },
  // finale: the head of Broadway Pier
  { st: 5, x0: 262, x1: 268, z0: 26, z1: 27 }, { st: 5, x0: 268, x1: 274, z0: 26, z1: 27 }, { st: 5, x0: 274, x1: 280, z0: 26, z1: 27 },
];

function carveGrid() {
  GRID.fill(1);
  setRect(-22, -12, MAPX1, 12, 0); // Pratt St: road + both sidewalks
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres, ...ALLEYS]) setRect(a, -42, b, -12, 0); // cross streets + alleys north
  setRect(-22, 12, 90, PLAZA_S, 0); // the plaza south of W Pratt
  setRect(XS.light[0], 12, XS.light[1], QUAY, 0); // Light St down to the water
  setRect(102, 12, MAPX1, QUAY - 0.5, 0); // the promenade along the harbor
  setRect(90, QUAY, MAPX1 + 6, GZ0 + GHT, 2); // the harbor
  setRect(PIER.x0, PIER.z0 - 1, PIER.x1, PIER.z1, 0); // Broadway Pier
  // construction fences: keep the plaza out of the Pratt & Light hold
  setRect(70, 12, 90, 13, 1); setRect(89, 13, 90, PLAZA_S, 1);
}
carveGrid();

// ---------------- scene look: Toad City lights / fog / sky in a sick green dusk, getting darker stage by stage ----------------
applyQuality(true);
renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 }); sun.shadow.camera.updateProjectionMatrix();
const _ck = (a) => a.map((c) => new THREE.Color(c));
const PALZ = { // dusk -> night (Toad City's dusk palette pushed toward a sickly green)
  top: _ck(['#3a3d6e', '#141a34']), mid: _ck(['#a0687a', '#2e3a4e']), hor: _ck(['#e48a58', '#5a6a52']),
  fog: _ck(['#7d6a72', '#28323a']), hs: _ck(['#d8c8ff', '#8aa0d8']), hg: _ck(['#5a4a48', '#262a2e']), sun: _ck(['#ff9a58', '#9ab8ff']) };
const DIRZ = [new THREE.Vector3(-1, 0.42, -0.25).normalize(), new THREE.Vector3(0.6, 1.3, -0.5).normalize()];
function setLight(n) { // n: 0 dusk .. 1 night (moonlight)
  const c = (k, o) => o.copy(PALZ[k][0]).lerp(PALZ[k][1], n);
  c('top', SKY.U.top.value); c('mid', SKY.U.mid.value); c('hor', SKY.U.hor.value); SKY.U.uStars.value = n * 0.9;
  c('fog', scene.fog.color); FOGC.copy(scene.fog.color); renderer.setClearColor(scene.fog.color); scene.fog.near = 46; scene.fog.far = 150;
  OUT_U.fogC.value.copy(scene.fog.color); OUT_U.fogN.value = 46; OUT_U.fogF.value = 150;
  c('hs', hemi.color); c('hg', hemi.groundColor); hemi.intensity = lerp(1.55, 1.2, n); c('sun', sun.color); sun.intensity = lerp(1.9, 1.3, n);
  SUN_DIR.copy(DIRZ[0]).lerp(DIRZ[1], n).normalize(); SKY.sunS.position.copy(SUN_DIR).multiplyScalar(70); SKY.sunS.visible = n < 0.5; SKY.moonS.visible = n >= 0.5;
  if (n >= 0.5) SKY.moonS.position.copy(SUN_DIR).multiplyScalar(70);
  NIGHT.value = 0.45 + n * 0.5; // lit windows + glowing signs (the city atlas night layer)
}

// ---------------- helpers ----------------
function hullFromMB(mb) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mb.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.N, 3));
  addOdir(g); g.deleteAttribute('normal'); const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); return h; }
function kitMesh(fn) { // run a city-kit prop builder (car(), bin()...) into its own mesh at the origin
  const keep = CB.cap, mb = new MB(); CB.cap = mb; const nC = COLL.length, nB = BLD.length; fn(); CB.cap = keep; COLL.length = nC; BLD.length = nB;
  const g = new THREE.Group(), m = mb.build(CITY_MAT); m.castShadow = true; m.receiveShadow = true; g.add(m, hullFromMB(mb)); return g; }
// merge a list of primitive parts into one geometry (baked colours, odir for the ink hull): the instanced zombies + small props use these
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3();
function mergeGeo(parts) {
  const P = [], N = [], C = []; const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const p of parts) { let g = p.g.index ? p.g.toNonIndexed() : p.g; g.computeVertexNormals && !g.attributes.normal && g.computeVertexNormals();
    const r = p.r || [0, 0, 0], s = p.s || [1, 1, 1]; _pm.compose(_pv.set(p.x || 0, p.y || 0, p.z || 0), _pq.setFromEuler(_pe.set(r[0], r[1], r[2])), _ps.set(s[0], s[1], s[2])); nm.getNormalMatrix(_pm);
    const col = new THREE.Color(p.c), A = g.attributes;
    for (let i = 0; i < A.position.count; i++) { v.fromBufferAttribute(A.position, i).applyMatrix4(_pm); P.push(v.x, v.y, v.z); v.fromBufferAttribute(A.normal, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); C.push(col.r, col.g, col.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  addOdir(g); g.computeBoundingSphere(); return g;
}
function geoMesh(parts, mat) { // a merged prop: toon mesh + ink hull
  const g = mergeGeo(parts), m = new THREE.Mesh(g, mat || PROP_MAT); m.castShadow = true; const h = new THREE.Mesh(g, OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); m.add(h); return m; }
const PROP_MAT = toonMat();
const SIGN_TEX = (txt, bg, fg, w = 512, h = 128) => canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = H * 0.07; g.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16); sText(g, txt, W / 2, H / 2, W * 0.86, H * 0.62, SANS, fg); }, 512);

// ---------------- the city (built once): Toad City kit buildings with their real-name signs, streets, harbor, landmarks ----------------
const CITY = new THREE.Group(); scene.add(CITY);
const WATER_TEX = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2a6670'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(190,240,232,.6)'; c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const x = (i * 73) % w, y = (i * 47 + 13) % h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 16, y - 9, x + 32, y); c.stroke(); } }, 256);
WATER_TEX.wrapS = WATER_TEX.wrapT = THREE.RepeatWrapping; WATER_TEX.repeat.set(48, 18);
let WATER = null, FELLS_BB = null, WTC_BB = null;
const SPAWNS = []; // {x, z, k: 'edge' | 'water'}
const STREET_NAMES = [];
function buildCity() {
  CB = new CMB(); DB = new CMB(); GB = new CMB(); COLL.length = 0; BLD.length = 0; LAMPS.length = 0; SEED = 4242;
  const X0 = -24, X1 = MAPX1 + 30;
  // ground: Pratt St road, sidewalks + curbs, cross streets, plaza, promenade brick, the pier deck
  GB.floorSub(X0, -8, X1, 8, 0, T.road, '#fff', 4, 8);
  GB.floorSub(X0, -12, X1, -8, CURB, T.walk, '#fff', 3, 8); CB.wall(X1, -8, X0, -8, 0, CURB, T.white, '#8a8478');
  GB.floorSub(X0, 8, X1, 12, CURB, T.walk, '#fff', 3, 8); CB.wall(X0, 8, X1, 8, 0, CURB, T.white, '#8a8478');
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres]) { GB.floorSub(a + 1.5, -60, b - 1.5, -12, 0.005, T.road, '#fff', 4, 8); GB.floorSub(a, -60, a + 1.5, -12, CURB, T.walk, '#fff', 3, 8); GB.floorSub(b - 1.5, -60, b, -12, CURB, T.walk, '#fff', 3, 8);
    for (let x = a + 2; x < b - 2; x += 1.1) { CB.box(x, 0, -7.6, x + 0.55, 0.02, -5.4, '#ece8dc', T.white, {}); CB.box(x, 0, 5.4, x + 0.55, 0.02, 7.6, '#ece8dc', T.white, {}); } }
  for (const [a, b] of ALLEYS) GB.floorSub(a, -60, b, -12, 0.01, T.walk, '#9a948a', 3, 8);
  for (let x = X0; x < X1; x += 6) if (!(x > XS.light[0] - 3 && x < XS.light[1]) && !(x > XS.pres[0] - 3 && x < XS.pres[1]) && !(x > XS.eutaw[0] - 3 && x < XS.eutaw[1])) CB.box(x, 0, -0.08, x + 3, 0.02, 0.08, '#f0c840', T.white, {});
  GB.floorSub(X0, 12, 90, PLAZA_S, CURB, T.pave, '#d8d0c4', 4, 8); GB.floorSub(X0, PLAZA_S, 90, 90, CURB, T.grass, '#fff', 4, 10);
  GB.floorSub(XS.light[0] + 1.5, 12, XS.light[1] - 1.5, QUAY, 0.005, T.road, '#fff', 4, 8);
  GB.floorSub(102, 12, X1, QUAY, CURB, T.pave, '#fff', 4, 8);
  GB.floorSub(PIER.x0, PIER.z0, PIER.x1, PIER.z1, CURB + 0.02, T.pave, '#b08a62', 3, 6);
  // the quay wall + harbor railings (gap at Light St, the pier head)
  CB.wall(90, QUAY, X1, QUAY, WY - 0.3, CURB, T.white, '#8a8478');
  for (let x = 103; x < MAPX1 + 4; x += 2.5) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; CB.box(x - 0.06, CURB, QUAY - 0.42, x + 0.06, CURB + 1.0, QUAY - 0.3, '#2a2e36', T.white); }
  for (const [a, b] of [[102.5, PIER.x0 - 0.5], [PIER.x1 + 0.5, MAPX1 + 4]]) CB.box(a, CURB + 0.9, QUAY - 0.42, b, CURB + 1.0, QUAY - 0.3, '#2a2e36', T.white);
  // pier: pilings, side rails, the landing float
  for (let z = PIER.z0 + 1; z < PIER.z1; z += 3) for (const x of [PIER.x0 + 0.3, PIER.x1 - 0.3]) { CB.box(x - 0.25, WY - 0.4, z - 0.25, x + 0.25, CURB + 0.6, z + 0.25, '#5a4636', T.white); }
  for (const x of [PIER.x0 + 0.1, PIER.x1 - 0.1]) CB.box(x - 0.06, CURB + 0.85, PIER.z0 + 1, x + 0.06, CURB + 0.95, PIER.z1 - 0.5, '#5a4636', T.white);
  for (const x of [PIER.x0 + 0.1, PIER.x1 - 0.1]) for (let z = PIER.z0 + 1; z < PIER.z1; z += 2) CB.box(x - 0.06, CURB, z - 0.06, x + 0.06, CURB + 0.95, z + 0.06, '#5a4636', T.white);
  // north side of Pratt: blocks of Toad City buildings (storefronts + real-name shop signs on the street face), taller towers behind
  const blocks = [[-24, 26], [36, 60], [64, 90], [102, 140], [144, 200], [210, 236], [240, 306]];
  // Fells Point's Thames St block (real signs) closes the run at the east end, behind Broadway Pier
  const fells = lmMake('fells'); FELLS_BB = placeLM(fells, 271, 0, -12.4); CITY.add(fells);
  setRect(FELLS_BB.min.x, Math.max(FELLS_BB.min.z, -44), FELLS_BB.max.x, -12, 1);
  SEED = 77; let si = 0;
  for (const [a, b] of blocks) { let x = a;
    while (x < b - 0.5) { let w = Math.min(b - x, 9 + Math.floor(srnd() * 8)); if (b - (x + w) < 7) w = b - x;
      const x1 = x + w; const inFells = x1 > FELLS_BB.min.x - 0.5 && x < FELLS_BB.max.x + 0.5;
      if (!inFells) { const floors = 2 + Math.floor(srnd() * 4), shops = ['s']; if (x === a && a > -24) shops.push('w'); if (x1 === b && b < 306) shops.push('e');
        building(x, -12.4 - 10 - Math.floor(srnd() * 6), x1, -12.4, floors, Math.floor(srnd() * 6), { shops, sign: si++ % 8, v: srnd() < 0.5 ? 1 : 0, fire: srnd() < 0.3 ? 's' : undefined, fireAt: 0.75 }); }
      else if (x1 <= FELLS_BB.min.x - 0.5 || x >= FELLS_BB.max.x + 0.5) {}
      x = x1; } }
  SEED = 99; for (let x = -24; x < 300; x += 26) { if ([XS.eutaw, XS.light, XS.pres].some(([a, b]) => x < b && x + 22 > a)) continue; if (x + 22 > FELLS_BB.min.x && x < FELLS_BB.max.x) continue;
    building(x, -60, x + 22, -36, 5 + Math.floor(srnd() * 8), Math.floor(srnd() * 6), { ac: true, tower: srnd() < 0.3 ? [0.5, 0.5] : null }); }
  // the plaza south of W Pratt: trees, planters, benches, bus shelter, construction fence
  SEED = 5; for (let x = -16; x < 86; x += 9) for (const z of [17, 30]) { if (x > 66 && z === 17) continue; tree(x + srnd() * 2, z + srnd() * 2); setRect(x, z, x + 1, z + 1, 1); }
  for (let x = -12; x < 68; x += 18) { CB.box(x, CURB, 22.5, x + 4, CURB + 0.7, 24, '#8a7f74', T.white); GB.floorSub(x + 0.2, 22.7, x + 3.8, 23.8, CURB + 0.71, T.grass, '#fff', 2, 4); setRect(x, 22.5, x + 4, 24, 1); }
  CB.box(-24, CURB, PLAZA_S, 90, CURB + 0.9, PLAZA_S + 0.6, '#7a7068', T.white);
  // construction fence (chain-link panels drawn as dark posts + rails) around the Pratt & Light hold
  for (let x = 70; x <= 90; x += 2) CB.box(x - 0.06, CURB, 12.4, x + 0.06, CURB + 1.8, 12.6, '#3a3a40', T.white);
  CB.box(70, CURB + 1.6, 12.42, 90, CURB + 1.7, 12.58, '#3a3a40', T.white); CB.box(70, CURB + 0.2, 12.42, 90, CURB + 0.3, 12.58, '#3a3a40', T.white);
  for (let z = 13; z <= PLAZA_S; z += 2) CB.box(89.4, CURB, z - 0.06, 89.6, CURB + 1.8, z + 0.06, '#3a3a40', T.white);
  CB.box(89.42, CURB + 1.6, 12.5, 89.58, CURB + 1.7, PLAZA_S, '#3a3a40', T.white);
  // street furniture: lamps both sidewalks, traffic lights at the corners, bins + hydrants (all collide)
  for (let x = 4; x < MAPX1; x += 16) { if ([XS.eutaw, XS.light, XS.pres, ...ALLEYS].some(([a, b]) => x > a - 1.5 && x < b + 1.5)) continue; lampAt(x, -11.3, 0); setRect(x, -11.8, x + 1, -10.8, 1); }
  for (let x = 12; x < MAPX1; x += 16) { if (x > XS.light[0] - 1.5 && x < XS.light[1] + 1.5) continue; lampAt(x, 11.4, Math.PI); setRect(x, 10.9, x + 1, 11.9, 1); }
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres]) { trafficLight(a - 0.6, -11.4, 0); trafficLight(b + 0.6, 11.4, Math.PI); setRect(a - 1.1, -11.9, a - 0.1, -10.9, 1); setRect(b + 0.1, 10.9, b + 1.1, 11.9, 1); }
  SEED = 12; for (let x = 8; x < MAPX1 - 8; x += 13 + Math.floor(srnd() * 9)) { if ([XS.eutaw, XS.light, XS.pres, ...ALLEYS].some(([a, b]) => x > a - 2 && x < b + 2)) continue;
    const z = srnd() < 0.5 ? -9.4 : 9.4; if (srnd() < 0.5) bin(x, z, ['#22c4b4', '#3a5a3a', '#2a3a6a'][Math.floor(srnd() * 3)]); else hydrant(x, z); setRect(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 1); }
  // the promenade: trees in planters + benches + bollards
  SEED = 21; for (let x = 108; x < MAPX1; x += 14) { if (x > PIER.x0 - 3 && x < PIER.x1 + 3) continue; if (Math.abs(x - 205) < 7) continue;
    tree(x, 19.5); setRect(x - 0.5, 19, x + 0.5, 20, 1); CB.box(x + 3, CURB, 23.2, x + 5.4, CURB + 0.45, 23.8, '#6a4a34', T.white); setRect(x + 3, 23, x + 5.4, 24, 1); }
  // wrecked cars: the abandoned evacuation (city kit car(); block the cells under them)
  const WRECK = [['#a83a4a', '#d8d0c0'], ['#3a5a8a', '#2a3a5a'], ['#2a2a2e', '#1e1e22'], ['#5a7a4a', '#d8d0c0'], ['#d8a830', '#d8a830'], ['#e8e4dc', '#3a3a40'], ['#7a3a7a', '#d8d0c0']];
  const wrecks = [[18, -4.5, 1], [44, 3, 1], [55, -2.5, 0], [74, 5, 1], [122, -3.5, 1], [131, 4.5, 1], [158, -1, 0], [176, 3.5, 1], [192, -4.5, 1], [232, 2, 1], [248, -3.5, 1], [258, 4.5, 1], [10, 30, 1], [52, 34, 1]];
  wrecks.forEach(([x, z, along], i) => { const c = WRECK[i % WRECK.length]; car(x, z, along ? Math.PI / 2 : 0, c[0], c[1]); if (along) setRect(x - 2.2, z - 1, x + 2.2, z + 1, 1); else setRect(x - 1, z - 2.2, x + 1, z + 2.2, 1); });
  CITY.add(CB.build(CITY_MAT, { cast: true }), GB.build(CITY_MAT), DB.build(DECAL_MAT));
  // street-name blades at the corners (Toad City's sign atlas + sText) + the water taxi landing board
  const SN = new SA(); const blade = (x, z, ry, txt) => SN.at(x, CURB + 3.4, z, ry, 2.2, 0.42, (g, w, hh) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#f2efe6'; g.lineWidth = hh * 0.06; g.strokeRect(hh * 0.07, hh * 0.07, w - hh * 0.14, hh - hh * 0.14); sText(g, txt, w / 2, hh / 2, w * 0.86, hh * 0.62, SANS, '#f2efe6'); });
  for (const [k, nm] of [['eutaw', 'S EUTAW ST'], ['light', 'LIGHT ST'], ['pres', 'PRESIDENT ST']]) { const [a] = XS[k]; blade(a - 0.62, -11.3, 0, k === 'pres' ? 'E PRATT ST' : 'W PRATT ST'); blade(a - 0.52, -11.4, -Math.PI / 2, nm); }
  SN.at(PIER.x0 + 1.2, CURB + 2.6, PIER.z0 + 0.2, 0, 4.2, 0.9, (g, w, hh) => { g.fillStyle = '#1a3a6a'; g.fillRect(0, 0, w, hh); g.fillStyle = '#ffd23c'; g.fillRect(0, hh * 0.78, w, hh * 0.22); sText(g, 'BROADWAY PIER', w / 2, hh * 0.4, w * 0.9, hh * 0.56, SANS, '#f2efe6'); sText(g, 'WATER TAXI', w / 2, hh * 0.89, w * 0.5, hh * 0.2, SANS, '#14101f'); });
  CITY.add(SN.build());
  { const post = geoMesh([{ g: G.box(0.14, 2.6, 0.14), c: '#2a2a30', x: 0, y: 1.3 }, { g: G.box(0.14, 2.6, 0.14), c: '#2a2a30', x: 4, y: 1.3 }]); post.position.set(PIER.x0 + 1.2 - 2 + 2, CURB, PIER.z0 + 0.1); post.position.x = PIER.x0 + 1.2 - 2.1 + 0.05; CITY.add(post); }
  // the World Trade Center out on its pier (real wording + shape, Toad City's builder)
  const wtc = lmMake('wtc'); WTC_BB = placeLM(wtc, 154, 60); CITY.add(wtc);
  // harbor water
  WATER = new THREE.Mesh(new THREE.PlaneGeometry(420, 150), new THREE.MeshLambertMaterial({ map: WATER_TEX, color: '#b8e0dc' })); WATER.rotation.x = -Math.PI / 2; WATER.position.set(150, WY, QUAY + 75); WATER.receiveShadow = true; CITY.add(WATER);
  CITY.traverse((o) => { if (o.isMesh && o.material === CITY_MAT) o.receiveShadow = true; });
  // spawn points: road ends, cross-street + alley ends, the plaza edge; water climbers along the quay + the pier
  for (let z = -10; z <= 10; z += 2.5) SPAWNS.push({ x: -21, z, k: 'edge' });
  for (const [a, b] of [XS.eutaw, XS.light, XS.pres, ...ALLEYS]) for (let x = a + 1; x < b; x += 2.5) SPAWNS.push({ x, z: -40, k: 'edge' });
  for (let x = -18; x < 66; x += 7) SPAWNS.push({ x, z: PLAZA_S - 1.5, k: 'edge' });
  for (let z = 14; z < 38; z += 4) SPAWNS.push({ x: -21, z, k: 'edge' });
  for (let z = -10; z <= 24; z += 3) SPAWNS.push({ x: MAPX1 - 1, z, k: 'edge' });
  for (let x = 104; x < MAPX1; x += 2.6) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; SPAWNS.push({ x, z: QUAY - 0.9, k: 'water' }); }
  for (let z = PIER.z0 + 2; z < PIER.z1 - 1; z += 2.5) { SPAWNS.push({ x: PIER.x0 + 0.7, z, k: 'water' }); SPAWNS.push({ x: PIER.x1 - 0.7, z, k: 'water' }); }
}

// ---------------- flow fields: Dial's algorithm on the grid (barricades cost 8: the horde piles up on them instead of detouring) ----------------
const FIELD = new Uint16Array(GN), BOTF = new Uint16Array(GN);
const BK = []; for (let i = 0; i < 9; i++) BK.push([]);
function computeField(F, sx, sz, barCost) {
  F.fill(65535); const s = gi(sx, sz); if (s < 0) return; for (const q of BK) q.length = 0;
  F[s] = 0; BK[0].push(s); let cur = 0, pending = 1, guard = 0;
  while (pending > 0 && guard++ < 2e6) { const q = BK[cur % 9]; if (!q.length) { cur++; continue; }
    const c = q.pop(); pending--; const d = F[c]; if (d !== cur) continue; const col = c % GWD;
    for (let n4 = 0; n4 < 4; n4++) { const n = n4 === 0 ? (col > 0 ? c - 1 : -1) : n4 === 1 ? (col < GWD - 1 ? c + 1 : -1) : n4 === 2 ? c - GWD : c + GWD;
      if (n < 0 || n >= GN) continue; const v = GRID[n]; if (v === 1 || v === 2 || v === 3) continue; if (v === 4 && !barCost) continue;
      const nd = d + (v === 4 ? barCost : 1); if (nd < F[n]) { F[n] = nd; BK[nd % 9].push(n); pending++; } } }
}

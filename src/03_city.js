
// ---------------- merged city builder: one tiled-atlas mesh (+ decals) and one outline hull mesh ----------------
class MB {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.R = []; }
  vert(p, n, uv, c, tr) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(uv[0], uv[1]); this.C.push(c.r, c.g, c.b); this.R.push(tr[0], tr[1], tr[2], tr[3]); }
  // a b c d counter-clockwise seen from the front; uv = [u0, v0, u1, v1] in tile repeats
  quad(a, b, c, d, uv, col, tr) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; const n = [nx / l, ny / l, nz / l];
    const C = col instanceof THREE.Color ? col : new THREE.Color(col || '#fff'), t = tr || T.white;
    const [u0, v0, u1, v1] = uv || [0.02, 0.02, 0.98, 0.98];
    const A = [u0, v0], B = [u1, v0], Cc = [u1, v1], D = [u0, v1];
    this.vert(a, n, A, C, t); this.vert(b, n, B, C, t); this.vert(c, n, Cc, C, t);
    this.vert(a, n, A, C, t); this.vert(c, n, Cc, C, t); this.vert(d, n, D, C, t);
  }
  // wall from (xa,za) to (xb,zb), seen from the front with xa on the left
  wall(xa, za, xb, zb, y0, y1, tr, col, uv) { this.quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], uv, col, tr); }
  floor(x0, z0, x1, z1, y, tr, col, tileM = 4) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tileM, -z1 / tileM, x1 / tileM, -z0 / tileM], col, tr); }
  floorSub(x0, z0, x1, z1, y, tr, col, tileM = 4, cell = 4) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.floor(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), lerp(x0, x1, (i + 1) / nx), lerp(z0, z1, (j + 1) / nz), y, tr, col, tileM);
  }
  box(x0, y0, z0, x1, y1, z1, col, tr, opt = {}) {
    const t = tr || T.white, uv = opt.uv;
    this.wall(x0, z1, x1, z1, y0, y1, t, col, uv); this.wall(x1, z0, x0, z0, y0, y1, t, col, uv);
    this.wall(x1, z1, x1, z0, y0, y1, t, col, uv); this.wall(x0, z0, x0, z1, y0, y1, t, col, uv);
    if (opt.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], null, opt.topCol || col, opt.topTr || t);
    if (opt.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], null, col, t);
  }
  geom(g, col, tr, uvScale = 1) { // any BufferGeometry (already transformed), uv from the geometry
    g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; const C = new THREE.Color(col), t = tr || T.white;
    for (let i = 0; i < p.count; i++) {
      const u = uv ? [uv.getX(i) * uvScale * 0.96 + 0.02, uv.getY(i) * 0.96 + 0.02] : [0.5, 0.5];
      this.vert([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], u, C, t);
    }
  }
  build(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('tr', new THREE.Float32BufferAttribute(this.R, 4)); g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
class OB { // outlines are not used in the 32-bit look: kept as a no-op so the shared builders still run
  geom() {} box() {}
  build(mat) { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; return m; }
}
// Toad City: the city is big, so the merged builders are split into ~64 m chunks (each its own frustum-culled mesh).
// quad() / geom() route the whole primitive to the chunk under its first vertex.
const CHUNK = 64;
class CMB {
  constructor() { this.ch = new Map(); }
  at(x, z) { if (this.cap) return this.cap; const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); let m = this.ch.get(k); if (!m) this.ch.set(k, (m = new MB())); return m; }
  quad(a, b, c, d, uv, col, tr) { this.at(a[0], a[2]).quad(a, b, c, d, uv, col, tr); }
  wall(xa, za, xb, zb, y0, y1, tr, col, uv) { this.at((xa + xb) / 2, (za + zb) / 2).wall(xa, za, xb, zb, y0, y1, tr, col, uv); }
  floor(x0, z0, x1, z1, y, tr, col, tileM = 4) { this.at((x0 + x1) / 2, (z0 + z1) / 2).floor(x0, z0, x1, z1, y, tr, col, tileM); }
  floorSub(x0, z0, x1, z1, y, tr, col, tileM = 4, cell = 4) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.floor(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), lerp(x0, x1, (i + 1) / nx), lerp(z0, z1, (j + 1) / nz), y, tr, col, tileM);
  }
  box(x0, y0, z0, x1, y1, z1, col, tr, opt) { this.at((x0 + x1) / 2, (z0 + z1) / 2).box(x0, y0, z0, x1, y1, z1, col, tr, opt); }
  geom(g, col, tr, uvScale) { g.computeBoundingBox(); const b = g.boundingBox; this.at((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2).geom(g, col, tr, uvScale); }
  build(mat, o = {}) {
    const grp = new THREE.Group(); grp.userData.meshes = [];
    for (const m of this.ch.values()) { if (!m.P.length) continue; const mesh = m.build(mat); mesh.castShadow = !!o.cast; mesh.receiveShadow = true; grp.add(mesh); grp.userData.meshes.push(mesh); }
    return grp;
  }
}
const CB = new CMB(), DB = new CMB(), OL = new OB(), GB = new CMB(); // city, decals, outlines (no-op), ground (no shadow cast)
// LMCAP(id): route the city + decal builders into a per-landmark capture (that landmark's far LOD; 03b_landmarks_hd.js adds the HD near model); LMCAP(null) ends it
const LM_CAPS = {}; function LMCAP(id) { if (!id) { CB.cap = DB.cap = null; return; } LM_CAPS[id] = { cb: (CB.cap = new MB()), db: (DB.cap = new MB()) }; }
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- Toad City Baltimore: the Inner Harbor, real map compressed ~3x ----------------
// X east, Z south (north = -Z). The harbour basin + the Northwest Branch run east to the world edge; land ~2 blocks deep rings it.
// Blocks are 24 m with 10 m streets (period 34). A 6 m brick promenade runs along every water edge; piers / plazas jut into the water.
const CURB = 0.16, GF = 4.4, FH = 3.4, PAR = 1.3, WY = -0.85; // curb height, ground floor, floor height, parapet, water level
const WB = { x0: -136, x1: 213, z0: -106, z1: 104 }; // walkable world bounds
const BASIN = { x0: -60, x1: 400, z0: -30, z1: 30 }; // the water (runs off the east edge into the fog)
const PROM = 6; // promenade width
// land that juts into the water: [x0, x1, z0, z1, floor tile, seawall sides]
const PIERS = [
  { id: 'hp1', x0: -60, x1: -44, z0: -30, z1: -20, t: 'pave', w: 'se' },   // Harborplace (light st pavilion plaza)
  { id: 'hp2', x0: -60, x1: -50, z0: -20, z1: 4, t: 'pave', w: 'es' },     // Harborplace (pratt st side) along the west wall
  { id: 'p1', x0: -40, x1: -35, z0: -30, z1: -8, t: 'plank', w: 'wes' },   // USS Constellation pier
  { id: 'wtc', x0: -20, x1: -4, z0: -30, z1: -14, t: 'pave', w: 'wes' },   // World Trade Center
  { id: 'p3', x0: 6, x1: 32, z0: -30, z1: -4, t: 'pave', w: 'wes' },       // Aquarium (pier 3)
  { id: 'p4', x0: 44, x1: 68, z0: -30, z1: -4, t: 'pave', w: 'wes' },      // Power Plant (pier 4)
  { id: 'rec', x0: 110, x1: 142, z0: -30, z1: -18, t: 'plank', w: 'wes' }, // Pendry (recreation pier)
  { id: 'rash', x0: -42, x1: -21, z0: 19, z1: 30, t: 'pave', w: 'we' },     // lexington: Rash Field on the south shore (its north seawall is drawn in 03d_lexington.js)
];
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
function onPier(x, z) { for (const p of PIERS) if (inR(p, x, z)) return p; return null; }
function isWater(x, z) { return inR(BASIN, x, z) && !onPier(x, z); }
// landmark reservations (generic blocks inside are dropped) + generic blocks
const RES = [
  { x0: -136, x1: -76, z0: -36, z1: 36 },  // Oriole Park
  { x0: -136, x1: -76, z0: 46, z1: 106 },  // M&T Bank Stadium
  { x0: -32, x1: -8, z0: -104, z1: -80 },  // Washington Monument
  { x0: 70, x1: 94, z0: -70, z1: -46 },    // Four Seasons
  { x0: 138, x1: 162, z0: -70, z1: -46 },  // Fells Point market hall
  { x0: -66, x1: -42, z0: 46, z1: 70 },    // Science Center
  { x0: -32, x1: 26, z0: 46, z1: 72 },     // Federal Hill
  { x0: 70, x1: 94, z0: 46, z1: 70 },      // Domino Sugar
  { x0: 104, x1: 128, z0: 46, z1: 70 },    // Under Armour (Tide Point)
  { x0: 138, x1: 213, z0: 46, z1: 106 },   // Fort McHenry grounds
  { x0: -134, x1: -110, z0: -70, z1: -46 }, // lexington: Westminster Burying Ground (downtown-west district)
  { x0: -100, x1: -76, z0: -70, z1: -46 },  // lexington: Lexington Market
];
const BLOCKS = [];
{ const cols = []; for (let k = 0; k < 10; k++) cols.push(-134 + k * 34);
  for (const zr of [[-70, -46], [-104, -80], [46, 70], [80, 104]]) for (const x of cols) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
  for (const zr of [[-36, -6], [4, 36]]) for (const x of [-134, -100]) BLOCKS.push({ x0: x, x1: x + 24, z0: zr[0], z1: zr[1] });
}
const ovl = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const GEN = BLOCKS.filter((b) => !RES.some((r) => ovl(r, b)));
const PLOTS = GEN.concat(RES); // raised (curb height) ground
function isProm(x, z) { return !inR(BASIN, x, z) && x >= BASIN.x0 - PROM && z >= BASIN.z0 - PROM && z <= BASIN.z1 + PROM; }
// a coarse lookup grid for "is this a raised plot" (4 m cells)
const PG = new Map(); const pgk = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
for (const b of PLOTS) for (let x = Math.floor(b.x0 / 4); x * 4 < b.x1; x++) for (let z = Math.floor(b.z0 / 4); z * 4 < b.z1; z++) { const k = x + ',' + z; (PG.get(k) || PG.set(k, []).get(k)).push(b); }
function onPlot(x, z) { const a = PG.get(pgk(x, z)); if (a) for (const b of a) if (inR(b, x, z)) return b; return null; }
function isRoad(x, z) { return !inR(BASIN, x, z) && !isProm(x, z) && !onPlot(x, z); }
// Federal Hill: a real walkable mound (the ground height follows it)
const HILL = { x: -3, z: 59, rx: 28, rz: 13, h: 9 };
function hillH(x, z) { const d = Math.hypot((x - HILL.x) / HILL.rx, (z - HILL.z) / HILL.rz); if (d >= 1) return 0; const t = clamp((1 - d) / 0.8, 0, 1); return HILL.h * t * t * (3 - 2 * t); }
// raised walkable ground (Fort McHenry's north-bastion gun platform + its ramp): { x0, x1, z0, z1, h, rampZ? } rampZ = the z where a ramp side reaches 0
const RAMPS = [{ x0: 173.6, x1: 178.4, z0: 63.6, z1: 67.6, h: 3.3 }, { x0: 174.4, x1: 177.6, z0: 67.6, z1: 72.4, h: 3.3, ramp: [67.6, 72.4] }];
function rampH(x, z) { let h = 0; for (const r of RAMPS) { if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue; const v = r.ramp ? r.h * clamp(1 - (z - r.ramp[0]) / (r.ramp[1] - r.ramp[0]), 0, 1) : r.h; if (v > h) h = v; } return h; }
function groundY(x, z) { if (isWater(x, z)) return CURB; if (isRoad(x, z)) return 0; return CURB + hillH(x, z) + rampH(x, z); }

// ---------------- ground: streets, promenade, plots, piers, water, seawalls ----------------
(function ground() {
  // streets (y 0) over all land regions
  GB.floorSub(WB.x0 - 30, WB.z0 - 30, 240, BASIN.z0 - PROM, 0, T.road, '#fff', 6, 8);
  GB.floorSub(WB.x0 - 30, BASIN.z1 + PROM, 240, WB.z1 + 30, 0, T.road, '#fff', 6, 8);
  GB.floorSub(WB.x0 - 30, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z1 + PROM, 0, T.road, '#fff', 6, 8);
  // promenade (brick pavers) + its curb toward the street
  const prom = [[BASIN.x0 - PROM, BASIN.z0 - PROM, 240, BASIN.z0], [BASIN.x0 - PROM, BASIN.z1, 240, BASIN.z1 + PROM], [BASIN.x0 - PROM, BASIN.z0, BASIN.x0, BASIN.z1]];
  for (const [x0, z0, x1, z1] of prom) GB.floorSub(x0, z0, x1, z1, CURB, T.pave, '#fff', 3, 6);
  GB.wall(240, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z0 - PROM, 0, CURB, T.white, '#9a958c');
  GB.wall(BASIN.x0 - PROM, BASIN.z1 + PROM, 240, BASIN.z1 + PROM, 0, CURB, T.white, '#9a958c');
  GB.wall(BASIN.x0 - PROM, BASIN.z0 - PROM, BASIN.x0 - PROM, BASIN.z1 + PROM, 0, CURB, T.white, '#9a958c');
  // plots: sidewalk (or grass / cobbles for parks and the old waterfront) + curbs
  for (const b of PLOTS) {
    const fells = b.x0 >= 138 && b.x1 <= 200 && b.z1 < 0, park = RES.includes(b) && (b.x0 === -32 || b.x0 === 138 && b.z0 > 0);
    if (!(b.x0 === -32 && b.z0 === 46)) GB.floorSub(b.x0, b.z0, b.x1, b.z1, CURB, park ? T.grass : fells ? T.cobble : T.walk, '#fff', park ? 4 : 2, 6);
    GB.wall(b.x0, b.z1, b.x1, b.z1, 0, CURB, T.white, '#9a958c'); GB.wall(b.x1, b.z0, b.x0, b.z0, 0, CURB, T.white, '#9a958c');
    GB.wall(b.x1, b.z1, b.x1, b.z0, 0, CURB, T.white, '#9a958c'); GB.wall(b.x0, b.z0, b.x0, b.z1, 0, CURB, T.white, '#9a958c');
  }
  // piers + plazas
  for (const p of PIERS) GB.floorSub(p.x0, p.z0, p.x1, p.z1, CURB, T[p.t], '#fff', 3, 6);
  // seawalls (granite), facing the water
  const SWC = '#7a7468', yb = WY - 0.3;
  GB.wall(BASIN.x0, BASIN.z0, 240, BASIN.z0, yb, CURB, T.white, SWC); GB.wall(240, BASIN.z1, BASIN.x0, BASIN.z1, yb, CURB, T.white, SWC); GB.wall(BASIN.x0, BASIN.z1, BASIN.x0, BASIN.z0, yb, CURB, T.white, SWC);
  for (const p of PIERS) {
    if (p.w.includes('e')) GB.wall(p.x1, p.z1, p.x1, p.z0, yb, CURB, T.white, SWC);
    if (p.w.includes('w')) GB.wall(p.x0, p.z0, p.x0, p.z1, yb, CURB, T.white, SWC);
    if (p.w.includes('s')) GB.wall(p.x0, p.z1, p.x1, p.z1, yb, CURB, T.white, SWC);
  }
  // promenade edge: a low granite coping strip
  for (const [x0, z0, x1, z1] of [[BASIN.x0 - 0.1, BASIN.z0 - 0.35, 240, BASIN.z0], [BASIN.x0 - 0.1, BASIN.z1, 240, BASIN.z1 + 0.35], [BASIN.x0 - 0.35, BASIN.z0, BASIN.x0, BASIN.z1]]) DB.floor(x0, z0, x1, z1, CURB + 0.01, T.white, '#c8c2b4');
  // street paint: centre dashes on the two waterfront avenues (Pratt St / Key Hwy) and Light St
  const Y = new THREE.Color('#d8b040'), W = new THREE.Color('#d8d4c8');
  for (let x = -130; x < 212; x += 6) { DB.floor(x, -41.15, x + 3, -40.85, 0.012, T.white, Y); DB.floor(x, 40.85, x + 3, 41.15, 0.012, T.white, Y); }
  for (let z = -100; z < 102; z += 6) DB.floor(-71.15, z, -70.85, z + 3, 0.012, T.white, Y);
})();
// the water: one big plane (cel-lit, tinted by the day/night cycle)
const WATER = (function water() {
  const g = new THREE.PlaneGeometry(BASIN.x1 - BASIN.x0 + 20, BASIN.z1 - BASIN.z0 + 2, 1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, toonMat({ vertexColors: false, color: new THREE.Color('#2f6f86') }));
  m.position.set((BASIN.x0 + BASIN.x1) / 2, WY, 0); m.receiveShadow = true; scene.add(m);
  // sparkle stripes on the water (decal ribbons), drift handled in 07
  return m;
})();
// Federal Hill mound (faceted grass heightfield)
(function hill() {
  const x0 = -32, x1 = 26, z0 = 46, z1 = 72, c = 2, col = new THREE.Color('#fff');
  const Y = (x, z) => CURB + hillH(x, z) - 0.02;
  for (let x = x0; x < x1; x += c) for (let z = z0; z < z1; z += c) {
    const a = [x, Y(x, z + c), z + c], b = [x + c, Y(x + c, z + c), z + c], cc = [x + c, Y(x + c, z), z], d = [x, Y(x, z), z];
    GB.quad(a, b, cc, d, [x / 4, -(z + c) / 4, (x + c) / 4, -z / 4], col, T.grass);
  }
  // a path of steps up the north face and the flagpole on top
  const fp = new THREE.CylinderGeometry(0.12, 0.15, 12, 6); place(fp, HILL.x, CURB + HILL.h + 6, HILL.z); solid(fp, '#d8d8d0');
  const fl = new THREE.BoxGeometry(3.2, 1.9, 0.06); place(fl, HILL.x + 1.7, CURB + HILL.h + 10.9, HILL.z); CB.geom(fl, '#b03a3a', T.stripes);
  BLD.push({ x0: HILL.x - 8, x1: HILL.x + 8, z0: HILL.z - 4, z1: HILL.z + 4, h: CURB + HILL.h - 1 });
})();

// ---------------- generic blocks: 1-3 buildings per block, storefronts on every street face ----------------
const DOOR_AT = { x: -44.95, z: -58 }; // the kickable STAFF door (06b) sits on the east face of this block's building
function bld(x0, z0, x1, z1, fl, pal, o) { const h = building(x0, z0, x1, z1, fl, pal, o); COLL.push({ x0, x1, z0, z1 }); return h; }
SEED = 1234;
for (const b of GEN) {
  const ix0 = b.x0 + 3, ix1 = b.x1 - 3, iz0 = b.z0 + 3, iz1 = b.z1 - 3;
  const fells = b.x0 >= 138 && b.z1 < 0, hEast = b.x0 >= 36 && b.z1 < 0 && !fells, south = b.z0 > 0, nearWater = Math.abs(b.z0) < 50 && Math.abs(b.z1) < 75;
  const door = b.x0 === -66 && b.z0 === -70;
  const n = door ? 1 : 1 + Math.floor(srnd() * 3), alongZ = door || srnd() < 0.5;
  const cuts = [0]; for (let i = 1; i < n; i++) cuts.push(i / n + (srnd() - 0.5) * 0.12); cuts.push(1);
  for (let i = 0; i < n; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1];
    const x0 = alongZ ? ix0 : lerp(ix0, ix1, t0), x1 = alongZ ? ix1 : lerp(ix0, ix1, t1), z0 = alongZ ? lerp(iz0, iz1, t0) : iz0, z1 = alongZ ? lerp(iz0, iz1, t1) : iz1;
    const fl = fells ? 1 + Math.floor(srnd() * 2) : hEast ? 4 + Math.floor(srnd() * 5) : 2 + Math.floor(srnd() * (nearWater ? 5 : 4));
    const pal = fells ? [0, 2, 3][Math.floor(srnd() * 3)] : Math.floor(srnd() * PAL.length);
    const shops = alongZ ? ['e', 'w'].concat(i === 0 ? ['n'] : [], i === n - 1 ? ['s'] : []) : ['n', 's'].concat(i === 0 ? ['w'] : [], i === n - 1 ? ['e'] : []);
    const o = { shops: door ? ['n', 's', 'w'] : shops, sign: Math.floor(srnd() * 8), v: srnd() < 0.5 ? 1 : 0 };
    if (!fells && srnd() < 0.25) o.tower = [0.5, 0.5];
    if (!fells && fl >= 3 && srnd() < 0.18) o.fire = shops[0];
    bld(x0, z0, x1, z1, fl, pal, o);
  }
}
// skyline wall just beyond the walkable edge (cheap, no detail): keeps the fog from showing an empty world
SEED = 99;
for (let x = -170; x < 240; x += 34) { building(x, -132, x + 30, -110, 6 + Math.floor(srnd() * 8), Math.floor(srnd() * 6), { ac: false }); building(x, 108, x + 30, 130, 5 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (let z = -106; z < 106; z += 30) { if (z > -40 && z < 36) continue; building(-170, z, -140, z + 26, 6 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (const zr of [[-106, -38], [38, 106]]) for (let z = zr[0]; z < zr[1]; z += 22) building(216, z, 240, Math.min(z + 20, zr[1]), 4 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false });
building(-170, -40, -140, 36, 9, 1, { ac: false });
// ---------------- buildings ----------------
function building(x0, z0, x1, z1, floors, pi, o = {}) {
  const h = GF + floors * FH + PAR, p = PAL[pi], trim = new THREE.Color(p.trim), wall = new THREE.Color(p.wall);
  const fac = T.fac[pi][o.v || 0], store = T.store[pi];
  const faces = { s: [x0, z1, x1, z1], n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], w: [x0, z0, x0, z1] };
  for (const k in faces) {
    const [xa, za, xb, zb] = faces[k], L = Math.hypot(xb - xa, zb - za), nb = Math.max(1, Math.round(L / 3.6));
    const shop = o.shops && o.shops.includes(k);
    if (shop) CB.wall(xa, za, xb, zb, 0, GF, store, '#fff', [0, 0, nb, 0.995]);
    else CB.wall(xa, za, xb, zb, 0, GF, T.white, wall.clone().multiplyScalar(0.92));
    CB.wall(xa, za, xb, zb, GF, GF + floors * FH, fac, '#fff', [0, 0, nb, floors]);
    CB.wall(xa, za, xb, zb, GF + floors * FH, h, T.white, wall);
  }
  CB.floor(x0, z0, x1, z1, h - 0.6, T.roof, '#fff', 4);
  OL.box(x0, 0, z0, x1, h, z1);
  BLD.push({ x0, x1, z0, z1, h });
  // parapet lip + cornice + belt course (trim colour, outlined)
  const c = 0.28; sbox(x0 - c, h - 0.45, z0 - c, x1 + c, h, z1 + c, trim);
  sbox(x0 - 0.14, GF - 0.05, z0 - 0.14, x1 + 0.14, GF + 0.3, z1 + 0.14, trim);
  sbox(x0 - 0.1, GF + floors * FH - 0.05, z0 - 0.1, x1 + 0.1, GF + floors * FH + 0.22, z1 + 0.1, trim, false);
  // roof: inner parapet walls so the sunk roof reads, a few rooftop units
  CB.wall(x0 + 0.01, z1 - 0.01, x1 - 0.01, z1 - 0.01, h - 0.6, h, T.white, wall); // (only seen from above: cheap)
  if (o.ac !== false) {
    const ax = lerp(x0, x1, 0.3), az = lerp(z0, z1, 0.65);
    sbox(ax - 1, h - 0.6, az - 0.7, ax + 1, h + 0.7, az + 0.7, '#cfd3e6'); sbox(ax - 0.7, h + 0.7, az - 0.45, ax + 0.7, h + 0.85, az + 0.45, '#9da3c2');
  }
  // storefront awnings + shop signs on the street faces
  if (o.shops) for (const k of o.shops) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux; // outward normal
    const nb = Math.max(1, Math.round(L / 3.6)), bw = L / nb;
    const sg = T.signs[(o.sign + (k.charCodeAt(0) % 3)) % T.signs.length];
    // sign centred on the face, in the sign band
    const sw = Math.min(6.2, L - 1), sc = L / 2, off = 0.05;
    DB.wall(xa + ux * (sc - sw / 2) + nx * off, za + uz * (sc - sw / 2) + nz * off, xa + ux * (sc + sw / 2) + nx * off, za + uz * (sc + sw / 2) + nz * off, GF - 0.98, GF - 0.18, sg, '#fff', [0.002, 0.002, 0.998, 0.998]);
    // awnings over every other bay (skip the sign bay)
    for (let b = 0; b < nb; b++) {
      const m = (b + 0.5) * bw; if (Math.abs(m - sc) < sw / 2 + 0.2) continue; if ((b + (o.sign || 0)) % 2) continue;
      const len = bw - 0.5, depth = 1.25, g = new THREE.BoxGeometry(len, 0.12, depth);
      g.translate(0, 0, depth / 2); g.rotateX(0.38);
      const ang = Math.atan2(nx, nz);
      place(g, xa + ux * m + nx * 0.02, GF - 0.95, za + uz * m + nz * 0.02, ang);
      CB.geom(g, p.trim, T.stripes, 4); OL.geom(g);
    }
  }
  if (o.fire) fireEscape(faces[o.fire], floors, o.fireAt || 0.7);
  if (o.tower) waterTower(lerp(x0, x1, o.tower[0]), h - 0.6, lerp(z0, z1, o.tower[1]));
  if (o.bill) billboardOn(faces[o.bill[0]], h - 0.6, o.bill[1]);
  if (o.graf) for (const [k, at, gi, y = 0.4, s = 1] of o.graf) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux, w = 4.2 * s, m = at * L, off = 0.06;
    DB.wall(xa + ux * (m - w / 2) + nx * off, za + uz * (m - w / 2) + nz * off, xa + ux * (m + w / 2) + nx * off, za + uz * (m + w / 2) + nz * off, y, y + w / 2, T.graf[gi], '#fff', [0.002, 0.002, 0.998, 0.998]);
  }
  return h;
}
function fireEscape(face, floors, at) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = 3.6, d = 1.15, m = at * L, col = '#2a2622';
  const P = (s, t, y) => [xa + ux * s + nx * t, y, za + uz * s + nz * t];
  for (let f = 1; f <= floors; f++) {
    const y = GF + (f - 1) * FH + 0.02;
    // platform as an oriented box
    const g = new THREE.BoxGeometry(w, 0.1, d); place(g, P(m, d / 2, y)[0], y, P(m, d / 2, y)[2], Math.atan2(nx, nz)); CB.geom(g, col); OL.geom(g);
    // railings (front + sides), alpha-cut tile, double-sided decal
    const a = P(m - w / 2, d, y), b = P(m + w / 2, d, y), a0 = P(m - w / 2, 0.05, y), b0 = P(m + w / 2, 0.05, y);
    DB.quad(a, b, [b[0], y + 1.0, b[2]], [a[0], y + 1.0, a[2]], [0, 0, 3, 1], '#fff', T.rail);
    DB.quad(a0, a, [a[0], y + 1.0, a[2]], [a0[0], y + 1.0, a0[2]], [0, 0, 1, 1], '#fff', T.rail);
    DB.quad(b, b0, [b0[0], y + 1.0, b0[2]], [b[0], y + 1.0, b[2]], [0, 0, 1, 1], '#fff', T.rail);
    // stair to the next platform (diagonal)
    if (f < floors) { const s0 = f % 2 ? m - w / 2 + 0.2 : m + w / 2 - 0.2, s1 = f % 2 ? m + w / 2 - 1.0 : m - w / 2 + 1.0, t = 0.62;
      const q0 = P(s0, t - 0.35, y + 0.1), q1 = P(s1, t - 0.35, y + FH), q2 = P(s1, t + 0.35, y + FH), q3 = P(s0, t + 0.35, y + 0.1);
      DB.quad(q0, q3, q2, q1, [0, 0, 1, 4], '#fff', T.stair); }
    // drop ladder at the bottom
    if (f === 1) { const l0 = P(m + w / 2 - 0.6, d - 0.1, 1.6), l1 = P(m + w / 2 - 1.1, d - 0.1, 1.6);
      DB.quad(l0, l1, [l1[0], y, l1[2]], [l0[0], y, l0[2]], [0, 0, 1, 3], '#fff', T.stair); }
  }
}
function waterTower(x, y, z) {
  const legH = 2.6, r = 1.7, tankH = 2.9;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.1, 0.12, legH, 6); place(g, x + a * r * 0.62, y + legH / 2, z + b * r * 0.62); solid(g, '#2a2622'); }
  const cross = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross, x, y + legH * 0.55, z - r * 0.62); solid(cross, '#2a2622', false);
  const cross2 = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross2, x, y + legH * 0.55, z + r * 0.62); solid(cross2, '#2a2622', false);
  const tank = new THREE.CylinderGeometry(r, r * 1.04, tankH, 18, 1); place(tank, x, y + legH + tankH / 2, z); solid(tank, '#7a5a3a');
  for (const k of [0.25, 0.7]) { const band = new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.14, 18, 1, true); place(band, x, y + legH + tankH * k, z); CB.geom(band, '#2a2622'); }
  const roof = new THREE.ConeGeometry(r * 1.12, 1.25, 18); place(roof, x, y + legH + tankH + 0.62, z); solid(roof, '#4a3a2a');
  const knob = new THREE.SphereGeometry(0.16, 8, 6); place(knob, x, y + legH + tankH + 1.3, z); solid(knob, '#ffd23c');
  BLD.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: y + legH + tankH + 1.3, y0: y });
}
function billboardOn(face, y, bi) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = Math.min(9, L - 1.5), hh = w / 2, m = L / 2, inset = 1.6, base = y + 1.6;
  const P = (s, t, yy) => [xa + ux * s - nx * t, yy, za + uz * s - nz * t];
  const ang = Math.atan2(nx, nz);
  for (const s of [m - w * 0.35, m + w * 0.35]) { const g = new THREE.BoxGeometry(0.22, base - y + 0.2, 0.22); const p = P(s, inset + 0.3, (y + base) / 2); place(g, p[0], p[1], p[2], ang); solid(g, '#2a2622'); }
  const back = new THREE.BoxGeometry(w + 0.5, hh + 0.5, 0.3); const pc = P(m, inset + 0.15, base + hh / 2); place(back, pc[0], pc[1], pc[2], ang); solid(back, '#2a2622');
  const a = P(m - w / 2, inset - 0.02, base), b = P(m + w / 2, inset - 0.02, base);
  CB.quad(a, b, [b[0], base + hh, b[2]], [a[0], base + hh, a[2]], [0.003, 0.003, 0.997, 0.997], '#fff', T.bill[bi]);
  // catwalk + lamps
  const cw = new THREE.BoxGeometry(w * 0.9, 0.08, 0.7); const pw = P(m, inset - 0.4, base - 0.1); place(cw, pw[0], pw[1], pw[2], ang); solid(cw, '#2a2622');
  for (const s of [m - w * 0.3, m + w * 0.3]) { const g = new THREE.BoxGeometry(0.5, 0.18, 0.3); const p = P(s, inset - 0.7, base + hh + 0.35); place(g, p[0], p[1], p[2], ang, 0.5); solid(g, '#ffd23c'); }
}

// ---------------- street props ----------------
function lamp(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.11, 0.15, 5.2, 6); place(g, x, CURB + 2.6, z); solid(g, '#2c322e');
  const arm = new THREE.BoxGeometry(0.12, 0.12, 1.6); arm.translate(0, 0, 0.8); place(arm, x, CURB + 5.1, z, ang); solid(arm, '#2c322e');
  const head = new THREE.CylinderGeometry(0.18, 0.42, 0.32, 6); place(head, x + Math.sin(ang) * 1.6, CURB + 4.95, z + Math.cos(ang) * 1.6); solid(head, '#5a5a4a');
  COLL.push({ x, z, r: 0.3 });
}
function trafficLight(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 8); place(g, x, CURB + 2.8, z); solid(g, '#ffd23c');
  const arm = new THREE.BoxGeometry(0.14, 0.14, 4.2); arm.translate(0, 0, 2.1); place(arm, x, CURB + 5.4, z, ang); solid(arm, '#ffd23c');
  const hx = x + Math.sin(ang) * 3.6, hz = z + Math.cos(ang) * 3.6;
  const box = new THREE.BoxGeometry(0.5, 1.4, 0.45); place(box, hx, CURB + 4.6, hz, ang); solid(box, '#2a2622');
  const px = Math.cos(ang), pz = -Math.sin(ang);
  ['#ff3d6e', '#ffd23c', '#7dff6b'].forEach((c, i) => { for (const sd of [-1, 1]) { const l = new THREE.SphereGeometry(0.14, 10, 8); place(l, hx + px * 0.24 * sd, CURB + 5.05 - i * 0.43, hz + pz * 0.24 * sd); CB.geom(l, c); } });
  COLL.push({ x, z, r: 0.3 });
}
function hydrant(x, z) {
  const b = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10); place(b, x, CURB + 0.35, z); solid(b, '#a8302a');
  const t = new THREE.SphereGeometry(0.22, 8, 4, 0, TAU, 0, Math.PI / 2); place(t, x, CURB + 0.7, z); solid(t, '#a8302a');
  const n = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8); place(n, x, CURB + 0.45, z, 0, 0, Math.PI / 2); solid(n, '#ffd23c');
  COLL.push({ x, z, r: 0.35 });
}
function bin(x, z, col = '#22c4b4') {
  const b = new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12); place(b, x, CURB + 0.48, z); solid(b, col);
  const l = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12); place(l, x, CURB + 1.0, z); solid(l, '#2a2622');
  COLL.push({ x, z, r: 0.45 });
}
function dumpster(x, z, ang) {
  const g = new THREE.BoxGeometry(2.4, 1.3, 1.3); g.translate(0, 0.65, 0); place(g, x, CURB, z, ang); solid(g, '#2f5a3a');
  const l = new THREE.BoxGeometry(2.5, 0.12, 1.4); l.rotateX(-0.12); l.translate(0, 1.36, 0); place(l, x, CURB, z, ang); solid(l, '#1f3a2a');
  const s = Math.abs(Math.sin(ang)) > 0.5; COLL.push(s ? { x0: x - 0.7, x1: x + 0.7, z0: z - 1.25, z1: z + 1.25 } : { x0: x - 1.25, x1: x + 1.25, z0: z - 0.7, z1: z + 0.7 });
}
function car(x, z, ang, body, roofC) {
  const grp = []; const along = Math.abs(Math.sin(ang)) > 0.5; // along x
  const add = (g, col, ol = true) => { place(g, x, 0, z, ang); solid(g, col, ol); };
  const b = new THREE.BoxGeometry(1.9, 0.75, 4.3); b.translate(0, 0.72, 0); add(b, body);
  const c = new THREE.BoxGeometry(1.7, 0.7, 2.2); c.translate(0, 1.45, -0.2); add(c, roofC || body);
  const wF = new THREE.BoxGeometry(1.5, 0.48, 0.05); wF.translate(0, 1.47, 0.9); add(wF, '#6a8a9a', false);
  const wB = new THREE.BoxGeometry(1.5, 0.48, 0.05); wB.translate(0, 1.47, -1.31); add(wB, '#6a8a9a', false);
  for (const s of [-1, 1]) { const ws = new THREE.BoxGeometry(0.05, 0.46, 1.8); ws.translate(s * 0.86, 1.47, -0.2); add(ws, '#6a8a9a', false); }
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2a2622'); }
  const hl = new THREE.BoxGeometry(1.5, 0.18, 0.06); hl.translate(0, 0.86, 2.16); add(hl, '#efe4b0', false);
  const tl = new THREE.BoxGeometry(1.5, 0.16, 0.06); tl.translate(0, 0.86, -2.16); add(tl, '#ff3d6e', false);
  COLL.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1.0, z1: z + 1.0 } : { x0: x - 1.0, x1: x + 1.0, z0: z - 2.2, z1: z + 2.2 });
  BLD.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1, z1: z + 1, h: 1.8 } : { x0: x - 1, x1: x + 1, z0: z - 2.2, z1: z + 2.2, h: 1.8 });
}
// street furniture along the one block

// ---------------- landmark massings (Phase 1 placeholders: boxes / simple solids, ORIGINAL generic signs only) ----------------
const faceOf = (x0, z0, x1, z1, k) => ({ s: [x0, z1, x1, z1], n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], w: [x0, z0, x0, z1] })[k];
function mass(x0, z0, x1, z1, h, o = {}) {
  const y0 = o.y0 || CURB, col = new THREE.Color(o.col || '#fff');
  for (const k of ['s', 'n', 'e', 'w']) {
    const [xa, za, xb, zb] = faceOf(x0, z0, x1, z1, k), L = Math.hypot(xb - xa, zb - za);
    if (o.tr) CB.wall(xa, za, xb, zb, y0, y0 + h, o.tr, col, [0, 0, Math.max(1, Math.round(L / (o.bay || 3.6))), Math.max(1, Math.round(h / (o.fh || FH)))]);
    else CB.wall(xa, za, xb, zb, y0, y0 + h, T.white, col);
  }
  CB.quad([x0, y0 + h, z1], [x1, y0 + h, z1], [x1, y0 + h, z0], [x0, y0 + h, z0], null, new THREE.Color(o.top || '#6a665e'), T.white);
  if (o.trim !== false) sbox(x0 - 0.25, y0 + h - 0.35, z0 - 0.25, x1 + 0.25, y0 + h + 0.05, z1 + 0.25, o.trimCol || '#c9c2b0');
  if (o.coll !== false) COLL.push({ x0, x1, z0, z1 });
  BLD.push({ x0, x1, z0, z1, h: y0 + h, y0: o.y0 || 0 });
}
function signOn(x0, z0, x1, z1, k, y, w, tr, hh = w / 4) {
  const [xa, za, xb, zb] = faceOf(x0, z0, x1, z1, k), dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux, m = L / 2, off = 0.09;
  DB.wall(xa + ux * (m - w / 2) + nx * off, za + uz * (m - w / 2) + nz * off, xa + ux * (m + w / 2) + nx * off, za + uz * (m + w / 2) + nz * off, y, y + hh, tr, '#fff', [0.002, 0.002, 0.998, 0.998]);
}
function obox(cx, cz, len, th, h, ang, col, y0 = CURB) { const g = new THREE.BoxGeometry(len, h, th); g.translate(0, h / 2, 0); place(g, cx, y0, cz, ang); solid(g, col); }
function pole(x, z, h, r = 0.15, col = '#d8d8d0', y0 = CURB) { const g = new THREE.CylinderGeometry(r * 0.8, r, h, 6); place(g, x, y0 + h / 2, z); solid(g, col); COLL.push({ x, z, r: r + 0.15 }); }
// stepped grandstand along one side of a field: rows rise away from the field
function stand(x0, z0, x1, z1, h, away, col) {
  const n = 4; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = 1;
    const r = away === 'w' ? [lerp(x1, x0, t1), z0, lerp(x1, x0, t0), z1] : away === 'e' ? [lerp(x0, x1, t0), z0, lerp(x0, x1, t1), z1] : away === 'n' ? [x0, lerp(z1, z0, t1), x1, lerp(z1, z0, t0)] : [x0, lerp(z0, z1, t0), x1, lerp(z0, z1, t1)];
    CB.box(r[0], CURB, r[1], r[2], CURB + h * (i + 1) / n, r[3], i % 2 ? col : new THREE.Color(col).multiplyScalar(0.85), T.white); }
  COLL.push({ x0, x1, z0, z1 }); BLD.push({ x0, x1, z0, z1, h: CURB + h });
}
const LANDMARKS = [];
function landmark(id, name, x, z, r, boss) { LANDMARKS.push({ id, name, x, z, r, boss }); }

LMCAP('harborplace');
// Harborplace: two glassy market pavilions with green hip roofs, on plazas at the harbour's north-west corner
// (far LOD of the HD pavilions in 03c: eave slab top 6.85 m, copper-green hip roofs ~2.7 m)
for (const [x0, z0, x1, z1] of [[-58, -29, -46, -22], [-59, -18, -52, 2]]) {
  mass(x0, z0, x1, z1, 6.85, { tr: T.store[4], fh: 3.4, bay: 2.5, top: '#93bfa2', trimCol: '#ddd5c4' });
  const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale((x1 - x0) * 0.75, 2.7, (z1 - z0) * 0.75); place(g, (x0 + x1) / 2, CURB + 6.85 + 1.35, (z0 + z1) / 2); solid(g, '#93bfa2');
}
signOn(-58, -29, -46, -22, 'n', 3.0, 8, LSIGN.market); signOn(-59, -18, -52, 2, 'e', 3.0, 8, LSIGN.market);
LMCAP(null);
landmark('harborplace', 'HARBORPLACE', -52, -24, 16, { name: 'The Chip Kid', x: -50, z: -31.2, duel: 'chipkid' }); // The Chip Kid (replaced Dragon Boat Duchess, now a roaming boat-ride boss): mech duel, 09_duels.js
LMCAP('constellation');
// USS Constellation: a three-masted sloop-of-war moored beside its pier
(function ship() {
  const x0 = -33.6, x1 = -28.4, z0 = -27, z1 = -9.5, cx = (x0 + x1) / 2;
  CB.box(x0, WY - 0.4, z0, x1, CURB + 1.6, z1, '#22201e', T.white);
  CB.box(x0 - 0.02, CURB + 0.4, z0 - 0.02, x1 + 0.02, CURB + 0.9, z1 + 0.02, '#e8e0c8', T.white, { top: false });
  CB.box(x0 + 0.25, CURB + 1.6, z0 + 0.3, x1 - 0.25, CURB + 1.75, z1 - 0.3, '#8a6a48', T.white);
  for (let z = z0 + 1.2; z < z1 - 0.8; z += 1.6) for (const x of [x0 - 0.04, x1 - 0.01]) CB.box(x, CURB + 0.5, z, x + 0.05, CURB + 0.8, z + 0.5, '#111', T.white); // gunports in the white band
  CB.box(x0 + 0.01, WY - 0.2, z0 + 0.01, x1 - 0.01, WY + 0.25, z1 - 0.01, '#5ec4a4', T.white, { top: false }); // copper bottom at the waterline
  const bow = new THREE.CylinderGeometry(0.01, (x1 - x0) / 2, 4, 3, 1); bow.rotateX(-Math.PI / 2); bow.rotateZ(Math.PI); place(bow, cx, CURB + 0.6, z0 - 1.9); solid(bow, '#22201e');
  const spr = new THREE.CylinderGeometry(0.08, 0.14, 7.4, 5); spr.rotateX(-1.25); place(spr, cx, CURB + 3.4, z0 - 4.6); solid(spr, '#3a2a1a');
  for (const [z, h] of [[-23.5, 20], [-18, 23], [-12.5, 17]]) {
    const m = new THREE.CylinderGeometry(0.16, 0.26, h, 6); place(m, cx, CURB + 1.7 + h / 2, z); solid(m, '#3a2a1a');
    for (const k of [0.45, 0.7, 0.9]) { const y = new THREE.CylinderGeometry(0.08, 0.08, 8 * (1.1 - k), 5); y.rotateZ(Math.PI / 2); place(y, cx, CURB + 1.7 + h * k, z); solid(y, '#3a2a1a'); }
  }
  BLD.push({ x0, x1, z0, z1, h: CURB + 1.75 });
})();
LMCAP(null);
landmark('constellation', 'USS CONSTELLATION', -31, -18, 17, { name: 'Captain Cobblestone', x: -31, z: -18, y: CURB + 1.75 });
LMCAP('wtc');
// World Trade Center: a tall pentagonal tower on its own pier
(function wtc() {
  const cx = -12, cz = -22.5, r = 6.6, h = 62;
  // refs: regular pentagon, alternating full-height bands of tan precast and dark window strips, slightly recessed top floor
  const g = new THREE.CylinderGeometry(r, r, h, 5, 1); place(g, cx, CURB + h / 2, cz, 0.3); solid(g, '#bba98a');
  const V = []; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; V.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  for (let i = 0; i < 5; i++) { const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 5], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax), nx = (az - bz) / L, nz = (bx - ax) / L;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, o = (mx - cx) * nx + (mz - cz) * nz > 0 ? 1 : -1;
    for (const t of [0.2, 0.4, 0.6, 0.8]) obox(lerp(ax, bx, t) + nx * o * 0.06, lerp(az, bz, t) + nz * o * 0.06, 0.9, 0.12, h - 4, ang, '#232a33', CURB + 2.5); }
  const top = new THREE.CylinderGeometry(r - 0.5, r - 0.5, 3, 5); place(top, cx, CURB + h + 1.5, cz, 0.3); solid(top, '#2f3a46');
  const cap = new THREE.CylinderGeometry(r - 0.2, r - 0.2, 0.6, 5); place(cap, cx, CURB + h + 3.3, cz, 0.3); solid(cap, '#c9c2b0');
  COLL.push({ x: cx, z: cz, r: r - 0.4 }); BLD.push({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, h: CURB + h });
  signOn(cx - 4.5, cz - r, cx + 4.5, cz + r * 0.8, 's', 4.2, 8, LSIGN.trade);
})();
LMCAP(null);
landmark('wtc', 'WORLD TRADE CENTER', -12, -22, 14, { name: 'The Penthouse Pigeon', x: -12, z: -22.5, y: CURB + 63 });
LMCAP('aquarium');
// National Aquarium on pier 3 (far LOD of the HD model in 03c, same AQ footprints): concrete block + navy box + glass pyramid, red Australia wing,
// south block, the concrete drum, the Pratt St glass entrance
mass(11, -26, 23, -13, 15, { col: '#b2ab9e', top: '#8e8a82', trimCol: '#9a9387' });
sbox(12, CURB + 15, -25, 22, CURB + 17.6, -14, '#26376c', false);
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(10 / Math.SQRT2, 7.2, 11 / Math.SQRT2); place(g, 17, CURB + 17.6 + 3.6, -19.5); solid(g, '#86bccb'); }
mass(7.5, -26, 11, -17, 8, { col: '#b5332b', top: '#3d6fa6', trimCol: '#8a2420' });
sbox(7.6, CURB + 8, -25.9, 11, CURB + 11.5, -17.1, '#3d6fa6', false);
mass(11, -13, 18, -7.5, 5.5, { tr: T.glass, fh: 5.5, top: '#8e8a82' });
{ const g = new THREE.CylinderGeometry(4.6, 4.6, 11, 16); place(g, 22, CURB + 5.5, -11); solid(g, '#b2ab9e'); COLL.push({ x: 22, z: -11, r: 4.6 }); BLD.push({ x0: 17.4, x1: 26.6, z0: -15.6, z1: -6.4, h: CURB + 11 }); }
mass(13, -28.2, 21, -26, 4.5, { tr: T.glass, fh: 4.5, top: '#d8d6d0' });
signOn(11, -26, 23, -13, 'n', CURB + 6.7, 8.4, LSIGN.aqua);
LMCAP(null);
landmark('aquarium', 'NATIONAL AQUARIUM', 19, -17, 19, { name: 'Big Jimmy', x: 19, z: -5, water: true, duel: 'jimmy' }); // underwater swim fight, 09_duels.js (entered at the aquarium door)
LMCAP('powerplant');
// Power Plant complex on pier 4 (far LOD): three joined buildings - the Harbor Crab House homage (west), the Power Plant hall + tower + four black stacks (centre), the Amp House cafe (east, original homage signage);
// footprints / heights match the HD model's PP table in 03b (exterior_2 read at x 0.0188 m/px, y 0.038 m/px)
mass(44.8, -27, 52.13, -9.5, 11.6, { tr: T.fac[0][0], top: '#4a3a30' });
mass(52.13, -27, 59.0, -8.8, 15.4, { tr: T.fac[0][1], top: '#2e3036' });
mass(59.0, -25.5, 67.55, -9.3, 12.3, { tr: T.fac[0][1], top: '#4a3a30' });
sbox(53.3, CURB + 15.4, -12.6, 58.2, CURB + 17.9, -8.9, '#a9502f', false); sbox(54.5, CURB + 17.9, -12, 57, CURB + 19.6, -9.1, '#a9502f', false);
for (const [i, z] of [-13.2, -16.6, -20, -23.4].entries()) { const g = new THREE.CylinderGeometry(1.0, 1.08, 9, 10); place(g, 57.6 + i * 0.35, CURB + 22, z); solid(g, '#1f1d1c'); } // the four black stacks, a north-south row
sbox(55.15, CURB + 20.3, -10.3, 56.35, CURB + 29.4, -10.1, '#1e2a4a', false); sbox(55.55, CURB + 21.0, -10.35, 55.95, CURB + 28.7, -10.05, '#ffd23c', false); // homage: the AMP HOUSE blade sign (was a real trademark guitar)
sbox(44.6, CURB + 8.9, -27.2, 67.7, CURB + 9.4, -8.6, '#e4d8bc');
signOn(52.13, -27, 59.0, -8.8, 's', 12.0, 5, LSIGN.power);
LMCAP(null);
landmark('powerplant', 'POWER PLANT', 56, -17, 19, { name: 'Voltage Vic', x: 56, z: -5.5 });
// HARBOR EAST GRAND (homage hotel; id fourseasons): a podium and a glass hotel tower
mass(71, -69, 93, -47, 9, { tr: T.store[1], fh: 9, bay: 4, top: '#4a4640' });
mass(75, -66, 89, -52, 52, { tr: T.glass, y0: CURB + 9, fh: 3.6, top: '#2a3644', coll: false });
signOn(71, -69, 93, -47, 's', 9.6, 12, LSIGN.hotel);
landmark('fourseasons', 'HARBOR EAST GRAND', 82, -58, 20, { name: 'Chef Crabcake', x: 82, z: -42 });
// Pendry: the long recreation-pier building with a clock tower and a rooftop pool deck
mass(112, -29, 140, -21.5, 9, { tr: T.fac[5][1], top: '#6a6056' });
mass(124, -28, 128, -23, 10, { col: '#c4b090', y0: CURB + 9, coll: false });
{ const g = new THREE.CylinderGeometry(0.01, 2.9, 3, 4); g.rotateY(Math.PI / 4); place(g, 126, CURB + 19 + 1.5, -25.5); solid(g, '#4f6a5a'); }
CB.box(130, CURB + 9, -27.5, 138, CURB + 9.05, -23, '#4ac8e0', T.white); // rooftop pool
signOn(112, -29, 140, -21.5, 's', 4.6, 10, LSIGN.pier);
landmark('pendry', 'PENDRY', 126, -25, 17, { name: 'The Pool Shark', x: 126, z: -19.5 });
// Fells Point: low brick rowhouses (generic blocks) round a market hall on cobbles
mass(141, -64, 159, -52, 6, { tr: T.fac[2][0], top: '#5a4a3a' });
{ const g = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); g.rotateY(Math.PI / 4); g.scale(14, 2.2, 9.5); place(g, 150, CURB + 6 + 1.1, -58); solid(g, '#5a3a2a'); }
signOn(141, -64, 159, -52, 's', 3.2, 9, LSIGN.fells);
landmark('fells', 'FELLS POINT', 160, -56, 24, { name: 'Arabber Al', x: 167, z: -58 });
// Washington Monument: a marble column on a plinth in a green square (Mount Vernon, pulled in to the north edge)
(function monument() {
  const cx = -20, cz = -92;
  CB.floor(-32, -93.5, -8, -90.5, CURB + 0.01, T.pave, '#fff', 3); CB.floor(-21.5, -104, -18.5, -80, CURB + 0.012, T.pave, '#fff', 3);
  sbox(cx - 4, CURB, cz - 4, cx + 4, CURB + 1.2, cz + 4, '#d8d2c4'); sbox(cx - 3, CURB + 1.2, cz - 3, cx + 3, CURB + 5.5, cz + 3, '#e4ded0');
  const c = new THREE.CylinderGeometry(1.2, 1.5, 40, 12); place(c, cx, CURB + 5.5 + 20, cz); solid(c, '#ece6d8');
  sbox(cx - 1.8, CURB + 45.5, cz - 1.8, cx + 1.8, CURB + 46.3, cz + 1.8, '#d8d2c4');
  const s = new THREE.CylinderGeometry(0.5, 0.7, 3.2, 8); place(s, cx, CURB + 46.3 + 1.6, cz); solid(s, '#7a8a6a');
  COLL.push({ x0: cx - 4, x1: cx + 4, z0: cz - 4, z1: cz + 4 }); BLD.push({ x0: cx - 4, x1: cx + 4, z0: cz - 4, z1: cz + 4, h: CURB + 5.5 });
})();
landmark('monument', 'WASHINGTON MONUMENT', -20, -92, 16, { name: 'The Stoop Scrubber', x: -20, z: -84 });
// Oriole Park: the long brick warehouse on the east side, a horseshoe of stands round the field, light towers
(function ballpark() {
  CB.floor(-124, -26, -92, 26, CURB + 0.012, T.grass, '#fff', 4);
  { const d = new THREE.CylinderGeometry(7, 7, 0.02, 16); place(d, -100, CURB + 0.02, 0); CB.geom(d, '#b0784a'); }
  stand(-134, -34, -124, 34, 14, 'w', '#3a5a3a'); stand(-124, -34, -96, -26, 11, 'n', '#3a5a3a'); stand(-124, 26, -96, 34, 11, 's', '#3a5a3a');
  mass(-88, -34, -80, 34, 22, { tr: T.fac[0][1], top: '#4a3a30' });
  signOn(-88, -34, -80, 34, 'e', 15, 16, LSIGN.ball);
  for (const [x, z] of [[-128, -30], [-128, 30], [-98, -30], [-98, 30]]) { pole(x, z, 26, 0.35, '#3a3a3a'); sbox(x - 2, CURB + 26, z - 0.5, x + 2, CURB + 28.5, z + 0.5, '#e8e4d0'); }
})();
landmark('orioles', 'ORIOLE PARK', -100, 0, 34, { name: 'Bird Brain Bobby', x: -91.5, z: 0 });
// M&T Bank Stadium: a big closed bowl with an entrance gap on the east side
(function stadium() {
  CB.floor(-124, 56, -88, 96, CURB + 0.012, T.grass, '#fff', 4);
  for (let z = 60; z < 94; z += 6) CB.floor(-122, z, -90, z + 0.35, CURB + 0.02, T.white, '#f0f0e8');
  const C = '#4a3f6a';
  stand(-134, 48, -124, 104, 22, 'w', C); stand(-124, 48, -80, 56, 20, 'n', C); stand(-124, 96, -80, 104, 20, 's', C);
  stand(-88, 56, -80, 70, 20, 'e', C); stand(-88, 82, -80, 96, 20, 'e', C);
  signOn(-88, 56, -80, 70, 'e', 14, 10, LSIGN.stad); signOn(-88, 82, -80, 96, 'e', 14, 10, LSIGN.stad);
})();
landmark('ravens', 'M&T BANK STADIUM', -106, 76, 32, { name: 'The Raven King', x: -106, z: 76 });
LMCAP('science');
// Maryland Science Center (far LOD of the HD model in 03c, same MSC footprints): brick block + towers + observatory dome (east), glass box, brick sign panel,
// glass stair tower, the curved glass drum, the west glass box, the silver wing behind
mass(-51, 52, -42.5, 69, 12, { tr: T.fac[2][0], top: '#5a4a3a' });
mass(-56, 57, -51, 69, 12, { tr: T.fac[2][1], top: '#5a4a3a' });
mass(-50.5, 47, -43, 52, 10, { tr: T.glass, fh: 1.7, bay: 1.4, top: '#d4d8dc' });
mass(-53.2, 48, -50.5, 57, 13.2, { col: '#7a3b2b', top: '#5a4a3a' });
mass(-54.5, 47.8, -53.2, 49.4, 15.2, { tr: T.glass, fh: 1.9, top: '#f2f2ee' });
mass(-66, 47.6, -62, 57, 8.6, { tr: T.glass, fh: 2, bay: 1.3, top: '#ecece8' });
mass(-66, 57, -56, 69, 11, { col: '#b4bac0', top: '#c4c8cc' });
for (const [x, z, w, h] of [[-50.8, 52.2, 2.6, 16.2], [-45.2, 52.6, 2.4, 15.4], [-50.6, 62.5, 2.4, 15.8], [-44.6, 64.8, 2.6, 16.6]]) sbox(x, CURB + 12, z, x + w, CURB + h, z + w, '#86442f', false);
{ const g = new THREE.CylinderGeometry(5.6, 5.6, 9.6, 18); place(g, -57.6, CURB + 4.8, 55); solid(g, '#3f6f9a'); COLL.push({ x: -57.6, z: 55, r: 5.6 }); BLD.push({ x0: -63.2, x1: -52, z0: 49.4, z1: 60.6, h: CURB + 12.6 });
  const u = new THREE.CylinderGeometry(4.5, 4.5, 3, 16); place(u, -57.6, CURB + 11.1, 55); solid(u, '#5d7f9c');
  const d = new THREE.SphereGeometry(2.05, 12, 6, 0, TAU, 0, Math.PI / 2); place(d, -46.8, CURB + 13.2, 60.5); solid(d, '#f2f2f0'); }
signOn(-53.2, 48, -50.5, 57, 'n', CURB + 9.4, 2.6, LSIGN.sci, 1.1);
LMCAP(null);
landmark('science', 'SCIENCE CENTER', -54, 58, 16, { name: 'Dr. Shellacious', x: -54, z: 41 });
landmark('fedhill', 'FEDERAL HILL', -3, 59, 24, { name: 'The Hon Queen', x: HILL.x, z: HILL.z, y: CURB + HILL.h });
const DOM_H = 23; // refinery roof height (the sign stands on it; HD model in 03b uses the same)
LMCAP('domino');
// HARBOR SUGAR CO. (homage refinery; id domino): a tall refinery with a giant rooftop neon sign facing the harbour (original lettering)
mass(72, 48, 92, 66, DOM_H, { tr: T.fac[1][0], top: '#4a4640' });
{ const g = new THREE.CylinderGeometry(3.4, 3.4, 22, 12); place(g, 76, CURB + 11, 69); solid(g, '#c8c4b8'); COLL.push({ x: 76, z: 69, r: 3.6 }); }
// the rooftop sign's open steel lattice (the sign faces itself are drawn in i_nightfx): verticals, three chords, X-bracing, back struts
{ const C = '#3a3532', y0 = CURB + DOM_H, zf = 50.05;
  for (let k = 0; k <= 8; k++) obox(73 + k * 2.25, zf, 0.26, 0.26, 13.2, 0, C, y0);
  for (const y of [1.6, 7.1, 12.6]) obox(82, zf, 18.6, 0.26, 0.26, 0, C, y0 + y);
  for (let k = 0; k < 8; k++) for (const [ya, yb] of [[1.6, 7.1], [7.1, 12.6]]) for (const s of [1, -1]) {
    const xa = 73 + k * 2.25, xb = xa + 2.25, L = Math.hypot(2.25, yb - ya), g = new THREE.BoxGeometry(L, 0.1, 0.1); g.rotateZ(s * Math.atan2(yb - ya, 2.25)); place(g, (xa + xb) / 2, y0 + (ya + yb) / 2, zf + 0.05); solid(g, C, false); }
  for (const x of [73, 79.75, 84.25, 91]) { const g = new THREE.BoxGeometry(0.2, 0.2, 6.2); g.rotateX(-0.95); place(g, x, y0 + 2.6, zf + 2.2); solid(g, C, false); } }
LMCAP(null);
landmark('domino', 'HARBOR SUGAR CO.', 82, 57, 16, { name: 'Sugar Rush', x: 82, z: 57, y: CURB + DOM_H });
// SWEATFORGE PIER (homage gear campus at Tide Point; id underarmour): brick halls with a clock tower
mass(106, 48, 126, 56, 11, { tr: T.fac[0][0], top: '#4a3a30' }); mass(106, 60, 126, 68, 11, { tr: T.fac[0][1], top: '#4a3a30' });
mass(113.5, 56.5, 118.5, 59.5, 22, { col: '#9a5a44', top: '#4a3a30' });
signOn(106, 48, 126, 56, 'n', 7.6, 10, LSIGN.ath);
landmark('underarmour', 'SWEATFORGE PIER', 116, 52, 16, { name: 'The Compression King', x: 116, z: 43 });
// Fort McHenry: a five-point star fort on grass at the tip of Locust Point, with the flag
(function fort() {
  const cx = 176, cz = 78, R = 17, r = 10.5, V = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; V.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  for (let i = 0; i < 10; i++) {
    if (i === 5) continue; // the sally port (gap facing the city)
    const [ax, az] = V[i], [bx, bz] = V[(i + 1) % 10], L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    obox((ax + bx) / 2, (az + bz) / 2, L + 1.2, 2.4, 4.2, ang, '#a89878');
    for (let t = 0; t <= 1.001; t += 1.6 / L) COLL.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t), r: 1.3 });
    BLD.push({ x0: Math.min(ax, bx) - 1, x1: Math.max(ax, bx) + 1, z0: Math.min(az, bz) - 1, z1: Math.max(az, bz) + 1, h: CURB + 4.2 });
  }
  sbox(cx - 6, CURB, cz - 3, cx + 3, CURB + 3.2, cz + 1, '#b8a888'); COLL.push({ x0: cx - 6, x1: cx + 3, z0: cz - 3, z1: cz + 1 });
  // the north bastion gun platform (walkable: RAMPS in f_layout) with a ramp up from the parade ground, and the cannon the set piece starts from
  sbox(173.6, CURB, 63.6, 178.4, CURB + 3.3, 67.6, '#b8a888');
  for (let k = 0; k < 6; k++) { const z0 = 67.6 + k * 0.8; sbox(174.4, CURB, z0, 177.6, CURB + 3.3 * (1 - k / 6), z0 + 0.8, k % 2 ? '#a89878' : '#b0a080', k === 0); }
  { const g = new THREE.CylinderGeometry(0.2, 0.3, 2.6, 8); g.rotateX(Math.PI / 2 - 0.12); place(g, 176, CURB + 4.05, 64.5); solid(g, '#26262a');
    sbox(175.45, CURB + 3.3, 64.6, 176.55, CURB + 3.85, 66.0, '#5a3a22');
    for (const sx of [175.3, 176.7]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10); w.rotateZ(Math.PI / 2); place(w, sx, CURB + 3.64, 65.6); solid(w, '#3a2a1a', false); }
    for (let k = 0; k < 4; k++) { const b = new THREE.SphereGeometry(0.17, 6, 4); place(b, 177.4 + (k % 2) * 0.32, CURB + 3.47 + (k > 1 ? 0.27 : 0), 66.4 + (k === 3 ? 0.16 : 0)); solid(b, '#1a1a1e', false); } }
  pole(cx + 5, cz + 4, 24, 0.2);
  const fl = new THREE.BoxGeometry(7, 4.2, 0.08); place(fl, cx + 8.6, CURB + 21.6, cz + 4); CB.geom(fl, '#b03a3a', T.stripes);
  const ca = new THREE.BoxGeometry(2.6, 2.2, 0.1); place(ca, cx + 6.4, CURB + 22.6, cz + 4.01); CB.geom(ca, '#2a3a7a');
})();
landmark('fort', 'FORT MCHENRY', 176, 78, 26, { name: 'Admiral Redclaw', x: 176, z: 80 });
// a few parked cars (vaultable in 06b) along the avenues
const CARS = [[-74.2, -16, false, '#a83a4a', '#d8d0c0'], [-74.2, 20, false, '#3a5a8a', '#2a3a5a'], [-22, -44.2, true, '#d8a830', '#d8a830'], [42, -44.2, true, '#5a7a4a', '#d8d0c0'],
  [52, 44.2, true, '#a83a4a', '#d8d0c0'], [-30, 44.2, true, '#3a5a8a', '#2a3a5a'], [34.2, -60, false, '#d8a830', '#d8a830'], [170.2, -60, false, '#7a3a7a', '#d8d0c0']];
for (const [x, z, ax, b, r] of CARS) car(x, z, ax ? Math.PI / 2 : 0, b, r);

// ---------------- promenade furniture: lamps (water side) + trees (land side) ----------------
const LAMPS = [];
function lampAt(x, z, ang) { lamp(x, z, ang); LAMPS.push({ x: x + Math.sin(ang) * 1.6, z: z + Math.cos(ang) * 1.6, y: CURB + 4.8, px: x, pz: z }); }
function tree(x, z) {
  const t = new THREE.CylinderGeometry(0.14, 0.2, 3.0, 6); place(t, x, CURB + 1.5, z); solid(t, '#5a4030');
  const c = new THREE.IcosahedronGeometry(1.25, 0); place(c, x, CURB + 3.9, z, x * 0.37); solid(c, '#4f7f3a');
  COLL.push({ x, z, r: 0.35 });
}
const clearOfPier = (x) => !PIERS.some((p) => x > p.x0 - 2 && x < p.x1 + 2);
for (let x = -52; x < 212; x += 18) if (clearOfPier(x)) { lampAt(x, BASIN.z0 - 0.9, Math.PI); }
for (let x = -52; x < 212; x += 18) lampAt(x, BASIN.z1 + 0.9, 0);
for (let z = 10; z < 28; z += 16) lampAt(BASIN.x0 - 0.9, z, -Math.PI / 2);
for (let x = -34; x < 212; x += 18) { tree(x, BASIN.z0 - 4.8); tree(x, BASIN.z1 + 4.8); }
for (let z = -22; z < 28; z += 16) tree(BASIN.x0 - 4.6, z);
// street lamps on the avenue corners (Pratt St / Key Hwy / Light St)
for (let x = -110; x < 212; x += 34) { lampAt(x - 0.6, -46.6, Math.PI); lampAt(x - 0.6, 46.6, 0); }
for (const z of [-30, 0, 30]) lampAt(-76.6, z, -Math.PI / 2);
const LADDER = { x: 999, z: 999, top: 0, roofY: 0 }; // kept for shared code paths (no climbable fire escape yet)

// ---------------- build the chunked meshes ----------------
const cityMesh = CB.build(CITY_MAT, { cast: true }); scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);
// collider lookup: 16 m cells, every collider listed in each cell it touches (+1.5 m margin)
const COLLG = new Map(); const cgk = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
for (const c of COLL) {
  const x0 = (c.r !== undefined ? c.x - c.r : c.x0) - 1.5, x1 = (c.r !== undefined ? c.x + c.r : c.x1) + 1.5, z0 = (c.r !== undefined ? c.z - c.r : c.z0) - 1.5, z1 = (c.r !== undefined ? c.z + c.r : c.z1) + 1.5;
  for (let i = Math.floor(x0 / 16); i <= Math.floor(x1 / 16); i++) for (let j = Math.floor(z0 / 16); j <= Math.floor(z1 / 16); j++) { const k = i + ',' + j; (COLLG.get(k) || COLLG.set(k, []).get(k)).push(c); }
}
const NOCOLL = [];
function collAt(x, z) { return COLLG.get(cgk(x, z)) || NOCOLL; }
// sky dome (inside the short draw distance): gradient + stars at night, a sun / moon disc, a few low-res clouds; recoloured by the cycle
const SKY = (function sky() {
  const U = { top: { value: new THREE.Color('#4a86c8') }, mid: { value: new THREE.Color('#9cc4dc') }, hor: { value: new THREE.Color('#d8dccf') }, uStars: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform float uStars; varying vec3 vP;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
        vec3 q = floor(vP * 160.0); float s = step(0.996, h3(q)) * smoothstep(0.12, 0.4, y);
        c += vec3(0.9, 0.92, 1.0) * s * uStars;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(190, 16, 10), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s); window.__sky = s;
  const disc = (inner, outer, glow) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(0.55, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); };
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#fffbe8', '#ffe9a0', 'rgba(255,220,140,.35)'), fog: false, depthWrite: false, transparent: true }));
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#f4f6ff', '#d8e0f0', 'rgba(180,200,255,.25)'), fog: false, depthWrite: false, transparent: true }));
  sunS.scale.set(34, 34, 1); moonS.scale.set(19, 19, 1); sunS.renderOrder = moonS.renderOrder = -9; s.add(sunS, moonS);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 32; const c = cc.getContext('2d'); c.fillStyle = '#fff';
  [[16, 22, 10], [28, 16, 12], [42, 18, 10], [52, 23, 7]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(8, 22, 50, 8);
  const ct = lowTex(cc, 64), clouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true })); const a = i / 7 * TAU + 0.3, r = 165;
    sp.position.set(Math.cos(a) * r, 48 + (i % 3) * 18, Math.sin(a) * r); sp.scale.set(60 + (i % 2) * 22, 28 + (i % 2) * 8, 1); sp.renderOrder = -9; s.add(sp); clouds.push(sp);
  }
  return { U, sunS, moonS, clouds };
})();


// ---------------- night lights: instanced lamp glow pools + lamp-head halos (2 draw calls for every lamp), 4 pooled point lights
// that hop to the lamps nearest the hero, and the HARBOR SUGAR CO. rooftop neon sign (original homage lettering) ----------------
const NIGHTFX = { pools: [], halos: [], lights: [], neon: null, near: null };
(function nightFx() {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(0.5, 'rgba(255,130,40,.55)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 32); })();
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,80,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); })();
  const pm = basicSnap({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const pg = new THREE.PlaneGeometry(7.5, 7.5); pg.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(pg, pm, LAMPS.length); pools.renderOrder = 2;
  const hm = new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
  const hg = new THREE.PlaneGeometry(2.6, 2.6);
  const halos = new THREE.InstancedMesh(hg, hm, LAMPS.length); halos.renderOrder = 3;
  const m4 = new THREE.Matrix4();
  LAMPS.forEach((L, i) => { m4.makeTranslation(L.x, groundY(L.x, L.z) + 0.03, L.z); pools.setMatrixAt(i, m4); m4.makeTranslation(L.x, L.y - 0.1, L.z); halos.setMatrixAt(i, m4); });
  pools.frustumCulled = halos.frustumCulled = false; scene.add(pools, halos); NIGHTFX.pools.push(pools); NIGHTFX.halos.push(halos);
  // the halo quads turn to face the camera (cheap: one shared rotation for all instances via onBeforeRender)
  halos.onBeforeRender = () => { halos.quaternion.identity(); };
  hm.onBeforeCompile = (sh) => { // billboard each instance in the vertex shader
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
      vec4 ic = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 mvPosition = viewMatrix * ic; mvPosition.xy += position.xy;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  for (let i = 0; i < 4; i++) { const pl = new THREE.PointLight('#ffa050', 0, 15, 1.3); scene.add(pl); NIGHTFX.lights.push(pl); }
  NIGHTFX.near = (x, z) => { // move the 4 point lights to the 4 lamps nearest (x, z)
    const s = LAMPS.map((L) => [(L.x - x) ** 2 + (L.z - z) ** 2, L]).sort((a, b) => a[0] - b[0]);
    NIGHTFX.lights.forEach((pl, i) => { const L = s[i][1]; pl.position.set(L.x, L.y - 0.6, L.z); });
  };
  // HARBOR SUGAR CO.: an original two-line homage sign ("Harbor" script over "SUGAR CO.", rounded box border) on its open steel lattice, facing the harbour
  // (homage pass 2026-10-13 replaced the earlier real-brand lettering; the frame, colours and neon behaviour are unchanged).
  // Drawn on canvas (script/italic fonts + strokes), no photo or logo file. Day: gold letters on the open frame. Night: red-orange neon with a glowing
  // box outline, a red point light and a red reflection streak across the water. Two planes cross-fade (day / night).
  function dominoTex(night) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d'); g.clearRect(0, 0, 1024, 640);
    const RED = '#ff3a1c', CORE = '#ffc2a6', GOLD = '#f0b440', GOLD2 = '#b87a22', INKG = '#4a2e0c';
    const glow = (b) => { g.shadowColor = night ? '#ff2a10' : 'rgba(0,0,0,0)'; g.shadowBlur = night ? b : 0; };
    // rounded box border (double line like the tubes)
    g.lineJoin = 'round'; rrect(g, 34, 34, 956, 572, 64);
    if (night) { glow(34); g.strokeStyle = RED; g.lineWidth = 20; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 5; g.stroke(); }
    else { g.strokeStyle = INKG; g.lineWidth = 24; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 15; g.stroke(); }
    const word = (txt, x, y, font, slant, fillW) => { g.save(); g.translate(x, y); g.transform(1, 0, -slant, 1, 0, 0); g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (night) { glow(30); g.fillStyle = RED; g.fillText(txt, 0, 0, fillW); g.lineWidth = 9; g.strokeStyle = RED; g.strokeText(txt, 0, 0, fillW); glow(0); g.lineWidth = 3.5; g.strokeStyle = CORE; g.strokeText(txt, 0, 0, fillW); }
      else { const gr = g.createLinearGradient(0, -200, 0, 20); gr.addColorStop(0, '#ffd877'); gr.addColorStop(0.55, GOLD); gr.addColorStop(1, GOLD2); g.lineWidth = 12; g.strokeStyle = INKG; g.strokeText(txt, 0, 0, fillW); g.fillStyle = gr; g.fillText(txt, 0, 0, fillW); }
      g.restore(); };
    word('Harbor', 512, 330, 'italic 900 318px "Brush Script MT", "Snell Roundhand", "Apple Chancery", Georgia, "Times New Roman", "DejaVu Serif", serif', 0.16, 900);
    // the swash under "Harbor" (a hand-drawn tail sweeping back from the o)
    g.save(); g.beginPath(); g.moveTo(170, 372); g.bezierCurveTo(360, 410, 650, 404, 880, 346); g.lineCap = 'round';
    if (night) { glow(26); g.strokeStyle = RED; g.lineWidth = 15; g.stroke(); glow(0); g.strokeStyle = CORE; g.lineWidth = 4; g.stroke(); } else { g.strokeStyle = INKG; g.lineWidth = 20; g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 11; g.stroke(); }
    g.restore();
    word('SUGAR CO.', 516, 555, 'bold 150px Georgia, "Times New Roman", "DejaVu Serif", serif', 0.02, 600);
    return lowTex(c, 256);
  }
  const SW = 17, SH = 10.6, SX = 82, SY = CURB + DOM_H + 7.1, SZ = 49.7;
  const dayMat = basicSnap({ map: dominoTex(false), transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02 });
  const mat = basicSnap({ map: dominoTex(true), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
  const signD = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), dayMat); signD.position.set(SX, SY, SZ); signD.rotation.y = Math.PI; signD.renderOrder = 4; scene.add(signD);
  const signN = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat); signN.position.set(SX, SY, SZ - 0.04); signN.rotation.y = Math.PI; signN.renderOrder = 5; scene.add(signN);
  // red reflection streak across the water toward the north shore (rippled bands)
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 512; const sg = sc.getContext('2d'); sg.clearRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 6) { const a = Math.min(1, (1 - y / 512) ** 1.1 * (0.7 + 0.5 * srnd())), w = 64 * (0.5 + 0.5 * srnd()) * (1 - y / 900); sg.fillStyle = `rgba(255,${50 + (srnd() * 40) | 0},20,${a.toFixed(3)})`; sg.fillRect(32 - w / 2, y, w, 3 + srnd() * 3); }
  const stex = lowTex(sc, 64);
  const smat = basicSnap({ map: stex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, opacity: 0 });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(11, 52), smat); streak.rotation.x = -Math.PI / 2; streak.position.set(SX, WY + 0.04, 29.6 - 26); streak.renderOrder = 3; scene.add(streak);
  const nl = new THREE.PointLight('#ff3a2a', 0, 36, 1.2); nl.position.set(SX, CURB + DOM_H + 7, 43); scene.add(nl);
  NIGHTFX.neon = { mat, dayMat, light: nl, streak, tint: (on, fl) => { mat.opacity = Math.min(1, on * 1.15) * fl; dayMat.opacity = 1 - sstep(0.15, 0.85, on); smat.opacity = on * fl; streak.visible = on > 0.02; } };
})();

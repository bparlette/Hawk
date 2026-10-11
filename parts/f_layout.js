
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
function groundY(x, z) { if (isWater(x, z)) return CURB; if (isRoad(x, z)) return 0; return CURB + hillH(x, z); }

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
  const abTake = abTakes(b); if (abTake) AB_BLOCKS.push(b); // Task A rowhouse blocks replace the generic fill here (02c_taskab.js); the random draws below still run so the kept blocks are unchanged
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
    if (!abTake) bld(x0, z0, x1, z1, fl, pal, o);
  }
}
// skyline wall just beyond the walkable edge (cheap, no detail): keeps the fog from showing an empty world
SEED = 99;
for (let x = -170; x < 240; x += 34) { building(x, -132, x + 30, -110, 6 + Math.floor(srnd() * 8), Math.floor(srnd() * 6), { ac: false }); building(x, 108, x + 30, 130, 5 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (let z = -106; z < 106; z += 30) { if (z > -40 && z < 36) continue; building(-170, z, -140, z + 26, 6 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false }); }
for (const zr of [[-106, -38], [38, 106]]) for (let z = zr[0]; z < zr[1]; z += 22) building(216, z, 240, Math.min(z + 20, zr[1]), 4 + Math.floor(srnd() * 6), Math.floor(srnd() * 6), { ac: false });
building(-170, -40, -140, 36, 9, 1, { ac: false });

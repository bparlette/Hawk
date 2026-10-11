
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

// ---------------- Task A/B: rowhouse blocks, street props, parked cars (02c_taskab.js), spread over frames while loading ----------------
if (AB.CURB !== CURB || AB.GF !== GF || AB.FH !== FH) throw new Error('taskAB K constants out of sync');
await abBuildCity();
// ---------------- build the chunked meshes ----------------
const cityMesh = CB.build(CITY_MAT, { cast: true }); scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);
abBuildLayers();
// collider lookup: 16 m cells, every collider listed in each cell it touches (+1.5 m margin)
const COLLG = new Map(); const cgk = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
for (const c of COLL) {
  const x0 = (c.r !== undefined ? c.x - c.r : c.x0) - 1.5, x1 = (c.r !== undefined ? c.x + c.r : c.x1) + 1.5, z0 = (c.r !== undefined ? c.z - c.r : c.z0) - 1.5, z1 = (c.r !== undefined ? c.z + c.r : c.z1) + 1.5;
  for (let i = Math.floor(x0 / 16); i <= Math.floor(x1 / 16); i++) for (let j = Math.floor(z0 / 16); j <= Math.floor(z1 / 16); j++) { const k = i + ',' + j; (COLLG.get(k) || COLLG.set(k, []).get(k)).push(c); }
}
const NOCOLL = [];
function collAt(x, z) { return COLLG.get(cgk(x, z)) || NOCOLL; }

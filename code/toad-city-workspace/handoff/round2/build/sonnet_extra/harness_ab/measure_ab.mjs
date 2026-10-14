// Independent review harness for Sonnet Task A/B (node, no browser). Builds every asset against
// (a) the delivered reconstructed kit and (b) the starter kit we actually wrote (handoff/kit/toadcity_kit.js).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fakeDocument, LOG, DOC_CALLS } from './fakedom2.mjs';
globalThis.document = fakeDocument;
const realRandom = Math.random; let RAND = 0; Math.random = () => { RAND++; return realRandom(); };
const KS = (await import('./sonnet_kit.mjs')).K, KT = (await import('./starter_kit.mjs')).K;
const SRC = (process.env.SRC || new URL('../reference/taskAB_fixed/', import.meta.url).pathname);
const M = {}; for (const f of ['rowkit_tiles', 'rowkit_rowhouse', 'rowkit_corner', 'rowkit_block', 'props_tiles', 'props_street', 'props_crab_shack', 'veh_cars', 'veh_boats', 'veh_carts']) M[f] = await import(SRC + f + '.js');
const THREE = KS.THREE;
const res = { A: {}, B: {}, kits: {}, checks: {}, determinism: {}, timing: {} };
const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function count(root) {
  let meshes = 0, hulls = 0, tris = 0, hullTris = 0, shadow = 0; const mats = new Set(); const b = new THREE.Box3(); root.updateMatrixWorld(true);
  root.traverse((o) => { if (!o.isMesh) return; mats.add(o.material); if (isHull(o)) { hulls++; hullTris += tri(o.geometry); return; } meshes++; tris += tri(o.geometry); if (o.castShadow) shadow++; b.expandByObject(o); });
  return { meshes, hulls, drawCalls: meshes + hulls, shadowCasters: shadow, tris, hullTris, trisInclHull: tris + hullTris, materials: mats.size, bbox: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(3)) };
}
function hashRoot(root, extra) {
  const h = crypto.createHash('sha1'); root.updateMatrixWorld(true);
  root.traverse((o) => { h.update(o.type + o.position.toArray().join(',') + o.rotation.toArray().slice(0, 3).join(',')); if (o.isMesh) for (const k of ['position', 'color', 'uv', 'normal', 'odir']) { const a = o.geometry.attributes[k]; if (a) h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); } });
  if (extra) h.update(JSON.stringify(extra)); return h.digest('hex').slice(0, 12);
}
const atlasCache = new Map();
function atlas(K, which) { const k = K === KS ? 'S' + which : 'T' + which; if (!atlasCache.has(k)) atlasCache.set(k, K.makeAtlas(which === 'A' ? M.rowkit_tiles.KIT_TILES : M.props_tiles.PROP_TILES)); return atlasCache.get(k); }
const builders = { buildRowhouse: M.rowkit_rowhouse.buildRowhouse, buildCornerBar: M.rowkit_corner.buildCornerBar, buildCornerShop: M.rowkit_corner.buildCornerShop };
// ---------- Task A ----------
const A_ASSETS = {
  rowhouse: (K, out, opts = {}) => M.rowkit_rowhouse.buildRowhouse(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 4, front: 'formstone', floors: 3 }, opts)),
  rowhouse_brick: (K, out, opts = {}) => M.rowkit_rowhouse.buildRowhouse(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 5, front: 'brick', floors: 3 }, opts)),
  rowhouse_permastone: (K, out, opts = {}) => M.rowkit_rowhouse.buildRowhouse(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 6, front: 'permastone', floors: 3 }, opts)),
  rowhouse_4: (K, out, opts = {}) => M.rowkit_rowhouse.buildRowhouse(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 4, front: 'formstone', floors: 4 }, opts)),
  corner_bar: (K, out, opts = {}) => M.rowkit_corner.buildCornerBar(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 3 }, opts)),
  corner_shop: (K, out, opts = {}) => M.rowkit_corner.buildCornerShop(K, out, atlas(K, 'A'), 0, 0, 0, Object.assign({ seed: 3 }, opts)),
  block: (K, out, opts = {}) => M.rowkit_block.buildRowBlock(K, out, atlas(K, 'A'), -12, -12, 12, 12, Object.assign({ seed: 11, builders }, opts)),
};
function buildStatic(K, fn, opts) { const out = K.makeOut(); const r = fn(K, out, opts); const grp = out.build(); return { out, r, grp }; }
for (const [kn, K] of [['sonnetKit', KS], ['starterKit', KT]]) {
  res.A[kn] = {};
  for (const [id, fn] of Object.entries(A_ASSETS)) { const { out, r, grp } = buildStatic(K, fn); res.A[kn][id] = Object.assign(count(grp), { coll: out.COLL.length, bld: out.BLD.length, hooks: Object.fromEntries(Object.entries(out.HOOKS).map(([k, v]) => [k, v.length])), lamps: out.LAMPS.length, ret: r && (r.width ? { w: +r.width.toFixed(2), d: +(r.depth || 0).toFixed(2), h: +(r.height || 0).toFixed(2) } : { houses: r.houses, corners: r.corners }), hash: hashRoot(grp, { c: out.COLL, h: out.HOOKS, b: out.BLD }) }); }
}
// ---------- Task B ----------
const PS = M.props_street, PC = M.props_crab_shack, VC = M.veh_cars, VB = M.veh_boats, VT = M.veh_carts;
const STATIC = {
  lamp_acorn: PS.buildLampAcorn, lamp_cobra: PS.buildLampCobra, bench_park: PS.buildBenchPark, bench_bus: PS.buildBenchBus, trash_can: PS.buildTrashCan,
  trash_can_recycling: (K, out, x, z, a, o) => PS.buildTrashCan(K, out, x, z, a, Object.assign({ recycling: true }, o)), crab_shack: PC.buildCrabShack, manhole: PS.buildManhole,
  ladder_wall: PS.buildLadderWall, ladder_drop: PS.buildLadderDrop, parked_car_sedan: VC.buildParkedCarSedan, parked_car_hatchback: VC.buildParkedCarHatchback, parked_car_pickup: VC.buildParkedCarPickup,
};
const VEH = { water_taxi: VB.buildWaterTaxi, paddle_boat: VB.buildPaddleBoat, dragon_boat: VB.buildDragonBoat, car_sedan: VC.buildCarSedan, car_hatch: VC.buildCarHatch, box_truck: VC.buildBoxTruck, arabber_cart: VT.buildArabberCart, skateboard: VT.buildSkateboard };
for (const [kn, K] of [['sonnetKit', KS], ['starterKit', KT]]) {
  res.B[kn] = {};
  for (const [id, fn] of Object.entries(STATIC)) { const out = K.makeOut(); fn(K, out, 0, 0, 0, { atlas: atlas(K, 'B'), seed: 1 }); const grp = out.build(); res.B[kn][id] = Object.assign(count(grp), { coll: out.COLL.length, hooks: out.HOOKS, lamps: out.LAMPS, hash: hashRoot(grp, { c: out.COLL, h: out.HOOKS }) }); }
  for (const [id, fn] of Object.entries(VEH)) { const v = fn(K, { atlas: atlas(K, 'B'), seed: 1 }); const c = count(v.root); res.B[kn][id] = Object.assign(c, { kind: v.kind, seats: v.seats, collider: v.collider, waterline: v.waterline, keys: Object.keys(v).sort(), hash: hashRoot(v.root, { s: v.seats, c: v.collider }) }); }
}
// ---------- determinism ----------
{
  const D = {}; const K = KS;
  const blk = (s) => { const { out, grp } = buildStatic(K, A_ASSETS.block, { seed: s }); return hashRoot(grp, { c: out.COLL, h: out.HOOKS, b: out.BLD }); };
  const a = blk(11); blk(12); blk(99); const b = blk(11), c = blk(12);
  D.block = { same: a === b, differs: a !== c, a, b, c };
  for (const id of Object.keys(VEH)) { const x = hashRoot(VEH[id](K, { atlas: atlas(K, 'B'), seed: 3 }).root); VEH[id](K, { atlas: atlas(K, 'B'), seed: 9 }); const y = hashRoot(VEH[id](K, { atlas: atlas(K, 'B'), seed: 3 }).root), z = hashRoot(VEH[id](K, { atlas: atlas(K, 'B'), seed: 4 }).root); D[id] = { same: x === y, seedChangesLook: x !== z }; }
  // canvas atlas determinism: two fresh makeAtlas calls produce the identical 2D call log
  for (const w of ['A', 'B']) { LOG.length = 0; KS.makeAtlas(w === 'A' ? M.rowkit_tiles.KIT_TILES : M.props_tiles.PROP_TILES); const l1 = LOG.join(';'); LOG.length = 0; KS.makeAtlas(w === 'A' ? M.rowkit_tiles.KIT_TILES : M.props_tiles.PROP_TILES); const l2 = LOG.join(';'); D['atlas' + w] = { identical: l1 === l2, calls: l1.split(';').length }; }
  // starter kit vs delivered kit give identical geometry?
  D.kitsAgreeA = Object.keys(A_ASSETS).map((id) => [id, res.A.sonnetKit[id].hash === res.A.starterKit[id].hash]);
  D.kitsAgreeB = Object.keys(res.B.sonnetKit).map((id) => [id, res.B.sonnetKit[id].hash === res.B.starterKit[id].hash]);
  D.mathRandomCalls = RAND;
  res.determinism = D;
}
// ---------- night lit ratio over seeds ----------
{
  let W = 0, L = 0; const per = [];
  for (let s = 1; s <= 40; s++) { const stats = { windows: 0, lit: 0 }; buildStatic(KS, A_ASSETS.block, { seed: s, stats }); W += stats.windows; L += stats.lit; per.push(+(stats.lit / stats.windows).toFixed(2)); }
  res.checks.litRatio = { overall: +(L / W).toFixed(3), min: Math.min(...per), max: Math.max(...per), note: 'front/upper windows counted by stats; side-wall windows (rowhouse ends) are not counted' };
}
// ---------- block budgets over 40 seeds ----------
{
  const rows = []; for (let s = 1; s <= 40; s++) { const { out, grp, r } = buildStatic(KS, A_ASSETS.block, { seed: s }); const c = count(grp); rows.push({ s, tris: c.tris, trisH: c.trisInclHull, dc: c.drawCalls, climb: (out.HOOKS.climb || []).length, houses: r.houses, corners: r.corners.length, minY: c.bbox[1], bb: c.bbox }); }
  res.checks.blockSeeds = { trisMax: Math.max(...rows.map((r) => r.trisH)), trisMin: Math.min(...rows.map((r) => r.trisH)), dcSet: [...new Set(rows.map((r) => r.dc))], climbSet: [...new Set(rows.map((r) => r.climb))], minYmin: Math.min(...rows.map((r) => r.minY)),
    xzExtent: [Math.min(...rows.map((r) => r.bb[0])), Math.min(...rows.map((r) => r.bb[2])), Math.max(...rows.map((r) => r.bb[3])), Math.max(...rows.map((r) => r.bb[5]))], housesSet: [...new Set(rows.map((r) => r.houses))] };
}
// ---------- timing ----------
{
  const t0 = performance.now(); for (let s = 1; s <= 20; s++) { const out = KS.makeOut(); A_ASSETS.block(KS, out, { seed: s }); } const t1 = performance.now();
  for (let s = 1; s <= 20; s++) { const out = KS.makeOut(); A_ASSETS.block(KS, out, { seed: s }); out.build(); } const t2 = performance.now();
  res.timing.blockGeomMs = +((t1 - t0) / 20).toFixed(1); res.timing.blockGeomPlusBuildMs = +((t2 - t1) / 20).toFixed(1);
  const db = VB.buildDragonBoat(KS, { atlas: atlas(KS, 'B') }); const t3 = performance.now(); for (let i = 0; i < 2000; i++) db.animate(db.root, 1 / 60, 3, 0, i / 60); res.timing.dragonAnimateUs = +(((performance.now() - t3) / 2000) * 1000).toFixed(1);
  const cart = VT.buildArabberCart(KS, { atlas: atlas(KS, 'B') }); const t4 = performance.now(); for (let i = 0; i < 20000; i++) cart.animate(cart.root, 1 / 60, 2, 0.2, i / 60); res.timing.cartAnimateUs = +(((performance.now() - t4) / 20000) * 1000).toFixed(2);
}
res.docCalls = { count: DOC_CALLS.length, sites: [...new Set(DOC_CALLS.map((d) => d.stack.replace(/\(.*?([a-z_]+\.m?js):(\d+):\d+\)/g, '$1:$2')))] };
fs.writeFileSync(new URL('./results_ab.json', import.meta.url), JSON.stringify(res, null, 1));
console.log('done');

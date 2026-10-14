import fs from 'node:fs';
import { fakeDocument } from './fakedom2.mjs'; globalThis.document = fakeDocument;
const K = (await import('./sonnet_kit.mjs')).K, THREE = K.THREE; const SRC = '/workspace/work/reviews/hawk-ab/src/';
const M = {}; for (const f of ['rowkit_tiles', 'rowkit_rowhouse', 'rowkit_corner', 'rowkit_block', 'props_tiles', 'props_street', 'props_crab_shack', 'veh_cars', 'veh_boats', 'veh_carts']) M[f] = await import(SRC + f + '.js');
const A = K.makeAtlas(M.rowkit_tiles.KIT_TILES), B = K.makeAtlas(M.props_tiles.PROP_TILES);
const builders = { buildRowhouse: M.rowkit_rowhouse.buildRowhouse, buildCornerBar: M.rowkit_corner.buildCornerBar, buildCornerShop: M.rowkit_corner.buildCornerShop };
const R = {};
// wrap makeOut to capture raw geometry per call kind (+ decal handedness)
function capOut() {
  const out = K.makeOut(); const cap = { solid: [], glow: [], decal: [], mirrored: {}, ok: {} };
  const s = out.solid, g = out.glow, d = out.decal;
  out.solid = (geo, col, ol) => { cap.solid.push({ geo: geo.clone(), col }); return s(geo, col, ol); };
  out.glow = (geo, col) => { cap.glow.push({ geo: geo.clone(), col }); return g(geo, col); };
  out.decal = (geo, atlas, name) => {
    const gg = geo.index ? geo.toNonIndexed() : geo.clone(); const p = gg.attributes.position, uv = gg.attributes.uv;
    for (let t = 0; t < p.count; t += 3) { // handedness of the uv frame vs the geometric normal (front face)
      const P = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, t + k)), U = [0, 1, 2].map((k) => new THREE.Vector2().fromBufferAttribute(uv, t + k));
      const e1 = P[1].clone().sub(P[0]), e2 = P[2].clone().sub(P[0]), du1 = U[1].x - U[0].x, dv1 = U[1].y - U[0].y, du2 = U[2].x - U[0].x, dv2 = U[2].y - U[0].y;
      const det = du1 * dv2 - du2 * dv1; if (Math.abs(det) < 1e-9) continue; const Tn = e1.clone().multiplyScalar(dv2).sub(e2.clone().multiplyScalar(dv1)).divideScalar(det), Bn = e2.clone().multiplyScalar(du1).sub(e1.clone().multiplyScalar(du2)).divideScalar(det);
      const n = e1.clone().cross(e2); const h = Tn.clone().cross(Bn).dot(n); (h < 0 ? cap.mirrored : cap.ok)[name] = ((h < 0 ? cap.mirrored : cap.ok)[name] || 0) + 1; break;
    }
    cap.decal.push({ geo: geo.clone(), name }); return d(geo, atlas, name);
  };
  return { out, cap };
}
const bboxOf = (list) => { const b = new THREE.Box3(); for (const e of list) { e.geo.computeBoundingBox(); b.union(e.geo.boundingBox); } return b; };
const inBox = (p, c, m = 0) => c.r ? Math.hypot(p.x - c.x, p.z - c.z) < c.r - m : p.x > c.x0 + m && p.x < c.x1 - m && p.z > c.z0 + m && p.z < c.z1 - m;
// 1. text decals mirrored?
{ const { out, cap } = capOut(); for (const cs of [-1, 1]) for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { M.rowkit_corner.buildCornerBar(K, out, A, 0, 0, ang, { seed: 3, corner: cs }); M.rowkit_corner.buildCornerShop(K, out, A, 0, 0, ang, { seed: 4, corner: cs }); }
  M.rowkit_rowhouse.buildRowhouse(K, out, A, 0, 0, 0.7, { seed: 9 });
  const cell = (n) => /^(fs_|ps_|br_|pt_)/.test(n); R.mirroredTextTilesA = Object.fromEntries(Object.entries(cap.mirrored).filter(([n]) => !cell(n)));
  const { out: o2, cap: c2 } = capOut(); for (const [f, a] of [[M.props_street.buildBenchBus, 0], [M.props_crab_shack.buildCrabShack, 0], [M.props_street.buildManhole, 0], [M.props_street.buildTrashCan, 0]]) f(K, o2, 3, 4, 0.6, { atlas: B, recycling: true });
  R.mirroredTilesB_static = c2.mirrored; R.okTilesB_static = c2.ok; }
// 2. game layout: block drawn in a 24 m plot at CURB with the road at y 0 -> what leaves the plot?
{ const res = [];
  for (let s = 1; s <= 20; s++) { const { out, cap } = capOut(); M.rowkit_block.buildRowBlock(K, out, A, 0, 0, 24, 24, { seed: s, builders });
    let beyond = 0, maxOut = 0, below = 0; for (const e of cap.solid.concat(cap.decal)) { const p = e.geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const o = Math.max(-x, x - 24, -z, z - 24); if (o > 0.01 && y < 1.2) { beyond++; maxOut = Math.max(maxOut, o); } if (y < 0.159) below++; } }
    // climb hook inside a collider?
    const hk = (out.HOOKS.climb || [])[0]; const inside = hk ? out.COLL.filter((c) => inBox(hk, c)).length : -1;
    res.push({ s, beyondVertsLowY: beyond, maxOutM: +maxOut.toFixed(2), belowCurb: below, climbInsideColliders: inside, climbTop: hk && +hk.top.toFixed(2) }); }
  R.blockInPlot = { maxOut: Math.max(...res.map((r) => r.maxOutM)), seedsClimbInsideColl: res.filter((r) => r.climbInsideColliders > 0).map((r) => r.s), belowCurb: res.reduce((a, r) => a + r.belowCurb, 0), sample: res.slice(0, 4) }; }
// 2b. inset 18 m box (what the game's 3 m pavement-inside-plot layout would need)
{ const out = K.makeOut(); let err = null, info = null; try { info = M.rowkit_block.buildRowBlock(K, out, A, 3, 3, 21, 21, { seed: 5, builders }); } catch (e) { err = String(e); }
  R.block18 = err ? { err } : { pieces: info.pieces, coll: out.COLL.length };
  const out2 = K.makeOut(); const i2 = M.rowkit_block.buildRowBlock(K, out2, A, 3, 3, 21, 21, { seed: 5, builders, rowDepth: 6 }); R.block18_rowDepth6 = i2.pieces; }
// 3. corner piece downspout + climb hook position
{ for (const cs of [-1, 1]) { const { out, cap } = capOut(); M.rowkit_corner.buildCornerBar(K, out, A, 0, 0, 0, { seed: 3, corner: cs, climb: true });
    const pipes = cap.solid.filter((e) => e.col === '#4f5a52' && e.geo.type === 'CylinderGeometry'); const pb = bboxOf(pipes); const hk = out.HOOKS.climb[0];
    R['cornerPipe_cs' + cs] = { pipeZ: [+pb.min.z.toFixed(3), +pb.max.z.toFixed(3)], frontWallZ: 0, hook: { x: +hk.x.toFixed(2), z: +hk.z.toFixed(2) }, hookInsideColliders: out.COLL.filter((c) => inBox(hk, c)).length }; }
  const { out } = capOut(); M.rowkit_rowhouse.buildRowhouse(K, out, A, 0, 0, 0, { seed: 3, climb: true }); const hk = out.HOOKS.climb[0]; R.rowhouseClimb = { hook: hk, insideColl: out.COLL.filter((c) => inBox(hk, c)).length }; }
// 4. door vs stone water table (door decal at off 0.04 behind the water table face at 0.10, water table top 1.25)
{ const { out, cap } = capOut(); M.rowkit_rowhouse.buildRowhouse(K, out, A, 0, 0, 0, { seed: 3, steps: 3 }); const door = cap.decal.find((e) => /^door_/.test(e.name)); door.geo.computeBoundingBox(); const wt = cap.solid.find((e) => e.col === '#6f6a62'); wt.geo.computeBoundingBox();
  R.doorVsWaterTable = { doorY: [door.geo.boundingBox.min.y, door.geo.boundingBox.max.y].map((v) => +v.toFixed(2)), doorZ: +door.geo.boundingBox.max.z.toFixed(3), waterTableY: [wt.geo.boundingBox.min.y, wt.geo.boundingBox.max.y].map((v) => +v.toFixed(2)), waterTableFrontZ: +wt.geo.boundingBox.max.z.toFixed(3), waterTableX: [wt.geo.boundingBox.min.x, wt.geo.boundingBox.max.x].map((v) => +v.toFixed(2)) }; }
// 5. vehicles: pony hooves, canopy, seats
{ const v = M.veh_carts.buildArabberCart(K, { atlas: B }); v.root.updateMatrixWorld(true); const hooves = v.parts.legs.map((l) => { const b = new THREE.Box3().setFromObject(l.m); return +b.min.y.toFixed(3); });
  const rear = new THREE.Box3().setFromObject(v.parts.rear); R.arabber = { hoofMinY: hooves, rearWheelMinY: +rear.min.y.toFixed(3), seats: v.seats };
  for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.9, 0.9, 2.4, 3, 1, true, (i * Math.PI) / 6, Math.PI / 6); g.rotateX(Math.PI / 2); g.translate(0, 2.62, -1.15); g.computeBoundingBox(); (R.canopy = R.canopy || []).push([g.boundingBox.min.x, g.boundingBox.max.x, g.boundingBox.min.y, g.boundingBox.max.y].map((q) => +q.toFixed(2))); } }
// 6. parked pickup glow placement when not at the origin
{ for (const [x, z, a] of [[0, 0, 0], [10, 5, Math.PI / 2]]) { const { out, cap } = capOut(); M.veh_cars.buildParkedCarPickup(K, out, x, z, a, { atlas: B }); const sb = bboxOf(cap.solid), gb = bboxOf(cap.glow);
    R['pickupGlow_' + x] = { solidX: [sb.min.x, sb.max.x].map((q) => +q.toFixed(2)), solidZ: [sb.min.z, sb.max.z].map((q) => +q.toFixed(2)), glowX: [gb.min.x, gb.max.x].map((q) => +q.toFixed(2)), glowZ: [gb.min.z, gb.max.z].map((q) => +q.toFixed(2)) }; } }
// 7. crab shack: posts vs sloped roof
{ const roofAt = (z) => 2.82 - (z - 0.2) * Math.tan(0.1); R.crabRoof = { frontPostTop: 2.82, roofUndersideAtFront: +(roofAt(1.4) - 0.035).toFixed(3), roofTopAtFront: +(roofAt(1.4) + 0.035).toFixed(3), backPostTop: 2.82, roofUndersideAtBack: +(roofAt(-1.4) - 0.035).toFixed(3), backWallTop: 2.575, roofAtBackWall: +(roofAt(-1.42) - 0.035).toFixed(3) }; }
// 8. yard bins: lid vs can x
{ const out = K.makeOut(); const caps = []; const s = out.solid; out.solid = (g, c, o) => { if (g.type === 'CylinderGeometry') { g.computeBoundingBox(); caps.push([c, +((g.boundingBox.min.x + g.boundingBox.max.x) / 2).toFixed(2), +g.boundingBox.min.y.toFixed(2)]); } return s(g, c, o); };
  M.rowkit_block.buildRowBlock(K, out, A, 0, 0, 24, 24, { seed: 11, builders }); R.yardBins = caps.filter((c) => c[2] > 0.15 && c[2] < 0.9).slice(-6); }
// 9. climb-hook top semantics A vs B
{ const o = K.makeOut(); M.props_street.buildLadderWall(K, o, 0, 0, 0, { top: 6 }); R.climbTopB = o.HOOKS.climb[0].top; const o2 = K.makeOut(); M.rowkit_rowhouse.buildRowhouse(K, o2, A, 0, 0, 0, { seed: 1, floors: 3, climb: true }); R.climbTopA = o2.HOOKS.climb[0].top; o2.BLD[0] && (R.bldH_A = o2.BLD[0].h); }
// 10. boat waterline sanity: hull min y 0, deck height above water
for (const [id, f] of [['water_taxi', M.veh_boats.buildWaterTaxi], ['paddle_boat', M.veh_boats.buildPaddleBoat], ['dragon_boat', M.veh_boats.buildDragonBoat]]) { const v = f(K, { atlas: B }); R['wl_' + id] = { waterline: v.waterline, seats: v.seats.map((s) => [s.pose, s.y]) }; }
fs.writeFileSync(new URL('./checks_ab.json', import.meta.url), JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1).slice(0, 6000));

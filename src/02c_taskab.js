
// ---------------- Task A/B adapter: Sonnet's rowhouse kit + street props + vehicles (vendor/taskAB, fixed) -> the game's own city builders ----------------
// The vendor modules write through a kit `out` collector and read a kit object `K`. The game has neither, so this file builds both from the game's globals:
//   K: THREE, place, toonMat, CURB / GF / FH / PAR / WY, makeOut (stand-alone vehicles), makeAtlas, mergeGeoms, OUT_CITY / addOdir, QUAL, NIGHT, glassMat.
//   makeAtlas(tiles): the kit tiles are drawn INTO the game's one 2048 city atlas (rows below the city tiles), so kit decals ride the existing decal
//     chunk meshes (DB, DECAL_MAT) at zero extra draw calls; rect(name) is the same [u, v, w, h] convention as the game's tile().
//   abCityOut(): solid -> CB (the 64 m city chunks, cel toon), decal -> DB, glow -> per-chunk glow layer (shown at night only, hidden by day),
//     glass -> per-chunk transparent glass layer (cars), ol -> per-chunk ink hull layer (HD only), coll -> COLL, bld -> BLD, lamp -> LAMPS
//     (instanced glow pools + halos + pooled point lights), hook -> ABHOOKS (climb / seat / manhole tables for phase 4).
// abBuildCity() (called from the city builder before the chunk meshes are built) puts a fixed rowhouse block on every generic residential
// plot, street props on the pavements and parked cars along the side streets; it yields to the browser every ~14 ms so phones keep painting.
const AB = { CURB: 0.16, GF: 4.4, FH: 3.4, PAR: 1.3, WY: -0.85, HULL: true, HULL_MIN: 2.0, CAR_P: 0.67, stats: { blocks: 0, houses: 0, cars: 0, lamps: 0, props: 0, ms: 0, yields: 0 } };
const ABHOOKS = { climb: [], seat: [], manhole: [] };
const AB_GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
AB_GLOW_MAT.visible = false; // night only (abNight), so the glow layer costs no draw calls by day
const AB_GLASS_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
function abNight(n) { AB_GLOW_MAT.opacity = Math.min(1, n * 1.1); AB_GLOW_MAT.visible = n > 0.01; }
// ---- atlas: kit tiles drawn into the game atlas ----
// The city atlas has 256 free rows below its own tiles (it uses 1792 of 2048), so both kit tile sets (Task A 60 tiles, Task B 13) are packed
// there together at 0.6 scale, tallest first (232 rows). At gameplay range a 1.2 m Formstone cell is ~77 px of texture, about screen density.
const AB_ATLASES = new Map(), AB_TSCALE = 0.6;
function abPackAtlases(sets) {
  const R = sets.map(() => ({})), all = [];
  sets.forEach((tiles, si) => { for (const [name, t] of Object.entries(tiles)) all.push({ si, name, t }); });
  all.sort((a, b) => b.t.h - a.t.h || b.t.w - a.t.w);
  if (_ax > 0) _ax = AS; // start on a fresh shelf
  for (const { si, name, t } of all) {
    const w = Math.ceil(t.w * AB_TSCALE), h = Math.ceil(t.h * AB_TSCALE);
    R[si][name] = tile(w, h, (c) => { c.scale(w / t.w, h / t.h); t.draw(c, t.w, t.h); }, 1);
  }
  if (_ay + _arow > AS) throw new Error('city atlas overflow (' + (_ay + _arow) + ' rows)');
  const mat = toonMat({ map: atlasTex, alphaTest: 0.5, side: THREE.DoubleSide }); mat.customProgramCacheKey = () => 'psxAB'; // stand-alone vehicles: plain uv, remapped into the tile
  return sets.map((tiles, si) => { const A = { canvas: atlasC, tex: atlasTex, mat, rect: (n) => R[si][n] }; AB_ATLASES.set(tiles, A); return A; });
}
function abMakeAtlas(tiles) { const A = AB_ATLASES.get(tiles); if (A) return A; throw new Error('taskAB: tile set not packed into the city atlas'); }
function abRefreshAtlas() { // the 32-bit copy of the atlas was shrunk before the kit tiles existed: redraw it
  const lo = atlasTex.userData.low, x = lo.getContext('2d'); x.clearRect(0, 0, lo.width, lo.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(atlasC, 0, 0, lo.width, lo.height); atlasTex.needsUpdate = true;
}
function abMerge(list, withUv = false) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = withUv ? new Float32Array(n * 2) : null; let o = 0;
  for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (U) U.set(g.attributes.uv.array, o * 2); o += c; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('color', new THREE.BufferAttribute(C, 3));
  if (U) m.setAttribute('uv', new THREE.BufferAttribute(U, 2)); m.computeBoundingSphere(); return m;
}
// ---- stand-alone collector (a drivable vehicle's static body): toon mesh + ink hull + glow + one mesh per atlas ----
function abMakeOut() {
  const S = [], OLs = [], GL = [], DC = new Map(), out = { COLL: [], BLD: [], LAMPS: [], HOOKS: {} };
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  out.solid = (g, col, outline = true) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); S.push(g); if (outline) OLs.push(g); };
  out.glow = (g, col) => { g = flat(g); bakeColor(g, col); if (g.attributes.uv) g.deleteAttribute('uv'); GL.push(g); };
  out.decal = (g, atlas, name) => { g = flat(g); const r = atlas.rect(name), uv = g.attributes.uv; if (!r) throw new Error('no tile ' + name);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * r[2], r[1] + uv.getY(i) * r[3]); bakeColor(g, '#ffffff'); (DC.get(atlas) || DC.set(atlas, []).get(atlas)).push(g); };
  out.coll = (c) => out.COLL.push(c); out.bld = (b) => out.BLD.push(b); out.lamp = (x, y, z) => out.LAMPS.push({ x, y, z });
  out.hook = (type, data) => (out.HOOKS[type] || (out.HOOKS[type] = [])).push(data);
  out.build = () => {
    const grp = new THREE.Group();
    if (S.length) { const m = new THREE.Mesh(abMerge(S), toonMat()); m.castShadow = m.receiveShadow = true; grp.add(m); }
    if (OLs.length) { const h = new THREE.Mesh(addOdir(abMerge(OLs)), OUT_CITY); h.visible = QUAL.hd; grp.add(h); QUAL.outlines.push(h); }
    if (GL.length) { const m = new THREE.Mesh(abMerge(GL), AB_GLOW_MAT); m.renderOrder = 2; grp.add(m); }
    for (const [atlas, list] of DC) { const m = new THREE.Mesh(abMerge(list, true), atlas.mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
    return grp;
  };
  return out;
}
const K_AB = {
  THREE, TAU, clamp, lerp, QUAL, NIGHT, CURB: AB.CURB, GF: AB.GF, FH: AB.FH, PAR: AB.PAR, WY: AB.WY,
  toonMat: (o, t) => toonMat(o, t), basicMat: (o) => new THREE.MeshBasicMaterial(o), OUT_CITY, addOdir, bakeColor, lowTex,
  place: (g, x, y, z, ry, rx, rz) => place(g, x, y, z, ry, rx, rz), makeOut: abMakeOut, makeAtlas: abMakeAtlas, mergeGeoms: abMerge, GLOW_MAT: AB_GLOW_MAT, glassMat: AB_GLASS_MAT,
};
const [AB_A, AB_B] = abPackAtlases([KIT_TILES, PROP_TILES]); abRefreshAtlas();
const AB_BUILDERS = { buildRowhouse, buildCornerBar, buildCornerShop };

// ---- the city collector (chunked like the city meshes) ----
class ABChunks { // P, N and colour (3 or 4 components) per cell of `cell` metres (0 = one mesh for the whole city)
  constructor(c4, cell = 0) { this.ch = new Map(); this.c4 = c4; this.cell = cell; }
  at(x, z) { const k = this.cell ? Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell) : 'all'; let m = this.ch.get(k); if (!m) this.ch.set(k, (m = { P: [], N: [], C: [] })); return m; }
  add(g, col) { // g already in world space; col = colour string, or null when g carries its own rgba colour attribute
    if (g.index) g = g.toNonIndexed(); g.computeBoundingBox(); const b = g.boundingBox, m = this.at((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2);
    const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null, ca = g.attributes.color, c = col ? new THREE.Color(col) : null;
    for (let i = 0; i < p.length; i += 3) { m.P.push(p[i], p[i + 1], p[i + 2]); if (n) m.N.push(n[i], n[i + 1], n[i + 2]); else m.N.push(0, 1, 0);
      if (c) { m.C.push(c.r, c.g, c.b); if (this.c4) m.C.push(1); } else { const j = i / 3; m.C.push(ca.getX(j), ca.getY(j), ca.getZ(j)); if (this.c4) m.C.push(ca.itemSize > 3 ? ca.getW(j) : 1); } }
  }
  build(mat, o = {}) {
    const grp = new THREE.Group(); grp.userData.meshes = [];
    for (const m of this.ch.values()) { if (!m.P.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(m.N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(m.C, this.c4 ? 4 : 3)); if (o.odir) addOdir(g); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = o.order || 0; if (!this.cell) mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !!o.recv; grp.add(mesh); grp.userData.meshes.push(mesh); m.P = m.N = m.C = null; }
    return grp;
  }
}
// glow (~25k tris), car glass (~5k) and the kit's ink hulls (~70k) are each ONE city-wide mesh: 1 draw call apiece (glow only at night),
// instead of one per 64 m chunk; their vertex work off screen is small next to what per-chunk culling would cost in calls on a phone
const AB_GLW = new ABChunks(false), AB_GLS = new ABChunks(true), AB_OLK = new ABChunks(false);
function abCityOut() {
  return {
    // small parts (trim, dentils, rails, car details: < 0.9 m) go to the ground chunks, which receive but do not cast shadows: same draw calls,
    // about half the shadow-pass triangles; big masses (walls, stoops, cornices, car bodies) stay in the shadow-casting city chunks
    // the ink hull is drawn for the big outlined masses only (>= AB.HULL_MIN = 2 m: walls, roofs, stoops, car bodies; smaller parts read fine without a line)
    solid(g, col, ol = true) { g.computeBoundingBox(); const b = g.boundingBox, big = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) >= 0.9; (big ? CB : GB).geom(g, col); if (ol && AB.HULL && Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) >= AB.HULL_MIN) AB_OLK.add(g, '#000'); },
    decal(g, atlas, name) { const r = atlas.rect(name); if (!r) throw new Error('no tile ' + name); DB.geom(g, '#fff', r); },
    glow(g, col) { AB_GLW.add(g, col); },
    glass(g) { AB_GLS.add(g, null); },
    coll(c) { COLL.push(c); }, bld(b) { BLD.push(b); },
    lamp(x, y, z) { LAMPS.push({ x, z, y, px: x, pz: z }); AB.stats.lamps++; },
    hook(type, d) { (ABHOOKS[type] || (ABHOOKS[type] = [])).push(d); },
  };
}
// ---- deterministic helpers ----
const abRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); return f; };
const abSeed = (b) => Math.abs((b.x0 * 73856093) ^ (b.z0 * 19349663)) % 99991 + 7;
const abYield = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); // not throttled in background tabs
// which generic plots get a rowhouse block: every residential plot except Harbor East's towers and the block with the kickable STAFF door (06b)
function abTakes(b) { const fells = b.x0 >= 138 && b.z1 < 0, hEast = b.x0 >= 36 && b.z1 < 0 && !fells; return !hEast && !(b.x0 === -66 && b.z0 === -70); }
const AB_BLOCKS = [];
// is a circle (x, z, r) clear of every collider in a list and of every climb hook (1.3 m)?
function abFree(list, x, z, r) {
  for (const c of list) { if (c.r !== undefined) { if (Math.hypot(c.x - x, c.z - z) < c.r + r + 0.1) return false; } else if (x > c.x0 - r - 0.1 && x < c.x1 + r + 0.1 && z > c.z0 - r - 0.1 && z < c.z1 + r + 0.1) return false; }
  for (const h of ABHOOKS.climb) if (Math.hypot(h.x - x, h.z - z) < 1.3 + r) return false;
  return true;
}
const AB_AVENUE = (x, z) => (z > -46 && z < -36) || (z > 36 && z < 46) || (x > -76 && x < -66); // Pratt St, Key Hwy, Light St stay clear of new parked cars
async function abBuildCity() {
  const t0 = performance.now(); let tS = t0; const out = abCityOut(), K = K_AB;
  const tick = async () => { if (performance.now() - tS > 14) { AB.stats.yields++; await abYield(); tS = performance.now(); } };
  const carKinds = ['sedan', 'sedan', 'hatch', 'wagon', 'minivan', 'pickup', 'hatch', 'cab'];
  const parked = (x, z, alongX, seed, kind) => { const ang = alongX ? (seed % 2 ? Math.PI / 2 : -Math.PI / 2) : (seed % 2 ? 0 : Math.PI);
    buildParkedCar(K, out, x, z, ang, { kind, seed }); AB.stats.cars++; };
  // 1) the old avenue cars (vaultable in 06b) are now real cars
  CARS.forEach(([x, z, ax], i) => parked(x, z, ax, 11 + i * 7, ['sedan', 'wagon', 'cab', 'pickup', 'hatch', 'sedan', 'minivan', 'wagon'][i % 8]));
  // 2) rowhouse blocks
  for (const b of AB_BLOCKS) {
    const seed = abSeed(b), fells = b.x0 >= 138 && b.z1 < 0, c0 = COLL.length;
    const info = buildRowBlock(K, out, AB_A, b.x0, b.z0, b.x1, b.z1, { seed, inset: 2, builders: AB_BUILDERS, p3: fells ? 0.9 : 0.55 });
    AB.stats.blocks++; AB.stats.houses += info.houses + info.corners.length; await tick();
    // 3) pavement props: acorn lamps, a trash can or two, sometimes a bench; never in front of a stoop / door or on a climb spot
    const R = abRng(seed * 3 + 1), local = COLL.slice(c0), faces = [['n', b.z0 + 0.55, Math.PI], ['s', b.z1 - 0.55, 0], ['w', b.x0 + 0.55, -Math.PI / 2], ['e', b.x1 - 0.55, Math.PI / 2]];
    for (const [k, line, ang] of faces) {
      const alongX = k === 'n' || k === 's', lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, P = (t) => (alongX ? [lo + t, line] : [line, lo + t]);
      const put = (ts, r, fn) => { for (const t of ts) { const [x, z] = P(t); if (abFree(local, x, z, r)) { const c1 = COLL.length; fn(x, z); for (let i = c1; i < COLL.length; i++) local.push(COLL[i]); return true; } } return false; };
      put([6, 5, 7, 4.5, 8], 0.3, (x, z) => buildLampAcorn(K, out, x, z, ang)); put([18, 19, 17, 19.5, 16], 0.3, (x, z) => buildLampAcorn(K, out, x, z, ang));
      if (R() < 0.6) { AB.stats.props++; put([3, 21, 2.6, 21.4, 11], 0.4, (x, z) => buildTrashCan(K, out, x, z, ang, { recycling: R() < 0.35 })); }
      if (R() < 0.3) { AB.stats.props++; put([12, 13.5, 10.5], 1.0, (x, z) => buildBenchPark(K, out, alongX ? x : x + (k === 'w' ? 0.15 : -0.15), alongX ? z + (k === 'n' ? 0.15 : -0.15) : z, ang)); }
      // 4) parked cars in the lane along this face (1.15 m off the kerb), 1-3 per face
      const cl = k === 'n' ? b.z0 - 1.15 : k === 's' ? b.z1 + 1.15 : k === 'w' ? b.x0 - 1.15 : b.x1 + 1.15;
      let t = 3.6 + R() * 2.5;
      while (t < 21) { const kind = carKinds[Math.floor(R() * carKinds.length)], L = kind === 'pickup' ? 5.4 : kind === 'hatch' ? 4.0 : 4.9, tc = t + L / 2; if (tc + L / 2 > 21.5) break;
        const x = alongX ? lo + tc : cl, z = alongX ? cl : lo + tc, cs = Math.floor(R() * 9973) + 1;
        if (R() < AB.CAR_P && !AB_AVENUE(x, z) && !isWater(x, z)) { parked(x, z, alongX, cs, kind); CARS.push([x, z, alongX]); }
        t += L + 0.7 + R() * 2.2; }
      await tick();
    }
    // 5) a manhole in the street east of the block
    { const x = b.x1 + 3.4, z = (b.z0 + b.z1) / 2 + (R() - 0.5) * 8; if (!AB_AVENUE(x, z) && x < 212) { buildManhole(K, out, x, z, R() * TAU); AB.stats.props++; } }
  }
  // 6) the harbour crab shack on the Key Hwy promenade below Federal Hill, facing the water
  buildCrabShack(K, out, -25, 33, Math.PI); AB.stats.props++;
  AB.stats.ms = Math.round(performance.now() - t0);
}
function abBuildLayers() { // after the city chunks: glow (night), glass (cars), ink hulls (HD)
  const t0 = performance.now();
  const g = AB_GLW.build(AB_GLOW_MAT, { order: 2 }); scene.add(g);
  const s = AB_GLS.build(AB_GLASS_MAT, { order: 3 }); scene.add(s);
  const h = AB_OLK.build(OUT_CITY, { odir: true }); for (const m of h.userData.meshes) { m.visible = QUAL.hd; QUAL.outlines.push(m); } scene.add(h);
  const tri = (grp) => grp.userData.meshes.reduce((a, m) => a + m.geometry.attributes.position.count / 3, 0); AB.stats.layerTris = { glow: tri(g), glass: tri(s), hull: tri(h) };
  AB.layers = { glow: g, glass: s, hull: h }; AB.stats.layersMs = Math.round(performance.now() - t0);
}

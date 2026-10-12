
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
landmark('harborplace', 'HARBORPLACE', -52, -24, 16, { name: 'Dragon Boat Duchess', x: -44, z: -12, water: true });
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
landmark('aquarium', 'NATIONAL AQUARIUM', 19, -17, 19, { name: 'Big Jimmy', x: 19, z: -5, water: true });
LMCAP('powerplant');
// Power Plant complex on pier 4 (far LOD): three joined buildings - Phillips (west), the Power Plant hall + tower + four black stacks (centre), Hard Rock Cafe (east);
// footprints / heights match the HD model's PP table in 03b (exterior_2 read at x 0.0188 m/px, y 0.038 m/px)
mass(44.8, -27, 52.13, -9.5, 11.6, { tr: T.fac[0][0], top: '#4a3a30' });
mass(52.13, -27, 59.0, -8.8, 15.4, { tr: T.fac[0][1], top: '#2e3036' });
mass(59.0, -25.5, 67.55, -9.3, 12.3, { tr: T.fac[0][1], top: '#4a3a30' });
sbox(53.3, CURB + 15.4, -12.6, 58.2, CURB + 17.9, -8.9, '#a9502f', false); sbox(54.5, CURB + 17.9, -12, 57, CURB + 19.6, -9.1, '#a9502f', false);
for (const [i, z] of [-13.2, -16.6, -20, -23.4].entries()) { const g = new THREE.CylinderGeometry(1.0, 1.08, 9, 10); place(g, 57.6 + i * 0.35, CURB + 22, z); solid(g, '#1f1d1c'); } // the four black stacks, a north-south row
sbox(55.2, CURB + 20.3, -10.3, 56.3, CURB + 23.5, -10.1, '#e4566a', false); sbox(55.6, CURB + 23.5, -10.3, 55.9, CURB + 29.4, -10.1, '#e2b23a', false); // the guitar
sbox(44.6, CURB + 8.9, -27.2, 67.7, CURB + 9.4, -8.6, '#e4d8bc');
signOn(52.13, -27, 59.0, -8.8, 's', 12.0, 5, LSIGN.power);
LMCAP(null);
landmark('powerplant', 'POWER PLANT', 56, -17, 19, { name: 'Voltage Vic', x: 56, z: -5.5 });
// Four Seasons (Harbor East): a podium and a glass hotel tower
mass(71, -69, 93, -47, 9, { tr: T.store[1], fh: 9, bay: 4, top: '#4a4640' });
mass(75, -66, 89, -52, 52, { tr: T.glass, y0: CURB + 9, fh: 3.6, top: '#2a3644', coll: false });
signOn(71, -69, 93, -47, 's', 9.6, 12, LSIGN.hotel);
landmark('fourseasons', 'FOUR SEASONS', 82, -58, 20, { name: 'Chef Crabcake', x: 82, z: -42 });
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
// Domino Sugar: a tall refinery with a giant rooftop neon sign facing the harbour (original lettering)
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
landmark('domino', 'DOMINO SUGARS', 82, 57, 16, { name: 'Sugar Rush', x: 82, z: 57, y: CURB + DOM_H });
// Under Armour (Tide Point): brick halls with a clock tower
mass(106, 48, 126, 56, 11, { tr: T.fac[0][0], top: '#4a3a30' }); mass(106, 60, 126, 68, 11, { tr: T.fac[0][1], top: '#4a3a30' });
mass(113.5, 56.5, 118.5, 59.5, 22, { col: '#9a5a44', top: '#4a3a30' });
signOn(106, 48, 126, 56, 'n', 7.6, 10, LSIGN.ath);
landmark('underarmour', 'UNDER ARMOUR', 116, 52, 16, { name: 'The Compression King', x: 116, z: 43 });
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

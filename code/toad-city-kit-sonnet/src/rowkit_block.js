// rowkit_block.js — Task A, piece 4: buildRowBlock fills ONE 24 x 24 m city block with Baltimore rowhouses.
// Layout (block drawn from the north-west, x east, z south; every front faces its street, shoulder to shoulder):
//   north row  z0 .. z0+7.5     full block width      \  houses of 4.2-6.0 m, a corner BAR or SHOP on 1-2 corners
//   south row  z1-7.5 .. z1     full block width      /  (the other corners are ordinary end-of-row houses)
//   west row   x0 .. x0+10.5    the 9 m between them   - 2 houses facing the west street
//   east row   x1-10.5 .. x1    the 9 m between them   - 2 houses facing the east street
//   a 3 x 9 m yard / rear-alley strip is left in the middle (bins and crates, closed by out.coll).
// A house in the 24 m block is therefore 7.5-10.5 m deep (the stand-alone default of 12-14 m would overlap the row behind it).
// All geometry goes through the single `out` the caller owns, so the block is one chunk write: 4 draw calls in total.
// The builders are taken from opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }; in the game build, where these
// files are concatenated, the globals of the same names are used. No imports; no Math.random (seeded LCG from opts.seed).
export const META = { id: 'rowblock', kind: 'kit', footprint: [24, 24], houses: '12-14 per block', corners: '1-2 bar / shop' };

const bkRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const BK_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];

function bkPickStyle(R, last) { // formstone 35 % · brick 35 % · painted brick 15 % · permastone 15 %; never the same as the neighbour
  for (let t = 0; t < 12; t++) {
    const q = R(), v = R(); let s;
    if (q < 0.35) s = { key: 'f' + Math.floor(v * 4), front: 'formstone', variant: Math.floor(v * 4) };
    else if (q < 0.7) { const b = Math.floor(v * 6); s = { key: 'b' + b, front: 'brick', paint: false, brick: b, variant: b }; }
    else if (q < 0.85) { const p = Math.floor(v * 4); s = { key: 'p' + p, front: 'brick', paint: true, variant: p }; }
    else { const p = Math.floor(v * 3); s = { key: 's' + p, front: 'permastone', variant: p }; }
    if (s.key !== last) return s;
  }
  return { key: 'f0', front: 'formstone', variant: 0 };
}
function bkWidths(R, rem) { // n houses of 4.2..6.0 m filling `rem` exactly
  let n = Math.max(1, Math.round(rem / 5.1)); while (rem / n > 6.0) n++; while (n > 1 && rem / n < 4.2) n--;
  const wt = Array.from({ length: n }, () => 0.85 + R() * 0.3), sum = wt.reduce((a, b) => a + b, 0); let w = wt.map((q) => (rem * q) / sum);
  if (w.some((q) => q < 4.2 || q > 6.0)) w = Array.from({ length: n }, () => rem / n);
  return w;
}

export function buildRowBlock(K, out, atlas, x0, z0, x1, z1, opts = {}) {
  const B = opts.builders || {};
  const house = B.buildRowhouse || (typeof buildRowhouse === 'function' ? buildRowhouse : null);
  const bar = B.buildCornerBar || (typeof buildCornerBar === 'function' ? buildCornerBar : null);
  const shop = B.buildCornerShop || (typeof buildCornerShop === 'function' ? buildCornerShop : null);
  if (!house || !bar || !shop) throw new Error('buildRowBlock: pass opts.builders = { buildRowhouse, buildCornerBar, buildCornerShop }');
  const seed = opts.seed ?? 1, R = bkRng(seed), THREE = K.THREE, CURB = K.CURB ?? 0.16;
  const XL = x1 - x0, ZL = z1 - z0, DR = opts.rowDepth ?? 7.5, ALLEY = opts.alley ?? 3, SD = (XL - ALLEY) / 2, BAND = ZL - 2 * DR;

  // ---- which corners get a bar / shop (1 or 2) ----
  const corners = { NE: null, NW: null, SW: null, SE: null }, names = ['NE', 'NW', 'SW', 'SE'];
  const c1 = names[Math.floor(R() * 4)], two = R() < 0.55, c2 = two ? names[(names.indexOf(c1) + (R() < 0.5 ? 2 : 1 + 2 * Math.floor(R() * 2))) % 4] : null;
  corners[c1] = R() < 0.5 ? 'bar' : 'shop'; if (c2 && c2 !== c1) corners[c2] = corners[c1] === 'bar' ? 'shop' : 'bar';

  // ---- plan every piece first (so exactly one gets the CLIMB hook and the styles never repeat) ----
  const rows = [
    { id: 'N', ang: Math.PI, len: XL, depth: DR, origin: (a) => [x1 - a, z0], c0: 'NE', c1: 'NW' },
    { id: 'S', ang: 0, len: XL, depth: DR, origin: (a) => [x0 + a, z1], c0: 'SW', c1: 'SE' },
    { id: 'W', ang: -Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x0, z0 + DR + a], c0: null, c1: null },
    { id: 'E', ang: Math.PI / 2, len: BAND, depth: SD, origin: (a) => [x1, z1 - DR - a], c0: null, c1: null },
  ];
  const plan = []; let lastStyle = '', lastCor = -1;
  for (const row of rows) {
    const cw = [row.c0 && corners[row.c0] ? 6.5 + R() * 1.5 : 0, row.c1 && corners[row.c1] ? 6.5 + R() * 1.5 : 0], pieces = [];
    const widths = bkWidths(R, row.len - cw[0] - cw[1]);
    if (cw[0]) pieces.push({ w: cw[0], corner: corners[row.c0], cs: -1 }); widths.forEach((w) => pieces.push({ w, corner: null })); if (cw[1]) pieces.push({ w: cw[1], corner: corners[row.c1], cs: 1 });
    let a = 0; pieces.forEach((p, i) => { p.row = row; p.a = a + p.w / 2; p.i = i; p.n = pieces.length; a += p.w; plan.push(p); });
  }
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, topOf = (fl) => GF + (fl - 1) * FH + 0.95;
  plan.forEach((p) => { p.floors = R() < 0.55 ? 3 : 4; p.top = topOf(p.floors); });
  const climbAt = Math.floor(R() * plan.length);
  plan.forEach((p, idx) => {
    p.seed = seed * 131 + idx * 17 + 5; p.climb = idx === climbAt;
    if (!p.corner) { const st = bkPickStyle(R, lastStyle); lastStyle = st.key; p.style = st; let ci; do { ci = Math.floor(R() * BK_CORNICE.length); } while (ci === lastCor); lastCor = ci; p.cornice = BK_CORNICE[ci]; }
    else lastStyle = 'c';
  });

  // neighbour parapet heights: a house only needs wall cells where it stands taller than what is next to it
  const rowOf = (id) => plan.filter((q) => q.row.id === id), spanMin = (id, lo, hi) => { const r = rowOf(id); let a = 0, m = 1e9; for (const q of r) { const wlo = id === 'N' ? x1 - (a + q.w) : x0 + a, whi = wlo + q.w; if (whi > lo && wlo < hi) m = Math.min(m, q.top); a += q.w; } return m; };
  for (const row of rows) {
    const ps = rowOf(row.id); ps.forEach((p, i) => {
      p.leftTop = i > 0 ? ps[i - 1].top : undefined; p.rightTop = i < ps.length - 1 ? ps[i + 1].top : undefined;
      if (row.id === 'W') { if (i === 0) p.leftTop = spanMin('N', x0, x0 + SD); if (i === ps.length - 1) p.rightTop = spanMin('S', x0, x0 + SD); }
      if (row.id === 'E') { if (i === 0) p.leftTop = spanMin('S', x1 - SD, x1); if (i === ps.length - 1) p.rightTop = spanMin('N', x1 - SD, x1); }
    });
  }

  // ---- build ----
  const info = { houses: 0, corners: [], height: 0, pieces: [] };
  for (const p of plan) {
    const [px, pz] = p.row.origin(p.a), side = p.row.id === 'W' || p.row.id === 'E';
    let res;
    if (p.corner) {
      const f = p.corner === 'bar' ? bar : shop;
      res = f(K, out, atlas, px, pz, p.row.ang, { seed: p.seed, width: p.w, depth: p.row.depth, corner: p.cs, floors: p.floors, left: p.n > 1, leftTop: p.cs < 0 ? p.rightTop : p.leftTop, climb: p.climb, stats: opts.stats });
      info.corners.push(p.corner);
    } else {
      res = house(K, out, atlas, px, pz, p.row.ang, Object.assign({ seed: p.seed, width: p.w, depth: p.row.depth, floors: p.floors, corniceColor: p.cornice, left: side ? true : p.i > 0, right: side ? true : p.i < p.n - 1, leftTop: p.leftTop, rightTop: p.rightTop, climb: p.climb, stats: opts.stats }, p.style));
      info.houses++;
    }
    info.height = Math.max(info.height, res.height); info.pieces.push({ row: p.row.id, w: +p.w.toFixed(2), corner: p.corner || null });
  }

  // ---- the yard strip: bins and crates, closed to the characters ----
  const yx0 = x0 + SD, yx1 = x1 - SD, yz0 = z0 + DR, yz1 = z1 - DR;
  const place = (g, gx, gy, gz) => K.place(g, gx, gy, gz, 0);
  const yr = bkRng(seed * 7 + 2), cxy = (yx0 + yx1) / 2;
  for (let i = 0; i < 3; i++) { const bz = yz0 + 1.2 + yr() * (yz1 - yz0 - 2.4); out.solid(place(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 8), cxy + (yr() - 0.5) * 1.2, CURB + 0.35, bz), i % 2 ? '#4f5a52' : '#5a5248'); out.solid(place(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), cxy, CURB + 0.73, bz), '#2c322e', false); }
  out.solid(place(new THREE.BoxGeometry(0.9, 0.6, 0.7), cxy + 0.2, CURB + 0.3, (yz0 + yz1) / 2 + 1.2), '#9a6a44');
  out.coll({ x0: yx0, x1: yx1, z0: yz0, z1: yz1 });
  return info;
}

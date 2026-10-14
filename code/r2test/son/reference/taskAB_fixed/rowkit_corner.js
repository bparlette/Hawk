// rowkit_corner.js — Task A, pieces 2 and 3: the end-of-row corner BAR and corner SHOP (chamfered corner door, 3 or 4 storeys).
// Same rules as the rowhouse: everything goes through `out` (4 draw calls per block, 1 atlas), facades are atlas decal cells,
// windows glow at night from a seeded RNG (~45 % lit), shop glass / glass block / neon always glow at night.
//  * Bar: glass-block windows, striped awning, chamfered corner door with neon over it (TAVERN / CRABS / GRILL, built from
//    stroke geometry: glows at night, dull tube colour by day), a Natty Boh-style blade sign, painted wall board (TAVERN, CRAB HOUSE, BAR & GRILL).
//  * Shop: big shop window with real local product signs (Utz, Old Bay, Natty Boh-style, OPEN), roll-up shutter (closed / half / none),
//    awning, wall sign (CORNER MARKET, CARRYOUT, BARBER, HARDWARE, LAUNDROMAT, DELI).
// All lettering is drawn on canvas in rowkit_tiles.js or built from stroke geometry here; no logo files. No imports; no Math.random.
export const META_CORNER = { id: 'corner', kind: 'kit', footprint: [7.2, 7.5], floors: [3, 4], pieces: ['corner_bar', 'corner_shop'] };

const cnRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const cnHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cnTone = (h, f) => '#' + cnHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function cnKit(K, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16, SK = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
  const bx = (w, h, d, skip = '') => { // BoxGeometry minus the faces nobody can see (px nx py ny pz nz)
    const g = new THREE.BoxGeometry(w, h, d);
    if (skip) { const drop = new Set(skip.split(' ').filter(Boolean).map((k) => SK[k])), src = g.index.array, keep = []; for (let f = 0; f < 6; f++) if (!drop.has(f)) for (let i = 0; i < 6; i++) keep.push(src[f * 6 + i]); g.setIndex(keep); }
    return g;
  };
  const wedge = (w, h, d) => { // bracket: triangular prism; wall at z = 0, foot (y 0, z 0), top at y = h, nose (y h, z d). 4 triangles
    const P = [], N = [], x0 = -w / 2, x1 = w / 2, A = [0, 0], B = [h, 0], C = [h, d], v = (x, q) => [x, q[0], q[1]];
    const tri = (a, b, c, n) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; } P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); };
    tri(v(x1, A), v(x1, B), v(x1, C), [1, 0, 0]); tri(v(x0, A), v(x0, B), v(x0, C), [-1, 0, 0]);
    const l = Math.hypot(h, d), n = [0, -d / l, h / l]; tri(v(x0, A), v(x1, A), v(x1, C), n); tri(v(x0, A), v(x1, C), v(x0, C), n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); return g;
  };
  const wall = (cx, cz, ry, len) => { const s = Math.sin(ry), c = Math.cos(ry); return { cx, cz, ry, len, pt: (u, off) => [cx + u * c + off * s, cz - u * s + off * c] }; };
  const fin = (g, Wl, u, y, off) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); return K.place(g, X, CURB, Z, ANG); };
  const S = {
    bx, wedge, wall, CURB,
    box(Wl, w, h, d, u, y, off, col, o = {}) { out.solid(fin(o.geom || bx(w, h, d, o.skip), Wl, u, y, off), col, !!o.ol); },     // solid box, centre at (u along wall, y, off out of wall)
    quad(Wl, w, h, u, y, off, col) { out.solid(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col, false); },                    // flat solid quad (glass backs, panels)
    glow(Wl, w, h, u, y, off, col) { out.glow(fin(new THREE.PlaneGeometry(w, h), Wl, u, y, off), col); },                            // flat glowing quad
    decal(Wl, w, h, u, y, off, tile, flip = false) { const g = new THREE.PlaneGeometry(w, h); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); } out.decal(fin(g, Wl, u, y, off), atlas, tile); },
    // a tiled facade: cells of ~1.2 m, one atlas tile each, mirrored at random (the tiles wrap, so mirroring never shows a seam)
    cells(Wl, tiles, u0, u1, y0, y1, off, R) {
      const nx = Math.max(1, Math.ceil((u1 - u0) / 1.2)), ny = Math.max(1, Math.ceil((y1 - y0) / 1.2)), cw = (u1 - u0) / nx, ch = (y1 - y0) / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) S.decal(Wl, cw, ch, u0 + cw * (i + 0.5), y0 + ch * (j + 0.5), off, tiles[Math.floor(R() * tiles.length)], R() < 0.5);
    },
    toWorld(lx, lz) { return [X + lx * Math.cos(ANG) + lz * Math.sin(ANG), Z - lx * Math.sin(ANG) + lz * Math.cos(ANG)]; },
    aabb(lx0, lx1, lz0, lz1) { const p = [S.toWorld(lx0, lz0), S.toWorld(lx1, lz0), S.toWorld(lx1, lz1), S.toWorld(lx0, lz1)]; return { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), z0: Math.min(...p.map((q) => q[1])), z1: Math.max(...p.map((q) => q[1])) }; },
    coll(lx0, lx1, lz0, lz1) { out.coll(S.aabb(lx0, lx1, lz0, lz1)); },
    bld(lx0, lx1, lz0, lz1, h) { out.bld(Object.assign(S.aabb(lx0, lx1, lz0, lz1), { h })); },
  };
  return S;
}
// extra emitters used only by the corner pieces
function cnExtend(K, S, out, atlas, X, Z, ANG) {
  const THREE = K.THREE, CURB = K.CURB ?? 0.16;
  // a thin quad between two points of a wall plane (neon tube strokes): solid dull tube + glowing tube
  S.seg = (Wl, u0, y0, u1, y1, th, off, dim, bright) => {
    const len = Math.hypot(u1 - u0, y1 - y0), a = Math.atan2(y1 - y0, u1 - u0), mk = () => { const g = new THREE.PlaneGeometry(len + th * 0.7, th); g.rotateZ(a); return g; };
    const mx = (u0 + u1) / 2, my = (y0 + y1) / 2;
    for (const [g, d] of [[mk(), dim], [mk(), null]]) { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(mx, off + (d ? 0 : 0.012)); g.translate(px, my, pz); K.place(g, X, CURB, Z, ANG); if (d) out.solid(g, d, false); else out.glow(g, bright); }
  };
  // a flat quad sloping out of the wall like an awning: top edge at (y, off0), outer edge lower and `proj` further out
  S.awning = (Wl, w, u, yTop, off0, proj, drop, tile) => {
    const l = Math.hypot(proj, drop), g = new THREE.PlaneGeometry(w, l); g.rotateX(-(Math.PI / 2 - Math.atan2(drop, proj)));
    S.decalGeom(Wl, g, u, yTop - drop / 2, off0 + proj / 2, tile);
  };
  S.decalGeom = (Wl, g, u, y, off, tile) => { g.rotateY(Wl.ry); const [px, pz] = Wl.pt(u, off); g.translate(px, y, pz); K.place(g, X, CURB, Z, ANG); out.decal(g, atlas, tile); };
  // a vertical blade sign: plane whose normal is `ny` (a local direction angle), double sided
  S.blade = (Wl, w, h, u, y, off, ryExtra, tile) => { const g = new THREE.PlaneGeometry(w, h); g.rotateY(ryExtra); S.decalGeom(Wl, g, u, y, off, tile); };
}

// ---------- neon stroke font (A-Z & -): polylines on a 2 x 4 grid ----------
const CN_FONT = {
  A: [[[0, 0], [1, 4], [2, 0]], [[0.5, 1.6], [1.5, 1.6]]], B: [[[0, 0], [0, 4], [1.4, 4], [1.9, 3.5], [1.9, 2.5], [1.4, 2], [0, 2]], [[1.4, 2], [2, 1.5], [2, 0.5], [1.5, 0], [0, 0]]],
  C: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6]]], D: [[[0, 0], [0, 4], [1.3, 4], [2, 3.2], [2, 0.8], [1.3, 0], [0, 0]]],
  E: [[[2, 4], [0, 4], [0, 0], [2, 0]], [[0, 2], [1.5, 2]]], F: [[[2, 4], [0, 4], [0, 0]], [[0, 2], [1.5, 2]]],
  G: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 1.8], [1, 1.8]]], H: [[[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]],
  I: [[[0.5, 4], [1.5, 4]], [[1, 4], [1, 0]], [[0.5, 0], [1.5, 0]]], J: [[[2, 4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], K: [[[0, 0], [0, 4]], [[2, 4], [0, 1.8]], [[0.6, 2.4], [2, 0]]],
  L: [[[0, 4], [0, 0], [2, 0]]], M: [[[0, 0], [0, 4], [1, 2], [2, 4], [2, 0]]], N: [[[0, 0], [0, 4], [2, 0], [2, 4]]],
  O: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]]], P: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]]],
  Q: [[[0.5, 0], [0, 0.6], [0, 3.4], [0.5, 4], [1.5, 4], [2, 3.4], [2, 0.6], [1.5, 0], [0.5, 0]], [[1.2, 1], [2, 0]]], R: [[[0, 0], [0, 4], [1.5, 4], [2, 3.5], [2, 2.5], [1.5, 2], [0, 2]], [[1, 2], [2, 0]]],
  S: [[[2, 3.4], [1.5, 4], [0.5, 4], [0, 3.4], [0, 2.6], [0.5, 2], [1.5, 2], [2, 1.4], [2, 0.6], [1.5, 0], [0.5, 0], [0, 0.6]]], T: [[[0, 4], [2, 4]], [[1, 4], [1, 0]]],
  U: [[[0, 4], [0, 0.6], [0.5, 0], [1.5, 0], [2, 0.6], [2, 4]]], V: [[[0, 4], [1, 0], [2, 4]]], W: [[[0, 4], [0.5, 0], [1, 2], [1.5, 0], [2, 4]]], X: [[[0, 4], [2, 0]], [[0, 0], [2, 4]]],
  Y: [[[0, 4], [1, 2], [2, 4]], [[1, 2], [1, 0]]], Z: [[[0, 4], [2, 4], [0, 0], [2, 0]]], '&': [[[2, 0], [0.4, 2.4], [0.5, 3.6], [1.1, 4], [1.7, 3.6], [1.6, 2.8], [0, 0.9], [0.5, 0], [1.4, 0], [2, 1.2]]], '-': [[[0.3, 2], [1.7, 2]]],
};
// neon word centred at u; letter height h. returns the width used. `dim` is the unlit tube colour, `bright` the glow colour.
function cnNeon(S, Wl, text, u, y, off, h, dim, bright) {
  const sc = h / 4, adv = 2 * sc + 0.28 * h, total = text.length * adv - 0.28 * h; let x = u - total / 2;
  for (const ch of text) { for (const pl of CN_FONT[ch] || []) for (let i = 0; i + 1 < pl.length; i++) S.seg(Wl, x + pl[i][0] * sc, y - h / 2 + pl[i][1] * sc, x + pl[i + 1][0] * sc, y - h / 2 + pl[i + 1][1] * sc, h * 0.13, off, dim, bright); x += adv; }
  return total;
}

const CN_WW = 1.12, CN_WH = 2.04, CN_PX = CN_WW / 80, CN_PY = CN_WH / 144;
const CN_STONE = '#6f6a62', CN_MARBLE = '#eae6dc', CN_IRON = '#2c322e', CN_SAND = '#a4907a', CN_ROOF = '#4a4a50', CN_TRIM = '#c9b48a', CN_PLUM = '#5a4f5c';
const CN_WARM = ['#ffe08a', '#ffbf3c'];

function cnWindow(S, Wl, u, y0, o) { // 1/1 sash decal + seeded night glow + lintel/sill
  if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, CN_WW, CN_WH, u, y0 + CN_WH / 2, 0.02, 'win_' + o.style);
  if (o.lit) { S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 38 * CN_PY, 0.032, o.lit); S.glow(Wl, 64 * CN_PX, 60 * CN_PY, u, y0 + CN_WH - 106 * CN_PY, 0.032, o.lit); }
  S.box(Wl, CN_WW + 0.34, 0.2, 0.1, u, y0 + CN_WH + 0.1, 0.05, CN_SAND, { skip: 'nz' }); S.box(Wl, CN_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, CN_MARBLE, { skip: 'nz' });
}

function cnBuild(K, out, atlas, x, z, ang, opts, kind) {
  const seed = opts.seed ?? 1, R = cnRng(seed), RL = cnRng(seed * 11 + 1), RC = cnRng(seed * 5 + 9), THREE = K.THREE;
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4, r = Array.from({ length: 16 }, () => R());
  const cs = opts.corner ?? (r[0] < 0.5 ? 1 : -1), W = opts.width ?? 6.5 + r[1] * 1.5, D = opts.depth ?? 7.5, c = opts.chamfer ?? 1.8;
  const floors = opts.floors ?? (r[2] < 0.5 ? 3 : 4), Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const brick = opts.brick ?? Math.floor(r[3] * 6), tile = ['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][brick], paintTile = r[4] < 0.3 ? 'pt_' + Math.floor(r[5] * 4) : null;
  const wallTiles = [paintTile || tile], wallCol = '#8a4a3a', corCol = opts.corniceColor ?? ['#c9b48a', '#4f5a52', '#5a4f5c', '#a4907a'][Math.floor(r[6] * 4)];
  const left = !!opts.left;
  const S = cnKit(K, out, atlas, x, z, ang); cnExtend(K, S, out, atlas, x, z, ang);
  const O = S.wall(0, 0, 0, 1), F = S.wall(-cs * c / 2, 0, 0, W - c), Ch = S.wall(cs * (W / 2 - c / 2), -c / 2, cs * Math.PI / 4, c * Math.SQRT2), Sd = S.wall(cs * W / 2, -(c + D) / 2, cs * Math.PI / 2, D - c);
  const litCol = () => CN_WARM[RL() < 0.5 ? 0 : 1];

  // ---- body: chamfered footprint, extruded ----
  const pts = [[-W / 2, 0], [W / 2 - c, 0], [W / 2, -c], [W / 2, -D], [-W / 2, -D]].map(([px, pz]) => [cs * px, pz]);
  const shp = new THREE.Shape(); pts.forEach(([px, pz], i) => (i ? shp.lineTo(px, -pz) : shp.moveTo(px, -pz)));
  const body = new THREE.ExtrudeGeometry(shp, { depth: roofY, bevelEnabled: false }); body.rotateX(-Math.PI / 2);
  S.box(O, 0, 0, 0, 0, 0, 0, wallCol, { geom: body, ol: true });
  S.box(O, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, CN_ROOF, { skip: 'ny nx px pz nz' });
  for (const Wl of [F, Ch, Sd]) { S.cells(Wl, wallTiles, -Wl.len / 2, Wl.len / 2, 0, parTop, 0.012, RC); S.box(Wl, Wl.len, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' }); }
  S.box(O, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' }); S.box(O, 0.2, 0.5, D, -cs * (W / 2 - 0.1), Htot + 0.7, -D / 2, wallCol, { skip: 'ny' });
  // left-hand exposed end (side opposite the corner) when there is no neighbour: brick cells on the end wall
  const lTop = left ? (opts.leftTop ?? parTop) : 0;
  if (lTop < parTop - 0.2) {
    const Lw = S.wall(-cs * W / 2, -D / 2, -cs * Math.PI / 2, D); S.cells(Lw, wallTiles, -D / 2, D / 2, lTop, parTop, 0.012, RC);
    if (!left) for (let f = 0; f < floors; f++) for (const uu of [-D * 0.2, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Lw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + (uu > 0 ? 1 : 0)) % 3)); if (RL() < 0.45) S.glow(Lw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }

  // ---- cornice around the three street walls ----
  const corP = 0.62, nBrAll = [];
  for (const Wl of [F, Ch, Sd]) {
    const L = Wl.len; S.box(Wl, L, 0.42, 0.1, 0, Htot - 0.21, 0.05, cnTone(corCol, 0.82), { skip: 'nz ny' });
    S.box(Wl, L, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true }); S.box(Wl, L, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, cnTone(corCol, 1.12), { skip: 'nz', ol: true });
    const n = Math.max(2, Math.round(L / 1.1)); for (let i = 0; i < n; i++) S.box(Wl, 0, 0, 0, -L / 2 + (i + 0.5) * L / n, Htot - 0.42, 0.1, cnTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14) });
    for (let u = -L / 2 + 0.1; u < L / 2 - 0.05; u += 0.17) S.box(Wl, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' });
  }
  S.box(F, W - c, 0.1, 0.07, 0, Htot - 0.42, 0.035, cnTone(CN_TRIM, 0.85), { skip: 'nz ny' });

  // ---- upper floors: windows on all three walls ----
  const style0 = Math.floor(r[7] * 3);
  for (const Wl of [F, Sd, Ch]) {
    const L = Wl.len, n = Wl === Ch ? 1 : Math.max(1, Math.round((L - 1.0) / 2.1));
    for (let f = 1; f < floors; f++) for (let k = 0; k < n; k++) cnWindow(S, Wl, -L / 2 + L * (k + 0.5) / n, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (style0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }

  // ---- ground floor ----
  const pilasters = (Wl) => { for (const s of [-1, 1]) S.box(Wl, 0.5, 3.9, 0.2, s * (Wl.len / 2 - 0.25), 1.95, 0.1, cnTone(CN_TRIM, 0.9), { skip: 'nz ny', ol: true }); };
  const band = (Wl, w, col, tileName) => { // painted sign board: panel + decal
    const sw = Math.min(Wl.len - 1.0, w), hh = sw / 4; S.box(Wl, sw + 0.2, hh + 0.2, 0.1, 0, 3.58, 0.05, col, { skip: 'nz ny', ol: true }); S.decal(Wl, sw, hh, 0, 3.58, 0.108, tileName); };
  const mullions = (Wl, gw, y0, gh, n) => { for (let i = 0; i <= n; i++) S.box(Wl, 0.08, gh, 0.08, -gw / 2 + gw * i / n, y0 + gh / 2, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0 + gh, 0.09, CN_IRON, { skip: 'nz' }); S.box(Wl, gw + 0.1, 0.1, 0.1, 0, y0, 0.09, CN_IRON, { skip: 'nz' }); };
  const shopWindow = (Wl, prods, shutter) => {
    const gw = Wl.len - 1.2, gy = 0.78, gh = 2.2; pilasters(Wl);
    S.box(Wl, Wl.len - 1.0, 0.7, 0.14, 0, 0.35, 0.07, CN_PLUM, { skip: 'nz ny', ol: true });
    S.quad(Wl, gw, gh, 0, gy + gh / 2, 0.06, '#4f6676'); S.glow(Wl, gw - 0.1, gh - 0.1, 0, gy + gh / 2, 0.075, '#ffd890');
    mullions(Wl, gw, gy, gh, Math.max(2, Math.round(gw / 1.5)));
    for (const p of prods) S.decal(Wl, p.w, p.h, p.u * gw / 2, gy + p.y, 0.1, p.tile);
    if (shutter) { const sh = shutter === 'closed' ? gh : gh * 0.5; S.box(Wl, gw + 0.1, 0.22, 0.2, 0, gy + gh + 0.1, 0.1, '#6f6a62', { skip: 'nz ny' }); S.decal(Wl, gw, sh, 0, gy + gh - sh / 2, 0.13, 'shutter'); }
  };
  const glassBlocks = (Wl, n) => { pilasters(Wl); S.box(Wl, Wl.len - 1.0, 0.9, 0.14, 0, 0.45, 0.07, CN_PLUM, { skip: 'nz ny', ol: true }); for (let i = 0; i < n; i++) { const u = -Wl.len / 2 + Wl.len * (i + 0.5) / n; S.decal(Wl, 1.35, 1.35, u, 2.0, 0.08, 'glassblock'); S.glow(Wl, 1.2, 1.2, u, 2.0, 0.095, RL() < 0.5 ? '#ffbf3c' : '#ffe08a'); S.box(Wl, 1.55, 0.12, 0.16, u, 1.26, 0.08, CN_MARBLE, { skip: 'nz' }); S.box(Wl, 1.5, 0.14, 0.12, u, 2.76, 0.06, CN_SAND, { skip: 'nz' }); } };

  const awnTile = kind === 'bar' ? 'awn_red' : ['awn_green', 'awn_blue', 'awn_red'][Math.floor(r[8] * 3)];
  let sign, signCol, prods = [];
  if (kind === 'bar') {
    const bs = opts.sign ?? ['tavern', 'crab', 'bar_grill'][Math.floor(r[9] * 3)];
    sign = { tavern: 'sign_tavern', crab: 'sign_crab', bar_grill: 'sign_bar_grill' }[bs]; signCol = bs === 'crab' ? '#2f5a3a' : bs === 'tavern' ? '#2c322e' : '#5a2438';
    glassBlocks(F, 2); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.2, 0, 3.0, 0.1, 1.0, 0.45, awnTile);
    glassBlocks(Sd, Math.max(1, Math.round(Sd.len / 2.6)));
    // neon over the corner door, plus a small OPEN tube beside the glass block
    const word = { tavern: 'TAVERN', crab: 'CRABS', bar_grill: 'GRILL' }[bs];
    S.box(Ch, Ch.len - 0.2, 0.7, 0.08, 0, 3.55, 0.06, '#1a1626', { skip: 'nz ny' });
    cnNeon(S, Ch, word, 0, 3.55, 0.12, 0.46, '#8a3a30', '#ff3a1c'); cnNeon(S, F, 'OPEN', F.len / 4, 1.62, 0.12, 0.26, '#6a2a38', '#ff3d6e');                              // in the glass-block window, below the awning (fix m9)
    // blade sign at the corner edge: the Natty Boh-style beer sign, with a lit rim
    const bu = 0, bo = 1.05; S.box(Ch, 0.08, 0.08, bo, bu, 4.62, bo / 2, CN_IRON, { skip: 'nz' });
    S.blade(Ch, 0.86, 0.573, bu, 4.62, bo, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'sign_natty');
  } else {
    const ks = opts.sign ?? ['market', 'carryout', 'barber', 'hardware', 'laundromat', 'deli'][Math.floor(r[9] * 6)];
    sign = 'shop_' + ks; signCol = { market: '#2f5a3a', carryout: '#b8302a', barber: '#3a5a8a', hardware: '#3a5a8a', laundromat: '#4a8a9a', deli: '#8a4a3a' }[ks];
    prods = [{ tile: 'prod_utz', w: 0.5, h: 0.67, u: -0.55, y: 0.65 }, { tile: 'prod_oldbay', w: 0.5, h: 0.67, u: 0.05, y: 0.65 }, { tile: 'prod_natty', w: 0.55, h: 0.55, u: 0.62, y: 0.6 }, { tile: 'prod_open', w: 0.6, h: 0.3, u: -0.1, y: 1.7 }];
    const sh = opts.shutter ?? ['none', 'half', 'closed'][Math.floor(r[10] * 3)];
    shopWindow(F, prods, sh === 'none' ? null : sh); band(F, 4.4, signCol, sign); S.awning(F, F.len - 1.4, 0, 3.05, 0.12, 1.0, 0.4, awnTile);
    shopWindow(Sd, [{ tile: 'prod_oldbay', w: 0.5, h: 0.67, u: -0.3, y: 0.65 }, { tile: 'prod_utz', w: 0.5, h: 0.67, u: 0.3, y: 0.65 }], null); band(Sd, 3.6, signCol, sign);
    S.box(Ch, 0.08, 0.08, 0.9, 0, 4.62, 0.45, CN_IRON, { skip: 'nz' }); S.blade(Ch, 0.6, 0.8, 0, 4.62, 0.95, -cs * Math.PI / 4 + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 'prod_utz');
  }
  // corner door in the chamfer: panel door, transom with glow, jambs, one marble step
  const doorTile = 'door_' + (kind === 'bar' ? 2 : Math.floor(r[11] * 4)), sill = 0.2, dH = 2.05;
  S.box(Ch, 0.12, dH + 0.6, 0.14, -0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' }); S.box(Ch, 0.12, dH + 0.6, 0.14, 0.58, sill + (dH + 0.6) / 2, 0.07, CN_TRIM, { skip: 'nz ny' });
  S.decal(Ch, 1.04, dH, 0, sill + dH / 2, 0.04, doorTile); S.quad(Ch, 1.04, 0.44, 0, sill + dH + 0.28, 0.05, '#4f6676'); S.glow(Ch, 0.94, 0.34, 0, sill + dH + 0.28, 0.06, litCol());
  S.box(Ch, 1.9, 0.18, 0.7, 0, 0.09, 0.35, CN_MARBLE, { skip: 'nz ny', ol: true }); S.box(Ch, 1.4, 0.14, 0.4, 0, 0.27 - 0.04, 0.2, cnTone(CN_MARBLE, 0.95), { skip: 'nz ny' });
  S.box(F, W - c, 0.12, 0.06, 0, GF, 0.03, CN_TRIM, { skip: 'nz ny' });
  // downspout on the open end, OUTSIDE the front wall (fix M5: it sat at off -0.07, buried in the wall) + its shoe
  S.box(O, 0, 0, 0, -cs * (W / 2 - 0.12), (Htot + 0.3) / 2, 0.07, '#4f5a52', { geom: new THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(O, 0.14, 0.16, 0.14, -cs * (W / 2 - 0.12), 0.1, 0.1, '#4f5a52', { skip: 'ny' });
  S.box(F, 0.9, 0.5, 0.9, -cs * W / 4, roofY + 0.31, -D + 2.0, '#6f6a62', { skip: 'ny', ol: true });

  // ---- gameplay data ----
  S.coll(-W / 2 * cs, (W / 2 - c) * cs, 0, -D); S.coll(cs * (W / 2 - c), cs * W / 2, -c, -D); S.coll(cs * (W / 2 - c * 0.7), cs * W / 2, 0, -c * 0.7);
  S.bld(-W / 2 * cs, (W / 2 - c) * cs, 0, -D, S.CURB + parTop); S.bld(cs * (W / 2 - c), cs * W / 2, -c, -D, S.CURB + parTop);
  const [hx, hz] = S.toWorld(-cs * (W / 2 - 0.12), 0.12); if (opts.climb) out.hook('climb', { x: hx, z: hz, ang, top: S.CURB + parTop }); // in front of the wall, beside the pipe (fix M5), world y (m1)
  return { width: W, depth: D, height: parTop, corner: cs };
}

export function buildCornerBar(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'bar'); }
export function buildCornerShop(K, out, atlas, x, z, ang = 0, opts = {}) { return cnBuild(K, out, atlas, x, z, ang, opts, 'shop'); }

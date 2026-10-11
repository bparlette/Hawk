// rowkit_rowhouse.js — Task A, piece 1: the Baltimore rowhouse (3 or 4 storeys; Formstone / brick / painted brick / permastone).
// Everything is written through `out` (solid / glow / decal / coll / bld / lamp / hook), so a whole block merges into one chunk:
// 1 toon mesh + 1 ink hull + 1 glow mesh + 1 decal mesh (the kit atlas) = 4 draw calls. Facades are decals in 1.2 m cells of the
// atlas tiles (tileable, randomly mirrored), windows are one decal each + seeded night glow, relief is real geometry:
// marble stoop with rails, bracketed cornice with dentils, lintels, sills, string course, hood, downspout, roof hatch / deck.
// No imports; no Math.random (seeded LCG from opts.seed); materials only through K / out.
export const META_ROWHOUSE = { id: 'rowhouse', kind: 'kit', footprint: [4.8, 13], floors: [3, 4] };

const rhRng = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; const f = () => (s = s * 16807 % 2147483647) / 2147483647; f(); f(); f(); return f; };
const rhHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rhTone = (h, f) => '#' + rhHex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// ---------- wall-oriented emit toolkit (identical copy lives in rowkit_corner.js: modules cannot import) ----------
function rhKit(K, out, atlas, X, Z, ANG) {
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

// window tile layout (rowkit_tiles.js drawWindow): 80x144 px, frame 8 px, upper glass y 8..68, rail 68..76, lower glass y 76..136
const RH_WW = 1.12, RH_WH = 2.04, RH_PX = RH_WW / 80, RH_PY = RH_WH / 144;
const RH_CORNICE = ['#c9b48a', '#4f5a52', '#5a4f5c', '#8a4a3a', '#a4907a', '#9ab0b8', '#c49a9a'];
const RH_STONE = '#6f6a62', RH_MARBLE = '#eae6dc', RH_IRON = '#2c322e', RH_ROOF = '#4a4a50', RH_SAND = '#a4907a';

// one 1/1 sash window (decal) with night glow and stone lintel + sill. y0 = bottom of the frame.
export function rowhouseWindow(S, Wl, u, y0, o) {
  const cy = y0 + RH_WH / 2; if (o.stats) { o.stats.windows++; if (o.lit) o.stats.lit++; }
  S.decal(Wl, RH_WW, RH_WH, u, cy, 0.02, 'win_' + o.style);
  if (o.lit) { // two glow panes (upper and lower sash); a painted screen hides the lower one
    S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (8 + 30) * RH_PY, 0.032, o.lit);
    if (!o.screen) S.glow(Wl, 64 * RH_PX, 60 * RH_PY, u, y0 + RH_WH - (76 + 30) * RH_PY, 0.032, o.lit);
  }
  if (o.screen) S.decal(Wl, 0.9, 0.98, u, y0 + RH_WH - 106 * RH_PY, 0.045, o.screen);
  if (o.trim !== false) {
    S.box(Wl, RH_WW + 0.34, 0.2, 0.1, u, y0 + RH_WH + 0.1, 0.05, o.lintel || RH_SAND, { skip: 'nz' });
    S.box(Wl, RH_WW + 0.22, 0.1, 0.13, u, y0 - 0.05, 0.065, RH_MARBLE, { skip: 'nz' });
  }
}

export function buildRowhouse(K, out, atlas, x, z, ang = 0, opts = {}) {
  const R = rhRng(opts.seed ?? 1), RC = rhRng((opts.seed ?? 1) * 7 + 3), RL = rhRng((opts.seed ?? 1) * 13 + 5);
  const GF = K.GF ?? 4.4, FH = K.FH ?? 3.4;
  // ---- every decision is drawn once, in a fixed order, so a seed always gives the same house (opts override) ----
  const r = Array.from({ length: 24 }, () => R());
  const W = opts.width ?? 4.2 + r[0] * 1.8, D = opts.depth ?? 12 + r[1] * 2;
  const front = opts.front ?? (r[2] < 0.45 ? 'formstone' : r[2] < 0.85 ? 'brick' : 'permastone');
  const floors = opts.floors ?? (r[3] < 0.55 ? 3 : 4), vari = opts.variant ?? Math.floor(r[4] * 4);
  const paint = opts.paint ?? (front === 'brick' && r[5] < 0.35);
  const bays = opts.bays ?? (W < 4.9 ? 2 : 3), doorBay = (opts.doorSide ?? (r[6] < 0.5 ? -1 : 1)) < 0 ? 0 : bays - 1;
  const nSteps = opts.steps ?? 3 + Math.floor(r[7] * 3), stoopW = opts.stoopWidth ?? 1.3 + r[8] * 0.2, stoopP = opts.stoopProj ?? 1.4 + r[9] * 0.4;
  const corP = opts.corniceProj ?? 0.5 + r[10] * 0.3, nBr = opts.brackets ?? 4 + Math.floor(r[11] * 5), corCol = opts.corniceColor ?? RH_CORNICE[Math.floor(r[12] * RH_CORNICE.length)];
  const screens = opts.screens ?? r[13] < 0.7, deck = opts.deck ?? r[14] < 0.25, doorTile = 'door_' + (opts.doorColor ?? Math.floor(r[15] * 4)), winStyle0 = Math.floor(r[16] * 3);
  const num = opts.number ?? 100 + Math.floor(r[17] * 899), chimney = r[18] < 0.4, hood = r[19] < 0.55, sideTile = r[20] < 0.5 ? 'br_red' : 'br_tan', roofCol = r[21] < 0.5 ? RH_ROOF : '#5a5058';
  const left = !!opts.left, right = !!opts.right; // neighbours on the local -x / +x side
  const Htot = GF + (floors - 1) * FH, roofY = Htot + 0.45, parTop = Htot + 0.95;
  const S = rhKit(K, out, atlas, x, z, ang), F = S.wall(0, 0, 0, W);

  // ---- facade tiles ----
  let tiles;
  if (front === 'formstone') tiles = ['fs_' + vari];
  else if (front === 'permastone') tiles = ['ps_' + (vari % 3)];
  else if (paint) tiles = ['pt_' + (vari % 4)];
  else tiles = [['br_red', 'br_tan', 'br_plum', 'br_grey', 'br_green', 'br_sand'][opts.brick ?? [0, 1, 0, 2, 3, 4, 5][vari % 7]]];
  const wallCol = { formstone: '#8f867a', permastone: '#a8a49a', brick: '#8a4a3a' }[front];

  // ---- body, facade, sides ----
  S.box(F, W, roofY, D, 0, roofY / 2, -D / 2, wallCol, { skip: 'ny', ol: true });
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });                                  // parapet block behind the front decals
  S.cells(F, tiles, -W / 2, W / 2, 0, parTop, 0.012, RC);
  const sideWalls = [];
  if (!right) sideWalls.push([1, Math.PI / 2]); if (!left) sideWalls.push([-1, -Math.PI / 2]);
  for (const [sgn, ry] of sideWalls) { // exposed end of the row: brick wall, a few small windows, parapet
    const Sw = S.wall(sgn * W / 2, -D / 2, ry, D);
    S.cells(Sw, [sideTile], -D / 2, D / 2, 0, parTop, 0.012, RC);
    S.box(Sw, D, 0.5, 0.2, 0, Htot + 0.7, -0.1, wallCol, { skip: 'nz ny' });
    for (let f = 0; f < floors; f++) for (const uu of [-D * 0.18, D * 0.2]) { const y0 = f === 0 ? 1.7 : GF + (f - 1) * FH + 0.8; S.decal(Sw, 0.8, 1.45, uu, y0 + 0.72, 0.02, 'win_' + ((f + Math.round(uu)) % 3 + 3) % 3); if (RL() < 0.45) S.glow(Sw, 0.56, 0.5, uu, y0 + 1.1, 0.032, RL() < 0.5 ? '#ffe08a' : '#ffbf3c'); }
  }
  // shared party walls: only the part standing above a lower neighbour shows, so it gets brick cells too
  for (const [has, sgn, ry, top] of [[left, -1, -Math.PI / 2, opts.leftTop ?? parTop], [right, 1, Math.PI / 2, opts.rightTop ?? parTop]]) if (has && top < parTop - 0.2) S.cells(S.wall(sgn * W / 2, -D / 2, ry, D), [sideTile], -D / 2, D / 2, top, parTop, 0.012, RC);
  S.box(F, W, 0.5, 0.2, 0, Htot + 0.7, -D + 0.1, wallCol, { skip: 'pz ny' });                             // back parapet
  S.box(F, 0.2, 0.5, D, -W / 2 + 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'nx ny', ol: false });
  S.box(F, 0.2, 0.5, D, W / 2 - 0.1, Htot + 0.7, -D / 2, wallCol, { skip: 'px ny', ol: false });
  S.box(F, W - 0.4, 0.06, D - 0.4, 0, roofY + 0.03, -D / 2, roofCol, { skip: 'ny nx px pz nz' });         // roof membrane (darker than the parapet cap)
  // ---- bays: door, windows, basement windows ----
  const bw = W / bays, bc = (k) => -W / 2 + bw * (k + 0.5), doorU = bc(doorBay);
  // stone water table + its cap: gapped at the door bay (fix M1: it used to run across the bottom of the door), so the stoop meets the door
  const gap0 = doorU - 0.65, gap1 = doorU + 0.65;
  for (const [a, b] of [[-W / 2, gap0], [gap1, W / 2]]) if (b - a > 0.05) {
    S.box(F, b - a, 1.25, 0.1, (a + b) / 2, 0.625, 0.05, RH_STONE, { skip: 'nz ny', ol: true });
    S.box(F, b - a, 0.1, 0.16, (a + b) / 2, 1.28, 0.08, rhTone(RH_STONE, 1.25), { skip: 'nz ny' });
  }
  S.box(F, W, 0.12, 0.08, 0, GF, 0.04, '#c9b48a', { skip: 'nz ny' });
  S.box(F, W, 0.1, 0.07, 0, Htot - 0.42, 0.035, rhTone('#c9b48a', 0.85), { skip: 'nz ny' });
  const litCol = () => (RL() < 0.5 ? '#ffe08a' : '#ffbf3c');
  for (let k = 0; k < bays; k++) {
    const u = bc(k);
    if (k !== doorBay) {
      rowhouseWindow(S, F, u, 1.55, { stats: opts.stats, style: (winStyle0 + k) % 3, lit: RL() < 0.45 ? litCol() : null, screen: screens ? ['scr_cottage', 'scr_swan', 'scr_lighthouse', 'scr_sail', 'scr_crab', 'scr_heron'][Math.floor(RL() * 6)] : null });
      S.quad(F, 0.8, 0.42, u, 0.7, 0.108, RH_IRON); S.decal(F, 0.84, 0.46, u, 0.7, 0.118, 'grille'); S.box(F, 1.0, 0.07, 0.16, u, 0.4, 0.08, RH_MARBLE, { skip: 'nz' });
    }
    for (let f = 1; f < floors; f++) rowhouseWindow(S, F, u, GF + (f - 1) * FH + 0.7, { stats: opts.stats, style: (winStyle0 + k + f) % 3, lit: RL() < 0.45 ? litCol() : null });
  }
  // ---- door + marble stoop ----
  const rise = 0.2, sill = nSteps * rise, dH = 2.05;
  S.box(F, 0.14, dH + 0.7, 0.16, doorU - 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 0.14, dH + 0.7, 0.16, doorU + 0.57, sill + (dH + 0.7) / 2, 0.08, '#c9b48a', { skip: 'nz ny' });
  S.box(F, 1.5, 0.24, 0.18, doorU, sill + dH + 0.7 + 0.12, 0.09, RH_SAND, { skip: 'nz ny' });
  S.decal(F, 1.0, dH, doorU, sill + dH / 2, 0.04, doorTile);
  S.box(F, 1.24, 0.07, 0.2, doorU, sill + 0.035, 0.1, RH_MARBLE, { skip: 'nz ny', ol: true });                                   // marble threshold (fix M1)
  S.quad(F, 1.0, 0.5, doorU, sill + dH + 0.3, 0.05, '#4f6676');
  if (RL() < 0.5) S.glow(F, 0.9, 0.4, doorU, sill + dH + 0.3, 0.06, litCol());
  S.box(F, 1.0, 0.06, 0.1, doorU, sill + dH + 0.03, 0.06, '#c9b48a', { skip: 'nz' });
  const dg = String(num).slice(0, 3).split(''); dg.forEach((d, i) => S.decal(F, 0.15, 0.22, doorU + (i - 1) * 0.16, sill + dH + 0.32, 0.07, 'd' + d));
  if (hood) { S.box(F, 1.7, 0.1, 0.38, doorU, sill + dH + 1.05, 0.19, corCol, { skip: 'nz ny', ol: true }); for (const s of [-0.62, 0.62]) S.box(F, 0, 0, 0, doorU + s, sill + dH + 0.75, 0.1, rhTone(corCol, 0.8), { geom: S.wedge(0.1, 0.3, 0.28), ol: false }); }
  for (let i = 0; i < nSteps; i++) { // each step a solid block (front, top, both sides), marble with a cool shadow band at the foot of every riser
    const sd = stoopP - i * (stoopP / nSteps), top = (i + 1) * rise;
    S.box(F, stoopW, top, sd, doorU, top / 2, sd / 2, RH_MARBLE, { skip: 'nz ny', ol: true });
    S.quad(F, stoopW, rise * 0.3, doorU, i * rise + rise * 0.15, sd + 0.006, '#aeb4c6');
    S.box(F, stoopW + 0.06, 0.04, 0.05, doorU, top + 0.02, sd + 0.01, '#f2f2f2', { skip: 'nz ny' });
  }
  for (const s of [-1, 1]) { // iron handrails: two posts and a sloping rail each side
    const rx = doorU + s * (stoopW / 2 - 0.03), ph = 0.8;
    for (const [pz, py] of [[stoopP - 0.12, rise + ph / 2], [0.12, sill + ph / 2]]) S.box(F, 0.05, ph, 0.05, rx, py, pz, RH_IRON, { skip: 'ny' });
    const len = Math.hypot(stoopP - 0.24, sill - rise), g = S.bx(0.04, 0.04, len, 'nz pz'); g.rotateX(Math.atan2(sill - rise, stoopP - 0.24)); // slope rises toward the door
    S.box(F, 0, 0, 0, rx, (rise + sill) / 2 + ph, (stoopP) / 2, RH_IRON, { geom: g });
  }
  S.coll(doorU - stoopW / 2, doorU + stoopW / 2, 0, stoopP);

  // ---- bracketed cornice with dentils ----
  S.box(F, W, 0.42, 0.1, 0, Htot - 0.21, 0.05, rhTone(corCol, 0.82), { skip: 'nz ny' });                                   // frieze
  S.box(F, W, 0.34, corP, 0, Htot + 0.15, corP / 2, corCol, { skip: 'nz', ol: true });
  S.box(F, W, 0.12, corP + 0.1, 0, Htot + 0.38, (corP + 0.1) / 2, rhTone(corCol, 1.12), { skip: 'nz', ol: true });
  const brU = []; for (let i = 0; i < nBr; i++) { const u = -W / 2 + (i + 0.5) * W / nBr; brU.push(u); S.box(F, 0, 0, 0, u, Htot - 0.42, 0.1, rhTone(corCol, 0.95), { geom: S.wedge(0.16, 0.4, corP - 0.14), ol: false }); }
  for (let u = -W / 2 + 0.1; u < W / 2 - 0.05; u += 0.15) { if (brU.some((b) => Math.abs(b - u) < 0.16)) continue; S.box(F, 0.07, 0.1, 0.06, u, Htot - 0.07, corP - 0.07, '#e0d4b0', { skip: 'nz py' }); }

  // ---- downspout, roof details ----
  const dsU = doorBay === 0 ? W / 2 - 0.12 : -W / 2 + 0.12;
  S.box(F, 0, 0, 0, dsU, (Htot + 0.3) / 2, 0.07, '#4f5a52', { geom: new K.THREE.CylinderGeometry(0.05, 0.05, Htot + 0.3, 6, 1, true) });
  S.box(F, 0.14, 0.16, 0.14, dsU, 0.1, 0.1, '#4f5a52', { skip: 'ny' });
  S.box(F, 0.9, 0.5, 0.9, -W / 4, roofY + 0.31, -D + 2.2, '#6f6a62', { skip: 'ny', ol: true });                           // roof hatch + lid
  S.box(F, 1.0, 0.08, 1.0, -W / 4, roofY + 0.6, -D + 2.2, '#4f5a52', { skip: 'ny' });
  if (chimney) S.box(F, 0.6, 1.6, 0.9, W / 4, roofY + 0.8, -D + 1.4, '#8a4a3a', { skip: 'ny', ol: true });
  if (deck) { // rooftop deck: planks, posts and two rails
    const dz = -D + 6, dw = W - 1.0, dd = 3.2; S.box(F, dw, 0.14, dd, 0, roofY + 0.07, dz, '#9a6a44', { skip: 'ny' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box(F, 0.06, 0.9, 0.06, sx * (dw / 2 - 0.05), roofY + 0.55, dz + sz * (dd / 2 - 0.05), RH_IRON, { skip: 'ny' });
    for (const ry of [0.55, 0.95]) { S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz - dd / 2 + 0.05, RH_IRON, { skip: 'ny' }); S.box(F, dw, 0.04, 0.04, 0, roofY + ry, dz + dd / 2 - 0.05, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, -dw / 2 + 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); S.box(F, 0.04, 0.04, dd, dw / 2 - 0.05, roofY + ry, dz, RH_IRON, { skip: 'ny' }); }
  }

  // ---- gameplay data: footprint collider, camera box, climb hook ----
  S.coll(-W / 2, W / 2, 0, -D); S.bld(-W / 2, W / 2, 0, -D, S.CURB + parTop);                   // heights in world y (fix m1)
  if (opts.climb) { const [hx, hz] = S.toWorld(dsU, 0.12); out.hook('climb', { x: hx, z: hz, ang: ang, top: S.CURB + parTop }); }
  return { width: W, depth: D, height: parTop };
}

// track.js — grid pieces -> ribbon geometry, collision grid, checkpoints, centre line.
// Pure data + THREE math: runs in the browser and in node (headless sim/bot tests).
// Grid: cell S metres, level H metres. A piece is placed at an entry cell (gx,gz), heading dir (0:+z 1:+x 2:-z 3:-x),
// level L, mirror m. Local frame: entry point at the cell's back edge centre, heading +z; local +x is the driver's LEFT.
export const S = 12, H = 4, W = 9, THICK = 0.6;
const TAU = Math.PI * 2;
const sstep = (t) => t * t * (3 - 2 * t);
const s5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ---- piece library (local coords). path(u) -> [x, y, z, upx, upy, upz]; n = samples. exit: [di, dj, turn(+1 left), dLevel]
const BANK = 0.46, LOOP_R = 8;
// loop sideways drift profile: integral of a trapezoid (eased ends), normalised to 0..1
const LOOP_TAB = (() => { const n = 400, e = 0.13, t = new Float32Array(n + 1); let acc = 0;
  for (let i = 1; i <= n; i++) { const v = (i - 0.5) / n; acc += sstep(clamp01(v / e)) * sstep(clamp01((1 - v) / e)); t[i] = acc; }
  for (let i = 0; i <= n; i++) t[i] /= acc; return t; })();
function loopShift(v) { const f = clamp01(v) * 400, i = Math.min(399, Math.floor(f)); return LOOP_TAB[i] + (LOOP_TAB[i + 1] - LOOP_TAB[i]) * (f - i); }
export const PIECES = {
  straight: { name: 'Straight', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 4, path: (u) => [0, 0, u * S, 0, 1, 0] },
  start: { name: 'Start', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 4, gate: 'start', path: (u) => [0, 0, u * S, 0, 1, 0] },
  finish: { name: 'Finish', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 4, gate: 'finish', path: (u) => [0, 0, u * S, 0, 1, 0] },
  checkpoint: { name: 'Checkpoint', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 4, gate: 'cp', path: (u) => [0, 0, u * S, 0, 1, 0] },
  turn: { name: 'Turn', cells: [[0, 0]], exit: [1, 0, 1, 0], n: 12, kerb: true, rails: [0, 1],
    path: (u) => { const a = u * Math.PI / 2, r = S / 2; return [r - r * Math.cos(a), 0, r * Math.sin(a), 0, 1, 0]; } },
  bank: { name: 'Banked turn', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], exit: [2, 1, 1, 0], n: 28, kerb: true, rails: [0, 1],
    path: (u) => {
      const a = u * Math.PI / 2, r = 1.5 * S, x = r - r * Math.cos(a), z = r * Math.sin(a);
      const b = BANK * sstep(clamp01(u / 0.38)) * sstep(clamp01((1 - u) / 0.38));
      let tx = r - x, tz = -z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      return [x, 0, z, Math.sin(b) * tx, Math.cos(b), Math.sin(b) * tz];
    } },
  ramp: { name: 'Ramp up', cells: [[0, 0], [0, 1]], exit: [0, 2, 0, 1], n: 16, up: 1, path: (u) => [0, H * s5(u), u * 2 * S, 0, 1, 0] },
  rampdown: { name: 'Ramp down', cells: [[0, 0], [0, 1]], exit: [0, 2, 0, -1], n: 16, up: -1, path: (u) => [0, -H * s5(u), u * 2 * S, 0, 1, 0] },
  kicker: { name: 'Jump kicker', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 12, kerb: true,
    path: (u) => { const z = u * S, k = Math.max(0, (z - 3) / (S - 3)); return [0, 1.5 * k * k, z, 0, 1, 0]; } },
  loop: { name: 'Loop', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], exit: [1, 2, 0, 0], n: 110, rails: [1, 1], loop: true,
    path: (u) => {
      // 0..a0 entry straight, a0..a1 full loop, a1..1 exit straight. The loop drifts one cell sideways at a near-constant
      // rate (a helix is a geodesic on the cylinder, so the car needs almost no steering inside it); the drift eases in/out at the bottom.
      const R = LOOP_R, a0 = 0.14, a1 = 0.86;
      if (u <= a0) return [0, 0, (u / a0) * S, 0, 1, 0];
      if (u >= a1) return [S, 0, S + ((u - a1) / (1 - a1)) * S, 0, 1, 0];
      const v = (u - a0) / (a1 - a0), th = v * TAU, x = S * loopShift(v);
      const y = R * (1 - Math.cos(th)), z = S + R * Math.sin(th);
      return [x, y, z, 0, R - y, S - z];
    } },
  gap: { name: 'Gap', cells: [[0, 0]], exit: [0, 1, 0, 0], n: 0, path: null },
};
export const BUILDER_PIECES = ['straight', 'turn', 'bank', 'loop', 'kicker', 'ramp', 'checkpoint', 'start', 'finish'];

const DV = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function rot(d, x, z) { // local (x,z) -> world offset for heading d
  const c = [1, 0, -1, 0][d], s = [0, 1, 0, -1][d];
  return [x * c + z * s, z * c - x * s];
}
export function pieceCells(p) { // world cells [gx,gz,level] a placed piece occupies
  const def = PIECES[p.type], out = [];
  for (const [i, j] of def.cells) {
    const [ox, oz] = rot(p.dir, p.m ? -i : i, j);
    out.push([p.gx + Math.round(ox), p.gz + Math.round(oz), p.L]);
    if (def.up) out.push([p.gx + Math.round(ox), p.gz + Math.round(oz), p.L + def.up]);
    if (def.loop) { out.push([p.gx + Math.round(ox), p.gz + Math.round(oz), p.L + 1]); out.push([p.gx + Math.round(ox), p.gz + Math.round(oz), p.L + 2]); out.push([p.gx + Math.round(ox), p.gz + Math.round(oz), p.L + 3]); }
  }
  return out;
}
export function pieceExit(p) {
  const def = PIECES[p.type], [di, dj, turn, dl] = def.exit;
  const [ox, oz] = rot(p.dir, p.m ? -di : di, dj);
  return { gx: p.gx + Math.round(ox), gz: p.gz + Math.round(oz), dir: (p.dir + (p.m ? -turn : turn) + 4) % 4, L: p.L + dl };
}
// chain a list of [type, mirror] from a start placement -> placed pieces
export function chain(list, s0 = { gx: 0, gz: 0, dir: 0, L: 0 }) {
  const out = []; let c = s0;
  for (const it of list) { const [type, m] = Array.isArray(it) ? it : [it, 0]; const p = { type, gx: c.gx, gz: c.gz, dir: c.dir, L: c.L, m: m ? 1 : 0 }; out.push(p); c = pieceExit(p); }
  return { pieces: out, end: c };
}
// local point -> world for a placed piece
function toWorld(p, x, y, z, out, o) {
  const xx = p.m ? -x : x; const [wx, wz] = rot(p.dir, xx, z);
  const [dx, dz] = DV[p.dir];
  out[o] = p.gx * S - dx * S / 2 + wx; out[o + 1] = p.L * H + y; out[o + 2] = p.gz * S - dz * S / 2 + wz;
}
function dirWorld(p, x, y, z, out, o) { const xx = p.m ? -x : x; const [wx, wz] = rot(p.dir, xx, z); out[o] = wx; out[o + 1] = y; out[o + 2] = wz; }

// frames along a placed piece: arrays of {p:[x,y,z], f:[..], s:[..](right), u:[..]}
export function pieceFrames(p) {
  const def = PIECES[p.type]; if (!def.path) return [];
  const n = def.n, P = [], U = [], tmp = [0, 0, 0];
  for (let i = 0; i <= n; i++) {
    const r = def.path(i / n); const a = [0, 0, 0], b = [0, 0, 0];
    toWorld(p, r[0], r[1], r[2], a, 0); dirWorld(p, r[3], r[4], r[5], b, 0);
    const l = Math.hypot(b[0], b[1], b[2]) || 1; b[0] /= l; b[1] /= l; b[2] /= l; P.push(a); U.push(b);
  }
  const F = [];
  for (let i = 0; i <= n; i++) {
    let a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)];
    if (i === 0) { const r = def.path(0.001); toWorld(p, r[0], r[1], r[2], tmp, 0); b = tmp.slice(); a = P[0]; }
    if (i === n) { const r = def.path(0.999); toWorld(p, r[0], r[1], r[2], tmp, 0); a = tmp.slice(); b = P[n]; }
    let fx = b[0] - a[0], fy = b[1] - a[1], fz = b[2] - a[2]; const l = Math.hypot(fx, fy, fz) || 1; F.push([fx / l, fy / l, fz / l]);
  }
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = F[i], uh = U[i];
    let sx = f[1] * uh[2] - f[2] * uh[1], sy = f[2] * uh[0] - f[0] * uh[2], sz = f[0] * uh[1] - f[1] * uh[0];
    const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
    const ux = sy * f[2] - sz * f[1], uy = sz * f[0] - sx * f[2], uz = sx * f[1] - sy * f[0];
    out.push({ p: P[i], f, s: [sx, sy, sz], u: [ux, uy, uz] });
  }
  return out;
}

// ---- triangle soup builder (positions, colours, collision flag) ----
export class Soup {
  constructor() { this.pos = []; this.col = []; this.colTris = []; }
  tri(a, b, c, col, collide = true) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < 3; k++) this.col.push(col[0], col[1], col[2]);
    if (collide) this.colTris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  quad(a, b, c, d, col, collide) { this.tri(a, b, c, col, collide); this.tri(a, c, d, col, collide); }
  box(cx, cy, cz, hx, hy, hz, col, collide = true, colTop) { // axis-aligned
    const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
    const t = colTop || col;
    this.quad(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), t, collide);
    this.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), col, collide);
    this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), col, collide);
    this.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), col, collide);
    this.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), col, collide);
    this.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), col, collide);
  }
  // oriented box from a frame (centre c, axes s,u,f with half sizes)
  obox(c, s, u, f, hs, hu, hf, col, collide = true, colTop) {
    const v = (a, b, d) => [c[0] + s[0] * a * hs + u[0] * b * hu + f[0] * d * hf, c[1] + s[1] * a * hs + u[1] * b * hu + f[1] * d * hf, c[2] + s[2] * a * hs + u[2] * b * hu + f[2] * d * hf];
    const t = colTop || col;
    this.quad(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), t, collide);
    this.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), col, collide);
    this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), col, collide);
    this.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), col, collide);
    this.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), col, collide);
    this.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), col, collide);
  }
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export const PAL = {
  asphalt: hex('#4a4f72'), asphalt2: hex('#555b80'), line: hex('#f6f1e4'), kerbR: hex('#ff4d5e'), kerbW: hex('#fff6ea'),
  side: hex('#ffb347'), bottom: hex('#c0603a'), rail: hex('#fff6ea'), railTop: hex('#ff5fa2'), pillar: hex('#ffcf8a'),
  gateY: hex('#ffd23c'), gateDark: hex('#2b2140'), check1: hex('#14101f'), check2: hex('#fff6ea'), boost: hex('#36e0c8'),
};

// extrude a road ribbon from frames into the soup
function ribbon(soup, fr, def, p) {
  const n = fr.length - 1; if (n < 1) return;
  const hw = W / 2, K = 0.7, LN = 0.25;
  const cuts = [-hw, -hw + K, -hw + K + LN, hw - K - LN, hw - K, hw];
  let rails = def.rails ? def.rails.slice() : [0, 0]; if (p.m) rails = [rails[1], rails[0]];
  const pt = (F, so, uo) => [F.p[0] + F.s[0] * so + F.u[0] * uo, F.p[1] + F.s[1] * so + F.u[1] * uo, F.p[2] + F.s[2] * so + F.u[2] * uo];
  for (let i = 0; i < n; i++) {
    const A = fr[i], B = fr[i + 1];
    const kc = def.kerb ? ((i & 1) ? PAL.kerbR : PAL.kerbW) : PAL.asphalt2;
    const cols = [kc, PAL.line, (i & 1) && !def.kerb ? PAL.asphalt : PAL.asphalt, PAL.line, kc];
    // top strips (driver's right is +s; our cuts run -hw (left) .. +hw (right))
    for (let k = 0; k < 5; k++) soup.quad(pt(A, cuts[k], 0), pt(A, cuts[k + 1], 0), pt(B, cuts[k + 1], 0), pt(B, cuts[k], 0), cols[k]);
    // slab sides + bottom
    soup.quad(pt(A, hw, 0), pt(A, hw, -THICK), pt(B, hw, -THICK), pt(B, hw, 0), PAL.side);
    soup.quad(pt(A, -hw, -THICK), pt(A, -hw, 0), pt(B, -hw, 0), pt(B, -hw, -THICK), PAL.side);
    soup.quad(pt(A, hw, -THICK), pt(A, -hw, -THICK), pt(B, -hw, -THICK), pt(B, hw, -THICK), PAL.bottom);
    // rails: [left, right]
    const RH = 0.75, RW = 0.4;
    for (const side of [0, 1]) {
      if (!rails[side]) continue; const sg = side ? 1 : -1, i0 = sg * hw, i1 = sg * (hw + RW);
      const inner = side ? [pt(A, i0, 0), pt(A, i0, RH), pt(B, i0, RH), pt(B, i0, 0)] : [pt(A, i0, RH), pt(A, i0, 0), pt(B, i0, 0), pt(B, i0, RH)];
      soup.quad(inner[0], inner[1], inner[2], inner[3], (i & 1) ? PAL.rail : PAL.railTop);
      const top = side ? [pt(A, i0, RH), pt(A, i1, RH), pt(B, i1, RH), pt(B, i0, RH)] : [pt(A, i1, RH), pt(A, i0, RH), pt(B, i0, RH), pt(B, i1, RH)];
      soup.quad(top[0], top[1], top[2], top[3], PAL.railTop);
      const out = side ? [pt(A, i1, RH), pt(A, i1, -THICK), pt(B, i1, -THICK), pt(B, i1, RH)] : [pt(A, i1, -THICK), pt(A, i1, RH), pt(B, i1, RH), pt(B, i1, -THICK)];
      soup.quad(out[0], out[1], out[2], out[3], PAL.side);
      const bot = side ? [pt(A, i1, -THICK), pt(A, i0, -THICK), pt(B, i0, -THICK), pt(B, i1, -THICK)] : [pt(A, i0, -THICK), pt(A, i1, -THICK), pt(B, i1, -THICK), pt(B, i0, -THICK)];
      soup.quad(bot[0], bot[1], bot[2], bot[3], PAL.bottom);
    }
  }
  // end caps are left open: neighbouring pieces butt together
}

// gates: arch over the road at the frame index gi
function gate(soup, F, kind, gates, idx) {
  const hw = W / 2 + 0.9, ph = 5.2, c = (so, uo, fo) => [F.p[0] + F.s[0] * so + F.u[0] * uo + F.f[0] * fo, F.p[1] + F.s[1] * so + F.u[1] * uo + F.f[1] * fo, F.p[2] + F.s[2] * so + F.u[2] * uo + F.f[2] * fo];
  const col = kind === 'cp' ? PAL.gateY : kind === 'finish' ? PAL.check2 : PAL.boost;
  for (const sg of [-1, 1]) soup.obox(c(sg * hw, ph / 2 - 0.3, 0), F.s, F.u, F.f, 0.45, ph / 2 + 0.3, 0.45, PAL.gateDark, true, col);
  // top beam: kept out of collision (it is high), separate list so the game can recolour checkpoints
  gates.push({ kind, idx, p: F.p.slice(), f: F.f.slice(), s: F.s.slice(), u: F.u.slice(), hw, ph });
  if (kind !== 'cp') {
    // chequered line on the road
    const n = 10, w = (W) / n;
    for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) {
      const so0 = -W / 2 + k * w, so1 = so0 + w, f0 = -0.8 + r * 0.8, f1 = f0 + 0.8;
      soup.quad(c(so0, 0.02, f0), c(so1, 0.02, f0), c(so1, 0.02, f1), c(so0, 0.02, f1), ((k + r) & 1) ? PAL.check1 : PAL.check2, false);
    }
  }
}

// support pillars under elevated pieces (down into the sea)
function pillars(soup, fr, every, seaY) {
  for (let i = 0; i < fr.length; i += every) {
    const F = fr[i]; if (F.u[1] < 0.8) continue; const top = F.p[1] - THICK; if (top - seaY < 2) continue;
    const h = (top - seaY) / 2; soup.box(F.p[0], seaY + h, F.p[2], 0.7, h, 0.7, PAL.pillar, true, PAL.pillar);
  }
}

// ---- build a whole track ----
export function buildTrack(pieces, opts = {}) {
  const seaY = opts.seaY ?? -9;
  const soup = new Soup(), gates = [], line = [];
  let cpCount = 0;
  pieces.forEach((p, pi) => {
    const def = PIECES[p.type]; const fr = pieceFrames(p); if (!fr.length) return;
    ribbon(soup, fr, def, p);
    pillars(soup, fr, def.loop ? 6 : Math.max(2, fr.length - 1), seaY);
    if (def.loop) { // loop: two big posts under the top
      const F = fr[Math.round(fr.length / 2)]; soup.box(F.p[0], (F.p[1] + seaY) / 2, F.p[2], 0.6, (F.p[1] - seaY) / 2 - 0.4, 0.6, PAL.pillar, false);
    }
    if (def.gate) { const gi = Math.round(fr.length / 2); gate(soup, fr[gi], def.gate, gates, def.gate === 'cp' ? cpCount++ : 0); }
    for (let i = 0; i < fr.length - 1; i++) line.push({ p: fr[i].p, f: fr[i].f, u: fr[i].u, s: fr[i].s, piece: pi, type: p.type });
  });
  const grid = new TriGrid(soup.colTris, 4);
  const start = gates.find((g) => g.kind === 'start') || null;
  return { soup, gates, line, grid, start, cpCount, seaY };
}

// ---- collision: uniform 3D hash grid of triangles; raycast + sphere contacts ----
export class TriGrid {
  constructor(tris, cell = 4) {
    const n = tris.length / 9; this.n = n; this.cell = cell; this.inv = 1 / cell;
    this.T = new Float32Array(tris); this.N = new Float32Array(n * 3); this.map = new Map(); this.stamp = new Uint32Array(n); this.sv = 1;
    const T = this.T, N = this.N;
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz) || 1;
      N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
      const x0 = Math.min(T[o], T[o + 3], T[o + 6]), x1 = Math.max(T[o], T[o + 3], T[o + 6]);
      const y0 = Math.min(T[o + 1], T[o + 4], T[o + 7]), y1 = Math.max(T[o + 1], T[o + 4], T[o + 7]);
      const z0 = Math.min(T[o + 2], T[o + 5], T[o + 8]), z1 = Math.max(T[o + 2], T[o + 5], T[o + 8]);
      for (let ix = Math.floor(x0 * this.inv); ix <= Math.floor(x1 * this.inv); ix++)
        for (let iy = Math.floor(y0 * this.inv); iy <= Math.floor(y1 * this.inv); iy++)
          for (let iz = Math.floor(z0 * this.inv); iz <= Math.floor(z1 * this.inv); iz++) {
            const k = this.key(ix, iy, iz); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(i);
          }
    }
  }
  key(ix, iy, iz) { return ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512); }
  _cells(x0, y0, z0, x1, y1, z1, fn) {
    this.sv++; if (this.sv > 4e9) { this.stamp.fill(0); this.sv = 1; }
    const sv = this.sv, st = this.stamp;
    const ax = Math.floor(x0 * this.inv), bx = Math.floor(x1 * this.inv), ay = Math.floor(y0 * this.inv), by = Math.floor(y1 * this.inv), az = Math.floor(z0 * this.inv), bz = Math.floor(z1 * this.inv);
    for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) {
      const a = this.map.get(this.key(ix, iy, iz)); if (!a) continue;
      for (let j = 0; j < a.length; j++) { const t = a[j]; if (st[t] === sv) continue; st[t] = sv; fn(t); }
    }
  }
  // front-face raycast. hit: {t, nx, ny, nz}. returns true when something is hit within maxT
  raycast(ox, oy, oz, dx, dy, dz, maxT, hit) {
    const ex = ox + dx * maxT, ey = oy + dy * maxT, ez = oz + dz * maxT, T = this.T, N = this.N;
    let best = maxT, found = false;
    this._cells(Math.min(ox, ex), Math.min(oy, ey), Math.min(oz, ez), Math.max(ox, ex), Math.max(oy, ey), Math.max(oz, ez), (i) => {
      const nd = N[i * 3] * dx + N[i * 3 + 1] * dy + N[i * 3 + 2] * dz; if (nd > -1e-4) return;
      const o = i * 9, ax = T[o], ay = T[o + 1], az = T[o + 2];
      const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az, e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-9) return; const id = 1 / det;
      const sx = ox - ax, sy = oy - ay, sz = oz - az; const u = (sx * px + sy * py + sz * pz) * id; if (u < 0 || u > 1) return;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x; const v = (dx * qx + dy * qy + dz * qz) * id; if (v < 0 || u + v > 1) return;
      const t = (e2x * qx + e2y * qy + e2z * qz) * id; if (t < 0 || t >= best) return;
      best = t; found = true; hit.nx = N[i * 3]; hit.ny = N[i * 3 + 1]; hit.nz = N[i * 3 + 2];
    });
    if (found) hit.t = best; return found;
  }
  // sphere vs one-sided slabs: calls cb(nx,ny,nz,depth) per contact
  sphere(cx, cy, cz, r, cb) {
    const T = this.T, N = this.N;
    this._cells(cx - r, cy - r, cz - r, cx + r, cy + r, cz + r, (i) => {
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], o = i * 9;
      const s = (cx - T[o]) * nx + (cy - T[o + 1]) * ny + (cz - T[o + 2]) * nz;
      if (s > r || s < -THICK * 0.9) return;
      const q = closestOnTri(cx, cy, cz, T, o);
      const qx = cx - q[0], qy = cy - q[1], qz = cz - q[2]; const d = Math.hypot(qx, qy, qz);
      const inside = Math.abs(d - Math.abs(s)) < 1e-4;
      if (inside) { cb(nx, ny, nz, r - s); return; }
      if (s > 0 && d < r && d > 1e-6) cb(qx / d, qy / d, qz / d, r - d);
    });
  }
}
const _q = [0, 0, 0];
function closestOnTri(px, py, pz, T, o) { // Ericson, real-time collision detection 5.1.5
  const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { _q[0] = ax; _q[1] = ay; _q[2] = az; return _q; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { _q[0] = bx; _q[1] = by; _q[2] = bz; return _q; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); _q[0] = ax + abx * v; _q[1] = ay + aby * v; _q[2] = az + abz * v; return _q; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { _q[0] = cx; _q[1] = cy; _q[2] = cz; return _q; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); _q[0] = ax + acx * w; _q[1] = ay + acy * w; _q[2] = az + acz * w; return _q; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); _q[0] = bx + (cx - bx) * w; _q[1] = by + (cy - by) * w; _q[2] = bz + (cz - bz) * w; return _q; }
  const dn = 1 / (va + vb + vc), v = vb * dn, w = vc * dn;
  _q[0] = ax + abx * v + acx * w; _q[1] = ay + aby * v + acy * w; _q[2] = az + abz * v + acz * w; return _q;
}

// ---- the main track: "Harbor Loop" (Hark original layout) ----
const st = (n) => Array(n).fill('straight');
export const MAIN_LAYOUT = ['start', ...st(2), 'ramp', ...st(3), 'kicker', 'gap', 'gap', ...st(2), 'checkpoint', ['bank', 1], 'straight', 'turn', ['turn', 1], 'straight',
  'straight', 'rampdown', ...st(2), 'loop', 'straight', 'checkpoint', ['turn', 1], ...st(5), 'kicker', 'gap', 'straight', ...st(6), 'checkpoint', ['bank', 1],
  ...st(8), 'turn', ['turn', 1], ...st(3), ['turn', 1]];
export const MAIN_PIECES = () => chain(MAIN_LAYOUT).pieces;
export function overlapReport(pieces) {
  const m = new Map(), bad = [];
  pieces.forEach((p, i) => { for (const c of pieceCells(p)) { const k = c.join(','); if (m.has(k)) bad.push([k, m.get(k), i]); else m.set(k, i); } });
  return bad;
}

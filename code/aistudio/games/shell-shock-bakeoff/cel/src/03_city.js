
// ---------------- merged city builder: one tiled-atlas mesh (+ decals) and one outline hull mesh ----------------
class MB {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.R = []; }
  vert(p, n, uv, c, tr) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(uv[0], uv[1]); this.C.push(c.r, c.g, c.b); this.R.push(tr[0], tr[1], tr[2], tr[3]); }
  // a b c d counter-clockwise seen from the front; uv = [u0, v0, u1, v1] in tile repeats
  quad(a, b, c, d, uv, col, tr) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; const n = [nx / l, ny / l, nz / l];
    const C = col instanceof THREE.Color ? col : new THREE.Color(col || '#fff'), t = tr || T.white;
    const [u0, v0, u1, v1] = uv || [0.02, 0.02, 0.98, 0.98];
    const A = [u0, v0], B = [u1, v0], Cc = [u1, v1], D = [u0, v1];
    this.vert(a, n, A, C, t); this.vert(b, n, B, C, t); this.vert(c, n, Cc, C, t);
    this.vert(a, n, A, C, t); this.vert(c, n, Cc, C, t); this.vert(d, n, D, C, t);
  }
  // wall from (xa,za) to (xb,zb), seen from the front with xa on the left
  wall(xa, za, xb, zb, y0, y1, tr, col, uv) { this.quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], uv, col, tr); }
  floor(x0, z0, x1, z1, y, tr, col, tileM = 4) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tileM, -z1 / tileM, x1 / tileM, -z0 / tileM], col, tr); }
  box(x0, y0, z0, x1, y1, z1, col, tr, opt = {}) {
    const t = tr || T.white, uv = opt.uv;
    this.wall(x0, z1, x1, z1, y0, y1, t, col, uv); this.wall(x1, z0, x0, z0, y0, y1, t, col, uv);
    this.wall(x1, z1, x1, z0, y0, y1, t, col, uv); this.wall(x0, z0, x0, z1, y0, y1, t, col, uv);
    if (opt.top !== false) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], null, opt.topCol || col, opt.topTr || t);
    if (opt.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], null, col, t);
  }
  geom(g, col, tr, uvScale = 1) { // any BufferGeometry (already transformed), uv from the geometry
    g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; const C = new THREE.Color(col), t = tr || T.white;
    for (let i = 0; i < p.count; i++) {
      const u = uv ? [uv.getX(i) * uvScale * 0.96 + 0.02, uv.getY(i) * 0.96 + 0.02] : [0.5, 0.5];
      this.vert([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], u, C, t);
    }
  }
  build(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('tr', new THREE.Float32BufferAttribute(this.R, 4)); g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
class OB { // outline hulls
  constructor() { this.P = []; this.D = []; }
  geom(g) {
    g = g.index ? g.toNonIndexed() : g.clone(); addOdir(g); const p = g.attributes.position, d = g.attributes.odir;
    for (let i = 0; i < p.count; i++) { this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.D.push(d.getX(i), d.getY(i), d.getZ(i)); }
  }
  box(x0, y0, z0, x1, y1, z1) { // exact box hull: corners pushed along (+-1,+-1,+-1)
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).toNonIndexed();
    const p = g.attributes.position, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); this.P.push(x, y, z); this.D.push(Math.sign(x - cx), Math.sign(y - cy), Math.sign(z - cz)); }
  }
  build(mat) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('odir', new THREE.Float32BufferAttribute(this.D, 3)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
  }
}
const CB = new MB(), DB = new MB(), OL = new OB(), GB = new MB(); // city, decals, outlines, ground (no shadow cast)
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- layout ----------------
// Origin = middle of the crossing. X east, Z south. Roads |x|<7 (N-S) and |z|<7 (E-W), sidewalks to 11, buildings from 11 out to 46.
const RW = 7, SW = 11, ARM = 46, LIM = 42.5, CURB = 0.16;
const GF = 4.4, FH = 3.4, PAR = 1.3;
function isRoad(x, z) { return Math.abs(x) < RW || Math.abs(z) < RW; }
function groundY(x, z) { return isRoad(x, z) ? 0 : CURB; }

// ground: road + sidewalks
(function ground() {
  const roadC = '#ffffff';
  GB.floor(-RW, -ARM - 14, RW, ARM + 14, 0, T.road, roadC, 6); // N-S road
  GB.floor(-ARM - 14, -RW, -RW, RW, 0, T.road, roadC, 6); GB.floor(RW, -RW, ARM + 14, RW, 0, T.road, roadC, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // L-shaped corner sidewalks
    const xa = sx > 0 ? RW : -SW, xb = sx > 0 ? SW : -RW, za = sz > 0 ? RW : -ARM - 14, zb = sz > 0 ? ARM + 14 : -RW;
    GB.floor(xa, za, xb, zb, CURB, T.walk, '#fff', 2);
    const xc = sx > 0 ? SW : -ARM - 14, xd = sx > 0 ? ARM + 14 : -SW, zc = sz > 0 ? RW : -SW, zd = sz > 0 ? SW : -RW;
    GB.floor(xc, zc, xd, zd, CURB, T.walk, '#fff', 2);
    // curbs (yellow at the corner, grey along the street)
    const cx = sx * RW, cz = sz * RW;
    const curbCol = (d) => (d < 6 ? '#ffd23c' : '#b9add6');
    for (let d = 0; d < ARM + 14 - RW; d += 6) {
      const a = RW + d, b = Math.min(a + 6, ARM + 14), col = curbCol(d);
      if (sx > 0) GB.wall(cx, sz > 0 ? a : -b, cx, sz > 0 ? b : -a, 0, CURB, T.white, col); else GB.wall(cx, sz > 0 ? b : -a, cx, sz > 0 ? a : -b, 0, CURB, T.white, col);
      if (sz > 0) GB.wall(sx > 0 ? b : -a, cz, sx > 0 ? a : -b, cz, 0, CURB, T.white, col); else GB.wall(sx > 0 ? a : -b, cz, sx > 0 ? b : -a, cz, 0, CURB, T.white, col);
    }
  }
  // road paint (decal mesh: no shadow cast)
  const W = new THREE.Color('#fbf7ff'), Y = new THREE.Color('#ffd23c'), y = 0.012;
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const at = (along, across) => (ax ? [ax * along, across] : [across, az * along]);
    const strip = (a0, a1, c0, c1, col) => { const p = at(a0, c0), q = at(a1, c1); DB.floor(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), y, T.white, col); };
    for (let c = -RW + 0.6; c < RW - 0.6; c += 1.25) strip(7.6, 10.4, c, c + 0.65, W); // zebra
    strip(11.0, 11.4, ax || az ? 0.2 : 0, RW - 0.3, W); // stop line (one side)
    for (let a = 13; a < ARM + 10; a += 4.5) { strip(a, a + 2.4, -0.28, -0.1, Y); strip(a, a + 2.4, 0.1, 0.28, Y); }
    strip(11.4, ARM + 12, RW - 0.55, RW - 0.4, W); strip(11.4, ARM + 12, -RW + 0.4, -RW + 0.55, W);
  }
  // manholes
  for (const [x, z] of [[3, 18], [-3.5, -24], [22, -2.5], [-27, 3]]) { const g = new THREE.CylinderGeometry(0.75, 0.75, 0.04, 20); place(g, x, 0.0, z); CB.geom(g, '#2d2f55'); }
})();

// ---------------- buildings ----------------
function building(x0, z0, x1, z1, floors, pi, o = {}) {
  const h = GF + floors * FH + PAR, p = PAL[pi], trim = new THREE.Color(p.trim), wall = new THREE.Color(p.wall);
  const fac = T.fac[pi][o.v || 0], store = T.store[pi];
  const faces = { s: [x0, z1, x1, z1], n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], w: [x0, z0, x0, z1] };
  for (const k in faces) {
    const [xa, za, xb, zb] = faces[k], L = Math.hypot(xb - xa, zb - za), nb = Math.max(1, Math.round(L / 3.6));
    const shop = o.shops && o.shops.includes(k);
    if (shop) CB.wall(xa, za, xb, zb, 0, GF, store, '#fff', [0, 0, nb, 0.995]);
    else CB.wall(xa, za, xb, zb, 0, GF, T.white, wall.clone().multiplyScalar(0.92));
    CB.wall(xa, za, xb, zb, GF, GF + floors * FH, fac, '#fff', [0, 0, nb, floors]);
    CB.wall(xa, za, xb, zb, GF + floors * FH, h, T.white, wall);
  }
  CB.floor(x0, z0, x1, z1, h - 0.6, T.roof, '#fff', 4);
  OL.box(x0, 0, z0, x1, h, z1);
  BLD.push({ x0, x1, z0, z1, h });
  // parapet lip + cornice + belt course (trim colour, outlined)
  const c = 0.28; sbox(x0 - c, h - 0.45, z0 - c, x1 + c, h, z1 + c, trim);
  sbox(x0 - 0.14, GF - 0.05, z0 - 0.14, x1 + 0.14, GF + 0.3, z1 + 0.14, trim);
  sbox(x0 - 0.1, GF + floors * FH - 0.05, z0 - 0.1, x1 + 0.1, GF + floors * FH + 0.22, z1 + 0.1, trim, false);
  // roof: inner parapet walls so the sunk roof reads, a few rooftop units
  CB.wall(x0 + 0.01, z1 - 0.01, x1 - 0.01, z1 - 0.01, h - 0.6, h, T.white, wall); // (only seen from above: cheap)
  if (o.ac !== false) {
    const ax = lerp(x0, x1, 0.3), az = lerp(z0, z1, 0.65);
    sbox(ax - 1, h - 0.6, az - 0.7, ax + 1, h + 0.7, az + 0.7, '#cfd3e6'); sbox(ax - 0.7, h + 0.7, az - 0.45, ax + 0.7, h + 0.85, az + 0.45, '#9da3c2');
  }
  // storefront awnings + shop signs on the street faces
  if (o.shops) for (const k of o.shops) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux; // outward normal
    const nb = Math.max(1, Math.round(L / 3.6)), bw = L / nb;
    const sg = T.signs[(o.sign + (k.charCodeAt(0) % 3)) % T.signs.length];
    // sign centred on the face, in the sign band
    const sw = Math.min(6.2, L - 1), sc = L / 2, off = 0.05;
    DB.wall(xa + ux * (sc - sw / 2) + nx * off, za + uz * (sc - sw / 2) + nz * off, xa + ux * (sc + sw / 2) + nx * off, za + uz * (sc + sw / 2) + nz * off, GF - 0.98, GF - 0.18, sg, '#fff', [0.002, 0.002, 0.998, 0.998]);
    // awnings over every other bay (skip the sign bay)
    for (let b = 0; b < nb; b++) {
      const m = (b + 0.5) * bw; if (Math.abs(m - sc) < sw / 2 + 0.2) continue; if ((b + (o.sign || 0)) % 2) continue;
      const len = bw - 0.5, depth = 1.25, g = new THREE.BoxGeometry(len, 0.12, depth);
      g.translate(0, 0, depth / 2); g.rotateX(0.38);
      const ang = Math.atan2(nx, nz);
      place(g, xa + ux * m + nx * 0.02, GF - 0.95, za + uz * m + nz * 0.02, ang);
      CB.geom(g, p.trim, T.stripes, 4); OL.geom(g);
    }
  }
  if (o.fire) fireEscape(faces[o.fire], floors, o.fireAt || 0.7);
  if (o.tower) waterTower(lerp(x0, x1, o.tower[0]), h - 0.6, lerp(z0, z1, o.tower[1]));
  if (o.bill) billboardOn(faces[o.bill[0]], h - 0.6, o.bill[1]);
  if (o.graf) for (const [k, at, gi, y = 0.4, s = 1] of o.graf) {
    const [xa, za, xb, zb] = faces[k], dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux, w = 4.2 * s, m = at * L, off = 0.06;
    DB.wall(xa + ux * (m - w / 2) + nx * off, za + uz * (m - w / 2) + nz * off, xa + ux * (m + w / 2) + nx * off, za + uz * (m + w / 2) + nz * off, y, y + w / 2, T.graf[gi], '#fff', [0.002, 0.002, 0.998, 0.998]);
  }
  return h;
}
function fireEscape(face, floors, at) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = 3.6, d = 1.15, m = at * L, col = '#2b2340';
  const P = (s, t, y) => [xa + ux * s + nx * t, y, za + uz * s + nz * t];
  for (let f = 1; f <= floors; f++) {
    const y = GF + (f - 1) * FH + 0.02;
    // platform as an oriented box
    const g = new THREE.BoxGeometry(w, 0.1, d); place(g, P(m, d / 2, y)[0], y, P(m, d / 2, y)[2], Math.atan2(nx, nz)); CB.geom(g, col); OL.geom(g);
    // railings (front + sides), alpha-cut tile, double-sided decal
    const a = P(m - w / 2, d, y), b = P(m + w / 2, d, y), a0 = P(m - w / 2, 0.05, y), b0 = P(m + w / 2, 0.05, y);
    DB.quad(a, b, [b[0], y + 1.0, b[2]], [a[0], y + 1.0, a[2]], [0, 0, 3, 1], '#fff', T.rail);
    DB.quad(a0, a, [a[0], y + 1.0, a[2]], [a0[0], y + 1.0, a0[2]], [0, 0, 1, 1], '#fff', T.rail);
    DB.quad(b, b0, [b0[0], y + 1.0, b0[2]], [b[0], y + 1.0, b[2]], [0, 0, 1, 1], '#fff', T.rail);
    // stair to the next platform (diagonal)
    if (f < floors) { const s0 = f % 2 ? m - w / 2 + 0.2 : m + w / 2 - 0.2, s1 = f % 2 ? m + w / 2 - 1.0 : m - w / 2 + 1.0, t = 0.62;
      const q0 = P(s0, t - 0.35, y + 0.1), q1 = P(s1, t - 0.35, y + FH), q2 = P(s1, t + 0.35, y + FH), q3 = P(s0, t + 0.35, y + 0.1);
      DB.quad(q0, q3, q2, q1, [0, 0, 1, 4], '#fff', T.stair); }
    // drop ladder at the bottom
    if (f === 1) { const l0 = P(m + w / 2 - 0.6, d - 0.1, 1.6), l1 = P(m + w / 2 - 1.1, d - 0.1, 1.6);
      DB.quad(l0, l1, [l1[0], y, l1[2]], [l0[0], y, l0[2]], [0, 0, 1, 3], '#fff', T.stair); }
  }
}
function waterTower(x, y, z) {
  const legH = 2.6, r = 1.7, tankH = 2.9;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.1, 0.12, legH, 6); place(g, x + a * r * 0.62, y + legH / 2, z + b * r * 0.62); solid(g, '#2b2340'); }
  const cross = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross, x, y + legH * 0.55, z - r * 0.62); solid(cross, '#2b2340', false);
  const cross2 = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross2, x, y + legH * 0.55, z + r * 0.62); solid(cross2, '#2b2340', false);
  const tank = new THREE.CylinderGeometry(r, r * 1.04, tankH, 18, 1); place(tank, x, y + legH + tankH / 2, z); solid(tank, '#c46a3a');
  for (const k of [0.25, 0.7]) { const band = new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.14, 18, 1, true); place(band, x, y + legH + tankH * k, z); CB.geom(band, '#2b2340'); }
  const roof = new THREE.ConeGeometry(r * 1.12, 1.25, 18); place(roof, x, y + legH + tankH + 0.62, z); solid(roof, '#5a3a8a');
  const knob = new THREE.SphereGeometry(0.16, 8, 6); place(knob, x, y + legH + tankH + 1.3, z); solid(knob, '#ffd23c');
  BLD.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: y + legH + tankH + 1.3, y0: y });
}
function billboardOn(face, y, bi) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = Math.min(9, L - 1.5), hh = w / 2, m = L / 2, inset = 1.6, base = y + 1.6;
  const P = (s, t, yy) => [xa + ux * s - nx * t, yy, za + uz * s - nz * t];
  const ang = Math.atan2(nx, nz);
  for (const s of [m - w * 0.35, m + w * 0.35]) { const g = new THREE.BoxGeometry(0.22, base - y + 0.2, 0.22); const p = P(s, inset + 0.3, (y + base) / 2); place(g, p[0], p[1], p[2], ang); solid(g, '#2b2340'); }
  const back = new THREE.BoxGeometry(w + 0.5, hh + 0.5, 0.3); const pc = P(m, inset + 0.15, base + hh / 2); place(back, pc[0], pc[1], pc[2], ang); solid(back, '#2b2340');
  const a = P(m - w / 2, inset - 0.02, base), b = P(m + w / 2, inset - 0.02, base);
  CB.quad(a, b, [b[0], base + hh, b[2]], [a[0], base + hh, a[2]], [0.003, 0.003, 0.997, 0.997], '#fff', T.bill[bi]);
  // catwalk + lamps
  const cw = new THREE.BoxGeometry(w * 0.9, 0.08, 0.7); const pw = P(m, inset - 0.4, base - 0.1); place(cw, pw[0], pw[1], pw[2], ang); solid(cw, '#2b2340');
  for (const s of [m - w * 0.3, m + w * 0.3]) { const g = new THREE.BoxGeometry(0.5, 0.18, 0.3); const p = P(s, inset - 0.7, base + hh + 0.35); place(g, p[0], p[1], p[2], ang, 0.5); solid(g, '#ffd23c'); }
}

// four corner blocks: [sx, sz]; each has a tall corner tower + a building down each street + an end-of-street cap
const CORNERS = [
  { s: [1, -1], pal: [0, 3, 1], tower: true, bill: 0, sign: 0 },  // NE
  { s: [-1, -1], pal: [1, 5, 4], tower: false, bill: 1, sign: 2 }, // NW
  { s: [1, 1], pal: [4, 2, 0], tower: false, bill: 2, sign: 4 },  // SE
  { s: [-1, 1], pal: [2, 0, 3], tower: true, bill: 3, sign: 6 },  // SW
];
// faces seen from the streets per quadrant: ew street side = (sz>0 ? 'n' : 's'), ns street side = (sx>0 ? 'w' : 'e')
CORNERS.forEach((C, ci) => {
  const [sx, sz] = C.s, ew = sz > 0 ? 'n' : 's', ns = sx > 0 ? 'w' : 'e';
  const box = (a0, a1, b0, b1) => { const xs = [sx * a0, sx * a1], zs = [sz * b0, sz * b1]; return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; };
  const fl = [6 + (ci % 2) * 2, 3 + (ci % 3), 4 + ((ci + 1) % 3)];
  // corner tower
  let [x0, z0, x1, z1] = box(SW, SW + 13, SW, SW + 13);
  building(x0, z0, x1, z1, fl[0], C.pal[0], { shops: [ew, ns], sign: C.sign, v: 1, fire: ci % 2 ? ns : ew, fireAt: 0.62,
    tower: C.tower ? [sx > 0 ? 0.68 : 0.32, sz > 0 ? 0.68 : 0.32] : null, bill: C.tower ? null : [ci % 2 ? ew : ns, C.bill],
    graf: [[ci % 2 ? ew : ns, sx * sz > 0 ? 0.3 : 0.7, ci * 2 % 8, 0.35, 0.9]] });
  // down the E-W street
  [x0, z0, x1, z1] = box(SW + 13, SW + 23, SW, SW + 10);
  building(x0, z0, x1, z1, fl[1], C.pal[1], { shops: [ew], sign: C.sign + 1, fire: (ci % 2) ? null : ew, fireAt: 0.5, tower: C.tower ? null : [0.5, 0.5],
    graf: [[ew, 0.5, (ci * 2 + 1) % 8, 4.6, 1.3]] });
  [x0, z0, x1, z1] = box(SW + 23, ARM, SW, SW + 12);
  building(x0, z0, x1, z1, fl[0] - 1, C.pal[2], { shops: [ew], sign: C.sign + 3, v: 1, bill: C.tower ? [ew, (C.bill + 1) % 4] : null,
    graf: [[ew, 0.35, (ci + 5) % 8, 0.3, 1]] });
  // down the N-S street
  [x0, z0, x1, z1] = box(SW, SW + 10, SW + 13, SW + 24);
  building(x0, z0, x1, z1, fl[2], C.pal[2], { shops: [ns], sign: C.sign + 5, fire: (ci % 2) ? ns : null, fireAt: 0.45, graf: [[ns, 0.55, (ci + 3) % 8, 0.35, 1.1]] });
  [x0, z0, x1, z1] = box(SW, SW + 12, SW + 24, ARM);
  building(x0, z0, x1, z1, fl[1] + 2, C.pal[1], { shops: [ns], sign: C.sign + 2, v: 1, tower: C.tower ? null : [sx > 0 ? 0.6 : 0.4, 0.5], graf: [[ns, 0.4, (ci + 6) % 8, 0.35, 1]] });
  // back fill (keeps the skyline solid from high camera angles)
  [x0, z0, x1, z1] = box(SW + 13, ARM, SW + 12, ARM);
  building(x0, z0, x1, z1, 3, C.pal[0], { ac: false });
});
// street-end caps (close each arm) + barriers
[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, az], i) => {
  const a0 = ARM + 1, a1 = ARM + 12, w = SW + 2;
  const [x0, z0, x1, z1] = ax ? [Math.min(ax * a0, ax * a1), -w, Math.max(ax * a0, ax * a1), w] : [-w, Math.min(az * a0, az * a1), w, Math.max(az * a0, az * a1)];
  const face = ax > 0 ? 'w' : ax < 0 ? 'e' : az > 0 ? 'n' : 's';
  building(x0, z0, x1, z1, 5 + (i % 2) * 2, (i + 2) % 6, { shops: [face], sign: i * 2 + 1, v: i % 2, bill: [face, (i + 2) % 4], graf: [[face, 0.2, (i * 3) % 8, 0.3, 1], [face, 0.82, (i * 3 + 4) % 8, 0.3, 1]] });
  // jersey barriers (orange/white)
  for (let c = -RW + 0.4; c < RW - 0.4; c += 2.2) {
    const g = new THREE.BoxGeometry(2.0, 0.85, 0.6); g.translate(0, 0.42, 0);
    const p = ax ? [ax * LIM + ax * 0.9, c + 1] : [c + 1, az * LIM + az * 0.9];
    place(g, p[0], 0, p[1], ax ? Math.PI / 2 : 0); solid(g, ((c / 2.2) | 0) % 2 ? '#ff7a2f' : '#fff0d6');
  }
});
// distant skyline silhouettes (unlit-ish, no outlines)
(function skyline() {
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * TAU + srnd() * 0.05, r = 95 + srnd() * 50, w = 8 + srnd() * 12, h = 22 + srnd() * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, g = new THREE.BoxGeometry(w, h, w); place(g, x, h / 2, z, -a);
    CB.geom(g, ['#b07ad8', '#c88ee0', '#9a6cd0', '#d79ad8'][i % 4]);
  }
})();

// ---------------- street props ----------------
function lamp(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.11, 0.15, 5.2, 8); place(g, x, CURB + 2.6, z); solid(g, '#2b6f7a');
  const arm = new THREE.BoxGeometry(0.12, 0.12, 1.6); arm.translate(0, 0, 0.8); place(arm, x, CURB + 5.1, z, ang); solid(arm, '#2b6f7a');
  const head = new THREE.CylinderGeometry(0.18, 0.42, 0.32, 10); place(head, x + Math.sin(ang) * 1.6, CURB + 4.95, z + Math.cos(ang) * 1.6); solid(head, '#ffd23c');
  COLL.push({ x, z, r: 0.3 });
}
function trafficLight(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 8); place(g, x, CURB + 2.8, z); solid(g, '#ffd23c');
  const arm = new THREE.BoxGeometry(0.14, 0.14, 4.2); arm.translate(0, 0, 2.1); place(arm, x, CURB + 5.4, z, ang); solid(arm, '#ffd23c');
  const hx = x + Math.sin(ang) * 3.6, hz = z + Math.cos(ang) * 3.6;
  const box = new THREE.BoxGeometry(0.5, 1.4, 0.45); place(box, hx, CURB + 4.6, hz, ang); solid(box, '#2b2340');
  const px = Math.cos(ang), pz = -Math.sin(ang);
  ['#ff3d6e', '#ffd23c', '#7dff6b'].forEach((c, i) => { for (const sd of [-1, 1]) { const l = new THREE.SphereGeometry(0.14, 10, 8); place(l, hx + px * 0.24 * sd, CURB + 5.05 - i * 0.43, hz + pz * 0.24 * sd); CB.geom(l, c); } });
  COLL.push({ x, z, r: 0.3 });
}
function hydrant(x, z) {
  const b = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10); place(b, x, CURB + 0.35, z); solid(b, '#ff3d6e');
  const t = new THREE.SphereGeometry(0.22, 10, 6, 0, TAU, 0, Math.PI / 2); place(t, x, CURB + 0.7, z); solid(t, '#ff3d6e');
  const n = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8); place(n, x, CURB + 0.45, z, 0, 0, Math.PI / 2); solid(n, '#ffd23c');
  COLL.push({ x, z, r: 0.35 });
}
function bin(x, z, col = '#22c4b4') {
  const b = new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12); place(b, x, CURB + 0.48, z); solid(b, col);
  const l = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12); place(l, x, CURB + 1.0, z); solid(l, '#2b2340');
  COLL.push({ x, z, r: 0.45 });
}
function dumpster(x, z, ang) {
  const g = new THREE.BoxGeometry(2.4, 1.3, 1.3); g.translate(0, 0.65, 0); place(g, x, CURB, z, ang); solid(g, '#2f9e5a');
  const l = new THREE.BoxGeometry(2.5, 0.12, 1.4); l.rotateX(-0.12); l.translate(0, 1.36, 0); place(l, x, CURB, z, ang); solid(l, '#1f6e3f');
  const s = Math.abs(Math.sin(ang)) > 0.5; COLL.push(s ? { x0: x - 0.7, x1: x + 0.7, z0: z - 1.25, z1: z + 1.25 } : { x0: x - 1.25, x1: x + 1.25, z0: z - 0.7, z1: z + 0.7 });
}
function car(x, z, ang, body, roofC) {
  const grp = []; const along = Math.abs(Math.sin(ang)) > 0.5; // along x
  const add = (g, col, ol = true) => { place(g, x, 0, z, ang); solid(g, col, ol); };
  const b = new THREE.BoxGeometry(1.9, 0.75, 4.3); b.translate(0, 0.72, 0); add(b, body);
  const c = new THREE.BoxGeometry(1.7, 0.7, 2.2); c.translate(0, 1.45, -0.2); add(c, roofC || body);
  const wF = new THREE.BoxGeometry(1.5, 0.48, 0.05); wF.translate(0, 1.47, 0.9); add(wF, '#7fe8ff', false);
  const wB = new THREE.BoxGeometry(1.5, 0.48, 0.05); wB.translate(0, 1.47, -1.31); add(wB, '#7fe8ff', false);
  for (const s of [-1, 1]) { const ws = new THREE.BoxGeometry(0.05, 0.46, 1.8); ws.translate(s * 0.86, 1.47, -0.2); add(ws, '#7fe8ff', false); }
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2b2340'); }
  const hl = new THREE.BoxGeometry(1.5, 0.18, 0.06); hl.translate(0, 0.86, 2.16); add(hl, '#fff6b0', false);
  const tl = new THREE.BoxGeometry(1.5, 0.16, 0.06); tl.translate(0, 0.86, -2.16); add(tl, '#ff3d6e', false);
  COLL.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1.0, z1: z + 1.0 } : { x0: x - 1.0, x1: x + 1.0, z0: z - 2.2, z1: z + 2.2 });
  BLD.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1, z1: z + 1, h: 1.8 } : { x0: x - 1, x1: x + 1, z0: z - 2.2, z1: z + 2.2, h: 1.8 });
}
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  lamp(sx * 10.2, sz * 16, sx > 0 ? -Math.PI / 2 : Math.PI / 2); lamp(sx * 16, sz * 10.2, sz > 0 ? Math.PI : 0);
  lamp(sx * 10.2, sz * 34, sx > 0 ? -Math.PI / 2 : Math.PI / 2); lamp(sx * 34, sz * 10.2, sz > 0 ? Math.PI : 0);
  trafficLight(sx * 7.7, sz * 7.7, sx * sz > 0 ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : (sz > 0 ? Math.PI : 0));
  hydrant(sx * 8.1, sz * 21); bin(sx * 24, sz * 8.0, sx * sz > 0 ? '#22c4b4' : '#6b4cff');
}
dumpster(28, -9.6, 0); dumpster(-9.6, 28, Math.PI / 2); dumpster(-30, 9.6, 0);
car(20.5, -5.8, Math.PI / 2, '#ffd23c', '#ffd23c'); // taxi on the east arm, north curb
car(-28, 5.8, -Math.PI / 2, '#ff5fa2', '#fff0d6'); // pink coupe, west arm
car(5.8, -30, Math.PI, '#2fd3ff', '#1f7bff'); // blue hatch, north arm
// a taxi sign on the yellow car
{ const g = new THREE.BoxGeometry(0.7, 0.28, 0.3); place(g, 20.5, 1.95, -5.8, Math.PI / 2); solid(g, '#fff0d6'); }
// bunting across the north and east arms
function bunting(ax0, az0, ax1, az1, y) {
  const n = 16, cols = ['#ff3d6e', '#ffd23c', '#22c4b4', '#6b4cff', '#7dff6b'];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.8) / n, sag = (t) => -Math.sin(t * Math.PI) * 1.2;
    const a = [lerp(ax0, ax1, t0), y + sag(t0), lerp(az0, az1, t0)], b = [lerp(ax0, ax1, t1), y + sag(t1), lerp(az0, az1, t1)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.75, (a[2] + b[2]) / 2];
    DB.quad(a, b, m, m, [0, 0, 1, 1], cols[i % 5], T.white);
  }
}
bunting(-SW, -24, SW, -24, 9.5); bunting(26, -SW, 26, SW, 9.0); bunting(-SW, 30, SW, 30, 8.6);

const cityMesh = CB.build(CITY_MAT); cityMesh.castShadow = true; cityMesh.receiveShadow = true; cityMesh.frustumCulled = false; scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); groundMesh.receiveShadow = true; groundMesh.frustumCulled = false; scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); decalMesh.receiveShadow = true; decalMesh.frustumCulled = false; scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);

// sky dome: gradient + cartoon sun + outlined clouds
(function sky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f8cff') }, mid: { value: new THREE.Color('#8fd8ff') }, hor: { value: new THREE.Color('#ffc2d4') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;
      void main(){ float y = vP.y; vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
        c = mix(c, c * 0.93, step(0.5, fract((y) * 26.0)) * smoothstep(0.1, 0.6, y) * 0.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m); s.renderOrder = -10; scene.add(s); window.__sky = s;
  const cc = document.createElement('canvas'); cc.width = 512; cc.height = 256; const c = cc.getContext('2d');
  const blobs = [[120, 170, 70], [210, 130, 90], [320, 140, 80], [400, 175, 60], [260, 185, 70]];
  c.fillStyle = INK; blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.fill(); }); c.fillRect(60, 175, 400, 70);
  c.fillStyle = '#fff'; blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(66, 175, 388, 61);
  c.fillStyle = '#d9e6ff'; c.fillRect(66, 205, 388, 31);
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false })); const a = i / 9 * TAU + 0.3, r = 300;
    sp.position.set(Math.cos(a) * r, 70 + (i % 3) * 30, Math.sin(a) * r); sp.scale.set(110 + (i % 2) * 40, 55 + (i % 2) * 20, 1); sp.renderOrder = -9; s.add(sp);
  }
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const g = sc.getContext('2d');
  g.fillStyle = INK; g.beginPath(); for (let k = 0; k < 24; k++) { const r = k % 2 ? 100 : 124, a = k / 24 * TAU; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill();
  g.fillStyle = '#ffe14d'; g.beginPath(); for (let k = 0; k < 24; k++) { const r = k % 2 ? 90 : 112, a = k / 24 * TAU; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill();
  g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(128, 128, 70, 0, TAU); g.fill();
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, fog: false, depthWrite: false })); sunS.position.copy(SUN_DIR).multiplyScalar(330); sunS.scale.set(70, 70, 1); sunS.renderOrder = -9; s.add(sunS);
})();

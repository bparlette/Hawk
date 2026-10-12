
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
  floorSub(x0, z0, x1, z1, y, tr, col, tileM = 4, cell = 4) {
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) this.floor(lerp(x0, x1, i / nx), lerp(z0, z1, j / nz), lerp(x0, x1, (i + 1) / nx), lerp(z0, z1, (j + 1) / nz), y, tr, col, tileM);
  }
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
class OB { // outlines are not used in the 32-bit look: kept as a no-op so the shared builders still run
  geom() {} box() {}
  build(mat) { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; return m; }
}
const CB = new MB(), DB = new MB(), OL = new OB(), GB = new MB(); // city, decals, outlines, ground (no shadow cast)
const BLD = []; // camera collision boxes {x0,x1,z0,z1,h}
const COLL = []; // character colliders: circles {x,z,r} and boxes {x0,x1,z0,z1}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, x, y, z, ry = 0, rx = 0, rz = 0) { return g.applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))); }
function solid(g, col, outline = true, tr) { CB.geom(g, col, tr); if (outline) OL.geom(g); }
function sbox(x0, y0, z0, x1, y1, z1, col, outline = true, opt) { CB.box(x0, y0, z0, x1, y1, z1, col, null, opt); if (outline) OL.box(x0, y0, z0, x1, y1, z1); }

// ---------------- layout: ONE street (the old south arm), a single block long, running north-south ----------------
// X east, Z south. Road |x|<7, sidewalks to |x|<11, storefronts from |x|=11 out. Walkable z from ZMIN to ZMAX; both ends barricaded,
// capped by a building and swallowed by fog.
const RW = 7, SW = 11, ARM = 46, LIM = 42.5, CURB = 0.16;
const ZMIN = 3.6, ZMAX = 46.4, ZN = -2, ZS = 50; // walk limits; street ends (cap buildings start there)
const GF = 4.4, FH = 3.4, PAR = 1.3;
function isRoad(x, z) { return Math.abs(x) < RW; }
function groundY(x, z) { return isRoad(x, z) ? 0 : CURB; }

// ground: road + both sidewalks (subdivided), curbs, paint, one manhole
(function ground() {
  GB.floorSub(-RW, ZN - 2, RW, ZS + 2, 0, T.road, '#ffffff', 6, 4);
  for (const sx of [-1, 1]) {
    const xa = sx > 0 ? RW : -SW, xb = sx > 0 ? SW : -RW; GB.floorSub(xa, ZN - 2, xb, ZS + 2, CURB, T.walk, '#fff', 2, 4);
    for (let z = ZN - 2; z < ZS + 2; z += 6) { const z1 = Math.min(z + 6, ZS + 2), cx = sx * RW; if (sx > 0) GB.wall(cx, z, cx, z1, 0, CURB, T.white, '#9a958c'); else GB.wall(cx, z1, cx, z, 0, CURB, T.white, '#9a958c'); }
  }
  const W = new THREE.Color('#d8d4c8'), Y = new THREE.Color('#d8b040'), y = 0.012;
  for (let z = ZN; z < ZS; z += 4.5) { DB.floor(-0.28, z, -0.1, z + 2.4, y, T.white, Y); DB.floor(0.1, z, 0.28, z + 2.4, y, T.white, Y); }
  DB.floor(RW - 0.55, ZN, RW - 0.4, ZS, y, T.white, W); DB.floor(-RW + 0.4, ZN, -RW + 0.55, ZS, y, T.white, W);
  for (let x = -RW + 0.6; x < RW - 0.6; x += 1.25) DB.floor(x, 4.6, x + 0.65, 7.2, y, T.white, W); // zebra at the north end
  DB.floor(-RW + 0.4, 7.6, RW - 0.4, 7.95, y, T.white, W);
  // the manhole (with a little ring of rust)
  { const g = new THREE.CylinderGeometry(0.8, 0.8, 0.03, 10); place(g, 2.6, 0.0, 25); CB.geom(g, '#3a352f'); const g2 = new THREE.CylinderGeometry(0.62, 0.62, 0.04, 10); place(g2, 2.6, 0.0, 25); CB.geom(g2, '#2a2622'); }
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
  const w = 3.6, d = 1.15, m = at * L, col = '#2a2622';
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
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.1, 0.12, legH, 6); place(g, x + a * r * 0.62, y + legH / 2, z + b * r * 0.62); solid(g, '#2a2622'); }
  const cross = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross, x, y + legH * 0.55, z - r * 0.62); solid(cross, '#2a2622', false);
  const cross2 = new THREE.BoxGeometry(r * 1.6, 0.12, 0.12); place(cross2, x, y + legH * 0.55, z + r * 0.62); solid(cross2, '#2a2622', false);
  const tank = new THREE.CylinderGeometry(r, r * 1.04, tankH, 18, 1); place(tank, x, y + legH + tankH / 2, z); solid(tank, '#7a5a3a');
  for (const k of [0.25, 0.7]) { const band = new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.14, 18, 1, true); place(band, x, y + legH + tankH * k, z); CB.geom(band, '#2a2622'); }
  const roof = new THREE.ConeGeometry(r * 1.12, 1.25, 18); place(roof, x, y + legH + tankH + 0.62, z); solid(roof, '#4a3a2a');
  const knob = new THREE.SphereGeometry(0.16, 8, 6); place(knob, x, y + legH + tankH + 1.3, z); solid(knob, '#ffd23c');
  BLD.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: y + legH + tankH + 1.3, y0: y });
}
function billboardOn(face, y, bi) {
  const [xa, za, xb, zb] = face, dx = xb - xa, dz = zb - za, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
  const w = Math.min(9, L - 1.5), hh = w / 2, m = L / 2, inset = 1.6, base = y + 1.6;
  const P = (s, t, yy) => [xa + ux * s - nx * t, yy, za + uz * s - nz * t];
  const ang = Math.atan2(nx, nz);
  for (const s of [m - w * 0.35, m + w * 0.35]) { const g = new THREE.BoxGeometry(0.22, base - y + 0.2, 0.22); const p = P(s, inset + 0.3, (y + base) / 2); place(g, p[0], p[1], p[2], ang); solid(g, '#2a2622'); }
  const back = new THREE.BoxGeometry(w + 0.5, hh + 0.5, 0.3); const pc = P(m, inset + 0.15, base + hh / 2); place(back, pc[0], pc[1], pc[2], ang); solid(back, '#2a2622');
  const a = P(m - w / 2, inset - 0.02, base), b = P(m + w / 2, inset - 0.02, base);
  CB.quad(a, b, [b[0], base + hh, b[2]], [a[0], base + hh, a[2]], [0.003, 0.003, 0.997, 0.997], '#fff', T.bill[bi]);
  // catwalk + lamps
  const cw = new THREE.BoxGeometry(w * 0.9, 0.08, 0.7); const pw = P(m, inset - 0.4, base - 0.1); place(cw, pw[0], pw[1], pw[2], ang); solid(cw, '#2a2622');
  for (const s of [m - w * 0.3, m + w * 0.3]) { const g = new THREE.BoxGeometry(0.5, 0.18, 0.3); const p = P(s, inset - 0.7, base + hh + 0.35); place(g, p[0], p[1], p[2], ang, 0.5); solid(g, '#ffd23c'); }
}

// the street's two sides: storefronts at street level, tenement floors above, one alley building with the STAFF door
const WEST = [ // x from -24 to -11, faces east ('e')
  { z: [ZN, 9], fl: 4, pal: 0, sign: 0, o: { v: 1, fire: 'e', fireAt: 0.5 } },
  { z: [9, 20], fl: 3, pal: 2, sign: 2, o: { tower: [0.4, 0.5] } },
  { z: [20, 28.6], fl: 5, pal: 1, sign: 4, o: { v: 1 } },
  { z: [28.6, 38], fl: 3, pal: 3, sign: -1, o: { graf: [['e', 0.78, 0, 0.35, 0.9]] } }, // the alley building: the STAFF door is on this face
  { z: [38, ZS], fl: 4, pal: 5, sign: 6, o: { bill: ['e', 1] } },
];
const EAST = [ // x from 11 to 24, faces west ('w')
  { z: [ZN, 7], fl: 5, pal: 4, sign: 1, o: {} },
  { z: [7, 17], fl: 3, pal: 0, sign: 3, o: { v: 1, graf: [['w', 0.5, 2, 4.8, 1.1]] } },
  { z: [17, 29], fl: 4, pal: 5, sign: 5, o: { fire: 'w', fireAt: 0.4 } },
  { z: [29, 40], fl: 6, pal: 2, sign: 7, o: { v: 1 } },
  { z: [40, ZS], fl: 3, pal: 1, sign: 0, o: { tower: [0.6, 0.5], graf: [['w', 0.3, 5, 0.35, 1]] } },
];
for (const B of WEST) building(-24, B.z[0], -SW, B.z[1], B.fl, B.pal, Object.assign({ shops: B.sign >= 0 ? ['e'] : null, sign: B.sign }, B.o));
for (const B of EAST) building(SW, B.z[0], 24, B.z[1], B.fl, B.pal, Object.assign({ shops: ['w'], sign: B.sign }, B.o));
// back fill behind both rows (keeps the skyline solid from the intro crane)
building(-34, ZN, -24, ZS, 7, 1, { ac: false }); building(24, ZN, 34, ZS, 8, 3, { ac: false });
// the street ends: a building across each end + jersey barriers (orange/white) + a ROAD CLOSED board
building(-24, ZN - 12, 24, ZN, 6, 2, { shops: ['s'], sign: 6, v: 1, bill: ['s', 2] });
building(-24, ZS, 24, ZS + 12, 5, 4, { shops: ['n'], sign: 3, graf: [['n', 0.2, 6, 0.3, 1], ['n', 0.82, 7, 0.3, 1]] });
for (const zb of [ZMIN - 1.6, ZMAX + 1.4]) {
  for (let c = -SW + 0.4; c < SW - 0.4; c += 2.2) {
    const g = new THREE.BoxGeometry(2.0, 0.85, 0.6); g.translate(0, 0.42, 0); place(g, c + 1, Math.abs(c + 1) < RW ? 0 : CURB, zb); solid(g, ((c / 2.2) | 0) % 2 ? '#c8642a' : '#d8d0c0');
  }
  const post = (x) => { const g = new THREE.BoxGeometry(0.12, 1.9, 0.12); place(g, x, 0.95, zb); solid(g, '#2a2622'); };
  post(-1.6); post(1.6); const bd = new THREE.BoxGeometry(3.6, 0.7, 0.08); place(bd, 0, 1.75, zb); CB.geom(bd, '#d8d0c0', T.stripes);
  const bd2 = new THREE.BoxGeometry(3.4, 0.22, 0.1); place(bd2, 0, 1.75, zb); solid(bd2, '#b02a2a');
  BLD.push({ x0: -SW, x1: SW, z0: zb - 0.3, z1: zb + 0.3, h: 0.9 });
}

// ---------------- street props ----------------
function lamp(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.11, 0.15, 5.2, 6); place(g, x, CURB + 2.6, z); solid(g, '#2c322e');
  const arm = new THREE.BoxGeometry(0.12, 0.12, 1.6); arm.translate(0, 0, 0.8); place(arm, x, CURB + 5.1, z, ang); solid(arm, '#2c322e');
  const head = new THREE.CylinderGeometry(0.18, 0.42, 0.32, 6); place(head, x + Math.sin(ang) * 1.6, CURB + 4.95, z + Math.cos(ang) * 1.6); solid(head, '#5a5a4a');
  COLL.push({ x, z, r: 0.3 });
}
function trafficLight(x, z, ang) {
  const g = new THREE.CylinderGeometry(0.12, 0.14, 5.6, 8); place(g, x, CURB + 2.8, z); solid(g, '#ffd23c');
  const arm = new THREE.BoxGeometry(0.14, 0.14, 4.2); arm.translate(0, 0, 2.1); place(arm, x, CURB + 5.4, z, ang); solid(arm, '#ffd23c');
  const hx = x + Math.sin(ang) * 3.6, hz = z + Math.cos(ang) * 3.6;
  const box = new THREE.BoxGeometry(0.5, 1.4, 0.45); place(box, hx, CURB + 4.6, hz, ang); solid(box, '#2a2622');
  const px = Math.cos(ang), pz = -Math.sin(ang);
  ['#ff3d6e', '#ffd23c', '#7dff6b'].forEach((c, i) => { for (const sd of [-1, 1]) { const l = new THREE.SphereGeometry(0.14, 10, 8); place(l, hx + px * 0.24 * sd, CURB + 5.05 - i * 0.43, hz + pz * 0.24 * sd); CB.geom(l, c); } });
  COLL.push({ x, z, r: 0.3 });
}
function hydrant(x, z) {
  const b = new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10); place(b, x, CURB + 0.35, z); solid(b, '#a8302a');
  const t = new THREE.SphereGeometry(0.22, 8, 4, 0, TAU, 0, Math.PI / 2); place(t, x, CURB + 0.7, z); solid(t, '#a8302a');
  const n = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8); place(n, x, CURB + 0.45, z, 0, 0, Math.PI / 2); solid(n, '#ffd23c');
  COLL.push({ x, z, r: 0.35 });
}
function bin(x, z, col = '#22c4b4') {
  const b = new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12); place(b, x, CURB + 0.48, z); solid(b, col);
  const l = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12); place(l, x, CURB + 1.0, z); solid(l, '#2a2622');
  COLL.push({ x, z, r: 0.45 });
}
function dumpster(x, z, ang) {
  const g = new THREE.BoxGeometry(2.4, 1.3, 1.3); g.translate(0, 0.65, 0); place(g, x, CURB, z, ang); solid(g, '#2f5a3a');
  const l = new THREE.BoxGeometry(2.5, 0.12, 1.4); l.rotateX(-0.12); l.translate(0, 1.36, 0); place(l, x, CURB, z, ang); solid(l, '#1f3a2a');
  const s = Math.abs(Math.sin(ang)) > 0.5; COLL.push(s ? { x0: x - 0.7, x1: x + 0.7, z0: z - 1.25, z1: z + 1.25 } : { x0: x - 1.25, x1: x + 1.25, z0: z - 0.7, z1: z + 0.7 });
}
function car(x, z, ang, body, roofC) {
  const grp = []; const along = Math.abs(Math.sin(ang)) > 0.5; // along x
  const add = (g, col, ol = true) => { place(g, x, 0, z, ang); solid(g, col, ol); };
  const b = new THREE.BoxGeometry(1.9, 0.75, 4.3); b.translate(0, 0.72, 0); add(b, body);
  const c = new THREE.BoxGeometry(1.7, 0.7, 2.2); c.translate(0, 1.45, -0.2); add(c, roofC || body);
  const wF = new THREE.BoxGeometry(1.5, 0.48, 0.05); wF.translate(0, 1.47, 0.9); add(wF, '#6a8a9a', false);
  const wB = new THREE.BoxGeometry(1.5, 0.48, 0.05); wB.translate(0, 1.47, -1.31); add(wB, '#6a8a9a', false);
  for (const s of [-1, 1]) { const ws = new THREE.BoxGeometry(0.05, 0.46, 1.8); ws.translate(s * 0.86, 1.47, -0.2); add(ws, '#6a8a9a', false); }
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14); w.rotateZ(Math.PI / 2); w.translate(wx, 0.42, wz); add(w, '#2a2622'); }
  const hl = new THREE.BoxGeometry(1.5, 0.18, 0.06); hl.translate(0, 0.86, 2.16); add(hl, '#efe4b0', false);
  const tl = new THREE.BoxGeometry(1.5, 0.16, 0.06); tl.translate(0, 0.86, -2.16); add(tl, '#ff3d6e', false);
  COLL.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1.0, z1: z + 1.0 } : { x0: x - 1.0, x1: x + 1.0, z0: z - 2.2, z1: z + 2.2 });
  BLD.push(along ? { x0: x - 2.2, x1: x + 2.2, z0: z - 1, z1: z + 1, h: 1.8 } : { x0: x - 1, x1: x + 1, z0: z - 2.2, z1: z + 2.2, h: 1.8 });
}
// street furniture along the one block
const LAMPS = [];
function lampAt(x, z) { const ang = x < 0 ? Math.PI / 2 : -Math.PI / 2; lamp(x, z, ang); LAMPS.push({ x: x + Math.sin(ang) * 1.6, z: z + Math.cos(ang) * 1.6, y: CURB + 4.8, px: x, pz: z }); }
lampAt(-10.2, 12); lampAt(10.2, 21); lampAt(-10.2, 33.5); lampAt(10.2, 44);
hydrant(8.1, 28.5); hydrant(-8.1, 14.5);
bin(9.8, 15.5, '#3a5a4a'); bin(-9.8, 24.5, '#4a4a5a'); bin(9.8, 34.2, '#3a5a4a');
dumpster(-9.6, 35.6, Math.PI / 2); // in the alley mouth beside the STAFF door
car(-5.8, 18.5, 0, '#a83a4a', '#d8d0c0'); // maroon coupe, west curb
car(5.8, 10.5, Math.PI, '#d8a830', '#d8a830'); // taxi, east curb
car(5.8, 37.5, Math.PI, '#3a5a8a', '#2a3a5a'); // blue hatch, east curb
{ const g = new THREE.BoxGeometry(0.3, 0.28, 0.7); place(g, 5.8, 1.95, 10.7, Math.PI); solid(g, '#efe4cc'); } // taxi roof sign
// bunting across the street
function bunting(ax0, az0, ax1, az1, y) {
  const n = 14, cols = ['#a83a3a', '#c8a040', '#3a7a6a', '#4a4a8a', '#7a9a4a'];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.8) / n, sag = (t) => -Math.sin(t * Math.PI) * 1.2;
    const a = [lerp(ax0, ax1, t0), y + sag(t0), lerp(az0, az1, t0)], b = [lerp(ax0, ax1, t1), y + sag(t1), lerp(az0, az1, t1)];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.75, (a[2] + b[2]) / 2];
    DB.quad(a, b, m, m, [0, 0, 1, 1], cols[i % 5], T.white);
  }
}
bunting(-SW, 26.5, SW, 26.5, 8.8);
// kept for shared code paths (06b/06c): there is no climbable fire escape or rooftop on this street any more
const LADDER = { x: 999, z: 999, top: 0, roofY: 0 };

const cityMesh = CB.build(CITY_MAT); cityMesh.castShadow = true; cityMesh.receiveShadow = true; cityMesh.frustumCulled = false; scene.add(cityMesh);
const groundMesh = GB.build(CITY_MAT); groundMesh.receiveShadow = true; groundMesh.frustumCulled = false; scene.add(groundMesh);
const decalMesh = DB.build(DECAL_MAT); decalMesh.receiveShadow = true; decalMesh.frustumCulled = false; scene.add(decalMesh);
const cityOutline = OL.build(OUT_CITY); scene.add(cityOutline);

// sky dome (inside the short draw distance): gradient + stars at night, a sun / moon disc, a few low-res clouds; recoloured by the cycle
const SKY = (function sky() {
  const U = { top: { value: new THREE.Color('#4a86c8') }, mid: { value: new THREE.Color('#9cc4dc') }, hor: { value: new THREE.Color('#d8dccf') }, uStars: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform float uStars; varying vec3 vP;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
        vec3 q = floor(vP * 160.0); float s = step(0.996, h3(q)) * smoothstep(0.12, 0.4, y);
        c += vec3(0.9, 0.92, 1.0) * s * uStars;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(85, 16, 10), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s); window.__sky = s;
  const disc = (inner, outer, glow) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16); gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(0.55, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); };
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#fffbe8', '#ffe9a0', 'rgba(255,220,140,.35)'), fog: false, depthWrite: false, transparent: true }));
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc('#f4f6ff', '#d8e0f0', 'rgba(180,200,255,.25)'), fog: false, depthWrite: false, transparent: true }));
  sunS.scale.set(16, 16, 1); moonS.scale.set(9, 9, 1); sunS.renderOrder = moonS.renderOrder = -9; s.add(sunS, moonS);
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 32; const c = cc.getContext('2d'); c.fillStyle = '#fff';
  [[16, 22, 10], [28, 16, 12], [42, 18, 10], [52, 23, 7]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }); c.fillRect(8, 22, 50, 8);
  const ct = lowTex(cc, 64), clouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true })); const a = i / 7 * TAU + 0.3, r = 75;
    sp.position.set(Math.cos(a) * r, 22 + (i % 3) * 9, Math.sin(a) * r); sp.scale.set(28 + (i % 2) * 10, 13 + (i % 2) * 4, 1); sp.renderOrder = -9; s.add(sp); clouds.push(sp);
  }
  return { U, sunS, moonS, clouds };
})();

// ---------------- night lights: lamp glow pools + halos, point lights, and the BINGO neon blade sign ----------------
const NIGHTFX = { pools: [], halos: [], lights: [], neon: null };
(function nightFx() {
  const pool = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(0.5, 'rgba(255,130,40,.55)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return lowTex(c, 32); })();
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,80,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return lowTex(c, 32); })();
  for (const L of LAMPS) {
    const m = basicSnap({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), m); q.rotation.x = -Math.PI / 2; q.position.set(L.x, groundY(L.x, L.z) + 0.03, L.z); q.renderOrder = 2; scene.add(q); NIGHTFX.pools.push(q);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })); h.position.set(L.x, L.y - 0.1, L.z); h.scale.set(2.6, 2.6, 1); scene.add(h); NIGHTFX.halos.push(h);
    const pl = new THREE.PointLight('#ffa050', 0, 14, 1.3); pl.position.set(L.x, L.y - 0.6, L.z); scene.add(pl); NIGHTFX.lights.push(pl);
  }
  // BINGO: a vertical neon blade sign sticking out of the east building over the sidewalk (z ~ 33)
  const nc = document.createElement('canvas'); nc.width = 64; nc.height = 256; const g = nc.getContext('2d');
  g.fillStyle = '#1a1018'; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#ff4fa0'; g.lineWidth = 5; g.strokeRect(5, 5, 54, 246);
  g.font = '900 44px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff6ab8'; 'BINGO'.split('').forEach((ch, i) => g.fillText(ch, 32, 30 + i * 49));
  const nt = lowTex(nc, 64);
  const mat = basicSnap({ map: nt, color: new THREE.Color(0.35, 0.35, 0.35) });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 1.3), mat); blade.position.set(SW - 1.0, GF + 3.6, 33); scene.add(blade);
  for (const y of [GF + 1.2, GF + 6.0]) { const br = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), basicSnap({ color: '#2a2622' })); br.position.set(SW - 0.6, y, 33); scene.add(br); }
  const nl = new THREE.PointLight('#ff4fa0', 0, 13, 1.2); nl.position.set(SW - 2.2, GF + 3.0, 33); scene.add(nl);
  NIGHTFX.neon = { mat, light: nl };
})();


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

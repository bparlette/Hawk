// world.js — layout queries shared by the ground painter, the sim and the renderer.
// Everything here is pure: same layout in, same answers out.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x, y, seed = 0, oct = 3) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x * f, y * f, seed + i * 17) * amp;
    n += amp; amp *= 0.5; f *= 2.03;
  }
  return s / n;
}

export class World {
  constructor(layout) {
    this.L = layout;
    const R = layout.roads;
    this.halfRoad = R.width / 2;
    this.walkEdge = this.halfRoad + R.sidewalk;
    const l = R.loop;
    // Loop as straight segments + quarter arcs (clockwise on screen: top edge west->east).
    this.segs = [
      [l.x0 + l.r, l.y0, l.x1 - l.r, l.y0],
      [l.x1, l.y0 + l.r, l.x1, l.y1 - l.r],
      [l.x1 - l.r, l.y1, l.x0 + l.r, l.y1],
      [l.x0, l.y1 - l.r, l.x0, l.y0 + l.r],
      ...R.streets.map(s => [s.x0, s.y0, s.x1, s.y1]),
    ];
    this.arcs = [
      { cx: l.x1 - l.r, cy: l.y0 + l.r, a0: -Math.PI / 2, a1: 0 },
      { cx: l.x1 - l.r, cy: l.y1 - l.r, a0: 0, a1: Math.PI / 2 },
      { cx: l.x0 + l.r, cy: l.y1 - l.r, a0: Math.PI / 2, a1: Math.PI },
      { cx: l.x0 + l.r, cy: l.y0 + l.r, a0: Math.PI, a1: Math.PI * 1.5 },
    ].map(a => ({ ...a, r: l.r }));
    this.loopPath = this.buildLoopPath();
    this.solids = layout.buildings.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.d, id: b.id }));
  }

  shoreX(y) {
    const s = this.L.shore;
    return s.x + Math.sin(y * 0.011) * s.amp + Math.sin(y * 0.037 + 1.3) * s.amp * 0.4;
  }

  // Distance to nearest road centreline, plus the road's direction there (unit vector).
  roadInfo(x, y) {
    let best = 1e9, dx = 1, dy = 0;
    for (const [x0, y0, x1, y1] of this.segs) {
      const vx = x1 - x0, vy = y1 - y0;
      const len2 = vx * vx + vy * vy;
      let t = ((x - x0) * vx + (y - y0) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x0 + vx * t - x, py = y0 + vy * t - y;
      const d = Math.hypot(px, py);
      if (d < best) { best = d; const L = Math.sqrt(len2); dx = vx / L; dy = vy / L; }
    }
    for (const a of this.arcs) {
      let ang = Math.atan2(y - a.cy, x - a.cx);
      if (ang < a.a0 - 1e-6) ang += Math.PI * 2;
      if (ang >= a.a0 && ang <= a.a1) {
        const d = Math.abs(Math.hypot(x - a.cx, y - a.cy) - a.r);
        if (d < best) { best = d; dx = -Math.sin(ang); dy = Math.cos(ang); }
      }
    }
    return { d: best, dx, dy };
  }

  // Surface type at a world point. `wobble` perturbs soft edges (grass/paving) so they never look ruled.
  surfaceAt(x, y, wobble = 0) {
    const sx = this.shoreX(y);
    if (x > sx + wobble * 6) return 'water';
    if (x > sx - 72 + wobble * 10) return 'sand';
    const r = this.roadInfo(x, y);
    if (r.d < this.halfRoad) return 'road';
    if (r.d < this.walkEdge) return 'sidewalk';
    const g = this.L.ground;
    for (let i = g.length - 1; i >= 0; i--) {
      const q = g[i], wb = (q.type === 'grass' ? wobble * 8 : 0);
      if (x > q.x - wb && x < q.x + q.w + wb && y > q.y - wb && y < q.y + q.h + wb) return q.type;
    }
    return 'paving';
  }

  isDrivable(x, y) {
    if (x < 0 || y < 0 || x > this.L.world.w || y > this.L.world.h) return false;
    if (x > this.shoreX(y) - 4) return false;
    return !this.hitSolid(x, y, 0);
  }

  hitSolid(x, y, pad) {
    for (const s of this.solids) {
      if (x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad) return s;
    }
    return null;
  }

  // Closed polyline along the loop centreline, clockwise on screen. Traffic lanes offset from it.
  buildLoopPath() {
    const l = this.L.roads.loop, pts = [];
    const arc = (cx, cy, a0, a1) => {
      for (let i = 0; i <= 8; i++) {
        const a = a0 + (a1 - a0) * i / 8;
        pts.push([cx + Math.cos(a) * l.r, cy + Math.sin(a) * l.r]);
      }
    };
    const step = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 60));
      for (let i = 1; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    };
    arc(l.x0 + l.r, l.y0 + l.r, Math.PI, Math.PI * 1.5);
    step(l.x0 + l.r, l.y0, l.x1 - l.r, l.y0);
    arc(l.x1 - l.r, l.y0 + l.r, -Math.PI / 2, 0);
    step(l.x1, l.y0 + l.r, l.x1, l.y1 - l.r);
    arc(l.x1 - l.r, l.y1 - l.r, 0, Math.PI / 2);
    step(l.x1 - l.r, l.y1, l.x0 + l.r, l.y1);
    arc(l.x0 + l.r, l.y1 - l.r, Math.PI / 2, Math.PI);
    step(l.x0, l.y1 - l.r, l.x0, l.y0 + l.r);
    // cumulative lengths
    const cum = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1], b = pts[i % pts.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    return { pts, cum, len: cum[cum.length - 1] };
  }

  // Point + tangent at arc-length s along the loop, offset sideways by `off` (+ = right of travel).
  loopAt(s, off = 0) {
    const P = this.loopPath;
    s = ((s % P.len) + P.len) % P.len;
    let lo = 0, hi = P.pts.length;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
    const a = P.pts[lo], b = P.pts[(lo + 1) % P.pts.length];
    const seg = P.cum[lo + 1] - P.cum[lo];
    const t = seg > 0 ? (s - P.cum[lo]) / seg : 0;
    const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t - ty * off, y: a[1] + (b[1] - a[1]) * t + tx * off, tx, ty };
  }

  // Nearest loop arc-length to a point (coarse search then refine).
  loopNearest(x, y) {
    const P = this.loopPath;
    let best = 1e18, bs = 0;
    for (let s = 0; s < P.len; s += 20) {
      const p = this.loopAt(s);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < best) { best = d; bs = s; }
    }
    return bs;
  }
}

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
  constructor(layout, shell = null) {
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
    // palm trunks: solid for everyone. `sc` is the palm's drawn scale (the renderer reads it from here).
    this.trunks = layout.palms.map(([x, y], i) => { const sc = 0.8 + ((i * 37) % 10) / 22; return { x, y, i, sc, r: 5.5 * sc }; });
    // World extension (shell): real-geography grid + road traces west of the core, from shell.json.
    // Purely additive: with no shell, bounds are exactly the core rect and every query is unchanged.
    this.bounds = { x0: 0, y0: 0, x1: layout.world.w, y1: layout.world.h };
    // The open sea (owner, Nov 16: "extend the water much further out so there is more place
    // to play on the boats and jet ski"): the land world (L.world / bounds) is unchanged, but
    // the navigable water runs well past its east and south edges. seaE/seaS are the limits
    // the craft physics, the on-water camera and the ground painter's grid use. Before this,
    // the craft limits WERE the world edges: ~405 units of water east of the shore, and the
    // island ran straight into the south edge. Now ~1110 east (~2.7x) and a 700-deep sea
    // south of the island. A buoy line marks both edges in play (watercraft.js).
    this.seaE = layout.world.w + 700;
    this.seaS = layout.world.h + 700;
    this.shell = null;
    if (shell) this.setShell(shell);
    this.bushes = this.buildBushes();
  }

  // Attach the extension shell (shell.json data + shell_layout.json buildings/palms/extra roads,
  // merged by the caller). Grid classes: 0 water, 1 land, 2 park on 10-unit cells.
  setShell(shell) {
    this.shell = shell;
    this.shellOx = shell.origin[0]; this.shellOy = shell.origin[1];
    this.shellCell = shell.cellSize; this.shellCols = shell.cols; this.shellRows = shell.rows;
    this.shellGrid = shell.grid;
    this.shellSegs = [];
    let maxX = -1e9;
    for (const r of [...(shell.roads || []), ...(shell.extraRoads || [])]) {
      const pts = r.points;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], hw = r.width / 2, m = r.width + 80;
        this.shellSegs.push({ x0, y0, x1, y1, hw, walk: r.walk || 6, name: r.name, bx0: Math.min(x0, x1) - m, bx1: Math.max(x0, x1) + m, by0: Math.min(y0, y1) - m, by1: Math.max(y0, y1) + m });
        maxX = Math.max(maxX, Math.max(x0, x1) + m);
      }
    }
    this.shellRoadMaxX = maxX;   // east of this, no shell road can be nearest: surfaceAt skips the scan
    this.shellBuildings = shell.buildings || [];
    for (const b of this.shellBuildings) this.solids.push({ x: b.x, y: b.y, w: b.w, h: b.d, id: b.id });
    this.shellPalms = shell.palms || [];
    for (const [x, y] of this.shellPalms) {
      const i = this.trunks.length, sc = 0.8 + ((i * 37) % 10) / 22;
      this.trunks.push({ x, y, i, sc, r: 5.5 * sc });
    }
    this.bounds = { x0: Math.min(0, this.shellOx), y0: 0, x1: this.L.world.w, y1: this.L.world.h };
    this.shellDistField = this.buildShellDist();
  }

  // Grid class at a point: 0 water, 1 land, 2 park; -1 outside the surveyed shell.
  shellClass(x, y) {
    const c = Math.floor((x - this.shellOx) / this.shellCell), r = Math.floor((y - this.shellOy) / this.shellCell);
    if (c < 0 || r < 0 || c >= this.shellCols || r >= this.shellRows) return -1;
    return this.shellGrid[r].charCodeAt(c) - 48;
  }

  // Chamfer distance transform over the shell grid: for water cells, distance (world units) to the
  // nearest land/park cell; 0 on land. Lets the painter's shore-calm falloff work on shell coasts.
  buildShellDist() {
    const { shellCols: C, shellRows: R, shellCell: CS } = this;
    const d = new Float32Array(C * R).fill(1e6);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (this.shellGrid[r].charCodeAt(c) !== 48) d[r * C + c] = 0;
    const SQ = Math.SQRT2;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c; if (!d[i]) continue;
      if (c > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (r > 0) d[i] = Math.min(d[i], d[i - C] + 1);
      if (c > 0 && r > 0) d[i] = Math.min(d[i], d[i - C - 1] + SQ);
      if (c < C - 1 && r > 0) d[i] = Math.min(d[i], d[i - C + 1] + SQ);
    }
    for (let r = R - 1; r >= 0; r--) for (let c = C - 1; c >= 0; c--) {
      const i = r * C + c; if (!d[i]) continue;
      if (c < C - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (r < R - 1) d[i] = Math.min(d[i], d[i + C] + 1);
      if (c < C - 1 && r < R - 1) d[i] = Math.min(d[i], d[i + C + 1] + SQ);
      if (c > 0 && r < R - 1) d[i] = Math.min(d[i], d[i + C - 1] + SQ);
    }
    for (let i = 0; i < d.length; i++) d[i] *= CS;
    return d;
  }

  // Distance to the nearest shell land, for the painter's shore effects. 0 on land/park.
  shellLandDist(x, y) {
    const c = Math.floor((x - this.shellOx) / this.shellCell), r = Math.floor((y - this.shellOy) / this.shellCell);
    if (c < 0 || r < 0 || c >= this.shellCols || r >= this.shellRows) return 1e6;
    return this.shellDistField[r * this.shellCols + c];
  }

  // Nearest shell road centreline: distance, direction, and that road's own half width.
  shellRoadInfo(x, y) {
    let best = 1e9, dx = 1, dy = 0, hw = 0, walk = 6;
    for (const s of this.shellSegs) {
      if (x < s.bx0 - best || x > s.bx1 + best || y < s.by0 - best || y > s.by1 + best) continue;
      const vx = s.x1 - s.x0, vy = s.y1 - s.y0, len2 = vx * vx + vy * vy;
      let t = ((x - s.x0) * vx + (y - s.y0) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(s.x0 + vx * t - x, s.y0 + vy * t - y);
      if (d < best) { best = d; const L = Math.sqrt(len2); dx = vx / L; dy = vy / L; hw = s.hw; walk = s.walk; }
    }
    return { d: best, dx, dy, hw, walk };
  }

  // For painters: whichever road feature (core loop/streets or a shell road) claims the point most,
  // judged by clearance beyond the road's edge so per-road widths compare fairly.
  roadInfoAny(x, y) {
    const r = this.roadInfo(x, y);
    if (this.shell && x < this.shellRoadMaxX) {
      const sr = this.shellRoadInfo(x, y);
      if (sr.d - sr.hw < r.d - this.halfRoad) return sr;
    }
    return { d: r.d, dx: r.dx, dy: r.dy, hw: this.halfRoad };
  }

  // Shell surface for x < 0 (the core path never sees these points). `sr` is shellRoadInfo(x, y),
  // already known not to be on a road. Roads sit on a sand apron: grid water within hw+10 of a
  // centreline is causeway embankment, so the Venetian (absent from the mask) and the widened
  // MacArthur strips are land-backed end to end.
  shellSurface(x, y, sr) {
    const cls = this.shellClass(x, y);
    if (cls === -1) return 'water';                       // beyond the surveyed shell: open sea
    if (cls === 0) return sr.d < sr.hw + 10 ? 'sand' : 'water';
    if (sr.d < sr.hw + (sr.walk || 6)) return 'sidewalk';   // FABLE candidate: urban streets carry the core's 24-unit sidewalk
    if (cls === 2) return 'grass';                        // park
    if (cls === 3) return 'plaza';                        // FABLE candidate: lot classes from tools/geo/geo_to_shell.py
    if (cls === 4) return 'parking';
    const CS = this.shellCell;                            // land: sand fringe where it meets water
    if (this.shellClass(x - CS, y) === 0 || this.shellClass(x + CS, y) === 0 ||
        this.shellClass(x, y - CS) === 0 || this.shellClass(x, y + CS) === 0) return 'sand';
    return 'paving';
  }

  // Vegetation clusters: seeded, scattered in grass and along block edges, mixed variants + sizes.
  // Shared by the renderer (sprites) and the sim (they can be flattened and torn out: destruct.js).
  buildBushes() {
    const L = this.L, vr = mulberry32(2024), out = [];
    for (let n = 0; n < 900 && out.length < 140; n++) {
      const x = vr() * L.world.w, y = vr() * L.world.h, t = this.surfaceAt(x, y);
      if (t !== 'grass' && !(t === 'paving' && vr() < 0.25) && !(t === 'sand' && vr() < 0.08)) continue;
      if (this.hitSolid(x, y, 14)) continue;
      const k = 1 + ((vr() * 4) | 0);  // cluster of 1-4
      for (let j = 0; j < k; j++) {
        const bx = x + (vr() - 0.5) * 34, by = y + (vr() - 0.5) * 34;
        if (this.hitSolid(bx, by, 10) || this.roadInfo(bx, by).d < this.walkEdge) continue;
        if (this.shell) { const sr = this.shellRoadInfo(bx, by); if (sr.d < sr.hw + 24) continue; }   // keep clusters off shell roads (the seam connector crosses core grass)
        const v = (vr() * 4) | 0;
        out.push({ i: out.length, x: bx, y: by, v, sc: 0.7 + vr() * 0.7 });
      }
    }
    if (this.shell) {                                         // FABLE candidate: the shell's gardens get bushes too
      for (let n = 0; n < 4000 && out.length < 230; n++) {
        const x = this.bounds.x0 + vr() * -this.bounds.x0, y = vr() * L.world.h;
        if (this.shellClass(x, y) !== 2 || this.surfaceAt(x, y) !== 'grass' || this.hitSolid(x, y, 12)) continue;
        const sr = this.shellRoadInfo(x, y); if (sr.d < sr.hw + (sr.walk || 6) + 10) continue;
        const k = 1 + ((vr() * 3) | 0);
        for (let j = 0; j < k; j++) out.push({ i: out.length, x: x + (vr() - 0.5) * 30, y: y + (vr() - 0.5) * 30, v: (vr() * 4) | 0, sc: 0.7 + vr() * 0.6 });
      }
    }
    return out;
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
    if (this.shell && x < this.shellRoadMaxX) {
      const sr = this.shellRoadInfo(x, y);
      if (sr.d < sr.hw) return 'road';                    // shell roads (incl. the seam connector into the core) outrank grid and core ground
      if (x < 0) return this.shellSurface(x, y, sr);
    }
    if (y > this.L.world.h) return 'water';               // open sea south of the island (the sea extension)
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
    if (x < this.bounds.x0 || y < 0 || x > this.L.world.w || y > this.L.world.h) return false;
    if (this.shell && x < 0) {
      if (this.surfaceAt(x, y) === 'water') return false;   // shell land, park, roads and their aprons drive; the bay does not
      return !this.hitSolid(x, y, 0);
    }
    if (x > this.shoreX(y) - 4) return false;
    return !this.hitSolid(x, y, 0);
  }

  hitSolid(x, y, pad) {
    for (const s of this.solids) {
      if (x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad) return s;
    }
    return null;
  }

  // On the pier deck? `inset` keeps a body inside the side and end rails; the landward end is open.
  onPier(x, y, inset = 0) {
    const P = this.L.pier;
    return x > P.x - 14 && x < P.x + P.w - inset && y > P.y + inset && y < P.y + P.h - inset;
  }

  // Palm trunk within `pad` of a point, or null.
  hitTrunk(x, y, pad = 0) {
    for (const t of this.trunks) {
      if (this.felled && this.felled[t.i]) continue;   // a snapped palm (destruct.js) no longer stands
      const dx = x - t.x, dy = y - t.y, r = t.r + pad;
      if (dx * dx + dy * dy < r * r) return t;
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

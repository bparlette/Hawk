// lf_veg.js — crashable scenery (owner, Nov 18: "allow you to crash into guardrails
// and bushes"). Two shared, deterministic sets so the SIM (physics) and the RENDERER
// (drawing) always agree on what is where — nothing is stored in a save file.
//
// BUSHES: a hash scatter on a 90-unit cell grid. A cell's bush exists only where a
// bush belongs: grass surface, and either near a house (front-yard shrub) or inside
// a green area. Bushes are SOFT: a car ploughs in, the bush squashes flat, the car
// drags hard but never stops dead and can never wedge on one.
// GUARDRAILS: generated from the road graph — both sides of motorways, primaries
// and bridges, with gaps at junctions. Rails are a scrape, not a wall: they push
// the car out and slide it along, with a small bite of damage at speed.

export const BUSH_CELL = 90;
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) | 0; h = Math.imul(h, 1274126177); return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
const inPoly = (f, x, y) => { let ins = false; for (let k = 0; k < f.length; k += 2) { const ax = f[k], ay = f[k + 1], ex = f[(k + 2) % f.length], ey = f[(k + 3) % f.length]; if ((ay > y) !== (ey > y) && x < (ex - ax) * (y - ay) / (ey - ay) + ax) ins = !ins; } return ins; };

// nearBuilding(x, y) is supplied by the caller (the sim's house grid, or a grid the
// renderer builds from areas.json) so both sides test the same rule.
export function bushAt(cx, cy, W, nearBuilding, greens) {
  const h = hash2(cx, cy);
  if (h > 0.78) return null;                                   // ~22% of cells grow a bush
  const x = cx * BUSH_CELL + 14 + hash2(cx * 3 + 1, cy * 7) * (BUSH_CELL - 28);
  const y = cy * BUSH_CELL + 14 + hash2(cx * 5, cy * 3 + 2) * (BUSH_CELL - 28);
  if (W.surfaceAt(x, y, 0) !== 'ground') return null;          // never on a road, drive or lot
  if (!nearBuilding(x, y) && !(greens && greens.some(f => inPoly(f, x, y)))) return null;
  return { id: cx + ',' + cy, x, y, r: 9 + hash2(cx * 11, cy * 13) * 7 };
}
export function bushesNear(x, y, rad, W, nearBuilding, greens, out = []) {
  out.length = 0;
  const c0x = Math.floor((x - rad) / BUSH_CELL), c1x = Math.floor((x + rad) / BUSH_CELL);
  const c0y = Math.floor((y - rad) / BUSH_CELL), c1y = Math.floor((y + rad) / BUSH_CELL);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const b = bushAt(cx, cy, W, nearBuilding, greens);
    if (b && Math.hypot(b.x - x, b.y - y) < rad + b.r) out.push(b);
  }
  return out;
}

// ---- guardrails -------------------------------------------------------------
const RAIL_HW = new Set(['motorway', 'primary']);
export function buildRails(W) {
  // a junction vert: any vert where a non-rail road joins — rails break there
  const vertClass = new Map();
  for (const e of W.edges) for (const v of [e.a, e.b]) {
    if (!vertClass.has(v)) vertClass.set(v, new Set());
    vertClass.get(v).add(RAIL_HW.has(e.hw) || e.bridge ? 'rail' : 'side');
  }
  const junction = (v) => { const s = vertClass.get(v); return s && s.has('side'); };
  const segs = [], grid = new Map();
  const addSeg = (x0, y0, x1, y1, layer) => {
    const s = { x0, y0, x1, y1, layer, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
    segs.push(s);
    const k = Math.floor(s.mx / 256) * 100003 + Math.floor(s.my / 256);
    let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(s);
  };
  for (const e of W.edges) {
    if (!(RAIL_HW.has(e.hw) || e.bridge) || e.pts.length < 2) continue;
    const off = e.w / 2 + 7, layer = e.layer || 0;   // Nov 18: just past the shoulder (a car body is ~1 m wide of its centre line at the edge) — at +7 every car hugging the edge of a primary road ground along the rail: 51k scrapes, 78 wrecks in 12 CPU-minutes
    for (const side of [-1, 1]) {
      for (let i = 0; i + 1 < e.pts.length; i++) {
        const [ax, ay] = e.pts[i], [bx, by] = e.pts[i + 1];
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * side, ny = dx / L * side;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        // gap at junctions: TRIM the rail back GAP units from every junction vert (Nov 18 fix: the old test skipped a segment
        // only when its MIDPOINT was within 60 u, so a long segment beside a junction ran straight across the side street's
        // mouth and walled cars in — College Park's Lehigh Rd -> Baltimore Ave turn was impassable).
        // RAILS NEVER CROSS A ROAD (Nov 18 fix): the old junction gap tested only a segment's MIDPOINT, so a rail could run
        // straight across a side street's mouth and pin cars (College Park's Lehigh Rd -> Baltimore Ave; several Laurel rallies
        // stalled with the player wedged on the road). Walk the rail in ~10-unit steps and keep only the stretches where no
        // OTHER road's carriageway (anything not this edge and not itself railed) is within its half-width + 14 units.
        const n = Math.max(1, Math.ceil(L / 10)); let run0 = -1;
        const ok = (u) => { const px = ax + dx * u + nx * off, py = ay + dy * u + ny * off;
          for (const si of W.grid[layer] ? (W.grid[layer].get(Math.floor(px / 256) * 100003 + Math.floor(py / 256)) || []) : []) {
            const g = W.seg[si], o = g.e; if (o === e || RAIL_HW.has(o.hw) || o.bridge) continue;
            const vx = g.x1 - g.x0, vy = g.y1 - g.y0, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((px - g.x0) * vx + (py - g.y0) * vy) / L2));
            if (Math.hypot(g.x0 + vx * t - px, g.y0 + vy * t - py) < o.w / 2 + 14) return false; }
          return true; };
        for (let k = 0; k <= n; k++) {
          const good = ok(k / n);
          if (good && run0 < 0) run0 = k;
          if ((!good || k === n) && run0 >= 0) { const k1 = good ? k : k - 1; if (k1 > run0) addSeg(ax + dx * run0 / n + nx * off, ay + dy * run0 / n + ny * off, ax + dx * k1 / n + nx * off, ay + dy * k1 / n + ny * off, layer); run0 = -1; }
        }
        continue;
        addSeg(ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off, layer);
      }
    }
  }
  return { segs, grid };
}
export function railsNear(rails, x, y, layer, out = []) {
  out.length = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    for (const s of rails.grid.get((Math.floor(x / 256) + i) * 100003 + Math.floor(y / 256) + j) || [])
      if (s.layer === layer && Math.hypot(s.mx - x, s.my - y) < 300) out.push(s);
  return out;
}

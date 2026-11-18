// world_graph.js — Laurel/Fulton's world: the real OSM road graph (data/graph.json, tools/osm_graph.py),
// queried through a spatial grid so every lookup is local no matter how big the map is.
// Units: 10 per metre, x east, y south (Palm City's). Layers: 0 = ground, 1 = bridge decks (OSM bridge=*
// or layer>0). A query passes the layer it asks about; a car carries its own.
//
//   const W = new GraphWorld(graph)
//   W.roadInfo(x, y, layer)   -> { d, dx, dy, hw, e }  distance to the nearest edge centreline on that layer,
//                                its direction, its half width, the edge itself
//   W.surfaceAt(x, y, layer)  -> 'road' | 'sidewalk' | 'service' | 'ground'
//   W.route(va, vb)           -> { len, edges, pts } shortest legal path (one-ways honoured), or null
//   W.nearestVertex(x, y)

const CELL = 256;                                   // = the ground painter's chunk size
const SIDEWALK = { residential: 18, tertiary: 20, secondary: 22, primary: 0, trunk: 0, motorway: 0, unclassified: 12, living_street: 12 };

export class GraphWorld {
  constructor(G) {
    this.G = G; this.verts = G.verts; this.edges = G.edges;
    this.grid = [new Map(), new Map()];               // per layer: cellKey -> [segIndex]
    this.seg = [];                                    // { x0, y0, x1, y1, e, hw, walk, layer }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of G.edges) {
      const layer = (e.bridge || e.layer > 0) ? 1 : 0;
      e.L = layer;
      const hw = e.w / 2, walk = e.hw === 'service' ? 0 : (SIDEWALK[e.hw.replace('_link', '')] ?? 0);
      for (let k = 0; k + 1 < e.pts.length; k++) {
        const [ax, ay] = e.pts[k], [bx, by] = e.pts[k + 1];
        const si = this.seg.length;
        this.seg.push({ x0: ax, y0: ay, x1: bx, y1: by, e, hw, walk, layer });
        const m = hw + walk + 2;
        for (let cx = Math.floor((Math.min(ax, bx) - m) / CELL); cx <= Math.floor((Math.max(ax, bx) + m) / CELL); cx++)
          for (let cy = Math.floor((Math.min(ay, by) - m) / CELL); cy <= Math.floor((Math.max(ay, by) + m) / CELL); cy++) {
            const key = cx * 100003 + cy, g = this.grid[layer];
            let l = g.get(key); if (!l) g.set(key, l = []); l.push(si);
          }
        x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
      }
    }
    this.bounds = { x0, y0, x1, y1 };
    this.pave = null;                                 // the KOTH paved disc { x, y, r } | null — set via GroundPainter.setPave
    this.adj = new Map();                             // vertex -> [[to, len, edgeIndex]]
    G.edges.forEach((e, i) => {
      const add = (a, b) => { let l = this.adj.get(a); if (!l) this.adj.set(a, l = []); l.push([b, e.len, i]); };
      if (e.oneway >= 0) add(e.a, e.b);
      if (e.oneway <= 0) add(e.b, e.a);
    });
  }

  // nearest segment on a layer, searching the point's cell and its 8 neighbours (then a wider ring if empty)
  roadInfo(x, y, layer = 0) {
    const g = this.grid[layer > 0 ? 1 : 0], cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    let best = 1e9, bs = null;
    for (let ring = 1; ring <= 3 && !bs; ring++) {
      for (let i = cx - ring; i <= cx + ring; i++) for (let j = cy - ring; j <= cy + ring; j++) {
        if (ring > 1 && i > cx - ring && i < cx + ring && j > cy - ring && j < cy + ring) continue;   // only the new ring
        const l = g.get(i * 100003 + j); if (!l) continue;
        for (const si of l) {
          const s = this.seg[si], vx = s.x1 - s.x0, vy = s.y1 - s.y0, L2 = vx * vx + vy * vy || 1;
          let t = ((x - s.x0) * vx + (y - s.y0) * vy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(s.x0 + vx * t - x, s.y0 + vy * t - y);
          if (d - s.hw < best) { best = d - s.hw; bs = s; }       // by clearance from the kerb, so widths compare fairly
        }
      }
    }
    if (!bs) return { d: 1e9, dx: 1, dy: 0, hw: 0, walk: 0, e: null };
    const vx = bs.x1 - bs.x0, vy = bs.y1 - bs.y0, L = Math.hypot(vx, vy) || 1;
    return { d: best + bs.hw, dx: vx / L, dy: vy / L, hw: bs.hw, walk: bs.walk, e: bs.e };
  }

  surfaceAt(x, y, layer = 0) {
    // KOTH circle road (owner, Nov 17): the candidate/active cul-de-sac's disc is REAL pavement.
    // GroundPainter.setPave (lf_ground.js) owns this field; every surface consumer — the ground
    // painter, the sim's off-tarmac drag, the skid layer's dirt tear — reads through here, so
    // inside the disc they all see road. Layer 0 only: a bridge deck over a sac stays a deck.
    if (layer === 0 && this.pave) { const p = this.pave, dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy <= p.r * p.r) return 'road'; }
    const r = this.roadInfo(x, y, layer);
    if (!r.e) return 'ground';
    if (r.d < r.hw) return r.e.hw === 'service' ? 'service' : 'road';
    if (r.d < r.hw + r.walk) return 'sidewalk';
    return 'ground';
  }

  nearestVertex(x, y) {
    let best = 1e18, bv = -1;
    for (const [v] of this.adj) { const p = this.verts[v], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < best) { best = d; bv = v; } }
    return bv;
  }

  // Dijkstra on a binary heap; one-ways honoured
  route(s, t) {
    const dist = new Map([[s, 0]]), prev = new Map(), H = [[0, s]];
    const push = (it) => { H.push(it); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
    const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
    while (H.length) {
      const [d, u] = pop();
      if (u === t) break;
      if (d > dist.get(u)) continue;
      for (const [v, w, ei] of this.adj.get(u) || []) {
        const nd = d + w;
        if (nd < (dist.has(v) ? dist.get(v) : 1e18)) { dist.set(v, nd); prev.set(v, [u, ei]); push([nd, v]); }
      }
    }
    if (!dist.has(t)) return null;
    const edges = []; let u = t;
    while (u !== s) { const [p, ei] = prev.get(u); edges.push(ei); u = p; }
    edges.reverse();
    const pts = []; let at = s;
    for (const ei of edges) { const e = this.edges[ei], fw = e.a === at, P = fw ? e.pts : [...e.pts].reverse(); for (const p of (pts.length ? P.slice(1) : P)) pts.push(p); at = fw ? e.b : e.a; }
    return { len: dist.get(t), edges, pts };
  }
}

// lf_areas.js — task L10/L8: the real OSM footprints (data/areas.json, tools/osm_areas.py) indexed by ground
// chunk, plus the hero tier and the "corner of X & Y" cross streets for every hero (from the road graph).
const CH = 256;
export class Areas {
  constructor(A, W) {
    this.A = A; this.W = W; this.idx = { buildings: new Map(), parking: new Map(), green: new Map() };
    this.heroSet = new Set(A.heroes.map(h => h.b));
    for (const kind of ['buildings', 'parking', 'green']) A[kind].forEach((f, i) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); }
      for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) {
        const key = cx * 100003 + cy, m = this.idx[kind]; let l = m.get(key); if (!l) m.set(key, l = []); l.push(i);
      }
    });
    this.heroes = A.heroes.map(h => {
      const f = A.buildings[h.b], n = f.length / 2; let cx = 0, cy = 0; for (let k = 0; k < f.length; k += 2) { cx += f[k]; cy += f[k + 1]; }
      cx /= n; cy /= n;
      return { ...h, f, cx, cy, corner: this.corner(cx, cy) };
    });
  }
  // L10 orientation: "<this street> & <the cross street>" for the nearest named junction on the road you are on (cheap: one edge)
  cornerNear(x, y, layer = 0, within = 1500) {
    const W = this.W, r = W.roadInfo(x, y, layer); if (!r.e) return ''; const st = r.e.name || r.e.ref; if (!st) return '';
    if (!this.vn) { this.vn = new Map(); for (const e of W.edges) { const n = e.name || e.ref; if (!n || e.hw === 'service') continue; for (const v of [e.a, e.b]) { let q = this.vn.get(v); if (!q) this.vn.set(v, q = new Set()); q.add(n); } } }
    let best = 1e18, cross = '';
    for (const v of [r.e.a, r.e.b]) { const q = this.vn.get(v); if (!q) continue; const o = [...q].find(n => n !== st); if (!o) continue; const p = W.verts[v], d = Math.hypot(p.x - x, p.y - y); if (d < best && d < within) { best = d; cross = o; } }
    return cross ? `${st} & ${cross}` : st;
  }
  inChunk(kind, cx, cy) { return this.idx[kind].get(cx * 100003 + cy) || []; }
  // the hero's street + the nearest named cross street along it: "Stansfield Road & Harding Road"
  corner(x, y) {
    const W = this.W, r = W.roadInfo(x, y, 0); if (!r.e) return '';
    const st = r.e.name || r.e.ref; if (!st) return '';
    const names = new Map();                                            // vertex -> set of street names meeting there
    for (const e of W.edges) { const n = e.name || e.ref; if (!n || e.hw === 'service') continue; for (const v of [e.a, e.b]) { let s = names.get(v); if (!s) names.set(v, s = new Set()); s.add(n); } }
    let best = 1e18, cross = '';
    for (const [v, s] of names) {
      if (!s.has(st) || s.size < 2) continue;
      const p = W.verts[v], d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < best) { best = d; cross = [...s].find(n => n !== st); }
    }
    return cross ? `${st} & ${cross}` : st;
  }
}
// draw a polygon path (flat [x,y,...]) optionally scaled about (ox, oy)
export function poly(g, f, s = 1, ox = 0, oy = 0) {
  g.beginPath();
  for (let k = 0; k < f.length; k += 2) { const x = ox + (f[k] - ox) * s, y = oy + (f[k + 1] - oy) * s; k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}

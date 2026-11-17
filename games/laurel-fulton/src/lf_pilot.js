// lf_pilot.js — the rally autopilot: produces ONLY stick input ({jx, jy, jm} / brake key), exactly what a thumb
// on the touch joystick produces, so a piloted run goes through the same input path as a person's.
// Used by tools/spec_l2.mjs (headless proof) and by play.html?pilot (captures + a hands-off demo).
// Plan: nearest unvisited stop -> route on the graph -> follow it -> brake to pull in -> wait out the beat ->
// next; when everyone is in, Atholton HS. Target behind you while slow: stick out to the SIDE (turn round
// going forward); a stuck-for-2-s guard reverses briefly.
// Plan a drive ON THE ROADS from (fx,fy) to (tx,ty): get onto your current edge, route between the edges' ends (whichever
// pair is shortest), and follow the destination edge's real shape to the kerb point in front of the target — never a
// straight line across a block (the nearest graph VERTEX can be on another street).
export function roadPath(W, S, fx, fy, tx, ty) {
  // the nearest few distinct edges to a point (from the world's 256-unit grid), nearest first, each with its kerb point
  const cands = (x, y) => {
    const seen = new Map();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const si of W.grid[0].get((Math.floor(x / 256) + i) * 100003 + Math.floor(y / 256) + j) || []) {
      const sg = W.seg[si], vx = sg.x1 - sg.x0, vy = sg.y1 - sg.y0, L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - sg.x0) * vx + (y - sg.y0) * vy) / L2));
      const px = sg.x0 + vx * t, py = sg.y0 + vy * t, d = Math.hypot(px - x, py - y), k = W.edges.indexOf(sg.e);
      const cur = seen.get(sg.e); if (!cur || d < cur.d) seen.set(sg.e, { e: sg.e, d, k: { x: px, y: py }, i: sg.e.pts.findIndex(p => p[0] === sg.x0 && p[1] === sg.y0) });
    }
    return [...seen.values()].sort((p, q) => p.d - q.d).slice(0, 6);
  };
  const toEnd = (o, end) => end === 'a' ? [[o.k.x, o.k.y], ...o.e.pts.slice(0, o.i + 1).reverse()] : [[o.k.x, o.k.y], ...o.e.pts.slice(o.i + 1)];
  const len = (pts) => { let L = 0; for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; };
  const As = cands(fx, fy), Bs = cands(tx, ty);
  for (const A of As) for (const B of Bs) {                  // nearest pair that is actually CONNECTED (skips lot aisles and driveways that are islands)
    if (A.e === B.e) return [[fx, fy], [A.k.x, A.k.y], [B.k.x, B.k.y]];
    let best = null;
    for (const ea of ['a', 'b']) for (const eb of ['a', 'b']) {
      const r = W.route(A.e[ea], B.e[eb]); if (!r) continue;
      const head = toEnd(A, ea), tail = toEnd(B, eb).reverse(), tot = len(head) + r.len + len(tail);
      if (!best || tot < best.tot) best = { tot, pts: [[fx, fy], ...head, ...r.pts, ...tail] };
    }
    if (best) return best.pts;
  }
  return [[fx, fy], [tx, ty]];
}

export class Pilot {
  constructor(S, W, M) { this.S = S; this.W = W; this.M = M; this.pts = null; this.pi = 0; this.goal = null; this.stuck = 0; }
  dense(pts, step = 20) { const o = [pts[0]]; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) o.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } return o; }
  nearestV(x, y) { let b = 1e18, bv = -1; for (const [v] of this.W.adj) { const q = this.W.verts[v], d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < b) { b = d; bv = v; } } return bv; }
  plan(x, y, stopAtEnd) {
    const S = this.S;
    this.pts = this.dense(roadPath(this.W, S, S.player.x, S.player.y, x, y));   // on the roads, to the kerb in front of the target
    this.pi = 0; this.goal = { x, y, stopAtEnd };
  }
  next() {
    const M = this.M, c = this.S.player;
    if (!M || M.complete) return null;
    const todo = M.stops.filter(s => !s.done);
    if (todo.length) { const s = todo.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; return [s.x, s.y, true]; }
    return [M.meet.pos[0], M.meet.pos[1], true];
  }
  input(dt = 1 / 60) {
    const idle = { jx: 0, jy: 0, jm: 0, keys: {} }, M = this.M, c = this.S.player;
    if (M && (M.beat || M.complete)) { this.goal = null; return M.complete && c.v > 10 ? { ...idle, keys: { down: true } } : idle; }
    const nx = this.next(); if (!nx) return idle;
    if (!this.goal || Math.hypot(this.goal.x - nx[0], this.goal.y - nx[1]) > 1) this.plan(...nx);
    return this.steer(dt);
  }
  steer(dt = 1 / 60) {
    const c = this.S.player, pts = this.pts; let best = 1e18, bi = this.pi;
    for (let i = Math.max(0, this.pi - 5); i < Math.min(pts.length, this.pi + 200); i++) { const d = (pts[i][0] - c.x) ** 2 + (pts[i][1] - c.y) ** 2; if (d < best) { best = d; bi = i; } }
    this.pi = bi; let j = bi, acc = 0; while (j + 1 < pts.length && acc < 90) { acc += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; }
    const end = pts[pts.length - 1], dEnd = Math.hypot(end[0] - c.x, end[1] - c.y);
    if (this.goal.stopAtEnd && dEnd < 160) return { jx: 0, jy: 0, jm: 0, keys: c.v > 20 ? { down: true } : {} };
    this.stuck = Math.abs(c.v) < 8 ? this.stuck + dt : 0;
    if (this.stuck > 2) { if (this.stuck > 3) this.stuck = 0; const a = c.h + Math.PI; return { jx: Math.cos(a), jy: Math.sin(a), jm: 0.8, keys: {} }; }
    const tx = pts[j][0] - c.x, ty = pts[j][1] - c.y, L = Math.hypot(tx, ty) || 1;
    const ta = Math.atan2(ty, tx), rel = Math.atan2(Math.sin(ta - c.h), Math.cos(ta - c.h));
    if (Math.abs(rel) > 1.9 && c.v < 120) { const sa = c.h + Math.sign(rel || 1) * Math.PI / 2; return { jx: Math.cos(sa), jy: Math.sin(sa), jm: 0.8, keys: {} }; }
    let j2 = j, a2 = 0; while (j2 + 1 < pts.length && a2 < 220) { a2 += Math.hypot(pts[j2 + 1][0] - pts[j2][0], pts[j2 + 1][1] - pts[j2][1]); j2++; }
    const b = Math.atan2(pts[j2][1] - pts[j][1], pts[j2][0] - pts[j][0]) - ta, bend = Math.abs(Math.atan2(Math.sin(b), Math.cos(b)));
    return { jx: tx / L, jy: ty / L, jm: (c.v > 150 && bend > 0.5) || (dEnd < 400 && c.v > 140) ? 0.35 : 1, keys: {} };
  }
}

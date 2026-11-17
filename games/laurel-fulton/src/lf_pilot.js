// lf_pilot.js — the rally autopilot: produces ONLY stick input ({jx, jy, jm} / brake key), exactly what a thumb
// on the touch joystick produces, so a piloted run goes through the same input path as a person's.
// Used by tools/spec_l2.mjs (headless proof) and by play.html?pilot (captures + a hands-off demo).
// Plan: nearest unvisited stop -> route on the graph -> follow it -> brake to pull in -> wait out the beat ->
// next; when everyone is in, Atholton HS. Target behind you while slow: stick out to the SIDE (turn round
// going forward); a stuck-for-2-s guard reverses briefly.
export class Pilot {
  constructor(S, W, M) { this.S = S; this.W = W; this.M = M; this.pts = null; this.pi = 0; this.goal = null; this.stuck = 0; }
  dense(pts, step = 20) { const o = [pts[0]]; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 1; k <= n; k++) o.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } return o; }
  nearestV(x, y) { let b = 1e18, bv = -1; for (const [v] of this.W.adj) { const q = this.W.verts[v], d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < b) { b = d; bv = v; } } return bv; }
  plan(x, y, stopAtEnd) {
    const S = this.S, r = this.W.route(this.nearestV(S.player.x, S.player.y), this.nearestV(x, y));
    this.pts = r ? this.dense([[S.player.x, S.player.y], ...r.pts, [x, y]]) : this.dense([[S.player.x, S.player.y], [x, y]]);
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

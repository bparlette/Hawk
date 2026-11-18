// lf_heroes.js — task L11: the hero homes + POIs drawn as spec-accurate top-down art (data/heroes.json, hand-authored from
// tasking/g12/SPECS.md; street names only, no house numbers). Replaces the L8 flat placeholder polygon: right footprint (areas.json),
// roofline (gable / hip / flat, ridge direction, colour), facade colour, and the recognisable details — garage, door, drive, deck, pool,
// shutters, hoop, the OPEN sign, lots, the Maple Lawn green roofs. Hero = BIGGER than real (L8): the whole local frame is scaled.
// Where SPECS says "NOT ON RECORD" the art stays neutral. Hooked into lf_render.js (HeroArt.draw returns false until the data is in,
// so the old placeholder shows meanwhile) and into the plaque pass (districtPlaque).
const INK = '#2a1430';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function lpath(g, P, s = 1) { g.beginPath(); for (let k = 0; k < P.length; k += 2) k ? g.lineTo(P[k] * s, P[k + 1] * s) : g.moveTo(P[k] * s, P[k + 1] * s); g.closePath(); }
function rrect(g, x, y, w, h, r = 0) { g.beginPath(); if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

// the minimum-area oriented box of a polygon (flat world coords): { ax, ay (unit long-ish axis), cx, cy (box centre), hw, hd }
function obb(f) {
  let best = null; const n = f.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = f[j * 2] - f[i * 2], dy = f[j * 2 + 1] - f[i * 2 + 1], L = Math.hypot(dx, dy); if (L < 1e-6) continue;
    const ax = dx / L, ay = dy / L; let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18;
    for (let k = 0; k < f.length; k += 2) { const a = f[k] * ax + f[k + 1] * ay, b = -f[k] * ay + f[k + 1] * ax; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0); if (!best || area < best.area) best = { area, ax, ay, a0, a1, b0, b1 };
  }
  const { ax, ay } = best, am = (best.a0 + best.a1) / 2, bm = (best.b0 + best.b1) / 2;
  return { ax, ay, cx: am * ax - bm * ay, cy: am * ay + bm * ax, ha: (best.a1 - best.a0) / 2, hb: (best.b1 - best.b0) / 2 };
}
function nearOnEdge(e, x, y) {
  let best = 1e18, bp = null; const P = e.pts;
  for (let k = 0; k + 1 < P.length; k++) {
    const [ax, ay] = P[k], [bx, by] = P[k + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1), px = ax + vx * t, py = ay + vy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) { best = d; bp = [px, py]; }
  }
  return bp;
}

export class HeroArt {
  constructor(areas, W, SUN) {
    this.areas = areas; this.W = W; this.SUN = SUN; this.data = null; this.L = []; this.frames = new Map(); this.dist = null;
    const sl = Math.hypot(SUN.x, SUN.y); this.Lw = [-SUN.x / sl, -SUN.y / sl];            // world direction TOWARD the sun
    fetch('data/heroes.json').then(r => r.json()).then(d => { this.data = d; }).catch(() => { });
  }
  // the local frame of one hero: centre, front direction (toward the nearest road), local polygon, free room in front
  frame(h) {
    let F = this.frames.get(h.b); if (F) return F;
    const o = obb(h.f), W = this.W, r = W.roadInfo(o.cx, o.cy, 0);
    let fx = 0, fy = 1, room = 400;
    if (r.e) {
      const p = nearOnEdge(r.e, o.cx, o.cy);
      if (p) {
        const dx = p[0] - o.cx, dy = p[1] - o.cy, ca = [[o.ax, o.ay], [-o.ax, -o.ay], [-o.ay, o.ax], [o.ay, -o.ax]];
        let bd = -1e18; for (const c of ca) { const d = c[0] * dx + c[1] * dy; if (d > bd) { bd = d; fx = c[0]; fy = c[1]; } }
        room = bd - (r.hw || 0);
      }
    }
    const ux = fy, uy = -fx;                                                            // proper rotation: local x = u, local y = v (front)
    const P = []; for (let k = 0; k < h.f.length; k += 2) { const dx = h.f[k] - o.cx, dy = h.f[k + 1] - o.cy; P.push(dx * ux + dy * uy, dx * fx + dy * fy); }
    let hw = 0, hd = 0; for (let k = 0; k < P.length; k += 2) { hw = Math.max(hw, Math.abs(P[k])); hd = Math.max(hd, Math.abs(P[k + 1])); }
    const Lx = this.Lw[0] * ux + this.Lw[1] * uy, Ly = this.Lw[0] * fx + this.Lw[1] * fy;
    F = { cx: o.cx, cy: o.cy, u: [ux, uy], v: [fx, fy], P, hw, hd, Lx, Ly, room: room };
    this.frames.set(h.b, F); return F;
  }
  // returns true when it drew the hero (the caller then skips the placeholder)
  draw(g, h, gr) {
    const D = this.data; if (!D) return false; const sp = D.heroes[h.b]; if (!sp) return false;
    const F = this.frame(h), S = sp.kind === 'poi' ? D.style.poiScale : D.style.houseScale, night = clamp((0.58 - gr.warm) * 4, 0, 1);
    const { P, hw, hd } = F, lim = Math.max(30, F.room / S - hd - 6);                  // local free room in front (never paint over the road)
    g.save(); g.transform(F.u[0] * S, F.u[1] * S, F.v[0] * S, F.v[1] * S, F.cx, F.cy);
    const ctx = { g, F, sp, S, hw, hd, lim, night, home: sp.kind === 'home' };
    if (ctx.home) this.lawn(ctx);
    for (const d of sp.details) { const f = this['u_' + d.t]; if (f) f.call(this, ctx, d); }
    // drop shadow (the bake's sun: falls ENE), then facade, then roof
    g.save(); g.globalAlpha = 0.38; g.fillStyle = '#21183a'; g.translate((this.SUN.x * F.u[0] + this.SUN.y * F.u[1]) * 34 / S, (this.SUN.x * F.v[0] + this.SUN.y * F.v[1]) * 34 / S); lpath(g, P); g.fill(); g.restore();
    this.body(ctx, P, hw, hd, sp);
    for (const d of sp.details) { const f = this['o_' + d.t]; if (f) f.call(this, ctx, d); }
    g.restore();
    for (const d of sp.details) if (d.t === 'sign') this.sign(ctx, d);                 // screen-oriented text lives outside the rotated frame
    g.globalAlpha = 1; return true;
  }
  lawn({ g, hw, hd }) {
    g.fillStyle = 'rgba(132,176,86,0.34)'; rrect(g, -hw - 40, -hd - 44, hw * 2 + 80, hd * 2 + 100, 26); g.fill();
    g.fillStyle = 'rgba(150,196,100,0.22)'; rrect(g, -hw - 22, -hd - 26, hw * 2 + 44, hd * 2 + 62, 18); g.fill();
  }
  // facade + roof of any box-ish polygon (local coords). sp: wall, brick, inset, roof {type, ridge, c1, c2}
  body(ctx, P, hw, hd, sp) {
    const { g, F, night } = ctx, R = sp.roof, wall = sp.wall;
    lpath(g, P); g.fillStyle = wall; g.fill();
    if (sp.brick) {                                                                      // brick: a few coursing lines + a darker rim
      g.save(); lpath(g, P); g.clip(); g.strokeStyle = 'rgba(70,20,10,0.16)'; g.lineWidth = 0.8;
      for (let y = -hd; y < hd; y += 4.5) { g.beginPath(); g.moveTo(-hw - 2, y); g.lineTo(hw + 2, y); g.stroke(); } g.restore();
    }
    lpath(g, P); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
    const k = sp.inset || 0.84; g.save(); lpath(g, P, k); g.clip();
    const ex = { x0: -hw * 1.2, x1: hw * 1.2, y0: -hd * 1.2, y1: hd * 1.2 };
    const long = (R.ridge === 'short') ? hw > hd : hw <= hd;                             // ridge along the long side unless told otherwise
    this.roof(ctx, ex, R.type, long ? 'y' : 'x', R.c1, R.c2, sp.kind === 'poi' ? hw * 0.9 : 0);
    for (const d of sp.details || []) if (d.t === 'wing') this.wing(ctx, d, hw, hd);
    g.restore();
    lpath(g, P, k); g.lineWidth = 1.7; g.strokeStyle = 'rgba(36,24,42,0.6)'; g.stroke();
    if (R.type === 'flat') { lpath(g, P, k); g.lineWidth = 3.2; g.strokeStyle = 'rgba(236,228,212,0.8)'; g.stroke(); }
  }
  roof(ctx, e, type, axis, c1, c2) {
    const { g, F } = ctx, L = F;
    if (type === 'flat') {
      g.fillStyle = mix(c2, c1, 0.5); g.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
      g.fillStyle = mix(c1, '#ffffff', 0.12); g.fillRect(e.x0 + 6, e.y0 + 6, (e.x1 - e.x0) - 12, (e.y1 - e.y0) - 12);
      g.strokeStyle = 'rgba(20,14,30,0.16)'; g.lineWidth = 1; g.beginPath();            // membrane seams
      const st = Math.max(16, (e.x1 - e.x0) / 14); for (let x = e.x0; x < e.x1; x += st) { g.moveTo(x, e.y0); g.lineTo(x, e.y1); } g.stroke();
      return;
    }
    const xm = (e.x0 + e.x1) / 2, ym = (e.y0 + e.y1) / 2;
    const col = (nx, ny) => mix(c2, c1, clamp(0.5 + 0.95 * (nx * L.Lx + ny * L.Ly), 0.04, 0.98));
    const poly = (pts, nx, ny) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = col(nx, ny); g.fill(); };
    const sw = (x, y) => axis === 'x' ? [x, y] : [y, x];                                 // build in an x-ridge frame, swap for a y-ridge
    const A = axis === 'x' ? { a0: e.x0, a1: e.x1, b0: e.y0, b1: e.y1, am: xm, bm: ym } : { a0: e.y0, a1: e.y1, b0: e.x0, b1: e.x1, am: ym, bm: xm };
    const nrm = (nb, na) => axis === 'x' ? [na, nb] : [nb, na];                         // (across, along) -> (x, y)
    if (type === 'hip') {
      const rl = Math.max((A.a1 - A.a0) / 2 - (A.b1 - A.b0) / 2 * 0.95, 0);
      const front = [sw(A.a0, A.b1), sw(A.a1, A.b1), sw(A.am + rl, A.bm), sw(A.am - rl, A.bm)], back = [sw(A.a0, A.b0), sw(A.a1, A.b0), sw(A.am + rl, A.bm), sw(A.am - rl, A.bm)];
      const left = [sw(A.a0, A.b0), sw(A.a0, A.b1), sw(A.am - rl, A.bm)], right = [sw(A.a1, A.b0), sw(A.a1, A.b1), sw(A.am + rl, A.bm)];
      let n = nrm(1, 0); poly(front, n[0], n[1]); n = nrm(-1, 0); poly(back, n[0], n[1]); n = nrm(0, -1); poly(left, n[0], n[1]); n = nrm(0, 1); poly(right, n[0], n[1]);
      this.ridge(g, sw(A.am - rl, A.bm), sw(A.am + rl, A.bm));
    } else {
      let n = nrm(-1, 0); poly([sw(A.a0, A.b0), sw(A.a1, A.b0), sw(A.a1, A.bm), sw(A.a0, A.bm)], n[0], n[1]);
      n = nrm(1, 0); poly([sw(A.a0, A.bm), sw(A.a1, A.bm), sw(A.a1, A.b1), sw(A.a0, A.b1)], n[0], n[1]);
      this.ridge(g, sw(A.a0, A.bm), sw(A.a1, A.bm));
    }
    g.strokeStyle = 'rgba(20,12,24,0.13)'; g.lineWidth = 0.7; g.beginPath();            // shingle courses, parallel to the ridge
    for (let b = A.b0; b < A.b1; b += 6) { const p = sw(A.a0, b), q = sw(A.a1, b); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } g.stroke();
  }
  ridge(g, p, q) {
    g.beginPath(); g.moveTo(p[0] + 0.6, p[1] + 0.8); g.lineTo(q[0] + 0.6, q[1] + 0.8); g.strokeStyle = 'rgba(20,12,24,0.45)'; g.lineWidth = 2.2; g.stroke();
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.strokeStyle = 'rgba(255,244,222,0.42)'; g.lineWidth = 1.2; g.stroke();
  }
  wing(ctx, d, hw, hd) {                                                                 // a lower roof section over part of the house (garage, stepped wing)
    const { g } = ctx, x0 = d.x0 * hw, x1 = d.x1 * hw, y0 = d.y0 * hd, y1 = d.y1 * hd;
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    this.roof(ctx, { x0, x1, y0, y1 }, 'gable', d.ridge || 'y', d.c1, d.c2); g.restore();
    g.strokeStyle = 'rgba(36,24,42,0.55)'; g.lineWidth = 1.5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  // ---- under-body details (ground level): drive, lot, deck, pool, neighbour house
  u_drive(ctx, d) {
    const { g, hw, hd, lim } = ctx, len = Math.min(d.len, lim), x = d.x * hw, w = d.w;
    g.fillStyle = d.color; g.fillRect(x - w / 2, hd - 4, w, len + 4); g.strokeStyle = 'rgba(40,30,50,0.4)'; g.lineWidth = 1.2; g.strokeRect(x - w / 2, hd - 4, w, len + 4);
    g.fillStyle = 'rgba(40,30,50,0.18)'; g.fillRect(x - w / 2, hd + len - 8, w, 8);       // apron into the street
  }
  u_curvedrive(ctx, d) {
    const { g, hw, hd, lim } = ctx, len = Math.min(d.len, lim * 1.6), x = d.x * hw, w = d.w, b = d.bend;
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([x + b * Math.sin(t * Math.PI * 0.5) * t, hd - 4 + len * t]); }
    for (const [lw, c] of [[w + 4, 'rgba(30,22,40,0.5)'], [w, d.color]]) { g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.lineWidth = lw; g.strokeStyle = c; g.lineCap = 'butt'; g.lineJoin = 'round'; g.stroke(); }
    g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.stroke();
  }
  u_lot(ctx, d) {
    const { g, hw, hd, lim } = ctx, depth = Math.min(d.depth, Math.max(24, lim - d.gap - 6)), x0 = -hw * d.w, y0 = hd + d.gap, W2 = hw * d.w * 2;
    g.fillStyle = '#4a4952'; g.fillRect(x0, y0, W2, depth); g.fillStyle = '#d8cfbd'; g.fillRect(x0 - 3, y0 - 3, W2 + 6, 3);
    g.strokeStyle = 'rgba(244,240,230,0.7)'; g.lineWidth = 1.4; g.beginPath();
    for (let x = x0 + 12; x < x0 + W2 - 6; x += 17) { g.moveTo(x, y0 + 5); g.lineTo(x, y0 + Math.min(depth - 4, 36)); }
    g.stroke();
  }
  u_deck(ctx, d) {
    const { g, hw, hd } = ctx, x = d.x * hw, w = d.w, dd = d.d;
    g.fillStyle = 'rgba(30,20,20,0.35)'; g.fillRect(x - w / 2 + 3, -hd - dd + 3, w, dd);
    g.fillStyle = d.color; g.fillRect(x - w / 2, -hd - dd, w, dd + 2);
    g.strokeStyle = 'rgba(40,16,10,0.4)'; g.lineWidth = 0.9; g.beginPath(); for (let y = -hd - dd + 5; y < -hd; y += 5) { g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); } g.stroke();
    g.strokeStyle = '#4a2a20'; g.lineWidth = 2; g.strokeRect(x - w / 2, -hd - dd, w, dd);
    g.fillStyle = '#2c2c34'; g.beginPath(); g.arc(x + w * 0.25, -hd - dd * 0.5, 5, 0, 7); g.fill(); g.fillStyle = '#d8d0c0'; g.beginPath(); g.arc(x - w * 0.2, -hd - dd * 0.45, 8, 0, 7); g.fill();   // grill + patio table
  }
  u_pool(ctx, d) {
    const { g, hw, hd } = ctx, x = d.x * hw, w = d.w, h = d.h, y = -hd - d.gap - h;
    g.fillStyle = '#e6e0d2'; rrect(g, x - w / 2 - 6, y - 6, w + 12, h + 12, 9); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#2f9fc8'; rrect(g, x - w / 2, y, w, h, 6); g.fill(); g.fillStyle = 'rgba(190,240,255,0.5)'; rrect(g, x - w / 2 + 5, y + 4, w * 0.55, h * 0.3, 4); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - w / 2 + 6, y + h * 0.7); g.bezierCurveTo(x - w * 0.15, y + h * 0.5, x + w * 0.1, y + h * 0.9, x + w / 2 - 6, y + h * 0.65); g.stroke();
  }
  u_neighbor(ctx, d) {                                                                   // the Floyds' pair: a second house beside, side-on, with its own drive
    const { g, hw, hd, lim } = ctx, nx = hw + d.gap + hw;
    g.save(); g.translate(nx, 0);
    const dx = d.drive * hw, len = Math.min(105, lim);
    g.fillStyle = '#b4b0a9'; g.fillRect(dx - 14, hd - 4, 28, len + 4); g.strokeStyle = 'rgba(40,30,50,0.4)'; g.lineWidth = 1.2; g.strokeRect(dx - 14, hd - 4, 28, len + 4);
    g.fillStyle = 'rgba(132,176,86,0.40)'; rrect(g, -hw - 14, -hd - 30, hw * 2 + 28, hd * 2 + 80, 18); g.fill();
    g.save(); g.globalAlpha = 0.38; g.fillStyle = '#21183a'; g.translate((this.SUN.x * ctx.F.u[0] + this.SUN.y * ctx.F.u[1]) * 34 / ctx.S, (this.SUN.x * ctx.F.v[0] + this.SUN.y * ctx.F.v[1]) * 34 / ctx.S); g.fillRect(-hw, -hd, hw * 2, hd * 2); g.restore();
    const P = [-hw, -hd, hw, -hd, hw, hd, -hw, hd];
    this.body(ctx, P, hw, hd, { wall: d.wall, roof: { type: 'gable', ridge: 'long', c1: d.roof1, c2: d.roof2 } });
    g.fillStyle = '#e8e2d4'; g.fillRect(-hw * 0.25 - 8, hd, 16, 9); g.fillStyle = '#3d342d'; g.fillRect(-hw * 0.25 - 5, hd - 3, 10, 5);
    this.windows(ctx, hw, hd, nx);
    g.restore();
  }
  // ---- over-body details
  o_garage(ctx, d) {
    const { g, hw, hd } = ctx, n = d.doors, w = d.w, x = d.x * hw, pw = w / n;
    g.fillStyle = 'rgba(30,22,40,0.35)'; g.fillRect(x - w / 2 - 1, hd - 11, w + 2, 14);
    for (let i = 0; i < n; i++) {
      const px = x - w / 2 + i * pw + 1;
      g.fillStyle = d.color; g.fillRect(px, hd - 10, pw - 2, 12); g.strokeStyle = 'rgba(30,22,40,0.75)'; g.lineWidth = 1.2; g.strokeRect(px, hd - 10, pw - 2, 12);
      g.beginPath(); for (let q = 1; q < 4; q++) { g.moveTo(px, hd - 10 + q * 3); g.lineTo(px + pw - 2, hd - 10 + q * 3); } g.stroke();
    }
  }
  o_door(ctx, d) {
    const { g, hw, hd, night } = ctx, x = d.x * hw, w = d.w;
    if (d.beacon) { const gr = g.createRadialGradient(x, hd + 6, 2, x, hd + 6, 46); gr.addColorStop(0, 'rgba(255,60,50,0.5)'); gr.addColorStop(1, 'rgba(255,60,50,0)'); g.fillStyle = gr; g.fillRect(x - 50, hd - 40, 100, 100); }
    if (d.contrast) { g.fillStyle = 'rgba(30,30,40,0.22)'; rrect(g, x - w, hd - 3, w * 2, 18, 4); g.fill(); }
    g.fillStyle = '#d9d3c6'; g.fillRect(x - w * 0.85, hd, w * 1.7, 14); g.strokeStyle = 'rgba(40,30,50,0.6)'; g.lineWidth = 1.1; g.strokeRect(x - w * 0.85, hd, w * 1.7, 14);
    if (d.beacon) { g.fillStyle = '#9d1b22'; g.fillRect(x - w * 0.6, hd + 4, w * 1.2, 8); }            // the red mat on the step
    g.fillStyle = d.color; g.fillRect(x - w / 2, hd - 8, w, 9); g.lineWidth = 1.4; g.strokeStyle = INK; g.strokeRect(x - w / 2, hd - 8, w, 9);
    g.fillStyle = '#d8d0b8'; g.fillRect(x - 1.5, hd + 11, 3, 24);                                       // a path toward the street
  }
  windows(ctx, hw, hd, ox = 0) {
    const { g, night } = ctx; const n = hw > 60 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n * hw * 1.7 - hw * 0.85;
      g.fillStyle = '#7e93a6'; g.fillRect(x - 5, hd - 6, 10, 6); g.strokeStyle = 'rgba(36,24,42,0.7)'; g.lineWidth = 1; g.strokeRect(x - 5, hd - 6, 10, 6);
      if (night > 0.02) { g.fillStyle = `rgba(255,214,120,${0.15 + 0.8 * night})`; g.fillRect(x - 4, hd - 5, 8, 4); this.L.push({ F: ctx.F, S: ctx.S, x: x + ox, y: hd - 3, a: night }); }
    }
  }
  o_windows(ctx) { this.windows(ctx, ctx.hw, ctx.hd); }
  o_shutters(ctx, d) {                                                                    // pairs of shutters flanking windows along every real wall (reads on the long side wall too)
    const { g, F } = ctx, P = F.P, n = P.length / 2; g.fillStyle = d.color;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = P[i * 2], ay = P[i * 2 + 1], bx = P[j * 2], by = P[j * 2 + 1], L = Math.hypot(bx - ax, by - ay); if (L < 22) continue;
      const tx = (bx - ax) / L, ty = (by - ay) / L, nx = ty, ny = -tx, k = Math.max(1, Math.floor(L / 24));
      for (let m = 0; m < k; m++) {
        const t = (m + 0.5) / k * L, cx = ax + tx * t, cy = ay + ty * t, mx = (ax + bx) / 2 * 0 + cx, my = cy;
        const dir = (cx * nx + cy * ny) >= 0 ? 1 : -1;                                       // outward normal
        for (const s of [-6.5, 6.5]) {
          g.save(); g.translate(mx + tx * s, my + ty * s); g.rotate(Math.atan2(ty, tx)); g.fillRect(-1.8, dir > 0 ? -1 : -8, 3.6, 9); g.restore();
        }
      }
    }
  }
  o_hoop(ctx, d) {
    const { g, hw } = ctx, x = d.x * hw, y = Math.min(d.y, ctx.lim - 14);
    g.fillStyle = 'rgba(30,20,40,0.3)'; g.fillRect(x - 8 + 4, y + 4, 16, 3);
    g.fillStyle = '#f2f2f2'; g.fillRect(x - 8, y, 16, 3); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - 8, y, 16, 3);
    g.strokeStyle = '#e8641f'; g.lineWidth = 1.8; g.beginPath(); g.arc(x, y + 8, 5, 0, 7); g.stroke();
  }
  o_trees(ctx, d) {
    const { g } = ctx;
    for (const [x, y, r] of d.list) {
      const wx = ctx.F.cx + ctx.S * (ctx.F.u[0] * x + ctx.F.v[0] * y), wy = ctx.F.cy + ctx.S * (ctx.F.u[1] * x + ctx.F.v[1] * y), ri = this.W.roadInfo(wx, wy, 0);
      if (ri.e && ri.d < ri.hw + r * ctx.S + 14) continue;                               // never a canopy over the road
      g.fillStyle = 'rgba(20,32,18,0.35)'; g.beginPath(); g.arc(x + 9, y + 3, r, 0, 7); g.fill();
      g.fillStyle = '#3a6b30'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#52893c'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.68, 0, 7); g.fill();
      g.fillStyle = '#74ab52'; g.beginPath(); g.arc(x - r * 0.4, y - r * 0.45, r * 0.34, 0, 7); g.fill();
    }
  }
  o_storefront(ctx) {                                                                      // Ledo: glazing + striped awning (neutral retail defaults)
    const { g, hw, hd, night } = ctx, x0 = -hw * 0.82, w = hw * 1.64;
    g.fillStyle = night > 0.2 ? `rgba(255,224,150,${0.4 + 0.5 * night})` : '#6f8ea0'; g.fillRect(x0, hd - 6, w, 7); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x0, hd - 6, w, 7);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe6' : '#c8372f'; g.fillRect(x0 + i * w / 8, hd + 1, w / 8, 9); }
    g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x0, hd + 1, w, 9);
  }
  o_windowband(ctx, d) {                                                                   // the long brick frontage: a window run on every front-facing wall (neutral school detailing)
    const { g, F, night } = ctx, P = F.P, n = P.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = P[i * 2], ay = P[i * 2 + 1], bx = P[j * 2], by = P[j * 2 + 1], L = Math.hypot(bx - ax, by - ay); if (L < 60 || Math.abs(by - ay) > 0.2 * L || (ay + by) / 2 < 0) continue;
      const k = Math.floor(L / d.step), x0 = Math.min(ax, bx), y = (ay + by) / 2;
      for (let m = 0; m < k; m++) {
        const x = x0 + (m + 0.5) * L / k; g.fillStyle = night > 0.2 ? `rgba(255,214,120,${0.3 + 0.6 * night})` : '#7e93a6'; g.fillRect(x - 10, y - 8, 20, 9); g.strokeStyle = 'rgba(36,24,42,0.7)'; g.lineWidth = 1; g.strokeRect(x - 10, y - 8, 20, 9);
      }
    }
  }
  o_hvac(ctx, d) {
    const { g, hw, hd } = ctx;
    for (const [fx, fy] of d.list) {
      const x = fx * hw, y = fy * hd; g.fillStyle = 'rgba(20,14,30,0.3)'; g.fillRect(x - 11 + 3, y - 8 + 3, 22, 16);
      g.fillStyle = '#b4b8be'; g.fillRect(x - 11, y - 8, 22, 16); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - 11, y - 8, 22, 16);
      g.strokeStyle = '#6a6e76'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke();
    }
  }
  sign(ctx, d) {                                                                           // the lit OPEN sign — the beacon; drawn upright in screen orientation
    const { g, F, S, night } = ctx, lx = d.x * ctx.hw, ly = ctx.hd + d.y;
    const wx = F.cx + S * (F.u[0] * lx + F.v[0] * ly), wy = F.cy + S * (F.u[1] * lx + F.v[1] * ly), w = d.w * S, h = d.h * S;
    const gl = g.createRadialGradient(wx, wy, 2, wx, wy, w * 1.6); gl.addColorStop(0, `rgba(255,70,60,${0.28 + 0.4 * night})`); gl.addColorStop(1, 'rgba(255,70,60,0)'); g.fillStyle = gl; g.fillRect(wx - w * 1.7, wy - w * 1.7, w * 3.4, w * 3.4);
    g.fillStyle = 'rgba(20,14,30,0.3)'; rrect(g, wx - w / 2 + 3, wy - h / 2 + 4, w, h, 5); g.fill();
    g.fillStyle = '#1b1624'; rrect(g, wx - w / 2, wy - h / 2, w, h, 5); g.fill(); g.lineWidth = 2; g.strokeStyle = '#3b8bff'; g.stroke();
    g.font = `800 ${Math.round(h * 0.7)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff4a3a'; g.shadowColor = '#ff5a40'; g.shadowBlur = 6 + 10 * night;
    g.fillText(d.text, wx, wy + 1); g.shadowBlur = 0; g.textBaseline = 'alphabetic';
    if (night > 0.05) this.L.push({ sign: true, x: wx, y: wy, w, h, a: night });
  }
  // ---- Maple Lawn (district, no hero entry in areas.json): the brick main-street retail run under one green roof
  districtList() {
    const A = this.areas.A, D = this.data.district; if (this._dl && this._dlA === A) return this._dl;
    const L = []; if (!A.buildings.length) return (this._dl = L);
    const hs = this.areas.heroSet;
    A.buildings.forEach((f, i) => {
      if (hs.has(i)) return; let cx = 0, cy = 0, a = 0; const n = f.length / 2;
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; cx += f[k * 2]; cy += f[k * 2 + 1]; a += f[k * 2] * f[j * 2 + 1] - f[j * 2] * f[k * 2 + 1]; }
      cx /= n; cy /= n; a = Math.abs(a) / 2;
      if (a < D.minArea || a > D.maxArea || Math.hypot(cx - D.center[0], cy - D.center[1]) > D.radius) return;
      L.push({ f, cx, cy, i });
    });
    this._dlA = A; return (this._dl = L);
  }
  district(g, gr, vis) {
    this.L.length = 0; if (!this.data) return; const D = this.data.district, S = 1.12, L = this.districtList(); this.dvis = false;
    for (const b of L) {
      if (!vis(b.cx, b.cy, 200)) continue; this.dvis = true; const P = b.f;
      const poly = (s) => { g.beginPath(); for (let k = 0; k < P.length; k += 2) { const x = b.cx + (P[k] - b.cx) * s, y = b.cy + (P[k + 1] - b.cy) * s; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
      g.globalAlpha = 0.38; g.fillStyle = '#21183a'; g.save(); g.translate(this.SUN.x * 28, this.SUN.y * 28); poly(S); g.fill(); g.restore();
      g.globalAlpha = 1; poly(S); g.fillStyle = D.wall; g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
      g.save(); poly(S * 0.9); g.clip(); g.fillStyle = D.roof1; g.fillRect(b.cx - 600, b.cy - 600, 1200, 1200);
      for (let k = 0; k < 9; k++) { g.globalAlpha = 0.55; g.fillStyle = k % 2 ? D.roof2 : '#4f8a3c'; g.beginPath(); g.ellipse(b.cx + (hash(b.i + k) - 0.5) * 160, b.cy + (hash(b.i * 3 + k) - 0.5) * 160, 16 + hash(b.i + k * 7) * 22, 10 + hash(k + b.i * 5) * 16, hash(k) * 3, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.restore(); poly(S * 0.9); g.lineWidth = 3; g.strokeStyle = 'rgba(236,228,212,0.85)'; g.stroke(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(36,24,42,0.5)'; poly(S * 0.9); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // after the grade (the world transform is set by the caller): lit windows and the OPEN sign punch THROUGH the night multiply
  lights(g) {
    if (!this.L.length) return; g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of this.L) {
      if (l.sign) {
        const gl = g.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.w * 1.5); gl.addColorStop(0, `rgba(255,70,50,${0.55 * l.a})`); gl.addColorStop(1, 'rgba(255,70,50,0)'); g.fillStyle = gl; g.fillRect(l.x - l.w * 1.6, l.y - l.w * 1.6, l.w * 3.2, l.w * 3.2);
        g.fillStyle = `rgba(255,80,60,${0.75 * l.a})`; g.fillRect(l.x - l.w * 0.4, l.y - l.h * 0.28, l.w * 0.8, l.h * 0.56); continue;
      }
      const F = l.F; g.save(); g.transform(F.u[0] * l.S, F.u[1] * l.S, F.v[0] * l.S, F.v[1] * l.S, F.cx, F.cy);
      const gl = g.createRadialGradient(l.x, l.y + 3, 1, l.x, l.y + 3, 15); gl.addColorStop(0, `rgba(255,190,90,${0.5 * l.a})`); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(l.x - 16, l.y - 12, 32, 32);
      g.fillStyle = `rgba(255,214,120,${0.8 * l.a})`; g.fillRect(l.x - 4, l.y - 2, 8, 4); g.restore();
    }
    g.restore(); this.L.length = 0;
  }
  districtPlaque(g, vis) {
    if (!this.data || !this.dvis) return; const D = this.data.district; if (!vis(D.center[0], D.center[1], 700)) return;
    g.font = '800 22px system-ui'; const w = g.measureText(D.who).width + 26, x = D.center[0], y = D.center[1] - 120;
    g.fillStyle = 'rgba(255,241,216,0.94)'; g.beginPath(); g.roundRect(x - w / 2, y - 18, w, 34, 12); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.textAlign = 'center'; g.fillText(D.who, x, y + 7);
  }
}

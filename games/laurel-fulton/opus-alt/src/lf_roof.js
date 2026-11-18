// lf_roof.js — task L5, the DRAWING of the climbable Atholton roof (logic: lf_climb.js, data: data/roof.json).
// The school is the one building in the world you can stand on, so it is the one drawn with HEIGHT: GTA-2-style top-down
// perspective (lf_climb.project) — the roof leans away from the view centre, so from the lot you see the north wall, its
// window bands, and the climb chain standing against it. Draw order (lf_render.js): worn path with the ground -> holds
// on the far side -> walls far-to-near -> roof + parapet + kit -> holds on your side -> the CLIMB plaque.
//
// Readable without a tutorial (owner's L5 rule): a trodden path to the dumpster, the holds in loud colours (green
// dumpster, hazard-striped HVAC edge), boot scuffs up the wall above the HVAC, and one CLIMB plaque that retires for
// good after your first climb (Palm City's labels.js, the standing retire-after-first-use rule).
import { project } from './lf_climb.js';
import { labelAlpha } from '../../../palm-city/src/labels.js';

const TAU = Math.PI * 2;
const SUN = { x: 0.8, y: -0.3 };
const WALL = [184, 128, 94];                             // Atholton's brick
const shade = (c, k) => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`;
const ring = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; };

export class RoofView {
  constructor(RF) {
    this.RF = RF; const R = RF.R;
    this.rings = [ring(R.outer), ...R.inner.map(ring)];
    this.walls = [];                                      // every wall face, with its outward normal (away from the roof)
    this.rings.forEach((pts, ri) => pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return;
      let nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (RF.inRoof(mx + nx * 6, my + ny * 6)) { nx = -nx; ny = -ny; }
      this.walls.push({ a, b, L, nx, ny, mx, my, ri });
    }));
    const xs = this.rings[0].map(p => p[0]), ys = this.rings[0].map(p => p[1]);
    this.bb = { x0: Math.min(...xs) - 300, x1: Math.max(...xs) + 300, y0: Math.min(...ys) - 300, y1: Math.max(...ys) + 300 };
  }
  visible(cam, hw, hh) { const B = this.bb; return B.x1 > cam.x - hw && B.x0 < cam.x + hw && B.y1 > cam.y - hh && B.y0 < cam.y + hh; }
  // with the ground: the worn path + the building's cast shadow
  ground(g) {
    const R = this.RF.R, P = R.path;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(92,70,48,0.42)'; g.lineWidth = 16; g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = 'rgba(120,96,66,0.35)'; g.lineWidth = 7; g.stroke();
    const h = this.RF.h * 0.9;
    g.globalAlpha = 0.34; g.fillStyle = '#21183a'; g.beginPath();
    for (const pts of this.rings) pts.forEach(([x, y], i) => i ? g.lineTo(x + SUN.x * h, y + SUN.y * h) : g.moveTo(x + SUN.x * h, y + SUN.y * h));
    g.fill('evenodd'); g.globalAlpha = 1;
  }
  P(x, y, z) { return project(x, y, z, this.cam); }
  quad(g, a, b, z0, z1) {
    const p = this.P(a[0], a[1], z0), q = this.P(b[0], b[1], z0), r = this.P(b[0], b[1], z1), s = this.P(a[0], a[1], z1);
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.lineTo(r.x, r.y); g.lineTo(s.x, s.y); g.closePath();
  }
  // a box (holds, AC units): sides far-to-near, then the lid; returns the lid corners for details
  box(g, b, z0, z1, col, ink = '#2a1430') {
    const ca = Math.cos(b.a), sa = Math.sin(b.a), hw = b.w / 2, hd = b.d / 2;
    const C = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * ca - v * sa, b.y + u * sa + v * ca]);
    const sides = [0, 1, 2, 3].map(i => ({ a: C[i], b: C[(i + 1) % 4], d: Math.hypot((C[i][0] + C[(i + 1) % 4][0]) / 2 - this.cam.x, (C[i][1] + C[(i + 1) % 4][1]) / 2 - this.cam.y) }));
    sides.sort((p, q) => q.d - p.d);
    for (const s of sides) {
      const nx = (s.b[1] - s.a[1]), ny = -(s.b[0] - s.a[0]), lit = 0.78 + 0.22 * Math.max(0, -(nx * SUN.x + ny * SUN.y) / Math.hypot(nx, ny));
      this.quad(g, s.a, s.b, z0, z1); g.fillStyle = shade(col, lit * 0.8); g.fill(); g.lineWidth = 1.2; g.strokeStyle = ink; g.stroke();
    }
    const T = C.map(([x, y]) => this.P(x, y, z1));
    g.beginPath(); T.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fillStyle = shade(col, 1.08); g.fill(); g.lineWidth = 1.5; g.strokeStyle = ink; g.stroke();
    return T;
  }
  hold(g, b, time) {
    if (b.kind === 'dumpster') {
      const T = this.box(g, b, 0, b.top, [47, 98, 66]);
      g.strokeStyle = 'rgba(20,40,28,0.8)'; g.lineWidth = 1.2;            // the two lids
      const m0 = { x: (T[0].x + T[1].x) / 2, y: (T[0].y + T[1].y) / 2 }, m1 = { x: (T[3].x + T[2].x) / 2, y: (T[3].y + T[2].y) / 2 };
      g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke();
    } else if (b.kind === 'hvac' || b.kind === 'cabinet') {
      const T = this.box(g, b, 0, b.top, b.kind === 'hvac' ? [196, 190, 176] : [150, 156, 160]);
      if (b.kind === 'hvac') {                                            // the fan grille + a hazard-striped lip on the wall side
        const cx = (T[0].x + T[2].x) / 2, cy = (T[0].y + T[2].y) / 2;
        g.fillStyle = '#3a3640'; g.beginPath(); g.arc(cx, cy, 6, 0, TAU); g.fill();
        g.strokeStyle = '#8c8790'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { const a = time * 9 + k * TAU / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5); g.stroke(); }
      }
      g.lineWidth = 3; g.setLineDash([4, 4]); g.strokeStyle = '#ffcf3a'; g.beginPath(); g.moveTo(T[0].x, T[0].y); g.lineTo(T[1].x, T[1].y); g.stroke();
      g.strokeStyle = '#1e1a22'; g.lineDashOffset = 4; g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    } else if (b.kind === 'planter') {
      const T = this.box(g, b, 0, b.top, [168, 112, 84]);
      g.fillStyle = '#4f7d3d'; for (let k = 0; k < 4; k++) { const u = (k + 0.5) / 4; g.beginPath(); g.arc(T[0].x + (T[1].x - T[0].x) * u + (T[3].x - T[0].x) * 0.5, T[0].y + (T[1].y - T[0].y) * u + (T[3].y - T[0].y) * 0.5, 3.4, 0, TAU); g.fill(); }
    }
  }
  // holds whose wall faces away from the camera are behind the building: drawn first, so the building covers them
  holdsSide(g, front, time) {
    for (const ch of this.RF.R.chains) {
      const w = ch.wall, facing = (this.cam.x - w.x) * w.nx + (this.cam.y - w.y) * w.ny > 0;
      if (facing === front) for (const b of ch.holds) this.hold(g, b, time);
    }
  }
  building(g, time) {
    const R = this.RF.R, H = this.RF.h, cam = this.cam;
    const ws = this.walls.map(w => ({ w, d: Math.hypot(w.mx - cam.x, w.my - cam.y) })).sort((p, q) => q.d - p.d);
    for (const { w } of ws) {
      const lit = 0.72 + 0.28 * Math.max(0, -(w.nx * SUN.x + w.ny * SUN.y)) + 0.08 * Math.max(0, w.ny);
      this.quad(g, w.a, w.b, 0, H); g.fillStyle = shade(WALL, lit); g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#3a1c2a'; g.stroke();
      for (const [z0, z1] of [[11, 25], [47, 61]]) {                       // two storeys of window bands, mullions every ~3 m
        this.quad(g, w.a, w.b, z0, z1); g.fillStyle = 'rgba(52,56,82,0.86)'; g.fill();
        const n = Math.floor(w.L / 30); g.strokeStyle = shade(WALL, lit * 1.1); g.lineWidth = 1.6;
        for (let k = 1; k < n; k++) { const u = k / n, x = w.a[0] + (w.b[0] - w.a[0]) * u, y = w.a[1] + (w.b[1] - w.a[1]) * u, p = this.P(x, y, z0), q = this.P(x, y, z1); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
      }
    }
    for (const ch of R.chains) {                                         // boot scuffs up the wall above the top hold (the way up, read at a glance)
      const t = ch.holds[1], w = ch.wall;
      for (let k = 0; k < 5; k++) {
        const z = t.top + 6 + k * 7, s = (k % 2 ? 1 : -1) * 3, p = this.P(w.x - w.ny * s + w.nx * 0.5, w.y + w.nx * s + w.ny * 0.5, z);
        g.fillStyle = 'rgba(40,24,30,0.5)'; g.beginPath(); g.ellipse(p.x, p.y, 3.2, 1.6, 0, 0, TAU); g.fill();
      }
    }
    // the roof: membrane with seams along the building's axis, holes for the courtyards
    const roofPath = () => { g.beginPath(); for (const pts of this.rings) pts.forEach(([x, y], i) => { const p = this.P(x, y, H); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); };
    roofPath(); g.fillStyle = '#cfc8bb'; g.fill('evenodd');
    g.save(); roofPath(); g.clip('evenodd');
    const ax = R.axis, ca = Math.cos(ax), sa = Math.sin(ax), B = this.bb, c0 = this.P((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, H), span = Math.hypot(B.x1 - B.x0, B.y1 - B.y0);
    const k = this.P(cam.x + 1, cam.y, H).x - cam.x;                    // the roof plane's scale at this camera
    g.strokeStyle = 'rgba(150,140,128,0.5)'; g.lineWidth = 1;
    for (let s = -span / 2; s < span / 2; s += 30) { const ox = c0.x - sa * s * k, oy = c0.y + ca * s * k; g.beginPath(); g.moveTo(ox - ca * span * k, oy - sa * span * k); g.lineTo(ox + ca * span * k, oy + sa * span * k); g.stroke(); }
    g.globalAlpha = 0.18; g.fillStyle = '#fff2d8'; g.fillRect(c0.x - span, c0.y - span, span * 2, span * 2); g.globalAlpha = 1;   // the golden hour on a pale roof
    g.restore();
    for (const pts of this.rings) {                                      // the parapet: a coping lip all round, its inside face just visible
      g.beginPath(); pts.forEach(([x, y], i) => { const p = this.P(x, y, H + R.parapet); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath();
      g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#8f7f72'; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#ece2cf'; g.stroke();
    }
    // the kit: pipes (low, step over), vents, the hatch, AC units (solid, climbable)
    g.lineCap = 'round';
    for (const [x0, y0, x1, y1] of R.pipes) { const p = this.P(x0, y0, H + 3), q = this.P(x1, y1, H + 3); g.strokeStyle = '#6d6a70'; g.lineWidth = 4; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); g.strokeStyle = '#b4b0b6'; g.lineWidth = 1.4; g.stroke(); }
    for (const v of R.vents) { const p = this.P(v.x, v.y, H + 5); g.fillStyle = '#a9a5ad'; g.beginPath(); g.arc(p.x, p.y, v.r, 0, TAU); g.fill(); g.fillStyle = '#3a3640'; g.beginPath(); g.arc(p.x, p.y, v.r * 0.5, 0, TAU); g.fill(); }
    const hb = { x: R.hatch.x, y: R.hatch.y, a: R.hatch.a, w: 12, d: 12 }; this.box(g, hb, H, H + 4, [120, 116, 110]);
    for (const u of R.ac) {
      const T = this.box(g, u, H, u.top, [214, 212, 204]), cx = (T[0].x + T[2].x) / 2, cy = (T[0].y + T[2].y) / 2, r = Math.min(u.w, u.d) * 0.3;
      g.fillStyle = '#34303a'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.strokeStyle = '#8d8894'; g.lineWidth = 1.3; for (let k = 0; k < 3; k++) { const a = time * 7 + u.x + k * TAU / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.stroke(); }
    }
  }
  // the one helper label: CLIMB over the first hold, until your first climb (then it fades and never comes back)
  plaque(g, sim, time) {
    const a = labelAlpha(sim, 'lf_roof'); if (a <= 0) return;
    const b = this.RF.R.chains[0].holds[0], q = this.P(b.x, b.y, b.top), p = { x: q.x, y: q.y - 46 + Math.sin(time * 3) * 3 };   // floats up-screen, clear of the holds
    g.globalAlpha = a; g.font = '900 15px system-ui'; g.textAlign = 'center';
    const w = g.measureText('CLIMB').width + 22; g.fillStyle = 'rgba(255,214,90,0.95)'; g.beginPath(); g.roundRect(p.x - w / 2, p.y - 15, w, 26, 10); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#2a1430'; g.stroke(); g.fillStyle = '#2a1430'; g.fillText('CLIMB', p.x, p.y + 4);
    g.beginPath(); g.moveTo(p.x - 6, p.y + 11); g.lineTo(p.x + 6, p.y + 11); g.lineTo(p.x, p.y + 18); g.closePath(); g.fillStyle = 'rgba(255,214,90,0.95)'; g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
}

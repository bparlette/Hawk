// lf_gta6.js — GTA6-look pass (Nov 19, Cherie's GTA VI TV photos; sample approved, rolled out
// town-wide the same night). The look, decomposed from the photos: (1) weathered ground — that
// half lives in lf_ground.js now (every parking polygon + service road, painted per chunk in the
// sliced queue); (2) WORKED ROOFS per archetype, baked once into offscreen canvases and blitted
// over the hero tier — big-box tar (the Weis), flat retail/school tar, gabled house shingles;
// (3) DRESSED ground — props from src/lf_gta6_data.js anchors + archetype scatter, crosswalks at
// the public doors; (4) power poles + sagging wires generated from the road graph, and pennant
// strings across the dressed frontages — drawn live, over the cars, under the grade, so the
// existing day-night cycle grades everything (at t≈0.82 the dusk keys ARE the photos' blue hour).
// Roof bakes are sliced generators advanced a few ms per frame from the render hooks — a bake
// never lands in one frame, and the far-zoom view never triggers one (hooks are !far-gated and
// view-culled). No-ops on any map whose data doesn't carry the heroes (College Park safe).
import { mulberry32 } from '../../palm-city/src/world.js';
import { poly } from './lf_areas.js';
import { SITE_PROPS, PENNANT_SITES } from './lf_gta6_data.js';

const SUN = { x: 0.8, y: -0.3 };            // the bake's sun (lf_render.js): shadows fall east-north-east
const PLACEHOLDER_S = { poi: 1.16, home: 1.40 };   // lf_render.js hero placeholder scales (no-spec heroes)

function inPoly(x, y, f) {
  let inside = false;
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const bbox = (f) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); } return [x0, y0, x1, y1]; };
const centroid = (f) => { let x = 0, y = 0, n = f.length / 2; for (let k = 0; k < f.length; k += 2) { x += f[k]; y += f[k + 1]; } return [x / n, y / n]; };
const scaled = (f, s, cx, cy) => { const o = []; for (let k = 0; k < f.length; k += 2) o.push(cx + (f[k] - cx) * s, cy + (f[k + 1] - cy) * s); return o; };
// minimum-area oriented box (same maths as lf_heroes.js frame(), so overlays align with HeroArt)
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
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)), px = ax + vx * t, py = ay + vy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) { best = d; bp = [px, py]; }
  }
  return bp;
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export class Gta6Look {
  constructor(areas, W) {
    this.ok = false; this.W = W; this.areas = areas; this.frames = 0;
    if (!areas || !areas.A || !areas.A.buildings || !areas.A.buildings.length || !areas.heroes) return;
    this._poles(W, areas);
    this.sites = [];
    for (const h of areas.heroes) { const s = this._site(h); if (s) this.sites.push(s); }
    this._bakeCur = null;
    this.ok = this.sites.length > 0 || this.poles.length > 0;
  }

  // ---------- sites: one per hero, with a (t,n) ground frame + an archetype ----------
  _site(h) {
    const A = this.areas.A, f = h.f; if (!f || f.length < 6) return null;
    const [cx, cy] = [h.cx, h.cy];
    let nx, ny, lot = null;
    if (h.door) {                                    // a public place: the door normal is the front
      nx = h.door.nx; ny = h.door.ny;
      let best = 1e18;
      for (const p of A.parking || []) {
        const [px, py] = centroid(p), [x0, y0, x1, y1] = bbox(p), area = (x1 - x0) * (y1 - y0);
        const d = Math.hypot(px - cx, py - cy);
        if (area > 200000 && d < best) { best = d; lot = p; }
      }
      if (lot) { const [lx, ly] = centroid(lot); if ((lx - cx) * nx + (ly - cy) * ny < 0) { nx = -nx; ny = -ny; } }
      else if ((h.door.x - cx) * nx + (h.door.y - cy) * ny < 0) { nx = -nx; ny = -ny; }
    } else {                                         // frame front = toward the nearest road (HeroArt's rule)
      const o = obb(f), r = this.W.roadInfo(o.cx, o.cy, 0);
      nx = 0; ny = 1;
      if (r && r.e) {
        const p = nearOnEdge(r.e, o.cx, o.cy);
        if (p) {
          const dx = p[0] - o.cx, dy = p[1] - o.cy, ca = [[o.ax, o.ay], [-o.ax, -o.ay], [-o.ay, o.ax], [o.ay, -o.ax]];
          let bd = -1e18; for (const c of ca) { const d = c[0] * dx + c[1] * dy; if (d > bd) { bd = d; nx = c[0]; ny = c[1]; } }
        }
      }
    }
    const t = { x: -ny, y: nx }, n = { x: nx, y: ny };
    const proj = (ff) => { let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let k = 0; k < ff.length; k += 2) { const dx = ff[k] - cx, dy = ff[k + 1] - cy, u = dx * t.x + dy * t.y, v = dx * n.x + dy * n.y; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); } return { u0, u1, v0, v1 }; };
    const bE = proj(f);
    const arch = h.who === 'Weis' ? 'bigbox' : h.kind === 'home' ? 'gable' : /High School/.test(h.who) ? 'school' : 'flat';
    const s = {
      h, f, cx, cy, t, n, bE, lot, arch, door: h.door || null,
      S: PLACEHOLDER_S[h.kind === 'poi' ? 'poi' : 'home'],
      seed: hashStr(h.who), roof: { started: false, cv: null, gen: null },
      props: (SITE_PROPS[h.who] || []).slice(),
      pennant: PENNANT_SITES.includes(h.who), strings: null,
    };
    s.P = (u, v) => [cx + t.x * u + n.x * v, cy + t.y * u + n.y * v];
    if (h.kind === 'home') {                          // archetype scatter: kerb bins + a backyard stack
      const kinds = ['crates', 'tires', 'pallets'];
      s.props.push(['bins', bE.u1 - 16, bE.v1 + 34], [kinds[s.seed % 3], bE.u0 + 24, bE.v0 - 30]);
    }
    return s;
  }

  // ---------- poles + wires from the road graph ----------
  _poles(W, areas) {
    this.poles = []; this.wires = []; this.poleGrid = new Map();
    const CL = new Set(['trunk', 'primary', 'secondary', 'tertiary']);
    const bad = (x, y) => {
      const ccx = Math.floor(x / 256), ccy = Math.floor(y / 256);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const key = (ccx + i) * 100003 + (ccy + j);
        for (const bi of areas.idx.buildings.get(key) || []) if (inPoly(x, y, areas.A.buildings[bi])) return true;
        for (const pi of areas.idx.parking.get(key) || []) if (inPoly(x, y, areas.A.parking[pi])) return true;
      }
      try { return W.surfaceAt(x, y, 0) === 'road'; } catch (e) { return false; }
    };
    for (const e of W.edges || []) {
      if (!e || e.L || !e.pts || e.pts.length < 2) continue;
      const base = (e.hw || '').replace('_link', '');
      if (!CL.has(base)) continue;
      const hash = ((e.pts[0][0] | 0) * 73856093) ^ ((e.pts[0][1] | 0) * 19349663) ^ ((e.pts[e.pts.length - 1][0] | 0) * 83492791);
      const side = (hash & 1) ? 1 : -1, off = (e.w || 24) / 2 + 16;
      let acc = 0, next = 150 + (Math.abs(hash >> 3) % 120), prev = -1;
      for (let k = 0; k + 1 < e.pts.length; k++) {
        const [ax, ay] = e.pts[k], [bx, by] = e.pts[k + 1], L = Math.hypot(bx - ax, by - ay); if (!L) continue;
        const ux = (bx - ax) / L, uy = (by - ay) / L;
        while (acc + L >= next && this.poles.length < 9000) {
          const s = next - acc, x = ax + ux * s - uy * side * off, y = ay + uy * s + ux * side * off;
          next += 300;
          if (bad(x, y)) { prev = -1; continue; }
          const idx = this.poles.length;
          this.poles.push({ x, y, can: (Math.abs(hash >> (k % 9)) % 5) === 0 });
          if (prev >= 0) this.wires.push([prev, idx]);
          prev = idx;
          const key = Math.floor(x / 256) * 100003 + Math.floor(y / 256);
          let l = this.poleGrid.get(key); if (!l) this.poleGrid.set(key, l = []); l.push(idx);
        }
        acc += L;
      }
    }
  }

  // ---------- frame hooks (called by lf_render.js, all before the grade) ----------
  ground(g, view) { if (!this.ok) return; this._bakeStep(1.5); for (const s of this.sites) { if (view && !this._inView(s.cx, s.cy, view, 700)) continue; this._props(g, s); if (s.door) this._crosswalk(g, s); } }
  over(g, gr, time, view, heroArt) {
    if (!this.ok) return; this._bakeStep(2);
    for (const s of this.sites) {
      if (view && !this._inView(s.cx, s.cy, view, 800)) continue;
      this._roofStart(s, heroArt);
      const R = s.roof; if (!R.cv) continue;
      g.save();
      if (R.mode === 'hero') { const F = R.F, S = R.S; g.transform(F.u[0] * S, F.u[1] * S, F.v[0] * S, F.v[1] * S, F.cx, F.cy); g.drawImage(R.cv, R.r[0], R.r[1], R.r[2] - R.r[0], R.r[3] - R.r[1]); }
      else { g.translate(s.cx, s.cy); g.transform(s.t.x, s.t.y, s.n.x, s.n.y, 0, 0); g.drawImage(R.cv, R.r[0], R.r[1], R.r[2] - R.r[0], R.r[3] - R.r[1]); }
      g.restore();
    }
  }
  high(g, gr, time, view) { if (!this.ok) return; this.frames++; this._bakeStep(1); if (!view || view.z < 0.045) return; this._polesDraw(g, view); this._pennants(g, time || 0, view); }
  _inView(x, y, view, m) { return x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m; }

  // ---------- sliced roof bakes ----------
  _roofStart(s, heroArt) {
    const R = s.roof; if (R.started) return;
    if (s.door) { R.started = true; R.mode = 'flat'; R.gen = this._bakeFlat(s); return; }
    if (heroArt && heroArt.data) {
      const sp = heroArt.data.heroes[s.h.b];
      if (sp) { R.started = true; R.mode = 'hero'; R.F = heroArt.frame(s.h); R.S = sp.kind === 'poi' ? (heroArt.data.style.poiScale || 1.12) : (heroArt.data.style.houseScale || 1.35); R.gen = sp.roof && sp.roof.type === 'flat' ? this._bakeFlatHero(s, sp) : this._bakeGableHero(s, sp); return; }
      R.started = true; R.mode = 'flat'; R.gen = this._bakeFlat(s); return;   // data loaded, no spec: placeholder geometry
    }
    if (this.frames > 300) { R.started = true; R.mode = 'flat'; R.gen = this._bakeFlat(s); }   // heroes.json never landed: fall back
  }
  _bakeStep(ms) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (!this._bakeCur) { const s = this.sites.find(x => x.roof.gen); if (!s) return; this._bakeCur = s; }
      const R = this._bakeCur.roof, r = R.gen.next();
      if (r.done) { R.cv = r.value; R.gen = null; this._bakeCur = null; }
    }
  }
  _bakeCanvasUV(u0, v0, u1, v1, px) {
    const cv = document.createElement('canvas'); cv.width = Math.max(2, Math.ceil((u1 - u0) * px)); cv.height = Math.max(2, Math.ceil((v1 - v0) * px));
    const g = cv.getContext('2d'); g.setTransform(px, 0, 0, px, -u0 * px, -v0 * px); g.lineJoin = 'round'; g.lineCap = 'round';
    return [cv, g];
  }

  // ================= FLAT ROOF in the site's own (u,v) frame (Weis, Atholton, Gringada) =================
  // The sample's Weis bake, generalized: tar wash, tonal blobs, grain, patches, water streaks,
  // AC units with fan rings + conduit, vents, a skylight strip on big boxes, a hatch, parapet.
  *_bakeFlat(s) {
    const S = s.S, f = scaled(s.f, S, s.cx, s.cy);
    // footprint in (u,v): project the scaled polygon
    const P = []; for (let k = 0; k < f.length; k += 2) { const dx = f[k] - s.cx, dy = f[k + 1] - s.cy; P.push(dx * s.t.x + dy * s.t.y, dx * s.n.x + dy * s.n.y); }
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let k = 0; k < P.length; k += 2) { u0 = Math.min(u0, P[k]); u1 = Math.max(u1, P[k]); v0 = Math.min(v0, P[k + 1]); v1 = Math.max(v1, P[k + 1]); }
    const pad = 46; u0 -= pad; v0 -= pad; u1 += pad; v1 += pad;
    const maxDim = Math.max(u1 - u0, v1 - v0), PX = Math.max(0.6, Math.min(2, 1800 / maxDim));
    const [cv, g] = this._bakeCanvasUV(u0, v0, u1, v1, PX);
    const R = s.roof; R.r = [u0, v0, u1, v1];
    const rnd = mulberry32(s.seed ^ 0x5eed), area = (u1 - u0) * (v1 - v0);
    const inF = (u, v) => inPoly(u, v, P);
    const path = () => { g.beginPath(); for (let k = 0; k < P.length; k += 2) k ? g.lineTo(P[k], P[k + 1]) : g.moveTo(P[k], P[k + 1]); g.closePath(); };
    g.save(); path(); g.clip();
    // tar wash — cool for retail, warm-grey for the schools' tan placeholder roofs
    g.fillStyle = s.arch === 'school' ? 'rgba(84,76,68,0.34)' : 'rgba(74,78,92,0.40)';
    g.fillRect(u0, v0, u1 - u0, v1 - v0);
    for (let i = 0; i < 12; i++) {
      const x = u0 + rnd() * (u1 - u0), y = v0 + rnd() * (v1 - v0), r = 40 + rnd() * 90, gr2 = g.createRadialGradient(x, y, 3, x, y, r);
      gr2.addColorStop(0, rnd() > 0.45 ? 'rgba(20,20,28,0.13)' : 'rgba(200,205,218,0.07)'); gr2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    yield;
    // tar grain
    const grain = Math.max(150, Math.min(2600, Math.round(area / 110)));
    for (let i = 0; i < grain; i++) {
      const x = u0 + rnd() * (u1 - u0), y = v0 + rnd() * (v1 - v0);
      if (!inF(x, y)) continue;
      g.fillStyle = rnd() > 0.5 ? `rgba(16,16,22,${0.05 + rnd() * 0.08})` : `rgba(215,220,230,${0.04 + rnd() * 0.05})`;
      g.beginPath(); g.arc(x, y, 0.8 + rnd() * 2.2, 0, 7); g.fill();
      if ((i & 255) === 255) yield;
    }
    // patches
    for (let i = 0; i < 6; i++) {
      const x = u0 + 40 + rnd() * (u1 - u0 - 80), y = v0 + 40 + rnd() * (v1 - v0 - 80);
      if (!inF(x, y)) continue;
      const w = 34 + rnd() * 60, d = 26 + rnd() * 44;
      g.fillStyle = `rgba(18,18,26,${0.13 + rnd() * 0.1})`; g.fillRect(x - w / 2, y - d / 2, w, d);
      g.fillStyle = 'rgba(215,222,235,0.10)'; g.fillRect(x - w / 2, y - d / 2, w, 1.8);
    }
    yield;
    // water streaks running toward the front edge (+v)
    for (let i = 0; i < 6; i++) {
      const x = u0 + 30 + rnd() * (u1 - u0 - 60), y = v0 + rnd() * 60, len = 70 + rnd() * 80, w = 6 + rnd() * 8;
      for (let q = 3; q >= 1; q--) { g.strokeStyle = `rgba(22,22,30,${0.05 + (3 - q) * 0.03})`; g.lineWidth = w * q / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
    }
    // AC units with fan rings + conduit runs toward the middle
    const acN = area > 300000 ? 4 : 2, cu = (u0 + u1) / 2, cvv = (v0 + v1) / 2;
    for (let i = 0; i < acN; i++) {
      const x = cu + (rnd() - 0.5) * (u1 - u0) * 0.55, y = cvv + (rnd() - 0.5) * (v1 - v0) * 0.55, w = 34 + rnd() * 12, d = 26 + rnd() * 8;
      if (!inF(x, y)) continue;
      g.fillStyle = 'rgba(13,10,24,0.32)'; g.fillRect(x - w / 2 + SUN.x * 8, y - d / 2 + SUN.y * 8, w, d);
      g.fillStyle = '#83878f'; g.fillRect(x - w / 2, y - d / 2, w, d);
      g.fillStyle = '#91959d'; g.fillRect(x - w / 2 + 3, y - d / 2 + 3, w - 6, d - 6);
      g.fillStyle = 'rgba(28,28,36,0.35)'; g.fillRect(x - w / 2, y + d / 2 - 5, w, 5);
      g.strokeStyle = '#54585f'; g.lineWidth = 1.8;
      g.beginPath(); g.arc(x, y, Math.min(w, d) * 0.30, 0, 7); g.stroke();
      g.beginPath(); g.arc(x, y, Math.min(w, d) * 0.18, 0, 7); g.stroke();
      g.fillStyle = '#54585f'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(52,54,62,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(cu + (x - cu) * 0.4, cvv + (y - cvv) * 0.4); g.stroke();
    }
    yield;
    // vents
    for (let i = 0; i < 3; i++) {
      const x = cu + (rnd() - 0.5) * (u1 - u0) * 0.7, y = cvv + (rnd() - 0.5) * (v1 - v0) * 0.7;
      if (!inF(x, y)) continue;
      g.fillStyle = 'rgba(13,10,24,0.3)'; g.beginPath(); g.ellipse(x + SUN.x * 6, y + SUN.y * 6, 6, 4.6, 0, 0, 7); g.fill();
      g.fillStyle = '#7b7e85'; g.beginPath(); g.arc(x, y, 5.2, 0, 7); g.fill();
      g.fillStyle = '#43464d'; g.beginPath(); g.arc(x, y, 3.1, 0, 7); g.fill();
      g.strokeStyle = 'rgba(232,236,246,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 4.6, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    }
    // skylight strip — big boxes only (the Weis sample's glass holding the dusk)
    if (s.arch === 'bigbox') {
      const x = cu + (u1 - u0) * 0.02, y = v0 + (v1 - v0) * 0.22, w = Math.min(176, (u1 - u0) * 0.5);
      if (inF(x, y)) {
        g.fillStyle = 'rgba(13,10,24,0.28)'; g.fillRect(x - w / 2 + SUN.x * 6, y - 12 + SUN.y * 6, w, 24);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = 'rgba(126,158,190,0.42)'; g.fillRect(x - w / 2 + 2 + i * (w / 3), y - 11, w / 3 - 8, 22);
          g.strokeStyle = '#3e4149'; g.lineWidth = 2; g.strokeRect(x - w / 2 + 2 + i * (w / 3), y - 11, w / 3 - 8, 22);
          g.strokeStyle = 'rgba(222,236,255,0.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - w / 2 + 6 + i * (w / 3), y + 8); g.lineTo(x - w / 2 + 30 + i * (w / 3), y - 8); g.stroke();
        }
      }
    }
    // hatch
    { const x = cu + (u1 - u0) * 0.18, y = v0 + (v1 - v0) * 0.14; if (inF(x, y)) { g.fillStyle = 'rgba(13,10,24,0.3)'; g.fillRect(x - 9 + SUN.x * 6, y - 9 + SUN.y * 6, 18, 18); g.fillStyle = '#6d7076'; g.fillRect(x - 9, y - 9, 18, 18); g.strokeStyle = '#43464d'; g.lineWidth = 1.6; g.strokeRect(x - 9, y - 9, 18, 18); g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.stroke(); } }
    g.restore();
    // parapet: outer ink, inner cap highlight, inner shadow band (scaled copies of the footprint)
    const sc = (k) => { g.beginPath(); for (let i = 0; i < P.length; i += 2) { const x = P[i] * k, y = P[i + 1] * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    sc(1); g.strokeStyle = 'rgba(22,18,32,0.5)'; g.lineWidth = 7; g.stroke();
    sc(0.965); g.strokeStyle = 'rgba(230,234,242,0.20)'; g.lineWidth = 2; g.stroke();
    sc(0.93); g.strokeStyle = 'rgba(24,22,38,0.15)'; g.lineWidth = 9; g.stroke();
    return cv;
  }

  // ================= FLAT ROOF in HeroArt's local frame (Ledo, Reservoir) =================
  *_bakeFlatHero(s, sp) {
    const F = s.roof.F, { hw, hd } = F, P = F.P, k = sp.inset || 0.84;
    const pad = 30, u0 = -hw - pad, v0 = -hd - pad, u1 = hw + pad, v1 = hd + pad;
    const [cv, g] = this._bakeCanvasUV(u0, v0, u1, v1, 2);
    const R = s.roof; R.r = [u0, v0, u1, v1];
    const rnd = mulberry32(s.seed ^ 0xf1a7);
    const path = (kk) => { g.beginPath(); for (let i = 0; i < P.length; i += 2) { const x = P[i] * kk, y = P[i + 1] * kk; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.save(); path(k); g.clip();
    g.fillStyle = 'rgba(70,72,84,0.30)'; g.fillRect(u0, v0, u1 - u0, v1 - v0);
    const grain = 420;
    for (let i = 0; i < grain; i++) {
      const x = (rnd() * 2 - 1) * hw * k, y = (rnd() * 2 - 1) * hd * k;
      g.fillStyle = rnd() > 0.5 ? `rgba(16,16,22,${0.05 + rnd() * 0.07})` : `rgba(215,220,230,${0.04 + rnd() * 0.05})`;
      g.beginPath(); g.arc(x, y, 0.8 + rnd() * 2, 0, 7); g.fill();
      if ((i & 127) === 127) yield;
    }
    for (let i = 0; i < 3; i++) {
      const x = (rnd() * 2 - 1) * hw * k * 0.8, y = (rnd() * 2 - 1) * hd * k * 0.8, w = 26 + rnd() * 34, d = 20 + rnd() * 26;
      g.fillStyle = `rgba(18,18,26,${0.12 + rnd() * 0.09})`; g.fillRect(x - w / 2, y - d / 2, w, d);
      g.fillStyle = 'rgba(215,222,235,0.10)'; g.fillRect(x - w / 2, y - d / 2, w, 1.6);
    }
    yield;
    // streaks toward the front (+y local is the front in HeroArt's frame)
    for (let i = 0; i < 4; i++) {
      const x = (rnd() * 2 - 1) * hw * k * 0.85, y = -hd * k * (0.3 + rnd() * 0.5), len = 40 + rnd() * 50, w = 5 + rnd() * 6;
      for (let q = 3; q >= 1; q--) { g.strokeStyle = `rgba(22,22,30,${0.05 + (3 - q) * 0.03})`; g.lineWidth = w * q / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke(); }
    }
    g.restore();
    path(1); g.strokeStyle = 'rgba(22,18,32,0.4)'; g.lineWidth = 5; g.stroke();
    path(0.96); g.strokeStyle = 'rgba(230,234,242,0.18)'; g.lineWidth = 1.8; g.stroke();
    return cv;
  }

  // ================= GABLE ROOF in HeroArt's local frame (the seven hero homes) =================
  // HeroArt already shades the two slopes + shingle courses; the overlay adds what it lacks:
  // weathering grain, down-slope water streaks, patch rectangles, a vent pipe, ridge wear.
  *_bakeGableHero(s, sp) {
    const F = s.roof.F, { hw, hd } = F, P = F.P, k = sp.inset || 0.84;
    const pad = 26, u0 = -hw - pad, v0 = -hd - pad, u1 = hw + pad, v1 = hd + pad;
    const [cv, g] = this._bakeCanvasUV(u0, v0, u1, v1, 2);
    const R = s.roof; R.r = [u0, v0, u1, v1];
    const rnd = mulberry32(s.seed ^ 0x6ab1);
    const Rr = sp.roof || {}, long = (Rr.ridge === 'short') ? hw > hd : hw <= hd, axis = long ? 'y' : 'x';   // HeroArt's own rule
    const path = (kk) => { g.beginPath(); for (let i = 0; i < P.length; i += 2) { const x = P[i] * kk, y = P[i + 1] * kk; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.save(); path(k); g.clip();
    // grain: shingle grit, darker toward the eaves
    for (let i = 0; i < 520; i++) {
      const x = (rnd() * 2 - 1) * hw * k, y = (rnd() * 2 - 1) * hd * k;
      const eave = axis === 'x' ? Math.abs(y) / (hd * k) : Math.abs(x) / (hw * k);
      g.fillStyle = rnd() > 0.45 ? `rgba(14,12,20,${0.04 + rnd() * 0.06 + eave * 0.05})` : `rgba(228,230,238,${0.03 + rnd() * 0.04})`;
      g.beginPath(); g.arc(x, y, 0.7 + rnd() * 1.7, 0, 7); g.fill();
      if ((i & 127) === 127) yield;
    }
    // down-slope streaks (perpendicular to the ridge)
    for (let i = 0; i < 7; i++) {
      const along = (rnd() * 2 - 1) * 0.82, side = rnd() > 0.5 ? 1 : -1, len = 0.45 + rnd() * 0.4, w = 3.5 + rnd() * 4;
      g.strokeStyle = `rgba(16,14,22,${0.07 + rnd() * 0.05})`; g.lineWidth = w; g.beginPath();
      if (axis === 'x') { const x = along * hw * k; g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 4, side * len * hd * k); }
      else { const y = along * hd * k; g.moveTo(0, y); g.lineTo(side * len * hw * k, y + (rnd() - 0.5) * 4); }
      g.stroke();
    }
    yield;
    // a patched rectangle + a vent pipe
    { const x = (rnd() * 2 - 1) * hw * k * 0.5, y = (rnd() * 2 - 1) * hd * k * 0.5, w = 16 + rnd() * 14, d = 12 + rnd() * 10;
      g.fillStyle = 'rgba(12,12,18,0.16)'; g.fillRect(x - w / 2, y - d / 2, w, d); g.fillStyle = 'rgba(220,224,234,0.10)'; g.fillRect(x - w / 2, y - d / 2, w, 1.4); }
    { const x = hw * k * 0.34, y = -hd * k * 0.3;
      g.fillStyle = 'rgba(13,10,24,0.3)'; g.beginPath(); g.ellipse(x + SUN.x * 4, y + SUN.y * 4, 3.6, 2.8, 0, 0, 7); g.fill();
      g.fillStyle = '#83878f'; g.beginPath(); g.arc(x, y, 3.1, 0, 7); g.fill();
      g.fillStyle = '#4a4d54'; g.beginPath(); g.arc(x, y, 1.7, 0, 7); g.fill(); }
    g.restore();
    // ridge wear: a soft dark line + a lit cap line along the ridge
    g.strokeStyle = 'rgba(18,14,24,0.20)'; g.lineWidth = 3.4; g.beginPath();
    if (axis === 'x') { g.moveTo(-hw * k, 0); g.lineTo(hw * k, 0); } else { g.moveTo(0, -hd * k); g.lineTo(0, hd * k); } g.stroke();
    g.strokeStyle = 'rgba(240,242,248,0.13)'; g.lineWidth = 1.3; g.beginPath();
    if (axis === 'x') { g.moveTo(-hw * k, -1.6); g.lineTo(hw * k, -1.6); } else { g.moveTo(-1.6, -hd * k); g.lineTo(-1.6, hd * k); } g.stroke();
    return cv;
  }

  // ================= PROPS (live in the ground hook: under the cars, over the painted ground) =================
  _props(g, s) {
    const rnd = mulberry32(s.seed ^ 0x9a05);
    const A = Math.atan2(s.t.y, s.t.x);
    const shadow = (w, d, hgt) => { g.fillStyle = 'rgba(13,10,24,0.32)'; g.beginPath(); g.ellipse(SUN.x * hgt, SUN.y * hgt, w * 0.62, d * 0.62, 0, 0, 7); g.fill(); };
    const barrel = (x, y, col) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 5.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(16,14,20,0.55)'; g.lineWidth = 1.1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.arc(x - 1.4, y - 1.4, 3.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(10,10,14,0.35)'; g.beginPath(); g.arc(x + 0.8, y + 0.8, 2.2, 0, 7); g.fill();
    };
    const BARRELS = ['#8a4a30', '#3a5a78', '#6a6e76', '#8a4a30', '#74522e', '#3a5a78'];
    for (const [type, u, v] of s.props) {
      const [x, y] = s.P(u, v);
      if (inPoly(x, y, s.f)) continue;                                   // never inside the building itself
      let surf = null; try { surf = this.W.surfaceAt(x, y, 0); } catch (e) { }
      if (surf === 'road') continue;                                     // never standing in the carriageway
      g.save(); g.translate(x, y); g.rotate(A);
      if (type === 'dumpster') {
        shadow(46, 26, 9);
        g.fillStyle = '#44503c'; g.fillRect(-23, -13, 46, 26);
        g.fillStyle = '#525f47'; g.fillRect(-23, -13, 46, 12);
        g.strokeStyle = 'rgba(14,14,16,0.6)'; g.lineWidth = 1.6; g.strokeRect(-23, -13, 46, 26);
        g.beginPath(); g.moveTo(0, -13); g.lineTo(0, 13); g.stroke();
        g.fillStyle = 'rgba(220,225,210,0.20)'; g.fillRect(-23, -13, 46, 2.4);
      } else if (type === 'barrels') {
        g.fillStyle = 'rgba(13,10,24,0.30)'; g.beginPath(); g.ellipse(SUN.x * 6, SUN.y * 6, 17, 12, 0, 0, 7); g.fill();
        const n = 5 + (rnd() * 2 | 0);
        for (let i = 0; i < n; i++) barrel((i % 3) * 10 - 10 + (i > 2 ? 5 : 0), ((i / 3) | 0) * 10 - 5, BARRELS[(i + (s.seed % 3)) % BARRELS.length]);
      } else if (type === 'bins') {                                       // the kerbside pair at every hero home
        g.fillStyle = 'rgba(13,10,24,0.30)'; g.beginPath(); g.ellipse(SUN.x * 5, SUN.y * 5, 13, 9, 0, 0, 7); g.fill();
        barrel(-6, 0, '#3d4a3a'); barrel(7, 1, '#4a4d55');
      } else if (type === 'pallets') {
        shadow(30, 30, 7);
        for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * 0.16 - 0.16); g.fillStyle = i % 2 ? '#8f7150' : '#9a7c56'; g.fillRect(-13, -13, 26, 26); g.strokeStyle = 'rgba(60,42,24,0.55)'; g.lineWidth = 1.1; for (let q = -8; q <= 8; q += 5.4) { g.beginPath(); g.moveTo(-13, q); g.lineTo(13, q); g.stroke(); } g.restore(); }
      } else if (type === 'crates') {
        shadow(24, 24, 8);
        for (const [ox, oy, sz] of [[-7, -4, 17], [9, 5, 14]]) {
          g.fillStyle = '#7d6242'; g.fillRect(ox - sz / 2, oy - sz / 2, sz, sz);
          g.strokeStyle = 'rgba(46,32,18,0.65)'; g.lineWidth = 1.3; g.strokeRect(ox - sz / 2, oy - sz / 2, sz, sz);
          g.beginPath(); g.moveTo(ox - sz / 2, oy - sz / 2); g.lineTo(ox + sz / 2, oy + sz / 2); g.moveTo(ox + sz / 2, oy - sz / 2); g.lineTo(ox - sz / 2, oy + sz / 2); g.stroke();
        }
      } else if (type === 'tires') {
        g.fillStyle = 'rgba(13,10,24,0.32)'; g.beginPath(); g.ellipse(SUN.x * 5, SUN.y * 5, 10, 8, 0, 0, 7); g.fill();
        for (let i = 0; i < 3; i++) { g.fillStyle = '#17181c'; g.beginPath(); g.arc(0, 0, 7.6 - i * 0.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(210,215,225,0.20)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 7.3 - i * 0.5, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); g.fillStyle = '#0b0b0e'; g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill(); }
      } else if (type === 'cones') {
        g.fillStyle = 'rgba(13,10,24,0.3)'; g.beginPath(); g.ellipse(SUN.x * 3, SUN.y * 3, 4.4, 3.4, 0, 0, 7); g.fill();
        g.fillStyle = '#c65a28'; g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
        g.fillStyle = 'rgba(240,240,235,0.75)'; g.beginPath(); g.arc(0, 0, 1.7, 0, 7); g.fill();
      } else if (type === 'shed') {
        g.fillStyle = 'rgba(13,10,24,0.36)'; g.beginPath(); g.ellipse(SUN.x * 16, SUN.y * 16, 26, 18, 0, 0, 7); g.fill();
        g.fillStyle = '#3a3d44'; g.fillRect(-21, -14, 42, 28);
        g.strokeStyle = 'rgba(12,12,16,0.6)'; g.lineWidth = 1.6; g.strokeRect(-21, -14, 42, 28);
        g.strokeStyle = 'rgba(200,208,220,0.13)'; g.lineWidth = 1; for (let q = -12; q <= 12; q += 6) { g.beginPath(); g.moveTo(-21, q); g.lineTo(21, q); g.stroke(); }
        g.fillStyle = 'rgba(226,230,238,0.20)'; g.fillRect(-21, -14, 42, 2);
      }
      g.restore();
    }
  }
  // zebra crossing + a faded drive arrow in front of a public door (the Weis sample's markings)
  _crosswalk(g, s) {
    const d = s.door, du = (d.x - s.cx) * s.t.x + (d.y - s.cy) * s.t.y;
    const front = s.bE.v1 * s.S + 30, A = Math.atan2(s.t.y, s.t.x);
    for (let i = -2; i <= 2; i++) {
      const [x, y] = s.P(du + i * 30, front);
      let surf = null; try { surf = this.W.surfaceAt(x, y, 0); } catch (e) { }
      if (surf === 'road') continue;
      g.save(); g.translate(x, y); g.rotate(A); g.fillStyle = 'rgba(233,229,214,0.16)'; g.fillRect(-10, -22, 20, 44); g.restore();
    }
    const [ax, ay] = s.P(du - 170, front + 66);
    let surf = null; try { surf = this.W.surfaceAt(ax, ay, 0); } catch (e) { }
    if (surf !== 'road') {
      g.save(); g.translate(ax, ay); g.rotate(A); g.fillStyle = 'rgba(233,229,214,0.13)';
      g.beginPath(); g.moveTo(-30, -5); g.lineTo(8, -5); g.lineTo(8, -13); g.lineTo(34, 0); g.lineTo(8, 13); g.lineTo(8, 5); g.lineTo(-30, 5); g.closePath(); g.fill(); g.restore();
    }
  }

  // ================= POLES + WIRES (live, over the cars) =================
  _polesDraw(g, view) {
    const m = 420, seen = new Set();
    const drawPole = (p) => {
      g.strokeStyle = '#221d2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x - 11, p.y); g.lineTo(p.x + 11, p.y); g.stroke();
      if (p.can) { g.fillStyle = '#33363e'; g.fillRect(p.x - 4, p.y - 13, 11, 15); g.strokeStyle = 'rgba(210,216,226,0.25)'; g.lineWidth = 1; g.strokeRect(p.x - 4, p.y - 13, 11, 15); }
      g.fillStyle = '#2b2434'; g.beginPath(); g.arc(p.x, p.y, 3.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(235,238,245,0.5)'; g.beginPath(); g.arc(p.x - 1, p.y - 1, 1.3, 0, 7); g.fill();
    };
    for (let cy = Math.floor((view.y0 - m) / 256); cy <= Math.floor((view.y1 + m) / 256); cy++)
      for (let cx = Math.floor((view.x0 - m) / 256); cx <= Math.floor((view.x1 + m) / 256); cx++)
        for (const i of this.poleGrid.get(cx * 100003 + cy) || []) seen.add(i);
    // long dusk shadows first
    for (const i of seen) {
      const p = this.poles[i];
      for (let q = 0; q < 3; q++) {
        g.strokeStyle = `rgba(14,11,26,${0.16 - q * 0.045})`; g.lineWidth = 5.5 - q * 1.5;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + SUN.x * (118 - q * 14), p.y + SUN.y * (118 - q * 14)); g.stroke();
      }
    }
    // sagging wire pairs between consecutive poles on the same edge
    for (const [ia, ib] of this.wires) {
      if (!seen.has(ia) || !seen.has(ib)) continue;
      const a = this.poles[ia], b = this.poles[ib];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
      for (const off of [-6, 6]) {
        g.strokeStyle = 'rgba(11,11,20,0.55)'; g.lineWidth = 2; g.beginPath();
        g.moveTo(a.x + px * off, a.y + py * off);
        g.quadraticCurveTo((a.x + b.x) / 2 + px * off, (a.y + b.y) / 2 + L * 0.045 + py * off, b.x + px * off, b.y + py * off);
        g.stroke();
      }
    }
    for (const i of seen) drawPole(this.poles[i]);
  }

  // ================= PENNANTS across the dressed frontages =================
  _pennants(g, time, view) {
    const COLS = ['#cf3a32', '#e9e5da', '#cf3a32', '#e9e5da', '#46689f'];
    for (const s of this.sites) {
      if (!s.pennant || !this._inView(s.cx, s.cy, view, 900)) continue;
      if (!s.strings) {
        const fv = s.bE.v1 * s.S, FL = s.P(s.bE.u0 * s.S, fv), FR = s.P(s.bE.u1 * s.S, fv);
        const nearPole = (pt) => { let bi = -1, bd = 950 * 950; this.poles.forEach((p, i) => { const d = (p.x - pt[0]) ** 2 + (p.y - pt[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi >= 0 ? [this.poles[bi].x, this.poles[bi].y] : null; };
        s.strings = [[FL, FR]];
        const pl = nearPole(FL), pr = nearPole(FR);
        if (pl) s.strings.push([pl, FL]); if (pr) s.strings.push([FR, pr]);
      }
      s.strings.forEach(([a, b], si) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 60) return;
        const sag = len * 0.07 + Math.sin(time * 0.9 + si * 1.7 + s.seed % 7) * 1.6;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + sag;
        const pt = (u) => { const w = 1 - u; return [w * w * a[0] + 2 * w * u * mx + u * u * b[0], w * w * a[1] + 2 * w * u * my + u * u * b[1]]; };
        g.strokeStyle = 'rgba(18,16,24,0.55)'; g.lineWidth = 1.7; g.beginPath();
        for (let q = 0; q <= 20; q++) { const [x, y] = pt(q / 20); q ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        const n = Math.floor(len / 17);
        for (let i = 1; i < n; i++) {
          const u = i / n, [x, y] = pt(u), [x2, y2] = pt(Math.min(1, u + 0.02));
          let hx = -(y2 - y), hy = (x2 - x); const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl; if (hy < 0) { hx = -hx; hy = -hy; }
          const sway = Math.sin(time * 1.5 + i * 0.7 + si * 2.1) * 1.6, ax = x + hx * 11 + hx * sway, ay = y + hy * 11 + hy * sway;
          const tl = Math.hypot(x2 - x, y2 - y) || 1, txv = (x2 - x) / tl, tyv = (y2 - y) / tl;
          g.fillStyle = COLS[(i + si) % COLS.length]; g.globalAlpha = 0.94;
          g.beginPath(); g.moveTo(x - txv * 4.6, y - tyv * 4.6); g.lineTo(x + txv * 4.6, y + tyv * 4.6); g.lineTo(ax, ay); g.closePath(); g.fill();
        }
        g.globalAlpha = 1;
      });
    }
  }
}

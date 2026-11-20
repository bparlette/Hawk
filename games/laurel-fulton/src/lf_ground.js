// lf_ground.js — the painted ground for Laurel/Fulton, streamed in 256-unit chunks (Palm City's size).
// Palm City's language: per-surface base colour + low-frequency noise, two passes of curl-following brush
// dabs seeded per WORLD cell (no chunk seams), then painted details — here drawn from the real graph:
// kerb lips + gutter crease on every non-service edge, lane paint by class (double yellow on two-way
// arterials, white dashes between lanes of one-way carriageways, a dashed centre on two-lane streets),
// lot aisle lines. Roads use the natural-asphalt palette (pc-ext-fable natural-asphalt-v2, owner-approved).
// Only ground-level (layer 0) roads are painted here; bridge decks are drawn live above (lf_render.js).
import { mulberry32, fbm, vnoise } from '../../palm-city/src/world.js';
import { poly } from './lf_areas.js';

export const CHUNK = 256, PX = 2, CPX = CHUNK * PX;
const PAL = {
  road:     { base: [68, 74, 84],    var: [8, 8, 9],     dabs: ['#5b626f', '#666e7d', '#515866', '#737b89', '#49505d', '#7c8492', '#565e6b', '#6d7584'] },
  parking:  { base: [58, 63, 72],    var: [8, 8, 9],     dabs: ['#4e5562', '#454b58', '#616875', '#3d434f', '#6c7380'] },
  sidewalk: { base: [164, 166, 170], var: [10, 10, 10],  dabs: ['#b0b3b8', '#9ea2a8', '#bcc0c6', '#91969d', '#a7abb1'] },
  grass:    { base: [54, 78, 48],    var: [16, 18, 14],  dabs: ['#3e5c36', '#526e44', '#314a2c', '#62784d', '#2b4227', '#5c6f47', '#46613b', '#4d5e3c'] },
};
const TYPES = Object.keys(PAL);
const kind = (s) => s === 'road' ? 'road' : s === 'service' ? 'parking' : s === 'sidewalk' ? 'sidewalk' : 'grass';
// GTA6-look roll-out (Nov 19): the weathered-lot vocabulary from the approved Weis sample,
// generalized to EVERY parking polygon. Seeded per polygon index, so every chunk that paints a
// piece of the lot draws the SAME elements (canvas-clipped) — no seams, no sync cost: this runs
// inside paintGen, which the sliced queue already budgets. Elements: soft grime, tonal patches,
// sealed patch rectangles, random-walk cracks, tar snakes on the big lots, clustered oil stains,
// puddle sheen, worn stall ticks along the long edges, dirt bleed straddling the boundary.
function inPoly2(x, y, f) {
  let inside = false;
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function weatherLot(g, f, idx) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
  const n = f.length / 2;
  for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); cx += f[k]; cy += f[k + 1]; }
  cx /= n; cy /= n;
  const area = (x1 - x0) * (y1 - y0); if (area < 2500) return;               // sheds and pads stay clean
  const rnd = mulberry32((idx * 1013904223) ^ 0x9e37);
  let la = 0, lx = 1, ly = 0;                                                // the lot's long axis (longest edge)
  for (let k = 0; k < f.length; k += 2) { const bx = f[(k + 2) % f.length], by = f[(k + 3) % f.length], L = Math.hypot(bx - f[k], by - f[k + 1]); if (L > la) { la = L; lx = (bx - f[k]) / L; ly = (by - f[k + 1]) / L; } }
  const A = Math.atan2(ly, lx), clampN = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  const sample = () => { for (let t = 0; t < 8; t++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (inPoly2(x, y, f)) return [x, y]; } return null; };
  g.save(); poly(g, f); g.clip();
  for (let i = 0, m = clampN(area / 30000, 3, 22); i < m; i++) {             // soft grime
    const p = sample(); if (!p) continue;
    const r = 90 + rnd() * 200, gr2 = g.createRadialGradient(p[0], p[1], 4, p[0], p[1], r), dark = rnd() > 0.35;
    gr2.addColorStop(0, dark ? 'rgba(10,12,20,0.10)' : 'rgba(150,160,185,0.06)'); gr2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr2; g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fill();
  }
  for (let i = 0, m = clampN(area / 22000, 3, 26); i < m; i++) {             // tonal patches
    const p = sample(); if (!p) continue;
    const rx = 60 + rnd() * 170, ry = rx * (0.5 + rnd() * 0.5);
    g.save(); g.translate(p[0], p[1]); g.rotate(A); g.globalAlpha = 0.06 + rnd() * 0.09;
    g.fillStyle = rnd() > 0.4 ? '#0d0f16' : '#8b95a8'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill(); g.restore();
  }
  g.globalAlpha = 1;
  for (let i = 0, m = clampN(area / 45000, 1, 11); i < m; i++) {             // sealed patch rectangles
    const p = sample(); if (!p) continue;
    const w = 60 + rnd() * 160, d = 40 + rnd() * 90;
    g.save(); g.translate(p[0], p[1]); g.rotate(A);
    g.fillStyle = `rgba(13,15,22,${0.10 + rnd() * 0.12})`; g.fillRect(-w / 2, -d / 2, w, d);
    g.fillStyle = 'rgba(205,215,235,0.10)'; g.fillRect(-w / 2, -d / 2, w, 2.2);
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(-w / 2, d / 2 - 2.2, w, 2.2);
    g.restore();
  }
  g.strokeStyle = 'rgba(9,9,15,0.5)';                                        // cracks: seeded random walks
  for (let i = 0, m = clampN(area / 38000, 2, 13); i < m; i++) {
    const p = sample(); if (!p) continue;
    let [x, y] = p, a = rnd() * Math.PI * 2; g.lineWidth = 1.1 + rnd() * 0.9; g.beginPath(); g.moveTo(x, y);
    const steps = 8 + (rnd() * 14 | 0);
    for (let q = 0; q < steps; q++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 13; y += Math.sin(a) * 13; g.lineTo(x, y); if (rnd() > 0.8) g.moveTo(x, y); }
    g.stroke();
  }
  if (area > 260000) for (let i = 0; i < 2; i++) {                           // tar snakes across the big lots
    const off = (rnd() - 0.5) * (y1 - y0) * 0.5, ph = rnd() * 9, px = -ly, py = lx;
    const sx = cx + px * off, sy = cy + py * off, ext = la * 0.42;
    for (const [col, lw, dy] of [['rgba(11,11,17,0.55)', 5.5, 0], ['rgba(190,200,220,0.10)', 1.4, -2]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      for (let d = -ext; d <= ext; d += 22) { const wob = Math.sin(d * 0.02 + ph) * 9, x = sx + lx * d + px * wob, y = sy + ly * d + py * wob + dy; d === -ext ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
  }
  for (let c = 0, nc = clampN(area / 160000, 1, 4); c < nc; c++) {          // oil stains, clustered where cars sit
    const p = sample(); if (!p) continue;
    for (let i = 0, m = 3 + (rnd() * 3 | 0); i < m; i++) {
      const ox = p[0] + (rnd() - 0.5) * 130, oy = p[1] + (rnd() - 0.5) * 80;
      if (!inPoly2(ox, oy, f)) continue;
      for (let q = 0; q < 3; q++) {
        const gx = ox + (rnd() - 0.5) * 22, gy = oy + (rnd() - 0.5) * 13, r = 5 + rnd() * 11;
        const gr2 = g.createRadialGradient(gx, gy, 1, gx, gy, r);
        gr2.addColorStop(0, 'rgba(6,6,11,0.21)'); gr2.addColorStop(1, 'rgba(6,6,11,0)');
        g.fillStyle = gr2; g.beginPath(); g.arc(gx, gy, r, 0, 7); g.fill();
      }
    }
  }
  for (let i = 0, m = area > 120000 ? 3 : 1; i < m; i++) {                   // puddle sheen holding the sky
    const p = sample(); if (!p) continue;
    const rx = 26 + rnd() * 30, ry = rx * 0.42;
    g.save(); g.translate(p[0], p[1]); g.rotate(A);
    g.fillStyle = 'rgba(158,182,224,0.10)'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(205,225,250,0.14)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
    g.restore();
  }
  // worn stall ticks along every long edge, pointing inward, broken into fading segments
  g.lineWidth = 2.6;
  for (let k = 0; k < f.length; k += 2) {
    const ax = f[k], ay = f[k + 1], bx = f[(k + 2) % f.length], by = f[(k + 3) % f.length], L = Math.hypot(bx - ax, by - ay);
    if (L < 120) continue;
    const ux = (bx - ax) / L, uy = (by - ay) / L;
    let nx = -uy, ny = ux; if ((cx - ax) * nx + (cy - ay) * ny < 0) { nx = -nx; ny = -ny; }   // inward = toward the lot's heart
    g.strokeStyle = 'rgba(233,229,214,0.11)'; g.lineWidth = 2.2; g.beginPath();
    g.moveTo(ax + ux * 14 + nx * 46, ay + uy * 14 + ny * 46); g.lineTo(bx - ux * 14 + nx * 46, by - uy * 14 + ny * 46); g.stroke();
    g.lineWidth = 2.6;
    for (let d = 20; d < L - 10; d += 27) {
      const px = ax + ux * d, py = ay + uy * d;
      for (let q = 0; q < 3; q++) {
        if (rnd() > 0.86) continue;
        const a0 = q / 3, a1 = (q + 0.82) / 3;
        g.strokeStyle = `rgba(233,229,214,${0.09 + rnd() * 0.24})`;
        g.beginPath(); g.moveTo(px + nx * 46 * a0, py + ny * 46 * a0); g.lineTo(px + nx * 46 * a1, py + ny * 46 * a1); g.stroke();
      }
    }
  }
  g.restore();
  for (let k = 0; k < f.length; k += 2) {                                    // dirt bleed straddling the boundary
    const ax = f[k], ay = f[k + 1], bx = f[(k + 2) % f.length], by = f[(k + 3) % f.length], L = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d < L; d += 15) {
      const x = ax + (bx - ax) * d / L, y = ay + (by - ay) * d / L;
      const ox = x - cx, oy = y - cy, ol = Math.hypot(ox, oy) || 1, off = 3 + rnd() * 13;
      const dx = x + ox / ol * off, dy = y + oy / ol * off, r = 7 + rnd() * 15;
      g.fillStyle = rnd() > 0.3 ? `rgba(122,98,62,${0.07 + rnd() * 0.11})` : `rgba(70,58,40,${0.10 + rnd() * 0.08})`;
      g.beginPath(); g.ellipse(dx, dy, r, r * 0.62, rnd() * 3, 0, 7); g.fill();
    }
  }
}
function curlAngle(wx, wy, sc, seed, base) {
  const e = 1.2, n1 = vnoise(wx * sc, (wy + e) * sc, seed), n2 = vnoise(wx * sc, (wy - e) * sc, seed);
  const n3 = vnoise((wx + e) * sc, wy * sc, seed), n4 = vnoise((wx - e) * sc, wy * sc, seed);
  return base * 0.45 + Math.atan2(-(n3 - n4), n1 - n2) * 0.55;
}

export class GroundPainter {
  constructor(W, cap = 64, areas = null, bumps = []) { this.bumps = bumps; this.areas = areas; this.W = W; this.cache = new Map(); this.cap = cap; this.queue = []; this.job = null; this.pave = null; this.painted = null; this._ptCv = null; this._ptMask = null; this.stats = { sync: 0, sliced: 0, evicted: 0 }; }
  key(cx, cy) { return cx + ',' + cy; }
  has(cx, cy) { return this.cache.has(this.key(cx, cy)); }
  trim() { while (this.cache.size > this.cap) { const k = this.cache.keys().next().value; if (this.job && this.job.k === k) break; this.cache.delete(k); this.stats.evicted++; } }
  // PAINTED GROUND (owner, Nov 17-18): the satellite painting (assets/ground-painted.webp),
  // pre-tiled by tools/tile_ground.py into 4096-unit tiles (16x16 chunks) with a MEASURED
  // world->painting fit (tools/fit_painted.py; landmark residuals <= 1.5 px). Tiles stream in
  // lazily: a chunk's tile starts loading when the chunk is requested/got (main.js caps both
  // lists, so the far-zoom whole-map opening can never queue the world — the Nov 17 freeze
  // rule), and when a tile lands the chunks it covers repaint through the normal sliced
  // queue, never synchronously. In paintGen the painting lands ONLY on 'ground' cells (pass
  // 1's type grid is the mask): roads/sidewalks/parking keep the full procedural treatment,
  // so the game's roads sit exactly on the graph with no ghosting — and the KOTH disc, which
  // surfaceAt reports as 'road', is never painted over (see the setPave interplay below).
  setPainted(man) { this.painted = man ? { man, tiles: new Map() } : null; }
  _tileOf(cx, cy) { const t = this.painted.man.tileWorld / CHUNK; return [Math.floor(cx / t), Math.floor(cy / t)]; }
  paintedState(cx, cy) {                        // harness/diagnostics: 'ok' | 'loading' | 'err' | 'none' | 'idle' | null
    if (!this.painted) return null;
    const [tx, ty] = this._tileOf(cx, cy), t = this.painted.tiles.get(tx + ',' + ty);
    return t ? t.state : 'idle';
  }
  _paintedAt(wx, wy) {                          // is the painting under this world point, loaded?
    if (!this.painted) return false;
    const tw = this.painted.man.tileWorld, t = this.painted.tiles.get(Math.floor(wx / tw) + ',' + Math.floor(wy / tw));
    return !!t && t.state === 'ok';
  }
  _ensureTile(cx, cy) {
    const P = this.painted; if (!P) return;
    const [tx, ty] = this._tileOf(cx, cy), k = tx + ',' + ty;
    if (P.tiles.has(k)) return;
    const rec = P.man.tiles[k];
    if (!rec) { P.tiles.set(k, { state: 'none' }); return; }
    const t = { state: 'loading', img: null }; P.tiles.set(k, t);
    const img = new Image();
    img.onload = () => { t.state = 'ok'; t.img = img; this._tileLanded(tx, ty); };
    img.onerror = () => { t.state = 'err' };
    img.src = 'assets/ground-tiles/' + rec.f;
  }
  _tileLanded(tx, ty) {                         // repaint the tile's cached chunks, sliced as usual
    const n = this.painted.man.tileWorld / CHUNK;
    for (let cy = ty * n; cy < ty * n + n; cy++) for (let cx = tx * n; cx < tx * n + n; cx++) {
      const k = this.key(cx, cy);
      if (this.job && this.job.k === k) this.job = null;        // a half-painted chunk without the painting must not land
      if (this.cache.delete(k) && !this.queue.some(([qx, qy]) => qx === cx && qy === cy)) this.queue.push([cx, cy]);
    }
  }
  get(cx, cy) {
    this._ensureTile(cx, cy);
    const k = this.key(cx, cy), c = this.cache.get(k);
    if (c) { this.cache.delete(k); this.cache.set(k, c); return c; }
    let gen = this.job && this.job.k === k ? this.job.gen : this.paintGen(cx, cy); if (this.job && this.job.k === k) this.job = null;
    let r = gen.next(); while (!r.done) r = gen.next();
    this.cache.set(k, r.value); this.stats.sync++; this.trim(); return r.value;
  }
  request(list) { if (this.painted) for (const [cx, cy] of list) this._ensureTile(cx, cy); this.queue = list.filter(([cx, cy]) => !this.has(cx, cy)); }
  // KOTH circle road (owner, Nov 17): declare the candidate/active cul-de-sac's disc paved — or
  // clear it with null when no sac is in play. Syncs W.pave (the surfaceAt override the painter,
  // the sim's drag and the skid layer all read) and drops the cached chunks the old/new disc
  // touches, so they repaint through the normal request/work queue — sliced, never synchronously,
  // so the whole-map opening and the far-zoom pulse can't be stalled by it. No-op when unchanged,
  // so main.js may call it every frame; the repaint fires only on a real state change.
  setPave(disc) {
    const o = this.pave;
    if ((!o && !disc) || (o && disc && o.x === disc.x && o.y === disc.y && o.r === disc.r)) return;
    this.pave = disc ? { x: disc.x, y: disc.y, r: disc.r } : null;
    this.W.pave = this.pave;
    for (const d of [o, this.pave]) {
      if (!d) continue;
      const m = 10;   // the kerb ring (pass 3) strokes a few units past the disc's rim
      const cx0 = Math.floor((d.x - d.r - m) / CHUNK), cx1 = Math.floor((d.x + d.r + m) / CHUNK);
      const cy0 = Math.floor((d.y - d.r - m) / CHUNK), cy1 = Math.floor((d.y + d.r + m) / CHUNK);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const nx = Math.max(cx * CHUNK, Math.min(d.x, cx * CHUNK + CHUNK)), ny = Math.max(cy * CHUNK, Math.min(d.y, cy * CHUNK + CHUNK));
        if (Math.hypot(nx - d.x, ny - d.y) > d.r + m) continue;   // this chunk's rect never touches the disc
        const k = this.key(cx, cy);
        this.cache.delete(k);
        if (this.job && this.job.k === k) this.job = null;        // a half-painted chunk of the old surface must not land
        if (!this.queue.some(([qx, qy]) => qx === cx && qy === cy)) this.queue.push([cx, cy]);
      }
    }
  }
  work(ms) {
    const t0 = performance.now(); let qi = 0;
    while (performance.now() - t0 < ms) {
      if (!this.job) { while (qi < this.queue.length && this.has(...this.queue[qi])) qi++; if (qi >= this.queue.length) return; const [cx, cy] = this.queue[qi++]; this.job = { k: this.key(cx, cy), gen: this.paintGen(cx, cy) }; }
      const r = this.job.gen.next(); if (r.done) { this.cache.set(this.job.k, r.value); this.job = null; this.stats.sliced++; this.trim(); }
    }
  }

  *paintGen(cx, cy) {
    const W = this.W, ox = cx * CHUNK, oy = cy * CHUNK;
    const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(CPX, CPX) : Object.assign(document.createElement('canvas'), { width: CPX, height: CPX });
    const g = cv.getContext('2d');
    // pass 1: base colour on a 4 px grid, smoothed up
    const S = 4, gw = CPX / S + 1, small = Object.assign(document.createElement('canvas'), { width: gw, height: gw });
    const sg = small.getContext('2d'), img = sg.createImageData(gw, gw), d = img.data, tg = new Uint8Array(gw * gw);
    for (let j = 0; j < gw; j++) {
      if ((j & 15) === 15) yield;
      for (let i = 0; i < gw; i++) {
        const wx = ox + i * S / PX, wy = oy + j * S / PX, t = kind(W.surfaceAt(wx, wy, 0)), p = PAL[t];
        tg[j * gw + i] = TYPES.indexOf(t);
        const n1 = fbm(wx * 0.015, wy * 0.015, 1, 3) - 0.5, n2 = vnoise(wx * 0.09, wy * 0.09, 2) - 0.5, warm = fbm(wx * 0.005, wy * 0.005, 5, 2) - 0.5, o = (j * gw + i) * 4;
        d[o] = p.base[0] + p.var[0] * (n1 * 2.2 + n2) + warm * 30; d[o + 1] = p.base[1] + p.var[1] * (n1 * 2.2 + n2) + warm * 10; d[o + 2] = p.base[2] + p.var[2] * (n1 * 2.2 + n2) - warm * 14; d[o + 3] = 255;
      }
    }
    sg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, gw, gw, 0, 0, CPX + S, CPX + S);
    // pass 1b: the painted satellite underlay, on 'ground' cells only — the type grid just
    // built doubles as the mask (soft-edged by the same smoothing that blends the base), so
    // the painting brings the land cover (lawns, woods, fields, ponds) while every road,
    // sidewalk and lot keeps its procedural base and the detail passes on top. NO yield in
    // this block: the scratch canvases are shared with the sync get() path, which can run
    // while this generator is parked at a yield.
    const PT = this.painted, ptile = PT ? PT.tiles.get(this._tileOf(cx, cy).join(',')) : null;
    if (ptile && ptile.state === 'ok') {
      const man = PT.man, rec = man.tiles[this._tileOf(cx, cy).join(',')], M = man.map;
      const tc = this._ptCv || (this._ptCv = Object.assign(document.createElement('canvas'), { width: CPX, height: CPX }));
      const tg2 = tc.getContext('2d');
      tg2.globalCompositeOperation = 'source-over'; tg2.globalAlpha = 1; tg2.imageSmoothingEnabled = true;
      tg2.clearRect(0, 0, CPX, CPX);
      tg2.drawImage(ptile.img, M.ax * ox + M.bx - rec.px[0], M.ay * oy + M.by - rec.px[1], M.ax * CHUNK, M.ay * CHUNK, 0, 0, CPX, CPX);
      const mk = this._ptMask || (this._ptMask = Object.assign(document.createElement('canvas'), { width: gw, height: gw }));
      const mg = mk.getContext('2d'), mid = mg.createImageData(gw, gw), md = mid.data, GI = TYPES.indexOf('grass');
      for (let j = 0; j < gw; j++) for (let i = 0; i < gw; i++) {
        const n = j * gw + i;
        if (tg[n] !== GI) { md[n * 4 + 3] = 0; continue; }
        const edge = (i > 0 && tg[n - 1] !== GI) || (i + 1 < gw && tg[n + 1] !== GI) || (j > 0 && tg[n - gw] !== GI) || (j + 1 < gw && tg[n + gw] !== GI);
        md[n * 4 + 3] = edge ? 145 : 255;            // feather verge borders seamlessly
      }
      mg.putImageData(mid, 0, 0);
      tg2.globalCompositeOperation = 'source-atop';
      tg2.fillStyle = 'rgba(185, 205, 232, 0.06)';     // subtle cool-slate atmospheric tie-in across satellite tiles
      tg2.fillRect(0, 0, CPX, CPX);
      tg2.globalCompositeOperation = 'destination-in';
      tg2.drawImage(mk, 0, 0, gw, gw, 0, 0, CPX + S, CPX + S);
      g.globalAlpha = 0.92; g.drawImage(tc, 0, 0); g.globalAlpha = 1;
      cv._pt = 1;                                 // stamp: this chunk's canvas carries the painting (harness waits on it)
    }
    yield;
    // pass 2: fine surface texture dabs, seeded per 32-unit world cell (seamless across chunks; trimmed for speed + crispness)
    g.lineCap = 'round';
    const CELL = 32;
    for (let pass = 0; pass < 2; pass++) {
      const count = pass ? 42 : 24, sx = pass ? 0x9e3779b9 : 0x5bd1e995;
      for (let ky = Math.floor(oy / CELL) - 1; ky <= Math.floor((oy + CHUNK) / CELL) + 1; ky++) {
        yield;
        for (let kx = Math.floor(ox / CELL) - 1; kx <= Math.floor((ox + CHUNK) / CELL) + 1; kx++) {
          const cr = mulberry32((kx * 73856093) ^ (ky * 19349663) ^ sx);
          for (let n = 0; n < count; n++) {
            const wx = (kx + cr()) * CELL, wy = (ky + cr()) * CELL, r1 = cr(), r2 = cr(), r3 = cr(), r4 = cr(), r5 = cr(), r6 = cr();
            const px = (wx - ox) * PX, py = (wy - oy) * PX;
            if (px < -30 || py < -30 || px > CPX + 30 || py > CPX + 30) continue;
            const sf = W.surfaceAt(wx, wy, 0), t = kind(sf), p = PAL[t];
            const paintedGrass = t === 'grass' && this._paintedAt(wx, wy);
            if (paintedGrass && r1 > 0.16) continue;   // let crisp satellite aerial detail dominate lawns/woods
            let ang, len, wid, al;
            if (t === 'road' || t === 'parking') { const r = W.roadInfo(wx, wy, 0), ra = Math.atan2(r.dy, r.dx); ang = curlAngle(wx, wy, 0.015, 11, ra) * 0.25 + ra * 0.75 + (r1 - 0.5) * 0.25; len = (pass ? 10 : 18) + r2 * 12; wid = (pass ? 4.5 : 8) + r3 * 3.5; al = (pass ? 0.34 : 0.26) + r4 * 0.2; }
            else if (t === 'grass') { ang = curlAngle(wx, wy, 0.026, 31, fbm(wx * 0.015, wy * 0.015, 4, 2) * Math.PI * 3); len = 9 + r2 * 9; wid = (pass ? 4.5 : 7.5) + r3 * 3.5; al = (0.38 + r4 * 0.28) * (paintedGrass ? 0.38 : 1); }
            else { ang = curlAngle(wx, wy, 0.018, 19, 0) + (r1 - 0.5) * 0.3; len = (pass ? 9 : 15) + r2 * 9; wid = (pass ? 4.5 : 7.5) + r3 * 3.5; al = 0.24 + r4 * 0.22; }
            const cxs = Math.cos(ang) * len / 2, sys = Math.sin(ang) * len / 2, bend = (r6 - 0.5) * 0.3;
            g.strokeStyle = p.dabs[(r5 * p.dabs.length) | 0]; g.globalAlpha = al; g.lineWidth = wid;
            g.beginPath(); g.moveTo(px - cxs, py - sys); g.quadraticCurveTo(px - sys * bend, py + cxs * bend, px + cxs, py + sys); g.stroke();
          }
        }
      }
    }
    g.globalAlpha = 1;
    yield;
    // pass 3: details from the real edges in and around this chunk
    g.save(); g.scale(PX, PX); g.translate(-ox, -oy);
    const AR = this.areas;
    if (AR) {                                             // background tier: realistic weathered roofs, crisp cast shadows, parking lot wear
      const r = mulberry32(cx * 7919 + cy * 104729 + 5);
      for (const i of AR.inChunk('green', cx, cy)) { g.globalAlpha = 0.16; g.fillStyle = '#254224'; poly(g, AR.A.green[i]); g.fill(); }
      for (const i of AR.inChunk('parking', cx, cy)) {
        const pf = AR.A.parking[i];
        g.globalAlpha = 0.90; g.fillStyle = '#404652'; poly(g, pf); g.fill();
        // weathered concrete rim + subtle oil/tire wear stains inside the lot
        g.save(); poly(g, pf); g.clip();
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let k = 0; k < pf.length; k += 2) { if (pf[k] < x0) x0 = pf[k]; if (pf[k] > x1) x1 = pf[k]; if (pf[k + 1] < y0) y0 = pf[k + 1]; if (pf[k + 1] > y1) y1 = pf[k + 1]; }
        const pr = mulberry32(i * 6151 + 17);
        g.fillStyle = '#2d323c';
        for (let s = 0; s < 5; s++) {
          g.globalAlpha = 0.14 + pr() * 0.12;
          g.beginPath(); g.ellipse(x0 + pr() * (x1 - x0), y0 + pr() * (y1 - y0), 10 + pr() * 22, 6 + pr() * 14, pr() * 3.14, 0, Math.PI * 2); g.fill();
        }
        // faded parking stall lines
        if (x1 - x0 > 45 && y1 - y0 > 45) {
          g.globalAlpha = 0.24; g.strokeStyle = '#dce2ea'; g.lineWidth = 1.1; g.beginPath();
          const horiz = (x1 - x0) >= (y1 - y0);
          if (horiz) {
            for (let x = x0 + 18; x < x1 - 14; x += 22) { g.moveTo(x, y0 + 6); g.lineTo(x, y0 + 28); g.moveTo(x, y1 - 6); g.lineTo(x, y1 - 28); }
          } else {
            for (let y = y0 + 18; y < y1 - 14; y += 22) { g.moveTo(x0 + 6, y); g.lineTo(x0 + 28, y); g.moveTo(x1 - 6, y); g.lineTo(x1 - 28, y); }
          }
          g.stroke();
        }
        g.restore();
        g.globalAlpha = 0.42; g.strokeStyle = '#b4bac2'; g.lineWidth = 1.4; poly(g, pf); g.stroke();
      }
      yield;
      g.globalAlpha = 1;
      for (const i of AR.inChunk('parking', cx, cy)) { weatherLot(g, AR.A.parking[i], i); yield; }   // GTA6-look: every lot weathered (see weatherLot above)
      // realistic architectural roof palette (weathered slate, tar-membrane, charcoal shingle, muted cedar/metal)
      const ROOFS = ['#575e69', '#4a505a', '#636a75', '#6b5950', '#505660', '#73504a', '#5e6773'];
      for (const i of AR.inChunk('buildings', cx, cy)) {
        if (AR.heroSet.has(i)) continue;                  // heroes are drawn live, bigger and crisp (lf_render.js)
        const f = AR.A.buildings[i];
        // deep directional cast shadow + tight contact AO
        g.globalAlpha = 0.42; g.fillStyle = '#0e131e'; g.save(); g.translate(10, -5); poly(g, f); g.fill(); g.restore();
        g.globalAlpha = 0.32; g.lineWidth = 3.2; g.strokeStyle = '#0c1018'; poly(g, f); g.stroke();
        // weathered roof base
        g.globalAlpha = 0.94; g.fillStyle = ROOFS[i % ROOFS.length]; poly(g, f); g.fill();
        // subtle roof membrane seams / shingle texture + parapet coping + rooftop vent on larger roofs
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let k = 0; k < f.length; k += 2) { if (f[k] < x0) x0 = f[k]; if (f[k] > x1) x1 = f[k]; if (f[k + 1] < y0) y0 = f[k + 1]; if (f[k + 1] > y1) y1 = f[k + 1]; }
        const bw = x1 - x0, bh = y1 - y0, mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
        g.save(); poly(g, f); g.clip();
        g.globalAlpha = 0.16; g.strokeStyle = '#1d222c'; g.lineWidth = 0.9; g.beginPath();
        if (bw >= bh) { for (let x = x0 + 9; x < x1; x += 11) { g.moveTo(x, y0); g.lineTo(x, y1); } }
        else { for (let y = y0 + 9; y < y1; y += 11) { g.moveTo(x0, y); g.lineTo(x1, y); } }
        g.stroke();
        // ridge or sunlit half-slope tint
        g.globalAlpha = 0.14; g.fillStyle = '#d8e2f0';
        if (bw >= bh) g.fillRect(x0, y0, bw, bh * 0.5); else g.fillRect(x0, y0, bw * 0.5, bh);
        // rooftop HVAC / turbine vent on commercial / larger buildings
        if (bw > 48 && bh > 40) {
          g.globalAlpha = 0.55; g.fillStyle = '#252a34'; g.fillRect(mx - 6, my - 5, 13, 11);
          g.globalAlpha = 0.85; g.fillStyle = '#8b939e'; g.fillRect(mx - 7, my - 6, 11, 9);
          g.globalAlpha = 0.65; g.fillStyle = '#bcc4ce'; g.beginPath(); g.arc(mx - 1.5, my - 1.5, 3, 0, Math.PI * 2); g.fill();
        }
        g.restore();
        // crisp parapet / eave coping highlight
        g.globalAlpha = 0.45; g.strokeStyle = '#c4cbd4'; g.lineWidth = 1.2; poly(g, f); g.stroke();
      }
      g.globalAlpha = 1;
      yield;
    }
    const near = new Set(), grid = W.grid[0];
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) for (const si of grid.get(i * 100003 + j) || []) near.add(W.seg[si].e);
    const inC = (x, y, m = 40) => x > ox - m && x < ox + CHUNK + m && y > oy - m && y < oy + CHUNK + m;
    const walk = (e, fn, step = 2.5) => { for (let k = 0; k + 1 < e.pts.length; k++) { const [ax, ay] = e.pts[k], [bx, by] = e.pts[k + 1], L = Math.hypot(bx - ax, by - ay); if (!L) continue; const ux = (bx - ax) / L, uy = (by - ay) / L; for (let s = 0; s <= L; s += step) { const x = ax + ux * s, y = ay + uy * s; if (inC(x, y)) fn(x, y, ux, uy, s); } } };
    for (const e of near) {
      if (e.L !== 0) continue;
      const hw = e.w / 2, base = e.hw.replace('_link', '');
      // subtle dark tire-wear wheel ruts along lanes (photorealistic asphalt patina)
      if (base !== 'service' && hw >= 14) {
        g.globalAlpha = 0.14; g.strokeStyle = '#1e232c'; g.lineWidth = 4.2;
        for (const sd of [-1, 1]) {
          const off = sd * hw * 0.48;
          g.beginPath();
          for (let k = 0; k < e.pts.length; k++) {
            const p = e.pts[k], q = e.pts[Math.min(e.pts.length - 1, k + 1)], o = e.pts[Math.max(0, k - 1)];
            let dx = q[0] - o[0], dy = q[1] - o[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const rx = p[0] - dy * off, ry = p[1] + dx * off;
            k ? g.lineTo(rx, ry) : g.moveTo(rx, ry);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      if (base !== 'service') walk(e, (x, y, ux, uy) => {               // kerb: weathered concrete lip + deep gutter AO crease
        for (const sd of [-1, 1]) {
          const nx = -uy * sd, ny = ux * sd, ex = x + nx * hw, ey = y + ny * hw;
          const r = W.roadInfo(ex + nx * 3, ey + ny * 3, 0); if (r.d < r.hw - 1) continue;
          g.globalAlpha = 0.72; g.fillStyle = '#bfc5cc'; g.fillRect(ex + nx * 1.3 - 1.5, ey + ny * 1.3 - 1.5, 3.0, 3.0);
          g.globalAlpha = 0.50; g.fillStyle = '#161b28'; g.fillRect(ex - nx * 1.8 - 1.5, ey - ny * 1.8 - 1.5, 3.0, 3.0);
        }
      });
      yield;
      if (base === 'service') walk(e, (x, y, ux, uy) => {               // GTA6-look: tired service pavement — sparse sealed patches, hashed per world cell so chunks agree at the seams
        const hr = mulberry32(((x / 55) | 0) * 73856093 ^ ((y / 55) | 0) * 19349663 ^ 0x5eed);
        if (hr() > 0.16) return;
        const w2 = 16 + hr() * 30, d2 = 10 + hr() * 18;
        g.save(); g.translate(x, y); g.rotate(Math.atan2(uy, ux)); g.globalAlpha = 0.10 + hr() * 0.10; g.fillStyle = '#0d0f16'; g.fillRect(-w2 / 2, -d2 / 2, w2, d2); g.restore(); g.globalAlpha = 1;
      }, 55);
      const twoWayArterial = !e.oneway && ['primary', 'secondary', 'trunk', 'tertiary'].includes(base);
      if (twoWayArterial) walk(e, (x, y, ux, uy) => {                   // weathered double yellow centre line
        for (const o of [-1.6, 1.6]) { g.globalAlpha = 0.72; g.fillStyle = '#e5be4c'; g.fillRect(x - uy * o - 1.0, y + ux * o - 1.0, 2.0, 2.0); }
      }, 2);
      else if (base !== 'service' && !e.oneway && base !== 'motorway') walk(e, (x, y, ux, uy, s) => {   // dashed centre on two-lane streets
        if (s % 40 < 16 && W.roadInfo(x - uy * (hw + 6), y + ux * (hw + 6), 0).d > hw - 2) { g.globalAlpha = 0.52; g.fillStyle = '#e4e8ee'; g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2); }
      }, 2);
      if (e.oneway && e.lanes > 1) walk(e, (x, y, ux, uy, s) => {       // lane dashes on one-way carriageways (US-29, ramps)
        if (s % 60 >= 24) return;
        for (let l = 1; l < e.lanes; l++) { const o = -hw + l * (e.w / e.lanes); g.globalAlpha = 0.58; g.fillStyle = '#e6eaf0'; g.fillRect(x - uy * o - 1.0, y + ux * o - 1.0, 2.0, 2.0); }
      }, 2);
      if (e.oneway && base !== 'service') walk(e, (x, y, ux, uy) => {   // white edge lines on divided highways
        for (const sd of [-1, 1]) { const o = sd * (hw - 4); g.globalAlpha = 0.45; g.fillStyle = '#dde2ea'; g.fillRect(x - uy * o - 0.9, y + ux * o - 0.9, 1.8, 1.8); }
      }, 3);
      // roadside utility poles + subtle overhead wire along arterials (iconic overhead drone detail)
      if (['primary', 'secondary', 'tertiary'].includes(base) && e.len > 140) {
        const poleOff = hw + 8;
        g.globalAlpha = 0.28; g.strokeStyle = '#111620'; g.lineWidth = 0.7; g.beginPath();
        for (let k = 0; k < e.pts.length; k++) {
          const p = e.pts[k], q = e.pts[Math.min(e.pts.length - 1, k + 1)], o = e.pts[Math.max(0, k - 1)];
          let dx = q[0] - o[0], dy = q[1] - o[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
          const px2 = p[0] - dy * poleOff, py2 = p[1] + dx * poleOff;
          k ? g.lineTo(px2, py2) : g.moveTo(px2, py2);
        }
        g.stroke();
        walk(e, (x, y, ux, uy, s) => {
          if (Math.abs((s % 190) - 40) > 2) return;
          const px2 = x - uy * poleOff, py2 = y + ux * poleOff;
          g.globalAlpha = 0.36; g.strokeStyle = '#0e131d'; g.lineWidth = 2.0;
          g.beginPath(); g.moveTo(px2, py2); g.lineTo(px2 + 16, py2 - 6); g.stroke();
          g.globalAlpha = 0.9; g.fillStyle = '#cfd5dc'; g.beginPath(); g.arc(px2, py2, 2.3, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 0.6; g.strokeStyle = '#303642'; g.lineWidth = 0.8; g.stroke();
        }, 4);
        g.globalAlpha = 1;
      }
      yield;
    }
    // task L3: speed bumps — a raised asphalt hump across the carriageway with worn yellow chevrons
    for (const b of this.bumps) {
      if (b.x < ox - 60 || b.x > ox + CHUNK + 60 || b.y < oy - 60 || b.y > oy + CHUNK + 60) continue;
      g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.dy, b.dx));
      const hw = b.w / 2 - 2;
      g.globalAlpha = 0.5; g.fillStyle = '#1e1a2c'; g.fillRect(2, -hw, 6, hw * 2);                 // the far side's shade
      g.globalAlpha = 1; g.fillStyle = '#6a7284'; g.fillRect(-6, -hw, 12, hw * 2);                 // the hump
      g.fillStyle = '#8c93a2'; g.fillRect(-6, -hw, 3, hw * 2);                                     // its lit leading edge
      g.fillStyle = '#f0c63e';
      for (let k = -1; k <= 1; k++) {                                                              // three worn chevrons
        const cy = k * hw * 0.6; g.globalAlpha = 0.85 - Math.abs(k) * 0.12;
        g.beginPath(); g.moveTo(-5, cy - 7); g.lineTo(3, cy); g.lineTo(-5, cy + 7); g.lineTo(-2, cy + 7); g.lineTo(6, cy); g.lineTo(-2, cy - 7); g.closePath(); g.fill();
      }
      g.restore();
    }
    // KOTH circle road: the paved disc's rim gets the road kerb treatment — a lit lip just
    // outside, a dark gutter crease just inside. (Passes 1-2 already painted the disc itself as
    // road: they sample W.surfaceAt, which honours W.pave.)
    const PV = this.pave;
    if (PV) {
      const nx = Math.max(ox, Math.min(PV.x, ox + CHUNK)), ny = Math.max(oy, Math.min(PV.y, oy + CHUNK));
      if (Math.hypot(nx - PV.x, ny - PV.y) < PV.r + 8) {
        g.globalAlpha = 0.7; g.strokeStyle = '#f0dcbc'; g.lineWidth = 3.2;
        g.beginPath(); g.arc(PV.x, PV.y, PV.r + 1.3, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.42; g.strokeStyle = '#201a42'; g.lineWidth = 3;
        g.beginPath(); g.arc(PV.x, PV.y, PV.r - 1.8, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      }
    }
    g.restore(); g.globalAlpha = 1;
    return cv;
  }
}

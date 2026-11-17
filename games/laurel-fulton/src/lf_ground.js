// lf_ground.js — the painted ground for Laurel/Fulton, streamed in 256-unit chunks (Palm City's size).
// Palm City's language: per-surface base colour + low-frequency noise, two passes of curl-following brush
// dabs seeded per WORLD cell (no chunk seams), then painted details — here drawn from the real graph:
// kerb lips + gutter crease on every non-service edge, lane paint by class (double yellow on two-way
// arterials, white dashes between lanes of one-way carriageways, a dashed centre on two-lane streets),
// lot aisle lines. Roads use the natural-asphalt palette (pc-ext-fable natural-asphalt-v2, owner-approved).
// Only ground-level (layer 0) roads are painted here; bridge decks are drawn live above (lf_render.js).
import { mulberry32, fbm, vnoise } from '../../palm-city/src/world.js';

export const CHUNK = 256, PX = 2, CPX = CHUNK * PX;
const PAL = {
  road:     { base: [58, 66, 80],    var: [9, 9, 10],    dabs: ['#4e5768', '#59627a', '#465062', '#626a7a', '#525c70', '#6b7282', '#3e4757', '#747a86'] },
  parking:  { base: [52, 58, 70],    var: [8, 8, 9],     dabs: ['#48505f', '#3f4756', '#565e6c', '#363d4a', '#636a76'] },
  sidewalk: { base: [236, 214, 184], var: [14, 12, 12],  dabs: ['#f4e2c4', '#dcc2a4', '#faebd2', '#cfb294', '#efd5b0'] },
  grass:    { base: [70, 132, 60],   var: [26, 30, 22],  dabs: ['#48a03c', '#8cc846', '#2e7c44', '#b2d44c', '#266644', '#a8cc52', '#56ac36', '#72ba44'] },
};
const TYPES = Object.keys(PAL);
const kind = (s) => s === 'road' ? 'road' : s === 'service' ? 'parking' : s === 'sidewalk' ? 'sidewalk' : 'grass';
function curlAngle(wx, wy, sc, seed, base) {
  const e = 1.2, n1 = vnoise(wx * sc, (wy + e) * sc, seed), n2 = vnoise(wx * sc, (wy - e) * sc, seed);
  const n3 = vnoise((wx + e) * sc, wy * sc, seed), n4 = vnoise((wx - e) * sc, wy * sc, seed);
  return base * 0.45 + Math.atan2(-(n3 - n4), n1 - n2) * 0.55;
}

export class GroundPainter {
  constructor(W, cap = 64) { this.W = W; this.cache = new Map(); this.cap = cap; this.queue = []; this.job = null; this.stats = { sync: 0, sliced: 0, evicted: 0 }; }
  key(cx, cy) { return cx + ',' + cy; }
  has(cx, cy) { return this.cache.has(this.key(cx, cy)); }
  trim() { while (this.cache.size > this.cap) { const k = this.cache.keys().next().value; if (this.job && this.job.k === k) break; this.cache.delete(k); this.stats.evicted++; } }
  get(cx, cy) {
    const k = this.key(cx, cy), c = this.cache.get(k);
    if (c) { this.cache.delete(k); this.cache.set(k, c); return c; }
    let gen = this.job && this.job.k === k ? this.job.gen : this.paintGen(cx, cy); if (this.job && this.job.k === k) this.job = null;
    let r = gen.next(); while (!r.done) r = gen.next();
    this.cache.set(k, r.value); this.stats.sync++; this.trim(); return r.value;
  }
  request(list) { this.queue = list.filter(([cx, cy]) => !this.has(cx, cy)); }
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
    yield;
    // pass 2: brush dabs, seeded per 32-unit world cell (seamless across chunks)
    g.lineCap = 'round';
    const CELL = 32;
    for (let pass = 0; pass < 2; pass++) {
      const count = pass ? 70 : 36, sx = pass ? 0x9e3779b9 : 0x5bd1e995;
      for (let ky = Math.floor(oy / CELL) - 1; ky <= Math.floor((oy + CHUNK) / CELL) + 1; ky++) {
        yield;
        for (let kx = Math.floor(ox / CELL) - 1; kx <= Math.floor((ox + CHUNK) / CELL) + 1; kx++) {
          const cr = mulberry32((kx * 73856093) ^ (ky * 19349663) ^ sx);
          for (let n = 0; n < count; n++) {
            const wx = (kx + cr()) * CELL, wy = (ky + cr()) * CELL, r1 = cr(), r2 = cr(), r3 = cr(), r4 = cr(), r5 = cr(), r6 = cr();
            const px = (wx - ox) * PX, py = (wy - oy) * PX;
            if (px < -30 || py < -30 || px > CPX + 30 || py > CPX + 30) continue;
            const sf = W.surfaceAt(wx, wy, 0), t = kind(sf), p = PAL[t];
            let ang, len, wid, al;
            if (t === 'road' || t === 'parking') { const r = W.roadInfo(wx, wy, 0), ra = Math.atan2(r.dy, r.dx); ang = curlAngle(wx, wy, 0.015, 11, ra) * 0.3 + ra * 0.7 + (r1 - 0.5) * 0.3; len = (pass ? 12 : 20) + r2 * 14; wid = (pass ? 5.5 : 9) + r3 * 4.5; al = (pass ? 0.4 : 0.32) + r4 * 0.24; }
            else if (t === 'grass') { ang = curlAngle(wx, wy, 0.026, 31, fbm(wx * 0.015, wy * 0.015, 4, 2) * Math.PI * 3); len = 10 + r2 * 10; wid = (pass ? 5 : 8) + r3 * 4; al = 0.45 + r4 * 0.35; }
            else { ang = curlAngle(wx, wy, 0.018, 19, 0) + (r1 - 0.5) * 0.35; len = (pass ? 11 : 17) + r2 * 11; wid = (pass ? 5.5 : 8.5) + r3 * 4; al = 0.3 + r4 * 0.26; }
            const cxs = Math.cos(ang) * len / 2, sys = Math.sin(ang) * len / 2, bend = (r6 - 0.5) * 0.36;
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
    const near = new Set(), grid = W.grid[0];
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) for (const si of grid.get(i * 100003 + j) || []) near.add(W.seg[si].e);
    const inC = (x, y, m = 40) => x > ox - m && x < ox + CHUNK + m && y > oy - m && y < oy + CHUNK + m;
    const walk = (e, fn, step = 2.5) => { for (let k = 0; k + 1 < e.pts.length; k++) { const [ax, ay] = e.pts[k], [bx, by] = e.pts[k + 1], L = Math.hypot(bx - ax, by - ay); if (!L) continue; const ux = (bx - ax) / L, uy = (by - ay) / L; for (let s = 0; s <= L; s += step) { const x = ax + ux * s, y = ay + uy * s; if (inC(x, y)) fn(x, y, ux, uy, s); } } };
    for (const e of near) {
      if (e.L !== 0) continue;
      const hw = e.w / 2, base = e.hw.replace('_link', '');
      if (base !== 'service') walk(e, (x, y, ux, uy) => {               // kerb: warm lit lip + dark gutter crease, skipped inside junctions
        for (const sd of [-1, 1]) {
          const nx = -uy * sd, ny = ux * sd, ex = x + nx * hw, ey = y + ny * hw;
          const r = W.roadInfo(ex + nx * 3, ey + ny * 3, 0); if (r.d < r.hw - 1) continue;
          g.globalAlpha = 0.7; g.fillStyle = '#f0dcbc'; g.fillRect(ex + nx * 1.3 - 1.6, ey + ny * 1.3 - 1.6, 3.2, 3.2);
          g.globalAlpha = 0.42; g.fillStyle = '#201a42'; g.fillRect(ex - nx * 1.8 - 1.5, ey - ny * 1.8 - 1.5, 3, 3);
        }
      });
      yield;
      const twoWayArterial = !e.oneway && ['primary', 'secondary', 'trunk', 'tertiary'].includes(base);
      if (twoWayArterial) walk(e, (x, y, ux, uy) => {                   // double yellow centre line
        for (const o of [-1.6, 1.6]) { g.globalAlpha = 0.8; g.fillStyle = '#f2c84a'; g.fillRect(x - uy * o - 1.1, y + ux * o - 1.1, 2.2, 2.2); }
      }, 2);
      else if (base !== 'service' && !e.oneway && base !== 'motorway') walk(e, (x, y, ux, uy, s) => {   // dashed centre on two-lane streets
        if (s % 40 < 16 && W.roadInfo(x - uy * (hw + 6), y + ux * (hw + 6), 0).d > hw - 2) { g.globalAlpha = 0.6; g.fillStyle = '#f8ecc8'; g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
      }, 2);
      if (e.oneway && e.lanes > 1) walk(e, (x, y, ux, uy, s) => {       // lane dashes on one-way carriageways (US-29, ramps)
        if (s % 60 >= 24) return;
        for (let l = 1; l < e.lanes; l++) { const o = -hw + l * (e.w / e.lanes); g.globalAlpha = 0.65; g.fillStyle = '#f4f0e6'; g.fillRect(x - uy * o - 1.1, y + ux * o - 1.1, 2.2, 2.2); }
      }, 2);
      if (e.oneway && base !== 'service') walk(e, (x, y, ux, uy) => {   // white edge lines on divided highways
        for (const sd of [-1, 1]) { const o = sd * (hw - 4); g.globalAlpha = 0.5; g.fillStyle = '#efe9da'; g.fillRect(x - uy * o - 0.9, y + ux * o - 0.9, 1.8, 1.8); }
      }, 3);
      yield;
    }
    g.restore(); g.globalAlpha = 1;
    return cv;
  }
}

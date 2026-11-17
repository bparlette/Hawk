// ground.js — procedural painted ground, streamed in small chunks.
// Each chunk is CHUNK world units square, painted at PX_PER_UNIT (512x512 px canvas).
// Pass 1: per-pixel base colour from surface type + low-frequency noise (no visible tiling).
// Pass 2: two-pass curl-following impasto brushstrokes with shadow under-ridges & edge glints.
// Pass 3: painted details — curbs, lane paint, mosaic pavers, boardwalk planks, sand swirls,
//         crosswalks, cracks, oil, wet reflection troughs, shoreline foam.
// Nothing is baked bigger than one chunk. Painting is TIME-SLICED (perf pass): paintGen is a generator
// that yields between rows / dab rows / detail layers, and work(budgetMs) advances queued chunks a few
// milliseconds per frame, so streaming never paints a whole chunk in one frame. The cache is a bounded
// LRU (MAX_CHUNKS canvases): the core alone is 72 chunks and the extension shell adds ~162 more, so an
// unbounded cache would grow past 230 MB — the cap holds the visible area plus margin, and chunks
// evicted behind the player simply repaint if the player drives back.

import { mulberry32, fbm, vnoise } from './world.js';
import { fxOn, inBleed } from './fx.js';

export const CHUNK = 256;
export const PX_PER_UNIT = 2;
const CPX = CHUNK * PX_PER_UNIT; // 512

// Daylight albedo per surface (the time-of-day grade is applied later, in the lighting pass).
const PAL = {
  road:      { base: [82, 76, 86],    var: [18, 16, 18], dabs: ['#666074', '#756e80', '#544f62', '#847888', '#5e627a', '#90828c', '#464156', '#988b96'] },
  sidewalk:  { base: [242, 214, 178], var: [16, 14, 12], dabs: ['#fae4be', '#dfbe9c', '#fff0d2', '#cfa88c', '#f4d3a6', '#e8b68c'] },
  paving:    { base: [212, 118, 76],  var: [26, 18, 16], dabs: ['#e68854', '#b85a42', '#f2a46a', '#9c4c3a', '#de7458', '#f8b976', '#8a3e30'] },
  plaza:     { base: [236, 190, 138], var: [18, 14, 14], dabs: ['#fad090', '#dea274', '#f2b880', '#ce8670', '#ffe0a4', '#e89668'] },
  parking:   { base: [62, 58, 66],    var: [12, 10, 12], dabs: ['#524e5a', '#44404c', '#66606c', '#36333e', '#746e78'] },
  grass:     { base: [64, 134, 58],   var: [28, 32, 22], dabs: ['#48a03c', '#8cc846', '#2e7c44', '#b2d44c', '#266644', '#d0dc58', '#56ac36', '#72ba44'] },
  promenade: { base: [208, 138, 92],  var: [20, 16, 14], dabs: ['#d48858', '#b86c48', '#e6a06c', '#9c583c', '#f0b47c', '#c87c4e'] },
  sand:      { base: [246, 198, 126], var: [16, 15, 14], dabs: ['#ffda92', '#ecb06a', '#fff0b4', '#dc9864', '#f8c67e', '#e49e60'] },
  water:     { base: [24, 96, 158],   var: [18, 22, 24], dabs: ['#2482ba', '#38a6cc', '#165a96', '#56bed6', '#124686', '#7ad0dc', '#2a6cb4', '#f0ba78'] },
};
const TYPES = Object.keys(PAL);

// Curl vector field helper using fast vnoise finite differences
function curlAngle(wx, wy, scale, seed, baseAng) {
  const e = 1.2;
  const n1 = vnoise(wx * scale, (wy + e) * scale, seed);
  const n2 = vnoise(wx * scale, (wy - e) * scale, seed);
  const n3 = vnoise((wx + e) * scale, wy * scale, seed);
  const n4 = vnoise((wx - e) * scale, wy * scale, seed);
  const cx = (n1 - n2) / (2 * e);
  const cy = -(n3 - n4) / (2 * e);
  const cAng = Math.atan2(cy, cx);
  return baseAng * 0.45 + cAng * 0.55;
}

// MOTH-SLICE: shore calm factor — 0 at the shoreline (or at the pier's edge),
// rising smoothly to 1 in open water ~170 world units out. Water strokes and
// the shallows tint key off it, so the sea is calm where it meets the land
// and only gathers energy offshore.
export function shoreCalm(W, x, y) {
  if (W.shell && x < 0) {   // shell coasts: distance to the nearest shell land, same smoothstep falloff
    const t0 = Math.max(0, Math.min(1, W.shellLandDist(x, y) / 170));
    return t0 * t0 * (3 - 2 * t0);
  }
  const sd = x - W.shoreX(y);
  const P = W.L.pier;
  const pdx = Math.max(P.x - x, 0, x - (P.x + P.w));
  const pdy = Math.max(P.y - y, 0, y - (P.y + P.h));
  const d = Math.min(sd, Math.hypot(pdx, pdy));
  const t = Math.max(0, Math.min(1, d / 170));
  return t * t * (3 - 2 * t);
}

const MAX_CHUNKS = 64;   // LRU cap: ~64 MB of chunk canvases — the view + prefetch margin, not the whole map

export class GroundPainter {
  constructor(world) {
    this.world = world;
    this.cache = new Map(); // key -> canvas, in LRU order (oldest first)
    const b = world.bounds || { x0: 0, y0: 0, x1: world.L.world.w, y1: world.L.world.h };
    this.cx0 = Math.floor(b.x0 / CHUNK); this.cy0 = Math.floor(b.y0 / CHUNK);
    this.cx1 = Math.ceil(b.x1 / CHUNK); this.cy1 = Math.ceil(b.y1 / CHUNK);
    this.cols = this.cx1 - this.cx0;
    this.rows = this.cy1 - this.cy0;
    this.queue = [];        // [cx, cy] waiting to be painted, nearest-first
    this.job = null;        // { k, gen } the chunk being painted a slice at a time
    this.stats = { sync: 0, sliced: 0, evicted: 0 };   // chunks painted all at once (a hitch) vs in slices; LRU evictions
  }

  key(cx, cy) { return cx + ',' + cy; }

  // Evict least-recently-used chunks until the cache fits the cap. The in-flight job's chunk is spared.
  trim() {
    while (this.cache.size > MAX_CHUNKS) {
      const k0 = this.cache.keys().next().value;
      if (this.job && this.job.k === k0) break;
      this.cache.delete(k0);
      this.stats.evicted++;
    }
  }

  // A chunk that must be drawn NOW. Painted ahead by work() in the normal case; if not, finish it here
  // (finishing the in-flight job if it's this chunk) — that's the hitch the prefetch is there to avoid.
  get(cx, cy) {
    const k = this.key(cx, cy);
    const c = this.cache.get(k);
    if (c) { this.cache.delete(k); this.cache.set(k, c); return c; }   // a draw refreshes recency
    let gen;
    if (this.job && this.job.k === k) { gen = this.job.gen; this.job = null; } else gen = this.paintGen(cx, cy);
    let r = gen.next();
    while (!r.done) r = gen.next();
    this.cache.set(k, r.value);
    this.trim();
    this.stats.sync++;
    return r.value;
  }

  // Replace the wish list (nearest-first); chunks already painted are dropped.
  request(list) {
    this.queue.length = 0;
    for (const [cx, cy] of list) if (!this.cache.has(this.key(cx, cy))) this.queue.push(cx, cy);
  }

  // Advance painting for up to budgetMs. Returns true while there's more to do.
  work(budgetMs) {
    const t0 = performance.now();
    let qi = 0;
    while (performance.now() - t0 < budgetMs) {
      if (!this.job) {
        while (qi < this.queue.length && this.cache.has(this.key(this.queue[qi], this.queue[qi + 1]))) qi += 2;
        if (qi >= this.queue.length) return false;
        const cx = this.queue[qi], cy = this.queue[qi + 1];
        qi += 2;
        this.job = { k: this.key(cx, cy), gen: this.paintGen(cx, cy) };
      }
      const r = this.job.gen.next();
      if (r.done) { this.cache.set(this.job.k, r.value); this.job = null; this.stats.sliced++; this.trim(); }
    }
    return true;
  }

  has(cx, cy) { return this.cache.has(this.key(cx, cy)); }

  // Paint a whole chunk at once (tools/profile.mjs times this).
  paint(cx, cy) {
    const gen = this.paintGen(cx, cy);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
  }

  *paintGen(cx, cy) {
    const W = this.world;
    const cv = document.createElement('canvas');
    cv.width = CPX; cv.height = CPX;
    const g = cv.getContext('2d');
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const rnd = mulberry32(cx * 7919 + cy * 104729 + 3);

    // ---- pass 1: base colour, sampled on a 4px grid and upscaled smoothly (cheap on phones)
    const S = 4, gw = CPX / S + 1;
    const small = document.createElement('canvas');
    small.width = gw; small.height = gw;
    const sg = small.getContext('2d');
    const img = sg.createImageData(gw, gw);
    const d = img.data;
    const typeGrid = new Uint8Array(gw * gw);
    for (let j = 0; j < gw; j++) {
      if ((j & 15) === 15) yield;
      for (let i = 0; i < gw; i++) {
        const wx = ox + i * S / PX_PER_UNIT, wy = oy + j * S / PX_PER_UNIT;
        const wob = vnoise(wx * 0.055, wy * 0.055, 9) * 2 - 1;
        const t = W.surfaceAt(wx, wy, wob);
        typeGrid[j * gw + i] = TYPES.indexOf(t);
        const p = PAL[t];
        const n1 = fbm(wx * 0.015, wy * 0.015, 1, 3) - 0.5;
        const n2 = vnoise(wx * 0.09, wy * 0.09, 2) - 0.5;
        const warm = fbm(wx * 0.005, wy * 0.005, 5, 2) - 0.5;
        const o = (j * gw + i) * 4;
        d[o]     = p.base[0] + p.var[0] * (n1 * 2.2 + n2) + warm * 34;
        d[o + 1] = p.base[1] + p.var[1] * (n1 * 2.2 + n2) + warm * 10;
        d[o + 2] = p.base[2] + p.var[2] * (n1 * 2.2 + n2) - warm * 16;
        d[o + 3] = 255;
        if (t === 'water') {
          // MOTH-SLICE: pale shallows — the base colour itself lightens toward
          // the shore, so the calm zone reads even where no strokes land.
          const sh = (1 - shoreCalm(W, wx, wy)) * 0.38;
          d[o]     += (92 - d[o]) * sh;
          d[o + 1] += (164 - d[o + 1]) * sh;
          d[o + 2] += (178 - d[o + 2]) * sh;
        }
      }
    }
    yield;
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, gw, gw, 0, 0, CPX + S, CPX + S);

    const typeAt = (px, py) => {
      const i = Math.min(gw - 1, Math.max(0, Math.round(px / S)));
      const j = Math.min(gh - 1, Math.max(0, Math.round(py / S)));
      return TYPES[typeGrid[j * gw + i]];
    };
    const gh = gw;

    // ---- pass 2: two-pass curl-following impasto brushstrokes. Seeded per 32-unit world cell,
    // and every chunk also paints its neighbours' border cells, so dabs cross chunk edges with no seam.
    g.lineCap = 'round';
    const CELL = 32, PER = 86;
    const k0x = Math.floor(ox / CELL) - 1, k1x = Math.floor((ox + CHUNK) / CELL) + 1;
    const k0y = Math.floor(oy / CELL) - 1, k1y = Math.floor((oy + CHUNK) / CELL) + 1;
    for (let pass = 0; pass < 2; pass++) {
      const count = pass === 0 ? Math.floor(PER * 0.50) : PER;
      const seedXor = pass ? 0x9e3779b9 : 0x5bd1e995;
      for (let ky = k0y; ky <= k1y; ky++) for (let kx = k0x; kx <= k1x; kx++) {
        if (kx === k0x) yield;                           // a slice per row of brush cells
        const cr = mulberry32((kx * 73856093) ^ (ky * 19349663) ^ seedXor);
        for (let n = 0; n < count; n++) {
          const wx = (kx + cr()) * CELL, wy = (ky + cr()) * CELL;
          const px = (wx - ox) * PX_PER_UNIT, py = (wy - oy) * PX_PER_UNIT;
          if (px < -30 || py < -30 || px > CPX + 30 || py > CPX + 30) {
            cr(); cr(); cr(); cr(); cr(); cr();
            continue;
          }
          const t = W.surfaceAt(wx, wy, vnoise(wx * 0.055, wy * 0.055, 9) * 2 - 1);
          const p = PAL[t];
          const r1 = cr(), r2 = cr(), r3 = cr(), r4 = cr(), r5 = cr(), r6 = cr();
          let ang, len, wid, alpha, skipDab = false, dabFade = 1;
          if (t === 'road' || t === 'parking') {
            const r = W.roadInfoAny(wx, wy);
            const roadA = Math.atan2(r.dy, r.dx);
            ang = curlAngle(wx, wy, 0.015, 11, roadA) * 0.32 + roadA * 0.68 + (r1 - 0.5) * 0.30;
            len = (pass === 0 ? 20 : 12) + r2 * 16;
            wid = (pass === 0 ? 9.5 : 5.8) + r3 * 5.2;
            alpha = (pass === 0 ? 0.34 : 0.42) + r4 * 0.28;
          } else if (t === 'water') {
            const swell = Math.PI / 2 + Math.sin(wy * 0.025 + wx * 0.01) * 0.42;
            ang = curlAngle(wx, wy, 0.022, 17, swell) + (r1 - 0.5) * 0.30;
            len = (pass === 0 ? 24 : 15) + r2 * 20;
            wid = (pass === 0 ? 9.0 : 5.5) + r3 * 5.2;
            alpha = (pass === 0 ? 0.42 : 0.48) + r4 * 0.30;
            // MOTH-SLICE: calm near shore — strokes get shorter, thinner and
            // fainter toward the beach and the pier, and most dabs are skipped
            // outright in the shallows. The skip is decided AFTER r1..r6 are
            // drawn from the seeded stream, so chunk borders stay seamless.
            const calm = shoreCalm(W, wx, wy);
            dabFade = 0.16 + 0.84 * calm;
            len *= 0.45 + 0.55 * calm;
            wid *= 0.65 + 0.35 * calm;
            alpha *= dabFade;
            if (r5 > 0.22 + 0.78 * calm) skipDab = true;
          } else if (t === 'sand') {
            const dune = Math.PI / 2 + 0.25 + Math.sin(wy * 0.018) * 0.3;
            ang = curlAngle(wx, wy, 0.015, 23, dune) + (r1 - 0.5) * 0.38;
            len = (pass === 0 ? 18 : 11) + r2 * 13;
            wid = (pass === 0 ? 8.5 : 5.4) + r3 * 4.5;
            alpha = 0.30 + r4 * 0.30;
          } else if (t === 'grass') {
            ang = curlAngle(wx, wy, 0.026, 31, fbm(wx * 0.015, wy * 0.015, 4, 2) * Math.PI * 3);
            len = 10 + r2 * 11;
            wid = (pass === 0 ? 8.0 : 5.0) + r3 * 4.5;
            alpha = 0.45 + r4 * 0.35;
          } else if (t === 'promenade') {
            ang = (r1 - 0.5) * 0.16;
            len = (pass === 0 ? 18 : 12) + r2 * 12;
            wid = (pass === 0 ? 7.5 : 4.8) + r3 * 3.8;
            alpha = 0.34 + r4 * 0.28;
          } else {
            ang = curlAngle(wx, wy, 0.018, 19, fbm(wx * 0.01, wy * 0.01, 6, 2) * Math.PI * 3) + (r1 - 0.5) * 0.35;
            len = (pass === 0 ? 18 : 11) + r2 * 12;
            wid = (pass === 0 ? 8.5 : 5.5) + r3 * 4.6;
            alpha = 0.30 + r4 * 0.28;
          }
          // BEAUTY SAMPLE 5 — gouache edge bleed, plaza + NOVA blocks only (fx.js BLEED_RECTS):
          // a dab near a surface border goes bigger and hotter (and is laid twice); a dab near
          // a road centreline goes softer and loses its dark under-ridge. Decided from extra
          // surfaceAt samples taken AFTER r1..r6 leave the seeded stream, so chunk seams and
          // the untreated paint are bit-identical; with the fx off this block never runs.
          let dabTwice = false, noRidge = false;
          if (fxOn('bleed') && inBleed(wx, wy)) {
            const wob2 = vnoise(wx * 0.055, wy * 0.055, 9) * 2 - 1;
            if (W.surfaceAt(wx - 11, wy, wob2) !== t || W.surfaceAt(wx + 11, wy, wob2) !== t ||
                W.surfaceAt(wx, wy - 11, wob2) !== t || W.surfaceAt(wx, wy + 11, wob2) !== t) {
              alpha = Math.min(0.95, alpha * 1.4); len *= 1.18; wid *= 1.3; dabTwice = true;
            } else if (t === 'road') {
              const ri = W.roadInfoAny(wx, wy);
              if (ri.d < ri.hw * 0.45) { alpha *= 0.62; wid *= 0.9; noRidge = true; }
            }
          }
          if (!skipDab) {
          const col = p.dabs[(r5 * p.dabs.length) | 0];
          const cxs = Math.cos(ang) * len / 2, sys = Math.sin(ang) * len / 2;
          const bend = (r6 - 0.5) * 0.36;
          if (pass === 1 && r4 > 0.35 && !noRidge) {
            g.strokeStyle = 'rgba(28, 22, 62, 0.11)';
            g.globalAlpha = alpha * 0.55;
            g.lineWidth = wid + 1.0;
            g.beginPath();
            g.moveTo(px - cxs + 1.3, py - sys + 1.0);
            g.quadraticCurveTo(px - sys * bend + 1.3, py + cxs * bend + 1.0, px + cxs + 1.3, py + sys + 1.0);
            g.stroke();
          }
          g.strokeStyle = col;
          g.globalAlpha = alpha;
          g.lineWidth = wid;
          g.beginPath();
          g.moveTo(px - cxs, py - sys);
          g.quadraticCurveTo(px - sys * bend, py + cxs * bend, px + cxs, py + sys);
          g.stroke();
          if (dabTwice) { g.globalAlpha = alpha * 0.55; g.stroke(); }   // the same stroke laid again: a hotter edge
          if (pass === 1 && r4 > 0.74) {
            g.strokeStyle = t === 'water' ? '#bfefff' : (t === 'road' ? '#cfc6d0' : '#fff3ce');
            g.globalAlpha = 0.26 * dabFade;
            g.lineWidth = Math.max(1.4, wid * 0.35);
            g.beginPath();
            g.moveTo(px - cxs - 0.9, py - sys - 0.7);
            g.quadraticCurveTo(px - sys * bend - 0.9, py + cxs * bend - 0.7, px + cxs - 0.9, py + sys - 0.7);
            g.stroke();
          }
          }
        }
      }
    }
    g.globalAlpha = 1;

    yield* this.details(g, ox, oy, rnd, typeAt);
    return cv;
  }

  // ---- pass 3: painted details in world coordinates
  *details(g, ox, oy, rnd, typeAt) {
    const W = this.world, P = PX_PER_UNIT;
    g.save();
    g.scale(P, P);
    g.translate(-ox, -oy);
    const inChunk = (x, y, m = 60) => x > ox - m && x < ox + CHUNK + m && y > oy - m && y < oy + CHUNK + m;
    const hr = W.halfRoad;

    // Curbs: a warm lit lip and a soft shadow line, painted by walking each road edge.
    const edgeWalk = (fn) => {
      for (const [x0, y0, x1, y1] of W.segs) {
        const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
        for (let s = 0; s <= L; s += 2.5) {
          const x = x0 + ux * s, y = y0 + uy * s;
          if (inChunk(x, y)) fn(x, y, ux, uy, s);
        }
      }
      for (const a of W.arcs) {
        const L = a.r * (a.a1 - a.a0);
        for (let s = 0; s <= L; s += 2.5) {
          const an = a.a0 + s / a.r;
          const x = a.cx + Math.cos(an) * a.r, y = a.cy + Math.sin(an) * a.r;
          if (inChunk(x, y)) fn(x, y, -Math.sin(an), Math.cos(an), s);
        }
      }
    };

    // Curbs with warm sunlit highlight & deep indigo gutter crease
    edgeWalk((x, y, ux, uy) => {
      for (const side of [-1, 1]) {
        const nx = -uy * side, ny = ux * side;
        const ex = x + nx * hr, ey = y + ny * hr;
        if (W.roadInfo(ex + nx * 3, ey + ny * 3).d < hr - 1) continue;
        g.globalAlpha = 0.72;
        g.fillStyle = '#f2dbb8';
        g.fillRect(ex + nx * 1.3 - 1.7, ey + ny * 1.3 - 1.7, 3.4, 3.4);
        g.globalAlpha = 0.45;
        g.fillStyle = '#201a42';
        g.fillRect(ex - nx * 1.8 - 1.6, ey - ny * 1.8 - 1.6, 3.2, 3.2);
      }
    });

    yield;
    // Hand-painted golden-cream dashed lane lines
    edgeWalk((x, y, ux, uy, s) => {
      if (W.roadInfo(x - uy * (hr + 6), y + ux * (hr + 6)).d < hr - 2 &&
          W.roadInfo(x + uy * (hr + 6), y - ux * (hr + 6)).d < hr - 2) return; // inside a junction
      if (s % 36 < 18) {
        g.globalAlpha = 0.65 + vnoise(x * 0.3, y * 0.3, 3) * 0.3;
        g.fillStyle = '#f8e3a4';
        g.save(); g.translate(x, y); g.rotate(Math.atan2(uy, ux));
        g.fillRect(-1.8, -1.35 + (rnd() - 0.5) * 0.35, 3.6, 2.7);
        g.restore();
      }
    });

    yield;
    // Sidewalk slab joints
    const sw = W.L.roads.sidewalk;
    edgeWalk((x, y, ux, uy, s) => {
      if (Math.round(s) % 14 > 2) return;
      for (const side of [-1, 1]) {
        const nx = -uy * side, ny = ux * side;
        const ax = x + nx * (hr + 2), ay = y + ny * (hr + 2);
        if (W.surfaceAt(ax + nx * 6, ay + ny * 6) !== 'sidewalk') continue;
        g.globalAlpha = 0.22;
        g.strokeStyle = '#683846';
        g.lineWidth = 0.85;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + nx * (sw - 3) + (rnd() - 0.5), ay + ny * (sw - 3)); g.stroke();
      }
    });

    yield;
    // Plaza & paving terracotta mosaic, promenade boardwalk planks
    const sample = (x, y) => typeAt((x - ox) * P, (y - oy) * P);
    for (let y = oy - 8; y < oy + CHUNK + 8; y += 8) {
      const row = Math.round(y / 8);
      for (let x = ox - 12 + (row % 2) * 6; x < ox + CHUNK + 12; x += 12) {
        const t = sample(x, y);
        if (t === 'plaza' || t === 'paving') {
          g.globalAlpha = 0.28; g.strokeStyle = '#7c483a'; g.lineWidth = 0.75;
          g.strokeRect(x + (rnd() - 0.5) * 0.6, y, 12, 8);
          if (rnd() < 0.32) {
            g.globalAlpha = 0.28;
            g.fillStyle = rnd() < 0.45 ? '#ffeac2' : (rnd() < 0.5 ? '#d06c52' : '#eaa068');
            g.fillRect(x + 0.7, y + 0.7, 10.6, 6.6);
          }
        } else if (t === 'promenade') {
          g.globalAlpha = 0.34; g.strokeStyle = '#623626'; g.lineWidth = 0.7;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y); g.stroke();
          if (rnd() < 0.28) {
            g.globalAlpha = 0.24;
            g.fillStyle = rnd() < 0.5 ? '#f2b87e' : '#a85e40';
            g.fillRect(x + 0.5, y + 0.5, 11.0, 3.2);
          }
        }
      }
    }

    yield;
    // Beach sand wind-carved Van Gogh contour swirls & shells
    for (let n = 0; n < 48; n++) {
      const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
      if (sample(x, y) !== 'sand') continue;
      g.globalAlpha = 0.32; g.strokeStyle = rnd() < 0.5 ? '#c68a58' : '#ffe8b8'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(x, y + 22, 20 + rnd() * 14, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); g.stroke();
      if (rnd() < 0.18) { g.globalAlpha = 0.85; g.fillStyle = '#fff5e2'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
    }

    yield;
    // Parking stalls: painted lines in parking rects.
    for (const q of W.L.ground) {
      if (q.type !== 'parking' || !inChunk(q.x + q.w / 2, q.y + q.h / 2, Math.max(q.w, q.h))) continue;
      g.strokeStyle = '#f6e4bc';
      g.lineWidth = 1.6;
      for (let x = q.x + 4; x < q.x + q.w; x += 28) {
        g.globalAlpha = 0.55 + rnd() * 0.2;
        g.beginPath(); g.moveTo(x, q.y + 2); g.lineTo(x + (rnd() - 0.5), q.y + Math.min(q.h - 2, 46)); g.stroke();
      }
    }

    // Crosswalk stripes where streets meet the loop.
    const L = W.L.roads;
    const junctions = [];
    for (const st of L.streets) {
      junctions.push([st.x0, st.y0, st.x1 - st.x0, st.y1 - st.y0]);
      junctions.push([st.x1, st.y1, st.x0 - st.x1, st.y0 - st.y1]);
    }
    for (const [jx, jy, dx, dy] of junctions) {
      const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const cx = jx + ux * (hr + 18), cy = jy + uy * (hr + 18);
      if (!inChunk(cx, cy, 80)) continue;
      g.fillStyle = '#f5e6c4';
      for (let k = -hr + 6; k < hr - 4; k += 11) {
        const px = cx - uy * k, py = cy + ux * k;
        g.globalAlpha = 0.62 + rnd() * 0.25;
        g.save(); g.translate(px, py); g.rotate(Math.atan2(uy, ux));
        g.beginPath(); g.roundRect(-9, -3.2, 18, 6.4, 2); g.fill();
        g.restore();
      }
    }

    yield;
    // Oil stains, cracks, manholes, grass flowers.
    for (let n = 0; n < 70; n++) {
      const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
      const t = sample(x, y);
      if (t === 'road') {
        const k = rnd();
        if (k < 0.2) { // oil stain
          g.globalAlpha = 0.18; g.fillStyle = '#2a2236';
          g.beginPath(); g.ellipse(x, y, 6 + rnd() * 8, 3 + rnd() * 4, rnd() * 3, 0, 7); g.fill();
        } else if (k < 0.32) { // crack
          g.globalAlpha = 0.35; g.strokeStyle = '#38304a'; g.lineWidth = 0.7;
          g.beginPath(); g.moveTo(x, y);
          let a = rnd() * 6.28, cx = x, cy = y;
          for (let i = 0; i < 6; i++) { a += (rnd() - 0.5) * 1.2; cx += Math.cos(a) * 4; cy += Math.sin(a) * 4; g.lineTo(cx, cy); }
          g.stroke();
        } else if (k < 0.35) { // manhole
          g.globalAlpha = 0.6; g.fillStyle = '#4a4560';
          g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
          g.globalAlpha = 0.4; g.strokeStyle = '#2a2638'; g.lineWidth = 0.8; g.stroke();
        }
      } else if (t === 'sidewalk' || t === 'plaza' || t === 'promenade') {
        g.globalAlpha = 0.12; g.strokeStyle = '#7a5a50'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.stroke();
      } else if (t === 'grass' && rnd() < 0.3) { // flowers
        g.globalAlpha = 0.85;
        g.fillStyle = ['#f6d36b', '#f28fb0', '#fff1d6', '#e87a5d'][(rnd() * 4) | 0];
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + (rnd() - .5) * 10, y + (rnd() - .5) * 10, 1 + rnd(), 0, 7); g.fill(); }
      }
    }

    yield;
    // Deep wet-asphalt reflection troughs & gutter sheen on roads
    const wr = mulberry32(((ox * 31) ^ (oy * 17)) >>> 0);
    for (let n = 0; n < 16; n++) {
      const x = ox + wr() * CHUNK, y = oy + wr() * CHUNK;
      const r = W.roadInfoAny(x, y);
      if (r.d > r.hw - 3) continue;
      const isGutter = r.d > r.hw - 24;
      g.globalAlpha = isGutter ? 0.36 : 0.20;
      g.fillStyle = isGutter ? '#242338' : '#323046';
      g.beginPath(); g.ellipse(x, y, 16 + wr() * 18, 5 + wr() * 6, Math.atan2(r.dy, r.dx), 0, 7); g.fill();
      if (isGutter) {
        g.globalAlpha = 0.24;
        g.fillStyle = '#6e7494';
        g.beginPath(); g.ellipse(x - 2, y - 1, 9, 1.8, Math.atan2(r.dy, r.dx), 0, 7); g.fill();
      }
    }

    yield;
    // Broken foamy scalloped surf along shoreX
    for (let y = Math.max(0, oy - 4); y < oy + CHUNK + 4; y += 3.8) {
      const sx = W.shoreX(y);
      if (sx < ox - 20 || sx > ox + CHUNK + 20) continue;
      const n = vnoise(y * 0.14, 0, 4);
      if (n > 0.22) {
        g.globalAlpha = 0.32 + n * 0.42;
        g.fillStyle = '#fbf0d8';
        g.beginPath(); g.ellipse(sx + vnoise(y * 0.05, 1, 5) * 7, y, 2.8 + n * 2.5, 1.8 + n * 1.4, 1.35 + (rnd() - 0.5) * 0.3, 0, 7); g.fill();
      }
      if (n > 0.45) {
        g.globalAlpha = 0.22; g.fillStyle = '#5ab8cf';
        g.beginPath(); g.ellipse(sx + 6 + rnd() * 5, y, 3.8, 1.6, 1.45, 0, 7); g.fill();
      }
      g.globalAlpha = 0.26; g.fillStyle = '#be8d58';
      g.beginPath(); g.ellipse(sx - 6, y, 5.0, 1.9, 1.48, 0, 7); g.fill();
    }

    // ---- extension shell: curbs + lane dashes along the traced roads, foam on shell shorelines
    if (W.shell) {
      for (const s of W.shellSegs) {
        const L = Math.hypot(s.x1 - s.x0, s.y1 - s.y0), ux = (s.x1 - s.x0) / L, uy = (s.y1 - s.y0) / L;
        for (let d = 0; d <= L; d += 2.5) {
          const x = s.x0 + ux * d, y = s.y0 + uy * d;
          if (!inChunk(x, y)) continue;
          for (const side of [-1, 1]) {
            const nx = -uy * side, ny = ux * side;
            const ex = x + nx * s.hw, ey = y + ny * s.hw;
            if (W.shellRoadInfo(ex + nx * 3, ey + ny * 3).d < s.hw - 1) continue;   // inside a junction: no curb
            g.globalAlpha = 0.72; g.fillStyle = '#f2dbb8';
            g.fillRect(ex + nx * 1.3 - 1.7, ey + ny * 1.3 - 1.7, 3.4, 3.4);
            g.globalAlpha = 0.45; g.fillStyle = '#201a42';
            g.fillRect(ex - nx * 1.8 - 1.6, ey - ny * 1.8 - 1.6, 3.2, 3.2);
          }
          if (d % 36 < 18) {   // hand-painted golden-cream dashed lane line, same rhythm as the core
            g.globalAlpha = 0.65 + vnoise(x * 0.3, y * 0.3, 3) * 0.3;
            g.fillStyle = '#f8e3a4';
            g.save(); g.translate(x, y); g.rotate(Math.atan2(uy, ux));
            g.fillRect(-1.8, -1.35 + (rnd() - 0.5) * 0.35, 3.6, 2.7);
            g.restore();
          }
        }
      }
      yield;
      // Foam where shell water meets shell land: scallops along each shoreline cell edge, seeded per cell.
      const CS = W.shellCell;
      const fc0 = Math.max(0, Math.floor((ox - W.shellOx) / CS)), fc1 = Math.min(W.shellCols - 1, Math.floor((ox + CHUNK - W.shellOx) / CS));
      const fr0 = Math.max(0, Math.floor((oy - W.shellOy) / CS)), fr1 = Math.min(W.shellRows - 1, Math.floor((oy + CHUNK - W.shellOy) / CS));
      for (let r = fr0; r <= fr1; r++) for (let c = fc0; c <= fc1; c++) {
        if (W.shellGrid[r].charCodeAt(c) !== 48) continue;   // water cells only
        const wx = W.shellOx + (c + 0.5) * CS, wy = W.shellOy + (r + 0.5) * CS;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= W.shellCols || nr >= W.shellRows) continue;
          if (W.shellGrid[nr].charCodeAt(nc) === 48) continue;   // neighbour is water too: open bay, no foam
          const fr = mulberry32(((c * 73856093) ^ (r * 19349663) ^ (dc * 131 + dr * 197)) >>> 0);
          const fx = wx + dc * CS / 2 + (fr() - 0.5) * 4, fy = wy + dr * CS / 2 + (fr() - 0.5) * 4;
          g.globalAlpha = 0.30 + fr() * 0.4; g.fillStyle = '#fbf0d8';
          g.beginPath(); g.ellipse(fx, fy, 3.2 + fr() * 2.6, 1.9 + fr() * 1.4, Math.atan2(dr, dc) + 1.35, 0, 7); g.fill();
          if (fr() > 0.55) { g.globalAlpha = 0.20; g.fillStyle = '#5ab8cf'; g.beginPath(); g.ellipse(fx - dc * 5, fy - dr * 5, 3.6, 1.5, Math.atan2(dr, dc) + 1.45, 0, 7); g.fill(); }
        }
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }
}

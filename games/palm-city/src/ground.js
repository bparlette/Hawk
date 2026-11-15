// ground.js — procedural painted ground, streamed in small chunks.
// Each chunk is CHUNK world units square, painted at PX_PER_UNIT (512x512 px canvas).
// Pass 1: per-pixel base colour from surface type + low-frequency noise (no visible tiling).
// Pass 2: thousands of short brush dabs, oriented per surface (along the road, across sand...).
// Pass 3: painted details — curbs, lane paint, crosswalks, cracks, oil, wet patches.
// Nothing is baked bigger than one chunk; chunks are LRU-cached.

import { mulberry32, fbm, vnoise } from './world.js';

export const CHUNK = 256;
export const PX_PER_UNIT = 2;
const CPX = CHUNK * PX_PER_UNIT; // 512

// Daylight albedo per surface (the time-of-day grade is applied later, in the lighting pass).
const PAL = {
  road:      { base: [72, 66, 112],  var: [20, 18, 30], dabs: ['#5a5292', '#6e62a8', '#463f7c', '#8576b4', '#4e5a96', '#9a7fb0', '#3d3870'] },
  sidewalk:  { base: [222, 176, 150], var: [18, 16, 16], dabs: ['#f0c4a0', '#d09684', '#f6d2ac', '#c4888a', '#e8b490'] },
  paving:    { base: [200, 120, 88], var: [24, 18, 16], dabs: ['#dc8c60', '#b8624e', '#e8a474', '#a85848', '#d87a62', '#f0b47e'] },
  plaza:     { base: [230, 190, 146], var: [16, 14, 14], dabs: ['#f4cf98', '#dca880', '#ecb98c', '#d09080', '#fadca8'] },
  parking:   { base: [88, 80, 120],  var: [14, 12, 16], dabs: ['#6a609a', '#58508a', '#7e70a8'] },
  grass:     { base: [70, 130, 64],  var: [26, 30, 20], dabs: ['#4f9a44', '#86be4c', '#357a48', '#a8c850', '#2f6648', '#c4d060', '#5aa03a'] },
  promenade: { base: [196, 150, 108], var: [16, 14, 12], dabs: ['#c99a6a', '#b88658', '#d8ac7a', '#a8784e'] },
  sand:      { base: [242, 198, 132], var: [14, 14, 14], dabs: ['#fcd896', '#eab474', '#fff0b8', '#dca070', '#f6c888'] },
  water:     { base: [30, 92, 150],  var: [14, 20, 22], dabs: ['#2a78b0', '#3a96c4', '#1c5890', '#52aed0', '#184a84', '#6cc4d4', '#2d68a8'] },
};
const TYPES = Object.keys(PAL);

export class GroundPainter {
  constructor(world) {
    this.world = world;
    this.cache = new Map(); // key -> canvas
    this.order = [];
    this.max = 48;
    this.cols = Math.ceil(world.L.world.w / CHUNK);
    this.rows = Math.ceil(world.L.world.h / CHUNK);
  }

  key(cx, cy) { return cx + ',' + cy; }

  get(cx, cy) {
    const k = this.key(cx, cy);
    let c = this.cache.get(k);
    if (c) return c;
    c = this.paint(cx, cy);
    this.cache.set(k, c);
    this.order.push(k);
    while (this.order.length > this.max) this.cache.delete(this.order.shift());
    return c;
  }

  has(cx, cy) { return this.cache.has(this.key(cx, cy)); }

  paint(cx, cy) {
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
      for (let i = 0; i < gw; i++) {
        const wx = ox + i * S / PX_PER_UNIT, wy = oy + j * S / PX_PER_UNIT;
        const wob = vnoise(wx * 0.05, wy * 0.05, 9) * 2 - 1;
        const t = W.surfaceAt(wx, wy, wob);
        typeGrid[j * gw + i] = TYPES.indexOf(t);
        const p = PAL[t];
        const n1 = fbm(wx * 0.012, wy * 0.012, 1, 3) - 0.5;
        const n2 = vnoise(wx * 0.08, wy * 0.08, 2) - 0.5;
        const warm = fbm(wx * 0.004, wy * 0.004, 5, 2) - 0.5;
        const o = (j * gw + i) * 4;
        d[o]     = p.base[0] + p.var[0] * (n1 * 2 + n2) + warm * 30;
        d[o + 1] = p.base[1] + p.var[1] * (n1 * 2 + n2) + warm * 8;
        d[o + 2] = p.base[2] + p.var[2] * (n1 * 2 + n2) - warm * 14;
        d[o + 3] = 255;
      }
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, gw, gw, 0, 0, CPX + S, CPX + S);

    const typeAt = (px, py) => {
      const i = Math.min(gw - 1, Math.max(0, Math.round(px / S)));
      const j = Math.min(gw - 1, Math.max(0, Math.round(py / S)));
      return TYPES[typeGrid[j * gw + i]];
    };

    // ---- pass 2: brush dabs. Seeded per 32-unit world cell (not per chunk), and every chunk
    // also paints its neighbours' border cells, so dabs cross chunk edges with no seam.
    g.lineCap = 'round';
    const CELL = 32, PER = 54;
    const k0x = Math.floor(ox / CELL) - 1, k1x = Math.floor((ox + CHUNK) / CELL) + 1;
    const k0y = Math.floor(oy / CELL) - 1, k1y = Math.floor((oy + CHUNK) / CELL) + 1;
    for (let ky = k0y; ky <= k1y; ky++) for (let kx = k0x; kx <= k1x; kx++) {
      const cr = mulberry32((kx * 73856093) ^ (ky * 19349663) ^ 0x5bd1e995);
      for (let n = 0; n < PER; n++) {
        const wx = (kx + cr()) * CELL, wy = (ky + cr()) * CELL;
        const px = (wx - ox) * PX_PER_UNIT, py = (wy - oy) * PX_PER_UNIT;
        const t = W.surfaceAt(wx, wy, vnoise(wx * 0.05, wy * 0.05, 9) * 2 - 1);
        const p = PAL[t];
        let ang, len, wid, alpha;
        const r1 = cr(), r2 = cr(), r3 = cr(), r4 = cr(), r5 = cr(), r6 = cr();
        if (t === 'road' || t === 'parking') {
          const r = W.roadInfo(wx, wy);
          ang = Math.atan2(r.dy, r.dx) + (r1 - 0.5) * 0.5;
          len = 8 + r2 * 12; wid = 4 + r3 * 4; alpha = 0.22 + r4 * 0.26;
        } else if (t === 'water') {
          ang = Math.PI / 2 + (r1 - 0.5) * 0.35 + Math.sin(wy * 0.02) * 0.2;
          len = 10 + r2 * 18; wid = 4 + r3 * 4; alpha = 0.3 + r4 * 0.3;
        } else if (t === 'sand') {
          ang = Math.PI / 2 + 0.3 + (r1 - 0.5) * 0.6;
          len = 6 + r2 * 10; wid = 4 + r3 * 4; alpha = 0.22 + r4 * 0.25;
        } else if (t === 'grass') {
          ang = fbm(wx * 0.01, wy * 0.01, 4, 2) * Math.PI * 4;
          len = 6 + r2 * 9; wid = 4 + r3 * 5; alpha = 0.4 + r4 * 0.35;
        } else {
          ang = fbm(wx * 0.006, wy * 0.006, 6, 2) * Math.PI * 3 + (r1 - 0.5) * 0.6;
          len = 6 + r2 * 9; wid = 4 + r3 * 5; alpha = 0.2 + r4 * 0.24;
        }
        if (px < -20 || py < -20 || px > CPX + 20 || py > CPX + 20) continue;
        g.strokeStyle = p.dabs[(r5 * p.dabs.length) | 0];
        g.globalAlpha = alpha;
        g.lineWidth = wid;
        const cxs = Math.cos(ang) * len / 2, sys = Math.sin(ang) * len / 2;
        const bend = (r6 - 0.5) * 0.3;
        g.beginPath();
        g.moveTo(px - cxs, py - sys);
        g.quadraticCurveTo(px - sys * bend, py + cxs * bend, px + cxs, py + sys);
        g.stroke();
      }
    }
    g.globalAlpha = 1;

    this.details(g, ox, oy, rnd, typeAt);
    return cv;
  }

  // ---- pass 3: painted details in world coordinates
  details(g, ox, oy, rnd, typeAt) {
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
        for (let s = 0; s <= L; s += 3) {
          const x = x0 + ux * s, y = y0 + uy * s;
          if (inChunk(x, y)) fn(x, y, ux, uy, s);
        }
      }
      for (const a of W.arcs) {
        const L = a.r * (a.a1 - a.a0);
        for (let s = 0; s <= L; s += 3) {
          const an = a.a0 + s / a.r;
          const x = a.cx + Math.cos(an) * a.r, y = a.cy + Math.sin(an) * a.r;
          if (inChunk(x, y)) fn(x, y, -Math.sin(an), Math.cos(an), s);
        }
      }
    };

    // curb lip on both sides (only where the far side is not road, i.e. not inside an intersection)
    edgeWalk((x, y, ux, uy, s) => {
      for (const side of [-1, 1]) {
        const nx = -uy * side, ny = ux * side;
        const ex = x + nx * hr, ey = y + ny * hr;
        if (W.roadInfo(ex + nx * 3, ey + ny * 3).d < hr - 1) continue;
        g.globalAlpha = 0.55;
        g.fillStyle = '#e9d4bc';
        g.fillRect(ex + nx * 1.2 - 1.6, ey + ny * 1.2 - 1.6, 3.2, 3.2);
        g.globalAlpha = 0.28;
        g.fillStyle = '#2c2440';
        g.fillRect(ex - nx * 1.6 - 1.4, ey - ny * 1.6 - 1.4, 2.8, 2.8);
      }
    });

    // Lane paint: dashed warm-white centre line, slightly irregular like it was painted by hand.
    edgeWalk((x, y, ux, uy, s) => {
      if (W.roadInfo(x - uy * (hr + 6), y + ux * (hr + 6)).d < hr - 2 &&
          W.roadInfo(x + uy * (hr + 6), y - ux * (hr + 6)).d < hr - 2) return; // inside a junction
      if (s % 36 < 18) {
        g.globalAlpha = 0.5 + vnoise(x * 0.3, y * 0.3, 3) * 0.35;
        g.fillStyle = '#f1dfa8';
        g.save(); g.translate(x, y); g.rotate(Math.atan2(uy, ux));
        g.fillRect(-1.8, -1.2 + (rnd() - 0.5) * 0.3, 3.6, 2.4);
        g.restore();
      }
    });

    // Sidewalk joints: loose painted lines across the walk every ~14 units.
    const sw = W.L.roads.sidewalk;
    edgeWalk((x, y, ux, uy, s) => {
      if (Math.round(s) % 14 > 2) return;
      for (const side of [-1, 1]) {
        const nx = -uy * side, ny = ux * side;
        const ax = x + nx * (hr + 2), ay = y + ny * (hr + 2);
        if (W.surfaceAt(ax + nx * 6, ay + ny * 6) !== 'sidewalk') continue;
        g.globalAlpha = 0.16;
        g.strokeStyle = '#6a3c48';
        g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + nx * (sw - 3) + (rnd() - 0.5), ay + ny * (sw - 3)); g.stroke();
      }
    });

    // Parking stalls: painted lines in parking rects.
    for (const q of W.L.ground) {
      if (q.type !== 'parking' || !inChunk(q.x + q.w / 2, q.y + q.h / 2, Math.max(q.w, q.h))) continue;
      g.strokeStyle = '#f2e2c0';
      g.lineWidth = 1.4;
      for (let x = q.x + 4; x < q.x + q.w; x += 28) {
        g.globalAlpha = 0.45 + rnd() * 0.2;
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
      g.fillStyle = '#efe2c4';
      for (let k = -hr + 6; k < hr - 4; k += 11) {
        const px = cx - uy * k, py = cy + ux * k;
        g.globalAlpha = 0.5 + rnd() * 0.25;
        g.save(); g.translate(px, py); g.rotate(Math.atan2(uy, ux));
        g.beginPath(); g.roundRect(-9, -3, 18, 6, 2); g.fill();
        g.restore();
      }
    }

    // Sidewalk paving joints, oil stains, cracks, manholes, wet patches.
    for (let n = 0; n < 70; n++) {
      const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
      const t = typeAt((x - ox) * P, (y - oy) * P);
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

    // Wet patches along the gutters: darker, cooler, glossy — neon reflects here later.
    const wr = mulberry32(((ox * 31) ^ (oy * 17)) >>> 0);
    for (let n = 0; n < 6; n++) {
      const x = ox + wr() * CHUNK, y = oy + wr() * CHUNK;
      const r = W.roadInfo(x, y);
      if (r.d > hr - 4 || r.d < hr - 22) continue;
      g.globalAlpha = 0.28;
      g.fillStyle = '#2b2a4a';
      g.beginPath(); g.ellipse(x, y, 14 + wr() * 14, 5 + wr() * 5, Math.atan2(r.dy, r.dx), 0, 7); g.fill();
      g.globalAlpha = 0.18;
      g.fillStyle = '#9aa8d8';
      g.beginPath(); g.ellipse(x - 2, y - 1, 8, 1.6, Math.atan2(r.dy, r.dx), 0, 7); g.fill();
    }

    // Shoreline foam
    for (let y = Math.max(0, oy - 4); y < oy + CHUNK + 4; y += 2.5) {
      const sx = W.shoreX(y);
      if (sx < ox - 20 || sx > ox + CHUNK + 20) continue;
      g.globalAlpha = 0.35 + vnoise(y * 0.1, 0, 4) * 0.4;
      g.fillStyle = '#f4ead2';
      g.beginPath(); g.ellipse(sx + vnoise(y * 0.05, 1, 5) * 6, y, 3.5, 1.6, 1.4, 0, 7); g.fill();
      g.globalAlpha = 0.25; g.fillStyle = '#c9a774';
      g.beginPath(); g.ellipse(sx - 6, y, 4, 1.4, 1.5, 0, 7); g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
  }
}

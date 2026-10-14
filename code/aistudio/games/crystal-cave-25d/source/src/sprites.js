// Procedural pixel-art sprite sheets drawn on a canvas (all original art).
// Each frame is drawn with tiny primitives, then an automatic dark outline pass
// and a 1px rim-light pass are applied so the sprite reads crisply against the cave.

function makeFrameCtx(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); return { c, x, w, h };
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; return this.p[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  ell(cx, cy, rx, ry, c, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d <= 1) this.set(x, y, fn ? fn(dx, dy, d) : c);
    }
  }
  line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) this.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
  }
  blit(ctx, ox, oy) {
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.p.length; i++) { const c = this.p[i]; if (!c) continue; const [r, g, b] = hex(c); img.data.set([r, g, b, 255], i * 4); }
    ctx.putImageData(img, ox, oy);
  }
}

const OUT = '#120d26';
// ---------------- Hero: "Pip", a turtle-shell kid with a blue bandana -------------
// frames: 0-1 idle, 2-5 run, 6 jump, 7 fall
export function heroSheet() {
  const F = 32, N = 8, { c, x } = makeFrameCtx(F * N, F);
  const SK = '#79d356', SKD = '#4f9e3a', SKL = '#b4f08a';
  const SH = '#b8742f', SHD = '#7c4718', SHL = '#efb45e', RIM = '#f7dc8a';
  const BL = '#2a63ea', BLD = '#1a3a9e', BLL = '#7fb2ff';
  const BELLY = '#f4e2a6', BELLYD = '#d2b46c', SHOE = '#ee4b3b', SHOED = '#a3241c', SOLE = '#fff3e0';
  for (let f = 0; f < N; f++) {
    const p = new Pix(F, F);
    const run = f >= 2 && f <= 5 ? f - 2 : -1;
    const bob = f === 1 ? 1 : (run === 1 || run === 3) ? -1 : 0;
    const air = f >= 6;
    // legs (drawn first, behind body)
    let L1 = [0, 0], L2 = [0, 0]; // [dx, lift]
    if (run === 0) { L1 = [4, 1]; L2 = [-3, 0]; }
    if (run === 1) { L1 = [1, 2]; L2 = [-1, 0]; }
    if (run === 2) { L1 = [-3, 0]; L2 = [4, 1]; }
    if (run === 3) { L1 = [-1, 0]; L2 = [1, 2]; }
    if (f === 6) { L1 = [3, 4]; L2 = [-1, 3]; }
    if (f === 7) { L1 = [2, -1]; L2 = [-2, 0]; }
    const leg = (dx, lift, back) => {
      const lx = 15 + dx, ly = 25 + bob - lift;
      p.rect(lx, ly, 3, 4 - Math.max(0, lift - 2), back ? SKD : SK);
      const sy = 28 + bob - lift;
      p.rect(lx - 1, sy, 6, 3, back ? SHOED : SHOE); p.rect(lx - 1, sy + 2, 6, 1, back ? '#7d1a14' : SOLE);
      p.set(lx + 3, sy, back ? SHOED : '#ff8a74');
    };
    leg(L2[0] - 2, L2[1], true);
    // shell on the back (left side, facing right)
    const scx = 12, scy = 18 + bob;
    p.ell(scx, scy, 7.2, 8.6, SH, (dx, dy, d) => d > 0.72 ? SHD : (dx < -0.2 && dy < -0.1 && d < 0.5) ? SHL : SH);
    // shell plates
    p.line(scx - 5, scy - 2, scx + 3, scy - 2, SHD); p.line(scx - 5, scy + 3, scx + 3, scy + 3, SHD);
    p.line(scx - 1, scy - 7, scx - 1, scy - 2, SHD); p.line(scx + 1, scy + 3, scx + 1, scy + 7, SHD);
    p.set(scx - 4, scy - 5, RIM); p.set(scx - 5, scy - 4, RIM); p.set(scx - 3, scy - 6, RIM);
    // body + belly plate
    p.ell(17, 21 + bob, 5.2, 6.2, SK, (dx, dy, d) => d > 0.7 && dx < 0 ? SKD : SK);
    p.ell(18.5, 21.5 + bob, 3.4, 5.2, BELLY, (dx, dy, d) => (d > 0.65 && dx > 0) ? BELLYD : BELLY);
    p.line(16, 20 + bob, 21, 20 + bob, BELLYD); p.line(16, 23 + bob, 21, 23 + bob, BELLYD);
    // shell rim strap over shoulder
    p.line(13, 13 + bob, 18, 16 + bob, SHD);
    leg(L1[0], L1[1], false);
    // head
    const hx = 20, hy = 9.5 + bob + (air ? -1 : 0);
    p.ell(hx, hy, 6.8, 6.4, SK, (dx, dy, d) => (dx < -0.4 && dy > 0.3) || d > 0.82 && dy > 0 ? SKD : (dx > 0.1 && dy < -0.35 && d < 0.6) ? SKL : SK);
    // bandana band across eyes + knot and tails
    const by = Math.round(hy - 2);
    for (let i = -7; i <= 7; i++) { const yy = by + (i < -3 ? 1 : 0); p.rect(hx + i, yy, 1, 3, i > 4 ? BLL : BL); p.set(hx + i, yy + 2, BLD); }
    for (let i = -6; i <= 5; i++) p.set(hx + i, by, BLL);
    // re-clip band to head silhouette (only where head pixels or near)
    // tails flapping behind
    const wave = air ? -2 : [0, 1, 2, 1][(run < 0 ? f : run) % 4];
    const kx = hx - 7, ky = by + 1;
    p.rect(kx - 1, ky - 1, 2, 3, BLD);
    p.line(kx - 1, ky, kx - 6, ky - 1 + wave, BL); p.line(kx - 1, ky + 1, kx - 6, ky + wave, BL);
    p.line(kx - 1, ky + 1, kx - 5, ky + 3 + wave, BLD); p.line(kx - 1, ky + 2, kx - 5, ky + 4 + wave, BL);
    // eye
    const ex = hx + 2, ey = by;
    p.rect(ex, ey, 3, 3, '#ffffff'); p.rect(ex + 1, ey + 1, 2, 2, '#16122c'); p.set(ex + 1, ey + 1, '#ffffff');
    // mouth / cheek
    if (air) { p.rect(hx + 3, hy + 3, 2, 2, '#3b1d2a'); } else { p.line(hx + 2, hy + 3, hx + 5, hy + 3, '#2d5a26'); }
    p.set(hx + 1, hy + 2, '#ff9d8a');
    // arm
    let ax = 18, ay = 17 + bob, ax2 = 22, ay2 = 20 + bob;
    if (run === 0) { ax2 = 20; ay2 = 21 + bob; } if (run === 2) { ax2 = 23; ay2 = 18 + bob; }
    if (f === 6) { ax2 = 23; ay2 = 12; } if (f === 7) { ax2 = 25; ay2 = 16; }
    p.line(ax, ay, ax2, ay2, SK); p.line(ax, ay + 1, ax2, ay2 + 1, SKD);
    p.rect(ax2, ay2 - 1, 2, 2, SKL);
    p.outline(OUT);
    p.blit(x, f * F, 0);
  }
  return c;
}

// ---------------- Crystal beetle: 0-1 walk, 2 squashed ----------------
export function beetleSheet() {
  const F = 32, N = 3, { c, x } = makeFrameCtx(F * N, F);
  const B = '#3b2675', BD = '#231549', BL = '#6a4cc0', CR = '#ff5ad8', CRD = '#a72ad0', CRL = '#ffd0f6', EYE = '#7ff8ff';
  for (let f = 0; f < N; f++) {
    const p = new Pix(F, F);
    const sq = f === 2, by = sq ? 26 : 22;
    // legs
    if (!sq) {
      const o = f === 0 ? 1 : -1;
      for (const lx of [9, 15, 21]) { p.line(lx, by + 3, lx - 2 * o, 29, BD); p.line(lx + 1, by + 3, lx + 1 - 2 * o, 29, BD); p.set(lx - 2 * o, 30, BD); p.set(lx - 2 * o + 1, 30, BD); o === 1 ? 0 : 0; }
    }
    // body
    p.ell(15, by, 10.5, sq ? 3.5 : 6, B, (dx, dy, d) => dy > 0.45 ? BD : (dy < -0.3 && dx < 0.2 && d < 0.55) ? BL : B);
    // crystal spikes on back
    const spikes = sq ? [[8, 2], [13, 3], [18, 2]] : [[7, 6], [12, 9], [17, 7], [21, 4]];
    for (const [sx, sh] of spikes) {
      const top = by - (sq ? 3 : 5) - sh;
      for (let yy = top; yy <= by - 3; yy++) {
        const t = (yy - top) / Math.max(1, by - 3 - top), w = Math.max(0, Math.round(t * 2.6));
        for (let i = -w; i <= w; i++) p.set(sx + i, yy, i < 0 ? CRL : i === 0 ? CR : CRD);
      }
      p.set(sx, top, '#ffffff');
    }
    // head
    p.ell(26, by + 1, 4, sq ? 2.5 : 3.8, BD);
    p.rect(27, by - (sq ? 0 : 1), 2, sq ? 1 : 2, EYE); p.set(28, by - (sq ? 0 : 1), '#ffffff');
    p.line(29, by + 2, 31, by + 4, BD); // mandible
    p.outline(OUT);
    p.blit(x, f * F, 0);
  }
  return c;
}

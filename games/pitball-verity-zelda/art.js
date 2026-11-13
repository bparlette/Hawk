/* PITBALL — HYRULE — art module (PV_ART)
 * Painted Zelda retheme of Pitball Verity Level 1. Everything is drawn with
 * visible brush work: sprites and the backdrop are PRE-RENDERED to offscreen
 * canvases at load / first use (dab strokes, painterly palette), then blitted
 * per frame — no per-frame filters, full speed.
 *   walker   -> Armos stone statue head (weathered, mossy, amber eyes)
 *   runner   -> swift orange Chuchu jelly
 *   splitter -> big green Chuchu with twin cores (splits into mini Chuchus)
 *   mini     -> mini Chuchu
 *   brute    -> great Armos guardian (not in L1's table; drawn for completeness)
 *   orbs     -> Bomb-Flower bombs: dark sphere, brass cap, sparking fuse
 *   XP shard -> green rupee; salvage shard -> gold rupee
 */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + (k || 0) * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 1) { r = lerp(r, 255, f - 1); g = lerp(g, 255, f - 1); b = lerp(b, 255, f - 1); }
    else { r *= f; g *= f; b *= f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function crack(ctx, x, y, len, ang, seed) {
    const rnd = mulberry32(seed);
    const segs = 3 + (rnd() * 3 | 0);
    let px = x, py = y, a = ang;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < segs; i++) {
      const step = len / segs * (0.7 + rnd() * 0.6);
      a += (rnd() - 0.5) * 1.1;
      px += Math.cos(a) * step;
      py += Math.sin(a) * step;
      ctx.lineTo(px, py);
      if (rnd() < 0.4) {
        const bx = px, by = py, ba = a + (rnd() < 0.5 ? 0.9 : -0.9);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ba) * step * 0.45, by + Math.sin(ba) * step * 0.45);
        ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
  }
  /* one visible brush dab: a short, slightly curved, round-capped stroke */
  function dab(ctx, x, y, len, ang, w, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + len * 0.08,
      x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
    ctx.restore();
  }
  /* scatter dabs inside a rect (caller clips if a shape is needed) */
  function dabFill(ctx, x, y, w, h, colors, n, seed, lenMin, lenMax, wMin, wMax, angBase, angVar, aMin, aMax) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      dab(ctx,
        x + rnd() * w, y + rnd() * h,
        lenMin + rnd() * (lenMax - lenMin),
        angBase + (rnd() - 0.5) * angVar,
        wMin + rnd() * (wMax - wMin),
        colors[(rnd() * colors.length) | 0],
        aMin + rnd() * (aMax - aMin));
    }
  }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  const GRASS = ['#6da344', '#7fb54f', '#598c36', '#4a7a2c', '#8fbf62'];
  const GRASS_DARK = ['#3e6b26', '#355e21', '#2c5220'];
  const DIRT = ['#8a6a42', '#75572f', '#9c7c4e', '#654a2a'];
  const STONE_TONES = ['#8d9484', '#7a8271', '#9aa38f', '#6b7461', '#a8b09c'];

  /* ================= BACKDROP — painted Hyrule crater floor ================= */
  const bgCache = new Map();
  function renderBackdrop(W, H) {
    const cv = mkCanvas(Math.max(2, Math.round(W)), Math.max(2, Math.round(H)));
    const ctx = cv.getContext('2d');
    const rnd = mulberry32(1207);
    // grass base
    ctx.fillStyle = '#527f33';
    ctx.fillRect(0, 0, W, H);
    // large soft light/shadow blotches (painted light, not a filter)
    for (let i = 0; i < 12; i++) {
      const x = rnd() * W, y = rnd() * H, r = 60 + rnd() * 150;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const lite = rnd() < 0.5;
      g.addColorStop(0, lite ? 'rgba(168,214,110,0.20)' : 'rgba(30,58,18,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // worn dirt patches — crater floor shows earth where the horde marches
    for (let i = 0; i < 16; i++) {
      const cx = W * (0.14 + rnd() * 0.72), cy = rnd() * H;
      const rw = 22 + rnd() * 54, rh = rw * (0.5 + rnd() * 0.5);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, rnd() * 3, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(122,92,54,0.55)';
      ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2);
      dabFill(ctx, cx - rw, cy - rh, rw * 2, rh * 2, DIRT, 46, 3100 + i * 7, 4, 11, 1.6, 3.4, 0.4, 1.6, 0.35, 0.75);
      ctx.restore();
    }
    // the grass itself: thousands of short strokes
    dabFill(ctx, 0, 0, W, H, GRASS, 2500, 4101, 3, 8, 1.1, 2.3, -Math.PI / 2, 0.9, 0.22, 0.55);
    dabFill(ctx, 0, 0, W, H, GRASS_DARK, 800, 4202, 3, 7, 1.1, 2.1, -Math.PI / 2, 0.9, 0.18, 0.4);
    // tiny field stones
    for (let i = 0; i < 42; i++) {
      const x = rnd() * W, y = rnd() * H, s = 2 + rnd() * 4.5;
      dab(ctx, x, y, s, 0.3, s * 0.8, '#9aa38f', 0.8);
      dab(ctx, x, y - s * 0.3, s * 0.5, 0.2, s * 0.35, '#c9cfbc', 0.8);
    }
    // sparse wildflowers near the edges
    for (let i = 0; i < 30; i++) {
      const edge = rnd();
      const x = edge < 0.5 ? rnd() * W * 0.16 : W - rnd() * W * 0.16;
      const y = rnd() * H;
      ctx.fillStyle = ['#ffffff', '#ffd94d', '#ffb7d5'][(rnd() * 3) | 0];
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd() * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // grain speckle
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(20,40,10,0.10)' : 'rgba(230,255,190,0.08)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.6 + rnd() * 2, 1.6 + rnd() * 2);
    }
    // depth: the crater's far end falls into soft shadow; hero's end is warm
    const gt = ctx.createLinearGradient(0, 0, 0, H * 0.36);
    gt.addColorStop(0, 'rgba(14,30,10,0.34)');
    gt.addColorStop(1, 'rgba(14,30,10,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H * 0.36);
    const gb = ctx.createLinearGradient(0, H * 0.74, 0, H);
    gb.addColorStop(0, 'rgba(255,214,110,0)');
    gb.addColorStop(1, 'rgba(255,214,110,0.13)');
    ctx.fillStyle = gb; ctx.fillRect(0, H * 0.74, W, H * 0.26);
    return cv;
  }
  function fleckPos(i, W, H, seed) { return [hash2(i, 11, seed) * W, hash2(i, 77, seed) * H]; }
  function drawBackdrop(ctx, scene, W, H, t) {
    const key = 'hyrule:' + Math.round(W) + 'x' + Math.round(H);
    let cv = bgCache.get(key);
    if (!cv) { cv = renderBackdrop(W, H); bgCache.set(key, cv); }
    ctx.drawImage(cv, 0, 0);
    // drifting pollen motes in the painted light
    t = t || 0;
    for (let i = 0; i < 16; i++) {
      const p = fleckPos(i, W, H, 42);
      const dx = Math.sin(t * 0.4 + i * 1.9) * 9, dy = Math.cos(t * 0.3 + i * 2.6) * 6;
      const a = 0.16 + 0.30 * Math.abs(Math.sin(t * 0.9 + i * 1.7));
      ctx.fillStyle = 'rgba(255,246,190,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p[0] + dx, p[1] + dy, 1.3 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ================= PIT FRAME — cliff walls, ruins, vines (cached) ======= */
  let rockTile = null;
  function getRockTile() {
    if (rockTile) return rockTile;
    const cv = mkCanvas(160, 320), ctx = cv.getContext('2d');
    ctx.fillStyle = '#6f5a3d';
    ctx.fillRect(0, 0, 160, 320);
    dabFill(ctx, 0, 0, 160, 320, ['#7d6647', '#63503a', '#8a7350', '#57462f'], 260, 5101, 5, 14, 2.2, 4.6, 0.2, 1.4, 0.3, 0.7);
    dabFill(ctx, 0, 0, 160, 320, STONE_TONES, 60, 5202, 4, 10, 1.8, 3.6, 0.2, 1.4, 0.18, 0.42);
    const rnd = mulberry32(5303);
    ctx.strokeStyle = 'rgba(30,22,12,0.5)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) crack(ctx, rnd() * 160, rnd() * 320, 26 + rnd() * 30, rnd() * 6.28, 5400 + i * 13);
    rockTile = cv;
    return cv;
  }
  const frameCache = new Map();
  function renderPitFrame(geo) {
    const { pitLeft, pitRight, W, H } = geo;
    const cv = mkCanvas(Math.max(2, Math.ceil(W)), H), ctx = cv.getContext('2d');
    const tile = getRockTile();
    function wallPath(side) {
      ctx.beginPath();
      if (side === 'L') {
        ctx.moveTo(0, 0);
        for (let y = 0; y <= H; y += 16) ctx.lineTo(pitLeft(y), y);
        ctx.lineTo(0, H);
      } else {
        ctx.moveTo(W, 0);
        for (let y = 0; y <= H; y += 16) ctx.lineTo(pitRight(y), y);
        ctx.lineTo(W, H);
      }
      ctx.closePath();
    }
    for (const side of ['L', 'R']) {
      ctx.save();
      wallPath(side); ctx.clip();
      // rock texture fill
      for (let ty = 0; ty < H; ty += 320)
        for (let tx = -40; tx < W + 40; tx += 160) ctx.drawImage(tile, tx + (side === 'R' ? 60 : 0), ty);
      // painted shading: dark at the crater top, sunlit lower
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(16,26,8,0.42)');
      g.addColorStop(0.4, 'rgba(16,26,8,0.05)');
      g.addColorStop(1, 'rgba(255,220,130,0.10)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // inner edge: dark seam, then a grass lip fringe hanging over the pit
      ctx.strokeStyle = 'rgba(24,18,8,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= H; y += 16) { const x = side === 'L' ? pitLeft(y) : pitRight(y); y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      const dir = side === 'L' ? 1 : -1;
      const rnd = mulberry32(side === 'L' ? 6101 : 6102);
      for (let y = 4; y < H; y += 7) {
        const ex = (side === 'L' ? pitLeft(y) : pitRight(y)) + dir * (1 + rnd() * 3);
        dab(ctx, ex, y, 4 + rnd() * 6, dir > 0 ? 2.6 : 0.55, 2 + rnd() * 1.6, GRASS[(rnd() * GRASS.length) | 0], 0.75);
      }
    }
    // broken ruins: fallen carved blocks along the wall bases + top corners
    const rnd = mulberry32(6606);
    const spots = [];
    for (let i = 0; i < 7; i++) spots.push({ side: i % 2 ? 'R' : 'L', y: 40 + rnd() * (H - 140), s: 13 + rnd() * 15 });
    spots.push({ side: 'L', y: 26, s: 20 }, { side: 'R', y: 26, s: 17 });
    for (const sp of spots) {
      const edge = sp.side === 'L' ? pitLeft(sp.y) : pitRight(sp.y);
      const cx = sp.side === 'L' ? edge - sp.s * 0.25 : edge + sp.s * 0.25;
      ctx.save();
      ctx.translate(cx, sp.y); ctx.rotate((rnd() - 0.5) * 0.5);
      ctx.fillStyle = '#7a8271';
      rr(ctx, -sp.s / 2, -sp.s / 2, sp.s, sp.s * 0.82, 3); ctx.fill();
      ctx.save();
      rr(ctx, -sp.s / 2, -sp.s / 2, sp.s, sp.s * 0.82, 3); ctx.clip();
      dabFill(ctx, -sp.s / 2, -sp.s / 2, sp.s, sp.s * 0.82, STONE_TONES, 22, 6700 + (sp.y | 0), 3, 7, 1.2, 2.4, 0.3, 1.2, 0.3, 0.6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(30,36,26,0.8)'; ctx.lineWidth = 1.4;
      rr(ctx, -sp.s / 2, -sp.s / 2, sp.s, sp.s * 0.82, 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,36,26,0.55)'; ctx.lineWidth = 1.1;
      crack(ctx, -sp.s * 0.2, -sp.s * 0.3, sp.s * 0.7, 1.8, 6800 + (sp.y | 0));
      // moss cap + a carved glyph line (ruin writing)
      dab(ctx, -sp.s * 0.4, -sp.s * 0.42, sp.s * 0.5, 0.2, 2.6, '#598c36', 0.85);
      ctx.strokeStyle = 'rgba(38,44,32,0.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-sp.s * 0.22, sp.s * 0.05); ctx.lineTo(sp.s * 0.22, sp.s * 0.05); ctx.stroke();
      ctx.restore();
    }
    // hanging vines from the crater rim, down the upper walls
    const rv = mulberry32(6909);
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 'R' : 'L';
      const y0 = rv() * H * 0.3;
      const len = 40 + rv() * 110;
      const edge = side === 'L' ? pitLeft(y0) : pitRight(y0);
      const x = side === 'L' ? edge - 3 : edge + 3;
      ctx.strokeStyle = 'rgba(46,84,28,0.9)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + (rv() - 0.5) * 10, y0 + len * 0.55, x + (rv() - 0.5) * 7, y0 + len);
      ctx.stroke();
      for (let l = 0; l < 6; l++) {
        const ly = y0 + (l + 0.7) * len / 6.6, lx = x + (rv() - 0.5) * 8;
        dab(ctx, lx, ly, 5 + rv() * 4, rv() * 0.9 - 0.45 + (side === 'L' ? 0.4 : 2.6), 2.2, GRASS[(rv() * GRASS.length) | 0], 0.9);
      }
    }
    return cv;
  }
  function frameSig(geo) {
    let s = geo.W.toFixed(1) + '|';
    for (let y = 0; y <= geo.H; y += 120) s += geo.pitLeft(y).toFixed(1) + ',' + geo.pitRight(y).toFixed(1) + ';';
    return s;
  }
  function drawPitFrame(ctx, geo) {
    const sig = frameSig(geo);
    let cv = frameCache.get(sig);
    if (!cv) { cv = renderPitFrame(geo); frameCache.set(sig, cv); }
    ctx.drawImage(cv, 0, 0);
  }

  /* ================= DEFLECTORS — mossy ruin slabs ======================== */
  function drawDeflector(ctx, sg, t) {
    ctx.save();
    ctx.lineCap = 'round';
    // soft shadow
    ctx.strokeStyle = 'rgba(10,20,5,0.30)';
    ctx.lineWidth = sg.r * 2;
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1 + 4); ctx.lineTo(sg.x2, sg.y2 + 4); ctx.stroke();
    // rock body
    ctx.strokeStyle = '#6f5a3d';
    ctx.lineWidth = sg.r * 2;
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    // painted stone dabs along the slab
    const dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const rnd = mulberry32(((sg.x1 * 7 + sg.y1 * 13) | 0) + 77);
    for (let d = 4; d < len - 2; d += 5) {
      const px = sg.x1 + ux * d, py = sg.y1 + uy * d;
      dab(ctx, px + (rnd() - 0.5) * 4, py + (rnd() - 0.5) * 4, 4 + rnd() * 5, Math.atan2(uy, ux) + (rnd() - 0.5) * 0.5, 2.4 + rnd() * 2, STONE_TONES[(rnd() * STONE_TONES.length) | 0], 0.5);
    }
    // sunlit top edge
    ctx.strokeStyle = 'rgba(240,230,190,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sg.x1 - uy * sg.r * 0.62, sg.y1 + ux * sg.r * 0.62); ctx.lineTo(sg.x2 - uy * sg.r * 0.62, sg.y2 + ux * sg.r * 0.62); ctx.stroke();
    // moss creeping on top + worn gold ruin-marking down the middle
    for (let d = 6; d < len - 4; d += 9) {
      if (rnd() < 0.4) continue;
      dab(ctx, sg.x1 + ux * d, sg.y1 + uy * d - sg.r * 0.55, 4 + rnd() * 4, 0.3, 2.2, GRASS[(rnd() * GRASS.length) | 0], 0.8);
    }
    ctx.strokeStyle = 'rgba(255,217,77,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ================= HERO — Link, top-down (pre-rendered) ================= */
  const HERO_BOX = 176, HERO_DESIGN = 120;   // sprite canvas / design size used inside
  let heroSprites = null;
  function drawLinkFigure(c, s, firing) {
    // drawn centred at 0,0 in design units (s = hero size, engine calls ~64)
    const u = s / 64;
    // boots, south
    c.fillStyle = '#6e4f2a';
    rr(c, -0.24 * s, 0.26 * s, 0.19 * s, 0.20 * s, 3 * u); c.fill();
    rr(c, 0.05 * s, 0.26 * s, 0.19 * s, 0.20 * s, 3 * u); c.fill();
    c.fillStyle = '#8a6a42';
    rr(c, -0.24 * s, 0.26 * s, 0.19 * s, 0.07 * s, 3 * u); c.fill();
    rr(c, 0.05 * s, 0.26 * s, 0.19 * s, 0.07 * s, 3 * u); c.fill();
    // tunic torso (painted green strokes over a base)
    c.fillStyle = '#3e8e3a';
    rr(c, -0.30 * s, -0.04 * s, 0.60 * s, 0.38 * s, 5 * u); c.fill();
    c.save();
    rr(c, -0.30 * s, -0.04 * s, 0.60 * s, 0.38 * s, 5 * u); c.clip();
    dabFill(c, -0.30 * s, -0.04 * s, 0.60 * s, 0.38 * s, ['#4da344', '#35702e', '#5cb85a'], 26, 7101, 4, 9, 1.6, 3, 0.4, 1.2, 0.3, 0.6);
    c.restore();
    // belt + gold buckle
    c.fillStyle = '#6e4f2a';
    c.fillRect(-0.30 * s, 0.20 * s, 0.60 * s, 0.09 * s);
    c.fillStyle = '#ffd94d';
    rr(c, -0.06 * s, 0.205 * s, 0.12 * s, 0.08 * s, 1.5 * u); c.fill();
    // LEFT arm + shield (west) — steel shield, gold triangle emblem
    c.fillStyle = '#e8c39a';
    c.beginPath(); c.arc(-0.38 * s, 0.02 * s, 0.11 * s, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(-0.46 * s, -0.02 * s);
    const shw = 0.34 * s, shh = 0.42 * s;
    c.beginPath();
    c.moveTo(-shw / 2, -shh / 2);
    c.lineTo(shw / 2, -shh / 2);
    c.lineTo(shw / 2, shh * 0.08);
    c.quadraticCurveTo(shw / 2, shh * 0.38, 0, shh / 2);
    c.quadraticCurveTo(-shw / 2, shh * 0.38, -shw / 2, shh * 0.08);
    c.closePath();
    c.fillStyle = '#7d8ea3'; c.fill();
    c.save(); c.clip();
    dabFill(c, -shw / 2, -shh / 2, shw, shh, ['#93a7bd', '#67798e', '#aebfd2'], 20, 7202, 3, 7, 1.4, 2.6, 0.4, 1.2, 0.3, 0.6);
    c.restore();
    c.strokeStyle = '#33404f'; c.lineWidth = 2 * u; c.stroke();
    c.strokeStyle = '#c8452c'; c.lineWidth = 2.4 * u;
    c.beginPath(); c.moveTo(-shw / 2 + 2, -shh / 2 + 3); c.lineTo(shw / 2 - 2, -shh / 2 + 3); c.stroke();
    // gold triangle emblem
    c.fillStyle = '#ffd94d';
    c.beginPath();
    c.moveTo(0, -shh * 0.16);
    c.lineTo(shw * 0.20, shh * 0.14);
    c.lineTo(-shw * 0.20, shh * 0.14);
    c.closePath(); c.fill();
    c.strokeStyle = '#a86f14'; c.lineWidth = 1 * u; c.stroke();
    c.restore();
    // RIGHT arm + sword (north) — raised higher when firing
    const lift = firing ? 0.10 * s : 0;
    c.fillStyle = '#3e8e3a';
    c.beginPath(); c.arc(0.38 * s, -0.04 * s - lift, 0.115 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8c39a';
    c.beginPath(); c.arc(0.42 * s, -0.14 * s - lift, 0.085 * s, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(0.43 * s, -0.16 * s - lift);
    c.rotate(0.10);
    // blade
    c.beginPath();
    c.moveTo(-0.045 * s, -0.06 * s);
    c.lineTo(0, -0.52 * s);
    c.lineTo(0.045 * s, -0.06 * s);
    c.closePath();
    const bg = c.createLinearGradient(-0.045 * s, 0, 0.045 * s, 0);
    bg.addColorStop(0, '#aebfd2'); bg.addColorStop(0.5, '#f4fafe'); bg.addColorStop(1, '#8496ab');
    c.fillStyle = bg; c.fill();
    c.strokeStyle = '#54687e'; c.lineWidth = 1.1 * u; c.stroke();
    // guard + grip
    c.fillStyle = '#ffd94d';
    rr(c, -0.10 * s, -0.075 * s, 0.20 * s, 0.045 * s, 2 * u); c.fill();
    c.fillStyle = '#5a3d1e';
    rr(c, -0.028 * s, -0.03 * s, 0.056 * s, 0.11 * s, 2 * u); c.fill();
    c.restore();
    // pointy ears (west / east)
    c.fillStyle = '#e8c39a';
    c.beginPath(); c.moveTo(-0.20 * s, -0.16 * s); c.lineTo(-0.40 * s, -0.22 * s); c.lineTo(-0.21 * s, -0.05 * s); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.20 * s, -0.16 * s); c.lineTo(0.40 * s, -0.22 * s); c.lineTo(0.21 * s, -0.05 * s); c.closePath(); c.fill();
    c.fillStyle = 'rgba(216,120,110,0.65)';
    c.beginPath(); c.moveTo(-0.235 * s, -0.145 * s); c.lineTo(-0.335 * s, -0.185 * s); c.lineTo(-0.24 * s, -0.09 * s); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.235 * s, -0.145 * s); c.lineTo(0.335 * s, -0.185 * s); c.lineTo(0.24 * s, -0.09 * s); c.closePath(); c.fill();
    // head: hair + face sliver at the north rim
    const hg = c.createRadialGradient(-0.06 * s, -0.20 * s, s * 0.05, 0, -0.10 * s, s * 0.34);
    hg.addColorStop(0, '#ffe9b8');
    hg.addColorStop(0.6, '#eec25e');
    hg.addColorStop(1, '#d9a83c');
    c.fillStyle = hg;
    c.beginPath(); c.arc(0, -0.10 * s, 0.30 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f2d5a0';
    c.beginPath(); c.arc(0, -0.155 * s, 0.185 * s, 0, Math.PI * 2); c.fill();
    // eyes (determined, looking up-pit)
    c.fillStyle = '#20301e';
    rr(c, -0.105 * s, -0.20 * s, 0.045 * s, 0.075 * s, 2 * u); c.fill();
    rr(c, 0.06 * s, -0.20 * s, 0.045 * s, 0.075 * s, 2 * u); c.fill();
    // hair fringe strokes
    dabFill(c, -0.20 * s, -0.30 * s, 0.40 * s, 0.13 * s, ['#f7d774', '#e9bd45', '#fff0ae'], 10, 7303, 3, 6, 1.2, 2.2, 0.5, 1.4, 0.5, 0.85);
    // THE CAP: covers the crown, long tail flowing SOUTH over the back
    c.fillStyle = '#2f7d32';
    c.beginPath();
    c.moveTo(-0.27 * s, -0.13 * s);
    c.quadraticCurveTo(0, -0.44 * s, 0.27 * s, -0.13 * s);
    c.quadraticCurveTo(0.14 * s, -0.02 * s, 0, -0.02 * s);
    c.quadraticCurveTo(-0.14 * s, -0.02 * s, -0.27 * s, -0.13 * s);
    c.closePath(); c.fill();
    c.save();
    c.beginPath();
    c.moveTo(-0.10 * s, -0.06 * s);
    c.quadraticCurveTo(-0.13 * s, 0.30 * s, -0.045 * s, 0.52 * s);
    c.quadraticCurveTo(0, 0.58 * s, 0.045 * s, 0.52 * s);
    c.quadraticCurveTo(0.13 * s, 0.30 * s, 0.10 * s, -0.06 * s);
    c.closePath();
    c.fillStyle = '#2f7d32'; c.fill(); c.clip();
    dabFill(c, -0.13 * s, -0.06 * s, 0.26 * s, 0.62 * s, ['#3f9e42', '#256b27', '#57b95a'], 16, 7404, 4, 9, 1.8, 3.4, Math.PI / 2, 0.5, 0.3, 0.6);
    c.restore();
    c.strokeStyle = 'rgba(20,60,20,0.55)'; c.lineWidth = 1.3 * u;
    c.beginPath();
    c.moveTo(-0.27 * s, -0.13 * s);
    c.quadraticCurveTo(0, -0.44 * s, 0.27 * s, -0.13 * s);
    c.stroke();
    if (firing) {
      const mg = c.createRadialGradient(0.43 * s, -0.68 * s - lift, 0, 0.43 * s, -0.68 * s - lift, 0.30 * s);
      mg.addColorStop(0, 'rgba(255,246,190,0.95)');
      mg.addColorStop(0.4, 'rgba(255,217,77,0.5)');
      mg.addColorStop(1, 'rgba(255,217,77,0)');
      c.fillStyle = mg;
      c.beginPath(); c.arc(0.43 * s, -0.68 * s - lift, 0.30 * s, 0, Math.PI * 2); c.fill();
    }
  }
  function getHeroSprites() {
    if (heroSprites) return heroSprites;
    const mk = (firing) => {
      const cv = mkCanvas(HERO_BOX, HERO_BOX), c = cv.getContext('2d');
      c.translate(HERO_BOX / 2, HERO_BOX / 2);
      drawLinkFigure(c, HERO_DESIGN, firing);
      return cv;
    };
    heroSprites = { idle: mk(false), fire: mk(true) };
    return heroSprites;
  }
  function drawHero(ctx, x, y, s, t, firing) {
    t = t || 0;
    const sp = getHeroSprites();
    const bob = Math.sin(t * 2.3) * 1.1;
    ctx.fillStyle = 'rgba(8,18,4,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.40, s * 0.46, s * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    const box = s * (HERO_BOX / HERO_DESIGN);
    ctx.drawImage(firing ? sp.fire : sp.idle, x - box / 2, y - box / 2 + bob, box, box);
  }

  /* ================= ENEMIES — Armos heads & Chuchus (pre-rendered) ======= */
  const EN_BOX = 192, EN_DESIGN = 132;
  const enCache = new Map();

  function paintStoneHead(c, s, o) {
    // plinth
    c.fillStyle = shade('#8d9484', o.tint * 0.66);
    rr(c, -0.58 * s, -0.58 * s, 1.16 * s, 1.16 * s, 0.10 * s); c.fill();
    c.strokeStyle = 'rgba(30,36,26,0.65)'; c.lineWidth = Math.max(1, s * 0.02);
    rr(c, -0.58 * s, -0.58 * s, 1.16 * s, 1.16 * s, 0.10 * s); c.stroke();
    c.fillStyle = 'rgba(240,246,230,0.35)';
    c.fillRect(-0.52 * s, -0.58 * s, 1.04 * s, 0.045 * s);
    // head block
    const hx = -0.46 * s, hy = -0.54 * s, hw = 0.92 * s, hh = 1.02 * s;
    c.fillStyle = shade('#8d9484', o.tint);
    rr(c, hx, hy, hw, hh, 0.13 * s); c.fill();
    c.save();
    rr(c, hx, hy, hw, hh, 0.13 * s); c.clip();
    dabFill(c, hx, hy, hw, hh, STONE_TONES, 110, o.seed, 4, 11, 1.8, 3.8, 0.3, 1.3, 0.16, 0.4);
    // weather streaks running down
    dabFill(c, hx, hy, hw, hh * 0.7, ['#6b7461', '#79826e'], 22, o.seed + 4, 6, 14, 1.4, 2.6, Math.PI / 2, 0.4, 0.14, 0.3);
    c.restore();
    c.strokeStyle = '#2e362a'; c.lineWidth = Math.max(1.4, s * 0.03);
    rr(c, hx, hy, hw, hh, 0.13 * s); c.stroke();
    // moss cap + side patches
    const mrnd = mulberry32(o.seed + 8);
    for (let i = 0; i < 16; i++)
      dab(c, hx + mrnd() * hw, hy + mrnd() * hh * 0.16, 4 + mrnd() * 6, 0.3, 2.2 + mrnd() * 1.6, GRASS[(mrnd() * GRASS.length) | 0], 0.8);
    for (let i = 0; i < o.moss; i++)
      dab(c, hx + (i % 2 ? hw * 0.86 : hw * 0.05), hy + hh * (0.3 + mrnd() * 0.4), 5 + mrnd() * 5, 1.4, 2.4, '#598c36', 0.7);
    // heavy brow ridge
    c.fillStyle = shade('#8d9484', o.tint * (o.heavyBrow ? 0.62 : 0.78));
    rr(c, hx + hw * 0.09, -0.28 * s, hw * 0.82, (o.heavyBrow ? 0.17 : 0.12) * s, 0.04 * s); c.fill();
    c.strokeStyle = 'rgba(38,44,32,0.6)'; c.lineWidth = 1;
    rr(c, hx + hw * 0.09, -0.28 * s, hw * 0.82, (o.heavyBrow ? 0.17 : 0.12) * s, 0.04 * s); c.stroke();
    // glowing amber eyes
    const ey = -0.09 * s, ex = 0.20 * s;
    for (const sgn of [-1, 1]) {
      const g = c.createRadialGradient(sgn * ex, ey, 0, sgn * ex, ey, 0.11 * s);
      g.addColorStop(0, 'rgba(255,176,46,0.85)');
      g.addColorStop(1, 'rgba(255,176,46,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(sgn * ex, ey, 0.11 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb02e';
      c.beginPath(); c.arc(sgn * ex, ey, Math.max(1.4, 0.042 * s), 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff3cf';
      c.beginPath(); c.arc(sgn * ex, ey, Math.max(0.7, 0.018 * s), 0, Math.PI * 2); c.fill();
    }
    // nose ridge + mouth slit
    c.strokeStyle = 'rgba(38,44,32,0.78)'; c.lineWidth = Math.max(1.1, s * 0.028);
    c.beginPath(); c.moveTo(0, ey + 0.03 * s); c.lineTo(0, 0.13 * s); c.lineTo(0.05 * s, 0.165 * s); c.stroke();
    c.strokeStyle = '#22301f'; c.lineWidth = Math.max(1.3, s * 0.038);
    c.beginPath(); c.moveTo(-0.15 * s, 0.25 * s); c.lineTo(0.15 * s, 0.25 * s); c.stroke();
    // carved cheek lines
    c.strokeStyle = 'rgba(38,44,32,0.42)'; c.lineWidth = Math.max(0.9, s * 0.02);
    for (let i = 0; i < o.cheekLines; i++) {
      const lx = hx + hw * (0.16 + i * 0.1);
      c.beginPath(); c.moveTo(lx, 0.06 * s); c.lineTo(lx + hw * 0.02, 0.28 * s); c.stroke();
      c.beginPath(); c.moveTo(hx + hw - hw * (0.16 + i * 0.1), 0.06 * s); c.lineTo(hx + hw - hw * (0.18 + i * 0.1), 0.28 * s); c.stroke();
    }
    // plinth band at the base of the head
    c.fillStyle = shade('#8d9484', o.tint * 0.74);
    rr(c, hx + hw * 0.04, 0.31 * s, hw * 0.92, 0.16 * s, 0.05 * s); c.fill();
    // damage: cracks + chips in 2 deepening states
    if (o.dmg >= 1) {
      c.strokeStyle = 'rgba(22,28,20,0.82)'; c.lineWidth = Math.max(1, s * 0.024);
      crack(c, hx + hw * 0.74, hy + hh * 0.08, hh * 0.4, 1.9, o.seed + 31);
      crack(c, hx + hw * 0.14, hy + hh * 0.88, hh * 0.3, -0.7, o.seed + 47);
      c.fillStyle = 'rgba(28,34,26,0.55)';
      c.beginPath(); c.moveTo(hx + hw, hy + hh); c.lineTo(hx + hw * 0.85, hy + hh); c.lineTo(hx + hw, hy + hh * 0.84); c.closePath(); c.fill();
    }
    if (o.dmg >= 2) {
      c.strokeStyle = 'rgba(18,24,16,0.9)'; c.lineWidth = Math.max(1.1, s * 0.03);
      crack(c, -0.05 * s, -0.28 * s, hh * 0.55, 1.35, o.seed + 71);
      crack(c, hx + hw * 0.3, hy + hh * 0.05, hh * 0.42, 2.2, o.seed + 97);
      c.fillStyle = 'rgba(28,34,26,0.6)';
      c.beginPath(); c.moveTo(hx, hy + hh); c.lineTo(hx + hw * 0.16, hy + hh); c.lineTo(hx, hy + hh * 0.82); c.closePath(); c.fill();
      if (o.coreGlow) {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.42 * s);
        g.addColorStop(0, 'rgba(255,150,50,0.28)');
        g.addColorStop(1, 'rgba(255,150,50,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, 0.42 * s, 0, Math.PI * 2); c.fill();
      }
    }
  }

  function blobPath(c, s, seed, squash) {
    const rnd = mulberry32(seed);
    const pts = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.5 * s * (1 + (rnd() - 0.5) * 0.09);
      pts.push([Math.cos(a) * r, Math.sin(a) * r * squash]);
    }
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) c.moveTo(mx, my);
      c.quadraticCurveTo(q[0], q[1], (q[0] + pts[(i + 2) % n][0]) / 2, (q[1] + pts[(i + 2) % n][1]) / 2);
    }
    c.closePath();
  }
  function paintChuchu(c, s, o) {
    const squash = o.dmg >= 2 ? 0.92 : 1;
    blobPath(c, s, o.seed, squash);
    const g = c.createRadialGradient(-0.14 * s, -0.22 * s, s * 0.06, 0, 0, s * 0.62);
    g.addColorStop(0, o.cols.light);
    g.addColorStop(0.55, o.cols.base);
    g.addColorStop(1, o.cols.dark);
    c.fillStyle = g; c.fill();
    c.save();
    blobPath(c, s, o.seed, squash); c.clip();
    dabFill(c, -0.5 * s, -0.5 * s, s, s, [o.cols.light, o.cols.dark, o.cols.base], 46, o.seed + 5, 4, 10, 2, 4.2, 0.5, 1.5, 0.14, 0.32);
    // glossy crown highlight
    c.fillStyle = 'rgba(255,255,255,0.38)';
    c.beginPath(); c.ellipse(-0.15 * s, -0.30 * s, 0.17 * s, 0.085 * s, -0.5, 0, Math.PI * 2); c.fill();
    // inner core glow(s)
    for (const cx of o.cores) {
      const cg = c.createRadialGradient(cx * s, 0.14 * s, 0, cx * s, 0.14 * s, 0.21 * s);
      cg.addColorStop(0, o.coreGlow);
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = cg;
      c.beginPath(); c.arc(cx * s, 0.14 * s, 0.21 * s, 0, Math.PI * 2); c.fill();
    }
    if (o.cores.length > 1) {   // splitter seam: the groove it will split along
      c.strokeStyle = 'rgba(20,60,16,0.45)'; c.lineWidth = Math.max(1.4, s * 0.03);
      c.beginPath(); c.moveTo(0, -0.46 * s);
      c.quadraticCurveTo(0.05 * s, 0, 0, 0.46 * s); c.stroke();
    }
    // damage: bruises, drips, squeezed eyes
    if (o.dmg >= 1) {
      dabFill(c, -0.4 * s, -0.2 * s, 0.8 * s, 0.6 * s, [o.cols.bruise], 4, o.seed + 61, 6, 12, 3, 5.4, 0.4, 1.4, 0.3, 0.45);
    }
    if (o.dmg >= 2) {
      dabFill(c, -0.45 * s, -0.3 * s, 0.9 * s, 0.8 * s, [o.cols.bruise], 7, o.seed + 67, 6, 13, 3, 6, 0.4, 1.4, 0.35, 0.5);
      c.strokeStyle = o.cols.dark; c.lineWidth = Math.max(1.2, s * 0.028);
      c.beginPath(); c.moveTo(-0.30 * s, -0.05 * s); c.lineTo(-0.28 * s, 0.16 * s); c.stroke();
      c.beginPath(); c.moveTo(0.33 * s, 0.02 * s); c.lineTo(0.31 * s, 0.22 * s); c.stroke();
    }
    c.restore();
    blobPath(c, s, o.seed, squash);
    c.strokeStyle = o.cols.line; c.lineWidth = Math.max(1.3, s * 0.026); c.stroke();
    // eyes, looking down-pit at the hero
    const ey = -0.15 * s, ex = 0.155 * s;
    for (const sgn of [-1, 1]) {
      if (o.dmg >= 2) {   // >_< squeezed shut
        c.strokeStyle = '#26301f'; c.lineWidth = Math.max(1.3, s * 0.032);
        c.beginPath();
        c.moveTo(sgn * ex - 0.055 * s, ey - 0.04 * s); c.lineTo(sgn * ex + 0.055 * s, ey + 0.04 * s);
        c.moveTo(sgn * ex - 0.055 * s, ey + 0.04 * s); c.lineTo(sgn * ex + 0.055 * s, ey - 0.04 * s);
        c.stroke();
      } else {
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(sgn * ex, ey, 0.075 * s, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#26301f';
        c.beginPath(); c.arc(sgn * ex, ey + 0.028 * s, 0.038 * s, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(sgn * ex - 0.012 * s, ey + 0.012 * s, 0.013 * s, 0, Math.PI * 2); c.fill();
        if (o.dmg >= 1) {   // one lid droops
          c.strokeStyle = '#26301f'; c.lineWidth = Math.max(1.1, s * 0.026);
          if (sgn < 0) { c.beginPath(); c.moveTo(sgn * ex - 0.07 * s, ey - 0.055 * s); c.lineTo(sgn * ex + 0.07 * s, ey - 0.045 * s); c.stroke(); }
        }
      }
    }
    // little open mouth
    c.strokeStyle = 'rgba(30,40,20,0.75)'; c.lineWidth = Math.max(1.1, s * 0.024);
    c.beginPath(); c.arc(0, 0.015 * s, 0.05 * s, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }

  const CHU_GREEN = { light: '#8fe06a', base: '#58c24a', dark: '#35912e', line: '#1f6b1c', bruise: '#2c7a35' };
  const CHU_ORANGE = { light: '#ffb066', base: '#ef7038', dark: '#c24e22', line: '#8f3413', bruise: '#a03d1c' };
  function enemySprite(kind, dmg, variant) {
    const key = kind + ':' + dmg + ':' + variant;
    let cv = enCache.get(key);
    if (cv) return cv;
    cv = mkCanvas(EN_BOX, EN_BOX);
    const c = cv.getContext('2d');
    c.translate(EN_BOX / 2, EN_BOX / 2);
    const s = EN_DESIGN, seed = 8000 + variant * 131 + dmg * 17;
    if (kind === 'walker' || kind === 'brute') {
      paintStoneHead(c, kind === 'brute' ? s * 1.06 : s, {
        tint: 0.94 + variant * 0.05, dmg, seed,
        heavyBrow: kind === 'brute', coreGlow: kind === 'brute',
        cheekLines: kind === 'brute' ? 1 : 1 + (variant % 2), moss: 2 + variant,
      });
    } else if (kind === 'runner') {
      paintChuchu(c, s * 0.92, { cols: CHU_ORANGE, dmg, seed, cores: [0], coreGlow: 'rgba(255,210,62,0.55)' });
    } else if (kind === 'splitter') {
      paintChuchu(c, s, { cols: CHU_GREEN, dmg, seed, cores: [-0.16, 0.16], coreGlow: 'rgba(182,255,158,0.55)' });
    } else { /* mini */
      paintChuchu(c, s * 0.86, { cols: Object.assign({}, CHU_GREEN, { light: '#a5ec82', base: '#6fce57' }), dmg, seed, cores: [0], coreGlow: 'rgba(182,255,158,0.5)' });
    }
    enCache.set(key, cv);
    return cv;
  }
  function drawEnemy(ctx, kind, x, y, s, t, hpFrac) {
    t = t || 0;
    hpFrac = (hpFrac === undefined) ? 1 : clamp(hpFrac, 0, 1);
    const dmg = hpFrac > 0.66 ? 0 : (hpFrac > 0.33 ? 1 : 2);
    const cellX = Math.round(x / 46), cellY = Math.round(y / 44);
    const variant = Math.min(2, Math.floor(hash2(cellX, cellY, 9) * 3));
    const spr = enemySprite(kind, dmg, variant);
    // ground shadow
    ctx.fillStyle = 'rgba(8,16,4,0.30)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.52, s * 0.52, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const box = s * (EN_BOX / EN_DESIGN);
    if (kind === 'runner' || kind === 'splitter' || kind === 'mini') {
      // jelly wobble
      const ph = hash2(cellX, cellY, 3) * 6.28;
      const w = 1 + Math.sin(t * 5.2 + ph) * 0.035;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(w, 1 / w);
      ctx.drawImage(spr, -box / 2, -box / 2, box, box);
      ctx.restore();
    } else {
      ctx.drawImage(spr, x - box / 2, y - box / 2, box, box);
    }
  }

  /* ================= SHARDS — rupees (pre-rendered) ======================= */
  const rupeeCache = new Map();
  function rupeeSprite(gold) {
    const key = gold ? 'gold' : 'green';
    let cv = rupeeCache.get(key);
    if (cv) return cv;
    cv = mkCanvas(96, 96);
    const c = cv.getContext('2d');
    c.translate(48, 48);
    const s = 64;
    const pts = [[0, -0.5], [0.30, -0.28], [0.30, 0.18], [0, 0.5], [-0.30, 0.18], [-0.30, -0.28]];
    const path = () => {
      c.beginPath();
      pts.forEach((p, i) => { const px = p[0] * s, py = p[1] * s; i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); });
      c.closePath();
    };
    const cols = gold
      ? { hi: '#ffe98a', base: '#ffc93c', dark: '#d99a16', line: '#8a5f08' }
      : { hi: '#8df5b0', base: '#37d67a', dark: '#1d9e52', line: '#0d6b34' };
    const g = c.createLinearGradient(0, -0.5 * s, 0, 0.5 * s);
    g.addColorStop(0, cols.hi); g.addColorStop(0.45, cols.base); g.addColorStop(1, cols.dark);
    path(); c.fillStyle = g; c.fill();
    c.save(); path(); c.clip();
    dabFill(c, -0.3 * s, -0.5 * s, 0.6 * s, s, [cols.hi, cols.dark], 12, gold ? 9101 : 9102, 3, 7, 1.6, 3, 0.5, 1.4, 0.2, 0.45);
    c.restore();
    // facets
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, -0.5 * s); c.lineTo(0, 0.5 * s);
    c.moveTo(-0.30 * s, -0.28 * s); c.lineTo(0.30 * s, -0.28 * s);
    c.moveTo(-0.30 * s, 0.18 * s); c.lineTo(0.30 * s, 0.18 * s);
    c.stroke();
    path(); c.strokeStyle = cols.line; c.lineWidth = 2.2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(-0.10 * s, -0.30 * s, 2.2, 0, Math.PI * 2); c.fill();
    rupeeCache.set(key, cv);
    return cv;
  }
  function drawShard(ctx, x, y, s, t) {
    const gold = s >= 15;
    const pulse = 1 + Math.sin((t || 0) * 4 + x * 0.05) * 0.12;
    const r = s * pulse;
    const gc = gold ? '255,201,60' : '55,214,122';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5);
    g.addColorStop(0, 'rgba(' + gc + ',0.40)');
    g.addColorStop(1, 'rgba(' + gc + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill();
    const spr = rupeeSprite(gold);
    ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
  }

  /* ================= ORBS — Bomb-Flower bombs (pre-rendered) ============= */
  const ORB_TINTS = {
    primary: '#ffd94d', iron: '#cfe8ff', fire: '#ff9a3c', ice: '#aee9ff',
    lightning: '#ffe93e', heavy: '#d8c8ff', venom: '#a4ff7a', frost: '#d8fbff',
    spark: '#fff3ae', splitter: '#ffc4ec',
  };
  function orbColor(type) { return ORB_TINTS[type] || '#ffffff'; }
  const bombCache = new Map();
  function bombSprite(golden) {
    const key = golden ? 'gold' : 'std';
    let cv = bombCache.get(key);
    if (cv) return cv;
    cv = mkCanvas(96, 96);
    const c = cv.getContext('2d');
    const cx = 48, cy = 54, r = 30;
    const g = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r + 2);
    if (golden) { g.addColorStop(0, '#c8a24a'); g.addColorStop(0.55, '#8a6420'); g.addColorStop(1, '#54390c'); }
    else { g.addColorStop(0, '#7d8898'); g.addColorStop(0.5, '#454e5a'); g.addColorStop(1, '#22262d'); }
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    dabFill(c, cx - r, cy - r, r * 2, r * 2, golden ? ['#e8c56a', '#6e4c14'] : ['#5d6875', '#31383f'], 22, golden ? 9301 : 9302, 4, 9, 2, 4, 0.5, 1.4, 0.22, 0.45);
    c.restore();
    c.strokeStyle = golden ? '#3d2a08' : '#14181d'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    // brass cap + fuse
    c.fillStyle = '#a8842f';
    rr(c, cx - 7, cy - r - 5, 14, 9, 2.5); c.fill();
    c.strokeStyle = '#6e5416'; c.lineWidth = 1.2;
    rr(c, cx - 7, cy - r - 5, 14, 9, 2.5); c.stroke();
    c.strokeStyle = '#3a2c14'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + 2, cy - r - 4);
    c.quadraticCurveTo(cx + 12, cy - r - 14, cx + 17, cy - r - 9);
    c.stroke();
    // painted highlight
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath(); c.ellipse(cx - 11, cy - 13, 7.5, 4.6, -0.6, 0, Math.PI * 2); c.fill();
    bombCache.set(key, cv);
    return cv;
  }
  function withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function drawOrb(ctx, o, t) {
    const col = o.primary ? ORB_TINTS.primary : orbColor(o.type);
    // ember trail
    const tr = o.trail || [];
    for (let i = 0; i < tr.length; i++) {
      const p = tr[i], f = i / Math.max(1, tr.length);
      ctx.globalAlpha = 0.10 + f * 0.28;
      ctx.fillStyle = i % 3 === 0 ? '#ffb03a' : col;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, o.r * (0.22 + f * 0.4)), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // warm type glow (soft radial falloff, no hard disc edge)
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2.9);
    g.addColorStop(0, withAlpha(col, o.primary ? 0.5 : 0.38));
    g.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2.9, 0, Math.PI * 2); ctx.fill();
    // bomb body
    const spr = bombSprite(!!o.primary);
    const box = o.r * 3.4;
    ctx.drawImage(spr, o.x - box / 2, o.y - box * (54 / 96), box, box);
    if (o.primary) {
      ctx.strokeStyle = 'rgba(255,217,77,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.12, 0, Math.PI * 2); ctx.stroke();
    }
    // fuse sparks (fuse tip sits up-right of the body)
    const fx = o.x + o.r * 0.60, fy = o.y - o.r * 1.32;
    const seedBase = Math.floor((t || 0) * 11) * 31 + Math.floor(o.x) + Math.floor(o.y);
    for (let i = 0; i < 3; i++) {
      const rnd = mulberry32(seedBase + i * 97);
      const a = rnd() * Math.PI * 2, L = 2 + rnd() * 4.5;
      ctx.strokeStyle = ['#fff3b0', '#ffb03a', '#ff7a2e'][i];
      ctx.globalAlpha = 0.55 + rnd() * 0.45;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(a) * L * 0.4, fy - Math.sin(a) * L * 0.4);
      ctx.lineTo(fx + Math.cos(a) * L, fy + Math.sin(a) * L);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  window.PV_ART = { drawBackdrop, drawHero, drawEnemy, orbColor, drawShard, drawPitFrame, drawDeflector, drawOrb };
})();

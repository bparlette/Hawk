/* PITBALL — HYRULE — art module (PV_ART)
 * Painted Zelda retheme of Pitball Verity Level 1. Everything is drawn with
 * visible brush work: sprites and the backdrop are PRE-RENDERED to offscreen
 * canvases at load / first use (dab strokes, painterly palette), then blitted
 * per frame — no per-frame filters, full speed.
 *   walker   -> Octorok, the classic red octopus enemy (snout, big eyes, little feet)
 *   runner   -> swift orange Chuchu jelly
 *   splitter -> big green Chuchu with twin cores (splits into mini Chuchus)
 *   mini     -> mini Chuchu
 *   brute    -> GIANT blue Octorok (the stronger classic colour; not in L1's table)
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
    // Fidelity pass (Nov 13, Cherie: "you've made much better Link before"):
    // defined cap + tail, strand hair, a real face, strapped bracers, a
    // heater shield with rim/rivets/emblem, a sword with fuller + wrapped
    // grip — translated from the approved detailed heroine sprite into
    // this game's top-down/front hybrid view. Same anchors as before:
    // shield west, sword NE, firing glow at the blade tip.
    const u = s / 64;
    const SKIN = '#f2cf9e', SKIN_D = '#ddab72';

    /* ---- boots: tall brown boots, cuff band, toe cap, lace ticks ---- */
    for (const sgn of [-1, 1]) {
      const bx = sgn < 0 ? -0.235 * s : 0.045 * s;
      c.fillStyle = '#5f4122';
      rr(c, bx, 0.30 * s, 0.19 * s, 0.24 * s, 3 * u); c.fill();
      c.save();
      rr(c, bx, 0.30 * s, 0.19 * s, 0.24 * s, 3 * u); c.clip();
      dabFill(c, bx, 0.30 * s, 0.19 * s, 0.24 * s, ['#77552c', '#4e3319'], 9, sgn < 0 ? 7501 : 7502, 3, 6, 1.4, 2.6, 0.4, 1.2, 0.25, 0.5);
      c.restore();
      c.fillStyle = '#7d5a2e';   // cuff
      rr(c, bx - 0.012 * s, 0.285 * s, 0.214 * s, 0.055 * s, 2.5 * u); c.fill();
      c.strokeStyle = 'rgba(40,24,8,0.7)'; c.lineWidth = 1 * u;
      rr(c, bx - 0.012 * s, 0.285 * s, 0.214 * s, 0.055 * s, 2.5 * u); c.stroke();
      c.strokeStyle = 'rgba(240,214,150,0.75)'; c.lineWidth = 1.1 * u;   // laces
      for (let i = 0; i < 3; i++) {
        const ly = (0.375 + i * 0.05) * s;
        c.beginPath(); c.moveTo(bx + 0.055 * s, ly); c.lineTo(bx + 0.135 * s, ly + 0.028 * s); c.stroke();
        c.beginPath(); c.moveTo(bx + 0.135 * s, ly); c.lineTo(bx + 0.055 * s, ly + 0.028 * s); c.stroke();
      }
      c.fillStyle = 'rgba(255,235,190,0.28)';   // toe shine
      c.beginPath(); c.ellipse(bx + 0.095 * s, 0.505 * s, 0.07 * s, 0.028 * s, 0, 0, Math.PI * 2); c.fill();
    }
    /* ---- bare legs between hem and boots ---- */
    c.fillStyle = SKIN;
    rr(c, -0.215 * s, 0.235 * s, 0.15 * s, 0.075 * s, 3 * u); c.fill();
    rr(c, 0.065 * s, 0.235 * s, 0.15 * s, 0.075 * s, 3 * u); c.fill();

    /* ---- tunic: shaped torso, jagged hem, V-neck undershirt ---- */
    const tunicPath = () => {
      c.beginPath();
      c.moveTo(-0.315 * s, -0.05 * s);
      c.quadraticCurveTo(-0.33 * s, 0.10 * s, -0.27 * s, 0.235 * s);
      c.lineTo(-0.185 * s, 0.175 * s);
      c.lineTo(-0.10 * s, 0.25 * s);
      c.lineTo(-0.02 * s, 0.18 * s);
      c.lineTo(0.06 * s, 0.25 * s);
      c.lineTo(0.14 * s, 0.175 * s);
      c.lineTo(0.225 * s, 0.245 * s);
      c.quadraticCurveTo(0.30 * s, 0.10 * s, 0.315 * s, -0.05 * s);
      c.quadraticCurveTo(0, -0.115 * s, -0.315 * s, -0.05 * s);
      c.closePath();
    };
    tunicPath();
    c.fillStyle = '#3e8e3a'; c.fill();
    c.save();
    tunicPath(); c.clip();
    dabFill(c, -0.33 * s, -0.11 * s, 0.66 * s, 0.37 * s, ['#4da344', '#35702e', '#5cb85a'], 34, 7101, 4, 9, 1.6, 3, 0.4, 1.2, 0.3, 0.6);
    // side shading
    const tsh = c.createLinearGradient(-0.33 * s, 0, 0.33 * s, 0);
    tsh.addColorStop(0, 'rgba(16,50,14,0.28)'); tsh.addColorStop(0.25, 'rgba(16,50,14,0)');
    tsh.addColorStop(0.75, 'rgba(16,50,14,0)'); tsh.addColorStop(1, 'rgba(16,50,14,0.28)');
    c.fillStyle = tsh; c.fillRect(-0.33 * s, -0.11 * s, 0.66 * s, 0.37 * s);
    c.restore();
    tunicPath();
    c.strokeStyle = 'rgba(18,52,16,0.65)'; c.lineWidth = 1.3 * u; c.stroke();
    // cream undershirt V at the neck
    c.fillStyle = '#f4ead2';
    c.beginPath();
    c.moveTo(-0.085 * s, -0.085 * s);
    c.lineTo(0.085 * s, -0.085 * s);
    c.lineTo(0, 0.045 * s);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,100,60,0.5)'; c.lineWidth = 0.9 * u; c.stroke();
    /* ---- belt: band, framed buckle, holes, hip pouch ---- */
    c.fillStyle = '#6e4f2a';
    c.fillRect(-0.295 * s, 0.145 * s, 0.59 * s, 0.085 * s);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(-0.295 * s, 0.205 * s, 0.59 * s, 0.025 * s);
    c.fillStyle = '#ffd94d';
    rr(c, -0.062 * s, 0.138 * s, 0.124 * s, 0.10 * s, 2 * u); c.fill();
    c.fillStyle = '#8a6420';
    rr(c, -0.038 * s, 0.158 * s, 0.076 * s, 0.06 * s, 1.5 * u); c.fill();
    c.fillStyle = '#5a3d1e';
    c.fillRect(-0.006 * s, 0.165 * s, 0.03 * s, 0.045 * s);
    c.fillStyle = '#3d2a10';
    for (const hx of [-0.20, -0.145, 0.145, 0.20]) {
      c.beginPath(); c.arc(hx * s, 0.187 * s, 0.011 * s, 0, Math.PI * 2); c.fill();
    }
    // pouch on the right hip
    c.fillStyle = '#77552c';
    rr(c, 0.225 * s, 0.16 * s, 0.105 * s, 0.115 * s, 2.5 * u); c.fill();
    c.fillStyle = '#8a6a42';
    rr(c, 0.225 * s, 0.16 * s, 0.105 * s, 0.045 * s, 2.5 * u); c.fill();
    c.fillStyle = '#ffd94d';
    c.beginPath(); c.arc(0.277 * s, 0.182 * s, 0.013 * s, 0, Math.PI * 2); c.fill();

    /* ---- LEFT arm: sleeve, strapped bracer, hand — shield over it ---- */
    c.fillStyle = '#35702e';
    c.beginPath(); c.arc(-0.345 * s, -0.03 * s, 0.105 * s, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(-0.40 * s, 0.055 * s); c.rotate(0.5);
    c.fillStyle = '#77552c';
    rr(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, 3 * u); c.fill();
    c.save();
    rr(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, 3 * u); c.clip();
    dabFill(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, ['#8a6a42', '#5f4122'], 8, 7601, 3, 6, 1.4, 2.4, 0.4, 1.2, 0.3, 0.55);
    c.restore();
    c.strokeStyle = 'rgba(40,24,8,0.75)'; c.lineWidth = 1.1 * u;
    c.beginPath(); c.moveTo(-0.062 * s, -0.02 * s); c.lineTo(0.062 * s, -0.02 * s); c.stroke();
    c.beginPath(); c.moveTo(-0.062 * s, 0.035 * s); c.lineTo(0.062 * s, 0.035 * s); c.stroke();
    c.restore();
    c.fillStyle = SKIN;   // hand gripping the shield strap
    c.beginPath(); c.arc(-0.435 * s, 0.115 * s, 0.062 * s, 0, Math.PI * 2); c.fill();

    /* ---- the shield: heater shape, steel rim, panelled field, emblem ---- */
    c.save();
    c.translate(-0.475 * s, -0.03 * s);
    const shw = 0.35 * s, shh = 0.44 * s;
    const shieldPath = () => {
      c.beginPath();
      c.moveTo(-shw / 2, -shh / 2);
      c.lineTo(shw / 2, -shh / 2);
      c.lineTo(shw / 2, shh * 0.06);
      c.quadraticCurveTo(shw / 2, shh * 0.38, 0, shh / 2);
      c.quadraticCurveTo(-shw / 2, shh * 0.38, -shw / 2, shh * 0.06);
      c.closePath();
    };
    shieldPath();
    c.fillStyle = '#67798e'; c.fill();
    c.save();
    shieldPath(); c.clip();
    // panelled steel: three vertical fields, alternating tone + dabs
    c.fillStyle = '#8496ab'; c.fillRect(-shw / 2, -shh / 2, shw / 3, shh);
    c.fillStyle = '#93a7bd'; c.fillRect(-shw / 6, -shh / 2, shw / 3, shh);
    c.fillStyle = '#75889e'; c.fillRect(shw / 6, -shh / 2, shw / 3, shh);
    dabFill(c, -shw / 2, -shh / 2, shw, shh, ['#aebfd2', '#5d7186'], 22, 7202, 3, 7, 1.4, 2.6, 0.4, 1.2, 0.25, 0.5);
    // red chief band across the top
    c.fillStyle = '#c8452c';
    c.fillRect(-shw / 2, -shh / 2, shw, shh * 0.16);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(-shw / 2, -shh / 2, shw, shh * 0.05);
    // a battle scratch
    c.strokeStyle = 'rgba(230,240,250,0.5)'; c.lineWidth = 1.1 * u;
    c.beginPath(); c.moveTo(shw * 0.18, shh * 0.10); c.lineTo(shw * 0.30, shh * 0.26); c.stroke();
    c.restore();
    // gold triangle emblem over the panels
    c.fillStyle = '#ffd94d';
    c.beginPath();
    c.moveTo(0, -shh * 0.10);
    c.lineTo(shw * 0.21, shh * 0.20);
    c.lineTo(-shw * 0.21, shh * 0.20);
    c.closePath(); c.fill();
    c.strokeStyle = '#a86f14'; c.lineWidth = 1.2 * u; c.stroke();
    c.strokeStyle = 'rgba(168,111,20,0.8)'; c.lineWidth = 0.9 * u;
    c.beginPath();
    c.moveTo(0, -shh * 0.015);
    c.lineTo(shw * 0.115, shh * 0.135);
    c.lineTo(-shw * 0.115, shh * 0.135);
    c.closePath(); c.stroke();
    // steel rim + rivets
    shieldPath();
    c.strokeStyle = '#33404f'; c.lineWidth = 2.6 * u; c.stroke();
    shieldPath();
    c.strokeStyle = 'rgba(220,232,245,0.6)'; c.lineWidth = 0.9 * u;
    c.save(); c.clip(); c.strokeRect(-shw / 2 + 2.5 * u, -shh / 2 + 2.5 * u, shw - 5 * u, shh - 5 * u); c.restore();
    c.fillStyle = '#d7e3ef';
    for (const [rx, ry] of [[-0.40, -0.40], [0.40, -0.40], [-0.40, 0.06], [0.40, 0.06]]) {
      c.beginPath(); c.arc(rx * shw, ry * shh, 0.016 * s, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    /* ---- RIGHT arm + sword (north) — raised higher when firing ---- */
    const lift = firing ? 0.10 * s : 0;
    c.fillStyle = '#35702e';
    c.beginPath(); c.arc(0.35 * s, -0.045 * s - lift, 0.105 * s, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(0.395 * s, -0.10 * s - lift); c.rotate(-0.45);
    c.fillStyle = '#77552c';
    rr(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, 3 * u); c.fill();
    c.save();
    rr(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, 3 * u); c.clip();
    dabFill(c, -0.062 * s, -0.075 * s, 0.124 * s, 0.15 * s, ['#8a6a42', '#5f4122'], 8, 7602, 3, 6, 1.4, 2.4, 0.4, 1.2, 0.3, 0.55);
    c.restore();
    c.strokeStyle = 'rgba(40,24,8,0.75)'; c.lineWidth = 1.1 * u;
    c.beginPath(); c.moveTo(-0.062 * s, -0.02 * s); c.lineTo(0.062 * s, -0.02 * s); c.stroke();
    c.beginPath(); c.moveTo(-0.062 * s, 0.035 * s); c.lineTo(0.062 * s, 0.035 * s); c.stroke();
    c.restore();
    c.fillStyle = SKIN;   // sword hand
    c.beginPath(); c.arc(0.425 * s, -0.155 * s - lift, 0.068 * s, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(0.43 * s, -0.16 * s - lift);
    c.rotate(0.10);
    // blade: tapered, centre fuller, bright edge
    c.beginPath();
    c.moveTo(-0.048 * s, -0.05 * s);
    c.lineTo(0, -0.53 * s);
    c.lineTo(0.048 * s, -0.05 * s);
    c.closePath();
    const bg = c.createLinearGradient(-0.048 * s, 0, 0.048 * s, 0);
    bg.addColorStop(0, '#9db2c8'); bg.addColorStop(0.5, '#f7fcff'); bg.addColorStop(1, '#7e93a9');
    c.fillStyle = bg; c.fill();
    c.strokeStyle = '#54687e'; c.lineWidth = 1.1 * u; c.stroke();
    c.strokeStyle = 'rgba(90,110,135,0.8)'; c.lineWidth = 1 * u;
    c.beginPath(); c.moveTo(0, -0.09 * s); c.lineTo(0, -0.47 * s); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.moveTo(-0.028 * s, -0.08 * s); c.lineTo(-0.006 * s, -0.44 * s); c.stroke();
    // crossguard with ball ends, wrapped grip, pommel
    c.fillStyle = '#ffd94d';
    rr(c, -0.105 * s, -0.075 * s, 0.21 * s, 0.042 * s, 2 * u); c.fill();
    c.beginPath(); c.arc(-0.105 * s, -0.054 * s, 0.026 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0.105 * s, -0.054 * s, 0.026 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3d1e';
    rr(c, -0.028 * s, -0.033 * s, 0.056 * s, 0.115 * s, 2 * u); c.fill();
    c.strokeStyle = '#c8a24a'; c.lineWidth = 1.2 * u;
    for (let i = 0; i < 3; i++) {
      const gy = (-0.022 + i * 0.036) * s;
      c.beginPath(); c.moveTo(-0.028 * s, gy); c.lineTo(0.028 * s, gy + 0.018 * s); c.stroke();
    }
    c.fillStyle = '#ffd94d';
    c.beginPath(); c.arc(0, 0.105 * s, 0.030 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#37d67a';
    c.beginPath(); c.arc(0, 0.105 * s, 0.013 * s, 0, Math.PI * 2); c.fill();
    c.restore();
    if (firing) {
      const mg = c.createRadialGradient(0.43 * s, -0.68 * s - lift, 0, 0.43 * s, -0.68 * s - lift, 0.30 * s);
      mg.addColorStop(0, 'rgba(255,246,190,0.95)');
      mg.addColorStop(0.4, 'rgba(255,217,77,0.5)');
      mg.addColorStop(1, 'rgba(255,217,77,0)');
      c.fillStyle = mg;
      c.beginPath(); c.arc(0.43 * s, -0.68 * s - lift, 0.30 * s, 0, Math.PI * 2); c.fill();
    }

    /* ---- ears: long points with shaded inners ---- */
    for (const sgn of [-1, 1]) {
      c.fillStyle = SKIN;
      c.beginPath();
      c.moveTo(sgn * 0.185 * s, -0.175 * s);
      c.lineTo(sgn * 0.42 * s, -0.245 * s);
      c.lineTo(sgn * 0.205 * s, -0.045 * s);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(216,120,110,0.6)';
      c.beginPath();
      c.moveTo(sgn * 0.225 * s, -0.155 * s);
      c.lineTo(sgn * 0.345 * s, -0.20 * s);
      c.lineTo(sgn * 0.235 * s, -0.085 * s);
      c.closePath(); c.fill();
    }
    /* ---- head base: face with a jaw ---- */
    const hg = c.createRadialGradient(-0.07 * s, -0.22 * s, s * 0.05, 0, -0.09 * s, s * 0.36);
    hg.addColorStop(0, '#ffe0ae');
    hg.addColorStop(0.6, '#f2cf9e');
    hg.addColorStop(1, '#e0aa6e');
    c.fillStyle = hg;
    c.beginPath(); c.arc(0, -0.10 * s, 0.295 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(190,130,70,0.20)';
    c.beginPath(); c.ellipse(0, 0.075 * s, 0.16 * s, 0.075 * s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(240,140,110,0.28)';
    c.beginPath(); c.arc(-0.155 * s, 0.005 * s, 0.045 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0.155 * s, 0.005 * s, 0.045 * s, 0, Math.PI * 2); c.fill();
    // long side locks framing the face (the reference's hair sweep)
    for (const sgn of [-1, 1]) {
      c.save();
      c.beginPath();
      c.moveTo(sgn * 0.16 * s, -0.30 * s);
      c.quadraticCurveTo(sgn * 0.315 * s, -0.10 * s, sgn * 0.27 * s, 0.16 * s);
      c.quadraticCurveTo(sgn * 0.245 * s, 0.24 * s, sgn * 0.20 * s, 0.26 * s);
      c.quadraticCurveTo(sgn * 0.185 * s, 0.05 * s, sgn * 0.175 * s, -0.14 * s);
      c.quadraticCurveTo(sgn * 0.17 * s, -0.26 * s, sgn * 0.16 * s, -0.30 * s);
      c.closePath();
      const lg = c.createLinearGradient(sgn * 0.16 * s, 0, sgn * 0.31 * s, 0);
      lg.addColorStop(0, '#f7d774'); lg.addColorStop(1, '#d9a83c');
      c.fillStyle = lg; c.fill(); c.clip();
      dabFill(c, sgn * 0.15 * s, -0.30 * s, 0.17 * s, 0.56 * s, ['#ffe98f', '#c9962e'], 8, sgn < 0 ? 7701 : 7702, 4, 8, 1.4, 2.6, Math.PI / 2, 0.4, 0.3, 0.55);
      c.restore();
    }
    /* ---- THE CAP CROWN: a dome that sits ON the head, brim above the
     * fringe — drawn before the fringe so the hair spills out under it ---- */
    const crownPath = () => {
      c.beginPath();
      c.moveTo(-0.255 * s, -0.175 * s);
      c.quadraticCurveTo(-0.21 * s, -0.40 * s, 0, -0.415 * s);
      c.quadraticCurveTo(0.21 * s, -0.40 * s, 0.255 * s, -0.175 * s);
      c.quadraticCurveTo(0.12 * s, -0.112 * s, 0, -0.112 * s);
      c.quadraticCurveTo(-0.12 * s, -0.112 * s, -0.255 * s, -0.175 * s);
      c.closePath();
    };
    crownPath();
    c.fillStyle = '#2f7d32'; c.fill();
    c.save();
    crownPath(); c.clip();
    dabFill(c, -0.26 * s, -0.42 * s, 0.52 * s, 0.31 * s, ['#3f9e42', '#256b27'], 14, 7801, 4, 8, 1.8, 3.2, 0.4, 1.2, 0.3, 0.55);
    c.fillStyle = 'rgba(18,60,18,0.30)';
    c.beginPath(); c.ellipse(0.10 * s, -0.31 * s, 0.15 * s, 0.065 * s, 0.5, 0, Math.PI * 2); c.fill();
    c.restore();
    crownPath();
    c.strokeStyle = 'rgba(20,60,20,0.6)'; c.lineWidth = 1.4 * u; c.stroke();
    c.strokeStyle = 'rgba(20,60,20,0.45)'; c.lineWidth = 1.1 * u;
    c.beginPath(); c.moveTo(0, -0.41 * s); c.quadraticCurveTo(0.008 * s, -0.27 * s, 0, -0.125 * s); c.stroke();
    /* ---- cap tail: drapes down the shield side from under the crown ---- */
    c.save();
    c.beginPath();
    c.moveTo(-0.115 * s, -0.16 * s);
    c.quadraticCurveTo(-0.30 * s, 0.02 * s, -0.345 * s, 0.22 * s);
    c.quadraticCurveTo(-0.315 * s, 0.42 * s, -0.225 * s, 0.565 * s);
    c.quadraticCurveTo(-0.205 * s, 0.575 * s, -0.195 * s, 0.50 * s);
    c.quadraticCurveTo(-0.185 * s, 0.20 * s, -0.165 * s, -0.02 * s);
    c.quadraticCurveTo(-0.15 * s, -0.12 * s, -0.115 * s, -0.16 * s);
    c.closePath();
    c.fillStyle = '#2f7d32'; c.fill(); c.clip();
    dabFill(c, -0.35 * s, -0.16 * s, 0.24 * s, 0.74 * s, ['#3f9e42', '#256b27', '#57b95a'], 14, 7404, 4, 9, 1.8, 3.4, Math.PI / 2, 0.5, 0.3, 0.6);
    c.fillStyle = 'rgba(18,60,18,0.25)';
    c.fillRect(-0.20 * s, -0.16 * s, 0.06 * s, 0.74 * s);
    c.restore();
    c.strokeStyle = 'rgba(20,60,20,0.5)'; c.lineWidth = 1.1 * u;
    c.beginPath();
    c.moveTo(-0.115 * s, -0.16 * s);
    c.quadraticCurveTo(-0.30 * s, 0.02 * s, -0.345 * s, 0.22 * s);
    c.quadraticCurveTo(-0.315 * s, 0.42 * s, -0.225 * s, 0.565 * s);
    c.stroke();
    /* ---- fringe: pointed strands spilling from under the cap ---- */
    const fringePath = () => {
      c.beginPath();
      c.moveTo(-0.235 * s, -0.155 * s);
      c.quadraticCurveTo(-0.19 * s, -0.30 * s, 0, -0.305 * s);
      c.quadraticCurveTo(0.19 * s, -0.30 * s, 0.235 * s, -0.155 * s);
      c.lineTo(0.175 * s, -0.225 * s);
      c.lineTo(0.115 * s, -0.148 * s);
      c.lineTo(0.05 * s, -0.235 * s);
      c.lineTo(-0.01 * s, -0.143 * s);
      c.lineTo(-0.075 * s, -0.23 * s);
      c.lineTo(-0.14 * s, -0.143 * s);
      c.closePath();
    };
    fringePath();
    c.fillStyle = '#eec25e'; c.fill();
    c.save();
    fringePath(); c.clip();
    dabFill(c, -0.235 * s, -0.31 * s, 0.47 * s, 0.17 * s, ['#f7d774', '#d9a83c', '#fff0ae'], 12, 7303, 3, 7, 1.3, 2.4, 0.5, 1.4, 0.4, 0.8);
    c.restore();
    c.strokeStyle = 'rgba(150,105,30,0.65)'; c.lineWidth = 1 * u;
    for (const fx of [-0.14, -0.01, 0.115]) {
      c.beginPath(); c.moveTo(fx * s, -0.143 * s); c.lineTo((fx + 0.03) * s, -0.25 * s); c.stroke();
    }
    /* ---- the face: green eyes, determined brows, nose, mouth ---- */
    for (const sgn of [-1, 1]) {
      c.fillStyle = '#ffffff';
      c.beginPath(); c.ellipse(sgn * 0.098 * s, -0.105 * s, 0.048 * s, 0.060 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2e9e4f';
      c.beginPath(); c.arc(sgn * 0.098 * s, -0.115 * s, 0.033 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#14260f';
      c.beginPath(); c.arc(sgn * 0.098 * s, -0.118 * s, 0.017 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(sgn * 0.088 * s, -0.132 * s, 0.010 * s, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8a6420'; c.lineWidth = 2 * u; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(sgn * 0.045 * s, -0.185 * s);
      c.lineTo(sgn * 0.155 * s, -0.168 * s);
      c.stroke();
    }
    c.strokeStyle = 'rgba(160,100,50,0.8)'; c.lineWidth = 1.1 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.008 * s, -0.048 * s); c.lineTo(-0.004 * s, -0.012 * s); c.stroke();
    c.strokeStyle = '#9c5a30'; c.lineWidth = 1.4 * u;
    c.beginPath(); c.moveTo(-0.032 * s, 0.038 * s); c.lineTo(0.032 * s, 0.038 * s); c.stroke();
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

  /* ================= ENEMIES — Octoroks & Chuchus (pre-rendered) ======= */
  const EN_BOX = 192, EN_DESIGN = 132;
  const enCache = new Map();

  /* ---------- Octoroks: the classic Zelda octopus enemy ----------
   * Red Octorok = the walker; the great brute is a GIANT blue Octorok
   * (the stronger classic colour). Round body, tapered snout with a
   * dark mouth, big eyes aimed down-pit, little orange feet. Painted
   * dab-stroke work, pre-rendered like everything else here. */
  const OCTO_REDS = [
    { light: '#ffa183', base: '#e8492f', dark: '#b02a18', deep: '#7c1a0e', line: '#5f130a', bruise: '#93324a' },
    { light: '#ffb57e', base: '#ef6a2a', dark: '#c04a16', deep: '#84300d', line: '#66250a', bruise: '#9c3a4e' },
    { light: '#ff9196', base: '#dd3550', dark: '#a81f38', deep: '#741327', line: '#570e1e', bruise: '#70305e' },
  ];
  const OCTO_BLUE = { light: '#96bcff', base: '#3f70d9', dark: '#274a99', deep: '#172d63', line: '#0f1e42', bruise: '#5e2f70' };

  function paintOctorok(c, s, o) {
    const C = o.cols;
    const squash = o.dmg >= 2 ? 0.93 : 0.97;
    // little orange feet poking out from under the body (drawn first)
    const footAt = (fx, fy, rot) => {
      c.save();
      c.translate(fx, fy); c.rotate(rot);
      const fg = c.createRadialGradient(-0.02 * s, -0.02 * s, 0, 0, 0, 0.11 * s);
      fg.addColorStop(0, '#ffc45e'); fg.addColorStop(1, '#e08a1e');
      c.fillStyle = fg;
      c.beginPath(); c.ellipse(0, 0, 0.105 * s, 0.07 * s, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(120,60,8,0.6)'; c.lineWidth = Math.max(0.8, s * 0.014);
      c.beginPath(); c.moveTo(-0.032 * s, -0.042 * s); c.lineTo(-0.032 * s, 0.046 * s); c.stroke();
      c.beginPath(); c.moveTo(0.034 * s, -0.042 * s); c.lineTo(0.034 * s, 0.046 * s); c.stroke();
      c.restore();
    };
    footAt(-0.31 * s, 0.43 * s, 0.15);
    footAt(0.31 * s, 0.43 * s, -0.15);
    footAt(-0.47 * s, 0.15 * s, 1.25);
    footAt(0.47 * s, 0.15 * s, -1.25);
    // round body: gradient base, then painted dabs clipped to the blob
    blobPath(c, s, o.seed, squash);
    const g = c.createRadialGradient(-0.16 * s, -0.24 * s, s * 0.06, 0, 0, s * 0.66);
    g.addColorStop(0, C.light);
    g.addColorStop(0.5, C.base);
    g.addColorStop(1, C.dark);
    c.fillStyle = g; c.fill();
    c.save();
    blobPath(c, s, o.seed, squash); c.clip();
    dabFill(c, -0.5 * s, -0.5 * s, s, s, [C.light, C.dark, C.base], 52, o.seed + 5, 4, 10, 2, 4.2, 0.5, 1.5, 0.13, 0.30);
    // darker speckles (variant flavour)
    dabFill(c, -0.45 * s, -0.45 * s, 0.9 * s, 0.7 * s, [C.deep], o.spots, o.seed + 19, 3, 6, 2, 3.6, 0.4, 1.6, 0.22, 0.42);
    // belly shading low on the body
    const bg2 = c.createRadialGradient(0, 0.36 * s, 0, 0, 0.36 * s, 0.44 * s);
    bg2.addColorStop(0, 'rgba(0,0,0,0.20)');
    bg2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = bg2;
    c.fillRect(-0.5 * s, -0.08 * s, s, 0.62 * s);
    // glossy crown highlight
    c.fillStyle = 'rgba(255,255,255,0.34)';
    c.beginPath(); c.ellipse(-0.16 * s, -0.33 * s, 0.16 * s, 0.08 * s, -0.5, 0, Math.PI * 2); c.fill();
    // damage: bruises + scratches, deepening by state
    if (o.dmg >= 1) {
      dabFill(c, -0.42 * s, -0.3 * s, 0.84 * s, 0.66 * s, [C.bruise], 4, o.seed + 61, 6, 13, 3, 5.6, 0.4, 1.4, 0.30, 0.45);
      c.strokeStyle = 'rgba(60,8,8,0.7)'; c.lineWidth = Math.max(1, s * 0.02);
      crack(c, 0.30 * s, -0.30 * s, 0.22 * s, 2.2, o.seed + 71);
    }
    if (o.dmg >= 2) {
      dabFill(c, -0.46 * s, -0.36 * s, 0.92 * s, 0.8 * s, [C.bruise, C.deep], 8, o.seed + 67, 6, 14, 3, 6.4, 0.4, 1.4, 0.35, 0.55);
      c.strokeStyle = 'rgba(50,6,6,0.8)'; c.lineWidth = Math.max(1.1, s * 0.024);
      crack(c, -0.34 * s, -0.05 * s, 0.26 * s, 1.1, o.seed + 83);
      crack(c, 0.12 * s, -0.40 * s, 0.20 * s, 2.6, o.seed + 97);
    }
    c.restore();
    blobPath(c, s, o.seed, squash);
    c.strokeStyle = C.line; c.lineWidth = Math.max(1.4, s * 0.028); c.stroke();
    // variant 1 wears a little sprout on the crown
    if (o.tuft) {
      c.strokeStyle = '#2c6e1e'; c.lineWidth = Math.max(1.2, s * 0.026);
      c.beginPath(); c.moveTo(0, -0.46 * s); c.quadraticCurveTo(0.01 * s, -0.54 * s, 0.05 * s, -0.57 * s); c.stroke();
      dab(c, 0.02 * s, -0.55 * s, 0.10 * s, -0.5, 3.4, '#4da344', 0.95);
      dab(c, 0.03 * s, -0.54 * s, 0.09 * s, -2.4, 3.2, '#3e8e3a', 0.95);
    }
    // eyes: big and round, pupils aimed down-pit at the hero
    const ey = -0.17 * s, ex = 0.175 * s;
    for (const sgn of [-1, 1]) {
      if (o.dmg >= 2) {   // >_< knocked silly
        c.strokeStyle = '#2a0d08'; c.lineWidth = Math.max(1.4, s * 0.034);
        c.beginPath();
        c.moveTo(sgn * ex - 0.06 * s, ey - 0.045 * s); c.lineTo(sgn * ex + 0.06 * s, ey + 0.045 * s);
        c.moveTo(sgn * ex - 0.06 * s, ey + 0.045 * s); c.lineTo(sgn * ex + 0.06 * s, ey - 0.045 * s);
        c.stroke();
      } else {
        c.fillStyle = '#fff8ea';
        c.beginPath(); c.arc(sgn * ex, ey, 0.088 * s, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(60,10,5,0.55)'; c.lineWidth = Math.max(0.8, s * 0.014);
        c.beginPath(); c.arc(sgn * ex, ey, 0.088 * s, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#2a0d08';
        c.beginPath(); c.arc(sgn * ex, ey + 0.030 * s, 0.046 * s, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(sgn * ex - 0.014 * s, ey + 0.012 * s, 0.015 * s, 0, Math.PI * 2); c.fill();
        if (o.dmg >= 1 && sgn < 0) {   // one lid winces shut
          c.strokeStyle = '#2a0d08'; c.lineWidth = Math.max(1.2, s * 0.028);
          c.beginPath(); c.moveTo(sgn * ex - 0.08 * s, ey - 0.06 * s); c.lineTo(sgn * ex + 0.08 * s, ey - 0.048 * s); c.stroke();
        }
        if (o.brute) {   // angry brows on the great one
          c.strokeStyle = C.deep; c.lineWidth = Math.max(1.6, s * 0.04);
          c.beginPath(); c.moveTo(sgn * ex - 0.09 * s, ey - 0.135 * s); c.lineTo(sgn * ex + 0.07 * s, ey - 0.088 * s); c.stroke();
        }
      }
    }
    // THE SNOUT: a tapered trunk dropping from the face, dark mouth at the tip
    const sw = o.brute ? 0.32 : 0.27;
    const snoutPath = () => {
      c.beginPath();
      c.moveTo(-sw * 0.5 * s, -0.03 * s);
      c.quadraticCurveTo(-sw * 0.44 * s, 0.22 * s, -sw * 0.36 * s, 0.36 * s);
      c.quadraticCurveTo(0, 0.47 * s, sw * 0.36 * s, 0.36 * s);
      c.quadraticCurveTo(sw * 0.44 * s, 0.22 * s, sw * 0.5 * s, -0.03 * s);
      c.closePath();
    };
    snoutPath();
    const sg = c.createLinearGradient(-sw * 0.5 * s, 0, sw * 0.5 * s, 0);
    sg.addColorStop(0, C.dark); sg.addColorStop(0.5, C.light); sg.addColorStop(1, C.dark);
    c.fillStyle = sg; c.fill();
    c.save();
    snoutPath(); c.clip();
    dabFill(c, -sw * 0.5 * s, -0.03 * s, sw * s, 0.5 * s, [C.base, C.dark], 10, o.seed + 23, 3, 7, 1.6, 3, Math.PI / 2, 0.5, 0.2, 0.4);
    c.restore();
    snoutPath();
    c.strokeStyle = C.line; c.lineWidth = Math.max(1.2, s * 0.024); c.stroke();
    // mouth opening at the snout's tip (it spits rocks, after all)
    c.fillStyle = C.deep;
    c.beginPath(); c.ellipse(0, 0.415 * s, sw * 0.21 * s, 0.046 * s, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,220,190,0.5)'; c.lineWidth = Math.max(0.8, s * 0.014);
    c.beginPath(); c.ellipse(0, 0.415 * s, sw * 0.21 * s, 0.046 * s, 0, 0, Math.PI * 2); c.stroke();
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
      paintOctorok(c, kind === 'brute' ? s * 1.06 : s, {
        cols: kind === 'brute' ? OCTO_BLUE : OCTO_REDS[variant % 3],
        dmg, seed, brute: kind === 'brute',
        tuft: variant === 1, spots: 4 + variant * 3,
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

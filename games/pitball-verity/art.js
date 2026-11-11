/* PITBALL VERITY — art module (PV_ART)
 * Frame-anchored on BALL x PIT gameplay: top-down pit, tiny hero at the
 * bottom, enemies are blocky statue heads descending in grid formations,
 * textured earth floor (here: frost-cracked stone + snow), glowing orbs.
 * All canvas code-drawn. No external assets.
 */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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

  /* ================= BACKDROP (cached offscreen, seeded) ================= */
  const bgCache = new Map();

  function stoneFloor(ctx, W, H, opt) {
    const rnd = mulberry32(opt.seed);
    ctx.fillStyle = opt.base;
    ctx.fillRect(0, 0, W, H);
    const cell = opt.cell || 62;
    const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
    const jx = [], jy = [];
    for (let i = 0; i <= cols; i++) {
      jx.push([]); jy.push([]);
      for (let j = 0; j <= rows; j++) {
        jx[i].push(i * cell + (i === 0 || i === cols ? 0 : (rnd() - 0.5) * cell * 0.36));
        jy[i].push(j * cell + (j === 0 || j === rows ? 0 : (rnd() - 0.5) * cell * 0.36));
      }
    }
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const v = hash2(i, j, opt.seed);
        ctx.fillStyle = shade(opt.stone, opt.shadeMin + v * (opt.shadeMax - opt.shadeMin));
        ctx.beginPath();
        ctx.moveTo(jx[i][j] - 1.5, jy[i][j] - 1.5);
        ctx.lineTo(jx[i + 1][j] + 1.5, jy[i][j] - 1.5);
        ctx.lineTo(jx[i + 1][j + 1] + 1.5, jy[i][j + 1] + 1.5);
        ctx.lineTo(jx[i][j + 1] - 1.5, jy[i][j + 1] + 1.5);
        ctx.closePath();
        ctx.fill();
      }
    ctx.strokeStyle = opt.seam;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++)
      for (let j = 0; j < rows; j++) { ctx.moveTo(jx[i][j], jy[i][j]); ctx.lineTo(jx[i][j + 1], jy[i][j + 1]); }
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < cols; i++) { ctx.moveTo(jx[i][j], jy[i][j]); ctx.lineTo(jx[i + 1][j], jy[i][j]); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = opt.crackCol;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (hash2(i, j, opt.seed + 7) < 0.42) {
          const cx = (jx[i][j] + jx[i + 1][j + 1]) / 2 + (hash2(i, j, 3) - 0.5) * 18;
          const cy = (jy[i][j] + jy[i][j + 1]) / 2 + (hash2(i, j, 4) - 0.5) * 18;
          ctx.globalAlpha = 0.5;
          crack(ctx, cx, cy, cell * (0.35 + hash2(i, j, 5) * 0.4), hash2(i, j, 6) * Math.PI * 2, opt.seed + i * 31 + j * 57);
          ctx.globalAlpha = 1;
        }
      }
    const n = Math.floor(W * H / 2600);
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = rnd() < 0.5 ? opt.grainDark : opt.grainLight;
      ctx.globalAlpha = 0.10 + rnd() * 0.12;
      ctx.fillRect(rnd() * W, rnd() * H, 1.6 + rnd() * 2.4, 1.6 + rnd() * 2.4);
    }
    ctx.globalAlpha = 1;
  }

  function snowPatches(ctx, W, H, seed, count, alpha) {
    const rnd = mulberry32(seed);
    for (let n = 0; n < count; n++) {
      const x = rnd() * W, y = rnd() * H, rx = 22 + rnd() * 66, ry = rx * (0.32 + rnd() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, 'rgba(240,249,252,' + alpha + ')');
      g.addColorStop(0.7, 'rgba(226,240,246,' + alpha * 0.55 + ')');
      g.addColorStop(1, 'rgba(226,240,246,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.beginPath(); ctx.arc(x, y, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* snow that settles where snow actually settles: in seams + corners,
   * as SHORT broken clusters of small hard-edged drifts (not soft blobs,
   * not full-width rows — the open floor must read as bare cracked stone
   * with snow IN it). Most seams stay bare; kept seams get 1–3 short
   * clusters, concentrated at the pit edges where snow piles up. */
  function seamSnow(ctx, W, H, seed, cell) {
    const rnd = mulberry32(seed);
    const rows = Math.ceil(H / cell);
    for (let j = 1; j < rows; j++) {
      if (rnd() < 0.68) continue;   // ~70% of seams carry no drift at all
      const yBase = j * cell + (rnd() - 0.5) * 8;
      const clusters = 1 + (rnd() * 3 | 0);
      for (let c = 0; c < clusters; c++) {
        const pick = rnd();
        const x0 = pick < 0.42 ? rnd() * W * 0.20            // left edge
          : pick < 0.84 ? W - rnd() * W * 0.20                // right edge
          : W * (0.3 + rnd() * 0.4);                          // occasional mid-floor
        const len = 12 + rnd() * 30;                          // short chains (was 26–121)
        const n = Math.ceil(len / 8);
        for (let k = 0; k < n; k++) {
          if (rnd() < 0.3) continue;                          // breaks inside the chain
          const ex = x0 + k * 8, ey = yBase + (rnd() - 0.5) * 3;
          const rx = 5 + rnd() * 5, ry = rx * 0.38;
          ctx.fillStyle = 'rgba(148,186,204,0.5)';
          ctx.beginPath(); ctx.ellipse(ex, ey + ry * 0.8, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(240,249,252,' + (0.55 + rnd() * 0.35) + ')';
          ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // corner drifts where four stones meet — denser toward the side edges
    const cols = Math.ceil(W / cell);
    for (let n = 0; n < 46; n++) {
      const cx = rnd() < 0.55
        ? (rnd() < 0.5 ? rnd() * 1.2 : cols - rnd() * 1.2) * cell + (rnd() - 0.5) * 10
        : (rnd() * cols | 0) * cell + (rnd() - 0.5) * 10;
      const cy = (rnd() * rows | 0) * cell + (rnd() - 0.5) * 10;
      const m = 3 + (rnd() * 3 | 0);
      for (let k = 0; k < m; k++) {
        const rx = 5 + rnd() * 8;
        ctx.fillStyle = 'rgba(240,249,252,' + (0.4 + rnd() * 0.35) + ')';
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * 16, cy + (rnd() - 0.5) * 8, rx, rx * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function renderBackdrop(scene, W, H) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    if (scene === 'frost-shaft') {
      stoneFloor(ctx, W, H, {
        seed: 1101, cell: 62, base: '#54707f', stone: '#75909e',
        shadeMin: 0.72, shadeMax: 1.22, seam: '#364a58', crackCol: '#2f434f',
        grainDark: '#24363f', grainLight: '#cfe4ec'
      });
      // snow settled into the seams and corners of the stonework
      seamSnow(ctx, W, H, 2202, 62);
      // scattered wind-blown dusting, small and broken up
      const rndD = mulberry32(2606);
      for (let n = 0; n < 200; n++) {
        ctx.fillStyle = 'rgba(238,247,250,' + (0.05 + rndD() * 0.10) + ')';
        ctx.beginPath();
        ctx.ellipse(rndD() * W, rndD() * H, 3 + rndD() * 9, 1.2 + rndD() * 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // ice sheets: barely-there glassy sheen + bright vein cracks
      const rnd = mulberry32(3303);
      for (let n = 0; n < 5; n++) {
        const x = rnd() * W, y = rnd() * H, r = 24 + rnd() * 42;
        ctx.fillStyle = 'rgba(168,216,234,0.07)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(230,248,255,0.38)';
        ctx.lineWidth = 1;
        crack(ctx, x, y, r * 0.8, rnd() * 6.28, 4000 + n * 13);
        crack(ctx, x, y, r * 0.55, rnd() * 6.28, 5000 + n * 17);
      }
      // depth: the deep end of the shaft darkens toward the top
      const gt = ctx.createLinearGradient(0, 0, 0, H * 0.34);
      gt.addColorStop(0, 'rgba(16,28,38,0.30)');
      gt.addColorStop(1, 'rgba(16,28,38,0)');
      ctx.fillStyle = gt;
      ctx.fillRect(0, 0, W, H * 0.34);
      // faint blue depth glow near the bottom (over the hero's end)
      const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
      g.addColorStop(0, 'rgba(64,160,220,0)');
      g.addColorStop(1, 'rgba(64,160,220,0.20)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.72, W, H * 0.28);
    } else if (scene === 'foundry-bend') {
      stoneFloor(ctx, W, H, {
        seed: 4404, cell: 58, base: '#241d1a', stone: '#38302b',
        shadeMin: 0.78, shadeMax: 1.12, seam: '#17120f', crackCol: '#100c0a',
        grainDark: '#0d0a08', grainLight: '#6b5a4a'
      });
      // ember seams: glowing cracks running through the basalt
      const rnd = mulberry32(5505);
      for (let n = 0; n < 11; n++) {
        const x = rnd() * W, y = rnd() * H, len = 60 + rnd() * 130, ang = rnd() * Math.PI * 2;
        ctx.strokeStyle = 'rgba(255,92,26,0.20)';
        ctx.lineWidth = 5;
        crack(ctx, x, y, len, ang, 6000 + n * 23);
        ctx.strokeStyle = 'rgba(255,166,60,0.85)';
        ctx.lineWidth = 1.6;
        crack(ctx, x, y, len, ang, 6000 + n * 23);
      }
      // ash dusting
      for (let n = 0; n < 260; n++) {
        ctx.fillStyle = rnd() < 0.6 ? 'rgba(150,138,126,0.13)' : 'rgba(255,140,60,0.10)';
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const g = ctx.createLinearGradient(0, H * 0.8, 0, H);
      g.addColorStop(0, 'rgba(255,110,30,0)');
      g.addColorStop(1, 'rgba(255,110,30,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.8, W, H * 0.2);
    } else { /* crown-spire */
      stoneFloor(ctx, W, H, {
        seed: 7707, cell: 60, base: '#231c31', stone: '#372e4d',
        shadeMin: 0.8, shadeMax: 1.13, seam: '#171126', crackCol: '#120d1f',
        grainDark: '#0e0a18', grainLight: '#7a6ea3'
      });
      // frost veins: pale branching ice creeping across violet stone
      const rnd = mulberry32(8808);
      for (let n = 0; n < 13; n++) {
        const x = rnd() * W, y = rnd() * H, len = 50 + rnd() * 110, ang = rnd() * Math.PI * 2;
        ctx.strokeStyle = 'rgba(190,235,255,0.55)';
        ctx.lineWidth = 1.3;
        crack(ctx, x, y, len, ang, 9000 + n * 29);
        ctx.strokeStyle = 'rgba(140,190,230,0.25)';
        ctx.lineWidth = 3;
        crack(ctx, x, y, len, ang, 9000 + n * 29);
      }
      snowPatches(ctx, W, H, 9909, 4, 0.14);   // kept sparse/faint — soft blobs must not read as clouds
      const g = ctx.createLinearGradient(0, H * 0.75, 0, H);
      g.addColorStop(0, 'rgba(120,90,220,0)');
      g.addColorStop(1, 'rgba(120,90,220,0.13)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.75, W, H * 0.25);
    }
    return cv;
  }

  function fleckPos(i, W, H, seed) {
    return [hash2(i, 11, seed) * W, hash2(i, 77, seed) * H];
  }

  /* The engine calls drawBackdrop(ctx, level.scene, W, H, t) with the scene
   * OBJECT {palette, backdrop, props}; Lane A's painters key off a string.
   * Map the level backdrop names onto painter keys (unknown → frost).
   * A bare string key also works (standalone test page). */
  const BACKDROP_MAP = { 'frost-cavern': 'frost-shaft', 'foundry': 'foundry-bend', 'spire': 'crown-spire' };
  function hexToRgba(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    if (isNaN(n)) return null;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function drawBackdrop(ctx, scene, W, H, t) {
    const src = (scene && typeof scene === 'object') ? scene : null;
    const rawKey = src ? src.backdrop : scene;
    const bkey = BACKDROP_MAP[rawKey] ||
      (rawKey === 'foundry-bend' || rawKey === 'crown-spire' || rawKey === 'frost-shaft' ? rawKey : 'frost-shaft');
    const key = bkey + ':' + W + 'x' + H;   // base stays cached per backdrop key + size
    let cv = bgCache.get(key);
    if (!cv) { cv = renderBackdrop(bkey, W, H); bgCache.set(key, cv); }
    ctx.drawImage(cv, 0, 0);
    // per-level palette identity across the 18 levels: translucent wash of
    // the level's bg colour + a few accent flecks (cheap; base stays cached)
    if (src && src.palette) {
      const wash = hexToRgba(src.palette.bg, 0.16);
      if (wash) { ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
      const acc = src.palette.accent;
      if (acc) {
        let seed = 0; const bgStr = String(src.palette.bg || '');
        for (let i = 0; i < bgStr.length; i++) seed = (seed * 31 + bgStr.charCodeAt(i)) | 0;
        ctx.fillStyle = acc;
        for (let i = 0; i < 14; i++) {
          const p = fleckPos(i, W, H, seed);
          ctx.globalAlpha = 0.16 + hash2(i, 5, seed) * 0.22;
          ctx.fillRect(p[0], p[1], 1.6 + (i % 3), 1.6 + (i % 3));
        }
        ctx.globalAlpha = 1;
      }
    }
    t = t || 0;
    if (bkey === 'frost-shaft') {
      for (let i = 0; i < 22; i++) {
        const p = fleckPos(i, W, H, 42);
        const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.6 + i * 1.7));
        ctx.fillStyle = 'rgba(235,250,255,' + a.toFixed(3) + ')';
        const s = 1.4 + (i % 3) * 0.6;
        ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
    } else if (bkey === 'foundry-bend') {
      for (let i = 0; i < 14; i++) {
        const p = fleckPos(i, W, H, 43);
        const rise = (t * 14 + i * 67) % 130;
        const a = 0.5 * (1 - rise / 130);
        ctx.fillStyle = 'rgba(255,' + (140 + (i % 5) * 18) + ',50,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p[0], p[1] - rise, 1.3 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const p = fleckPos(i, W, H, 44);
        const a = 0.18 + 0.4 * Math.abs(Math.sin(t * 1.1 + i * 2.3));
        ctx.fillStyle = 'rgba(210,240,255,' + a.toFixed(3) + ')';
        ctx.fillRect(p[0], p[1], 1.4, 1.4);
      }
    }
  }

  /* ================= HERO — Verity, top-down, ~34px ================= */
  function drawHero(ctx, x, y, s, t, firing) {
    t = t || 0;
    const u = s / 34;                       // unit scale (design size 34)
    const bob = Math.sin(t * 2.3) * 0.9 * u;
    ctx.save();
    ctx.translate(x, y + bob);
    // soft shadow
    ctx.fillStyle = 'rgba(6,14,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.40, s * 0.46, s * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    // boots peeking south
    ctx.fillStyle = '#1d5d7d';
    rr(ctx, -0.26 * s, 0.24 * s, 0.20 * s, 0.20 * s, 2.5 * u); ctx.fill();
    rr(ctx, 0.06 * s, 0.24 * s, 0.20 * s, 0.20 * s, 2.5 * u); ctx.fill();
    // torso / backpack block
    ctx.fillStyle = '#2b7ea6';
    rr(ctx, -0.30 * s, -0.02 * s, 0.60 * s, 0.36 * s, 4 * u); ctx.fill();
    ctx.fillStyle = '#57b6d9';
    rr(ctx, -0.20 * s, 0.03 * s, 0.40 * s, 0.16 * s, 3 * u); ctx.fill();
    // left pauldron
    ctx.fillStyle = '#8fd8f2';
    ctx.strokeStyle = '#12303e';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.arc(-0.40 * s, -0.05 * s, 0.21 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.arc(-0.44 * s, -0.10 * s, 0.08 * s, 0, Math.PI * 2); ctx.fill();
    // right pauldron + buster arm (aimed up-screen)
    ctx.fillStyle = '#8fd8f2';
    ctx.beginPath(); ctx.arc(0.40 * s, -0.05 * s, 0.21 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.arc(0.36 * s, -0.10 * s, 0.08 * s, 0, Math.PI * 2); ctx.fill();
    // cannon: barrel from right pauldron toward top
    ctx.fillStyle = '#2b7ea6';
    rr(ctx, 0.30 * s, -0.52 * s, 0.21 * s, 0.36 * s, 3 * u); ctx.fill();
    ctx.strokeStyle = '#12303e';
    ctx.lineWidth = 1.2 * u;
    rr(ctx, 0.30 * s, -0.52 * s, 0.21 * s, 0.36 * s, 3 * u); ctx.stroke();
    ctx.fillStyle = '#16455e';
    ctx.beginPath(); ctx.arc(0.405 * s, -0.52 * s, 0.085 * s, 0, Math.PI * 2); ctx.fill();
    if (firing) {
      const fl = 0.75 + 0.25 * Math.sin(t * 41);
      const mg = ctx.createRadialGradient(0.405 * s, -0.60 * s, 0, 0.405 * s, -0.60 * s, 0.42 * s * fl);
      mg.addColorStop(0, 'rgba(255,246,190,0.95)');
      mg.addColorStop(0.35, 'rgba(140,240,255,0.55)');
      mg.addColorStop(1, 'rgba(140,240,255,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0.405 * s, -0.60 * s, 0.42 * s * fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.arc(0.405 * s, -0.585 * s, 0.075 * s * fl, 0, Math.PI * 2); ctx.fill();
    }
    // helmet
    const hg = ctx.createRadialGradient(-0.10 * s, -0.22 * s, s * 0.06, 0, -0.08 * s, s * 0.42);
    hg.addColorStop(0, '#f2fcff');
    hg.addColorStop(0.55, '#a8dcf0');
    hg.addColorStop(1, '#5fb2d4');
    ctx.fillStyle = hg;
    ctx.strokeStyle = '#12303e';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.arc(0, -0.08 * s, 0.335 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // helmet crest fin (north)
    ctx.fillStyle = '#dff6ff';
    ctx.strokeStyle = '#12303e';
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.moveTo(-0.075 * s, -0.36 * s);
    ctx.lineTo(0, -0.52 * s);
    ctx.lineTo(0.075 * s, -0.36 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // visor slit — glowing cyan
    ctx.fillStyle = '#0b2a3a';
    rr(ctx, -0.20 * s, -0.085 * s, 0.40 * s, 0.115 * s, 3 * u); ctx.fill();
    ctx.fillStyle = '#6ff3ff';
    rr(ctx, -0.165 * s, -0.062 * s, 0.33 * s, 0.062 * s, 2.5 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-0.13 * s, -0.052 * s, 0.10 * s, 0.028 * s);
    ctx.restore();
  }

  /* ================= ENEMIES — snow statue heads ================= */
  const STONE = { base: '#7e97a3', dark: '#546672', darker: '#3c4c56', line: '#2f3f49' };

  function snowCapTop(ctx, x0, x1, yTop, hgt, seed, cover) {
    const rnd = mulberry32(seed);
    const w = x1 - x0;
    ctx.fillStyle = '#eef7fa';
    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    let x = x0;
    while (x < x1) {
      const step = w * (0.10 + rnd() * 0.14);
      const depth = hgt * (0.35 + rnd() * 0.75) * cover;
      ctx.lineTo(Math.min(x + step / 2, x1), yTop + depth);
      ctx.lineTo(Math.min(x + step, x1), yTop);
      x += step;
    }
    ctx.lineTo(x1, yTop - hgt * 0.4);
    ctx.lineTo(x0, yTop - hgt * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  function drawStatueHalf(ctx, cx, cy, w, h, o) {
    // one head (or one half of a splitter), centred at cx,cy
    const x0 = cx - w / 2, y0 = cy - h / 2;
    const v = o.tint;
    ctx.fillStyle = shade(STONE.base, v);
    rr(ctx, x0, y0, w, h, w * 0.10); ctx.fill();
    ctx.strokeStyle = STONE.line;
    ctx.lineWidth = Math.max(1.2, w * 0.035);
    rr(ctx, x0, y0, w, h, w * 0.10); ctx.stroke();
    // plinth band at the base
    ctx.fillStyle = shade(STONE.base, v * 0.74);
    rr(ctx, x0 + w * 0.04, cy + h * 0.30, w * 0.92, h * 0.17, w * 0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(38,52,61,0.6)';
    ctx.lineWidth = 1;
    rr(ctx, x0 + w * 0.04, cy + h * 0.30, w * 0.92, h * 0.17, w * 0.05); ctx.stroke();
    // heavy brow ridge
    ctx.fillStyle = shade(STONE.base, v * (o.heavyBrow ? 0.66 : 0.8));
    rr(ctx, x0 + w * 0.10, cy - h * 0.26, w * 0.80, h * (o.heavyBrow ? 0.17 : 0.12), w * 0.04); ctx.fill();
    // eyes
    const ey = cy - h * 0.08, ex = w * 0.21, er = Math.max(1.1, w * 0.045);
    if (o.eyeStyle === 2) {
      ctx.strokeStyle = '#22303a';
      ctx.lineWidth = Math.max(1.2, w * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx - ex - er * 1.6, ey); ctx.lineTo(cx - ex + er * 1.6, ey);
      ctx.moveTo(cx + ex - er * 1.6, ey); ctx.lineTo(cx + ex + er * 1.6, ey);
      ctx.stroke();
    } else {
      const pulse = 0.75 + 0.25 * Math.sin(o.t * 2.4 + cx * 0.05);
      ctx.fillStyle = o.eyeGlow;
      ctx.globalAlpha = o.eyeStyle === 1 ? 0.95 * pulse : 0.9;
      ctx.beginPath(); ctx.arc(cx - ex, ey, er * (o.eyeStyle === 1 ? 1.15 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + ex, ey, er * (o.eyeStyle === 1 ? 1.15 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (o.eyeStyle === 1) {
        ctx.fillStyle = '#eaffff';
        ctx.beginPath(); ctx.arc(cx - ex, ey, er * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + ex, ey, er * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
    // nose ridge
    ctx.strokeStyle = 'rgba(38,52,61,0.75)';
    ctx.lineWidth = Math.max(1, w * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx, ey + h * 0.03);
    ctx.lineTo(cx, cy + h * 0.13);
    ctx.lineTo(cx + w * 0.055, cy + h * 0.16);
    ctx.stroke();
    // mouth slit
    ctx.strokeStyle = '#22303a';
    ctx.lineWidth = Math.max(1.2, w * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy + h * 0.235);
    ctx.lineTo(cx + w * 0.15, cy + h * 0.235);
    ctx.stroke();
    // carved cheek / speed lines
    ctx.strokeStyle = 'rgba(38,52,61,0.4)';
    ctx.lineWidth = Math.max(0.8, w * 0.022);
    const lines = o.cheekLines;
    for (let i = 0; i < lines; i++) {
      const lx = x0 + w * (0.16 + i * 0.10);
      ctx.beginPath();
      ctx.moveTo(lx, y0 + h * 0.58);
      ctx.lineTo(lx + w * 0.02, y0 + h * 0.80);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1m(cx, w) - w * (0.16 + i * 0.10), y0 + h * 0.58);
      ctx.lineTo(x1m(cx, w) - w * (0.18 + i * 0.10), y0 + h * 0.80);
      ctx.stroke();
    }
    function x1m(c, ww) { return c + ww / 2; }
    // snow cap on the crown + corner dusting
    snowCapTop(ctx, x0 + w * 0.03, x0 + w * 0.97, y0 + h * 0.055, h * 0.13, o.seed, o.snowCover);
    ctx.fillStyle = 'rgba(238,247,250,0.75)';
    ctx.beginPath(); ctx.arc(x0 + w * 0.10, y0 + h * 0.16, w * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x0 + w * 0.90, y0 + h * 0.13, w * 0.035, 0, Math.PI * 2); ctx.fill();
    // damage: cracks + chips deepen in 3 states
    if (o.dmg >= 1) {
      ctx.strokeStyle = 'rgba(24,34,41,0.8)';
      ctx.lineWidth = Math.max(1, w * 0.026);
      crack(ctx, x0 + w * 0.72, y0 + h * 0.10, h * 0.4, 1.9, o.seed + 31);
      crack(ctx, x0 + w * 0.15, y0 + h * 0.85, h * 0.3, -0.7, o.seed + 47);
      ctx.fillStyle = 'rgba(30,42,50,0.55)';
      ctx.beginPath();
      ctx.moveTo(x0 + w, y0 + h * 0.99);
      ctx.lineTo(x0 + w * 0.86, y0 + h * 0.99);
      ctx.lineTo(x0 + w, y0 + h * 0.84);
      ctx.closePath(); ctx.fill();
    }
    if (o.dmg >= 2) {
      ctx.strokeStyle = o.coreGlow ? 'rgba(255,150,50,0.9)' : 'rgba(20,30,38,0.9)';
      ctx.lineWidth = Math.max(1.1, w * 0.034);
      crack(ctx, cx - w * 0.05, y0 + h * 0.3, h * 0.55, 1.35, o.seed + 71);
      crack(ctx, x0 + w * 0.3, y0 + h * 0.06, h * 0.42, 2.2, o.seed + 97);
      crack(ctx, x0 + w * 0.55, y0 + h * 0.95, h * 0.34, -1.9, o.seed + 113);
      if (o.coreGlow) {
        ctx.strokeStyle = 'rgba(255,190,90,0.55)';
        ctx.lineWidth = Math.max(2, w * 0.07);
        crack(ctx, cx - w * 0.05, y0 + h * 0.3, h * 0.55, 1.35, o.seed + 71);
      }
      ctx.fillStyle = 'rgba(30,42,50,0.6)';
      ctx.beginPath();
      ctx.moveTo(x0, y0 + h * 0.99);
      ctx.lineTo(x0 + w * 0.15, y0 + h * 0.99);
      ctx.lineTo(x0, y0 + h * 0.82);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.98, y0);
      ctx.lineTo(x0 + w * 0.84, y0);
      ctx.lineTo(x0 + w * 0.98, y0 + h * 0.13);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawEnemy(ctx, kind, x, y, s, t, hpFrac) {
    t = t || 0;
    hpFrac = (hpFrac === undefined) ? 1 : clamp(hpFrac, 0, 1);
    const dmg = hpFrac > 0.66 ? 0 : (hpFrac > 0.33 ? 1 : 2);
    const seedBase = (Math.round(x) * 131 + Math.round(y) * 17) | 0;
    const variant = hash2(Math.round(x / 4), Math.round(y / 4), 9);
    const tint = 0.94 + variant * 0.13;
    const eyeStyle = variant < 0.4 ? 0 : (variant < 0.75 ? 1 : 2);
    // ground shadow
    ctx.fillStyle = 'rgba(8,16,22,0.30)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.52, s * 0.52, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // plinth
    ctx.fillStyle = shade(STONE.base, tint * 0.68);
    rr(ctx, x - s * 0.56, y - s * 0.56, s * 1.12, s * 1.12, s * 0.10); ctx.fill();
    ctx.strokeStyle = 'rgba(30,42,50,0.65)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    rr(ctx, x - s * 0.56, y - s * 0.56, s * 1.12, s * 1.12, s * 0.10); ctx.stroke();
    ctx.fillStyle = 'rgba(240,249,252,0.5)';
    ctx.fillRect(x - s * 0.50, y - s * 0.56, s * 1.0, s * 0.045);

    const base = {
      tint: tint, t: t, dmg: dmg, eyeStyle: eyeStyle,
      eyeGlow: '#8fe3ff', heavyBrow: false, cheekLines: 1,
      coreGlow: false, snowCover: 1, seed: seedBase
    };
    if (kind === 'walker') {
      drawStatueHalf(ctx, x, y - s * 0.03, s * 0.92, s * 0.98, base);
    } else if (kind === 'runner') {
      const o = Object.assign({}, base, { cheekLines: 3, eyeGlow: '#cfeeff', seed: seedBase + 5 });
      drawStatueHalf(ctx, x, y - s * 0.02, s * 0.68, s * 1.04, o);
    } else if (kind === 'brute') {
      const o = Object.assign({}, base, { heavyBrow: true, eyeGlow: '#ffb02e', coreGlow: true, cheekLines: 1, seed: seedBase + 11 });
      drawStatueHalf(ctx, x, y - s * 0.03, s * 1.04, s * 0.94, o);
      // amber core glow seeping from the brow seam at heavy damage
      if (dmg >= 2) {
        const g = ctx.createRadialGradient(x, y - s * 0.05, 0, x, y - s * 0.05, s * 0.4);
        g.addColorStop(0, 'rgba(255,150,50,0.20)');
        g.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'splitter') {
      const gap = s * (0.03 + dmg * 0.035);
      const oL = Object.assign({}, base, { cheekLines: 0, seed: seedBase + 21 });
      const oR = Object.assign({}, base, { cheekLines: 0, seed: seedBase + 33 });
      drawStatueHalf(ctx, x - s * 0.235 - gap / 2, y - s * 0.03, s * 0.47, s * 0.94, oL);
      drawStatueHalf(ctx, x + s * 0.235 + gap / 2, y - s * 0.03, s * 0.47, s * 0.94, oR);
      // dark fissure between the halves
      ctx.fillStyle = 'rgba(16,24,30,0.85)';
      ctx.fillRect(x - gap / 2, y - s * 0.48, gap, s * 0.9);
    } else { /* mini */
      const o = Object.assign({}, base, { cheekLines: 0, eyeGlow: '#aeeaff', seed: seedBase + 51 });
      drawStatueHalf(ctx, x, y - s * 0.02, s * 0.84, s * 0.86, o);
    }
  }

  /* ================= ORBS + SHARD ================= */
  const ORB_COLORS = {
    buster: '#ffd94d', fire: '#ff8a3c', ice: '#8feaff',
    lightning: '#d3a6ff', ghost: '#a4ffc0',
    // engine keys (OTYPES in main.js)
    iron: '#aef3ff', primary: '#ffd94d', frostflame: '#7ef0d4',
    bomb: '#ffb03a', blizzard: '#cfe9ff', wraith: '#b7a6ff',
    assassin: '#ff5a7a', lightningrod: '#ffe95e'
  };
  function orbColor(type) { return ORB_COLORS[type] || ORB_COLORS.buster; }

  function drawShard(ctx, x, y, s, t) {
    t = t || 0;
    const pulse = 1 + 0.13 * Math.sin(t * 3.2 + x * 0.11 + y * 0.07);
    const w = s * 0.62 * pulse, h = s * pulse;
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.85);
    g.addColorStop(0, 'rgba(120,235,255,0.35)');
    g.addColorStop(1, 'rgba(120,235,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = '#57e6ff';
    ctx.fill();
    ctx.strokeStyle = '#d8fbff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.28);
    ctx.lineTo(w * 0.20, 0);
    ctx.lineTo(0, h * 0.28);
    ctx.lineTo(-w * 0.20, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(240,254,255,0.95)';
    ctx.fill();
    ctx.restore();
  }

  window.PV_ART = {
    drawBackdrop: drawBackdrop,
    drawHero: drawHero,
    drawEnemy: drawEnemy,
    orbColor: orbColor,
    drawShard: drawShard
  };
})();

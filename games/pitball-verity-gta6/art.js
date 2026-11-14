/* PITBALL — VICE: art module (PV_ART)
 * Same PV_ART interface as Pitball Verity's art.js, fully redrawn:
 * a Vice beach-street crater at sunset, painted with visible brush work.
 * Enemies are painted blocky CARS (pre-rendered to offscreen sprite
 * canvases at load, per kind x damage x variant — full speed in play),
 * the hero is a tiny top-down vice driver, shards are painted cash bills,
 * and the backdrop is a cached painted street — lane-marked asphalt,
 * palm silhouettes, neon light spill — that now scrolls ENDLESSLY upward:
 * drawBackdrop tiles the street with a mirror-flip so the strip never
 * ends and there is no beach at the top any more; palms, crosswalks and
 * the road-painted VICE are world-anchored and pass by as you climb.
 * All canvas code-drawn. No external assets. No Rockstar anything —
 * original Vice-flavoured art only.
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

  /* ---------- painted-brush helpers ----------
   * dab(): one short, thick, slightly jittered brush stroke.
   * paintPath(): fill a path, then lay broken dab strokes of lighter and
   * darker shades inside it (clipped) so every surface reads HAND-PAINTED
   * rather than flat-vector. Deterministic per seed — sprites never shimmer. */
  function dab(ctx, x, y, len, ang, w, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
    ctx.restore();
  }
  function paintPath(ctx, pathFn, base, seed, opt) {
    opt = opt || {};
    const rnd = mulberry32(seed);
    pathFn();
    ctx.fillStyle = base;
    ctx.fill();
    ctx.save();
    pathFn();
    ctx.clip();
    const bb = opt.box;               // [x0, y0, x1, y1] dab field
    const n = opt.dabs || 46;
    const light = shade(base, 1.22), dark = shade(base, 0.78), deep = shade(base, 0.6);
    for (let i = 0; i < n; i++) {
      const x = bb[0] + rnd() * (bb[2] - bb[0]);
      const y = bb[1] + rnd() * (bb[3] - bb[1]);
      const c = rnd();
      const col = c < 0.42 ? light : (c < 0.8 ? dark : deep);
      dab(ctx, x, y, (opt.dabLen || 15) * (0.6 + rnd() * 0.8), (opt.ang || 0) + (rnd() - 0.5) * 0.7,
        (opt.dabW || 5) * (0.7 + rnd() * 0.7), col, 0.10 + rnd() * 0.13);
    }
    ctx.restore();
    if (opt.stroke) {
      pathFn();
      ctx.strokeStyle = opt.stroke;
      ctx.lineWidth = opt.strokeW || 2.4;
      ctx.stroke();
    }
  }

  /* ================= BACKDROP — Vice beach street (cached) ================= */
  const bgCache = new Map();

  function asphalt(ctx, W, H, seed) {
    const rnd = mulberry32(seed);
    ctx.fillStyle = '#2c1e36';
    ctx.fillRect(0, 0, W, H);
    const cell = 64;
    const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const v = hash2(i, j, seed);
        const x = i * cell + (rnd() - 0.5) * 5, y = j * cell + (rnd() - 0.5) * 5;
        ctx.fillStyle = shade('#3a2a48', 0.82 + v * 0.4);
        ctx.fillRect(x - 2, y - 2, cell + 4, cell + 4);
        // worn patches of warmer, sun-bleached asphalt
        if (v > 0.62) {
          ctx.fillStyle = 'rgba(122,84,96,' + (0.10 + (v - 0.62) * 0.3) + ')';
          ctx.beginPath();
          ctx.ellipse(x + cell * (0.3 + v * 0.3), y + cell * 0.5, cell * 0.42, cell * 0.26, v * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    // seams
    ctx.strokeStyle = 'rgba(16,8,24,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) { ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell + (hash2(i, 3, seed) - 0.5) * 6, H); }
    for (let j = 0; j <= rows; j++) { ctx.moveTo(0, j * cell); ctx.lineTo(W, j * cell + (hash2(3, j, seed) - 0.5) * 6); }
    ctx.stroke();
    // cracks
    ctx.strokeStyle = 'rgba(14,6,20,0.6)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        if (hash2(i, j, seed + 7) < 0.34)
          crack(ctx, i * cell + hash2(i, j, 3) * cell, j * cell + hash2(i, j, 4) * cell,
            cell * (0.3 + hash2(i, j, 5) * 0.4), hash2(i, j, 6) * Math.PI * 2, seed + i * 31 + j * 57);
    // grain
    const n = Math.floor(W * H / 2400);
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(10,5,16,0.16)' : 'rgba(214,178,190,0.10)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.6 + rnd() * 2.6, 1.6 + rnd() * 2.6);
    }
  }

  function palm(ctx, x, y, s, lean, seed) {
    // silhouette palm: trunk of stacked dabs along a curve, frond arcs on top
    const rnd = mulberry32(seed);
    ctx.strokeStyle = '#1c0b28';
    ctx.lineCap = 'round';
    const segs = 7;
    let px = x, py = y, dx = lean * s * 0.05;
    const pts = [[px, py]];
    for (let i = 1; i <= segs; i++) {
      px += dx; py -= s * 0.16; dx += lean * s * 0.012;
      pts.push([px, py]);
      ctx.lineWidth = s * 0.10 * (1 - i / (segs + 2));
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(px, py); ctx.stroke();
    }
    const cx = px, cy = py;
    for (let f = 0; f < 7; f++) {
      const a0 = Math.PI * (0.95 + f * 0.19) + (rnd() - 0.5) * 0.15;
      const len = s * (0.62 + rnd() * 0.3);
      ctx.lineWidth = s * 0.045;
      for (let k = 0; k < 4; k++) {
        const t0 = k / 4, t1 = (k + 1) / 4;
        const xa = cx + Math.cos(a0) * len * t0, ya = cy + Math.sin(a0) * len * t0 * 0.55 + len * 0.30 * t0 * t0;
        const xb = cx + Math.cos(a0) * len * t1, yb = cy + Math.sin(a0) * len * t1 * 0.55 + len * 0.30 * t1 * t1;
        ctx.lineWidth = s * 0.045 * (1 - t0 * 0.55);
        ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
      }
    }
    ctx.fillStyle = '#1c0b28';
    ctx.beginPath(); ctx.arc(cx - s * 0.05, cy + s * 0.05, s * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 0.06, cy + s * 0.07, s * 0.045, 0, Math.PI * 2); ctx.fill();
  }

  function renderBackdrop(W, H) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const rnd = mulberry32(90210);

    asphalt(ctx, W, H, 4711);

    /* street furniture painted ON the asphalt: lane dashes, crosswalk,
     * manholes, oil stains, neon light spill, road-painted VICE */
    // lane dashes (worn, hand-painted strokes)
    const laneX = [0.215, 0.395, 0.575, 0.755].map(f => f * W + 14);
    for (const lx of laneX) {
      for (let y = 128; y < H - 56; y += 68) {
        if (rnd() < 0.14) continue;                       // worn away entirely
        const jx = lx + (rnd() - 0.5) * 3;
        ctx.save();
        ctx.globalAlpha = 0.30 + rnd() * 0.22;
        ctx.strokeStyle = rnd() < 0.3 ? '#ffd98a' : '#efe6cf';
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(jx, y); ctx.lineTo(jx + (rnd() - 0.5) * 2, y + 34); ctx.stroke();
        ctx.restore();
      }
    }
    // (crosswalks are world-anchored now — drawn in drawBackdrop so they
    // pass by as the strip scrolls; the cached tile itself must contain
    // only features that read fine mirrored: dashes, manholes, stains.)
    // manholes
    for (const [mx, my] of [[W * 0.32, H * 0.44], [W * 0.68, H * 0.62]]) {
      ctx.fillStyle = 'rgba(12,6,18,0.5)';
      ctx.beginPath(); ctx.arc(mx, my, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,160,180,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.stroke();
    }
    // oil stains with a faint rainbow sheen edge
    for (let i = 0; i < 6; i++) {
      const x = rnd() * W, y = 150 + rnd() * (H - 260), r = 18 + rnd() * 30;
      ctx.fillStyle = 'rgba(8,4,14,' + (0.14 + rnd() * 0.10) + ')';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,220,200,0.10)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // neon light spill from off-screen signs (left pink, right teal)
    let gl = ctx.createRadialGradient(0, H * 0.34, 0, 0, H * 0.34, W * 0.55);
    gl.addColorStop(0, 'rgba(255,79,163,0.13)'); gl.addColorStop(1, 'rgba(255,79,163,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    gl = ctx.createRadialGradient(W, H * 0.58, 0, W, H * 0.58, W * 0.55);
    gl.addColorStop(0, 'rgba(46,230,200,0.11)'); gl.addColorStop(1, 'rgba(46,230,200,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    // Road-painted VICE and the palm silhouettes are NOT baked into the
    // tile any more: the tile is mirror-flipped every other screen while
    // scrolling (text would read backwards, palms would grow downward).
    // Both are drawn world-anchored in drawBackdrop instead. The sand
    // band, ocean strip, shells/starfish, foam line and over-water sun
    // are GONE entirely — there is no beach at the top of the strip now;
    // the street runs off the top edge and never ends. A soft sunset
    // wash stays over the asphalt itself.
    const sg = ctx.createRadialGradient(W * 0.5, -10, 0, W * 0.5, -10, H * 0.52);
    sg.addColorStop(0, 'rgba(255,150,80,0.20)');
    sg.addColorStop(0.4, 'rgba(255,100,120,0.08)');
    sg.addColorStop(1, 'rgba(255,100,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.55);

    return cv;
  }

  function fleckPos(i, W, H, seed) {
    return [hash2(i, 11, seed) * W, hash2(i, 77, seed) * H];
  }

  let prewarmed = false;
  function prewarmSprites() {
    // Paint every car sprite once, up front (on the title screen), so
    // gameplay is pure drawImage blits.
    for (const kind of ['walker', 'runner', 'splitter', 'brute', 'mini'])
      for (let dmg = 0; dmg < 3; dmg++)
        for (let v = 0; v < 4; v++) {
          const key = kind + '|' + dmg + '|' + v;
          if (!spriteCache.has(key)) spriteCache.set(key, paintCar(kind, dmg, v));
        }
  }

  function drawBackdrop(ctx, scene, W, H, t, scrollY) {
    if (!prewarmed) { prewarmed = true; prewarmSprites(); }
    const key = 'vice:' + W + 'x' + H;
    let cv = bgCache.get(key);
    if (!cv) { cv = renderBackdrop(W, H); bgCache.set(key, cv); }
    t = t || 0;
    /* --- endless upward scroll -------------------------------------------
     * scrollY = world px climbed (camera). One tile = one screen of street
     * (SEG = H world px). Segments alternate normal / vertically mirrored:
     * at every seam both sides present the same tile row, so the join is
     * invisible for ANY tile content — the street just never ends. The top
     * of the screen is always mid-street: no sand, no water, no terminus. */
    const sy = Math.max(0, scrollY || 0);
    const SEG = H;
    const off = sy % SEG;
    const segBase = Math.floor(sy / SEG);
    for (let k = 0; k < 3; k++) {
      const topY = H + off - (k + 1) * SEG;
      if (topY > H || topY + SEG < 0) continue;
      if ((segBase + k) % 2 === 0) {
        ctx.drawImage(cv, 0, topY);
      } else {
        ctx.save();
        ctx.translate(0, topY + SEG); ctx.scale(1, -1);
        ctx.drawImage(cv, 0, 0);
        ctx.restore();
      }
    }
    // world-anchored dressing: screen y for a world height h
    const yFor = h => H - (h - sy);
    // palms pass by at hashed intervals (~every 430 world px), alternating
    // sides — distance-band variety without a repeating stamp
    const p0 = Math.floor(sy / 430) - 1, p1 = Math.floor((sy + H) / 430) + 1;
    for (let i = p0; i <= p1; i++) {
      if (i < 0) continue;
      const h = i * 430 + hash2(i, 5, 77) * 190;
      const y = yFor(h);
      if (y < -190 || y > H + 80) continue;
      const right = hash2(i, 9, 77) < 0.5;
      const x = right ? W - 12 - hash2(i, 3, 77) * 24 : 12 + hash2(i, 3, 77) * 24;
      palm(ctx, x, y, 92 + hash2(i, 7, 77) * 46, right ? -1 : 1, 500 + i * 131);
    }
    // crosswalk bands every ~6 screens of climb
    const cwStep = SEG * 6;
    for (let k = Math.floor(sy / cwStep); k <= Math.floor((sy + H) / cwStep) + 1; k++) {
      if (k <= 0) continue;
      const y = yFor(k * cwStep + SEG * 0.5);
      if (y < -40 || y > H + 40) continue;
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const x = 34 + i * ((W - 68) / 6);
        ctx.globalAlpha = 0.13 + hash2(i, 8, 5 + k) * 0.08;
        ctx.fillStyle = '#f2ead6';
        ctx.fillRect(x, y + (hash2(i, 2, 5 + k) - 0.5) * 4, (W - 68) / 6 - 14, 26);
      }
      ctx.restore();
    }
    // road-painted VICE every ~4 screens of climb, always upright
    const vStep = SEG * 4;
    for (let k = Math.floor(sy / vStep); k <= Math.floor((sy + H) / vStep) + 1; k++) {
      const y = yFor(k * vStep + SEG * 1.6);
      if (y < -70 || y > H + 70) continue;
      ctx.save();
      ctx.translate(W * 0.30, y);
      ctx.rotate(-Math.PI / 2);
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ff9ecf';
      ctx.fillText('V I C E', 0, 0);
      ctx.restore();
    }
    // animated life: a breathing neon flicker (the water sparkles went
    // with the ocean — there is no water any more)
    const fl = 0.05 + 0.028 * Math.sin(t * 6.3) * Math.sin(t * 1.7 + 2.0);
    const gl = ctx.createRadialGradient(0, H * 0.34, 0, 0, H * 0.34, W * 0.5);
    gl.addColorStop(0, 'rgba(255,79,163,' + Math.max(0.015, fl).toFixed(3) + ')');
    gl.addColorStop(1, 'rgba(255,79,163,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    for (const p of [fleckPos(3, W, H, 42), fleckPos(9, W, H, 42)]) {
      ctx.fillStyle = 'rgba(255,220,160,' + (0.10 + 0.10 * Math.abs(Math.sin(t * 2.2 + p[0]))).toFixed(3) + ')';
      ctx.fillRect(p[0], p[1], 2, 2);
    }
  }

  /* ================= CARS — pre-rendered painted sprites =================
   * Authored at s = 200 inside a 272px box spanning [-0.68s, +0.68s].
   * Front of every car points DOWN-screen (+y): the traffic descends
   * toward the hero. Damage states: 0 clean, 1 dented/cracked,
   * 2 wrecked (crack web, crumpled hood, scorch). */
  const CAR_COLORS = {
    walker:   ['#1fa8a0', '#ff7a5c', '#e8d8a8', '#9a7fd4', '#ef6aa5', '#57c98a'],
    runner:   ['#ff4fa3', '#ff8a2e', '#ffe93e', '#f2f2f2', '#2ee6c8', '#b06ee8'],
    splitter: ['#14555e', '#23232e', '#5f2f8c', '#7a1f3d', '#1f4d7a', '#3d3d55'],
    brute:    ['#3a2b52', '#4d5a2e', '#27354d', '#5c2434', '#333333', '#6e3b1f'],
    mini:     ['#ffd23e', '#ff6a5e', '#57e6ff', '#a4ffc0', '#ff9ecf', '#f2f2f2'],
  };
  const spriteCache = new Map();

  function carBody(g, s, o) {
    // shared sedan-ish body: o = {w, l, rad, color, seed, roof, glass}
    const w = s * o.w, l = s * o.l, x0 = -w / 2, y0 = -l / 2;
    paintPath(g, () => rr(g, x0, y0, w, l, s * o.rad), o.color, o.seed, {
      box: [x0, y0, x0 + w, y0 + l], dabs: 60, dabLen: s * 0.09, dabW: s * 0.03,
      stroke: 'rgba(20,6,26,0.85)', strokeW: Math.max(2, s * 0.016)
    });
    // hood sheen (front = +y end) and trunk shade
    const hg = g.createLinearGradient(0, y0 + l * 0.62, 0, y0 + l);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(1, 'rgba(255,255,255,0.16)');
    g.fillStyle = hg; g.fillRect(x0 + 3, y0 + l * 0.62, w - 6, l * 0.38);
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(x0 + 3, y0 + 2, w - 6, l * 0.14);
    return { w, l, x0, y0 };
  }
  function glassPanel(g, x, y, w, h, seed) {
    paintPath(g, () => rr(g, x, y, w, h, Math.min(8, h * 0.3)), '#1b2b45', seed, {
      box: [x, y, x + w, y + h], dabs: 12, dabLen: 12, dabW: 4,
      stroke: 'rgba(10,6,18,0.8)', strokeW: 2
    });
    // diagonal shine streak
    g.save();
    rr(g, x, y, w, h, Math.min(8, h * 0.3)); g.clip();
    g.strokeStyle = 'rgba(210,245,255,0.5)';
    g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + w * 0.18, y + h + 2); g.lineTo(x + w * 0.52, y - 2); g.stroke();
    g.restore();
  }
  function damageOverlay(g, s, dmg, seed, w, l) {
    if (dmg <= 0) return;
    const rnd = mulberry32(seed);
    // scratches + a dent cluster on one fender
    g.strokeStyle = 'rgba(230,235,240,0.55)';
    g.lineWidth = Math.max(1.4, s * 0.01);
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - 0.5) * w * 0.7, y = (rnd() - 0.5) * l * 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * s * 0.2, y + (rnd() - 0.5) * s * 0.08); g.stroke();
    }
    const dx = (rnd() < 0.5 ? -1 : 1) * w * 0.30, dy = l * 0.30;
    for (let i = 0; i < 9; i++)
      dab(g, dx + (rnd() - 0.5) * s * 0.12, dy + (rnd() - 0.5) * s * 0.12, s * 0.05, rnd() * 3, s * 0.02, '#140a18', 0.25 + rnd() * 0.2);
    if (dmg >= 2) {
      // crumpled hood: dark jagged patch across the front
      g.fillStyle = 'rgba(16,8,20,0.55)';
      g.beginPath();
      g.moveTo(-w * 0.42, l * 0.5);
      for (let x = -w * 0.42; x <= w * 0.42; x += w * 0.12)
        g.lineTo(x, l * 0.5 - Math.abs(rnd() - 0.3) * s * 0.07);
      g.lineTo(w * 0.42, l * 0.5);
      g.closePath(); g.fill();
      // scorch smear down one side
      for (let i = 0; i < 12; i++)
        dab(g, -w * 0.44 + rnd() * s * 0.05, (rnd() - 0.5) * l * 0.8, s * 0.06, Math.PI / 2, s * 0.022, '#0d0610', 0.20 + rnd() * 0.18);
      // one headlight smashed dark
      g.fillStyle = 'rgba(10,8,14,0.9)';
      g.beginPath(); g.arc(-w * 0.30, l * 0.5 - s * 0.015, s * 0.035, 0, Math.PI * 2); g.fill();
    }
  }
  function glassDamage(g, dmg, seed, x, y, w, h) {
    if (dmg <= 0) return;
    g.strokeStyle = 'rgba(235,250,255,0.8)';
    g.lineWidth = 1.6;
    crack(g, x + w * 0.3, y + h * 0.5, Math.min(w, h) * (dmg >= 2 ? 1.5 : 0.8), 0.6, seed);
    if (dmg >= 2) crack(g, x + w * 0.68, y + h * 0.45, Math.min(w, h) * 1.1, 2.4, seed + 7);
  }

  function paintCar(kind, dmg, variant) {
    const cv = document.createElement('canvas');
    cv.width = 272; cv.height = 272;
    const g = cv.getContext('2d');
    const s = 200, seed = 1000 + variant * 131 + dmg * 17;
    g.translate(136, 136);
    const color = CAR_COLORS[kind][variant % CAR_COLORS[kind].length];
    const rnd = mulberry32(seed);

    // ground shadow + soft parking pad (the car's visual anchor)
    g.fillStyle = 'rgba(8,4,14,0.30)';
    g.beginPath(); g.ellipse(0, s * 0.05, s * 0.60, s * 0.66, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(10,5,18,0.16)';
    rr(g, -s * 0.58, -s * 0.64, s * 1.16, s * 1.28, s * 0.08); g.fill();

    if (kind === 'mini') {
      /* scooter: teardrop body, seat, tiny windshield, rider helmet dome */
      paintPath(g, () => {
        g.beginPath();
        g.moveTo(0, -s * 0.52);
        g.bezierCurveTo(s * 0.30, -s * 0.30, s * 0.30, s * 0.28, s * 0.13, s * 0.52);
        g.lineTo(-s * 0.13, s * 0.52);
        g.bezierCurveTo(-s * 0.30, s * 0.28, -s * 0.30, -s * 0.30, 0, -s * 0.52);
        g.closePath();
      }, color, seed, { box: [-s * 0.3, -s * 0.52, s * 0.3, s * 0.52], dabs: 34, dabLen: s * 0.07, dabW: s * 0.026, stroke: 'rgba(20,6,26,0.85)', strokeW: 3 });
      // floorboard + seat
      g.fillStyle = '#241428';
      rr(g, -s * 0.10, -s * 0.30, s * 0.20, s * 0.34, s * 0.06); g.fill();
      rr(g, -s * 0.13, s * 0.06, s * 0.26, s * 0.30, s * 0.07); g.fill();
      // windshield dot at the front (+y) and headlight
      glassPanel(g, -s * 0.11, s * 0.30, s * 0.22, s * 0.13, seed + 4);
      g.fillStyle = '#fff6c8';
      g.beginPath(); g.arc(0, s * 0.47, s * 0.045, 0, Math.PI * 2); g.fill();
      // rider: helmet dome + shoulders
      g.fillStyle = '#f2f2f2';
      g.beginPath(); g.arc(0, -s * 0.06, s * 0.155, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,6,26,0.8)'; g.lineWidth = 2.4;
      g.beginPath(); g.arc(0, -s * 0.06, s * 0.155, 0, Math.PI * 2); g.stroke();
      g.fillStyle = shade(color, 0.8);
      g.beginPath(); g.arc(0, -s * 0.06, s * 0.10, Math.PI * 0.95, Math.PI * 1.95); g.fill();
      g.fillStyle = '#12303e';
      rr(g, -s * 0.09, -s * 0.10, s * 0.18, s * 0.05, 3); g.fill();   // visor
      damageOverlay(g, s, dmg, seed + 9, s * 0.5, s * 1.0);
      return cv;
    }

    /* four-wheeled kinds share a chassis painter */
    const spec = {
      walker:   { w: 0.84, l: 1.10, rad: 0.12 },
      runner:   { w: 0.76, l: 1.16, rad: 0.16 },
      splitter: { w: 0.88, l: 1.26, rad: 0.09 },
      brute:    { w: 0.98, l: 1.18, rad: 0.07 },
    }[kind];
    const w = s * spec.w, l = s * spec.l;

    // tires peeking out
    g.fillStyle = '#120a18';
    const tw = s * 0.09, th = s * 0.20;
    for (const [tx, ty] of [[-w / 2 - tw * 0.4, -l * 0.30], [w / 2 - tw * 0.6, -l * 0.30], [-w / 2 - tw * 0.4, l * 0.16], [w / 2 - tw * 0.6, l * 0.16]]) {
      rr(g, tx, ty, tw, th, 3); g.fill();
    }

    if (kind === 'splitter') {
      // two-section stretch car; the seam gap widens as damage grows
      const gap = s * (0.02 + dmg * 0.03);
      const secL = (l - gap) / 2;
      for (const sgn of [-1, 1]) {
        const cy = sgn * (gap / 2 + secL / 2);
        paintPath(g, () => rr(g, -w / 2, cy - secL / 2, w, secL, s * 0.07), color, seed + (sgn > 0 ? 3 : 0), {
          box: [-w / 2, cy - secL / 2, w / 2, cy + secL / 2], dabs: 34, dabLen: s * 0.08, dabW: s * 0.028,
          stroke: 'rgba(20,6,26,0.85)', strokeW: 3
        });
      }
      // gold side stripe through both sections
      g.fillStyle = 'rgba(255,217,77,0.85)';
      g.fillRect(-w / 2 + 3, -s * 0.045, w - 6, s * 0.028);
      g.fillRect(-w / 2 + 3, s * 0.045 - s * 0.028, w - 6, s * 0.028);
      // front glass + roof glass on the cab (front section, +y)
      glassPanel(g, -w * 0.34, l * 0.26, w * 0.68, l * 0.11, seed + 5);
      glassDamage(g, dmg, seed + 21, -w * 0.34, l * 0.26, w * 0.68, l * 0.11);
      glassPanel(g, -w * 0.32, -l * 0.40, w * 0.64, l * 0.09, seed + 6);
    } else {
      const B = carBody(g, s, { w: spec.w, l: spec.l, rad: spec.rad, color, seed });
      // roof (two-tone on sedans, body-colour + stripe on runners, cargo on brutes)
      if (kind === 'brute') {
        paintPath(g, () => rr(g, -w * 0.36, -l * 0.30, w * 0.72, l * 0.44, s * 0.04), shade(color, 1.18), seed + 8, {
          box: [-w * 0.36, -l * 0.30, w * 0.36, l * 0.14], dabs: 26, dabLen: s * 0.07, dabW: s * 0.026,
          stroke: 'rgba(20,6,26,0.8)', strokeW: 2.4
        });
        // roof cargo box + cross bars
        g.fillStyle = 'rgba(14,8,20,0.55)';
        rr(g, -w * 0.26, -l * 0.20, w * 0.52, l * 0.22, 4); g.fill();
        g.strokeStyle = 'rgba(230,230,240,0.5)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-w * 0.26, -l * 0.09); g.lineTo(w * 0.26, -l * 0.09); g.stroke();
        // amber light bar across the cab front
        for (let i = 0; i < 5; i++) {
          g.fillStyle = '#ffb02e';
          g.beginPath(); g.arc(-w * 0.28 + i * w * 0.14, l * 0.335, s * 0.026, 0, Math.PI * 2); g.fill();
        }
        // bull bar
        g.strokeStyle = '#0e0814'; g.lineWidth = s * 0.035;
        g.beginPath(); g.moveTo(-w * 0.34, l * 0.52); g.lineTo(w * 0.34, l * 0.52); g.stroke();
      } else {
        const roofCol = kind === 'runner' ? shade(color, 1.1) : '#f4ead2';
        paintPath(g, () => rr(g, -w * 0.33, -l * 0.13, w * 0.66, l * 0.30, s * 0.06), roofCol, seed + 8, {
          box: [-w * 0.33, -l * 0.13, w * 0.33, l * 0.17], dabs: 20, dabLen: s * 0.06, dabW: s * 0.024,
          stroke: 'rgba(20,6,26,0.75)', strokeW: 2.2
        });
        if (kind === 'runner') {
          // racing stripe nose-to-tail
          const sg2 = g.createLinearGradient(0, -l / 2, 0, l / 2);
          sg2.addColorStop(0, '#ff4fa3'); sg2.addColorStop(1, '#ffe93e');
          g.fillStyle = sg2;
          g.fillRect(-s * 0.055, -l / 2 + 3, s * 0.11, l - 6);
          // rear spoiler (top = rear)
          g.fillStyle = '#1c0b28';
          rr(g, -w * 0.44, -l * 0.56, w * 0.88, s * 0.07, 3); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(-w * 0.44, -l * 0.56, w * 0.88, 2.4);
        }
      }
      // windshield (front, +y) + rear glass
      glassPanel(g, -w * 0.35, l * 0.185, w * 0.70, l * 0.115, seed + 5);
      glassDamage(g, dmg, seed + 21, -w * 0.35, l * 0.185, w * 0.70, l * 0.115);
      glassPanel(g, -w * 0.33, -l * 0.315, w * 0.66, l * 0.095, seed + 6);
      if (dmg >= 2) glassDamage(g, 1, seed + 33, -w * 0.33, -l * 0.315, w * 0.66, l * 0.095);
      // door seams + mirrors
      g.strokeStyle = 'rgba(16,6,22,0.45)'; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-w * 0.42, -l * 0.02); g.lineTo(w * 0.42, -l * 0.02);
      g.moveTo(-w / 2 + 2, -l * 0.02); g.lineTo(-w / 2 + 2, l * 0.17);
      g.moveTo(w / 2 - 2, -l * 0.02); g.lineTo(w / 2 - 2, l * 0.17);
      g.stroke();
      g.fillStyle = shade(color, 0.85);
      rr(g, -w / 2 - s * 0.045, l * 0.16, s * 0.05, s * 0.07, 2); g.fill();
      rr(g, w / 2 - s * 0.005, l * 0.16, s * 0.05, s * 0.07, 2); g.fill();
      // headlights (front = bottom) + grille + taillights (top)
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(-w * 0.30, l * 0.485, s * 0.038, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(w * 0.30, l * 0.485, s * 0.038, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(12,6,16,0.8)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-w * 0.18, l * 0.50); g.lineTo(w * 0.18, l * 0.50); g.stroke();
      g.fillStyle = '#ff3b4e';
      g.fillRect(-w * 0.36, -l * 0.50, w * 0.20, s * 0.028);
      g.fillRect(w * 0.16, -l * 0.50, w * 0.20, s * 0.028);
    }
    damageOverlay(g, s, dmg, seed + 9, w, l);
    return cv;
  }

  function drawEnemy(ctx, kind, x, y, s, t, hpFrac) {
    hpFrac = (hpFrac === undefined) ? 1 : clamp(hpFrac, 0, 1);
    const dmg = hpFrac > 0.66 ? 0 : (hpFrac > 0.33 ? 1 : 2);
    // Variant keys off the car's LANE (x) only: L1 traffic descends in
    // fixed lanes, so each car keeps ONE sprite for its whole life —
    // the cache actually caches. (A y-term here re-painted sprites
    // continuously and stalled the main thread.)
    const salt = { walker: 1, runner: 2, splitter: 3, brute: 4, mini: 5 }[kind] || 0;
    const variant = Math.floor(hash2(Math.round(x / 8), salt, 9) * 4);
    const key = kind + '|' + dmg + '|' + variant;
    let cv = spriteCache.get(key);
    if (!cv) { cv = paintCar(kind, dmg, variant); spriteCache.set(key, cv); }
    const ext = 1.36 * s;
    ctx.drawImage(cv, x - ext / 2, y - ext / 2, ext, ext);
    if (hpFrac < 1 && dmg === 0) {
      // early damage has no baked state yet at state 0 thresholds — thin
      // scratch line so first hits still read
      ctx.strokeStyle = 'rgba(240,245,250,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.1);
      ctx.lineTo(x + s * 0.05, y + s * 0.05);
      ctx.stroke();
    }
  }

  /* ================= HERO — the Vice driver, top-down ================= */
  function drawHero(ctx, x, y, s, t, firing) {
    t = t || 0;
    const u = s / 34;
    const bob = Math.sin(t * 2.3) * 0.9 * u;
    const SKIN = '#eebd90', SKIN_D = '#cf9668';
    ctx.save();
    ctx.translate(x, y + bob);
    // soft shadow
    ctx.fillStyle = 'rgba(6,4,14,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.40, s * 0.46, s * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs: cream chinos south from the shirt hem
    for (const sgn of [-1, 1]) {
      const lx = sgn < 0 ? -0.225 * s : 0.045 * s;
      paintPath(ctx, () => rr(ctx, lx, 0.20 * s, 0.18 * s, 0.16 * s, 2.5 * u), '#e8e0cc', sgn < 0 ? 777010 : 777011, {
        box: [lx, 0.20 * s, lx + 0.18 * s, 0.36 * s], dabs: 7, dabLen: 5 * u, dabW: 2.6 * u, ang: Math.PI / 2,
        stroke: 'rgba(90,70,40,0.55)', strokeW: 1 * u
      });
    }
    // sneakers: teal with pink stripe, white sole, lace ticks
    for (const sgn of [-1, 1]) {
      const lx = sgn < 0 ? -0.26 * s : 0.06 * s;
      ctx.fillStyle = '#f2ede2';
      rr(ctx, lx - 0.015 * s, 0.40 * s, 0.23 * s, 0.075 * s, 2.5 * u); ctx.fill();
      paintPath(ctx, () => rr(ctx, lx, 0.315 * s, 0.20 * s, 0.115 * s, 2.5 * u), '#0f6e6e', sgn < 0 ? 777012 : 777013, {
        box: [lx, 0.315 * s, lx + 0.20 * s, 0.43 * s], dabs: 8, dabLen: 5 * u, dabW: 2.6 * u,
        stroke: 'rgba(10,30,30,0.8)', strokeW: 1.1 * u
      });
      ctx.fillStyle = '#ff4fa3';
      ctx.fillRect(lx, 0.345 * s, 0.20 * s, 0.04 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1 * u;
      for (let i = 0; i < 3; i++) {
        const ly = (0.375 + i * 0.028) * s;
        ctx.beginPath(); ctx.moveTo(lx + 0.055 * s, ly); ctx.lineTo(lx + 0.145 * s, ly); ctx.stroke();
      }
    }
    // torso: teal Vice shirt — shaped, open collar, hibiscus print, buttons
    const shirtPath = () => {
      ctx.beginPath();
      ctx.moveTo(-0.315 * s, -0.03 * s);
      ctx.quadraticCurveTo(-0.325 * s, 0.12 * s, -0.27 * s, 0.26 * s);
      ctx.lineTo(0.27 * s, 0.26 * s);
      ctx.quadraticCurveTo(0.325 * s, 0.12 * s, 0.315 * s, -0.03 * s);
      ctx.quadraticCurveTo(0, -0.10 * s, -0.315 * s, -0.03 * s);
      ctx.closePath();
    };
    paintPath(ctx, shirtPath, '#17b8a6', 777001, {
      box: [-0.315 * s, -0.03 * s, 0.315 * s, 0.26 * s], dabs: 24, dabLen: 8 * u, dabW: 3.4 * u,
      stroke: 'rgba(20,6,26,0.85)', strokeW: 1.5 * u
    });
    ctx.fillStyle = '#ff9ecf';
    for (const [fx, fy, fr] of [[-0.17, 0.09, 0.045], [0.04, 0.185, 0.04], [0.185, 0.05, 0.048], [-0.05, 0.13, 0.03], [0.13, 0.16, 0.028]]) {
      ctx.beginPath(); ctx.arc(fx * s, fy * s, fr * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc((fx + fr * 0.9) * s, (fy + fr * 0.9) * s, fr * 0.7 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(fx * s, fy * s, fr * 0.32 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9ecf';
    }
    // open collar: skin V + gold chain
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.moveTo(-0.095 * s, -0.075 * s);
    ctx.lineTo(0.095 * s, -0.075 * s);
    ctx.lineTo(0, 0.075 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 1.6 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.062 * s, -0.045 * s); ctx.quadraticCurveTo(0, 0.035 * s, 0.062 * s, -0.045 * s); ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(0, 0.038 * s, 0.016 * s, 0, Math.PI * 2); ctx.fill();
    // collar flaps + button line
    ctx.fillStyle = '#0f9484';
    ctx.beginPath(); ctx.moveTo(-0.115 * s, -0.085 * s); ctx.lineTo(-0.02 * s, -0.055 * s); ctx.lineTo(-0.085 * s, 0.03 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.115 * s, -0.085 * s); ctx.lineTo(0.02 * s, -0.055 * s); ctx.lineTo(0.085 * s, 0.03 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(240,255,250,0.85)';
    for (const by of [0.115, 0.175, 0.23]) { ctx.beginPath(); ctx.arc(0, by * s, 0.011 * s, 0, Math.PI * 2); ctx.fill(); }
    // LEFT arm: short sleeve, forearm down, gold watch, hand
    paintPath(ctx, () => { ctx.beginPath(); ctx.arc(-0.375 * s, -0.02 * s, 0.115 * s, 0, Math.PI * 2); }, '#17b8a6', 777014, {
      box: [-0.49 * s, -0.135 * s, -0.26 * s, 0.095 * s], dabs: 8, dabLen: 5 * u, dabW: 2.8 * u,
      stroke: 'rgba(20,6,26,0.85)', strokeW: 1.3 * u
    });
    ctx.fillStyle = SKIN;
    ctx.save();
    ctx.translate(-0.415 * s, 0.075 * s); ctx.rotate(0.25);
    rr(ctx, -0.055 * s, -0.02 * s, 0.11 * s, 0.17 * s, 3 * u); ctx.fill();
    ctx.fillStyle = SKIN_D;
    ctx.fillRect(-0.055 * s, 0.115 * s, 0.11 * s, 0.022 * s);
    ctx.restore();
    ctx.fillStyle = '#ffd94d';   // watch
    ctx.beginPath(); ctx.arc(-0.435 * s, 0.155 * s, 0.028 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#123a3a';
    ctx.beginPath(); ctx.arc(-0.435 * s, 0.155 * s, 0.016 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN;        // hand
    ctx.beginPath(); ctx.arc(-0.44 * s, 0.215 * s, 0.058 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,95,50,0.7)'; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(-0.465 * s, 0.20 * s); ctx.lineTo(-0.465 * s, 0.235 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.44 * s, 0.205 * s); ctx.lineTo(-0.44 * s, 0.24 * s); ctx.stroke();
    // RIGHT arm: sleeve up high, forearm to the launcher grip, hand on it
    paintPath(ctx, () => { ctx.beginPath(); ctx.arc(0.375 * s, -0.05 * s, 0.115 * s, 0, Math.PI * 2); }, '#17b8a6', 777015, {
      box: [0.26 * s, -0.165 * s, 0.49 * s, 0.065 * s], dabs: 8, dabLen: 5 * u, dabW: 2.8 * u,
      stroke: 'rgba(20,6,26,0.85)', strokeW: 1.3 * u
    });
    ctx.fillStyle = SKIN;
    ctx.save();
    ctx.translate(0.40 * s, -0.145 * s); ctx.rotate(-0.2);
    rr(ctx, -0.055 * s, -0.10 * s, 0.11 * s, 0.16 * s, 3 * u); ctx.fill();
    ctx.restore();
    // launcher: plum tube, neon rings, grip, muzzle (same anchors as before)
    paintPath(ctx, () => rr(ctx, 0.30 * s, -0.52 * s, 0.21 * s, 0.36 * s, 3 * u), '#3a2348', 777002, {
      box: [0.30 * s, -0.52 * s, 0.51 * s, -0.16 * s], dabs: 12, dabLen: 6 * u, dabW: 3 * u,
      stroke: 'rgba(16,4,22,0.9)', strokeW: 1.3 * u
    });
    ctx.fillStyle = '#2a1836';
    rr(ctx, 0.325 * s, -0.235 * s, 0.16 * s, 0.075 * s, 2 * u); ctx.fill();
    ctx.fillStyle = SKIN;   // hand wrapped on the grip
    ctx.beginPath(); ctx.arc(0.405 * s, -0.185 * s, 0.062 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,95,50,0.7)'; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(0.375 * s, -0.215 * s); ctx.lineTo(0.375 * s, -0.16 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.405 * s, -0.22 * s); ctx.lineTo(0.405 * s, -0.155 * s); ctx.stroke();
    ctx.fillStyle = '#ff4fa3';
    ctx.fillRect(0.30 * s, -0.40 * s, 0.21 * s, 0.045 * s);
    ctx.fillRect(0.30 * s, -0.27 * s, 0.21 * s, 0.045 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0.315 * s, -0.50 * s, 0.035 * s, 0.32 * s);
    ctx.fillStyle = '#57406e';
    ctx.beginPath(); ctx.arc(0.405 * s, -0.52 * s, 0.095 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#12081c';
    ctx.beginPath(); ctx.arc(0.405 * s, -0.52 * s, 0.072 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,220,255,0.35)';
    ctx.beginPath(); ctx.arc(0.405 * s, -0.52 * s, 0.034 * s, 0, Math.PI * 2); ctx.fill();
    if (firing) {
      const fl = 0.75 + 0.25 * Math.sin(t * 41);
      const mg = ctx.createRadialGradient(0.405 * s, -0.60 * s, 0, 0.405 * s, -0.60 * s, 0.42 * s * fl);
      mg.addColorStop(0, 'rgba(255,246,190,0.95)');
      mg.addColorStop(0.35, 'rgba(255,79,163,0.55)');
      mg.addColorStop(1, 'rgba(255,79,163,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0.405 * s, -0.60 * s, 0.42 * s * fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath(); ctx.arc(0.405 * s, -0.585 * s, 0.075 * s * fl, 0, Math.PI * 2); ctx.fill();
    }
    // neck + ears
    ctx.fillStyle = SKIN_D;
    rr(ctx, -0.075 * s, -0.16 * s, 0.15 * s, 0.10 * s, 2 * u); ctx.fill();
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(-0.305 * s, -0.075 * s, 0.055 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.305 * s, -0.075 * s, 0.055 * s, 0, Math.PI * 2); ctx.fill();
    // head: skin with a jaw, bleached swoop hair, shades, grin
    const hg = ctx.createRadialGradient(-0.09 * s, -0.24 * s, s * 0.05, 0, -0.07 * s, s * 0.38);
    hg.addColorStop(0, '#f6cfa2');
    hg.addColorStop(0.6, SKIN);
    hg.addColorStop(1, SKIN_D);
    ctx.fillStyle = hg;
    ctx.strokeStyle = 'rgba(20,6,26,0.9)';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.arc(0, -0.085 * s, 0.315 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // jaw shading + nose hint
    ctx.fillStyle = 'rgba(160,100,55,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 0.10 * s, 0.17 * s, 0.08 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,95,50,0.75)'; ctx.lineWidth = 1.1 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.01 * s, -0.03 * s); ctx.lineTo(-0.005 * s, 0.015 * s); ctx.stroke();
    // hair: blond swoop across the top with strand cuts, dark undercut sides
    ctx.save();
    ctx.beginPath(); ctx.arc(0, -0.085 * s, 0.315 * s, 0, Math.PI * 2); ctx.clip();
    paintPath(ctx, () => rr(ctx, -0.325 * s, -0.44 * s, 0.65 * s, 0.29 * s, 6 * u), '#f2d06b', 777003, {
      box: [-0.325 * s, -0.44 * s, 0.325 * s, -0.15 * s], dabs: 16, dabLen: 7 * u, dabW: 3.2 * u, ang: 0.5
    });
    ctx.fillStyle = '#c9962e';
    ctx.fillRect(-0.325 * s, -0.44 * s, 0.65 * s, 0.045 * s);
    ctx.strokeStyle = 'rgba(150,105,30,0.6)'; ctx.lineWidth = 1.2 * u;
    for (const hx of [-0.20, -0.08, 0.05, 0.17]) {
      ctx.beginPath(); ctx.moveTo(hx * s, -0.42 * s); ctx.quadraticCurveTo((hx + 0.05) * s, -0.30 * s, (hx + 0.10) * s, -0.20 * s); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,84,32,0.55)';
    ctx.fillRect(-0.325 * s, -0.185 * s, 0.07 * s, 0.16 * s);
    ctx.fillRect(0.255 * s, -0.185 * s, 0.07 * s, 0.16 * s);
    ctx.fillStyle = 'rgba(160,120,50,0.45)';
    ctx.fillRect(-0.325 * s, -0.175 * s, 0.65 * s, 0.028 * s);
    ctx.restore();
    // sunglasses: two lenses + bridge + temple arms, teal glint
    ctx.fillStyle = '#12081c';
    rr(ctx, -0.225 * s, -0.135 * s, 0.20 * s, 0.125 * s, 3.5 * u); ctx.fill();
    rr(ctx, 0.025 * s, -0.135 * s, 0.20 * s, 0.125 * s, 3.5 * u); ctx.fill();
    ctx.fillRect(-0.03 * s, -0.105 * s, 0.06 * s, 0.028 * s);
    ctx.fillRect(-0.315 * s, -0.115 * s, 0.095 * s, 0.026 * s);
    ctx.fillRect(0.22 * s, -0.115 * s, 0.095 * s, 0.026 * s);
    ctx.fillStyle = '#2ee6c8';
    rr(ctx, -0.20 * s, -0.112 * s, 0.15 * s, 0.042 * s, 2 * u); ctx.fill();
    rr(ctx, 0.05 * s, -0.112 * s, 0.15 * s, 0.042 * s, 2 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-0.155 * s, -0.104 * s, 0.085 * s, 0.024 * s);
    ctx.fillRect(0.095 * s, -0.104 * s, 0.085 * s, 0.024 * s);
    // grin with a teeth line
    ctx.strokeStyle = '#7a4a26';
    ctx.lineWidth = 1.7 * u;
    ctx.beginPath(); ctx.arc(0, 0.045 * s, 0.105 * s, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.arc(0, 0.052 * s, 0.088 * s, Math.PI * 0.30, Math.PI * 0.70); ctx.stroke();
    ctx.restore();
  }
  /* ================= ORBS + SHARD (cash) ================= */
  const ORB_COLORS = {
    iron: '#46f2dd', primary: '#ffd94d', fire: '#ff8a3c', ice: '#a8f4ff',
    lightning: '#ffe93e', ghost: '#a4ffc0',
    frostflame: '#ff9ecf', bomb: '#ffb03a', blizzard: '#cfe9ff', wraith: '#b7a6ff',
    assassin: '#ff5a7a', lightningrod: '#fff176'
  };
  function orbColor(type) { return ORB_COLORS[type] || '#ffd94d'; }

  function drawShard(ctx, x, y, s, t) {
    t = t || 0;
    const pulse = 1 + 0.13 * Math.sin(t * 3.2 + x * 0.11 + y * 0.07);
    const gold = s > 14;                    // salvage bills render gold
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.28);
    ctx.scale(pulse, pulse);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.1);
    g.addColorStop(0, gold ? 'rgba(255,217,77,0.40)' : 'rgba(120,255,170,0.32)');
    g.addColorStop(1, 'rgba(120,255,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-s * 1.1, -s * 1.1, s * 2.2, s * 2.2);
    const w = s * 1.5, h = s * 0.92;
    paintPath(ctx, () => rr(ctx, -w / 2, -h / 2, w, h, 2.5), gold ? '#c9a227' : '#3fae5a', 515 + Math.round(x + y), {
      box: [-w / 2, -h / 2, w / 2, h / 2], dabs: 12, dabLen: 7, dabW: 3,
      stroke: gold ? '#ffe95e' : '#b8ffd0', strokeW: 1.6
    });
    ctx.fillStyle = gold ? '#fff3b0' : '#eaffea';
    ctx.font = '900 ' + Math.round(s * 0.95) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
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

// DUSTLINE — renderers for the three looks. One simulation, three paint jobs.
// A "REPLICA": 4 px/m chunky buffer, Amiga palette, Bayer-dithered terrain, flat pixel trucks.
// B "PAINTED": 12 px/m, big brush strokes + broken colour, warm storybook grade, painted trucks.
// C "SPRITE PIXEL": 6 px/m crunched world, cooler darker grade, voxel-shaded 16-dir truck sprites.
'use strict';

const LOOK_CONF = {
  A: { ppm: 4,  smooth: false, spriteSpan: 6.8, name: 'REPLICA' },
  C: { ppm: 6,  smooth: false, spriteSpan: 6.4, name: 'SPRITE PIXEL' },
  B: { ppm: 12, smooth: true,  spriteSpan: 7.0, name: 'PAINTED' }
};

const PALETTES = {
  A: {
    dirt: ['#a05c26', '#8f4f1e', '#b26a30'], sand: ['#e0bd76', '#d9b96e'], mud: ['#5e3c1e', '#533417', '#6d4a26'],
    gravel: ['#8a7d6a', '#7f7260'], rock: ['#6e685f', '#625c53'], water: ['#2456d8', '#173a9e'],
    shore: '#69b7e8', tapeRed: '#d42a1e', tapeWhite: '#ece7da', dark: '#2a1a0e'
  },
  C: {
    dirt: ['#8a5a2e', '#7c4f27', '#96652f'], sand: ['#d8ba7c', '#cdb071'], mud: ['#5f3f20', '#54371b', '#71502c'],
    gravel: ['#847768', '#796c5c'], rock: ['#6b6257', '#5f574c'], water: ['#1e46b8', '#122c78'],
    shore: '#5aa2d8', tapeRed: '#c22e20', tapeWhite: '#e6e1d2', dark: '#241a10'
  },
  B: {
    dirt: ['#bb8a54', '#b3814b', '#c2915c'], sand: ['#ecd096', '#e6c78a'], mud: ['#6e4a28', '#654324', '#7d5730'],
    gravel: ['#9a8a72', '#91805f'], rock: ['#7d7468', '#726a5e'], water: ['#2f6fd0', '#2a66c2'],
    shore: '#8ec9ec', tapeRed: '#c8402a', tapeWhite: '#f3e6c8', dark: '#3a2318'
  }
};
const SURF_KEYS = ['dirt', 'sand', 'mud', 'gravel', 'rock', 'water', 'dirt']; // index by SURF (ribs -> dirt base)

function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

// Low-res surface layer: 1 px per grid cell. Low-frequency noise gives the terrain
// large tonal patches (like the reference); look A quantises it through a Bayer
// dither, gravel/mud are broken up with dirt speckle so they never read as blobs.
const BAYER = [0, 2, 3, 1];
function surfaceLayer(look) {
  const pal = PALETTES[look];
  const { grid, gw, gh } = TRACK.surf;
  const c = mkCanvas(gw, gh), g = c.getContext('2d');
  const isWater = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && grid[y * gw + x] === SURF.WATER;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const s = grid[gy * gw + gx];
      const h = hash2(gx, gy);
      const ln = 0.5 + 0.30 * Math.sin(gx * 0.052 + 1.3) * Math.sin(gy * 0.068 + 4.1)
                   + 0.20 * Math.sin(gx * 0.13 + 5.2) * Math.sin(gy * 0.11 + 0.6); // 0..1 terrain tone
      let col;
      if (s === SURF.WATER) {
        const shore = !isWater(gx - 1, gy) || !isWater(gx + 1, gy) || !isWater(gx, gy - 1) || !isWater(gx, gy + 1);
        const deep = isWater(gx - 1, gy) && isWater(gx + 1, gy) && isWater(gx, gy - 1) && isWater(gx, gy + 1) &&
                     isWater(gx - 2, gy) && isWater(gx + 2, gy) && isWater(gx, gy - 2) && isWater(gx, gy + 2);
        if (shore) col = pal.shore;
        else if (deep) col = pal.water[1];
        else if (look === 'A') col = pal.water[(BAYER[(gx & 1) + (gy & 1) * 2] + (h < 0.5 ? 0 : 1)) % 2 === 0 ? 0 : 1];
        else col = pal.water[h < 0.6 ? 0 : 1];
      } else if (s === SURF.DIRT || s === SURF.RIBS) {
        if (look === 'A') {
          const v = ln * 2.2 + (h - 0.5) * 0.35 + BAYER[(gx & 1) + (gy & 1) * 2] * 0.28;
          col = pal.dirt[Math.max(0, Math.min(2, Math.floor(v)))];
        } else {
          col = pal.dirt[ln > 0.62 ? 2 : ln > 0.38 ? 0 : 1];
          if (h < 0.16) col = pal.dirt[1];
        }
      } else if (s === SURF.GRAVEL) {
        col = h < 0.42 ? pal.dirt[1] : pal.gravel[Math.floor(h * pal.gravel.length) % pal.gravel.length];
      } else if (s === SURF.MUD) {
        col = h < 0.2 ? pal.mud[2] : pal.mud[Math.floor(h * 2) % 2];
      } else {
        const arr = pal[SURF_KEYS[s]];
        col = arr[Math.floor(h * arr.length)];
      }
      g.fillStyle = col; g.fillRect(gx, gy, 1, 1);
    }
  }
  return c;
}

// Offset polylines for the tape barriers.
function tapeLines() {
  const S = TRACK.samples, left = [], right = [];
  for (let i = 0; i < S.length; i += 3) {
    const p = S[i], nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    const off = p.w / 2 + 0.4;
    left.push([p.x + nx * off, p.y + ny * off]);
    right.push([p.x - nx * off, p.y - ny * off]);
  }
  return { left, right };
}
function drawTape(g, ppm, pal, painted, crispShadow) {
  const { left, right } = tapeLines();
  for (const line of [left, right]) {
    const n = line.length;
    for (let i = 0; i < n; i++) {
      const a = line[i], b = line[(i + 1) % n];
      if (painted) {
        g.strokeStyle = 'rgba(58,35,24,0.45)'; g.lineWidth = 0.62 * ppm; g.lineCap = 'round';
        g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm + 0.22 * ppm); g.lineTo(b[0] * ppm, b[1] * ppm + 0.22 * ppm); g.stroke();
      } else if (crispShadow) {
        g.strokeStyle = 'rgba(16,10,5,0.42)'; g.lineWidth = 0.6 * ppm; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm + 0.15 * ppm); g.lineTo(b[0] * ppm, b[1] * ppm + 0.15 * ppm); g.stroke();
      }
      g.strokeStyle = i % 2 ? pal.tapeWhite : pal.tapeRed;
      g.lineWidth = (painted ? 0.5 : 0.55) * ppm; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(a[0] * ppm, a[1] * ppm); g.lineTo(b[0] * ppm, b[1] * ppm); g.stroke();
    }
  }
}
function drawStartLine(g, ppm, pal) {
  const p = TRACK.samples[0];
  const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
  const cols = 8, rows = 2, w = p.w;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const t0 = -w / 2 + (i / cols) * w, t1 = -w / 2 + ((i + 1) / cols) * w;
      const s0 = (j / rows) * 1.6 - 0.8, s1 = ((j + 1) / rows) * 1.6 - 0.8;
      const f = Math.cos(p.ang), s = Math.sin(p.ang);
      g.fillStyle = (i + j) % 2 ? '#181410' : '#f0ead8';
      g.beginPath();
      const corners = [[t0, s0], [t1, s0], [t1, s1], [t0, s1]];
      corners.forEach(([tt, ss], k) => {
        const X = (p.x + nx * tt + f * ss) * ppm, Y = (p.y + ny * tt + s * ss) * ppm;
        k ? g.lineTo(X, Y) : g.moveTo(X, Y);
      });
      g.closePath(); g.fill();
    }
  }
}
function drawRibs(g, ppm) {
  g.fillStyle = 'rgba(40,22,10,0.35)';
  const { grid, gw, gh, cell } = TRACK.surf;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (grid[gy * gw + gx] !== SURF.RIBS) continue;
      const x = gx * cell;
      if (Math.floor(x * 1.5) % 2 === 0) g.fillRect(gx * cell * ppm, gy * cell * ppm, cell * ppm + 0.6, cell * ppm + 0.6);
    }
  }
}

function buildBackground(look) {
  const conf = LOOK_CONF[look], ppm = conf.ppm;
  const W = Math.round(WORLD.w * ppm), H = Math.round(WORLD.h * ppm);
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const pal = PALETTES[look];
  const layer = surfaceLayer(look);
  g.imageSmoothingEnabled = look === 'B';
  g.drawImage(layer, 0, 0, W, H);
  const rng = mulberry32(look === 'A' ? 11 : look === 'C' ? 22 : 33);
  if (look === 'B') {
    // ---- painterly pass: big broken-colour blotches, then thousands of visible strokes ----
    const surfNames = SURF_KEYS;
    for (let i = 0; i < 300; i++) { // large soft patches of warm/cool variation
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      const s = TRACK.surfaceAt(x, y);
      if (s === SURF.WATER) continue;
      const base = PALETTES.B[surfNames[s]][0];
      g.fillStyle = shade(base, rng() < 0.5 ? 0.88 + rng() * 0.06 : 1.08 + rng() * 0.1);
      g.globalAlpha = 0.05 + rng() * 0.06;
      g.beginPath();
      g.ellipse(x * ppm, y * ppm, (10 + rng() * 30) * (ppm / 12), (7 + rng() * 20) * (ppm / 12), rng() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 6200; i++) {
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      const s = TRACK.surfaceAt(x, y);
      const base = PALETTES.B[surfNames[s]][0];
      const isWater = s === SURF.WATER;
      const ang = isWater ? (rng() - 0.5) * 0.3 : rng() * Math.PI;
      const len = (isWater ? 16 : 10) + rng() * 20;
      g.strokeStyle = isWater && rng() < 0.3 ? '#bcd9f5' : shade(base, 0.88 + rng() * 0.3);
      g.globalAlpha = (isWater ? 0.10 : 0.06) + rng() * 0.10;
      g.lineWidth = 2.4 + rng() * 3.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x * ppm, y * ppm);
      g.lineTo(x * ppm + Math.cos(ang) * len, y * ppm + Math.sin(ang) * len); g.stroke();
    }
    g.globalAlpha = 1;
    // shore foam strokes
    g.strokeStyle = '#eaf6ff';
    for (let i = 0; i < 260; i++) {
      const x = rng() * WORLD.w, y = rng() * WORLD.h;
      if (TRACK.surfaceAt(x, y) !== SURF.WATER) continue;
      if (TRACK.surfaceAt(x + 1.2, y) === SURF.WATER && TRACK.surfaceAt(x - 1.2, y) === SURF.WATER &&
          TRACK.surfaceAt(x, y + 1.2) === SURF.WATER && TRACK.surfaceAt(x, y - 1.2) === SURF.WATER) continue;
      g.globalAlpha = 0.25 + rng() * 0.3; g.lineWidth = 1.6 + rng() * 1.6;
      g.beginPath(); g.moveTo(x * ppm, y * ppm); g.lineTo(x * ppm + 5 + rng() * 8, y * ppm + (rng() - 0.5) * 3); g.stroke();
    }
    g.globalAlpha = 1;
    drawRibs(g, ppm);
    drawTape(g, ppm, pal, true);
    drawStartLine(g, ppm, pal);
    // warm sun wash + vignette
    const wash = g.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, 'rgba(255,196,96,0.10)'); wash.addColorStop(1, 'rgba(120,52,16,0.10)');
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(46,22,8,0.28)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  } else {
    // ---- pixel pass: speckle, stones, water sparkle ----
    const dots = look === 'A' ? 1500 : 2400;
    for (let i = 0; i < dots; i++) {
      const x = rng() * W, y = rng() * H;
      const s = TRACK.surfaceAt(x / ppm, y / ppm);
      if (s === SURF.WATER) {
        if (rng() < 0.4) { g.fillStyle = 'rgba(220,240,255,0.5)'; g.fillRect(x, y, ppm * 0.32, 1.4); }
      } else {
        g.fillStyle = rng() < 0.5 ? 'rgba(30,18,8,0.20)' : 'rgba(255,240,210,0.13)';
        const sz = look === 'A' ? 2 : 2.6;
        g.fillRect(x, y, sz, sz);
      }
    }
    drawRibs(g, ppm);
    drawTape(g, ppm, pal, false, look === 'C');
    drawStartLine(g, ppm, pal);
    if (look === 'C') { // cool grade + grain + vignette: reads as its own world, not A's twin
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        g.fillRect(rng() * W, rng() * H, 1.6, 1.6);
      }
      g.fillStyle = 'rgba(28,44,104,0.07)'; g.fillRect(0, 0, W, H);
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.98);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,10,26,0.16)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
  }
  return c;
}

// ---------- dynamic props ----------
function drawPickup(g, p, active, t, ppm, look) {
  const x = p.x * ppm, y = p.y * ppm;
  const bob = Math.sin(t * 3 + p.x) * 0.14 * ppm;
  g.save(); g.translate(x, y + bob);
  if (!active) {
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = Math.max(1.4, ppm * 0.14);
    g.beginPath(); g.arc(0, 0, 0.85 * ppm, 0, 7); g.stroke();
    g.restore(); return;
  }
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.beginPath(); g.ellipse(0, 0.5 * ppm - bob, 0.8 * ppm, 0.3 * ppm, 0, 0, 7); g.fill();
  if (p.type === 'nitro') {
    g.fillStyle = look === 'B' ? '#e06426' : '#d8481c';
    const w = 0.62 * ppm, h = 1.05 * ppm;
    g.beginPath();
    if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, ppm * 0.16); else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.fillStyle = '#f5f0e2'; g.fillRect(-w * 0.18, -h * 0.30, w * 0.36, h * 0.6);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.moveTo(0.06 * ppm, -0.28 * ppm); g.lineTo(-0.14 * ppm, 0.06 * ppm); g.lineTo(-0.01 * ppm, 0.06 * ppm); g.lineTo(-0.06 * ppm, 0.30 * ppm); g.lineTo(0.14 * ppm, -0.04 * ppm); g.lineTo(0.01 * ppm, -0.04 * ppm); g.closePath(); g.fill();
  } else {
    g.fillStyle = look === 'B' ? '#f2ead8' : '#e8e4da';
    const w = 0.95 * ppm, h = 0.8 * ppm;
    g.beginPath();
    if (g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, ppm * 0.12); else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.fillStyle = '#c22e20';
    g.fillRect(-0.11 * ppm, -0.26 * ppm, 0.22 * ppm, 0.52 * ppm);
    g.fillRect(-0.26 * ppm, -0.11 * ppm, 0.52 * ppm, 0.22 * ppm);
  }
  g.restore();
}
function drawStack(g, s, ppm, look) {
  const x = s.x * ppm, y = s.y * ppm;
  for (let i = 0; i < 3; i++) {
    const ox = (i % 2) * 0.22 * ppm - 0.1 * ppm, oy = -i * 0.30 * ppm;
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(x + ox, y + oy + 0.34 * ppm, 0.78 * ppm, 0.30 * ppm, 0, 0, 7); g.fill();
    g.fillStyle = look === 'B' ? '#33281f' : '#1d1d21';
    g.beginPath(); g.ellipse(x + ox, y + oy, 0.78 * ppm, 0.42 * ppm, 0, 0, 7); g.fill();
    g.fillStyle = look === 'B' ? '#57493a' : '#3c3f45';
    g.beginPath(); g.ellipse(x + ox, y + oy - 0.07 * ppm, 0.44 * ppm, 0.22 * ppm, 0, 0, 7); g.fill();
  }
}
function drawTireDebris(g, d, ppm, look) {
  const x = d.x * ppm, y = d.y * ppm;
  g.save(); g.translate(x, y); g.rotate(d.rot);
  g.globalAlpha = Math.min(1, d.life / 1.5);
  g.fillStyle = look === 'B' ? '#33281f' : '#1d1d21';
  g.beginPath(); g.ellipse(0, 0, 0.62 * ppm, 0.36 * ppm, 0, 0, 7); g.fill();
  g.fillStyle = look === 'B' ? '#57493a' : '#3c3f45';
  g.beginPath(); g.ellipse(0, 0, 0.32 * ppm, 0.17 * ppm, 0, 0, 7); g.fill();
  g.restore(); g.globalAlpha = 1;
}

// ---------- scene composition ----------
class Renderer {
  constructor() {
    this.backgrounds = {};
    this.buffers = {};
    this.sprites = {};
    this.trackLayer = mkCanvas(848, 592); // 8 px/m persistent tire-track layer
    this.trackCtx = this.trackLayer.getContext('2d');
  }
  ensure(look) {
    if (!this.backgrounds[look]) {
      this.backgrounds[look] = buildBackground(look);
      const conf = LOOK_CONF[look];
      this.buffers[look] = mkCanvas(Math.round(WORLD.w * conf.ppm), Math.round(WORLD.h * conf.ppm));
      this.sprites[look] = look === 'A' ? buildSpritesA() : look === 'C' ? buildSpritesC() : buildSpritesB();
    }
  }
  stampTracks(x, y, ang, strength, dark) {
    const g = this.trackCtx, ppm = 8;
    g.save(); g.translate(x * ppm, y * ppm); g.rotate(ang);
    g.fillStyle = `rgba(38,24,14,${strength})`;
    if (dark) g.fillStyle = `rgba(24,16,10,${strength})`;
    g.beginPath(); g.ellipse(0, 0, 0.30 * ppm, 0.17 * ppm, 0, 0, 7); g.fill();
    g.restore();
  }
  render(state, look, view, dctx) {
    this.ensure(look);
    const conf = LOOK_CONF[look], ppm = conf.ppm;
    const buf = this.buffers[look], g = buf.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(this.backgrounds[look], 0, 0);
    // persistent tire tracks
    g.globalAlpha = look === 'B' ? 0.85 : 0.95;
    g.drawImage(this.trackLayer, 0, 0, buf.width, buf.height);
    g.globalAlpha = 1;
    const t = state.time;
    for (const p of state.pickups) drawPickup(g, p, p.active, t, ppm, look);
    for (const s of state.stacks) if (!s.broken) drawStack(g, s, ppm, look);
    for (const d of state.debris) drawTireDebris(g, d, ppm, look);
    // particles under trucks (dust, splashes, wakes)
    drawParticles(g, state.particles, ppm, false);
    // trucks
    const sprites = this.sprites[look];
    const count = look === 'B' ? 32 : 16;
    for (const tr of state.trucks) {
      const x = tr.x * ppm, y = tr.y * ppm;
      // sun shadow
      g.fillStyle = 'rgba(20,10,4,0.34)';
      g.beginPath(); g.ellipse(x + 0.38 * ppm, y + 0.55 * ppm, 1.55 * ppm, 0.95 * ppm, tr.ang, 0, 7); g.fill();
      const spr = sprites[tr.color][dirIndex(tr.ang, count)];
      const span = conf.spriteSpan * ppm;
      if (look === 'C') g.imageSmoothingEnabled = true;
      g.drawImage(spr, x - span / 2, y - span / 2, span, span);
      if (look === 'C') g.imageSmoothingEnabled = false;
      if (tr.nitroT > 0) { /* flame drawn as particles in sim */ }
      if (tr.wreckT > 0) {
        g.fillStyle = 'rgba(30,30,30,0.5)';
        g.beginPath(); g.arc(x, y - 1.3 * ppm, (0.5 + 0.2 * Math.sin(t * 9)) * ppm, 0, 7); g.fill();
      }
    }
    // particles over trucks (splash crowns, flames)
    drawParticles(g, state.particles, ppm, true);
    // blit to display
    dctx.imageSmoothingEnabled = conf.smooth;
    dctx.fillStyle = '#0b0906';
    dctx.fillRect(0, 0, dctx.canvas.width, dctx.canvas.height);
    dctx.drawImage(buf, view.x, view.y, view.w, view.h);
  }
}
function drawParticles(g, parts, ppm, over) {
  for (const p of parts) {
    if (p.over !== over) continue;
    const x = p.x * ppm, y = p.y * ppm;
    const lifeF = p.life / p.maxLife;
    if (p.type === 'dust' || p.type === 'spray') {
      g.globalAlpha = 0.34 * lifeF;
      g.fillStyle = p.col;
      g.beginPath(); g.arc(x, y, p.size * ppm * (1.6 - lifeF * 0.6), 0, 7); g.fill();
    } else if (p.type === 'drop') {
      g.globalAlpha = 0.75 * lifeF;
      g.fillStyle = p.col;
      g.fillRect(x - ppm * 0.06, y - ppm * 0.06, ppm * 0.13, ppm * 0.13);
    } else if (p.type === 'ring') {
      g.globalAlpha = 0.4 * lifeF;
      g.strokeStyle = p.col; g.lineWidth = Math.max(1, ppm * 0.09);
      g.beginPath(); g.ellipse(x, y, p.size * ppm * (2 - lifeF), p.size * ppm * (2 - lifeF) * 0.55, 0, 0, 7); g.stroke();
    } else if (p.type === 'flame') {
      g.globalAlpha = 0.8 * lifeF;
      g.fillStyle = p.col;
      g.beginPath(); g.arc(x, y, p.size * ppm * lifeF + 0.5, 0, 7); g.fill();
    }
  }
  g.globalAlpha = 1;
}

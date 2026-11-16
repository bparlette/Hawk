// render.js — the lighting system.
//   1. painted ground chunks + animated ocean
//   2. shadow layer: every baked shadow sprite -> one screen-size layer -> tinted, multiplied once
//   3. colour sprites (people, cars, then roofs, palms, lamps)
//   4. time-of-day grade (multiply) + low-sun glow from the west
//   5. light layer (additive): window spill, lamp pools, neon + wet-asphalt reflections, headlights
//      -> plus a cheap downsample bloom
// Every offscreen canvas is view-sized (<= 840x2000), never map-sized.

import { CHUNK } from './ground.js';
import { mulberry32 } from './world.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Grade keyframes over time of day t (0 = golden hour, 1 = blue dusk).
const KEYS = [
  { t: 0.00, mul: [255, 238, 214], warm: 0.55, glow: 0.42, shadow: 0.92 },
  { t: 0.40, mul: [250, 214, 196], warm: 0.50, glow: 0.34, shadow: 0.86 },
  { t: 0.65, mul: [200, 160, 196], warm: 0.30, glow: 0.18, shadow: 0.62 },
  { t: 0.85, mul: [112, 106, 182], warm: 0.12, glow: 0.06, shadow: 0.36 },
  { t: 1.00, mul: [74, 80, 162],   warm: 0.04, glow: 0.00, shadow: 0.24 },
];
export function grade(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = clamp01((t - a.t) / (b.t - a.t));
  return {
    mul: a.mul.map((v, k) => Math.round(lerp(v, b.mul[k], u))),
    glow: lerp(a.glow, b.glow, u),
    warm: lerp(a.warm, b.warm, u),
    shadow: lerp(a.shadow, b.shadow, u),
    windows: smooth(0.22, 0.8, t),   // windows warm up first
    lamps: smooth(0.45, 0.92, t),    // street lamps after
    neon: 0.25 + 0.75 * smooth(0.3, 0.85, t),
    heads: smooth(0.4, 0.85, t),
  };
}

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export class Renderer {
  constructor(ctx, world, ground, M) {
    this.ctx = ctx; this.world = world; this.ground = ground; this.M = M;
    this.L = world.L;
    this.statics = this.buildStatics();
    this.glints = this.buildGlints();
    this.waterPath = this.buildWaterPath();
    this.grain = this.buildGrain();
  }

  // A 256px tile of loose brush marks, laid over the whole frame in world space with soft-light,
  // so roofs, cars and ground share one painted surface. Low alpha + soft-light keeps it from
  // reading as a tile.
  buildGrain() {
    const c = layer(256, 256), g = c.getContext('2d'), r = mulberry32(5);
    g.fillStyle = 'rgb(128,128,128)';
    g.fillRect(0, 0, 256, 256);
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * 256, y = r() * 256, a = r() * Math.PI, L = 4 + r() * 10, v = r() < 0.5 ? 70 + r() * 40 : 170 + r() * 50;
      g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`;
      g.lineWidth = 1.5 + r() * 2.5;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        g.beginPath(); g.moveTo(x + ox - Math.cos(a) * L, y + oy - Math.sin(a) * L); g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke();
      }
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  resize(vw, vh, dpr) {
    this.vw = vw; this.vh = vh; this.dpr = dpr;
    const w = Math.round(vw * dpr), h = Math.round(vh * dpr);
    this.shadowCv = layer(w, h);
    this.lightCv = layer(w, h);
    this.bloomA = layer(Math.ceil(w / 4), Math.ceil(h / 4));
    this.bloomB = layer(Math.ceil(w / 8), Math.ceil(h / 8));
  }

  buildStatics() {
    const M = this.M, L = this.L, out = [];
    for (const b of L.buildings) {
      const e = M.buildings[b.id];
      if (!e) throw new Error('no baked sprite for building ' + b.id + ' — run tools/bake_sprites.py');
      out.push({ kind: 'building', x: b.x + b.w / 2, y: b.y + b.d / 2, e, id: b.id });
    }
    L.palms.forEach(([x, y], i) => out.push({ kind: 'palm', x, y, e: M.props['palm' + (i % 3)] }));
    for (const [x, y] of L.lamps) out.push({ kind: 'lamp', x, y, e: M.props.lamp });
    // vegetation clusters: seeded, scattered in grass and along block edges, mixed variants + sizes
    const vr = mulberry32(2024), W = this.world;
    for (let n = 0; n < 900 && out.filter(o => o.kind === 'bush').length < 140; n++) {
      const x = vr() * L.world.w, y = vr() * L.world.h, t = W.surfaceAt(x, y);
      if (t !== 'grass' && !(t === 'paving' && vr() < 0.25) && !(t === 'sand' && vr() < 0.08)) continue;
      if (W.hitSolid(x, y, 14)) continue;
      const k = 1 + ((vr() * 4) | 0);  // cluster of 1-4
      for (let j = 0; j < k; j++) {
        const bx = x + (vr() - 0.5) * 34, by = y + (vr() - 0.5) * 34;
        if (W.hitSolid(bx, by, 10) || W.roadInfo(bx, by).d < W.walkEdge) continue;
        const v = (vr() * 4) | 0;
        out.push({ kind: 'bush', x: bx, y: by, sc: 0.7 + vr() * 0.7, e: M.props['bush' + v] });
      }
    }
    L.palms.forEach(([x, y], i) => { const p = out.find(o => o.kind === 'palm' && o.x === x && o.y === y); if (p) p.sc = 0.8 + ((i * 37) % 10) / 22; });
    for (const p of L.props) out.push({ kind: p.type, x: p.x, y: p.y, e: M.props[p.type] });
    const P = L.pier;
    out.push({ kind: 'pier', x: P.x + P.w / 2, y: P.y + P.h / 2, e: M.props.pier });
    for (const s of out) {
      if (!s.e) throw new Error('no baked sprite for ' + s.kind);
      // conservative bounds over all passes, for culling
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const sc = s.sc || 1;
      for (const k of ['color', 'shadow', 'night']) {
        const f = s.e[k]; if (!f) continue;
        x0 = Math.min(x0, s.x + f.ox * sc); y0 = Math.min(y0, s.y + f.oy * sc);
        x1 = Math.max(x1, s.x + (f.ox + f.w) * sc); y1 = Math.max(y1, s.y + (f.oy + f.h) * sc);
      }
      s.bb = [x0, y0, x1, y1];
    }
    // draw order: ground-level things first, tall things last
    const rank = { pier: 0, fountain: 1, lifeguard: 2, bush: 3, building: 4, lamp: 5, palm: 6 };
    out.sort((a, b) => rank[a.kind] - rank[b.kind]);
    return out;
  }

  buildGlints() {
    const r = mulberry32(99), W = this.world, g = [];
    for (let i = 0; i < 1400; i++) {
      const y = r() * this.L.world.h;
      const x = W.shoreX(y) + 8 + r() * (this.L.world.w - W.shoreX(y));
      g.push({ x, y, ph: r() * 6.28, f: 0.8 + r() * 1.6, w: 5 + r() * 12 });
    }
    return g;
  }

  buildWaterPath() {
    const p = new Path2D(), W = this.world, H = this.L.world.h;
    p.moveTo(this.L.world.w + 50, -50);
    for (let y = -50; y <= H + 50; y += 10) p.lineTo(W.shoreX(y), y);
    p.lineTo(this.L.world.w + 50, H + 50);
    p.closePath();
    return p;
  }

  static sheetFrame(e, idx, cols, img) {
    const rows = Math.ceil((e.frames || 0) / cols) || null;
    return idx;
  }

  drawEntry(g, f, x, y, sc = 1) {
    g.drawImage(f.img, x + f.ox * sc, y + f.oy * sc, f.w * sc, f.h * sc);
  }

  // Sprite sheet cell: f.img holds `cols` columns; frame index -> source rect.
  drawCell(g, f, idx, cols, rows, x, y) {
    const cw = f.img.width / cols, ch = f.img.height / rows;
    const c = idx % cols, r = (idx / cols) | 0;
    g.drawImage(f.img, c * cw, r * ch, cw, ch, x + f.ox, y + f.oy, f.w, f.h);
  }

  carCell(car) {
    const m = this.M.cars[car.model];
    const n = m.angles;
    let k = Math.round(car.h / (Math.PI * 2) * n) % n;
    if (k < 0) k += n;
    return { m, k, rows: Math.ceil(n / m.cols) };
  }

  pedCell(p) {
    const m = this.M.peds[p.outfit];
    let a = Math.round(p.h / (Math.PI * 2) * m.angles) % m.angles;
    if (a < 0) a += m.angles;
    return { m, idx: a * m.poses + p.pose, rows: Math.ceil(m.angles * m.poses / m.cols) };
  }

  draw(S, cam, t, time) {
    const g = this.ctx, vw = this.vw, vh = this.vh, dpr = this.dpr;
    // ?prof: per-section CPU time (ms, exponential average) in window.__prof
    let P = null;
    if (this.prof) {
      let t0 = performance.now(), cur = 'start';
      P = (name) => { const t1 = performance.now(); this.prof[cur] = (this.prof[cur] || 0) * 0.9 + (t1 - t0) * 0.1; t0 = t1; cur = name; };
    }
    const G = grade(t);
    const zoom = cam.zoom || 1;
    const hw = vw / 2 / zoom, hh = vh / 2 / zoom;
    const vx0 = cam.x - hw, vy0 = cam.y - hh, vx1 = cam.x + hw, vy1 = cam.y + hh;
    const inView = (bb, m = 0) => bb[2] > vx0 - m && bb[0] < vx1 + m && bb[3] > vy0 - m && bb[1] < vy1 + m;
    const worldTf = (ctx, s) => {
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      ctx.translate(hw - cam.x, hh - cam.y);
    };

    P && P('ground');
    // ---------------- 1. ground
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#1b2a44';
    g.fillRect(0, 0, vw, vh);
    worldTf(g);
    const G0 = this.ground;
    const c0 = Math.max(0, Math.floor(vx0 / CHUNK)), c1 = Math.min(G0.cols - 1, Math.floor(vx1 / CHUNK));
    const r0 = Math.max(0, Math.floor(vy0 / CHUNK)), r1 = Math.min(G0.rows - 1, Math.floor(vy1 / CHUNK));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      g.drawImage(G0.get(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 0.6, CHUNK + 0.6);
    }
    this.drawOcean(g, G, t, time, vx0, vy0, vx1, vy1);

    P && P('ocean');
    // ---------------- 2. shadows -> one layer, tinted, multiplied once (no double-dark overlaps)
    const sg = this.shadowCv.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, this.shadowCv.width, this.shadowCv.height);
    worldTf(sg);
    for (const s of this.statics) if (inView(s.bb)) this.drawEntry(sg, s.e.shadow, s.x, s.y, s.sc);
    for (const c of S.cars) {
      if (c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
      const { m, k, rows } = this.carCell(c);
      this.drawCell(sg, m.shadow, k, m.cols, rows, c.x, c.y);
    }
    for (const p of S.peds) {
      if (p.x < vx0 - 60 || p.x > vx1 + 60 || p.y < vy0 - 60 || p.y > vy1 + 60 || p.hidden) continue;
      const { m, idx, rows } = this.pedCell(p);
      this.drawCell(sg, m.shadow, idx, m.cols, rows, p.x, p.y);
    }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#3e3488';
    sg.fillRect(0, 0, this.shadowCv.width, this.shadowCv.height);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = G.shadow;
    g.drawImage(this.shadowCv, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('shadows');
    // ---------------- 3. colour sprites
    worldTf(g);
    for (const s of this.statics) if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') if (inView(s.bb)) this.drawEntry(g, s.e.color, s.x, s.y);
    for (const p of S.peds) {
      if (p.hidden || p.x < vx0 - 30 || p.x > vx1 + 30 || p.y < vy0 - 30 || p.y > vy1 + 30) continue;
      const { m, idx, rows } = this.pedCell(p);
      if (p.down) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.spin || 0); g.scale(1, 0.75);
        this.drawCell(g, m.color, idx, m.cols, rows, 0, 0); g.restore();
      } else if (p.outfit === 'player') {  // the hero is drawn a touch larger so you never lose them
        g.save(); g.translate(p.x, p.y); g.scale(1.2, 1.2);
        this.drawCell(g, m.color, idx, m.cols, rows, 0, 0); g.restore();
      } else this.drawCell(g, m.color, idx, m.cols, rows, p.x, p.y);
    }
    for (const c of S.cars) {
      if (c.x < vx0 - 50 || c.x > vx1 + 50 || c.y < vy0 - 50 || c.y > vy1 + 50) continue;
      const { m, k, rows } = this.carCell(c);
      this.drawCell(g, m.color, k, m.cols, rows, c.x, c.y);
    }
    if (S.marker) this.drawMarker(g, S.marker, time);
    for (const s of this.statics) {
      if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') continue;
      if (inView(s.bb)) this.drawEntry(g, s.e.color, s.x, s.y, s.sc);
    }

    P && P('sprites');
    // painted surface grain (world-anchored)
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.22;
    g.fillStyle = this.grain;
    g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('grain');
    // ---------------- 4. grade
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${G.mul[0]},${G.mul[1]},${G.mul[2]})`;
    g.fillRect(0, 0, vw, vh);
    // low-sun warmth + glow from the west, one soft-light pass: pushes lit surfaces toward gold,
    // deepens contrast, and cools toward the east
    if (G.warm + G.glow > 0.01) {
      g.globalCompositeOperation = 'soft-light';
      const gr = g.createLinearGradient(0, vh * 0.3, vw, vh * 0.8);
      gr.addColorStop(0, `rgba(255,170,70,${Math.min(1, G.warm + G.glow * 1.4)})`);
      gr.addColorStop(0.6, `rgba(255,135,90,${Math.min(1, G.warm * 0.9 + G.glow * 0.5)})`);
      gr.addColorStop(1, `rgba(150,90,200,${Math.min(1, G.warm * 0.5 + G.glow * 0.8)})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, vw, vh);
    }

    P && P('grade');
    // ---------------- 5. light layer (additive)
    const lg = this.lightCv.getContext('2d');
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.globalAlpha = 1;
    lg.fillStyle = '#000';
    lg.fillRect(0, 0, this.lightCv.width, this.lightCv.height);
    worldTf(lg);
    lg.globalCompositeOperation = 'lighter';
    for (const s of this.statics) {
      if (!s.e.night || !inView(s.bb)) continue;
      lg.globalAlpha = s.kind === 'lamp' ? G.lamps * 0.7 : s.kind === 'building' ? G.windows * 0.8 : Math.max(G.windows, G.lamps) * 0.8;
      if (lg.globalAlpha > 0.01) this.drawEntry(lg, s.e.night, s.x, s.y);
    }
    this.drawNeonPuddles(lg, G, time, vx0, vy0, vx1, vy1);
    this.drawWetReflections(lg, G, time, vx0, vy0, vx1, vy1);
    for (const c of S.cars) {
      if (c.x < vx0 - 250 || c.x > vx1 + 250 || c.y < vy0 - 250 || c.y > vy1 + 250) continue;
      const m = this.M.cars[c.model];
      const a = c.kind === 'police' ? Math.max(0.5, G.heads) : G.heads;
      if (a > 0.02) {
        lg.globalAlpha = a * (c.parked ? 0.0 : 0.75);
        if (lg.globalAlpha > 0) {
          lg.save(); lg.translate(c.x, c.y); lg.rotate(c.h + Math.PI / 2);
          lg.drawImage(m.light.img, m.light.ox, m.light.oy, m.light.w, m.light.h);
          lg.restore();
        }
      }
      if (c.siren) this.drawSiren(lg, c, time);
    }
    lg.globalAlpha = 1;
    P && P('lights');
    // composite light + bloom
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1;
    g.drawImage(this.lightCv, 0, 0);
    const ba = this.bloomA.getContext('2d'), bb = this.bloomB.getContext('2d');
    ba.imageSmoothingEnabled = bb.imageSmoothingEnabled = true;
    ba.globalCompositeOperation = 'copy';
    ba.drawImage(this.lightCv, 0, 0, this.bloomA.width, this.bloomA.height);
    bb.globalCompositeOperation = 'copy';
    bb.drawImage(this.bloomA, 0, 0, this.bloomB.width, this.bloomB.height);
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.2;
    g.drawImage(this.bloomA, 0, 0, this.bloomA.width, this.bloomA.height, 0, 0, this.lightCv.width, this.lightCv.height);
    g.globalAlpha = 0.32;
    g.drawImage(this.bloomB, 0, 0, this.bloomB.width, this.bloomB.height, 0, 0, this.lightCv.width, this.lightCv.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('bloom');
    // vignette
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72);
    vg.addColorStop(0, 'rgba(20,10,40,0)');
    vg.addColorStop(1, `rgba(20,10,40,${0.35 + 0.2 * t})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, vw, vh);
    P && P('end');
  }

  drawOcean(g, G, t, time, vx0, vy0, vx1, vy1) {
    const W = this.world;
    if (W.shoreX(cam_mid(vy0, vy1)) > vx1 + 40 && W.shoreX(vy0) > vx1 + 40 && W.shoreX(vy1) > vx1 + 40) return;
    // sky reflection drifts from gold to rose to violet as the sun goes
    g.save();
    g.clip(this.waterPath);
    // sky reflection: a gradient across the water that drifts gold -> rose -> violet as the sun goes;
    // brighter offshore (open sky), deeper near the shore (land shadow)
    const sx = W.shoreX((vy0 + vy1) / 2);
    const sky = g.createLinearGradient(sx, 0, sx + 380, 0);
    const c1 = t < 0.5 ? [255, 176, 110] : t < 0.8 ? [236, 120, 170] : [140, 110, 210];
    const c2 = t < 0.5 ? [120, 210, 230] : t < 0.8 ? [255, 170, 150] : [90, 130, 220];
    sky.addColorStop(0, `rgba(30,70,120,0.25)`);
    sky.addColorStop(0.35, `rgba(${c1[0]},${c1[1]},${c1[2]},0.30)`);
    sky.addColorStop(1, `rgba(${c2[0]},${c2[1]},${c2[2]},0.42)`);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = sky;
    g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    g.globalCompositeOperation = 'source-over';
    // slow swell bands
    g.lineCap = 'round';
    for (let y = Math.floor(vy0 / 22) * 22; y < vy1; y += 22) {
      const x0 = Math.max(vx0, W.shoreX(y));
      const off = Math.sin(time * 0.6 + y * 0.05) * 18;
      g.strokeStyle = 'rgba(210,240,250,0.16)';
      g.lineWidth = 3.5;
      g.beginPath();
      for (let x = x0; x < vx1 + 30; x += 30) {
        const yy = y + Math.sin(x * 0.03 + time * 0.9) * 3 + off * 0.1;
        if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    // glints
    const gc = t < 0.45 ? [255, 222, 150] : t < 0.75 ? [255, 170, 205] : [190, 220, 255];
    for (const p of this.glints) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const s = Math.sin(time * p.f + p.ph);
      if (s < 0.4) continue;
      const a = Math.pow((s - 0.4) / 0.6, 2) * 0.85;
      g.fillStyle = `rgba(${gc[0]},${gc[1]},${gc[2]},${a})`;
      g.beginPath();
      g.ellipse(p.x + Math.sin(time * 0.5 + p.ph) * 3, p.y, p.w / 2, 1.3, 0, 0, 7);
      g.fill();
    }
    // foam pulse along the shore
    g.restore();
    g.strokeStyle = 'rgba(250,244,230,0.45)';
    g.lineWidth = 2.5;
    g.beginPath();
    const pulse = (Math.sin(time * 0.8) * 0.5 + 0.5) * 7;
    for (let y = vy0 - 10; y < vy1 + 10; y += 8) {
      const x = W.shoreX(y) + 4 + pulse + Math.sin(y * 0.08 + time) * 2;
      if (y === vy0 - 10) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }

  drawNeonPuddles(lg, G, time, vx0, vy0, vx1, vy1) {
    for (const p of this.L.neonPuddles) {
      if (p.x + p.r < vx0 || p.x - p.r > vx1 || p.y + p.r < vy0 || p.y - p.r > vy1) continue;
      lg.globalAlpha = G.neon * 0.85;
      // vertical smeared reflection streaks on wet asphalt, shimmering
      for (let i = 0; i < 9; i++) {
        const ox = (i - 4) * p.r * 0.16 + Math.sin(time * 1.3 + i * 1.7) * 2;
        const len = p.r * (0.5 + 0.4 * Math.sin(i * 2.1 + time * 0.7) ** 2);
        const gr = lg.createLinearGradient(0, p.y - len, 0, p.y + len);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(0.5, p.color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = gr;
        lg.beginPath();
        lg.ellipse(p.x + ox, p.y, 2 + (i % 3), len, 0, 0, 7);
        lg.fill();
      }
      const rg = lg.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
      rg.addColorStop(0, p.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      lg.globalAlpha = G.neon * 0.35;
      lg.fillStyle = rg;
      lg.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    lg.globalAlpha = 1;
  }

  // Signature move from the neon anchor: every lamp and sign throws a broken vertical streak of its
  // colour across the wet asphalt toward the viewer, rippling.
  buildReflectors() {
    const L = this.L, W = this.world, out = [];
    const NEON = { SOLANA: '#ff4fa8', TACOS: '#ff8a3c', DINER: '#3fe0ff', MOTEL: '#ff3f6a', NOVA: '#b45cff' };
    for (const [x, y] of L.lamps) out.push({ x: x + 13, y: y + 6, col: [255, 170, 90], len: 70, lamp: true });
    for (const b of L.buildings) if (b.sign) {
      // reflect onto the nearest road edge below / beside the building
      let best = null;
      for (const [px, py] of [[b.x + b.w / 2, b.y + b.d + 40], [b.x + b.w / 2, b.y - 40], [b.x - 40, b.y + b.d / 2], [b.x + b.w + 40, b.y + b.d / 2]]) {
        const d = W.roadInfo(px, py).d; if (!best || d < best.d) best = { x: px, y: py, d };
      }
      const h = NEON[b.sign].slice(1);
      out.push({ x: best.x, y: best.y, col: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), len: 95 });
    }
    return out;
  }

  drawWetReflections(lg, G, time, vx0, vy0, vx1, vy1) {
    if (!this.reflectors) this.reflectors = this.buildReflectors();
    for (const r of this.reflectors) {
      const a = r.lamp ? G.lamps * 0.5 : G.neon * 0.55;
      if (a < 0.02 || r.x < vx0 - 40 || r.x > vx1 + 40 || r.y < vy0 - 120 || r.y > vy1 + 20) continue;
      // falloff: brightest at the source, fading in broken dashes
      for (let k = 0; k < 7; k++) {
        const y = r.y + k * r.len / 7 + 4;
        const w = (r.lamp ? 3 : 5) * (1 - k / 9) + Math.sin(time * 2.4 + k * 1.9 + r.x) * 1.4;
        const fade = a * Math.pow(1 - k / 7, 1.6);
        lg.globalAlpha = Math.max(0, fade);
        lg.fillStyle = `rgb(${r.col[0]},${r.col[1]},${r.col[2]})`;
        lg.beginPath();
        lg.ellipse(r.x + Math.sin(time * 1.7 + k) * 2, y, Math.max(0.5, w), r.len / 9, 0, 0, 7);
        lg.fill();
      }
    }
    lg.globalAlpha = 1;
  }

  drawSiren(lg, c, time) {
    const ph = Math.floor(time * 6) % 2;
    const col = ph ? 'rgba(255,40,60,1)' : 'rgba(60,110,255,1)';
    const ox = Math.cos(c.h + Math.PI / 2) * (ph ? -4 : 4), oy = Math.sin(c.h + Math.PI / 2) * (ph ? -4 : 4);
    const rg = lg.createRadialGradient(c.x + ox, c.y + oy, 1, c.x + ox, c.y + oy, 70);
    rg.addColorStop(0, col);
    rg.addColorStop(0.25, ph ? 'rgba(255,40,60,0.35)' : 'rgba(60,110,255,0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    lg.globalAlpha = 0.9;
    lg.fillStyle = rg;
    lg.fillRect(c.x - 70, c.y - 70, 140, 140);
  }

  drawMarker(g, m, time) {
    // a soft painted ring under the player so they read at a glance
    const r = 13 + Math.sin(time * 4) * 1.5;
    g.strokeStyle = 'rgba(255,236,170,0.75)';
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(m.x, m.y, r, r * 0.9, 0, 0, 7); g.stroke();
  }
}

function cam_mid(a, b) { return (a + b) / 2; }

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
// Golden hour stays warm & sunlit with warm-brown shadows and passes through a warm sunset middle
// before plunging into deep ultramarine at dusk. roofMul preserves upper-structure chroma while
// ground mul plunges streets into midnight indigo at dusk.
const KEYS = [
  { t: 0.00, mul: [255, 246, 224], roofMul: [255, 248, 228], warm: 0.62, glow: 0.48, shadow: 0.68, shadowCol: [108, 68, 56], vigCol: [62, 34, 24], vigAlpha: 0.18, eastGlow: [248, 162, 112] },
  { t: 0.35, mul: [255, 236, 200], roofMul: [255, 240, 208], warm: 0.64, glow: 0.46, shadow: 0.66, shadowCol: [104, 62, 58], vigCol: [58, 32, 26], vigAlpha: 0.22, eastGlow: [244, 152, 116] },
  { t: 0.55, mul: [242, 186, 152], roofMul: [248, 198, 166], warm: 0.50, glow: 0.34, shadow: 0.60, shadowCol: [88, 52, 74],  vigCol: [48, 26, 42], vigAlpha: 0.32, eastGlow: [220, 128, 138] },
  { t: 0.72, mul: [162, 118, 174], roofMul: [204, 160, 208], warm: 0.24, glow: 0.14, shadow: 0.52, shadowCol: [46, 38, 108], vigCol: [24, 18, 58], vigAlpha: 0.48, eastGlow: [158, 94, 200] },
  { t: 0.86, mul: [52, 68, 148],   roofMul: [128, 132, 206], warm: 0.05, glow: 0.04, shadow: 0.44, shadowCol: [22, 26, 78],  vigCol: [10, 14, 42], vigAlpha: 0.62, eastGlow: [150, 90, 200] },
  { t: 1.00, mul: [24, 38, 108],   roofMul: [108, 120, 198], warm: 0.02, glow: 0.00, shadow: 0.42, shadowCol: [20, 25, 74],  vigCol: [8, 12, 38],  vigAlpha: 0.70, eastGlow: [150, 90, 200] },
];
export function grade(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = clamp01((t - a.t) / (b.t - a.t));
  const mix3 = (ka, kb) => ka.map((v, k) => Math.round(lerp(v, kb[k], u)));
  return {
    mul: mix3(a.mul, b.mul),
    roofMul: mix3(a.roofMul, b.roofMul),
    shadowCol: mix3(a.shadowCol, b.shadowCol),
    vigCol: mix3(a.vigCol, b.vigCol),
    eastGlow: mix3(a.eastGlow, b.eastGlow),
    vigAlpha: lerp(a.vigAlpha, b.vigAlpha, u),
    glow: lerp(a.glow, b.glow, u),
    warm: lerp(a.warm, b.warm, u),
    shadow: lerp(a.shadow, b.shadow, u),
    windows: smooth(0.26, 0.82, t),  // windows warm up first
    lamps: smooth(0.48, 0.92, t),    // street lamps after
    neon: 0.02 + 0.98 * smooth(0.32, 0.85, t),
    heads: smooth(0.45, 0.85, t),
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
    for (let i = 0; i < 1400; i++) {
      const x = r() * 256, y = r() * 256, a = r() * Math.PI, L = 6 + r() * 12, v = r() < 0.5 ? 60 + r() * 44 : 176 + r() * 54;
      g.strokeStyle = `rgba(${v},${v},${v},${0.30 + r() * 0.35})`;
      g.lineWidth = 2.0 + r() * 3.0;
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
    L.palms.forEach(([x, y], i) => out.push({ kind: 'palm', x, y, ti: i, sc: this.world.trunks[i].sc, e: M.props['palm' + (i % 3)] }));
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

  // A static that may be mid-shake (a palm that just took a knock): the trunk jolts along the
  // impact and the crown twists, both dying away over about a second.
  drawStatic(g, s, f, S) {
    const sh = s.kind === 'palm' && S.shakes ? S.shakes[s.ti] : null;
    if (!sh) { this.drawEntry(g, f, s.x, s.y, s.sc); return; }
    const e = Math.exp(-3.6 * sh.t) * sh.amp;
    g.save();
    g.translate(s.x + sh.ax * Math.sin(sh.t * 40) * 4.5 * e, s.y + sh.ay * Math.sin(sh.t * 40) * 4.5 * e);
    g.rotate(Math.sin(sh.t * 27) * 0.13 * e);
    this.drawEntry(g, f, 0, 0, s.sc);
    g.restore();
  }

  drawLeaves(g, S) {
    for (const l of S.leaves || []) {
      if (l.t < 0) continue;
      const u = l.t / l.life;
      g.globalAlpha = Math.min(1, (1 - u) * 2.2);
      g.fillStyle = (l.rot * 10 | 0) % 2 ? '#9ccf52' : '#5f9f3c';
      g.beginPath(); g.ellipse(l.x, l.y, 5.4 * (1 - u * 0.3), 2.1, l.rot, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
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
    for (const s of this.statics) if (inView(s.bb)) this.drawStatic(sg, s, s.e.shadow, S);
    for (const c of S.cars) {
      if (c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
      const { m, k, rows } = this.carCell(c);
      this.drawCell(sg, m.shadow, k, m.cols, rows, c.x, c.y);
    }
    for (const p of S.peds) {
      if (p.x < vx0 - 60 || p.x > vx1 + 60 || p.y < vy0 - 60 || p.y > vy1 + 60 || p.hidden) continue;
      const { m, idx, rows } = this.pedCell(p);
      const lift = p.outfit === 'player' && S.board && S.board.ridden ? S.board.z * 9 : 0;
      this.drawCell(sg, m.shadow, idx, m.cols, rows, p.x + lift, p.y - lift * 0.3);
    }
    if (S.board) {
      const b = S.board, f = this.M.props.board.shadow;
      sg.save(); sg.translate(b.x + b.z * 9, b.y - b.z * 3); sg.rotate(b.h + Math.PI / 2);
      sg.drawImage(f.img, f.ox, f.oy, f.w, f.h); sg.restore();
    }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = `rgb(${G.shadowCol[0]},${G.shadowCol[1]},${G.shadowCol[2]})`;
    sg.fillRect(0, 0, this.shadowCv.width, this.shadowCv.height);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = G.shadow;
    g.drawImage(this.shadowCv, 0, 0);
    // Ground-only pre-darken ratio (M_ground / M_roof) so streets hit midnight [24,38,108] at dusk while roofs retain chroma
    const preMul = G.mul.map((v, k) => Math.min(255, Math.round((v / Math.max(1, G.roofMul[k])) * 255)));
    if (preMul[0] < 252 || preMul[1] < 252 || preMul[2] < 252) {
      g.globalAlpha = 1;
      g.fillStyle = `rgb(${preMul[0]},${preMul[1]},${preMul[2]})`;
      g.fillRect(0, 0, vw * dpr, vh * dpr);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('shadows');
    // ---------------- 3. colour sprites
    worldTf(g);
    for (const s of this.statics) if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') if (inView(s.bb)) this.drawEntry(g, s.e.color, s.x, s.y);
    this.drawSkatePark(g, S);
    if (S.board) {
      const b = S.board, f = this.M.props.board.color, k = 1 + b.z * 0.35;
      g.save(); g.translate(b.x, b.y); g.rotate(b.h + Math.PI / 2); g.scale(k, k);
      if (b.grind) { g.shadowColor = 'rgba(255,220,140,0.9)'; g.shadowBlur = 8; }
      g.drawImage(f.img, f.ox, f.oy, f.w, f.h); g.restore();
    }
    for (const p of S.peds) {
      if (p.hidden || p.x < vx0 - 30 || p.x > vx1 + 30 || p.y < vy0 - 30 || p.y > vy1 + 30) continue;
      const { m, idx, rows } = this.pedCell(p);
      if (p.down) {                                     // lying flat; the last half second is the get-up
        const k = Math.min(1, p.downT / 0.5);
        g.save(); g.translate(p.x, p.y); g.rotate((p.spin || 0) * k + 1.1 * k); g.scale(1, 1 - 0.25 * k);
        this.drawCell(g, m.color, idx, m.cols, rows, 0, 0); g.restore();
      } else if (p.mode === 'stumble') {                // staggering
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(p.stT * 26) * 0.45 * Math.min(1, p.stT / 0.3));
        this.drawCell(g, m.color, idx, m.cols, rows, 0, 0); g.restore();
      } else if (p.outfit === 'player') {  // the hero is drawn a touch larger so you never lose them
        const z = S.board && S.board.ridden ? S.board.z : p.hopT > 0 ? Math.sin(Math.PI * p.hopT / 0.26) * 0.7 : 0;
        const pt = S.player.punchT > 0 ? S.player.punchT / 0.26 : 0, jab = Math.sin(Math.PI * pt) * 5;
        if (pt > 0) {                                     // the fist: a quick pale streak thrown out ahead
          g.strokeStyle = 'rgba(255,232,200,0.95)'; g.lineWidth = 3.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x + Math.cos(p.h + 0.5) * 6, p.y + Math.sin(p.h + 0.5) * 6);
          g.lineTo(p.x + Math.cos(p.h) * (9 + jab * 1.6), p.y + Math.sin(p.h) * (9 + jab * 1.6)); g.stroke();
        }
        g.save(); g.translate(p.x + Math.cos(p.h) * jab, p.y + Math.sin(p.h) * jab); g.scale(1.2 + z * 0.4, 1.2 + z * 0.4);
        this.drawCell(g, m.color, idx, m.cols, rows, 0, 0); g.restore();
      } else this.drawCell(g, m.color, idx, m.cols, rows, p.x, p.y);
    }
    for (const c of S.cars) {
      if (c.x < vx0 - 50 || c.x > vx1 + 50 || c.y < vy0 - 50 || c.y > vy1 + 50) continue;
      const { m, k, rows } = this.carCell(c);
      this.drawCell(g, m.color, k, m.cols, rows, c.x, c.y);
    }
    for (const s of this.statics) {
      if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') continue;
      if (inView(s.bb)) this.drawStatic(g, s, s.e.color, S);
    }
    this.drawLeaves(g, S);
    for (const f of S.fx || []) {                         // hit flash: a burst of short rays
      const u = Math.min(1, f.t / 0.36), r0 = 4 + u * 9, r1 = 9 + u * 16;
      g.globalAlpha = 1 - u; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.3;
        g.strokeStyle = i % 2 ? '#fff4c8' : '#ffb04a'; g.lineWidth = i % 2 ? 2.2 : 3;
        g.beginPath(); g.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); g.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); g.stroke();
      }
      g.globalAlpha = 1;
    }

    P && P('sprites');
    // painted surface grain (world-anchored)
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.30;
    g.fillStyle = this.grain;
    g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('grain');
    // ---------------- 4. grade
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${G.roofMul[0]},${G.roofMul[1]},${G.roofMul[2]})`;
    g.fillRect(0, 0, vw, vh);
    // low-sun warmth + glow from the west, one soft-light pass: pushes lit surfaces toward gold,
    // deepens contrast, and transitions east stop from warm peach/coral in golden hour to violet at twilight
    if (G.warm + G.glow > 0.01) {
      g.globalCompositeOperation = 'soft-light';
      const gr = g.createLinearGradient(0, vh * 0.3, vw, vh * 0.8);
      gr.addColorStop(0, `rgba(255,190,82,${Math.min(1, G.warm + G.glow * 1.4)})`);
      gr.addColorStop(0.6, `rgba(255,152,96,${Math.min(1, G.warm * 0.9 + G.glow * 0.5)})`);
      gr.addColorStop(1, `rgba(${G.eastGlow[0]},${G.eastGlow[1]},${G.eastGlow[2]},${Math.min(1, G.warm * 0.45 + G.glow * 0.7)})`);
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
      lg.globalAlpha = s.kind === 'lamp' ? Math.min(1, G.lamps * 0.78) : s.kind === 'building' ? Math.min(1, G.windows * 1.05) : Math.max(G.windows, G.lamps) * 0.8;
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
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.24;
    g.drawImage(this.bloomA, 0, 0, this.bloomA.width, this.bloomA.height, 0, 0, this.lightCv.width, this.lightCv.height);
    g.globalAlpha = 0.22;
    g.drawImage(this.bloomB, 0, 0, this.bloomB.width, this.bloomB.height, 0, 0, this.lightCv.width, this.lightCv.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('bloom');
    // vignette
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72);
    vg.addColorStop(0, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},0)`);
    vg.addColorStop(1, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},${G.vigAlpha})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, vw, vh);
    P && P('end');
  }

  // Two tileable sheets of loose brush strokes (transparent ground) that slide over the painted sea
  // at different speeds, so the whole surface is always moving. Built once, 256 px each.
  buildWaterStrokes() {
    const make = (seed, n, cols, wMin, wMax, lMin, lMax, aMin, aMax) => {
      const c = layer(256, 256), g = c.getContext('2d'), r = mulberry32(seed);
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = r() * 256, y = r() * 256, a = Math.PI / 2 + (r() - 0.5) * 1.1, L = lMin + r() * (lMax - lMin), bend = (r() - 0.5) * 0.5;
        g.strokeStyle = cols[(r() * cols.length) | 0];
        g.globalAlpha = aMin + r() * (aMax - aMin);
        g.lineWidth = wMin + r() * (wMax - wMin);
        const cx = Math.cos(a) * L / 2, sy = Math.sin(a) * L / 2;
        for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
          g.beginPath(); g.moveTo(x + ox - cx, y + oy - sy);
          g.quadraticCurveTo(x + ox - sy * bend, y + oy + cx * bend, x + ox + cx, y + oy + sy); g.stroke();
        }
      }
      return this.ctx.createPattern(c, 'repeat');
    };
    return {
      deep: make(41, 70, ['#2482ba', '#38a6cc', '#165a96', '#56bed6', '#124686', '#2a6cb4'], 5, 9, 16, 34, 0.45, 0.8),
      light: make(42, 38, ['#bfefff', '#7ad0dc', '#9fe2ea', '#f0c890'], 1.6, 3.4, 10, 24, 0.5, 0.9),
    };
  }

  drawOcean(g, G, t, time, vx0, vy0, vx1, vy1) {
    const W = this.world;
    if (W.shoreX(cam_mid(vy0, vy1)) - 60 > vx1 && W.shoreX(vy0) - 60 > vx1 && W.shoreX(vy1) - 60 > vx1) return;
    if (!this.waterStrokes) this.waterStrokes = this.buildWaterStrokes();
    g.save();
    g.clip(this.waterPath);
    // drifting paint: two stroke sheets sliding shoreward at different speeds over the painted base
    const wx0 = Math.max(vx0, this.L.shore.x - this.L.shore.amp * 1.5);   // only fill where there can be water
    const slide = (pat, ox, oy, sc, alpha) => {
      g.save();
      g.translate(ox, oy); g.scale(sc, sc);
      g.globalAlpha = alpha; g.fillStyle = pat;
      g.fillRect((wx0 - ox) / sc, (vy0 - oy) / sc, (vx1 - wx0) / sc, (vy1 - vy0) / sc);
      g.restore();
    };
    slide(this.waterStrokes.deep, -time * 5.5, time * 3.2 + Math.sin(time * 0.31) * 6, 1.25, 0.36 + Math.sin(time * 0.4) * 0.05);
    slide(this.waterStrokes.light, -time * 10, -time * 2.6 + Math.sin(time * 0.47 + 1) * 5, 1, 0.42 + Math.sin(time * 0.53 + 2) * 0.08);
    // sky reflection: a gradient across the water that drifts gold -> rose -> violet as the sun goes;
    // brighter offshore (open sky), deeper near the shore (land shadow)
    const sx = W.shoreX((vy0 + vy1) / 2);
    const sky = g.createLinearGradient(sx, 0, sx + 380, 0);
    const u1 = clamp01(t / 0.6), u2 = clamp01((t - 0.6) / 0.4);
    const mix3 = (a, b, u) => a.map((v, k) => Math.round(lerp(v, b[k], u)));
    const c1 = t < 0.6 ? mix3([255, 190, 115], [244, 138, 148], u1) : mix3([244, 138, 148], [140, 110, 210], u2);
    const c2 = t < 0.6 ? mix3([130, 216, 234], [255, 172, 140], u1) : mix3([255, 172, 140], [90, 130, 220], u2);
    sky.addColorStop(0, `rgba(30,70,120,0.25)`);
    sky.addColorStop(0.35, `rgba(${c1[0]},${c1[1]},${c1[2]},0.30)`);
    sky.addColorStop(1, `rgba(${c2[0]},${c2[1]},${c2[2]},0.42)`);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = sky;
    g.fillRect(wx0, vy0, vx1 - wx0, vy1 - vy0);
    g.globalCompositeOperation = 'source-over';
    // swell: crest lines parallel to the shore, rolling in and sharpening as they near the sand
    g.lineCap = 'round';
    const SPAN = 440, GAP = 88;
    for (let k = 0; k < SPAN / GAP; k++) {
      const d = ((k * GAP - time * 11) % SPAN + SPAN) % SPAN;
      const a = Math.pow(Math.sin(Math.PI * Math.min(1, (d + 30) / (SPAN + 30))), 0.8) * 0.42;
      g.strokeStyle = `rgba(214,244,250,${a})`;
      g.lineWidth = d < 70 ? 4.2 - d * 0.02 : 2.6;
      g.setLineDash([36 + k * 7, 14 + k * 5]); g.lineDashOffset = k * 31 + time * 3;
      g.beginPath();
      for (let y = vy0 - 30; y <= vy1 + 30; y += 22) {
        const x = W.shoreX(y) + d + Math.sin(y * 0.021 + k * 1.7) * 10 + Math.sin(y * 0.05 + time * 0.5 + k) * 4;
        if (y === vy0 - 30) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.setLineDash([]);
    // glints
    const ug1 = clamp01(t / 0.55), ug2 = clamp01((t - 0.55) / 0.45);
    const gc = t < 0.55
      ? [255, 226, 152].map((v, k) => Math.round(lerp(v, [255, 182, 185][k], ug1)))
      : [255, 182, 185].map((v, k) => Math.round(lerp(v, [190, 220, 255][k], ug2)));
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
    g.restore();
    this.drawSurf(g, time, vx0, vy0, vx1, vy1);
  }

  // The breathing shoreline. Each wave runs up the sand fast and drains back slowly on a ~6.4 s
  // cycle that travels down the beach; the sand it reaches goes dark and wet, then dries until
  // the next one. Drawn as short strips so every stretch of beach is at its own point in the cycle.
  drawSurf(g, time, vx0, vy0, vx1, vy1) {
    const W = this.world, STEP = 5, T = 6.4, UP = 0.32;
    const y0 = Math.floor((vy0 - 10) / STEP) * STEP;
    for (let pass = 0; pass < 3; pass++) {
      for (let y = y0; y < vy1 + 10; y += STEP) {
        const sx = W.shoreX(y);
        if (sx + 8 < vx0 || sx - 60 > vx1) continue;
        const k = y / STEP, n1 = 0.5 + 0.5 * Math.sin(y * 0.031) * Math.sin(y * 0.0113 + 1.7), n2 = 0.5 + 0.5 * Math.sin(y * 0.0071 + 4);
        let u = time / T - y / 1500 + n2 * 0.16; u -= Math.floor(u);
        const reach = 26 + 20 * n1;                                  // how far up the sand this stretch gets
        const run = u < UP ? 1 - Math.pow(1 - u / UP, 3) : 1 - smooth(0, 1, (u - UP) / (1 - UP));
        const front = sx + 3 - reach * run;
        if (pass === 0) {
          // wet sand: last wave's stain drying out, and the fresh one spreading under the new wave
          const dry = u < UP ? 0.3 * (1 - u / UP) : lerp(0.72, 0.3, Math.pow((u - UP) / (1 - UP), 0.8));
          g.fillStyle = `rgba(92,50,40,${dry})`;
          g.fillRect(sx + 3 - reach, y, reach + 2, STEP);
          if (u < UP) { g.fillStyle = `rgba(92,50,40,${0.72 - 0.3 * (1 - u / UP)})`; g.fillRect(front - 2, y, sx + 5 - front, STEP); }
          else if (u < UP + 0.3) {                                   // glassy sheen while the water drains off
            g.fillStyle = `rgba(255,232,196,${0.22 * (1 - (u - UP) / 0.3)})`;
            g.fillRect(sx + 3 - reach, y, front - (sx + 3 - reach), STEP);
          }
        } else if (pass === 1) {
          // the sheet of water itself, paler toward its leading edge
          g.fillStyle = 'rgba(52,140,188,0.8)'; g.fillRect(front + 6, y, sx + 6 - (front + 6), STEP);
          g.fillStyle = 'rgba(150,218,230,0.72)'; g.fillRect(front, y, Math.min(8, sx + 6 - front), STEP);
        } else {
          // foam: a scalloped lip on the leading edge, bright running in, thinning as it drains;
          // plus the lace it leaves at the high-water mark
          const fa = u < UP ? 0.92 : 0.75 * (1 - smooth(0, 0.8, (u - UP) / (1 - UP))) + 0.12;
          g.fillStyle = `rgba(252,246,232,${fa})`;
          g.beginPath(); g.ellipse(front + Math.sin(k * 1.9) * 1.6, y + STEP / 2, 3.2 + n1 * 2.2, STEP * 0.72, 0, 0, 7); g.fill();
          if (u < UP) { g.fillStyle = 'rgba(252,246,232,0.4)'; g.beginPath(); g.ellipse(front + 7 + Math.sin(k * 2.7) * 2, y + STEP / 2, 2.2, STEP * 0.5, 0, 0, 7); g.fill(); }
          else if (u < UP + 0.42 && (Math.floor(k) % 2 === 0)) {
            g.fillStyle = `rgba(252,246,232,${0.5 * (1 - (u - UP) / 0.42)})`;
            g.beginPath(); g.ellipse(sx + 3 - reach + Math.sin(k * 3.1) * 1.5, y + STEP / 2, 1.6, 2.4, 0, 0, 7); g.fill();
          }
        }
      }
    }
  }

  drawNeonPuddles(lg, G, time, vx0, vy0, vx1, vy1) {
    for (const p of this.L.neonPuddles) {
      if (p.x + p.r < vx0 || p.x - p.r > vx1 || p.y + p.r < vy0 || p.y - p.r > vy1) continue;
      // Soft ambient neon bounce on wet pavement (drawWetReflections supplies the mirror ribbons)
      const rg = lg.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r * 1.15);
      rg.addColorStop(0, p.color);
      rg.addColorStop(0.45, p.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      lg.globalAlpha = G.neon * 0.24;
      lg.fillStyle = rg;
      lg.beginPath();
      lg.ellipse(p.x, p.y, p.r * 1.15, p.r * 0.65, 0, 0, 7);
      lg.fill();
    }
    lg.globalAlpha = 1;
  }

  // Signature move from the neon anchor: every lamp and sign throws a smooth rippled vertical mirror
  // streak of its colour across the wet asphalt toward the viewer.
  buildReflectors() {
    const L = this.L, W = this.world, out = [];
    const NEON = { SOLANA: '#ff4fa8', TACOS: '#ff8a3c', DINER: '#3fe0ff', MOTEL: '#ff3f6a', NOVA: '#b45cff' };
    for (const [x, y] of L.lamps) out.push({ x: x + 13, y: y + 6, col: [255, 178, 86], len: 120, lamp: true, w0: 3.4 });
    for (const b of L.buildings) if (b.sign) {
      let best = null;
      for (const [px, py] of [[b.x + b.w / 2, b.y + b.d + 36], [b.x + b.w / 2, b.y - 36], [b.x - 36, b.y + b.d / 2], [b.x + b.w + 36, b.y + b.d / 2]]) {
        const d = W.roadInfo(px, py).d; if (!best || d < best.d) best = { x: px, y: py, d };
      }
      const h = NEON[b.sign].slice(1);
      const baseCol = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
      if (b.sign === 'NOVA') {
        out.push({ x: best.x - 52, y: b.y + b.d + 34, col: [255, 79, 216], len: 125, w0: 6.5 });
        out.push({ x: best.x,      y: b.y + b.d + 34, col: [255, 191, 92], len: 135, w0: 7.5 });
        out.push({ x: best.x + 52, y: b.y + b.d + 34, col: [63, 224, 255], len: 125, w0: 6.5 });
      } else {
        out.push({ x: best.x, y: best.y, col: baseCol, len: 130, w0: 6.0 });
      }
    }
    return out;
  }

  drawWetReflections(lg, G, time, vx0, vy0, vx1, vy1) {
    if (!this.reflectors) this.reflectors = this.buildReflectors();
    const W = this.world, half = W.halfRoad - 2;
    lg.lineCap = 'round';
    for (const r of this.reflectors) {
      const peak = r.lamp ? G.lamps * 0.44 : G.neon * 0.50;
      if (peak < 0.02 || r.x < vx0 - 40 || r.x > vx1 + 40 || r.y < vy0 - 150 || r.y > vy1 + 20) continue;
      const phase = r.x * 0.13 + r.y * 0.07;
      const gr = lg.createLinearGradient(0, r.y, 0, r.y + r.len);
      gr.addColorStop(0, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${peak * 0.85})`);
      gr.addColorStop(0.35, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},${peak * 0.52})`);
      gr.addColorStop(1, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0)`);
      lg.fillStyle = gr;
      for (let dy = 2; dy < r.len; dy += 2.2) {
        const wy = r.y + dy;
        const rd = W.roadInfo(r.x, wy).d;
        if (rd > half) continue;
        const u = dy / r.len;
        const amp = (r.lamp ? 2.4 : 3.8) * (0.3 + 0.7 * u);
        const dx = amp * Math.sin(dy * 0.24 + phase + time * 2.2) + 0.45 * amp * Math.sin(dy * 0.55 - time * 1.5);
        const mod = 0.52 + 0.48 * Math.pow(Math.sin(dy * 0.21 + phase), 2);
        const rx = Math.max(1.0, r.w0 * mod * (1 - 0.48 * u));
        lg.globalAlpha = 0.36;
        lg.beginPath(); lg.ellipse(r.x + dx, wy, rx * 1.8, 2.6, 0, 0, 7); lg.fill();
        lg.globalAlpha = 0.62;
        lg.beginPath(); lg.ellipse(r.x + dx, wy, rx * 0.72, 2.2, 0, 0, 7); lg.fill();
      }
    }
    lg.globalAlpha = 1;
  }

  // rails, benches and the fountain rim — painted in place (metal glints, wood slats)
  drawSkatePark(g, S) {
    if (!S.rails) return;
    g.lineCap = 'round';
    const P = this.L.pier;
    if (P) {                                              // end rail + posts, so the pier reads as railed all round
      const ex = P.x + P.w - 2;
      g.strokeStyle = 'rgba(40,24,60,0.35)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(ex + 3, P.y + 2); g.lineTo(ex + 3, P.y + P.h - 2); g.stroke();
      g.strokeStyle = '#d9d4e6'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(ex, P.y + 2); g.lineTo(ex, P.y + P.h - 2); g.stroke();
      g.fillStyle = '#4a3550';
      for (let x = P.x + 8; x <= ex + 1; x += (P.w - 10) / 9) for (const y of [P.y + 2, P.y + P.h - 2]) { g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); }
    }
    for (const r of S.rails) {
      g.strokeStyle = 'rgba(40,24,60,0.35)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(r.x0 + 4, r.y0 - 1.5); g.lineTo(r.x1 + 4, r.y1 - 1.5); g.stroke();
      g.strokeStyle = '#d9d4e6'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(r.x0, r.y0); g.lineTo(r.x1, r.y1); g.stroke();
      g.strokeStyle = '#fff4dc'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(r.x0 - 0.6, r.y0 - 0.6); g.lineTo(r.x1 - 0.6, r.y1 - 0.6); g.stroke();
    }
    for (const b of S.benches) {
      g.save(); g.translate(b.x, b.y); g.rotate(b.a);
      g.fillStyle = 'rgba(40,24,60,0.35)'; g.fillRect(-b.w / 2 + 3, -b.d / 2 + 2, b.w, b.d);
      for (let i = 0; i < 3; i++) { g.fillStyle = ['#c9875a', '#b97a50', '#d8966a'][i]; g.fillRect(-b.w / 2, -b.d / 2 + i * 3, b.w, 2.6); }
      g.fillStyle = '#3a3044'; g.fillRect(-b.w / 2 + 2, -b.d / 2 - 0.5, 2, b.d + 1); g.fillRect(b.w / 2 - 4, -b.d / 2 - 0.5, 2, b.d + 1);
      g.restore();
    }
    for (const c of S.rims) {
      g.strokeStyle = 'rgba(255,248,230,0.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.stroke();
    }
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
}

function cam_mid(a, b) { return (a + b) / 2; }

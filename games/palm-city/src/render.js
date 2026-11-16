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
import { TrackLayer } from './skid.js';
import { markers } from './activities.js';
import { CHOPPER } from './pressure.js';
import { JOBS } from './jobs.js';
import { drawEventsGround } from './events_render.js';
import { DEBRIS_CAP, SMOKE_CAP, STAGES, stageOf, FALL_T, palmReach } from './destruct.js';

// procedural debris colours (index = destruct.js D kind) for the kinds with no sprite
const DEBRIS_COL = ['#d8f0ff', '#8a8f9c', '#b97a50', '#e0a878', '#2f6a22', '#7a5232', '#523420', '#b8b0a4', '#222', '#6fa844', '#ff6494'];
const PETALS = ['#ff6494', '#ffd44c', '#fff4e8'];

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
const DASH = [0, 0], NO_DASH = [];

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
    this.buildDestructSprites();
    this.tracks = new TrackLayer(layer);          // tyre marks: stamped once, under everything that moves
    this.lastTime = 0;
  }

  // Destruction sprites (assets/destruct.json): per-model car stages and pooled debris variants.
  buildDestructSprites() {
    const X = this.M.destruct || {};
    this.carStage = {};
    for (const model in this.M.cars) this.carStage[model] = [null, X[`car_${model}_s1`], X[`car_${model}_s2`], X[`car_${model}_s3`]];
    const v = (...k) => k.map(n => X[n]).filter(Boolean);
    // index = destruct.js D kind; each kind lists its sprite variants (empty = drawn procedurally)
    this.debrisSprites = [
      v('debris_glass_1', 'debris_glass_2', 'debris_glass_3'), v('debris_metal_1', 'debris_metal_2', 'debris_metal_2'),
      v('debris_wood_1'), v('debris_wood_3'), [], v('debris_wood_3'), [], [], v('debris_tire_1', 'debris_tire_2'), v('debris_wood_2'), [],
    ];
    this.policeShard = X.debris_metal_3;
    this.scorch = X.debris_ash_scorch;
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
    this.fw = w; this.fh = h;
    // perf pass: the additive light layer is soft by nature (glows, cones, reflections), so it's built
    // at half resolution and upscaled with smoothing on the composite — a quarter of the fill cost.
    this.lightCv = layer(Math.ceil(w / 2), Math.ceil(h / 2));
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
    L.lamps.forEach(([x, y], i) => out.push({ kind: 'lamp', x, y, li: i, e: M.props.lamp }));
    for (const b of this.world.bushes) out.push({ kind: 'bush', x: b.x, y: b.y, sc: b.sc, bi: b.i, e: M.props['bush' + b.v] });
    L.props.forEach((p, i) => out.push({ kind: p.type, x: p.x, y: p.y, pi: i, e: M.props[p.type] }));
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
  // Palms also carry their destruction state (destruct.js): a cracked palm leans away from the blows
  // with a split showing at the collar; a snapped one falls (crown sweeping out from the stump), then
  // lies on the ground as Gemini's fallen-trunk sprite.
  drawStatic(g, s, f, S) {
    if (s.kind === 'bush' && S.bushes) { this.drawBush(g, s, f, S.bushes[s.bi], S.time); return; }
    if (s.kind === 'lamp' && S.lamps) { this.drawLamp(g, s, f, S.lamps[s.li]); return; }
    if (s.kind === 'lifeguard' && S.towers && S.towers[s.pi]) { this.drawTower(g, s, f, S.towers[s.pi]); return; }
    const P = s.kind === 'palm' && S.palms ? S.palms[s.ti] : null;
    if (P && P.fall) {                                 // no tall shadow once it goes; a landed palm is drawn at ground level
      if (f === s.e.color && !P.fall.landed) this.drawFallenPalm(g, s, P);
      return;
    }
    const sh = s.kind === 'palm' && S.shakes ? S.shakes[s.ti] : null;
    const lean = P && P.stage ? (P.stage === 1 ? 4 : 8) * s.sc : 0;
    if (!sh && !lean) { this.drawEntry(g, f, s.x, s.y, s.sc); return; }
    const e = sh ? Math.exp(-3.6 * sh.t) * sh.amp : 0;
    g.save();
    const lx = lean ? P.lx * lean : 0, ly = lean ? P.ly * lean : 0;
    g.translate(s.x + (sh ? sh.ax * Math.sin(sh.t * 40) * 4.5 * e : 0) + lx, s.y + (sh ? sh.ay * Math.sin(sh.t * 40) * 4.5 * e : 0) + ly);
    g.rotate((sh ? Math.sin(sh.t * 27) * 0.13 * e : 0) + (lean ? 0.05 * P.stage : 0));
    this.drawEntry(g, f, 0, 0, s.sc);
    g.restore();
    if (lean && f === s.e.color) {                    // the split at the collar, facing the blows
      const a = Math.atan2(-P.ly, -P.lx);
      g.save(); g.translate(s.x, s.y); g.rotate(a);
      g.fillStyle = '#ddb47e'; g.strokeStyle = '#210f2e'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(3.5 * s.sc, -2.2 * P.stage); g.lineTo(7 * s.sc, 0); g.lineTo(3.5 * s.sc, 2.2 * P.stage); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  // Bushes by stage (look spec §3): a quick wobble on every hit; sheared and squashed away from the
  // hit; flattened into a wide bruised oval; torn out (drawn as a root pit at ground level instead).
  drawBush(g, s, f, B, time) {
    if (!B || B.stage === 0) {
      const w = B ? time - B.hitT : 9;
      if (w > 0.4) { this.drawEntry(g, f, s.x, s.y, s.sc); return; }
      g.save(); g.translate(s.x, s.y); g.rotate(Math.sin(w * 40) * 0.18 * (1 - w / 0.4));
      this.drawEntry(g, f, 0, 0, s.sc); g.restore(); return;
    }
    if (B.stage >= 3) return;
    const a = Math.atan2(B.ay, B.ax), flat = B.stage >= 2;
    g.save(); g.translate(s.x + B.ax * (flat ? 3 : 2), s.y + B.ay * (flat ? 3 : 2)); g.rotate(a);
    // stage 1: sheared ~12 deg away from the hit and squashed a little; stage 2: splayed wide across
    // the hit, pressed forward, with a bruised, trampled middle
    if (flat) g.scale(1.12, 1.34); else { g.transform(1, 0, 0.3, 1, 0, 0); g.scale(0.84, 1.06); }
    g.rotate(-a);
    this.drawEntry(g, f, 0, 0, s.sc);
    g.restore();
    if (flat && f === s.e.color) {
      g.save(); g.translate(s.x + B.ax * 3, s.y + B.ay * 3); g.rotate(a);
      g.globalAlpha = 0.42; g.fillStyle = '#3a3018';  // pressed down: darker all over, bruised in the middle
      g.beginPath(); g.ellipse(0, 0, 11 * s.sc, 13 * s.sc, 0, 0, 7); g.fill();
      g.globalAlpha = 0.5; g.fillStyle = '#4a3c1c';
      g.beginPath(); g.ellipse(0, 0, 5 * s.sc, 9 * s.sc, 0, 0, 7); g.fill();
      g.globalAlpha = 0.55; g.strokeStyle = '#2e3a18'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath();                                    // stems pressed flat in the direction of the hit
      for (let i = -2; i <= 2; i++) { g.moveTo(-5 * s.sc, i * 3 * s.sc); g.lineTo(6 * s.sc, i * 3.6 * s.sc); }
      g.stroke(); g.globalAlpha = 1; g.restore();
    }
    if (B.track && f === s.e.color) {                 // tyre tracks straight through it
      g.save(); g.translate(s.x, s.y); g.rotate(a);
      g.lineCap = 'round'; g.strokeStyle = '#2a2014'; g.lineWidth = 2.6;
      for (const o of [-6.5, 6.5]) {
        g.globalAlpha = 0.42; g.beginPath(); g.moveTo(-13 * s.sc, o); g.lineTo(13 * s.sc, o + 0.6); g.stroke();
        g.globalAlpha = 0.35; g.setLineDash([2, 2.4]); g.lineWidth = 1.2; g.strokeStyle = '#120c08';   // tread
        g.beginPath(); g.moveTo(-12 * s.sc, o); g.lineTo(12 * s.sc, o + 0.6); g.stroke(); g.setLineDash([]); g.lineWidth = 2.6; g.strokeStyle = '#2a2014';
      }
      g.globalAlpha = 1; g.restore();
    }
  }

  // Root pit where a bush was torn out: dark soil ringed in ink, two torn root stubs.
  drawRootPit(g, B) {
    const r = 9 * B.sc;
    g.fillStyle = '#382214'; g.strokeStyle = '#210f2e'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(B.x, B.y, r, r * 0.72, 0.3, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#523420'; g.beginPath(); g.ellipse(B.x - r * 0.15, B.y - r * 0.12, r * 0.6, r * 0.38, 0.3, 0, 7); g.fill();
    g.strokeStyle = '#6c4428'; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(B.x + r * 0.2, B.y); g.lineTo(B.x + r * 0.95, B.y + r * 0.35);
    g.moveTo(B.x - r * 0.3, B.y + r * 0.1); g.lineTo(B.x - r * 0.8, B.y + r * 0.6); g.stroke();
  }

  // A street lamp's light: dead once it's down, flickering while it's damaged.
  lampLight(S, i, time) {
    const T = S && S.lamps && S.lamps[i];
    if (!T || !T.stage) return 1;
    if (T.stage >= 3) return 0;
    const f = Math.sin(time * 23 + i * 7) + Math.sin(time * 9.3 + i);
    return f > 1.2 ? 0.15 : 0.85;
  }

  // Street lamp by stage: the head skews away from the hit (1), the pole bends over (2), it snaps at
  // the base and lies across the ground with its lantern smashed (3).
  drawLamp(g, s, f, T) {
    if (!T || !T.stage) { this.drawEntry(g, f, s.x, s.y); return; }
    const a = Math.atan2(T.ay, T.ax);
    if (T.stage >= 3) {
      if (f !== s.e.color || !s.ground) return;         // lying flat: no tall shadow; drawn in the ground pass
      g.lineCap = 'round';
      g.strokeStyle = '#210f2e'; g.lineWidth = 4.2;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + T.ax * 40, s.y + T.ay * 40); g.stroke();
      g.strokeStyle = '#3a3044'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + T.ax * 40, s.y + T.ay * 40); g.stroke();
      g.fillStyle = '#2a2230'; g.beginPath(); g.ellipse(s.x + T.ax * 43, s.y + T.ay * 43, 4, 3, a, 0, 7); g.fill();
      g.fillStyle = '#4a3e52'; g.beginPath(); g.arc(s.x, s.y, 3, 0, 7); g.fill();   // the twisted base socket
      return;
    }
    g.save(); g.translate(s.x, s.y); g.rotate((T.stage === 1 ? 0.28 : 0.7) * (Math.sin(a) >= 0 ? 1 : -1));
    g.translate(T.ax * T.stage * 3, T.ay * T.stage * 3);
    this.drawEntry(g, f, 0, 0); g.restore();
  }

  // Lifeguard tower by stage: skewed with a cracked canopy (1), roof crushed and tilted (2), a pile of
  // tan deck planks and crumpled turquoise canopy strips (3).
  drawTower(g, s, f, T) {
    if (!T.stage) { this.drawEntry(g, f, s.x, s.y); return; }
    const a = Math.atan2(T.ay, T.ax);
    if (T.stage >= 3) {
      if (f !== s.e.color) return;
      let seed = 97 + T.i * 13;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 9; i++) {
        g.save(); g.translate(s.x + (rnd() - 0.5) * 26 + T.ax * 6, s.y + (rnd() - 0.5) * 22 + T.ay * 6); g.rotate(rnd() * 3.1);
        g.fillStyle = i < 6 ? '#d4a070' : '#2fb3a6'; g.strokeStyle = '#210f2e'; g.lineWidth = 0.6;
        g.fillRect(-7, -1.6, 14, 3.2); g.strokeRect(-7, -1.6, 14, 3.2); g.restore();
      }
      return;
    }
    g.save(); g.translate(s.x + T.ax * T.stage * 2, s.y + T.ay * T.stage * 2);
    g.rotate((T.stage === 1 ? 0.06 : -0.28) * (Math.cos(a) >= 0 ? 1 : -1));
    if (T.stage >= 2) g.scale(0.9, 0.82);               // the roof caved in
    this.drawEntry(g, f, 0, 0);
    g.restore();
    if (f === s.e.color) {                              // a crack across the canopy
      g.strokeStyle = 'rgba(33,15,46,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(s.x - 6, s.y - 5); g.lineTo(s.x, s.y - 1); g.lineTo(s.x + 4, s.y - 6); g.lineTo(s.x + 8, s.y + 2); g.stroke();
      if (T.stage >= 2) { g.fillStyle = '#d4a070'; g.fillRect(s.x - 8, s.y + 4, 16, 3); }   // deck beams showing
    }
  }

  drawFallenPalm(g, s, P) {
    const X = this.M.destruct, F = P.fall, sc = s.sc, ang = Math.atan2(F.ay, F.ax);
    const u = Math.min(1, F.t / FALL_T);
    if (u >= 1 && X && X.palm_s2) {                    // settled: the fallen trunk + crown, anchored at the stump
      const e = X.palm_s2;
      g.save(); g.translate(s.x, s.y); g.rotate(ang); g.scale(sc, sc);
      g.drawImage(e.img, e.ox, e.oy, e.w, e.h); g.restore();
      return;
    }
    // falling: it tips under gravity — the crown sweeps out along the fall and the trunk stretches to it
    const th = u * u * Math.PI / 2, L = palmReach(P) * Math.sin(th), cx = s.x + F.ax * L, cy = s.y + F.ay * L;
    g.lineCap = 'round';
    g.strokeStyle = '#210f2e'; g.lineWidth = 9 * sc;
    g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(cx, cy); g.stroke();
    g.strokeStyle = '#a6764c'; g.lineWidth = 7 * sc;
    g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(cx, cy); g.stroke();
    g.fillStyle = '#ddb47e'; g.beginPath(); g.arc(s.x, s.y, 4.5 * sc, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.rotate(th * 0.6 * Math.sign(F.ax || 1));
    this.drawEntry(g, s.e.color, 0, 0, sc * (1 - 0.12 * Math.sin(th)));
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

  // perf pass (zero per-frame allocation): the grade, and every style and gradient derived from it,
  // is rebuilt only when time of day moves a visible step (1/2000 of the day ≈ every 0.1 s of play).
  gradeFor(t) {
    const tq = Math.round(t * 2000) / 2000;
    if (this.G && this.G.tq === tq && this.G.vw === this.vw && this.G.vh === this.vh) return this.G;
    const G = grade(tq), g = this.ctx, vw = this.vw, vh = this.vh;
    G.tq = tq; G.vw = vw; G.vh = vh;
    G.roofMulStyle = `rgb(${G.roofMul[0]},${G.roofMul[1]},${G.roofMul[2]})`;
    G.shadowStyle = `rgb(${G.shadowCol[0]},${G.shadowCol[1]},${G.shadowCol[2]})`;
    const preMul = G.mul.map((v, k) => Math.min(255, Math.round((v / Math.max(1, G.roofMul[k])) * 255)));
    G.preMulStyle = preMul[0] < 252 || preMul[1] < 252 || preMul[2] < 252 ? `rgb(${preMul[0]},${preMul[1]},${preMul[2]})` : null;
    if (G.warm + G.glow > 0.01) {
      const gr = G.warmGrad = g.createLinearGradient(0, vh * 0.3, vw, vh * 0.8);
      gr.addColorStop(0, `rgba(255,190,82,${Math.min(1, G.warm + G.glow * 1.4)})`);
      gr.addColorStop(0.6, `rgba(255,152,96,${Math.min(1, G.warm * 0.9 + G.glow * 0.5)})`);
      gr.addColorStop(1, `rgba(${G.eastGlow[0]},${G.eastGlow[1]},${G.eastGlow[2]},${Math.min(1, G.warm * 0.45 + G.glow * 0.7)})`);
    }
    const vg = G.vigGrad = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72);
    vg.addColorStop(0, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},0)`);
    vg.addColorStop(1, `rgba(${G.vigCol[0]},${G.vigCol[1]},${G.vigCol[2]},${G.vigAlpha})`);
    // ocean: sky-reflection stops and glint colour (drawOcean)
    const u1 = clamp01(tq / 0.6), u2 = clamp01((tq - 0.6) / 0.4);
    const mix3 = (a, b, u) => a.map((v, k) => Math.round(lerp(v, b[k], u)));
    const c1 = tq < 0.6 ? mix3([255, 190, 115], [244, 138, 148], u1) : mix3([244, 138, 148], [140, 110, 210], u2);
    const c2 = tq < 0.6 ? mix3([130, 216, 234], [255, 172, 140], u1) : mix3([255, 172, 140], [90, 130, 220], u2);
    const sky = G.skyGrad = g.createLinearGradient(0, 0, 380, 0);     // drawn translated to the shore x
    sky.addColorStop(0, `rgba(30,70,120,0.25)`);
    sky.addColorStop(0.35, `rgba(${c1[0]},${c1[1]},${c1[2]},0.30)`);
    sky.addColorStop(1, `rgba(${c2[0]},${c2[1]},${c2[2]},0.42)`);
    const ug1 = clamp01(tq / 0.55), ug2 = clamp01((tq - 0.55) / 0.45);
    const gc = tq < 0.55 ? mix3([255, 226, 152], [255, 182, 185], ug1) : mix3([255, 182, 185], [190, 220, 255], ug2);
    G.glintStyle = `rgb(${gc[0]},${gc[1]},${gc[2]})`;
    return (this.G = G);
  }

  draw(S, cam, t, time) {
    const g = this.ctx, vw = this.vw, vh = this.vh, dpr = this.dpr;
    // ?prof: per-section CPU time (ms, exponential average) in window.__prof
    let P = null;
    if (this.prof) {
      // P(name) closes the section that just ran and books its time under `name`
      let t0 = performance.now();
      P = (name) => { const t1 = performance.now(); this.prof[name] = (this.prof[name] || 0) * 0.9 + (t1 - t0) * 0.1; t0 = t1; };
    }
    const G = this.gradeFor(t);
    const zoom = cam.zoom || 1;
    const hw = vw / 2 / zoom, hh = vh / 2 / zoom;
    const vx0 = cam.x - hw, vy0 = cam.y - hh, vx1 = cam.x + hw, vy1 = cam.y + hh;
    const inView = (bb, m = 0) => bb[2] > vx0 - m && bb[0] < vx1 + m && bb[3] > vy0 - m && bb[1] < vy1 + m;
    // 2D camera feel: zoom-punch (cam.kick) and a clamped roll (cam.roll) on the WORLD transform only;
    // the grade, light composite, HUD stay level. Culling keeps the un-kicked bounds, which cover it.
    const kick = cam.kick || 1, roll = cam.roll || 0;
    const worldTf = (ctx, s = 1) => {
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      ctx.translate(vw / 2, vh / 2);
      if (roll) ctx.rotate(roll);
      ctx.scale(zoom * kick, zoom * kick);
      ctx.translate(-cam.x, -cam.y);
    };

    P && P('setup');
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
    this.tracks.draw(g, S, Math.max(0, Math.min(0.1, time - this.lastTime)), vx0, vy0, vx1, vy1);
    this.lastTime = time;

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
    if (S.chopper) {                                   // the chopper's soft altitude shadow, cast down-sun
      const c = S.chopper, e = this.M.pressure.chopper.shadow;
      sg.save(); sg.globalAlpha = 0.45; sg.translate(c.x + CHOPPER.ALT * 0.8, c.y - CHOPPER.ALT * 0.3); sg.rotate(c.h + Math.PI / 2);
      sg.drawImage(e.img, e.ox, e.oy, e.w, e.h); sg.restore();
    }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = G.shadowStyle;
    sg.fillRect(0, 0, this.shadowCv.width, this.shadowCv.height);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = G.shadow;
    g.drawImage(this.shadowCv, 0, 0);
    // Ground-only pre-darken ratio (M_ground / M_roof) so streets hit midnight [24,38,108] at dusk while roofs retain chroma
    if (G.preMulStyle) {
      g.globalAlpha = 1;
      g.fillStyle = G.preMulStyle;
      g.fillRect(0, 0, vw * dpr, vh * dpr);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('shadows');
    // ---------------- 3. colour sprites
    worldTf(g);
    for (const s of this.statics) if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') if (inView(s.bb)) {
      if (s.kind === 'lifeguard' && S.towers && S.towers[s.pi]) this.drawTower(g, s, s.e.color, S.towers[s.pi]); else this.drawEntry(g, s.e.color, s.x, s.y);
    }
    this.drawSkatePark(g, S);
    this.drawStreetPressure(g, S, t, time, vx0, vy0, vx1, vy1);
    this.drawJobsGround(g, S, time);
    drawEventsGround(g, S, time);
    this.drawMotelDoor(g, S, time);
    this.drawDebris(g, S, vx0, vy0, vx1, vy1);
    if (S.board) {
      const b = S.board, f = this.M.props.board.color, k = 1 + b.z * 0.35;
      g.save(); g.translate(b.x, b.y); g.rotate(b.h + Math.PI / 2); g.scale(k, k);
      if (b.grind) { g.shadowColor = 'rgba(255,220,140,0.9)'; g.shadowBlur = 8; }
      g.drawImage(f.img, f.ox, f.oy, f.w, f.h); g.restore();
    }
    if (S.bushes) for (const B of S.bushes) if (B.stage >= 3 && B.x > vx0 - 20 && B.x < vx1 + 20 && B.y > vy0 - 20 && B.y < vy1 + 20) this.drawRootPit(g, B);
    if (S.lamps) for (const s of this.statics) {      // downed lamps too
      if (s.kind !== 'lamp' || !inView(s.bb, 60)) continue;
      const T = S.lamps[s.li];
      if (T.stage >= 3) { s.ground = true; this.drawLamp(g, s, s.e.color, T); s.ground = false; }
    }
    if (S.palms) for (const s of this.statics) {      // fallen palms lie on the ground, under people and cars
      if (s.kind !== 'palm') continue;
      const P = S.palms[s.ti];
      if (P.fall && P.fall.landed && inView(s.bb, 140)) this.drawFallenPalm(g, s, P);
    }
    if (this.scorch) for (const c of S.cars) {          // soot stain under every wreck
      if (!c.wreck || c.x < vx0 - 40 || c.x > vx1 + 40 || c.y < vy0 - 40 || c.y > vy1 + 40) continue;
      const e = this.scorch; g.globalAlpha = 0.85; g.drawImage(e.img, c.x + e.ox, c.y + e.oy, e.w, e.h); g.globalAlpha = 1;
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
    { // turbo: painted speed streaks torn back off the car, and a hot glow at the tail
      const c = S.player.mode === 'car' ? S.player.car : null, tb = c ? c.turbo || 0 : 0;
      if (tb > 0.03) {
        const ca = Math.cos(c.h), sa = Math.sin(c.h);
        g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const ph = (time * (2.6 + (i % 3) * 0.7) + i * 0.37) % 1;            // each streak slides back and fades
          const side = ((i * 7) % 9 - 4) / 4 * (c.wid / 2 + 7), back = c.len * 0.2 + ph * 70, len = (16 + (i % 4) * 9) * tb;
          const x = c.x - ca * back - sa * side, y = c.y - sa * back + ca * side;
          g.globalAlpha = tb * (1 - ph) * 0.75;
          g.strokeStyle = i % 3 ? '#fff1cf' : '#ffc46a'; g.lineWidth = 2.6 - (i % 3) * 0.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - ca * len, y - sa * len); g.stroke();
        }
        g.globalAlpha = 0.5 * tb; g.fillStyle = '#ffb45a';
        g.beginPath(); g.ellipse(c.x - ca * (c.len / 2 + 5), c.y - sa * (c.len / 2 + 5), 9, 5, c.h, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
    }
    for (const c of S.cars) {
      if (c.x < vx0 - 50 || c.x > vx1 + 50 || c.y < vy0 - 50 || c.y > vy1 + 50) continue;
      const { m, k, rows } = this.carCell(c);
      const st = c.dmg >= STAGES.car[0] ? stageOf(c.dmg, 'car') : 0, e = st ? this.carStage[c.model][st] : null;
      if (e) {                                          // the damage-stage sprite replaces the baked cell
        g.save(); g.translate(c.x, c.y); g.rotate(c.h + Math.PI / 2);
        g.drawImage(e.img, e.ox, e.oy, e.w, e.h); g.restore();
      } else {
        this.drawCell(g, m.color, k, m.cols, rows, c.x, c.y);
        if (c.dmg > 0.01) this.drawCarDamage(g, c);     // scuffs and first dents, before stage 1
      }
    }
    for (const s of this.statics) {
      if (s.kind === 'pier' || s.kind === 'fountain' || s.kind === 'lifeguard') continue;
      if (inView(s.bb)) this.drawStatic(g, s, s.e.color, S);
    }
    this.drawLeaves(g, S);
    this.drawSmoke(g, S, vx0, vy0, vx1, vy1);
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
    this.drawJobsTop(g, S, time);
    this.drawActivityMarkers(g, S, time, vx0, vy0, vx1, vy1);   // painted tags over everything you can start
    if (S.chopper) this.drawChopper(g, S.chopper, t, time);    // above roofs and palms

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
    g.fillStyle = G.roofMulStyle;
    g.fillRect(0, 0, vw, vh);
    // low-sun warmth + glow from the west, one soft-light pass: pushes lit surfaces toward gold,
    // deepens contrast, and transitions east stop from warm peach/coral in golden hour to violet at twilight
    if (G.warm + G.glow > 0.01) {
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = G.warmGrad;
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
    worldTf(lg, 0.5);
    lg.globalCompositeOperation = 'lighter';
    for (const s of this.statics) {
      if (!s.e.night || !inView(s.bb)) continue;
      lg.globalAlpha = s.kind === 'lamp' ? Math.min(1, G.lamps * 0.78) * this.lampLight(S, s.li, time) : s.kind === 'building' ? Math.min(1, G.windows * 1.05) : Math.max(G.windows, G.lamps) * 0.8;
      if (lg.globalAlpha > 0.01) this.drawEntry(lg, s.e.night, s.x, s.y);
    }
    this.drawNeonPuddles(lg, G, time, vx0, vy0, vx1, vy1);
    this.drawWetReflections(lg, G, time, vx0, vy0, vx1, vy1, S);
    if (S.chopper) this.drawSearchlight(lg, S.chopper, t, time, S.stars);
    { // activity markers carry their own light, so the plaques still read after dark
      const list = this.mk || [], al = Math.max(G.lamps, G.windows) * 0.55;
      if (al > 0.02) for (let i = 0; i < list.length; i++) {
        const m = list[i], y = m.y - (m.a.group === 'hub' ? 6 : m.a.group === 'job' ? 38 : 46);
        if (m.x < vx0 - 80 || m.x > vx1 + 80 || y < vy0 - 60 || y > vy1 + 60) continue;
        lg.globalAlpha = al; lg.fillStyle = '#ffe9c4';
        lg.beginPath(); lg.roundRect(m.x - 30, y - 11, 60, 22, 8); lg.fill();
        lg.globalAlpha = al * 0.9; lg.fillStyle = m.a.door ? '#ffb08a' : '#ffd9a0';
        if (m.a.door) { lg.beginPath(); lg.ellipse(m.x + 10, m.y, 40, 26, 0, 0, 7); lg.fill(); }
      }
      lg.globalAlpha = 1;
    }
    for (const h of S.sawhorses) {                       // amber beacons on the barricades
      if (h.broken || h.x < vx0 - 40 || h.x > vx1 + 40 || h.y < vy0 - 40 || h.y > vy1 + 40) continue;
      const e = this.M.pressure.sawhorse.night;
      lg.globalAlpha = (0.35 + 0.5 * G.lamps) * (0.6 + 0.4 * Math.sin(time * 8 + h.x));
      lg.drawImage(e.img, h.x + e.ox, h.y + e.oy, e.w, e.h);
    }
    lg.globalAlpha = 1;
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
      if (c.wreck) {                                    // the engine ember under the crumpled hood
        const ca = Math.cos(c.h), sa = Math.sin(c.h), ex = c.x + ca * c.len * 0.3, ey = c.y + sa * c.len * 0.3;
        lg.globalAlpha = 0.35 + 0.5 * Math.max(G.lamps, 0.3) * (0.75 + 0.25 * Math.sin(time * 9 + c.id));
        lg.fillStyle = this.ember || (this.ember = (() => { const r = lg.createRadialGradient(0, 0, 0, 0, 0, 22); r.addColorStop(0, 'rgba(255,207,92,1)'); r.addColorStop(0.35, 'rgba(255,118,28,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); return r; })());
        lg.save(); lg.translate(ex, ey); lg.fillRect(-22, -22, 44, 44); lg.restore();
      }
    }
    lg.globalAlpha = 1;
    P && P('lights');
    // composite light + bloom
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
    g.drawImage(this.lightCv, 0, 0, this.fw, this.fh);
    const ba = this.bloomA.getContext('2d'), bb = this.bloomB.getContext('2d');
    ba.imageSmoothingEnabled = bb.imageSmoothingEnabled = true;
    ba.globalCompositeOperation = 'copy';
    ba.drawImage(this.lightCv, 0, 0, this.bloomA.width, this.bloomA.height);
    bb.globalCompositeOperation = 'copy';
    bb.drawImage(this.bloomA, 0, 0, this.bloomB.width, this.bloomB.height);
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.24;
    g.drawImage(this.bloomA, 0, 0, this.bloomA.width, this.bloomA.height, 0, 0, this.fw, this.fh);
    g.globalAlpha = 0.22;
    g.drawImage(this.bloomB, 0, 0, this.bloomB.width, this.bloomB.height, 0, 0, this.fw, this.fh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    P && P('bloom');
    // vignette
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = G.vigGrad;
    g.fillRect(0, 0, vw, vh);
    // pressure grade (4-5 stars): a hot amber rim by day; after dusk, slow red / blue washes down the edges
    if (S.stars >= 4 && !S.busted) {
      if (!this.rimGrad || this.rimGrad.vh !== vh) {
        const r = this.rimGrad = g.createRadialGradient(vw / 2, vh / 2, vh * 0.36, vw / 2, vh / 2, vh * 0.66);
        r.addColorStop(0, 'rgba(135,34,24,0)'); r.addColorStop(1, 'rgba(135,34,24,1)'); r.vh = vh;
        const l = this.edgeL = g.createLinearGradient(0, 0, vw * 0.45, 0); l.addColorStop(0, 'rgba(255,42,74,1)'); l.addColorStop(1, 'rgba(255,42,74,0)');
        const e = this.edgeR = g.createLinearGradient(vw, 0, vw * 0.55, 0); e.addColorStop(0, 'rgba(42,142,255,1)'); e.addColorStop(1, 'rgba(42,142,255,0)');
      }
      const dark = clamp01((t - 0.45) / 0.3), k = S.stars >= 5 ? 1 : 0.7;
      g.globalAlpha = 0.34 * (1 - dark) * k; g.fillStyle = this.rimGrad; g.fillRect(0, 0, vw, vh);
      if (dark > 0) {
        const ph = Math.sin(time * 2.6);
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = 0.22 * dark * k * Math.max(0, ph); g.fillStyle = this.edgeL; g.fillRect(0, 0, vw * 0.45, vh);
        g.globalAlpha = 0.24 * dark * k * Math.max(0, -ph); g.fillStyle = this.edgeR; g.fillRect(vw * 0.55, 0, vw * 0.45, vh);
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = 1;
    }
    P && P('end');
  }

  // Scuffs and first dents below stage 1, painted over the baked cell in the car's own frame (the
  // stage sprites take over from 0.25). Positions come from the car id, so each car's marks stay put.
  drawCarDamage(g, c) {
    const L = c.len / 2, Wd = c.wid / 2;
    g.save(); g.translate(c.x, c.y); g.rotate(c.h);
    let seed = c.dentSeed;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let p = 0; p < 4; p++) {
      const k = c.dent[p];
      if (k < 0.03) { rnd(); rnd(); continue; }
      const n = 1 + Math.floor(k * 4);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 2 - 1, b = rnd();
        const x = p === 0 ? L - b * 5 * k : p === 1 ? -L + b * 5 * k : a * L * 0.8;
        const y = p === 2 ? -Wd + b * 3 * k : p === 3 ? Wd - b * 3 * k : a * Wd * 0.8;
        const r = 1.6 + k * 4;
        g.globalAlpha = 0.3 + k * 0.4; g.fillStyle = '#210f2e';
        g.beginPath(); g.ellipse(x, y, r * (p < 2 ? 0.6 : 1.3), r * (p < 2 ? 1.3 : 0.6), 0, 0, 7); g.fill();
        g.globalAlpha = 0.55; g.strokeStyle = '#d7d0cc'; g.lineWidth = 0.7;   // primer scrape
        g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.2); g.lineTo(x + r * 0.6, y + r * 0.3); g.stroke();
      }
    }
    for (let w = 0; w < 2; w++) {                       // a hairline crack in the glass
      const k = c.glass[w];
      if (k < 0.05) continue;
      const gx = w === 0 ? L * 0.28 : -L * 0.42;
      g.globalAlpha = 0.78; g.strokeStyle = 'rgb(235,244,255)'; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(gx - 1, -Wd * 0.5); g.lineTo(gx + 1.5, 0); g.lineTo(gx, Wd * 0.45); g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // Debris on the ground: shards, planks, fronds, wheels (pooled sprites), petals and leaves. They
  // slide, settle and stay.
  drawDebris(g, S, vx0, vy0, vx1, vy1) {
    const D = S.debris;
    if (!D) return;
    for (let i = 0; i < DEBRIS_CAP; i++) {
      const d = D[i];
      if (!d.on || d.x < vx0 - 12 || d.x > vx1 + 12 || d.y < vy0 - 12 || d.y > vy1 + 12) continue;
      const set = this.debrisSprites[d.kind];
      if (set && set.length) {
        let e = set[d.v % set.length];
        if (d.kind === 1 && d.c === -1 && this.policeShard) e = this.policeShard;   // a lightbar lens
        const k = 0.45 * d.s;
        g.save(); g.translate(d.x, d.y); g.rotate(d.rot);
        g.drawImage(e.img, e.ox * k, e.oy * k, e.w * k, e.h * k); g.restore();
        continue;
      }
      g.fillStyle = d.kind === 10 ? PETALS[d.v % 3] : DEBRIS_COL[d.kind];
      g.beginPath();
      if (d.kind === 4 || d.kind === 10) g.ellipse(d.x, d.y, (d.kind === 4 ? 4 : 2.4) * d.s, (d.kind === 4 ? 1.8 : 1.7) * d.s, d.rot, 0, 7);
      else g.ellipse(d.x, d.y, 2 * d.s, 1.5 * d.s, d.rot, 0, 7);
      g.fill();
    }
  }

  // Smoke (look spec): dark puffs off a bent car's hood, pale grey wisps trailing a wreck.
  drawSmoke(g, S, vx0, vy0, vx1, vy1) {
    const P = S.smoke;
    if (!P) return;
    for (let i = 0; i < SMOKE_CAP; i++) {
      const p = P[i];
      if (!p.on || p.x < vx0 - 40 || p.x > vx1 + 40 || p.y < vy0 - 40 || p.y > vy1 + 40) continue;
      const u = p.t / p.life, r = (4 + u * 15) * p.s;
      g.globalAlpha = (1 - u) * (p.dark ? 0.42 : 0.3);
      g.fillStyle = p.dark ? '#2c2430' : 'rgb(192,188,200)';
      g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
      g.globalAlpha *= 0.7; g.fillStyle = p.dark ? '#4a3e48' : 'rgb(222,218,228)';
      g.beginPath(); g.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.55, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
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

  // ---- Jobs (jobs.js). Ground layer: the pulsing halo at the job's target, the waiting fare / riders / crew.
  // The motel door reads ENTERABLE from the street: a warm painted glow spilling out of the doorway
  // and chevrons walking toward it on the pavement.
  drawMotelDoor(g, S, time) {
    if (S.player.mode === 'siege') return;
    const d = this.L.motelDoor, pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    const rg = g.createRadialGradient(d[0], d[1], 2, d[0], d[1], 46);
    rg.addColorStop(0, `rgba(255,214,150,${0.55 + pulse * 0.2})`); rg.addColorStop(0.5, 'rgba(255,120,130,0.28)'); rg.addColorStop(1, 'rgba(255,120,130,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(d[0] + 10, d[1], 46, 30, 0, 0, 7); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {                       // chevrons marching west, into the door
      const ph = (time * 0.9 + i / 3) % 1, x = d[0] + 44 - ph * 34;
      g.globalAlpha = Math.sin(ph * Math.PI) * 0.85; g.strokeStyle = '#fff1cf';
      g.beginPath(); g.moveTo(x + 5, d[1] - 6); g.lineTo(x, d[1]); g.lineTo(x + 5, d[1] + 6); g.stroke();
    }
    g.globalAlpha = 1;
  }

  // One marker language for every activity: a cream painted plaque with the plum ink line, a
  // colour band for its kind, a stem down to the spot, a gentle bob. World-anchored (no HUD
  // furniture); sized to read at phone size while driving past.
  drawActivityMarkers(g, S, time, vx0, vy0, vx1, vy1) {
    const list = markers(S, this.mk || (this.mk = []));
    for (let i = 0; i < list.length; i++) {
      const m = list[i], a = m.a;
      if (m.x < vx0 - 80 || m.x > vx1 + 80 || m.y < vy0 - 40 || m.y > vy1 + 110) continue;
      const bob = Math.sin(time * 2.2 + i * 1.3) * 2.5, big = a.big ? 1.25 : 1;
      const fs = 13 * big, lift = (a.group === 'hub' ? 6 : a.group === 'job' ? 38 : 46);
      g.font = `900 ${fs}px "Avenir Next", "Futura", "Trebuchet MS", system-ui, sans-serif`;
      const tw = a.tw || (a.tw = g.measureText(a.tag).width), w = tw + 18 * big, h = 20 * big;
      const cx = m.x, cy = m.y - lift + bob, x = cx - w / 2, y = cy - h / 2;
      if (a.group !== 'hub') {                           // stem + ground dot: this marker belongs to THAT thing
        g.strokeStyle = 'rgba(33,15,46,0.85)'; g.lineWidth = 2.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, y + h); g.lineTo(m.x, m.y - (a.group === 'job' ? 14 : 8)); g.stroke();
      }
      g.fillStyle = 'rgba(33,15,46,0.35)'; g.beginPath(); g.roundRect(x + 2, y + 3, w, h, 6); g.fill();      // painted drop shadow
      g.fillStyle = '#fff1d8'; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
      g.fillStyle = a.color; g.beginPath(); g.roundRect(x, y + h - 5 * big, w, 5 * big, [0, 0, 6, 6]); g.fill();
      g.lineWidth = 2; g.strokeStyle = '#210f2e'; g.beginPath(); g.roundRect(x, y, w, h, 6); g.stroke();
      g.fillStyle = '#210f2e'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(a.tag, cx, cy - 2 * big);
    }
    g.textBaseline = 'alphabetic';
  }

  drawJobsGround(g, S, time) {
    const j = S.job;
    if (!j || !j.spot) return;
    const [x, y] = j.spot, pulse = 0.5 + 0.5 * Math.sin(time * 4);
    g.save();
    g.lineWidth = 3; g.strokeStyle = `rgba(110,226,255,${0.55 + 0.35 * pulse})`;
    g.beginPath(); g.ellipse(x, y, 30 + pulse * 5, 30 + pulse * 5, 0, 0, 7); g.stroke();
    g.fillStyle = `rgba(110,226,255,${0.10 + 0.08 * pulse})`; g.fill();
    g.restore();
    const who = (outfit, ox, oy, h, walk) => {
      const m = this.M.peds[outfit] || this.M.peds.ped_sun;
      let a = Math.round(h / (Math.PI * 2) * m.angles) % m.angles; if (a < 0) a += m.angles;
      const rows = Math.ceil(m.angles * m.poses / m.cols);
      this.drawCell(g, m.color, a * m.poses + (walk ? [0, 1, 2, 1][Math.floor(time * 7) % 4] : 1), m.cols, rows, x + ox, y + oy);
    };
    if (j.kind === 'taxi' && j.phase === 'pickup') who(['fare_tourist', 'fare_vip', 'fare_chaos'][j.n % 3], 0, -14, Math.PI / 2 + Math.sin(time * 2) * 0.3, false);
    if (j.kind === 'bus' && !(j.dwell >= 1.8)) {
      const u = Math.min(1, j.dwell / 1.8), c = j.car;
      for (let i = 0; i < 4; i++) { const sx = (i - 1.5) * 13, sy = -26 - (i % 2) * 8; who(['fare_tourist', 'ped_rose', 'fare_vip', 'ped_blue'][i], sx + (c.x - x - sx) * u, sy + (c.y - y - sy) * u, Math.atan2(c.y - y - sy, c.x - x - sx), u > 0); }
    }
    if (j.kind === 'getaway' && j.phase === 'goto') { who('fare_chaos', -8, -16, 1.2, j.wait > 0); who('ped_blue', 9, -20, 1.9, j.wait > 0); }
  }

  // Top layer: the tow cable and hook, the taxi's roof sign, the crewmate riding tandem on the board.
  drawJobsTop(g, S, time) {
    const J = this.M.jobs;
    if (!J) return;
    for (const c of S.cars) {                               // every cab wears its sign; the job cab's shows the fare's mood
      if (c.model !== 'taxi' || c.wreck) continue;
      const j = S.job && S.job.car === c ? S.job : null, f = j && j.fare;
      const e = !f ? J.sign.free : f.fed && f.revealed ? J.sign.fed : f.mood < 25 ? J.sign.low : J.sign.fare;
      if ((e === J.sign.low || e === J.sign.fed) && Math.floor(time * 6) % 2) continue;
      g.save(); g.translate(c.x, c.y); g.rotate(c.h + Math.PI / 2); g.drawImage(e.img, e.ox, e.oy, e.w, e.h); g.restore();
    }
    const j = S.job;
    if (!j) return;
    if (j.kind === 'tow' && j.hooked && j.target) {
      const c = j.car, t = j.target, hx = c.x - Math.cos(c.h) * c.len / 2, hy = c.y - Math.sin(c.h) * c.len / 2;
      const a = Math.atan2(t.y - hy, t.x - hx), d = Math.hypot(t.x - hx, t.y - hy), e = J.cable;
      g.save(); g.translate(hx, hy); g.rotate(a);
      for (let x = 0; x < d; x += e.w) { const w = Math.min(e.w, d - x); g.drawImage(e.img, 0, 0, e.img.width * w / e.w, e.img.height, x, e.oy, w, e.h); }
      if (j.tension > 0.8) { g.globalCompositeOperation = 'source-atop'; g.strokeStyle = 'rgba(255,74,56,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(d, 0); g.stroke(); g.globalCompositeOperation = 'source-over'; }
      g.translate(d, 0); g.drawImage(J.hook.img, J.hook.ox, J.hook.oy, J.hook.w, J.hook.h);
      g.restore();
    }
    if (j.kind === 'getaway' && j.tandem && S.board.ridden) {  // the crewmate crouched behind you on the deck
      const b = S.board, m = this.M.peds.fare_chaos || this.M.peds.ped_blue;
      let a = Math.round(b.h / (Math.PI * 2) * m.angles) % m.angles; if (a < 0) a += m.angles;
      this.drawCell(g, m.color, a * m.poses + 1, m.cols, Math.ceil(m.angles * m.poses / m.cols), b.x - Math.cos(b.h) * 9, b.y - Math.sin(b.h) * 9);
    }
    void JOBS;
  }

  // ---- Street pressure (pressure.js): spike strips and sawhorses, on the road under the cars
  drawStreetPressure(g, S, t, time, vx0, vy0, vx1, vy1) {
    const P = this.M.pressure, dusk = t >= 0.55;
    for (const k of S.spikes) {
      if (k.x < vx0 - 40 || k.x > vx1 + 40 || k.y < vy0 - 40 || k.y > vy1 + 40) continue;
      const e = dusk ? P.spikes.dusk : P.spikes.color;
      g.save(); g.translate(k.x, k.y); g.rotate(k.a); g.drawImage(e.img, e.ox, e.oy, e.w, e.h);
      // stud glints, so it reads at speed
      g.fillStyle = '#fff'; g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6 + k.x);
      for (let i = -2; i <= 2; i++) g.fillRect(i * 8 - 0.8, -0.8, 1.6, 1.6);
      g.restore();
    }
    g.globalAlpha = 1;
    for (const h of S.sawhorses) {
      if (h.x < vx0 - 40 || h.x > vx1 + 40 || h.y < vy0 - 40 || h.y > vy1 + 40) continue;
      const e = dusk ? P.sawhorse.dusk : P.sawhorse.color;
      g.save(); g.translate(h.x, h.y); g.rotate(h.a);
      if (h.broken) {                                   // knocked flat and split: two halves thrown apart
        const u = Math.min(1, h.t / 0.25), d = 5 + 9 * u;
        g.globalAlpha = 0.9;
        g.save(); g.translate(-d, 2 * u); g.rotate(-0.5 * u); g.drawImage(e.img, 0, 0, e.img.width / 2, e.img.height, e.ox, e.oy, e.w / 2, e.h); g.restore();
        g.save(); g.translate(d, -2 * u); g.rotate(0.7 * u); g.drawImage(e.img, e.img.width / 2, 0, e.img.width / 2, e.img.height, 0, e.oy, e.w / 2, e.h); g.restore();
      } else g.drawImage(e.img, e.ox, e.oy, e.w, e.h);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  // ---- Sky pressure (pressure.js): the police chopper and its searchlight
  drawChopper(g, c, t, time) {
    const P = this.M.pressure.chopper, dusk = t >= 0.55;
    const e = dusk ? P.bodyDusk : P.body, n = e.angles;
    let k = Math.round(c.h / (Math.PI * 2) * n) % n; if (k < 0) k += n;
    const cw = e.img.width / e.cols, ch = e.img.height / Math.ceil(n / e.cols);
    const bob = Math.sin(time * 2.1) * 1.5;
    const Z = 1.7;                                    // it flies well above the roofs: drawn larger than ground scale
    g.drawImage(e.img, (k % e.cols) * cw, ((k / e.cols) | 0) * ch, cw, ch, c.x + e.ox * Z, c.y + e.oy * Z + bob, e.w * Z, e.h * Z);
    const r = dusk ? P.rotorDusk : P.rotor;
    g.save(); g.translate(c.x + Math.cos(c.h) * 2.5, c.y + Math.sin(c.h) * 2.5 + bob); g.rotate(time * 18); g.scale(Z, Z);
    g.drawImage(r.img, r.ox, r.oy, r.w, r.h); g.restore();
  }

  // The beam: a feathered cone from the nose turret to a soft pool on the ground, champagne by day,
  // xenon ice-cyan after dusk, with dust motes drifting inside it (procedural, no allocation per mote).
  // Drawn into the additive light layer, so it blooms; brighter as it gets dark.
  drawSearchlight(lg, c, t, time, stars) {
    const dusk = t >= 0.55, dark = clamp01((t - 0.3) / 0.6);
    const a0 = (0.62 + 0.24 * dark) * (c.leaving ? 0.4 : 1);   // additive light shows less on a sunlit street: day beam runs hot
    const nx = c.x + Math.cos(c.h) * 34, ny = c.y + Math.sin(c.h) * 34;
    const dx = c.bx - nx, dy = c.by - ny, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const R = CHOPPER.POOL_R;
    const col = dusk ? '200,236,255' : '255,234,180';
    // cone body
    const gr = lg.createLinearGradient(nx, ny, c.bx, c.by);
    gr.addColorStop(0, `rgba(${col},${0.55 * a0})`); gr.addColorStop(1, `rgba(${col},${0.14 * a0})`);
    lg.fillStyle = gr;
    for (let i = 0; i < 4; i++) {                       // nested cones: a feathered edge, no hard outline
      const w = R * (0.95 - i * 0.2);
      lg.globalAlpha = 0.3;
      lg.beginPath(); lg.moveTo(nx + px * 4, ny + py * 4); lg.lineTo(c.bx + px * w, c.by + py * w);
      lg.lineTo(c.bx - px * w, c.by - py * w); lg.lineTo(nx - px * 4, ny - py * 4); lg.closePath(); lg.fill();
    }
    lg.globalAlpha = 1;
    // the lagging ghost of the beam when it swings fast (4-5 stars)
    if (stars >= 4) {
      const ga = c.ghostA - 0.17, gx = nx + Math.cos(ga) * L, gy = ny + Math.sin(ga) * L;
      lg.globalAlpha = 0.35; lg.beginPath(); lg.moveTo(nx, ny); lg.lineTo(gx + px * R * 0.6, gy + py * R * 0.6); lg.lineTo(gx - px * R * 0.6, gy - py * R * 0.6); lg.closePath(); lg.fill();
      lg.globalAlpha = 1;
    }
    // the pool
    const pool = lg.createRadialGradient(c.bx, c.by, 0, c.bx, c.by, R * 1.15);
    // bright, but the player stays readable in it
    pool.addColorStop(0, `rgba(${col},${0.42 * a0})`); pool.addColorStop(0.6, `rgba(${col},${0.3 * a0})`); pool.addColorStop(1, `rgba(${col},0)`);
    lg.fillStyle = pool;
    lg.save(); lg.translate(c.bx, c.by); lg.scale(1, 0.78); lg.translate(-c.bx, -c.by);
    lg.fillRect(c.bx - R * 1.2, c.by - R * 1.2, R * 2.4, R * 2.4); lg.restore();
    // motes: hashed positions along the cone, drifting toward the ground
    lg.fillStyle = `rgba(${col},1)`;
    for (let i = 0; i < 170; i++) {
      const h1 = Math.sin(i * 12.9898) * 43758.5453, h2 = Math.sin(i * 78.233) * 12345.678;
      const f1 = h1 - Math.floor(h1), f2 = h2 - Math.floor(h2);
      const u = (f1 + time * (0.05 + 0.08 * f2)) % 1, w = (f2 * 2 - 1) * (4 + R * 0.85 * u);
      const x = nx + dx * u + px * w, y = ny + dy * u + py * w;
      lg.globalAlpha = a0 * (0.35 + 0.65 * f1) * Math.sin(Math.PI * u);
      lg.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
    lg.globalAlpha = 1;
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
    // MOTH-SLICE: the drifting stroke sheets fade toward the shoreline, so the
    // animated surface is calm in the shallows and only gathers energy offshore
    // (matching the ground painter's shoreCalm falloff). Bands are anchored to
    // the shore x at mid-view; shoreX wobbles ~±25 units, far less than a band.
    const sxB = W.shoreX((vy0 + vy1) / 2);
    const BANDS = [[-40, 0.30], [45, 0.38], [105, 0.62], [190, 0.85], [320, 1.0], [1e6, 1.0]];
    const slideBanded = (pat, ox, oy, sc, alpha) => {
      let prev = -1e6;
      for (const [edge, f] of BANDS) {
        const bx0 = Math.max(wx0, sxB + prev), bx1 = Math.min(vx1, sxB + edge);
        if (bx1 > bx0) {
          g.save();
          g.translate(ox, oy); g.scale(sc, sc);
          g.globalAlpha = alpha * f; g.fillStyle = pat;
          g.fillRect((bx0 - ox) / sc, (vy0 - oy) / sc, (bx1 - bx0) / sc, (vy1 - vy0) / sc);
          g.restore();
        }
        prev = edge;
      }
    };
    slideBanded(this.waterStrokes.deep, -time * 5.5, time * 3.2 + Math.sin(time * 0.31) * 6, 1.25, 0.36 + Math.sin(time * 0.4) * 0.05);
    slideBanded(this.waterStrokes.light, -time * 10, -time * 2.6 + Math.sin(time * 0.47 + 1) * 5, 1, 0.42 + Math.sin(time * 0.53 + 2) * 0.08);
    // sky reflection: a gradient across the water that drifts gold -> rose -> violet as the sun goes;
    // brighter offshore (open sky), deeper near the shore (land shadow)
    const sx = W.shoreX((vy0 + vy1) / 2);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = G.skyGrad;                          // built in gradeFor at x 0..380; slide it to the shore
    g.translate(sx, 0);
    g.fillRect(wx0 - sx, vy0, vx1 - wx0, vy1 - vy0);
    g.translate(-sx, 0);
    g.globalCompositeOperation = 'source-over';
    // swell: crest lines parallel to the shore, rolling in and sharpening as they near the sand
    g.lineCap = 'round';
    const SPAN = 440, GAP = 88;
    for (let k = 0; k < SPAN / GAP; k++) {
      const d = ((k * GAP - time * 11) % SPAN + SPAN) % SPAN;
      const a = Math.pow(Math.sin(Math.PI * Math.min(1, (d + 30) / (SPAN + 30))), 0.8) * 0.42;
      g.strokeStyle = '#d6f4fa'; g.globalAlpha = a;
      g.lineWidth = d < 70 ? 4.2 - d * 0.02 : 2.6;
      DASH[0] = 36 + k * 7; DASH[1] = 14 + k * 5; g.setLineDash(DASH); g.lineDashOffset = k * 31 + time * 3;
      g.beginPath();
      for (let y = vy0 - 30; y <= vy1 + 30; y += 22) {
        const x = W.shoreX(y) + d + Math.sin(y * 0.021 + k * 1.7) * 10 + Math.sin(y * 0.05 + time * 0.5 + k) * 4;
        if (y === vy0 - 30) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.setLineDash(NO_DASH); g.globalAlpha = 1;
    // glints
    g.fillStyle = G.glintStyle;
    for (const p of this.glints) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const s = Math.sin(time * p.f + p.ph);
      if (s < 0.4) continue;
      // MOTH-SLICE: sparkle glints also quieten in the shallows.
      const gd = p.x - W.shoreX(p.y);
      const gf = 0.25 + 0.75 * Math.min(1, Math.max(0, gd / 150));
      const a = Math.pow((s - 0.4) / 0.6, 2) * 0.85 * gf;
      g.globalAlpha = a;
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
          g.fillStyle = '#5c3228'; g.globalAlpha = dry;
          g.fillRect(sx + 3 - reach, y, reach + 2, STEP);
          if (u < UP) { g.globalAlpha = 0.72 - 0.3 * (1 - u / UP); g.fillRect(front - 2, y, sx + 5 - front, STEP); }
          else if (u < UP + 0.3) {                                   // glassy sheen while the water drains off
            g.fillStyle = '#ffe8c4'; g.globalAlpha = 0.22 * (1 - (u - UP) / 0.3);
            g.fillRect(sx + 3 - reach, y, front - (sx + 3 - reach), STEP);
          }
        } else if (pass === 1) {
          // the sheet of water itself, paler toward its leading edge
          g.globalAlpha = 1;
          g.fillStyle = 'rgba(52,140,188,0.8)'; g.fillRect(front + 6, y, sx + 6 - (front + 6), STEP);
          g.fillStyle = 'rgba(150,218,230,0.72)'; g.fillRect(front, y, Math.min(8, sx + 6 - front), STEP);
        } else {
          // foam: a scalloped lip on the leading edge, bright running in, thinning as it drains;
          // plus the lace it leaves at the high-water mark
          const fa = u < UP ? 0.92 : 0.75 * (1 - smooth(0, 0.8, (u - UP) / (1 - UP))) + 0.12;
          g.fillStyle = '#fcf6e8'; g.globalAlpha = fa;
          g.beginPath(); g.ellipse(front + Math.sin(k * 1.9) * 1.6, y + STEP / 2, 3.2 + n1 * 2.2, STEP * 0.72, 0, 0, 7); g.fill();
          if (u < UP) { g.globalAlpha = 0.4; g.beginPath(); g.ellipse(front + 7 + Math.sin(k * 2.7) * 2, y + STEP / 2, 2.2, STEP * 0.5, 0, 0, 7); g.fill(); }
          else if (u < UP + 0.42 && (Math.floor(k) % 2 === 0)) {
            g.globalAlpha = 0.5 * (1 - (u - UP) / 0.42);
            g.beginPath(); g.ellipse(sx + 3 - reach + Math.sin(k * 3.1) * 1.5, y + STEP / 2, 1.6, 2.4, 0, 0, 7); g.fill();
          }
        }
      }
    }
    g.globalAlpha = 1;
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
    L.lamps.forEach(([x, y], i) => out.push({ x: x + 13, y: y + 6, col: [255, 178, 86], len: 120, lamp: true, li: i, w0: 3.4 }));
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

  drawWetReflections(lg, G, time, vx0, vy0, vx1, vy1, S) {
    if (!this.reflectors) this.reflectors = this.buildReflectors();
    const W = this.world, half = W.halfRoad - 2;
    lg.lineCap = 'round';
    for (const r of this.reflectors) {
      const peak = r.lamp ? G.lamps * 0.44 * this.lampLight(S, r.li, time) : G.neon * 0.50;
      if (peak < 0.02 || r.x < vx0 - 40 || r.x > vx1 + 40 || r.y < vy0 - 150 || r.y > vy1 + 20) continue;
      const phase = r.x * 0.13 + r.y * 0.07;
      if (!r.grad) {                                   // the ribbon's colour ramp at peak 1; peak goes on globalAlpha
        const gr = r.grad = lg.createLinearGradient(0, r.y, 0, r.y + r.len);
        gr.addColorStop(0, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0.85)`);
        gr.addColorStop(0.35, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0.52)`);
        gr.addColorStop(1, `rgba(${r.col[0]},${r.col[1]},${r.col[2]},0)`);
        r.onRoad = [];
        for (let dy = 2; dy < r.len; dy += 2.2) r.onRoad.push(W.roadInfo(r.x, r.y + dy).d <= half);
      }
      lg.fillStyle = r.grad;
      for (let dy = 2, n = 0; dy < r.len; dy += 2.2, n++) {
        const wy = r.y + dy;
        if (!r.onRoad[n]) continue;
        const u = dy / r.len;
        const amp = (r.lamp ? 2.4 : 3.8) * (0.3 + 0.7 * u);
        const dx = amp * Math.sin(dy * 0.24 + phase + time * 2.2) + 0.45 * amp * Math.sin(dy * 0.55 - time * 1.5);
        const mod = 0.52 + 0.48 * Math.pow(Math.sin(dy * 0.21 + phase), 2);
        const rx = Math.max(1.0, r.w0 * mod * (1 - 0.48 * u));
        lg.globalAlpha = 0.36 * peak;
        lg.beginPath(); lg.ellipse(r.x + dx, wy, rx * 1.8, 2.6, 0, 0, 7); lg.fill();
        lg.globalAlpha = 0.62 * peak;
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
    const XR = this.M.destruct;
    for (const r of S.rails) {
      // intact runs as painted lines; damaged sections (destruct.js) as Gemini's bent/snapped/scrap sprites
      const ux = (r.x1 - r.x0) / r.len, uy = (r.y1 - r.y0) / r.len;
      const run = (s0, s1) => {
        const ax = r.x0 + ux * s0, ay = r.y0 + uy * s0, bx = r.x0 + ux * s1, by = r.y0 + uy * s1;
        g.strokeStyle = 'rgba(40,24,60,0.35)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(ax + 4, ay - 1.5); g.lineTo(bx + 4, by - 1.5); g.stroke();
        g.strokeStyle = '#d9d4e6'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.strokeStyle = '#fff4dc'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(ax - 0.6, ay - 0.6); g.lineTo(bx - 0.6, by - 0.6); g.stroke();
      };
      if (!r.segs || !XR) { run(0, r.len); continue; }
      let from = 0;
      for (const sg of r.segs) {
        if (!sg.stage) continue;
        if (sg.s0 > from) run(from, sg.s0);
        from = sg.s1;
        const e = XR['rail_s' + sg.stage], k = (sg.s1 - sg.s0) / 64;
        g.save(); g.translate(sg.x, sg.y); g.rotate(Math.atan2(uy, ux)); g.scale(k, 1);
        g.drawImage(e.img, e.ox, e.oy, e.w, e.h); g.restore();
      }
      if (from < r.len) run(from, r.len);
    }
    const X = this.M.destruct;
    for (const b of S.benches) {
      if (b.stage && X) {                               // cracked / snapped in half / plank pile (stage sprites)
        const e = X['bench_s' + b.stage];
        g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.scale(0.8, 0.8);
        g.drawImage(e.img, e.ox, e.oy, e.w, e.h); g.restore();
        continue;
      }
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

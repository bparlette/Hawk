// lf_render.js — draws the Laurel/Fulton sample: painted ground chunks (lf_ground.js), bridge decks above
// with their cast shadow, the crew's cars (assets/fleet.json sprites: shadow pass, then colour, 32 angles),
// the day-to-night grade, and the real street name you are on.
// DAY/NIGHT PARITY (owner, Nov 18): the grade keyframes + grade() below are Palm City's own
// (games/palm-city/src/render.js), copied verbatim — same day-to-night cycle, same lighting
// transitions: golden hour -> warm sunset -> violet -> deep ultramarine dusk, with the same
// windows/lamps/neon/headlight ramps. main.js drives it with Palm City's timeOfDay() curve.
import { CHUNK } from './lf_ground.js';
import { drawLightBar, drawSirenGlow } from './lf_cops.js';   // L15: cop light bar + siren glow
import { poly } from './lf_areas.js';
import { HeroArt } from './lf_heroes.js';
import { bushesNear } from './lf_veg.js';
import * as FX from './lf_fx.js';

const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Grade keyframes over time of day t (0 = golden hour, 1 = blue dusk) — Palm City's KEYS, verbatim.
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
    mul: mix3(a.mul, b.mul), roofMul: mix3(a.roofMul, b.roofMul),
    shadowCol: mix3(a.shadowCol, b.shadowCol), vigCol: mix3(a.vigCol, b.vigCol), eastGlow: mix3(a.eastGlow, b.eastGlow),
    vigAlpha: lerp(a.vigAlpha, b.vigAlpha, u), glow: lerp(a.glow, b.glow, u), warm: lerp(a.warm, b.warm, u), shadow: lerp(a.shadow, b.shadow, u),
    windows: smooth(0.26, 0.82, t),  // windows warm up first
    lamps: smooth(0.48, 0.92, t),    // street lamps after
    neon: 0.02 + 0.98 * smooth(0.32, 0.85, t),
    heads: smooth(0.45, 0.85, t),
  };
}

const SUN = { x: 0.8, y: -0.3 }, FAR_CHUNKS = 90;                       // the bake's sun: shadows fall east-north-east
export class Renderer {
  constructor(ctx, W, ground, fleet, imgs, areas = null) { this.areas = areas; this.ctx = ctx; this.W = W; this.ground = ground; this.fleet = fleet; this.imgs = imgs; }
  resize(vw, vh, dpr) { this.vw = vw; this.vh = vh; this.dpr = dpr; }
  cell(m, k, which) {                                   // a car sheet frame -> [img, sx, sy, sw, sh, ox, oy, w, h]
    const e = m[which], img = this.imgs[e.file], cols = m.cols, rows = Math.ceil(m.angles / cols);
    const fw = img.width / cols, fh = img.height / rows, r = Math.floor(k / cols), c = k % cols;
    return [img, c * fw, r * fh, fw, fh, e.ox, e.oy, e.w, e.h];
  }
  drawCar(g, c, which) {
    if (c.van) { c.van.draw(g, c, which, this.time || 0); return; }   // L7: David Klink's Scooby-Doo van is a painted prop car (lf_van.js)
    const m = this.fleet[c.model], k = ((Math.round(c.h / (Math.PI * 2) * m.angles) % m.angles) + m.angles) % m.angles;
    const [img, sx, sy, sw, sh, ox, oy, w, h] = this.cell(m, k, which);
    let [jx, jy] = this.time != null ? FX.shake(this.S, c, this.time) : [0, 0];   // bass cars vibrate
    if (c.jolt > 0) { jx += Math.sin(this.time * 90) * 2.2 * c.jolt / 0.22; jy += Math.cos(this.time * 77) * 2.2 * c.jolt / 0.22; }   // the bump's jolt
    if (which === 'color' && c.z > 0) {                   // L3 airborne: the body rises toward you and grows; the shadow stays down
      const k = 1 + c.z * 0.012; g.save(); g.translate(c.x + jx - c.z * 0.25, c.y + jy - c.z * 1.5); g.scale(k, k);   // presentation only: lift + loom so a 3 m arc reads at phone zoom
      g.drawImage(img, sx, sy, sw, sh, ox, oy, w, h); g.restore(); return;
    }
    if (which === 'shadow' && c.z > 0) { g.save(); g.globalAlpha *= Math.max(0.3, 1 - c.z / 50); g.drawImage(img, sx, sy, sw, sh, c.x + ox + c.z * 0.8, c.y + oy + c.z * 0.25, w, h); g.restore(); return; }   // the shadow stays on the road, sliding down-sun
    g.drawImage(img, sx, sy, sw, sh, c.x + ox + jx, c.y + oy + jy, w, h);
  }
  drawGlow(g, c) {   // headlight beams + underglow (owner, Nov 18): Rigg's beam is BLUE, Brad's is YELLOW, Jimmy's Astro has BLUE NEON under the car. The authored 'light' sheets are near-empty streaks, so the beams are drawn as gradient cones — the colours are the point, and they must be OBVIOUS.
    if (c.z > 1) return;
    if (c.siren) drawSirenGlow(g, c, this.time || 0);   // L15: Palm City's red/blue siren pools
    const m = this.fleet[c.model]; if (!m) return;
    const fx = Math.cos(c.h), fy = Math.sin(c.h), px = -fy, py = fx;
    const L = m.length || 46, Wd = m.width || 20;
    g.save(); g.globalCompositeOperation = 'lighter';
    if (c.model === 'astro_jimmy') {   // blue neon underglow
      const r = L * 0.72, gr = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, r);
      gr.addColorStop(0, `rgba(45,95,255,${(0.55 * (0.7 + 0.3 * (this.gr ? this.gr.heads : 0))).toFixed(3)})`); gr.addColorStop(1, 'rgba(45,95,255,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y, r, Wd * 1.35, c.h, 0, Math.PI * 2); g.fill();
    }
    if (c.model === 'cavalier_kosack') {   // G17 / M-B: Kosack's always-on 6.4 Hz alternating red/blue fake-cop dash strobes + cones
      const t = this.time || 0, tick = Math.floor(t * 6.4), redOn = (tick % 2) === 0, strobe = (tick % 8) < 2;
      const rCol = 'rgba(255,46,56,', bCol = 'rgba(56,130,255,', aVis = (0.72 + (strobe ? 0.25 : 0)) * (0.65 + 0.35 * (this.gr ? this.gr.heads : 0));
      for (const side of [-1, 1]) {
        const isRed = side < 0 ? redOn : !redOn, col = isRed ? rCol : bCol;
        const wx = c.x + fx * (L * 0.16) + px * side * (Wd * 0.22), wy = c.y + fy * (L * 0.16) + py * side * (Wd * 0.22);
        const rg = g.createRadialGradient(wx, wy, 1, wx, wy, 22);
        rg.addColorStop(0, col + Math.min(1, aVis).toFixed(3) + ')'); rg.addColorStop(1, col + '0)');
        g.fillStyle = rg; g.beginPath(); g.arc(wx, wy, 22, 0, Math.PI * 2); g.fill();
        g.fillStyle = isRed ? '#ff2e38' : '#3882ff';
        g.save(); g.translate(wx, wy); g.rotate(c.h); g.fillRect(-2, -3.5, 4, 7); g.restore();
      }
      const ax = c.x + fx * (L * 0.65), ay = c.y + fy * (L * 0.65), hCol = redOn ? rCol : bCol;
      const ag = g.createRadialGradient(ax, ay, 2, ax, ay, L * 0.85);
      ag.addColorStop(0, hCol + (0.28 + 0.22 * (this.gr ? this.gr.heads : 0)).toFixed(3) + ')'); ag.addColorStop(1, hCol + '0)');
      g.fillStyle = ag; g.beginPath(); g.arc(ax, ay, L * 0.85, 0, Math.PI * 2); g.fill();
    }
    const hf = 0.55 + 0.45 * (this.gr ? this.gr.heads : 0);   // Palm City's headlight ramp: always clearly on (owner: the colours must be OBVIOUS), full strength by dusk
    const kRed = c.model === 'cavalier_kosack' && ((Math.floor((this.time || 0) * 6.4) % 2) === 0);
    const beamL = L * 2.6, beamW = Wd * 0.95;
    for (const s of [-1, 1]) {
      const col = c.model === 'celica_rigg' ? ['rgba(55,105,255,', 0.68 * hf]
        : c.model === 'camaro_brad' ? ['rgba(255,200,50,', 0.58 * hf]
        : c.model === 'cavalier_kosack' ? ((s < 0 ? kRed : !kRed) ? [s < 0 ? 'rgba(255,46,56,' : 'rgba(56,130,255,', 0.72 * hf] : ['rgba(255,240,200,', 0.36 * hf])
        : ['rgba(255,240,200,', 0.3 * hf];
      const ox = c.x + fx * (L / 2) + px * s * Wd * 0.30, oy = c.y + fy * (L / 2) + py * s * Wd * 0.30;
      const tx = ox + fx * beamL, ty = oy + fy * beamL;
      const gr = g.createLinearGradient(ox, oy, tx, ty);
      gr.addColorStop(0, col[0] + col[1] + ')'); gr.addColorStop(1, col[0] + '0)');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(ox + px * 2.5, oy + py * 2.5); g.lineTo(ox - px * 2.5, oy - py * 2.5);
      g.lineTo(tx - px * beamW / 2, ty - py * beamW / 2); g.lineTo(tx + px * beamW / 2, ty + py * beamW / 2);
      g.closePath(); g.fill();
    }
    g.restore();
  }
  farRoads(g, z, x0, y0, x1, y1) {                       // every real road in view as a line (min 2 px wide on screen), kerb pass then asphalt
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [0, 1]) {
      g.beginPath();
      for (const e of this.W.edges) {
        if (e.hw === 'service' && z < 0.05) continue; let ok = false;
        for (const p of e.pts) if (p[0] > x0 - 200 && p[0] < x1 + 200 && p[1] > y0 - 200 && p[1] < y1 + 200) { ok = true; break; }
        if (!ok) continue; e.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      }
      g.lineWidth = Math.max(pass ? 1.6 : 3.2, (pass ? 4 : 5) * 1) / z * (pass ? 1 : 1); g.strokeStyle = pass ? '#6b6770' : '#d9cbb3'; g.stroke();
    }
  }
  draw(S, cam, time, tod = 0.18) {
    this.gr = grade(tod); this.tod = tod;
    const g = this.ctx, { vw, vh, dpr } = this, z = cam.zoom, hw = vw / 2 / z, hh = vh / 2 / z;
    const vx0 = cam.x - hw, vy0 = cam.y - hh, vx1 = cam.x + hw, vy1 = cam.y + hh;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#4c7a3c'; g.fillRect(0, 0, vw, vh);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
    // LOAD FIX (Nov 18): zoomed all the way out (the opening shows the WHOLE map, the world pulse goes far) the view covers
    // ~30,000 ground chunks, and ground.get() PAINTS a missing one synchronously — the page froze for minutes and "did not
    // load". Over FAR_CHUNKS visible chunks: draw only the chunks already painted, and the real road network as lines over a
    // flat ground (cheap, and exactly what you want to see from up there). The painter fills chunks in budgeted slices.
    const cx0 = Math.floor(vx0 / CHUNK), cx1 = Math.floor(vx1 / CHUNK), cy0 = Math.floor(vy0 / CHUNK), cy1 = Math.floor(vy1 / CHUNK), far = (cx1 - cx0 + 1) * (cy1 - cy0 + 1) > FAR_CHUNKS;
    if (far) { g.fillStyle = '#6d9a4c'; g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) { if (far && !this.ground.has(cx, cy)) continue; g.drawImage(this.ground.get(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 0.6, CHUNK + 0.6); }
    if (far) this.farRoads(g, z, vx0, vy0, vx1, vy1);
    const vis = (x, y, m = 120) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
    // task L8 hero tier: the crew's homes + the POIs, BIGGER than real (x1.35 about the centroid), crisp,
    // inked, with a name plaque. (Placeholder roofs until the Street View hero art, L11/G12, lands.)
    // L11 HOOK: spec-accurate hero art (src/lf_heroes.js + data/heroes.json) replaces the placeholder below when it has the hero
    if (this.areas && (!this.heroArt || this.heroArt.areas !== this.areas)) this.heroArt = new HeroArt(this.areas, this.W, SUN);
    if (this.heroArt && !far) this.heroArt.district(g, this.gr, vis);
    const HERO_ROOF = {
      Brad: '#e8e4dc', Kosack: '#b85d48', 'The Lazaris house': '#c49a6c', Jason: '#dcd6c8',
      'The Floyds': '#7c8c74', Rigg: '#687888', Grant: '#9e4b46', 'Ledo Pizza': '#d44a3a',
      'Atholton High School': '#d8b480', 'Reservoir High School': '#d8b480',
    };
    if (this.areas) for (const h of this.areas.heroes) {
      if (!vis(h.cx, h.cy, 600)) continue;
      if (this.heroArt && this.heroArt.draw(g, h, this.gr)) continue;   // the real art; Moth's G14-tuned placeholder below is the fallback
      const S = h.kind === 'poi' ? 1.16 : 1.40, roof = HERO_ROOF[h.who] || (h.kind === 'poi' ? '#d8b480' : '#d9785a');
      g.globalAlpha = 0.44; g.fillStyle = '#1d1432'; g.save(); g.translate(SUN.x * 38, SUN.y * 38); poly(g, h.f, S, h.cx, h.cy); g.fill(); g.restore();
      g.globalAlpha = 1; g.fillStyle = roof; poly(g, h.f, S, h.cx, h.cy); g.fill();
      g.lineWidth = 3.5; g.strokeStyle = '#210f2e'; g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(33,15,46,0.55)'; poly(g, h.f, S * 0.86, h.cx, h.cy); g.stroke();
      g.globalAlpha = 0.38 * (0.25 + 0.75 * this.gr.warm); g.fillStyle = '#fff5e0'; poly(g, h.f, S * 0.58, h.cx - 7, h.cy - 5); g.fill();
      if (this.gr.windows > 0.15) {
        g.globalAlpha = 0.34 * this.gr.windows; g.fillStyle = '#ffd68a';
        poly(g, h.f, S * 0.36, h.cx, h.cy); g.fill();
      }
      g.globalAlpha = 1;
      if (h.style && this.heroStyle) this.heroStyle(g, h, this.gr, time, S);   // L12/L13 hook (lf_places_render.js): the Weis big-box / the Gringada memory build
    }
    // crashable scenery (owner, Nov 18): guardrails along the fast roads + bridges, and
    // bushes in the yards — the SAME sets the sim collides with (lf_veg.js), so what you
    // see is exactly what you can hit. Rails: a bright band on a dark shadow line.
    if (S.rails && !far) {
      const seenS = new Set(); g.lineCap = 'round';
      for (let cy = Math.floor(vy0 / 256); cy <= Math.floor(vy1 / 256); cy++) for (let cx = Math.floor(vx0 / 256); cx <= Math.floor(vx1 / 256); cx++)
        for (const s of S.rails.grid.get(cx * 100003 + cy) || []) { if (seenS.has(s)) continue; seenS.add(s);
          g.beginPath(); g.moveTo(s.x0 + SUN.x * 4, s.y0 + SUN.y * 4); g.lineTo(s.x1 + SUN.x * 4, s.y1 + SUN.y * 4); g.lineWidth = 4.6; g.strokeStyle = 'rgba(24,20,36,0.4)'; g.stroke();
          g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.lineWidth = 3.4; g.strokeStyle = '#c9d2da'; g.stroke();
          g.beginPath(); g.moveTo(s.x0, s.y0); g.lineTo(s.x1, s.y1); g.lineWidth = 1.1; g.strokeStyle = '#eef3f6'; g.stroke();
        }
    }
    if (this.areas && !far) {
      if (!this._nb) {   // the renderer's own house-box grid, for the shared bush rule
        const boxes = this.areas.A.buildings.map(f => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let k = 0; k < f.length; k += 2) { x0 = Math.min(x0, f[k]); x1 = Math.max(x1, f[k]); y0 = Math.min(y0, f[k + 1]); y1 = Math.max(y1, f[k + 1]); } return [x0, y0, x1, y1]; });
        const grid = new Map(); boxes.forEach((bb, i) => { for (let cx = Math.floor(bb[0] / 256); cx <= Math.floor(bb[2] / 256); cx++) for (let cy = Math.floor(bb[1] / 256); cy <= Math.floor(bb[3] / 256); cy++) { const key = cx * 100003 + cy; let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(i); } });
        this._nb = (x, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const hi of grid.get((Math.floor(x / 256) + i) * 100003 + Math.floor(y / 256) + j) || []) { const bb = boxes[hi]; if (x > bb[0] - 110 && x < bb[2] + 110 && y > bb[1] - 110 && y < bb[3] + 110) return true; } return false; };
      }
      const buf = this._bb || (this._bb = []);
      for (const b of bushesNear(cam.x, cam.y, Math.max(hw, hh) + 80, this.W, this._nb, this.areas.A.green, buf)) {
        if (S.squashed && S.squashed.has(b.id)) {   // driven through: flat + pale until it regrows
          g.globalAlpha = 0.75; g.fillStyle = '#7a8f4a'; g.beginPath(); g.ellipse(b.x, b.y, b.r * 1.25, b.r * 0.6, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; continue;
        }
        g.globalAlpha = 0.35; g.fillStyle = '#1e3016'; g.beginPath(); g.ellipse(b.x + SUN.x * 6, b.y + SUN.y * 6, b.r, b.r * 0.8, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.fillStyle = '#3f7031'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#55883f'; g.beginPath(); g.arc(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.68, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#6fa653'; g.beginPath(); g.arc(b.x - b.r * 0.38, b.y - b.r * 0.45, b.r * 0.36, 0, Math.PI * 2); g.fill();
      }
    }
    // shadows of ground-level cars, then those cars
    g.globalAlpha = 0.55; for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawCar(g, c, 'shadow');
    for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawGlow(g, c);
    this.S = S; this.time = time; FX.under(g, S, time, [cam.x - hw - 60, cam.y - hh - 60, cam.x + hw + 60, cam.y + hh + 60]);
    g.globalAlpha = 1; for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawCar(g, c, 'color');
    for (const c of S.cars) if (c.siren && c.layer === 0 && vis(c.x, c.y)) drawLightBar(g, c, time);   // L15: the cruiser's roof light bar
    // bridge decks: cast shadow on whatever is below, then the deck (asphalt + parapets), then cars on it
    const decks = []; const seen = new Set();
    for (let cy = Math.floor(vy0 / 256) - 1; cy <= Math.floor(vy1 / 256) + 1; cy++) for (let cx = Math.floor(vx0 / 256) - 1; cx <= Math.floor(vx1 / 256) + 1; cx++)
      for (const si of this.W.grid[1].get(cx * 100003 + cy) || []) { const e = this.W.seg[si].e; if (!seen.has(e)) { seen.add(e); decks.push(e); } }
    g.lineCap = 'butt'; g.lineJoin = 'round';
    const path = (e, dx = 0, dy = 0) => { g.beginPath(); e.pts.forEach(([x, y], i) => i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)); };
    for (const e of decks) { g.globalAlpha = 0.32; g.strokeStyle = '#1c1530'; g.lineWidth = e.w + 10; path(e, SUN.x * 60, SUN.y * 60); g.stroke(); }
    g.globalAlpha = 1;
    for (const e of decks) { g.strokeStyle = '#d9cbb3'; g.lineWidth = e.w + 9; path(e); g.stroke(); }
    for (const e of decks) { g.strokeStyle = '#5a6272'; g.lineWidth = e.w; path(e); g.stroke(); g.strokeStyle = 'rgba(244,240,230,0.55)'; g.lineWidth = 1.6; g.setLineDash([16, 24]); path(e); g.stroke(); g.setLineDash([]); }
    g.globalAlpha = 0.55; for (const c of S.cars) if (c.layer === 1 && vis(c.x, c.y)) this.drawCar(g, c, 'shadow');
    for (const c of S.cars) if (c.layer === 1 && vis(c.x, c.y)) this.drawGlow(g, c);
    g.globalAlpha = 1; for (const c of S.cars) if (c.layer === 1 && vis(c.x, c.y)) this.drawCar(g, c, 'color');
    if (this.placeFx) this.placeFx(g, S, this.gr, time, vis);   // L12/L13 hook (lf_places_render.js): the 108 Astro's parking lights, Scott's tag, the bark
    if (this.worldFx) this.worldFx(g, S, time, vis, vx0, vy0, vx1, vy1);   // M-B/M-C + valet + curb destruct world overlays
    FX.over(g, S, this.mission, time);                    // bass rings, sputter, fire, pickup rings, the beat's walkers
    // hero plaques (over the cars, under the grade so they sit in the light)
    if (this.heroArt) this.heroArt.districtPlaque(g, vis);   // L11: the Maple Lawn district plaque
    if (this.areas) for (const h of this.areas.heroes) {
      if (!vis(h.cx, h.cy, 300)) continue;
      g.font = '800 22px system-ui'; const w = g.measureText(h.who).width + 26, y = h.cy - 90;
      g.fillStyle = 'rgba(255,241,216,0.94)'; g.beginPath(); g.roundRect(h.cx - w / 2, y - 18, w, 34, 12); g.fill();
      g.lineWidth = 2.5; g.strokeStyle = '#2a1430'; g.stroke(); g.fillStyle = '#2a1430'; g.textAlign = 'center'; g.fillText(h.who, h.cx, y + 7);
    }
    // grade (Palm City's, keyframed by tod): warm golden multiply + soft-light glow from the west,
    // vignette — at golden hour this matches the old static grade; by dusk the multiply plunges
    // to ultramarine, the glow dies and the vignette deepens, exactly as Palm City falls to night.
    const gr = this.gr, gk = Math.round(tod * 50);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${gr.mul[0]},${gr.mul[1]},${gr.mul[2]})`; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'soft-light';
    if (!this.warmG || this.warmVh !== vh || this.warmGk !== gk) {
      const w = g.createLinearGradient(0, vh * 0.3, vw, vh * 0.8), gs = gr.glow / 0.48;
      w.addColorStop(0, `rgba(255,190,82,${(0.55 * gs).toFixed(3)})`); w.addColorStop(1, `rgba(255,140,120,${(0.3 * gs).toFixed(3)})`);
      const v = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72);
      v.addColorStop(0, 'rgba(40,20,60,0)'); v.addColorStop(1, `rgba(${gr.vigCol[0]},${gr.vigCol[1]},${gr.vigCol[2]},${gr.vigAlpha.toFixed(3)})`);
      this.warmG = w; this.vig = v; this.warmVh = vh; this.warmGk = gk;
    }
    g.fillStyle = this.warmG; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = this.vig; g.fillRect(0, 0, vw, vh);
    // L11 HOOK: night lights (hero windows, the OPEN sign) + residential streetlamps drawn AFTER the grade so they glow through the dusk multiply
    if (!far) {
      g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
      if (gr.lamps > 0.10) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const seenL = new Set();
        for (let cy = Math.floor(vy0 / 256); cy <= Math.floor(vy1 / 256); cy++) for (let cx = Math.floor(vx0 / 256); cx <= Math.floor(vx1 / 256); cx++) {
          for (const si of this.W.grid[0].get(cx * 100003 + cy) || []) {
            const e = this.W.seg[si].e; if (seenL.has(e) || e.hw === 'service' || e.len < 90) continue; seenL.add(e);
            const [lx, ly] = e.pts[e.pts.length >> 1]; if (!vis(lx, ly, 90)) continue;
            const r = e.hw === 'residential' || e.hw === 'unclassified' ? 54 : 68;
            const lg = g.createRadialGradient(lx, ly, 2, lx, ly, r);
            lg.addColorStop(0, `rgba(255,210,128,${(0.32 * gr.lamps).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,210,128,0)');
            g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.fill();
          }
        }
        g.restore();
      }
      if (this.heroArt) this.heroArt.lights(g);
      if (this.postLights) this.postLights(g, S, this.gr, time, vis);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
}

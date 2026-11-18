// lf_render.js — draws the Laurel/Fulton sample: painted ground chunks (lf_ground.js), bridge decks above
// with their cast shadow, the crew's cars (assets/fleet.json sprites: shadow pass, then colour, 32 angles),
// a golden-hour grade in Palm City's spirit, and the real street name you are on.
import { CHUNK } from './lf_ground.js';
import { poly } from './lf_areas.js';
import * as FX from './lf_fx.js';

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
  draw(S, cam, time) {
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
    if (this.areas) for (const h of this.areas.heroes) {
      if (!vis(h.cx, h.cy, 600)) continue;
      const S = h.kind === 'poi' ? 1.12 : 1.35, roof = h.kind === 'poi' ? '#e8b77a' : '#d9785a';
      g.globalAlpha = 0.38; g.fillStyle = '#21183a'; g.save(); g.translate(SUN.x * 34, SUN.y * 34); poly(g, h.f, S, h.cx, h.cy); g.fill(); g.restore();
      g.globalAlpha = 1; g.fillStyle = roof; poly(g, h.f, S, h.cx, h.cy); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#2a1430'; g.stroke();
      g.globalAlpha = 0.35; g.fillStyle = '#fff2d8'; poly(g, h.f, S * 0.55, h.cx - 6, h.cy - 4); g.fill(); g.globalAlpha = 1;   // lit roof plane
    }
    // shadows of ground-level cars, then those cars
    g.globalAlpha = 0.55; for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawCar(g, c, 'shadow');
    this.S = S; this.time = time; FX.under(g, S, time, [cam.x - hw - 60, cam.y - hh - 60, cam.x + hw + 60, cam.y + hh + 60]);
    g.globalAlpha = 1; for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawCar(g, c, 'color');
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
    g.globalAlpha = 1; for (const c of S.cars) if (c.layer === 1 && vis(c.x, c.y)) this.drawCar(g, c, 'color');
    FX.over(g, S, this.mission, time);                    // bass rings, sputter, fire, pickup rings, the beat's walkers
    // hero plaques (over the cars, under the grade so they sit in the light)
    if (this.areas) for (const h of this.areas.heroes) {
      if (!vis(h.cx, h.cy, 300)) continue;
      g.font = '800 22px system-ui'; const w = g.measureText(h.who).width + 26, y = h.cy - 90;
      g.fillStyle = 'rgba(255,241,216,0.94)'; g.beginPath(); g.roundRect(h.cx - w / 2, y - 18, w, 34, 12); g.fill();
      g.lineWidth = 2.5; g.strokeStyle = '#2a1430'; g.stroke(); g.fillStyle = '#2a1430'; g.textAlign = 'center'; g.fillText(h.who, h.cx, y + 7);
    }
    // grade: warm golden multiply + soft-light glow from the west, vignette (Palm City's golden hour)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(255,232,206)'; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'soft-light';
    if (!this.warm || this.warm.vh !== vh) { const w = this.warm = g.createLinearGradient(0, vh * 0.3, vw, vh * 0.8); w.addColorStop(0, 'rgba(255,190,82,0.55)'); w.addColorStop(1, 'rgba(255,140,120,0.3)'); w.vh = vh;
      const v = this.vig = g.createRadialGradient(vw / 2, vh / 2, vh * 0.32, vw / 2, vh / 2, vh * 0.72); v.addColorStop(0, 'rgba(40,20,60,0)'); v.addColorStop(1, 'rgba(40,20,60,0.42)'); }
    g.fillStyle = this.warm; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = this.vig; g.fillRect(0, 0, vw, vh);
  }
}

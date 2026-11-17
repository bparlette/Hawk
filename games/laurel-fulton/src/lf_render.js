// lf_render.js — draws the Laurel/Fulton sample: painted ground chunks (lf_ground.js), bridge decks above
// with their cast shadow, the crew's cars (assets/fleet.json sprites: shadow pass, then colour, 32 angles),
// a golden-hour grade in Palm City's spirit, and the real street name you are on.
import { CHUNK } from './lf_ground.js';

const SUN = { x: 0.8, y: -0.3 };                       // the bake's sun: shadows fall east-north-east
export class Renderer {
  constructor(ctx, W, ground, fleet, imgs) { this.ctx = ctx; this.W = W; this.ground = ground; this.fleet = fleet; this.imgs = imgs; }
  resize(vw, vh, dpr) { this.vw = vw; this.vh = vh; this.dpr = dpr; }
  cell(m, k, which) {                                   // a car sheet frame -> [img, sx, sy, sw, sh, ox, oy, w, h]
    const e = m[which], img = this.imgs[e.file], cols = m.cols, rows = Math.ceil(m.angles / cols);
    const fw = img.width / cols, fh = img.height / rows, r = Math.floor(k / cols), c = k % cols;
    return [img, c * fw, r * fh, fw, fh, e.ox, e.oy, e.w, e.h];
  }
  drawCar(g, c, which) {
    const m = this.fleet[c.model], k = ((Math.round(c.h / (Math.PI * 2) * m.angles) % m.angles) + m.angles) % m.angles;
    const [img, sx, sy, sw, sh, ox, oy, w, h] = this.cell(m, k, which);
    g.drawImage(img, sx, sy, sw, sh, c.x + ox, c.y + oy, w, h);
  }
  draw(S, cam, time) {
    const g = this.ctx, { vw, vh, dpr } = this, z = cam.zoom, hw = vw / 2 / z, hh = vh / 2 / z;
    const vx0 = cam.x - hw, vy0 = cam.y - hh, vx1 = cam.x + hw, vy1 = cam.y + hh;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#4c7a3c'; g.fillRect(0, 0, vw, vh);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z), dpr * (vh / 2 - cam.y * z));
    for (let cy = Math.floor(vy0 / CHUNK); cy <= Math.floor(vy1 / CHUNK); cy++)
      for (let cx = Math.floor(vx0 / CHUNK); cx <= Math.floor(vx1 / CHUNK); cx++) g.drawImage(this.ground.get(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 0.6, CHUNK + 0.6);
    const vis = (x, y, m = 120) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
    // shadows of ground-level cars, then those cars
    g.globalAlpha = 0.55; for (const c of S.cars) if (c.layer === 0 && vis(c.x, c.y)) this.drawCar(g, c, 'shadow');
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

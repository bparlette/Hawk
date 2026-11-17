// newscam.js — PALM CITY NEWS: the helicopter picture-in-picture that rides along on OPEN ROAD.
// A second Renderer on a small offscreen canvas (the SiegeRenderer pattern: its own Renderer, its
// own camera), framed high and trailing the player's car, composited into the top-left of the HUD
// with a blinking red LIVE dot and the PALM CITY NEWS banner. The feed renders every other frame
// at 240×160 — a TV picture, not a second game view — and only while the run is live. Everything
// it shows is the game's own painted world; nothing here touches the sim.
// v2: the feed follows the race OUT of the city, so its camera clamps to world.bounds (core +
// shell) instead of the core rect — on the causeway the aerial view contrasts the chase cam.
import { Renderer } from './render.js';

const FW = 240, FH = 160;                 // the feed's own resolution
const W = 156, H = 104;                   // its size on screen (view units)

export class NewsCam {
  constructor(world, ground, M) {
    this.cv = document.createElement('canvas'); this.cv.width = FW; this.cv.height = FH;
    this.r = new Renderer(this.cv.getContext('2d'), world, ground, M);
    this.r.resize(FW, FH, 1);
    this.cam = { x: 0, y: 0, zoom: 0.5, kick: 1, roll: 0 };
    this.set = false; this.n = 0;
    this.world = world;
  }

  draw(g, S, tod, time, vw, vh, top, dpr) {
    const f = S.focus();
    if (!this.set) { this.cam.x = f.x; this.cam.y = f.y; this.set = true; }
    if ((this.n++ & 1) === 0) {
      let hx = 0, hy = 0;
      if (S.player.mode === 'car') { const c = S.player.car; hx = Math.cos(c.h); hy = Math.sin(c.h); }
      const tx = f.x + hx * 52, ty = f.y + hy * 52;                    // centred a little way up the road
      this.cam.x += (tx - this.cam.x) * 0.14; this.cam.y += (ty - this.cam.y) * 0.14;
      const hw = FW / 2 / this.cam.zoom, hh = FH / 2 / this.cam.zoom, B = this.world.bounds;
      this.cam.x = Math.max(B.x0 + hw, Math.min(B.x1 - hw, this.cam.x));
      this.cam.y = Math.max(B.y0 + hh, Math.min(B.y1 - hh, this.cam.y));
      this.r.draw(S, this.cam, tod, time);
    }
    // composite: ink frame, the feed, the LIVE pill, the banner strip
    const x = 12, y = top + 98;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(20,12,40,0.88)'; g.beginPath(); g.roundRect(x - 3, y - 3, W + 6, H + 22, 9); g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,212,92,0.85)'; g.stroke();
    g.drawImage(this.cv, x, y, W, H);
    if (Math.floor(time * 2) % 2 === 0) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x + 11, y + 11, 4.5, 0, 7); g.fill(); }
    g.font = '900 10px "Avenir Next", Futura, system-ui, sans-serif'; g.textAlign = 'left';
    g.fillStyle = '#fff1d8'; g.fillText('LIVE', x + 19, y + 14);
    g.fillStyle = '#ffd45c'; g.fillText('PALM CITY NEWS', x + 2, y + H + 14);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,241,216,0.75)'; g.fillText('CAM 1', x + W - 2, y + H + 14);
    g.textAlign = 'left';
  }
}

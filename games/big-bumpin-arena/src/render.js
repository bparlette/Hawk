// Renderer: canvas 2D, driven entirely by the active STYLE PACK (src/styles.js). It only READS the game; nothing in
// src/config|physics|world|game|bots imports this file. Pipeline per frame:
//   world -> offscreen target (low-res when the pack asks for a pixel pass) -> screen -> bloom -> vignette -> HUD
import { createArenaWallConfigs } from './physics.js';
import { buildArena } from './arenas.js';
import { drawTheme, drawObstacle, drawOverhead, GROUND } from './landscape.js';
import { HZ } from './config.js';
import { STYLES, STYLE_ORDER } from './styles.js';

const lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const mix = (c1, c2, t) => { const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), a = p(c1), b = p(c2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; };

export class View {
  constructor(canvas, cfg) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cfg = cfg; this.arena = null; this.cam = null;
    this.wc = document.createElement('canvas'); this.wg = this.wc.getContext('2d');
    this.canFilter = 'filter' in this.ctx;
    this.sparks = []; this.rings = []; this.pops = []; this.trail = []; this.shake = 0; this.flash = null; this.t = 0; this.touchLayout = false;
    let s = 7; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); this.specks = Array.from({ length: 260 }, () => [R(), R(), R()]);
    this.setStyle('cel');
  }
  setStyle(id) { this.styleId = STYLES[id] ? id : 'cel'; this.style = STYLES[this.styleId]; this._stripe = null; this.resize(); }
  nextStyle() { this.setStyle(STYLE_ORDER[(STYLE_ORDER.indexOf(this.styleId) + 1) % STYLE_ORDER.length]); return this.styleId; }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
    this.portrait = h > w * 1.05; this.rot = this.portrait ? -Math.PI / 2 : 0; // on a tall screen the arena is turned on end (red attacks up the screen)
    this.hudH = this.touchLayout ? 70 : 48; this.footH = this.touchLayout ? 6 : 38; this.cx = w / 2; this.cy = this.hudH + (h - this.hudH - this.footH) / 2;
    // pixel pass: the world is drawn into a small target and scaled up with no smoothing
    const px = this.style ? this.style.post.pixel : 0, long = Math.max(this.canvas.width, this.canvas.height);
    this.k = px ? Math.max(2, Math.round(long / px)) : 1;
    this.wc.width = Math.ceil(this.canvas.width / this.k); this.wc.height = Math.ceil(this.canvas.height / this.k);
  }
  _setArena(A) { // cache everything that depends on the place
    this.arena = A; this.walls = createArenaWallConfigs(this.cfg, A); this.cam = null; this.trail.length = 0;
    this.bulbs = []; const p = A.poly; // marquee bulbs every ~46 px along the boards, set back onto the wall
    for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), n = Math.floor(len / 46); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; this.bulbs.push([x0 + dx * t + (dy / len) * 22, y0 + dy * t - (dx / len) * 22]); } }
  }
  /** Scale that shows a w x h world box inside the play area of the screen. */
  _fit(w, h) { const aw = this.w - 8, ah = this.h - this.hudH - this.footH; return this.portrait ? Math.min(aw / h, ah / w) : Math.min(aw / w, ah / h); }
  // Camera. Small arenas are framed whole. Big ones follow the action: the player and the ball stay in frame, never
  // zoomed in closer than the classic rink looks, with frame-rate-independent exponential damping (raycast-vehicle lift).
  _camera(game, dt, hud) {
    const A = game.arena, fit = this._fit(A.w + 56, A.h + 16), close = this._fit(1280 + 56, 908 + 16), aw = (this.portrait ? this.h - this.hudH - this.footH : this.w - 8), ah = (this.portrait ? this.w - 8 : this.h - this.hudH - this.footH);
    let want = { x: A.cx, y: A.cy, s: fit };
    if (fit < close * 0.93) {
      const b = game.ball.body.position, pts = [[b.x, b.y], ...(hud.car ? [[hud.car.body.position.x, hud.car.body.position.y]] : game.cars.map((c) => [c.body.position.x, c.body.position.y]))];
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = 300, bw = Math.max(...xs) - Math.min(...xs) + m * 2, bh = Math.max(...ys) - Math.min(...ys) + m * 2;
      const s = Math.max(fit, Math.min(close, aw / bw, ah / bh)), vw = aw / s, vh = ah / s, clampAxis = (c, lo, hi, v) => (v >= hi - lo ? (lo + hi) / 2 : Math.max(lo + v / 2, Math.min(hi - v / 2, c)));
      want = { s, x: clampAxis((Math.max(...xs) + Math.min(...xs)) / 2, -40, A.w + 40, vw), y: clampAxis((Math.max(...ys) + Math.min(...ys)) / 2, -20, A.h + 20, vh) };
    }
    if (!this.cam) this.cam = want; else { const k = 1 - Math.exp(-4.5 * dt), ks = 1 - Math.exp(-2.5 * dt); this.cam.x += (want.x - this.cam.x) * k; this.cam.y += (want.y - this.cam.y) * k; this.cam.s += (want.s - this.cam.s) * ks; }
    this.scale = this.cam.s; this.zoomed = this.cam.s > fit * 1.04;
  }
  /** A fill for a solid of radius r whose own frame is turned by `ang`: the pack's material mode decides the shading. */
  _mat(g, base, dark, lite, r, ang = 0) {
    const S = this.style; if (S.mat === 'flat') return base;
    const a = Math.atan2(S.light.dir[1], S.light.dir[0]) - ang - this.rot, lx = Math.cos(a), ly = Math.sin(a), gr = g.createLinearGradient(lx * r, ly * r, -lx * r, -ly * r);
    if (S.mat === 'cel') { gr.addColorStop(0, base); gr.addColorStop(0.6, base); gr.addColorStop(0.6, dark); gr.addColorStop(1, dark); }
    else { gr.addColorStop(0, lite); gr.addColorStop(0.42, base); gr.addColorStop(1, dark); }
    return gr;
  }
  _ink(g, w) { const S = this.style; if (!S.outline) return; g.lineWidth = w || S.outline; g.strokeStyle = S.pal.ink; g.lineJoin = 'round'; g.stroke(); }
  _font(px, wt) { const u = this.style.ui; return `${wt || u.weight} ${Math.round(px)}px ${u.font}`; }

  /** Feed one sim tick's events in (sparks, rings, pop-up words, shake, goal flash). */
  onEvents(events, game) {
    const P = this.style.pal, pop = (text, x, y, c) => this.pops.push({ text, x, y, c: c || P.text, life: 1 });
    for (const e of events) {
      if (e.type === 'hit' && e.force > 1.2) {
        const n = Math.min(16, 3 + Math.floor(e.force * 1.4)), hot = e.kind.includes('ball');
        for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = (0.6 + Math.random()) * Math.min(7, 1.5 + e.force * 0.6); this.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: hot ? P.ball : '#ffffff' }); }
        if (e.force > 4) this.rings.push({ x: e.x, y: e.y, r: 8, max: 26 + e.force * 5, life: 1, c: '#ffffff', star: true });
        if (e.kind !== 'ball-wall') this.shake = Math.min(16, Math.max(this.shake, e.force * 1.1)); // shake scales with impact force
      } else if (e.type === 'goal') { this.flash = { team: e.team, t: 1 }; this.shake = 18; this.banner = 0; }
      else if (e.type === 'shock') { this.rings.push({ x: e.x, y: e.y, r: 30, max: e.r, life: 1, c: P.accent, w: 10 }); this.shake = 14; }
      else if (e.type === 'pickup') { this.rings.push({ x: e.x, y: e.y, r: 10, max: 70, life: 1, c: P.accent, w: 6 }); }
      else if (e.type === 'spin') { pop('SPIN!', e.x, e.y - 40, P.accent); this.shake = Math.max(this.shake, 8); }
      else if (e.type === 'flatten') { pop('FLAT!', e.x, e.y - 40, P.glow); this.shake = 16; this.rings.push({ x: e.x, y: e.y, r: 20, max: 120, life: 1, c: P.glow, w: 8 }); }
      else if (e.type === 'onetimer') { pop('ONE-TIMER!', e.x, e.y - 50, P.accent); this.shake = Math.max(this.shake, 9); }
      else if (e.type === 'pit') { pop('SPLASH!', e.x, e.y - 50, '#bfe9ff'); this.rings.push({ x: e.x, y: e.y, r: 20, max: 110, life: 1, c: '#bfe9ff', w: 8 }); }
      else if (e.type === 'snap' && e.cut) pop('SNAP!', e.x, e.y - 30, P.accent);
      else if (e.type === 'pylon') this.rings.push({ x: e.x, y: e.y, r: 12, max: 60, life: 1, c: '#ffffff', w: 4 });
      else if (e.type === 'shunt') { const c = game.cars[e.car], a = c.body.angle + e.dir * Math.PI / 2; for (let i = 0; i < 6; i++) this.sparks.push({ x: e.x - Math.cos(a) * 20, y: e.y - Math.sin(a) * 20, vx: -Math.cos(a) * (3 + i), vy: -Math.sin(a) * (3 + i), life: 0.8, c: '#ffffff' }); }
    }
  }

  draw(game, alpha, dt, hud = {}) {
    const S = this.style, P = S.pal, g = this.wg, k = this.dpr / this.k; this.t += dt;
    if (this.arena !== game.arena) this._setArena(game.arena);
    this._camera(game, dt, hud);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = mix(GROUND[game.arena.theme] || P.bg, P.bg, S.groundMix ?? 0.5); g.fillRect(0, 0, this.wc.width, this.wc.height);
    this.shake *= Math.pow(0.002, dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    g.setTransform(k, 0, 0, k, 0, 0); g.translate(this.cx + sx, this.cy + sy); g.rotate(this.rot); g.scale(this.scale, this.scale); g.translate(-this.cam.x, -this.cam.y);
    this._rink(g, game); this._hazards(g, game); this._boards(g, game); this._pickups(g, game); this._ball(g, game, alpha);
    for (const c of game.cars) this._car(g, game, c, alpha, hud.players || {});
    this._above(g, game); this._fx(g, dt);
    if (S.deco === 'beams') this._beams(g, game.arena);
    const m = this.ctx; m.setTransform(1, 0, 0, 1, 0, 0); m.imageSmoothingEnabled = this.k === 1; m.globalAlpha = 1; m.globalCompositeOperation = 'source-over';
    m.drawImage(this.wc, 0, 0, this.wc.width, this.wc.height, 0, 0, this.wc.width * this.k, this.wc.height * this.k);
    if (S.post.bloom && this.canFilter) { m.save(); m.filter = `blur(${Math.round(9 * this.dpr)}px)`; m.globalCompositeOperation = 'lighter'; m.globalAlpha = S.post.bloom; m.drawImage(this.wc, 0, 0, this.canvas.width, this.canvas.height); m.restore(); }
    m.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (S.post.vignette) { const v = m.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${S.post.vignette})`); m.fillStyle = v; m.fillRect(0, 0, this.w, this.h); }
    if (this.flash) { this.flash.t -= dt * 1.1; if (this.flash.t <= 0) this.flash = null; else { m.globalAlpha = this.flash.t * 0.38; m.fillStyle = P.team[this.flash.team]; m.fillRect(0, 0, this.w, this.h); m.globalAlpha = 1; } }
    this._hud(m, game, hud, dt);
  }

  // ---------------------------------------------------------------------------- arena
  _path(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  _rink(g, game) {
    const S = this.style, P = S.pal, A = game.arena, [fa, fb, line] = S.floor[game.surface] || S.floor.asphalt, B = A.bounds, fw = B.right - B.left, fh = B.bottom - B.top;
    drawTheme(g, this, game, 'ground');
    g.save(); this._path(g, A.field); g.fillStyle = fa; g.fill(); g.clip();
    g.fillStyle = fb; const bands = Math.round(fw / 180); for (let i = 0; i < bands; i += 2) g.fillRect(B.left + (fw / bands) * (i + 0.5), B.top, fw / bands, fh);
    if (game.surface === 'ice') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 5; for (let x = B.left - 400; x < B.right; x += 120) { g.beginPath(); g.moveTo(x, B.bottom); g.lineTo(x + 330, B.top); g.stroke(); } }
    if (game.surface === 'dirt') for (const [u, v, s] of this.specks) { g.fillStyle = s > 0.5 ? 'rgba(60,30,10,.28)' : 'rgba(255,235,200,.3)'; g.fillRect(B.left + u * fw, B.top + v * fh, 5 + s * 7, 5 + s * 5); }
    drawTheme(g, this, game, 'floor');
    if (S.mat === 'gloss') { const sh = g.createLinearGradient(B.left, B.top, B.right, B.bottom); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = sh; g.fillRect(B.left, B.top, fw, fh); }
    g.strokeStyle = line; g.lineWidth = 4; g.beginPath(); g.moveTo(A.cx, B.top); g.lineTo(A.cx, B.bottom); g.moveTo(A.cx + 96, A.cy); g.arc(A.cx, A.cy, 96, 0, TAU); g.stroke();
    for (const G of A.goals) { g.beginPath(); g.arc(G.x, G.y, G.half + 46, 0, TAU); g.stroke(); }
    g.fillStyle = line; g.beginPath(); g.arc(A.cx, A.cy, 8, 0, TAU); g.fill();
    g.restore();
    for (const p of A.pits) { // holes: dark water, pale rim
      const gr = g.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r); gr.addColorStop(0, '#04101f'); gr.addColorStop(1, '#12365a'); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fillStyle = gr; g.fill();
      g.lineWidth = 9; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke(); this._ink(g, Math.min(3, S.outline)); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, p.r * 0.55 + Math.sin(this.t * 2 + p.x) * 4, 0.4, 2.2); g.stroke();
    }
    for (const G of A.goals) { // nets, tinted by the team that defends them
      const x0 = Math.min(G.x, G.x + G.dir * A.netDepth);
      g.fillStyle = P.teamDark[G.team]; g.fillRect(x0, G.y - G.half, A.netDepth, G.half * 2);
      g.strokeStyle = P.net; g.lineWidth = 2; g.beginPath();
      for (let q = 12; q < A.netDepth; q += 16) { g.moveTo(G.x + G.dir * q, G.y - G.half); g.lineTo(G.x + G.dir * q, G.y + G.half); }
      for (let q = -G.half + 16; q < G.half; q += 16) { g.moveTo(G.x, G.y + q); g.lineTo(G.x + G.dir * A.netDepth, G.y + q); }
      g.stroke(); g.strokeStyle = P.team[G.team]; g.lineWidth = 8; g.beginPath(); g.moveTo(G.x, G.y - G.half); g.lineTo(G.x, G.y + G.half); g.stroke();
    }
  }
  _boards(g, game) { // walls, their trim, posts and the arena's furniture (drawn after floor hazards so shadows fall right)
    const S = this.style, P = S.pal, A = game.arena;
    for (const w of this.walls) {
      if (w.kind !== 'wall') continue;
      g.save(); g.translate(w.x, w.y); g.rotate(w.angle); g.fillStyle = S.mat === 'cel' ? P.wall : this._mat(g, P.wall, P.wallDark, '#ffffff', Math.max(w.w, w.h) * 0.6, w.angle); g.fillRect(-w.w / 2 - 0.5, -w.h / 2 - 0.5, w.w + 1, w.h + 1);
      if (P.stripe) { g.fillStyle = this._stripes(g); g.fillRect(-w.w / 2, -w.h / 2, w.w, w.h); }
      g.restore();
    }
    this._path(g, A.poly); if (S.outline) { g.lineWidth = S.outline + 5; g.strokeStyle = P.ink; g.lineJoin = 'round'; g.stroke(); }
    g.lineWidth = 5; g.strokeStyle = P.trim || '#ffffff'; g.globalAlpha = 0.92; g.stroke(); g.globalAlpha = 1;
    if (S.deco === 'pennants') { g.fillStyle = P.accent; this.bulbs.forEach(([x, y], i) => { const p = A.poly, q = this.bulbs[(i + 1) % this.bulbs.length]; if (Math.hypot(q[0] - x, q[1] - y) > 60) return; g.beginPath(); g.moveTo(x, y); g.lineTo(q[0], q[1]); g.lineTo((x + q[0]) / 2 + (q[1] - y) * 0.45, (y + q[1]) / 2 - (q[0] - x) * 0.45); g.fill(); }); }
    if (S.deco === 'bulbs') this.bulbs.forEach(([x, y], i) => { const on = (i + Math.floor(this.t * 5)) % 3 === 0; g.beginPath(); g.arc(x, y, on ? 9 : 7, 0, TAU); g.fillStyle = on ? P.bulb : '#c98a1c'; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke(); if (on) { g.globalAlpha = 0.4; g.fillStyle = P.bulb; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.fill(); g.globalAlpha = 1; } });
    for (const w of this.walls) if (w.kind === 'post') { g.beginPath(); g.arc(w.x, w.y, w.r + 5, 0, TAU); g.fillStyle = this._mat(g, '#ffffff', P.wallDark, '#ffffff', w.r + 5); g.fill(); this._ink(g, Math.min(4, S.outline)); }
    for (const o of A.obstacles) drawObstacle(g, this, o);
  }
  _above(g, game) { // things that pass over the cars: the boom arm, harpoon lines, overhead wires and bunting
    const S = this.style, P = S.pal;
    for (const s of game.world.sweepers) {
      g.save(); g.translate(s.x, s.y); g.rotate(s.a); const [dx, dy, da] = S.light.shadow;
      g.globalAlpha = da; g.fillStyle = '#000'; g.fillRect(-s.len + dx, -s.r + dy, s.len * 2, s.r * 2); g.globalAlpha = 1;
      g.beginPath(); g.roundRect(-s.len, -s.r, s.len * 2, s.r * 2, s.r); g.fillStyle = this._mat(g, '#f4f4f4', '#9aa0ad', '#ffffff', s.len, s.a); g.fill();
      g.save(); g.clip(); g.fillStyle = P.team[0]; for (let x = -s.len; x < s.len; x += 56) { g.beginPath(); g.moveTo(x, -s.r); g.lineTo(x + 28, -s.r); g.lineTo(x + 14, s.r); g.lineTo(x - 14, s.r); g.fill(); } g.restore();
      g.beginPath(); g.roundRect(-s.len, -s.r, s.len * 2, s.r * 2, s.r); this._ink(g); g.beginPath(); g.arc(0, 0, s.r + 12, 0, TAU); g.fillStyle = this._mat(g, P.accent, P.ballDark, '#ffffff', s.r + 12); g.fill(); this._ink(g); g.restore();
    }
    for (const t of game.world.tethers) { const a = t.car.body.position, b = t.body.position; g.strokeStyle = P.ink; g.lineWidth = 8; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.strokeStyle = P.accent; g.lineWidth = 4; g.setLineDash([14, 8]); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(b.x, b.y, 10, 0, TAU); g.fillStyle = P.accent; g.fill(); this._ink(g, 3); }
    drawOverhead(g, this, game);
  }
  _stripes(g) { // candy-stripe overlay for the fairground boards
    if (!this._stripe) { const c = document.createElement('canvas'); c.width = c.height = 48; const q = c.getContext('2d'); q.strokeStyle = this.style.pal.stripe; q.lineWidth = 12; for (let i = -48; i < 96; i += 24) { q.beginPath(); q.moveTo(i, 48); q.lineTo(i + 48, 0); q.stroke(); } this._stripe = g.createPattern(c, 'repeat'); }
    return this._stripe;
  }
  _hazards(g, game) {
    const P = this.style.pal, H = this.cfg.hazards, hz = game.world.hazards, A = game.arena;
    if (hz.pads) for (const z of A.pads) { // conveyor / speed pads: arrows crawl the way they push
      g.fillStyle = P.pad; g.globalAlpha = 0.2; g.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); g.globalAlpha = 0.85; g.strokeStyle = P.pad; g.lineWidth = 6; g.lineJoin = 'round';
      const my = (z.y0 + z.y1) / 2, off = ((this.t * 90) % 40) * z.dir;
      g.save(); g.beginPath(); g.rect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); g.clip();
      for (let x = z.x0 - 40; x < z.x1 + 40; x += 40) { g.beginPath(); g.moveTo(x + off - 10 * z.dir, z.y0 + 12); g.lineTo(x + off + 10 * z.dir, my); g.lineTo(x + off - 10 * z.dir, z.y1 - 12); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
    }
    if (hz.tilt && game.world.tiltOn && game.state !== 'over') for (const G of A.goals) { const dir = G.dir, cy = G.y; // the floor is tipping toward both goals
      g.strokeStyle = P.accent; g.lineWidth = 7; g.lineJoin = 'round'; g.globalAlpha = 0.35 + 0.3 * Math.sin(this.t * 6);
      for (let q = 0; q < 3; q++) { const x = G.x - dir * (250 - q * 44); g.beginPath(); g.moveTo(x - dir * 14, cy - 34); g.lineTo(x + dir * 14, cy); g.lineTo(x - dir * 14, cy + 34); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (hz.pylons) for (const p of game.world.pylons) {
      const r = H.pylons.r;
      if (!p.up) { g.strokeStyle = P.ink; g.globalAlpha = 0.45; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; continue; }
      const [dx, dy, da] = this.style.light.shadow; g.globalAlpha = da; g.fillStyle = '#000'; g.beginPath(); g.arc(p.x + dx, p.y + dy, r, 0, TAU); g.fill(); g.globalAlpha = 1;
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fillStyle = this._mat(g, P.accent, P.ballDark, '#ffffff', r); g.fill(); this._ink(g);
      g.beginPath(); g.arc(p.x, p.y, r * 0.55, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); g.beginPath(); g.arc(p.x, p.y, r * 0.25, 0, TAU); g.fillStyle = P.team[0]; g.fill();
    }
    for (const s of game.world.slicks) { g.globalAlpha = Math.min(0.85, s.t / 60); g.fillStyle = '#0c0a14'; g.beginPath(); g.ellipse(s.x, s.y, 50, 40, 0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(s.x + 26, s.y + 22, 20, 14, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(160,120,255,.45)'; g.beginPath(); g.ellipse(s.x - 12, s.y - 10, 16, 8, 0.4, 0, TAU); g.fill(); g.globalAlpha = 1; }
  }
  _pickups(g, game) {
    const P = this.style.pal;
    for (const b of game.world.boxes) {
      if (!b.active) continue; const s = 26 + Math.sin(this.t * 4) * 3;
      g.save(); g.translate(b.x, b.y); g.globalAlpha = 0.25; g.fillStyle = P.accent; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill(); g.globalAlpha = 1;
      g.rotate(this.t * 1.2); g.beginPath(); g.roundRect(-s, -s, s * 2, s * 2, 8); g.fillStyle = this._mat(g, P.accent, P.ballDark, '#ffffff', s, this.t * 1.2); g.fill(); this._ink(g);
      g.rotate(-this.t * 1.2 - this.rot); g.fillStyle = P.ink; g.font = this._font(34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2); g.restore();
    }
  }
  _beams(g, A) { // arena light beams sweeping the floor (additive)
    const W = A; g.save(); g.globalCompositeOperation = 'lighter';
    [[-40, -60, 0], [W.w + 40, -60, 2], [-40, W.h + 60, 4], [W.w + 40, W.h + 60, 1]].forEach(([x, y, ph], i) => {
      const a = Math.atan2(W.h / 2 - y, W.w / 2 - x) + Math.sin(this.t * 0.5 + ph) * 0.5, L = W.w, sp = 0.13, gr = g.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
      gr.addColorStop(0, i % 2 ? 'rgba(52,245,255,.16)' : 'rgba(255,60,120,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - sp) * L, y + Math.sin(a - sp) * L); g.lineTo(x + Math.cos(a + sp) * L, y + Math.sin(a + sp) * L); g.fill();
    }); g.restore();
  }

  // ---------------------------------------------------------------------------- ball + cars
  _ball(g, game, alpha) {
    const S = this.style, P = S.pal, b = game.ball, x = lerp(b.px, b.body.position.x, alpha), y = lerp(b.py, b.body.position.y, alpha), r = this.cfg.ball.r, heat = b.heat;
    const v = game.M.Body.getVelocity(b.body), sp = Math.hypot(v.x, v.y), hot = mix(P.ball, P.glow, Math.min(1, heat * 0.9));
    this.trail.push({ x, y, a: Math.min(1, sp / 12 + heat * 0.6) }); if (this.trail.length > 18) this.trail.shift();
    if (b.laser > 0) { const s = this.trail[0]; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.globalAlpha = 0.85; g.lineWidth = r * 0.9; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(x, y); g.stroke(); g.strokeStyle = P.accent; g.lineWidth = r * 0.45; g.stroke(); g.globalAlpha = 1; g.lineCap = 'butt'; }
    this.trail.forEach((p, i) => { if (p.a < 0.25) return; g.globalAlpha = (i / this.trail.length) * (0.28 + heat * 0.35) * p.a; g.fillStyle = hot; g.beginPath(); g.arc(p.x, p.y, r * (0.45 + 0.55 * i / this.trail.length) * (1 + heat * 0.25), 0, TAU); g.fill(); });
    if (heat > 0.05) { // the hotter, the brighter: glow halo, and flames at full charge
      const R2 = r * (1.5 + heat * 1.3), gr = g.createRadialGradient(x, y, r * 0.6, x, y, R2); gr.addColorStop(0, P.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.25 + heat * 0.55; g.fillStyle = gr; g.beginPath(); g.arc(x, y, R2, 0, TAU); g.fill();
      if (heat >= 0.999) for (let i = 0; i < 9; i++) { const a = this.t * 7 + i * 0.7, rr = r * (1.05 + 0.25 * Math.sin(this.t * 19 + i * 2)); g.globalAlpha = 0.9; g.fillStyle = i % 2 ? '#ffffff' : P.glow; g.beginPath(); g.moveTo(x + Math.cos(a - 0.22) * r, y + Math.sin(a - 0.22) * r); g.lineTo(x + Math.cos(a) * rr * 1.45, y + Math.sin(a) * rr * 1.45); g.lineTo(x + Math.cos(a + 0.22) * r, y + Math.sin(a + 0.22) * r); g.fill(); }
    }
    const [dx, dy, da] = S.light.shadow; g.globalAlpha = da; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 0.94, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = this._mat(g, hot, mix(P.ballDark, P.glow, heat * 0.5), '#ffffff', r); g.fill();
    g.save(); g.translate(x, y); g.rotate(lerpAngle(b.pa, b.body.angle, alpha)); g.strokeStyle = heat > 0.6 ? '#ffffff' : P.ballDark; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, r * 0.62, 0.3, 2.2); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.62, 3.44, 5.34); g.stroke(); g.restore();
    g.beginPath(); g.arc(x, y, r, 0, TAU); this._ink(g);
    if (S.light.spec) { g.fillStyle = `rgba(255,255,255,${0.55 * S.light.spec})`; g.beginPath(); g.ellipse(x - r * 0.34, y - r * 0.38, r * 0.26, r * 0.16, -0.6, 0, TAU); g.fill(); }
    if (b.magnetBy) { const c = b.magnetBy.body.position; g.strokeStyle = P.accent; g.lineWidth = 5; g.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 30); g.setLineDash([8, 8]); g.beginPath(); g.arc(x, y, r + 9, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(x, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  }

  _car(g, game, c, alpha, players) {
    const S = this.style, P = S.pal, x = lerp(c.px, c.body.position.x, alpha), y = lerp(c.py, c.body.position.y, alpha), a = lerpAngle(c.pa, c.body.angle, alpha), L = c.cls.len, Wd = c.cls.wid, heavy = c.clsName === 'heavy';
    const cow = c.cowT > 0, flat = c.flatT > 0, base = P.team[c.team], dark = P.teamDark[c.team], lite = P.teamLite[c.team], rr = Math.max(L, Wd) * 0.6, [dx, dy, da] = S.light.shadow;
    if (c.pitT > 0) { const age = game.world.ticks - c.pitAt.tick; if (age < 24) { g.save(); g.translate(c.pitAt.x, c.pitAt.y); g.rotate(age * 0.4); const q = 1 - age / 24; g.scale(q, q); g.beginPath(); g.roundRect(-L / 2, -Wd / 2, L, Wd, 16); g.fillStyle = base; g.fill(); this._ink(g); g.restore(); } if (Math.floor(this.t * 10) % 2) return; }
    g.save(); g.translate(x, y);
    if (c.windup > 0) { const p = 1 - c.windup / this.cfg.items.shock.windup; g.strokeStyle = P.accent; g.lineWidth = 8; g.globalAlpha = 0.4 + p * 0.5; g.beginPath(); g.arc(0, 0, 40 + p * 70, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    g.globalAlpha = da; g.fillStyle = '#000'; g.save(); g.rotate(-this.rot); g.translate(flat ? 0 : dx, flat ? 0 : dy); g.rotate(this.rot + a); g.beginPath(); g.roundRect(-L / 2, -Wd / 2, L, Wd, 12); g.fill(); g.restore(); g.globalAlpha = 1;
    g.rotate(a); const sc = flat ? 1.22 : cow ? 1.12 : 1; g.scale(sc, sc);
    if (c.turboOn) { g.fillStyle = P.turbo; g.beginPath(); const f = 20 + Math.random() * 18; g.moveTo(-L / 2, -Wd * 0.28); g.lineTo(-L / 2 - f, 0); g.lineTo(-L / 2, Wd * 0.28); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-L / 2, -Wd * 0.14); g.lineTo(-L / 2 - f * 0.5, 0); g.lineTo(-L / 2, Wd * 0.14); g.fill(); }
    if (c.drafting) { g.strokeStyle = P.turbo; g.lineWidth = 4; g.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 14); for (const q of [16, 30]) { g.beginPath(); g.moveTo(L / 2 + q, -10); g.lineTo(L / 2 + q + 9, 0); g.lineTo(L / 2 + q, 10); g.stroke(); } g.globalAlpha = 1; }
    if (c.shuntT > 0) { g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.globalAlpha = 0.8; for (const q of [-0.3, 0, 0.3]) { g.beginPath(); g.moveTo(L * q, -c.shuntDir * (Wd / 2 + 8)); g.lineTo(L * q, -c.shuntDir * (Wd / 2 + 34)); g.stroke(); } g.globalAlpha = 1; }
    // A bumper car from above: fat rubber skirt, domed shell, headlights, driver, and the pole at the back that sparks.
    const skirtR = Math.min(Wd / 2, heavy ? 22 : 24);
    g.beginPath(); g.roundRect(-L / 2, -Wd / 2, L, Wd, skirtR); g.fillStyle = this._mat(g, P.skirt || '#2b2e3b', '#0e0f15', '#7c8296', rr, a); g.fill(); this._ink(g);                   // rubber skirt
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(-L / 2 + 3.5, -Wd / 2 + 3.5, L - 7, Wd - 7, skirtR - 3); g.stroke();                              // chrome rub strip
    g.beginPath(); if (heavy) g.roundRect(-L / 2 + 8, -Wd / 2 + 8, L - 16, Wd - 16, 13); else { g.moveTo(L / 2 - 9, 0); g.quadraticCurveTo(L / 2 - 10, -Wd / 2 + 8, L * 0.1, -Wd / 2 + 8); g.lineTo(-L / 2 + 16, -Wd / 2 + 8); g.quadraticCurveTo(-L / 2 + 8, -Wd / 2 + 8, -L / 2 + 8, 0); g.quadraticCurveTo(-L / 2 + 8, Wd / 2 - 8, -L / 2 + 16, Wd / 2 - 8); g.lineTo(L * 0.1, Wd / 2 - 8); g.quadraticCurveTo(L / 2 - 10, Wd / 2 - 8, L / 2 - 9, 0); }
    g.fillStyle = flat ? dark : this._mat(g, base, dark, lite, rr, a); g.fill(); this._ink(g, Math.min(3.5, S.outline));                                                                // shell
    if (heavy) { g.fillStyle = dark; g.beginPath(); g.roundRect(L * 0.12, -Wd / 2 + 13, L * 0.26, Wd - 26, 6); g.fill(); g.fillStyle = P.skirt || '#2b2e3b'; g.fillRect(L / 2 - 7, -Wd * 0.3, 7, Wd * 0.6); } // bonnet + bull bar
    else { g.strokeStyle = lite; g.lineWidth = 4; g.beginPath(); g.moveTo(-L * 0.3, 0); g.lineTo(L * 0.34, 0); g.stroke(); }                                                             // racing stripe
    for (const s of [-1, 1]) { g.beginPath(); g.arc(L / 2 - (heavy ? 15 : 17), s * Wd * (heavy ? 0.27 : 0.2), heavy ? 6 : 5, 0, TAU); g.fillStyle = '#fff7c2'; g.fill(); this._ink(g, Math.min(2, S.outline)); } // headlights
    g.beginPath(); g.ellipse(-L * 0.1, 0, L * 0.2, Wd * 0.27, 0, 0, TAU); g.fillStyle = '#12131a'; g.fill();                                                                           // cockpit
    g.beginPath(); g.arc(-L * 0.08, 0, Wd * 0.17, 0, TAU); g.fillStyle = this._mat(g, '#f4f4f8', '#9aa0b2', '#ffffff', Wd * 0.17, a); g.fill(); this._ink(g, Math.min(2.5, S.outline)); // helmet
    g.fillStyle = base; g.fillRect(-L * 0.08 - Wd * 0.17, -2.5, Wd * 0.34, 5);
    if (S.light.spec) { g.fillStyle = `rgba(255,255,255,${0.5 * S.light.spec})`; g.beginPath(); g.ellipse(L * 0.2, -Wd * 0.2, L * 0.13, Wd * 0.06, -0.3, 0, TAU); g.fill(); }                 // shine
    g.beginPath(); g.arc(-L / 2 + 13, 0, 4.5, 0, TAU); g.fillStyle = '#c9ced9'; g.fill();                                                                                               // pole foot
    if (cow) { g.beginPath(); g.moveTo(L / 2 + 22, 0); g.lineTo(L / 2 - 2, -Wd / 2 - 6); g.lineTo(L / 2 - 2, Wd / 2 + 6); g.closePath(); g.fillStyle = this._mat(g, P.accent, P.ballDark, '#ffffff', 30, a); g.fill(); this._ink(g); }
    if (c.magnetT > 0) { g.strokeStyle = P.accent; g.lineWidth = 6; g.beginPath(); g.arc(L / 2 + 4, 0, Wd * 0.42, -1.2, 1.2); g.stroke(); }
    g.scale(1 / sc, 1 / sc); g.rotate(-a);
    if (c.spinT > 0) for (let i = 0; i < 3; i++) { const q = this.t * 9 + i * 2.1; this._star(g, Math.cos(q) * (L * 0.62), Math.sin(q) * (L * 0.62), 9, P.accent); }
    const up = this.rot ? [1, 0] : [0, -1]; // "up" on screen, in world axes
    if (!flat) { const bx = -Math.cos(a) * (L / 2 - 13), by = -Math.sin(a) * (L / 2 - 13), tx = bx + up[0] * 30 - Math.cos(a) * 8, ty = by + up[1] * 30 - Math.sin(a) * 8; // the pole, leaning back, with its contact spark
      g.strokeStyle = P.ink; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = '#d7dce6'; g.lineWidth = 2.5; g.stroke(); g.lineCap = 'butt';
      const sp = Math.abs(c.throttle) > 0.1 || c.turboOn; if (sp && Math.sin(this.t * 40 + c.index * 2) > -0.2) this._star(g, tx, ty, c.turboOn ? 10 : 6.5, c.turboOn ? P.turbo : '#fff7c2'); }
    if (c.item) { g.save(); g.translate(up[0] * (L * 0.5 + 14) - up[1] * 22, up[1] * (L * 0.5 + 14) + up[0] * 22); g.rotate(-this.rot); this._item(g, c.item, 0, 0, 11, P.accent, true); g.restore(); }
    const tag = players[c.index]; // P1 / P2 marker above human cars
    if (tag) { g.save(); g.translate(up[0] * (L * 0.5 + 26), up[1] * (L * 0.5 + 26)); g.rotate(-this.rot); g.fillStyle = P.text; g.strokeStyle = P.ink; g.lineWidth = 5; g.lineJoin = 'round'; g.font = this._font(26); g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(tag, 0, 0); g.fillText(tag, 0, 0); g.beginPath(); g.moveTo(-8, 15); g.lineTo(8, 15); g.lineTo(0, 25); g.closePath(); g.stroke(); g.fill(); g.restore(); }
    g.restore();
  }
  _star(g, x, y, r, color) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, q = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fillStyle = color; g.fill(); this._ink(g, Math.min(2.5, this.style.outline)); }
  /** Power-up icons are drawn, not typed: magnet = horseshoe, shock = rings, cow = plough wedge, oil = drop. */
  _item(g, item, x, y, s, color, chip) {
    const P = this.style.pal; g.save(); g.translate(x, y);
    if (chip) { g.beginPath(); g.arc(0, 0, s * 1.5, 0, TAU); g.fillStyle = P.ink; g.fill(); }
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * 0.42; g.lineCap = 'butt';
    if (item === 'magnet') { g.beginPath(); g.arc(0, s * 0.1, s * 0.62, Math.PI, 0, true); g.moveTo(-s * 0.62, s * 0.1); g.lineTo(-s * 0.62, -s * 0.8); g.moveTo(s * 0.62, s * 0.1); g.lineTo(s * 0.62, -s * 0.8); g.stroke(); }
    else if (item === 'shock') { g.lineWidth = s * 0.24; for (const q of [0.35, 0.7, 1.05]) { g.beginPath(); g.arc(0, 0, s * q, 0, TAU); g.stroke(); } }
    else if (item === 'cow') { g.beginPath(); g.moveTo(0, -s); g.lineTo(s, s * 0.8); g.lineTo(-s, s * 0.8); g.closePath(); g.fill(); }
    else if (item === 'oil') { g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 1.1, s * 0.3, 0, s); g.quadraticCurveTo(-s * 1.1, s * 0.3, 0, -s); g.fill(); }
    else if (item === 'harpoon') { g.lineWidth = s * 0.28; g.beginPath(); g.moveTo(-s * 0.9, s * 0.9); g.lineTo(s * 0.5, -s * 0.5); g.stroke(); g.beginPath(); g.moveTo(s, -s); g.lineTo(s * 0.9, 0); g.lineTo(0, -s * 0.9); g.closePath(); g.fill(); }
    g.restore();
  }
  _fx(g, dt) {
    const S = this.style, k = dt * HZ, big = S.post.pixel ? 9 : 6;
    for (const s of this.sparks) { s.x += s.vx * k; s.y += s.vy * k; s.vx *= 0.9; s.vy *= 0.9; s.life -= dt * 3; g.globalAlpha = Math.max(0, s.life); g.fillStyle = s.c; g.fillRect(s.x - big / 2, s.y - big / 2, big, big); }
    for (const r of this.rings) { r.life -= dt * 2.6; const q = 1 - Math.max(0, r.life), rad = r.r + (r.max - r.r) * q; g.globalAlpha = Math.max(0, r.life);
      if (r.star && S.deco === 'burst') this._star(g, r.x, r.y, rad, '#ffffff'); else { g.strokeStyle = r.c; g.lineWidth = r.w || 5; g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.stroke(); } }
    for (const p of this.pops) { p.life -= dt * 1.1; p.y -= dt * 40; g.save(); g.translate(p.x, p.y); g.rotate(-this.rot); g.globalAlpha = Math.min(1, p.life * 2); g.font = this._font(34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.lineJoin = 'round'; g.strokeStyle = S.pal.ink; g.strokeText(p.text, 0, 0); g.fillStyle = p.c; g.fillText(p.text, 0, 0); g.restore(); }
    g.globalAlpha = 1; this.sparks = this.sparks.filter((s) => s.life > 0); this.rings = this.rings.filter((r) => r.life > 0); this.pops = this.pops.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------------------- HUD
  // Always-on HUD is icons and numbers only: score chips, clock, turbo meter, held item, shunt-ready chevrons.
  _hud(g, game, hud, dt) {
    const S = this.style, P = S.pal, U = S.ui, w = this.w, mid = w / 2, rad = U.radius;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.fillStyle = U.panel; g.beginPath(); g.roundRect(mid - 150, 6, 300, 38, rad); g.fill();
    for (const [team, x] of [[0, mid - 108], [1, mid + 108]]) { g.fillStyle = P.team[team]; g.beginPath(); g.roundRect(x - 34, 10, 68, 30, Math.max(0, rad - 4)); g.fill(); g.fillStyle = '#ffffff'; g.font = this._font(24); g.fillText(String(game.score[team]), x, 26); }
    const s = game.secondsLeft; g.font = this._font(22); g.fillStyle = game.overtime ? P.accent : s <= 10 && game.state === 'play' ? '#ff8a8a' : U.panelText;
    g.fillText(game.overtime ? '+ OT' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, mid, 26);
    const car = hud.car;
    if (car) {
      const bw = Math.min(220, w * 0.4), bx = mid - bw / 2 + 12, by = this.touchLayout ? 56 : this.h - 22;
      g.fillStyle = U.panel; g.beginPath(); g.roundRect(bx - 34, by - 13, bw + 44, 26, Math.min(rad, 12)); g.fill();
      g.fillStyle = car.drafting ? '#ffffff' : P.turbo; g.beginPath(); g.moveTo(bx - 16, by - 9); g.lineTo(bx - 25, by + 2); g.lineTo(bx - 19, by + 2); g.lineTo(bx - 22, by + 9); g.lineTo(bx - 11, by - 3); g.lineTo(bx - 17, by - 3); g.closePath(); g.fill(); // bolt
      g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.roundRect(bx, by - 6, bw - 6, 12, Math.min(rad, 6)); g.fill();
      g.fillStyle = car.turbo < this.cfg.turbo.minStart && !car.turboOn ? '#64748b' : P.turbo; g.beginPath(); g.roundRect(bx, by - 6, Math.max(8, (bw - 6) * car.turbo), 12, Math.min(rad, 6)); g.fill();
      if (car.drafting) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 14); g.beginPath(); g.roundRect(bx - 34, by - 13, bw + 44, 26, Math.min(rad, 12)); g.stroke(); g.globalAlpha = 1; }
      for (const dir of [-1, 1]) { // shunt-ready chevrons either side of the meter
        const x = dir < 0 ? bx - 56 : bx + bw + 32; g.strokeStyle = car.shuntCd === 0 ? P.text : 'rgba(255,255,255,.25)'; g.lineWidth = 5; g.lineCap = 'round';
        for (const q of [0, 9]) { g.beginPath(); g.moveTo(x - dir * (5 - q), by - 8); g.lineTo(x + dir * (3 + q), by); g.lineTo(x - dir * (5 - q), by + 8); g.stroke(); } g.lineCap = 'butt';
      }
      const ix = bx + bw + 74, held = car.item; // held power-up slot
      g.fillStyle = U.panel; g.beginPath(); g.roundRect(ix - 19, by - 19, 38, 38, Math.min(rad, 10)); g.fill();
      if (held) { g.strokeStyle = P.accent; g.lineWidth = 2.5; g.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 8); g.beginPath(); g.roundRect(ix - 19, by - 19, 38, 38, Math.min(rad, 10)); g.stroke(); g.globalAlpha = 1; this._item(g, held, ix, by, 11, P.accent); }
      else { g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(ix, by, 4, 0, TAU); g.fill(); }
    }
    if (this.zoomed && game.state !== 'over') this._radar(g, game);
    // transient banners (not always-on): countdown, goal, result
    const big = (text, y, px, fill, x = mid) => { g.font = this._font(px); g.lineWidth = Math.max(6, px * 0.14); g.strokeStyle = U.stroke; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y); };
    const cyb = this.cy, unit = Math.min(w, this.h * 1.2);
    if (game.state === 'kickoff' || game.state === 'faceoff') big(String(Math.ceil(game.timer / HZ)), cyb - unit * 0.12, unit * 0.2, P.text);
    else if (game.state === 'play' && hud.goT > 0) { g.globalAlpha = Math.min(1, hud.goT * 2); big('GO', cyb - unit * 0.12, unit * 0.2, P.accent); g.globalAlpha = 1; }
    else if (game.state === 'goal' && game.lastGoal) { // goal banner: a team-colour band slides across with the scorer's name
      const L = game.lastGoal; this.banner = Math.min(1, (this.banner || 0) + dt * 4); const e = 1 - Math.pow(1 - this.banner, 3), bh = unit * 0.3, x0 = -w + e * w;
      g.save(); g.translate(x0, 0); g.fillStyle = U.stroke; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(0, cyb - bh / 2 - 8); g.lineTo(w + 40, cyb - bh / 2 - 8); g.lineTo(w, cyb + bh / 2 + 8); g.lineTo(-40, cyb + bh / 2 + 8); g.fill();
      g.globalAlpha = 1; g.fillStyle = P.team[L.team]; g.beginPath(); g.moveTo(0, cyb - bh / 2); g.lineTo(w + 30, cyb - bh / 2); g.lineTo(w, cyb + bh / 2); g.lineTo(-30, cyb + bh / 2); g.fill(); g.restore();
      big('GOAL!', cyb - unit * 0.035, unit * 0.15, '#ffffff'); big(L.ownGoal ? `OWN GOAL · ${L.name}` : L.name, cyb + unit * 0.085, unit * 0.05, P.accent);
    } else if (game.state === 'over') this._result(g, game, hud, big, unit);
  }
  _radar(g, game) { // when the camera is in close on a big arena: the whole place at a glance
    const A = game.arena, P = this.style.pal, U = this.style.ui, rw = Math.min(150, this.w * 0.26), s = rw / (A.w + 2 * A.netDepth), rh = A.h * s, x0 = this.touchLayout ? 8 : 8, y0 = this.touchLayout ? 52 : 52;
    g.fillStyle = U.panel; g.beginPath(); g.roundRect(x0, y0, rw + 12, rh + 12, Math.min(U.radius, 10)); g.fill();
    const X = (x) => x0 + 6 + (x + A.netDepth) * s, Y = (y) => y0 + 6 + y * s; g.beginPath(); A.poly.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill();
    for (const G of A.goals) { g.fillStyle = P.team[G.team]; g.fillRect(X(Math.min(G.x, G.x + G.dir * A.netDepth)), Y(G.y - G.half), A.netDepth * s, G.half * 2 * s); }
    for (const c of game.cars) { g.fillStyle = P.team[c.team]; g.beginPath(); g.arc(X(c.body.position.x), Y(c.body.position.y), c.index === 0 ? 4.5 : 3.2, 0, TAU); g.fill(); if (c.index === 0) { g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.stroke(); } }
    const b = game.ball.body.position; g.fillStyle = P.ball; g.beginPath(); g.arc(X(b.x), Y(b.y), 4, 0, TAU); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1; g.stroke();
  }
  // Victory screen with match stats: shots, shunts, spin-outs, top speed.
  _result(g, game, hud, big, unit) {
    const S = this.style, P = S.pal, U = S.ui, w = this.w, mid = w / 2, st = game.stats, top = this.h * 0.16;
    g.fillStyle = U.page; g.fillRect(0, 0, w, this.h);
    big(hud.resultTitle || (game.winner === null ? 'DRAW' : `${['RED', 'BLUE'][game.winner]} WINS`), top, unit * 0.1, game.winner === null ? P.text : P.team[game.winner]);
    big(`${game.score[0]} – ${game.score[1]}`, top + unit * 0.11, unit * 0.09, P.text);
    const rows = [['shots', st.shots], ['shunts', st.shunts], ['spin', st.spinOuts], ['speed', st.topSpeed.map((v) => Math.round(v * 6.2))]], rh = Math.min(46, this.h * 0.07), y0 = top + unit * 0.2, col = Math.min(120, w * 0.24);
    rows.forEach(([icon, vals], i) => {
      const y = y0 + i * rh; g.fillStyle = U.panel; g.beginPath(); g.roundRect(mid - col - 50, y - rh * 0.42, col * 2 + 100, rh * 0.84, Math.min(U.radius, 10)); g.fill();
      this._statIcon(g, icon, mid, y, rh * 0.3, P.accent);
      g.font = this._font(rh * 0.56); g.fillStyle = P.team[0]; g.fillText(String(vals[0]), mid - col, y + 1); g.fillStyle = P.team[1]; g.fillText(String(vals[1]), mid + col, y + 1);
    });
    if (hud.resultSub) big(hud.resultSub, y0 + rows.length * rh + unit * 0.02, unit * 0.04, P.accent);
    g.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4); big('▶', Math.min(this.h - 40, y0 + rows.length * rh + unit * 0.1), unit * 0.07, P.accent); g.globalAlpha = 1;
  }
  _statIcon(g, icon, x, y, s, color) {
    g.save(); g.translate(x, y); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * 0.3; g.lineCap = 'round'; g.lineJoin = 'round';
    if (icon === 'shots') { g.beginPath(); g.arc(0, 0, s, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.35, 0, TAU); g.fill(); }                                                    // target
    else if (icon === 'shunts') { for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * s * 0.2, 0); g.lineTo(d * s * 1.1, 0); g.moveTo(d * s * 0.6, -s * 0.5); g.lineTo(d * s * 1.1, 0); g.lineTo(d * s * 0.6, s * 0.5); g.stroke(); } } // <- ->
    else if (icon === 'spin') { g.beginPath(); g.arc(0, 0, s * 0.85, 0.6, TAU - 0.3); g.stroke(); g.beginPath(); g.moveTo(s * 1.25, -s * 0.5); g.lineTo(s * 0.8, s * 0.1); g.lineTo(s * 0.3, -s * 0.5); g.fill(); }                 // loop arrow
    else { g.beginPath(); g.arc(0, s * 0.4, s, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(0, s * 0.4); g.lineTo(s * 0.6, -s * 0.35); g.stroke(); }                                        // speedometer
    g.restore();
  }
}

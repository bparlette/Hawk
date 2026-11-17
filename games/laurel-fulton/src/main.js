// main.js — Laurel/Fulton sample boot: load the real road graph, the roster, the fleet; drive Brad's Camaro
// from Ledo Pizza on Palm City's touch controls (floating stick left half, keyboard arrows/WASD; hold F = turbo).
//   ?cam=x,y[,zoom]  static camera (captures)      ?spawn=x,y,heading   start elsewhere      ?model=<fleet id>
import { GraphWorld } from './world_graph.js';
import { LFSim } from './lf_sim.js';
import { GroundPainter, CHUNK } from './lf_ground.js';
import { Renderer } from './lf_render.js';
import { Input } from '../../palm-city/src/input.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const VIEW_W = 420, view = { w: VIEW_W, h: 860 };
let DPR = 1, renderer = null;
function resize() {
  const iw = innerWidth, ih = innerHeight;
  view.h = Math.round(Math.max(640, Math.min(1000, VIEW_W * ih / iw)));
  const sc = Math.min(iw / VIEW_W, ih / view.h);
  DPR = Q.has('dpr') ? Number(Q.get('dpr')) : Math.min(2, Math.max(1, (devicePixelRatio || 1) * sc));
  canvas.width = Math.round(VIEW_W * DPR); canvas.height = Math.round(view.h * DPR);
  canvas.style.width = Math.round(VIEW_W * sc) + 'px'; canvas.style.height = Math.round(view.h * sc) + 'px';
  if (renderer) renderer.resize(VIEW_W, view.h, DPR);
}
addEventListener('resize', resize); resize();
const msg = (t) => { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#1b1430'; ctx.fillRect(0, 0, VIEW_W, view.h); ctx.fillStyle = '#ffe4b0'; ctx.font = '800 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(t, VIEW_W / 2, view.h / 2); };
msg('LAUREL / FULTON — loading the real roads…');
const j = async (f) => { const r = await fetch(f); if (!r.ok) throw new Error(f + ' failed to load (' + r.status + ')'); return r.json(); };
const [G, roster, fleet] = await Promise.all([j('data/graph.json'), j('data/roster.json'), j('assets/fleet.json')]);
const files = new Set(); for (const m of Object.values(fleet)) for (const k of ['color', 'shadow', 'light']) files.add(m[k].file);
const imgs = {};
await Promise.all([...files].map(async (f) => { const im = new Image(); im.src = 'assets/' + f; try { await im.decode(); } catch (e) { throw new Error('sprite failed to decode: assets/' + f); } imgs[f] = im; }));
const W = new GraphWorld(G), ground = new GroundPainter(W);
const opts = {};
if (Q.get('spawn')) { const [x, y, h] = Q.get('spawn').split(',').map(Number); opts.spawn = { x, y }; opts.h = h || 0; }
if (Q.get('model')) opts.model = Q.get('model');
const sim = new LFSim(W, roster, fleet, opts);
if (!opts.spawn) {                                       // Ledo Pizza: face out of the lot, toward the way to Brad's
  const r = W.route(G.anchors.ledo.v, G.anchors.brad.v);
  if (r && r.pts.length > 3) sim.player.h = Math.atan2(r.pts[3][1] - r.pts[0][1], r.pts[3][0] - r.pts[0][0]);
}
renderer = new Renderer(ctx, W, ground, fleet, imgs); renderer.resize(VIEW_W, view.h, DPR);
const input = new Input(canvas, view); input.fightOn = true;
const fixed = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
const cam = { x: fixed ? fixed[0] : sim.player.x, y: fixed ? fixed[1] : sim.player.y, zoom: fixed && fixed[2] ? fixed[2] : 1 };
for (let cy = -2; cy <= 2; cy++) for (let cx = -1; cx <= 1; cx++) ground.get(Math.floor(cam.x / CHUNK) + cx, Math.floor(cam.y / CHUNK) + cy);
ground.stats.sync = 0;
const STEP = 1 / 60; let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
  let n = 0;
  while (acc >= STEP && n < 6) { sim.step(STEP, input.read()); acc -= STEP; n++; }
  if (n === 6) acc = 0;
  const c = sim.player;
  let tx = c.x + Math.cos(c.h) * c.v * 0.42, ty = c.y + Math.sin(c.h) * c.v * 0.42, tz = 1 - Math.min(0.16, Math.abs(c.v) / 290 * 0.16);   // Palm City's chase framing
  if (fixed) { tx = fixed[0]; ty = fixed[1]; tz = fixed[2] || 1; }
  const k = fixed ? 1 : 1 - Math.exp(-dt * 3.2);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * (fixed ? 1 : 1 - Math.exp(-dt * 1.5));
  renderer.draw(sim, cam, now / 1000);
  // HUD: the real street under you + speed (≤ 15% of the screen)
  const r = W.roadInfo(c.x, c.y, c.layer), name = r.e && r.d < r.hw + 30 ? (r.e.name || r.e.ref || '') : '';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = 'center';
  if (name) { ctx.font = '800 15px system-ui'; const w = ctx.measureText(name).width + 28; ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - w / 2, 18, w, 30, 15); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText(name, VIEW_W / 2, 38); }
  ctx.font = '800 13px system-ui'; ctx.fillStyle = 'rgba(255,240,215,0.9)'; ctx.fillText(Math.round(Math.abs(c.v) / 10 * 2.237) + ' mph', VIEW_W / 2, 64);
  // prefetch: the view + a margin + where the car will be in ~1.2 s, nearest first
  const hw = VIEW_W / 2 / cam.zoom + 320, hh = view.h / 2 / cam.zoom + 320, want = [];
  for (const [px, py] of [[cam.x, cam.y], [c.x + Math.cos(c.h) * c.v * 1.2, c.y + Math.sin(c.h) * c.v * 1.2]])
    for (let cy = Math.floor((py - hh) / CHUNK); cy <= Math.floor((py + hh) / CHUNK); cy++) for (let cx = Math.floor((px - hw) / CHUNK); cx <= Math.floor((px + hw) / CHUNK); cx++) want.push([cx, cy, (cx * CHUNK - cam.x) ** 2 + (cy * CHUNK - cam.y) ** 2]);
  want.sort((a, b) => a[2] - b[2]); ground.request(want.slice(0, 60)); ground.work(Math.min(12, Math.max(3, dt * 120)));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__lf = { sim, W, ground, cam, input, renderer };

// main.js — Laurel/Fulton sample boot: load the real road graph, the roster, the fleet; drive Brad's Camaro
// from Ledo Pizza on Palm City's touch controls (floating stick left half, keyboard arrows/WASD; hold F = turbo).
//   ?cam=x,y[,zoom]  static camera (captures)      ?spawn=x,y,heading   start elsewhere      ?model=<fleet id>
import { GraphWorld } from './world_graph.js';
import { LFSim } from './lf_sim.js';
import { GroundPainter, CHUNK } from './lf_ground.js';
import { Renderer } from './lf_render.js';
import { Input } from '../../palm-city/src/input.js';
import { Areas, poly } from './lf_areas.js';

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
const [G, roster, fleet, AJ] = await Promise.all([j('data/graph.json'), j('data/roster.json'), j('assets/fleet.json'), j('data/areas.json')]);
const files = new Set(); for (const m of Object.values(fleet)) for (const k of ['color', 'shadow', 'light']) files.add(m[k].file);
const imgs = {};
await Promise.all([...files].map(async (f) => { const im = new Image(); im.src = 'assets/' + f; try { await im.decode(); } catch (e) { throw new Error('sprite failed to decode: assets/' + f); } imgs[f] = im; }));
const W = new GraphWorld(G), areas = new Areas(AJ, W), ground = new GroundPainter(W, 64, areas);
const opts = {};
if (Q.get('spawn')) { const [x, y, h] = Q.get('spawn').split(',').map(Number); opts.spawn = { x, y }; opts.h = h || 0; }
if (Q.get('model')) opts.model = Q.get('model');
const sim = new LFSim(W, roster, fleet, opts);
if (!opts.spawn) {                                       // Ledo Pizza: face out of the lot, toward the way to Brad's
  const r = W.route(G.anchors.ledo.v, G.anchors.brad.v);
  if (r && r.pts.length > 3) sim.player.h = Math.atan2(r.pts[3][1] - r.pts[0][1], r.pts[3][0] - r.pts[0][0]);
}
renderer = new Renderer(ctx, W, ground, fleet, imgs, areas); renderer.resize(VIEW_W, view.h, DPR);
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
// ---- task L10: the whole-area MAP (M key, or the MAP pill top-right): every real road, the footprints, the
// crew's homes and the POIs labelled "corner of X & Y", you as a live arrow. Painted once, then just blitted.
let mapOpen = Q.has('map');
addEventListener('keydown', e => { if (e.code === 'KeyM') mapOpen = !mapOpen; });
canvas.addEventListener('pointerdown', e => { const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * VIEW_W / b.width, y = (e.clientY - b.top) * view.h / b.height; if (x > VIEW_W - 76 && y > 12 && y < 46) { mapOpen = !mapOpen; e.stopPropagation(); } }, { capture: true });
let mapCv = null, mapK = 0, mapO = [0, 0];
function buildMap() {
  const B = W.bounds, pad = 40, cw = 840, k = Math.min((cw - pad * 2) / (B.x1 - B.x0), (cw * 1.33 - pad * 2) / (B.y1 - B.y0));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = Math.round(cw * 1.33); const g = cv.getContext('2d');
  mapK = k; mapO = [pad - B.x0 * k, pad - B.y0 * k];
  g.fillStyle = '#e9dfc9'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(k, 0, 0, k, mapO[0], mapO[1]);
  g.fillStyle = 'rgba(110,150,90,0.35)'; for (const f of AJ.green) { poly(g, f); g.fill(); }
  g.fillStyle = 'rgba(120,104,110,0.35)'; for (const f of AJ.buildings) { poly(g, f); g.fill(); }
  const COL = { motorway: '#e0794a', trunk: '#e8924e', primary: '#efb35a', secondary: '#f2cf72', tertiary: '#f5f0dc' };
  for (const pass of [0, 1]) for (const e of W.edges) {
    if (e.hw === 'service') continue; const base = e.hw.replace('_link', '');
    g.strokeStyle = pass ? (COL[base] || '#ffffff') : '#7b6a6e';
    g.lineWidth = (pass ? 0.9 : 1.9) / k * (base === 'residential' || base === 'unclassified' ? 1 : 2);
    g.beginPath(); e.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const h of areas.heroes) {                        // the hero labels: who + the corner
    const x = h.cx * k + mapO[0], y = h.cy * k + mapO[1];
    g.fillStyle = h.kind === 'poi' ? '#e0a040' : '#d9583a'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.lineWidth = 2; g.strokeStyle = '#2a1430'; g.stroke();
    g.font = '800 15px system-ui'; g.textAlign = 'left'; g.fillStyle = '#2a1430'; g.fillText(h.who, x + 10, y - 2);
    g.font = '600 12px system-ui'; g.fillStyle = '#5a3c58'; g.fillText(h.corner, x + 10, y + 13);
  }
  return cv;
}
function drawMap(c) {
  if (!mapCv) mapCv = buildMap();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(20,12,32,0.8)'; ctx.fillRect(0, 0, VIEW_W, view.h);
  const s = Math.min((VIEW_W - 16) / mapCv.width, (view.h - 90) / mapCv.height), w = mapCv.width * s, h = mapCv.height * s, x0 = (VIEW_W - w) / 2, y0 = 60;
  ctx.drawImage(mapCv, x0, y0, w, h);
  const px = x0 + (c.x * mapK + mapO[0]) * s, py = y0 + (c.y * mapK + mapO[1]) * s;
  ctx.save(); ctx.translate(px, py); ctx.rotate(c.h); ctx.fillStyle = '#20a0ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 6); ctx.lineTo(-4, 0); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.font = '800 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4b0'; ctx.fillText('LAUREL / FULTON — tap MAP to close', VIEW_W / 2, 40);
}
const _draw = renderer.draw.bind(renderer);
renderer.draw = (S, cam, t) => {
  _draw(S, cam, t);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(27,20,48,0.72)'; ctx.beginPath(); ctx.roundRect(VIEW_W - 72, 14, 60, 28, 12); ctx.fill(); ctx.fillStyle = '#ffe4b0'; ctx.fillText('MAP', VIEW_W - 42, 33);
  if (mapOpen) drawMap(S.player);
};
requestAnimationFrame(frame);
window.__lf = { sim, W, ground, cam, input, renderer, areas, map: () => mapOpen };

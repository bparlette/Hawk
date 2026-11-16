// main.js — boot, view sizing, fixed-step loop, camera, ?demo autopilot.
//   ?demo        auto-plays a ~30 s route (jack a car, ride the loop past the ocean, get chased, busted)
//   ?t=0.6       pin time of day (0 golden hour .. 1 blue dusk)
//   ?cam=x,y     static camera (screenshots)
import { World } from './world.js';
import { GroundPainter, CHUNK } from './ground.js';
import { loadAssets } from './assets.js';
import { Renderer } from './render.js';
import { Sim } from './sim.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { drawHud } from './hud.js';
import { DemoPilot } from './demo.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const VIEW_W = 420;
const view = { w: VIEW_W, h: 860 };
let DPR = 1;
// Dynamic resolution (perf pass): the backing store is capped at 2x and steps down a rung when frame
// time stays high, back up when it stays low. ?dpr=N pins it (captures, tests).
const RUNGS = [1, 0.8, 0.65, 0.5];
let rung = 0, maxDPR = 1, slowT = 0, fastT = 0, ftEma = 16.7;
const pinDPR = Q.has('dpr') ? Number(Q.get('dpr')) : null;

function resize() {
  const iw = innerWidth, ih = innerHeight;
  view.h = Math.round(Math.max(640, Math.min(1000, VIEW_W * ih / iw)));
  const scale = Math.min(iw / VIEW_W, ih / view.h);
  maxDPR = pinDPR || Math.min(2, Math.max(1, (devicePixelRatio || 1) * scale));
  DPR = Math.max(1, maxDPR * RUNGS[rung]);
  canvas.width = Math.round(VIEW_W * DPR);
  canvas.height = Math.round(view.h * DPR);
  canvas.style.width = Math.round(VIEW_W * scale) + 'px';
  canvas.style.height = Math.round(view.h * scale) + 'px';
  if (renderer) renderer.resize(VIEW_W, view.h, DPR);
}
let renderer = null;
addEventListener('resize', resize);
resize();

// loading screen
function loading(p) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const gr = ctx.createLinearGradient(0, 0, 0, view.h);
  gr.addColorStop(0, '#ffb070'); gr.addColorStop(0.5, '#e0607a'); gr.addColorStop(1, '#3a2a6a');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VIEW_W, view.h);
  ctx.fillStyle = '#fff1d8';
  ctx.font = '900 46px "Avenir Next", Futura, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PALM CITY', VIEW_W / 2, view.h * 0.42);
  ctx.fillStyle = 'rgba(255,241,216,0.3)'; ctx.fillRect(110, view.h * 0.5, 200, 6);
  ctx.fillStyle = '#fff1d8'; ctx.fillRect(110, view.h * 0.5, 200 * p, 6);
}
loading(0);

const layout = await (await fetch('layout.json')).json();
const world = new World(layout);
const ground = new GroundPainter(world);
const M = await loadAssets(p => loading(p * 0.8));
renderer = new Renderer(ctx, world, ground, M);
renderer.resize(VIEW_W, view.h, DPR);
if (Q.has('prof')) { renderer.prof = {}; window.__prof = renderer.prof; }

const input = new Input(canvas, view);
const audio = new Audio();
input.onFirst = () => audio.start();
if (DEMO) { try { audio.start(); } catch (_) {} }

let sim, pilot, simTime = 0;
function newRun() {
  sim = new Sim(world, M, 7, (name, v) => audio.play(name, v));
  pilot = DEMO ? new DemoPilot(sim, world) : null;
  simTime = 0;
}
newRun();

const cam = { x: sim.player.ped.x, y: sim.player.ped.y, zoom: 1 };
const fixedCam = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
const fixedT = Q.has('t') ? Number(Q.get('t')) : null;

// prewarm ground chunks around the start so the first frames don't hitch
for (let cy = -2; cy <= 2; cy++) for (let cx = -1; cx <= 1; cx++) {
  const gx = Math.floor(cam.x / CHUNK) + cx, gy = Math.floor(cam.y / CHUNK) + cy;
  if (gx >= 0 && gy >= 0 && gx < ground.cols && gy < ground.rows) ground.get(gx, gy);
}
ground.stats.sync = 0;   // the prewarm happens behind the loader; count only in-play hitches
loading(1);

function timeOfDay() {
  if (fixedT !== null) return fixedT;
  if (DEMO) return 0.12 + 0.83 * Math.min(1, simTime / 27);
  return Math.min(0.97, 0.18 + simTime / 200);  // ~3 minutes from golden hour into blue dusk, then holds
}

// Ground streaming (perf pass): every frame, wish for the chunks around the view (plus a margin) and
// around a lead point ~1.2 s ahead along the player's velocity, nearest-first, and let the painter
// spend ~3 ms of time-sliced work on them. A chunk is never painted whole inside one frame unless it
// is already on screen unpainted (ground.stats.sync counts those hitches).
const wish = [], wishD = [];
let lastFx = 0, lastFy = 0;
function addRing(x, y, hw, hh) {
  const c0 = Math.max(0, Math.floor((x - hw) / CHUNK)), c1 = Math.min(ground.cols - 1, Math.floor((x + hw) / CHUNK));
  const r0 = Math.max(0, Math.floor((y - hh) / CHUNK)), r1 = Math.min(ground.rows - 1, Math.floor((y + hh) / CHUNK));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    if (ground.has(cx, cy)) continue;
    const d = Math.hypot((cx + 0.5) * CHUNK - cam.x, (cy + 0.5) * CHUNK - cam.y);
    let i = 0; while (i < wish.length && (wish[i][0] !== cx || wish[i][1] !== cy)) i++;
    if (i < wish.length) { wishD[i] = Math.min(wishD[i], d); continue; }
    wish.push([cx, cy]); wishD.push(d);
  }
}
function prefetch(dt) {
  const f = sim.focus();
  const vx = dt > 0 ? (f.x - lastFx) / dt : 0, vy = dt > 0 ? (f.y - lastFy) / dt : 0;
  lastFx = f.x; lastFy = f.y;
  wish.length = 0; wishD.length = 0;
  const m = 320, hw = VIEW_W / 2 / cam.zoom, hh = view.h / 2 / cam.zoom;
  addRing(cam.x, cam.y, hw + m, hh + m);
  if (Math.hypot(vx, vy) < 900) addRing(cam.x + vx * 1.2, cam.y + vy * 1.2, hw + 64, hh + 64);
  if (wish.length) {
    const idx = wish.map((_, i) => i).sort((a, b) => wishD[a] - wishD[b]);
    ground.request(idx.map(i => wish[i]));
  } else ground.request(wish);
  // ~12% of the frame (3 ms at 60 fps, more on a slow device so streaming keeps pace with the car)
  ground.work(Math.min(12, Math.max(3, dt * 120)));
}

// Sustained > 24 ms frames (EMA) for 1.5 s: drop a rung. Sustained < 15 ms for 5 s: climb one.
function adaptResolution(dt) {
  if (pinDPR || titleT > 0) return;
  ftEma += (dt * 1000 - ftEma) * 0.1;
  if (ftEma > 24) { slowT += dt; fastT = 0; } else if (ftEma < 15) { fastT += dt; slowT = 0; } else { slowT = 0; fastT = 0; }
  let r = rung;
  if (slowT > 1.5 && rung < RUNGS.length - 1 && maxDPR * RUNGS[rung] > 1) r++;
  else if (fastT > 5 && rung > 0) r--;
  if (r !== rung) { rung = r; slowT = fastT = 0; ftEma = 16.7; resize(); }
}

// notch-safe HUD offset, in view units
const safeEl = document.getElementById('safe');
function safeTop() {
  const px = safeEl ? safeEl.getBoundingClientRect().height : 0;
  const r = canvas.getBoundingClientRect();
  return Math.max(0, px - r.top) * view.h / r.height;
}

const STEP = 1 / 60;
let acc = 0, last = performance.now(), titleT = 3.2;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 6) {
    input.fightOn = sim.player.mode === 'foot';
    const inp = pilot ? pilot.input(STEP) : input.read();
    sim.step(STEP, inp);
    simTime += STEP;
    acc -= STEP; steps++;
  }
  if (steps === 6) acc = 0;
  adaptResolution(dt);
  if (pilot && pilot.done) newRun();
  titleT -= dt;

  // camera: follow with lead in the direction of travel, ease out zoom at speed
  const f = sim.focus();
  let tx = f.x, ty = f.y, tz = 1;
  if (sim.player.mode === 'car') {
    const c = sim.player.car;
    tx += Math.cos(c.h) * c.v * 0.42; ty += Math.sin(c.h) * c.v * 0.42;
    tz = 1 - Math.min(0.16, Math.abs(c.v) / 290 * 0.16);
  }
  if (sim.player.mode === 'board') {
    const b = sim.board; tx += b.vx * 0.35; ty += b.vy * 0.35;
    tz = 1 - Math.min(0.1, Math.hypot(b.vx, b.vy) / 250 * 0.1);
  }
  if (fixedCam) { tx = fixedCam[0]; ty = fixedCam[1]; tz = fixedCam[2] || 1; }
  const k = fixedCam ? 1 : 1 - Math.exp(-dt * 3.2);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * (fixedCam ? 1 : 1 - Math.exp(-dt * 1.5));
  const hw = VIEW_W / 2 / cam.zoom, hh = view.h / 2 / cam.zoom;
  cam.x = Math.max(hw, Math.min(layout.world.w - hw, cam.x));
  cam.y = Math.max(hh, Math.min(layout.world.h - hh, cam.y));

  const t = timeOfDay();
  renderer.draw(sim, cam, t, simTime);
  drawHud(ctx, VIEW_W, view.h, DPR, sim, input, t, simTime, { title: titleT, demo: DEMO, hintStick: !DEMO && simTime < 8, safeTop: safeTop() });
  audio.update(sim, cam, world);
  prefetch(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__palm = { world, ground, cam, dpr: () => DPR, get sim() { return sim; }, M };

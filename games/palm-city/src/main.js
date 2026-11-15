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

function resize() {
  const iw = innerWidth, ih = innerHeight;
  view.h = Math.round(Math.max(640, Math.min(1000, VIEW_W * ih / iw)));
  const scale = Math.min(iw / VIEW_W, ih / view.h);
  DPR = Math.min(2, Math.max(1, (devicePixelRatio || 1) * scale));
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
loading(1);

function timeOfDay() {
  if (fixedT !== null) return fixedT;
  if (DEMO) return 0.12 + 0.83 * Math.min(1, simTime / 27);
  return Math.min(0.97, 0.18 + simTime / 200);  // ~3 minutes from golden hour into blue dusk, then holds
}

// paint at most one ground chunk per frame, ahead of the camera, so driving never hitches
function prefetch() {
  const m = 320, hw = VIEW_W / 2 / cam.zoom + m, hh = view.h / 2 / cam.zoom + m;
  const c0 = Math.max(0, Math.floor((cam.x - hw) / CHUNK)), c1 = Math.min(ground.cols - 1, Math.floor((cam.x + hw) / CHUNK));
  const r0 = Math.max(0, Math.floor((cam.y - hh) / CHUNK)), r1 = Math.min(ground.rows - 1, Math.floor((cam.y + hh) / CHUNK));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    if (!ground.has(cx, cy)) { ground.get(cx, cy); return; }
  }
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
    const inp = pilot ? pilot.input(STEP) : input.read();
    sim.step(STEP, inp);
    simTime += STEP;
    acc -= STEP; steps++;
  }
  if (steps === 6) acc = 0;
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
  if (fixedCam) { tx = fixedCam[0]; ty = fixedCam[1]; tz = fixedCam[2] || 1; }
  const k = fixedCam ? 1 : 1 - Math.exp(-dt * 3.2);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * (fixedCam ? 1 : 1 - Math.exp(-dt * 1.5));
  const hw = VIEW_W / 2 / cam.zoom, hh = view.h / 2 / cam.zoom;
  cam.x = Math.max(hw, Math.min(layout.world.w - hw, cam.x));
  cam.y = Math.max(hh, Math.min(layout.world.h - hh, cam.y));

  const t = timeOfDay();
  sim.marker = sim.player.mode === 'foot' ? sim.player.ped : null;
  renderer.draw(sim, cam, t, simTime);
  drawHud(ctx, VIEW_W, view.h, DPR, sim, input, t, simTime, { title: titleT, demo: DEMO, hintStick: !DEMO && simTime < 8, safeTop: safeTop() });
  audio.update(sim, cam, world);
  prefetch();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__palm = { world, ground, cam, get sim() { return sim; }, M };

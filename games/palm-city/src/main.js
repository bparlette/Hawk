// main.js — boot, view sizing, frame loop.
import { World } from './world.js';
import { GroundPainter, CHUNK, PX_PER_UNIT } from './ground.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const VIEW_W = 420;
let VIEW_H = 860, DPR = 1;

function resize() {
  const iw = innerWidth, ih = innerHeight;
  VIEW_H = Math.round(Math.max(640, Math.min(1000, VIEW_W * ih / iw)));
  const scale = Math.min(iw / VIEW_W, ih / VIEW_H);
  DPR = Math.min(2, (devicePixelRatio || 1) * scale);
  canvas.width = Math.round(VIEW_W * DPR);
  canvas.height = Math.round(VIEW_H * DPR);
  canvas.style.width = Math.round(VIEW_W * scale) + 'px';
  canvas.style.height = Math.round(VIEW_H * scale) + 'px';
}
addEventListener('resize', resize);
resize();

const layout = await (await fetch('layout.json')).json();
const world = new World(layout);
const ground = new GroundPainter(world);

const cam = { x: 900, y: 1100 };
if (Q.get('cam')) { const [x, y] = Q.get('cam').split(',').map(Number); cam.x = x; cam.y = y; }

function drawGround() {
  const x0 = cam.x - VIEW_W / 2, y0 = cam.y - VIEW_H / 2;
  const c0 = Math.max(0, Math.floor(x0 / CHUNK)), c1 = Math.min(ground.cols - 1, Math.floor((x0 + VIEW_W) / CHUNK));
  const r0 = Math.max(0, Math.floor(y0 / CHUNK)), r1 = Math.min(ground.rows - 1, Math.floor((y0 + VIEW_H) / CHUNK));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    ctx.drawImage(ground.get(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
  }
}

function frame() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#120c22';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(Math.round((VIEW_W / 2 - cam.x) * DPR) / DPR, Math.round((VIEW_H / 2 - cam.y) * DPR) / DPR);
  drawGround();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__palm = { world, ground, cam };

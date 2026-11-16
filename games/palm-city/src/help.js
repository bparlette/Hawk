// help.js — the HELP panel and the START PAGE. One panel, two dresses: both list every activity
// from the registry (activities.js helpRows) as icon + name + one line + a JUMP button, so a new
// player sees what the game offers and can be standing at any of it in one tap. The game is paused
// while either is up. Layout is a pure function so drawing and touch hit-testing can never drift.
import { helpRows } from './activities.js';

export const CONTROLS = [
  ['LEFT THUMB', 'drag to walk and steer'],
  ['BIG BUTTON', 'get in · get out · board · enter'],
  ['SMALL BUTTON', 'PUNCH on foot · TURBO in a car (hold)'],
  ['MAP', 'top right · ? pauses and shows this'],
];

// can the player be teleported right now? (not mid-siege, not while busted)
export const canJump = (sim) => sim.player.mode !== 'siege' && !sim.busted && !sim.siege;

export function helpLayout(vw, vh, n, mode, safeTop = 0) {
  const start = mode === 'start', x = 12, w = vw - 24;
  const head = start ? 132 : 46, foot = (start ? 0 : CONTROLS.length * 17 + 16) + 64;
  const top = safeTop + (start ? 20 : 54);
  const rowH = Math.max(40, Math.min(54, (vh - top - head - foot - 14) / n));
  const rows = [];
  for (let i = 0; i < n; i++) { const y = top + head + i * rowH; rows.push({ y, h: rowH, jump: { x: x + w - 76, y: y + rowH / 2 - 16, w: 64, h: 32 } }); }
  const endRows = top + head + n * rowH;
  const controlsY = endRows + 10;
  const btn = { x: x + 14, y: endRows + (start ? 12 : CONTROLS.length * 17 + 22), w: w - 28, h: 46 };
  return { start, panel: { x, y: top, w, h: btn.y + btn.h + 12 - top }, head, rows, controlsY, btn };
}

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

// what a tap on the open panel means: { type: 'jump', id } | { type: 'close' } | null (swallowed)
export function helpHit(p, vw, vh, sim, mode, safeTop = 0) {
  const rows = helpRows(sim), L = helpLayout(vw, vh, rows.length, mode, safeTop);
  if (inside(p, L.btn)) return { type: 'close' };
  if (canJump(sim)) for (let i = 0; i < rows.length; i++) if (rows[i].live() && inside(p, { x: L.rows[i].jump.x - 8, y: L.rows[i].y, w: L.rows[i].jump.w + 20, h: L.rows[i].h })) return { type: 'jump', id: rows[i].id };
  if (!L.start && !inside(p, L.panel)) return { type: 'close' };          // tap outside the HELP panel: back to the game
  return null;
}

function wrapText(g, text, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

export function drawHelp(g, vw, vh, dpr, sim, mode, safeTop, time) {
  const rows = helpRows(sim), L = helpLayout(vw, vh, rows.length, mode, safeTop), P = L.panel;
  const font = (px, w = 800) => `${w} ${px}px "Avenir Next", "Futura", "Trebuchet MS", system-ui, sans-serif`;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = L.start ? 'rgba(24,12,40,0.55)' : 'rgba(24,12,40,0.72)'; g.fillRect(0, 0, vw, vh);
  // the painted board
  g.fillStyle = 'rgba(33,15,46,0.4)'; g.beginPath(); g.roundRect(P.x + 3, P.y + 5, P.w, P.h, 16); g.fill();
  g.fillStyle = '#fff1d8'; g.beginPath(); g.roundRect(P.x, P.y, P.w, P.h, 16); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#210f2e'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (L.start) {
    g.font = font(50, 900); g.lineWidth = 8; g.strokeStyle = 'rgba(60,20,70,0.85)'; g.lineJoin = 'round';
    g.strokeText('PALM CITY', vw / 2, P.y + 52);
    const gr = g.createLinearGradient(0, P.y + 28, 0, P.y + 78);
    gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.5, '#ff9a5c'); gr.addColorStop(1, '#ff5c9a');
    g.fillStyle = gr; g.fillText('PALM CITY', vw / 2, P.y + 52);
    g.font = font(13, 700); g.fillStyle = '#5a3c58';
    g.fillText('walk · skate · jack a car · or JUMP straight into something', vw / 2, P.y + 98);
  } else {
    g.font = font(20, 900); g.fillStyle = '#210f2e'; g.fillText('WHAT TO DO', vw / 2, P.y + 24);
  }
  const jumpOK = canJump(sim);
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i], r = L.rows[i], live = a.live() && jumpOK;
    if (i % 2 === 0) { g.fillStyle = 'rgba(210,150,110,0.16)'; g.fillRect(P.x + 6, r.y, P.w - 12, r.h); }
    // icon: a colour disc with the kind's mark
    const ix = P.x + 30, iy = r.y + r.h / 2;
    g.fillStyle = a.color; g.beginPath(); g.arc(ix, iy, 13, 0, 7); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#210f2e'; g.stroke();
    g.fillStyle = '#210f2e'; g.font = font(14, 900);
    g.fillText(a.group === 'siege' ? '⌂' : a.group === 'event' ? '★' : '$', ix, iy + 1);
    // name + one line
    g.textAlign = 'left';
    g.font = font(15, 900); g.fillStyle = '#210f2e'; g.fillText(a.name, P.x + 52, r.y + (r.h > 46 ? 13 : 11));
    g.font = font(10.5, 600); g.fillStyle = '#5a3c58';
    const lines = a._lines || (a._lines = wrapText(g, a.how, P.w - 52 - 88));
    for (let k = 0; k < Math.min(2, lines.length); k++) g.fillText(lines[k], P.x + 52, r.y + (r.h > 46 ? 29 : 25) + k * 12);
    g.textAlign = 'center';
    // JUMP
    const j = r.jump;
    g.globalAlpha = live ? 1 : 0.35;
    g.fillStyle = '#210f2e'; g.beginPath(); g.roundRect(j.x, j.y, j.w, j.h, 9); g.fill();
    g.fillStyle = live ? '#ffd45c' : '#fff1d8'; g.font = font(13, 900); g.fillText(live ? 'JUMP ▸' : 'BUSY', j.x + j.w / 2, j.y + j.h / 2 + 1);
    g.globalAlpha = 1;
  }
  if (!L.start) {
    for (let i = 0; i < CONTROLS.length; i++) {
      const y = L.controlsY + 8 + i * 17;
      g.textAlign = 'left'; g.font = font(10.5, 900); g.fillStyle = '#210f2e'; g.fillText(CONTROLS[i][0], P.x + 18, y);
      g.font = font(10.5, 600); g.fillStyle = '#5a3c58'; g.fillText(CONTROLS[i][1], P.x + 118, y);
    }
    g.textAlign = 'center';
  }
  const b = L.btn, pulse = 0.5 + 0.5 * Math.sin(time * 3);
  g.fillStyle = L.start ? `rgb(255,${150 + pulse * 30 | 0},92)` : '#ffd45c'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 12); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#210f2e'; g.stroke();
  g.fillStyle = '#210f2e'; g.font = font(18, 900); g.fillText(L.start ? 'PLAY ▸' : 'BACK TO THE GAME', b.x + b.w / 2, b.y + b.h / 2 + 1);
  g.textBaseline = 'alphabetic';
}

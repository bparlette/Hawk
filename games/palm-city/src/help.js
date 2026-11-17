// help.js — the HELP panel and the START PAGE. One panel, two dresses: both list every activity
// from the registry (activities.js helpRows) as a TWO-COLUMN grid of compact tiles (owner,
// Nov 16: "two rows to fit all the options on the page") — icon + name + one line + a JUMP pill
// per tile, the whole tile tappable — so every activity fits on one phone screen with no
// scrolling and the PLAY button stays pinned at the bottom. The game is paused while either
// is up. Layout is a pure function so drawing and touch hit-testing can never drift.
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
  // TWO-COLUMN GRID of compact tiles. `rows` stays the name (drawing, hit-testing and the
  // checks all walk it) but each entry is now a tile: { x, y, w, h, jump }.
  const cols = 2, gap = 8, pad = 6;
  const rowsN = Math.max(1, Math.ceil(n / cols));
  const tileW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const avail = vh - top - head - foot - 14;
  const tileH = Math.max(52, Math.min(76, (avail - gap * (rowsN - 1)) / rowsN));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const tx = x + pad + (i % cols) * (tileW + gap), ty = top + head + ((i / cols) | 0) * (tileH + gap);
    rows.push({ x: tx, y: ty, w: tileW, h: tileH, jump: { x: tx + tileW - 58, y: ty + tileH - 26, w: 52, h: 21 } });
  }
  const endRows = top + head + (n ? rowsN * tileH + (rowsN - 1) * gap : 0);
  const controlsY = endRows + 10;
  const btn = { x: x + 14, y: endRows + (start ? 12 : CONTROLS.length * 17 + 22), w: w - 28, h: 46 };
  return { start, panel: { x, y: top, w, h: btn.y + btn.h + 12 - top }, head, rows, controlsY, btn };
}

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

// what a tap on the open panel means: { type: 'jump', id } | { type: 'close' } | null (swallowed)
export function helpHit(p, vw, vh, sim, mode, safeTop = 0) {
  const rows = helpRows(sim), L = helpLayout(vw, vh, rows.length, mode, safeTop);
  if (inside(p, L.btn)) return { type: 'close' };
  if (canJump(sim)) for (let i = 0; i < rows.length; i++) if (rows[i].live() && inside(p, L.rows[i])) return { type: 'jump', id: rows[i].id };   // the whole tile is the button
  if (!L.start && !inside(p, L.panel)) return { type: 'close' };          // tap outside the HELP panel: back to the game
  return null;
}

// one line, ellipsised to fit — the grid tiles carry a single line of how-to, never two
function oneLine(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
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
    // the tile
    g.fillStyle = i % 2 === 0 ? 'rgba(210,150,110,0.16)' : 'rgba(120,80,160,0.10)';
    g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 10); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(33,15,46,0.35)'; g.stroke();
    // icon: a colour disc with the kind's mark
    const ix = r.x + 17, iy = r.y + 16;
    g.fillStyle = a.color; g.beginPath(); g.arc(ix, iy, 10, 0, 7); g.fill();
    g.lineWidth = 2; g.strokeStyle = '#210f2e'; g.stroke();
    g.fillStyle = '#210f2e'; g.font = font(11, 900); g.textAlign = 'center';
    g.fillText(a.group === 'siege' ? '⌂' : a.group === 'event' ? '★' : '$', ix, iy + 1);
    // name + ONE line of how (on short tiles the line stops clear of the JUMP pill)
    g.textAlign = 'left';
    g.font = font(12, 900); g.fillStyle = '#210f2e';
    g.fillText(oneLine(g, a.name, r.w - 32), r.x + 32, r.y + 16);
    g.font = font(9, 600); g.fillStyle = '#5a3c58';
    g.fillText(oneLine(g, a.how, r.h < 62 ? r.w - 70 : r.w - 14), r.x + 7, r.y + 31);
    g.textAlign = 'center';
    // JUMP pill (the whole tile is tappable; the pill is the affordance)
    const j = r.jump;
    g.globalAlpha = live ? 1 : 0.35;
    g.fillStyle = '#210f2e'; g.beginPath(); g.roundRect(j.x, j.y, j.w, j.h, 8); g.fill();
    g.fillStyle = live ? '#ffd45c' : '#fff1d8'; g.font = font(11, 900); g.fillText(live ? 'JUMP ▸' : 'BUSY', j.x + j.w / 2, j.y + j.h / 2 + 1);
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

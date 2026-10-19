// BLOCK DROP — falling-blocks (Cat Arcade v2)
// A modern 10x18 well: SRS rotation + wall kicks, ghost piece, 3-piece preview, hold,
// soft/hard drop with a real slam (dust + shake + hit-stop), and line clears that escalate
// from a light pop (single) all the way to a full celebration (tetris = flash + slow-mo + banner).
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, chance, R, TAU,
  rr, circle, hexA, shadow, damp, fmt, shuffle, ease,
} from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'falling-blocks', title: 'BLOCK DROP', sub: 'CLEAR 20 LINES',
  hook: 'the well never stops filling', w: W, h: H, bg: '#05070f', style: 'toon',
  bloom: .95, ca: .38, vig: 1, scan: .18,
});
const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');

/* ------------------------------------------------------------------ layout */
const COLS = 10, ROWS = 18, CELL = 28;
const BX = 130, BY = 248, BW = COLS * CELL, BH = ROWS * CELL;
const GOAL = 20;              // lines to win
const HOLD_BOX = { x: 14, y: 258, w: 104, h: 84 };
const NEXT_BOX = { x: 422, w: 104, h: 86, y: 258, gap: 10 };

/* ------------------------------------------------------------------ pieces */
const COLORS = { I: '#35e0ff', J: '#4c7bff', L: '#ff9d3c', O: '#ffd23f', S: '#4ee06a', T: '#b96bff', Z: '#ff4d6d' };
const IDS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const BASE = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const rotCW = m => {
  const n = m.length, out = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[x][n - 1 - y] = m[y][x];
  return out;
};
const ROT = {};
for (const id of IDS) { const a = [BASE[id]]; for (let i = 1; i < 4; i++) a.push(rotCW(a[i - 1])); ROT[id] = a; }

// SRS wall-kick tables (already mirrored into screen space: +y is DOWN)
const KICK_JLSTZ = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const KICK_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

/* ------------------------------------------------------------------ tile art cache */
const TILE = {};
const TS = 3;                                // supersample factor so tiles stay crisp on retina
function tileFor(id) {
  if (TILE[id]) return TILE[id];
  const S = CELL * TS, col = COLORS[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const pad = S * .055, w = S - pad * 2, r = S * .19;
  const gd = c.createLinearGradient(0, pad, 0, pad + w);
  gd.addColorStop(0, shade(col, 1.42)); gd.addColorStop(.45, col); gd.addColorStop(1, shade(col, .58));
  rr(c, pad, pad, w, w, r); c.fillStyle = gd; c.fill();
  c.strokeStyle = shade(col, .3); c.lineWidth = S * .06; c.stroke();
  rr(c, pad + w * .13, pad + w * .11, w * .74, w * .3, r * .7);
  c.fillStyle = 'rgba(255,255,255,.36)'; c.fill();
  rr(c, pad + w * .16, pad + w * .77, w * .68, w * .1, r * .45);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
  TILE[id] = cv; return cv;
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = v => clamp(Math.round(v * k), 0, 255).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
};

/* ------------------------------------------------------------------ world state */
let board, queue, bag, cur, holdId, holdUsed;
let lines, level, score, clearRows, clearT, phase, winT, autoT, dropT, botT, botTarget;
let t, softHeld, dasDir, dasT, landFlash, musicOn, ui, clearPop;
const S_BASE = [], S_SIM = [];
for (let y = 0; y < ROWS; y++) { S_BASE.push(new Int8Array(COLS)); S_SIM.push(new Int8Array(COLS)); }

function nextFromBag() {
  if (!bag.length) bag = shuffle(IDS.slice());
  return bag.pop();
}

function resetWorld() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  bag = []; queue = [];
  for (let i = 0; i < 5; i++) queue.push(nextFromBag());
  holdId = null; holdUsed = false; cur = null;
  lines = 0; level = 1; score = 0;
  clearRows = []; clearT = 0; clearPop = 0; phase = 'play'; winT = 0;
  autoT = 0; dropT = 0; t = 0; botT = 0; botTarget = null;
  softHeld = false; dasDir = 0; dasT = 0; landFlash = 0;
  ui = { holdPop: 0, nextPop: 0, danger: 0, barPop: 0, scorePop: 0 };
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, lines: 0, level: 1, phase: 'play', prog: 0, stack: 0 };
  spawn();
}

const cellsOf = (id, rot, px, py) => {
  const m = ROT[id][rot], n = m.length, out = [];
  for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) if (m[cy][cx]) out.push([px + cx, py + cy]);
  return out;
};

function collide(px, py, rot, id) {
  const m = ROT[id || cur.id][rot], n = m.length;
  for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
    if (!m[cy][cx]) continue;
    const bx = px + cx, by = py + cy;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    if (by >= 0 && board[by][bx]) return true;
  }
  return false;
}

function spawn() {
  const id = queue.shift(); queue.push(nextFromBag());
  cur = { id, rot: 0, x: id === 'I' ? 3 : (id === 'O' ? 4 : 3), y: id === 'O' ? 0 : -1 };
  holdUsed = false; botTarget = null; dropT = 0;
  ui.nextPop = 1;
  g.tween(ui, 'nextPop', 0, .18);
  if (collide(cur.x, cur.y, cur.rot)) { die(); return; }
}

function move(dx) {
  if (!cur || phase !== 'play') return false;
  if (collide(cur.x + dx, cur.y, cur.rot)) return false;
  cur.x += dx;
  sfx('blip', { vol: .18, pitch: 1.4 });
  g.fx.emit('spark', BX + (cur.x + 2) * CELL, BY + (cur.y + 1.5) * CELL, { vx: -dx * 40, vy: 10, life: .16, size: 2.4, color: hexA(COLORS[cur.id], .8), g: 0 });
  return true;
}

function rotate(dir) {
  if (!cur || phase !== 'play') return false;
  const from = cur.rot, to = (from + dir + 4) % 4;
  const tbl = cur.id === 'O' ? [[0, 0]] : (cur.id === 'I' ? KICK_I : KICK_JLSTZ)[`${from}${to}`];
  for (const [kx, ky] of tbl) {
    if (!collide(cur.x + kx, cur.y + ky, to)) {
      cur.rot = to; cur.x += kx; cur.y += ky;
      sfx('click', { pitch: 1 + rnd(-.06, .12) });
      g.punch(.008); g.shake(.6);
      const [cx, cy] = pieceCenter();
      g.fx.emit('ring', cx, cy, { size: 6, life: .22, color: hexA(COLORS[cur.id], .55), r: 26 });
      return true;
    }
  }
  sfx('tick', { vol: .3, pitch: .8 });
  return false;
}

function pieceCenter() {
  const cs = cellsOf(cur.id, cur.rot, cur.x, cur.y);
  let sx = 0, sy = 0;
  for (const [x, y] of cs) { sx += x; sy += y; }
  return [BX + (sx / cs.length + .5) * CELL, BY + (sy / cs.length + .5) * CELL];
}

function softStep() {
  if (!cur || phase !== 'play') return;
  if (collide(cur.x, cur.y + 1, cur.rot)) { lock(); return; }
  cur.y++; dropT = 0; score += 1;
  if (Math.random() < 0) sfx('tick');
}

function hardDrop() {
  if (!cur || phase !== 'play') return;
  let d = 0;
  while (!collide(cur.x, cur.y + 1, cur.rot)) { cur.y++; d++; }
  const [cx, cy] = pieceCenter();
  const bottom = BY + (cur.y + 1.2) * CELL;
  if (d > 0) {
    // SLAM: dust, trail, shake, hit-stop — all scaled by how far it fell
    const k = clamp(d / 12, .25, 1);
    sfx('thud', { pitch: 1.25 - k * .35, vol: .45 + k * .4 });
    g.shake(3 + k * 10); g.punch(.02 + k * .05);
    g.hitstop(.012 + k * .04);
    g.fx.dust(cx, Math.min(bottom, BY + BH - 2), 5 + Math.round(k * 8), { color: hexA(COLORS[cur.id], .55), spread: 90 + k * 120, life: .30 });
    g.fx.emit('shard', cx, Math.min(bottom, BY + BH - 2), { size: 3, life: .28, color: COLORS[cur.id], n: 1 });
    for (let i = 0; i < 4; i++) {
      const rx = rnd(-CELL, CELL);
      g.fx.emit('glow', cx + rx, cy + rnd(-40, 40), { vy: 300, vx: 0, life: .16, size: 9, color: hexA(COLORS[cur.id], .5), add: true });
    }
    if (k > .6) g.popup('DROP!', cx, cy - 24, COLORS[cur.id], 20);
  }
  score += 2 * d;
  lock();
}

function doHold() {
  if (!cur || phase !== 'play' || holdUsed) { if (cur) { sfx('tick', { vol: .35, pitch: .7 }); g.shake(0); } return; }
  const id = cur.id;
  if (holdId) {
    const h = holdId; holdId = id;
    cur = { id: h, rot: 0, x: h === 'I' ? 3 : (h === 'O' ? 4 : 3), y: h === 'O' ? 0 : -1 };
  } else {
    holdId = id;
    const nx = queue.shift(); queue.push(nextFromBag());
    cur = { id: nx, rot: 0, x: nx === 'I' ? 3 : (nx === 'O' ? 4 : 3), y: nx === 'O' ? 0 : -1 };
  }
  holdUsed = true; botTarget = null; dropT = 0;
  sfx('unlock', { pitch: 1.1, vol: .7 });
  g.flash('#9fe4ff', .10); g.punch(.02); g.shake(2);
  ui.holdPop = 1; g.tween(ui, 'holdPop', 0, .25);
  g.fx.burst(W / 2 + 0, H * .5, 6, { kind: 'spark', color: hexA(COLORS[id], .8), speed: 130, life: .3, size: 2.4, g: 200 });
  if (collide(cur.x, cur.y, cur.rot)) die();
}

/* ------------------------------------------------------------------ locking + clears */
function lock() {
  const cs = cellsOf(cur.id, cur.rot, cur.x, cur.y);
  let above = true;
  for (const [x, y] of cs) {
    if (y >= 0) { board[y][x] = cur.id; above = false; }
  }
  for (const [x, y] of cs) {
    if (y < 0) continue;
    g.fx.emit('spark', BX + (x + .5) * CELL, BY + (y + 1) * CELL, { vx: rnd(-60, 60), vy: rnd(-40, 10), life: .18, size: 1.8, color: hexA(COLORS[cur.id], .6) });
  }
  const id = cur.id;
  cur = null;
  if (above) { die(); return; }
  const full = [];
  for (let y = 0; y < ROWS; y++) {
    let ok = true;
    for (let x = 0; x < COLS; x++) if (!board[y][x]) { ok = false; break; }
    if (ok) full.push(y);
  }
  if (full.length) startClear(full, id); else { spawn(); }
  updateStackState();
}

function startClear(rows, id) {
  clearRows = rows.slice();
  clearT = 0.30;
  const n = rows.length;
  const base = [0, 100, 300, 500, 800][n] || 1200;
  const mult = g.combo.n + 1;
  const pts = Math.round(base * level * (1 + (g.combo.n) * .35));
  score += pts;
  ui.scorePop = 1; g.tween(ui, 'scorePop', 0, .3);
  ui.barPop = 1; g.tween(ui, 'barPop', 0, .3);
  let cx = 0, cy = 0, cnt = 0;
  for (const r of rows) {
    for (let x = 0; x < COLS; x++) {
      cx += BX + (x + .5) * CELL; cy += BY + (r + .5) * CELL; cnt++;
      const col = COLORS[board[r][x]] || '#9fe4ff';
      // debris shards: real gravity + rotation
      for (let i = 0; i < 3; i++) {
        g.fx.emit('shard', BX + (x + .5) * CELL, BY + (r + .5) * CELL, {
          vx: rnd(-260, 260), vy: rnd(-320, -60), g: 900, life: rnd(.45, .8),
          size: rnd(3, 7), color: col, rot: rnd(0, TAU), vr: rnd(-12, 12), drag: .995,
        });
      }
      g.fx.emit('spark', BX + (x + .5) * CELL, BY + (r + .5) * CELL, { vx: rnd(-130, 130), vy: rnd(-160, 30), life: .3, size: 2.4, color: '#ffffff' });
    }
  }
  cx /= cnt; cy /= cnt;
  // escalating celebration
  if (n === 1) {
    sfx('pop', { pitch: 1 + (g.combo.n * .06) }); sfx('coin', { pitch: 1 + (g.combo.n * .06) });
    g.flash('#ffffff', .10); g.shake(4); g.punch(.02); g.hitstop(.03);
    g.fx.burst(cx, cy, 10, { kind: 'spark', color: '#ffffff', speed: 200, life: .32, size: 2.6, g: 420 });
  } else if (n === 2) {
    sfx('ding', { pitch: 1 + (g.combo.n * .05) }); sfx('pop', { pitch: 1.12 });
    g.flash('#a8f0ff', .18); g.shake(8); g.punch(.035); g.hitstop(.055);
    g.fx.burst(cx, cy, 16, { kind: 'spark', color: '#a8f0ff', speed: 260, life: .4, size: 2.8, g: 480 });
    g.popup('DOUBLE', cx, cy - 30, '#a8f0ff', 26);
  } else if (n === 3) {
    sfx('perfect', { pitch: 1 + (g.combo.n * .05) });
    g.flash('#ffe6a8', .28); g.shake(13); g.punch(.05); g.hitstop(.09);
    g.fx.blast(cx, cy, { r: 70, color: '#ffe6a8', colors: ['#ffe6a8', '#ff9d3c', '#ffffff'], n: 22, speed: 240, flashA: .18, punch: .03, shake: 5 });
    g.showBanner('TRIPLE!', 1.0);
    g.popup('TRIPLE', cx, cy - 34, '#ffe6a8', 30);
  } else {
    sfx('fanfare', { pitch: 1 + (g.combo.n * .04) }); sfx('boom', { vol: .5 });
    g.flash('#ffffff', .5); g.hitstop(.16); g.slowmo(.34, .55);
    g.shake(24); g.punch(.09);
    g.fx.blast(cx, cy, { r: 120, color: '#ffffff', colors: ['#ffffff', '#35e0ff', '#b96bff', '#ffd23f'], n: 40, speed: 320, flashA: .3, punch: .05, shake: 8 });
    g.fx.emit('ring', cx, cy, { r: 40, size: 8, life: .6, color: '#ffffff' });
    g.showBanner('TETRIS!!', 1.6);
    g.popup('TETRIS', cx, cy - 40, '#ffffff', 36);
  }
  // pitch-rising combo chain
  if (g.combo.n > 0) comboPitch(g.combo.n);
  g.combo.hit(cx, cy - 10, '+');
  g.score = score;
}

function finishClear() {
  const n = clearRows.length;
  for (const r of clearRows) board.splice(r, 1);
  for (let i = 0; i < n; i++) board.unshift(new Array(COLS).fill(null));
  clearRows = [];
  lines += n;
  level = 1 + Math.floor(lines / 4);
  g.state.lines = lines; g.state.level = level;
  if (lines >= GOAL) { startWin(); return; }
  if (lines === GOAL - 1) g.showBanner('ONE MORE!', 1.1);
  spawn();
  updateStackState();
}

function startWin() {
  phase = 'win'; winT = 1.25;
  sfx('fanfare'); sfx('win', { pitch: 1.1 });
  g.flash('#ffffff', .75); g.hitstop(.2); g.slowmo(.3, 1.2);
  g.punch(.1); g.shake(22);
  g.showBanner('WELL CLEARED!', 1.5);
  g.fx.blast(W / 2, BY + BH * .45, { r: 220, color: '#ffffff', colors: ['#35e0ff', '#ffd23f', '#4ee06a', '#ff4d6d', '#b96bff', '#ffffff'], n: 60, speed: 380, flashA: .35, punch: .06, shake: 10 });
  g.fx.emit('ring', W / 2, BY + BH * .45, { r: 30, size: 10, life: .8, color: '#ffffff' });
  g.fx.emit('ring', W / 2, BY + BH * .45, { r: 90, size: 6, life: 1.0, color: '#35e0ff' });
  for (let i = 0; i < 26; i++) {
    g.fx.emit('confetti', rnd(40, W - 40), rnd(-40, H * .4), { vx: rnd(-90, 90), vy: rnd(40, 200), g: 260, life: rnd(1.2, 2.2), size: rnd(5, 10), color: COLORS[IDS[ri(0, 6)]], rot: rnd(0, TAU), vr: rnd(-9, 9), drag: .995 });
  }
  g.state.phase = 'win';
}

function die() {
  if (phase === 'win' || phase === 'over') return;
  phase = 'over';
  sfx('lose', { vol: .8 }); sfx('boom', { vol: .6, pitch: .7 });
  g.flash('#ff3b5c', .35); g.shake(20); g.hitstop(.1);
  g.showBanner('WELL FULL', 1.2);
  g.fx.blast(W / 2, BY + BH * .7, { r: 130, color: '#ff3b5c', colors: ['#ff3b5c', '#ff9d3c', '#ffffff'], n: 26, speed: 260, flashA: .2, punch: .04, shake: 8 });
  g.end({ win: false, score: Math.round(score), label: 'SCORE', progress: clamp(lines / GOAL, 0, .96) });
}

function updateStackState() {
  let top = ROWS;
  for (let y = 0; y < ROWS; y++) {
    let any = false;
    for (let x = 0; x < COLS; x++) if (board[y][x]) { any = true; break; }
    if (any) { top = y; break; }
  }
  const stack = (ROWS - top) / ROWS;
  g.state.stack = +stack.toFixed(3);
  if (stack > .74) ui.danger = 1; else ui.danger = 0;
}

/* ------------------------------------------------------------------ input */
const btnView = [];
function readInput(dt) {
  btnView.length = 0;
  if (phase !== 'play') { g.btns.length = 0; return; }
  const B = [
    ['l', 14, 766, 118, 80, '\u25C0'],
    ['r', 140, 766, 118, 80, '\u25B6'],
    ['d', 266, 766, 118, 80, '\u25BD'],
    ['h', 392, 766, 134, 80, 'HOLD'],
    ['x', 14, 856, 250, 80, '\u21BB'],
    ['s', 272, 856, 254, 80, '\u2913 DROP'],
  ];
  const st = {};
  for (const [id, x, y, w, h, label] of B) {
    const b = g.btn(id, x, y, w, h, label);
    st[id] = b; btnView.push({ id, x, y, w, h, label, held: b.held });
  }
  g.btns.length = 0;                          // we draw our own art for the pads

  const holdLeft = st.l.held || g.keys.ArrowLeft || g.keys.a;
  const holdRight = st.r.held || g.keys.ArrowRight || g.keys.d;

  // DAS: one step instantly, then repeat
  if (holdLeft && !holdRight) {
    if (dasDir !== -1) { dasDir = -1; dasT = .15; move(-1); }
    else { dasT -= dt; if (dasT <= 0) { dasT = .055; move(-1); } }
  } else if (holdRight && !holdLeft) {
    if (dasDir !== 1) { dasDir = 1; dasT = .15; move(1); }
    else { dasT -= dt; if (dasT <= 0) { dasT = .055; move(1); } }
  } else dasDir = 0;

  if (st.x.pressed || g.pressed.ArrowUp || g.pressed.x || g.pressed.X) rotate(1);
  if (g.pressed.ArrowDown) softStep();
  if (g.pressed.z || g.pressed.Z) rotate(-1);
  if (st.s.pressed || g.pressed[' ']) hardDrop();
  if (st.h.pressed || g.pressed.c || g.pressed.C) doHold();
  softHeld = st.d.held || !!g.keys.ArrowDown;

  // tap on the well = rotate (mouse/touch players never need the pads)
  for (const p of g.taps) {
    if (p.x > BX && p.x < BX + BW && p.y > BY && p.y < BY + BH) rotate(1);
  }
}

/* ------------------------------------------------------------------ bot */
function bestPlacement() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
    S_BASE[y][x] = board[y][x] ? IDS.indexOf(board[y][x]) + 1 : 0;
  const idv = IDS.indexOf(cur.id) + 1;
  let best = null, bestScore = -1e9;
  for (let r = 0; r < 4; r++) {
    const m = ROT[cur.id][r], n = m.length;
    let minx = 9, maxx = -1;
    const rel = [];
    for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) if (m[cy][cx]) {
      minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); rel.push([cx, cy]);
    }
    if (maxx < 0) continue;
    for (let px = -minx; px <= COLS - 1 - maxx; px++) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) S_SIM[y][x] = S_BASE[y][x];
      // drop the whole shape together
      let dy = -3;
      for (;;) {
        let blocked = false;
        for (const [cx, cy] of rel) {
          const ny = dy + 1 + cy;
          if (ny >= ROWS || (ny >= 0 && S_SIM[ny][px + cx])) { blocked = true; break; }
        }
        if (blocked) break;
        dy++;
      }
      let ok = true;
      for (const [cx, cy] of rel) {
        const ny = dy + cy;
        if (ny < 0) { ok = false; break; }
        S_SIM[ny][px + cx] = idv;
      }
      if (!ok) continue;
      // features
      const h = new Array(COLS).fill(0);
      let holes = 0, agg = 0;
      for (let x = 0; x < COLS; x++) {
        let top = ROWS, seen = false;
        for (let y = 0; y < ROWS; y++) {
          if (S_SIM[y][x]) { if (top === ROWS) top = y; seen = true; }
          else if (seen) holes++;
        }
        h[x] = ROWS - top; agg += h[x];
      }
      let bump = 0;
      for (let x = 0; x < COLS - 1; x++) bump += Math.abs(h[x] - h[x + 1]);
      let cleared = 0;
      for (let y = 0; y < ROWS; y++) {
        let full = true;
        for (let x = 0; x < COLS; x++) if (!S_SIM[y][x]) { full = false; break; }
        if (full) cleared++;
      }
      const sc = -0.62 * agg + 0.90 * cleared - 0.94 * holes - 0.22 * bump;
      if (sc > bestScore) { bestScore = sc; best = { rot: r, x: px }; }
    }
  }
  return best || { rot: 0, x: 4 };
}

function botStep(dt) {
  if (phase !== 'play' || !cur) return;
  botT -= dt;
  if (botT > 0) return;
  const dumb = g.dumb();
  if (!botTarget) {
    botTarget = dumb ? { rot: ri(0, 3), x: ri(0, COLS - 1) } : bestPlacement();
    botT = dumb ? .05 : .03;
    return;
  }
  if (cur.rot !== botTarget.rot) {
    if (!rotate(1)) botTarget.rot = cur.rot;
    botT = .035; return;
  }
  if (cur.x !== botTarget.x) {
    const d = Math.sign(botTarget.x - cur.x);
    if (!move(d)) { botTarget = dumb ? { rot: ri(0, 3), x: ri(0, COLS - 1) } : bestPlacement(); botT = .05; return; }
    botT = .028; return;
  }
  hardDrop();
  botTarget = null;
  botT = dumb ? .04 : .02;
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (dt <= 0) return;
  t += dt;
  if (!musicOn) { musicOn = true; music('action'); }
  if (phase === 'play' || phase === 'win') autoT += dt;

  if (phase === 'win') {
    winT -= dt;
    if (Math.random() < dt * 14) {
      g.fx.emit('confetti', rnd(20, W - 20), -20, { vx: rnd(-120, 120), vy: rnd(60, 180), g: 200, life: rnd(1.4, 2.4), size: rnd(5, 11), color: COLORS[IDS[ri(0, 6)]], rot: rnd(0, TAU), vr: rnd(-10, 10), drag: .996 });
    }
    if (winT <= 0) g.end({ win: true, score: Math.round(score), label: 'SCORE', progress: 1 });
    return;
  }
  if (phase === 'over') return;

  readInput(dt);
  if (isAuto) botStep(dt);

  if (clearT > 0) {
    clearT -= dt;
    if (clearT <= 0) finishClear();
    g.state.score = score;
    return;
  }
  if (!cur) { spawn(); return; }

  // gravity: speed rises with level
  const interval = softHeld ? .045 : clamp(.85 - (level - 1) * .075, .075, .85);
  dropT += dt;
  while (dropT >= interval) {
    dropT -= interval;
    if (collide(cur.x, cur.y + 1, cur.rot)) { lock(); break; }
    cur.y++;
    if (Math.random() < .5) {
      g.fx.emit('spark', BX + (cur.x + 2) * CELL, BY + (cur.y + 2) * CELL, { vx: 0, vy: -20, life: .12, size: 1.6, color: hexA(COLORS[cur.id], .45) });
    }
  }
  if (cur) {
    // ghost
    let gy = cur.y;
    while (!collide(cur.x, gy + 1, cur.rot)) gy++;
    g.state.ghost = gy;
  }
  g.state.score = score;
  g.state.phase = phase;
  g.state.prog = +clamp(lines / GOAL, 0, 1).toFixed(3);
  g.state.piece = cur ? cur.id : '-';
  if (phase === 'play' && isAuto) {
    if (g.dumb() && autoT > 12) { die(); }
    else if (!g.dumb() && autoT > 34) g.end({ win: true, score: Math.round(score), label: 'SCORE', progress: 1 });
  }
}

/* ------------------------------------------------------------------ drawing */
let skyGrad = null, glowGrad = null;
const FAR = [], NEAR = [];
for (let i = 0; i < 18; i++) FAR.push({ x: R() * W, y: R() * H, s: rnd(26, 70), sp: rnd(3, 9), a: rnd(.015, .045), rot: rnd(0, TAU), id: IDS[ri(0, 6)] });
for (let i = 0; i < 10; i++) NEAR.push({ x: R() * W, y: R() * H, s: rnd(70, 130), sp: rnd(7, 16), a: rnd(.03, .07), rot: rnd(0, TAU), id: IDS[ri(0, 6)] });

function drawBackdrop(c) {
  if (!skyGrad) {
    skyGrad = c.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#05070f'); skyGrad.addColorStop(.42, '#0c1530');
    skyGrad.addColorStop(.74, '#160f33'); skyGrad.addColorStop(1, '#04060e');
    glowGrad = c.createRadialGradient(W / 2, BY + BH * .42, 20, W / 2, BY + BH * .42, 470);
    glowGrad.addColorStop(0, 'rgba(70,160,255,.22)'); glowGrad.addColorStop(.45, 'rgba(150,70,255,.13)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, H);
  c.fillStyle = glowGrad; c.fillRect(0, 0, W, H);

  // parallax: two slow layers of ghost blocks behind the well
  c.save();
  for (const l of FAR) {
    const y = (l.y + t * l.sp) % (H + 160) - 80;
    c.save(); c.translate(l.x, y); c.rotate(l.rot + t * .05);
    c.globalAlpha = l.a; c.fillStyle = COLORS[l.id];
    rr(c, -l.s / 2, -l.s / 2, l.s, l.s, l.s * .22); c.fill();
    c.restore();
  }
  for (const l of NEAR) {
    const y = (l.y - t * l.sp) % (H + 200) - 100;
    c.save(); c.translate(l.x, y); c.rotate(l.rot - t * .04);
    c.globalAlpha = l.a * .9; c.fillStyle = COLORS[l.id];
    rr(c, -l.s / 2, -l.s / 2, l.s, l.s, l.s * .24); c.fill();
    c.restore();
  }
  c.restore();
  c.globalAlpha = 1;
}

function drawWell(c) {
  // frame
  c.save();
  c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = 28; c.shadowOffsetY = 8;
  c.fillStyle = 'rgba(6,10,22,.94)';
  rr(c, BX - 9, BY - 9, BW + 18, BH + 18, 16); c.fill();
  c.restore();
  c.save();
  rr(c, BX - 9, BY - 9, BW + 18, BH + 18, 16);
  c.strokeStyle = ui.danger ? `rgba(255,80,110,${.45 + Math.sin(t * 9) * .25})` : 'rgba(120,210,255,.42)';
  c.lineWidth = 2.5; c.stroke();
  c.restore();
  // inner grid
  c.save();
  rr(c, BX, BY, BW, BH, 10); c.clip();
  c.strokeStyle = 'rgba(120,200,255,.055)'; c.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { c.beginPath(); c.moveTo(BX + x * CELL, BY); c.lineTo(BX + x * CELL, BY + BH); c.stroke(); }
  for (let y = 1; y < ROWS; y++) { c.beginPath(); c.moveTo(BX, BY + y * CELL); c.lineTo(BX + BW, BY + y * CELL); c.stroke(); }
  // danger zone haze
  const dz = c.createLinearGradient(0, BY, 0, BY + BH * .3);
  dz.addColorStop(0, `rgba(255,60,90,${.06 + (ui.danger ? .1 + Math.sin(t * 8) * .05 : 0)})`);
  dz.addColorStop(1, 'rgba(255,60,90,0)');
  c.fillStyle = dz; c.fillRect(BX, BY, BW, BH * .3);
  c.restore();

  // settled blocks
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const id = board[y][x];
    if (!id) continue;
    c.drawImage(tileFor(id), BX + x * CELL, BY + y * CELL, CELL, CELL);
  }

  // clear flash bands
  if (clearRows.length && clearT > 0) {
    const u = 1 - clearT / .3;
    for (const r of clearRows) {
      const y = BY + r * CELL;
      const k = Math.sin(u * Math.PI);
      c.save();
      c.globalAlpha = clamp(1 - u * .2, 0, 1) * (0.35 + k * .65);
      const lg = c.createLinearGradient(BX, 0, BX + BW, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, '#ffffff'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg;
      const shrink = (1 - k) * CELL * .5;
      c.fillRect(BX, y + shrink, BW, CELL - shrink * 2);
      c.restore();
    }
  }

  if (cur && phase === 'play' && clearT <= 0) {
    // ghost piece
    let gy = cur.y;
    while (!collide(cur.x, gy + 1, cur.rot)) gy++;
    c.save();
    c.globalAlpha = .22;
    for (const [x, y] of cellsOf(cur.id, cur.rot, cur.x, gy)) {
      if (y < 0) continue;
      c.fillStyle = COLORS[cur.id];
      rr(c, BX + x * CELL + 3, BY + y * CELL + 3, CELL - 6, CELL - 6, 6); c.fill();
    }
    c.globalAlpha = .55;
    c.strokeStyle = COLORS[cur.id]; c.lineWidth = 1.5;
    for (const [x, y] of cellsOf(cur.id, cur.rot, cur.x, gy)) {
      if (y < 0) continue;
      rr(c, BX + x * CELL + 3, BY + y * CELL + 3, CELL - 6, CELL - 6, 6); c.stroke();
    }
    c.restore();
    // live piece
    for (const [x, y] of cellsOf(cur.id, cur.rot, cur.x, cur.y)) {
      if (y < 0) continue;
      c.drawImage(tileFor(cur.id), BX + x * CELL, BY + y * CELL, CELL, CELL);
    }
  }
  // inner vignette on the well
  c.save();
  rr(c, BX, BY, BW, BH, 10); c.clip();
  const vg = c.createLinearGradient(0, BY, 0, BY + BH);
  vg.addColorStop(0, 'rgba(0,0,0,.42)'); vg.addColorStop(.22, 'rgba(0,0,0,0)');
  vg.addColorStop(.82, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)');
  c.fillStyle = vg; c.fillRect(BX, BY, BW, BH);
  c.restore();
}

function drawMini(c, id, cx, cy, s) {
  const m = ROT[id][0], n = m.length;
  let minx = 9, maxx = -1, miny = 9, maxy = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) {
    minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
  }
  const w = (maxx - minx + 1) * s, h = (maxy - miny + 1) * s;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m[y][x]) continue;
    c.drawImage(tileFor(id), cx - w / 2 + (x - minx) * s, cy - h / 2 + (y - miny) * s, s, s);
  }
}

function panel(c, x, y, w, h, pop) {
  const k = 1 + pop * .06;
  c.save();
  c.translate(x + w / 2, y + h / 2); c.scale(k, k); c.translate(-w / 2, -h / 2);
  c.fillStyle = 'rgba(10,18,36,.82)';
  rr(c, 0, 0, w, h, 12); c.fill();
  c.strokeStyle = 'rgba(120,200,255,.28)'; c.lineWidth = 1.6;
  rr(c, 0, 0, w, h, 12); c.stroke();
  c.restore();
}

function drawHUD(c) {
  // top: score
  g.text('SCORE', 22, 42, { size: 19, color: '#7fd4ff', align: 'left' });
  const sc = Math.round(score);
  const pop = 1 + ui.scorePop * .1;
  c.save(); c.translate(22, 96); c.scale(pop, pop);
  g.text(fmt(sc), 0, 0, { size: 58, color: '#f2fbff', stroke: '#04070f', align: 'left', ink: '#04070f' });
  c.restore();
  // top right: goal
  g.text('LINES', W - 22, 42, { size: 19, color: '#7fd4ff', align: 'right' });
  g.text(`${lines}/${GOAL}`, W - 22, 96, { size: 44, color: lines >= GOAL - 3 ? '#ffd23f' : '#dfeaff', align: 'right', ink: '#04070f' });
  // progress bar
  const bx = 22, by = 138, bw = W - 44, bh = 16;
  c.fillStyle = 'rgba(255,255,255,.09)';
  rr(c, bx, by, bw, bh, 8); c.fill();
  const p = clamp(lines / GOAL, 0, 1);
  const lg = c.createLinearGradient(bx, 0, bx + bw, 0);
  lg.addColorStop(0, '#35e0ff'); lg.addColorStop(.6, '#8f6bff'); lg.addColorStop(1, '#ff4d6d');
  c.fillStyle = lg;
  rr(c, bx, by, Math.max(6, bw * p), bh, 8); c.fill();
  c.save();
  c.globalAlpha = .35 + ui.barPop * .65;
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.2;
  rr(c, bx, by, bw, bh, 8); c.stroke();
  c.restore();

  // hold box
  panel(c, HOLD_BOX.x, HOLD_BOX.y, HOLD_BOX.w, HOLD_BOX.h, ui.holdPop);
  g.text('HOLD', HOLD_BOX.x + HOLD_BOX.w / 2, HOLD_BOX.y - 12, { size: 16, color: '#7fd4ff', align: 'center' });
  if (holdId) {
    c.save();
    if (holdUsed) c.globalAlpha = .42;
    drawMini(c, holdId, HOLD_BOX.x + HOLD_BOX.w / 2, HOLD_BOX.y + HOLD_BOX.h / 2, CELL * .66);
    c.restore();
  }
  // level / lines stack
  g.text('LEVEL', HOLD_BOX.x, 372, { size: 16, color: '#7fd4ff', align: 'left' });
  g.text(String(level), HOLD_BOX.x, 412, { size: 44, color: '#ffd23f', align: 'left', ink: '#04070f' });
  g.text('SPEED', HOLD_BOX.x, 446, { size: 14, color: '#5f8fb8', align: 'left' });
  const sp = clamp((.85 - (level - 1) * .075) / .85, 0, 1);
  c.fillStyle = 'rgba(255,255,255,.1)';
  rr(c, HOLD_BOX.x, 456, HOLD_BOX.w, 8, 4); c.fill();
  c.fillStyle = '#4ee06a';
  rr(c, HOLD_BOX.x, 456, Math.max(4, HOLD_BOX.w * sp), 8, 4); c.fill();

  // next previews
  g.text('NEXT', NEXT_BOX.x + NEXT_BOX.w / 2, NEXT_BOX.y - 12, { size: 16, color: '#7fd4ff', align: 'center' });
  for (let i = 0; i < 3; i++) {
    const y = NEXT_BOX.y + i * (NEXT_BOX.h + NEXT_BOX.gap);
    const pop2 = i === 0 ? ui.nextPop : 0;
    panel(c, NEXT_BOX.x, y, NEXT_BOX.w, NEXT_BOX.h, pop2);
    const id = queue[i];
    if (id) {
      c.save();
      c.globalAlpha = i === 0 ? 1 : (i === 1 ? .78 : .55);
      drawMini(c, id, NEXT_BOX.x + NEXT_BOX.w / 2, y + NEXT_BOX.h / 2, CELL * (i === 0 ? .72 : .58));
      c.restore();
    }
  }

  // control pads
  for (const b of btnView) drawPad(c, b);
}

function drawPad(c, b) {
  const held = b.held;
  const k = held ? .96 : 1;
  c.save();
  c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(k, k); c.translate(-b.w / 2, -b.h / 2);
  const lg = c.createLinearGradient(0, 0, 0, b.h);
  lg.addColorStop(0, held ? 'rgba(90,200,255,.42)' : 'rgba(30,60,110,.62)');
  lg.addColorStop(1, held ? 'rgba(40,120,220,.5)' : 'rgba(12,26,52,.72)');
  c.fillStyle = lg;
  rr(c, 0, 0, b.w, b.h, 16); c.fill();
  c.strokeStyle = held ? 'rgba(160,240,255,.9)' : 'rgba(110,190,255,.35)';
  c.lineWidth = 2; rr(c, 0, 0, b.w, b.h, 16); c.stroke();
  c.restore();
  g.text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, {
    size: b.label.length > 2 ? 26 : 36, color: held ? '#ffffff' : '#cfe9ff', align: 'center',
  });
}

function draw(c) {
  drawBackdrop(c);
  drawWell(c);
  drawHUD(c);
  // floor glow
  const fg = c.createLinearGradient(0, 742, 0, 800);
  fg.addColorStop(0, 'rgba(90,170,255,.18)'); fg.addColorStop(1, 'rgba(90,170,255,0)');
  c.fillStyle = fg; c.fillRect(BX - 20, 742, BW + 40, 58);
  g.btns.length = 0;
}

/* ------------------------------------------------------------------ boot */
g.onReset = resetWorld;
g.onStart = () => music('action');
resetWorld();
window.__g = g;
g.run(update, draw);

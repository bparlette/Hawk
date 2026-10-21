// TRICK OR TREAT — Halloween reskin of grid-chaser (Cat Arcade v2)
// One maze, one mechanic: grab every candy. Three ghosts with real personalities, one scary costume that flips the fear.
import { makeGame, sfx, music, comboPitch, clamp, lerp, R, rnd, TAU, panel, hexA } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'trick-or-treat', title: 'TRICK OR TREAT', sub: 'SWIPE OR ARROWS TO TURN',
  hook: 'grab every candy before the ghosts grab you', w: W, h: H, bg: '#0d0618',
  bloom: .8, ca: .38, vig: 1, scan: .2,
});

/* ---------------------------------------------------------------- layout */
const TS = 36, COLS = 15, ROWS = 21, OX = 0, OY = 176;
const CW = (COLS - 1) >> 1, CH = (ROWS - 1) >> 1;      // 7 x 10 cells
const GOAL = 7, NPOW = 3;
const BW = COLS * TS, BH = ROWS * TS;
const isAuto = new URLSearchParams(location.search).has('auto');
const isDumb = new URLSearchParams(location.search).has('dumb'); // ?dumb=1: bot plays badly on purpose (quick test deaths)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PAL = {
  dot: '#ff9f1c', pow: '#c77dff', cat: '#ff8c42',
  chaser: '#f2f6ff', ambush: '#d0f0ff', flank: '#e8d5ff', fear: '#4a6bff',
};

/* ---------------------------------------------------------------- world */
let wall = [], pel = new Map(), pelLeft = 0, eaten = 0;
let hearts = 3, scared = 0, invuln = 0, tRun = 0, autoT = 0, botT = 0, chain = 0, noEatT = 0;
let pl, ghosts = [], mazeCv = null, botWant = [0, 0], botNote = '';
let trail = [];                                  // pixel history -> the snake body behind the head
const sqz = { v: 0 };                            // turn-anticipation squash (tweened)
let eatChain = 0, eatT = 9, tailT = 0, lastDx = 0, lastDy = 0;
const scorePop = { v: 0 };   // score counter punch (tweened, 1 = full pop)
const candyPop = { v: 0 };   // CANDY counter pop (tweened, 1 = full pop)

/* ---------------------------------------------------------------- maze */
const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !wall[y][x];

function genMaze() {
  wall = Array.from({ length: ROWS }, () => new Array(COLS).fill(1));
  const seen = new Set(['0,0']);
  const st = [[0, 0]];
  wall[1][1] = 0;
  while (st.length) {
    const [cx, cy] = st[st.length - 1];
    const nb = [];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && !seen.has(nx + ',' + ny)) nb.push([nx, ny, dx, dy]);
    }
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    seen.add(nx + ',' + ny);
    wall[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
    wall[ny * 2 + 1][nx * 2 + 1] = 0;
    st.push([nx, ny]);
  }
  // punch loops so no corridor is a death-trap dead end
  for (let i = 0; i < 30; i++) {
    const x = 1 + Math.floor(R() * (COLS - 2)), y = 1 + Math.floor(R() * (ROWS - 2));
    if (wall[y][x] && ((!wall[y][x - 1] && !wall[y][x + 1]) || (!wall[y - 1][x] && !wall[y + 1][x]))) wall[y][x] = 0;
  }
  // keep the border sealed
  for (let x = 0; x < COLS; x++) wall[0][x] = wall[ROWS - 1][x] = 1;
  for (let y = 0; y < ROWS; y++) wall[y][0] = wall[y][COLS - 1] = 1;
}

function bfsOrder(sx, sy) {
  const seen = new Uint8Array(COLS * ROWS), out = [], q = [sy * COLS + sx];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % COLS, y = (cur - x) / COLS;
    out.push([x, y]);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      const k = ny * COLS + nx;
      if (seen[k]) continue;
      seen[k] = 1; q.push(k);
    }
  }
  return out;
}

function placePellets() {
  pel.clear(); pelLeft = 0; eaten = 0;
  const order = bfsOrder(7, 19);
  const tail = order.slice(-7);
  const pow = [tail[tail.length - 1], tail[Math.floor(tail.length / 2)], tail[0]];
  for (const [x, y] of pow) pel.set(y * COLS + x, 2);
  const pool = order.filter(([x, y]) => !pel.has(y * COLS + x));
  const stepN = Math.max(1, Math.floor(pool.length / (GOAL + 4)));
  const dots = [];
  for (let i = pool.length - 1; i >= 2; i -= stepN) dots.push(pool[i]);
  while (dots.length > GOAL) dots.pop();
  for (const [x, y] of dots) pel.set(y * COLS + x, 1);
  pelLeft = pel.size;
}

/* ---------------------------------------------------------------- maze art (built once per board) */
function buildMazeArt() {
  const s = 2, cv = document.createElement('canvas');
  cv.width = BW * s; cv.height = BH * s;
  const c = cv.getContext('2d');
  c.scale(s, s);
  // floor
  const fg = c.createLinearGradient(0, 0, 0, BH);
  fg.addColorStop(0, '#140a26'); fg.addColorStop(.55, '#180e32'); fg.addColorStop(1, '#0c0618');
  c.fillStyle = fg; c.fillRect(0, 0, BW, BH);
  // floor weave on open tiles
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (wall[y][x]) continue;
    c.fillStyle = (x + y) % 2 ? 'rgba(160,90,230,.06)' : 'rgba(230,140,60,.05)';
    c.fillRect(x * TS, y * TS, TS, TS);
  }
  // wall mass
  const wg = c.createLinearGradient(0, 0, 0, BH);
  wg.addColorStop(0, '#2c1650'); wg.addColorStop(.5, '#201040'); wg.addColorStop(1, '#140a2c');
  c.fillStyle = wg;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (wall[y][x]) c.fillRect(x * TS - .5, y * TS - .5, TS + 1, TS + 1);
  // neon seams where wall meets corridor
  const seam = (x0, y0, x1, y1) => {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = 'rgba(255,140,40,.55)'; c.lineWidth = 7; c.stroke();
    c.strokeStyle = 'rgba(255,200,120,.95)'; c.lineWidth = 2.4; c.stroke();
  };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (wall[y][x]) continue;
    const X = x * TS, Y = y * TS;
    if (wall[y - 1]?.[x]) seam(X, Y + 1, X + TS, Y + 1);
    if (wall[y + 1]?.[x]) seam(X, Y + TS - 1, X + TS, Y + TS - 1);
    if (wall[y]?.[x - 1]) seam(X + 1, Y, X + 1, Y + TS);
    if (wall[y]?.[x + 1]) seam(X + TS - 1, Y, X + TS - 1, Y + TS);
  }
  // corner brackets on the board
  mazeCv = cv;
}

/* ---------------------------------------------------------------- entities */
function mkEnt(tx, ty, spd) { return { tx, ty, nx: tx, ny: ty, prog: 0, dx: 0, dy: 0, spd, want: [0, 0] }; }
const GHOST_DEF = [
  { kind: 0, color: PAL.chaser, home: [1, 1] },
  { kind: 1, color: PAL.ambush, home: [13, 1] },
  { kind: 2, color: PAL.flank, home: [7, 11] },
];

function spawnEntities() {
  pl.tx = 7; pl.ty = 19; pl.nx = 7; pl.ny = 19; pl.prog = 0; pl.dx = 0; pl.dy = 0;
  pl.want[0] = 0; pl.want[1] = 0;
  ghosts = GHOST_DEF.map((d, i) => {
    const q = mkEnt(d.home[0], d.home[1], 4.6);
    q.kind = d.kind; q.color = d.color; q.i = i; q.home = d.home;
    q.nx = q.tx; q.ny = q.ty;
    return q;
  });
}

const px = e => OX + (e.tx + (e.nx - e.tx) * e.prog) * TS + TS / 2;
const py = e => OY + (e.ty + (e.ny - e.ty) * e.prog) * TS + TS / 2;

function resetWorld() {
  genMaze();
  buildMazeArt();
  pl = mkEnt(7, 19, 10.4);
  hearts = 3; scared = 0; invuln = 1.2; tRun = 0; autoT = 0; botT = 0; chain = 0; noEatT = 0;
  trail.length = 0; hist.length = 0; eatChain = 0; eatT = 9; tailT = 0; lastDx = 0; lastDy = 0; sqz.v = 0;
  scorePop.v = 0; candyPop.v = 0;
  spawnEntities();
  placePellets();
  g.score = 0;
  g.combo.reset(); g.fx.clear();
  botNote = '';
  syncState();
  buildScenery();
}

function syncState() {
  g.state = { dots: pelLeft, hearts, scared: +scared.toFixed(2), score: g.score, t: +tRun.toFixed(2) };
}

/* ---------------------------------------------------------------- scenery */
/* three parallax depths behind the board: stars, skyline, drifting dust */
const parallax = { stars: [], far: [], dust: [] };
function buildScenery() {
  parallax.stars = Array.from({ length: 64 }, () => ({ x: R() * W, y: rnd(0, H * .46), r: rnd(.6, 2.1), ph: R() * TAU, sp: rnd(.4, 1.6) }));
  parallax.far = [];
  let x = -20;
  while (x < W + 40) {
    const w = rnd(30, 62), h = rnd(70, 210), wins = [];
    for (let wy = 10; wy < h - 8; wy += 16) for (let wx = 6; wx < w - 6; wx += 13) if (R() < .4) wins.push({ x: wx, y: wy, on: R() < .6, ph: R() * TAU });
    parallax.far.push({ x, w, h, wins });
    x += w + rnd(4, 14);
  }
  parallax.dust = Array.from({ length: 26 }, () => ({ x: R() * W, y: rnd(120, H), r: rnd(.8, 2.4), sp: rnd(6, 22), ph: R() * TAU }));
}

/* ---------------------------------------------------------------- movement */
function applyWant() {
  const w = pl.want;
  if (!(w[0] || w[1])) return;
  if ((pl.dx || pl.dy) && pl.prog > .04 && w[0] === -pl.dx && w[1] === -pl.dy) {
    const ox = pl.tx, oy = pl.ty;
    pl.tx = pl.nx; pl.ty = pl.ny; pl.nx = ox; pl.ny = oy; pl.prog = 1 - pl.prog;
    pl.dx = w[0]; pl.dy = w[1];
  }
}

function stepPlayer(dt) {
  pl.prog += pl.spd * dt;
  let guard = 0;
  while (pl.prog >= 1 && guard++ < 4) {
    pl.tx = pl.nx; pl.ty = pl.ny; pl.prog -= 1;
    eatAt(pl.tx, pl.ty);
    const w = pl.want;
    if ((w[0] || w[1]) && free(pl.tx + w[0], pl.ty + w[1])) { pl.dx = w[0]; pl.dy = w[1]; }
    if (!free(pl.tx + pl.dx, pl.ty + pl.dy)) { pl.dx = 0; pl.dy = 0; }
    pl.nx = pl.tx + pl.dx; pl.ny = pl.ty + pl.dy;
    if (!pl.dx && !pl.dy) { pl.prog = 0; break; }
  }
}

function stepGhost(q, dt) {
  q.prog += q.spd * dt;
  let guard = 0;
  while (q.prog >= 1 && guard++ < 4) {
    q.tx = q.nx; q.ty = q.ny; q.prog -= 1;
    if (!dirFor(q)) { q.dx = 0; q.dy = 0; q.nx = q.tx; q.ny = q.ty; q.prog = 0; break; }
    q.nx = q.tx + q.dx; q.ny = q.ty + q.dy;
  }
}

const gopts = [[0, 0], [0, 0], [0, 0], [0, 0]];
let goptsN = 0;
function dirFor(q) {
  goptsN = 0;
  for (const d of DIRS) {
    const nx = q.tx + d[0], ny = q.ty + d[1];
    if (!free(nx, ny)) continue;
    if (d[0] === -q.dx && d[1] === -q.dy && (q.dx || q.dy)) continue;
    gopts[goptsN][0] = d[0]; gopts[goptsN][1] = d[1]; goptsN++;
  }
  if (!goptsN) {
    if (!free(q.tx - q.dx, q.ty - q.dy)) return false;
    q.dx = -q.dx; q.dy = -q.dy; return true;
  }
  let best = 0, bestScore = -1e9;
  for (let i = 0; i < goptsN; i++) {
    const [dx, dy] = gopts[i];
    const nx = q.tx + dx, ny = q.ty + dy;
    let s;
    if (scared > 0) {
      s = Math.abs(nx - pl.tx) + Math.abs(ny - pl.ty);
    } else {
      const [tx, ty] = ghostTarget(q);
      s = -(Math.abs(nx - tx) + Math.abs(ny - ty));
      s += R() * .6;
    }
    if (s > bestScore) { bestScore = s; best = i; }
  }
  q.dx = gopts[best][0]; q.dy = gopts[best][1];
  return true;
}

function ghostTarget(q) {
  if (q.kind === 0) return [pl.tx, pl.ty];                     // chaser: you, right now
  if (q.kind === 1) return [pl.tx + pl.dx * 4, pl.ty + pl.dy * 4]; // ambusher: 4 tiles ahead
  // flanker: mirrored through you around the chaser (classic Inky)
  const r = ghosts[0];
  return [pl.tx * 2 - r.tx, pl.ty * 2 - r.ty];
}

/* ---------------------------------------------------------------- eating / death */
function eatAt(tx, ty) {
  const k = ty * COLS + tx, v = pel.get(k);
  if (!v) return;
  pel.delete(k); pelLeft--; eaten++; noEatT = 0;
  const x = OX + tx * TS + TS / 2, y = OY + ty * TS + TS / 2;
  if (v === 1) {
    /* quick eats chain: pitch climbs with every fast dot and the bloom swells with it */
    eatChain = eatT < .62 ? Math.min(14, eatChain + 1) : 1;
    eatT = 0;
    const chainBonus = eatChain >= 4 ? (eatChain - 3) * 2 : 0;
    g.score += 10 + chainBonus;
    sfx('coin', { pitch: comboPitch(eatChain), vol: .45 });
    if (eatChain >= 5) sfx('coinchain', { pitch: comboPitch(eatChain - 3), vol: .5 });
    g.fx.burst(x, y, 5 + Math.min(8, eatChain), { kind: 'spark', color: ['#ffe066', '#fff6c0', '#ffb347'], speed: 170 + eatChain * 12, life: .34, size: 5 });
    g.fx.ring(x, y, { r: 22 + eatChain * 2.4, color: '#ffe066', life: .3, wide: 2.5, ripple: false });
    g.burst(x, y, 3, { color: ['#ffe066', '#fff6c0'], speed: 150, up: 30, life: .32, size: 4, gravity: 280 });
    g.fx.emit('glow', x, y, { life: .22, size: 26 + eatChain * 2, color: '#ffd94a', add: true });
    g.punch(.02 + Math.min(.1, eatChain * .008));
    /* FULL-QUALITY: hit-stop on every candy grab — the single most impactful juice (3-6 frozen frames) */
    g.hitstop(.03 + Math.min(.03, eatChain * .004));
    /* score counter punch + CANDY counter pop */
    scorePop.v = 1; g.tween(scorePop, 'v', 0, .28, e => 1 - (1 - e) ** 2);
    candyPop.v = 1; g.tween(candyPop, 'v', 0, .32, e => 1 - (1 - e) ** 2);
    if (g.post) g.tween(g.post, 'bloom', Math.min(1.7, .8 + eatChain * .07), .4);
    if (eatChain >= 4) {
      g.popup('×' + eatChain, x + 16, y - 14, '#ffe98a', 20);
      if (eatChain % 4 === 0) { g.combo.hit(x, y - 30, '×' + eatChain); g.flash('#ffd94a', .1); }
    }
  } else {
    g.score += 50; scared = 7.4; chain = 0; eatChain = 0; eatT = 0;
    sfx('powerup'); sfx('zap', { pitch: 1.1, vol: .5 }); sfx('charge', { pitch: 1.2, vol: .4 });
    g.showBanner('FEAR FLIP!', .8);
    /* FULL-QUALITY, veto-safe: hit-stop + punch + flash, NO shake, NO ripple (Cherie veto Oct 20) */
    g.hitstop(.07); g.slowmo(.5, .18); g.punch(.22); g.flash('#6fe6ff', .4);
    g.fx.ring(x, y, { r: 96, color: '#8ce8ff', life: .38, wide: 7, ripple: false });
    g.fx.burst(x, y, 26, { color: ['#8ce8ff', '#fff', '#6fe6ff'], speed: 480, size: 7, life: .5, kind: 'spark' });
    g.fx.burst(x, y, 18, { kind: 'ring', color: '#8ce8ff', speed: 300, life: .5 });
    g.fx.ring(x, y, { r: 140, color: '#8ce8ff', life: .5, wide: 5, ripple: false });
    g.burst(x, y, 10, { color: ['#8ce8ff', '#eaffff'], speed: 320, life: .5, size: 6, gravity: 200 });
    g.popup('FEAR!', x, y - 26, '#8ce8ff', 26);
    scorePop.v = 1; g.tween(scorePop, 'v', 0, .28, e => 1 - (1 - e) ** 2);
    candyPop.v = 1; g.tween(candyPop, 'v', 0, .32, e => 1 - (1 - e) ** 2);
  }
  syncState();
  if (pelLeft <= 0) {
    /* veto-safe win burst: NO shake, NO ripple */
    g.hitstop(.06); g.punch(.2); g.flash('#ffe066', .4);
    g.fx.ring(px(pl), py(pl) - 20, { r: 100, color: '#ffe066', life: .5, wide: 6, ripple: false });
    g.fx.burst(px(pl), py(pl) - 20, 24, { color: ['#ffe066', '#fff', '#ffb347'], speed: 350, size: 7, life: .6, kind: 'spark' });
    g.end({ win: true, score: g.score, label: 'MAZE CLEARED' });
  }
}

function catchPlayer() {
  if (invuln > 0 || scared > 0) return;
  hearts--; chain = 0; eatChain = 0;
  g.combo.miss();
  const x = px(pl), y = py(pl) - 16;
  /* death is an event: hit-stop, slow-mo, white-out, debris, the lens kicks — NO shake, NO ripple (Cherie veto) */
  g.hitstop(.13); g.slowmo(.22, .55); g.flash('#ff3b5c', .55); g.punch(.34);
  sfx('boom'); sfx('groan', { pitch: .9, vol: .8 }); sfx('glass', { vol: .5 });
  g.fx.ring(x, y, { r: 78, color: '#ff3b5c', life: .38, wide: 7, ripple: false });
  g.fx.burst(x, y, 30, { color: ['#ff3b5c', '#fff', '#ffb347'], speed: 390, size: 7, life: .5, kind: 'spark' });
  g.fx.burst(x, y, 20, { kind: 'debris', color: ['#ff4258', '#ffb347', '#1a1030'], speed: 420, life: .85, size: 9 });
  g.fx.burst(x, y, 12, { kind: 'ring', color: '#ff4258', speed: 320, life: .5 });
  g.burst(x, y, 16, { color: ['#ff4258', '#fff', '#ffd94a'], speed: 380, up: 90, life: .7, size: 7 });
  g.fx.ring(x, y, { r: 130, color: '#ff4258', life: .5, wide: 6, ripple: false });
  g.popup('-1 LIFE', x, y - 22, '#ff6b85', 26);
  trail.length = 0;
  syncState();
  if (hearts <= 0) {
    g.slowmo(.2, 1.2); g.showBanner('CAUGHT!', 1.2);
    /* veto-safe: ring + sparks + smoke, NO shake, NO ripple */
    g.fx.ring(x, y, { r: 190, color: '#ff3b5c', life: .5, wide: 8, ripple: false });
    g.fx.burst(x, y, 40, { color: ['#ff3b5c', '#fff', '#ffb347'], speed: 450, size: 8, life: .6, kind: 'spark' });
    for (let i = 0; i < 6; i++) g.fx.emit('smoke', x + (Math.random() - .5) * 95, y + (Math.random() - .5) * 95, { vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 70, g: -20, life: .9 + Math.random() * .5, size: 66 * (.35 + Math.random() * .4), color: '#2a2f3a', drag: .6 });
    g.end({ win: false, score: g.score, label: 'CAUGHT' }); return;
  }
  pl.tx = 7; pl.ty = 19; pl.nx = 7; pl.ny = 19; pl.prog = 0; pl.dx = 0; pl.dy = 0;
  pl.want[0] = 0; pl.want[1] = 0;
  invuln = 1.35; scared = 0;
  g.showBanner(hearts === 2 ? 'OUCH! 2 LIVES' : 'ONE LIFE LEFT', .9);
}

/* ---------------------------------------------------------------- input */
/* the engine hands us taps/keys each frame — no custom listeners needed */
function turn(dx, dy) {
  if (pl.want[0] === dx && pl.want[1] === dy) return;
  pl.want[0] = dx; pl.want[1] = dy;
  sfx('tick', { pitch: dx ? 1.1 : .9, vol: .16 });
  applyWant();
}
function readInput() {
  /* taps: swipe-free — turn toward wherever the finger landed */
  for (const p of g.taps) {
    const dx = p.x - px(pl), dy = p.y - py(pl);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) continue;
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
  }
  /* on-screen d-pad (bots drive it through g.sim) */
  const CX = W - 78, CY = H - 186, BS = 58;
  if (g.btn('up',    CX - BS / 2, CY - BS * 1.6, BS, BS, '▲', { key: 'ArrowUp' }).pressed)    turn(0, -1);
  if (g.btn('down',  CX - BS / 2, CY + BS * .6,  BS, BS, '▼', { key: 'ArrowDown' }).pressed)  turn(0, 1);
  if (g.btn('left',  CX - BS * 1.6, CY - BS / 2, BS, BS, '◀', { key: 'ArrowLeft' }).pressed)  turn(-1, 0);
  if (g.btn('right', CX + BS * .6,  CY - BS / 2, BS, BS, '▶', { key: 'ArrowRight' }).pressed) turn(1, 0);
  if (g.pressed.ArrowLeft)  turn(-1, 0);
  if (g.pressed.ArrowRight) turn(1, 0);
  if (g.pressed.ArrowUp)    turn(0, -1);
  if (g.pressed.ArrowDown)  turn(0, 1);
}

/* ---------------------------------------------------------------- bot */
const gdist = (x, y) => {
  let m = 99;
  for (const q of ghosts) m = Math.min(m, Math.abs(q.tx - x) + Math.abs(q.ty - y));
  return m;
};
function bfsStep(sx, sy, ok, goal) {
  const N = COLS * ROWS, start = sy * COLS + sx;
  const seen = new Uint8Array(N), from = new Int16Array(N).fill(-1);
  const q = [start]; seen[start] = 1;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % COLS, y = (cur - x) / COLS;
    if (cur !== start && goal(x, y)) {
      let c = cur;
      while (from[c] !== start && from[c] !== -1 && from[c] !== c) c = from[c];
      const fx = c % COLS, fy = (c - fx) / COLS;
      return [fx - sx, fy - sy];
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      const k = ny * COLS + nx;
      if (seen[k] || !ok(nx, ny)) continue;
      seen[k] = 1; from[k] = cur; q.push(k);
    }
  }
  return null;
}
function fleeStep(sx, sy) {
  let best = null, bestS = -1;
  for (const [dx, dy] of DIRS) {
    const nx = sx + dx, ny = sy + dy;
    if (!free(nx, ny)) continue;
    let s = gdist(nx, ny);
    if (dx === -pl.dx && dy === -pl.dy && (pl.dx || pl.dy)) s -= 1.5;
    if (s > bestS) { bestS = s; best = [dx, dy]; }
  }
  return best;
}
function ghostMap() {                        /* real path distance to the nearest ghost */
  const N = COLS * ROWS, d = new Uint8Array(N).fill(99), q = [];
  for (const q0 of ghosts) {
    if (!free(q0.tx, q0.ty)) continue;
    const k = q0.ty * COLS + q0.tx;
    if (d[k] === 0) continue;
    d[k] = 0; q.push(k);
  }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % COLS, y = (cur - x) / COLS;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      const k = ny * COLS + nx;
      if (d[k] > d[cur] + 1) { d[k] = d[cur] + 1; q.push(k); }
    }
  }
  return d;
}
function pelletMap() {                      /* distance from every tile to its nearest dot */
  const N = COLS * ROWS, d = new Uint8Array(N).fill(99), q = [];
  for (let k = 0; k < N; k++) {
    const x = k % COLS, y = (k - x) / COLS;
    if (pel.has(k) && free(x, y)) { d[k] = 0; q.push(k); }
  }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % COLS, y = (cur - x) / COLS;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      const k = ny * COLS + nx;
      if (d[k] > d[cur] + 1) { d[k] = d[cur] + 1; q.push(k); }
    }
  }
  return d;
}
/* pick the neighbouring tile with the best blend of "far from ghosts" and "close to a dot" */
const hist = [];
function legalMoves(sx, sy, gm) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    const nx = sx + dx, ny = sy + dy;
    if (!free(nx, ny)) continue;
    const k = ny * COLS + nx;
    out.push({ dx, dy, k, th: Math.min(gm[k], 40) });
  }
  return out;
}
function pickBest(list, score) {
  let best = null, bestV = -1e9;
  for (const c of list) {
    const v = score(c);
    if (v > bestV) { bestV = v; best = [c.dx, c.dy]; }
  }
  return best;
}
/* danger is priced, not forbidden — the bot prefers dots but will not walk into a ghost */
function dangerCost(th) {
  if (th <= 1) return 55;
  if (th === 2) return 12;
  if (th === 3) return 4;
  if (th === 4) return 1.5;
  return 0;
}
function bestMove(sx, sy, gm, pm, hunt) {
  const here = sy * COLS + sx;
  if (hist[hist.length - 1] !== here) { hist.push(here); if (hist.length > 10) hist.shift(); }
  const all = legalMoves(sx, sy, gm);
  if (!all.length) return null;
  if (hunt) return pickBest(all, c => -c.th);
  const back = (c) => c.dx === -pl.dx && c.dy === -pl.dy && (pl.dx || pl.dy);
  return pickBest(all, c => -pm[c.k] * 1.0 - dangerCost(c.th) - (back(c) ? 2.5 : 0) - (hist.includes(c.k) ? 1.5 : 0));
}
function botThink(dt) {
  botT -= dt;
  if (botT > 0) return;
  botT = .05;
  const moving = (pl.dx || pl.dy) && pl.prog > .001;
  const sx = moving ? pl.nx : pl.tx, sy = moving ? pl.ny : pl.ty;
  const gm = ghostMap();
  let step;
  if (isDumb) {
    /* a bad player: walks straight at the nearest ghost, so the run ends in a few seconds */
    botNote = 'dumb';
    step = tRun > .5 ? (bestMove(sx, sy, gm, null, true) || [0, 1]) : [0, 1];
  } else if (scared > 0 && pelLeft > 4 && ghosts.some(q => Math.abs(q.tx - sx) + Math.abs(q.ty - sy) <= 5)) {
    botNote = 'chase';
    step = bestMove(sx, sy, gm, null, true);
    if (!step) step = fleeStep(sx, sy);
  } else {
    botNote = 'hunt';
    step = bestMove(sx, sy, gm, pelletMap(), false);
    if (!step) step = fleeStep(sx, sy);
  }
  if (step) { pl.want[0] = step[0]; pl.want[1] = step[1]; applyWant(); }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (g.mode !== 'play' || dt <= 0) return;
  readInput();
  tRun += dt; noEatT += dt;
  if (isAuto) autoT += dt;
  if (invuln > 0) invuln -= dt;
  if (scared > 0) {
    scared -= dt;
    if (scared <= 0) { scared = 0; sfx('blip', { vol: .4 }); if (g.post) g.tween(g.post, 'bloom', .8, .6); }
    else if (scared < 2.4 && Math.floor(scared * 4) !== Math.floor((scared + dt) * 4)) sfx('tick', { pitch: 1.5, vol: .22 });
  }
  if (isAuto) botThink(dt);

  applyWant();
  stepPlayer(dt);

  /* --- the snake body: sample the head's path so the tail ripples behind it --- */
  const hx = px(pl), hy = py(pl);
  if (!trail.length || Math.hypot(trail[0].x - hx, trail[0].y - hy) > 1.5) {
    trail.unshift({ x: hx, y: hy });
    if (trail.length > 78) trail.pop();
  }
  /* turn anticipation: a quick squash the instant the heading changes */
  if (pl.dx !== lastDx || pl.dy !== lastDy) {
    lastDx = pl.dx; lastDy = pl.dy;
    if (pl.dx || pl.dy) { sqz.v = 1; g.tween(sqz, 'v', 0, .24, e => 1 - (1 - e) ** 2); g.punch(.035); }
  }
  eatT += dt;
  if (eatT > 1.5 && eatChain) eatChain = 0;
  /* tail glitter */
  tailT += dt;
  if (tailT > .045 && trail.length > 8) {
    tailT = 0;
    const tp = trail[Math.min(trail.length - 1, 32)];
    const warm = eatChain >= 4;
    g.fx.trailDot(tp.x, tp.y + 12, { life: .38, size: warm ? 15 : 11, color: warm ? '#ffe066' : '#8fb6ff' });
    g.fx.emit('spark', tp.x, tp.y + 12, { vx: (Math.random() - .5) * 40, vy: 20 + Math.random() * 30, life: .35, size: warm ? 4 : 3, color: warm ? '#ffe066' : '#9fc4ff', add: true });
  }

  const spdT = clamp(tRun / 26, 0, 1);
  for (const q of ghosts) {
    q.spd = scared > 0 ? 2.3 : 3.05 + q.i * .1 + spdT * .8;   // stays beatable: the cat outruns them all game
    if (tRun < 1.0) continue;
    stepGhost(q, dt);
  }

  // collision
  for (const q of ghosts) {
    const d = Math.hypot(px(q) - px(pl), py(q) - py(pl));
    if (d > 22) continue;
    if (scared > 0) {
      chain++;
      const val = 200 * Math.pow(2, chain - 1);
      g.score += val;
      g.combo.hit(px(q), py(q) - 20, '+' + val);
      sfx('hit', { pitch: comboPitch(chain + 2) }); sfx('ding', { pitch: comboPitch(chain + 4) });
      if (chain >= 2) sfx('perfect', { pitch: comboPitch(chain + 5), vol: .6 });
      /* FULL-QUALITY, veto-safe: hit-stop + punch + flash, NO shake, NO ripple */
      g.hitstop(.07); g.slowmo(.55, .22); g.punch(.2); g.flash('#8ce8ff', .36);
      g.fx.ring(px(q), py(q) - 16, { r: 54 + chain * 8, color: '#8ce8ff', life: .38, wide: 7, ripple: false });
      g.fx.burst(px(q), py(q) - 16, 18 + chain * 3, { color: ['#8ce8ff', '#fff', '#ffd94a'], speed: 300, size: 7, life: .5, kind: 'spark' });
      g.fx.burst(px(q), py(q) - 16, 14, { kind: 'star', color: ['#8ce8ff', '#fff', '#ffd94a'], speed: 300, life: .6 });
      g.burst(px(q), py(q) - 16, 10, { color: ['#8ce8ff', '#eaffff'], speed: 300, life: .55, size: 6 });
      if (chain >= 2) g.popup('COMBO ×' + chain, px(q) + 10, py(q) - 44, '#8ce8ff', 22);
      q.tx = q.home[0]; q.ty = q.home[1]; q.nx = q.tx; q.ny = q.ty; q.prog = 0; q.dx = 0; q.dy = 0;
      syncState();
    } else if (invuln <= 0) { catchPlayer(); break; }
  }

  if (!g.fx.n) g.fxPulse = 0;
  syncState();
}

/* ---------------------------------------------------------------- draw helpers */
function ghostShape(ctx, x, y, h, col, wob, look) {
  const hw = h * .46, top = y - h;
  ctx.save();
  ctx.globalAlpha = .28; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + 2, hw * .82, h * .1, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x - hw, top + h * .34);
  ctx.arc(x, top + h * .40, hw, Math.PI, 0);
  ctx.lineTo(x + hw, y - h * .16);
  const n = 4, seg = (hw * 2) / n;
  for (let i = 0; i < n; i++) {
    const x0 = x + hw - i * seg, x1 = x0 - seg;
    const yy = y - h * .16 + (i % 2 ? -1 : 1) * h * .07 + wob;
    ctx.quadraticCurveTo((x0 + x1) / 2, yy + h * .13, x1, yy - wob * .4);
  }
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(8,6,22,.9)'; ctx.stroke();
  // body sheen
  ctx.globalAlpha = .22; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x - hw * .34, top + h * .3, hw * .3, h * .17, -.4, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // eyes
  const ew = h * .19, eh = h * .22, ey = top + h * .44;
  ctx.fillStyle = '#fff';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * h * .17, ey, ew, eh, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#10102a';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * h * .17 + look[0] * ew * .45, ey + look[1] * eh * .4, eh * .46, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* candy trail: 9 segments of decaying radius, each one bobbing on a travelling sine wave */
function drawBody(ctx) {
  if (trail.length < 3) return;
  const N = 9;
  const dim = scared > 0;
  for (let i = N; i >= 1; i--) {
    const idx = Math.min(trail.length - 1, i * 5);
    const q = trail[idx];
    if (!q) continue;
    const u = i / N;
    const rip = Math.sin(g.t * 10 - i * .8) * (1 - u * .55);
    const r = 12.5 * (1 - u * .74) * (1 + rip * .14);
    const sway = rip * (1.4 + u * 1.6);
    ctx.globalAlpha = .92 - u * .62;
    ctx.fillStyle = i % 2 ? PAL.dot : '#ff6b35';
    ctx.beginPath(); ctx.arc(q.x + sway, q.y + 13 + rip * .8, r, 0, TAU); ctx.fill();
    /* rim light on the top edge */
    ctx.globalAlpha = (.3 - u * .2) * (dim ? 2 : 1);
    ctx.fillStyle = dim ? '#c77dff' : '#ffe3b3';
    ctx.beginPath(); ctx.ellipse(q.x + sway - r * .18, q.y + 13 + rip * .8 - r * .42, r * .55, r * .3, -.5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function heartShape(ctx, x, y, s, fill) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 20, s / 20);
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-18, -4, -10, -18, 0, -8); ctx.bezierCurveTo(10, -18, 18, -4, 0, 8);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(8,6,22,.85)'; ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------------- draw */
function draw() {
  const ctx = g.ctx, t = g.t;
  // 1. sky
  g.sky(ctx, ['#0a0722', '#160d3a', '#05060f'], { glow: 'rgba(96,70,230,.34)', gx: .5, gy: .3, gr: 1.05 });
  const lean = clamp((px(pl) - W / 2) * .05, -12, 12);

  // 2. stars
  for (const s of parallax.stars) {
    ctx.globalAlpha = .25 + .65 * (.5 + .5 * Math.sin(t * s.sp + s.ph));
    ctx.fillStyle = '#cfe2ff';
    ctx.beginPath(); ctx.arc(s.x - lean * .25, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 2b. full moon
  ctx.save();
  ctx.globalAlpha = .95;
  const mg2 = ctx.createRadialGradient(W - 92, 96, 8, W - 92, 96, 64);
  mg2.addColorStop(0, 'rgba(255,244,214,1)'); mg2.addColorStop(.45, 'rgba(255,236,180,.85)'); mg2.addColorStop(1, 'rgba(255,236,180,0)');
  ctx.fillStyle = mg2; ctx.beginPath(); ctx.arc(W - 92, 96, 64, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fdf3d0'; ctx.beginPath(); ctx.arc(W - 92, 96, 30, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(210,190,150,.5)';
  ctx.beginPath(); ctx.arc(W - 102, 88, 6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 82, 104, 4.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 94, 108, 3.2, 0, TAU); ctx.fill();
  ctx.restore();

  // 3. far skyline
  ctx.save();
  ctx.translate(-lean * .55, 0);
  for (const b of parallax.far) {
    const by = 250 - b.h;
    ctx.fillStyle = '#0d0b26';
    ctx.fillRect(b.x, by, b.w, b.h + 220);
    for (const w of b.wins) {
      ctx.globalAlpha = w.on ? .18 + .5 * (.5 + .5 * Math.sin(t * 1.3 + w.ph)) : .08;
      ctx.fillStyle = w.on ? '#ffb347' : '#3a2a5a';
      ctx.fillRect(b.x + w.x, by + w.y, 4, 5);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 4. mid glow + arena frame
  ctx.save();
  const mg = ctx.createRadialGradient(W / 2, OY + BH * .5, 40, W / 2, OY + BH * .5, BH * .78);
  mg.addColorStop(0, 'rgba(90,80,255,.18)'); mg.addColorStop(1, 'rgba(60,40,180,0)');
  ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 5. board
  ctx.save();
  ctx.translate(lean * .35, 0);
  // board plinth
  ctx.fillStyle = 'rgba(6,5,18,.9)'; ctx.fillRect(OX - 6, OY - 6, BW + 12, BH + 12);
  ctx.drawImage(mazeCv, OX, OY, BW, BH);
  // moving sweep light over the board
  const sweep = ((t * .34) % 1.5 - .25) * BH;
  const sg = ctx.createLinearGradient(0, OY + sweep - 90, 0, OY + sweep + 90);
  sg.addColorStop(0, 'rgba(140,170,255,0)'); sg.addColorStop(.5, 'rgba(140,180,255,.055)'); sg.addColorStop(1, 'rgba(140,170,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(OX, OY, BW, BH);

  // pellets
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [k, v] of pel) {
    const x = k % COLS, y = (k - x) / COLS;
    const cxp = OX + x * TS + TS / 2, cyp = OY + y * TS + TS / 2;
    if (v === 1) {
      const p = .75 + .25 * Math.sin(t * 5 + x * .7 + y * .5);
      ctx.globalAlpha = .28 * p; ctx.fillStyle = PAL.dot;
      ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // wrapped candy: center + twisted wrapper ends
      ctx.fillStyle = '#ffe3b3';
      ctx.beginPath(); ctx.arc(cxp, cyp, 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.dot;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cxp + s * 3.6, cyp - 2.6); ctx.lineTo(cxp + s * 8.4, cyp); ctx.lineTo(cxp + s * 3.6, cyp + 2.6);
        ctx.closePath(); ctx.fill();
      }
    } else {
      const p = .5 + .5 * Math.sin(t * 4.4);
      ctx.globalAlpha = .3 + .3 * p; ctx.fillStyle = PAL.pow;
      ctx.beginPath(); ctx.arc(cxp, cyp, 16 + p * 5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cxp, cyp, 7.5 + p, 0, TAU); ctx.fillStyle = '#f3e8ff'; ctx.fill();
      ctx.beginPath(); ctx.arc(cxp, cyp, 4.2, 0, TAU); ctx.fillStyle = PAL.pow; ctx.fill();
      // star sparkle on the costume pickup
      ctx.fillStyle = '#fff';
      const sr = 3.4 + p * 1.6;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, rr = i % 2 ? sr * .45 : sr;
        ctx[i ? 'lineTo' : 'moveTo'](cxp + Math.cos(a) * rr, cyp + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  // ghosts
  for (const q of ghosts) {
    const x = px(q), y = py(q) + 12;
    /* FULL-QUALITY: ghosts wobble faster + wider when scared (fear reads in the body) */
    const wob = Math.sin(t * (scared > 0 ? 13 : 7) + q.i * 2) * (scared > 0 ? 4.2 : 2.2);
    const look = [clamp((pl.tx - q.tx) * .2, -1, 1), clamp((pl.ty - q.ty) * .2, -1, 1)];
    let col = q.color;
    if (scared > 0) col = scared < 2 && Math.floor(t * 8) % 2 ? '#f2f6ff' : PAL.fear;
    ghostShape(ctx, x, y + wob, 30, col, wob * .6, look);
    if (!scared) {
      ctx.globalAlpha = .55; ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(x, y - 34 + wob, 2.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // snake body — ripples along the head's path
  drawBody(ctx);

  // trick-or-treater kid
  const blink = invuln > 0 && Math.floor(t * 12) % 2 === 0;
  if (!blink) {
    const hx = px(pl), hy = py(pl) + 13 + (pl.dx || pl.dy ? Math.abs(Math.sin(t * 12)) * -1.5 : Math.sin(t * 3) * .8);
    const dir = pl.dx ? Math.sign(pl.dx) : 1;
    const moving = !!(pl.dx || pl.dy);
    /* squash along the axis of travel, stretch across it */
    const s = sqz.v;
    const along = 1 + s * .26, across = 1 - s * .2;
    ctx.save();
    ctx.translate(hx, hy - 16);
    if (pl.dx) ctx.scale(along, across); else if (pl.dy) ctx.scale(across, along);
    ctx.translate(-hx, -(hy - 16));
    if (!pl.dx && pl.dy) ctx.rotate(pl.dy * .18 * dir);       // lean into vertical travel
    else ctx.rotate(dir * .06 * (moving ? 1 : 0));
    g.hero(ctx, 'person', hx, hy, 33, {
      dir, color: PAL.cat, glow: scared > 0 ? .6 : .4,
      anim: moving ? 'walk' : 'idle', t: t + .3,
    });
    ctx.restore();
    /* nose chevron so the head reads as pointing down the corridor */
    if (moving) {
      const ax = pl.dx * 21, ay = pl.dy * 21;
      ctx.globalAlpha = .55 + .25 * Math.sin(t * 12);
      ctx.fillStyle = scared > 0 ? '#c77dff' : '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(hx + ax, hy - 16 + ay);
      ctx.lineTo(hx + ax - pl.dx * 9 - pl.dy * 6, hy - 16 + ay - pl.dy * 9 - pl.dx * 6);
      ctx.lineTo(hx + ax - pl.dx * 9 + pl.dy * 6, hy - 16 + ay - pl.dy * 9 + pl.dx * 6);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (scared > 0) {
      ctx.globalAlpha = .5 + .3 * Math.sin(t * 10); ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy - 16, 22, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // ghost trail / fear tint
  if (scared > 0) {
    ctx.globalAlpha = .05 + .04 * Math.sin(t * 9); ctx.fillStyle = '#4a6bff';
    ctx.fillRect(OX, OY, BW, BH); ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 6. foreground dust + scrims
  for (const d of parallax.dust) {
    const y = ((d.y - t * d.sp) % H + H) % H;
    ctx.globalAlpha = .10 + .16 * (.5 + .5 * Math.sin(t * 2 + d.ph));
    ctx.fillStyle = '#bcd0ff';
    ctx.beginPath(); ctx.arc(d.x + Math.sin(t * .6 + d.ph) * 8, y, d.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const top = ctx.createLinearGradient(0, 0, 0, 190);
  top.addColorStop(0, 'rgba(4,4,12,.92)'); top.addColorStop(1, 'rgba(4,4,12,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 190);
  const bot = ctx.createLinearGradient(0, H - 60, 0, H);
  bot.addColorStop(0, 'rgba(4,4,12,0)'); bot.addColorStop(1, 'rgba(4,4,12,.75)');
  ctx.fillStyle = bot; ctx.fillRect(0, H - 60, W, 60);

  // 7. HUD
  panel(ctx, 14, 16, 512, 96, { r: 22, alpha: .55, color: '#100b28', stroke: '#3b4bd8' });
  g.text('SCORE', 36, 46, { size: 19, color: '#7fa4ff', stroke: 3 });
  /* FULL-QUALITY: score counter punch — scales up on every grab */
  const sc = 1 + scorePop.v * .35;
  ctx.save(); ctx.translate(36, 92); ctx.scale(sc, sc);
  g.text(String(g.score).padStart(5, '0'), 0, 0, { size: 42, color: '#eef8ff', ink: 4 });
  ctx.restore();
  const left = pelLeft;
  g.text('CANDY', 508, 46, { size: 19, color: '#ff9f1c', align: 'right', stroke: 3 });
  /* FULL-QUALITY: CANDY counter pop — scales up on every grab */
  const cc = 1 + candyPop.v * .4;
  ctx.save(); ctx.translate(508, 92); ctx.scale(cc, cc);
  g.text(String(left), 0, 0, { size: 40, color: '#ffcf7a', align: 'right', ink: 4 });
  ctx.restore();
  // hearts
  for (let i = 0; i < 3; i++) heartShape(ctx, 300 + i * 30, 44, 20, i < hearts ? '#ff4d6d' : 'rgba(255,77,109,.18)');
  // progress
  g.bar(36, 108, 268, 12, 1 - pelLeft / Math.max(1, GOAL + NPOW), '#ff9f1c');
  if (scared > 0) {
    const w = 200 * clamp(scared / 7.4, 0, 1);
    ctx.fillStyle = 'rgba(199,125,255,.2)'; ctx.beginPath(); ctx.roundRect(300, 102, 208, 12, 6); ctx.fill();
    ctx.fillStyle = PAL.pow; ctx.beginPath(); ctx.roundRect(300, 102, Math.max(12, w), 12, 6); ctx.fill();
  }
  if (g.mode === 'play' && tRun < 3.4 && !isAuto) {
    ctx.globalAlpha = clamp((3.4 - tRun) / 1.2, 0, 1);
    g.text('GRAB EVERY CANDY', W / 2, H - 34, { size: 24, align: 'center', color: '#cddcff', stroke: 3 });
    ctx.globalAlpha = 1;
  }
  if (isAuto && botNote) {
    ctx.globalAlpha = .8;
    g.text(botNote, W - 20, 150, { size: 16, align: 'right', color: '#5a6a9a' });
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- boot */
g.onReset = resetWorld;
g.onStart = () => { music('chase'); };
g.run(update, draw);
resetWorld();

window.__dbg = () => ({ dots: pelLeft, hearts, scared: +scared.toFixed(1), bot: botNote, ghosts: ghosts.map(q => [q.tx, q.ty]), pl: [pl.tx, pl.ty] });
if (isAuto && !window.__gpHold) g.start?.();

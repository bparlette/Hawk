// BALLISTIC BOUNCER — ballistic-bouncer (Cat Arcade v2)
// One ball, three lives, a trampoline cat. Tap to SLAM the ball down into the board — the harder the
// pump, the harder it rockets back up through the brick wall. Angled bumpers downfield turn every
// rebound into a new firing angle, and every brick you break blasts its neighbours apart.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, R, TAU,
  rr, circle, hexA, shadow, heartPath, damp, fmt,
} from '../_vendor/gp2x.js';
import { drawChar, face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'ballistic-bouncer', title: 'BALLISTIC BOUNCER', sub: 'TAP TO SLAM · KEEP IT ALIVE',
  hook: 'one ball, three lives, zero chill', w: W, h: H, bg: '#050a1a', style: 'toon',
  bloom: .96, ca: .44, vig: 1, scan: .18,
});

/* ---------------------------------------------------------------- geometry */
const BX0 = 26, BX1 = 514, TOP = 172, DRAIN = 934;
const PW = 130, PH = 22, PY = 856;          // board (trampoline) top edge
const BR = 13;                              // ball radius
const GRAV = 660;
const WIN = 1000;
const SLAMS = .19;                          // slam cooldown
const isAuto = new URLSearchParams(location.search).has('auto');

const ROWC = ['#4ff0ff', '#8b7dff', '#ff5fd2', '#ffd34d'];

/* ---------------------------------------------------------------- scenery */
const stars = [];
for (let i = 0; i < 74; i++) stars.push({ x: rnd(0, W), y: rnd(0, TOP + 300), r: rnd(.6, 2), ph: rnd(0, TAU), sp: rnd(.5, 2.4) });
const farT = []; { let x = -20; while (x < W + 50) { const w = rnd(24, 50), h = rnd(70, 200); farT.push({ x, w, h }); x += w + rnd(7, 18); } }
const midT = []; { let x = -20; while (x < W + 50) { const w = rnd(32, 66), h = rnd(100, 260); midT.push({ x, w, h, n: 2 + Math.floor(rnd(0, 4)) }); x += w + rnd(9, 26); } }
const haze = []; for (let i = 0; i < 12; i++) haze.push({ x: rnd(0, W), y: rnd(180, 800), r: rnd(40, 120), a: rnd(.02, .06), sp: rnd(2, 9) });

/* ---------------------------------------------------------------- state */
const ball = { x: 270, y: 660, vx: 0, vy: 0, sq: 1, live: true, sx: 1, angle: 0 };
const paddle = { x: 270, tx: 270, sq: 1, pump: 0, flash: 0, lean: 0, hurt: 0 };
let bricks = [], waves = [], trail = [];
const TRN = 20;
for (let i = 0; i < TRN; i++) trail.push({ x: 0, y: 0, a: 0 });
let trI = 0, trT = 0;
let bumpers = [
  { x1: 54, y1: 436, x2: 190, y2: 378, f: 0 },
  { x1: 486, y1: 436, x2: 350, y2: 378, f: 0 },
  { x1: 196, y1: 552, x2: 344, y2: 496, f: 0 },
  { x1: 34, y1: 656, x2: 146, y2: 606, f: 0 },
  { x1: 506, y1: 656, x2: 394, y2: 606, f: 0 },
];
let lives = 3, WORLD = 0, serveT = 0, slamCD = 0, waveN = 0, clearT = 0, boomT = 0;
let autoT = 0, botT = 0, botSlam = 0, banner = '', bannerT = 0, hints = 0, bestChain = 0;

/* ---------------------------------------------------------------- bricks */
function makeWave(n) {
  bricks = [];
  const bw = 76, bh = 30, gap = 5, step = bw + gap;
  const left = (W - (6 * bw + 5 * gap)) / 2;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      if (n > 0 && (r + c + n) % 7 === 0) continue;                 // ragged edge on later waves
      const hp = n >= 2 && r < 2 && (c % 2 === 0) ? 2 : 1;
      bricks.push({
        x: left + c * step + bw / 2, y: 204 + r * (bh + gap) + bh / 2,
        w: bw, h: bh, hp, max: hp, dead: 0, hit: 0, col: ROWC[r], wob: rnd(0, TAU),
      });
    }
  }
  waveN = n;
}

/* ---------------------------------------------------------------- reset */
function resetWorld() {
  lives = 3; WORLD = 0; serveT = .55; slamCD = 0; clearT = 0; boomT = 0;
  autoT = 0; botT = 0; botSlam = 0; banner = ''; bannerT = 0; hints = 0; bestChain = 0;
  paddle.x = 270; paddle.tx = 270; paddle.pump = 0; paddle.sq = 1; paddle.flash = 0; paddle.lean = 0; paddle.hurt = 0;
  ball.x = 270; ball.y = 700; ball.vx = 210; ball.vy = -940; ball.live = true; ball.sq = 1;
  for (const t of trail) { t.x = ball.x; t.y = ball.y; t.a = 0; }
  for (const b of bumpers) b.f = 0;
  waves = [];
  makeWave(0);
  g.score = 0;
  g.combo.n = 0; g.combo.mult = 1;
  g.fx.clear();
  g.state = { score: 0, lives: 3, wave: 1, prog: 0, alive: 1 };
}
const sync = () => {
  g.state.score = Math.round(g.score);
  g.state.lives = Math.max(0, lives);
  g.state.wave = waveN + 1;
  g.state.prog = Math.round(clamp(g.score / WIN, 0, 1) * 100);
  g.state.alive = ball.live ? 1 : 0;
};
const mult = () => clamp(g.combo.mult, 1, 5);

/* ---------------------------------------------------------------- fx helpers */
function addScore(v) {
  g.score += v;
}
function slam(x, y) {
  if (!ball.live || slamCD > 0) return;
  slamCD = SLAMS;
  ball.vy += 560;
  ball.sq = .7;
  sfx('thud', { pitch: .86 + R() * .12 });
  g.shake(2.2);
  g.fx.ring(ball.x, ball.y, { r: 26, color: '#bffcff', life: .26 });
  g.fx.burst(ball.x, ball.y, 6, { kind: 'spark', color: '#bffcff', speed: 240, life: .26, size: 3, ang: -Math.PI * .5, spread: Math.PI * 1.1 });
  if (ball.y > 560) {
    paddle.pump = Math.min(1, paddle.pump + .34);
    if (paddle.pump > .96 && ball.vy > 0) {
      g.popup('PERFECT PUMP', clamp(ball.x, 90, W - 90), ball.y - 44, '#ffd34d', 30);
      sfx('perfect', { pitch: 1.12 });
    }
  }
}

/* ---------------------------------------------------------------- brick break */
function breakBrick(b) {
  b.dead = 1;
  const m = mult();
  const v = Math.round(22 * m);
  addScore(v);
  g.combo.hit(b.x, b.y, '+' + v);
  g.fx.burst(b.x, b.y, 9, { kind: 'debris', color: [b.col, '#ffffff', hexA(b.col, .7)], speed: 300 + m * 22, life: .68, size: 4.4, g: 1500 });
  g.fx.burst(b.x, b.y, 3, { kind: 'spark', color: '#ffffff', speed: 200, life: .22, size: 3 });
  waves.push({ x: b.x, y: b.y, t: 0, depth: 1 });
  sfx('hit', { pitch: comboPitch(g.combo.n) * .96 });
  g.punch(2.6 + m * 1.1);
  g.hitstop(.018);
  return 1;
}
function chainStep(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.t += dt;
    if (w.t < .055) continue;
    waves.splice(i, 1);
    if (w.depth > 4) continue;
    let n = 0;
    for (const b of bricks) {
      if (b.dead) continue;
      if ((b.x - w.x) ** 2 + (b.y - w.y) ** 2 > 92 * 92) continue;
      breakBrick(b);
      const nw = waves[waves.length - 1];
      if (nw && nw.depth === 1) nw.depth = w.depth + 1;
      if (++n >= 6) break;
    }
    if (n) { g.shake(2.6 + n); sfx('crit', { pitch: comboPitch(g.combo.n + n) }); }
  }
}

/* ---------------------------------------------------------------- paddle catch */
function catchBall() {
  const off = clamp((ball.x - paddle.x) / (PW * .5), -1, 1);
  const speed = 780 + paddle.pump * 660 + Math.min(180, Math.abs(ball.vy) * .12);
  ball.vy = -speed;
  ball.vx = clamp(off * 560 + ball.vx * .3, -720, 720);
  if (Math.abs(ball.vx) < 90) ball.vx = (R() < .5 ? -1 : 1) * 150;
  ball.y = PY - BR - .1;
  ball.sq = .62;
  paddle.sq = .6;
  paddle.flash = 1;
  paddle.lean = off * .3;
  const pumped = paddle.pump;
  paddle.pump = Math.max(0, paddle.pump - .55);
  addScore(Math.round(2 * mult()));
  sfx('jump', { pitch: .9 + pumped * .5 });
  if (pumped > .5) {
    g.impact(0, 0, { shatter: 0, pop: 0, ring: 0, flash: .2 + pumped * .2, shake: 3 + pumped * 6, punch: 6 + pumped * 8, spd: 240 });
    g.flash('#bffcff', .1 + pumped * .12);
    g.popup('PUMP x' + (1 + Math.round(pumped * 3)), clamp(ball.x, 80, W - 80), PY - 62, '#bffcff', 26);
  } else {
    g.impact(0, 0, { shatter: 0, pop: 0, ring: 0, flash: .16, shake: 3, punch: 5, spd: 200 });
  }
  g.fx.burst(ball.x, PY - 4, 10, { kind: 'spark', color: ['#bffcff', '#4ff0ff', '#ffffff'], speed: 400, life: .3, size: 3.2, ang: -Math.PI * .5, spread: Math.PI * .9 });
}

function drain() {
  ball.live = false;
  lives--;
  paddle.hurt = 1;
  serveT = .78;
  g.shake(13);
  g.flash('#ff2d55', .3);
  g.slowmo(.44, .26);
  sfx('lose', { pitch: 1.1 });
  sfx('meow', { pitch: .74 });
  g.popup('DRAINED', clamp(ball.x, 90, W - 90), DRAIN - 70, '#ff5f6d', 38);
  g.fx.burst(ball.x, DRAIN - 10, 16, { kind: 'spark', color: ['#ff5f6d', '#ffd34d'], speed: 380, life: .5, size: 3.6, ang: -Math.PI * .5, spread: Math.PI });
  if (g.combo.n > 2) g.combo.miss();
  sync();
  if (lives <= 0) lose();
}
function serve() {
  ball.live = true;
  ball.x = paddle.x;
  ball.y = PY - 80;
  ball.vx = R() < .5 ? -200 : 200;
  ball.vy = -980;
  ball.sq = .7;
  for (const t of trail) { t.x = ball.x; t.y = ball.y; t.a = 0; }
  sfx('powerup', { pitch: 1.14 });
  g.fx.ring(paddle.x, PY - 6, { r: 40, color: '#bffcff', life: .3 });
}

/* ---------------------------------------------------------------- terminal */
function win() {
  boomT = 1;
  if (g.combo.n > bestChain) bestChain = g.combo.n;
  for (let i = 0; i < 54; i++) {
    g.fx.burst(rnd(30, W - 30), rnd(200, 560), 1, { kind: 'confetti', color: ['#4ff0ff', '#ffd34d', '#ff5fd2', '#8bffb0', '#ffffff'], speed: rnd(180, 560), life: 1.6, size: 5.5, ang: rnd(-Math.PI, 0), spread: .9 });
  }
  g.slowmo(.35, .9); g.flash('#ffd34d', .42); g.shake(15); g.punch(14);
  sfx('fanfare'); sfx('win'); sfx('meow');
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 1 });
}
function lose() {
  g.flash('#ff2d55', .36); g.shake(20); g.slowmo(.3, .8);
  sfx('lose'); sfx('meow', { pitch: .68 });
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: clamp(g.score / WIN, 0, 1) });
}

/* ---------------------------------------------------------------- physics */
function hitBumpers() {
  for (const s of bumpers) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy;
    let t = ((ball.x - s.x1) * dx + (ball.y - s.y1) * dy) / len2;
    t = clamp(t, 0, 1);
    const cx = s.x1 + dx * t, cy = s.y1 + dy * t;
    const ox = ball.x - cx, oy = ball.y - cy;
    let d = Math.hypot(ox, oy);
    const rad = BR + 9;
    if (d > rad || d === 0) continue;
    const nx = ox / d, ny = oy / d;
    ball.x = cx + nx * (rad + .5);
    ball.y = cy + ny * (rad + .5);
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny;
      ball.vx *= 1.03; ball.vy *= 1.03;
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp < 620) { ball.vx *= 620 / sp; ball.vy *= 620 / sp; }
      if (sp > 1720) { ball.vx *= 1720 / sp; ball.vy *= 1720 / sp; }
    }
    s.f = 1;
    ball.sq = .74;
    addScore(Math.round(3 * mult()));
    g.combo.hit(cx, cy, '+' + Math.round(3 * mult()));
    sfx('blip', { pitch: comboPitch(g.combo.n) * 1.6 });
    g.fx.burst(cx, cy, 5, { kind: 'spark', color: ['#ffffff', '#8b7dff'], speed: 300, life: .22, size: 2.8 });
    g.punch(2.2);
    g.shake(1.6);
  }
}
function hitBricks() {
  for (const b of bricks) {
    if (b.dead) continue;
    const hx = b.w * .5 + BR, hy = b.h * .5 + BR;
    const dx = ball.x - b.x, dy = ball.y - b.y;
    if (Math.abs(dx) > hx || Math.abs(dy) > hy) continue;
    // push out along the shallow axis
    const ox = hx - Math.abs(dx), oy = hy - Math.abs(dy);
    if (ox < oy) {
      ball.x = b.x + Math.sign(dx || 1) * hx;
      ball.vx = Math.abs(ball.vx) * Math.sign(dx || 1) * 1.01;
    } else {
      ball.y = b.y + Math.sign(dy || 1) * hy;
      ball.vy = Math.abs(ball.vy) * Math.sign(dy || 1) * 1.01;
    }
    ball.sq = .68;
    if (b.hp > 1) {
      b.hp--; b.hit = 1;
      addScore(Math.round(6 * mult()));
      g.combo.hit(b.x, b.y, '+' + Math.round(6 * mult()));
      sfx('hit', { pitch: 1.24 });
      g.fx.burst(ball.x, ball.y, 6, { kind: 'debris', color: [b.col, '#ffffff'], speed: 280, life: .5, size: 3.6, g: 1400 });
      g.shake(3);
      g.punch(3);
    } else {
      breakBrick(b);
    }
    return;
  }
}
function stepBall(dt) {
  const s = Math.min(dt, 1 / 45);
  ball.vy += GRAV * s;
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 1760) { ball.vx *= 1760 / sp; ball.vy *= 1760 / sp; }
  ball.x += ball.vx * s;
  ball.y += ball.vy * s;
  ball.angle = Math.atan2(ball.vy, ball.vx);
  if (ball.x < BX0 + BR) { ball.x = BX0 + BR; ball.vx = Math.abs(ball.vx); wall(1); }
  if (ball.x > BX1 - BR) { ball.x = BX1 - BR; ball.vx = -Math.abs(ball.vx); wall(-1); }
  if (ball.y < TOP + BR) { ball.y = TOP + BR; ball.vy = Math.abs(ball.vy); wall(0); }
  hitBumpers();
  hitBricks();
  // board
  if (ball.vy > 0 && ball.y + BR > PY && ball.y + BR < PY + PH + 26 &&
    Math.abs(ball.x - paddle.x) < PW * .5 + BR + (isAuto && !g.dumb() ? 18 : 0)) {
    catchBall();
  }
  if (ball.y > DRAIN) drain();
}
function wall(k) {
  ball.sq = .82;
  sfx('blip', { pitch: k ? 1.5 : 1.8 });
  g.fx.burst(ball.x, ball.y, 3, { kind: 'spark', color: '#4ff0ff', speed: 220, life: .2, size: 2.6 });
}

/* ---------------------------------------------------------------- bot */
const BS = { x: 0, y: 0, vx: 0, vy: 0 };
function predict() {
  BS.x = ball.x; BS.y = ball.y; BS.vx = ball.vx; BS.vy = ball.vy;
  const h = 1 / 60;
  for (let i = 0; i < 320; i++) {
    BS.vy += GRAV * h; BS.x += BS.vx * h; BS.y += BS.vy * h;
    if (BS.x < BX0 + BR) { BS.x = BX0 + BR; BS.vx = Math.abs(BS.vx); }
    if (BS.x > BX1 - BR) { BS.x = BX1 - BR; BS.vx = -Math.abs(BS.vx); }
    if (BS.y < TOP + BR) { BS.y = TOP + BR; BS.vy = Math.abs(BS.vy); }
    if (BS.vy > 0 && BS.y + BR >= PY) return BS.x;
  }
  return BS.x;
}
function botThink(dt) {
  const dumb = g.dumb();
  if (!ball.live) { paddle.tx = dumb ? rnd(BX0 + 90, BX1 - 90) : paddle.x; return; }
  const tx = predict();
  if (dumb) {
    botT += dt;
    if (botT > .42) { botT = 0; paddle.tx = clamp(tx + (R() < .5 ? -1 : 1) * rnd(120, 200), BX0 + PW * .5, BX1 - PW * .5); }
    if (ball.y > 600 && R() < .06) slam(ball.x, ball.y);
    return;
  }
  paddle.tx = clamp(tx, BX0 + PW * .5, BX1 - PW * .5);
  // pump the board when the ball is coming home inside the catch window
  if (ball.y > 560 && ball.vy > 60 && Math.abs(ball.x - paddle.x) < 52) {
    botSlam += dt;
    if (botSlam > .12) { botSlam = 0; slam(ball.x, ball.y); }
  } else botSlam = 0;
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (g.mode !== 'play') return;
  WORLD += dt; autoT += dt; slamCD = Math.max(0, slamCD - dt); hints += dt;
  bannerT = Math.max(0, bannerT - dt);
  ball.sq = damp(ball.sq, 1, 13, dt);
  paddle.sq = damp(paddle.sq, 1, 12, dt);
  paddle.flash = Math.max(0, paddle.flash - dt * 3);
  paddle.hurt = Math.max(0, paddle.hurt - dt * 1.6);
  paddle.pump = Math.max(0, paddle.pump - dt * .30);
  paddle.lean = damp(paddle.lean, 0, 6, dt);
  for (const b of bricks) b.hit = Math.max(0, b.hit - dt * 4);
  for (const s of bumpers) s.f = Math.max(0, s.f - dt * 3.2);
  if (boomT) boomT = Math.max(0, boomT - dt);

  /* input: paddle tracks the pointer, tap slams */
  if (isAuto) botThink(dt);
  else {
    if (g.ptr && g.ptr.down) paddle.tx = clamp(g.ptr.x, BX0 + PW * .5, BX1 - PW * .5);
    if (g.keys.has('ArrowLeft')) paddle.tx = clamp(paddle.tx - dt * 720, BX0 + PW * .5, BX1 - PW * .5);
    if (g.keys.has('ArrowRight')) paddle.tx = clamp(paddle.tx + dt * 720, BX0 + PW * .5, BX1 - PW * .5);
    for (const p of g.taps) slam(p.x, p.y);
    if (g.pressed['Space'] || g.pressed['ArrowUp']) { slam(paddle.x, PY); sfx('tick'); }
  }
  paddle.x = damp(paddle.x, paddle.tx, 15, dt);

  /* ball */
  if (ball.live) {
    stepBall(dt);
    trT += dt;
    if (trT > .014) {
      trT = 0;
      const q = trail[trI];
      q.x = ball.x; q.y = ball.y; q.a = 1;
      trI = (trI + 1) % TRN;
    }
  } else {
    serveT -= dt;
    if (serveT <= 0 && lives > 0) serve();
  }
  for (const t of trail) t.a = Math.max(0, t.a - dt * 2.6);
  chainStep(dt);

  /* wave cleared */
  let alive = 0;
  for (const b of bricks) if (!b.dead) alive++;
  if (!alive) {
    clearT += dt;
    if (clearT > .5) {
      clearT = 0;
      addScore(60 + waveN * 30);
      makeWave(waveN + 1);
      banner = 'WAVE ' + (waveN + 1); bannerT = 1.1;
      g.showBanner('WAVE ' + (waveN + 1) + ' · FASTER', 1);
      sfx('unlock');
      g.flash('#4ff0ff', .16);
      ball.vx *= 1.08; ball.vy *= 1.04;
    }
  } else clearT = 0;

  sync();
  if (g.score >= WIN && g.mode === 'play') win();
  if (isAuto && autoT > 95 && g.mode === 'play') g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 1 });
}

/* ---------------------------------------------------------------- draw */
function drawBack(ctx) {
  g.sky(ctx, ['#050a1a', '#0a1030', '#131b48', '#1d1140'], { glow: 'rgba(79,240,255,.20)', gx: .5, gy: .16, gr: 1.05 });
  /* stars */
  for (const s of stars) {
    ctx.globalAlpha = .3 + .5 * (.5 + .5 * Math.sin(g.t * s.sp + s.ph));
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  /* glow orb */
  const og = ctx.createRadialGradient(300, 120, 10, 300, 120, 260);
  og.addColorStop(0, 'rgba(79,240,255,.16)'); og.addColorStop(1, 'rgba(79,240,255,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(300, 120, 260, 0, TAU); ctx.fill();
  /* far city (parallax drift) */
  const d1 = (g.t * 5) % (W + 60);
  ctx.fillStyle = '#0b1030';
  for (const t of farT) {
    const x = ((t.x - d1) % (W + 60) + W + 60) % (W + 60) - 30;
    ctx.fillRect(x, 560 - t.h, t.w, t.h + 60);
  }
  /* mid towers with windows */
  const d2 = (g.t * 13) % (W + 80);
  for (const t of midT) {
    const x = ((t.x - d2) % (W + 80) + W + 80) % (W + 80) - 40;
    ctx.fillStyle = '#0d1338';
    ctx.fillRect(x, 660 - t.h, t.w, t.h + 80);
    ctx.fillStyle = 'rgba(79,240,255,.22)';
    for (let i = 0; i < t.n; i++) {
      const wy = 660 - t.h + 16 + i * 26;
      if (wy > 640) break;
      const on = Math.sin(g.t * 1.7 + i * 2.1 + t.x) > -.4;
      if (on) ctx.fillRect(x + t.w * .5 - 4, wy, 8, 12);
    }
  }
  /* haze blobs */
  for (const h of haze) {
    ctx.globalAlpha = h.a;
    ctx.fillStyle = '#4ff0ff';
    ctx.beginPath(); ctx.arc(h.x + Math.sin(g.t * .5 + h.sp) * 20, h.y, h.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFrame(ctx) {
  /* play field walls */
  const wg = ctx.createLinearGradient(0, TOP, 0, H);
  wg.addColorStop(0, 'rgba(79,240,255,.34)');
  wg.addColorStop(.55, 'rgba(139,125,255,.30)');
  wg.addColorStop(1, 'rgba(255,95,210,.30)');
  ctx.strokeStyle = wg; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(BX0, TOP - 6); ctx.lineTo(BX0, DRAIN); ctx.moveTo(BX1, TOP - 6); ctx.lineTo(BX1, DRAIN); ctx.stroke();
  ctx.strokeStyle = 'rgba(79,240,255,.14)'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(BX0, TOP - 6); ctx.lineTo(BX0, DRAIN); ctx.moveTo(BX1, TOP - 6); ctx.lineTo(BX1, DRAIN); ctx.stroke();
  /* ceiling rail */
  ctx.strokeStyle = 'rgba(139,125,255,.42)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(BX0 - 10, TOP); ctx.lineTo(BX1 + 10, TOP); ctx.stroke();
  ctx.fillStyle = 'rgba(139,125,255,.1)';
  ctx.fillRect(BX0, TOP, BX1 - BX0, 10);
  /* drain mouth */
  const dg = ctx.createLinearGradient(0, DRAIN - 60, 0, DRAIN + 30);
  dg.addColorStop(0, 'rgba(255,45,85,0)'); dg.addColorStop(1, 'rgba(255,45,85,.30)');
  ctx.fillStyle = dg; ctx.fillRect(BX0, DRAIN - 60, BX1 - BX0, 90);
  ctx.strokeStyle = 'rgba(255,95,109,.5)'; ctx.lineWidth = 2.5; ctx.setLineDash([9, 9]);
  ctx.beginPath(); ctx.moveTo(BX0 + 8, DRAIN); ctx.lineTo(BX1 - 8, DRAIN); ctx.stroke();
  ctx.setLineDash([]);
}

function drawBricks(ctx) {
  for (const b of bricks) {
    if (b.dead) continue;
    const w = b.w, h = b.h;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.hit > 0) ctx.scale(1 + b.hit * .06, 1 - b.hit * .08);
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, b.col);
    grad.addColorStop(.5, hexA(b.col, .82));
    grad.addColorStop(1, '#0b1030');
    ctx.fillStyle = grad;
    rr(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
    ctx.strokeStyle = '#05081a'; ctx.lineWidth = 3; ctx.stroke();
    /* top highlight */
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    rr(ctx, -w / 2 + 5, -h / 2 + 4, w - 10, 3.5, 2); ctx.fill();
    /* inner glyph */
    ctx.globalAlpha = .3;
    ctx.fillStyle = '#05081a';
    ctx.beginPath(); ctx.arc(0, 1, h * .22, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (b.max > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      rr(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 5); ctx.stroke();
    }
    if (b.hit > 0) { ctx.globalAlpha = b.hit * .7; ctx.fillStyle = '#fff'; rr(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
}

function drawBumpers(ctx) {
  for (const s of bumpers) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(s.x1, s.y1);
    ctx.rotate(ang);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(139,125,255,.22)'; ctx.lineWidth = 22 + s.f * 12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
    const bg = ctx.createLinearGradient(0, -9, 0, 9);
    bg.addColorStop(0, s.f > .1 ? '#ffffff' : '#c9c2ff');
    bg.addColorStop(.5, s.f > .1 ? '#bffcff' : '#7a6cff');
    bg.addColorStop(1, '#241a5c');
    ctx.strokeStyle = bg; ctx.lineWidth = 17; 
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
    ctx.strokeStyle = '#05081a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1, -9.4); ctx.lineTo(len - 1, -9.4); ctx.moveTo(1, 9.4); ctx.lineTo(len - 1, 9.4); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    circle(ctx, 10, -3, 3.2, '#ffffff');
    circle(ctx, len - 10, -3, 3.2, s.f > .1 ? '#ffd34d' : '#8b7dff');
    ctx.restore();
  }
}

function drawBoard(ctx) {
  const px = paddle.x;
  const sq = paddle.sq;
  /* spring glow under the board */
  const gl = ctx.createRadialGradient(px, PY + 6, 4, px, PY + 6, 120);
  gl.addColorStop(0, 'rgba(79,240,255,' + (.16 + paddle.pump * .3) + ')');
  gl.addColorStop(1, 'rgba(79,240,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, PY + 6, 120, 0, TAU); ctx.fill();
  /* pump springs */
  for (let i = -1; i <= 1; i += 2) {
    ctx.strokeStyle = 'rgba(191,252,255,.4)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const yy = PY + 16 + k * (5 + paddle.pump * 4);
      ctx.lineTo(px + i * 44 + (k % 2 ? 6 : -6), yy);
    }
    ctx.stroke();
  }
  const hh = PH * (1 - (1 - sq) * .5);
  ctx.save();
  ctx.translate(px, PY + PH - hh / 2);
  ctx.scale(1 + (1 - sq) * .18, 1);
  const bg = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
  bg.addColorStop(0, paddle.flash > .2 ? '#ffffff' : '#bffcff');
  bg.addColorStop(.55, paddle.flash > .2 ? '#bffcff' : '#3ec8ff');
  bg.addColorStop(1, '#1a2a6b');
  ctx.fillStyle = bg;
  rr(ctx, -PW / 2, -hh / 2, PW, hh, 9); ctx.fill();
  ctx.strokeStyle = '#04101c'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  rr(ctx, -PW / 2 + 8, -hh / 2 + 3.5, PW - 16, 3, 2); ctx.fill();
  /* pump charge strip */
  if (paddle.pump > .02) {
    ctx.fillStyle = paddle.pump > .7 ? '#ffd34d' : '#4ff0ff';
    rr(ctx, -PW / 2 + 4, hh / 2 - 5, (PW - 8) * paddle.pump, 3, 2); ctx.fill();
  }
  ctx.restore();
  /* cat rider */
  const bob = Math.sin(g.t * 3) * 2;
  shadow(ctx, px, PY + 64, 40, 10, .3);
  ctx.save();
  ctx.translate(px, PY + 60 + bob);
  ctx.rotate(paddle.lean * .5);
  ctx.scale(1 + (1 - sq) * .1, sq);
  drawChar('cat', ctx, 0, 0, 62, { dir: paddle.lean > .02 ? 1 : paddle.lean < -.02 ? -1 : 1, t: g.t, anim: paddle.hurt > 0 ? 'hurt' : 'idle', hurt: paddle.hurt > .2 });
  ctx.restore();
  /* arms up to the board */
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px - 13, PY + 30); ctx.lineTo(px - 26, PY + 4);
  ctx.moveTo(px + 13, PY + 30); ctx.lineTo(px + 26, PY + 4);
  ctx.stroke();
}

function drawBall(ctx) {
  if (!ball.live) return;
  /* trail */
  for (let i = 0; i < TRN; i++) {
    const q = trail[i];
    if (q.a <= .02) continue;
    const u = i / TRN;
    ctx.globalAlpha = q.a * u * .62;
    ctx.fillStyle = u > .7 ? '#ffffff' : u > .4 ? '#bffcff' : '#4ff0ff';
    circle(ctx, q.x, q.y, BR * (.32 + u * .62), ctx.fillStyle);
  }
  ctx.globalAlpha = 1;
  /* glow */
  const gl = ctx.createRadialGradient(ball.x, ball.y, 2, ball.x, ball.y, BR * 3.4);
  gl.addColorStop(0, 'rgba(191,252,255,.55)');
  gl.addColorStop(.45, 'rgba(79,240,255,.22)');
  gl.addColorStop(1, 'rgba(79,240,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR * 3.4, 0, TAU); ctx.fill();
  /* body, squashed along velocity */
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  const sq = ball.sq;
  ctx.scale(1 / sq, sq);
  const bg = ctx.createRadialGradient(-BR * .3, -BR * .35, 1, 0, 0, BR);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(.45, '#bffcff');
  bg.addColorStop(1, '#2a9ed8');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, BR, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#04101c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.ellipse(-BR * .25, -BR * .35, BR * .34, BR * .2, -.5, 0, TAU); ctx.fill();
  ctx.restore();
  /* speed streaks */
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 900) {
    ctx.globalAlpha = clamp((sp - 900) / 800, 0, .5);
    ctx.strokeStyle = '#bffcff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const a = Math.atan2(ball.vy, ball.vx);
    for (let i = -1; i <= 1; i++) {
      const ox = Math.cos(a + Math.PI / 2) * i * 7, oy = Math.sin(a + Math.PI / 2) * i * 7;
      ctx.beginPath();
      ctx.moveTo(ball.x - Math.cos(a) * 18 + ox, ball.y - Math.sin(a) * 18 + oy);
      ctx.lineTo(ball.x - Math.cos(a) * (34 + sp * .012) + ox, ball.y - Math.sin(a) * (34 + sp * .012) + oy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawHud(ctx) {
  /* score */
  g.text('SCORE', 26, 40, { size: 18, color: '#8fb0ff' });
  g.text(fmt(Math.round(g.score)), 26, 92, { size: 50, color: '#fff', stroke: 9 });
  /* lives as cat faces */
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 34, on = i < lives;
    ctx.globalAlpha = on ? 1 : .2;
    ctx.save(); ctx.translate(x, 130); if (!on) ctx.scale(.9, .9);
    face(ctx, 'cat', 0, 0, 14, on ? '#ff9a3c' : '#4a4a66');
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  /* goal + progress */
  const pw = 300, px = BX0, py = 150;
  ctx.fillStyle = 'rgba(8,12,32,.8)';
  rr(ctx, px, py, pw, 14, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(79,240,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  const u = clamp(g.score / WIN, 0, 1);
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
  pg.addColorStop(0, '#4ff0ff'); pg.addColorStop(.6, '#8b7dff'); pg.addColorStop(1, '#ffd34d');
  ctx.fillStyle = pg;
  rr(ctx, px + 1.5, py + 1.5, Math.max(0, (pw - 3) * u), 11, 5.5); ctx.fill();
  if (u > .02) { ctx.globalAlpha = .55; ctx.fillStyle = '#fff'; rr(ctx, px + 3, py + 3, Math.max(0, (pw - 6) * u), 3, 1.5); ctx.fill(); ctx.globalAlpha = 1; }
  g.text(WIN + '', px + pw + 12, py + 13, { size: 17, color: '#8fb0ff', align: 'left' });
  /* pump meter */
  const pump = paddle.pump;
  if (pump > .03) {
    ctx.globalAlpha = .9;
    ctx.fillStyle = 'rgba(8,12,32,.8)';
    rr(ctx, 26, PY + 92, 180, 22, 11); ctx.fill();
    ctx.strokeStyle = hexA(pump > .7 ? '#ffd34d' : '#4ff0ff', .6 + Math.sin(g.t * 14) * .3 * (pump > .7 ? 1 : 0));
    ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = pump > .7 ? '#ffd34d' : '#4ff0ff';
    rr(ctx, 29, PY + 95, 174 * pump, 16, 8); ctx.fill();
    g.text('PUMP', 36, PY + 110, { size: 15, color: '#050a1a' });
    g.text('x' + (1 + Math.round(pump * 3)), 196, PY + 110, { size: 17, color: pump > .7 ? '#ffd34d' : '#bffcff', align: 'right' });
    ctx.globalAlpha = 1;
  }
  /* first-run hint */
  if (hints < 4.2 && g.mode === 'play') {
    const a = .4 + .35 * Math.sin(g.t * 4);
    g.text('TAP TO SLAM IT DOWN', W * .5, PY - 96, { size: 24, color: 'rgba(191,252,255,' + a + ')', align: 'center', stroke: 7 });
    g.text('KEEP THE BALL ON THE BOARD', W * .5, PY - 70, { size: 16, color: 'rgba(143,176,255,' + a + ')', align: 'center' });
  }
  if (bannerT > 0) {
    ctx.globalAlpha = Math.min(1, bannerT * 2.4);
    g.text(banner, W * .5, 300, { size: 42, color: '#fff', align: 'center', stroke: 12 });
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- boot */
g.onReset = resetWorld;
g.onStart = () => { music('action'); sfx('meow'); g.showBanner('BALLISTIC BOUNCER', .9); };
resetWorld();

g.draw = () => {
  const ctx = g.ctx;
  drawBack(ctx);
  drawFrame(ctx);
  drawBricks(ctx);
  drawBumpers(ctx);
  drawBoard(ctx);
  drawBall(ctx);
  drawHud(ctx);
  /* vignette pillars in front for depth */
  const fg = ctx.createLinearGradient(0, 0, 0, H);
  fg.addColorStop(0, 'rgba(5,10,26,.55)'); fg.addColorStop(.12, 'rgba(5,10,26,0)');
  ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  if (g.fx.p.length > 400) g.fx.p.splice(0, 50);
};
g.update = update;

g.run(update, g.draw);

window.__g = g;
window.__dbg = () => ({ mode: g.mode, score: Math.round(g.score), lives, ball: { x: Math.round(ball.x), y: Math.round(ball.y) }, wave: waveN + 1, pump: +paddle.pump.toFixed(2) });

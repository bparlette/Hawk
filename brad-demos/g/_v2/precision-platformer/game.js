// CAT DASH — precision-platformer (Cat Arcade v2)
// Run and jump with coyote time + jump buffering + an air dash. Outrun the VOID that eats the level
// from behind, and plant the cat on the flag. Tight jumps, moving platforms, chunky landing squash.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, TAU, damp, hexA, panel } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'precision-platformer', title: 'CAT DASH', sub: 'RUN · JUMP · OUTRUN THE VOID',
  hook: 'one late jump and the void eats you', w: W, h: H, bg: '#080716',
  bloom: .9, ca: .42, vig: 1.04, scan: .14,
});
const isAuto = new URLSearchParams(location.search).has('auto');

/* ------------------------------------------------------------------ tuning */
const GROUND = 806;                       // world y of the ground surface
const FLAG_X = 5180;
const RUN = 285, JUMP_V = 745, G_UP = 2000, G_DOWN = 2420, MAXVY = 1250;
const DASH_V = 570, DASH_T = .2, DASH_CD = .46;
const COYOTE = .1, BUFFER = .13;
const PW = 30, PH = 46;

/* ------------------------------------------------------------------ level */
const SEGS = [[-320, 940], [1090, 1690], [1870, 2470], [2670, 3390], [3530, 4300], [4430, 5700]];
const GAPS = [];
for (let i = 0; i < SEGS.length - 1; i++) GAPS.push([SEGS[i][1], SEGS[i + 1][0]]);
const PLATS = [                            // one-way floating platforms {x,y,w}
  { x: 962, y: 728, w: 108 }, { x: 1140, y: 688, w: 120 },
  { x: 1706, y: 726, w: 104 }, { x: 2050, y: 686, w: 120 },
  { x: 2482, y: 730, w: 104 }, { x: 3010, y: 690, w: 130 }, { x: 3168, y: 566, w: 116 },
  { x: 3412, y: 726, w: 104 }, { x: 3988, y: 686, w: 130 }, { x: 4602, y: 688, w: 118 },
  { x: 4890, y: 588, w: 116 },
];
const MOVERS = [                           // rideable platforms
  { x: 1190, y: 656, w: 118, x0: 1120, x1: 1508, spd: 78, ph: 0 },
  { x: 2626, y: 730, w: 96, y0: 730, y1: 548, spd: 66, ph: .5, vert: 1 },
  { x: 2900, y: 634, w: 118, x0: 2846, x1: 3210, spd: 96, ph: .25 },
];
const SPIKES = [[1300, 100], [2120, 84], [3100, 96], [3880, 96], [4620, 84]];
const CKS = [70, 1900, 3560];              // respawn checkpoints
const COINS = [];
for (const [a, b] of GAPS) for (let i = 0; i < 4; i++) { const u = (i + .5) / 4; COINS.push({ x: a + (b - a) * u, y: GROUND - 76 - Math.sin(u * Math.PI) * 66, got: 0 }); }
for (const p of PLATS) for (let i = 0; i < 2; i++) COINS.push({ x: p.x + p.w * (.3 + i * .4), y: p.y - 44, got: 0 });
for (const [x, w] of SPIKES) COINS.push({ x: x + w / 2, y: GROUND - 96, got: 0 });
for (let i = 0; i < 5; i++) COINS.push({ x: 5000 + i * 34, y: GROUND - 60 - i * 8, got: 0 });

/* ------------------------------------------------------------------ state */
const pl = { x: 70, y: 0, vx: 0, vy: 0, dir: 1, ground: 0, coy: 0, buf: 0, dashT: 0, dashCd: 0, airDash: 0, juice: 0, stretch: 0, hurt: 0, iframe: 0, plat: null, run: 0 };
let camX = 0, camY = 0, coins, lives, score, spawnX, el, dead, deadT, won, wallX, autoT, tickT, ghosts, pct, shiver;
const hud = { l: '', r: '' };

const skyGrad = (() => { const c = document.createElement('canvas').getContext('2d'); const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#07091f'); gr.addColorStop(.42, '#171046'); gr.addColorStop(.72, '#3a1250'); gr.addColorStop(1, '#0a0716'); return gr; })();
const rockGrad = (() => { const c = document.createElement('canvas').getContext('2d'); const gr = c.createLinearGradient(0, GROUND, 0, GROUND + 220); gr.addColorStop(0, '#242a55'); gr.addColorStop(.45, '#161a38'); gr.addColorStop(1, '#0b0d1e'); return gr; })();
const wallGrad = (() => { const c = document.createElement('canvas').getContext('2d'); const gr = c.createLinearGradient(0, 0, 300, 0); gr.addColorStop(0, 'rgba(120,0,32,1)'); gr.addColorStop(.55, 'rgba(255,23,68,.92)'); gr.addColorStop(1, 'rgba(255,120,180,.0)'); return gr; })();
const beamGrad = (() => { const c = document.createElement('canvas').getContext('2d'); const gr = c.createLinearGradient(0, 60, 0, GROUND); gr.addColorStop(0, 'rgba(255,211,77,0)'); gr.addColorStop(1, 'rgba(255,211,77,.30)'); return gr; })();

const STARS = Array.from({ length: 70 }, () => ({ x: rnd(0, 1600), y: rnd(20, 520), s: rnd(.8, 2.4), p: rnd(.02, .09) }));
const FARS = Array.from({ length: 10 }, (_, i) => ({ x: i * 190 + rnd(-40, 40), w: rnd(160, 300), h: rnd(150, 330) }));
const MIDS = Array.from({ length: 12 }, (_, i) => ({ x: i * 150 + rnd(-30, 30), w: rnd(50, 96), h: rnd(90, 260), lit: rnd(0, 1) }));
const NEARS = Array.from({ length: 16 }, (_, i) => ({ x: i * 110 + rnd(-30, 30), w: rnd(28, 70), h: rnd(24, 70) }));
const MOTES = Array.from({ length: 26 }, () => ({ x: rnd(0, 700), y: rnd(180, 900), s: rnd(1.2, 3.4), p: rnd(.7, 1.3) }));

/* ------------------------------------------------------------------ helpers */
function segRects() { return SEGS; }
function moverPos(m, t) {
  if (m.vert) { const k = (Math.sin(t * m.spd / 92 + m.ph * TAU) + 1) / 2; return { y: lerp(m.y0, m.y1, k), dx: 0, dy: 0 }; }
  const k = (Math.sin(t * m.spd / 92 + m.ph * TAU) + 1) / 2;
  return { x: lerp(m.x0, m.x1, k) };
}
/** what can the cat land on at world x, if its feet are at feetY? returns top y or 1e9 */
function supportTop(x, feetY) {
  let best = 1e9;
  for (const s of SEGS) if (x >= s[0] - 2 && x <= s[1] + 2 && GROUND >= feetY - 24 && GROUND <= feetY + 300) best = Math.min(best, GROUND);
  for (const p of PLATS) if (x >= p.x - 2 && x <= p.x + p.w + 2 && p.y >= feetY - 24 && p.y <= feetY + 300) best = Math.min(best, p.y);
  for (const m of MOVERS) if (x >= m.x - 2 && x <= m.x + m.w + 2 && m.y >= feetY - 24 && m.y <= feetY + 300) best = Math.min(best, m.y);
  return best;
}
const overlapX = (a, b) => a.x + a.w > b.x + 2 && a.x < b.x + b.w - 2;

/* ------------------------------------------------------------------ reset */
function resetWorld() {
  pl.x = 70; pl.y = GROUND - PH; pl.vx = 0; pl.vy = 0; pl.dir = 1; pl.ground = 0; pl.coy = 0; pl.buf = 0;
  pl.dashT = 0; pl.dashCd = 0; pl.airDash = 0; pl.juice = 0; pl.stretch = 0; pl.hurt = 0; pl.iframe = 0; pl.plat = null; pl.run = 0;
  camX = 0; camY = 0; coins = 0; lives = 3; score = 0; spawnX = 70; el = 0; dead = 0; deadT = 0; won = 0; autoT = 0; tickT = 0; pct = 0; shiver = 0;
  wallX = pl.x - 380; ghosts = [];
  for (const c of COINS) c.got = 0;
  for (const m of MOVERS) { if (m.vert) m.y = m.y0; else m.x = m.x0; }
  g.score = 0; g.state = { score: 0, progress: 0, lives: 3, coins: 0, x: 70 };
  g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => music('chase');
resetWorld();

/* ------------------------------------------------------------------ feedback */
function puff(n, col) { g.fx.dust(pl.x + PW / 2, pl.y + PH, n, { color: col || 'rgba(150,220,255,.42)', size: 13, speed: 120, up: 40 }); }
function die() {
  if (dead || won) return;
  dead = 1e-6; pl.hurt = 1; lives--;
  sfx('splat'); g.hitstop(.08); g.punch(.18); g.shake(24); g.flash('#ff2e63', .38);
  g.fx.blast(pl.x + PW / 2, pl.y + PH / 2, { r: 74, color: '#ff2e63', colors: ['#ff2e63', '#fff', '#ffd34d'], n: 26, speed: 330 });
  g.slowmo(.26, .55); g.combo.miss();
  g.pops.length > 22 && g.pops.shift();
}
function respawn() {
  pl.x = spawnX; pl.y = GROUND - PH - 4; pl.vx = 0; pl.vy = 0; pl.hurt = 0; pl.iframe = .7; dead = 0; pl.dashCd = 0;
  wallX = pl.x - 420; camX = pl.x - 200; g.fx.clear();
  sfx('powerup'); g.flash('#7df9ff', .22); puff(10, 'rgba(125,249,255,.5)');
  g.fx.emit('ring', pl.x + PW / 2, pl.y + PH / 2, { size: 60, life: .5, color: '#7df9ff', add: true, wide: 6 });
}
function win() {
  if (won) return;
  won = 1;
  const bonus = Math.max(0, Math.round(700 - el * 16));
  score += bonus;
  sfx('fanfare'); g.punch(.2); g.shake(10); g.flash('#ffd34d', .5);
  for (let i = 0; i < 4; i++) g.fx.burst(FLAG_X + rnd(-60, 60), GROUND - 120 - i * 40, 22, { kind: 'confetti', color: ['#ffd34d', '#7df9ff', '#ff2e63', '#fff'], speed: 360, life: 1.4, g: 500 });
  g.popup('+' + bonus, FLAG_X, GROUND - 220, '#ffd34d', 40);
  g.end({ win: true, score: Math.round(score), label: 'SCORE', progress: 1 });
}

/* ------------------------------------------------------------------ input */
let IN = { l: 0, r: 0, jp: 0, jh: 0, dp: 0 };
const BOT = { jp: 0, jh: 0, dp: 0, l: 0, r: 1 };
function readInput() {
  const L = g.btn('l', 14, 838, 110, 100, '◀', { key: 'ArrowLeft' });
  const Rr = g.btn('r', 132, 838, 110, 100, '▶', { key: 'ArrowRight' });
  const J = g.btn('j', 404, 828, 122, 112, 'JUMP', { key: 'Space' });
  const D = g.btn('d', 300, 846, 96, 92, 'DASH', { key: 'KeyX' });
  const kl = L.held || g.keys.KeyA, kr = Rr.held || g.keys.KeyD;
  const jh = J.held || g.keys.Space || g.keys.KeyW || g.keys.ArrowUp;
  const jp = J.pressed || g.pressed.Space || g.pressed.KeyW || g.pressed.ArrowUp;
  const dp = D.pressed || g.pressed.KeyX || g.pressed.ShiftLeft;
  IN.l = kl ? 1 : 0; IN.r = kr ? 1 : 0; IN.jp = jp ? 1 : 0; IN.jh = jh ? 1 : 0; IN.dp = dp ? 1 : 0;
}
function readBot(dt) {
  IN.l = 0; IN.r = 1; IN.jp = 0; IN.jh = 0; IN.dp = 0;
  if (dead) return;
  const feet = pl.y + PH;
  if (g.dumb()) { if (pl.ground && Math.sin(el * 2.1) > .93) IN.jp = 1; return; }
  if (!pl.ground) { IN.jh = 1; return; }
  const front = pl.x + PW;
  let gap = 1e9;
  if (supportTop(front + 6, feet) > feet + 300) for (let d = 6; d < 330; d += 6) if (supportTop(front + d, feet) < feet + 300) { gap = d; break; }
  let spike = 0;
  for (const [sx, sw] of SPIKES) if (sx + sw > front + 4 && sx < front + 62) spike = 1;
  if (gap < 1e9) { IN.jp = 1; IN.jh = 1; IN.dp = gap > 170 ? 1 : 0; }
  else if (spike) { IN.jp = 1; IN.jh = 1; }
}

/* ------------------------------------------------------------------ physics */
function jump() {
  pl.vy = -JUMP_V; pl.ground = 0; pl.coy = 0; pl.buf = 0; pl.plat = null;
  pl.stretch = 1; pl.juice = -.35;
  sfx('jump', { pitch: 1 + (g.combo.n % 5) * .04 });
  g.fx.emit('ring', pl.x + PW / 2, pl.y + PH, { size: 30, life: .32, color: '#7df9ff', add: true, wide: 4 });
  puff(5);
}
function dash() {
  if (pl.dashCd > 0 || (pl.airDash <= 0 && !pl.ground)) return;
  if (!pl.ground) pl.airDash--;
  pl.dashT = DASH_T; pl.dashCd = DASH_CD;
  pl.vx = pl.dir * DASH_V;
  sfx('whoosh', { pitch: 1.1 }); g.punch(.06); g.shake(5);
  g.fx.burst(pl.x + PW / 2, pl.y + PH / 2, 12, { kind: 'spark', color: ['#7df9ff', '#fff', '#ffd34d'], speed: 260, life: .35, ang: Math.PI, spread: 1.2, g: 90 });
}

function physics(dt) {
  const p = pl;
  p.t = (p.t || 0) + dt;
  /* move platforms first, carrying the cat */
  for (const m of MOVERS) {
    const before = { x: m.x, y: m.y };
    const np = moverPos(m, g.t);
    if (m.vert) m.y = np.y; else m.x = np.x;
    m.dx = m.x - before.x; m.dy = m.y - before.y;
    if (p.plat === m) { p.x += m.dx; p.y += m.dy; }
  }
  /* horizontal */
  const want = (IN.r - IN.l) * RUN;
  if (p.dashT > 0) { p.dashT -= dt; p.vx = p.dir * DASH_V; }
  else p.vx = damp(p.vx, want, p.ground ? 26 : 12, dt);
  if (want) p.dir = Math.sign(want);
  p.x += p.vx * dt;
  if (p.x < -240) { p.x = -240; p.vx = 0; }
  for (const s of SEGS) {
    if (p.x + PW > s[0] && p.x < s[1] && p.y + PH > GROUND && p.y < GROUND + 240) {
      if (p.vx > 0) p.x = s[0] - PW; else if (p.vx < 0) p.x = s[1];
      p.vx = 0;
    }
  }
  /* vertical */
  const prevFeet = p.y + PH;
  const holding = IN.jh && p.vy < 0;
  p.vy = Math.min(p.vy + (holding ? G_UP : G_DOWN) * dt, MAXVY);
  p.y += p.vy * dt;
  const feet = p.y + PH;
  let landed = 0;
  p.ground = 0; p.plat = null;
  if (p.vy >= 0) {
    for (const s of SEGS) if (p.x + PW > s[0] + 2 && p.x < s[1] - 2 && feet >= GROUND && prevFeet <= GROUND + 14) { p.y = GROUND - PH; landed = GROUND; break; }
    if (!landed) for (const q of PLATS) if (p.vy >= 0 && overlapX(p, q) && feet >= q.y && prevFeet <= q.y + 12) { p.y = q.y - PH; landed = q.y; break; }
    if (!landed) for (const m of MOVERS) if (p.vy >= 0 && overlapX(p, m) && feet >= m.y && prevFeet <= m.y + 16) { p.y = m.y - PH; landed = m.y; p.plat = m; break; }
  }
  if (landed) {
    const hard = clamp(p.vy / 1250, 0, 1);
    if (!p.ground && p.vy > 120) {
      p.juice = .18 + hard * .55; p.stretch = 0; p.airDash = 1;
      sfx('thud', { pitch: 1.25 - hard * .35, vol: .5 + hard * .4 });
      g.punch(.04 + hard * .1); if (hard > .45) g.shake(4 + hard * 10);
      puff(4 + Math.round(hard * 8));
      if (hard > .35) g.fx.emit('ring', p.x + PW / 2, p.y + PH, { size: 26 + hard * 40, life: .3, color: '#bff5ff', add: true, wide: 4 });
    }
    p.vy = 0; p.ground = 1; p.coy = COYOTE;
  } else { p.coy = Math.max(0, p.coy - dt); p.airDash = p.airDash || (p.ground ? 1 : p.airDash); }
  if (!p.ground && p.airDash <= 0 && p.dashCd <= 0) p.airDash = 0;
  /* jump buffer */
  if (IN.jp) p.buf = BUFFER;
  p.buf = Math.max(0, p.buf - dt);
  if (p.buf > 0 && p.coy > 0) jump();
  if (p.dashCd > 0) p.dashCd -= dt;
  p.juice = damp(p.juice, 0, 11, dt);
  p.stretch = damp(p.stretch, 0, 9, dt);

  /* coins */
  for (const c of COINS) {
    if (c.got) continue;
    if (Math.abs(c.x - (p.x + PW / 2)) < 34 && Math.abs(c.y - (p.y + PH * .5)) < 40) {
      c.got = 1; coins++; score += 10 * g.combo.mult;
      g.combo.hit(c.x, c.y, '+' + (10 * g.combo.mult), );
      sfx('ding', { pitch: comboPitch(coins % 12), vol: .35 });
      g.fx.burst(c.x, c.y, 9, { kind: 'star', color: ['#ffd34d', '#fff6b0'], speed: 150, life: .5, g: 260 });
    }
  }
  /* spikes */
  for (const [sx, sw] of SPIKES) {
    if (p.x + PW > sx + 6 && p.x < sx + sw - 6 && p.y + PH > GROUND - 30 && p.y + PH < GROUND + 20) { die(); return; }
  }
  /* pits */
  if (p.y > 1180) { die(); return; }
  /* checkpoints */
  for (const cx of CKS) if (p.x > cx && spawnX < cx) { spawnX = cx; sfx('unlock', { vol: .3 }); g.popup('CHECKPOINT', pl.x, pl.y - 30, '#7df9ff', 24); g.fx.burst(cx, GROUND - 60, 12, { kind: 'glow', color: '#7df9ff', speed: 120, life: .6 }); }
  /* the void */
  const vspd = 244 + Math.min(120, el * 3.2);
  wallX = Math.min(p.x - 360, wallX + vspd * dt);
  if (p.x + PW * .5 < wallX) die();
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  readInput();
  if (isAuto && g.mode === 'play') { autoT += dt; readBot(dt); }
  else if (isAuto) { IN.l = IN.r = IN.jp = IN.jh = IN.dp = 0; }
  if (IN.dp && !dead) dash();

  if (dead) {
    dead += dt / Math.max(.2, g.timeScale);
    if (dead > .85) { if (lives <= 0) { g.end({ win: false, score: Math.round(score), label: 'SCORE', progress: pct }); } else respawn(); }
  } else if (!won && g.mode === 'play') {
    el += dt;
    physics(dt);
    if (pl.x + PW * .5 >= FLAG_X) win();
  }
  /* checkpoint / wall pressure */
  pct = clamp(pl.x / FLAG_X, 0, 1);
  shiver = clamp(1 - (pl.x - wallX) / 260, 0, 1);
  if (shiver > .1 && !dead) { tickT -= dt; if (tickT <= 0) { tickT = .38 - shiver * .2; sfx('tick', { vol: .12 + shiver * .2, pitch: .8 + shiver * .4 }); } }
  /* camera */
  const targetCam = clamp(pl.x - 196 + pl.vx * .12, -60, FLAG_X + 130 - W);
  camX = damp(camX, targetCam, 7, dt);
  camY = damp(camY, clamp((pl.y - GROUND) * .18, -70, 20), 5, dt);
  /* dash ghosts while dashing */
  if (pl.dashT > 0) { ghosts.push({ x: pl.x, y: pl.y, t: 0, dir: pl.dir }); if (ghosts.length > 12) ghosts.shift(); }
  for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].t += dt; if (ghosts[i].t > .3) ghosts.splice(i, 1); }
  if (pl.dashT > 0) g.fx.trailDot(pl.x + PW / 2, pl.y + PH * .6, { color: '#7df9ff', size: 20, life: .22 });

  g.score = Math.round(score);
  g.state = { score: Math.round(score), progress: +pct.toFixed(3), lives, coins, x: Math.round(pl.x), dead: !!dead, wall: Math.round(wallX) };
  if (isAuto && autoT > 60 && g.mode === 'play') win();
}
g.onUpdate = update;

/* ------------------------------------------------------------------ draw */
function bg(ctx) {
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  /* glow behind the horizon */
  const gx = W * .5, gy = 430;
  if (!bg._glow) { const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 460); gr.addColorStop(0, 'rgba(255,90,160,.20)'); gr.addColorStop(.5, 'rgba(120,60,200,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); bg._glow = gr; }
  ctx.fillStyle = bg._glow; ctx.fillRect(0, 0, W, H);
  /* stars */
  for (const s of STARS) {
    const x = ((s.x - camX * s.p) % 1600 + 1600) % 1600 - 300;
    ctx.globalAlpha = .25 + .55 * (1 - s.y / 560) * (.7 + .3 * Math.sin(g.t * 2 + s.x));
    ctx.fillStyle = '#dff3ff'; ctx.fillRect(x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  /* far mountains */
  ctx.fillStyle = '#1b1550';
  for (const m of FARS) {
    const x = ((m.x - camX * .1) % 1900 + 1900) % 1900 - 300;
    ctx.beginPath(); ctx.moveTo(x, 620); ctx.lineTo(x + m.w * .5, 620 - m.h); ctx.lineTo(x + m.w, 620); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(125,249,255,.10)';
  for (const m of FARS) { const x = ((m.x - camX * .1) % 1900 + 1900) % 1900 - 300; ctx.beginPath(); ctx.moveTo(x + m.w * .5, 620 - m.h); ctx.lineTo(x + m.w * .5 + 8, 620 - m.h + 90); ctx.lineTo(x + m.w * .5 - 8, 620 - m.h + 90); ctx.closePath(); ctx.fill(); }
  /* mid towers */
  for (const m of MIDS) {
    const x = ((m.x - camX * .28) % 1800 + 1800) % 1800 - 240;
    ctx.fillStyle = '#120f36'; ctx.fillRect(x, 650 - m.h, m.w, m.h + 260);
    ctx.fillStyle = 'rgba(125,249,255,.16)';
    for (let wy = 650 - m.h + 14; wy < 640; wy += 26) ctx.fillRect(x + 8, wy, m.w - 16, 5);
    if (m.lit > .72) { ctx.fillStyle = 'rgba(255,90,160,.5)'; ctx.fillRect(x + m.w * .5 - 2, 650 - m.h - 14, 4, 16); }
  }
  /* near dune band */
  ctx.fillStyle = '#0e1230';
  ctx.beginPath(); ctx.moveTo(-40, 760);
  for (const n of NEARS) { const x = ((n.x - camX * .55) % 1760 + 1760) % 1760 - 300; ctx.lineTo(x, 762 - n.h); ctx.lineTo(x + n.w * .5, 762 - n.h * .6); ctx.lineTo(x + n.w, 762); }
  ctx.lineTo(W + 40, 900); ctx.lineTo(-40, 900); ctx.closePath(); ctx.fill();
  /* fog band */
  ctx.fillStyle = 'rgba(125,249,255,.05)'; ctx.fillRect(0, 700, W, 120);
}

function drawGround(ctx) {
  for (const s of SEGS) {
    const x0 = Math.max(s[0], camX - 80), x1 = Math.min(s[1], camX + W + 80);
    if (x1 < x0) continue;
    ctx.fillStyle = rockGrad; ctx.fillRect(x0, GROUND, x1 - x0, 220);
    ctx.fillStyle = '#39e6c8'; ctx.fillRect(x0, GROUND - 6, x1 - x0, 10);
    ctx.fillStyle = 'rgba(190,255,250,.85)'; ctx.fillRect(x0, GROUND - 6, x1 - x0, 3);
    ctx.fillStyle = 'rgba(8,10,26,.55)';
    for (let x = Math.ceil(x0 / 48) * 48; x < x1; x += 48) ctx.fillRect(x, GROUND + 12, 46, 3);
    /* grass tufts */
    ctx.fillStyle = '#2fd2b8';
    for (let x = Math.ceil(x0 / 34) * 34; x < x1; x += 34) {
      const hh = 6 + 3 * Math.sin(x * .08 + g.t * 2.2);
      ctx.fillRect(x, GROUND - 6 - hh, 3, hh);
    }
  }
}
function drawPlatform(ctx, x, y, w, glowCol) {
  ctx.fillStyle = '#1d2352'; ctx.fillRect(x, y, w, 20);
  ctx.fillStyle = '#2b3480';
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = glowCol || '#39e6c8'; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w, 1.5);
  ctx.fillStyle = 'rgba(6,8,22,.6)'; ctx.fillRect(x, y + 20, w, 4);
  ctx.fillStyle = 'rgba(6,8,22,.75)';
  for (let i = 8; i < w - 6; i += 22) ctx.fillRect(x + i, y + 9, 6, 3);
}
function drawFlag(ctx) {
  const x = FLAG_X, base = GROUND;
  ctx.fillStyle = beamGrad; ctx.fillRect(x - 46, 40, 92, base - 40);
  ctx.globalAlpha = .5 + .2 * Math.sin(g.t * 3);
  ctx.fillStyle = beamGrad; ctx.fillRect(x - 18, 40, 36, base - 40);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e8f4ff'; ctx.fillRect(x - 4, base - 300, 8, 300);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(x, base - 304, 9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 3, base - 296);
  for (let i = 0; i <= 6; i++) { const u = i / 6; ctx.lineTo(x + 3 + u * 96, base - 296 + Math.sin(u * 5 + g.t * 7) * 10 + u * 6); }
  for (let i = 6; i >= 0; i--) { const u = i / 6; ctx.lineTo(x + 3 + u * 96, base - 232 + Math.sin(u * 5 + g.t * 7) * 10 + u * 6); }
  ctx.closePath();
  const fg = ctx.createLinearGradient(x, base - 300, x + 100, base - 230);
  fg.addColorStop(0, '#ffd34d'); fg.addColorStop(1, '#ff8a3c');
  ctx.fillStyle = fg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - 4, base - 300, 8, 300);
  /* base pad */
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 34, base - 8, 68, 8);
}
function drawVoid(ctx) {
  const wx = wallX;
  if (wx - camX < -340) return;
  ctx.save();
  ctx.translate(wx, 0);
  const wdt = 340;
  const gr = ctx.createLinearGradient(0, 0, wdt, 0);
  gr.addColorStop(0, 'rgba(90,0,26,1)'); gr.addColorStop(.5, 'rgba(232,10,60,.95)'); gr.addColorStop(.86, 'rgba(255,70,120,.55)'); gr.addColorStop(1, 'rgba(255,120,180,0)');
  ctx.fillStyle = gr; ctx.fillRect(-wdt, 0, wdt, H);
  /* jagged leading edge */
  ctx.beginPath(); ctx.moveTo(-wdt, 0);
  ctx.lineTo(-wdt, H);
  for (let y = H; y >= -40; y -= 26) ctx.lineTo(4 + Math.sin(y * .045 + g.t * 7) * 13 + Math.sin(y * .11 - g.t * 4) * 6, y);
  ctx.closePath(); ctx.fillStyle = '#2a0010'; ctx.fill();
  ctx.beginPath();
  for (let y = -40; y <= H; y += 20) { const xx = 4 + Math.sin(y * .045 + g.t * 7) * 13 + Math.sin(y * .11 - g.t * 4) * 6; if (y === -40) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); }
  ctx.strokeStyle = 'rgba(255,220,235,.9)'; ctx.lineWidth = 3.5; ctx.shadowColor = '#ff2e63'; ctx.shadowBlur = 22; ctx.stroke();
  ctx.shadowBlur = 0;
  /* embers */
  for (let i = 0; i < 10; i++) {
    const yy = ((g.t * (60 + i * 17) + i * 97) % (H + 80)) - 40;
    const xx = 10 + Math.sin(yy * .06 + i) * 24 + i * 5;
    ctx.globalAlpha = .25 + .5 * Math.abs(Math.sin(g.t * 3 + i));
    ctx.fillStyle = i % 3 ? '#ff2e63' : '#ffd34d';
    ctx.fillRect(xx, yy, 3 + (i % 3), 3 + (i % 3));
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function draw(ctx) {
  bg(ctx);
  ctx.save();
  ctx.translate(-camX, 0);
  /* parallax-less world */
  ctx.save(); ctx.translate(0, camY);
  drawGround(ctx);
  ctx.globalAlpha = .9;
  for (const [sx, sw] of SPIKES) {
    for (let x = sx; x < sx + sw; x += 17) {
      ctx.fillStyle = '#ff2e63';
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 8.5, GROUND - 30); ctx.lineTo(x + 17, GROUND); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.moveTo(x + 5, GROUND - 6); ctx.lineTo(x + 8.5, GROUND - 30); ctx.lineTo(x + 12, GROUND - 6); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const p of PLATS) { if (p.x + p.w < camX - 60 || p.x > camX + W + 60) continue; drawPlatform(ctx, p.x, p.y, p.w, '#39e6c8'); }
  for (const m of MOVERS) {
    if (m.x + m.w < camX - 60 || m.x > camX + W + 60) continue;
    ctx.globalAlpha = .22; ctx.fillStyle = '#7df9ff'; ctx.fillRect(m.x, m.y, m.w, 20); ctx.globalAlpha = 1;
    drawPlatform(ctx, m.x, m.y, m.w, '#ffd34d');
    ctx.fillStyle = 'rgba(255,211,77,.9)';
    for (let i = 0; i < 3; i++) { const bx = m.x + m.w * .5 - 10 + i * 10; ctx.fillRect(bx, m.y + 11, 6, 3); }
  }
  /* coins */
  for (const c of COINS) {
    if (c.got || c.x < camX - 40 || c.x > camX + W + 40) continue;
    const bob = Math.sin(g.t * 3 + c.x * .02) * 4;
    ctx.save(); ctx.translate(c.x, c.y + bob);
    ctx.globalAlpha = .35; ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    const w2 = Math.abs(Math.cos(g.t * 3.4 + c.x * .05)) * 10 + 4;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(0, 0, w2, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.ellipse(0, 0, w2 * .55, 6.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawFlag(ctx);
  /* dash ghosts */
  for (const gh of ghosts) {
    ctx.globalAlpha = (1 - gh.t / .3) * .35;
    drawChar('cat', ctx, gh.x + PW / 2, gh.y + PH, 62, { dir: gh.dir, t: g.t, color: '#7df9ff', anim: 'walk' });
  }
  ctx.globalAlpha = 1;
  /* the cat */
  if (!(dead && dead > .3)) {
    const sq = pl.juice, st = pl.stretch;
    const sx = 1 + sq * .75 - st * .18, sy = 1 - sq * .7 + st * .22;
    const bob = pl.ground && Math.abs(pl.vx) < 30 ? Math.sin(g.t * 6) * .02 : 0;
    ctx.save();
    ctx.translate(pl.x + PW / 2, pl.y + PH);
    if (pl.iframe > 0) ctx.globalAlpha = .45 + .45 * Math.sin(g.t * 40);
    ctx.scale(sx, sy + bob);
    drawChar('cat', ctx, 0, 0, 64, { dir: pl.dir, t: g.t, color: pl.hurt ? '#ff6b6b' : '#ff9a3c', anim: pl.ground && Math.abs(pl.vx) > 20 ? 'walk' : 'idle', hurt: pl.hurt > 0 });
    ctx.restore();
    /* dash sparks behind */
    if (pl.dashT > 0) {
      ctx.globalAlpha = .5; ctx.fillStyle = '#7df9ff';
      ctx.fillRect(pl.x - pl.dir * 16, pl.y + 12, 14, 3);
      ctx.fillRect(pl.x - pl.dir * 24, pl.y + 24, 10, 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  drawVoid(ctx);
  ctx.restore();

  /* foreground motes */
  for (const m of MOTES) {
    const x = ((m.x - camX * m.p * .9 - g.t * 12 * m.p) % 700 + 700) % 700 - 80;
    ctx.globalAlpha = .10 + .12 * Math.sin(g.t * 2 + m.x);
    ctx.fillStyle = '#bff5ff'; ctx.fillRect(x, m.y + Math.sin(g.t + m.x) * 12, m.s, m.s);
  }
  ctx.globalAlpha = 1;
  /* vignette-ish corner silhouettes */
  ctx.fillStyle = 'rgba(6,7,20,.55)';
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H - 120); ctx.quadraticCurveTo(90, H - 60, 170, H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W, H - 140); ctx.quadraticCurveTo(W - 100, H - 70, W - 180, H); ctx.closePath(); ctx.fill();

  /* danger edge glow */
  if (shiver > .05) {
    ctx.globalAlpha = shiver * (.35 + .25 * Math.sin(g.t * 12));
    const dg = ctx.createLinearGradient(0, 0, 90, 0);
    dg.addColorStop(0, 'rgba(255,23,68,.95)'); dg.addColorStop(1, 'rgba(255,23,68,0)');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, 90, H);
    ctx.globalAlpha = 1;
  }
  drawHUD(ctx);
}

function drawHUD(ctx) {
  /* score */
  g.text(String(Math.round(score)).padStart(3, '0'), 26, 74, { size: 58, color: '#fff', ink: '#0a0a18' });
  g.text('SCORE', 30, 96, { size: 18, color: '#8fd6ff', stroke: 3 });
  /* coins */
  ctx.save(); ctx.translate(W - 122, 52);
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, TAU); ctx.fill();
  ctx.restore();
  g.text('× ' + coins, W - 100, 64, { size: 38, color: '#ffd34d', ink: '#0a0a18' });
  /* lives */
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(W - 150 + i * 22 - 52, 96);
    ctx.globalAlpha = i < lives ? 1 : .22;
    drawChar('cat', ctx, 0, 8, 22, { dir: 1, t: g.t, color: '#ff9a3c' });
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  /* progress rail */
  const bx = 30, by = 132, bw = W - 60, bh = 16;
  ctx.fillStyle = 'rgba(6,8,22,.75)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(160,200,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  pg.addColorStop(0, '#39e6c8'); pg.addColorStop(.7, '#7df9ff'); pg.addColorStop(1, '#ffd34d');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(bx + 2, by + 2, Math.max(0, (bw - 4) * pct), bh - 4, 6); ctx.fill();
  /* cat marker + flag */
  ctx.save(); ctx.translate(bx + (bw - 4) * pct + 2, by + bh / 2); ctx.scale(.62, .62);
  drawChar('cat', ctx, 0, 12, 30, { dir: 1, t: g.t, color: '#fff' }); ctx.restore();
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(bx + bw - 6, by - 14, 3, 26);
  ctx.beginPath(); ctx.moveTo(bx + bw - 3, by - 14); ctx.lineTo(bx + bw + 12, by - 9); ctx.lineTo(bx + bw - 3, by - 4); ctx.closePath(); ctx.fill();
  g.text('GOAL', bx + bw - 10, by - 18, { size: 16, align: 'right', color: '#ffe9a8', stroke: 3 });
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ x: Math.round(pl.x), y: Math.round(pl.y), ground: pl.ground, lives, dead: !!dead, wall: Math.round(wallX), autoT: +autoT.toFixed(2), pct: +pct.toFixed(2) });

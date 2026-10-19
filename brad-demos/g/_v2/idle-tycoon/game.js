// CAT CAFÉ TYCOON — idle-tycoon (Cat Arcade v2)
// Tap the counter to serve, buy stations to compound income, hit 15,000 coins before the clock dies.
import { makeGame, sfx, music, comboPitch, clamp, lerp, damp, rnd, chance, ease, TAU, rr, circle, hexA, fmt } from '../_vendor/gp2x.js';
import { drawChar, face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'idle-tycoon', title: 'CAT CAFÉ', sub: 'TAP TO SERVE  ·  BUILD THE CAFÉ',
  hook: 'the café builds itself while you tap', w: W, h: H, bg: '#1a1024', style: 'soft',
  bloom: .78, ca: .3, vig: .95, scan: .12,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const dumb = () => isAuto && g.dumb();

/* ------------------------------------------------------------------ economy
   Tuned headlessly: a decisive bot reaches 15,000 in ~13-18s, a real player in ~30-45s.
   Each station level compounds (×1.13^lv) so buying always feels like a jump, never a drip. */
const ST = [
  { id: 'bean', name: 'BEANS', cost: 15, r: 4, col: '#c98a4b', col2: '#7a4a1c' },
  { id: 'grind', name: 'GRINDER', cost: 70, r: 18, col: '#8fd6ff', col2: '#2a5a7a' },
  { id: 'esp', name: 'ESPRESSO', cost: 300, r: 80, col: '#ff9a3c', col2: '#8a3c10' },
  { id: 'pastry', name: 'PASTRY', cost: 1200, r: 340, col: '#ff7ad0', col2: '#7a1a5a' },
  { id: 'robo', name: 'ROBO-CAT', cost: 4800, r: 1500, col: '#7dff7d', col2: '#1a6a2a' },
];
const GROW = 1.13;
const GOAL = 15000;
const MILESTONES = [1000, 5000, 10000, GOAL];

/* ------------------------------------------------------------------ state */
let coins, total, income, lv, t, round, queue, customers, coinArcs, steam, rush, rushCd;
let serveFlash, rushFlash, cardPop, shownCoins, hearts, lastTold, spawnT, serveCombo, comboT;
let botTapT, botBuyT, botRushT, banner, bannerT;

const isDumb = () => dumb();
const ROUND = () => (isDumb() ? 16 : 75);
const SLOT_W = 98, SLOT_GAP = 8;
const slotX = i => 14 + i * (SLOT_W + SLOT_GAP);
const CARD_Y = 726, CARD_H = 186;
const SERVE = { x: 24, y: 404, w: 492, h: 286 };
const RUSH = { x: 392, y: 108, w: 130, h: 62 };

const cash = () => income;   // coins/sec right now (rush doubles it at use time)
const rateAt = (lvN, r) => r * lvN * Math.pow(GROW, Math.max(0, lvN - 1));
function recompute() { income = 0; for (let i = 0; i < ST.length; i++) income += rateAt(lv[i], ST[i].r); }

/* ------------------------------------------------------------------ world */
function resetWorld() {
  coins = 0; total = 0; income = 0; t = 0; round = ROUND();
  lv = ST.map(() => 0);
  queue = []; customers = []; coinArcs = []; steam = [];
  rush = 0; rushCd = 0; serveFlash = 0; rushFlash = 0;
  cardPop = ST.map(() => 0); shownCoins = 0; hearts = 3; lastTold = -1;
  spawnT = .5; serveCombo = 0; comboT = 0;
  botTapT = 0; botBuyT = 0; botRushT = 0; banner = ''; bannerT = 0;
  g.score = 0;
  g.state = { coins: 0, income: 0, level: 0 };
  g.combo.reset(); g.fx.clear();
  recompute();
}
g.onReset = resetWorld;
g.onStart = () => music('cozy');

/* ------------------------------------------------------------------ juice */
const MILESTONE_COL = ['#ffd34d', '#7dff7d', '#ff7ad0', '#9ff8ff'];

function juice(x, y, o = {}) {
  const k = o.s ?? 1, c = o.c || '#ffd34d';
  g.burst(x, y, 5 + k * 8, { color: [c, '#ffffff'], speed: 130 + k * 140, life: .35 + k * .3, size: 4 + k * 3 });
  g.fx.emit('ring', x, y, { size: 10 + k * 14, life: .26, color: c, add: true, wide: 3 });
  if (k > .7) { g.shake(1.5 + k * 3); g.punch(.018 + .012 * k); }
  if (o.f) g.flash(c, .08 + .04 * k);
}
function floatCoins(x, y, n) {
  // coins arc from the customer to the counter meter — the "money" reads as physical
  const k = Math.min(9, 3 + Math.floor(n / 4));
  for (let i = 0; i < k; i++) {
    coinArcs.push({ x: x + rnd(-10, 10), y: y + rnd(-8, 8), t: -i * .035, d: .46 + Math.random() * .12, x0: x, y0: y, spin: rnd(-8, 8) });
  }
  if (coinArcs.length > 120) coinArcs.splice(0, coinArcs.length - 120);
}

function serve() {
  if (g.mode !== 'play') return;
  const haveCustomer = queue.length > 0;
  const base = 8 + Math.min(14, Math.floor(t * .8));
  const tipMul = haveCustomer ? 1 + Math.min(.9, serveCombo * .09) : .38;
  const gain = Math.max(1, Math.round(base * tipMul * (rush > 0 ? 2 : 1)));
  coins += gain; total += gain; g.score = Math.round(total);
  serveCombo++; comboT = 1.6;
  const cx = haveCustomer ? queue[0].x : 300, cy = haveCustomer ? queue[0].y : 560;
  floatCoins(cx, cy, gain);
  if (haveCustomer) {
    const c = queue.shift();
    c.leaving = 1; c.lt = 0;
    sfx('ding', { pitch: 1.05 + Math.min(.6, serveCombo * .045) });
    sfx('coin', { pitch: 1.2 + Math.min(.5, serveCombo * .04), vol: .5 });
    g.popup('+' + gain, cx, cy - 52, '#ffd34d', 34);
    g.fx.burst(cx, cy - 26, 10, { kind: 'star', color: ['#ffd34d', '#fff', '#ff9a3c'], speed: 200, life: .5, size: 7, g: 380 });
    g.fx.ring(cx, cy - 26, { r: 54, life: .3, color: '#ffd34d', wide: 5, ripple: .5 });
    g.impact(cx, cy - 26, { punch: .035, shake: 4, stop: .02 });
    juice(cx, cy - 26, { s: .5 + Math.min(1, serveCombo * .1), c: '#ffd34d' });
  } else {
    sfx('tick', { pitch: 1 + Math.min(.4, serveCombo * .03), vol: .35 });
    g.fx.burst(cx, cy, 4, { kind: 'spark', color: ['#ffd34d', '#fff'], speed: 130, life: .3, size: 4 });
  }
  serveFlash = 1;
  if (serveCombo > 4 && serveCombo % 5 === 0) {
    g.popup('CHEF CHAIN ×' + serveCombo, 270, 396, '#9ff8ff', 26);
    sfx('chime', { pitch: comboPitch(serveCombo), vol: .5 });
  }
  if (coinArcs.length > 100) coinArcs.splice(0, coinArcs.length - 100);
}

function buy(i) {
  const s = ST[i];
  if (g.mode !== 'play' || coins < s.cost) { sfx('click', { pitch: .8, vol: .4 }); cardPop[i] = 1; return; }
  coins -= s.cost; lv[i]++;
  recompute();
  const before = s.r * (lv[i] - 1) * Math.pow(GROW, Math.max(0, lv[i] - 2));
  const gain = rateAt(lv[i], s.r) - (lv[i] > 1 ? before : 0);
  const x = slotX(i) + SLOT_W / 2, y = CARD_Y + 40;
  const pitch = 1 + Math.min(.9, lv[i] * .07);
  sfx('powerup', { pitch }); sfx('powerup', { pitch: pitch * 1.1, vol: .55 });
  sfx('chime', { pitch: pitch * 1.05, vol: .5 });
  g.impact(x, y, { punch: .075, shake: 9, stop: .05, rip: 1.1, flash: s.col, flashA: .1 });
  juice(x, y, { s: 1.6, c: s.col, f: 1 });
  g.fx.burst(x, y, 22, { kind: 'spark', color: [s.col, '#fff', s.col2], speed: 330, life: .5, size: 5.5, drag: 2 });
  g.fx.burst(x, y, 8, { kind: 'star', color: [s.col, '#fff'], speed: 170, life: .7, size: 9, g: 300 });
  g.fx.ring(x, y, { r: 96, life: .36, color: s.col, wide: 6, ripple: .9 });
  cardPop[i] = 1.6;
  g.popup('+' + Math.round(gain) + '/s', x, y - 46, s.col, 28);
  g.tween({ v: 0 }, 'v', 1, .3, ease.outCubic);
  if (lv[i] === 1) { g.showBanner(s.name + ' OPEN!', 1.0); g.flash(s.col, .16); }
}

function useRush() {
  if (g.mode !== 'play' || rushCd > 0) { sfx('click', { pitch: .7, vol: .4 }); return; }
  rush = 5; rushCd = 12; rushFlash = 1;
  sfx('win', { pitch: 1.1 }); sfx('powerup', { pitch: 1.3 });
  g.punch(.11); g.shake(10);
  g.flash('#ffd34d', .28);
  juice(270, 300, { s: 2.2, c: '#ffd34d' });
  g.showBanner('RUSH HOUR ×2!', 1.1);
  g.fx.burst(452, 140, 26, { kind: 'star', color: ['#ffd34d', '#fff', '#ff9a3c'], speed: 300, life: .8, size: 9, g: 260 });
  g.fx.ring(452, 140, { r: 120, life: .4, color: '#ffd34d', wide: 8, ripple: 1.2 });
  if (rushCd > 0) queue.forEach(c => c.happy = 1);
}

/* ------------------------------------------------------------------ customers */
const CUST_KINDS = ['cat', 'dog', 'cat', 'person'];
function spawnCustomer() {
  const slot = queue.length;
  if (slot > 2) return;
  queue.push({
    x: 430 + slot * 6, y: 560 - slot * 4, ty: 596,
    kind: CUST_KINDS[Math.floor(Math.random() * CUST_KINDS.length) % CUST_KINDS.length],
    col: ['#ff9a3c', '#c98a4b', '#8fd6ff', '#ff7ad0'][Math.floor(Math.random() * 4)],
    hop: Math.random() * TAU, mood: 1, happy: 0, leaving: 0, lt: 0,
  });
  sfx('step', { pitch: 1.3, vol: .2 });
  juice(430 + slot * 6, 560 - slot * 4, { s: .3, c: '#9ff8ff' });
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;
  round -= dt;
  rushCd = Math.max(0, rushCd - dt);
  rush = Math.max(0, rush - dt);
  serveFlash = Math.max(0, serveFlash - dt * 3.2);
  rushFlash = Math.max(0, rushFlash - dt * 2);
  comboT -= dt; if (comboT <= 0) serveCombo = 0;
  for (let i = 0; i < ST.length; i++) cardPop[i] = Math.max(0, cardPop[i] - dt * 3.4);

  /* income ticks in — visible money, not a silent number */
  const before = coins;
  coins += income * (rush > 0 ? 2 : 1) * dt;
  if (coins > before) { total += coins - before; g.score = Math.floor(total); }
  shownCoins = damp(shownCoins, coins, 12, dt);

  /* customers wander in; the café never sits still */
  spawnT -= dt;
  if (spawnT <= 0) { spawnT = isDumb() ? 99 : .75 + Math.random() * .5; spawnCustomer(); }
  for (let i = queue.length - 1; i >= 0; i--) {
    const c = queue[i];
    c.hop += dt * 3;
    c.x = damp(c.x, 300 + i * 78, 6, dt);
    c.y = damp(c.y, c.ty, 6, dt);
  }

  /* coin arcs */
  for (let i = coinArcs.length - 1; i >= 0; i--) {
    const a = coinArcs[i]; a.t += dt;
    if (a.t >= a.d) coinArcs.splice(i, 1);
  }

  /* station steam: the espresso bar breathes once it exists */
  if (lv[2] > 0 && Math.random() < dt * 6 * Math.min(3, lv[2])) {
    steam.push({ x: slotX(2) + SLOT_W / 2 + rnd(-14, 14), y: CARD_Y + 24, t: 0, life: 1.4, r: rnd(6, 12) });
    if (steam.length > 40) steam.shift();
  }
  for (let i = steam.length - 1; i >= 0; i--) { const s = steam[i]; s.t += dt; s.y -= dt * 42; if (s.t > s.life) steam.splice(i, 1); }

  /* milestone fanfare */
  let mi = -1;
  for (let i = 0; i < MILESTONES.length; i++) if (total >= MILESTONES[i]) mi = i;
  if (mi > lastTold) {
    lastTold = mi;
    if (mi < MILESTONES.length - 1) {
      g.showBanner(['1,000 COINS!', '5,000 COINS!', '10,000 COINS!'][mi], 1.2);
      sfx('win', { pitch: 1 + mi * .12 });
      g.flash(MILESTONE_COL[mi], .2); g.punch(.1); g.shake(9);
      juice(W / 2, 300, { s: 2.6, c: MILESTONE_COL[mi], f: 1, p: '+' + [1000, 5000, 10000][mi] });
      g.fx.burst(270, 420, 30, { kind: 'star', color: [MILESTONE_COL[mi], '#fff', '#ffd34d'], speed: 340, life: .9, size: 10, g: 300 });
    }
  }

  /* input: taps land on the counter (serve), a station card (buy) or rush */
  for (let ti = 0; ti < g.taps.length; ti++) {
    const p = g.taps[ti];
    handleTap(p.x, p.y);
  }
  if (g.pressed.Space || g.pressed.Enter) serve();
  if (g.pressed.KeyR) useRush();
  for (let i = 0; i < 5; i++) if (g.pressed['Digit' + (i + 1)]) buy(i);
  if (g.keys.KeyA || g.keys.KeyD) { /* held-key serving for keyboard players */ if (!g._holdServ || t - g._holdServ > .16) { g._holdServ = t; serve(); } }

  /* bot: plays through the same handlers the player's fingers hit */
  if (isAuto) {
    botTapT -= dt; botBuyT -= dt; botRushT -= dt;
    if (isDumb()) { if (botTapT <= 0) { botTapT = 1.3; serve(); } }
    else if (botTapT <= 0) { botTapT = .18 + Math.random() * .05; serve(); }
    if (!isDumb() && botBuyT <= 0) {
      botBuyT = .16 + Math.random() * .1;
      let best = -1;
      for (let i = ST.length - 1; i >= 0; i--) if (coins >= ST[i].cost) { best = i; break; }
      if (best >= 0) buy(best);
    }
    if (!isDumb() && botRushT <= 0 && rushCd <= 0 && income > 30) { botRushT = 1.4; useRush(); }
  }

  bannerT -= dt;

  /* terminal paths — win and lose both land with a real number */
  const prog = clamp(total / GOAL, 0, 1);
  if (coins >= GOAL || total >= GOAL) {
    g.end({ win: true, score: Math.round(total), label: 'COINS', progress: 1 });
    return;
  }
  if (round <= 0) {
    g.end({ win: false, score: Math.round(total), label: 'COINS', progress: prog });
  }
  g.state = { coins: Math.floor(coins), income: Math.round(income), level: lv.reduce((a, b) => a + b, 0), progress: +prog.toFixed(2) };
}

function handleTap(x, y) {
  if (x >= RUSH.x && x <= RUSH.x + RUSH.w && y >= RUSH.y && y <= RUSH.y + RUSH.h) { useRush(); return; }
  for (let i = 0; i < ST.length; i++) {
    const sx = slotX(i);
    if (x >= sx && x <= sx + SLOT_W && y >= CARD_Y && y <= CARD_Y + CARD_H) { buy(i); return; }
  }
  if (x >= SERVE.x && x <= SERVE.x + SERVE.w && y >= SERVE.y && y <= SERVE.y + SERVE.h) serve();
}

/* ------------------------------------------------------------------ backdrop */
function drawRoom(ctx) {
  const sk = ctx.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#2a1636'); sk.addColorStop(.42, '#3a1f3e'); sk.addColorStop(.72, '#241426');
  sk.addColorStop(1, '#160e1c');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);

  /* hanging lamps with warm pools of light (parallax 0.3) */
  for (let i = 0; i < 3; i++) {
    const lx = 96 + i * 174 + Math.sin(t * .5 + i) * 4, ly = 96 + i % 2 * 26;
    ctx.strokeStyle = 'rgba(255,220,150,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(lx, ly + 16, 2, lx, ly + 16, 120);
    gl.addColorStop(0, 'rgba(255,214,140,.34)'); gl.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, ly + 16, 120, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd98a'; rr(ctx, lx - 15, ly, 30, 20, 9); ctx.fill();
    ctx.fillStyle = '#c98a4b'; rr(ctx, lx - 3, ly - 10, 6, 12, 3); ctx.fill();
  }

  /* shelf of jars — the café visibly stocks up as you buy beans */
  ctx.save(); ctx.globalAlpha = .55;
  ctx.fillStyle = '#4a2f52'; rr(ctx, 30, 208, 480, 12, 6); ctx.fill();
  rr(ctx, 30, 286, 480, 12, 6); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const jx = 52 + i * 52, lvl = lv[0] > i ? 1 : 0;
    if (!lvl) { ctx.globalAlpha = .2; }
    ctx.fillStyle = ['#c98a4b', '#8fd6ff', '#ff9a3c', '#ff7ad0', '#7dff7d'][i % 5];
    rr(ctx, jx, 172 - (i % 3) * 4, 22, 36, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, jx + 4, 176, 6, 26, 3); ctx.fill();
    ctx.globalAlpha = .55;
  }
  ctx.restore();

  /* floor + counter run */
  ctx.fillStyle = '#2c1a2e'; ctx.fillRect(0, 700, W, H - 700);
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const y = 706 + i * 30; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const cf = ctx.createLinearGradient(0, 596, 0, 710);
  cf.addColorStop(0, '#7a4a3a'); cf.addColorStop(.5, '#5c3328'); cf.addColorStop(1, '#3a1f1c');
  ctx.fillStyle = cf; rr(ctx, 0, 596, W, 116, 0); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,180,.13)'; rr(ctx, 0, 596, W, 8, 4); ctx.fill();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(24 + i * 92, 616, 70, 74); }
}

/* ------------------------------------------------------------------ serve floor */
function drawCustomers(ctx) {
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const h = 104 - i * 6;
    const bob = Math.sin(c.hop) * 3;
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, i - 1) * .18;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 4, 26, 8, 0, 0, TAU); ctx.fill();
    if (c.happy > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .5; }
    drawChar(c.kind, ctx, c.x, c.y + bob, h, { color: c.col });
    ctx.restore();
    // speech bubble = "serve me" affordance, readable at a glance
    if (i === 0) {
      const bx = c.x + 4, by = c.y - h - 26 + bob;
      ctx.fillStyle = 'rgba(255,255,255,.94)'; rr(ctx, bx - 24, by - 22, 48, 30, 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 8, by + 7); ctx.lineTo(bx + 2, by + 16); ctx.lineTo(bx + 6, by + 7); ctx.fill();
      face(ctx, 'cat', bx, by - 7, 12, '#ff9a3c');
    }
  }
}

function drawBarista(ctx) {
  const bob = Math.sin(t * 2.2) * 2;
  const lift = serveFlash * 10;
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(150, 640, 36, 10, 0, 0, TAU); ctx.fill();
  drawChar('cat', ctx, 150, 630 + bob - lift, 122, { color: '#f1c27d' });
  // apron
  ctx.fillStyle = 'rgba(255,255,255,.9)'; rr(ctx, 128, 566 + bob - lift, 44, 40, 8); ctx.fill();
  ctx.fillStyle = '#ff7ad0'; rr(ctx, 144, 574 + bob - lift, 12, 24, 4); ctx.fill();
  // serving tray
  ctx.save(); ctx.translate(196, 574 + bob - lift); ctx.rotate(-.08 + serveFlash * .2);
  ctx.fillStyle = '#c9a06a'; rr(ctx, -22, -4, 44, 7, 3); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, -14, -14, 12, 12, 3); ctx.fill();
  ctx.fillStyle = '#ff9a3c'; rr(ctx, 2, -16, 14, 14, 3); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ station cards */
function drawStationIcon(ctx, i, x, y, s) {
  const st = ST[i], lvN = lv[i];
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (i === 0) {           // bean jar
    ctx.fillStyle = hexA(st.col, .9); rr(ctx, -18, -20, 36, 40, 8); ctx.fill();
    ctx.fillStyle = '#3a2010';
    for (let k = 0; k < 3 + Math.min(6, lvN); k++) { ctx.beginPath(); ctx.ellipse(-9 + (k % 3) * 9, -6 + Math.floor(k / 3) * 10, 4.5, 6, .5, 0, TAU); ctx.fill(); }
  } else if (i === 1) {    // grinder
    ctx.fillStyle = '#8fd6ff'; rr(ctx, -16, -22, 32, 26, 5); ctx.fill();
    ctx.fillStyle = '#dff6ff'; rr(ctx, -12, -18, 8, 18, 3); ctx.fill();
    ctx.fillStyle = '#2a5a7a'; rr(ctx, -14, 4, 28, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 13, 4, 0, TAU); ctx.fill();
  } else if (i === 2) {    // espresso machine
    ctx.fillStyle = '#ff9a3c'; rr(ctx, -20, -18, 40, 30, 6); ctx.fill();
    ctx.fillStyle = '#2a1208'; rr(ctx, -12, -12, 10, 8, 2); ctx.fill(); rr(ctx, 2, -12, 10, 8, 2); ctx.fill();
    ctx.fillStyle = '#fff'; rr(ctx, -8, 14, 16, 8, 3); ctx.fill();
    if (lvN > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, -16, -16, 6, 26, 3); ctx.fill(); }
  } else if (i === 3) {    // pastry case
    ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, -20, -20, 40, 36, 5); ctx.fill();
    ctx.fillStyle = '#ff7ad0';
    for (let k = 0; k < 2 + Math.min(4, lvN); k++) { ctx.beginPath(); ctx.arc(-10 + (k % 2) * 18, -6 + Math.floor(k / 2) * 12, 6, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; rr(ctx, -20, -20, 40, 36, 5); ctx.stroke();
  } else {                 // robo-cat
    ctx.fillStyle = '#7dff7d'; rr(ctx, -18, -18, 36, 32, 8); ctx.fill();
    ctx.fillStyle = '#0a2a10'; ctx.beginPath(); ctx.arc(-7, -4, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(7, -4, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; rr(ctx, -8, 8, 16, 4, 2); ctx.fill();
    ctx.fillStyle = '#7dff7d'; ctx.beginPath(); ctx.moveTo(-16, -18); ctx.lineTo(-8, -28); ctx.lineTo(-2, -18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -18); ctx.lineTo(8, -28); ctx.lineTo(2, -18); ctx.fill();
  }
  ctx.restore();
}

function drawCards(ctx) {
  for (let i = 0; i < ST.length; i++) {
    const st = ST[i], x = slotX(i), lvN = lv[i];
    const can = coins >= st.cost;
    const pop = cardPop[i];
    const owned = lvN > 0;
    ctx.save();
    ctx.translate(x + SLOT_W / 2, CARD_Y + CARD_H / 2);
    const sc = 1 + pop * .06;
    ctx.scale(sc, 1 / sc);
    ctx.translate(-x - SLOT_W / 2, -CARD_Y - CARD_H / 2);

    ctx.fillStyle = 'rgba(0,0,0,.42)'; rr(ctx, x + 3, CARD_Y + 5, SLOT_W, CARD_H, 14); ctx.fill();
    const cg = ctx.createLinearGradient(x, CARD_Y, x, CARD_Y + CARD_H);
    if (owned) { cg.addColorStop(0, hexA(st.col, .38)); cg.addColorStop(1, 'rgba(18,10,24,.92)'); }
    else { cg.addColorStop(0, 'rgba(70,50,80,.7)'); cg.addColorStop(1, 'rgba(18,10,24,.92)'); }
    ctx.fillStyle = cg; rr(ctx, x, CARD_Y, SLOT_W, CARD_H, 14); ctx.fill();
    ctx.strokeStyle = can ? (owned ? st.col : '#ffd34d') : 'rgba(255,255,255,.16)';
    ctx.lineWidth = can ? 3 : 2; rr(ctx, x, CARD_Y, SLOT_W, CARD_H, 14); ctx.stroke();

    drawStationIcon(ctx, i, x + SLOT_W / 2, CARD_Y + 52, .95 + Math.min(.35, lvN * .05));
    g.text(st.name, x + SLOT_W / 2, CARD_Y + 104, { size: 17, align: 'center', stroke: 3, color: owned ? '#fff' : 'rgba(255,255,255,.72)' });

    /* level pips — growth you can count at a glance */
    const pips = Math.min(6, lvN), px0 = x + SLOT_W / 2 - (6 * 7) / 2 + 2;
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k < pips ? st.col : 'rgba(255,255,255,.15)';
      rr(ctx, px0 + k * 7, CARD_Y + 116, 5, 9, 2.5); ctx.fill();
    }
    if (owned) g.text(fmt(rateAt(lvN, st.r)) + '/s', x + SLOT_W / 2, CARD_Y + 148, { size: 18, align: 'center', stroke: 3, color: st.col });
    else g.text('—', x + SLOT_W / 2, CARD_Y + 148, { size: 18, align: 'center', stroke: 3, color: 'rgba(255,255,255,.4)' });

    const label = owned ? 'UP ' + fmt(st.cost) : fmt(st.cost);
    ctx.fillStyle = can ? (owned ? hexA(st.col, .9) : 'rgba(255,211,77,.92)') : 'rgba(255,255,255,.1)';
    rr(ctx, x + 7, CARD_Y + 158, SLOT_W - 14, 24, 8); ctx.fill();
    g.text(label + 'g', x + SLOT_W / 2, CARD_Y + 175, { size: 17, align: 'center', stroke: 3, color: can ? '#160e1c' : 'rgba(255,255,255,.45)' });
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ HUD */
function drawHUD(ctx) {
  /* time bar across the very top: thin, red when it matters */
  const frac = clamp(round / ROUND(), 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = frac > .3 ? '#7dff7d' : '#ff5a4d'; ctx.fillRect(0, 0, W * frac, 10);

  /* coins counter with a punchy pop on every gain */
  const pop = 1 + serveFlash * .07;
  ctx.save(); ctx.translate(28, 74); ctx.scale(pop, pop); ctx.translate(-28, -74);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 22, 40, 292, 66, 16); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(60, 73, 17, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(60, 73, 11, 0, TAU); ctx.fill();
  g.text(fmt(shownCoins), 88, 88, { size: 46, stroke: 6, color: '#fff' });
  g.text(fmt(Math.round(income * (rush > 0 ? 2 : 1))) + '/s', 88, 122, { size: 22, stroke: 4, color: rush > 0 ? '#ffd34d' : '#9ff8ff' });
  ctx.restore();

  /* goal progress */
  const prog = clamp(total / GOAL, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 330, 44, 186, 16, 8); ctx.fill();
  const pg = ctx.createLinearGradient(330, 0, 516, 0);
  pg.addColorStop(0, '#7dff7d'); pg.addColorStop(1, '#ffd34d');
  ctx.fillStyle = pg; rr(ctx, 330, 44, 186 * prog, 16, 8); ctx.fill();
  g.text('GOAL ' + fmt(GOAL), 516, 78, { size: 18, align: 'right', stroke: 3, color: prog > .8 ? '#ffd34d' : 'rgba(255,255,255,.8)' });

  /* rush button */
  const rdy = rushCd <= 0;
  ctx.save();
  ctx.translate(RUSH.x + RUSH.w / 2, RUSH.y + RUSH.h / 2);
  ctx.scale(1 + rushFlash * .06, 1 + rushFlash * .06);
  ctx.translate(-RUSH.x - RUSH.w / 2, -RUSH.y - RUSH.h / 2);
  ctx.fillStyle = rdy ? 'rgba(255,211,77,.92)' : 'rgba(60,50,70,.85)';
  rr(ctx, RUSH.x, RUSH.y, RUSH.w, RUSH.h, 14); ctx.fill();
  ctx.strokeStyle = rdy ? '#fff' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 3;
  rr(ctx, RUSH.x, RUSH.y, RUSH.w, RUSH.h, 14); ctx.stroke();
  if (!rdy) { // cooldown sweep
    ctx.save(); ctx.beginPath(); rr(ctx, RUSH.x, RUSH.y, RUSH.w, RUSH.h, 14); ctx.clip();
    ctx.fillStyle = 'rgba(255,211,77,.22)'; ctx.fillRect(RUSH.x, RUSH.y + RUSH.h * (1 - rushCd / 12), RUSH.w, RUSH.h * (rushCd / 12));
    ctx.restore();
  }
  g.text(rdy ? 'RUSH ×2' : rushCd.toFixed(1) + 's', RUSH.x + RUSH.w / 2, RUSH.y + 30, { size: 22, align: 'center', stroke: 4, color: rdy ? '#241426' : '#fff' });
  g.text(rush > 0 ? 'ON!' : 'R · TAP', RUSH.x + RUSH.w / 2, RUSH.y + 50, { size: 14, align: 'center', stroke: 3, color: rdy ? '#4a2f52' : 'rgba(255,255,255,.6)' });
  ctx.restore();

  /* serve-zone affordance: a soft shimmering plate the player learns to tap */
  const shim = .1 + .05 * Math.sin(t * 3);
  ctx.save(); ctx.globalAlpha = shim;
  ctx.fillStyle = '#ffd34d'; rr(ctx, SERVE.x + 40, SERVE.y + SERVE.h - 44, SERVE.w - 80, 44, 22); ctx.fill();
  ctx.restore();
  g.text('TAP TO SERVE', 150, 470, { size: 24, align: 'center', stroke: 4, color: 'rgba(255,255,255,.55)' });
}

/* ------------------------------------------------------------------ draw */
function drawCoinArcs(ctx) {
  for (let i = 0; i < coinArcs.length; i++) {
    const a = coinArcs[i];
    if (a.t < 0) continue;
    const k = clamp(a.t / a.d, 0, 1), e = ease.outCubic(k);
    const tx = 60, ty = 73;
    const x = lerp(a.x0, tx, e), y = lerp(a.y0, ty, e) - Math.sin(e * Math.PI) * 130;
    ctx.save(); ctx.globalAlpha = 1 - Math.max(0, k - .8) * 4;
    const r = 8 * (1 - k * .35);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * .25, y - r * .25, r * .35, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawSteam(ctx) {
  for (let i = 0; i < steam.length; i++) {
    const s = steam[i], k = s.t / s.life;
    ctx.save(); ctx.globalAlpha = (1 - k) * .22;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.t * 3 + i) * 6, s.y, s.r * (1 + k), 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function draw() {
  const ctx = g.ctx;
  drawRoom(ctx);
  drawCustomers(ctx);
  drawBarista(ctx);
  drawSteam(ctx);
  drawCards(ctx);
  drawCoinArcs(ctx);
  drawHUD(ctx);

  if (rush > 0) {
    ctx.save(); ctx.globalAlpha = .1 + .05 * Math.sin(t * 12);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

resetWorld();
g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ coins: Math.floor(coins), total: Math.floor(total), income: Math.round(income), lv: lv.slice(), t: +t.toFixed(2), round: +round.toFixed(1), rush: +rush.toFixed(1) });

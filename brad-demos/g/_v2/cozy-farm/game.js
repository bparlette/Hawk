// COZY CAT FARM — cozy-farm (Cat Arcade v2)
// ONE mechanic, kept from v1: tap a plot -> till, tap -> plant, wait for it to grow, tap -> harvest.
// Fill the quota before the sun goes down. Throw away v1's flat tiles; keep the loop.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, chance, TAU,
  rr, damp, panel,
} from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'cozy-farm', title: 'COZY CAT FARM', sub: 'TAP · TILL · PLANT · HARVEST',
  hook: 'one tiny farm, one setting sun', w: W, h: H, bg: '#12203a',
  bloom: .72, ca: .26, vig: 1, scan: .1,
});

/* ---------------------------------------------------------------- world constants */
const N = 5, TW = 104, TH = 54, OX = 270, OY = 500;
const DAY = 9.2;              // the whole day — the sun sets in 9.2 s
const QUOTA = 16;             // crops to harvest to win
const HORIZON = 402;
const isoX = (i, j) => OX + (i - j) * TW * .5;
const isoY = (i, j) => OY + (i + j) * TH * .5;
const CROPS = ['#ff7a3c', '#ff4d6d', '#ffd34d', '#b06bff'];
const isAuto = new URLSearchParams(location.search).has('auto');

/* ---------------------------------------------------------------- palette (day cycle) */
const PAL = {
  dawn: { top: [32, 30, 84], mid: [136, 92, 142], low: [255, 172, 122] },
  noon: { top: [34, 118, 208], mid: [120, 196, 242], low: [206, 234, 255] },
  dusk: { top: [26, 16, 48], mid: [156, 60, 108], low: [255, 124, 58] },
};
const mix = (a, b, k) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
const mix3 = (a, b, c, k) => (k < .5 ? mix(a, b, k * 2) : mix(b, c, (k - .5) * 2));

/* ---------------------------------------------------------------- static scenery (built once) */
function ridge(n, base, amp, ph) {
  const a = [];
  for (let k = 0; k <= n; k++) a.push({ x: (k / n) * (W + 120) - 60, y: base + Math.sin(k * .62 + ph) * amp + Math.sin(k * 1.9 + ph * 2) * amp * .32 });
  return a;
}
const RIDGE_FAR = ridge(22, 366, 15, .5);
const RIDGE_NEAR = ridge(18, 400, 20, 2.2);

function drawRidge(c, pts, col, off, bottom) {
  c.beginPath(); c.moveTo(pts[0].x + off, bottom);
  for (const p of pts) c.lineTo(p.x + off, p.y);
  c.lineTo(pts[pts.length - 1].x + off, bottom); c.closePath();
  c.fillStyle = col; c.fill();
}

function drawTree(c, x, y, s, t, colA, colB) {
  const sway = Math.sin(t * 1.5 + x * .05) * .05;
  c.save(); c.translate(x, y); c.rotate(sway);
  c.fillStyle = '#4a3220'; c.fillRect(-5 * s, -46 * s, 10 * s, 48 * s);
  for (const [dx, dy, r, cl] of [[-16, -54, 22, colA], [16, -58, 24, colB], [0, -78, 26, colA], [0, -58, 24, colB]]) {
    c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, TAU); c.fillStyle = cl; c.fill();
    c.lineWidth = 3 * s; c.strokeStyle = 'rgba(16,30,24,.45)'; c.stroke();
  }
  c.restore();
}

function drawBarn(c, x, y, s, t, glow) {
  c.save(); c.translate(x, y); c.scale(s, s);
  // walls
  c.fillStyle = '#b8443c'; c.beginPath(); c.rect(-46, -76, 92, 78); c.fill();
  c.strokeStyle = '#5c1b1a'; c.lineWidth = 4; c.stroke();
  // roof
  c.beginPath(); c.moveTo(-56, -76); c.lineTo(0, -116); c.lineTo(56, -76); c.closePath();
  c.fillStyle = '#8b2f2c'; c.fill(); c.strokeStyle = '#46120f'; c.lineWidth = 4; c.stroke();
  // plank shading
  c.fillStyle = 'rgba(0,0,0,.13)'; for (let k = 0; k < 4; k++) c.fillRect(-46 + k * 25, -76, 8, 78);
  // door
  c.fillStyle = '#f0e3c8'; c.beginPath(); c.roundRect(-18, -46, 36, 48, 4); c.fill();
  c.strokeStyle = '#46120f'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#c9a878'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-18, -46); c.lineTo(18, 2); c.moveTo(18, -46); c.lineTo(-18, 2); c.stroke();
  // hayloft window + warm light
  c.fillStyle = glow > .4 ? '#ffdf9a' : '#f5cf7a'; c.beginPath(); c.roundRect(-13, -104, 26, 20, 3); c.fill();
  c.strokeStyle = '#46120f'; c.lineWidth = 3; c.stroke();
  if (glow > .2) { c.globalAlpha = glow * .8; c.fillStyle = '#ffd06a'; c.beginPath(); c.arc(0, -94, 26, 0, TAU); c.fill(); c.globalAlpha = 1; }
  c.restore();
}

function drawFence(c, y, off, col) {
  c.fillStyle = col;
  for (let k = -2; k < 16; k++) {
    const x = k * 44 + (off % 44);
    c.fillRect(x, y - 26, 8, 30);
  }
  c.fillRect(-20 + (off % 44), y - 18, W + 60, 6);
  c.fillRect(-20 + (off % 44), y - 7, W + 60, 6);
}

/* ---------------------------------------------------------------- state */
let tiles, order, pollen, pets, clouds, cat, cur;
let left, coins, harvested, combo, comboT, botT, autoT, hintT, won;
let ending = 0, mile = 0, tickN = -1, flies = [], ended = false;
/* tweened juice objects — driven by g.tween, no per-frame allocation */
const hudPulse = { v: 0 };   // coin counter kick
const warm = { v: 0 };       // sunset light that creeps in and stays
const dial = { v: 0 };       // plot-cursor pop

function resetWorld() {
  tiles = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    tiles.push({
      i, j, x: isoX(i, j), y: isoY(i, j), s: 0, t: 0, pop: 0,
      ph: rnd(0, TAU), col: CROPS[(i * 3 + j * 5) % CROPS.length], gold: false,
    });
  }
  order = tiles.slice().sort((a, b) => (a.i + a.j) - (b.i + b.j) || a.i - b.i);
  pollen = [];
  for (let k = 0; k < 34; k++) pollen.push({ x: rnd(-20, W + 20), y: rnd(300, 880), z: rnd(.35, 1), ph: rnd(0, TAU), r: rnd(1.1, 3.1) });
  pets = [
    { x: 96, y: 818, d: 1, t: rnd(0, 9), col: '#fff3e0', k: 'duck' },
    { x: 430, y: 858, d: -1, t: rnd(0, 9), col: '#ffd9a0', k: 'duck' },
  ];
  clouds = [];
  for (let k = 0; k < 5; k++) clouds.push({ x: rnd(-80, W), y: 74 + k * 44 + rnd(0, 18), sc: .55 + k * .13, sp: 3 + k * 4 });
  left = DAY; coins = 0; harvested = 0; combo = 0; comboT = 0; botT = 0; autoT = 0; hintT = 0; won = false;
  ending = 0; mile = 0; tickN = -1; ended = false;
  hudPulse.v = 0; warm.v = 0; dial.v = 0;
  flies = [
    { x: 150, y: 560, ph: 0, sp: 1.7, col: '#ffe9a0' },
    { x: 380, y: 640, ph: 2.1, sp: 1.3, col: '#ffd0e6' },
    { x: 300, y: 470, ph: 4.4, sp: 2.2, col: '#e8ffd0' },
  ];
  cur = 12;
  cat = { x: 276, y: 792, tx: 276, ty: 748, fx: 276, fy: 748, dir: 1, sq: 1, hop: 1, hd: .18, lift: 0 };
  g.score = 0;
  g.state = { harvested: 0, quota: QUOTA, coins: 0, left: DAY, combo: 0, phase: 0, goal: QUOTA };
  g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => music('cozy');
resetWorld();
music('cozy');   /* the arcade boots in play mode, so warm it up here too */

/* ---------------------------------------------------------------- input */
function tileAt(x, y) {
  for (let k = order.length - 1; k >= 0; k--) {
    const t = order[k];
    if (Math.abs(x - t.x) / (TW * .5) + Math.abs(y - t.y) / (TH * .5) <= 1) return t;
  }
  return null;
}

/* the coin counter and the quota bar kick together, eased back down */
function bumpHud(a) {
  hudPulse.v = Math.max(hudPulse.v, a || 1);
  g.tween(hudPulse, 'v', 0, .42, u => 1 - (1 - u) * (1 - u));
}

function act(t) {
  if (!t || g.mode !== 'play') return;
  hintT = 1;
  t.pop = 1;
  /* the cat dashes to the plot it just touched */
  cat.fx = cat.x; cat.fy = cat.y; cat.tx = t.x + 14; cat.ty = t.y + 24;
  cat.hop = 0; cat.sq = .74; cat.dir = cat.tx < cat.x ? -1 : 1;
  cur = t.j * N + t.i;
  const pitch = comboPitch(Math.min(combo, 9));

  if (t.s === 0) {                                   /* grass -> tilled: clods, dust, thump */
    t.s = 1;
    sfx('step', { pitch: .82 * (1 + pitch * .05) });
    sfx('thud', { pitch: .8, vol: .45 });
    g.punch(.034); g.shake(3.2);
    g.fx.dust(t.x, t.y + 6, 9, { color: 'rgba(255,232,190,.55)', size: 15, speed: 110, up: 74, spread: 40 });
    g.fx.burst(t.x, t.y - 2, 11, { kind: 'debris', color: ['#6b4a2a', '#8a6440', '#573b25', '#3f2a18'], speed: 210, life: .7, size: 6, g: 900 });
    g.fx.burst(t.x, t.y - 4, 6, { kind: 'feather', color: ['#8ee36a', '#4cbb4a', '#c8ff9e'], speed: 150, life: .6, size: 6, g: 280 });
    g.fx.emit('ring', t.x, t.y + 2, { size: 46, life: .3, color: '#ffe0a0', add: true, wide: 4 });
    if (g.post) g.post.ripple(t.x / W, t.y / H, .5);
  } else if (t.s === 1) {                            /* tilled -> planted: seed pop */
    t.s = 2; t.t = 0; t.gold = chance(.16);
    sfx('pop', { pitch: 1.24 * (1 + pitch * .06) });
    g.punch(.028); g.shake(1.6);
    g.fx.burst(t.x, t.y - 8, 9, { kind: 'dot', color: ['#8ee36a', '#c8ff9e', '#fff'], speed: 150, life: .45, size: 5, g: 300 });
    g.fx.burst(t.x, t.y - 6, 6, { kind: 'bubble', color: 'rgba(215,255,220,.85)', speed: 60, life: .6, size: 8, g: -40 });
    g.fx.emit('ring', t.x, t.y, { size: 30, life: .28, color: '#9bff8a', add: true, wide: 3 });
    if (g.post) g.post.ripple(t.x / W, t.y / H, .35);
    if (t.gold) {                                    /* lucky seed: tell the player early */
      sfx('ding', { pitch: 1.9 });
      g.fx.burst(t.x, t.y - 14, 6, { kind: 'star', color: '#ffe98a', speed: 120, life: .5, size: 5, g: 120 });
      bumpHud(.5);
    }
  } else if (t.s === 3) {                            /* ripe -> harvest */
    harvest(t);
  } else {                                           /* still growing: bubbles + a rising chime */
    sfx('tick', { pitch: 1.7 + pitch * .12 });
    g.punch(.008);
    g.fx.burst(t.x, t.y - 12, 4, { kind: 'bubble', color: 'rgba(220,245,255,.85)', speed: 45, life: .5, size: 7, g: -30 });
    g.fx.emit('ring', t.x, t.y - 6, { size: 18, life: .22, color: 'rgba(200,255,220,.7)', add: true, wide: 2 });
  }
}

function harvest(t) {
  const gold = t.gold;
  t.s = 0; t.t = 0; t.pop = 1; t.gold = false;
  harvested++;
  combo = comboT > 0 ? combo + 1 : 1;
  comboT = 1.7;
  const val = (gold ? 20 : 8) * (1 + Math.min(6, combo - 1) * .25);
  coins += val;
  g.score = coins;
  /* pitch climbs with the streak: every harvest is a note higher than the last */
  const pk = comboPitch(Math.min(combo + 2, 11));
  g.combo.hit(t.x, t.y - 24, `+${Math.round(val)}`);
  if (gold) { sfx('ding', { pitch: 1.4 * pk }); sfx('coinchain', { pitch: pk, vol: .7 }); }
  else sfx('perfect', { pitch: .78 * pk, vol: .32 });
  g.hitstop(gold ? .055 : .028);
  g.impact(t.x, t.y - 10, { punch: gold ? .07 : .045, shake: gold ? 7 : 3.4, stop: 0, rip: gold ? 1.1 : .45, flash: gold ? '#ffe9a8' : null, flashA: .16 });
  g.fx.burst(t.x, t.y - 16, gold ? 22 : 12, {
    kind: 'spark', color: gold ? ['#ffe98a', '#ffd34d', '#fff'] : [t.col, '#fff', '#ffe0a0'],
    speed: gold ? 330 : 220, life: .55, size: 6, g: 640,
  });
  g.fx.burst(t.x, t.y - 20, gold ? 9 : 4, { kind: 'star', color: gold ? '#ffe08a' : '#fff2c8', speed: gold ? 180 : 120, life: .8, size: gold ? 8 : 5, g: 260 });
  /* cosy material: petals and hearts float up, not just sparks */
  g.fx.burst(t.x, t.y - 28, gold ? 8 : 5, { kind: 'heart', color: ['#ff9ec4', '#ff7a9e', '#fff0f6'], speed: 95, life: .85, size: 7, g: 70 });
  g.fx.burst(t.x, t.y - 24, 6, { kind: 'feather', color: ['#c8ff9e', '#ffe98a', '#fff'], speed: 120, life: .9, size: 6, g: 90 });
  if (gold) g.fx.burst(t.x, t.y - 10, 8, { kind: 'debris', color: ['#ffd34d', '#ffe98a'], speed: 210, life: .8, size: 6, g: 820 });
  g.fx.emit('ring', t.x, t.y - 8, { size: gold ? 90 : 54, life: .42, color: '#ffe98a', add: true, wide: gold ? 7 : 5 });
  if (g.post) g.post.ripple(t.x / W, t.y / H, gold ? 1.2 : .55);
  bumpHud(gold ? 1.4 : .8);
  if (combo > 1 && combo % 4 === 0) {                /* streak milestone: banner + chord + gold rain */
    g.showBanner(`${combo} IN A ROW`, .8);
    sfx('coinchain', { pitch: comboPitch(combo) });
    g.flash('#ffe9a8', .13); g.shake(5); g.punch(.05);
    g.fx.burst(t.x, t.y - 34, 12, { kind: 'confetti', color: ['#ffe98a', '#ff7a3c', '#7dff9b', '#ff9ec4'], speed: 220, life: .9, size: 6, g: 420 });
    bumpHud(1.3);
  }
  if (harvested >= QUOTA * .5 && mile < 1) {         /* halfway: the barn lights up */
    mile = 1;
    g.showBanner('HALFWAY!', .9);
    sfx('powerup', { pitch: 1.1 }); g.flash('#ffe9a8', .18); g.shake(6); g.punch(.07);
    g.fx.burst(270, 470, 16, { kind: 'star', color: ['#ffe98a', '#fff', '#ff9ec4'], speed: 260, life: .9, size: 8, g: 300 });
    g.fx.emit('ring', 270, 500, { size: 180, life: .55, color: '#ffe9a8', add: true, wide: 8 });
  }
  if (harvested >= QUOTA && !won) { won = true; win(); }
}

function win() {
  won = true;
  ending = .45;                      /* hold the world half a beat: banner, confetti, then the panel */
  g.showBanner('HARVEST!', 1.4);
  g.slowmo(.42, .8);
  sfx('fanfare'); sfx('powerup', { pitch: 1.5 });
  for (let k = 0; k < 5; k++) {
    g.fx.burst(60 + k * 108, 240 + (k % 2) * 90, 22, {
      kind: 'confetti', color: ['#ffd34d', '#ff7a3c', '#7dff9b', '#7df9ff', '#ff4d6d'],
      speed: 300, life: 1.5, size: 8, g: 420, spread: TAU,
    });
  }
  g.fx.burst(270, 500, 18, { kind: 'heart', color: ['#ff9ec4', '#ffd0e6', '#fff'], speed: 190, life: 1.4, size: 9, g: -40 });
  g.fx.burst(270, 500, 16, { kind: 'star', color: ['#ffe98a', '#fff'], speed: 300, life: 1.1, size: 9, g: 240 });
  g.fx.emit('ring', 270, 500, { size: 240, life: .65, color: '#ffe9a8', add: true, wide: 9 });
  g.impact(270, 520, { punch: .18, shake: 12, flash: '#ffe9a8', flashA: .3, stop: 0 });
  g.tween(cat, 'sq', 1.22, .35, u => 1 - (1 - u) * (1 - u));
  bumpHud(2);
  music('menu');
}

/* ---------------------------------------------------------------- bot (?auto=1) */
function botThink(dt) {
  botT -= dt;
  if (botT > 0) return;
  if (g.dumb()) {                       /* dumb: pokes a slow random plot, never finishes the quota */
    botT = .8;
    act(tiles[ri(0, tiles.length - 1)]);
    return;
  }
  botT = .05;                           /* 20 actions a second: sweep the field in passes */
  let best = null;
  for (let k = 0; k < tiles.length; k++) if (tiles[k].s === 3) { best = tiles[k]; break; }
  if (!best) for (let k = 0; k < tiles.length; k++) if (tiles[k].s === 1) { best = tiles[k]; break; }
  if (!best) for (let k = 0; k < tiles.length; k++) if (tiles[k].s === 0) { best = tiles[k]; break; }
  if (best) act(best);
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (g.mode !== 'play') return;

  left = Math.max(0, left - dt);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  hintT = Math.max(0, hintT - dt);
  const p = clamp(1 - left / DAY, 0, 1);
  const growT = .95 + p * .42;          /* difficulty: crops take longer as the light goes */

  /* ---- the harvest hold: banner, confetti, then the win panel ---- */
  if (won) {
    ending = Math.max(0, ending - dt);
    if (ending <= 0 && !ended) {
      ended = true;
      g.end({ win: true, score: Math.round(coins), label: 'COINS', progress: 1 });
      return;
    }
  }

  /* ---- taps ---- */
  for (let k = 0; k < g.taps.length; k++) {
    const tp = g.taps[k], t = tileAt(tp.x, tp.y);
    if (t) act(t);
  }
  /* ---- keyboard: arrows move the plot cursor, space/enter acts ---- */
  if (g.pressed.ArrowLeft) cur = (cur % N === 0) ? cur + N - 1 : cur - 1;
  if (g.pressed.ArrowRight) cur = (cur % N === N - 1) ? cur - N + 1 : cur + 1;
  if (g.pressed.ArrowUp) cur = (cur - N + tiles.length) % tiles.length;
  if (g.pressed.ArrowDown) cur = (cur + N) % tiles.length;
  if (g.pressed.Space || g.pressed.Enter || g.pressed.KeyE) act(tiles[cur]);

  /* ---- crops grow ---- */
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k];
    if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 4.2);
    if (t.s === 2) {
      t.t += dt;
      if (t.t >= growT) {
        t.s = 3; t.pop = 1;
        sfx('pop', { pitch: 1.55, vol: .45 });
        g.fx.burst(t.x, t.y - 18, 5, { kind: 'star', color: t.gold ? '#ffe98a' : '#b6ff8a', speed: 120, life: .5, size: 5, g: 120 });
      }
    }
  }

  /* ---- cat: hop along the field toward the last plot ---- */
  if (cat.hop < 1) {
    cat.hop = Math.min(1, cat.hop + dt / cat.hd);
    const e = 1 - (1 - cat.hop) * (1 - cat.hop);
    cat.x = lerp(cat.fx, cat.tx, e);
    cat.y = lerp(cat.fy, cat.ty, e);
    cat.lift = Math.sin(cat.hop * Math.PI) * 30;
    if (cat.hop >= 1) { cat.lift = 0; cat.sq = .84; g.fx.dust(cat.x, cat.y, 3, { color: 'rgba(230,255,210,.5)', size: 10 }); }
  }
  cat.sq = damp(cat.sq, 1, 9, dt);

  /* ---- pets + pollen ---- */
  for (let k = 0; k < pets.length; k++) {
    const pt = pets[k];
    pt.t += dt;
    pt.x += pt.d * 34 * dt;
    if (pt.x > 500) pt.d = -1; else if (pt.x < 40) pt.d = 1;
  }
  for (let k = 0; k < pollen.length; k++) {
    const q = pollen[k];
    q.y -= (6 + q.z * 16) * dt;
    q.x += Math.sin(g.t * .9 + q.ph) * 16 * dt;
    if (q.y < 280) { q.y = 880; q.x = rnd(-20, W + 20); }
  }

  if (isAuto && g.mode === 'play') { autoT += dt; botThink(dt); if (autoT > 40) g.end({ win: true, score: Math.round(coins), label: 'COINS', progress: 1 }); }

  g.score = coins;
  g.state = { harvested, quota: QUOTA, coins: Math.round(coins), left: Math.round(left * 100) / 100, combo, phase: Math.round(p * 100) / 100, goal: QUOTA };

  if (left <= 0 && !won) {
    won = true;
    g.fx.burst(270, 700, 16, { kind: 'smoke', color: 'rgba(255,140,80,.5)', speed: 90, life: 1, size: 22, g: -20 });
    g.end({ win: false, score: Math.round(coins), label: 'COINS', progress: harvested / QUOTA });
  }
}

/* ---------------------------------------------------------------- draw */
let skyKey = -1, skyGrad = null;
function skyFor(c, p) {
  const k = Math.round(p * 24);
  if (k !== skyKey || !skyGrad) {
    skyKey = k;
    const q = k / 24;
    skyGrad = c.createLinearGradient(0, 0, 0, 500);
    skyGrad.addColorStop(0, mix3(PAL.dawn.top, PAL.noon.top, PAL.dusk.top, q));
    skyGrad.addColorStop(.5, mix3(PAL.dawn.mid, PAL.noon.mid, PAL.dusk.mid, q));
    skyGrad.addColorStop(1, mix3(PAL.dawn.low, PAL.noon.low, PAL.dusk.low, q));
  }
  return skyGrad;
}

function draw() {
  const c = g.ctx;
  const p = clamp(1 - left / DAY, 0, 1);
  const cam = Math.sin(g.t * .32 + .6) * 15;
  const dusk = clamp((p - .55) / .45, 0, 1);

  /* ---------- 1. sky ---------- */
  c.fillStyle = skyFor(c, p);
  c.fillRect(0, 0, W, H);

  /* sun arcs up and comes back down to the hills */
  const a = Math.PI + p * Math.PI;
  const sx = 270 + Math.cos(a) * 216 + cam * .12, sy = 342 + Math.sin(a) * 176;
  const sunCol = p < .6 ? mix([255, 246, 200], [255, 226, 140], p / .6) : mix([255, 226, 140], [255, 120, 70], (p - .6) / .4);
  const glow = c.createRadialGradient(sx, sy, 0, sx, sy, 150);
  glow.addColorStop(0, 'rgba(255,238,180,.55)'); glow.addColorStop(.35, 'rgba(255,196,110,.22)'); glow.addColorStop(1, 'rgba(255,160,80,0)');
  c.fillStyle = glow; c.fillRect(sx - 150, sy - 150, 300, 300);
  c.beginPath(); c.arc(sx, sy, 40, 0, TAU); c.fillStyle = sunCol; c.fill();
  c.beginPath(); c.arc(sx, sy, 40, 0, TAU); c.strokeStyle = 'rgba(255,240,190,.5)'; c.lineWidth = 3; c.stroke();

  /* clouds (far parallax) */
  for (let k = 0; k < clouds.length; k++) {
    const cl = clouds[k];
    const cx = ((cl.x + g.t * cl.sp) % (W + 200)) - 100 + cam * .18;
    c.globalAlpha = .28 + .3 * (1 - dusk);
    c.fillStyle = k % 2 ? '#ffffff' : '#ffe9d0';
    for (const [dx, dy, r] of [[-26, 4, 24], [0, -6, 32], [28, 3, 22], [10, 8, 26]]) {
      c.beginPath(); c.arc(cx + dx * cl.sc, cl.y + dy * cl.sc, r * cl.sc, 0, TAU); c.fill();
    }
  }
  c.globalAlpha = 1;

  /* ---------- 2. far hills (parallax .3) ---------- */
  drawRidge(c, RIDGE_FAR, mix3([104, 132, 176], [128, 168, 196], [86, 56, 106], p), cam * .3, HORIZON + 30);
  /* ---------- 3. mid hills + barn + trees (parallax .6) ---------- */
  drawRidge(c, RIDGE_NEAR, mix3([74, 118, 96], [92, 152, 106], [62, 44, 74], p), cam * .6, HORIZON + 34);
  drawBarn(c, 108 + cam * .62, HORIZON + 6, .82, g.t, dusk);
  const treeA = mix3([70, 132, 82], [82, 158, 92], [58, 52, 72], p);
  const treeB = mix3([46, 104, 66], [58, 132, 74], [40, 38, 58], p);
  drawTree(c, 428 + cam * .66, HORIZON + 4, .8, g.t, treeA, treeB);
  drawTree(c, 494 + cam * .68, HORIZON + 10, .58, g.t * 1.2, treeB, treeA);
  drawTree(c, 28 + cam * .64, HORIZON + 2, .5, g.t * .9, treeB, treeA);

  /* ---------- 4. the field ---------- */
  const fg = c.createLinearGradient(0, HORIZON, 0, H);
  fg.addColorStop(0, mix3([74, 148, 84], [84, 164, 88], [66, 62, 72], p));
  fg.addColorStop(.45, mix3([54, 122, 72], [64, 138, 76], [48, 46, 58], p));
  fg.addColorStop(1, mix3([30, 78, 56], [38, 92, 58], [24, 24, 38], p));
  c.fillStyle = fg; c.fillRect(0, HORIZON, W, H - HORIZON);
  /* mown stripes — cheap texture that reads as depth */
  c.fillStyle = 'rgba(255,255,255,.045)';
  for (let k = 0; k < 7; k++) c.fillRect(0, HORIZON + 26 + k * 84, W, 42);
  drawFence(c, HORIZON + 8, cam * .8, 'rgba(96,64,40,.85)');
  /* soft shadow under the whole farm plot so the grid sits on the lawn */
  const gsx = 270 + cam * 1, gsy = (isoY(0, 0) + isoY(4, 4)) / 2 + 14;
  const gsh = c.createRadialGradient(gsx, gsy, 20, gsx, gsy, 300);
  gsh.addColorStop(0, 'rgba(10,26,14,.42)'); gsh.addColorStop(1, 'rgba(10,26,14,0)');
  c.fillStyle = gsh; c.save(); c.translate(gsx, gsy); c.scale(1, .78); c.translate(-gsx, -gsy);
  c.beginPath(); c.ellipse(gsx, gsy, 300, 190, 0, 0, TAU); c.fill(); c.restore();

  /* warm light wash over the whole field as the sun drops */
  if (dusk > 0) { c.fillStyle = `rgba(255,132,58,${dusk * .17})`; c.fillRect(0, HORIZON, W, H - HORIZON); }

  /* ---------- 5. plots ---------- */
  const fx = cam * 1;
  for (let k = 0; k < order.length; k++) drawPlot(c, order[k], fx, dusk);

  /* cursor ring — visible target for keyboard players */
  const ct = tiles[cur];
  if (ct && g.mode === 'play') {
    c.save();
    c.globalAlpha = .5 + .35 * Math.sin(g.t * 6);
    c.strokeStyle = '#fff6c8'; c.lineWidth = 3;
    c.beginPath();
    c.moveTo(ct.x + fx, ct.y - TH * .5 - 3); c.lineTo(ct.x + fx + TW * .5 + 3, ct.y);
    c.lineTo(ct.x + fx, ct.y + TH * .5 + 3); c.lineTo(ct.x + fx - TW * .5 - 3, ct.y);
    c.closePath(); c.stroke();
    c.restore();
  }

  /* ---------- 6. the cat ---------- */
  c.save();
  c.globalAlpha = .22; c.fillStyle = '#0b1a0d';
  c.beginPath(); c.ellipse(cat.x + fx, cat.y, 26, 8, 0, 0, TAU); c.fill();
  c.restore();
  g.hero(c, 'cat', cat.x + fx, cat.y - cat.lift, 92, {
    dir: cat.dir, anim: cat.hop < 1 ? 'walk' : 0, color: '#ffb347',
    glow: cat.sq < .95 ? .35 : 0, glowColor: '#ffe08a', shadow: false,
  });

  /* ---------- 7. pets + pollen + foreground blades ---------- */
  for (let k = 0; k < pets.length; k++) {
    const pt = pets[k];
    drawChar(pt.k, c, pt.x + fx * 1.1, pt.y, 54, { dir: pt.d, color: pt.col, anim: 'walk', t: pt.t });
  }
  for (let k = 0; k < pollen.length; k++) {
    const q = pollen[k];
    const px = q.x + Math.sin(g.t * .6 + q.ph) * 6 + cam * (1.1 + q.z * .4);
    c.globalAlpha = .25 + q.z * .45;
    c.fillStyle = q.z > .7 ? '#fff6c0' : '#e8ffd0';
    c.beginPath(); c.arc(px, q.y, q.r, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  /* foreground grass band */
  c.fillStyle = mix3([44, 96, 56], [52, 108, 60], [32, 28, 40], p);
  c.beginPath(); c.moveTo(0, H);
  for (let k = 0; k <= 18; k++) {
    const x = k * 32 + ((cam * 1.3) % 32);
    c.lineTo(x, 900 - Math.sin(k * 1.7 + g.t * 1.6) * 12);
    c.lineTo(x + 16, 916 + Math.cos(k * 2.1 + g.t * 1.2) * 10);
  }
  c.lineTo(W, H); c.closePath(); c.fill();

  /* ---------- 8. HUD ---------- */
  const hudP = 1 - left / DAY;
  /* sunset strip along the very top */
  c.fillStyle = 'rgba(6,12,22,.55)'; c.fillRect(0, 0, W, 8);
  const sg = c.createLinearGradient(0, 0, W, 0);
  sg.addColorStop(0, '#ffd34d'); sg.addColorStop(.6, '#ff9a3c'); sg.addColorStop(1, '#ff4d6d');
  c.fillStyle = sg; c.fillRect(0, 0, W * (1 - hudP), 8);

  /* left panel: coins + quota bar (top-right stays clear for the combo meter) */
  panel(c, 14, 18, 322, 84, { alpha: .5, color: '#0b1626', r: 16 });
  c.beginPath(); c.arc(44, 50, 15, 0, TAU); c.fillStyle = '#ffd34d'; c.fill();
  c.lineWidth = 3; c.strokeStyle = '#8a5a10'; c.stroke();
  c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(39, 45, 5, 0, TAU); c.fill();
  g.text(String(Math.round(coins)), 68, 66, { size: 44, color: '#ffe9a8', ink: '#1a0e00' });
  g.text(`${Math.min(harvested, QUOTA)}/${QUOTA}`, 324, 64, { size: 30, align: 'right', color: harvested >= QUOTA ? '#7dff9b' : '#eafff0', ink: '#04120a' });
  /* progress bar */
  const bx = 26, by = 78, bw = 298, prog = Math.min(1, harvested / QUOTA);
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, bx, by, bw, 14, 7); c.fill();
  const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
  pg.addColorStop(0, '#7dff9b'); pg.addColorStop(1, '#ffd34d');
  c.fillStyle = pg; rr(c, bx, by, Math.max(4, bw * prog), 14, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; rr(c, bx, by, bw, 14, 7); c.stroke();
  if (prog < 1) {
    c.globalAlpha = .55 + .35 * Math.sin(g.t * 5);
    c.fillStyle = '#fff'; c.fillRect(bx + bw * prog - 1.5, by - 3, 3, 20); c.globalAlpha = 1;
  }
  /* the sun is the clock: a little dial in the free top-right corner */
  const dx = W - 60, dy = 62;
  c.save(); c.globalAlpha = .85;
  c.beginPath(); c.arc(dx, dy, 26, 0, TAU); c.fillStyle = 'rgba(8,16,28,.55)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(dx, dy, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p)); c.strokeStyle = '#ffd34d'; c.lineWidth = 5; c.stroke();
  c.beginPath(); c.arc(dx, dy, 9, 0, TAU); c.fillStyle = mix([255, 246, 200], [255, 120, 70], p); c.fill();
  c.restore();
  g.text(left.toFixed(1), dx, dy + 42, { size: 20, align: 'center', color: left < 3 ? '#ff9a6a' : '#cfe6ff', ink: '#04101c' });

  /* start hint */
  if (harvested === 0 && left > DAY - 4.5 && g.mode === 'play') {
    const al = clamp((DAY - left) / .6, 0, 1);
    c.globalAlpha = al * (.7 + .3 * Math.sin(g.t * 4));
    g.text('TAP A PLOT · TILL · PLANT · HARVEST', 270, 760, { size: 24, align: 'center', color: '#eafff0', ink: '#062012' });
    c.globalAlpha = 1;
  }
  /* last 3 seconds: the sun is going down */
  if (left < 3 && g.mode === 'play') {
    c.globalAlpha = (.25 + .25 * Math.sin(g.t * 8)) * (1 - left / 3);
    c.fillStyle = '#ff7a3c'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  }
}

/* a single plot: chunky iso diamond with soil sides, furrows, growth ring and crop */
function drawPlot(c, t, off, dusk) {
  const pop = t.pop;
  const sc = 1 + pop * .13;
  const cx = t.x + off, cy = t.y - pop * 10;
  const hw = TW * .5 * sc, hh = TH * .5 * sc, side = 12;

  /* contact shadow */
  c.globalAlpha = .3; c.fillStyle = '#06120a';
  c.beginPath(); c.moveTo(cx, cy - hh + 10); c.lineTo(cx + hw + 6, cy + 10); c.lineTo(cx, cy + hh + 18); c.lineTo(cx - hw - 6, cy + 10); c.closePath(); c.fill();
  c.globalAlpha = 1;
  /* side faces */
  c.beginPath(); c.moveTo(cx - hw, cy); c.lineTo(cx, cy + hh); c.lineTo(cx, cy + hh + side); c.lineTo(cx - hw, cy + side); c.closePath();
  c.fillStyle = '#3d2a1c'; c.fill();
  c.beginPath(); c.moveTo(cx + hw, cy); c.lineTo(cx, cy + hh); c.lineTo(cx, cy + hh + side); c.lineTo(cx + hw, cy + side); c.closePath();
  c.fillStyle = '#573b25'; c.fill();

  /* top face */
  c.beginPath(); c.moveTo(cx, cy - hh); c.lineTo(cx + hw, cy); c.lineTo(cx, cy + hh); c.lineTo(cx - hw, cy); c.closePath();
  const grass = t.s === 0;
  c.fillStyle = grass ? mix([134, 214, 96], [96, 156, 84], dusk) : mix([150, 100, 58], [110, 74, 46], dusk);
  c.fill();
  c.strokeStyle = 'rgba(24,16,10,.6)'; c.lineWidth = 3; c.stroke();

  /* grass top highlight */
  if (grass) {
    c.beginPath(); c.moveTo(cx - hw, cy); c.lineTo(cx, cy - hh); c.lineTo(cx + hw, cy); c.lineTo(cx, cy - hh + 7); c.closePath();
    c.fillStyle = 'rgba(224,255,190,.34)'; c.fill();
  } else {
    /* furrows */
    c.strokeStyle = 'rgba(60,36,20,.55)'; c.lineWidth = 2.5;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(cx - hw * .55 + k * 14, cy + hh * .45 - k * 7);
      c.lineTo(cx + hw * .55 + k * 14, cy - hh * .45 - k * 7);
      c.stroke();
    }
  }

  if (t.s === 2) {
    /* growth ring + sprout */
    const growT = .95 + clamp(1 - left / DAY, 0, 1) * .42;
    const u = clamp(t.t / growT, 0, 1);
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + TAU * u); c.stroke();
    c.strokeStyle = '#2f8f3a'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy + 3); c.lineTo(cx, cy + 3 - 8 - 16 * u); c.stroke();
    const lw = 5 + 7 * u;
    c.fillStyle = '#4cbb4a';
    c.beginPath(); c.ellipse(cx - lw * .7, cy - 6 - 10 * u, lw, lw * .5, -.5, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx + lw * .7, cy - 7 - 10 * u, lw, lw * .5, .5, 0, TAU); c.fill();
  } else if (t.s === 3) {
    /* ripe crop: bobbing ball of veg with a leaf crown */
    const bob = Math.sin(g.t * 4 + t.ph) * 2.4 - pop * 14;
    const r = 13;
    const cyy = cy - 16 + bob;
    c.strokeStyle = '#2f8f3a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(cx, cyy + r); c.lineTo(cx, cy); c.stroke();
    if (t.gold) {
      c.save(); c.globalAlpha = .35 + .25 * Math.sin(g.t * 7);
      const gl = c.createRadialGradient(cx, cyy, 0, cx, cyy, 40);
      gl.addColorStop(0, 'rgba(255,236,150,.9)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(cx, cyy, 40, 0, TAU); c.fill(); c.restore();
    }
    c.beginPath(); c.arc(cx, cyy, r, 0, TAU);
    c.fillStyle = t.gold ? '#ffd34d' : t.col; c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(18,12,8,.7)'; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.ellipse(cx - 4.5, cyy - 5, 3.6, 2.8, -.6, 0, TAU); c.fill();
    c.fillStyle = '#3fae4f';
    c.beginPath(); c.ellipse(cx - 5, cyy - r + 1, 6, 3, -.7, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx + 5, cyy - r + 1, 6, 3, .7, 0, TAU); c.fill();
    /* sparkle */
    const sp = Math.sin(g.t * 5 + t.ph);
    if (sp > .72) {
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2;
      const s = 3 + (sp - .72) * 12;
      c.beginPath(); c.moveTo(cx + 12, cyy - 12 - s); c.lineTo(cx + 12, cyy - 12 + s);
      c.moveTo(cx + 12 - s, cyy - 12); c.lineTo(cx + 12 + s, cyy - 12); c.stroke();
    }
  }
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({
  plots: tiles ? tiles.map(t => t.s).join('') : '', harvested, quota: QUOTA,
  left: +left.toFixed(2), coins: Math.round(coins), combo, lands: cat ? [Math.round(cat.x), Math.round(cat.y)] : null,
});

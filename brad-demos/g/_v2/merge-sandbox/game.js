// MERGE SANDBOX — merge-sandbox (Cat Arcade v2)
// Drop cat-balls into the glass box. Two of the same tier touch and pop into the next tier up.
// Build one TIER 6 ball before the stack crosses the red line.
//
// THE MERGE IS THE STAR: a pop-in scale tween on the new ball, a ring + spark burst in the ball's
// own colour, hit-stop and a camera punch scaled by tier, a rising comboPitch per chained merge,
// and a score popup. Big tiers get a banner and slow-mo. Landings puff dust, and the whole backdrop
// heats up (hue drift + bloom ramp) as the box fills.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, ease, damp, TAU,
  rr, circle, hexA, shadow, fmt,
} from '../_vendor/gp2x.js';
import { face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'merge-sandbox', title: 'MERGE SANDBOX', sub: 'DROP · MATCH · LEVEL UP',
  hook: 'two cats touch and turn into something bigger', w: W, h: H, bg: '#080a16', style: 'neon',
  bloom: .85, ca: .34, vig: .98, scan: .2,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const dumb = () => isAuto && g.dumb();

/* ------------------------------------------------------------------ tiers */
const TIER = [
  { col: '#7dff7d', col2: '#1a6a2a', r: 17, v: 1 },
  { col: '#9ff8ff', col2: '#1a5a70', r: 23, v: 3 },
  { col: '#8fd6ff', col2: '#24407a', r: 30, v: 8 },
  { col: '#c9a0ff', col2: '#4a2a7a', r: 39, v: 20 },
  { col: '#ff7ad0', col2: '#7a1a5a', r: 50, v: 55 },
  { col: '#ff9a3c', col2: '#8a3c10', r: 62, v: 130 },
  { col: '#ffd34d', col2: '#8a6a10', r: 76, v: 400 },
];
const GOAL_TIER = 6;
const BOX = { x: 30, y: 330, w: 480, h: 560 };
BOX.y2 = BOX.y + BOX.h;
const DANGER_Y = BOX.y + 96;
const MAX_BALLS = 42;

/* ------------------------------------------------------------------ state */
let balls, next, aimX, t, dead, stackT, chain, chainT;
let shakeLine, flashTier, botT, botTarget, dropped, merged, bestTier;
let fill, bloomKick, landSfxT, buzzT, lastMergeAt, mergeWarm;

/* tweened UI bits (the shell walks these with g.tween, so they ease even during hit-stop) */
const UI = { recoil: 0, hudPop: 0, scorePop: 0, recordPop: 0, framePop: 0, dangerPop: 0, comboPop: 0 };

const isDumb = () => dumb();
const spawnTier = () => {
  // fair dealer: mostly offer a tier that is already on the board, so pairs are always findable
  if (balls.length && chance(.7)) {
    const present = [];
    for (const b of balls) if (b.tier < GOAL_TIER - 1 && present.indexOf(b.tier) < 0) present.push(b.tier);
    if (present.length) return present[Math.floor(Math.random() * present.length)];
  }
  return Math.floor(Math.random() * 3) + 2;   // 2,3,4 — the late-game band, so a run resolves fast
};

function resetWorld() {
  balls = []; t = 0; dead = 0; stackT = 0; chain = 0; chainT = 0;
  shakeLine = 0; flashTier = -1; botT = 0; botTarget = W / 2; dropped = 0; merged = 0; bestTier = 0;
  fill = 0; bloomKick = 0; landSfxT = -1; buzzT = -9; lastMergeAt = -9; mergeWarm = 0;
  UI.recoil = 0; UI.hudPop = 0; UI.scorePop = 0; UI.recordPop = 0; UI.framePop = 0; UI.dangerPop = 0; UI.comboPop = 0;
  next = spawnTier();
  aimX = W / 2;
  g.score = 0;
  g.state = { balls: 0, best: 0, merges: 0, fill: 0 };
  g.combo.reset(); g.fx.clear();
  if (g.post) g.post.bloom = .8;
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('click', { pitch: 1.15, vol: .35 }); };

/* ------------------------------------------------------------------ physics
   Hand-rolled circles: gravity, wall + circle separation, a little restitution.
   4 substeps per frame keeps big balls from tunnelling through the stack. */
function stepPhys(dt) {
  const SUB = 4, h = dt / SUB;
  for (let s = 0; s < SUB; s++) {
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.vy += 1750 * h;
      b.x += b.vx * h; b.y += b.vy * h;
      b.rot += b.vx * h * .02;
      const r = b.r;
      if (b.x - r < BOX.x) { b.x = BOX.x + r; b.vx = Math.abs(b.vx) * .32; }
      if (b.x + r > BOX.x + BOX.w) { b.x = BOX.x + BOX.w - r; b.vx = -Math.abs(b.vx) * .32; }
      if (b.y + r > BOX.y2) {
        const sp = Math.abs(b.vy);
        b.y = BOX.y2 - r; b.vy = -Math.abs(b.vy) * .14; b.vx *= .86;
        if (sp > 190) land(b, sp, b.x, BOX.y2 - 2);       // dust puff + thud, scaled by impact
      }
    }
    /* circle-circle */
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || .001;
        const min = a.r + b.r;
        if (d < min) {
          if (a.tier === b.tier && a.tier < GOAL_TIER && !a.dead && !b.dead) { merge(a, b); break; }
          const nx = dx / d, ny = dy / d, pen = (min - d) * .5;
          a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = rel * .42;
            a.vx += nx * imp; a.vy += ny * imp; b.vx -= nx * imp; b.vy -= ny * imp;
            if (rel < -560) contactDust((a.x + b.x) * .5, (a.y + b.y) * .5, Math.max(a.tier, b.tier), -rel);
          }
          a.vx *= .985; b.vx *= .985;
        }
      }
    }
  }
}

/* a ball hitting the floor: squash, thud, and a puff of dust in its own colour */
function land(b, sp, x, y) {
  const k = clamp(sp / 900, .16, 1), T = TIER[b.tier];
  b.sq = Math.max(b.sq, k * .9);
  if (t - landSfxT > .045) { landSfxT = t; sfx('thud', { pitch: .9 + k * .45 + b.tier * .02, vol: .18 + k * .4 }); }
  g.fx.emit('smoke', x + rnd(-9, 9), y, { vx: rnd(-80, 80) * k, vy: -rnd(10, 70) * k, g: 70, life: .38 + k * .3, size: 8 + k * 15, color: hexA(T.col, .42) });
  g.fx.emit('smoke', x + rnd(-11, 11), y, { vx: rnd(-60, 60) * k, vy: -rnd(20, 100) * k, g: 40, life: .3 + k * .26, size: 6 + k * 11, color: 'rgba(255,255,255,.34)' });
  g.fx.emit('spark', x, y - 2, { vx: rnd(-130, 130) * k, vy: -rnd(60, 220) * k, g: 700, life: .28, size: 2.6, color: T.col });
  if (k > .5) { g.punch(.008 + k * .02); g.shake(1 + k * 3); if (k > .8) g.hitstop(.012); }
}

/* two heavy balls collide mid-air: a small grit puff so contact never feels dead */
function contactDust(x, y, tier, sp) {
  const k = clamp(sp / 1200, .1, 1), col = TIER[tier].col;
  g.fx.emit('smoke', x, y, { vx: rnd(-50, 50), vy: rnd(-40, 10), g: 120, life: .22, size: 6 + k * 9, color: hexA(col, .3) });
  g.fx.emit('spark', x, y, { vx: rnd(-90, 90), vy: rnd(-90, 20), g: 500, life: .2, size: 2.2, color: hexA('#ffffff', .8) });
}

/* ------------------------------------------------------------------ merge */
function merge(a, b) {
  a.dead = 1; b.dead = 1;
  const nx = a.x * .5 + b.x * .5, ny = a.y * .5 + b.y * .5;
  const tier = a.tier + 1;                      // tier of the ball that is born
  const T = TIER[tier], col = T.col;
  const big = tier >= 4, huge = tier >= 5;
  merged++; chain++;
  chainT = 1.4;
  lastMergeAt = t;
  mergeWarm = 1;
  UI.framePop = 1; g.tween(UI, 'framePop', 0, .34);

  /* 1 · the merge = the moment. tier drives every dial. */
  g.hitstop(.016 + tier * .013);                 // hit-stop proportional to tier
  g.punch(.02 + tier * .014);                    // camera punch scaled by tier
  g.shake(3 + tier * 2.2);
  /* 2 · ring + burst, all in the new ball's own colour */
  g.fx.emit('ring', nx, ny, { size: T.r * 2.2, life: .34, color: col, wide: 5 + tier, add: true });
  g.fx.emit('ring', nx, ny, { size: T.r * 3.6, life: .5, color: hexA(col, .65), wide: 2 + tier * .4, add: true });
  g.fx.emit('glow', nx, ny, { size: T.r * 1.25, life: .3, color: hexA(col, .8), add: true });
  g.fx.burst(nx, ny, 10 + tier * 4, { kind: 'spark', color: [col, '#ffffff', T.col2], speed: 205 + tier * 45, life: .5, size: 4.5 + tier, drag: 1.7 });
  g.fx.burst(nx, ny, 4 + tier * 2, { kind: 'star', color: [col, '#ffffff'], speed: 130 + tier * 22, life: .6 + tier * .06, size: 7 + tier * 1.6, g: 300 });
  g.impact(nx, ny, { punch: .01 + tier * .007, shake: 2 + tier * 1.1, stop: .006 + tier * .003, rip: .6 + tier * .12, flash: col, flashA: .03 + tier * .012 });
  /* 3 · sfx: merge pitched by tier, plus a chain voice and a big-merge body */
  const pitch = comboPitch(tier + chain - 1);    // rising pitch per chained merge
  sfx('merge', { pitch: pitch * (1 + tier * .03), vol: .58 });
  sfx('pop', { pitch: pitch * 1.5, vol: .26 });  // the pop-in of the newborn ball
  if (huge) sfx('boom', { pitch: .82 + tier * .08, vol: .5 });
  else if (big) sfx('ding', { pitch: 1.05 + tier * .12, vol: .4 });
  if (chain > 1) sfx('coinchain', { pitch: comboPitch(chain + 2), vol: .42 });
  g.flash(col, .04 + tier * .022);

  /* 4 · score + popups */
  const sc = T.v * (chain > 1 ? chain : 1);
  g.score += sc;
  UI.scorePop = 1; g.tween(UI, 'scorePop', 0, .3);
  g.popup('+' + sc, nx, ny - T.r - 4, col, 24 + Math.min(20, tier * 3));
  if (chain > 1) {
    g.popup('×' + chain, nx, ny - T.r - 36, '#9ff8ff', 20 + Math.min(16, chain * 3));
    UI.comboPop = 1; g.tween(UI, 'comboPop', 0, .3);
  }
  g.combo.hit(nx, ny - 22, chain > 1 ? '×' + chain : null);

  /* 5 · big tiers announce themselves */
  if (huge) {
    g.showBanner('TIER ' + tier + '!', 1.15);
    g.slowmo(.42, .26);                          // big merge reads as a beat, not a stutter
    g.punch(.05); g.shake(9);
    g.fx.emit('ring', nx, ny, { size: T.r * 5.2, life: .7, color: hexA(col, .5), wide: 4, add: true });
    g.fx.emit('confetti', nx, ny - 10, { vx: rnd(-160, 160), vy: rnd(-260, -80), g: 520, life: 1.1, size: rnd(5, 9), color: col, rot: rnd(0, TAU), vr: rnd(-12, 12) });
  } else if (big) {
    g.showBanner('TIER ' + tier + '!', .85);
    g.flash(col, .1);
  } else if (chain > 2) {
    g.showBanner('CHAIN ×' + chain + '!', .8);
    g.shake(4);
  }

  /* 6 · the newborn: pop-in scale tween (tweens keep running through hit-stop) */
  const nb = { x: nx, y: ny, vx: (a.vx + b.vx) * .5, vy: (a.vy + b.vy) * .5 - 85, r: T.r, tier, rot: 0, pop: .22, dead: 0, sq: 0, glow: 1 };
  g.tween(nb, 'pop', 1, .32, ease.outBack);
  balls.push(nb);
  g.fx.emit('glow', nx, ny, { size: T.r * .9, life: .34, color: hexA('#ffffff', .5), add: true });

  /* 7 · milestones */
  if (tier > bestTier) {
    bestTier = tier;
    g.state.best = tier;
    UI.recordPop = 1; g.tween(UI, 'recordPop', 0, .4);
    if (tier >= 3) {
      sfx('powerup', { pitch: 1 + tier * .09, vol: .45 });   // milestone jingle
      g.flash('#ffd34d', .1); g.punch(.045); g.shake(6);
      g.popup('NEW TIER!', W / 2, BOX.y - 42, '#ffd34d', 30);
    }
  }

  /* 8 · goal reached */
  if (tier >= GOAL_TIER) maxTier(nx, ny);
}

/* the winning merge — the biggest beat in the game */
function maxTier(nx, ny) {
  g.slowmo(.3, .9);
  g.hitstop(.14);
  g.flash('#ffd34d', .55);
  g.shake(20); g.punch(.085);
  g.showBanner('TIER 6!', 1.6);
  g.popup('MAX TIER!', W / 2, BOX.y + 130, '#ffd34d', 42);
  sfx('fanfare', { vol: .8 });
  sfx('win', { pitch: 1.12, vol: .8 });
  g.fx.emit('ring', nx, ny, { size: 240, life: .9, color: '#ffffff', wide: 11, add: true });
  g.fx.emit('ring', nx, ny, { size: 120, life: .7, color: '#ffd34d', wide: 7, add: true });
  g.fx.burst(nx, ny, 58, { kind: 'star', color: ['#ffd34d', '#ffffff', '#ff9a3c', '#ff7ad0'], speed: 520, life: 1.1, size: 11, g: 260 });
  for (let i = 0; i < 18; i++) {
    g.fx.emit('confetti', nx + rnd(-90, 90), ny + rnd(-40, 40), { vx: rnd(-220, 220), vy: rnd(-380, -120), g: 620, life: rnd(.9, 1.6), size: rnd(5, 10), color: TIER[1 + (i % 6)].col, rot: rnd(0, TAU), vr: rnd(-12, 12) });
  }
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 1 });
}

/* ------------------------------------------------------------------ drop */
function dropBall() {
  if (g.mode !== 'play') return;
  const tier = next, r = TIER[tier].r;
  const x = clamp(aimX, BOX.x + r + 2, BOX.x + BOX.w - r - 2);
  balls.push({ x, y: BOX.y + 26, vx: 0, vy: 40, r, tier, rot: 0, pop: .55, sq: 0, dead: 0, glow: .6 });
  g.tween(balls[balls.length - 1], 'pop', 1, .16);
  dropped++;
  next = spawnTier();
  UI.recoil = 1; g.tween(UI, 'recoil', 0, .22);
  sfx('whoosh', { pitch: 1.3 + tier * .05, vol: .3 });     // the drop
  g.punch(.012);
  g.fx.emit('ring', x, BOX.y + 28, { size: 13, life: .26, color: hexA(TIER[tier].col, .85), wide: 3, add: true });
  g.fx.emit('spark', x, BOX.y + 32, { vx: rnd(-90, 90), vy: rnd(-30, 70), g: 500, life: .3, size: 3, color: TIER[tier].col });
  if (balls.length > MAX_BALLS) balls.shift();
}

/* an input the game will not honour — say so, quietly */
function refuse(x, y) {
  sfx('tick', { pitch: .72, vol: .5 });
  g.shake(1.6); g.punch(.008);
  g.fx.emit('smoke', x, y, { vx: rnd(-30, 30), vy: -30, g: 40, life: .26, size: 12, color: 'rgba(255,120,120,.3)' });
  g.popup('NO DROP', x, y - 18, '#ff8a7a', 18);
}

/* ------------------------------------------------------------------ bot */
function botThink(dt) {
  botT -= dt;
  if (botT > 0) return;
  botT = isDumb() ? 1.6 : .34;
  if (isDumb()) { aimX = W / 2 + rnd(-150, 150); if (chance(.5)) dropBall(); return; }
  // 1) if the next drop matches a ball already in the box, aim straight down onto it (instant merge)
  let best = -1, bestY = 1e9;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.tier === next && b.y < bestY && b.y > BOX.y + 60) { best = i; bestY = b.y; }
  }
  if (best >= 0) aimX = balls[best].x;
  else {
    // 2) otherwise drop into the emptiest column: lowest stack height
    let bestX = W / 2, lowTop = -1;
    for (let k = 0; k < 9; k++) {
      const x = BOX.x + 40 + k * ((BOX.w - 80) / 8);
      let top = BOX.y2;
      for (const b of balls) if (Math.abs(b.x - x) < b.r + 20 && b.y < top) top = b.y;
      if (top > lowTop) { lowTop = top; bestX = x; }
    }
    aimX = bestX;
  }
  dropBall();
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;

  /* chain window: a merge within 1.4s keeps the chain alive */
  if (chain > 0) {
    chainT -= dt;
    if (chainT <= 0) {
      if (chain > 1) g.combo.miss();
      chain = 0;
    }
  }
  shakeLine = Math.max(0, shakeLine - dt * 2);
  mergeWarm = Math.max(0, mergeWarm - dt * 2.6);
  bloomKick = Math.max(0, bloomKick - dt * .8);

  /* pointer aiming: the dropper follows your finger anywhere in the top band */
  for (const p of g.pointers.values()) if (p.y < BOX.y + 120) aimX = p.x;
  for (let ti = 0; ti < g.taps.length; ti++) {
    const p = g.taps[ti];
    if (g.mode !== 'play') { if (p.y > BOX.y - 40) refuse(p.x, p.y); continue; }
    if (p.y < BOX.y - 40) continue;
    aimX = p.x;
    dropBall();
  }
  if (g.keys.ArrowLeft) aimX -= 420 * dt;
  if (g.keys.ArrowRight) aimX += 420 * dt;
  if (g.pressed.Space || g.pressed.ArrowDown) dropBall();
  if (isAuto) botThink(dt);

  if (g.mode !== 'play') return;

  stepPhys(Math.min(dt, 1 / 30));

  /* merged balls leave, survivors settle, fresh balls pop in */
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.dead) { balls.splice(i, 1); continue; }
    if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 4);
    if (b.glow > 0) b.glow = Math.max(0, b.glow - dt * 2.2);
    if (Math.abs(b.vy) < 16) b.vy = 0;
    if (Math.abs(b.vx) < 6) b.vx = 0;
    b.y = Math.min(b.y, BOX.y2 - b.r);
  }

  /* how full is the box? drives the hue shift, the bloom ramp and the danger line */
  let top = BOX.y2;
  for (const b of balls) top = Math.min(top, b.y - b.r);
  const rawFill = clamp((BOX.y2 - top) / (BOX.y2 - DANGER_Y), 0, 1);
  fill = damp(fill, rawFill, 5, dt);
  if (g.post) g.post.bloom = .78 + fill * .45 + bloomKick;

  /* danger: a ball sitting above the line means the box is nearly full */
  let over = false;
  for (const b of balls) if (b.y - b.r < DANGER_Y && b.y > BOX.y && Math.abs(b.vy) < 40) { over = true; break; }
  if (over) {
    stackT += dt;
    if (t - buzzT > .55) {
      buzzT = t;
      g.showBanner('BOX FULL!', .6);
      sfx('groan', { pitch: .78 + stackT * .35, vol: .45 });      // board-full alarm
      g.shake(2.2); g.flash('#ff3b3b', .06);
      UI.dangerPop = 1; g.tween(UI, 'dangerPop', 0, .3);
      g.popup('OVERFLOW!', W / 2, DANGER_Y - 34, '#ff5a4d', 24);
    }
    if (stackT > 1.1) dead = 1;
  } else stackT = Math.max(0, stackT - dt * 1.6);
  if (stackT > .05) shakeLine = 1;

  if (dead) {
    dead = 0;
    g.flash('#ff3b3b', .45); g.shake(14); g.punch(.06); g.hitstop(.08);
    g.showBanner('BOX FULL', 1.2);
    sfx('boom', { pitch: .62, vol: .6 });
    g.fx.emit('ring', W / 2, DANGER_Y, { size: 200, life: .6, color: '#ff3b3b', wide: 9, add: true });
    g.fx.burst(W / 2, DANGER_Y, 34, { kind: 'debris', color: ['#ff3b3b', '#ff9a3c', '#ffffff'], speed: 340, life: .9, size: 9, g: 1400 });
    g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: clamp((bestTier || 0) / GOAL_TIER, 0, .95) });
    return;
  }

  g.state = { balls: balls.length, best: bestTier, merges: merged, fill: +fill.toFixed(2), progress: +clamp(bestTier / GOAL_TIER, 0, 1).toFixed(2) };
  g.score = Math.round(g.score);
}

/* ------------------------------------------------------------------ ball sprites (baked once, drawn cheap) */
const SPR = {};
const SS = 2;
function ballSprite(tier) {
  if (SPR[tier]) return SPR[tier];
  const T = TIER[tier], r = T.r, pad = 8, S = Math.ceil((r + pad) * 2 * SS);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.translate(S / 2, S / 2); c.scale(SS, SS);
  const gr = c.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, T.col); gr.addColorStop(1, T.col2);
  c.fillStyle = gr; circle(c, 0, 0, r); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = Math.max(2, r * .08); c.stroke();
  c.save();
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.fillStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.ellipse(-r * .34, -r * .4, r * .3, r * .18, -.6, 0, TAU); c.fill();
  c.restore();
  face(c, 'cat', 0, r * .1, r * .62, T.col);
  return (SPR[tier] = { cv, S: S / SS });
}

/* ------------------------------------------------------------------ draw */
let skyCache = null, skyKey = -1;
function skyFor(bucket) {
  if (skyKey === bucket && skyCache) return skyCache;
  skyKey = bucket;
  const f = bucket / 20;
  const hueA = 236 - f * 44, hueB = 268 + f * 46;
  const ctx = g.ctx;
  const sk = ctx.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, `hsl(${hueA},64%,${9 + f * 5}%)`);
  sk.addColorStop(.45, `hsl(${hueB},58%,${13 + f * 8}%)`);
  sk.addColorStop(1, `hsl(${hueA + 16},62%,5%)`);
  const glow = ctx.createRadialGradient(W / 2, BOX.y + BOX.h * .55, 20, W / 2, BOX.y + BOX.h * .55, 430);
  glow.addColorStop(0, `hsla(${hueB},95%,62%,${.10 + f * .16})`);
  glow.addColorStop(.5, `hsla(${hueA + 40},95%,60%,${.05 + f * .09})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  const heat = ctx.createLinearGradient(0, BOX.y2, 0, BOX.y2 - 300);
  heat.addColorStop(0, `hsla(${300 - f * 150},96%,60%,${.05 + f * .3})`);
  heat.addColorStop(1, 'rgba(0,0,0,0)');
  return (skyCache = { sk, glow, heat, f });
}

function drawBackdrop(ctx) {
  const s = skyFor(Math.round(clamp(fill, 0, 1) * 20));
  ctx.fillStyle = s.sk; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = s.glow; ctx.fillRect(0, 0, W, H);

  /* parallax: drifting rings behind the glass, warmer as the box fills */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const yy = 200 + i * 120 + Math.sin(t * .4 + i) * 14;
    const xx = 270 + Math.cos(t * .3 + i * 1.7) * 150;
    const rr2 = 60 + i * 26;
    const hue = 190 + i * 18 + s.f * 110;
    ctx.strokeStyle = `hsla(${hue},90%,62%,${.05 + .02 * Math.sin(t + i) + s.f * .05})`;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xx, yy, rr2, 0, TAU); ctx.stroke();
  }
  ctx.restore();

  /* the pile's warmth radiating up out of the box */
  ctx.fillStyle = s.heat; ctx.fillRect(0, BOX.y2 - 300, W, 300);

  /* shelf silhouettes */
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  for (let i = 0; i < 5; i++) ctx.fillRect(0, 250 + i * 150, W, 3);

  /* merge bloom wash — a soft coloured haze for a beat after every merge */
  if (mergeWarm > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = mergeWarm * .07;
    ctx.fillStyle = flashTier >= 0 ? TIER[flashTier].col : '#9ff8ff';
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

function drawBox(ctx) {
  const fp = UI.framePop;
  ctx.save();
  const bgr = ctx.createLinearGradient(0, BOX.y, 0, BOX.y2);
  bgr.addColorStop(0, `rgba(120,180,255,${.07 + fill * .05})`);
  bgr.addColorStop(1, 'rgba(120,180,255,.02)');
  ctx.fillStyle = bgr; rr(ctx, BOX.x, BOX.y, BOX.w, BOX.h, 18); ctx.fill();
  ctx.strokeStyle = `rgba(${160 + fp * 90},${220 - fp * 40},255,${.4 + fp * .5})`;
  ctx.lineWidth = 4 + fp * 3;
  rr(ctx, BOX.x, BOX.y, BOX.w, BOX.h, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  rr(ctx, BOX.x + 7, BOX.y + 7, BOX.w - 14, BOX.h - 14, 13); ctx.stroke();

  /* fill gauge hugging the left wall */
  const gh = BOX.h - 28, gy = BOX.y + 14;
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  rr(ctx, BOX.x + 9, gy, 7, gh, 4); ctx.fill();
  const fg = ctx.createLinearGradient(0, BOX.y2, 0, DANGER_Y);
  fg.addColorStop(0, '#4ee06a'); fg.addColorStop(.6, '#ffd34d'); fg.addColorStop(1, '#ff4d6d');
  ctx.fillStyle = fg;
  const fh = Math.max(3, gh * clamp(fill, 0, 1));
  rr(ctx, BOX.x + 9, gy + gh - fh, 7, fh, 4); ctx.fill();

  /* danger line */
  const dl = .5 + .5 * Math.sin(t * (stackT > 0 ? 14 : 3));
  ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 40;
  ctx.strokeStyle = stackT > 0
    ? `rgba(255,59,59,${.5 + dl * .5})`
    : `rgba(255,120,120,${.22 + dl * .18 + fill * .3})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(BOX.x + 4, DANGER_Y); ctx.lineTo(BOX.x + BOX.w - 4, DANGER_Y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBall(ctx, b) {
  const sp = ballSprite(b.tier);
  const pop = Math.max(.12, b.pop);
  const r = b.r * pop;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.sq > 0) ctx.scale(1 + b.sq * .1, 1 - b.sq * .1);
  shadow(ctx, 0, r * .92, r * .88, r * .26, .28);
  ctx.rotate(b.rot);
  /* spawn glow — the newborn ball flares white-hot for a beat */
  if (b.glow > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.glow * .55;
    const gd = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.9);
    gd.addColorStop(0, hexA(TIER[b.tier].col, .9)); gd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill(); ctx.restore();
  }
  const S = sp.S * pop;
  ctx.drawImage(sp.cv, -S / 2, -S / 2, S, S);
  ctx.restore();
}

function drawDropper(ctx) {
  const T = TIER[next], r = T.r;
  const x = clamp(aimX, BOX.x + r + 2, BOX.x + BOX.w - r - 2);
  /* guide beam down to the stack — tells you exactly where it lands */
  const grd = ctx.createLinearGradient(0, BOX.y + 60, 0, BOX.y2);
  grd.addColorStop(0, hexA(T.col, .28)); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.fillRect(x - 3, BOX.y + 60, 6, BOX.h - 60);
  ctx.save(); ctx.globalAlpha = .55;
  ctx.strokeStyle = T.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, BOX.y + 26, r, 0, TAU); ctx.stroke();
  ctx.restore();
  /* the next ball, floating at the muzzle with a snappy recoil after each drop */
  const bob = Math.sin(t * 3) * 3 + UI.recoil * -7;
  const sp = ballSprite(next), S = sp.S * (1 + UI.recoil * .12);
  ctx.save(); ctx.translate(x, BOX.y + 26 + bob);
  ctx.drawImage(sp.cv, -S / 2, -S / 2, S, S);
  ctx.restore();
  /* muzzle glow */
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3 + .1 * Math.sin(t * 6) + UI.recoil * .4;
  ctx.fillStyle = T.col; ctx.beginPath(); ctx.ellipse(x, BOX.y + 8, r * 1.5, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
}

/* HUD — drawn by the shell after the camera transform, so it stays rock steady */
function drawHUD(ctx) {
  const pop = 1 + UI.hudPop * .06 + UI.scorePop * .1;
  ctx.save(); ctx.translate(W / 2, 66); ctx.scale(pop, pop); ctx.translate(-W / 2, -66);
  g.text(fmt(g.score), W / 2, 82, { size: 64, align: 'center', stroke: 8, color: '#fff' });
  ctx.restore();
  g.text('TIER ' + (bestTier || 0) + ' / ' + GOAL_TIER + '   ·   ' + balls.length + ' CATS', W / 2, 116, { size: 22, align: 'center', stroke: 4, color: 'rgba(200,230,255,.85)' });

  /* goal ladder */
  const bw = 320, bx = (W - bw) / 2;
  g.bar(bx, 132, bw, 12, clamp((bestTier || 0) / GOAL_TIER, 0, 1), '#ffd34d');

  /* record chip */
  if (UI.recordPop > 0) {
    ctx.save(); ctx.globalAlpha = clamp(UI.recordPop * 1.4, 0, 1);
    ctx.translate(W - 66, 176); ctx.scale(1 + UI.recordPop * .5, 1 + UI.recordPop * .5); ctx.translate(-(W - 66), -176);
    g.text('BEST ' + bestTier, W - 66, 180, { size: 24, align: 'center', stroke: 5, color: '#ffd34d' });
    ctx.restore();
  }

  if (chain > 1) {
    ctx.save();
    const k = 1 + UI.comboPop * .35;
    ctx.translate(W / 2, 196); ctx.scale(k, k); ctx.translate(-W / 2, -196);
    g.text('CHAIN ×' + chain, W / 2, 196, { size: 34, align: 'center', stroke: 6, color: '#9ff8ff' });
    ctx.restore();
  }
  if (stackT > .2) g.text('DANGER!', W / 2, DANGER_Y - 18, { size: 30, align: 'center', stroke: 6, color: '#ff5a4d' });
  g.text('TAP TO DROP', W / 2, H - 28, { size: 22, align: 'center', stroke: 4, color: 'rgba(255,255,255,.4)' });
}

function draw(ctx) {
  drawBackdrop(ctx);
  drawBox(ctx);
  for (const b of balls) drawBall(ctx, b);
  if (g.mode === 'play') drawDropper(ctx);
}

/* ------------------------------------------------------------------ boot */
resetWorld();
g.run(update, draw, drawHUD);
window.__g = g;
window.__dbg = () => ({ balls: balls.length, best: bestTier, score: Math.round(g.score), next, dropped, merged, chain, fill: +fill.toFixed(2) });

// CAT RUNNER — cat-runner (Cat Arcade v2)
// Tap to jump, tap again mid-air to double jump, hold to slide. Neon rooftops, endless night.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, panel, heartPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'cat-runner', title: 'CAT RUNNER', sub: 'TAP = JUMP  ·  HOLD = SLIDE',
  hook: 'the city is chasing you', w: W, h: H, bg: '#08060f', style: 'toon',
  bloom: .8, ca: .4, vig: 1, scan: .2,
});

const GY = H * .8;                    // rooftop line
const CFG = {
  grav: 3050, jump: -1180, jump2: -1000, px: 156, hearts: 3,
  spd: t => 430 + Math.min(360, t * 7),   // pixels / second
  win: 1150,
};

/* ---------------------------------------------------------------- scenery */
const strip = (n, o) => {
  const out = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(o.wMin, o.wMax), h = rnd(o.hMin, o.hMax), wins = [];
    for (let wy = 16; wy < h - 14; wy += o.row) for (let wx = 8; wx < w - 10; wx += o.col)
      if (chance(.38)) wins.push({ x: wx, y: wy, on: chance(.55), ph: R() * 6 });
    out.push({ x, w, h, wins }); x += w + rnd(5, 18);
  }
  return { b: out, w: x };
};

/* three depths of parallax: stars (far) → skyline A → skyline B → rooftop → foreground gantry */
const parallax = [
  { L: strip(24, { wMin: 44, wMax: 80, hMin: 150, hMax: 330, row: 28, col: 18 }), baseY: GY - 16, col: '#221a4e', win: 'rgba(255,214,140,.85)', par: .18 },
  { L: strip(20, { wMin: 58, wMax: 110, hMin: 210, hMax: 460, row: 24, col: 15 }), baseY: GY + 6, col: '#110b2a', win: 'rgba(160,240,255,.85)', par: .42 },
];
const near = strip(14, { wMin: 92, wMax: 170, hMin: 34, hMax: 96, row: 26, col: 22 });
const stars = Array.from({ length: 64 }, () => ({ x: R() * W, y: R() * H * .52, r: rnd(.7, 2), ph: R() * 6, sp: rnd(.5, 1.8) }));

function skyline(L, baseY, color, winCol, par) {
  const ctx = g.ctx, off = (g.dist * par) % L.w;
  for (let k = 0; k < 2; k++) {
    const ox = k * L.w - off;
    if (ox > W || ox + L.w < 0) continue;
    for (const b of L.b) {
      const x = ox + b.x, y = baseY - b.h;
      if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = color; ctx.fillRect(x, y, b.w, b.h + 40);
      ctx.fillStyle = winCol;
      for (const w of b.wins) { ctx.globalAlpha = w.on ? (.5 + .5 * Math.sin(g.t * 1.4 + w.ph)) : .18; ctx.fillRect(x + w.x, y + w.y, 5, 7); }
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------------------------------------------------------------- world */
let cat, obs = [], coins = [], dist = 0, t = 0, overT = 0, nextAt = 0, dustT = 0, nearMiss = 0;
let hearts = CFG.hearts, invuln = 0, mile = 0, footT = 0, footFlip = 0, stumble = 0, tier = 0, speedPop = 0;
const arcTxt = [];                       // score popups that arc upward under gravity
const cam = { boost: 0 };                // tweened camera push-in that rides on top of the speed zoom
const isAuto = new URLSearchParams(location.search).has('auto');

function resetWorld() {
  cat = { x: CFG.px, y: GY, vy: 0, grounded: true, jumps: 0, slide: 0, rot: 0, sq: 1, tail: 0 };
  obs = []; coins = []; dist = 0; t = 0; overT = 0; nextAt = 150; dustT = 0; nearMiss = 0;
  hearts = CFG.hearts; invuln = 0; mile = 0; footT = 0; footFlip = 0; stumble = 0; tier = 0; speedPop = 0;
  arcTxt.length = 0;
  g.score = 0; g.dist = 0; g.cam.scale = 1;
  g.state = { score: 0, dist: 0, spd: CFG.spd(0), hearts: CFG.hearts };
  g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('meow', { pitch: 1.05 }); };
resetWorld();

const spd = () => CFG.spd(t);

/* flat engine particles (g.burst) — square debris that reads well against the neon */
function puff(x, y, n, col, up = 60, sp = 150) { g.burst(x, y, n, { color: col, speed: sp, up, life: .5, size: 5, gravity: 420 }); }

function arcPop(txt, x, y, col, size) {
  arcTxt.push({ txt, x, y, vx: rnd(-26, 26), vy: -196, col, size: size || 30, t: 0, life: .95 });
  if (arcTxt.length > 16) arcTxt.shift();
}

/* ---------------------------------------------------------------- spawning */
function spawnPattern(x) {
  const r = R();
  if (r < .34) {                                   // single crate
    obs.push({ kind: 'crate', x, y: GY - 74, w: 58, h: 74 });
    if (chance(.6)) coinRun(x + 20, GY - 170, 1);
  } else if (r < .55) {                             // stack of two
    obs.push({ kind: 'crate', x, y: GY - 128, w: 58, h: 128 });
    if (chance(.5)) coinRun(x + 20, GY - 240, 1);
  } else if (r < .74) {                             // low drone — slide under
    obs.push({ kind: 'drone', x, y: GY - 118, w: 76, h: 58, ph: R() * 6 });
    if (chance(.7)) coinRun(x + 10, GY - 58, 1);
  } else if (r < .9) {                              // two crates with a gap between
    obs.push({ kind: 'crate', x, y: GY - 74, w: 54, h: 74 });
    obs.push({ kind: 'crate', x: x + 118, y: GY - 80, w: 54, h: 80 });
    for (let i = 0; i < 3; i++) coins.push({ x: x + 40 + i * 40, y: GY - 210 - Math.sin(i / 2 * Math.PI) * 54, taken: false, t: R() * 6 });
  } else {                                          // coin arc only — breather
    for (let i = 0; i < 5; i++) coins.push({ x: x + i * 44, y: GY - 120 - Math.sin(i / 4 * Math.PI) * 150, taken: false, t: R() * 6 });
  }
}
function coinRun(x, y, n) { for (let i = 0; i < n; i++) coins.push({ x: x + i * 36, y, taken: false, t: R() * 6 }); }

/* ---------------------------------------------------------------- input */
function doJump() {
  if (cat.grounded) {
    cat.vy = CFG.jump; cat.grounded = false; cat.jumps = 1;
    cat.sq = .7; g.tween(cat, 'sq', 1, .3, t2 => 1 - (1 - t2) ** 3);
    sfx('jump');
    g.fx.dust(cat.x, cat.y, 12, { color: 'rgba(180,240,255,.6)' });
    puff(cat.x - 8, GY - 6, 6, ['#9fe8ff', '#ffd34d'], 70, 130);
    g.punch(.045); g.shake(2.5);
  } else if (cat.jumps < 2) {
    cat.vy = CFG.jump2; cat.jumps = 2;
    cat.sq = .78; g.tween(cat, 'sq', 1, .26);
    sfx('jump', { pitch: 1.25 }); sfx('whoosh', { pitch: 1.4, vol: .5 });
    g.fx.burst(cat.x, cat.y + 10, 14, { kind: 'ring', color: '#7df9ff', speed: 130, life: .3 });
    g.fx.emit('glow', cat.x, cat.y - 40, { life: .3, size: 46, color: '#7df9ff', add: true });
    puff(cat.x, cat.y + 6, 8, ['#7df9ff', '#ffffff'], 30, 190);
    g.popup('HOP', cat.x + 4, cat.y - 110, '#7df9ff', 24);
    g.hitstop(.03); g.punch(.06);
  }
}

/* ---------------------------------------------------------------- auto bot */
function botThink() {
  const dumb = g.dumb();
  const S = spd();
  const front = CFG.px + 22;                                   // the cat's leading edge
  const ahead = obs.filter(o => !o.hit && o.x + o.w > front - 20).sort((a, b) => a.x - b.x);
  const nx = ahead[0];
  if (!nx) { if (cat.grounded && S > 560 && chance(.012)) doJump(); return; }
  const d = nx.x - front;                                      // px until it reaches us
  const react = S * 0.30;                                      // distance covered in ~0.3s

  if (nx.kind === 'drone') {                                   // duck under, not over
    if (cat.grounded && d < react + (dumb ? rnd(20, 90) : 0) && d > -nx.w) cat.slide = Math.max(cat.slide, .48);
    return;
  }
  if (d < react + (dumb ? rnd(30, 130) : 0) && d > -30 && cat.grounded) doJump();
  else if (!cat.grounded && cat.jumps < 2 && cat.vy > 90 && d < S * 0.22 && d > 8) doJump();
}

/* ---------------------------------------------------------------- stumble / damage */
function stumbleHit(o) {
  o.hit = true;
  hearts--; invuln = 1.25; stumble = .5; nearMiss = 0;
  g.combo.miss();
  const x = CFG.px + 18, y = cat.y - 44;
  sfx('glass'); sfx('groan', { pitch: 1.15, vol: .8 });
  g.impact(x, y, { punch: .26, shake: 26, stop: .13, flash: '#ff3b5c', flashA: .46, rip: 1.7 });
  g.hitstop(.13); g.slowmo(.3, .28);
  g.fx.blast(x, y, { r: 74, color: '#ff3b5c', colors: ['#ff3b5c', '#ffd34d', '#ffffff'], n: 26 });
  puff(x, y, 16, ['#ff3b5c', '#ffd34d', '#ffffff'], 120, 320);
  g.fx.burst(x, y, 14, { kind: 'debris', color: ['#ff4ad8', '#2a1030', '#ffd34d'], speed: 330, life: .7, size: 8 });
  cat.sq = .62; g.tween(cat, 'sq', 1, .45);
  cat.vy = -560; cat.grounded = false; cat.jumps = 2;   // knocked into a stumble-hop
  arcPop('-1 LIFE', x, y - 30, '#ff6b85', 32);
  g.popup('OUCH!', x, y - 74, '#ffd34d', 36);
  g.flash('#ff3b5c', .4); g.punch(.16);
  if (hearts <= 0) {
    g.slowmo(.28, 1.1);
    g.end({ win: false, score: Math.round(dist / 10) + g.score, label: 'METRES', progress: clamp((dist / 10) / 720, 0, 1) });
    return;
  }
  g.showBanner(hearts === 2 ? 'STUMBLE · 2 LIVES' : 'LAST LIFE!', 1);
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  t += dt;
  const S = spd();
  g.dist += S * dt;
  dist = g.dist;
  const base = Math.round(dist / 10);

  if (isAuto) { if (g.mode === 'play') { if (g.ptr.down) doJump(); botThink(); } }
  else if (g.taps.length && g.mode === 'play') doJump();

  /* --- camera: travel speed pushes the lens in, tier-ups punch it --- */
  const st = clamp((S - 430) / 360, 0, 1);
  g.cam.scale = 1 + st * .045 + stumble * .02 + cam.boost;
  const newTier = Math.floor(st * 5);
  if (newTier > tier) {
    tier = newTier; speedPop = 1;
    sfx('charge', { pitch: 1 + tier * .07, vol: .55 });
    sfx('drum', { vol: .5 });
    g.punch(.13); g.shake(6); g.flash('#9fe8ff', .16);
    g.fx.ring(CFG.px, cat.y - 50, { r: 120, color: '#9fe8ff', life: .45, wide: 6 });
    g.popup('SPEED UP', CFG.px + 20, cat.y - 140, '#9fe8ff', 30);
    cam.boost = .05; g.tween(cam, 'boost', 0, .7, t2 => 1 - (1 - t2) ** 3);
  }
  speedPop = Math.max(0, speedPop - dt * 2);
  stumble = Math.max(0, stumble - dt);
  invuln = Math.max(0, invuln - dt);

  /* slide */
  const holding = isAuto ? false : g.ptr.down;
  if (holding && cat.grounded) { if (cat.slide <= 0 && !isAuto) sfx('whoosh', { pitch: .85, vol: .45 }); cat.slide = Math.max(cat.slide, .12); }
  cat.slide = Math.max(0, cat.slide - dt);

  /* physics */
  if (!cat.grounded) {
    cat.vy += CFG.grav * dt;
    cat.y += cat.vy * dt;
    if (cat.y >= GY) {
      const impact = cat.vy;
      cat.y = GY; cat.vy = 0; cat.grounded = true; cat.jumps = 0;
      cat.sq = 1.3; g.tween(cat, 'sq', 1, .26, t2 => 1 - (1 - t2) ** 3);
      sfx('thud', { pitch: 1.1, vol: .5 });
      sfx('step', { pitch: .8, vol: .35 });
      g.fx.dust(cat.x, GY, 16, { color: 'rgba(255,220,160,.55)' });
      puff(cat.x, GY - 4, 10, ['#ffc46b', '#ffd34d', '#ffffff'], 90, 210);
      g.fx.ring(cat.x, GY - 2, { r: 54, color: 'rgba(255,224,150,.7)', life: .3, wide: 4, ripple: false });
      g.punch(.07); g.shake(4);
      if (impact > 1500) {
        g.hitstop(.04); g.shake(7);
        g.burst(cat.x, GY - 6, 7, { color: ['#ffd34d', '#9fe8ff', '#ffffff'], speed: 190, up: 110, size: 5, life: .45, gravity: 520 });
        g.fx.ring(cat.x, GY - 2, { r: 80, color: 'rgba(159,232,255,.8)', life: .34, wide: 5, ripple: false });
      }
    }
  }
  cat.rot = lerp(cat.rot, cat.grounded ? 0 : clamp(cat.vy / 2600, -.35, .4), dt * 8);
  cat.tail = Math.sin(t * 14) * .3;

  /* --- footfalls: a puff of dust on every stride --- */
  if (cat.grounded && cat.slide <= 0) {
    footT += dt * (S / 430);
    if (footT > .21) {
      footT = 0; footFlip ^= 1;
      g.fx.dust(cat.x - 18, GY, 4, { color: 'rgba(255,200,140,.5)', spread: 12, speed: 60, up: 40, size: 9 });
      puff(cat.x - 14 - footFlip * 6, GY - 3, 3, ['rgba(255,196,120,.9)', 'rgba(255,255,255,.8)'], 26, 90);
      sfx('step', { pitch: footFlip ? 1.16 : .94, vol: .2 });
      g.punch(.012);
    }
  } else if (cat.slide > 0 && cat.grounded) {
    footT += dt;
    if (footT > .05) {
      footT = 0;
      g.fx.dust(cat.x - 26, GY, 1, { color: 'rgba(160,240,255,.5)', spread: 8, speed: 40, up: 18 });
      g.burst(cat.x - 30, GY - 3, 2, { color: ['#9fe8ff', '#ffffff'], speed: 130, up: 30, size: 3, life: .32, gravity: 380 });
    }
  } else footT = .12;

  /* spawn */
  nextAt -= S * dt;
  if (nextAt <= 0) { spawnPattern(W + 60); nextAt = S * rnd(0.80, 1.10); }

  /* obstacles */
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    o.x -= S * dt;
    if (o.kind === 'drone') o.ph += dt * 6;
    if (o.x + o.w < -40) { obs.splice(i, 1); continue; }
    if (!o.hit && invuln <= 0 && boxHit(o)) { stumbleHit(o); obs.splice(i, 1); if (g.mode === 'over') break; continue; }
    /* near miss juice */
    if (!o.nm && o.x + o.w < CFG.px - 30) {
      o.nm = true;
      if (!cat.grounded) {
        g.combo.hit(CFG.px + 20, cat.y - 60, 'CLOSE');
        sfx('whoosh', { pitch: comboPitch() });
        g.fx.burst(CFG.px + 10, cat.y - 50, 9, { kind: 'spark', color: '#9fe8ff', speed: 210, life: .35 });
        g.popup('CLOSE', CFG.px + 26, cat.y - 92, '#9fe8ff', 26);
        g.hitstop(.03); g.punch(.05); g.shake(3);
        g.score += 5 * g.combo.mult;
        g.fx.ring(CFG.px + 16, cat.y - 40, { r: 62, color: '#9fe8ff', life: .26, wide: 3, ripple: false });
      }
    }
  }

  /* coins */
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= S * dt; c.t += dt;
    if (c.x < -30) { coins.splice(i, 1); continue; }
    if (!c.taken && Math.hypot(c.x - CFG.px, c.y - (cat.y - 40)) < 44) {
      c.taken = true; coins.splice(i, 1);
      const val = 10 * g.combo.mult;
      g.score += val;
      g.combo.hit(c.x, c.y, ' ');   // arcPop below draws the '+10' on a real gravity arc
      sfx('coin', { pitch: comboPitch() });
      if (g.combo.n % 5 === 0) { sfx('coinchain', { pitch: comboPitch(4) }); g.fx.burst(c.x, c.y, 12, { kind: 'star', color: '#ffd34d', speed: 210, life: .5 }); }
      g.fx.burst(c.x, c.y, 9, { kind: 'spark', color: '#ffd34d', speed: 190, life: .35 });
      g.fx.ring(c.x, c.y, { r: 36, color: '#ffe98a', life: .22, wide: 3, ripple: false });
      puff(c.x, c.y, 5, ['#ffd34d', '#fff6c2'], 70, 150);
      g.burst(c.x, c.y, 4, { color: ['#ffd34d', '#fff6c2'], speed: 120, up: 50, size: 4, life: .3, gravity: 340 });
      arcPop('+' + val, c.x, c.y - 14, '#ffe98a', 24);
      g.punch(.03);
    }
  }

  /* --- milestone banners every 250m, with a rising jingle --- */
  const m = Math.floor(base / 250);
  if (m > mile) {
    mile = m;
    const step = m;
    g.showBanner(`${m * 250} M`, 1.15);
    sfx('fanfare', { pitch: 1 + step * .09 });
    sfx('unlock', { pitch: 1 + step * .12, vol: .7 });
    g.flash('#ffd34d', .22); g.punch(.15); g.shake(8);
    g.hitstop(.06);
    g.fx.burst(CFG.px + 20, cat.y - 60, 22, { kind: 'confetti', color: ['#ffd34d', '#ff4ad8', '#7df9ff', '#fff'], speed: 300, life: 1.0, size: 7 });
    g.fx.blast(CFG.px + 20, cat.y - 50, { r: 96, color: '#ffd34d', n: 20, flashA: 0, smoke: false });
    arcPop('+' + m * 250 + 'M', CFG.px + 10, cat.y - 120, '#ffd34d', 30);
    g.popup('MILESTONE', CFG.px + 30, cat.y - 160, '#fff6c2', 22);
    g.score += 25 * m;
  }

  /* arc popups */
  for (let i = arcTxt.length - 1; i >= 0; i--) {
    const a = arcTxt[i];
    a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 560 * dt;
    if (a.t > a.life) arcTxt.splice(i, 1);
  }

  /* score / state */
  g.scoreBase = base;
  g.state = { score: base + g.score, dist: base, spd: Math.round(S), hearts, mile };

  if (isAuto && cat.grounded && g.mode === 'play' && (g.scoreBase + g.score) >= 720) g.end({ win: true, score: g.scoreBase + g.score, label: 'METRES', progress: 1 });
}

function boxHit(o) {
  const cw = cat.slide > 0 ? 54 : 40;
  const ch = cat.slide > 0 ? 44 : 68;
  const cx = CFG.px - cw / 2 + 4, cy = cat.y - ch;
  return cx < o.x + o.w - 6 && cx + cw > o.x + 6 && cy < o.y + o.h - 4 && cy + ch > o.y + 4;
}

/* ---------------------------------------------------------------- draw */
let skyGrad = null;
function draw() {
  const ctx = g.ctx, S = spd();

  /* 1. sky */
  if (!skyGrad) {
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#080a24'); skyGrad.addColorStop(.34, '#231a52');
    skyGrad.addColorStop(.58, '#5a2668'); skyGrad.addColorStop(.76, '#b8465e'); skyGrad.addColorStop(.88, '#ff9a4d'); skyGrad.addColorStop(1, '#ffc46b');
  }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

  /* 2. stars — the deepest parallax layer */
  const so = (g.dist * .05) % W;
  for (const s of stars) {
    ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.fillStyle = '#dff3ff';
    const sx = ((s.x - so) % W + W) % W;
    ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* sun on the horizon */
  const sy = GY - 40;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, sy); ctx.clip();
  const sun = ctx.createRadialGradient(W * .72, sy, 8, W * .72, sy, 240);
  sun.addColorStop(0, 'rgba(255,240,180,1)'); sun.addColorStop(.28, 'rgba(255,170,90,.95)'); sun.addColorStop(1, 'rgba(255,90,140,0)');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W * .72, sy, 150, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,60,120,.45)';
  for (let i = 0; i < 9; i++) ctx.fillRect(W * .72 - 200, sy - 6 - i * 16, 400, 6);
  ctx.restore();

  /* 3-4. the two skylines */
  for (const L of parallax) skyline(L.L, L.baseY, L.col, L.win, L.par);

  /* rooftop */
  ctx.fillStyle = '#07040f'; ctx.fillRect(0, GY, W, H - GY);
  const rg = ctx.createLinearGradient(0, GY, 0, GY + 26);
  rg.addColorStop(0, 'rgba(125,249,255,.9)'); rg.addColorStop(1, 'rgba(125,249,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, GY, W, 26);
  ctx.fillStyle = '#0d0a1c';
  const off = (dist * .55) % 64;
  for (let x = -off; x < W; x += 64) ctx.fillRect(x, GY + 18, 34, H - GY - 18);
  ctx.fillStyle = 'rgba(125,249,255,.14)';
  for (let x = -off; x < W; x += 64) ctx.fillRect(x + 34, GY + 18, 4, H - GY - 18);

  /* speed streaks */
  const st = clamp((S - 430) / 360, 0, 1);
  if (st > .02) for (let i = 0; i < 14; i++) {
    const y = ((i * 137 + (g.t * S * .8) % 900) % (GY - 120)) + 60;
    const len = 30 + st * 130;
    ctx.globalAlpha = .06 + st * .16; ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W - ((g.t * S * 1.6 + i * 90) % (W + 200)), y); ctx.lineTo(W - ((g.t * S * 1.6 + i * 90) % (W + 200)) - len, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  /* coins */
  for (const c of coins) {
    const bob = Math.sin(c.t * 5) * 5;
    ctx.save(); ctx.translate(c.x, c.y + bob);
    const w = 15 * (.4 + .6 * Math.abs(Math.cos(c.t * 4)));
    ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(0, 0, w, 15, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.ellipse(-2, -3, w * .4, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* obstacles */
  for (const o of obs) {
    if (o.kind === 'crate') {
      const grd = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
      grd.addColorStop(0, '#4a2a7a'); grd.addColorStop(1, '#1c1030');
      ctx.fillStyle = grd; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#ff4ad8'; ctx.lineWidth = 3; ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
      ctx.strokeStyle = 'rgba(255,74,216,.35)'; ctx.lineWidth = 2;
      for (let yy = o.y + 16; yy < o.y + o.h - 8; yy += 22) { ctx.beginPath(); ctx.moveTo(o.x + 6, yy); ctx.lineTo(o.x + o.w - 6, yy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(o.x + 4, o.y + 3, 8, 3);
    } else {
      const bob = Math.sin(o.ph) * 6, cx = o.x + o.w / 2, cy = o.y + o.h / 2 + bob;
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = '#ff2b5e'; ctx.shadowBlur = 26;
      ctx.fillStyle = '#2a1030'; ctx.beginPath(); ctx.ellipse(0, 0, o.w / 2, o.h / 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff2b5e'; ctx.beginPath(); ctx.ellipse(0, 0, o.w / 2 - 6, 5, 0, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(o.w * .18, -4, 5 + Math.sin(o.ph * 2) * 1.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,180,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-o.w * .4, -o.h * .2); ctx.lineTo(-o.w * .5, -o.h * .55); ctx.moveTo(o.w * .4, -o.h * .2); ctx.lineTo(o.w * .5, -o.h * .55); ctx.stroke();
      ctx.restore();
      const ug = ctx.createRadialGradient(cx, GY - 10, 2, cx, GY - 10, 60);
      ug.addColorStop(0, 'rgba(255,45,94,.28)'); ug.addColorStop(1, 'rgba(255,45,94,0)');
      ctx.fillStyle = ug; ctx.fillRect(cx - 60, GY - 60, 120, 66);
    }
  }

  /* herro */
  drawCat(ctx);

  /* 5. foreground gantry — the closest parallax depth, whips past fast */
  const nOff = (g.dist * 1.55) % near.w;
  for (let k = 0; k < 2; k++) {
    const ox = k * near.w - nOff;
    if (ox > W || ox + near.w < 0) continue;
    for (const b of near.b) {
      const x = ox + b.x;
      if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = '#03020a';
      ctx.fillRect(x, H - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(125,249,255,.22)';
      ctx.fillRect(x, H - b.h, b.w, 3);
      ctx.fillStyle = 'rgba(255,74,216,.16)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 10 + i * 26, H - b.h + 12, 4, b.h - 18);
    }
  }

  /* arc popups */
  for (const a of arcTxt) {
    const u = a.t / a.life;
    ctx.globalAlpha = clamp(1 - u * 1.15, 0, 1);
    const sc = 1 + (1 - Math.min(1, u * 3)) * .4;
    g.text(a.txt, a.x, a.y, { size: Math.round(a.size * sc), color: a.col, align: 'center', ink: '#12060f' });
  }
  ctx.globalAlpha = 1;

  /* hud */
  hudDraw(ctx);
}

function hudDraw(ctx) {
  const score = (g.scoreBase || 0) + (g.score || 0);
  const st = clamp((spd() - 430) / 360, 0, 1);
  ctx.save();
  panel(ctx, 22, 34, 300, 96, { r: 18, alpha: .42, color: '#08061a', stroke: 'rgba(160,240,255,.35)' });
  g.text(String(score).padStart(5, '0'), 40, 100, { size: 62, color: '#eaf7ff', ink: '#001' });
  g.text('METRES', 44, 122, { size: 20, color: '#8fd6ff', stroke: 3 });

  /* hearts */
  for (let i = 0; i < CFG.hearts; i++) {
    const on = i < hearts;
    heartPath(ctx, W - 196 + i * 34, 52, on ? 26 + (hearts === 1 ? Math.sin(g.t * 9) * 2.5 : 0) : 22, on ? '#ff4d6d' : 'rgba(255,77,109,.18)');
    ctx.fill();
  }

  /* speed meter */
  g.bar(W - 190, 74, 150, 16, st, `hsl(${190 - st * 190} 100% 62%)`);
  g.text('SPEED', W - 190, 62, { size: 18, color: '#cfe9ff', stroke: 3 });
  if (speedPop > 0) {
    ctx.globalAlpha = speedPop;
    g.text('▲', W - 44, 62 - speedPop * 8, { size: 22, color: '#9fe8ff', align: 'center' });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawCat(ctx) {
  const sqY = cat.sq, sqX = 2 - cat.sq;
  const hh = cat.slide > 0 ? 58 : 96;
  const hurt = invuln > 0 && Math.floor(g.t * 14) % 2 === 0;
  ctx.save();
  ctx.translate(CFG.px, cat.y);
  /* shadow */
  const sh = clamp(1 - (GY - cat.y) / 260, 0, 1);
  ctx.globalAlpha = .45 * sh; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 2, 34 * sh + 8, 7 * sh + 3, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(cat.rot);
  ctx.translate(0, cat.slide > 0 ? 14 : 0);
  ctx.scale(sqX, sqY);
  /* scarf */
  ctx.fillStyle = '#ff2b5e';
  ctx.beginPath(); ctx.moveTo(-4, -hh * .62);
  ctx.quadraticCurveTo(-40 - Math.sin(t * 12) * 8, -hh * .6 - 10, -62 - Math.sin(t * 12) * 14, -hh * .48 + Math.cos(t * 12) * 10);
  ctx.quadraticCurveTo(-38, -hh * .52, -4, -hh * .5); ctx.fill();
  drawChar('cat', ctx, 0, 0, hh, { dir: 1, anim: 1, t: g.t, color: hurt ? '#ffffff' : '#ffb347' });
  ctx.restore();
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ dist: Math.round(dist), obs: obs.map(o => [o.kind, Math.round(o.x)]), y: Math.round(cat.y), slide: +cat.slide.toFixed(2), grounded: cat.grounded, hearts });

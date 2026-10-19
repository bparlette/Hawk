// CAT RUNNER — cat-runner (Cat Arcade v2)
// Tap to jump, tap again mid-air to double jump, hold to slide. Neon rooftops, endless night.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'cat-runner', title: 'CAT RUNNER', sub: 'TAP = JUMP  ·  HOLD = SLIDE',
  hook: 'the city is chasing you', w: W, h: H, bg: '#08060f', style: 'toon',
  bloom: .8, ca: .4, vig: 1, scan: .2,
});

const GY = H * .8;                    // rooftop line
const CFG = {
  grav: 3050, jump: -1080, jump2: -920, px: 156,
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
const far = strip(24, { wMin: 44, wMax: 80, hMin: 150, hMax: 330, row: 28, col: 18 });
const mid = strip(20, { wMin: 58, wMax: 110, hMin: 210, hMax: 460, row: 24, col: 15 });
const stars = Array.from({ length: 60 }, () => ({ x: R() * W, y: R() * H * .5, r: rnd(.7, 2), ph: R() * 6, sp: rnd(.5, 1.8) }));

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
const isAuto = new URLSearchParams(location.search).has('auto');

function resetWorld() {
  cat = { y: GY, vy: 0, grounded: true, jumps: 0, slide: 0, rot: 0, sq: 1, tail: 0 };
  obs = []; coins = []; dist = 0; t = 0; overT = 0; nextAt = 150; dustT = 0; nearMiss = 0;
  g.score = 0; g.dist = 0;
  g.state = { score: 0, dist: 0, spd: CFG.spd(0) };
  g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => music('chase');
resetWorld();

const spd = () => CFG.spd(t);

/* ---------------------------------------------------------------- spawning */
function spawnPattern(x) {
  const r = R();
  if (r < .34) {                                   // single crate
    obs.push({ kind: 'crate', x, y: GY - 74, w: 58, h: 74 });
    if (chance(.6)) continue0(coins, x + 20, GY - 170, 1);
  } else if (r < .55) {                             // stack of two
    obs.push({ kind: 'crate', x, y: GY - 128, w: 58, h: 128 });
    if (chance(.5)) continue0(coins, x + 20, GY - 240, 1);
  } else if (r < .74) {                             // low drone — slide under
    obs.push({ kind: 'drone', x, y: GY - 148, w: 76, h: 62, ph: R() * 6 });
    if (chance(.7)) continue0(coins, x + 10, GY - 58, 1);
  } else if (r < .9) {                              // two crates with a gap between
    obs.push({ kind: 'crate', x, y: GY - 74, w: 54, h: 74 });
    obs.push({ kind: 'crate', x: x + 150, y: GY - 96, w: 54, h: 96 });
    for (let i = 0; i < 3; i++) coins.push({ x: x + 40 + i * 40, y: GY - 210 - Math.sin(i / 2 * Math.PI) * 54, taken: false, t: R() * 6 });
  } else {                                          // coin arc only — breather
    for (let i = 0; i < 5; i++) coins.push({ x: x + i * 44, y: GY - 120 - Math.sin(i / 4 * Math.PI) * 150, taken: false, t: R() * 6 });
  }
}
function continue0(list, x, y, n) { for (let i = 0; i < n; i++) list.push({ x: x + i * 36, y, taken: false, t: R() * 6 }); }

/* ---------------------------------------------------------------- input */
function doJump() {
  if (cat.grounded) { cat.vy = CFG.jump; cat.grounded = false; cat.jumps = 1; cat.sq = .74; sfx('jump'); g.fx.dust(cat.x, cat.y, 10, { color: 'rgba(180,240,255,.6)' }); }
  else if (cat.jumps < 2) {
    cat.vy = CFG.jump2; cat.jumps = 2; cat.sq = .8;
    sfx('jump', { pitch: 1.25 }); g.fx.burst(cat.x, cat.y + 10, 12, { kind: 'ring', color: '#7df9ff', speed: 130, life: .3 });
  }
}

/* ---------------------------------------------------------------- auto bot */
function botThink() {
  const dumb = g.dumb();
  const nx = obs.filter(o => o.x + o.w > CFG.px - 30).sort((a, b) => a.x - b.x)[0];
  if (!nx) { if (chance(.02)) doJump(); return; }
  const d = nx.x - (CFG.px - 26);
  const react = dumb ? rnd(20, 150) : 0;
  if (nx.kind === 'drone') {
    if (d < 120 + react && d > -nx.w && cat.grounded) cat.slide = .42;
    return;
  }
  const need = 132;                                                      // jump reach in px
  if (d < need + react && d > -20 && cat.grounded) doJump();
  else if (!cat.grounded && cat.jumps < 2 && d < 120 + react && d > 30 && cat.vy > -120) doJump();
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  t += dt;
  const S = spd();
  g.dist += S * dt;
  dist = g.dist;

  if (isAuto) { if (g.mode === 'play') { if (g.ptr.down) doJump(); botThink(); } }
  else if (g.taps.length && g.mode === 'play') doJump();

  /* slide */
  const holding = isAuto ? false : g.ptr.down;
  if (holding && cat.grounded) cat.slide = Math.max(cat.slide, .12);
  cat.slide = Math.max(0, cat.slide - dt);

  /* physics */
  if (!cat.grounded) {
    cat.vy += CFG.grav * dt;
    cat.y += cat.vy * dt;
    if (cat.y >= GY) {
      cat.y = GY; cat.vy = 0; cat.grounded = true; cat.jumps = 0; cat.sq = 1.22;
      sfx('thud', { pitch: 1.1, vol: .5 }); g.fx.dust(cat.x, GY, 14, { color: 'rgba(255,220,160,.55)' });
      g.punch(.05); g.shake(3);
    }
  }
  cat.sq = lerp(cat.sq, 1, dt * 9);
  cat.rot = lerp(cat.rot, cat.grounded ? 0 : clamp(cat.vy / 2600, -.35, .4), dt * 8);
  cat.tail = Math.sin(t * 14) * .3;

  /* dust while running */
  dustT -= dt;
  if (cat.grounded && cat.slide <= 0 && dustT <= 0) { dustT = .1; g.fx.dust(cat.x - 18, GY, 1, { color: 'rgba(255,200,140,.45)' }); }

  /* spawn */
  nextAt -= S * dt;
  if (nextAt <= 0) { spawnPattern(W + 60); nextAt = rnd(300, 420) - Math.min(90, t * 3); }

  /* obstacles */
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    o.x -= S * dt;
    if (o.kind === 'drone') o.ph += dt * 6;
    if (o.x + o.w < -40) { obs.splice(i, 1); continue; }
    if (!o.hit && boxHit(o)) {
      o.hit = true;
      cat.broken = false;
      g.impact(cat.x + 20, cat.y - 40, { punch: .16, shake: 22, flash: '#ff3b5c', flashA: .4, stop: .08, sfx: 'boom' });
      g.fx.burst(cat.x + 24, cat.y - 40, 24, { kind: 'debris', color: ['#ff3b5c', '#ffd34d', '#fff'], speed: 320 });
      g.end({ win: false, score: Math.round(dist / 10), label: 'METRES' });
      return;
    }
    /* near miss juice */
    if (!o.nm && o.x + o.w < CFG.px - 30) {
      o.nm = true;
      if (!cat.grounded) { g.combo.hit(CFG.px + 20, cat.y - 60, 'CLOSE'); sfx('whoosh', { pitch: comboPitch() }); }
    }
  }

  /* coins */
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= S * dt; c.t += dt;
    if (c.x < -30) { coins.splice(i, 1); continue; }
    if (!c.taken && Math.hypot(c.x - CFG.px, c.y - (cat.y - 40)) < 44) {
      c.taken = true; coins.splice(i, 1);
      g.score += 10 * g.combo.mult;
      g.combo.hit(c.x, c.y, '+10');
      sfx('coin', { pitch: comboPitch() });
      g.fx.burst(c.x, c.y, 8, { kind: 'spark', color: '#ffd34d', speed: 180, life: .35 });
      g.state.score = Math.round(dist / 10) + g.score;
    }
  }

  /* score / state */
  g.scoreBase = Math.round(dist / 10);
  g.state = { score: g.scoreBase + g.score, dist: Math.round(dist / 10), spd: Math.round(S) };

  if (isAuto && cat.grounded && g.mode === 'play' && (g.scoreBase + g.score) >= 720) g.end({ win: true, score: g.scoreBase + g.score, label: 'METRES' });
}

function boxHit(o) {
  const cw = cat.slide > 0 ? 54 : 40;
  const ch = cat.slide > 0 ? 44 : 68;
  const cx = CFG.px - cw / 2 + 4, cy = cat.y - ch;
  return cx < o.x + o.w - 6 && cx + cw > o.x + 6 && cy < o.y + o.h - 4 && cy + ch > o.y + 4;
}

/* ---------------------------------------------------------------- draw */
function draw() {
  const ctx = g.ctx, S = spd();

  /* sky */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#080a24'); sky.addColorStop(.34, '#231a52');
  sky.addColorStop(.58, '#5a2668'); sky.addColorStop(.76, '#b8465e'); sky.addColorStop(.88, '#ff9a4d'); sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  for (const s of stars) { ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(g.t * s.sp + s.ph)); ctx.fillStyle = '#dff3ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
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

  skyline(far, GY - 16, '#221a4e', 'rgba(255,214,140,.85)', .18);
  skyline(mid, GY + 6, '#110b2a', 'rgba(160,240,255,.85)', .42);

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
      /* under-glow so the slide lane reads */
      const ug = ctx.createRadialGradient(cx, GY - 10, 2, cx, GY - 10, 60);
      ug.addColorStop(0, 'rgba(255,45,94,.28)'); ug.addColorStop(1, 'rgba(255,45,94,0)');
      ctx.fillStyle = ug; ctx.fillRect(cx - 60, GY - 60, 120, 66);
    }
  }

  /* herro */
  drawCat(ctx);

  /* hud */
  hudDraw(ctx);
}

function hudDraw(ctx) {
  const score = (g.scoreBase || 0) + (g.score || 0);
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,20,.42)'; ctx.fillRect(22, 34, 300, 96);
  ctx.strokeStyle = 'rgba(160,240,255,.35)'; ctx.lineWidth = 3; ctx.strokeRect(22, 34, 300, 96);
  g.text(String(score).padStart(5, '0'), 40, 100, { size: 62, color: '#eaf7ff', ink: '#001' });
  g.text('METRES', 44, 122, { size: 20, color: '#8fd6ff', stroke: 3 });

  /* speed meter */
  const st = clamp((spd() - 430) / 360, 0, 1);
  g.bar(W - 190, 74, 150, 16, st, `hsl(${190 - st * 190} 100% 62%)`);
  g.text('SPEED', W - 190, 62, { size: 18, color: '#cfe9ff', stroke: 3 });
  ctx.restore();
}

function drawCat(ctx) {
  const sqY = cat.sq, sqX = 2 - cat.sq;
  const hh = cat.slide > 0 ? 58 : 96;
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
  drawChar('cat', ctx, 0, 0, hh, { dir: 1, anim: 1, t: g.t, color: '#ffb347' });
  ctx.restore();
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ dist: Math.round(dist), obs: obs.map(o => [o.kind, Math.round(o.x)]), y: Math.round(cat.y), slide: +cat.slide.toFixed(2), grounded: cat.grounded });

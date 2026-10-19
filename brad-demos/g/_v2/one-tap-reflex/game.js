// FLAP CAT — one-tap-reflex (Cat Arcade v2)
// One tap to fly. Three lives. Neon city never ends.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, starPath, heartPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'one-tap-reflex', title: 'FLAP CAT', sub: 'TAP TO FLAP  ·  3 LIVES',
  hook: 'one bad tap and it is over', w: W, h: H, bg: '#060912', style: 'toon',
  bloom: .72, ca: .42, vig: 1, scan: .22,
});

/* ------------------------------------------------------------------ tuning */
const CFG = {
  grav: 1450, flap: -528, vmax: 980, pr: 26, py: -14, cw: 74, px: 152,
  gap: n => Math.max(214, 340 - n * 4.2),
  spd: n => Math.min(470, 252 + n * 3.6),
  spacing: 340,
};

/* ------------------------------------------------------------------ scenery (built once) */
const strip = (n, o) => {
  const out = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(o.wMin, o.wMax), h = rnd(o.hMin, o.hMax);
    const wins = [];
    for (let wy = 14; wy < h - 16; wy += o.row) for (let wx = 8; wx < w - 10; wx += o.col)
      if (chance(.42)) wins.push({ x: wx, y: wy, on: chance(.5), ph: R() * 6 });
    out.push({ x, w, h, wins }); x += w + rnd(4, 16);
  }
  return { b: out, w: x };
};
const far = strip(26, { wMin: 42, wMax: 78, hMin: 130, hMax: 300, row: 26, col: 16 });
const mid = strip(22, { wMin: 56, wMax: 104, hMin: 190, hMax: 430, row: 22, col: 14 });
const near = strip(18, { wMin: 40, wMax: 96, hMin: 90, hMax: 230, row: 18, col: 12 });
const stars = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H * .55, r: rnd(.8, 2.1), ph: R() * 6, sp: rnd(.4, 1.6) }));

/* ------------------------------------------------------------------ world */
let cat, pipes = [], dist = 0, lives = 3, passed = 0, autoT = 0, overT = 0;
const isAuto = new URLSearchParams(location.search).has('auto');

function resetWorld() {
  cat = { x: CFG.px, y: H * .44, vy: 0, rot: 0, flap: 0, cool: 0, inv: 0, trail: [] };
  pipes = []; dist = 0; lives = 3; passed = 0; autoT = 0;
  g.score = 0; g.state = { score: 0, lives: 3, passed: 0, speed: CFG.spd(0) };
  g.combo.reset();
  for (let i = 0; i < 3; i++) spawnPipe(W + 220 + i * CFG.spacing);
  g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); };
resetWorld();

function spawnPipe(x = W + 90) {
  const n = passed;
  const gapH = CFG.gap(n);
  const gapY = rnd(gapH / 2 + 96, H - gapH / 2 - 110);
  const coins = [];
  if (chance(.72)) { const cy = gapY + rnd(-28, 28); for (let i = 0; i < 3; i++) coins.push({ x: 24 + i * 34, y: cy + (i - 1) * 6, taken: false, t: R() * 6 }); }
  pipes.push({ x, gapY, gapH, h: gapH, coins, passed: false, hue: chance(.5) ? 186 : 312, wob: R() * 6, dead: false });
  // second look: some pipes drift vertically
  const p = pipes[pipes.length - 1];
  if (n > 8 && chance(.35)) { p.drift = rnd(30, 70) * (chance(.5) ? 1 : -1); p.baseY = gapY; p.gapH0 = gapH; }
  return p;
}

function flap() {
  cat.vy = CFG.flap; cat.flap = 1; cat.rot = -.22; cat.cool = .1;
  sfx('jump', { pitch: .9 + R() * .12, vol: .8 });
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (.55 + R() * .9);
    g.fx.emit('glow', cat.x - 12 + R() * 10, cat.y + 12, { vx: Math.cos(a) * rnd(60, 190), vy: Math.sin(a) * rnd(120, 260), g: 420, life: rnd(.22, .42), size: rnd(6, 14), color: pick2(['#7df9ff', '#a6ff8f', '#ffd34d']), add: true });
  }
  g.fx.emit('ring', cat.x, cat.y, { life: .28, size: 24, color: '#8ef6ff', add: true });
  navigator.vibrate?.(8);
}
const pick2 = a => a[(Math.random() * a.length) | 0];

function hitPipe(p, cx, cy) {
  if (cat.inv > 0) return;
  p.dead = true;
  lives--; cat.inv = 1.15; cat.vy = -240;
  g.state.lives = lives;
  g.impact(cx, cy, { punch: .1, shake: 22, stop: .11, flash: '#ff3b5c', flashA: .38, rip: 1.6 });
  sfx('hit', { pitch: .8 }); sfx('meow', { pitch: .7, vol: .5 });
  g.combo.miss();
  g.fx.burst(cx, cy, 26, { kind: 'shard', colors: ['#ff4d6d', '#ffd34d', '#fff', '#7df9ff'] });
  g.fx.burst(cx, cy, 16, { kind: 'feather', colors: ['#ff9a3c', '#ffd8a8', '#fff'] });
  g.fx.blast(cx, cy, { r: 90, color: '#ff4d6d' });
  navigator.vibrate?.([20, 40, 30]);
  if (lives <= 0) die();
}

function die() {
  cat.dead = true;
  for (let i = 0; i < 26; i++) g.fx.emit('feather', cat.x + rnd(-24, 24), cat.y + rnd(-24, 24), { vx: rnd(-260, 260), vy: rnd(-380, 120), g: 700, life: rnd(.7, 1.4), size: rnd(7, 15), color: pick2(['#ff9a3c', '#ffd8a8', '#fff', '#ff6b6b']), rot: R() * 6, vr: rnd(-9, 9), drag: .6 });
  g.end({ win: false, score: g.score, label: 'DISTANCE' });
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode === 'over') { overT += dt; for (const p of pipes) p.x -= 40 * dt; return; }

  const speed = CFG.spd(passed);
  g.state.speed = speed;
  dist += speed * dt;
  autoT += dt;

  /* --- input --- */
  let tapped = g.taps.length > 0 || g.pressed.Space || g.pressed.ArrowUp || g.pressed.KeyW || g.pressed.KeyZ;
  if (g.btn('flap', 0, 0, W, H, '', { key: 'Space' }).pressed) tapped = true;
  if (isAuto) { tapped = false; botThink(); }
  if (tapped && !cat.dead) flap();

  /* --- physics --- */
  cat.vy = Math.min(CFG.vmax, cat.vy + CFG.grav * dt);
  cat.y += cat.vy * dt;
  cat.flap = Math.max(0, cat.flap - dt * 3.4); cat.cool = Math.max(0, cat.cool - dt);
  cat.rot = lerp(cat.rot, clamp(cat.vy / 1100, -.5, .95), dt * 9);
  cat.inv = Math.max(0, cat.inv - dt);

  /* ceiling / floor = bounce, costs a life on the floor */
  if (cat.y < CFG.pr + 12) { cat.y = CFG.pr + 12; cat.vy = Math.max(cat.vy, 60); }
  if (cat.y > H - 60) {
    if (cat.inv <= 0) { cat.inv = 1.1; lives--; g.state.lives = lives; g.impact(cat.x, H - 60, { punch: .09, shake: 20, flash: '#ff3b5c', flashA: .3 }); sfx('thud'); g.fx.burst(cat.x, H - 62, 20, { kind: 'smoke', color: 'rgba(255,255,255,.5)' }); if (lives <= 0) { die(); return; } }
    cat.y = H - 60; cat.vy = CFG.flap * .82;
  }

  /* --- trail --- */
  cat.trail.unshift({ x: cat.x, y: cat.y, r: cat.rot });
  if (cat.trail.length > 14) cat.trail.pop();
  if (speed > 330) g.fx.emit('glow', cat.x - 26, cat.y + rnd(-16, 16), { vx: -speed * 1.1, life: .3, size: rnd(4, 9), color: '#8ef6ff', add: true });

  /* --- pipes --- */
  for (const p of pipes) {
    p.x -= speed * dt;
    if (p.drift) { p.wob += dt * 1.6; p.gapY = p.baseY + Math.sin(p.wob) * p.drift; }
    for (const c of p.coins) c.t += dt * 3;
    if (!p.dead && collides(p)) hitPipe(p, p.x + CFG.cw / 2, cat.y);
    if (!p.passed && p.x + CFG.cw < cat.x - CFG.pr) {
      p.passed = true; passed++; g.state.passed = passed;
      const mid = Math.abs(cat.y - p.gapY) < 42;
      const pts = Math.round((mid ? 18 : 10) * g.combo.mult);
      g.score += pts;
      g.combo.hit(p.x + CFG.cw, cat.y, mid ? `PERFECT +${pts}` : `+${pts}`);
      if (mid) { sfx('perfect'); g.fx.emit('ring', cat.x, cat.y, { life: .4, size: 40, color: '#ffd34d', add: true }); g.punch(.05); }
      g.punch(.03); g.fx.burst(p.x + CFG.cw, cat.y, 8, { kind: 'spark', colors: ['#7df9ff', '#fff', '#a6ff8f'], life: .4, size: 5 });
    }
    for (const c of p.coins) {
      if (c.taken) continue;
      const cx = p.x + c.x, cy = c.y;
      if (Math.hypot(cx - cat.x, cy - cat.y) < CFG.pr + 24) {
        c.taken = true; const v = Math.round(5 * g.combo.mult); g.score += v;
        sfx('coin', { pitch: comboPitch(passed % 12) });
        g.popup(`+${v}`, cx, cy, '#ffd34d', 28);
        g.fx.burst(cx, cy, 12, { kind: 'star', colors: ['#ffd34d', '#fff3a8', '#fff'], life: .5, size: 7 });
        g.punch(.025);
      }
    }
  }
  while (pipes.length && pipes[0].x < -CFG.cw - 80) pipes.shift();
  const last = pipes[pipes.length - 1];
  if (!last || last.x < W - CFG.spacing + CFG.cw) spawnPipe(Math.max(W + 40, last ? last.x + CFG.spacing : W + 40));

  g.state.score = Math.round(g.score);
  /* auto-video guard: keep rounds finite */
  if (isAuto && g.mode === 'play' && (g.score >= 360 || autoT > 55)) { if (g.score >= 360) g.end({ win: true, score: g.score, label: 'DISTANCE' }); else die(); }
}

const collides = p => {
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const cx = cat.x + 6, cy = cat.y + CFG.py, r = CFG.pr;
  if (cx + r < p.x || cx - r > p.x + CFG.cw) return false;
  return cy - r < top || cy + r > bot;
};

/* ------------------------------------------------------------------ bot (video autoplay) */
function botThink() {
  const dumb = g.dumb();
  const nx = pipes.find(p => !p.dead && p.x + CFG.cw > cat.x - 34);
  /* steer the hit-circle (a little above the sprite origin) toward the gap, hopping from below */
  const cy = cat.y + CFG.py;
  let aim = nx ? nx.gapY + 30 : H * .45;
  if (dumb) aim += Math.sin(g.t * 2.7) * 88;
  const slack = dumb ? 46 : 6;
  if (cat.cool <= 0 && cat.vy > (dumb ? 90 : -70) && cy > aim + slack) flap();
  else if (cat.y < 150 && cat.vy > -20 && cat.cool <= 0) flap();
}

/* ------------------------------------------------------------------ draw */
function draw(ctx) {
  /* dusk sky */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1130'); sky.addColorStop(.38, '#2e2160');
  sky.addColorStop(.62, '#6b2f6e'); sky.addColorStop(.82, '#c94f60'); sky.addColorStop(1, '#ffa14e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  /* stars */
  for (const s of stars) {
    const tw = .35 + .65 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.globalAlpha = tw; ctx.fillStyle = '#dff2ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* moon */
  const mx = W * .74, my = H * .19;
  const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 150);
  halo.addColorStop(0, 'rgba(255,236,190,.5)'); halo.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, 150, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff2cf'; ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(214,186,150,.55)';
  for (const [dx, dy, r] of [[-16, -12, 9], [12, 8, 12], [-6, 20, 6], [22, -18, 5]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }

  /* horizon burn — separates the sky from the skyline so obstacles read instantly */
  const hg = ctx.createRadialGradient(W * .5, H * .8, 20, W * .5, H * .8, W * .95);
  hg.addColorStop(0, 'rgba(255,170,90,.55)'); hg.addColorStop(.45, 'rgba(255,110,110,.22)'); hg.addColorStop(1, 'rgba(255,90,140,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, H * .35, W, H * .65);

  /* parallax clouds */
  for (let i = 0; i < 5; i++) {
    const cw = 320 + i * 60, cx = ((i * 190 - dist * (.05 + i * .02)) % (W + cw * 2) + W + cw * 2) % (W + cw * 2) - cw;
    const cy = H * (.16 + i * .085), ch = 26 + (i % 3) * 10;
    ctx.globalAlpha = .16 + i * .02; ctx.fillStyle = i % 2 ? '#2b1b52' : '#4a2a63';
    ctx.beginPath(); ctx.ellipse(cx, cy, cw * .5, ch, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + cw * .2, cy + 12, cw * .32, ch * .8, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* city layers */
  cityStrip(ctx, far, .12, H * .76, '#1b1442', 'rgba(255,206,120,.55)', 1);
  cityStrip(ctx, mid, .3, H * .86, '#120c2c', 'rgba(255,226,150,.85)', 1.4);
  cityStrip(ctx, near, .62, H * 1.02, '#07040f', 'rgba(170,235,255,.75)', 1);

  /* floor haze */
  const hz = ctx.createLinearGradient(0, H - 150, 0, H);
  hz.addColorStop(0, 'rgba(12,5,24,0)'); hz.addColorStop(1, 'rgba(12,5,24,.6)');
  ctx.fillStyle = hz; ctx.fillRect(0, H - 150, W, 150);

  /* pipes + coins */
  for (const p of pipes) pipeDraw(ctx, p);
  for (const p of pipes) for (const c of p.coins) if (!c.taken) coinDraw(ctx, p.x + c.x, c.y, c.t);

  /* speed streaks */
  if (CFG.spd(passed) > 300) {
    ctx.globalAlpha = .16; ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = (i * 137 + (dist * .9) % 960) % H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rnd(50, 170), y + 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  catDraw(ctx);
}

function cityStrip(ctx, s, par, baseY, col, winCol, scale) {
  const ox = (dist * par) % s.w;
  ctx.save();
  for (let rep = -1; rep <= 1; rep++) {
    for (const b of s.b) {
      const x = b.x - ox + rep * s.w;
      if (x > W + 10 || x + b.w < -10) continue;
      const h = b.h * scale, y = baseY - h;
      ctx.fillStyle = col; ctx.fillRect(x, y, b.w, h + 4);
      ctx.fillStyle = winCol;
      for (const w of b.wins) {
        const lit = w.on ? 1 : .25 + .25 * Math.sin(g.t * 1.5 + w.ph);
        ctx.globalAlpha = lit * .9;
        ctx.fillRect(x + w.x, y + w.y, 5, 7);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function pipeDraw(ctx, p) {
  if (p.dead) return;
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const hue = p.hue, c1 = `hsl(${hue} 100% 62%)`, c2 = `hsl(${hue} 90% 42%)`;
  for (const [y0, y1, flip] of [[-40, top, 1], [bot, H + 40, -1]]) {
    const hh = y1 - y0;
    const gd = ctx.createLinearGradient(p.x, 0, p.x + CFG.cw, 0);
    gd.addColorStop(0, '#141c3a'); gd.addColorStop(.34, '#26325c'); gd.addColorStop(.5, `hsl(${hue} 78% 34%)`); gd.addColorStop(.68, '#243059'); gd.addColorStop(1, '#131a34');
    rr(ctx, p.x, y0, CFG.cw, hh, 12); ctx.fillStyle = gd; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = c1; ctx.stroke();
    /* neon rails */
    ctx.globalAlpha = .95;
    seg2(ctx, p.x + 5, y0 + 6, p.x + 5, y1 - 6, 3, c1);
    seg2(ctx, p.x + CFG.cw - 5, y0 + 6, p.x + CFG.cw - 5, y1 - 6, 3, c1);
    ctx.globalAlpha = 1;
    /* cap */
    const cy0 = flip === 1 ? top - 30 : bot;
    rr(ctx, p.x - 7, cy0, CFG.cw + 14, 30, 8);
    const cg = ctx.createLinearGradient(p.x, cy0, p.x, cy0 + 30);
    cg.addColorStop(0, c1); cg.addColorStop(1, c2);
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#060a14'; ctx.stroke();
    ctx.globalAlpha = .8; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(p.x - 2, cy0 + 4, CFG.cw + 4, 4); ctx.globalAlpha = 1;
    /* hazard stripes on the mouth */
    ctx.save(); ctx.beginPath(); ctx.rect(p.x - 7, cy0, CFG.cw + 14, 30); ctx.clip();
    ctx.globalAlpha = .35; ctx.fillStyle = '#000';
    for (let i = -40; i < CFG.cw + 40; i += 18) { ctx.beginPath(); ctx.moveTo(p.x + i, cy0); ctx.lineTo(p.x + i + 9, cy0); ctx.lineTo(p.x + i + 3, cy0 + 30); ctx.lineTo(p.x + i - 6, cy0 + 30); ctx.fill(); }
    ctx.restore();
  }
  /* gap glow */
  ctx.globalAlpha = .18; ctx.fillStyle = c1;
  ctx.fillRect(p.x - 3, top - 26, CFG.cw + 6, 20);
  ctx.fillRect(p.x - 3, bot + 6, CFG.cw + 6, 20);
  ctx.globalAlpha = 1;
}

const seg2 = (c, x1, y1, x2, y2, w, col) => { c.beginPath(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

function coinDraw(ctx, x, y, t) {
  const sc = .55 + .45 * Math.abs(Math.cos(t * 1.6));
  ctx.save(); ctx.translate(x, y + Math.sin(t * 1.2) * 5); ctx.scale(sc, 1);
  const gd = ctx.createRadialGradient(0, -6, 2, 0, 0, 26);
  gd.addColorStop(0, '#fffbe0'); gd.addColorStop(.55, '#ffd34d'); gd.addColorStop(1, '#e59b00');
  starPath(ctx, 0, 0, 22, t * .5); ctx.fillStyle = gd; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#6b4200'; ctx.stroke();
  ctx.restore();
}

function catDraw(ctx) {
  /* trail ribbon */
  if (cat.trail.length > 3) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = cat.trail.length - 1; i > 0; i--) {
      const a = cat.trail[i], b = cat.trail[i - 1], k = 1 - i / cat.trail.length;
      ctx.globalAlpha = k * .30; ctx.strokeStyle = i % 2 ? '#7df9ff' : '#ffd34d';
      ctx.lineWidth = 26 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  const blink = cat.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = .45;

  /* wing flap glow */
  const fl = cat.flap;
  if (fl > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createRadialGradient(cat.x - 22, cat.y + 6, 2, cat.x - 22, cat.y + 6, 54 * fl + 12);
    wg.addColorStop(0, 'rgba(190,250,255,.9)'); wg.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(cat.x - 22, cat.y + 6, 54 * fl + 12, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.rot);
  const sq = 1 + fl * .16;
  ctx.scale(1 / sq, sq);
  /* scarf */
  const sl = 16 + fl * 10;
  ctx.beginPath(); ctx.moveTo(-2, -62); ctx.quadraticCurveTo(-40, -58 + Math.sin(g.t * 18) * 6, -46 - sl, -40 + Math.cos(g.t * 15) * 8);
  ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  drawChar('cat', ctx, 0, 30, 88, { dir: 1, t: g.t, color: '#ff9a3c', anim: fl > .1 ? 'walk' : undefined });
  ctx.restore();

  /* rim light from the neon */
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ HUD */
function hud(ctx) {
  /* score panel */
  rr(ctx, 22, 22, 208, 104, 18);
  ctx.fillStyle = 'rgba(8,10,24,.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(160,240,255,.28)'; ctx.lineWidth = 2; ctx.stroke();
  g.text('DISTANCE', 40, 50, { size: 20, color: '#8ef6ff', stroke: 3 });
  g.text(String(Math.round(g.score)).padStart(4, '0'), 40, 106, { size: 60, color: '#fff' });

  /* lives */
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 44, y = 158;
    heartPath(ctx, x, y, 30);
    if (i < lives) { const hg = ctx.createLinearGradient(x, y - 16, x, y + 16); hg.addColorStop(0, '#ff8fa3'); hg.addColorStop(1, '#e01b3c'); ctx.fillStyle = hg; }
    else ctx.fillStyle = 'rgba(255,255,255,.13)';
    ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = i < lives ? '#5c0416' : 'rgba(255,255,255,.2)'; ctx.stroke();
  }

  /* speed gauge (bottom) */
  const sp = (CFG.spd(passed) - CFG.spd(0)) / (470 - CFG.spd(0));
  rr(ctx, 30, H - 44, W - 60, 14, 7); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  const sg = ctx.createLinearGradient(30, 0, W - 30, 0);
  sg.addColorStop(0, '#7df9ff'); sg.addColorStop(.6, '#ffd34d'); sg.addColorStop(1, '#ff3b5c');
  rr(ctx, 30, H - 44, Math.max(20, (W - 60) * clamp(sp, .04, 1)), 14, 7); ctx.fillStyle = sg; ctx.fill();
  g.text('SPEED', 30, H - 54, { size: 18, color: 'rgba(255,255,255,.6)', stroke: 3 });

  if (g.mode === 'title') g.text('TAP ANYWHERE', W / 2, H * .68, { size: 34, align: 'center', color: '#fff' });
}

window.__g = g; window.__dbg = () => ({ score: g.score, lives, passed, pipes: pipes.map(p => [Math.round(p.x), Math.round(p.gapY), Math.round(p.gapH), p.dead ? 1 : 0]), cat: [Math.round(cat.x), Math.round(cat.y), Math.round(cat.vy)] });
g.run(update, draw, hud);

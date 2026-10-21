// NIGHT CITY GLITCH — Cyberpunk 2077 meme endless dodger
// You are V. Night City is glitching. Dodge T-posing NPCs, falling cars, grab eddies.
// Johnny Silverhand pops up with meme wisdom. Survive the launch-day bugs.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, pick, R, TAU, damp,
         panel, pill, rr, fmt, hexA } from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'night-city-glitch', title: 'NIGHT CITY GLITCH', sub: 'CYBERPUNK 2077  ·  MEME RUN',
  hook: 'dodge the launch-day bugs', w: W, h: H, bg: '#0a0a12',
  bloom: 1, ca: 0, vig: 1.05, scan: .22,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');

/* ── tuning ── */
const LANES = [90, 200, 310, 420];   // 4 lanes for V to dodge between
const SPD = 320;                       // world scroll speed
const JOHNNY_QUOTES = [
  'WAKE UP, SAMURAI.',
  'WE HAVE A CITY TO BURN.',
  "YOU'RE BREATHTAKING!",
  'NEVER FADE AWAY.',
  'TIME TO BURN IT DOWN.',
  'CHIP IN, CHOOM.',
  'FLATLINE THE BUGS.',
];

/* ── state ── */
let p, npcs, cars, eddies, glitches, pops, warnCars;
let t, frame, spawnT, carT, eddieT, johnnyT, johnnyMsg, johnnyMsgT;
let dist, wanted, hitT, autoT, steerLane, gameOver;

function resetWorld() {
  p = { lane: 1, x: LANES[1], y: H - 180, hp: 3, inv: 0, t: 0, dir: 1, tilt: 0, hurtT: 0 };
  npcs = []; cars = []; eddies = []; glitches = []; pops = []; warnCars = [];
  t = 0; frame = 0; spawnT = 1.2; carT = 2.5; eddieT = 0.8;
  johnnyT = 8; johnnyMsg = ''; johnnyMsgT = 0;
  dist = 0; wanted = 1; hitT = 0; autoT = 0; steerLane = 1; gameOver = false;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { hp: 3, score: 0 };
  music('action');
}
g.onReset = resetWorld;

/* ── spawners ── */
function spawnNPC() {
  const lane = ri(0, 3);
  const side = R() < 0.5 ? -1 : 1;
  npcs.push({
    lane, x: side < 0 ? -60 : W + 60, y: rnd(H * 0.25, H * 0.7),
    vx: side * rnd(140, 220), t: R() * 9, dead: false,
    // T-pose: arms straight out, sliding sideways (the iconic bug)
  });
}

function spawnCarWarn() {
  const lane = ri(0, 3);
  warnCars.push({ lane, x: LANES[lane], t: 0, warn: 1.1 });  // warning shadow first
}

function spawnEddie() {
  const lane = ri(0, 3);
  eddies.push({ lane, x: LANES[lane], y: -30, vy: SPD * 0.9, t: R() * 9, dead: false });
}

function spawnGlitch() {
  glitches.push({ x: rnd(0, W), y: rnd(0, H), w: rnd(60, 200), h: rnd(4, 20), t: 0, life: rnd(0.2, 0.5) });
}

/* ── Johnny ── */
function triggerJohnny() {
  johnnyMsg = pick(JOHNNY_QUOTES);
  johnnyMsgT = 3.2;
  g.showBanner('JOHNNY SILVERHAND', 1.4);
  sfx('powerup', { pitch: 0.7, vol: 0.5 });
  // Johnny hologram flicker effect
  for (let i = 0; i < 12; i++) {
    spawnGlitch();
  }
}

/* ── damage ── */
function hurt() {
  if (p.inv > 0 || gameOver) return;
  p.hp--; p.inv = 1.2; p.hurtT = 1;
  // Hit-stop (juice, no full-screen shake per veto)
  g.combo.reset();
  g.fx.burst(p.x, p.y - 40, 18, { kind: 'spark', color: ['#ff2b5c', '#fff', '#fcee0a'], speed: 380, life: .6 });
  sfx('hit', { pitch: 0.8 });
  if (p.hp <= 0) {
    p.hp = 0;
    gameOver = true;
    g.fx.burst(p.x, p.y - 40, 30, { kind: 'debris', color: ['#fcee0a', '#ff2b5c', '#fff'], speed: 500, life: 1 });
    g.showBanner('FLATLINED', 2);
    g.end({ win: false, score: Math.round(g.score), label: 'EDDIES', progress: dist / 1000 });
  }
}

/* ── update ── */
function update(dt) {
  t += dt; frame++;
  if (gameOver) return;

  // Distance + wanted level
  dist += SPD * dt / 100;
  g.score += SPD * dt * 0.1;
  wanted = 1 + Math.floor(dist / 150);

  // Auto-bot: dodge threats, grab eddies
  if (isAuto) {
    autoT -= dt;
    if (autoT <= 0) {
      autoT = 0.25;
      // Find safest lane: avoid NPCs and warning cars, prefer eddies
      let best = p.lane, bestScore = -999;
      for (let l = 0; l < 4; l++) {
        let s = 0;
        for (const n of npcs) {
          if (Math.abs(n.lane - l) < 0.6 && Math.abs(n.y - p.y) < 160) s -= 100;
        }
        for (const wc of warnCars) {
          if (wc.lane === l) s -= 80;
        }
        for (const c of cars) {
          if (c.lane === l && c.y > p.y - 200 && c.y < p.y + 60) s -= 120;
        }
        for (const e of eddies) {
          if (e.lane === l && e.y > p.y - 300 && e.y < p.y) s += 20;
        }
        s -= Math.abs(l - p.lane) * 5;  // prefer nearby lanes
        if (s > bestScore) { bestScore = s; best = l; }
      }
      steerLane = best;
    }
    p.lane = steerLane;
  }

  // Player lane movement (smooth)
  const targetX = LANES[p.lane];
  p.x = damp(p.x, targetX, 12, dt);
  p.tilt = clamp((targetX - p.x) * 0.004, -0.3, 0.3);
  p.t += dt;
  if (p.inv > 0) p.inv -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;

  // Spawners (scale with wanted level)
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = Math.max(0.5, 1.4 - wanted * 0.12);
    spawnNPC();
    if (R() < 0.3 + wanted * 0.05) spawnNPC();
  }
  carT -= dt;
  if (carT <= 0) {
    carT = Math.max(1.2, 3.2 - wanted * 0.25);
    spawnCarWarn();
  }
  eddieT -= dt;
  if (eddieT <= 0) {
    eddieT = rnd(0.7, 1.4);
    spawnEddie();
  }
  // Random glitch artifacts
  if (R() < dt * 3) spawnGlitch();

  // Johnny timer
  johnnyT -= dt;
  if (johnnyT <= 0) {
    johnnyT = rnd(10, 16);
    triggerJohnny();
  }
  if (johnnyMsgT > 0) johnnyMsgT -= dt;

  // Update NPCs (T-pose slide)
  for (const n of npcs) {
    n.x += n.vx * dt;
    n.t += dt;
    // T-pose bob (the bug wobble)
    n.y += Math.sin(n.t * 8) * 12 * dt;
    if ((n.vx < 0 && n.x < -80) || (n.vx > 0 && n.x > W + 80)) n.dead = true;
    // Hit player?
    if (!n.dead && Math.abs(n.x - p.x) < 44 && Math.abs(n.y - p.y) < 60) {
      n.dead = true;
      hurt();
    }
  }
  npcs = npcs.filter(n => !n.dead);

  // Warning cars → become falling cars
  for (const wc of warnCars) {
    wc.t += dt;
    if (wc.t >= wc.warn) {
      cars.push({ lane: wc.lane, x: wc.x, y: -80, vy: rnd(500, 700), t: 0, dead: false });
      sfx('drop', { pitch: 0.6, vol: 0.4 });
    }
  }
  warnCars = warnCars.filter(wc => wc.t < wc.warn);

  // Falling cars
  for (const c of cars) {
    c.y += c.vy * dt;
    c.t += dt;
    if (c.y > H + 100) { c.dead = true; continue; }
    // Hit player?
    if (Math.abs(c.x - p.x) < 50 && Math.abs(c.y - p.y) < 70) {
      c.dead = true;
      hurt();
      // Car crash particles
      g.fx.burst(c.x, c.y, 20, { kind: 'debris', color: ['#ff6b35', '#151515', '#fcee0a'], speed: 420, life: .8, size: 9 });
    }
  }
  cars = cars.filter(c => !c.dead);

  // Eddies (collect)
  for (const e of eddies) {
    e.y += e.vy * dt;
    e.t += dt;
    if (e.y > H + 40) { e.dead = true; continue; }
    if (Math.abs(e.x - p.x) < 44 && Math.abs(e.y - p.y) < 60) {
      e.dead = true;
      g.score += 50;
      g.combo.hit();
      pops.push({ x: e.x, y: e.y - 20, txt: '+50', t: 0, life: 0.8, col: '#fcee0a' });
      g.fx.burst(e.x, e.y, 8, { kind: 'spark', color: ['#fcee0a', '#fff'], speed: 220, life: .5 });
      sfx('coin', { pitch: comboPitch() });
    }
  }
  eddies = eddies.filter(e => !e.dead);

  // Glitch artifacts
  for (const gl of glitches) {
    gl.t += dt;
  }
  glitches = glitches.filter(gl => gl.t < gl.life);

  // Popups
  for (const pp of pops) {
    pp.t += dt;
    pp.y -= 60 * dt;
  }

  g.state = { hp: p.hp, score: Math.round(g.score), wanted };
}

/* ── draw helpers ── */
function drawV(c) {
  // V in yellow samurai jacket (top-down-ish side view)
  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.tilt);
  if (p.inv > 0 && Math.floor(t * 12) % 2 === 0) c.globalAlpha = 0.4;

  const hurt = p.hurtT > 0;
  // Shadow
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(0, 6, 26, 10, 0, 0, TAU); c.fill();

  // Body: yellow jacket
  c.fillStyle = hurt ? '#ff5c5c' : '#fcee0a';
  rr(c, -20, -56, 40, 52, 10); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();

  // Jacket details (black stripes)
  c.fillStyle = '#151515';
  c.fillRect(-20, -36, 40, 6);
  c.fillRect(-20, -20, 40, 6);

  // Head
  c.fillStyle = '#e8b88a';
  c.beginPath(); c.arc(0, -68, 16, 0, TAU); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();
  // Hair (dark, cyberpunk)
  c.fillStyle = '#2a2a3a';
  c.beginPath(); c.arc(0, -72, 16, Math.PI, TAU); c.fill();
  // Eyes (visor glow)
  c.fillStyle = '#00f0ff';
  c.fillRect(-10, -70, 20, 5);

  // Legs (running)
  const run = Math.sin(p.t * 14) * 10;
  c.fillStyle = '#2a2a3a';
  rr(c, -16, -4, 13, 22 + run * 0.4, 6); c.fill();
  rr(c, 3, -4, 13, 22 - run * 0.4, 6); c.fill();

  c.restore();
}

function drawTPoseNPC(c, n) {
  // THE iconic bug: T-posing NPC sliding sideways
  c.save();
  c.translate(n.x, n.y);
  const bob = Math.sin(n.t * 8) * 3;

  // Shadow (glitched - offset)
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath(); c.ellipse(8, 8, 30, 10, 0, 0, TAU); c.fill();

  // Body (vertical)
  const cols = ['#ff5c5c', '#5c8cff', '#5cff8c', '#ff5cff'];
  const col = cols[Math.floor(n.t * 2) % 4];  // glitch color cycling
  c.fillStyle = col;
  rr(c, -14, -50 + bob, 28, 60, 8); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();

  // ARMS STRAIGHT OUT (T-pose)
  c.fillStyle = col;
  rr(c, -52, -44 + bob, 104, 16, 8); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();

  // Head
  c.fillStyle = '#e8b88a';
  c.beginPath(); c.arc(0, -62 + bob, 13, 0, TAU); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();
  // X eyes (dead/bugged)
  c.strokeStyle = '#151515'; c.lineWidth = 2.5;
  for (const dx of [-5, 5]) {
    c.beginPath();
    c.moveTo(dx - 3, -65 + bob); c.lineTo(dx + 3, -59 + bob);
    c.moveTo(dx + 3, -65 + bob); c.lineTo(dx - 3, -59 + bob);
    c.stroke();
  }

  // "T-POSE" label (meme)
  c.fillStyle = '#fff';
  c.font = '900 13px Impact, "Arial Black", sans-serif';
  c.textAlign = 'center';
  c.fillText('T-POSE', 0, 32);

  c.restore();
}

function drawCar(c, car) {
  c.save();
  c.translate(car.x, car.y);
  // Falling car (top-down view, spinning slightly)
  c.rotate(Math.sin(car.t * 6) * 0.15);

  // Shadow grows as it falls
  const shScale = clamp(1 - (car.y / H), 0.3, 1);

  c.fillStyle = '#ff6b35';
  rr(c, -34, -58, 68, 116, 14); c.fill();
  c.lineWidth = 4; c.strokeStyle = '#151515'; c.stroke();
  // Windshield
  c.fillStyle = '#1a1a2e';
  rr(c, -26, -38, 52, 30, 8); c.fill();
  // Roof
  c.fillStyle = '#cc5528';
  rr(c, -26, 2, 52, 24, 6); c.fill();
  // "!" warning
  c.fillStyle = '#fff';
  c.font = '900 28px Impact, sans-serif';
  c.textAlign = 'center';
  c.fillText('!', 0, 12);

  c.restore();
}

function drawEddie(c, e) {
  c.save();
  c.translate(e.x, e.y + Math.sin(e.t * 5) * 4);
  // Eddie coin (€$)
  const s = 1 + Math.sin(e.t * 6) * 0.1;
  c.scale(s, s);
  c.fillStyle = '#fcee0a';
  c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#151515'; c.stroke();
  c.fillStyle = '#151515';
  c.font = '900 20px Impact, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('€$', 0, 1);
  // Glow
  c.shadowColor = '#fcee0a'; c.shadowBlur = 16;
  c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.stroke();
  c.shadowBlur = 0;
  c.restore();
}

function drawBackground(c) {
  // Night City: dark with neon grid
  const grd = c.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0f0f1e');
  grd.addColorStop(0.6, '#0a0a14');
  grd.addColorStop(1, '#080810');
  c.fillStyle = grd;
  c.fillRect(0, 0, W, H);

  // Neon grid (perspective-ish, scrolling)
  c.strokeStyle = 'rgba(0,240,255,.12)';
  c.lineWidth = 2;
  const off = (t * SPD * 0.5) % 80;
  for (let y = -80 + off; y < H; y += 80) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  c.strokeStyle = 'rgba(255,44,92,.10)';
  for (let x = 0; x <= W; x += 90) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
  }

  // Lane dividers (neon)
  for (let i = 1; i < 4; i++) {
    const x = (LANES[i-1] + LANES[i]) / 2;
    c.strokeStyle = 'rgba(252,238,10,.25)';
    c.lineWidth = 3;
    c.setLineDash([18, 14]);
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    c.setLineDash([]);
  }

  // City skyline silhouette at top (parallax)
  c.fillStyle = '#06060c';
  const buildings = [0, 60, 140, 210, 300, 380, 460, 520];
  for (let i = 0; i < buildings.length; i++) {
    const bx = buildings[i];
    const bh = 90 + (i * 37 % 60);
    c.fillRect(bx, 120 - bh, 52, bh);
    // Neon windows
    c.fillStyle = i % 2 ? 'rgba(0,240,255,.5)' : 'rgba(255,44,92,.5)';
    for (let wy = 120 - bh + 10; wy < 110; wy += 18) {
      c.fillRect(bx + 8, wy, 12, 8);
      c.fillRect(bx + 32, wy, 12, 8);
    }
    c.fillStyle = '#06060c';
  }

  // "NIGHT CITY" sign
  c.save();
  c.fillStyle = '#ff2c5c';
  c.font = '900 34px Impact, "Arial Black", sans-serif';
  c.textAlign = 'center';
  c.shadowColor = '#ff2c5c'; c.shadowBlur = 20;
  c.fillText('NIGHT CITY', W/2, 60);
  c.shadowBlur = 0;
  c.fillStyle = '#00f0ff';
  c.font = '700 15px Impact, sans-serif';
  c.fillText('POP: 6.9M  ·  BUGS: ∞', W/2, 84);
  c.restore();
}

/* ── draw ── */
function draw() {
  drawBackground(ctx);

  // Warning shadows for incoming cars
  for (const wc of warnCars) {
    const pulse = 0.5 + Math.sin(t * 14) * 0.3;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff2c5c';
    ctx.beginPath();
    ctx.ellipse(wc.x, H - 120, 46, 70, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 30px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', wc.x, H - 110);
    ctx.restore();
  }

  // Eddies
  for (const e of eddies) drawEddie(ctx, e);

  // NPCs (T-pose)
  for (const n of npcs) drawTPoseNPC(ctx, n);

  // Cars
  for (const c of cars) drawCar(ctx, c);

  // V (player)
  drawV(ctx);

  // Glitch artifacts (RGB split bars)
  for (const gl of glitches) {
    const a = 1 - gl.t / gl.life;
    ctx.save();
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = R() < 0.5 ? '#00f0ff' : '#ff2c5c';
    ctx.fillRect(gl.x, gl.y, gl.w, gl.h);
    ctx.restore();
  }

  // Popups
  for (const pp of pops) {
    const a = 1 - pp.t / pp.life;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pp.col;
    ctx.font = '900 26px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pp.txt, pp.x, pp.y);
    ctx.restore();
  }

  // Johnny hologram message
  if (johnnyMsgT > 0) {
    const a = clamp(johnnyMsgT, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    // Hologram flicker
    if (Math.floor(t * 20) % 3 === 0) ctx.globalAlpha = a * 0.7;
    panel(ctx, 40, H - 320, W - 80, 86, { color: '#0a2a3a', alpha: 0.88, stroke: '#00f0ff' });
    ctx.fillStyle = '#00f0ff';
    ctx.font = '900 22px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    // Glitch text (RGB split)
    ctx.fillStyle = '#ff2c5c';
    ctx.fillText(johnnyMsg, W/2 - 2, H - 272);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(johnnyMsg, W/2 + 2, H - 272);
    ctx.fillStyle = '#fff';
    ctx.fillText(johnnyMsg, W/2, H - 272);
    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 13px Impact, sans-serif';
    ctx.fillText('— JOHNNY SILVERHAND (HOLOGRAM)', W/2, H - 248);
    ctx.restore();
  }
}

function hud() {
  // Top HUD: eddies, wanted, hearts
  pill(ctx, 14, 100, `€$ ${fmt(g.score)}`, { size: 24, color: '#fcee0a' });

  // Wanted stars
  ctx.save();
  ctx.fillStyle = '#ff2c5c';
  ctx.font = '900 26px Impact, sans-serif';
  ctx.textAlign = 'right';
  let stars = '';
  for (let i = 0; i < Math.min(wanted, 5); i++) stars += '★';
  ctx.fillText(stars, W - 16, 132);
  ctx.font = '700 13px Impact, sans-serif';
  ctx.fillStyle = '#ff8ca0';
  ctx.fillText('WANTED', W - 16, 152);
  ctx.restore();

  // Hearts
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 44, y = 170;
    ctx.save();
    ctx.fillStyle = i < p.hp ? '#ff2c5c' : 'rgba(255,255,255,.18)';
    ctx.beginPath();
    // Heart shape
    ctx.moveTo(x, y + 10);
    ctx.bezierCurveTo(x - 16, y - 4, x - 8, y - 16, x, y - 6);
    ctx.bezierCurveTo(x + 8, y - 16, x + 16, y - 4, x, y + 10);
    ctx.fill();
    ctx.restore();
  }

  // Distance
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.font = '700 15px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(dist)}m  ·  NIGHT CITY`, W/2, 120);
  ctx.restore();

  // Combo
  if (g.combo.n > 1) {
    pill(ctx, W/2 - 60, 190, `${g.combo.n}x COMBO`, { size: 22, color: '#00f0ff' });
  }
}

/* ── input: tap left/right half to switch lanes ── */
g.onTap = (x, y) => {
  if (gameOver) return;
  // Tap left/right side to move lanes
  const cur = p.lane;
  if (x < W / 2 && cur > 0) p.lane = cur - 1;
  else if (x >= W / 2 && cur < 3) p.lane = cur + 1;
  sfx('blip', { pitch: 1.2, vol: 0.25 });
};

g.run(update, draw, hud);

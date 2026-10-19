// CATFISHIN' — catfishin (Cat Arcade v2)
// Tap-timing fishing demo for viral video capture. Cast, wait for the tug,
// tap the strike ring, reel with rhythm, catalog your catch. 12 species,
// rarity fanfare, collection book. Built for spectate/auto filming.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, heartPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'catfishin', title: 'CATFISHIN\u2019', sub: 'TAP = CAST · TAP = STRIKE · TAP = REEL',
  hook: 'what\u2019s biting today?', w: W, h: H, bg: '#0b1030', style: 'toon',
  bloom: .7, ca: .35, vig: .9, scan: .15,
});

const Q = new URLSearchParams(location.search);
const isAuto = Q.has('auto') || Q.has('spectate');

/* ---------------------------------------------------------------- species */
const RAR = {
  common:    { pts: 10,  col: '#9fd8ff', glow: 0,  label: 'COMMON' },
  uncommon:  { pts: 25,  col: '#7dff9a', glow: 6,  label: 'UNCOMMON' },
  rare:      { pts: 60,  col: '#6db7ff', glow: 14, label: 'RARE' },
  epic:      { pts: 150, col: '#c07dff', glow: 22, label: 'EPIC' },
  legendary: { pts: 400, col: '#ffd94d', glow: 34, label: 'LEGENDARY' },
};
const FISH = [
  { name: 'Bluegill',      rar: 'common',    body: '#7fb3d5', belly: '#d6eaf8', size: 1.0 },
  { name: 'Sunny Perch',   rar: 'common',    body: '#f4d03f', belly: '#fef9e7', size: 0.9 },
  { name: 'Mud Catfish',   rar: 'common',    body: '#8d6e63', belly: '#d7ccc8', size: 1.2, whisk: 1 },
  { name: 'Largemouth Bass', rar: 'uncommon', body: '#58d68d', belly: '#d5f5e3', size: 1.4 },
  { name: 'Golden Koi',    rar: 'uncommon',  body: '#f5b041', belly: '#fdebd0', size: 1.1 },
  { name: 'Striped Pike',  rar: 'uncommon',  body: '#aed6f1', belly: '#eaf2f8', size: 1.5, stripe: 1 },
  { name: 'Moonfin Trout', rar: 'rare',      body: '#a9cce3', belly: '#eaf2f8', size: 1.3, glowfin: 1 },
  { name: 'Electric Eel',  rar: 'rare',      body: '#f9e79f', belly: '#fef9e7', size: 1.6, long: 1 },
  { name: 'Dragon Koi',    rar: 'epic',      body: '#e74c3c', belly: '#fadbd8', size: 1.4, fins: 1 },
  { name: 'Shadow Catfish',rar: 'epic',      body: '#5d6d7e', belly: '#aeb6bf', size: 1.7, whisk: 1 },
  { name: 'Aurora Salmon', rar: 'epic',      body: '#af7ac5', belly: '#f4ecf7', size: 1.3, glowfin: 1 },
  { name: 'Golden Whalefin', rar: 'legendary', body: '#f7dc6f', belly: '#fef9e7', size: 2.2, fins: 1 },
];
function rollFish(quality) {
  // quality: 2 = PERFECT, 1 = GOOD — shifts rarity upward
  const table = quality === 2
    ? [['legendary', .06], ['epic', .16], ['rare', .26], ['uncommon', .30], ['common', .22]]
    : [['legendary', .012], ['epic', .06], ['rare', .16], ['uncommon', .34], ['common', .428]];
  let r = R(), acc = 0, tier = 'common';
  for (const [t, p] of table) { acc += p; if (r <= acc) { tier = t; break; } }
  const pool = FISH.map((f, i) => ({ ...f, i })).filter(f => f.rar === tier);
  return pool[Math.floor(R() * pool.length)];
}

/* ---------------------------------------------------------------- state */
const POND_TOP = 400;
const DOCK_X = 150, DOCK_Y = 430;
let S;
const book = new Set();   // caught species indices

function resetWorld() {
  S = {
    phase: 'cast', t: 0,
    bob: null,            // {x,y,vx,vy,landed}
    waitT: 0, tugAt: 0,
    ring: 0, ringDir: 0, strikeT: 0, quality: 0,
    tension: 30, progress: 0, surgeT: 0, idleT: 0, fish: null,
    revealT: 0, revealFish: null, revealQ: 0, fx: 0,
    casts: 0, caught: 0,
    bookOpen: false,
    ripples: [], pads: [], reeds: [],
    botT: 0,
  };
  for (let i = 0; i < 7; i++) S.pads.push({ x: rnd(60, W - 60), y: rnd(POND_TOP + 60, H - 60), r: rnd(18, 34), ph: R() * 6 });
  for (let i = 0; i < 10; i++) S.reeds.push({ x: i < 5 ? rnd(10, 70) : rnd(W - 70, W - 10), y: rnd(POND_TOP - 10, POND_TOP + 40), h: rnd(30, 70), ph: R() * 6 });
  g.score = 0; g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => music('cozy');
resetWorld();

/* ---------------------------------------------------------------- actions */
function doCast() {
  const tx = rnd(200, W - 60), ty = rnd(POND_TOP + 80, H - 120);
  S.bob = { x: DOCK_X, y: DOCK_Y - 60, vx: (tx - DOCK_X) / 45, vy: -9, t: 0, tx, ty, landed: false };
  S.phase = 'flying'; S.t = 0;
  sfx('whoosh', { pitch: 1.2, vol: .4 });
}
function doStrike(q) {
  S.quality = q;
  S.fish = rollFish(q);
  S.phase = 'reel'; S.t = 0; S.tension = 35; S.progress = 0; S.surgeT = rnd(1, 2); S.idleT = 0;
  const label = q === 2 ? 'PERFECT!' : 'GOOD!';
  g.combo.hit(S.bob.x, S.bob.y - 40, label);
  sfx('pop', { pitch: q === 2 ? 1.3 : 1.0, vol: .6 });
  g.fx.burst(S.bob.x, S.bob.y, q === 2 ? 22 : 12, { kind: 'spark', color: '#bfe9ff', speed: 240 });
  if (q === 2) { g.punch(.08); }
}
function doCatch() {
  const f = S.fish, r = RAR[f.rar];
  S.revealFish = f; S.revealQ = S.quality; S.phase = 'reveal'; S.revealT = 0;
  S.caught++; S.casts++;
  const pts = Math.round(r.pts * g.combo.mult);
  g.score += pts; g.combo.hit(W / 2, H * .42, '+' + pts);
  book.add(f.i);
  // fanfare by rarity
  const cx = W / 2, cy = H * .4;
  if (f.rar === 'legendary') {
    g.impact(cx, cy, { punch: .3, shake: 26, flash: '#ffe27a', flashA: .75, stop: .22, sfx: 'win' });
    g.fx.burst(cx, cy, 90, { kind: 'debris', color: ['#ffd94d', '#fff', '#ff9ad5', '#7dff9a'], speed: 520, life: 1.4 });
    g.fx.burst(cx, cy, 40, { kind: 'spark', color: '#fff3b0', speed: 380, life: 1 });
  } else if (f.rar === 'epic') {
    g.impact(cx, cy, { punch: .2, shake: 16, flash: '#c07dff', flashA: .5, stop: .12, sfx: 'win' });
    g.fx.burst(cx, cy, 55, { kind: 'spark', color: ['#c07dff', '#fff', '#ffb3ff'], speed: 420, life: 1 });
  } else if (f.rar === 'rare') {
    g.impact(cx, cy, { punch: .12, shake: 8, flash: '#6db7ff', flashA: .35, sfx: 'chime' });
    g.fx.burst(cx, cy, 34, { kind: 'spark', color: ['#6db7ff', '#dff3ff'], speed: 340, life: .8 });
  } else {
    sfx('pop', { pitch: 1.1 + R() * .2, vol: .5 });
    g.fx.burst(cx, cy, 16, { kind: 'spark', color: '#bfe9ff', speed: 260, life: .5 });
  }
}
function doEscape(msg) {
  S.casts++;
  g.combo.hit(S.bob ? S.bob.x : W / 2, POND_TOP + 60, msg || 'ESCAPED!');
  sfx('lose', { pitch: .8, vol: .4 });
  S.phase = 'cast'; S.t = 0; S.bob = null;
}

/* ---------------------------------------------------------------- input */
function tap(x, y) {
  // book icon toggle (top-right)
  if (x > W - 84 && y < 84) { S.bookOpen = !S.bookOpen; sfx('click', { vol: .4 }); return; }
  if (S.bookOpen) { S.bookOpen = false; return; }
  if (g.mode !== 'play') return;
  if (S.phase === 'cast') doCast();
  else if (S.phase === 'strike') {
    const r = S.ring;
    if (r < 26) doStrike(2);
    else if (r < 58) doStrike(1);
    else doEscape('TOO EARLY!');
  }
  else if (S.phase === 'reel') {
    S.progress = Math.min(100, S.progress + 11);
    S.tension = Math.min(130, S.tension + 16);
    S.idleT = 0;
    sfx('click', { pitch: .9 + S.progress / 200, vol: .35 });
    if (S.bob) g.fx.burst(S.bob.x, S.bob.y, 3, { kind: 'spark', color: '#bfe9ff', speed: 120, life: .3 });
  }
  else if (S.phase === 'reveal' && S.revealT > .9) { S.phase = 'cast'; S.t = 0; S.bob = null; }
}

/* ---------------------------------------------------------------- bot */
function botThink(dt) {
  S.botT -= dt;
  if (S.botT > 0 || g.mode !== 'play' || S.bookOpen) return;
  if (S.phase === 'cast') { tap(W / 2, H / 2); S.botT = .3; }
  else if (S.phase === 'strike') { if (S.ring < 20) { tap(W / 2, H / 2); S.botT = .3; } }
  else if (S.phase === 'reel') {
    // keep tension 40-70: tap when low, rest when high
    if (S.tension < 52) { tap(W / 2, H / 2); S.botT = .28; }
    else S.botT = .1;
  }
  else if (S.phase === 'reveal' && S.revealT > 1.4) { tap(W / 2, H / 2); S.botT = .3; }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  S.t += dt;
  for (const p of S.pads) p.ph += dt;
  for (const r of S.reeds) r.ph += dt * 1.4;
  for (let i = S.ripples.length - 1; i >= 0; i--) {
    S.ripples[i].t += dt;
    if (S.ripples[i].t > 1.4) S.ripples.splice(i, 1);
  }

  if (isAuto) botThink(dt);
  else for (const p of g.taps) tap(p.x, p.y);

  const ph = S.phase;
  if (ph === 'flying' && S.bob) {
    const b = S.bob; b.t += dt;
    b.vy += 30 * dt; b.x += b.vx * dt * 60; b.y += b.vy * dt * 60;
    if (b.vy > 0 && b.y >= b.ty) {
      b.y = b.ty; b.landed = true;
      S.phase = 'wait'; S.t = 0;
      S.waitT = 0; S.tugAt = rnd(1.6, 4.2);
      S.ripples.push({ x: b.x, y: b.y, t: 0 });
      sfx('pop', { pitch: .7, vol: .5 });
    }
  }
  else if (ph === 'wait') {
    S.waitT += dt;
    if (S.bob && chance(dt * .5)) S.ripples.push({ x: S.bob.x + rnd(-8, 8), y: S.bob.y + rnd(-4, 4), t: 0 });
    if (S.waitT >= S.tugAt) {
      S.phase = 'strike'; S.t = 0; S.strikeT = 0; S.ring = 110; S.ringDir = -1;
      sfx('tick', { pitch: 1.4, vol: .6 });
      g.shake(4);
      if (S.bob) S.ripples.push({ x: S.bob.x, y: S.bob.y, t: 0 });
    }
  }
  else if (ph === 'strike') {
    S.strikeT += dt;
    S.ring += S.ringDir * 130 * dt;
    if (S.ring < 8) { S.ring = 8; S.ringDir = 1; }
    if (S.ring > 110) { S.ring = 110; S.ringDir = -1; }
    if (S.strikeT > 1.6) doEscape('TOO SLOW!');
  }
  else if (ph === 'reel') {
    S.tension = Math.max(0, S.tension - 26 * dt);
    S.idleT += dt;
    S.surgeT -= dt;
    if (S.surgeT <= 0) {
      S.surgeT = rnd(.8, 2.2);
      S.tension = Math.min(130, S.tension + rnd(18, 34));
      sfx('hit', { pitch: .7 + R() * .3, vol: .45 });
      g.shake(5);
      if (S.bob) g.fx.burst(S.bob.x, S.bob.y, 8, { kind: 'spark', color: '#fff', speed: 200, life: .4 });
    }
    if (S.bob) { S.bob.x += Math.sin(S.t * 22) * 30 * dt; S.bob.y += Math.cos(S.t * 17) * 12 * dt; }
    if (S.tension >= 100) { sfx('hit', { pitch: .5, vol: .6 }); doEscape('LINE SNAPPED!'); }
    else if (S.idleT > 3.2) doEscape('GOT AWAY!');
    else if (S.progress >= 100) doCatch();
  }
  else if (ph === 'reveal') {
    S.revealT += dt;
  }

  g.state = { score: g.score, caught: S.caught, book: book.size };
}

/* ---------------------------------------------------------------- drawing */
function drawFish(ctx, f, x, y, s, flip) {
  const r = RAR[f.rar];
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  if (r.glow) { ctx.shadowColor = r.col; ctx.shadowBlur = r.glow; }
  const L = f.long ? 1.7 : 1;
  // tail
  ctx.fillStyle = f.body;
  ctx.beginPath(); ctx.moveTo(-34 * L, 0); ctx.lineTo(-52 * L, -16); ctx.lineTo(-52 * L, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.stroke();
  // body
  ctx.beginPath(); ctx.ellipse(0, 0, 36 * L, 20, 0, 0, TAU); ctx.fillStyle = f.body; ctx.fill();
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.stroke();
  // belly
  ctx.beginPath(); ctx.ellipse(4, 8, 24 * L, 10, 0, 0, TAU); ctx.fillStyle = f.belly; ctx.fill();
  // stripes
  if (f.stripe) { ctx.strokeStyle = 'rgba(21,21,21,.5)'; ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 18 * L - 6, -16); ctx.lineTo(i * 18 * L + 2, 16); ctx.stroke(); } }
  // fins
  if (f.fins) { ctx.fillStyle = f.body; ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(10, -34); ctx.lineTo(20, -16); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (f.glowfin) { ctx.fillStyle = r.col; ctx.globalAlpha = .8 + .2 * Math.sin(g.t * 6); ctx.beginPath(); ctx.moveTo(6, -18); ctx.lineTo(16, -30); ctx.lineTo(24, -16); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  // whiskers
  if (f.whisk) { ctx.strokeStyle = '#151515'; ctx.lineWidth = 2; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(30, sy * 4); ctx.quadraticCurveTo(44, sy * 10, 52, sy * 4); ctx.stroke(); } }
  // eye
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -6, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(22, -6, 3, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function draw() {
  const ctx = g.ctx;

  /* dusk sky */
  const sky = ctx.createLinearGradient(0, 0, 0, POND_TOP);
  sky.addColorStop(0, '#1b1440'); sky.addColorStop(.45, '#4a2a6e');
  sky.addColorStop(.75, '#c65a7a'); sky.addColorStop(1, '#ff9a5c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, POND_TOP);
  // sun
  const sunG = ctx.createRadialGradient(W * .7, POND_TOP - 30, 6, W * .7, POND_TOP - 30, 130);
  sunG.addColorStop(0, 'rgba(255,236,180,1)'); sunG.addColorStop(.4, 'rgba(255,170,100,.8)'); sunG.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = sunG; ctx.beginPath(); ctx.arc(W * .7, POND_TOP - 30, 130, 0, TAU); ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255,200,170,.25)';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 190 + g.t * 6) % (W + 160)) - 80, cy = 60 + i * 46;
    ctx.beginPath(); ctx.ellipse(cx, cy, 62, 18, 0, 0, TAU); ctx.ellipse(cx + 34, cy + 6, 44, 14, 0, 0, TAU); ctx.fill();
  }
  // distant treeline
  ctx.fillStyle = '#241a3e';
  ctx.beginPath(); ctx.moveTo(0, POND_TOP);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, POND_TOP - 26 - 14 * Math.abs(Math.sin(x * .11 + 2)));
  ctx.lineTo(W, POND_TOP); ctx.closePath(); ctx.fill();

  /* pond */
  const wg = ctx.createLinearGradient(0, POND_TOP, 0, H);
  wg.addColorStop(0, '#2e7d9e'); wg.addColorStop(.4, '#1d5a7a'); wg.addColorStop(1, '#0e2f4a');
  ctx.fillStyle = wg; ctx.fillRect(0, POND_TOP, W, H - POND_TOP);
  // sun shimmer
  ctx.fillStyle = 'rgba(255,190,120,.16)';
  for (let i = 0; i < 12; i++) {
    const yy = POND_TOP + 20 + i * 44, wob = Math.sin(g.t * 1.6 + i * 2.2) * 14;
    ctx.fillRect(W * .7 - 60 + wob, yy, 120, 5);
  }
  // lily pads
  for (const p of S.pads) {
    const bob = Math.sin(p.ph) * 3;
    ctx.fillStyle = '#2e8b57';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, p.r, p.r * .62, 0, .3, TAU - .3); ctx.lineTo(p.x, p.y + bob); ctx.fill();
    ctx.strokeStyle = '#1c5c38'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff9ad5';
    ctx.beginPath(); ctx.arc(p.x + p.r * .3, p.y + bob - 6, 6, 0, TAU); ctx.fill();
  }
  // ripples
  for (const rp of S.ripples) {
    const k = rp.t / 1.4;
    ctx.strokeStyle = `rgba(220,245,255,${.55 * (1 - k)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 8 + k * 44, 4 + k * 20, 0, 0, TAU); ctx.stroke();
  }
  // reeds
  for (const rd of S.reeds) {
    const sw = Math.sin(rd.ph) * 6;
    ctx.strokeStyle = '#2f7d4f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rd.x, rd.y + 20); ctx.quadraticCurveTo(rd.x + sw, rd.y - rd.h / 2, rd.x + sw * 1.4, rd.y - rd.h); ctx.stroke();
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.ellipse(rd.x + sw * 1.4, rd.y - rd.h - 6, 5, 10, sw * .02, 0, TAU); ctx.fill();
  }

  /* dock */
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(0, DOCK_Y, DOCK_X + 30, 16);
  ctx.fillStyle = '#7d5a3a';
  for (let x = 8; x < DOCK_X + 30; x += 26) ctx.fillRect(x, DOCK_Y, 4, 16);
  ctx.fillStyle = '#54371f';
  ctx.fillRect(20, DOCK_Y + 16, 10, 40); ctx.fillRect(DOCK_X - 10, DOCK_Y + 16, 10, 40);

  /* cat fisher */
  const catBob = Math.sin(g.t * 2) * 2;
  ctx.save(); ctx.translate(DOCK_X - 6, DOCK_Y - 6 + catBob * .3);
  drawChar('cat', ctx, 0, 0, 74, { dir: 1, anim: 1, t: g.t, color: '#ffb347' });
  ctx.restore();
  // rod: from cat paw arcing up-right; line to bobber
  const rodBase = { x: DOCK_X + 18, y: DOCK_Y - 52 + catBob * .3 };
  const rodTip = { x: rodBase.x + 66, y: rodBase.y - 74 };
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rodBase.x, rodBase.y); ctx.quadraticCurveTo(rodBase.x + 40, rodBase.y - 50, rodTip.x, rodTip.y); ctx.stroke();
  if (S.bob && (S.phase === 'wait' || S.phase === 'strike' || S.phase === 'reel')) {
    const b = S.bob;
    ctx.strokeStyle = 'rgba(240,240,240,.75)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(rodTip.x, rodTip.y);
    ctx.quadraticCurveTo((rodTip.x + b.x) / 2, Math.min(rodTip.y, b.y) - 26, b.x, b.y - 8); ctx.stroke();
    // bobber
    const bb = Math.sin(g.t * 5) * (S.phase === 'strike' ? 5 : 2.5);
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(b.x, b.y - 8 + bb, 9, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y + bb, 9, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y + bb, 9, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#151515'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 17 + bb); ctx.lineTo(b.x, b.y - 24 + bb); ctx.stroke();
  }

  /* strike ring */
  if (S.phase === 'strike' && S.bob) {
    const b = S.bob, pulse = 1 + .12 * Math.sin(g.t * 14);
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 6; ctx.globalAlpha = .95;
    ctx.shadowColor = '#ffd94d'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(b.x, b.y - 8, S.ring * pulse, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // target zone
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(b.x, b.y - 8, 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (S.ring < 26) { g.text('NOW!', b.x, b.y - 64, { size: 30, color: '#ffd94d', align: 'center', stroke: 5 }); }
  }
  if (S.phase === 'wait' && S.waitT > .8) {
    g.text('wait for it\u2026', W / 2, POND_TOP + 44, { size: 24, color: 'rgba(255,255,255,.8)', align: 'center', stroke: 4 });
  }
  if (S.phase === 'strike') {
    g.text('TAP!', W / 2, POND_TOP + 44, { size: 40, color: '#ffd94d', align: 'center', stroke: 6 });
  }

  /* reel: tension meter + fish */
  if (S.phase === 'reel' && S.bob) {
    const b = S.bob;
    // tension bar
    const bw = 300, bx = (W - bw) / 2, by = POND_TOP + 66;
    rr(ctx, bx - 4, by - 4, bw + 8, 30, 10); ctx.fillStyle = 'rgba(10,14,30,.72)'; ctx.fill();
    const tw = bw * clamp(S.tension / 100, 0, 1);
    const tc = S.tension > 80 ? '#ff3b30' : S.tension > 55 ? '#ffb340' : '#7dff9a';
    rr(ctx, bx, by, tw, 22, 8); ctx.fillStyle = tc; ctx.fill();
    // safe zone marker
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(bx + bw * .4, by - 4, bw * .3, 30);
    g.text('TENSION', W / 2, by - 14, { size: 18, color: '#fff', align: 'center' });
    // progress
    const pw = bw * (S.progress / 100);
    rr(ctx, bx, by + 34, bw, 12, 6); ctx.fillStyle = 'rgba(10,14,30,.72)'; ctx.fill();
    rr(ctx, bx, by + 34, pw, 12, 6); ctx.fillStyle = '#6db7ff'; ctx.fill();
    // struggling fish shadow under bobber
    const f = S.fish, r = RAR[f.rar];
    ctx.globalAlpha = .85;
    drawFish(ctx, f, b.x + Math.sin(S.t * 22) * 10, b.y + 26, .55 * f.size, false);
    ctx.globalAlpha = 1;
    if (S.tension > 80) g.text('EASY!!', W / 2, by + 78, { size: 26, color: '#ff3b30', align: 'center', stroke: 5 });
    else g.text('tap to reel!', W / 2, by + 78, { size: 22, color: 'rgba(255,255,255,.85)', align: 'center', stroke: 4 });
  }

  /* reveal */
  if (S.phase === 'reveal' && S.revealFish) {
    const f = S.revealFish, r = RAR[f.rar], k = Math.min(1, S.revealT * 2.2);
    const fy = lerp(H * .75, H * .36, k), fx = W / 2 + Math.sin(k * 5) * 30 * (1 - k);
    const rot = (1 - k) * -0.9;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(rot);
    drawFish(ctx, f, 0, 0, (0.6 + 0.9 * k) * f.size, false);
    ctx.restore();
    if (k >= 1) {
      // rarity banner
      const bw2 = 420, bx2 = (W - bw2) / 2, by2 = H * .2;
      const pop = 1 + .18 * Math.sin(Math.min(1, (S.revealT - .45) * 6) * Math.PI);
      ctx.save(); ctx.translate(W / 2, by2 + 40); ctx.scale(pop, pop); ctx.translate(-W / 2, -(by2 + 40));
      rr(ctx, bx2, by2, bw2, 96, 20);
      ctx.fillStyle = f.rar === 'common' ? 'rgba(30,50,80,.92)' : f.rar === 'uncommon' ? 'rgba(24,70,44,.92)' : f.rar === 'rare' ? 'rgba(20,50,100,.94)' : f.rar === 'epic' ? 'rgba(60,24,96,.94)' : 'rgba(96,70,10,.95)';
      ctx.fill();
      ctx.strokeStyle = r.col; ctx.lineWidth = 4; ctx.stroke();
      g.text(r.label + '!', W / 2, by2 + 38, { size: 40, color: r.col, align: 'center', stroke: 6 });
      g.text(f.name, W / 2, by2 + 74, { size: 26, color: '#fff', align: 'center' });
      ctx.restore();
      if (S.revealT > .9) g.text('tap to cast again', W / 2, H * .82, { size: 22, color: 'rgba(255,255,255,.85)', align: 'center', stroke: 4 });
    }
  }

  /* title overlay */
  if (g.mode === 'title') {
    ctx.fillStyle = 'rgba(8,10,28,.45)'; ctx.fillRect(0, 0, W, H);
    g.text('CATFISHIN\u2019', W / 2, H * .3, { size: 64, color: '#ffd94d', align: 'center', stroke: 8 });
    g.text('tap to cast \u00b7 time the strike \u00b7 reel with rhythm', W / 2, H * .36, { size: 21, color: '#fff', align: 'center' });
    g.text('TAP TO START', W / 2, H * .62, { size: 34, color: '#fff', align: 'center', stroke: 5 });
    drawFish(ctx, FISH[11], W / 2, H * .48, 1.1, false);
  }
  if (g.mode === 'play' && S.phase === 'cast' && !S.bookOpen) {
    g.text('TAP TO CAST', W / 2, H * .62, { size: 34, color: '#fff', align: 'center', stroke: 5 });
  }

  /* collection book overlay */
  if (S.bookOpen) drawBook(ctx);
}

function drawBook(ctx) {
  ctx.fillStyle = 'rgba(6,8,22,.88)'; ctx.fillRect(0, 0, W, H);
  g.text('COLLECTION', W / 2, 84, { size: 38, color: '#ffd94d', align: 'center', stroke: 5 });
  g.text(book.size + ' / 12 caught', W / 2, 118, { size: 22, color: '#fff', align: 'center' });
  const cols = 3, cw = 150, chh = 150, ox = (W - cols * cw) / 2 + cw / 2, oy = 210;
  FISH.forEach((f, i) => {
    const cx = ox + (i % cols) * cw, cy = oy + Math.floor(i / cols) * chh;
    const got = book.has(i), r = RAR[f.rar];
    rr(ctx, cx - 68, cy - 66, 136, 132, 14);
    ctx.fillStyle = got ? 'rgba(30,40,70,.9)' : 'rgba(16,20,38,.9)'; ctx.fill();
    ctx.strokeStyle = got ? r.col : 'rgba(120,130,160,.5)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (got) {
      drawFish(ctx, f, cx, cy - 12, .62 * f.size, false);
      g.text(f.name, cx, cy + 34, { size: 15, color: '#fff', align: 'center' });
      g.text(r.label, cx, cy + 54, { size: 13, color: r.col, align: 'center' });
    } else {
      ctx.save(); ctx.globalAlpha = .35;
      drawFish(ctx, { ...f, body: '#3a4560', belly: '#2a3350' }, cx, cy - 12, .62 * f.size, false);
      ctx.restore();
      g.text('???', cx, cy + 40, { size: 18, color: 'rgba(160,170,200,.8)', align: 'center' });
    }
  });
  g.text('tap to close', W / 2, H - 60, { size: 20, color: 'rgba(255,255,255,.7)', align: 'center' });
}

/* ---------------------------------------------------------------- hud */
function hud() {
  const ctx = g.ctx;
  // score panel
  rr(ctx, 12, 12, 190, 64, 12); ctx.fillStyle = 'rgba(8,12,28,.62)'; ctx.fill();
  g.text(String(g.score), 30, 40, { size: 30, color: '#ffd94d', align: 'left', stroke: 4 });
  g.text('SCORE', 30, 62, { size: 14, color: 'rgba(255,255,255,.75)', align: 'left' });
  g.text('\uD83C\uDFA3 ' + S.caught, 150, 46, { size: 24, color: '#fff', align: 'left', stroke: 3 });
  // book button
  const bx = W - 72, by = 44;
  rr(ctx, bx - 30, by - 30, 60, 60, 14); ctx.fillStyle = S.bookOpen ? 'rgba(255,217,77,.35)' : 'rgba(8,12,28,.62)'; ctx.fill();
  ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2.5;
  rr(ctx, bx - 16, by - 20, 32, 40, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx - 16, by - 8); ctx.lineTo(bx + 16, by - 8); ctx.stroke();
  g.text(book.size + '/12', bx, by + 44, { size: 14, color: '#ffd94d', align: 'center' });
  // combo is drawn by engine
}

g.run(update, draw, hud);
window.__g = g;
window.__dbg = () => ({ phase: S.phase, score: g.score, caught: S.caught, book: book.size, tension: Math.round(S.tension), progress: Math.round(S.progress) });

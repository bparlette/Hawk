// CATFISHIN' — HAUNTED POND (Cat Arcade v2)
// Halloween visual showcase edition. Same mechanics as catfishin, fully
// reskinned: haunted midnight pond, witch-hat cat, spooky fish species,
// maximum gp2x post-FX and particle polish. Built for viral video capture.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, rr, heartPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'catfishin-halloween', title: 'HAUNTED POND', sub: 'TAP = CAST · TAP = STRIKE · TAP = REEL',
  hook: 'what\u2019s biting on halloween night?', w: W, h: H, bg: '#070a1c', style: 'toon',
  bloom: .95, ca: .5, vig: 1.0, scan: .12, grain: .06,
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
  { name: 'Ghost Guppy',   rar: 'common',    body: '#cdd8ea', belly: '#f4f7fd', size: 1.0, ghost: 1 },
  { name: 'Candy Cornfish',rar: 'common',    body: '#f5a623', belly: '#fff3d6', size: 0.9, candy: 1 },
  { name: 'Mud Ghoul',     rar: 'common',    body: '#6e5a4e', belly: '#b8a89c', size: 1.2, whisk: 1 },
  { name: 'Pumpkin Prowler', rar: 'uncommon', body: '#e07b1f', belly: '#f9d9a8', size: 1.4, pumpkin: 1 },
  { name: 'Swamp Witch',   rar: 'uncommon',  body: '#4f9e5d', belly: '#cfe8cf', size: 1.1, fins: 1 },
  { name: 'Bone Pike',     rar: 'uncommon',  body: '#d9d4c5', belly: '#f5f2e8', size: 1.5, stripe: 1, bones: 1 },
  { name: 'Moonbat Ray',   rar: 'rare',      body: '#4a5a9e', belly: '#c3cbe8', size: 1.3, glowfin: 1 },
  { name: 'Volt Vampire',  rar: 'rare',      body: '#8e2f3c', belly: '#e8b4b8', size: 1.6, long: 1, fangs: 1 },
  { name: 'Dragon Imp',    rar: 'epic',      body: '#c0392b', belly: '#f0b8a8', size: 1.4, fins: 1, fangs: 1 },
  { name: 'Skeleton Catfish', rar: 'epic',   body: '#9aa0a8', belly: '#dfe2e6', size: 1.7, whisk: 1, bones: 1 },
  { name: 'Spectral Salmon', rar: 'epic',    body: '#7d4f9e', belly: '#d9c8ea', size: 1.3, glowfin: 1, ghost: 1 },
  { name: 'Golden Reaper', rar: 'legendary', body: '#e8b81f', belly: '#fdf3c8', size: 2.2, fins: 1, fangs: 1 },
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
const MOON_X = W * .72, MOON_Y = 148, MOON_R = 62;
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
    stars: [], eyes: [], bats: [],
    mistT: 0, wispT: 0, leafT: 0, batT: 3, pumpkinT: 0,
  };
  for (let i = 0; i < 7; i++) S.pads.push({ x: rnd(60, W - 60), y: rnd(POND_TOP + 60, H - 60), r: rnd(18, 34), ph: R() * 6 });
  for (let i = 0; i < 10; i++) S.reeds.push({ x: i < 5 ? rnd(10, 70) : rnd(W - 70, W - 10), y: rnd(POND_TOP - 10, POND_TOP + 40), h: rnd(30, 70), ph: R() * 6 });
  for (let i = 0; i < 90; i++) S.stars.push({ x: rnd(0, W), y: rnd(0, POND_TOP - 90), r: rnd(.6, 2.2), ph: R() * 6, sp: rnd(.5, 2) });
  for (let i = 0; i < 9; i++) S.eyes.push({ x: rnd(20, W - 20), y: rnd(POND_TOP - 66, POND_TOP - 14), blink: R() * 4, ph: R() * 6 });
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
  endTripOrNextCast();
}

/* A demo trip is short so the round can resolve (harness + video contract). */
const TRIP_CASTS = 3;
function endTripOrNextCast() {
  if (S.casts >= TRIP_CASTS) {
    const win = S.caught > 0;
    g.impact(W / 2, H * .4, { punch: .3, shake: 16, flash: win ? '#ffe27a' : '#8fd3ff', flashA: .5, stop: .2, sfx: win ? 'win' : 'lose' });
    g.popup(win ? 'TRIP COMPLETE!' : 'SKUNKED!', W / 2, H * .34, win ? '#ffd94d' : '#8fd3ff', 40);
    g.fx.burst(W / 2, H * .4, win ? 60 : 24, { kind: 'spark', color: win ? ['#ffd94d', '#fff', '#bfe9ff'] : '#8fd3ff', speed: 420, life: 1 });
    g.end({ win, score: Math.round(g.score), label: 'SCORE', progress: Math.min(100, Math.round(S.caught / TRIP_CASTS * 100)) });
    return;
  }
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
  else if (S.phase === 'reveal' && S.revealT > .9) { endTripOrNextCast(); }
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
  else if (S.phase === 'wait') { 
    // Safety: if wait exceeds tugAt by 2s, force strike (auto-transition may have failed)
    if (S.waitT > (S.tugAt || 4) + 2) { S.phase = 'strike'; S.t = 0; S.strikeT = 0; S.ring = 110; S.ringDir = -1; }
    S.botT = .3; 
  }
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
  /* ---- ambient halloween atmosphere (visual only, no gameplay effect) ---- */
  for (const e of S.eyes) e.blink += dt;
  S.mistT -= dt;
  if (S.mistT <= 0) { S.mistT = rnd(.5, 1.4); g.fx.emit('smoke', rnd(-20, W + 20), rnd(POND_TOP + 10, H - 40), { vx: rnd(8, 26), vy: rnd(-6, 2), g: 0, life: rnd(2.2, 4), size: rnd(30, 60), color: 'rgba(150,170,220,.10)', drag: .2 }); }
  S.wispT -= dt;
  if (S.wispT <= 0) { S.wispT = rnd(.8, 2); const wx = rnd(30, W - 30), wy = rnd(POND_TOP - 120, POND_TOP + 120); g.fx.trailDot(wx, wy, { life: rnd(1, 2), size: rnd(10, 20), color: chance(.5) ? '#7dffc8' : '#9fd8ff' }); }
  S.leafT -= dt;
  if (S.leafT <= 0) { S.leafT = rnd(1.5, 3.5); g.fx.emit('feather', rnd(0, W), -10, { vx: rnd(-24, 24), vy: rnd(26, 50), g: 6, life: rnd(3, 5), size: rnd(5, 9), color: chance(.5) ? '#8a4a1f' : '#a8642a', vr: rnd(-3, 3), drag: .3 }); }
  S.batT -= dt;
  if (S.batT <= 0) { S.batT = rnd(5, 11); S.bats.push({ x: -40, y: rnd(60, 240), vx: rnd(120, 200), ph: R() * 6, s: rnd(.7, 1.2) }); }
  for (let i = S.bats.length - 1; i >= 0; i--) {
    const b = S.bats[i]; b.x += b.vx * dt; b.ph += dt * 14;
    if (b.x > W + 50) S.bats.splice(i, 1);
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
  if (f.ghost) ctx.globalAlpha *= .82;
  if (r.glow) { ctx.shadowColor = r.col; ctx.shadowBlur = r.glow; }
  const L = f.long ? 1.7 : 1;
  // ghost wisps trailing behind
  if (f.ghost) {
    ctx.strokeStyle = 'rgba(220,235,255,.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const wy = Math.sin(g.t * 5 + i * 2) * 6;
      ctx.beginPath(); ctx.moveTo(-40 * L, -8 + i * 8); ctx.quadraticCurveTo(-58 * L, wy - 8 + i * 8, -70 * L, wy + i * 8); ctx.stroke();
    }
  }
  // tail
  ctx.fillStyle = f.body;
  ctx.beginPath(); ctx.moveTo(-34 * L, 0); ctx.lineTo(-52 * L, -16); ctx.lineTo(-52 * L, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#101018'; ctx.lineWidth = 3; ctx.stroke();
  // body
  ctx.beginPath(); ctx.ellipse(0, 0, 36 * L, 20, 0, 0, TAU); ctx.fillStyle = f.body; ctx.fill();
  ctx.strokeStyle = '#101018'; ctx.lineWidth = 3; ctx.stroke();
  // belly
  ctx.beginPath(); ctx.ellipse(4, 8, 24 * L, 10, 0, 0, TAU); ctx.fillStyle = f.belly; ctx.fill();
  // candy cornfish stripes (orange / white / yellow bands)
  if (f.candy) {
    const bands = ['#f5a623', '#fdf3e0', '#f7dc6f'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = bands[i]; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(-14 + i * 14, 0, 8, 18 - Math.abs(i - 1) * 3, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // stripes
  if (f.stripe) { ctx.strokeStyle = 'rgba(16,16,24,.55)'; ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 18 * L - 6, -16); ctx.lineTo(i * 18 * L + 2, 16); ctx.stroke(); } }
  // pumpkin ridges
  if (f.pumpkin) { ctx.strokeStyle = 'rgba(120,52,8,.6)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(i * 12, 0, 8, 18, 0, 0, TAU); ctx.stroke(); } }
  // exposed rib bones
  if (f.bones) {
    ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 12, -14); ctx.lineTo(i * 12 + 4, 12); ctx.stroke(); }
  }
  // fins
  if (f.fins) { ctx.fillStyle = f.body; ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(10, -34); ctx.lineTo(20, -16); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (f.glowfin) { ctx.fillStyle = r.col; ctx.globalAlpha = .8 + .2 * Math.sin(g.t * 6); ctx.beginPath(); ctx.moveTo(6, -18); ctx.lineTo(16, -30); ctx.lineTo(24, -16); ctx.closePath(); ctx.fill(); ctx.globalAlpha = f.ghost ? .82 : 1; }
  // whiskers
  if (f.whisk) { ctx.strokeStyle = '#101018'; ctx.lineWidth = 2; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(30, sy * 4); ctx.quadraticCurveTo(44, sy * 10, 52, sy * 4); ctx.stroke(); } }
  // spooky eye: glowing red for vampire/dragon, hollow for skeleton
  if (f.fangs) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -6, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(22, -6, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(30, 8); ctx.lineTo(34, 16); ctx.lineTo(38, 8); ctx.closePath(); ctx.fill();
  } else if (f.bones) {
    ctx.fillStyle = '#101018'; ctx.beginPath(); ctx.arc(20, -6, 5.5, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -6, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101018'; ctx.beginPath(); ctx.arc(22, -6, 3, 0, TAU); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* witch hat drawn over the cat fisher's head */
function drawWitchHat(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-.12);
  // brim
  ctx.fillStyle = '#2a1a3e';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#151020'; ctx.lineWidth = 2.5; ctx.stroke();
  // cone
  const hg = ctx.createLinearGradient(0, -52, 0, 0);
  hg.addColorStop(0, '#3d2560'); hg.addColorStop(1, '#241538');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(-24, -2); ctx.quadraticCurveTo(-8, -30, 6, -52); ctx.quadraticCurveTo(16, -44, 12, -30); ctx.quadraticCurveTo(22, -14, 24, -2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#151020'; ctx.lineWidth = 2.5; ctx.stroke();
  // gold band + buckle
  ctx.fillStyle = '#e8a020'; ctx.fillRect(-23, -16, 46, 7);
  ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2; ctx.strokeRect(-6, -18, 12, 11);
  // bent tip
  ctx.fillStyle = '#3d2560';
  ctx.beginPath(); ctx.arc(10, -52, 6, 0, TAU); ctx.fill();
  ctx.restore();
}

/* glowing skull bobber */
function drawSkullBobber(ctx, x, y, bob, phase) {
  ctx.save(); ctx.translate(x, y + bob);
  ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = 26;
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath(); ctx.arc(0, -4, 11, 0, TAU); ctx.fill();
  ctx.fillRect(-7, 2, 14, 8);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4, 11, 0, TAU); ctx.stroke();
  // eye sockets glow eerie green
  const flick = .7 + .3 * Math.sin(g.t * 9);
  ctx.fillStyle = `rgba(125,255,154,${flick})`;
  ctx.beginPath(); ctx.arc(-4.5, -5, 3.4, 0, TAU); ctx.arc(4.5, -5, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#151515';
  ctx.beginPath(); ctx.moveTo(-1.5, 8); ctx.lineTo(1.5, 8); ctx.stroke();
  ctx.restore();
}

/* bat silhouette */
function drawBat(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s, b.s);
  const flap = Math.sin(b.ph) * .7;
  ctx.fillStyle = '#0d0d16';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-14, -10 - flap * 12, -26, -2 - flap * 8);
  ctx.quadraticCurveTo(-14, -2, -10, 4);
  ctx.quadraticCurveTo(-4, -2, 0, 0);
  ctx.quadraticCurveTo(4, -2, 10, 4);
  ctx.quadraticCurveTo(14, -2, 26, -2 - flap * 8);
  ctx.quadraticCurveTo(14, -10 - flap * 12, 0, 0);
  ctx.fill();
  ctx.restore();
}

function draw() {
  const ctx = g.ctx;

  /* haunted night sky */
  const sky = ctx.createLinearGradient(0, 0, 0, POND_TOP);
  sky.addColorStop(0, '#04060f'); sky.addColorStop(.5, '#0b1030');
  sky.addColorStop(.8, '#1a1440'); sky.addColorStop(1, '#2a1a3e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, POND_TOP);
  // twinkling stars
  for (const st of S.stars) {
    const tw = .35 + .65 * Math.abs(Math.sin(g.t * st.sp + st.ph));
    ctx.fillStyle = `rgba(235,242,255,${tw * .9})`;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill();
  }
  // full moon + halo (bloom picks this up)
  const moonHalo = ctx.createRadialGradient(MOON_X, MOON_Y, MOON_R * .4, MOON_X, MOON_Y, MOON_R * 3.2);
  moonHalo.addColorStop(0, 'rgba(220,232,255,.5)'); moonHalo.addColorStop(.45, 'rgba(170,190,255,.16)'); moonHalo.addColorStop(1, 'rgba(150,170,255,0)');
  ctx.fillStyle = moonHalo; ctx.beginPath(); ctx.arc(MOON_X, MOON_Y, MOON_R * 3.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8eefc';
  ctx.beginPath(); ctx.arc(MOON_X, MOON_Y, MOON_R, 0, TAU); ctx.fill();
  // craters
  ctx.fillStyle = 'rgba(170,185,220,.55)';
  ctx.beginPath(); ctx.arc(MOON_X - 18, MOON_Y - 12, 11, 0, TAU); ctx.arc(MOON_X + 14, MOON_Y + 8, 8, 0, TAU); ctx.arc(MOON_X + 2, MOON_Y - 26, 6, 0, TAU); ctx.fill();
  // drifting clouds crossing the moon (two parallax layers)
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 230 + g.t * (i % 2 ? 9 : 5)) % (W + 220)) - 110, cy = 50 + i * 44;
    const dim = i % 2 ? .34 : .22;
    ctx.fillStyle = `rgba(40,46,80,${dim})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, 78, 16, 0, 0, TAU); ctx.ellipse(cx + 44, cy + 7, 56, 12, 0, 0, TAU); ctx.fill();
  }
  // bats crossing the moon
  for (const b of S.bats) drawBat(ctx, b);
  // dead treeline silhouette with hanging moss
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath(); ctx.moveTo(0, POND_TOP);
  for (let x = 0; x <= W; x += 18) {
    const jag = 30 + 34 * Math.abs(Math.sin(x * .23 + 1.7)) + 12 * Math.abs(Math.sin(x * .71));
    ctx.lineTo(x, POND_TOP - jag);
  }
  ctx.lineTo(W, POND_TOP); ctx.closePath(); ctx.fill();
  // bare branch spikes
  ctx.strokeStyle = '#0a0a14'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let x = 30; x < W; x += 90) {
    const bh = 60 + 30 * Math.abs(Math.sin(x * .5));
    ctx.beginPath(); ctx.moveTo(x, POND_TOP - 30); ctx.lineTo(x + 8, POND_TOP - bh); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x + 4, POND_TOP - bh * .7); ctx.lineTo(x - 14, POND_TOP - bh * .9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 6, POND_TOP - bh * .6); ctx.lineTo(x + 24, POND_TOP - bh * .82); ctx.stroke();
    ctx.lineWidth = 4;
  }
  // glowing eyes blinking in the dark treeline
  for (const e of S.eyes) {
    const cyc = (e.blink % 4);
    const open = cyc < 3.4 ? 1 : Math.max(0, 1 - (cyc - 3.4) / .15) * (cyc > 3.55 ? (cyc - 3.55) / .15 : 1);
    if (open <= 0) continue;
    const flick = .6 + .4 * Math.sin(g.t * 7 + e.ph);
    ctx.fillStyle = `rgba(255,60,40,${open * flick})`;
    ctx.shadowColor = '#ff3c28'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(e.x - 6, e.y, 3.2, 0, TAU); ctx.arc(e.x + 6, e.y, 3.2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* haunted pond */
  const wg = ctx.createLinearGradient(0, POND_TOP, 0, H);
  wg.addColorStop(0, '#0d1b2e'); wg.addColorStop(.35, '#0a1424'); wg.addColorStop(1, '#050a16');
  ctx.fillStyle = wg; ctx.fillRect(0, POND_TOP, W, H - POND_TOP);
  // moon reflection shimmer path
  for (let i = 0; i < 14; i++) {
    const yy = POND_TOP + 14 + i * 40, wob = Math.sin(g.t * 1.8 + i * 2.4) * 18;
    const wdt = 90 - i * 3.5;
    const al = .22 * (1 - i / 16) * (.7 + .3 * Math.sin(g.t * 3 + i * 1.7));
    ctx.fillStyle = `rgba(200,220,255,${al})`;
    ctx.fillRect(MOON_X - wdt / 2 + wob, yy, wdt, 4);
  }
  // dead lily pads (dark, tattered)
  for (const p of S.pads) {
    const bob = Math.sin(p.ph) * 3;
    ctx.fillStyle = '#2a3320';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, p.r, p.r * .62, 0, .3, TAU - .3); ctx.lineTo(p.x, p.y + bob); ctx.fill();
    ctx.strokeStyle = '#161b10'; ctx.lineWidth = 2; ctx.stroke();
    // withered flower -> tiny skull flower
    ctx.fillStyle = '#cfc4a8';
    ctx.beginPath(); ctx.arc(p.x + p.r * .3, p.y + bob - 6, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101018';
    ctx.beginPath(); ctx.arc(p.x + p.r * .3 - 2, p.y + bob - 7, 1.4, 0, TAU); ctx.arc(p.x + p.r * .3 + 2, p.y + bob - 7, 1.4, 0, TAU); ctx.fill();
  }
  // ripples (moonlit)
  for (const rp of S.ripples) {
    const k = rp.t / 1.4;
    ctx.strokeStyle = `rgba(190,215,255,${.5 * (1 - k)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 8 + k * 44, 4 + k * 20, 0, 0, TAU); ctx.stroke();
  }
  // dead reeds (grey, brittle)
  for (const rd of S.reeds) {
    const sw = Math.sin(rd.ph) * 6;
    ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rd.x, rd.y + 20); ctx.quadraticCurveTo(rd.x + sw, rd.y - rd.h / 2, rd.x + sw * 1.4, rd.y - rd.h); ctx.stroke();
    ctx.fillStyle = '#3a3a42';
    ctx.beginPath(); ctx.ellipse(rd.x + sw * 1.4, rd.y - rd.h - 6, 4, 9, sw * .02, 0, TAU); ctx.fill();
  }
  // bioluminescent glow where the bobber sits
  if (S.bob && (S.phase === 'wait' || S.phase === 'strike' || S.phase === 'reel')) {
    const bglow = ctx.createRadialGradient(S.bob.x, S.bob.y, 2, S.bob.x, S.bob.y, 60);
    const pulse = .5 + .2 * Math.sin(g.t * 5);
    bglow.addColorStop(0, `rgba(125,255,154,${.28 * pulse + .1})`); bglow.addColorStop(1, 'rgba(125,255,154,0)');
    ctx.fillStyle = bglow; ctx.beginPath(); ctx.arc(S.bob.x, S.bob.y, 60, 0, TAU); ctx.fill();
  }

  /* dock (weathered, moonlit) */
  // long moonlight shadows stretching down-left (moon is up-right)
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(DOCK_X - 60, DOCK_Y + 52, 120, 14, -.12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3d2c1c';
  ctx.fillRect(0, DOCK_Y, DOCK_X + 30, 16);
  ctx.fillStyle = '#4a3623';
  for (let x = 8; x < DOCK_X + 30; x += 26) ctx.fillRect(x, DOCK_Y, 4, 16);
  ctx.fillStyle = '#2c1f14';
  ctx.fillRect(20, DOCK_Y + 16, 10, 40); ctx.fillRect(DOCK_X - 10, DOCK_Y + 16, 10, 40);
  // moonlight rim on dock edge
  ctx.fillStyle = 'rgba(200,220,255,.18)'; ctx.fillRect(0, DOCK_Y, DOCK_X + 30, 3);

  /* jack-o'-lantern on the dock (flickering) */
  const pflick = .75 + .25 * Math.sin(g.t * 11) * Math.sin(g.t * 5.3);
  const pg = ctx.createRadialGradient(44, DOCK_Y - 16, 4, 44, DOCK_Y - 16, 70);
  pg.addColorStop(0, `rgba(255,140,30,${.5 * pflick})`); pg.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(44, DOCK_Y - 16, 70, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c46a1a';
  ctx.beginPath(); ctx.ellipse(44, DOCK_Y - 14, 20, 16, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a3f0e'; ctx.lineWidth = 2.5;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(44 + i * 9, DOCK_Y - 14, 5, 15, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#3a5a2a'; ctx.fillRect(41, DOCK_Y - 36, 6, 10);
  // carved face (glowing)
  ctx.fillStyle = `rgba(255,190,60,${.9 * pflick})`;
  ctx.shadowColor = '#ff9a20'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(32, DOCK_Y - 22); ctx.lineTo(38, DOCK_Y - 14); ctx.lineTo(32, DOCK_Y - 10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(56, DOCK_Y - 22); ctx.lineTo(50, DOCK_Y - 14); ctx.lineTo(56, DOCK_Y - 10); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(34, DOCK_Y - 4); ctx.lineTo(40, DOCK_Y - 8); ctx.lineTo(46, DOCK_Y - 4); ctx.lineTo(52, DOCK_Y - 8); ctx.lineTo(54, DOCK_Y - 2); ctx.lineTo(34, DOCK_Y - 2); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  /* cat fisher in witch hat */
  const catBob = Math.sin(g.t * 2) * 2;
  // cat's own long shadow
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath(); ctx.ellipse(DOCK_X - 40, DOCK_Y + 2, 44, 8, -.1, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(DOCK_X - 6, DOCK_Y - 6 + catBob * .3);
  drawChar('cat', ctx, 0, 0, 74, { dir: 1, anim: 1, t: g.t, color: '#2b2b38' });
  drawWitchHat(ctx, 4, -58, 1);
  ctx.restore();
  // gnarled rod: from cat paw arcing up-right; line to bobber
  const rodBase = { x: DOCK_X + 18, y: DOCK_Y - 52 + catBob * .3 };
  const rodTip = { x: rodBase.x + 66, y: rodBase.y - 74 };
  ctx.strokeStyle = '#2e1f14'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rodBase.x, rodBase.y);
  ctx.quadraticCurveTo(rodBase.x + 30, rodBase.y - 62, rodBase.x + 52, rodBase.y - 58);
  ctx.quadraticCurveTo(rodBase.x + 62, rodBase.y - 66, rodTip.x, rodTip.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,220,255,.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rodBase.x, rodBase.y - 3); ctx.quadraticCurveTo(rodBase.x + 40, rodBase.y - 56, rodTip.x - 4, rodTip.y + 2); ctx.stroke();
  if (S.bob && (S.phase === 'wait' || S.phase === 'strike' || S.phase === 'reel')) {
    const b = S.bob;
    ctx.strokeStyle = 'rgba(220,230,255,.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(rodTip.x, rodTip.y);
    ctx.quadraticCurveTo((rodTip.x + b.x) / 2, Math.min(rodTip.y, b.y) - 26, b.x, b.y - 8); ctx.stroke();
    // glowing skull bobber
    const bb = Math.sin(g.t * 5) * (S.phase === 'strike' ? 5 : 2.5);
    drawSkullBobber(ctx, b.x, b.y - 8, bb, S.phase);
  }

  /* strike ring — eerie green */
  if (S.phase === 'strike' && S.bob) {
    const b = S.bob, pulse = 1 + .12 * Math.sin(g.t * 14);
    ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 6; ctx.globalAlpha = .95;
    ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = 26;
    ctx.beginPath(); ctx.arc(b.x, b.y - 8, S.ring * pulse, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // target zone
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(b.x, b.y - 8, 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (S.ring < 26) { g.text('NOW!', b.x, b.y - 64, { size: 30, color: '#7dff9a', align: 'center', stroke: 5 }); }
  }
  if (S.phase === 'wait' && S.waitT > .8) {
    g.text('wait for it\u2026', W / 2, POND_TOP + 44, { size: 24, color: 'rgba(220,230,255,.8)', align: 'center', stroke: 4 });
  }
  if (S.phase === 'strike') {
    g.text('TAP!', W / 2, POND_TOP + 44, { size: 40, color: '#7dff9a', align: 'center', stroke: 6 });
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
    // haunted light rays behind rare+ catches
    if ((f.rar === 'legendary' || f.rar === 'epic') && k > .3) {
      ctx.save(); ctx.translate(W / 2, fy); ctx.globalCompositeOperation = 'lighter';
      const rays = f.rar === 'legendary' ? 12 : 8;
      const rayCol = f.rar === 'legendary' ? '255,217,77' : '192,125,255';
      for (let i = 0; i < rays; i++) {
        const a = g.t * .9 + i * TAU / rays;
        ctx.fillStyle = `rgba(${rayCol},${.10 + .06 * Math.sin(g.t * 3 + i)})`;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, 320, a, a + .16); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      if (chance(.5)) g.fx.trailDot(W / 2 + rnd(-140, 140), fy + rnd(-40, 90), { life: rnd(.8, 1.6), size: rnd(8, 18), color: f.rar === 'legendary' ? '#ffd94d' : '#c07dff' });
    }
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
    ctx.fillStyle = 'rgba(4,6,18,.55)'; ctx.fillRect(0, 0, W, H);
    g.text('HAUNTED POND', W / 2, H * .28, { size: 58, color: '#ff9a3c', align: 'center', stroke: 8 });
    g.text('a catfishin\u2019 halloween tale', W / 2, H * .335, { size: 22, color: '#c9b8ff', align: 'center' });
    g.text('tap to cast \u00b7 time the strike \u00b7 reel with rhythm', W / 2, H * .375, { size: 20, color: '#fff', align: 'center' });
    g.text('TAP TO START', W / 2, H * .62, { size: 34, color: '#7dff9a', align: 'center', stroke: 5 });
    drawFish(ctx, FISH[11], W / 2, H * .48, 1.1, false);
  }
  if (g.mode === 'play' && S.phase === 'cast' && !S.bookOpen) {
    g.text('TAP TO CAST', W / 2, H * .62, { size: 34, color: '#fff', align: 'center', stroke: 5 });
  }

  /* collection book overlay */
  if (S.bookOpen) drawBook(ctx);
}

function drawBook(ctx) {
  ctx.fillStyle = 'rgba(4,5,14,.92)'; ctx.fillRect(0, 0, W, H);
  g.text('SPOOKY COLLECTION', W / 2, 84, { size: 36, color: '#ff9a3c', align: 'center', stroke: 5 });
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
  rr(ctx, 12, 12, 190, 64, 12); ctx.fillStyle = 'rgba(6,8,20,.68)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,154,60,.4)'; ctx.lineWidth = 2; ctx.stroke();
  g.text(String(g.score), 30, 40, { size: 30, color: '#ff9a3c', align: 'left', stroke: 4 });
  g.text('SCORE', 30, 62, { size: 14, color: 'rgba(255,255,255,.75)', align: 'left' });
  g.text('\uD83C\uDF83 ' + S.caught, 150, 46, { size: 24, color: '#fff', align: 'left', stroke: 3 });
  // book button
  const bx = W - 72, by = 44;
  rr(ctx, bx - 30, by - 30, 60, 60, 14); ctx.fillStyle = S.bookOpen ? 'rgba(255,154,60,.35)' : 'rgba(6,8,20,.68)'; ctx.fill();
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2.5;
  rr(ctx, bx - 16, by - 20, 32, 40, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx - 16, by - 8); ctx.lineTo(bx + 16, by - 8); ctx.stroke();
  g.text(book.size + '/12', bx, by + 44, { size: 14, color: '#ff9a3c', align: 'center' });
  // combo is drawn by engine
}

g.run(update, draw, hud);
window.__g = g;
window.__dbg = () => ({ phase: S.phase, score: g.score, caught: S.caught, book: book.size, tension: Math.round(S.tension), progress: Math.round(S.progress) });

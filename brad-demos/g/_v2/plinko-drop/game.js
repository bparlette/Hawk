// PLINKO DROP — plinko-drop (Cat Arcade v2)
// A cat turret at the top of a neon peg field. Aim with your finger, hold to charge, let go and the
// chip fires into the pegs. Real circle physics: every chip is a sequence of genuine bounces, and every
// peg you clip plays the next note up the scale. Three chips. One of them has to find the x5.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, R, TAU,
  rr, circle, hexA, shadow, heartPath, damp, fmt,
} from '../_vendor/gp2x.js';
import { drawChar, face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'plinko-drop', title: 'PLINKO DROP', sub: 'AIM · HOLD TO CHARGE · RELEASE',
  hook: 'three chips to find the x5', w: W, h: H, bg: '#0a0718', style: 'toon',
  bloom: .96, ca: .44, vig: 1, scan: .18,
});

const isAuto = new URLSearchParams(location.search).has('auto');

/* ---------------------------------------------------------------- geometry */
const WL = 16, WR = 524;              // side walls
const HX = 270, HY = 200;             // turret hinge
const MZ = 24;                        // muzzle offset from hinge
const TOPY = 244;                     // ceiling (chips above this get pushed back)
const PR = 8, CR = 11;                // peg radius, chip radius
const ROW0 = 258, DY = 54, SX = 61, ROWS = 9;
const DIV_Y = 742;                    // divider tops
const LOCK_Y = 786;                   // y at which the chip commits to a slot
const FLOOR = 846;
const GRAV = 1220, E_PEG = .62, E_WALL = .52, DRAG = .55;
const FIX = 1 / 120;
const MULTS = [.5, 5, 2, 1, 2, 5, .5];
const SW = (WR - WL) / 7;
const slotX = i => WL + SW * (i + .5);
const WIN_SLOT = MULTS.map((m, i) => (m === 5 ? i : -1)).filter(i => i >= 0);

/* ---------------------------------------------------------------- pegs */
const pegs = [];
for (let r = 0; r < ROWS; r++) {
  const odd = r & 1;
  const n = odd ? 7 : 8;
  const x0 = odd ? 87 : 56.5;
  for (let k = 0; k < n; k++) {
    pegs.push({ x: x0 + k * SX, y: ROW0 + r * DY, f: 0, k: pegs.length });
  }
}
/* divider head pegs */
const divs = [];
for (let i = 1; i < 7; i++) divs.push({ x: WL + SW * i, f: 0, i });

/* ---------------------------------------------------------------- scenery */
const stars = [];
for (let i = 0; i < 60; i++) stars.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 1.8), ph: rnd(0, TAU), sp: rnd(.5, 2.2) });
const glowDots = [];
for (let i = 0; i < 26; i++) glowDots.push({ x: rnd(0, W), y: rnd(240, 900), r: rnd(1.5, 4), ph: rnd(0, TAU), sp: rnd(.3, 1.3) });
const rails = [];
for (let i = 0; i < 5; i++) rails.push({ y: 300 + i * 130, h: rnd(6, 16), a: rnd(.02, .05) });

/* ---------------------------------------------------------------- state */
const chip = { x: 0, y: 0, vx: 0, vy: 0, live: false, spin: 0, hits: 0, slot: -1 };
let phase = 'aim';             // aim | charge | fly | land | over
let charge = 0, aimA = 0, drops = 3, coins = 0, bestM = 0, phaseT = 0, worldT = 0;
let results = [], banner = '', bannerT = 0, hits = 0, trail = [], homeX = 0, homeY = 0;
let autoT = 0, botPlan = null, botQueue = [], botDelay = 0, landT = 0, lastSlot = -1, slotFlash = new Array(7).fill(0);

/* ---------------------------------------------------------------- physics (shared by sim) */
function phys(b, dt, economy) {
  b.vy += GRAV * dt;
  b.vx -= b.vx * DRAG * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.x < WL + CR) { b.x = WL + CR; if (b.vx < 0) b.vx = -b.vx * E_WALL; }
  if (b.x > WR - CR) { b.x = WR - CR; if (b.vx > 0) b.vx = -b.vx * E_WALL; }
  if (b.y < TOPY + CR) { b.y = TOPY + CR; if (b.vy < 0) b.vy = -b.vy * E_WALL; }
  const rr2 = CR + PR, rr22 = rr2 * rr2;
  for (let i = 0; i < pegs.length; i++) {
    const p = pegs[i];
    const dx = b.x - p.x, dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr22) continue;
    const d = Math.sqrt(d2) || .0001;
    const nx = dx / d, ny = dy / d;
    b.x = p.x + nx * rr2;
    b.y = p.y + ny * rr2;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + E_PEG) * vn * nx;
      b.vy -= (1 + E_PEG) * vn * ny;
      b.spin = (b.spin || 0) + (nx * b.vy - ny * b.vx) * .0012;
      if (economy) { p.f = 1; b.hits++; pegHit(p, b.x, b.y); }
    }
    // tiny deterministic anti-stall nudge
    if (Math.abs(ny) > .96 && Math.abs(b.vx) < 26) b.vx += (i & 1 ? 34 : -34);
  }
  if (b.y > DIV_Y - CR) {
    for (const d of divs) {
      if (Math.abs(b.x - d.x) < CR + 5 && b.y < LOCK_Y + 4) {
        const s = Math.sign(b.x - d.x) || 1;
        b.x = d.x + s * (CR + 5);
        if (b.vx * s < 0) b.vx = -b.vx * .58;
        if (economy) d.f = 1;
      }
    }
  }
  return b;
}
const slotOf = x => clamp(Math.floor((x - WL) / SW), 0, 6);

/* ---------------------------------------------------------------- launch */
function aimAngle() {
  const p = g.ptr;
  const dx = p.x - HX, dy = Math.max(26, p.y - HY);
  let a = Math.atan2(dx, dy);
  return clamp(a, -1.15, 1.15);
}
const power = () => 250 + charge * 840;
function launch(angle, pw, out) {
  out = out || {};
  out.x = HX + Math.sin(angle) * MZ;
  out.y = HY + Math.cos(angle) * MZ;
  out.vx = Math.sin(angle) * pw;
  out.vy = Math.cos(angle) * pw;
  out.spin = 0;
  out.hits = 0;
  return out;
}

function fire() {
  if (phase !== 'aim' && phase !== 'charge') return;
  const a = aimA, pw = power();
  launch(a, pw, chip);
  chip.live = true; chip.slot = -1;
  phase = 'fly'; phaseT = 0; hits = 0;
  trail = [];
  homeX = chip.x; homeY = chip.y;
  acc = 0;
  sfx('shoot', { pitch: .82 + charge * .5 });
  g.shake(3 + charge * 4);
  g.punch(4 + charge * 7);
  g.fx.ring(chip.x, chip.y, { r: 22 + charge * 22, color: '#ffd34d', life: .3 });
  g.fx.burst(chip.x, chip.y, 10 + Math.round(charge * 8), { kind: 'spark', color: ['#ffd34d', '#ff9a3c', '#ffffff'], speed: 240 + charge * 320, life: .3, size: 3.2, ang: Math.atan2(chip.vy, chip.vx), spread: .9 });
  g.combo.n = 0; g.combo.mult = 1;
  sync();
}

function pegHit(p, x, y) {
  hits++;
  coins += 2;
  g.combo.hit(x, y);
  const pitch = clamp(.9 + hits * .055, .9, 2.1);
  sfx('blip', { pitch });
  g.fx.burst(x, y, 4, { kind: 'spark', color: ['#bffcff', '#8b7dff', '#ffffff'], speed: 200 + hits * 8, life: .24, size: 2.6 });
  if (hits === 4) sfx('coin', { pitch: 1.05 });
  if (hits === 8) sfx('coinchain', { pitch: 1.18 });
  g.punch(1.2);
}

function land(idx) {
  chip.slot = idx;
  chip.live = false;
  phase = 'land'; phaseT = 0; landT = 0;
  lastSlot = idx;
  slotFlash[idx] = 1;
  const m = MULTS[idx];
  const pay = Math.round(120 * m);
  coins += pay;
  bestM = Math.max(bestM, m);
  results.unshift({ idx, m, pay });
  const cx = slotX(idx), cy = FLOOR - 30;
  const isWin = m === 5;
  if (isWin) {
    sfx('perfect'); sfx('coinchain', { pitch: 1.2 }); sfx('unlock');
    g.flash('#ffd34d', .34); g.shake(14); g.punch(14); g.slowmo(.5, .34);
    g.popup('x5  +' + pay, cx, cy - 30, '#ffd34d', 46);
    for (let i = 0; i < 34; i++) g.fx.burst(cx, cy, 1, { kind: 'confetti', color: ['#ffd34d', '#fff3b0', '#ff9a3c', '#ffffff'], speed: rnd(200, 560), life: 1.4, size: 5.5, ang: rnd(-Math.PI, 0), spread: .9 });
  } else {
    sfx(m >= 2 ? 'coin' : 'pop', { pitch: m >= 2 ? 1.1 : .8 });
    g.popup('x' + m + '  +' + pay, cx, cy - 26, m >= 2 ? '#bffcff' : '#8f8fa8', 34);
    g.shake(5);
    g.fx.burst(cx, cy, 8, { kind: 'spark', color: ['#8b7dff', '#bffcff'], speed: 260, life: .3, size: 3 });
  }
  sync();
}
function nextDrop() {
  drops--;
  if (MULTS[lastSlot] === 5) return win();
  if (drops <= 0) return lose();
  phase = 'aim'; phaseT = 0; charge = 0;
  chip.live = false; chip.slot = -1;
  g.showBanner('DROP ' + (4 - drops) + ' OF 3', .7);
  banner = drops + ' LEFT'; bannerT = .9;
  sync();
}

/* ---------------------------------------------------------------- terminal */
function win() {
  sfx('fanfare'); sfx('win'); sfx('meow', { pitch: 1.1 });
  g.flash('#ffd34d', .4); g.shake(16); g.slowmo(.4, .8);
  for (let i = 0; i < 40; i++) g.fx.burst(rnd(40, W - 40), rnd(200, 700), 1, { kind: 'confetti', color: ['#ffd34d', '#bffcff', '#ff5fd2', '#8bffb0'], speed: rnd(200, 560), life: 1.5, size: 5, ang: rnd(-Math.PI, 0), spread: .9 });
  g.end({ win: true, score: Math.round(coins), label: 'COINS', progress: 1 });
}
function lose() {
  sfx('lose'); sfx('meow', { pitch: .68 });
  g.flash('#ff2d55', .3); g.shake(12); g.slowmo(.3, .7);
  g.end({ win: false, score: Math.round(coins), label: 'COINS', progress: clamp(bestM / 5, 0, 1) });
}

/* ---------------------------------------------------------------- bot */
const SIM = { x: 0, y: 0, vx: 0, vy: 0, hits: 0, spin: 0, live: 1 };
function simSlot(angle, pw) {
  launch(angle, pw, SIM);
  SIM.live = 1;
  for (let i = 0; i < 900; i++) {
    phys(SIM, FIX, 0);
    if (SIM.y >= LOCK_Y) return slotOf(SIM.x);
  }
  return slotOf(SIM.x);
}
function buildQueue() {
  botQueue = [];
  const A = 22, P = 16;
  for (let a = 0; a < A; a++) {
    for (let p = 0; p < P; p++) {
      botQueue.push({ a: -1.1 + (2.2 * a) / (A - 1), p: .12 + (0.9 * p) / (P - 1) });
    }
  }
  // dumb bot wants the worst slot
  if (g.dumb()) botQueue.reverse();
}
function botPick() {
  if (!botQueue.length) buildQueue();
  let best = null, bestV = -99;
  for (let k = 0; k < 12 && botQueue.length; k++) {
    const c = botQueue.pop();
    const s = simSlot(c.a, 250 + c.p * 840);
    const m = MULTS[s];
    const v = g.dumb() ? -m : m;
    if (v > bestV) { bestV = v; best = c; }
    if (!g.dumb() && m === 5) break;                 // found a winner, stop searching
    if (g.dumb() && m === 1) break;                  // found a dud
  }
  if (!best) best = { a: rnd(-.5, .5), p: .5 };
  return best;
}

/* ---------------------------------------------------------------- reset */
let acc = 0;
function resetWorld() {
  phase = 'aim'; charge = 0; aimA = 0; drops = 3; coins = 0; bestM = 0; phaseT = 0; worldT = 0;
  results = []; banner = ''; bannerT = 0; hits = 0; botPlan = null; botQueue = []; botDelay = 0;
  autoT = 0; acc = 0; landT = 0; lastSlot = -1;
  slotFlash = new Array(7).fill(0);
  chip.live = false; chip.slot = -1; chip.x = HX; chip.y = HY + MZ; chip.vx = 0; chip.vy = 0;
  for (const p of pegs) p.f = 0;
  for (const d of divs) d.f = 0;
  trail = [];
  g.score = 0; g.combo.n = 0; g.combo.mult = 1;
  g.fx.clear();
  g.state = { score: 0, drops: 3, mult: 0, phase: 'aim', slot: -1, best: 0 };
}
function sync() {
  g.score = Math.round(coins);
  g.state.score = Math.round(coins);
  g.state.drops = Math.max(0, drops);
  g.state.mult = lastSlot >= 0 ? MULTS[lastSlot] : 0;
  g.state.phase = phase;
  g.state.slot = lastSlot;
  g.state.best = bestM;
  g.state.hits = hits;
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (g.mode !== 'play') return;
  worldT += dt; phaseT += dt; autoT += dt;
  bannerT = Math.max(0, bannerT - dt);
  for (const p of pegs) p.f = Math.max(0, p.f - dt * 3.4);
  for (const d of divs) d.f = Math.max(0, d.f - dt * 3.4);
  for (let i = 0; i < 7; i++) slotFlash[i] = Math.max(0, slotFlash[i] - dt * 1.6);

  /* ---- input ---- */
  if (isAuto) {
    botDelay -= dt;
    if ((phase === 'aim' || phase === 'charge') && botDelay <= 0) {
      if (!botPlan) botPlan = botPick();
      aimA = damp(aimA, botPlan.a, 18, dt);
      charge = damp(charge, botPlan.p, 12, dt);
      phase = 'charge';
      if (Math.abs(aimA - botPlan.a) < .02 && Math.abs(charge - botPlan.p) < .02) fire();
    }
    if (phase === 'land' && phaseT > .85) { botPlan = null; botDelay = .12; nextDrop(); }
  } else {
    if (g.mode === 'play' && (phase === 'aim' || phase === 'charge')) {
      aimA = damp(aimA, aimAngle(), 22, dt);
      const held = g.ptr.down || g.keys.has('Space');
      if (held) {
        phase = 'charge';
        charge = Math.min(1, charge + dt * .78);
      } else if (phase === 'charge') {
        fire();
      }
    }
    if (phase === 'land' && phaseT > .8) nextDrop();
  }

  /* ---- chip ---- */
  if (phase === 'fly' && chip.live) {
    acc += Math.min(dt, .05);
    let guard = 0;
    while (acc >= FIX && chip.live && guard++ < 12) {
      acc -= FIX;
      phys(chip, FIX, 1);
      chip.spin += (chip.vx * .0002);
      if (chip.y >= LOCK_Y) land(slotOf(chip.x));
    }
    trail.push({ x: chip.x, y: chip.y, a: 1 });
    if (trail.length > 16) trail.shift();
    if (chip.y > H + 80) land(slotOf(chip.x));
  }
  for (const t of trail) t.a = Math.max(0, t.a - dt * 3.4);

  /* ---- safety ---- */
  if (phase === 'fly' && phaseT > 7) land(slotOf(chip.x));
  sync();
  if (isAuto && autoT > 90 && g.mode === 'play') g.end({ win: true, score: Math.round(coins), label: 'COINS', progress: 1 });
}

/* ---------------------------------------------------------------- draw */
function drawBack(ctx) {
  g.sky(ctx, ['#0a0718', '#140b2e', '#251347', '#3b1454'], { glow: 'rgba(255,211,77,.16)', gx: .5, gy: .06, gr: 1.0 });
  for (const s of stars) {
    ctx.globalAlpha = .25 + .5 * (.5 + .5 * Math.sin(g.t * s.sp + s.ph));
    ctx.fillStyle = '#e6dcff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  /* big radial halo behind the field */
  const hg = ctx.createRadialGradient(270, 470, 20, 270, 470, 380);
  hg.addColorStop(0, 'rgba(139,125,255,.20)');
  hg.addColorStop(.6, 'rgba(139,125,255,.06)');
  hg.addColorStop(1, 'rgba(139,125,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(270, 470, 380, 0, TAU); ctx.fill();
  /* rails */
  for (const r of rails) {
    ctx.globalAlpha = r.a;
    ctx.fillStyle = '#bffcff';
    ctx.fillRect(0, r.y, W, r.h);
  }
  ctx.globalAlpha = 1;
  /* drifting motes */
  for (const d of glowDots) {
    const y = ((d.y - g.t * 14 * d.sp) % 900 + 900) % 900 + 100;
    ctx.globalAlpha = .18 + .22 * (.5 + .5 * Math.sin(g.t * d.sp * 2 + d.ph));
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(d.x + Math.sin(g.t * d.sp + d.ph) * 8, y, d.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* side walls */
  const wg = ctx.createLinearGradient(0, 200, 0, FLOOR);
  wg.addColorStop(0, 'rgba(139,125,255,.5)');
  wg.addColorStop(.5, 'rgba(191,252,255,.34)');
  wg.addColorStop(1, 'rgba(255,211,77,.42)');
  ctx.strokeStyle = wg; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(WL, DIV_Y - 40); ctx.lineTo(WL, FLOOR); ctx.moveTo(WR, DIV_Y - 40); ctx.lineTo(WR, FLOOR); ctx.stroke();
  ctx.strokeStyle = 'rgba(139,125,255,.12)'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(WL, DIV_Y - 40); ctx.lineTo(WL, FLOOR); ctx.moveTo(WR, DIV_Y - 40); ctx.lineTo(WR, FLOOR); ctx.stroke();
}

function drawPegs(ctx) {
  for (const p of pegs) {
    const f = p.f;
    ctx.globalAlpha = .1 + f * .3;
    ctx.fillStyle = f > .1 ? '#ffffff' : '#8b7dff';
    ctx.beginPath(); ctx.arc(p.x, p.y, PR + 8 + f * 8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(p.x - 2.5, p.y - 3, .5, p.x, p.y, PR);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(.5, f > .1 ? '#fff3b0' : '#c9c2ff');
    grad.addColorStop(1, f > .1 ? '#ffd34d' : '#5c50c8');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, PR + f * 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0a0718'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const d of divs) {
    ctx.fillStyle = '#0a0718';
    rr(ctx, d.x - 4, DIV_Y, 8, FLOOR - DIV_Y + 6, 4); ctx.fill();
    ctx.strokeStyle = d.f > .1 ? '#ffffff' : 'rgba(139,125,255,.55)'; ctx.lineWidth = 2;
    rr(ctx, d.x - 4, DIV_Y, 8, FLOOR - DIV_Y + 6, 4); ctx.stroke();
    ctx.fillStyle = d.f > .1 ? '#fff3b0' : '#c9c2ff';
    ctx.beginPath(); ctx.arc(d.x, DIV_Y, 6, 0, TAU); ctx.fill();
  }
}

function drawSlots(ctx) {
  for (let i = 0; i < 7; i++) {
    const m = MULTS[i];
    const x = WL + SW * i, cx = slotX(i);
    const isWin = m === 5;
    const f = slotFlash[i];
    const bob = isWin ? Math.sin(g.t * 3.2 + i) * 2.5 : 0;
    /* bowl */
    const bg = ctx.createLinearGradient(0, DIV_Y, 0, FLOOR);
    if (isWin) {
      bg.addColorStop(0, 'rgba(255,211,77,' + (.18 + f * .5) + ')');
      bg.addColorStop(1, 'rgba(255,154,60,' + (.42 + f * .5) + ')');
    } else {
      bg.addColorStop(0, 'rgba(139,125,255,' + (.1 + f * .4) + ')');
      bg.addColorStop(1, 'rgba(20,10,44,' + (.7 + f * .3) + ')');
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x + 3, DIV_Y + 6); ctx.lineTo(x + SW - 3, DIV_Y + 6);
    ctx.lineTo(x + SW - 6, FLOOR); ctx.lineTo(x + 6, FLOOR); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = isWin ? hexA('#ffd34d', .75 + f * .25 + Math.sin(g.t * 4 + i) * .12) : 'rgba(139,125,255,.45)';
    ctx.lineWidth = isWin ? 3 : 2; ctx.stroke();
    /* label chip */
    const ly = FLOOR - 26 + bob;
    ctx.fillStyle = isWin ? '#2a1700' : 'rgba(10,7,24,.85)';
    rr(ctx, cx - 25, ly - 16, 50, 30, 9); ctx.fill();
    ctx.strokeStyle = isWin ? '#ffd34d' : 'rgba(139,125,255,.7)';
    ctx.lineWidth = 2.2; ctx.stroke();
    g.text('x' + (m === .5 ? '½' : m), cx, ly + 8, {
      size: isWin ? 26 : 21, color: isWin ? '#ffd34d' : '#c9c2ff', align: 'center', stroke: isWin ? 0 : 0,
    });
    if (isWin) {
      ctx.globalAlpha = .35 + .25 * Math.sin(g.t * 4 + i);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(cx, FLOOR - 6, 3.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawChip(ctx, x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(.45, '#ffd34d');
  grad.addColorStop(1, '#c47a12');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1700'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, 0, r * .58, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawTurret(ctx) {
  const a = aimA;
  const pw = power();
  /* aim beam + guide dots */
  if (phase === 'aim' || phase === 'charge') {
    const sx = HX + Math.sin(a) * MZ, sy = HY + Math.cos(a) * MZ;
    /* dotted true-physics preview: the first few peg contacts only */
    const S = { x: sx, y: sy, vx: Math.sin(a) * pw, vy: Math.cos(a) * pw, spin: 0, hits: 0 };
    let shown = 0;
    for (let i = 0; i < 160 && shown < 15; i++) {
      phys(S, FIX, 0);
      if (i % 8 === 0) {
        const u = shown / 15;
        ctx.globalAlpha = (1 - u * .55) * (.32 + charge * .5);
        ctx.fillStyle = u < .5 ? '#bffcff' : '#ffd34d';
        ctx.beginPath(); ctx.arc(S.x, S.y, 4.6 - u * 2, 0, TAU); ctx.fill();
        shown++;
      }
      if (S.y >= LOCK_Y) break;
    }
    ctx.globalAlpha = 1;
    /* charge arc around the muzzle */
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = charge > .82 ? '#ffd34d' : '#bffcff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(sx, sy, 34, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.stroke();
    if (charge > .82) {
      ctx.globalAlpha = .5 + .3 * Math.sin(g.t * 16);
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(sx, sy, 42, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  /* barrel */
  ctx.save();
  ctx.translate(HX, HY);
  ctx.rotate(a);
  const bg = ctx.createLinearGradient(-14, 0, 14, 0);
  bg.addColorStop(0, '#8b7dff');
  bg.addColorStop(.45, '#e8e2ff');
  bg.addColorStop(1, '#4a3fa8');
  ctx.fillStyle = bg;
  rr(ctx, -15, 6, 30, 46, 9); ctx.fill();
  ctx.strokeStyle = '#0a0718'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  rr(ctx, -17, 44, 34, 9, 4); ctx.fill();
  ctx.strokeStyle = '#0a0718'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  rr(ctx, -9, 12, 5, 28, 2.5); ctx.fill();
  ctx.restore();
  /* turret cat face */
  face(ctx, 'cat', HX, HY - 4, 26, '#ff9a3c');
  /* base plate */
  ctx.fillStyle = 'rgba(10,7,24,.9)';
  rr(ctx, HX - 44, HY - 34, 88, 22, 11); ctx.fill();
  ctx.strokeStyle = 'rgba(139,125,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
  g.text('X5 OR BUST', HX, HY - 18, { size: 15, color: '#c9c2ff', align: 'center' });
}

function drawHud(ctx) {
  g.text('COINS', 26, 40, { size: 18, color: '#c9c2ff' });
  g.text(fmt(Math.round(coins)), 26, 92, { size: 50, color: '#ffd34d', stroke: 9 });
  /* drop chips left */
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 34, y = 130, on = i < drops;
    ctx.globalAlpha = on ? 1 : .18;
    drawChip(ctx, x, y, 13, 0);
    ctx.globalAlpha = 1;
  }
  /* results so far */
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const x = W - 34 - i * 42, y = 128;
    ctx.fillStyle = r.m === 5 ? 'rgba(255,211,77,.9)' : 'rgba(10,7,24,.85)';
    rr(ctx, x - 18, y - 17, 36, 32, 9); ctx.fill();
    ctx.strokeStyle = r.m === 5 ? '#ffd34d' : 'rgba(139,125,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
    g.text('x' + (r.m === .5 ? '½' : r.m), x, y + 7, { size: 18, color: r.m === 5 ? '#2a1700' : '#c9c2ff', align: 'center' });
  }
  /* charge bar */
  const cw = W - 80, cx = 40, cy = 888;
  ctx.fillStyle = 'rgba(10,7,24,.82)';
  rr(ctx, cx, cy, cw, 30, 15); ctx.fill();
  ctx.strokeStyle = 'rgba(139,125,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  cg.addColorStop(0, '#4ff0ff'); cg.addColorStop(.62, '#8b7dff'); cg.addColorStop(1, '#ffd34d');
  ctx.fillStyle = cg;
  rr(ctx, cx + 3, cy + 3, Math.max(0, (cw - 6) * charge), 24, 12); ctx.fill();
  ctx.globalAlpha = .8;
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = 'rgba(10,7,24,.5)';
    ctx.fillRect(cx + (cw * i) / 4, cy + 4, 2, 22);
  }
  ctx.globalAlpha = 1;
  g.text(charge > .82 ? 'MAX POWER' : 'CHARGE', W / 2, cy + 21, { size: 17, color: charge > .35 ? '#100a20' : '#c9c2ff', align: 'center' });
  /* prompt */
  if (phase === 'aim' || phase === 'charge') {
    const a = .45 + .3 * Math.sin(g.t * 4);
    g.text(phase === 'charge' ? (charge > .82 ? 'RELEASE!' : 'CHARGING…') : 'AIM & HOLD', W / 2, 858, { size: 22, color: 'rgba(191,252,255,' + a + ')', align: 'center', stroke: 6 });
  } else if (phase === 'fly') {
    g.text('PEGS ' + hits, W / 2, 858, { size: 22, color: 'rgba(255,211,77,.9)', align: 'center', stroke: 6 });
  }
  if (bannerT > 0) {
    ctx.globalAlpha = Math.min(1, bannerT * 2.6);
    g.text(banner, W / 2, 700, { size: 40, color: '#fff', align: 'center', stroke: 11 });
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------------- boot */
g.onReset = resetWorld;
g.onStart = () => { music('puzzle'); sfx('meow'); g.showBanner('PLINKO DROP', .9); };
resetWorld();

g.draw = () => {
  const ctx = g.ctx;
  drawBack(ctx);
  drawSlots(ctx);
  drawPegs(ctx);
  drawTurret(ctx);
  /* chip */
  if (chip.live) {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i], u = i / trail.length;
      ctx.globalAlpha = t.a * u * .5;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(t.x, t.y, CR * (.4 + u * .5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const gl = ctx.createRadialGradient(chip.x, chip.y, 2, chip.x, chip.y, CR * 3);
    gl.addColorStop(0, 'rgba(255,243,176,.5)'); gl.addColorStop(1, 'rgba(255,211,77,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(chip.x, chip.y, CR * 3, 0, TAU); ctx.fill();
    drawChip(ctx, chip.x, chip.y, CR, chip.spin);
  } else if (phase === 'land' && chip.slot >= 0) {
    const cx = slotX(chip.slot);
    drawChip(ctx, cx, FLOOR - 44 + Math.sin(g.t * 6) * 2, CR, g.t * 2);
  } else if (phase === 'aim' || phase === 'charge') {
    const sx = HX + Math.sin(aimA) * (MZ + 26), sy = HY + Math.cos(aimA) * (MZ + 26);
    drawChip(ctx, sx, sy, CR, g.t * .6);
  }
  drawHud(ctx);
  const fg = ctx.createLinearGradient(0, H - 60, 0, H);
  fg.addColorStop(0, 'rgba(10,7,24,0)'); fg.addColorStop(1, 'rgba(10,7,24,.7)');
  ctx.fillStyle = fg; ctx.fillRect(0, H - 60, W, 60);
  if (g.fx.p.length > 400) g.fx.p.splice(0, 50);
};
g.update = update;

g.run(update, g.draw);

window.__g = g;
window.__dbg = () => ({ mode: g.mode, coins: Math.round(coins), drops, phase, charge: +charge.toFixed(2), slot: lastSlot, best: bestM, hits });

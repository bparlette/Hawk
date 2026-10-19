// CAT OBBY — obby-gauntlet (Cat Arcade v2)
// A 3D-ish obstacle course: perspective platforms with real depth, a spinning-bar gauntlet,
// and a gold flag at the end. Tap = jump, drag / arrows = steer. Win = plant the flag.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, TAU, rr, panel, hexA, damp, fmt } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'obby-gauntlet', title: 'CAT OBBY', sub: 'TAP = JUMP  ·  DRAG = STEER',
  hook: 'one slip and the cat is gone', w: W, h: H, bg: '#0a0820', style: 'toon',
  bloom: .95, ca: .42, vig: 1, scan: .16, grain: .05,
});

/* ================================================================ projection */
const F = 620;       // focal length
const HOR = 252;     // horizon: y = 0 vanishes here
const NEARZ = 2.0;   // near clip (world units)
const CAMBACK = 6.5, CAMH = 1.9;
const GRAV = 24, JUMPV = 10, CAT_H = 1.35;
let camX = 0, camY = CAMH, camZ = -CAMBACK;
const sAt = z => F / Math.max(NEARZ, z - camZ);
const pxAt = (x, z) => W / 2 + (x - camX) * sAt(z);
const pyAt = (y, z) => HOR + (camY - y) * sAt(z);

/* ================================================================ course */
const PLATS = [], BARS = [], COINS = [];
const P = (z0, len, w, kind = 'pad') => { PLATS.push({ z0, z1: z0 + len, w, kind, len }); return z0 + len; };
P(0, 15, 7.2);
P(19.4, 9.6, 6.4);
P(32.8, 13, 5.8); BARS.push({ x: -3.1, z: 39.6, om: 2.1, a0: .4, near: false });
P(49.6, 9.4, 3.0, 'beam');
P(62.6, 13, 5.4); BARS.push({ x: 3.1, z: 69.6, om: -2.5, a0: 2.2, near: false });
P(79.6, 9.2, 2.8, 'beam');
P(92.8, 13, 5.2); BARS.push({ x: -3.2, z: 99.8, om: 2.9, a0: 1.1, near: false });
P(109.8, 9.2, 5.6);
P(123.0, 13, 5.4); BARS.push({ x: 3.2, z: 130.0, om: -3.3, a0: 3.4, near: false });
P(140.0, 9, 2.6, 'beam');
P(153.6, 14, 7.6, 'goal');
const FLAGZ = 162;
const BAR_L = 3.6, BAR_R = .62, BAR_TOP = .58;
const MILESTONES = [.25, .5, .75];

const COIN_TPL = [
  [7, 0], [10.5, 0], [16.6, 0], [19.9, 0], [24, 0], [26.5, 0],
  [38.4, 0], [41, 0], [45.2, 0], [51, 0], [54.5, 0], [57, 0],
  [68.4, 0], [71, 0], [83, 0], [86, 0], [99, 0], [102, 0],
  [112, 0], [115, 0], [129, 0], [133, 0], [142.5, 0], [146, 0], [158, 0], [160, 0],
];
const COIN_ORDER = COIN_TPL.map((c, i) => i).sort((a, b) => COIN_TPL[a][0] - COIN_TPL[b][0]);

/* ================================================================ state */
let cat, t = 0, coins = [], steerT = 0, bestZ = 0, jumpBuf = 0;
let airT = 0, grazeT = 0, mile = 0, ending = 0;
/* tweened juice objects — g.tween drives these, no per-frame allocation */
const pulse = { v: 0 };   // HUD scale kick
const gust = { v: 0 };    // speed-line brightening after a big play
const tilt = { v: 0 };    // camera roll on death / win
const vibe = { v: 0 };    // ambient breath used by the backdrop

const platAt = (x, z) => { for (const p of PLATS) if (z >= p.z0 && z <= p.z1 && Math.abs(x) <= p.w / 2 + .1) return p; return null; };
const speed = () => 9.4 + Math.min(3.1, bestZ * .021);
const barAng = b => b.a0 + b.om * t;
function barDist(x, z, b) {
  const a = barAng(b), dx = x - b.x, dz = z - b.z, cx = Math.cos(a), cz = Math.sin(a);
  const k = clamp(dx * cx + dz * cz, -BAR_L, BAR_L);
  return Math.hypot(dx - cx * k, dz - cz * k);
}
const barHit = (x, z, b) => barDist(x, z, b) < BAR_R;
const fxRoom = () => g.fx.p.length < 260;   // hard budget: never let the particle list grow unbounded

function resetWorld() {
  cat = { x: 0, y: 0, vy: 0, z: .6, air: false, sq: 1, rot: 0, hurt: 0, glow: 0 };
  t = 0; coins = COIN_TPL.map(([z, x]) => ({ z, x, got: false, ph: z * 1.7 }));
  camZ = cat.z - CAMBACK; camX = 0; camY = CAMH;
  steerT = 0; bestZ = 0; jumpBuf = 0;
  airT = 0; grazeT = 0; mile = 0; ending = 0;
  pulse.v = 0; gust.v = 0; vibe.v = 0;
  g.cam.rot = 0; g.cam.z = 1;
  for (const b of BARS) b.near = false;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, pct: 0, combo: 0, z: 0 };
  music('action');
}
g.onReset = resetWorld;
resetWorld();
music('action');

/* ================================================================ input */
const BTN_L = { x: 14, y: H - 118, w: 112, h: 88 };
const BTN_R = { x: W - 126, y: H - 118, w: 112, h: 88 };
const inR = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/* ---------- feedback: three layers per action, every time ---------- */
function bumpHud(amount) {
  pulse.v = Math.max(pulse.v, amount || 1);
  g.tween(pulse, 'v', 0, .42, u => 1 - (1 - u) * (1 - u));
}
function gustUp(amount) {
  gust.v = Math.max(gust.v, amount);
  g.tween(gust, 'v', 0, .7, u => 1 - (1 - u) * (1 - u));
}

function jump() {
  if (cat.air) { jumpBuf = .15; return; }
  cat.air = true; cat.vy = JUMPV; cat.sq = .78; airT = 0;
  const sx = pxAt(cat.x, cat.z), sy = pyAt(0, cat.z);
  const p = comboPitch(g.combo.n);
  sfx('jump', { pitch: .92 * p + .06 });
  g.fx.dust(sx, sy, 8, { color: 'rgba(140,245,255,.6)', size: 12, up: 46, speed: 130 });
  g.fx.burst(sx, sy, 9, { kind: 'spark', color: ['#7df9ff', '#fff'], speed: 200, life: .3, g: 500 });
  g.fx.emit('ring', sx, sy, { size: 30, life: .28, color: '#7df9ff', add: true, wide: 5 });
  g.impact(sx, sy - 6, { punch: .03, shake: 3, rip: .35, stop: 0 });
  gustUp(.35);
}

/* landing: dust flare, shockwave, hit-stop and a squash that overshoots back */
function landFx(hard, beam) {
  const sx = pxAt(cat.x, cat.z), sy = pyAt(0, cat.z);
  if (hard) {
    g.hitstop(.05); g.punch(.05); g.shake(6.5);
    sfx('thud', { pitch: .78 + comboPitch(g.combo.n) * .12 });
    g.fx.dust(sx, sy, 14, { color: 'rgba(190,240,255,.5)', size: 17, up: 90, speed: 190, spread: 46 });
    g.fx.burst(sx, sy, 12, { kind: 'shard', color: ['#9dfbff', '#2fe3c8', '#fff'], speed: 260, life: .55, size: 7, g: 780 });
    g.fx.emit('ring', sx, sy, { size: 76, life: .34, color: '#9dfbff', add: true, wide: 6 });
    if (g.post) g.post.ripple(sx / W, sy / H, 1.1);
  } else {
    g.hitstop(.03); g.punch(.022); g.shake(2.6);
    sfx('step', { pitch: .72 + comboPitch(g.combo.n) * .1 });
    g.fx.dust(sx, sy, 6, { color: 'rgba(255,255,255,.42)', size: 13 });
    g.fx.burst(sx, sy, 5, { kind: 'spark', color: ['#7df9ff', '#fff'], speed: 130, life: .22, g: 620 });
    if (g.post) g.post.ripple(sx / W, sy / H, .45);
  }
  if (beam) {                      /* sticking a narrow beam is the hardest landing in the course */
    sfx('perfect', { pitch: 1.12 + comboPitch(g.combo.n) * .08 });
    g.fx.burst(sx, sy - 10, 10, { kind: 'star', color: ['#ded6ff', '#fff', '#b9a6ff'], speed: 200, life: .5, size: 7, g: 260 });
    g.popup('BEAM!', sx, sy - 70, '#ded6ff', 30);
    g.score += 20; bumpHud(1.3); g.flash('#ded6ff', .12);
  }
  cat.sq = hard ? 1.34 : 1.2;
}

/* ================================================================ bot
   attempt 0 (dumb) never jumps -> falls at the first gap.
   attempt 1+ reads the course: centre the cat, hop spinners early, hop the ledges late. */
function botThink() {
  if (g.dumb()) { steerT = cat.x > 0 ? 1 : -1; return; }
  const dx = 0 - cat.x;
  steerT = Math.abs(dx) > .12 ? Math.sign(dx) : 0;
  if (cat.air) return;
  const sp = speed(), J = JUMPV / GRAV * 2 * sp;
  for (const b of BARS) {
    const dz = b.z - cat.z;
    if (dz > 3.0 && dz < 4.4 && platAt(0, cat.z + J)) { jump(); return; }
  }
  const p = platAt(cat.x, cat.z);
  if (p && p.z1 - cat.z < 1.0 + sp * .02) jump();
}

/* ================================================================ update */
function update(dt) {
  const bl = g.btn('left', BTN_L.x, BTN_L.y, BTN_L.w, BTN_L.h, '◀', { key: 'ArrowLeft' });
  const br = g.btn('right', BTN_R.x, BTN_R.y, BTN_R.w, BTN_R.h, '▶', { key: 'ArrowRight' });
  const bj = g.btn('jump', W / 2 - 92, H - 126, 184, 96, 'JUMP', { key: 'Space' });
  if (g.mode !== 'play' || dt === 0) {
    g.state = { score: g.state.score || 0, pct: g.state.pct || 0, combo: g.combo.mult, z: bestZ };
    return;
  }

  /* ---------- the win celebration beat: the world holds, the confetti lands, then the panel ---------- */
  if (ending > 0) {
    ending -= dt; vibe.v = 1;
    if (ending <= 0) { ending = -1; g.end({ win: true, score: g.state.score + 500, label: 'METRES' }); }
    return;
  }
  t += dt;
  grazeT = Math.max(0, grazeT - dt * 2.2);
  cat.glow = damp(cat.glow, cat.air ? 1 : 0, 8, dt);

  /* --- input --- */
  if (g.auto) botThink();
  else {
    let st = 0;
    if (bl.held || g.keys.ArrowLeft || g.keys.KeyA) st -= 1;
    if (br.held || g.keys.ArrowRight || g.keys.KeyD) st += 1;
    steerT = st;
    for (const tap of g.taps) if (!inR(tap, BTN_L) && !inR(tap, BTN_R)) { jump(); break; }
    if (bj.pressed) jump();
  }
  jumpBuf = Math.max(0, jumpBuf - dt);
  cat.hurt = Math.max(0, cat.hurt - dt * 3);

  /* --- run forward, steer sideways --- */
  const sp = speed();
  cat.z += sp * dt;
  cat.x = clamp(cat.x + steerT * 4.2 * dt, -3.2, 3.2);

  /* --- vertical --- */
  const under = platAt(cat.x, cat.z);
  if (!cat.air && !under) { cat.air = true; cat.vy = 0; airT = 0; }
  if (cat.air) {
    airT += dt;
    cat.vy -= GRAV * dt;
    cat.y += cat.vy * dt;
    /* rising stretch + a cyan wake so the leap reads at speed */
    if (cat.vy > 1 && fxRoom() && Math.random() < dt * 40) {
      g.fx.trailDot(pxAt(cat.x, cat.z - .25), pyAt(cat.y + .2, cat.z), { size: 13, color: 'rgba(125,249,255,.85)', life: .24, vy: -30 });
    }
    if (cat.vy <= 0 && cat.y <= 0) {
      if (under) {
        const impactV = -cat.vy || 0;
        cat.y = 0; cat.vy = 0; cat.air = false;
        landFx(impactV > 9.5, under.kind === 'beam');
        if (airT > .46) {                 /* a real leap, not a hop: reward the read */
          sfx('perfect', { pitch: 1.3 + comboPitch(g.combo.n) * .06, vol: .7 });
          g.popup('AIR!', pxAt(cat.x, cat.z), pyAt(1, cat.z) - 54, '#7df9ff', 28);
          if (fxRoom()) g.fx.burst(pxAt(cat.x, cat.z), pyAt(.7, cat.z), 8, { kind: 'spark', color: ['#7df9ff', '#fff'], speed: 230, life: .4, size: 5, g: 500 });
          bumpHud(.8);
        }
        if (jumpBuf > 0) { jumpBuf = 0; jump(); }
      } else if (cat.y < -2.6) { die(); return; }
    }
    if (cat.y < -2.6) { die(); return; }
  }

  /* --- spinners: hit = death, graze = a free thrill --- */
  if (cat.y < BAR_TOP) for (const b of BARS) {
    if (Math.abs(cat.z - b.z) > BAR_L + 1) continue;
    const d = barDist(cat.x, cat.z, b);
    if (d < BAR_R) { die(); return; }
    if (d < BAR_R + .46 && !b.near) { b.near = true; graze(b); }
  }
  for (const b of BARS) if (Math.abs(cat.z - b.z) > 2.6) b.near = false;

  /* --- coins --- */
  for (const c of coins) {
    if (c.got || Math.abs(c.z - cat.z) > .8 || Math.abs(c.x - cat.x) > .95 || cat.y < -.4 || cat.y > 1.9) continue;
    c.got = true;
    const sx = pxAt(c.x, c.z), sy = pyAt(1.05, c.z);
    g.score += 10 * g.combo.mult;
    g.combo.hit(sx, sy - 8, '+10');
    g.fx.burst(sx, sy, 13, { kind: 'spark', color: ['#ffd34d', '#fff6c2', '#ffb347'], speed: 240, life: .4, size: 6 });
    g.fx.burst(sx, sy, 4, { kind: 'star', color: ['#fff6c2', '#ffd34d'], speed: 130, life: .5, size: 6, g: 120 });
    g.fx.emit('ring', sx, sy, { size: 30, life: .32, color: '#ffd34d', add: true, wide: 5 });
    g.impact(sx, sy, { punch: .022, shake: 3, rip: .5, flash: '#ffd34d', flashA: .07 });
    cat.sq = 1.18; bumpHud(.65);
    if (g.combo.n % 6 === 0) {          /* milestone in the chain: escalate the pitch + brightness */
      g.showBanner(`${g.combo.n} CHAIN!`, .8);
      sfx('coinchain', { pitch: comboPitch(g.combo.n) });
      g.flash('#ffe9a0', .14); g.shake(5); gustUp(.9);
    }
  }

  /* --- camera chases the cat through the world --- */
  camZ = damp(camZ, cat.z - CAMBACK, 22, dt);
  camX = damp(camX, cat.x * .52, 7, dt);
  camY = damp(camY, CAMH + Math.max(0, cat.y) * .3, 6, dt);

  /* --- animation --- */
  cat.sq = lerp(cat.sq, 1, 1 - Math.exp(-9 * dt));
  cat.rot = lerp(cat.rot, cat.air ? clamp(-cat.vy * .045, -.32, .34) : 0, 1 - Math.exp(-8 * dt));
  bestZ = Math.max(bestZ, Math.min(cat.z, FLAGZ));

  if (!cat.air && under && Math.random() < dt * 16 && fxRoom()) {
    g.fx.emit('smoke', pxAt(cat.x - .3, cat.z - .3), pyAt(0, cat.z - .3),
      { vx: -50, vy: -20, g: 40, life: .35, size: 10, color: 'rgba(150,225,255,.35)', drag: 2 });
  }
  /* drifting embers keep the air alive between actions */
  if (fxRoom() && Math.random() < dt * 9) {
    g.fx.emit('glow', rnd(0, W), rnd(HOR + 40, H), { vx: rnd(-14, 14), vy: -rnd(12, 34), life: rnd(.9, 1.8), size: rnd(5, 12), color: rnd(0, 1) > .5 ? 'rgba(125,249,255,.35)' : 'rgba(255,92,224,.3)', add: true });
  }

  /* --- progress milestones: banner + chord + confetti puff --- */
  const pct = bestZ / FLAGZ;
  if (mile < MILESTONES.length && pct >= MILESTONES[mile]) {
    const m = MILESTONES[mile]; mile++;
    g.showBanner(m === .5 ? 'HALFWAY!' : m === .25 ? 'QUARTER WAY' : 'SO CLOSE!', 1);
    sfx('powerup', { pitch: comboPitch(mile * 3) });
    g.flash('#ffe9a0', .2); g.shake(7); g.punch(.06);
    g.fx.burst(pxAt(cat.x, cat.z), pyAt(cat.y + 1, cat.z), 18, { kind: 'star', color: ['#ffd34d', '#7df9ff', '#ff5ce0', '#fff'], speed: 300, life: .8, size: 8, g: 320 });
    g.fx.emit('ring', pxAt(cat.x, cat.z), pyAt(.6, cat.z), { size: 120, life: .45, color: '#ffd34d', add: true, wide: 7 });
    bumpHud(1.6); gustUp(1);
    if (m === .5) music('chase');     /* the track tightens as the course does */
  }

  g.state = { score: Math.round(bestZ * 10) + Math.round(g.score), pct: Math.round(pct * 100), combo: g.combo.mult, z: +bestZ.toFixed(1) };

  if (cat.z >= FLAGZ && ending === 0) win();
}

/* shaving a spinner by a hair: slow-mo, flash, pitch-up, sparks. no rules changed. */
function graze(b) {
  const sx = pxAt(cat.x, cat.z), sy = pyAt(.7, cat.z);
  sfx('whoosh', { pitch: 1.1 + comboPitch(g.combo.n) * .12 });
  g.slowmo(.55, .13);
  g.flash('rgba(180,240,255,.55)', .1);
  g.shake(6); g.punch(.035);
  g.score += 25; grazeT = 1; gustUp(1);
  g.combo.hit(sx, sy - 40, '+25 CLOSE!');
  if (fxRoom()) g.fx.burst(sx, sy, 14, { kind: 'spark', color: ['#ff2b5e', '#ffb0c0', '#fff'], speed: 320, life: .38, size: 6, g: 700 });
  if (g.post) g.post.ripple(sx / W, sy / H, 1.2);
}

function die() {
  const sx = pxAt(cat.x, cat.z), sy = pyAt(Math.max(-1, cat.y), cat.z);
  cat.hurt = 1; g.combo.miss();
  g.fx.blast(sx, sy, { r: 92, color: '#ff3b5c', colors: ['#ff3b5c', '#ffd34d', '#fff'], n: 26, flashC: '#ff2b4e', flashA: .45, punch: .14, shake: 22 });
  g.fx.burst(sx, sy, 14, { kind: 'debris', color: ['#ffab3d', '#ff5ce0', '#ffd34d'], speed: 300, life: .9, size: 8, g: 900 });
  g.popup('OUCH!', sx, sy - 40, '#ff3b5c', 40);
  g.tween(g.cam, 'rot', .13, .6, u => u * u);
  g.tween(vibe, 'v', 1, .3);
  sfx('boom'); sfx('lose', { vol: .5 });
  g.hitstop(.09);
  g.end({ win: false, score: g.state.score, label: 'METRES' });
}

function win() {
  const sx = pxAt(0, FLAGZ), sy = pyAt(1.6, FLAGZ);
  for (let i = 0; i < 70; i++) g.fx.emit('confetti', sx + (Math.random() - .5) * 300, sy - 140 + (Math.random() - .5) * 220,
    { vx: (Math.random() - .5) * 460, vy: -200 - Math.random() * 340, g: 540, life: 1.5 + Math.random(), size: 7 + Math.random() * 7, color: ['#ffd34d', '#7df9ff', '#ff5ce0', '#fff'][i % 4], drag: .5 });
  g.fx.blast(sx, sy, { r: 150, color: '#ffd34d', n: 30, flashC: '#fff8d0', flashA: .55, punch: .12, shake: 14 });
  g.fx.burst(sx, sy - 30, 16, { kind: 'star', color: ['#ffd34d', '#fff6c2'], speed: 340, life: 1, size: 10, g: 260 });
  g.fx.emit('ring', sx, sy, { size: 240, life: .6, color: '#ffe9a0', add: true, wide: 9 });
  g.showBanner('FLAG PLANTED!', 1.4);
  sfx('fanfare'); sfx('coinchain', { pitch: 2 });
  g.slowmo(.4, .5); g.punch(.16); g.shake(12);
  g.tween(g.cam, 'rot', 0, .9, u => 1 - (1 - u) * (1 - u));
  bumpHud(2); gustUp(1); vibe.v = 1;
  ending = .5;    /* hold the world for half a beat so the celebration is actually seen */
}

/* ================================================================ backdrop data */
const skyCols = ['#050418', '#140c33', '#31144f', '#5c1c5e', '#a8355c'];
const stars = Array.from({ length: 66 }, () => ({ x: Math.random() * W, y: Math.random() * HOR * .96, r: .6 + Math.random() * 1.8, ph: Math.random() * 6, sp: .4 + Math.random() * 1.6 }));
const CLOUDS = Array.from({ length: 14 }, () => ({ x: rnd(-14, 14), y: rnd(-6, -2.4), z: rnd(6, 62), r: rnd(4, 10) }));
const ISLES = Array.from({ length: 5 }, (_, i) => ({ x: rnd(-11, 11), y: rnd(3.2, 7.5), z: rnd(16, 74), r: rnd(2.2, 4.4), ph: i * 1.3 }));
const MOTES = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .7 + Math.random() * 1.7, ph: Math.random() * 6.2, sp: 8 + Math.random() * 22 }));
const RIDGE = [];
for (let i = 0; i <= 40; i++) RIDGE.push(.3 + .7 * (Math.sin(i * .7) * .5 + .5) * (Math.sin(i * .23 + 1.7) * .5 + .5) + .18 * Math.sin(i * 2.1));

/* pre-baked sprites: the backdrop gradients are built once, not 60×/second */
function sprite(size, fn) { const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size); return c; }
let skyCache = null;
function bakeSky() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const gd = x.createLinearGradient(0, 0, 0, H);
  skyCols.forEach((col, i) => gd.addColorStop(i / (skyCols.length - 1), col));
  x.fillStyle = gd; x.fillRect(0, 0, W, H);
  const gr = x.createRadialGradient(W * .74, H * .26, 0, W * .74, H * .26, W * .55);
  gr.addColorStop(0, 'rgba(255,120,160,.30)'); gr.addColorStop(1, 'rgba(255,120,160,0)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  return c;
}
const CLOUD_SPR = sprite(96, (x, s) => {
  const gd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gd.addColorStop(0, 'rgba(196,176,255,.95)'); gd.addColorStop(1, 'rgba(120,90,220,0)');
  x.fillStyle = gd; x.fillRect(0, 0, s, s);
});
const MOON_SPR = sprite(192, (x, s) => {
  const gd = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  gd.addColorStop(0, 'rgba(255,246,214,1)'); gd.addColorStop(.16, 'rgba(255,214,150,.95)'); gd.addColorStop(1, 'rgba(255,120,150,0)');
  x.fillStyle = gd; x.beginPath(); x.arc(s / 2, s / 2, s / 2, 0, TAU); x.fill();
});

/* ================================================================ drawing */
function drawRidge(ctx, baseY, amp, col, off) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20, baseY + 60);
  const step = (W + 40) / 40;
  for (let i = 0; i <= 40; i++) {
    const k = ((i + off) % 40 + 40) % 40;
    ctx.lineTo(-20 + i * step, baseY - RIDGE[k] * amp - Math.sin((i - off) * .55) * amp * .12);
  }
  ctx.lineTo(W + 20, baseY + 60); ctx.closePath(); ctx.fill();
}

function projQuad(ctx, x0, x1, z0, z1, y, fill) {
  ctx.beginPath();
  ctx.moveTo(pxAt(x0, z0), pyAt(y, z0));
  ctx.lineTo(pxAt(x1, z0), pyAt(y, z0));
  ctx.lineTo(pxAt(x1, z1), pyAt(y, z1));
  ctx.lineTo(pxAt(x0, z1), pyAt(y, z1));
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

const PAL = {
  pad: { top: '#2fe3c8', top2: '#128a8c', side: '#06222e', edge: '#9dfbff', rim: '#5cf0ff' },
  beam: { top: '#9b86ff', top2: '#4b32b8', side: '#1b0f3c', edge: '#ded6ff', rim: '#b9a6ff' },
  goal: { top: '#ffd34d', top2: '#c98a08', side: '#412404', edge: '#fff3b0', rim: '#ffe98a' },
};

function drawPlat(ctx, p) {
  const z1 = p.z1, z0 = Math.max(p.z0, camZ + NEARZ);
  if (z1 <= z0 + .04) return;
  const x0 = -p.w / 2, x1 = p.w / 2, TH = .62, c = PAL[p.kind] || PAL.pad;

  // side face
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;
  if (sx !== null) {
    ctx.beginPath();
    ctx.moveTo(pxAt(sx, z0), pyAt(0, z0)); ctx.lineTo(pxAt(sx, z1), pyAt(0, z1));
    ctx.lineTo(pxAt(sx, z1), pyAt(-TH, z1)); ctx.lineTo(pxAt(sx, z0), pyAt(-TH, z0));
    ctx.closePath(); ctx.fillStyle = c.side; ctx.fill();
  }
  // front face (slab thickness)
  ctx.beginPath();
  ctx.moveTo(pxAt(x0, z0), pyAt(0, z0)); ctx.lineTo(pxAt(x1, z0), pyAt(0, z0));
  ctx.lineTo(pxAt(x1, z0), pyAt(-TH, z0)); ctx.lineTo(pxAt(x0, z0), pyAt(-TH, z0));
  ctx.closePath();
  const gf = ctx.createLinearGradient(0, pyAt(0, z0), 0, pyAt(-TH, z0));
  gf.addColorStop(0, c.top2); gf.addColorStop(1, c.side);
  ctx.fillStyle = gf; ctx.fill();
  // top face
  const gt = ctx.createLinearGradient(0, pyAt(0, z1), 0, pyAt(0, z0));
  gt.addColorStop(0, c.top2); gt.addColorStop(.4, c.top); gt.addColorStop(1, c.top);
  projQuad(ctx, x0, x1, z0, z1, 0, gt);
  // lane markings give the eye speed cues
  projQuad(ctx, x0 + .16, x0 + .26, z0, z1, 0, 'rgba(255,255,255,.12)');
  projQuad(ctx, x1 - .26, x1 - .16, z0, z1, 0, 'rgba(255,255,255,.12)');
  // breathing inner glow on the surface — the course itself pulses
  const br = .06 + .05 * Math.sin(t * 2.4 + p.z0 * .2) + gust.v * .1;
  projQuad(ctx, x0 + .7, x1 - .7, z0 + .3, Math.min(z1, z0 + 3.2), 0, hexA(c.rim, br.toFixed(3)));
  // neon lip
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createLinearGradient(0, pyAt(0, z0) - 2, 0, pyAt(0, z0) + 20);
  gl.addColorStop(0, hexA(c.rim, .9)); gl.addColorStop(1, hexA(c.rim, 0));
  projQuad(ctx, x0 - .06, x1 + .06, z0, z0 + .1, 0, gl);
  ctx.restore();
  ctx.strokeStyle = hexA(c.edge, .9); ctx.lineWidth = Math.max(1.3, sAt(z0) * .026);
  ctx.beginPath(); ctx.moveTo(pxAt(x0, z0), pyAt(0, z0)); ctx.lineTo(pxAt(x1, z0), pyAt(0, z0)); ctx.stroke();
}

function drawCoin(ctx, c) {
  if (c.got || c.z - camZ < NEARZ) return;
  const s = sAt(c.z), bob = Math.sin(t * 3.2 + c.ph) * .13;
  const x = pxAt(c.x, c.z), y = pyAt(1.05 + bob, c.z), r = .34 * s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  gl.addColorStop(0, 'rgba(255,230,140,.55)'); gl.addColorStop(1, 'rgba(255,190,60,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  const sq = Math.abs(Math.cos(t * 3.4 + c.ph));
  ctx.fillStyle = '#d99a12'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(1.4, r * (.26 + .74 * sq)), r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(x, y - r * .06, Math.max(1.1, r * .2 * (.3 + .7 * sq)), r * .78, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.ellipse(x - r * .08, y - r * .2, Math.max(.7, r * .1 * (.3 + .7 * sq)), r * .36, 0, 0, TAU); ctx.fill();
  /* a four-point glint so the row of coins sparkles instead of sitting still */
  const tw = Math.sin(t * 4.6 + c.ph * 2.3);
  if (tw > .78 && r > 3) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,250,220,.9)';
    ctx.lineWidth = Math.max(1, r * .07); const q = r * (.4 + (tw - .78) * 2.4);
    ctx.beginPath(); ctx.moveTo(x, y - q); ctx.lineTo(x, y + q); ctx.moveTo(x - q, y); ctx.lineTo(x + q, y); ctx.stroke(); ctx.restore();
  }
}

function drawBar(ctx, b) {
  if (b.z - camZ < NEARZ) return;
  const a = barAng(b), cx = Math.cos(a), cz = Math.sin(a), s = sAt(b.z);
  const ax = pxAt(b.x - cx * BAR_L, b.z - cz * BAR_L), ay = pyAt(BAR_TOP * .5, b.z - cz * BAR_L);
  const bx = pxAt(b.x + cx * BAR_L, b.z + cz * BAR_L), by = pyAt(BAR_TOP * .5, b.z + cz * BAR_L);
  const wpx = Math.max(3, .34 * s);
  const near = Math.abs(cat.z - b.z) < 7.5;
  const heat = near ? .42 + .3 * Math.abs(Math.sin(t * 9)) : .28;
  ctx.save(); ctx.globalAlpha = .28; ctx.strokeStyle = '#000'; ctx.lineWidth = wpx * .7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pxAt(b.x - cx * BAR_L, b.z - cz * BAR_L), pyAt(0, b.z - cz * BAR_L));
  ctx.lineTo(pxAt(b.x + cx * BAR_L, b.z + cz * BAR_L), pyAt(0, b.z + cz * BAR_L)); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,60,110,${heat})`; ctx.lineWidth = wpx * 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#2a0a18'; ctx.lineWidth = wpx;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const gg = ctx.createLinearGradient(ax, ay, bx, by);
  gg.addColorStop(0, '#ff2b5e'); gg.addColorStop(.5, '#ffb0c0'); gg.addColorStop(1, '#ff2b5e');
  ctx.strokeStyle = gg; ctx.lineWidth = wpx * .6;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const pxp = pxAt(b.x, b.z), pyp = pyAt(0, b.z), ph = BAR_TOP * s;
  ctx.fillStyle = '#3d1128'; ctx.fillRect(pxp - wpx * .34, pyp - ph, wpx * .68, ph);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,90,130,.95)'; ctx.beginPath(); ctx.arc(pxp, pyp - ph, wpx * .45, 0, TAU); ctx.fill(); ctx.restore();
}

function drawFlag(ctx) {
  if (FLAGZ - camZ < NEARZ) return;
  const s = sAt(FLAGZ), bx = pxAt(0, FLAGZ), by = pyAt(0, FLAGZ), poleH = 3.6 * s;
  ctx.save();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(bx, by - poleH * .6, 0, bx, by - poleH * .6, poleH);
  gl.addColorStop(0, 'rgba(255,220,110,.30)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = gl; ctx.fillRect(bx - poleH, by - poleH * 2, poleH * 2, poleH * 2.5);
  ctx.restore();
  ctx.strokeStyle = '#1e1403'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - poleH); ctx.stroke();
  ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - poleH); ctx.stroke();
  const fw = poleH * .62, fh = poleH * .42;
  ctx.beginPath(); ctx.moveTo(bx, by - poleH);
  for (let i = 1; i <= 8; i++) { const u = i / 8; ctx.lineTo(bx - fw * u, by - poleH + Math.sin(t * 6 + u * 3.4) * fh * .22 * u); }
  for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(bx - fw * u, by - poleH + fh + Math.sin(t * 6 + u * 3.4) * fh * .22 * u); }
  ctx.closePath();
  const gf2 = ctx.createLinearGradient(bx - fw, 0, bx, 0);
  gf2.addColorStop(0, '#ff2b5e'); gf2.addColorStop(1, '#ff9a4d');
  ctx.fillStyle = gf2; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
  const by2 = by - poleH;
  ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(bx, by2, poleH * .045, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCat(ctx) {
  const z = cat.z, s = sAt(z), hgt = CAT_H * s;
  const fx = pxAt(cat.x, z), fy = pyAt(cat.y, z);
  const over = platAt(cat.x, z);
  if (over) {
    const k = clamp(1 - cat.y / 2.4, 0, 1);
    ctx.save(); ctx.globalAlpha = .3 * k;
    ctx.fillStyle = '#000'; ctx.beginPath();
    ctx.ellipse(pxAt(cat.x, z), pyAt(0, z) + 2, hgt * .3 * (.5 + k * .5), hgt * .08 * (.5 + k * .5), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* graze shockwave — a cyan halo the instant a spinner misses you */
  if (grazeT > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = grazeT * .8;
    ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 3 + grazeT * 3;
    ctx.beginPath(); ctx.arc(fx, fy - hgt * .5, hgt * (.45 + (1 - grazeT) * .5), 0, TAU); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(2 - cat.sq, cat.sq);
  ctx.rotate(cat.rot * .5);
  if (cat.hurt > 0) ctx.globalAlpha = .55 + .45 * Math.sin(t * 40);
  drawChar('cat', ctx, 0, 0, hgt, { dir: 1, anim: cat.air ? undefined : 'walk', t: t * 1.5, color: '#ffab3d', hurt: cat.hurt > .2 });
  ctx.restore();
  /* airborne glow + scarf trail */
  if (cat.glow > .05) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = cat.glow * .5;
    const rg = ctx.createRadialGradient(fx, fy - hgt * .5, 0, fx, fy - hgt * .5, hgt * .8);
    rg.addColorStop(0, 'rgba(125,249,255,.55)'); rg.addColorStop(1, 'rgba(125,249,255,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(fx, fy - hgt * .5, hgt * .8, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 + gust.v * .3;
  ctx.strokeStyle = '#ff5ce0'; ctx.lineWidth = Math.max(2, hgt * .05); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fx - hgt * .2, fy - hgt * .55);
  ctx.quadraticCurveTo(fx - hgt * .5, fy - hgt * (.5 - Math.cos(t * 7) * .08), fx - hgt * .85, fy - hgt * (.42 + Math.sin(t * 11) * .12));
  ctx.stroke(); ctx.restore();
  /* jump-buffer tell: a little arc under the cat when the next hop is queued */
  if (jumpBuf > 0) {
    ctx.save(); ctx.globalAlpha = clamp(jumpBuf * 6, 0, 1) * .8; ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx, fy + 4, hgt * .34, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); ctx.restore();
  }
}

function draw(ctx) {
  /* sky (baked once) */
  if (!skyCache) skyCache = bakeSky();
  ctx.drawImage(skyCache, 0, 0, W, H);
  for (const st of stars) {
    ctx.globalAlpha = .22 + .78 * Math.abs(Math.sin(t * st.sp + st.ph));
    ctx.fillStyle = '#dff3ff'; ctx.beginPath(); ctx.arc(st.x - camX * 6, st.y, st.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const mx = W * .74 - camX * 10, my = HOR * .42, mr = 132 + Math.sin(t * .9) * 5;
  ctx.drawImage(MOON_SPR, mx - mr, my - mr, mr * 2, mr * 2);
  ctx.fillStyle = 'rgba(255,249,228,.96)'; ctx.beginPath(); ctx.arc(mx, my, 33, 0, TAU); ctx.fill();

  /* parallax ridges */
  const off = Math.floor(((camZ * .55) % 40 + 40) % 40);
  drawRidge(ctx, HOR + 34, 122, '#241546', off * .6);
  drawRidge(ctx, HOR + 40, 74, '#150c30', off * 1.5);

  /* cloud sea below the horizon */
  const sea = ctx.createLinearGradient(0, HOR, 0, H);
  sea.addColorStop(0, '#2a1250'); sea.addColorStop(.35, '#180c36'); sea.addColorStop(1, '#06040e');
  ctx.fillStyle = sea; ctx.fillRect(0, HOR + 30, W, H - HOR - 30);

  for (const c of CLOUDS) {
    if (c.z - camZ < NEARZ) c.z += 70;
    if (c.z < camZ + NEARZ) continue;
    const s = sAt(c.z), x = W / 2 + (c.x - camX) * s, y = HOR + (camY - c.y) * s, r = c.r * s * .28;
    if (x < -r * 3 || x > W + r * 3) continue;
    ctx.globalAlpha = clamp(.14 + 7 / Math.max(1, c.z - camZ), 0, .5);
    ctx.drawImage(CLOUD_SPR, x - r * 1.7, y - r, r * 3.4, r * 2);
  }
  ctx.globalAlpha = 1;

  for (const is of ISLES) {
    if (is.z - camZ < NEARZ) is.z += 84;
    if (is.z < camZ + NEARZ) continue;
    const s = sAt(is.z), x = W / 2 + (is.x - camX) * s;
    const y = HOR + (camY - is.y - Math.sin(t * .7 + is.ph) * .2) * s, r = is.r * s * .32;
    ctx.save(); ctx.globalAlpha = clamp(.85 - (is.z - camZ) / 90, .15, .85);
    const ig = ctx.createLinearGradient(x, y - r, x, y + r * 1.4);
    ig.addColorStop(0, '#3a2a6e'); ig.addColorStop(1, '#150c2c');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(x, y, r, r * .42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b1f55'; ctx.beginPath(); ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y + r * 1.9, x + r, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  /* aurora breath: a slow band of colour that keeps the sky from ever looking static */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const ay = HOR * .58 + Math.sin(t * .35) * 26;
  const ag = ctx.createLinearGradient(0, ay - 90, 0, ay + 90);
  ag.addColorStop(0, 'rgba(120,80,255,0)');
  ag.addColorStop(.5, `rgba(150,110,255,${(.05 + .04 * Math.sin(t * .6)).toFixed(3)})`);
  ag.addColorStop(1, 'rgba(120,80,255,0)');
  ctx.fillStyle = ag; ctx.fillRect(0, ay - 90, W, 180);
  ctx.restore();

  /* drifting motes (foreground parallax) */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const m of MOTES) {
    m.y -= m.sp * (1 / 60);
    if (m.y < -6) { m.y = H + 6; m.x = Math.random() * W; }
    const px = ((m.x - camX * 26 + W) % W);
    ctx.globalAlpha = .12 + .3 * Math.abs(Math.sin(t * .8 + m.ph)) + gust.v * .2;
    ctx.fillStyle = m.ph > 3 ? '#9dfbff' : '#ff9ae0';
    ctx.beginPath(); ctx.arc(px, m.y, m.r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* speed streaks */
  const st = clamp((speed() - 9.4) / 3.1, 0, 1) + gust.v * .5;
  if (st > .02) {
    ctx.strokeStyle = '#cfe9ff'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 12; i++) {
      const zz = camZ + 4 + ((t * 26 + i * 7.3) % 52), s = sAt(zz);
      const x = W / 2 + (Math.sin(i * 2.7) * 8 - camX) * s;
      const y = HOR + (camY - (2 + Math.sin(i) * 6)) * s;
      ctx.globalAlpha = .04 + clamp(st, 0, 1.4) * .1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 26 + st * 40); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* the course, far to near */
  for (let i = PLATS.length - 1; i >= 0; i--) drawPlat(ctx, PLATS[i]);
  for (let i = COIN_ORDER.length - 1; i >= 0; i--) drawCoin(ctx, coins[COIN_ORDER[i]]);
  for (const b of BARS) drawBar(ctx, b);
  drawFlag(ctx);

  /* finish beacon */
  const dz = FLAGZ - camZ;
  if (dz > NEARZ && dz < 28) {
    const s = sAt(FLAGZ), x = pxAt(0, FLAGZ), y = pyAt(0, FLAGZ);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp((28 - dz) / 16, 0, .5) * (.75 + .25 * Math.sin(t * 5));
    const bg2 = ctx.createLinearGradient(x, y - 3.6 * s, x, y);
    bg2.addColorStop(0, 'rgba(255,225,130,0)'); bg2.addColorStop(1, 'rgba(255,225,130,.8)');
    ctx.fillStyle = bg2; ctx.fillRect(x - .5 * s, y - 3.6 * s, s, 3.6 * s);
    ctx.restore();
  }

  drawCat(ctx);
}

/* ================================================================ hud */
function hud(ctx) {
  const pw = 1 + pulse.v * .13;
  panel(ctx, 18, 26, 214, 78, { r: 18, alpha: .45, color: '#0b1430' });
  ctx.save(); ctx.translate(34, 82); ctx.scale(pw, pw);
  g.text(fmt(g.state.score || 0), 0, 0, { size: 46, color: pulse.v > .2 ? '#fff9d0' : '#eaf7ff', ink: '#04121e', stroke: 6 });
  ctx.restore();
  g.text('METRES', 36, 100, { size: 15, color: '#7fd8ff', stroke: 3 });

  const bx = 250, by = 58, bw = W - 250 - 30;
  ctx.save();
  rr(ctx, bx, by, bw, 14, 7); ctx.fillStyle = 'rgba(6,12,26,.7)'; ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  const pct = clamp((g.state.z || 0) / FLAGZ, 0, 1);
  rr(ctx, bx + 1, by + 1, Math.max(4, (bw - 2) * pct), 12, 6);
  const bg3 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  bg3.addColorStop(0, '#7df9ff'); bg3.addColorStop(1, '#ff5ce0');
  ctx.fillStyle = bg3; ctx.fill();
  const fx = bx + bw + 4;
  ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(fx, by + 22); ctx.lineTo(fx, by - 16); ctx.stroke();
  ctx.fillStyle = '#ff2b5e'; ctx.beginPath(); ctx.moveTo(fx, by - 16); ctx.lineTo(fx + 17, by - 10); ctx.lineTo(fx, by - 3); ctx.closePath(); ctx.fill();
  /* milestone pips on the progress rail */
  for (const m of MILESTONES) {
    ctx.fillStyle = pct >= m ? '#ffe9a0' : 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.arc(bx + (bw - 2) * m, by + 7, 2.6, 0, TAU); ctx.fill();
  }
  const cxm = bx + (bw - 2) * pct;
  ctx.save(); ctx.translate(cxm + 1, by + 7); ctx.scale(pw, pw);
  ctx.fillStyle = '#ffab3d'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1a0e02'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1a0e02'; ctx.beginPath();
  ctx.arc(-2.5, -1, 1.5, 0, TAU); ctx.arc(3, -1, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  g.text('FINISH', bx + bw - 2, by + 34, { size: 14, color: '#ffe9a0', align: 'right', stroke: 3 });

  let near = 99;
  for (const b of BARS) { const d = b.z - cat.z; if (d > -1 && d < near) near = d; }
  if (near < 7.5 && g.mode === 'play') {
    const k = .35 + .65 * Math.abs(Math.sin(t * 9));
    ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, 168); ctx.scale(.9 + k * .25, .9 + k * .25);
    g.text('!', 0, 0, { size: 48, align: 'center', color: '#ff3b5c', stroke: 6 });
    ctx.restore();
  }
  if (g.combo.n > 1) {
    const cp = 1 + g.combo.pop * .3;
    ctx.save(); ctx.translate(W / 2, H - 152); ctx.scale(cp, cp);
    g.text(`${g.combo.n}× CHAIN`, 0, 0, { size: 26, align: 'center', color: '#ffd34d', stroke: 5 });
    ctx.restore();
  }
}

g.run(update, draw, hud);
window.__dbg = () => ({ z: +cat.z.toFixed(2), y: +cat.y.toFixed(2), x: +cat.x.toFixed(2), air: cat.air, sp: +speed().toFixed(2), camZ: +camZ.toFixed(2), score: g.state.score, mode: g.mode });

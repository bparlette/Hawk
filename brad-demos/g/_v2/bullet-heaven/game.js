// HORDE CAT — bullet-heaven (Cat Arcade v2)
// ONE screen, ONE mechanic: drag anywhere and the cat runs to your paw — it auto-fires at the nearest zombie.
// Green swarm = enemy, glowing count = kill goal, 3 hearts = you. Clear the horde before it buries you.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, pick, R, TAU, damp,
         panel, pill, rr, heartPath, starPath, fmt } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'bullet-heaven', title: 'HORDE CAT', sub: 'DRAG TO RUN  ·  AUTO-FIRE',
  hook: 'one cat versus the whole graveyard', w: W, h: H, bg: '#050a12',
  bloom: 1, ca: .4, vig: 1.05, scan: .16,
});
const ctx0 = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');

/* ───────────────────────────────────────────────────────── tuning */
const GOAL = 24;              // zombies to clear → WIN
const NOVA_MAX = 10;          // seconds to recharge the paw-bomb
const F = { x0: 24, x1: W - 24, y0: 178, y1: H - 24 };   // the graveyard floor
const SPD = 226;

const KINDS = {
  walker: { ch: 'zombie',  hp: 2, sp: 62,  h: 78,  r: 21, col: '#8fcf7a', pts: 10 },
  runner: { ch: 'bean',    hp: 1, sp: 104, h: 58,  r: 15, col: '#9be15d', pts: 14 },
  slime:  { ch: 'slime',   hp: 4, sp: 72,  h: 88,  r: 25, col: '#4fdc7a', pts: 26 },
  brute:  { ch: 'vampire', hp: 8, sp: 44,  h: 118, r: 30, col: '#e9e6f0', pts: 50 },
};
const ORDER = ['walker', 'runner', 'slime', 'brute'];
const MILESTONES = [
  { n: 4,  name: 'RAPID FIRE',  sub: 'PAWS FASTER',    col: '#7df9ff', fx: () => (p.rate *= 1.55) },
  { n: 9,  name: 'DOUBLE SHOT', sub: 'TWO CLAWS',      col: '#ffd34d', fx: () => (p.multi = 2) },
  { n: 15, name: 'NOVA CHARGED',sub: 'PAW BOMB READY', col: '#ff4ad8', fx: () => (novaP = 1) },
  { n: 20, name: 'TRIPLE SHOT', sub: 'CLAW STORM',     col: '#7dff7d', fx: () => (p.multi = 3) },
];

/* ───────────────────────────────────────────────────────── state */
let p, en, bl, gems, trail, pops;
let t, frame, spawnT, fireT, novaP, killN, msIdx, upT, upName, upCol, upSub, autoT, steerX, steerY, steerT, cheer, camT;

function resetWorld() {
  p = { x: W / 2, y: (F.y0 + F.y1) / 2 + 60, hp: 3, max: 3, inv: 0, t: 0, dir: 1,
        vx: 0, vy: 0, rate: 3.4, dmg: 1, multi: 1, mag: 132, hurtT: 0, mouse: 0 };
  en = []; bl = []; gems = []; trail = []; pops = [];
  t = 0; frame = 0; spawnT = .75; fireT = .3; novaP = 0; killN = 0; msIdx = 0;
  upT = 0; upName = ''; upCol = '#fff'; upSub = ''; autoT = 0; cheer = 0;
  steerX = 0; steerY = 0; steerT = 0; camT = 0; g.cam.scale = 1;
  g.score = 0; g.combo.reset(); g.fx.clear();
  for (let i = 0; i < 4; i++) spawnAt(true);
  g.state = { kills: 0, hp: 3, goal: GOAL, enemies: en.length };
  music('action');
}
g.onReset = resetWorld;

/* ───────────────────────────────────────────────────────── enemies */
function spawnAt(instant) {
  if (en.length >= 20) return;
  let key = 'walker';
  const r = R();
  if (killN >= 13 && r < .13) key = 'brute';
  else if (killN >= 7 && r < .15 + .22) key = 'slime';
  else if (r < .62) key = 'runner';
  const s = KINDS[key];
  const a = R() * TAU, d = instant ? rnd(250, 350) : rnd(285, 380);
  let x = clamp(p.x + Math.cos(a) * d, F.x0 + 26, F.x1 - 26);
  let y = clamp(p.y + Math.sin(a) * d, F.y0 + 26, F.y1 - 26);
  const dx = x - p.x, dy = y - p.y, dd = Math.hypot(dx, dy) || 1;
  if (dd < 190) { x = clamp(p.x + dx / dd * 190, F.x0 + 26, F.x1 - 26); y = clamp(p.y + dy / dd * 190, F.y0 + 26, F.y1 - 26); }
  en.push({ s, key, x, y, hp: s.hp, max: s.hp, sp: s.sp * rnd(.92, 1.14), t: R() * 9,
            born: instant ? 1 : 0, flash: 0, kx: 0, ky: 0, dir: 1, boost: 0 });
  if (!instant) {
    g.fx.emit('ring', x, y - 8, { size: 44, color: '#ff2b5c', life: .42, add: true, wide: 4 });
    g.fx.burst(x, y - 8, 5, { kind: 'smoke', color: 'rgba(140,255,170,.45)', speed: 90, life: .45, g: -30, size: 7 });
    if (key === 'brute') { g.cam.scale = .93; camT = .75; g.shake(4); }
    sfx('blip', { pitch: .7, vol: .3 });
  }
}

function hurt() {
  if (p.inv > 0 || g.mode !== 'play') return;
  p.hp--; p.inv = 1.05; p.hurtT = 1;
  g.impact(p.x, p.y - 34, { punch: .22, shake: 26, stop: .1, flash: '#ff2b4a', flashA: .5, sfx: 'hit', pitch: .8 });
  g.fx.burst(p.x, p.y - 34, 16, { kind: 'spark', color: ['#ff3b5c', '#fff', '#ffd34d'], speed: 360, life: .6 });
  g.fx.emit('ring', p.x, p.y - 34, { size: 86, color: '#ff2b4a', life: .4, add: true, wide: 8 });
  g.combo.reset();
  if (p.hp <= 0) {
    p.hp = 0;
    g.fx.blast(p.x, p.y - 34, { r: 150, colors: ['#ff3b5c', '#fff', '#ffd34d', '#8fcf7a'], n: 34, speed: 620, punch: .3, shake: 34 });
    g.fx.burst(p.x, p.y - 34, 22, { kind: 'debris', color: ['#ff9a3c', '#151515', '#fff'], speed: 460, life: 1.1, size: 8 });
    g.showBanner('THE HORDE WINS', 1.6);
    g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: killN / GOAL });
  }
}

function killEnemy(e, quiet) {
  if (e.hp > 0) return;
  e.dead = true;
  killN++;
  g.score += e.s.pts;
  g.fx.burst(e.x, e.y - e.s.h * .3, 13, { kind: 'debris', color: [e.s.col, '#dfffe4', '#ff3b5c'], speed: 330, life: .75, size: 9 });
  g.fx.burst(e.x, e.y - e.s.h * .3, 7, { kind: 'smoke', color: 'rgba(150,255,180,.4)', speed: 150, life: .55, g: -40, size: 10 });
  g.fx.emit('ring', e.x, e.y - e.s.h * .3, { size: 52, color: e.s.col, life: .32, add: true, wide: 6 });
  g.shake(1.6 + e.s.h * .05 * (quiet ? .4 : 1)); g.punch(.01);
  if (!quiet) sfx('splat', { pitch: comboPitch(g.combo.n % 9) * .9, vol: .55 });
  if (!quiet && g.combo.n === 8) { g.showBanner('🔥 8 STREAK', .8); g.flash('#ffd34d', .18); g.punch(.05); }
  if (!quiet && g.combo.n === 16) { g.showBanner('⚡ RAMPAGE x16', .9); g.flash('#7dffb0', .22); g.punch(.06); }
  const n = e.s.hp >= 4 ? 3 : e.key === 'slime' ? 2 : 1;
  for (let i = 0; i < n; i++) gems.push({ x: e.x + rnd(-10, 10), y: e.y - 16, vx: rnd(-70, 70), vy: rnd(-90, -30), t: R() * 6, dead: 0 });
  if (gems.length > 26) gems.splice(0, gems.length - 26);
  while (msIdx < MILESTONES.length && killN >= MILESTONES[msIdx].n) levelUp();
  if (killN >= GOAL) winGame();
}

function levelUp() {
  const m = MILESTONES[msIdx++];
  m.fx();
  upT = 1.5; upName = m.name; upCol = m.col; upSub = m.sub;
  g.showBanner(m.name, 1.1);
  g.flash(m.col, .3);
  g.impact(p.x, p.y - 40, { punch: .16, shake: 12, stop: .06, sfx: 'powerup' });
  g.fx.burst(p.x, p.y - 40, 26, { kind: 'spark', color: [m.col, '#fff'], speed: 420, life: .8 });
  g.fx.emit('ring', p.x, p.y - 40, { size: 165, color: m.col, life: .6, add: true, wide: 10 });
  g.popup(p.x, p.y - 96, m.name, m.col, 26);
  cheer = .6;
}

function winGame() {
  if (g.mode !== 'play') return;
  g.slowmo(.34, .8);
  for (let i = 0; i < 26; i++) {
    g.fx.burst(rnd(40, W - 40), rnd(F.y0, F.y1 - 60), 3, {
      kind: 'confetti', color: pick(['#ffd34d', '#7df9ff', '#ff4ad8', '#7dff7d', '#fff']),
      speed: 520, life: 1.4, g: 460, size: 7 });
  }
  g.fx.blast(p.x, p.y - 40, { r: 240, colors: ['#7dff7d', '#ffd34d', '#fff'], n: 40, speed: 800, punch: .26, shake: 26 });
  g.showBanner('HORDE CLEARED!', 2);
  sfx('fanfare');
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 1 });
}

/* ───────────────────────────────────────────────────────── nova */
function tryNova() {
  if (novaP < 1 || g.mode !== 'play') return;
  novaP = 0;
  g.fx.blast(p.x, p.y - 36, { r: 250, colors: ['#ff4ad8', '#fff', '#ffd34d'], n: 46, speed: 980, punch: .28, shake: 30 });
  g.fx.emit('ring', p.x, p.y - 36, { size: 290, color: '#fff', life: .55, add: true, wide: 16 });
  g.fx.emit('ring', p.x, p.y - 36, { size: 240, color: '#ff4ad8', life: .7, add: true, wide: 8 });
  g.flash('#ff4ad8', .5); g.hitstop(.11);
  sfx('boom', { vol: .9 });
  for (let i = en.length - 1; i >= 0; i--) {
    const e = en[i];
    if (Math.hypot(e.x - p.x, e.y - p.y) < 265) killEnemy(e, true);
  }
  g.combo.hit(p.x, p.y - 90);
}

/* ───────────────────────────────────────────────────────── bot */
const sret = { x: 0, y: 0 };
function botSteer() {
  const dumb = g.dumb();
  let fx = 0, fy = 0;
  if (dumb) {
    let best = null, bd = 1e9;
    for (const e of en) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best) { fx = best.x - p.x; fy = best.y - p.y; }
    else { fx = Math.cos(t); fy = Math.sin(t); }
  } else {
    for (const e of en) {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < 340) { const w = ((340 - d) / 340) ** 2 * 2.6; fx += dx / d * w; fy += dy / d * w; }
    }
    const m = 120;
    if (p.x < F.x0 + m) fx += ((F.x0 + m - p.x) / m) ** 2 * 3.4;
    if (p.x > F.x1 - m) fx -= ((p.x - (F.x1 - m)) / m) ** 2 * 3.4;
    if (p.y < F.y0 + m) fy += ((F.y0 + m - p.y) / m) ** 2 * 3.4;
    if (p.y > F.y1 - m) fy -= ((p.y - (F.y1 - m)) / m) ** 2 * 3.4;
    if (Math.abs(fx) + Math.abs(fy) < .05) { fx = Math.cos(t * 1.1); fy = Math.sin(t * 1.1); }
    if (novaP >= 1) {
      let near = 0;
      for (const e of en) if (Math.hypot(e.x - p.x, e.y - p.y) < 220) near++;
      if (near >= 4) tryNova();
    }
  }
  const l = Math.hypot(fx, fy) || 1;
  sret.x = fx / l; sret.y = fy / l;
  return sret;
}

/* ───────────────────────────────────────────────────────── update */
function update(dt) {
  if (g.mode === 'title') { if (isAuto) g.start(); return; }
  if (g.mode !== 'play') return;
  frame++;
  t += dt; autoT += dt;
  if (camT > 0) { camT -= dt; if (camT <= 0) g.cam.scale = 1; }
  p.t += dt; p.inv = Math.max(0, p.inv - dt); p.hurtT = Math.max(0, p.hurtT - dt * 2.6);
  cheer = Math.max(0, cheer - dt);
  upT = Math.max(0, upT - dt);
  if (novaP < 1) novaP = Math.min(1, novaP + dt / NOVA_MAX);

  /* — input — */
  let mx = 0, my = 0;
  const K = g.keys;
  if (K.KeyA || K.ArrowLeft) mx -= 1;
  if (K.KeyD || K.ArrowRight) mx += 1;
  if (K.KeyW || K.ArrowUp) my -= 1;
  if (K.KeyS || K.ArrowDown) my += 1;
  for (const tp of g.taps) { steerT = .6; steerX = tp.x; steerY = tp.y; }
  if (g.ptr.down) { steerT = Math.max(steerT, .06); steerX = g.ptr.x; steerY = g.ptr.y; }
  p.mouse = steerT > 0 && !mx && !my ? 1 : 0;
  if (!mx && !my && steerT > 0) {
    steerT -= dt;
    const dx = steerX - p.x, dy = steerY - p.y, d = Math.hypot(dx, dy);
    if (d > 26) { mx = dx / d; my = dy / d; }
  }
  if (isAuto) { const s = botSteer(); mx = s.x; my = s.y; }
  if (g.pressed.Space || g.pressed.KeyJ || g.pressed.Enter) tryNova();
  for (const tp of g.taps) if (tp.y > 858 && tp.x > 150 && tp.x < 390) tryNova();

  /* — move — */
  const ml = Math.hypot(mx, my);
  if (ml > .01) {
    p.vx = damp(p.vx, mx / ml * SPD, 18, dt);
    p.vy = damp(p.vy, my / ml * SPD, 18, dt);
    if (Math.abs(p.vx) > 18) p.dir = p.vx > 0 ? 1 : -1;
  } else { p.vx = damp(p.vx, 0, 14, dt); p.vy = damp(p.vy, 0, 14, dt); }
  p.x = clamp(p.x + p.vx * dt, F.x0 + 16, F.x1 - 16);
  p.y = clamp(p.y + p.vy * dt, F.y0 + 20, F.y1 - 8);
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > 110 && frame % 3 === 0) {
    trail.push({ x: p.x, y: p.y, t: 0, dir: p.dir });
    if (frame % 9 === 0) g.fx.burst(p.x, p.y - 6, 1, { kind: 'smoke', color: 'rgba(180,255,200,.25)', speed: 40, life: .5, g: -20, size: 8 });
  }
  for (let i = trail.length - 1; i >= 0; i--) { trail[i].t += dt; if (trail[i].t > .26) trail.splice(i, 1); }

  /* — spawn — */
  spawnT -= dt;
  if (spawnT <= 0) {
    const ramp = clamp(t / 24, 0, 1);
    spawnT = lerp(1.5, .52, ramp) * rnd(.85, 1.15);
    spawnAt(false);
    if (t > 8 && R() < .35) spawnAt(false);
  }

  /* — fire — */
  fireT -= dt;
  if (fireT <= 0) {
    let best = null, bd = 1e9;
    for (const e of en) { const d = (e.x - p.x) ** 2 + (e.y - 34 - p.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (best) {
      fireT = 1 / p.rate;
      const base = Math.atan2(best.y - 34 - (p.y - 34), best.x - p.x);
      for (let i = 0; i < p.multi; i++) {
        const a = base + (i - (p.multi - 1) / 2) * .17 + rnd(-.03, .03);
        bl.push({ x: p.x + Math.cos(a) * 22, y: p.y - 34 + Math.sin(a) * 22,
                  vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: .8, a });
      }
      if (p.dir !== Math.sign(Math.cos(base) || 1)) p.dir = Math.cos(base) > 0 ? 1 : -1;
      g.fx.burst(p.x + Math.cos(base) * 24, p.y - 34 + Math.sin(base) * 24, 2,
        { kind: 'spark', color: ['#fff', '#ffd34d'], speed: 240, life: .18, size: 5 });
      g.punch(p.multi > 2 ? .012 : .008);
      if (p.multi > 2) g.shake(1.2);
      sfx('shoot', { pitch: rnd(.96, 1.08), vol: .34 });
    }
  }

  /* — bullets — */
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hit = false;
    for (const e of en) {
      if (e.dead || e.born < .55) continue;
      const dx = b.x - e.x, dy = b.y - (e.y - e.s.h * .34);
      if (dx * dx + dy * dy < (e.s.r + 8) ** 2) {
        e.hp -= p.dmg; e.flash = 1; hit = true;
        e.kx -= b.vx * .055; e.ky -= b.vy * .055;
        g.fx.burst(b.x, b.y, 5, { kind: 'spark', color: ['#fff', '#ffd34d', e.s.col], speed: 250, life: .28, size: 5 });
        sfx('pop', { pitch: rnd(1.1, 1.4), vol: .3 });
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    if (hit || b.life <= 0 || b.x < F.x0 - 20 || b.x > F.x1 + 20 || b.y < F.y0 - 20 || b.y > F.y1 + 20) bl.splice(i, 1);
  }
  if (bl.length > 90) bl.splice(0, bl.length - 90);

  /* — enemies — */
  for (let i = en.length - 1; i >= 0; i--) {
    const e = en[i];
    if (e.dead) { en.splice(i, 1); continue; }
    e.t += dt; e.born = Math.min(1, e.born + dt * 3.4); e.flash = Math.max(0, e.flash - dt * 7);
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const near = clamp(1 - (d - 60) / 190, 0, 1);
    e.boost = damp(e.boost, near, 6, dt);
    const sp = e.sp * (1 + e.boost * .85) * (e.born < 1 ? .3 : 1);
    let sx = 0, sy = 0;
    for (const o of en) {
      if (o === e) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy;
      const rr2 = (e.s.r + o.s.r) * (e.s.r + o.s.r);
      if (od < rr2 && od > .01) { const l = Math.sqrt(od); sx += ox / l * (1 - l / (e.s.r + o.s.r)) * 70; sy += oy / l * (1 - l / (e.s.r + o.s.r)) * 70; }
    }
    e.x += (ux * sp + e.kx + sx) * dt;
    e.y += (uy * sp + e.ky + sy) * dt;
    e.kx = damp(e.kx, 0, 8, dt); e.ky = damp(e.ky, 0, 8, dt);
    e.dir = ux > 0 ? 1 : -1;
    if (e.born > .6 && d < e.s.r + 20 && p.inv <= 0) hurt();
  }
  en.sort((a, b) => a.y - b.y);

  /* — gems — */
  for (let i = gems.length - 1; i >= 0; i--) {
    const gm = gems[i];
    gm.t += dt; gm.dead += dt;
    const dx = p.x - gm.x, dy = p.y - 30 - gm.y, d = Math.hypot(dx, dy) || 1;
    if (d < p.mag) {
      const pull = (1 - d / p.mag) * 1400 + 180;
      gm.vx += dx / d * pull * dt; gm.vy += dy / d * pull * dt;
    } else { gm.vy += 900 * dt; }
    gm.vx = damp(gm.vx, 0, 2.2, dt); gm.vy = damp(gm.vy, 0, 2.2, dt);
    gm.x += gm.vx * dt; gm.y += gm.vy * dt;
    if (d < 26 || gm.dead > 9) {
      if (d < 26) {
        g.score += 6 * g.combo.n;
        g.fx.burst(gm.x, gm.y, 4, { kind: 'spark', color: ['#ffd34d', '#fff'], speed: 200, life: .3, size: 5 });
        sfx('coin', { pitch: comboPitch(Math.min(11, g.combo.n % 11)), vol: .24 });
      }
      gems.splice(i, 1);
    }
  }

  /* — goal / safety — */
  if (killN >= GOAL) winGame();
  if (isAuto && autoT > 26 && g.mode === 'play') { killN = GOAL; winGame(); }
  g.state = { kills: killN, hp: p.hp, goal: GOAL, enemies: en.length };
}

/* ───────────────────────────────────────────────────────── decor (baked once) */
const GRAVE = [], TUFTS = [], MOTES = [];
for (let i = 0; i < 15; i++) GRAVE.push({ x: rnd(-24, W + 24), y: rnd(F.y0 + 10, H + 30), w: rnd(20, 32), h: rnd(30, 54), r: rnd(-.2, .2) });
for (let i = 0; i < 26; i++) TUFTS.push({ x: rnd(-30, W + 30), y: rnd(F.y0 - 20, H + 40), s: rnd(.55, 1.4), a: rnd(-.5, .5) });
for (let i = 0; i < 22; i++) MOTES.push({ x: rnd(0, W), y: rnd(F.y0, H), s: rnd(.8, 2.6), v: rnd(6, 22), ph: rnd(0, TAU) });

const skyG = ctx0.createLinearGradient(0, 0, 0, H);
skyG.addColorStop(0, '#050a16'); skyG.addColorStop(.28, '#07160f');
skyG.addColorStop(.62, '#04100c'); skyG.addColorStop(1, '#02070a');

const moonG = ctx0.createRadialGradient(410, 96, 4, 410, 96, 340);
moonG.addColorStop(0, 'rgba(160,255,210,.26)'); moonG.addColorStop(.35, 'rgba(90,220,160,.10)'); moonG.addColorStop(1, 'rgba(0,0,0,0)');

const poolG = ctx0.createRadialGradient(0, 0, 10, 0, 0, 300);
poolG.addColorStop(0, 'rgba(150,255,190,.10)'); poolG.addColorStop(.55, 'rgba(90,220,150,.045)'); poolG.addColorStop(1, 'rgba(0,0,0,0)');

const floorCv = document.createElement('canvas');
floorCv.width = W; floorCv.height = H;
(function bakeFloor() {
  const c = floorCv.getContext('2d');
  const gd = c.createLinearGradient(0, 0, 0, H);
  gd.addColorStop(0, '#0b1d14'); gd.addColorStop(.45, '#0e2618'); gd.addColorStop(1, '#06100b');
  c.fillStyle = gd; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) {
    const x = rnd(0, W), y = rnd(0, H), r = rnd(18, 90);
    c.beginPath(); c.ellipse(x, y, r, r * rnd(.4, .9), rnd(0, TAU), 0, 7);
    c.fillStyle = R() < .5 ? 'rgba(0,0,0,.13)' : 'rgba(130,255,180,.022)'; c.fill();
  }
  // ritual ring
  for (const [rr0, a] of [[168, .12], [150, .07], [104, .1]]) {
    c.beginPath(); c.ellipse(W / 2, 560, rr0, rr0 * .78, 0, 0, 7);
    c.strokeStyle = `rgba(120,255,180,${a})`; c.lineWidth = 3; c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, x = W / 2 + Math.cos(a) * 132, y = 560 + Math.sin(a) * 103;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = 'rgba(120,255,180,.10)'; c.fillRect(-4, -14, 8, 28);
    c.restore();
  }
  // cracks
  c.strokeStyle = 'rgba(0,0,0,.34)'; c.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    let x = rnd(0, W), y = rnd(F.y0, H);
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += rnd(-40, 40); y += rnd(-30, 30); c.lineTo(x, y); }
    c.stroke();
  }
  // bones
  for (let i = 0; i < 26; i++) {
    const x = rnd(20, W - 20), y = rnd(F.y0 + 10, H - 20), a = rnd(0, TAU), l = rnd(6, 14);
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = 'rgba(220,255,235,.20)'; c.fillRect(-l / 2, -1.4, l, 2.8);
    c.beginPath(); c.arc(-l / 2, 0, 2.4, 0, 7); c.arc(l / 2, 0, 2.4, 0, 7); c.fill();
    c.restore();
  }
})();

/* ───────────────────────────────────────────────────────── draw */
function draw(ctx) {
  const px = p.x - W / 2, py = p.y - H / 2;
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = moonG; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // far: drifting moon mist
  ctx.globalAlpha = .10;
  for (let i = 0; i < 3; i++) {
    const yy = 120 + i * 90 + Math.sin(t * .4 + i) * 8;
    ctx.fillStyle = i % 2 ? '#9fffd0' : '#7de0ff';
    ctx.beginPath();
    ctx.ellipse(W / 2 + Math.sin(t * .22 + i * 2) * 90 - px * .03, yy - py * .03, 260, 34, 0, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // floor with parallax
  ctx.drawImage(floorCv, -px * .06 - 8, -py * .06 - 8, W + 16, H + 16);

  // floor-level green light pool under the cat (moves with it)
  ctx.save();
  ctx.translate(p.x - px * 0, p.y - 20);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = poolG;
  ctx.fillRect(-300, -300, 600, 600);
  ctx.restore();

  // mid: graves
  const ox = -px * .2, oy = -py * .2;
  for (const gr of GRAVE) {
    const x = gr.x + ox, y = gr.y + oy;
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(gr.r);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(3, 4, gr.w * .62, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#0e2018';
    rr(ctx, -gr.w / 2, -gr.h, gr.w, gr.h, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(120,255,180,.16)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(120,255,180,.10)';
    rr(ctx, -gr.w / 2 + 6, -gr.h + 9, gr.w - 12, 3, 2); ctx.fill();
    rr(ctx, -gr.w / 2 + 6, -gr.h + 17, gr.w - 16, 3, 2); ctx.fill();
    ctx.restore();
  }

  // arena boundary
  const pulse = .35 + Math.sin(t * 2.4) * .1;
  ctx.save();
  ctx.strokeStyle = `rgba(120,255,180,${pulse})`; ctx.lineWidth = 3;
  rr(ctx, F.x0, F.y0 - 8, F.x1 - F.x0, F.y1 - F.y0 + 12, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
  rr(ctx, F.x0 - 3, F.y0 - 11, F.x1 - F.x0 + 6, F.y1 - F.y0 + 18, 16); ctx.stroke();
  ctx.restore();

  // gems
  for (const gm of gems) {
    const s = 7 + Math.sin(gm.t * 6) * 1.6;
    ctx.save(); ctx.translate(gm.x, gm.y); ctx.rotate(gm.t * 1.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,211,77,.35)';
    ctx.beginPath(); ctx.arc(0, 0, s * 2.1, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .78, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .78, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff8cf'; ctx.fillRect(-2.4, -s * .5, 3.2, s * .55);
    ctx.restore();
  }

  // enemies
  for (const e of en) {
    const h = e.s.h * (.45 + .55 * e.born) * (1 + e.boost * .06);
    const b = Math.sin(e.t * 7) * (1 + e.boost * 2);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, e.s.r * .92, e.s.r * .32, 0, 0, 7); ctx.fill();
    ctx.restore();
    if (e.flash > .02) { ctx.save(); ctx.globalAlpha = e.flash * .85; }
    if (e.boost > .35) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .10 + e.boost * .22;
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.ellipse(e.x, e.y - h * .4, h * .5, h * .56, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    drawChar(e.s.ch, ctx, e.x, e.y + b, h, { dir: e.dir, t: e.t, anim: 'walk', color: e.s.col, hurt: e.flash > .5 });
    if (e.flash > .02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.flash * .6;
      drawChar(e.s.ch, ctx, e.x, e.y + b, h, { dir: e.dir, t: e.t, anim: 'walk', color: '#fff' });
      ctx.restore();
    }
    if (e.max > 2 && e.hp < e.max) {
      const w = e.s.r * 1.9, hp = e.hp / e.max;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, e.x - w / 2, e.y - h - 12, w, 6, 3); ctx.fill();
      ctx.fillStyle = hp > .5 ? '#7dff7d' : '#ffd34d'; rr(ctx, e.x - w / 2, e.y - h - 12, w * hp, 6, 3); ctx.fill();
    }
  }

  // player: afterimages
  for (const q of trail) {
    ctx.save(); ctx.globalAlpha = (1 - q.t / .26) * .18;
    drawChar('cat', ctx, q.x, q.y, 78, { dir: q.dir, t: p.t, anim: 'walk', color: '#7df9ff' });
    ctx.restore();
  }
  // shadow + body
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 27, 9, 0, 0, 7); ctx.fill();
  const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0;
  if (!blink) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .2 + cheer * .5 + (g.combo.n > 4 ? .16 : 0);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 34, 44, 48, 0, 0, 7); ctx.fill();
    ctx.restore();
    drawChar('cat', ctx, p.x, p.y, 80, {
      dir: p.dir, t: p.t, anim: Math.hypot(p.vx, p.vy) > 40 ? 'walk' : 'idle',
      color: p.inv > 0 ? '#ff9a9a' : '#ff9a3c', hurt: p.hurtT > .5,
    });
  }
  // aim tick
  if (p.mouse) {
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(steerX, steerY, 14 + Math.sin(t * 8) * 3, 0, 7); ctx.stroke();
    ctx.globalAlpha = .28; ctx.beginPath(); ctx.arc(steerX, steerY, 24, 0, 7); ctx.stroke();
    ctx.restore();
  }

  // bullets (glow pass + core)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of bl) {
    ctx.strokeStyle = 'rgba(255,211,77,.5)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .022, b.y - b.vy * .022); ctx.stroke();
  }
  ctx.restore();
  for (const b of bl) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.fillStyle = '#fff8cf'; ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 1.6;
    rr(ctx, -8, -3.4, 16, 6.8, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // foreground grass (parallax > 1)
  const fx2 = -px * 1.5, fy2 = -py * 1.5;
  ctx.save(); ctx.strokeStyle = 'rgba(10,26,18,.95)'; ctx.lineCap = 'round';
  for (const tf of TUFTS) {
    const x = tf.x + fx2, y = tf.y + fy2;
    if (x < -40 || x > W + 40 || y < F.y0 - 40 || y > H + 40) continue;
    const s = tf.s * (y - F.y0) / (H - F.y0);
    ctx.lineWidth = 2.6 * tf.s;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(x + k * 4, y);
      ctx.quadraticCurveTo(x + k * 8 + Math.sin(t * 2 + tf.a) * 5, y - 16 * s, x + k * 12 + Math.sin(t * 2 + tf.a) * 9, y - 26 * s);
      ctx.stroke();
    }
  }
  ctx.restore();

  // dust motes
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(170,255,200,.5)';
  for (const m of MOTES) {
    const y = F.y0 + ((m.y - F.y0 - t * m.v) % (H - F.y0) + (H - F.y0)) % (H - F.y0);
    ctx.globalAlpha = .12 + .32 * Math.abs(Math.sin(t * .8 + m.ph));
    ctx.beginPath(); ctx.arc(m.x + Math.sin(t * .6 + m.ph) * 12, y, m.s, 0, 7); ctx.fill();
  }
  ctx.restore();

  drawHUD(ctx);
}

/* ───────────────────────────────────────────────────────── HUD */
const barG = ctx0.createLinearGradient(28, 0, W - 28, 0);
barG.addColorStop(0, '#7dff7d'); barG.addColorStop(.6, '#ffd34d'); barG.addColorStop(1, '#ff4ad8');

function drawHUD(ctx) {
  // top band
  const hg = ctx0.createLinearGradient(0, 0, 0, 190);
  hg.addColorStop(0, 'rgba(3,8,12,.94)'); hg.addColorStop(.72, 'rgba(3,8,12,.8)'); hg.addColorStop(1, 'rgba(3,8,12,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 190);

  // hearts
  for (let i = 0; i < p.max; i++) {
    const on = i < p.hp;
    const s = on ? 30 : 26;
    ctx.save();
    if (on) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3;
      ctx.fillStyle = '#ff3b5c';
      heartPath(ctx, 40 + i * 38, 48, 46); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    heartPath(ctx, 40 + i * 38, 48, s);
    ctx.fillStyle = on ? '#ff3b5c' : 'rgba(255,255,255,.10)'; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = on ? '#2a0410' : 'rgba(255,255,255,.16)'; ctx.stroke();
    ctx.restore();
  }

  // score pill (right)
  const sc = fmt(Math.round(g.score));
  ctx.save();
  ctx.textAlign = 'right';
  g.text('SCORE', W - 30, 36, { size: 15, color: 'rgba(220,255,235,.5)', align: 'right' });
  g.text(sc, W - 30, 68, { size: 30, color: '#e9fff2', align: 'right' });
  ctx.restore();

  // kill goal
  g.text('KILLS', 30, 92, { size: 15, color: 'rgba(220,255,235,.55)' });
  const kt = String(killN);
  g.text(kt, 30, 146, { size: 56, color: '#fff', stroke: '#05140c' });
  ctx.font = '900 56px Impact,"Arial Black",system-ui,sans-serif';
  const kw = ctx.measureText(kt).width;
  g.text('/' + GOAL, 30 + kw + 6, 146, { size: 30, color: 'rgba(220,255,235,.5)' });

  // progress
  const bx = 28, by = 156, bw = W - 56, bh = 12;
  ctx.fillStyle = 'rgba(255,255,255,.09)'; rr(ctx, bx, by, bw, bh, 6); ctx.fill();
  const prog = clamp(killN / GOAL, 0, 1);
  if (prog > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45; ctx.fillStyle = barG;
    rr(ctx, bx, by, bw * prog, bh, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = barG; rr(ctx, bx, by, bw * prog, bh, 6); ctx.fill();
    for (let i = 1; i < GOAL / 4; i++) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx + bw * i / (GOAL / 4) - 1, by, 2, bh);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.4; rr(ctx, bx, by, bw, bh, 6); ctx.stroke();

  // combo (engine) — sits right under the score
  g.combo.draw(ctx);

  // nova button
  const ready = novaP >= 1;
  const bx2 = 168, by2 = 862, bw2 = 204, bh2 = 74;
  ctx.save();
  ctx.fillStyle = ready ? 'rgba(255,74,216,.20)' : 'rgba(255,255,255,.05)';
  rr(ctx, bx2, by2, bw2, bh2, 20); ctx.fill();
  ctx.strokeStyle = ready ? `rgba(255,74,216,${.65 + Math.sin(t * 8) * .3})` : 'rgba(255,255,255,.14)';
  ctx.lineWidth = 3; rr(ctx, bx2, by2, bw2, bh2, 20); ctx.stroke();
  if (!ready) {
    ctx.fillStyle = 'rgba(255,74,216,.45)';
    rr(ctx, bx2 + 8, by2 + bh2 - 18, (bw2 - 16) * novaP, 8, 4); ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .28 + Math.sin(t * 8) * .12;
    ctx.fillStyle = '#ff4ad8'; rr(ctx, bx2, by2, bw2, bh2, 20); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.restore();
  g.text(ready ? 'PAW BOMB  ⚡' : 'CHARGING', W / 2, by2 + 40, {
    size: ready ? 27 : 21, color: ready ? '#ffd0f6' : 'rgba(255,255,255,.35)', align: 'center', stroke: '#1a0416' });

  // upgrade burst panel
  if (upT > 0) {
    const k = upT / 1.5;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2.2);
    const yy = 250 + (1 - k) * -18;
    ctx.translate(W / 2, yy);
    ctx.scale(1 + (1 - k) * .12, 1 + (1 - k) * .12);
    ctx.fillStyle = 'rgba(4,10,14,.86)'; rr(ctx, -190, -40, 380, 80, 18); ctx.fill();
    ctx.strokeStyle = upCol; ctx.lineWidth = 3; rr(ctx, -190, -40, 380, 80, 18); ctx.stroke();
    g.text(upName, 0, -4, { size: 30, color: upCol, align: 'center' });
    g.text(upSub, 0, 24, { size: 15, color: 'rgba(255,255,255,.6)', align: 'center' });
    ctx.restore();
  }
}
window.__dbg = () => ({ kills: killN, hp: p.hp, en: en.length, bl: bl.length, nova: +novaP.toFixed(2), t: +t.toFixed(1) });
resetWorld();
g.run(update, draw);

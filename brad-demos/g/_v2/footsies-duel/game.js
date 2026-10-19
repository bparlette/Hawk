// FOOTSIES DUEL — footsies-duel (Cat Arcade v2)
// A miniature 2D fighting neutral game. Step, poke, block. Read the rival's rhythm,
// whiff-punish into a counter, win the best-of-3. One mistake and you eat 34.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, pick, chance, R, TAU, rr, starPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const GY = 726;                       // the feet line of both fighters
const MAXHP = 100, ROUND_T = 25, NEEDED = 2;
const ATK = {
  reach: 156, heavyReach: 194,
  wind: .13, start: .10, active: .07, rec: .22, recHeavy: .34,
  dmg: 11, dmgHeavy: 17, dmgCounter: 30, dmgCounterAI: 34, chip: 2,
  push: 190, pushBlock: 120, stun: .30, parry: .17, stagger: .55,
};

const g = makeGame({
  id: 'footsies-duel', title: 'FOOTSIES DUEL', sub: 'TAP SIDES TO STEP · TAP MIDDLE TO POKE · HOLD TO BLOCK',
  hook: 'one whiff and you eat 34', w: W, h: H, bg: '#0a0614', style: 'toon',
  bloom: .86, ca: .42, vig: 1.05, scan: .16,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');

/* ================================================================ state */
let hero, rival, phase, phaseT, roundN, wins, losses, roundT, T, ptrT, autoT, ghostP, ghostR, musicOn;
const AI = { cd: .5, beat: 0 };

const mkFighter = (x, dir, ai) => ({
  x, vx: 0, dir, ai, hp: MAXHP, st: 'idle', t: 0, blockT: 0,
  atkKind: 'poke', hitDone: false, rec: ATK.rec, stun: ATK.stun,
  sq: 1, fl: 0, hurtT: 0, stepT: 0, fall: 0, anim: 0,
});

function resetRound() {
  hero = mkFighter(150, 1, false);
  rival = mkFighter(392, -1, true);
  phase = 'intro'; phaseT = 0; roundT = ROUND_T;
  AI.cd = .5; AI.beat = 0;
  ghostP = MAXHP; ghostR = MAXHP;
  g.fx.clear(); g.combo.reset();
}

function resetMatch() {
  wins = 0; losses = 0; roundN = 1; T = 0; autoT = 0; ptrT = 0; musicOn = false;
  g.score = 0;
  resetRound();
  g.state = { hp: MAXHP, rhp: MAXHP, wins: 0, losses: 0, round: 1, phase: 'intro' };
}
g.onReset = resetMatch;
g.onStart = () => music('action');

/* ================================================================ layers */
const LW = 760;
let _s = 90210;
const ar = (a = 0, b = 1) => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return a + (_s / 0x7fffffff) * (b - a); };
function layer(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }

/* far — mountains, a pagoda, low mist */
const FAR = layer(LW, 420, (c, w, h) => {
  c.fillStyle = '#241443'; c.beginPath(); c.moveTo(0, 420);
  for (let x = 0; x <= w; x += 40) c.lineTo(x, 300 - Math.abs(Math.sin(x * .011)) * 120 - Math.sin(x * .047) * 26);
  c.lineTo(w, 420); c.closePath(); c.fill();
  c.fillStyle = '#2e1a52'; c.beginPath(); c.moveTo(0, 420);
  for (let x = 0; x <= w; x += 30) c.lineTo(x, 350 - Math.abs(Math.sin(x * .019 + 2)) * 90 - Math.sin(x * .07) * 18);
  c.lineTo(w, 420); c.closePath(); c.fill();
  /* pagoda */
  const px = 176;
  c.fillStyle = '#170d2e';
  for (let i = 0; i < 4; i++) {
    const y = 330 - i * 56, ww = 84 - i * 15;
    c.beginPath(); c.moveTo(px - ww, y); c.quadraticCurveTo(px, y - 26, px + ww, y); c.lineTo(px + ww - 8, y + 8); c.lineTo(px - ww + 8, y + 8); c.closePath(); c.fill();
    c.fillRect(px - ww * .55, y + 6, ww * 1.1, 26);
  }
  c.fillRect(px - 2, 306, 4, 22);
  /* mist */
  const mist = c.createLinearGradient(0, 280, 0, 420);
  mist.addColorStop(0, 'rgba(120,60,150,0)'); mist.addColorStop(1, 'rgba(200,90,120,.45)');
  c.fillStyle = mist; c.fillRect(0, 280, w, 140);
});

/* mid — torii gate, bamboo, hanging lanterns */
const LANTERNS = [];
const MID = layer(LW, 460, (c, w, h) => {
  for (let i = 0; i < 26; i++) {
    const bx = ar(-10, w), bw = ar(7, 15), bh = ar(150, 250), tone = ar(.5, 1);
    c.fillStyle = `rgba(${28 + tone * 16 | 0},${22 + tone * 26 | 0},${46 + tone * 30 | 0},1)`;
    c.fillRect(bx, 460 - bh, bw, bh);
    c.fillStyle = 'rgba(150,120,220,.12)';
    c.fillRect(bx + bw * .5, 460 - bh, 2, bh);
    for (let k = 0; k < 3; k++) {
      const ly = 460 - bh + ar(20, bh - 30), dir = ar() > .5 ? 1 : -1;
      c.beginPath(); c.moveTo(bx + bw * .5, ly); c.quadraticCurveTo(bx + bw * .5 + dir * 26, ly - 12, bx + bw * .5 + dir * 34, ly - 2); c.strokeStyle = 'rgba(30,50,40,.9)'; c.lineWidth = 2; c.stroke();
    }
  }
  /* torii */
  const tx = 520, tw = 150, ty = 336;
  c.fillStyle = '#7d1f2e'; c.fillRect(tx - tw / 2, ty, 20, 130); c.fillRect(tx + tw / 2 - 20, ty, 20, 130);
  c.fillRect(tx - tw / 2 - 22, ty - 8, tw + 44, 20);
  c.fillStyle = '#a3293c'; c.fillRect(tx - tw / 2 - 34, ty - 26, tw + 68, 20);
  c.fillStyle = '#33101a'; c.fillRect(tx - tw / 2 + 14, ty + 26, tw - 28, 12);
  /* hanging lanterns */
  for (const lx of [96, 250, 348, 690]) {
    LANTERNS.push({ x: lx, y: ar(250, 300) });
    c.strokeStyle = '#2a1a3a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, lx === 348 ? 262 : 236); c.stroke();
  }
  const haze = c.createLinearGradient(0, 240, 0, h);
  haze.addColorStop(0, 'rgba(40,18,60,0)'); haze.addColorStop(1, 'rgba(120,44,90,.55)');
  c.fillStyle = haze; c.fillRect(0, 240, w, h - 240);
});

/* ================================================================ cached paints */
const SKY = ctx.createLinearGradient(0, 0, 0, GY);
SKY.addColorStop(0, '#0a0614'); SKY.addColorStop(.34, '#22113f'); SKY.addColorStop(.62, '#4d1b4e');
SKY.addColorStop(.84, '#8e2f47'); SKY.addColorStop(1, '#d1573a');
const MOONG = ctx.createRadialGradient(398, 208, 8, 398, 208, 168);
MOONG.addColorStop(0, 'rgba(255,222,180,.85)'); MOONG.addColorStop(.35, 'rgba(255,160,130,.22)'); MOONG.addColorStop(1, 'rgba(255,120,120,0)');
const SLAB = ctx.createLinearGradient(0, 700, 0, 748);
SLAB.addColorStop(0, '#6b4358'); SLAB.addColorStop(.5, '#4a2b3f'); SLAB.addColorStop(1, '#301b2c');
const FRONT = ctx.createLinearGradient(0, 748, 0, H);
FRONT.addColorStop(0, '#2a1526'); FRONT.addColorStop(.45, '#190c1b'); FRONT.addColorStop(1, '#0a0614');
const HPYOU = ctx.createLinearGradient(26, 0, 250, 0);
HPYOU.addColorStop(0, '#ffb347'); HPYOU.addColorStop(.6, '#ff8a3c'); HPYOU.addColorStop(1, '#ff4d6d');
const HPFOE = ctx.createLinearGradient(514, 0, 290, 0);
HPFOE.addColorStop(0, '#7df9ff'); HPFOE.addColorStop(.6, '#6f9dff'); HPFOE.addColorStop(1, '#a06bff');
const PET = [];
for (let i = 0; i < 30; i++) PET.push({ x: rnd(0, W), y: rnd(-40, H), vy: rnd(26, 62), sw: rnd(.4, 1.4), ph: rnd(0, TAU), r: rnd(3, 6), c: pick(['#ffb8c8', '#ffd9a8', '#ff9ec0']) });
const SPARK = [];

/* ================================================================ helpers */
function stepIt(f, dir) {
  if (Math.abs(f.vx) > 300) return;
  f.vx = dir * 640; f.sq = .84; f.stepT = .16;
  g.fx.dust(f.x - dir * 10, GY - 4, 4, { color: 'rgba(255,214,170,.4)', speed: 80, size: 12, up: 30 });
  sfx('step', { vol: .26, pitch: 1.2 });
}

function startAttack(f, heavy) {
  f.st = 'atk'; f.t = 0; f.hitDone = false; f.atkKind = heavy ? 'heavy' : 'poke';
  f.rec = heavy ? ATK.recHeavy : ATK.rec;
  sfx('whoosh', { vol: .3, pitch: heavy ? .7 : 1.15 });
}

function startWind(f) {
  f.st = 'wind'; f.t = 0; f.atkKind = 'poke';
}

/* ================================================================ combat */
function whiff(f) {
  const wx = f.x + f.dir * 96, wy = GY - 92;
  g.fx.burst(wx, wy, 4, { kind: 'smoke', color: 'rgba(255,200,220,.3)', speed: 130, life: .3, size: 9, g: -20 });
}

function tryHit(att, def) {
  const reach = att.atkKind === 'heavy' ? ATK.heavyReach : ATK.reach;
  const d = Math.abs(def.x - att.x);
  const inFront = (def.x - att.x) * att.dir > 0;
  if (!inFront || d > reach) { whiff(att); return; }
  const mx = (att.x + def.x) * .5, my = GY - 96;
  if (def.st === 'guard') {
    if (def.blockT < ATK.parry) { doParry(att, def, mx, my); return; }
    doBlock(att, def, mx, my);
    return;
  }
  doHit(att, def, mx, my);
}

function doBlock(att, def, mx, my) {
  def.hp = Math.max(1, def.hp - ATK.chip);
  def.vx = att.dir * ATK.pushBlock; att.vx = -att.dir * 60;
  def.sq = .9; def.fl = .25;
  att.rec += .13;
  sfx('snap', { pitch: 1.2, vol: .8 });
  g.fx.burst(mx, my, 11, { kind: 'spark', color: ['#cfe8ff', '#fff', '#7aa6ff'], speed: 320, life: .3, size: 5 });
  g.fx.emit('ring', mx, my, { size: 30, life: .24, color: '#cfe8ff', add: true, wide: 5 });
  g.impact(mx, my, { punch: .05, shake: 6, stop: .05 });
  g.popup('BLOCK', mx, my - 46, '#bfe9ff', 26);
  if (def === hero) g.combo.miss();
}

function doParry(att, def, mx, my) {
  att.st = 'stagger'; att.t = 0; att.fl = .5; att.vx = -att.dir * 240;
  def.st = 'idle'; def.t = 0; def.vx = -def.dir * 90; def.sq = 1.08;
  sfx('perfect', { vol: .95, pitch: 1.15 });
  g.impact(mx, my, { punch: .15, shake: 15, stop: .12, flash: '#e6fbff', flashA: .34, sfx: 'ding', pitch: 1.35 });
  g.fx.blast(mx, my, { r: 64, color: '#e6fbff', colors: ['#fff', '#bfe9ff', '#7dffdd'], n: 18, speed: 360, flashA: .1, shake: 4, punch: .04 });
  g.fx.emit('ring', mx, my, { size: 22, life: .34, color: '#7dffdd', add: true, wide: 9 });
  g.popup('PARRY!', mx, my - 62, '#7dffdd', 42);
  if (def === hero) { g.score += 140 * Math.max(1, g.combo.mult); g.combo.hit(mx, my, 'PARRY'); }
  else g.combo.miss();
}

function doHit(att, def, mx, my) {
  const counter = def.st === 'atk' || def.st === 'wind' || def.st === 'stagger';
  const dmg = counter ? (att === hero ? ATK.dmgCounter : ATK.dmgCounterAI)
    : (att.atkKind === 'heavy' ? ATK.dmgHeavy : ATK.dmg);
  def.hp = Math.max(0, def.hp - dmg);
  def.st = 'hit'; def.t = 0; def.stun = ATK.stun; def.hurtT = .34; def.fl = .55; def.sq = .78;
  def.vx = att.dir * (counter ? 320 : ATK.push);
  att.vx = -att.dir * 40;
  if (att === hero) {
    g.score += Math.round(dmg * 9 * Math.max(1, g.combo.mult));
    g.combo.hit(mx, my - 30, counter ? 'COUNTER' : 'POKE');
  } else g.combo.miss();
  if (counter) {
    sfx('crit', { pitch: comboPitch(g.combo.n % 9), vol: 1 });
    g.hitstop(.10); g.slowmo(.42, .26); g.punch(.2); g.shake(20); g.flash('#fff', .34);
    g.fx.blast(mx, my, { r: 96, color: '#ffd34d', colors: ['#fff', '#ffd34d', '#ff7a3c'], n: 26, speed: 470, size: 7, shake: 6, punch: .05 });
    g.fx.emit('ring', mx, my, { size: 26, life: .38, color: '#fff', add: true, wide: 10 });
    g.fx.burst(mx, my, 12, { kind: 'shard', color: ['#fff', '#ffe9a8'], speed: 420, life: .5, size: 6 });
    g.popup('COUNTER', mx, my - 66, '#ffd34d', 40);
  } else {
    sfx('hit', { pitch: comboPitch(g.combo.n % 12), vol: .92 });
    g.hitstop(.06); g.punch(.11); g.shake(11);
    g.fx.burst(mx, my, 14, { kind: 'spark', color: ['#fff', '#ffd34d', '#ff9ec0'], speed: 340, life: .38, size: 6 });
    g.fx.emit('ring', mx, my, { size: 22, life: .26, color: '#ffe9a8', add: true, wide: 6 });
    g.popup('-' + dmg, mx, my - 46, '#ff9ec0', 32);
  }
  if (def.hp <= 0) ko(def);
}

function ko(f) {
  f.st = 'down'; f.t = 0; f.fall = 0; f.vx = f.dir * 90;
  const won = f === rival;
  phase = won ? 'roundWin' : 'roundLoss'; phaseT = 0;
  if (won) wins++; else losses++;
  sfx('boom', { vol: 1, pitch: won ? 1.05 : .8 });
  g.slowmo(.3, .9); g.shake(22); g.flash(won ? '#ffd34d' : '#ff3b5c', .4);
  g.fx.blast(f.x, GY - 70, {
    r: 160, color: won ? '#ffd34d' : '#ff3b5c',
    colors: won ? ['#ffd34d', '#fff', '#ffb347'] : ['#ff3b5c', '#ff7a3c', '#fff'],
    n: 34, speed: 480, size: 8, shake: 18, punch: .16, flashA: .2,
  });
  g.fx.burst(f.x, GY - 60, 16, { kind: 'debris', color: ['#ffd34d', '#ff9ec0', '#fff'], speed: 340, life: .9, size: 6 });
  g.showBanner(won ? 'K.O.!' : 'DOWN...', 1.05);
  if (won) g.score += 400 * Math.max(1, g.combo.mult);
}

/* ================================================================ rival AI — a readable 5-beat loop */
function aiStep(f, dir) { if (Math.abs(f.vx) > 300) return; f.vx = dir * 560; f.sq = .86; f.stepT = .16; }

function aiThink(dt) {
  const f = rival;
  if (f.st !== 'idle') return;
  const d = Math.abs(hero.x - f.x);
  AI.cd -= dt;
  if (AI.cd > 0) {
    if (d > ATK.reach + 24) aiStep(f, 1);
    return;
  }
  /* round 2: the rival presses harder */
  const pace = roundN > 1 ? .78 : 1;
  if (d > ATK.reach - 6) { aiStep(f, 1); AI.cd = .2 * pace; return; }
  AI.beat = (AI.beat + 1) % 5;
  if (AI.beat === 3) { f.st = 'guard'; f.t = 0; f.blockT = 0; f.guardMax = .34; AI.cd = .1; }
  else if (AI.beat === 4) { aiStep(f, -1); AI.cd = .26 * pace; }
  else { startWind(f); AI.cd = .42 * pace; }
}

/* ================================================================ bot */
function botInput() {
  const p = hero, f = rival;
  if (g.dumb()) {
    /* walks into the grinder, never blocks — the video's fail state */
    return { step: f.x - p.x > ATK.reach - 20 ? 1 : 0, poke: chance(.5), block: false };
  }
  const d = f.x - p.x;
  /* the tell: guard exactly on the strike frame = parry, then counter */
  if (f.st === 'atk') return { step: 0, poke: false, block: true };
  if (f.st === 'wind') return { step: 0, poke: false, block: false };
  if (f.st === 'stagger' || f.st === 'hit') {
    if (d > ATK.reach - 26) return { step: 1, poke: false, block: false };
    return { step: 0, poke: true, block: false };
  }
  if (f.st === 'guard') return { step: d < ATK.reach + 26 ? -1 : 0, poke: false, block: false };
  if (d > ATK.reach + 26) return { step: 1, poke: false, block: false };
  if (d >= ATK.reach - 16) return { step: 1, poke: false, block: false };
  return { step: 0, poke: true, block: false };
}

/* ================================================================ per-fighter frame */
function stepFighter(f, dt) {
  f.t += dt;
  f.fl = Math.max(0, f.fl - dt);
  f.hurtT = Math.max(0, f.hurtT - dt);
  f.stepT = Math.max(0, f.stepT - dt);
  f.sq = lerp(f.sq, 1, Math.min(1, dt * 11));
  f.anim += Math.abs(f.vx) * dt * .06 + dt * 3.4;
  if (f.st === 'down') f.fall = Math.min(1, f.fall + dt * 3.2);
  f.x += f.vx * dt;
  f.vx *= Math.exp(-16 * dt);
  if (Math.abs(f.vx) < 4) f.vx = 0;
  if (f.st === 'guard') f.blockT += dt;

  switch (f.st) {
    case 'wind':
      if (f.t >= ATK.wind) { startAttack(f, false); }
      break;
    case 'atk': {
      if (!f.hitDone && f.t >= ATK.start) { f.hitDone = true; tryHit(f, f === hero ? rival : hero); }
      if (f.t >= ATK.start + ATK.active + f.rec) { f.st = 'idle'; f.t = 0; }
      break;
    }
    case 'guard':
      if (f.ai && f.t >= (f.guardMax || .34)) { f.st = 'idle'; f.t = 0; }
      break;
    case 'hit':
      if (f.t >= f.stun) { f.st = 'idle'; f.t = 0; }
      break;
    case 'stagger':
      if (f.t >= ATK.stagger) { f.st = 'idle'; f.t = 0; }
      break;
  }
  f.x = clamp(f.x, 76, 464);
}

function applyIntent(f, it) {
  if (f.st === 'down' || f.st === 'hit' || f.st === 'stagger' || f.st === 'atk' || f.st === 'wind') return;
  if (phase !== 'fight') { if (it.block && f.st !== 'guard') { f.st = 'guard'; f.t = 0; f.blockT = 0; } return; }
  if (it.block) {
    if (f.st !== 'guard') { f.st = 'guard'; f.t = 0; f.blockT = 0; sfx('blip', { pitch: 1.35, vol: .22 }); }
    return;
  }
  if (f.st === 'guard') { f.st = 'idle'; f.t = 0; }
  if (it.step) stepIt(f, it.step);
  if (it.poke) startAttack(f, false);
}

/* ================================================================ update */
function update(dt) {
  if (g.mode !== 'play') return;
  if (!musicOn) { musicOn = true; music('action'); }
  T += dt; phaseT += dt;
  if (phase === 'fight' && hero.st !== 'down' && rival.st !== 'down') roundT = Math.max(0, roundT - dt);

  /* --- human input --- */
  let it = { step: 0, poke: false, block: false };
  if (g.ptr.down) ptrT += dt; else ptrT = 0;
  for (const tp of g.taps) it._tap = tp.x < 190 ? -1 : tp.x > 350 ? 1 : 0;
  if (it._tap === -1) it.step = -1;
  else if (it._tap === 1) it.step = 1;
  else if (it._tap === 0) it.poke = true;
  if (g.pressed.ArrowLeft || g.pressed.KeyA) it.step = -1;
  if (g.pressed.ArrowRight || g.pressed.KeyD) it.step = 1;
  if (g.pressed.Space || g.pressed.KeyJ || g.pressed.KeyK || g.pressed.Enter) it.poke = true;
  it.block = ptrT > .10 || !!g.keys.ArrowDown || !!g.keys.KeyS || !!g.keys.ShiftLeft;

  if (isAuto) {
    autoT += dt;
    const b = botInput();
    it.step = b.step; it.poke = b.poke; it.block = b.block;
  }

  applyIntent(hero, it);
  if (phase === 'fight') aiThink(dt);

  stepFighter(hero, dt);
  stepFighter(rival, dt);

  /* keep them from overlapping / crossing up */
  hero.x = clamp(hero.x, 76, rival.x - 94);
  rival.x = clamp(rival.x, hero.x + 94, 464);

  ghostP = lerp(ghostP, hero.hp, Math.min(1, dt * 5.5));
  ghostR = lerp(ghostR, rival.hp, Math.min(1, dt * 5.5));

  /* petals */
  for (const p of PET) {
    p.y += p.vy * dt; p.ph += dt * p.sw;
    p.x += Math.sin(p.ph) * 22 * dt - 16 * dt;
    if (p.y > H + 20) { p.y = -20; p.x = rnd(-20, W); }
    if (p.x < -20) p.x = W + 20;
  }

  /* round flow */
  if (phase === 'intro' && phaseT > .5) { phase = 'fight'; phaseT = 0; g.showBanner('FIGHT!', .65); sfx('powerup', { pitch: 1.2, vol: .5 }); }
  if (phase === 'fight' && roundT <= 0) {
    const won = hero.hp >= rival.hp;
    ko(won ? rival : hero);
    if (won) { rival.hp = 0; } else { hero.hp = 0; }
  }
  if (phase === 'roundWin' || phase === 'roundLoss') {
    if (phaseT > .95) {
      phaseT = 0;
      if (wins >= NEEDED) { matchEnd(true); return; }
      if (losses >= NEEDED) { matchEnd(false); return; }
      roundN++; resetRound();
      g.showBanner('ROUND ' + roundN, .9); sfx('blip', { pitch: .9, vol: .5 });
    }
  }
  if (isAuto && autoT > 42) { matchEnd(true); return; }

  g.state = {
    hp: Math.round(hero.hp), rhp: Math.round(rival.hp),
    wins, losses, round: roundN, phase,
  };
}

function matchEnd(won) {
  if (won) {
    g.showBanner('YOU WIN!', 1.6);
    g.score += 1000;
    g.fx.burst(W / 2, 380, 90, { kind: 'confetti', color: ['#ffd34d', '#7df9ff', '#ff4ad8', '#7dff7d', '#fff'], speed: 580, life: 1.8, g: 380, size: 7 });
    g.fx.blast(W / 2, 440, { r: 220, color: '#ffd34d', colors: ['#ffd34d', '#fff', '#ffb347'], n: 50, speed: 540, shake: 14, punch: .14, flashA: .34 });
    sfx('fanfare', { vol: .9 });
    g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 100 });
  } else {
    g.fx.burst(hero.x, GY - 80, 26, { kind: 'debris', color: ['#ff3b5c', '#ff9ec0', '#fff'], speed: 300, life: 1, size: 6 });
    sfx('lose', { vol: .8 });
    g.end({
      win: false, score: Math.round(g.score), label: 'SCORE',
      progress: Math.round(clamp((wins / NEEDED) * 80 + (hero.hp / MAXHP) * 20, 0, 100)),
    });
  }
}

/* ================================================================ fighter art */
function drawFighter(f) {
  const isHero = f === hero;
  const col = isHero ? '#ffb347' : '#6f9dff';
  const h = 148;
  const bob = Math.sin(T * 4.2 + (isHero ? 0 : 1.4)) * 2.4;
  const moving = Math.abs(f.vx) > 30 || f.stepT > 0;
  let lean = 0;
  if (f.st === 'wind') lean = -f.dir * 7;
  else if (f.st === 'atk') lean = f.dir * (6 + Math.sin(Math.min(1, f.t / (ATK.start + ATK.active)) * Math.PI) * 12);
  else if (f.st === 'hit') lean = -f.dir * 12;
  else if (f.st === 'stagger') lean = Math.sin(T * 26) * 5;

  /* shadow */
  ctx.save();
  ctx.globalAlpha = .32; ctx.fillStyle = '#05020c';
  ctx.beginPath(); ctx.ellipse(f.x, GY + 4, 40, 11, 0, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(f.x + lean, GY);
  if (f.st === 'down') ctx.rotate(-f.dir * 1.35 * f.fall);
  ctx.scale((2 - f.sq) * f.dir, f.sq);

  /* rival scarf, behind the body */
  if (!isHero) {
    ctx.save();
    ctx.globalAlpha = .95;
    const sw = Math.sin(T * 6) * 10;
    ctx.beginPath(); ctx.moveTo(-30, -92);
    ctx.quadraticCurveTo(-70, -100 + sw, -96, -74 + sw * .6);
    ctx.lineTo(-88, -58 + sw * .6); ctx.quadraticCurveTo(-62, -76, -26, -76);
    ctx.closePath(); ctx.fillStyle = '#e63946'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#151515'; ctx.stroke();
    ctx.restore();
  }
  if (f.fl > 0) { ctx.save(); ctx.globalAlpha = .5 * f.fl; ctx.fillStyle = f.st === 'guard' ? '#cfe8ff' : '#fff'; ctx.beginPath(); ctx.ellipse(0, -66, 64, 78, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  drawChar('cat', ctx, 0, -bob, h, { dir: 1, anim: moving ? 'walk' : 'idle', t: f.anim, color: col, hurt: f.hurtT > 0 });

  /* rival headband */
  if (!isHero) {
    ctx.save();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.moveTo(15, -88); ctx.lineTo(52, -96); ctx.lineTo(52, -84); ctx.lineTo(15, -78); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#151515'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  /* guard shield */
  if (f.st === 'guard') {
    ctx.save();
    ctx.translate(f.x + f.dir * 44, GY - 78);
    ctx.globalAlpha = .32 + .18 * Math.sin(T * 12);
    ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 46, -1.0, 1.0); ctx.stroke();
    ctx.globalAlpha = .12; ctx.lineWidth = 16; ctx.strokeStyle = '#7df9ff';
    ctx.beginPath(); ctx.arc(0, 0, 46, -1.0, 1.0); ctx.stroke();
    ctx.restore();
  }

  /* attack swipe */
  if (f.st === 'atk' && f.t > ATK.start - .02 && f.t < ATK.start + ATK.active + .10) {
    const k = clamp((f.t - ATK.start) / (ATK.active + .10), 0, 1);
    ctx.save();
    ctx.translate(f.x + f.dir * 24, GY - 92);
    ctx.scale(f.dir, 1);
    ctx.globalAlpha = (1 - k) * .95;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 13 * (1 - k * .5); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 74 + k * 26, -.85, .85); ctx.stroke();
    ctx.globalAlpha = (1 - k) * .5;
    ctx.strokeStyle = isHero ? '#ffd34d' : '#7df9ff'; ctx.lineWidth = 22 * (1 - k * .4);
    ctx.beginPath(); ctx.arc(0, 0, 74 + k * 26, -.62, .62); ctx.stroke();
    ctx.restore();
  }

  /* wind-up tell */
  if (f.st === 'wind' || (f.st === 'atk' && f.t < ATK.start)) {
    const k = f.st === 'wind' ? f.t / ATK.wind : .5 + f.t / ATK.start * .5;
    ctx.save();
    ctx.globalAlpha = .55 + .45 * Math.sin(T * 34);
    g.text('!', f.x + f.dir * 6, GY - 178, { size: 42 + k * 12, align: 'center', color: '#ffd34d', ink: '#0a0418' });
    ctx.restore();
  }
}

/* ================================================================ HUD */
function hudBar(x, w, hp, ghost, grd, right) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,18,.78)'; rr(ctx, x - 3, 47, w + 6, 30, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,60,90,.42)';
  const gw = Math.max(0, w * (ghost / MAXHP));
  rr(ctx, right ? x + w - gw : x, 50, gw, 24, 7); ctx.fill();
  const fw = Math.max(0, w * (hp / MAXHP));
  ctx.fillStyle = grd;
  rr(ctx, right ? x + w - fw : x, 50, fw, 24, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
  rr(ctx, x, 50, w, 24, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(10,4,22,.9)'; ctx.lineWidth = 3;
  rr(ctx, x - 3, 47, w + 6, 30, 9); ctx.stroke();
  ctx.restore();
}

function draw() {
  const camx = clamp(((hero.x + rival.x) * .5) - 270, -150, 150);

  /* sky */
  ctx.fillStyle = SKY; ctx.fillRect(0, 0, W, GY + 6);
  ctx.fillStyle = MOONG; ctx.fillRect(0, 0, W, GY);
  ctx.save();
  ctx.globalAlpha = .95; ctx.fillStyle = '#ffe9c6';
  ctx.beginPath(); ctx.arc(398, 208, 44, 0, TAU); ctx.fill();
  ctx.globalAlpha = .1; ctx.fillStyle = '#ffd0a0';
  ctx.beginPath(); ctx.arc(398, 208, 84, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const sx = (i * 137) % W, sy = 30 + (i * 83) % 320;
    ctx.globalAlpha = .3 + .7 * Math.abs(Math.sin(T * .7 + i));
    ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.restore();

  /* parallax silhouettes */
  ctx.drawImage(FAR, -Math.round(70 + camx * .10), 246, LW, 420);
  ctx.drawImage(MID, -Math.round(56 + camx * .24), 268, LW, 460);

  /* swinging lanterns (foreground-ish mid) */
  for (let i = 0; i < LANTERNS.length; i++) {
    const L = LANTERNS[i];
    const sw = Math.sin(T * 1.4 + i) * 7;
    const lx = L.x - camx * .24, ly = L.y + 268;
    ctx.save();
    ctx.strokeStyle = 'rgba(30,16,36,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, ly - 26); ctx.lineTo(lx + sw, ly); ctx.stroke();
    ctx.translate(lx + sw, ly + 12);
    ctx.globalAlpha = .55; ctx.fillStyle = '#ff8a3c';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7d2b1e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#a3293c'; ctx.fillRect(-14, -4, 28, 4); ctx.fillRect(-14, 4, 28, 3);
    ctx.restore();
  }

  /* stage slab + front face */
  ctx.fillStyle = SLAB; ctx.fillRect(0, 700, W, 48);
  ctx.fillStyle = FRONT; ctx.fillRect(0, 748, W, H - 748);
  ctx.save();
  ctx.globalAlpha = .22; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, 706 + i * 5); ctx.lineTo(W, 706 + i * 5); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,180,120,.30)'; ctx.fillRect(0, 700, W, 4);
  ctx.fillStyle = 'rgba(10,4,20,.55)'; ctx.fillRect(0, 744, W, 6);
  /* plank seams */
  ctx.save(); ctx.globalAlpha = .3; ctx.strokeStyle = '#0a0414'; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const px = 20 + i * 84 - camx * .3; ctx.beginPath(); ctx.moveTo(px, 700); ctx.lineTo(px - 10, 748); ctx.stroke(); }
  ctx.restore();
  /* warm rim light on the fighters' floor */
  ctx.save(); ctx.globalAlpha = .3; ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,140,90,.5)';
  ctx.beginPath(); ctx.ellipse(270, 712, 300, 26, 0, 0, TAU); ctx.fill();
  ctx.restore();

  /* fighters — the downed one first */
  const order = hero.st === 'down' ? [hero, rival] : [rival, hero];
  if (order[0] === hero) { drawFighter(hero); drawFighter(rival); } else { drawFighter(rival); drawFighter(hero); }

  /* petals */
  for (const p of PET) {
    ctx.save();
    ctx.globalAlpha = .55;
    ctx.translate(p.x, p.y); ctx.rotate(p.ph);
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- HUD ---------------- */
  hudBar(24, 226, hero.hp, ghostP, HPYOU, false);
  hudBar(290, 226, rival.hp, ghostR, HPFOE, true);
  g.text('YOU', 28, 40, { size: 17, color: '#ffd9a8', ink: '#0a0418' });
  g.text('RIVAL', W - 28, 40, { size: 17, align: 'right', color: '#bfd4ff', ink: '#0a0418' });
  const secs = Math.ceil(roundT);
  g.text('0:' + String(secs).padStart(2, '0'), W / 2, 74, { size: 40, align: 'center', color: secs <= 6 ? '#ff5c78' : '#fff', ink: '#0a0418' });
  g.text('ROUND ' + roundN, W / 2, 100, { size: 16, align: 'center', color: '#ffb8d8', ink: '#0a0418' });
  /* round pips */
  for (let i = 0; i < NEEDED; i++) {
    for (const [side, n] of [[0, wins], [1, losses]]) {
      const px = side ? W - 34 - i * 26 : 34 + i * 26;
      ctx.save();
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.lineTo(px + Math.cos(a) * 9, 108 + Math.sin(a) * 9); }
      ctx.closePath();
      ctx.fillStyle = i < n ? (side ? '#6f9dff' : '#ffd34d') : 'rgba(255,255,255,.14)';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,4,22,.85)'; ctx.stroke();
      ctx.restore();
    }
  }

  /* ---- touch bar ---- */
  const zones = [
    { x: 20, w: 158, key: -1, big: '◀', lab: 'STEP' },
    { x: 191, w: 158, key: 0, big: '✦', lab: 'POKE' },
    { x: 362, w: 158, key: 1, big: '▶', lab: 'STEP' },
  ];
  const held = g.ptr.down;
  for (const z of zones) {
    const press = held && g.ptr.x >= z.x - 8 && g.ptr.x <= z.x + z.w + 8;
    const y = 848;
    ctx.save();
    ctx.globalAlpha = press ? .96 : .82;
    ctx.fillStyle = z.key === 0 ? 'rgba(255,140,60,.22)' : 'rgba(60,30,90,.55)';
    rr(ctx, z.x, y, z.w, 92, 18); ctx.fill();
    ctx.strokeStyle = z.key === 0 ? 'rgba(255,211,77,.95)' : 'rgba(255,255,255,.32)';
    ctx.lineWidth = 3; rr(ctx, z.x, y, z.w, 92, 18); ctx.stroke();
    ctx.restore();
    g.text(z.big, z.x + z.w / 2, y + 40, { size: 40, align: 'center', color: z.key === 0 ? '#ffe9a8' : '#fff', ink: '#0a0418' });
    g.text(z.lab, z.x + z.w / 2, y + 74, { size: 17, align: 'center', color: z.key === 0 ? '#ffd34d' : '#cfd6ff', ink: '#0a0418' });
  }
  ctx.save();
  ctx.globalAlpha = .6 + .25 * Math.sin(T * 3);
  g.text('HOLD ANYWHERE = BLOCK', W / 2, 830, { size: 17, align: 'center', color: '#fff', ink: '#0a0418' });
  ctx.restore();

  if (phase === 'intro' && phaseT < .5) {
    g.text('ROUND ' + roundN, W / 2, 420, { size: 62, align: 'center', color: '#fff', ink: '#0a0418' });
  }
}

g.run(update, draw);
resetMatch();
window.__g = g;
window.__dbg = () => ({ phase, hp: Math.round(hero.hp), rhp: Math.round(rival.hp), wins, losses, round: roundN, hx: Math.round(hero.x), rx: Math.round(rival.x) });

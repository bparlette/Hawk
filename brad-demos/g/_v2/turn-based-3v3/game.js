// TURN ORDER — turn-based-3v3 (Cat Arcade v2)
// Three cats vs three beasts, one action per turn. Speed sets the ribbon, crits stop the clock,
// and landing all three hero hits in a single round pays a TEAM COMBO bonus.
import { makeGame, sfx, music, comboPitch, clamp, lerp, damp, rnd, chance, ease, TAU, rr, circle, hexA, fmt, panel } from '../_vendor/gp2x.js';
import { drawChar, face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'turn-based-3v3', title: 'TURN ORDER', sub: 'PICK YOUR TARGET  ·  LAND THE COMBO',
  hook: 'three cats, three beasts, one ribbon of turns', w: W, h: H, bg: '#0b0817', style: 'neon',
  bloom: .8, ca: .36, vig: 1, scan: .22,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const dumb = () => isAuto && g.dumb();

/* ------------------------------------------------------------------ roster */
const HEROES = [
  { name: 'BRAMBLE', kind: 'cat', col: '#ff9a3c', hp: 46, atk: 11, spd: 12, x: 130, y: 742 },
  { name: 'MITTENS', kind: 'cat', col: '#9ff8ff', hp: 38, atk: 14, spd: 15, x: 285, y: 758 },
  { name: 'SAGE', kind: 'cat', col: '#c9a0ff', hp: 42, atk: 10, spd: 9, x: 425, y: 742 },
];
const FOES = [
  { name: 'RAT KING', kind: 'zombie', col: '#8fcf7a', hp: 34, atk: 9, spd: 14, x: 130, y: 320 },
  { name: 'BRUTE', kind: 'dog', col: '#c98a4b', hp: 52, atk: 12, spd: 8, x: 285, y: 300 },
  { name: 'WISP', kind: 'zombie', col: '#7d9dff', hp: 28, atk: 10, spd: 17, x: 425, y: 320 },
];
const WIN_ROUNDS = 1;   // one encounter, three waves of pain compressed into a single stand-off

/* ------------------------------------------------------------------ state */
let units, order, oi, active, t, phase, phaseT, anim, energy, sel, log, round, heroHits, toggle;
let bannerT, banner, killShake, uiPop, targetFlash, wave, botT, dmgTotal;

const BTN = [
  { id: 'atk', label: 'ATTACK', key: 'Digit1', x: 26, y: 838, w: 152, h: 74 },
  { id: 'skill', label: 'SKILL', key: 'Digit2', x: 194, y: 838, w: 152, h: 74 },
  { id: 'guard', label: 'GUARD', key: 'Digit3', x: 362, y: 838, w: 152, h: 74 },
];

function makeUnit(src, side) {
  return {
    ...src, side, max: src.hp, hp: src.hp, alive: true, ghost: src.hp, lunge: 0, hurt: 0,
    flashHit: 0, guard: 0, id: side + src.name, shake: 0, cd: 0,
  };
}

function resetWorld() {
  units = [...HEROES.map(h => makeUnit(h, 'hero')), ...FOES.map(f => makeUnit(f, 'foe'))];
  t = 0; oi = 0; active = null; phase = 'idle'; phaseT = 0; anim = null;
  energy = [0, 0, 0]; sel = 0; log = []; round = 1; heroHits = 0;
  bannerT = 0; banner = ''; killShake = 0; uiPop = 1; targetFlash = 0; wave = 1;
  botT = 0; dmgTotal = 0; toggle = 0;
  buildOrder();
  g.score = 0;
  g.state = { round: 1, hp: 3, foes: 3 };
  g.combo.reset(); g.fx.clear();
}
g.onReset = resetWorld;
g.onStart = () => music('boss');

const heroes = () => units.filter(u => u.side === 'hero');
const foes = () => units.filter(u => u.side === 'foe');
const aliveHeroes = () => heroes().filter(u => u.alive);
const aliveFoes = () => foes().filter(u => u.alive);
const living = () => units.filter(u => u.alive);

function buildOrder() {
  order = living().slice().sort((a, b) => b.spd - a.spd || (a.side === 'hero' ? -1 : 1));
  oi = 0;
  if (order.length) active = order[0];
}
function nextTurn() {
  oi++;
  if (oi >= order.length) { round++; heroHits = 0; buildOrder(); if (!order.length) return; }
  active = order[oi];
  if (!active || !active.alive) { nextTurn(); return; }
  phase = 'select'; phaseT = 0;
  if (active.side === 'hero') {
    sel = aliveFoes().length ? 0 : -1;
    sfx('click', { pitch: 1.15, vol: .3 });
  } else {
    sfx('tick', { pitch: .9, vol: .25 });
  }
}

/* ------------------------------------------------------------------ damage */
function hurt(attacker, target, dmg, crit) {
  if (!target.alive) return;
  const final = Math.max(1, Math.round(dmg * (target.guard > 0 ? .42 : 1) * (crit ? 1.75 : 1)));
  target.hp = Math.max(0, target.hp - final);
  target.hurt = 1; target.flashHit = 1; target.shake = crit ? 1 : .6;
  dmgTotal += final;
  const pitch = comboPitch(Math.min(11, Math.round(final / 3)));
  sfx(crit ? 'crit' : 'hit', { pitch });
  sfx('thud', { pitch: pitch * .8, vol: .4 });
  g.impact(target.x, target.y - 70, { punch: crit ? .11 : .06, shake: crit ? 16 : 9, stop: crit ? .085 : .045, rip: crit ? 1.4 : .7, flash: crit ? '#ffd34d' : '#fff', flashA: crit ? .2 : .1 });
  g.fx.burst(target.x, target.y - 70, crit ? 26 : 13, { kind: 'spark', color: [crit ? '#ffd34d' : '#fff', '#ff9a3c', target.col], speed: crit ? 420 : 260, life: .45, size: crit ? 7 : 5, drag: 2 });
  g.fx.burst(target.x, target.y - 60, crit ? 10 : 4, { kind: 'debris', color: [target.col, '#2a1a2e'], speed: 200, life: .7, size: 7, g: 1300 });
  g.popup((crit ? 'CRIT ' : '') + final, target.x, target.y - 110, crit ? '#ffd34d' : '#fff', crit ? 48 : 34);
  if (target.guard > 0) {
    g.popup('BLOCK', target.x, target.y - 150, '#9ff8ff', 24);
    g.fx.ring(target.x, target.y - 70, { r: 60, life: .3, color: '#9ff8ff', wide: 6, ripple: .8 });
    sfx('clack', { pitch: 1.2, vol: .5 });
  }
  if (target.hp <= 0) kill(target);
}

function kill(u) {
  u.alive = false;
  killShake = 1;
  g.hitstop(.12); g.slowmo(.5, .25);
  g.shake(18); g.flash('#fff', .25);
  sfx('boom', { pitch: u.side === 'foe' ? 1.1 : .8 });
  sfx('boom', { pitch: 1.05, vol: .6 });
  g.fx.burst(u.x, u.y - 70, 34, { kind: 'debris', color: [u.col, '#fff', '#2a1a2e'], speed: 400, life: 1.0, size: 9, g: 1400 });
  g.fx.burst(u.x, u.y - 70, 18, { kind: 'star', color: ['#ffd34d', '#fff'], speed: 300, life: .9, size: 10, g: 300 });
  g.fx.ring(u.x, u.y - 70, { r: 130, life: .45, color: '#fff', wide: 9, ripple: 1.3 });
  g.popup(u.name + ' DOWN', u.x, u.y - 150, '#ff7ad0', 26);
  if (u.side === 'foe') { g.score += 120; g.showBanner(u.name + ' DOWN!', .9); }
  else g.showBanner(u.name + ' FELL', .9);
}

/* ------------------------------------------------------------------ actions */
function doAttack(kind) {
  const u = active;
  if (!u || phase !== 'select') return;
  const targets = u.side === 'hero' ? aliveFoes() : aliveHeroes();
  if (!targets.length) return;
  const target = u.side === 'hero' ? targets[clamp(sel, 0, targets.length - 1)] : targets[Math.floor(Math.random() * targets.length)];
  const crit = chance(kind === 'skill' ? .3 : .16);
  const mult = kind === 'skill' ? 1.55 : kind === 'guard' ? 0 : 1;
  phase = 'anim'; phaseT = 0;
  anim = { u, target, kind, crit, mult, tt: 0, hit: false };
  u.lunge = 0;
  sfx('whoosh', { pitch: kind === 'skill' ? 1.25 : 1.05, vol: .45 });
  if (kind === 'guard') {
    u.guard = 1;
    g.fx.ring(u.x, u.y - 70, { r: 74, life: .4, color: '#9ff8ff', wide: 6, ripple: .7 });
    sfx('clack', { pitch: 1.1 });
    g.popup('GUARD', u.x, u.y - 120, '#9ff8ff', 30);
    phase = 'resolve'; phaseT = 0;
  }
}

function resolveHit() {
  const a = anim;
  if (!a || a.hit) return;
  a.hit = true;
  const u = a.u, tg = a.target;
  if (a.kind === 'skill') {
    // skills splash onto every living enemy of the opposite side — reads big at a glance
    const splash = (u.side === 'hero' ? aliveFoes() : aliveHeroes());
    for (const s of splash) hurt(u, s, u.atk * a.mult * .8, a.crit);
    g.fx.ring((u.x + tg.x) / 2, (u.y + tg.y) / 2 - 60, { r: 220, life: .5, color: u.col, wide: 12, ripple: 1.6 });
    g.fx.burst(tg.x, tg.y - 70, 30, { kind: 'star', color: [u.col, '#fff', '#ffd34d'], speed: 420, life: .8, size: 10, g: 260 });
    g.flash(u.col, .18); g.shake(14); g.hitstop(.08);
    sfx('laser', { pitch: 1.2 }); sfx('laser', { pitch: .95, vol: .5 });
    if (u.side === 'hero') { g.score += 90; energy[heroes().indexOf(u)] = 0; }
  } else if (a.kind === 'attack') {
    hurt(u, tg, u.atk, a.crit);
    if (u.side === 'hero') { g.score += 30; energy[heroes().indexOf(u)] = Math.min(100, energy[heroes().indexOf(u)] + 34); }
  }
  if (u.side === 'hero' && a.kind !== 'guard') {
    heroHits++;
    if (heroHits === 3 && aliveFoes().length) {
      g.showBanner('TEAM COMBO!', 1.1);
      sfx('win', { pitch: 1.2 }); g.flash('#ffd34d', .22); g.punch(.12);
      const tf = aliveFoes();
      for (const f of tf) hurt(u, f, 8, false);
      g.score += 150;
    }
  }
}

/* ------------------------------------------------------------------ AI */
function foeAct() {
  const u = active;
  if (!u || u.side !== 'foe') return;
  const hs = aliveHeroes();
  if (!hs.length) return;
  // readable AI: prefer the weakest hero, sometimes guard when hurt
  const weak = hs.slice().sort((a, b) => a.hp - b.hp)[0];
  const kind = u.hp < u.max * .35 && chance(.35) ? 'guard' : chance(.28) ? 'skill' : 'attack';
  sel = Math.max(0, aliveHeroes().indexOf(weak));
  const before = phase;
  phase = 'select';
  doAttack(kind);
  if (phase === before) phase = 'select';
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;
  bannerT -= dt;
  killShake = Math.max(0, killShake - dt * 2.5);
  uiPop = Math.max(1, uiPop - dt * 2.4);
  targetFlash = Math.max(0, targetFlash - dt * 3);

  for (const u of units) {
    u.ghost = damp(u.ghost, u.hp, 6, dt);
    u.hurt = Math.max(0, u.hurt - dt * 3.4);
    u.flashHit = Math.max(0, u.flashHit - dt * 5);
    u.shake = Math.max(0, u.shake - dt * 4);
    u.guard = Math.max(0, u.guard - dt * .9);
    if (u.side === 'hero') u.y = u.y; // heroes hold their ground
  }

  if (g.mode !== 'play') { if (anim) anim = null; return; }

  /* input */
  if (phase === 'select' && active && active.side === 'hero') {
    const foel = aliveFoes();
    for (let ti = 0; ti < g.taps.length; ti++) {
      const p = g.taps[ti];
      // tapping an enemy selects it as the target
      for (let i = 0; i < foel.length; i++) {
        const f = foel[i];
        if (Math.abs(p.x - f.x) < 84 && Math.abs(p.y - (f.y - 70)) < 108) {
          if (sel === i) doAttack('attack'); else { sel = i; sfx('click', { pitch: 1.3, vol: .5 }); targetFlash = 1; }
        }
      }
    }
    if (g.pressed.ArrowLeft) { sel = (sel + foel.length - 1) % Math.max(1, foel.length); sfx('click', { pitch: 1.2, vol: .4 }); }
    if (g.pressed.ArrowRight) { sel = (sel + 1) % Math.max(1, foel.length); sfx('click', { pitch: 1.2, vol: .4 }); }
  }

  /* the action buttons (touch + keys + bot share one path) */
  const canAct = phase === 'select' && active && active.side === 'hero';
  const hi = canAct ? heroes().indexOf(active) : -1;
  const bAtk = g.btn('atk', BTN[0].x, BTN[0].y, BTN[0].w, BTN[0].h, BTN[0].label, { key: 'Digit1' });
  const bSkl = g.btn('skill', BTN[1].x, BTN[1].y, BTN[1].w, BTN[1].h, BTN[1].label, { key: 'Digit2' });
  const bGrd = g.btn('guard', BTN[2].x, BTN[2].y, BTN[2].w, BTN[2].h, BTN[2].label, { key: 'Digit3' });
  if (canAct && hi >= 0) {
    if (bAtk.pressed) doAttack('attack');
    else if (bSkl.pressed) { if (energy[hi] >= 100) doAttack('skill'); else { sfx('click', { pitch: .7 }); g.popup('NEED CHARGE', 270, 800, '#ff7ad0', 24); } }
    else if (bGrd.pressed) doAttack('guard');
  }

  /* bot */
  if (isAuto && phase === 'select' && active) {
    botT -= dt;
    if (active.side === 'foe') {
      if (botT <= 0) { botT = dumb() ? .9 : .45; if (dumb()) { /* enemies still swing: the loss has to land */ } foeAct(); }
    } else if (botT <= 0) {
      botT = dumb() ? 1.1 : .34;
      const hs = aliveHeroes(), hi2 = hs.indexOf(active);
      const foesAlive = aliveFoes();
      if (!foesAlive.length) return;
      // pick the foe the team can finish first
      let bi = 0, bh = 1e9;
      for (let i = 0; i < foesAlive.length; i++) if (foesAlive[i].hp < bh) { bh = foesAlive[i].hp; bi = i; }
      sel = bi;
      if (energy[hi2] >= 100) doAttack('skill');
      else if (active.hp < active.max * .3 && chance(.3)) doAttack('guard');
      else doAttack('attack');
    }
  }

  /* animation timeline */
  if (phase === 'anim' && anim) {
    anim.tt += dt;
    const u = anim.u;
    u.lunge = u.lunge + (anim.tt < .18 ? 1 : -1.6) * dt * 6;
    u.lunge = clamp(u.lunge, 0, 1);
    if (anim.tt > .16 && !anim.hit) resolveHit();
    if (anim.tt > .32) { phase = 'resolve'; phaseT = 0; u.lunge = 0; }
  }
  if (phase === 'resolve') {
    phaseT += dt;
    if (phaseT > .34) {
      anim = null;
      if (!aliveFoes().length) {
        g.end({ win: true, score: Math.round(g.score + 500 + aliveHeroes().length * 200), label: 'SCORE', progress: 1 });
        return;
      }
      if (!aliveHeroes().length) {
        g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: clamp(1 - aliveFoes().length / 3, 0, .9) });
        return;
      }
      nextTurn();
    }
  }
  if (phase === 'idle') nextTurn();

  g.state = { round, hp: aliveHeroes().length, foes: aliveFoes().length, progress: +clamp(1 - aliveFoes().length / 3, 0, 1).toFixed(2) };
  g.score = Math.round(g.score);
}

/* ------------------------------------------------------------------ draw */
function drawBackdrop(ctx) {
  const sk = ctx.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#1a0f2e'); sk.addColorStop(.4, '#120a20'); sk.addColorStop(.62, '#1d1230'); sk.addColorStop(1, '#0a0612');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
  /* parallax pillars */
  ctx.save(); ctx.globalAlpha = .16;
  for (let i = 0; i < 6; i++) {
    const x = i * 108 + Math.sin(t * .3 + i) * 6;
    const gr = ctx.createLinearGradient(x, 120, x, 700);
    gr.addColorStop(0, 'rgba(160,120,255,.5)'); gr.addColorStop(1, 'rgba(60,30,90,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, 120, 34, 620);
  }
  ctx.restore();
  /* arena floor */
  const fl = ctx.createLinearGradient(0, 620, 0, 840);
  fl.addColorStop(0, 'rgba(120,90,200,.22)'); fl.addColorStop(1, 'rgba(20,10,30,.9)');
  ctx.fillStyle = fl; ctx.fillRect(0, 620, W, 230);
  ctx.strokeStyle = 'rgba(180,150,255,.16)'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(270, 700, 60 + i * 46, 14 + i * 9, 0, 0, TAU); ctx.stroke(); }
  /* drifting motes */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) {
    const x = (i * 137 + t * 12) % W, y = 200 + (i * 91 + Math.sin(t * .6 + i) * 30) % 620;
    ctx.globalAlpha = .05 + .04 * Math.sin(t * 2 + i); ctx.fillStyle = '#c9a0ff';
    ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawUnit(ctx, u) {
  if (!u.alive) {
    ctx.save(); ctx.globalAlpha = .12;
    drawChar(u.kind, ctx, u.x, u.y, 108, { color: u.col });
    ctx.restore();
    g.text('✕', u.x, u.y - 60, { size: 54, align: 'center', stroke: 6, color: 'rgba(255,80,80,.6)' });
    return;
  }
  const isActive = u === active && (phase === 'select' || phase === 'anim');
  const bob = Math.sin(t * 2.4 + u.x * .01) * 2;
  const lunge = u.lunge;
  const dy = u.side === 'hero' ? -lunge * 26 : lunge * 26;
  ctx.save();
  /* target ring for the currently selected foe */
  if (u.side === 'foe' && active && active.side === 'hero' && phase === 'select') {
    const foel = aliveFoes();
    if (foel[sel] === u) {
      const pr = 1 + Math.sin(t * 8) * .06;
      ctx.save(); ctx.strokeStyle = '#ff5a4d'; ctx.lineWidth = 4;
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(u.x, u.y + 6, 62 * pr, 20 * pr, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .3; ctx.beginPath(); ctx.ellipse(u.x, u.y + 6, 46 * pr, 14 * pr, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
  if (isActive) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 + .1 * Math.sin(t * 5);
    const gl = ctx.createRadialGradient(u.x, u.y - 60, 6, u.x, u.y - 60, 110);
    gl.addColorStop(0, u.col); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(u.x, u.y - 60, 110, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.translate((Math.random() - .5) * u.shake * 10, dy + (Math.random() - .5) * u.shake * 10);
  const sq = 1 + u.hurt * .1 - u.flashHit * .05;
  ctx.scale(1 / sq, sq);
  ctx.translate(u.x, u.y + bob);
  ctx.translate(-u.x, -(u.y + bob));
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, 40, 12, 0, 0, TAU); ctx.fill();
  drawChar(u.kind, ctx, u.x, u.y + bob, 112, { color: u.col });
  if (u.flashHit > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = u.flashHit * .8;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(u.x, u.y - 56, 46, 54, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (u.guard > 0) {
    ctx.save(); ctx.globalAlpha = .3 + .2 * Math.sin(t * 9);
    ctx.strokeStyle = '#9ff8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(u.x, u.y - 56, 62, 0, TAU); ctx.stroke(); ctx.restore();
  }
  ctx.restore();

  /* name + HP bars: solid bar for real hp, ghost bar drains behind it */
  const bw = 104, bx = u.x - bw / 2, by = u.y + 18;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, bx - 2, by - 2, bw + 4, 14, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, bx, by, bw, 10, 4); ctx.fill();
  const ghostW = bw * clamp(u.ghost / u.max, 0, 1);
  const hpW = bw * clamp(u.hp / u.max, 0, 1);
  ctx.fillStyle = u.side === 'hero' ? '#7dff7d' : '#ff5a4d';
  rr(ctx, bx, by, hpW, 10, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(ctx, bx + hpW, by, Math.max(0, ghostW - hpW), 10, 4); ctx.fill();
  g.text(u.name, u.x, by + 32, { size: 15, align: 'center', stroke: 3, color: 'rgba(255,255,255,.8)' });
}

function drawRibbon(ctx) {
  if (!order || !order.length) return;
  const n = order.length, w = Math.min(62, 500 / Math.max(1, n));
  const x0 = (W - n * w) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, x0 - 12, 18, n * w + 24, 74, 16); ctx.fill();
  for (let i = 0; i < n; i++) {
    const u = order[i];
    const x = x0 + i * w + w / 2, y = 56;
    const now = i === oi;
    const s = now ? 1 + Math.sin(t * 8) * .06 : .86;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y);
    ctx.fillStyle = u.alive ? hexA(u.col, now ? .95 : .4) : 'rgba(60,60,70,.5)';
    rr(ctx, x - w / 2 + 4, y - 26, w - 8, 52, 10); ctx.fill();
    if (now) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(ctx, x - w / 2 + 4, y - 26, w - 8, 52, 10); ctx.stroke(); }
    face(ctx, u.kind, x, y - 4, 14, u.col);
    ctx.restore();
    if (!u.alive) g.text('✕', x, y + 8, { size: 26, align: 'center', stroke: 4, color: '#ff5a4d' });
  }
  ctx.restore();
  g.text('ROUND ' + round, W / 2, 112, { size: 20, align: 'center', stroke: 4, color: 'rgba(255,255,255,.55)' });
}

function drawHUD(ctx) {
  /* combo + score */
  g.text(fmt(g.score), 26, 132, { size: 40, stroke: 6 });
  /* hero energy bars sit above the buttons */
  const hs = heroes();
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i], x = 24 + i * 170;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, x, 796, 150, 12, 6); ctx.fill();
    const full = energy[i] >= 100;
    ctx.fillStyle = full ? (Math.sin(t * 10) > 0 ? '#ffd34d' : '#fff') : h.col;
    rr(ctx, x, 796, 150 * clamp(energy[i] / 100, 0, 1), 12, 6); ctx.fill();
    g.text(full ? 'READY' : Math.round(energy[i]) + '%', x + 75, 826, { size: 15, align: 'center', stroke: 3, color: full ? '#ffd34d' : 'rgba(255,255,255,.6)' });
  }
  /* whose turn */
  if (active && (phase === 'select' || phase === 'anim')) {
    const s = active.side === 'hero' ? 'YOUR TURN — ' + active.name : 'ENEMY — ' + active.name;
    g.text(s, W / 2, 780, { size: 22, align: 'center', stroke: 4, color: active.side === 'hero' ? '#9ff8ff' : '#ff9a3c' });
  }
  if (phase === 'select' && active && active.side === 'hero') {
    g.text('TAP A TARGET', 270, 828, { size: 16, align: 'center', stroke: 3, color: 'rgba(255,255,255,.45)' });
  }
}

function draw() {
  const ctx = g.ctx;
  drawBackdrop(ctx);
  drawRibbon(ctx);
  /* enemies draw back-to-front so overlap reads clean */
  for (const u of units) if (u.side === 'foe') drawUnit(ctx, u);
  for (const u of units) if (u.side === 'hero') drawUnit(ctx, u);
  drawHUD(ctx);
  if (killShake > 0) { ctx.save(); ctx.globalAlpha = killShake * .1; ctx.fillStyle = '#ff7ad0'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

resetWorld();
g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ round, phase, active: active && active.name, foes: aliveFoes().length, heroes: aliveHeroes().length, energy: energy.map(v => Math.round(v)), score: Math.round(g.score) });

// CARD CATS — CAT ARCADE V2 · a real deck run, not a clicker.
// Draw 4–5 cards, pay energy, read the intent over the enemy's head, thin the deck, clear 5 waves.
import {
  makeGame, sfx, music, clamp, rnd, R, TAU, rr, hexA, damp, ease, shuffle, starPath, shadow,
} from '../_vendor/gp2x.js';
import { drawChar, heart } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const AUTO = new URLSearchParams(location.search).has('auto');

const g = makeGame({
  id: 'card-roguelite', title: 'CARD CATS', sub: 'DRAW · PLAY · SURVIVE',
  hook: 'five waves, one deck, no mercy',
  w: W, h: H, bg: '#0b0716', style: 'toon', bloom: .9, ca: .35, vig: 1, scan: .16, grain: .05,
});
g.state = { wave: 0, hp: 0, ehp: 0, phase: 'play', deck: 0 };

/* ------------------------------------------------------------------ card data */
const DEF = {
  strike: { n: 'STRIKE', e: 1, dmg: 8, col: '#ff6a3c', ic: 'claw' },
  guard: { n: 'GUARD', e: 1, blk: 10, col: '#48a9ff', ic: 'shield' },
  claw: { n: 'CLAW', e: 2, dmg: 17, col: '#ff2b5e', ic: 'claw' },
  snack: { n: 'SNACK', e: 1, heal: 7, col: '#ffd34d', ic: 'heart' },
  focus: { n: 'FOCUS', e: 1, str: 2, col: '#c86bff', ic: 'star' },
  twin: { n: 'TWIN', e: 1, dmg: 5, hits: 2, col: '#ff8fc8', ic: 'claw' },
  heavy: { n: 'HEAVY', e: 3, dmg: 28, col: '#ff8a1f', ic: 'claw' },
};
const START = ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'claw', 'claw', 'snack'];
const POOL = ['heavy', 'twin', 'claw', 'guard', 'focus', 'snack', 'strike'];
const RANK = { heavy: 6, twin: 5, claw: 4, focus: 3, guard: 2, snack: 1, strike: 0 };

const WAVES = [
  { hp: 20, dmg: 9, name: 'GOO KING', kind: 'slime', col: '#6ee7a0' },
  { hp: 27, dmg: 11, name: 'FROG WITCH', kind: 'mushfrog', col: '#ff9a3c' },
  { hp: 36, dmg: 13, name: 'ROT HOUND', kind: 'zombie', col: '#8fcf7a' },
  { hp: 42, dmg: 14, name: 'GRAVE REAPER', kind: 'reaper', col: '#b06bff' },
  { hp: 52, dmg: 16, name: 'THE PHANTOM', kind: 'phantom', col: '#ff2b5e' },
];
const PAT = [['atk', 'atk', 'block', 'atk', 'atk', 'block'], ['atk', 'atk', 'block', 'atk', 'charge', 'atk', 'block', 'atk']];

/* ------------------------------------------------------------------ layout */
const CW = 92, CH = 134, HAND_Y = 792;
const EX = 336, EY = 452, EH = 202;
const PX = 122, PY = 638, PH = 152;
const DECKP = { x: 503, y: 742 }, DISCP = { x: 38, y: 742 };
const BTN = { x: 18, y: 876, w: 504, h: 62 };

/* ------------------------------------------------------------------ scenery */
const FAR = [];
for (let i = 0; i < 11; i++) FAR.push({ x: -20 + i * 58 + R() * 26, w: 30 + R() * 40, h: 46 + R() * 150, lit: R() });
const MOTES = [];
for (let i = 0; i < 30; i++) MOTES.push({ x: R() * W, y: 300 + R() * 620, s: 1 + R() * 2.6, p: R() * TAU, v: 8 + R() * 22 });

/* ------------------------------------------------------------------ runtime */
let deck, discard, hand, flies, energy, hp, maxHp, block, str, wave, e, intent,
  score, phase, pT, decideT, reward, botT, autoT, played, dmgTaken, hurtT, catHurt, catVis,
  deadT, winc, progress, rsFlash;

function mk(id) {
  const d = DEF[id];
  return { id, def: d, x: DECKP.x, y: DECKP.y, s: .5, rot: 0, a: 1, tx: 270, ty: HAND_Y, tr: 0, at: 0, d0: 0, fresh: true, flash: 0 };
}

function resetWorld() {
  deck = shuffle(START.slice());
  discard = []; hand = []; flies = [];
  energy = 3; maxHp = 34; hp = 34; block = 0; str = 0;
  wave = 0; score = 0; played = 0; dmgTaken = 0; hurtT = 0; catHurt = 0; deadT = 0;
  catVis = { x: PX, y: PY, s: 1, sq: 0 };
  progress = 0; rsFlash = 0;
  phase = 'player'; pT = 0; decideT = 0; reward = null; botT = .3; autoT = 0; winc = 0;
  e = null; intent = null;
  g.score = 0; g.combo.reset(); g.fx.clear();
  startWave(0, true);
  syncState();
  music('tense');
}

function syncState() {
  g.state = {
    wave: wave + 1, hp: Math.round(hp), ehp: e ? Math.max(0, Math.round(e.hp)) : 0,
    phase, deck: deck.length, hand: hand.length, energy,
  };
}

/* ------------------------------------------------------------------ waves + turns */
function startWave(i, silent) {
  const w = WAVES[i];
  wave = i;
  e = {
    hp: w.hp, max: w.hp, armor: 0, dmg: w.dmg, name: w.name, kind: w.kind, col: w.col,
    rage: 0, turn: 0, charge: 0, fl: 0, at: 0, x: EX, y: EY, die: 0,
  };
  if (!silent) { g.showBanner('WAVE ' + (i + 1), 1.1); sfx('drum', { vol: .7 }); }
  if (i === 4) music('boss');
  startTurn(true);
}

function startTurn(first) {
  phase = 'player'; decideT = 0; block = 0;
  energy = 3 + (winc >= 0 ? 0 : 0);
  drawHand(wave >= 1 ? 5 : 4);
  rollIntent();
  syncState();
  if (!first) sfx('blip', { pitch: 1.2, vol: .35 });
}

function drawHand(n) {
  while (hand.length) discard.push(hand.pop().id);
  for (let i = 0; i < n; i++) {
    if (!deck.length) {
      if (!discard.length) break;
      deck = shuffle(discard); discard = []; rsFlash = .5;
      sfx('snap', { pitch: .8, vol: .4 });
    }
    const c = mk(deck.pop());
    c.d0 = i * .045;
    hand.push(c);
  }
  layoutHand();
  sfx('pour', { vol: .18, pitch: 1 + n * .04 });
}

function layoutHand() {
  const n = hand.length, sp = n > 1 ? Math.min(84, 400 / (n - 1)) : 0;
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2, c = hand[i];
    c.tx = 270 + t * sp;
    c.ty = HAND_Y - Math.abs(t) * 5;
    c.tr = t * .05;
  }
}

function rollIntent() {
  if (!e) return;
  const pat = PAT[wave >= 3 ? 1 : 0];
  let k = pat[e.turn % pat.length];
  if (e.charge > 0) k = 'atk';
  if (k === 'atk') intent = { k, v: Math.round(e.charge > 0 ? e.dmg * 1.7 + e.rage : e.dmg + e.rage), big: e.charge > 0 };
  else intent = { k, v: 0 };
}

function intentDamage() {
  if (!intent) return 0;
  return intent.k === 'atk' ? intent.v : 0;
}

function endTurn() {
  if (phase !== 'player') return;
  while (hand.length) discard.push(hand.pop().id);
  phase = 'enemy'; pT = 0; decideT = 0;
  sfx('click', { vol: .5, pitch: .9 });
  syncState();
}

function enemyAct() {
  if (!intent || !e) return;
  if (intent.k === 'atk') {
    const raw = intent.v;
    const absorbed = Math.min(block, raw);
    block -= absorbed;
    const dmg = raw - absorbed;
    if (absorbed > 0) {
      g.popup('BLOCK ' + absorbed, PX + 30, PY - 150, '#7fd0ff', 30);
      g.fx.burst(PX + 10, PY - 80, 12, { color: ['#7fd0ff', '#fff'], speed: 260, size: 6, life: .4 });
      sfx('shield', { pitch: 1.1 + absorbed * .01, vol: .6 });
    }
    if (dmg > 0) hitPlayer(dmg, intent.big);
    e.charge = 0;
  } else if (intent.k === 'block') {
    e.armor += 10;
    g.popup('+10 ARMOR', e.x, e.y - EH - 20, '#7fd0ff', 28);
    g.fx.emit('ring', e.x, e.y - 100, { size: 90, life: .45, color: '#7fd0ff', add: true, wide: 8 });
    sfx('shield', { vol: .55, pitch: .9 });
  } else if (intent.k === 'charge') {
    e.charge = 1;
    g.popup('CHARGING!', e.x, e.y - EH - 30, '#ff2b5e', 34);
    g.fx.blast(e.x, e.y - 110, { r: 90, color: '#ff2b5e', n: 16, punch: .07, shake: 8, smoke: false });
    sfx('charge', { vol: .7 });
    g.shake(5);
  }
  e.rage += 2; e.turn++;
  if (phase === 'player') rollIntent();
}

function hitPlayer(dmg, big) {
  hp -= dmg; dmgTaken += dmg; catHurt = .28; hurtT = .5;
  g.combo.miss();
  g.popup('-' + dmg, PX + 8, PY - 150, '#ff5d6e', big ? 46 : 36);
  g.impact(PX + 4, PY - 74, { punch: big ? .14 : .08, shake: big ? 20 : 12, stop: big ? .1 : .05, flash: '#ff2b4d', flashA: big ? .26 : .14, sfx: 'thud', pitch: big ? .7 : 1 });
  g.fx.burst(PX + 4, PY - 80, big ? 22 : 14, { color: ['#ff2b4d', '#fff', '#ff9a3c'], speed: 330, size: 7, life: .5 });
  catVis.sq = 1;
  syncState();
  if (hp <= 0) {
    hp = 0; phase = 'dying'; pT = 0; deadT = 0;
    g.slowmo(.35, 1.2); g.flash('#ff2b4d', .5); g.shake(22);
    sfx('groan', { vol: .8 });
    syncState();
  }
}

function waveClear() {
  winc = wave;
  score += 120 + wave * 90;
  g.score = score;
  progress = (wave + 1) / WAVES.length;
  g.combo.reset();
  e.die = 1;
  g.fx.blast(e.x, e.y - 100, { r: 150, color: e.col, colors: [e.col, '#fff', '#ffd34d'], n: 34, punch: .18, shake: 20, smoke: true });
  g.fx.burst(e.x, e.y - 100, 30, { kind: 'confetti', color: [e.col, '#ffd34d', '#fff'], speed: 420, size: 7, life: 1.1, g: 380 });
  g.hitstop(.11); g.flash('#fff', .3);
  sfx('boom', { vol: .8 }); sfx('fanfare', { vol: .6 });
  if (hp < maxHp) { const heal = Math.min(11, maxHp - hp); hp += heal; g.popup('+' + heal + ' HP', PX, PY - 160, '#7dff7d', 30); }
  if (wave >= WAVES.length - 1) {
    phase = 'win'; pT = 0;
    g.showBanner('RUN CLEARED', 1.6);
    g.slowmo(.4, 1); g.flash('#ffd34d', .35);
    for (let i = 0; i < 3; i++) g.fx.burst(270, 380, 26, { kind: 'confetti', color: ['#ffd34d', '#ff5a3c', '#7dff7d', '#4aa8ff'], speed: 520, size: 8, life: 1.4, g: 300 });
    syncState();
    return;
  }
  phase = 'reward'; pT = 0; botT = .25;
  const offer = [];
  const pool = POOL.slice();
  for (let i = 0; i < 3; i++) offer.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  reward = { offer, picked: -1, t: 0, x: [138, 270, 402] };
  e = e;
  syncState();
}

function pickReward(i) {
  if (!reward || reward.picked >= 0) return;
  reward.picked = i;
  const id = reward.offer[i];
  deck.push(id);
  deck = shuffle(deck.concat(discard)); discard = [];
  sfx('powerup', { vol: .8 });
  g.popup('+' + DEF[id].n, 270, 372, DEF[id].col, 34);
  g.fx.burst(reward.x[i], 470, 18, { kind: 'star', color: [DEF[id].col, '#fff'], speed: 300, size: 8, life: .8, g: 240 });
  startWave(wave + 1, false);
}

/* ------------------------------------------------------------------ playing cards */
function playCard(c) {
  if (phase !== 'player' || !c) return;
  const d = c.def;
  if (energy < d.e) {
    c.flash = .3; g.shake(3); sfx('thud', { vol: .35, pitch: 1.5 });
    g.popup('NEED ' + d.e + '⚡', c.tx, c.ty - 90, '#ff9a3c', 24);
    return;
  }
  energy -= d.e;
  hand.splice(hand.indexOf(c), 1);
  layoutHand();
  played++;
  const f = { card: c, def: d, x: c.x, y: c.y, s: c.s, a: 1, rot: c.rot, t: 0, done: false, out: false, dead: false };
  flies.push(f);
  g.tween(f, 'x', 270, .15, ease.outCubic);
  g.tween(f, 'y', 500, .15, ease.outCubic);
  g.tween(f, 's', 1.5, .15, ease.outBack);
  g.tween(f, 'rot', 0, .15);
  sfx('whoosh', { vol: .3, pitch: 1.25 });
  g.punch(.03);
  syncState();
}

function resolveCard(d) {
  if (phase !== 'player' || !e) return;
  if (d.dmg) {
    const hits = d.hits || 1;
    let total = 0;
    for (let i = 0; i < hits; i++) {
      let amt = d.dmg + str;
      if (e.armor > 0) {
        const ab = Math.min(e.armor, amt);
        e.armor -= ab; amt -= ab;
        if (ab > 0) g.popup('ARMOR', e.x + 40, e.y - EH + 24, '#7fd0ff', 22);
      }
      if (amt > 0) { e.hp -= amt; total += amt; }
    }
    hitEnemy(total, d);
  } else if (d.blk) {
    block += d.blk;
    g.popup('+' + d.blk, PX + 24, PY - 150, '#7fd0ff', 34);
    g.fx.emit('ring', PX + 4, PY - 74, { size: 84, life: .38, color: '#7fd0ff', add: true, wide: 8 });
    sfx('shield', { vol: .6, pitch: 1.3 });
    g.combo.hit(PX + 4, PY - 100, '+10');
    score += 10;
  } else if (d.heal) {
    const h = Math.min(d.heal, maxHp - hp);
    hp += h;
    g.popup('+' + h, PX, PY - 160, '#7dff7d', 36);
    for (let i = 0; i < 8; i++) g.fx.emit('heart', PX + rnd(-24, 24), PY - 60, { vx: rnd(-40, 40), vy: -80 - R() * 90, g: 40, life: 1, size: rnd(8, 14), color: '#7dff7d', add: true });
    sfx('powerup', { vol: .6, pitch: 1.2 });
    score += 10;
  } else if (d.str) {
    str += d.str;
    g.popup('+' + d.str + ' STR', PX, PY - 160, '#c86bff', 34);
    g.fx.blast(PX + 4, PY - 80, { r: 80, color: '#c86bff', colors: ['#c86bff', '#fff', '#ff8fc8'], n: 18, punch: .06, shake: 6, smoke: false });
    sfx('charge', { vol: .55, pitch: 1.3 });
    score += 10;
  }
  syncState();
}

function hitEnemy(total, d) {
  if (total <= 0) {
    g.popup('0', e.x, e.y - EH + 34, '#9aa', 30);
    sfx('thud', { vol: .3, pitch: 1.6 });
    return;
  }
  score += Math.round(total * 1.6);
  g.score = score;
  e.hp -= 0; e.fl = .22;
  const big = total >= 16;
  const ix = e.x + rnd(-10, 10), iy = e.y - EH + 92;
  g.popup('-' + total, e.x, e.y - EH + 30, big ? '#ffd34d' : '#fff', big ? 50 : 38);
  g.impact(ix, iy, { punch: big ? .16 : .07, shake: big ? 18 : 9, stop: big ? .09 : .035, flash: '#fff', flashA: big ? .22 : .1, sfx: big ? 'crit' : 'hit', pitch: big ? .9 : 1.15 });
  g.fx.burst(ix, iy, big ? 24 : 12, { color: ['#fff', d.col, '#ffd34d'], speed: big ? 420 : 280, size: 7, life: .5 });
  g.fx.emit('ring', ix, iy, { size: big ? 120 : 70, life: .3, color: '#fff', add: true, wide: big ? 9 : 6 });
  if (big) g.fx.blast(ix, iy, { r: 110, color: d.col, colors: [d.col, '#fff', '#ffd34d'], n: 20, punch: .1, shake: 14, smoke: false });
  g.combo.hit(ix, iy, '+' + total);
  catVis.sq = 1;
  if (e.hp <= 0) { e.hp = 0; waveClear(); }
}

/* ------------------------------------------------------------------ bot */
function botReward() {
  let bi = 0, bv = -99;
  reward.offer.forEach((id, i) => {
    let v = RANK[id] || 0;
    if (id === 'snack' && hp < maxHp * .6) v += 5;
    if (id === 'focus' && str >= 6) v -= 3;
    if (HAS(id) >= 2) v -= 2;
    if (v > bv) { bv = v; bi = i; }
  });
  return bi;
}
function HAS(id) { let n = 0; for (const c of deck) if (c === id) n++; return n; }

function bestCard() {
  const inc = intentDamage();
  let best = null, bv = 1.5;
  for (const c of hand) {
    const d = c.def;
    if (d.e > energy) continue;
    let v = 0;
    if (d.dmg) {
      const amt = (d.dmg + str) * (d.hits || 1);
      v = amt * 1.05;
      if (amt >= e.hp + e.armor) v += 70;
      if (inc - block >= hp) v -= 20;
    } else if (d.blk) {
      v = Math.min(inc, d.blk) * 1.2 + (inc > 0 ? 2 : 0);
      if (inc - block >= hp) v += 220;
      if (inc === 0) v = .2;
    } else if (d.heal) {
      v = hp < maxHp * .55 ? 11 : 1;
      if (hp <= 8) v += 30;
    } else if (d.str) {
      v = e.turn <= 2 && str < 6 ? 15 : 6;
      if (inc - block >= hp) v -= 8;
    }
    if (v > bv) { bv = v; best = c; }
  }
  return best;
}

function botThink(dt) {
  if (phase === 'reward') {
    botT -= dt;
    if (botT <= 0 && reward && reward.picked < 0) { pickReward(g.dumb() ? 0 : botReward()); botT = .3; }
    return;
  }
  if (phase !== 'player') return;
  if (flies.some(f => !f.done)) return;
  botT -= dt;
  if (botT > 0) return;
  if (g.dumb()) { endTurn(); botT = .5; return; }
  const c = bestCard();
  if (c) { playCard(c); botT = .09; }
  else { endTurn(); botT = .35; }
}

/* ------------------------------------------------------------------ input */
function readInput() {
  const b = g.btn('end', BTN.x, BTN.y, BTN.w, BTN.h, 'END TURN', { key: 'Enter' });
  if (b.pressed && phase === 'player') endTurn();

  if (phase === 'reward' && reward && reward.picked < 0) {
    for (const p of g.taps) {
      for (let i = 0; i < 3; i++) if (Math.abs(p.x - reward.x[i]) < 70 && Math.abs(p.y - 470) < 100) { pickReward(i); return; }
    }
  }
  if (phase !== 'player') return;
  if (flies.some(f => !f.done)) return;

  for (const p of g.taps) {
    for (let i = hand.length - 1; i >= 0; i--) {
      const c = hand[i];
      if (Math.abs(p.x - c.x) < CW / 2 + 4 && Math.abs(p.y - c.y) < CH / 2 + 8) { playCard(c); return; }
    }
  }
  for (let i = 0; i < hand.length; i++) {
    const k = 'Digit' + (i + 1);
    if (g.pressed[k]) { playCard(hand[i]); return; }
  }
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode !== 'play') { syncState(); return; }
  autoT += dt;
  if (AUTO) botThink(dt); else if (g.dumb()) botThink(dt);
  readInput();

  if (phase === 'player') {
    decideT += dt;
    if (decideT > 3.6) endTurn();
  }
  if (phase === 'enemy') {
    const was = pT; pT += dt;
    if (was < .34 && pT >= .34) enemyAct();
    if (pT > 1.0) { if (hp > 0) startTurn(false); }
  }
  if (phase === 'reward') {
    reward.t += dt;
    if (reward.picked < 0 && reward.t > 4.5) pickReward(botReward());
  }
  if (phase === 'dying') {
    pT += dt; deadT += dt;
    if (pT > .9) {
      g.end({ win: false, score, label: 'SCORE', progress: clamp((wave + (e ? 1 - e.hp / e.max : 0)) / WAVES.length, .05, .95) });
      return;
    }
  }
  if (phase === 'win') {
    pT += dt;
    if (pT > 1.1) { g.end({ win: true, score, label: 'SCORE', progress: 1 }); return; }
  }

  /* juice */
  hurtT = Math.max(0, hurtT - dt);
  catHurt = Math.max(0, catHurt - dt);
  catVis.sq = Math.max(0, catVis.sq - dt * 4);
  rsFlash = Math.max(0, rsFlash - dt * 2);
  if (e) { e.fl = Math.max(0, e.fl - dt); e.at += dt; }
  for (const c of hand) { c.flash = Math.max(0, c.flash - dt * 3); }

  /* hand layout animation */
  for (const c of hand) {
    c.at += dt;
    if (c.at >= c.d0) {
      c.x = damp(c.x, c.tx, 17, dt);
      c.y = damp(c.y, c.ty, 17, dt);
      c.s = damp(c.s, 1, 17, dt);
      c.rot = damp(c.rot, c.tr, 17, dt);
    }
  }

  /* cards in flight */
  for (const f of flies) {
    f.t += dt;
    if (!f.done && f.t > .15) { f.done = true; resolveCard(f.def); if (phase !== 'player' && phase !== 'reward' && phase !== 'win') { } }
    if (f.done && !f.out && f.t > .34) {
      f.out = true;
      g.tween(f, 'x', DISCP.x, .26);
      g.tween(f, 'y', DISCP.y, .26);
      g.tween(f, 's', .3, .26);
      g.tween(f, 'rot', rnd(-.5, .5), .26);
      g.tween(f, 'a', 0, .26, undefined, () => { f.dead = true; });
      discard.push(f.def === DEF.snack ? 'snack' : Object.keys(DEF).find(k => DEF[k] === f.def));
    }
  }
  if (flies.some(f => f.dead)) flies = flies.filter(f => !f.dead);

  /* ambience */
  for (const m of MOTES) {
    m.y -= m.v * dt; m.p += dt * 2;
    if (m.y < 240) { m.y = 930; m.x = rnd(0, W); }
  }
  if (R() < dt * 6 && e && e.hp > 0) g.fx.emit('glow', e.x + rnd(-52, 52), e.y - rnd(20, 150), { vy: -18, life: .9, size: 16, color: hexA(e.col, .5), add: true });
  syncState();
}

/* ------------------------------------------------------------------ draw */
function icon(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y);
  if (kind === 'claw') {
    c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const ox = i * s * .42;
      c.beginPath();
      c.moveTo(ox + s * .16, -s * .58);
      c.quadraticCurveTo(ox - s * .3, 0, ox + s * .3, s * .6);
      c.lineWidth = s * .24; c.strokeStyle = '#0b0713'; c.stroke();
      c.lineWidth = s * .15; c.strokeStyle = col; c.stroke();
      c.lineWidth = s * .05; c.strokeStyle = '#fff'; c.globalAlpha = .75; c.stroke(); c.globalAlpha = 1;
    }
  } else if (kind === 'shield') {
    c.beginPath();
    c.moveTo(0, -s * .82); c.lineTo(s * .64, -s * .46); c.lineTo(s * .64, s * .12);
    c.quadraticCurveTo(s * .48, s * .68, 0, s * .92);
    c.quadraticCurveTo(-s * .48, s * .68, -s * .64, s * .12);
    c.lineTo(-s * .64, -s * .46); c.closePath();
    c.fillStyle = col; c.fill();
    c.lineWidth = s * .17; c.strokeStyle = '#0b0713'; c.stroke();
    c.globalAlpha = .35; c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -s * .62); c.lineTo(s * .32, -s * .36); c.lineTo(0, s * .3); c.closePath(); c.fill();
    c.globalAlpha = 1;
  } else if (kind === 'heart') {
    heart(c, 0, 0, s * 1.2, col);
  } else if (kind === 'star') {
    starPath(c, 0, 0, s * .78, 0);
    c.fillStyle = col; c.fill(); c.lineWidth = s * .16; c.strokeStyle = '#0b0713'; c.stroke();
    c.fillStyle = '#fff'; c.globalAlpha = .5; starPath(c, -s * .1, -s * .12, s * .3, 0); c.fill(); c.globalAlpha = 1;
  }
  c.restore();
}

function drawCardShape(c, d, alpha) {
  c.globalAlpha = alpha;
  c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, -CW / 2 + 4, -CH / 2 + 8, CW, CH, 13); c.fill();
  const gr = c.createLinearGradient(0, -CH / 2, 0, CH / 2);
  gr.addColorStop(0, '#332a5e'); gr.addColorStop(.55, '#1d1738'); gr.addColorStop(1, '#120e24');
  c.fillStyle = gr; rr(c, -CW / 2, -CH / 2, CW, CH, 13); c.fill();
  // header band
  c.fillStyle = hexA(d.col, .9); rr(c, -CW / 2 + 6, -CH / 2 + 6, CW - 12, 24, 8); c.fill();
  c.globalAlpha = alpha * .5; c.fillStyle = '#fff'; rr(c, -CW / 2 + 6, -CH / 2 + 6, CW - 12, 10, 8); c.fill();
  c.globalAlpha = alpha;
  // art well
  c.fillStyle = 'rgba(0,0,0,.34)'; rr(c, -CW / 2 + 8, -CH / 2 + 34, CW - 16, 62, 9); c.fill();
  icon(c, d.ic, 2, -CH / 2 + 64, 26, d.col);
  // value
  const val = d.dmg ? String((d.dmg) + str) + (d.hits ? '×' + d.hits : '') : d.blk ? String(d.blk) : d.heal ? '+' + d.heal : '+' + d.str;
  g.text(val, 0, CH / 2 - 40, { size: 25, align: 'center', color: '#fff', stroke: 5 });
  g.text(d.n, 0, CH / 2 - 16, { size: 13, align: 'center', color: hexA(d.col, .95), stroke: 4 });
  // cost orb
  c.beginPath(); c.arc(-CW / 2 + 17, -CH / 2 + 12, 15, 0, TAU);
  c.fillStyle = '#0d0a1a'; c.fill();
  c.strokeStyle = d.col; c.lineWidth = 3; c.stroke();
  g.text(String(d.e), -CW / 2 + 17, -CH / 2 + 21, { size: 21, align: 'center', color: '#ffd34d', stroke: 4 });
  // frame
  c.strokeStyle = hexA(d.col, .95); c.lineWidth = 3; rr(c, -CW / 2, -CH / 2, CW, CH, 13); c.stroke();
  c.globalAlpha = 1;
}

function drawCardAt(c, d, x, y, s, rot, alpha) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  drawCardShape(c, d, alpha);
  c.restore();
}

function drawHandCards(c) {
  const n = hand.length;
  for (let i = 0; i < n; i++) {
    const card = hand[i];
    const bob = Math.sin(g.t * 2.4 + i * .7) * 1.6;
    const shakeX = card.flash > 0 ? Math.sin(card.flash * 90) * 5 : 0;
    drawCardAt(c, card.def, card.x + shakeX, card.y + bob, card.s, card.rot, 1);
    if (energy >= card.def.e) {
      c.save(); c.globalAlpha = .5 + .3 * Math.sin(g.t * 4 + i);
      c.strokeStyle = '#ffd34d'; c.lineWidth = 2;
      c.translate(card.x, card.y + bob); c.rotate(card.rot); c.scale(card.s, card.s);
      rr(c, -CW / 2 - 2, -CH / 2 - 2, CW + 4, CH + 4, 15); c.stroke();
      c.restore();
    }
  }
  for (const f of flies) {
    if (f.a <= 0) continue;
    c.save();
    c.globalAlpha = f.a * .5;
    const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 90 * f.s);
    gr.addColorStop(0, hexA(f.def.col, .8)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(f.x, f.y, 90 * f.s, 0, TAU); c.fill();
    c.restore();
    drawCardAt(c, f.def, f.x, f.y, f.s, f.rot, Math.min(1, f.a));
  }
}

function drawPiles(c) {
  // deck stack — thins as cards are drawn
  const dn = deck.length, hgt = clamp(dn, 1, 8) * 3;
  for (let i = 0; i < Math.max(1, Math.ceil(dn / 3)); i++) {
    c.fillStyle = i === 0 ? '#3a2f6a' : '#2a2250';
    rr(c, DECKP.x - 15, DECKP.y - hgt / 2 + i * 2 - 8, 30, 40, 5); c.fill();
    c.strokeStyle = '#5a4a9a'; c.lineWidth = 1.5; c.stroke();
  }
  c.globalAlpha = .9;
  g.text(String(dn), DECKP.x, DECKP.y + 46, { size: 22, align: 'center', color: '#b9a9ff', stroke: 4 });
  c.globalAlpha = 1;
  // discard
  c.fillStyle = '#261f42'; rr(c, DISCP.x - 15, DISCP.y - 28, 30, 40, 5); c.fill();
  c.strokeStyle = '#4a3f78'; c.lineWidth = 1.5; c.stroke();
  g.text(String(discard.length), DISCP.x, DISCP.y + 30, { size: 22, align: 'center', color: '#8f83c9', stroke: 4 });
  g.text('DECK', DECKP.x, DECKP.y - 34, { size: 12, align: 'center', color: '#8f83c9', stroke: 3 });
  g.text('USED', DISCP.x, DISCP.y - 34, { size: 12, align: 'center', color: '#8f83c9', stroke: 3 });
}

function drawIntent(c) {
  if (!intent || !e || e.hp <= 0) return;
  const bx = e.x, by = 176;
  const isAtk = intent.k === 'atk';
  const col = intent.k === 'charge' ? '#ff2b5e' : isAtk ? (intent.big ? '#ff2b5e' : '#ff8a3c') : '#4aa8ff';
  const pulse = 1 + Math.sin(g.t * (intent.big ? 9 : 5)) * (intent.big ? .05 : .03);
  c.save(); c.translate(bx, by); c.scale(pulse, pulse);
  c.fillStyle = 'rgba(10,6,20,.88)';
  rr(c, -62, -40, 124, 80, 16); c.fill();
  c.strokeStyle = col; c.lineWidth = 3.5; rr(c, -62, -40, 124, 80, 16); c.stroke();
  c.globalAlpha = .28; c.fillStyle = col; rr(c, -62, -40, 124, 80, 16); c.fill(); c.globalAlpha = 1;
  // pointer
  c.beginPath(); c.moveTo(-12, 40); c.lineTo(0, 56); c.lineTo(12, 40); c.closePath();
  c.fillStyle = 'rgba(10,6,20,.88)'; c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
  if (intent.k === 'block') {
    icon(c, 'shield', -28, -2, 24, col);
    g.text('+10', 16, 8, { size: 30, align: 'center', color: '#fff', stroke: 5 });
    g.text('ARMOR', 0, 30, { size: 12, align: 'center', color: col, stroke: 3 });
  } else if (intent.k === 'charge') {
    g.text('!!', 0, -2, { size: 40, align: 'center', color: col, stroke: 6 });
    g.text('CHARGING', 0, 28, { size: 15, align: 'center', color: col, stroke: 4 });
  } else {
    icon(c, 'claw', -30, -2, 20, col);
    g.text(String(intent.v), 20, 10, { size: 36, align: 'center', color: '#fff', stroke: 6 });
    g.text(intent.big ? 'BIG HIT' : 'ATTACK', 0, 32, { size: 12, align: 'center', color: col, stroke: 3 });
  }
  c.restore();
}

function drawEnemy(c) {
  if (!e) return;
  const dead = e.die;
  const sh = dead ? 0 : 1;
  const bob = Math.sin(e.at * 2.1) * 4;
  const jit = e.fl > 0 ? Math.sin(e.fl * 64) * 7 : 0;
  c.save();
  c.globalAlpha = sh;
  // ground rune
  c.save();
  c.translate(e.x, e.y);
  c.scale(1, .3);
  c.globalAlpha = .5;
  c.strokeStyle = hexA(e.col, .7); c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, 96, 0, TAU); c.stroke();
  c.globalAlpha = .8;
  c.beginPath(); c.arc(0, 0, 96, g.t * .8, g.t * .8 + 2.1); c.stroke();
  c.restore();
  c.restore();
  shadow(c, e.x, e.y, 58, 15, .3);
  drawChar(e.kind, c, e.x + jit, e.y + bob, EH * (1 + (dead ? .6 : 0)), {
    dir: -1, t: e.at, anim: 'idle', color: e.col, hurt: e.fl > 0,
  });
  // rage tag
  if (e.rage > 0 && e.hp > 0) {
    c.globalAlpha = .95;
    g.text('RAGE +' + e.rage, e.x, e.y - EH / 2 + 6, { size: 18, align: 'center', color: '#ff8a3c', stroke: 4 });
    c.globalAlpha = 1;
  }
}

function drawCat(c) {
  const hurt = catHurt > 0;
  const sq = 1 + catVis.sq * .22;
  const bob = Math.sin(g.t * 2.6) * 2;
  shadow(c, catVis.x, PY, 42, 12, .32);
  c.save();
  c.translate(catVis.x, PY);
  c.scale(2 - sq, sq);
  c.translate(-catVis.x, -PY);
  drawChar('cat', c, catVis.x, PY + bob, PH, { dir: 1, t: g.t, anim: idleAnim(), color: hurt ? '#ffd0d8' : '#ff9a3c', hurt });
  c.restore();
  if (block > 0) {
    c.save();
    c.globalAlpha = .35 + .2 * Math.sin(g.t * 6);
    c.strokeStyle = '#7fd0ff'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(catVis.x, PY - 76, 54, 84, 0, 0, TAU); c.stroke();
    c.globalAlpha = .12; c.fillStyle = '#7fd0ff'; c.fill();
    c.restore();
  }
}
function idleAnim() { return phase === 'enemy' ? 'idle' : 'idle'; }

function drawArena(c) {
  // sky
  const sky = c.createLinearGradient(0, 0, 0, 800);
  sky.addColorStop(0, '#0e0520'); sky.addColorStop(.34, '#26103f');
  sky.addColorStop(.66, '#4b1240'); sky.addColorStop(1, '#17081c');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const gc = e ? e.col : '#ff2b5e';
  const pulse = .5 + .5 * Math.sin(g.t * 1.9);
  const rg = c.createRadialGradient(EX, EY - 130, 12, EX, EY - 130, 330);
  rg.addColorStop(0, hexA(gc, .22 + .16 * pulse)); rg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, 800);
  // far towers (parallax)
  c.save();
  c.translate(Math.sin(g.t * .1) * 12, 0);
  for (const b of FAR) {
    const top = 300 - b.h;
    c.fillStyle = '#150b25';
    c.fillRect(b.x - b.w / 2, top, b.w, b.h + 4);
    c.fillStyle = '#1b0f2e';
    for (let i = 0; i < 3; i++) c.fillRect(b.x - b.w / 2 + i * (b.w / 2.4), top - 9, b.w / 6, 11);
    c.fillStyle = hexA('#ffcf6b', .16 + .1 * Math.sin(g.t * 2 + b.lit * 9));
    if (b.lit > .45) c.fillRect(b.x - 3, top + b.h * .3, 6, 10);
    if (b.lit > .7) c.fillRect(b.x - 3, top + b.h * .62, 6, 10);
  }
  c.restore();
  // mid pillars + banners
  c.fillStyle = '#1d1130';
  c.fillRect(-6, 150, 46, 560); c.fillRect(500, 150, 46, 560);
  c.fillStyle = '#2a1945';
  c.fillRect(0, 150, 34, 560); c.fillRect(506, 150, 34, 560);
  for (const px of [17, 523]) {
    c.fillStyle = '#3a2456'; rr(c, px - 20, 138, 40, 22, 6); c.fill();
    c.fillStyle = '#3a2456'; rr(c, px - 20, 690, 40, 22, 6); c.fill();
  }
  c.save(); c.translate(0, Math.sin(g.t * 1.1) * 3);
  for (const bx of [96, 444]) {
    const gr = c.createLinearGradient(0, 176, 0, 420);
    gr.addColorStop(0, '#7a1030'); gr.addColorStop(1, '#3a0820');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(bx - 28, 172); c.lineTo(bx + 28, 172); c.lineTo(bx + 28, 380);
    c.quadraticCurveTo(bx + 14, 404, bx, 386); c.quadraticCurveTo(bx - 14, 404, bx - 28, 380);
    c.closePath(); c.fill();
    c.fillStyle = hexA('#ffd34d', .5); starPath(c, bx, 262, 15, 0); c.fill();
  }
  c.restore();
  // floor
  const fg = c.createLinearGradient(0, 320, 0, 900);
  fg.addColorStop(0, 'rgba(60,20,70,0)'); fg.addColorStop(.4, 'rgba(80,24,80,.35)');
  fg.addColorStop(.72, 'rgba(30,10,36,.86)'); fg.addColorStop(1, 'rgba(12,6,18,.97)');
  c.fillStyle = fg; c.fillRect(0, 320, W, 640);
  // ground lines
  c.strokeStyle = hexA(gc, .3); c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 470); c.lineTo(W, 470); c.stroke();
  c.strokeStyle = 'rgba(255,150,220,.14)';
  c.beginPath(); c.moveTo(0, 656); c.lineTo(W, 656); c.stroke();
}

function drawMotes(c) {
  for (const m of MOTES) {
    c.globalAlpha = .18 + .3 * (Math.sin(m.p) * .5 + .5);
    c.fillStyle = '#ffd9a0';
    c.beginPath(); c.arc(m.x, m.y, m.s, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  if (rsFlash > 0) { c.globalAlpha = rsFlash * .3; c.fillStyle = '#b9a9ff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  if (hurtT > 0) {
    const a = hurtT * .5;
    const vg = c.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 560);
    vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, `rgba(255,20,40,${a})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
}

function drawHUD(c) {
  // wave pips
  for (let i = 0; i < WAVES.length; i++) {
    const x = 34 + i * 30, y = 34;
    const done = i < wave || (i === winc && winc > 0 && phase !== 'player');
    const cur = i === wave;
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    const s = cur ? 9 + Math.sin(g.t * 6) * 1.6 : 8;
    c.fillStyle = done ? '#ffd34d' : cur ? '#ff8a3c' : 'rgba(255,255,255,.16)';
    c.fillRect(-s / 2, -s / 2, s, s);
    c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2; c.strokeRect(-s / 2, -s / 2, s, s);
    c.restore();
  }
  g.text('SCORE ' + Math.round(score).toLocaleString(), 512, 44, { size: 22, align: 'right', color: '#ffd34d' });
  if (e && e.hp > 0) {
    g.text(e.name, 270, 82, { size: 22, align: 'center', color: '#fff', stroke: 5 });
    // enemy hp
    const bx = 76, bw = 388, by = 96, bh = 26;
    c.fillStyle = 'rgba(0,0,0,.6)'; rr(c, bx - 3, by - 3, bw + 6, bh + 6, 8); c.fill();
    c.fillStyle = '#3a0e18'; rr(c, bx, by, bw, bh, 6); c.fill();
    const r = clamp(e.hp / e.max, 0, 1);
    const hg = c.createLinearGradient(bx, 0, bx + bw, 0);
    hg.addColorStop(0, '#ff2b5e'); hg.addColorStop(1, '#ff8a3c');
    c.fillStyle = hg; rr(c, bx, by, Math.max(0, bw * r), bh, 6); c.fill();
    if (e.armor > 0) {
      c.fillStyle = 'rgba(120,200,255,.75)';
      rr(c, bx, by, Math.max(0, bw * clamp(e.armor / e.max, 0, 1)), bh, 6); c.fill();
    }
    c.globalAlpha = .35; c.fillStyle = '#fff'; rr(c, bx, by, Math.max(0, bw * r), bh * .4, 6); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 2; rr(c, bx, by, bw, bh, 6); c.stroke();
    g.text(`${Math.round(e.hp)} / ${e.max}`, 270, by + 20, { size: 19, align: 'center', color: '#fff', stroke: 4 });
  }
  // player hp
  const px = 54, py = 664, pw = 196, ph = 22;
  heart(c, 32, py + 11, 26, '#ff4d6d');
  c.fillStyle = 'rgba(0,0,0,.62)'; rr(c, px - 3, py - 3, pw + 6, ph + 6, 8); c.fill();
  c.fillStyle = '#2a1020'; rr(c, px, py, pw, ph, 6); c.fill();
  const hr = clamp(hp / maxHp, 0, 1);
  const hg2 = c.createLinearGradient(px, 0, px + pw, 0);
  hg2.addColorStop(0, hp < maxHp * .3 ? '#ff2b4d' : '#38d67a'); hg2.addColorStop(1, hp < maxHp * .3 ? '#ff8a3c' : '#9bff7a');
  c.fillStyle = hg2; rr(c, px, py, Math.max(0, pw * hr), ph, 6); c.fill();
  c.globalAlpha = .3; c.fillStyle = '#fff'; rr(c, px, py, Math.max(0, pw * hr), ph * .4, 6); c.fill(); c.globalAlpha = 1;
  c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 2; rr(c, px, py, pw, ph, 6); c.stroke();
  g.text(`${Math.max(0, Math.round(hp))}/${maxHp}`, px + pw / 2, py + 17, { size: 18, align: 'center', color: '#fff', stroke: 4 });
  if (block > 0) {
    c.fillStyle = 'rgba(72,169,255,.28)'; rr(c, 260, py - 4, 58, ph + 8, 8); c.fill();
    c.strokeStyle = '#7fd0ff'; c.lineWidth = 2.5; rr(c, 260, py - 4, 58, ph + 8, 8); c.stroke();
    icon(c, 'shield', 278, py + 11, 13, '#9ad6ff');
    g.text(String(block), 300, py + 18, { size: 20, align: 'center', color: '#d7efff', stroke: 4 });
  }
  if (str > 0) {
    icon(c, 'star', 344, py + 11, 11, '#c86bff');
    g.text('+' + str, 362, py + 18, { size: 19, align: 'left', color: '#e3b6ff', stroke: 4 });
  }
  // energy orbs
  for (let i = 0; i < 3; i++) {
    const ex = 434 + i * 32, ey = py + 11, on = i < energy;
    c.beginPath(); c.arc(ex, ey, 14, 0, TAU);
    c.fillStyle = on ? '#ffd34d' : 'rgba(255,255,255,.1)'; c.fill();
    c.strokeStyle = on ? '#fff6cf' : 'rgba(255,255,255,.28)'; c.lineWidth = 2.5; c.stroke();
    if (on) {
      c.save(); c.translate(ex, ey); c.fillStyle = '#7a4a00';
      c.beginPath(); c.moveTo(-3, -8); c.lineTo(5, -1); c.lineTo(0, -1); c.lineTo(4, 8); c.lineTo(-5, 0); c.lineTo(0, 0); c.closePath(); c.fill();
      c.restore();
    }
  }
  g.text('TURN ' + (e ? e.turn + 1 : 1), 512, py + 18, { size: 16, align: 'right', color: '#8f83c9' });
  // decision clock
  if (phase === 'player') {
    const u = clamp(decideT / 3.6, 0, 1);
    c.strokeStyle = u > .8 ? '#ff5a3c' : 'rgba(255,255,255,.35)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(24, 738); c.lineTo(24 + 492 * (1 - u), 738); c.stroke();
  }
}

function drawReward(c) {
  if (!reward) return;
  c.fillStyle = 'rgba(8,5,18,.72)'; c.fillRect(0, 0, W, H);
  g.text('WAVE CLEARED', 270, 286, { size: 46, align: 'center', color: '#7dff7d', stroke: 8 });
  g.text('TAKE A CARD', 270, 336, { size: 26, align: 'center', color: '#dcd4ff', stroke: 5 });
  for (let i = 0; i < reward.offer.length; i++) {
    const id = reward.offer[i], d = DEF[id];
    const lift = reward.picked === i ? -18 : Math.sin(g.t * 2.4 + i) * 4;
    const pulse2 = .5 + .5 * Math.sin(g.t * 3 + i * 1.2);
    c.save();
    c.globalAlpha = .3 + pulse2 * .3;
    const gr = c.createRadialGradient(reward.x[i], 470, 0, reward.x[i], 470, 120);
    gr.addColorStop(0, hexA(d.col, .8)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(reward.x[i], 470, 120, 0, TAU); c.fill();
    c.restore();
    drawCardAt(c, d, reward.x[i], 470 + lift, 1.32, Math.sin(g.t * 1.6 + i) * .03, 1);
  }
  g.text('+8 HP', 270, 606, { size: 26, align: 'center', color: '#7dff7d', stroke: 5 });
  const left = Math.max(0, 4.5 - reward.t);
  g.text(left.toFixed(1), 270, 646, { size: 20, align: 'center', color: '#8f83c9', stroke: 4 });
}

let drawN = 0;
function draw(c) {
  drawN++;
  drawArena(c);
  drawEnemy(c);
  drawCat(c);
  drawMotes(c);
  drawHUD(c);
  drawPiles(c);
  drawHandCards(c);
  drawIntent(c);
  if (phase === 'reward') drawReward(c);
  if (phase === 'win') {
    c.globalAlpha = .5 + .3 * Math.sin(g.t * 10);
    g.text('RUN CLEARED', 270, 300, { size: 52, align: 'center', color: '#ffd34d', stroke: 9 });
    c.globalAlpha = 1;
  }
  if (phase === 'dying') {
    c.globalAlpha = Math.min(1, pT * 2) * .8;
    g.text('DOWN...', 270, 300, { size: 50, align: 'center', color: '#ff5a5a', stroke: 9 });
    c.globalAlpha = 1;
  }
  if (played === 0 && phase === 'player' && wave === 0 && drawN > 2) {
    c.globalAlpha = .55 + .45 * Math.sin(g.t * 3);
    g.text('TAP A CARD', 270, 716, { size: 26, align: 'center', color: '#fff', stroke: 5 });
    c.globalAlpha = 1;
  }
}

resetWorld();
g.onReset = resetWorld;
g.onStart = () => music('tense');
g.run(update, draw);

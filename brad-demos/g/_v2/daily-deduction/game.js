// WHODUNNIT — daily-deduction (Cat Arcade v2)
// Four suspects, three clues, one culprit. Every clue set is verified to leave exactly one cat standing.
// Solve three cases before the clock runs out. Wrong accusations cost you ten seconds.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ease, inRect, TAU, rr, hexA, fmt, panel } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'daily-deduction', title: 'WHODUNNIT', sub: 'READ THE CLUES  ·  NAME THE CULPRIT',
  hook: 'three clues, four cats, one thief', w: W, h: H, bg: '#0d0a14', style: 'soft',
  bloom: .72, ca: .24, vig: .96, scan: .1,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const dumb = () => isAuto && g.dumb();

const HATS = ['red', 'blue', 'green', 'none'];
const COLORS = ['orange', 'grey', 'white', 'black'];
const ACCS = ['bowtie', 'scarf', 'glasses', 'none'];
const HAT_HEX = { red: '#ff4d4d', blue: '#4d9dff', green: '#4dff9d', none: '#6a5a4a' };
const COL_HEX = { orange: '#ff9a3c', grey: '#9aa4b0', white: '#f2f2f2', black: '#3a3a48' };
const CASES = 3;
const ROUND_T = 60;

/* ------------------------------------------------------------------ state */
let suspects, culprit, clues, revealed, caseNo, timeLeft, t, guessed, wrongT, solveT;
let stamp, stampT, cardIn, botT, hits, solved, shakeT;

/* feel state: flat scalars + fixed arrays — nothing allocated per frame */
const pressK = [0, 0, 0, 0];      // press squash per card (decays)
const enterT = [0, 0, 0, 0];      // staggered card entrance timeline
const clueLit = [0, 0, 0];        // clue card flash: green on reveal
const clueFail = [0, 0, 0];       // clue card flash: red when it rules a suspect out
let hoverIdx = -1, bloomK = 0, whyK = 0, whyIdx = -1, whySus = -1;
let tally = 0, tallyTo = -1, caseClock = 0, idleT = 0, hintT = 0, clueT = 0, tickT = 0, dustT = 0;

const isDumb = () => dumb();
const SLOT = { y: 470, w: 232, h: 236, gx: 16, gy: 18 };
const slot = i => ({ x: 22 + (i % 2) * (SLOT.w + SLOT.gx), y: SLOT.y + Math.floor(i / 2) * (SLOT.h + SLOT.gy) });

/* ------------------------------------------------------------------ puzzle gen
   A clue set is only accepted when the culprit matches every clue and exactly one
   suspect survives them all — so the bot (and the player) can always deduce it. */
const TESTS = [
  { text: s => `wore a ${s.hat} hat`, test: (s, v) => s.hat === v, vals: HATS, k: 'hat' },
  { text: s => `had ${s.color} fur`, test: (s, v) => s.color === v, vals: COLORS, k: 'color' },
  { text: s => `wore ${s.acc === 'none' ? 'no accessories' : 'a ' + s.acc}`, test: (s, v) => s.acc === v, vals: ACCS, k: 'acc' },
];
const NOT = [
  { text: s => `did NOT wear a ${s.hat} hat`, test: (s, v) => s.hat !== v, vals: HATS, k: 'hat' },
  { text: s => `did NOT have ${s.color} fur`, test: (s, v) => s.color !== v, vals: COLORS, k: 'color' },
  { text: s => `was NOT the one with ${s.acc === 'none' ? 'no accessories' : 'a ' + s.acc}`, test: (s, v) => s.acc !== v, vals: ACCS, k: 'acc' },
];

function dealCase() {
  const pool = [];
  for (const h of HATS) for (const c of COLORS) for (const a of ACCS) {
    if (h === 'none' && a === 'none') continue; // avoid twins with zero distinguishing traits
    pool.push({ hat: h, color: c, acc: a, hop: Math.random() * TAU });
  }
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const set = pool.slice(0, 4);
  for (let i = 0; i < set.length; i++) {
    let dup = true, guard = 0;
    while (dup && guard++ < 40) {
      dup = false;
      for (let j = 0; j < i; j++) if (JSON.stringify([set[i].hat, set[i].color, set[i].acc]) === JSON.stringify([set[j].hat, set[j].color, set[j].acc])) dup = true;
      if (dup) { set[i].hat = HATS[Math.floor(Math.random() * HATS.length)]; set[i].color = COLORS[Math.floor(Math.random() * COLORS.length)]; set[i].acc = ACCS[Math.floor(Math.random() * ACCS.length)]; }
    }
  }
  const ci = Math.floor(Math.random() * set.length);
  const sus = set.map((s, i) => ({ ...s, i, alive: true, shown: 0, strike: 0 }));
  const cr = sus[ci];

  /* build a clue list that uniquely fingers the culprit */
  const cands = [];
  for (const T of TESTS) cands.push({ ...T, v: cr[T.k], pos: true });
  for (const N of NOT) for (const v of N.vals) if (N.test(cr, v)) cands.push({ ...N, v, pos: false });
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }

  const survivors = (list) => sus.filter(s => list.every(c => (c.pos ? c.test(s, c.v) : c.test(s, c.v))));
  let chosen = [];
  for (let tries = 0; tries < 12; tries++) {
    chosen = [];
    for (const c of cands) {
      if (chosen.length >= 3) break;
      const trial = [...chosen, c];
      if (survivors(trial).length >= 1) chosen = trial;
      if (survivors(chosen).length === 1) break;
    }
    if (survivors(chosen).length === 1) break;
  }
  // guarantee uniqueness with a final safety clue if the greedy pass fell short
  if (survivors(chosen).length !== 1) {
    for (const c of cands) {
      const trial = [...chosen, c];
      if (survivors(trial).length === 1) { chosen = trial; break; }
    }
  }
  suspectOrder = sus;
  culprit = ci;
  suspects = sus;
  clues = chosen.map(c => ({ text: c.pos ? c.text(cr) : c.text(cr) }));
  // dedupe identical texts
  const seen = new Set(); clues = clues.filter(c => !seen.has(c.text) && seen.add(c.text));
  // final truth check: recompute survivors from the rendered clue objects
  const surv = sus.filter(s => clues.every(c => passes(s, c.text)));
  if (surv.length !== 1 || surv[0].i !== ci) {
    // fall back to explicit trait clues that are guaranteed unique
    clues = [{ text: `wore a ${cr.hat} hat` }, { text: `had ${cr.color} fur` }];
    const s2 = sus.filter(s => s.hat === cr.hat && s.color === cr.color);
    if (s2.length !== 1) clues.push({ text: `wore ${cr.acc === 'none' ? 'no accessories' : 'a ' + cr.acc}` });
  }
  revealed = 0; cardIn = 0; clueT = 0; caseClock = 0; idleT = 0;
  clueLit.fill(0); clueFail.fill(0);
  whyK = 0; whyIdx = -1; whySus = -1;
  /* tiles drop in on a stagger so a new case never just "appears" */
  for (let i = 0; i < 4; i++) { enterT[i] = -i * .085; pressK[i] = 0; }
  /* the camera settles in from a touch of push-in */
  g.cam.scale = 1.045;
  g.tween(g.cam, 'scale', 1, .85, ease.outCubic);
  sfx('whoosh', { pitch: 1.15, vol: .22 });
}

function passes(s, text) {
  const m1 = text.match(/wore a (\w+) hat/); if (m1) return s.hat === m1[1];
  const m1n = text.match(/did NOT wear a (\w+) hat/); if (m1n) return s.hat !== m1n[1];
  const m2 = text.match(/had (\w+) fur/); if (m2) return s.color === m2[1];
  const m2n = text.match(/did NOT have (\w+) fur/); if (m2n) return s.color !== m2n[1];
  const m3 = text.match(/wore no accessories/); if (m3) return s.acc === 'none';
  const m3b = text.match(/wore a (\w+)/); if (m3b) return s.acc === m3b[1];
  const m3n = text.match(/NOT the one with no accessories/); if (m3n) return s.acc !== 'none';
  const m3nb = text.match(/NOT the one with a (\w+)/); if (m3nb) return s.acc !== m3nb[1];
  return true;
}

let suspectOrder = [];

/* ------------------------------------------------------------------ flow */
function resetWorld() {
  t = 0; caseNo = 0; timeLeft = ROUND_T; guessed = false; wrongT = 0; solveT = 0;
  stamp = null; stampT = 0; hits = 0; solved = 0; shakeT = 0; botT = 0;
  hoverIdx = -1; bloomK = 0; tally = 0; tallyTo = -1; hintT = 0; tickT = 0; dustT = 0;
  g.score = 0; g.state = { case: 1, solved: 0 };
  g.combo.reset(); g.fx.clear();
  g.cam.scale = 1;
  if (g.post) { g.post.bloom = .72; g.post.ca = .24; }
  dealCase();
}
g.onReset = resetWorld;
g.onStart = () => music('tense');

/* ------------------------------------------------------------------ juice recipes */
/** every press on a card: a crisp clack, a squash, and a warm light under it. */
function press(i) {
  pressK[i] = 1;
  const sp = slot(i), cx = sp.x + SLOT.w / 2, cy = sp.y + SLOT.h - 26;
  sfx('click', { pitch: .9 + i * .06, vol: .55 });
  g.fx.emit('glow', cx, cy - 46, { size: 96, life: .2, color: '#ffe9b0', add: true });
  g.fx.dust(cx, cy, 4, { color: 'rgba(255,226,168,.22)', size: 11, speed: 74, up: 26, spread: 22 });
  g.punch(.012);
}

/** a clue card lands on the board: paper slap, specks, and a green light along its edge. */
function clueIn(k) {
  clueLit[k] = 1;
  const y = 178 + k * 78 + 33, cx = 34 + (W - 76) / 2;
  sfx('glass', { pitch: .88 + k * .16, vol: .32 });
  sfx('tick', { pitch: comboPitch(4 + revealed * 2), vol: .4 });
  g.fx.emit('ring', cx, y, { size: 130, life: .38, color: '#7dff7d', add: true, wide: 4, ripple: .5 });
  g.fx.burst(cx, y, 12, { kind: 'debris', color: ['#fffdf2', '#e8dfc8', '#c0392b'], speed: 190, life: .6, size: 5, g: 780 });
  g.popup('CLUE ' + (k + 1), 112, y - 2, '#ffe9b0', 20);
  g.punch(.02); g.shake(2);
}

/** the deduction lands: green burst, a chime that climbs with every correct find, bloom pulse. */
function correct(i) {
  solved++; caseNo++; hits++;
  const pitch = comboPitch(hits * 3 + 1);
  const sp = slot(i), cx = sp.x + SLOT.w / 2, cy = sp.y + 96;
  sfx('snap', { pitch: 1.1, vol: .5 });                     // confirm
  sfx('win', { pitch });                                    // the chime, rising per correct find
  sfx('ding', { pitch: pitch * 1.07, vol: .7 });
  g.impact(cx, cy, { punch: .12, shake: 13, stop: .08, rip: 1.4, flash: '#7dff7d', flashA: .26 });
  g.hitstop(.075);                                          // extra beat so the burst reads
  g.punch(.055); g.flash('#7dff7d', .16);
  g.cam.scale = 1.045; g.tween(g.cam, 'scale', 1, .5, ease.outCubic);
  bloomK = 1;                                               // bloom pulse through the post stack
  g.fx.burst(cx, cy, 42, { kind: 'star', color: ['#7dff7d', '#ffd34d', '#fff', '#a8ffcf'], speed: 430, life: .95, size: 11, g: 340 });
  g.fx.burst(cx, cy, 16, { kind: 'spark', color: ['#d8ffe4', '#7dff7d'], speed: 300, life: .6, size: 6, g: 200 });
  g.fx.emit('ring', cx, cy, { size: 190, life: .5, color: '#7dff7d', add: true, wide: 10, ripple: 1.2 });
  g.combo.hit(cx, cy - 74, 'DEDUCED');
  g.popup('CAUGHT!', cx, sp.y + 30, '#7dff7d', 42);
  const cl = clues[clamp(revealed - 1, 0, clues.length - 1)];
  if (cl) g.popup('the thief ' + cl.text, cx, sp.y + SLOT.h + 40, '#ffe9b0', 21);
  g.score += 400 + Math.round(timeLeft * 10);
  stamp = { i, ok: true }; stampT = 1;
  /* a fast deduction pays a bonus and gets its own rising flourish */
  if (caseClock < 9) {
    g.score += 150;
    sfx('coinchain', { pitch: 1.3, vol: .5 });
    sfx('perfect', { pitch: 1.15, vol: .5 });
    g.popup('+150 QUICK!', cx, sp.y + SLOT.h + 66, '#ffd34d', 25);
    g.fx.burst(cx, cy, 14, { kind: 'star', color: ['#ffd34d', '#fff'], speed: 260, life: .8, size: 8, g: 160 });
    g.flash('#ffd34d', .1); g.hitstop(.03); g.punch(.03);
    g.tween(g.cam, 'scale', 1.02, .3, ease.outBack);
  }
  if (solved >= CASES) boardComplete(); else caseCleared();
}

/** wrong accusation: red flash, shake, hit-stop, a scraped "nope" — and the reason on screen. */
function wrong(i) {
  timeLeft -= 10; wrongT = 1; shakeT = 1;
  const sp = slot(i), cx = sp.x + SLOT.w / 2, cy = sp.y + 96;
  sfx('hit', { pitch: .72, vol: .85 });                     // the scrape
  sfx('groan', { pitch: .58, vol: .6 });
  sfx('meow', { pitch: .82, vol: .3 });
  g.impact(cx, cy, { punch: .09, shake: 18, stop: .05, rip: 1, flash: '#ff5a4d', flashA: .22 });
  g.hitstop(.06);
  g.punch(.09); g.shake(18); g.flash('#ff2b4e', .16);
  g.cam.scale = 1.022; g.tween(g.cam, 'scale', 1, .32, ease.outCubic);
  g.fx.burst(cx, cy, 20, { kind: 'debris', color: ['#ff5a4d', '#2a1a2e', '#ff9a3c'], speed: 300, life: .8, size: 8, g: 1200 });
  g.fx.burst(cx, cy, 12, { kind: 'spark', color: ['#ff5a4d', '#fff'], speed: 240, life: .5, size: 5, g: 200 });
  g.fx.emit('ring', cx, cy, { size: 150, life: .4, color: '#ff5a4d', add: true, wide: 8, ripple: .9 });
  g.popup('-10s', cx, sp.y - 2, '#ff5a4d', 40);
  g.showBanner('WRONG, DETECTIVE', .9);
  g.combo.miss();
  stamp = { i, ok: false }; stampT = 1;
  explain(i);
  guessed = false;
}

/** "why": light the clue that rules this cat out, and slide in the receipt. */
function explain(i) {
  const s = suspects[i];
  whySus = i; whyK = 1.7;
  whyIdx = clues.findIndex(c => !passes(s, c.text));
  if (whyIdx < 0) whyIdx = clamp(revealed - 1, 0, clues.length - 1);
  clueFail[whyIdx] = 1;
  const y = 178 + whyIdx * 78 + 33, cx = 34 + (W - 76) / 2;
  g.fx.emit('ring', cx, y, { size: 120, life: .4, color: '#ff5a4d', add: true, wide: 6 });
  g.fx.burst(cx, y, 8, { kind: 'debris', color: ['#c0392b', '#2a1a2e'], speed: 160, life: .5, size: 6, g: 900 });
  g.popup('CLUE ' + (whyIdx + 1) + ' RULES THEM OUT', W / 2, y - 30, '#ffb3a8', 20);
}

/** one of three: still going. Banner, confetti pop, camera nudge. */
function caseCleared() {
  sfx('powerup', { pitch: 1.05, vol: .55 });
  sfx('unlock', { pitch: 1.1, vol: .45 });
  g.showBanner('CASE ' + solved + ' SOLVED', 1.15);
  g.hitstop(.045); g.punch(.09); g.shake(8); g.flash('#7dff7d', .12);
  g.cam.scale = 1.03; g.tween(g.cam, 'scale', 1, .6, ease.outCubic);
  g.fx.burst(W / 2, 244, 24, { kind: 'confetti', color: ['#7dff7d', '#ffd34d', '#fff'], speed: 280, life: 1.2, g: 320, size: 6 });
  g.fx.emit('ring', W / 2, 244, { size: 190, life: .5, color: '#7dff7d', add: true, wide: 7, ripple: 1 });
  bloomK = .85;
  solveT = 1.15;
}

/** all three cases closed: slow-mo, confetti, banner, jingle, and a score that rolls up. */
function boardComplete() {
  sfx('fanfare', { vol: .9 });
  sfx('coinchain', { pitch: 1.25, vol: .55 });
  sfx('unlock', { pitch: 1.05, vol: .5 });
  g.slowmo(.42, .95); g.hitstop(.07);
  g.punch(.16); g.shake(14); g.flash('#fff', .34);
  g.cam.scale = .965; g.tween(g.cam, 'scale', 1, 1.15, ease.outCubic);   // pull back: relief
  g.fx.blast(W / 2, 470, { r: 210, color: '#ffd34d', colors: ['#ffd34d', '#fff', '#7dff7d'], n: 38, speed: 500, shake: 10, punch: .1, flashA: .28 });
  g.fx.burst(W / 2, 430, 80, { kind: 'confetti', color: ['#ffd34d', '#7dff7d', '#7df9ff', '#ff6bd6', '#fff'], speed: 540, life: 1.9, g: 360, size: 7 });
  g.fx.burst(W / 2, 470, 20, { kind: 'star', color: ['#ffd34d', '#fff'], speed: 300, life: 1.2, size: 14, g: 120 });
  g.fx.emit('ring', W / 2, 470, { size: 300, life: .7, color: '#ffd34d', add: true, wide: 12, ripple: 1.6 });
  bloomK = 1.5;
  g.showBanner('CASE CLOSED', 1.7);
  g.popup('CASE CLOSED!', W / 2, 340, '#ffd34d', 50);
  g.combo.hit(W / 2, 312, '³⁄₃ CASES');
  tally = 0; tallyTo = Math.round(g.score + timeLeft * 20);
  solveT = 2.0;
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;
  wrongT = Math.max(0, wrongT - dt * 2);
  shakeT = Math.max(0, shakeT - dt * 2.2);
  stampT = Math.max(0, stampT - dt * 1.2);
  if (stampT <= 0) stamp = null;

  /* feel timers */
  bloomK = Math.max(0, bloomK - dt * 2.4);
  whyK = Math.max(0, whyK - dt * .9);
  for (let i = 0; i < 4; i++) { pressK[i] = Math.max(0, pressK[i] - dt * 5.2); enterT[i] = Math.min(1, enterT[i] + dt * 3.6); }
  for (let i = 0; i < 3; i++) { clueLit[i] = Math.max(0, clueLit[i] - dt * 1.5); clueFail[i] = Math.max(0, clueFail[i] - dt * .55); }
  if (g.post) { g.post.bloom = .72 + bloomK * .55; g.post.ca = .24 + wrongT * .55; }

  if (g.mode !== 'play') return;

  timeLeft -= dt;
  caseClock += dt; idleT += dt;
  if (tallyTo > 0) tally = Math.min(1, tally + dt * 1.05);
  cardIn = Math.min(1, cardIn + dt * 3.2);

  /* the case file opens one clue at a time, each with its own little landing */
  if (revealed < clues.length && cardIn > .45) {
    clueT -= dt;
    if (clueT <= 0) { clueIn(revealed); revealed++; clueT = .46; }
  }

  /* hovered card lifts — the board answers before you press */
  hoverIdx = -1;
  if (!guessed && solveT <= 0) {
    for (let i = 0; i < 4; i++) if (inRect(g.ptr, slot(i))) hoverIdx = i;
  }

  /* idle too long? tap the clues back on the table */
  if (!guessed && solveT <= 0) {
    hintT -= dt;
    if (idleT > 7 && hintT <= 0) {
      hintT = 9; idleT = 3;
      sfx('perfect', { pitch: 1.45, vol: .35 });
      for (let k = 0; k < clues.length; k++) clueLit[k] = 1;
      g.popup('REREAD THE CLUES', W / 2, 262, '#ffe9b0', 24);
      g.fx.emit('ring', W / 2, 262, { size: 210, life: .5, color: '#ffe9b0', add: true, wide: 5, ripple: .8 });
      g.punch(.02); g.flash('#ffe9b0', .08); g.hitstop(.03);
      g.tween(g.cam, 'scale', 1.02, .35, ease.outBack);
    }
  }

  /* a ticking clock under ten seconds */
  if (timeLeft < 10) {
    tickT -= dt;
    if (tickT <= 0) { tickT = .5; sfx('tick', { pitch: 1.35 + (10 - timeLeft) * .04, vol: .3 }); }
  }
  /* dust drifts off the corkboard while you think */
  dustT -= dt;
  if (dustT <= 0) { dustT = .55; g.fx.emit('dot', rnd(40, W - 40), rnd(180, 400), { vx: rnd(-8, 8), vy: rnd(10, 26), life: 2.6, size: 2.4, color: 'rgba(255,233,176,.5)' }); }

  if (solveT > 0) {
    solveT -= dt;
    if (solveT <= 0) {
      if (solved >= CASES) {
        g.end({ win: true, score: tallyTo > 0 ? tallyTo : Math.round(g.score + timeLeft * 20), label: 'SCORE', progress: 1 });
        return;
      }
      guessed = false; stamp = null; stampT = 0; timeLeft = Math.min(ROUND_T, timeLeft + 6);
      tally = 0; tallyTo = -1;
      dealCase();
    }
  }

  /* input: tap a suspect card */
  if (!guessed && solveT <= 0) {
    for (let ti = 0; ti < g.taps.length; ti++) {
      const p = g.taps[ti];
      for (let i = 0; i < suspects.length; i++) {
        if (inRect(p, slot(i))) { accuse(i); break; }
      }
    }
    for (let i = 0; i < 4; i++) if (g.pressed['Digit' + (i + 1)]) accuse(i);
  }

  /* bot: applies the clues for real — no peeking at `culprit` */
  if (isAuto && !guessed && solveT <= 0) {
    botT -= dt;
    if (botT <= 0) {
      botT = isDumb() ? 2.2 : .5;
      if (isDumb()) { accuse(Math.floor(Math.random() * 4)); }
      else {
        const live = suspects.map((s, i) => ({ s, i })).filter(o => o.s.alive);
        const ok = live.filter(o => clues.every(c => passes(o.s, c.text)));
        if (ok.length === 1) accuse(ok[0].i);
        else if (ok.length > 1) accuse(ok[0].i);      // partial info still narrows it
        else accuse(live[0].i);
      }
    }
  }

  if (timeLeft <= 0) {
    sfx('lose', { vol: .9 }); sfx('boom', { pitch: .8, vol: .5 });
    g.flash('#ff5a4d', .35); g.shake(12); g.hitstop(.05);
    g.slowmo(.5, .7);
    g.cam.scale = .99; g.tween(g.cam, 'scale', .9, .9, ease.outCubic);
    g.fx.blast(W / 2, 520, { r: 200, color: '#ff5a4d', colors: ['#ff5a4d', '#ff9a3c', '#2a1a2e'], n: 28, speed: 420, shake: 10, punch: .12, flashA: .2 });
    g.fx.burst(W / 2, 520, 18, { kind: 'debris', color: ['#2a1a2e', '#ff5a4d', '#7a6a5a'], speed: 300, life: 1, size: 9, g: 1300 });
    g.popup('TIME!', W / 2, 420, '#ff5a4d', 46);
    g.showBanner('CASE COLD', 1.4);
    g.combo.miss();
    g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: clamp(solved / CASES, 0, .95) });
    return;
  }
  g.state = { case: clamp(solved + 1, 1, CASES), solved, progress: +clamp(solved / CASES, 0, 1).toFixed(2) };
  g.score = Math.round(g.score);
}

function accuse(i) {
  if (guessed || g.mode !== 'play') return;
  const s = suspects[i];
  press(i);                                     // every press: clack + squash + light
  idleT = 0;
  if (!s.alive) {
    sfx('blip', { pitch: .68, vol: .4 });        // deselect: nothing left to accuse there
    const sp = slot(i);
    g.popup('CLEARED', sp.x + SLOT.w / 2, sp.y + 62, 'rgba(255,255,255,.7)', 22);
    g.fx.emit('ring', sp.x + SLOT.w / 2, sp.y + 110, { size: 110, life: .34, color: 'rgba(255,255,255,.5)', add: true, wide: 4 });
    g.shake(3);
    pressK[i] = 1;
    return;
  }
  guessed = true;
  if (i === culprit) correct(i); else wrong(i);
}

/* ------------------------------------------------------------------ draw */
function drawBackdrop(ctx) {
  const sk = ctx.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, '#160f22'); sk.addColorStop(.5, '#0f0a18'); sk.addColorStop(1, '#080510');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
  /* lamp pool + falling dust — the office at night */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(270, 120, 20, 270, 120, 340);
  gl.addColorStop(0, 'rgba(255,220,150,.16)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(270, 120, 340, 0, TAU); ctx.fill();
  /* the lamp breathes, and flares a touch on every win */
  const fl = .06 + .03 * Math.sin(t * 2.3) + bloomK * .05;
  ctx.globalAlpha = Math.max(0, fl);
  ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(270, 96, 46, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    const x = (i * 149 + Math.sin(t * .5 + i) * 22) % W, y = (i * 71 + t * 14) % H;
    ctx.globalAlpha = .05 + .04 * Math.sin(t * 2 + i); ctx.fillStyle = '#ffe9b0';
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
  /* corkboard */
  ctx.save(); ctx.fillStyle = 'rgba(120,80,50,.16)'; rr(ctx, 16, 156, W - 32, 268, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,160,.14)'; ctx.lineWidth = 3; rr(ctx, 16, 156, W - 32, 268, 16); ctx.stroke();
  ctx.restore();
}

function drawClues(ctx) {
  const n = Math.min(clues.length, revealed);
  for (let i = 0; i < n; i++) {
    const p = clamp((cardIn - i * .12) * 1.6, 0, 1);
    const y = 178 + i * 78;
    const x = lerp(-320, 34, ease.outBack(p));
    const lit = clueLit[i], fail = clueFail[i];
    const jit = fail > 0 ? Math.sin(t * 42 + i * 2) * fail * 3 : 0;
    ctx.save();
    ctx.translate(x + jit, y);
    ctx.rotate(lerp(-.05, 0, p));
    /* shadow + paper */
    ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, 4, 5, W - 76, 66, 12); ctx.fill();
    const cg = ctx.createLinearGradient(0, 0, 0, 66);
    cg.addColorStop(0, '#fffdf2'); cg.addColorStop(1, '#e8dfc8');
    ctx.fillStyle = cg; rr(ctx, 0, 0, W - 76, 66, 12); ctx.fill();
    /* a warm flash across the page the moment it lands */
    if (lit > 0) {
      ctx.save(); ctx.globalAlpha = lit * .5; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fffbe8'; rr(ctx, 0, 0, W - 76, 66, 12); ctx.fill();
      ctx.globalAlpha = lit * .5; ctx.fillStyle = '#ffd34d';
      rr(ctx, 0, 0, (W - 76) * lit, 66, 12); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#c0392b'; rr(ctx, 12, 20, 5, 26, 2.5); ctx.fill();
    ctx.fillStyle = '#2a2118';
    ctx.font = '900 25px Impact,"Arial Black",system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('CLUE ' + (i + 1), 28, 22);
    ctx.fillStyle = '#3a2e22'; ctx.font = '800 22px system-ui,sans-serif';
    ctx.fillText('the thief ' + clues[i].text, 28, 48);
    /* a pin */
    ctx.fillStyle = fail > 0 ? '#ff5a4d' : '#c0392b';
    ctx.beginPath(); ctx.arc(W - 76 - 16, 14, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = fail > 0 ? hexA('#ff5a4d', .35 + fail * .6) : lit > 0 ? hexA('#7dff7d', .25 + lit * .7) : 'rgba(255,255,255,.12)';
    ctx.lineWidth = 2.5 + (lit + fail) * 3;
    rr(ctx, 0, 0, W - 76, 66, 12); ctx.stroke();
    if (fail > 0) {
      ctx.globalAlpha = clamp(fail * 1.4, 0, 1);
      g.text('✗', W - 76 - 18, 50, { size: 30, align: 'center', color: '#ff5a4d', stroke: 3, ink: '#2a1a2e' });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  if (revealed < clues.length) g.text('reading the file…', W / 2, 412, { size: 18, align: 'center', stroke: 3, color: 'rgba(255,255,255,.4)' });
}

/** the receipt for a wrong accusation: which clue killed it, and what the clue actually said. */
function drawWhy(ctx) {
  if (whyK <= 0 || whyIdx < 0) return;
  const p = clamp((1.7 - whyK) / .26, 0, 1);
  const x = lerp(-360, 34, ease.outBack(p));
  ctx.save();
  ctx.translate(x, 402);
  ctx.globalAlpha = Math.min(1, whyK * 2.4);
  panel(ctx, 0, 0, W - 76 + 8, 52, { r: 12, alpha: .84, color: '#2a1014', stroke: 'rgba(255,90,90,.75)', lw: 2.5 });
  ctx.fillStyle = '#ff5a4d'; rr(ctx, 10, 12, 5, 28, 2.5); ctx.fill();
  g.text('CLUE ' + (whyIdx + 1) + ' RULES OUT #' + (whySus + 1), 26, 22, { size: 21, color: '#ffb3a8', stroke: 3, ink: '#2a1014' });
  g.text('the thief ' + (clues[whyIdx] ? clues[whyIdx].text : ''), 26, 42, { size: 17, color: '#f2e2d8', stroke: 0 });
  ctx.restore();
}

function drawSuspect(ctx, s, i) {
  const sp = slot(i);
  const et = clamp(enterT[i], 0, 1);
  const pk = pressK[i];
  if (et <= 0) return;
  const ein = ease.outBack(et);
  const dead = !s.alive;
  const hot = hoverIdx === i && !guessed && solveT <= 0;
  const shake = shakeT > 0 && stamp && stamp.i === i ? (Math.random() - .5) * shakeT * 14 : 0;
  const cx = sp.x + SLOT.w / 2, cy = sp.y + SLOT.h - 40;
  const wrongHere = whyK > 0 && whySus === i;

  ctx.save();
  ctx.globalAlpha = clamp(et * 2.4, 0, 1);
  /* entrance: rise + scale from the floor, staggered per card */
  ctx.translate(cx + shake, sp.y + SLOT.h + (1 - ein) * 96);
  ctx.scale(lerp(.74, 1, ein) * (1 + pk * .05), lerp(.74, 1, ein) * (1 - pk * .07));
  ctx.translate(-cx, -(sp.y + SLOT.h));

  /* the light: a warm pool under the card, brighter when you press */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pool = .1 + pk * .34 + (hot ? .1 : 0) + (wrongHere ? .12 : 0);
  const pg = ctx.createRadialGradient(cx, sp.y + SLOT.h - 30, 10, cx, sp.y + SLOT.h - 30, 180);
  pg.addColorStop(0, wrongHere ? `rgba(255,90,77,${pool * .8})` : `rgba(255,226,168,${pool})`);
  pg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = pg; ctx.fillRect(sp.x - 30, sp.y - 10, SLOT.w + 60, SLOT.h + 60);
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, sp.x + 4, sp.y + 6, SLOT.w, SLOT.h, 16); ctx.fill();
  const cg = ctx.createLinearGradient(sp.x, sp.y, sp.x, sp.y + SLOT.h);
  cg.addColorStop(0, dead ? 'rgba(60,50,60,.72)' : 'rgba(48,36,62,.95)');
  cg.addColorStop(1, 'rgba(16,10,24,.96)');
  ctx.fillStyle = cg; rr(ctx, sp.x, sp.y, SLOT.w, SLOT.h, 16); ctx.fill();
  ctx.strokeStyle = dead ? 'rgba(255,90,90,.35)' : wrongHere ? 'rgba(255,90,77,.85)' : hot ? 'rgba(255,226,168,.75)' : 'rgba(255,255,255,.16)';
  ctx.lineWidth = hot || wrongHere ? 4 : 3; rr(ctx, sp.x, sp.y, SLOT.w, SLOT.h, 16); ctx.stroke();

  const bob = Math.sin(t * 2 + s.hop) * 3 + Math.sin(t * 5.1 + s.hop) * .8;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, 42, 11, 0, 0, TAU); ctx.fill();
  drawChar('cat', ctx, cx, cy + bob, 120, { color: COL_HEX[s.color] });
  /* hat */
  if (s.hat !== 'none') {
    ctx.fillStyle = HAT_HEX[s.hat];
    rr(ctx, cx - 30, cy - 116 + bob, 60, 12, 6); ctx.fill();
    rr(ctx, cx - 20, cy - 142 + bob, 40, 30, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, cx - 30, cy - 108 + bob, 60, 5, 3); ctx.fill();
  }
  /* accessory */
  if (s.acc === 'bowtie') {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.moveTo(cx, cy - 52 + bob); ctx.lineTo(cx - 16, cy - 62 + bob); ctx.lineTo(cx - 16, cy - 42 + bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - 52 + bob); ctx.lineTo(cx + 16, cy - 62 + bob); ctx.lineTo(cx + 16, cy - 42 + bob); ctx.fill();
  } else if (s.acc === 'scarf') {
    ctx.fillStyle = '#4d9dff'; rr(ctx, cx - 26, cy - 60 + bob, 52, 12, 6); ctx.fill();
    rr(ctx, cx + 8, cy - 52 + bob, 12, 32, 5); ctx.fill();
  } else if (s.acc === 'glasses') {
    ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx - 14, cy - 84 + bob, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 14, cy - 84 + bob, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 1, cy - 84 + bob); ctx.lineTo(cx + 1, cy - 84 + bob); ctx.stroke();
  }
  g.text(['1', '2', '3', '4'][i], sp.x + 18, sp.y + 30, { size: 20, align: 'center', stroke: 3, color: hot ? 'rgba(255,226,168,.9)' : 'rgba(255,255,255,.4)' });

  if (dead) {
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = '#ff5a4d'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const k = Math.min(1, (stamp && stamp.i === i ? 1 - stampT : 1));
    ctx.beginPath(); ctx.moveTo(sp.x + 22, sp.y + 40); ctx.lineTo(sp.x + 22 + (SLOT.w - 44) * k, sp.y + SLOT.h - 30); ctx.stroke();
    ctx.restore();
    g.text('CLEARED', cx, sp.y + 44, { size: 26, align: 'center', stroke: 5, color: 'rgba(255,90,90,.85)' });
  }
  if (wrongHere) {
    ctx.save();
    ctx.globalAlpha = clamp(whyK * 2, 0, 1);
    ctx.strokeStyle = 'rgba(255,90,77,.9)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    const j = Math.sin(t * 30) * whyK * 4;
    ctx.beginPath(); ctx.moveTo(cx - 34 + j, cy - 92 + bob); ctx.lineTo(cx + 34 + j, cy - 34 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 34 + j, cy - 92 + bob); ctx.lineTo(cx - 34 + j, cy - 34 + bob); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawStamp(ctx) {
  if (!stamp || stampT <= 0) return;
  const sp = slot(stamp.i);
  const p = clamp((1 - stampT) * 3.4, 0, 1);
  const cx = sp.x + SLOT.w / 2, cy = sp.y + 90;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-.16);
  const sc = lerp(1.7, 1, ease.outBack(p));
  ctx.scale(sc, sc);
  ctx.globalAlpha = Math.min(1, stampT * 2.2);
  const col = stamp.ok ? '#7dff7d' : '#ff5a4d';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .5;
  ctx.fillStyle = col; rr(ctx, -100, -38, 200, 76, 12); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = col; ctx.lineWidth = 7;
  rr(ctx, -96, -34, 192, 68, 10); ctx.stroke();
  g.text(stamp.ok ? 'CAUGHT' : 'NOPE', 0, 15, { size: 46, align: 'center', stroke: 0, color: col });
  ctx.restore();
}

/** the win tally rolls up instead of snapping to a number */
function drawTally(ctx) {
  if (tallyTo <= 0) return;
  const k = ease.outCubic(clamp(tally, 0, 1));
  const shown = Math.round(lerp(0, tallyTo, k));
  const pop = 1 + .1 * Math.sin(clamp(tally, 0, 1) * Math.PI);
  ctx.save();
  ctx.globalAlpha = clamp(tally * 5, 0, 1);
  panel(ctx, W / 2 - 148, 388, 296, 78, { r: 16, alpha: .84, color: '#0b1410', stroke: 'rgba(125,255,125,.5)', lw: 2.5 });
  ctx.translate(W / 2, 434); ctx.scale(pop, pop); ctx.translate(-W / 2, -434);
  g.text('SCORE', W / 2, 412, { size: 18, align: 'center', color: 'rgba(255,255,255,.6)', stroke: 0 });
  g.text(fmt(shown), W / 2, 456, { size: 44, align: 'center', color: '#ffd34d' });
  ctx.restore();
}

function drawHUD(ctx) {
  g.text('WHODUNNIT', 26, 62, { size: 42, stroke: 6 });
  g.text('CASE ' + clamp(solved + 1, 1, CASES) + ' / ' + CASES, 26, 96, { size: 22, stroke: 4, color: 'rgba(255,255,255,.6)' });
  const frac = clamp(timeLeft / ROUND_T, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 26, 112, W - 52, 14, 7); ctx.fill();
  ctx.fillStyle = frac > .35 ? '#7dff7d' : (Math.sin(t * 12) > 0 ? '#ff5a4d' : '#ff9a3c');
  rr(ctx, 26, 112, (W - 52) * frac, 14, 7); ctx.fill();
  g.text(Math.max(0, Math.ceil(timeLeft)) + 's', W - 30, 100, { size: 30, align: 'right', stroke: 5, color: frac > .35 ? '#fff' : '#ff5a4d' });
  /* running score, on a chip so it never fights the board */
  panel(ctx, W - 148, 132, 122, 34, { r: 10, alpha: .55, color: '#101828', lw: 1.5 });
  g.text(fmt(g.score), W - 36, 156, { size: 22, align: 'right', color: '#ffd34d', stroke: 3 });
  g.text('SCORE', W - 140, 155, { size: 15, color: 'rgba(255,255,255,.55)', stroke: 0 });
  if (wrongT > 0) { ctx.save(); ctx.globalAlpha = wrongT * .18; ctx.fillStyle = '#ff5a4d'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (whyK <= 0) g.text('TAP THE CULPRIT', W / 2, 452, { size: 22, align: 'center', stroke: 4, color: 'rgba(255,255,255,.42)' });
}

function draw() {
  const ctx = g.ctx;
  drawBackdrop(ctx);
  for (let i = 0; i < 4; i++) drawSuspect(ctx, suspects[i], i);
  drawClues(ctx);
  drawWhy(ctx);
  drawStamp(ctx);
  drawTally(ctx);
  drawHUD(ctx);
}

resetWorld();
g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ solved, caseNo, timeLeft: +timeLeft.toFixed(1), culprit, clues: clues.map(c => c.text), alive: suspects.map(s => s.alive), hits, whyIdx, tallyTo });

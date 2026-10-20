// FLAP CAT — one-tap-reflex (Cat Arcade v2)
// One tap to fly. Three lives. Neon city never ends.
//
// The whole game is the tap, so every tap pays out: a wing-flap burst, a body squash,
// a tiny camera punch, and a flap sound whose pitch climbs with the combo. Gaps pay out
// with hit-stop (the gap *lands*), sparkles off both edges, a +1 popup and combo particles
// that thicken as the streak grows. Shaving a pipe pays a GRAZE ripple + bonus. Every 10
// gaps is a milestone: banner + jingle + bloom pulse. Death gets slow-mo, a screen flash,
// pipes breaking into debris, a hard shake and a sad descending wobble.
//
// Scenery is three parallax depths (far hills, mid skyline, near skyline) plus drifting
// clouds, a twinkling star field, and a sun whose glow hue climbs with the score.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU,
  rr, ease, damp, starPath, heartPath,
} from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';
import { getSticker, initStickerUI } from './sticker.js';

const W = 540, H = 960;
const BLOOM = .72;
const g = makeGame({
  id: 'one-tap-reflex', title: 'FLAP CAT', sub: 'TAP TO FLAP  ·  3 LIVES',
  hook: 'one bad tap and it is over', w: W, h: H, bg: '#060912', style: 'toon',
  bloom: BLOOM, ca: .42, vig: 1, scan: .22,
});

/* ------------------------------------------------------------------ tuning (rules) */
const CFG = {
  grav: 1450, flap: -528, vmax: 980, pr: 26, py: -14, cw: 74, px: 152,
  gap: n => Math.max(214, 340 - n * 4.2),
  spd: n => Math.min(470, 252 + n * 3.6),
  spacing: 340,
  graze: 26,            // near-miss window inside the gap, in px
  milestone: 10,        // banner + jingle every N gaps
  win: 360,             // auto-bot target (unchanged contract)
};

const NEON = ['#7df9ff', '#8ef6ff', '#a6ff8f', '#ffd34d', '#ff6bd6', '#ff9a3c'];
const pick2 = a => a[(Math.random() * a.length) | 0];

/* ------------------------------------------------------------------ scenery (built once) */
const strip = (n, o) => {
  const out = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(o.wMin, o.wMax), h = rnd(o.hMin, o.hMax);
    const wins = [];
    for (let wy = 14; wy < h - 16; wy += o.row) for (let wx = 8; wx < w - 10; wx += o.col)
      if (chance(.42)) wins.push({ x: wx, y: wy, on: chance(.5), ph: R() * 6 });
    out.push({ x, w, h, wins, ant: chance(.35) ? rnd(10, 26) : 0 });
    x += w + rnd(4, 16);
  }
  return { b: out, w: x };
};
const far = strip(26, { wMin: 42, wMax: 78, hMin: 130, hMax: 300, row: 26, col: 16 });
const mid = strip(22, { wMin: 56, wMax: 104, hMin: 190, hMax: 430, row: 22, col: 14 });
const near = strip(18, { wMin: 40, wMax: 96, hMin: 90, hMax: 230, row: 18, col: 12 });
const stars = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H * .55, r: rnd(.8, 2.1), ph: R() * 6, sp: rnd(.4, 1.6) }));
const clouds = Array.from({ length: 7 }, (_, i) => ({
  x0: R() * (W + 400), y: H * (.10 + R() * .30), w: rnd(180, 420), h: rnd(22, 46),
  par: rnd(.02, .10), drift: rnd(4, 16), a: rnd(.10, .22), warm: chance(.5),
}));

/* seamless hills: every term has period W in (x + offset), so the band tiles forever */
const hillY = (x, off, base) =>
  base - (Math.sin((x + off) * TAU / W) * 26 + Math.sin((x + off) * TAU * 2 / W + 1.3) * 15 + Math.sin((x + off) * TAU * 3 / W + 2.7) * 9);

/* ------------------------------------------------------------------ world */
let cat, pipes = [], dist = 0, lives = 3, passed = 0, autoT = 0, overT = 0;
let recordBeat = false;
const ui = { scorePop: 0, gapPop: 0, invPop: 0 };
const isAuto = new URLSearchParams(location.search).has('auto');

function resetWorld() {
  cat = { x: CFG.px, y: H * .44, vy: 0, rot: 0, flap: 0, cool: 0, inv: 0, sqx: 1, sqy: 1, trail: [], dead: false };
  pipes = []; dist = 0; lives = 3; passed = 0; autoT = 0; overT = 0; recordBeat = false;
  ui.scorePop = 0; ui.gapPop = 0; ui.invPop = 0;
  g.score = 0; g.state = { score: 0, lives: 3, passed: 0, speed: CFG.spd(0) };
  g.combo.reset();
  if (g.post) g.post.bloom = BLOOM;
  g.fx.clear();
  for (let i = 0; i < 3; i++) spawnPipe(W + 220 + i * CFG.spacing);
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('click', { pitch: 1.05 }); };

function spawnPipe(x = W + 90) {
  const n = passed;
  const gapH = CFG.gap(n);
  const gapY = rnd(gapH / 2 + 96, H - gapH / 2 - 110);
  const coins = [];
  if (chance(.72)) { const cy = gapY + rnd(-28, 28); for (let i = 0; i < 3; i++) coins.push({ x: 24 + i * 34, y: cy + (i - 1) * 6, taken: false, t: R() * 6 }); }
  pipes.push({ x, gapY, gapH, h: gapH, coins, passed: false, grazed: false, hue: chance(.5) ? 186 : 312, wob: R() * 6, dead: false, born: 0 });
  /* second look: some pipes drift vertically */
  const p = pipes[pipes.length - 1];
  if (n > 8 && chance(.35)) { p.drift = rnd(30, 70) * (chance(.5) ? 1 : -1); p.baseY = gapY; p.gapH0 = gapH; }
  return p;
}

/* ================================================================== the tap
   Everything a single flap owes the player: burst, squash, camera, sound. */
function flap() {
  const pitch = 1 + Math.min(.6, g.combo.n * .04);       // the flap rises with the streak
  cat.vy = CFG.flap; cat.flap = 1; cat.rot = -.22; cat.cool = .1;
  cat.sqx = 1.22; cat.sqy = .78;                         // squash (push air down, body compresses)
  sfx('jump', { pitch, vol: .8 });
  sfx('whoosh', { pitch: pitch * 1.4, vol: .16 });
  /* wing-flap burst: it is thrown backwards and down */
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (.62 + R() * .76);
    g.fx.emit('glow', cat.x - 14 + R() * 8, cat.y + 10, {
      vx: Math.cos(a) * rnd(70, 210), vy: Math.sin(a) * rnd(130, 280), g: 420,
      life: rnd(.20, .40), size: rnd(6, 14), color: pick2(['#7df9ff', '#a6ff8f', '#ffd34d']), add: true,
    });
  }
  g.fx.burst(cat.x - 12, cat.y + 12, 4, { kind: 'feather', color: ['#ffd8a8', '#ff9a3c', '#fff'], ang: Math.PI * .92, spread: 1.5, speed: 210, life: .34, size: 7, g: 180, drag: 1.6 });
  g.fx.emit('ring', cat.x - 8, cat.y + 8, { size: 26, life: .26, color: '#8ef6ff', add: true, wide: 4, ripple: false });
  /* a tiny camera punch on EVERY tap — this is what makes it feel physical */
  g.punch(.016);
  g.shake(1.8);
  navigator.vibrate?.(6);
}

/* ================================================================== passing a gap */
function passGap(p) {
  p.passed = true; passed++; g.state.passed = passed; g.state.speed = CFG.spd(passed);
  const mid = Math.abs(cat.y - p.gapY) < 42;
  const pts = Math.round((mid ? 18 : 10) * g.combo.mult);
  g.score += pts;
  ui.scorePop = 1; ui.gapPop = 1;

  const ex = p.x + CFG.cw, top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const col = `hsl(${p.hue}, 100%, 68%)`;

  /* the gap lands: a short hit-stop + a soft kick */
  g.hitstop(.04);
  g.punch(mid ? .06 : .032);
  g.shake(mid ? 4 : 2);
  if (mid) g.flash('#ffe6a8', .13);

  /* sparkles clinging to both gap edges */
  for (const [ey, dir] of [[top, -1], [bot, 1]]) {
    g.fx.burst(ex, ey, 5, { kind: 'spark', ang: dir > 0 ? -Math.PI / 2 : Math.PI / 2, spread: 1.7, color: [col, '#fff', '#ffd34d'], speed: 240, life: .34, size: 4, g: 260 });
    g.fx.emit('ring', ex, ey, { size: 22, life: .3, color: col, add: true, wide: 3, ripple: false });
    g.fx.emit('glow', ex, ey, { size: 26, life: .3, color: col, add: true });
  }

  /* combo particles intensify with the streak */
  const n = 3 + Math.min(16, g.combo.n);
  g.fx.burst(ex, cat.y, n, { kind: 'spark', speed: 190 + g.combo.n * 26, color: NEON, life: .42, size: 4.5, g: 320 });
  if (g.combo.n >= 3) g.fx.burst(ex, cat.y, Math.min(7, 1 + (g.combo.n >> 2)), { kind: 'star', speed: 170, color: ['#ffd34d', '#fff3a8'], life: .5, size: 7, g: 200 });

  /* popups */
  g.popup('+1', ex, p.gapY, '#8ef6ff', 26);
  if (mid) g.popup(`PERFECT +${pts}`, ex, p.gapY - 42, '#ffd34d', 30);
  else if (g.combo.mult > 1) g.popup(`+${pts}`, ex, p.gapY - 42, '#ffffff', 24);

  /* sfx: gap-clear, pitched up by the streak */
  const pch = comboPitch(g.combo.n % 12);
  if (mid) { sfx('ding', { pitch: pch }); sfx('coin', { pitch: pch * 1.06, vol: .45 }); }
  else sfx('pop', { pitch: pch });

  const before = g.combo.mult;
  g.combo.hit();                                       // counter + ×mult banner
  if (g.combo.mult > before) comboUp(g.combo.mult);

  if (passed % CFG.milestone === 0) milestone(passed);
  if (!recordBeat && g.best > 0 && g.score > g.best) { recordBeat = true; beatRecord(); }
  g.score = Math.round(g.score);
}

function comboUp(m) {
  g.hitstop(.05); g.punch(.05); g.shake(5);
  g.flash('#ffd34d', .15);
  g.fx.ring(cat.x, cat.y, { r: 62, life: .5, color: '#ffd34d', wide: 6 });
  g.fx.burst(cat.x, cat.y, 14, { kind: 'star', color: ['#ffd34d', '#fff', '#ff9a3c'], speed: 270, life: .5, size: 8, g: 240 });
  g.popup(`×${m}`, cat.x, cat.y - 64, '#ffd34d', 40);
  sfx('unlock', { pitch: 1 + m * .04 });
  bloomPulse(1.15);
}

/* ================================================================== near miss */
function graze(p, clear) {
  p.grazed = true;
  const bonus = Math.round((6 + (CFG.graze - clear) * .7) * g.combo.mult);
  g.score += bonus;
  ui.scorePop = 1;
  g.hitstop(.05); g.punch(.035); g.shake(6);
  g.flash('#ffe66d', .13);
  /* graze ripple, right where the fur nearly met the pipe */
  g.fx.ring(cat.x, cat.y, { r: 42, life: .34, color: '#ffe66d', wide: 7, ripple: 1.4 });
  g.fx.emit('ring', cat.x, cat.y, { size: 18, life: .24, color: '#fff', add: true, wide: 3, ripple: false });
  g.fx.burst(cat.x, cat.y, 12, { kind: 'spark', color: ['#ffe66d', '#fff', '#ff9a3c'], speed: 300, life: .4, size: 4.5, g: 300 });
  g.popup(`GRAZE +${bonus}`, cat.x + 8, cat.y - 48, '#ffe66d', 28);
  sfx('slice', { pitch: 1.25 - clear * .008, vol: .7 });
  navigator.vibrate?.([10, 24, 10]);
  const before = g.combo.mult;
  g.combo.hit();
  if (g.combo.mult > before) comboUp(g.combo.mult);
  g.score = Math.round(g.score);
}

/* ================================================================== milestone */
function milestone(n) {
  const bonus = Math.round(25 * g.combo.mult);
  g.score += bonus;
  ui.scorePop = 1;
  g.showBanner(`${n} GAPS!`, 1.3);
  g.popup(`MILESTONE +${bonus}`, W / 2, H * .30, '#ffd34d', 30);
  g.flash('#ffffff', .2); g.punch(.07); g.shake(7); g.hitstop(.07);
  sfx('fanfare', { pitch: 1 }); sfx('drum', { vol: .55 });
  bloomPulse(1.6);
  g.fx.ring(W / 2, H * .42, { r: 260, life: .8, color: '#ffd34d', wide: 9, ripple: 1.5 });
  g.fx.burst(W / 2, H * .42, 22, { kind: 'confetti', speed: 330, color: NEON, life: 1.1, size: 8, g: 420 });
  g.fx.burst(W / 2, H * .42, 16, { kind: 'star', color: ['#ffd34d', '#ffffff'], speed: 300, life: .7, size: 9, g: 260 });
}

function beatRecord() {
  g.showBanner('NEW RECORD!', 1.1);
  g.popup('RECORD', W / 2, H * .22, '#ffd34d', 28);
  g.flash('#ffd34d', .18); g.punch(.05); g.shake(4);
  sfx('perfect', { pitch: 1.1 });
  bloomPulse(1.3);
  g.fx.burst(cat.x, cat.y, 18, { kind: 'star', color: ['#ffd34d', '#fff', '#ff9a3c'], speed: 300, life: .8, size: 8, g: 200 });
}

/** bloom pop — the whole frame breathes outward, then settles back to the house grade */
function bloomPulse(peak) {
  if (!g.post) return;
  g.post.bloom = Math.min(2.2, peak);
  g.tween(g.post, 'bloom', BLOOM, .55, ease.outCubic);
}

/* ================================================================== damage */
function hitPipe(p, cx, cy) {
  if (cat.inv > 0 || cat.dead) return;
  p.dead = true;
  lives--; cat.inv = 1.15; cat.vy = -240; cat.sqx = 1.3; cat.sqy = .72;
  g.state.lives = lives;
  ui.invPop = 1;
  g.impact(cx, cy, { punch: .1, shake: 22, stop: .11, flash: '#ff3b5c', flashA: .38, rip: 1.6, sfx: 'hit', pitch: .8 });
  g.fx.burst(cx, cy, 26, { kind: 'shard', color: ['#ff4d6d', '#ffd34d', '#fff', '#7df9ff'] });
  g.fx.burst(cx, cy, 16, { kind: 'feather', color: ['#ff9a3c', '#ffd8a8', '#fff'] });
  g.fx.blast(cx, cy, { r: 90, color: '#ff4d6d' });
  shatter(p, 12);
  sfx('meow', { pitch: .7, vol: .5 });
  g.combo.miss();
  navigator.vibrate?.([20, 40, 30]);
  if (lives <= 0) die();
  else { /* still flying: shield up, a bright "revive" chime so the save reads as a win */
    sfx('powerup', { pitch: 1.18, vol: .8 });
    g.fx.ring(cat.x, cat.y, { r: 54, life: .45, color: '#7df9ff', wide: 6 });
    g.flash('#7df9ff', .16);
    g.popup(`${lives} LEFT`, cat.x, cat.y - 62, '#7df9ff', 26);
    g.tween(ui, 'invPop', 0, .4);
  }
}

/** break a pipe into real debris — used on hits and on death */
function shatter(p, n = 10) {
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const col = `hsl(${p.hue}, 90%, 58%)`;
  for (let i = 0; i < n; i++) {
    const yy = i % 2 ? top - rnd(20, 240) : bot + rnd(20, 240);
    g.fx.emit('shard', p.x + rnd(-6, CFG.cw + 6), clamp(yy, -30, H + 30), {
      vx: rnd(-150, 230), vy: rnd(-330, 40), g: 950, life: rnd(.55, 1.05),
      size: rnd(4, 10), color: chance(.6) ? col : '#1b2440',
      rot: rnd(0, TAU), vr: rnd(-12, 12), drag: .35,
    });
  }
  for (let i = 0; i < 4; i++) {
    g.fx.emit('spark', p.x + rnd(0, CFG.cw), i % 2 ? top : bot, { vx: rnd(-120, 160), vy: rnd(-200, 60), g: 500, life: rnd(.3, .5), size: 3, color: col });
  }
}

function die() {
  if (cat.dead) return;
  cat.dead = true;
  /* the sting: slow-mo, flash, hard shake, pipes breaking apart, a sad descending wobble */
  sfx('lose', { vol: .9 });
  sfx('groan', { pitch: .78, vol: .8 });
  sfx('boom', { pitch: .62, vol: .55 });
  g.slowmo(.22, 1.0);
  g.shake(28); g.punch(.1); g.hitstop(.1);
  bloomPulse(.55);
  g.showBanner('FLIGHT OVER', 1.2);
  g.fx.blast(cat.x, cat.y, { r: 120, color: '#ff3b5c', colors: ['#ff3b5c', '#ff9a3c', '#ffffff'], n: 24, speed: 300 });
  g.flash('#ff2d55', .55);
  for (const p of pipes) if (!p.dead) { p.dead = true; shatter(p, 10); }
  for (let i = 0; i < 24; i++) g.fx.emit('feather', cat.x + rnd(-24, 24), cat.y + rnd(-24, 24), {
    vx: rnd(-280, 280), vy: rnd(-400, 140), g: 700, life: rnd(.7, 1.4), size: rnd(7, 15),
    color: pick2(['#ff9a3c', '#ffd8a8', '#fff', '#ff6b6b']), rot: R() * 6, vr: rnd(-9, 9), drag: .6,
  });
  for (let i = 0; i < 10; i++) g.fx.emit('smoke', cat.x + rnd(-30, 30), cat.y + rnd(-30, 30), {
    vx: rnd(-90, 90), vy: rnd(-140, 20), g: -30, life: rnd(.7, 1.2), size: rnd(20, 44), color: 'rgba(40,44,60,.55)', drag: .8,
  });
  navigator.vibrate?.([40, 60, 90]);
  g.end({ win: false, score: Math.round(g.score), label: 'DISTANCE', progress: clamp(passed / 40, 0, .96) });
}

/* ================================================================== update */
function update(dt) {
  if (g.mode === 'over') { overT += dt; for (const p of pipes) p.x -= 40 * dt; return; }

  if (ui.scorePop > 0) ui.scorePop = Math.max(0, ui.scorePop - dt * 3.4);
  if (ui.gapPop > 0) ui.gapPop = Math.max(0, ui.gapPop - dt * 2.6);
  if (ui.invPop > 0) ui.invPop = Math.max(0, ui.invPop - dt * 2.2);

  const speed = CFG.spd(passed);
  g.state.speed = speed;
  dist += speed * dt;
  autoT += dt;

  /* --- input: the whole screen is the button --- */
  let tapped = g.taps.length > 0 || g.pressed.Space || g.pressed.ArrowUp || g.pressed.KeyW || g.pressed.KeyZ;
  if (isAuto) { tapped = false; botThink(); }
  if (tapped && !cat.dead) flap();

  /* --- physics --- */
  cat.vy = Math.min(CFG.vmax, cat.vy + CFG.grav * dt);
  cat.y += cat.vy * dt;
  cat.flap = Math.max(0, cat.flap - dt * 3.4);
  cat.cool = Math.max(0, cat.cool - dt);
  cat.rot = lerp(cat.rot, clamp(cat.vy / 1100, -.5, .95), dt * 9);
  cat.inv = Math.max(0, cat.inv - dt);
  cat.sqx = damp(cat.sqx, 1, 13, dt);
  cat.sqy = damp(cat.sqy, 1, 13, dt);

  /* ceiling / floor = bounce, costs a life on the floor */
  if (cat.y < CFG.pr + 12) {
    cat.y = CFG.pr + 12; cat.vy = Math.max(cat.vy, 60);
    g.fx.dust(cat.x, cat.y - 10, 4, { color: 'rgba(200,240,255,.45)', spread: 40, speed: 90 });
    g.punch(.012); g.shake(2);
    sfx('tick', { vol: .3, pitch: 1.4 });
  }
  if (cat.y > H - 60) {
    if (cat.inv <= 0) {
      cat.inv = 1.1; lives--; g.state.lives = lives;
      g.impact(cat.x, H - 60, { punch: .09, shake: 20, stop: .06, flash: '#ff3b5c', flashA: .3, sfx: 'thud', pitch: .9 });
      g.fx.burst(cat.x, H - 62, 20, { kind: 'smoke', color: 'rgba(255,255,255,.5)' });
      g.fx.ring(cat.x, H - 60, { r: 50, life: .4, color: '#ff9a3c', wide: 6 });
      g.popup(lives > 0 ? `${lives} LEFT` : 'DOWN', cat.x, H - 130, '#ff9a3c', 26);
      if (lives <= 0) { die(); return; }
      else sfx('powerup', { pitch: 1.1, vol: .7 });
    }
    cat.y = H - 60; cat.vy = CFG.flap * .82;
  }

  /* --- trail --- */
  cat.trail.unshift({ x: cat.x, y: cat.y, r: cat.rot });
  if (cat.trail.length > 14) cat.trail.pop();
  if (speed > 330) g.fx.emit('glow', cat.x - 26, cat.y + rnd(-16, 16), { vx: -speed * 1.1, life: .3, size: rnd(4, 9), color: '#8ef6ff', add: true });

  /* --- pipes --- */
  for (const p of pipes) {
    p.x -= speed * dt;
    p.born += dt;
    if (p.drift) { p.wob += dt * 1.6; p.gapY = p.baseY + Math.sin(p.wob) * p.drift; }
    for (const c of p.coins) c.t += dt * 3;

    /* near miss: while the mouth overlaps us, how much air is left either side? */
    if (!p.dead && !p.grazed && !cat.dead) {
      const clear = clearance(p);
      if (clear >= 0 && clear < CFG.graze) graze(p, clear);
    }

    if (!p.dead && collides(p)) hitPipe(p, p.x + CFG.cw / 2, cat.y);
    if (!p.passed && p.x + CFG.cw < cat.x - CFG.pr) passGap(p);

    for (const c of p.coins) {
      if (c.taken) continue;
      const cx = p.x + c.x, cy = c.y;
      if (Math.hypot(cx - cat.x, cy - cat.y) < CFG.pr + 24) {
        c.taken = true;
        const v = Math.round(5 * g.combo.mult); g.score += v;
        ui.scorePop = 1;
        sfx('coin', { pitch: comboPitch(passed % 12) });
        g.popup(`+${v}`, cx, cy, '#ffd34d', 28);
        g.fx.burst(cx, cy, 12, { kind: 'star', color: ['#ffd34d', '#fff3a8', '#fff'], life: .5, size: 7 });
        g.fx.emit('ring', cx, cy, { size: 24, life: .28, color: '#ffd34d', add: true, wide: 4, ripple: false });
        g.punch(.025);
        g.shake(1.5);
      }
    }
  }
  while (pipes.length && pipes[0].x < -CFG.cw - 80) pipes.shift();
  const last = pipes[pipes.length - 1];
  if (!last || last.x < W - CFG.spacing + CFG.cw) spawnPipe(Math.max(W + 40, last ? last.x + CFG.spacing : W + 40));

  g.state.score = Math.round(g.score);
  /* auto-video guard: keep rounds finite */
  if (isAuto && g.mode === 'play' && (g.score >= CFG.win || autoT > 55)) {
    if (g.score >= CFG.win) winRun(); else die();
  }
}

/** the bot's winning end — a proper celebration instead of a quiet cut */
function winRun() {
  sfx('fanfare'); sfx('win', { pitch: 1.1 });
  g.flash('#ffffff', .5); g.hitstop(.16); g.slowmo(.4, .6);
  g.punch(.09); g.shake(16);
  bloomPulse(1.8);
  g.fx.blast(cat.x, cat.y, { r: 150, color: '#ffffff', colors: NEON, n: 34, speed: 340 });
  g.fx.burst(W / 2, H * .4, 24, { kind: 'confetti', speed: 320, color: NEON, life: 1.3, size: 9, g: 400 });
  g.fx.ring(W / 2, H * .4, { r: 300, life: .9, color: '#ffffff', wide: 10, ripple: 1.4 });
  g.end({ win: true, score: g.score, label: 'DISTANCE', progress: 1 });
}

/** clearance (px of air) between the cat's hit circle and the nearest pipe wall, if the pipe is on us */
function clearance(p) {
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const cx = cat.x + 6, cy = cat.y + CFG.py, r = CFG.pr;
  if (cx + r < p.x || cx - r > p.x + CFG.cw) return 9999;
  const dTop = (cy - r) - top, dBot = bot - (cy + r);
  if (dTop < 0 || dBot < 0) return -1;      // that is a hit, not a graze
  return Math.min(dTop, dBot);
}

const collides = p => {
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const cx = cat.x + 6, cy = cat.y + CFG.py, r = CFG.pr;
  if (cx + r < p.x || cx - r > p.x + CFG.cw) return false;
  return cy - r < top || cy + r > bot;
};

/* ------------------------------------------------------------------ bot (video autoplay) */
function botThink() {
  const dumb = g.dumb();
  const nx = pipes.find(p => !p.dead && p.x + CFG.cw > cat.x - 34);
  /* steer the hit-circle (a little above the sprite origin) toward the gap, hopping from below */
  const cy = cat.y + CFG.py;
  let aim = nx ? nx.gapY + 30 : H * .45;
  if (dumb) aim += Math.sin(g.t * 2.7) * 88;
  const slack = dumb ? 46 : 6;
  if (cat.cool <= 0 && cat.vy > (dumb ? 90 : -70) && cy > aim + slack) flap();
  else if (cat.y < 150 && cat.vy > -20 && cat.cool <= 0) flap();
}

/* ================================================================== drawing */
let skyKey = -1, skyG = null, sunKey = -1, sunG = null, sunCol = '#fff2cf', hazeKey = -1, hazeG = null;

function skyPalette(n) {
  if (skyKey === n && skyG) return skyG;
  skyKey = n;
  const k = clamp(n / 40, 0, 1);                    // 0 = dusk, 1 = deep neon night
  const h = deg => ((deg - k * 62) % 360 + 360) % 360;
  skyG = [
    `hsl(${h(238)}, 56%, ${11 - k * 3}%)`,
    `hsl(${h(266)}, 49%, ${25 - k * 6}%)`,
    `hsl(${h(301)}, 42%, ${31 - k * 9}%)`,
    `hsl(${h(352)}, 54%, ${55 - k * 15}%)`,
    `hsl(${h(28)}, 100%, ${65 - k * 18}%)`,
  ];
  return skyG;
}

function drawParallax(ctx) {
  /* --- sky (cached per score step so we are not rebuilding gradients every frame) --- */
  const pal = skyPalette(passed);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal[0]); sky.addColorStop(.38, pal[1]);
  sky.addColorStop(.62, pal[2]); sky.addColorStop(.82, pal[3]); sky.addColorStop(1, pal[4]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  /* --- stars --- */
  for (const s of stars) {
    const tw = .35 + .65 * Math.abs(Math.sin(g.t * s.sp + s.ph));
    ctx.globalAlpha = tw * .85; ctx.fillStyle = '#dff2ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* --- sun / moon: its glow hue climbs with the score --- */
  if (sunKey !== passed || !sunG) {
    sunKey = passed;
    const hue = (26 + passed * 11) % 360;
    sunCol = `hsl(${hue}, 96%, 78%)`;
    const mx = W * .74, my = H * .19;
    sunG = ctx.createRadialGradient(mx, my, 8, mx, my, 190);
    sunG.addColorStop(0, `hsla(${hue}, 100%, 86%, .55)`);
    sunG.addColorStop(.35, `hsla(${hue}, 100%, 72%, .20)`);
    sunG.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
  }
  const mx = W * .74, my = H * .19, pulse = .88 + .12 * Math.sin(g.t * 1.3);
  ctx.save(); ctx.globalAlpha = pulse;
  ctx.fillStyle = sunG; ctx.beginPath(); ctx.arc(mx, my, 190, 0, TAU); ctx.fill();
  ctx.fillStyle = sunCol; ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.fill();
  ctx.globalAlpha = .5 * pulse; ctx.fillStyle = 'rgba(120,90,60,.5)';
  for (const [dx, dy, r] of [[-16, -12, 9], [12, 8, 12], [-6, 20, 6], [22, -18, 5]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
  ctx.restore();

  /* --- horizon burn — separates sky from skyline so obstacles read instantly --- */
  if (hazeKey !== passed || !hazeG) {
    hazeKey = passed;
    const hue = (352 + passed * 9) % 360;
    hazeG = ctx.createRadialGradient(W * .5, H * .8, 20, W * .5, H * .8, W * .95);
    hazeG.addColorStop(0, `hsla(${hue}, 95%, 62%, .48)`);
    hazeG.addColorStop(.45, `hsla(${hue}, 90%, 55%, .20)`);
    hazeG.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`);
  }
  ctx.fillStyle = hazeG; ctx.fillRect(0, H * .35, W, H * .65);

  /* --- drifting clouds (depth 1) --- */
  for (const c of clouds) {
    const span = W + c.w * 2;
    const cx = ((c.x0 - dist * c.par - g.t * c.drift) % span + span) % span - c.w;
    ctx.globalAlpha = c.a;
    ctx.fillStyle = c.warm ? `hsl(${(30 + passed * 6) % 360}, 60%, 55%)` : '#2b1b52';
    ctx.beginPath(); ctx.ellipse(cx, c.y, c.w * .5, c.h * .5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + c.w * .2, c.y + c.h * .32, c.w * .3, c.h * .42, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* --- depth 1: far hills --- */
  hillBand(ctx, .05, H * .80, `hsl(${(252 - passed * 3) % 360}, 42%, 15%)`);
  /* --- depth 2: far skyline --- */
  cityStrip(ctx, far, .12, H * .76, '#1b1442', 'rgba(255,206,120,.55)', 1);
  hillBand(ctx, .22, H * .90, `hsl(${(258 - passed * 4) % 360}, 45%, 10%)`);
  /* --- depth 3: mid skyline + near skyline (fastest) --- */
  cityStrip(ctx, mid, .3, H * .86, '#120c2c', 'rgba(255,226,150,.85)', 1.4);
  cityStrip(ctx, near, .62, H * 1.02, '#07040f', 'rgba(170,235,255,.75)', 1);

  /* --- floor haze --- */
  const hz = ctx.createLinearGradient(0, H - 150, 0, H);
  hz.addColorStop(0, 'rgba(12,5,24,0)'); hz.addColorStop(1, 'rgba(12,5,24,.6)');
  ctx.fillStyle = hz; ctx.fillRect(0, H - 150, W, 150);
}

function hillBand(ctx, par, baseY, col) {
  const off = (dist * par) % W;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, hillY(x, off, baseY));
  ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
}

function cityStrip(ctx, s, par, baseY, col, winCol, scale) {
  const ox = (dist * par) % s.w;
  ctx.save();
  for (let rep = -1; rep <= 1; rep++) {
    for (const b of s.b) {
      const x = b.x - ox + rep * s.w;
      if (x > W + 10 || x + b.w < -10) continue;
      const h = b.h * scale, y = baseY - h;
      ctx.fillStyle = col; ctx.fillRect(x, y, b.w, h + 4);
      if (b.ant) { ctx.fillRect(x + b.w * .5 - 1.5, y - b.ant, 3, b.ant); ctx.fillStyle = winCol; ctx.globalAlpha = .5 + .5 * Math.sin(g.t * 2 + x * .1); ctx.fillRect(x + b.w * .5 - 2, y - b.ant - 3, 4, 4); ctx.globalAlpha = 1; }
      ctx.fillStyle = winCol;
      for (const w of b.wins) {
        const lit = w.on ? 1 : .25 + .25 * Math.sin(g.t * 1.5 + w.ph);
        ctx.globalAlpha = lit * .9;
        ctx.fillRect(x + w.x, y + w.y, 5, 7);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function pipeDraw(ctx, p) {
  if (p.dead) return;
  const top = p.gapY - p.gapH / 2, bot = p.gapY + p.gapH / 2;
  const hue = p.hue, c1 = `hsl(${hue}, 100%, 62%)`, c2 = `hsl(${hue}, 90%, 42%)`;
  const glow = .5 + .5 * Math.sin(g.t * 3 + p.wob);
  for (const [y0, y1, flip] of [[-40, top, 1], [bot, H + 40, -1]]) {
    const hh = y1 - y0;
    const gd = ctx.createLinearGradient(p.x, 0, p.x + CFG.cw, 0);
    gd.addColorStop(0, '#141c3a'); gd.addColorStop(.34, '#26325c'); gd.addColorStop(.5, `hsl(${hue}, 78%, 34%)`); gd.addColorStop(.68, '#243059'); gd.addColorStop(1, '#131a34');
    rr(ctx, p.x, y0, CFG.cw, hh, 12); ctx.fillStyle = gd; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = c1; ctx.stroke();
    /* neon rails */
    ctx.globalAlpha = .95;
    seg2(ctx, p.x + 5, y0 + 6, p.x + 5, y1 - 6, 3, c1);
    seg2(ctx, p.x + CFG.cw - 5, y0 + 6, p.x + CFG.cw - 5, y1 - 6, 3, c1);
    ctx.globalAlpha = 1;
    /* cap */
    const cy0 = flip === 1 ? top - 30 : bot;
    rr(ctx, p.x - 7, cy0, CFG.cw + 14, 30, 8);
    const cg = ctx.createLinearGradient(p.x, cy0, p.x, cy0 + 30);
    cg.addColorStop(0, c1); cg.addColorStop(1, c2);
    ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#060a14'; ctx.stroke();
    ctx.globalAlpha = .8; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(p.x - 2, cy0 + 4, CFG.cw + 4, 4); ctx.globalAlpha = 1;
    /* hazard stripes on the mouth */
    ctx.save(); ctx.beginPath(); ctx.rect(p.x - 7, cy0, CFG.cw + 14, 30); ctx.clip();
    ctx.globalAlpha = .35; ctx.fillStyle = '#000';
    for (let i = -40; i < CFG.cw + 40; i += 18) { ctx.beginPath(); ctx.moveTo(p.x + i, cy0); ctx.lineTo(p.x + i + 9, cy0); ctx.lineTo(p.x + i + 3, cy0 + 30); ctx.lineTo(p.x + i - 6, cy0 + 30); ctx.fill(); }
    ctx.restore();
  }
  /* gap glow — the mouth breathes, and it flares if you just grazed it */
  const flare = p.grazed ? .34 : .18;
  ctx.globalAlpha = flare + glow * .12; ctx.fillStyle = c1;
  ctx.fillRect(p.x - 3, top - 26, CFG.cw + 6, 20);
  ctx.fillRect(p.x - 3, bot + 6, CFG.cw + 6, 20);
  ctx.globalAlpha = 1;
  /* edge glints */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [ey, s] of [[top, 0], [bot, 1.7]]) {
    const tw = .35 + .65 * Math.abs(Math.sin(g.t * 3.4 + p.wob + s));
    ctx.globalAlpha = tw * .8; ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(p.x + CFG.cw * .5, ey, 3.4 + tw * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

const seg2 = (c, x1, y1, x2, y2, w, col) => { c.beginPath(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

function coinDraw(ctx, x, y, t) {
  const sc = .55 + .45 * Math.abs(Math.cos(t * 1.6));
  ctx.save(); ctx.translate(x, y + Math.sin(t * 1.2) * 5); ctx.scale(sc, 1);
  const gd = ctx.createRadialGradient(0, -6, 2, 0, 0, 26);
  gd.addColorStop(0, '#fffbe0'); gd.addColorStop(.55, '#ffd34d'); gd.addColorStop(1, '#e59b00');
  starPath(ctx, 0, 0, 22, t * .5); ctx.fillStyle = gd; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#6b4200'; ctx.stroke();
  ctx.restore();
}

function catDraw(ctx) {
  /* trail ribbon */
  if (cat.trail.length > 3) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = cat.trail.length - 1; i > 0; i--) {
      const a = cat.trail[i], b = cat.trail[i - 1], k = 1 - i / cat.trail.length;
      ctx.globalAlpha = k * .30; ctx.strokeStyle = i % 2 ? '#7df9ff' : '#ffd34d';
      ctx.lineWidth = 26 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  const blink = cat.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = .45;

  /* wing-flap glow */
  const fl = cat.flap;
  if (fl > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createRadialGradient(cat.x - 22, cat.y + 6, 2, cat.x - 22, cat.y + 6, 54 * fl + 12);
    wg.addColorStop(0, 'rgba(190,250,255,.9)'); wg.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(cat.x - 22, cat.y + 6, 54 * fl + 12, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* squash (on a flap) + stretch (when diving) — the body reacts to every input */
  const str = clamp(cat.vy / 2600, 0, .18);
  const sx = cat.sqx - str * .5, sy = cat.sqy + str;

  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.rot);
  ctx.scale(sx, sy);

  /* wing — swings on every tap */
  const wa = .30 - fl * 1.15;
  ctx.save();
  ctx.translate(-6, -10);
  ctx.rotate(wa);
  const wgd = ctx.createLinearGradient(0, -18, -40, 14);
  wgd.addColorStop(0, '#ffe2b8'); wgd.addColorStop(.6, '#ffb066'); wgd.addColorStop(1, '#ff8a3c');
  ctx.beginPath(); ctx.moveTo(2, -3);
  ctx.quadraticCurveTo(-30, -20, -46, 4);
  ctx.quadraticCurveTo(-28, 20, 2, 9);
  ctx.closePath();
  ctx.fillStyle = wgd; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#151515'; ctx.stroke();
  ctx.restore();

  /* scarf */
  const sl = 16 + fl * 10;
  ctx.beginPath(); ctx.moveTo(-2, -62); ctx.quadraticCurveTo(-40, -58 + Math.sin(g.t * 18) * 6, -46 - sl, -40 + Math.cos(g.t * 15) * 8);
  ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  /* STICKER SAMPLE: uploaded sticker replaces the drawn cat (same spot, same squash/stretch) */
  const __sticker = getSticker();
  if (__sticker) {
    const __s = 96;
    ctx.drawImage(__sticker, -__s / 2, 30 - __s / 2, __s, __s);
  } else {
    drawChar('cat', ctx, 0, 30, 88, { dir: 1, t: g.t, color: '#ff9a3c', anim: fl > .1 ? 'walk' : undefined, hurt: cat.dead || (cat.inv > 0 && cat.inv < .5) });
  }
  ctx.restore();

  ctx.globalAlpha = 1;

  /* shield ring while invulnerable */
  if (cat.inv > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .30 + .2 * Math.sin(g.t * 12);
    ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cat.x, cat.y - 8, 46 + Math.sin(g.t * 8) * 3, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function draw(ctx) {
  drawParallax(ctx);

  /* pipes + coins */
  for (const p of pipes) pipeDraw(ctx, p);
  for (const p of pipes) for (const c of p.coins) if (!c.taken) coinDraw(ctx, p.x + c.x, c.y, c.t);

  /* speed streaks */
  if (CFG.spd(passed) > 300) {
    ctx.globalAlpha = .16; ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = (i * 137 + (dist * .9) % 960) % H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(50 + (i * 37) % 120, y + 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (!cat.dead) catDraw(ctx);
  g.btns.length = 0;                       // no touch pads: the whole screen is the button
}

/* ------------------------------------------------------------------ HUD */
function hud(ctx) {
  /* score panel */
  const pop = 1 + ui.scorePop * .16;
  rr(ctx, 20, 20, 214, 106, 18);
  const pg = ctx.createLinearGradient(20, 20, 20, 126);
  pg.addColorStop(0, 'rgba(12,18,38,.80)'); pg.addColorStop(1, 'rgba(8,10,24,.62)');
  ctx.fillStyle = pg; ctx.fill();
  ctx.strokeStyle = 'rgba(160,240,255,.30)'; ctx.lineWidth = 2; ctx.stroke();
  g.text('DISTANCE', 40, 50, { size: 19, color: '#8ef6ff', stroke: 3 });
  ctx.save(); ctx.translate(40, 106); ctx.scale(pop, pop);
  g.text(String(Math.round(g.score)).padStart(4, '0'), 0, 0, { size: 58, color: '#fff', stroke: 6, ink: '#04060f' });
  ctx.restore();

  /* lives */
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 44, y = 160;
    const alive = i < lives;
    heartPath(ctx, x, y, alive ? 30 + ui.invPop * (i === lives ? 8 : 0) : 26);
    if (alive) { const hg = ctx.createLinearGradient(x, y - 16, x, y + 16); hg.addColorStop(0, '#ff8fa3'); hg.addColorStop(1, '#e01b3c'); ctx.fillStyle = hg; }
    else ctx.fillStyle = 'rgba(255,255,255,.13)';
    ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = alive ? '#5c0416' : 'rgba(255,255,255,.2)'; ctx.stroke();
  }

  /* gaps + best, top right */
  g.text('GAPS', W - 24, 42, { size: 18, color: '#8ef6ff', align: 'right', stroke: 3 });
  g.text(String(passed), W - 24, 86, { size: 44, color: '#fff', align: 'right', stroke: 6, ink: '#04060f' });
  if (g.best > 0) g.text(`BEST ${Math.round(g.best)}`, W - 24, 118, { size: 17, color: 'rgba(255,255,255,.45)', align: 'right', stroke: 3 });

  /* speed gauge (bottom) */
  const sp = (CFG.spd(passed) - CFG.spd(0)) / (470 - CFG.spd(0));
  rr(ctx, 30, H - 44, W - 60, 14, 7); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  const sg = ctx.createLinearGradient(30, 0, W - 30, 0);
  sg.addColorStop(0, '#7df9ff'); sg.addColorStop(.6, '#ffd34d'); sg.addColorStop(1, '#ff3b5c');
  rr(ctx, 30, H - 44, Math.max(20, (W - 60) * clamp(sp, .04, 1)), 14, 7); ctx.fillStyle = sg; ctx.fill();
  g.text('SPEED', 30, H - 54, { size: 18, color: 'rgba(255,255,255,.6)', stroke: 3 });

  /* milestone progress pips */
  const pipOn = passed % CFG.milestone;
  for (let i = 0; i < CFG.milestone; i++) {
    const x = 30 + i * 15, y = H - 68;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU);
    ctx.fillStyle = i < pipOn ? '#ffd34d' : 'rgba(255,255,255,.16)'; ctx.fill();
  }

  if (g.mode === 'play') {
    const a = .35 + .3 * Math.sin(g.t * 3.4);
    ctx.globalAlpha = cat.cool > 0 ? .1 : a;
    g.text('TAP ANYWHERE', W / 2, H * .86, { size: 26, align: 'center', color: '#8ef6ff', stroke: 4 });
    ctx.globalAlpha = 1;
  }
  if (g.mode === 'title') g.text('TAP ANYWHERE', W / 2, H * .68, { size: 34, align: 'center', color: '#fff' });
}

window.__g = g;
window.__dbg = () => ({ score: g.score, lives, passed, pipes: pipes.map(p => [Math.round(p.x), Math.round(p.gapY), Math.round(p.gapH), p.dead ? 1 : 0]), cat: [Math.round(cat.x), Math.round(cat.y), Math.round(cat.vy)] });
resetWorld();
initStickerUI(g);
g.run(update, draw, hud);

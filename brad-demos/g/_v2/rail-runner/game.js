// NEON GRIND — rail-runner (Cat Arcade v2)
// A rail-GRINDING game: the cat latches onto a neon rail and builds speed down a descending
// city line. At every junction the live rail ends — hop ▲/▼ onto the next track before it does.
// Jump the electrified blockers. Reach the FINISH arch. Fall = lose a life.
//
// Rule set is unchanged from the audit baseline; everything added here is FEEL:
//   · speed camera  — a continuous zoom that grows with velocity, a hard kick on every speed
//     tier, and a short FOV-style scale spike on boost.
//   · lane swaps    — the cat tilts and squashes into the turn, dust comes off both rails, and
//     the whoosh bends in pitch by direction (the sfx API has pitch, not pan — pitch reads as side).
//   · coins         — "+5" / "×2" popups arcing up, a sparkle burst, and a pickup pitch that
//     rises with the streak.
//   · crash/stumble — shake, hit-stop, debris, flash and a heart-lost popup.
//   · milestones    — every 500 m: banner, jingle, bloom ramp, confetti.
import { makeGame, sfx, music, TAU, rr, hexA, clamp, lerp, damp, starPath, heartPath, comboPitch, rnd } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'rail-runner', title: 'NEON GRIND', sub: '▲▼ SWITCH TRACK  ·  TAP / SPACE JUMP',
  hook: 'one missed junction and the cat eats rail', w: W, h: H,
  bg: '#07060f', bloom: .85, ca: .4, vig: .95, scan: .14,
});

/* ---------------------------------------------------------------- tune */
const CATX = 176;                    // cat's fixed screen x (camera anchor)
const LANE_Y = [288, 406, 524];      // rail height per track at the camera
const SLOPE = .1;                    // rails descend toward the right -> "downhill" read
const LANES = 3;
const GOAL_X = 9000;                 // finish arch (world px)
const START_END = 1000;              // first junction
const SPEED0 = 330;
const GRAV = 2500;
const JUMPV = -620;
const BLOCK_H = 46;
const C_LIVE = '#5ce8ff', C_HOT = '#ff4ad8', C_AMBER = '#ffd34d';
const BASE_BLOOM = .85;
const TIERS = [384, 442, 500, 558, 616, 668];   // speed thresholds that get their own kick
const MILE_M = 500;                             // metres between milestone banners
const CHECK_M = 250;                            // smaller checkpoint popup between milestones

/* ---------------------------------------------------------------- helpers */
const sx = wx => CATX + (wx - camX);
const railY = (lane, wx) => LANE_Y[lane] + (wx - camX) * SLOPE;
let _sd = 20250619;
const srand = () => (_sd = (_sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let _r2 = 1;
const R2 = () => (_r2 = (_r2 * 16807) % 2147483647) / 2147483647;
const rnd2 = (a, b) => a + R2() * (b - a);
const sin = Math.sin, cos = Math.cos, floor = Math.floor, min = Math.min, max = Math.max, abs = Math.abs;
function laneYof(v) {                      // smooth lane -> screen height
  const a = clamp(floor(v), 0, LANES - 1), b = clamp(a + 1, 0, LANES - 1), f = clamp(v - a, 0, 1);
  return lerp(LANE_Y[a], LANE_Y[b], f);
}

/* ---------------------------------------------------------------- world state */
let rails, path, blockers, orbs, camX, speed, streak, lives, score, phase, phaseT, autoT, frames;
let cat, orbCount, bestStreak, firstJ, hintT;
let tier, mile, airT, boostT, recordDone, stumbleT, lastCheck;

/* tweened juice objects. g.tween drives these — no per-frame allocation. */
const feel = { hud: 0, fov: 0, tilt: 0, bloom: 0, gust: 0, coin: 0 };

function prog() { return clamp(camX / GOAL_X, 0, 1); }

function railAt(lane, x) {
  for (let i = 0; i < rails.length; i++) {
    const r = rails[i];
    if (r.lane === lane && x >= r.x0 - 30 && x <= r.x1 + 6) return r;
  }
  return null;
}
function pathAt(x) {
  for (let i = 0; i < path.length; i++) if (x >= path[i].x0 && x < path[i].x1) return path[i];
  return path[path.length - 1];
}
function nextJunction() {                   // the live rail's end + where we must go
  const seg0 = pathAt(camX);
  const i = path.indexOf(seg0);
  const nxt = path[i + 1];
  if (!nxt) return null;
  return { x: seg0.x1, lane: nxt.lane, from: seg0.lane, i };
}
const fxRoom = () => g.fx.p.length < 300;   // hard budget: the particle list never grows unbounded

/* ---------------------------------------------------------------- juice verbs */
/* every action gets three layers: a sound, a camera move, and something on screen */
function hudKick(v = 1) { feel.hud = Math.max(feel.hud, v); g.tween(feel, 'hud', 0, .42, u => 1 - (1 - u) * (1 - u)); }
function gustUp(v = 1) { feel.gust = Math.max(feel.gust, v); g.tween(feel, 'gust', 0, .7, u => 1 - (1 - u) * (1 - u)); }
function fovSpike(v = .06) { feel.fov = Math.max(feel.fov, v); g.tween(feel, 'fov', 0, .36, u => 1 - u); }
function bloomRamp(v = .5) { feel.bloom = Math.max(feel.bloom, v); g.tween(feel, 'bloom', 0, 1.15, u => 1 - (1 - u) * (1 - u)); }
function tiltKick(dir, amt = .2) { feel.tilt = dir * amt; g.tween(feel, 'tilt', 0, .36, u => u * u); }
function coinKick() { feel.coin = 1; g.tween(feel, 'coin', 0, .3, u => u * u); }

function buildLevel() {
  _sd = 20250619;
  rails = []; path = []; blockers = []; orbs = [];
  for (let l = 0; l < LANES; l++) rails.push({ lane: l, x0: -700, x1: START_END });
  path.push({ lane: 1, x0: -700, x1: START_END });
  let x = START_END, lane = 1, first = true;
  while (x < GOAL_X + 700) {
    const p = clamp(x / GOAL_X, 0, 1);
    const opts = [];
    if (lane > 0) opts.push(lane - 1);
    if (lane < LANES - 1) opts.push(lane + 1);
    const nl = opts[floor(srand() * opts.length)];
    const len = Math.round((first ? 470 : lerp(410, 252, p)) * (.9 + srand() * .24));
    first = false;
    const s = { lane: nl, x0: x, x1: x + len, hz: 0 };
    rails.push(s); path.push(s);
    const n = max(2, Math.round(len / 115));
    for (let i = 0; i < n; i++) orbs.push({ lane: nl, x: x + len * (i + .5) / n, taken: false, ph: srand() * TAU });
    if (x > 1900 && len > 300 && srand() < .3 + p * .38)
      blockers.push({ lane: nl, x: x + len * (.52 + srand() * .18), z: srand() });
    lane = nl; x += len;
  }
  firstJ = { x: START_END, lane: path[1].lane, from: 1 };
}

function resetWorld() {
  buildLevel();
  camX = 0; speed = SPEED0; streak = 0; lives = 3; score = 0; orbCount = 0; bestStreak = 0;
  phase = 'run'; phaseT = 0; autoT = 0; frames = 0; hintT = 0;
  tier = 0; mile = 0; airT = 0; boostT = 0; recordDone = false; stumbleT = 0;
  feel.hud = 0; feel.fov = 0; feel.tilt = 0; feel.bloom = 0; feel.gust = 0; feel.coin = 0;
  g.cam.scale = 1; g.cam.z = 1; g.cam.zv = 0; g.cam.rot = 0;
  cat = { lane: 1, ly: 1, dy: 0, vy: 0, air: false, hop: 0, sq: 1, inv: 1.1, hurt: 0 };
  g.score = 0; g.fx.clear(); g.combo.miss(); g.combo.n = 0; g.combo.mult = 1; lastCheck = 0;
  g.state = { d: 0, kmh: Math.round(SPEED0 * .36), lives: 3, lane: 1, ph: 'run', pct: 0 };
}

/* ---------------------------------------------------------------- input */
function doSwitch(dir) {
  if (phase !== 'run' || g.mode !== 'play') return;
  const nl = clamp(cat.lane + dir, 0, LANES - 1);
  if (nl === cat.lane) { sfx('tick', { pitch: .7, vol: .3 }); g.punch(.012); return; }
  const fromLane = cat.lane;
  cat.lane = nl; cat.hop = 1;
  const fy = railY(nl, camX), oldY = railY(fromLane, camX);

  /* the turn reads through the body: squash + a tilt that springs back to zero */
  cat.sq = 1.2;
  tiltKick(dir, .22 + min(.14, speed / 4200));

  /* dust puffs off both rails — the one you left and the one you land on */
  if (fxRoom()) {
    g.fx.dust(CATX - 12, oldY, 8, { color: 'rgba(150,240,255,.5)', size: 15, up: 80, speed: 160, spread: 36 });
    g.fx.dust(CATX + 6, fy, 6, { color: 'rgba(255,255,255,.42)', size: 11, up: 54, speed: 120, spread: 24 });
  }
  /* directional whoosh: pitch bends up to the right, down to the left (pitch stands in for pan) */
  sfx('whoosh', { pitch: dir > 0 ? 1.22 : .8, vol: .55 });

  if (railAt(nl, camX)) {
    g.fx.burst(sx(camX) - 6, fy, 9, { n: 8, color: C_LIVE, colors: [C_LIVE, '#ffffff'], spd: 190, life: .3, size: 4, add: true, g: 500 });
    g.fx.emit('ring', CATX + 4, fy - 4, { size: 34, life: .26, color: C_LIVE, add: true, wide: 4 });
    sfx('snap', { pitch: 1 + dir * .12, vol: .55 });
    g.punch(.03); g.shake(2.6);
    g.hitstop(.014);
  } else {
    /* nothing under your feet — hop out into the dark, you can still switch back to save it */
    cat.air = true; cat.vy = -300; airT = .2;
    sfx('charge', { pitch: .72, vol: .4 });
    g.flash('#ff4ad8', .13);
    g.popup('AIRBORNE', CATX, fy - 92, C_HOT, 22);
    g.shake(4.5); g.punch(.02);
  }
}
function doJump() {
  if (phase !== 'run' || g.mode !== 'play' || cat.air) return;
  cat.air = true; cat.vy = JUMPV; cat.sq = .82; airT = 0;
  const fy = railY(cat.lane, camX);
  sfx('jump', { pitch: 1.15, vol: .6 });
  g.fx.burst(sx(camX), fy, 7, { color: C_LIVE, colors: [C_LIVE, '#fff'], spd: 150, life: .28, size: 4, add: true, g: 500 });
  g.fx.dust(sx(camX) - 6, fy, 6, { color: 'rgba(150,240,255,.45)', size: 13, up: 60, speed: 130 });
  if (g.post) g.post.ripple(CATX / W, fy / H, .55);
  g.punch(.024); g.shake(2.2); g.hitstop(.02);
  fovSpike(.028);
  hudKick(.4);
}

function readInput() {
  const up = g.btn('rn-up', 14, 790, 162, 136, '▲', { key: 'ArrowUp' });
  const dn = g.btn('rn-dn', 364, 790, 162, 136, '▼', { key: 'ArrowDown' });
  const jp = g.btn('rn-jp', 190, 790, 160, 136, 'JUMP', { key: 'Space' });
  if (up.pressed || g.pressed.KeyW) doSwitch(-1);
  if (dn.pressed || g.pressed.KeyS) doSwitch(1);
  if (jp.pressed) doJump();
  for (let i = 0; i < g.taps.length; i++) if (g.taps[i].y < 782) doJump();
}

/* ---------------------------------------------------------------- events */
function land() {
  const hard = airT > .5 || cat.vy > 690;
  cat.air = false; cat.vy = 0; cat.dy = 0; cat.sq = hard ? .66 : .76;
  const fy = railY(cat.lane, camX);
  g.impact(sx(camX), fy, { punch: hard ? .062 : .034, shake: hard ? 8 : 5, stop: 0, sfx: null });
  g.fx.burst(sx(camX) - 8, fy, hard ? 16 : 11, { color: C_LIVE, colors: [C_LIVE, '#fff', C_AMBER], spd: hard ? 280 : 220, life: .34, size: 5, add: true, g: 700, wide: 2 });
  g.fx.emit('ring', CATX - 4, fy, { size: hard ? 74 : 46, life: .3, color: C_LIVE, add: true, wide: hard ? 6 : 4 });
  g.fx.dust(sx(camX) - 10, fy, hard ? 10 : 6, { color: 'rgba(170,245,255,.5)', size: hard ? 18 : 13, up: hard ? 110 : 70, speed: 180, spread: 40 });
  sfx('thud', { pitch: hard ? .78 : 1.02, vol: .7 });
  g.hitstop(hard ? .06 : .032);
  if (hard) {
    g.popup('BIG AIR!', CATX + 24, fy - 110, C_AMBER, 30);
    g.flash('#cfefff', .1); gustUp(1); hudKick(1.2);
  } else hudKick(.35);
  /* landing on a rail tip: no rules change, just a wobble and a warning */
  const r = railAt(cat.lane, camX);
  if (r && r.x1 - camX < 72) stumble('TIP!');
}
function startFall() {
  if (phase !== 'run') return;
  phase = 'fall'; phaseT = 0;
  cat.air = true; if (cat.vy > -100) cat.vy = -100;
  g.combo.miss(); streak = 0;
  sfx('zap', { pitch: .7, vol: .5 }); sfx('groan', { pitch: .8, vol: .35 });
  g.shake(6); g.punch(.03); g.flash('#ff4ad8', .1);
  g.hitstop(.05);
}
function crash() {
  if (phase === 'crash') return;
  phase = 'crash'; phaseT = 0; lives--;
  const fy = min(H - 60, railY(cat.lane, camX));
  g.impact(sx(camX), fy, { punch: .16, shake: 34, stop: .12, flash: '#ff3b6a', flashA: .5, rip: 1.7, sfx: 'boom' });
  g.fx.blast(sx(camX), fy, { r: 120, color: C_HOT, colors: [C_HOT, C_AMBER, '#ffffff'], n: 30, dur: .7 });
  g.fx.burst(sx(camX), fy, 16, { kind: 'debris', color: ['#ffab3d', C_HOT, C_AMBER, '#fff'], speed: 320, life: .9, size: 8, g: 900 });
  g.fx.emit('ring', CATX, fy, { size: 180, life: .45, color: C_HOT, add: true, wide: 9 });
  sfx('boom', { pitch: .9, vol: .8 }); sfx('lose', { vol: .45 });
  g.flash('#ff3b6a', .5); g.shake(30); g.punch(.16);
  g.popup('♥ LOST', CATX + 10, fy - 120, '#ff4a7a', 44);
  g.hitstop(.11);
  g.showBanner(lives > 0 ? `${lives} ♥ LEFT` : 'WIPED OUT', 1);
  if (lives <= 0) sfx('lose', { pitch: .85, vol: .6 });
  g.slowmo(.3, .42); g.combo.miss(); streak = 0;
  g.punch(13);
  gustUp(1);
}
/* a stumble is pure feedback: shake, sparks, a wobble — no life, no rule change */
function stumble(label) {
  if (stumbleT > 0) return;
  stumbleT = .5;
  const fy = railY(cat.lane, camX);
  cat.hurt = .35; cat.sq = 1.3;
  sfx('hit', { pitch: 1.15, vol: .5 });
  g.fx.burst(CATX - 6, fy - 18, 12, { kind: 'spark', color: [C_AMBER, '#fff', C_HOT], speed: 260, life: .35, size: 5 });
  g.fx.dust(CATX - 8, fy, 6, { color: 'rgba(255,210,140,.5)', size: 14, up: 60, speed: 140 });
  g.shake(9); g.punch(.05); g.hitstop(.045); g.flash('#ffd34d', .12);
  g.popup(label || 'WOBBLE', CATX + 40, fy - 96, C_AMBER, 26);
  hudKick(.9);
}
function respawn() {
  const s = pathAt(camX);
  cat = { lane: s.lane, ly: s.lane, dy: 0, vy: 0, air: false, hop: 0, sq: .8, inv: 1.6, hurt: .5 };
  phase = 'run'; phaseT = 0; speed = SPEED0; tier = 0; airT = 0;
  const fy = railY(s.lane, camX);
  g.fx.ring(sx(camX), fy, { r: 60, color: C_LIVE, wide: 4, life: .4 });
  g.fx.burst(CATX, fy - 30, 14, { color: C_LIVE, colors: [C_LIVE, '#fff'], speed: 260, life: .5, size: 5 });
  g.fx.emit('ring', CATX, fy - 20, { size: 110, life: .5, color: C_LIVE, add: true, wide: 7 });
  sfx('shield', { pitch: 1.2, vol: .5 }); sfx('powerup', { pitch: .9, vol: .4 });
  g.flash('#5ce8ff', .16); g.punch(.05); g.shake(4); g.hitstop(.04);
  g.popup('GO!', CATX, fy - 130, C_LIVE, 32);
  gustUp(.7);
}
function win() {
  phase = 'win'; phaseT = 0;
  score += 500 + lives * 120;
  g.impact(CATX + 60, railY(cat.lane, camX) - 60, { punch: .2, shake: 16, stop: .14, flash: '#ffffff', flashA: .55, sfx: null });
  sfx('fanfare', { pitch: 1.05, vol: .7 }); sfx('coinchain', { pitch: 2, vol: .6 });
  for (let i = 0; i < 4; i++)
    g.fx.blast(CATX + 60 + (i - 1.5) * 70, railY(cat.lane, camX) - 120 - (i % 2) * 60, {
      r: 70, color: [C_LIVE, C_HOT, C_AMBER, '#fff'][i], colors: [C_LIVE, C_HOT, C_AMBER, '#ffffff'], n: 20, dur: .9, spd: 1.4,
    });
  for (let i = 0; i < 46; i++)
    g.fx.emit('confetti', CATX + (rnd(-1, 1)) * 190, railY(cat.lane, camX) - 200 + rnd(-1, 1) * 150,
      { vx: rnd(-1, 1) * 380, vy: -180 - Math.random() * 300, g: 520, life: 1.3 + Math.random(), size: 6 + Math.random() * 6, color: [C_AMBER, C_LIVE, C_HOT, '#fff'][i % 4], drag: .5 });
  g.fx.burst(CATX + 60, railY(cat.lane, camX) - 90, 18, { kind: 'star', color: [C_AMBER, '#fff', C_LIVE], speed: 340, life: .9, size: 9, g: 300 });
  g.flash('#fff8d0', .5); g.shake(14); g.punch(.2); g.hitstop(.1);
  g.showBanner('FINISH!', 1.4);
  g.popup('FINISH!', CATX + 40, railY(cat.lane, camX) - 160, C_AMBER, 40);
  g.slowmo(.4, .8); g.shake(10, .4);
  bloomRamp(1); gustUp(1); hudKick(2); boostT = 1;
}

/* ---------------------------------------------------------------- speed tiers / milestones */
function checkTier() {
  let n = 0;
  for (let i = 0; i < TIERS.length; i++) if (speed >= TIERS[i]) n = i + 1;
  if (n <= tier) return;
  tier = n;
  const fy = railY(cat.lane, camX);
  /* the hard zoom-in kick that marks a new gear */
  g.punch(.1 + n * .014);
  g.shake(5.5); g.hitstop(.03); g.flash('#5ce8ff', .11);
  sfx('charge', { pitch: .88 + n * .085, vol: .55 });
  g.showBanner(`SPEED ${n + 1}`, .8);
  g.popup('SPEED UP!', CATX + 46, fy - 132, C_LIVE, 28);
  g.fx.burst(CATX - 20, fy - 20, 14, { kind: 'spark', color: [C_LIVE, '#fff', C_AMBER], speed: 300, ang: Math.PI, spread: 1.6, life: .45, size: 6 });
  g.fx.emit('ring', CATX, fy - 10, { size: 130, life: .42, color: C_LIVE, add: true, wide: 7 });
  g.fx.dust(CATX - 30, fy, 8, { color: 'rgba(150,240,255,.5)', size: 16, up: 40, speed: 200 });
  fovSpike(.05); gustUp(1); hudKick(1.4);
}

function checkMilestones() {
  const m = floor(camX / 10);                       // metres travelled
  const big = floor(m / MILE_M) * MILE_M;
  if (big >= MILE_M && big > mile) {
    mile = big;
    const fy = railY(cat.lane, camX);
    g.showBanner(`${big}M!`, 1.2);
    sfx('fanfare', { pitch: .9 + min(.5, big / 4000), vol: .6 });
    sfx('powerup', { pitch: 1.05, vol: .5 });
    bloomRamp(.55);                                          // the whole scene blooms up
    g.flash('#ffe9a0', .2); g.shake(9); g.punch(.1); g.hitstop(.05);
    g.popup(`${big}M`, CATX + 30, fy - 150, C_AMBER, 36);
    for (let i = 0; i < 26; i++)
      g.fx.emit('confetti', CATX + rnd(-1, 1) * 150, fy - 180 + rnd(-1, 1) * 90,
        { vx: rnd(-1, 1) * 300, vy: -140 - Math.random() * 240, g: 480, life: 1.1 + Math.random(), size: 6 + Math.random() * 5, color: [C_AMBER, C_LIVE, C_HOT, '#fff'][i % 4], drag: .5 });
    g.fx.burst(CATX, fy - 60, 18, { kind: 'star', color: [C_AMBER, '#fff6c2', C_LIVE], speed: 320, life: .8, size: 8, g: 320 });
    g.fx.emit('ring', CATX, fy - 40, { size: 200, life: .55, color: C_AMBER, add: true, wide: 8 });
    gustUp(1); hudKick(1.8); boostT = max(boostT, .5);
  }
  const chk = floor(m / CHECK_M) * CHECK_M;               // quieter ticks between the big banners
  if (chk >= CHECK_M && chk > lastCheck && chk % MILE_M !== 0) {
    lastCheck = chk;
    const fy = railY(cat.lane, camX);
    sfx('blip', { pitch: 1.15, vol: .3 });
    g.popup(`${chk}M`, CATX + 92, fy - 122, 'rgba(170,238,255,.92)', 20);
    g.punch(.018); hudKick(.55);
    g.fx.emit('ring', CATX + 30, fy - 30, { size: 60, life: .3, color: C_LIVE, add: true, wide: 3 });
  }
}

function checkRecord() {
  if (recordDone || g.best <= 0) return;
  if (score <= g.best) return;
  recordDone = true;
  const fy = railY(cat.lane, camX);
  sfx('glass', { pitch: 1.3, vol: .5 });
  sfx('unlock', { pitch: 1.1, vol: .45 });
  g.showBanner('NEW RECORD!', 1);
  g.popup('RECORD', CATX + 26, fy - 140, '#ffffff', 30);
  g.flash('#ffffff', .22); g.punch(.08); g.shake(7); g.hitstop(.05);
  g.fx.burst(CATX, fy - 70, 16, { kind: 'star', color: ['#fff', C_AMBER, C_LIVE], speed: 330, life: .8, size: 8, g: 300 });
  g.fx.emit('ring', CATX, fy - 50, { size: 150, life: .5, color: '#fff', add: true, wide: 8 });
  bloomRamp(.4); gustUp(1); hudKick(1.5);
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (dt <= 0) return;
  frames++; autoT += dt; phaseT += dt; hintT += dt;
  stumbleT = max(0, stumbleT - dt);
  readInput();
  if (phase === 'run') {
    speed = SPEED0 + 190 * prog() + min(150, streak * 9);
    camX += speed * dt;
    if (autoT > .15) botThink();
    checkTier();
    checkMilestones();
    checkRecord();
    /* grind sparks: the signature of the game */
    emitGrind(dt);
    emitAmbient(dt);
    /* vertical */
    if (cat.air) {
      airT += dt;
      cat.dy += cat.vy * dt; cat.vy += GRAV * dt;
      if (cat.vy > 0 && cat.dy >= 0) {
        if (railAt(cat.lane, camX)) land(); else { phase = 'fall'; phaseT = 0; g.combo.miss(); }
      }
    } else {
      if (!railAt(cat.lane, camX)) startFall();
    }
    // orbs
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (o.taken || o.lane !== cat.lane) continue;
      if (abs(o.x - camX) < 30 && cat.dy > -70) {
        o.taken = true; orbCount++;
        score += 25 + streak * 2;
        const ox = sx(o.x), oy = railY(o.lane, o.x);
        const mult = g.combo.mult;
        /* the popup arcs up from the coin: "+5", then the multiplier once the chain is running */
        g.popup(mult > 1 ? `×${mult}` : '+5', ox, oy - 54, mult > 1 ? C_HOT : C_AMBER, mult > 1 ? 34 : 28);
        g.combo.hit();                                     // engine meter + escalating coin pitch
        sfx('pop', { pitch: 1 + min(.9, streak * .07 + orbCount * .02), vol: .45 });
        /* sparkle burst */
        g.fx.burst(ox, oy - 46, 9, { color: C_AMBER, colors: [C_AMBER, '#fff', C_LIVE], spd: 210, life: .35, size: 4, add: true, g: 420 });
        g.fx.burst(ox, oy - 46, 4, { kind: 'star', color: ['#fff6c2', C_AMBER], speed: 150, life: .5, size: 6, g: 140 });
        g.fx.emit('ring', ox, oy - 46, { size: 34, life: .28, color: C_AMBER, add: true, wide: 5 });
        g.punch(.016); hudKick(.55); coinKick(); gustUp(.25);
        if (orbCount % 5 === 0) {                          // every fifth coin in a row escalates
          sfx('coinchain', { pitch: comboPitch(orbCount), vol: .6 });
          g.flash(C_AMBER, .08); g.hitstop(.022); g.shake(3.5); g.punch(.03);
          g.showBanner(`${orbCount} COINS`, .6);
          g.fx.burst(ox, oy - 60, 12, { kind: 'spark', color: [C_AMBER, '#fff'], speed: 280, life: .45, size: 5 });
          gustUp(.8);
        }
      }
    }
    // blockers
    for (let i = 0; i < blockers.length; i++) {
      const b = blockers[i];
      if (b.lane !== cat.lane) continue;
      if (abs(b.x - camX) < 26 && cat.dy > -BLOCK_H) {
        g.impact(sx(b.x), railY(b.lane, b.x) - 26, { punch: .1, shake: 20, stop: .08, flash: '#ffd34d', flashA: .4, sfx: null });
        sfx('zap', { pitch: 1.1, vol: .7 });
        g.fx.burst(sx(b.x), railY(b.lane, b.x) - 26, 18, { color: C_AMBER, colors: [C_AMBER, '#fff', C_HOT], spd: 300, life: .4, size: 5, add: true, g: 700 });
        g.fx.emit('ring', sx(b.x), railY(b.lane, b.x) - 26, { size: 90, life: .35, color: C_AMBER, add: true, wide: 6 });
        crash(); return;
      }
    }
    // junction reached -> streak bonus when we crossed it on the right track
    const jn = nextJunction();
    if (jn && camX > jn.x - 4 && camX < jn.x + 4) {
      if (cat.lane === jn.lane && !cat.air) {
        streak++; bestStreak = max(bestStreak, streak);
        score += 40 + streak * 5;
        g.combo.hit();
        g.popup(streak > 1 ? `x${streak}` : 'NICE!', CATX + 30, railY(cat.lane, camX) - 96, streak > 2 ? C_AMBER : C_LIVE, streak > 2 ? 34 : 26);
        sfx('perfect', { pitch: comboPitch(streak), vol: .5 });
        g.fx.ring(CATX, railY(cat.lane, camX), { r: 44, color: C_LIVE, wide: 3, life: .35 });
        g.fx.burst(CATX, railY(cat.lane, camX) - 20, 8, { color: C_LIVE, colors: [C_LIVE, '#fff'], speed: 200, life: .32, size: 4 });
        g.punch(.04); g.shake(3); hudKick(.8);
        if (streak % 3 === 0) {                            // a clean three: brief boost + FOV spike
          boostT = .55; fovSpike(.075); gustUp(1);
          g.hitstop(.04); g.flash(C_LIVE, .12); g.shake(5); g.punch(.06);
          sfx('powerup', { pitch: 1 + min(.6, streak * .05), vol: .5 });
          g.showBanner(`GRIND ×${streak}`, .7);
          g.fx.burst(CATX - 10, railY(cat.lane, camX) - 40, 14, { kind: 'spark', color: [C_LIVE, '#fff', C_AMBER], speed: 320, ang: Math.PI, spread: 1.9, life: .45, size: 6 });
          bloomRamp(.25);
        }
      }
    }
    if (camX >= GOAL_X) win();
  } else if (phase === 'fall') {
    airT += dt;
    camX += speed * .32 * dt;
    cat.dy += cat.vy * dt; cat.vy += GRAV * 1.15 * dt;
    if (fxRoom() && frames % 3 === 0)
      g.fx.emit('smoke', CATX + rnd(-8, 8), laneYof(cat.ly) + cat.dy - 20, { vx: rnd(-30, 30), vy: -40, g: 60, life: .5, size: 14, color: 'rgba(255,74,216,.35)' });
    if (cat.dy > 250) crash();
  } else if (phase === 'crash') {
    cat.dy += cat.vy * dt; cat.vy += GRAV * dt;
    if (lives <= 0) { if (phaseT > .5) g.end({ win: false, score: Math.round(score), progress: prog() }); }
    else if (phaseT > .8) respawn();
  } else if (phase === 'win') {
    camX += speed * .35 * dt;
    if (fxRoom() && frames % 4 === 0)
      g.fx.emit('confetti', CATX + rnd(-140, 140), rnd(80, 300), { vx: rnd(-80, 80), vy: rnd(-60, 40), g: 260, life: 1.4, size: 6, color: [C_AMBER, C_LIVE, C_HOT, '#fff'][frames % 4], drag: .4 });
    if (phaseT > .62) g.end({ win: true, score: Math.round(score), progress: 1 });
  }
  /* speed camera: a continuous zoom that grows with velocity, relaxing the moment you crash */
  g.cam.scale = phase === 'run'
    ? 1 + clamp((speed - SPEED0) / 420, 0, 1) * .055 + (boostT > 0 ? .04 : 0)
    : 1;
  if (boostT > 0) boostT = max(0, boostT - dt);

  // visual easing (never touches authoritative state)
  cat.ly = damp(cat.ly, cat.lane, 26, dt);
  cat.hop = max(0, cat.hop - dt * 7);
  cat.sq = damp(cat.sq, 1, 9, dt);
  cat.inv = max(0, cat.inv - dt);
  cat.hurt = max(0, cat.hurt - dt);
  g.state = {
    d: Math.round(camX / 10), kmh: Math.round(speed * .36), lives, lane: cat.lane,
    ph: phase, pct: Math.round(prog() * 100), st: streak,
  };
  g.score = Math.round(score);
  if (autoT > 95 && phase === 'run') g.end({ win: true, score: Math.round(score), progress: 1 });
}

function emitGrind(dt) {
  if (g.fx.p.length > 340) return;
  const fy = railY(cat.lane, camX);
  const hot = boostT > 0;
  const n = frames % 2 === 0 ? 2 : 1;
  for (let i = 0; i < n; i++)
    g.fx.emit('spark', CATX - 14, fy - 3, {
      vx: -speed * .45 + rnd2(-90, 70), vy: -rnd2(30, 240), g: 900, life: .2 + R2() * .18, size: rnd2(3, 8),
      color: R2() < .5 ? (hot ? '#fff6c2' : '#bdf8ff') : (R2() < .5 ? '#ffd9a0' : '#ff7ae0'), add: true, drag: 1.1, wide: 2,
    });
  if (frames % 5 === 0)
    g.fx.emit('glow', CATX - 18, fy - 5, { life: .2, size: hot ? 44 : 30, color: hot ? C_AMBER : C_LIVE, add: true, vx: -speed * .2 });
}

/* drifting embers keep the air alive between actions */
function emitAmbient(dt) {
  if (!fxRoom() || Math.random() > dt * 8) return;
  g.fx.emit('glow', rnd(0, W), rnd(200, H - 120), {
    vx: rnd(-16, 12) - speed * .05, vy: -rnd(10, 30), life: rnd(.9, 1.7),
    size: rnd(4, 11), color: Math.random() > .5 ? 'rgba(92,232,255,.3)' : 'rgba(255,74,216,.26)', add: true,
  });
}

/* ---------------------------------------------------------------- bot */
function botThink() {
  const dumb = g.dumb();
  if (dumb) return;                                  // never switches -> falls at the first junction
  // jump blockers in our lane
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    if (b && b.lane === cat.lane && !cat.air) {
      const d = b.x - camX;
      if (d > speed * .12 && d < speed * .27) { doJump(); return; }
    }
  }
  // steer onto the live rail before it ends
  const jn = nextJunction();
  if (jn && jn.lane !== cat.lane) {
    const d = jn.x - camX;
    if (d < 90 || !railAt(cat.lane, camX)) doSwitch(jn.lane > cat.lane ? 1 : -1);
  }
}

/* ---------------------------------------------------------------- art: cached city layers */
function mkCity(w, h, o) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  let s = o.seed;
  const rr2 = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let x = -20;
  while (x < w + 40) {
    const bw = o.minW + rr2() * (o.maxW - o.minW);
    const bh = o.minH + rr2() * (o.maxH - o.minH);
    const y = h - bh;
    c.fillStyle = o.body;
    c.fillRect(x, y, bw, bh);
    if (o.rim) { c.fillStyle = o.rim; c.fillRect(x, y, bw, 2.5); c.globalAlpha = .5; c.fillRect(x + bw - 2, y, 2, bh); c.globalAlpha = 1; }
    if (o.win) {
      for (let wy = y + 10; wy < h - 8; wy += 12) for (let wx = x + 5; wx < x + bw - 6; wx += 11)
        if (rr2() < o.winP) { c.fillStyle = rr2() < .5 ? o.win : o.win2; c.globalAlpha = .55 + rr2() * .45; c.fillRect(wx, wy, 3.5, 4.5); c.globalAlpha = 1; }
    }
    if (o.ant && rr2() < .35) { c.strokeStyle = o.rim || o.body; c.lineWidth = 2; c.beginPath(); c.moveTo(x + bw / 2, y); c.lineTo(x + bw / 2, y - 18 - rr2() * 30); c.stroke(); }
    x += bw + o.gap * (.4 + rr2());
  }
  return cv;
}
/* three parallax layers: far haze, mid towers, near silhouettes — each scrolls at its own rate */
const FAR = mkCity(1200, 460, { seed: 7717, body: '#150d2e', rim: '#2b1d55', minW: 26, maxW: 78, minH: 90, maxH: 300, gap: 10, win: '#7fe6ff', win2: '#ff7ae0', winP: .07 });
const MID = mkCity(1000, 520, { seed: 3313, body: '#1d1140', rim: '#4b2b8f', minW: 40, maxW: 110, minH: 130, maxH: 400, gap: 22, win: '#8ff2ff', win2: '#ffcf6d', winP: .05, ant: 1 });
const NEAR = mkCity(760, 620, { seed: 9137, body: '#0c0720', rim: '#3a1a63', minW: 60, maxW: 150, minH: 200, maxH: 560, gap: 40, win: '#bff6ff', win2: '#ff9ae0', winP: .035, ant: 1 });

/* speed streaks (foreground depth) */
const STREAK = [];
for (let i = 0; i < 20; i++) STREAK.push({ y: 90 + i * 44 + (i % 3) * 12, len: 50 + (i % 5) * 40, z: .55 + (i % 4) * .34, off: i * 233 });

/* ---------------------------------------------------------------- draw */
function draw(ctx) {
  const t = g.t;
  const sp = clamp((speed - SPEED0) / 340, 0, 1);
  const gust = feel.gust;
  if (g.post) { g.post.bloom = BASE_BLOOM + feel.bloom; g.post.ca = .4 + sp * .2 + feel.bloom * .8; }

  ctx.save();
  /* FOV-style boost spike: a brief scale punch anchored near the horizon */
  if (feel.fov > .0008 || feel.tilt) {
    const k = 1 + feel.fov;
    ctx.translate(CATX * .8, H * .4);
    ctx.scale(k, k);
    ctx.rotate(feel.tilt * .16);
    ctx.translate(-CATX * .8, -H * .4);
  }

  g.sky(ctx, ['#090620', '#1a0b36', '#39103f'], { glow: 'rgba(92,232,255,.16)', gx: .76, gy: .16, gr: 1.1 });

  // planet + glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pr = 150;
  for (let i = 3; i >= 1; i--) {
    const rad = pr * (1 + i * .42);
    const gr2 = ctx.createRadialGradient(410, 300, 0, 410, 300, rad);
    gr2.addColorStop(0, 'rgba(255,74,216,' + (.13 / i + feel.bloom * .06) + ')'); gr2.addColorStop(1, 'rgba(255,74,216,0)');
    ctx.fillStyle = gr2; ctx.beginPath(); ctx.arc(410, 300, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#ffb0e8';
  ctx.beginPath(); ctx.arc(410, 300, pr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20103c'; ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.arc(410 - 52, 300 - 40, pr * .98, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;

  // stars (layer 0) — twinkle faster as you accelerate
  for (let i = 0; i < 54; i++) {
    const px = ((i * 137.5 + camX * .02) % (W + 40)) - 20, py = (i * 71.3) % 420;
    const tw = .35 + .65 * abs(sin(t * (1.6 + sp * 2.4) + i));
    ctx.fillStyle = 'rgba(255,255,255,' + (.18 + tw * .5) + ')';
    ctx.fillRect(px, py, 2, 2);
  }

  /* ---- parallax layer 1: far city ---- */
  const fy = H * .58;
  ctx.globalAlpha = .9;
  let off = -((camX * .06) % 1200);
  for (let i = 0; i < 2; i++) ctx.drawImage(FAR, off + i * 1200, fy - 460 + 60);
  ctx.globalAlpha = 1;
  /* ---- parallax layer 2: mid towers ---- */
  off = -((camX * .17) % 1000);
  for (let i = 0; i < 2; i++) ctx.drawImage(MID, off + i * 1000, H * .34);
  /* ---- parallax layer 3: near silhouettes (faster than the track) ---- */
  off = -((camX * .38) % 760);
  ctx.globalAlpha = .82;
  for (let i = 0; i < 2; i++) ctx.drawImage(NEAR, off + i * 760, H * .74 - 620);
  ctx.globalAlpha = 1;

  // horizon haze
  const hz = ctx.createLinearGradient(0, H * .42, 0, H * .86);
  hz.addColorStop(0, 'rgba(255,74,216,0)'); hz.addColorStop(.42, 'rgba(255,74,216,.12)'); hz.addColorStop(1, 'rgba(92,232,255,.03)');
  ctx.fillStyle = hz; ctx.fillRect(0, H * .42, W, H * .46);

  drawTracks(ctx);
  drawGate(ctx);
  // orbs
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    if (o.taken) continue;
    const x0 = sx(o.x);
    if (x0 < -40 || x0 > W + 40) continue;
    const y0 = railY(o.lane, o.x) - 50 + sin(t * 3 + o.ph) * 6;
    const pulse = .8 + .2 * sin(t * 6 + o.ph);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(C_AMBER, .28 * (1 + feel.coin * .5)); ctx.beginPath(); ctx.arc(x0, y0, 22 * pulse * (1 + feel.coin * .3), 0, TAU); ctx.fill();
    ctx.restore();
    starPath(ctx, x0, y0, 11 * pulse, -Math.PI / 2);
    ctx.fillStyle = C_AMBER; ctx.fill();
    ctx.strokeStyle = '#fff8d8'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#fffdf0'; ctx.beginPath(); ctx.arc(x0 - 2, y0 - 2, 3, 0, TAU); ctx.fill();
  }
  // blockers
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    const x0 = sx(b.x);
    if (x0 < -50 || x0 > W + 50) continue;
    const y0 = railY(b.lane, b.x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bg = ctx.createLinearGradient(0, y0 - 70, 0, y0);
    bg.addColorStop(0, 'rgba(255,211,77,0)'); bg.addColorStop(1, 'rgba(255,74,216,.4)');
    ctx.fillStyle = bg; ctx.fillRect(x0 - 16, y0 - 70, 32, 70);
    ctx.restore();
    ctx.fillStyle = '#1a0b2a'; rr(ctx, x0 - 8, y0 - BLOCK_H - 4, 16, BLOCK_H + 4, 4); ctx.fill();
    ctx.strokeStyle = C_AMBER; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = C_HOT; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const yy = y0 - BLOCK_H - 2 + k * (BLOCK_H / 6);
      const xx = x0 + sin(t * 26 + k * 2.1 + b.z * 9) * 9;
      k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = C_AMBER; ctx.beginPath(); ctx.arc(x0, y0 - BLOCK_H - 8, 4.5, 0, TAU); ctx.fill();
  }

  drawCat(ctx, t);
  drawForeground(ctx, sp, t, gust);
  ctx.restore();

  drawHUD(ctx, t, sp);
}

function drawTracks(ctx) {
  // dead lane guides — the 3-track structure reads even where no live rail exists
  for (let l = 0; l < LANES; l++) {
    ctx.save();
    ctx.setLineDash([9, 16]);
    ctx.lineDashOffset = -camX * .5;
    ctx.strokeStyle = 'rgba(120,150,255,.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, railY(l, camX - (CATX + 20)));
    ctx.lineTo(W + 20, railY(l, camX + (W + 20 - CATX)));
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < rails.length; i++) {
    const r = rails[i];
    const x0 = sx(r.x0), x1 = sx(r.x1);
    if (x1 < -60 || x0 > W + 120) continue;
    const y0 = railY(r.lane, r.x0), y1 = railY(r.lane, r.x1);
    // glow bed — brightens with speed and boost
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(C_LIVE, .12 + feel.gust * .05); ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = hexA(C_LIVE, .3 + feel.gust * .1); ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
    // pylons
    for (let px = max(r.x0, camX - 260); px < r.x1; px += 210) {
      const xa = sx(px), ya = railY(r.lane, px);
      if (xa < -20 || xa > W + 20) continue;
      ctx.strokeStyle = 'rgba(80,60,140,.55)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa - 46, H + 60); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,90,200,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xa + 16, ya + 4); ctx.lineTo(xa - 30, H + 60); ctx.stroke();
    }
    // rail core
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = C_LIVE; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x0, y0 + 4); ctx.lineTo(x1, y1 + 4); ctx.stroke();
    // energy pulses running along the rail
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let q = 0; q < 4; q++) {
      const u = ((camX * 1.6 + q * 90) % 360) / 360;
      const px = lerp(x0, x1, (u + q * .25) % 1);
      const py = lerp(y0, y1, (u + q * .25) % 1);
      if (px < x0 - 4 || px > x1 + 4) continue;
      ctx.fillStyle = 'rgba(200,255,255,.85)';
      ctx.fillRect(px - 12, py - 2, 24, 4);
    }
    ctx.restore();
    // hazard tip
    const tipx = x1, tipy = y1;
    if (tipx > -30 && tipx < W + 30) {
      const pl = .55 + .45 * sin(g.t * 9);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(C_HOT, .35 * pl);
      ctx.beginPath(); ctx.arc(tipx, tipy, 26, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = C_HOT;
      ctx.beginPath(); ctx.moveTo(tipx, tipy - 13); ctx.lineTo(tipx + 11, tipy + 6); ctx.lineTo(tipx - 11, tipy + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a0410'; ctx.fillRect(tipx - 1.6, tipy - 6, 3.2, 6);
    }
  }
  // junction arrows: which way to go
  const jn = nextJunction();
  if (jn && phase === 'run') {
    const d = jn.x - camX;
    if (d > -30 && d < 420) {
      const a = clamp((420 - d) / 260, 0, 1);
      const col = jn.lane < cat.lane ? C_AMBER : C_LIVE;
      const ax = sx(jn.x - 30) + sin(g.t * 8) * 5;
      const ay = railY(jn.lane, jn.x - 30) - 66;
      const dir = jn.lane < cat.lane ? -1 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = hexA(col, .9);
      for (let k = 0; k < 3; k++) {
        const yy = ay + dir * k * 20;
        ctx.beginPath();
        ctx.moveTo(ax - 17, yy + dir * 12); ctx.lineTo(ax, yy); ctx.lineTo(ax + 17, yy + dir * 12);
        ctx.lineWidth = 8; ctx.strokeStyle = hexA(col, .95); ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.font = '800 20px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
      const label = (dir < 0 ? 'SWITCH ▲' : 'SWITCH ▼');
      ctx.strokeText(label, ax, ay + dir * -34); ctx.fillText(label, ax, ay + dir * -34);
      ctx.restore();
    }
  }
}

function drawGate(ctx) {
  const gx = sx(GOAL_X);
  if (gx < -200 || gx > W + 400) return;
  const yA = railY(0, GOAL_X) - 8, yB = railY(2, GOAL_X) + 8;
  const pulse = .6 + .4 * sin(g.t * 4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createLinearGradient(gx - 40, 0, gx + 40, 0);
  gr.addColorStop(0, 'rgba(92,232,255,0)'); gr.addColorStop(.5, hexA(C_LIVE, (.45 + feel.bloom * .3) * pulse)); gr.addColorStop(1, 'rgba(92,232,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(gx - 40, yA - 150, 80, yB - yA + 170);
  ctx.restore();
  ctx.strokeStyle = C_LIVE; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx - 4, yA - 160); ctx.lineTo(gx - 4, yB + 100); ctx.stroke();
  ctx.strokeStyle = '#eafcff'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(gx - 4, yA - 160); ctx.lineTo(gx - 4, yB + 100); ctx.stroke();
  // banner
  ctx.save();
  ctx.fillStyle = '#12061f'; rr(ctx, gx - 118, yA - 214, 232, 56, 12); ctx.fill();
  ctx.strokeStyle = C_HOT; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#12061f'; ctx.fillRect(gx - 112 + i * 22.4, yA - 208, 11.2, 8); ctx.fillStyle = i % 2 ? '#12061f' : '#fff'; ctx.fillRect(gx - 112 + i * 22.4, yA - 200, 11.2, 8); }
  ctx.font = '900 30px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5;
  ctx.strokeText('FINISH', gx, yA - 176); ctx.fillText('FINISH', gx, yA - 176);
  ctx.restore();
}

function drawCat(ctx, t) {
  const falling = phase === 'fall' || phase === 'crash';
  const hopY = cat.hop > 0 ? sin(cat.hop * Math.PI) * 24 : 0;
  const feet = laneYof(cat.ly) + cat.dy - hopY;
  // shadow/glow on the rail
  if (!falling && phase !== 'win') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(boostT > 0 ? C_AMBER : C_LIVE, .35 + feel.gust * .12);
    ctx.beginPath(); ctx.ellipse(CATX - 4, laneYof(cat.ly) + 2, 44 + feel.gust * 10, 9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(CATX, feet);
  /* the tilt from a lane swap is baked into the body, then springs back */
  ctx.rotate(falling ? clamp(cat.dy * .012, 0, 1.4) : (-0.13 + sin(t * 3.4) * .03 + feel.tilt));
  ctx.scale(2 - cat.sq, cat.sq);
  if (cat.inv > 0 && floor(t * 20) % 2 === 0) ctx.globalAlpha = .5;
  drawChar('cat', ctx, 0, 0, 80, { dir: 1, anim: 'walk', t: t * (1.7 + feel.gust * .6), color: '#ffa63c', hurt: cat.hurt > 0 });
  ctx.restore();
  // trail — longer and hotter at speed / boost
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const tr = 3 + (boostT > 0 ? 2 : 0);
  for (let i = 0; i < tr; i++) {
    ctx.fillStyle = hexA(i ? (boostT > 0 ? C_AMBER : C_LIVE) : '#ffffff', .1 - i * .02);
    ctx.beginPath(); ctx.ellipse(CATX - 30 - i * 22, feet - 40, 26 + i * 10 + feel.gust * 8, 16 + i * 6, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawForeground(ctx, sp, t, gust) {
  // speed streaks (closer than the track -> parallax > 1), longer as you accelerate
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const heat = sp + gust * .5;
  for (let i = 0; i < STREAK.length; i++) {
    const s = STREAK[i];
    const x = W + 120 - ((camX * s.z * 1.9 + s.off) % (W + 320));
    ctx.fillStyle = 'rgba(190,240,255,' + (.05 + heat * .17) + ')';
    ctx.fillRect(x, s.y, s.len * (1 + heat * 1.3), 2);
  }
  // boost chevrons racing backwards past the cat
  if (heat > .45) {
    for (let i = 0; i < 6; i++) {
      const x = W + 60 - ((camX * 2.6 + i * 190) % (W + 240));
      const y = 120 + (i * 137) % (H - 260);
      ctx.strokeStyle = `rgba(255,211,77,${(.06 + (heat - .45) * .3).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34, y + 9); ctx.stroke();
    }
  }
  ctx.restore();
  // near pylons / bars
  for (let i = 0; i < 5; i++) {
    const x = W + 80 - ((camX * 1.5 + i * 260) % (W + 260));
    ctx.fillStyle = 'rgba(6,4,14,.85)';
    ctx.fillRect(x, -20, 26, H + 40);
    ctx.fillStyle = 'rgba(255,74,216,.35)';
    ctx.fillRect(x + 9, -20, 3, H + 40);
  }
}

function drawHUD(ctx, t, sp) {
  const pw = 1 + feel.hud * .1;
  ctx.save();
  ctx.textAlign = 'left';
  // progress bar (visible goal)
  const px = 34, py = 44, pwid = W - 68, ph = 13;
  ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(ctx, px, py, pwid, ph, 7); ctx.fill();
  const f = clamp(camX / GOAL_X, 0, 1);
  const gr = ctx.createLinearGradient(px, 0, px + pwid, 0);
  gr.addColorStop(0, C_LIVE); gr.addColorStop(1, C_HOT);
  ctx.fillStyle = gr; rr(ctx, px, py, max(ph, pwid * f), ph, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px + pwid * f, py + ph / 2, 8 + feel.hud * 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0b0620'; ctx.beginPath(); ctx.arc(px + pwid * f, py + ph / 2, 3.4, 0, TAU); ctx.fill();
  // finish flag icon
  ctx.fillStyle = C_AMBER; ctx.fillRect(px + pwid - 1, py - 12, 2.5, 16);
  ctx.fillRect(px + pwid + 1, py - 12, 10, 7);
  ctx.font = '800 15px "Trebuchet MS",sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText('FINISH ' + Math.round(f * 100) + '%', px, py - 12);

  // speed (kicks on every tier-up)
  ctx.save();
  ctx.translate(px, 122); ctx.scale(pw, pw);
  ctx.font = '900 40px "Trebuchet MS",sans-serif';
  ctx.fillStyle = feel.hud > .3 ? '#fff9d0' : '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6;
  const kmh = Math.round(speed * .36);
  ctx.strokeText(String(kmh), 0, 0); ctx.fillText(String(kmh), 0, 0);
  ctx.font = '800 15px "Trebuchet MS",sans-serif'; ctx.fillStyle = C_LIVE;
  ctx.fillText('KM/H', ctx.measureText(String(kmh)).width + 46, -2);
  ctx.restore();
  // speed bar
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, px, 132, 168, 8, 4); ctx.fill();
  const sg = ctx.createLinearGradient(px, 0, px + 168, 0);
  sg.addColorStop(0, C_LIVE); sg.addColorStop(1, C_AMBER);
  ctx.fillStyle = sg; rr(ctx, px, 132, 12 + 156 * sp, 8, 4); ctx.fill();
  // gear pips
  for (let i = 0; i < TIERS.length; i++) {
    ctx.fillStyle = i < tier ? C_AMBER : 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.arc(px + 178 + i * 9, 136, 2.4, 0, TAU); ctx.fill();
  }

  // distance + streak (right)
  ctx.textAlign = 'right';
  ctx.font = '900 30px "Trebuchet MS",sans-serif'; ctx.fillStyle = '#fff';
  ctx.strokeText(Math.round(camX / 10) + ' M', px + pwid, 122); ctx.fillText(Math.round(camX / 10) + ' M', px + pwid, 122);
  if (streak > 1) {
    ctx.font = '900 22px "Trebuchet MS",sans-serif'; ctx.fillStyle = C_AMBER;
    ctx.strokeText('GRIND x' + streak, px + pwid, 152); ctx.fillText('GRIND x' + streak, px + pwid, 152);
  }
  // lives
  for (let i = 0; i < 3; i++) {
    const hx = px + pwid - 8 - i * 26, hy = 78;
    const on = i < lives;
    ctx.save();
    ctx.translate(hx, hy); ctx.scale(1.05 + (on && feel.hud > .5 ? .18 : 0), 1.05 + (on && feel.hud > .5 ? .18 : 0));
    heartPath(ctx, 0, 0, 9);
    if (on) { ctx.fillStyle = C_HOT; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (on) { ctx.fillStyle = hexA('#ffffff', .7); ctx.beginPath(); ctx.arc(-3, -3, 2.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // incoming junction warning banner
  const jn = nextJunction();
  if (jn && phase === 'run') {
    const d = jn.x - camX;
    if (d > 0 && d < 200 && jn.lane !== cat.lane) {
      const a = .55 + .45 * sin(g.t * 14);
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = '900 26px "Trebuchet MS",sans-serif';
      ctx.fillStyle = C_AMBER; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5;
      const msg = jn.lane < cat.lane ? '▲ JUMP TRACK' : '▼ DROP TRACK';
      ctx.strokeText(msg, W / 2, 214); ctx.fillText(msg, W / 2, 214);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- lifecycle */
resetWorld();
g.onStart = () => {
  music('chase');
  sfx('click', { pitch: 1.1, vol: .5 });
  sfx('powerup', { pitch: 1.1, vol: .6 });
  g.showBanner('GRIND!', .7);
  g.popup('GO!', CATX, railY(cat.lane, camX) - 120, C_LIVE, 34);
  g.punch(.06); g.flash(C_LIVE, .12);
  g.fx.burst(CATX, railY(cat.lane, camX) - 40, 16, { color: C_LIVE, colors: [C_LIVE, '#fff', C_AMBER], speed: 300, life: .5, size: 6 });
  g.fx.emit('ring', CATX, railY(cat.lane, camX), { size: 120, life: .45, color: C_LIVE, add: true, wide: 7 });
  hudKick(1.4);
};
g.onReset = () => { resetWorld(); music('chase'); };
g.update = update;
g.draw = draw;
g.start();
window.__g = g;

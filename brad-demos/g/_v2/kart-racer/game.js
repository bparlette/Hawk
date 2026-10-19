// NEON RUSH — kart-racer (Cat Arcade v2)
// ONE lap, three rivals, one pseudo-3D road. Hold left / right to steer, grab the green pads,
// don't clip the neon barriers. Pass all three before the line or the lap is lost.
//
// Feel pass: speed is sold in layers —
//   · the lens rides the throttle (zoom creeps up with velocity, hard punch on every boost kick)
//   · drift sparks that charge cyan → gold → magenta, a rising charge tick, then a mini-boost
//     on release with a flame burst, speed lines and a hit-stop
//   · four parallax depths behind a barrier, roadside billboards that streak past your shoulder
//   · arcing pops ("+BOOST", "DRIFT ×3"), a drift chain meter that pitches up as it grows
//   · checkpoints, halfway, final stretch and the line all land a banner + a burst
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU, damp, rr, panel, fmt, hexA } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const M = (a, b) => (a + b) / 2;   // midpoint helper for fx ranges
const W = 540, H = 960, HORIZON = 392;
const K = 240, CAMH = 300, ROAD = 120, SEG = 120, DRAWD = 112;
const MAXS = 4700, RACE_LEN = 34000, RACE_MAX_T = 9.4;
const LANES = [-0.62, -0.2, 0.22, 0.62];
const CHECKPOINTS = [8600, 17200, 25800];

/* the three drift tiers: how long you have held the slide, how hot the tyres burn, and the
   mini-boost you cash in when you let go */
const DRIFT = [
  { name: 'DRIFT', at: 0, col: '#7ef7ff', boost: .5, spark: ['#7ef7ff', '#d8ffff', '#ffffff'] },
  { name: 'NICE', at: .38, col: '#ffd34d', boost: .8, spark: ['#ffd34d', '#fff2a8', '#ffffff'] },
  { name: 'INSANE', at: .72, col: '#ff2d78', boost: 1.15, spark: ['#ff2d78', '#ffb0d0', '#ffffff'] },
];

const g = makeGame({
  id: 'kart-racer', title: 'NEON RUSH', sub: 'HOLD LEFT / RIGHT  ·  PASS ALL 3',
  hook: 'one lap. three rivals. no brakes.', w: W, h: H, bg: '#08070f',
  bloom: .95, ca: .42, vig: 1, scan: .16,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');

/* ------------------------------------------------------------------ road math */
// The road centre is analytic (no accumulation drift): the camera sits on it, so the
// far road swings away from you exactly like an Outrun cabinet.
const cxAt = z => Math.sin(z * 0.000208) * 2500 + Math.sin(z * 0.000071 + 1.3) * 1150;
const curveAt = z => Math.sin(z * 0.000208 + 0.9) * 0.95 + Math.sin(z * 0.000071 - 0.4) * 0.55;
const camH = z => HORIZON + CAMH * K / z;                       // screen y of the road surface
const scAt = z => K / z;                                        // px per world unit
const wrap = (v, m) => ((v % m) + m) % m;

/* ------------------------------------------------------------------ state */
let camZ, px, pvx, speed, boostT, boostPulse, wipes, timer, passes, pads, rivals, camX;
let driftT, driftTick, driftTier, driftChain, driftDir, sparkT, shakeT;
let tier, revT, cpIdx, markHalf, markFinal, autoT, padStreak, flashT;
const cam = { boost: 0, zoom: 0 };          // tweened camera kick that rides on top of the speed zoom
const arc = [];                             // score popups that arc upward under gravity
const PAD_DEFS = [
  { z: 3600, lane: -0.34 }, { z: 8200, lane: 0.4 }, { z: 13400, lane: -0.5 },
  { z: 18800, lane: 0.16 }, { z: 24400, lane: -0.28 }, { z: 29800, lane: 0.46 },
];
const RIVAL_DEFS = [
  { gap: 4150, v: 3990, lane: -0.36, body: '#16c2ab', ch: '#c98a4b', kind: 'dog', name: 'REX' },
  { gap: 2820, v: 3930, lane: 0.4, body: '#8b5cf6', ch: '#8fcf7a', kind: 'zombie', name: 'ZED' },
  { gap: 1520, v: 3870, lane: -0.06, body: '#ffd34d', ch: '#f4efe4', kind: 'capyyuzu', name: 'MOG' },
];

function resetWorld() {
  camZ = 0; px = 0; pvx = 0; speed = 0; boostT = 0; boostPulse = 0; wipes = 0; timer = 0; passes = 0;
  driftT = 0; driftTick = 0; driftTier = 0; driftChain = 0; driftDir = 1; sparkT = 0; shakeT = 0;
  tier = 0; revT = 0; cpIdx = 0; markHalf = 0; markFinal = 0; autoT = 0; padStreak = 0; flashT = 0;
  pads = PAD_DEFS.map(p => ({ z: p.z, lane: p.lane, taken: false }));
  rivals = RIVAL_DEFS.map((r, i) => ({ z: r.gap, v: r.v, lane: r.lane, base: r.lane, body: r.body, ch: r.ch, kind: r.kind, name: r.name, passed: false, bump: 0, wob: i * 2.1 }));
  camX = cxAt(camZ) + px * ROAD;
  arc.length = 0;
  cam.boost = 0; cam.zoom = 0;
  g.cam.scale = 1; g.cam.x = 0; g.cam.y = 0;
  g.combo.reset(); g.fx.clear();
  g.state = { place: 4, dist: 0, wipes: 0, passes: 0, boost: 0, chain: 0 };
  say('LAP 1 / 1  ·  GO!', 1.2);
  sfx('click', { pitch: 1.05, vol: .8 }); sfx('drum', { vol: .55 }); sfx('powerup', { pitch: 1.1 });
}
function say(txt, dur) { g.showBanner(txt, dur); }
function arcPop(txt, x, y, col, size) {
  arc.push({ txt, x, y, vx: rnd(-18, 18), vy: -206, col: col || '#fff', size: size || 28, t: 0, life: 1 });
  if (arc.length > 12) arc.shift();
}
const kartX = () => W / 2 + px * 16;
const kartY = () => H - 108;

/* ------------------------------------------------------------------ input */
function steerInput() {
  let s = 0;
  if (g.keys.ArrowLeft || g.keys.KeyA || g.keys.KeyQ) s -= 1;
  if (g.keys.ArrowRight || g.keys.KeyD || g.keys.KeyE) s += 1;
  if (g.ptr.down) { if (g.ptr.x < W * 0.42) s = -1; else if (g.ptr.x > W * 0.58) s = 1; }
  if (g.pointers && g.pointers.size) for (const p of g.pointers.values()) {
    if (p.y > H * 0.55) { if (p.x < W * 0.38) s = -1; else if (p.x > W * 0.62) s = 1; }
  }
  return s;
}

/* ------------------------------------------------------------------ bot */
// dumb: never touches the wheel -> the curve drags it into the barrier and it wipes out.
// smart: aims at the next green pad, dodges rival karts, never leaves the tarmac.
function botSteer() {
  if (g.dumb()) return 0;
  let tgt = 0, best = 1e9;
  for (const pad of pads) { if (pad.taken) continue; const d = pad.z - camZ; if (d > 260 && d < best) { best = d; tgt = pad.lane; } }
  for (const r of rivals) {
    const d = r.z - camZ;
    if (d > 60 && d < 620 && Math.abs(r.lane - px) < 0.42) tgt = px < r.lane ? r.lane - 0.85 : r.lane + 0.85;
  }
  tgt = clamp(tgt, -0.72, 0.72);
  return clamp((tgt - px) * 4.2 + (curveAt(camZ) * 0.16), -1, 1);
}

/* ------------------------------------------------------------------ juice: the boost kick */
/** one call for "the throttle just opened": punch, kick, flash, flames, speed lines, hit-stop */
function boostStart(power, label, col) {
  boostT = Math.max(boostT, power);
  boostPulse = 1;
  cam.zoom = .028; g.tween(cam, 'zoom', 0, .46, t2 => 1 - (1 - t2) ** 3);
  cam.boost = .014; g.tween(cam, 'boost', 0, .8);
  g.punch(.12); g.shake(8); g.hitstop(.05);
  g.flash(col || '#b6ffe0', .2);
  const x = kartX(), y = kartY() + 10;
  g.fx.burst(x, y, 22, { color: ['#ffd34d', '#ff7a1a', '#ffffff', col || '#7ef7ff'], speed: 330, life: .55, size: 7, gravity: -180, drag: 1.6 });
  g.fx.emit('glow', x, y + 6, { size: 78, life: .28, color: col || '#7ef7ff', add: true });
  g.fx.ring(x, y, { r: 82, color: col || '#7ef7ff', life: .34, wide: 6 });
  g.fx.dust(x, y + 4, 6, { color: 'rgba(255,225,180,.5)', spread: 40, speed: 150, up: 50 });
  sfx('whoosh', { pitch: 1.28, vol: .65 });
  sfx('powerup', { pitch: comboPitch(padStreak + driftChain) });
  if (label) g.popup(label, x, y - 96, col || '#b6ffe0', 34);
}

/* ------------------------------------------------------------------ juice: drifting */
function driftStart() {
  driftDir = Math.sign(pvx) || 1;
  sfx('whoosh', { pitch: .82, vol: .45 });
  g.punch(.045); g.shake(3);
  const x = kartX() + driftDir * 44, y = kartY() + 6;
  g.fx.ring(x, y, { r: 34, color: '#7ef7ff', life: .26, wide: 4, ripple: false });
  g.fx.emit('glow', x, y, { size: 34, life: .3, color: '#7ef7ff', add: true });
  g.popup('DRIFT', x + driftDir * 24, kartY() - 120, '#7ef7ff', 26);
  g.hitstop(.02);
}
function driftSparks(ch, ti) {
  const d = DRIFT[ti], s = driftDir, x0 = kartX() + s * 44, y0 = kartY() + 10;
  for (let i = 0; i < 2; i++) {
    const x = x0 + rnd(-9, 9), y = y0 + rnd(-5, 5);
    g.fx.emit('spark', x, y, {
      vx: -s * rnd(70, 250), vy: rnd(-170, -20), g: 760, life: rnd(.2, .42),
      size: rnd(3, 6) + ch * 3, color: d.spark[i], add: true, wide: 2.6, drag: .8,
    });
    g.fx.emit('glow', x, y, { size: 9 + ch * 13, life: .15, color: d.col, add: true, vx: -s * 90, vy: rnd(-70, -10) });
  }
}
function driftTierUp(ti) {
  const d = DRIFT[ti], x = kartX() + driftDir * 46;
  g.flash(d.col, .13); g.punch(.07); g.shake(4); g.hitstop(.028);
  g.fx.ring(x, kartY() + 8, { r: 58 + ti * 26, color: d.col, life: .28, wide: 4, ripple: false });
  g.fx.burst(x, kartY() + 8, 8, { color: d.spark, speed: 250, life: .35, size: 5 });
  g.popup(d.name, x + driftDir * 20, kartY() - 150, d.col, 26);
  sfx('perfect', { pitch: comboPitch(ti + 2), vol: .5 });
}
function releaseDrift() {
  const ch = clamp(driftT / .95, 0, 1), ti = driftTier, d = DRIFT[ti];
  const x = kartX() + driftDir * 46, y = kartY() + 8;
  if (driftT > .2) {
    driftChain++;
    boostStart(d.boost, '+BOOST', d.col);
    g.fx.burst(x, y, 18, { kind: 'spark', color: d.spark, speed: 300, life: .5, size: 6, ang: Math.PI / 2, spread: 1.9 });
    g.combo.hit(x, kartY() - 60, `DRIFT ×${Math.min(9, driftChain)}`);   // combo + popup + comboPitch
    arcPop('+' + Math.round(140 + ch * 460), x, kartY() - 100, d.col, 30);
    if (driftChain === 2) { sfx('coinchain', { pitch: 1.15 }); g.fx.ring(x, y, { r: 96, color: d.col, life: .34, wide: 5 }); }
    if (driftChain === 4) { sfx('fanfare', { pitch: 1.2, vol: .55 }); g.flash('#ffd34d', .16); g.popup('CHAIN MASTER', W / 2, H * .3, '#ffd34d', 28); }
  }
  driftT = 0; driftTier = 0; driftTick = 0; sparkT = 0;
}

/* ------------------------------------------------------------------ events */
function wipeOut() {
  wipes++;
  const side = px > 0 ? 1 : -1;
  px = side * 0.66; pvx = 0;
  speed *= 0.3;
  camZ -= 140;
  driftT = 0; driftTier = 0; driftChain = 0;
  g.impact(W / 2, H * .4, { shake: 20, punch: .09, stop: .16, flash: '#fff', flashA: .45, rip: 1.6 });
  g.fx.burst(W / 2 + side * 120, H - 130, 26, { color: ['#7ef7ff', '#ff2d78', '#fff'], speed: rnd(220, 560), size: rnd(3, 8), g: 900, life: rnd(.3, .8) });
  g.fx.burst(W / 2, H - 150, 10, { color: ['#ffd34d'], speed: rnd(260, 620), size: rnd(2, 6), g: 600, life: rnd(.3, .6) });
  g.fx.blast(W / 2 + side * 60, H - 150, { r: 88, color: '#ff2d78', colors: ['#ff2d78', '#ffd34d', '#ffffff'], n: 20, flashA: .2, shake: 0, punch: 0 });
  g.hitstop(.08); g.slowmo(.4, .22);
  g.combo.miss();
  g.popup('WIPEOUT', W / 2, H * .42, '#ff4d6d', 38);
  sfx('hit', { pitch: .8, vol: .9 }); sfx('thud', { vol: .8 }); sfx('glass', { pitch: .75, vol: .6 });
  say('WIPEOUT!', 1.1);
  if (wipes >= 3) finish(false);
}

function takePad(pad) {
  pad.taken = true;
  padStreak++;
  boostStart(1.15, 'BOOST', '#7ef7ff');
  g.combo.hit(W / 2, H * 0.62, 'PAD');
  g.fx.burst(W / 2, H - 200, 22, { color: ['#4dffa1', '#7ef7ff', '#fff'], speed: rnd(220, 560), size: rnd(3, 8), g: -520, life: rnd(.25, .6) });
  g.fx.ring(W / 2, H - 150, { r: 110, color: '#4dffa1', life: .4, wide: 7 });
  sfx('powerup', { pitch: comboPitch(Math.min(11, padStreak * 2)) });
  arcPop('+' + (150 + padStreak * 50), W / 2, H - 210, '#4dffa1', 28);
}

function checkpoint(i) {
  cpIdx = i + 1;
  say(`CHECKPOINT ${i + 1} / 3`, .95);
  sfx('perfect', { pitch: 1 + i * .12, vol: .75 });
  sfx('unlock', { pitch: 1 + i * .1, vol: .5 });
  g.flash('#7ef7ff', .18); g.punch(.1); g.shake(7); g.hitstop(.05);
  g.fx.burst(W / 2, H * .5, 26, { color: ['#7ef7ff', '#ffffff', '#ffd34d'], speed: 380, life: .6, size: 7, gravity: 140 });
  g.fx.ring(W / 2, H * .5, { r: 170, color: '#7ef7ff', life: .46, wide: 8 });
  g.fx.ring(W / 2, H * .5, { r: 90, color: '#ffffff', life: .3, wide: 4, ripple: false });
  g.popup('CHECKPOINT', W / 2, H * .42, '#7ef7ff', 34);
  arcPop('+' + 250, W / 2, H * .54, '#7ef7ff', 32);
}

function finish(forcedWin) {
  if (g.mode !== 'play') return;
  const ahead = rivals.filter(r => r.z > camZ).length;
  const place = 1 + ahead;
  const win = forcedWin === false ? false : place === 1;
  const score = Math.max(120, Math.round(camZ / 32) + passes * 220 + (4 - place) * 500 - wipes * 120);
  if (win) {
    g.slowmo(1.0, .25); g.flash('#fff', .5); g.shake(16); g.hitstop(.08);
    for (let i = 0; i < 4; i++) g.fx.burst(rnd(90, W - 90), rnd(160, H - 420), 22, { color: ['#7ef7ff', '#ff2d78', '#ffd34d', '#4dffa1'], speed: rnd(240, 620), size: rnd(3, 9), g: 520, life: rnd(.5, 1.3) });
    g.fx.ring(W / 2, H * .45, { r: 220, color: '#ffffff', life: .55, wide: 9 });
    sfx('fanfare', { pitch: 1.02 }); sfx('win'); sfx('coinchain', { pitch: 1.3 });
    music('epic');
    say('LAP COMPLETE', 1.3);
    g.popup('LAP', W / 2, H * .3, '#ffd34d', 34);
  } else {
    sfx('lose'); g.flash('#ff3b3b', .34); g.shake(11); g.hitstop(.05);
    g.fx.burst(W / 2, H * .5, 20, { color: ['#ff3b5c', '#ffd34d', '#ffffff'], speed: 300, life: .7, size: 7 });
    say(wipes >= 3 ? 'CRASHED OUT' : 'LAP LOST', 1.2);
    g.popup('DNF', W / 2, H * .3, '#ff6b85', 34);
  }
  if (score > (g.best || 0)) {
    sfx('unlock', { pitch: 1.25, vol: .8 });
    g.flash('#ffd34d', .18); g.hitstop(.06); g.punch(.08);
    g.fx.burst(W / 2, H * .38, 20, { kind: 'star', color: ['#ffd34d', '#fff6c2'], speed: 300, life: .8, size: 7 });
    g.popup('NEW RECORD', W / 2, H * .38, '#ffd34d', 30);
  }
  g.end({ win, score, label: win ? '1ST PLACE' : (wipes >= 3 ? 'CRASHED OUT' : place + (place === 2 ? 'ND' : place === 3 ? 'RD' : 'TH') + ' PLACE') });
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (dt <= 0 || g.mode !== 'play') return;
  autoT += dt; timer += dt;
  boostPulse = Math.max(0, boostPulse - dt * 2.6);
  if (boostT > 0) boostT -= dt;
  if (flashT > 0) flashT -= dt;

  const curve = curveAt(camZ);
  let st = steerInput();
  if (isAuto) st = botSteer();

  // ---- lateral: steering fights the centrifugal drag of the curve
  pvx = damp(pvx, st * 1.75, 10, dt);
  const centri = curve * (0.24 + 0.26 * (speed / MAXS));
  px += (pvx - centri) * dt;

  // ---- speed
  const onGravel = Math.abs(px) > 0.92 && Math.abs(px) <= 1.16;
  const target = MAXS * (boostT > 0 ? 1.34 : 1) * (onGravel ? 0.62 : 1);
  speed = damp(speed, target, speed < 900 ? 1.1 : 2.4, dt);
  camZ += speed * dt;
  camX = cxAt(camZ) + px * ROAD;
  const S = clamp(speed / MAXS, 0, 1.35);

  /* ---- camera: the lens rides the throttle, and leans with the wheel ---- */
  g.cam.scale = 1 + clamp(S, 0, 1.2) * .028 + cam.zoom + cam.boost + (boostT > 0 ? .012 : 0) + Math.sin(g.t * 27) * .0007;
  g.cam.x = -px * 9;
  g.cam.y = -(g.cam.scale - 1) * 320;      // pin the zoom on the kart so the road stretches away

  /* ---- engine: a rev that climbs with the needle ---- */
  revT -= dt;
  if (revT <= 0) {
    revT = .34 - S * .14;
    sfx('charge', { pitch: .42 + S * .46 + (boostT > 0 ? .32 : 0), vol: boostT > 0 ? .26 : .17 });
  }

  /* ---- speed tiers: every step up kicks the lens ---- */
  const ntier = Math.floor(clamp(S, 0, 1) * 4);
  if (ntier > tier) {
    tier = ntier;
    sfx('drum', { vol: .5, pitch: 1 + tier * .06 });
    g.punch(.09); g.shake(5); g.flash('#9fe8ff', .12); g.hitstop(.035);
    g.fx.ring(W / 2, HORIZON + 130, { r: 210, color: '#9fe8ff', life: .42, wide: 5 });
    g.fx.burst(W / 2, H - 150, 14, { color: ['#9fe8ff', '#ffffff'], speed: 300, life: .45, size: 5, gravity: 0 });
    g.popup('SPEED UP', W / 2, H * .3, '#9fe8ff', 30);
    cam.boost = .022; g.tween(cam, 'boost', 0, .6);
  }

  /* ---- drift: hold the slide, the tyres charge, let go for a mini-boost ---- */
  const sliding = Math.abs(pvx) > 0.7 && speed > MAXS * 0.5;
  if (sliding) {
    if (driftT <= 0) driftStart();
    driftT = Math.min(1.4, driftT + dt);
    const ch = clamp(driftT / .95, 0, 1);
    const ti = ch >= .72 ? 2 : ch >= .38 ? 1 : 0;
    if (ti > driftTier) { driftTier = ti; driftTierUp(ti); }
    sparkT -= dt;
    if (sparkT <= 0) { sparkT = .04; driftSparks(ch, ti); }
    driftTick -= dt;
    if (driftTick <= 0) {
      driftTick = .19;
      sfx('tick', { pitch: comboPitch(ti) * (1 + ch * .5), vol: .3 });
      g.punch(.012);
    }
  } else if (driftT > 0) releaseDrift();

  /* ---- gravel chatter ---- */
  if (onGravel && speed > 800) {
    shakeT -= dt;
    if (shakeT <= 0) { shakeT = .07; sfx('step', { pitch: .6, vol: .45 }); g.punch(.02); }
    g.shake(4);
    g.fx.burst(W / 2 + px * 90, H - 96, 2, { color: ['#6d5aa8', '#9a86d6'], speed: rnd(60, 220), size: rnd(2, 6), g: 260, life: rnd(.2, .5) });
  }

  /* ---- rivals ---- */
  for (const r of rivals) {
    r.z += r.v * dt;
    r.bump = Math.max(0, r.bump - dt);
    r.lane = clamp(r.base + Math.sin(g.t * 0.75 + r.wob) * 0.26, -0.78, 0.78);
    if (!r.passed && camZ > r.z) {
      r.passed = true; passes++;
      g.combo.hit(W / 2, H * 0.55, `PASSED ${r.name}`);
      g.fx.burst(W / 2, H * 0.55, 14, { color: ['#fff', '#7ef7ff'], speed: rnd(180, 460), size: rnd(2, 6), g: 200, life: rnd(.3, .7) });
      g.fx.ring(W / 2, H * 0.55, { r: 92, color: '#ffffff', life: .32, wide: 4, ripple: false });
      sfx('ding', { pitch: comboPitch(Math.min(9, passes * 3)), vol: .7 });
      sfx('whoosh', { pitch: comboPitch(Math.min(9, passes * 3)) * .9, vol: .45 });
      g.shake(5); g.punch(.05); g.hitstop(.025);
      arcPop(`+${220}`, W / 2, H * 0.62, '#ffffff', 26);
    }
    // bump if you clip a rival
    const d = r.z - camZ;
    if (d > -30 && d < 230 && Math.abs(r.lane - px) < 0.3 && r.bump <= 0) {
      r.bump = .5;
      px += (px < r.lane ? -1 : 1) * 0.3;
      pvx *= .4; speed *= .82;
      driftT = 0; driftTier = 0; driftChain = 0;
      g.shake(12); g.hitstop(.05); g.punch(.07); g.flash('#ffd34d', .18);
      g.combo.miss();
      g.fx.burst(W / 2, H - 180, 16, { color: ['#ffd34d', '#fff', '#ff7a1a'], speed: rnd(200, 520), size: rnd(2, 6), g: 700, life: rnd(.2, .5) });
      g.fx.ring(W / 2, H - 170, { r: 70, color: '#ffd34d', life: .3, wide: 5, ripple: false });
      g.popup('CLIPPED', W / 2, H * .5, '#ffd34d', 28);
      sfx('thud', { pitch: 1.3 });
    }
  }

  /* ---- pads ---- */
  for (const pad of pads) {
    if (pad.taken) continue;
    const d = pad.z - camZ;
    if (d > -180 && d < 210 && Math.abs(px - pad.lane) < 0.48) takePad(pad);
  }

  /* ---- barrier: a warning first, then the wipeout ---- */
  if (Math.abs(px) > 0.98 && Math.abs(px) <= 1.16) {
    shakeT -= dt;
    if (shakeT <= 0) {
      shakeT = .45;
      g.shake(6); g.punch(.04); g.flash('#ff2d78', .1);
      g.popup('BARRIER!', W / 2, H * .55, '#ff6b85', 26);
      sfx('blip', { pitch: 1.4, vol: .5 });
      g.fx.burst(W / 2 + Math.sign(px) * 130, H - 140, 6, { color: ['#ff2d78', '#ffffff'], speed: 240, life: .35, size: 5 });
    }
    g.hitstop(dt * 0);   // (no stop while grinding — keeps the steering readable)
  }
  if (Math.abs(px) > 1.16) wipeOut();

  /* ---- checkpoints, halfway, final stretch ---- */
  while (cpIdx < CHECKPOINTS.length && camZ >= CHECKPOINTS[cpIdx]) checkpoint(cpIdx);
  if (!markHalf && camZ >= RACE_LEN * 0.5) {
    markHalf = 1;
    say('HALFWAY', .9);
    sfx('drum', { vol: .6, pitch: 1.1 }); sfx('ding', { pitch: 1.1, vol: .5 });
    g.flash('#ffd34d', .14); g.punch(.08); g.shake(5); g.hitstop(.04);
    g.fx.burst(W / 2, H * .46, 16, { color: ['#ffd34d', '#ffffff'], speed: 300, life: .55, size: 6 });
    g.popup('HALFWAY', W / 2, H * .38, '#ffd34d', 30);
  }
  if (!markFinal && camZ >= RACE_LEN - 7000) {
    markFinal = 1;
    say('FINAL STRETCH!', 1.1);
    sfx('drum', { vol: .7, pitch: .9 }); sfx('charge', { pitch: 1.15, vol: .5 });
    g.flash('#ff2d78', .16); g.punch(.1); g.shake(6); g.hitstop(.045);
    g.fx.ring(W / 2, HORIZON + 140, { r: 240, color: '#ff2d78', life: .5, wide: 7 });
    g.popup('FINAL STRETCH', W / 2, H * .34, '#ff2d78', 26);
    music('epic');
  }

  /* ---- finish ---- */
  if (camZ >= RACE_LEN) finish(true);
  else if (timer >= RACE_MAX_T) finish(true);

  /* ---- arcing score pops ---- */
  for (let i = arc.length - 1; i >= 0; i--) {
    const a = arc[i];
    a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 540 * dt;
    if (a.t > a.life) arc.splice(i, 1);
  }

  const place = 1 + rivals.filter(r => r.z > camZ).length;
  g.state = { place, dist: Math.round(camZ), wipes, passes, boost: +boostT.toFixed(2), chain: driftChain };
}

/* ------------------------------------------------------------------ sky: four parallax depths */
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: R(0, W), y: R(0, HORIZON - 20), r: R(.5, 1.7), a: R(.25, .9), p: R(0, 6) }));

function mtLayer(n, hMin, hMax, wMin, wMax) {
  const b = []; let x = 0;
  for (let i = 0; i < n; i++) { const w = rnd(wMin, wMax), h = rnd(hMin, hMax); b.push({ x, w, h }); x += w * rnd(.42, .62); }
  return { b, w: x };
}
function cityLayer(n, o) {
  const b = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd(o.wMin, o.wMax), h = rnd(o.hMin, o.hMax), A = [], B = [];
    for (let wy = o.top; wy < h - 8; wy += o.row)
      for (let wx = 6; wx < w - 8; wx += o.col) { if (!chance(o.dens)) continue; (chance(.5) ? A : B).push([wx, wy]); }
    b.push({ x, w, h, A, B });
    x += w + rnd(o.gapMin, o.gapMax);
  }
  return { b, w: x };
}

/* the parallax stack: far ridge → mid ridge → near skyline → city that sits on the barrier */
const parallax = [
  { kind: 'mt', par: .12, base: HORIZON + 8, col: '#2b1a63', rim: 'rgba(150,120,255,.30)', L: mtLayer(16, 40, 116, 60, 150) },
  { kind: 'mt', par: .26, base: HORIZON + 5, col: '#1d1140', rim: 'rgba(126,247,255,.22)', L: mtLayer(12, 66, 188, 90, 210) },
  {
    kind: 'city', par: .48, base: HORIZON + 3, col: '#170d33', winA: 'rgba(255,214,140,.80)', winB: 'rgba(126,247,255,.55)', roof: 'rgba(255,45,120,.45)',
    L: cityLayer(14, { wMin: 34, wMax: 66, hMin: 50, hMax: 132, top: 10, row: 24, col: 14, gapMin: 4, gapMax: 16, dens: .30 }),
  },
  {
    kind: 'city', par: .82, base: HORIZON + 2, col: '#0c0620', winA: 'rgba(255,120,200,.70)', winB: 'rgba(126,247,255,.45)', roof: 'rgba(126,247,255,.35)',
    L: cityLayer(10, { wMin: 54, wMax: 100, hMin: 80, hMax: 205, top: 12, row: 20, col: 12, gapMin: 8, gapMax: 26, dens: .34 }),
  },
];

let skyGrad = null, groundGrad = null, hzGlow = null;

function skySlide() { return -(cxAt(camZ) - cxAt(camZ + 700)) * 0.42; }

function drawLayer(c, L, cs) {
  const Lw = L.L.w;
  const off = wrap(cs * L.par * 1.4 + camZ * L.par * .028, Lw);
  for (let k = 0; k < 2; k++) {
    const ox = k * Lw - off;
    if (ox > W + 40 || ox + Lw < -40) continue;
    if (L.kind === 'mt') {
      c.fillStyle = L.col; c.beginPath();
      for (const m of L.L.b) {
        const x = ox + m.x;
        if (x > W + 240 || x + m.w < -240) continue;
        c.moveTo(x - m.w / 2, L.base); c.lineTo(x, L.base - m.h); c.lineTo(x + m.w / 2, L.base); c.closePath();
      }
      c.fill();
      c.strokeStyle = L.rim; c.lineWidth = 1.5; c.beginPath();
      for (const m of L.L.b) {
        const x = ox + m.x;
        if (x > W + 240 || x + m.w < -240) continue;
        c.moveTo(x - m.w / 2, L.base); c.lineTo(x, L.base - m.h);
      }
      c.stroke();
    } else {
      for (const b of L.L.b) {
        const x = ox + b.x;
        if (x > W || x + b.w < 0) continue;
        c.fillStyle = L.col; c.fillRect(x, L.base - b.h, b.w, b.h + 6);
        c.fillStyle = L.roof; c.fillRect(x, L.base - b.h, b.w, 2);
        if (b.A.length) { c.fillStyle = L.winA; c.beginPath(); for (const w of b.A) c.rect(x + w[0], L.base - b.h + w[1], 4, 6); c.fill(); }
        if (b.B.length) { c.fillStyle = L.winB; c.beginPath(); for (const w of b.B) c.rect(x + w[0], L.base - b.h + w[1], 4, 6); c.fill(); }
      }
    }
  }
}

function drawSky(c) {
  if (!skyGrad) {
    skyGrad = c.createLinearGradient(0, 0, 0, HORIZON + 10);
    skyGrad.addColorStop(0, '#0d0824'); skyGrad.addColorStop(.38, '#2a1150');
    skyGrad.addColorStop(.74, '#7b1a6e'); skyGrad.addColorStop(1, '#ff5b8a');
    groundGrad = c.createLinearGradient(0, HORIZON, 0, H);
    groundGrad.addColorStop(0, '#1a0f36'); groundGrad.addColorStop(.35, '#120a26'); groundGrad.addColorStop(1, '#0a0616');
    hzGlow = c.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 10);
    hzGlow.addColorStop(0, 'rgba(255,45,120,0)'); hzGlow.addColorStop(.65, 'rgba(255,80,180,.5)'); hzGlow.addColorStop(1, 'rgba(190,240,255,.92)');
  }
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, HORIZON + 6);
  const cs = skySlide();

  // 1. stars — the deepest layer, they only drift a hair
  for (const s of STARS) {
    const tw = .55 + .45 * Math.sin(g.t * 2 + s.p);
    c.fillStyle = 'rgba(255,255,255,' + (s.a * tw * .8).toFixed(3) + ')';
    c.beginPath(); c.arc(wrap(s.x + cs * .07, W + 40) - 20, s.y, s.r, 0, TAU); c.fill();
  }

  // 2. synthwave sun
  const sx = W / 2 + cs * .25, sy = HORIZON - 74, sr = 104;
  c.save();
  c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.clip();
  const sun = c.createLinearGradient(0, sy - sr, 0, sy + sr);
  sun.addColorStop(0, '#ffe14d'); sun.addColorStop(.5, '#ff8a3c'); sun.addColorStop(1, '#ff2d78');
  c.fillStyle = sun; c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  c.fillStyle = 'rgba(24,8,40,.85)';
  for (let i = 0; i < 9; i++) { const yy = sy + 6 + i * 13; c.fillRect(sx - sr, yy, sr * 2, 3 + i * 1.5); }
  c.restore();
  c.strokeStyle = 'rgba(255,214,120,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.stroke();

  // 3-6. the parallax stack
  for (const L of parallax) drawLayer(c, L, cs);

  // 7. horizon bloom
  c.fillStyle = hzGlow; c.fillRect(0, HORIZON - 30, W, 40);
}

/* ------------------------------------------------------------------ road */
const A = {
  y1: new Float32Array(DRAWD + 2), y2: new Float32Array(DRAWD + 2), l1: new Float32Array(DRAWD + 2), r1: new Float32Array(DRAWD + 2),
  l2: new Float32Array(DRAWD + 2), r2: new Float32Array(DRAWD + 2), s1: new Float32Array(DRAWD + 2), ok: new Uint8Array(DRAWD + 2),
};

function drawRoad(c) {
  c.fillStyle = groundGrad || '#0a0616'; c.fillRect(0, HORIZON, W, H - HORIZON);

  const base = Math.floor(camZ / SEG);
  for (let i = 0; i <= DRAWD; i++) {
    const k = base + i;
    let z1 = k * SEG - camZ, z2 = z1 + SEG;
    A.ok[i] = 0;
    if (z2 < 130) continue;
    if (z1 < 130) z1 = 130;
    const s1 = scAt(z1), s2 = scAt(z2);
    const y1 = camH(z1), y2 = camH(z2);
    if (y1 - y2 < .1) continue;
    const c1 = cxAt(z1) - camX, c2 = cxAt(z2) - camX;
    A.ok[i] = 1; A.y1[i] = y1; A.y2[i] = y2; A.s1[i] = s1;
    A.l1[i] = W / 2 + (c1 - ROAD) * s1; A.r1[i] = W / 2 + (c1 + ROAD) * s1;
    A.l2[i] = W / 2 + (c2 - ROAD) * s2; A.r2[i] = W / 2 + (c2 + ROAD) * s2;
  }

  // motion stripes on the ground (full width bands)
  c.beginPath();
  for (let i = DRAWD; i >= 0; i--) {
    if (!A.ok[i] || ((base + i) & 3)) continue;
    c.moveTo(0, A.y1[i]); c.lineTo(W, A.y1[i]); c.lineTo(W, A.y2[i]); c.lineTo(0, A.y2[i]); c.closePath();
  }
  c.fillStyle = 'rgba(126,247,255,.045)'; c.fill();

  // tarmac: two batched paths by shade
  for (const shade of [0, 1]) {
    c.beginPath();
    for (let i = DRAWD; i >= 0; i--) {
      if (!A.ok[i] || ((base + i) & 1) !== shade) continue;
      c.moveTo(A.l1[i], A.y1[i]); c.lineTo(A.r1[i], A.y1[i]); c.lineTo(A.r2[i], A.y2[i]); c.lineTo(A.l2[i], A.y2[i]); c.closePath();
    }
    c.fillStyle = shade ? '#232840' : '#1b1f33'; c.fill();
  }
  // rumble strips (pink / cyan neon, 2 segments per block)
  for (const shade of [0, 1]) {
    c.beginPath();
    for (let i = DRAWD; i >= 0; i--) {
      if (!A.ok[i] || (((base + i) >> 1) & 1) !== shade) continue;
      const o = 0.185, y1 = A.y1[i], y2 = A.y2[i], s1 = A.s1[i], s2 = scAt(Math.max(130, (base + i + 1) * SEG - camZ));
      const a1 = W / 2 + (cxAt(Math.max(130, (base + i) * SEG - camZ)) - camX + ROAD) * s1;
      const b1 = a1 + ROAD * o * s1, a2 = W / 2 + (cxAt(Math.max(130, (base + i + 1) * SEG - camZ)) - camX + ROAD) * s2, b2 = a2 + ROAD * o * s2;
      c.moveTo(a1, y1); c.lineTo(b1, y1); c.lineTo(b2, y2); c.lineTo(a2, y2); c.closePath();
      const d1 = W / 2 + (cxAt(Math.max(130, (base + i) * SEG - camZ)) - camX - ROAD) * s1;
      const e1 = d1 - ROAD * o * s1, d2 = W / 2 + (cxAt(Math.max(130, (base + i + 1) * SEG - camZ)) - camX - ROAD) * s2, e2 = d2 - ROAD * o * s2;
      c.moveTo(d1, y1); c.lineTo(e1, y1); c.lineTo(e2, y2); c.lineTo(d2, y2); c.closePath();
    }
    c.fillStyle = shade ? '#ff2d78' : '#7ef7ff'; c.fill();
  }
  // centre dashes
  c.beginPath();
  for (let i = DRAWD; i >= 0; i--) {
    if (!A.ok[i] || ((base + i) % 6) > 2) continue;
    const yy1 = A.y1[i], yy2 = A.y2[i], s1 = A.s1[i], s2 = scAt(Math.max(130, (base + i + 1) * SEG - camZ));
    const c1 = W / 2 + (cxAt(Math.max(130, (base + i) * SEG - camZ)) - camX) * s1;
    const c2 = W / 2 + (cxAt(Math.max(130, (base + i + 1) * SEG - camZ)) - camX) * s2;
    const w1 = ROAD * 0.026 * s1, w2 = ROAD * 0.026 * s2;
    c.moveTo(c1 - w1, yy1); c.lineTo(c1 + w1, yy1); c.lineTo(c2 + w2, yy2); c.lineTo(c2 - w2, yy2); c.closePath();
  }
  c.fillStyle = 'rgba(240,248,255,.5)'; c.fill();

  // neon posts — the speed cue that sells the whole thing
  for (const side of [-1, 1]) {
    c.beginPath();
    for (let i = DRAWD; i >= 0; i--) {
      if (!A.ok[i] || ((base + i) % 3)) continue;
      const z = Math.max(130, (base + i) * SEG - camZ), s = scAt(z);
      const xw = W / 2 + (cxAt(z) - camX + side * ROAD * 1.34) * s;
      const yb = camH(z), ht = 46 * s, w = Math.max(.9, 2.6 * s);
      c.moveTo(xw - w, yb); c.lineTo(xw + w, yb); c.lineTo(xw + w * .6, yb - ht); c.lineTo(xw - w * .6, yb - ht); c.closePath();
    }
    c.fillStyle = side < 0 ? 'rgba(126,247,255,.85)' : 'rgba(255,80,180,.85)'; c.fill();
  }
  // the neon edge: one stroked path per side, hugging the tarmac all the way to the horizon
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    c.beginPath();
    let started = false;
    for (let i = 0; i <= DRAWD; i++) {
      if (!A.ok[i]) continue;
      const x = side < 0 ? A.l1[i] : A.r1[i], y = A.y1[i];
      started ? c.lineTo(x, y) : (c.moveTo(x, y), started = true);
    }
    c.strokeStyle = side < 0 ? 'rgba(126,247,255,.34)' : 'rgba(255,80,180,.34)';
    c.lineWidth = 2.4; c.stroke();
  }
  c.restore();
}

/* roadside billboards — the objects that whip past your shoulder and sell the speed */
const BILL_STEP = SEG * 7;
function drawRoadside(c) {
  const b0 = Math.ceil((camZ + 170) / BILL_STEP), b1 = Math.floor((camZ + 7600) / BILL_STEP);
  for (let k = b0; k <= b1; k++) {
    const zw = k * BILL_STEP;
    const z = zw - camZ;
    if (z < 170) continue;
    const s = scAt(z), side = (k & 1) ? 1 : -1;
    const gy = camH(z);
    const hgt = 150 * s, w = 72 * s;
    if (hgt < 3) continue;
    const x = W / 2 + (cxAt(zw) - camX + side * ROAD * 1.9) * s;
    if (x < -160 || x > W + 160) continue;
    const col = side < 0 ? 'rgba(126,247,255,' : 'rgba(255,45,120,';
    c.fillStyle = '#1a1338';
    c.fillRect(x - Math.max(.7, 3 * s), gy - hgt, Math.max(1.4, 6 * s), hgt);
    c.fillStyle = col + '.13)'; c.fillRect(x - w / 2, gy - hgt - w * .55, w, w * .55);
    c.strokeStyle = col + '.85)'; c.lineWidth = Math.max(1, 2.4 * s);
    c.strokeRect(x - w / 2, gy - hgt - w * .55, w, w * .55);
    c.fillStyle = col + '.72)';
    for (let i = 0; i < 3; i++) c.fillRect(x - w * .3, gy - hgt - w * .45 + i * w * .15, w * (.6 - i * .16), Math.max(1, w * .055));
  }
}

/* ------------------------------------------------------------------ track objects */
function drawPads(c) {
  for (const pad of pads) {
    if (pad.taken) continue;
    const z = pad.z - camZ;
    if (z < 140 || z > 9000) continue;
    const s = scAt(z), s2 = scAt(z + 260);
    const gy = camH(z), gy2 = camH(z + 260);
    const x1 = W / 2 + (cxAt(pad.z) - camX + pad.lane * ROAD) * s;
    const x2 = W / 2 + (cxAt(pad.z + 260) - camX + pad.lane * ROAD) * s2;
    const w1 = ROAD * 0.34 * s, w2 = ROAD * 0.34 * s2;
    const pulse = .55 + .45 * Math.sin(g.t * 9);
    c.fillStyle = 'rgba(77,255,161,' + (.28 + .3 * pulse).toFixed(2) + ')';
    c.beginPath(); c.moveTo(x1 - w1, gy); c.lineTo(x1 + w1, gy); c.lineTo(x2 + w2, gy2); c.lineTo(x2 - w2, gy2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(220,255,235,' + (.5 + .4 * pulse).toFixed(2) + ')';
    for (let i = 0; i < 2; i++) {
      const f0 = i * .42 + .05, f1 = f0 + .24;
      const yy0 = lerp(gy, gy2, f0), yy1 = lerp(gy, gy2, f1);
      const xx0 = lerp(x1, x2, f0), xx1 = lerp(x1, x2, f1);
      const ww0 = lerp(w1, w2, f0) * .62, ww1 = lerp(w1, w2, f1) * .62;
      c.beginPath(); c.moveTo(xx0 - ww0, yy0); c.lineTo(xx0 + ww0, yy0); c.lineTo(xx1, yy1); c.closePath(); c.fill();
    }
  }
}

function drawRivals(c) {
  const list = rivals.slice().sort((a, b) => b.z - a.z);
  for (const r of list) {
    const z = r.z - camZ;
    if (z < 150 || z > 11000) continue;
    const s = scAt(z), gy = camH(z);
    const x = W / 2 + (cxAt(r.z) - camX + r.lane * ROAD) * s;
    const k = clamp(50 * s / 100, .05, 1.6);
    kartArt(c, x, gy, k, r.body, r.ch, r.kind, g.t + r.wob, 0, false);
  }
}

/* ------------------------------------------------------------------ kart art */
function kartArt(c, x, y, k, body, chCol, kind, t, lean, boosting) {
  c.save(); c.translate(x, y); c.scale(k, k); c.rotate(lean);
  const bob = boosting ? Math.sin(t * 46) * 1.6 : Math.sin(t * 20) * 1.1;
  c.translate(0, bob);
  // shadow
  c.fillStyle = 'rgba(0,0,0,.42)'; c.beginPath(); c.ellipse(0, 1, 46, 9, 0, 0, TAU); c.fill();
  // rear wheels
  for (const wx of [-37, 37]) {
    c.fillStyle = '#0e0b16'; rr(c, wx - 12, -30, 24, 30, 8); c.fill();
    c.strokeStyle = 'rgba(126,247,255,.55)'; c.lineWidth = 2; rr(c, wx - 12, -30, 24, 30, 8); c.stroke();
  }
  // body
  c.fillStyle = body; rr(c, -33, -46, 66, 34, 9); c.fill();
  c.fillStyle = 'rgba(255,255,255,.32)'; rr(c, -28, -44, 56, 7, 4); c.fill();
  c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, -33, -20, 66, 8, 4); c.fill();
  // cockpit
  c.fillStyle = '#100c1c'; rr(c, -14, -60, 28, 18, 6); c.fill();
  // driver
  drawChar(kind, c, 0, -44, 34, { dir: 1, color: chCol, t: t });
  // wing
  c.fillStyle = '#1a1528'; rr(c, -41, -70, 82, 8, 3); c.fill();
  c.fillStyle = body; rr(c, -41, -70, 82, 3, 2); c.fill();
  for (const px2 of [-30, 30]) { c.fillStyle = '#1a1528'; c.fillRect(px2 - 3, -64, 6, 8); }
  // exhaust / flames
  if (boosting) {
    const fl = 16 + Math.sin(t * 40) * 8 + (boostPulse || 0) * 22;
    c.fillStyle = 'rgba(255,214,60,.95)';
    c.beginPath(); c.moveTo(-11, -14); c.lineTo(0, fl); c.lineTo(11, -14); c.closePath(); c.fill();
    c.fillStyle = 'rgba(126,247,255,.9)';
    c.beginPath(); c.moveTo(-6, -13); c.lineTo(0, fl * .35); c.lineTo(6, -13); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.moveTo(-3, -12); c.lineTo(0, fl * .18); c.lineTo(3, -12); c.closePath(); c.fill();
  } else {
    c.fillStyle = 'rgba(255,140,60,.5)'; c.beginPath(); c.ellipse(0, -12, 9, 4, 0, 0, TAU); c.fill();
  }
  // underglow
  c.fillStyle = hexA(body, .3); c.beginPath(); c.ellipse(0, -4, 40, 9, 0, 0, TAU); c.fill();
  c.restore();
}

/* ------------------------------------------------------------------ fx layers */
const LINES = Array.from({ length: 24 }, () => ({ a: rnd(.16, Math.PI - .16), sp: rnd(.55, 1.5), p: R(0, 1) }));

function drawSpeed(c) {
  const S = clamp(speed / MAXS, 0, 1.35);
  const amt = clamp((S - .45) / .55, 0, 1) * .55 + (boostT > 0 ? .8 : 0) + cam.zoom * 5;
  if (amt <= .02) return;
  const vx = W / 2, vy = HORIZON + 26;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = boostT > 0 ? 'rgba(200,255,240,.5)' : 'rgba(170,215,255,.24)';
  for (const l of LINES) {
    const ph = wrap(g.t * l.sp * (1.2 + amt * 2.2) + l.p, 1);
    const r0 = 24 + ph * ph * 620;
    const len = (46 + amt * 260) * (.28 + ph);
    const x0 = vx + Math.cos(l.a) * r0 * 1.12, y0 = vy + Math.sin(l.a) * r0 * .78;
    c.lineWidth = 1 + ph * 2.2;
    c.beginPath(); c.moveTo(x0, y0);
    c.lineTo(x0 + Math.cos(l.a) * len * 1.12, y0 + Math.sin(l.a) * len * .78);
    c.stroke();
  }
  c.restore();
}

function drawPlayer(c) {
  const lean = clamp(pvx * .11, -.16, .16);
  const x = kartX();
  // brake/exhaust trail
  kartArt(c, x, kartY(), 1.16, '#ff7a1a', '#ffd7a8', 'cat', g.t, lean, boostT > 0);
  // drift charge ring: fills up and changes colour with the tier
  if (driftT > 0) {
    const ch = clamp(driftT / .95, 0, 1), d = DRIFT[driftTier];
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = d.col; c.lineWidth = 4 + ch * 3; c.lineCap = 'round';
    c.beginPath(); c.arc(x, kartY() - 44, 56, -Math.PI * .88, -Math.PI * .88 + ch * Math.PI * 1.76); c.stroke();
    c.globalAlpha = .35 + .3 * Math.sin(g.t * 20);
    c.beginPath(); c.arc(x, kartY() - 44, 63, 0, TAU); c.lineWidth = 2; c.stroke();
    c.restore();
  }
  // tyres glow when the drift is hot
  if (driftT > 0) {
    const d = DRIFT[driftTier], s = driftDir;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .7;
    const gd = c.createRadialGradient(x + s * 44, kartY() + 8, 1, x + s * 44, kartY() + 8, 46);
    gd.addColorStop(0, d.col); gd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gd; c.fillRect(x + s * 44 - 46, kartY() - 38, 92, 92);
    c.restore();
  }
}

function drawArc(c) {
  for (const a of arc) {
    const u = a.t / a.life;
    c.globalAlpha = clamp(1 - u * 1.2, 0, 1);
    const sc = 1 + (1 - Math.min(1, u * 3)) * .34;
    g.text(a.txt, a.x, a.y, { size: Math.round(a.size * sc), color: a.col, align: 'center', ink: '#0a0518' });
  }
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ hud */
function drawHUD(c) {
  const place = 1 + rivals.filter(r => r.z > camZ).length;
  const ord = place === 1 ? '1ST' : place === 2 ? '2ND' : place === 3 ? '3RD' : '4TH';
  c.save();
  // place
  c.font = '900 54px system-ui,-apple-system,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillStyle = place === 1 ? '#ffd34d' : '#e6ecff';
  c.shadowColor = place === 1 ? '#ff9a1f' : '#7ef7ff'; c.shadowBlur = 18;
  c.fillText(ord, 28, 22);
  c.shadowBlur = 0;
  c.font = '800 15px system-ui,sans-serif'; c.fillStyle = 'rgba(230,236,255,.62)';
  c.fillText('OF 4', 30 + c.measureText(ord).width + 8, 44);

  // shields
  for (let i = 0; i < 3; i++) {
    const x = 36 + i * 26, y = 98;
    c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.closePath();
    c.fillStyle = i < 3 - wipes ? '#ff2d78' : 'rgba(255,255,255,.14)'; c.fill();
  }
  c.font = '800 11px system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(230,236,255,.5)';
  c.fillText('SHIELDS', 122, 98);

  // progress track
  const bx = 34, by = 150, bw = W - 68, bh = 12;
  c.fillStyle = 'rgba(255,255,255,.13)'; rr(c, bx, by, bw, bh, 6); c.fill();
  const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
  pg.addColorStop(0, '#7ef7ff'); pg.addColorStop(1, '#ff2d78');
  c.fillStyle = pg; rr(c, bx, by, Math.max(4, bw * clamp(camZ / RACE_LEN, 0, 1)), bh, 6); c.fill();
  // checkpoints on the bar
  for (const cz of CHECKPOINTS) {
    const t = clamp(cz / RACE_LEN, 0, 1);
    c.fillStyle = camZ >= cz ? 'rgba(126,247,255,.95)' : 'rgba(255,255,255,.28)';
    c.fillRect(bx + bw * t - 1.5, by - 5, 3, bh + 10);
  }
  // finish flag
  c.fillStyle = 'rgba(240,248,255,.9)'; c.fillRect(bx + bw - 2, by - 6, 4, bh + 12);
  c.beginPath(); c.moveTo(bx + bw - 2, by - 6); c.lineTo(bx + bw + 14, by - 6); c.lineTo(bx + bw + 14, by + 2); c.lineTo(bx + bw - 2, by + 2); c.closePath(); c.fill();
  // rivals
  for (const r of rivals) {
    const t = clamp(r.z / RACE_LEN, 0, 1);
    c.fillStyle = r.passed ? 'rgba(255,255,255,.28)' : r.body;
    c.beginPath(); c.arc(bx + bw * t, by + bh / 2, 5.5, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5; c.stroke();
  }
  // you
  const mine = bx + bw * clamp(camZ / RACE_LEN, 0, 1);
  c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(mine, by - 9); c.lineTo(mine + 8, by - 19); c.lineTo(mine - 8, by - 19); c.closePath(); c.fill();
  c.font = '800 12px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = 'rgba(230,236,255,.6)';
  c.fillText('FINISH', bx + bw - 6, by + bh + 4);

  // timer bar (track closing)
  const tw = W - 68, tp = clamp(1 - timer / RACE_MAX_T, 0, 1);
  c.fillStyle = 'rgba(255,255,255,.1)'; rr(c, 34, 186, tw, 5, 3); c.fill();
  c.fillStyle = tp < .3 ? '#ff2d78' : '#7ef7ff'; rr(c, 34, 186, tw * tp, 5, 3); c.fill();

  // drift chain chip
  c.textAlign = 'left'; c.textBaseline = 'middle';
  if (driftChain > 0) {
    const pop = clamp(driftT, 0, 1);
    c.font = '900 20px system-ui,sans-serif';
    c.fillStyle = 'rgba(8,10,22,.55)'; rr(c, 30, 204, 148, 30, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; rr(c, 30, 204, 148, 30, 10); c.stroke();
    c.fillStyle = driftT > 0 ? DRIFT[driftTier].col : '#7ef7ff';
    c.fillText(`CHAIN ×${driftChain}`, 42, 220);
    c.fillStyle = 'rgba(255,255,255,' + (.25 + pop * .6).toFixed(2) + ')';
    c.fillRect(42, 228, 122 * pop, 3);
  }
  // boost gauge
  if (boostT > 0) {
    const k = clamp(boostT / 1.4, 0, 1);
    c.font = '900 18px system-ui,sans-serif'; c.fillStyle = 'rgba(180,255,225,.95)';
    c.fillText('BOOST', 190, 212);
    c.fillStyle = 'rgba(77,255,161,.22)'; c.fillRect(190, 224, 120, 7);
    c.fillStyle = '#4dffa1'; c.fillRect(190, 224, 120 * k, 7);
  }

  // speed readout
  const kph = Math.round(speed / 14);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = '900 34px system-ui,sans-serif';
  c.fillStyle = boostT > 0 ? '#b6ffe0' : 'rgba(230,236,255,.9)';
  c.shadowColor = boostT > 0 ? '#4dffa1' : 'rgba(126,247,255,.8)'; c.shadowBlur = 14;
  c.fillText(String(kph), 30, H - 34);
  c.shadowBlur = 0;
  c.font = '800 13px system-ui,sans-serif'; c.fillStyle = 'rgba(230,236,255,.5)';
  c.fillText('KM/H', 30 + c.measureText(String(kph)).width * 1.9 + 26, H - 34);

  // steer prompts (touch)
  if (g.t < 3.4 && g.mode === 'play') {
    const a = clamp((3.4 - g.t) * .8, 0, 1);
    for (const side of [-1, 1]) {
      const cx2 = W / 2 + side * 150, cy2 = H - 58;
      c.globalAlpha = a * .5;
      c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, cx2 - 46, cy2 - 26, 92, 52, 18); c.fill();
      c.strokeStyle = 'rgba(200,230,255,.5)'; c.lineWidth = 2; rr(c, cx2 - 46, cy2 - 26, 92, 52, 18); c.stroke();
      c.fillStyle = 'rgba(240,250,255,.9)';
      c.beginPath(); c.moveTo(cx2 + side * 14, cy2 - 13); c.lineTo(cx2 - side * 12, cy2); c.lineTo(cx2 + side * 14, cy2 + 13); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
  }
  c.restore();
}

/* ------------------------------------------------------------------ draw */
function draw(c) {
  drawSky(c);
  drawRoad(c);
  drawRoadside(c);
  drawPads(c);
  drawRivals(c);
  drawSpeed(c);
  drawPlayer(c);
  // drift / boost colour wash
  if (boostT > 0) {
    const vg = c.createRadialGradient(W / 2, H * .6, 120, W / 2, H * .6, W * .85);
    vg.addColorStop(0, 'rgba(77,255,161,0)'); vg.addColorStop(1, 'rgba(77,255,161,.16)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  } else if (driftT > 0) {
    const d = DRIFT[driftTier];
    const vg = c.createRadialGradient(W / 2, H * .62, 140, W / 2, H * .62, W * .82);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, hexA(d.col, .13));
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  drawArc(c);
}

/* ------------------------------------------------------------------ hooks */
g.onReset = resetWorld;
resetWorld();
music('chase');
g.start(update, draw, drawHUD);

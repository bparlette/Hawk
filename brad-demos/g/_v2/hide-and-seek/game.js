// HIDE & SEEK — hide-and-seek (Cat Arcade v2)
// You are the hider in a cluttered room. Drag to sneak between cover while a seeker
// sweeps a flashlight cone across the floor. Sight-line matters. Survive 30 seconds.
import { makeGame, sfx, music, comboPitch, clamp, lerp, lerpAngle, rnd, chance, damp, ease, R, TAU, rr, hexA } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const SURVIVE = 30;                 // seconds of hunting to win
const CONE_LEN = 540, CONE_HALF = .46;
const CAT_SPD = 200, CAT_R = 19;
const EYE = 96;                     // flashlight height above the seeker's feet

const g = makeGame({
  id: 'hide-and-seek', title: 'HIDE & SEEK', sub: 'DRAG TO SNEAK · STAY OUT OF THE LIGHT',
  hook: 'he is one sweep away', w: W, h: H, bg: '#07040f', style: 'toon',
  bloom: .95, ca: .4, vig: 1.1, scan: .2,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');

/* ================================================================ room */
const ROOM = { x0: 20, y0: 238, x1: 520, y1: 940 };
const FURN = [
  { x: 40, y: 350, w: 110, h: 54, kind: 'cabinet' },
  { x: 390, y: 350, w: 110, h: 54, kind: 'crates' },
  { x: 150, y: 520, w: 120, h: 60, kind: 'table' },
  { x: 370, y: 512, w: 130, h: 66, kind: 'shelf' },
  { x: 140, y: 648, w: 240, h: 74, kind: 'couch' },
  { x: 26, y: 760, w: 104, h: 62, kind: 'bed' },
  { x: 416, y: 766, w: 88, h: 58, kind: 'plant' },
];
const POCKETS = [{ x: 270, y: 878 }, { x: 196, y: 858 }, { x: 334, y: 872 }, { x: 96, y: 640 }];
const GAPS = [{ x: 96, y: 600 }, { x: 268, y: 610 }];

/* the seeker's patrol — one full loop lasts about a round */
const ROUTE = [
  { x: 110, y: 296, wait: 1.4 },
  { x: 268, y: 296, wait: .5 },
  { x: 268, y: 556, wait: 1.1 },
  { x: 268, y: 296, wait: .5 },
  { x: 430, y: 296, wait: 1.4 },
  { x: 268, y: 296, wait: .5 },
  { x: 268, y: 556, wait: 1.0 },
  { x: 110, y: 296, wait: .3 },
];

/* ================================================================ state */
let cat, seeker, phase, phaseT, clock, spot, hbT, hbPulse, stepT, musicOn, autoT, hinted, botT, botGoal, shakeT;
/* ---- feel state: plain scalars only, nothing allocated per frame ---- */
let dustT, seekDustT, seekStep, safeTick, seenK, dangerK, beat, torchT, sparkT, toldT, mugT, lanternT;
const isAutoBot = () => isAuto && !g.dumb();

function resetRound() {
  cat = { x: 268, y: 496, vx: 0, vy: 0, sq: 1, anim: 0, moving: 0, t: 0 };
  seeker = { x: 110, y: 296, ang: Math.PI / 2, sweep: 0, leg: 0, legT: 0, waitT: .6, hear: 0, hearAng: 0, chase: 0, spd: 74, walk: 0 };
  phase = 'intro'; phaseT = 0; clock = 0; spot = 0;
  hbT = 1; hbPulse = 0; stepT = 0; musicOn = false; autoT = 0; hinted = 0; botT = 0; botGoal = 0; shakeT = 0;
  dustT = 0; seekDustT = 0; seekStep = 0; safeTick = 4; seenK = 0; dangerK = 0; beat = 0;
  torchT = 0; sparkT = 0; toldT = 0; mugT = 0; lanternT = 0;
  g.combo.win = 4.6;                 // the stealth streak window: one safe tick per 4s
  g.combo.reset();
  g.cam.scale = 1.05;                // ease out of a slow push-in during the intro
  g.tween(g.cam, 'scale', 1, 1.1, ease.outCubic);
  g.fx.clear();
}
function resetMatch() {
  g.score = 0;
  resetRound();
  g.state = { phase: 'intro', clock: 0, spot: 0, cx: 268, cy: 496, sx: 110 };
}
g.onReset = resetMatch;
g.onStart = () => music('tense');

/* ================================================================ static art */
function layer(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }

const WALL = layer(W, 240, (c, w, h) => {
  const wg = c.createLinearGradient(0, 0, 0, h);
  wg.addColorStop(0, '#0c0718'); wg.addColorStop(.7, '#171029'); wg.addColorStop(1, '#0e0a1c');
  c.fillStyle = wg; c.fillRect(0, 0, w, h);
  /* wallpaper stripes */
  for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(255,120,200,.02)'; c.fillRect(i * 34, 0, 17, h); }
  /* window with moonlight */
  c.fillStyle = '#1b1230'; c.fillRect(330, 34, 128, 128);
  const mg = c.createLinearGradient(330, 34, 458, 162);
  mg.addColorStop(0, '#9fd0ff'); mg.addColorStop(1, '#3f6fd8');
  c.fillStyle = mg; c.fillRect(340, 44, 108, 108);
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.beginPath(); c.arc(410, 76, 16, 0, TAU); c.fill();
  c.strokeStyle = '#120c22'; c.lineWidth = 7;
  c.beginPath(); c.moveTo(394, 44); c.lineTo(394, 152); c.moveTo(340, 98); c.lineTo(448, 98); c.stroke();
  c.strokeStyle = '#0b0716'; c.lineWidth = 5; c.strokeRect(330, 34, 128, 128);
  c.fillStyle = 'rgba(150,200,255,.10)'; c.fillRect(300, 120, 220, 120);
  /* picture frame */
  c.fillStyle = '#2a1a38'; c.fillRect(70, 44, 96, 76);
  c.fillStyle = '#3a2548'; c.fillRect(80, 54, 76, 56);
  c.fillStyle = '#0f0a1c'; c.beginPath(); c.arc(118, 88, 14, 0, TAU); c.fill();
  c.fillStyle = '#0b0716'; c.lineWidth = 4; c.strokeStyle = '#0b0716'; c.strokeRect(70, 44, 96, 76);
  /* baseboard */
  c.fillStyle = '#0a0614'; c.fillRect(0, h - 18, w, 18);
  c.fillStyle = 'rgba(150,120,255,.12)'; c.fillRect(0, h - 20, w, 3);
});

const FLOOR = layer(W, 720, (c, w, h) => {
  const fg = c.createLinearGradient(0, 0, 0, h);
  fg.addColorStop(0, '#1a1130'); fg.addColorStop(.45, '#130d24'); fg.addColorStop(1, '#0a0616');
  c.fillStyle = fg; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 13; i++) {
    const y = i * 56;
    c.strokeStyle = 'rgba(120,90,180,.10)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(k * 118 + (i % 2) * 58, y); c.lineTo(k * 118 + (i % 2) * 58, y + 56); c.stroke(); }
  }
  /* rug */
  c.save();
  c.translate(w / 2, 470);
  c.fillStyle = 'rgba(120,40,80,.30)'; rr(c, -150, -105, 300, 210, 26); c.fill();
  c.strokeStyle = 'rgba(255,140,180,.20)'; c.lineWidth = 4; rr(c, -138, -93, 276, 186, 20); c.stroke();
  c.restore();
  const vg = c.createRadialGradient(w / 2, 300, 60, w / 2, 420, 520);
  vg.addColorStop(0, 'rgba(80,40,140,.14)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
});

const SKYG = ctx.createRadialGradient(W / 2, 520, 120, W / 2, 560, 700);
SKYG.addColorStop(0, 'rgba(0,0,0,0)'); SKYG.addColorStop(1, 'rgba(2,0,8,.92)');
const REDG = ctx.createRadialGradient(W / 2, 520, 90, W / 2, 560, 660);
REDG.addColorStop(0, 'rgba(255,30,60,0)'); REDG.addColorStop(1, 'rgba(255,20,50,.85)');
/* the warm pool the torch throws on the floor — flickers, so the room breathes */
const POOLG = ctx.createRadialGradient(W / 2, 600, 20, W / 2, 600, 380);
POOLG.addColorStop(0, 'rgba(255,226,150,.16)'); POOLG.addColorStop(.55, 'rgba(255,200,120,.05)'); POOLG.addColorStop(1, 'rgba(0,0,0,0)');

/* ================================================================ geometry */
function rayBox(ox, oy, dx, dy, x0, y0, x1, y1) {
  let tmin = 0, tmax = 1e9, t1, t2, s;
  if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) return -1; }
  else {
    t1 = (x0 - ox) / dx; t2 = (x1 - ox) / dx;
    if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-6) { if (oy < y0 || oy > y1) return -1; }
  else {
    t1 = (y0 - oy) / dy; t2 = (y1 - oy) / dy;
    if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

function rayCast(ox, oy, ang, maxD) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = maxD;
  for (let i = 0; i < FURN.length; i++) {
    const f = FURN[i];
    const t = rayBox(ox, oy, dx, dy, f.x, f.y, f.x + f.w, f.y + f.h);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}

function losClear(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  return rayCast(ax, ay, Math.atan2(dy, dx), d) >= d - 1;
}

function blocks(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d < 1) return null;
  const ux = dx / d, uy = dy / d;
  for (let i = 0; i < FURN.length; i++) {
    const f = FURN[i];
    const t = rayBox(ax, ay, ux, uy, f.x, f.y, f.x + f.w, f.y + f.h);
    if (t >= 0 && t < d) return f;
  }
  return null;
}

/* how strongly the seeker's light lands on a point (0 = unseen) */
function lightOn(px, py) {
  const ex = seeker.x, ey = seeker.y - EYE;
  const dx = px - ex, dy = py - ey;
  const d = Math.hypot(dx, dy);
  if (d > CONE_LEN) return 0;
  let da = Math.atan2(dy, dx) - seeker.ang;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  if (Math.abs(da) > CONE_HALF) return 0;
  if (!losClear(ex, ey, px, py)) return 0;
  const fall = clamp(1 - (d - 110) / (CONE_LEN * 1.05), .16, 1);
  const centre = 1 - Math.abs(da) / CONE_HALF * .45;
  return fall * centre;
}

/* ================================================================ movement */
function pushOut() {
  for (let i = 0; i < FURN.length; i++) {
    const f = FURN[i];
    const cx = clamp(cat.x, f.x, f.x + f.w), cy = clamp(cat.y, f.y, f.y + f.h);
    let dx = cat.x - cx, dy = cat.y - cy;
    let d = Math.hypot(dx, dy);
    if (d < CAT_R) {
      if (d < .0001) {
        /* centre inside the box — eject on the closest edge */
        const l = cat.x - f.x, r = f.x + f.w - cat.x, t = cat.y - f.y, b = f.y + f.h - cat.y;
        const m = Math.min(l, r, t, b);
        if (m === l) cat.x = f.x - CAT_R; else if (m === r) cat.x = f.x + f.w + CAT_R;
        else if (m === t) cat.y = f.y - CAT_R; else cat.y = f.y + f.h + CAT_R;
      } else {
        cat.x += dx / d * (CAT_R - d); cat.y += dy / d * (CAT_R - d);
      }
    }
  }
  cat.x = clamp(cat.x, ROOM.x0 + CAT_R, ROOM.x1 - CAT_R);
  cat.y = clamp(cat.y, ROOM.y0 + CAT_R, ROOM.y1 - CAT_R);
}

/* ================================================================ juice recipes */
/** a dust kick under the paws: the material is a soft floor, not sparks */
function pawDust(x, y, n, warm) {
  g.fx.dust(x, y + 2, n, { color: warm ? 'rgba(255,224,170,.28)' : 'rgba(190,175,255,.26)', size: 10, speed: 70, up: 30, spread: 14 });
}
/** the light finds you: hard snap, red sparks, a camera jolt */
function litSnap() {
  sfx('snap', { pitch: 1.12, vol: .6 });
  g.impact(cat.x, cat.y - 44, { punch: .085, shake: 9, stop: .05, rip: 1.2, flash: '#ff2b4e', flashA: .17 });
  g.fx.burst(cat.x, cat.y - 44, 12, { kind: 'spark', color: ['#ff5c78', '#fff', '#ffd34d'], speed: 300, life: .5, size: 5, ang: -Math.PI / 2, spread: 2.4, drag: 1.6 });
  g.fx.emit('ring', cat.x, cat.y - 30, { size: 74, life: .34, color: '#ff5c78', add: true, wide: 6 });
  g.popup('!', cat.x, cat.y - 118, '#ff5c78', 48);
  if (g.post) g.post.ripple(cat.x / W, cat.y / H, 1.1);
  g.combo.miss();
}
/** one safe stretch banked: pitch rises with the streak, sparkles escalate */
function safeStreak() {
  const n = g.combo.n + 1;
  g.combo.hit(cat.x, cat.y - 104, '+SAFE');
  sfx('ding', { pitch: comboPitch(n % 12) * 1.1, vol: .3 });
  const cnt = Math.min(18, 5 + n * 2);
  g.fx.burst(cat.x, cat.y - 50, cnt, { kind: 'star', color: ['#7df9ff', '#d8ffff', '#ffd34d'], speed: 130 + n * 16, life: .7, size: 7, g: 220 });
  g.fx.emit('ring', cat.x, cat.y - 20, { size: 90, life: .4, color: '#7df9ff', add: true, wide: 5 });
  g.punch(.04); g.shake(3);
  g.tween(g.cam, 'scale', 1 + Math.min(.05, n * .006), .5, ease.outCubic);
  if (n === 3 || n === 6) { g.showBanner(`${n} SAFE`, .8); g.flash('#7df9ff', .12); g.hitstop(.035); sfx('powerup', { pitch: comboPitch(n), vol: .5 }); }
}

/* ================================================================ bot */
function botMove(dt) {
  const me = cat;
  const safe = lightOn(me.x, me.y) < .04;
  if (!safe) {
    /* exposed: run for the closest pocket that is currently dark */
    let best = null, bd = 1e9;
    for (const p of POCKETS) {
      if (lightOn(p.x, p.y) > .05) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) botGoal = POCKETS.indexOf(best);
  } else {
    botT -= dt;
    if (botT <= 0) { botT = 7.5; botGoal = (botGoal + 1) % 3; }
  }
  const goal = POCKETS[botGoal];
  /* route through the corridor when the couch is in the way */
  let tx = goal.x, ty = goal.y;
  if (me.y < 640 && goal.y > 730) { const gap = GAPS[0]; tx = gap.x; ty = gap.y; }
  else if (me.y < 640 && goal.y > 730) { tx = GAPS[0].x; ty = GAPS[0].y; }
  if (Math.hypot(tx - me.x, ty - me.y) < 26 && (tx !== goal.x || ty !== goal.y)) { tx = goal.x; ty = goal.y; }
  const dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
  if (d < 12) return { mx: 0, my: 0 };
  const sp = d < 90 ? .55 : 1;
  return { mx: dx / d * sp, my: dy / d * sp };
}

/* ================================================================ update */
function update(dt) {
  if (g.mode !== 'play') return;
  if (!musicOn) { musicOn = true; music('tense'); }
  if (phase === 'over') return;
  phaseT += dt;
  if (isAuto) autoT += dt;

  /* ---- the seeker ---- */
  const s = seeker;
  const hunting = phase === 'hunt';
  if (hunting) {
    const leg = ROUTE[s.leg];
    const dx = leg.x - s.x, dy = leg.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const sp = s.spd + (s.chase > .3 ? 74 : 0);
      s.x += dx / dist * sp * dt; s.y += dy / dist * sp * dt;
      s.walk += dt * (sp / 40);
    } else {
      s.waitT += dt;
      if (s.waitT > leg.wait) {
        s.waitT = 0; s.leg = (s.leg + 1) % ROUTE.length;
        sfx('whoosh', { vol: .16, pitch: .9 });      // he turns: you hear the coat swing
        g.fx.dust(s.x, s.y, 4, { color: 'rgba(160,150,210,.22)', size: 12, speed: 70, up: 26 });
      }
    }
    /* footfalls you can hear — pitch and volume follow his distance to you */
    const dS = Math.hypot(cat.x - s.x, cat.y - s.y);
    const stepNow = Math.floor(s.walk);
    if (stepNow !== seekStep) {
      seekStep = stepNow;
      const near = clamp(1 - dS / 520, 0, 1);
      sfx('step', { vol: .12 + near * .34, pitch: .62 + near * .3 });
      if (near > .12) g.fx.dust(s.x + rnd(-8, 8), s.y + 2, 2, { color: `rgba(210,200,255,${.1 + near * .2})`, size: 9, speed: 46, up: 20 });
    }
  }
  /* facing: sweep down into the room, snap toward noise / the last sighting */
  s.sweep += dt * (hunting ? 1.15 : .4);
  let want = Math.PI / 2 + Math.sin(s.sweep) * .82;
  if (s.hear > 0) { s.hear -= dt; want = s.hearAng; }
  if (s.chase > 0) { s.chase -= dt; want = Math.atan2(cat.y - (s.y - EYE), cat.x - s.x); }
  s.ang = lerpAngle(s.ang, want, Math.min(1, dt * (s.chase > 0 ? 7 : s.hear > 0 ? 5 : 2.1)));

  /* ---- sight ---- */
  const seen = hunting ? lightOn(cat.x, cat.y) : 0;
  if (seen > 0) {
    if (seenK < .12) litSnap();                            // only on the frame the light lands
    seenK = 1;
    spot = clamp(spot + seen * (cat.moving > .3 ? 1.15 : .55) * dt * (1 + (SURVIVE - clock < 8 ? .3 : 0)), 0, 1.2);
    if (spot > .34 && hinted === 0) {
      hinted = 1;
      sfx('ding', { vol: .38, pitch: 1.7 });
      g.popup('HE SEES YOU', cat.x, cat.y - 120, '#ff5c78', 26);
    }
  } else {
    seenK = Math.max(0, seenK - dt * 6);
    spot = Math.max(0, spot - dt * 1.35);
    if (spot < .2) hinted = 0;
  }
  if (spot > .45) s.chase = Math.max(s.chase, .5);
  const dSeek = Math.hypot(cat.x - s.x, cat.y - s.y);

  /* noise: moving near him turns his head */
  if (hunting && cat.moving > .3 && dSeek < 220) s.hear = Math.max(s.hear, .9), s.hearAng = Math.atan2(cat.y - (s.y - EYE), cat.x - s.x);

  /* ---- the cat ---- */
  let mx = 0, my = 0;
  if (g.ptr.down) {
    const tx = g.ptr.x, ty = g.ptr.y;
    const dx = tx - cat.x, dy = ty - cat.y, d = Math.hypot(dx, dy);
    if (d > 8) { mx = dx / d; my = dy / d; }
  }
  if (isAutoBot()) { const b = botMove(dt); mx = b.mx; my = b.my; }
  else if (isAuto && g.dumb()) { mx = 0; my = -1; }
  if (phase === 'caught' || phase === 'won') { mx = 0; my = 0; }

  const sp = CAT_SPD * (spot > .8 ? 1.1 : 1);
  cat.x += mx * sp * dt; cat.y += my * sp * dt;
  pushOut();
  cat.moving = lerp(cat.moving, Math.hypot(mx, my), Math.min(1, dt * 12));
  cat.sq = lerp(cat.sq, 1, Math.min(1, dt * 8));
  cat.anim += dt * (2.4 + cat.moving * 8);
  if (cat.moving > .3) {
    cat.sq = .94 + .06 * Math.sin(cat.anim * 2);
    /* paw dust on the beat of the run */
    dustT -= dt;
    if (dustT <= 0) { dustT = .17; pawDust(cat.x - mx * 10, cat.y, 2, seen > .1); }
    stepT -= dt;
    if (stepT <= 0) { stepT = .28; sfx('step', { vol: .16, pitch: 1.45 + (spot > .4 ? .2 : 0) }); }
  }

  /* ---- danger read: drives the camera, the vignette and the heartbeat ---- */
  const near = clamp(1 - dSeek / 620, 0, 1);
  const dTarget = clamp(Math.max(near * .85, spot), 0, 1);
  const wasD = dangerK;
  dangerK = damp(dangerK, dTarget, 5, dt);
  g.cam.scale = 1 + dangerK * .038;                        // the room leans in as he closes
  if (dangerK - wasD > .012) g.punch(.02 + dangerK * .03);  // a nudge, not a bounce
  beat = damp(beat, hbPulse, 10, dt);

  /* ---- heartbeat ---- */
  hbT -= dt;
  if (hbT <= 0) {
    hbT = lerp(.95, .3, Math.max(near, spot));
    hbPulse = 1;
    sfx('drum', { vol: .18 + .42 * Math.max(near, spot), pitch: .72 + .5 * Math.max(near, spot) });
    if (Math.max(near, spot) > .55) g.fx.emit('ring', cat.x, cat.y - 40, { size: 62, life: .3, color: '#ff5c78', add: true, wide: 3 });
  }
  hbPulse = Math.max(0, hbPulse - dt * 2.6);

  /* ---- clock & endings ---- */
  if (phase === 'intro' && phaseT > 1.25) {
    phase = 'hunt'; phaseT = 0;
    g.showBanner('HIDE!', .85);
    sfx('powerup', { vol: .5, pitch: .9 });
    g.punch(.06); g.shake(4); g.flash('#7df9ff', .14); g.hitstop(.04);
    g.fx.burst(cat.x, cat.y - 40, 14, { kind: 'star', color: ['#7df9ff', '#fff'], speed: 190, life: .6, size: 7, g: 240 });
    g.fx.dust(cat.x, cat.y, 10, { color: 'rgba(190,220,255,.3)', size: 16, speed: 130, up: 60 });
    sfx('whoosh', { vol: .3, pitch: 1.2 });
  }
  if (phase === 'hunt') {
    clock += dt;
    g.score += dt * 12;

    /* safe streaks: banked every 4s in the dark, cashed in with a rising pitch */
    safeTick -= dt;
    if (safeTick <= 0 && spot < .25) { safeTick = 4; safeStreak(); }
    else if (spot > .55) safeTick = Math.max(safeTick, 1.2);

    /* milestones so a 30s wait still has beats in it */
    if (clock > 10 && toldT < 10) {
      toldT = 10;
      g.showBanner('10s  ·  KEEP STILL', .9); sfx('tick', { pitch: 1.3, vol: .5 });
      g.flash('#7df9ff', .12); g.punch(.05); g.hitstop(.035);
      g.fx.emit('ring', W / 2, 470, { size: 160, life: .45, color: '#7df9ff', add: true, wide: 6 });
    }
    if (clock > 20 && toldT < 20) {
      toldT = 20;
      g.showBanner('20s  ·  ALMOST THERE', .9); sfx('tick', { pitch: 1.55, vol: .55 });
      g.flash('#ffd34d', .16); g.punch(.06); g.hitstop(.04);
      g.fx.emit('ring', W / 2, 470, { size: 190, life: .5, color: '#ffd34d', add: true, wide: 7 });
    }
    if (SURVIVE - clock < 8 && toldT < 30) {
      toldT = 30;
      sfx('charge', { vol: .5, pitch: 1.1 });
      g.hitstop(.04); g.flash('#ffd34d', .12); g.shake(6); g.punch(.05);
    }

    if (spot >= 1 || dSeek < 46) caught();
    else if (clock >= SURVIVE) win();
  }

  g.state = {
    phase, clock: Math.round(clock * 10) / 10, spot: Math.round(spot * 100) / 100,
    cx: Math.round(cat.x), cy: Math.round(cat.y), sx: Math.round(s.x), sy: Math.round(s.y),
  };
  if (isAuto && autoT > 42) win();
}

function caught() {
  if (phase === 'over' || phase === 'caught') return;
  phase = 'caught';
  spot = 1.2;
  sfx('groan', { vol: .9, pitch: 1.25 });
  sfx('boom', { vol: .5, pitch: .9 });
  sfx('glass', { vol: .35, pitch: .8 });
  g.impact(cat.x, cat.y - 40, { punch: .26, shake: 28, stop: .17, rip: 1.6, flash: '#ff2b4e', flashA: .5 });
  g.slowmo(.28, 1.25);
  g.cam.scale = 1.1;                                     // he lunges in
  g.fx.blast(cat.x, cat.y - 40, { r: 155, color: '#ff2b4e', colors: ['#ff2b4e', '#ff8a3c', '#fff'], n: 32, speed: 430, size: 7, shake: 14, punch: .14, flashA: .2 });
  g.fx.burst(cat.x, cat.y - 30, 22, { kind: 'spark', color: ['#ff2b4e', '#fff', '#ffd34d'], speed: 360, life: .8, size: 6 });
  g.fx.burst(cat.x, cat.y - 26, 14, { kind: 'debris', color: ['#3a2a52', '#ff5c78', '#1a1030'], speed: 250, life: 1.1, size: 9, g: 1500 });
  g.fx.emit('ring', cat.x, cat.y - 40, { size: 220, life: .55, color: '#ff2b4e', add: true, wide: 11 });
  pawDust(cat.x, cat.y, 14, false);
  g.combo.miss();
  g.popup('CAUGHT!', cat.x, cat.y - 130, '#ff5c78', 44);
  g.showBanner('SPOTTED!', 1.6);
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: Math.round(clamp(clock / SURVIVE * 100, 0, 100)) });
}

function win() {
  if (phase === 'over' || phase === 'won') return;
  phase = 'won';
  g.score += 600;
  sfx('fanfare', { vol: .9 });
  sfx('coinchain', { pitch: 1.3, vol: .6 });
  g.slowmo(.45, .9);
  g.hitstop(.06);
  g.punch(.14); g.shake(12); g.flash('#fff', .34);
  g.cam.scale = .97;                                     // pull back: relief
  g.fx.burst(W / 2, 420, 96, { kind: 'confetti', color: ['#ffd34d', '#7df9ff', '#ff4ad8', '#7dff7d', '#fff'], speed: 560, life: 1.9, g: 380, size: 7 });
  g.fx.burst(W / 2, 460, 26, { kind: 'heart', color: ['#ff7aa8', '#ffd34d'], speed: 260, life: 1.6, size: 18, g: 90 });
  g.fx.blast(W / 2, 460, { r: 220, color: '#ffd34d', colors: ['#ffd34d', '#fff', '#7df9ff'], n: 46, speed: 520, shake: 12, punch: .12, flashA: .3 });
  g.fx.emit('ring', W / 2, 470, { size: 280, life: .7, color: '#ffd34d', add: true, wide: 12 });
  g.combo.hit(cat.x, cat.y - 110, 'SURVIVED');
  g.popup('SURVIVED!', W / 2, 420, '#ffd34d', 52);
  g.showBanner('SAFE!', 1.8);
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 100 });
}

/* ================================================================ drawing */
function drawCone() {
  const ex = seeker.x, ey = seeker.y - EYE;
  const N = 30;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  for (let i = 0; i <= N; i++) {
    const a = seeker.ang - CONE_HALF + (i / N) * CONE_HALF * 2;
    const d = rayCast(ex, ey, a, CONE_LEN);
    ctx.lineTo(ex + Math.cos(a) * d, ey + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.clip();
  const lg = ctx.createRadialGradient(ex, ey, 8, ex, ey, CONE_LEN);
  lg.addColorStop(0, 'rgba(255,246,205,.42)');
  lg.addColorStop(.28, 'rgba(255,232,160,.24)');
  lg.addColorStop(.7, 'rgba(255,214,120,.10)');
  lg.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lg;
  ctx.fillRect(ex - CONE_LEN, ey - CONE_LEN, CONE_LEN * 2, CONE_LEN * 2);
  ctx.globalAlpha = .18 + .1 * Math.sin(g.t * 9);
  ctx.fillStyle = 'rgba(255,255,220,.5)';
  ctx.fillRect(ex - CONE_LEN, ey - CONE_LEN, CONE_LEN * 2, CONE_LEN * 2);
  ctx.restore();
  /* the bulb itself: a hot core so bloom has something to grab */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = .82 + .18 * Math.sin(g.t * 23) + .06 * Math.sin(g.t * 7.3);
  ctx.globalAlpha = .65 * fl;
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath(); ctx.arc(ex + Math.cos(seeker.ang) * 26, ey + Math.sin(seeker.ang) * 26, 9 + 3 * fl, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawFurn(f, alpha) {
  const { x, y, w, h, kind } = f;
  ctx.save();
  ctx.globalAlpha = alpha;
  /* contact shadow */
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 6, w * .52, 12, 0, 0, TAU); ctx.fill();

  const body = kind === 'couch' ? '#5a3f78' : kind === 'table' ? '#6b4a3a' : kind === 'cabinet' ? '#3c3054' : kind === 'shelf' ? '#4a3a30' : kind === 'bed' ? '#553a5e' : kind === 'plant' ? '#2f5340' : '#4a4055';
  const top = kind === 'couch' ? '#7a5aa0' : kind === 'table' ? '#8a6350' : kind === 'cabinet' ? '#54456e' : kind === 'shelf' ? '#63503f' : kind === 'bed' ? '#6f4d78' : kind === 'plant' ? '#3f7052' : '#5d5169';

  /* body */
  ctx.fillStyle = body;
  rr(ctx, x, y, w, h, 12); ctx.fill();
  /* top face */
  ctx.fillStyle = top;
  rr(ctx, x, y, w, h * .46, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(10,4,20,.85)'; ctx.lineWidth = 4;
  rr(ctx, x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  rr(ctx, x + 6, y + 4, w - 12, 4, 2); ctx.fill();

  if (kind === 'couch') {
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    for (let i = 0; i < 3; i++) { rr(ctx, x + 12 + i * (w - 24) / 3, y + 10, (w - 24) / 3 - 8, h * .5, 8); ctx.fill(); }
    ctx.fillStyle = '#3d2a54'; ctx.fillRect(x + 8, y + h - 10, 16, 14); ctx.fillRect(x + w - 24, y + h - 10, 16, 14);
  } else if (kind === 'table') {
    ctx.strokeStyle = 'rgba(20,12,30,.9)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + 12, y + h); ctx.lineTo(x + 12, y + h + 12); ctx.moveTo(x + w - 12, y + h); ctx.lineTo(x + w - 12, y + h + 12); ctx.stroke();
    ctx.fillStyle = '#ffd88a'; ctx.globalAlpha = alpha * .8;
    ctx.beginPath(); ctx.arc(x + w * .5, y + 12, 7, 0, TAU); ctx.fill(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#2a1a36'; ctx.fillRect(x + w * .5 - 3, y + 16, 6, 14);
    /* candle flame breathes — idle life on a static prop */
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (.4 + .35 * (.5 + .5 * Math.sin(g.t * 11)));
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath(); ctx.arc(x + w * .5, y + 8, 4.5, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  } else if (kind === 'cabinet') {
    ctx.strokeStyle = 'rgba(10,4,20,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 6); ctx.lineTo(x + w / 2, y + h - 8); ctx.stroke();
    ctx.fillStyle = '#d9b45a'; ctx.fillRect(x + w / 2 - 12, y + h * .5, 6, 6); ctx.fillRect(x + w / 2 + 6, y + h * .5, 6, 6);
  } else if (kind === 'shelf') {
    ctx.fillStyle = 'rgba(10,4,20,.8)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 8, y + 12 + i * (h - 18) / 3, w - 16, 5);
    ctx.fillStyle = '#c86a4a'; ctx.fillRect(x + 16, y + 8, 14, 12);
    ctx.fillStyle = '#4a90c8'; ctx.fillRect(x + 34, y + 8, 10, 12);
    ctx.fillStyle = '#c8a24a'; ctx.fillRect(x + 50, y + 8, 16, 12);
  } else if (kind === 'crates') {
    ctx.strokeStyle = 'rgba(10,4,20,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + w - 12, y + h - 12); ctx.moveTo(x + w - 12, y + 12); ctx.lineTo(x + 12, y + h - 12); ctx.stroke();
  } else if (kind === 'bed') {
    ctx.fillStyle = '#e6d8f0'; rr(ctx, x + 10, y + 8, w * .38, h * .34, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.10)'; rr(ctx, x + w * .5, y + 8, w * .46, h - 16, 8); ctx.fill();
  } else if (kind === 'plant') {
    ctx.fillStyle = '#8a5a3a'; rr(ctx, x + w * .28, y + h * .4, w * .44, h * .58, 8); ctx.fill();
    /* leaves sway — the room is never dead still */
    const sw = Math.sin(g.t * 1.6) * .1 + Math.sin(g.t * 3.1) * .04;
    ctx.fillStyle = '#4f9a6a';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * .42 + sw;
      ctx.beginPath(); ctx.ellipse(x + w / 2 + Math.cos(a) * 22, y + h * .3 + Math.sin(a) * 20, 8, 18, a, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawSeeker() {
  const s = seeker;
  ctx.save();
  ctx.globalAlpha = .4; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(s.x, s.y + 3, 32, 9, 0, 0, TAU); ctx.fill();
  ctx.restore();
  const h = 158;
  /* a slow breathing bob so he isn't a cardboard cut-out */
  const bob = Math.sin(g.t * 1.9) * 1.6;
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  drawChar('human', ctx, 0, 0, h, { dir: 1, anim: s.walk > 0 ? 'walk' : 'idle', t: s.walk, color: '#3a4a63', hurt: spot > .7 });
  ctx.restore();
  /* torch in hand */
  const ex = s.x, ey = s.y - EYE + bob;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(s.ang);
  ctx.fillStyle = '#20263a'; rr(ctx, -6, -7, 26, 14, 5); ctx.fill();
  ctx.fillStyle = '#ffefb0'; rr(ctx, 18, -5, 8, 10, 3); ctx.fill();
  ctx.globalAlpha = .8; ctx.fillStyle = 'rgba(255,246,200,.9)';
  ctx.beginPath(); ctx.arc(27, 0, 7, 0, TAU); ctx.fill();
  ctx.restore();
  /* eye glint */
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = spot > .3 ? '#ff5c78' : '#bfe9ff';
  ctx.beginPath(); ctx.arc(s.x + 8, s.y - 118 + bob, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCat() {
  const c = cat;
  const lit = lightOn(c.x, c.y);
  ctx.save();
  ctx.globalAlpha = .42; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(c.x, c.y + 3, 24, 8, 0, 0, TAU); ctx.fill();
  ctx.restore();
  /* glow when lit */
  if (lit > 0) {
    ctx.save();
    ctx.globalAlpha = .3 + spot * .4;
    ctx.fillStyle = spot > .5 ? '#ff5c78' : '#ffe9a8';
    ctx.beginPath(); ctx.arc(c.x, c.y - 40, 54, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = lit > 0 ? 1 : .82;
  ctx.scale(1, c.sq);
  drawChar('cat', ctx, 0, 0, 96, { dir: 1, anim: c.moving > .15 ? 'walk' : 'idle', t: c.anim, color: lit > .2 ? '#ffd9a8' : '#e8a34a', hurt: spot > .75 });
  ctx.restore();
  /* suspicion dial */
  const ey = c.y - 86;
  if (spot > .05) {
    ctx.save();
    ctx.globalAlpha = clamp(spot + .25, 0, 1);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,4,22,.7)';
    ctx.beginPath(); ctx.arc(c.x, ey, 17, -2.5, .7); ctx.stroke();
    ctx.strokeStyle = spot > .7 ? '#ff2b4e' : spot > .35 ? '#ffb347' : '#7df9ff';
    ctx.beginPath(); ctx.arc(c.x, ey, 17, -2.5, -2.5 + clamp(spot, 0, 1) * 3.2); ctx.stroke();
    if (spot > .45) g.text('!', c.x, ey + 10, { size: 26, align: 'center', color: '#ff5c78', ink: '#0a0418' });
    ctx.restore();
  }
}

/** foreground parallax: near-camera shapes that slide with the camera zoom */
function drawParallax() {
  const k = (g.cam.z - 1) * 900;
  ctx.save();
  ctx.globalAlpha = .55;
  ctx.fillStyle = '#05030c';
  /* curtain edges, closer than the room so they move more than it does */
  ctx.beginPath();
  ctx.moveTo(-40 - k * .6, 0); ctx.lineTo(70 - k * .6, 0);
  ctx.quadraticCurveTo(30 - k * .6, 300, 58 - k * .6, 700);
  ctx.lineTo(-40 - k * .6, 700); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W + 40 + k * .6, 0); ctx.lineTo(W - 60 + k * .6, 0);
  ctx.quadraticCurveTo(W - 26 + k * .6, 320, W - 50 + k * .6, 720);
  ctx.lineTo(W + 40 + k * .6, 720); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function draw() {
  const base = g.k;
  ctx.fillStyle = '#07040f'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(WALL, 0, 0, W, 240);
  ctx.drawImage(FLOOR, 0, 238, W, 720);

  /* the torch pool on the floor, flickering with the bulb */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .5 + .18 * Math.sin(g.t * 13) + .1 * Math.sin(g.t * 3.7);
  ctx.fillStyle = POOLG; ctx.fillRect(0, 238, W, 720);
  ctx.restore();

  drawCone();

  /* dust motes drifting in the beam */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) {
    const t = g.t * .18 + i * 1.7;
    const px = 40 + ((i * 97 + Math.sin(t) * 40) % 460);
    const py = 260 + ((i * 137 + t * 26) % 620);
    const l = lightOn(px, py);
    if (l > .02) {
      ctx.globalAlpha = l * .55;
      ctx.fillStyle = '#fff6cc';
      ctx.fillRect(px, py, 2.5, 2.5);
    }
  }
  ctx.restore();

  /* y-sorted furniture + characters so cover reads in depth */
  const items = [];
  for (const f of FURN) {
    let a = 1;
    if (blocks(seeker.x, seeker.y - EYE, cat.x, cat.y) === f) a = .62;
    items.push({ sortY: f.y + f.h, f, a });
  }
  const catSort = cat.y, seekSort = seeker.y;
  items.push({ sortY: seekSort, seeker: true });
  items.push({ sortY: catSort, catp: true });
  items.sort((p, q) => p.sortY - q.sortY);
  for (const it of items) {
    if (it.f) drawFurn(it.f, it.a);
    else if (it.seeker) drawSeeker();
    else drawCat();
  }

  drawParallax();

  /* vignette, tightens as he closes in */
  const near = clamp(1 - Math.hypot(cat.x - seeker.x, cat.y - seeker.y) / 640, 0, 1);
  ctx.save();
  ctx.globalAlpha = .5 + near * .38;
  ctx.fillStyle = SKYG; ctx.fillRect(0, 0, W, H);
  if (beat > .01 || spot > .5) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (beat * .38 + spot * .18) * .6;
    ctx.fillStyle = REDG; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  /* ---------------- HUD (screen space: no camera wobble on the readouts) ---------------- */
  ctx.save();
  ctx.setTransform(base, 0, 0, base, 0, 0);
  const left = Math.max(0, SURVIVE - clock);
  const pct = clamp(clock / SURVIVE, 0, 1);
  ctx.fillStyle = 'rgba(8,4,18,.8)'; rr(ctx, 22, 46, W - 44, 22, 11); ctx.fill();
  const bg = ctx.createLinearGradient(22, 0, W - 22, 0);
  bg.addColorStop(0, '#7df9ff'); bg.addColorStop(.5, '#ffd34d'); bg.addColorStop(1, '#ff4ad8');
  ctx.fillStyle = bg;
  rr(ctx, 25, 49, (W - 50) * pct, 16, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(10,4,22,.9)'; ctx.lineWidth = 3; rr(ctx, 22, 46, W - 44, 22, 11); ctx.stroke();
  ctx.restore();
  g.text('SURVIVE', 26, 38, { size: 15, color: '#bfd4ff', ink: '#0a0418' });
  const secs = Math.ceil(left);
  g.text('0:' + String(secs).padStart(2, '0'), W - 26, 38, {
    size: 22, align: 'right', color: left <= 8 ? '#ff5c78' : '#fff', ink: '#0a0418',
  });
  if (phase === 'intro') {
    ctx.save();
    ctx.globalAlpha = .55 + .45 * Math.sin(g.t * 8);
    g.text('GET TO COVER', W / 2, 470, { size: 34, align: 'center', color: '#ffd34d', ink: '#0a0418' });
    ctx.restore();
  }
  if (spot > .6) {
    ctx.save();
    ctx.globalAlpha = .5 + .5 * Math.sin(g.t * 18);
    g.text('HE SEES YOU', W / 2, 470, { size: 34, align: 'center', color: '#ff5c78', ink: '#0a0418' });
    ctx.restore();
  }
  if (left <= 8 && phase === 'hunt') {
    ctx.save();
    ctx.globalAlpha = .35 + .45 * Math.sin(g.t * 7);
    g.text('FINAL SWEEP', W / 2, 120, { size: 26, align: 'center', color: '#ffd34d', ink: '#0a0418' });
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = .45;
  g.text('DRAG ANYWHERE TO SNEAK', W / 2, 924, { size: 17, align: 'center', color: '#fff', ink: '#0a0418' });
  ctx.restore();
}

g.run(update, draw);
resetMatch();
window.__g = g;
window.__dbg = () => ({ phase, clock: Math.round(clock * 10) / 10, spot: Math.round(spot * 100) / 100, cat: [Math.round(cat.x), Math.round(cat.y)], seeker: [Math.round(seeker.x), Math.round(seeker.y)], leg: seeker.leg });

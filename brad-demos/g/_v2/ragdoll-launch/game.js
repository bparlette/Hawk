// RAGDOLL LAUNCH — a slingshot toy with a loose-limbed cat and a very breakable circus.
// Drag back to load, keep pulling to charge, release to fly. Real verlet ragdoll: limbs trail, the head
// whips, and every hard body-on-body hit throws sparks, dust, a camera punch and a hitstop.
// Score = distance flown + destruction + ricochet chains. Three launches, one big score.
import {
  makeGame, sfx, music, comboPitch, clamp, rnd, chance, TAU,
  rr, hexA, fmt, damp, shadow,
} from '../_vendor/gp2x.js';
import { face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'ragdoll-launch', title: 'RAGDOLL LAUNCH', sub: 'DRAG BACK  ·  LET THE CAT FLY',
  hook: 'one cat, one sling, zero dignity', w: W, h: H, bg: '#0b1020', style: 'bold',
  bloom: .8, ca: .3, vig: .95, scan: .08,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const dumb = () => isAuto && g.dumb();

const GROUND = 830, SLING = { x: 130, y: GROUND - 150 };
const GRAV = 1500, LAUNCHES = 2, WIN = 12000;
const PXM = 10;                                  // world px per metre on the distance tape

/* three scrolling rock layers behind the yard — cheap parallax, big sense of travel */
const PARALLAX = [
  { col: 'rgba(74,48,102,.72)', amp: 32, base: 596, sp: .16, f: .0042 },
  { col: 'rgba(52,32,78,.88)', amp: 24, base: 688, sp: .34, f: .0072 },
  { col: 'rgba(30,19,48,1)', amp: 17, base: 782, sp: .62, f: .0115 },
];
const STARS = Array.from({ length: 44 }, (_, i) => ({ x: (i * 137 + 31) % W, y: (i * 71) % 380, s: 1 + (i % 3) * .8, p: i * .9 }));

/* ------------------------------------------------------------------ state */
let t, launch, aimA, aimP, aiming, rag, props, camX, camY, total, best,
  phase, settleT, flyT, maxX, breaks, hits, launchScore, launchesLeft, botT, dry,
  chargeT, whineT, aimTick, chain, chainT, chainBest, countT, countN,
  sfxCool, lastHardT, recordDone, bestLaunch, camVx, camVy, pcamX, pcamY;

const FLOAT = [];                                // arcing popups (screen space, physics of their own)
const sling = { kick: 0, glow: 0 };
const hudPop = { s: 1 };

const SX = x => x - camX;                        // world → screen
const SY = y => y - camY;

const nodes = () => ([
  { x: 0, y: 0, px: 0, py: 0, r: 13, kind: 'head' },
  { x: 0, y: 0, px: 0, py: 0, r: 10, kind: 'chest' },
  { x: 0, y: 0, px: 0, py: 0, r: 10, kind: 'hip' },
  { x: 0, y: 0, px: 0, py: 0, r: 6, kind: 'hand' },
  { x: 0, y: 0, px: 0, py: 0, r: 6, kind: 'hand' },
  { x: 0, y: 0, px: 0, py: 0, r: 7, kind: 'foot' },
  { x: 0, y: 0, px: 0, py: 0, r: 7, kind: 'foot' },
]);
const LINKS = [[0, 1, 26], [1, 2, 30], [1, 3, 26], [1, 4, 26], [2, 5, 30], [2, 6, 30]];
const JOINED = new Set(LINKS.map(([a, b]) => a < b ? a + '-' + b : b + '-' + a));
const joined = (a, b) => JOINED.has(a < b ? a + '-' + b : b + '-' + a);

function makeProps() {
  const out = [];
  let x = 460;
  for (let i = 0; i < 16; i++) {
    const big = i % 5 === 4;
    const w = big ? 74 : 52, h = big ? 74 : rnd(46, 62);
    out.push({ x, y: GROUND - h, w, h, hp: big ? 3 : 2, type: big ? 'crate' : (chance(.5) ? 'box' : 'bin'), dead: false, shake: 0, rot: rnd(-.2, .2) });
    x += rnd(150, 240);
  }
  return out;
}

function spawnRagdoll() {
  const pts = nodes();
  pts[0].x = SLING.x; pts[0].y = SLING.y - 34;
  pts[1].x = SLING.x; pts[1].y = SLING.y - 8;
  pts[2].x = SLING.x; pts[2].y = SLING.y + 24;
  pts[3].x = SLING.x - 24; pts[3].y = SLING.y - 20;
  pts[4].x = SLING.x + 24; pts[4].y = SLING.y - 20;
  pts[5].x = SLING.x - 14; pts[5].y = SLING.y + 52;
  pts[6].x = SLING.x + 14; pts[6].y = SLING.y + 52;
  for (const p of pts) { p.px = p.x; p.py = p.y; }
  return pts;
}

/* ------------------------------------------------------------------ popups
   Distance / multiplier numbers get their own little ballistic arc instead of the shell's
   straight rise, so a big launch throws its number up and lets it fall. */
function popArc(text, x, y, color = '#ffd34d', size = 32, o = {}) {
  FLOAT.push({
    text, x, y, vx: o.vx ?? rnd(-30, 30), vy: o.vy ?? -190, g: o.g ?? 300,
    t: 0, life: o.life ?? 1.15, color, size,
  });
  if (FLOAT.length > 26) FLOAT.shift();
}
function stepFloats(dd) {
  for (let i = FLOAT.length - 1; i >= 0; i--) {
    const f = FLOAT[i];
    f.t += dd; f.vy += f.g * dd; f.x += f.vx * dd; f.y += f.vy * dd;
    if (f.t >= f.life) FLOAT.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ confetti */
function confetti(n = 20, y0 = -24) {
  const cols = ['#ffd34d', '#7dff7d', '#7df9ff', '#ff6bd6', '#ffffff'];
  for (let i = 0; i < n; i++) {
    g.fx.emit('confetti', rnd(24, W - 24), y0 - rnd(0, 90), {
      vx: rnd(-110, 110), vy: rnd(60, 240), g: 330, life: rnd(.9, 1.7),
      size: rnd(4, 8), color: cols[i % 5], rot: rnd(0, TAU), vr: rnd(-9, 9),
    });
  }
}

/* ------------------------------------------------------------------ flow */
function resetWorld() {
  t = 0; launch = 1; aimA = -.82; aimP = .9; aiming = false;
  rag = spawnRagdoll(); props = makeProps();
  camX = 0; camY = 0; pcamX = 0; pcamY = 0; camVx = 0; camVy = 0;
  total = 0; best = 0; phase = 'aim'; settleT = 0;
  maxX = SLING.x; breaks = 0; hits = 0; launchScore = 0; flyT = 0; launchesLeft = LAUNCHES; botT = 0; dry = 0;
  chargeT = 0; whineT = 0; aimTick = 0; chain = 0; chainT = 0; chainBest = 0;
  countT = 1.2; countN = 3; sfxCool = 0; lastHardT = -9; recordDone = false; bestLaunch = 0;
  sling.kick = 0; sling.glow = 0; hudPop.s = 1;
  FLOAT.length = 0;
  g.score = 0; g.state = { launch: 1, launches: LAUNCHES, total: 0 };
  g.combo.reset(); g.fx.clear(); g.cam.scale = 1;
  g.showBanner('LAUNCH 1', 1.1);
}
g.onReset = resetWorld;
g.onStart = () => { music('epic'); sfx('click', { pitch: 1.12, vol: .5 }); };

/* ---- the mirror of the engine's own end call — kept for both launch and record ---- */
function announce(n) {
  countT = 1.2; countN = 3; aimTick = 0;
  g.showBanner('LAUNCH ' + n, .95);
  sfx('tick', { pitch: .8, vol: .5 });
  g.punch(.02);
}

function fire(angle, power) {
  phase = 'fly'; settleT = 0; flyT = 0; maxX = SLING.x; breaks = 0; hits = 0; launchScore = 0;
  aiming = false; chargeT = 0; chain = 0; chainT = 0; chainBest = 0;
  const v = 300 + power * 1350;
  const pts = rag;
  /* every joint leaves the pouch together, head a touch faster → the body whips behind it */
  for (let i = 0; i < pts.length; i++) {
    const m = i === 0 ? 1.06 : i === 2 ? .97 : (i >= 3 ? 1.02 : 1);
    pts[i].px = pts[i].x - Math.cos(angle) * v * .016 * m;
    pts[i].py = pts[i].y - Math.sin(angle) * v * .016 * m;
  }
  const sx = SX(SLING.x), sy = SY(SLING.y - 18);
  /* whip-crack: the snap, the air, and the body leaving the pouch */
  sfx('snap', { pitch: .98 + power * .3, vol: .9 });
  sfx('whoosh', { pitch: .85 + power * .4, vol: .8 });
  sfx('shoot', { pitch: .9 + power * .35, vol: .38 });
  g.punch(.05 + power * .055);
  g.shake(8 + power * 9);
  g.hitstop(.03 + power * .03);
  g.flash('#ffd9a0', .08 + power * .13);
  if (g.post) g.post.ripple(sx / W, sy / H, .7 + power * .5);
  g.fx.ring(sx, sy, { r: 44 + power * 74, life: .34, color: '#fff3c0', wide: 5 + power * 5 });
  g.fx.burst(sx, sy, 16 + Math.round(power * 18), { color: ['#ffd34d', '#fff', '#ff9a3c'], speed: 220 + power * 340, life: .45, size: 6, kind: 'spark' });
  g.fx.dust(sx, sy, 6 + Math.round(power * 9), { color: 'rgba(220,232,255,.30)', size: 14 + power * 10, spread: 26, speed: 150 + power * 170, up: 120 });
  g.combo.hit(sx, sy - 44, 'WHIP!');
  popArc(power > .92 ? 'MAX POWER!' : 'FLING!', sx, sy - 62, power > .92 ? '#ff5a4d' : '#ffd34d', 30, { vy: -235 });
  sling.kick = 1; g.tween(sling, 'kick', 0, .3);
  g.cam.scale = 1 - power * .05;
}

/* ------------------------------------------------------------------ hits */
function bounce(x, y, sp, node, scored) {
  if (sp < 4.5) return;
  const sx = SX(x), sy = SY(y);
  const k = clamp(sp / 24, .15, 1.7);
  const hard = sp > 14, big = sp > 21;

  /* particles scale with the velocity of the joint that hit */
  const n = Math.round(2 + k * 12);
  g.fx.burst(sx, sy, n, {
    color: node.kind === 'head' ? ['#ffd34d', '#fff', '#ff9a3c'] : ['#ffb27a', '#fff', '#8fa3c8'],
    speed: 90 + sp * 11, life: .34, size: 4 + k * 3, kind: 'spark', g: 900,
    ang: Math.atan2(node.py - node.y, node.px - node.x), spread: 2.4,
    vx: -camVx * .5, vy: -camVy * .5,
  });
  if (k > .45) g.fx.dust(sx, sy, Math.round(2 + k * 4), { color: 'rgba(206,220,255,.26)', size: 10 + k * 9, spread: 14 + k * 14, speed: 60 + sp * 4, up: 45, vx: -camVx, vy: -camVy });
  if (k > .85) g.fx.ring(sx, sy, { r: 20 + k * 44, life: .26, color: '#cfe9ff', wide: 2 + k * 3, ripple: .35 });

  /* camera + hitstop only when the hit is actually worth feeling */
  if (hard) {
    g.punch(clamp(k * .042, .018, .07));
    g.shake(clamp(k * 5.5, 3, 13));
  }
  if (big) {
    g.hitstop(clamp(.02 + k * .028, .02, .06));
    g.flash('#ffe6a8', .05 + k * .06);
  }

  /* a ricochet chain: each bounce inside the window rings a semitone higher */
  if (scored && sp > 7) {
    chain = chainT > 0 ? chain + 1 : 1;
    chainT = 1.2;
    chainBest = Math.max(chainBest, chain);
    if (chain > 1) {
      g.combo.hit(sx, sy - 18, chain >= 5 ? `RICOCHET ×${chain}` : 'RICOCHET');
      popArc(chain >= 4 ? `CHAIN ×${chain}` : `×${chain}`, sx, sy - 34, '#bff4ff', 19 + Math.min(20, chain * 3), { vy: -185, vx: rnd(-40, 40) });
      if (chain === 3) g.showBanner('RICOCHET!', .55);
      if (chain === 6) { g.showBanner('PINBALL!', .7); g.shake(9); g.flash('#bff4ff', .14); }
    }
  }

  if (scored && sp > 6) hits++;
  if (big) lastHardT = t;

  /* distinct voices: soft bounce / firm crack / concrete-cracking thud */
  if (sfxCool > 0) return;
  sfxCool = .045;
  const rp = comboPitch(Math.min(chain, 12));
  if (big) {
    sfx('thud', { pitch: rp * .95, vol: clamp(.4 + k * .35, 0, 1) });
    sfx('hit', { pitch: 1.12 * rp, vol: .45 });
  } else if (hard) {
    sfx('hit', { pitch: rp, vol: .5 });
  } else {
    sfx('pop', { pitch: rp * (.9 + k * .25), vol: clamp(.16 + k * .3, 0, .7) });
  }
}

function breakProp(pr) {
  pr.dead = true; breaks++;
  const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
  const sx = SX(cx), sy = SY(cy);
  const cols = pr.type === 'crate' ? ['#c98a4b', '#8a5a2b', '#f2d0a0'] : pr.type === 'bin' ? ['#7dff7d', '#2f6b3f', '#c8ffc8'] : ['#9aa4b0', '#5b6672', '#dfe6ee'];
  g.fx.blast(sx, sy, { r: 84 + breaks * 6, color: '#ffd34d', colors: cols, n: 24, smoke: true, punch: .075, shake: 15, flash: '#fff', flashA: .16, life: .4 });
  g.fx.burst(sx, sy, 16, { kind: 'debris', color: cols, speed: 470, life: 1, size: 12, g: 1300, drag: 1.4 });
  g.fx.burst(sx, sy, 8, { kind: 'shard', color: ['#fff', '#ffd34d'], speed: 620, life: .5, size: 9, g: 900 });
  g.hitstop(.05);
  g.punch(.055); g.shake(11);
  sfx('explode', { pitch: rnd(.92, 1.18), vol: .75 });
  sfx('glass', { pitch: rnd(1.0, 1.3), vol: .4 });
  g.popup('+' + fmt(480), sx, sy - 18, '#ffd34d', 34);
  popArc('SMASH ×' + breaks, sx, sy - 44, '#ffe98a', 24, { vy: -200 });
  g.combo.hit(sx, sy, 'CRUNCH');
  if (breaks === 4) g.showBanner('CARNAGE!', .75);
}

/* ------------------------------------------------------------------ scoring */
function endBonuses(pts) {
  /* last bounce: a big hit in the dying seconds of the final launch pays out */
  if (t - lastHardT < 1.7 && hits > 0) {
    const b = 260 + chainBest * 140;
    total += b; g.score = total;
    g.showBanner('LAST BOUNCE +' + fmt(b), 1.2);
    popArc('LAST BOUNCE', W / 2, H * .44, '#bff4ff', 28, { vy: -215, vx: 0 });
    popArc('+' + fmt(b), W / 2, H * .44 + 42, '#fff', 26, { vy: -170, vx: 0 });
    sfx('powerup', { pitch: 1.05, vol: .65 });
    g.hitstop(.05); g.shake(9); g.flash('#bff4ff', .14);
  }
  /* redemption: a weak final launch gets half of the gap back, so the run stays alive */
  if (bestLaunch > 0 && pts < bestLaunch) {
    const rb = Math.round((bestLaunch - pts) * .5);
    if (rb > 0) {
      total += rb; g.score = total;
      g.showBanner('REDEMPTION +' + fmt(rb), 1.5);
      popArc('REDEMPTION', W / 2, H * .38, '#ff6bd6', 34, { vy: -230, vx: 0, life: 1.4 });
      sfx('perfect', { pitch: 1.12, vol: .55 });
      sfx('powerup', { pitch: 1.2, vol: .5 });
      confetti(26);
      g.hitstop(.07); g.shake(11); g.flash('#ffd9f0', .18); g.punch(.06);
    }
  }
  bestLaunch = Math.max(bestLaunch, pts);
}

function scoreLaunch() {
  const dist = Math.max(0, Math.round(maxX - SLING.x));
  const pts = dist * 10 + breaks * 480 + hits * 40;
  launchScore = pts; total += pts; best = Math.max(best, pts);
  g.score = total;
  hudPop.s = 1.4; g.tween(hudPop, 's', 1, .34);

  const cx = clamp(SX(maxX), 92, W - 92), cy = clamp(SY(rag[1].y) - 70, 190, H - 280);
  popArc(Math.round(dist / PXM) + ' m', cx, cy, '#ffffff', 30, { vy: -200 });
  popArc('+' + fmt(pts), cx, cy - 40, '#ffd34d', 46, { vy: -250, life: 1.3 });
  if (breaks) popArc('×' + breaks + ' SMASH', cx, cy + 36, '#ff9a3c', 22, { vy: -150 });
  if (chainBest > 3) popArc('BEST CHAIN ' + chainBest, cx, cy - 80, '#bff4ff', 22, { vy: -170 });
  g.popup('+' + fmt(pts), cx, cy - 8, '#ffd34d', 40);
  sfx('ding', { pitch: comboPitch(launch + 2), vol: .6 });
  sfx('coin', { pitch: 1 + launch * .07, vol: .7 });
  g.hitstop(.04); g.shake(6); g.punch(.04);
  if (pts > 0) g.showBanner(breaks > 2 ? 'CARNAGE +' + fmt(pts) : '+' + fmt(pts), 1.2);
  if (chainBest >= 4) sfx('perfect', { pitch: 1.05, vol: .45 });

  launchesLeft--;
  if (launchesLeft <= 0) endBonuses(pts);
  phase = 'rest'; settleT = -1.0;
  g.state = { launch, launches: LAUNCHES, total: Math.round(total) };
}

function nextLaunch() {
  if (launchesLeft <= 0 || total >= WIN) {
    const win = total >= WIN;
    /* a record run gets its own fanfare before the results panel lands */
    if (!recordDone && total > g.best && total > 0) {
      recordDone = true;
      g.showBanner('NEW RECORD!', 2);
      popArc('NEW RECORD', W / 2, H * .3, '#ffd34d', 44, { vy: -80, vx: 0, life: 1.6, g: 60 });
      sfx('unlock', { pitch: 1.02, vol: .85 });
      sfx('fanfare', { pitch: 1.06, vol: .55 });
      confetti(44);
      g.hitstop(.08); g.shake(13); g.flash('#ffe98a', .22); g.punch(.07);
      g.popup('NEW RECORD', W / 2, H * .26, '#ffd34d', 40);
    }
    g.end({ win, score: Math.round(total), label: 'SCORE', progress: clamp(total / WIN, 0, 1) });
    return;
  }
  launch++;
  rag = spawnRagdoll();
  camX = 0; camY = 0; pcamX = 0; pcamY = 0; camVx = 0; camVy = 0;
  phase = 'aim'; aiming = false; chargeT = 0; whineT = 0;
  chain = 0; chainT = 0; chainBest = 0;
  sling.kick = 0; g.cam.scale = 1;
  g.state = { launch, launches: LAUNCHES, total: Math.round(total) };
  announce(launch);
}

/* ------------------------------------------------------------------ ragdoll physics */
function stepRagdoll(dt) {
  if (phase !== 'fly' && phase !== 'rest') return;
  const pts = rag;
  const add = GRAV * dt * dt;
  for (const p of pts) {
    const vx = (p.x - p.px) * .994, vy = (p.y - p.py) * .994;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + add;
  }
  for (let it = 0; it < 5; it++) {
    for (const [a, b, len] of LINKS) {
      const A = pts[a], B = pts[b];
      let dx = B.x - A.x, dy = B.y - A.y;
      let d = Math.hypot(dx, dy) || 1;
      const diff = (d - len) / d * .5;
      dx *= diff; dy *= diff;
      A.x += dx; A.y += dy; B.x -= dx; B.y -= dy;
      /* soft joint limit — keeps limbs flailing instead of folding through the body */
      if (a === 0) { A.x += (B.x - A.x) * .06; A.y += (B.y - A.y) * .06; }
    }
    /* limbs slap into each other: cheap body-on-body contacts, only while the cat is moving */
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (joined(i, j)) continue;
        const A = pts[i], B = pts[j];
        const closing = Math.hypot(A.x - A.px, A.y - A.py) + Math.hypot(B.x - B.px, B.y - B.py);
        if (closing < 3) continue;
        let dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1, min = A.r + B.r;
        if (d >= min) continue;
        const push = (min - d) / d * .34;
        A.x -= dx * push; A.y -= dy * push;
        B.x += dx * push; B.y += dy * push;
        if (it === 4 && closing > 16) bounce((A.x + B.x) / 2, (A.y + B.y) / 2, closing * .45, A, false);
      }
    }
    /* ground */
    for (const p of pts) {
      if (p.y + p.r > GROUND) {
        const sp = Math.abs(p.py - p.y) + Math.abs(p.px - p.x);
        if (sp > 6) bounce(p.x, GROUND, sp, p, true);
        p.y = GROUND - p.r;
        p.py = p.y + (p.py - p.y) * -.28;
        p.px = p.x - (p.x - p.px) * .74;
      }
      if (p.x < 12) { p.x = 12; p.px = p.x + (p.px - p.x) * -.3; }
    }
    /* props */
    for (const pr of props) {
      if (pr.dead) continue;
      for (const p of pts) {
        if (p.x + p.r > pr.x && p.x - p.r < pr.x + pr.w && p.y + p.r > pr.y && p.y - p.r < pr.y + pr.h) {
          const sp = Math.abs(p.py - p.y) + Math.abs(p.px - p.x);
          const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
          const ox = (p.x - cx), oy = (p.y - cy);
          const px = pr.w / 2 + p.r - Math.abs(ox), py = pr.h / 2 + p.r - Math.abs(oy);
          if (px < py) { p.x += Math.sign(ox || 1) * px; p.px = p.x + (p.px - p.x) * -.4; }
          else { p.y += Math.sign(oy || 1) * py; p.py = p.y + (p.py - p.y) * -.35; p.px = p.x - (p.x - p.px) * .82; }
          if (sp > 5) bounce(p.x, p.y, sp, p, true);
          pr.hp -= sp > 26 ? 3 : (sp > 12 ? 1 : 0);
          pr.shake = 1;
          if (pr.hp <= 0 && !pr.dead) breakProp(pr);
        }
      }
    }
  }
  const c = pts[1];
  maxX = Math.max(maxX, c.x);
  /* settle check */
  const speed = pts.reduce((s, p) => s + Math.hypot(p.x - p.px, p.y - p.py), 0);
  if (phase === 'fly') {
    flyT += dt;
    if (speed < 1.8 && c.y > GROUND - 130) settleT += dt; else settleT = 0;
    /* a long lazy roll is boring — bank the launch and move on */
    if (flyT > 5 && settleT < .55) settleT = .56;
    if (settleT > .55) scoreLaunch();
  } else if (phase === 'rest') {
    settleT += dt;
    if (settleT > .95) nextLaunch();
  }
}

/* ------------------------------------------------------------------ aim & charge */
function aimPose(dt) {
  const pts = rag;
  if (g.ptr.down) {
    if (!aiming) { aiming = true; sfx('click', { pitch: 1.15, vol: .45 }); }
    const dx = SLING.x - g.ptr.x, dy = SLING.y - g.ptr.y;
    aimA = Math.atan2(dy, dx);
    aimP = clamp(Math.hypot(dx, dy) / 170, 0, 1);
  } else if (aiming) {
    aiming = false;
    if (aimP > .12) { fire(aimA, aimP); return; }
  }
  if (g.pressed['Space'] || g.pressed['Enter']) { aiming = false; fire(aimA, Math.max(.3, aimP)); return; }
  if (g.keys['ArrowUp']) aimA = clamp(aimA - dt * 1.4, -1.5, -.15);
  if (g.keys['ArrowDown']) aimA = clamp(aimA + dt * 1.4, -1.5, -.15);
  if (g.keys['ArrowRight']) aimP = clamp(aimP + dt * .9, .1, 1);
  if (g.keys['ArrowLeft']) aimP = clamp(aimP - dt * .9, .1, 1);

  /* keep the body pinned in the pouch while you load, and squash it as the pull grows */
  const load = aiming ? aimP : 0;
  const pull = 26 + load * 74;
  const bx = SLING.x - Math.cos(aimA) * pull, by = SLING.y - Math.sin(aimA) * pull;
  const sq = 1 - load * .15;
  pts[1].x = bx; pts[1].y = by;
  pts[0].x = bx + 10 + load * 9; pts[0].y = by - 30 * sq;
  pts[2].x = bx - 8 - load * 5; pts[2].y = by + 28 * sq;
  pts[3].x = bx + 26 + load * 16; pts[3].y = by - 12 + load * 5;
  pts[4].x = bx + 28 + load * 16; pts[4].y = by - 5 + load * 5;
  pts[5].x = bx - 12 - load * 13; pts[5].y = by + 46 * sq;
  pts[6].x = bx - 4 - load * 13; pts[6].y = by + 49 * sq;
  for (const p of pts) { p.px = p.x; p.py = p.y; }

  /* the rising whine + strain sparks at the pouch while you hold the pull */
  if (aiming) {
    chargeT += dt;
    whineT -= dt;
    if (chargeT > .08 && whineT <= 0) {
      whineT = .13;
      sfx('charge', { pitch: .72 + aimP * .8 + Math.min(.35, chargeT * .16), vol: clamp(.16 + aimP * .34, 0, .6) });
      const sx = SX(SLING.x), sy = SY(SLING.y);
      g.fx.dust(sx, sy, 1, { color: 'rgba(255,220,160,.35)', size: 8 + aimP * 8, spread: 10, up: 40 });
      g.fx.emit('spark', sx + rnd(-9, 9), sy + rnd(-7, 7), { vx: rnd(-45, 45), vy: rnd(-110, -35), life: .28, size: 4, color: '#ffd34d', add: true });
    }
    const q = Math.floor(aimP * 4);
    if (q > aimTick) {
      aimTick = q;
      sfx('blip', { pitch: .9 + q * .16, vol: .45 });
      sling.glow = 1; g.tween(sling, 'glow', 0, .22);
      g.shake(1.5 + q);
      if (q === 4) { popArc('MAX', SX(SLING.x), SY(SLING.y) - 96, '#ff5a4d', 24, { vy: -120, vx: 0 }); g.hitstop(.02); }
    }
  }
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;
  sfxCool = Math.max(0, sfxCool - dt);
  chainT = Math.max(0, chainT - dt);
  for (const pr of props) pr.shake = Math.max(0, pr.shake - dt * 3);

  /* countdown ticks at the top of each launch — you can aim straight through it */
  if (countT > -1) {
    countT -= dt;
    const n = countT > 0 ? Math.ceil(countT / .4) : 0;
    if (n !== countN) {
      countN = n;
      if (n > 0) sfx('tick', { pitch: .86 + (3 - n) * .16, vol: .5 });
      else { sfx('drum', { pitch: 1.1, vol: .55 }); g.punch(.022); g.shake(2); }
    }
  }

  if (g.mode === 'play') {
    stepRagdoll(dt);

    if (phase === 'aim') {
      if (g.mode === 'play') g.cam.scale = 1;
      aimPose(dt);
    }

    /* bot */
    if (isAuto && phase === 'aim') {
      if (dumb()) dry += dt;                 // real seconds, not one tick per 0.45s
      botT -= dt;
      if (botT <= 0) {
        botT = .45;
        if (dumb()) {
          if (dry > .9) { dry = 0; fire(-Math.PI / 2 + rnd(-.14, .14), rnd(.05, .14)); }
        } else {
          if (aimA > -0.8) aimA = -0.8; else aimA = -0.78;
          aimP = 1;
          fire(aimA, 1);
        }
      }
    }
  }

  /* camera follows the cat, with a lead based on how fast it is travelling */
  pcamX = camX; pcamY = camY;
  const lead = clamp((rag[1].x - rag[1].px) * 9, -60, 90);
  const tx = phase === 'aim' ? 0 : clamp(rag[1].x - 210 + lead, 0, 1e6);
  const ty = phase === 'aim' ? 0 : clamp(rag[1].y - 420, -180, 0);
  camX = damp(camX, tx, 5, dt);
  camY = damp(camY, ty, 4, dt);
  camVx = dt > 0 ? (camX - pcamX) / dt : 0;
  camVy = dt > 0 ? (camY - pcamY) / dt : 0;

  if (g.mode === 'play') {
    g.state = { launch, launches: LAUNCHES, total: Math.round(total), phase };
    g.score = Math.round(total);
  }
}

/* ------------------------------------------------------------------ draw */
function drawSky(ctx) {
  g.sky(ctx, ['#120b26', '#241540', '#3d2454', '#6b3d5c'], { glow: 'rgba(255,150,90,.22)', gy: .58, gr: 1.2 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of STARS) {
    ctx.globalAlpha = .2 + .5 * Math.abs(Math.sin(t * 1.3 + s.p));
    ctx.fillStyle = '#fff';
    ctx.fillRect((s.x - camX * .04 + W * 4) % W, s.y - camY * .1, s.s, s.s);
  }
  ctx.restore(); ctx.globalAlpha = 1;
  const mx = 430 - camX * .03, my = 130 - camY * .08;
  const mg = ctx.createRadialGradient(mx, my, 8, mx, my, 130);
  mg.addColorStop(0, 'rgba(255,240,200,.30)'); mg.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 130, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(mx, my, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(220,200,160,.45)'; ctx.beginPath(); ctx.arc(mx - 10, my - 8, 7, 0, TAU); ctx.arc(mx + 9, my + 7, 5, 0, TAU); ctx.fill();
}

function drawHills(ctx) {
  for (const L of PARALLAX) {
    ctx.fillStyle = L.col; ctx.beginPath(); ctx.moveTo(-120, H + 120);
    for (let x = -120; x <= W + 120; x += 22) {
      const wx = x + camX * L.sp, wy = L.base - camY * L.sp + Math.sin(wx * L.f) * L.amp + Math.sin(wx * L.f * 2.6) * L.amp * .38;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W + 120, H + 120); ctx.closePath(); ctx.fill();
  }
}

function drawGround(ctx) {
  const gy = SY(GROUND);
  const gg = ctx.createLinearGradient(0, gy, 0, H + 200);
  gg.addColorStop(0, '#2b1f3a'); gg.addColorStop(.35, '#1b1328'); gg.addColorStop(1, '#0a0712');
  ctx.fillStyle = gg; ctx.fillRect(-140, gy, W + 280, H + 340 - gy);
  ctx.strokeStyle = 'rgba(255,180,120,.4)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-140, gy); ctx.lineTo(W + 140, gy); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,180,120,.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-140, gy + 8); ctx.lineTo(W + 140, gy + 8); ctx.stroke();
  /* distance tape every 500px — reads out in metres */
  for (let m = 0; m < 6000; m += 500) {
    const x = SX(SLING.x + m);
    if (x < -60 || x > W + 60) continue;
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, gy + 4, 3, m % 1000 === 0 ? 26 : 14);
    if (m % 1000 === 0) g.text(m / PXM + 'm', x, gy + 52, { size: 16, align: 'center', stroke: 3, color: 'rgba(255,255,255,.30)' });
  }
}

function drawProps(ctx) {
  for (const pr of props) {
    if (pr.dead) continue;
    const x = SX(pr.x), y = SY(pr.y);
    if (x < -160 || x > W + 160) continue;
    const sh = pr.shake > 0 ? (Math.random() - .5) * pr.shake * 7 : 0;
    ctx.save(); ctx.translate(x + pr.w / 2 + sh, y + pr.h / 2); ctx.rotate(pr.rot * .3);
    const base = pr.type === 'crate' ? '#b87a44' : pr.type === 'bin' ? '#3f8f5a' : '#7b8695';
    shadow(ctx, 0, pr.h / 2 + 6, pr.w * .5, pr.h * .16, .3);
    ctx.fillStyle = hexA(base, .35); rr(ctx, -pr.w / 2 - 5, -pr.h / 2 - 5, pr.w + 10, pr.h + 10, 11); ctx.fill();
    ctx.fillStyle = base; rr(ctx, -pr.w / 2, -pr.h / 2, pr.w, pr.h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.20)'; rr(ctx, -pr.w / 2 + 6, -pr.h / 2 + 6, pr.w - 12, 10, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3; rr(ctx, -pr.w / 2, -pr.h / 2, pr.w, pr.h, 8); ctx.stroke();
    if (pr.hp < 2) {
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-pr.w * .3, -pr.h * .3); ctx.lineTo(-pr.w * .05, 0); ctx.lineTo(-pr.w * .2, pr.h * .32); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSling(ctx) {
  const x = SX(SLING.x), y = SY(SLING.y), gy = SY(GROUND);
  shadow(ctx, x, gy + 4, 36, 9, .3);
  ctx.strokeStyle = '#5a3c26'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, y + 14); ctx.stroke();
  ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x - 28, y + 8); ctx.lineTo(x, y - 10); ctx.lineTo(x + 28, y + 8); ctx.stroke();

  if (phase === 'aim' && aimP > .05) {
    const rad = 26 + aimP * 76 + Math.sin(t * 17) * 6;
    const cc = aimP > .8 ? '255,90,77' : aimP > .5 ? '255,211,77' : '125,255,125';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(x, y, 2, x, y, rad);
    rg.addColorStop(0, `rgba(${cc},${.30 + aimP * .35})`); rg.addColorStop(1, `rgba(${cc},0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* the band stretches to the cat's hands */
  const hx = (SX(rag[3].x) + SX(rag[4].x)) / 2, hy = (SY(rag[3].y) + SY(rag[4].y)) / 2;
  const stretch = clamp(Math.hypot(hx - x, hy - y) / 100, 0, 1.3);
  ctx.strokeStyle = '#ff6b9d'; ctx.lineWidth = Math.max(2.5, 5 - stretch * 1.6);
  ctx.beginPath(); ctx.moveTo(x - 24, y + 6); ctx.quadraticCurveTo((x - 24 + hx) / 2, (y + 6 + hy) / 2 + 12, hx, hy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 24, y + 6); ctx.quadraticCurveTo((x + 24 + hx) / 2, (y + 6 + hy) / 2 + 12, hx, hy); ctx.stroke();

  /* whip-crack streak for a few frames after release */
  if (sling.kick > .02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,240,200,${sling.kick * .85})`;
    ctx.lineWidth = 2 + sling.kick * 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, 34 + (1 - sling.kick) * 90, -1.5, .9); ctx.stroke();
    ctx.restore();
  }
}

function drawAim(ctx) {
  if (phase !== 'aim') return;
  const v = 300 + aimP * 1350;
  const ox = SX(SLING.x), oy = SY(SLING.y) - 18;
  ctx.save();
  let land = null;
  for (let i = 1; i <= 30; i++) {
    const tt = i * .05;
    const px = ox + Math.cos(aimA) * v * tt;
    const py = oy + Math.sin(aimA) * v * tt + .5 * GRAV * tt * tt;
    if (py > SY(GROUND)) { land = { x: px, d: Math.cos(aimA) * v * tt }; break; }
    ctx.globalAlpha = .72 - i * .02;
    ctx.fillStyle = aimP > .8 ? '#ff9a3c' : '#ffd34d';
    ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, 4.6 - i * .1), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (land) {
    const pulse = 1 + Math.sin(t * 8) * .1;
    ctx.strokeStyle = 'rgba(255,211,77,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(land.x, SY(GROUND) + 2, 16 * pulse, 6 * pulse, 0, 0, TAU); ctx.stroke();
    g.text(Math.round(land.d / PXM) + 'm', land.x, SY(GROUND) - 16, { size: 18, align: 'center', stroke: 3, color: 'rgba(255,255,255,.75)' });
  }
  /* power meter */
  const pw = 108;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, ox - pw / 2, oy + 44, pw, 13, 7); ctx.fill();
  const bar = ctx.createLinearGradient(ox - pw / 2, 0, ox + pw / 2, 0);
  bar.addColorStop(0, '#7dff7d'); bar.addColorStop(.55, '#ffd34d'); bar.addColorStop(1, '#ff5a4d');
  ctx.fillStyle = bar; rr(ctx, ox - pw / 2, oy + 44, pw * aimP, 13, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5; rr(ctx, ox - pw / 2, oy + 44, pw, 13, 7); ctx.stroke();
  for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(ox - pw / 2 + pw * i / 4, oy + 44, 1.5, 13); }
  g.text(Math.round(aimP * 100) + '%', ox, oy + 82, { size: 20, align: 'center', stroke: 4, color: 'rgba(255,255,255,.75)' });
  ctx.restore();
}

function drawRagdoll(ctx) {
  const pts = rag;
  const X = i => SX(pts[i].x), Y = i => SY(pts[i].y);
  const limb = (a, b, wid, col) => {
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = wid + 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = wid;
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
  };

  /* motion trails: every joint leaves a smear behind it when it is flying */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of pts) {
    const sp = Math.hypot(p.x - p.px, p.y - p.py);
    if (sp < 4) continue;
    ctx.strokeStyle = hexA(p.kind === 'head' ? '#ffd34d' : '#ff9a3c', clamp(sp / 55, 0, .5));
    ctx.lineWidth = p.r * (1.4 + clamp(sp / 40, 0, 1));
    ctx.beginPath(); ctx.moveTo(SX(p.x), SY(p.y));
    ctx.lineTo(SX(p.x - (p.x - p.px) * 2.2), SY(p.y - (p.y - p.py) * 2.2));
    ctx.stroke();
  }
  ctx.restore();

  const dk = '#d9782f', lt = '#ffb066';
  shadow(ctx, X(1), SY(GROUND) + 2, 26, 7, .26);

  limb(1, 3, 8, dk); limb(1, 4, 8, dk);
  limb(2, 5, 9, dk); limb(2, 6, 9, dk);

  /* tail lags the hips */
  const tx = X(2) - 26 + Math.sin(t * 6) * 8, ty = Y(2) - 16 + Math.cos(t * 5) * 10;
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 11; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(2), Y(2)); ctx.quadraticCurveTo(X(2) - 24, Y(2) + 18, tx, ty); ctx.stroke();
  ctx.strokeStyle = lt; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(X(2), Y(2)); ctx.quadraticCurveTo(X(2) - 24, Y(2) + 18, tx, ty); ctx.stroke();

  /* torso */
  const ang = Math.atan2(Y(2) - Y(1), X(2) - X(1));
  ctx.save(); ctx.translate((X(1) + X(2)) / 2, (Y(1) + Y(2)) / 2); ctx.rotate(ang + Math.PI / 2);
  ctx.fillStyle = '#ff9a3c'; rr(ctx, -15, -27, 30, 54, 15); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, -15, -27, 30, 17, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3; rr(ctx, -15, -27, 30, 54, 15); ctx.stroke();
  ctx.restore();

  /* head — the face wobbles while it tumbles */
  ctx.save(); ctx.translate(X(0), Y(0)); ctx.rotate(Math.atan2(Y(0) - Y(1), X(0) - X(1)) + Math.PI / 2);
  const gag = phase === 'fly' ? Math.sin(t * 22) * .3 : 0;
  face(ctx, 'cat', 0, 0, 16 * 1.15, '#ff9a3c');
  ctx.fillStyle = '#3a1e10'; ctx.beginPath(); ctx.arc(-5, 1, 2.4, 0, TAU); ctx.arc(5, 1, 2.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a1e10'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, 6, 4, .25 + gag, Math.PI - .25 + gag); ctx.stroke();
  ctx.restore();

  /* dizzy stars when the head is really moving */
  const hsp = Math.hypot(pts[0].x - pts[0].px, pts[0].y - pts[0].py);
  if (phase === 'fly' && hsp > 12) {
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + i * TAU / 3;
      g.fx.emit('glow', X(0) + Math.cos(a) * 22, Y(0) - 6 + Math.sin(a) * 9, { life: .24, size: 12, color: '#ffe98a', add: true });
    }
  }
}

function drawFloats(ctx) {
  ctx.save();
  for (const f of FLOAT) {
    const u = f.t / f.life;
    const sc = 1 + Math.max(0, .3 - u) * 1.8;
    ctx.globalAlpha = u < .72 ? 1 : clamp((1 - u) / .28, 0, 1);
    g.text(f.text, f.x, f.y, { size: f.size * sc, color: f.color, align: 'center', stroke: Math.max(4, f.size * .17) });
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawHUD(ctx) {
  g.text('RAGDOLL LAUNCH', 26, 58, { size: 34, stroke: 6 });
  g.text('LAUNCH ' + launch + ' / ' + LAUNCHES, 26, 88, { size: 20, stroke: 4, color: 'rgba(255,255,255,.62)' });

  /* goal bar */
  const bw = W - 52;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, 26, 100, bw, 14, 7); ctx.fill();
  const frac = clamp(total / WIN, 0, 1);
  const cg = ctx.createLinearGradient(26, 0, 26 + bw, 0);
  cg.addColorStop(0, '#7dff7d'); cg.addColorStop(.6, '#ffd34d'); cg.addColorStop(1, '#ff5a4d');
  ctx.fillStyle = cg; rr(ctx, 26, 100, Math.max(3, bw * frac), 14, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; rr(ctx, 26, 100, bw, 14, 7); ctx.stroke();

  /* score chip, popping on every payout */
  ctx.save(); ctx.translate(W - 30, 156); ctx.scale(hudPop.s, hudPop.s);
  g.text(fmt(total), 0, 0, { size: 44, align: 'right', stroke: 6 });
  ctx.restore();
  g.text('GOAL ' + fmt(WIN), W - 30, 182, { size: 18, align: 'right', stroke: 4, color: 'rgba(255,255,255,.5)' });

  /* distance so far */
  const m = Math.round(Math.max(0, maxX - SLING.x) / PXM);
  g.text(m + ' m', 28, 156, { size: 30, stroke: 5, color: '#ffd34d' });
  if (chain > 1) g.text('CHAIN ×' + chain, 28, 186, { size: 18, stroke: 4, color: '#bff4ff' });

  /* launch countdown */
  if (phase === 'aim' && countT > -.55) {
    const n = countT > 0 ? Math.ceil(countT / .4) : 0;
    const u = n > 0 ? 1 - ((countT - (n - 1) * .4) / .4) : 1 + (-countT / .55);
    const sc = 1.3 - .3 * clamp(u, 0, 1);
    ctx.save(); ctx.globalAlpha = clamp(1.25 - u * .7, 0, 1);
    ctx.translate(W / 2, 300); ctx.scale(sc, sc);
    g.text(n > 0 ? String(n) : 'FLING!', 0, 0, { size: n > 0 ? 104 : 72, align: 'center', color: n > 0 ? '#ffd34d' : '#7dff7d' });
    ctx.restore(); ctx.globalAlpha = 1;
  }

  if (phase === 'aim') g.text('DRAG BACK TO LOAD  ·  RELEASE TO FLY', W / 2, H - 34, { size: 19, align: 'center', stroke: 4, color: 'rgba(255,255,255,.55)' });
  else if (phase === 'rest') g.text('NEXT LAUNCH…', W / 2, H - 34, { size: 19, align: 'center', stroke: 4, color: 'rgba(255,255,255,.45)' });
}

function draw() {
  const ctx = g.ctx;
  /* the simulation is stepped at a fixed 1/60; floats get real time so they keep arcing on the results screen */
  const now = performance.now() / 1000;
  const dd = Math.min(.05, Math.max(0, now - (draw._n || now - .016)));
  draw._n = now;
  stepFloats(dd);

  drawSky(ctx);
  drawHills(ctx);
  drawGround(ctx);
  drawProps(ctx);
  drawSling(ctx);
  drawAim(ctx);
  drawRagdoll(ctx);

  /* speed lines while the cat is really moving */
  const sp = Math.hypot(rag[1].x - rag[1].px, rag[1].y - rag[1].py);
  if (phase === 'fly' && sp > 13) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const y = ((i * 137 + t * 900) % (H + 100)) - 50;
      const len = 40 + (i % 3) * 60;
      ctx.strokeStyle = `rgba(255,240,200,${.05 + clamp(sp / 260, 0, .13)})`;
      ctx.lineWidth = 2 + (i % 2);
      ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(len, y + 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawFloats(ctx);
  drawHUD(ctx);
}

resetWorld();
g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ phase, total: Math.round(total), launch, launchesLeft, maxX: Math.round(maxX), breaks, chain: chainBest, aimP, aimA: +aimA.toFixed(2) });

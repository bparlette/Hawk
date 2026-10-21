// SPIDER DROP — spider-drop (Cat Arcade v2) — Halloween reskin of rope-cut
// ONE mechanic: swipe to slice the spider webs so the swinging candy drops into the trick-or-treat bucket.
// Five levels, spiders you must NOT cut, combos for stringing candy together, one very greedy bucket.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, damp, rnd, ri, chance, R, TAU,
  rr, panel, hexA, starPath, heartPath,
} from '../_vendor/gp2x.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'spider-drop', title: 'SPIDER DROP', sub: 'CUT THE WEBS · FILL THE BUCKET',
  hook: 'five levels, one bottomless bucket', w: W, h: H, bg: '#120a24',
  bloom: .8, ca: .3, vig: 1, scan: .12,
});

/* ------------------------------------------------------------------ tuning */
const GRAV = 1560;            // falling snack gravity
const PEND = 1450;            // pendulum stiffness (period ≈ 2.5 s at L=240)
const ANCHOR_Y = 210;
const CATCH_Y = 836;          // the mouth line
const CATCH_R = 66;           // how wide the mouth actually is
const FLOOR_Y = 906;
const CAT_SPEED = 400;
const MISS_COST = 1.6;        // seconds burned per dropped snack
const BOMB_COST = 2.6;        // seconds burned per exploded bomb

const LEVELS = [
  { spawn: 4, bombs: 1, need: 3, time: 9.5 },
  { spawn: 5, bombs: 1, need: 3, time: 9.5 },
  { spawn: 6, bombs: 2, need: 4, time: 10 },
  { spawn: 7, bombs: 2, need: 5, time: 10 },
  { spawn: 8, bombs: 3, need: 5, time: 11 },
];
const TREATS = ['corn', 'bar', 'pop', 'gum', 'wrap'];
const TREAT_COL = {
  corn: { body: '#ff8c1a', dark: '#ffd34d', light: '#fff6e8' },   // candy corn
  bar: { body: '#8a4a22', dark: '#4a2410', light: '#c98a4a' },    // chocolate bar
  pop: { body: '#b04ad8', dark: '#6a1e9c', light: '#e8b8ff' },    // lollipop
  gum: { body: '#3ddc68', dark: '#1a8a3c', light: '#c8ffd8' },    // gumball
  wrap: { body: '#ff3d5c', dark: '#a01028', light: '#ffb8c4' },   // wrapped candy
};

const isAuto = g.auto;
const QP = new URLSearchParams(location.search);
const isDumb = () => isAuto && QP.has("dumb");

/* ------------------------------------------------------------------ world state */
const ropes = [];       // hanging snacks
const fall = [];        // snacks in free fall
const stubs = [];       // the severed rope ends still twanging
const cuts = [];        // fading bright cut lines
const motes = [];       // background dust
const lanterns = [];

let lvl = 0, lvlT = 0, caught = 0, needs = 3, spawnLeft = 0, score = 0, misses = 0;
let combo = 0, comboT = 0, status = 'play', trans = 0, hintT = 0, frame = 0, shakeT = 0;
let botT = 0, autoT = 0, dumbCut = 0;

const cat = { x: 270, dir: 1, mouth: 0, chomp: 0, hurt: 0, bob: 0, lean: 0, gloat: 0 };
let px = null, py = null;     // previous swipe point
const cursor = { x: 270, y: 470 };   // keyboard blade

/* ------------------------------------------------------------------ scenery (built once) */
const BLD = [];
for (let i = 0; i < 14; i++) {
  const w = 30 + R() * 56, x = -40 + i * 44 + R() * 10;
  BLD.push({ x, w, h: 90 + R() * 150, seed: R() * 99 });
}
const STARS = Array.from({ length: 54 }, () => ({ x: R() * W, y: R() * 420, s: .6 + R() * 1.5, p: R() * TAU }));
for (let i = 0; i < 8; i++) lanterns.push({ x: 34 + i * 68, y: 92 + Math.sin(i * 1.3) * 22, s: .8 + R() * .5, p: R() * TAU, c: i % 2 ? '#ff8c1a' : '#b04ad8' });
for (let i = 0; i < 26; i++) motes.push({ x: R() * W, y: 220 + R() * 700, s: .8 + R() * 2.2, p: R() * TAU, sp: 8 + R() * 26 });

/* ------------------------------------------------------------------ reset */
function resetWorld() {
  ropes.length = 0; fall.length = 0; stubs.length = 0; cuts.length = 0;
  cat.x = 270; cat.dir = 1; cat.mouth = 0; cat.chomp = 0; cat.hurt = 0; cat.bob = 0; cat.gloat = 0;
  px = null; py = null; botT = 0; autoT = 0; dumbCut = 0; hintT = 0; frame = 0;
  g.score = 0; score = 0;
  g.combo.reset(); g.fx.clear();
  buildLevel(0);
  g.hud.hint = 'swipe across a web to cut it';
}
g.onReset = resetWorld;
g.onStart = () => music('action');
resetWorld();

/* ------------------------------------------------------------------ levels */
function buildLevel(i) {
  lvl = i;
  const L = LEVELS[i];
  ropes.length = 0; fall.length = 0; stubs.length = 0; cuts.length = 0;
  caught = 0; misses = 0; needs = L.need; spawnLeft = L.spawn; status = 'play'; trans = 0;
  lvlT = L.time; combo = 0; comboT = 0;
  const n = L.spawn + L.bombs;
  const bombAt = [];
  while (bombAt.length < L.bombs) { const k = ri(1, n - 1); if (!bombAt.includes(k)) bombAt.push(k); }
  for (let k = 0; k < n; k++) {
    const gold = k % 4 === 3 && !bombAt.includes(k);
    const kind = TREATS[k % TREATS.length];
    const spread = n > 1 ? k / (n - 1) : .5;
    ropes.push({
      ax: 74 + spread * 392 + rnd(-10, 10),
      ay: ANCHOR_Y + (k % 3) * 26,
      len: 175 + ((k * 3) % 5) * 34 + rnd(-10, 14),
      ang: rnd(-1.05, 1.05),
      av: rnd(-.6, .6),
      ph: R() * TAU,
      bomb: bombAt.includes(k),
      kind, gold,
      r: gold ? 31 : 25 + (k % 3) * 2,
      tx: 0, ty: 0, rot: 0,
      dead: false,
    });
  }
  g.state = { level: i + 1, levels: LEVELS.length, caught, need: needs, left: lvlT, score: Math.round(score), status };
  g.showBanner(`LEVEL ${i + 1}`, .9);
}

function ropeGeo(r) {
  const s = Math.sin(r.ang), c = Math.cos(r.ang);
  r.tx = r.ax + s * r.len;
  r.ty = r.ay + c * r.len;
  r.rot = -r.ang;
}

/* ------------------------------------------------------------------ slicing */
/** true if segment AB crosses segment CD; returns param along AB or -1 */
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-7) return -1;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
  const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : -1;
}

/** the one code path every blade stroke takes — swipes, taps and the bot all come here */
function juice(x, y, o = {}) {
  const k = o.s ?? 1, c = o.c || '#ffe9a8';
  g.burst(x, y, 5 + k * 9, { color: [c, '#ffffff'], speed: 150 + k * 160, life: .4 + k * .3, size: 4 + k * 3 });
  g.fx.emit(k > 1.6 ? 'ring' : 'spark', x, y, { size: 12 + k * 16, life: .3, color: c, add: true, wide: 4 });
  if (k > .6) { g.shake(1.5 + k * 4); g.punch(.02 + .012 * k); }
  if (o.h) g.hitstop(.02 + .02 * k);
  if (o.p) g.popup(o.p, x, y - 34 - k * 10, c, 22 + k * 8);
  if (o.f) g.flash(c, .08 + .04 * k);
}
function slash(x1, y1, x2, y2, strong) {
  if (status !== 'play') return;
  let hitAny = false;
  for (let i = ropes.length - 1; i >= 0; i--) {
    const r = ropes[i];
    if (r.dead) continue;
    const u = segCross(x1, y1, x2, y2, r.ax, r.ay, r.tx, r.ty);
    if (u < 0) continue;
    /* the cut point on the rope, in world space */
    const cx = r.ax + (r.tx - r.ax) * u, cy = r.ay + (r.ty - r.ay) * u;
    const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    sever(r, u, cx, cy, a, strong);
    hitAny = true;
  }
  if (!hitAny) {
    /* a whiff is still feedback: a quick air-slice glint */
    cuts.push({ x1, y1, x2, y2, t: 0, life: .16, a: .5, w: 4 });
    sfx('whoosh', { pitch: 1.4, vol: .28 });
  }
}

function sever(r, u, cx, cy, ang, strong) {
  r.dead = true;
  ropes.splice(ropes.indexOf(r), 1);
  ropeGeo(r);

  /* the bright cut line + sparks at the exact cut point */
  const half = 34 + (strong ? 16 : 0);
  cuts.push({ x1: cx - Math.cos(ang) * half, y1: cy - Math.sin(ang) * half, x2: cx + Math.cos(ang) * half, y2: cy + Math.sin(ang) * half, t: 0, life: .34, a: 1, w: 9 });
  g.fx.burst(cx, cy, 14, { kind: 'spark', color: ['#ffffff', '#bff4ff', r.bomb ? '#ffb06a' : '#ffe9a8'], speed: 330, life: .34, size: 6, g: 320 });
  g.fx.emit('ring', cx, cy, { size: 52, color: '#dff6ff', life: .26, add: true, wide: 4 });
  g.fx.burst(cx, cy, 5, { kind: 'dot', color: '#7a5a3a', speed: 130, life: .5, size: 5, g: 900 });

  /* the severed end stays hanging and twangs */
  stubs.push({ ax: r.ax, ay: r.ay, len: r.len * u, ang: r.ang, av: r.av * .9 - Math.sign(r.av || 1) * .6, t: 0 });
  sfx('slice', { pitch: 1.05 + (combo % 6) * .05 });
  sfx('snap', { pitch: .92 + (combo % 5) * .07, vol: .55 });
  g.punch(.03);
  juice(cx, cy, { s: strong ? 1.5 : 1, c: strong ? '#ffe9a8' : '#bffcff', h: strong ? 1 : 0, p: strong ? 'SLICE!' : '' });

  if (r.bomb) { bombGoesOff(r); return; }

  comboT = 1.25;
  combo++;
  const vx = Math.cos(r.ang) * r.len * r.av;
  const vy = -Math.sin(r.ang) * r.len * r.av;
  fall.push({
    x: r.tx, y: r.ty, vx: vx * .85 + rnd(-30, 30), vy: vy * .6 - 40,
    r: r.r, kind: r.kind, gold: r.gold, rot: r.rot, vr: (vx > 0 ? 1 : -1) * (2 + R() * 3),
    rope: Math.min(r.len * (1 - u), 46), dead: false, t: 0,
  });
}

function bombGoesOff(r) {
  g.fx.blast(r.tx, r.ty, { r: 150, color: '#ff7a3c', colors: ['#ffd34d', '#ff6b3c', '#fff'], n: 34, punch: .18, shake: 24, flashC: '#ff5a2c', flashA: .45, life: .55 });
  sfx('boom', { pitch: .88 });
  sfx('explode', { pitch: 1.1, vol: .5 });
  g.hitstop(.1);
  g.combo.miss();
  combo = 0;
  cat.hurt = 1;
  lvlT -= BOMB_COST;
  g.popup(`-${BOMB_COST.toFixed(1)}s`, r.tx, r.ty - 30, '#ff6b6b', 40);
  g.showBanner('SPIDER!', .75);
  for (let i = 0; i < 8; i++) g.fx.emit('smoke', r.tx + rnd(-50, 50), r.ty + rnd(-30, 30), { vx: rnd(-90, 90), vy: -40 - R() * 90, g: -30, life: 1.1, size: 26 + R() * 22, color: '#38303c', drag: .6 });
  if (lvlT <= 0) lose();
}

/* ------------------------------------------------------------------ catching */
function catchSnack(f) {
  f.dead = true;
  caught++;
  cat.chomp = 1; cat.mouth = 1; cat.gloat = 1;
  cat.dir = f.x < cat.x ? -1 : 1;

  const val = Math.round((f.gold ? 300 : 100) * g.combo.mult);
  score += val;
  g.score = score;
  g.combo.hit(cat.x + cat.dir * 30, CATCH_Y - 40, `+${val}`);
  if (f.gold) { sfx('perfect', { pitch: 1.3 }); g.showBanner('GOLDEN!', .6); }

  g.impact(cat.x, CATCH_Y, { punch: .06, shake: 6, stop: .028, rip: 1 });
  juice(cat.x + cat.dir * 30, CATCH_Y - 40, { s: f.gold ? 2 : 1.1, c: f.gold ? '#ffd34d' : '#ffe9a8', f: f.gold, p: f.gold ? 'GOLDEN!' : '' });
  const cols = f.gold ? ['#ffe98a', '#ffd34d', '#fff'] : [TREAT_COL[f.kind].body, TREAT_COL[f.kind].light, '#fff'];
  g.fx.burst(cat.x + cat.dir * 26, CATCH_Y, f.gold ? 26 : 16, { kind: 'spark', color: cols, speed: 340, life: .5, size: 7, g: 700 });
  g.fx.burst(cat.x + cat.dir * 26, CATCH_Y, 4, { kind: 'heart', color: '#ff8fb0', speed: 150, life: .8, size: 11, g: -140 });
  sfx('pop', { pitch: 1.1 + (combo % 7) * .05 });
  sfx('coin', { pitch: comboPitch(Math.min(combo, 10)) * .9, vol: .7 });
  if (combo === 1) sfx('meow', { pitch: 1.15, vol: .5 });

  if (combo > 0 && combo % 3 === 0) {
    g.fx.emit('ring', cat.x, CATCH_Y, { size: 96, color: '#ffe98a', life: .4, add: true, wide: 6 });
    sfx('ding', { pitch: 1.2 + combo * .04 });
  }
  if (caught >= needs) levelClear();
}

function missSnack(f) {
  f.dead = true;
  misses++;
  combo = 0;
  g.combo.miss();
  lvlT -= MISS_COST;
  g.popup(`MISS -${MISS_COST.toFixed(1)}s`, clamp(f.x, 70, 470), FLOOR_Y - 40, '#ff9a6a', 30);
  juice(clamp(f.x, 70, 470), FLOOR_Y - 40, { s: 1.2, c: '#ff9a6a', f: 1 });
  g.fx.dust(f.x, FLOOR_Y, 7, { color: 'rgba(255,220,190,.5)', size: 15, speed: 120 });
  g.fx.burst(f.x, FLOOR_Y, 8, { kind: 'dot', color: TREAT_COL[f.kind].body, speed: 200, life: .5, size: 6, g: 800 });
  sfx('thud', { pitch: .8 });
  sfx('groan', { pitch: 1.3, vol: .3 });
  g.shake(7);
  cat.hurt = .8;
  if (lvlT <= 0) lose();
}

/* ------------------------------------------------------------------ terminal paths */
function levelClear() {
  if (status !== 'play') return;
  status = 'clear';
  trans = 0;
  sfx('fanfare');
  sfx('win', { pitch: 1.1, vol: .4 });
  g.showBanner(`LEVEL ${lvl + 1} CLEAR`, 1);
  g.slowmo(.5, .6);
  g.impact(cat.x, CATCH_Y - 20, { punch: .12, shake: 10, flash: '#ffe9a8', flashA: .22 });
  juice(W / 2, CATCH_Y - 60, { s: 2, c: '#ffe9a8', p: `LEVEL ${lvl + 1} CLEAR`, f: 1 });
  for (let k = 0; k < 4; k++) {
    g.fx.burst(90 + k * 120, 320 + (k % 2) * 90, 18, { kind: 'confetti', color: ['#ffd34d', '#ff7a3c', '#7dff9b', '#7df9ff', '#ff8fb0'], speed: 300, life: 1.4, size: 8, g: 430 });
  }
  g.fx.burst(cat.x, CATCH_Y - 30, 10, { kind: 'heart', color: '#ff8fb0', speed: 220, life: 1, size: 13, g: -120 });
  for (const r of ropes) { r.dead = true; }
  ropes.length = 0;
}

function winGame() {
  if (status === 'over') return;
  status = 'over';
  g.score = score;
  g.end({ win: true, score: Math.round(score), label: 'SCORE', progress: 1 });
}

function lose() {
  if (status === 'over') return;
  status = 'over';
  lvlT = 0;
  g.score = score;
  g.combo.miss();
  g.fx.burst(cat.x, CATCH_Y, 12, { kind: 'smoke', color: 'rgba(120,140,180,.5)', speed: 80, life: 1, size: 22, g: -20 });
  sfx('groan', { pitch: .8 });
  g.shake(18); g.flash('#ff6b6b', .3); juice(cat.x, CATCH_Y, { s: 2.6, c: '#ff6b6b', f: 1, p: 'GAME OVER' });
  const prog = clamp((lvl + clamp(caught / needs, 0, 1)) / LEVELS.length, 0, .99);
  g.end({ win: false, score: Math.round(score), label: 'SCORE', progress: prog });
}

/* ------------------------------------------------------------------ bot (?auto=1) */
function botThink(dt) {
  botT -= dt;
  if (status !== 'play') return;
  if (botT > 0) return;
  ropeGeoCheck();
  if (isDumb()) {
    /* dumb: swings wildly, loves bombs, never aims — the video's fail state */
    botT = .16;
    let pick = null;
    for (const r of ropes) if (r.bomb && !r.dead) { pick = r; break; }
    if (!pick && ropes.length) pick = ropes[ri(0, ropes.length - 1)];
    if (!pick) return;
    const m = .5;
    const mx = pick.ax + (pick.tx - pick.ax) * m, my = pick.ay + (pick.ty - pick.ay) * m;
    slash(mx - 40, my - 40, mx + 40, my + 40, true);
    return;
  }
  /* honest: cut the non-bomb snack that is closest to the mouth, at the calm point of its swing */
  botT = .09;
  let best = null, bestScore = 1e9;
  for (const r of ropes) {
    if (r.bomb) continue;
    const calm = Math.abs(r.av);
    const near = Math.abs((r.tx) - cat.x) / 90;
    const s = calm * 2.4 + near + (r.ty > 470 ? -.5 : 0);
    if (s < bestScore) { bestScore = s; best = r; }
  }
  if (!best) return;
  const m = .45 + (bestScore % .2);
  const mx = best.ax + (best.tx - best.ax) * m, my = best.ay + (best.ty - best.ay) * m;
  slash(mx - 46, my - 46, mx + 46, my + 46, true);
}
function ropeGeoCheck() { for (const r of ropes) ropeGeo(r); }

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode !== 'play') return;
  frame++;
  hintT += dt;
  if (status === 'over') return;

  /* ---------- input: pointer swipe ---------- */
  if (g.ptr.down) {
    if (px !== null) {
      const d = Math.hypot(g.ptr.x - px, g.ptr.y - py);
      if (d > 6) { slash(px, py, g.ptr.x, g.ptr.y, d > 60); px = g.ptr.x; py = g.ptr.y; }
    } else { px = g.ptr.x; py = g.ptr.y; }
  } else { px = null; py = null; }

  /* taps are a merciful mini-blade: aim straight at a rope */
  for (let k = 0; k < g.taps.length; k++) {
    const t = g.taps[k];
    for (let i = 0; i < ropes.length; i++) {
      const r = ropes[i];
      if (r.dead) continue;
      const d = segDist(r.ax, r.ay, r.tx, r.ty, t.x, t.y);
      if (d < 26) { slash(r.ax, r.ay, r.tx, r.ty, false); break; }
    }
    g.fx.burst(t.x, t.y, 3, { kind: 'dot', color: '#bff4ff', speed: 90, life: .25, size: 4, g: 0 });
  }

  /* ---------- keyboard blade ---------- */
  const sp = 460 * dt;
  if (g.keys.ArrowLeft || g.keys.KeyA) cursor.x -= sp;
  if (g.keys.ArrowRight || g.keys.KeyD) cursor.x += sp;
  if (g.keys.ArrowUp || g.keys.KeyW) cursor.y -= sp;
  if (g.keys.ArrowDown || g.keys.KeyS) cursor.y += sp;
  cursor.x = clamp(cursor.x, 20, W - 20); cursor.y = clamp(cursor.y, 240, 880);
  if (g.pressed.Space || g.pressed.Enter || g.pressed.KeyJ) {
    /* the keyboard blade is a horizontal stroke through the cursor */
    slash(cursor.x - 120, cursor.y, cursor.x + 120, cursor.y, false);
    sfx('whoosh', { pitch: 1.2, vol: .35 });
  }

  /* ---------- level clock ---------- */
  if (status === 'play') {
    lvlT -= dt;
    if (lvlT <= 0) { lvlT = 0; lose(); return; }
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  }

  /* ---------- pendulums ---------- */
  for (let i = 0; i < ropes.length; i++) {
    const r = ropes[i];
    const acc = -(PEND / r.len) * Math.sin(r.ang) - 0.32 * r.av;
    r.av += acc * dt;
    r.ang += r.av * dt;
    ropeGeo(r);
  }
  /* severed ends keep swinging, then fade out */
  for (let i = stubs.length - 1; i >= 0; i--) {
    const s = stubs[i];
    s.t += dt;
    s.ang += s.av * dt;
    s.av *= 1 - 2.6 * dt;
    const acc = -(PEND / Math.max(30, s.len)) * Math.sin(s.ang);
    s.av += acc * dt;
    if (s.t > 1.1) stubs.splice(i, 1);
  }

  /* ---------- falling snacks ---------- */
  for (let i = fall.length - 1; i >= 0; i--) {
    const f = fall[i];
    f.t += dt;
    f.vy += GRAV * dt;
    f.vx *= 1 - 0.5 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.rot += f.vr * dt;
    if (f.rope > 0) f.rope = Math.max(0, f.rope - dt * 90);
    if (f.t > .02) g.fx.trailDot(f.x, f.y, { size: f.gold ? 20 : 13, life: .22, color: f.gold ? 'rgba(255,225,120,.5)' : 'rgba(255,220,180,.28)' });
    if (f.y >= CATCH_Y && !f.dead) {
      if (Math.abs(f.x - (cat.x + cat.dir * 24)) < CATCH_R) catchSnack(f);
      else if (f.y >= FLOOR_Y) missSnack(f);
    } else if (f.y >= FLOOR_Y && !f.dead) missSnack(f);
    if (f.dead) fall.splice(i, 1);
  }

  /* ---------- cut lines ---------- */
  for (let i = cuts.length - 1; i >= 0; i--) {
    const c = cuts[i];
    c.t += dt;
    if (c.t >= c.life) cuts.splice(i, 1);
  }

  /* ---------- the cat: chase the lowest snack, gulp when it lands ---------- */
  let target = 270, low = null;
  for (const f of fall) if (!low || f.y > low.y) low = f;
  if (low) target = low.x - 24;
  const dx = target - cat.x;
  cat.x = damp(cat.x, clamp(target, 64, W - 64), low ? 6.5 : 2.2, dt);
  cat.lean = clamp(dx * .012, -.32, .32);
  if (low) cat.dir = low.x < cat.x + cat.dir * 24 ? -1 : 1;
  const near = low && Math.abs(low.x - cat.x) < 150 && low.y > 560;
  cat.mouth = damp(cat.mouth, near ? 1 : 0, near ? 12 : 6, dt);
  cat.chomp = Math.max(0, cat.chomp - dt * 2.6);
  cat.hurt = Math.max(0, cat.hurt - dt * 2.2);
  cat.gloat = Math.max(0, cat.gloat - dt * .8);
  cat.bob = Math.sin(g.t * 2.6) * 2.2;

  /* ---------- level flow ---------- */
  if (status === 'clear') {
    trans += dt;
    if (trans > .85) {
      if (lvl + 1 >= LEVELS.length) winGame();
      else buildLevel(lvl + 1);
    }
  }
  if (status === 'play' && ropes.length === 0 && fall.length === 0 && caught < needs) lose();

  /* ---------- dust ---------- */
  for (const m of motes) { m.y -= m.sp * dt * .25; if (m.y < 200) { m.y = 940; m.x = R() * W; } }

  if (isAuto && g.mode === 'play') {
    autoT += dt;
    botThink(dt);
    if (autoT > 42 && status !== 'over') g.end({ win: true, score: Math.round(score), label: 'SCORE', progress: 1 });
  }

  g.state = {
    level: lvl + 1, levels: LEVELS.length, caught, need: needs, misses: misses + 0,
    left: Math.round(lvlT * 100) / 100, score: Math.round(score), combo,
    ropes: ropes.length, falling: fall.length, status,
  };
}

/** point→segment distance, used by the tap blade */
function segDist(ax, ay, bx, by, px2, py2) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  let t = ((px2 - ax) * dx + (py2 - ay) * dy) / L;
  t = clamp(t, 0, 1);
  return Math.hypot(px2 - (ax + dx * t), py2 - (ay + dy * t));
}

/* ------------------------------------------------------------------ drawing: scenery */
let skyGrad = null, floorGrad = null;
function drawSky(c) {
  if (!skyGrad) {
    skyGrad = c.createLinearGradient(0, 0, 0, 760);
    skyGrad.addColorStop(0, '#150b2c');
    skyGrad.addColorStop(.38, '#3a1450');
    skyGrad.addColorStop(.66, '#7d2f5c');
    skyGrad.addColorStop(1, '#d9663c');
    floorGrad = c.createLinearGradient(0, 720, 0, H);
    floorGrad.addColorStop(0, '#2b1230');
    floorGrad.addColorStop(1, '#150a1e');
  }
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, 780);
  /* moon + halo */
  const mx = 424, my = 168;
  const halo = c.createRadialGradient(mx, my, 6, mx, my, 130);
  halo.addColorStop(0, 'rgba(255,236,200,.5)'); halo.addColorStop(.4, 'rgba(255,190,150,.14)'); halo.addColorStop(1, 'rgba(255,160,120,0)');
  c.fillStyle = halo; c.fillRect(mx - 130, my - 130, 260, 260);
  c.beginPath(); c.arc(mx, my, 34, 0, TAU); c.fillStyle = '#fff2d8'; c.fill();
  c.globalAlpha = .18; c.fillStyle = '#d9a078';
  c.beginPath(); c.arc(mx - 9, my - 7, 8, 0, TAU); c.fill();
  c.beginPath(); c.arc(mx + 11, my + 9, 5, 0, TAU); c.fill();
  c.globalAlpha = 1;
  /* bats */
  for (let k = 0; k < 4; k++) {
    const bx = ((g.t * 34 * (k % 2 ? 1 : -1) + k * 173) % (W + 140) + W + 140) % (W + 140) - 70;
    const by = 118 + k * 46 + Math.sin(g.t * 2 + k * 1.7) * 12;
    const flap = Math.sin(g.t * 11 + k * 2.1) * .55;
    c.fillStyle = 'rgba(16,8,18,.92)';
    c.beginPath();
    c.moveTo(bx - 15, by);
    c.quadraticCurveTo(bx - 7, by - 9 - flap * 9, bx, by - 2);
    c.quadraticCurveTo(bx + 7, by - 9 - flap * 9, bx + 15, by);
    c.quadraticCurveTo(bx + 7, by + 3, bx, by + 5);
    c.quadraticCurveTo(bx - 7, by + 3, bx - 15, by);
    c.fill();
  }
  /* stars */
  for (const s of STARS) {
    const tw = .35 + .65 * Math.abs(Math.sin(g.t * 1.6 + s.p));
    c.globalAlpha = tw * .8; c.fillStyle = '#fff';
    c.fillRect(s.x, s.y, s.s, s.s);
  }
  c.globalAlpha = 1;

  /* far skyline */
  for (const b of BLD) {
    c.fillStyle = 'rgba(38,16,54,.9)';
    c.fillRect(b.x, 720 - b.h, b.w, b.h);
    c.fillStyle = 'rgba(255,200,120,.32)';
    for (let wy = 720 - b.h + 14; wy < 706; wy += 22) {
      for (let wx = b.x + 7; wx < b.x + b.w - 7; wx += 15) {
        if (((wx * 7 + wy * 13 + b.seed * 100) | 0) % 100 > 58) c.fillRect(wx, wy, 5, 7);
      }
    }
  }
  /* street haze */
  const haze = c.createLinearGradient(0, 560, 0, 760);
  haze.addColorStop(0, 'rgba(255,140,90,0)'); haze.addColorStop(1, 'rgba(255,140,90,.30)');
  c.fillStyle = haze; c.fillRect(0, 560, W, 210);
}

function drawStall(c) {
  /* back wall of the snack stall */
  c.fillStyle = '#2a1330'; c.fillRect(0, 690, W, 200);
  /* awning stripes */
  const top = 128, hgt = 58;
  for (let i = 0; i < 11; i++) {
    c.fillStyle = i % 2 ? '#1a1a1a' : '#ff8c1a'; // halloween awning
    c.beginPath();
    c.moveTo(i * 52 - 6, top); c.lineTo(i * 52 + 52, top);
    c.lineTo(i * 52 + 44, top + hgt + Math.sin(i * 1.3) * 4); c.lineTo(i * 52 + 2, top + hgt + Math.sin(i * 1.3 + .4) * 4);
    c.closePath(); c.fill();
  }
  c.globalAlpha = .18; c.fillStyle = '#000';
  c.beginPath(); c.moveTo(0, top + hgt); c.lineTo(W, top + hgt); c.lineTo(W, top + hgt + 16); c.lineTo(0, top + hgt + 16); c.fill();
  c.globalAlpha = 1;
  /* wooden beam the ropes hang from */
  const bg = c.createLinearGradient(0, ANCHOR_Y - 20, 0, ANCHOR_Y + 4);
  bg.addColorStop(0, '#8a5a34'); bg.addColorStop(.5, '#5e3a20'); bg.addColorStop(1, '#3a2214');
  c.fillStyle = bg; rr(c, -8, ANCHOR_Y - 20, W + 16, 22, 6); c.fill();
  c.strokeStyle = 'rgba(20,10,6,.8)'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,210,150,.16)'; c.lineWidth = 2;
  for (let k = 0; k < 12; k++) { const x = k * 48 + 12; c.beginPath(); c.moveTo(x, ANCHOR_Y - 18); c.lineTo(x + 4, ANCHOR_Y + 1); c.stroke(); }
  /* hanging lanterns */
  for (const L of lanterns) {
    const sway = Math.sin(g.t * .9 + L.p) * .1;
    c.save(); c.translate(L.x, 96); c.rotate(sway);
    c.strokeStyle = '#3a2214'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, L.y - 96 + 6); c.stroke();
    const gl = c.createRadialGradient(0, L.y - 96 + 16, 2, 0, L.y - 96 + 16, 44 * L.s);
    gl.addColorStop(0, hexA(L.c, .55)); gl.addColorStop(1, hexA(L.c, 0));
    c.fillStyle = gl; c.beginPath(); c.arc(0, L.y - 96 + 16, 44 * L.s, 0, TAU); c.fill();
    c.fillStyle = L.c; c.beginPath(); c.ellipse(0, L.y - 96 + 16, 13 * L.s, 16 * L.s, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(80,30,10,.5)'; c.lineWidth = 2; c.stroke();
    c.restore();
  }
}

function drawCounter(c) {
  /* the snack counter the cat sits on */
  const cg = c.createLinearGradient(0, 860, 0, H);
  cg.addColorStop(0, '#6b3c26'); cg.addColorStop(.12, '#4a2718'); cg.addColorStop(1, '#1d0f12');
  c.fillStyle = cg; c.fillRect(0, 872, W, H - 872);
  c.fillStyle = 'rgba(255,190,120,.16)'; c.fillRect(0, 872, W, 5);
  c.strokeStyle = 'rgba(255,210,150,.1)'; c.lineWidth = 2;
  for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(30 + k * 96, 884); c.lineTo(22 + k * 96, H); c.stroke(); }
  c.fillStyle = floorGrad; c.globalAlpha = .5; c.fillRect(0, 930, W, 30); c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ drawing: snacks */
function drawTreat(c, x, y, r, kind, gold, rot) {
  const T = TREAT_COL[kind] || TREAT_COL.wrap;
  const body = gold ? '#ffd34d' : T.body, dark = gold ? '#b4770c' : T.dark, light = gold ? '#fff3b0' : T.light;
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  if (gold) {
    const gl = c.createRadialGradient(0, 0, 2, 0, 0, r * 2.2);
    gl.addColorStop(0, 'rgba(255,230,140,.55)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, r * 2.2, 0, TAU); c.fill();
  }
  c.lineJoin = 'round'; c.lineWidth = 3.2; c.strokeStyle = '#20100a';
  switch (kind) {
    case 'corn': { // candy corn
      c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .8, r * .7); c.lineTo(-r * .8, r * .7); c.closePath();
      c.fillStyle = body; c.fill(); c.stroke();
      c.fillStyle = light;
      c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .32, -r * .08); c.lineTo(-r * .32, -r * .08); c.closePath(); c.fill();
      c.fillStyle = dark;
      c.beginPath(); c.moveTo(-r * .6, r * .4); c.lineTo(r * .6, r * .4); c.lineTo(r * .8, r * .7); c.lineTo(-r * .8, r * .7); c.closePath(); c.fill();
      break;
    }
    case 'bar': { // chocolate bar
      c.fillStyle = dark; rr(c, -r * .7, -r * .5, r * 1.4, r, r * .2); c.fill(); c.stroke();
      c.fillStyle = body;
      for (let k = 0; k < 3; k++) { rr(c, -r * .58 + k * r * .42, -r * .38, r * .34, r * .76, r * .08); c.fill(); }
      c.fillStyle = light; c.fillRect(-r * .58, -r * .38, r * .3, r * .12);
      break;
    }
    case 'pop': { // lollipop
      c.strokeStyle = '#e8e0d0'; c.lineWidth = Math.max(3, r * .16); c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, r * .1); c.lineTo(0, r * 1.05); c.stroke();
      c.lineWidth = 3.2; c.strokeStyle = '#20100a';
      c.beginPath(); c.arc(0, -r * .15, r * .75, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
      c.strokeStyle = light; c.lineWidth = r * .15;
      c.beginPath(); c.arc(0, -r * .15, r * .42, .5, 2.6); c.stroke();
      c.beginPath(); c.arc(0, -r * .15, r * .42, 3.6, 5.7); c.stroke();
      break;
    }
    case 'gum': { // gumball
      c.beginPath(); c.arc(0, 0, r * .8, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
      c.fillStyle = light; c.beginPath(); c.ellipse(-r * .25, -r * .3, r * .3, r * .17, -.5, 0, TAU); c.fill();
      break;
    }
    default: { // wrapped candy
      c.fillStyle = dark;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * r * .45, 0); c.lineTo(s * r * 1.15, -r * .38); c.lineTo(s * r * 1.15, r * .38); c.closePath();
        c.fill(); c.stroke();
      }
      c.beginPath(); c.ellipse(0, 0, r * .62, r * .5, 0, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
      c.fillStyle = light; c.beginPath(); c.ellipse(-r * .15, -r * .16, r * .28, r * .15, -.4, 0, TAU); c.fill();
    }
  }
  c.restore();
}

function drawBomb(c, x, y, r) { /* HALLOWEEN: a black-widow spider — mechanics identical, do NOT cut */
  const pulse = .5 + .5 * Math.sin(g.t * 8);
  const gl = c.createRadialGradient(x, y, 2, x, y, r * 2.1);
  gl.addColorStop(0, `rgba(255,60,80,${.22 + pulse * .22})`); gl.addColorStop(1, 'rgba(255,60,80,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 2.1, 0, TAU); c.fill();
  c.save(); c.translate(x, y); c.rotate(Math.sin(g.t * 2.2) * .12);
  c.lineCap = 'round';
  /* 8 legs */
  c.strokeStyle = '#0d0a12'; c.lineWidth = Math.max(2.5, r * .14);
  for (let k = 0; k < 4; k++) {
    for (const s of [-1, 1]) {
      const a = (k - 1.5) * .5 + (s < 0 ? Math.PI : 0);
      c.beginPath(); c.moveTo(s * r * .3, -r * .1 + k * r * .18);
      c.quadraticCurveTo(s * r * 1.1, -r * .3 + k * r * .2, s * r * 1.5, r * .1 + k * r * .12);
      c.stroke();
    }
  }
  /* abdomen + head */
  c.beginPath(); c.ellipse(0, r * .25, r * .62, r * .78, 0, 0, TAU);
  const bg2 = c.createRadialGradient(-r * .2, 0, 2, 0, r * .25, r);
  bg2.addColorStop(0, '#3a3340'); bg2.addColorStop(1, '#0d0a12');
  c.fillStyle = bg2; c.fill(); c.lineWidth = 3; c.strokeStyle = '#000'; c.stroke();
  c.beginPath(); c.arc(0, -r * .55, r * .34, 0, TAU); c.fillStyle = '#16121a'; c.fill(); c.stroke();
  /* red hourglass */
  c.fillStyle = `rgba(255,45,70,${.7 + pulse * .3})`;
  c.beginPath(); c.moveTo(0, r * .05); c.lineTo(r * .2, r * .32); c.lineTo(-r * .2, r * .32); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, r * .62); c.lineTo(r * .2, r * .35); c.lineTo(-r * .2, r * .35); c.closePath(); c.fill();
  /* eyes */
  c.fillStyle = '#ff5b6e';
  for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * .14, -r * .62, r * .07, 0, TAU); c.fill(); }
  c.restore();
}

function drawRope(c, ax, ay, tx, ty, ph, alpha) {
  c.save(); c.globalAlpha = alpha;
  const N = 9, sag = 7;
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    pts.push({
      x: ax + (tx - ax) * u + Math.sin(u * Math.PI) * Math.sin(g.t * 3 + ph) * 2.2,
      y: ay + (ty - ay) * u + Math.sin(u * Math.PI) * sag,
    });
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k <= N; k++) c.lineTo(pts[k].x, pts[k].y);
  c.strokeStyle = 'rgba(140,160,185,.85)'; c.lineWidth = 5.5; c.stroke();
  c.strokeStyle = '#eef4fa'; c.lineWidth = 2.2; c.stroke();
  /* sticky droplets on the web */
  c.fillStyle = 'rgba(255,255,255,.65)';
  for (let k = 1; k < N; k += 3) { c.beginPath(); c.arc(pts[k].x, pts[k].y, 1.8, 0, TAU); c.fill(); }
  /* anchor: little web rosette */
  c.strokeStyle = 'rgba(200,215,230,.8)'; c.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6 + .3;
    c.beginPath(); c.moveTo(ax, ay + 2);
    c.lineTo(ax + Math.cos(a) * 11, ay + 2 + Math.sin(a) * 11); c.stroke();
  }
  c.restore();
  return pts;
}

/* ------------------------------------------------------------------ drawing: main */
function draw() {
  const c = g.ctx;

  drawSky(c);
  drawStall(c);

  /* dust motes (mid layer) */
  for (const m of motes) {
    c.globalAlpha = .1 + .22 * Math.abs(Math.sin(g.t * .8 + m.p));
    c.fillStyle = '#ffe9c0';
    c.beginPath(); c.arc(m.x + Math.sin(g.t * .5 + m.p) * 8, m.y, m.s, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;

  /* ---------- hanging snacks ---------- */
  for (const r of ropes) {
    const pts = drawRope(c, r.ax, r.ay, r.tx, r.ty, r.ph, 1);
    /* the snack bobs at the end of the rope */
    const bob = Math.sin(g.t * 3.4 + r.ph) * 1.6;
    if (r.bomb) drawBomb(c, pts[pts.length - 1].x, pts[pts.length - 1].y + bob, r.r);
    else drawTreat(c, pts[pts.length - 1].x, pts[pts.length - 1].y + bob, r.r, r.kind, r.gold, r.rot * .8);
  }

  /* severed ends still twanging */
  for (const s of stubs) {
    const a = 1 - Math.max(0, (s.t - .55) / .55);
    const ex = s.ax + Math.sin(s.ang) * s.len, ey = s.ay + Math.cos(s.ang) * s.len;
    drawRope(c, s.ax, s.ay, ex, ey, s.t * 4, clamp(a, 0, 1));
  }

  /* ---------- falling snacks ---------- */
  for (const f of fall) {
    /* the little ripped rope tag trailing behind */
    if (f.rope > 0) {
      c.save(); c.globalAlpha = .8; c.strokeStyle = '#dfe8f0'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(f.x, f.y - f.r * .6); c.lineTo(f.x + Math.sin(f.t * 9) * 6, f.y - f.r * .6 - f.rope); c.stroke();
      c.restore();
    }
    if (f.gold) {
      const gl = c.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * 2.4);
      gl.addColorStop(0, 'rgba(255,235,150,.55)'); gl.addColorStop(1, 'rgba(255,200,60,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(f.x, f.y, f.r * 2.4, 0, TAU); c.fill();
    }
    drawTreat(c, f.x, f.y, f.r, f.kind, f.gold, f.rot);
  }

  /* ---------- cut lines: bright, fading, with a hot core ---------- */
  for (const q of cuts) {
    const u = 1 - q.t / q.life;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = u * q.a;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(150,240,255,.45)'; c.lineWidth = q.w * 2.2 * u;
    c.beginPath(); c.moveTo(q.x1, q.y1); c.lineTo(q.x2, q.y2); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = q.w * .55 * u + 1;
    c.beginPath(); c.moveTo(q.x1, q.y1); c.lineTo(q.x2, q.y2); c.stroke();
    c.restore();
  }

  drawCounter(c);

  /* ---------- the trick-or-treat bucket (pumpkin) ---------- */
  const cx = cat.x, cy = 902;
  const bobY = cat.bob * .3, lean = cat.lean * .35;
  const faceGlow = cat.gloat > 0 ? cat.gloat : cat.chomp * .6;
  c.save();
  c.translate(cx, cy + bobY); c.rotate(lean); c.translate(-cx, -cy);
  /* ground glow */
  const pg = c.createRadialGradient(cx, 906, 4, cx, 906, 100);
  pg.addColorStop(0, 'rgba(255,150,40,.25)'); pg.addColorStop(1, 'rgba(255,150,40,0)');
  c.fillStyle = pg; c.beginPath(); c.ellipse(cx, 906, 100, 24, 0, 0, TAU); c.fill();
  /* handle */
  c.strokeStyle = '#5a3a20'; c.lineWidth = 8; c.lineCap = 'round';
  c.beginPath(); c.arc(cx, cy - 66, 58, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
  /* pumpkin body */
  const pbx = cx, pby = cy - 34, pbw = 80, pbh = 64;
  const hurt = cat.hurt > .3;
  const pg2 = c.createRadialGradient(pbx - 22, pby - 12, 8, pbx, pby + 8, 95);
  pg2.addColorStop(0, hurt ? '#ff8b6a' : '#ffb03a'); pg2.addColorStop(1, hurt ? '#c8502a' : '#c85e10');
  c.fillStyle = pg2;
  c.beginPath(); c.ellipse(pbx, pby, pbw, pbh, 0, 0, TAU); c.fill();
  c.lineWidth = 3.2; c.strokeStyle = '#20100a'; c.stroke();
  /* ribs */
  c.strokeStyle = 'rgba(120,50,0,.45)'; c.lineWidth = 3;
  for (const s of [-.62, -.32, 0, .32, .62]) {
    c.beginPath(); c.ellipse(pbx, pby, Math.abs(s) * pbw, pbh * .98, 0, -.45, .45); c.stroke();
    c.beginPath(); c.ellipse(pbx, pby, Math.abs(s) * pbw, pbh * .98, 0, Math.PI - .45, Math.PI + .45); c.stroke();
  }
  /* the opening — candy drops in here when the mouth is open */
  const mo = cat.mouth * (1 - cat.chomp * .7);
  c.fillStyle = '#160b04';
  c.beginPath(); c.ellipse(pbx, pby - pbh + 6, 34 * mo + 10, 9 * mo + 4, 0, 0, TAU); c.fill();
  c.strokeStyle = '#20100a'; c.lineWidth = 2.5; c.stroke();
  /* jack-o-lantern face — lights up on a catch */
  const lit = faceGlow > .08;
  if (lit) {
    const fg = c.createRadialGradient(pbx, pby + 6, 4, pbx, pby + 6, 70);
    fg.addColorStop(0, `rgba(255,220,120,${.5 * Math.min(1, faceGlow)})`); fg.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = fg; c.beginPath(); c.ellipse(pbx, pby + 6, 70, 56, 0, 0, TAU); c.fill();
  }
  c.fillStyle = lit ? '#ffe98a' : '#2a1408';
  for (const s of [-1, 1]) { // triangle eyes
    c.beginPath(); c.moveTo(pbx + s * 38 - 11, pby - 2); c.lineTo(pbx + s * 38 + 11, pby - 2); c.lineTo(pbx + s * 38, pby - 20); c.closePath(); c.fill();
  }
  c.beginPath(); // jagged grin
  c.moveTo(pbx - 36, pby + 26);
  for (let k = 0; k < 6; k++) c.lineTo(pbx - 36 + (k + .5) * 12, pby + 26 + (k % 2 ? 11 : 0));
  c.lineTo(pbx + 36, pby + 26); c.closePath(); c.fill();
  c.restore();

  /* keyboard blade cursor */
  if (g.keys.ArrowLeft || g.keys.ArrowRight || g.keys.ArrowUp || g.keys.ArrowDown) {
    c.save(); c.globalAlpha = .85; c.strokeStyle = '#bff4ff'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(cursor.x, cursor.y, 16, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(cursor.x - 26, cursor.y); c.lineTo(cursor.x + 26, cursor.y); c.stroke();
    c.restore();
  }

  drawHUD(c);
}

/* ------------------------------------------------------------------ HUD */
function drawHUD(c) {
  /* top-left: score + level pips */
  panel(c, 12, 14, 232, 78, { alpha: .52, color: '#140a24', r: 16 });
  c.save();
  c.beginPath(); c.arc(40, 44, 13, 0, TAU); c.fillStyle = '#ffd34d'; c.fill();
  c.strokeStyle = '#8a5a10'; c.lineWidth = 3; c.stroke();
  c.restore();
  g.text(String(Math.round(score)), 62, 58, { size: 40, color: '#ffe9a8', ink: '#1a0e00' });
  g.text(`LVL ${lvl + 1}/${LEVELS.length}`, 62, 80, { size: 19, color: '#c9b6e6', ink: '#0d0618', stroke: 3 });
  for (let k = 0; k < LEVELS.length; k++) {
    c.fillStyle = k < lvl ? '#7dff9b' : k === lvl ? '#ffd34d' : 'rgba(255,255,255,.18)';
    c.beginPath(); c.arc(196 + (k % 3) * 14, 44 + Math.floor(k / 3) * 15, 4.6, 0, TAU); c.fill();
  }

  /* top-right: snacks caught + timer ring (combo meter lives under it) */
  const rx = W - 60, ry = 54;
  c.save(); c.globalAlpha = .9;
  c.beginPath(); c.arc(rx, ry, 27, 0, TAU); c.fillStyle = 'rgba(10,6,20,.6)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2; c.stroke();
  const frac = clamp(lvlT / LEVELS[lvl].time, 0, 1);
  c.beginPath(); c.arc(rx, ry, 27, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  c.strokeStyle = frac < .32 ? '#ff6b6b' : '#7dff9b'; c.lineWidth = 5.5; c.lineCap = 'round'; c.stroke();
  c.restore();
  g.text(lvlT.toFixed(1), rx, ry + 9, { size: 22, align: 'center', color: frac < .32 ? '#ff9a8a' : '#eafff0', ink: '#04101c', stroke: 4 });

  /* snack counter pill */
  const label = `${caught}/${needs} CANDY`;
  panel(c, 12, 100, 196, 46, { alpha: .5, color: '#140a24', r: 14 });
  g.text(label, 110, 130, { size: 24, align: 'center', color: caught >= needs ? '#7dff9b' : '#fff2d0', ink: '#12061c', stroke: 4 });
  /* need progress bar */
  const bx = 22, by = 138, bw = 176;
  c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, bx, by, bw, 7, 4); c.fill();
  c.fillStyle = '#7dff9b'; rr(c, bx, by, Math.max(3, bw * clamp(caught / needs, 0, 1)), 7, 4); c.fill();

  /* the golden rule: don't cut the bombs */
  if (hintT < 4.2 || (lvl === 0 && g.t < 6)) {
    const a = clamp(4.2 - hintT, 0, 1) * (.6 + .4 * Math.sin(g.t * 4));
    c.globalAlpha = a;
    g.text('CUT THE CANDY · NEVER THE SPIDERS', 270, 250, { size: 22, align: 'center', color: '#ffe9a8', ink: '#1a0a20', stroke: 5 });
    c.globalAlpha = 1;
  }
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({
  level: lvl, caught, need: needs, left: +lvlT.toFixed(2), score: Math.round(score),
  ropes: ropes.length, bombs: ropes.filter(r => r.bomb).length, falling: fall.length, status,
  cat: [Math.round(cat.x), Math.round(CATCH_Y)],
});

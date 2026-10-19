// CAT NINJA — slice-swipe (Cat Arcade v2)
// Swipe the night sky: slice 30 pieces of fruit to clear the garden.
// The whole game is one gesture — the blade you draw — so everything here exists to make that
// gesture feel like it is cutting something: a tapered trail with a hot leading edge, two halves
// that spin off with their own juice, a chain that climbs in pitch, and bullet-time for a
// four-fruit swipe.
import { makeGame, sfx, music, comboPitch, clamp, lerp, damp, rnd, chance, R, TAU, rr, starPath, hexA } from '../_vendor/gp2x.js';
import { drawChar, face } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'slice-swipe', title: 'CAT NINJA', sub: 'SWIPE TO SLICE · DON\'T TOUCH BOMBS',
  hook: 'the garden only needs 30 slices', w: W, h: H, bg: '#070611', style: 'toon',
  bloom: .7, ca: .34, vig: 1, scan: .14,
});

/* ------------------------------------------------------------------ tuning */
const GRAV = 1600;          // px/s²
const GOAL = 30;            // slices to win
const LIVES = 3;            // missed fruit you can afford
const TRAIL_LIFE = .16;     // seconds the blade trail glows
const TRAIL_MAX = 30;       // points kept (a long flick must not eat the frame)
const BULLET = 4;           // fruit in one swipe => bullet time

const FRUIT = {
  melon:  { r: 48, col: '#46b655', dark: '#20702f', juice: '#8ff79a', pulp: '#ffe9a8', spark: '#d9ffae' },
  orange: { r: 40, col: '#ffa02c', dark: '#c85f0c', juice: '#ffcb72', pulp: '#ffd98f', spark: '#ffe7b0' },
  berry:  { r: 33, col: '#f0407a', dark: '#a51a4c', juice: '#ff8ab4', pulp: '#ffd0e0', spark: '#ffc6dc' },
  lime:   { r: 36, col: '#c3e84a', dark: '#70962a', juice: '#e9ff96', pulp: '#f4ffcf', spark: '#f7ffbc' },
};
const KINDS = Object.keys(FRUIT);

/* ------------------------------------------------------------------ world */
const items = [], halves = [], splats = [], slashes = [], trail = [];
const cat = { x: 270, y: 1004, h: 240, hop: 0, hurt: 0 };
const bot = { x: 270, y: 520, lock: -1 };
const par = { x: 0, y: 0 };
const chain = { n: 0, kind: '', t: 0 };       // same-colour streak
const stroke = { n: 0, bullet: false };       // fruit taken by the current swipe

let waveT = 0, uid = 0, flash = 2, frame = 0, overFx = false;
let bladeSpeed = 0, bloom = 0, bgPulse = 0, bgTint = '130,230,255', mileIdx = 0, splashT = 0;
const isAuto = g.auto;
const botDumb = () => g.dumb();

/* seeded background beds (never change, so ?hold stays frozen) */
const stars = Array.from({ length: 96 }, () => ({ x: R() * W, y: R() * H * .82, s: .7 + R() * 1.9, p: R() * 6.3, w: .6 + R() * 1.6 }));
const ridgeA = Array.from({ length: 15 }, (_, i) => 640 - Math.sin(i * .7) * 50 - R() * 26);
const ridgeB = Array.from({ length: 13 }, (_, i) => 742 - Math.sin(i * 1.1 + 2) * 34 - R() * 20);
const lanterns = Array.from({ length: 7 }, (_, i) => ({ x: 40 + i * 78, y: 148 + Math.sin(i * 1.4) * 22, s: .78 + R() * .4, p: R() * 6.3 }));
const fire = Array.from({ length: 18 }, () => ({ x: R() * W, y: 380 + R() * 520, s: .8 + R() * 1.6, p: R() * 6.3, sp: 8 + R() * 22 }));

/* ------------------------------------------------------------------ reset */
function resetWorld() {
  items.length = 0; halves.length = 0; splats.length = 0; slashes.length = 0; trail.length = 0;
  g.score = 0; waveT = .5; flash = 2; overFx = false;
  cat.hop = 0; cat.hurt = 0;
  bot.lock = -1; bot.x = 270; bot.y = 520;
  bladeSpeed = 0; bloom = 0; bgPulse = 0; bgTint = '130,230,255'; mileIdx = 0; splashT = 0;
  chain.n = 0; chain.kind = ''; chain.t = 0;
  stroke.n = 0; stroke.bullet = false;
  g.fx.clear(); g.combo.reset();
  g.state = { score: 0, sliced: 0, goal: GOAL, lives: LIVES, combo: 0, won: false };
  g.hud.hint = 'swipe to slice';
}
g.onReset = resetWorld;
g.onStart = () => music('action');
resetWorld();

/* ------------------------------------------------------------------ spawning */
function spawnWave(dt) {
  const p = clamp(g.state.sliced / GOAL, 0, 1);
  waveT -= dt;
  if (waveT > 0) return;
  waveT = lerp(.88, .5, p) * (.85 + R() * .3);
  const n = 1 + (R() < .5 + p * .45 ? 1 : 0) + (p > .25 && R() < .35 ? 1 : 0);
  const slots = n === 1 ? [130 + R() * 280] : n === 2 ? [132 + R() * 46, 362 + R() * 46] : [112 + R() * 40, 268 + R() * 30, 404 + R() * 40];
  for (let i = 0; i < n; i++) {
    // bombs ramp in, and the very first (deliberately bad) bot run gets plenty of them
    const bombP = botDumb() ? .55 : p > .12 ? .1 + p * .26 : 0;
    spawnItem(slots[i % slots.length], R() < bombP);
  }
}

function spawnItem(x, bomb) {
  const kind = bomb ? null : KINDS[(R() * KINDS.length) | 0];
  items.push({
    id: uid++, bomb, kind, x, y: H + (bomb ? 40 : FRUIT[kind].r) + 14, vx: (270 - x) * (.7 + R() * .55),
    vy: -1288 - R() * 200, rot: R() * TAU, vr: (R() - .5) * 2.4,
    r: bomb ? 40 : FRUIT[kind].r,
  });
}

/* ------------------------------------------------------------------ blade */
let prev = { x: 270, y: 500 };
let cur = { x: 270, y: 500 };
let down = false;

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

function pickTarget() {
  let best = null;
  for (const it of items) {
    if (it.bomb || it.cut) continue;
    /* the fruit that is closest to being lost — never abandon one near the bottom */
    if (!best || it.y > best.y) best = it;
  }
  bot.lock = best ? best.id : -1;
  return best;
}

function bladeStep(dt) {
  let nx, ny, nd;
  if (isAuto) {
    if (botDumb()) {
      /* the bad run: the ninja naps in the corner and lets the garden rot */
      nx = 84 + (Math.sin(g.t * 2.7) * .5 + .5) * 120;
      ny = 840 + Math.cos(g.t * 1.9) * 40;
      nd = false;
    } else {
      const tgt = pickTarget();
      if (tgt) {
        /* intercept ahead of the fruit along its own velocity — a ninja leads the cut */
        const ax = tgt.x + tgt.vx * .1, ay = clamp(tgt.y + tgt.vy * .1, 150, 900);
        nx = damp(bot.x, clamp(ax, 46, W - 46), 40, dt); ny = damp(bot.y, ay, 40, dt); nd = true;
      } else {
        bot.lock = -1;
        nx = damp(bot.x, 270 + Math.sin(g.t * .9) * 150, 7, dt);
        ny = damp(bot.y, 470, 7, dt);
        nd = false;
      }
    }
  } else { nx = g.ptr.x; ny = g.ptr.y; nd = g.ptr.down; }

  const step = Math.hypot(nx - cur.x, ny - cur.y);
  prev = cur;
  cur = { x: nx, y: ny };
  down = nd;
  bot.x = nx; bot.y = ny;
  if (dt > 0) bladeSpeed = damp(bladeSpeed, step / dt, 20, dt);

  /* the blade trail is the real pointer path */
  if (down) {
    trail.push({ x: nx, y: ny, t: g.t });
    if (trail.length > TRAIL_MAX) trail.shift();
    /* fine sparks shed off the edge — the blade is never quite clean */
    if (frame % 2 === 0 && bladeSpeed > 260) {
      g.fx.emit('glow', nx + (R() - .5) * 12, ny + (R() - .5) * 12, {
        size: 9 + R() * 10, life: .28, color: bladeSpeed > 1500 ? 'rgba(215,255,255,.75)' : 'rgba(120,235,255,.55)',
        add: true, vx: (R() - .5) * 40, vy: (R() - .5) * 40,
      });
    }
  }
  while (trail.length && g.t - trail[0].t > TRAIL_LIFE) trail.shift();
  if (!down) trail.length = 0;

  if (!down) { if (!nd) stroke.n = 0; return; }

  const ang = step > 9
    ? Math.atan2(cur.y - prev.y, cur.x - prev.x)
    : R() * TAU;

  const keep = [];
  for (const it of items) {
    const reach = it.r * (it.bomb ? .74 : .92);
    const hit = Math.min(
      segDist(it.x, it.y, prev.x, prev.y, cur.x, cur.y),
      Math.hypot(it.x - cur.x, it.y - cur.y),
    ) < reach;
    if (!hit || (it.bomb && isAuto && !botDumb())) { keep.push(it); continue; }  // the bot never slices bombs
    if (it.bomb) bombHit(it); else cutFruit(it, ang);
  }
  items.splice(0, items.length, ...keep);

  /* four fruit in one swipe earns a breath of bullet time */
  if (stroke.n >= BULLET && !stroke.bullet) bulletTime(cur.x, cur.y);
}

function endStroke() { stroke.n = 0; stroke.bullet = false; }

/* ------------------------------------------------------------------ slicing */
function cutFruit(it, ang, quiet) {
  if (it.cut) return;
  it.cut = true;
  const f = FRUIT[it.kind];
  const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
  const power = clamp(bladeSpeed / 1300, .6, 1.9);

  /* two halves, physically separated along the cut normal, each with its own spin */
  for (const s of [-1, 1]) {
    halves.push({
      kind: it.kind, s, x: it.x + nx * s * it.r * .16, y: it.y + ny * s * it.r * .16,
      vx: it.vx * .45 + nx * s * (150 + R() * 110) * power, vy: it.vy * .34 + ny * s * 70 - 30,
      rot: ang + (s > 0 ? 0 : Math.PI), vr: s * (1.6 + R() * 3.4), t: 0, drip: R() * .2,
    });
  }

  /* juice in the fruit's own palette — a directional spray plus a puff of pulp specks */
  g.fx.burst(it.x, it.y, 15, { kind: 'dot', color: [f.juice, f.col, f.spark], speed: 320 * power, size: 11, life: .6, g: 1250, drag: .8 });
  g.fx.burst(it.x, it.y, 8, { kind: 'spark', color: [f.spark, '#fff'], speed: 560 * power, size: 6, life: .3, ang, spread: 1.5 });
  g.fx.burst(it.x, it.y, 4, { kind: 'shard', color: [f.dark, f.col], speed: 300, size: 7, life: .5, g: 1100 });
  g.fx.emit('ring', it.x, it.y, { size: it.r * 2.6, color: f.juice, life: .3, add: true, wide: 6 });
  g.fx.emit('glow', it.x, it.y, { size: it.r * 1.7, life: .22, color: hexA(f.juice, .55), add: true });
  if (g.post) g.post.ripple(it.x / W, it.y / H, .5 + power * .3);
  splat(it.x, it.y, f.juice, it.r);
  slashes.push({ x: it.x, y: it.y, a: ang, len: it.r * (2.8 + power * .6), t: 0 });

  const gain = Math.round(10 * g.combo.mult);
  g.score += gain;
  g.state.sliced++;
  g.combo.hit(it.x, it.y, `+${gain}`);

  /* same-colour streak: consecutive cuts of one fruit kind climb a semitone each */
  if (chain.kind === it.kind && chain.t > 0) chain.n++; else chain.n = 1;
  chain.kind = it.kind; chain.t = 1.7;
  if (!quiet) stroke.n++;
  bloom = Math.min(1, bloom + .16);

  if (chain.n >= 2) {
    const cp = comboPitch(Math.min(12, chain.n + g.combo.n));
    if (chain.n === 2) sfx('coinchain', { pitch: cp, vol: .8 });
    if (chain.n === 3) sfx('powerup', { pitch: cp * .9, vol: .75 });
    if (chain.n >= 5) sfx('perfect', { pitch: cp, vol: .7 });
    g.popup(`×${chain.n}`, it.x, it.y - 46, f.juice, 24 + Math.min(22, chain.n * 3));
    if (chain.n === 3) g.showBanner('CHAIN ×3', .5);
    if (chain.n === 5) { g.showBanner('ON A ROLL', .6); bgPulse = 1; bgTint = '255,200,90'; }
  }

  if (!quiet) {
    sfx('slice', { pitch: comboPitch(g.combo.n % 12) * .92, vol: .9 });
    sfx('splat', { pitch: .9 + (g.combo.n % 5) * .06, vol: .45 });
    /* a wide, fast swipe gets the bigger blade sound underneath */
    if (power > 1.15 || stroke.n >= 3) sfx('whoosh', { pitch: .8 + chain.n * .06, vol: .55 });
    g.punch(.045 + Math.min(.05, power * .03));
    g.shake(4 + Math.min(8, chain.n * 2 + stroke.n));
    g.hitstop(.032 + Math.min(.03, chain.n * .006));
  }

  /* splash droplets hitting the ground behind the action */
  splashT = Math.min(4, splashT + .4);

  if (!quiet) milestones();
  if (g.state.sliced >= GOAL && g.mode === 'play') winGame();
}

function milestones() {
  if (mileIdx < 1 && g.state.sliced >= 8) {
    mileIdx = 1;
    g.popup('8 SLICED', 270, 300, '#ffd34d', 30);
    sfx('ding', { pitch: 1.1, vol: .5 });
    g.punch(.05); g.shake(5);
  }
  if (mileIdx < 2 && g.state.sliced >= 15) {
    mileIdx = 2;
    g.showBanner('HALFWAY', .8);
    g.popup('15 SLICED', 270, 300, '#ffd34d', 30);
    sfx('unlock', { pitch: 1, vol: .7 });
    sfx('fanfare', { pitch: .9, vol: .35 });
    g.flash('#ffd34d', .12); g.punch(.07); g.shake(8); g.hitstop(.05);
    bgPulse = 1; bgTint = '255,210,120';
    g.fx.ring(270, 420, { r: 340, color: '#ffd34d', life: .5, wide: 10 });
  }
  if (mileIdx < 3 && g.state.sliced >= 22) {
    mileIdx = 3;
    g.showBanner('5 TO GO', .8);
    g.popup('22 SLICED', 270, 300, '#ff9a3c', 28);
    sfx('ding', { pitch: 1.24, vol: .6 });
    g.punch(.06); g.shake(7);
    bgPulse = .8; bgTint = '255,150,80';
  }
}

function bombHit(it) {
  it.cut = true;
  const r = it.r;
  g.fx.blast(it.x, it.y, { r: 140, color: '#ff6b4a', n: 30, punch: .16, shake: 22, flashC: '#ff5a3c', flashA: .4, life: .5 });
  g.fx.burst(it.x, it.y, 12, { kind: 'debris', color: ['#2b3143', '#4a5062', '#ff8a3c'], speed: 420, size: 9, life: .8, g: 1500 });
  g.fx.emit('ring', it.x, it.y, { size: r * 6, color: '#ffce6a', life: .45, add: true, wide: 9 });
  g.fx.emit('smoke', it.x, it.y, { size: r * 1.6, life: .9, color: '#231a1a', vx: 0, vy: -40 });
  sfx('boom', { pitch: .9, vol: 1 });
  sfx('explode', { pitch: 1.05, vol: .7 });
  g.punch(.2); g.shake(24); g.hitstop(.12);
  if (g.post) { g.post.ripple(it.x / W, it.y / H, 1.6); }
  bgPulse = 1; bgTint = '255,90,60';
  bloom = 1;
  g.slowmo(.45, .18);
  g.combo.miss();
  hurt('BOMB!');
}

function splat(x, y, col, r) {
  const blobs = Array.from({ length: 6 }, () => ({ dx: (R() - .5) * r * 2.1, dy: (R() - .5) * r * 2.1, r: r * (.18 + R() * .34) }));
  splats.push({ x, y, r, col, t: 0, life: 2.6, blobs, rot: R() * TAU });
  if (splats.length > 14) splats.shift();
}

function hurt(label) {
  if (g.mode !== 'play') return;
  g.state.lives--;
  cat.hurt = 1;
  chain.n = 0; chain.t = 0;
  g.hitstop(.1); g.shake(17); g.flash('#ff3b3b', .32);
  g.punch(.14);
  g.popup(label, 270, 700, '#ff6b6b', 44);
  sfx('hit', { pitch: .82, vol: .9 });
  sfx('thud', { pitch: .8, vol: .5 });
  bgPulse = .7; bgTint = '255,70,70';
  if (g.post) g.post.ripple(270 / W, 700 / H, 1.2);
  g.fx.burst(270, 760, 10, { kind: 'debris', color: ['#ff6b6b', '#ffb0a0'], speed: 240, size: 6, life: .6 });
  if (g.state.lives <= 0) { g.state.lives = 0; loseGame(); }
}

function winGame() {
  g.state.won = true;
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 1 });
  const cols = ['#ffd34d', '#5ff2ff', '#ff7ad9', '#7dff9b'];
  for (let i = 0; i < 34; i++) g.fx.emit('confetti', 40 + R() * 460, -40 - R() * 260, { vx: (R() - .5) * 130, vy: 180 + R() * 260, g: 430, life: 2 + R(), size: 7 + R() * 8, color: cols[i % 4], vr: (R() - .5) * 9 });
  g.fx.blast(270, 430, { r: 260, color: '#ffd34d', n: 42, punch: .2, shake: 14, flashA: .45 });
  g.fx.emit('ring', 270, 430, { size: 520, color: '#fff3b0', life: .6, add: true, wide: 14 });
  sfx('fanfare', { pitch: 1.04, vol: .8 });
  g.showBanner('GARDEN CLEAR!', 1.6);
  g.punch(.18); g.shake(16); g.flash('#fff6cf', .3);
  bgPulse = 1; bgTint = '255,230,150';
  cat.hop = 1;
}

function loseGame() {
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: clamp(g.state.sliced / GOAL, 0, 1) });
  g.fx.blast(cat.x, cat.y - 130, { r: 170, color: '#ff4d6d', n: 34, punch: .1, shake: 24, flashC: '#ff3b5c', flashA: .5 });
  g.fx.emit('ring', cat.x, cat.y - 130, { size: 420, color: '#ff90a8', life: .6, add: true, wide: 12 });
  sfx('lose', { pitch: .92, vol: .8 });
  sfx('groan', { pitch: .85, vol: .5 });
  g.punch(.1); g.shake(20);
  bgPulse = 1; bgTint = '255,60,60';
}

function doFlash() {
  if (flash <= 0 || g.mode !== 'play') return;
  flash--;
  const list = items.filter(o => !o.bomb);
  const n = list.length;
  for (const it of list) cutFruit(it, R() * TAU, true);
  items.splice(0, items.length, ...items.filter(o => o.bomb));
  g.fx.blast(270, 470, { r: 330, color: '#5ff2ff', n: 46, punch: .2, shake: 16, flashC: '#bff8ff', flashA: .34, smoke: false });
  g.fx.emit('ring', 270, 470, { size: 470, color: '#bff8ff', life: .5, add: true, wide: 12 });
  g.fx.emit('ring', 270, 470, { size: 620, color: '#ffffff', life: .62, add: true, wide: 6 });
  sfx('powerup', { pitch: 1.06, vol: .9 });
  sfx('laser', { pitch: 1.2, vol: .6 });
  g.hitstop(.07); g.shake(15); g.punch(.16);
  g.slowmo(.4, .3);
  if (g.post) { g.post.ripple(.5, .49, 1.5); g.post.bloom = 1.5; }
  bloom = 1; bgPulse = 1; bgTint = '120,240,255';
  g.showBanner(n > 2 ? `NINJA SLASH ×${n}` : 'NINJA SLASH', .7);
  if (n > 2) g.popup(`×${n} CLEAVE!`, 270, 560, '#5ff2ff', 36);
  stroke.n = 0; stroke.bullet = false;
  cat.hop = 1;
}

/* a 4-fruit swipe: the world holds its breath, the ripple rolls out from the blade */
function bulletTime(x, y) {
  stroke.bullet = true;
  g.slowmo(.3, .42);
  g.hitstop(.045);
  g.flash('#bff8ff', .18);
  g.punch(.12); g.shake(9);
  if (g.post) { g.post.ripple(x / W, y / H, 1.6); g.post.bloom = 1.6; }
  g.fx.emit('ring', x, y, { size: 430, color: '#cff9ff', life: .55, add: true, wide: 14 });
  g.fx.emit('ring', x, y, { size: 250, color: '#ffffff', life: .35, add: true, wide: 5 });
  g.fx.burst(x, y, 14, { kind: 'spark', color: ['#cff9ff', '#ffffff'], speed: 620, size: 7, life: .4 });
  sfx('glass', { pitch: .8, vol: .6 });
  sfx('shield', { pitch: .9, vol: .5 });
  g.showBanner(`${BULLET}-SLICE · BULLET TIME`, .8);
  g.popup(`${BULLET} IN ONE!`, x, y - 78, '#bff8ff', 34);
  bloom = 1; bgPulse = 1; bgTint = '140,235,255';
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  frame++;
  const live = g.mode === 'play';
  g.hud.hint = live && g.t < 3.4 ? 'swipe to slice · never touch a bomb' : '';

  cat.hop = Math.max(0, cat.hop - dt * 2.6);
  cat.hurt = Math.max(0, cat.hurt - dt * .8);
  par.x = damp(par.x, (g.ptr.x - W / 2) / W, 3, dt || 1 / 60);
  par.y = damp(par.y, (g.ptr.y - H / 2) / H, 2, dt || 1 / 60);

  /* the juice layer keeps breathing even through a hit-stop */
  const d = dt || 1 / 60;
  bloom = Math.max(0, bloom - bloom * 3.2 * d);
  bgPulse = Math.max(0, bgPulse - bgPulse * 2.1 * d);
  splashT = Math.max(0, splashT - splashT * 4 * d);
  if (chain.t > 0) { chain.t -= d; if (chain.t <= 0) chain.n = 0; }
  if (g.post) {
    g.post.bloom = .7 + bloom * .85 + Math.min(.4, g.combo.n * .035);
    g.post.ca = .34 + bloom * .55;
  }

  if (dt > 0) {
    /* fruit flight */
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.vy += GRAV * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
      if (it.y - it.r > H + 90 || it.x < -180 || it.x > W + 180) {
        items.splice(i, 1);
        if (!it.bomb && it.y - it.r > H + 90) hurt('MISSED!');
        else if (it.bomb) { /* a bomb that leaves quietly still costs you nothing */ }
      } else if (it.bomb && frame % 3 === 0) {
        g.fx.emit('spark', it.x + 26, it.y - it.r * .95, { vx: (R() - .5) * 60, vy: -40 - R() * 60, g: 120, life: .25, size: 5, color: '#ffd34d' });
        if (frame % 12 === 0) g.fx.emit('smoke', it.x + 26, it.y - it.r * .95, { size: 9, life: .5, color: 'rgba(120,120,140,.5)', vy: -40 });
      }
    }
    /* halves tumble away, shedding juice as they go */
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      const f = FRUIT[h.kind];
      h.t += dt; h.vy += GRAV * .85 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
      h.vx *= 1 - .7 * dt;
      h.drip -= dt;
      if (h.drip <= 0) {
        h.drip = .055 + R() * .06;
        g.fx.emit('dot', h.x, h.y + f.r * .2, { vx: (R() - .5) * 60, vy: 40 + R() * 60, g: 900, life: .5, size: 5 + R() * 4, color: f.juice });
      }
      if (h.y > H + 140) halves.splice(i, 1);
    }
    /* decals + slash streaks fade */
    for (let i = splats.length - 1; i >= 0; i--) { splats[i].t += dt; if (splats[i].t > splats[i].life) splats.splice(i, 1); }
    for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t > .24) slashes.splice(i, 1); }
    if (live) spawnWave(dt);
  }

  if (live) {
    bladeStep(dt);
    const b = g.btn('flash', 20, 802, 148, 98, 'SLASH', { key: 'KeyF', color: '#5ff2ff' });
    if (b.pressed) doFlash();
  } else if (g.mode === 'over' && !overFx) {
    overFx = true;
    if (!g.result?.win) cat.hurt = 1;
  }

  window.__dbg = { wt: +waveT.toFixed(2), fr: +g.freeze.toFixed(3), ts: +g.timeScale.toFixed(2), it: items.length, bx: Math.round(bot.x), by: Math.round(bot.y), lock: bot.lock, dumb: botDumb(), sl: g.state.sliced, ys: items.map(o=>Math.round(o.y)).join(','), xs: items.map(o=>Math.round(o.x)).join(',') };
  g.state.score = Math.round(g.score);
  g.state.combo = g.combo.n;
}

/* ------------------------------------------------------------------ art */
function drawFruit(c, kind, r) {
  const f = FRUIT[kind];
  if (kind === 'melon') {
    const gd = c.createRadialGradient(-r * .34, -r * .4, r * .06, 0, 0, r * 1.1);
    gd.addColorStop(0, '#7fdc86'); gd.addColorStop(.55, f.col); gd.addColorStop(1, f.dark);
    c.fillStyle = gd; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(18,74,30,.55)'; c.lineWidth = r * .13;
    for (const k of [-.62, -.2, .22, .64]) { c.beginPath(); c.moveTo(k * r * .9, -r); c.bezierCurveTo(k * r * 1.5, -r * .3, k * r * 1.5, r * .3, k * r * .9, r); c.stroke(); }
    c.restore();
  } else if (kind === 'orange') {
    const gd = c.createRadialGradient(-r * .34, -r * .4, r * .06, 0, 0, r * 1.1);
    gd.addColorStop(0, '#ffc76a'); gd.addColorStop(.6, f.col); gd.addColorStop(1, f.dark);
    c.fillStyle = gd; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(190,84,10,.28)';
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (.3 + (i % 3) * .22); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r * .05, 0, TAU); c.fill(); }
    c.fillStyle = '#3fae4f'; c.save(); c.translate(r * .12, -r * .92); c.rotate(-.5); c.beginPath(); c.ellipse(0, 0, r * .34, r * .16, 0, 0, TAU); c.fill(); c.restore();
  } else if (kind === 'berry') {
    const gd = c.createRadialGradient(-r * .34, -r * .4, r * .06, 0, 0, r * 1.1);
    gd.addColorStop(0, '#ff7ba4'); gd.addColorStop(.6, f.col); gd.addColorStop(1, f.dark);
    c.fillStyle = gd; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,236,245,.8)';
    for (let i = 0; i < 8; i++) { const a = i * .9 + .3, d = r * (.28 + (i % 3) * .2); c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * .045, r * .075, a, 0, TAU); c.fill(); }
    c.fillStyle = '#2f7d3a';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .45; c.beginPath(); c.moveTo(0, -r * .85); c.lineTo(Math.cos(a) * r * .55, -r * 1.02); c.lineTo(Math.cos(a + .18) * r * .2, -r * .8); c.closePath(); c.fill(); }
  } else {
    const gd = c.createRadialGradient(-r * .34, -r * .4, r * .06, 0, 0, r * 1.1);
    gd.addColorStop(0, '#f2ff8e'); gd.addColorStop(.6, f.col); gd.addColorStop(1, f.dark);
    c.fillStyle = gd; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(120,150,30,.35)'; c.lineWidth = r * .07;
    c.beginPath(); c.arc(-r * .15, 0, r * .78, -1.1, 1.1); c.stroke();
    c.fillStyle = '#3fae4f'; c.save(); c.translate(0, -r * .95); c.beginPath(); c.ellipse(r * .16, 0, r * .3, r * .13, -.4, 0, TAU); c.fill(); c.restore();
  }
  /* rim + specular */
  c.strokeStyle = 'rgba(0,0,0,.34)'; c.lineWidth = Math.max(2, r * .055);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.save(); c.globalAlpha = .5; c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-r * .36, -r * .4, r * .27, r * .17, -.7, 0, TAU); c.fill(); c.restore();
}

function drawItem(c, it) {
  c.save(); c.translate(it.x, it.y); c.rotate(it.rot);
  if (it.bomb) {
    const pulse = .5 + .5 * Math.sin(g.t * 9);
    c.strokeStyle = `rgba(255,70,70,${.28 + pulse * .4})`; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, it.r * 1.16, 0, TAU); c.stroke();
    const gd = c.createRadialGradient(-it.r * .35, -it.r * .4, it.r * .1, 0, 0, it.r * 1.1);
    gd.addColorStop(0, '#4a5062'); gd.addColorStop(.6, '#252a38'); gd.addColorStop(1, '#0b0d15');
    c.fillStyle = gd; c.beginPath(); c.arc(0, 0, it.r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = it.r * .1;
    c.beginPath(); c.moveTo(-it.r * .92, it.r * .1); c.lineTo(it.r * .92, it.r * .1); c.stroke();
    face(c, 'cat', -it.r * .1, it.r * .1, it.r * .42, '#dfe6f2');
    c.strokeStyle = '#7a5a2a'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(it.r * .1, -it.r * .92); c.quadraticCurveTo(it.r * .55, -it.r * 1.3, it.r * .82, -it.r * 1.02); c.stroke();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(it.r * .82, -it.r * 1.02, 4 + pulse * 3, 0, TAU); c.fill();
    /* danger halo so a bomb never hides behind fruit */
    c.globalAlpha = .18 + pulse * .16;
    c.strokeStyle = '#ff5a3c'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, it.r * 1.4, 0, TAU); c.stroke();
    c.globalAlpha = 1;
  } else drawFruit(c, it.kind, it.r);
  c.restore();
}

function drawHalf(c, h) {
  const f = FRUIT[h.kind], r = f.r;
  c.save(); c.translate(h.x, h.y); c.rotate(h.rot);
  /* cut face (pulp) */
  c.fillStyle = f.pulp; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.fillStyle = f.juice; c.globalAlpha = .55; c.beginPath(); c.arc(0, 0, r * .82, 0, TAU); c.fill(); c.globalAlpha = 1;
  c.fillStyle = 'rgba(80,40,10,.35)';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse((i - 1.5) * r * .3, r * .08, r * .05, r * .09, .3, 0, TAU); c.fill(); }
  /* skin on the outer half */
  c.save(); c.beginPath(); c.rect(-r - 3, -r - 3, (r + 3) * 2, r + 3); c.clip();
  drawFruit(c, h.kind, r);
  c.restore();
  /* wet cut line */
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();
  c.globalAlpha = .5; c.strokeStyle = f.spark; c.lineWidth = 5;
  c.beginPath(); c.moveTo(-r * .8, 0); c.lineTo(r * .8, 0); c.stroke(); c.globalAlpha = 1;
  c.restore();
}

/* --- background: parallax night garden ---------------------------------- */
let skyGrad = null;
function drawSky(c) {
  if (!skyGrad) {
    skyGrad = c.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#0a0a20'); skyGrad.addColorStop(.42, '#1b1034');
    skyGrad.addColorStop(.62, '#371642'); skyGrad.addColorStop(1, '#120c22');
  }
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, H);
  /* nebula glow — brightens with every big combo */
  const gr = c.createRadialGradient(400, 210, 0, 400, 210, 460);
  gr.addColorStop(0, `rgba(120,90,255,${.22 + bgPulse * .16})`);
  gr.addColorStop(.55, `rgba(70,40,140,${.1 + bgPulse * .08})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
}

function drawBackdrop(c) {
  const px = par.x, py = par.y;
  /* stars, 3 depths — they twinkle faster when a chain is running */
  const tw = 1 + bgPulse * 2;
  for (const s of stars) {
    const a = .35 + .45 * (Math.sin(g.t * s.w * tw + s.p) * .5 + .5);
    c.globalAlpha = Math.min(1, a + bgPulse * .2); c.fillStyle = '#dff0ff';
    c.fillRect(s.x + px * 8 * s.s, s.y + py * 4 * s.s, s.s, s.s);
  }
  c.globalAlpha = 1;
  /* moon — the light source for the whole scene */
  const mx = 404 + px * 14, my = 196 + py * 8;
  const halo = c.createRadialGradient(mx, my, 20, mx, my, 190);
  halo.addColorStop(0, `rgba(255,238,200,${.32 + bgPulse * .2})`); halo.addColorStop(.35, 'rgba(255,220,170,.1)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(mx, my, 190, 0, TAU); c.fill();
  const mg = c.createRadialGradient(mx - 26, my - 30, 8, mx, my, 78);
  mg.addColorStop(0, '#fff9e6'); mg.addColorStop(.7, '#ffeec4'); mg.addColorStop(1, '#e8cf9a');
  c.fillStyle = mg; c.beginPath(); c.arc(mx, my, 78, 0, TAU); c.fill();
  c.fillStyle = 'rgba(214,186,140,.45)';
  for (const [dx, dy, cr] of [[-20, 8, 15], [22, -20, 10], [10, 30, 8], [-36, -26, 6]]) { c.beginPath(); c.arc(mx + dx, my + dy, cr, 0, TAU); c.fill(); }

  /* lantern string — swells with the combo */
  const lk = 1 + bgPulse * .35;
  for (const l of lanterns) {
    const sw = Math.sin(g.t * 1.3 + l.p) * 5;
    const x = l.x + px * 20, y = l.y + sw + py * 10;
    c.strokeStyle = 'rgba(255,220,180,.18)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, 60 + px * 16); c.quadraticCurveTo(x, y - 40, x, y - 20); c.stroke();
    const gl = c.createRadialGradient(x, y, 2, x, y, 46 * l.s * lk);
    gl.addColorStop(0, `rgba(255,190,110,${.5 + bgPulse * .3})`); gl.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(x, y, 46 * l.s * lk, 0, TAU); c.fill();
    c.fillStyle = '#ffb45a'; rr(c, x - 13 * l.s, y - 16 * l.s, 26 * l.s, 32 * l.s, 11 * l.s); c.fill();
    c.strokeStyle = 'rgba(140,50,20,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x - 13 * l.s, y); c.lineTo(x + 13 * l.s, y); c.stroke();
  }

  /* far ridge */
  c.beginPath(); c.moveTo(-40 + px * 26, 700);
  for (let i = 0; i < ridgeA.length; i++) c.lineTo(-40 + i * 44 + px * 26, ridgeA[i] + py * 14);
  c.lineTo(W + 40 + px * 26, 800); c.lineTo(W + 40 + px * 26, H); c.lineTo(-40 + px * 26, H); c.closePath();
  c.fillStyle = '#1a1236'; c.fill();
  /* mid ridge */
  c.beginPath(); c.moveTo(-40 + px * 44, 790);
  for (let i = 0; i < ridgeB.length; i++) c.lineTo(-40 + i * 52 + px * 44, ridgeB[i] + py * 20);
  c.lineTo(W + 40 + px * 44, 860); c.lineTo(W + 40 + px * 44, H); c.lineTo(-40 + px * 44, H); c.closePath();
  c.fillStyle = '#241a48'; c.fill();

  /* torii gate silhouettes, two depths */
  torii(c, 96 + px * 58, 846, 1.05, '#150e2c');
  torii(c, 452 + px * 58, 812, .82, '#150e2c');

  /* near ground the cat stands on */
  c.beginPath(); c.moveTo(-40, 940);
  c.quadraticCurveTo(180, 890, 340, 928); c.quadraticCurveTo(450, 950, W + 40, 920);
  c.lineTo(W + 40, H); c.lineTo(-40, H); c.closePath();
  c.fillStyle = '#0e0a1c'; c.fill();
  c.strokeStyle = `rgba(255,190,120,${.16 + bgPulse * .2})`; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-40, 940); c.quadraticCurveTo(180, 890, 340, 928); c.quadraticCurveTo(450, 950, W + 40, 920); c.stroke();

  /* fireflies */
  for (const f of fire) {
    const y = ((f.y - g.t * f.sp * (1 + bgPulse)) % 900 + 900) % 900 + 60;
    const a = .25 + .55 * (Math.sin(g.t * 1.7 + f.p) * .5 + .5);
    c.globalAlpha = Math.min(1, a + bgPulse * .3);
    const gg = c.createRadialGradient(f.x + px * 34, y, 0, f.x + px * 34, y, 12 * f.s);
    gg.addColorStop(0, 'rgba(255,240,160,.95)'); gg.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(f.x + px * 34, y, 12 * f.s, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;

  /* the whole garden blushes when a big combo lands */
  if (bgPulse > .01) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = bgPulse * .13; c.fillStyle = `rgb(${bgTint})`;
    c.fillRect(0, 0, W, H);
    c.restore();
    c.globalCompositeOperation = 'source-over';
  }
}

function torii(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col;
  c.fillRect(-62, -232, 16, 232); c.fillRect(46, -232, 16, 232);
  c.beginPath(); c.moveTo(-84, -206); c.lineTo(84, -206); c.lineTo(84, -192); c.lineTo(-84, -192); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-96, -248); c.quadraticCurveTo(0, -224, 96, -248); c.lineTo(92, -236); c.quadraticCurveTo(0, -214, -92, -236); c.closePath(); c.fill();
  c.fillRect(-8, -232, 16, 232);
  c.restore();
}

/* --- the hero cat ------------------------------------------------------ */
function drawHero(c) {
  const h = cat.h;
  const bob = Math.sin(g.t * 2.1) * 3;
  const hop = Math.sin(cat.hop * Math.PI) * 30;
  const x = cat.x + (cat.hurt > 0 ? Math.sin(g.t * 62) * 7 * cat.hurt : 0);
  const y = cat.y - bob - hop;
  const dir = 1;
  /* moonlit rim light behind the cat */
  const gl = c.createRadialGradient(x, y - h * .5, 10, x, y - h * .5, h * .85);
  gl.addColorStop(0, 'rgba(255,196,120,.16)'); gl.addColorStop(1, 'rgba(255,150,60,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(x, y - h * .5, h * .85, 0, TAU); c.fill();

  drawChar('cat', c, x, y, h, { dir, color: cat.hurt > .5 ? '#ff8a6a' : '#ff9a3c', anim: cat.hop > .04 ? 'walk' : undefined, t: g.t, hurt: cat.hurt > .3 });

  /* ninja headband + flowing ribbons (reads even at a glance) */
  const s = h / 100, hx = x + dir * 28 * s, hy = y - 60 * s;
  c.save(); c.translate(hx, hy);
  c.strokeStyle = '#5ff2ff'; c.lineWidth = h * .05; c.lineCap = 'round';
  c.beginPath(); c.ellipse(0, 0, h * .195, h * .175, 0, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
  c.fillStyle = '#5ff2ff'; c.beginPath(); c.arc(-dir * h * .17, h * .01, h * .035, 0, TAU); c.fill();
  c.strokeStyle = '#3fd8ee'; c.lineWidth = h * .026;
  for (const k of [0, 1]) {
    const w = Math.sin(g.t * 3.6 + k * 1.5) * h * .05;
    c.beginPath(); c.moveTo(-dir * h * .19, h * .01);
    c.quadraticCurveTo(-dir * h * .34, -h * .02 + w, -dir * h * .46, h * .07 + w); c.stroke();
  }
  c.restore();
  /* whisker glints on the blade side */
  c.globalAlpha = .5; c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x + dir * h * .44, y - h * .66); c.lineTo(x + dir * h * .58, y - h * .7); c.stroke();
  c.globalAlpha = 1;
}

/* --- the blade --------------------------------------------------------- */
function drawBlade(c) {
  /* cut streaks where fruit was sliced: a white wedge with a hot core */
  for (const s of slashes) {
    const k = 1 - s.t / .24;
    const ex = 1 + (1 - k) * .35;
    c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.globalCompositeOperation = 'lighter'; c.globalAlpha = k * .95;
    c.fillStyle = 'rgba(160,250,255,.55)';
    c.beginPath();
    c.moveTo(-s.len * .5 * ex, 0); c.quadraticCurveTo(0, -7 * k, s.len * .5 * ex, 0);
    c.quadraticCurveTo(0, 7 * k, -s.len * .5 * ex, 0); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, 8 * k); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-s.len * .62 * ex, 0); c.lineTo(s.len * .62 * ex, 0); c.stroke();
    c.strokeStyle = 'rgba(120,240,255,.9)'; c.lineWidth = Math.max(1, 2.6 * k);
    c.beginPath(); c.moveTo(-s.len * .78 * ex, 0); c.lineTo(s.len * .78 * ex, 0); c.stroke();
    c.restore();
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;

  const n = trail.length;
  if (n < 2) return;

  /* offsets per point, so every pass is a genuinely tapered ribbon */
  const off = [];
  for (let i = 0; i < n; i++) {
    const a = trail[Math.max(0, i - 1)], b = trail[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    off.push({ nx: -dy, ny: dx });
  }
  const speedK = clamp(bladeSpeed / 1700, 0, 1);
  const passes = [
    [40, 'rgba(40,190,255,.09)'],
    [25, 'rgba(80,225,255,.15)'],
    [13, 'rgba(160,248,255,.3)'],
    [4.5, 'rgba(255,255,255,.9)'],
  ];

  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [base, col] of passes) {
    const w0 = base * (.45 + speedK * .55);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), tape = .18 + .82 * Math.pow(u, 1.5);
      const w = w0 * tape * .5;
      const x = trail[i].x + off[i].nx * w, y = trail[i].y + off[i].ny * w;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const u = i / (n - 1), tape = .18 + .82 * Math.pow(u, 1.5);
      const w = w0 * tape * .5;
      c.lineTo(trail[i].x - off[i].nx * w, trail[i].y - off[i].ny * w);
    }
    c.closePath(); c.fillStyle = col; c.fill();
  }

  /* shimmer: three bright pulses running along the ribbon */
  const sp = (g.t * 2.4) % 1;
  for (let k = 0; k < 3; k++) {
    const u = (sp + k / 3) % 1;
    const i0 = Math.floor(u * (n - 1)), i1 = Math.min(n - 1, i0 + 3);
    if (i1 - i0 < 1) continue;
    c.globalAlpha = .22 + .4 * (.5 + .5 * Math.sin(u * Math.PI * 3 + g.t * 9));
    c.strokeStyle = '#fff'; c.lineWidth = 2 + 2.6 * u; c.lineCap = 'round';
    c.beginPath(); c.moveTo(trail[i0].x, trail[i0].y);
    for (let i = i0 + 1; i <= i1; i++) c.lineTo(trail[i].x, trail[i].y);
    c.stroke();
  }
  c.globalAlpha = 1;

  /* leading edge: a hot crescent that points where the blade is going */
  const tip = trail[n - 1];
  const anc = trail[Math.max(0, n - 4)];
  let ea = Math.atan2(tip.y - anc.y, tip.x - anc.x);
  if (!isFinite(ea)) ea = 0;
  const len = 44 + Math.min(78, bladeSpeed * .05);
  c.save(); c.translate(tip.x, tip.y); c.rotate(ea);
  const gd = c.createLinearGradient(-len, 0, 10, 0);
  gd.addColorStop(0, 'rgba(90,220,255,0)');
  gd.addColorStop(.5, 'rgba(150,245,255,.5)');
  gd.addColorStop(.9, 'rgba(255,255,255,.9)');
  gd.addColorStop(1, 'rgba(255,255,255,.2)');
  c.fillStyle = gd;
  c.beginPath();
  c.moveTo(-len, 0); c.quadraticCurveTo(-len * .3, -6 - speedK * 4, 8, -1.5);
  c.lineTo(10, 1.5); c.quadraticCurveTo(-len * .3, 6 + speedK * 4, -len, 0);
  c.fill();
  const tg = c.createRadialGradient(0, 0, 0, 0, 0, 40 + speedK * 24);
  tg.addColorStop(0, 'rgba(255,255,255,.95)'); tg.addColorStop(.32, 'rgba(140,245,255,.45)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = tg; c.beginPath(); c.arc(0, 0, 40 + speedK * 24, 0, TAU); c.fill();
  c.restore();
  c.restore();
}

/* ------------------------------------------------------------------ draw */
function draw(c) {
  drawSky(c);
  drawBackdrop(c);

  /* juice decals: they slam out, stick, then fade */
  for (const s of splats) {
    const stick = clamp(s.t / .08, 0, 1);
    const fade = clamp(1 - Math.max(0, s.t - s.life * .55) / (s.life * .45), 0, 1);
    const sc = .72 + stick * .28;
    c.save(); c.translate(s.x, s.y); c.rotate(s.rot); c.scale(sc, sc);
    c.globalAlpha = fade * .5 * stick;
    c.fillStyle = s.col;
    for (const b of s.blobs) { c.beginPath(); c.ellipse(b.dx, b.dy, b.r, b.r * .82, b.dx * .01, 0, TAU); c.fill(); }
    c.globalAlpha = fade * .28 * stick; c.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { const b = s.blobs[i]; if (b) { c.beginPath(); c.ellipse(b.dx - b.r * .2, b.dy - b.r * .25, b.r * .3, b.r * .18, -.5, 0, TAU); c.fill(); } }
    c.restore();
  }
  c.globalAlpha = 1;

  drawHero(c);

  for (const h of halves) drawHalf(c, h);
  for (const it of items) drawItem(c, it);
  drawBlade(c);

  /* night vignette so the HUD reads */
  const vg = c.createLinearGradient(0, 0, 0, 200);
  vg.addColorStop(0, 'rgba(4,4,12,.55)'); vg.addColorStop(1, 'rgba(4,4,12,0)');
  c.fillStyle = vg; c.fillRect(0, 0, W, 200);
}

/* ------------------------------------------------------------------ HUD */
function chip(c, x, y, w, h) {
  const gd = c.createLinearGradient(0, y, 0, y + h);
  gd.addColorStop(0, 'rgba(26,32,58,.88)'); gd.addColorStop(1, 'rgba(8,10,22,.92)');
  rr(c, x, y, w, h, 16); c.fillStyle = gd; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.moveTo(x + 16, y + 2.5); c.lineTo(x + w - 16, y + 2.5);
  c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.5; c.stroke();
}

function hud(c) {
  const st = g.state;
  chip(c, 18, 22, 150, 64);
  g.text('SCORE', 32, 46, { size: 15, color: 'rgba(255,255,255,.55)' });
  g.text(String(Math.round(g.score)), 30, 78, { size: 38, color: '#ffd34d' });

  chip(c, 178, 22, 122, 64);
  for (let i = 0; i < LIVES; i++) {
    c.globalAlpha = i < st.lives ? 1 : .2;
    face(c, 'cat', 206 + i * 33, 54, 15, i < st.lives ? '#ff9a3c' : '#8892a8');
  }
  c.globalAlpha = 1;

  chip(c, 310, 22, 212, 64);
  g.text('SLICES', 324, 44, { size: 14, color: 'rgba(255,255,255,.55)' });
  g.text(`${st.sliced}/${GOAL}`, 508, 46, { size: 20, align: 'right', color: '#fff' });
  const p = clamp(st.sliced / GOAL, 0, 1);
  rr(c, 324, 54, 184, 14, 7); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
  if (p > 0) {
    const bg2 = c.createLinearGradient(324, 0, 508, 0);
    bg2.addColorStop(0, '#2fe0ff'); bg2.addColorStop(1, '#a4ffff');
    rr(c, 324, 54, Math.max(10, 184 * p), 14, 7); c.fillStyle = bg2; c.fill();
    c.globalAlpha = .55 + .45 * Math.sin(g.t * 6);
    rr(c, 324 + Math.max(10, 184 * p) - 10, 54, 10, 14, 5); c.fillStyle = '#fff'; c.fill(); c.globalAlpha = 1;
  }

  /* chain readout under the combo meter */
  if (chain.n >= 2 && chain.t > 0) {
    const k = clamp(chain.t / 1.7, 0, 1);
    c.save(); c.globalAlpha = .35 + .65 * k;
    g.text(`CHAIN ×${chain.n}`, 508, 132, { size: 22, align: 'right', color: '#5ff2ff' });
    c.globalAlpha = .35 + .3 * k;
    c.strokeStyle = '#5ff2ff'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(508, 140); c.lineTo(508 - 120 * k, 140); c.stroke();
    c.restore();
  }

  /* SLASH charges */
  for (let i = 0; i < 3; i++) {
    c.globalAlpha = i < flash ? 1 : .22;
    c.fillStyle = '#5ff2ff';
    c.beginPath(); c.arc(30 + i * 20, 784, 6.5, 0, TAU); c.fill();
    if (i < flash) { c.globalAlpha = .5; c.beginPath(); c.arc(30 + i * 20, 784, 11, 0, TAU); c.strokeStyle = '#5ff2ff'; c.lineWidth = 1.5; c.stroke(); }
  }
  c.globalAlpha = 1;
  g.text('F / TAP', 96, 789, { size: 16, color: 'rgba(255,255,255,.4)', stroke: 0 });
}

g.run(update, draw, hud);

// TOWER PERFECT — stack-timing (Cat Arcade v2)
// Tap to drop the slab. Land it dead centre for a PERFECT chain and the tower never shrinks.
import { makeGame, sfx, music, comboPitch, clamp, lerp, damp, rnd, chance, ease, TAU, rr, fmt } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'stack-timing', title: 'TOWER PERFECT', sub: 'TAP TO DROP  ·  CENTRE IT',
  hook: 'one pixel off and the tower falls', w: W, h: H, bg: '#0a0818', style: 'neon',
  bloom: .92, ca: .38, vig: 1, scan: .18,
});

const BH = 56;                  // slab height
const BASE = 268;               // starting slab width
const PERFECT = 9;              // px tolerance for a perfect
const WIN = 14;                 // slabs to win (auto run)

let tower, cur, camY, camT, t, autoT, host, bonus;
const isAuto = new URLSearchParams(location.search).has('auto');

const hueOf = i => (196 + i * 11) % 360;
const slabW = i => Math.max(46, BASE - i * 2);

/* ------------------------------------------------------------------ feel state
   every one of these is a plain scalar: no per-frame allocation anywhere. */
let settle = 0, settleV = 0;      // the whole tower is a jello spring — squash on impact
let camK = 0, camKV = 0;          // camera overshoot kick (weight, not drunk)
let spawnPop = 1;                 // a new slab scales in instead of teleporting
let scoreShown = 0, scorePop = 1; // the HUD counter eases + punches
let tickCd = 0, nearGlow = 0;     // proximity "you're aligned" glow + tick
let chainPulse = 0;               // multiplier badge punch
let floorTold = 0;                // highest milestone already announced
const GH = { t: 1, x: 0, w: 0, y: 0, hue: 200 };   // landing squash ghost
const HUD = { s: 1 };
const MUL = { s: 1 };

/* ------------------------------------------------------------------ world */
function resetWorld() {
  tower = [{ x: W / 2 - BASE / 2, w: BASE, i: 0, perfect: true, hue: hueOf(0) }];
  cur = null; camY = 0; autoT = 0; bonus = 0; t = 0;
  host = { hop: 0, squash: 1, x: W / 2 };
  camT = camTarget(1); camY = camT; camK = 0; camKV = 0;
  settle = 0; settleV = 0; spawnPop = 1; scoreShown = 0; scorePop = 1;
  tickCd = 0; nearGlow = 0; chainPulse = 0; floorTold = 0;
  GH.t = 1; HUD.s = 1; MUL.s = 1;
  g.score = 0; g.state = { score: 0, height: 0, combo: 0 };
  g.combo.reset(); g.fx.clear();
  spawnSlab();
}
g.onReset = resetWorld;
g.onStart = () => music('chase');
resetWorld();

function top() { return tower[tower.length - 1]; }
function slabY(i) { return -(i + 1) * BH; }                       // world y of slab i's top face
function camTarget(n) { return -H * .23 + (n + 1) * BH; }         // keep the working deck near mid-screen
function spawnSlab() {
  const i = tower.length, base = slabW(i);
  const dir = chance(.5) ? 1 : -1;
  const spd = 200 + Math.min(210, i * 15);
  cur = { w: base, x: dir > 0 ? -base : W, spd, dir, i, hue: hueOf(i) };
  spawnPop = 0;
  sfx('whoosh', { vol: .16, pitch: .9 + Math.min(.6, i * .03) });   // the slab slides in: audio cue
}

/* ------------------------------------------------------------------ feedback recipes */
/** soft landing: dust puffs, not sparks — the material is stone */
function landDust(x, y, n, col) {
  g.fx.dust(x, y, n, { color: col || 'rgba(190,228,255,.42)', size: 17, speed: 150, up: 80, spread: 40 });
}

/** PERFECT: sharp, fast, additive sparks + white core + bloom hit */
function perfectJuice(x, y, w) {
  const pitch = comboPitch(g.combo.n);
  sfx('perfect', { pitch });
  sfx('coinchain', { pitch: pitch * 1.12, vol: .45 });
  g.impact(x, y, { punch: .105, shake: 11, stop: .05, rip: 1.3, flash: '#9ff8ff', flashA: .26 });
  g.fx.burst(x, y, 24, { kind: 'spark', color: ['#d8ffff', '#7df9ff', '#ff4ad8'], speed: 430, life: .42, size: 5.5, drag: 2.2, ang: -Math.PI / 2, spread: 2.6 });
  g.fx.burst(x, y, 10, { kind: 'star', color: ['#fff', '#ffd34d'], speed: 190, life: .7, size: 9, g: 260 });
  g.fx.emit('ring', x, y, { size: Math.max(70, w * .9), life: .34, color: '#bffcff', add: true, wide: 7 });
  landDust(x, y + 10, 5, 'rgba(150,240,255,.42)');
  settle += .55; settleV = -1.2;
  camKV -= 26;
  g.tween(HUD, 's', 1, .34, ease.outCubic); HUD.s = 1.22;
  g.tween(MUL, 's', 1, .38, ease.outBack); MUL.s = 1.5; chainPulse = 1;
  sfx('pop', { pitch: 1.5 + Math.min(.8, g.combo.n * .06), vol: .35 });
}

/** solid but not centred: dust + a couple of chips + a modest punch */
function goodJuice(x, y, w, off) {
  const pitch = comboPitch(g.combo.n);
  sfx('snap', { pitch });
  g.impact(x, y, { punch: .07, shake: 7, stop: .04, rip: .8, flash: '#bfe6ff', flashA: .12 });
  g.fx.burst(x, y, 12, { kind: 'spark', color: ['#cfe9ff', '#8fd6ff'], speed: 260, life: .36, size: 4.5, drag: 1.8 });
  g.fx.burst(x, y + 6, 5, { kind: 'debris', color: `hsl(${cur ? cur.hue : 200} 70% 60%)`, speed: 150, life: .55, size: 6, g: 1200 });
  landDust(x, y + 12, 7);
  settle += .34; settleV = -.7; camKV -= 14;
  g.tween(HUD, 's', 1, .3, ease.outCubic); HUD.s = 1.1;
}

/** sloppy: heavier dust, dull thud, no bright flash — it should feel *wrong* */
function sloppyJuice(x, y, w) {
  sfx('thud', { pitch: .82 + Math.min(.3, g.combo.n * .02) });
  g.punch(.055); g.shake(9);
  g.hitstop(.03);
  g.fx.burst(x, y + 6, 14, { kind: 'debris', color: ['#54406e', '#2b2140', '#8f7fb0'], speed: 190, life: .7, size: 8, g: 1500, ang: -Math.PI / 2, spread: 2.4 });
  landDust(x, y + 12, 11, 'rgba(160,150,190,.4)');
  settle += .7; settleV = -1.6; camKV -= 20;
}

/* ------------------------------------------------------------------ input */
function drop() {
  if (!cur || g.mode !== 'play') return;
  const prev = top();
  const a = Math.max(cur.x, prev.x), b = Math.min(cur.x + cur.w, prev.x + prev.w);
  const ov = b - a;
  const cy0 = slabY(tower.length) + BH;                 // contact plane
  const cxMid = cur.x + cur.w / 2, pMid = prev.x + prev.w / 2;
  const off = Math.abs(cxMid - pMid);
  const hue = cur.hue, cw = cur.w;

  if (ov <= 4) {
    /* total miss — the slab tumbles into the void */
    g.slowmo(.36, .5);
    g.impact(cxMid, cy0, { punch: .24, shake: 26, stop: .07, rip: 1.6, flash: '#ff3b5c', flashA: .45 });
    g.fx.emit('ring', cxMid, cy0, { size: 210, life: .5, color: '#ff3b5c', add: true, wide: 10 });
    g.fx.burst(cxMid, cy0, 30, { kind: 'debris', color: ['#ff3b5c', `hsl(${hue} 90% 62%)`, '#2b2140', '#fff'], speed: 360, life: 1.05, size: 11, g: 1600 });
    g.fx.burst(cxMid, cy0, 20, { kind: 'spark', color: ['#fff', '#ff8a9c'], speed: 480, life: .5, size: 6 });
    landDust(pMid, cy0 + 8, 12, 'rgba(255,120,150,.4)');
    sfx('boom', { pitch: .78 }); sfx('glass', { pitch: .7, vol: .5 });
    g.popup('MISS!', cxMid, cy0 - 46, '#ff5c78', 46);
    g.showBanner('THE TOWER FALLS', 1.1);
    g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: Math.round(clamp((tower.length - 1) / (WIN + 1), 0, 1) * 100) });
    return;
  }

  tower.push({ x: a, w: ov, i: tower.length, perfect: off <= PERFECT, hue });

  /* the landing ghost: the slab squashes into place (anticipation → snap) */
  GH.x = a; GH.w = ov; GH.y = cy0; GH.hue = hue; GH.t = 0;
  g.tween(GH, 't', 1, .24, ease.outBack);

  if (off <= PERFECT) {
    bonus += 10 * g.combo.mult;
    g.combo.hit(cxMid, cy0 + 10, 'PERFECT');
    perfectJuice(cxMid, cy0 + 4, ov);
    if (g.combo.mult >= 3) { g.showBanner(`${g.combo.mult}× CHAIN`, .8); sfx('powerup', { pitch: comboPitch(g.combo.n), vol: .45 }); }
  } else if (off < cw * .34) {
    bonus += 4;
    g.combo.hit(cxMid, cy0 + 10, 'GOOD');
    goodJuice(cxMid, cy0 + 4, ov, off);
  } else {
    bonus += 1;
    g.combo.miss();
    sloppyJuice(cxMid, cy0 + 4, ov);
    g.popup('SLOPPY', cxMid, cy0 - 30, '#a08cc0', 26);
  }

  /* the trimmed offcut breaks away: chunks with rotation and gravity */
  const cutW = cw - ov;
  if (cutW > 3) {
    const cutX = (a === cur.x) ? cur.x + ov : cur.x;
    const n = Math.min(16, 5 + Math.round(cutW / 9));
    g.fx.burst(cutX + cutW / 2, cy0 + BH / 2, n, {
      kind: 'debris', color: [`hsl(${hue} 92% 64%)`, `hsl(${hue} 80% 40%)`, '#1a1430'],
      speed: 170 + cutW, life: .95, size: 9, g: 1500, ang: -Math.PI / 2, spread: 2.7, drag: .4,
    });
    g.fx.emit('debris', cutX + cutW / 2, cy0 + BH / 2, {
      vx: 24, vy: -140, g: 1500, life: 1.1, size: Math.min(26, 10 + cutW * .25), color: `hsl(${hue} 86% 54%)`,
      rot: 0, vr: 6.5, drag: .1,
    });
    if (cutW > 40) { sfx('glass', { vol: .22, pitch: 1.25 }); g.fx.burst(cutX + cutW / 2, cy0 + BH / 2, 4, { kind: 'spark', color: `hsl(${hue} 100% 78%)`, speed: 200, life: .3, size: 4 }); }
  }

  /* the cat hops onto the new floor */
  host.hop = 1; host.squash = .68;
  camT = camTarget(tower.length);
  g.fx.dust(host.x, slabY(tower.length) + BH, 8, { color: 'rgba(200,240,255,.5)', size: 14, speed: 110, up: 70 });
  sfx('step', { vol: .3, pitch: 1.3 + rnd(0, .1) });
  cur = null;

  /* milestone banner keeps a 14-floor climb legible */
  const fl = tower.length - 1;
  if (fl > floorTold && fl % 5 === 0 && fl < WIN) { floorTold = fl; g.showBanner(`FLOOR ${fl}`, .7); sfx('ding', { pitch: 1.2, vol: .4 }); }

  if (fl >= WIN) {
    g.slowmo(.5, .9);
    g.flash('#fff', .5); g.shake(16);
    g.fx.burst(W / 2, H * .42, 90, { kind: 'confetti', color: ['#7df9ff', '#ffd34d', '#ff4ad8', '#7dff7d', '#fff'], speed: 560, life: 2, g: 400, size: 7 });
    g.fx.blast(W / 2, H * .46, { r: 220, color: '#7df9ff', colors: ['#7df9ff', '#fff', '#ffd34d'], n: 40, speed: 520, shake: 12, punch: .12, flashA: .28 });
    sfx('fanfare', { vol: .9 });
    g.showBanner('TOWER COMPLETE', 1.6);
    g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 100 });
    return;
  }
  spawnSlab();
}

/* ------------------------------------------------------------------ auto bot */
function botThink() {
  if (!cur) return;
  const prev = top(), dumb = g.dumb();
  const target = prev.x + prev.w / 2;
  const mid = cur.x + cur.w / 2;
  const step = cur.spd * (1 / 60) * cur.dir;
  if (dumb) { if (Math.abs(mid - target) < 96 + Math.sin(t * 2) * 50) drop(); return; }
  /* frame-accurate: drop on the frame the centre crosses the deck centre */
  if ((mid - target) * cur.dir <= 0 && (mid + step - target) * cur.dir >= 0) drop();
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  t += dt;
  if (cur) {
    cur.x += cur.spd * cur.dir * dt;
    if (cur.x < -cur.w) { cur.x = W; }
    if (cur.x > W) { cur.x = -cur.w; }
  }
  if (isAuto && g.mode === 'play') { autoT += dt; botThink(); }
  else if (g.taps.length && g.mode === 'play') drop();

  /* camera: eased rise + an overshoot kick on every impact */
  camKV += -camK * 260 * dt; camKV *= Math.exp(-9 * dt); camK += camKV * dt;
  camY = damp(camY, camT, 7, dt) + camK;

  /* jello tower */
  settleV += -settle * 560 * dt; settleV *= Math.exp(-10 * dt); settle += settleV * dt;
  settle = clamp(settle, -.6, 1.7);

  /* cat body */
  host.hop = Math.max(0, host.hop - dt * 3.2);
  host.squash = damp(host.squash, 1, 11, dt);
  host.x = damp(host.x, top().x + 22, 12, dt);

  /* slab scale-in */
  spawnPop = damp(spawnPop, 1, 20, dt);

  /* HUD */
  scoreShown = damp(scoreShown, g.score, 10, dt);
  scorePop = damp(scorePop, 1, 8, dt);
  HUD.s = damp(HUD.s, 1, 9, dt);
  chainPulse = Math.max(0, chainPulse - dt * 2.4);

  /* proximity glow + tick: the "you're aligned" tell */
  if (cur) {
    const prev = top();
    const d = Math.abs((cur.x + cur.w / 2) - (prev.x + prev.w / 2));
    const near = clamp(1 - d / 54, 0, 1);
    nearGlow = damp(nearGlow, near, 16, dt);
    tickCd -= dt;
    if (d < 15 && tickCd <= 0) { sfx('tick', { pitch: 1.75 + near * .5, vol: .2 }); tickCd = .17; }
  } else nearGlow = damp(nearGlow, 0, 10, dt);

  g.score = Math.round(tower.length - 1) * 10 + bonus;
  g.state = { score: Math.round(g.score), height: tower.length - 1, combo: g.combo.mult };
  if (isAuto && autoT > 120) g.end({ win: true, score: tower.length - 1, label: 'FLOORS' });
}

/* ------------------------------------------------------------------ drawing */
const MOTES = Array.from({ length: 20 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: .7 + rnd(1.9), v: 7 + rnd(26), a: .1 + rnd(.3) }));
const STARS = Array.from({ length: 52 }, () => ({ x: rnd(0, W), y: rnd(0, H * .78), r: .5 + rnd(1.6), ph: rnd(0, TAU) }));
const GRAD = new Map();
function slabGrad(ctx, hue) {
  let gr = GRAD.get(hue);
  if (!gr) {
    if (GRAD.size > 48) GRAD.clear();
    gr = ctx.createLinearGradient(0, 0, 0, BH);
    gr.addColorStop(0, `hsl(${hue} 94% 68%)`); gr.addColorStop(.5, `hsl(${hue} 86% 50%)`); gr.addColorStop(1, `hsl(${hue} 82% 33%)`);
    GRAD.set(hue, gr);
  }
  return gr;
}
let skyKey = -1, skyGrad = null, glowGrad = null;

function skyFor(h) {
  const k = clamp(h / 26, 0, 1);
  const a = [12 + 26 * k, 9 + 16 * k, 40 + 62 * k];
  const b = [86 - 40 * k, 40 - 20 * k, 120 + 62 * k];
  return { a: `rgb(${a.map(Math.round)})`, b: `rgb(${b.map(Math.round)})` };
}

function drawSky(ctx) {
  const key = Math.round(clamp(tower.length / 26, 0, 1) * 10) / 10;
  if (key !== skyKey) {
    skyKey = key;
    const { a, b } = skyFor(tower.length);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, a); sky.addColorStop(.55, b); sky.addColorStop(1, '#05040c');
    skyGrad = sky;
  }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

  /* breathing moon glow behind the tower — the whole frame is never static */
  if (!glowGrad) {
    const gr = ctx.createRadialGradient(W / 2, H * .3, 10, W / 2, H * .3, W * .95);
    gr.addColorStop(0, 'rgba(140,205,255,.24)'); gr.addColorStop(.5, 'rgba(120,90,230,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    glowGrad = gr;
  }
  ctx.globalAlpha = .72 + .28 * Math.sin(t * .9);
  ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  /* star field, parallaxed by the camera */
  const camP = camY * .04;
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const y = ((s.y + camP) % (H * .78) + H * .78) % (H * .78);
    ctx.globalAlpha = .22 + .5 * (.5 + .5 * Math.sin(t * 1.8 + s.ph));
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(s.x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function skyline(ctx, off, col, base, amp) {
  ctx.fillStyle = col;
  for (let i = 0; i < 10; i++) {
    const bw = 54 + (i % 3) * 32;
    const bh = amp + ((i * 127) % 180);
    let x = ((i * 74 - off) % 740 + 740) % 740 - 110;
    if (x > W + 20) continue;
    ctx.fillRect(x, base - bh, bw, bh + 220);
  }
}

function drawBackdrop(ctx) {
  skyline(ctx, camY * .05, '#0b0820', H - 30, 120);
  skyline(ctx, camY * .13, '#141033', H - 20, 70);
  /* window lights on the near layer — a few twinkles, cheap */
  ctx.fillStyle = 'rgba(255,214,130,.55)';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 97 - camY * .13) % 640 + 640) % 640;
    const y = H - 60 - ((i * 71) % 150);
    ctx.globalAlpha = .25 + .5 * (.5 + .5 * Math.sin(t * 2.1 + i));
    ctx.fillRect(x, y, 4, 6);
  }
  ctx.globalAlpha = 1;
}

function drawTower(ctx) {
  const contactY = slabY(tower.length - 1);
  ctx.save();
  /* squash the whole tower around the contact plane: weight, not wobble */
  ctx.translate(0, contactY);
  ctx.scale(1 + settle * .014, 1 - settle * .022);
  ctx.translate(0, -contactY);

  for (let idx = 0; idx < tower.length; idx++) {
    const s = tower[idx], y = slabY(idx), hue = s.hue;
    ctx.save();
    ctx.translate(s.x, y);
    ctx.fillStyle = `hsl(${hue} 76% 22%)`;
    ctx.fillRect(7, 8, s.w, BH);
    ctx.fillStyle = slabGrad(ctx, hue);
    ctx.fillRect(0, 0, s.w, BH);
    ctx.fillStyle = `hsl(${hue} 100% 84%)`; ctx.fillRect(0, 0, s.w, 6);
    ctx.strokeStyle = 'rgba(6,4,18,.7)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, s.w, BH);
    if (s.perfect) {
      ctx.globalAlpha = .3 + .35 * Math.sin(t * 6 + idx * .8);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s.w, 5); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = .5; ctx.fillStyle = `hsl(${hue} 100% 80%)`;
    ctx.fillRect(0, 6, 3, BH - 8); ctx.fillRect(s.w - 3, 6, 3, BH - 8);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();

  /* landing ghost: a squash that snaps into the stack */
  if (GH.t < 1) {
    const u = GH.t, k = 1 - u;
    ctx.save();
    ctx.translate(GH.x + GH.w / 2, GH.y);
    ctx.scale(1 + k * .16, .74 + u * .26);
    ctx.globalAlpha = k * .9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-GH.w / 2, 0, GH.w, BH);
    ctx.globalAlpha = k * .8;
    ctx.strokeStyle = `hsl(${GH.hue} 100% 80%)`; ctx.lineWidth = 6;
    ctx.strokeRect(-GH.w / 2, 0, GH.w, BH);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

let moteAcc = 0;
function drawMotes(ctx) {
  moteAcc += 1 / 60;
  const drift = Math.sin(t * .7) * 10;
  for (let i = 0; i < MOTES.length; i++) {
    const m = MOTES[i];
    m.y -= m.v / 60;
    if (m.y < -10) { m.y = H + 10; m.x = rnd(0, W); }
    ctx.globalAlpha = m.a * (.55 + .45 * Math.sin(t * 1.6 + m.x));
    ctx.fillStyle = '#dff2ff';
    ctx.fillRect(m.x + drift * (m.r * .3), m.y, m.r, m.r);
  }
  ctx.globalAlpha = 1;
}

function drawSlab(ctx) {
  if (!cur) return;
  const y = slabY(tower.length);
  const prev = top();
  const target = prev.x + prev.w / 2;
  const d = Math.abs((cur.x + cur.w / 2) - target);
  const locked = d < PERFECT;
  const sc = .88 + spawnPop * .12;

  ctx.save();
  ctx.translate(cur.x + cur.w / 2, y + BH / 2);
  ctx.scale(1 + (1 - sc) * .6, sc);
  ctx.translate(-cur.w / 2, -BH / 2);
  ctx.shadowColor = locked ? '#9ff8ff' : `hsl(${cur.hue} 100% 62%)`;
  ctx.shadowBlur = locked ? 44 : 26;
  ctx.fillStyle = slabGrad(ctx, cur.hue);
  ctx.fillRect(0, 0, cur.w, BH);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = locked ? '#eafeff' : '#0a0720'; ctx.lineWidth = locked ? 4 : 3;
  ctx.strokeRect(0, 0, cur.w, BH);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, cur.w, 5);
  if (locked) { ctx.globalAlpha = .35 + .45 * nearGlow; ctx.fillStyle = '#d8ffff'; ctx.fillRect(0, 0, cur.w, BH); ctx.globalAlpha = 1; }
  ctx.restore();

  /* guide beam down to the deck */
  ctx.globalAlpha = .1 + nearGlow * .12; ctx.fillStyle = locked ? '#9ff8ff' : '#cfeaff';
  ctx.fillRect(cur.x + cur.w / 2 - 1.5, y + BH, 3, 2400); ctx.globalAlpha = 1;

  /* aim ghost: where the slab's edges will land */
  ctx.globalAlpha = .18 + nearGlow * .3;
  ctx.fillStyle = locked ? '#9ff8ff' : '#ffffff';
  ctx.fillRect(cur.x, y + BH - 3, cur.w, 3);
  ctx.globalAlpha = 1;
}

function drawCat(ctx) {
  const deckTop = slabY(tower.length - 1) + BH - host.hop * 26;
  const sq = host.squash;
  ctx.save();
  ctx.translate(host.x, deckTop);
  /* squash pivot at the feet */
  ctx.scale(2 - sq, sq);
  drawChar('cat', ctx, 0, 0, 76, { dir: 1, anim: host.hop > .05 ? 'walk' : 'idle', t: g.t, color: '#ffb347' });
  ctx.restore();

  /* little glow under the cat so it reads against the slab */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .2 + .1 * Math.sin(t * 3);
  ctx.fillStyle = '#ffd79a';
  ctx.beginPath(); ctx.ellipse(host.x, deckTop - 2, 30, 8, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawHUD(ctx) {
  const hgt = tower.length - 1;
  /* eased, punching floor counter */
  ctx.save();
  ctx.translate(32, 96);
  ctx.scale(HUD.s * scorePop, HUD.s * scorePop);
  g.text(String(hgt).padStart(2, '0'), 0, 0, { size: 76, color: '#eaf7ff', ink: '#04030c' });
  ctx.restore();
  g.text('FLOORS', 36, 122, { size: 20, color: '#8fd6ff', stroke: 3 });

  /* progress to the win — the player always knows how close it is */
  const pct = clamp(hgt / WIN, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,26,.72)'; rr(ctx, 36, 140, 168, 16, 8); ctx.fill();
  const pg = ctx.createLinearGradient(36, 0, 204, 0);
  pg.addColorStop(0, '#7df9ff'); pg.addColorStop(1, '#ff4ad8');
  ctx.fillStyle = pg; rr(ctx, 36, 140, Math.max(6, 168 * pct), 16, 8); ctx.fill();
  ctx.globalAlpha = .45 + .55 * (.5 + .5 * Math.sin(t * 5));
  ctx.fillStyle = '#fff'; rr(ctx, 36 + Math.max(0, 168 * pct - 5), 140, 5, 16, 3); ctx.fill();
  ctx.restore();

  /* score, eased so it counts up rather than snapping */
  g.text(fmt(scoreShown), W - 30, 96, { size: 46, align: 'right', color: '#ffd34d', ink: '#04030c' });
  g.text('SCORE', W - 32, 118, { size: 17, align: 'right', color: '#ffe9a8', stroke: 3 });

  if (g.combo.mult > 1 || chainPulse > 0) {
    const pulse = MUL.s * (1 + Math.sin(t * 9) * .05);
    ctx.save(); ctx.translate(W - 96, 172); ctx.scale(pulse, pulse);
    g.text(`${g.combo.mult}×`, 0, 0, { size: 54, align: 'center', color: '#ffd34d', ink: '#04030c' });
    g.text('CHAIN', 0, 24, { size: 18, align: 'center', color: '#ffe9a8', stroke: 3 });
    ctx.restore();
  }

  /* perfect marker on the deck */
  if (cur) {
    const prev = top();
    ctx.save(); ctx.translate(0, camY + H * .68);
    const y = slabY(tower.length - 1) + BH;
    ctx.globalAlpha = .45 + .35 * Math.sin(t * 7);
    ctx.fillStyle = nearGlow > .5 ? '#9ff8ff' : '#7df9ff';
    ctx.fillRect(prev.x + prev.w / 2 - 1.5, y - 16, 3, 14);
    ctx.globalAlpha = .35 + nearGlow * .4;
    ctx.fillRect(prev.x + prev.w / 2 - PERFECT, y - 20, PERFECT * 2, 3);
    ctx.restore();
  }
}

function draw() {
  const ctx = g.ctx;
  drawSky(ctx);
  drawBackdrop(ctx);

  ctx.save();
  ctx.translate(0, camY + H * .68);
  drawTower(ctx);
  drawSlab(ctx);
  drawCat(ctx);
  ctx.restore();

  drawMotes(ctx);
  drawHUD(ctx);
  if (nearGlow > .02) {
    /* screen-level finish: a whisper of chromatic rip when you're dead centre */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = nearGlow * .07; ctx.fillStyle = '#9ff8ff'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ floors: tower.length - 1, camY: Math.round(camY), cur: cur && [Math.round(cur.x), Math.round(cur.w)] });

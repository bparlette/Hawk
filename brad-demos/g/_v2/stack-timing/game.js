// TOWER PERFECT — stack-timing (Cat Arcade v2)
// Tap to drop the slab. Land it dead centre for a PERFECT chain and the tower never shrinks.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, chance, R, TAU } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'stack-timing', title: 'TOWER PERFECT', sub: 'TAP TO DROP  ·  CENTRE IT',
  hook: 'one pixel off and the tower falls', w: W, h: H, bg: '#0a0818', style: 'neon',
  bloom: .85, ca: .35, vig: 1, scan: .18,
});

const BH = 56;                  // slab height
const BASE = 268;               // starting slab width
const PERFECT = 9;              // px tolerance for a perfect
const WIN = 14;                 // slabs to win (auto run)

let tower, cur, camY, camT, t, autoT, host, bonus;
const isAuto = new URLSearchParams(location.search).has('auto');

const hueOf = i => (196 + i * 11) % 360;
const slabW = i => Math.max(46, BASE - i * 2);

function resetWorld() {
  tower = [{ x: W / 2 - BASE / 2, w: BASE, i: 0, perfect: true, hue: hueOf(0) }];
  cur = null; camY = 0; camT = 0; t = 0; autoT = 0; bonus = 0;
  host = { hop: 0, squash: 1, x: W / 2 };
  camT = camTarget(1);
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
}

/* ------------------------------------------------------------------ input */
function drop() {
  if (!cur || g.mode !== 'play') return;
  const prev = top();
  const a = Math.max(cur.x, prev.x), b = Math.min(cur.x + cur.w, prev.x + prev.w);
  const ov = b - a;
  const cy0 = slabY(tower.length) + BH;
  const cxMid = cur.x + cur.w / 2, pMid = prev.x + prev.w / 2;
  const off = Math.abs(cxMid - pMid);

  if (ov <= 4) {
    /* total miss — the slab tumbles into the void */
    g.fx.burst(cxMid, cy0, 26, { kind: 'debris', color: ['#ff3b5c', '#ffd34d', '#fff'], speed: 340, life: .9 });
    sfx('boom'); g.impact(cxMid, cy0, { punch: .22, shake: 26, flash: '#ff3b5c', flashA: .45, sfx: 'boom' });
    g.end({ win: false, score: Math.round(g.score), label: 'SCORE' });
    return;
  }

  tower.push({ x: a, w: ov, i: tower.length, perfect: off <= PERFECT, hue: cur.hue });

  if (off <= PERFECT) {
    /* PERFECT — keep the width, chain the combo, slam the juice */
    const mult = g.combo.mult;
    bonus += 10 * mult;
    g.combo.hit(cxMid, cy0 + 10, 'PERFECT');
    sfx('perfect', { pitch: comboPitch() });
    g.impact(cxMid, cy0 + BH / 2, { punch: .1, shake: 10, stop: .04, rip: true });
    g.fx.burst(cxMid, cy0 + BH / 2, 22, { kind: 'spark', color: ['#7df9ff', '#fff', '#ff4ad8'], speed: 300, life: .55 });
    g.fx.burst(cxMid, cy0, 10, { kind: 'star', color: '#ffd34d', speed: 150, life: .8 });
    if (mult >= 3) g.showBanner(`${mult}× CHAIN`, .8);
  } else if (off < cur.w * .34) {
    bonus += 4;
    g.combo.hit(cxMid, cy0 + 10, 'GOOD');
    sfx('snap', { pitch: comboPitch() });
  } else {
    bonus += 1; g.combo.miss(); sfx('thud', { pitch: .9 });
  }
  /* the trimmed offcut falls away */
  const cutW = cur.w - ov;
  if (cutW > 3) {
    const cutX = cur.x + ov < prev.x + ov ? cur.x : cur.x + ov;
    g.fx.burst(cutX + cutW / 2, cy0 + BH / 2, Math.min(14, 4 + cutW / 8), { kind: 'debris', color: `hsl(${cur.hue} 90% 62%)`, speed: 200, life: .8 });
  }

  /* cat hops onto the new floor */
  host.hop = 1; host.squash = .72;
  camT = camTarget(tower.length);
  g.fx.dust(host.x, slabY(tower.length) + BH, 8, { color: 'rgba(200,240,255,.5)' });
  cur = null;
  if (tower.length - 1 >= WIN) { g.end({ win: true, score: Math.round(g.score), label: 'SCORE' }); return; }
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

  camY = lerp(camY, camT, Math.min(1, dt * 7));
  host.hop = Math.max(0, host.hop - dt * 3.2);
  host.squash = lerp(host.squash, 1, dt * 10);
  host.x = lerp(host.x, top().x + 22, Math.min(1, dt * 12));

  g.score = Math.round(tower.length - 1) * 10 + bonus;
  g.state = { score: Math.round(g.score), height: tower.length - 1, combo: g.combo.mult };
  if (isAuto && autoT > 120) g.end({ win: true, score: tower.length - 1, label: 'FLOORS' });
}

/* ------------------------------------------------------------------ draw */
const skyFor = h => {
  const k = clamp(h / 26, 0, 1);
  const a = [12 + 24 * k, 9 + 14 * k, 40 + 60 * k];
  const b = [86 - 40 * k, 40 - 20 * k, 120 + 60 * k];
  return { a: `rgb(${a.map(Math.round)})`, b: `rgb(${b.map(Math.round)})` };
};

function draw() {
  const ctx = g.ctx;
  const { a, b } = skyFor(tower.length);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, a); sky.addColorStop(.6, b); sky.addColorStop(1, '#05040c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  /* far skyline washed by height */
  ctx.globalAlpha = .5;
  for (let i = 0; i < 9; i++) {
    const bw = 70 + (i % 3) * 40, bh = 120 + ((i * 137) % 200);
    const bx = i * 66 - (camY * .06) % 66;
    ctx.fillStyle = '#0d0a24';
    ctx.fillRect(bx, H - bh - 40 + camY * .06 % 200, bw, bh + 200);
  }
  ctx.globalAlpha = 1;

  /* tower */
  ctx.save();
  ctx.translate(0, camY + H * .68);
  for (let idx = 0; idx < tower.length; idx++) {
    const s = tower[idx], y = slabY(idx);
    const hue = s.hue;
    /* side + top faces for a chunky 3d read */
    ctx.fillStyle = `hsl(${hue} 78% 26%)`;
    ctx.fillRect(s.x + 7, y + 8, s.w, BH);
    const gr = ctx.createLinearGradient(s.x, y, s.x, y + BH);
    gr.addColorStop(0, `hsl(${hue} 92% 66%)`); gr.addColorStop(.5, `hsl(${hue} 84% 48%)`); gr.addColorStop(1, `hsl(${hue} 80% 34%)`);
    ctx.fillStyle = gr; ctx.fillRect(s.x, y, s.w, BH);
    ctx.fillStyle = `hsl(${hue} 100% 82%)`; ctx.fillRect(s.x, y, s.w, 6);
    ctx.strokeStyle = 'rgba(6,4,18,.65)'; ctx.lineWidth = 3; ctx.strokeRect(s.x, y, s.w, BH);
    if (s.perfect) {
      ctx.globalAlpha = .35 + .35 * Math.sin(g.t * 6 + idx);
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x, y, s.w, 6); ctx.globalAlpha = 1;
    }
    /* neon edge rails */
    ctx.globalAlpha = .55; ctx.fillStyle = `hsl(${hue} 100% 78%)`;
    ctx.fillRect(s.x, y + 6, 3, BH - 8); ctx.fillRect(s.x + s.w - 3, y + 6, 3, BH - 8);
    ctx.globalAlpha = 1;
  }

  /* moving slab */
  if (cur) {
    const y = slabY(tower.length);
    ctx.save();
    ctx.shadowColor = `hsl(${cur.hue} 100% 60%)`; ctx.shadowBlur = 30;
    const gr = ctx.createLinearGradient(cur.x, y, cur.x, y + BH);
    gr.addColorStop(0, `hsl(${cur.hue} 96% 74%)`); gr.addColorStop(1, `hsl(${cur.hue} 86% 46%)`);
    ctx.fillStyle = gr; ctx.fillRect(cur.x, y, cur.w, BH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0a0720'; ctx.lineWidth = 3; ctx.strokeRect(cur.x, y, cur.w, BH);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(cur.x, y, cur.w, 5);
    /* guide beam down to the deck */
    ctx.globalAlpha = .16; ctx.fillStyle = '#cfeaff';
    ctx.fillRect(cur.x + cur.w / 2 - 1.5, y + BH, 3, 2400); ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* the cat riding the top slab */
  const deckTop = slabY(tower.length - 1) + BH + host.hop * -26;
  const sq = host.squash;
  ctx.save();
  ctx.translate(host.x, deckTop);
  ctx.scale(2 - sq, sq);
  drawChar('cat', ctx, 0, 0, 76, { dir: 1, anim: 0, t: g.t, color: '#ffb347' });
  ctx.restore();
  ctx.restore();

  /* hud */
  const hgt = tower.length - 1;
  g.text(String(hgt).padStart(2, '0'), 32, 96, { size: 76, color: '#eaf7ff', ink: '#04030c' });
  g.text('FLOORS', 36, 122, { size: 20, color: '#8fd6ff', stroke: 3 });
  if (g.combo.mult > 1) {
    const pulse = 1 + Math.sin(g.t * 9) * .06;
    ctx.save(); ctx.translate(W - 96, 78); ctx.scale(pulse, pulse);
    g.text(`${g.combo.mult}×`, 0, 0, { size: 54, align: 'center', color: '#ffd34d', ink: '#04030c' });
    g.text('CHAIN', 0, 24, { size: 18, align: 'center', color: '#ffe9a8', stroke: 3 });
    ctx.restore();
  }
  /* perfect marker on the deck */
  if (cur) {
    const prev = top();
    ctx.save(); ctx.translate(0, camY + H * .68);
    const y = slabY(tower.length - 1) + BH;
    ctx.globalAlpha = .5 + .3 * Math.sin(g.t * 7);
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(prev.x + prev.w / 2 - 1.5, y - 14, 3, 12);
    ctx.restore();
  }
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ floors: tower.length - 1, camY: Math.round(camY), cur: cur && [Math.round(cur.x), Math.round(cur.w)] });

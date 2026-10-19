// CAT-A-PULT — trajectory-artillery (Cat Arcade v2)
// Drag to aim, release to fire a fish bomb over the wind. The rock spire blocks the direct line and the
// ground is destructible, so every crater you make is a new firing solution. 3 hearts vs 4 zombie hearts.
import { makeGame, sfx, music, comboPitch, clamp, lerp, rnd, R, TAU, hexA, fmt, shadow, heartPath, damp, rr, circle } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'trajectory-artillery', title: 'CAT-A-PULT', sub: 'DRAG TO AIM  ·  RELEASE TO FIRE',
  hook: 'one fish, one zombie, one very big crater', w: W, h: H, bg: '#060912', style: 'toon',
  bloom: .92, ca: .42, vig: 1, scan: .16,
});

const DEG = Math.PI / 180;
const GRAV = 980;
const CW = 3, COLS = Math.round(W / CW);
const GROUND = 812;
const VMIN = 250, VMAX = 1080;
const AIM_TIME = 6.5;            // auto-fire pressure so a round always resolves
const MAXR = 58;                 // explosion radius
const AUTOFIRE = 0;              // fire button
const isAuto = new URLSearchParams(location.search).has('auto');
const SKY = ['#0a0f2e', '#2a1a4e', '#5e2a52', '#b8463a'];

/* ------------------------------------------------------------------ world */
const player = { x: 104, hp: 4, max: 4, fl: 0, sq: 1, rec: 0, t: 0, hop: 0, dead: 0 };
const foe = { x: 452, hp: 4, max: 4, fl: 0, sq: 1, t: 0, chg: 0, dead: 0, aim: 0 };
const aim = { deg: 42, pow: .58, dir: 1 };
const mz = { x: 0, y: 0 };
let hgt = new Float32Array(COLS);
let proj = null, boom = null;
let phase = 'aim', phaseT = 0, worldT = 0, shots = 0, chain = 0, wind = 0, lastWho = 1;
let wasDown = false, botT = 0, botShot = null, camX = 0, autoT = 0, foeTurns = 0;
let foePlan = null, banner = '', bannerT = 0, hints = 0;
let corrPow = 0, corrDeg = 0, lastLandX = null;   // the autopilot learns from where its last shell actually landed

const grass = [], rocks = [];
for (let i = 0; i < 46; i++) grass.push({ x: rnd(6, W - 6), h: rnd(9, 26), ph: rnd(0, TAU), n: 2 + (i % 3) });
for (let i = 0; i < 60; i++) rocks.push({ x: rnd(0, W), d: rnd(4, 60), rx: rnd(2, 8), ry: rnd(1.4, 5), a: rnd(.06, .18) });
const stars = []; for (let i = 0; i < 70; i++) stars.push({ x: rnd(0, W), y: rnd(0, H * .55), r: rnd(.7, 1.9), ph: rnd(0, TAU), sp: rnd(.6, 2.2) });

/* three parallax ridges, generated as sampled heights */
function ridge(n, amp, base, seed) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const y = base - amp * (.55 * Math.sin(u * 5.1 + seed) + .3 * Math.sin(u * 11.3 + seed * 2.1) + .22 * Math.sin(u * 23.7 + seed * 3.7));
    pts.push({ x: u * (W + 240) - 120, y });
  }
  return pts;
}
const farR = ridge(30, 120, 640, 1.7);
const midR = ridge(34, 92, 726, 4.2);
const nearR = ridge(38, 62, 792, 8.9);
const farTrees = []; for (let i = 0; i < 34; i++) farTrees.push({ x: rnd(-40, W + 40), h: rnd(20, 48), w: rnd(7, 13) });
const clouds = []; for (let i = 0; i < 5; i++) clouds.push({ x: rnd(0, W), y: rnd(120, 420), w: rnd(120, 260), h: rnd(16, 34), sp: rnd(1.4, 4.2), a: rnd(.05, .13) });

function baseH(x) {
  let y = GROUND;
  y -= 14 * Math.cos(x * .0125 + .9);
  y -= 122 * Math.exp(-(((x - 278) / 26) ** 2));          // rock spire that blocks the direct line
  y -= 18 * Math.exp(-(((x - 418) / 46) ** 2));           // small rise the zombie stands on
  return y;
}
const slopeH = x => {
  let y = GROUND - 10 * Math.cos(x * .011 + 2.2);
  y -= 70 * Math.exp(-(((x - 292) / 58) ** 2));
  return y;
};

const surfAt = x => hgt[clamp(Math.floor(x / CW), 0, COLS - 1)];

/* ------------------------------------------------------------------ reset */
function resetWorld() {
  for (let i = 0; i < COLS; i++) hgt[i] = baseH(i * CW + CW * .5);
  player.hp = g.dumb() ? 1 : 4; player.max = 4; player.fl = 0; player.sq = 1; player.rec = 0; player.dead = 0;
  foe.hp = 4; foe.max = 4; foe.fl = 0; foe.sq = 1; foe.chg = 0; foe.dead = 0; foe.aim = 0;
  aim.deg = 42; aim.pow = .58; aim.dir = 1;
  proj = null; boom = null; phase = 'aim'; phaseT = 0; worldT = 0; shots = 0; chain = 0;
  wind = g.dumb() ? 0 : (R() < .5 ? -1 : 1) * rnd(30, 62);
  wasDown = false; botT = 0; botShot = null; camX = 0; foeTurns = 0;
  corrPow = 0; corrDeg = 0; lastLandX = null; foePlan = null; banner = ''; bannerT = 0; hints = 0;
  g.score = 0; g.fx.clear();
  g.state = { score: 0, ph: 'aim', php: player.hp, fhp: foe.hp, shots: 0, wind: Math.round(wind) };
}
const sync = () => { g.state.ph = phase; g.state.php = Math.max(0, player.hp); g.state.fhp = Math.max(0, foe.hp); g.state.shots = shots; g.state.wind = Math.round(wind); };

/* ------------------------------------------------------------------ ballistics */
const S = { x: 0, y: 0, vx: 0, vy: 0 };
function stepP(s, w, k) {
  const h = k * .5;
  s.vx += w * h; s.vy += GRAV * h; s.x += s.vx * h; s.y += s.vy * h;
  s.vx += w * h; s.vy += GRAV * h; s.x += s.vx * h; s.y += s.vy * h;
}
function muzzle(dir) { mz.x = player.x + 34 * dir; mz.y = surfAt(player.x) - 60; return mz; }
function launch(deg, pow, dir, out) {
  const v0 = VMIN + pow * (VMAX - VMIN), th = deg * DEG;
  muzzle(dir);
  out.x = mz.x; out.y = mz.y;
  out.vx = Math.cos(th) * v0 * dir; out.vy = -Math.sin(th) * v0;
  return out;
}
const foeBody = () => ({ x: foe.x, y: surfAt(foe.x) - 52 });
const plyBody = () => ({ x: player.x + 6, y: surfAt(player.x) - 50 });

/** distance from the impact point to (tx,ty); 1e9 if it flies away. */
function simDist(fromX, fromY, vx, vy, w, tx, ty) {
  S.x = fromX; S.y = fromY; S.vx = vx; S.vy = vy;
  for (let i = 0; i < 760; i++) {
    stepP(S, w, 1 / 120);
    if (S.x < -80 || S.x > W + 80) return 1e9;
    if (S.y > H + 40) return 1e9;
    if ((S.x - tx) ** 2 + (S.y - ty) ** 2 < 26 * 26) return 0;      // direct hit
    const sy = surfAt(S.x);
    if (S.y >= sy) return Math.hypot(S.x - tx, sy - ty);
  }
  return 1e9;
}
/** grid search + local refine for the aim that lands on (tx,ty). Always hits the same integrator. */
function solve(tx, ty) {
  let bd = 1e9, bdeg = 45, bp = .6;
  for (let deg = 16; deg <= 84; deg += 3) {
    const th = deg * DEG, c = Math.cos(th), s = Math.sin(th);
    for (let p = .2; p <= 1.001; p += .04) {
      muzzle(1);
      const v0 = VMIN + p * (VMAX - VMIN);
      const d = simDist(mz.x, mz.y, c * v0, s * v0, wind, tx, ty);
      if (d < bd) { bd = d; bdeg = deg; bp = p; }
    }
  }
  for (let deg = bdeg - 2.4; deg <= bdeg + 2.4; deg += .4) {
    const th = deg * DEG, c = Math.cos(th), s = Math.sin(th);
    for (let p = Math.max(.2, bp - .05); p <= Math.min(1, bp + .05); p += .01) {
      muzzle(1);
      const v0 = VMIN + p * (VMAX - VMIN);
      const d = simDist(mz.x, mz.y, c * v0, s * v0, wind, tx, ty);
      if (d < bd) { bd = d; bdeg = deg; bp = p; }
    }
  }
  return { deg: bdeg, pow: bp, d: bd };
}

/* ------------------------------------------------------------------ fire */
window.__dbg = () => { muzzle(1); const sol = solve(foeBody().x, foeBody().y); return { phase, shots, php: player.hp, fhp: foe.hp, t: +worldT.toFixed(1), turn: foeTurns, lastLandX: lastLandX == null ? null : Math.round(lastLandX), foeX: Math.round(foe.x), plX: Math.round(player.x), mzX: Math.round(mz.x), solDeg: Math.round(sol.deg), solPow: +sol.pow.toFixed(2), solD: Math.round(sol.d), aimDeg: Math.round(aim.deg), aimPow: +aim.pow.toFixed(2), corrDeg: +corrDeg.toFixed(1) }; };
function firePlayer() {
  if (phase !== 'aim' || proj) return;
  launch(aim.deg, aim.pow, aim.dir, S);
  proj = { x: S.x, y: S.y, vx: S.vx, vy: S.vy, who: 0, life: 0, trail: 0 };
  phase = 'fly'; phaseT = 0; botShot = null; lastWho = 0;
  shots++; player.rec = 1; player.sq = .78;
  sfx('shoot', { pitch: .9 + aim.pow * .3 });
  g.shake(2.4); g.punch(.05 + aim.pow * .05);
  g.fx.emit('smoke', mz.x, mz.y, { size: 14, life: .5, color: '#f0e6ff', vx: -aim.dir * 60, vy: -40, add: false });
  g.fx.burst(mz.x, mz.y, 12, { kind: 'spark', color: '#ffe08a', speed: 320, life: .32, size: 3.4, ang: -aim.deg * DEG, spread: .8 * Math.PI });
  g.fx.ring(mz.x, mz.y, { r: 34, color: '#ffd34d', life: .28 });
  sync();
}
function fireFoe() {
  const b = plyBody();
  launch(foePlan.deg, foePlan.pow, -1, S);
  proj = { x: S.x, y: S.y, vx: S.vx, vy: S.vy, who: 1, life: 0, trail: 0 };
  phase = 'fly'; phaseT = 0; lastWho = 1;
  foe.sq = .8; foeTurns++;
  sfx('shoot', { pitch: .62 });
  g.shake(2); g.punch(.06);
  g.fx.burst(mz.x, mz.y, 10, { kind: 'spark', color: '#b48cff', speed: 280, life: .3, size: 3.2, ang: Math.PI + foePlan.deg * DEG, spread: .7 * Math.PI });
  sync();
}

/* ------------------------------------------------------------------ impact */
function detonate(x, y, who) {
  const r = maxR();
  // carve the ground
  const c0 = clamp(Math.floor((x - r) / CW), 0, COLS - 1), c1 = clamp(Math.ceil((x + r) / CW), 0, COLS - 1);
  for (let i = c0; i <= c1; i++) {
    const cx = i * CW + CW * .5, dx = cx - x;
    const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
    const ny = y + dy;
    if (ny > hgt[i]) hgt[i] = Math.min(H - 30, ny);
  }
  const pb = plyBody(), fb = foeBody();
  const df = Math.hypot(x - fb.x, y - fb.y), dp = Math.hypot(x - pb.x, y - pb.y);
  const big = who === 0 && df < 30;                      // direct hit on the zombie
  boom = { x, y, r, t: 0, spark: big };
  phase = 'boom'; phaseT = 0;

  g.fx.blast(x, y, { r, colors: ['#ffdc6a', '#ff8a3c', '#ff4d2e', '#ffffff'], n: 26, speed: 520, flashA: big ? .5 : .34, punch: big ? 16 : 11, shake: big ? 12 : 8 });
  g.fx.burst(x, y, 22, { kind: 'debris', color: ['#5b4a6e', '#3a3148', '#7c6b90'], speed: 460, life: .85, size: 5, ang: -Math.PI * .5, spread: Math.PI, g: 1700 });
  g.fx.burst(x, y, 10, { kind: 'smoke', color: '#6b5f80', speed: 130, life: 1.1, size: 22, ang: -Math.PI * .5, spread: Math.PI });
  sfx(big ? 'explode' : 'boom', { pitch: .95 + R() * .12 });
  if (big) {
    g.hitstop(.1); sfx('crit', { pitch: comboPitch(chain) });
    g.punch(.16); g.shake(7);
    g.fx.emit('ring', x, y, { size: 70, color: '#fff3b0', life: .34, add: true, wide: true });
    g.fx.burst(x, y, 14, { kind: 'spark', color: ['#fff3b0', '#ffd34d'], speed: 620, life: .5, size: 4, g: 260 });
    for (let i = 0; i < 14; i++) g.fx.burst(x + rnd(-16, 16), y + rnd(-16, 16), 1, { kind: 'confetti', color: ['#b48cff', '#8fd98a'], speed: rnd(150, 420), life: .8, size: 4, ang: rnd(-Math.PI, 0), spread: .8 });
  } else if (who === 0) {
    g.fx.emit('ring', x, y, { size: 46, color: '#ffb347', life: .28, add: true });
  }
  if (who === 0) lastLandX = x;

  // damage
  if (who === 0) {
    if (df < 62) {
      const dmg = df < 30 ? 2 : 1;
      foe.hp -= dmg; foe.fl = .5; foe.sq = .55;
      chain++;
      g.combo.hit();
      if (df >= 30) g.impact(x, y, { punch: .06, shake: 5, stop: .04 });
      const sc = Math.round((dmg * 150 + (df < 30 ? 120 : 0)) * (1 + chain * .25));
      g.score += sc;
      g.popup((df < 30 ? 'DIRECT  ' : 'HIT  ') + '+' + sc, x, y - 40, df < 30 ? '#ffd34d' : '#9ff0ff', df < 30 ? 40 : 32);
      if (chain > 1) g.showBanner('CHAIN x' + chain + '!', .8);
      g.shake(6);
      if (foe.hp <= 0) { win(); return; }
    } else {
      if (chain) { chain = 0; g.combo.miss(); g.popup('MISS', x, y - 30, '#8f8fa8', 26); sfx('blip', { pitch: .7 }); }
      g.score += 20;
    }
  } else {
    if (dp < 68) {
      const dmg = dp < 34 ? 2 : 1;
      player.hp -= dmg; player.fl = .5; player.sq = .55;
      g.popup('-' + dmg, pb.x, pb.y - 40, '#ff5f6d', 38);
      g.shake(10); g.punch(.13); g.hitstop(.06); g.flash('#ff2d55', .18);
      g.fx.burst(pb.x, pb.y, 16, { kind: 'debris', color: ['#ff5f6d', '#ffb347'], speed: 340, life: .6, size: 4, g: 900 });
      g.fx.emit('ring', pb.x, pb.y, { size: 54, color: '#ff5f6d', life: .3, add: true });
      sfx('hit', { pitch: .8 }); chain = 0; g.combo.miss();
      if (player.hp <= 0) { lose(); return; }
    } else {
      g.popup('MISS', x, y - 30, '#8f8fa8', 24);
    }
  }
  sync();
}
const maxR = () => MAXR + Math.min(10, foeTurns * 3);

/* ------------------------------------------------------------------ end */
function win() {
  foe.dead = 1;
  g.score += 400 + Math.max(0, Math.round((26 - worldT) * 12));
  for (let i = 0; i < 46; i++) g.fx.burst(foe.x + rnd(-40, 40), surfAt(foe.x) - rnd(20, 120), 1, { kind: 'confetti', color: ['#ffd34d', '#9ff0ff', '#ff8af0', '#8bffb0'], speed: rnd(180, 520), life: 1.5, size: 5, ang: rnd(-Math.PI, 0), spread: .9 });
  g.slowmo(.35, .9); g.flash('#ffd34d', .4); g.shake(14);
  sfx('win'); sfx('levelup', { pitch: 1.2 });
  g.end({ win: true, score: g.score, label: 'SCORE', progress: 1 });
}
function lose() {
  player.dead = 1;
  g.flash('#ff2d55', .34); g.shake(18); g.slowmo(.3, .8);
  sfx('lose'); sfx('meow', { pitch: .7 });
  g.end({ win: false, score: g.score, label: 'SCORE', progress: clamp((foe.max - Math.max(0, foe.hp)) / foe.max, 0, 1) });
}

/* ------------------------------------------------------------------ aim input */
const FIRE_BTN = { x: W - 158, y: H - 150, w: 134, h: 100 };
function aimFrom(x, y) {
  if (x > FIRE_BTN.x - 8 && x < FIRE_BTN.x + FIRE_BTN.w + 8 && y > FIRE_BTN.y - 8) return;
  const dir = x < player.x ? -1 : 1;
  const dy = surfAt(player.x) - 60 - y;
  const dx = Math.abs(x - (player.x + 34 * dir));
  aim.dir = dir;
  aim.deg = clamp(Math.atan2(Math.max(4, dy), Math.max(8, dx)) / DEG, 8, 84);
  aim.pow = clamp(Math.hypot(dx, Math.max(4, dy)) / 300, .22, 1);
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode !== 'play') return;
  worldT += dt; autoT += dt;
  player.t += dt; foe.t += dt;
  player.fl = Math.max(0, player.fl - dt);
  foe.fl = Math.max(0, foe.fl - dt);
  player.rec = Math.max(0, player.rec - dt * 3.4);
  player.sq = damp(player.sq, 1, 11, dt);
  foe.sq = damp(foe.sq, 1, 11, dt);
  bannerT = Math.max(0, bannerT - dt);
  const tx = proj ? clamp(proj.x - W * .5, -150, 150) : 0;
  camX = damp(camX, tx, 3.4, dt);
  if (boom) boom.t += dt;

  /* ---- fire button (aim phase only) */
  if (phase === 'aim') {
    const fb = g.btn('fire', FIRE_BTN.x, FIRE_BTN.y, FIRE_BTN.w, FIRE_BTN.h, 'FIRE', { key: 'Space' });
    if (fb.pressed) { sfx('click'); firePlayer(); }
  }

  switch (phase) {
    case 'aim': {
      phaseT += dt; hints += dt;
      if (isAuto) {
        botT += dt;
        if (!botShot) {
          if (g.dumb()) botShot = { deg: rnd(14, 78), pow: rnd(.3, .95), t: 0 };
          else {
            const b = foeBody();
            if (lastLandX != null) {                       // nudge toward the zombie using the real landing spot
              const err = b.x - lastLandX;
              corrPow = clamp(corrPow + err * .0022, -.26, .26);
              corrDeg = clamp(corrDeg + err * .02, -9, 9);
              lastLandX = null;
            }
            const sol = solve(b.x, b.y);
            botShot = { deg: clamp(sol.deg + corrDeg, 10, 84), pow: clamp(sol.pow + corrPow, .22, 1), t: 0 };
          }
        }
        aim.dir = 1; aim.deg = botShot.deg; aim.pow = botShot.pow;
        if (botT > (g.dumb() ? .7 : .5)) firePlayer();
      } else {
        let p = null;
        for (const q of g.pointers.values()) p = q;
        if (p) { aimFrom(p.x, p.y); wasDown = true; }
        else if (wasDown) { wasDown = false; firePlayer(); }
        if (g.keys.has('ArrowUp')) aim.deg = clamp(aim.deg + dt * 34, 8, 84);
        if (g.keys.has('ArrowDown')) aim.deg = clamp(aim.deg - dt * 34, 8, 84);
        if (g.keys.has('ArrowRight')) aim.pow = clamp(aim.pow + dt * .8, .22, 1);
        if (g.keys.has('ArrowLeft')) aim.pow = clamp(aim.pow - dt * .8, .22, 1);
        if (phaseT > AIM_TIME && !proj) firePlayer();
      }
      break;
    }
    case 'fly': {
      if (!proj) { phase = 'aim'; phaseT = 0; break; }
      proj.life += dt;
      const k = Math.min(dt, 1 / 30);
      stepP(proj, wind, k);
      proj.trail = proj.trail || 0;
      proj.trail += dt;
      if (proj.trail > .022) {
        proj.trail = 0;
        g.fx.trailDot(proj.x, proj.y, { color: proj.who ? '#b48cff' : '#ffd34d', size: 4.6, life: .5 });
      }
      // direct contact with a body
      const fb = foeBody(), pb = plyBody();
      if (proj.who === 0 && (proj.x - fb.x) ** 2 + (proj.y - fb.y) ** 2 < 30 * 30) { detonate(proj.x, proj.y, 0); proj = null; break; }
      if (proj.who === 1 && (proj.x - pb.x) ** 2 + (proj.y - pb.y) ** 2 < 32 * 32) { detonate(proj.x, proj.y, 1); proj = null; break; }
      const sy = surfAt(proj.x);
      if (proj.y >= sy) { detonate(proj.x, Math.min(proj.y, sy), proj.who); proj = null; break; }
      if (proj.x < -90 || proj.x > W + 90 || proj.y > H + 40) {
        g.popup('OUT', proj.x, proj.y, '#8f8fa8', 24);
        if (proj.who === 0) chain = 0; else g.popup('SAFE', plyBody().x, plyBody().y - 40, '#8bffb0', 28);
        sfx('whoosh', { pitch: .7 }); g.shake(2.5);
        proj = null; phase = 'boom'; phaseT = 0; boom = null;
        sync();
      }
      break;
    }
    case 'boom': {
      phaseT += dt;
      if (phaseT > (boom && boom.spark ? .5 : .36)) {
        boom = null;
        if (player.hp <= 0 || foe.hp <= 0) break;
        phase = lastWho === 0 ? 'foeAim' : 'aim'; phaseT = 0; foe.chg = 0; foePlan = null; sync();
      }
      break;
    }
    case 'foeAim': {
      phaseT += dt;
      foe.chg = Math.min(1, phaseT / .62);
      if (!foePlan) {
        const pb = plyBody();
        const off = g.dumb() ? 0 : (foeTurns < 2 ? 46 : foeTurns < 5 ? 34 : 24);   // ramp: tightens every exchange
        foePlan = solve(pb.x + off, pb.y - 8);
        if (foePlan.d > 400) foePlan = { deg: 55, pow: .8 };
      }
      if (phaseT > .78) { fireFoe(); }
      break;
    }
  }

  sync();
  // safety nets
  if (worldT > 52 && g.mode === 'play') { (player.hp > foe.hp) ? win() : lose(); return; }
}

/* ------------------------------------------------------------------ draw */
const drawRidge = (ctx, pts, col, off, baseY) => {
  ctx.beginPath(); ctx.moveTo(pts[0].x + off, baseY);
  for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x + off, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x + off, baseY); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
};

function drawWorld() {
  const ctx = g.ctx;
  /* sky + moon + stars */
  g.sky(ctx, SKY, { glow: 'rgba(255,150,90,.30)', gx: .7, gy: .30, gr: .92 });
  for (const s of stars) {
    const a = .35 + .45 * (.5 + .5 * Math.sin(g.t * s.sp + s.ph));
    ctx.globalAlpha = a; ctx.fillStyle = '#cfe3ff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  const mg = ctx.createRadialGradient(396, 208, 10, 396, 208, 132);
  mg.addColorStop(0, 'rgba(255,236,200,.42)'); mg.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(396, 208, 132, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff2d0'; ctx.beginPath(); ctx.arc(396, 208, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(214,196,168,.5)';
  ctx.beginPath(); ctx.arc(380, 196, 9, 0, TAU); ctx.arc(410, 224, 12, 0, TAU); ctx.arc(404, 188, 6, 0, TAU); ctx.fill();

  /* clouds */
  for (const c of clouds) {
    const x = ((c.x + g.t * c.sp - camX * .06) % (W + 300) + W + 300) % (W + 300) - 150;
    ctx.globalAlpha = c.a; ctx.fillStyle = '#9fb4e8';
    ctx.beginPath(); ctx.ellipse(x, c.y, c.w * .5, c.h * .5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - c.w * .22, c.y + 6, c.w * .3, c.h * .42, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + c.w * .26, c.y + 4, c.w * .26, c.h * .38, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* parallax ridges */
  const p1 = -camX * .10, p2 = -camX * .24, p3 = -camX * .44;
  drawRidge(ctx, farR, '#231c46', p1, 960);
  // far ridge rim light
  ctx.strokeStyle = 'rgba(150,140,255,.16)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < farR.length; i++) i ? ctx.lineTo(farR[i].x + p1, farR[i].y) : ctx.moveTo(farR[i].x + p1, farR[i].y);
  ctx.stroke();
  drawRidge(ctx, midR, '#171235', p2, 960);
  for (const t of farTrees) {
    const x = t.x + p2; if (x < -30 || x > W + 30) continue;
    ctx.fillStyle = '#0f0c26';
    ctx.beginPath(); ctx.moveTo(x, t.h * -1 + 700); ctx.lineTo(x - t.w * .5, 706); ctx.lineTo(x + t.w * .5, 706); ctx.closePath(); ctx.fill();
  }
  drawRidge(ctx, nearR, '#0d0a1c', p3, 960);
  for (let i = 0; i < 9; i++) {          // mid hill lights
    const x = 40 + i * 62 + p3 * 1.2;
    ctx.globalAlpha = .35 + .3 * Math.sin(g.t * 1.6 + i);
    ctx.fillStyle = '#ff9a5c'; ctx.beginPath(); ctx.arc(x, 770 - (i % 3) * 16, 2.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* destructible terrain */
  ctx.beginPath(); ctx.moveTo(0, hgt[0]);
  for (let i = 1; i < COLS; i++) ctx.lineTo(i * CW, hgt[i]);
  ctx.lineTo(W, hgt[COLS - 1]); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const tg = ctx.createLinearGradient(0, 660, 0, H);
  tg.addColorStop(0, '#3c3350'); tg.addColorStop(.35, '#241d38'); tg.addColorStop(1, '#0d0a18');
  ctx.fillStyle = tg; ctx.fill();
  // rock speckle inside the body
  ctx.save(); ctx.clip();
  for (const r of rocks) {
    const y = surfAt(r.x) + r.d;
    if (y > H) continue;
    ctx.globalAlpha = r.a; ctx.fillStyle = '#8f7fb8';
    ctx.beginPath(); ctx.ellipse(r.x + Math.sin(g.t * .4 + r.x) * 2, y, r.rx, r.ry, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
  // moonlit rim on the surface
  ctx.beginPath(); ctx.moveTo(0, hgt[0]);
  for (let i = 1; i < COLS; i++) ctx.lineTo(i * CW, hgt[i]);
  ctx.strokeStyle = '#1d5f6b'; ctx.lineWidth = 11; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = '#63e6d6'; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(200,255,250,.75)'; ctx.lineWidth = 1.6; ctx.stroke();

  /* surface grass tufts */
  for (const gr of grass) {
    const y = surfAt(gr.x);
    const sway = Math.sin(g.t * 2.1 + gr.ph) * 3;
    ctx.strokeStyle = '#2c8f7a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < gr.n; i++) {
      const o = (i - (gr.n - 1) / 2) * 4;
      ctx.moveTo(gr.x + o, y - 2);
      ctx.quadraticCurveTo(gr.x + o + sway * .5, y - gr.h * .6, gr.x + o + sway + o * .6, y - gr.h);
    }
    ctx.stroke();
  }
  drawChars(ctx);
  drawAimUI(ctx);
}

function drawChars(ctx) {
  /* zombie */
  const fy = surfAt(foe.x);
  shadow(ctx, foe.x, fy + 3, 46, 12, .34);
  if (!foe.dead) {
    const bob = Math.sin(foe.t * 2.4) * 3;
    if (foe.chg > 0) {
      ctx.globalAlpha = .5 + foe.chg * .5;
      ctx.fillStyle = '#b48cff';
      ctx.beginPath(); ctx.arc(foe.x - 42, fy - 62, 9 + foe.chg * 13, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(foe.x, fy + bob);
    ctx.scale(1, foe.sq);
    drawChar('zombie', ctx, 0, 0, 104, { dir: -1, t: foe.t, anim: 'walk', color: '#8fd98a', hurt: foe.fl > 0 });
    ctx.restore();
    if (foe.fl > 0) { ctx.globalAlpha = foe.fl * .7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(foe.x, fy - 60, 46, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }
  /* player cat + cannon */
  const py = surfAt(player.x);
  shadow(ctx, player.x, py + 3, 44, 11, .34);
  const bob = Math.sin(player.t * 3.1) * 2.4;
  ctx.save();
  ctx.translate(player.x, py + bob);
  ctx.scale(1, player.sq);
  drawChar('cat', ctx, 0, 0, 92, { dir: 1, t: player.t, anim: 'idle', color: '#ff9a3c', hurt: player.fl > 0 });
  // fish cannon on the shoulder
  ctx.save();
  ctx.translate(24, -58);
  ctx.rotate(-aim.deg * DEG * player.dir + (aim.dir < 0 ? Math.PI : 0) );
  ctx.translate(-player.rec * 9, 0);
  ctx.fillStyle = '#2a3550'; ctx.strokeStyle = '#0d1220'; ctx.lineWidth = 3;
  rr(ctx, -6, -9, 46, 18, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#63e6d6'; rr(ctx, 22, -6, 18, 12, 5); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(-2, 0, 7.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (player.fl > 0) { ctx.globalAlpha = player.fl * .7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(player.x, py - 54, 44, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
}

function drawAimUI(ctx) {
  const aiming = phase === 'aim' && !proj;
  const body = player.dir;
  if (aiming) {
    launch(aim.deg, aim.pow, aim.dir, S);
    const sx = S.x, sy = S.y, svx = S.vx, svy = S.vy;
    S.x = sx; S.y = sy; S.vx = svx; S.vy = svy;
    let px = S.x, py = S.y, pvx = S.vx, pvy = S.vy, landed = null;
    for (let i = 0; i < 400; i++) {
      stepP(S, wind, 1);
      if (S.x < -70 || S.x > W + 70 || S.y > H + 40) { landed = { x: S.x, y: S.y, out: true }; break; }
      const sy2 = surfAt(S.x);
      if (S.y >= sy2) { landed = { x: S.x, y: sy2 }; break; }
      if (i % 2 === 0) {
        const a = .28 + .62 * (1 - i / 130);
        ctx.globalAlpha = clamp(a, .16, .9);
        ctx.fillStyle = '#9ff0ff';
        ctx.beginPath(); ctx.arc(S.x, S.y, 3.2, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (landed && !landed.out) {
      const pul = 1 + Math.sin(g.t * 9) * .08;
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(landed.x, landed.y, 17 * pul, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(landed.x, landed.y, 5, 0, TAU); ctx.fillStyle = '#ffd34d'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(landed.x, landed.y - 26); ctx.lineTo(landed.x, landed.y - 12);
      ctx.moveTo(landed.x, landed.y + 12); ctx.lineTo(landed.x, landed.y + 26); ctx.stroke();
    }
    // power arc near the muzzle
    muzzle(aim.dir);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(mz.x, mz.y, 40, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = aim.pow > .8 ? '#ff6a3c' : '#ffd34d'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(mz.x, mz.y, 40, -1.2, -1.2 + 2.4 * aim.pow); ctx.stroke();
    if (hints < 6) {
      g.text('DRAG & RELEASE', player.x + 20, surfAt(player.x) + 62, { size: 20, color: 'rgba(255,255,255,' + (0.45 + 0.35 * Math.sin(g.t * 4)) + ')', align: 'center' });
    }
  }
  if (boom) {
    const u = clamp(boom.t / .34, 0, 1);
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = boom.spark ? '#fff3b0' : '#ffb347'; ctx.lineWidth = 9 * (1 - u) + 2;
    ctx.beginPath(); ctx.arc(boom.x, boom.y, boom.r * (0.35 + u * 1.25), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ hud */
function hDraw(ctx) {
  // score
  g.text('SCORE', 26, 42, { size: 18, color: '#8fb0ff' });
  g.text(fmt(g.score), 26, 92, { size: 50, color: '#fff', stroke: 9 });
  // player hearts
  const hy = 128;
  ctx.globalAlpha = .95;
  for (let i = 0; i < player.max; i++) {
    const x = 34 + i * 30, on = i < player.hp;
    ctx.save(); ctx.translate(x, hy); ctx.scale(1.05, 1.05);
    heartPath(ctx, 0, 0, 13);
    ctx.fillStyle = on ? '#ff4d6d' : 'rgba(255,255,255,.13)'; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(10,8,20,.85)'; ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // enemy hearts (right)
  g.text('ZOMBIE', W - 26, 42, { size: 20, color: '#8fd98a', align: 'right' });
  for (let i = 0; i < foe.max; i++) {
    const x = W - 26 - (foe.max - 1 - i) * 30, on = i < foe.hp;
    ctx.save(); ctx.translate(x, hy); ctx.scale(1.05, 1.05);
    heartPath(ctx, 0, 0, 13);
    ctx.fillStyle = on ? '#8bff6a' : 'rgba(255,255,255,.13)'; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(10,8,20,.85)'; ctx.stroke();
    ctx.restore();
  }
  // turn pill
  const txt = phase === 'foeAim' || (proj && proj.who === 1) ? "ZOMBIE'S TURN" : phase === 'aim' ? 'YOUR SHOT' : 'INCOMING';
  const col = phase === 'aim' ? '#ffd34d' : '#ff6a8a';
  ctx.globalAlpha = .82; ctx.fillStyle = 'rgba(8,10,24,.82)';
  rr(ctx, W * .5 - 96, 112, 192, 34, 17); ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = hexA(col, .55); ctx.stroke();
  g.text(txt, W * .5, 136, { size: 18, color: col, align: 'center' });

  // wind gauge
  const ww = Math.min(1, Math.abs(wind) / 160);
  ctx.fillStyle = 'rgba(8,10,24,.72)'; rr(ctx, W * .5 - 92, 160, 184, 40, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(159,240,255,.28)'; ctx.lineWidth = 2; ctx.stroke();
  const dir = wind >= 0 ? 1 : -1;
  ctx.fillStyle = '#9ff0ff';
  for (let i = 0; i < 3; i++) {
    const a = .35 + ww * .65, x = W * .5 + dir * (14 + i * 17) - (dir < 0 ? 10 : 0);
    ctx.globalAlpha = a * (1 - i * .12);
    ctx.beginPath(); ctx.moveTo(x, 174); ctx.lineTo(x + dir * 9, 180); ctx.lineTo(x, 186); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  g.text(ww < .06 ? 'NO WIND' : 'WIND ' + Math.abs(Math.round(wind)), W * .5 - 8, 186, { size: 17, color: '#9ff0ff', align: 'center' });

  // aim timer bar
  if (phase === 'aim' && !isAuto) {
    const u = clamp(1 - phaseT / AIM_TIME, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, W * .5 - 92, 206, 184, 8, 4); ctx.fill();
    ctx.fillStyle = u < .3 ? '#ff5f6d' : '#ffd34d'; rr(ctx, W * .5 - 92, 206, 184 * u, 8, 4); ctx.fill();
  }
  // chain
  if (chain > 1) g.text('CHAIN x' + chain, W * .5, 252, { size: 30, color: '#ffd34d', align: 'center', stroke: 8 });
  if (bannerT > 0) {
    const u = clamp(bannerT / .8, 0, 1);
    ctx.globalAlpha = Math.min(1, u * 2.2);
    g.text(banner, W * .5, 300, { size: 46, color: '#fff', align: 'center', stroke: 12 });
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ boot */
g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('meow'); g.showBanner('CAT-A-PULT', .9); };
resetWorld();

g.draw = () => {
  const ctx = g.ctx;
  drawWorld();
  if (proj) {
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(Math.atan2(proj.vy, proj.vx));
    ctx.fillStyle = proj.who ? '#c9a6ff' : '#ffd34d';
    ctx.strokeStyle = '#0c0a16'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-22, -8); ctx.lineTo(-22, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0c0a16'; ctx.beginPath(); ctx.arc(5, -2.5, 2, 0, TAU); ctx.fill();
    ctx.restore();
    g.fx.p.length > 400 && g.fx.p.splice(0, 60);
  }
  hDraw(ctx);
};
g.update = update;
g.start();

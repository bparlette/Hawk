// ZOMBIE BRAWL — arena-brawler (Cat Arcade v2)
// One screen, one mechanic: drag to move the cat, mash to punch. Clear three waves of zombies off the street.
// 3-second rule: orange cat = you · green zombies = the problem · the wave bar = the goal.
import { makeGame, sfx, music, comboPitch, clamp, lerp, chance, R, TAU, heartPath } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const HORIZON = 566;          // where the sky meets the sidewalk
const FY = 632, BY = 870;     // play-field floor: far edge / near edge (2.5D depth band)
const BTN = { x: 366, y: 866, w: 154, h: 86 };

const g = makeGame({
  id: 'arena-brawler', title: 'ZOMBIE BRAWL', sub: 'DRAG TO MOVE  ·  MASH TO PUNCH',
  hook: '1 cat vs the whole street', w: W, h: H, bg: '#0b0618', style: 'toon',
  bloom: .82, ca: .32, vig: 1, scan: .16,
});
const ctx = g.ctx;
const isAuto = new URLSearchParams(location.search).has('auto');
const depth = y => .66 + clamp((y - FY) / (BY - FY), 0, 1) * .44;   // sprite scale by depth (0.66 far → 1.10 near)

/* ================================================================= waves */
const WAVES = [
  [{ x: 400, y: 690, hp: 4 }, { x: 148, y: 780, hp: 4 }, { x: 418, y: 852, hp: 4 }],
  [{ x: 420, y: 668, hp: 5 }, { x: 130, y: 748, hp: 5 }, { x: 448, y: 838, hp: 5 }],
  [{ x: 400, y: 680, hp: 5 }, { x: 142, y: 812, hp: 5 }, { x: 452, y: 860, hp: 5 }, { x: 292, y: 872, hp: 8, boss: true }],
];
const NAMES = ['WAVE 1 / 3', 'WAVE 2 / 3', 'FINAL WAVE'];

/* ================================================================= state */
let P, EN, wave, clearT, kills, autoT, botT, botDir, camX, t, punchFx, musicOn;
const order = [];

function resetWorld() {
  P = { x: 270, y: 792, d: 1, hp: 5, max: 5, cd: 0, t: 0, inv: 0, atk: 0, sq: 1, stride: 0, leap: 0 };
  EN = []; wave = -1; clearT = 0; kills = 0; autoT = 0; botT = 0; botDir = 1;
  camX = 0; t = 0; punchFx = 0; musicOn = false;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, hp: 5, wave: 1, left: 0, kills: 0, combo: 0 };
  g.hud.l = ''; g.hud.r = '';
  nextWave();
}
g.onReset = resetWorld;
g.onStart = () => music('chase');

function nextWave() {
  wave++;
  clearT = 0;
  const list = WAVES[wave];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    EN.push({
      x: s.x, y: s.y, d: s.x > P.x ? -1 : 1, hp: s.hp, max: s.hp, boss: !!s.boss,
      spd: 98 + wave * 11 + (s.boss ? -16 : 0), t: R() * 4, cd: .9 + i * .3,
      fl: 0, kb: 0, vx: 0, wind: 0, lunge: 0, lcd: 0, rise: .5, dead: 0,
    });
    const sc = depth(s.y) * (s.boss ? 1.5 : 1);
    g.fx.burst(s.x, s.y, 12, { kind: 'smoke', color: 'rgba(140,220,120,.35)', speed: 150, life: .7, size: 16 * sc, g: -40 });
    g.fx.burst(s.x, s.y - 30, 8, { kind: 'debris', color: ['#3d7a34', '#8fef7a'], speed: 200, life: .6, size: 6 });
  }
  sfx(wave === WAVES.length - 1 ? 'boom' : 'groan', { pitch: 1.06 - wave * .07, vol: .6 });
  g.showBanner(NAMES[wave] || 'WAVE', 1.1);
  if (wave === WAVES.length - 1) { g.shake(10); g.flash('#8fef7a', .16); }
}

function aliveCount() { let n = 0; for (const e of EN) if (e.hp > 0) n++; return n; }

/* ================================================================= combat */
function punch() {
  if (P.cd > 0 || g.mode !== 'play') return;
  P.cd = .28; P.atk = .2; P.leap = 1; punchFx = 1;
  sfx('whoosh', { vol: .45 });
  const cx = P.x + P.d * 54, cy = P.y - 62 * depth(P.y);
  g.fx.burst(cx, cy, 5, { kind: 'spark', color: ['#fff', '#ffd34d'], speed: 190, life: .22, size: 5, ang: P.d > 0 ? 0 : Math.PI, spread: 1.1 });
  let hits = 0;
  for (const e of EN) {
    if (e.hp <= 0) continue;
    const dx = (e.x - P.x) * P.d, dy = e.y - P.y;
    if (dx > -30 && dx < 112 && Math.abs(dy) < 48) {
      hits++;
      e.hp--; e.fl = .2; e.wind = 0; e.kb = .2; e.vx = P.d * (e.boss ? 180 : 310); e.d = P.d > 0 ? 1 : -1;
      const sc = depth(e.y), px = e.x, py = e.y - 60 * sc;
      g.combo.hit(px, py - 40, e.hp <= 0 ? 'KO!' : 'POW');
      g.score += 14 * g.combo.mult;
      sfx('hit', { pitch: comboPitch(g.combo.n % 12), vol: .9 });
      g.impact(px, py, { punch: .09, shake: 8, stop: .045, rip: 1 });
      g.fx.burst(px, py, 10, { kind: 'spark', color: ['#fff', '#8fef7a', '#ffd34d'], speed: 330, life: .4, size: 6 });
      g.fx.emit('ring', px, py, { size: 26, life: .3, color: '#ffffff', add: true, wide: 6 });
      if (e.hp <= 0) kill(e);
    }
  }
  if (!hits) { g.combo.miss(); sfx('thud', { vol: .28, pitch: 1.5 }); }
}

function kill(e) {
  e.dead = 0.001;
  const sc = depth(e.y), py = e.y - 58 * sc;
  kills++;
  g.score += (e.boss ? 420 : 90) * g.combo.mult;
  sfx('boom', { vol: e.boss ? 1 : .5, pitch: e.boss ? .78 : 1.25 });
  g.fx.blast(e.x, py, {
    r: e.boss ? 150 : 80, color: '#8fef7a', colors: ['#8fef7a', '#d9ffcf', '#ffd34d'],
    n: e.boss ? 40 : 18, speed: e.boss ? 480 : 320, size: 7,
    shake: e.boss ? 24 : 8, punch: e.boss ? .2 : .06, flashA: e.boss ? .35 : .1,
  });
  g.fx.burst(e.x, py, e.boss ? 26 : 10, { kind: 'debris', color: ['#6fbf5a', '#3d7a34', '#c9ffbe'], speed: 300, life: .8, size: 7 });
  if (e.boss) { g.slowmo(.32, 1.1); g.showBanner('BOSS DOWN!', 1.2); }
  else if (kills % 4 === 0) g.slowmo(.5, .45);
}

function hurt() {
  if (P.inv > 0 || g.mode !== 'play') return;
  P.hp--; P.inv = .58; P.sq = .74;
  sfx('hit', { pitch: .78, vol: 1 });
  g.shake(15); g.hitstop(.08); g.flash('#ff3b5c', .32);
  g.combo.miss();
  g.fx.burst(P.x, P.y - 58, 14, { color: ['#ff3b5c', '#fff', '#ffb347'], speed: 300, life: .6, size: 7 });
  g.popup('-1', P.x, P.y - 132, '#ff5c78', 40);
  if (P.hp <= 0) lose();
}

function lose() {
  g.fx.blast(P.x, P.y - 60, { r: 150, color: '#ff3b5c', colors: ['#ff3b5c', '#ffb347', '#fff'], n: 34, speed: 420, shake: 26, punch: .22, flashA: .4 });
  const tot = WAVES[wave].length, prog = Math.round(((wave + (tot - aliveCount()) / tot) / WAVES.length) * 100);
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE', progress: prog });
}

function win() {
  g.showBanner('STREET CLEARED!', 1.6);
  g.fx.burst(W / 2, 380, 80, { kind: 'confetti', color: ['#ffd34d', '#7df9ff', '#ff4ad8', '#7dff7d', '#fff'], speed: 560, life: 1.7, g: 380, size: 7 });
  g.fx.blast(W / 2, 420, { r: 210, color: '#ffd34d', colors: ['#ffd34d', '#fff', '#ffb347'], n: 50, speed: 520, shake: 14, punch: .14, flashA: .35 });
  g.score += 500;
  g.end({ win: true, score: Math.round(g.score), label: 'SCORE', progress: 100 });
}

/* ================================================================= bot */
function botThink(dt) {
  let mvx = 0, mvy = 0, wantPunch = false;
  if (g.dumb()) {
    /* wanders the street and never throws a punch — the video's fail state */
    botT -= dt;
    if (botT <= 0) { botT = .5; botDir = chance(.5) ? 1 : -1; }
    mvx = botDir; mvy = Math.sin(t * 1.7) > .4 ? 1 : -1;
    if (chance(.015)) P.d = -P.d;
    return { mvx, mvy, wantPunch };
  }
  let best = null, bd = 1e9;
  for (const e of EN) {
    if (e.hp <= 0 || e.rise > 0) continue;
    const d = Math.abs(e.x - P.x) + Math.abs(e.y - P.y) * 1.6;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return { mvx, mvy, wantPunch };
  const dx = best.x - P.x, dy = best.y - P.y;
  /* danger check: something is winding up a swing on us → hop back out of reach */
  let threat = null;
  for (const e of EN) {
    if (e.hp <= 0 || e.wind <= 0) continue;
    if (Math.abs(e.x - P.x) < 150 && Math.abs(e.y - P.y) < 70) { threat = e; break; }
  }
  if (threat && P.inv <= 0) {
    mvx = -Math.sign(threat.x - P.x) || 1;
    mvy = Math.abs(threat.y - P.y) < 20 ? (P.y > (FY + BY) / 2 ? -1 : 1) : -Math.sign(threat.y - P.y);
    P.d = mvx;
    return { mvx, mvy, wantPunch: false };
  }
  if (Math.abs(dx) > 74) mvx = Math.sign(dx);
  if (Math.abs(dy) > 10) mvy = Math.sign(dy);
  P.d = dx >= 0 ? 1 : -1;
  if (Math.abs(dx) < 104 && Math.abs(dy) < 40 && P.cd <= 0) wantPunch = true;
  return { mvx, mvy, wantPunch };
}

/* ================================================================= update */
function update(dt) {
  if (g.mode !== 'play') return;
  t += dt;
  if (!musicOn) { musicOn = true; music('chase'); }
  P.t += dt; P.cd -= dt; P.atk -= dt; P.inv -= dt;
  P.sq = lerp(P.sq, 1, Math.min(1, dt * 9));
  P.leap = Math.max(0, P.leap - dt * 4.5);
  punchFx = Math.max(0, punchFx - dt * 4);

  /* ---------------- input ---------------- */
  let mvx = 0, mvy = 0, wantPunch = false;
  const pb = g.btn('punch', BTN.x, BTN.y, BTN.w, BTN.h, 'PUNCH', { key: 'Space' });
  if (pb.pressed || pb.held) wantPunch = true;
  if (g.taps.length) wantPunch = true;                       // tap anywhere = punch
  if (g.keys.ArrowRight || g.keys.KeyD) mvx = 1;
  if (g.keys.ArrowLeft || g.keys.KeyA) mvx = -1;
  if (g.keys.ArrowDown || g.keys.KeyS) mvy = 1;
  if (g.keys.ArrowUp || g.keys.KeyW) mvy = -1;
  if (g.pressed.KeyJ || g.pressed.KeyK || g.pressed.Enter) wantPunch = true;

  /* touch: drag anywhere to move */
  if (g.ptr.down) {
    const inBtn = g.ptr.x > BTN.x - 20 && g.ptr.y > BTN.y - 20 && g.ptr.x < BTN.x + BTN.w + 20 && g.ptr.y < BTN.y + BTN.h + 20;
    if (!inBtn) {
      const dxp = g.ptr.x - P.x, dyp = g.ptr.y - P.y;
      if (dxp * dxp + dyp * dyp > 34 * 34) {
        if (Math.abs(dxp) > 16) mvx = Math.sign(dxp);
        if (Math.abs(dyp) > 18) mvy = Math.sign(dyp);
      }
    }
  }

  if (isAuto) {
    const b = botThink(dt);
    mvx = b.mvx; mvy = b.mvy;
    if (b.wantPunch) wantPunch = true;
    autoT += dt;
  }
  if (wantPunch) punch();

  /* ---------------- player motion ---------------- */
  if (mvx && !isAuto) P.d = mvx;
  const nx = clamp(P.x + mvx * 252 * dt, 48, 492), ny = clamp(P.y + mvy * 152 * dt, FY + 10, BY - 6);
  if (nx !== P.x) P.stride += dt * 11;
  if (mvx || mvy) {
    P.sq = lerp(P.sq, .94, .18);
    if ((g.t * 60 | 0) % 3 === 0) g.fx.emit('smoke', nx, ny, { vx: -mvx * 26, vy: -8, g: -10, life: .3, size: 8, color: 'rgba(190,160,230,.16)' });
  } else P.stride = lerp(P.stride, Math.round(P.stride / TAU) * TAU, .12);
  P.x = nx; P.y = ny;
  camX = lerp(camX, clamp(P.x - 270, -140, 140), Math.min(1, dt * 3));

  /* ---------------- enemies ---------------- */
  let living = 0;
  for (const e of EN) if (e.hp > 0) living++;
  for (const e of EN) {
    if (e.hp <= 0) { if (e.dead) e.dead += dt; continue; }
    if (e.rise > 0) { e.rise -= dt; continue; }
    e.t += dt; e.fl -= dt; e.cd -= dt;
    if (e.kb > 0) { e.kb -= dt; e.x = clamp(e.x + e.vx * dt, 24, 620); e.vx *= .88; continue; }
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) {
        const dx = P.x - e.x, dy = P.y - e.y;
        if (Math.abs(dx) < 108 && Math.abs(dy) < 46) hurt();
        else { sfx('whoosh', { vol: .22, pitch: .7 }); g.fx.burst(e.x + e.d * 42, e.y - 56, 5, { kind: 'smoke', color: 'rgba(170,220,150,.35)', speed: 130, life: .35, g: -30 }); }
      }
      continue;
    }
    const dx = P.x - e.x, dy = P.y - e.y;
    e.d = dx > 0 ? 1 : -1;
    e.lcd -= dt;
    if (e.lunge > 0) {
      e.lunge -= dt;
      e.x = clamp(e.x + e.d * e.spd * 2.7 * dt, 24, 600);
      if (Math.abs(dy) > 10) e.y = clamp(e.y + Math.sign(dy) * e.spd * 1.5 * dt, FY + 12, BY - 8);
      if (chance(dt * 8)) g.fx.emit('smoke', e.x, e.y, { vx: -e.d * 40, vy: -14, g: -10, life: .4, size: 11, color: 'rgba(150,220,130,.2)' });
      continue;
    }
    if (Math.abs(dx) > 78 || Math.abs(dy) > 30) {
      if (Math.abs(dx) > 78) e.x += Math.sign(dx) * e.spd * dt;
      if (Math.abs(dy) > 16) e.y = clamp(e.y + Math.sign(dy) * e.spd * .6 * dt, FY + 12, BY - 8);
      if (chance(dt * 2.5)) g.fx.emit('smoke', e.x, e.y, { vx: -e.d * 14, vy: -6, g: -8, life: .35, size: 9, color: 'rgba(150,220,130,.14)' });
      if (Math.abs(dx) > 96 && Math.abs(dx) < 230 && Math.abs(dy) < 66 && e.lcd <= 0) {
        e.lunge = e.boss ? .42 : .3; e.lcd = 1.5 + R() * .8;
        sfx('whoosh', { vol: .3, pitch: .62 });
        g.fx.dust(e.x, e.y, 5, { speed: 140, up: 40, size: 13, color: 'rgba(150,220,130,.24)' });
      }
    } else if (e.cd <= 0) {
      e.cd = (e.boss ? 1.2 : .92) - wave * .04;
      e.wind = e.boss ? .42 : .32;
      sfx('groan', { vol: .2, pitch: e.boss ? .7 : 1.15 });
    }
  }
  if (EN.some(e => e.hp <= 0 && e.dead > .45)) EN = EN.filter(e => e.hp > 0 || e.dead < .45);

  /* ---------------- wave flow ---------------- */
  if (living === 0) {
    clearT += dt;
    if (clearT > .8) {
      if (wave >= WAVES.length - 1) { win(); return; }
      if (P.hp < P.max) {
        P.hp++; sfx('coin', { pitch: 1.4, vol: .7 });
        g.fx.burst(P.x, P.y - 90, 10, { kind: 'heart', color: '#ff4d6d', speed: 130, life: .8, g: -140 });
        g.popup('+1', P.x, P.y - 140, '#7dff7d', 42);
      }
      nextWave();
    }
  } else clearT = 0;

  if (isAuto && autoT > 40) { win(); return; }

  g.state = { score: Math.round(g.score), hp: P.hp, wave: wave + 1, left: living, kills, combo: g.combo.n };
}

/* ================================================================= art layers */
let _s = 20240917;
const ar = (a = 0, b = 1) => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return a + (_s / 0x7fffffff) * (b - a); };
const LW = 760;
function layer(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }

/* far skyline — almost silhouette, washed violet */
const FAR = layer(LW, 470, (c, w, h) => {
  const base = 440;
  let x = -40;
  while (x < w) {
    const bw = ar(52, 96), bh = ar(120, 250);
    c.fillStyle = '#1d1240'; c.fillRect(x, base - bh, bw, bh + 40);
    c.fillStyle = '#241650'; c.fillRect(x, base - bh, bw, 6);
    for (let wy = base - bh + 16; wy < base - 12; wy += 20)
      for (let wx = x + 9; wx < x + bw - 12; wx += 17)
        if (ar() > .52) { c.fillStyle = ar() > .45 ? '#4c3a8f' : '#8a6bd8'; c.fillRect(wx, wy, 6, 9); }
    x += bw + ar(4, 16);
  }
  const haze = c.createLinearGradient(0, 150, 0, h);
  haze.addColorStop(0, 'rgba(50,25,90,0)'); haze.addColorStop(1, 'rgba(120,50,120,.55)');
  c.fillStyle = haze; c.fillRect(0, 150, w, h - 150);
});

/* mid buildings — darker, closer, neon signage */
const NEON = ['#ff4ad8', '#7df9ff', '#ffd34d', '#8fef7a'];
const MID = layer(LW, 520, (c, w, h) => {
  const base = 500;
  let x = -30;
  while (x < w) {
    const bw = ar(74, 132), bh = ar(150, 300);
    c.fillStyle = '#150c2c'; c.fillRect(x, base - bh, bw, bh + 40);
    c.fillStyle = '#241343'; c.fillRect(x + 6, base - bh + 10, bw - 12, bh - 40);
    for (let wy = base - bh + 26; wy < base - 34; wy += 26)
      for (let wx = x + 14; wx < x + bw - 20; wx += 22)
        if (ar() > .4) { c.fillStyle = ar() > .35 ? '#ffca6b' : '#ffe6b0'; c.globalAlpha = .8; c.fillRect(wx, wy, 9, 13); c.globalAlpha = 1; }
    const nc = NEON[Math.floor(ar(0, NEON.length)) % NEON.length];
    const shy = base - bh + ar(30, 120);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x + bw * .3, shy, bw * .44, 26);
    c.strokeStyle = nc; c.lineWidth = 3; c.strokeRect(x + bw * .3, shy, bw * .44, 26);
    c.globalAlpha = .5; c.fillStyle = nc; c.fillRect(x + bw * .3, shy, bw * .44, 26); c.globalAlpha = 1;
    x += bw + ar(2, 12);
  }
  const haze = c.createLinearGradient(0, 120, 0, h);
  haze.addColorStop(0, 'rgba(20,8,40,0)'); haze.addColorStop(.75, 'rgba(60,20,80,.7)'); haze.addColorStop(1, 'rgba(140,40,90,.85)');
  c.fillStyle = haze; c.fillRect(0, 120, w, h - 120);
});

/* ================================================================= cached paints */
const SKY = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
SKY.addColorStop(0, '#0a0618'); SKY.addColorStop(.42, '#2a1150'); SKY.addColorStop(.74, '#6b1c58'); SKY.addColorStop(1, '#c4493f');
const SKYGLOW = ctx.createRadialGradient(W * .58, HORIZON - 30, 10, W * .58, HORIZON - 30, W * .95);
SKYGLOW.addColorStop(0, 'rgba(255,170,90,.5)'); SKYGLOW.addColorStop(.45, 'rgba(255,90,140,.18)'); SKYGLOW.addColorStop(1, 'rgba(0,0,0,0)');
const ROAD = ctx.createLinearGradient(0, HORIZON, 0, H);
ROAD.addColorStop(0, '#2a2140'); ROAD.addColorStop(.35, '#1d1730'); ROAD.addColorStop(1, '#0d0918');
const SIDEWALK = ctx.createLinearGradient(0, HORIZON - 8, 0, HORIZON + 62);
SIDEWALK.addColorStop(0, '#3b2a58'); SIDEWALK.addColorStop(1, '#241a3a');
const DANGER = ctx.createLinearGradient(0, 300, 0, H);
DANGER.addColorStop(0, 'rgba(255,40,70,0)'); DANGER.addColorStop(1, 'rgba(255,40,70,.42)');
const SPILL = [];
for (let i = 0; i < 4; i++) {
  const gr = ctx.createLinearGradient(0, HORIZON + 64, 0, HORIZON + 300);
  gr.addColorStop(0, NEON[i % NEON.length]); gr.addColorStop(1, 'rgba(0,0,0,0)');
  SPILL.push(gr);
}
const LAMP = [];
for (let i = 0; i < 2; i++) {
  const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, 120);
  gr.addColorStop(0, 'rgba(255,214,150,.85)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
  LAMP.push(gr);
}

/* ================================================================= draw */
function drawHero(px, py, sc) {
  const h = 118 * sc;
  const bob = Math.sin(t * 4.2) * 3 * sc;
  const sq = P.sq;
  ctx.save();
  ctx.translate(px + P.d * P.leap * 12 * sc, py - P.leap * 8 * sc);
  ctx.scale((2 - sq) * P.d, sq);
  if (P.inv > 0 && Math.floor(t * 22) % 2) ctx.globalAlpha = .45;
  drawChar('cat', ctx, 0, -bob, h, { dir: 1, anim: 'walk', t: P.stride, color: '#ffb347', hurt: P.inv > .55 });
  ctx.restore();
  if (punchFx > 0) {
    ctx.save();
    ctx.globalAlpha = punchFx * .9;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10 * punchFx; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(px + P.d * 24, py - 56 * sc, 58 * sc * (.72 + (1 - punchFx) * .5), P.d > 0 ? -.9 : Math.PI + .9, P.d > 0 ? .9 : Math.PI - .9, P.d < 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawZombie(e) {
  const sc = depth(e.y) * (e.boss ? 1.5 : 1);
  const h = 112 * sc;
  const bob = Math.sin(e.t * 7) * 2.4;
  const wind = Math.max(0, e.wind);
  ctx.save();
  ctx.translate(e.x, e.y + bob + e.rise * 74);
  ctx.scale(1 + wind * .2, 1 - wind * .12);
  if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.dead / .45);
  if (e.rise > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 1 - e.rise / .5);
  drawChar('zombie', ctx, 0, 0, h, { dir: e.d, anim: e.kb > 0 || e.wind > 0 ? 'idle' : 'walk', t: e.t, color: e.boss ? '#5aa84a' : '#8fd07a', hurt: e.fl > 0 || e.wind > 0 });
  ctx.restore();
  if (e.hp > 0 && e.rise <= 0) {
    if (e.wind > 0) {
      ctx.save();
      ctx.globalAlpha = .5 + .5 * Math.sin(e.t * 26);
      g.text('!', e.x, e.y - h - 14, { size: 46 * (e.boss ? 1.25 : 1), align: 'center', color: '#ff3b5c', ink: '#0a0418' });
      ctx.restore();
    }
    if (e.hp < e.max) {
      const bw = 66 * (e.boss ? 1.3 : 1);
      g.bar(e.x - bw / 2, e.y - h - 58, bw, 8, e.hp / e.max, e.boss ? '#ffd34d' : '#8fef7a');
    }
  }
}

function draw() {
  /* ---- sky ---- */
  ctx.fillStyle = SKY; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = SKYGLOW; ctx.fillRect(0, 0, W, HORIZON + 20);
  ctx.save();
  ctx.globalAlpha = .9; ctx.fillStyle = '#ffe0b8';
  ctx.beginPath(); ctx.arc(408, 172, 40, 0, TAU); ctx.fill();
  ctx.globalAlpha = .16; ctx.fillStyle = '#ffd0a0';
  ctx.beginPath(); ctx.arc(408, 172, 74, 0, TAU); ctx.fill();
  ctx.restore();

  /* ---- parallax ---- */
  const fxo = -Math.round(82 + camX * .10), mxo = -Math.round(60 + camX * .26);
  ctx.drawImage(FAR, fxo, 122, LW, 470);
  ctx.drawImage(MID, mxo, 46, LW, 520);

  /* ---- sidewalk + road ---- */
  ctx.fillStyle = SIDEWALK; ctx.fillRect(0, HORIZON - 6, W, 70);
  ctx.fillStyle = 'rgba(255,180,120,.10)'; ctx.fillRect(0, HORIZON - 6, W, 5);
  ctx.fillStyle = '#3a2f57'; ctx.fillRect(0, HORIZON + 58, W, 8);
  ctx.fillStyle = ROAD; ctx.fillRect(0, HORIZON + 66, W, H - HORIZON - 66);

  /* neon spill on the wet road */
  ctx.save();
  ctx.globalAlpha = .28; ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const nx2 = 40 + i * 150 + mxo * .5;
    ctx.fillStyle = SPILL[i]; ctx.fillRect(nx2 - 16, HORIZON + 66, 32, 236);
  }
  ctx.restore();

  /* moving road dashes */
  ctx.save();
  ctx.globalAlpha = .14; ctx.fillStyle = '#ffd9b0';
  for (let i = 0; i < 4; i++) {
    const yy = HORIZON + 120 + ((t * 46 + i * 78) % 300);
    const ww = 40 + (yy - HORIZON) * .16;
    ctx.fillRect(W / 2 - ww / 2, yy, ww, 5);
  }
  ctx.restore();

  /* arena edge lights */
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const lx = 30 + i * 120 - mxo * .35;
    ctx.globalAlpha = .45 + .3 * Math.sin(t * 3 + i);
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath(); ctx.ellipse(lx, HORIZON + 80, 26, 7, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* ---- entities sorted far → near ---- */
  order.length = 0;
  for (const e of EN) if (e.hp > 0 || e.dead) order.push(e);
  order.push(P);
  order.sort((a, b) => a.y - b.y);
  for (const e of order) {
    if (e === P) {
      const sc = depth(P.y);
      ctx.save(); ctx.globalAlpha = .34; ctx.fillStyle = '#05020c';
      ctx.beginPath(); ctx.ellipse(P.x, P.y + 3, 34 * sc, 11 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
      if (P.inv > 0) {
        ctx.save(); ctx.globalAlpha = .22 + .16 * Math.sin(t * 30); ctx.fillStyle = '#7df9ff';
        ctx.beginPath(); ctx.ellipse(P.x, P.y - 58 * sc, 46 * sc, 66 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      drawHero(P.x, P.y, sc);
    } else {
      const sc = depth(e.y) * (e.boss ? 1.5 : 1);
      ctx.save(); ctx.globalAlpha = e.dead ? Math.max(0, .3 - e.dead / 2) : .32; ctx.fillStyle = '#05020c';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, 32 * sc, 10 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
      drawZombie(e);
    }
  }

  /* ---- foreground lamps ---- */
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const lx = (i ? 516 : 24) - camX * .5;
    const arm = i ? -40 : 40;
    ctx.fillStyle = '#0a0614';
    ctx.fillRect(lx - 5, 250, 10, 620);
    ctx.beginPath(); ctx.moveTo(lx, 264); ctx.quadraticCurveTo(lx + arm * .8, 238, lx + arm, 264); ctx.lineTo(lx, 278); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(lx + arm, 268);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .42 + .1 * Math.sin(t * 2.2 + i);
    ctx.fillStyle = LAMP[i]; ctx.fillRect(-130, -130, 260, 260);
    ctx.restore();
  }
  ctx.restore();

  /* low-hp danger wash */
  if (P.hp <= 2 && g.mode === 'play') {
    ctx.save(); ctx.globalAlpha = .55 + .35 * Math.sin(t * 6); ctx.fillStyle = DANGER; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  /* ---- HUD ---- */
  const aliveN = aliveCount(), tot = WAVES[wave] ? WAVES[wave].length : 1;
  g.text(String(Math.round(g.score)), 26, 84, { size: 62, color: '#ffe9a8', ink: '#0a0418' });
  g.text('SCORE', 30, 108, { size: 20, color: '#ff9ad8', ink: '#0a0418' });
  for (let i = 0; i < P.max; i++) {
    heartPath(ctx, 34 + i * 40, 152, 34);
    ctx.fillStyle = i < P.hp ? '#ff4d6d' : 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#0a0418'; ctx.stroke();
  }
  const bx = 150, bw = 244;
  g.text(NAMES[wave] || 'WAVE', bx + bw / 2, 66, { size: 25, align: 'center', color: '#7df9ff', ink: '#0a0418' });
  ctx.fillStyle = 'rgba(6,3,16,.72)'; ctx.beginPath(); ctx.roundRect(bx, 80, bw, 16, 8); ctx.fill();
  const done = (tot - aliveN) / tot;
  const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grd.addColorStop(0, '#7dff7d'); grd.addColorStop(1, '#ffd34d');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(bx, 80, Math.max(5, bw * done), 16, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, 80, bw, 16, 8); ctx.stroke();
  g.text(`${aliveN} LEFT`, bx + bw / 2, 122, { size: 20, align: 'center', color: '#fff', ink: '#0a0418' });

  if (wave === 0 && t < 5 && g.mode === 'play') {
    ctx.save(); ctx.globalAlpha = .5 + .3 * Math.sin(t * 5);
    g.text('DRAG TO MOVE  ·  MASH TO PUNCH', W / 2, 300, { size: 24, align: 'center', color: '#fff', ink: '#0a0418' });
    ctx.restore();
  }
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({ wave: wave + 1, hp: P.hp, alive: aliveCount(), kills, px: Math.round(P.x), py: Math.round(P.y), en: EN.length });
resetWorld();

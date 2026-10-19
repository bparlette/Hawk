// CAT DUNGEON — one screen, three zombies, one key, one door.
// Slash with real hitstop, clear the room, take the key, climb the stairs.
import { makeGame, sfx, music, comboPitch, clamp, dist, rnd, R, TAU, damp, rr, starPath, squish, hexA } from '../_vendor/gp2x.js';
import { drawChar, heart } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const AUTO = new URLSearchParams(location.search).has('auto');

const g = makeGame({
  id: 'mini-zelda', title: 'CAT DUNGEON', sub: 'SLASH · LOOT · ESCAPE',
  hook: 'clear the room, take the key, climb the stairs',
  w: W, h: H, bg: '#0d0a16', style: 'toon', bloom: .8, ca: .3, vig: 1, scan: .18, grain: .05,
});
g.state = { x: 0, y: 0, hp: 0, enemies: 0, key: 0, door: 0 };

/* ------------------------------------------------------------------ room */
const RX0 = 33, RY0 = 214, RX1 = 507, RY1 = 792;
const T = 44;                       // tile size for the floor look
const PILLARS = [
  { x: 96, y: 336, w: 62, h: 62 },
  { x: 382, y: 336, w: 62, h: 62 },
  { x: 96, y: 616, w: 62, h: 62 },
  { x: 382, y: 616, w: 62, h: 62 },
];
const DOORC = { x: 270, y: 236 };
const DOORBOX = { x: 224, y: 214, w: 92, h: 44 };

const SPEED = 196, FOE_SPEED = 62, SLASH_T = .26, SLASH_CD = .3, REACH = 74, RAID = 32;

/* ------------------------------------------------------------------ scenery */
const MOTES = [];
for (let i = 0; i < 26; i++) MOTES.push({ x: R() * W, y: 200 + R() * 600, s: 1.2 + R() * 2.4, p: R() * TAU });
const TORCH = [{ x: 74, y: 268 }, { x: 466, y: 268 }, { x: 74, y: 738 }, { x: 466, y: 738 }];

/* ------------------------------------------------------------------ runtime */
let p, foes, key, doorOpen, score, raid, playT, t, banner, shakeT, ramped, lastKill;

function resetWorld() {
  p = { x: 270, y: 700, dir: 1, fx: 0, fy: -1, hp: 3, inv: 0, swing: 0, cd: 0, sq: 1, walk: 0, anim: 'idle' };
  foes = [
    { x: 150, y: 350, hp: 2, vx: 0, vy: 0, kb: 0, fl: 0, cd: 1.2, ph: 0, home: { x: 150, y: 350 } },
    { x: 400, y: 430, hp: 2, vx: 0, vy: 0, kb: 0, fl: 0, cd: 1.6, ph: 2.1, home: { x: 400, y: 430 } },
    { x: 270, y: 330, hp: 2, vx: 0, vy: 0, kb: 0, fl: 0, cd: .8, ph: 4.2, home: { x: 270, y: 330 } },
  ];
  key = null; doorOpen = 0; score = 0; raid = RAID; playT = 0; t = 0; banner = 1.9;
  ramped = 0; lastKill = { x: 270, y: 400 }; shakeT = 0;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { x: 270, y: 700, hp: 3, enemies: 3, key: 0, door: 0 };
}
const aliveFoes = () => foes.filter(f => f.hp > 0);
const prog = () => clamp(1 - (aliveFoes().length * .62 + (key ? 0 : .16) + (doorOpen ? 0 : .06)) / 3, 0, 1);

/* ------------------------------------------------------------------ input */
const IN = { mx: 0, my: 0, s: 0, sp: 0 };
function readInput() {
  const dp = g.btn('u', 128, 826, 88, 74, '▲', { key: 'ArrowUp' });
  const dn = g.btn('d2', 128, 900, 88, 46, '▼', { key: 'ArrowDown' });
  const lf = g.btn('l', 20, 862, 100, 84, '◀', { key: 'ArrowLeft' });
  const rt = g.btn('r', 224, 862, 100, 84, '▶', { key: 'ArrowRight' });
  const sw = g.btn('s', 372, 838, 150, 104, 'SLASH', { key: 'Space' });
  if (g.dumb()) { IN.mx = IN.my = IN.s = IN.sp = 0; return; }
  if (AUTO) { bot(); return; }
  const k = g.keys;
  IN.mx = (rt.held || k.ArrowRight || k.KeyD ? 1 : 0) - (lf.held || k.ArrowLeft || k.KeyA ? 1 : 0);
  IN.my = (dn.held || k.ArrowDown || k.KeyS ? 1 : 0) - (dp.held || k.ArrowUp || k.KeyW ? 1 : 0);
  IN.s = sw.held || !!k.KeyX; IN.sp = sw.pressed || !!g.pressed.KeyX;
  // drag-anywhere on the floor to walk toward the pointer
  if (!IN.mx && !IN.my && g.ptr.down && g.ptr.y < 800 && g.ptr.y > 210) {
    const dx = g.ptr.x - p.x, dy = g.ptr.y - p.y, d = Math.hypot(dx, dy);
    if (d > 22) { IN.mx = dx / d; IN.my = dy / d; }
  }
}

/* ------------------------------------------------------------------ bot */
function bot() {
  IN.mx = IN.my = 0; IN.s = 0; IN.sp = 0;
  const list = aliveFoes();
  let tx, ty, attack = false;
  if (list.length) {
    let best = list[0], bd = 1e9;
    for (const f of list) { const d = dist(f, p); if (d < bd) { bd = d; best = f; } }
    tx = best.x; ty = best.y;
    if (bd < REACH * .82 && p.cd <= 0) attack = true;
  } else if (key) { tx = key.x; ty = key.y; }
  else { tx = DOORC.x; ty = 250; }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
  if (d > 16) { IN.mx = dx / d; IN.my = dy / d; }
  if (attack) {
    p.fx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    p.fy = p.fx ? 0 : Math.sign(dy) || -1;
    IN.sp = 1;
  }
  if (playT > 26) g.end({ win: true, score: Math.max(900, Math.round(score)) });
}

/* ------------------------------------------------------------------ combat */
function slash() {
  if (p.cd > 0) return;
  p.cd = SLASH_CD; p.swing = SLASH_T;
  sfx('whoosh', { vol: .55, pitch: 1.1 });
  g.punch(.03);
  let hitAny = false;
  for (const f of foes) {
    if (f.hp <= 0) continue;
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
    const dot = (dx / d) * p.fx + (dy / d) * p.fy;
    if (d < REACH && dot > .05) {
      hitAny = true;
      f.hp--; f.fl = .18; f.kb = .22;
      f.vx = (dx / d) * 380; f.vy = (dy / d) * 380;
      const px = f.x, py = f.y - 30;
      g.hitstop(.075); g.shake(7); g.punch(.06);
      sfx('hit', { pitch: 1 + (2 - f.hp) * .22 });
      g.fx.burst(px, py, 10, { color: ['#fff', '#9be07a', '#d6ffb8'], speed: 300, size: 7, life: .4 });
      g.fx.emit('ring', px, py, { size: 34, life: .24, color: '#ffffff', add: true, wide: 5 });
      if (f.hp <= 0) killFoe(f);
      else g.combo.hit(px, py, '+60'), score += 60;
    }
  }
  if (hitAny) g.fx.burst(p.x + p.fx * 40, p.y - 26 + p.fy * 40, 6, { color: '#ffffff', speed: 190, size: 5, life: .25, g: 20 });
}

function killFoe(f) {
  score += 100; g.score = score;
  g.combo.hit(f.x, f.y - 34, '+100');
  lastKill = { x: f.x, y: f.y };
  sfx('boom', { vol: .45, pitch: 1.1 });
  g.fx.blast(f.x, f.y - 30, { r: 78, color: '#9be07a', colors: ['#9be07a', '#fff', '#d6ffb8'], n: 20, punch: .09, shake: 10, smoke: true });
  for (let i = 0; i < 8; i++) g.fx.emit('shard', f.x + rnd(-14, 14), f.y - 26, { vx: rnd(-220, 220), vy: rnd(-320, -80), g: 900, life: .8, size: rnd(3, 7), color: '#6f9e52', rot: rnd(0, 3), vr: rnd(-9, 9) });
  g.shake(9); g.punch(.08);
  if (!aliveFoes().length && !key) dropKey();
}

function dropKey() {
  key = { x: clamp(lastKill.x, RX0 + 40, RX1 - 40), y: clamp(lastKill.y, RY0 + 70, RY1 - 40), ph: 0 };
  sfx('powerup', { pitch: 1.15 }); g.flash('#ffd34d', .3); g.slowmo(.4, .45); g.shake(8);
  g.showBanner('KEY!', 1.1);
  g.fx.blast(key.x, key.y - 20, { r: 90, color: '#ffd34d', n: 22, punch: .1, shake: 8 });
  for (let i = 0; i < 12; i++) g.fx.emit('star', key.x, key.y - 20, { vx: rnd(-180, 180), vy: rnd(-260, -40), g: 420, life: 1, size: rnd(5, 10), color: '#fff3b0', rot: rnd(0, 3) });
}

function grabKey() {
  key = null; doorOpen = 1; score += 250; g.score = score;
  g.combo.hit(p.x, p.y - 60, '+250');
  sfx('coin', { pitch: 1.5 }); sfx('unlock', { pitch: 1.2, vol: .8 });
  g.flash('#ffd34d', .4); g.hitstop(.09); g.shake(10); g.punch(.1);
  g.fx.blast(p.x, p.y - 30, { r: 110, color: '#ffd34d', n: 24 });
  g.showBanner('DOOR OPEN', 1.1);
}

function hurt(foe) {
  if (p.inv > 0) return;
  p.hp--; p.inv = 1.15;
  score = Math.max(0, score - 40);
  sfx('hit', { pitch: .8 }); g.shake(14); g.hitstop(.08); g.flash('#ff3b5c', .3); g.punch(.12);
  const a = Math.atan2(p.y - foe.y, p.x - foe.x);
  p.kx = Math.cos(a) * 320; p.ky = Math.sin(a) * 320;
  g.fx.burst(p.x, p.y - 28, 14, { color: ['#ff5b6e', '#fff'], speed: 320, size: 7, life: .5 });
  if (p.hp <= 0) {
    g.fx.blast(p.x, p.y - 26, { r: 110, color: '#ff5b6e', n: 26, punch: .16, shake: 20 });
    sfx('groan', { pitch: .9 });
    g.end({ win: false, score: Math.round(score), label: 'SCORE' });
    g.showBanner('YOU FELL', 1.3);
  }
}

/* ------------------------------------------------------------------ update */
function update(dt) {
  if (g.mode !== 'play' || p.hp <= 0) return;
  playT += dt; t += dt; p.inv -= dt; p.cd -= dt; p.swing -= dt; p.sq = damp(p.sq, 1, 13, dt);
  if (banner > 0) banner -= dt;
  readInput();

  /* raid clock */
  raid -= dt;
  if (raid <= 0) return timeUp();
  raided();

  /* move */
  const mvx = IN.mx, mvy = IN.my, ml = Math.hypot(mvx, mvy);
  if (ml > .1) {
    const nx = mvx / ml, ny = mvy / ml;
    p.x += nx * SPEED * dt; p.y += ny * SPEED * dt;
    p.walk += dt * 9;
    p.anim = 'walk';
    if (nx) { p.fx = Math.sign(nx); p.fy = 0; if (Math.abs(nx) > .2) p.dir = Math.sign(nx); }
    else if (ny) { p.fx = 0; p.fy = Math.sign(ny); }
    if (R() < dt * 14) g.fx.dust(p.x, p.y, 2, { spread: 12, size: 9, up: 26, color: 'rgba(200,180,255,.28)' });
  } else p.anim = 'idle';
  if (p.kx) { p.x += p.kx * dt; p.y += p.ky * dt; p.kx *= .88; p.ky *= .88; if (Math.abs(p.kx) < 6) p.kx = p.ky = 0; }

  /* walls */
  const wasX = p.x;
  p.x = clamp(p.x, RX0 + 22, RX1 - 22);
  p.y = clamp(p.y, RY0 + 42, RY1 - 20);
  for (const b of PILLARS) {
    if (p.x > b.x - 22 && p.x < b.x + b.w + 22 && p.y > b.y - 8 && p.y < b.y + b.h + 8) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const dx = p.x - cx, dy = p.y - cy;
      if (Math.abs(dx) / (b.w / 2 + 22) > Math.abs(dy) / (b.h / 2 + 8)) p.x = dx > 0 ? b.x + b.w + 22 : b.x - 22;
      else p.y = dy > 0 ? b.y + b.h + 8 : b.y - 8;
    }
  }
  if (p.x !== wasX && Math.abs(p.x - wasX) > 4) p.vxb = 0;

  if (IN.sp || IN.s && p.cd <= 0 && IN.sp) slash();
  if (IN.sp) slash();

  /* foes */
  const spdMul = FOE_SPEED * (1 + Math.min(.7, playT * .028));
  for (const f of foes) {
    if (f.hp <= 0) continue;
    f.fl -= dt; f.cd -= dt; f.ph += dt * 2;
    if (f.kb > 0) {
      f.kb -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vx *= .9; f.vy *= .9;
    } else {
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
      if (d < 380) {
        const wob = Math.sin(f.ph * 1.6) * .35;
        f.x += (dx / d) * spdMul * dt + (-dy / d) * wob * 26 * dt;
        f.y += (dy / d) * spdMul * dt + (dx / d) * wob * 26 * dt;
        f.dir = dx > 0 ? 1 : -1;
      } else {
        const hx = f.home.x - f.x, hy = f.home.y - f.y, hd = Math.hypot(hx, hy) || 1;
        if (hd > 8) { f.x += (hx / hd) * spdMul * .45 * dt; f.y += (hy / hd) * spdMul * .45 * dt; }
      }
      if (d < 34 && f.cd <= 0) { f.cd = 1.4; hurt(f); }
    }
    // keep zombies inside the room and out of pillars
    f.x = clamp(f.x, RX0 + 20, RX1 - 20); f.y = clamp(f.y, RY0 + 52, RY1 - 16);
    for (const b of PILLARS) {
      if (f.x > b.x - 18 && f.x < b.x + b.w + 18 && f.y > b.y - 6 && f.y < b.y + b.h + 6) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = f.x - cx, dy = f.y - cy;
        if (Math.abs(dx) / (b.w / 2 + 18) > Math.abs(dy) / (b.h / 2 + 6)) f.x = dx > 0 ? b.x + b.w + 18 : b.x - 18;
        else f.y = dy > 0 ? b.y + b.h + 6 : b.y - 6;
      }
    }
  }

  /* key + door */
  if (key) {
    key.ph += dt * 3;
    if (dist(key, p) < 40) grabKey();
  }
  if (doorOpen && p.y < RY0 + 70 && Math.abs(p.x - DOORC.x) < 52) winRun();

  g.state = { x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, enemies: aliveFoes().length, key: key ? 0 : 1, door: doorOpen };
}

function raided() {
  // every kill makes the room meaner: banner + faint rumble
  const n = aliveFoes().length;
  if (n < ramped) { ramped = n; if (n > 0) { g.showBanner(`${n} LEFT`, .7); } }
}
function timeUp() {
  sfx('groan', { pitch: .7, vol: 1 }); g.shake(18); g.flash('#ff3b5c', .45);
  g.fx.blast(p.x, p.y - 26, { r: 120, color: '#ff5b5c', n: 26, punch: .16, shake: 18 });
  g.end({ win: false, score: Math.round(score), label: 'SCORE' });
  g.showBanner('THE DUNGEON SEALS', 1.3);
}
function winRun() {
  if (g.mode !== 'play') return;
  const bonus = Math.round(Math.max(0, raid) * 60) + p.hp * 100;
  score += 500 + bonus;
  sfx('fanfare', { vol: 1 }); g.flash('#fff', .55); g.shake(12); g.hitstop(.1); g.slowmo(.4, .7);
  g.fx.burst(DOORC.x, 250, 44, { color: ['#ffd34d', '#fff', '#9be07a', '#ff9a3c'], speed: 430, size: 8, life: 1.1, g: 360, kind: 'confetti' });
  g.fx.blast(DOORC.x, 250, { r: 150, color: '#ffd34d', n: 30, punch: .18, shake: 14 });
  g.popup('+' + (500 + bonus), DOORC.x, 300, '#ffd34d', 40);
  g.end({ win: true, score: Math.round(score), label: 'SCORE' });
}

/* ------------------------------------------------------------------ draw */
function draw(ctx) {
  // deep backdrop with a soft pool of torchlight
  g.sky(ctx, ['#120b1e', '#1d1230', '#0b0714'], { glow: 'rgba(255,150,60,.24)', gx: .5, gy: .45, gr: 1.15 });

  drawWalls(ctx);
  drawFloor(ctx);
  drawTorches(ctx);
  drawDoor(ctx);
  drawKey(ctx);
  drawMotes(ctx);
  drawFoes(ctx);
  drawHero(ctx);
  drawHud(ctx);
}

function drawWalls(ctx) {
  // far wall band above the room + room border bricks
  const gd = ctx.createLinearGradient(0, RY0 - 90, 0, RY0);
  gd.addColorStop(0, '#241a38'); gd.addColorStop(1, '#150e22');
  ctx.fillStyle = gd; ctx.fillRect(0, RY0 - 96, W, 96);
  ctx.fillStyle = '#3a2b52';
  for (let x = 0; x < W; x += 66) { ctx.fillRect(x + 4, RY0 - 78, 58, 26); ctx.fillRect(x + 22, RY0 - 44, 58, 26); }
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let x = 0; x < W; x += 66) { ctx.fillRect(x + 4, RY0 - 78, 58, 4); ctx.fillRect(x + 22, RY0 - 44, 58, 4); }

  // room frame
  const bw = 22;
  const g2 = ctx.createLinearGradient(0, RY0 - bw, 0, RY1 + bw);
  g2.addColorStop(0, '#3d2d58'); g2.addColorStop(1, '#221733');
  ctx.fillStyle = g2;
  ctx.fillRect(RX0 - bw, RY0 - bw, bw, RY1 - RY0 + bw * 2);
  ctx.fillRect(RX1, RY0 - bw, bw, RY1 - RY0 + bw * 2);
  ctx.fillRect(RX0 - bw, RY1, RX1 - RX0 + bw * 2, bw);
  ctx.fillRect(RX0 - bw, RY0 - bw, RX1 - RX0 + bw * 2, bw);
  ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 4;
  ctx.strokeRect(RX0 - bw, RY0 - bw, RX1 - RX0 + bw * 2, RY1 - RY0 + bw * 2);
}

function drawFloor(ctx) {
  const gd = ctx.createRadialGradient(W * .5, 500, 40, W * .5, 500, 420);
  gd.addColorStop(0, '#3a2c55'); gd.addColorStop(1, '#231838');
  ctx.fillStyle = gd; ctx.fillRect(RX0, RY0, RX1 - RX0, RY1 - RY0);
  // checker tiles
  for (let y = RY0; y < RY1; y += T) {
    for (let x = RX0; x < RX1; x += T) {
      if (((x / T) | 0) % 2 === ((y / T) | 0) % 2) {
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        ctx.fillRect(x, y, T, T);
      }
    }
  }
  ctx.strokeStyle = 'rgba(10,6,20,.35)'; ctx.lineWidth = 1;
  for (let x = RX0; x <= RX1; x += T) { ctx.beginPath(); ctx.moveTo(x, RY0); ctx.lineTo(x, RY1); ctx.stroke(); }
  for (let y = RY0; y <= RY1; y += T) { ctx.beginPath(); ctx.moveTo(RX0, y); ctx.lineTo(RX1, y); ctx.stroke(); }
  // rune circle in the middle
  ctx.save(); ctx.translate(270, 500); ctx.rotate(t * .12);
  ctx.strokeStyle = 'rgba(255,211,77,.12)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 72, Math.sin(a) * 72); ctx.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); ctx.stroke(); }
  ctx.restore();
  // pillars
  for (const b of PILLARS) {
    const pg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    pg.addColorStop(0, '#584074'); pg.addColorStop(.5, '#3d2b55'); pg.addColorStop(1, '#241833');
    ctx.fillStyle = pg; rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 4; rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(ctx, b.x + 8, b.y + 8, b.w - 16, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(ctx, b.x + 6, b.y + b.h - 12, b.w - 12, 8, 4); ctx.fill();
  }
}

function drawTorches(ctx) {
  for (let i = 0; i < TORCH.length; i++) {
    const o = TORCH[i];
    const fl = .78 + Math.sin(t * 11 + i * 2.2) * .12 + Math.sin(t * 23 + i) * .05;
    const gl = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, 98 * fl);
    gl.addColorStop(0, 'rgba(255,196,90,.42)'); gl.addColorStop(.45, 'rgba(255,130,40,.16)'); gl.addColorStop(1, 'rgba(255,110,20,0)');
    ctx.fillStyle = gl; ctx.fillRect(o.x - 110, o.y - 110, 220, 220);
    ctx.fillStyle = '#241733'; ctx.fillRect(o.x - 6, o.y - 4, 12, 26);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(o.x, o.y - 8, 8 * fl, 15 * fl, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff2c0';
    ctx.beginPath(); ctx.ellipse(o.x, o.y - 8, 3.6 * fl, 8 * fl, 0, 0, TAU); ctx.fill();
    if (R() < .22) g.fx.emit('spark', o.x + rnd(-5, 5), o.y - 12, { vx: rnd(-20, 20), vy: rnd(-90, -40), g: -30, life: .7, size: 4, color: '#ffb347', add: true });
  }
}

function drawDoor(ctx) {
  const b = DOORBOX, open = !!doorOpen;
  // frame
  ctx.fillStyle = '#2b1e40'; rr(ctx, b.x - 10, b.y - 16, b.w + 20, b.h + 26, 10); ctx.fill();
  ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 4; rr(ctx, b.x - 10, b.y - 16, b.w + 20, b.h + 26, 10); ctx.stroke();
  if (!open) {
    const pulse = .5 + .5 * Math.sin(t * 4);
    const gd = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    gd.addColorStop(0, '#4b2230'); gd.addColorStop(.5, '#7a3040'); gd.addColorStop(1, '#3a1a26');
    ctx.fillStyle = gd; rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.strokeStyle = `rgba(255,110,140,${.45 + pulse * .45})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 12, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y + b.h / 2); ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2 + 12); ctx.stroke();
    g.text('LOCKED', b.x + b.w / 2, b.y - 24, { size: 22, align: 'center', color: '#ff8098' });
  } else {
    const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h + 26);
    gl.addColorStop(0, 'rgba(255,211,77,.95)'); gl.addColorStop(1, 'rgba(255,211,77,.15)');
    ctx.fillStyle = gl; rr(ctx, b.x, b.y - 8, b.w, b.h + 30, 6); ctx.fill();
    // stairs
    ctx.fillStyle = '#2b1e40';
    for (let i = 0; i < 3; i++) {
      const sw2 = b.w - i * 26, sx = b.x + (b.w - sw2) / 2;
      ctx.fillStyle = `rgba(20,12,32,${.35 + i * .2})`;
      ctx.fillRect(sx, b.y + 4 + i * 12, sw2, 11);
    }
    g.text('EXIT', b.x + b.w / 2, b.y - 24, { size: 22, align: 'center', color: '#ffd34d' });
  }
}

function drawKey(ctx) {
  if (!key) return;
  const y = key.y - 26 + Math.sin(key.ph) * 7;
  const gl = ctx.createRadialGradient(key.x, y, 0, key.x, y, 52);
  gl.addColorStop(0, 'rgba(255,211,77,.6)'); gl.addColorStop(1, 'rgba(255,211,77,0)');
  ctx.fillStyle = gl; ctx.fillRect(key.x - 52, y - 52, 104, 104);
  ctx.save(); ctx.translate(key.x, y); ctx.rotate(Math.sin(key.ph * .6) * .25);
  ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-6, 0, 10, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 6); ctx.stroke();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-6, 0, 10, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 6); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(key.x, y, 30, 30 + Math.sin(key.ph * 2) * 4, 0, 0, TAU); ctx.stroke();
}

function drawMotes(ctx) {
  ctx.fillStyle = 'rgba(255,214,150,.55)';
  for (const m of MOTES) {
    const x = m.x + Math.sin(t * .5 + m.p) * 18, y = m.y + Math.sin(t * .8 + m.p) * 12;
    ctx.globalAlpha = .12 + .3 * Math.abs(Math.sin(t * .9 + m.p));
    ctx.beginPath(); ctx.arc(x, y, m.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFoes(ctx) {
  for (const f of foes) {
    if (f.hp <= 0) continue;
    const bob = Math.sin(f.ph * 2) * 3;
    // shadow
    ctx.globalAlpha = .3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 20, 7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // hp pips
    for (let i = 0; i < f.hp; i++) {
      ctx.fillStyle = '#ff6b81';
      rr(ctx, f.x - 10 + i * 12, f.y - 78, 9, 6, 3); ctx.fill();
    }
    ctx.save();
    if (f.fl > 0) { ctx.globalAlpha = .85; }
    drawChar('zombie', ctx, f.x, f.y + bob, 62, { dir: f.dir || 1, t, anim: 'walk', color: f.fl > 0 ? '#ffffff' : undefined });
    ctx.restore();
    if (f.fl > 0) {
      ctx.globalAlpha = .55; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(f.x, f.y - 28, 22, 28, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // drool / stink wisp
    if (R() < .06) g.fx.emit('smoke', f.x + rnd(-10, 10), f.y - 46, { vx: rnd(-14, 14), vy: -28, life: .8, size: 9, color: 'rgba(140,220,120,.35)' });
  }
}

function drawHero(ctx) {
  if (p.hp <= 0) return;
  const bob = p.anim === 'walk' ? Math.abs(Math.sin(p.walk)) * -3 : Math.sin(t * 2.4) * 1.6;
  ctx.globalAlpha = .32; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 21, 7, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // swing arc (drawn behind the cat's blade)
  if (p.swing > 0) {
    const u = 1 - p.swing / SLASH_T;
    const base = Math.atan2(p.fy, p.fx) || 0;
    const a0 = base - .95 + u * 1.2;
    ctx.save(); ctx.translate(p.x, p.y - 30);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA('#ffffff', .55 * (1 - u));
    ctx.lineWidth = 16 * (1 - u * .55);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, REACH * .72, a0 - .55, a0 + .35); ctx.stroke();
    ctx.strokeStyle = hexA('#bfe9ff', .5 * (1 - u));
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, REACH * .95, a0 - .5, a0 + .3); ctx.stroke();
    ctx.restore();
    // blade
    ctx.save();
    ctx.translate(p.x + p.fx * 14, p.y - 30 + p.fy * 14);
    ctx.rotate(Math.atan2(p.fy, p.fx) + (u - .4) * 1.6);
    ctx.fillStyle = '#dfe9f5';
    rr(ctx, 6, -5, 42, 10, 4); ctx.fill();
    ctx.fillStyle = '#8fa4bd'; ctx.fillRect(44, -4, 7, 8);
    ctx.fillStyle = '#7a4a00'; ctx.fillRect(0, -6, 10, 12);
    ctx.restore();
  }

  squish(ctx, p.x, p.y, 1 / p.sq, p.sq, 0, () => {
    drawChar('cat', ctx, 0, bob, 62, { dir: p.dir, t, anim: p.anim, color: p.inv > 0 && Math.floor(t * 22) % 2 ? '#ffffff' : '#ff9a3c' });
  });
  if (p.inv > 0) {
    ctx.strokeStyle = hexA('#fff', .35 + .3 * Math.sin(t * 30)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y - 30, 34, 0, TAU); ctx.stroke();
  }
}

function drawHud(ctx) {
  // hearts
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < p.hp ? 1 : .22;
    heart(ctx, 34 + i * 34, 58, 26);
    ctx.fillStyle = i < p.hp ? '#ff4d6d' : '#54455f'; ctx.fill();
    ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  g.text('CAT DUNGEON', W / 2, 50, { size: 26, align: 'center', color: '#ffd34d' });
  g.text(Math.round(score).toLocaleString(), W / 2, 92, { size: 44, align: 'center', color: '#fff' });

  // foes left pips
  const n = aliveFoes().length;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < n ? '#ff6b81' : 'rgba(255,255,255,.15)';
    rr(ctx, W - 34 - i * 26, 52, 18, 18, 5); ctx.fill();
    ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 2; ctx.stroke();
  }
  g.text('FOES', W - 26, 92, { size: 18, align: 'right', color: '#c9b6d8' });

  // raid clock
  const frac = clamp(raid / RAID, 0, 1), pw = W - 52;
  ctx.fillStyle = 'rgba(8,6,18,.62)'; rr(ctx, 26, 112, pw, 15, 8); ctx.fill();
  ctx.fillStyle = frac > .4 ? '#9be07a' : frac > .2 ? '#ffb300' : '#ff3b5c';
  rr(ctx, 26, 112, Math.max(5, pw * frac), 15, 8); ctx.fill();
  g.text('DUNGEON SEALS', 26, 108, { size: 17, color: '#c9b6d8' });
  g.text(raid.toFixed(1), 26 + pw, 108, { size: 17, align: 'right', color: frac < .2 ? '#ff3b5c' : '#e6dcf0' });

  // quest rail
  const py = 142, steps = [n > 0 ? 'CLEAR' : 'DONE', key ? 'KEY' : (aliveFoes().length ? '—' : 'GRAB'), doorOpen ? 'STAYS' : 'OPEN', 'EXIT'];
  const done = [aliveFoes().length === 0, !!doorOpen, false, false, false];
  for (let i = 0; i < 5; i++) {
    const x = 26 + i * ((pw - 30) / 4);
    const on = i === 0 ? aliveFoes().length === 0 : i === 1 ? !!doorOpen : i === 2 ? doorOpen === 1 : i === 3 ? doorOpen === 1 : false;
    ctx.fillStyle = i === 0 ? (aliveFoes().length === 0 ? '#9be07a' : '#ff6b81') : i === 1 ? (doorOpen ? '#ffd34d' : 'rgba(255,255,255,.18)') : 'rgba(255,255,255,.14)';
    rr(ctx, x - 6, py, 12, 12, 4); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 20, py + 3, pw, 6, 3); ctx.fill();
  ctx.fillStyle = '#ff9a3c'; rr(ctx, 20 + pw * prog(), py, 10, 14, 4); ctx.fill();
  ctx.strokeStyle = '#0b0714'; ctx.lineWidth = 2; ctx.stroke();

  const objective = aliveFoes().length ? `CLEAR THE ROOM — ${aliveFoes().length} LEFT` : key ? 'GRAB THE KEY' : 'CLIMB THE STAIRS ↑';
  ctx.fillStyle = aliveFoes().length ? 'rgba(255,107,129,.16)' : 'rgba(255,211,77,.16)';
  rr(ctx, W / 2 - 148, 162, 296, 30, 15); ctx.fill();
  g.text(objective, W / 2, 184, { size: 20, align: 'center', color: aliveFoes().length ? '#ffb3c0' : '#ffd34d' });

  // urgency vignette
  if (frac < .35) {
    const a = (1 - frac / .35) * .34;
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, `rgba(255,40,70,${a})`); vg.addColorStop(.4, 'rgba(255,40,70,0)'); vg.addColorStop(1, `rgba(255,40,70,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (banner > 0) {
    ctx.globalAlpha = Math.min(1, banner);
    g.text('SLASH · LOOT · ESCAPE', W / 2, 322, { size: 26, align: 'center', color: '#ffd34d' });
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ boot */
resetWorld();
g.onReset = () => resetWorld();
g.onStart = () => { music('epic'); };
music('epic');

g.run(dt => { update(dt); }, draw);
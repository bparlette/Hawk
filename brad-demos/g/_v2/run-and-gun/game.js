// COMMANDO CAT — run-and-gun (Cat Arcade v2)
// A horizontal side-scroller: sprint right, gun down the horde, and kill the mech at the gate before
// the sludge wall catches you. Everything is built around the shooting: muzzle flash, shell casings,
// recoil pushback, hitstop per bullet, a white-out frame on every kill, shake scaled by damage, popups.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, chance, R, TAU,
  rr, circle, hexA, shadow, starPath, heartPath, damp, fmt,
} from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960, GY = 712;
const g = makeGame({
  id: 'run-and-gun', title: 'COMMANDO CAT', sub: 'HOLD ▶ TO RUN · FIRE TO SHOOT',
  hook: 'the sludge wall never stops', w: W, h: H, bg: '#0a0518', style: 'toon',
  bloom: .92, ca: .42, vig: 1, scan: .16,
});
const isAuto = new URLSearchParams(location.search).has('auto');

const CFG = {
  arena: 2450,          // world x where the gate + boss fight begins
  run: 305,             // player run speed (px/s)
  scroll: 212,          // camera auto-scroll (the sludge wall's speed)
  grav: 2750, jump: -1045,
  fireCd: .11, bspd: 1350,
  bossHp: 36,
};

/* ================================================================ scenery buffers */
const strip = (n, o) => {
  const out = []; let x = 0;
  for (let i = 0; i < n; i++) {
    const w = ri(o.wMin, o.wMax), h = ri(o.hMin, o.hMax), wins = [];
    for (let wy = 16; wy < h - 12; wy += o.row) for (let wx = 9; wx < w - 10; wx += o.col)
      if (chance(o.p)) wins.push({ x: wx, y: wy, on: chance(.55), ph: R() * 6, w: ri(4, 7), h: ri(6, 10) });
    out.push({ x, w, h, wins, ant: chance(.4) ? ri(20, 54) : 0 });
    x += w + ri(6, 26);
  }
  return { b: out, w: x };
};
const MID = strip(16, { wMin: 62, wMax: 116, hMin: 200, hMax: 430, row: 30, col: 18, p: .34 });
const NEAR = strip(14, { wMin: 40, wMax: 74, hMin: 90, hMax: 190, row: 26, col: 16, p: .3 });
const motes = Array.from({ length: 30 }, () => ({ x: R() * W, y: 120 + R() * (GY - 140), r: rnd(.8, 2.4), ph: R() * 6, sp: rnd(14, 52), par: rnd(.4, 1.3) }));

/* ================================================================ state */
let P, bl, foes, ebul, killFx, boss, cam, t, kills, autoT, phase, muzzleT, mzX, mzY, winT, nextSpawn, dangerT, potT, lvl;

function resetWorld() {
  P = { x: 330, y: GY, vy: 0, dir: 1, hp: 3, inv: 1.4, sq: 1, cd: .3, recoil: 0, grounded: true, stepT: 0 };
  bl = []; foes = []; ebul = []; killFx = []; boss = null;
  cam = 0; t = 0; kills = 0; autoT = 0; phase = 'run';
  muzzleT = 0; mzX = 0; mzY = 0; winT = 0; nextSpawn = 720; dangerT = 0; potT = 0; lvl = 0;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, hp: 3, kills: 0, zone: 'run', prog: 0 };
}
g.onReset = resetWorld;
g.onStart = () => music('chase');
resetWorld();

/* ================================================================ input */
const inBtn = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
function readInput() {
  let mv = 0, fire = false, jump = false;
  const L = g.btn('l', 12, 822, 100, 104, '◀', { key: 'ArrowLeft' });
  const Rr = g.btn('r', 120, 822, 100, 104, '▶', { key: 'ArrowRight' });
  const J = g.btn('j', 306, 812, 108, 118, 'JUMP', { key: 'Space' });
  const F = g.btn('f', 424, 812, 108, 118, 'FIRE', { key: 'KeyX' });
  if (L.held) mv = -1; if (Rr.held) mv = 1;
  if (J.pressed) jump = true; if (F.held) fire = true;
  if (g.keys.KeyA) mv = -1; if (g.keys.KeyD) mv = 1;
  if (g.pressed.KeyW || g.pressed.ArrowUp || g.pressed.Space || g.pressed.KeyZ) jump = true;
  if (g.keys.KeyJ || g.keys.KeyX || g.keys.ShiftLeft || g.keys.KeyK) fire = true;
  for (const tp of g.taps) if (tp.y < 800) jump = true;          // tap the field = jump
  return { mv, fire, jump };
}

/* ================================================================ effects */
function shoot() {
  P.cd = CFG.fireCd;
  P.recoil = 1;
  P.x -= P.dir * 2.6;                                            // recoil pushback on the cat
  const bx = P.x + P.dir * 58, by = P.y - 56;
  mzX = bx; mzY = by; muzzleT = .055;
  bl.push({ x: bx, y: by, vx: P.dir * CFG.bspd, life: .95 });
  g.punch(.014);
  sfx('shoot', { pitch: .94 + R() * .14, vol: .5 });
  /* muzzle sparks blown forward */
  g.fx.burst(bx, by, 3, { kind: 'spark', color: ['#fffbe0', '#ffd34d', '#ff8a1f'], speed: 420, life: .18, size: 5, ang: P.dir > 0 ? 0 : Math.PI, spread: 1.0, g: 60 });
  g.fx.emit('glow', bx, by, { life: .1, size: 26, color: '#fff3b0', add: true });
  /* brass casing kicked out of the receiver */
  g.fx.emit('debris', P.x + P.dir * 16, P.y - 62, {
    vx: -P.dir * ri(70, 165), vy: -ri(150, 280), g: 1500, life: .7,
    size: ri(4, 6), color: chance(.5) ? '#ffd34d' : '#ffc46b', rot: R() * 6, vr: -P.dir * ri(8, 18),
  });
}
function hurt(sx) {
  if (P.inv > 0 || phase === 'win') return;
  P.hp--; P.inv = 1.35;
  g.impact(P.x - cam, P.y - 52, { punch: .2, shake: 22, stop: .08, flash: '#ff2b4d', flashA: .34, rip: 1.3, sfx: 'hit', pitch: .9 });
  g.fx.burst(P.x - cam, P.y - 52, 20, { kind: 'spark', color: ['#ff2b4d', '#fff', '#ffd34d'], speed: 420, life: .5, size: 7 });
  g.combo.miss();
  if (P.hp <= 0) lose();
}
function lose() {
  const sx = P.x - cam;
  g.fx.blast(sx, P.y - 50, { r: 96, color: '#ff2b4d', colors: ['#ff2b4d', '#fff', '#ff8a1f'], n: 34, speed: 420, punch: .18, shake: 26, flashA: .5 });
  g.fx.burst(sx, P.y - 50, 14, { kind: 'debris', color: ['#ffb347', '#fff', '#2a2f3a'], speed: 300, life: .9 });
  g.hitstop(.12);
  sfx('explode', { pitch: .85 });
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE' });
}
function killFoe(f) {
  const sx = f.x - cam, sy = f.y - (f.h || 96) * .55;
  kills++;
  const pts = Math.round(f.pts * g.combo.mult);
  g.score += pts;
  g.flash('#fff', .3);                       // white flash frame
  g.hitstop(.05);
  g.shake(6 + f.pts * .04);
  g.fx.blast(sx, sy, { r: f.kind === 'turret' ? 60 : 54, color: f.kind === 'turret' ? '#ff9f43' : '#8fcf7a', colors: [f.kind === 'turret' ? '#ff9f43' : '#8fcf7a', '#fff', '#ffd34d'], n: 20, speed: 340, punch: .06, shake: 7, flashA: 0 });
  g.fx.burst(sx, sy, 10, { kind: 'debris', color: ['#8fcf7a', '#3d3d52', '#fff'], speed: 300, life: .8, size: 7 });
  killFx.push({ x: f.x, y: f.y, h: f.h, kind: f.kind, dir: f.dir, t: 0 });
  g.combo.hit(sx, sy, '+' + pts);
  sfx('boom', { pitch: comboPitch(Math.min(11, g.combo.n)), vol: .45 });
}

/* ================================================================ spawns */
function spawnFoe() {
  const k = clamp(cam / CFG.arena, 0, 1);       // difficulty ramp 0 → 1
  const r = R();
  const x = cam + W + ri(40, 110);
  if (r < .16 + .1 * (1 - k) && k < .78) {
    foes.push({ kind: 'turret', x, y: GY, h: 76, hw: 30, hp: 3, pts: 90, dir: -1, cd: 1.1 + R() * .7, fl: 0, kx: 0, wy: 0 });
  } else if (r < .42) {
    foes.push({ kind: 'dino', x, y: GY, h: 82, hw: 26, hp: 1, pts: 80, dir: -1, spd: 190 + 70 * k, fl: 0, kx: 0, awake: false });
  } else {
    foes.push({ kind: 'zombie', x, y: GY, h: 98, hw: 26, hp: 2, pts: 60, dir: -1, spd: 74 + 46 * k, fl: 0, kx: 0, awake: false });
    if (chance(.35)) foes.push({ kind: 'zombie', x: x + ri(50, 90), y: GY, h: 98, hw: 26, hp: 2, pts: 60, dir: -1, spd: 74 + 46 * k, fl: 0, kx: 0, awake: false });
  }
}
function spawnBoss() {
  boss = { x: CFG.arena + 452, y: GY, h: 300, hw: 66, hp: CFG.bossHp, max: CFG.bossHp, fl: 0, t: 0, cd: 1.5, cnt: 0, sum: 3.4, die: 0 };
  g.showBanner('BOSS', 1.3);
  g.shake(12); g.flash('#ff2b4d', .3);
  sfx('explode', { pitch: .7 });
  music('boss');
}

/* ================================================================ update */
function update(dt) {
  if (dt <= 0) return;
  const inp = readInput();
  t += dt;
  if (g.mode === 'play') autoT += dt;

  /* --- bot ---------------------------------------------------------- */
  let mv = inp.mv, fire = inp.fire, jump = inp.jump;
  if (isAuto && g.mode === 'play') {
    if (g.dumb()) { mv = 0; fire = false; jump = false; }   // attempt 0: stands still, the wall eats it
    else {
      mv = 1; fire = true; jump = false;
      for (const f of foes) {
        const d = f.x - P.x;
        if (f.kind === 'turret') { if (d > 0 && d < 120 && P.grounded && chance(.06)) jump = true; }
        else if (d > -20 && d < 155 && P.grounded) jump = true;
      }
      for (const b of ebul) {
        const d = b.x - P.x;
        if (d > -30 && d < 130 && P.grounded && Math.abs(b.y - (P.y - 56)) < 60) jump = true;
      }
      if (P.x - cam > 280) mv = 0;
    }
  }
  if (g.mode !== 'play') { mv = 0; fire = false; jump = false; }

  /* --- player ------------------------------------------------------- */
  if (mv) { P.dir = mv > 0 ? 1 : -1; P.stepT += dt * (P.grounded ? 12 : 3); }
  P.x += mv * CFG.run * dt;
  if (jump && P.grounded) {
    P.vy = CFG.jump; P.grounded = false; P.sq = .78;
    sfx('jump', { pitch: 1.05, vol: .7 });
    g.fx.dust(P.x - cam, GY, 9, { color: 'rgba(255,180,220,.55)', speed: 130 });
  }
  if (!P.grounded) {
    P.vy += CFG.grav * dt; P.y += P.vy * dt;
    if (P.y >= GY) {
      P.y = GY; P.vy = 0; P.grounded = true; P.sq = 1.24;
      sfx('thud', { pitch: 1.15, vol: .4 });
      g.punch(.03); g.shake(3);
      g.fx.dust(P.x - cam, GY, 10, { color: 'rgba(255,180,220,.5)' });
    }
  }
  P.sq = damp(P.sq, 1, 13, dt);
  P.inv = Math.max(0, P.inv - dt);
  P.cd -= dt;
  P.recoil = damp(P.recoil, 0, 16, dt);
  muzzleT = Math.max(0, muzzleT - dt);
  if (fire && P.cd <= 0) shoot();
  /* running dust */
  if (mv && P.grounded) {
    potT -= dt;
    if (potT <= 0) { potT = .09; g.fx.dust(P.x - cam - P.dir * 16, GY, 1, { color: 'rgba(190,150,255,.4)', size: 10, speed: 40 }); }
  }

  /* --- camera / sludge wall ----------------------------------------- */
  if (phase === 'run') {
    if (t > .55) cam += CFG.scroll * dt;
    if (P.x - 300 > cam) cam = P.x - 300;
    if (cam >= CFG.arena) { cam = CFG.arena; phase = 'boss'; spawnBoss(); }
    P.x = clamp(P.x, cam + 62, cam + 300);
  } else {
    P.x = clamp(P.x, cam + 70, cam + 300);
  }
  /* the wall bites if you fall behind */
  if (phase === 'run' && P.x - cam <= 66) {
    dangerT += dt;
    if (dangerT > 1.35) { dangerT = 0; P.x += 34; hurt(); }
  } else dangerT = Math.max(0, dangerT - dt * .5);

  /* --- spawns ------------------------------------------------------- */
  if (phase === 'run') {
    const k = clamp(cam / CFG.arena, 0, 1);
    const gap = lerp(340, 168, k) * rnd(.85, 1.25);
    if (cam + W + 140 > nextSpawn) { spawnFoe(); nextSpawn += gap; }
  } else if (boss && boss.hp > 0) {
    boss.sum -= dt;
    if (boss.sum <= 0) {
      boss.sum = 3.2;
      foes.push({ kind: 'zombie', x: cam + W + 30, y: GY, h: 98, hw: 26, hp: 2, pts: 60, dir: -1, spd: 96, fl: 0, kx: 0, awake: false });
    }
  }

  /* --- foes --------------------------------------------------------- */
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.fl = Math.max(0, f.fl - dt);
    f.kx = damp(f.kx, 0, 9, dt);
    if (f.kind === 'turret') {
      f.cd -= dt;
      if (f.cd <= 0 && f.x - cam < W + 40 && f.x > cam) {
        f.cd = Math.max(.9, 1.7 - .5 * clamp(cam / CFG.arena, 0, 1));
        const ax = P.x, ay = P.y - 52, dx = ax - f.x, dy = ay - (f.y - 62);
        const d = Math.hypot(dx, dy) || 1, sp = 330;
        ebul.push({ x: f.x, y: f.y - 62, vx: dx / d * sp, vy: dy / d * sp, r: 10, big: false });
        sfx('laser', { pitch: 1.1, vol: .3 });
        g.fx.emit('glow', f.x - cam, f.y - 62, { life: .14, size: 26, color: '#ff9f43', add: true });
      }
    } else {
      if (!f.awake && f.x - cam < W + 60) f.awake = true;
      if (f.awake) {
        const spd = f.kind === 'dino' ? f.spd : f.spd;
        f.x -= (spd + f.kx * 22) * dt;
        if (f.kind === 'dino' && f.x - cam < W - 30) f.x -= 60 * dt;
      }
      /* contact */
      if (P.y > GY - 58 && Math.abs(f.x - P.x) < f.hw + 22 && P.inv <= 0) {
        f.x += 26; hurt();
      }
      if (!P.grounded && P.y < GY - 66 && Math.abs(f.x - P.x) < f.hw + 16) {
        g.combo.hit(P.x - cam, P.y - 40, 'HOP!');
      }
    }
    if (f.x - cam < -140) foes.splice(i, 1);
  }

  /* --- boss --------------------------------------------------------- */
  if (boss) {
    boss.t += dt;
    boss.fl = Math.max(0, boss.fl - dt);
    if (boss.hp > 0 && phase === 'boss') {
      const rage = boss.hp / boss.max < .45;
      boss.cd -= dt;
      if (boss.cd <= 0) {
        boss.cd = rage ? 1.05 : 1.45;
        boss.cnt++;
        const by = boss.y - 190 + Math.sin(boss.t * 2.2) * 14;
        const cxp = boss.x - 34;
        if (boss.cnt % 3 === 0) {
          for (let a = -2; a <= 2; a++) {
            const dy = (P.y - 52) - by, dx = P.x - cxp;
            const base = Math.atan2(dy, dx) + a * .13;
            ebul.push({ x: cxp, y: by, vx: Math.cos(base) * 330, vy: Math.sin(base) * 330, r: 9, big: false });
          }
          sfx('laser', { pitch: .9 });
        } else {
          for (let a = -1; a <= 1; a++) {
            const base = Math.atan2((P.y - 52) - by, P.x - cxp) + a * .1;
            ebul.push({ x: cxp, y: by, vx: Math.cos(base) * 300, vy: Math.sin(base) * 300, r: 11, big: true });
          }
          sfx('laser', { pitch: 1.2, vol: .5 });
        }
        g.fx.burst(cxp - cam, by, 8, { kind: 'spark', color: ['#ff2b4d', '#ffd34d'], speed: 260, life: .3, size: 6, ang: Math.PI, spread: 1.2 });
        g.shake(4);
      }
    }
    if (phase === 'win') {
      boss.die += dt;
      if (boss.die > winT * .18) {
        boss.die = 0;
        const sx = boss.x - cam + ri(-60, 60), sy = boss.y - ri(40, 250);
        g.fx.blast(sx, sy, { r: ri(50, 90), color: '#ffd34d', colors: ['#ffd34d', '#ff2b4d', '#fff'], n: 16, speed: 340, shake: 8, punch: .04, flashA: .16 });
        sfx('boom', { pitch: .8 + R() * .4 });
      }
      winT -= dt;
      if (winT <= 0) {
        g.score += 2500;
        g.end({ win: true, score: Math.round(g.score), label: 'SCORE' });
      }
    }
  }

  /* --- player bullets ----------------------------------------------- */
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i];
    b.x += b.vx * dt; b.life -= dt;
    let dead = b.life <= 0 || b.x - cam > W + 80 || b.x - cam < -80;
    if (!dead) {
      /* destructible enemy fire */
      for (let j = ebul.length - 1; j >= 0; j--) {
        const e = ebul[j];
        if (Math.abs(b.x - e.x) < 20 + e.r && Math.abs(b.y - e.y) < 18 + e.r) {
          ebul.splice(j, 1); dead = true;
          g.score += 15;
          g.fx.burst(e.x - cam, e.y, 10, { kind: 'spark', color: ['#fff', '#ffd34d', '#ff8a1f'], speed: 260, life: .3, size: 6 });
          g.hitstop(.016); g.shake(2.5);
          sfx('snap', { pitch: 1.2 + R() * .3, vol: .35 });
          g.popup('15', e.x - cam, e.y - 16, '#9be8ff', 26);
          break;
        }
      }
    }
    if (!dead) {
      for (let j = foes.length - 1; j >= 0; j--) {
        const f = foes[j];
        const top = f.y - f.h, bot = f.y;
        if (b.x > f.x - f.hw - 6 && b.x < f.x + f.hw + 6 && b.y > top && b.y < bot) {
          dead = true;
          f.hp -= 1; f.fl = .1; f.kx -= 1.6;
          const sx = b.x - cam;
          g.fx.burst(sx, b.y, 7, { kind: 'spark', color: ['#fffbe0', '#ffd34d', '#ff7a3c'], speed: 300, life: .26, size: 5, ang: P.dir > 0 ? 0 : Math.PI, spread: 1.5 });
          g.fx.emit('glow', sx, b.y, { life: .12, size: 22, color: '#fff', add: true });
          g.hitstop(.014);                          // per-bullet hitstop
          g.shake(2 + 2 * 1);                       // shake scaled by damage
          sfx('hit', { pitch: .92 + R() * .18, vol: .32 });
          if (f.hp <= 0) { killFoe(f); foes.splice(j, 1); }
          break;
        }
      }
    }
    if (!dead && boss && boss.hp > 0) {
      if (Math.abs(b.x - boss.x + 10) < boss.hw && b.y > boss.y - boss.h && b.y < boss.y - 20) {
        dead = true;
        boss.hp -= 1; boss.fl = .09;
        const sx = b.x - cam;
        g.fx.burst(sx, b.y, 8, { kind: 'spark', color: ['#fffbe0', '#ffd34d', '#ff2b4d'], speed: 320, life: .28, size: 6, ang: P.dir > 0 ? 0 : Math.PI, spread: 1.6 });
        g.fx.emit('glow', sx, b.y, { life: .14, size: 26, color: '#fff3b0', add: true });
        g.hitstop(.014); g.shake(3);
        g.score += 10;
        sfx('hit', { pitch: .85 + R() * .12, vol: .3 });
        if (boss.hp <= 0) {
          boss.hp = 0;
          phase = 'win'; winT = 1.05;
          g.score += 1200;
          g.flash('#fff', .5); g.shake(24); g.hitstop(.16); g.slowmo(.4, .9);
          g.fx.blast(boss.x - cam, boss.y - 150, { r: 150, color: '#ffd34d', colors: ['#ffd34d', '#ff2b4d', '#fff'], n: 44, speed: 520, punch: .2, shake: 22, flashA: .5 });
          sfx('explode', { pitch: .75 });
          g.combo.hit(boss.x - cam, boss.y - 200, '+' + 1200);
        }
      }
    }
    if (dead) bl.splice(i, 1);
  }

  /* --- enemy bullets ------------------------------------------------ */
  for (let i = ebul.length - 1; i >= 0; i--) {
    const e = ebul[i];
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x - cam < -60 || e.x - cam > W + 80 || e.y > GY + 40 || e.y < -60) { ebul.splice(i, 1); continue; }
    if (Math.hypot(e.x - P.x, e.y - (P.y - 50)) < 26 + e.r && P.inv <= 0) {
      ebul.splice(i, 1); hurt(); continue;
    }
    if (chance(dt * 14)) g.fx.emit('glow', e.x - cam, e.y, { life: .18, size: 14, color: '#ff6b8a', add: true });
  }

  /* --- kill ghosts (white flash frame) ------------------------------ */
  for (let i = killFx.length - 1; i >= 0; i--) {
    killFx[i].t += dt;
    if (killFx[i].t > .09) killFx.splice(i, 1);
  }

  /* --- state -------------------------------------------------------- */
  const prog = phase === 'run' ? clamp(cam / CFG.arena, 0, 1) : 1;
  g.state = {
    score: Math.round(g.score), hp: P.hp, kills, zone: phase, prog: Math.round(prog * 100),
    boss: boss ? Math.max(0, boss.hp) : -1,
  };
  if (isAuto && !g.dumb() && autoT > 60 && phase !== 'win') {
    g.end({ win: true, score: Math.round(g.score), label: 'SCORE' });   // anti-stuck safety
  }
}

/* ================================================================ draw */
function skyline(L, baseY, fill, winCol, par) {
  const c = g.ctx;
  const off = (cam * par) % L.w;
  for (let k = -1; k <= 1; k++) {
    const ox = k * L.w - off;
    for (const b of L.b) {
      const x = ox + b.x;
      if (x > W + 60 || x + b.w < -60) continue;
      c.fillStyle = fill;
      c.fillRect(x, baseY - b.h, b.w, b.h + 30);
      c.fillStyle = winCol;
      for (const w of b.wins) {
        c.globalAlpha = w.on ? .45 + .45 * Math.abs(Math.sin(g.t * 1.3 + w.ph)) : .12;
        c.fillRect(x + w.x, baseY - b.h + w.y, w.w, w.h);
      }
      c.globalAlpha = 1;
      if (b.ant) { c.fillStyle = fill; c.fillRect(x + b.w * .5, baseY - b.h - b.ant, 4, b.ant); }
    }
  }
}

let skyG = null;
function drawSky(c) {
  if (!skyG) {
    skyG = c.createLinearGradient(0, 0, 0, GY + 40);
    skyG.addColorStop(0, '#0a0518'); skyG.addColorStop(.34, '#2a0d3f');
    skyG.addColorStop(.63, '#6a1c4e'); skyG.addColorStop(.83, '#c9394a'); skyG.addColorStop(1, '#ff9a4d');
  }
  c.fillStyle = skyG; c.fillRect(0, 0, W, GY + 40);
  /* sun */
  const sy = GY - 54;
  const sg = c.createRadialGradient(W * .68, sy, 6, W * .68, sy, 210);
  sg.addColorStop(0, 'rgba(255,246,190,1)'); sg.addColorStop(.3, 'rgba(255,186,90,.9)'); sg.addColorStop(1, 'rgba(255,90,140,0)');
  c.save(); c.beginPath(); c.rect(0, 0, W, sy + 4); c.clip();
  c.fillStyle = sg; c.beginPath(); c.arc(W * .68, sy, 160, 0, TAU); c.fill();
  c.fillStyle = 'rgba(120,20,70,.42)';
  for (let i = 0; i < 8; i++) c.fillRect(W * .68 - 180, sy - 8 - i * 15, 360, 6);
  c.restore();
  /* stars */
  for (let i = 0; i < 34; i++) {
    const x = (i * 137.5) % W, y = (i * 71.3) % (GY * .45);
    c.globalAlpha = .2 + .6 * Math.abs(Math.sin(g.t * .9 + i));
    c.fillStyle = '#dff3ff'; c.fillRect(x, y, 2, 2);
  }
  c.globalAlpha = 1;
}

function drawRidge(par, amp, base, col, ph) {
  const c = g.ctx;
  c.beginPath(); c.moveTo(-12, GY + 20);
  for (let x = -12; x <= W + 12; x += 24) {
    const wx = cam * par + x;
    const y = base - Math.abs(Math.sin(wx * .0026 + ph)) * amp - Math.sin(wx * .0091 + ph * 2) * amp * .22;
    c.lineTo(x, y);
  }
  c.lineTo(W + 12, GY + 20); c.closePath(); c.fillStyle = col; c.fill();
}

function drawGround(c) {
  c.fillStyle = '#0d0716'; c.fillRect(0, GY, W, H - GY);
  const gd = c.createLinearGradient(0, GY - 4, 0, GY + 34);
  gd.addColorStop(0, 'rgba(255,96,160,.9)'); gd.addColorStop(1, 'rgba(255,96,160,0)');
  c.fillStyle = gd; c.fillRect(0, GY - 4, W, 38);
  c.fillStyle = '#ffd7ec'; c.fillRect(0, GY - 3, W, 3);
  const off = cam % 108;
  c.fillStyle = '#1b1030';
  for (let x = -off; x < W; x += 108) { c.fillRect(x, GY + 40, 66, 4); c.fillRect(x + 74, GY + 92, 30, 3); }
  c.fillStyle = 'rgba(120,60,200,.35)';
  for (let x = -off; x < W; x += 108) { c.fillRect(x + 4, GY + 4, 2, 30); c.fillRect(x + 66, GY + 4, 2, 30); }
  /* world markers: distance chevrons + the gate */
  const gateSX = CFG.arena - cam + 150;
  for (let wx = 0; wx < CFG.arena; wx += 620) {
    const sx = wx - cam;
    if (sx < -60 || sx > W + 60) continue;
    c.globalAlpha = .5; c.fillStyle = '#ffd34d';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(sx + i * 16, GY - 6); c.lineTo(sx + i * 16 + 11, GY - 18); c.lineTo(sx + i * 16 + 22, GY - 6); c.closePath(); c.fill(); }
    c.globalAlpha = 1;
  }
  if (gateSX > -120 && gateSX < W + 200) {
    c.fillStyle = '#160a24'; c.fillRect(gateSX, GY - 300, 26, 300);
    c.fillStyle = '#ff2b4d'; c.fillRect(gateSX + 8, GY - 300, 6, 300);
    c.fillStyle = 'rgba(255,43,77,.16)'; c.fillRect(gateSX - 40, GY - 300, 110, 300);
  }
}

function drawFoe(c, f) {
  const sx = f.x - cam;
  if (sx < -120 || sx > W + 140) return;
  shadow(c, sx, GY + 2, 26, 7, .35);
  if (f.kind === 'turret') {
    const s = 1;
    c.save(); c.translate(sx, f.y);
    c.fillStyle = '#241a33'; c.beginPath(); c.ellipse(0, -6, 38, 20, 0, 0, TAU); c.fill();
    rr(c, -22, -64, 44, 44, 8); c.fillStyle = '#3a2b4e'; c.fill();
    c.strokeStyle = '#0b0410'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#57406f'; rr(c, -30, -46, 18, 12, 4); c.fill();
    /* barrel */
    c.save(); c.translate(-6, -50);
    const aim = Math.atan2((P.y - 62) - (f.y - 62), P.x - f.x);
    c.rotate(clamp(aim, -1.1, .5) + Math.PI);
    c.fillStyle = '#5b4675'; c.fillRect(0, -6, 40, 12);
    c.fillStyle = '#8a6bb0'; c.fillRect(30, -4, 10, 8);
    c.restore();
    const puls = .5 + .5 * Math.sin(g.t * 6 + f.x);
    c.fillStyle = f.fl > 0 ? '#fff' : `rgba(255,${60 + 100 * puls},80,1)`;
    circle(c, 0, -42, 7); c.fill();
    c.restore();
  } else if (f.kind === 'dino') {
    drawChar('dino', c, sx, f.y, f.h, { dir: -1, color: '#4cc36b', anim: 'walk', t: g.t + f.x, hurt: f.fl > 0 });
  } else {
    drawChar('zombie', c, sx, f.y, f.h, { dir: -1, color: '#8fcf7a', anim: 'walk', t: g.t * 1.1 + f.x * .1, hurt: f.fl > 0 });
  }
}

function drawBoss(c) {
  if (!boss) return;
  const sx = boss.x - cam, dip = Math.sin(boss.t * 2.2) * 12;
  const y = boss.y + dip;
  /* legs */
  c.fillStyle = '#1d1428';
  c.fillRect(sx - 46, y - 96, 28, 96);
  c.fillRect(sx + 16, y - 96, 28, 96);
  c.fillStyle = '#2c1f3d';
  c.fillRect(sx - 56, y - 12, 44, 12);
  c.fillRect(sx + 10, y - 12, 44, 12);
  /* hull */
  const hull = c.createLinearGradient(sx - 70, y - 260, sx + 70, y - 60);
  hull.addColorStop(0, '#3d2b52'); hull.addColorStop(.5, '#523a6d'); hull.addColorStop(1, '#241735');
  rr(c, sx - 62, y - 268, 124, 190, 18); c.fillStyle = hull; c.fill();
  c.strokeStyle = '#0a0512'; c.lineWidth = 4; c.stroke();
  /* shoulder cannon */
  c.fillStyle = '#2c1f3d'; rr(c, sx - 108, y - 232, 56, 40, 10); c.fill();
  c.strokeStyle = '#0a0512'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#6b5285'; c.fillRect(sx - 126, y - 220, 26, 16);
  c.fillStyle = boss.fl > 0 ? '#fff' : '#ff2b4d';
  circle(c, sx - 118, y - 212, 7); c.fill();
  /* visor */
  const vg = c.createLinearGradient(sx - 44, y - 250, sx + 44, y - 216);
  vg.addColorStop(0, '#ff9a3c'); vg.addColorStop(1, '#ff2b4d');
  rr(c, sx - 44, y - 252, 88, 34, 12); c.fillStyle = boss.hp > 0 ? vg : '#555'; c.fill();
  c.strokeStyle = '#0a0512'; c.lineWidth = 3; c.stroke();
  /* eye */
  const blink = Math.abs(Math.sin(boss.t * 3));
  c.fillStyle = '#fff6c2'; c.fillRect(sx - 26, y - 244, 22 * blink + 4, 12);
  c.fillRect(sx + 10, y - 244, 22 * blink + 4, 12);
  /* core */
  const cp = .5 + .5 * Math.sin(boss.t * 5);
  const cg = c.createRadialGradient(sx, y - 160, 4, sx, y - 160, 44);
  cg.addColorStop(0, '#fff'); cg.addColorStop(.35, boss.hp > 0 ? '#ffd34d' : '#666'); cg.addColorStop(1, 'rgba(255,43,77,0)');
  c.fillStyle = cg; circle(c, sx, y - 160, 30 + cp * 10); c.fill();
  c.fillStyle = boss.fl > 0 ? '#fff' : '#ffd34d';
  circle(c, sx, y - 160, 15); c.fill();
  c.strokeStyle = '#ff2b4d'; c.lineWidth = 3; circle(c, sx, y - 160, 22); c.stroke();
  /* rivets */
  c.fillStyle = '#8a6bb0';
  for (let i = 0; i < 5; i++) { circle(c, sx - 54, y - 240 + i * 34, 3.5); c.fill(); circle(c, sx + 54, y - 240 + i * 34, 3.5); c.fill(); }
  if (boss.fl > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.fillStyle = '#fff'; rr(c, sx - 64, y - 270, 128, 192, 18); c.fill(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
}

function drawHero(c) {
  const sx = P.x - cam;
  const sq = P.sq;
  const air = !P.grounded;
  const sy = air ? clamp(1 + P.vy / 5200, .88, 1.12) : sq;
  shadow(c, sx, GY + 2, 38 * clamp(1 - (GY - P.y) / 400, .4, 1), 8, .32);
  /* recoil lean: the whole cat shifts back a hair */
  c.save();
  c.translate(sx - P.dir * P.recoil * 4, P.y);
  c.scale(2 - sy, sy);
  drawChar('cat', c, 0, 0, 96, {
    dir: P.dir, color: '#ffb347', t: g.t,
    anim: air ? 'idle' : 'walk', hurt: P.inv > 0 && Math.sin(g.t * 40) > 0,
  });
  c.restore();
  /* gun */
  const kick = P.recoil * 9;
  c.save();
  c.translate(sx + P.dir * (10 - kick), P.y - 56);
  c.scale(P.dir, 1);
  c.fillStyle = '#2b2f3a'; rr(c, 6, -9, 34, 17, 6); c.fill();
  c.strokeStyle = '#0a0512'; c.lineWidth = 2.5; c.stroke();
  c.fillStyle = '#4b5263'; c.fillRect(34, -5, 26, 8);
  c.fillStyle = '#8a94a8'; c.fillRect(34, -5, 26, 3);
  c.fillStyle = '#1d2029'; rr(c, 14, 6, 12, 16, 3); c.fill();
  c.fillStyle = '#ffd34d'; c.fillRect(8, -3, 5, 5);
  c.restore();
  /* muzzle flash */
  if (muzzleT > 0) {
    const k = muzzleT / .055;
    const mx = mzX - cam, my = mzY;
    c.save(); c.globalCompositeOperation = 'lighter';
    const fg = c.createRadialGradient(mx, my, 0, mx, my, 46 * k);
    fg.addColorStop(0, 'rgba(255,255,235,.95)'); fg.addColorStop(.4, 'rgba(255,214,90,.7)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = fg; circle(c, mx, my, 46 * k); c.fill();
    starPath(c, mx + P.dir * 10 * k, my, 26 * k, g.t * 4);
    c.fillStyle = 'rgba(255,246,200,.95)'; c.fill();
    c.fillStyle = '#fff'; circle(c, mx + P.dir * 6, my, 7 * k); c.fill();
    c.restore();
  }
}

function drawBullets(c) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const b of bl) {
    const sx = b.x - cam;
    if (sx < -60 || sx > W + 60) continue;
    const len = 40, x1 = sx - Math.sign(b.vx) * len;
    c.strokeStyle = 'rgba(255,170,60,.28)'; c.lineWidth = 11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, b.y); c.lineTo(sx, b.y); c.stroke();
    c.strokeStyle = 'rgba(255,240,150,.85)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(x1, b.y); c.lineTo(sx, b.y); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x1 + len * .45, b.y); c.lineTo(sx, b.y); c.stroke();
    c.fillStyle = '#fff6c2'; circle(c, sx, b.y, 3.4); c.fill();
  }
  for (const e of ebul) {
    const sx = e.x - cam;
    if (sx < -40 || sx > W + 40) continue;
    const eg = c.createRadialGradient(sx, e.y, 0, sx, e.y, e.r * 3);
    eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(.35, 'rgba(255,80,120,.9)'); eg.addColorStop(1, 'rgba(255,20,90,0)');
    c.fillStyle = eg; circle(c, sx, e.y, e.r * 3); c.fill();
  }
  c.restore();
  /* dark cores so enemy shots read as solid */
  for (const e of ebul) {
    const sx = e.x - cam;
    if (sx < -40 || sx > W + 40) continue;
    c.fillStyle = '#3d0018'; circle(c, sx, e.y, e.r * .82); c.fill();
    c.fillStyle = '#ffd9e4'; circle(c, sx - 2, e.y - 2, e.r * .3); c.fill();
  }
}

function drawWall(c) {
  const edge = 56 + Math.sin(g.t * 2.6) * 6;
  const retreat = phase === 'boss' ? clamp((boss ? 1 : 0) * 0, 0, 1) : 0;
  const base = phase === 'boss' ? -40 : 0;
  const x0 = base - 150;
  c.save();
  const wg = c.createLinearGradient(x0, 0, edge, 0);
  wg.addColorStop(0, 'rgba(4,24,12,.98)'); wg.addColorStop(.55, 'rgba(22,92,44,.96)'); wg.addColorStop(1, 'rgba(122,255,150,.9)');
  c.fillStyle = wg;
  c.beginPath(); c.moveTo(x0, -20);
  for (let y = -20; y <= H + 20; y += 22) c.lineTo(edge + Math.sin(y * .021 + g.t * 5) * 16 + Math.sin(y * .006 - g.t * 2) * 10, y);
  c.lineTo(x0, H + 20); c.closePath(); c.fill();
  /* rim glow */
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = 'rgba(150,255,180,.55)'; c.lineWidth = 6;
  c.beginPath();
  for (let y = -20; y <= H + 20; y += 22) {
    const x = edge + Math.sin(y * .021 + g.t * 5) * 16 + Math.sin(y * .006 - g.t * 2) * 10;
    if (y === -20) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  c.restore();
  /* eyes + teeth */
  const e1 = 16 + Math.sin(g.t * 3) * 4;
  c.fillStyle = '#0a1a0e'; circle(c, e1, 250, 17); c.fill();
  c.fillStyle = '#c6ff70'; circle(c, e1 + 4, 250, 9); c.fill();
  c.fillStyle = '#0a1a0e'; circle(c, e1, 330, 12); c.fill();
  c.fillStyle = '#c6ff70'; circle(c, e1 + 3, 330, 6); c.fill();
  c.fillStyle = '#eaffd0';
  for (let i = 0; i < 9; i++) {
    const y = 380 + i * 26, x = edge - 10 + Math.sin(y * .021 + g.t * 5) * 16;
    c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x, y + 9); c.lineTo(x - 16, y + 18); c.closePath(); c.fill();
  }
  if (dangerT > .5) {
    c.save(); c.globalAlpha = clamp((dangerT - .5) * 1.6, 0, .5);
    c.fillStyle = '#ff2b4d'; c.fillRect(0, 0, W, H); c.restore();
  }
}

function hud(c) {
  /* score */
  const sc = Math.round(g.score);
  g.text(String(sc).padStart(5, '0'), 26, 118, { size: 60, color: '#eaf7ff', ink: '#0a0518', stroke: 9 });
  g.text('SCORE', 30, 140, { size: 20, color: '#8fd6ff', stroke: 3 });
  /* kills */
  g.text(`KILLS ${kills}`, 30, 174, { size: 22, color: '#ffd34d', stroke: 4 });
  /* hearts */
  for (let i = 0; i < 3; i++) {
    const x = W - 44 - i * 44, y = 108;
    heartPath(c, x, y, 30);
    c.fillStyle = i < P.hp ? '#ff2b4d' : 'rgba(255,255,255,.14)'; c.fill();
    c.strokeStyle = '#160818'; c.lineWidth = 3; c.stroke();
  }
  /* progress / boss bar */
  const bw = W - 60, bx = 30, by = 196;
  rr(c, bx, by, bw, 16, 8); c.fillStyle = 'rgba(5,2,12,.72)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2; c.stroke();
  if (phase === 'run') {
    const p = clamp(cam / CFG.arena, 0, 1);
    rr(c, bx + 2, by + 2, (bw - 4) * p, 12, 6);
    const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#7df9ff'); pg.addColorStop(1, '#ff2b4d');
    c.fillStyle = pg; c.fill();
    g.text('BOSS GATE', bx, by - 8, { size: 19, color: '#cfe9ff', stroke: 3 });
    g.text(`${Math.round(p * 100)}%`, bx + bw, by - 8, { size: 19, color: '#ffd34d', stroke: 3, align: 'right' });
    /* cat marker */
    const mx = bx + 2 + (bw - 4) * p;
    c.fillStyle = '#fff'; circle(c, mx, by + 8, 7); c.fill();
  } else if (boss) {
    const p = clamp(boss.hp / boss.max, 0, 1);
    rr(c, bx + 2, by + 2, (bw - 4) * p, 12, 6);
    const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#ffd34d'); pg.addColorStop(1, '#ff2b4d');
    c.fillStyle = pg; c.fill();
    g.text('MECH BOSS', bx, by - 8, { size: 19, color: '#ffd9e4', stroke: 3 });
    g.text(`${Math.max(0, Math.round(boss.hp))}`, bx + bw, by - 8, { size: 19, color: '#ffd34d', stroke: 3, align: 'right' });
  }
  if (dangerT > .35 && phase === 'run') {
    c.save();
    c.globalAlpha = .55 + .45 * Math.sin(g.t * 16);
    g.text('RUN!', W * .5, 300, { size: 74, align: 'center', color: '#ff2b4d', stroke: 10 });
    c.restore();
  }
}

function draw(c) {
  drawSky(c);
  drawRidge(.07, 150, GY - 40, '#1b0f34', 0);
  drawRidge(.13, 108, GY - 6, '#241344', 1.9);
  skyline(MID, GY + 6, '#160c28', 'rgba(255,214,140,.85)', .34);
  skyline(NEAR, GY + 14, '#0d0718', 'rgba(160,240,255,.8)', .62);
  /* motes in the air */
  for (const m of motes) {
    const x = ((m.x - cam * m.par) % W + W) % W;
    const y = m.y + Math.sin(g.t * .8 + m.ph) * 12;
    c.globalAlpha = .25 + .35 * Math.abs(Math.sin(g.t * 1.6 + m.ph));
    c.fillStyle = '#ffd9a8'; c.fillRect(x, y, m.r, m.r);
  }
  c.globalAlpha = 1;
  drawGround(c);
  /* speed lines while sprinting */
  for (let i = 0; i < 8; i++) {
    const y = 240 + ((i * 91 + g.t * 420) % (GY - 320));
    c.globalAlpha = .05 + .07 * (i % 3);
    c.strokeStyle = '#ffd9f2'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W, y); c.lineTo(W - 120 - (i % 3) * 60, y); c.stroke();
  }
  c.globalAlpha = 1;
  drawBoss(c);
  for (const f of foes) drawFoe(c, f);
  drawBullets(c);
  if (g.mode !== 'over' || (g.result && g.result.win)) drawHero(c);
  /* kill flash silhouettes */
  for (const k of killFx) {
    const a = 1 - k.t / .09;
    c.save(); c.globalAlpha = a * .9; c.globalCompositeOperation = 'lighter';
    c.filter = 'brightness(5) saturate(0)';
    drawChar(k.kind === 'turret' ? 'bean' : k.kind, c, k.x - cam, k.y, k.h, { dir: k.dir, t: g.t, hurt: true });
    c.filter = 'none';
    c.restore();
  }
  drawWall(c);
  /* foreground grass */
  const foff = (cam * 1.35) % 120;
  c.fillStyle = '#05020c';
  for (let x = -foff; x < W + 120; x += 120) {
    c.beginPath(); c.moveTo(x, H);
    c.quadraticCurveTo(x + 24, H - 70, x + 52, H);
    c.quadraticCurveTo(x + 76, H - 46, x + 96, H);
    c.closePath(); c.fill();
  }
  hud(c);
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({
  phase, cam: Math.round(cam), px: Math.round(P.x - cam), hp: P.hp,
  foes: foes.map(f => [f.kind, Math.round(f.x - cam), f.hp]),
  bl: bl.length, ebul: ebul.length, boss: boss ? boss.hp : null,
});

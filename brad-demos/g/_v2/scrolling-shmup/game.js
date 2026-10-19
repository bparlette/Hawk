// VOID CAT — scrolling shmup (Cat Arcade v2)
// Vertical scroller: a cat on a hover-pod, drag to fly, auto-cannons. Formation waves roll in from the
// top and the mothership lands at the end. Shooting feel: twin muzzle flashes, casing spray, pod recoil,
// per-bullet hitstop, white-out frame + shake on every kill, streak bullets, combo pitch climb.
import {
  makeGame, sfx, music, comboPitch, clamp, lerp, rnd, ri, chance, R, TAU,
  rr, circle, hexA, shadow, starPath, heartPath, damp, fmt,
} from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'scrolling-shmup', title: 'VOID CAT', sub: 'DRAG TO FLY · GUNS ARE AUTO',
  hook: 'the mothership is coming', w: W, h: H, bg: '#04030f', style: 'toon',
  bloom: 1, ca: .5, vig: 1, scan: .2,
});
const isAuto = new URLSearchParams(location.search).has('auto');

const CFG = {
  spd: 430, fireCd: .105, bspd: 1580,
  waves: 9, bossHp: 42,
};

/* ================================================================ starfield */
const stars = [];
for (let i = 0; i < 130; i++) stars.push({ x: R() * W, y: R() * H, z: .14 + R() * .9, s: .7 + R() * 2.1 });
const dust = Array.from({ length: 16 }, () => ({ x: R() * W, y: R() * H, l: ri(30, 90), a: rnd(.05, .16) }));

/* ================================================================ state */
let P, bl, foes, ebul, killFx, boss, t, kills, autoT, phase, waveN, nextWave, mzT, mzX, mzY, winT, potT, pendingBoss;

function resetWorld() {
  P = { x: 270, y: 792, hp: 4, inv: 1.6, cd: .2, recoil: 0, tilt: 0, bomb: 2, bombCd: 0, flashT: 0 };
  bl = []; foes = []; ebul = []; killFx = []; boss = null;
  t = 0; kills = 0; autoT = 0; phase = 'waves'; waveN = 0; nextWave = 1.1;
  mzT = 0; mzX = 270; mzY = 740; winT = 0; potT = 0; pendingBoss = 0;
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, hp: 4, kills: 0, wave: 0, zone: 'waves', boss: -1 };
}
g.onReset = resetWorld;
g.onStart = () => music('chase');
resetWorld();

/* ================================================================ input */
function readInput() {
  let dx = 0, dy = 0, bomb = false;
  const f = g.btn('f', 12, 846, 116, 100, 'BOMB', { key: 'Space' });
  if (f.pressed) bomb = true;
  if (g.pressed.Space || g.pressed.KeyZ || g.pressed.KeyX) bomb = true;
  if (g.keys.ArrowLeft || g.keys.KeyA) dx = -1;
  if (g.keys.ArrowRight || g.keys.KeyD) dx = 1;
  if (g.keys.ArrowUp || g.keys.KeyW) dy = -1;
  if (g.keys.ArrowDown || g.keys.KeyS) dy = 1;
  /* drag anywhere (but not on the bomb button) */
  const cur = g.pointers.size ? [...g.pointers.values()][0] : null;
  let tx = null, ty = null;
  if (cur && !(cur.x > 6 && cur.x < 134 && cur.y > 840 && cur.y < 952)) { tx = cur.x; ty = cur.y - 34; }
  return { dx, dy, bomb, tx, ty };
}

/* ================================================================ effects */
function shoot() {
  P.cd = CFG.fireCd;
  P.recoil = 1;
  const y = P.y - 16;
  mzX = P.x; mzY = y; mzT = .05;
  for (const off of [-27, 27]) {
    bl.push({ x: P.x + off * .9, y, vy: -CFG.bspd, off });
  }
  g.punch(.012);
  sfx('shoot', { pitch: 1.06 + R() * .12, vol: .42 });
  g.fx.burst(P.x, y, 2, { kind: 'spark', color: ['#eaffff', '#7df9ff'], speed: 260, life: .16, size: 5, ang: -Math.PI / 2, spread: .9, g: 60 });
  g.fx.emit('glow', P.x, y, { life: .09, size: 30, color: '#bff3ff', add: true });
  g.fx.emit('debris', P.x + (chance(.5) ? 22 : -22), y + 10, {
    vx: (chance(.5) ? 1 : -1) * ri(50, 120), vy: -ri(30, 90), g: 1250, life: .7,
    size: ri(4, 6), color: chance(.5) ? '#ffd34d' : '#a8ffe8', rot: R() * 6, vr: ri(-14, 14),
  });
}
function hurt() {
  if (P.inv > 0 || phase === 'win') return;
  P.hp--; P.inv = 1.6; P.flashT = .3;
  g.impact(P.x, P.y, { punch: .22, shake: 22, stop: .08, flash: '#ff2b4d', flashA: .34, rip: 1.3, sfx: 'hit', pitch: .9 });
  g.fx.burst(P.x, P.y, 22, { kind: 'spark', color: ['#ff2b4d', '#fff', '#ffd34d'], speed: 420, life: .5, size: 7 });
  g.combo.miss();
  if (P.hp <= 0) lose();
}
function lose() {
  g.fx.blast(P.x, P.y, { r: 110, color: '#ff2b4d', colors: ['#ff2b4d', '#fff', '#ff8a1f'], n: 38, speed: 460, punch: .2, shake: 28, flashA: .55 });
  g.fx.burst(P.x, P.y, 16, { kind: 'debris', color: ['#7df9ff', '#fff', '#2a3350'], speed: 340, life: .9 });
  g.hitstop(.12);
  sfx('explode', { pitch: .85 });
  g.end({ win: false, score: Math.round(g.score), label: 'SCORE' });
}
function bomb() {
  if (P.bomb <= 0 || P.bombCd > 0) return;
  P.bomb--; P.bombCd = .5;
  g.flash('#bff3ff', .55); g.shake(20); g.hitstop(.1); g.punch(.2);
  g.fx.emit('ring', P.x, P.y, { size: 320, life: .6, color: '#7df9ff', add: true, wide: 14 });
  g.fx.emit('ring', P.x, P.y, { size: 460, life: .8, color: '#ffd34d', add: true, wide: 9 });
  g.fx.burst(P.x, P.y, 40, { kind: 'spark', color: ['#bff3ff', '#fff', '#ffd34d'], speed: 560, life: .7, size: 8 });
  for (const e of ebul) g.fx.emit('glow', e.x, e.y, { life: .2, size: 18, color: '#7df9ff', add: true });
  ebul.length = 0;
  for (let i = foes.length - 1; i >= 0; i--) {
    foes[i].hp -= 3; foes[i].fl = .14;
    if (foes[i].hp <= 0) { killFoe(foes[i], true); foes.splice(i, 1); }
  }
  if (boss && boss.hp > 0) {
    boss.hp -= 8; boss.fl = .2;
    g.fx.blast(boss.x, boss.y, { r: 90, color: '#bff3ff', n: 20, speed: 380, punch: .1, shake: 10, flashA: .1 });
  }
  sfx('explode', { pitch: .7 });
  sfx('powerup', { pitch: 1.2 });
}
function killFoe(f, silent) {
  const pts = Math.round(f.pts * g.combo.mult);
  g.score += pts; kills++;
  g.flash('#fff', .28);
  g.hitstop(.045);
  g.shake(5 + f.pts * .03);
  g.fx.blast(f.x, f.y, { r: 48, color: f.col, colors: [f.col, '#fff', '#ffd34d'], n: 18, speed: 330, punch: .05, shake: 6, flashA: 0 });
  g.fx.burst(f.x, f.y, 9, { kind: 'debris', color: [f.col, '#2a3350', '#fff'], speed: 260, life: .8, size: 6 });
  killFx.push({ x: f.x, y: f.y, r: f.r, k: f.kind, t: 0 });
  if (!silent) g.combo.hit(f.x, f.y, '+' + pts);
  else { g.popup('+' + pts, f.x, f.y, '#ffd34d', 30); }
  sfx('boom', { pitch: comboPitch(Math.min(11, g.combo.n)), vol: .45 });
  if (kills % 12 === 0 && P.bomb < 3) { P.bomb++; g.popup('BOMB!', P.x, P.y - 70, '#7df9ff', 34); sfx('powerup', { pitch: 1.3 }); }
}

/* ================================================================ waves */
const FORM = [
  /* 0 */ { n: 5, col: '#8fcf7a', hp: 2, kind: 'drone', pts: 70, spread: 62, shape: 'v' },
  /* 1 */ { n: 6, col: '#7df9ff', hp: 2, kind: 'drone', pts: 70, spread: 56, shape: 'line' },
  /* 2 */ { n: 5, col: '#ffd34d', hp: 3, kind: 'gunship', pts: 110, spread: 70, shape: 'v' },
  /* 3 */ { n: 7, col: '#ff8ad2', hp: 2, kind: 'drone', pts: 80, spread: 52, shape: 'arc' },
];
function spawnWave() {
  const f = FORM[Math.min(FORM.length - 1, Math.floor(waveN / 2))];
  const cx = waveN % 2 ? 152 : 372;
  for (let i = 0; i < f.n; i++) {
    const a = i - (f.n - 1) / 2;
    const hx = cx + a * f.spread;
    const hy = -70 - Math.abs(a) * (f.shape === 'v' ? 46 : 12);
    foes.push({
      kind: f.kind, x: clamp(hx, 42, W - 42), y: hy, hx: clamp(hx, 42, W - 42), hy,
      t: 0, ph: i * .7 + R(), hp: f.hp, max: f.hp, r: f.kind === 'gunship' ? 28 : 22,
      col: f.col, pts: f.pts, fl: 0, cd: 1.4 + R() * 1.4, drift: f.shape === 'arc' ? 26 : 14,
    });
  }
  waveN++;
}
function spawnBoss() {
  boss = { x: W / 2, y: -190, hp: CFG.bossHp, max: CFG.bossHp, t: 0, fl: 0, cd: 2, cnt: 0, die: 0, arrive: 0 };
  g.showBanner('MOTHERSHIP', 1.4);
  g.shake(14); g.flash('#ff2b4d', .34);
  sfx('explode', { pitch: .65 });
  music('boss');
  /* the escort wave files out */
  for (const f of foes) f.leaving = true;
}

/* ================================================================ update */
function update(dt) {
  if (dt <= 0) return;
  const inp = readInput();
  t += dt;
  if (g.mode === 'play') autoT += dt;

  /* --- steering ----------------------------------------------------- */
  let dx = inp.dx, dy = inp.dy, bombW = inp.bomb;
  if (inp.tx !== null) {
    const ddx = inp.tx - P.x, ddy = inp.ty - P.y;
    dx = Math.abs(ddx) > 6 ? Math.sign(ddx) : 0;
    dy = Math.abs(ddy) > 6 ? Math.sign(ddy) : 0;
    const ease = clamp(Math.max(Math.abs(ddx), Math.abs(ddy)) / 90, .35, 1);
    dx *= ease; dy *= ease;
  }
  if (isAuto && g.mode === 'play') {
    if (g.dumb()) { dx = 0; dy = 0; bombW = false; }        // attempt 0: sits still and gets shredded
    else {
      /* pick the least-lethal lane, then aim at the nearest target */
      let bestX = P.x, bestS = -1e9;
      const aimFoe = boss && boss.hp > 0 ? boss.x : (foes.length ? foes.reduce((a, b) => (b.y > a.y ? b : a)).x : W / 2);
      for (let cx = 52; cx <= W - 52; cx += 54) {
        let s = -Math.abs(cx - aimFoe) * .5;
        for (const e of ebul) {
          if (e.vy >= -20) continue;
          const tt = (P.y - e.y) / -e.vy;
          if (tt < 0 || tt > .9) continue;
          const px = e.x + e.vx * tt;
          const d = Math.abs(cx - px);
          s -= Math.max(0, 96 - d) * 6;
        }
        for (const f of foes) if (f.y > 420 && Math.abs(cx - f.x) < 46) s -= 260;
        if (Math.abs(cx - P.x) > 260) s -= 40;
        if (s > bestS) { bestS = s; bestX = cx; }
      }
      const d = bestX - P.x;
      dx = Math.abs(d) > 5 ? clamp(d / 60, -1, 1) : 0;
      dy = P.y < 760 ? 1 : (P.y > 860 ? -1 : 0);
      /* panic bomb when boxed in */
      if (P.bomb > 0) for (const e of ebul) if (Math.abs(e.x - P.x) < 54 && P.y - e.y > 0 && P.y - e.y < 130) { bombW = true; break; }
    }
  }
  if (g.mode !== 'play') { dx = 0; dy = 0; bombW = false; }

  if (dx) { P.x += dx * CFG.spd * dt; P.tilt = damp(P.tilt, dx * .3, 12, dt); }
  else P.tilt = damp(P.tilt, 0, 12, dt);
  if (dy) P.y += dy * CFG.spd * .78 * dt;
  P.x = clamp(P.x, 40, W - 40); P.y = clamp(P.y, 190, 918);
  if (bombW) bomb();

  /* engine trail */
  potT -= dt;
  if (potT <= 0) {
    potT = .04;
    g.fx.emit('glow', P.x + ri(-22, 22), P.y + 26, { life: .22, size: 16, color: chance(.5) ? '#7df9ff' : '#4aa8ff', add: true, vy: 120 });
  }

  /* --- player gun --------------------------------------------------- */
  P.cd -= dt; P.inv = Math.max(0, P.inv - dt);
  P.recoil = damp(P.recoil, 0, 16, dt);
  P.bombCd = Math.max(0, P.bombCd - dt);
  P.flashT = Math.max(0, P.flashT - dt);
  mzT = Math.max(0, mzT - dt);
  if (g.mode === 'play' && P.cd <= 0 && phase !== 'win') shoot();

  /* --- waves / boss -------------------------------------------------- */
  if (phase === 'waves') {
    nextWave -= dt;
    if (nextWave <= 0) {
      if (waveN < CFG.waves) { spawnWave(); nextWave = lerp(1.5, .95, waveN / CFG.waves); }
      else { pendingBoss += dt; if (pendingBoss > 1.15) { phase = 'boss'; spawnBoss(); } }
    }
  }

  /* --- foes --------------------------------------------------------- */
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.t += dt; f.fl = Math.max(0, f.fl - dt);
    if (f.leaving || f.y > 990) { f.y -= 340 * dt; f.x += 120 * dt; if (f.y < -120) foes.splice(i, 1); continue; }
    f.hy += (phase === 'boss' ? 46 : 26 + 12 * (waveN / CFG.waves)) * dt;
    f.x = f.hx + Math.sin(f.t * 1.25 + f.ph) * f.drift;
    f.y = f.hy + Math.sin(f.t * .9 + f.ph) * 6;
    f.cd -= dt;
    if (f.cd <= 0 && f.y > -20) {
      f.cd = f.kind === 'gunship' ? 1.5 : 2.3 + R() * 1.2;
      const ax = P.x - f.x, ay = P.y - f.y, d = Math.hypot(ax, ay) || 1, sp = 330;
      if (f.kind === 'gunship') {
        for (const a of [-.16, 0, .16]) {
          const ang = Math.atan2(ay, ax) + a;
          ebul.push({ x: f.x, y: f.y + 12, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 9 });
        }
        sfx('laser', { pitch: .95, vol: .3 });
      } else {
        ebul.push({ x: f.x, y: f.y + 12, vx: ax / d * sp, vy: ay / d * sp, r: 9 });
        sfx('laser', { pitch: 1.25, vol: .22 });
      }
      g.fx.burst(f.x, f.y + 12, 4, { kind: 'spark', color: [f.col, '#fff'], speed: 160, life: .2, size: 4 });
    }
    if (Math.hypot(f.x - P.x, f.y - P.y) < f.r + 18) {
      f.hp = 0; killFoe(f, true); foes.splice(i, 1); hurt(); continue;
    }
    if (f.y > 900) { foes.splice(i, 1); g.combo.miss(); }
  }

  /* --- boss --------------------------------------------------------- */
  if (boss) {
    boss.t += dt; boss.fl = Math.max(0, boss.fl - dt);
    if (boss.y < 246) { boss.y += 150 * dt; boss.arrive = 0; }
    else boss.arrive = Math.min(1, boss.arrive + dt * 2);
    boss.x = W / 2 + Math.sin(boss.t * .8) * 118;
    if (boss.hp > 0 && boss.arrive > .5) {
      boss.cd -= dt;
      if (boss.cd <= 0) {
        const rage = boss.hp / boss.max < .45;
        boss.cd = rage ? .78 : 1.15;
        boss.cnt++;
        if (boss.cnt % 3 === 0) {
          for (let k = -2; k <= 2; k++) {
            const ang = Math.PI / 2 + k * .22;
            ebul.push({ x: boss.x, y: boss.y + 40, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, r: 11 });
          }
          sfx('laser', { pitch: .8, vol: .5 });
        } else {
          const ang = Math.atan2(P.y - boss.y, P.x - boss.x);
          for (let k = -1; k <= 1; k++) ebul.push({ x: boss.x + k * 46, y: boss.y + 30, vx: Math.cos(ang + k * .1) * 360, vy: Math.sin(ang + k * .1) * 360, r: 9 });
          sfx('laser', { pitch: 1.1, vol: .4 });
        }
        g.fx.burst(boss.x, boss.y + 40, 10, { kind: 'spark', color: ['#ff2b4d', '#ffd34d'], speed: 240, life: .3, size: 6, ang: Math.PI / 2, spread: 1.4 });
        g.shake(5);
      }
      if (chance(dt * .5)) {
        foes.push({ kind: 'drone', x: boss.x + ri(-90, 90), y: boss.y + 40, hx: boss.x, hy: boss.y + 40, t: 0, ph: R() * 6, hp: 1, max: 1, r: 20, col: '#ff8ad2', pts: 50, fl: 0, cd: 1.2, drift: 20 });
      }
    }
    if (phase === 'win') {
      boss.die += dt;
      if (boss.die > .16) {
        boss.die = 0;
        boss.y += 6;
        g.fx.blast(boss.x + ri(-110, 110), boss.y + ri(-60, 60), { r: ri(50, 95), color: '#ffd34d', colors: ['#ffd34d', '#ff2b4d', '#fff'], n: 16, speed: 350, shake: 9, punch: .04, flashA: .14 });
        sfx('boom', { pitch: .8 + R() * .5 });
      }
      winT -= dt;
      if (winT <= 0) { g.score += 3000; g.end({ win: true, score: Math.round(g.score), label: 'SCORE' }); }
    }
  }

  /* --- player bullets ------------------------------------------------ */
  for (let i = bl.length - 1; i >= 0; i--) {
    const b = bl[i];
    b.y += b.vy * dt;
    let dead = b.y < -40;
    if (!dead) {
      for (let j = ebul.length - 1; j >= 0; j--) {
        const e = ebul[j];
        if (Math.abs(b.x - e.x) < 16 + e.r && Math.abs(b.y - e.y) < 20 + e.r) {
          ebul.splice(j, 1); dead = true;
          g.score += 15;
          g.fx.burst(e.x, e.y, 9, { kind: 'spark', color: ['#fff', '#7df9ff', '#ffd34d'], speed: 240, life: .3, size: 6 });
          g.hitstop(.014); g.shake(2.5);
          sfx('snap', { pitch: 1.2 + R() * .3, vol: .3 });
          g.popup('15', e.x, e.y - 14, '#9be8ff', 24);
          break;
        }
      }
    }
    if (!dead) {
      for (let j = foes.length - 1; j >= 0; j--) {
        const f = foes[j];
        if (Math.hypot(b.x - f.x, b.y - f.y) < f.r + 8) {
          dead = true;
          f.hp -= 1; f.fl = .1;
          g.fx.burst(b.x, b.y, 6, { kind: 'spark', color: ['#fffbe0', '#ffd34d', f.col], speed: 280, life: .26, size: 5, ang: -Math.PI / 2, spread: 1.5 });
          g.fx.emit('glow', b.x, b.y, { life: .1, size: 20, color: '#fff', add: true });
          g.hitstop(.013); g.shake(2);
          sfx('hit', { pitch: .95 + R() * .2, vol: .3 });
          if (f.hp <= 0) { killFoe(f); foes.splice(j, 1); }
          break;
        }
      }
    }
    if (!dead && boss && boss.hp > 0) {
      if (Math.abs(b.x - boss.x) < 116 && Math.abs(b.y - boss.y) < 74) {
        dead = true;
        boss.hp -= 1; boss.fl = .08;
        g.fx.burst(b.x, b.y, 7, { kind: 'spark', color: ['#fffbe0', '#ffd34d', '#ff2b4d'], speed: 300, life: .28, size: 6, ang: -Math.PI / 2, spread: 1.6 });
        g.fx.emit('glow', b.x, b.y, { life: .12, size: 24, color: '#fff3b0', add: true });
        g.hitstop(.014); g.shake(3);
        g.score += 12;
        sfx('hit', { pitch: .9 + R() * .12, vol: .3 });
        if (boss.hp <= 0) {
          boss.hp = 0; phase = 'win'; winT = 1.3;
          g.score += 1500;
          g.flash('#fff', .55); g.shake(26); g.hitstop(.16); g.slowmo(.4, .9);
          g.fx.blast(boss.x, boss.y, { r: 180, color: '#7df9ff', colors: ['#7df9ff', '#ff2b4d', '#fff'], n: 50, speed: 560, punch: .22, shake: 24, flashA: .5 });
          sfx('explode', { pitch: .7 });
          g.combo.hit(boss.x, boss.y - 90, '+' + 1500);
        }
      }
    }
    if (dead) bl.splice(i, 1);
  }

  /* --- enemy bullets ------------------------------------------------ */
  for (let i = ebul.length - 1; i >= 0; i--) {
    const e = ebul[i];
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.y > H + 40 || e.y < -60 || e.x < -40 || e.x > W + 40) { ebul.splice(i, 1); continue; }
    if (Math.hypot(e.x - P.x, e.y - P.y) < 17 + e.r && P.inv <= 0) { ebul.splice(i, 1); hurt(); continue; }
  }

  /* --- kill ghosts --------------------------------------------------- */
  for (let i = killFx.length - 1; i >= 0; i--) { killFx[i].t += dt; if (killFx[i].t > .1) killFx.splice(i, 1); }

  /* --- state --------------------------------------------------------- */
  g.state = {
    score: Math.round(g.score), hp: P.hp, kills, wave: Math.min(waveN, CFG.waves),
    zone: phase, boss: boss ? Math.max(0, boss.hp) : -1,
  };
  if (isAuto && !g.dumb() && autoT > 60 && phase !== 'win') g.end({ win: true, score: Math.round(g.score), label: 'SCORE' });
}

/* ================================================================ draw */
let neb = null;
function drawSpace(c) {
  if (!neb) {
    neb = c.createLinearGradient(0, 0, 0, H);
    neb.addColorStop(0, '#04030f'); neb.addColorStop(.45, '#160b31'); neb.addColorStop(.78, '#2c0f3e'); neb.addColorStop(1, '#170826');
  }
  c.fillStyle = neb; c.fillRect(0, 0, W, H);
  /* nebula clouds */
  const blobs = [[.28, .3, 300, 'rgba(120,60,255,.2)'], [.76, .62, 340, 'rgba(255,60,140,.14)'], [.14, .84, 260, 'rgba(60,200,255,.12)']];
  for (const [bx, by, br, col] of blobs) {
    const rg = c.createRadialGradient(W * bx, H * by, 0, W * bx, H * by, br);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  }
  /* distant planet */
  const py = 250 + Math.sin(t * .1) * 8;
  const pg = c.createRadialGradient(88 - 22, py - 22, 8, 88, py, 108);
  pg.addColorStop(0, '#ffb36b'); pg.addColorStop(.5, '#c9426c'); pg.addColorStop(1, '#3a1040');
  c.fillStyle = pg; circle(c, 88, py, 104); c.fill();
  c.strokeStyle = 'rgba(255,190,120,.28)'; c.lineWidth = 5;
  c.beginPath(); c.ellipse(88, py, 168, 28, -.28, 0, TAU); c.stroke();
  /* stars */
  for (const s of stars) {
    s.y = (s.y + (30 + 320 * s.z) * (1 / 60)) % H;
    c.globalAlpha = .2 + s.z * .8;
    c.fillStyle = s.z > .7 ? '#dff3ff' : '#9fb6ff';
    c.fillRect(s.x, s.y, s.s * s.z * 1.7, s.s * s.z * 2.4);
  }
  c.globalAlpha = 1;
  /* near dust streaks */
  for (const d of dust) {
    d.y = (d.y + 620 * (1 / 60)) % (H + 120);
    c.globalAlpha = d.a;
    c.strokeStyle = '#cfe6ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y + d.l); c.stroke();
  }
  c.globalAlpha = 1;
}

function drawFoe(c, f) {
  c.save(); c.translate(f.x, f.y);
  const p = .5 + .5 * Math.sin(f.t * 4 + f.ph);
  /* thruster */
  c.globalCompositeOperation = 'lighter';
  const tg = c.createRadialGradient(0, -f.r * .6, 0, 0, -f.r * .6, f.r * 1.5);
  tg.addColorStop(0, hexA(f.col, .8)); tg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = tg; circle(c, 0, -f.r * .6, f.r * 1.5); c.fill();
  c.globalCompositeOperation = 'source-over';
  /* wings */
  c.fillStyle = f.fl > 0 ? '#fff' : '#22243d';
  c.beginPath(); c.moveTo(-f.r, -4); c.lineTo(-f.r * 1.9, 10); c.lineTo(-f.r * .8, 12); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(f.r, -4); c.lineTo(f.r * 1.9, 10); c.lineTo(f.r * .8, 12); c.closePath(); c.fill();
  /* body */
  const bg = c.createLinearGradient(0, -f.r, 0, f.r);
  bg.addColorStop(0, f.fl > 0 ? '#fff' : '#4a4f72'); bg.addColorStop(1, f.fl > 0 ? '#fff' : '#1b1d31');
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * TAU / 6;
    const px = Math.cos(a) * f.r, py = Math.sin(a) * f.r * .95;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fillStyle = bg; c.fill();
  c.strokeStyle = '#07040f'; c.lineWidth = 3; c.stroke();
  /* eye */
  c.fillStyle = f.fl > 0 ? '#fff' : f.col;
  circle(c, 0, 2, 7 + p * 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.9)'; circle(c, -2, 0, 3); c.fill();
  /* hp pips */
  if (f.max > 1) {
    for (let i = 0; i < f.max; i++) {
      c.fillStyle = i < f.hp ? f.col : 'rgba(255,255,255,.14)';
      c.fillRect(-f.max * 5 + i * 10, -f.r - 12, 7, 3);
    }
  }
  c.restore();
}

function drawBoss(c) {
  if (!boss) return;
  const x = boss.x, y = boss.y;
  c.save(); c.translate(x, y);
  /* under glow */
  c.globalCompositeOperation = 'lighter';
  const ug = c.createRadialGradient(0, 20, 10, 0, 20, 180);
  ug.addColorStop(0, 'rgba(255,43,77,.55)'); ug.addColorStop(1, 'rgba(255,43,77,0)');
  c.fillStyle = ug; circle(c, 0, 30, 180); c.fill();
  c.globalCompositeOperation = 'source-over';
  /* hull */
  const hg = c.createLinearGradient(0, -80, 0, 70);
  hg.addColorStop(0, boss.fl > 0 ? '#fff' : '#5a3a78'); hg.addColorStop(.55, boss.fl > 0 ? '#fff' : '#33203f'); hg.addColorStop(1, '#1a0f26');
  c.beginPath();
  c.moveTo(-124, -6); c.lineTo(-96, -46); c.lineTo(-40, -66); c.lineTo(40, -66); c.lineTo(96, -46); c.lineTo(124, -6);
  c.lineTo(84, 44); c.lineTo(30, 66); c.lineTo(-30, 66); c.lineTo(-84, 44); c.closePath();
  c.fillStyle = hg; c.fill();
  c.strokeStyle = '#0a0412'; c.lineWidth = 4; c.stroke();
  /* wings */
  c.fillStyle = boss.fl > 0 ? '#fff' : '#2a1a3a';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 96, -30); c.lineTo(s * 176, 6); c.lineTo(s * 150, 34); c.lineTo(s * 84, 30); c.closePath(); c.fill();
    c.strokeStyle = '#0a0412'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#ffd34d'; circle(c, s * 150, 12, 6); c.fill();
    c.fillStyle = boss.fl > 0 ? '#fff' : '#2a1a3a';
  }
  /* eye */
  const p = .5 + .5 * Math.sin(boss.t * 4);
  const eg = c.createRadialGradient(0, 0, 4, 0, 0, 56);
  eg.addColorStop(0, '#fff'); eg.addColorStop(.3, boss.hp > 0 ? '#ff2b4d' : '#666'); eg.addColorStop(1, 'rgba(255,43,77,0)');
  c.fillStyle = eg; circle(c, 0, 0, 40 + p * 12); c.fill();
  c.fillStyle = boss.fl > 0 ? '#fff' : '#1a0f26';
  c.beginPath(); c.ellipse(0, 0, 26, 30, 0, 0, TAU); c.fill();
  c.fillStyle = boss.hp > 0 ? '#ffd34d' : '#444';
  c.beginPath(); c.ellipse(Math.sin(boss.t * 1.6) * 8, 0, 10, 16, 0, 0, TAU); c.fill();
  /* turret pods */
  for (const s of [-1, 1]) {
    c.save(); c.translate(s * 78, 34); c.rotate(Math.sin(boss.t * 2) * .12);
    rr(c, -16, -14, 32, 30, 8); c.fillStyle = boss.fl > 0 ? '#fff' : '#3d2b52'; c.fill();
    c.strokeStyle = '#0a0412'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#ff2b4d'; circle(c, 0, 0, 6 + p * 2); c.fill();
    c.restore();
  }
  /* rivets */
  c.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = -3; i <= 3; i++) c.fillRect(i * 26, -56, 8, 4);
  c.restore();
  /* shield arcs while arriving */
  if (boss.arrive < .5) {
    c.save(); c.globalAlpha = .3; c.strokeStyle = '#7df9ff'; c.lineWidth = 4;
    circle(c, x, y, 150 + Math.sin(t * 8) * 8); c.stroke(); c.restore();
  }
}

function drawHero(c) {
  const x = P.x, y = P.y;
  shadow(c, x, y + 34, 40, 8, .3);
  c.save();
  c.translate(x, y);
  c.rotate(P.tilt);
  /* thrusters */
  c.globalCompositeOperation = 'lighter';
  const fl = 30 + Math.sin(g.t * 44) * 8 + P.recoil * 10;
  for (const s of [-1, 1]) {
    const tg = c.createRadialGradient(s * 24, 30, 0, s * 24, 30 + fl * .4, fl);
    tg.addColorStop(0, 'rgba(255,255,255,.95)'); tg.addColorStop(.35, 'rgba(125,249,255,.8)'); tg.addColorStop(1, 'rgba(74,168,255,0)');
    c.fillStyle = tg; circle(c, s * 24, 30 + fl * .4, fl); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  /* pod */
  const pg = c.createLinearGradient(0, 2, 0, 34);
  pg.addColorStop(0, '#8ea6d8'); pg.addColorStop(.5, '#3a4670'); pg.addColorStop(1, '#1a1f36');
  rr(c, -38, 2, 76, 32, 16); c.fillStyle = pg; c.fill();
  c.strokeStyle = '#0a0412'; c.lineWidth = 3; c.stroke();
  /* wings */
  c.fillStyle = '#38456b';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(s * 34, 6); c.lineTo(s * 62, 24); c.lineTo(s * 40, 30); c.closePath(); c.fill();
    c.strokeStyle = '#0a0412'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#7df9ff'; c.fillRect(s * 52 - 3, 22, 6, 5);
    c.fillStyle = '#38456b';
  }
  /* cannons */
  c.fillStyle = '#1d2337';
  c.fillRect(-32, -14, 9, 22); c.fillRect(23, -14, 9, 22);
  c.fillStyle = '#7df9ff';
  c.fillRect(-31, -14, 4, 4); c.fillRect(24, -14, 4, 4);
  c.restore();

  /* the cat pilot (animated) */
  c.save();
  c.translate(x, y + 12 + P.recoil * 2);
  c.rotate(P.tilt * .5);
  drawChar('cat', c, 0, 0, 74, {
    dir: 1, color: '#ffb347', t: g.t, anim: 'idle',
    hurt: (P.inv > 0 && Math.sin(g.t * 40) > 0),
  });
  /* tiny scarf flutter */
  c.strokeStyle = '#ff2b4d'; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-16, -34);
  c.quadraticCurveTo(-34 + Math.sin(g.t * 9) * 5, -30, -42, -16 + Math.cos(g.t * 7) * 6);
  c.stroke();
  c.restore();

  /* muzzle flashes */
  if (mzT > 0) {
    const k = mzT / .05;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const mx = x + s * 27, my = y - 16;
      const fg = c.createRadialGradient(mx, my, 0, mx, my, 40 * k);
      fg.addColorStop(0, 'rgba(255,255,255,.98)'); fg.addColorStop(.4, 'rgba(125,249,255,.75)'); fg.addColorStop(1, 'rgba(74,168,255,0)');
      c.fillStyle = fg; circle(c, mx, my, 40 * k); c.fill();
      starPath(c, mx, my - 8 * k, 20 * k, g.t * 6);
      c.fillStyle = 'rgba(230,255,255,.95)'; c.fill();
    }
    c.restore();
  }
  /* shield ring */
  if (P.inv > 0) {
    c.save(); c.globalAlpha = .25 + .2 * Math.sin(g.t * 18);
    c.strokeStyle = '#7df9ff'; c.lineWidth = 4;
    circle(c, x, y, 52); c.stroke(); c.restore();
  }
}

function drawBullets(c) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const b of bl) {
    const len = 46;
    c.strokeStyle = 'rgba(120,200,255,.3)'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.moveTo(b.x, b.y + len); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = 'rgba(190,250,255,.9)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(b.x, b.y + len * .55); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(b.x, b.y + len * .3); c.lineTo(b.x, b.y); c.stroke();
    c.fillStyle = '#eaffff'; circle(c, b.x, b.y, 3.6); c.fill();
  }
  for (const e of ebul) {
    const eg = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
    eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(.32, 'rgba(255,80,120,.9)'); eg.addColorStop(1, 'rgba(255,20,90,0)');
    c.fillStyle = eg; circle(c, e.x, e.y, e.r * 3); c.fill();
  }
  c.restore();
  for (const e of ebul) {
    c.fillStyle = '#3d0018'; circle(c, e.x, e.y, e.r * .8); c.fill();
    c.fillStyle = '#ffd9e4'; circle(c, e.x - 2, e.y - 2, e.r * .28); c.fill();
  }
}

function hud(c) {
  const sc = Math.round(g.score);
  g.text(String(sc).padStart(5, '0'), 26, 104, { size: 56, color: '#eaffff', ink: '#04030f', stroke: 9 });
  g.text('SCORE', 30, 126, { size: 20, color: '#7df9ff', stroke: 3 });
  g.text(`KILLS ${kills}`, 30, 160, { size: 22, color: '#ffd34d', stroke: 4 });
  for (let i = 0; i < 4; i++) {
    const x = W - 44 - i * 42, y = 96;
    heartPath(c, x, y, 28);
    c.fillStyle = i < P.hp ? '#ff2b4d' : 'rgba(255,255,255,.13)'; c.fill();
    c.strokeStyle = '#0a0412'; c.lineWidth = 3; c.stroke();
  }
  /* wave / boss meter */
  const bw = W - 60, bx = 30, by = 182;
  rr(c, bx, by, bw, 14, 7); c.fillStyle = 'rgba(4,3,15,.75)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2; c.stroke();
  if (phase === 'waves') {
    const p = clamp(waveN / CFG.waves, 0, 1);
    rr(c, bx + 2, by + 2, (bw - 4) * p, 10, 5);
    const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#7df9ff'); pg.addColorStop(1, '#ff2b4d');
    c.fillStyle = pg; c.fill();
    g.text(`WAVE ${Math.min(waveN, CFG.waves)}/${CFG.waves}`, bx, by - 8, { size: 19, color: '#cfe9ff', stroke: 3 });
    g.text('MOTHERSHIP →', bx + bw, by - 8, { size: 19, color: '#ffd34d', stroke: 3, align: 'right' });
  } else if (boss) {
    const p = clamp(boss.hp / boss.max, 0, 1);
    rr(c, bx + 2, by + 2, (bw - 4) * p, 10, 5);
    const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#ffd34d'); pg.addColorStop(1, '#ff2b4d');
    c.fillStyle = pg; c.fill();
    g.text('MOTHERSHIP', bx, by - 8, { size: 19, color: '#ffd9e4', stroke: 3 });
    g.text(`${Math.max(0, Math.round(boss.hp))}`, bx + bw, by - 8, { size: 19, color: '#ffd34d', stroke: 3, align: 'right' });
  }
  /* bomb pips */
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 26, y = 220;
    starPath(c, x, y, 10, 0);
    c.fillStyle = i < P.bomb ? '#7df9ff' : 'rgba(255,255,255,.12)'; c.fill();
    c.strokeStyle = '#0a0412'; c.lineWidth = 2; c.stroke();
  }
}

function draw(c) {
  drawSpace(c);
  drawBoss(c);
  for (const f of foes) drawFoe(c, f);
  drawBullets(c);
  if (g.mode !== 'over' || (g.result && g.result.win)) drawHero(c);
  /* kill flashes */
  for (const k of killFx) {
    const a = 1 - k.t / .1;
    c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#fff'; circle(c, k.x, k.y, k.r * (1 + k.t * 6)); c.fill();
    c.restore();
  }
  /* incoming warning */
  if (phase === 'waves' && waveN >= CFG.waves && !boss) {
    c.save(); c.globalAlpha = .4 + .4 * Math.sin(g.t * 12);
    g.text('WARNING', W / 2, 300, { size: 64, align: 'center', color: '#ff2b4d', stroke: 10 });
    c.restore();
  }
  hud(c);
}

g.run(update, draw);
window.__g = g;
window.__dbg = () => ({
  phase, wave: waveN, hp: P.hp, bomb: P.bomb,
  foes: foes.map(f => [f.kind, Math.round(f.x), Math.round(f.y), f.hp]),
  bl: bl.length, ebul: ebul.length, boss: boss ? boss.hp : null, px: Math.round(P.x),
});

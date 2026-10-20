// CALL OF KAREN: SUBURBAN WARFARE — CoD x Karen mashup (Cat Arcade v2)
// Top-down arena shooter. Drag to move, auto-fire Allowance AR.
// CoD kit: kill feed, hitmarkers, minimap, damage direction, killstreaks.
// Karen kit: HOA Enforcers, Kevin boss, NOSY DRONE (UAV), FINE STRIKE (airstrike),
// SPEAK TO THE MANAGER (tactical nuke).
import { makeGame, sfx, music, clamp, lerp, rnd, chance, R, TAU, rr } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'suburban-warfare', title: 'SUBURBAN WARFARE',
  sub: 'CALL OF KAREN · DRAG TO MOVE · AUTO-FIRE',
  hook: 'call of duty, but the final boss is a karen',
  w: W, h: H, bg: '#0b0f1e', style: 'toon',
  bloom: .62, ca: .4, vig: 1, scan: .2,
});

const CFG = {
  playerSpeed: 300, playerR: 22, fireCD: .22, bulletSpeed: 720, bulletDmg: 1, range: 340,
  enforcerSpeed: 120, enforcerHP: 2, enforcerR: 20, touchDmgCD: 1.0,
  kevinSpeed: 80, kevinHP: 24, kevinR: 34,
  waveSize: n => 3 + Math.floor(n * 1.4),
  spawnGap: n => Math.max(.5, 1.6 - n * .08),
};
const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const spectate = P.has('spectate') || P.has('autostart');
const BOT = isAuto || spectate;
if (spectate && !isAuto) setTimeout(() => { if (g.mode === 'title') g.start(); }, 700);

/* ================= state ================= */
let S;
const STREAKS = [
  { kills: 3, name: 'NOSY DRONE', desc: 'UAV ONLINE', color: '#7df9ff' },
  { kills: 5, name: 'FINE STRIKE', desc: 'AIRSTRIKE READY', color: '#ffd34d' },
  { kills: 7, name: 'SPEAK TO THE MANAGER', desc: 'TACTICAL NUKE READY', color: '#ff3b5c' },
];
function resetWorld() {
  S = {
    px: W / 2, py: H / 2, vx: 0, vy: 0, aim: -Math.PI / 2, fireT: 0,
    lives: 3, invuln: 0, kills: 0, streak: 0, wave: 0,
    enemies: [], bullets: [], ebullets: [], casings: [],
    feed: [], hitmarks: [], dmgDir: 0, dmgDirT: 0,
    shake: 0, hitstop: 0, slowmo: 0,
    drone: 0, fineStrike: false, manager: false,
    strikeAnim: null, nukeAnim: null,
    spawnT: 0, spawnLeft: 0, waveT: 0, banner: '', bannerT: 0,
    dragX: 0, dragY: 0, dragging: false, dragId: -1,
    botTx: W / 2, botTy: H / 2,
    muzzle: 0, time: 0,
  };
  g.score = 0; g.combo.reset(); g.fx.clear();
  g.state = { score: 0, lives: 3, wave: 0, kills: 0 };
  startWave(1);
}
g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('click', { pitch: 1.1 }); };

function startWave(n) {
  S.wave = n;
  S.spawnLeft = CFG.waveSize(n);
  S.spawnT = 0;
  S.banner = 'WAVE ' + n;
  S.bannerT = 1.6;
  sfx('fanfare', { pitch: 1 + n * .03 });
  if (n % 5 === 0) {
    spawnKevin();
    S.banner = '⚠ KEVIN INBOUND ⚠';
    S.bannerT = 2.2;
  }
  g.state.wave = n;
}

function spawnEnforcer() {
  const edge = (R() * 4) | 0;
  let x, y;
  if (edge === 0) { x = rnd(40, W - 40); y = -30; }
  else if (edge === 1) { x = W + 30; y = rnd(120, H - 120); }
  else if (edge === 2) { x = rnd(40, W - 40); y = H + 30; }
  else { x = -30; y = rnd(120, H - 120); }
  const hp = CFG.enforcerHP + Math.floor(S.wave / 4);
  S.enemies.push({
    kind: 'enforcer', x, y, vx: 0, vy: 0, hp, maxHp: hp,
    r: CFG.enforcerR, t: R() * 6, shootT: rnd(1, 2.5), flash: 0,
    name: 'ENFORCER_' + ((R() * 90 + 10) | 0),
  });
}
function spawnKevin() {
  S.enemies.push({
    kind: 'kevin', x: W / 2, y: -50, vx: 0, vy: 0,
    hp: CFG.kevinHP, maxHp: CFG.kevinHP, r: CFG.kevinR,
    t: 0, shootT: 1.5, flash: 0, name: 'KEVIN',
  });
}

function addFeed(text, color = '#cfe0ff') {
  S.feed.unshift({ text, color, t: 0 });
  if (S.feed.length > 5) S.feed.pop();
}
function addHitmark(x, y, kill) {
  S.hitmarks.push({ x, y, t: 0, kill });
}

/* ================= killstreaks ================= */
function useDrone() {
  S.drone = 12; S.fineStrike = false;
  S.banner = '🛰 NOSY DRONE — UAV ONLINE'; S.bannerT = 1.8;
  sfx('powerup', { pitch: 1.3 });
  g.fx.emit('ring', S.px, S.py, { life: .6, size: 160, color: '#7df9ff', add: true });
}
function useFineStrike(tx, ty) {
  S.strikeAnim = { x: tx, y: ty, t: 0 };
  sfx('boom', { pitch: .9 });
}
function useManager() {
  S.nukeAnim = { t: 0 };
  S.slowmo = .5;
  sfx('fanfare', { pitch: .6 });
}

/* ================= combat ================= */
function fireBullet() {
  const a = S.aim;
  S.bullets.push({
    x: S.px + Math.cos(a) * 26, y: S.py + Math.sin(a) * 26,
    vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
    t: 0,
  });
  S.muzzle = .08;
  S.casings.push({ x: S.px, y: S.py, vx: rnd(-90, 90), vy: rnd(-140, -40), t: 0, rot: R() * 6 });
  sfx('shoot', { pitch: 1 + rnd(-.08, .08) });
  S.shake = Math.max(S.shake, 2);
}

function damageEnemy(e, dmg, kx, ky) {
  e.hp -= dmg;
  e.flash = .12;
  addHitmark(e.x, e.y - e.r, e.hp <= 0);
  sfx('hit', { pitch: 1.2 });
  if (e.hp <= 0) killEnemy(e, kx, ky);
  else { S.hitstop = Math.max(S.hitstop, .03); }
}

function killEnemy(e, kx, ky) {
  e.dead = true;
  S.kills++; S.streak++;
  g.score += e.kind === 'kevin' ? 500 : 100;
  g.combo.hit(e.x, e.y - 30, e.kind === 'kevin' ? '+500 KEVIN DOWN' : '+100');
  addFeed('YOU  ✕  ' + e.name, e.kind === 'kevin' ? '#ffd34d' : '#cfe0ff');
  // violation-notice confetti
  g.fx.burst(e.x, e.y, e.kind === 'kevin' ? 30 : 14, {
    kind: 'confetti', colors: ['#ffffff', '#ffd34d', '#ff3b5c', '#7df9ff'], speed: 300,
  });
  g.fx.emit('ring', e.x, e.y, { life: .4, size: e.r * 4, color: '#ff3b5c', add: true });
  sfx('pop', { pitch: e.kind === 'kevin' ? .7 : 1 + rnd(-.1, .1) });
  S.shake = Math.max(S.shake, e.kind === 'kevin' ? 10 : 5);
  S.hitstop = Math.max(S.hitstop, e.kind === 'kevin' ? .18 : .06);
  if (e.kind === 'kevin') { S.streak += 2; }
  // killstreak awards
  for (const st of STREAKS) {
    if (S.streak === st.kills) {
      S.banner = '🔥 ' + st.name + ' — ' + st.desc; S.bannerT = 2;
      sfx('perfect', { pitch: 1.2 });
      if (st.kills === 3) useDrone();
      if (st.kills === 5) S.fineStrike = true;
      if (st.kills === 7) S.manager = true;
    }
  }
  g.state.kills = S.kills; g.state.score = g.score;
}

function hurtPlayer(fromX, fromY) {
  if (S.invuln > 0) return;
  S.lives--; S.invuln = 1.6; S.streak = 0;
  S.dmgDir = Math.atan2(S.py - fromY, S.px - fromX);
  S.dmgDirT = .8;
  S.shake = Math.max(S.shake, 12);
  S.hitstop = Math.max(S.hitstop, .12);
  g.fx.burst(S.px, S.py, 18, { kind: 'spark', colors: ['#ff3b5c', '#ffffff'], speed: 320 });
  sfx('thud', { pitch: .8 });
  addFeed('ENFORCER  ✕  YOU', '#ff3b5c');
  g.state.lives = S.lives;
  if (S.lives <= 0) {
    g.end({ win: false, score: Math.round(g.score), label: 'KILLS' });
  }
}

/* ================= bot (filmable auto-play) ================= */
function botThink() {
  // kite: run from nearest enemy, keep mid-range
  let nx = null, nd = 1e9;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - S.px, e.y - S.py);
    if (d < nd) { nd = d; nx = e; }
  }
  if (nx) {
    const a = Math.atan2(S.py - nx.y, S.px - nx.x);
    const want = 240; // ideal range
    const radial = nd < want ? 1 : nd > want + 120 ? -1 : 0;
    const strafe = Math.sin(S.time * 1.7) > 0 ? 1 : -1;
    S.botTx = S.px + Math.cos(a) * radial * 120 + Math.cos(a + Math.PI / 2) * strafe * 90;
    S.botTy = S.py + Math.sin(a) * radial * 120 + Math.sin(a + Math.PI / 2) * strafe * 90;
    S.aim = Math.atan2(nx.y - S.py, nx.x - S.px);
  } else {
    S.botTx = W / 2 + Math.cos(S.time * .8) * 120;
    S.botTy = H / 2 + Math.sin(S.time * .8) * 120;
  }
  S.botTx = clamp(S.botTx, 50, W - 50);
  S.botTy = clamp(S.botTy, 130, H - 80);
  // killstreaks
  if (S.fineStrike) {
    // densest cluster
    let bx = W / 2, by = H / 2, best = 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      let c = 0;
      for (const o of S.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 150) c++;
      if (c > best) { best = c; bx = e.x; by = e.y; }
    }
    if (best >= 2) { useFineStrike(bx, by); }
  }
  if (S.manager && (S.lives === 1 || S.enemies.filter(e => !e.dead).length >= 6)) {
    useManager(); S.manager = false;
  }
}

/* ================= update ================= */
function nearestEnemy() {
  let best = null, bd = CFG.range;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - S.px, e.y - S.py);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function update(dt) {
  S.time += dt;
  if (S.hitstop > 0) { S.hitstop -= dt; return; }
  if (S.slowmo > 0) { S.slowmo -= dt; dt *= .25; }

  if (BOT) botThink();

  /* --- player movement --- */
  let mx = 0, my = 0;
  if (BOT) {
    const dx = S.botTx - S.px, dy = S.botTy - S.py;
    const d = Math.hypot(dx, dy);
    if (d > 8) { mx = dx / d; my = dy / d; }
  } else if (!BOT && g.ptr.down) {
    const dx = g.ptr.x - S.px, dy = g.ptr.y - S.py;
    const d = Math.hypot(dx, dy);
    if (d > 24) { mx = dx / d; my = dy / d; }
  }
  S.vx = lerp(S.vx, mx * CFG.playerSpeed, 1 - Math.pow(.0001, dt));
  S.vy = lerp(S.vy, my * CFG.playerSpeed, 1 - Math.pow(.0001, dt));
  S.px = clamp(S.px + S.vx * dt, 30, W - 30);
  S.py = clamp(S.py + S.vy * dt, 110, H - 60);

  /* --- auto-fire --- */
  S.fireT -= dt;
  const tgt = nearestEnemy();
  if (tgt) {
    S.aim = lerp(S.aim, Math.atan2(tgt.y - S.py, tgt.x - S.px), 1 - Math.pow(.000001, dt));
    if (S.fireT <= 0) { fireBullet(); S.fireT = CFG.fireCD; }
  }
  if (S.muzzle > 0) S.muzzle -= dt;
  if (S.invuln > 0) S.invuln -= dt;
  if (S.drone > 0) S.drone -= dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);

  /* --- spawning --- */
  if (S.spawnLeft > 0) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) { spawnEnforcer(); S.spawnLeft--; S.spawnT = CFG.spawnGap(S.wave); }
  } else if (!S.enemies.some(e => !e.dead)) {
    S.waveT += dt;
    if (S.waveT > 1.2) { S.waveT = 0; startWave(S.wave + 1); }
  }

  /* --- enemies --- */
  for (const e of S.enemies) {
    if (e.dead) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    const dx = S.px - e.x, dy = S.py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = e.kind === 'kevin' ? CFG.kevinSpeed : CFG.enforcerSpeed;
    // wobble approach
    const wob = Math.sin(e.t * 3) * 30;
    const nx = dx / d, ny = dy / d;
    e.vx = lerp(e.vx, (nx * spd + -ny * wob), 1 - Math.pow(.01, dt));
    e.vy = lerp(e.vy, (ny * spd + nx * wob), 1 - Math.pow(.01, dt));
    e.x += e.vx * dt; e.y += e.vy * dt;
    // touch damage
    if (d < e.r + CFG.playerR && S.invuln <= 0) hurtPlayer(e.x, e.y);
    // enforcers shoot slow violation tickets
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 420) {
      e.shootT = rnd(1.6, 2.8);
      const a = Math.atan2(dy, dx) + rnd(-.12, .12);
      S.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 0 });
      sfx('zap', { pitch: .7 });
    }
  }
  S.enemies = S.enemies.filter(e => !e.dead || (e.deadT = (e.deadT || 0) + dt) < .1);

  /* --- player bullets --- */
  for (const b of S.bullets) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6) {
        b.dead = true;
        damageEnemy(e, CFG.bulletDmg, b.vx, b.vy);
        g.fx.burst(b.x, b.y, 5, { kind: 'spark', colors: ['#ffd34d', '#ffffff'], speed: 200 });
        break;
      }
    }
  }
  S.bullets = S.bullets.filter(b => !b.dead && b.t < 2 && b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 40);

  /* --- enemy bullets --- */
  for (const b of S.ebullets) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.hypot(S.px - b.x, S.py - b.y) < CFG.playerR + 8) {
      b.dead = true;
      hurtPlayer(b.x - b.vx * .05, b.y - b.vy * .05);
    }
  }
  S.ebullets = S.ebullets.filter(b => !b.dead && b.t < 3 && b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 40);

  /* --- casings --- */
  for (const c of S.casings) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 500 * dt; c.rot += dt * 9; }
  S.casings = S.casings.filter(c => c.t < .8);

  /* --- fine strike animation --- */
  if (S.strikeAnim) {
    const st = S.strikeAnim;
    st.t += dt;
    if (st.t > .8 && !st.boom) {
      st.boom = true;
      g.fx.burst(st.x, st.y, 40, { kind: 'debris', colors: ['#ffd34d', '#ff8a3c', '#ffffff'], speed: 420 });
      g.fx.emit('ring', st.x, st.y, { life: .7, size: 320, color: '#ffd34d', add: true });
      sfx('explode', { pitch: .8 });
      S.shake = Math.max(S.shake, 16);
      for (const e of S.enemies) {
        if (!e.dead && Math.hypot(e.x - st.x, e.y - st.y) < 170) damageEnemy(e, 99, 0, 0);
      }
    }
    if (st.t > 1.4) S.strikeAnim = null;
  }

  /* --- manager nuke --- */
  if (S.nukeAnim) {
    const nk = S.nukeAnim;
    nk.t += dt;
    if (nk.t > 1.2 && !nk.boom) {
      nk.boom = true;
      for (const e of S.enemies) if (!e.dead) killEnemy(e, 0, 0);
      g.fx.burst(W / 2, H / 2, 90, { kind: 'confetti', colors: ['#ff3b5c', '#ffffff', '#ffd34d'], speed: 520 });
      sfx('boom', { pitch: .6 });
      S.shake = 24;
      S.banner = '💥 I WANT TO SPEAK TO YOUR MANAGER'; S.bannerT = 2.4;
    }
    if (nk.t > 2.6) { S.nukeAnim = null; music('chase'); }
  }

  /* --- feed / hitmarks / banner --- */
  for (const f of S.feed) f.t += dt;
  S.feed = S.feed.filter(f => f.t < 4);
  for (const hm of S.hitmarks) hm.t += dt;
  S.hitmarks = S.hitmarks.filter(hm => hm.t < .4);
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.dmgDirT > 0) S.dmgDirT -= dt;

  if (isAuto && (g.score >= 1500 || S.time > 75)) { /* bot films ~75s */ }
}

/* ================= draw ================= */
function drawArena(ctx) {
  // cul-de-sac asphalt
  ctx.fillStyle = '#10142a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(125,249,255,.10)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 200, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 120, 0, TAU); ctx.stroke();
  // lawns
  ctx.fillStyle = '#12241a';
  for (const [lx, ly] of [[40, 150], [W - 130, 150], [40, H - 220], [W - 130, H - 220]]) {
    rr(ctx, lx, ly, 90, 70, 10); ctx.fill();
  }
  // houses (decor)
  const house = (x, y, c) => {
    ctx.fillStyle = c; rr(ctx, x, y, 64, 50, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 32, y - 26); ctx.lineTo(x + 70, y); ctx.closePath(); ctx.fill();
  };
  house(48, 170, '#3d4a6e'); house(W - 122, 170, '#5e3d4a'); house(48, H - 200, '#4a5e3d'); house(W - 122, H - 200, '#3d5a6e');
  // center island
  ctx.fillStyle = '#182a1e'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1f3a26'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 44, 0, TAU); ctx.fill();
}

function drawPlayer(ctx) {
  const blink = S.invuln > 0 && Math.floor(S.time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(S.px, S.py);
  if (blink) ctx.globalAlpha = .4;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, 14, 20, 8, 0, 0, TAU); ctx.fill();
  ctx.rotate(S.aim + Math.PI / 2);
  // Allowance AR
  ctx.fillStyle = '#2a2f45'; rr(ctx, -4, -34, 8, 30, 3); ctx.fill();
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-4, -34, 8, 5);
  if (S.muzzle > 0) {
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.moveTo(-8, -36); ctx.lineTo(0, -52 - R() * 10); ctx.lineTo(8, -36); ctx.closePath(); ctx.fill();
  }
  // karen operative
  drawChar('person', ctx, 0, 0, 52, { dir: 1, t: S.time, color: '#ff6bd6' });
  ctx.restore();
  // drone indicator
  if (S.drone > 0) {
    ctx.save(); ctx.globalAlpha = .8;
    ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(S.px, S.py, 44 + Math.sin(S.time * 6) * 4, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) ctx.globalAlpha = .6;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, e.r * .6, e.r * .9, e.r * .35, 0, 0, TAU); ctx.fill();
  const ang = Math.atan2(S.py - e.y, S.px - e.x);
  ctx.rotate(ang + Math.PI / 2);
  if (e.kind === 'kevin') {
    drawChar('joker', ctx, 0, 0, e.r * 2.4, { dir: 1, t: e.t, color: '#8a8f9e' });
  } else {
    drawChar('robot', ctx, 0, 0, e.r * 2.4, { dir: 1, t: e.t, color: '#5a6e8a' });
  }
  ctx.restore();
  // hp bar
  if (e.hp < e.maxHp) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 6);
    ctx.fillStyle = '#ff3b5c'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * (e.hp / e.maxHp), 6);
  }
  // drone reveal ring
  if (S.drone > 0) {
    ctx.save(); ctx.globalAlpha = .5 + .3 * Math.sin(S.time * 8);
    ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function draw(ctx) {
  ctx.save();
  if (S.shake > 0) ctx.translate(rnd(-S.shake, S.shake), rnd(-S.shake, S.shake));
  drawArena(ctx);

  // casings
  for (const c of S.casings) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
  // enemy bullets (violation tickets)
  for (const b of S.ebullets) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#ff3b5c'; rr(ctx, -10, -5, 20, 10, 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('!', 0, 4);
    ctx.restore();
  }
  // player bullets
  ctx.fillStyle = '#fff2b0';
  for (const b of S.bullets) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
  for (const e of S.enemies) if (!e.dead) drawEnemy(ctx, e);
  drawPlayer(ctx);
  g.combo.draw(ctx);

  // fine strike telegraph + boom
  if (S.strikeAnim) {
    const st = S.strikeAnim;
    if (!st.boom) {
      ctx.save(); ctx.globalAlpha = .5 + .3 * Math.sin(S.time * 20);
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(st.x, st.y, 170, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,211,77,.15)';
      ctx.beginPath(); ctx.arc(st.x, st.y, 170, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  // manager nuke flash
  if (S.nukeAnim && S.nukeAnim.t < 1.4) {
    ctx.fillStyle = `rgba(255,255,255,${clamp(1.2 - S.nukeAnim.t, 0, .9)})`;
    ctx.fillRect(-30, -30, W + 60, H + 60);
    if (S.nukeAnim.boom) {
      const nr = (S.nukeAnim.t - 1.2) * 500;
      ctx.fillStyle = 'rgba(255,107,214,.35)';
      ctx.beginPath(); ctx.arc(W / 2, H / 2 - 100, nr, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function hud(ctx) {
  /* --- kill feed (top-left, CoD style) --- */
  ctx.textAlign = 'left';
  S.feed.forEach((f, i) => {
    const a = clamp(1 - f.t / 4, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    const tw = ctx.measureText(f.text).width;
    rr(ctx, 12, 108 + i * 30, tw + 90, 24, 6); ctx.fill();
    ctx.fillStyle = f.color; ctx.font = '800 13px system-ui';
    ctx.fillText(f.text, 20, 125 + i * 30);
    ctx.globalAlpha = 1;
  });

  /* --- minimap (top-right) --- */
  const mmx = W - 78, mmy = 66, mmr = 52;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.arc(mmx, mmy, mmr, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mmx, mmy, mmr, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.rect(mmx - mmr, mmy - mmr, mmr * 2, mmr * 2); ctx.clip();
  const sc = (mmr * 2) / Math.max(W, H);
  const dot = (x, y, c, r) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(mmx + (x - W / 2) * sc, mmy + (y - H / 2) * sc, r, 0, TAU); ctx.fill();
  };
  for (const e of S.enemies) if (!e.dead) dot(e.x, e.y, S.drone > 0 ? '#ff3b5c' : 'rgba(255,59,92,.45)', S.drone > 0 ? 4 : 3);
  dot(S.px, S.py, '#7df9ff', 5);
  ctx.restore();

  /* --- score / wave / lives (top bar) --- */
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, 0, 0, W, 96, 0); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffd34d'; ctx.font = '900 30px system-ui';
  ctx.fillText(String(g.score), 16, 40);
  ctx.fillStyle = '#8ea3c9'; ctx.font = '800 13px system-ui';
  ctx.fillText('SCORE', 16, 60);
  ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('WAVE ' + S.wave, W / 2, 36);
  ctx.fillStyle = '#8ea3c9'; ctx.font = '800 12px system-ui';
  ctx.fillText(S.kills + ' KILLS · STREAK ' + S.streak, W / 2, 58);
  // lives hearts
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < S.lives ? 1 : .25;
    ctx.font = '20px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('❤', W - 200 + i * 26, 40);
    ctx.globalAlpha = 1;
  }

  /* --- killstreak pips --- */
  STREAKS.forEach((st, i) => {
    const earned = S.streak >= st.kills;
    const x = 16 + i * 168, y = H - 40;
    ctx.fillStyle = earned ? st.color : 'rgba(255,255,255,.12)';
    ctx.globalAlpha = earned ? 1 : .5;
    rr(ctx, x, y - 22, 158, 30, 8); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = earned ? '#0b0f1e' : '#8ea3c9';
    ctx.font = '900 12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(st.kills + '☠ ' + st.name, x + 79, y - 2);
  });

  /* --- hitmarkers --- */
  for (const hm of S.hitmarks) {
    const a = 1 - hm.t / .4;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(hm.x, hm.y);
    ctx.strokeStyle = hm.kill ? '#ff3b5c' : '#fff'; ctx.lineWidth = hm.kill ? 4 : 3;
    const s = 10 + hm.t * 30;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.moveTo(dx * s * .5, dy * s * .5); ctx.lineTo(dx * s, dy * s); ctx.stroke();
    }
    ctx.restore();
  }

  /* --- damage direction --- */
  if (S.dmgDirT > 0) {
    ctx.save(); ctx.globalAlpha = clamp(S.dmgDirT * 1.5, 0, 1);
    ctx.translate(S.px, S.py); ctx.rotate(S.dmgDir);
    ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 70, -.5, .5); ctx.stroke();
    ctx.restore();
  }

  /* --- wave banner --- */
  if (S.bannerT > 0) {
    const a = clamp(S.bannerT, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, H * .38, W, 64);
    ctx.fillStyle = '#fff'; ctx.font = '900 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(S.banner, W / 2, H * .38 + 42);
    ctx.restore();
  }

  if (g.mode === 'title') {
    g.text('TAP TO DEPLOY', W / 2, H * .72, { size: 30, align: 'center', color: '#fff' });
    g.text('DRAG TO MOVE · GUN FIRES ITSELF', W / 2, H * .72 + 34, { size: 15, align: 'center', color: '#8ea3c9' });
  }
  if (BOT) {
    ctx.fillStyle = 'rgba(125,249,255,.7)'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('AUTO-PLAY', W - 12, H - 12);
  }
}

g.onReset = resetWorld;
resetWorld();
g.run(update, draw, hud);
